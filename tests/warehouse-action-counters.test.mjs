import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("liczniki nawigacji magazynu pokazują wyłącznie braki do aktywnych zamówień",async()=>{
  const [navigation,warehouse]=await Promise.all([read("assets/admin-warehouse.js"),read("assets/admin-shell.js")]);
  const subnav=navigation.slice(navigation.indexOf("function magazynSubnavHTML"),navigation.indexOf("const ASORTYMENT_PARTIA_KART"));
  assert.match(subnav,/const plan=typeof potrzebyZatowarowania==="function"\?potrzebyZatowarowania\(\):\[\],braki=plan\.length/);
  assert.match(subnav,/badge:braki\|\|""/);
  assert.doesNotMatch(subnav,/produktyAktywne\.length|ruchyMagazynowe|prod\.niskie|prod\.braki/);
  assert.match(warehouse,/const brakiDoZamowien=typeof rezerwacjeMagazynowe==="function"\?potrzebyZatowarowania\(\)\.length:0/);
  assert.match(warehouse,/"\/admin\/magazyn": brakiDoZamowien/);
});

test("zakupy producentów i lokalizacje magazynowe mają odrębne zakresy",async()=>{
  const warehouse=await read("assets/admin-warehouse.js");
  assert.match(warehouse,/const planProdukty=planZakupu\.map\(x=>x\.produkt\),planIds=new Set/);
  assert.match(warehouse,/const brakiDostawcyPlanu=planProdukty\.filter/);
  assert.match(warehouse,/const lokalizacjeDoUstalenia=/);
  assert.match(warehouse,/filtrMagazynu==="lokalizacje-zamowien"/);
  assert.match(warehouse,/const fizyczneProdukty=/);
  assert.match(warehouse,/bezLokalizacjiFizyczne=/);
  assert.match(warehouse,/supplierStats\.braki\.filter\(\(\{p\}\)=>planIds\.has/);
  assert.match(warehouse,/supplierStats\.niskie\.filter\(\(\{p\}\)=>planIds\.has/);
});
