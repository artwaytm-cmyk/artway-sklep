# Ekonomiczny routing agentów — 2026-07-26

## Zasada

- GPT-5.4 nano wykonuje proste zadania masowe, klasyfikację, SEO, kampanie i krótkie dokumenty.
- GPT-5.4 mini obsługuje pełne redakcje ofert, zgodność kanałów, odpowiedzi klientom i koordynację operacyjną.
- Pełny GPT-5.4 nie pracuje w zwykłym cyklu. Uruchamia się tylko przy jawnej eskalacji diagnostycznej lub powtarzającym się trudnym błędzie.
- GPT-5.5 jest dostępny na koncie, ale nie jest używany automatycznie: kosztuje więcej niż GPT-5.4, a precyzyjne playbooki nie wymagają go w codziennym cyklu.
- Każda rola ma limit wyniku, dzienny limit wejścia i wyniku automatyki oraz wersjonowany playbook.
- Stała część instrukcji jest buforowana przez Prompt Caching, a dane bieżącego produktu lub sprawy trafiają na koniec zapytania.

## Routing 14 ról

| Rola | Model codzienny | Rozumowanie | Maks. wynik | Długość playbooka |
|---|---|---:|---:|---:|
| Redaktor sklepu | GPT-5.4 mini | medium | 2600 | 5022 znaki |
| Strażnik treści sklepu | GPT-5.4 mini | low | 2400 | 4204 znaki |
| Redaktor oferty Allegro | GPT-5.4 mini | low | 2400 | 4542 znaki |
| Strażnik zgodności Allegro | GPT-5.4 mini | medium | 2200 | 4334 znaki |
| Operator publikacji Allegro | GPT-5.4 mini | low | 1500 | 5633 znaki |
| Redaktor Von Halsky | GPT-5.4 mini | low | 2400 | 4632 znaki |
| Strażnik treści Von Halsky | GPT-5.4 mini | low | 2200 | 4205 znaki |
| Opiekun klienta | GPT-5.4 mini | low | 1200 | 4376 znaki |
| Specjalista SEO | GPT-5.4 nano | low | 1400 | 4260 znaki |
| Strateg promocji | GPT-5.4 nano | low | 1400 | 4021 znaki |
| Dyrektor bannera | GPT-5.4 nano | low | 1200 | 4214 znaki |
| Koordynator producenta | GPT-5.4 nano | low | 1000 | 4334 znaki |
| Kontroler jakości | GPT-5.4 nano | medium | 1500 | 4188 znaki |
| Koordynator operacyjny | GPT-5.4 mini | low | 1300 | 4475 znaki |

Każdy playbook zawiera: dokładne wyzwalacze, kontrakt wejścia, procedurę, kryteria ukończenia, zakazy, format wyniku, obsługę błędów i ponowień, zasady dowodów, reguły wydajności, typowe pomyłki oraz przykłady poprawnej reakcji.

## Funkcje OpenAI ze wskazanego ekranu

- Interfejs aplikacji i Responses API: aktywne w panelu administratora.
- Agents SDK: aktywny dla diagnostyki, śladów wykonania, narzędzi i bramek zatwierdzeń.
- Audio czasu rzeczywistego: dostępne, ale celowo niewłączone, ponieważ panel administracyjny korzysta z tańszej komunikacji tekstowej.
- Transkrypcja audio: wyłączona do czasu dodania kontrolowanego wejścia audio bezpośrednio w panelu administratora.
- Obrazy: aktywne dla bannerów i ikon.
- Dzienniki i trace: aktywne bez zapisywania sekretów.
- Batch: aktywny dla dobowej ewaluacji asynchronicznej.
- Evals: aktywne dla testów regresji i jakości.
- Fine-tuning: pozostaje dostępny, ale jest dopuszczony dopiero po zebraniu zatwierdzonych przykładów i przejściu ewaluacji.
- Aktualizacja modeli: aktywna ekonomiczna rodzina GPT-5.4 z routingiem nano/mini/pełny.
- Optymalizacja API: Prompt Caching, limity wyniku, cache wyników, fingerprinty i dzienne budżety tokenów.
- Migracja: hybrydowa i celowa — Responses API dla deterministycznych ról, Agents SDK dla pętli narzędziowych i diagnostyki.
- Codex i wtyczka OpenAI Developers: służą do rozwijania projektu; nie są procesem wykonawczym sklepu produkcyjnego.

## Widoczność i ograniczenie Platformy

Panel pokazuje dla każdej roli pełny prompt serwerowy, jego wersję, model, poziom rozumowania, limit odpowiedzi i liczbę znaków. Istniejące zapisane prompty OpenAI Platform mają bezpośrednie odnośniki.

OpenAI Platform nie udostępnia publicznego endpointu API do automatycznego tworzenia lub edycji zapisanych promptów z poziomu serwera. Dlatego kanoniczne playbooki wszystkich ról są wersjonowane w kodzie i widoczne w panelu; profile istniejące w Platformie pozostają podłączone jako dodatkowa, zarządzana referencja.
