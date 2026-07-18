import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("menu kategorii działa kliknięciem i klawiaturą z poprawnymi atrybutami dostępności",async()=>{
  const navigation=await read("src/frontend/04-accounts-orders-settings.js");
  assert.match(navigation,/aria-haspopup="true" aria-expanded="false" aria-controls=/);
  assert.match(navigation,/function przelaczMenuKategorii/);
  assert.match(navigation,/function zamknijMenuKategorii/);
  assert.match(navigation,/event\.key==="ArrowDown"/);
  assert.match(navigation,/event\.key==="Escape"/);
  assert.match(navigation,/role="region"/);
});

test("duży katalog ma wyszukiwarkę, komunikat pustego wyniku i nie przewija się poziomo",async()=>{
  const [navigation,header,responsive]=await Promise.all([
    read("src/frontend/04-accounts-orders-settings.js"),
    read("src/styles/02-header.css"),
    read("src/styles/09-notifications-and-responsive.css")
  ]);
  assert.match(navigation,/function filtrujKategorieMenu/);
  assert.match(navigation,/placeholder="Szukaj kategorii…"/);
  assert.match(navigation,/Brak kategorii pasujących do wyszukiwania/);
  assert.match(header,/overflow-y:auto;overflow-x:hidden/);
  assert.match(header,/\.nav-menu-heading/);
  assert.match(header,/\.nav-count\{[^}]*border-radius:999px/);
  assert.match(header,/@media\(max-width:900px\)[^{]*\{[^}]*\.nav-row/);
  assert.match(header,/\.nav-mobile-categories>\.nav-menu-mega\{left:0;right:auto/);
  assert.match(responsive,/\.nav-mobile-categories \.nav-menu-mega/);
});
