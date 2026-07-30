import crypto from 'node:crypto';
import { postgresVersionFromEtag } from '../core/postgres-store-repository.mjs';
import { VON_HALSKY_PRODUCT_QUEUE_SQL } from './von-halsky-product-queue-sql.mjs';

export const VON_HALSKY_STORE_KEY = 'inpost_von_halsky_channel';
const COLLECTIONS = Object.freeze([
  'diagnostics', 'offers', 'orders', 'returns',
  'claims', 'events', 'commands', 'categories',
]);

const clone = (value) => structuredClone(value);
const array = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const fingerprint = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = (value, max = 500) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const encodeCursor = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
const decodeCursor = (value) => {
  try {
    return object(JSON.parse(Buffer.from(text(value, 2048), 'base64url').toString('utf8')));
  } catch {
    return {};
  }
};

function recordId(kind, data = {}, ordinal = 0) {
  const candidates = [
    data.offerId, data.commandId, data.claimId, data.eventId, data.id,
    data?.offer?.id,
  ];
  const selected = candidates.map((value) => String(value || '').trim()).find(Boolean);
  return selected || crypto.createHash('sha256').update(`${kind}:${ordinal}:${JSON.stringify(data)}`).digest('hex');
}

function splitState(value = {}) {
  const source = object(value), meta = { ...source };
  for (const key of ['settings', 'sync', ...COLLECTIONS]) delete meta[key];
  return {
    settings: object(source.settings),
    sync: object(source.sync),
    collections: Object.fromEntries(COLLECTIONS.map((kind) => [kind, array(source[kind])])),
    meta,
  };
}

function hydrateState(row = {}, records = []) {
  const collections = Object.fromEntries(COLLECTIONS.map((kind) => [kind, []]));
  for (const record of records) {
    if (collections[record.kind]) collections[record.kind].push(record.data);
  }
  return {
    ...object(row.meta),
    settings: object(row.settings),
    sync: object(row.sync),
    ...collections,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.meta?.updatedAt || null,
  };
}

async function readSnapshot(pool, namespace, fallback, kinds = COLLECTIONS) {
  const selected = [...new Set(array(kinds).filter((kind) => COLLECTIONS.includes(kind)))];
  const result = await pool.query(`
    SELECT s.settings,s.sync,s.version,s.updated_at,
      (SELECT COUNT(*)::integer
       FROM artway_von_halsky_records categories
       WHERE categories.namespace=s.namespace AND categories.kind='categories') category_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object('kind',r.kind,'ordinal',r.ordinal,'data',r.data)
          ORDER BY r.kind,r.ordinal
        ) FILTER (WHERE r.record_id IS NOT NULL),
        '[]'::jsonb
      ) records
    FROM artway_von_halsky_state s
    LEFT JOIN artway_von_halsky_records r
      ON r.namespace=s.namespace AND r.kind=ANY($2::text[])
    WHERE s.namespace=$1
    GROUP BY s.namespace,s.settings,s.sync,s.version,s.updated_at
  `, [namespace, selected]);
  if (!result.rowCount) return { ...clone(fallback), categoryCount: 0 };
  const row = result.rows[0];
  return {
    ...hydrateState({
      ...row,
      meta: { channel: 'InPost Von Halsky' },
    }, row.records || []),
    categoryCount: Number(row.category_count) || 0,
  };
}

async function tableAvailable(pool) {
  const result = await pool.query("SELECT to_regclass('public.artway_von_halsky_state') IS NOT NULL AS available");
  return result.rows[0]?.available === true;
}

