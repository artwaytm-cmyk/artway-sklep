# Architektura Artway-TM

## Zasada główna

Kod źródłowy jest podzielony według odpowiedzialności. Pliki `assets/app.js`, `assets/admin.js`, `assets/styles.css` i `assets/admin.css` są wyłącznie plikami wynikowymi dla przeglądarki — nie wolno edytować ich ręcznie. Powstają poleceniem `npm run build`. Pakiety `admin.*` są pobierane dopiero po wejściu zalogowanego administratora do panelu.

## Warstwy

- `src/frontend/` — domenowe części aplikacji klienckiej, składane w jawnej kolejności.
- `src/styles/` — style pogrupowane według obszarów interfejsu.
- `netlify/functions/lib/core/` — wspólne mechanizmy HTTP i zapisu danych.
- `netlify/functions/lib/domain/` — reguły biznesowe niezależne od endpointów.
- `netlify/functions/lib/*` — integracje i tymczasowy moduł aplikacyjny podczas dalszej migracji.
- `tests/` — testy reguł biznesowych, bezpieczeństwa i granic architektury.

## Praca nad zmianą

1. Zmień właściwy moduł w `src/` albo `netlify/functions/lib/`.
2. Dodaj lub uaktualnij test dla reguły biznesowej.
3. Uruchom `npm run build`, a następnie `npm run verify`.
4. Publikuj dopiero po przejściu całej bramki jakości.

## Reguły dla kolejnych funkcji

- Nowa logika nie trafia bezpośrednio do pliku wynikowego ani do przypadkowej sekcji.
- Kod zależny od zewnętrznego API jest oddzielony od widoku i od reguł biznesowych.
- Operacje zewnętrzne wymagają jawnego zatwierdzenia administratora; diagnostyka i szkice mogą działać automatycznie.
- Sekrety są wyłącznie w zmiennych środowiskowych.
- Tożsamość klienta wynika wyłącznie z podpisanej sesji serwerowej; e-mail lub rola przesłane w treści żądania nie stanowią uprawnienia.
- Ceny, rabaty, koszty dostawy i status nowego zamówienia są wyliczane po stronie serwera z aktualnego katalogu.
- Każda nowa domena dostaje testy i własny plik; po przekroczeniu około 500–800 linii należy ją ponownie podzielić.
- `store-app.mjs` jest wyłącznie koordynatorem tras i etapem migracyjnym. E-mail, InPost, PayNow, inFakt oraz odczyt produktu ze źródła mają własne usługi i nie mogą wracać do pliku centralnego.
- Moduły panelu Agenta AI, Allegro, zamówień, magazynu i edytora produktu są składane w `assets/admin.js` w jawnej kolejności; pojedyncza domena panelu ma budżet 650 linii.
- Zmiana nie może omijać `npm run verify` ani publikować nieaktualnych plików wynikowych.
- Funkcje administracyjne i ich style pozostają w pakietach ładowanych na żądanie; nie wolno zwiększać kosztu pierwszego wejścia klienta bez testu budżetu zasobów.

## Stały standard wydajności panelu

Panel administratora projektujemy dla katalogu od 50 000 do 100 000 produktów, a nie wyłącznie dla obecnego rozmiaru danych.

- Trasa pobiera wyłącznie własne moduły. Zabronione jest automatyczne pobieranie wszystkich pakietów panelu; następna trasa może zostać przygotowana dopiero po wskazaniu lub sfokusowaniu jej odnośnika.
- Rejestry produktów są stronicowane po stronie serwera i przechowywane w trwałym cache IndexedDB. Przejście między podstronami nie może ponownie pobierać pełnego katalogu ani pełnego snapshotu ustawień.
- Widok nigdy nie tworzy DOM dla całego katalogu. Renderuje tylko bieżącą stronę, a większy fragment dzieli na małe partie lub wirtualizuje.
- Wyszukiwanie i filtrowanie korzysta z indeksu obliczanego raz na rewizję danych. Dodanie filtra nie może dokładać kolejnego pełnego przebiegu po katalogu.
- Wpisywanie w wyszukiwarce jest opóźnione i nie może przebudowywać widoku po każdej literze.
- Kosztowne audyty, mapowania i statystyki mają cache unieważniany rewizją lub zmianą źródłowej kolekcji. Nie wolno ich liczyć osobno dla każdego kafelka produktu.
- Przełączenie podstrony wykorzystuje zachowany stan i cache widoku; synchronizacja zewnętrzna działa w ustalonym interwale i odświeża ekran tylko po rzeczywistej zmianie danych.
- Każda zmiana w katalogu, routerze lub modułach panelu musi utrzymać testy `performance-guards` i budżety pakietów z testu architektury.

Obecny podział frontendu jest etapem bezpiecznej migracji: zachowuje zgodność ze starszymi globalnymi funkcjami HTML, a jednocześnie daje kontrolowane granice. Kolejne przebudowy mogą przenosić domeny do natywnych modułów ES bez ponownego tworzenia monolitu.

## Budżety jak dla dużej aplikacji

Duże platformy nie uznają jednej liczby linii za miarę skalowalności. Stosujemy dwa poziomy zapisane centralnie w `config/architecture-budgets.mjs`: cel rozwojowy (`target`) oraz twardą bramkę publikacji (`max`). Przekroczenie celu jest długiem do zaplanowania, a przekroczenie maksimum blokuje testy.

- Linie są liczone fizycznie; końcowy znak nowej linii nie tworzy fikcyjnej dodatkowej linii.
- `store-app.mjs` jest koordynatorem migracyjnym: po wydzieleniu tras Agenta, komunikacji Allegro, mapowania, dostępności i poczty cel to 3800 linii, a twarda granica 4500. Nowa logika biznesowa nadal musi trafiać do domen, nawet jeśli pozostał zapas.
- Zwykły moduł JavaScript ma cel 600 i awaryjne maksimum 1500 linii; skupiona domena panelu cel 500 i maksimum 700; integracja cel 500 i maksimum 800. Cel uruchamia ostrzeżenie odpowiednio wcześnie, więc twardy limit nie zostawia zaledwie kilku linii zapasu.
- Pierwsza paczka sklepu jest kontrolowana również po kompresji gzip: cel 125 KiB i maksimum 160 KiB. Moduł jednej trasy panelu ma cel 100 KiB i maksimum 120 KiB gzip.
- Pełny `assets/admin.js` jest wyłącznie artefaktem kontrolnym i nie jest wysyłany do przeglądarki. Budżet dotyczy rzeczywiście ładowanego rdzenia i paczki bieżącej trasy.
- Raport `npm run audit:architecture` pokazuje zapas oraz ostrzeżenia, natomiast `npm run verify` blokuje przekroczenia twarde.

Limity bezpieczeństwa, limity zewnętrznych API, stronicowanie i rozmiary importów pozostają osobnymi kontraktami. Nie wolno ich zwiększać tylko dlatego, że rośnie liczba produktów; skalowanie odbywa się przez stronicowanie, kolejki, cache i podział domen.
