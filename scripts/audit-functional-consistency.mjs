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
  ['16-diagnostics.js', 2], // aktualizacja pełnego wydania i przywrócenie kopii
]);
const reloadCounts = frontendReloads.reduce((map, name) => map.set(name, (map.get(name) || 0) + 1), new Map());
const maintenanceReloadsOnly = frontendReloads.length === [...allowedMaintenanceReloads.values()].reduce((sum, count) => sum + count, 0)
  && [...reloadCounts].every(([name, count]) => allowedMaintenanceReloads.get(name) === count);
const checks = [
  ['Edytor wymaga tekstowej nazwy producenta', /required name="producent"[\s\S]*?walidujPoleProducenta/.test(read('src/frontend/12-product-editor.js'))],
  ['Gotowość Allegro sprawdza nazwę producenta', /poprawnaNazwaProducenta\(p\.producent\|\|p\.marka\)/.test(read('src/frontend/11-allegro-operations.js'))],
  ['Import CSV odrzuca liczbowego producenta', /producent musi być nazwą, a nie samym numerem/.test(read('src/frontend/13a-product-import-export.js'))],
  ['Backend oczyszcza producenta w ustawieniach', /sanitizeManufacturerFieldsInSettings\(wynik\)/.test(read('netlify/functions/lib/store-app.mjs'))],
  ['Import linków używa tej samej walidacji', /canonicalManufacturerName/.test(read('netlify/functions/lib/domain/product-link-import-support.mjs'))],
  ['Pełne przeładowanie występuje tylko po aktualizacji wydania, resecie lub imporcie kopii', maintenanceReloadsOnly],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'BŁĄD'}  ${name}`);
console.log(`Kontrole funkcjonalne: ${checks.length - failed.length}/${checks.length} OK.`);
if (failed.length) process.exitCode = 1;
