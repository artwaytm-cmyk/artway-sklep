import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("otwarty panel okresowo pobiera wyniki synchronizacji Allegro bez przerywania formularzy",async()=>{
  const [allegro,cloud]=await Promise.all([read("src/frontend/11-allegro-refresh-runtime.js"),read("src/frontend/07-admin-shipping.js")]);
  assert.match(allegro,/ALLEGRO_ODSWIEZANIE_PANELU_MS=15\*60\*1000/);
  assert.match(allegro,/function allegroOdswiezDaneZSerweraJesliCzas/);
  assert.match(allegro,/allegroWczytajDane\(true,false,"summary"\)/);
  assert.match(allegro,/allegroDaneZaladowane\.orders&&orderChanged/);
  assert.match(allegro,/allegroDaneZaladowane\.offers&&offerChanged/);
  assert.match(allegro,/allegroWersjaSerwerowaZakresu/);
  assert.match(allegro,/function allegroKomunikacjaKluczeDoOdswiezenia/);
  assert.match(allegro,/latestNewIncomingKey/);
  assert.doesNotMatch(allegro,/\.map\(z=>`\$\{z\.id[^\n]+\.join\("\|"\)/);
  assert.match(cloud,/allegroOdswiezDaneZSerweraJesliCzas\(powod\)/);
  assert.match(cloud,/"\/admin\/allegro"/);
  assert.match(cloud,/\["INPUT","TEXTAREA","SELECT"\]/);
});

test("serwer cyklicznie sprawdza zamówienia, komunikację i katalog Allegro",async()=>{
  const [orders,communications,catalog,offers]=await Promise.all([
    read("netlify/functions/cron-allegro-orders.mjs"),
    read("netlify/functions/cron-allegro-communications.mjs"),
    read("netlify/functions/cron-allegro-catalog.mjs"),
    read("netlify/functions/cron-allegro-offers.mjs")
  ]);
  assert.match(orders,/schedule: '5,20,35,50 \* \* \* \*'/);
  assert.match(orders,/allegro-sync-orders/);
  assert.match(communications,/schedule: '\*\/15 \* \* \* \*'/);
  assert.match(communications,/allegro-sync-communications/);
  assert.match(catalog,/schedule: '10,25,40,55 \* \* \* \*'/);
  assert.match(catalog,/allegro-sync-offers/);
  assert.match(catalog,/details: false/);
  assert.match(offers,/schedule: '25 \*\/6 \* \* \*'/);
  assert.match(offers,/allegro-sync-offers/);
});

test("marker baseline Allegro jest zapisywany dopiero po trwałym zapisie zarchiwizowanych zamówień",async()=>{
  const backend=await read("netlify/functions/lib/store-app.mjs");
  const start=backend.indexOf("if (action === 'allegro-sync-orders')");
  const end=backend.indexOf("if (action === 'allegro-order-checked')",start);
  assert.ok(start>=0&&end>start,"brak sekcji synchronizacji zamówień Allegro");
  const route=backend.slice(start,end);
  const ordersWrite=route.indexOf("await zapisz('allegro_orders', rec)");
  const baselineWrite=route.indexOf("await zapisz('allegro_orders_baseline_v2'");
  const reconciliation=route.indexOf("allegroZapisStanIMozeUzgodnijPlan(items)");
  assert.ok(ordersWrite>=0,"brak trwałego zapisu zarchiwizowanych zamówień");
  assert.ok(baselineWrite>ordersWrite,"marker nie może powstać przed skutecznym zapisem zamówień");
  assert.ok(reconciliation>baselineWrite,"cutover musi zostać zatwierdzony przed dalszym uzgodnieniem Planu");
  assert.match(route,/resolveAllegroBaselineCutover\(baselineRec, poprzedniRec\)/,"zapisany baseline_at zamówień musi umożliwiać recovery brakującego markera");
  assert.match(route,/if \(baselineMarkerMissing\) await zapisz\('allegro_orders_baseline_v2'/,"brakujący marker musi być naprawiany także po odzyskaniu baseline z zamówień");
  assert.equal(route.slice(0,ordersWrite).includes("zapisz('allegro_orders_baseline_v2'"),false,"awaria zapisu zamówień musi pozostawić marker nieustawiony do bezpiecznego retry");
});
