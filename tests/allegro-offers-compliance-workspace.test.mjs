import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(path,"utf8");

test("oferty Allegro korzystają z pełnego wzorca centrum wystawiania",async()=>{
  const source=await read("src/frontend/12c-commerce-catalog-actions.js"),styles=await read("src/styles/29-commerce-catalog-actions.css");
  for(const marker of ["allegro-offers-workspace","allegro-listing-hero","allegro-listing-metrics","adminWyszukiwaniePanelHTML","adminOperacjeWynikowHTML","allegro-listing-pagination","allegroOfertyEksportujZakres"]){
    assert.match(source,new RegExp(marker));
  }
  assert.match(source,/\[25,50,100,250,500,1000\]/);
  assert.match(styles,/\.allegro-offers-workspace/);
});

test("ciężkie listy Allegro tworzą karty stopniowo zamiast blokować wejście",async()=>{
  const source=await read("src/frontend/12c-commerce-catalog-actions.js"),mapping=await read("src/frontend/11-allegro-mapping-index.js"),sync=await read("src/frontend/03-cloud-sync.js"),styles=await read("src/styles/29-commerce-catalog-actions.css");
  assert.match(source,/function allegroProgresywneKartyHTML/);
  assert.match(source,/items\.slice\(0,batch\)/);
  assert.match(source,/state\.items\.slice\(state\.index,state\.index\+12\)/);
  assert.match(source,/new IntersectionObserver/);
  assert.match(source,/allegroProgresywneKartyHTML\(rows,allegroPublikacjaKartaHTML,"wystawianie"\)/);
  assert.match(source,/allegroProgresywneKartyHTML\(rows,allegroOfertaMapowanieCardHTML,"oferty"\)/);
  assert.match(mapping,/function allegroProduktyMapowaniaAktywne/);
  assert.match(mapping,/const produkty=allegroProduktyMapowaniaAktywne\(\)/);
  assert.doesNotMatch(mapping,/function allegroKandydaciMapowaniaOferty\([^)]*\)\{const produkty=produktyDoAdministracji\(\)\.filter/);
  assert.match(sync,/const poprawione=produktyDodane\.map/);
  assert.match(sync,/if\(!zmiana\) return false;\s*produktyDodane=poprawione;/);
  assert.match(styles,/content-visibility:auto/);
});

test("Zgodność jest tarczą opisów i alarmuje tylko o otwartych naruszeniach",async()=>{
  const source=await read("src/frontend/12c-commerce-catalog-actions.js"),workspace=await read("src/frontend/11-allegro-workspace.js");
  for(const marker of ["Bezpieczeństwo opisów Allegro","Ta podstrona nie zmienia sprzedaży ani stanów","Sprawdza opis","Blokuje ryzyko","Naprawia układ","Jak działa ochrona i narzędzia dodatkowe"]){
    assert.match(source,new RegExp(marker));
  }
  assert.match(source,/actionable=!item\.ok&&!item\.fixed&&!item\.error/);
  assert.match(workspace,/compliance\.filter\(x=>!x\.ok&&!x\.fixed&&!x\.error\)/);
});
