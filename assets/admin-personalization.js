/* GENERATED ADMIN PERSONALIZATION — loaded on demand */
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
  k.push({ok:danePrawneFirmyKompletne(), tekst:"Regulamin i polityka prywatności z danymi firmy", link:"#/admin/strony", akcja:"Uzupełnij"});
  k.push({ok:dostepnePlatnosci().length>0, tekst:"Co najmniej jedna forma płatności włączona ("+dostepnePlatnosci().map(p=>p.id).join(", ")+")", link:"#/admin/dostawy", akcja:"Ustaw płatności"});
  k.push({ok:produkty.length>0, tekst:"Produkty w sklepie ("+produkty.length+")", link:"#/admin/produkty", akcja:"Dodaj produkty"});
  const lokalneUstawienia=wczytajLS("artway_ustawienia",{}), kluczeUstawien=Object.keys(lokalneUstawienia).filter(x=>x!=="krokiPublikacji");
  const ustawieniaWyeksportowane=!kluczeUstawien.length||localStorage.getItem("artway_ustawienia_export_hash")===prostyHash(JSON.stringify(ustawienia));
  k.push({ok:ustawieniaWyeksportowane,tekst:ustawieniaWyeksportowane
    ?"Układ i ustawienia są przygotowane do publikacji"
    :`Masz zmiany panelu (${kluczeUstawien.length} sekcji) — opublikuj index.html bezpośrednio z panelu`,link:"#/admin/aktualizacja",akcja:"Aktualizuj stronę"});
  const publikacjaKatalogu=stanPublikacjiKatalogu(),produktyPrzygotowane=publikacjaKatalogu.gotowy;
  k.push({ok:produktyPrzygotowane, tekst: produktyPrzygotowane
    ? `products.json zabezpiecza wszystkie ${publikacjaKatalogu.razem} kart produktów`
    : `products.json wymaga odświeżenia • brakujące ${publikacjaKatalogu.brakujace.length} • zmienione ${publikacjaKatalogu.nieaktualne.length}`,
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

/* ═══════════ STRONA GŁÓWNA, BANNERY I PROMOCJE — CENTRUM OPERACYJNE ═══════════ */
const SZABLONY_BANEROW={
  pasek:{ikona:"🔥",etykieta:"OKAZJA",tytul:"Wyjątkowa okazja tylko teraz",opis:"Sprawdź aktualną promocję i skorzystaj przed jej zakończeniem.",przycisk:"Zobacz okazję",link:"#/promocje",styl:"wyrozniony",typ:"pasek-okazji",umiejscowienie:"nad-hero",szerokosc:"pelna",wysokosc:"pasek",mobileMode:"kompaktowy",zamykany:true},
  hero:{ikona:"✨",etykieta:"NOWA KOLEKCJA",tytul:"Odkryj nowości w Artway-TM",opis:"Gry, zabawki i artykuły imprezowe wybrane na najbliższy sezon.",przycisk:"Zobacz nowości",link:"#/nowosci",styl:"wyrozniony",typ:"hero",umiejscowienie:"pod-hero",szerokosc:"pelna",wysokosc:"wysoki",mobileMode:"kompaktowy"},
  promocja:{ikona:"🎁",etykieta:"PROMOCJA",tytul:"Produkty w wyjątkowych cenach",opis:"Zobacz starannie wybraną ofertę promocyjną.",przycisk:"Zobacz promocje",link:"#/promocje",styl:"wyrozniony",typ:"sekcyjny",umiejscowienie:"nad-produktami",szerokosc:"pelna",wysokosc:"standard",mobileMode:"kompaktowy"},
  dostawa:{ikona:"🚚",etykieta:"DOSTAWA",tytul:"Darmowa dostawa",opis:`Zamów za minimum ${KONFIG.darmowaDostawaOd} zł i nie płać za dostawę.`,przycisk:"Sprawdź warunki",link:"#/dostawa",styl:"informacyjny",typ:"komunikat",umiejscowienie:"sekcja-banery",szerokosc:"pelna",wysokosc:"niski",mobileMode:"kompaktowy"},
  gry:{ikona:"🎲",etykieta:"GRY",tytul:"Gry dla całej rodziny",opis:"Wybierz grę na wspólny wieczór, prezent albo edukacyjną zabawę.",przycisk:"Przejdź do działu",link:"#/",styl:"karta",typ:"kafelek",umiejscowienie:"sekcja-banery",szerokosc:"polowa",wysokosc:"standard",mobileMode:"pelny"},
  impreza:{ikona:"🎈",etykieta:"IMPREZA",tytul:"Balony i dekoracje",opis:"Przygotuj urodziny, przyjęcie i wyjątkową oprawę wydarzenia.",przycisk:"Zobacz ofertę",link:"#/",styl:"karta",typ:"kafelek",umiejscowienie:"sekcja-banery",szerokosc:"polowa",wysokosc:"standard",mobileMode:"pelny"}
};

function homeZakresLabel(value){return {wszystkie:"Wszystkie aktywne produkty",promocje:"Tylko promocje",nowosci:"Tylko nowości",kategoria:"Wybrany dział",wybrane:"Wybrane produkty"}[value]||"Wszystkie aktywne produkty";}
function widokAdminStronaGlowna(){
  const o=ustawieniaOfertyGlownej(),order=kolejnoscSekcji(),hidden=new Set(ustawienia.sekcjeUkryte||[]),visible=order.filter(id=>!hidden.has(id)).length;
  const cats=wszystkieKategorie(),chosen=Array.isArray(o.kategorie)?o.kategorie:[];
  return personalizacjaSzkielet("home",`<div class="home-editor-head panel"><div><span class="order-pro-label">Centrum prezentacji sklepu</span><h1>🏠 Strona główna i cała oferta</h1><p>Zarządzaj tym, co klient widzi od wejścia do sklepu: ofertą, działami, filtrami i kolejnością sekcji.</p></div><div class="diag-actions"><a class="btn" href="#/">👁️ Otwórz stronę</a><button class="btn ghost" type="button" onclick="resetujStroneGlowna()">↩️ Ustawienia domyślne</button></div></div>
  <div class="home-editor-stats"><article><b>${produkty.length}</b><small>produktów w katalogu</small></article><article><b>${cats.length}</b><small>działów oferty</small></article><article><b>${visible}/${order.length}</b><small>widocznych sekcji</small></article><article><b>${pobierzBannery().filter(x=>x.aktywny!==false).length}</b><small>aktywnych bannerów</small></article></div>
  <form class="panel home-offer-editor" onsubmit="zapiszStroneGlowna(event)"><div class="order-section-head"><div><span class="order-pro-label">Najważniejsza sekcja sprzedażowa</span><h2>Cała oferta na stronie głównej</h2><p class="order-detail-lead">Domyślnie pokazujemy cały aktywny katalog. Wybór działu pozostaje pod produktami zgodnie z ustalonym układem.</p></div><button class="btn" type="submit">💾 Zapisz stronę główną</button></div>
    <div class="home-editor-grid"><label>Tytuł sekcji<input name="tytul" value="${esc(o.tytul)}" required></label><label>Zakres produktów<select name="zakres" onchange="this.form.querySelector('[data-home-category]').hidden=this.value!=='kategoria';this.form.querySelector('[data-home-products]').hidden=this.value!=='wybrane'"><option value="wszystkie">Wszystkie aktywne produkty</option><option value="promocje" ${o.zakres==="promocje"?"selected":""}>Tylko promocje</option><option value="nowosci" ${o.zakres==="nowosci"?"selected":""}>Tylko nowości</option><option value="kategoria" ${o.zakres==="kategoria"?"selected":""}>Wybrany dział</option><option value="wybrane" ${o.zakres==="wybrane"?"selected":""}>Własny wybór produktów</option></select></label></div>
    <label>Opis sekcji<textarea name="opis" rows="2">${esc(o.opis)}</textarea></label>
    <div class="home-editor-grid"><label data-home-category ${o.zakres==="kategoria"?"":"hidden"}>Dział startowy<select name="kategoria"><option value="">Wybierz dział…</option>${cats.map(x=>`<option ${o.kategoria===x?"selected":""}>${esc(x)}</option>`).join("")}</select></label><label data-home-products ${o.zakres==="wybrane"?"":"hidden"}>ID produktów oddzielone przecinkami<input name="produkty" value="${esc(o.produkty.join(", "))}" placeholder="np. 12, 28, 41"></label><label>Domyślne sortowanie<select name="sortowanie"><option value="default">Kolejność katalogu</option><option value="newest" ${o.sortowanie==="newest"?"selected":""}>Najnowsze</option><option value="name" ${o.sortowanie==="name"?"selected":""}>Nazwa A–Z</option><option value="price-asc" ${o.sortowanie==="price-asc"?"selected":""}>Cena rosnąco</option><option value="price-desc" ${o.sortowanie==="price-desc"?"selected":""}>Cena malejąco</option><option value="rating" ${o.sortowanie==="rating"?"selected":""}>Najlepiej oceniane</option></select></label><label>Produktów na stronie<select name="naStronie">${[12,24,48,96].map(n=>`<option value="${n}" ${Number(o.naStronie)===n?"selected":""}>${n}</option>`).join("")}</select></label><label>Wybór działu<select name="wyborDzialu"><option value="pod-produktami" ${o.wyborDzialu==="pod-produktami"?"selected":""}>Pod produktami — zalecane</option><option value="nad-produktami" ${o.wyborDzialu==="nad-produktami"?"selected":""}>Nad produktami</option><option value="ukryty" ${o.wyborDzialu==="ukryty"?"selected":""}>Ukryty</option></select></label></div>
    <div class="home-editor-switches"><label><input type="checkbox" name="filtryZaawansowane" ${o.filtryZaawansowane===false?"":"checked"}> Zaawansowane filtry klienta</label><label><input type="checkbox" name="liczniki" ${o.liczniki===false?"":"checked"}> Liczniki promocji i nowości</label></div>
    <details class="home-category-visibility"><summary><b>🗂️ Działy w kafelkach pod ofertą</b><small>Puste zaznaczenie oznacza wszystkie działy.</small></summary><div>${cats.map(x=>`<label><input type="checkbox" name="kategorie" value="${esc(x)}" ${!chosen.length||chosen.includes(x)?"checked":""}> ${esc(x)} <small>${produkty.filter(p=>p.kategoria===x).length}</small></label>`).join("")}</div></details>
  </form>
  <div class="panel home-layout-editor"><div class="order-section-head"><div><span class="order-pro-label">Kolejność od góry strony</span><h2>Rozmieszczenie wszystkich sekcji</h2></div><a class="btn ghost" href="#/admin/personalizacja/bannery">🖼️ Kreator bannerów</a></div><div class="home-layout-list">${order.map((id,index)=>{const s=SEKCJE_GLOWNEJ[id],on=!hidden.has(id);return `<article class="${on?"":"is-hidden"}"><span>${index+1}</span><i>${s.ikona}</i><div><b>${esc(s.nazwa)}</b><small>${id==="produkty"?homeZakresLabel(o.zakres):on?"Widoczna dla klientów":"Ukryta"}</small></div><button class="btn ghost" ${index===0?"disabled":""} onclick="przesunSekcjeGlownej('${id}',-1)">↑</button><button class="btn ghost" ${index===order.length-1?"disabled":""} onclick="przesunSekcjeGlownej('${id}',1)">↓</button><button class="btn ghost" onclick="przelaczSekcjeGlownej('${id}')">${on?"👁️":"🙈"}</button></article>`;}).join("")}</div></div>`);
}
function zapiszStroneGlowna(event){event.preventDefault();const f=new FormData(event.target),selected=f.getAll("kategorie").map(String),all=wszystkieKategorie();const o={tytul:String(f.get("tytul")||"Cała oferta").trim(),opis:String(f.get("opis")||"").trim(),zakres:String(f.get("zakres")||"wszystkie"),kategoria:String(f.get("kategoria")||""),produkty:String(f.get("produkty")||"").split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean),sortowanie:String(f.get("sortowanie")||"default"),naStronie:[12,24,48,96].includes(Number(f.get("naStronie")))?Number(f.get("naStronie")):24,wyborDzialu:String(f.get("wyborDzialu")||"pod-produktami"),filtryZaawansowane:!!f.get("filtryZaawansowane"),liczniki:!!f.get("liczniki"),kategorie:selected.length===all.length?[]:selected};produktyNaStronie=o.naStronie;zapiszLS("artway_produkty_na_stronie",produktyNaStronie);zapiszCzescUstawien({ofertaGlowna:o});}
function resetujStroneGlowna(){zapiszCzescUstawien({ofertaGlowna:null,kolejnoscSekcji:null,sekcjeUkryte:[]});}

let bannerAiStan={busy:false,result:null,draft:null,assets:[],loaded:false,configured:null,error:""};
function statusBanera(b){const now=Date.now(),start=b.start?Date.parse(b.start):NaN,end=b.koniec?Date.parse(b.koniec):NaN;if(b.aktywny===false)return ["Wyłączony","off"];if(Number.isFinite(start)&&now<start)return ["Zaplanowany","planned"];if(Number.isFinite(end)&&now>end)return ["Zakończony","expired"];return ["Aktywny","active"];}
function bannerOpcjeHTML(source,selected){return Object.entries(source).map(([value,label])=>`<option value="${esc(value)}" ${value===selected?"selected":""}>${esc(label)}</option>`).join("");}
function podgladBaneraAdminHTML(b){const n=normalizujBaner(b);return `<div class="banner-admin-preview banner-${esc(n.styl||"karta")} preview-type-${esc(n.typ)} preview-width-${esc(n.szerokosc)} preview-height-${esc(n.wysokosc)} ${n.obraz?"has-image":""}" ${n.obraz?`style="background-image:linear-gradient(90deg,rgba(15,18,25,.8),rgba(15,18,25,.3)),url('${esc(n.obraz)}')"`:""}><span>${esc(n.ikona||"📣")}</span><div><small>${esc(TYPY_BANNEROW[n.typ])} • ${esc(MIEJSCA_BANNEROW[n.umiejscowienie])}</small>${n.etykieta?`<i>${esc(n.etykieta)}</i>`:""}<b>${esc(n.tytul||"Tytuł bannera")}</b><p>${esc(n.opis||"Opis bannera")}</p>${n.kodRabatowy?`<mark>Kod: ${esc(n.kodRabatowy)}</mark>`:""}<em>${esc(n.przycisk||"Dowiedz się więcej")} →</em></div></div>`;}
function bannerKodyOpcjeHTML(selected=""){const key=String(selected||"").toUpperCase();return `<option value="">Bez kodu rabatowego</option>${regulyRabatowe().map(r=>`<option value="${esc(r.kod)}" ${key===r.kod?"selected":""}>${esc(r.kod)} — ${esc(rabatWartoscLabel(r))}</option>`).join("")}`;}
function bannerFormPolaHTML(b={}){const n=normalizujBaner(b);return `<input type="hidden" name="obrazPodgladu" value="${esc(n.obraz||"")}"><div class="banner-live-preview" data-banner-live-preview>${podgladBaneraAdminHTML(n)}</div><fieldset class="banner-layout-settings"><legend>1. Rodzaj i miejsce na stronie</legend><div class="home-editor-grid"><label>Rodzaj bannera<select name="typ" onchange="ustawTypBanera(this.form,this.value)">${bannerOpcjeHTML(TYPY_BANNEROW,n.typ)}</select><small>Pasek okazji, hero, banner sekcyjny, kafelek lub komunikat.</small></label><label>Położenie na stronie<select name="umiejscowienie" onchange="odswiezPodgladBanera(this.form)">${bannerOpcjeHTML(MIEJSCA_BANNEROW,n.umiejscowienie)}</select></label></div></fieldset><fieldset class="banner-layout-settings"><legend>2. Wymiary i telefon</legend><div class="home-editor-grid"><label>Szerokość<select name="szerokosc" onchange="odswiezPodgladBanera(this.form)">${bannerOpcjeHTML({pelna:"Pełna szerokość (12/12)","dwie-trzecie":"Szeroki (8/12)",polowa:"Połowa (6/12)","jedna-trzecia":"Kafelek (4/12)"},n.szerokosc)}</select></label><label>Wysokość<select name="wysokosc" onchange="odswiezPodgladBanera(this.form)">${bannerOpcjeHTML({pasek:"Pasek — 56 px",niski:"Niski — 96 px",standard:"Standard — 160 px",wysoki:"Duży — 260 px"},n.wysokosc)}</select></label><label>Zachowanie na telefonie<select name="mobileMode" onchange="odswiezPodgladBanera(this.form)">${bannerOpcjeHTML({pelny:"Pełna wersja",kompaktowy:"Kompaktowy — zalecane","bez-obrazu":"Bez zdjęcia",ukryty:"Ukryj na telefonie"},n.mobileMode)}</select></label><label>Wyrównanie<select name="wyrownanie" onchange="odswiezPodgladBanera(this.form)"><option value="lewo">Do lewej</option><option value="srodek" ${n.wyrownanie==="srodek"?"selected":""}>Na środku</option></select></label></div><div class="home-editor-switches"><label><input type="checkbox" name="zamykany" ${n.zamykany?"checked":""} onchange="odswiezPodgladBanera(this.form)"> Klient może zamknąć banner</label><label><input type="checkbox" name="przyklejony" ${n.przyklejony?"checked":""} onchange="odswiezPodgladBanera(this.form)"> Przyklej pasek podczas przewijania</label></div></fieldset><fieldset class="banner-layout-settings"><legend>3. Treść i akcja</legend><div class="home-editor-grid"><label>Tytuł<input name="tytul" required value="${esc(n.tytul||"")}" oninput="odswiezPodgladBanera(this.form)"></label><label>Krótka etykieta<input name="etykieta" value="${esc(n.etykieta||"")}" placeholder="np. PROMOCJA" oninput="odswiezPodgladBanera(this.form)"></label><label>Ikona${emojiPoleHTML("ikona",n.ikona||"📣","📣")}</label><label>Tekst przycisku<input name="przycisk" value="${esc(n.przycisk||"Dowiedz się więcej")}" oninput="odswiezPodgladBanera(this.form)"></label></div><label>Opis<textarea name="opis" rows="2" oninput="odswiezPodgladBanera(this.form)">${esc(n.opis||"")}</textarea></label><div class="home-editor-grid"><label>Link<input name="link" value="${esc(n.link||"#/promocje")}" placeholder="#/promocje, #/kategoria/…"></label><label>Powiązany kod rabatowy<select name="kodRabatowy" onchange="odswiezPodgladBanera(this.form)">${bannerKodyOpcjeHTML(n.kodRabatowy)}</select><small>Kod i grafika tworzą jedną kampanię.</small></label><label>Styl<select name="styl" onchange="odswiezPodgladBanera(this.form)"><option value="karta">Karta</option><option value="wyrozniony" ${n.styl==="wyrozniony"?"selected":""}>Wyróżniony</option><option value="informacyjny" ${n.styl==="informacyjny"?"selected":""}>Informacyjny</option><option value="minimalny" ${n.styl==="minimalny"?"selected":""}>Minimalny</option></select></label><label>Widoczność urządzeń<select name="odbiorcy"><option value="wszyscy">Komputer i telefon</option><option value="desktop" ${n.odbiorcy==="desktop"?"selected":""}>Tylko komputer</option><option value="mobile" ${n.odbiorcy==="mobile"?"selected":""}>Tylko telefon</option></select></label><label>Start publikacji<input type="datetime-local" name="start" value="${esc(n.start||"")}"></label><label>Koniec publikacji<input type="datetime-local" name="koniec" value="${esc(n.koniec||"")}"></label></div></fieldset>`;}
function odswiezPodgladBanera(form){const target=form?.querySelector("[data-banner-live-preview]");if(!target)return;const next=daneBaneraZaawansowane(form,"preview");next.obraz=String(form.elements.obrazPodgladu?.value||"");target.innerHTML=podgladBaneraAdminHTML(next);}
function ustawTypBanera(form,typ){const presets={"pasek-okazji":["nad-hero","pelna","pasek"],hero:["pod-hero","pelna","wysoki"],sekcyjny:["nad-produktami","pelna","standard"],kafelek:["sekcja-banery","polowa","standard"],komunikat:["sekcja-banery","pelna","niski"]},p=presets[typ]||presets.kafelek;form.elements.umiejscowienie.value=p[0];form.elements.szerokosc.value=p[1];form.elements.wysokosc.value=p[2];if(form.elements.przyklejony&&typ!=="pasek-okazji")form.elements.przyklejony.checked=false;odswiezPodgladBanera(form);}
function bannerAiKodStartowy(){try{return sessionStorage.getItem("artway_ai_banner_discount")||"";}catch(e){return "";}}
function bannerAiFormHTML(){const code=bannerAiKodStartowy();return `<section class="panel ai-banner-studio"><div class="ai-banner-studio-head"><div><span class="order-pro-label">Prawdziwe generowanie • OpenAI Images</span><h2>✨ Studio grafiki AI</h2><p>Napisz krótko, co ma przedstawiać banner. AI przygotuje obraz, a tytuł i przycisk strona nałoży ostro i poprawnie również na telefonie.</p></div><span class="ai-real-badge">● Połączenie serwerowe</span></div><form onsubmit="uruchomGeneratorBaneraAI(event)"><label class="ai-banner-brief">Co ma być na grafice?<textarea name="brief" required minlength="8" maxlength="900" rows="3" placeholder="Np. kolorowe balony i dekoracje na eleganckie przyjęcie urodzinowe, dużo radości, miejsce na tekst po lewej"></textarea><small>To jedyne wymagane pole. Nie wpisuj tajnych danych ani treści chronionych marek.</small></label><div class="ai-banner-basic-grid"><label>Motyw / produkty<input name="subject" maxlength="220" placeholder="np. balony, gry rodzinne, nowości"></label><label>Cel<select name="goal"><option>promocja sklepu internetowego</option><option>nowa kolekcja</option><option>wyprzedaż</option><option>prezent i sezon</option><option>artykuły imprezowe</option></select></label><label>Styl grafiki<select name="style"><option value="produktowy">Profesjonalny produktowy</option><option value="radosny">Radosny rodzinny</option><option value="imprezowy">Imprezowy</option><option value="elegancki">Elegancki premium</option><option value="minimalny">Minimalistyczny</option></select></label><label>Jakość<select name="quality"><option value="medium">Profesjonalna — zalecana</option><option value="low">Szybki szkic</option><option value="high">Najwyższa jakość</option></select></label><label>Tytuł na bannerze<input name="title" maxlength="100" placeholder="np. Czas na wspólną zabawę"></label><label>Kod rabatowy<select name="discountCode">${bannerKodyOpcjeHTML(code)}</select></label><label>Tekst pod tytułem<input name="description" maxlength="180" placeholder="np. Odkryj gry dla całej rodziny"></label><label>Przycisk<input name="buttonText" maxlength="50" value="Zobacz ofertę"></label><label>Dokąd prowadzi banner<input name="link" value="#/promocje" placeholder="#/promocje"></label><label>Rodzaj bannera<select name="typ">${bannerOpcjeHTML(TYPY_BANNEROW,"sekcyjny")}</select></label><label>Położenie<select name="umiejscowienie">${bannerOpcjeHTML(MIEJSCA_BANNEROW,"nad-produktami")}</select></label><label>Szerokość<select name="szerokosc">${bannerOpcjeHTML({pelna:"Pełna szerokość","dwie-trzecie":"Szeroki — 2/3",polowa:"Połowa","jedna-trzecia":"Kafelek — 1/3"},"pelna")}</select></label><label>Wysokość<select name="wysokosc">${bannerOpcjeHTML({pasek:"Pasek — 56 px",niski:"Niski — 96 px",standard:"Standard — 160 px",wysoki:"Duży — 260 px"},"standard")}</select></label></div><div class="ai-banner-actions"><button class="btn ai-generate-button" type="submit">✨ Wygeneruj prawdziwą grafikę AI</button><small>Grafika jest generowana dopiero po kliknięciu. Zwykle trwa to od kilkunastu sekund do około 2 minut.</small></div><div class="ai-generation-status" data-ai-banner-status aria-live="polite">${bannerAiStatusHTML()}</div></form><div class="ai-banner-library" data-ai-banner-library>${bannerAiBibliotekaHTML()}</div></section>`;}
function bannerAiStatusHTML(){if(bannerAiStan.busy)return `<div class="ai-progress"><span><i style="width:45%"></i></span><b>AI tworzy i zapisuje grafikę…</b><small>Nie zamykaj tej karty. Sukces pokażemy dopiero po zapisaniu prawdziwego obrazu.</small></div>`;if(bannerAiStan.error)return `<div class="ai-generation-error"><b>Nie utworzono grafiki</b><p>${esc(bannerAiStan.error)}</p><small>Żaden fikcyjny banner nie został zapisany.</small></div>`;if(bannerAiStan.result)return `<div class="ai-generation-result"><img src="${esc(bannerAiStan.result.url)}" alt="Wygenerowana grafika AI"><div><b>Grafika została naprawdę wygenerowana i zapisana</b><small>${esc(bannerAiStan.result.model||"")} • ${Math.round((bannerAiStan.result.bytes||0)/1024)} KB</small><button class="btn" type="button" onclick="utworzBanerZGrafikiAI()">＋ Utwórz banner z tą grafiką</button></div></div>`;return `<div class="ai-generation-ready"><b>${bannerAiStan.configured===false?"⚠️ Integracja wymaga konfiguracji":"Gotowe do generowania"}</b><small>Najpierw powstanie podgląd. Dopiero Ty zatwierdzisz dodanie bannera do sklepu.</small></div>`;}
function bannerAiBibliotekaHTML(){if(!bannerAiStan.loaded)return `<div class="ai-library-loading">Ładowanie biblioteki wygenerowanych grafik…</div>`;if(!bannerAiStan.assets.length)return `<div class="ai-library-empty">Nie ma jeszcze grafik AI. Pierwsza pojawi się tutaj po prawdziwym wygenerowaniu.</div>`;return `<div class="order-section-head"><div><h3>Biblioteka grafik AI</h3><p class="order-detail-lead">${bannerAiStan.assets.length} ostatnich kreacji</p></div></div><div class="ai-library-grid">${bannerAiStan.assets.map(a=>`<article><img src="${esc(a.url)}" alt="${esc(a.title||a.brief||"Grafika AI")}"><div><b>${esc(a.title||a.brief||"Grafika AI")}</b><small>${new Date(a.createdAt).toLocaleString("pl-PL")} • ${esc(a.model||"")}</small>${a.discountCode?`<mark>Kod ${esc(a.discountCode)}</mark>`:""}<div><button class="btn ghost" type="button" onclick="uzyjGrafikiZBibliotekiAI(${jsArg(a.id)})">Użyj</button><button class="btn danger" type="button" onclick="usunGrafikeZBibliotekiAI(${jsArg(a.id)})">Usuń</button></div></div></article>`).join("")}</div>`;}
function bannerAiOdswiezElementy(){const status=document.querySelector("[data-ai-banner-status]"),library=document.querySelector("[data-ai-banner-library]");if(status)status.innerHTML=bannerAiStatusHTML();if(library)library.innerHTML=bannerAiBibliotekaHTML();}
async function wczytajBibliotekeBannerowAI(){try{const data=await chmura("ai-banner-assets",{timeout:20000});bannerAiStan.assets=Array.isArray(data.items)?data.items:[];bannerAiStan.loaded=true;bannerAiStan.configured=!!data.configured;}catch(e){bannerAiStan.loaded=true;bannerAiStan.error=e.message||"Nie udało się odczytać biblioteki.";}bannerAiOdswiezElementy();}
function bannerAiDaneFormularza(form){const f=new FormData(form);return {brief:String(f.get("brief")||"").trim(),subject:String(f.get("subject")||"").trim(),goal:String(f.get("goal")||"").trim(),style:String(f.get("style")||"produktowy"),quality:String(f.get("quality")||"medium"),title:String(f.get("title")||"").trim(),description:String(f.get("description")||"").trim(),buttonText:String(f.get("buttonText")||"Zobacz ofertę").trim(),discountCode:String(f.get("discountCode")||"").trim().toUpperCase(),link:bezpiecznyLink(String(f.get("link")||"#/promocje").trim()),typ:String(f.get("typ")||"sekcyjny"),umiejscowienie:String(f.get("umiejscowienie")||"nad-produktami"),szerokosc:String(f.get("szerokosc")||"pelna"),wysokosc:String(f.get("wysokosc")||"standard"),mobileMode:"kompaktowy"};}
async function uruchomGeneratorBaneraAI(event){event.preventDefault();if(bannerAiStan.busy)return;const form=event.target;let draft=bannerAiDaneFormularza(form);const button=form.querySelector("button[type=submit]");bannerAiStan={...bannerAiStan,busy:true,error:"",result:null,draft};if(button)button.disabled=true;bannerAiOdswiezElementy();try{try{const textRun=await agentAISpecjalistaWykonaj("banner_copy",{brief:draft.brief,subject:draft.subject,goal:draft.goal,discountCode:draft.discountCode||"brak kodu",currentTitle:draft.title,currentDescription:draft.description,currentCta:draft.buttonText},"Dopracuj profesjonalny tekst bannera i precyzyjny brief obrazu. Nie zmieniaj potwierdzonego kodu ani warunków promocji.",{},{}),fields=agentAISpecjalistaPola(textRun?.result||{});draft={...draft,brief:fields.image_brief||draft.brief,title:fields.headline||draft.title,description:fields.subheadline||draft.description,buttonText:fields.cta||draft.buttonText};for(const [name,value] of [["brief",draft.brief],["title",draft.title],["description",draft.description],["buttonText",draft.buttonText]])if(form.elements[name]&&value)form.elements[name].value=value;bannerAiStan.draft=draft;}catch(textError){console.warn("GPT-5 nano banner brief fallback",textError);}const data=await chmura("ai-banner-generate",{method:"POST",body:{brief:draft.brief,subject:draft.subject,goal:draft.goal,style:draft.style,quality:draft.quality,discountCode:draft.discountCode,title:draft.title},timeout:125000});if(!data.generated||!data.asset?.url)throw new Error("Serwer nie potwierdził utworzenia grafiki.");bannerAiStan.result=data.asset;bannerAiStan.assets=[data.asset,...bannerAiStan.assets.filter(x=>x.id!==data.asset.id)].slice(0,40);bannerAiStan.loaded=true;toast("GPT-5 nano dopracował kampanię, a grafika AI została zapisana ✅");}catch(e){bannerAiStan.error=e.message||"Nie udało się wygenerować grafiki.";}finally{bannerAiStan.busy=false;if(button)button.disabled=false;bannerAiOdswiezElementy();}}
function utworzBanerZGrafikiAI(){const a=bannerAiStan.result,d=bannerAiStan.draft,list=pobierzBannery();if(!a?.url||!d){toast("Najpierw wygeneruj grafikę");return;}if(list.length>=24){toast("Osiągnięto limit 24 bannerów");return;}const banner=normalizujBaner({id:"b_"+Date.now(),ikona:"✨",etykieta:d.discountCode?"PROMOCJA":"POLECAMY",tytul:d.title||"Odkryj coś wyjątkowego",opis:d.description||d.brief,przycisk:d.buttonText||"Zobacz ofertę",link:d.link||"#/promocje",kodRabatowy:d.discountCode||"",styl:"wyrozniony",typ:d.typ,umiejscowienie:d.umiejscowienie,szerokosc:d.szerokosc,wysokosc:d.wysokosc,mobileMode:d.mobileMode,wyrownanie:"lewo",odbiorcy:"wszyscy",start:"",koniec:"",aktywny:true,obraz:a.url,aiAssetId:a.id,aiModel:a.model,aiGeneratedAt:a.createdAt,aiBrief:d.brief});try{sessionStorage.removeItem("artway_ai_banner_discount");}catch(e){}zapiszCzescUstawien({bannery:[...list,banner]});toast("Banner AI dodany we wskazanym miejscu strony ✅");}
function uzyjGrafikiZBibliotekiAI(id){const a=bannerAiStan.assets.find(x=>x.id===id);if(!a)return;const form=document.querySelector(".ai-banner-studio form");bannerAiStan.result=a;bannerAiStan.draft=form?bannerAiDaneFormularza(form):{brief:a.brief||"Grafika AI",title:a.title||"Odkryj ofertę",description:"",buttonText:"Zobacz ofertę",discountCode:a.discountCode||"",link:"#/promocje"};bannerAiOdswiezElementy();document.querySelector("[data-ai-banner-status]")?.scrollIntoView({behavior:"smooth",block:"center"});}
async function usunGrafikeZBibliotekiAI(id){if(pobierzBannery().some(b=>b.aiAssetId===id)){toast("Ta grafika jest używana przez banner. Najpierw usuń lub zmień banner.");return;}try{await chmura("ai-banner-delete",{method:"POST",body:{id}});bannerAiStan.assets=bannerAiStan.assets.filter(x=>x.id!==id);if(bannerAiStan.result?.id===id)bannerAiStan.result=null;bannerAiOdswiezElementy();toast("Grafika usunięta");}catch(e){toast(e.message||"Nie udało się usunąć grafiki");}}
function przejdzDoGeneratoraDlaKodu(code){try{sessionStorage.setItem("artway_ai_banner_discount",String(code||"").toUpperCase());}catch(e){}location.hash="#/admin/personalizacja/bannery";}
function widokAdminBanneryZaawansowane(){const list=pobierzBannery();setTimeout(()=>wczytajBibliotekeBannerowAI(),0);return personalizacjaSzkielet("bannery",`<div class="panel banner-workspace-head"><div><span class="order-pro-label">Pełna kontrola wszystkich miejsc strony</span><h1>🖼️ Kreator bannerów i grafik AI</h1><p>Twórz paski okazji, bannery hero, sekcyjne, kafelki i komunikaty. Osobno ustawisz położenie, szerokość, wysokość, telefon, harmonogram oraz kod rabatowy.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/asortyment/rabaty">🎁 Kody rabatowe</a><a class="btn" href="#/">👁️ Podgląd sklepu</a></div></div>${bannerAiFormHTML()}<details class="panel banner-template-section" open><summary><b>📐 Gotowe profesjonalne typy</b><small>Każdy szablon ma właściwe miejsce, wymiary i wersję mobilną.</small></summary><section class="banner-template-grid">${Object.entries(SZABLONY_BANEROW).map(([id,b])=>`<article>${podgladBaneraAdminHTML(b)}<button class="btn" onclick="utworzBanerZSzablonu('${id}')">＋ Użyj szablonu</button></article>`).join("")}</section></details><details class="panel banner-new-custom"><summary><b>＋ Utwórz ręcznie</b><small>Pełna kontrola typu, treści, miejsca, wymiarów i urządzeń.</small></summary><form onsubmit="dodajBanerZaawansowany(event)" oninput="odswiezPodgladBanera(this)">${bannerFormPolaHTML({})}<button class="btn" type="submit">Utwórz banner</button></form></details><div class="panel"><div class="order-section-head"><div><h2>Zapisane bannery</h2><p class="order-detail-lead">${list.length} zapisanych • maksymalnie 24</p></div><button class="btn ghost" onclick="resetujBannery()">↩️ Przywróć podstawowe</button></div><div class="banner-admin-list">${list.map((b,i)=>{const st=statusBanera(b);return `<details class="banner-editor-card" ${i===0?"open":""}><summary>${podgladBaneraAdminHTML(b)}<span class="banner-status ${st[1]}">${st[0]}</span><i></i></summary><form onsubmit="zapiszBanerZaawansowany(event,${jsArg(b.id)})" oninput="odswiezPodgladBanera(this)">${bannerFormPolaHTML(b)}<div class="banner-image-control">${b.obraz?`<img src="${esc(b.obraz)}" alt=""><span>${b.aiAssetId?`Grafika AI • ${esc(b.aiModel||"")}`:"Własny obraz"}</span>`:"<span>Bez zdjęcia — używana jest ikona i układ sklepu</span>"}${polePlikuHTML(`wgrajObrazBanera(this,${jsArg(b.id)})`,"Wgraj zdjęcie")}${b.obraz?`<button class="btn danger" type="button" onclick="usunObrazBanera(${jsArg(b.id)})">Usuń zdjęcie</button>`:""}</div><div class="admin-results-operations"><label><input type="checkbox" name="aktywny" ${b.aktywny===false?"":"checked"}> Banner aktywny</label><div class="diag-actions"><button class="btn ghost" type="button" onclick="przesunBaner(${jsArg(b.id)},-1)" ${i===0?"disabled":""}>↑</button><button class="btn ghost" type="button" onclick="przesunBaner(${jsArg(b.id)},1)" ${i===list.length-1?"disabled":""}>↓</button><button class="btn ghost" type="button" onclick="duplikujBaner(${jsArg(b.id)})">⧉ Duplikuj</button><button class="btn danger" type="button" onclick="usunBaner(${jsArg(b.id)})">🗑️ Usuń</button><button class="btn" type="submit">💾 Zapisz</button></div></div></form></details>`;}).join("")||`<div class="empty">Brak bannerów. Wygeneruj pierwszą grafikę AI.</div>`}</div></div>`);}
function daneBaneraZaawansowane(form,id){const f=new FormData(form),raw={id,ikona:String(f.get("ikona")||"📣").trim()||"📣",etykieta:String(f.get("etykieta")||"").trim().slice(0,40),tytul:String(f.get("tytul")||"").trim(),opis:String(f.get("opis")||"").trim(),przycisk:String(f.get("przycisk")||"Dowiedz się więcej").trim(),link:bezpiecznyLink(String(f.get("link")||"#/").trim()),kodRabatowy:String(f.get("kodRabatowy")||"").trim().toUpperCase(),styl:String(f.get("styl")||"karta"),typ:String(f.get("typ")||"kafelek"),umiejscowienie:String(f.get("umiejscowienie")||"sekcja-banery"),szerokosc:String(f.get("szerokosc")||"polowa"),wysokosc:String(f.get("wysokosc")||"standard"),mobileMode:String(f.get("mobileMode")||"kompaktowy"),zamykany:!!f.get("zamykany"),przyklejony:!!f.get("przyklejony"),wyrownanie:String(f.get("wyrownanie")||"lewo"),odbiorcy:String(f.get("odbiorcy")||"wszyscy"),start:String(f.get("start")||""),koniec:String(f.get("koniec")||""),aktywny:!!f.get("aktywny")};raw.rozmiar=raw.szerokosc==="pelna"?"szeroki":raw.wysokosc==="niski"||raw.wysokosc==="pasek"?"kompaktowy":"standard";return normalizujBaner(raw);}
function utworzBanerZSzablonu(id){const preset=SZABLONY_BANEROW[id],list=pobierzBannery();if(!preset||list.length>=24){toast("Osiągnięto limit 24 bannerów");return;}zapiszCzescUstawien({bannery:[...list,{id:"b_"+Date.now(),aktywny:true,wyrownanie:"lewo",odbiorcy:"wszyscy",...preset}]});}
function dodajBanerZaawansowany(event){event.preventDefault();const list=pobierzBannery();if(list.length>=24){toast("Osiągnięto limit 24 bannerów");return;}const banner=daneBaneraZaawansowane(event.target,"b_"+Date.now());banner.aktywny=true;zapiszCzescUstawien({bannery:[...list,banner]});}
function zapiszBanerZaawansowany(event,id){event.preventDefault();const old=pobierzBannery().find(x=>String(x.id)===String(id)),next=daneBaneraZaawansowane(event.target,id);for(const key of ["obraz","aiAssetId","aiModel","aiGeneratedAt","aiBrief"])if(old?.[key])next[key]=old[key];zapiszCzescUstawien({bannery:pobierzBannery().map(x=>String(x.id)===String(id)?next:x)});}
function duplikujBaner(id){const list=pobierzBannery(),source=list.find(x=>String(x.id)===String(id));if(!source||list.length>=24)return;zapiszCzescUstawien({bannery:[...list,{...source,id:"b_"+Date.now(),tytul:`${source.tytul} — kopia`,aktywny:false}]});}

function uzyciaKoduRabatowego(kod){const key=String(kod).toUpperCase(),orders=pobierzZamowienia().filter(x=>String(x.rabatKod||"").toUpperCase()===key).length,stored=(Array.isArray(ustawienia.kodyRabatoweZaawansowane)?ustawienia.kodyRabatoweZaawansowane:[]).find(x=>String(x?.kod||"").toUpperCase()===key);return Math.max(orders,Math.max(0,Number(stored?.uzycia)||0));}
function rabatStatusHTML(rule){const status=regulaRabatowaStatus({...rule,uzycia:uzyciaKoduRabatowego(rule.kod)});return `<span class="discount-status ${status.aktywna?"active":"inactive"}">${status.aktywna?"Aktywny":esc(status.powod)}</span>`;}
function rabatWartoscLabel(r){return r.typ==="darmowa_dostawa"?"Darmowa dostawa":r.typ==="kwota"?`${zl(r.wartosc)} rabatu`:`${Number(r.wartosc)||0}% rabatu`;}
function rabatFormPolaHTML(r={}){const categories=wszystkieKategorie(),chosen=Array.isArray(r.kategorie)?r.kategorie:[];return `<div class="home-editor-grid"><label>Kod<input name="kod" required maxlength="30" value="${esc(r.kod||"")}" placeholder="np. WIOSNA15" style="text-transform:uppercase"></label><label>Rodzaj<select name="typ" onchange="this.form.querySelector('[data-discount-value]').hidden=this.value==='darmowa_dostawa'"><option value="procent">Procentowy</option><option value="kwota" ${r.typ==="kwota"?"selected":""}>Kwotowy</option><option value="darmowa_dostawa" ${r.typ==="darmowa_dostawa"?"selected":""}>Darmowa dostawa</option></select></label><label data-discount-value ${r.typ==="darmowa_dostawa"?"hidden":""}>Wartość<input name="wartosc" type="number" min="0" max="10000" step=".01" value="${esc(r.wartosc||"")}"></label><label>Minimalny koszyk<input name="minKoszyk" type="number" min="0" step=".01" value="${esc(r.minKoszyk||0)}"></label><label>Maksymalny rabat<input name="maxRabat" type="number" min="0" step=".01" value="${esc(r.maxRabat||0)}"><small>0 = bez limitu</small></label><label>Łączny limit użyć<input name="limitUzyc" type="number" min="0" step="1" value="${esc(r.limitUzyc||0)}"><small>0 = bez limitu</small></label><label>Aktywny od<input type="datetime-local" name="start" value="${esc(r.start||"")}"></label><label>Aktywny do<input type="datetime-local" name="koniec" value="${esc(r.koniec||"")}"></label><label>Zakres<select name="zakres" onchange="this.form.querySelector('[data-discount-categories]').hidden=this.value!=='kategorie';this.form.querySelector('[data-discount-products]').hidden=this.value!=='produkty'"><option value="wszystkie">Cały koszyk</option><option value="kategorie" ${r.zakres==="kategorie"?"selected":""}>Wybrane działy</option><option value="produkty" ${r.zakres==="produkty"?"selected":""}>Wybrane produkty</option></select></label><label data-discount-categories ${r.zakres==="kategorie"?"":"hidden"}>Działy<select name="kategorie" multiple size="4">${categories.map(x=>`<option value="${esc(x)}" ${chosen.includes(x)?"selected":""}>${esc(x)}</option>`).join("")}</select></label><label data-discount-products ${r.zakres==="produkty"?"":"hidden"}>ID produktów<input name="produkty" value="${esc((r.produkty||[]).join(", "))}" placeholder="12, 28, 41"></label></div><label>Opis wewnętrzny<input name="opis" value="${esc(r.opis||"")}" placeholder="np. Kampania wiosenna"></label><div class="home-editor-switches"><label><input type="checkbox" name="aktywny" ${r.aktywny===false?"":"checked"}> Kod aktywny</label><label><input type="checkbox" name="publiczny" ${r.publiczny?"checked":""}> Pokazuj klientom jako główną promocję</label></div>`;}
function rabatGrafikiHTML(code){const banners=pobierzBannery().filter(b=>String(b.kodRabatowy||"").toUpperCase()===String(code||"").toUpperCase());return `<div class="discount-banner-link"><div>${banners.length?banners.map(b=>`<span>${b.obraz?`<img src="${esc(b.obraz)}" alt="">`:"🎁"}<b>${esc(b.tytul||"Banner")}</b></span>`).join(""):`<span class="discount-no-banner">Brak powiązanej grafiki</span>`}</div><button class="btn ghost" type="button" onclick="przejdzDoGeneratoraDlaKodu(${jsArg(code)})">✨ ${banners.length?"Dodaj kolejną grafikę AI":"Utwórz grafikę AI"}</button></div>`;}
function widokAdminRabatyZaawansowane(){
  const rules=regulyRabatowe(),active=rules.filter(x=>regulaRabatowaStatus({...x,uzycia:uzyciaKoduRabatowego(x.kod)}).aktywna).length,scheduled=rules.filter(x=>x.start&&Date.parse(x.start)>Date.now()).length;
  return asortymentSzkielet("rabaty",`<div class="panel discount-workspace-head"><div><span class="order-pro-label">Reguły naliczane również na serwerze</span><h1>🎁 Kody rabatowe, promocje i grafiki</h1><p>Kod ma własne warunki, termin i zakres. Jednym przyciskiem przygotujesz do niego prawdziwą grafikę AI i banner kampanii.</p></div><div class="diag-actions"><button class="btn ghost" onclick="eksportujKodyRabatowe()">📤 Eksport CSV</button><a class="btn" href="#/admin/personalizacja/bannery">✨ Studio grafik AI</a></div></div><div class="home-editor-stats"><article><b>${rules.length}</b><small>wszystkich kodów</small></article><article><b>${active}</b><small>aktywnych teraz</small></article><article><b>${scheduled}</b><small>zaplanowanych</small></article><article><b>${rules.reduce((s,x)=>s+uzyciaKoduRabatowego(x.kod),0)}</b><small>użyć w zamówieniach</small></article></div><details class="panel discount-new" open><summary><b>＋ Utwórz nowy kod</b><small>Warunki zostaną sprawdzone w koszyku i ponownie przez backend.</small></summary><form onsubmit="dodajReguleRabatowa(event)">${rabatFormPolaHTML({typ:"procent",zakres:"wszystkie",aktywny:true})}<button class="btn" type="submit">Utwórz kod rabatowy</button></form></details><div class="discount-rule-list">${rules.map(rule=>`<details class="panel discount-rule-card"><summary><code>${esc(rule.kod)}</code><div><b>${esc(rabatWartoscLabel(rule))}</b><small>${rule.minKoszyk?`od ${zl(rule.minKoszyk)}`:"bez minimum"} • użyto ${uzyciaKoduRabatowego(rule.kod)}${rule.limitUzyc?`/${rule.limitUzyc}`:" razy"}</small></div>${rabatStatusHTML(rule)}<i></i></summary><form onsubmit="zapiszReguleRabatowa(event,${jsArg(rule.kod)})">${rabatGrafikiHTML(rule.kod)}${rabatFormPolaHTML(rule)}<div class="admin-results-operations"><button class="btn danger" type="button" onclick="usunReguleRabatowa(${jsArg(rule.kod)})">🗑️ Usuń</button><button class="btn" type="submit">💾 Zapisz regułę</button></div></form></details>`).join("")||`<div class="panel empty">Nie ma jeszcze kodów rabatowych.</div>`}</div>`);
}
function regulaRabatowaZForm(form,oldCode=""){const f=new FormData(form),kod=String(f.get("kod")||"").trim().toUpperCase();if(!/^[A-Z0-9_-]{2,30}$/.test(kod)){toast("Kod musi mieć 2–30 znaków: litery, cyfry, _ lub -");return null;}const typ=String(f.get("typ")||"procent"),wartosc=Math.max(0,Number(f.get("wartosc"))||0);if(typ==="procent"&&wartosc>100){toast("Rabat procentowy nie może przekraczać 100%");return null;}return {kod,typ,wartosc:+wartosc.toFixed(2),minKoszyk:Math.max(0,Number(f.get("minKoszyk"))||0),maxRabat:Math.max(0,Number(f.get("maxRabat"))||0),limitUzyc:Math.max(0,Math.floor(Number(f.get("limitUzyc"))||0)),uzycia:uzyciaKoduRabatowego(oldCode||kod),start:String(f.get("start")||""),koniec:String(f.get("koniec")||""),zakres:String(f.get("zakres")||"wszystkie"),kategorie:f.getAll("kategorie").map(String),produkty:String(f.get("produkty")||"").split(/[,;\s]+/).filter(Boolean),opis:String(f.get("opis")||"").trim(),aktywny:!!f.get("aktywny"),publiczny:!!f.get("publiczny")};}
function zapiszListeRegul(rules){const legacy={};for(const r of rules)if(r.aktywny!==false&&r.typ==="procent"&&r.zakres==="wszystkie"&&!r.start&&!r.koniec&&!r.minKoszyk&&!r.maxRabat&&!r.limitUzyc)legacy[r.kod]=r.wartosc;const publicRule=rules.find(x=>x.publiczny&&x.aktywny!==false);zapiszCzescUstawien({kodyRabatoweZaawansowane:rules,kody:legacy,promocjaGlowna:publicRule?.kod||""});}
function dodajReguleRabatowa(event){event.preventDefault();const rule=regulaRabatowaZForm(event.target);if(!rule)return;const rules=regulyRabatowe().filter(x=>x.kod!==rule.kod);zapiszListeRegul([...rules,rule]);}
function zapiszReguleRabatowa(event,oldCode){event.preventDefault();const rule=regulaRabatowaZForm(event.target,oldCode);if(!rule)return;const rules=regulyRabatowe().filter(x=>x.kod!==String(oldCode).toUpperCase()&&x.kod!==rule.kod);zapiszListeRegul([...rules,rule]);}
function usunReguleRabatowa(code){const key=String(code).toUpperCase();if(rabat?.kod===key)usunRabat();zapiszListeRegul(regulyRabatowe().filter(x=>x.kod!==key));}
function eksportujKodyRabatowe(){adminEksportujCSV("kody-rabatowe.csv",["kod","rodzaj","wartosc","minimum","maks_rabat","zakres","start","koniec","limit","uzycia","aktywny"],regulyRabatowe().map(x=>[x.kod,x.typ,x.wartosc,x.minKoszyk,x.maxRabat,x.zakres,x.start,x.koniec,x.limitUzyc,uzyciaKoduRabatowego(x.kod),x.aktywny!==false?"TAK":"NIE"]));}

/* ═══════════ PEŁNE STUDIO BANNERÓW, WŁASNYCH WZORÓW I IKON AI ═══════════ */
const LIMIT_WLASNYCH_WZOROW_BANNEROW=30;
let iconAiStan={busy:false,result:null,assets:[],loaded:false,configured:null,error:"",target:""};

function podgladBaneraAdminHTML(b){const n=normalizujBaner(b),shade=Math.max(0,Math.min(90,Number(n.przyciemnienie)||68))/100;return `<div class="banner-admin-preview banner-${esc(n.styl||"karta")} preview-type-${esc(n.typ)} preview-width-${esc(n.szerokosc)} preview-height-${esc(n.wysokosc)} ${n.obraz?"has-image":""}" ${n.obraz?`style="background-image:linear-gradient(90deg,rgba(15,18,25,${shade}),rgba(15,18,25,${Math.max(.12,shade-.4)})),url('${esc(n.obraz)}');background-position:${esc(n.pozycjaObrazu||"center")}"`:""}><span>${esc(n.ikona||"📣")}</span><div><small>${esc(TYPY_BANNEROW[n.typ])} • ${esc(MIEJSCA_BANNEROW[n.umiejscowienie])}</small>${n.etykieta?`<i>${esc(n.etykieta)}</i>`:""}<b>${esc(n.tytul||"Tytuł bannera")}</b><p>${esc(n.opis||"Opis bannera")}</p>${n.kodRabatowy?`<mark>Kod: ${esc(n.kodRabatowy)}</mark>`:""}<em>${esc(n.przycisk||"Dowiedz się więcej")} →</em></div></div>`;}

function wlasneWzoryBanerow(){
  return (Array.isArray(ustawienia.wzoryBanerow)?ustawienia.wzoryBanerow:[]).filter(x=>x&&x.id&&x.tytul).slice(0,LIMIT_WLASNYCH_WZOROW_BANNEROW).map(normalizujBaner);
}
function bannerDodatkowePolaHTML(b={}){const n=normalizujBaner(b);return `<fieldset class="banner-layout-settings"><legend>4. Obraz, dostępność i zachowanie</legend><div class="home-editor-grid"><label>Pozycja obrazu<select name="pozycjaObrazu"><option value="center" ${n.pozycjaObrazu==="center"||!n.pozycjaObrazu?"selected":""}>Środek — zalecane</option><option value="left" ${n.pozycjaObrazu==="left"?"selected":""}>Lewa strona</option><option value="right" ${n.pozycjaObrazu==="right"?"selected":""}>Prawa strona</option><option value="top" ${n.pozycjaObrazu==="top"?"selected":""}>Góra</option><option value="bottom" ${n.pozycjaObrazu==="bottom"?"selected":""}>Dół</option></select></label><label>Przyciemnienie obrazu <output>${Math.max(0,Math.min(90,Number(n.przyciemnienie)||68))}%</output><input type="range" name="przyciemnienie" min="0" max="90" step="5" value="${Math.max(0,Math.min(90,Number(n.przyciemnienie)||68))}" oninput="this.previousElementSibling.textContent=this.value+'%';odswiezPodgladBanera(this.form)"></label><label>Tekst alternatywny obrazu<input name="obrazAlt" value="${esc(n.obrazAlt||n.tytul||"")}" maxlength="180" placeholder="Krótki opis grafiki dla dostępności"></label><label>Animacja wejścia<select name="animacja"><option value="brak">Bez animacji</option><option value="lagodna" ${n.animacja==="lagodna"?"selected":""}>Łagodne pojawienie</option><option value="przesuniecie" ${n.animacja==="przesuniecie"?"selected":""}>Delikatne przesunięcie</option></select></label></div></fieldset>`;}
function bannerPelnyFormPolaHTML(b={}){return `${bannerFormPolaHTML(b)}${bannerDodatkowePolaHTML(b)}`;}

/* Pełna normalizacja formularza zastępuje starszy skrócony zapis. */
function daneBaneraZaawansowane(form,id){
  const f=new FormData(form),raw={id,ikona:String(f.get("ikona")||"📣").trim()||"📣",etykieta:String(f.get("etykieta")||"").trim().slice(0,40),tytul:String(f.get("tytul")||"").trim(),opis:String(f.get("opis")||"").trim(),przycisk:String(f.get("przycisk")||"Dowiedz się więcej").trim(),link:bezpiecznyLink(String(f.get("link")||"#/").trim()),kodRabatowy:String(f.get("kodRabatowy")||"").trim().toUpperCase(),styl:String(f.get("styl")||"karta"),typ:String(f.get("typ")||"kafelek"),umiejscowienie:String(f.get("umiejscowienie")||"sekcja-banery"),szerokosc:String(f.get("szerokosc")||"polowa"),wysokosc:String(f.get("wysokosc")||"standard"),mobileMode:String(f.get("mobileMode")||"kompaktowy"),zamykany:!!f.get("zamykany"),przyklejony:!!f.get("przyklejony"),wyrownanie:String(f.get("wyrownanie")||"lewo"),odbiorcy:String(f.get("odbiorcy")||"wszyscy"),start:String(f.get("start")||""),koniec:String(f.get("koniec")||""),aktywny:!!f.get("aktywny"),pozycjaObrazu:["center","left","right","top","bottom"].includes(String(f.get("pozycjaObrazu")))?String(f.get("pozycjaObrazu")):"center",przyciemnienie:Math.max(0,Math.min(90,Number(f.get("przyciemnienie"))||68)),obrazAlt:String(f.get("obrazAlt")||"").trim().slice(0,180),animacja:["brak","lagodna","przesuniecie"].includes(String(f.get("animacja")))?String(f.get("animacja")):"brak"};
  raw.rozmiar=raw.szerokosc==="pelna"?"szeroki":raw.wysokosc==="niski"||raw.wysokosc==="pasek"?"kompaktowy":"standard";return normalizujBaner(raw);
}

function zapiszBanerJakoWzor(id){
  const source=pobierzBannery().find(x=>String(x.id)===String(id)),list=wlasneWzoryBanerow();if(!source)return;
  if(list.length>=LIMIT_WLASNYCH_WZOROW_BANNEROW){toast(`Możesz zapisać maksymalnie ${LIMIT_WLASNYCH_WZOROW_BANNEROW} własnych wzorów`);return;}
  const copy={...source,id:`tpl_${Date.now()}`,nazwaWzoru:source.tytul,aktywny:false,start:"",koniec:"",utworzono:new Date().toISOString()};
  zapiszCzescUstawien({wzoryBanerow:[copy,...list]});toast("Banner zapisany jako własny wzór ✅");
}
function utworzBanerZWlasnegoWzoru(id){const tpl=wlasneWzoryBanerow().find(x=>String(x.id)===String(id)),list=pobierzBannery();if(!tpl||list.length>=24)return;zapiszCzescUstawien({bannery:[...list,{...tpl,id:`b_${Date.now()}`,aktywny:true,start:"",koniec:""}]});}
function usunWlasnyWzorBanera(id){zapiszCzescUstawien({wzoryBanerow:wlasneWzoryBanerow().filter(x=>String(x.id)!==String(id))});}
function zapiszGrafikeAIJakoWzor(id){const a=bannerAiStan.assets.find(x=>x.id===id),list=wlasneWzoryBanerow();if(!a||list.length>=LIMIT_WLASNYCH_WZOROW_BANNEROW)return;const tpl=normalizujBaner({id:`tpl_${Date.now()}`,nazwaWzoru:a.title||"Grafika AI",ikona:"✨",etykieta:"POLECAMY",tytul:a.title||"Nowa kampania",opis:a.brief||"",przycisk:"Zobacz ofertę",link:"#/promocje",styl:"wyrozniony",typ:"sekcyjny",umiejscowienie:"nad-produktami",szerokosc:"pelna",wysokosc:"standard",mobileMode:"kompaktowy",wyrownanie:"lewo",odbiorcy:"wszyscy",aktywny:false,obraz:a.url,aiAssetId:a.id,aiModel:a.model,aiGeneratedAt:a.createdAt,aiBrief:a.brief});zapiszCzescUstawien({wzoryBanerow:[tpl,...list]});}
function wlasneWzoryBanerowHTML(){const list=wlasneWzoryBanerow();return `<details class="panel banner-template-section" ${list.length?"open":""}><summary><b>⭐ Moje używane wzory</b><small>${list.length} zapisanych • zachowują grafikę, układ i ustawienia</small></summary><section class="banner-template-grid">${list.map(b=>`<article>${podgladBaneraAdminHTML(b)}<div class="diag-actions"><button class="btn" type="button" onclick="utworzBanerZWlasnegoWzoru(${jsArg(b.id)})">＋ Użyj wzoru</button><button class="btn danger" type="button" onclick="usunWlasnyWzorBanera(${jsArg(b.id)})">Usuń</button></div></article>`).join("")||`<div class="backend-note">Przy dowolnym zapisanym bannerze kliknij „Zapisz jako wzór”. Wzór będzie można ponownie użyć razem z grafiką AI.</div>`}</section></details>`;}

function heroStudioHTML(){const h=ustawienia.hero||{},hidden=(ustawienia.sekcjeUkryte||[]).includes("hero");return `<details class="panel legacy-banner-studio" open><summary><span><b>🖼️ Główny banner hero</b><small>Pierwszy duży banner sklepu — treść, przyciski, obraz i widoczność.</small></span><i></i></summary><form onsubmit="zapiszHeroStudio(event)"><div class="legacy-banner-preview hero-mini-preview" ${h.obraz?`style="background-image:linear-gradient(120deg,rgba(30,41,59,.86),rgba(49,46,129,.66)),url('${esc(h.obraz)}');background-position:${esc(h.pozycjaObrazu||"center")}"`:""}><small>${esc(h.etykieta||"ARTWAY-TM")}</small><b>${esc(KONFIG.heroTytul)}</b><p>${esc(KONFIG.heroOpis)}</p></div><div class="home-editor-grid"><label>Etykieta<input name="etykieta" value="${esc(h.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}"></label><label>Tytuł<input name="tytul" required value="${esc(KONFIG.heroTytul)}"></label><label>Tekst pierwszego przycisku<input name="przycisk1" value="${esc(h.przycisk1||"Zobacz ofertę")}"></label><label>Tekst drugiego przycisku<input name="przycisk2" value="${esc(h.przycisk2||"Sprawdź promocje")}"></label><label>Link drugiego przycisku<input name="link2" value="${esc(h.link2||"#/promocje")}"></label><label>Pozycja obrazu<select name="pozycjaObrazu"><option value="center">Środek</option><option value="left" ${h.pozycjaObrazu==="left"?"selected":""}>Lewa</option><option value="right" ${h.pozycjaObrazu==="right"?"selected":""}>Prawa</option><option value="top" ${h.pozycjaObrazu==="top"?"selected":""}>Góra</option><option value="bottom" ${h.pozycjaObrazu==="bottom"?"selected":""}>Dół</option></select></label></div><label>Opis<textarea name="opis" rows="2">${esc(KONFIG.heroOpis)}</textarea></label><div class="banner-image-control">${h.obraz?`<img src="${esc(h.obraz)}" alt="">`:`<span>Bez własnego obrazu — używany jest bezpieczny układ sklepu</span>`}${polePlikuHTML("wgrajTloHero(this)","Wgraj własne tło")}${h.obraz?`<button class="btn danger" type="button" onclick="usunTloHero()">Usuń obraz</button>`:""}</div><div class="admin-results-operations"><label><input type="checkbox" name="widoczny" ${hidden?"":"checked"}> Widoczny na stronie</label><button class="btn" type="submit">💾 Zapisz hero</button></div></form></details>`;}
function zapiszHeroStudio(event){event.preventDefault();const f=new FormData(event.target),hidden=new Set(ustawienia.sekcjeUkryte||[]);f.get("widoczny")?hidden.delete("hero"):hidden.add("hero");zapiszCzescUstawien({hero:{...(ustawienia.hero||{}),etykieta:String(f.get("etykieta")||"").trim(),przycisk1:String(f.get("przycisk1")||"").trim(),przycisk2:String(f.get("przycisk2")||"").trim(),link2:bezpiecznyLink(String(f.get("link2")||"#/promocje")),pozycjaObrazu:String(f.get("pozycjaObrazu")||"center")},heroTytul:String(f.get("tytul")||"").trim(),heroOpis:String(f.get("opis")||"").trim(),sekcjeUkryte:[...hidden]});}

function pasekOkazjiStudioHTML(){const o=ustawienia.pasekOkazji||{},hidden=(ustawienia.sekcjeUkryte||[]).includes("pasekOferty"),promo=glownaPromocja();return `<details class="panel legacy-banner-studio" open><summary><span><b>🎁 Główny pasek promocyjny</b><small>To dokładnie sekcja „Dobry moment na zakupy” ze strony głównej.</small></span><i></i></summary><form onsubmit="zapiszPasekOkazjiStudio(event)"><div class="legacy-banner-preview offer-mini-preview" ${o.obraz?`style="background-image:linear-gradient(90deg,rgba(30,41,59,.86),rgba(49,46,129,.62)),url('${esc(o.obraz)}');background-position:${esc(o.pozycjaObrazu||"center")}"`:""}><span>${esc(o.ikona||"🎁")}</span><div>${o.etykieta?`<small>${esc(o.etykieta)}</small>`:""}<b>${esc(o.tytul||"Dobry moment na zakupy")}</b><p>${esc(o.opis||(promo?`Użyj kodu ${promo.kod} i odbierz ${promo.procent}% rabatu.`:"Sprawdź aktualne okazje."))}</p></div></div><div class="home-editor-grid"><label>Ikona${emojiPoleHTML("ikona",o.ikona||"🎁","🎁")}</label><label>Mała etykieta<input name="etykieta" value="${esc(o.etykieta||"OKAZJA")}" maxlength="40"></label><label>Tytuł<input name="tytul" required value="${esc(o.tytul||"Dobry moment na zakupy")}"></label><label>Tekst przycisku<input name="tekstLinku" value="${esc(o.tekstLinku||"Zobacz okazje")}"></label><label>Link<input name="link" value="${esc(o.link||"#/promocje")}"></label><label>Powiązany kod<select name="kodRabatowy">${bannerKodyOpcjeHTML(o.kodRabatowy||promo?.kod||"")}</select></label><label>Pozycja obrazu<select name="pozycjaObrazu"><option value="center">Środek</option><option value="left" ${o.pozycjaObrazu==="left"?"selected":""}>Lewa</option><option value="right" ${o.pozycjaObrazu==="right"?"selected":""}>Prawa</option></select></label><label>Wersja telefonu<select name="mobileMode"><option value="pelny">Pełna treść</option><option value="kompaktowy" ${o.mobileMode!=="pelny"?"selected":""}>Kompaktowa — zalecane</option><option value="ukryty" ${o.mobileMode==="ukryty"?"selected":""}>Ukryta</option></select></label></div><label>Opis<textarea name="opis" rows="2">${esc(o.opis||"")}</textarea></label><div class="banner-image-control">${o.obraz?`<img src="${esc(o.obraz)}" alt="">`:`<span>Bez własnego obrazu</span>`}${polePlikuHTML("wgrajObrazPaskaOkazji(this)","Wgraj własne tło")}${o.obraz?`<button class="btn danger" type="button" onclick="usunObrazPaskaOkazji()">Usuń obraz</button>`:""}</div><div class="admin-results-operations"><label><input type="checkbox" name="widoczny" ${hidden?"":"checked"}> Widoczny na stronie</label><button class="btn" type="submit">💾 Zapisz pasek promocyjny</button></div></form></details>`;}
function zapiszPasekOkazjiStudio(event){event.preventDefault();const f=new FormData(event.target),hidden=new Set(ustawienia.sekcjeUkryte||[]);f.get("widoczny")?hidden.delete("pasekOferty"):hidden.add("pasekOferty");zapiszCzescUstawien({pasekOkazji:{...(ustawienia.pasekOkazji||{}),ikona:String(f.get("ikona")||"🎁").trim()||"🎁",etykieta:String(f.get("etykieta")||"").trim(),tytul:String(f.get("tytul")||"").trim(),opis:String(f.get("opis")||"").trim(),tekstLinku:String(f.get("tekstLinku")||"").trim(),link:bezpiecznyLink(String(f.get("link")||"#/promocje")),kodRabatowy:String(f.get("kodRabatowy")||"").trim().toUpperCase(),pozycjaObrazu:String(f.get("pozycjaObrazu")||"center"),mobileMode:String(f.get("mobileMode")||"kompaktowy")},sekcjeUkryte:[...hidden]});}
function wgrajObrazPaskaOkazji(input){wgrajObrazek(input,1600,url=>zapiszCzescUstawien({pasekOkazji:{...(ustawienia.pasekOkazji||{}),obraz:url}}));}
function usunObrazPaskaOkazji(){const {obraz,aiAssetId,aiModel,...rest}=ustawienia.pasekOkazji||{};zapiszCzescUstawien({pasekOkazji:rest});}

function opcjeCelowBannerowAI(){return `<option value="__new">Utwórz nowy banner</option><option value="__hero">Główny banner hero</option><option value="__promo">Główny pasek promocyjny</option>${pobierzBannery().map(b=>`<option value="${esc(b.id)}">Banner: ${esc(b.tytul||b.id)}</option>`).join("")}`;}
function przypiszGrafikeAIDoBanera(assetId,target){const a=bannerAiStan.assets.find(x=>x.id===assetId);if(!a)return;if(target==="__new"){uzyjGrafikiZBibliotekiAI(assetId);return;}if(target==="__hero"){zapiszCzescUstawien({hero:{...(ustawienia.hero||{}),obraz:a.url,aiAssetId:a.id,aiModel:a.model}});return;}if(target==="__promo"){zapiszCzescUstawien({pasekOkazji:{...(ustawienia.pasekOkazji||{}),obraz:a.url,aiAssetId:a.id,aiModel:a.model}});return;}const list=pobierzBannery(),found=list.some(b=>String(b.id)===String(target));if(!found){toast("Wybierz miejsce użycia grafiki");return;}zapiszCzescUstawien({bannery:list.map(b=>String(b.id)===String(target)?{...b,obraz:a.url,aiAssetId:a.id,aiModel:a.model,aiGeneratedAt:a.createdAt,aiBrief:a.brief}:b)});}
function bannerAiBibliotekaHTML(){const assets=bannerAiStan.assets.filter(a=>(a.kind||"banner")==="banner");if(!bannerAiStan.loaded)return `<div class="ai-library-loading">Ładowanie biblioteki wygenerowanych grafik…</div>`;if(!assets.length)return `<div class="ai-library-empty">Nie ma jeszcze grafik AI. Pierwsza pojawi się tutaj po prawdziwym wygenerowaniu.</div>`;return `<div class="order-section-head"><div><h3>Biblioteka grafik AI</h3><p class="order-detail-lead">${assets.length} ostatnich kreacji • każdą przypiszesz do dowolnego bannera</p></div></div><div class="ai-library-grid">${assets.map(a=>`<article><img src="${esc(a.url)}" alt="${esc(a.title||a.brief||"Grafika AI")}"><div><b>${esc(a.title||a.brief||"Grafika AI")}</b><small>${new Date(a.createdAt).toLocaleString("pl-PL")} • ${esc(a.model||"")}</small>${a.discountCode?`<mark>Kod ${esc(a.discountCode)}</mark>`:""}<label>Użyj w<select data-ai-banner-target>${opcjeCelowBannerowAI()}</select></label><div><button class="btn" type="button" onclick="przypiszGrafikeAIDoBanera(${jsArg(a.id)},this.closest('article').querySelector('[data-ai-banner-target]').value)">Zastosuj</button><button class="btn ghost" type="button" onclick="zapiszGrafikeAIJakoWzor(${jsArg(a.id)})">⭐ Zapisz jako wzór</button><button class="btn danger" type="button" onclick="usunGrafikeZBibliotekiAI(${jsArg(a.id)})">Usuń</button></div></div></article>`).join("")}</div>`;}

function widokAdminBanneryZaawansowane(){const list=pobierzBannery();setTimeout(()=>wczytajBibliotekeBannerowAI(),0);return personalizacjaSzkielet("bannery",`<div class="panel banner-workspace-head"><div><span class="order-pro-label">Jedno centrum wszystkich powierzchni promocyjnych</span><h1>🖼️ Bannery, paski i grafiki AI</h1><p>Edytuj główny hero, pasek promocyjny i każdy dodatkowy banner. Grafiki AI możesz przypisać do istniejącego miejsca albo zachować jako własny wzór.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/asortyment/rabaty">🎁 Kody rabatowe</a><a class="btn ghost" href="#/admin/personalizacja/ikony">✨ Ikony AI</a><a class="btn" href="#/">👁️ Podgląd sklepu</a></div></div>${heroStudioHTML()}${pasekOkazjiStudioHTML()}${bannerAiFormHTML()}${wlasneWzoryBanerowHTML()}<details class="panel banner-template-section"><summary><b>📐 Wzory systemowe</b><small>Gotowe miejsca, wymiary i wersje telefonu</small></summary><section class="banner-template-grid">${Object.entries(SZABLONY_BANEROW).map(([id,b])=>`<article>${podgladBaneraAdminHTML(b)}<button class="btn" onclick="utworzBanerZSzablonu('${id}')">＋ Użyj szablonu</button></article>`).join("")}</section></details><details class="panel banner-new-custom"><summary><b>＋ Utwórz ręcznie</b><small>Pełna kontrola treści, miejsca, obrazu i urządzeń.</small></summary><form onsubmit="dodajBanerZaawansowany(event)" oninput="odswiezPodgladBanera(this)">${bannerPelnyFormPolaHTML({})}<button class="btn" type="submit">Utwórz banner</button></form></details><div class="panel"><div class="order-section-head"><div><h2>Dodatkowe bannery</h2><p class="order-detail-lead">${list.length} zapisanych • maksymalnie 24</p></div><button class="btn ghost" onclick="resetujBannery()">↩️ Przywróć podstawowe</button></div><div class="banner-admin-list">${list.map((b,i)=>{const st=statusBanera(b);return `<details class="banner-editor-card" ${i===0?"open":""}><summary>${podgladBaneraAdminHTML(b)}<span class="banner-status ${st[1]}">${st[0]}</span><i></i></summary><form onsubmit="zapiszBanerZaawansowany(event,${jsArg(b.id)})" oninput="odswiezPodgladBanera(this)">${bannerPelnyFormPolaHTML(b)}<div class="banner-image-control">${b.obraz?`<img src="${esc(b.obraz)}" alt=""><span>${b.aiAssetId?`Grafika AI • ${esc(b.aiModel||"")}`:"Własny obraz"}</span>`:"<span>Bez zdjęcia — używana jest ikona i układ sklepu</span>"}${polePlikuHTML(`wgrajObrazBanera(this,${jsArg(b.id)})`,"Wgraj zdjęcie")}${b.obraz?`<button class="btn danger" type="button" onclick="usunObrazBanera(${jsArg(b.id)})">Usuń zdjęcie</button>`:""}</div><div class="admin-results-operations"><label><input type="checkbox" name="aktywny" ${b.aktywny===false?"":"checked"}> Banner aktywny</label><div class="diag-actions"><button class="btn ghost" type="button" onclick="przesunBaner(${jsArg(b.id)},-1)" ${i===0?"disabled":""}>↑</button><button class="btn ghost" type="button" onclick="przesunBaner(${jsArg(b.id)},1)" ${i===list.length-1?"disabled":""}>↓</button><button class="btn ghost" type="button" onclick="duplikujBaner(${jsArg(b.id)})">⧉ Duplikuj</button><button class="btn ghost" type="button" onclick="zapiszBanerJakoWzor(${jsArg(b.id)})">⭐ Zapisz jako wzór</button><button class="btn danger" type="button" onclick="usunBaner(${jsArg(b.id)})">🗑️ Usuń</button><button class="btn" type="submit">💾 Zapisz</button></div></div></form></details>`;}).join("")||`<div class="empty">Brak dodatkowych bannerów.</div>`}</div></div>`);}

/* ── Profesjonalne studio ikon AI ── */
function ikonyAICele(){const targets=[];for(const g of grupyMenuKategorii())targets.push({value:`group:${g.id}`,label:`Grupa menu — ${g.nazwa}`});for(const k of wszystkieKategorie())targets.push({value:`category:${k}`,label:`Katalog — ${k}`});for(const [id,p] of Object.entries(DOMYSLNE_PODSTRONY))targets.push({value:`subpage:${id}`,label:`Podstrona — ${p.nazwa}`});return targets;}
function ikonaPrzypisanaDlaCelu(target){const [type,...rest]=String(target||"").split(":"),id=rest.join(":");if(type==="category")return (ustawienia.ikonyKategorii||{})[id]||null;if(type==="subpage")return ustawieniaPodstrony(id).ikonaObraz?{url:ustawieniaPodstrony(id).ikonaObraz,assetId:ustawieniaPodstrony(id).ikonaAssetId}:null;if(type==="group"){const g=grupyMenuKategorii().find(x=>x.id===id);return g?.ikonaObraz?{url:g.ikonaObraz,assetId:g.ikonaAssetId}:null;}return null;}
function opcjeCelowIkonAI(selected=""){return `<option value="">Wybierz katalog lub podstronę…</option>${ikonyAICele().map(x=>`<option value="${esc(x.value)}" ${x.value===selected?"selected":""}>${esc(x.label)}</option>`).join("")}`;}
function ikonaAiOdswiezElementy(){const status=document.querySelector("[data-ai-icon-status]"),library=document.querySelector("[data-ai-icon-library]");if(status)status.innerHTML=ikonaAiStatusHTML();if(library)library.innerHTML=ikonaAiBibliotekaHTML();}
function ikonaAiStatusHTML(){if(iconAiStan.busy)return `<div class="ai-progress"><span><i style="width:45%"></i></span><b>AI projektuje i zapisuje ikonę…</b><small>Po wygenerowaniu zobaczysz prawdziwy plik, nie atrapę.</small></div>`;if(iconAiStan.error)return `<div class="ai-generation-error"><b>Nie utworzono ikony</b><p>${esc(iconAiStan.error)}</p></div>`;if(iconAiStan.result)return `<div class="icon-generation-result"><img src="${esc(iconAiStan.result.url)}" alt="Wygenerowana ikona"><div><b>Ikona gotowa</b><small>${esc(iconAiStan.result.model||"")} • przezroczyste tło WebP</small><button class="btn" type="button" onclick="przypiszIkoneAI(${jsArg(iconAiStan.result.id)},${jsArg(iconAiStan.target)})" ${iconAiStan.target?"":"disabled"}>Zastosuj w wybranym miejscu</button></div></div>`;return `<div class="ai-generation-ready"><b>Gotowe do projektowania</b><small>AI tworzy jeden czytelny symbol bez tekstu, przeznaczony do małych rozmiarów.</small></div>`;}
async function wczytajBibliotekeIkonAI(){try{const data=await chmura("ai-banner-assets",{timeout:20000});iconAiStan.assets=(Array.isArray(data.items)?data.items:[]).filter(x=>x.kind==="icon");iconAiStan.loaded=true;iconAiStan.configured=!!data.configured;}catch(e){iconAiStan.loaded=true;iconAiStan.error=e.message||"Nie udało się odczytać ikon.";}ikonaAiOdswiezElementy();}
async function uruchomGeneratorIkonyAI(event){event.preventDefault();if(iconAiStan.busy)return;const form=event.target,f=new FormData(form),target=String(f.get("target")||""),brief=String(f.get("brief")||"").trim(),button=form.querySelector("button[type=submit]");if(!target){toast("Najpierw wybierz katalog lub podstronę");return;}iconAiStan={...iconAiStan,busy:true,error:"",result:null,target};if(button)button.disabled=true;ikonaAiOdswiezElementy();try{const targetType=target.split(":")[0],data=await chmura("ai-banner-generate",{method:"POST",body:{kind:"icon",iconUse:targetType==="subpage"?"subpage":"category",brief,subject:String(f.get("subject")||"").trim(),goal:"czytelna ikona nawigacji sklepu",style:String(f.get("style")||"produktowy"),quality:String(f.get("quality")||"medium"),title:ikonyAICele().find(x=>x.value===target)?.label||"Ikona"},timeout:125000});if(!data.generated||!data.asset?.url)throw new Error("Serwer nie potwierdził utworzenia ikony.");iconAiStan.result=data.asset;iconAiStan.assets=[data.asset,...iconAiStan.assets.filter(x=>x.id!==data.asset.id)].slice(0,40);iconAiStan.loaded=true;toast("Ikona AI została naprawdę utworzona ✅");}catch(e){iconAiStan.error=e.message||"Nie udało się wygenerować ikony.";}finally{iconAiStan.busy=false;if(button)button.disabled=false;ikonaAiOdswiezElementy();}}
function przypiszIkoneAI(assetId,target){const a=iconAiStan.assets.find(x=>x.id===assetId)||(iconAiStan.result?.id===assetId?iconAiStan.result:null);if(!a?.url||!target){toast("Wybierz miejsce użycia ikony");return;}const [type,...rest]=String(target).split(":"),id=rest.join(":");if(type==="category"){const map={...(ustawienia.ikonyKategorii||{}),[id]:{url:a.url,assetId:a.id,model:a.model,updatedAt:new Date().toISOString()}};zapiszCzescUstawien({ikonyKategorii:map});return;}if(type==="subpage"){const pages={...(ustawienia.podstrony||{})};pages[id]={...ustawieniaPodstrony(id),ikonaObraz:a.url,ikonaAssetId:a.id};zapiszCzescUstawien({podstrony:pages});return;}if(type==="group"){const groups=grupyMenuKategorii().map(g=>g.id===id?{...g,ikonaObraz:a.url,ikonaAssetId:a.id}:g);zapiszGrupyMenuKategorii(groups);return;}toast("Nieprawidłowe miejsce ikony");}
function usunPrzypisanieIkony(target){const [type,...rest]=String(target).split(":"),id=rest.join(":");if(type==="category"){const map={...(ustawienia.ikonyKategorii||{})};delete map[id];zapiszCzescUstawien({ikonyKategorii:map});return;}if(type==="subpage"){const pages={...(ustawienia.podstrony||{})},{ikonaObraz,ikonaAssetId,...page}=ustawieniaPodstrony(id);pages[id]=page;zapiszCzescUstawien({podstrony:pages});return;}if(type==="group")zapiszGrupyMenuKategorii(grupyMenuKategorii().map(g=>{if(g.id!==id)return g;const {ikonaObraz,ikonaAssetId,...restGroup}=g;return restGroup;}));}
function wgrajIkoneDocelowa(input,target){if(!target){toast("Wybierz najpierw miejsce ikony");input.value="";return;}wgrajObrazek(input,512,url=>{const manual={id:"manual_"+Date.now(),url,model:"własny plik"};iconAiStan.result=manual;iconAiStan.assets=[manual,...iconAiStan.assets];przypiszIkoneAI(manual.id,target);});}
function ikonaAiBibliotekaHTML(){if(!iconAiStan.loaded)return `<div class="ai-library-loading">Ładowanie biblioteki ikon…</div>`;if(!iconAiStan.assets.length)return `<div class="ai-library-empty">Nie ma jeszcze ikon AI.</div>`;return `<div class="order-section-head"><div><h3>Biblioteka ikon AI</h3><p class="order-detail-lead">Wybierz miejsce i przypisz gotową ikonę ponownie</p></div></div><div class="icon-ai-library-grid">${iconAiStan.assets.map(a=>`<article><img src="${esc(a.url)}" alt="${esc(a.title||a.brief||"Ikona AI")}"><div><b>${esc(a.title||a.brief||"Ikona AI")}</b><small>${a.createdAt?new Date(a.createdAt).toLocaleString("pl-PL"):"własny plik"}</small><select>${opcjeCelowIkonAI(iconAiStan.target)}</select><button class="btn" type="button" onclick="przypiszIkoneAI(${jsArg(a.id)},this.previousElementSibling.value)">Zastosuj</button></div></article>`).join("")}</div>`;}
function ikonyPrzypisaniaHTML(){const targets=ikonyAICele();return `<div class="icon-assignment-grid">${targets.map(t=>{const current=ikonaPrzypisanaDlaCelu(t.value);return `<article class="${current?"has-icon":""}"><div class="icon-assignment-preview">${current?`<img src="${esc(current.url)}" alt="">`:`<span>＋</span>`}</div><div><small>${esc(t.label.split(" — ")[0])}</small><b>${esc(t.label.split(" — ").slice(1).join(" — "))}</b></div><div>${polePlikuHTML(`wgrajIkoneDocelowa(this,${jsArg(t.value)})`,"Wgraj")}${current?`<button class="btn danger" type="button" onclick="usunPrzypisanieIkony(${jsArg(t.value)})">Usuń</button>`:`<button class="btn ghost" type="button" onclick="document.querySelector('[name=target]').value=${jsArg(t.value)};document.querySelector('[name=brief]').focus();scrollTo({top:0,behavior:'smooth'})">Generuj AI</button>`}</div></article>`;}).join("")}</div>`;}
function widokAdminIkonyAI(){setTimeout(()=>wczytajBibliotekeIkonAI(),0);return personalizacjaSzkielet("ikony",`<div class="panel icon-studio-head"><div><span class="order-pro-label">Spójny system wizualny sklepu</span><h1>✨ Studio ikon AI</h1><p>Twórz prawdziwe, kwadratowe ikony dla grup menu, katalogów i podstron. Każdą możesz ponownie wykorzystać lub zastąpić własnym plikiem.</p></div><a class="btn" href="#/">👁️ Podgląd sklepu</a></div><section class="panel ai-icon-studio"><form onsubmit="uruchomGeneratorIkonyAI(event)"><div class="home-editor-grid"><label>Miejsce użycia<select name="target" required onchange="iconAiStan.target=this.value;ikonaAiOdswiezElementy()">${opcjeCelowIkonAI(iconAiStan.target)}</select></label><label>Motyw<input name="subject" maxlength="180" placeholder="np. pionki i kostka, balony, dostawa"></label><label>Styl<select name="style"><option value="produktowy">Profesjonalny produktowy</option><option value="radosny">Radosny rodzinny</option><option value="imprezowy">Imprezowy</option><option value="elegancki">Elegancki premium</option><option value="minimalny">Minimalistyczny</option></select></label><label>Jakość<select name="quality"><option value="medium">Profesjonalna — zalecana</option><option value="low">Szybki szkic</option><option value="high">Najwyższa jakość</option></select></label></div><label>Jak ma wyglądać ikona?<textarea name="brief" required minlength="8" maxlength="700" rows="3" placeholder="Np. kolorowe pionki i kostka tworzące prosty, czytelny symbol gier rodzinnych"></textarea><small>AI nie doda tekstu ani logotypu. Tło pozostanie przezroczyste.</small></label><div class="ai-banner-actions"><button class="btn ai-generate-button" type="submit">✨ Wygeneruj ikonę AI</button><span>lub</span>${polePlikuHTML("wgrajIkoneDocelowa(this,this.closest('form').elements.target.value)","Wgraj własną ikonę")}</div><div data-ai-icon-status>${ikonaAiStatusHTML()}</div></form><div class="ai-banner-library" data-ai-icon-library>${ikonaAiBibliotekaHTML()}</div></section><section class="panel"><div class="order-section-head"><div><h2>Przypisania ikon</h2><p class="order-detail-lead">Jednoznacznie widać, gdzie ikona jest używana. Usunięcie przypisania nie usuwa grafiki z biblioteki.</p></div></div>${ikonyPrzypisaniaHTML()}</section>`);}

/* Bezpieczne usuwanie uwzględnia bannery, wzory, pasek, hero i ikony. */
async function usunGrafikeZBibliotekiAI(id){const usedBanner=pobierzBannery().some(b=>b.aiAssetId===id)||wlasneWzoryBanerow().some(b=>b.aiAssetId===id)||(ustawienia.hero||{}).aiAssetId===id||(ustawienia.pasekOkazji||{}).aiAssetId===id;const usedIcon=Object.values(ustawienia.ikonyKategorii||{}).some(x=>x?.assetId===id)||Object.values(ustawienia.podstrony||{}).some(x=>x?.ikonaAssetId===id)||grupyMenuKategorii().some(x=>x.ikonaAssetId===id);if(usedBanner||usedIcon){toast("Ta grafika jest używana. Najpierw usuń jej przypisanie.");return;}try{await chmura("ai-banner-delete",{method:"POST",body:{id}});bannerAiStan.assets=bannerAiStan.assets.filter(x=>x.id!==id);iconAiStan.assets=iconAiStan.assets.filter(x=>x.id!==id);if(bannerAiStan.result?.id===id)bannerAiStan.result=null;if(iconAiStan.result?.id===id)iconAiStan.result=null;bannerAiOdswiezElementy();ikonaAiOdswiezElementy();toast("Grafika usunięta");}catch(e){toast(e.message||"Nie udało się usunąć grafiki");}}

/* Stabilny zapis kodów: kontrola dat, wartości i jedno źródło prawdy. */
function regulaRabatowaZForm(form,oldCode=""){const f=new FormData(form),kod=String(f.get("kod")||"").trim().toUpperCase();if(!/^[A-Z0-9_-]{2,30}$/.test(kod)){toast("Kod musi mieć 2–30 znaków: litery, cyfry, _ lub -");return null;}const typ=String(f.get("typ")||"procent"),wartosc=Math.max(0,Number(f.get("wartosc"))||0),start=String(f.get("start")||""),koniec=String(f.get("koniec")||"");if(typ!=="darmowa_dostawa"&&wartosc<=0){toast("Wartość rabatu musi być większa od zera");return null;}if(typ==="procent"&&wartosc>100){toast("Rabat procentowy nie może przekraczać 100%");return null;}if(start&&koniec&&Date.parse(koniec)<=Date.parse(start)){toast("Koniec promocji musi być później niż początek");return null;}return {kod,typ,wartosc:+wartosc.toFixed(2),minKoszyk:Math.max(0,Number(f.get("minKoszyk"))||0),maxRabat:Math.max(0,Number(f.get("maxRabat"))||0),limitUzyc:Math.max(0,Math.floor(Number(f.get("limitUzyc"))||0)),uzycia:uzyciaKoduRabatowego(oldCode||kod),start,koniec,zakres:String(f.get("zakres")||"wszystkie"),kategorie:f.getAll("kategorie").map(String),produkty:String(f.get("produkty")||"").split(/[,;\s]+/).filter(Boolean),opis:String(f.get("opis")||"").trim(),aktywny:!!f.get("aktywny"),publiczny:!!f.get("publiczny")};}
function zapiszListeRegul(rules){const unique=[],seen=new Set();for(const raw of rules||[]){const key=String(raw?.kod||"").toUpperCase();if(!key||seen.has(key))continue;seen.add(key);unique.push({...raw,kod:key});}let publicSeen=false;for(const r of unique)if(r.publiczny&&r.aktywny!==false){if(publicSeen)r.publiczny=false;else publicSeen=true;}const legacy={};for(const r of unique)if(r.aktywny!==false&&r.typ==="procent"&&r.zakres==="wszystkie"&&!r.start&&!r.koniec&&!r.minKoszyk&&!r.maxRabat&&!r.limitUzyc)legacy[r.kod]=r.wartosc;const publicRule=unique.find(x=>x.publiczny&&x.aktywny!==false);zapiszCzescUstawien({kodyRabatoweZaawansowane:unique,kody:legacy,promocjaGlowna:publicRule?.kod||""});loguj("info",`Zapisano ${unique.length} reguł rabatowych`);}

/* ═══════════ STUDIO KAMPANII PRO: BANNERY, IKONY I RABATY ═══════════ */
let rabatyProStan={save:"idle",message:"",selected:new Set()},rabatProStan=rabatyProStan;

function bannerProClamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function bannerProDevice(button,mode){const form=button.closest("form"),preview=form?.querySelector("[data-banner-live-preview]");if(!preview)return;preview.dataset.device=mode;button.parentElement.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===button));}