export function createVonHalskyStateRepository({
  pool,
  namespace = 'artway-sklep',
  legacy,
} = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('Repozytorium Von Halsky wymaga PostgreSQL.');
  if (!legacy?.readVersioned || !legacy?.writeIfVersion) throw new TypeError('Repozytorium Von Halsky wymaga bezpiecznego magazynu zgodnościowego.');
  let availability;
  const available = async () => {
    if (availability === undefined) availability = await tableAvailable(pool);
    return availability;
  };

  async function readVersioned(key, fallback) {
    if (key !== VON_HALSKY_STORE_KEY || !await available()) return legacy.readVersioned(key, fallback);
    const result = await pool.query(`
      SELECT s.settings,s.sync,s.version,s.updated_at,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('kind',r.kind,'ordinal',r.ordinal,'data',r.data)
            ORDER BY r.kind,r.ordinal
          ) FILTER (WHERE r.record_id IS NOT NULL),
          '[]'::jsonb
        ) records
      FROM artway_von_halsky_state s
      LEFT JOIN artway_von_halsky_records r
        ON r.namespace=s.namespace
      WHERE s.namespace=$1
      GROUP BY s.namespace,s.settings,s.sync,s.version,s.updated_at
    `, [namespace]);
    if (!result.rowCount) return legacy.readVersioned(key, fallback);
    const row = result.rows[0], value = hydrateState({
      ...row,
      meta: { channel: 'InPost Von Halsky' },
    }, row.records || []);
    return {
      value,
      etag: `"${row.version}"`,
      exists: true,
      collectionFingerprints: Object.fromEntries(
        COLLECTIONS.map((kind) => [kind, fingerprint(value[kind])]),
      ),
    };
  }

  async function readOverview(fallback) {
    if (!await available()) return (await legacy.readVersioned(VON_HALSKY_STORE_KEY, fallback)).value;
    // Pierwszy widok potrzebuje tylko konfiguracji i krótkiej diagnostyki.
    // Oferty, zamówienia oraz statystyki mają osobne, stronicowane odczyty.
    return readSnapshot(pool, namespace, fallback, ['diagnostics']);
  }

  async function readStatus(fallback) {
    if (!await available()) return (await legacy.readVersioned(VON_HALSKY_STORE_KEY, fallback)).value;
    const [state, statuses, commands] = await Promise.all([
      pool.query('SELECT settings,sync,version,updated_at FROM artway_von_halsky_state WHERE namespace=$1', [namespace]),
      pool.query(`
        SELECT status,COUNT(*)::integer count
        FROM artway_von_halsky_records
        WHERE namespace=$1 AND kind='offers'
        GROUP BY status
      `, [namespace]),
      pool.query(`
        SELECT COUNT(*) FILTER (
          WHERE status NOT IN ('SUCCESS','FAILURE','FAILED','CANCELLED','NOT_FOUND')
        )::integer pending,
        COUNT(*)::integer total
        FROM artway_von_halsky_records
        WHERE namespace=$1 AND kind='commands'
      `, [namespace]),
    ]);
    if (!state.rowCount) return clone(fallback);
    const statusMap = Object.fromEntries(statuses.rows.map((row) => [row.status || 'UNKNOWN', Number(row.count) || 0]));
    const truth = {
      total: Object.values(statusMap).reduce((sum, count) => sum + count, 0),
      published: statusMap.PUBLISHED || 0,
      pending: (statusMap.PENDING || 0) + (statusMap.PROCESSING || 0),
      rejected: (statusMap.REJECTED || 0) + (statusMap.ERROR || 0),
      closed: (statusMap.CLOSED || 0) + (statusMap.SOLDOUT || 0) + (statusMap.INACTIVE || 0),
      statuses: statusMap,
    };
    const row = state.rows[0], command = commands.rows[0] || {};
    return {
      ...clone(fallback),
      settings: object(row.settings),
      sync: {
        ...object(row.sync),
        pendingCommandCount: Number(command.pending) || 0,
      },
      truth,
      commandSummary: { pending: Number(command.pending) || 0, total: Number(command.total) || 0 },
      updatedAt: row.updated_at,
    };
  }

  async function readDashboardSummary(fallback = {}) {
    if (!await available()) return { ...clone(fallback), available: false };
    const [status, orders, daily, recent, rejected] = await Promise.all([
      readStatus(fallback),
      pool.query(`
        SELECT status,COUNT(*)::integer count,
          COALESCE(SUM(total_amount),0)::numeric total
        FROM artway_order_headers
        WHERE namespace=$1 AND channel='von_halsky'
        GROUP BY status
      `, [namespace]),
      pool.query(`
        SELECT to_char(placed_at AT TIME ZONE 'Europe/Warsaw','YYYY-MM-DD') day,
          COUNT(*)::integer count,COALESCE(SUM(total_amount),0)::numeric total
        FROM artway_order_headers
        WHERE namespace=$1 AND channel='von_halsky'
          AND placed_at>=NOW()-INTERVAL '45 days'
          AND status NOT IN ('CANCELLED','REFUSED','REFUNDED','RETURNED')
        GROUP BY 1 ORDER BY 1
      `, [namespace]),
      pool.query(`
        SELECT kind,data,updated_at
        FROM artway_von_halsky_records
        WHERE namespace=$1 AND kind IN ('events','commands','diagnostics')
        ORDER BY updated_at DESC,ordinal
        LIMIT 12
      `, [namespace]),
      pool.query(`
        SELECT data
        FROM artway_von_halsky_records
        WHERE namespace=$1 AND kind='offers' AND status IN ('REJECTED','ERROR')
        ORDER BY ordinal
        LIMIT 200
      `, [namespace]),
    ]);
    const orderStatuses = Object.fromEntries(orders.rows.map((row) => [
      row.status || 'UNKNOWN',
      { count: Number(row.count) || 0, total: Number(row.total) || 0 },
    ]));
    const activeOrderStatuses = new Set(['CREATED', 'NEW', 'PAID', 'ACCEPTED', 'PROCESSING', 'READY']);
    const activeOrders = Object.entries(orderStatuses).reduce(
      (sum, [name, row]) => sum + (activeOrderStatuses.has(name) ? row.count : 0),
      0,
    );
    const rejectionCounts = new Map();
    for (const row of rejected.rows) {
      const source = object(row.data), values = [
        ...array(source.validationErrors),
        ...array(source.rejectionReasons),
        ...array(source.metadata?.validationErrors),
        ...array(source.metadata?.rejectionReasons),
      ];
      for (const entry of values) {
        const label = text(entry?.validationMessage || entry?.message || entry?.code || 'Nieokreślony błąd', 240);
        if (label) rejectionCounts.set(label, (rejectionCounts.get(label) || 0) + 1);
      }
    }
    return {
      available: true,
      settings: status.settings,
      sync: status.sync,
      truth: status.truth,
      commands: status.commandSummary,
      orders: {
        total: Object.values(orderStatuses).reduce((sum, row) => sum + row.count, 0),
        active: activeOrders,
        statuses: orderStatuses,
        daily: daily.rows.map((row) => ({ day: row.day, count: Number(row.count) || 0, total: Number(row.total) || 0 })),
      },
      rejectionReasons: [...rejectionCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pl'))
        .slice(0, 6)
        .map(([label, count]) => ({ label, count })),
      recent: recent.rows.map((row) => ({ kind: row.kind, data: row.data, updatedAt: row.updated_at })),
      updatedAt: status.updatedAt,
    };
  }

  async function readRecordPage(kind, raw = {}) {
    if (!await available() || !COLLECTIONS.includes(kind)) return { items: [], total: 0, nextCursor: null };
    const limit = Math.max(1, Math.min(250, Number(raw.limit) || 30));
    const cursor = decodeCursor(raw.cursor), offset = Math.max(0, Number(cursor.offset) || 0);
    const query = text(raw.query || raw.q, 300).toLocaleLowerCase('pl-PL');
    const statusSource = Array.isArray(raw.statuses)
      ? raw.statuses
      : [raw.statuses ?? raw.status];
    const statuses = [...new Set(statusSource
      .flatMap((value) => String(value || '').split(','))
      .map((value) => text(value, 60).toUpperCase())
      .filter(Boolean))].slice(0, 30);
    const values = [namespace, kind], clauses = ['namespace=$1', 'kind=$2'];
    if (query) {
      values.push(`%${query.replace(/[%_]/g, '\\$&')}%`);
      clauses.push(`lower(data::text) LIKE $${values.length} ESCAPE '\\'`);
    }
    if (statuses.length) {
      values.push(statuses);
      clauses.push(`status=ANY($${values.length}::text[])`);
    }
    const where = clauses.join(' AND '), countValues = [...values];
    values.push(limit + 1, offset);
    const [rows, count] = await Promise.all([
      pool.query(`
        SELECT record_id,data,status,updated_at
        FROM artway_von_halsky_records
        WHERE ${where}
        ORDER BY updated_at DESC,record_id
        LIMIT $${values.length - 1} OFFSET $${values.length}
      `, values),
      pool.query(`SELECT COUNT(*)::integer total FROM artway_von_halsky_records WHERE ${where}`, countValues),
    ]);
    const hasMore = rows.rows.length > limit, selected = rows.rows.slice(0, limit);
    return {
      items: selected.map((row) => ({ ...object(row.data), _recordId: row.record_id, _status: row.status, _updatedAt: row.updated_at })),
      total: Number(count.rows[0]?.total) || 0,
      limit,
      nextCursor: hasMore ? encodeCursor({ version: 1, offset: offset + limit }) : null,
      previousCursor: offset > 0 ? encodeCursor({ version: 1, offset: Math.max(0, offset - limit) }) : null,
      offset,
    };
  }

  async function readProductQueue(raw = {}) {
    if (!await available()) return { items: [], total: 0, nextCursor: null, summary: {}, facets: {} };
    const limit = Math.max(1, Math.min(1000, Number(raw.limit) || 25));
    const cursor = decodeCursor(raw.cursor);
    const offset = Math.max(0, raw.cursor ? Number(cursor.offset) || 0 : (Math.max(1, Number(raw.page) || 1) - 1) * limit);
    const q = text(raw.query || raw.q, 300).toLocaleLowerCase('pl-PL')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();
    const values = [namespace], clauses = ['TRUE'];
    const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)); };
    if (q) add("search_vector @@ to_tsquery('simple',?)", q.split(/\s+/).filter(Boolean).map((term) => `${term}:*`).join(' & '));
    const stage = text(raw.stage, 40);
    if (stage && stage !== 'wszystkie') add('stage=?', stage);
    const channel = text(raw.channel, 40);
    if (channel === 'aktywne') clauses.push("remote_status='PUBLISHED'");
    else if (channel === 'weryfikacja') clauses.push("remote_status IN ('PENDING','PROCESSING','VERIFYING')");
    else if (channel === 'odrzucone') clauses.push("remote_status IN ('REJECTED','ERROR')");
    else if (channel === 'niewystawione') clauses.push("offer_id=''");
    const availability = text(raw.availability, 40);
    if (availability === 'dostepne') clauses.push('sale_available');
    else if (availability === 'wstrzymane') clauses.push('NOT sale_available');
    const producer = text(raw.producer, 300);
    if (producer && producer !== 'wszyscy') add('producer=?', producer);
    const category = text(raw.category, 300);
    if (category && category !== 'wszystkie') add('category=?', category);
    const quality = text(raw.quality, 40);
    if (quality === 'gotowe') clauses.push('ready');
    else if (quality === 'braki') clauses.push('NOT ready');
    else if (quality === 'ean') clauses.push("ean<>''");
    else if (quality === 'bez-ean') clauses.push("ean=''");
    else if (quality === 'kategoria') clauses.push("category_id<>''");
    else if (quality === 'bez-kategorii') clauses.push("category_id=''");
    else if (quality === 'gpsr') clauses.push('(NOT gpsr_required OR gpsr_missing=0)');
    else if (quality === 'bez-gpsr') clauses.push('(gpsr_required AND gpsr_missing>0)');
    const agent = text(raw.agent, 40);
    if (agent === 'gotowe') clauses.push("agent_status IN ('ready','confirmed')");
    else if (agent === 'wymaga-danych') clauses.push("agent_status IN ('requires_data','review','decision_required')");
    else if (agent === 'ponowienie') clauses.push("agent_status IN ('retry','retry_pending')");
    else if (agent === 'blad') clauses.push("agent_status IN ('error','failed')");
    else if (agent === 'oczekuje') clauses.push("agent_status=''");
    const price = text(raw.price, 40);
    if (price === 'z-cena') clauses.push('channel_price>0');
    else if (price === 'bez-ceny') clauses.push('channel_price<=0');
    const problem = text(raw.problem, 40);
    if (problem === 'identyfikacja') clauses.push("ean='' AND (producer_code='' OR brand='')");
    else if (problem === 'zdjecie') clauses.push("image=''");
    else if (problem === 'opis') clauses.push('length(channel_name) NOT BETWEEN 7 AND 150 OR channel_description_length<100');
    else if (problem === 'kategoria') clauses.push("category_id=''");
    else if (problem === 'gpsr') clauses.push('gpsr_required AND gpsr_missing>0');
    else if (problem === 'cena') clauses.push('channel_price<=0');
    const where = clauses.join(' AND ');
    const order = {
      nazwa: 'channel_name,product_id',
      ean: "NULLIF(ean,'') NULLS LAST,product_id",
      cena: 'channel_price DESC,product_id',
      external: "COALESCE(NULLIF(external_id,''),NULLIF(sku,''),product_id),product_id",
      jakosc: 'agent_score,ready,channel_name,product_id',
    }[text(raw.sort, 40)] || 'agent_score,ready,channel_name,product_id';
    const countValues = [...values];
    values.push(limit + 1, offset);
    const [rows, metadata] = await Promise.all([
      pool.query(`${VON_HALSKY_PRODUCT_QUEUE_SQL},
        selected AS (
          SELECT *,row_number() OVER(ORDER BY ${order}) queue_position
          FROM classified WHERE ${where}
          ORDER BY ${order} LIMIT $${values.length - 1} OFFSET $${values.length}
        )
        SELECT selected.product || jsonb_strip_nulls(jsonb_build_object(
          'opis',details.data->'opis',
          'dlugiOpis',details.data->'dlugiOpis',
          'description',details.data->'description',
          'zdjecia',details.data->'zdjecia',
          'images',details.data->'images',
          'parametry',details.data->'parametry',
          'parameters',details.data->'parameters',
          'parametryZrodla',details.data->'parametryZrodla',
          'parametryProducenta',details.data->'parametryProducenta',
          'sprzedazAktywna',details.data->'sprzedazAktywna',
          'ukryty',details.data->'ukryty',
          'aktywny',details.data->'aktywny',
          'saleAvailable',details.data->'saleAvailable'
        )) product
        FROM selected
        JOIN artway_product_records details
          ON details.namespace=$1 AND details.product_id=selected.product_id
        ORDER BY selected.queue_position`, values),
      pool.query(`${VON_HALSKY_PRODUCT_QUEUE_SQL}
        SELECT
          (SELECT COUNT(*)::integer FROM classified WHERE ${where}) total,
          (SELECT jsonb_build_object(
            'total',COUNT(*)::integer,
            'ready',COUNT(*) FILTER(WHERE ready)::integer,
            'missing',COUNT(*) FILTER(WHERE NOT ready)::integer,
            'selling',COUNT(*) FILTER(WHERE stage='sprzedaz')::integer,
            'publishing',COUNT(*) FILTER(WHERE stage='publikowanie')::integer,
            'publishable',COUNT(*) FILTER(WHERE stage='wystawienie')::integer,
            'preparation',COUNT(*) FILTER(WHERE stage='przygotowanie')::integer,
            'update_required',COUNT(*) FILTER(WHERE stage='aktualizacja')::integer,
            'paused',COUNT(*) FILTER(WHERE stage='wstrzymane')::integer
          ) FROM classified) summary,
          (SELECT COALESCE(jsonb_agg(jsonb_build_object('value',value,'count',count) ORDER BY value),'[]'::jsonb)
           FROM (SELECT producer value,COUNT(*)::integer count FROM classified
             WHERE producer<>'' GROUP BY producer) producer_facets) producers,
          (SELECT COALESCE(jsonb_agg(jsonb_build_object('value',value,'count',count) ORDER BY value),'[]'::jsonb)
           FROM (SELECT category value,COUNT(*)::integer count FROM classified
             WHERE category<>'' GROUP BY category) category_facets) categories`, countValues),
    ]);
    const hasMore = rows.rows.length > limit;
    const meta = metadata.rows[0] || {}, summary = object(meta.summary);
    return {
      items: rows.rows.slice(0, limit).map((row) => row.product),
      total: Number(meta.total) || 0,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      nextCursor: hasMore ? encodeCursor({ version: 1, offset: offset + limit }) : null,
      previousCursor: offset > 0 ? encodeCursor({ version: 1, offset: Math.max(0, offset - limit) }) : null,
      summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Number(value) || 0])),
      facets: {
        producers: array(meta.producers).map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
        categories: array(meta.categories).map((row) => ({ value: row.value, count: Number(row.count) || 0 })),
      },
      pagination: 'cursor',
    };
  }

  async function replaceCollection(client, kind, items) {
    const payload = array(items).map((data, ordinal) => ({
      record_id: recordId(kind, data, ordinal),
      ordinal,
      data,
    }));
    if (payload.length) {
      await client.query(`
        WITH incoming AS (
          SELECT record_id,ordinal,data
          FROM jsonb_to_recordset($3::jsonb)
            AS x(record_id text,ordinal bigint,data jsonb)
        )
        INSERT INTO artway_von_halsky_records(
          namespace,kind,record_id,ordinal,data,updated_at
        )
        SELECT $1,$2,record_id,ordinal,data,NOW()
        FROM incoming
        ON CONFLICT(namespace,kind,record_id) DO UPDATE
        SET ordinal=EXCLUDED.ordinal,data=EXCLUDED.data,updated_at=NOW()
        WHERE artway_von_halsky_records.ordinal IS DISTINCT FROM EXCLUDED.ordinal
           OR artway_von_halsky_records.data IS DISTINCT FROM EXCLUDED.data
      `, [namespace, kind, JSON.stringify(payload)]);
      await client.query(`
        DELETE FROM artway_von_halsky_records current
        WHERE current.namespace=$1 AND current.kind=$2
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_to_recordset($3::jsonb)
              AS x(record_id text,ordinal bigint,data jsonb)
            WHERE x.record_id=current.record_id
          )
      `, [namespace, kind, JSON.stringify(payload)]);
    } else {
      await client.query(
        'DELETE FROM artway_von_halsky_records WHERE namespace=$1 AND kind=$2',
        [namespace, kind],
      );
    }
  }

  async function writeIfVersion(key, value, version = {}) {
    if (key !== VON_HALSKY_STORE_KEY || !await available()) return legacy.writeIfVersion(key, value, version);
    const expectedVersion = postgresVersionFromEtag(version.etag);
    if (!Number.isSafeInteger(expectedVersion)) return { modified: false };
    const next = splitState(value), previous = splitState(version.value);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(`
        UPDATE artway_von_halsky_state
        SET settings=$3::jsonb,sync=$4::jsonb,version=version+1,updated_at=NOW()
        WHERE namespace=$1 AND version=$2
        RETURNING version,updated_at
      `, [namespace, expectedVersion, JSON.stringify(next.settings), JSON.stringify(next.sync)]);
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return { modified: false };
      }
      for (const kind of COLLECTIONS) {
        const before = version.collectionFingerprints?.[kind] || fingerprint(previous.collections[kind]);
        const after = fingerprint(next.collections[kind]);
        if (before !== after) await replaceCollection(client, kind, next.collections[kind]);
      }
      await client.query('COMMIT');
      return {
        modified: true,
        etag: `"${updated.rows[0].version}"`,
        updatedAt: updated.rows[0].updated_at,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return Object.freeze({
    readVersioned,
    writeIfVersion,
    readOverview,
    readStatus,
    readDashboardSummary,
    readRecordPage,
    readProductQueue,
    available,
  });
}
