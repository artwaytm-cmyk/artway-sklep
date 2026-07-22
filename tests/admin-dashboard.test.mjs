import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {ASSET_BUNDLES} from "../scripts/build-assets.mjs";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("pulpit ma pięć spójnych podstron operacyjnych",async()=>{
  const [router,dashboard]=await Promise.all([
    read("assets/app.js"),
    read("src/frontend/19-admin-dashboard.js")
  ]);
  assert.match(router,/t\.startsWith\("\/admin\/pulpit\/"\)/);
  for(const route of ["operacje","sprzedaz","alerty","system"]){
    assert.match(dashboard,new RegExp(`#\\/admin\\/pulpit\\/${route}`),`brak podstrony ${route}`);
  }
  for(const label of ["Przegląd","Operacje dzisiaj","Sprzedaż","Alerty","Stan systemu"]){
    assert.match(dashboard,new RegExp(label),`brak zakładki ${label}`);
  }
});

test("liczniki pulpitu wynikają z aktywnej pracy, a nie samego stanu zero",async()=>{
  const dashboard=await read("src/frontend/19-admin-dashboard.js");
  assert.match(dashboard,/allegro\.filter\(allegroZamowienieAktywneLokalnie\)/);
  assert.match(dashboard,/plan=potrzebyZatowarowania\(\)/);
  assert.match(dashboard,/bez alarmów od samego stanu 0/);
  assert.match(dashboard,/!\["anulowane","dostarczone","zakończone","zwrot","zwrot pieniędzy"\]/);
});

test("pulpit pozostaje modułem ładowanym tylko w panelu administratora",()=>{
  const publicBundle=ASSET_BUNDLES.find(bundle=>bundle.output==="assets/app.js");
  const adminBundle=ASSET_BUNDLES.find(bundle=>bundle.output==="assets/admin.js");
  assert.ok(!publicBundle.sources.includes("src/frontend/19-admin-dashboard.js"));
  assert.ok(adminBundle.sources.includes("src/frontend/19-admin-dashboard.js"));
});

test("pulpit obsługuje integracje, eksport i synchronizację bez Paynow",async()=>{
  const dashboard=await read("src/frontend/19-admin-dashboard.js");
  for(const integration of ["Wspólna baza","E-mail automatyczny","InPost","Allegro","inFakt"]){
    assert.match(dashboard,new RegExp(integration),`brak stanu ${integration}`);
  }
  assert.match(dashboard,/function adminPulpitEksportujRaport/);
  assert.match(dashboard,/tylkoSprzedaz\?"summary":"orders"/);
  assert.doesNotMatch(dashboard,/Paynow/i);
});

test("wykres pulpitu zachowuje ostatnie poprawne dane i odświeża je bez czyszczenia widoku",async()=>{
  const dashboard=await read("src/frontend/19-admin-dashboard.js");
  assert.match(dashboard,/ADMIN_PULPIT_SNAPSHOT_KEY/);
  assert.match(dashboard,/recentAllegro/);
  assert.match(dashboard,/pulpitSnapshotMaDane\("allegro",dni\)/);
  assert.match(dashboard,/Aktualizuję w tle — poprzednie dane pozostają widoczne/);
  assert.match(dashboard,/adminPulpitOdswiez\(false,true,true\)/);
  assert.match(dashboard,/allegroWczytajDane\(true,false,tylkoSprzedaz\?"summary":"orders"\)/);
  assert.match(dashboard,/allegroDaneOdczytAt\?\.summary/);
  assert.doesNotMatch(dashboard,/adminPulpitWykresHTML\(7\)/);
});
