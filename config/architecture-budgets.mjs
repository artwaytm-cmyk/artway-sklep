export const KIB = 1024;

// Budżety mają dwa poziomy:
// - target: cel rozwojowy raportowany jako ostrzeżenie,
// - max: twarda bramka CI, której nie wolno przekroczyć bez podziału domeny.
// Limity dotyczą kosztu i odpowiedzialności modułu, a nie liczby produktów.
export const ARCHITECTURE_BUDGETS = Object.freeze({
  source: Object.freeze({
    javascript: Object.freeze({ targetLines: 600, maxLines: 1500, targetBytes: 80 * KIB, maxBytes: 180 * KIB }),
    stylesheet: Object.freeze({ targetLines: 650, maxLines: 1600, targetBytes: 80 * KIB, maxBytes: 240 * KIB }),
    focusedFrontend: Object.freeze({ targetLines: 500, maxLines: 700 }),
    integrationService: Object.freeze({ targetLines: 500, maxLines: 800 }),
  }),
  backendCoordinator: Object.freeze({
    targetLines: 3800,
    maxLines: 4500,
    targetBytes: 280 * KIB,
    maxBytes: 340 * KIB,
  }),
  browser: Object.freeze({
    storefrontScript: Object.freeze({ targetGzipBytes: 125 * KIB, maxGzipBytes: 160 * KIB, maxRawBytes: 540 * KIB }),
    storefrontStyles: Object.freeze({ targetGzipBytes: 20 * KIB, maxGzipBytes: 25 * KIB, maxRawBytes: 80 * KIB }),
    adminCore: Object.freeze({ targetGzipBytes: 8 * KIB, maxGzipBytes: 10 * KIB, maxRawBytes: 24 * KIB }),
    adminSharedUi: Object.freeze({ targetGzipBytes: 8 * KIB, maxGzipBytes: 10 * KIB, maxRawBytes: 24 * KIB }),
    adminRoute: Object.freeze({ targetGzipBytes: 100 * KIB, maxGzipBytes: 120 * KIB, maxRawBytes: 450 * KIB }),
    adminStyles: Object.freeze({ targetGzipBytes: 80 * KIB, maxGzipBytes: 100 * KIB, maxRawBytes: 600 * KIB }),
  }),
});

export function physicalLineCount(content = '') {
  const normalized = String(content).replace(/\r\n/g, '\n');
  if (!normalized) return 0;
  return normalized.split('\n').length - (normalized.endsWith('\n') ? 1 : 0);
}

export function budgetState(value, target, max) {
  if (value > max) return 'FAIL';
  if (value > target) return 'WARN';
  return 'OK';
}
