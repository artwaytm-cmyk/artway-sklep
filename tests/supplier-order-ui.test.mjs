import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await Promise.all([
  '10-agent-ai.js',
  '10-agent-ai-supplier-planning.js',
  '10-agent-ai-command-center.js',
  '10-agent-ai-admin-workspace.js',
  '10-agent-ai-communications-workspace.js',
].map((file)=>readFile(new URL(`../src/frontend/${file}`, import.meta.url), 'utf8')))).join('\n');
const routerSource = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
const cloudSource = await readFile(new URL('../src/frontend/03-cloud-sync.js', import.meta.url), 'utf8');
const shippingSource = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
const ordersSource = (await Promise.all([
  '11-allegro-procurement-actions.js',
  '11-allegro-and-orders.js',
  '11-allegro-product-publication.js',
  '11-allegro-operations.js',
  '11-allegro-communications.js',
  '11-allegro-workspace.js',
  '11-store-orders.js',
].map((file)=>readFile(new URL(`../src/frontend/${file}`, import.meta.url), 'utf8')))).join('\n');
const inventorySource = (await Promise.all([
  '12-customers-and-inventory.js',
  '12-infakt-admin.js',
  '12-warehouse-views.js',
  '12-product-editor.js',
].map((file)=>readFile(new URL(`../src/frontend/${file}`, import.meta.url), 'utf8')))).join('\n');
const storeSource = (await Promise.all([
  readFile(new URL('../src/backend/lib/store-app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/backend/lib/email-route.mjs', import.meta.url), 'utf8'),
])).join('\n');
const supplierRouteSource = await readFile(new URL('../src/backend/lib/supplier-order-route.mjs', import.meta.url), 'utf8');
const storePlanSource = `${storeSource}\n${supplierRouteSource}`;

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
this.api={czyEAN,kodOperacyjnyProduktu,agentAIDostawcaProduktu,agentAIKodPozycjiProducenta,agentAIIdentyfikatorOptimaPozycji,agentAIPrzygotujOptimaZlecenie};`, context);
  return context.api;
}

test('tabela i Optima rozdzielają kod czytelny od kodu TOWAR dostawcy', () => {
  const { agentAIPrzygotujOptimaZlecenie, agentAIIdentyfikatorOptimaPozycji, agentAIKodPozycjiProducenta } = supplierHelpers();
  const result = agentAIPrzygotujOptimaZlecenie([
    { produktId: '1', externalId: 'EXT-A', sku: 'SKU-A', ean: '5901234123457', kodProducenta: 'A-1', nazwa: 'Gra A', ilosc: 2 },
    { produktId: '2', nazwa: 'Gra B', ilosc: 3 },
    { produktId: '3', ean: '5901234123457', nazwa: 'Gra C', ilosc: 1 },
    { produktId: '4', nazwa: 'Bez kodu', ilosc: 1 },
  ], (id) => id === '2' ? { sku: 'B-SKU', kodProducenta: 'B-7' } : {});
  assert.equal(result.tresc, 'A-1;2;\r\nB-7;3;\r\n5901234123457;1;');
  assert.equal(result.wiersze[0].typ, 'kod producenta');
  assert.equal(result.wiersze[1].typ, 'kod producenta');
  assert.equal(result.wiersze[2].typ, 'EAN');
  assert.deepEqual(Array.from(result.braki, (item) => item.nazwa), ['Bez kodu']);
  assert.doesNotMatch(result.tresc, /TOWAR|ILOŚĆ|CENA|\d+[.,]\d{2}/i);
  const invalid = agentAIPrzygotujOptimaZlecenie([{ produktId: '4', ean: '5901234123458', kodProducenta: 'FALLBACK-4', nazwa: 'Błędny EAN', ilosc: 1 }], () => ({}));
  assert.equal(invalid.tresc, 'FALLBACK-4;1;');
  const ambiguous = agentAIPrzygotujOptimaZlecenie([{ produktId: '5', kodProducenta: '2387 lub SL2871', nazwa: 'Kod niejednoznaczny', ilosc: 1 }], () => ({}));
  assert.equal(ambiguous.tresc, '');
  assert.deepEqual(Array.from(ambiguous.braki, (item) => item.nazwa), ['Kod niejednoznaczny']);
  assert.deepEqual(
    { ...agentAIIdentyfikatorOptimaPozycji({ produktId: '77', ean: '5901234123457', kodDostawcy: 'SUP-77' }, {}) },
    { wartosc: 'SUP-77', typ: 'kod dostawcy' },
  );
  assert.deepEqual(
    { ...agentAIIdentyfikatorOptimaPozycji({ produktId: '77', ean: '5901234123458', kodDostawcy: 'SUP-77', kodKatalogowy: 'CAT-77', kod: 'LEG-77' }, {}) },
    { wartosc: 'SUP-77', typ: 'kod dostawcy' },
  );
  assert.deepEqual(
    { ...agentAIIdentyfikatorOptimaPozycji({ id: '77', produktId: '77', externalId: '77', sku: '77', kodProducenta: '77', kod: '77' }, { id: '77' }) },
    { wartosc: '77', typ: 'kod producenta' },
  );
  assert.deepEqual(
    { ...agentAIIdentyfikatorOptimaPozycji({ produktId: '77', sku: '77' }, { id: '77' }) },
    { wartosc: '', typ: '' },
  );
  assert.deepEqual(
    { ...agentAIIdentyfikatorOptimaPozycji({ produktId: '77', kodProducenta: '77' }, { id: '77' }) },
    { wartosc: '77', typ: 'kod producenta' },
  );
  assert.deepEqual(
    { ...agentAIIdentyfikatorOptimaPozycji({ produktId: '77', kod: '77', ean: '5901234123457' }, { id: '77' }) },
    { wartosc: '5901234123457', typ: 'EAN' },
  );
  assert.deepEqual(
    { ...agentAIIdentyfikatorOptimaPozycji({ id: '77', produktId: '77', kod: '77' }, { id: '77' }) },
    { wartosc: '', typ: '' },
  );
  const wspolna = { produktId: '9', externalId: 'EXT-9', ean: '5901234123457', kodDostawcy: 'SUP-9' };
  assert.equal(agentAIKodPozycjiProducenta(wspolna, {}), 'EXT-9');
  assert.equal(agentAIIdentyfikatorOptimaPozycji(wspolna, {}).wartosc, 'SUP-9');
  assert.match(fragment('function agentAIZlecenieTabelaDostawcyHTML', 'function agentAIEtapyZleceniaProducenta'), /agentAIStabilnyIdentyfikatorPozycji\(p,produkt\)/);
  const shortageTable = fragment('function magazynBrakiDostawcyHTML', 'function magazynTabelaOperacyjnaHTML');
  assert.match(shortageTable, /agentAIStabilnyIdentyfikatorPozycji\(x,produktMagazynowy\(x\.produktId\)/);
  assert.doesNotMatch(shortageTable, /x\.kod\|\|x\.produktId|<small>ID /);
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
  const csv = fragment('function agentAIPobierzZlecenieCSV', 'function agentAIEanPoprawny');
  const email = fragment('function agentAIEmailProducentaHTML', 'function agentAIPodgladEmailaProducenta');
  assert.match(csv, /\["kod","nazwa","zamawiana_ilosc"\]/);
  assert.doesNotMatch(csv, /"ean"/i);
  assert.doesNotMatch(csv, /cena_brutto|wartosc_szacowana|cenaZakupu/);
  assert.match(email, /<th>Kod produktu<\/th><th>Nazwa<\/th><th>Zamawiana ilość<\/th>/);
  assert.doesNotMatch(email, /EAN<\/th>|Cena|Wartość|cenaBrutto|wartoscSzacowana/);
  const supplierPanel = fragment('function agentAIZlecenieTabelaDostawcyHTML', 'function agentAIEtapyZleceniaProducenta');
  assert.doesNotMatch(supplierPanel, /cenaBrutto|wartoscSzacowana|zl\(/);
  const sendPayload = fragment('async function agentAIWyslijZlecenieEmail', 'async function agentAIPrzyjmijPozycjeZlecenia');
  assert.match(sendPayload, /body:\{order:\{id:z\.id,revision\},suppliers:/);
  assert.doesNotMatch(sendPayload, /body:\{order:z/);
  const producerForm = fragment('function producentDaneZFormularza', 'function producenciKartotekaPanelHTML');
  assert.doesNotMatch(producerForm, /name="emailSubject"|name="emailIntro"/);
  assert.match(producerForm, /Stały bezpieczny szablon e-maila/);
  const recipientPayload = fragment('function agentAIDaneProducentaDoEmaila', 'async function agentAIWyslijZlecenieEmail');
  assert.match(recipientPayload, /return \{name:p\.name\|\|p\.nazwa\|\|""\}/);
  assert.doesNotMatch(recipientPayload, /orderEmail|emailSubject|emailIntro/);
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

test('wysłany dokument ma kontrolowane ponowienie, korektę i czytelny audyt', () => {
  const recovery = fragment('async function agentAIPrzygotujKorekteZlecenia', 'function agentAIPobierzZlecenieCSV');
  const send = fragment('async function agentAIWyslijZlecenieEmail', 'async function agentAIPrzyjmijPozycjeZlecenia');
  const card = fragment('function agentAIHistoriaEmailiProducentaHTML', 'function agentAIZleceniaPanelHTML');
  assert.match(recovery, /supplier-order-correction/);
  assert.match(recovery, /Poprzedniego dostarczonego e-maila nie da się usunąć/);
  assert.match(recovery, /agentAIPonowEmailProducenta/);
  assert.match(send, /forceResend/);
  assert.match(send, /resendReason/);
  assert.match(send, /OSTATECZNE POTWIERDZENIE PONOWNEJ WYSYŁKI/);
  assert.match(card, /Historia wysyłek i korekt/);
  assert.match(card, /Wyślij ponownie/);
  assert.match(card, /Utwórz korektę/);
  assert.match(storeSource, /forceResend/);
  assert.match(storeSource, /attempts: \[\.\.\.\(Array\.isArray\(previousAudit\.attempts\)/);
  assert.match(storePlanSource, /supplier-order-correction/);
});

test('zamówienia Allegro mają jednostkowe i masowe tworzenie Planu producentów', () => {
  assert.match(ordersSource, /function allegroUtworzZamowienieProducenta/);
  assert.match(ordersSource, /supplier-order-from-allegro/);
  assert.match(ordersSource, /Dodaj brak do Planu/);
  assert.match(ordersSource, /Utwórz\/aktualizuj plany producentów/);
  assert.match(ordersSource, /Utwórz.*zamówienie producenta/);
  assert.match(storePlanSource, /action !== 'supplier-order-from-allegro'/);
  assert.match(storePlanSource, /recalculateAllegroOrders\(\)/);
  assert.match(storePlanSource, /relatedDrafts/);
  assert.match(storePlanSource, /supplierMatchVerified === true/);
});

test('panel pokazuje cały proces aż do przyjęcia dostawy', () => {
  const steps = fragment('function agentAIEtapyZleceniaProducenta', 'function agentAIEtapyZleceniaHTML');
  for (const label of ['Stan magazynowy', 'Szkic producenta', 'Zatwierdzenie', 'Zamówienie wysłane', 'Dostawa', 'Oczekuje na wysyłkę']) assert.match(steps, new RegExp(label));
  assert.doesNotMatch(steps, /Telegram/);
});

test('plan używa serwerowych akcji rewizji i nie wysyła bez osobnego potwierdzenia', () => {
  const manual = fragment('function agentAIPlanZapiszOdpowiedzSerwera', 'function agentAIZlecenieTabelaDostawcyHTML');
  const quantity = fragment('function agentAIPowiekszPozycjeZlecenia', 'async function agentAIWyslijZlecenieTelegram');
  const receive = fragment('async function agentAIPrzyjmijPozycjeZlecenia', 'function agentAINadwyzkiDoPrzyjecia');
  assert.match(manual, /supplier-order-line-upsert/);
  assert.match(quantity, /supplier-order-line-upsert/);
  assert.match(source, /supplier-order-approve/);
  assert.match(receive, /supplier-order-document-receive/);
  assert.match(source, /function agentAIPrzyjecieDokumentuHTML/);
  assert.match(source, /Dostawa różni się od zamówienia/);
  assert.match(receive, /expectedReceiptRevision/);
  assert.match(receive, /if\(!confirm\(/);
});

test('e-mail i eksport pokazują instrukcję Optimy tylko dla Alexander i Multigra', () => {
  const preview = fragment('function agentAIEmailProducentaHTML', 'function agentAIPodgladEmailaProducenta');
  const table = fragment('function agentAIZlecenieTabelaDostawcyHTML', 'function agentAIEtapyZleceniaProducenta');
  assert.match(preview, /Ogólne → Kolektor danych → Importuj pozycje/);
  assert.match(preview, /Pobieraj ceny z programu/);
  assert.match(preview, /includes\("alexander"\).*includes\("multigra"\)/s);
  assert.match(table, /Comarch Optima TXT/);
  assert.match(table, /TXT bez cen/);
  assert.doesNotMatch(table, /cenaBrutto|cenaZakupu|wartoscSzacowana|zl\(/);
  const download = fragment('function agentAIPobierzOptimaTXT', 'function agentAIPlanZapiszOdpowiedzSerwera');
  assert.doesNotMatch(download, /\\uFEFF/);
  assert.ok(download.indexOf('agentAIEksportZablokowanyPrzezBrakKodow') < download.indexOf('pobierzPlik('));
  const csvDownload = fragment('function agentAIPobierzZlecenieCSV', 'function agentAIEanPoprawny');
  assert.ok(csvDownload.indexOf('agentAIEksportZablokowanyPrzezBrakKodow') < csvDownload.indexOf('pobierzPlik('));
});

test('aktywne dokumenty wykluczają historię, zastąpione i puste szkice', () => {
  const context = {};
  vm.runInNewContext(`${fragment('function agentAIPlanDokumentAktywny', 'function agentAIPlanDokumentPasuje')}
