import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const frontendReloads = fs.readdirSync(path.join(root, 'src/frontend')).filter((name) => name.endsWith('.js')).flatMap((name) => {
  const source = read(`src/frontend/${name}`);
  return [...source.matchAll(/\blocation\.reload\s*\(/g)].map(() => name);
});
const allowedMaintenanceReloads = new Map([
  ['15d-publication-and-export.js', 1], // świadomy reset ustawień
  ['16-diagnostics.js', 1], // przywrócenie kopii; aktualizację prowadzi wersjonowany mechanizm PWA
  ['18-pwa.js', 1], // bezpieczne uruchomienie kompletnego nowego wydania serwerowego
]);
const reloadCounts = frontendReloads.reduce((map, name) => map.set(name, (map.get(name) || 0) + 1), new Map());
const maintenanceReloadsOnly = frontendReloads.length === [...allowedMaintenanceReloads.values()].reduce((sum, count) => sum + count, 0)
  && [...reloadCounts].every(([name, count]) => allowedMaintenanceReloads.get(name) === count);
const productEditorSource = [
  read('src/frontend/12-product-editor.js'),
  read('src/frontend/12-product-editor-workspace.js'),
].join('\n');
const checks = [
  ['Edytor wymaga tekstowej nazwy producenta', /<input required[\s\S]{0,300}?name="producent"[\s\S]{0,500}?walidujPoleProducenta/.test(productEditorSource)],
  ['Edytor pobiera pełną kartotekę przed modyfikacją', /detailLevel!=="full"[\s\S]{0,500}?productEditorPobierzPelnaKartoteke/.test(productEditorSource)],
  ['Producent, GPSR i kanały korzystają ze wspólnego profilu', /catalog-product-manufacturer-resolve/.test(productEditorSource)
    && /manufacturerProfileId/.test(read('src/backend/lib/domain/catalog-product-field-save.mjs'))],
  ['Gotowość Allegro sprawdza nazwę producenta', /poprawnaNazwaProducenta\(p\.producent\|\|p\.marka\)/.test(read('src/frontend/11-allegro-operations.js'))],
  ['Import CSV odrzuca liczbowego producenta', /producent musi być nazwą, a nie samym numerem/.test(read('src/frontend/13a-product-import-export.js'))],
  ['Backend oczyszcza producenta w ustawieniach', /sanitizeManufacturerFieldsInSettings\(filterKnownSettingsDomains\(obj\)\)/.test(read('src/backend/lib/store-app.mjs'))],
  ['Import linków używa tej samej walidacji', /canonicalManufacturerName/.test(read('src/backend/lib/domain/product-link-import-support.mjs'))],
  ['Pełne przeładowanie występuje tylko po aktualizacji wydania, resecie lub imporcie kopii', maintenanceReloadsOnly],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'BŁĄD'}  ${name}`);
console.log(`Kontrole funkcjonalne: ${checks.length - failed.length}/${checks.length} OK.`);
if (failed.length) process.exitCode = 1;
