import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroCheckText,
  allegroEnforceDraft,
  allegroSanitizePlainText,
} from '../netlify/functions/lib/allegro-compliance.mjs';

test('opis Allegro blokuje kontakt i sprzedaż poza serwisem', () => {
  const check = allegroCheckText('Przed zakupem napisz do nas: sklep@example.com');
  assert.equal(check.ok, false);
  assert.ok(check.violations.some((item) => item.id === 'before_purchase_contact'));
  assert.ok(check.violations.some((item) => item.id === 'email_address'));
});

test('sanityzacja zachowuje bezpieczny opis produktu', () => {
  const result = allegroSanitizePlainText('Gra rozwija wyobraźnię.\n\nZapraszamy do kontaktu przed zakupem.');
  assert.equal(result.check.ok, true);
  assert.match(result.text, /Gra rozwija wyobraźnię/);
  assert.doesNotMatch(result.text, /kontaktu/i);
});

test('szkic oferty zawsze dostaje bezpieczną sekcję tekstową', () => {
  const result = allegroEnforceDraft({ name: 'Gra testowa', description: { sections: [] } });
  assert.equal(result.compliance.ok, true);
  assert.match(JSON.stringify(result.draft.description), /Gra testowa/);
});
