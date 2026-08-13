# Błędy formularza wysyłki

Lista problemów zauważonych podczas obsługi formularza listu przewozowego. Pakiet poprawek został przygotowany i przetestowany 2026-08-13; plik nie zawiera danych klientów ani danych przesyłek.

## Nowe wymagania i błędy do poprawy

### WYS-012 — Brak automatycznych danych kontaktowych Artway przy braku e-maila lub telefonu klienta

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i sprawdzono na produkcji 2026-08-13; brakujące pola są uzupełniane kontaktem technicznym Artway-TM
- Miejsce: panel administracyjny → Wysyłki → dane nadawcy i odbiorcy
- Obecne działanie: wymagane pola e-mail i telefon pozostają puste, gdy klient nie poda danych; operator musi za każdym razem ręcznie wpisać kontakt Artway-TM.
- Oczekiwane działanie: jeśli klient nie poda e-maila lub telefonu, formularz automatycznie uzupełnia odpowiednie brakujące pole danymi technicznymi Artway-TM. Interfejs wyraźnie oznacza, że są to dane kontaktowe Artway użyte zastępczo, aby nie przedstawiać ich jako danych klienta.

### WYS-013 — Brak jawnego adresu zwrotnego klienta nadającego paczkę

- Data zgłoszenia: 2026-08-13
- Status: częściowo naprawiono 2026-08-13 — uwaga trafia do ShipX i rejestru; nadal brakuje osobnego pola adresu zwrotnego
- Miejsce: panel administracyjny → Wysyłki → dane nadawcy i uwagi
- Obecne działanie: adres zwrotu można zapisać tylko ręcznie w ogólnym polu uwag; formularz nie pokazuje osobnego potwierdzenia, dokąd ma wrócić niedoręczona przesyłka.
- Oczekiwane działanie: adres zwrotu jest domyślnie równy adresowi klienta wskazanego jako nadawca/zleceniodawca, jest widoczny w podsumowaniu przed utworzeniem etykiety i automatycznie dopisywany do uwag przekazywanych do przewoźnika. Operator może go świadomie zmienić.

### WYS-014 — „InPost Kurier” nie rozstrzyga sposobu przekazania paczki przewoźnikowi

- Data zgłoszenia: 2026-08-13
- Status: zapisano do poprawy — produkcja nadal domyślnie zaznacza odbiór przez kuriera
- Miejsce: panel administracyjny → Wysyłki → sposób doręczenia i sposób nadania
- Obecne działanie: po wybraniu doręczenia „InPost Kurier” formularz domyślnie zaznacza odbiór przez kuriera. Operator może błędnie uznać, że wybór „kurier” określił wyłącznie doręczenie, mimo że został też wybrany płatny odbiór z adresu nadawcy.
- Oczekiwane działanie: przed utworzeniem etykiety operator musi jawnie wybrać, czy paczkę odbierze kurier z adresu nadawcy, czy zostanie przekazana w PaczkoPunkcie. Podsumowanie pokazuje oba wybory osobno i nie stosuje niejawnego wariantu domyślnego.

### WYS-015 — Karty nadawcy i odbiorcy nie odświeżają się po ręcznej zmianie pól

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i sprawdzono na produkcji 2026-08-13
- Miejsce: panel administracyjny → Wysyłki → karta nadawcy i karta odbiorcy nad formularzem danych
- Kroki: zmienić domyślnego nadawcę Artway-TM na klienta oraz ręcznie wpisać kompletne dane odbiorcy.
- Obecne działanie: pola formularza zawierają nowe poprawne dane, ale karta nadawcy nadal pokazuje Artway-TM, a karta odbiorcy nadal wyświetla „Nie wybrano odbiorcy”. Operator nie ma wiarygodnego wizualnego podsumowania danych, które zostaną wysłane.
- Oczekiwane działanie: obie karty aktualizują się na żywo po zmianie pól i przed utworzeniem etykiety pokazują dokładnie te dane, które znajdą się w żądaniu ShipX.

### WYS-016 — Nowa przesyłka nie pojawia się od razu w pełnym rejestrze

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i wdrożono 2026-08-13; końcowa weryfikacja nastąpi przy następnym utworzeniu etykiety
- Miejsce: panel administracyjny → Wysyłki → rejestr nadań
- Kroki: utworzyć poprawną przesyłkę i zaczekać na odświeżenie rejestru.
- Obecne działanie: licznik oraz informacja o liczbie wyników rosną, ale nowego wiersza nie widać na pełnej liście nawet po użyciu przycisku „Odśwież”. Wiersz pojawia się dopiero po wyszukaniu pełnego numeru przesyłki.
- Oczekiwane działanie: utworzone nadanie od razu pojawia się jako pierwszy wiersz rejestru, bez konieczności ręcznego wyszukiwania lub zmiany filtra.

