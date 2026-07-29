import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('edytor pobiera pełną centralną kartotekę przed pokazaniem formularza', async () => {
  const [editor, actions, inventory] = await Promise.all([
    readFile('src/frontend/12-product-editor.js', 'utf8'),
    readFile('src/frontend/12a-product-actions.js', 'utf8'),
    readFile('src/frontend/05-catalog-inventory.js', 'utf8'),
  ]);
  assert.match(editor, /productEditorPobierzPelnaKartoteke/);
  assert.match(editor, /detailLevel!=="full"/);
  assert.match(editor, /productEditorPelnaKartotekaBledy/);
  assert.match(actions, /detailLevel:"full"/);
  assert.match(inventory, /asortymentPelnyProduktPoId/);
});

test('zapis pełnego produktu wysyła tylko różnicę i jawne usunięcia', async () => {
  const editor = await readFile('src/frontend/12-product-editor.js', 'utf8');
  assert.match(editor, /function produktRoznicaCentralnegoZapisu/);
  assert.match(editor, /fields:change\.fields/);
  assert.match(editor, /remove:change\.remove/);
  assert.match(editor, /zapiszProduktCentralnie\(p,poprzedni\)/);
});

test('pełna kartoteka pokazuje dane producenta, GPSR, Agentów i historię zapisu', async () => {
  const workspace = await readFile('src/frontend/12-product-editor-workspace.js', 'utf8');
  assert.match(workspace, /Pełna kartoteka produktu/);
  assert.match(workspace, /Dane i wyniki zapisane przez Agentów/);
  assert.match(workspace, /Ostatni potwierdzony zapis/);
  assert.match(workspace, /Wszystkie informacje zapisane przy produkcie/);
  assert.match(workspace, /catalog-manufacturer-directory/);
  assert.match(workspace, /Zweryfikowana firma/);
  assert.match(workspace, /Źródło oficjalne/);
});

test('edytor nie wymaga ręcznych przycisków przygotowania kanałów', async () => {
  const editor = await readFile('src/frontend/12-product-editor.js', 'utf8');
  assert.doesNotMatch(editor, />✨ Przygotuj teraz</);
  assert.doesNotMatch(editor, />🤖 Przygotuj i zapisz dane do Allegro</);
  assert.match(editor, /"🚀 Wystaw produkt"/);
});
