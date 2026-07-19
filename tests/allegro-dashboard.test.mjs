import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('nawigacja Allegro pokazuje tylko liczniki wymagające działania', async () => {
  const source = await readFile('assets/admin.js', 'utf8');
  const start = source.indexOf('function allegroSubnavHTML');
  const end = source.indexOf('function allegroWorkspaceSectionHTML', start);
  const nav = source.slice(start, end);

  assert.match(nav, /id:"oferty",href:"#\/admin\/allegro\/oferty",label:"🏷️ Oferty"}/);
  assert.ok(!/id:"oferty"[^\n]+badge:/.test(nav), 'rozmiar katalogu ofert nie może być alarmem w menu');
  assert.match(nav, /badge:st\.aktywneZamowienia/);
  assert.match(nav, /badge:st\.wiadomosci/);
  assert.match(nav, /badge:st\.dyskusje/);
  assert.match(nav, /badge:st\.naruszenia/);
});

test('pulpit Allegro rozdziela kolejkę pracy od danych katalogowych', async () => {
  const source = await readFile('assets/admin.js', 'utf8');
  const css = await readFile('src/styles/07-admin-domains.css', 'utf8');

  assert.match(source, /function allegroPanelOperacyjnyStaty/);
  assert.ok(!source.includes('const mapped=(allegroOferty||[]).filter(o=>allegroProduktDlaOferty(o.id)).length'), 'render nie może ponownie skanować całego katalogu ofert');
  for (const marker of ['allegro-command-hero', 'allegro-command-priorities', 'allegro-catalog-overview', 'allegro-system-overview', 'allegro-module-directory']) {
    assert.ok(source.includes(marker), `brak sekcji pulpitu: ${marker}`);
    assert.ok(css.includes(`.${marker}`), `brak stylu sekcji pulpitu: ${marker}`);
  }
  assert.match(source, /Liczniki w menu pokazują wyłącznie realną pracę/);
  assert.match(source, /aktywna==="start"\?"":allegroWorkspaceSectionHTML/);
});
