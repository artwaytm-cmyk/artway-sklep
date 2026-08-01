import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemDiagnosticsRoute } from '../src/backend/lib/system-diagnostics-route.mjs';

function fixture(overrides = {}) {
  let value = {}, version = 0;
  const reports = [];
  const service = createSystemDiagnosticsRoute({
    readVersioned: async () => ({ value: structuredClone(value), etag: `"${version}"`, exists: version > 0 }),
    writeIfVersion: async (_key, next, expected) => {
      if (String(expected?.etag || '') !== `"${version}"`) return { modified: false };
      value = structuredClone(next); version += 1;
      return { modified: true, version };
    },
    respond: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } }),
    isAdmin: (request) => request.headers.get('x-admin') === '1',
    rateLimit: () => null,
    sessionOf: () => ({ email: 'administrator@example.test' }),
    agentRuntime: { report: async (event) => { reports.push(event); } },
    now: (() => {
      let tick = 0;
      return () => new Date(Date.UTC(2026, 6, 26, 1, 0, tick++));
    })(),
    ...overrides,
  });
  return { service, reports, record: () => structuredClone(value) };
}

async function json(response) {
  return JSON.parse(await response.text());
}

test('centralna diagnostyka grupuje powtórzenia i nie zapisuje sekretów ani danych klienta', async () => {
  const { service, record, reports } = fixture();
  const request = new Request('https://artwaytm.pl/api/store?action=diagnostics-ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin': '1' },
    body: JSON.stringify({ events: [
      { level: 'blad', message: 'Błąd sk-proj-1234567890123456 dla klient@example.pl', source: 'app.js:10:2', route: '/#/admin/system?token=sekret', release: 'r1' },
      { level: 'blad', message: 'Błąd sk-proj-1234567890123456 dla klient@example.pl', source: 'app.js:10:2', route: '/#/admin/system?token=sekret', release: 'r1' },
    ] }),
  });
  const response = await service.route(request, new URL(request.url), 'diagnostics-ingest');
  assert.equal(response.status, 202);
  assert.deepEqual((await json(response)).summary, { total: 1, open: 1, errors: 1, warnings: 0, occurrences: 2 });
  assert.equal(record().items.length, 1);
  assert.equal(record().items[0].count, 2);
  assert.doesNotMatch(JSON.stringify(record()), /sk-proj-|klient@example|token=sekret/);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].work.status, 'failed');
});

test('administrator może uruchomić analizę Agents SDK, a wynik zostaje przy konkretnym błędzie', async () => {
  const diagnosticAgent = {
    status: () => ({ configured: true, model: 'gpt-5.6-sol', reasoning: 'max' }),
    analyze: async () => ({
      classification: 'application_bug',
      rootCause: 'Błędna rewizja zapisu.',
      confidence: 0.96,
      evidence: ['Powtarzalny konflikt tej samej domeny.'],
      recommendedActions: [{ action: 'Scalić zapis przez CAS.', risk: 'low', automatic: false }],
      validationPlan: ['Powtórzyć dwa równoległe zapisy.'],
      safeAutomaticAction: 'none',
      requiresHumanApproval: true,
      summary: 'Konflikt wersji zapisu.',
      model: 'gpt-5.6-sol',
      reasoning: 'max',
      mode: 'standard',
      analyzedAt: '2026-07-26T01:05:00.000Z',
    }),
  };
  const { service, record } = fixture({ diagnosticAgent });
  await service.record([{ level: 'blad', message: 'Konflikt zapisu domeny', source: 'cloud-sync' }]);
  const id = record().items[0].id;
  const request = new Request('https://artwaytm.pl/api/store?action=diagnostics-central-analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin': '1' },
    body: JSON.stringify({ ids: [id] }),
  });
  const response = await service.route(request, new URL(request.url), 'diagnostics-central-analyze');
  assert.equal(response.status, 202);
  assert.equal((await json(response)).queued, 1);
  for (let attempt = 0; attempt < 20 && record().items[0].analysis.status !== 'completed'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(record().items[0].analysis.status, 'completed');
  assert.equal(record().items[0].analysis.model, 'gpt-5.6-sol');
  assert.match(record().items[0].analysis.rootCause, /rewizja/i);
});

