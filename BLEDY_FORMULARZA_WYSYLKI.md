# Błędy formularza wysyłki

Lista problemów zauważonych podczas obsługi formularza listu przewozowego. Pakiet poprawek został przygotowany i przetestowany 2026-08-13; plik nie zawiera danych klientów ani danych przesyłek.

## Naprawione

### WYS-001 — Brak wyszukiwania adresu po wpisaniu kodu pocztowego

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: panel administracyjny → Wysyłki → formularz danych adresowych
- Kroki: najpierw wpisać pełny kod pocztowy odbiorcy.
- Obecne działanie: pole jedynie formatuje kod; nie uruchamia wyszukiwania ani nie podpowiada miejscowości i ulicy.
- Oczekiwane działanie: po wpisaniu poprawnego kodu formularz wyszukuje pasujące miejscowości/adresy, pozwala wybrać wynik i automatycznie uzupełnia odpowiednie pola, z możliwością ręcznej korekty.

### WYS-002 — Formularz pozwala wybrać niedozwolony sposób nadania dla usługi kurierskiej

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: panel administracyjny → Wysyłki → Nadaj przesyłkę → Sposób nadania
- Kroki: wybrać doręczenie „InPost Kurier”, a następnie „Nadam w automacie Paczkomat” i uruchomić test.
- Obecne działanie: formularz pozwala na takie połączenie, ale ShipX odrzuca je błędem `sending_method: Niedostępny dla podanego serwisu`.
- Oczekiwane działanie: niedostępne sposoby nadania są wyłączone albo formularz automatycznie wybiera wariant zgodny z usługą i jasno informuje użytkownika o zmianie.

### WYS-003 — Komunikat walidacji ShipX pokazuje techniczny identyfikator i ścieżkę API

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: wynik „Test bez tworzenia”.
- Obecne działanie: użytkownik widzi długą ścieżkę techniczną zawierającą identyfikator przesyłki i `custom_attributes.sending_method`.
- Oczekiwane działanie: krótki komunikat po polsku, np. „Dla przesyłki kurierskiej wybierz nadanie w PaczkoPunkcie albo odbiór przez kuriera”, a szczegóły techniczne tylko w diagnostyce.

### WYS-004 — Poprawny test konta postpaid kończy się ostrzeżeniem o braku ceny prepaid

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: wynik „Test bez tworzenia” po wybraniu zgodnego sposobu nadania.
- Obecne działanie: ShipX przyjmuje dane, lecz główny komunikat brzmi jak ostrzeżenie: „nie zwrócił ceny prepaid”, mimo że formularz rozlicza konto postpaid i pokazuje stawkę umowną.
- Oczekiwane działanie: wyraźny zielony wynik „Dane są poprawne”, z osobną informacją, że rozliczenie korzysta ze stawki umownej postpaid.

### WYS-005 — Przyciski etykiety A4 i A6 zgłaszają błąd mimo statusu „etykieta gotowa”

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: panel administracyjny → Wysyłki → Rejestr nadań → Akcje.
- Kroki: przy potwierdzonej przesyłce oznaczonej jako „etykieta gotowa” kliknąć A4, a następnie A6.
- Obecne działanie: oba przyciski pokazują `Etykieta: Wystąpiły błędy podczas walidacji (type: Nieznany)`. Jednocześnie podgląd oficjalnego PDF może się otworzyć, więc stan interfejsu jest sprzeczny.
- Oczekiwane działanie: wybrany format otwiera albo pobiera oficjalny PDF bez błędu; jeśli format jest niedostępny, przycisk jest wyłączony i pokazuje jednoznaczny komunikat.

### WYS-006 — Potwierdzenie ujawnia wewnętrzny koszt i prowizję

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: wydruk „Potwierdzenie nadania”.
- Obecne działanie: potwierdzenie pokazywało zleceniodawcy koszt przewoźnika i prowizję Artway-TM.
- Oczekiwane działanie: dokument zawsze pokazuje wyłącznie „Cenę końcową usługi”; koszt wewnętrzny, prowizja i sposób kalkulacji pozostają w panelu administracyjnym.

