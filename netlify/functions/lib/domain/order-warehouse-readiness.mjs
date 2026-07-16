const list = (value) => (Array.isArray(value) ? value : []);
const count = (value) => Math.max(0, Number(value) || 0);
const text = (value = '') => String(value ?? '').trim();

/**
 * Klasyfikuje wyłącznie decyzję realizacyjną. Lokalizacja jest informacją
 * magazynową i nigdy nie zamienia dostępnego towaru w brak zakupowy.
 */
export function classifyWarehousePosition({ matched = true, stockKnown = true, shortage = 0, location = '' } = {}) {
  if (!matched) return { decision: 'nierozpoznany', fulfillmentReady: false, locationMissing: false };
  if (!stockKnown) return { decision: 'sprawdz_stan', fulfillmentReady: false, locationMissing: false };
  if (count(shortage) > 0) return { decision: 'zamow_u_producenta', fulfillmentReady: false, locationMissing: false };
  return { decision: 'kompletuj', fulfillmentReady: true, locationMissing: !text(location) };
}

export function warehouseAnalysisNeedsInvestigation(analysis = {}) {
  return count(analysis.nierozpoznane) > 0 || count(analysis.bezStanu) > 0;
}

/** Zachowuje licznik lokalizacji, ale nie używa go jako blokady kompletacji. */
export function summarizeWarehousePositions(positions = []) {
  const rows = list(positions);
  const nierozpoznane = rows.filter((position) => position?.decision === 'nierozpoznany').length;
  const bezStanu = rows.filter((position) => position?.decision === 'sprawdz_stan').length;
  const bezLokalizacji = rows.filter((position) => position?.locationMissing === true
    || (position?.decision === 'uzupelnij_lokalizacje' && count(position?.shortage) === 0)
    || (position?.decision === 'kompletuj' && !text(position?.location))).length;
  const braki = rows.reduce((sum, position) => sum + count(position?.shortage), 0);
  const fulfillmentReady = !nierozpoznane && !bezStanu && !braki;
  return {
    nierozpoznane,
    bezStanu,
    bezLokalizacji,
    braki,
    fulfillmentReady,
    gotowe: fulfillmentReady,
    locationTasks: bezLokalizacji,
  };
}
