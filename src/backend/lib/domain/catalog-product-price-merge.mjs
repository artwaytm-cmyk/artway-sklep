const PRICE_CHANNELS = [
  { field: 'cena', updatedAt: 'cenaZaktualizowanoAt', manual: 'cenaManualna', source: 'cenaZrodlo' },
  { field: 'cenaAllegro', updatedAt: 'cenaAllegroZaktualizowanoAt', manual: 'cenaAllegroManualna', source: 'cenaAllegroZrodlo' },
  { field: 'cenaVonHalsky', updatedAt: 'cenaVonHalskyZaktualizowanoAt', manual: 'cenaVonHalskyManualna', source: 'cenaVonHalskyZrodlo' },
  { field: 'cenaZakupu', updatedAt: 'cenaZakupuZaktualizowanoAt', manual: 'cenaZakupuPrywatna', source: 'cenaZakupuZrodlo' },
];

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const time = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function preserveNewerManualPrices(serverRecord = {}, incomingRecord = {}) {
  const next = { ...incomingRecord };
  for (const channel of PRICE_CHANNELS) {
    const serverTime = time(serverRecord[channel.updatedAt]);
    const incomingTime = time(incomingRecord[channel.updatedAt]);
    if (!serverTime || incomingTime >= serverTime) continue;
    for (const key of [channel.field, channel.updatedAt, channel.manual, channel.source]) {
      if (own(serverRecord, key)) next[key] = serverRecord[key];
      else delete next[key];
    }
  }
  return next;
}

export function preserveNewerConfirmedMutation(serverRecord = {}, incomingRecord = {}) {
  const serverTime = time(serverRecord.lastAdminMutationAt);
  const incomingTime = time(incomingRecord.lastAdminMutationAt);
  if (!serverTime || incomingTime >= serverTime) return incomingRecord;
  const next = { ...incomingRecord }, protectedFields = Array.isArray(serverRecord.lastAdminMutationFields) ? serverRecord.lastAdminMutationFields : [];
  for (const key of [...protectedFields, 'lastAdminMutationId', 'lastAdminMutationAt', 'lastAdminMutationBy', 'lastAdminMutationArea', 'lastAdminMutationFields']) {
    if (own(serverRecord, key)) next[key] = serverRecord[key];
    else delete next[key];
  }
  return next;
}

function protectEditMap(serverMap, incomingMap) {
  if (!incomingMap || typeof incomingMap !== 'object' || Array.isArray(incomingMap)) return incomingMap;
  const next = { ...incomingMap };
  for (const [id, serverRecord] of Object.entries(serverMap && typeof serverMap === 'object' ? serverMap : {})) {
    if (!serverRecord || typeof serverRecord !== 'object' || Array.isArray(serverRecord)) continue;
    const incomingRecord = next[id];
    if (incomingRecord && typeof incomingRecord === 'object' && !Array.isArray(incomingRecord)) {
      next[id] = preserveNewerManualPrices(serverRecord, preserveNewerConfirmedMutation(serverRecord, incomingRecord));
    } else if (PRICE_CHANNELS.some((channel) => time(serverRecord[channel.updatedAt]) > 0) || time(serverRecord.lastAdminMutationAt) > 0) {
      next[id] = preserveNewerManualPrices(serverRecord, preserveNewerConfirmedMutation(serverRecord, {}));
    }
  }
  return next;
}

function protectProductArray(serverList, incomingList) {
  if (!Array.isArray(incomingList)) return incomingList;
  const serverById = new Map((Array.isArray(serverList) ? serverList : []).map((item) => [String(item?.id ?? ''), item]));
  return incomingList.map((item) => {
    const serverRecord = serverById.get(String(item?.id ?? ''));
    return serverRecord && item && typeof item === 'object'
      ? preserveNewerManualPrices(serverRecord, preserveNewerConfirmedMutation(serverRecord, item))
      : item;
  });
}

export function preserveManualProductPrices(nextData = {}, previousData = {}) {
  const next = { ...nextData };
  if (own(next, 'artway_produkty_edytowane')) next.artway_produkty_edytowane = protectEditMap(previousData.artway_produkty_edytowane, next.artway_produkty_edytowane);
  for (const key of ['artway_produkty_dodane', 'artway_produkty_katalog']) {
    if (own(next, key)) next[key] = protectProductArray(previousData[key], next[key]);
  }
  return next;
}
