function widokLogowanie(){
  if(sesja) { location.hash="#/konto"; return ""; }
  const us=ustawieniaPodstrony("logowanie");
  return `
  <div class="${klasaPodstrony("logowanie")}"><div class="panel auth-box">
    ${ikonaPodstronyHTML("logowanie")}<h1>${esc(us.tytul)}</h1><p style="color:var(--muted2);margin-bottom:.7rem">${esc(us.opis||"")}</p>
    <div id="authMsg"></div>
    <form id="loginForm" onsubmit="obsluzLogowanie(event)">
      <div class="f-group"><label>E-mail</label><input required name="email" type="text" autocomplete="username"></div>
      <div class="f-group"><label>Hasło</label><input required name="haslo" type="password" autocomplete="current-password"></div>
      <button class="checkout-btn" type="submit">Zaloguj się</button>
    </form>
    <p class="auth-alt">Nie masz konta? <a href="#/rejestracja">Zarejestruj się</a></p>
  </div></div>`;
}
let logowanieMfaStan=null;
function zaladujGeneratorQrMfa(){
  if(window.qrcode)return Promise.resolve(true);
  return new Promise((resolve,reject)=>{const istniejacy=document.querySelector('script[data-mfa-qr]');if(istniejacy){istniejacy.addEventListener("load",()=>resolve(true),{once:true});istniejacy.addEventListener("error",reject,{once:true});return;}const s=document.createElement("script");s.src="/assets/vendor/qrcode-generator.js";s.dataset.mfaQr="1";s.onload=()=>resolve(true);s.onerror=reject;document.head.appendChild(s);});
}
async function pokazLogowanieMfa(data){
  logowanieMfaStan=data;const setup=data.mfaSetupRequired===true,emailMode=!!data.emailRecoveryToken,form=$("loginForm");if(form)form.hidden=true;
  $("authMsg").innerHTML=`<section class="panel" style="margin:.8rem 0;padding:1rem;border:1px solid var(--line)"><div class="order-pro-label">🛡️ Weryfikacja administratora</div><h2 style="margin:.35rem 0">${setup?"Połącz Google Authenticator":emailMode?"Kod wysłany na e-mail":"Potwierdź logowanie"}</h2><p class="pay-note" style="text-align:left">${setup?"Zeskanuj kod QR w aplikacji Google Authenticator, a następnie wpisz aktualny sześciocyfrowy kod. Żaden plik z sekretami nie zostanie utworzony ani pobrany.":emailMode?`Wpisz sześciocyfrowy kod wysłany na ${esc(data.maskedEmail||"adres konta")}. Kod jest ważny 10 minut i działa jeden raz.`:"Wpisz aktualny sześciocyfrowy kod z Google Authenticator."}</p>${setup?`<div id="adminMfaQr" style="display:grid;place-items:center;min-height:220px;margin:.8rem 0"></div>`:""}<form onsubmit="potwierdzLogowanieMfa(event)" style="margin-top:1rem"><div class="f-group"><label>${emailMode?"Kod z wiadomości e-mail":"Kod 6-cyfrowy"}</label><input required autofocus name="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></div><button class="checkout-btn" type="submit">Zweryfikuj i zaloguj</button>${!setup&&!emailMode?`<button class="btn ghost" type="button" style="margin-top:.5rem;width:100%" onclick="wyslijKodOdzyskaniaMfa(this)">Nie mam dostępu do aplikacji — wyślij kod na e-mail</button>`:""}${emailMode?`<button class="btn ghost" type="button" style="margin-top:.5rem;width:100%" onclick="wrocDoAuthenticatoraMfa()">Użyj Google Authenticator</button>`:""}<button class="btn ghost" type="button" style="margin-top:.5rem;width:100%" onclick="anulujLogowanieMfa()">Wróć do logowania</button></form></section>`;
  if(setup){try{await zaladujGeneratorQrMfa();const qr=window.qrcode(0,"M");qr.addData(String(data.provisioningUri||""),"Byte");qr.make();const el=$("adminMfaQr");if(el)el.innerHTML=qr.createSvgTag({cellSize:5,margin:3,scalable:true});}catch(e){const el=$("adminMfaQr");if(el)el.innerHTML='<div class="form-err">Nie udało się narysować kodu QR. Wróć do logowania i spróbuj ponownie.</div>';}}
}
function anulujLogowanieMfa(){logowanieMfaStan=null;const form=$("loginForm");if(form)form.hidden=false;$("authMsg").innerHTML="";}
async function wyslijKodOdzyskaniaMfa(button){
  if(!logowanieMfaStan?.challengeToken)return;
  if(button){button.disabled=true;button.textContent="Wysyłam bezpieczny kod…";}
  try{
    const d=await chmura("login-mfa-email-request",{method:"POST",body:{challengeToken:logowanieMfaStan.challengeToken},timeout:18000});
    await pokazLogowanieMfa({...logowanieMfaStan,emailRecoveryToken:d.recoveryChallengeToken,maskedEmail:d.maskedEmail});
  }catch(bl){if(button){button.disabled=false;button.textContent="Nie mam dostępu do aplikacji — wyślij kod na e-mail";}const section=$("authMsg")?.querySelector("section");section?.insertAdjacentHTML("afterbegin",`<div class="form-err">${esc(bl.message||"Nie udało się wysłać kodu.")}</div>`);}
}
function wrocDoAuthenticatoraMfa(){
  if(!logowanieMfaStan)return;
  const next={...logowanieMfaStan};delete next.emailRecoveryToken;delete next.maskedEmail;void pokazLogowanieMfa(next);
}
async function potwierdzLogowanieMfa(e){
  e.preventDefault();if(!logowanieMfaStan)return;const button=e.submitter;if(button){button.disabled=true;button.textContent="Sprawdzam…";}
  try{
    const f=new FormData(e.target),emailMode=!!logowanieMfaStan.emailRecoveryToken;
    const d=await chmura(emailMode?"login-mfa-email-verify":"login-mfa",{method:"POST",body:emailMode?{recoveryChallengeToken:logowanieMfaStan.emailRecoveryToken,code:String(f.get("kod")||"").trim()}:{challengeToken:logowanieMfaStan.challengeToken,code:String(f.get("kod")||"").trim()}});
    await zakonczLogowanie({...d.user,imie:d.user?.imie||"Administrator",email:d.user?.email,rola:"admin",verified:true});
  }catch(bl){$("authMsg").querySelector(".form-err")?.remove();e.target.insertAdjacentHTML("beforebegin",`<div class="form-err">${esc(bl.message||"Nieprawidłowy kod.")}</div>`);if(button){button.disabled=false;button.textContent="Zweryfikuj i zaloguj";}}
}
async function zakonczLogowanie(user){
  logowanieMfaStan=null;ustawSesje(user);zapiszLS("artway_admin_session_refreshed_at",Date.now());
  if(user.rola==="admin"||jestGlownymAdminem(user.email))await synchronizujBazeCentralna(true);else await pobierzMojeZamowieniaCentralne(true);
  toast("Witaj, "+String(user.imie||"Administrator").split(" ")[0]+"! 👋");location.hash=jestAdmin()?"#/admin":"#/konto";
}
function widokRejestracja(){
  if(sesja) { location.hash="#/konto"; return ""; }
  if(ustawieniaPodstrony("rejestracja").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("rejestracja");
  return `
  <div class="${klasaPodstrony("rejestracja")}"><div class="panel auth-box">
    ${ikonaPodstronyHTML("rejestracja")}<h1>${esc(us.tytul)}</h1><p style="color:var(--muted2);margin-bottom:.7rem">${esc(us.opis||"")}</p>
    <div id="authMsg"></div>
    <form onsubmit="obsluzRejestracje(event)">
      <div class="f-group"><label>Imię i nazwisko</label><input required name="imie" autocomplete="name"></div>
      <div class="f-group"><label>E-mail</label><input required name="email" type="email" autocomplete="email"></div>
      <div class="f-group"><label>Hasło (min. 8 znaków)</label><input required name="haslo" type="password" minlength="8" autocomplete="new-password"></div>
      <div class="f-group"><label>Powtórz hasło</label><input required name="haslo2" type="password" minlength="8" autocomplete="new-password"></div>
      <button class="checkout-btn" type="submit">Załóż konto</button>
    </form>
    <p class="auth-alt">Masz już konto? <a href="#/logowanie">Zaloguj się</a></p>
    <p class="pay-note">Konto jest zapisywane we wspólnej bazie sklepu i działa na wszystkich urządzeniach.</p>
  </div></div>`;
}
async function obsluzLogowanie(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const w = await sprawdzLogowanie(f.get("email"), f.get("haslo"));
  if(!w.ok){ $("authMsg").innerHTML = `<div class="form-err">${esc(w.blad)}</div>`; return; }
  if(w.mfa){await pokazLogowanieMfa(w.mfa);return;}
  await zakonczLogowanie(w.uzytkownik);
}
async function obsluzRejestracje(e){
  e.preventDefault();
  const f = new FormData(e.target);
  if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ $("authMsg").innerHTML='<div class="form-err">Wpisane hasła nie są takie same.</div>'; return; }
  const w = await zarejestrujUzytkownika(f.get("imie"), f.get("email"), f.get("haslo"));
  if(!w.ok){ $("authMsg").innerHTML = `<div class="form-err">${esc(w.blad)}</div>`; return; }
  ustawSesje(w.uzytkownik);
  await pobierzMojeZamowieniaCentralne(true);
  toast("Konto założone! 🎉");
  location.hash="#/konto";
}

