import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadDecisionParser() {
  const source = await readFile(new URL('../src/frontend/10-agent-ai.js', import.meta.url), 'utf8');
  const start = source.indexOf('function agentAIParsujDecyzjeMagazynowa');
  const end = source.indexOf('\nfunction agentAIKluczIdentyfikatora', start);
  assert.ok(start >= 0 && end > start, 'Nie znaleziono parsera decyzji magazynowej.');
  const context = {};
  vm.runInNewContext(`${source.slice(start, end)}\nthis.parseDecision=agentAIParsujDecyzjeMagazynowa;`, context);
  return context.parseDecision;
}

test('panel wykonuje tylko ściśle zapisane decyzje, nigdy pytania, negacje ani odroczenia', async () => {
  const parse = await loadDecisionParser(), id = 'IVaaaaaaaaaaaaaa';
  assert.equal(parse(`potwierdzam ${id}`).action, 'confirm');
  assert.equal(parse(`nie potwierdzam ${id}`).action, 'reject');
  assert.deepEqual({ action: parse(`lokalizacja ${id} A-R01-P01`).action, location: parse(`lokalizacja ${id} A-R01-P01`).location }, { action: 'location', location: 'A-R01-P01' });
  for (const phrase of [
    `czy mam potwierdzić ${id}?`,
    `potwierdź ${id} później`,
    `nie zatwierdzaj ${id}`,
    `nie odrzucaj ${id}`,
    `przypomnij jutro, żebym potwierdził ${id}`,
    `klient napisał „potwierdzam ${id}”`,
  ]) assert.equal(parse(phrase), null, phrase);
});

test('mobilny układ decyzji znajduje się w później ładowanym arkuszu administracyjnym', async () => {
  const [admin, responsive] = await Promise.all([
    readFile(new URL('../src/styles/07-admin-domains.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/09-notifications-and-responsive.css', import.meta.url), 'utf8'),
  ]);
  assert.match(admin, /@media\(max-width:700px\)[\s\S]*\.agent-inventory-decision-facts\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(responsive, /\.agent-inventory-decision-facts\{grid-template-columns:1fr\}/);
});
