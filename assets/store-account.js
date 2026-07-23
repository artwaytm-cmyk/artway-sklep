/* GENERATED STORE ACCOUNT — loaded on demand */
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
function pobierzProfilKonta(email){
  return pobierzUzytkownikow().find(x=>x.email===String(email||"").trim().toLowerCase())||null;
}
function polaProfiluKontaHTML(k={}){
  return `<h3 class="f-sekcja">👤 Dane kontaktowe</h3>
    <div class="f-row"><div class="f-group"><label>Imię i nazwisko *</label><input required name="imie" value="${esc(k.imie||"")}"></div><div class="f-group"><label>E-mail</label><input readonly name="email" type="email" value="${esc(k.email||"")}" style="background:var(--line)"></div></div>
    <div class="f-group"><label>Telefon</label><input name="telefon" type="tel" value="${esc(k.telefon||"")}" autocomplete="tel"></div>
    <h3 class="f-sekcja">📍 Adres</h3>
    <div class="f-row" style="grid-template-columns:2fr 1fr 1fr"><div class="f-group"><label>Ulica</label><input name="ulica" value="${esc(k.ulica||"")}"></div><div class="f-group"><label>Nr domu</label><input name="nrDomu" value="${esc(k.nrDomu||"")}"></div><div class="f-group"><label>Nr lokalu</label><input name="nrLokalu" value="${esc(k.nrLokalu||"")}"></div></div>
    <div class="f-row" style="grid-template-columns:1fr 2fr"><div class="f-group"><label>Kod pocztowy</label><input name="kod" value="${esc(k.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div><div class="f-group"><label>Miejscowość</label><input name="miasto" value="${esc(k.miasto||"")}"></div></div>
    <h3 class="f-sekcja">🧾 Dane firmowe (opcjonalnie)</h3>
    <div class="f-row" style="grid-template-columns:1fr auto;align-items:end"><div class="f-group"><label>NIP</label><input name="nip" value="${esc(k.nip||"")}" maxlength="13" inputmode="numeric"></div><div class="f-group"><button type="button" class="btn ghost" onclick="nipDoFormularza(this.form,this)">Pobierz dane z NIP</button></div></div>
    <div class="f-group"><label>Nazwa firmy</label><input name="firma" value="${esc(k.firma||"")}"></div>`;
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
  logowanieMfaStan=null;
  const email=String(user?.email||"").trim().toLowerCase(),lista=pobierzUzytkownikow(),index=lista.findIndex(entry=>String(entry?.email||"").trim().toLowerCase()===email);
  if(email){
    const record={...(index>=0?lista[index]:{}),...user,email,hash:""};
    if(index>=0)lista[index]=record;else lista.push(record);
    zapiszLS("artway_uzytkownicy",lista);
  }
  ustawSesje(user);zapiszLS("artway_admin_session_refreshed_at",Date.now());
  const admin=user.rola==="admin"||jestGlownymAdminem(user.email),cel=admin?"#/admin":"#/konto";
  toast("Witaj, "+String(user.imie||"Administrator").split(" ")[0]+"! 👋");
  location.hash=cel;
  const synchronizacja=()=>admin?synchronizujBazeCentralna(true):pobierzMojeZamowieniaCentralne(true);
  void Promise.resolve().then(synchronizacja).catch(bl=>{
    loguj("ostrzezenie","Zalogowano poprawnie; dane zostaną ponownie zsynchronizowane: "+String(bl?.message||bl),"logowanie");
    if(location.hash===cel)toast("Zalogowano. Dane odświeżą się automatycznie po odzyskaniu połączenia.");
  });
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
  const button=e.submitter;if(button){button.disabled=true;button.textContent="Loguję…";}
  try{
    const f = new FormData(e.target);
    const w = await sprawdzLogowanie(f.get("email"), f.get("haslo"));
    if(!w.ok){ $("authMsg").innerHTML = `<div class="form-err">${esc(w.blad)}</div>`; return; }
    if(w.mfa){await pokazLogowanieMfa(w.mfa);return;}
    await zakonczLogowanie(w.uzytkownik);
  }catch(bl){
    $("authMsg").innerHTML=`<div class="form-err">${esc(bl?.message||"Nie udało się zalogować. Spróbuj ponownie.")}</div>`;
  }finally{
    if(button&&document.contains(button)){button.disabled=false;button.textContent="Zaloguj się";}
  }
}
async function obsluzRejestracje(e){
  e.preventDefault();
  const button=e.submitter;if(button){button.disabled=true;button.textContent="Tworzę konto…";}
  try{
    const f = new FormData(e.target);
    if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ $("authMsg").innerHTML='<div class="form-err">Wpisane hasła nie są takie same.</div>'; return; }
    const w = await zarejestrujUzytkownika(f.get("imie"), f.get("email"), f.get("haslo"));
    if(!w.ok){ $("authMsg").innerHTML = `<div class="form-err">${esc(w.blad)}</div>`; return; }
    ustawSesje(w.uzytkownik);
    toast("Konto założone! 🎉");
    location.hash="#/konto";
    void Promise.resolve().then(()=>pobierzMojeZamowieniaCentralne(true)).catch(bl=>loguj("ostrzezenie","Konto utworzone; historia zamówień odświeży się później: "+String(bl?.message||bl),"rejestracja"));
  }catch(bl){
    $("authMsg").innerHTML=`<div class="form-err">${esc(bl?.message||"Nie udało się utworzyć konta. Spróbuj ponownie.")}</div>`;
  }finally{
    if(button&&document.contains(button)){button.disabled=false;button.textContent="Załóż konto";}
  }
}