### WYS-007 — Status „Przesyłka potwierdzona” może sugerować, że paczka została już nadana

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: rejestr nadań i historia przesyłki w panelu sklepu.
- Obecne działanie: panel pokazuje „Przesyłka potwierdzona”, podczas gdy oficjalne śledzenie InPost dla tego samego numeru mówi „Przesyłka utworzona, ale nie jest gotowa do nadania”.
- Oczekiwane działanie: etap przed fizycznym przekazaniem paczki powinien brzmieć np. „Etykieta utworzona — paczka czeka na nadanie w PaczkoPunkcie”, aby nie mylić utworzenia etykiety z rzeczywistym nadaniem.

### WYS-008 — Zabezpieczenia przeglądarki blokują styl wydruku potwierdzenia

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: wydruk „Potwierdzenie nadania” otwierany w nowej karcie.
- Obecne działanie: treść dokumentu jest kompletna, ale reguły bezpieczeństwa CSP blokują osadzony arkusz stylów, przez co sekcje zlewają się i brakuje czytelnych pól na podpis oraz pieczęć.
- Oczekiwane działanie: formalny czarno-biały arkusz jest ładowany jako dozwolony plik strony, a układ A4, ramki, podpis i pieczęć pozostają czytelne na ekranie i wydruku.

### WYS-009 — Potwierdzenie myli technicznego nadawcę z klientem zlecającym usługę

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: wydruk „Potwierdzenie nadania”.
- Obecne działanie: dokument pobierał dane nadawcy technicznego użytego w ShipX, dlatego przy przesyłce klienta mógł pokazać dane Artway-TM zamiast danych osoby zlecającej usługę.
- Oczekiwane działanie: potwierdzenie ma osobne pole „Zleceniodawca”, zapisane razem z nadaniem; dane Artway-TM występują wyłącznie jako wystawca dokumentu.

### WYS-010 — Brak jednego potwierdzenia dla wielu paczek klienta

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: rejestr nadań usługowych InPost.
- Obecne działanie: każda paczka mogła mieć tylko osobne potwierdzenie.
- Oczekiwane działanie: operator zaznacza wiele przesyłek tego samego zleceniodawcy i tworzy jeden dokument A4 z tabelą paczek, odbiorców, numerów, statusów oraz jedną łączną ceną końcową. System nie pozwala połączyć przesyłek różnych zleceniodawców.

### WYS-011 — Potwierdzenie nie wskazuje docelowej drukarki A4

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: podgląd i wydruk potwierdzenia.
- Obecne działanie: przycisk uruchamiał ogólny dialog drukowania bez czytelnej informacji o urządzeniu i formacie.
- Oczekiwane działanie: dokument jest dokładnie dopasowany do A4, wskazuje Brother DCP-T525W jako drukarkę docelową, a komputer ma zapisane A4 i tryb czarno-biały dla tego urządzenia.

## Błędy danych wykryte podczas kontroli

### DANE-002 — Manager InPost i token sklepu wskazują różne przestrzenie konta

- Data wykrycia: 2026-08-13
- Status: przesyłka bezpieczna; do połączenia właściwego konta Managera z organizacją API.
- Kontrola: ShipX potwierdza dzisiejszą przesyłkę i pokazuje ją na liście organizacji firmowej, natomiast wyszukanie pełnego numeru na aktualnie zalogowanym koncie Managera zwraca brak wyników.
- Działanie ochronne: nie tworzyć duplikatu. Zalogować Manager do organizacji używanej przez token sklepu albo wygenerować token API na koncie, które ma pozostać głównym.

### DANE-001 — Kod pocztowy odbiorcy nie odpowiada miejscowości

- Data wykrycia: 2026-08-13
- Status: wymaga decyzji użytkownika przed anulowaniem lub ponownym utworzeniem przesyłki.
- Kontrola: formularz nie znajduje miejscowości dla podanego kodu, natomiast po wpisaniu prawidłowego kodu automatycznie rozpoznaje właściwą miejscowość.
- Działanie ochronne: nie wykonywać automatycznego anulowania ani ponownego nadania, ponieważ może to wpłynąć na etykietę i rozliczenie InPost.
