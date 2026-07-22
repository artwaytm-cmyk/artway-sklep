import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, stat } from 'node:fs/promises';
import { ASSET_BUNDLES, VENDOR_ASSETS } from '../scripts/build-assets.mjs';

const source = await readFile(new URL('../src/frontend/10-warehouse-qr.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/19-warehouse-qr.css', import.meta.url), 'utf8');
const documents = await readFile(new URL('../src/frontend/10-warehouse-documents.js', import.meta.url), 'utf8');
const inventory = await readFile(new URL('../assets/admin.js', import.meta.url), 'utf8');
const locations = await readFile(new URL('../src/frontend/10-warehouse-locations.js', import.meta.url), 'utf8');
const navigation = await readFile(new URL('../assets/admin.js', import.meta.url), 'utf8');

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
  assert.match(navigation, /id:"etykiety-qr",href:"#\/admin\/magazyn\/etykiety-qr",icon:"🏷️",label:"Etykiety QR",description:"Druk i skanowanie"/);
  assert.match(locations, /#\/admin\/magazyn\/etykiety-qr/);
  assert.match(source, /function magazynQROtworzLokalizacje/);
  assert.match(source, /Osobne centrum oznaczeń magazynowych/);
  assert.match(source, /Generator etykiet QR/);
  assert.match(source, /ATW:1:L:/);
  assert.match(source, /ATW:1:P:/);
});

test('etykiety lokalizacji mają krótkie oznaczenia regału, półki i miejsca', () => {
  const dictionary = {
    PAKOWNIA: { kod: 'PAKOWNIA', nazwa: 'Pakownia', typ: 'strefa', parentKod: '' },
    'PAKOWNIA-RA': { kod: 'PAKOWNIA-RA', nazwa: 'Regał A', typ: 'regał', parentKod: 'PAKOWNIA' },
    'PAKOWNIA-RA-P03': { kod: 'PAKOWNIA-RA-P03', nazwa: 'Półka 3', typ: 'półka', parentKod: 'PAKOWNIA-RA' },
    'PAKOWNIA-RA-P03-M002': { kod: 'PAKOWNIA-RA-P03-M002', nazwa: 'Miejsce 2', typ: 'miejsce', parentKod: 'PAKOWNIA-RA-P03' },
    SKLEP: { kod: 'SKLEP', nazwa: 'Sklep', typ: 'strefa', parentKod: '' },
    'SKLEP-RB': { kod: 'SKLEP-RB', nazwa: 'Regał B', typ: 'regał', parentKod: 'SKLEP' },
    'SKLEP-RB-P02': { kod: 'SKLEP-RB-P02', nazwa: 'Półka 2', typ: 'półka', parentKod: 'SKLEP-RB' },
  };
  const sandbox = { window: {}, document: {}, CSS: { escape: String }, Set, Map, Intl, console, setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent, magazynLokalizacjaPoKodzie: (code) => dictionary[code] || null, magazynLokalizacjeAktywne: () => Object.values(dictionary) };
  vm.runInNewContext(`${source}\nglobalThis.__short=[magazynQRLokalizacjaSkrot(${JSON.stringify(dictionary['PAKOWNIA-RA'])}),magazynQRLokalizacjaSkrot(${JSON.stringify(dictionary['PAKOWNIA-RA-P03'])}),magazynQRLokalizacjaSkrot(${JSON.stringify(dictionary['PAKOWNIA-RA-P03-M002'])}),magazynQRLokalizacjaSkrot(${JSON.stringify(dictionary['SKLEP-RB-P02'])})];globalThis.__friendly=magazynQRParsujOdczyt('PAK-A-3');`, sandbox);
  assert.deepEqual(Array.from(sandbox.__short), ['PAK-A', 'PAK-A-3', 'PAK-A-3-2', 'SKL-B-2']);
  assert.equal(sandbox.__friendly.type, 'location');
  assert.equal(sandbox.__friendly.code, 'PAKOWNIA-RA-P03');
});

