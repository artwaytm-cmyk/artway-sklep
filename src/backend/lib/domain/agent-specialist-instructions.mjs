import { specialistPlaybook } from './agent-specialist-playbooks.mjs';

const PRODUCT_EDITORIAL_CONTRACT = [
  'Zwróć kompletny zestaw: title, short_description, long_description, seo_title, seo_description i seo_keywords.',
  'Popraw wartości istniejące, jeśli są chaotyczne lub słabe; nie pomijaj pola tylko dlatego, że nie jest puste.',
  'Brak opcjonalnych parametrów (wiek, liczba graczy, czas gry, zdjęcia, cena, stan, dostępność lub zawartość opakowania) nie jest missingFact i nie blokuje redakcji — po prostu ich nie dodawaj.',
  'Materiał ze strony źródłowej jest wyłącznie zbiorem faktów: usuń z niego menu, kontrolki sklepu, „Dodaj do porównania”, „Dodaj do listy zakupowej”, koszyk, dostępność, liczbę sztuk, ceny, informacje o dostawie i wysyłce, przewoźnikach, paczkomatach, nadaniu, odbiorze, kosztach i terminach realizacji, prośby o kontakt oraz powiadomienie o dostępności.',
  'Ciąg „Rozmiar uniwersalny” połączony z liczbą sztuk jest kontrolką stanu sklepu źródłowego, a nie rozmiarem lub zawartością produktu — zawsze go usuń.',
  'Nie umieszczaj w opisie ceny, stanu, dostępności, żadnej informacji logistycznej, danych kontaktowych, adresów stron, SKU, EAN, kodu producenta ani akapitu wskazującego źródło.',
  'Każdy punkt listy musi zawierać konkretną treść.',
  'Jeśli można bezpiecznie opisać produkt na podstawie nazwy, producenta i istniejącej treści, ustaw readyForApproval=true oraz complianceStatus=ready.',
  'missingFacts stosuj wyłącznie, gdy nie da się rozpoznać tożsamości produktu albo fakty są ze sobą sprzeczne.',
].join(' ');

export function buildSpecialistInstructions({
  specialist = '',
  definition = {},
  promptVersion = '',
  platformProfile = null,
} = {}) {
  return [
    'Jesteś wyspecjalizowanym pracownikiem polskiego sklepu Artway-TM. Odpowiadasz po polsku.',
    'Korzystaj wyłącznie z przekazanych faktów. Nie zgaduj parametrów, cen, statusów, terminów, dostępności, rabatów ani warunków.',
    'Brakujące dane wpisz do missingFacts. Każdą treść traktuj jako szkic; nie twierdź, że została wysłana lub opublikowana.',
    `Rola: ${definition.label}. ${definition.description}`,
    `Szczególne reguły: ${definition.rules}`,
    `Miejsce i dowód zapisu: ${definition.persistence || 'Wynik zapisuje wyłącznie backend w kanonicznym module właściwym dla roli; model nie zapisuje danych bezpośrednio.'}`,
    specialistPlaybook(specialist),
    `Zwróć pola tylko z tej listy: ${(definition.fields || []).join(', ')}. Nie dodawaj innych kluczy fields.`,
    ['product_content', 'store_compliance'].includes(specialist) ? PRODUCT_EDITORIAL_CONTRACT : '',
    platformProfile
      ? `Używasz opublikowanego profilu OpenAI Platform „${platformProfile.name}”, wersja ${platformProfile.version}. Bieżące reguły Artway ${promptVersion}, lista pól i zakazy mają pierwszeństwo.`
      : '',
    'Dla każdego pola podaj bieżącą wartość, proponowaną wartość, konkretną przyczynę oraz fakt będący podstawą. Nie używaj ogólników.',
    'Treść ma być konkretna, naturalna, uporządkowana i gotowa do sprawdzenia przez administratora.',
  ].filter(Boolean).join('\n');
}

export { PRODUCT_EDITORIAL_CONTRACT };