### WYS-017 — Wyczyszczenie nazwy firmy nadawcy nie trafia do tworzonej przesyłki

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i sprawdzono w formularzu produkcyjnym 2026-08-13; oficjalna etykieta wymaga końcowej kontroli przy następnym nadaniu
- Miejsce: formularz nadawcy, rekord przesyłki, potwierdzenie klienta i oficjalna etykieta InPost
- Kroki: wyczyścić domyślną firmę Artway-TM i wpisać osobę fizyczną jako nadawcę.
- Obecne działanie: adres, imię i nazwisko zostają zmienione, ale ukryta/stara nazwa firmy Artway-TM pozostaje w żądaniu. Oficjalna etykieta pokazuje Artway-TM jako nadawcę, a potwierdzenie pokazuje Artway-TM jako zleceniodawcę zamiast osoby wpisanej w formularzu.
- Oczekiwane działanie: świadome wyczyszczenie firmy jest zachowane; etykieta, rekord i potwierdzenie pokazują wyłącznie osobę wskazaną jako nadawca/zleceniodawca. Przed utworzeniem etykiety podsumowanie ma wyłapywać rozbieżność.

### WYS-018 — Oficjalna etykieta kurierska pokazuje 25 kg zamiast wagi wpisanej w formularzu

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i wdrożono 2026-08-13; oficjalna etykieta wymaga końcowej kontroli przy następnym nadaniu
- Miejsce: budowanie paczki ShipX dla przesyłki kurierskiej z wybranym gabarytem A/B/C/D
- Kroki: wybrać kuriera, gabaryt A i wpisać wagę 1 kg, a następnie pobrać oficjalną etykietę.
- Obecne działanie: rekord i potwierdzenie klienta pokazują 1 kg, lecz do ShipX wysyłany jest sam szablon gabarytu bez wagi; oficjalna etykieta InPost pokazuje 25,00 kg.
- Oczekiwane działanie: żądanie ShipX zawsze zawiera wagę wpisaną przez operatora, a formularz, rekord, potwierdzenie i etykieta InPost pokazują tę samą wartość. Automatyczny test przed utworzeniem porównuje wagę formularza z odpowiedzią ShipX.

### WYS-019 — Uwagi przekazane do InPost nie są zachowywane w rejestrze sklepu

- Data zgłoszenia: 2026-08-13
- Status: naprawiono i wdrożono 2026-08-13; zapis zostanie potwierdzony przy następnym nadaniu
- Miejsce: rekord nadania usługowego i podgląd szczegółów przesyłki
- Obecne działanie: uwaga o adresie zwrotnym poprawnie trafia do ShipX i jest wydrukowana na etykiecie, ale własny rekord sklepu nie przechowuje pola `comments`. Po utworzeniu nie można jej sprawdzić w rejestrze ani na potwierdzeniu.
- Oczekiwane działanie: uwagi są zapisywane razem z nadaniem, widoczne w szczegółach i na potwierdzeniu oraz porównywane z aktualnym rekordem ShipX.

### WYS-020 — Automatyczne potwierdzenie przesyłki odbiera możliwość korekty i anulowania

- Data zgłoszenia: 2026-08-13
- Status: krytyczny; zapisano do poprawy przed dalszymi seryjnymi nadaniami
- Miejsce: końcowy krok tworzenia przesyłki w ShipX
- Obecne działanie: formularz korzysta z uproszczonego utworzenia, które od razu kupuje przesyłkę i ustawia status `confirmed`. Po wykryciu błędu danych InPost nie pozwala już jej zmienić ani anulować, więc poprawiona etykieta oznacza drugi zakup.
- Oczekiwane działanie: najpierw utworzyć przesyłkę z `only_choice_of_offer: true` i zatrzymać ją w statusie `offer_selected`, pokazać operatorowi ostateczne dane nadawcy, odbiorcy, wymiarów, wagi, uwag i ceny, a dopiero osobnym świadomym krokiem opłacić przesyłkę. Do chwili opłacenia szkic można anulować.

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
