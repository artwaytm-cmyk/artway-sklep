import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroCheckText,
  allegroEnforceDraft,
  allegroSanitizePlainText,
  allegroSecureOfferWrite,
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

test('blokada rozpoznaje szerokie warianty kontaktu przed zakupem', () => {
  const examples = [
    'Jeżeli masz pytania, skontaktuj się z nami przed dokonaniem zakupu.',
    'Przed złożeniem zamówienia prosimy o kontakt ze sprzedawcą.',
    'Masz jakieś pytania? Napisz nam wiadomość.',
    'Chętnie odpowiemy na pytania telefonicznie.',
    'Więcej produktów znajdziesz w naszym sklepie internetowym.',
    'Napisz przez Messenger albo WhatsApp.',
    'Płatność poza Allegro — przelew tradycyjny na numer konta.',
  ];
  for (const text of examples) assert.equal(allegroCheckText(text).ok, false, text);
  assert.equal(allegroCheckText('Gra zawiera 100 pytań i 4 pionki.').ok, true);
});

test('blokada rozpoznaje encje, komentarze i niewidoczne znaki', () => {
  const examples = [
    'Skontaktuj&nbsp;się przed zakupem.',
    'S&#x6b;ontaktuj się przed zakupem.',
    'Skon<!-- ukrycie -->taktuj się przed zakupem.',
    'Skon\u200btaktuj się przed zakupem.',
  ];
  for (const text of examples) assert.equal(allegroCheckText(text).ok, false, text);
});

test('centralna bramka oczyszcza każdy zapis opisu do API Allegro', () => {
  const body = {
    name: 'Gra leśna',
    description: {
      sections: [{ items: [{ type: 'TEXT', content: '<h2>Gra leśna</h2><p>Ćwiczy pamięć i spostrzegawczość.</p><p>Przed dokonaniem zakupu skontaktuj się z nami.</p>' }] }],
    },
  };
  const result = allegroSecureOfferWrite({ path: '/sale/product-offers/123', method: 'PATCH', body });
  assert.equal(result.checked, true);
  assert.equal(result.changed, true);
  assert.equal(result.compliance.ok, true);
  assert.match(JSON.stringify(result.body.description), /Ćwiczy pamięć/);
  assert.doesNotMatch(JSON.stringify(result.body.description), /kontakt|przed dokonaniem/iu);
});

test('centralna bramka nie pozwala utworzyć oferty bez kontrolowanego opisu', () => {
  assert.throws(
    () => allegroSecureOfferWrite({ path: '/sale/product-offers', method: 'POST', body: { name: 'Gra bez opisu' } }),
    (error) => error?.code === 'allegro_compliance_missing_description',
  );
  const stockOnly = allegroSecureOfferWrite({ path: '/sale/product-offers/123', method: 'PATCH', body: { stock: { available: 5 } } });
  assert.equal(stockOnly.checked, false);
  assert.deepEqual(stockOnly.body, { stock: { available: 5 } });
});
