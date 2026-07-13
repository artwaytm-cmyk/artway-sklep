/* ── Dostawa i płatności ── */
let stanPaynowAdmin={sprawdzono:false,configured:false,env:"production",continueUrl:"",notificationUrl:"",apiBaseUrl:"",error:""};
function domyslneUrlePaynow(){
  return {notificationUrl:`${location.origin}/api/store?action=paynow-notification`, continueUrl:`${location.origin}/#/zamowienia`};
}
function paynowStatusAdminHTML(){
  const s=stanPaynowAdmin;
  if(!s.sprawdzono) return `<div class="pay-note" style="text-align:left">Kliknij „Sprawdź konfigurację Paynow”, aby zobaczyć czy Netlify ma ustawione klucze API.</div>`;
  if(s.error) return `<div class="pay-note" style="text-align:left;color:var(--danger)">Błąd sprawdzania Paynow: ${esc(s.error)}</div>`;
  return `<div class="backend-note" style="${s.configured?"border-color:#86efac;background:#f0fdf4;color:#166534":"border-color:#f59e0b;background:#fffbeb;color:#92400e"}">
    <b>${s.configured?"Paynow API skonfigurowane ✅":"Paynow API nie ma jeszcze kluczy na serwerze"}</b><br>
    Środowisko: <code>${esc(s.env||"production")}</code>${s.apiBaseUrl?` • API: <code>${esc(s.apiBaseUrl)}</code>`:""}<br>
    ${s.configured?"Klient po wybraniu Paynow dostanie automatyczny link płatności, a webhook zaktualizuje status zamówienia.":"Ustaw w Netlify zmienne PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY, potem zrób redeploy."}
  </div>`;
}
function paynowPanelAdminHTML(){
  const urls=domyslneUrlePaynow();
  return `<div class="panel">
    <h2 style="margin-top:0">💳 mBank Paynow API</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">To jest prawdziwa integracja API. Sekrety muszą być w Netlify Environment Variables, nie w HTML ani localStorage.</p>
    ${paynowStatusAdminHTML()}
    <div class="f-row" style="grid-template-columns:1fr 1fr;margin-top:1rem">
      <div class="f-group"><label>URL powiadomień / webhook Paynow</label><input readonly value="${esc(stanPaynowAdmin.notificationUrl||urls.notificationUrl)}" onclick="this.select()"></div>
      <div class="f-group"><label>URL powrotu klienta po płatności</label><input readonly value="${esc(stanPaynowAdmin.continueUrl||urls.continueUrl)}" onclick="this.select()"></div>
    </div>
    <table class="log-table" style="margin-top:.7rem">
      <tr><th>Zmienna Netlify</th><th>Co wpisać</th></tr>
      <tr><td><code>PAYNOW_API_KEY</code></td><td>Api-Key z panelu Paynow: Settings → Shops and poses → Authentication</td></tr>
      <tr><td><code>PAYNOW_SIGNATURE_KEY</code></td><td>Signature-Key z tego samego miejsca</td></tr>
      <tr><td><code>PAYNOW_ENV</code></td><td><code>production</code> dla prawdziwej sprzedaży albo <code>sandbox</code> do testów</td></tr>
      <tr><td><code>PAYNOW_CONTINUE_URL</code></td><td>Opcjonalnie: własny URL powrotu; domyślnie <code>${esc(urls.continueUrl)}</code></td></tr>
      <tr><td><code>PAYNOW_NOTIFICATION_URL</code></td><td>Opcjonalnie: własny webhook; domyślnie <code>${esc(urls.notificationUrl)}</code></td></tr>
    </table>
    <div class="diag-actions" style="margin-top:.9rem">
      <button class="btn" type="button" onclick="sprawdzPaynowKonfiguracje()">🔎 Sprawdź konfigurację Paynow</button>
      <button class="btn ghost" type="button" onclick="ustawUrlePaynow()">🔗 Ustaw URL-e w Paynow przez API</button>
      <a class="btn ghost" href="https://docs.paynow.pl/docs/v3/integration" target="_blank" rel="noopener">Dokumentacja Paynow</a>
    </div>
    <p class="pay-note" style="text-align:left;margin-top:.8rem">Po ustawieniu zmiennych w Netlify wykonaj redeploy. Dopiero wtedy przycisk „Sprawdź konfigurację” pokaże zielony status.</p>
  </div>`;
}
async function sprawdzPaynowKonfiguracje(){
  try{
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:""};
    const d=await chmura("paynow-config",{timeout:10000});
    stanPaynowAdmin={sprawdzono:true,configured:!!d.configured,env:d.env||"",continueUrl:d.continueUrl||"",notificationUrl:d.notificationUrl||"",apiBaseUrl:d.apiBaseUrl||"",error:""};
    toast(d.configured?"Paynow API skonfigurowane ✅":"Brak kluczy Paynow w Netlify");
  }catch(e){
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:e.message};
    toast("Paynow: "+e.message);
  }
  renderuj();
}
async function ustawUrlePaynow(){
  if(!chmuraToken){ chmuraUstawToken(); return; }
  try{
    toast("Ustawiam URL-e Paynow…");
    const d=await chmura("paynow-configure-urls",{method:"POST",body:domyslneUrlePaynow(),timeout:18000});
    stanPaynowAdmin={sprawdzono:true,configured:true,env:d.env||stanPaynowAdmin.env,continueUrl:d.continueUrl||"",notificationUrl:d.notificationUrl||"",apiBaseUrl:stanPaynowAdmin.apiBaseUrl,error:""};
    toast("URL-e Paynow ustawione ✅");
  }catch(e){
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:e.message};
    toast("Nie ustawiono URL-i Paynow: "+e.message);
    loguj("blad","Paynow configure urls: "+e.message);
  }
  renderuj();
}
function emailPanelAdminHTML(){
  const e=stanBramki.email||{};
  const gotowy=!!e.configured, polaczony=gotowy&&!!chmuraToken;
  return `<div class="panel">
    <h2 style="margin-top:0">📧 Bramka e-mail SMTP / Gmail</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">Automatyczne wiadomości wychodzą z serwera Netlify. Logowanie w Chrome do Gmaila nie wystarcza dla backendu — potrzebne jest hasło aplikacji Google albo dane SMTP zapisane jako sekrety Netlify.</p>
    <div class="backend-note" style="${gotowy?"border-color:#86efac;background:#f0fdf4;color:#166534":"border-color:#f59e0b;background:#fffbeb;color:#92400e"}">
      <b>${gotowy?"SMTP skonfigurowany ✅":"SMTP/Gmail nie jest jeszcze skonfigurowany"}</b><br>
      Nadawca: <code>${esc(e.from||"sklepartway@gmail.com")}</code> • Provider: <code>${esc(e.provider||"gmail-smtp")}</code><br>
      ${polaczony?"Panel ma hasło bazy — test i ręczne wiadomości mogą być wysyłane.":gotowy?"Wpisz hasło bazy administratora, aby wysyłać testy z panelu.":"Ustaw zmienne poniżej w Netlify i zrób redeploy."}
    </div>
    <table class="log-table" style="margin-top:.7rem">
      <tr><th>Zmienna Netlify</th><th>Wartość dla Gmail</th></tr>
      <tr><td><code>EMAIL_PROVIDER</code></td><td><code>gmail</code></td></tr>
      <tr><td><code>EMAIL_FROM</code></td><td><code>sklepartway@gmail.com</code></td></tr>
      <tr><td><code>EMAIL_FROM_NAME</code></td><td><code>Artway-TM</code></td></tr>
      <tr><td><code>SMTP_HOST</code></td><td><code>smtp.gmail.com</code></td></tr>
      <tr><td><code>SMTP_PORT</code></td><td><code>465</code></td></tr>
      <tr><td><code>SMTP_SECURE</code></td><td><code>true</code></td></tr>
      <tr><td><code>SMTP_USER</code></td><td><code>sklepartway@gmail.com</code></td></tr>
      <tr><td><code>SMTP_PASS</code></td><td>hasło aplikacji Google — nie zwykłe hasło do Gmaila</td></tr>
      <tr><td><code>EMAIL_ADMIN_TO</code></td><td>adres, na który sklep wyśle powiadomienie o nowym zamówieniu</td></tr>
    </table>
    <form onsubmit="wyslijTestEmail(event)" style="margin-top:1rem">
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>Wyślij test na adres</label><input type="email" name="email" value="${esc(KONFIG.emailSklepu)}" required></div>
        <div class="f-group"><button class="btn" type="submit" ${gotowy?"":"disabled"}>📧 Wyślij test</button></div>
      </div>
    </form>
    <div class="diag-actions" style="margin-top:.8rem">
      <button class="btn ghost" type="button" onclick="sprawdzBramke()">🔎 Sprawdź e-mail / Netlify</button>
      ${chmuraToken?"":`<button class="btn ghost" type="button" onclick="chmuraUstawToken()">🔑 Wpisz hasło bazy</button>`}
    </div>
  </div>`;
}
function widokAdminDostawy(){
  KONFIG.dostawy = normalizujDostawyInPost(KONFIG.dostawy);
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  const pobranie = KONFIG.platnosci.find(p=>p.id==="pobranie"), paynow = KONFIG.platnosci.find(p=>p.id==="paynow"), telefon = KONFIG.platnosci.find(p=>p.id==="telefon");
  const paczkomat = KONFIG.dostawy.find(d=>d.id==="paczkomat") || DOMYSLNA_DOSTAWA_INPOST;
  const kurierInpost = KONFIG.dostawy.find(d=>d.id==="kurier_inpost") || DOMYSLNA_DOSTAWA_INPOST_KURIER;
  return personalizacjaSzkielet("dostawy", `
  <div class="panel">
    <h1>🚚 Dostawa i płatności</h1>
    <form onsubmit="zapiszDostawy(event)">
      <h3 class="f-sekcja">🚚 Dostawy InPost</h3>
      <div class="backend-note" style="border-color:#facc15;background:#fffbeb;color:#713f12"><b>Aktywne są tylko metody InPost:</b> Paczkomat/Punkt InPost oraz Kurier InPost. Inni przewoźnicy i odbiór osobisty pozostają wyłączone.</div>
      <div class="f-row" style="grid-template-columns:1fr 1fr 1fr">
        <div class="f-group"><label>Paczkomat InPost (zł)</label><input name="kosztPaczkomat" inputmode="decimal" value="${paczkomat.koszt}"></div>
        <div class="f-group"><label>Kurier InPost (zł)</label><input name="kosztKurierInpost" inputmode="decimal" value="${kurierInpost.koszt}"><small style="color:var(--muted2)">Cena widoczna w koszyku, zamówieniach, e-mailach i eksportach.</small></div>
        <div class="f-group"><label>Darmowa dostawa od (zł)</label><input name="darmowaDostawaOd" inputmode="decimal" value="${KONFIG.darmowaDostawaOd}"></div>
      </div>
      <div class="backend-note"><b>Dla klienta dostępne są zawsze dokładnie dwie metody:</b> Paczkomat/Punkt InPost oraz Kurier InPost. Ceny ustawiasz powyżej, bez edycji kodu strony.</div>
      <div class="f-group" style="max-width:320px"><label>Deklarowany czas wysyłki — zmienia się wszędzie</label><input name="czasWysylki" value="${esc(czasWysylki())}" placeholder="np. 24 h, 48 h, 2 dni robocze"></div>
      <h3 class="f-sekcja">💳 Płatności i bramka</h3>
      <div class="f-group"><label>Awaryjny ręczny link mBank Paynow (opcjonalnie — gdy API nie jest jeszcze skonfigurowane)</label>
        <input name="linkPlatnosci" placeholder="https://paynow.pl/… albo link płatności z panelu" value="${esc(KONFIG.linkPlatnosci)}"></div>
      <div class="f-group" style="max-width:260px"><label>Numer do przelewu na telefon</label>
        <input name="numerPrzelewuTelefon" inputmode="tel" value="${esc(formatTelefonPlatnosci())}"></div>
      <div class="f-row">
        <label class="chk-row"><input type="checkbox" name="pobranieWl" ${pobranie.wylaczona?"":"checked"}> 💵 Za pobraniem włączone</label>
        <label class="chk-row"><input type="checkbox" name="paynowWl" ${paynow.wylaczona?"":"checked"}> 💳 mBank Paynow włączony</label>
        <label class="chk-row"><input type="checkbox" name="telefonWl" ${telefon.wylaczona?"":"checked"}> 📱 Przelew na telefon włączony</label>
      </div>
      <div class="f-group" style="max-width:220px"><label>Opłata za pobranie (zł)</label><input name="oplataPobranie" inputmode="decimal" value="${pobranie.oplata}"></div>
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz</button>
        <button class="btn danger" type="button" onclick="resetujUstawienia()">↩️ Przywróć wszystkie domyślne</button>
      </div>
	    </form>
	  </div>
	  ${paynowPanelAdminHTML()}
	  ${emailPanelAdminHTML()}
  <div class="panel">
    <h2 style="margin-top:0">➕ Dodatkowa metoda płatności</h2>
    <form onsubmit="dodajMetodePlatnosci(event)">
      <div class="f-row admin-three">
        <div class="f-group"><label>Nazwa</label><input required name="nazwa" placeholder="np. Płatność przy odbiorze osobistym"></div>
        <div class="f-group"><label>Opłata (zł)</label><input required name="oplata" inputmode="decimal" value="0"></div>
        <div class="f-group"><button class="btn" type="submit">➕ Dodaj</button></div>
      </div>
    </form>
    ${KONFIG.platnosci.filter(p=>!["pobranie","paynow","telefon","przelew","online"].includes(p.id)).length?`
      <table class="log-table"><tr><th>Metoda</th><th>Opłata</th><th></th></tr>
      ${KONFIG.platnosci.filter(p=>!["pobranie","paynow","telefon","przelew","online"].includes(p.id)).map(p=>`<tr><td><b>${esc(p.nazwa)}</b></td><td>${p.oplata?zl(p.oplata):"bez opłaty"}</td><td><button class="ci-remove" onclick="usunMetodePlatnosci('${p.id}')">🗑️</button></td></tr>`).join("")}</table>`:""}
  </div>`);
}
function zapiszDostawy(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const numer = tylkoCyfry(f.get("numerPrzelewuTelefon") || NUMER_PRZELEWU_TELEFON_DOMYSLNY);
  const platnosci = normalizujPlatnosci(KONFIG.platnosci).map(p=>({...p}));
  platnosci.forEach(p=>{
    if(p.id==="pobranie"){ p.oplata = +(parseFloat(String(f.get("oplataPobranie")).replace(",","."))||0).toFixed(2); p.wylaczona = !f.get("pobranieWl"); }
    if(p.id==="paynow") p.wylaczona = !f.get("paynowWl");
    if(p.id==="telefon"){ p.wylaczona = !f.get("telefonWl"); p.nazwa = `Przelew na telefon ${formatTelefonPlatnosci(numer)}`; }
  });
  zapiszCzescUstawien({
    linkPlatnosci: String(f.get("linkPlatnosci")).trim(),
    numerPrzelewuTelefon: numer,
    czasWysylki: String(f.get("czasWysylki")||"").trim(),
    darmowaDostawaOd: f.get("darmowaDostawaOd"),
    kurierInpostAktywny: true,
    kosztPaczkomat: f.get("kosztPaczkomat"),
    kosztKurierInpost: f.get("kosztKurierInpost"),
    dostawy: normalizujDostawyInPost([
      {...DOMYSLNA_DOSTAWA_INPOST,koszt:(()=>{const n=Number(String(f.get("kosztPaczkomat")).replace(",","."));return Number.isFinite(n)?n:DOMYSLNA_DOSTAWA_INPOST.koszt;})()},
      {...DOMYSLNA_DOSTAWA_INPOST_KURIER,koszt:(()=>{const n=Number(String(f.get("kosztKurierInpost")).replace(",","."));return Number.isFinite(n)?n:DOMYSLNA_DOSTAWA_INPOST_KURIER.koszt;})()}
    ]),
    oplataPobranie: f.get("oplataPobranie"),
    pobranieWl: !!f.get("pobranieWl"),
    paynowWl: !!f.get("paynowWl"),
    telefonWl: !!f.get("telefonWl"),
    platnosci
  });
}
function dodajMetodeDostawy(e){
  e.preventDefault();
  KONFIG.dostawy=normalizujDostawyInPost(KONFIG.dostawy);
  zapiszCzescUstawien({dostawy:KONFIG.dostawy.map(x=>({...x}))});
  toast("Dodatkowe metody dostawy są wyłączone — sklep wysyła tylko przez InPost");
  loguj("info","Zablokowano dodanie dodatkowej metody dostawy — aktywny tylko InPost");
}
function usunMetodeDostawy(id){
  KONFIG.dostawy=normalizujDostawyInPost(KONFIG.dostawy);
  zapiszCzescUstawien({dostawy:KONFIG.dostawy.map(x=>({...x}))});
  loguj("info","Znormalizowano metody dostawy do InPost");
}
function dodajMetodePlatnosci(e){
  e.preventDefault();
  const f = new FormData(e.target), oplata=parseFloat(String(f.get("oplata")).replace(",","."));
  if(!(oplata>=0)){ toast("Podaj poprawną opłatę"); return; }
  const p={id:"wlasna_p_"+Date.now(),nazwa:String(f.get("nazwa")).trim(),oplata:+oplata.toFixed(2)};
  KONFIG.platnosci=[...KONFIG.platnosci,p];
  zapiszCzescUstawien({platnosci:KONFIG.platnosci.map(x=>({...x}))});
  loguj("info","Dodano metodę płatności: "+p.nazwa);
}
function usunMetodePlatnosci(id){
  KONFIG.platnosci=KONFIG.platnosci.filter(p=>p.id!==id);
  zapiszCzescUstawien({platnosci:KONFIG.platnosci.map(x=>({...x}))});
  loguj("info","Usunięto dodatkową metodę płatności");
}

