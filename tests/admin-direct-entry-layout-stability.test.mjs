import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('bezpośrednie wejście do panelu ładuje style blokująco i zachowuje powłokę do pełnego renderu', async () => {
  const [html, router, foundation, shell] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('src/frontend/06-router-and-storefront.js', 'utf8'),
    readFile('src/styles/01-foundation.css', 'utf8'),
    readFile('src/styles/06-admin-shell.css', 'utf8'),
  ]);
  assert.equal((html.match(/src="\/assets\/admin-boot\.js/g)||[]).length, 2);
  const boot = await readFile('src/frontend/00-admin-direct-entry-boot.js', 'utf8');
  assert.match(boot, /artway-admin-boot/);
  assert.match(boot, /id="artwayAdminStyles" rel="stylesheet"/);
  assert.match(boot, /data-admin-boot/);
  assert.match(router, /const boot=root\.querySelector\(":scope > \[data-admin-boot\]"\)/);
  assert.match(router, /if\(!boot\)w\.innerHTML=/);
  assert.match(foundation, /html\.artway-admin-boot body>\.topbar/);
  assert.match(shell, /\.admin-boot-shell \.admin-tresc/);
});