/* ═══════════ WIDOK: KONTO ═══════════ */
function widokKonto(){
  if(!sesja){ location.hash="#/logowanie"; return ""; }
  if(ustawieniaPodstrony("konto").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("konto");
  const admin=jestAdmin();
  const zam = pobierzZamowienia().filter(z=>z.email===sesja.email);
  return `
  <div class="${klasaPodstrony("konto")}"><div class="panel">
    ${ikonaPodstronyHTML("konto")}<h1>${esc(us.tytul)}</h1>
    <p style="color:var(--muted2);margin-bottom:.7rem">${admin?"Konto służbowe do zarządzania sklepem.":esc(us.opis||"")}</p>
    <p><b>${esc(sesja.imie)}</b> • ${esc(sesja.email)} ${admin?'<span class="lvl lvl-info">ADMINISTRATOR</span>':""}</p>
    ${admin?`
    <div class="sug" style="margin:.9rem 0"><span class="s-ico">🛡️</span><span><b>Tryb administratora</b><br>To konto nie ma ulubionych ani historii własnych zamówień. Zamówieniami klientów zarządzasz w panelu administracyjnym.</span></div>
    <div class="diag-actions">
      <a class="btn" style="background:var(--brand2)" href="#/admin">⚙️ Otwórz panel administratora</a>
      <button class="btn danger" onclick="wyloguj()">Wyloguj się</button>
    </div>`:`
    <div class="stat-grid">
      <div class="stat"><b>${zam.length}</b><small>zamówień</small></div>
      <div class="stat"><b>${zl(zam.reduce((s,z)=>s+z.razem,0))}</b><small>łączna wartość</small></div>
      <div class="stat"><b>${ulubione.length}</b><small>ulubionych</small></div>
    </div>
    <div class="diag-actions">
      <a class="btn" href="#/zamowienia">📦 Historia zamówień</a>
      <a class="btn ghost" href="#/ulubione">❤️ Ulubione</a>
      <button class="btn danger" onclick="wyloguj()">Wyloguj się</button>
    </div>
    <details style="margin-top:1.2rem" ${!(pobierzProfil(sesja.email)||{}).ulica?"open":""}>
      <summary style="cursor:pointer;font-weight:700;font-size:.92rem">📇 Moje dane do zamówień (adres, telefon, firma)</summary>
      <form onsubmit="zapiszMojeDane(event)" style="margin-top:.8rem;max-width:640px">
        ${polaKartotekiHTML(pobierzProfil(sesja.email)||{imie:sesja.imie, email:sesja.email}, {edycja:true, blokujEmail:true, bezNotatki:true, bezHasla:true})}
        <button class="btn" type="submit">💾 Zapisz moje dane</button>
        <p class="pay-note" style="text-align:left;margin-top:.5rem">Te dane wypełnią się automatycznie przy każdym zamówieniu.</p>
      </form>
    </details>`}
    <details style="margin-top:.8rem">
      <summary style="cursor:pointer;font-weight:700;font-size:.92rem">🔑 Zmień hasło</summary>
      <form onsubmit="zmienHaslo(event)" style="max-width:380px;margin-top:.8rem">
        <div class="f-group"><label>Obecne hasło</label><input required name="stare" type="password" autocomplete="current-password"></div>
        <div class="f-group"><label>Nowe hasło (min. 8 znaków)</label><input required name="nowe" type="password" minlength="8" autocomplete="new-password"></div>
        <div class="f-group"><label>Powtórz nowe hasło</label><input required name="nowe2" type="password" minlength="8" autocomplete="new-password"></div>
        <button class="btn" type="submit">Zapisz nowe hasło</button>
      </form>
    </details>
    ${admin?`<details style="margin-top:.8rem">
      <summary style="cursor:pointer;font-weight:700;font-size:.92rem">🛡️ Bezpieczeństwo sesji administratora</summary>
      <form onsubmit="zapiszBezpieczenstwoKonta(event)" style="max-width:520px;margin-top:.8rem">
        <div class="f-group"><label>Automatyczne wylogowanie po bezczynności</label><select name="idleTimeoutMinutes">${ADMIN_IDLE_TIMEOUT_OPTIONS.map(value=>`<option value="${value}" ${adminIdleTimeoutMinutes()===value?"selected":""}>${value<60?`${value} minut`:value===60?"1 godzina":`${value/60} godzin`}</option>`).join("")}</select></div>
        <p class="pay-note" style="text-align:left">Ruch myszą, klawiaturą lub dotyk odświeża aktywność. Po przekroczeniu limitu panel wyloguje konto również z podpisanej sesji serwera.</p>
        <p class="pay-note" style="text-align:left">Jeśli utracisz dostęp do Google Authenticator, po podaniu prawidłowego hasła możesz wysłać jednorazowy kod na e-mail tego konta.</p>
        <button class="btn" type="submit">Zapisz zabezpieczenia</button>
      </form>
    </details>`:""}
  </div></div>`;
}
async function zapiszBezpieczenstwoKonta(e){
  e.preventDefault();if(!jestAdmin())return;
  const button=e.submitter,value=Number(new FormData(e.target).get("idleTimeoutMinutes"));
  if(button){button.disabled=true;button.textContent="Zapisuję…";}
  try{
    const d=await chmura("account-security-settings",{method:"POST",body:{idleTimeoutMinutes:value}});
    ustawSesje({...sesja,...(d.user||{}),verified:true});zapiszLS("artway_admin_session_refreshed_at",Date.now());adminOdnotujAktywnosc(true);
    toast(`Automatyczne wylogowanie: ${value} min ✅`);
  }catch(bl){toast("⚠️ Nie zapisano zabezpieczeń: "+(bl.message||"błąd serwera"));}
  finally{if(button){button.disabled=false;button.textContent="Zapisz zabezpieczenia";}}
}
async function zapiszMojeDane(e){
  if(!sesja) return;
  await zapiszKartoteke(e, sesja.email);
}

/* ═══════════ WIDOK: ZAMÓWIENIA ═══════════ */
function trackingKlientaHTML(z){
  const w=daneWysylki(z), etap=etapWysylki(z), e=ETAPY_WYSYLKI[etap]||ETAPY_WYSYLKI.do_obslugi;
  const kolejnosc=["do_obslugi","przygotowanie","transport","doreczenie","dostarczona"];
  const idx=Math.max(0,kolejnosc.indexOf(etap)), problem=etap==="problem"||etap==="zwrot";
  const ostatnie=[...(w.historia||[])].pop();
  return `<div class="customer-track">
    <div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap"><b>${e.ikona} ${e.nazwa}</b>${w.przewidywaneDoreczenie?`<small>Planowane doręczenie: ${esc(w.przewidywaneDoreczenie)}</small>`:""}</div>
    <div class="track-progress">${kolejnosc.map((_,i)=>`<span class="${problem?"alert":i<=idx?"done":""}"></span>`).join("")}</div>
    ${w.numer?`<div style="font-size:.8rem">🚚 ${esc(nazwaPrzewoznika(w.przewoznik))} • nr <b>${esc(w.numer)}</b>${urlSledzenia(z)?` — <a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Śledź przesyłkę →</a>`:""}</div>`:"<small>Numer śledzenia pojawi się po przygotowaniu etykiety.</small>"}
    ${ostatnie?`<small style="display:block;margin-top:.3rem">Ostatnia aktualizacja: ${esc(ostatnie.status)} • ${esc(ostatnie.czas)}</small>`:""}
    ${problem?`<p style="margin:.45rem 0 0;color:var(--danger);font-size:.8rem"><b>Przesyłka wymaga sprawdzenia.</b> W razie potrzeby skontaktujemy się z Tobą.</p>`:""}
  </div>`;
}
function pozycjeZamowieniaKlientaHTML(z){
  const dane = Array.isArray(z.pozycjeDane) && z.pozycjeDane.length ? z.pozycjeDane : [];
  if(dane.length){
    return `<table class="log-table" style="margin-top:.45rem">
      <tr><th>Produkt</th><th>SKU</th><th>Ilość</th><th>Cena</th><th>Wartość</th></tr>
      ${dane.map(p=>`<tr>
        <td><b>${esc(p.nazwa||"Produkt")}</b>${p.wariant?`<br><small>Wariant: ${esc(p.wariant)}</small>`:""}</td>
        <td>${esc(p.sku||"—")}</td>
        <td>${esc(p.ilosc||1)}</td>
        <td>${zl(Number(p.cena||0))}</td>
        <td><b>${zl(Number(p.wartosc||0))}</b></td>
      </tr>`).join("")}
    </table>`;
  }
  const linie = Array.isArray(z.pozycje) ? z.pozycje : [];
  return linie.length ? `<div class="order-lines">${linie.map(p=>esc(p)).join("<br>")}</div>` : `<p class="pay-note">Brak szczegółowej listy pozycji dla tego zamówienia.</p>`;
}
function szczegolyZamowieniaKlientaHTML(z){
  const k=z.klient||{}, a=z.adresDostawy||{};
  const klient=[k.imie,k.nazwisko].filter(Boolean).join(" ") || z.email || "—";
  const adres = z.adres || [a.ulica&&`${a.ulica} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`, [a.kod,a.miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—";
  const koszty=kosztyZamowienia(z);
  const dostawa=[z.dostawa,z.paczkomat?`Paczkomat: ${z.paczkomat}`:"",koszty.paczkaWeekend?`Paczka w Weekend +${zl(koszty.paczkaWeekend)}`:""].filter(Boolean).join(" • ") || "—";
  const razem=kwotaNum(z.razem), platId=z.platnoscId||"";
  return `<details class="order-details" open style="margin-top:.7rem">
    <summary style="cursor:pointer;font-weight:800">Szczegóły zamówienia, płatności i śledzenia</summary>
    <div class="stat-grid" style="margin-top:.8rem">
      <div class="stat"><b>${zl(razem)}</b><small>kwota zamówienia</small></div>
      <div class="stat"><b>${esc(z.status||"nowe")}</b><small>status obsługi</small></div>
      <div class="stat"><b>${esc(z.platnosc||"—")}</b><small>płatność</small></div>
    </div>
    <div class="f-row" style="grid-template-columns:1fr 1fr;margin-top:.85rem">
      <div class="info-card"><span style="font-size:1.4rem">👤</span><b>Odbiorca</b><p>${esc(klient)}<br>${k.telefon?`Tel. ${esc(k.telefon)}<br>`:""}${esc(z.email||"")}${k.firma?`<br>Firma: ${esc(k.firma)}${k.nip?` • NIP: ${esc(k.nip)}`:""}`:""}</p></div>
      <div class="info-card"><span style="font-size:1.4rem">🚚</span><b>Dostawa</b><p>${esc(dostawa)}<br>${esc(adres)}</p></div>
    </div>
    <h3 class="f-sekcja">🧾 Produkty</h3>
    ${pozycjeZamowieniaKlientaHTML(z)}
    <h3 class="f-sekcja">💰 Podsumowanie kosztów</h3>
    <div class="summary" style="margin:.4rem 0 .9rem">${podsumowanieKosztowHTML(z,"Do zapłaty")}</div>
    <h3 class="f-sekcja">💳 Instrukcja płatności</h3>
    ${instrukcjaPlatnosciHTML(platId, z.nr, razem, z)}
    <h3 class="f-sekcja">📦 Śledzenie realizacji</h3>
    ${trackingKlientaHTML(z)}
  </details>`;
}
function widokZamowienia(){
  if(jestAdmin()) return `<div class="page"><div class="panel auth-box"><h1>🛡️ Konto administratora</h1><p>Historia własnych zamówień jest wyłączona dla kont administracyjnych.</p><p style="margin-top:1rem"><a class="btn" href="#/admin/zamowienia">Otwórz zamówienia klientów</a></p></div></div>`;
  if(ustawieniaPodstrony("zamowienia").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("zamowienia");
  const wszystkie = pobierzZamowienia();
  const numeryGoscia = wczytajLS("artway_zamowienia_goscia", []);
  const zam = sesja ? wszystkie.filter(z=>z.email===sesja.email) : wszystkie.filter(z=>!z.email||numeryGoscia.includes(z.nr));
  const naglowek = sesja ? "" : `<p style="margin-bottom:1rem"><a href="#/logowanie">Zaloguj się</a>, aby zamówienia były przypisane do Twojego konta.</p>`;
  return `
  <div class="${klasaPodstrony("zamowienia")}"><div class="panel">
    ${ikonaPodstronyHTML("zamowienia")}<h1>${esc(us.tytul)}</h1>
    <p style="color:var(--muted2);margin-bottom:.7rem">${esc(us.opis||"")}</p>
    ${naglowek}
    ${zam.length?`<p class="pay-note" style="text-align:left;margin:.2rem 0 1rem">W szczegółach każdego zamówienia widzisz produkty, adres, dostawę, płatność, instrukcję opłacenia i aktualny tracking.</p>`:""}
    ${zam.length ? zam.map(z=>`
      <div class="order-box">
        <div class="order-head">
          <b>${esc(z.nr)}</b>
          <span>${esc(z.data)}</span>
          <span class="status-chip">${esc(z.status)}</span>
          <b>${zl(z.razem)}</b>
          <button class="ci-remove" onclick="if(confirm('Usunąć zlecenie ${esc(z.nr)}? Nie wróci ono ponownie do obsługi.')) usunMojeZamowienie(${jsArg(z.nr)})" title="Usuń zlecenie">🗑️</button>
        </div>
        ${szczegolyZamowieniaKlientaHTML(z)}
      </div>`).join("")
    : `<p>Brak zamówień. <a href="#/">Zrób pierwsze zakupy →</a></p>`}
	  </div></div>`;
}
function widokDziekujemy(nr){
  const numer=nrZamowienia(nr);
  const z=pobierzZamowienia().find(x=>x.nr===numer);
  const razem=kwotaNum(z?.razem), platId=z?.platnoscId||"";
  if(z && platId==="paynow" && z.paynow?.paymentId && !paynowStatusAutosprawdzone.has(z.nr) && !["CONFIRMED","ERROR","EXPIRED","REJECTED","ABANDONED"].includes(String(z.paynow.status||"").toUpperCase())){
    paynowStatusAutosprawdzone.add(z.nr);
    setTimeout(()=>odswiezStatusPaynow(z.nr,z.paynow.paymentId),700);
  }
  return `<div class="page"><div class="panel" style="max-width:860px;margin:auto;text-align:center">
    <div class="big">✅</div>
    <h1>Dziękujemy za zamówienie!</h1>
    <p class="sub">Numer zamówienia: <b>${esc(numer||"—")}</b>${z?` • Kwota: <b>${zl(razem)}</b>`:""}</p>
    ${z?`<div class="stat-grid" style="text-align:center;margin:1rem 0">
      <div class="stat"><b>${esc(z.status||"nowe")}</b><small>status obsługi</small></div>
      <div class="stat"><b>${esc(z.platnosc||"—")}</b><small>wybrana płatność</small></div>
      <div class="stat"><b>${esc(z.platnoscId==="paynow"?paynowStatusTekst(z.paynow?.status):z.platnoscStatus||"przyjęto")}</b><small>status płatności</small></div>
    </div>
    <div style="text-align:left;margin-top:1rem">
      <h3 class="f-sekcja">💳 Płatność</h3>
      ${instrukcjaPlatnosciHTML(platId,z.nr,razem,z)}
      <h3 class="f-sekcja">🧾 Podsumowanie</h3>
      ${pozycjeZamowieniaKlientaHTML(z)}
      <div class="summary" style="margin:.7rem 0">${podsumowanieKosztowHTML(z,"Do zapłaty")}</div>
    </div>`:`<p class="pay-note">Jeżeli nie widzisz szczegółów, przejdź do „Moje zamówienia” albo zaloguj się na konto użyte przy zakupie.</p>`}
    <p class="pay-note" style="margin-top:1rem;text-align:center">Potwierdzenie zamówienia jest wysyłane automatycznie na e-mail klienta, gdy bramka e-mail jest skonfigurowana na serwerze.</p>
    <div class="diag-actions" style="justify-content:center;margin-top:1rem">
      <a class="btn" href="#/zamowienia">📦 Moje zamówienia</a>
      <a class="btn ghost" href="#/">← Wróć do sklepu</a>
    </div>
  </div></div>`;
}
async function usunMojeZamowienie(nr){
  if(jestAdmin()){ toast("Konto administratora nie usuwa zleceń z widoku klienta"); return; }
  const numer=nrZamowienia(nr), lista=pobierzZamowienia(), z=lista.find(x=>x.nr===numer);
  if(!numer){ toast("Brak numeru zlecenia"); return; }
  const email=(sesja?.email||z?.email||"").toLowerCase();
  oznaczZamowienieUsuniete(numer,{by:"customer",email});
  zapiszLS("artway_zamowienia",lista.filter(x=>x.nr!==numer));
  const goscie=wczytajLS("artway_zamowienia_goscia",[]);
  zapiszLS("artway_zamowienia_goscia",goscie.filter(x=>x!==numer));
  let serwerOk=false;
  if(email){
    try{
      const dostepy=wczytajLS("artway_dostep_zamowien",{});
      await chmura("store-order-delete-mine",{method:"POST",body:{number:numer,email,orderAccessToken:z?.orderAccessToken||dostepy[numer]||""}});
      serwerOk=true;
      if(dostepy[numer]){delete dostepy[numer];zapiszLS("artway_dostep_zamowien",dostepy);}
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    }catch(bl){
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
      loguj("blad",`Usuwanie zlecenia klienta ${numer}: ${bl.message}`);
    }
  }
  toast(serwerOk?"Zlecenie usunięte ze wspólnej bazy 🗑️":"Zlecenie usunięte lokalnie — serwer zsynchronizuje się przy następnym połączeniu");
  renderuj();
}

/* ═══════════ WIDOK: ULUBIONE ═══════════ */
