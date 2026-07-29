import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkVonHalskyIdentity,
  createVonHalskySpecialistAgent,
  isVonHalskyTechnicalSentinel,
  requestVonHalskyAgentResponse,
} from '../src/backend/lib/domain/von-halsky-specialist-agent.mjs';
import {
  VON_HALSKY_AGENT_INSTRUCTIONS,
  VON_HALSKY_AGENT_VERSION,
} from '../src/backend/lib/domain/von-halsky-agent-instructions.mjs';

const goodOutput = {
  title: {
    value: '100 gier Alexander – rodzinny zestaw planszowy',
    reason: 'Naturalna nazwa zachowuje rozpoznawalny tytuł i rodzaj produktu.',
    evidence: 'Kartoteka: nazwa 100 Gier, producent Alexander.',
  },
  shortDescription: {
    value: 'Zestaw klasycznych gier planszowych przeznaczony do wspólnej zabawy dzieci i dorosłych.',
    reason: 'Krótko przedstawia rodzaj i przeznaczenie produktu.',
    evidence: 'Opis źródłowy i kategoria: gry rodzinne.',
  },
  description: {
    value: 'Rozbudowany zestaw gier rodzinnych zawiera różnorodne warianty rozgrywki oraz elementy potrzebne do wspólnej zabawy dzieci i dorosłych. Poszczególne warianty wspierają logiczne myślenie i zapewniają urozmaiconą rozgrywkę.',
    reason: 'Opis porządkuje wyłącznie potwierdzone cechy produktu.',
    evidence: 'Długi opis i parametry producenta.',
  },
  factsUsed: ['nazwa produktu', 'producent Alexander', 'rodzaj: gra rodzinna'],
  missingFacts: [],
  warnings: [],
  confidence: 0.95,
  complianceStatus: 'ready',
};

test('wyspecjalizowany Agent ma rozbudowaną instrukcję, narzędzia i typowany wynik', () => {
  const agent = createVonHalskySpecialistAgent();
  assert.match(agent.name, /Von Halsky/);
  assert.ok(VON_HALSKY_AGENT_INSTRUCTIONS.length > 6000);
  assert.match(VON_HALSKY_AGENT_INSTRUCTIONS, /check_von_halsky_identity/);
  assert.match(VON_HALSKY_AGENT_INSTRUCTIONS, /check_von_halsky_draft/);
  assert.match(VON_HALSKY_AGENT_INSTRUCTIONS, /Opis nie może być jedną ścianą tekstu/);
  assert.match(VON_HALSKY_AGENT_INSTRUCTIONS, /## Najważniejsze cechy/);
  assert.match(VON_HALSKY_AGENT_INSTRUCTIONS, /PRZYKŁAD BŁĘDNEJ JAKOŚCI/);
  assert.match(VON_HALSKY_AGENT_VERSION, /^2026-07-29/);
  assert.equal(agent.tools.length, 2);
  assert.ok(agent.outputType);
});

test('tożsamość wymaga prawidłowego GTIN albo kodu z nazwaną marką', () => {
  assert.equal(checkVonHalskyIdentity({ ean: '5906018003765', producer: 'Alexander' }).method, 'gtin');
  assert.equal(checkVonHalskyIdentity({ manufacturerCode: '0376', brand: 'Alexander' }).method, 'manufacturer_code_brand');
  assert.equal(checkVonHalskyIdentity({ manufacturerCode: '0376', brand: '12345' }).ok, false);
});

test('wartości techniczne nigdy nie są zapisywane jako treść produktu', () => {
  for (const value of ['', 'undefined', 'null', 'NaN', 'Infinity', '[object Object]', '{"title":"x"}']) {
    assert.equal(isVonHalskyTechnicalSentinel(value), true);
  }
  assert.equal(isVonHalskyTechnicalSentinel('Rodzinna gra planszowa Alexander'), false);
});

test('Agent SDK zwraca wynik zgodny z istniejącą atomową ścieżką zapisu', async () => {
  const input = JSON.stringify({
    fakty: {
      product: {
        id: '84',
        nazwa: '100 Gier - zestaw gier rodzinnych Alexander',
        opisKrotki: 'Zestaw klasycznych gier planszowych.',
        opis: 'Rozbudowany opis rodzinnego zestawu planszowego.',
        ean: '5906018003765',
        kodProducenta: '0376',
        producent: 'Alexander',
        marka: 'Alexander',
      },
    },
  });
  const result = await requestVonHalskyAgentResponse({
    input,
    runImpl: async () => ({
      finalOutput: goodOutput,
      lastResponseId: 'resp-vh-84',
      newItems: [],
      runContext: { usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180 } },
    }),
  });
  const payload = JSON.parse(result.payload.output_text);
  assert.equal(payload.fields.length, 3);
  assert.equal(payload.fields[0].key, 'von_halsky_title');
  assert.equal(payload.readyForApproval, true);
  assert.equal(result.agentRuntime.sdk, '@openai/agents');
  assert.equal(result.agentRuntime.output, 'zod-structured');
});
