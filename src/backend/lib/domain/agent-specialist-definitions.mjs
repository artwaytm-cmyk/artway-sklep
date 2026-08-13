import { SPECIALIST_PLAYBOOK_VERSION } from './agent-specialist-playbooks.mjs';

const VERSION = SPECIALIST_PLAYBOOK_VERSION;
const scenario = (id) => ({ id, version: VERSION });

export const SPECIALISTS = Object.freeze({
  product_content: {
    assistantId: 'asst_bi27lcqG4p4pGx5TouNEE94J', platformPrompt: { id: 'pmpt_6a5f6d279d208197b70e3f1edd41f01b040dd5083490e108', version: '1' },
    icon: '🏪', label: 'Redaktor sklepu', area: 'Katalog i sklep',
    description: 'Redaguje niezależną treść własnego sklepu i SEO. Nie nadpisuje treści Allegro ani Von Halsky.',
    fields: ['title', 'short_description', 'long_description', 'seo_title', 'seo_description', 'seo_keywords'], scenario: scenario('catalog-editorial'),
    persistence: 'Po walidacji backend zapisuje pola do kanonicznego rekordu artway_products przez saveProductFields; potwierdzeniem są productId, mutationId, fingerprint i ponowny odczyt.',
    rules: 'Nazwa 12–150 znaków. Opis formatuj czytelnie. Zachowaj potwierdzone fakty; bez logistyki, kontaktu, linków, kodów i danych źródłowego sklepu.',
  },
  store_compliance: {
    assistantId: '', icon: '🛡️', label: 'Strażnik treści sklepu', area: 'Sklep • kontrola końcowa',
    description: 'Naprawia wyłącznie treść sklepu odrzuconą przez jego niezależną kontrolę.',
    fields: ['title', 'short_description', 'long_description', 'seo_title', 'seo_description', 'seo_keywords'], scenario: scenario('store-compliance-review'),
    persistence: 'Po ponownej bramce zgodności backend aktualizuje ten sam rekord artway_products; nie powstaje drugi katalog ani kopia localStorage.',
    rules: 'Kontroluj fakty, czytelność, śmieci źródłowe i obietnice. Nie oceniaj ani nie zmieniaj pozostałych kanałów.',
  },
  allegro_offer: {
    assistantId: 'asst_16UEvdbo3boUso6xyYeANYnQ', platformPrompt: { id: 'pmpt_6a5f6e26d4048193adcd38bbaeca551d0d528a4339f081b7', version: '1' },
    icon: '🟠', label: 'Redaktor oferty Allegro', area: 'Allegro',
    description: 'Tworzy niezależny tytuł i opis Allegro z faktów kartoteki sklepu.',
    fields: ['allegro_title', 'allegro_description', 'selling_points', 'missing_parameters'], scenario: scenario('allegro-offer-editorial'),
    persistence: 'Po bramce zgodności backend zapisuje pola allegro_* i stan kanału w tym samym rekordzie artway_products; publikacja jest osobną operacją API.',
    rules: 'Tytuł 12–75 znaków i minimum 3 słowa. Bez kontaktu, linku, sprzedaży poza Allegro, płatności, dostawy i logistyki.',
  },
  allegro_compliance: {
    assistantId: 'asst_16UEvdbo3boUso6xyYeANYnQ', platformPrompt: { id: 'pmpt_6a5f6e26d4048193adcd38bbaeca551d0d528a4339f081b7', version: '1' },
    icon: '⚖️', label: 'Strażnik zgodności Allegro', area: 'Allegro • kontrola końcowa',
    description: 'Naprawia wyłącznie treść Allegro odrzuconą przez deterministyczną bramkę.',
    fields: ['allegro_title', 'allegro_description'], scenario: scenario('allegro-compliance-review'),
    persistence: 'Wynik wraca do bramki Allegro, a dopiero jej wynik może zaktualizować pola allegro_* w artway_products.',
    rules: 'Usuń całe zakazane zdania, w tym kontakt, płatność, dostawę i logistykę. Zachowaj fakty i bezpieczny HTML. Nie zmieniaj sklepu ani Von Halsky.',
  },
  allegro_publication: {
    assistantId: '', icon: '🚀', label: 'Operator publikacji Allegro', area: 'Allegro • wystawianie i naprawa API',
    description: 'Analizuje zapisany raport API konkretnego produktu, klasyfikuje przyczynę i wskazuje wyłącznie bezpieczne korekty do ponowienia.',
    fields: ['error_class', 'root_cause', 'safe_corrections', 'retry_plan', 'requires_admin_decision'], scenario: scenario('allegro-publication-repair'),
    persistence: 'Diagnoza zostaje przy zadaniu publikacji konkretnego productId; korekta produktu przechodzi przez saveProductFields, a sukces oferty wymaga offerId i odczytu Allegro API.',
    rules: 'EAN/GTIN, kategoria i parametry pochodzą wyłącznie z kartoteki oraz odpowiedzi API. Producent, marka i wydawca są osobnymi faktami (np. producent Alexander, marka MilliWOOD). Nie zgaduj UUID katalogu, kategorii ani wartości. Uwzględniaj aktualny typ, słownik, zależności, ograniczenia i wartość niejednoznaczną każdego parametru. Jeśli słownik kanału nie zawiera marki, wolno wskazać potwierdzonego właściciela marki wyłącznie jako fallback parametru Allegro, bez nadpisywania marki sklepu. Zdjęcie musi pochodzić z właściwej strony źródłowej, mieć dłuższy bok 500–2560 px albo nadawać się do bezpiecznego dopasowania z minimum 300 px, a przed ofertą musi zostać zapisane przez /sale/images. Nie ustawiaj rynków na siłę, nie wysyłaj additionalMarketplaces ani zagranicznych cen, nie zmieniaj cenników i używaj domyślnego cennika artway2. Publikacja pozostaje chroniona istniejącym zatwierdzeniem administratora. Sukces istnieje dopiero po odczycie offerId, statusu, rynku i zapisanych danych z API.',
  },
  von_halsky_offer: {
    assistantId: '', icon: '🐕', label: 'Redaktor Von Halsky', area: 'InPost Von Halsky',
    description: 'Osobny Agent SDK tworzy i kontroluje kartę Von Halsky według dokumentacji InPost, faktów kanonicznych, typowanego wyniku i dwóch deterministycznych narzędzi.',
    fields: ['von_halsky_title', 'von_halsky_short_description', 'von_halsky_description'], scenario: scenario('von-halsky-offer-editorial'),
    persistence: 'Po bramce kanału backend zapisuje pola von_halsky_* w tym samym rekordzie artway_products; wysłanie do kanału jest osobną operacją.',
    runtime: 'openai-agents-sdk',
    tools: ['check_von_halsky_identity', 'check_von_halsky_draft'],
    documentation: ['https://inpost.pl/aktualnosci-inpost-von-halsky-jak-stworzyc-dobra-oferte', 'https://inpost.pl/aktualnosci-inpost-von-halsky-integracja'],
    rules: 'Nazwa 7–150 znaków z najważniejszymi faktami na początku, opis minimum 100 znaków. Tożsamość wymaga EAN albo kodu producenta i marki. Bez linków, obrazów w opisie, kontaktu, płatności, logistyki i haseł promocyjnych. Wartości undefined/null i JSON są odrzucane. Zdjęcia powinny mieć białe tło, nie mieć znaku wodnego i osiągać minimum 800×800 px. Parametry kategorii wolno mapować tylko z faktów oraz słownika API.',
  },
  von_halsky_compliance: {
    assistantId: '', icon: '🐕', label: 'Strażnik treści Von Halsky', area: 'InPost Von Halsky • kontrola końcowa',
    description: 'Ten sam osobny Agent SDK naprawia wyłącznie treść Von Halsky odrzuconą przez deterministyczną bramkę i ponownie wykonuje kontrolę narzędziem.',
    fields: ['von_halsky_title', 'von_halsky_short_description', 'von_halsky_description'], scenario: scenario('von-halsky-compliance-review'),
    persistence: 'Wynik wraca do bramki Von Halsky, a zapis dotyczy tylko pól von_halsky_* kanonicznego produktu.',
    runtime: 'openai-agents-sdk',
    tools: ['check_von_halsky_identity', 'check_von_halsky_draft'],
    documentation: ['https://inpost.pl/aktualnosci-inpost-von-halsky-jak-stworzyc-dobra-oferte', 'https://inpost.pl/aktualnosci-inpost-von-halsky-integracja'],
    rules: 'Usuń linki, obrazy, kontakt, płatności, logistykę, promocje, wartości techniczne i niedozwolony HTML. Kontakt należy do ustawień sklepu w Portalu Merchanta.',
  },
  customer_reply: {
    assistantId: 'asst_M2ZRdoHVzQ0jIzYZ3TCLwcoI', platformPrompt: { id: 'pmpt_6a5f6e75890c81959ec99530abd0907c075f4f164e71b421', version: '1' },
    icon: '💬', label: 'Opiekun klienta', area: 'Wiadomości i dyskusje', description: 'Układa szkic odpowiedzi na podstawie całej rozmowy i potwierdzonych danych.',
    fields: ['subject', 'reply'], scenario: scenario('customer-reply-draft'), rules: 'Nie obiecuj niepotwierdzonego zwrotu, wysyłki, terminu ani statusu. Zawsze szkic do zatwierdzenia.',
    persistence: 'Szkic zapisuje się przy identyfikatorze rozmowy/dyskusji. Agent nigdy nie wysyła wiadomości bez dedykowanej operacji operatora.',
  },
  seo_promotion: {
    assistantId: 'asst_LM0aFCDpHHXGgWI28ZdLHjJw', platformPrompt: { id: 'pmpt_6a5f6e84122c81909f9ee773bebf35ea0a46ed1276dedcea', version: '1' },
    icon: '🔎', label: 'Specjalista SEO', area: 'Pozycjonowanie', description: 'Przygotowuje naturalne frazy, meta dane i bezpłatny plan promocji.',
    fields: ['seo_title', 'meta_description', 'keywords', 'slug', 'internal_link_anchor', 'promotion_plan'], scenario: scenario('seo-free-promotion'), rules: 'Bez upychania fraz, fikcyjnych przewag i gwarancji pozycji.',
    persistence: 'Pola produktu przechodzą przez saveProductFields do artway_products; plan promocji pozostaje w kolejce SEO i nie oznacza wykonania zewnętrznej publikacji.',
  },
  campaign_copy: {
    assistantId: 'asst_yr8O2brC4yJ9KFmDFpmWQNPB', platformPrompt: { id: 'pmpt_6a5f6da900b48190b6e0833bd6d2582709f2081088e2ce3d', version: '2' },
    icon: '📣', label: 'Strateg promocji', area: 'Promocje i kody rabatowe', description: 'Buduje zestaw tekstów kampanii z potwierdzonych warunków.',
    fields: ['campaign_name', 'headline', 'subheadline', 'cta', 'store_announcement', 'social_post', 'promotion_plan'], rules: 'Kod, rabat, daty i warunki muszą pochodzić z faktów.',
    persistence: 'Wynik jest wersjonowanym szkicem kampanii powiązanym z istniejącym kodem rabatowym; aktywacja kampanii wymaga osobnej operacji.',
  },
  banner_copy: {
    assistantId: 'asst_4dPRadSuHeusSVkuzvFe9TKg', platformPrompt: { id: 'pmpt_6a5f6e92eed48196b1689d1a1e2d39f60555a437e19e5b3a', version: '1' },
    icon: '🎨', label: 'Dyrektor bannera', area: 'Grafiki AI', description: 'Tworzy brief obrazu i osobne teksty nakładane przez sklep.',
    fields: ['headline', 'subheadline', 'cta', 'image_brief', 'mobile_crop_guidance', 'alt_text'], rules: 'Model obrazu nie generuje liter. Bez chronionych postaci i niepotwierdzonych produktów.',
    persistence: 'Brief i teksty zapisują się w projekcie grafiki; wygenerowany plik obrazu oraz jego warianty mają osobne identyfikatory zasobów.',
  },
  supplier_message: {
    assistantId: 'asst_63UuzQm4UNsjileYU7Wue7pd', platformPrompt: { id: 'pmpt_6a5f6eccb4348193bc09427beb9d849b0d483c3686838266', version: '1' },
    icon: '🏭', label: 'Koordynator producenta', area: 'Plan zatowarowania', description: 'Redaguje e-mail wokół kanonicznej tabeli zamówienia.',
    fields: ['subject', 'intro', 'closing', 'import_instruction'], scenario: scenario('supplier-order-draft'), rules: 'Bez cen, marż i stanów. Nie zmieniaj kodów, nazw ani ilości.',
    persistence: 'Szkic jest przypisany do jednego kanonicznego dokumentu Planu zatowarowania; tabela pochodzi z dokumentu, a wysłanie e-maila wymaga osobnego potwierdzenia.',
  },
  catalog_quality: {
    assistantId: 'asst_0iw94LI9kTcnLpiOUzr8VnPj', platformPrompt: { id: 'pmpt_6a5f6edf45508193ad0be5b8e3313dd307ca7bb991527083', version: '1' },
    icon: '🛡️', label: 'Kontroler jakości', area: 'Audyt treści', description: 'Wykrywa sprzeczności, braki i duplikaty bez automatycznego usuwania.',
    fields: ['assessment', 'recommended_changes', 'compliance_notes'], scenario: scenario('catalog-identity-control'), rules: 'Oddziel pewne błędy od podejrzeń. Nie oznaczaj duplikatu bez mocnych identyfikatorów.',
    persistence: 'Ocena zapisuje się przy konkretnych productId jako wynik kontroli; nie usuwa, nie scala i nie nadpisuje produktu samodzielnie.',
  },
  operations_supervisor: {
    assistantId: 'asst_fgnFEmmPmCSsqEiO9uIgO3Kh', platformPrompt: { id: 'pmpt_6a5f6ef1e3ec8193911f0926497d78850dbce1efdf710076', version: '1' },
    icon: '🧭', label: 'Koordynator operacyjny', area: 'Nadzór sklepu', description: 'Porządkuje ryzyka i przekazuje jasne decyzje administratora.',
    fields: ['priority', 'problem', 'recommended_action', 'alternative_action', 'decision_question'], rules: 'Bez działań zewnętrznych. Jedna rekomendacja, alternatywa i jasna bramka zatwierdzenia.',
    persistence: 'Wynik trafia do wersjonowanej kolejki decyzji Agenta. Rozstrzygnięcie ma receipt i nie wraca bez nowych faktów lub jawnego ponownego otwarcia.',
  },
});