test('rozwiązany problem wraca automatycznie po ponownym wystąpieniu', async () => {
  const { service, record } = fixture();
  await service.record([{ level: 'ostrzezenie', message: 'Połączenie chwilowo niedostępne', source: 'backend:test', route: '/api/store' }], { trusted: true });
  const id = record().items[0].id;
  const resolveRequest = new Request('https://artwaytm.pl/api/store?action=diagnostics-central-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin': '1' },
    body: JSON.stringify({ ids: [id], status: 'resolved', resolution: 'Naprawiono' }),
  });
  const resolved = await service.route(resolveRequest, new URL(resolveRequest.url), 'diagnostics-central-update');
  assert.equal((await json(resolved)).summary.open, 0);
  await service.record([{ level: 'ostrzezenie', message: 'Połączenie chwilowo niedostępne', source: 'backend:test', route: '/api/store' }]);
  assert.equal(record().items[0].status, 'open');
  assert.equal(record().items[0].count, 2);
});

test('udany test integracji automatycznie zamyka powiązany błąd backendu i kontrolę autotestu', async () => {
  const { service, record } = fixture();
  await service.record([
    { level: 'ostrzezenie', message: 'inpost_network_error: Nie udało się połączyć z InPost ShipX.', source: 'backend:inpost-test', route: '/api/store', kind: 'backend' },
    { level: 'ostrzezenie', message: 'InPost ShipX API: konfiguracja zapisana, test nieudany', source: 'autotest:Integracje', route: '/#/admin/system/diagnostyka', kind: 'autotest' },
  ], { trusted: true });
  const result = await service.resolveMatching([
    { source: 'backend:inpost-test', route: '/api/store' },
    { source: 'autotest:Integracje', messageIncludes: 'InPost ShipX API' },
  ], { resolution: 'Ponowny test InPost zakończył się powodzeniem.' });
  assert.equal(result.changed, 2);
  assert.ok(record().items.every((item) => item.status === 'resolved'));
  assert.ok(record().items.every((item) => /powodzeniem/i.test(item.resolution)));
});

test('powtórne wysłanie starego zdarzenia nie otwiera ponownie rozwiązanego problemu', async () => {
  const { service, record } = fixture();
  const event = {
    level: 'blad',
    message: 'Historyczny błąd zapisu ustawień',
    source: 'przeglądarka',
    route: '/#/admin/system/logi',
    at: '2026-07-26T00:55:00.000Z',
  };
  await service.record([event], { trusted: true });
  const id = record().items[0].id;
  const resolveRequest = new Request('https://artwaytm.pl/api/store?action=diagnostics-central-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin': '1' },
    body: JSON.stringify({ ids: [id], status: 'resolved', resolution: 'Naprawiono' }),
  });
  await service.route(resolveRequest, new URL(resolveRequest.url), 'diagnostics-central-update');
  await service.record([event], { trusted: true });
  assert.equal(record().items[0].status, 'resolved');
  assert.equal(record().items[0].count, 1);
});

test('pełny rejestr centralny jest dostępny wyłącznie administratorowi', async () => {
  const { service } = fixture();
  await service.record([{ level: 'blad', message: 'Błąd renderowania', source: 'router', route: '/#/admin' }]);
  const deniedRequest = new Request('https://artwaytm.pl/api/store?action=diagnostics-central');
  const denied = await service.route(deniedRequest, new URL(deniedRequest.url), 'diagnostics-central');
  assert.equal(denied.status, 401);
  const adminRequest = new Request('https://artwaytm.pl/api/store?action=diagnostics-central&status=open', { headers: { 'x-admin': '1' } });
  const allowed = await service.route(adminRequest, new URL(adminRequest.url), 'diagnostics-central');
  const body = await json(allowed);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 1);
  assert.equal(body.summary.errors, 1);
});

