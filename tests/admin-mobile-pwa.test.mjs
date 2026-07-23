import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { ASSET_BUNDLES } from '../scripts/build-assets.mjs';

const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
const index=await readFile('index.html','utf8');
const pwa=await readFile('src/frontend/18-pwa.js','utf8');
const worker=await readFile('sw.js','utf8');
const admin=`${await readFile('assets/app.js','utf8')}\n${await readFile('assets/admin-shell.js','utf8')}\n${await readFile('assets/admin-warehouse.js','utf8')}`;
const router=await readFile('assets/app.js','utf8');
const scanner=await readFile('src/frontend/10-warehouse-documents.js','utf8');
const scannerCss=await readFile('src/styles/18-warehouse-documents.css','utf8');
const adminCss=await readFile('src/styles/06-admin-shell.css','utf8');

test('panel administratora jest instalowalną aplikacją PWA na telefon', async()=>{
  assert.match(manifest.name,/Panel administratora/);
  assert.match(manifest.start_url,/#\/admin/);
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.shortcuts.some(item=>item.url.includes('scanner=1')));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'&&icon.type==='image/png'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose.includes('maskable')));
  for(const size of [192,512])assert.ok((await stat(`icons/artway-icon-${size}.png`)).size>500);
  assert.match(index,/apple-mobile-web-app-capable/);
  assert.match(index,/apple-touch-icon/);
  assert.match(pwa,/beforeinstallprompt/);
  assert.match(pwa,/serviceWorker\.register\("\/sw\.js"/);
  assert.match(admin,/pwaPrzyciskInstalacjiHTML/);
  const app=ASSET_BUNDLES.find(bundle=>bundle.output==='assets/app.js');
  assert.ok(app.sources.includes('src/frontend/18-pwa.js'));
});

test('zainstalowana aplikacja ma dolny pasek, którego nie pokazuje zwykła przeglądarka',()=>{
  assert.match(pwa,/artway-pwa-standalone/);
  assert.match(pwa,/display-mode: standalone/);
  assert.match(admin,/adminPwaDolneMenuHTML/);
  assert.match(admin,/pwa-admin-bottom-nav/);
  assert.match(admin,/pwaPrzelaczMenuAdmina/);
  assert.match(adminCss,/\.pwa-admin-bottom-nav\{display:none\}/);
  assert.match(adminCss,/html\.artway-pwa-standalone \.pwa-admin-bottom-nav/);
  assert.match(router,/pwa-admin-bottom-nav/);
});

test('Service Worker nie zapisuje prywatnych danych ani odpowiedzi API',()=>{
  assert.match(worker,/isPrivateRequest/);
  assert.match(worker,/url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker,/request\.mode==="navigate"/);
  assert.match(worker,/networkFirst\(request\)/);
  assert.match(worker,/request\.destination==="style"/);
  assert.match(worker,/cache\.delete\(request\)/);
  assert.match(worker,/Nieprawidłowy typ zasobu/);
});

test('skaner jest małym oknem nad każdą podstroną i rozpoznaje kod automatycznie',()=>{
  assert.match(admin,/magazynGlobalnySkanerOtworz/);
  assert.match(scanner,/magazynDokumentKameraDokumentyHTML/);
  assert.match(scanner,/magazynDokumentKameraPrzeciagaj/);
  assert.match(scanner,/getCapabilities\?\.\(\)\.torch/);
  assert.match(scanner,/navigator\.vibrate\?\.\(60\)/);
  assert.match(scanner,/value===magazynDokumentKamera\.lastCode/);
  assert.match(scanner,/BrowserMultiFormatReader/);
  assert.match(scanner,/magazynDokumentKameraPetla/);
  assert.match(scannerCss,/right:16px;bottom:16px;width:min\(430px/);
  assert.match(scannerCss,/warehouse-camera-scanner\.is-minimized/);
  assert.doesNotMatch(scannerCss,/warehouse-camera-scanner\{[^}]*inset:0/);
  assert.doesNotMatch(scannerCss,/(?<!max-)height:calc\(100vh/);
});