function podgladBaneraAdminHTML(b){
  const n=normalizujBaner(b),shade=bannerProClamp(n.przyciemnienie,0,90,68)/100,x=bannerProClamp(n.focalX,0,100,50),y=bannerProClamp(n.focalY,0,100,50),direction=n.kierunekNakladki==="prawo"?"270deg":n.kierunekNakladki==="dookola"?"135deg":"90deg";
  const style=n.obraz?`background-image:linear-gradient(${direction},rgba(15,18,25,${shade}),rgba(15,18,25,${Math.max(.08,shade-.42)})),url('${esc(n.obraz)}');background-position:${x}% ${y}%;--preview-radius:${bannerProClamp(n.promien,0,40,14)}px;--preview-pad:${bannerProClamp(n.odstep,8,48,18)}px;--preview-content:${bannerProClamp(n.szerokoscTresci,30,100,62)}%`:"";
  return `<div class="banner-admin-preview banner-${esc(n.styl||"karta")} preview-type-${esc(n.typ)} preview-width-${esc(n.szerokosc)} preview-height-${esc(n.wysokosc)} ${n.obraz?"has-image":""}" ${style?`style="${style}"`:""}><span>${esc(n.ikona||"📣")}</span><div><small>${esc(TYPY_BANNEROW[n.typ])} • ${esc(MIEJSCA_BANNEROW[n.umiejscowienie])}</small>${n.etykieta?`<i>${esc(n.etykieta)}</i>`:""}<b>${esc(n.tytul||"Tytuł bannera")}</b><p>${esc(n.opis||"Opis bannera")}</p>${n.kodRabatowy?`<mark>Kod: ${esc(n.kodRabatowy)}</mark>`:""}<em class="preview-cta cta-${esc(n.stylPrzycisku||"pelny")}">${esc(n.przycisk||"Dowiedz się więcej")} →</em></div></div>`;
}

