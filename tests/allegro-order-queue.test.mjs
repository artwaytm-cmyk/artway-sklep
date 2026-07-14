import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const sourcePath=new URL("../src/frontend/11-allegro-and-orders.js",import.meta.url);

async function loadQueueHelpers(){
  const source=await readFile(sourcePath,"utf8");
  const pick=pattern=>source.match(pattern)?.[0]||"";
  const code=[
    pick(/^const ALLEGRO_STATUSY_ZAMKNIETE=.*$/m),
    pick(/^function allegroZamowienieZamknieteWAllegro.*$/m),
    pick(/^function allegroKategoriaKolejki.*$/m),
    pick(/^function allegroZamowienieAktywneLokalnie.*$/m),
    "globalThis.queue={allegroKategoriaKolejki,allegroZamowienieAktywneLokalnie};"
  ].join("\n");
  assert.ok(!code.includes("\n\n"),"brakuje wspólnych funkcji klasyfikacji kolejki Allegro");
  const context={
    allegroStatusKolejki:z=>String(z.officialStatus||"NEW").toUpperCase(),
    allegroZamowienieZrealizowaneLokalnie:z=>z.localCompleted===true
  };
  vm.runInNewContext(code,context);
  return {source,...context.queue};
}

test("lokalnie zrealizowane zlecenie nie pozostaje w statusie Nowe",async()=>{
  const {allegroKategoriaKolejki,allegroZamowienieAktywneLokalnie}=await loadQueueHelpers();
  const completed={officialStatus:"NEW",localCompleted:true};
  assert.equal(allegroKategoriaKolejki(completed),"zrealizowane");
  assert.equal(allegroZamowienieAktywneLokalnie(completed),false);
  assert.equal(allegroKategoriaKolejki({officialStatus:"NEW",localCompleted:false}),"NEW");
  assert.equal(allegroZamowienieAktywneLokalnie({officialStatus:"NEW",localCompleted:false}),true);
});
test("liczniki kolejki są rozłączne dla danych odpowiadających zgłoszeniu",async()=>{
  const {source,allegroKategoriaKolejki,allegroZamowienieAktywneLokalnie}=await loadQueueHelpers();
  const orders=[
    ...Array.from({length:1000},()=>({officialStatus:"NEW",localCompleted:true})),
    ...Array.from({length:115},()=>({officialStatus:"SENT",localCompleted:false}))
  ];
  const counts={do_obslugi:orders.filter(allegroZamowienieAktywneLokalnie).length};
  for(const order of orders){const bucket=allegroKategoriaKolejki(order);counts[bucket]=(counts[bucket]||0)+1;}
  assert.deepEqual({...counts},{do_obslugi:0,zrealizowane:1000,SENT:115});
  assert.match(source,/counts\[kategoria\]=\(counts\[kategoria\]\|\|0\)\+1/);
  assert.match(source,/filter\(allegroZamowienieAktywneLokalnie\)\.length/);
});
