import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("ponowne renderowanie tej samej podstrony aktualizuje DOM bez skoku i utraty fokusu",async()=>{
  const router=await read("assets/app.js");
  assert.match(router,/function aktualizujWidokStabilnie/);
  assert.match(router,/function aktualizujWezelStabilnie/);
  assert.match(router,/ostatniaRenderowanaTrasa===t/);
  assert.match(router,/if\(!taSamaTrasa\)window\.scrollTo/);
  assert.match(router,/active\.setSelectionRange/);
  assert.match(router,/odbiorcaStabilnegoWidoku\(root,taSamaTrasa\)/);
});

test("monitoring dostępności producentów posiada stabilne klucze panelu i produktów",async()=>{
  const [inventory,catalog]=await Promise.all([read("assets/admin.js"),read("assets/app.js")]);
  assert.match(inventory,/data-stable-key="supplier-availability"/);
  assert.match(inventory,/data-product-row="\$\{esc\(p\.id\)\}"/);
  assert.match(catalog,/data-supplier-decision=/);
  assert.match(inventory,/function odswiezMonitoringProducentow/);
  assert.match(catalog,/odswiezDostepnoscProducentowWidoku\(\)/);
});

test("klient wybiera ilość na karcie i stronie produktu, a koszyk zapisuje ją jedną operacją",async()=>{
  const [storefront,cart]=await Promise.all([
    read("assets/app.js"),
    read("src/frontend/17-cart-and-checkout.js")
  ]);
  assert.match(storefront,/data-card-quantity/);
  assert.match(storefront,/id="prodQty" type="number" min="1" max="99"/);
  assert.match(storefront,/dodajWIlosci\(id,iloscProduktu,null,wariant\)/);
  assert.match(cart,/function dodajWIlosci\(id,ilosc=1/);
  assert.match(cart,/poz \? poz\.ile\+=ile : koszyk\.push\(\{id, ile/);
  assert.match(cart,/potwierdzProgDostepnosci\(id, ileWKoszyku\(id\)\+ile\)/);
  assert.doesNotMatch(storefront,/for\(let i=0;i<iloscProduktu;i\+\+\) dodaj/);
});
