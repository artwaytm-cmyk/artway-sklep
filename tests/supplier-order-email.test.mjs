import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildComarchOptimaTxt,
  renderSupplierOrderEmail,
  supplierProductIdentifier,
  validateSupplierOrderEmail,
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
      { dostawca: 'Alexander', kodProducenta: '1748', kod: '1748', ean: '5901234123457', nazwa: 'Przeplatanki dla Chłopców', ilosc: 1, cenaBrutto: 12.5 },
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
  assert.match(mail.text, /Identyfikator produktu \| Nazwa \| Zamawiana ilość/);
  assert.match(mail.text, /1748 \| Przeplatanki dla Chłopców \| 1/);
  assert.match(mail.text, /Otwórz dokument → Ogólne → Kolektor danych → Importuj pozycje/);
  assert.match(mail.text, /Pozdrowienia dla całej ekipy!\nArtway-TM$/);
  assert.doesNotMatch(mail.text, /EAN|5901234123457|potwierdzenie|termin realizacji/i);
  assert.match(mail.html, /<th[^>]*>Identyfikator produktu<\/th><th[^>]*>Nazwa<\/th><th[^>]*>Zamawiana ilość<\/th>/);
  assert.match(mail.html, /Otwórz dokument → Ogólne → Kolektor danych → Importuj pozycje/);
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
  assert.match(mail.text, /Otwórz dokument → Ogólne → Kolektor danych → Importuj pozycje/);
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
  assert.doesNotMatch(`${mail.subject}\n${mail.text}\n${mail.html}`, /9,99|wartość|marża|EAN/i);
  assert.deepEqual(Object.keys(mail.rows[0]).sort(), ['dostawca', 'ean', 'externalId', 'identifierSource', 'ilosc', 'kod', 'kodProducenta', 'nazwa', 'productId', 'sku']);
  assert.equal(mail.attachments.length, 0, 'Optima jest dołączana automatycznie tylko dla Alexander i Multigra');
  assert.equal(mail.optima, null);
});

test('identyfikator ma priorytet EXTERNAL_ID → SKU → kod producenta → jawny kod → EAN i nigdy nie używa samego lokalnego ID', () => {
  assert.deepEqual(supplierProductIdentifier({
    id: 91,
    externalId: 'EXT-0007',
    sku: 'SKU-0007',
    kodProducenta: 'MPN-0007',
    ean: '5901234123457',
  }), { value: 'EXT-0007', source: 'external_id' });
  assert.deepEqual(supplierProductIdentifier({
    productId: 92,
    sku: 'SKU-0008',
    kodProducenta: 'MPN-0008',
    ean: '5901234123457',
  }), { value: 'SKU-0008', source: 'sku' });
  assert.deepEqual(supplierProductIdentifier({
    produktId: 93,
    kodProducenta: 'MPN-0009',
    ean: '5901234123457',
  }), { value: 'MPN-0009', source: 'manufacturer_code' });
  assert.deepEqual(supplierProductIdentifier({
    produktId: 94,
    kod: '94',
    ean: '5901234123457',
  }), { value: '5901234123457', source: 'gtin' });
  assert.deepEqual(supplierProductIdentifier({ produktId: 'LOCAL-95', kod: 'LOCAL-95' }), { value: '', source: '' });
  assert.deepEqual(supplierProductIdentifier({
    productId: '18', externalId: '18', sku: '18', kodProducenta: '18', ean: '5901234123457',
  }), { value: '18', source: 'external_id' });
  assert.deepEqual(supplierProductIdentifier({
    productId: '5901234123457', externalId: '5901234123457', sku: '5901234123457',
    kodProducenta: '5901234123457', ean: '5901234123457', kod: '5901234123457',
  }), { value: '5901234123457', source: 'external_id' });
  assert.deepEqual(supplierProductIdentifier({ produktId: '96', sku: '96' }), { value: '96', source: 'sku' });
  assert.deepEqual(supplierProductIdentifier({ produktId: '97', kodProducenta: '97' }), { value: '97', source: 'manufacturer_code' });
});

test('tabela wiadomości i plik Optimy nigdy nie pokazują kodu równego lokalnemu productId', () => {
  const mail = renderSupplierOrderEmail({
    id: 'AZ-LOCAL-ID',
    pozycje: [{ produktId: '999', kod: '999', ean: '5901234123457', dostawca: 'Alexander', nazwa: 'Produkt z kodem lokalnym', ilosc: 2 }],
  }, { name: 'Alexander', orderEmail: 'alexander@example.test' });
  assert.equal(mail.rows[0].kod, '5901234123457');
  assert.equal(mail.rows[0].identifierSource, 'gtin');
  assert.match(mail.text, /5901234123457 \| Produkt z kodem lokalnym \| 2/);
  assert.doesNotMatch(mail.text, /(?:^|\n)999 \|/);
  assert.equal(mail.optima.content, '\uFEFF5901234123457;2;');
  const nested = renderSupplierOrderEmail({
    id: 'AZ-NESTED-LOCAL-ID',
    pozycje: [{ product: { id: 'N-77', kod: 'N-77' }, dostawca: 'Alexander', nazwa: 'Zagnieżdżony produkt', ilosc: 1 }],
  }, { name: 'Alexander', orderEmail: 'alexander@example.test' });
  assert.equal(nested.rows[0].kod, '—');
  assert.equal(nested.optima.exportedRows, 0);
  assert.equal(nested.validation.ok, false);
  assert.deepEqual(nested.validation.missingIdentifiers, ['Zagnieżdżony produkt']);
  assert.equal(validateSupplierOrderEmail(nested).ok, false);
  const sharedPriority = renderSupplierOrderEmail({
    id: 'AZ-SHARED-PRIORITY',
    pozycje: [{ produktId: '77', kod: 'KOD-X', ean: '5901234123457', dostawca: 'Alexander', nazwa: 'Wspólny kod', ilosc: 1 }],
  }, { name: 'Alexander', orderEmail: 'alexander@example.test' });
  assert.equal(sharedPriority.rows[0].kod, 'KOD-X');
  assert.equal(sharedPriority.rows[0].identifierSource, 'stable_code');
  assert.equal(sharedPriority.optima.content, '\uFEFFKOD-X;1;');
});