function bannerDodatkowePolaHTML(b={}){
  const n=normalizujBaner(b),x=bannerProClamp(n.focalX,0,100,50),y=bannerProClamp(n.focalY,0,100,50),shade=bannerProClamp(n.przyciemnienie,0,90,68),content=bannerProClamp(n.szerokoscTresci,30,100,62),padding=bannerProClamp(n.odstep,8,48,18),radius=bannerProClamp(n.promien,0,40,14);
  return `<fieldset class="banner-layout-settings banner-pro-layout"><legend>4. Kompozycja grafiki</legend><div class="banner-device-preview"><b>Podgląd:</b><button type="button" class="active" onclick="bannerProDevice(this,'desktop')">🖥️ komputer</button><button type="button" onclick="bannerProDevice(this,'tablet')">▰ tablet</button><button type="button" onclick="bannerProDevice(this,'mobile')">📱 telefon</button></div><div class="home-editor-grid"><label>Punkt obrazu X <output>${x}%</output><input type="range" name="focalX" min="0" max="100" value="${x}" oninput="this.previousElementSibling.textContent=this.value+'%';odswiezPodgladBanera(this.form)"></label><label>Punkt obrazu Y <output>${y}%</output><input type="range" name="focalY" min="0" max="100" value="${y}" oninput="this.previousElementSibling.textContent=this.value+'%';odswiezPodgladBanera(this.form)"></label><label>Przyciemnienie <output>${shade}%</output><input type="range" name="przyciemnienie" min="0" max="90" step="2" value="${shade}" oninput="this.previousElementSibling.textContent=this.value+'%';odswiezPodgladBanera(this.form)"></label><label>Kierunek nakładki<select name="kierunekNakladki" onchange="odswiezPodgladBanera(this.form)"><option value="lewo">Tekst po lewej</option><option value="prawo" ${n.kierunekNakladki==="prawo"?"selected":""}>Tekst po prawej</option><option value="dookola" ${n.kierunekNakladki==="dookola"?"selected":""}>Centralna</option></select></label><label>Szerokość treści <output>${content}%</output><input type="range" name="szerokoscTresci" min="30" max="100" step="2" value="${content}" oninput="this.previousElementSibling.textContent=this.value+'%';odswiezPodgladBanera(this.form)"></label><label>Odstęp wewnętrzny <output>${padding}px</output><input type="range" name="odstep" min="8" max="48" step="2" value="${padding}" oninput="this.previousElementSibling.textContent=this.value+'px';odswiezPodgladBanera(this.form)"></label><label>Zaokrąglenie <output>${radius}px</output><input type="range" name="promien" min="0" max="40" step="2" value="${radius}" oninput="this.previousElementSibling.textContent=this.value+'px';odswiezPodgladBanera(this.form)"></label><label>Wygląd przycisku<select name="stylPrzycisku" onchange="odswiezPodgladBanera(this.form)"><option value="pelny">Pełny — zalecany</option><option value="kontur" ${n.stylPrzycisku==="kontur"?"selected":""}>Kontur</option><option value="tekst" ${n.stylPrzycisku==="tekst"?"selected":""}>Sam tekst</option></select></label></div></fieldset><fieldset class="banner-layout-settings"><legend>5. Dostępność i publikacja</legend><div class="home-editor-grid"><label>Tekst alternatywny<input name="obrazAlt" value="${esc(n.obrazAlt||n.tytul||"")}" maxlength="180" placeholder="Krótki opis grafiki dla dostępności"></label><label>Animacja wejścia<select name="animacja"><option value="brak">Bez animacji</option><option value="lagodna" ${n.animacja==="lagodna"?"selected":""}>Łagodne pojawienie</option><option value="przesuniecie" ${n.animacja==="przesuniecie"?"selected":""}>Delikatne przesunięcie</option></select></label></div><div class="backend-note"><b>Bezpieczna publikacja:</b> tekst pozostaje HTML-em, więc jest ostry, dostępny i poprawnie skaluje się na telefonie. Grafika AI nigdy nie zawiera ceny ani kodu jako części obrazu.</div></fieldset>`;
}

