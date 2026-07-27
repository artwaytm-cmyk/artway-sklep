import { Agent, run } from '@openai/agents';
import { z } from 'zod';
import { diagnosticsModelPolicy } from './agent-model-policy.mjs';

const DiagnosticResult = z.object({
  classification: z.enum(['application_bug', 'configuration', 'external_integration', 'stale_client', 'data_conflict', 'transient', 'unknown']),
  rootCause: z.string().min(1).max(1200),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(1).max(400)).max(8),
  recommendedActions: z.array(z.object({
    action: z.string().min(1).max(500),
    risk: z.enum(['low', 'medium', 'high']),
    automatic: z.boolean(),
  })).max(8),
  validationPlan: z.array(z.string().min(1).max(400)).min(1).max(8),
  safeAutomaticAction: z.enum(['none', 'retry_read_only_check', 'refresh_cached_version']),
  requiresHumanApproval: z.boolean(),
  summary: z.string().min(1).max(700),
});

function clean(value = '', limit = 700) {
  return String(value ?? '')
    .replace(/\b(?:sk|sk-proj|sk-ant|xai)-[A-Za-z0-9_-]{10,}\b/gi, '[ukryty token]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*/gi, 'Bearer [ukryty]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function inputFor(item = {}, context = {}) {
  return {
    diagnostic: {
      id: clean(item.id, 80),
      fingerprint: clean(item.fingerprint, 80),
      level: clean(item.level, 30),
      message: clean(item.message),
      source: clean(item.source, 180),
      route: clean(item.route, 300),
      release: clean(item.release, 100),
      kind: clean(item.kind, 60),
      occurrences: Math.max(1, Number(item.count) || 1),
      firstSeenAt: clean(item.firstSeenAt, 60),
      lastSeenAt: clean(item.lastSeenAt, 60),
    },
    correlatedEvents: (Array.isArray(context.correlatedEvents) ? context.correlatedEvents : [])
      .slice(0, 12)
      .map((event) => ({
        level: clean(event.level, 30),
        message: clean(event.message),
        source: clean(event.source, 180),
        route: clean(event.route, 300),
        at: clean(event.at || event.lastSeenAt, 60),
      })),
    environment: {
      release: clean(context.release || item.release, 100),
      service: 'Artway-TM VPS',
    },
  };
}

const INSTRUCTIONS = `
Jesteś głównym agentem diagnostycznym dużego sklepu Artway-TM działającego na VPS.
Analizujesz wyłącznie przekazane, zanonimizowane dowody. Nie zgadujesz i nie twierdzisz,
że błąd został naprawiony, jeśli nie ma wyniku ponownego testu.

Obowiązkowo:
1. Rozdziel przyczynę od objawu i wskaż dowody.
2. Wykryj konflikt wersji, stary cache, błąd aplikacji, konfigurację, integrację zewnętrzną
   albo problem przejściowy. Gdy danych brakuje, wybierz unknown i obniż confidence.
3. Zaproponuj najmniejszą bezpieczną naprawę oraz osobny plan weryfikacji.
4. automatic=true wolno ustawić tylko dla odczytu, ponowienia bezpiecznego testu lub
   odświeżenia numeru wersji cache. Nigdy dla płatności, zamówień, stanów, wiadomości,
   publikacji ofert, usuwania danych, zmiany kodu lub sekretów.
5. Nie ujawniaj ani nie żądaj kluczy, tokenów, haseł i danych osobowych.
6. Pisz konkretnie i po polsku. Wynik ma służyć operatorowi i koordynatorowi Codex.

Kolejność diagnozy:
A. Potwierdź, czy komunikat opisuje skutek w przeglądarce, błąd serwera, konflikt danych
   czy odpowiedź zewnętrznego API. Nie zmieniaj klasy tylko dlatego, że komunikat brzmi groźnie.
B. Połącz zdarzenia wyłącznie po wspólnym źródle, trasie, wersji wydania lub identycznym
   odcisku. Zbieżny czas bez wspólnego dowodu nie oznacza jednej przyczyny.
C. W evidence wymień konkretne komunikaty, liczniki, wersje i statusy HTTP. Każdy dowód
   ma pochodzić z wejścia. Nie wpisuj założeń jako dowodów.
D. W rootCause opisz najbardziej prawdopodobny mechanizm techniczny. Jeżeli istnieją dwie
   równorzędne hipotezy, wybierz unknown, opisz rozdzielający je test i obniż confidence.
E. recommendedActions uporządkuj od najbezpieczniejszego odczytu do ewentualnej zmiany.
   Nie zalecaj restartu jako pierwszego kroku, jeżeli nie ma dowodu na problem procesu.
F. validationPlan musi potwierdzać rezultat z punktu widzenia użytkownika i serwera:
   ponowny odczyt, stan trwałego zapisu, właściwa wersja wydania oraz brak nawrotu.

Wzorce:
- „Serwer ma nowszą rewizję, zapis zostanie ponowiony” występujące wielokrotnie:
  data_conflict. Najpierw odczytaj bieżącą rewizję i sprawdź idempotencję; nie czyść danych.
- „Unexpected token” tylko na starej wersji pliku po wydaniu:
  stale_client. Porównaj identyfikator wydania i cache; nie poprawiaj danych produktów.
- HTTP 401 z ShipX, Allegro, inFakt lub Paynow:
  external_integration. Sprawdź wyłącznie stan konfiguracji i odpowiedź API; nie proś o sekret
  w treści diagnozy i nie oznaczaj integracji jako naprawionej bez testu autoryzowanego.
- HTTP 429 albo 5xx jednorazowo:
  transient lub external_integration zależnie od źródła. Zaplanuj ograniczone ponowienie
  z tym samym identyfikatorem operacji; nie twórz duplikatu.
- Dane zapisane, ale odczyt zwraca poprzednią wartość:
  odróżnij data_conflict, niespójny cache i błąd potwierdzenia zapisu. Dowodem rozstrzygającym
  jest odczyt kanonicznego rekordu po identyfikatorze mutacji.

Warunki zakończenia:
- Nie ustawiaj requiresHumanApproval=false dla operacji zmieniającej dane lub zewnętrzny system.
- Nie ustawiaj safeAutomaticAction innego niż none, jeżeli działanie może zmienić stan biznesowy.
- Nie powtarzaj tych samych zaleceń innymi słowami.
- Nie twierdź „naprawiono”, „wdrożono” ani „działa”, dopóki nie dostaniesz wyniku testu po zmianie.
`.trim();

export function createDiagnosticAgentWorkflow({
  apiKey = process.env.OPENAI_API_KEY,
  env = process.env,
  runAgent = run,
  now = () => new Date(),
} = {}) {
  const routinePolicy = diagnosticsModelPolicy(env);
  const escalationPolicy = diagnosticsModelPolicy(env, { escalation: true });

  function status() {
    return {
      configured: Boolean(String(apiKey || '').trim()),
      sdk: '@openai/agents',
      workflow: 'artway-system-diagnostics',
      model: routinePolicy.model,
      reasoning: routinePolicy.reasoning,
      mode: routinePolicy.mode,
      routine: routinePolicy,
      escalation: escalationPolicy,
      escalationRule: 'manual-or-repeated-critical-only',
      instructionCharacters: INSTRUCTIONS.length,
      tracing: true,
    };
  }

  async function analyze(item = {}, context = {}) {
    if (!status().configured) throw Object.assign(new Error('Brakuje konfiguracji OpenAI dla agenta diagnostycznego.'), { code: 'openai_not_configured', status: 503 });
    const escalated = context?.deep === true || context?.manual === true || (item?.level === 'blad' && Number(item?.count || 0) >= 5);
    const policy = escalated ? escalationPolicy : routinePolicy;
    const agent = new Agent({
      name: 'Artway — główny diagnosta',
      instructions: INSTRUCTIONS,
      model: policy.model,
      modelSettings: {
        reasoning: { effort: policy.reasoning, mode: policy.mode, summary: 'detailed' },
        text: { verbosity: 'medium' },
        maxTokens: policy.maxOutputTokens,
        store: false,
        retry: { maxRetries: 2 },
      },
      outputType: DiagnosticResult,
    });
    const result = await runAgent(agent, JSON.stringify(inputFor(item, context)), {
      workflowName: 'Artway — diagnostyka systemu',
      groupId: clean(item.fingerprint || item.id, 80) || undefined,
      traceMetadata: {
        diagnostic_id: clean(item.id, 80),
        release: clean(item.release, 100),
        source: clean(item.source, 100),
      },
      traceIncludeSensitiveData: false,
      maxTurns: 4,
    });
    if (!result?.finalOutput) throw Object.assign(new Error('Agent diagnostyczny nie zwrócił wyniku strukturalnego.'), { code: 'diagnostic_agent_empty_result', status: 502 });
    return {
      ...result.finalOutput,
      model: policy.model,
      reasoning: policy.reasoning,
      mode: policy.mode,
      escalation: escalated,
      analyzedAt: now().toISOString(),
    };
  }

  return Object.freeze({ analyze, status, schema: DiagnosticResult });
}
