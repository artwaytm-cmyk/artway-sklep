import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("Von Halsky korzysta ze wspólnego, zaawansowanego panelu filtrowania",async()=>{
  const source=await read("src/frontend/11b-von-halsky-workspace.js");
  assert.match(source,/adminWyszukiwaniePanelHTML\(\{id:"von-halsky-products"/);
  assert.match(source,/adminOperacjeWynikowHTML\(\{id:"von-halsky-products"/);
  for(const label of [
    "Problem do rozwiązania",
    "Jakość danych",
    "Praca Agenta",
    "Status kanału",
    "Producent",
    "Kategoria sklepu",
    "Cena kanału",
    "Dostępność",
    "Sortowanie",
    "Na stronie",
  ])assert.ok(source.includes(label),`brak filtra: ${label}`);
  assert.match(source,/\[25,50,100,250,500,1000\]/);
  assert.match(source,/function vonHalskyResetujFiltry/);
});

test("tabela Von Halsky przestrzega standardu desktop i mobile",async()=>{
  const [source,style]=await Promise.all([
    read("src/frontend/11b-von-halsky-workspace.js"),
    read("src/styles/37-von-halsky-workspace.css"),
  ]);
  assert.match(source,/class="admin-standard-table admin-responsive-table von-halsky-table"/);
  for(const label of ["Produkt","Identyfikacja","Gotowość","Cena i kanał","Akcje"]){
    assert.match(source,new RegExp(`data-label="${label}"`),`brak etykiety mobilnej: ${label}`);
  }
  assert.match(source,/class="allegro-listing-results-head"/);
  assert.match(source,/class="allegro-listing-pagination von-halsky-pagination"/);
  assert.match(source,/class="von-halsky-row-secondary"/);
  assert.match(style,/\.von-halsky-table\{width:100%;min-width:0!important;table-layout:fixed\}/);
  assert.doesNotMatch(style,/\.von-halsky-table\{min-width:1120px\}/);
  assert.doesNotMatch(style,/\.von-halsky-stage-filters\{display:flex;overflow-x:auto/);
  assert.match(style,/\.von-halsky-stage-filters\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}/);
});

test("przygotowanie Von Halsky pokazuje rzeczywisty postęp i zapisuje produkty pojedynczo",async()=>{
  const [source,editor,style]=await Promise.all([
    read("src/frontend/11b-von-halsky-workspace.js"),
    read("src/frontend/12-product-editor-workspace.js"),
    read("src/styles/37-von-halsky-workspace.css"),
  ]);
  assert.match(source,/Rzeczywisty postęp przygotowania/);
  assert.match(source,/for\(let index=0;index<ids\.length;index\+=1\)/);
  assert.match(source,/body:\{productIds:\[productId\]\}/);
  assert.match(source,/vonHalskyAktualizujPostepDOM/);
  assert.match(source,/Zapis centralny potwierdzony/);
  assert.match(source,/href="#\/admin\/produkty\/edytuj\//);
  assert.match(style,/\.von-halsky-progress-track/);
  assert.match(editor,/productEditorVonHalskyAuditHTML/);
  assert.match(editor,/Zapisane w tej kartotece/);
  assert.match(editor,/vonHalskyAgentReadbackConfirmed/);
});