function daneBaneraZaawansowane(form,id){
  const f=new FormData(form),old=pobierzBannery().find(x=>String(x.id)===String(id))||{},raw={...old,id,ikona:String(f.get("ikona")||"📣").trim()||"📣",etykieta:String(f.get("etykieta")||"").trim().slice(0,40),tytul:String(f.get("tytul")||"").trim(),opis:String(f.get("opis")||"").trim(),przycisk:String(f.get("przycisk")||"Dowiedz się więcej").trim(),link:bezpiecznyLink(String(f.get("link")||"#/").trim()),kodRabatowy:String(f.get("kodRabatowy")||"").trim().toUpperCase(),styl:String(f.get("styl")||"karta"),typ:String(f.get("typ")||"kafelek"),umiejscowienie:String(f.get("umiejscowienie")||"sekcja-banery"),szerokosc:String(f.get("szerokosc")||"polowa"),wysokosc:String(f.get("wysokosc")||"standard"),mobileMode:String(f.get("mobileMode")||"kompaktowy"),zamykany:!!f.get("zamykany"),przyklejony:!!f.get("przyklejony"),wyrownanie:String(f.get("wyrownanie")||"lewo"),odbiorcy:String(f.get("odbiorcy")||"wszyscy"),start:String(f.get("start")||""),koniec:String(f.get("koniec")||""),aktywny:!!f.get("aktywny"),focalX:bannerProClamp(f.get("focalX"),0,100,50),focalY:bannerProClamp(f.get("focalY"),0,100,50),przyciemnienie:bannerProClamp(f.get("przyciemnienie"),0,90,68),kierunekNakladki:["lewo","prawo","dookola"].includes(String(f.get("kierunekNakladki")))?String(f.get("kierunekNakladki")):"lewo",szerokoscTresci:bannerProClamp(f.get("szerokoscTresci"),30,100,62),odstep:bannerProClamp(f.get("odstep"),8,48,18),promien:bannerProClamp(f.get("promien"),0,40,14),stylPrzycisku:["pelny","kontur","tekst"].includes(String(f.get("stylPrzycisku")))?String(f.get("stylPrzycisku")):"pelny",obrazAlt:String(f.get("obrazAlt")||"").trim().slice(0,180),animacja:["brak","lagodna","przesuniecie"].includes(String(f.get("animacja")))?String(f.get("animacja")):"brak"};
  raw.rozmiar=raw.szerokosc==="pelna"?"szeroki":raw.wysokosc==="niski"||raw.wysokosc==="pasek"?"kompaktowy":"standard";return normalizujBaner(raw);
}

