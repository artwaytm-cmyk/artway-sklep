import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("katalog produktów ma wielokryterialne filtry dla dużego asortymentu",async()=>{
  const source=await read("assets/admin.js");
  assert.match(source,/filtrProducentaProduktow/);
  assert.match(source,/filtrDanychProduktow/);
  assert.match(source,/filtrSprzedazyProduktow/);
  assert.match(source,/filtrPromocjiProduktow/);
  assert.match(source,/cenaOdAdminProduktow/);
  assert.match(source,/cenaDoAdminProduktow/);
  for(const label of ["Brak EAN","Brak zdjęcia","Brak opisu krótkiego lub pełnego","Brak linku źródłowego","Brak ceny zakupu (admin)"]){
    assert.match(source,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
  assert.match(source,/Dostępność sprzedażowa/);
  assert.match(source,/Status Allegro/);
  assert.match(source,/Oferta i promocja/);
});

test("katalog udostępnia szybkie widoki, aktywne znaczniki i zapis gęstości",async()=>{
  const source=await read("assets/admin.js");
  assert.match(source,/function asortymentUstawWidok/);
  assert.match(source,/Gotowe do sprzedaży/);
  assert.match(source,/Bez Allegro/);
  assert.match(source,/Ukryte sprzedażowo/);
  assert.match(source,/data-assortment-active-filters/);
  assert.match(source,/function asortymentWyczyscFiltr/);
  assert.match(source,/artway_produkty_gestosc_admin/);
  assert.match(source,/density-\$\{gestoscAdminProduktow\}/);
});

test("tabela katalogu zachowuje swoje kolumny i operacje hurtowe",async()=>{
  const source=await read("assets/admin.js");
  assert.match(source,/<th>Produkt<\/th><th>Identyfikatory<\/th><th>Klasyfikacja i źródło<\/th><th>Ceny<\/th><th>Magazyn i sprzedaż<\/th><th>Allegro<\/th><th>Akcje<\/th>/);
  assert.match(source,/EXTERNAL_ID/);
  assert.match(source,/Zakup \(admin\)/);
  assert.match(source,/adminOperacjeWynikowHTML/);
  assert.match(source,/asortymentEksportuj\('zaznaczone'\)/);
  assert.match(source,/asortymentEksportuj\('filtr'\)/);
  assert.match(source,/Wspólna baza/);
  assert.doesNotMatch(source,/const gotowosc=Math\.max/);
  assert.doesNotMatch(source,/assortment-card-readiness/);
  assert.doesNotMatch(source,/Po zakończeniu pobierz nowy <b>products\.json<\/b> i podmień go na hostingu/);
});

test("układ katalogu dopasowuje dotychczasowe kolumny i wspiera zwartą tabelę",async()=>{
  const css=(await read("src/styles/07-admin-domains.css"))+(await read("src/styles/31-admin-page-pattern.css"));
  for(const selector of [".assortment-saved-views",".assortment-advanced-grid",".assortment-filter-state",".assortment-results-toolbar",".assortment-bulk-editor",".assortment-product-cell",".assortment-identifiers",".assortment-row-actions",".assortment-product-table.density-zwarta"]){
    assert.match(css,new RegExp(selector.replace(".","\\.")));
  }
  assert.match(css,/@container\(max-width:1180px\)/);
  assert.match(css,/@container\(max-width:820px\)/);
  assert.match(css,/content-visibility:auto/);
  assert.match(css,/@media\(max-width:620px\).*assortment-advanced-grid/);
});

test("katalog rozdziela zarządzanie produktami od tworzenia nowych ofert Allegro",async()=>{
  const catalog=await read("assets/admin.js"),actions=await read("src/frontend/12a-product-actions.js"),commerce=await read("src/frontend/12c-commerce-catalog-actions.js"),prices=await read("src/frontend/13-product-admin.js"),css=(await read("src/styles/15-product-actions.css"))+(await read("src/styles/29-commerce-catalog-actions.css"));
  assert.match(catalog,/data-product-agent-center/);
  assert.match(catalog,/asortymentMenuDzialanProduktuHTML\(p\)/);
  for(const marker of ["Centrum zarządzania produktami","Nowe oferty powstają wyłącznie w sekcji Allegro","Synchronizuj dane i ceny","Wycofaj oferty","Otwórz ofertę"]){assert.match(commerce,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));}
  assert.doesNotMatch(commerce,/Wystaw gotowe na Allegro/);
  assert.match(catalog,/id="kanalCenProduktow"/);
  assert.match(catalog,/Tylko sklep/);
  assert.match(catalog,/Tylko Allegro/);
  assert.match(catalog,/Sklep i Allegro/);
  assert.match(commerce,/catalog-allegro-offer-link/);
  assert.match(prices,/kanalCenProduktow/);
  assert.match(prices,/patch\.cenaAllegro/);
  assert.match(prices,/patch\.cena=/);
  assert.match(actions,/Ostateczna publikacja nastąpi dopiero po tym potwierdzeniu/);
  assert.match(actions,/data-external-product-confirm/);
  assert.match(actions,/Promise\.all\(Array\.from\(\{length:Math\.min\(2,products\.length\)\},worker\)\)/);
  assert.match(actions,/async function asortymentPrzygotujProduktDoAllegro/);
  assert.match(actions,/allegro-description-improve/);
  assert.match(actions,/allegroAgentPreparationStatus/);
  assert.match(actions,/allegroAgentSavedFields/);
  assert.match(actions,/if\(!preparation\.ready\)throw new Error/);
  assert.match(actions,/draft:preparedDraft/);
  assert.match(actions,/Konkretny zapis Agenta/);
  assert.match(catalog,/Przygotuj i zapisz dane do Allegro/);
  assert.match(css,/\.product-action-center/);
  assert.match(css,/\.product-agent-results/);
  assert.match(css,/\.product-allegro-preparation/);
  assert.match(css,/\.product-external-confirm/);
  assert.match(css,/\.catalog-allegro-offer-link/);
  assert.match(css,/@media\(max-width:620px\)/);
});

test("opis zapisywany po przygotowaniu korzysta z końcowych bezpiecznych sekcji Allegro",async()=>{
  const source=await read("assets/admin.js");
  assert.match(source,/function allegroTekstZBezpiecznychSekcji/);
  assert.match(source,/d\.draft\?\.description\?\.sections/);
  assert.match(source,/force\.allegroDescriptionSections=safeSections/);
  assert.match(source,/asortymentPrzygotujProduktDoAllegro/);
  assert.match(source,/Oferta nie została wysłana — uzupełnij wskazane braki/);
});
