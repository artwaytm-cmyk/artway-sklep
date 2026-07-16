import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, stat } from 'node:fs/promises';
import { ASSET_BUNDLES, VENDOR_ASSETS } from '../scripts/build-assets.mjs';

const source = await readFile(new URL('../src/frontend/10-warehouse-qr.js', import.meta.url), 'utf8');
const documents = await readFile(new URL('../src/frontend/10-warehouse-documents.js', import.meta.url), 'utf8');
const inventory = await readFile(new URL('../src/frontend/12-customers-and-inventory.js', import.meta.url), 'utf8');
const locations = await readFile(new URL('../src/frontend/10-warehouse-locations.js', import.meta.url), 'utf8');
const navigation = await readFile(new URL('../src/frontend/11-allegro-and-orders.js', import.meta.url), 'utf8');

function parse(value) {
  const sandbox = {
    window: {},
    document: {},
    CSS: { escape: String },
    setTimeout,
    clearTimeout,
    encodeURIComponent,
    decodeURIComponent,
    kodLokalizacjiMagazynu: (input) => String(input || '').trim().toUpperCase(),
    magazynLokalizacjaPoKodzie: (input) => String(input).toUpperCase() === 'A-R01-P02' ? { kod: 'A-R01-P02', typ: 'półka' } : null,
    magazynLokalizacjeAktywne: () => [{ kod: 'A-R01-P02', kodKreskowy: 'LOC-002' }],
  };
  vm.runInNewContext(`${source}\nglobalThis.__result=magazynQRParsujOdczyt(${JSON.stringify(value)});`, sandbox);
  return structuredClone(sandbox.__result);
}

test('QR ma wersjonowany format i rozróżnia lokalizację, produkt oraz zwykły kod', () => {
  assert.deepEqual(parse('ATW:1:L:A-R01-P02'), { type: 'location', code: 'A-R01-P02', raw: 'ATW:1:L:A-R01-P02', explicit: true });
  assert.deepEqual(parse('ATW:1:P:produkt-17'), { type: 'product', productId: 'produkt-17', raw: 'ATW:1:P:produkt-17', explicit: true });
  assert.equal(parse('LOC-002').type, 'location');
  assert.deepEqual(parse('5906018026788'), { type: 'code', scanCode: '5906018026788', raw: '5906018026788' });
});

test('generator QR ma osobną podstronę magazynu i nie obciąża Planu zatowarowania', () => {
  const plan = inventory.slice(inventory.indexOf('function magazynPlanZatowarowaniaHTML'), inventory.indexOf('function odswiezPlanZatowarowaniaWidoku'));
  assert.doesNotMatch(plan, /magazynQRCentrumHTML\(\)/);
  assert.match(inventory, /aktywna==="etykiety-qr"[^\n]+magazynQRCentrumHTML\(\)/);
  assert.match(navigation, /id:"etykiety-qr",href:"#\/admin\/magazyn\/etykiety-qr",label:"🏷️ Etykiety i kody QR"/);
  assert.match(locations, /#\/admin\/magazyn\/etykiety-qr/);
  assert.match(source, /function magazynQROtworzLokalizacje/);
  assert.match(source, /Osobne centrum oznaczeń magazynowych/);
  assert.match(source, /Generator etykiet QR/);
  assert.match(source, /ATW:1:L:/);
  assert.match(source, /ATW:1:P:/);
});

test('skaner telefonu ma tryb awaryjny QR i przekazuje aktywną lokalizację do pozycji dokumentu', () => {
  assert.match(documents, /magazynQRLadujCzytnik\(\)/);
  assert.match(documents, /magazynQROdczytajZVideo/);
  assert.match(documents, /magazynDokumentSkanLokalizacje/);
  assert.match(documents, /location:item\.location/);
  assert.match(documents, /Najpierw zeskanuj QR miejsca/);
  assert.match(documents, /#\/admin\/magazyn\/etykiety-qr/);
});

test('ciężkie bezpłatne biblioteki QR są osobnymi zasobami ładowanymi na żądanie', async () => {
  const admin = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  assert.ok(admin.sources.includes('src/frontend/10-warehouse-qr.js'));
  assert.equal(VENDOR_ASSETS.length, 2);
  for (const vendor of VENDOR_ASSETS) {
    const file = await stat(vendor.output);
    assert.ok(file.size > 10_000, `${vendor.output} powinien zawierać bibliotekę QR`);
    assert.ok(!admin.sources.includes(vendor.source), 'biblioteka aparatu nie może wejść do początkowego pakietu panelu');
  }
  assert.match(source, /assets\/vendor\/jsQR\.js/);
  assert.match(source, /assets\/vendor\/qrcode-generator\.js/);
});
