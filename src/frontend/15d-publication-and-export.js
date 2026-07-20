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
