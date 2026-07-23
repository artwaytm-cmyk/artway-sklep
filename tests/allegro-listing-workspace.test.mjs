import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {ASSET_BUNDLES,ADMIN_RUNTIME_BUNDLES} from "../scripts/build-assets.mjs";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("podstrona wystawiania ma widoczny pojedynczy i masowy przycisk publikacji",async()=>{
  const source=(await read("src/frontend/12b-allegro-listing-workspace.js"))+(await read("src/frontend/12c-commerce-catalog-actions.js"));
  for(const marker of ["Wystaw na Allegro","Aktywuj ofertę","Opublikuj aktualizację","Wystaw zaznaczone","Wystaw gotowe z widoku"]){
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
});

test("centrum wystawiania skaluje katalog przez filtry, limit, paginację i eksport",async()=>{
  const source=(await read("src/frontend/12b-allegro-listing-workspace.js"))+(await read("src/frontend/12c-commerce-catalog-actions.js")),styles=(await read("src/styles/27-allegro-listing-workspace.css"))+(await read("src/styles/29-commerce-catalog-actions.css"));
  for(const marker of ["EAN","EXTERNAL_ID","kod producenta","Sortowanie","Na stronie","Wszystkie kategorie","Wszyscy producenci","Gotowość danych","Sprzedaż w sklepie","Źródło produktu","Cena Allegro od","Cena Allegro do","Strona <b>"]){
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

test("ukryty produkt nie trafia do wystawiania Allegro i jest ponownie blokowany na serwerze",async()=>{
  const listing=await read("src/frontend/12b-allegro-listing-workspace.js"),legacy=await read("src/frontend/11-allegro-operations.js"),backend=await read("src/backend/lib/store-app.mjs");
  assert.match(listing,/filter\(p=>!czyProduktAdminWKoszu\(p\)&&produktDostepnyWSprzedazy\(p\)\)/);
  assert.match(listing,/p&&produktDostepnyWSprzedazy\(p\)&&!allegroBrakiProduktuDoWystawienia/);
  assert.match(legacy,/produkt jest ukryty lub niedostępny/i);
  assert.match(backend,/code: 'product_sale_unavailable'/);
  assert.match(backend,/artway_dostepnosc\?\.\[saleProductId\]/);
  assert.match(backend,/authoritativeProducts\.get\(saleProductId\)/);
  assert.match(backend,/\[body\.product \|\| \{\}, authoritativeProduct\]\.some/);
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
  const context={result:"",allegroOfertaDlaProduktuSklepu:()=>null,allegroBrakiProduktuDoWystawienia:()=>[],allegroPublikacjaOcena:()=>({code:"ready",label:"Gotowy",detail:"komplet",score:100}),allegroPublikacjaTrybProduktu:()=>({operation:"activate",label:"Wystaw na Allegro",note:"nowa oferta",icon:"🟠"}),zaznaczoneAllegroProduktyKatalogu:new Set(),esc:value=>String(value??""),jsArg:value=>JSON.stringify(value),zl:value=>`${Number(value).toFixed(2).replace(".",",")} zł`,encodeURIComponent};
  vm.runInNewContext(`${source.slice(start,end)}\nresult=allegroPublikacjaKartaHTML({id:1,nazwa:"Produkt testowy",cena:19.9});`,context);
  assert.match(context.result,/19,90 zł/);
  assert.match(context.result,/Wystaw na Allegro/);
});