test('projekcja PostgreSQL zwraca jedną rewizję, ETag i 304 bez ponownego przesyłania danych', async () => {
  let reads = 0;
  const projection = {
    exists: true,
    version: '"91"',
    updatedAt: '2026-08-01T08:00:00.000Z',
    metadata: { lastIngestAt: '2026-08-01T07:59:58.000Z' },
    items: [{ id: 'diag-db-1', fingerprint: 'db-1', level: 'blad', message: 'Błąd z PostgreSQL', source: 'backend:test', route: '/api/store', status: 'open', count: 3, firstSeenAt: '2026-08-01T07:00:00.000Z', lastSeenAt: '2026-08-01T08:00:00.000Z' }],
    summary: { total: 20, open: 4, errors: 2, warnings: 2, occurrences: 11 },
  };
  const { service } = fixture({ readProjection: async () => { reads += 1; return projection; } });
  const firstRequest = new Request('https://artwaytm.pl/api/store?action=diagnostics-central&status=all', { headers: { 'x-admin': '1' } });
  const first = await service.route(firstRequest, new URL(firstRequest.url), 'diagnostics-central');
  const body = await json(first);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('etag'), 'W/"artway-diagnostics-91"');
  assert.equal(first.headers.get('x-artway-data-source'), 'postgresql');
  assert.equal(body.source, 'postgresql');
  assert.deepEqual(body.summary, projection.summary);
  assert.equal(body.items.length, 1);

  const secondRequest = new Request('https://artwaytm.pl/api/store?action=diagnostics-central&status=all', { headers: { 'x-admin': '1', 'if-none-match': body.etag } });
  const second = await service.route(secondRequest, new URL(secondRequest.url), 'diagnostics-central');
  assert.equal(second.status, 304);
  assert.equal(await second.text(), '');
  assert.equal(reads, 2);
});

test('pełny autotest przekazuje Agentowi błędy i ostrzeżenia oraz zamyka ustąpione kontrole', async () => {
  const analyzed = [];
  const diagnosticAgent = {
    status: () => ({ configured: true, model: 'gpt-5.4-mini' }),
    analyze: async (item) => {
      analyzed.push(item.id);
      return {
        classification: 'data_conflict',
        rootCause: 'Osierocone odwołanie.',
        confidence: 0.9,
        evidence: [item.message],
        recommendedActions: [{ action: 'Usunąć wyłącznie osierocone odwołanie.', risk: 'low', automatic: true }],
        validationPlan: ['Ponowić pełny autotest.'],
        safeAutomaticAction: 'retry_read_only_check',
        requiresHumanApproval: false,
        summary: 'Kontrola spójności wymaga naprawy.',
      };
    },
  };
  const { service, record } = fixture({ diagnosticAgent });
  const first = new Request('https://artwaytm.pl/api/store?action=diagnostics-checks-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin': '1' },
    body: JSON.stringify({ checks: [
      { level: 'blad', message: 'Renderowanie: błąd widoku', source: 'autotest:Widoki', kind: 'autotest' },
      { level: 'ostrzezenie', message: 'Spójność koszyka: 2 odwołania', source: 'autotest:Dane', kind: 'autotest' },
    ] }),
  });
  const firstResponse = await service.route(first, new URL(first.url), 'diagnostics-checks-sync');
  assert.equal(firstResponse.status, 202);
  assert.equal((await json(firstResponse)).summary.open, 2);
  for (let attempt = 0; attempt < 30 && analyzed.length < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(analyzed.length, 2);

  const second = new Request('https://artwaytm.pl/api/store?action=diagnostics-checks-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin': '1' },
    body: JSON.stringify({ checks: [] }),
  });
  const secondResponse = await service.route(second, new URL(second.url), 'diagnostics-checks-sync');
  assert.equal((await json(secondResponse)).summary.open, 0);
  assert.ok(record().items.every((item) => item.status === 'resolved'));
  assert.ok(record().items.every((item) => /autotest/i.test(item.resolution)));
});

test('zmienne szczegóły tego samego autotestu nie tworzą kolejnych grup błędów', async () => {
  const { service, record } = fixture();
  for (const message of [
    'Pamięć operacyjna przeglądarki: 3400 KB',
    'Pamięć operacyjna przeglądarki: 3500 KB',
  ]) {
    const request = new Request('https://artwaytm.pl/api/store?action=diagnostics-checks-sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin': '1' },
      body: JSON.stringify({ checks: [{
        level: 'ostrzezenie',
        message,
        source: 'autotest:Pamięć',
        route: '/#/admin/system/diagnostyka',
        kind: 'autotest',
      }] }),
    });
    await service.route(request, new URL(request.url), 'diagnostics-checks-sync');
  }
  assert.equal(record().items.length, 1);
  assert.equal(record().items[0].count, 2);
  assert.match(record().items[0].message, /3500 KB/);
});

