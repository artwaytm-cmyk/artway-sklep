import test from 'node:test';
import assert from 'node:assert/strict';
import {
  infaktKsefPozycje,
  infaktKsefNumerZTekstu,
  infaktMigawkaCenyZakupu,
  infaktNormalizujDokumentKosztowy,
  infaktParametryListyKsef,
  infaktPrzygotujCofniecieDopasowania,
  ustawieniaPubliczneBezDanychPrywatnych,
} from '../src/backend/lib/infakt-purchase.mjs';

test('lista KSeF zawsze wysyła pełny zakres dat i bezpieczny limit API', () => {
  const parameters = infaktParametryListyKsef({
    days: 30,
    limit: 100,
    offset: -5,
    now: new Date('2026-07-13T12:00:00.000Z'),
  });
  assert.deepEqual(parameters, {
    offset: 0,
    limit: 20,
    order: 'Asc',
    'q[invoice_date_gteq]': '2026-06-13',
    'q[invoice_date_lteq]': '2026-07-13',
  });
});

test('dokument kosztowy rozpoznaje różne warianty pól dostawcy', () => {
  const document = infaktNormalizujDokumentKosztowy({
    documentUuid: 'cost-1',
    invoiceNumber: 'FV/7/2026',
    supplier: { company_name: 'Alexander', nip: '589-143-97-27' },
    invoiceDate: '2026-06-30',
    grossPrice: 82277,
    netPrice: 66892,
  });
  assert.equal(document.uuid, 'cost-1');
  assert.equal(document.number, 'FV/7/2026');
  assert.equal(document.seller_name, 'Alexander');
  assert.equal(document.seller_tax_code, '5891439727');
  assert.equal(document.issue_date, '2026-06-30');
  assert.equal(document.gross_price, 82277);
});

test('numer KSeF jest odczytywany z nazwy załącznika już zapisanego kosztu', () => {
  const number = infaktKsefNumerZTekstu({ attachments: [{ file_name: 'ksef_5891439727-20260630-619677C00010-E520260630-50.pdf' }] });
  assert.equal(number, '5891439727-20260630-619677C00010-E5');
});

test('KSeF wylicza cenę jednej sztuki z wartości wiersza po rabacie', () => {
  const [row] = infaktKsefPozycje('<Faktura><KodWaluty>PLN</KodWaluty><FaWiersz><P_7>Gra 5901234123457</P_7><P_8B>2</P_8B><P_9A>100</P_9A><P_11>180</P_11><P_12>23</P_12></FaWiersz></Faktura>');
  assert.equal(row.unitNet, 90);
  assert.equal(row.unitGross, 110.7);
  assert.equal(row.ean, '5901234123457');
});

test('KSeF łączy GTIN z dodatkowego opisu z właściwym wierszem faktury', () => {
  const [row] = infaktKsefPozycje('<Faktura><Fa><KodWaluty>PLN</KodWaluty><FaWiersz><NrWierszaFa>7</NrWierszaFa><P_7>Gra</P_7><P_8B>2</P_8B><P_9A>10</P_9A><P_11>20</P_11><P_12>23</P_12></FaWiersz><DodatkowyOpis><NrWiersza>7</NrWiersza><Klucz>GTIN</Klucz><Wartosc>5901234123457</Wartosc></DodatkowyOpis></Fa></Faktura>');
  assert.equal(row.row, 7);
  assert.equal(row.ean, '5901234123457');
});

test('cena zakupu i jej historia nie trafiają do publicznego katalogu', () => {
  const result = ustawieniaPubliczneBezDanychPrywatnych({
    artway_produkty_dodane: [{ id: '1', nazwa: 'Gra', cena: 50, cenaZakupu: 20, cenaZakupuHistoria: [{ price: 20 }] }],
  });
  assert.equal(result.artway_produkty_dodane[0].cena, 50);
  assert.equal('cenaZakupu' in result.artway_produkty_dodane[0], false);
  assert.equal('cenaZakupuHistoria' in result.artway_produkty_dodane[0], false);
});

test('błędne dopasowanie faktury można cofnąć do dokładnej poprzedniej ceny', () => {
  const before = { cenaZakupu: 18.5, cenaZakupuNetto: 15.04, cenaZakupuDokument: 'FV/1', cenaZakupuDataDokumentu: '2026-06-01', cenaZakupuHistoria: [{ price: 18.5, net: 15.04, document: 'FV/1', date: '2026-06-01' }] };
  const product = { ...before, cenaZakupu: 30, cenaZakupuNetto: 24.39, cenaZakupuDokument: 'FV/2', cenaZakupuDataDokumentu: '2026-07-01' };
  const rollback = infaktPrzygotujCofniecieDopasowania(product, { price: 30, invoiceNumber: 'FV/2', invoiceDate: '2026-07-01', beforeFields: infaktMigawkaCenyZakupu(before) });
  assert.equal(rollback.ok, true);
  assert.equal(rollback.fields.cenaZakupu, 18.5);
  assert.equal(rollback.fields.cenaZakupuDokument, 'FV/1');
});

test('cofnięcie starego dopasowania nie nadpisuje nowszej ceny', () => {
  const rollback = infaktPrzygotujCofniecieDopasowania({ cenaZakupu: 40, cenaZakupuDokument: 'FV/3', cenaZakupuDataDokumentu: '2026-07-10' }, { price: 30, invoiceNumber: 'FV/2', invoiceDate: '2026-07-01' });
  assert.equal(rollback.ok, false);
  assert.equal(rollback.conflict, true);
});