test('pełna nazwa regału lub półki nie jest zastępowana skrótem ani obcinana', () => {
  assert.match(source, /locationName:name/);
  assert.match(source, /warehouse-qr-location-name/);
  assert.match(source, /parentPath\?`W: \$\{parentPath\}`:"Obszar główny"/);
  assert.match(styles, /warehouse-qr-location-name\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
  assert.match(styles, /name-very-long \.warehouse-qr-location-name/);
  assert.match(styles, /warehouse-qr-location-path\{[^}]*-webkit-line-clamp:unset/);
  const sandbox = { window: {}, document: {}, Set, Map, Intl, console, setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent };
  vm.runInNewContext(`${source}\nglobalThis.__classes=[magazynQRKlasaDlugosciNazwy('Regał A'),magazynQRKlasaDlugosciNazwy('Regał na zapleczu sklepu z artykułami imprezowymi')];`, sandbox);
  assert.deepEqual(Array.from(sandbox.__classes), ['name-short', 'name-very-long']);
});

test('druk QR obejmuje wyłącznie zaznaczone pozycje i zachowuje fizyczny format etykiety', () => {
  assert.match(source, /Zaznacz widoczne/);
  assert.match(source, /Odznacz widoczne/);
  assert.match(source, /Tylko wybrane/);
  assert.match(source, /magazynQRStrefa/);
  assert.match(source, /magazynQRRegal/);
  assert.match(source, /Liczba kopii/);
  assert.match(source, /@page\{size:/);
  assert.match(styles, /warehouse-qr-print-62x38/);
  assert.match(styles, /width:62mm!important;height:38mm!important/);
  assert.match(styles, /warehouse-qr-print-a4/);
});

test('kreator arkusza pozwala ustawić osobny nakład, pozycję startową i fizyczną siatkę A4', () => {
  assert.match(source, /Liczba kopii każdej etykiety/);
  assert.match(source, /magazynQRUstawKopiePozycji/);
  assert.match(source, /Miejsce rozpoczęcia/);
  assert.match(source, /Jeśli arkusz jest nowy/);
  assert.match(source, /magazynQRDrukMetryka/);
  assert.match(source, /magazynQRUstawPresetDruku/);
  assert.match(source, /Pojedyncza etykieta jest większa od obszaru strony A4/);
  assert.match(styles, /--qr-columns/);
  assert.match(styles, /warehouse-qr-empty-slot/);
  assert.match(styles, /page-break-after:always/);
});

test('arkusz QR automatycznie dobiera siatkę i udostępnia prostą kalibrację drukarki', () => {
  assert.match(source, /function magazynQRDopasujAutomatycznie/);
  assert.match(source, /Dopasuj automatycznie/);
  assert.match(source, /warehouse-qr-start-map/);
  assert.match(source, /Korekta w poziomie/);
  assert.match(source, /Ustaw skalę <strong>100%<\/strong>/);
  assert.match(styles, /--qr-offset-x/);
  assert.match(styles, /warehouse-qr-preset-cards/);
  const sandbox = { window: {}, document: {}, Set, Map, Intl, console, setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent };
  vm.runInNewContext(`${source}\nmagazynQRDrukUstawienia={orientacja:'pion',szerokosc:62,wysokosc:38,odstepX:3,odstepY:2,marginesGora:8,marginesPrawo:8,marginesDol:8,marginesLewo:8,korektaX:0,korektaY:0};globalThis.__fit=magazynQRDopasowanieAutomatyczne();`, sandbox);
  assert.deepEqual(structuredClone(sandbox.__fit), { columns: 3, rows: 7 });
});

test('etykieta skaluje ramkę i QR jako całość oraz przechodzi w całości na kolejną stronę', () => {
  assert.match(source, /--qr-code-size:\$\{m\.codeSize\}mm/);
  assert.match(source, /label-layout-\$\{m\.labelLayout\}/);
  assert.match(source, /Układ został bezpiecznie dopasowany — żadna etykieta nie będzie przecięta/);
  assert.match(styles, /grid-template-columns:var\(--qr-code-size\) minmax\(0,1fr\)/);
  assert.match(styles, /page-break-inside:avoid!important/);
  const sandbox = { window: {}, document: {}, Set, Map, Intl, console, setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent };
  vm.runInNewContext(`${source}\nmagazynQRFormat='a4';magazynQRDrukUstawienia={orientacja:'pion',szerokosc:62,wysokosc:38,kolumny:3,wiersze:7,odstepX:3,odstepY:2,marginesGora:8,marginesPrawo:8,marginesDol:8,marginesLewo:8,korektaX:0,korektaY:0,start:1};magazynQRPodgladPozycje=Array.from({length:22},(_,i)=>({key:'P:'+i,type:'product',title:'P'+i}));magazynQREtykietyHTML=items=>items.map(()=>'<article class="warehouse-qr-label"></article>').join('');globalThis.__pages=magazynQRArkuszeHTML();`, sandbox);
  const pages=String(sandbox.__pages).match(/<section class="warehouse-qr-print-page[\s\S]*?<\/section>/g) || [];
  assert.equal(pages.length, 2);
  assert.equal((pages[0].match(/<article/g) || []).length, 21);
  assert.equal((pages[1].match(/<article/g) || []).length, 1);
});

test('skaner telefonu ma tryb awaryjny QR i przekazuje aktywną lokalizację do pozycji dokumentu', () => {
  assert.match(documents, /magazynQRLadujCzytnikKodow\(\)/);
  assert.match(documents, /BrowserMultiFormatReader/);
  assert.match(documents, /magazynQRLadujCzytnik\(\)/);
  assert.match(documents, /magazynQROdczytajZVideo/);
  assert.match(documents, /magazynDokumentSkanLokalizacje/);
  assert.match(documents, /location:session\.confirmedLocation/);
  assert.match(documents, /Najpierw zeskanuj i zatwierdź półkę/);
  assert.match(documents, /magazynDokumentPotwierdzLokalizacjeSkanu/);
});

test('ciężkie bezpłatne biblioteki QR są osobnymi zasobami ładowanymi na żądanie', async () => {
  const admin = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  assert.ok(admin.sources.includes('src/frontend/10-warehouse-qr.js'));
  assert.equal(VENDOR_ASSETS.length, 3);
  for (const vendor of VENDOR_ASSETS) {
    const file = await stat(vendor.output);
    assert.ok(file.size > 10_000, `${vendor.output} powinien zawierać bibliotekę QR`);
    assert.ok(!admin.sources.includes(vendor.source), 'biblioteka aparatu nie może wejść do początkowego pakietu panelu');
  }
  assert.match(source, /assets\/vendor\/jsQR\.js/);
  assert.match(source, /assets\/vendor\/qrcode-generator\.js/);
  assert.match(source, /assets\/vendor\/zxing-browser\.min\.js/);
});