this.active=agentAIPlanDokumentAktywny;`, context);
  const active = context.active;
  assert.equal(active({ status: 'szkic', pozycje: [{ ilosc: 2 }] }), true);
  assert.equal(active({ status: 'szkic', pozycje: [{ ilosc: 0, manualExtra: 2 }] }), true);
  assert.equal(active({ status: 'szkic', pozycje: [] }), false);
  assert.equal(active({ status: 'zastąpione', pozycje: [{ ilosc: 2 }] }), false);
  assert.equal(active({ status: 'superseded', pozycje: [{ ilosc: 2 }] }), false);
  assert.equal(active({ status: 'wyczyszczone', pozycje: [{ ilosc: 2 }] }), false);
  assert.equal(active({ status: 'cleared', pozycje: [{ ilosc: 2 }] }), false);
  assert.equal(active({ status: 'zrealizowane', pozycje: [{ ilosc: 2 }] }), false);
  assert.equal(active({ status: 'anulowane', pozycje: [{ ilosc: 2 }] }), false);
});

test('kanoniczny eksport Planu ma tylko stabilny kod, nazwę i ilość bez cen oraz local ID', () => {
  const context = { tylkoCyfry: (value) => String(value || '').replace(/\D/g, '') };
  vm.runInNewContext(`${fragment('function agentAIEanPoprawny', 'let agentAIModalPoprzedniFocus')}
