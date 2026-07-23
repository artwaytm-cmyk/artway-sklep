import { gzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import { ARCHITECTURE_BUDGETS as B, budgetState, physicalLineCount } from '../config/architecture-budgets.mjs';
import { ADMIN_RUNTIME_BUNDLES } from './build-assets.mjs';

const rows = [];
const kib = (value) => `${(value / 1024).toFixed(1)} KiB`;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(path) : (/\.(?:js|mjs|css)$/.test(entry.name) ? [path] : []);
  }));
  return nested.flat();
}

async function sourceRow(name, path, budget) {
  const content = await readFile(path, 'utf8');
  const lines = physicalLineCount(content), bytes = Buffer.byteLength(content);
  rows.push({ area: name, metric: 'linie', value: lines, target: budget.targetLines, max: budget.maxLines, state: budgetState(lines, budget.targetLines, budget.maxLines) });
  rows.push({ area: name, metric: 'rozmiar źródła', value: kib(bytes), target: kib(budget.targetBytes), max: kib(budget.maxBytes), state: budgetState(bytes, budget.targetBytes, budget.maxBytes) });
}

async function assetRow(name, path, budget) {
  const bytes = await readFile(path), raw = bytes.length, gzip = gzipSync(bytes).length;
  rows.push({ area: name, metric: 'raw', value: kib(raw), target: '—', max: kib(budget.maxRawBytes), state: raw > budget.maxRawBytes ? 'FAIL' : 'OK' });
  rows.push({ area: name, metric: 'gzip', value: kib(gzip), target: kib(budget.targetGzipBytes), max: kib(budget.maxGzipBytes), state: budgetState(gzip, budget.targetGzipBytes, budget.maxGzipBytes) });
}

await sourceRow('Koordynator backendu', 'src/backend/lib/store-app.mjs', B.backendCoordinator);
const sourcePaths = [...new Set((await Promise.all([
  sourceFiles('src'), sourceFiles('src/backend/lib/core'), sourceFiles('src/backend/lib/domain'), sourceFiles('src/backend/lib'),
])).flat().filter((path) => path !== 'src/backend/lib/store-app.mjs'))];
const sourceRisks = await Promise.all(sourcePaths.map(async (path) => {
  const content = await readFile(path, 'utf8'), budget = path.endsWith('.css') ? B.source.stylesheet : B.source.javascript;
  const lines = physicalLineCount(content), bytes = Buffer.byteLength(content);
  return { path, budget, lines, bytes, risk: Math.max(lines / budget.maxLines, bytes / budget.maxBytes) };
}));
const sourceWarnings = sourceRisks
  .filter(({ lines, bytes, budget }) => lines > budget.targetLines || bytes > budget.targetBytes)
  .sort((left, right) => right.risk - left.risk);
for (const source of sourceWarnings) {
  await sourceRow(`Źródło — ${source.path}`, source.path, source.budget);
}
await assetRow('Sklep JavaScript', 'assets/app.js', B.browser.storefrontScript);
await assetRow('Sklep CSS', 'assets/styles.css', B.browser.storefrontStyles);
await assetRow('Panel — rdzeń', 'assets/admin-core.js', B.browser.adminCore);
await assetRow('Panel — wspólne UI', 'assets/admin-ui.js', B.browser.adminSharedUi);
for (const bundle of ADMIN_RUNTIME_BUNDLES.filter((entry) => !['assets/admin-core.js', 'assets/admin-ui.js'].includes(entry.output))) {
  await assetRow(`Panel — ${bundle.output.split('/').pop()}`, bundle.output, B.browser.adminRoute);
}
await assetRow('Panel CSS', 'assets/admin.css', B.browser.adminStyles);

console.table(rows);
const failures = rows.filter((row) => row.state === 'FAIL');
const warnings = rows.filter((row) => row.state === 'WARN');
console.log(`Budżety: ${rows.length - failures.length - warnings.length} OK, ${warnings.length} ostrzeżeń, ${failures.length} przekroczeń.`);
console.log(`Jawna kolejka podziału: ${sourceWarnings.length} modułów źródłowych ponad celem. Raport pokazuje wszystkie, bez skracania listy.`);
if (failures.length) process.exitCode = 1;
