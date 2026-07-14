import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("liczniki nawigacji magazynu pokazują wyłącznie braki do aktywnych zamówień",async()=>{
  const [navigation,warehouse]=await Promise.all([read("src/frontend/11-allegro-and-orders.js"),read("src/frontend/07-admin-shipping.js")]);
  const subnav=navigation.slice(navigation.indexOf("function magazynSubnavHTML"),navigation.indexOf("function infaktSubnavHTML"));
  assert.match(subnav,/const plan=potrzebyZatowarowania\(\),braki=plan\.length/);
  assert.match(subnav,/badge:braki\|\|""/);
  assert.doesNotMatch(subnav,/produktyAktywne\.length|ruchyMagazynowe|prod\.niskie|prod\.braki/);
  assert.match(warehouse,/"\/admin\/magazyn": potrzebyZatowarowania\(\)\.length/);
});

test("zadania kartoteki i producentów są ograniczone do produktów faktycznie brakujących",async()=>{
  const warehouse=await read("src/frontend/12-customers-and-inventory.js");
  assert.match(warehouse,/const planProdukty=planZakupu\.map\(x=>x\.produkt\),planIds=new Set/);
  assert.match(warehouse,/const brakiKartoteki=planProdukty\.filter/);
  assert.match(warehouse,/const alertyStanow=planProdukty/);
  assert.match(warehouse,/supplierStats\.braki\.filter\(\(\{p\}\)=>planIds\.has/);
  assert.match(warehouse,/supplierStats\.niskie\.filter\(\(\{p\}\)=>planIds\.has/);
});
