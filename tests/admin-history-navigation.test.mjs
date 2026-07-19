import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");

test("panel zapamiętuje ostatnie podstrony i ma kontrolowany powrót bez zapętlenia",async()=>{
  const router=await read("src/frontend/06-router-and-storefront.js"),shell=await read("src/frontend/07-admin-shipping.js"),styles=await read("src/styles/29-commerce-catalog-actions.css");
  assert.match(router,/ADMIN_HISTORIA_KLUCZ/);
  assert.match(router,/function adminZarejestrujTrase/);
  assert.match(router,/function adminWrocDoPoprzedniejStrony/);
  assert.match(router,/function adminAktualizujPrzyciskHistorii/);
  assert.match(router,/adminNawigacjaCofania=true/);
  assert.match(router,/hashchange.*adminZarejestrujTrase\(trasa\(\)\)/s);
  assert.match(shell,/class="admin-history-back"/);
  assert.match(shell,/adminPoprzedniaTrasa\(\)/);
  assert.match(styles,/\.admin-history-back/);
});