test('pozytywny autotest zamyka odpowiadające mu stare zdarzenia przeglądarki, ale nie inne błędy', async () => {
  const { service, record } = fixture();
  await service.record([
    { level: 'blad', message: 'products.json niedostępny: Failed to fetch', source: 'przeglądarka', kind: 'browser', route: '/' },
    { level: 'blad', message: 'Kontakt/FAQ/Dostawa nie mogą zostać wyrenderowane', source: 'pełny autotest', kind: 'browser', route: '/admin/system' },
    { level: 'blad', message: 'Błąd renderowania strony: Invalid qualified name: 1000845', source: '/admin/von-halsky/wystawianie', kind: 'browser', route: '/#/admin/von-halsky/wystawianie' },
    { level: 'blad', message: 'Nie udało się zapisać zamówienia', source: 'przeglądarka', kind: 'browser', route: '/zamowienie' },
  ], { trusted: true });
  const request = new Request('https://artwaytm.pl/api/store?action=diagnostics-checks-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin': '1' },
    body: JSON.stringify({
      checks: [],
      passedChecks: [
        { name: 'Dostęp do products.json', group: 'Autotest techniczny', details: '1114 rekordów' },
        { name: 'Renderowanie głównych widoków', group: 'Autotest techniczny', details: 'Sprawdzono 6 kluczowych ekranów' },
      ],
    }),
  });
  const response = await service.route(request, new URL(request.url), 'diagnostics-checks-sync');
  const body = await json(response);
  assert.equal(response.status, 202);
  assert.equal(body.passed, 2);
  assert.equal(body.summary.open, 1);
  assert.equal(record().items.find((item) => /products\.json/.test(item.message)).status, 'resolved');
  assert.equal(record().items.find((item) => /Kontakt/.test(item.message)).status, 'resolved');
  assert.equal(record().items.find((item) => /Invalid qualified name/.test(item.message)).status, 'resolved');
  assert.equal(record().items.find((item) => /zamówienia/.test(item.message)).status, 'open');
});

test('frontend wysyła błędy do VPS i autotest zapisuje nazwę nieudanej kontroli', async () => {
  const runtime = await import('node:fs/promises').then((fs) => fs.readFile('src/frontend/02-runtime-state.js', 'utf8'));
  const diagnostics = await import('node:fs/promises').then((fs) => fs.readFile('src/frontend/16-diagnostics.js', 'utf8'));
  const [backend, operationalCenter] = await Promise.all([
    import('node:fs/promises').then((fs) => fs.readFile('src/backend/lib/store-app.mjs', 'utf8')),
    import('node:fs/promises').then((fs) => fs.readFile('src/backend/lib/domain/agent-operational-center.mjs', 'utf8')),
  ]);
  assert.match(runtime, /diagnostics-ingest/);
  assert.match(runtime, /DIAGNOSTYKA_KOLEJKA_KEY/);
  assert.match(diagnostics, /Centralny rejestr błędów/);
  assert.match(diagnostics, /diagnostics-checks-sync/);
  assert.match(diagnostics, /passedChecks/);
  assert.match(diagnostics, /systemDokumentTymczasowyHTML/);
  assert.match(diagnostics, /systemOdswiezDiagnostyke.*diagnostykaSynchronizujProblemy/s);
  assert.match(diagnostics, /fetchedAt/);
  assert.match(diagnostics, /SYSTEM_CENTRAL_DIAG_CACHE_KEY/);
  assert.match(diagnostics, /If-None-Match/);
  assert.match(diagnostics, /data\.source!=="postgresql"/);
  assert.doesNotMatch(diagnostics, /systemPobierzCentralneBledy\(true\)\.then\(renderuj\)/);
  assert.match(diagnostics, /item\.nazwa.*item\.szczegoly/s);
  assert.match(backend, /backend:\$\{action\}/);
  assert.match(operationalCenter, /Centralna diagnostyka wykryła błędy działania strony/);
});
