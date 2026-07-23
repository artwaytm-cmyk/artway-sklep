const ALLOWED_DECISIONS = new Set(['auto', 'grace', 'wait_available', 'hide_manual', 'manual_available']);

const text = (value, max = 500) => String(value ?? '').slice(0, max).trim();
const list = (value) => Array.isArray(value) ? value : [];

function validation(message) {
  const error = new Error(message);
  error.status = 422;
  error.code = 'validation';
  return error;
}

export function applyProductSaleDecisionBatch({ body = {}, data = {}, now = new Date(), operator = 'administrator' } = {}) {
  const requested = Array.isArray(body.items) ? body.items : [body];
  if (!requested.length || requested.length > 500) throw validation('Wybierz od 1 do 500 produktów.');
  const unique = new Map();
  for (const raw of requested) {
    const productId = text(raw?.productId, 100), decision = text(raw?.decision || 'auto', 40).toLowerCase();
    if (!productId || !ALLOWED_DECISIONS.has(decision)) throw validation('Nieprawidłowa decyzja dostępności.');
    unique.set(productId, { ...raw, productId, decision });
  }
  const target = data && typeof data === 'object' ? { ...data } : {};
  const availability = target.artway_dostepnosc && typeof target.artway_dostepnosc === 'object' ? { ...target.artway_dostepnosc } : {};
  const nowIso = now.toISOString(), results = [], checks = [], audit = [];
  for (const item of unique.values()) {
    const { productId, decision } = item, previous = availability[productId] && typeof availability[productId] === 'object' ? availability[productId] : {};
    const days = Math.max(1, Math.min(30, Number(item.days) || 1)), producerStatus = text(item.producerStatus, 40).toLowerCase(), producerUnavailable = producerStatus === 'brak';
    const history = [{ at: nowIso, decision, days: decision === 'grace' ? days : 0, operator }, ...list(previous.history)].slice(0, 20);
    const base = { data: nowIso, operator, source: 'supplier-decision', automatic: false, producerStatus, history };
    if (decision === 'grace') availability[productId] = { ...base, status: 'dostepny', decision, expiresAt: new Date(now.getTime() + days * 86400000).toISOString(), autoRestore: true, powod: `Decyzja administratora: pozostaw sprzedaż przez ${days} dni` };
    else if (decision === 'wait_available') availability[productId] = { ...base, status: 'niedostepny', decision, autoRestore: true, powod: 'Ukryty do ponownej dostępności u producenta' };
    else if (decision === 'hide_manual') availability[productId] = { ...base, status: 'niedostepny', decision, autoRestore: false, powod: 'Ręcznie ukryty bez automatycznego wznowienia' };
    else if (decision === 'manual_available') availability[productId] = { ...base, status: 'dostepny', decision, autoRestore: false, powod: 'Ręcznie pozostawiony w sprzedaży mimo sygnału producenta' };
    else if (producerUnavailable) availability[productId] = { ...base, status: 'niedostepny', decision: 'auto', source: 'producent-agent', automatic: true, autoRestore: true, powod: 'Automatycznie: produkt niedostępny u producenta' };
    else delete availability[productId];
    const available = decision === 'grace' || decision === 'manual_available' || (decision === 'auto' && !producerUnavailable);
    const expiresAt = availability[productId]?.expiresAt || null;
    results.push({ productId, decision, days, available, expiresAt, producerStatus });
    checks.push({ ok: true, productId, status: available ? 'dostepny' : 'brak', available, quantity: available ? Math.max(1, Number(item.producerQuantity) || 1) : 0, checkedAt: nowIso, preserveDecision: true });
    audit.push({ typ: 'decyzja-producenta', opis: `Decyzja sprzedażowa produktu ${productId}: ${decision}${decision === 'grace' ? ` (${days} dni)` : ''}`, operator, dane: { productId, decision, days, producerStatus } });
  }
  target.artway_dostepnosc = availability;
  return { data: target, availability, results, checks, audit, nowIso };
}
