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

### WYS-006 — Potwierdzenie nazywa kwotę z prowizją „kosztem nadania”

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: wydruk „Potwierdzenie nadania”.
- Obecne działanie: rejestr pokazuje koszt InPost 17,58 zł oraz kwotę z prowizją 21,58 zł, ale potwierdzenie opisuje 21,58 zł jako „Koszt nadania”.
- Oczekiwane działanie: potwierdzenie osobno pokazuje „Koszt InPost: 17,58 zł”, „Prowizja Artway-TM: 4,00 zł” i „Razem dla klienta: 21,58 zł”, również przy rozliczeniu bez faktury.

### WYS-007 — Status „Przesyłka potwierdzona” może sugerować, że paczka została już nadana

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i przetestowano 2026-08-13
- Miejsce: rejestr nadań i historia przesyłki w panelu sklepu.
- Obecne działanie: panel pokazuje „Przesyłka potwierdzona”, podczas gdy oficjalne śledzenie InPost dla tego samego numeru mówi „Przesyłka utworzona, ale nie jest gotowa do nadania”.
- Oczekiwane działanie: etap przed fizycznym przekazaniem paczki powinien brzmieć np. „Etykieta utworzona — paczka czeka na nadanie w PaczkoPunkcie”, aby nie mylić utworzenia etykiety z rzeczywistym nadaniem.
