import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("katalogi obsługują hierarchię i dziedziczenie grup menu",async()=>{
  const base=await read("src/frontend/04-accounts-orders-settings.js");
  const ui=await read("src/frontend/14a-category-workspace.js");
  assert.match(base,/function rodziceKategoriiMenu\(/);
  assert.match(base,/function drzewoKategoriiMenuHTML\(/);
  assert.match(base,/przypisaneBezposrednio\.has\(korzenKategoriiMenu/);
  assert.match(ui,/function ustawPodkatalog\(/);
  assert.match(ui,/Nie można utworzyć pętli w katalogach/);
  assert.match(ui,/menu → katalog główny → podkatalog → kolejna gałąź → produkt/);
  assert.match(ui,/function katalogDrzewoAdminHTML/);
  assert.match(ui,/function katalogOpcjeHierarchiczneHTML/);
  assert.match(ui,/Balony → Balony foliowe → Balony serca/);
  assert.match(ui,/Nieprzypisane katalogi/);
  assert.match(ui,/dziedziczy/);
});

test("przypięcie katalogu jest jednoznaczne i nie zmienia produktów",async()=>{
  const ui=await read("src/frontend/14a-category-workspace.js");
  assert.match(ui,/function przypiszKatalogDoGrupy\(/);
  assert.match(ui,/kategorie:g\.kategorie\.filter\(k=>k!==root&&k!==katalog\)/);
  assert.match(ui,/Produkty pozostają bezpiecznie w swoich kartotekach/);
  assert.match(ui,/Każdy katalog główny może być przypięty tylko do jednej grupy/);
});

test("mapowanie ma wyszukiwanie, statusy, operacje masowe, eksport i paginację",async()=>{
  const ui=await read("src/frontend/14a-category-workspace.js");
  assert.match(ui,/adminWyszukiwaniePanelHTML/);
  assert.match(ui,/adminOperacjeWynikowHTML/);
  assert.match(ui,/function mapowanieStatusWiersza/);
  for(const status of ["reczne","zrodlo","zmienione","brak","bez-grupy","podkatalog"]){assert.ok(ui.includes(`"${status}"`),`brak statusu ${status}`);}
  assert.match(ui,/function mapowanieEksportuj/);
  assert.match(ui,/adminEksportujCSV/);
  assert.match(ui,/function ustawStroneMapowania/);
  assert.match(ui,/1000/);
});

test("warstwa wizualna obejmuje katalogi, mapowanie i responsywne podmenu",async()=>{
  const admin=await read("src/styles/07-admin-domains.css");
  const header=await read("src/styles/02-header.css");
  for(const cls of [".catalog-stat-grid",".catalog-group-card",".catalog-unassigned-grid",".catalog-inventory-table",".mapping-table",".mapping-status"]){assert.ok(admin.includes(cls),`brak ${cls}`);}
  assert.match(admin,/@media\(max-width:760px\)/);
  assert.match(header,/\.nav-category-children/);
});

test("nowy moduł jest częścią budowanego panelu administracyjnego",async()=>{
  const build=await read("scripts/build-assets.mjs");
  assert.match(build,/src\/frontend\/14a-category-workspace\.js/);
});
