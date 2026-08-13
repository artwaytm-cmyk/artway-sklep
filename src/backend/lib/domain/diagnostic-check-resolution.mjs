const PASSED_CHECK_PATTERNS = Object.freeze({
  'Dostęp do products.json': /\bproducts\.json\b/i,
  'Źródło produktów': /(?:katalog postgresql|pierwszej strony katalogu|pełny snapshot nie został pobrany)/i,
  'Moduły sklepu ładowane na żądanie': /(?:anonimowej analityki seo|podstrony sklepu:\s*(?:analytics|account))/i,
  'Renderowanie głównych widoków': /(?:renderowanie głównych widoków|kontakt.{0,80}faq.{0,80}dostawa|blokPrzydatneLinkiHTML|widok(?:Kontakt|FAQ|Dostawa|AdminVonHalsky)|filtrZamowien|invalid qualified name|\/admin\/(?:zamowienia|von-halsky))/i,
  'Dostępność zdjęć produktów': /(?:nie wczytano zdjęcia produktu|image_not_found|zdjęci[ea].{0,40}(?:nie działa|niedostępn|błąd))/i,
  'Backend i uniwersalne API': /(?:brak połączenia z serwerem|serwer nie odpowiedział w wyznaczonym czasie|odświeżą się po odzyskaniu połączenia|nie potwierdzono sesji|nie udało się zsynchronizować wyników autotestu|timeout exceeded when trying to connect|connection terminated due to connection timeout|55P03: anulowano polecenie|57014: anulowano polecenie|przekroczenia czasu blokady|client has encountered a connection error and is not queryable)/i,
  'Centralna baza zamówień': /(?:backend:(?:agent-runtime-status|allegro-preparation-queue-status|von-halsky-publication-queue-claim|codex-agent-claim|paynow-config)|katalog postgresql chwilowo niedostępny|magazyn:.{0,80}brak połączenia)/i,
  'InPost ShipX API': /(?:backend:inpost-label|labelready|shipx|enotfound.{0,80}inpost)/i,
  'Spójność mapowania': /artway_(?:stany|magazyn_produkty|ruchy_magazynowe).{0,120}(?:równoległą zmianę|zapis pozostaje w kolejce)/i,
  'Atomowe wydanie strony': /(?:błąd renderowania strony|is not defined|before initialization|unexpected token)/i,
});

export function matchedPassedDiagnosticCheck(item = {}, passedChecks = [], checkedAt = '') {
  if (!['open', 'investigating'].includes(item.status) || item.kind === 'autotest' || String(item.source || '').startsWith('autotest:')) return '';
  const seenAt = Date.parse(item.lastSeenAt || ''), validationAt = Date.parse(checkedAt || '');
  if (Number.isFinite(seenAt) && Number.isFinite(validationAt) && seenAt > validationAt) return '';
  const text = `${item.message || ''} ${item.source || ''} ${item.route || ''}`;
  return passedChecks.find((check) => PASSED_CHECK_PATTERNS[check.name]?.test(text))?.name || '';
}
