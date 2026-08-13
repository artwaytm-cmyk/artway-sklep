import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("wspólny panel wyszukiwania obsługuje wybór i eksport zakresu",async()=>{
  const navigation=await read("src/frontend/08-admin-navigation.js");
  assert.match(navigation,/function adminOperacjeWynikowHTML/);
  assert.match(navigation,/Zaznacz stronę/);
  assert.match(navigation,/Zaznacz wszystkie wyniki/);
  assert.match(navigation,/Eksportuj plik/);
  assert.match(navigation,/Zaznaczone \(<span data-admin-selected-count>\$\{n\}<\/span>\)/);
  assert.match(navigation,/data-admin-selected-required/);
  assert.match(navigation,/Wszystkie wyniki \(\$\{results\}\)/);
  assert.match(navigation,/Odznacz stronę/);
  assert.match(navigation,/Odznacz wyniki/);
  assert.match(navigation,/Wyczyść cały wybór/);
});

test("najważniejsze listy panelu korzystają ze wspólnego paska operacji",async()=>{
  const sources=(await Promise.all([
    "assets/app.js",
    "src/frontend/09-seo.js",
    "assets/admin.js",
    "assets/admin-inventory.js"
  ].map(read))).join("\n");
  for(const id of ["shipping-orders","seo-products","allegro-listing-products","allegro-offers","customers","infakt-pending","infakt-history","warehouse-stock","supplier-availability","assortment-products","von-halsky-products"]){
    assert.match(sources,new RegExp(`adminOperacjeWynikowHTML\\(\\{id:\"${id}\"`),`brak wspólnych operacji dla ${id}`);
  }
  for(const id of ["allegro-orders","store-orders"]){
    assert.match(sources,new RegExp(`adminNaglowekListyZamowienHTML\\(\\{id:\"${id}\"`),`brak wspólnego nagłówka listy dla ${id}`);
  }
  assert.match(sources,/exportSelected:/);
  assert.match(sources,/exportAll:/);
  assert.match(sources,/deselectPage:/);
  assert.match(sources,/deselectAll:/);
});

test("stronicowane katalogi rozdzielają zakres strony i pełnego filtra",async()=>{
  const [allegro,assortment,vonHalsky]=await Promise.all([
    read("src/frontend/12c-commerce-catalog-actions.js"),
    read("src/frontend/12-warehouse-assortment-view.js"),
    read("src/frontend/11b-von-halsky-workspace.js"),
  ]);
  assert.match(allegro,/serverData\.ids/);
  assert.match(allegro,/selectAll:"allegroZaznaczZakresWystawiania\('filtr',true\)"/);
  assert.match(allegro,/deselectAll:"allegroZaznaczZakresWystawiania\('filtr',false\)"/);
  assert.match(assortment,/deselectAll:"asortymentZaznaczZakres\('filtr',false\)"/);
  assert.match(vonHalsky,/selection:"ids"/);
  assert.match(vonHalsky,/selectedCount=vonHalskyZaznaczone\.size/);
});