function bannerAiDaneFormularza(form){
  const f=new FormData(form);return {brief:String(f.get("brief")||"").trim(),subject:String(f.get("subject")||"").trim(),goal:String(f.get("goal")||"").trim(),style:String(f.get("style")||"produktowy"),quality:String(f.get("quality")||"medium"),format:String(f.get("format")||"landscape"),composition:String(f.get("composition")||"text-left"),palette:String(f.get("palette")||"brand"),title:String(f.get("title")||"").trim(),description:String(f.get("description")||"").trim(),buttonText:String(f.get("buttonText")||"Zobacz ofertę").trim(),discountCode:String(f.get("discountCode")||"").trim().toUpperCase(),link:bezpiecznyLink(String(f.get("link")||"#/promocje").trim()),typ:String(f.get("typ")||"sekcyjny"),umiejscowienie:String(f.get("umiejscowienie")||"nad-produktami"),szerokosc:String(f.get("szerokosc")||"pelna"),wysokosc:String(f.get("wysokosc")||"standard"),mobileMode:"kompaktowy"};
}

function bannerAiFormHTML(){
  const code=bannerAiKodStartowy();return `<section class="panel ai-banner-studio campaign-ai-studio"><div class="ai-banner-studio-head"><div><span class="order-pro-label">Prawdziwy obraz • GPT Image • zapis w bibliotece</span><h2>✨ Reżyser kampanii AI</h2><p>Podaj pomysł, miejsce i kompozycję. Agent dopracuje treść, a model wygeneruje właściwy plik WebP bez tekstu wtopionego w obraz.</p></div><span class="ai-real-badge">● generator aktywny</span></div><form onsubmit="uruchomGeneratorBaneraAI(event)"><div class="campaign-step"><i>1</i><div><b>Pomysł</b><small>Krótki opis wystarczy</small></div></div><label class="ai-banner-brief">Co ma być na grafice?<textarea name="brief" required minlength="8" maxlength="900" rows="3" placeholder="Np. elegancki zestaw balonów na przyjęcie, produkty po prawej, spokojne miejsce na tekst po lewej"></textarea><small>Nie wpisuj danych tajnych ani chronionych postaci. Tekst, cenę i kod strona nałoży osobno.</small></label><div class="ai-banner-basic-grid"><label>Motyw / produkty<input name="subject" maxlength="220" placeholder="balony, gry rodzinne, dekoracje"></label><label>Cel<select name="goal"><option>promocja sklepu internetowego</option><option>nowa kolekcja</option><option>wyprzedaż</option><option>prezent i sezon</option><option>artykuły imprezowe</option></select></label><label>Styl<select name="style"><option value="produktowy">Profesjonalny produktowy</option><option value="radosny">Radosny rodzinny</option><option value="imprezowy">Imprezowy</option><option value="elegancki">Elegancki premium</option><option value="minimalny">Minimalistyczny</option></select></label><label>Paleta<select name="palette"><option value="brand">Sklepowa — niebieski i fiolet</option><option value="pastel">Pastelowa</option><option value="warm">Ciepła rodzinna</option><option value="premium">Premium</option><option value="natural">Naturalna</option></select></label><label>Kompozycja<select name="composition"><option value="text-left">Miejsce na tekst po lewej</option><option value="text-right">Miejsce na tekst po prawej</option><option value="center">Centralna</option></select></label><label>Format pliku<select name="format"><option value="landscape">Poziomy — hero i banner</option><option value="square">Kwadrat — kafelek</option><option value="portrait">Pionowy — kampania mobilna</option></select></label><label>Jakość<select name="quality"><option value="medium">Profesjonalna — zalecana</option><option value="low">Szybki szkic</option><option value="high">Najwyższa</option></select></label></div><div class="campaign-step"><i>2</i><div><b>Treść i działanie</b><small>Agent może je stylistycznie dopracować</small></div></div><div class="ai-banner-basic-grid"><label>Tytuł<input name="title" maxlength="100" placeholder="Czas na wspólną zabawę"></label><label>Opis<input name="description" maxlength="180" placeholder="Odkryj gry dla całej rodziny"></label><label>Przycisk<input name="buttonText" maxlength="50" value="Zobacz ofertę"></label><label>Link<input name="link" value="#/promocje"></label><label>Kod rabatowy<select name="discountCode">${bannerKodyOpcjeHTML(code)}</select></label></div><div class="campaign-step"><i>3</i><div><b>Miejsce publikacji</b><small>Możesz je zmienić także po wygenerowaniu</small></div></div><div class="ai-banner-basic-grid"><label>Rodzaj<select name="typ">${bannerOpcjeHTML(TYPY_BANNEROW,"sekcyjny")}</select></label><label>Położenie<select name="umiejscowienie">${bannerOpcjeHTML(MIEJSCA_BANNEROW,"nad-produktami")}</select></label><label>Szerokość<select name="szerokosc">${bannerOpcjeHTML({pelna:"Pełna szerokość","dwie-trzecie":"Szeroki — 2/3",polowa:"Połowa","jedna-trzecia":"Kafelek — 1/3"},"pelna")}</select></label><label>Wysokość<select name="wysokosc">${bannerOpcjeHTML({pasek:"Pasek — 56 px",niski:"Niski — 96 px",standard:"Standard — 160 px",wysoki:"Duży — 260 px"},"standard")}</select></label></div><div class="ai-banner-actions"><button class="btn ai-generate-button" type="submit">✨ Zaprojektuj i wygeneruj grafikę</button><small>Powstaje prawdziwy plik. Nic nie zostanie opublikowane bez użycia przycisku „Utwórz banner”.</small></div><div class="ai-generation-status" data-ai-banner-status aria-live="polite">${bannerAiStatusHTML()}</div></form><div class="ai-banner-library" data-ai-banner-library>${bannerAiBibliotekaHTML()}</div></section>`;
}

