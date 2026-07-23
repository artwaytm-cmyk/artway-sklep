import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allegroCheckText,
  allegroEnforceDraft,
  allegroSanitizePlainText,
  allegroSecureOfferWrite,
} from '../src/backend/lib/allegro-compliance.mjs';

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

test('opis Allegro usuwa każdą informację logistyczną i pozostawia fakty o produkcie', () => {
  const examples = [
    'Wysyłka w 24 godziny.',
    'Dostawa kurierem InPost kosztuje 20 zł.',
    'Darmowa dostawa od 200 zł.',
    'Informacje o dostawie znajdziesz poniżej.',
    'Możliwy odbiór w paczkomacie.',
    'Przesyłkę nadamy jutro.',
    'Sprawdź koszty wysyłki i termin realizacji.',
  ];
  for (const text of examples) {
    const check = allegroCheckText(text);
    assert.equal(check.ok, false, text);
    assert.ok(check.violations.some((item) => item.id === 'delivery_information'), text);
  }
  const sanitized = allegroSanitizePlainText('Gra rozwija wyobraźnię. Wysyłka w czwartek. Zestaw zawiera 48 kart.');
  assert.equal(sanitized.check.ok, true);
  assert.match(sanitized.text, /Gra rozwija wyobraźnię/);
  assert.match(sanitized.text, /48 kart/);
  assert.doesNotMatch(sanitized.text, /wysyłk/i);
});

test('opis Allegro blokuje marketing, inne warianty i treści z innych sekcji oferty', () => {
  const examples = [
    'Idealny prezent i hit sprzedażowy w promocyjnej cenie.',
    'Pozostałe warianty oraz inne produkty znajdziesz w naszych ofertach.',
    'Produkt ma gwarancję, możliwość zwrotu i szybką reklamację.',
    'Towar pochodzi bezpośrednio od producenta.',
  ];
  for (const text of examples) assert.equal(allegroCheckText(text).ok, false, text);
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

test('centralna bramka usuwa dostawę także z aktualizacji istniejącej oferty', () => {
  const result = allegroSecureOfferWrite({
    path: '/sale/product-offers/987', method: 'PATCH', body: {
      name: 'Moje pierwsze origami statek Alexander',
      description: { sections: [{ items: [{ type: 'TEXT', content: '<h2>Origami dla dzieci</h2><p>Zestaw pozwala złożyć papierowy statek.</p><p>Wysyłka w 24 godziny kurierem InPost.</p>' }] }] },
    },
  });
  const description = JSON.stringify(result.body.description);
  assert.equal(result.checked, true);
  assert.equal(result.changed, true);
  assert.match(description, /papierowy statek/i);
  assert.doesNotMatch(description, /wysyłk|kurier|InPost/i);
  assert.ok(result.compliance.removed.some((item) => item.violations.some((violation) => violation.id === 'delivery_information')));
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
