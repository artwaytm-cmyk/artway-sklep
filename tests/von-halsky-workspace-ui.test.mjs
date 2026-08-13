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
  assert.match(source,/queue\.pendingReload/);
  assert.match(source,/key!==vonHalskyKluczZapytaniaProduktow\(\)/);
});

test("tabela Von Halsky przestrzega standardu desktop i mobile",async()=>{
  const [source,style]=await Promise.all([
    read("src/frontend/11b-von-halsky-workspace.js"),
    read("src/styles/37-von-halsky-workspace.css"),
  ]);
  assert.match(source,/class="admin-standard-table admin-responsive-table von-halsky-table"/);
  for(const label of ["Produkt","Identyfikacja","Gotowość","Cena","Kanał sprzedaży","Akcje"]){
    assert.match(source,new RegExp(`data-label="${label}"`),`brak etykiety mobilnej: ${label}`);
  }
  assert.match(source,/class="allegro-listing-results-head"/);
  assert.match(source,/class="allegro-listing-pagination von-halsky-pagination"/);
  assert.match(source,/class="von-halsky-row-secondary"/);
  assert.match(style,/\.von-halsky-table\{width:100%;min-width:0!important;table-layout:fixed\}/);
  assert.doesNotMatch(style,/\.von-halsky-table\{min-width:1120px\}/);
  assert.doesNotMatch(style,/\.von-halsky-stage-filters\{display:flex;overflow-x:auto/);
  assert.match(style,/\.von-halsky-stage-filters\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}/);
  assert.match(style,/\.von-halsky-stage-filters\{grid-template-columns:repeat\(8,minmax\(0,1fr\)\)!important/);
});

test("przygotowanie Von Halsky pokazuje trwały proces serwerowy niezależny od przeglądarki",async()=>{
  const [workspace,live,preparation,editor,style]=await Promise.all([
    read("src/frontend/11b-von-halsky-workspace.js"),
    read("src/frontend/11b-von-halsky-live-process.js"),
    read("src/frontend/11c-von-halsky-preparation.js"),
    read("src/frontend/12-product-editor-workspace.js"),
    read("src/styles/37-von-halsky-workspace.css"),
  ]);
  const source=workspace+live+preparation;
  assert.match(source,/Trwały proces serwerowy/);
  assert.match(source,/allegro-preparation-queue-enqueue/);
  assert.match(source,/operation:"product-full-review"/);
  assert.match(source,/allegro-preparation-queue-status/);
  assert.match(source,/agent-runtime-status/);
  assert.match(source,/vonHalskyAktualizujPostepDOM/);
  assert.doesNotMatch(source,/for\(let index=0;index<ids\.length;index\+=1\)/);
  assert.doesNotMatch(source,/body:\{productIds:\[productId\]\}/);
  assert.match(source,/możesz zamknąć tę kartę/);
  assert.match(source,/Codex/);
  assert.match(source,/Agenci pomocniczy/);
  assert.match(source,/leftQuality\.wynik-rightQuality\.wynik/);
  assert.match(source,/Zapis centralny potwierdzony/);
  assert.match(source,/href="#\/admin\/produkty\/edytuj\//);
  assert.match(style,/\.von-halsky-progress-track/);
  assert.match(editor,/productEditorVonHalskyAuditHTML/);
  assert.match(editor,/Zapisane w tej kartotece/);
  assert.match(editor,/vonHalskyAgentReadbackConfirmed/);
});

test("wynik przygotowania i publikacji aktualizuje widok bez pełnego renderu strony",async()=>{
  const [workspace,live,preparation]=await Promise.all([
    read("src/frontend/11b-von-halsky-workspace.js"),
    read("src/frontend/11b-von-halsky-live-process.js"),
    read("src/frontend/11c-von-halsky-preparation.js"),
  ]);
  const source=workspace+live+preparation;
  assert.match(source,/function vonHalskyMigawkaFiltrow/);
  assert.match(source,/function vonHalskyPrzywrocFiltry/);
  assert.match(source,/function vonHalskyZastosujAktualizacjeProduktow/);
  assert.match(source,/function vonHalskyAktualizujWystawianieDOM/);
  assert.match(live,/vonHalskyPodmienWyspe\("\[data-vh-channel-header\]",vonHalskyNaglowekHTML\("wystawianie"\)\)/);
  assert.match(live,/vonHalskySubnavHTML\("wystawianie"\)/);
  assert.match(workspace,/function vonHalskyAktualizujPodsumowanieFiltrowDOM/);
  assert.match(workspace,/productQueue\.loaded\?Number\(vonHalskyStan\.productQueue\.total\)/);
  assert.match(preparation,/verifiedPublishingCount/);
  assert.match(preparation,/currentWork\.channel==="vonHalsky"&&currentWork\.status==="running"/);
  assert.match(source,/\[data-vh-channel-truth\]/);
  assert.match(source,/\[data-vh-stage-filters\]/);
  assert.match(source,/\[data-vh-results-region\]/);
  assert.doesNotMatch(source,/current\.outerHTML=vonHalskyWystawianieHTML\(\)/);
  assert.match(source,/vonHalskyZastosujAktualizacjeProduktow\(data\.productUpdates\|\|\[\]\)/);
  assert.match(source,/chmura\("von-halsky-status"/);
  assert.doesNotMatch(live,/if\(Array\.isArray\(data\.offers\)\)vonHalskyStan\.offers=data\.offers/);
  assert.match(source,/lastChangedProductIds/);
  assert.match(source,/setTimeout\(tick,vonHalskyNastepnyInterwal\(\)\)/);
  assert.match(source,/document\.hidden/);
  assert.match(source,/product-catalog-query/);
  assert.match(source,/ids:\[\.\.\.new Set\(ids\)\]\.join\(","\)/);
  assert.doesNotMatch(source,/},5000\)/);
  assert.match(source,/results:false,stages:false,truth:false/);
  assert.doesNotMatch(source,/sort:"najnowsze",page:1,limit:100/);
  assert.doesNotMatch(live,/pendingRemote/);
  assert.doesNotMatch(live,/vonHalskyUzgodnijKatalog\(\{silent:true,render:false\}\)/);
});

test("podgląd i edycja Von Halsky działają dla produktów ze stronicowanej kolejki PostgreSQL",async()=>{
  const source=await read("src/frontend/11b-von-halsky-workspace.js");
  assert.match(source,/function vonHalskyZnajdzProdukt\(productId\)/);
  assert.match(source,/vonHalskyStan\.productQueue\?\.items\|\|\[\]/);
  assert.match(source,/function vonHalskyOtworzPodglad\(productId\)\{\s*const product=vonHalskyZnajdzProdukt\(productId\)/);
  assert.match(source,/function vonHalskyOtworzDopasowanie\(productId\)\{\s*const product=vonHalskyZnajdzProdukt\(productId\)/);
  assert.match(source,/product=vonHalskyZnajdzProdukt\(productId\)/);
});

test("publikacja Von Halsky wykonuje drugi odczyt, gdy polecenie nadal czeka na katalog",async()=>{
  const source=await read("src/frontend/11b-von-halsky-workspace.js");
  assert.match(source,/for\(let attempt=0;attempt<\(repeat\?2:1\);attempt\+=1\)/);
  assert.match(source,/if\(attempt\)await new Promise\(resolve=>setTimeout\(resolve,20000\)\)/);
  assert.match(source,/if\(!repeat\|\|Number\(data\.sync\?\.pendingCommandCount\|\|0\)<=0\)break/);
  assert.match(source,/vonHalskyUzgodnijKatalog\(\{silent:true,repeat:true\}\)/);
});

test("sprzedaż Von Halsky opiera się wyłącznie na potwierdzonym PUBLISHED z API",async()=>{
  const [workspace,truthUi,quality,style,sharedUi,sharedStyle]=await Promise.all([
    read("src/frontend/11b-von-halsky-workspace.js"),
    read("src/frontend/11b-von-halsky-channel-truth.js"),
    read("src/frontend/11b-von-halsky-product-quality.js"),
    read("src/styles/37-von-halsky-workspace.css"),
    read("src/frontend/08a-admin-responsive-layout.js"),
    read("src/styles/35-admin-unified-workspace.css"),
  ]);
  assert.match(workspace,/von-halsky-reconcile-catalog/);
  assert.match(workspace,/if\(status==="PUBLISHED"\)return "sprzedaz"/);
  assert.match(workspace,/offerStatus\|\|""\)\.toUpperCase\(\)!=="PUBLISHED"/);
  assert.match(workspace,/API potwierdza:/);
  assert.match(sharedUi,/Stan potwierdzony bezpośrednio przez API/);
  assert.match(truthUi,/osobno od liczby ofert/);
  assert.match(workspace,/truth:data\.truth\|\|vonHalskyStan\.truth/);
  assert.match(quality,/offerVerified:Boolean\(remote&&ofertaId\)/);
  assert.doesNotMatch(quality,/ofertaId:String\(product\.vonHalskyOfferId/);
  assert.match(truthUi,/Po stronie API/);
  assert.match(sharedUi,/Wewnętrzna kolejka Artway-TM/);
  assert.match(sharedUi,/aria-pressed=/);
  assert.match(truthUi,/adminKanalStanApiHTML\(\{channel:"InPost Von Halsky"/);
  assert.match(truthUi,/adminKanalEtapyHTML\(\{id:"vonHalskyStageTitle"/);
  assert.match(sharedStyle,/\.admin-channel-stage-filters\{display:grid/);
});

test("indeks ustawień Von Halsky ma działające przyciski i zielony stan aktywny",async()=>{
  const [source,settings,style]=await Promise.all([
    read("src/frontend/11b-von-halsky-workspace.js"),
    read("src/frontend/11d-von-halsky-settings-workspace.js"),
    read("src/styles/37-von-halsky-workspace.css"),
  ]);
  assert.match(source,/function vonHalskyPrzewinUstawienia/);
  assert.match(source,/data-von-settings-nav/);
  assert.match(source,/von-halsky-setting-visible/);
  assert.doesNotMatch(source,/scrollIntoView\(\{behavior:"smooth",block:"start"\}\)/);
  assert.match(style,/\.von-halsky-settings-index button\.active\{[^}]*background:#dcfce7/);
  assert.doesNotMatch(style,/\.von-halsky-settings-index\{[^}]*overflow:auto/);
  assert.match(settings,/vonHalskyPodmienWyspe\("\[data-vh-channel-header\]",vonHalskyNaglowekHTML\("ustawienia"\)\)/);
});

test("błąd API Von Halsky nie uruchamia nieskończonej pętli renderowania",async()=>{
  const source=await read("src/frontend/11b-von-halsky-workspace.js");
  assert.match(source,/catch\(error\)\{[\s\S]*?vonHalskyStan\.loaded=true;[\s\S]*?vonHalskyStan\.error=/);
  assert.match(source,/if\(!vonHalskyStan\.loaded&&!vonHalskyStan\.loading\)setTimeout\(\(\)=>vonHalskyLaduj\(false\),0\)/);
  assert.match(source,/onclick="vonHalskyLaduj\(true\)"/);
});
