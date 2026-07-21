/**
 * Jedna polityka uprawnień Agenta dla panelu, cyklu automatycznego i testów.
 * Pozycje approvalRequired celowo nie mają configKey — administrator może
 * nadawać wyłącznie bezpieczne uprawnienia z sekcji automatic.
 */
export const AGENT_ACTION_POLICY = Object.freeze({
  automatic: Object.freeze([
    Object.freeze({ id: 'product_editorial', icon: '✨', label: 'Redakcja kart produktu', description: 'Nazwa, opis krótki, opis pełny, układ sekcji i SEO są zapisywane bez pytania, gdy wynik jest kompletny, zgodny i oparty na faktach.', configKey: 'autoApplyProductEditorial' }),
    Object.freeze({ id: 'linked_allegro_content', icon: '🟠', label: 'Treść istniejącej oferty Allegro', description: 'Tytuł, opis i układ sekcji już powiązanej oferty są synchronizowane automatycznie. Cena, stan i status publikacji pozostają nietknięte.', configKey: 'autoUpdateLinkedAllegroContent' }),
    Object.freeze({ id: 'customer_reply_drafts', icon: '💬', label: 'Szkice odpowiedzi klientom', description: 'Po nowej wiadomości Agent analizuje całą rozmowę, zamówienie i przesyłkę, po czym przygotowuje szkic. Nigdy nie wysyła go sam.', configKey: 'autoPrepareCustomerReplyDrafts' }),
    Object.freeze({ id: 'catalog_identity_audit', icon: '🪪', label: 'Kontrola EAN, producenta i kategorii', description: 'Agent znajduje brakujące lub sprzeczne dane identyfikacyjne i kieruje wyłącznie realne wyjątki do właściwego modułu.', configKey: 'autoAuditCatalogIdentity' }),
    Object.freeze({ id: 'allegro_compliance', icon: '🛡️', label: 'Oczyszczanie zgodności Allegro', description: 'Agent usuwa z opisu treści kontaktowe, sprzedaż poza Allegro, zewnętrzne płatności i inne niedozwolone sformułowania.' }),
    Object.freeze({ id: 'read_only_checks', icon: '🔎', label: 'Kontrole i synchronizacja danych', description: 'Odczyt statusów, prowizji, dostępności, zamówień, wiadomości i jakości katalogu odbywa się bez potwierdzenia.' }),
    Object.freeze({ id: 'exact_identity_mapping', icon: '🧩', label: 'Pewne mapowanie identyfikatorów', description: 'Jednoznaczne połączenia po EAN/GTIN, ID katalogu lub EXTERNAL_ID/SKU mogą być zapisane automatycznie z audytem.' }),
    Object.freeze({ id: 'supplier_availability', icon: '🏭', label: 'Dostępność potwierdzona u producenta', description: 'Oferta może zostać automatycznie ukryta przy potwierdzonym braku u producenta i przywrócona po powrocie towaru, zgodnie z zapisanym wyjątkiem czasowym.' }),
    Object.freeze({ id: 'supplier_demand_reconciliation', icon: '📦', label: 'Uzgadnianie braków z zamówieniami', description: 'Plan zatowarowania scala aktywne zamówienia, stan i towar już zamówiony. Kopie dokumentów oraz nieaktualne braki są usuwane automatycznie.' }),
    Object.freeze({ id: 'integration_health', icon: '🩺', label: 'Kontrola połączeń i ponowienia', description: 'Agent sprawdza działanie Allegro, InPost, e-maila i inFaktu oraz bezpiecznie ponawia wyłącznie operacje odczytu.' }),
    Object.freeze({ id: 'decision_housekeeping', icon: '✅', label: 'Porządkowanie wykonanych spraw', description: 'Zrealizowane zadania i obsłużone wiadomości znikają z listy wymagającej reakcji i pozostają w audycie.' }),
  ]),
  approvalRequired: Object.freeze([
    Object.freeze({ id: 'new_allegro_publication', icon: '🛒', label: 'Nowa publikacja lub aktywacja Allegro', description: 'Agent może przygotować kompletny szkic, ale pierwsze wystawienie albo aktywacja sprzedaży wymaga zatwierdzenia.' }),
    Object.freeze({ id: 'price_or_stock', icon: '💰', label: 'Ręczna zmiana ceny lub stanu sprzedażowego', description: 'Cena, marża, rabat i ręczna korekta stanu oferty wymagają decyzji. Wyjątkiem jest wcześniej zatwierdzona automatyka dostępności producenta.' }),
    Object.freeze({ id: 'destructive_offer_action', icon: '🗑️', label: 'Zakończenie, usunięcie lub scalenie oferty', description: 'Działania nieodwracalne i niejednoznaczne duplikaty zawsze trafiają do decyzji administratora.' }),
    Object.freeze({ id: 'external_message', icon: '💬', label: 'Wiadomość do klienta lub producenta', description: 'Agent przygotowuje treść, ale wysyłka wiadomości, dyskusji i zamówienia do producenta wymaga potwierdzenia.' }),
    Object.freeze({ id: 'shipment_or_finance', icon: '🔐', label: 'Przesyłka, dokument finansowy lub płatność', description: 'Etykieta, zwrot, faktura, korekta, płatność i zamówienie zakupu nie są wykonywane bez zatwierdzenia.' }),
  ]),
  blockedOnUncertainty: Object.freeze([
    'sprzeczne albo brakujące fakty produktu',
    'niepewna tożsamość produktu lub oferty',
    'naruszenie zasad Allegro, którego nie da się bezpiecznie oczyścić',
    'błąd API lub brak potwierdzenia wykonania po stronie zewnętrznej',
  ]),
});

export const NEVER_AUTOMATIC = Object.freeze(AGENT_ACTION_POLICY.approvalRequired.map((item) => item.label));
