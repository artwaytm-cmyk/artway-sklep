import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");

test("panel zapamiętuje ostatnie podstrony i ma kontrolowany powrót bez zapętlenia",async()=>{
  const router=await read("assets/app.js"),history=await read("src/frontend/08a-admin-responsive-layout.js"),shell=await read("assets/app.js"),styles=await read("src/styles/29-commerce-catalog-actions.css");
  assert.match(history,/ADMIN_HISTORIA_KLUCZ/);
  assert.match(history,/function adminZarejestrujTrase/);
  assert.match(history,/function adminWrocDoPoprzedniejStrony/);
  assert.match(history,/function adminAktualizujPrzyciskHistorii/);
  assert.match(history,/adminNawigacjaCofania=true/);
  assert.match(router,/hashchange.*adminZarejestrujTrase\(trasa\(\)\)/s);
  assert.match(shell,/class="admin-history-back"/);
  assert.match(shell,/adminPoprzedniaTrasa\(\)/);
  assert.match(styles,/\.admin-history-back/);
});