async function uruchomGeneratorBaneraAI(event){
  event.preventDefault();if(bannerAiStan.busy)return;const form=event.target;let draft=bannerAiDaneFormularza(form),button=form.querySelector("button[type=submit]");bannerAiStan={...bannerAiStan,busy:true,error:"",result:null,draft};if(button)button.disabled=true;bannerAiOdswiezElementy();
  try{
    try{const run=await agentAISpecjalistaWykonaj("banner_copy",{brief:draft.brief,subject:draft.subject,goal:draft.goal,discountCode:draft.discountCode||"brak kodu",currentTitle:draft.title,currentDescription:draft.description,currentCta:draft.buttonText},"Dopracuj krótki tekst kampanii i brief grafiki. Nie zmieniaj kodu ani potwierdzonych warunków.",{},{}),fields=agentAISpecjalistaPola(run?.result||{});draft={...draft,brief:fields.image_brief||draft.brief,title:fields.headline||draft.title,description:fields.subheadline||draft.description,buttonText:fields.cta||draft.buttonText};for(const [name,value] of [["brief",draft.brief],["title",draft.title],["description",draft.description],["buttonText",draft.buttonText]])if(form.elements[name]&&value)form.elements[name].value=value;bannerAiStan.draft=draft;}catch(e){console.warn("Banner copy fallback",e);}
    const data=await chmura("ai-banner-generate",{method:"POST",body:{brief:draft.brief,subject:draft.subject,goal:draft.goal,style:draft.style,quality:draft.quality,format:draft.format,composition:draft.composition,palette:draft.palette,discountCode:draft.discountCode,title:draft.title},timeout:125000});if(!data.generated||!data.asset?.url)throw new Error("Serwer nie potwierdził utworzenia grafiki.");bannerAiStan.result=data.asset;bannerAiStan.assets=[data.asset,...bannerAiStan.assets.filter(x=>x.id!==data.asset.id)].slice(0,40);bannerAiStan.loaded=true;toast("Grafika kampanii została utworzona i zapisana ✅");
  }catch(e){bannerAiStan.error=e.message||"Nie udało się wygenerować grafiki.";}finally{bannerAiStan.busy=false;if(button)button.disabled=false;bannerAiOdswiezElementy();}
}

