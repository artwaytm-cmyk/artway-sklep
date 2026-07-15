import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/frontend/10-agent-ai.js', import.meta.url), 'utf8');

function fragment(start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Brak fragmentu ${start}`);
  return source.slice(from, to);
}

function supplierHelpers() {
  const context = {
    tylkoCyfry: (value) => String(value || '').replace(/\D/g, ''),
  };
  vm.runInNewContext(`${fragment('function czyEAN', 'function mapaZamowienDlaProduktow')}
${fragment('function agentAIDostawcaProduktu', 'function agentAIAktywneIlosciUProducentow')}
${fragment('function agentAIEanPoprawny', 'let agentAIModalPoprzedniFocus')}
this.api={czyEAN,kodOperacyjnyProduktu,agentAIDostawcaProduktu,agentAIIdentyfikatorOptimaPozycji,agentAIPrzygotujOptimaZlecenie};`, context);
  return context.api;
}

test('Optima otrzymuje EAN, potem kod producenta, zawsze z pustą ceną', () => {
  const { agentAIPrzygotujOptimaZlecenie } = supplierHelpers();
  const result = agentAIPrzygotujOptimaZlecenie([
    { produktId: '1', ean: '5901234123457', kodProducenta: 'A-1', nazwa: 'Gra A', ilosc: 2 },
    { produktId: '2', nazwa: 'Gra B', ilosc: 3 },
    { produktId: '3', nazwa: 'Bez kodu', ilosc: 1 },
  ], (id) => id === '2' ? { kodProducenta: 'B-7' } : {});
  assert.equal(result.tresc, '5901234123457;2;\r\nB-7;3;');
  assert.equal(result.wiersze[0].typ, 'EAN');
  assert.equal(result.wiersze[1].typ, 'kod producenta');
  assert.deepEqual(Array.from(result.braki, (item) => item.nazwa), ['Bez kodu']);
  assert.doesNotMatch(result.tresc, /TOWAR|ILOŚĆ|CENA|\d+[.,]\d{2}/i);
  const invalid = agentAIPrzygotujOptimaZlecenie([{ produktId: '4', ean: '5901234123458', kodProducenta: 'FALLBACK-4', nazwa: 'Błędny EAN', ilosc: 1 }], () => ({}));
  assert.equal(invalid.tresc, 'FALLBACK-4;1;');
});

test('kod operacyjny i dostawca mają bezpieczną kolejność bez wewnętrznego ID', () => {
  const { kodOperacyjnyProduktu, agentAIDostawcaProduktu } = supplierHelpers();
  assert.equal(kodOperacyjnyProduktu({ id: 77, kodProducenta: 'MP-1', externalId: 'EXT', sku: 'SKU' }, {}), 'MP-1');
  assert.equal(kodOperacyjnyProduktu({ id: 77, externalId: 'EXT', sku: 'SKU' }, {}), 'EXT');
  assert.equal(kodOperacyjnyProduktu({ id: 77 }, {}), '');
  assert.equal(agentAIDostawcaProduktu({ producent: 'Multigra', sourceUrl: 'https://alexander.test' }, { dostawca: 'Kartoteka' }), 'Kartoteka');
  assert.equal(agentAIDostawcaProduktu({ marka: 'Multigra' }, {}), 'Multigra');
  assert.equal(agentAIDostawcaProduktu({ sourceUrl: 'https://sklep.alexander.com.pl/p/1' }, {}), 'Alexander');
});

test('materiały dla producenta nie zawierają cen ani wartości', () => {
  const csv = fragment('function agentAIPobierzZlecenieCSV', 'function agentAIKodPozycjiProducenta');
  const email = fragment('function agentAIEmailProducentaHTML', 'function agentAIPodgladEmailaProducenta');
  assert.match(csv, /\["kod","nazwa","zamawiana_ilosc"\]/);
  assert.doesNotMatch(csv, /"ean"/i);
  assert.doesNotMatch(csv, /cena_brutto|wartosc_szacowana|cenaZakupu/);
  assert.match(email, /<th>Kod<\/th><th>Nazwa<\/th><th>Zamawiana ilość<\/th>/);
  assert.doesNotMatch(email, /EAN<\/th>|Cena|Wartość|cenaBrutto|wartoscSzacowana/);
  const supplierPanel = fragment('function agentAIZlecenieTabelaDostawcyHTML', 'function agentAIEtapyZleceniaProducenta');
  assert.doesNotMatch(supplierPanel, /cenaBrutto|wartoscSzacowana|zl\(/);
  const sendPayload = fragment('function agentAIDaneZleceniaDoEmaila', 'async function agentAIWyslijZlecenieEmail');
  assert.doesNotMatch(sendPayload, /cena|wartosc|lokalizacja|powod/i);
  assert.match(sendPayload, /kodProducenta/);
});

test('podgląd jest dialogiem z Escape, a wysyłka ma ostateczne potwierdzenie', () => {
  const modal = fragment('let agentAIModalPoprzedniFocus', 'function agentAIEmailProducentaHTML');
  const send = fragment('async function agentAIWyslijZlecenieEmail', 'function agentAIPrzyjmijPozycjeZlecenia');
  assert.match(modal, /setAttribute\("role","dialog"\)/);
  assert.match(modal, /setAttribute\("aria-modal","true"\)/);
  assert.match(modal, /e\.key==="Escape"/);
  assert.match(send, /OSTATECZNE POTWIERDZENIE WYSYŁKI/);
  assert.match(send, /if\(!confirm\(/);
  assert.ok(send.indexOf('if(!confirm(') < send.indexOf('chmura("email-send-supplier-order"'));
});

test('panel pokazuje cztery właściwe etapy procesu', () => {
  const steps = fragment('function agentAIEtapyZleceniaProducenta', 'function agentAIEtapyZleceniaHTML');
  for (const label of ['Stan magazynowy', 'Szkic producenta', 'Zatwierdzenie', 'Wysłanie']) assert.match(steps, new RegExp(label));
  assert.doesNotMatch(steps, /Telegram/);
});

test('uzgadnianie szkicu nie inkrementuje starej ilości', () => {
  const reconcile = fragment('function agentAIUtworzZlecenieProducenta', 'function agentAIUtworzZleceniaWedlugDostawcow');
  assert.match(reconcile, /baseRequired:potrzebna,manualExtra,nadwyzka:manualExtra,ilosc:potrzebna\+manualExtra/);
  assert.doesNotMatch(reconcile, /Number\(old\.ilosc\)[^\n]+Number\(item\.ilosc\)/);
  let required = 5;
  const context = {
    agentAIZlecenia: [{ id: 'D-1', supplier: 'Alexander', status: 'szkic', revision: 1, pozycje: [{ produktId: 'P-1', dostawca: 'Alexander', ilosc: 5, iloscPotrzebna: 5, manualExtra: 0, nadwyzka: 0 }] }],
    agentAIPozycjeZleceniaProducenta: () => [{ produktId: 'P-1', dostawca: 'Alexander', ilosc: required, iloscPotrzebna: required, nazwa: 'Gra' }],
    agentAIDostawcaZlecenia: (draft) => draft.supplier,
    agentAIStatusRoboczyProducenta: (status) => ['szkic', 'do sprawdzenia', 'zaakceptowane'].includes(status),
    agentAIPodsumujZlecenie: (draft) => ({ ...draft, sztuk: draft.pozycje.reduce((sum, item) => sum + item.ilosc, 0) }),
    zapiszLS: () => {}, zapiszHistorieAgenta: () => {}, sesja: { email: 'admin@test.pl' },
  };
  vm.runInNewContext(`${reconcile}\nthis.reconcile=agentAIUtworzZlecenieProducenta;`, context);
  assert.equal(context.reconcile('braki', { dostawca: 'Alexander' }), null);
  required = 7;
  assert.equal(context.reconcile('braki', { dostawca: 'Alexander' }).pozycje[0].ilosc, 7);
  assert.equal(context.agentAIZlecenia[0].pozycje[0].ilosc, 7);
  assert.equal(context.reconcile('braki', { dostawca: 'Alexander' }), null);
});
