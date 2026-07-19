import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("router zachowuje tekstowe identyfikatory produktów i dekoduje segment adresu",async()=>{
  const router=await read("src/frontend/06-router-and-storefront.js");
  assert.match(router,/function identyfikatorZTrasy\(route,index\)/);
  assert.match(router,/widokAdminProduktEdytuj\(identyfikatorZTrasy\(t,4\)\)/);
  assert.match(router,/widokProdukt\(identyfikatorZTrasy\(t,2\)\)/);
  assert.doesNotMatch(router,/widokAdminProduktEdytuj\(parseInt/);
  assert.doesNotMatch(router,/widokProdukt\(parseInt/);
});

test("operacje produktu nie niszczą UUID, EXTERNAL_ID ani identyfikatorów z prefiksem",async()=>{
  const files=[
    "src/frontend/09-seo.js",
    "src/frontend/10-agent-ai-admin-workspace.js",
    "src/frontend/11-allegro-and-orders.js",
    "src/frontend/11-allegro-manual-mapping-actions.js",
    "src/frontend/11-allegro-operations.js",
    "src/frontend/11-allegro-product-publication.js",
    "src/frontend/12-product-editor.js",
    "src/frontend/12a-product-actions.js"
  ];
  const sources=await Promise.all(files.map(read));
  for(let i=0;i<sources.length;i++)assert.doesNotMatch(sources[i],/pobierzProduktAdmin\(Number\(/,files[i]);
});

test("formularz edycji przekazuje identyfikator bezpiecznie do każdej operacji",async()=>{
  const editor=await read("src/frontend/12-product-editor.js");
  assert.match(editor,/zapiszProduktAdmin\(event,\$\{jsArg\(p\.id\)\}\)/);
  assert.match(editor,/duplikujProdukt\(\$\{jsArg\(p\.id\)\}\)/);
  assert.match(editor,/usunProduktAdmin\(\$\{jsArg\(p\.id\)\}\)/);
  assert.match(editor,/resetujEdycjeProduktu\(\$\{jsArg\(p\.id\)\}\)/);
});

test("edytor ma komplet kontrolek plików bez ładowania modułu personalizacji",async()=>{
  const [core,editor,personalization,build]=await Promise.all([
    read("src/frontend/08-admin-navigation.js"),
    read("src/frontend/12-product-editor.js"),
    read("src/frontend/15-personalization-and-publishing.js"),
    read("scripts/build-assets.mjs")
  ]);
  assert.match(core,/function wgrajObrazek\(/);
  assert.match(core,/function polePlikuHTML\(/);
  assert.match(editor,/function wgrajZdjecieProduktu\(/);
  assert.doesNotMatch(personalization,/function polePlikuHTML\(/);
  assert.match(build,/output: 'assets\/admin-core\.js'[\s\S]*?'src\/frontend\/08-admin-navigation\.js'/);
  assert.match(build,/output: 'assets\/admin-inventory\.js'[\s\S]*?'src\/frontend\/12-product-editor\.js'/);
});

test("podstrona kodów rabatowych ładuje moduł, w którym znajduje się jej widok",async()=>{
  const [router,promotions]=await Promise.all([
    read("src/frontend/06-router-and-storefront.js"),
    read("src/frontend/15c-campaign-studio-pro.js")
  ]);
  assert.match(promotions,/function widokAdminRabatyZaawansowane\(/);
  assert.match(router,/if\(t==="\/admin\/asortyment\/rabaty"\)add\("personalization"\)/);
});