function heroStudioHTML(){
  const h=ustawienia.hero||{},hidden=(ustawienia.sekcjeUkryte||[]).includes("hero"),x=bannerProClamp(h.focalX,0,100,50),y=bannerProClamp(h.focalY,0,100,50),shade=bannerProClamp(h.przyciemnienie,0,90,76);
  return `<details class="panel legacy-banner-studio hero-pro-editor" open><summary><span><b>🖼️ Główny banner hero</b><small>Najważniejsza powierzchnia: pełna treść, obraz, kadrowanie, przyciski i telefon.</small></span><i></i></summary><form onsubmit="zapiszHeroStudio(event)"><div class="legacy-banner-preview hero-mini-preview" ${h.obraz?`style="background-image:linear-gradient(120deg,rgba(30,41,59,${shade/100}),rgba(49,46,129,.5)),url('${esc(h.obraz)}');background-position:${x}% ${y}%"`:""}><small>${esc(h.etykieta||"ARTWAY-TM")}</small><b>${esc(KONFIG.heroTytul)}</b><p>${esc(KONFIG.heroOpis)}</p></div><fieldset class="banner-layout-settings"><legend>Treść i przyciski</legend><div class="home-editor-grid"><label>Etykieta<input name="etykieta" value="${esc(h.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}"></label><label>Tytuł<input name="tytul" required value="${esc(KONFIG.heroTytul)}"></label><label>Pierwszy przycisk<input name="przycisk1" value="${esc(h.przycisk1||"Zobacz ofertę")}"></label><label>Link pierwszego<input name="link1" value="${esc(h.link1||"#produkty")}"></label><label>Drugi przycisk<input name="przycisk2" value="${esc(h.przycisk2||"Sprawdź promocje")}"></label><label>Link drugiego<input name="link2" value="${esc(h.link2||"#/promocje")}"></label></div><label>Opis<textarea name="opis" rows="3">${esc(KONFIG.heroOpis)}</textarea></label></fieldset><fieldset class="banner-layout-settings"><legend>Obraz, kadr i urządzenia</legend><div class="home-editor-grid"><label>Punkt obrazu X <output>${x}%</output><input type="range" name="focalX" min="0" max="100" value="${x}" oninput="this.previousElementSibling.textContent=this.value+'%'"></label><label>Punkt obrazu Y <output>${y}%</output><input type="range" name="focalY" min="0" max="100" value="${y}" oninput="this.previousElementSibling.textContent=this.value+'%'"></label><label>Przyciemnienie <output>${shade}%</output><input type="range" name="przyciemnienie" min="0" max="90" value="${shade}" oninput="this.previousElementSibling.textContent=this.value+'%'"></label><label>Wysokość<select name="wysokosc"><option value="standard">Standard — 360 px</option><option value="niski" ${h.wysokosc==="niski"?"selected":""}>Niski — 280 px</option><option value="wysoki" ${h.wysokosc==="wysoki"?"selected":""}>Duży — 460 px</option></select></label><label>Wyrównanie<select name="wyrownanie"><option value="lewo">Do lewej</option><option value="srodek" ${h.wyrownanie==="srodek"?"selected":""}>Na środku</option><option value="prawo" ${h.wyrownanie==="prawo"?"selected":""}>Do prawej</option></select></label><label>Telefon<select name="mobileMode"><option value="pelny">Pełny</option><option value="kompaktowy" ${h.mobileMode!=="pelny"&&h.mobileMode!=="ukryty"?"selected":""}>Kompaktowy</option><option value="ukryty" ${h.mobileMode==="ukryty"?"selected":""}>Ukryj</option></select></label></div></fieldset><div class="banner-image-control">${h.obraz?`<img src="${esc(h.obraz)}" alt=""><span>Własna lub wygenerowana grafika</span>`:`<span>Bez obrazu — używany jest sklepowy gradient</span>`}${polePlikuHTML("wgrajTloHero(this)","Wgraj własne tło")}${h.obraz?`<button class="btn danger" type="button" onclick="usunTloHero()">Usuń obraz</button>`:""}</div><div class="admin-results-operations"><label><input type="checkbox" name="widoczny" ${hidden?"":"checked"}> Widoczny</label><button class="btn" type="submit">💾 Zapisz i opublikuj hero</button></div></form></details>`;
}
function zapiszHeroStudio(event){event.preventDefault();const f=new FormData(event.target),hidden=new Set(ustawienia.sekcjeUkryte||[]);f.get("widoczny")?hidden.delete("hero"):hidden.add("hero");zapiszCzescUstawien({hero:{...(ustawienia.hero||{}),etykieta:String(f.get("etykieta")||"").trim(),przycisk1:String(f.get("przycisk1")||"").trim(),link1:bezpiecznyLink(String(f.get("link1")||"#produkty")),przycisk2:String(f.get("przycisk2")||"").trim(),link2:bezpiecznyLink(String(f.get("link2")||"#/promocje")),focalX:bannerProClamp(f.get("focalX"),0,100,50),focalY:bannerProClamp(f.get("focalY"),0,100,50),przyciemnienie:bannerProClamp(f.get("przyciemnienie"),0,90,76),wysokosc:String(f.get("wysokosc")||"standard"),wyrownanie:String(f.get("wyrownanie")||"lewo"),mobileMode:String(f.get("mobileMode")||"kompaktowy")},heroTytul:String(f.get("tytul")||"").trim(),heroOpis:String(f.get("opis")||"").trim(),sekcjeUkryte:[...hidden]});}

function pasekOkazjiStudioHTML(){
  const o=ustawienia.pasekOkazji||{},hidden=(ustawienia.sekcjeUkryte||[]).includes("pasekOferty"),promo=glownaPromocja(),x=bannerProClamp(o.focalX,0,100,50),y=bannerProClamp(o.focalY,0,100,50),shade=bannerProClamp(o.przyciemnienie,0,90,72);
  return `<details class="panel legacy-banner-studio promo-pro-editor" open><summary><span><b>🎁 Główny pasek promocyjny</b><small>Kod, treść, grafika, zachowanie i wersja mobilna w jednym miejscu.</small></span><i></i></summary><form onsubmit="zapiszPasekOkazjiStudio(event)"><div class="legacy-banner-preview offer-mini-preview" ${o.obraz?`style="background-image:linear-gradient(90deg,rgba(30,41,59,${shade/100}),rgba(49,46,129,.45)),url('${esc(o.obraz)}');background-position:${x}% ${y}%"`:""}><span>${esc(o.ikona||"🎁")}</span><div>${o.etykieta?`<small>${esc(o.etykieta)}</small>`:""}<b>${esc(o.tytul||"Dobry moment na zakupy")}</b><p>${esc(o.opis||(promo?`Użyj kodu ${promo.kod} i odbierz ${promo.procent}% rabatu.`:"Sprawdź aktualne okazje."))}</p></div></div><fieldset class="banner-layout-settings"><legend>Treść i działanie</legend><div class="home-editor-grid"><label>Ikona${emojiPoleHTML("ikona",o.ikona||"🎁","🎁")}</label><label>Etykieta<input name="etykieta" value="${esc(o.etykieta||"OKAZJA")}" maxlength="40"></label><label>Tytuł<input name="tytul" required value="${esc(o.tytul||"Dobry moment na zakupy")}"></label><label>Przycisk<input name="tekstLinku" value="${esc(o.tekstLinku||"Zobacz okazje")}"></label><label>Link<input name="link" value="${esc(o.link||"#/promocje")}"></label><label>Powiązany kod<select name="kodRabatowy">${bannerKodyOpcjeHTML(o.kodRabatowy||promo?.kod||"")}</select></label></div><label>Opis<textarea name="opis" rows="3">${esc(o.opis||"")}</textarea></label></fieldset><fieldset class="banner-layout-settings"><legend>Grafika i zachowanie</legend><div class="home-editor-grid"><label>Punkt obrazu X <output>${x}%</output><input type="range" name="focalX" min="0" max="100" value="${x}" oninput="this.previousElementSibling.textContent=this.value+'%'"></label><label>Punkt obrazu Y <output>${y}%</output><input type="range" name="focalY" min="0" max="100" value="${y}" oninput="this.previousElementSibling.textContent=this.value+'%'"></label><label>Przyciemnienie <output>${shade}%</output><input type="range" name="przyciemnienie" min="0" max="90" value="${shade}" oninput="this.previousElementSibling.textContent=this.value+'%'"></label><label>Wysokość<select name="wysokosc"><option value="standard">Standard</option><option value="niski" ${o.wysokosc==="niski"?"selected":""}>Niski</option><option value="wysoki" ${o.wysokosc==="wysoki"?"selected":""}>Duży</option></select></label><label>Telefon<select name="mobileMode"><option value="pelny">Pełny</option><option value="kompaktowy" ${o.mobileMode!=="pelny"&&o.mobileMode!=="ukryty"?"selected":""}>Kompaktowy</option><option value="ukryty" ${o.mobileMode==="ukryty"?"selected":""}>Ukryj</option></select></label><label class="check"><input type="checkbox" name="przyklejony" ${o.przyklejony?"checked":""}> Przyklej podczas przewijania</label></div></fieldset><div class="banner-image-control">${o.obraz?`<img src="${esc(o.obraz)}" alt=""><span>Własna lub wygenerowana grafika</span>`:`<span>Bez własnego obrazu</span>`}${polePlikuHTML("wgrajObrazPaskaOkazji(this)","Wgraj własne tło")}${o.obraz?`<button class="btn danger" type="button" onclick="usunObrazPaskaOkazji()">Usuń obraz</button>`:""}</div><div class="admin-results-operations"><label><input type="checkbox" name="widoczny" ${hidden?"":"checked"}> Widoczny</label><button class="btn" type="submit">💾 Zapisz i opublikuj pasek</button></div></form></details>`;
}
function zapiszPasekOkazjiStudio(event){event.preventDefault();const f=new FormData(event.target),hidden=new Set(ustawienia.sekcjeUkryte||[]);f.get("widoczny")?hidden.delete("pasekOferty"):hidden.add("pasekOferty");zapiszCzescUstawien({pasekOkazji:{...(ustawienia.pasekOkazji||{}),ikona:String(f.get("ikona")||"🎁").trim()||"🎁",etykieta:String(f.get("etykieta")||"").trim(),tytul:String(f.get("tytul")||"").trim(),opis:String(f.get("opis")||"").trim(),tekstLinku:String(f.get("tekstLinku")||"").trim(),link:bezpiecznyLink(String(f.get("link")||"#/promocje")),kodRabatowy:String(f.get("kodRabatowy")||"").trim().toUpperCase(),focalX:bannerProClamp(f.get("focalX"),0,100,50),focalY:bannerProClamp(f.get("focalY"),0,100,50),przyciemnienie:bannerProClamp(f.get("przyciemnienie"),0,90,72),wysokosc:String(f.get("wysokosc")||"standard"),mobileMode:String(f.get("mobileMode")||"kompaktowy"),przyklejony:!!f.get("przyklejony")},sekcjeUkryte:[...hidden]});}

function bannerProListaHTML(list){
  return `<div class="banner-admin-list">${list.map((b,i)=>{const st=statusBanera(b);return `<details class="banner-editor-card"><summary>${podgladBaneraAdminHTML(b)}<span class="banner-status ${st[1]}">${st[0]}</span><i></i></summary><form onsubmit="zapiszBanerZaawansowany(event,${jsArg(b.id)})" oninput="odswiezPodgladBanera(this)">${bannerPelnyFormPolaHTML(b)}<div class="banner-image-control">${b.obraz?`<img src="${esc(b.obraz)}" alt=""><span>${b.aiAssetId?`Grafika AI • ${esc(b.aiModel||"")}`:"Własny obraz"}</span>`:"<span>Bez zdjęcia — używany jest układ sklepu</span>"}${polePlikuHTML(`wgrajObrazBanera(this,${jsArg(b.id)})`,"Wgraj zdjęcie")}${b.obraz?`<button class="btn danger" type="button" onclick="usunObrazBanera(${jsArg(b.id)})">Usuń zdjęcie</button>`:""}</div><div class="admin-results-operations"><label><input type="checkbox" name="aktywny" ${b.aktywny===false?"":"checked"}> Aktywny</label><div class="diag-actions"><button class="btn ghost" type="button" onclick="przesunBaner(${jsArg(b.id)},-1)" ${i===0?"disabled":""}>↑</button><button class="btn ghost" type="button" onclick="przesunBaner(${jsArg(b.id)},1)" ${i===list.length-1?"disabled":""}>↓</button><button class="btn ghost" type="button" onclick="duplikujBaner(${jsArg(b.id)})">⧉ Duplikuj</button><button class="btn ghost" type="button" onclick="zapiszBanerJakoWzor(${jsArg(b.id)})">⭐ Wzór</button><button class="btn danger" type="button" onclick="usunBaner(${jsArg(b.id)})">🗑️ Usuń</button><button class="btn" type="submit">💾 Zapisz i opublikuj</button></div></div></form></details>`;}).join("")||`<div class="empty">Brak dodatkowych bannerów.</div>`}</div>`;
}

function widokAdminBanneryZaawansowane(){
  const list=pobierzBannery(),active=list.filter(x=>statusBanera(x)[1]==="active").length,scheduled=list.filter(x=>statusBanera(x)[1]==="planned").length,withAi=list.filter(x=>x.aiAssetId).length;setTimeout(()=>wczytajBibliotekeBannerowAI(),0);
  return personalizacjaSzkielet("bannery",`<div class="panel banner-workspace-head campaign-head"><div><span class="order-pro-label">Studio kampanii 360°</span><h1>🖼️ Bannery, paski, grafiki i publikacja</h1><p>Jeden proces od pomysłu, przez prawdziwą grafikę AI i kod rabatowy, po dokładny układ na komputerze i telefonie.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/asortyment/rabaty">🎁 Kody rabatowe</a><a class="btn ghost" href="#/admin/personalizacja/ikony">✨ Ikony AI</a><a class="btn" href="#/">👁️ Sklep</a></div></div><div class="campaign-kpi"><article><span>●</span><b>${active}</b><small>aktywnych teraz</small></article><article><span>◷</span><b>${scheduled}</b><small>zaplanowanych</small></article><article><span>✦</span><b>${withAi}</b><small>z grafiką AI</small></article><article><span>▦</span><b>${list.length+2}</b><small>powierzchni kampanii</small></article></div><section class="panel campaign-surface-map"><div><b>1. Hero główne</b><small>najważniejszy przekaz</small></div><i>→</i><div><b>2. Pasek promocji</b><small>kod i konkretna okazja</small></div><i>→</i><div><b>3. Bannery sekcyjne</b><small>produkty i katalogi</small></div></section>${bannerAiFormHTML()}<div class="campaign-core-editors">${heroStudioHTML()}${pasekOkazjiStudioHTML()}</div>${wlasneWzoryBanerowHTML()}<details class="panel banner-template-section"><summary><b>📐 Biblioteka układów</b><small>Gotowe formaty z właściwą responsywnością</small></summary><section class="banner-template-grid">${Object.entries(SZABLONY_BANEROW).map(([id,b])=>`<article>${podgladBaneraAdminHTML(b)}<button class="btn" onclick="utworzBanerZSzablonu('${id}')">＋ Użyj układu</button></article>`).join("")}</section></details><details class="panel banner-new-custom"><summary><b>＋ Projekt od zera</b><small>Treść, siatka, punkt obrazu, nakładka, urządzenia i harmonogram</small></summary><form onsubmit="dodajBanerZaawansowany(event)" oninput="odswiezPodgladBanera(this)">${bannerPelnyFormPolaHTML({})}<button class="btn" type="submit">Utwórz i opublikuj banner</button></form></details><section class="panel"><div class="order-section-head"><div><h2>Zapisane bannery</h2><p class="order-detail-lead">${list.length} projektów • kolejność odpowiada kolejności na stronie</p></div><button class="btn ghost" onclick="resetujBannery()">↩️ Przywróć podstawowe</button></div>${bannerProListaHTML(list)}</section>`);
}

