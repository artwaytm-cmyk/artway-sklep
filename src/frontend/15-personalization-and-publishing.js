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
    ${s.configured?"Klient po wybraniu Paynow dostanie automatyczny link płatności, a webhook zaktualizuje status zamówienia.":"Płatność jest bezpiecznie ukryta przed klientem. Zapisz PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY w sejfie środowiskowym VPS, a następnie zrestartuj backend."}
  </div>`;
}
function paynowChecklistaSklepuHTML(){
  const aktywne=(Array.isArray(produkty)?produkty:[]).filter(p=>produktWidocznyWPublicznymKatalogu(p));
  const niekompletne=aktywne.filter(p=>!produktMaCeneSprzedazy(p)||String(p.nazwa||"").trim().length<3||opisKrotkiProduktu(p).trim().length<80);
  const kontrola=[
    [danePrawneFirmyKompletne(),"Pełna nazwa, NIP, REGON i adres siedziby","#/kontakt"],
    [!!KONFIG.emailSklepu&&!!KONFIG.telefon,"E-mail i telefon obsługi kupujących","#/kontakt"],
    [true,"Aktywny koszyk, checkout i podsumowanie kosztów","#/"],
    [true,"Regulamin: umowa, płatności, dostawa, dokument sprzedaży i mElements S.A.","#/regulamin"],
    [true,"Polityka prywatności: administrator, cele, odbiorcy, okresy, prawa i cookies","#/prywatnosc"],
    [!niekompletne.length,`Publiczne produkty z prawdziwą nazwą, opisem i ceną (${aktywne.length-niekompletne.length}/${aktywne.length})`,`#/admin/produkty`],
    [true,"Waluta PLN i kwota brutto przed złożeniem zamówienia","#/dostawa"],
    [true,"Reklamacje: sposób zgłoszenia, zakres i odpowiedź w 14 dni","#/zwroty"],
    [true,"Zwrot w 14 dni oraz gotowy wzór odstąpienia","#/zwroty"],
    [true,"Przycisk „Zamówienie z obowiązkiem zapłaty” i obowiązkowa akceptacja regulaminu","#/"],
  ];
  const gotowe=kontrola.filter(x=>x[0]).length;
  return `<section class="paynow-readiness"><header><div><span class="order-pro-label">Weryfikacja formalna sklepu</span><h3>Gotowość Paynow: ${gotowe}/${kontrola.length}</h3><p>Kontrola publicznych informacji wymienionych przez Paynow. Konfiguracja kluczy API jest oddzielnym etapem technicznym.</p></div><strong>${Math.round(gotowe/kontrola.length*100)}%</strong></header><div>${kontrola.map(([ok,label,href])=>`<a href="${href}" class="${ok?"ready":"missing"}"><span>${ok?"✓":"!"}</span><b>${esc(label)}</b><em>${ok?"gotowe":"wymaga działania"}</em></a>`).join("")}</div>${niekompletne.length?`<p class="backend-note warn"><b>${niekompletne.length} aktywnych produktów wymaga kontroli treści lub ceny.</b> Te produkty pozostają oznaczone w Katalogu produktów; nie są automatycznie usuwane.</p>`:""}</section>`;
}
function paynowPanelAdminHTML(){
  const urls=domyslneUrlePaynow();
  return `<div class="panel">
    <h2 style="margin-top:0">💳 mBank Paynow API</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">To jest prawdziwa integracja API. Sekrety są przechowywane wyłącznie w chronionym środowisku backendu VPS — nigdy w HTML ani pamięci przeglądarki.</p>
    ${paynowChecklistaSklepuHTML()}
    ${paynowStatusAdminHTML()}
    <div class="f-row" style="grid-template-columns:1fr 1fr;margin-top:1rem">
      <div class="f-group"><label>URL powiadomień / webhook Paynow</label><input readonly value="${esc(stanPaynowAdmin.notificationUrl||urls.notificationUrl)}" onclick="this.select()"></div>
      <div class="f-group"><label>URL powrotu klienta po płatności</label><input readonly value="${esc(stanPaynowAdmin.continueUrl||urls.continueUrl)}" onclick="this.select()"></div>
    </div>
    <table class="log-table" style="margin-top:.7rem">
      <tr><th>Zmienna serwera</th><th>Co wpisać</th></tr>
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
    <p class="pay-note" style="text-align:left;margin-top:.8rem">Na czas testów użyj osobnych kluczy środowiska testowego i <code>PAYNOW_ENV=sandbox</code>. Produkcję włącz dopiero po pozytywnej weryfikacji sklepu i otrzymaniu właściwych danych uwierzytelniających.</p>
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
  const gotowy=!!e.configured, polaczony=!!e.authenticated&&maUprawnieniaZapisuChmury();
  const problem=e.credentialIssue==="masked_placeholder"?"W chronionej konfiguracji serwera znajduje się maska zamiast prawidłowego hasła aplikacji Google.":e.lastError||"";
  return `<div class="panel">
    <h2 style="margin-top:0">📧 Trwałe połączenie e-mail SMTP / Gmail</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">Wiadomości wychodzą bezpośrednio z VPS. Dane dostępowe nie są przechowywane w przeglądarce i nie trzeba ich ponownie wpisywać po restarcie ani na innym urządzeniu.</p>
    <div class="backend-note" style="${polaczony?"border-color:#86efac;background:#f0fdf4;color:#166534":"border-color:#f59e0b;background:#fffbeb;color:#92400e"}">
      <b>${polaczony?"Połączenie Gmail potwierdzone ✅":gotowy?"Konfiguracja zapisana — autoryzacja wymaga sprawdzenia":"Połączenie Gmail wymaga naprawy"}</b><br>
      Nadawca: <code>${esc(e.from||"sklepartway@gmail.com")}</code> • Provider: <code>${esc(e.provider||"gmail-smtp")}</code><br>
      ${polaczony?"Automatyczne i ręczne wiadomości są gotowe. Sesja panelu odnawia się automatycznie.":problem?`<span style="color:#991b1b">${esc(problem)}</span>`:"Uruchom kontrolę połączenia z serwerem."}
      ${e.lastCheckedAt?`<br>Ostatnia kontrola: <b>${esc(new Date(e.lastCheckedAt).toLocaleString("pl-PL"))}</b>`:""}
    </div>
    <form onsubmit="wyslijTestEmail(event)" style="margin-top:1rem">
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>Wyślij test na adres</label><input type="email" name="email" value="${esc(KONFIG.emailSklepu)}" required></div>
        <div class="f-group"><button class="btn" type="submit" ${polaczony?"":"disabled"}>📧 Wyślij testową wiadomość</button></div>
      </div>
    </form>
    <div class="diag-actions" style="margin-top:.8rem">
      <button class="btn" type="button" onclick="testujEmailPolaczenie()">🔎 Sprawdź autoryzację Gmail</button>
      <a class="btn ghost" href="#/admin/wysylki/ustawienia">⚙️ Centrum integracji</a>
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
      <div class="f-row">
        <div class="f-group"><label>REGON firmy</label><input name="firmaRegon" inputmode="numeric" maxlength="14" value="${esc(df.regon||"")}"></div>
        <div class="f-group"><label>Ulica i numer siedziby</label><input name="firmaAdres" value="${esc(df.adres||"")}" placeholder="Ulica i numer"></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Kod pocztowy siedziby</label><input name="firmaKodPocztowy" value="${esc(df.kodPocztowy||"")}" placeholder="00-000"></div>
        <div class="f-group"><label>Miejscowość siedziby</label><input name="firmaMiasto" value="${esc(df.miasto||"")}"></div>
      </div>
      <div class="f-group"><label>Logo graficzne (zamiast nazwy tekstowej)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          ${ustawienia.logoObraz?`<img src="${ustawienia.logoObraz}" alt="Podgląd logo sklepu" style="height:36px;max-width:190px;object-fit:contain;border-radius:6px;background:var(--bg);padding:2px 6px">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — wyświetlana jest nazwa tekstowa</span>`}
          ${polePlikuHTML("wgrajLogo(this)", "Wgraj logo")}
          ${ustawienia.logoObraz?`<button class="btn danger" type="button" onclick="usunLogo()">🗑️ Usuń logo</button>`:""}
        </div>
      </div>
      <div class="f-group"><label>Miniaturka w zakładce przeglądarki (favicon)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          <img src="${esc(ustawienia.faviconObraz||domyslnyFavicon())}" alt="Podgląd ikony karty przeglądarki" style="width:34px;height:34px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:var(--bg);padding:2px">
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
          ${h.obraz?`<img src="${h.obraz}" alt="Podgląd tła banera głównego" style="width:150px;height:60px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — kolorowy gradient</span>`}
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
      <div class="f-group"><label>Tytuł strony w Google i karcie przeglądarki</label><input name="seoTytul" value="${esc(ustawienia.seo?.tytul||`Gry, zabawki i artykuły imprezowe | ${KONFIG.nazwaSklepu}`)}"></div>
      <div class="f-group"><label>Opis strony dla wyszukiwarek</label><textarea name="seoOpis" rows="2">${esc(ustawienia.seo?.opis||"Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów. Wygodne zakupy i dostawa InPost.")}</textarea></div>
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
      nazwa:String(f.get("firmaNazwa")||DANE_FIRMY_DOMYSLNE.nazwa).trim()||DANE_FIRMY_DOMYSLNE.nazwa,
      identyfikator:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      nip:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      regon:tylkoCyfry(f.get("firmaRegon")||DANE_FIRMY_DOMYSLNE.regon),
      adres:String(f.get("firmaAdres")||"").trim(),
      kodPocztowy:String(f.get("firmaKodPocztowy")||"").trim(),
      miasto:String(f.get("firmaMiasto")||"").trim()
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
      ...(ustawienia.pasekOkazji||{}),
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

/* banery */
function wgrajObrazBanera(input, id){
  wgrajObrazek(input, 1200, url => {
    zapiszCzescUstawien({bannery: pobierzBannery().map(x=>{if(x.id!==id)return x;const {aiAssetId,aiModel,aiGeneratedAt,aiBrief,...rest}=x;return {...rest,obraz:url};})});
    loguj("info","Wgrano obrazek banera "+id);
  });
}
function usunObrazBanera(id){
  zapiszCzescUstawien({bannery: pobierzBannery().map(x=>{ const {obraz,aiAssetId,aiModel,aiGeneratedAt,aiBrief,...reszta}=x; return x.id===id?reszta:x; })});
}
/* logo sklepu */
function wgrajLogo(input){ wgrajObrazek(input, 420, url => zapiszCzescUstawien({logoObraz:url})); }
function usunLogo(){ zapiszCzescUstawien({logoObraz:null}); }
/* miniaturka karty przeglądarki */
function wgrajFavicon(input){ wgrajObrazek(input, 96, url => zapiszCzescUstawien({faviconObraz:url})); }
function usunFavicon(){ zapiszCzescUstawien({faviconObraz:null}); }
/* tło baneru głównego */
function wgrajTloHero(input){ wgrajObrazek(input, 1600, url => {const {aiAssetId,aiModel,...h}=(ustawienia.hero||{});zapiszCzescUstawien({hero:{...h,obraz:url}});}); }
function usunTloHero(){ const {obraz,aiAssetId,aiModel, ...h}=(ustawienia.hero||{}); zapiszCzescUstawien({hero:h}); }
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
            ${b.obraz?`<img src="${b.obraz}" alt="Podgląd obrazu banera" style="width:130px;height:58px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — baner z ikoną</span>`}
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
