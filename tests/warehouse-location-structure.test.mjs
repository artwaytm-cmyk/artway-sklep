import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const core = await readFile('src/frontend/05-catalog-inventory.js', 'utf8');
const ui = await readFile('src/frontend/10-warehouse-locations.js', 'utf8');
const view = await readFile('assets/admin.js', 'utf8');
const styles = await readFile('src/styles/20-warehouse-locations.css', 'utf8');
const build = await readFile('scripts/build-assets.mjs', 'utf8');

test('regały literowe obsługują A–Z oraz dalsze oznaczenia AA, AB', () => {
  const start = core.indexOf('function magazynLiteraRegalu');
  const end = core.indexOf('function zapiszLokalizacjeMagazynuWspolnie', start);
  assert.ok(start >= 0 && end > start);
  const context = {};
  vm.runInNewContext(`${core.slice(start, end)};this.result=[magazynLiteraRegalu(1),magazynLiteraRegalu(26),magazynLiteraRegalu(27),magazynIndeksRegalu('AB')];`, context);
  assert.deepEqual(Array.from(context.result), ['A', 'Z', 'AA', 28]);
});

test('generator tworzy poprawne rekordy i nie narzuca limitu sztuk półce', () => {
  const helperStart = core.indexOf('function magazynLiteraRegalu');
  const helperEnd = core.indexOf('function zapiszLokalizacjeMagazynuWspolnie', helperStart);
  const generatorStart = core.indexOf('function generujRegalyIPolkiMagazynu');
  const generatorEnd = core.indexOf('function ustawLokalizacjeProduktu', generatorStart);
  const context = {
    magazynLokalizacje: [],
    sesja: { email: 'admin@test.pl' },
    FormData: class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? null; } },
    kodLokalizacjiMagazynu: (value = '') => String(value).trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-'),
    intNieujemny: (value, fallback = 0) => { const number = Math.trunc(Number(value)); return Number.isFinite(number) && number >= 0 ? number : fallback; },
    zapiszLokalizacjeMagazynuWspolnie: () => {},
    toast: () => {},
    renderuj: () => {},
  };
  vm.runInNewContext(`${core.slice(helperStart, helperEnd)}\n${core.slice(generatorStart, generatorEnd)}`, context);
  const values = { strefaKod: 'PAK', strefaNazwa: 'Pakownia', trybRegalow: 'litery', startRegal: 'A', regaly: '1', startPolka: '1', polki: '3', miejsca: '0', startMiejsce: '1', bezLimitu: 'on', pojemnosc: '' };
  context.generujRegalyIPolkiMagazynu({ preventDefault() {}, target: { values } });
  const rows = context.magazynLokalizacje;
  assert.equal(rows.length, 5);
  assert.equal(rows.find(item => item.kod === 'PAK')?.nazwa, 'Pakownia');
  assert.equal(rows.find(item => item.kod === 'PAK-RA')?.nazwa, 'Regał A');
  assert.equal(rows.find(item => item.kod === 'PAK-RA-P03')?.nazwa, 'Półka 3');
  assert.equal(rows.find(item => item.kod === 'PAK-RA-P03')?.bezLimitu, true);
  assert.equal(rows.find(item => item.kod === 'PAK-RA-P03')?.pojemnosc, 0);
});

