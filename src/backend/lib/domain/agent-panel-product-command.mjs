const clean = (value = '') => String(value ?? '').trim().toLowerCase();

export function parseAgentProductBacklogCommand(value = '', {
  defaultBatchSize = 40,
  maxBatchSize = 1000,
} = {}) {
  const text = clean(value);
  const productIntent = /\b(?:produkt|produkty|produktow|produktów|kartotek|kartoteki|opis|opisy|katalog|katalogu|katalogiem)\b/i.test(text);
  const workIntent = /\b(?:popraw|poprawa|poprawic|poprawić|uzupelnij|uzupełnij|przygotuj|sprawdz|sprawdź|kontynuuj|wznow|wznów)\b/i.test(text);
  if (!productIntent || !workIntent) return null;
  const explicit = text.match(/\b(\d{1,4})\s*(?:produkt|produktow|produktów|kartotek|opis)/i);
  const requested = explicit ? Number(explicit[1]) : Number(defaultBatchSize);
  return {
    batchSize: Math.max(1, Math.min(Math.max(1, Number(maxBatchSize) || 1000), Number(requested) || 40)),
    explicitCount: Boolean(explicit),
  };
}
