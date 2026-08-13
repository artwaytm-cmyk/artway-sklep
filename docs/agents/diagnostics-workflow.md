# Artway — workflow diagnostyczny

Workflow działa na VPS przez oficjalny `@openai/agents`; otwarta karta
przeglądarki nie jest wymagana. Każde uruchomienie może zapisać bezpieczny trace
w OpenAI Platform bez sekretów.

## Przepływ

1. Przeglądarka i backend zapisują zanonimizowany błąd w `system_diagnostics`.
2. Powtórzenia są łączone po odcisku przyczyny.
3. Nowy błąd administratora trafia do kolejki workflow.
4. Rutynowa analiza używa `gpt-5-nano`, reasoning `low`.
5. Powtarzający się błąd krytyczny albo jawna pogłębiona analiza może użyć
   `gpt-5.4-nano`, reasoning `medium`.
6. Wynik strukturalny zapisuje klasyfikację, przyczynę, dowody, działania i plan
   weryfikacji przy tym samym wpisie.
7. Agent nie oznacza błędu jako rozwiązany. Status `resolved` wymaga wykonania
   naprawy i potwierdzenia ponownym testem.

## Tryb bezpłatny

Po wyczerpaniu środków albo czasowej niedostępności OpenAI specjaliści mogą użyć
lokalnego `qwen3.5:4b` przez Ollama. Model jest ładowany na krótko i zwalniany,
aby nie zabierać stale pamięci sklepowi. Jeżeli lokalny model również nie działa,
system zachowuje deterministyczne kontrole i nie tworzy fałszywego sukcesu AI.

## Konfiguracja

- `OPENAI_DIAGNOSTICS_ROUTINE_MODEL` — domyślnie `gpt-5-nano`;
- `OPENAI_DIAGNOSTICS_ESCALATION_MODEL` — domyślnie `gpt-5.4-nano`;
- `OPENAI_MODEL_STANDARD` — codzienny model wszystkich specjalistów;
- `OPENAI_MODEL_ESCALATION` — fallback jakości;
- `OLLAMA_FALLBACK_ENABLED` — włącza lokalny tryb awaryjny;
- `OLLAMA_FALLBACK_MODEL` — domyślnie `qwen3.5:4b`;
- `OLLAMA_BASE_URL` — domyślnie `http://127.0.0.1:11434`.

Pełne instrukcje, linki i routing znajdują się w
`docs/agents/openai-prompts-and-connections.md`.

## Granice automatyki

Bez potwierdzenia wolno wykonać wyłącznie odczyt, ponowienie bezpiecznego testu
albo odświeżenie numeru wersji cache. Workflow nie zmienia zamówień, płatności,
stanów, ofert, wiadomości, kodu ani sekretów.

## Weryfikacja

- `tests/diagnostic-agent-workflow.test.mjs` sprawdza routing i brak sekretów;
- `tests/agent-specialist-openai.test.mjs` sprawdza fallback jakości i lokalny;
- `tests/system-diagnostics-central.test.mjs` sprawdza kolejkę i trwały zapis;
- `tests/settings-domain-contract.test.mjs` odtwarza równoległy zapis planu.
