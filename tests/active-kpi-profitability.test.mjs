import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("kafelki wdrożenia produktów Agenta AI są aktywnymi filtrami",async()=>{
  const [runtime,agent]=await Promise.all([
    read("src/frontend/02-runtime-state.js"),
    read("assets/admin.js")
  ]);
  assert.match(runtime,/filtrAgentAIProdukty="wszystkie"/);
  assert.match(agent,/function ustawFiltrAgentAIProduktow/);
  assert.match(agent,/class="order-stat-card stat-filter/);
  for(const filter of ["uwaga","przetwarzanie","gotowe","wszystkie"]){
    assert.match(agent,new RegExp(`\\["${filter}"`),`brak filtra ${filter}`);
  }
  assert.match(agent,/x\.state\.ready&&x\.status!=="processing"/);
  assert.match(agent,/!x\.state\.ready&&x\.status!=="processing"/);
});

test("opłacalność ma ręczne zatwierdzenie, wykrywanie zmian i filtry statusów",async()=>{
  const source=await read("assets/admin.js");
  for(const fn of ["rentownoscSygnaturaWeryfikacji","rentownoscStatusWeryfikacji","oznaczRentownoscSprawdzona","oznaczZaznaczoneRentownosc","zaznaczWidoczneRentownosc"]){
    assert.match(source,new RegExp(`function ${fn}\\(`),`brak funkcji ${fn}`);
  }
  for(const filter of ["niesprawdzone","sprawdzone","nieaktualne"]){
    assert.match(source,new RegExp(`filtrAllegroRentownosc==="${filter}"`),`brak filtra ${filter}`);
  }
  assert.match(source,/profitabilityReviewSignature/);
  assert.match(source,/profitabilityReviewSnapshot/);
  assert.match(source,/Sprawdzone — moje ustawienie/);
  assert.match(source,/Zaznacz widoczne/);
  assert.match(source,/Do ponownej kontroli/);
});

test("zatwierdzenie rentowności synchronizuje się ze wspólną bazą i trafia do audytu",async()=>{
  const source=await read("assets/admin.js");
  const start=source.indexOf("function rentownoscZapiszWeryfikacje");
  const body=source.slice(start,start+2500);
  assert.match(body,/artway_produkty_dodane/);
  assert.match(body,/artway_produkty_edytowane/);
  assert.match(body,/zaplanujZapisUstawien\(\)/);
  assert.match(body,/zapiszHistorieAgenta\("kontrola-rentownosci"/);
});