function ikonaAiStatusHTML(){
  if(iconAiStan.busy)return `<div class="ai-progress"><span><i style="width:45%"></i></span><b>AI projektuje i zapisuje prawdziwą ikonę…</b><small>Plik pojawi się w bibliotece po zakończeniu.</small></div>`;
  if(iconAiStan.error)return `<div class="ai-generation-error"><b>Nie utworzono ikony</b><p>${esc(iconAiStan.error)}</p><small>Możesz poprawić opis i ponowić bez utraty przypisań.</small></div>`;
  if(iconAiStan.result)return `<div class="icon-generation-result"><img src="${esc(iconAiStan.result.url)}" alt="Wygenerowana ikona"><div><b>Ikona gotowa</b><small>${esc(iconAiStan.result.model||"")} • WebP • ${iconAiStan.result.background==="transparent"?"tło przezroczyste":"jasne tło dopasowane do sklepu"}</small><button class="btn" type="button" onclick="przypiszIkoneAI(${jsArg(iconAiStan.result.id)},${jsArg(iconAiStan.target)})" ${iconAiStan.target?"":"disabled"}>Zastosuj w wybranym miejscu</button></div></div>`;
  return `<div class="ai-generation-ready"><b>Generator gotowy</b><small>Model tworzy jeden czytelny symbol bez liter, cen i logotypów.</small></div>`;
}

async function uruchomGeneratorIkonyAI(event){
  event.preventDefault();if(iconAiStan.busy)return;const form=event.target,f=new FormData(form),target=String(f.get("target")||""),brief=String(f.get("brief")||"").trim(),button=form.querySelector("button[type=submit]");if(!target){toast("Najpierw wybierz miejsce ikony");return;}iconAiStan={...iconAiStan,busy:true,error:"",result:null,target};if(button)button.disabled=true;ikonaAiOdswiezElementy();
  try{const targetType=target.split(":")[0],data=await chmura("ai-banner-generate",{method:"POST",body:{kind:"icon",iconUse:targetType==="subpage"?"subpage":targetType==="group"?"navigation":"category",brief,subject:String(f.get("subject")||"").trim(),goal:"czytelna ikona nawigacji sklepu",style:String(f.get("style")||"produktowy"),palette:String(f.get("palette")||"brand"),format:"square",composition:"center",quality:String(f.get("quality")||"medium"),title:ikonyAICele().find(x=>x.value===target)?.label||"Ikona"},timeout:125000});if(!data.generated||!data.asset?.url)throw new Error("Serwer nie potwierdził utworzenia ikony.");iconAiStan.result=data.asset;iconAiStan.assets=[data.asset,...iconAiStan.assets.filter(x=>x.id!==data.asset.id)].slice(0,40);iconAiStan.loaded=true;toast("Ikona została naprawdę utworzona ✅");}catch(e){iconAiStan.error=e.message||"Nie udało się wygenerować ikony.";}finally{iconAiStan.busy=false;if(button)button.disabled=false;ikonaAiOdswiezElementy();}
}

function ikonyProFiltr(input){const q=String(input.value||"").trim().toLowerCase();document.querySelectorAll(".icon-assignment-grid article").forEach(card=>card.hidden=q&&!card.textContent.toLowerCase().includes(q));}
function widokAdminIkonyAI(){
  setTimeout(()=>wczytajBibliotekeIkonAI(),0);const assigned=ikonyAICele().filter(x=>ikonaPrzypisanaDlaCelu(x.value)).length;
  return personalizacjaSzkielet("ikony",`<div class="panel icon-studio-head"><div><span class="order-pro-label">Prawdziwe pliki • centralna biblioteka</span><h1>✨ Studio ikon AI</h1><p>Projektuj spójne symbole katalogów, grup menu i podstron, przypisuj je wielokrotnie i kontroluj każde użycie.</p></div><div class="diag-actions"><span class="ai-real-badge">${assigned} przypisanych</span><a class="btn" href="#/">👁️ Sklep</a></div></div><section class="panel ai-icon-studio"><form onsubmit="uruchomGeneratorIkonyAI(event)"><div class="campaign-step"><i>1</i><div><b>Miejsce i motyw</b><small>Najpierw wskaż, gdzie ikona będzie używana</small></div></div><div class="home-editor-grid"><label>Miejsce użycia<select name="target" required onchange="iconAiStan.target=this.value;ikonaAiOdswiezElementy()">${opcjeCelowIkonAI(iconAiStan.target)}</select></label><label>Motyw<input name="subject" maxlength="180" placeholder="pionki i kostka, balony, dostawa"></label><label>Styl<select name="style"><option value="produktowy">Profesjonalny produktowy</option><option value="radosny">Radosny rodzinny</option><option value="imprezowy">Imprezowy</option><option value="elegancki">Elegancki premium</option><option value="minimalny">Minimalistyczny</option></select></label><label>Paleta<select name="palette"><option value="brand">Sklepowa — zalecana</option><option value="pastel">Pastelowa</option><option value="warm">Ciepła</option><option value="premium">Premium</option><option value="natural">Naturalna</option></select></label><label>Jakość<select name="quality"><option value="medium">Profesjonalna — zalecana</option><option value="low">Szybki szkic</option><option value="high">Najwyższa</option></select></label></div><label>Jak ma wyglądać ikona?<textarea name="brief" required minlength="8" maxlength="700" rows="3" placeholder="Prosty symbol kolorowych pionków i kostki, czytelny również przy 32 px"></textarea><small>GPT Image 2 tworzy ikonę na czystym, jasnym tle zgodnym ze sklepem; nie dodaje tekstu ani logotypu.</small></label><div class="ai-banner-actions"><button class="btn ai-generate-button" type="submit">✨ Wygeneruj prawdziwą ikonę</button><span>lub</span>${polePlikuHTML("wgrajIkoneDocelowa(this,this.closest('form').elements.target.value)","Wgraj własną ikonę")}</div><div data-ai-icon-status>${ikonaAiStatusHTML()}</div></form><div class="ai-banner-library" data-ai-icon-library>${ikonaAiBibliotekaHTML()}</div></section><section class="panel"><div class="order-section-head"><div><h2>Przypisania ikon</h2><p class="order-detail-lead">Wyszukaj miejsce, podmień plik albo usuń samo przypisanie.</p></div><input class="icon-pro-search" placeholder="Szukaj katalogu, grupy lub podstrony…" oninput="ikonyProFiltr(this)"></div>${ikonyPrzypisaniaHTML()}</section>`);
}

function rabatProCanonical(rules){
  const out=[],seen=new Set();for(const raw of Array.isArray(rules)?rules:[]){const key=String(raw?.kod||"").trim().toUpperCase();if(!/^[A-Z0-9_-]{2,30}$/.test(key)||seen.has(key))continue;seen.add(key);out.push({...raw,kod:key,uzycia:Math.max(0,Number(raw.uzycia)||0)});}let publicSeen=false;for(const item of out)if(item.publiczny&&item.aktywny!==false){if(publicSeen)item.publiczny=false;else publicSeen=true;}return out;
}

async function zapiszListeRegul(rules){
  const unique=rabatProCanonical(rules),legacy={};for(const r of unique)if(r.aktywny!==false&&r.typ==="procent"&&r.zakres==="wszystkie"&&!r.start&&!r.koniec&&!r.minKoszyk&&!r.maxRabat&&!r.limitUzyc)legacy[r.kod]=r.wartosc;const publicRule=unique.find(x=>x.publiczny&&x.aktywny!==false);ustawienia={...ustawienia,kodyRabatoweZaawansowane:unique,kody:legacy,promocjaGlowna:publicRule?.kod||""};rabatProStan.save="saving";rabatProStan.message="Zapisywanie na serwerze…";zapiszLS("artway_ustawienia",ustawienia);zastosujUstawienia();zbudujProdukty();odswiezMenu();odswiezKoszyk();renderuj();const ok=await chmuraZapiszUstawienia();rabatProStan.save=ok?"saved":"error";rabatProStan.message=ok?`Zapisano ${unique.length} reguł na serwerze`:(chmuraStan.error||"Nie udało się potwierdzić zapisu serwera");loguj(ok?"info":"blad",rabatProStan.message);if(location.hash.includes("/rabaty"))renderuj();toast(ok?"Kod rabatowy zapisany na serwerze ✅":"⚠️ Zmiana została lokalnie; serwer ponowi zapis");return ok;
}

function rabatProFiltruj(input){const box=input.closest("[data-discount-workspace]"),q=String(box.querySelector("[data-discount-search]")?.value||"").toLowerCase(),status=box.querySelector("[data-discount-filter]")?.value||"all";box.querySelectorAll("[data-discount-card]").forEach(card=>{const hit=!q||card.textContent.toLowerCase().includes(q),state=card.dataset.status;card.hidden=!hit||(status!=="all"&&state!==status);});}
function rabatProZaznacz(input){const code=input.value;input.checked?rabatProStan.selected.add(code):rabatProStan.selected.delete(code);const count=document.querySelector("[data-discount-selected]");if(count)count.textContent=String(rabatProStan.selected.size);}
function rabatProWszystkie(button,on=true){button.closest("[data-discount-workspace]").querySelectorAll("[data-discount-card]:not([hidden]) input[data-discount-select]").forEach(input=>{input.checked=on;on?rabatProStan.selected.add(input.value):rabatProStan.selected.delete(input.value);});const count=document.querySelector("[data-discount-selected]");if(count)count.textContent=String(rabatProStan.selected.size);}
function rabatProMasowo(select){const action=select.value,codes=new Set(rabatProStan.selected);if(!action||!codes.size){toast("Zaznacz co najmniej jeden kod");select.value="";return;}let rules=regulyRabatowe();if(action==="on")rules=rules.map(x=>codes.has(x.kod)?{...x,aktywny:true}:x);if(action==="off")rules=rules.map(x=>codes.has(x.kod)?{...x,aktywny:false,publiczny:false}:x);if(action==="delete")rules=rules.filter(x=>!codes.has(x.kod));if(action==="export")adminEksportujCSV("wybrane-kody-rabatowe.csv",["kod","rodzaj","wartosc","minimum","zakres","start","koniec","aktywny"],rules.filter(x=>codes.has(x.kod)).map(x=>[x.kod,x.typ,x.wartosc,x.minKoszyk,x.zakres,x.start,x.koniec,x.aktywny!==false?"TAK":"NIE"]));else zapiszListeRegul(rules);rabatProStan.selected.clear();select.value="";}
function rabatProDuplikuj(code){const source=regulyRabatowe().find(x=>x.kod===String(code).toUpperCase());if(!source)return;let i=2,next=`${source.kod}-${i}`;const used=new Set(regulyRabatowe().map(x=>x.kod));while(used.has(next))next=`${source.kod}-${++i}`;zapiszListeRegul([...regulyRabatowe(),{...source,kod:next,aktywny:false,publiczny:false,uzycia:0,opis:`Kopia: ${source.opis||source.kod}`}]);}
function rabatProKopiuj(code){navigator.clipboard?.writeText(String(code)).then(()=>toast("Kod skopiowany ✅")).catch(()=>toast(`Kod: ${code}`));}
function rabatProTestuj(event){event.preventDefault();const f=new FormData(event.target),rule=regulyRabatowe().find(x=>x.kod===String(f.get("kod")||"").toUpperCase()),total=Math.max(0,Number(f.get("koszyk"))||0),out=event.target.querySelector("output");if(!rule){out.textContent="Wybierz kod";return;}const status=regulaRabatowaStatus(rule);if(!status.aktywna){out.textContent=`Kod nieaktywny: ${status.powod}`;return;}if(total<Number(rule.minKoszyk||0)){out.textContent=`Brakuje ${zl(Number(rule.minKoszyk)-total)} do minimum`;return;}let amount=rule.typ==="kwota"?Math.min(total,Number(rule.wartosc)||0):rule.typ==="procent"?total*(Number(rule.wartosc)||0)/100:0;if(Number(rule.maxRabat)>0)amount=Math.min(amount,Number(rule.maxRabat));out.textContent=rule.typ==="darmowa_dostawa"?"Kod zapewni darmową dostawę":`Rabat ${zl(amount)} • klient zapłaci ${zl(Math.max(0,total-amount))}`;}

function widokAdminRabatyZaawansowane(){
  const rules=regulyRabatowe(),statuses=rules.map(x=>regulaRabatowaStatus({...x,uzycia:uzyciaKoduRabatowego(x.kod)})),active=statuses.filter(x=>x.aktywna).length,scheduled=rules.filter(x=>x.start&&Date.parse(x.start)>Date.now()).length,saveClass=rabatyProStan.save==="error"?"error":rabatyProStan.save==="saving"?"saving":"saved";
  return asortymentSzkielet("rabaty",`<div data-discount-workspace><div class="panel discount-workspace-head"><div><span class="order-pro-label">Jedno źródło prawdy • koszyk i backend</span><h1>🎁 Centrum kodów i kampanii rabatowych</h1><p>Twórz, testuj i publikuj reguły. Zapis jest potwierdzany przez serwer, a kod może być bezpośrednio powiązany z bannerem AI.</p></div><div class="diag-actions"><span class="discount-save-state ${saveClass}">${rabatyProStan.message||"● synchronizacja gotowa"}</span><button class="btn ghost" onclick="eksportujKodyRabatowe()">📤 Eksport CSV</button><a class="btn" href="#/admin/personalizacja/bannery">✨ Studio kampanii</a></div></div><div class="home-editor-stats campaign-kpi"><article><b>${rules.length}</b><small>wszystkich kodów</small></article><article><b>${active}</b><small>aktywnych teraz</small></article><article><b>${scheduled}</b><small>zaplanowanych</small></article><article><b>${rules.reduce((s,x)=>s+uzyciaKoduRabatowego(x.kod),0)}</b><small>potwierdzonych użyć</small></article></div><section class="panel discount-test-lab"><div><span class="order-pro-label">Kontrola przed publikacją</span><h2>Tester kodu</h2><p>Sprawdź wynik na przykładowej wartości koszyka bez tworzenia zamówienia.</p></div><form onsubmit="rabatProTestuj(event)"><select name="kod" required><option value="">Wybierz kod…</option>${rules.map(x=>`<option value="${esc(x.kod)}">${esc(x.kod)} — ${esc(rabatWartoscLabel(x))}</option>`).join("")}</select><input name="koszyk" type="number" min="0" step=".01" value="100" aria-label="Wartość koszyka"><button class="btn" type="submit">Przelicz</button><output>Wynik pojawi się tutaj</output></form></section><details class="panel discount-new" open><summary><b>＋ Nowa kampania rabatowa</b><small>Warunki, zakres, termin, limit i widoczność</small></summary><form onsubmit="dodajReguleRabatowa(event)">${rabatFormPolaHTML({typ:"procent",zakres:"wszystkie",aktywny:true})}<button class="btn" type="submit">💾 Utwórz i zapisz na serwerze</button></form></details><section class="panel discount-operations"><div class="advanced-filter-grid"><label>Wyszukiwanie<input data-discount-search placeholder="Kod, opis, rodzaj lub zakres…" oninput="rabatProFiltruj(this)"></label><label>Status<select data-discount-filter onchange="rabatProFiltruj(this)"><option value="all">Wszystkie</option><option value="active">Aktywne</option><option value="inactive">Nieaktywne / zakończone</option></select></label></div><div class="admin-results-operations"><div><button class="btn ghost" onclick="rabatProWszystkie(this,true)">Zaznacz widoczne</button><button class="btn ghost" onclick="rabatProWszystkie(this,false)">Odznacz</button><b><span data-discount-selected>${rabatProStan.selected.size}</span> wybrano</b></div><select onchange="rabatProMasowo(this)"><option value="">Operacja dla zaznaczonych…</option><option value="on">Aktywuj</option><option value="off">Wyłącz</option><option value="export">Eksportuj</option><option value="delete">Usuń</option></select></div></section><div class="discount-rule-list">${rules.map((rule,index)=>{const state=statuses[index].aktywna?"active":"inactive";return `<details class="panel discount-rule-card" data-discount-card data-status="${state}"><summary><input data-discount-select type="checkbox" value="${esc(rule.kod)}" ${rabatProStan.selected.has(rule.kod)?"checked":""} onclick="event.stopPropagation()" onchange="rabatProZaznacz(this)"><code>${esc(rule.kod)}</code><div><b>${esc(rabatWartoscLabel(rule))}</b><small>${rule.minKoszyk?`od ${zl(rule.minKoszyk)}`:"bez minimum"} • użyto ${uzyciaKoduRabatowego(rule.kod)}${rule.limitUzyc?`/${rule.limitUzyc}`:" razy"}</small></div>${rabatStatusHTML(rule)}<i></i></summary><form onsubmit="zapiszReguleRabatowa(event,${jsArg(rule.kod)})">${rabatGrafikiHTML(rule.kod)}${rabatFormPolaHTML(rule)}<div class="admin-results-operations"><div><button class="btn ghost" type="button" onclick="rabatProKopiuj(${jsArg(rule.kod)})">📋 Kopiuj kod</button><button class="btn ghost" type="button" onclick="rabatProDuplikuj(${jsArg(rule.kod)})">⧉ Duplikuj</button></div><div><button class="btn danger" type="button" onclick="usunReguleRabatowa(${jsArg(rule.kod)})">🗑️ Usuń</button><button class="btn" type="submit">💾 Zapisz na serwerze</button></div></div></form></details>`;}).join("")||`<div class="panel empty">Nie ma jeszcze kodów. Utwórz pierwszą kampanię powyżej.</div>`}</div></div>`);
}
