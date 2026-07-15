// Bezpośrednia korekta stanu została celowo wyłączona. Każda zmiana — także
// ręczna — przechodzi przez trwały szkic, lokalizację i osobne potwierdzenie.
// Dzięki temu żaden klient posiadający ogólny token administracyjny nie może
// ominąć rejestru decyzji przez zmianę pola `source`.
export function createInventoryStockRoute({ isAdmin, rateLimit, respond } = {}) {
  return async function inventoryStockRoute(req, url, action) {
    if (action !== 'inventory-stock-set') return null;
    if (req.method !== 'POST') return respond({ ok: false, error: 'Metoda niedozwolona' }, 405);
    if (!isAdmin(req, url)) return respond({ ok: false, error: 'Brak uprawnień administratora', code: 'auth' }, 401);
    const limited = rateLimit(req, 'inventory-stock-set', 30, 60 * 60 * 1000);
    if (limited) return limited;
    return respond({
      ok: false,
      error: 'Bezpośrednia zmiana stanu jest wyłączona. Utwórz decyzję, wskaż lokalizację i potwierdź ją osobno.',
      code: 'inventory_decision_required',
    }, 409);
  };
}
