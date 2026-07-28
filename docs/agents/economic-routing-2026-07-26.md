# Ekonomiczny routing agentów — aktualizacja 2026-07-28

## Zasada

- `gpt-5-nano` wykonuje wszystkie codzienne zadania, w tym treści produktowe,
  zgodność, SEO, kampanie, bannery i szkice wiadomości.
- `gpt-5.4-nano` uruchamia się najwyżej raz, tylko gdy podstawowy model nie zwróci
  poprawnego kontraktu strukturalnego albo pogłębiona diagnostyka ma
  potwierdzony powód.
- `gpt-5.4-mini` nie jest używany automatycznie.
- Pełny `gpt-5.4` oraz droższa rodzina `gpt-5.6` nie są używane automatycznie.
- Lokalny `qwen3.5:4b` przez Ollama jest bezpłatnym trybem awaryjnym po
  wyczerpaniu środków lub awarii płatnego API.
- Ograniczenia usługi lokalnej są wersjonowane w
  `ops/systemd/ollama-artway.conf`; endpoint słucha wyłącznie na
  `127.0.0.1:11434`.
- Stała część instrukcji korzysta z Prompt Caching. Fingerprint wejścia zapobiega
  ponawianiu tej samej pracy, a wynik musi przejść walidację i trwały zapis.

Pełna tabela 14 ról, dokładne prompty, modele, linki OpenAI Platform i miejsca
zapisu są generowane do `docs/agents/openai-prompts-and-connections.md`.

## Dlaczego nie GPT-5.6 Luna

Luna jest modelem efektywnym w rodzinie 5.6, ale według bieżącego cennika nadal
jest wyraźnie droższa od `gpt-5-nano`. W tym systemie jakość utrzymują
wersjonowane playbooki, ścisły JSON Schema, walidatory kanałów, przykłady
historycznych awarii i kontrolowany fallback do mini.

## Funkcje Platformy

Responses API, Agents SDK, trace, Batch, Evals, obrazy i monitoring użycia
pozostają podłączone. Realtime audio nie działa stale, ponieważ transkrypcja
plików na żądanie jest tańsza. Fine-tuning pozostaje wyłączony do czasu zebrania
zatwierdzonego zbioru i przejścia ewaluacji.