/* ── Wygląd i treści ── */
function widokAdminWyglad(){
  const u=ustawienia.uklad||{}, h=ustawienia.hero||{};
  const df=daneFirmy();
  return personalizacjaSzkielet("wyglad", `
  <div class="panel">
    <h1>🎨 Zaawansowany układ globalny</h1>
    <p style="font-size:.86rem;color:var(--muted2);margin-bottom:1rem">Ustawienia działają na całym sklepie. Kolorystyka pozostaje bez zmian.</p>
    <form onsubmit="zapiszWyglad(event)">
      <h3 class="f-sekcja">🏪 Sklep</h3>
      <div class="f-row">
        <div class="f-group"><label>Nazwa sklepu (logo)</label><input name="nazwaSklepu" value="${esc(KONFIG.nazwaSklepu)}"></div>
        <div class="f-group"><label>Telefon (stopka i kontakt)</label><input name="telefon" value="${esc(KONFIG.telefon)}"></div>
      </div>
      <div class="f-group"><label>E-mail sklepu (zamówienia i kontakt)</label><input name="emailSklepu" type="email" value="${esc(KONFIG.emailSklepu)}"></div>
      <h3 class="f-sekcja">🏢 Dane firmy do regulaminu i polityki prywatności</h3>
      <div class="f-row">
        <div class="f-group"><label>Nazwa firmy / sklepu</label><input name="firmaNazwa" value="${esc(df.nazwa)}"></div>
        <div class="f-group"><label>NIP firmy</label><input name="firmaId" inputmode="numeric" maxlength="10" value="${esc(df.nip||df.identyfikator)}"></div>
      </div>
      <div class="f-group"><label>Adres firmy (opcjonalnie)</label><input name="firmaAdres" value="${esc(df.adres||"")}" placeholder="Ulica, kod pocztowy, miejscowość"></div>
      <div class="f-group"><label>Logo graficzne (zamiast nazwy tekstowej)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          ${ustawienia.logoObraz?`<img src="${ustawienia.logoObraz}" style="height:36px;max-width:190px;object-fit:contain;border-radius:6px;background:var(--bg);padding:2px 6px">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — wyświetlana jest nazwa tekstowa</span>`}
          ${polePlikuHTML("wgrajLogo(this)", "Wgraj logo")}
          ${ustawienia.logoObraz?`<button class="btn danger" type="button" onclick="usunLogo()">🗑️ Usuń logo</button>`:""}
        </div>
      </div>
      <div class="f-group"><label>Miniaturka w zakładce przeglądarki (favicon)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          <img src="${esc(ustawienia.faviconObraz||domyslnyFavicon())}" style="width:34px;height:34px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:var(--bg);padding:2px">
          ${polePlikuHTML("wgrajFavicon(this)", "Wgraj miniaturkę")}
          ${ustawienia.faviconObraz?`<button class="btn danger" type="button" onclick="usunFavicon()">🗑️ Usuń miniaturkę</button>`:""}
          <small style="color:var(--muted2)">Najlepiej kwadrat PNG/JPG. Zmieni ikonę w karcie przeglądarki.</small>
        </div>
      </div>
      <div class="f-group"><label>Pasek na górze strony (może zawierać HTML, np. &lt;b&gt;)</label><input name="pasekInfo" value="${esc(pasekInfoHTML())}"></div>
      <div class="f-group" style="max-width:320px"><label>Czas wysyłki używany na całej stronie</label><input name="czasWysylki" value="${esc(czasWysylki())}" placeholder="np. 24 h, 48 h, 2 dni robocze"></div>
      <div class="f-group"><label>Tekst w wyszukiwarce</label><input name="tekstSzukaj" value="${esc(ustawienia.tekstSzukaj||"Szukaj produktu…")}"></div>
      <h3 class="f-sekcja">🖼️ Baner na stronie głównej</h3>
      <div class="f-group"><label>Mała etykieta nad tytułem</label><input name="heroEtykieta" value="${esc(h.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}"></div>
      <div class="f-group"><label>Tytuł banera</label><input name="heroTytul" value="${esc(KONFIG.heroTytul)}"></div>
      <div class="f-group"><label>Opis banera</label><textarea name="heroOpis" rows="2">${esc(KONFIG.heroOpis)}</textarea></div>
      <div class="f-row">
        <div class="f-group"><label>Tekst pierwszego przycisku</label><input name="heroPrzycisk1" value="${esc(h.przycisk1||"Zobacz ofertę")}"></div>
        <div class="f-group"><label>Tekst drugiego przycisku</label><input name="heroPrzycisk2" value="${esc(h.przycisk2||"Sprawdź promocje")}"></div>
      </div>
      <div class="f-group"><label>Link drugiego przycisku</label><input name="heroLink2" value="${esc(h.link2||"#/promocje")}" placeholder="#/promocje lub https://…"></div>
      <div class="f-group"><label>Zdjęcie tła baneru (opcjonalnie — z przyciemnieniem, tekst zostaje czytelny)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          ${h.obraz?`<img src="${h.obraz}" style="width:150px;height:60px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — kolorowy gradient</span>`}
          ${polePlikuHTML("wgrajTloHero(this)", "Wgraj tło")}
          ${h.obraz?`<button class="btn danger" type="button" onclick="usunTloHero()">🗑️ Usuń tło</button>`:""}
        </div>
      </div>
      <h3 class="f-sekcja">🎁 Pasek okazji (sekcja strony głównej)</h3>
      <div class="f-row">
        <div class="f-group"><label>Tytuł</label><input name="okazjaTytul" value="${esc(ustawienia.pasekOkazji?.tytul||"Dobry moment na zakupy")}"></div>
        <div class="f-group"><label>Tekst przycisku</label><input name="okazjaTekstLinku" value="${esc(ustawienia.pasekOkazji?.tekstLinku||"Zobacz okazje")}"></div>
      </div>
      <div class="f-group"><label>Opis (np. z aktualnym kodem rabatowym)</label><input name="okazjaOpis" value="${esc(ustawienia.pasekOkazji?.opis||"")}" placeholder="Użyj kodu START10 w koszyku i odbierz 10% rabatu na zamówienie."></div>
      <div class="f-group"><label>Link przycisku</label><input name="okazjaLink" value="${esc(ustawienia.pasekOkazji?.link||"#/promocje")}"></div>
      <p style="font-size:.82rem;margin:-.3rem 0 1rem"><a href="#/admin/bannery">Zarządzaj dodatkowymi banerami →</a> • <a href="#/admin/rozmieszczenie">Zmień kolejność sekcji →</a></p>
      <h3 class="f-sekcja">📐 Szerokość i gęstość</h3>
      <div class="settings-grid">
        <div class="setting-box"><h3>Szerokość strony</h3><select name="szerokosc" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="1100px" ${u.szerokosc==="1100px"?"selected":""}>Kompaktowa — 1100 px</option>
          <option value="1200px" ${!u.szerokosc||u.szerokosc==="1200px"?"selected":""}>Standardowa — 1200 px</option>
          <option value="1400px" ${u.szerokosc==="1400px"?"selected":""}>Szeroka — 1400 px</option>
        </select></div>
        <div class="setting-box"><h3>Karty produktów</h3><select name="kartaMin" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="200px" ${u.kartaMin==="200px"?"selected":""}>Więcej kart w rzędzie</option>
          <option value="240px" ${!u.kartaMin||u.kartaMin==="240px"?"selected":""}>Standardowe</option>
          <option value="280px" ${u.kartaMin==="280px"?"selected":""}>Duże karty</option>
        </select></div>
        <div class="setting-box"><h3>Odstępy</h3><select name="gestosc" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="compact" ${u.gestosc==="compact"?"selected":""}>Kompaktowe</option>
          <option value="standard" ${!u.gestosc||u.gestosc==="standard"?"selected":""}>Standardowe</option>
          <option value="comfortable" ${u.gestosc==="comfortable"?"selected":""}>Przestronne</option>
        </select></div>
        <div class="setting-box"><h3>Zaokrąglenia</h3><select name="promien" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="10px" ${u.promien==="10px"?"selected":""}>Małe</option>
          <option value="16px" ${!u.promien||u.promien==="16px"?"selected":""}>Standardowe</option>
          <option value="22px" ${u.promien==="22px"?"selected":""}>Duże</option>
        </select></div>
      </div>
      <h3 class="f-sekcja">🧩 Widoczność sekcji strony głównej</h3>
      <div class="settings-grid">
        <label class="chk-row"><input type="checkbox" name="sekcjaKategorie" ${u.sekcjaKategorie===false?"":"checked"}> Katalogi produktów</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaKroki" ${u.sekcjaKroki===false?"":"checked"}> Jak kupić — 4 kroki</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaOnas" ${u.sekcjaOnas===false?"":"checked"}> Sekcja o sklepie</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaFaq" ${u.sekcjaFaq===false?"":"checked"}> FAQ na stronie głównej</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaKontakt" ${u.sekcjaKontakt===false?"":"checked"}> Końcowa sekcja kontaktu</label>
        <label class="chk-row"><input type="checkbox" name="pasekInfoWidoczny" ${u.pasekInfoWidoczny===false?"":"checked"}> Pasek informacyjny u góry</label>
        <label class="chk-row"><input type="checkbox" name="statycznyNaglowek" ${u.statycznyNaglowek?"checked":""}> Nagłówek niesticky</label>
      </div>
      <h3 class="f-sekcja">📃 Stopka</h3>
      <div class="f-group"><label>Opis sklepu w stopce</label><textarea name="opisSklepu" rows="2">${esc(KONFIG.opisSklepu)}</textarea></div>
      <div class="f-group"><label>Dolny tekst stopki</label><input name="stopkaCopy" value="${esc(ustawienia.stopkaCopy||`© ${new Date().getFullYear()} ${KONFIG.nazwaSklepu}. Wszystkie prawa zastrzeżone.`)}"></div>
      <h3 class="f-sekcja">🔎 SEO i tytuł przeglądarki</h3>
      <div class="f-group"><label>Tytuł strony w Google i karcie przeglądarki</label><input name="seoTytul" value="${esc(ustawienia.seo?.tytul||KONFIG.nazwaSklepu+" — Sklep internetowy")}"></div>
      <div class="f-group"><label>Opis strony dla wyszukiwarek</label><textarea name="seoOpis" rows="2">${esc(ustawienia.seo?.opis||"Sklep wielobranżowy Artway-TM. Elektronika, dom i ogród, narzędzia, odzież i sport.")}</textarea></div>
      <div class="diag-actions"><button class="btn" type="submit">💾 Zapisz cały układ</button><button class="btn ghost" type="button" onclick="eksportujIndexHTML()">⬇️ Pobierz publiczny index.html</button><a class="btn ghost" href="#/">👁️ Podgląd sklepu</a></div>
    </form>
  </div>`);
}
function zapiszWyglad(e){
  e.preventDefault();
  const f = new FormData(e.target);
  zapiszCzescUstawien({
    nazwaSklepu: String(f.get("nazwaSklepu")).trim(),
    telefon: String(f.get("telefon")).trim(),
    emailSklepu: String(f.get("emailSklepu")).trim(),
    daneFirmy:{
      nazwa:String(f.get("firmaNazwa")||"Artway-TM").trim()||"Artway-TM",
      identyfikator:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      nip:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      adres:String(f.get("firmaAdres")||"").trim()
    },
    pasekInfo: String(f.get("pasekInfo")),
    czasWysylki: String(f.get("czasWysylki")||"").trim(),
    heroTytul: String(f.get("heroTytul")).trim(),
    heroOpis: String(f.get("heroOpis")).trim(),
    opisSklepu: String(f.get("opisSklepu")).trim(),
    tekstSzukaj:String(f.get("tekstSzukaj")).trim(),
    stopkaCopy:String(f.get("stopkaCopy")).trim(),
    seo:{tytul:String(f.get("seoTytul")).trim(),opis:String(f.get("seoOpis")).trim()},
    hero:{
      ...(ustawienia.hero||{}),   // zachowaj wgrane tło (obraz)
      etykieta:String(f.get("heroEtykieta")).trim(),
      przycisk1:String(f.get("heroPrzycisk1")).trim(),
      przycisk2:String(f.get("heroPrzycisk2")).trim(),
      link2:String(f.get("heroLink2")).trim()
    },
    pasekOkazji:{
      tytul:String(f.get("okazjaTytul")||"").trim(),
      opis:String(f.get("okazjaOpis")||"").trim(),
      tekstLinku:String(f.get("okazjaTekstLinku")||"").trim(),
      link:bezpiecznyLink(String(f.get("okazjaLink")||"#/promocje").trim())
    },
    uklad:{
      szerokosc:String(f.get("szerokosc")),
      kartaMin:String(f.get("kartaMin")),
      gestosc:String(f.get("gestosc")),
      promien:String(f.get("promien")),
      sekcjaKategorie:!!f.get("sekcjaKategorie"),
      sekcjaKroki:!!f.get("sekcjaKroki"),
      sekcjaOnas:!!f.get("sekcjaOnas"),
      sekcjaFaq:!!f.get("sekcjaFaq"),
      sekcjaKontakt:!!f.get("sekcjaKontakt"),
      pasekInfoWidoczny:!!f.get("pasekInfoWidoczny"),
      statycznyNaglowek:!!f.get("statycznyNaglowek")
    }
  });
}

/* ── 📁 OBRAZKI Z DYSKU (bez hostingu zdjęć) ──
   Wgrywane pliki są zmniejszane i zapisywane w ustawieniach sklepu
   (data-URL). Trafiają też do eksportowanego index.html — więc po
   publikacji klienci widzą Twoje grafiki. Limit ~1 MB po kompresji. */
function wgrajObrazek(input, maxSzer, poWgraniu){
  const plik = input.files && input.files[0];
  if(!plik) return;
  if(!plik.type.startsWith("image/")){ toast("⚠️ Wybierz plik graficzny (JPG/PNG)"); return; }
  const czytnik = new FileReader();
  czytnik.onload = () => {
    const img = new Image();
    img.onload = () => {
      try{
        const skala = Math.min(1, maxSzer / img.width);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * skala));
        c.height = Math.max(1, Math.round(img.height * skala));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const png = plik.type === "image/png" && plik.size < 300_000;   // małe PNG (logo) bez utraty przezroczystości
        let dataUrl = png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82);
        if(dataUrl.length > 900_000) dataUrl = c.toDataURL("image/jpeg", 0.6);
        if(dataUrl.length > 1_200_000){ toast("⚠️ Obrazek za duży nawet po kompresji — wybierz mniejszy"); return; }
        poWgraniu(dataUrl);
      }catch(b){ loguj("blad","Kompresja obrazka nie powiodła się: "+b.message); toast("⚠️ Nie udało się przetworzyć obrazka"); }
    };
    img.onerror = () => { toast("⚠️ Nie udało się odczytać obrazka"); loguj("ostrzezenie","Błąd odczytu wgrywanego obrazka"); };
    img.src = czytnik.result;
  };
  czytnik.readAsDataURL(plik);
}
function polePlikuHTML(onchange, etykieta){
  return `<label class="btn ghost" style="cursor:pointer;white-space:nowrap">📁 ${etykieta||"Wgraj z dysku"}<input type="file" accept="image/*" style="display:none" onchange="${onchange}"></label>`;
}
/* banery */
function wgrajObrazBanera(input, id){
  wgrajObrazek(input, 1200, url => {
    zapiszCzescUstawien({bannery: pobierzBannery().map(x=>x.id===id?{...x, obraz:url}:x)});
    loguj("info","Wgrano obrazek banera "+id);
  });
}
function usunObrazBanera(id){
  zapiszCzescUstawien({bannery: pobierzBannery().map(x=>{ const {obraz, ...reszta}=x; return x.id===id?reszta:x; })});
}
/* logo sklepu */
function wgrajLogo(input){ wgrajObrazek(input, 420, url => zapiszCzescUstawien({logoObraz:url})); }
function usunLogo(){ zapiszCzescUstawien({logoObraz:null}); }
/* miniaturka karty przeglądarki */
function wgrajFavicon(input){ wgrajObrazek(input, 96, url => zapiszCzescUstawien({faviconObraz:url})); }
function usunFavicon(){ zapiszCzescUstawien({faviconObraz:null}); }
/* tło baneru głównego */
function wgrajTloHero(input){ wgrajObrazek(input, 1600, url => zapiszCzescUstawien({hero:{...(ustawienia.hero||{}), obraz:url}})); }
function usunTloHero(){ const {obraz, ...h}=(ustawienia.hero||{}); zapiszCzescUstawien({hero:h}); }
/* zdjęcie produktu (wpisuje się do pola formularza) */
function wgrajZdjecieProduktu(input){
  wgrajObrazek(input, 900, url => {
    const form = input.closest ? input.closest("form") : input.form;
    const pole = form && form.zdjecie;
    if(pole) pole.value = url;
    const pg = $("podgladZdjecia");
    if(pg) pg.innerHTML = `<img src="${url}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">`;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj, aby zachować ✅");
  });
}

/* ── Wiele banerów ── */
function widokAdminBannery(){
  const bannery=pobierzBannery();
  return personalizacjaSzkielet("bannery",`
  <div class="panel">
    <h1>🖼️ Zarządzanie banerami</h1>
    <p style="font-size:.86rem;color:var(--muted2)">Banery pojawiają się pod głównym banerem strony. Możesz je dodawać, edytować, wyłączać, usuwać i zmieniać kolejność.</p>
    <form onsubmit="dodajBaner(event)" class="admin-banner">
      <div class="admin-banner-head"><b>➕ Nowy baner</b><span class="lvl lvl-info">${bannery.length}/8</span></div>
      <div class="f-row">
        <div class="f-group"><label>Tytuł</label><input required name="tytul" placeholder="Np. Wakacyjna promocja"></div>
        <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona","📣","📣")}</div>
      </div>
      <div class="f-group"><label>Opis</label><input name="opis" placeholder="Krótki opis banera"></div>
      <div class="f-row">
        <div class="f-group"><label>Tekst przycisku</label><input name="przycisk" value="Dowiedz się więcej"></div>
        <div class="f-group"><label>Link</label><input name="link" value="#/promocje" placeholder="#/promocje lub https://…"></div>
      </div>
      <button class="btn" type="submit" ${bannery.length>=8?"disabled":""}>➕ Dodaj baner</button>
    </form>
  </div>
  <div class="panel">
    <div class="admin-banner-head"><h2 style="margin:0">Aktywne i zapisane banery</h2><div><button class="btn ghost" onclick="eksportujIndexHTML()">⬇️ Publiczny index.html</button><button class="btn ghost" onclick="resetujBannery()">↩️ Domyślne</button></div></div>
    ${bannery.length?bannery.map((b,i)=>`
      <form class="admin-banner" onsubmit="zapiszBaner(event,'${b.id}')">
        <div class="admin-banner-head">
          <b>${esc(b.ikona||"📣")} Baner ${i+1}</b>
          <div>
            <button class="btn ghost" type="button" onclick="przesunBaner('${b.id}',-1)" ${i===0?"disabled":""}>↑</button>
            <button class="btn ghost" type="button" onclick="przesunBaner('${b.id}',1)" ${i===bannery.length-1?"disabled":""}>↓</button>
          </div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Tytuł</label><input required name="tytul" value="${esc(b.tytul||"")}"></div>
          <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona",b.ikona||"📣","📣")}</div>
        </div>
        <div class="f-group"><label>Opis</label><input name="opis" value="${esc(b.opis||"")}"></div>
        <div class="f-row">
          <div class="f-group"><label>Tekst przycisku</label><input name="przycisk" value="${esc(b.przycisk||"")}"></div>
          <div class="f-group"><label>Link</label><input name="link" value="${esc(b.link||"#/")}"></div>
        </div>
        <div class="f-group"><label>Obrazek banera (opcjonalnie — zastępuje ikonę, tekst zostaje)</label>
          <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
            ${b.obraz?`<img src="${b.obraz}" style="width:130px;height:58px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — baner z ikoną</span>`}
            ${polePlikuHTML(`wgrajObrazBanera(this,'${b.id}')`, "Wgraj obrazek")}
            ${b.obraz?`<button class="btn danger" type="button" onclick="usunObrazBanera('${b.id}')">🗑️ Usuń obrazek</button>`:""}
          </div>
        </div>
        <div class="diag-actions">
          <label class="chk-row"><input type="checkbox" name="aktywny" ${b.aktywny===false?"":"checked"}> Widoczny na stronie</label>
          <button class="btn" type="submit">💾 Zapisz</button>
          <button class="btn danger" type="button" onclick="if(confirm('Usunąć ten baner?')) usunBaner('${b.id}')">🗑️ Usuń</button>
        </div>
      </form>`).join(""):`<p>Brak banerów. Dodaj pierwszy powyżej.</p>`}
    <p><a class="btn ghost" href="#/">👁️ Zobacz banery na stronie</a></p>
  </div>`);
}
function daneBanera(f,id){
  return {id,ikona:String(f.get("ikona")||"📣").trim()||"📣",tytul:String(f.get("tytul")||"").trim(),
    opis:String(f.get("opis")||"").trim(),przycisk:String(f.get("przycisk")||"").trim()||"Dowiedz się więcej",
    link:bezpiecznyLink(String(f.get("link")||"#/").trim()),aktywny:!!f.get("aktywny")};
}
function dodajBaner(e){
  e.preventDefault(); const lista=pobierzBannery();
  if(lista.length>=8){toast("Możesz mieć maksymalnie 8 banerów");return;}
  const f=new FormData(e.target), b=daneBanera(f,"b_"+Date.now()); b.aktywny=true;
  zapiszCzescUstawien({bannery:[...lista,b]}); loguj("info","Dodano baner: "+b.tytul);
}
function zapiszBaner(e,id){
  e.preventDefault(); const b=daneBanera(new FormData(e.target),id);
  const stary = pobierzBannery().find(x=>x.id===id);
  if(stary?.obraz) b.obraz = stary.obraz;   // zachowaj wgrany obrazek
  zapiszCzescUstawien({bannery:pobierzBannery().map(x=>x.id===id?b:x)});
  loguj("info","Zapisano baner: "+b.tytul);
}
function usunBaner(id){ zapiszCzescUstawien({bannery:pobierzBannery().filter(x=>x.id!==id)}); loguj("info","Usunięto baner "+id); }
function przesunBaner(id,kierunek){
  const lista=pobierzBannery(), i=lista.findIndex(x=>x.id===id), j=i+kierunek;
  if(i<0||j<0||j>=lista.length)return;
  [lista[i],lista[j]]=[lista[j],lista[i]];
  zapiszCzescUstawien({bannery:lista});
}
function resetujBannery(){ zapiszCzescUstawien({bannery:DOMYSLNE_BANNERY.map(x=>({...x}))}); }

/* ── Układ każdej podstrony ── */
function widokAdminPodstrony(){
  return personalizacjaSzkielet("podstrony",`
  <div class="panel">
    <div class="admin-banner-head"><div><h1>🧱 Układ i nagłówki podstron</h1><p style="font-size:.86rem;color:var(--muted2)">Każda podstrona ma osobny tytuł, opis, szerokość, styl panelu i widoczność.</p></div>
      <div><button class="btn ghost" onclick="eksportujIndexHTML()">⬇️ Publiczny index.html</button><button class="btn ghost" onclick="resetujPodstrony()">↩️ Domyślne</button></div></div>
  </div>
  ${Object.entries(DOMYSLNE_PODSTRONY).map(([id,d])=>{const u=ustawieniaPodstrony(id);return `
    <form class="panel" style="margin-bottom:1rem" onsubmit="zapiszPodstrone(event,'${id}')">
      <div class="admin-banner-head"><h2 style="margin:0">${esc(d.nazwa)}</h2><a href="#/${id==="onas"?"o-nas":id}" class="btn ghost">👁️ Podgląd</a></div>
      <div class="f-group"><label>Tytuł strony</label><input required name="tytul" value="${esc(u.tytul)}"></div>
      <div class="f-group"><label>Opis pod tytułem</label><textarea name="opis" rows="2">${esc(u.opis||"")}</textarea></div>
      <div class="f-row">
        <div class="f-group"><label>Szerokość</label><select name="szerokosc">
          <option value="compact" ${u.szerokosc==="compact"?"selected":""}>Kompaktowa</option>
          <option value="standard" ${u.szerokosc==="standard"?"selected":""}>Standardowa</option>
          <option value="wide" ${u.szerokosc==="wide"?"selected":""}>Szeroka</option>
        </select></div>
        <div class="f-group"><label>Styl zawartości</label><select name="styl">
          <option value="panel" ${u.styl==="panel"?"selected":""}>Panel z cieniem</option>
          <option value="plain" ${u.styl==="plain"?"selected":""}>Prosty panel z ramką</option>
        </select></div>
      </div>
      <h3 class="f-sekcja">🧭 Rozmieszczenie sekcji tej podstrony</h3>
      <div style="display:grid;gap:.4rem;margin-bottom:.8rem">
        ${kolejnoscSekcjiPodstrony(id).map((sid,i)=>{const s=SEKCJE_PODSTRONY[sid], wid=sekcjaPodstronyWidoczna(id,sid);return `
        <div class="uklad-box ${wid?'':'wylaczona'}" style="margin-bottom:0">
          <span class="uklad-nr">${i+1}</span>
          <span style="flex:1"><b>${s.ikona} ${esc(s.nazwa)}</b></span>
          <button class="btn ghost uklad-btn" type="button" ${i===0?"disabled":""} onclick="przesunSekcjePodstrony('${id}','${sid}',-1)">↑</button>
          <button class="btn ghost uklad-btn" type="button" ${i===kolejnoscSekcjiPodstrony(id).length-1?"disabled":""} onclick="przesunSekcjePodstrony('${id}','${sid}',1)">↓</button>
          <button class="btn ghost uklad-btn" type="button" onclick="przelaczSekcjePodstrony('${id}','${sid}')">${wid?"👁️":"🙈"}</button>
        </div>`;}).join("")}
      </div>
      <div class="diag-actions"><label class="chk-row"><input type="checkbox" name="widoczna" ${u.widoczna===false?"":"checked"} ${id==="logowanie"?"disabled":""}> ${id==="logowanie"?"Logowanie zawsze dostępne":"Widoczna dla klientów"}</label><button class="btn" type="submit">💾 Zapisz podstronę</button></div>
    </form>`;}).join("")}`);
}
function zapiszPodstrone(e,id){
  e.preventDefault(); const f=new FormData(e.target);
  const podstrony={...(ustawienia.podstrony||{})};
  const poprzednia=podstrony[id]||{};
  podstrony[id]={...poprzednia,tytul:String(f.get("tytul")).trim(),opis:String(f.get("opis")||"").trim(),
    szerokosc:String(f.get("szerokosc")),styl:String(f.get("styl")),widoczna:id==="logowanie"?true:!!f.get("widoczna")};
  zapiszCzescUstawien({podstrony}); loguj("info","Zapisano układ podstrony "+id);
}
function przesunSekcjePodstrony(id,sekcja,kierunek){
  const podstrony={...(ustawienia.podstrony||{})};
  const u={...ustawieniaPodstrony(id)};
  const k=kolejnoscSekcjiPodstrony(id);
  const i=k.indexOf(sekcja), j=i+kierunek;
  if(i<0||j<0||j>=k.length)return;
  [k[i],k[j]]=[k[j],k[i]];
  podstrony[id]={...u,sekcjeOrder:k};
  zapiszCzescUstawien({podstrony});
}
function przelaczSekcjePodstrony(id,sekcja){
  const podstrony={...(ustawienia.podstrony||{})};
  const u={...ustawieniaPodstrony(id)};
  const uk=new Set(Array.isArray(u.sekcjeUkryte)?u.sekcjeUkryte:[]);
  uk.has(sekcja)?uk.delete(sekcja):uk.add(sekcja);
  podstrony[id]={...u,sekcjeUkryte:[...uk]};
  zapiszCzescUstawien({podstrony});
}
function resetujPodstrony(){ zapiszCzescUstawien({podstrony:{}}); }

/* ── Strony informacyjne (regulamin itd.) ── */
function widokAdminStrony(){
  const t = KONFIG.tresci || {};
  return personalizacjaSzkielet("strony", `
  <div class="panel">
    <h1>📄 Treści prawne</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin-bottom:.8rem">Własna treść zastępuje szablon. Możesz używać HTML (&lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;…). Puste pole = wraca szablon domyślny.</p>
    <form onsubmit="zapiszStrony(event)">
      <div class="f-group"><label>📜 Regulamin (<a href="#/regulamin" target="_self">podgląd</a>)</label><textarea name="regulamin" rows="7" placeholder="Puste = szablon domyślny">${esc(t.regulamin||"")}</textarea></div>
      <div class="f-group"><label>🔒 Polityka prywatności (<a href="#/prywatnosc">podgląd</a>)</label><textarea name="prywatnosc" rows="7" placeholder="Puste = szablon domyślny">${esc(t.prywatnosc||"")}</textarea></div>
      <div class="f-group"><label>↩️ Zwroty i reklamacje (<a href="#/zwroty">podgląd</a>)</label><textarea name="zwroty" rows="5" placeholder="Puste = szablon domyślny">${esc(t.zwroty||"")}</textarea></div>
      <button class="btn" type="submit">💾 Zapisz treści</button>
    </form>
  </div>`);
}
function zapiszStrony(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const tresci = {};
  for(const k of ["regulamin","prywatnosc","zwroty"]){
    const v = String(f.get(k)||"").trim();
    if(v) tresci[k] = v;
  }
  KONFIG.tresci = Object.keys(tresci).length ? tresci : null;
  zapiszCzescUstawien({tresci: KONFIG.tresci});
}

/* ── Eksporty ── */
function widokAdminEksport(sekcja="import"){
  const aktywna=["import","eksport","kopie","aktualizacja"].includes(String(sekcja||""))?String(sekcja||""):"import";
  const p=podgladImportuProduktow,kopia=wczytajLS("artway_ostatnia_kopia_importu",null);
  return adminSzkielet("/admin/eksport", `
  ${eksportSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="import"?"":"display:none"}">
    <h1>⇄ Import i eksport produktów</h1>
    <p style="color:var(--muted2)">Obsługa dużych katalogów JSON, CSV oraz OVF <code>.xls</code> zapisanego jako CSV. Import zawsze zaczyna się od analizy — żadne dane nie zmienią się przed kliknięciem „Wykonaj import”.</p>
    <div class="import-grid">
      <div class="import-box">
        <h2 style="margin-top:0">1. Wczytaj dane</h2>
        <label class="btn" style="cursor:pointer">📁 Wybierz JSON, CSV lub OVF .xls<input type="file" accept=".json,.csv,.xls,.txt,application/json,text/csv,application/vnd.ms-excel" onchange="wczytajPlikImportuProduktow(this)" style="display:none"></label>
        <button class="btn ghost" onclick="pobierzSzablonProduktowCSV()">⬇️ Pobierz szablon CSV</button>
        <button class="btn ghost" onclick="pobierzSzablonProduktowOVF()">⬇️ Szablon OVF .xls</button>
        <p class="pay-note" style="text-align:left">Możesz też wkleić dane z hurtowni lub arkusza:</p>
        <textarea id="importTekstProduktow" placeholder='JSON: [{"nazwa":"Produkt","kategoria":"AGD","cena":99.90}]&#10;&#10;CSV/OVF: GTIN,EXTERNAL_ID,NAME,STOCK,PRICE,MPN,DESCRIPTION,IMAGE1,CATEGORY,BRAND,COLOR,SIZE,MATERIAL'></textarea>
        <button class="btn ghost" style="margin-top:.5rem" onclick="analizujWklejonyImport()">🔎 Analizuj wklejone dane</button>
      </div>
      <div class="import-box">
        <h2 style="margin-top:0">2. Tryb importu</h2>
        <div class="f-group"><label>Sposób zapisu</label><select id="trybImportuProduktow">
          <option value="scal">Dodaj nowe i aktualizuj istniejące</option>
          <option value="zastap">Zastąp cały katalog importowanymi produktami</option>
        </select></div>
        <div class="backend-note"><b>Scalanie:</b> produkt jest rozpoznawany najpierw po EXTERNAL_ID/SKU, a dopiero potem po lokalnym ID. Istniejący zostanie zaktualizowany, a nowy dostanie wolne ID.<br><b>Zastąpienie:</b> obecny katalog zostanie ukryty i zastąpiony importem.</div>
        <p style="font-size:.82rem;color:var(--muted2)">Przed wykonaniem importu tworzona jest automatyczna kopia produktów, stanów magazynowych, kosza i mapowania.</p>
        ${kopia?`<button class="btn danger" onclick="cofnijOstatniImportProduktow()">↩️ Cofnij ostatni import (${new Date(kopia.data).toLocaleString("pl-PL")})</button>`:""}
        ${ostatniRaportImportu?`<div class="sug" style="margin-top:.7rem"><span class="s-ico">✅</span><span><b>Ostatni import zakończony</b><br>Dodano: ${ostatniRaportImportu.dodane} • zaktualizowano: ${ostatniRaportImportu.zaktualizowane} • pominięto: ${ostatniRaportImportu.pominiete}${ostatniRaportImportu.menuZImportu?` • dopisano do menu: ${ostatniRaportImportu.menuZImportu}`:""}</span></div>`:""}
      </div>
    </div>
    ${p?`
    <div class="import-box" style="margin-top:1rem">
      <h2 style="margin-top:0">3. Podgląd importu — ${esc(p.nazwa)} <span class="lvl lvl-info">${esc(p.format)}</span></h2>
      <div class="import-summary">
        <span>Wiersze: ${p.wszystkich}</span><span>Poprawne: ${p.produkty.length}</span><span>Błędy: ${p.bledy.length}</span><span>Ostrzeżenia: ${p.ostrzezenia.length}</span>
      </div>
      ${p.bledy.length?`<div class="import-errors"><b>Pozycje pominięte:</b><br>${p.bledy.slice(0,100).map(esc).join("<br>")}${p.bledy.length>100?`<br>… i ${p.bledy.length-100} kolejnych`:""}</div>`:""}
      ${p.ostrzezenia.length?`<details><summary>Ostrzeżenia (${p.ostrzezenia.length})</summary><div class="import-errors">${p.ostrzezenia.slice(0,100).map(esc).join("<br>")}</div></details>`:""}
      ${p.produkty.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>ID</th><th>Nazwa</th><th>Grupa menu</th><th>Katalog</th><th>Cena</th><th>Stan</th><th>EXTERNAL_ID / SKU</th><th>Zdjęcia</th></tr>
        ${p.produkty.slice(0,20).map(x=>`<tr><td>${x.id??"auto"}</td><td><b>${esc(x.nazwa)}</b></td><td>${esc(x.grupaKategorii||"—")}</td><td>${esc(x.kategoria)}</td><td>${zl(x.cena)}</td><td>${x.stan??"∞"}</td><td>${esc(x.externalId||x.sku||"—")}</td><td>${(x.zdjecie?1:0)+(x.zdjecia?.length||0)}</td></tr>`).join("")}
      </table></div>${p.produkty.length>20?`<p class="pay-note">Podgląd pokazuje pierwsze 20 z ${p.produkty.length} poprawnych produktów.</p>`:""}
      <button class="btn" style="margin-top:.7rem" onclick="wykonajImportProduktow()">✅ Wykonaj import ${p.produkty.length} ${p.produkty.length===1?"produktu":"produktów"}</button>`:"<p>Brak poprawnych produktów do importu.</p>"}
    </div>`:""}
  </div>
  <div class="panel" style="${aktywna==="eksport"?"":"display:none"}">
    <h1>📤 Eksport produktów</h1>
    <div class="f-row" style="align-items:end">
      <div class="f-group"><label>Zakres</label><select id="zakresEksportuProduktow" onchange="$('kategoriaEksportuBox').style.display=this.value==='kategoria'?'':'none'">
        <option value="widoczne">Cały aktywny katalog — gotowy na hosting (${produkty.length})</option>
        <option value="zaznaczone">Tylko zaznaczone produkty (${zaznaczoneProdukty.size})</option>
        <option value="kategoria">Wybrana kategoria</option>
      </select></div>
      <div class="f-group" id="kategoriaEksportuBox" style="display:none"><label>Kategoria</label><select id="kategoriaEksportuProduktow">${wszystkieKategorie().map(k=>`<option>${esc(k)}</option>`).join("")}</select></div>
    </div>
    <div class="diag-actions">
      <button class="btn" onclick="eksportujProduktyJSON()">📤 products.json na hosting</button>
      <button class="btn ghost" onclick="eksportujProduktyCSV()">📊 Pełny CSV do Excela</button>
      <button class="btn ghost" onclick="eksportujProduktyOVF()">📄 OVF .xls jak szablon</button>
      <button class="btn ghost" onclick="pobierzSzablonProduktowCSV()">📄 Szablon CSV</button>
      <button class="btn ghost" onclick="pobierzSzablonProduktowOVF()">📄 Szablon OVF .xls</button>
    </div>
    <p class="pay-note" style="text-align:left">Eksport zawiera: ID, nazwę, kategorię, ceny, stan, SKU, GTIN/EAN, EXTERNAL_ID, MPN, markę, krótki opis, pełny opis, etykietę, ikonę, zdjęcie główne, galerię do 16 zdjęć, warianty, kolor karty, kolor produktu, rozmiar i materiał. Produkty z kosza nie trafiają do pliku na hosting.</p>
  </div>
  <div class="panel" style="${aktywna==="kopie"?"":"display:none"}">
    <h1>📦 Pozostałe eksporty i kopie</h1>
    <div class="sug"><span class="s-ico">🌍</span><span><b>Publiczny index.html</b> — po rozbiciu projektu jest lekkim szkieletem strony i zawiera zapisane ustawienia publiczne. Kod działania sklepu jest w <code>assets/app.js</code>, a wygląd w <code>assets/styles.css</code>.<br>
      <button class="btn" style="margin-top:.4rem" onclick="eksportujIndexHTML()">Pobierz index.html z ustawieniami</button></span></div>
    <div class="sug"><span class="s-ico">📦</span><span><b>Zamówienia (CSV)</b> — wszystkie zamówienia do Excela: numery, statusy, kwoty, adresy.<br><button class="btn ghost" style="margin-top:.4rem" onclick="eksportujZamowienia()">Pobierz zamowienia.csv</button></span></div>
    <div class="sug"><span class="s-ico">👥</span><span><b>Klienci (CSV)</b> — lista zarejestrowanych kont.<br><button class="btn ghost" style="margin-top:.4rem" onclick="eksportujKlientow()">Pobierz klienci.csv</button></span></div>
    <div class="sug"><span class="s-ico">🛠️</span><span><b>Dziennik zdarzeń</b> — log błędów i zdarzeń; raport możesz wkleić w rozmowie z Claude.<br>
      <button class="btn ghost" style="margin-top:.4rem" onclick="pobierzPlikLogu()">Pobierz log (.txt)</button>
      <button class="btn ghost" style="margin-top:.4rem" onclick="kopiujRaport()">📋 Kopiuj raport dla Claude</button></span></div>
    <div class="sug"><span class="s-ico">💾</span><span><b>Pełna kopia panelu</b> — ustawienia, banery, układy podstron, produkty lokalne, klienci i zamówienia z tej przeglądarki.<br>
      <button class="btn ghost" style="margin-top:.4rem" onclick="eksportujKopieDanych()">Pobierz kopię JSON</button>
      <a class="btn ghost" style="margin-top:.4rem" href="#/diagnostyka">Przywracanie i kontrola →</a></span></div>
  </div>`);
}
let stanAktualizacji={sprawdzono:false,ladowanie:false,online:false,authenticated:false,enabled:false,publisher:null,error:""};
let wybranyIndexAktualizacji=null;
function formatRozmiaruPliku(n){
  n=Number(n)||0;return n>=1048576?(n/1048576).toFixed(2)+" MB":n>=1024?(n/1024).toFixed(1)+" KB":n+" B";
}
function wersjaZIndexu(html){
  return String(html||"").match(/<meta\s+name=["']artway-version["']\s+content=["']([^"']+)/i)?.[1]||"brak numeru";
}
async function sprawdzStatusAktualizacji(cicho=false){
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};if(!cicho)renderuj();
  try{
    const health=await wywolajBramke("health");
    stanAktualizacji={...stanAktualizacji,sprawdzono:true,ladowanie:false,online:true,authenticated:!!health.authenticated,enabled:!!health.publisher?.enabled,error:""};
    if(health.authenticated){
      const d=await wywolajBramke("site-status");
      stanAktualizacji={...stanAktualizacji,authenticated:true,enabled:!!d.publisher?.enabled,publisher:d.publisher||null};
    }
    if(!cicho)toast(health.authenticated?"Status aktualizacji pobrany ✅":"Backend działa — połącz bezpieczną sesję");
  }catch(e){
    stanAktualizacji={...stanAktualizacji,sprawdzono:true,ladowanie:false,online:false,error:e.message};
    if(!cicho)toast("Nie udało się sprawdzić aktualizacji");
  }
  if(trasa().startsWith("/admin/aktualizacja"))renderuj();
}
async function polaczAktualizacje(e){
  e.preventDefault();const f=new FormData(e.target);
  try{
    await wywolajBramke("login",{method:"POST",body:{password:String(f.get("apiPassword")||"")}});
    f.set("apiPassword","");await sprawdzStatusAktualizacji(true);toast("Bezpieczna sesja aktualizacji połączona ✅");
  }catch(bl){stanAktualizacji={...stanAktualizacji,error:bl.message};toast("Nie udało się połączyć");renderuj();}
}
function wczytajIndexDoAktualizacji(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>6*1024*1024){toast("⚠️ index.html może mieć maksymalnie 6 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>{
    try{
      const html=String(r.result||"");
      if(html.length<1000||!/<html/i.test(html)||!/<script/i.test(html)||!html.includes("PUBLIC_SETTINGS_START")||!html.includes("assets/app.js")||!html.includes("assets/styles.css"))throw new Error("To nie jest poprawny plik index.html Artway-TM po rozbiciu na pliki");
      wybranyIndexAktualizacji={nazwa:plik.name,rozmiar:plik.size,wersja:wersjaZIndexu(html),html};
      toast("Nowy index.html sprawdzony ✅");renderuj();
    }catch(e){wybranyIndexAktualizacji=null;toast("⚠️ "+e.message);renderuj();}
  };
  r.onerror=()=>toast("⚠️ Nie udało się odczytać index.html");
  r.readAsText(plik,"UTF-8");
}
function usunWybranyIndexAktualizacji(){wybranyIndexAktualizacji=null;renderuj();}
async function publikujAktualizacjeStrony(e){
  e.preventDefault();const f=new FormData(e.target),index=!!f.get("index"),produktyPlik=!!f.get("produkty");
  if(!index&&!produktyPlik){toast("Wybierz co najmniej jeden plik do aktualizacji");return;}
  if(!stanAktualizacji.authenticated){toast("Najpierw połącz bezpieczną sesję");return;}
  if(!stanAktualizacji.enabled){toast("Publikator jest wyłączony w config.php");return;}
  const nazwy=[index?"index.html":null,produktyPlik?"products.json":null].filter(Boolean).join(" i ");
  if(!confirm(`Opublikować ${nazwy} na działającej stronie? Poprzednia wersja zostanie automatycznie zapisana jako kopia.`))return;
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};renderuj();
  try{
    const body={note:String(f.get("notatka")||"Aktualizacja z panelu administratora").trim()};
    if(index){
      let html=wybranyIndexAktualizacji?.html;
      if(!html){const r=await fetch("/index.html",{cache:"no-store"});if(!r.ok)throw new Error("Nie udało się pobrać bieżącego index.html");html=await r.text();}
      body.index_html=osadzUstawieniaWIndexie(html);
    }
    if(produktyPlik)body.products=zakresEksportuProduktow("widoczne");
    const d=await wywolajBramke("site-publish",{method:"POST",body});
    stanAktualizacji={...stanAktualizacji,ladowanie:false,sprawdzono:true,online:true,authenticated:true,enabled:!!d.publisher?.enabled,publisher:d.publisher||null,error:""};
    if(index)localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    if(produktyPlik){
      const hash=prostyHash(JSON.stringify(body.products));
      localStorage.setItem("artway_produkty_publish_hash",hash);
      localStorage.setItem("artway_produkty_export_hash",hash);
    }
    wybranyIndexAktualizacji=null;
    loguj("info","Opublikowano bezpośrednio na hostingu: "+nazwy);
    toast("Strona została zaktualizowana ✅");renderuj();
  }catch(bl){
    stanAktualizacji={...stanAktualizacji,ladowanie:false,error:bl.message};
    loguj("blad","Aktualizacja strony: "+bl.message);toast("Aktualizacja nie powiodła się");renderuj();
  }
}
async function cofnijPublikacjeStrony(id){
  if(!confirm("Przywrócić tę kopię strony? Obecna wersja również zostanie zabezpieczona przed zmianą."))return;
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};renderuj();
  try{
    const d=await wywolajBramke("site-rollback",{method:"POST",body:{backup_id:id}});
    stanAktualizacji={...stanAktualizacji,ladowanie:false,publisher:d.publisher||null,error:""};
    loguj("info","Przywrócono kopię strony "+id);toast("Poprzednia wersja została przywrócona ↩️");renderuj();
  }catch(bl){stanAktualizacji={...stanAktualizacji,ladowanie:false,error:bl.message};toast("Nie udało się przywrócić kopii");renderuj();}
}
async function kopiujKonfiguracjePublikatora(){
  const tekst=`'publisher' => [\n    'enabled' => true,\n    'root' => dirname(__DIR__),\n    'max_backups' => 10,\n],`;
  try{await navigator.clipboard.writeText(tekst);toast("Konfiguracja skopiowana 📋");}
  catch(e){toast("Skopiuj konfigurację z instrukcji api/config.example.php");}
}
function statusPlikuPublikacji(nazwa,dane){
  if(!dane)return `<div class="info-card"><b>${nazwa}</b><p>brak danych</p></div>`;
  return `<div class="info-card"><b>${nazwa}</b><p>${dane.exists?"✅ istnieje":"❌ brak"} • ${dane.writable?"zapis możliwy":"brak zapisu"}<br>${dane.exists?`${formatRozmiaruPliku(dane.size)} • ${new Date(dane.modified).toLocaleString("pl-PL")}<br><code>${esc(dane.sha256||"")}</code>`:""}</p></div>`;
}
function widokAdminAktualizacja(sekcja="status"){
  const aktywna=["status","publikuj","index","kopie"].includes(String(sekcja||""))?String(sekcja||""):"status";
  const s=stanAktualizacji,p=s.publisher||{},last=p.last_publication,backups=p.backups||[];
  return adminSzkielet("/admin/aktualizacja",`
  ${aktualizacjaSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="status"?"":"display:none"}">
    <div class="admin-banner-head"><div><h1 style="margin:0">⬆️ Aktualizacja strony</h1><p style="color:var(--muted2);margin-top:.35rem">Wersja panelu: <b>${esc(document.querySelector('meta[name="artway-version"]')?.content||"—")}</b> • publikuj ustawienia i produkty; pełne aktualizacje kodu idą przez GitHub/Netlify razem z <code>assets/app.js</code> i <code>assets/styles.css</code>.</p></div>
      <button class="btn ghost" onclick="sprawdzStatusAktualizacji()" ${s.ladowanie?"disabled":""}>${s.ladowanie?"⏳ Sprawdzam…":"🔄 Odśwież status"}</button></div>
    <div class="import-summary">
      <span>${s.online?"✅ Backend online":"⚠️ Backend niesprawdzony"}</span>
      <span>${s.authenticated?"🔐 Sesja połączona":"🔒 Wymaga połączenia"}</span>
      <span>${s.enabled?"✅ Publikator włączony":"⚠️ Publikator wyłączony"}</span>
    </div>
    ${s.error?`<div class="backend-note" style="border-color:var(--danger)"><b>Błąd:</b> ${esc(s.error)}</div>`:""}
    ${s.online&&!s.authenticated?`<form onsubmit="polaczAktualizacje(event)" style="max-width:620px"><div class="f-row" style="grid-template-columns:1fr auto;align-items:end"><div class="f-group"><label>Hasło integracji z api/config.php</label><input type="password" name="apiPassword" required autocomplete="current-password"></div><div class="f-group"><button class="btn" type="submit">🔐 Połącz sesję</button></div></div></form>`:""}
    ${s.sprawdzono&&!s.enabled?`<div class="backend-note"><b>Jednorazowa konfiguracja:</b> dodaj sekcję <code>publisher</code> z pliku <code>api/config.example.php</code> do chronionego <code>api/config.php</code>. Pierwsze wgranie tej wersji API nadal wykonujesz przez SFTP; następne aktualizacje zrobisz tutaj.<br><button class="btn ghost" style="margin-top:.5rem" onclick="kopiujKonfiguracjePublikatora()">📋 Kopiuj sekcję konfiguracji</button></div>`:""}
    ${p.files?`<div class="info-grid">${statusPlikuPublikacji("index.html",p.files["index.html"])}${statusPlikuPublikacji("products.json",p.files["products.json"])}</div>`:""}
    ${last?`<div class="sug" style="margin-top:.8rem"><span class="s-ico">✅</span><span><b>Ostatnia aktualizacja: ${new Date(last.published_at).toLocaleString("pl-PL")}</b><br>Pliki: ${(last.files||[]).map(esc).join(", ")}${last.note?` • ${esc(last.note)}`:""}${last.restored_from?` • przywrócono z ${esc(last.restored_from)}`:""}</span></div>`:""}
  </div>
  <div class="panel" style="${aktywna==="publikuj"?"":"display:none"}">
    <h2 style="margin-top:0">Publikuj bieżące zmiany</h2>
    <form onsubmit="publikujAktualizacjeStrony(event)">
      <label class="chk-row"><input type="checkbox" name="index" checked> <span><b>index.html</b> — lekki szkielet strony i publiczne ustawienia panelu</span></label>
      <label class="chk-row"><input type="checkbox" name="produkty" checked> <span><b>products.json</b> — ${produkty.length} aktywnych produktów, ceny, stany, zdjęcia i warianty</span></label>
      <div class="f-group" style="margin-top:.7rem"><label>Notatka do aktualizacji</label><input name="notatka" maxlength="200" value="Aktualizacja z panelu administratora"></div>
      <div class="diag-actions"><button class="btn" type="submit" ${!s.authenticated||!s.enabled||s.ladowanie?"disabled":""}>${s.ladowanie?"⏳ Aktualizacja…":"⬆️ Publikuj na stronie"}</button></div>
    </form>
    <div class="backend-note" style="margin-top:1rem"><b>Co zostanie opublikowane?</b> Jeśli nie wybierzesz nowego pliku poniżej, panel użyje bieżącego index.html i automatycznie osadzi w nim aktualne ustawienia. Po rozbiciu kodu techniczne zmiany w JavaScript/CSS wdrażamy przez GitHub/Netlify, żeby nie pominąć żadnego pliku. Zawsze powstaje kopia poprzedniej wersji.</div>
  </div>
  <div class="panel" style="${aktywna==="index"?"":"display:none"}">
    <h2 style="margin-top:0">Wgraj nową wersję index.html</h2>
    <p style="color:var(--muted2)">Ten plik jest teraz szkieletem strony. Pełna aktualizacja techniczna wymaga też plików <code>assets/app.js</code> i <code>assets/styles.css</code>, dlatego standardowo wdrażamy ją przez GitHub/Netlify.</p>
    <label class="btn ghost" style="cursor:pointer">📁 Wybierz nowy index.html<input type="file" accept=".html,text/html" onchange="wczytajIndexDoAktualizacji(this)" style="display:none"></label>
    ${wybranyIndexAktualizacji?`<div class="sug" style="margin-top:.7rem"><span class="s-ico">📄</span><span><b>${esc(wybranyIndexAktualizacji.nazwa)}</b><br>Wersja ${esc(wybranyIndexAktualizacji.wersja)} • ${formatRozmiaruPliku(wybranyIndexAktualizacji.rozmiar)} <button class="btn danger" style="margin-left:.5rem" onclick="usunWybranyIndexAktualizacji()">Usuń wybór</button></span></div>`:""}
  </div>
  <div class="panel" style="${aktywna==="kopie"?"":"display:none"}">
    <h2 style="margin-top:0">Kopie i przywracanie</h2>
    ${backups.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>Data</th><th>Powód</th><th>Pliki</th><th>Akcja</th></tr>${backups.slice(0,10).map(b=>`<tr><td>${b.created?new Date(b.created).toLocaleString("pl-PL"):esc(b.id)}</td><td>${b.reason==="before-rollback"?"Przed przywróceniem":"Przed publikacją"}</td><td>${(b.files||[]).map(esc).join(", ")}</td><td><button class="btn ghost" onclick="cofnijPublikacjeStrony('${esc(b.id)}')" ${s.ladowanie?"disabled":""}>↩️ Przywróć</button></td></tr>`).join("")}</table></div>`:`<p style="color:var(--muted2)">Kopie pojawią się automatycznie po pierwszej publikacji.</p>`}
  </div>`);
}
function resetujUstawienia(){
  localStorage.removeItem("artway_ustawienia");
  loguj("info","Przywrócono domyślne ustawienia");
  location.reload();
}

/* ── Publikacja strony ── */
function kontrolePublikacji(){
  const k = [];
  k.push({ok:!domyslneHasloAdmina, tekst:"Hasło administratora zmienione z domyślnego (admin)", link:"#/konto", akcja:"Zmień hasło"});
  k.push({ok:!KONFIG.telefon.includes("000 000 000"), tekst:"Prawdziwy numer telefonu w stopce i kontakcie", link:"#/admin/wyglad", akcja:"Ustaw telefon"});
  k.push({ok:!widokRegulamin().includes("[nazwa firmy"), tekst:"Regulamin i polityka prywatności z danymi firmy", link:"#/admin/strony", akcja:"Uzupełnij"});
  k.push({ok:dostepnePlatnosci().length>0, tekst:"Co najmniej jedna forma płatności włączona ("+dostepnePlatnosci().map(p=>p.id).join(", ")+")", link:"#/admin/dostawy", akcja:"Ustaw płatności"});
  k.push({ok:produkty.length>0, tekst:"Produkty w sklepie ("+produkty.length+")", link:"#/admin/produkty", akcja:"Dodaj produkty"});
  const lokalneUstawienia=wczytajLS("artway_ustawienia",{}), kluczeUstawien=Object.keys(lokalneUstawienia).filter(x=>x!=="krokiPublikacji");
  const ustawieniaWyeksportowane=!kluczeUstawien.length||localStorage.getItem("artway_ustawienia_export_hash")===prostyHash(JSON.stringify(ustawienia));
  k.push({ok:ustawieniaWyeksportowane,tekst:ustawieniaWyeksportowane
    ?"Układ i ustawienia są przygotowane do publikacji"
    :`Masz zmiany panelu (${kluczeUstawien.length} sekcji) — opublikuj index.html bezpośrednio z panelu`,link:"#/admin/aktualizacja",akcja:"Aktualizuj stronę"});
  const zmianyLokalne = produktyDodane.length + produktyUkryte.length + Object.keys(produktyEdytowane).length
    + Object.keys(ustawienia.mapaProduktow||{}).length + Object.keys(ustawienia.kategorie||{}).length
    + (ustawienia.menuKategorii||[]).length + (ustawienia.menuPokazNieprzypisane===false?1:0);
  const aktualnyHashProduktow=prostyHash(JSON.stringify(zakresEksportuProduktow("widoczne")));
  const produktyPrzygotowane=!zmianyLokalne||localStorage.getItem("artway_produkty_export_hash")===aktualnyHashProduktow;
  k.push({ok:produktyPrzygotowane, tekst: produktyPrzygotowane
    ? "Produkty są przygotowane do publikacji"
    : "Masz lokalne zmiany produktów/katalogów ("+zmianyLokalne+") — opublikuj products.json bezpośrednio z panelu",
    link:"#/admin/aktualizacja", akcja:"Aktualizuj stronę"});
  return k;
}
const KROKI_PUBLIKACJI = [
  "Zalogowałem się do CloudHosting Panel nazwa.pl",
  "Wgrałem index.html, products.json i cały katalog api przez SFTP",
  "Ustawiłem zmienne Netlify dla SMTP, Paynow i InPost ShipX",
  "Skierowałem domenę na katalog z plikami strony",
  "Otworzyłem stronę pod własną domeną i wszystko działa",
  "Sprawdziłem stronę na telefonie",
  "Złożyłem testowe zamówienie i wysłałem jego potwierdzenie"
];
function przelaczKrok(i){
  const kroki = {...(ustawienia.krokiPublikacji||{})};
  kroki[i] = !kroki[i];
  zapiszCzescUstawien({krokiPublikacji: kroki});
}
function widokAdminPublikacja(sekcja="kontrola"){
  const aktywna=["kontrola","pliki","kroki","aktualizacja"].includes(String(sekcja||""))?String(sekcja||""):"kontrola";
  const kontrole = kontrolePublikacji();
  const gotowe = kontrole.filter(x=>x.ok).length;
  const kroki = ustawienia.krokiPublikacji || {};
  return adminSzkielet("/admin/publikacja", `
  ${publikacjaSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="kontrola"?"":"display:none"}">
    <h1>🌍 Publikacja strony</h1>
    <h2>Gotowość do startu: ${gotowe}/${kontrole.length} ${gotowe===kontrole.length?"— można publikować! 🎉":""}</h2>
    ${kontrole.map(x=>`<div class="sug" style="${x.ok?'':'background:#fef3c7'}">
      <span class="s-ico">${x.ok?"✅":"⚠️"}</span>
      <span>${x.tekst}${x.ok?"":` — <a href="${x.link}">${x.akcja} →</a>`}</span></div>`).join("")}
  </div>
  <div class="panel" style="${["pliki","kroki"].includes(aktywna)?"":"display:none"}">
    <div style="${aktywna==="pliki"?"":"display:none"}"><h2 style="margin-top:0">📁 Co wgrywasz na serwer</h2>
    <p style="font-size:.9rem;color:var(--muted2)">Przy pierwszym uruchomieniu na hostingu statycznym wgraj <b>index.html</b>, <b>products.json</b> oraz katalog <b>api</b>, jeżeli korzystasz z awaryjnego PHP. Aktualna, profesjonalna wersja sklepu używa jednak <b>Netlify Functions</b> do wspólnej bazy, e-maili, Paynow i InPost.</p>
    <div class="backend-note"><b>Ważne:</b> GitHub/Netlify są obecnie główną ścieżką publikacji. SFTP/nazwa.pl traktuj jako hosting plików lub plan awaryjny; sekrety InPost i płatności pozostają w zmiennych Netlify, nie w public_html.</div>
    <h2>Publikacja na nazwa.pl</h2>
    <details open style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">1. Połącz się bezpiecznie przez SFTP</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>Zaloguj się na <b>admin.nazwa.pl</b> identyfikatorem serwera (np. server123456)</li>
        <li>W CloudHosting Panel wybierz <b>WWW I FTP → Wykaz kont FTP</b></li>
        <li>Do połączenia SFTP użyj hosta <b>identyfikatorserwera.nazwa.pl</b> i portu <b>22</b></li>
        <li>Login i hasło są takie jak do CloudHosting Panel albo jak w utworzonym dodatkowym koncie FTP</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">2. Wgraj gotową paczkę</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>Otwórz katalog docelowy domeny. Jeśli domena wskazuje na <b>public_html</b>, wejdź do public_html</li>
        <li>Jeżeli public_html nie istnieje, wybierz katalog wskazany dla domeny w CloudHosting Panel</li>
        <li>Wgraj tam całą zawartość folderu <b>artway-tm-nazwa-pl</b>: index.html, products.json i katalog api</li>
        <li>Nazwy plików pozostaw bez zmian; nie umieszczaj ich w dodatkowym zagnieżdżonym folderze</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">3. Skonfiguruj adapter InPost</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>W Parcel Manager InPost wygeneruj token API ShipX oraz publiczny token Geowidget</li>
        <li>W Netlify ustaw: <b>INPOST_TOKEN</b>, <b>INPOST_ORG_ID</b>, opcjonalnie <b>INPOST_GEOWIDGET_TOKEN</b></li>
        <li>Dla testów ustaw <b>INPOST_ENV=sandbox</b>; po testach zmień na <b>production</b></li>
        <li>W panelu sklepu otwórz Centrum wysyłek → Bramka i ustawienia → Test API InPost</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">4. Skieruj domenę na katalog strony</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>W Panelu Klienta nazwa.pl przejdź do <b>Usługi → Domeny → konfiguruj</b></li>
        <li>Przekieruj domenę na zakupiony CloudHosting</li>
        <li>W CloudHosting Panel wskaż katalog, do którego zostały wgrane pliki</li>
        <li>Po propagacji domeny otwórz stronę i wykonaj test na komputerze oraz telefonie</li>
      </ol></details>
    </div><div style="${aktywna==="kroki"?"":"display:none"}"><h2 style="margin-top:0">✅ Lista startowa</h2>
    ${KROKI_PUBLIKACJI.map((k,i)=>`<label class="chk-row"><input type="checkbox" ${kroki[i]?"checked":""} onchange="przelaczKrok(${i})"> ${k}</label>`).join("")}
    <p class="pay-note" style="text-align:left;margin-top:.8rem">Pamiętaj: zamówienia, klienci i ustawienia synchronizują się przez wspólną bazę Netlify. Gdy Netlify jest niedostępne, sklep zachowuje lokalną kopię i ponowi synchronizację po odzyskaniu połączenia.</p></div>
  </div>`);
}
