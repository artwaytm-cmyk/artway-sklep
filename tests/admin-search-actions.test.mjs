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
});

test("najważniejsze listy panelu korzystają ze wspólnego paska operacji",async()=>{
  const sources=(await Promise.all([
    "assets/app.js",
    "src/frontend/09-seo.js",
    "assets/admin.js",
    "assets/admin.js"
  ].map(read))).join("\n");
  for(const id of ["shipping-orders","seo-products","allegro-orders","allegro-products","store-orders","customers","infakt-pending","infakt-history","warehouse-stock","supplier-availability","assortment-products"]){
    assert.match(sources,new RegExp(`adminOperacjeWynikowHTML\\(\\{id:\"${id}\"`),`brak wspólnych operacji dla ${id}`);
  }
  assert.match(sources,/exportSelected:/);
  assert.match(sources,/exportAll:/);
});
