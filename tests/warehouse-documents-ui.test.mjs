import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ASSET_BUNDLES } from '../scripts/build-assets.mjs';

const source = await readFile(new URL('../src/frontend/10-warehouse-documents.js', import.meta.url), 'utf8');
const inventory = await readFile(new URL('../src/frontend/12-customers-and-inventory.js', import.meta.url), 'utf8');
const netlify = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');

test('Plan zawiera ręczne dokumenty PZ i WZ z jednym końcowym księgowaniem', () => {
  assert.match(inventory, /magazynDokumentyPanelHTML\(\)/);
  assert.match(source, /warehouse-document-confirm/);
  assert.match(source, /Dane i ilości są zgodne ze stanem faktycznym/);
  assert.match(source, /warehouse-document-line-upsert/);
  assert.match(source, /warehouse-document-line-remove/);
});

test('skanowanie działa aparatem telefonu oraz polem dla czytnika USB lub Bluetooth', () => {
  assert.match(source, /BarcodeDetector/);
  assert.match(source, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(source, /facingMode:\{ideal:"environment"\}/);
  assert.match(source, /Czytnik USB\/Bluetooth/);
  assert.match(source, /data-warehouse-scan-input/);
  assert.match(source, /Aktywne miejsce/);
  assert.match(source, /QR miejsca/);
  assert.match(netlify, /Permissions-Policy = "camera=\(self\), microphone=\(\)/);
});

test('moduł i responsywne style są częścią budowanego panelu administratora', () => {
  const admin = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  const styles = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.css');
  assert.ok(admin.sources.includes('src/frontend/10-warehouse-documents.js'));
  assert.ok(styles.sources.includes('src/styles/18-warehouse-documents.css'));
});
