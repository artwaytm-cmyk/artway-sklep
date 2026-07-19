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

Obecny podział frontendu jest etapem bezpiecznej migracji: zachowuje zgodność ze starszymi globalnymi funkcjami HTML, a jednocześnie daje kontrolowane granice. Kolejne przebudowy mogą przenosić domeny do natywnych modułów ES bez ponownego tworzenia monolitu.
