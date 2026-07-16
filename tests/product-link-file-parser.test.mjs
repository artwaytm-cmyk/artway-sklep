import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';

await import('../src/frontend/20-product-link-file-import-parser.js');

const { parseProductLinksFile, canonicalProductUrl } = globalThis.productLinkFileImportParser;

function storedZip(files){
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for(const [name, source] of Object.entries(files)){
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(source, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14); // Parser nie wymaga CRC do odczytu lokalnej kolejki.
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(localOffset, 42);

    localParts.push(local, nameBytes, data);
    centralParts.push(central, nameBytes);
    localOffset += local.length + nameBytes.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function deflatedZipWithDeclaredSize(name, source, declaredSize){
  const nameBytes = Buffer.from(name, 'utf8');
  const data = Buffer.isBuffer(source) ? source : Buffer.from(source);
  const compressed = deflateRawSync(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(declaredSize, 22);
  local.writeUInt16LE(nameBytes.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(declaredSize, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);

  const centralOffset = local.length + nameBytes.length + compressed.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBytes, compressed, central, nameBytes, end]);
}

test('CSV rozpoznaje nagłówki, przyjmuje wielu producentów i usuwa duplikat kanonicznego URL', async () => {
  const csv = [
    'Lp.;Nazwa produktu;Link do produktu',
    '1;Produkt 0049;https://www.sklep.alexander.com.pl/product-pol-0049-Test.html?utm_source=test#sekcja',
    '2;Ta sama pozycja;https://sklep.alexander.com.pl/product-pol-0049-Test.html?query_id=2',
    '3;Produkt Multigra;https://multigra.com.pl/produkt/gra-rodzinna?utm_campaign=test',
    '4;Adres wewnętrzny;http://localhost/produkt/0049',
  ].join('\n');
  const result = await parseProductLinksFile(Buffer.from(csv), {fileName:'produkty.csv'});

  assert.equal(result.total, 4);
  assert.equal(result.rows.length, 2);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.rows[0].url, 'https://www.sklep.alexander.com.pl/product-pol-0049-Test.html');
  assert.equal(result.rows[1].url, 'https://multigra.com.pl/produkt/gra-rodzinna');
  assert.equal(result.duplicates[0].duplicateOfRow, 2);
  assert.equal(result.invalid[0].code, 'unsupported_host');
});

test('TXT bez naglowka tworzy kolejke link po linku i nie deduplikuje po nazwie', async () => {
  const text = [
    'https://www.sklep.alexander.com.pl/product-pol-49-Test.html',
    'https://www.sklep.alexander.com.pl/product-pol-0049-Test.html',
  ].join('\n');
  const result = await parseProductLinksFile(Buffer.from(text), {fileName:'produkty.txt'});

  assert.equal(result.total, 2);
  assert.equal(result.rows.length, 2);
  assert.match(result.rows[0].url, /product-pol-49-/);
  assert.match(result.rows[1].url, /product-pol-0049-/);
});

test('XLSX odczytuje pierwszy arkusz i sharedStrings bez utraty zer wiodacych', async () => {
  const shared = [
    'Lp.', 'Nazwa produktu', 'Link do produktu',
    'Produkt 0376', 'https://www.sklep.alexander.com.pl/product-pol-0376-100-Gier.html',
    'Duplikat', 'https://www.sklep.alexander.com.pl/product-pol-0376-100-Gier.html?utm_campaign=test',
    'Bledny', 'mailto:sklep@example.com',
  ];
  const sharedXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((value) => `<si><t>${value.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`;
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2"><c r="A2"><v>1</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row>
    <row r="3"><c r="A3"><v>2</v></c><c r="B3" t="s"><v>5</v></c><c r="C3" t="s"><v>6</v></c></row>
    <row r="4"><c r="A4"><v>3</v></c><c r="B4" t="s"><v>7</v></c><c r="C4" t="s"><v>8</v></c></row>
  </sheetData></worksheet>`;
  const workbook = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Produkty Alexander" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const relations = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  const workbookBuffer = storedZip({
    'xl/workbook.xml':workbook,
    'xl/_rels/workbook.xml.rels':relations,
    'xl/sharedStrings.xml':sharedXml,
    'xl/worksheets/sheet1.xml':sheetXml,
  });
  const result = await parseProductLinksFile(workbookBuffer, {fileName:'Alexander.xlsx'});

  assert.equal(result.sheetName, 'Produkty Alexander');
  assert.equal(result.total, 3);
  assert.equal(result.rows.length, 1);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.invalid[0].code, 'invalid_protocol');
  assert.match(result.rows[0].url, /product-pol-0376-/);
});

test('kanonizacja zachowuje parametry funkcjonalne i porzadkuje je stabilnie', () => {
  const result = canonicalProductUrl('https://sklep.alexander.com.pl/product-pol-0525-Test.html?variant=blue&utm_medium=email&size=2#opis');
  assert.equal(result.ok, true);
  assert.equal(result.url, 'https://www.sklep.alexander.com.pl/product-pol-0525-Test.html?size=2&variant=blue');
});

test('kanonizacja zachowuje domenę każdego publicznego dostawcy i odrzuca adresy techniczne', () => {
  const godan = canonicalProductUrl('http://www.godanparty.pl/pl/p/Balony-zestaw/123?variant=gold&utm_source=feed');
  assert.equal(godan.ok, true);
  assert.equal(godan.url, 'https://www.godanparty.pl/pl/p/Balony-zestaw/123?variant=gold');
  assert.equal(canonicalProductUrl('http://127.0.0.1/produkt/123').ok, false);
  assert.equal(canonicalProductUrl('https://panel.internal/produkt/123').ok, false);
  assert.equal(canonicalProductUrl('https://producent-zabawek.pl/?gclid=tracking').ok, false);
  assert.equal(canonicalProductUrl('https://producent-zabawek.pl/?product_id=123').ok, true);
});

test('XLSX przerywa dekompresje po rzeczywistym limicie, gdy naglowek ZIP klamie', async () => {
  const oversizedWorkbook = Buffer.alloc(32 * 1024 * 1024 + 1, 0x41);
  const archive = deflatedZipWithDeclaredSize('xl/workbook.xml', oversizedWorkbook, 1);
  assert.ok(archive.length < 100_000, 'test powinien pozostac malym skompresowanym plikiem');

  await assert.rejects(
    parseProductLinksFile(archive, {fileName:'klamliwy-rozmiar.xlsx'}),
    (error) => error?.code === 'XLSX_ENTRY_TOO_LARGE',
  );
});

test('nieaktywne sterowanie importem pozostaje niewidoczne mimo stylu przycisków', () => {
  const css = readFileSync(new URL('../src/styles/14-product-link-import.css', import.meta.url), 'utf8');
  assert.match(css, /\.product-link-file-import-page \[hidden\]\{display:none!important\}/);
});

test('pozycje do decyzji mają edytor braków, wybór masowy i bezpieczny zapis serwerowy', () => {
  const ui = readFileSync(new URL('../src/frontend/21-product-link-file-import-ui.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/17-product-link-review.css', import.meta.url), 'utf8');
  assert.match(ui, /function productLinkImportReviewFormHTML/);
  assert.match(ui, /Cena sprzedaży brutto\$\{gwiazdka\("cena"\)\}/);
  assert.match(ui, /Więcej danych do poprawy/);
  assert.match(ui, /function productLinkImportMasowaDecyzja/);
  assert.match(ui, /index\+=10/);
  assert.match(ui, /brak nazwy/);
  assert.match(ui, /Zaznacz wszystkie w filtrze/);
  assert.match(ui, /product-link-import-review-resolve/);
  assert.match(css, /\.product-link-review-bulk/);
  assert.match(css, /\.product-link-review-editor/);
});