${fragment('function agentAIPlanDokumentAktywny', 'function agentAIPlanDokumentPasuje')}
${fragment('function agentAIPlanWierszeEksportu', 'function eksportujTabeleOperacyjnaMagazynuCSV')}
this.exportRows=agentAIPlanWierszeEksportu;`, context);
  const rows = context.exportRows([
    { status: 'szkic', pozycje: [{ produktId: '101', externalId: 'EXT-101', nazwa: 'Gra A', ilosc: 2 }] },
    { status: 'zastąpione', pozycje: [{ produktId: '102', sku: 'SKU-OLD', nazwa: 'Stary szkic', ilosc: 9 }] },
    { status: 'szkic', pozycje: [] },
  ], [
    { produktId: '103', sku: 'SKU-103', nazwa: 'Gra B', pozostaloDoZamowienia: 3 },
    { produktId: '104', kodProducenta: '2387 lub SL2871', nazwa: 'Gra bez pewnego kodu', pozostaloDoZamowienia: 1 },
  ], () => ({}));
  assert.deepEqual(Array.from(rows, ({ kod, nazwa, ilosc }) => ({ kod, nazwa, ilosc })), [
    { kod: 'EXT-101', nazwa: 'Gra A', ilosc: 2 },
    { kod: 'SKU-103', nazwa: 'Gra B', ilosc: 3 },
    { kod: '', nazwa: 'Gra bez pewnego kodu', ilosc: 1 },
  ]);
  assert.equal(rows.some((row) => row.kod === '101' || row.kod === '102' || row.kod === '103' || row.kod === '104'), false);
  const exporter = fragment('function agentAIPlanWierszeEksportu', 'function magazynBrakiDostawcyHTML');
  assert.match(exporter, /\["kod","nazwa","ilosc"\]/);
  assert.match(exporter, /agentAIStabilnyIdentyfikatorPozycji/);
  assert.doesNotMatch(exporter, /cenaBrutto|cenaZakupu|wartoscSzacowana/);
  const plan = inventorySource.slice(inventorySource.indexOf('function magazynPlanZatowarowaniaHTML'), inventorySource.indexOf('function odswiezPlanZatowarowaniaWidoku'));
  assert.doesNotMatch(plan, /eksportujZatowarowanieCSV/);
  assert.equal((source.match(/onclick="eksportujTabeleOperacyjnaMagazynuCSV\(\)"/g) || []).length, 1);
});

test('eksport Planu z brakującym kodem jest blokowany przed utworzeniem pliku', () => {
  const downloads = [], modals = [];
  const context = {
    tylkoCyfry: (value) => String(value || '').replace(/\D/g, ''),
    agentAIZlecenia: [{ status: 'szkic', pozycje: [{ produktId: '55', kod: '55', nazwa: 'Produkt bez kodu', ilosc: 2 }] }],
    agentAIBrakiOperacyjne: () => [],
    produktMagazynowy: () => ({}),
    csvPole: (value) => String(value ?? ''),
    esc: (value) => String(value ?? ''),
    pobierzPlik: (...args) => downloads.push(args),
    agentAIOtworzModal: (...args) => modals.push(args),
    toast: () => {},
    zapiszHistorieAgenta: () => {},
  };
  vm.runInNewContext(`${fragment('function agentAIEanPoprawny', 'let agentAIModalPoprzedniFocus')}
