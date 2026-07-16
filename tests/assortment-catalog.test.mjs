import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("katalog produktów ma wielokryterialne filtry dla dużego asortymentu",async()=>{
  const source=await read("src/frontend/12-customers-and-inventory.js");
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
  const source=await read("src/frontend/12-customers-and-inventory.js");
  assert.match(source,/function asortymentUstawWidok/);
  assert.match(source,/Gotowe do sprzedaży/);
  assert.match(source,/Bez Allegro/);
  assert.match(source,/Ukryte sprzedażowo/);
  assert.match(source,/data-assortment-active-filters/);
  assert.match(source,/function asortymentWyczyscFiltr/);
  assert.match(source,/artway_produkty_gestosc_admin/);
  assert.match(source,/density-\$\{gestoscAdminProduktow\}/);
});

test("tabela katalogu grupuje dane i zachowuje operacje hurtowe",async()=>{
  const source=await read("src/frontend/12-customers-and-inventory.js");
  assert.match(source,/<th>Produkt<\/th><th>Identyfikatory<\/th><th>Klasyfikacja i źródło<\/th><th>Ceny<\/th><th>Magazyn i sprzedaż<\/th><th>Allegro<\/th><th>Akcje<\/th>/);
  assert.match(source,/EXTERNAL_ID/);
  assert.match(source,/Zakup \(admin\)/);
  assert.match(source,/adminOperacjeWynikowHTML/);
  assert.match(source,/asortymentEksportuj\('zaznaczone'\)/);
  assert.match(source,/asortymentEksportuj\('filtr'\)/);
  assert.match(source,/Wspólna baza/);
  assert.doesNotMatch(source,/Po zakończeniu pobierz nowy <b>products\.json<\/b> i podmień go na hostingu/);
});

test("układ katalogu jest responsywny i wspiera zwartą tabelę",async()=>{
  const css=await read("src/styles/07-admin-domains.css");
  for(const selector of [".assortment-saved-views",".assortment-advanced-grid",".assortment-filter-state",".assortment-results-toolbar",".assortment-bulk-editor",".assortment-product-cell",".assortment-identifiers",".assortment-row-actions",".assortment-product-table.density-zwarta"]){
    assert.match(css,new RegExp(selector.replace(".","\\.")));
  }
  assert.match(css,/@media\(max-width:620px\).*assortment-advanced-grid/);
});
