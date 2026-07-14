import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("otwarty panel okresowo pobiera wyniki synchronizacji Allegro bez przerywania formularzy",async()=>{
  const [allegro,cloud]=await Promise.all([read("src/frontend/11-allegro-and-orders.js"),read("src/frontend/07-admin-shipping.js")]);
  assert.match(allegro,/ALLEGRO_ODSWIEZANIE_PANELU_MS=60000/);
  assert.match(allegro,/function allegroOdswiezDaneZSerweraJesliCzas/);
  assert.match(allegro,/allegroWczytajDane\(true,false\)/);
  assert.match(allegro,/function allegroKomunikacjaKluczeDoOdswiezenia/);
  assert.match(allegro,/latestNewIncomingKey/);
  assert.match(allegro,/function allegroOfertaIdDoOdswiezenia/);
  assert.match(cloud,/allegroOdswiezDaneZSerweraJesliCzas\(powod\)/);
  assert.match(cloud,/"\/admin\/allegro"/);
  assert.match(cloud,/\["INPUT","TEXTAREA","SELECT"\]/);
});

test("serwer cyklicznie sprawdza zamówienia, komunikację i katalog Allegro",async()=>{
  const [orders,communications,offers]=await Promise.all([
    read("netlify/functions/cron-allegro-orders.mjs"),
    read("netlify/functions/cron-allegro-communications.mjs"),
    read("netlify/functions/cron-allegro-offers.mjs")
  ]);
  assert.match(orders,/schedule: '5,20,35,50 \* \* \* \*'/);
  assert.match(orders,/allegro-sync-orders/);
  assert.match(communications,/schedule: '\*\/15 \* \* \* \*'/);
  assert.match(communications,/allegro-sync-communications/);
  assert.match(offers,/schedule: '25 \*\/6 \* \* \*'/);
  assert.match(offers,/allegro-sync-offers/);
});