${fragment('function agentAIPlanDokumentAktywny', 'function agentAIPlanDokumentPasuje')}
${fragment('function agentAIPlanWierszeEksportu', 'function magazynBrakiDostawcyHTML')}
this.runExport=eksportujTabeleOperacyjnaMagazynuCSV;`, context);
  assert.equal(context.runExport(), false);
  assert.equal(downloads.length, 0);
  assert.equal(modals.length, 1);
  assert.match(modals[0][0], /wymaga uzupełnienia kodów/);
  assert.match(modals[0][1], /Produkt bez kodu/);
});

test('Plan zatowarowania jest jedynym pełnym centrum dokumentów producentów', () => {
  assert.doesNotMatch(source, /#\/admin\/agent-ai\/zlecenia/);
  assert.doesNotMatch(ordersSource, /#\/admin\/agent-ai\/zlecenia/);
  assert.doesNotMatch(inventorySource, /#\/admin\/agent-ai\/zlecenia/);
  assert.doesNotMatch(`${source}\n${ordersSource}\n${inventorySource}`, /#\/admin\/zamowienia\/tabela/);
  assert.match(routerSource, /t==="\/admin\/agent-ai\/zlecenia"[\s\S]*?#\/admin\/magazyn\/plan/);
  assert.match(routerSource, /t==="\/admin\/zamowienia\/tabela"[\s\S]*?#\/admin\/magazyn\/plan/);
  assert.doesNotMatch(ordersSource, /magazynTabelaOperacyjnaHTML\s*\(/);
  const planFrom = inventorySource.indexOf('function magazynPlanZatowarowaniaHTML');
  const planTo = inventorySource.indexOf('function odswiezPlanZatowarowaniaWidoku', planFrom);
  assert.ok(planFrom >= 0 && planTo > planFrom);
  const plan = inventorySource.slice(planFrom, planTo);
  assert.equal((plan.match(/magazynTabelaOperacyjnaHTML\(\)/g) || []).length, 1);
  assert.equal((source.match(/magazynTabelaOperacyjnaHTML\s*\(/g) || []).length, 1, 'poza definicją nie może być drugiego renderu');
  assert.match(ordersSource, /href:"#\/admin\/magazyn\/plan",label:"📦 Plan zatowarowania"/);
});

test('uzgadnianie i anulowanie szkicu mają wyłącznie kanoniczne akcje serwerowe', () => {
  const reconcile = fragment('let agentAIPlanUzgadnianie', 'async function agentAIZatwierdzZlecenie');
  const cancel = fragment('async function agentAIUsunZlecenie', 'function agentAIPobierzZlecenieCSV');
  assert.match(reconcile, /chmura\("supplier-order-reconcile"/);
  assert.match(cancel, /chmura\("supplier-order-cancel"/);
  assert.match(cancel, /expectedRevision/);
  assert.doesNotMatch(source, /function agentAIUtworzZlecenieProducenta|function agentAIUtworzZleceniaWedlugDostawcow/);
  assert.doesNotMatch(source, /function agentAIZmienStatusZlecenia/);
  assert.doesNotMatch(source, /function (?:agentAIDaneZleceniaDoEmaila|agentAIZmienPozycjeZlecenia|wierszeOperacyjneMagazynu|akcjaWierszaOperacyjnegoHTML)/);
  assert.doesNotMatch(`${cloudSource}\n${shippingSource}`, /agentAIUtworzZleceniaWedlugDostawcow/);
  assert.doesNotMatch(reconcile, /agentAIPozycjeZleceniaProducenta|artway_agent_ai_zlecenia/);
});

test('wyszukiwanie Planu zachowuje focus i karetę bez pełnego renderu strony', () => {
  const search = fragment('function agentAIPlanSzukajDokumenty', 'function agentAIPlanKartaDokumentuHTML');
  const refreshFrom = inventorySource.indexOf('function odswiezPlanZatowarowaniaWidoku');
  const refreshTo = inventorySource.indexOf('function widokAdminMagazyn', refreshFrom);
  const refresh = inventorySource.slice(refreshFrom, refreshTo);
  assert.match(search, /odswiezPlanZatowarowaniaWidoku\(\)/);
  assert.doesNotMatch(search, /renderuj\(\)/);
  assert.match(refresh, /selectionStart/);
  assert.match(refresh, /setSelectionRange/);
  assert.match(refresh, /focus\(\{preventScroll:true\}\)/);
  assert.match(source, /id="supplierPlanSearch"/);
});
