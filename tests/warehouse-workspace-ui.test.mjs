import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ASSET_BUNDLES } from '../scripts/build-assets.mjs';

const navigation = await readFile(new URL('../assets/admin.js', import.meta.url), 'utf8');
const inventory = await readFile(new URL('../assets/admin.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles/21-warehouse-workspace.css', import.meta.url), 'utf8');

test('magazyn ma jedną nawigację pogrupowaną według procesu pracy', () => {
  const section = navigation.slice(navigation.indexOf('function magazynSubnavHTML'), navigation.indexOf('function agentAISubnavHTML'));
  for (const label of ['Centrum', 'Kontrola', 'Struktura', 'Operacje']) assert.match(section, new RegExp(`label:"${label}"`));
  for (const route of ['dostawcy', 'stany', 'lokalizacje', 'etykiety-qr', 'plan', 'ruchy']) assert.ok(section.includes(`#/admin/magazyn/${route}`));
  assert.match(section, /warehouse-module-nav/);
  assert.match(section, /aria-current="page"/);
});

test('każda podstrona magazynu używa wspólnego kontekstu i stanu bazy', () => {
  const context = inventory.slice(inventory.indexOf('function magazynKontekstPodstronyHTML'), inventory.indexOf('function magazynPlanZatowarowaniaHTML'));
  for (const page of ['pulpit', 'dostawcy', 'stany', 'lokalizacje', 'etykiety-qr', 'plan', 'ruchy']) assert.match(context, new RegExp(`${page.replace('-', '\\-')}:|"${page}":`));
  assert.match(context, /warehouse-page-context/);
  assert.match(context, /Wspólna baza aktywna/);
  assert.match(context, /magazynGlobalnySkanerOtworz/);
  assert.match(inventory, /class="warehouse-workspace"/);
});

test('wspólny wygląd magazynu jest responsywny i ładowany wyłącznie z panelem', () => {
  const admin = ASSET_BUNDLES.find(bundle => bundle.output === 'assets/admin.css');
  const publicStyles = ASSET_BUNDLES.find(bundle => bundle.output === 'assets/styles.css');
  assert.ok(admin.sources.includes('src/styles/21-warehouse-workspace.css'));
  assert.ok(!publicStyles.sources.includes('src/styles/21-warehouse-workspace.css'));
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /warehouse-module-groups/);
  assert.match(styles, /warehouse-page-context/);
  assert.match(styles, /warehouse-document-layout/);
  assert.match(styles, /warehouse-location-command-center/);
  assert.match(styles, /warehouse-qr-page/);
});

test('podstrony mają osobne narzędzia operacyjne, a nie tylko wspólne obramowanie', () => {
  assert.match(inventory, /warehouse-dashboard-flow/);
  assert.match(inventory, /function magazynDostawcaWierszHTML/);
  assert.match(inventory, /Kontrola i historia/);
  assert.match(inventory, /warehouse-movements-overview/);
  assert.match(inventory, /magazynEksportujRuchyCSV/);
  assert.match(inventory, /Dokumenty PZ\/WZ/);
  assert.match(styles, /supplier-check-cell/);
  assert.match(styles, /warehouse-movement-toolbar/);
});
