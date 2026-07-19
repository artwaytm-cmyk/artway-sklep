import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ASSET_BUNDLES } from '../scripts/build-assets.mjs';

const source = await readFile(new URL('../src/frontend/10-warehouse-documents.js', import.meta.url), 'utf8');
const inventory = await readFile(new URL('../assets/admin.js', import.meta.url), 'utf8');
const netlify = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');

test('Plan zawiera ręczne dokumenty PZ i WZ z jednym końcowym księgowaniem', () => {
  assert.match(inventory, /magazynDokumentyPanelHTML\(\)/);
  assert.match(source, /warehouse-document-confirm/);
  assert.match(source, /Dane i ilości są zgodne ze stanem faktycznym/);
  assert.match(source, /warehouse-document-line-upsert/);
  assert.match(source, /warehouse-document-line-remove/);
  assert.match(source, /warehouse-document-delete/);
  assert.match(source, /Usuń szkic trwale/);
  assert.match(source, /data-warehouse-document-decision="delete"/);
  assert.ok(source.indexOf('${magazynDokumentDecyzjaHTML(doc)}${draftWorkspace}')>source.indexOf('function magazynDokumentEditorHTML'));
  assert.match(source, /Zaksięgowanego PZ\/WZ nie usuwa się bez korekty stanu/);
  assert.match(source, /warehouse-document-correction/);
  assert.match(source, /Utwórz korektę/);
  assert.match(source, /warehouse-document-drawer/);
  assert.match(source, /role="dialog" aria-modal="true"/);
  assert.match(source, /Kontrolowany przebieg/i);
});

test('skanowanie działa aparatem telefonu oraz polem dla czytnika USB lub Bluetooth', () => {
  assert.match(source, /BarcodeDetector/);
  assert.match(source, /BrowserMultiFormatReader/);
  assert.match(source, /warehouseCameraQuantity/);
  assert.match(source, /magazynDokumentKameraUstawIlosc/);
  assert.match(source, /magazynDokumentKameraPodsumowanieHTML/);
  assert.match(source, /value,quantity,true/);
  assert.match(source, /PRZYJĘCIE NA STAN/);
  assert.match(source, /EAN, GTIN, QR i Code 128/);
  assert.match(source, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(source, /facingMode:\{ideal:"environment"\}/);
  assert.match(source, /Czytnik USB\/Bluetooth/);
  assert.match(source, /data-warehouse-scan-input/);
  assert.match(source, /ZATWIERDZONA PÓŁKA/);
  assert.match(source, /QR półki/);
  assert.match(source, /magazynGlobalnySkanerOtworz/);
  assert.match(source, /kontrolowane zatwierdzanie/);
  assert.match(netlify, /Permissions-Policy = "camera=\(self\), microphone=\(\)/);
});

test('przyjęcie prowadzi operatora przez zatwierdzoną półkę, produkt i ilość', () => {
  assert.match(source, /magazynDokumentSkanSesje/);
  assert.match(source, /magazynDokumentPotwierdzLokalizacjeSkanu/);
  assert.match(source, /magazynDokumentZatwierdzBiezacaPozycje/);
  assert.match(source, /Poprzednia pozycja zatwierdzona automatycznie/);
  assert.match(source, /Zatwierdź produkt i przejdź dalej/);
  assert.match(source, /Najpierw zatwierdź bieżący zeskanowany produkt/);
  assert.match(source, /BIEŻĄCY PRODUKT — JESZCZE NIEZAPISANY/);
  assert.match(source, /Odrzuć odczyt/);
});

test('moduł i responsywne style są częścią budowanego panelu administratora', () => {
  const admin = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.js');
  const styles = ASSET_BUNDLES.find((bundle) => bundle.output === 'assets/admin.css');
  assert.ok(admin.sources.includes('src/frontend/10-warehouse-documents.js'));
  assert.ok(styles.sources.includes('src/styles/18-warehouse-documents.css'));
});
