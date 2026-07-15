import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildComarchOptimaTxt,
  renderSupplierOrderEmail,
  validGtin,
} from '../netlify/functions/lib/domain/supplier-order-email.mjs';

test('EAN/GTIN jest sprawdzany sumą kontrolną, a nie samą długością', () => {
  assert.equal(validGtin('5901234123457'), '5901234123457');
  assert.equal(validGtin('5901234123456'), '');
  assert.equal(validGtin('12345678'), '');
});

test('Alexander dostaje minimalną estetyczną wiadomość bez EAN w treści', () => {
  const mail = renderSupplierOrderEmail({
    id: 'AZ-1',
    numer: 'AZ/2026/07/0001',
    pozycje: [
      { dostawca: 'Alexander', kod: '1748', ean: '5901234123457', nazwa: 'Przeplatanki dla Chłopców', ilosc: 1, cenaBrutto: 12.5 },
      { dostawca: 'Multigra', kod: 'MG-1', nazwa: 'Inny produkt', ilosc: 4 },
    ],
  }, {
    name: 'Alexander',
    orderEmail: 'zamowienia@example.test',
    emailSubject: 'Zamówienie {numer} — Artway-TM',
    emailIntro: 'Ten konfigurowalny wstęp nie może trafić do minimalnego szablonu.',
  });

  assert.equal(mail.to, 'zamowienia@example.test');
  assert.equal(mail.rows.length, 1);
  assert.match(mail.text, /^Cześć,\n\nDzisiejsze zamówienie:/);
  assert.match(mail.text, /Kod \| Nazwa \| Zamawiana ilość/);
  assert.match(mail.text, /1748 \| Przeplatanki dla Chłopców \| 1/);
  assert.match(mail.text, /Pozdrowienia dla całej ekipy!\nArtway-TM$/);
  assert.doesNotMatch(mail.text, /EAN|5901234123457|potwierdzenie|termin realizacji/i);
  assert.match(mail.html, /<th[^>]*>Kod<\/th><th[^>]*>Nazwa<\/th><th[^>]*>Zamawiana ilość<\/th>/);
  assert.doesNotMatch(mail.html, /EAN|5901234123457|potwierdzenie|termin realizacji/i);
  assert.equal(mail.attachments.length, 1);
});

test('Multigra korzysta z tego samego minimalnego szablonu', () => {
  const mail = renderSupplierOrderEmail({
    id: 'AZ-2',
    pozycje: [{ dostawca: 'Multigra', kod: 'MG-17', nazwa: 'Gra testowa', ilosc: 2 }],
  }, { name: 'Multigra Sp. z o.o.', orderEmail: 'multigra@example.test' });

  assert.equal(mail.rows.length, 1);
  assert.match(mail.text, /MG-17 \| Gra testowa \| 2/);
  assert.equal(mail.optima.exportedRows, 1);
});

test('każdy producent ma stały bezcenowy szablon i oczyszczone pozycje', () => {
  const mail = renderSupplierOrderEmail({
    id: 'AZ-3',
    pozycje: [{
      dostawca: 'Godan', kod: 'GD-1', ean: '5901234123457', nazwa: 'Balony', ilosc: 3,
      cena: 9.99, cenaZakupu: 4.5, wartoscSzacowana: 29.97, marza: 20,
    }],
  }, {
    name: 'Godan',
    orderEmail: 'godan@example.test',
    emailSubject: 'Cena 9,99 zł',
    emailIntro: 'Wartość i marża nie mogą zostać wysłane.',
  });

  assert.equal(mail.subject, 'Zamówienie AZ-3 — Artway-TM');
  assert.match(mail.text, /GD-1 \| Balony \| 3/);
  assert.doesNotMatch(`${mail.subject}\n${mail.text}\n${mail.html}`, /9,99|wartość|marża|EAN|5901234123457/i);
  assert.deepEqual(Object.keys(mail.rows[0]).sort(), ['dostawca', 'ean', 'ilosc', 'kod', 'nazwa']);
  assert.equal(mail.attachments.length, 0, 'Optima jest dołączana automatycznie tylko dla Alexander i Multigra');
  assert.equal(mail.optima, null);
});

test('plik Optima ma wiersze TOWAR;ILOŚĆ;CENA bez nagłówka i preferuje poprawny EAN', () => {
  const optima = buildComarchOptimaTxt([
    { kod: 'IGNOROWANY-KOD', ean: '5901234123457', nazwa: 'Pierwszy', ilosc: 2, cenaBrutto: 12.5 },
    { kodProducenta: 'A-1748', ean: '5901234123456', nazwa: 'Drugi', ilosc: 1, cenaZakupu: 7.25 },
    { kod: '2387 lub SL2871', ean: '', nazwa: 'Do wyjaśnienia', ilosc: 2, cenaBrutto: 19 },
    { produktId: '123', kod: '123', ean: '', nazwa: 'Tylko wewnętrzne ID', ilosc: 1 },
  ], { orderNumber: 'AZ/2026/07/0001', supplierName: 'Alexander' });

  assert.equal(optima.header, false);
  assert.equal(optima.format, 'TOWAR;ILOŚĆ;CENA');
  assert.equal(optima.exportedRows, 2);
  assert.equal(optima.missingIdentifiers.length, 2);
  assert.equal(optima.missingIdentifiers[0].name, 'Do wyjaśnienia');
  assert.equal(optima.missingIdentifiers[1].name, 'Tylko wewnętrzne ID');
  assert.equal(optima.content, '\uFEFF5901234123457;2;\r\nA-1748;1;');
  assert.doesNotMatch(optima.content, /12,50|7,25|0,00/, 'żadna cena nie może trafić do dokumentu producenta');
  assert.doesNotMatch(optima.content, /TOWAR|ILOŚĆ|CENA/);
  assert.equal(optima.attachment.filename, optima.filename);
  assert.match(optima.filename, /^zamowienie-optima-alexander-/);
});

test('warstwa SMTP przekazuje rendererowi załączniki Nodemailer', async () => {
  const source = await readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8');
  assert.match(source, /async function wyslijEmailSMTP\(\{[^}]*attachments = \[\]/);
  assert.match(source, /transporter\.sendMail\(\{[\s\S]*?attachments: Array\.isArray\(attachments\)/);
  assert.match(source, /wyslijEmailSMTP\(\{[^}]*attachments: item\.attachments/);
  assert.match(source, /optimaComplete: optimaMissingIdentifiers\.length === 0/);
});
