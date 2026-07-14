import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("główne menu administratora jest pogrupowane według procesu pracy",async()=>{
  const source=await read("src/frontend/07-admin-shipping.js");
  for(const group of ["Sprzedaż i klienci","Produkty i logistyka","Finanse i dokumenty","Agent AI i SEO","System i ustawienia"])assert.match(source,new RegExp(group));
  assert.ok(source.indexOf('"/admin/zamowienia"')<source.indexOf('"/admin/asortyment"'));
  assert.ok(source.indexOf('"/admin/asortyment"')<source.indexOf('"/admin/infakt"'));
  assert.ok(source.indexOf('"/admin/infakt"')<source.indexOf('"/admin/agent-ai"'));
  assert.ok(source.indexOf('"/admin/agent-ai"')<source.indexOf('"/admin/personalizacja"'));
});

test("grupy menu można zwijać, a aktywna trasa i liczniki pozostają widoczne",async()=>{
  const [source,styles,responsive]=await Promise.all([read("src/frontend/07-admin-shipping.js"),read("src/styles/06-admin-shell.css"),read("src/styles/09-notifications-and-responsive.css")]);
  assert.match(source,/przelaczGrupeMenuAdmina/);
  assert.match(source,/artway_admin_menu_otwarta_v2/);
  assert.match(source,/filtrujMenuAdmina/);
  assert.match(source,/aria-current="page"/);
  assert.match(source,/licznikGrupy/);
  assert.match(source,/licznikOperacyjny/);
  assert.match(styles,/\.admin-nav-group\.collapsed \.admin-nav-items/);
  assert.match(styles,/max-height:calc\(100vh - 150px\)/);
  assert.match(styles,/\.admin-nav-search/);
  assert.match(responsive,/\.admin-nav-group\.collapsed \.admin-nav-items/);
  assert.match(responsive,/display:contents/);
});
