# Artway — workflow diagnostyczny

To jest serwerowy wariant wdrożenia workflow z OpenAI Agent Builder: kod działa
przez oficjalny `@openai/agents` na VPS, a każde uruchomienie zapisuje trace w
OpenAI Platform. Nie wymaga otwartej karty przeglądarki.

## Przepływ

1. Przeglądarka i backend zapisują zanonimizowany błąd w `system_diagnostics`.
2. Powtórzenia są łączone po odcisku przyczyny.
3. Nowy błąd administratora trafia do kolejki workflow.
4. Agent `Artway — główny diagnosta` używa `gpt-5.6-sol`, reasoning `max`.
5. Wynik strukturalny zapisuje klasyfikację, przyczynę, dowody, działania i plan
   weryfikacji przy tym samym wpisie diagnostycznym.
6. Agent nie oznacza błędu jako rozwiązany. Status `resolved` wymaga wykonania
   naprawy i potwierdzenia ponownym testem.

## Polityka modeli

- `gpt-5.6-sol`: diagnostyka, zgodność, publikacja Allegro i trudne kontrole;
- `gpt-5.6-terra`: opisy, komunikacja i bieżące operacje;
- `gpt-5.6-luna`: duże, powtarzalne partie SEO i tekstów kampanii.

Zmiana modeli nie wymaga edycji kodu: służą do tego zmienne
`OPENAI_DIAGNOSTICS_MODEL`, `OPENAI_MODEL_SOL`, `OPENAI_MODEL_TERRA` i
`OPENAI_MODEL_LUNA`.

## Granice automatyki

Bez potwierdzenia wolno wykonać wyłącznie odczyt, ponowienie bezpiecznego testu
albo odświeżenie numeru wersji cache. Workflow nie zmienia zamówień, płatności,
stanów, ofert, wiadomości, kodu ani sekretów.

## Weryfikacja

- `tests/diagnostic-agent-workflow.test.mjs` sprawdza model, routing i brak
  sekretów w trace;
- `tests/system-diagnostics-central.test.mjs` sprawdza kolejkę i trwały zapis;
- `tests/settings-domain-contract.test.mjs` odtwarza równoległy zapis planu;
- produkcyjny test modelu wykonuje się dopiero po przejściu testów lokalnych.