/* ═══════════ WIDOK: KONTO ═══════════ */
function widokKonto(){
  if(!sesja){ location.hash="#/logowanie"; return ""; }
  if(ustawieniaPodstrony("konto").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("konto");
  const admin=jestAdmin();
  const zam = pobierzZamowienia().filter(z=>z.email===sesja.email);
  const profil=pobierzProfilKonta(sesja.email)||{imie:sesja.imie,email:sesja.email};
  const dataKonta=value=>{
    const date=new Date(value||"");
    return Number.isFinite(date.getTime())?date.toLocaleString("pl-PL"):"—";
  };
  const owner=admin&&jestGlownymAdminem(sesja.email);
  const adminPanel=admin?`
    <section class="admin-account-hero">
      <div class="admin-account-identity">
        <span class="admin-account-avatar">A</span>
        <div><span class="order-pro-label">Bezpieczne konto służbowe</span><h1>Moje konto administratora</h1><p><b>${esc(sesja.imie||"Administrator")}</b> • ${esc(sesja.email)}</p></div>
      </div>
      <div class="admin-account-actions">
        <a class="btn" href="#/admin">Otwórz panel</a>
        ${owner?`<a class="btn ghost" href="#/admin/klienci/uprawnienia">Zarządzaj uprawnieniami</a>`:""}
        <a class="btn ghost" href="#/admin/system/diagnostyka">Diagnostyka</a>
        <button class="btn danger" type="button" onclick="wyloguj()">Wyloguj</button>
      </div>
    </section>
    <div class="admin-account-status-grid">
      <article><span>Rola</span><b>${owner?"Główny administrator":"Administrator"}</b><small>${owner?"Pełne zarządzanie kontami i rolami":"Dostęp operacyjny bez zarządzania właścicielem"}</small></article>
      <article><span>Weryfikacja logowania</span><b>${sesja.mfaEnabled?"Google Authenticator aktywny":"Konfiguracja przy logowaniu"}</b><small>Każde konto administratora wymaga drugiego składnika</small></article>
      <article><span>Limit bezczynności</span><b>${adminIdleTimeoutMinutes()} min</b><small>Po tym czasie nastąpi automatyczne wylogowanie</small></article>
      <article><span>Ważność sesji</span><b>${dataKonta(sesja.sessionExpiresAt)}</b><small>Serwer sprawdza aktualną rolę przy każdym żądaniu</small></article>
    </div>
    <div class="admin-account-security-note"><b>Ochrona dostępu jest aktywna.</b><span>Zwykły klient nie może wejść do panelu. Odebranie roli, usunięcie konta albo reset hasła unieważnia wcześniejsze sesje na innych urządzeniach.</span></div>
    <div class="admin-account-columns">
      <details class="admin-account-card" open>
        <summary><span>🔑</span><span><b>Zmień hasło</b><small>Zmiana wyloguje pozostałe sesje tego konta</small></span></summary>
        <form onsubmit="zmienHaslo(event)">
          <div class="f-group"><label>Obecne hasło</label><input required name="stare" type="password" autocomplete="current-password"></div>
          <div class="f-group"><label>Nowe hasło (min. 8 znaków)</label><input required name="nowe" type="password" minlength="8" autocomplete="new-password"></div>
          <div class="f-group"><label>Powtórz nowe hasło</label><input required name="nowe2" type="password" minlength="8" autocomplete="new-password"></div>
          <button class="btn" type="submit">Zapisz nowe hasło</button>
        </form>
      </details>
      <details class="admin-account-card" open>
        <summary><span>🛡️</span><span><b>Sesja i odzyskiwanie</b><small>MFA, bezczynność i kod awaryjny e-mail</small></span></summary>
        <form onsubmit="zapiszBezpieczenstwoKonta(event)">
          <div class="f-group"><label>Automatyczne wylogowanie po bezczynności</label><select name="idleTimeoutMinutes">${ADMIN_IDLE_TIMEOUT_OPTIONS.map(value=>`<option value="${value}" ${adminIdleTimeoutMinutes()===value?"selected":""}>${value<60?`${value} minut`:value===60?"1 godzina":`${value/60} godzin`}</option>`).join("")}</select></div>
          <ul class="admin-account-checks"><li>Google Authenticator przy logowaniu administratora</li><li>Jednorazowy kod odzyskania wysyłany wyłącznie na e-mail konta</li><li>Automatyczna kontrola roli i wersji zabezpieczeń</li></ul>
          <button class="btn" type="submit">Zapisz zabezpieczenia</button>
        </form>
      </details>
      <details class="admin-account-card">
        <summary><span>↻</span><span><b>Skonfiguruj Authenticator ponownie</b><small>Odłącz stary telefon i wyświetl nowy kod QR</small></span></summary>
        <form onsubmit="resetujWlasneMfa(event)">
          <div class="admin-account-security-note"><b>Hasło pozostanie bez zmian.</b><span>Reset wyloguje to konto na wszystkich urządzeniach. Podczas następnego logowania sklep poprosi o zeskanowanie nowego kodu QR.</span></div>
          <div class="f-group"><label>Aktualne hasło</label><input required name="currentPassword" type="password" autocomplete="current-password"></div>
          <button class="btn danger" type="submit">Odłącz i skonfiguruj ponownie</button>
        </form>
      </details>
    </div>
    <div class="admin-account-meta"><span>Ostatnie logowanie: <b>${dataKonta(sesja.lastLoginAt)}</b></span><span>Ostatnia zmiana roli: <b>${dataKonta(sesja.roleUpdatedAt)}</b></span><span>Ustawienia bezpieczeństwa: <b>${dataKonta(sesja.securitySettingsUpdatedAt)}</b></span></div>`:"";
  return `
  <div class="${klasaPodstrony("konto")} ${admin?"admin-account-page":""}"><div class="panel">
    ${admin?adminPanel:`
    ${ikonaPodstronyHTML("konto")}<h1>${esc(us.tytul)}</h1>
    <p style="color:var(--muted2);margin-bottom:.7rem">${esc(us.opis||"")}</p>
    <p><b>${esc(sesja.imie)}</b> • ${esc(sesja.email)}</p>
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
    <details style="margin-top:1.2rem" ${!profil.ulica?"open":""}>
      <summary style="cursor:pointer;font-weight:700;font-size:.92rem">📇 Moje dane do zamówień (adres, telefon, firma)</summary>
      <form onsubmit="zapiszMojeDane(event)" style="margin-top:.8rem;max-width:640px">
        ${polaProfiluKontaHTML(profil)}
        <button class="btn" type="submit">💾 Zapisz moje dane</button>
        <p class="pay-note" style="text-align:left;margin-top:.5rem">Te dane wypełnią się automatycznie przy każdym zamówieniu.</p>
      </form>
    </details>
    <details style="margin-top:.8rem">
      <summary style="cursor:pointer;font-weight:700;font-size:.92rem">🔑 Zmień hasło</summary>
      <form onsubmit="zmienHaslo(event)" style="max-width:380px;margin-top:.8rem">
        <div class="f-group"><label>Obecne hasło</label><input required name="stare" type="password" autocomplete="current-password"></div>
        <div class="f-group"><label>Nowe hasło (min. 8 znaków)</label><input required name="nowe" type="password" minlength="8" autocomplete="new-password"></div>
        <div class="f-group"><label>Powtórz nowe hasło</label><input required name="nowe2" type="password" minlength="8" autocomplete="new-password"></div>
        <button class="btn" type="submit">Zapisz nowe hasło</button>
      </form>
    </details>`}
  </div></div>`;
}
async function resetujWlasneMfa(e){
  e.preventDefault();if(!jestAdmin())return;
  const button=e.submitter,currentPassword=String(new FormData(e.target).get("currentPassword")||"");
  if(!confirm("Odłączyć obecny Google Authenticator? Nastąpi wylogowanie ze wszystkich urządzeń, a przy następnym logowaniu pojawi się nowy kod QR."))return;
  if(button){button.disabled=true;button.textContent="Resetuję zabezpieczenie…";}
  try{
    await chmura("account-mfa-reset",{method:"POST",body:{email:sesja.email,currentPassword},timeout:20000});
    ustawSesje(null);chmuraStan.admin=false;
    toast("Authenticator odłączony. Zaloguj się ponownie i zeskanuj nowy kod QR ✅");
    location.hash="#/logowanie";
  }catch(bl){toast("⚠️ Nie zresetowano Authenticatora: "+(bl.message||"błąd serwera"));}
  finally{if(button&&document.contains(button)){button.disabled=false;button.textContent="Odłącz i skonfiguruj ponownie";}}
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
  e.preventDefault();if(!sesja)return;
  const button=e.submitter,f=new FormData(e.target),nip=String(f.get("nip")||"").replace(/\D/g,"").slice(0,10);
  const dane={imie:String(f.get("imie")||"").trim(),telefon:String(f.get("telefon")||"").trim(),ulica:String(f.get("ulica")||"").trim(),nrDomu:String(f.get("nrDomu")||"").trim(),nrLokalu:String(f.get("nrLokalu")||"").trim(),kod:String(f.get("kod")||"").trim(),miasto:String(f.get("miasto")||"").trim(),nip,firma:String(f.get("firma")||"").trim()};
  if(dane.imie.length<2){toast("⚠️ Podaj imię i nazwisko");return;}
  if(nip&&!walidujNip(nip)){toast("⚠️ Nieprawidłowy NIP");return;}
  if(button){button.disabled=true;button.textContent="Zapisuję…";}
  try{
    const wynik=await chmura("account-profile-save",{method:"POST",body:{user:dane}});
    const lista=pobierzUzytkownikow(),index=lista.findIndex(x=>x.email===sesja.email),profil={...(index>=0?lista[index]:{}),...dane,email:sesja.email,...(wynik.user||{})};
    if(index>=0)lista[index]=profil;else lista.push(profil);zapiszLS("artway_uzytkownicy",lista);ustawSesje({...sesja,imie:profil.imie,verified:sesja.verified===true});
    toast("Dane konta zapisane ✅");renderuj();
  }catch(bl){toast("⚠️ Nie zapisano danych: "+(bl.message||"błąd serwera"));}
  finally{if(button&&document.contains(button)){button.disabled=false;button.textContent="💾 Zapisz moje dane";}}
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
