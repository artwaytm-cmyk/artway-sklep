import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIALISTS } from '../src/backend/lib/domain/agent-specialist-definitions.mjs';
import { buildSpecialistInstructions } from '../src/backend/lib/domain/agent-specialist-instructions.mjs';
import { SPECIALIST_PLAYBOOK_VERSION, specialistPlaybookDetails } from '../src/backend/lib/domain/agent-specialist-playbooks.mjs';
import { diagnosticsModelPolicy, modelPolicySummary, specialistModelPolicy } from '../src/backend/lib/domain/agent-model-policy.mjs';
import { DIAGNOSTIC_AGENT_INSTRUCTIONS } from '../src/backend/lib/domain/diagnostic-agent-workflow.mjs';
import { AGENT_PANEL_INSTRUCTIONS } from '../src/backend/lib/domain/agent-panel-instructions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'docs/agents/openai-prompts-and-connections.md');
const platformPromptUrl = (profile = {}) => profile?.id
  ? `https://platform.openai.com/chat/edit?prompt=${encodeURIComponent(profile.id)}&version=${encodeURIComponent(profile.version || '1')}`
  : '';
const legacyAssistantUrl = (id = '') => id ? `https://platform.openai.com/assistants/${encodeURIComponent(id)}` : '';
const fence = (value = '') => `\`\`\`text\n${String(value).replaceAll('```', 'ˋˋˋ')}\n\`\`\``;

const policy = modelPolicySummary({ env: {} });
const rows = Object.entries(SPECIALISTS).map(([id, definition]) => {
  const model = specialistModelPolicy(id, { env: {} });
  const fallback = specialistModelPolicy(id, { env: {}, escalation: true });
  const platformProfile = definition.platformPrompt
    ? { ...definition.platformPrompt, name: definition.label }
    : null;
  const prompt = buildSpecialistInstructions({
    specialist: id,
    definition,
    promptVersion: SPECIALIST_PLAYBOOK_VERSION,
    platformProfile,
  });
  return { id, definition, model, fallback, platformProfile, prompt, details: specialistPlaybookDetails(id) };
});

