# InPost Von Halsky — punkt przekazania na Maca

Data: 28 lipca 2026 r.

## Cel

Uruchomić bezpośrednią integrację Artway-TM z InPost Von Halsky i pozostawić
automatyczną pracę integracji na serwerze. Przeglądarka służy tylko do
jednorazowego onboardingu i pobrania danych integracyjnych.

## Obecny stan

- Portal logowania: `https://account.inpost-group.com/auth?client_id=merchant-portal&nrc=1`
- Logowanie w Chrome na serwerze zatrzymało zabezpieczenie Cloudflare.
- Formularz i konto nie zgłosiły błędu hasła. Problem dotyczy weryfikacji
  połączenia z adresu IP centrum danych OVH.
- Dalsze logowanie należy wykonać na Macu, w zwykłym Chrome i przez normalne
  łącze domowe lub komórkowe.
- Nie zapisano w repozytorium żadnego hasła, kodu jednorazowego ani sekretu.

## Co jest już przygotowane w Artway-TM

- osobny katalog i panel InPost Von Halsky;
- bezpośredni adapter API;
- OAuth `client_credentials`;
- bezpieczny cache krótkotrwałego tokenu i automatyczne odnowienie;
- HTTPS, limit czasu, kontrolowane ponowienia odczytów i klucze idempotencji;
- synchronizacja katalogu partiami, z ręcznym wyborem pozycji do publikacji;
- brak automatycznego tworzenia nowych ofert bez decyzji administratora;
- oddzielne ceny Von Halsky z domyślnym dziedziczeniem ceny Allegro;
- kontrola EAN/GTIN, kodu producenta, marki, zdjęć, opisu i dostępności;
- automatyczne ukrycie oraz wznowienie sprzedaży według dostępności;
- pobieranie zamówień i diagnostyka połączenia;
- centralny zapis potwierdzeń publikacji w kartotece produktu.

Kod klienta API:
`src/backend/lib/domain/von-halsky-api-client.mjs`

Obsługa tras:
`src/backend/lib/von-halsky-route.mjs`

Panel:
`src/frontend/11b-von-halsky-workspace.js`

Bezpieczny wzór konfiguracji:
`ops/von-halsky-api.env.example`

## Co trzeba pobrać po zalogowaniu

W Portalu Merchanta należy znaleźć onboarding/integracje/API i pobrać lub
uzyskać od InPost:

1. `client_id`;
2. `client_secret`;
3. identyfikator merchanta/sklepu;
4. produkcyjny adres bazowy API, jeżeli kontrakt używa innego niż publiczny
   adres InPost Group;
5. dokładne ścieżki:
   - testu połączenia,
   - publikacji/synchronizacji katalogu,
   - pobierania zamówień;
6. wersję kontraktu;
7. wymagany zakres OAuth (`scope`);
8. nazwę nagłówka identyfikatora merchanta;
9. sekret i zasady podpisu webhooka, jeśli InPost udostępni zdarzenia
   przychodzące;
10. prywatną dokumentację schematu produktów, zamówień, błędów i limitów API.

Sekretów nie wolno wpisywać do tego pliku ani commitować do GitHub. Po
uzyskaniu danych produkcyjnych należy je zapisać wyłącznie w:

`/srv/artway/ops/secrets/von-halsky.env`

Plik musi należeć do użytkownika `artway` i mieć uprawnienia `0600`.

## Kolejność dalszej pracy

1. Otworzyć tę samą rozmowę Codex na Macu.
2. Zalogować się do Portalu Merchanta InPost w lokalnym Chrome.
3. Otworzyć sekcję integracji/API Von Halsky.
4. Nie wklejać sekretu do rozmowy — zapisać go przez bezpieczny przepływ
   bezpośrednio do serwerowego pliku sekretów.
5. Dopasować prywatne ścieżki i schematy do istniejącego adaptera.
6. Uruchomić test autoryzacji, test połączenia, podgląd katalogu i testową
   synchronizację jednej kontrolnej pozycji.
7. Sprawdzić pobieranie zamówień oraz idempotencję.
8. Uruchomić synchronizację cykliczną dopiero po pozytywnych testach.
9. Wykonać jedno wydanie produkcyjne na końcu.

## Ważne rozróżnienie

Logowanie do Merchant Portal nie jest mechanizmem pracy sklepu. Produkcyjna
integracja ma działać bez aktywnej przeglądarki i bez sesji użytkownika,
wyłącznie serwer–serwer przez OAuth. Portal służy do onboardingu,
konfiguracji i pobrania prywatnego kontraktu.
