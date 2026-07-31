import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {ASSET_BUNDLES,ADMIN_RUNTIME_BUNDLES} from "../scripts/build-assets.mjs";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("podstrona wystawiania ma widoczny pojedynczy i masowy przycisk publikacji",async()=>{
  const source=(await read("src/frontend/12b-allegro-listing-workspace.js"))+(await read("src/frontend/12c-commerce-catalog-actions.js"));
  for(const marker of ["Wystaw na Allegro","Aktywuj szkic","Wznów zakończoną ofertę","Opublikuj aktualizację","Wystaw zaznaczone","Wystaw gotowe z widoku"]){
    assert.match(source,new RegExp(marker));
  }
  assert.match(source,/allegroPublikacjaOtworzDecyzje/);
  assert.match(source,/asortymentPrzygotujOperacjeZewnetrzna/);
  assert.match(source,/asortymentDecyzjaZewnetrznaHTML/);
});

test("publikacja działa jednym kliknięciem, ale zachowuje kontrolę Agenta i blokadę braków",async()=>{
  const listing=(await read("src/frontend/12b-allegro-listing-workspace.js"))+(await read("src/frontend/12c-commerce-catalog-actions.js")),actions=await read("src/frontend/12a-product-actions.js");
  assert.match(listing,/allegroBrakiProduktuDoWystawienia/);
  assert.match(listing,/asortymentUruchomAgenta\(ids,"allegro"\)/);
  assert.match(listing,/system blokuje duplikaty/i);
  assert.match(listing,/asortymentPrzygotujOperacjeZewnetrzna\(operation,singleId,true\)/);
  assert.match(actions,/if\(!direct&&!document\.querySelector/);
  assert.match(actions,/executeNow&&op!=="withdraw"/);
  assert.match(actions,/class="product-external-direct/);
  assert.match(actions,/data-external-product-confirm/);
  assert.match(actions,/allegro-connection-check/);
  assert.match(actions,/approval:\{approved:true,operationId/);
  assert.match(actions,/eligibleAll\.slice\(0,50\)/);
  assert.match(actions,/Następna partia/);
  assert.match(actions,/zaznaczoneAllegroProduktyKatalogu\?\.delete/);
});

test("wskaźnik 100% wymaga aktualnego, serwerowo potwierdzonego przygotowania",async()=>{
  const source=await read("src/frontend/11-allegro-operations.js");
  const start=source.indexOf("function allegroBrakiProduktuDoWystawienia");
  const end=source.indexOf("\nfunction allegroStanOfertyProduktu",start);
  assert.ok(start>=0&&end>start);
  const context={
    result:null,
    poprawnaNazwaProducenta:value=>!!String(value||"").trim(),
    allegroPoprawnyGtin:()=>true,
    allegroOfertaDlaProduktuSklepu:()=>null,
    asortymentSygnaturaPrzygotowania:()=>"sig-current",
  };
  vm.runInNewContext(`${source.slice(start,end)}
    const base={id:"17",nazwa:"Gra",cena:20,kodProducenta:"SKU-17",producent:"Multigra",zdjecie:"https://example.test/a.jpg",allegroCategoryId:"123"};
    const unprepared=allegroBrakiProduktuDoWystawienia(base);
    const stale=allegroBrakiProduktuDoWystawienia({...base,allegroAgentPreparationStatus:"ready",allegroAgentPreparationVersion:4,allegroAgentPreparationFingerprint:"old"});
    const ready=allegroBrakiProduktuDoWystawienia({...base,allegroAgentPreparationStatus:"ready",allegroAgentPreparationVersion:4,allegroAgentPreparationFingerprint:"sig-current",allegroAgentPreparationMissing:[]});
    const leanReady=allegroBrakiProduktuDoWystawienia({...base,allegroAgentPreparationStatus:"ready",allegroAgentPreparationVersion:3,allegroAgentPreparationFingerprint:"legacy",allegroAgentPreparationCurrent:true,allegroAgentPreparationMissing:[]});
    const serverRejected=allegroBrakiProduktuDoWystawienia({...base,allegroAgentPreparationStatus:"ready",allegroAgentPreparationVersion:4,allegroAgentPreparationFingerprint:"sig-current",allegroAgentPreparationCurrent:false,allegroAgentPreparationMissing:[]});
    const blocked=allegroBrakiProduktuDoWystawienia({...base,allegroAgentPreparationStatus:"needs_attention",allegroAgentPreparationVersion:4,allegroAgentPreparationFingerprint:"sig-current",allegroAgentPreparationMissing:["odpowiedzialny producent GPSR"]});
    result={unprepared,stale,ready,leanReady,serverRejected,blocked};`,context);
  assert.ok(context.result.unprepared.includes("aktualne przygotowanie Agenta Allegro"));
  assert.ok(context.result.stale.includes("aktualne przygotowanie Agenta Allegro"));
  assert.deepEqual(Array.from(context.result.ready),[]);
  assert.deepEqual(Array.from(context.result.leanReady),[]);
  assert.ok(context.result.serverRejected.includes("aktualne przygotowanie Agenta Allegro"));
  assert.ok(context.result.blocked.includes("odpowiedzialny producent GPSR"));
});

test("partia przygotowania zapisuje produkty pojedynczo, a publikacja wymaga odczytu kontrolnego serwera",async()=>{
  const actions=await read("src/frontend/12a-product-actions.js");
  assert.match(actions,/await worker\(\)/);
  assert.doesNotMatch(actions,/Promise\.all\(Array\.from\(\{length:Math\.min\(2,products\.length\)\},worker\)\)/);
  assert.match(actions,/asortymentPobierzPelnyProdukt\(p\.id,\{force:true\}\)/);
  assert.match(actions,/allegro_publication_readback_mismatch/);
  assert.match(actions,/readbackConfirmed:true/);
  const publicationBlock=actions.slice(actions.indexOf("async function asortymentPotwierdzOperacjeZewnetrzna"),actions.indexOf("function asortymentOperacjaZewnetrznaOpis"));
  assert.doesNotMatch(publicationBlock,/chmuraZapiszUstawienia\(\{flush:true\}\)/);
});

test("centrum wystawiania skaluje katalog przez filtry, limit, paginację i eksport",async()=>{
  const source=(await read("src/frontend/12b-allegro-listing-workspace.js"))+(await read("src/frontend/12c-commerce-catalog-actions.js")),styles=(await read("src/styles/27-allegro-listing-workspace.css"))+(await read("src/styles/29-commerce-catalog-actions.css"));
  for(const marker of ["EAN","EXTERNAL_ID","kod producenta","Sortowanie","Na stronie","Wszystkie kategorie","Wszyscy producenci","Gotowość danych","Dokładny stan kolejki","Źródło produktu","Cena Allegro od","Cena Allegro do","Strona <b>"]){
    assert.match(source,new RegExp(marker));
  }
  assert.match(source,/\[25,50,100,250,500,1000\]/);
  assert.match(source,/allegroWystawianieStrona/);
  assert.match(source,/adminWyszukiwaniePanelHTML/);
  assert.match(source,/adminOperacjeWynikowHTML/);
  assert.match(source,/\$\{zl\(p\.cena\)\}/);
  assert.doesNotMatch(source,/\$\{cena\(p\.cena\)\}/);
  assert.match(styles,/\.allegro-publication-card/);
  assert.match(styles,/\.allegro-listing-advanced-grid/);
  assert.match(styles,/@media\(max-width:820px\)/);
  const js=ADMIN_RUNTIME_BUNDLES.find(bundle=>bundle.output==="assets/admin-inventory.js"),css=ASSET_BUNDLES.find(bundle=>bundle.output==="assets/admin-commerce.css"),baseCss=ASSET_BUNDLES.find(bundle=>bundle.output==="assets/admin.css");
  assert.ok(js.sources.includes("src/frontend/12b-allegro-listing-workspace.js"));
  assert.ok(js.sources.includes("src/frontend/12c-commerce-catalog-actions.js"));
  assert.ok(css.sources.includes("src/styles/27-allegro-listing-workspace.css"));
  assert.ok(baseCss.sources.includes("src/styles/29-commerce-catalog-actions.css"));
});

test("domyślny filtr pokazuje tylko produkty naprawdę bez oferty Allegro",async()=>{
  const runtime=await read("src/frontend/02-runtime-state.js"),listing=await read("src/frontend/12b-allegro-listing-workspace.js"),workspace=await read("src/frontend/12c-commerce-catalog-actions.js");
  assert.match(runtime,/filtrAllegroWystawiania="bez_oferty"/);
  for(const marker of ["Bez oferty Allegro","Gotowe do pierwszego wystawienia","Nowe wymagające uzupełnienia","Szkice do aktywacji","Wycofane — brak towaru","Powiązania do weryfikacji"]){
    assert.match(workspace,new RegExp(marker));
  }
  assert.match(listing,/product-catalog-query/);
  assert.match(listing,/allegroPublikacjaCentralnaPobierz/);
  assert.match(workspace,/catalogProducts=Array\.isArray\(serverData\.items\)/);
  assert.doesNotMatch(workspace,/catalogProducts=produktyDoAdministracji\(\)/);
  assert.doesNotMatch(workspace,/Istniejące nieaktywne|Nieaktywne/);
  const start=listing.indexOf("function allegroPublikacjaDostepnoscMeta"),end=listing.indexOf("\nfunction allegroPublikacjaOtworzDecyzje",start);
  assert.ok(start>=0&&end>start);
  const context={
    result:null,currentOffer:null,currentAvailability:null,currentUnavailable:false,
    asortymentOfertaProduktu(){return context.currentOffer;},
    allegroOfertaDlaProduktuSklepu(){return null;},
    allegroBrakiProduktuDoWystawienia(p){return p.missing||[];},
    allegroRozniceOfertyProduktu(p){return p.differences||[];},
    wpisDostepnosciProduktu(){return context.currentAvailability;},
    produktOznaczonyNiedostepny(){return context.currentUnavailable;},
    produktDostepnyWSprzedazy(){return !context.currentUnavailable;},
  };
  vm.runInNewContext(`${listing.slice(start,end)}
    const fresh=allegroPublikacjaMetaProduktu({id:1,missing:[]});
    const unresolved=allegroPublikacjaMetaProduktu({id:2,allegroOfferId:"123",missing:[]});
    currentOffer={id:"456",status:"ACTIVE"};
    const active=allegroPublikacjaMetaProduktu({id:3,missing:[]});
    currentUnavailable=true;currentAvailability={status:"niedostepny",decision:"wait_available",reason:"Brak u producenta"};
    currentOffer={id:"789",status:"ENDED",saleAvailabilityBlocked:true};
    const withdrawn=allegroPublikacjaMetaProduktu({id:4,missing:[]});
    currentOffer={id:"790",status:"ACTIVE"};const pendingWithdrawal=allegroPublikacjaMetaProduktu({id:5,missing:[]});
    result={fresh,unresolved,active,withdrawn,pendingWithdrawal};`,context);
  assert.equal(context.result.fresh.readyNew,true);
  assert.equal(context.result.unresolved.noOffer,false);
  assert.equal(context.result.unresolved.unresolved,true);
  assert.equal(context.result.active.active,true);
  assert.equal(context.result.active.actionable,false);
  assert.equal(context.result.withdrawn.withdrawnNoStock,true);
  assert.equal(context.result.withdrawn.pendingStockWithdrawal,false);
  assert.equal(context.result.withdrawn.selectable,false);
  assert.equal(context.result.withdrawn.actionable,true);
  assert.equal(context.result.pendingWithdrawal.pendingStockWithdrawal,true);
});

test("proces wystawiania ma trzy etapy i blokuje duplikat przy niezweryfikowanym ID",async()=>{
  const listing=await read("src/frontend/12b-allegro-listing-workspace.js"),actions=await read("src/frontend/12a-product-actions.js"),styles=await read("src/styles/27-allegro-listing-workspace.css");
  assert.match(listing,/WYBÓR ZAKRESU/);
  assert.match(listing,/KONTROLA I ZAPIS/);
  assert.match(listing,/PUBLIKACJA PRZEZ API/);
  assert.match(listing,/meta\.unresolved/);
  assert.match(listing,/publikacja duplikatu została zablokowana/i);
  assert.match(actions,/unresolved=all\.filter/);
  assert.match(actions,/Zapisane ID oferty wymaga weryfikacji/);
  assert.match(styles,/\.allegro-publication-steps-three/);
  assert.match(styles,/\.allegro-publication-card\.verify/);
});

test("ukryty produkt nie może być wystawiony, ale powiązana oferta trafia do filtra wycofanych z braku towaru",async()=>{
  const listing=(await read("src/frontend/12b-allegro-listing-workspace.js"))+(await read("src/frontend/12c-commerce-catalog-actions.js")),legacy=await read("src/frontend/11-allegro-operations.js"),backend=await read("src/backend/lib/store-app.mjs");
  assert.match(listing,/withdrawnNoStock:\s*availability\.withdrawnNoStock/);
  assert.match(listing,/meta\?\.selectable&&meta\.ready/);
  assert.match(listing,/Wycofana z powodu braku towaru/);
  assert.match(listing,/Status wynika z tej samej decyzji dostępności/);
  assert.match(listing,/href="#\/admin\/magazyn\/dostawcy"/);
  assert.match(legacy,/produkt jest ukryty lub niedostępny/i);
  assert.match(backend,/code: 'product_sale_unavailable'/);
  assert.match(backend,/artway_dostepnosc\?\.\[saleProductId\]/);
  assert.match(backend,/authoritativeProducts\.get\(saleProductId\)/);
  assert.match(backend,/publicationProduct = \{ \.\.\.\(body\.product \|\| \{\}\), \.\.\.authoritativeProduct, id: saleProductId \}/);
  assert.match(backend,/allegroDraftZAutoKategoria\(req, publicationProduct,/);
  assert.match(backend,/allegroZapiszPowiazanieProduktu\(publicationProduct,/);
});

test("szkic Allegro bierze zdjęcia ze strony źródłowej, a nie z podobnej oferty lub katalogu",async()=>{
  const backend=await read("src/backend/lib/store-app.mjs");
  const start=backend.indexOf("async function allegroDraftZAutoKategoria");
  const end=backend.indexOf("\nfunction allegroDraftZProduktu",start);
  const draft=backend.slice(start,end);
  assert.match(draft,/sourcePageUrl\(product\)/);
  assert.match(draft,/verifiedSourceImages\(product\)/);
  assert.match(draft,/inspectedSourceImages\(product, inspection/);
  assert.doesNotMatch(draft,/catalog\.images/);
  assert.doesNotMatch(draft,/safeOffer\.mainImage/);
});

test("karta produktu wykonuje się z rzeczywistym wspólnym formatowaniem ceny",async()=>{
  const source=await read("src/frontend/12b-allegro-listing-workspace.js"),start=source.indexOf("function allegroPublikacjaKartaHTML"),end=source.indexOf("\n\nallegroWystawianiePanelHTML",start);
  assert.ok(start>=0&&end>start);
  const context={result:"",allegroPublikacjaMetaProduktu:()=>({offer:null,missing:[],unresolved:false,status:""}),allegroPublikacjaOcena:()=>({code:"ready",label:"Gotowy",detail:"komplet",score:100}),allegroPublikacjaTrybProduktu:()=>({operation:"activate",label:"Wystaw na Allegro",note:"nowa oferta",icon:"🟠"}),zaznaczoneAllegroProduktyKatalogu:new Set(),esc:value=>String(value??""),jsArg:value=>JSON.stringify(value),zl:value=>`${Number(value).toFixed(2).replace(".",",")} zł`,encodeURIComponent};
  vm.runInNewContext(`${source.slice(start,end)}\nresult=allegroPublikacjaKartaHTML({id:1,nazwa:"Produkt testowy",cena:19.9});`,context);
  assert.match(context.result,/19,90 zł/);
  assert.match(context.result,/Wystaw na Allegro/);
});

test("wystawianie jest kolejką działań, a nie kopią pełnego katalogu Allegro",async()=>{
  const listing=await read("src/frontend/12b-allegro-listing-workspace.js"),workspace=await read("src/frontend/12c-commerce-catalog-actions.js");
  assert.match(listing,/actionable:availability\.withdrawnNoStock\|\|\(availability\.saleAvailable&&\(noOffer\|\|unresolved\|\|inactive\|\|needsUpdate\)\)/);
  assert.match(listing,/publikacja-kolejka/);
  assert.match(workspace,/const all=catalogProducts/);
  assert.match(workspace,/resultTotal=Number\(serverData\.total\)/);
  assert.match(workspace,/metaCache=new Map\(\)/);
  assert.match(workspace,/Widzisz wyłącznie produkty wymagające działania/);
  assert.match(workspace,/Aktualne, poprawne oferty są automatycznie pomijane/);
  assert.match(workspace,/Cała kolejka działań/);
  assert.doesNotMatch(workspace,/Aktywne \(\$\{counts\.aktywne\}\)/);
});