test('plik Optima ma wiersze TOWAR;ILOŚĆ;CENA bez nagłówka, według biznesowego identyfikatora', () => {
  const optima = buildComarchOptimaTxt([
    { kod: 'IGNOROWANY-KOD', ean: '5901234123457', nazwa: 'Pierwszy', ilosc: 2, cenaBrutto: 12.5 },
    { kodProducenta: 'A-1748', ean: '5901234123456', nazwa: 'Drugi', ilosc: 1, cenaZakupu: 7.25 },
    { externalId: 'EXT-10', sku: 'SKU-10', kodProducenta: 'MPN-10', ean: '5901234123457', nazwa: 'Trzeci', ilosc: 3, cena: 999 },
    { kod: '2387 lub SL2871', ean: '', nazwa: 'Do wyjaśnienia', ilosc: 2, cenaBrutto: 19 },
    { produktId: '123', kod: '123', ean: '', nazwa: 'Tylko wewnętrzne ID', ilosc: 1 },
  ], { orderNumber: 'AZ/2026/07/0001', supplierName: 'Alexander' });

  assert.equal(optima.header, false);
  assert.equal(optima.format, 'TOWAR;ILOŚĆ;CENA');
  assert.equal(optima.delimiter, ';');
  assert.deepEqual(optima.columns, ['TOWAR', 'ILOŚĆ', 'CENA']);
  assert.equal(optima.priceColumnEmpty, true);
  assert.equal(optima.importInstruction, 'Otwórz dokument → Ogólne → Kolektor danych → Importuj pozycje');
  assert.equal(optima.exportedRows, 3);
  assert.equal(optima.missingIdentifiers.length, 2);
  assert.equal(optima.missingIdentifiers[0].name, 'Do wyjaśnienia');
  assert.equal(optima.missingIdentifiers[1].name, 'Tylko wewnętrzne ID');
  assert.equal(optima.content, '\uFEFFIGNOROWANY-KOD;2;\r\nA-1748;1;\r\nEXT-10;3;');
  assert.doesNotMatch(optima.content, /12,50|7,25|999|0,00/, 'żadna cena nie może trafić do dokumentu producenta');
  assert.doesNotMatch(optima.content, /TOWAR|ILOŚĆ|CENA/);
  assert.equal(optima.attachment.filename, optima.filename);
  assert.match(optima.filename, /^zamowienie-optima-alexander-/);
});

test('wiadomość i załącznik zawierają wszystkie pozycje dużego szkicu bez cichego obcięcia', () => {
  const pozycje = Array.from({ length: 650 }, (_unused, index) => ({
    dostawca: 'Alexander', externalId: `EXT-${String(index + 1).padStart(4, '0')}`,
    nazwa: `Produkt ${index + 1}`, ilosc: 1,
  }));
  const mail = renderSupplierOrderEmail({ id: 'AZ-650', pozycje }, { name: 'Alexander', orderEmail: 'alexander@example.test' });
  assert.equal(mail.rows.length, 650);
  assert.equal(mail.validation.ok, true);
  assert.equal(mail.optima.exportedRows, 650);
  assert.equal(mail.optima.content.replace(/^\uFEFF/, '').split('\r\n').length, 650);
  assert.match(mail.text, /EXT-0650 \| Produkt 650 \| 1/);
  assert.match(mail.html, /EXT-0650/);
});

test('warstwa SMTP przekazuje rendererowi załączniki Nodemailer', async () => {
  const source = await readFile(new URL('../netlify/functions/lib/store-app.mjs', import.meta.url), 'utf8');
  assert.match(source, /async function wyslijEmailSMTP\(\{[^}]*attachments = \[\]/);
  assert.match(source, /transporter\.sendMail\(\{[\s\S]*?attachments: Array\.isArray\(attachments\)/);
  assert.match(source, /wyslijEmailSMTP\(\{[^}]*attachments: item\.attachments/);
  assert.match(source, /optimaComplete: optimaMissingIdentifiers\.length === 0/);
  assert.match(source, /requestedSupplierNames[\s\S]*?x\?\.name \|\| x\?\.nazwa/);
  assert.match(source, /const suppliers = currentPlan\.supplierContacts/);
  const flow = source.slice(source.indexOf("action === 'email-send-supplier-order'"), source.indexOf("action === 'send-email'"));
  assert.ok(flow.indexOf('!item.validation?.ok') >= 0);
  assert.ok(flow.indexOf('!item.validation?.ok') < flow.indexOf('wyslijEmailSMTP'), 'walidacja identyfikatorów musi zakończyć przepływ przed SMTP');
  assert.ok(flow.indexOf("code: 'supplier_validation'") < flow.indexOf('wyslijEmailSMTP'));
});