const content = [
  '# Agenci Artway — prompty, modele i połączenia',
  '',
  `Wersja kanonicznych playbooków: \`${SPECIALIST_PLAYBOOK_VERSION}\`. Ten plik jest generowany przez \`npm run docs:agents\` bez sekretów.`,
  '',
  '## Co jest faktycznie podłączone',
  '',
  '- Specjaliści produktowi i operacyjni działają na VPS przez **Responses API**. Kanoniczny prompt jest wersjonowany w kodzie; zapisany prompt OpenAI Platform jest dodatkową referencją tam, gdzie istnieje.',
  '- Diagnostyka działa przez **OpenAI Agents SDK** i zapisuje bezpieczny trace bez sekretów.',
  '- Dawne identyfikatory `asst_*` są metadanymi zgodności i linkami do starszej powierzchni Assistants. Nie są procesem wykonawczym sklepu.',
  '- Agent Builder służy do graficznych workflow. Obecny system sklepu pozostaje kodowym workflow z wersjonowaniem, testami i trwałym zapisem.',
  '- Wszystkie codzienne zadania używają `gpt-5-nano`. Jedna próba `gpt-5.4-nano` jest dozwolona wyłącznie po niepoprawnym kontrakcie strukturalnym; `gpt-5.4-mini` nie działa automatycznie.',
  `- Bezpłatny tryb awaryjny: lokalny \`${policy.localFallback.model}\` przez Ollama, uruchamiany tylko przy braku środków/niedostępności API albo po nieskutecznej walidacji odpowiedzi.`,
  '- Brak AI nigdy nie jest udawanym sukcesem: deterministyczne reguły mogą zachować działanie strony, ale zapis/publikacja wymagają właściwego potwierdzenia backendu.',
  '',
  'Agent Builder: https://platform.openai.com/agent-builder',
  '',
  '## Routing',
  '',
  '| ID | Rola | Model codzienny | Rozumowanie | Fallback jakości | Prompt Platformy | Znaków instrukcji |',
  '|---|---|---|---|---|---|---:|',
  ...rows.map(({ id, definition, model, fallback, platformProfile, prompt }) => [
    `\`${id}\``,
    definition.label,
    `\`${model.model}\``,
    model.reasoning,
    `\`${fallback.model}\``,
    platformProfile ? `[otwórz v${platformProfile.version}](${platformPromptUrl(platformProfile)})` : 'serwerowy',
    prompt.length,
  ].join(' | ').replace(/^/, '| ').concat(' |')),
  '',
  '## Pełne prompty specjalistów',
  '',
  ...rows.flatMap(({ id, definition, model, fallback, platformProfile, prompt, details }) => [
    `### ${definition.icon} ${definition.label} (\`${id}\`)`,
    '',
    `Obszar: ${definition.area}. Pola wyniku: \`${definition.fields.join('`, `')}\`.`,
    '',
    `Zapis: ${definition.persistence}`,
    '',
    `Model: \`${model.model}\` (${model.reasoning}); fallback jakości: \`${fallback.model}\`.`,
    '',
    platformProfile ? `Zapisany prompt: [${platformProfile.id}, wersja ${platformProfile.version}](${platformPromptUrl(platformProfile)}).` : 'Ta rola nie ma osobnego zapisanego promptu w Platformie; obowiązuje wersja serwerowa poniżej.',
    '',
    definition.assistantId ? `Dawny profil Assistants: [${definition.assistantId}](${legacyAssistantUrl(definition.assistantId)}).` : 'Brak dawnego profilu Assistants.',
    '',
    `Scenariusz: \`${definition.scenario?.id || 'manual'}\`, wersja \`${definition.scenario?.version || SPECIALIST_PLAYBOOK_VERSION}\`. Sekcje kontraktu: ${Object.keys(details || {}).length}.`,
    '',
    fence(prompt),
    '',
  ]),
  '## Agent diagnostyczny Agents SDK',
  '',
  `Model codzienny: \`${diagnosticsModelPolicy({}).model}\`; kontrolowany fallback: \`${diagnosticsModelPolicy({}, { escalation: true }).model}\`.`,
  '',
  'Kod: `src/backend/lib/domain/diagnostic-agent-workflow.mjs`. Trace: OpenAI Platform → Dzienniki/Traces.',
  '',
  fence(DIAGNOSTIC_AGENT_INSTRUCTIONS),
  '',
  '## Agent poleceń panelu',
  '',
  'Kod: `scripts/run-agent-panel-worker.mjs`. Model codzienny: `gpt-5-nano`; bezpłatny fallback: Ollama.',
  '',
  fence(AGENT_PANEL_INSTRUCTIONS),
  '',
  '## Miejsca kanoniczne',
  '',
  '- Definicje i identyfikatory: `src/backend/lib/domain/agent-specialist-definitions.mjs`.',
  '- Pełne przypadki, błędy historyczne i przykłady: `src/backend/lib/domain/agent-specialist-playbooks.mjs`.',
  '- Dokładny skład promptu wysyłanego do modelu: `src/backend/lib/domain/agent-specialist-instructions.mjs`.',
  '- Routing i ceny: `src/backend/lib/domain/agent-model-policy.mjs`.',
  '- Wywołanie Responses API i bezpłatny fallback: `src/backend/lib/domain/agent-specialist-openai.mjs`.',
  '- Trwałe zapisy produktów: tabela PostgreSQL `artway_products` przez `saveProductFields`; model nigdy nie zapisuje jej bezpośrednio.',
  '',
  '## Zasada aktualizacji',
  '',
  'Po zmianie promptu należy zwiększyć `SPECIALIST_PLAYBOOK_VERSION`, uruchomić `npm run docs:agents`, testy oraz jedno atomowe wydanie. Dokument i kod muszą mieć tę samą wersję.',
  '',
].join('\n');

await writeFile(target, content, 'utf8');
process.stdout.write(`${target}\n`);
