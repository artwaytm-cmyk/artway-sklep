async function zapiszTelegramDostepKonta(email,button){
  if(!jestAdmin())return toast("Brak uprawnień");
  const e=String(email||"").trim().toLowerCase(),u=pobierzUzytkownikow(),k=u.find(x=>String(x.email||"").toLowerCase()===e),row=button?.closest("tr");
  if(!k||!row)return toast("Nie znaleziono konta");
  if(!kontoMaRoleAdmin(k.email))return toast("Dostęp do czatu można przypisać tylko kontu administratora");
  const id=String(row.querySelector("[data-telegram-user-id]")?.value||"").trim();
  const access=!!row.querySelector("[data-telegram-access]")?.checked;
  const approver=!!row.querySelector("[data-telegram-approver]")?.checked;
  if(id&&!/^[1-9]\d*$/.test(id))return toast("ID użytkownika Telegram musi składać się wyłącznie z cyfr i nie może zaczynać się od zera");
  if((access||approver)&&!id)return toast("Najpierw wpisz ID użytkownika Telegram");
  const previous={telegramUserId:k.telegramUserId||"",telegramAccess:k.telegramAccess===true,telegramApprover:k.telegramApprover===true};
  k.telegramUserId=id;k.telegramAccess=access&&!!id;k.telegramApprover=approver&&k.telegramAccess;
  zapiszLS("artway_uzytkownicy",u);button.disabled=true;
  const saved=await zapiszUzytkownikaCentralnie(k);
  if(!saved){Object.assign(k,previous);zapiszLS("artway_uzytkownicy",u);toast("Nie udało się zapisać dostępu Telegram na serwerze");renderuj();return;}
  loguj("info",`${k.telegramAccess?"Nadano":"Odebrano"} dostęp do wspólnego czatu: ${e}`);
  toast(k.telegramAccess?"Dostęp do wspólnego czatu został przypisany automatycznie":"Dostęp do wspólnego czatu został odebrany");
  renderuj();
}

function telegramDostepKontaHTML(k,admin){
  if(!admin)return `<small>Najpierw nadaj rolę administratora</small>`;
  return `<div class="account-telegram-access"><input data-telegram-user-id inputmode="numeric" autocomplete="off" placeholder="ID użytkownika" aria-label="ID użytkownika Telegram" value="${esc(k.telegramUserId||"")}"><label><input data-telegram-access type="checkbox" ${k.telegramAccess===true?"checked":""}> wspólny czat</label><label><input data-telegram-approver type="checkbox" ${k.telegramApprover===true?"checked":""}> zatwierdzanie</label><button class="btn ghost" type="button" onclick="zapiszTelegramDostepKonta(${jsArg(k.email)},this)">Zapisz</button></div>`;
}