test('kreator tworzy czytelną strukturę Pakownia → Regał A → Półka 3', () => {
  const start = ui.indexOf('function magazynKodZPrzyjaznejNazwy');
  const end = ui.indexOf('function magazynKreatorPodglad', start);
  const context = { kodLokalizacjiMagazynu: (value = '') => String(value).trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-') };
  vm.runInNewContext(`${ui.slice(start, end)};this.result=[magazynKodZPrzyjaznejNazwy('strefa','','Pakownia'),magazynKodZPrzyjaznejNazwy('regał','PAKOWNIA','A'),magazynKodZPrzyjaznejNazwy('półka','PAKOWNIA-RA','3'),magazynNazwaZPrzyjaznejWartosci('półka','3')];`, context);
  assert.deepEqual(Array.from(context.result), ['PAKOWNIA', 'PAKOWNIA-RA', 'PAKOWNIA-RA-P03', 'Półka 3']);
  assert.match(ui, /Półka jest ostatnim poziomem i nie ma limitu sztuk/);
  assert.match(ui, /Tak zobaczy to pracownik/);
  assert.match(core, /nazwa:`Regał \$\{rackLabel\}`/);
  assert.match(core, /nazwa:`Półka \$\{shelfNo\}`/);
  assert.match(core, /rackMode==="numery"/);
});

test('półka jest ostatnim poziomem i zawsze ma nieograniczoną pojemność', () => {
  assert.match(core, /l\.aktywna!==false&&l\.typ!=="miejsce"/);
  assert.match(core, /pojemnosc:0,bezLimitu:true/);
  assert.match(ui, /Bez limitu liczby sztuk/);
  assert.match(ui, /dowolną liczbę produktów i sztuk/);
  assert.doesNotMatch(core, /for\(let m=0;m<placeCount/);
  assert.doesNotMatch(ui, /name="miejsca"/);
  assert.match(ui, /function magazynTypDzieckaLokalizacji\(location\)\{return location\?\.typ==="strefa"\?"regał":location\?\.typ==="regał"\?"półka":"";\}/);
});

test('indeks lokalizacji skaluje się do dużego magazynu bez ponownego przeszukiwania całej listy', () => {
  const start = core.indexOf('let magazynLokalizacjeIndexCache');
  const end = core.indexOf('function czyLokalizacjaBezLimitu', start);
  assert.ok(start >= 0 && end > start);
  const locations = [{ kod: 'PAK', nazwa: 'Pakownia', typ: 'strefa' }];
  for (let rack = 1; rack <= 20; rack++) {
    locations.push({ kod: `PAK-R${rack}`, nazwa: `Regał ${rack}`, typ: 'regał', parentKod: 'PAK' });
    for (let shelf = 1; shelf <= 20; shelf++) locations.push({ kod: `PAK-R${rack}-P${shelf}`, nazwa: `Półka ${shelf}`, typ: 'półka', parentKod: `PAK-R${rack}` });
  }
  const context = {
    magazynLokalizacje: locations,
    kodLokalizacjiMagazynu: value => String(value || '').trim().toUpperCase(),
    esc: value => String(value ?? ''),
    Map,
    Set,
  };
  vm.runInNewContext(`${core.slice(start, end)};this.first=magazynLokalizacjeIndex();this.second=magazynLokalizacjeIndex();this.path=sciezkaLokalizacjiMagazynu('PAK-R20-P20');this.depth=poziomLokalizacjiMagazynu('PAK-R20-P20');this.found=magazynLokalizacjaPoKodzie('pak-r20-p20');`, context);
  assert.equal(context.first, context.second);
  assert.equal(context.first.aktywne.length, 421);
  assert.equal(context.path, 'PAK / PAK-R20 / PAK-R20-P20');
  assert.equal(context.depth, 2);
  assert.equal(context.found.nazwa, 'Półka 20');
});

test('Stany używają jednej listy lokalizacji zamiast setek powielonych pól wyboru', () => {
  assert.match(view, /magazynLokalizacjeDatalistHTML\("warehouseStockLocationOptions"\)/);
  assert.match(view, /poleLokalizacjiMagazynu\(meta\.lokalizacja\|\|"","warehouseStockLocationOptions"\)/);
  const stockStart = view.indexOf('${aktywna==="stany"?');
  const stockEnd = view.indexOf('${aktywna==="ruchy"?', stockStart);
  const stock = view.slice(stockStart, stockEnd);
  assert.equal((stock.match(/magazynLokalizacjeDatalistHTML/g) || []).length, 1);
  assert.doesNotMatch(stock, /selectLokalizacjiMagazynu\(meta\.lokalizacja/);
});

test('lokalizacje mają mapę drzewa, prosty kreator i chronione kody QR', () => {
  assert.match(ui, /MAGAZYN_DRZEWO_LIMIT=500/);
  assert.match(ui, /function magazynDrzewoHTML/);
  assert.match(ui, /function magazynLokalizacjaSzczegolyHTML/);
  assert.match(ui, /function magazynOtworzKreatorLokalizacji/);
  assert.match(ui, /function przygotujPodlokalizacjeMagazynu/);
  assert.match(ui, /code=original\|\|magazynKodZPrzyjaznejNazwy/);
  assert.match(ui, /Położenie pozostaje stałe, aby istniejące QR działały/);
  assert.match(ui, /#\/admin\/magazyn\/etykiety-qr/);
  assert.match(ui, /setTimeout\(\(\)=>renderuj\(\),180\)/);
  assert.match(view, /magazynLokalizacjePanelHTML\(lokalizacje,statLok,pozaSlownikiem\)/);
});

test('lokalizację można naprawdę usunąć z kontrolą produktów i szkiców PZ/WZ', () => {
  assert.match(ui, /warehouse-location-delete-preview/);
  assert.match(ui, /warehouse-location-delete/);
  assert.match(ui, /Przenieś na inną półkę/);
  assert.match(ui, /Pozostaw bez lokalizacji/);
  assert.match(ui, /Usuń lokalizację/);
  assert.match(styles, /warehouse-location-delete-dialog/);
});

test('nowy moduł i responsywne style są częścią panelu administratora', () => {
  assert.match(build, /src\/frontend\/10-warehouse-locations\.js/);
  assert.match(build, /src\/styles\/20-warehouse-locations\.css/);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /warehouse-location-workbench/);
  assert.match(styles, /warehouse-location-modal/);
});
