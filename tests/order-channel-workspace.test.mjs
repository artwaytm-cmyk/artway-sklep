import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("sklep, Allegro i Von Halsky używają jednego układu etapów, filtrów i listy",async()=>{
  const [shared,store,storeFilters,allegro,von]=await Promise.all([
    read("src/frontend/08-admin-navigation.js"),
    read("src/frontend/11-store-orders.js"),
    read("src/frontend/11-allegro-and-orders.js"),
    read("src/frontend/11-allegro-operations.js"),
    read("src/frontend/11d-von-halsky-operations-workspace.js"),
  ]);
  assert.match(shared,/function adminEtapyRealizacjiZamowienHTML/);
  assert.match(shared,/function adminNaglowekListyZamowienHTML/);
  assert.match(shared,/function adminAkcjeCentrumZamowienHTML/);
  assert.match(shared,/onclick="\$\{onclick\}"/);
  assert.doesNotMatch(shared,/onclick="\$\{esc\(onclick\)\}"/);
  assert.match(shared,/channel-orders-stage-grid/);
  assert.match(shared,/channel-orders-results-head/);
  assert.match(store,/adminEtapyZamowienSklepuHTML\(wszystkie\)/);
  assert.match(store,/adminNaglowekListyZamowienHTML\(\{id:"store-orders"/);
  assert.match(store,/channel-orders-filter-fields/);
  assert.doesNotMatch(store,/adminZamowieniaStatyHTML/);
  assert.match(storeFilters,/filtrOkresuZamowienSklepu/);
  assert.match(storeFilters,/filtrDostawyZamowienSklepu/);
  assert.match(allegro,/adminEtapyRealizacjiZamowienHTML\(\{active:filtrAllegroZamowien/);
  assert.match(allegro,/adminNaglowekListyZamowienHTML\(\{id:"allegro-orders"/);
  assert.match(allegro,/filtrStatusuKanaluAllegroZamowien/);
  assert.match(von,/adminEtapyRealizacjiZamowienHTML\(\{active:records\.fulfillment/);
  assert.match(von,/adminNaglowekListyZamowienHTML\(\{id:`von-halsky-\$\{kind\}`/);
  for(const label of ["Etap realizacji","Status kanału","Okres","Sposób doręczenia","Sortowanie"]){
    assert.ok(store.includes(label),`sklep: brak pola ${label}`);
    assert.ok(allegro.includes(label),`Allegro: brak pola ${label}`);
    assert.ok(von.includes(label),`Von Halsky: brak pola ${label}`);
  }
});

test("każdy kanał ma tę samą ręczną aktualizację planu i Von Halsky nie alarmuje zakończonymi",async()=>{
  const [shared,store,allegro,source]=await Promise.all([read("src/frontend/08-admin-navigation.js"),read("src/frontend/11-store-orders.js"),read("src/frontend/11-allegro-operations.js"),read("src/frontend/11d-von-halsky-operations-workspace.js")]);
  assert.match(shared,/data-plan-refresh/);
  assert.match(shared,/Aktualizuj plan zatowarowania/);
  assert.match(store,/source:"store-orders-manual"/);
  assert.match(allegro,/source:"allegro-orders-manual"/);
  assert.match(source,/source:"von-halsky-orders-manual"/);
  assert.match(source,/orderAttention=Math\.max\(0,Number\(records\.facets\?\.do_obslugi\)\|\|0\)/);
  assert.match(source,/kind===id&&badge\?/);
  assert.doesNotMatch(source,/kind===id\?`<em>\$\{records\.total\}<\/em>`/);
  assert.match(source,/urgent=Number\(facets\.do_obslugi\)\|\|0/);
});

test("główne wskaźniki i akcje centrum są identyczne w trzech kanałach",async()=>{
  const sources=await Promise.all([read("src/frontend/11-store-orders.js"),read("src/frontend/11-allegro-operations.js"),read("src/frontend/11d-von-halsky-operations-workspace.js")]);
  for(const source of sources){
    for(const label of ["Wymaga działania","Do nadania","W drodze","Zakończone"])assert.ok(source.includes(`label:"${label}"`),`brak wskaźnika ${label}`);
    assert.match(source,/adminAkcjeCentrumZamowienHTML/);
  }
});
