import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("główne menu administratora jest pogrupowane według procesu pracy",async()=>{
  const source=await read("src/frontend/07-admin-shipping.js");
  for(const group of ["Obsługa sprzedaży","Towar i dane","Finanse","Rozwój sklepu","System"])assert.match(source,new RegExp(group));
  assert.ok(source.indexOf('"/admin/zamowienia"')<source.indexOf('"/admin/asortyment"'));
  assert.ok(source.indexOf('"/admin/asortyment"')<source.indexOf('"/admin/infakt"'));
  assert.ok(source.indexOf('"/admin/infakt"')<source.indexOf('"/admin/agent-ai"'));
  assert.ok(source.indexOf('"/admin/agent-ai"')<source.indexOf('"/admin/aktualizacja"'));
  assert.ok(source.indexOf('"/admin/wysylki"')<source.indexOf('"/admin/klienci"'));
  assert.ok(source.indexOf('"/admin/eksport"')<source.indexOf('"/admin/infakt"'));
});

test("grupy menu można zwijać, a aktywna trasa i liczniki pozostają widoczne",async()=>{
  const [source,styles,responsive]=await Promise.all([read("src/frontend/07-admin-shipping.js"),read("src/styles/06-admin-shell.css"),read("src/styles/09-notifications-and-responsive.css")]);
  assert.match(source,/przelaczGrupeMenuAdmina/);
  assert.match(source,/artway_admin_menu_otwarta_v2/);
  assert.match(source,/filtrujMenuAdmina/);
  assert.match(source,/aria-current="page"/);
  assert.match(source,/licznikGrupy/);
  assert.match(source,/licznikOperacyjny/);
  assert.match(source,/function adminMenuMobilneHTML/);
  assert.match(source,/class="admin-workspace-header"/);
  assert.match(source,/data-admin-shell/);
  assert.match(source,/przelaczTrybMenuAdmina/);
  assert.match(source,/artway_admin_menu_kompaktowe_v1/);
  assert.match(styles,/\.admin-nav-group\.collapsed \.admin-nav-items/);
  assert.match(styles,/height:calc\(100vh - 28px\)/);
  assert.match(styles,/\.admin-page\.admin-nav-compact/);
  assert.match(styles,/body\.admin-mode>\.topbar/);
  assert.match(styles,/\.admin-nav-search/);
  assert.match(styles,/\.admin-mobile-menu\{display:none\}/);
  assert.match(responsive,/\.admin-mobile-menu\{display:block\}/);
  assert.match(responsive,/\.admin-nav\{display:none\}/);
});
