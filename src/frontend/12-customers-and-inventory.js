/* ── Pełna kartoteka klienta ── */
function pobierzProfil(email){ return pobierzUzytkownikow().find(x=>x.email===String(email||"").toLowerCase()); }
function polaKartotekiHTML(k, opcje={}){
  return `
      <h3 class="f-sekcja">👤 Dane kontaktowe</h3>
      <div class="f-row">
        <div class="f-group"><label>Imię i nazwisko *</label><input required name="imie" value="${esc(k.imie||"")}"></div>
        <div class="f-group"><label>E-mail *</label><input required name="email" type="email" value="${esc(k.email||"")}" ${opcje.blokujEmail?"readonly style='background:var(--line)'":""}></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Telefon</label><input name="telefon" type="tel" value="${esc(k.telefon||"")}" placeholder="np. 600 100 200"></div>
      </div>
      ${opcje.bezHasla?"":`<div class="f-row">
        <div class="f-group"><label>${opcje.edycja?"Nowe hasło (puste = bez zmiany)":"Hasło startowe * (min. 6 znaków)"}</label>
          <input name="haslo" type="password" minlength="6" ${opcje.edycja?"":"required"} autocomplete="new-password"></div>
        <div class="f-group"><label>${opcje.edycja?"Powtórz nowe hasło":"Powtórz hasło startowe *"}</label>
          <input name="haslo2" type="password" minlength="6" ${opcje.edycja?"":"required"} autocomplete="new-password"></div>
      </div>`}
      <h3 class="f-sekcja">📍 Adres</h3>
      <div class="f-row" style="grid-template-columns:2fr 1fr 1fr">
        <div class="f-group"><label>Ulica</label><input name="ulica" value="${esc(k.ulica||"")}"></div>
        <div class="f-group"><label>Nr domu</label><input name="nrDomu" value="${esc(k.nrDomu||"")}"></div>
        <div class="f-group"><label>Nr lokalu</label><input name="nrLokalu" value="${esc(k.nrLokalu||"")}"></div>
      </div>
      <div class="f-row" style="grid-template-columns:1fr 2fr">
        <div class="f-group"><label>Kod pocztowy</label><input name="kod" value="${esc(k.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div>
        <div class="f-group"><label>Miejscowość</label><input name="miasto" value="${esc(k.miasto||"")}"></div>
      </div>
      <h3 class="f-sekcja">🧾 Dane firmowe (jeśli klient kupuje na firmę)</h3>
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>NIP</label><input name="nip" value="${esc(k.nip||"")}" placeholder="10 cyfr" maxlength="13" inputmode="numeric"></div>
        <div class="f-group"><button type="button" class="btn ghost" onclick="nipDoFormularza(this.form, this)">⬇️ Pobierz dane z NIP</button></div>
      </div>
      <div class="f-group"><label>Nazwa firmy</label><input name="firma" value="${esc(k.firma||"")}"></div>
      ${opcje.bezNotatki?"":`<div class="f-group"><label>📝 Notatka o kliencie (widzi tylko admin)</label><textarea name="notatka" rows="2" maxlength="500">${esc(k.notatka||"")}</textarea></div>`}`;
}
function daneKartotekiZFormularza(f){
  const d = {
    imie: String(f.get("imie")||"").trim(),
    telefon: String(f.get("telefon")||"").trim(),
    ulica: String(f.get("ulica")||"").trim(),
    nrDomu: String(f.get("nrDomu")||"").trim(),
    nrLokalu: String(f.get("nrLokalu")||"").trim(),
    kod: String(f.get("kod")||"").trim(),
    miasto: String(f.get("miasto")||"").trim(),
    nip: String(f.get("nip")||"").replace(/[^0-9]/g,""),
    firma: String(f.get("firma")||"").trim()
  };
  if(f.get("notatka")!==null) d.notatka = String(f.get("notatka")||"").trim();
  if(d.nip && !walidujNip(d.nip)) return {blad:"Nieprawidłowy NIP — sprawdź numer"};
  return d;
}
function widokAdminKlient(email){
  const k = pobierzProfil(email);
  if(!k) return adminSzkielet("/admin/klienci", `<div class="panel"><h1>Nie znaleziono klienta</h1><p><a href="#/admin/klienci">← Wróć do listy</a></p></div>`);
  const zam = pobierzZamowienia().filter(z=>z.email===k.email);
  const admin = kontoMaRoleAdmin(k.email), glowny=jestGlownymAdminem(k.email);
  return adminSzkielet("/admin/klienci", `
  ${klienciSubnavHTML("lista")}
  <div class="panel">
    <div class="crumb"><a href="#/admin/klienci">Klienci</a> › ${esc(k.imie)}</div>
    <h1>📇 ${esc(k.imie)} ${admin?'<span class="lvl lvl-info">ADMIN</span>':""} ${k.nip?'<span class="lvl lvl-info">firma</span>':""}</h1>
    <div class="stat-grid">
      <div class="stat"><b>${zam.length}</b><small>zamówień</small></div>
      <div class="stat"><b>${zl(zam.filter(z=>z.status!=="anulowane").reduce((s,z)=>s+z.razem,0))}</b><small>łączna wartość</small></div>
      <div class="stat"><b>${new Date(k.data).toLocaleDateString("pl-PL")}</b><small>rejestracja</small></div>
    </div>
    <form onsubmit="zapiszKartoteke(event, '${esc(k.email)}')">
      ${polaKartotekiHTML(k, {edycja:true, blokujEmail:glowny})}
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz kartotekę</button>
        ${glowny||sesja?.email===k.email?"":`<button class="btn ghost" type="button" onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')">${admin?"🔒 Odbierz rolę administratora":"🛡️ Nadaj rolę administratora"}</button>`}
        ${zam.length?`<a class="btn ghost" href="#/admin/zamowienia" onclick="szukajZamowien='${esc(k.email)}';filtrZamowien='wszystkie'">📦 Zamówienia klienta (${zam.length})</a>`:""}
        <a class="btn ghost" href="mailto:${esc(k.email)}">✉️ Napisz e-mail</a>
        ${admin?"":`<button class="btn danger" type="button" onclick="if(confirm('Usunąć konto ${esc(k.email)}?')){usunKlienta('${esc(k.email)}');location.hash='#/admin/klienci';}">🗑️ Usuń konto</button>`}
      </div>
    </form>
  </div>
  ${zam.length?`<div class="panel">
    <h2 style="margin-top:0">🕐 Ostatnie zamówienia klienta</h2>
    <table class="mini-tab">${zam.slice(0,5).map(z=>`
      <tr><td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a></td>
      <td>${esc(z.data)}</td><td><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">${esc(z.status)}</span></td>
      <td style="text-align:right"><b>${zl(z.razem)}</b></td></tr>`).join("")}</table>
  </div>`:""}`);
}
async function zapiszKartoteke(e, staryEmail){
  e.preventDefault();
  const f = new FormData(e.target);
  const u = pobierzUzytkownikow();
  const k = u.find(x=>x.email===staryEmail);
  if(!k){ toast("Nie znaleziono klienta"); return; }
  const glownyAdmin = jestGlownymAdminem(staryEmail);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  const nowyEmail = glownyAdmin ? staryEmail : String(f.get("email")||"").trim().toLowerCase();
  const noweHaslo = String(f.get("haslo")||"");
  const powtorzoneHaslo = String(f.get("haslo2")||"");
  if(dane.imie.length<2){ toast("⚠️ Podaj imię i nazwisko"); return; }
  if(!nowyEmail.includes("@")){ toast("⚠️ Nieprawidłowy e-mail"); return; }
  if(nowyEmail!==staryEmail && u.some(x=>x.email===nowyEmail)){ toast("⚠️ Ten e-mail jest już zajęty"); return; }
  if(noweHaslo && noweHaslo.length<6){ toast("⚠️ Nowe hasło: min. 6 znaków"); return; }
  if(noweHaslo!==powtorzoneHaslo){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  Object.assign(k, dane, {email: nowyEmail});
  if(noweHaslo){ k.hash = await hashuj(noweHaslo); if(glownyAdmin) domyslneHasloAdmina = noweHaslo==="admin"; }
  zapiszLS("artway_uzytkownicy", u);
  void zapiszUzytkownikaCentralnie(k);
  if(nowyEmail!==staryEmail){
    const zam = pobierzZamowienia();
    zam.forEach(z=>{ if(z.email===staryEmail) z.email=nowyEmail; });
    zapiszLS("artway_zamowienia", zam);
    if(stanBramki.authenticated){
      void wywolajBramke("store-user-delete",{method:"POST",body:{email:staryEmail}}).catch(()=>{});
      zam.filter(z=>z.email===nowyEmail).forEach(z=>void zapiszZamowienieCentralnie(z,false));
    }
    if(sesja?.email===staryEmail) ustawSesje({imie:dane.imie, email:nowyEmail, rola:k.rola||"klient"});
    location.hash = "#/admin/klient/"+encodeURIComponent(nowyEmail);
  } else if(sesja?.email===staryEmail && sesja.imie!==dane.imie){
    ustawSesje({imie:dane.imie, email:staryEmail, rola:k.rola||"klient"});
  }
  loguj("info",`Zapisano kartotekę klienta ${staryEmail}${nowyEmail!==staryEmail?" → "+nowyEmail:""}${noweHaslo?" (nowe hasło)":""}`);
  toast("Kartoteka zapisana ✅"); renderuj();
}
async function dodajKlientaAdmin(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ toast("⚠️ Wpisane hasła nie są takie same"); return; }
  const wynik = await zarejestrujUzytkownika(String(f.get("imie")),String(f.get("email")),String(f.get("haslo")));
  if(!wynik.ok){ toast("⚠️ "+wynik.blad); return; }
  // dopisz pełną kartotekę (adres, firma, notatka)
  const u = pobierzUzytkownikow();
  const k = u.find(x=>x.email===String(f.get("email")).trim().toLowerCase());
  if(k){ Object.assign(k, dane); zapiszLS("artway_uzytkownicy", u); }
  if(k) void zapiszUzytkownikaCentralnie(k);
  loguj("info","Utworzono kartotekę klienta: "+f.get("email"));
  toast("Konto klienta z kartoteką utworzone ✅"); renderuj();
}
function usunKlienta(email){
  if(kontoMaRoleAdmin(email)){ toast("Najpierw odbierz temu kontu rolę administratora"); return; }
  zapiszLS("artway_uzytkownicy", pobierzUzytkownikow().filter(x=>x.email!==email));
  if(stanBramki.authenticated) void wywolajBramke("store-user-delete",{method:"POST",body:{email}}).catch(bl=>toast("Nie usunięto klienta z serwera: "+bl.message));
  loguj("info","Usunięto konto klienta: "+email);
  toast("Usunięto konto "+email);
  renderuj();
}
let szukajProduktow = "", filtrProduktow = "Wszystkie", kategoriaNowegoProduktu = "";
let filtrStatusuProduktow = "aktywne", filtrZrodlaProduktow = "wszystkie", filtrStanuProduktow = "wszystkie", filtrAllegroProduktow = "wszystkie";
let filtrProducentaProduktow="wszyscy",filtrDanychProduktow="wszystkie",filtrSprzedazyProduktow="wszystkie",filtrPromocjiProduktow="wszystkie",cenaOdAdminProduktow="",cenaDoAdminProduktow="";
let sortowanieAdminProduktow = ["external","id","nazwa","producent","kategoria","cena-rosnaco","cena-malejaco","stan","braki-danych","najnowsze"].includes(wczytajLS("artway_produkty_sortowanie_admin","external"))?wczytajLS("artway_produkty_sortowanie_admin","external"):"external";
let gestoscAdminProduktow=["zwarta","wygodna"].includes(wczytajLS("artway_produkty_gestosc_admin","zwarta"))?wczytajLS("artway_produkty_gestosc_admin","zwarta"):"zwarta";
let stronaAdminProduktow = 1;
let produktyNaStronieAdmin = [25,50,100,200,500,1000].includes(Number(wczytajLS("artway_produkty_na_stronie_admin",50)))?Number(wczytajLS("artway_produkty_na_stronie_admin",50)):50;
let frazaMagazynu="", filtrMagazynu="wszystkie", filtrDostawcyMagazynu="wszyscy", filtrLokalizacjiMagazynu="wszystkie", filtrInwentaryzacjiMagazynu="wszystkie", sortowanieMagazynu="ryzyko", stronaMagazynu=1, szukajProducentowMagazynu="", filtrProducentowMagazynu="decyzje";
let magazynNaStronie=[25,50,100,200,500].includes(Number(wczytajLS("artway_magazyn_na_stronie",50)))?Number(wczytajLS("artway_magazyn_na_stronie",50)):50;
function ustawKafelkowyFiltrAsortymentu(typ="aktywne"){
  asortymentResetujFiltry(false);
  if(typ==="allegro_polaczone")filtrAllegroProduktow="polaczone";
  else if(typ==="allegro_duplikaty")filtrAllegroProduktow="duplikaty";
  else if(typ==="allegro_brak")filtrAllegroProduktow="brak";
  else if(typ==="duplikaty_sklepu")filtrStatusuProduktow="duplikaty";
  stronaAdminProduktow=1;renderuj();
  setTimeout(()=>document.querySelector("[data-assortment-results]")?.scrollIntoView({behavior:"smooth",block:"start"}),30);
}
function dokumentTymczasowyHTML(html){const tpl=document.createElement("template");tpl.innerHTML=String(html||"").trim();return tpl.content;}
function asortymentOdswiezWyniki(){
  const source=dokumentTymczasowyHTML(widokAdminProdukty());
  for(const selector of ["[data-assortment-results]","[data-assortment-filter-summary]","[data-assortment-active-filters]","[data-assortment-operations]"]){
    const current=document.querySelector(selector),next=source.querySelector(selector);if(current&&next)current.innerHTML=next.innerHTML;
  }
}
function asortymentSzukajProdukty(input){
  szukajProduktow=String(input?.value||"");stronaAdminProduktow=1;clearTimeout(window.__assortmentSearch);
  window.__assortmentSearch=setTimeout(asortymentOdswiezWyniki,160);
}
function asortymentBrakiDanych(p={}){
  const braki=[];
  if(!String(p.nazwa||"").trim())braki.push("nazwa");
  if(!(Number(p.cena)>0))braki.push("cena");
  if(!String(p.gtin||p.ean||"").trim())braki.push("EAN");
  if(!String(p.zdjecie||(Array.isArray(p.zdjecia)?p.zdjecia[0]:"")||"").trim())braki.push("zdjęcie");
  if(!String(p.opisKrotki||p.krotkiOpis||"").trim()||!String(p.opis||"").trim())braki.push("opis");
  if(!String(p.producent||p.marka||"").trim())braki.push("producent");
  if(!String(p.kategoria||"").trim())braki.push("kategoria");
  if(!String(p.sourceUrl||p.producentUrl||p.urlProducenta||"").trim())braki.push("źródło");
  return braki;
}
function asortymentResetujFiltry(render=true){
  szukajProduktow="";filtrProduktow="Wszystkie";filtrStatusuProduktow="aktywne";filtrZrodlaProduktow="wszystkie";filtrStanuProduktow="wszystkie";filtrAllegroProduktow="wszystkie";filtrProducentaProduktow="wszyscy";filtrDanychProduktow="wszystkie";filtrSprzedazyProduktow="wszystkie";filtrPromocjiProduktow="wszystkie";cenaOdAdminProduktow="";cenaDoAdminProduktow="";stronaAdminProduktow=1;
  if(render)renderuj();
}
function asortymentUstawFiltr(nazwa,value){
  const v=String(value??"");
  if(nazwa==="kategoria")filtrProduktow=v||"Wszystkie";
  else if(nazwa==="status")filtrStatusuProduktow=v||"aktywne";
  else if(nazwa==="zrodlo")filtrZrodlaProduktow=v||"wszystkie";
  else if(nazwa==="stan")filtrStanuProduktow=v||"wszystkie";
  else if(nazwa==="allegro")filtrAllegroProduktow=v||"wszystkie";
  else if(nazwa==="producent")filtrProducentaProduktow=v||"wszyscy";
  else if(nazwa==="dane")filtrDanychProduktow=v||"wszystkie";
  else if(nazwa==="sprzedaz")filtrSprzedazyProduktow=v||"wszystkie";
  else if(nazwa==="promocja")filtrPromocjiProduktow=v||"wszystkie";
  else if(nazwa==="cenaOd")cenaOdAdminProduktow=v;
  else if(nazwa==="cenaDo")cenaDoAdminProduktow=v;
  stronaAdminProduktow=1;renderuj();
}
function asortymentUstawWidok(widok="aktywne"){
  asortymentResetujFiltry(false);
  if(widok==="gotowe"){filtrDanychProduktow="gotowe";filtrSprzedazyProduktow="dostepne";}
  else if(widok==="braki")filtrDanychProduktow="braki";
  else if(widok==="bez-allegro")filtrAllegroProduktow="brak";
  else if(widok==="ukryte")filtrSprzedazyProduktow="niedostepne";
  else if(widok==="promocje")filtrPromocjiProduktow="promocje";
  else if(widok==="kosz")filtrStatusuProduktow="kosz";
  renderuj();
}
function asortymentWyczyscFiltr(nazwa){
  if(nazwa==="szukaj")szukajProduktow="";
  else if(nazwa==="kategoria")filtrProduktow="Wszystkie";
  else if(nazwa==="status")filtrStatusuProduktow="aktywne";
  else if(nazwa==="zrodlo")filtrZrodlaProduktow="wszystkie";
  else if(nazwa==="stan")filtrStanuProduktow="wszystkie";
  else if(nazwa==="allegro")filtrAllegroProduktow="wszystkie";
  else if(nazwa==="producent")filtrProducentaProduktow="wszyscy";
  else if(nazwa==="dane")filtrDanychProduktow="wszystkie";
  else if(nazwa==="sprzedaz")filtrSprzedazyProduktow="wszystkie";
  else if(nazwa==="promocja")filtrPromocjiProduktow="wszystkie";
  else if(nazwa==="cena"){cenaOdAdminProduktow="";cenaDoAdminProduktow="";}
  stronaAdminProduktow=1;renderuj();
}
function ustawGestoscAdminProduktow(v){gestoscAdminProduktow=v==="wygodna"?"wygodna":"zwarta";zapiszLS("artway_produkty_gestosc_admin",gestoscAdminProduktow);renderuj();}
function magazynSzukajProdukty(input){
  frazaMagazynu=String(input?.value||"");stronaMagazynu=1;clearTimeout(window.__warehouseSearch);
  window.__warehouseSearch=setTimeout(()=>{
    const current=document.querySelector(".warehouse-stock-page"),source=dokumentTymczasowyHTML(widokAdminMagazyn("stany")).querySelector(".warehouse-stock-page");if(!current||!source)return;
    for(const selector of [".warehouse-stock-results",".warehouse-stock-list"]){const a=current.querySelector(selector),b=source.querySelector(selector);if(a&&b)a.innerHTML=b.innerHTML;}
    const aPages=current.querySelectorAll(":scope > .pagination"),bPages=source.querySelectorAll(":scope > .pagination");aPages.forEach((el,i)=>{if(bPages[i])el.innerHTML=bPages[i].innerHTML;});
    const aConfirm=current.querySelector("[data-stock-confirm-visible]"),bConfirm=source.querySelector("[data-stock-confirm-visible]");if(aConfirm&&bConfirm)aConfirm.replaceWith(bConfirm);
  },140);
}
function odswiezMonitoringProducentow(){
  if(trasa()!=="/admin/magazyn/dostawcy")return false;
  const current=document.querySelector(".supplier-monitor-panel"),source=dokumentTymczasowyHTML(widokAdminMagazyn("dostawcy")).querySelector(".supplier-monitor-panel");
  if(!current||!source)return false;
  const active=document.activeElement,scrollY=window.scrollY||0,selection=active&&typeof active.selectionStart==="number"?{start:active.selectionStart,end:active.selectionEnd}:null;
  aktualizujWezelStabilnie(current,source,active);
  if(active?.isConnected&&selection&&typeof active.setSelectionRange==="function")try{active.setSelectionRange(selection.start,selection.end);}catch(e){}
  if(Math.abs((window.scrollY||0)-scrollY)>1)window.scrollTo({top:scrollY});
  return true;
}
function jestProduktemDodanym(id){ return produktyDodane.some(p=>Number(p.id)===Number(id)); }
function jestProduktemImportowanym(id){ return produktyImportowane.some(p=>String(p.id)===String(id)); }
function produktDodanyPoId(id){ return produktyDodane.find(p=>Number(p.id)===Number(id)); }
function czyProduktAdminWKoszu(p){
  if(!p) return false;
  if(jestProduktemDodanym(p.id)) return false;
  return produktyUkryte.includes(p.id);
}
function bazoweProduktyWKoszu(){
  const dodaneIds=new Set(produktyDodane.map(p=>Number(p.id)));
  return produktyUkryte
    .filter(id=>!dodaneIds.has(Number(id))&&koszMeta[id]&&!produktyDefinitywne.includes(id))
    .map(id=>produktyBazoweWspolne().find(x=>Number(x.id)===Number(id)))
    .filter(Boolean);
}
function produktyDoAdministracji(){
  naprawKolizjeIdProduktow();
  const dodaneIds = new Set(produktyDodane.map(p=>Number(p.id)));
  return [
    ...produktyBazoweWspolne().filter(p=>!dodaneIds.has(Number(p.id))&&!produktyDefinitywne.includes(p.id)).map(p=>produktyEdytowane[p.id] ? {...p, ...produktyEdytowane[p.id], id:p.id} : p),
    ...produktyDodane
  ];
}
function pobierzProduktAdmin(id){ return produktDodanyPoId(id) || produktyDoAdministracji().find(p=>p.id===id); }
function ustawStroneAdminProduktow(n){ stronaAdminProduktow=Math.max(1,Number(n)||1); renderuj(); }
function ustawProduktyNaStronieAdmin(n){
  produktyNaStronieAdmin=[25,50,100,200,500,1000].includes(Number(n))?Number(n):50;
  stronaAdminProduktow=1;
  zapiszLS("artway_produkty_na_stronie_admin",produktyNaStronieAdmin);
  renderuj();
}
function ustawSortowanieAdminProduktow(v){sortowanieAdminProduktow=String(v||"external");stronaAdminProduktow=1;zapiszLS("artway_produkty_sortowanie_admin",sortowanieAdminProduktow);renderuj();}
function sortujProduktyAdmin(lista){
  return [...lista].sort((a,b)=>{
    if(sortowanieAdminProduktow==="external"){
      const aa=String(a.externalId||a.sku||a.gtin||a.ean||"").trim(),bb=String(b.externalId||b.sku||b.gtin||b.ean||"").trim();
      if(!aa&&!bb)return Number(a.id)-Number(b.id);if(!aa)return 1;if(!bb)return -1;return aa.localeCompare(bb,"pl",{numeric:true,sensitivity:"base"})||Number(a.id)-Number(b.id);
    }
    if(sortowanieAdminProduktow==="nazwa") return a.nazwa.localeCompare(b.nazwa,"pl");
    if(sortowanieAdminProduktow==="producent") return String(a.producent||a.marka||"").localeCompare(String(b.producent||b.marka||""),"pl",{numeric:true,sensitivity:"base"})||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieAdminProduktow==="kategoria") return String(a.kategoria||"").localeCompare(String(b.kategoria||""),"pl",{numeric:true,sensitivity:"base"})||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieAdminProduktow==="cena-rosnaco") return a.cena-b.cena;
    if(sortowanieAdminProduktow==="cena-malejaco") return b.cena-a.cena;
    if(sortowanieAdminProduktow==="stan"){
      const sa=stanyProduktow[a.id]===undefined?Number.MAX_SAFE_INTEGER:Number(stanyProduktow[a.id]);
      const sb=stanyProduktow[b.id]===undefined?Number.MAX_SAFE_INTEGER:Number(stanyProduktow[b.id]);
      return sa-sb;
    }
    if(sortowanieAdminProduktow==="braki-danych") return asortymentBrakiDanych(b).length-asortymentBrakiDanych(a).length||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieAdminProduktow==="najnowsze"){
      const da=Date.parse(a.createdAt||a.agentImportAt||a.updatedAt||0)||0,db=Date.parse(b.createdAt||b.agentImportAt||b.updatedAt||0)||0;
      return db-da||Number(b.id)-Number(a.id);
    }
    return Number(a.id)-Number(b.id);
  });
}
function statusZamowieniaRezerwujeMagazyn(z){
  const s=String(z?.status||"").toLowerCase();
  return !!z && !["anulowane","cancelled","wysłane","wyslane","sent","zrealizowane","completed","dostarczone","zakończone","zwrot","zwrot pieniędzy"].includes(s);
}
function pozycjeZamowieniaMagazyn(z){
  if(Array.isArray(z?.pozycjeDane)&&z.pozycjeDane.length) return z.pozycjeDane.map(p=>({
    id:p.id, nazwa:p.nazwa||p.produkt||"Produkt", sku:p.sku||"", ilosc:Number(p.ilosc)||1, cena:kwotaNum(p.cena), wartosc:kwotaNum(p.wartosc||kwotaNum(p.cena)*(Number(p.ilosc)||1))
  })).filter(p=>p.id!==undefined&&p.id!==null&&p.id!=="");
  return [];
}
function rezerwacjeSklepuZamowienie(z, ruchy=[]){
  const poProduktach={};
  pozycjeZamowieniaMagazyn(z).forEach(p=>{
    const id=String(p.id??"").trim(),ilosc=Math.max(0,Number(p.ilosc)||0);
    if(id&&ilosc>0) poProduktach[id]=(poProduktach[id]||0)+ilosc;
  });
  const nr=String(z?.nr||"").trim(),requestId=nr?`order-stock:${nr}`:"";
  if(!requestId||String(z?.inventoryMode||z?.inventory_mode||"").toLowerCase()==="reserved_until_shipment") return poProduktach;
  const legacyPoProduktach={};
  (Array.isArray(ruchy)?ruchy:[]).forEach(r=>{
    if(String(r?.sourceRequestId||"").trim()!==requestId) return;
    const id=String(r?.produktId??r?.productId??"").trim(),stanPrzed=Number(r?.stanPrzed);
    if(!id||!Object.prototype.hasOwnProperty.call(poProduktach,id)||r?.stanPrzed===null||r?.stanPrzed===""||!Number.isFinite(stanPrzed)) return;
    const poprzedni=legacyPoProduktach[id];
    legacyPoProduktach[id]=poprzedni===undefined?Math.max(0,stanPrzed):Math.max(poprzedni,stanPrzed);
  });
  Object.entries(legacyPoProduktach).forEach(([id,stanPrzed])=>{
    poProduktach[id]=Math.max(0,Number(poProduktach[id]||0)-stanPrzed);
  });
  return poProduktach;
}
function statusAllegroRezerwujeMagazyn(z){
  return !!z && allegroZamowienieAktywneLokalnie(z);
}
function aktywneZamowieniaAllegro(){
  return (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).filter(statusAllegroRezerwujeMagazyn);
}
function pozycjeAllegroMagazyn(z){
  const items=Array.isArray(z?.lineItems)?z.lineItems:[];
  return items.map(it=>{
    const offerId=String(it.offerId||it.offer?.id||it.id||"").trim();
    const dane=allegroDanePozycjiZamowienia({...it,offerId});
    const ilosc=Math.max(1,Number(it.quantity??it.qty??it.quantityOrdered)||1);
    const dopasowanie=allegroDopasowaniePozycjiDoProduktu({...it,offerId}),mapped=dopasowanie.produkt||null;
    return {
      id:mapped?.id??"",
      offerId,
      externalId:dane.kod,
      ean:dane.ean,
      nazwa:dane.nazwa,
      sku:dane.kod,
      ilosc,
      cena:kwotaNum(it.price?.amount ?? it.price ?? it.unitPrice),
      wartosc:kwotaNum(it.value ?? (kwotaNum(it.price?.amount ?? it.price ?? it.unitPrice)*ilosc)),
      produkt:mapped,
      match:dopasowanie.match,
      confidence:dopasowanie.confidence,
      candidates:dopasowanie.candidates||[]
    };
  });
}
function rezerwacjeMagazynowe(){
  if(rezerwacjeMagazynowe._cache&&Date.now()-rezerwacjeMagazynowe._cache.at<1500)return rezerwacjeMagazynowe._cache.value;
  const mapa={};
  pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).forEach(z=>{
    Object.entries(rezerwacjeSklepuZamowienie(z,ruchyMagazynowe)).forEach(([id,ilosc])=>{mapa[id]=(mapa[id]||0)+Number(ilosc||0);});
  });
  aktywneZamowieniaAllegro().forEach(z=>pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{mapa[p.id]=(mapa[p.id]||0)+p.ilosc;}));
  rezerwacjeMagazynowe._cache={at:Date.now(),value:mapa};
  return mapa;
}
function allegroAnalizaMagazynowaZamowienia(z){
  const rez=rezerwacjeMagazynowe();
  const pozycje=pozycjeAllegroMagazyn(z).map(p=>{
    const stan=p.produkt?stanMagazynuId(p.produkt.id):null,meta=p.produkt?magazynMetaProduktu(p.produkt.id):{};
    const laczne=p.produkt?Number(rez[p.produkt.id]||0):0,dostepne=stan===null?null:stan-laczne;
    const brak=!p.produkt||stan===null?null:Math.max(0,-dostepne),lokalizacja=String(meta.lokalizacja||"").trim(),dostawca=String(meta.dostawca||"").trim();
    const dokumenty=p.produkt?(agentAIZlecenia||[]).filter(doc=>agentAIPlanDokumentAktywny(doc)&&(doc.pozycje||[]).some(x=>String(x.produktId)===String(p.produkt.id))).map(doc=>({id:doc.id,numer:doc.numer||doc.id,status:doc.status||"szkic"})):[];
    const decyzja=!p.produkt?"nierozpoznany":stan===null?"sprawdz_stan":brak>0?"zamow_u_producenta":!lokalizacja?"uzupelnij_lokalizacje":"kompletuj";
    return {...p,stan,laczneRezerwacje:laczne,dostepne,brak,lokalizacja,dostawca,dokumentyProducenta:dokumenty,decyzja};
  });
  const nierozpoznane=pozycje.filter(p=>!p.produkt).length,bezStanu=pozycje.filter(p=>p.produkt&&p.stan===null).length,bezLokalizacji=pozycje.filter(p=>p.produkt&&p.stan!==null&&!p.brak&&!p.lokalizacja).length,braki=pozycje.reduce((s,p)=>s+Number(p.brak||0),0);
  return {pozycje,nierozpoznane,bezStanu,bezLokalizacji,braki,gotowe:nierozpoznane===0&&bezStanu===0&&bezLokalizacji===0&&braki===0};
}
function dataZamowieniaMs(z={}){const raw=z.ts??z.createdAt??z.firstFetchedAt??z.data??z.date??"",n=Number(raw);return Number.isFinite(n)&&n>1e9?(n<1e11?n*1000:n):(Date.parse(raw)||0);}
function sprzedazKanalyMagazynowe(dni=30){
  const key=String(dni),cached=sprzedazKanalyMagazynowe._cache?.[key];if(cached&&Date.now()-cached.at<5000)return cached.value;
  const sklep={},allegro={},razem={},od=Date.now()-dni*86400000;
  pobierzZamowienia().filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&dataZamowieniaMs(z)>=od).forEach(z=>pozycjeZamowieniaMagazyn(z).forEach(p=>{sklep[p.id]=(sklep[p.id]||0)+p.ilosc;}));
  (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).filter(z=>String(z.status||"").toUpperCase()!=="CANCELLED"&&dataZamowieniaMs(z)>=od).forEach(z=>pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{allegro[p.id]=(allegro[p.id]||0)+p.ilosc;}));
  new Set([...Object.keys(sklep),...Object.keys(allegro)]).forEach(id=>{razem[id]=Number(sklep[id]||0)+Number(allegro[id]||0);});
  const value={sklep,allegro,razem,dni};sprzedazKanalyMagazynowe._cache={...(sprzedazKanalyMagazynowe._cache||{}),[key]:{at:Date.now(),value}};return value;
}
function sprzedazMagazynowa(dni=30){return sprzedazKanalyMagazynowe(dni).razem;}
function priorytetDostepnosciProduktu(p={},kanaly=sprzedazKanalyMagazynowe(30),rez=rezerwacjeMagazynowe()){
  const id=String(p.id),sklep=Number(kanaly.sklep[id]||p.sprzedazSklep30||0),allegro=Number(kanaly.allegro[id]||p.sprzedazAllegro30||0),active=Number(rez[id]||p.aktywneZapotrzebowanie||0),score=sklep*4+allegro*5+active*8;
  return {sklep,allegro,razem:sklep+allegro,active,score,channel:allegro>sklep?"Allegro":sklep>allegro?"Sklep":allegro||sklep?"Oba kanały":"Brak sprzedaży",level:score>=40?"krytyczny":score>=15?"wysoki":score>0?"standard":"niski"};
}
function rankingDostepnosciProducentow(lista=produktyMonitorowaneUProducentow()){
  const kanaly=sprzedazKanalyMagazynowe(30),rez=rezerwacjeMagazynowe();return lista.map(p=>({p,priority:priorytetDostepnosciProduktu(p,kanaly,rez),availability:producentDostepnoscInfo(p)})).sort((a,b)=>b.priority.score-a.priority.score||b.availability.ageHours-a.availability.ageHours||String(a.p.nazwa||"").localeCompare(String(b.p.nazwa||""),"pl")).map((x,index)=>({...x,rank:index+1}));
}
function filtrujProduktyMagazynu(lista, rez, sprzedaz){
  const u=ustawieniaMagazynuPelne(), prog=Math.max(0,Number(u.progNiski)||5);
  let out=lista.filter(p=>!czyProduktAdminWKoszu(p));
  if(frazaMagazynu) out=out.filter(p=>{
    const meta=magazynMetaProduktu(p.id);
    const kartoteka=[meta.lokalizacja,nazwaLokalizacjiMagazynu(meta.lokalizacja),meta.dostawca,meta.kod,meta.uwagi].filter(Boolean).join(" ");
    return produktPasujeFrazie(p,frazaMagazynu)||String(p.sku||"").toLowerCase().includes(frazaMagazynu.toLowerCase())||kartoteka.toLowerCase().includes(frazaMagazynu.toLowerCase());
  });
  if(filtrMagazynu==="monitorowane") out=out.filter(p=>stanMagazynuId(p.id)!==null);
  if(filtrMagazynu==="bezlimitu") out=out.filter(p=>stanMagazynuId(p.id)===null);
  if(filtrMagazynu==="niskie") out=out.filter(p=>{const s=stanMagazynuId(p.id), pr=progNiskiProduktu(p);return s!==null&&s>0&&s<=pr;});
  if(filtrMagazynu==="brak") out=out.filter(p=>stanMagazynuId(p.id)===0);
  if(filtrMagazynu==="rezerwacje") out=out.filter(p=>Number(rez[p.id]||0)>0);
  if(filtrMagazynu==="sprzedaz") out=out.filter(p=>Number(sprzedaz[p.id]||0)>0);
  if(filtrMagazynu==="bestsellery") out=out.filter(p=>priorytetDostepnosciProduktu(p).score>0);
  if(filtrMagazynu==="alerty") out=out.filter(p=>{const i=producentDostepnoscInfo(p),d=dostepneSztukiMagazynu(p,rez),plan=sugestiaZatowarowania(p,rez,sprzedaz);return i.alert||d!==null&&d<0||Number(plan.ilosc||0)>0;});
  if(filtrMagazynu==="dozamowienia") out=out.filter(p=>Number(sugestiaZatowarowania(p,rez,sprzedaz).ilosc)>0);
  if(filtrMagazynu==="nadrezerwacja") out=out.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;});
  if(filtrMagazynu==="producent-niski") out=out.filter(p=>producentDostepnoscInfo(p).status==="niski");
  if(filtrMagazynu==="producent-brak") out=out.filter(p=>producentDostepnoscInfo(p).status==="brak");
  if(filtrMagazynu==="producent-nieznany") out=out.filter(p=>{const i=producentDostepnoscInfo(p);return !i.url||i.stale||["nieznany","blad"].includes(i.status);});
  if(filtrMagazynu==="bezlokalizacji") out=out.filter(p=>!magazynMetaProduktu(p.id).lokalizacja);
  if(filtrMagazynu==="bezdostawcy") out=out.filter(p=>!magazynMetaProduktu(p.id).dostawca);
  if(filtrDostawcyMagazynu!=="wszyscy") out=out.filter(p=>String(magazynMetaProduktu(p.id).dostawca||"")===filtrDostawcyMagazynu);
  if(filtrLokalizacjiMagazynu!=="wszystkie") out=out.filter(p=>String(magazynMetaProduktu(p.id).lokalizacja||"BRAK")===filtrLokalizacjiMagazynu);
  if(filtrInwentaryzacjiMagazynu!=="wszystkie") out=out.filter(p=>{const d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja,t=d?Date.parse(d):0,stara=!t||(Date.now()-t)>90*86400000;return filtrInwentaryzacjiMagazynu==="aktualna"?!stara:stara;});
  return sortujProduktyMagazynu(out, rez, sprzedaz, prog);
}
function sortujProduktyMagazynu(lista, rez={}, sprzedaz={}, prog=5){
  const planCache=new Map();
  const plan=p=>{
    const key=String(p.id);
    if(!planCache.has(key)) planCache.set(key,sugestiaZatowarowania(p,rez,sprzedaz));
    return planCache.get(key);
  };
  return [...lista].sort((a,b)=>{
    const sa=stanMagazynuId(a.id), sb=stanMagazynuId(b.id);
    if(sortowanieMagazynu==="nazwa") return String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="stan") return (sa===null?Number.MAX_SAFE_INTEGER:sa)-(sb===null?Number.MAX_SAFE_INTEGER:sb);
    if(sortowanieMagazynu==="rezerwacje") return Number(rez[b.id]||0)-Number(rez[a.id]||0);
    if(sortowanieMagazynu==="sprzedaz") return Number(sprzedaz[b.id]||0)-Number(sprzedaz[a.id]||0);
    if(sortowanieMagazynu==="priorytet") return priorytetDostepnosciProduktu(b).score-priorytetDostepnosciProduktu(a).score||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="wartosc") return ((sb||0)*kwotaNum(b.cena))-((sa||0)*kwotaNum(a.cena));
    if(sortowanieMagazynu==="dostepne") return (dostepneSztukiMagazynu(a,rez)??Number.MAX_SAFE_INTEGER)-(dostepneSztukiMagazynu(b,rez)??Number.MAX_SAFE_INTEGER);
    if(sortowanieMagazynu==="zakup") return Number(plan(b).ilosc||0)-Number(plan(a).ilosc||0);
    if(sortowanieMagazynu==="producent"){const rank={brak:0,niski:1,nieznany:2,blad:2,dostepny_nieznany:3,dostepny:4},ia=producentDostepnoscInfo(a),ib=producentDostepnoscInfo(b);return (rank[ia.status]??5)-(rank[ib.status]??5)||(ia.quantity??Number.MAX_SAFE_INTEGER)-(ib.quantity??Number.MAX_SAFE_INTEGER)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");}
    const supplierRank={brak:0,niski:1,nieznany:2,blad:2,dostepny_nieznany:3,dostepny:4},ia=producentDostepnoscInfo(a),ib=producentDostepnoscInfo(b),supplierDiff=(supplierRank[ia.status]??5)-(supplierRank[ib.status]??5);
    if(supplierDiff)return supplierDiff;
    const planDiff=Number(plan(b).ilosc||0)-Number(plan(a).ilosc||0);if(planDiff)return planDiff;
    const priorityDiff=priorytetDostepnosciProduktu(b).score-priorytetDostepnosciProduktu(a).score;if(priorityDiff)return priorityDiff;
    const ra=sa===null?999999:(sa===0?0:(sa<=prog?sa:100000+sa));
    const rb=sb===null?999999:(sb===0?0:(sb<=prog?sb:100000+sb));
    return ra-rb || String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
  });
}
function stanBadgeMagazynu(stan, prog){
  if(stan===null) return `<span class="lvl lvl-info">bez limitu</span>`;
  if(stan===0) return `<span class="lvl lvl-blad">brak</span>`;
  if(stan<=prog) return `<span class="lvl lvl-ostrzezenie">niski</span>`;
  return `<span class="lvl lvl-ok">OK</span>`;
}
function ustawFiltrMagazynu(filtr, sort="ryzyko"){
  frazaMagazynu="";
  filtrMagazynu=filtr||"wszystkie";
  sortowanieMagazynu=sort||"ryzyko";
  stronaMagazynu=1;
  renderuj();
}
function wyczyscFiltryStanowMagazynu(){
  frazaMagazynu="";filtrMagazynu="wszystkie";filtrDostawcyMagazynu="wszyscy";filtrLokalizacjiMagazynu="wszystkie";filtrInwentaryzacjiMagazynu="wszystkie";sortowanieMagazynu="ryzyko";stronaMagazynu=1;renderuj();
}
function ustawStroneMagazynu(n){ stronaMagazynu=Math.max(1,Number(n)||1); renderuj(); }
function ustawMagazynNaStronie(n){
  magazynNaStronie=[25,50,100,200,500].includes(Number(n))?Number(n):50;
  stronaMagazynu=1; zapiszLS("artway_magazyn_na_stronie",magazynNaStronie); renderuj();
}
function korygujStanMagazynu(e,id){
  e.preventDefault();
  const f=new FormData(e.target), stan=String(f.get("stan")??"").trim(), powod=String(f.get("powod")||"").trim()||"Korekta z panelu magazynu";
  const wynik=ustawStanMagazynowy(id, stan, {typ:"korekta",powod});
  loguj("info",`Magazyn: korekta ${id}, ${wynik.przed===null?"∞":wynik.przed} → ${wynik.po===null?"∞":wynik.po}`);
  toast("Korekta magazynu zapisana ✅"); renderuj();
}
function szybkaKorektaMagazynu(id, delta){
  const przed=stanMagazynuId(id);
  if(przed===null){ toast("Najpierw wpisz konkretny stan — produkt jest bez limitu"); return; }
  ustawStanMagazynowy(id, Math.max(0,przed+Number(delta||0)), {typ:Number(delta)>0?"przyjęcie":"korekta",powod:Number(delta)>0?"Szybkie przyjęcie":"Szybkie zmniejszenie"});
  toast(`Stan zmieniony: ${przed} → ${Math.max(0,przed+Number(delta||0))}`);renderuj();
}
function zapiszUstawieniaMagazynu(e){
  e.preventDefault();
  const f=new FormData(e.target);
  ustawieniaMagazynu={
    ...ustawieniaMagazynu,
    nazwa:String(f.get("nazwa")||"Magazyn główny").trim()||"Magazyn główny",
    progNiski:Math.max(0,parseInt(f.get("progNiski"),10)||5),
    lokalizacja:String(f.get("lokalizacja")||"").trim(),
    domyslnyOperator:String(f.get("operator")||sesja?.email||"administrator").trim(),
    domyslnyDostawca:String(f.get("domyslnyDostawca")||"").trim(),
    domyslnyLeadTime:Math.max(0,parseInt(f.get("domyslnyLeadTime"),10)||7),
    domyslnyZapasDni:Math.max(7,parseInt(f.get("domyslnyZapasDni"),10)||21),
    progNiskiProducenta:Math.max(1,parseInt(f.get("progNiskiProducenta"),10)||50),
    producentProbka:Math.max(1,Math.min(25,parseInt(f.get("producentProbka"),10)||8)),
    producentMaxWiekGodz:Math.max(1,parseInt(f.get("producentMaxWiekGodz"),10)||48)
  };
  zapiszLS("artway_magazyn_ustawienia",ustawieniaMagazynu);
  if(chmuraToken)void chmuraZapiszUstawienia();
  loguj("info","Zapisano ustawienia magazynu");
  toast("Ustawienia magazynu zapisane ✅"); renderuj();
}
function magazynUstawZaznaczenie(zakres,zaznacz=true){
  const ids=zakres==="strona"?magazynStronaIds:zakres==="filtr"?magazynWynikiIds:Array.isArray(zakres)?zakres:[];
  ids.forEach(id=>zaznacz?zaznaczoneMagazynProdukty.add(String(id)):zaznaczoneMagazynProdukty.delete(String(id)));renderuj();
}
function magazynWyczyscZaznaczenie(){zaznaczoneMagazynProdukty.clear();renderuj();}
function eksportujMagazynCSV(ids=null,nazwa="magazyn-artway.csv"){
  const rez=rezerwacjeMagazynowe(), spr=sprzedazMagazynowa(30);
  const wybrane=Array.isArray(ids)?new Set(ids.map(String)):null;
  const rows=[["id","sku","nazwa","kategoria","producent","url_zrodlowy","status_u_producenta","stan_u_producenta","stan_producenta_dokladny","sprawdzono_u_producenta","stan_lokalny","bez_limitu","dostepne_po_rezerwacjach","zarezerwowane","sprzedaz_30_dni","min_stock","target_stock","lead_time_dni","lokalizacja","dostawca","kod","sugerowany_zakup","cena_brutto","wartosc_stanu"].join(";")];
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&(!wybrane||wybrane.has(String(p.id)))).forEach(p=>{
    const stan=stanMagazynuId(p.id), plan=sugestiaZatowarowania(p,rez,spr), meta=magazynMetaProduktu(p.id), wart=stan===null?"":kwotaNum(stan*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    const prod=producentDostepnoscInfo(p);rows.push([p.id,p.sku||"",p.nazwa,p.kategoria,p.producent||p.marka||"",prod.url,prod.status,prod.quantity??"",prod.exact?"tak":"nie",prod.checked,stan===null?"":stan,stan===null?"tak":"nie",plan.dostepne===null?"":plan.dostepne,rez[p.id]||0,spr[p.id]||0,plan.min,plan.target,plan.lead,meta.lokalizacja||"",meta.dostawca||"",meta.kod||"",plan.ilosc||0,kwotaNum(p.cena).toFixed(2).replace(".",","),wart].map(csvPole).join(";"));
  });
  if(rows.length===1){toast("Brak produktów do eksportu");return;}
  pobierzPlik(nazwa,"\uFEFF"+rows.join("\n"),"text/csv");
  loguj("info",`Wyeksportowano magazyn CSV (${rows.length-1} produktów)`);toast(`Wyeksportowano ${rows.length-1} produktów magazynowych ✅`);
}
function magazynEksportuj(zakres){
  const ids=zakres==="zaznaczone"?[...zaznaczoneMagazynProdukty]:magazynWynikiIds;
  eksportujMagazynCSV(ids,zakres==="zaznaczone"?"magazyn-zaznaczone.csv":"magazyn-filtrowany.csv");
}
function eksportujZatowarowanieCSV(){
  const plan=potrzebyZatowarowania();
  const rows=[["id","sku","nazwa","kategoria","dostawca","lokalizacja","stan","dostepne_po_rezerwacjach","sprzedaz_30_dni","min_stock","target_stock","lead_time_dni","sugerowana_ilosc","cena_brutto","szacowana_wartosc"].join(";")];
  plan.forEach(x=>{
    const p=x.produkt, meta=x.meta, wart=kwotaNum((x.ilosc||0)*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    rows.push([p.id,p.sku||"",p.nazwa,p.kategoria,meta.dostawca||"",meta.lokalizacja||"",x.stan===null?"":x.stan,x.dostepne===null?"":x.dostepne,x.sprzedaz30,x.min,x.target,x.lead,x.ilosc,kwotaNum(p.cena).toFixed(2).replace(".",","),wart].map(csvPole).join(";"));
  });
  pobierzPlik("zatowarowanie-artway.csv","\uFEFF"+rows.join("\n"),"text/csv");
  zapiszHistorieAgenta("zatowarowanie","Wyeksportowano plan zatowarowania",{pozycji:plan.length});
  loguj("info","Wyeksportowano plan zatowarowania CSV");
}
function wypelnijDomyslnaKartotekeMagazynu(){
  const u=ustawieniaMagazynuPelne();
  if(!u.domyslnyDostawca&&!u.lokalizacja){ toast("Najpierw wpisz domyślnego dostawcę lub lokalizację w ustawieniach magazynu"); return; }
  if(!confirm("Uzupełnić brakujące pola kartoteki domyślnym dostawcą/lokalizacją? Istniejących wartości nie nadpiszę.")) return;
  let ile=0;
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    const m=magazynMetaProduktu(p.id);
    if((u.domyslnyDostawca&&!m.dostawca)||(u.lokalizacja&&!m.lokalizacja)){
      zapiszMagazynMeta(p.id,{...m,dostawca:m.dostawca||u.domyslnyDostawca,lokalizacja:m.lokalizacja||u.lokalizacja});
      ile++;
    }
  });
  zapiszHistorieAgenta("kartoteka",`Uzupełniono domyślne dane kartoteki dla ${ile} produktów`,{produkty:ile});
  toast(`Uzupełniono kartotekę: ${ile} produktów ✅`);
  renderuj();
}
function audytMagazynuAI(){
  const plan=potrzebyZatowarowania(), rez=rezerwacjeMagazynowe(), wszystkie=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const brakLok=wszystkie.filter(p=>!magazynMetaProduktu(p.id).lokalizacja).length;
  const brakDos=wszystkie.filter(p=>!magazynMetaProduktu(p.id).dostawca).length;
  const nad=wszystkie.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;}).length;
  const rec=zapiszHistorieAgenta("audyt","Utworzono audyt magazynu",{produkty:wszystkie.length,doZamowienia:plan.length,brakLokalizacji:brakLok,brakDostawcy:brakDos,nadrezerwacje:nad});
  pobierzPlik("audyt-magazynu-agent-ai.json",JSON.stringify(rec,null,2),"application/json");
  toast("Audyt magazynu zapisany i pobrany ✅");
  renderuj();
}
function daneSzkicuFakturyZamowienia(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr); if(!z) return null;
  const k=z.klient||{}, a=z.adresDostawy||{}, koszty=kosztyZamowienia(z);
  const kontrahent={
    nazwa:k.firma||`${k.imie||""} ${k.nazwisko||""}`.trim()||z.email||"Klient",
    nip:String(k.nip||"").replace(/[^0-9]/g,""),
    email:z.email||"",
    telefon:k.telefon||"",
    adres:[a.ulica&&`${a.ulica} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`,[a.kod,a.miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ")||z.adres||""
  };
  const pozycje=pozycjeZamowieniaMagazyn(z).map(p=>({nazwa:p.nazwa,sku:p.sku||"",ilosc:p.ilosc,cenaBrutto:kwotaNum(p.cena),wartoscBrutto:kwotaNum(p.wartosc),vat:"23%"}));
  if(koszty.dostawa||koszty.paczkaWeekend||koszty.platnosc){
    pozycje.push({nazwa:"Dostawa i usługi dodatkowe",sku:"DOSTAWA",ilosc:1,cenaBrutto:kwotaNum(koszty.dostawa+koszty.paczkaWeekend+koszty.platnosc),wartoscBrutto:kwotaNum(koszty.dostawa+koszty.paczkaWeekend+koszty.platnosc),vat:"23%"});
  }
  return {
    id:"FV-SZKIC-"+Date.now().toString(36),
    provider:"inFakt",
    status:"szkic",
    apiStatus:"nie wysłano",
    nrZamowienia:z.nr,
    data:new Date().toISOString(),
    dataTxt:new Date().toLocaleString("pl-PL"),
    sprzedawca:daneFirmy(),
    kontrahent,
    pozycje,
    sumaBrutto:kwotaNum(koszty.razem),
    waluta:"PLN",
    uwagi:"Szkic przygotowany w panelu Artway-TM. Wysyłka do inFakt będzie aktywna po podłączeniu tokenu API."
  };
}
function utworzSzkicFaktury(nr){
  const szkic=daneSzkicuFakturyZamowienia(nr);
  if(!szkic){ toast("Nie znaleziono zamówienia"); return; }
  szkiceFaktur=[szkic,...szkiceFaktur.filter(x=>x.nrZamowienia!==nr)].slice(0,2000);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  loguj("info","Utworzono szkic FV pod inFakt dla "+nr);
  toast("Szkic faktury przygotowany ✅"); renderuj();
}
function usunSzkicFaktury(id){
  szkiceFaktur=szkiceFaktur.filter(x=>x.id!==id);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  toast("Szkic FV usunięty"); renderuj();
}
function zmienStatusSzkicuFaktury(id,status){
  szkiceFaktur=szkiceFaktur.map(x=>x.id===id?{...x,status,aktualizacja:new Date().toISOString()}:x);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  toast("Status szkicu FV zapisany"); renderuj();
}
function eksportujSzkiceFakturJSON(){
  pobierzPlik("szkice-faktur-infakt.json",JSON.stringify(szkiceFaktur,null,2),"application/json");
}
async function infaktLaduj(cicho=false,pobierzFaktury=false){
  if(infaktStan.ladowanie)return;infaktStan={...infaktStan,ladowanie:true};
  try{
    const d=await chmura("infakt-status",{params:{verify:1},timeout:30000});
    infaktStan={...infaktStan,...(d.config||{}),sprawdzono:true,ladowanie:false,connected:d.connection?.ok===true,connection:d.connection||null,links:d.links||{},suppliers:d.suppliers||infaktStan.suppliers||{items:[]},purchaseSync:d.purchaseSync||infaktStan.purchaseSync||{pendingItems:[],recentMatches:[]},updated_at:d.updated_at||null,error:d.connection?.ok===false?d.connection.error||"Błąd połączenia":""};
    if(pobierzFaktury&&infaktStan.configured){const f=await chmura("infakt-invoices",{params:{limit:infaktLimit,offset:0},timeout:45000});infaktFaktury=Array.isArray(f.invoices)?f.invoices:[];infaktStan={...infaktStan,invoicesLoaded:true,metainfo:f.metainfo||{}};}
    if(!cicho)toast(infaktStan.connected?"Połączenie z inFakt działa ✅":infaktStan.configured?"⚠️ Klucz inFakt wymaga sprawdzenia":"Dodaj klucz API inFakt po stronie serwera");
  }catch(e){infaktStan={...infaktStan,sprawdzono:true,ladowanie:false,connected:false,error:e.message||String(e)};if(!cicho)toast("⚠️ inFakt: "+infaktStan.error);}
  renderuj();
}
async function infaktUtworzFakture(orderNumber){
  try{toast("Przekazuję fakturę klienta do inFakt…");const d=await chmura("infakt-create-invoice",{method:"POST",body:{orderNumber},timeout:60000});if(d.link)infaktStan.links={...(infaktStan.links||{}),[orderNumber]:d.link};toast(d.duplicatePrevented?"Faktura dla tego zamówienia już istnieje — nie utworzono duplikatu":`Zadanie inFakt przyjęte: ${d.link?.taskReference||"oczekuje"}`);renderuj();}catch(e){toast("⚠️ Wystawianie inFakt: "+(e.message||e));}
}
async function infaktLadujKoszty(cicho=false){
  if(infaktStan.costsLoading)return;infaktStan={...infaktStan,costsLoading:true};
  try{const d=await chmura("infakt-costs",{params:{limit:200},timeout:60000});infaktKoszty=Array.isArray(d.costs)?d.costs:[];infaktStan={...infaktStan,costsLoaded:true,costsLoading:false,suppliers:d.suppliers||infaktStan.suppliers,purchaseSync:d.purchaseSync||infaktStan.purchaseSync};if(!cicho)toast(`Pobrano ${infaktKoszty.length} faktur wyłącznie z białej listy dostawców`);}catch(e){infaktStan={...infaktStan,costsLoaded:true,costsLoading:false};if(!cicho)toast("⚠️ Faktury dostawców: "+(e.message||e));}renderuj();
}
async function infaktSynchronizujCenyZakupu(force=false){
  if(infaktStan.purchaseLoading)return;if(force&&!confirm("Ponownie przeanalizować faktury i nadpisać ceny danymi z najnowszych dokumentów?"))return;infaktStan={...infaktStan,purchaseLoading:true};renderuj();
  try{toast("Analizuję pozycje faktur dostawców i dopasowuję ceny zakupu…");const d=await chmura("infakt-purchase-sync",{method:"POST",body:{days:infaktOkresCenZakupu,limit:50,force},timeout:120000});infaktStan={...infaktStan,purchaseLoading:false,purchaseSync:d.purchaseSync||{pendingItems:[],recentMatches:[]}};await chmuraPobierzWszystko();const s=infaktStan.purchaseSync||{};toast(s.available===false?`⚠️ Ceny zakupu: ${s.errors?.[0]||"źródło pozycji faktur jest niedostępne"}`:`✅ Ceny zakupu: zaktualizowano ${s.priceUpdatedCount||0} • oczekuje ${s.pendingCount||0}`);}catch(e){infaktStan={...infaktStan,purchaseLoading:false};toast("⚠️ Ceny zakupu z faktur: "+(e.message||e));}renderuj();
}
function infaktProduktPoReferencji(value=""){
  const raw=String(value||"").trim(),id=raw.split(/\s*[•|]\s*/)[0].trim(),key=raw.toLowerCase().replace(/[^a-z0-9]/g,"");
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).find(p=>String(p.id)===id)||produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).find(p=>[p.gtin,p.ean,p.sku,p.externalId,p.kodProducenta,p.mpn].some(x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"")===key));
}
async function infaktPrzypiszCeneZakupu(itemKey){
  const input=document.querySelector(`[data-infakt-purchase-item="${CSS.escape(String(itemKey))}"]`),produkt=infaktProduktPoReferencji(input?.value||"");if(!produkt){toast("Wybierz produkt z listy albo wpisz dokładne ID, SKU lub EAN");return;}
  try{const d=await chmura("infakt-purchase-match",{method:"POST",body:{itemKey,productId:produkt.id},timeout:60000});infaktStan={...infaktStan,purchaseSync:d.sync||infaktStan.purchaseSync};await chmuraPobierzWszystko();toast(`✅ ${d.product?.name||produkt.nazwa}: cena zakupu ${zl(d.product?.cenaZakupu||0)}`);renderuj();}catch(e){toast("⚠️ Dopasowanie pozycji: "+(e.message||e));}
}
async function infaktCofnijDopasowanie(matchId){
  try{
    const d=await chmura("infakt-purchase-unmatch",{method:"POST",body:{matchId},timeout:60000});
    infaktStan={...infaktStan,purchaseSync:d.sync||infaktStan.purchaseSync};await chmuraPobierzWszystko();
    toast(d.restored===null?`↩️ Cofnięto dopasowanie ${d.product?.name||"produktu"} i usunięto błędną cenę`:`↩️ Cofnięto dopasowanie ${d.product?.name||"produktu"}; przywrócono ${zl(d.restored)}`);
    if(d.requiresResync)await infaktSynchronizujCenyZakupu(true);else renderuj();
  }catch(e){toast("⚠️ Nie cofnięto dopasowania: "+(e.message||e));}
}
function infaktWyczyscFiltryZakupow(){szukajInfaktZakupy="";filtrInfaktZakupy="wszystkie";limitInfaktZakupy=50;renderuj();}
function infaktWyczyscFiltryHistorii(){szukajInfaktHistoria="";filtrInfaktHistoria="aktywne";limitInfaktHistoria=50;renderuj();}
async function infaktZapiszDostawcow(){
  const rows=[...document.querySelectorAll("[data-infakt-supplier]")],items=rows.filter(r=>r.querySelector('input[type="checkbox"]')?.checked).map(r=>({id:r.dataset.id,name:r.dataset.name,sellerName:String(r.querySelector('input[type="text"]')?.value||"").trim(),active:true})).filter(x=>x.sellerName);
  try{const d=await chmura("infakt-supplier-access",{method:"POST",body:{items},timeout:20000});infaktStan={...infaktStan,suppliers:d.suppliers||{items},costsLoaded:false};infaktKoszty=[];toast(`Biała lista zapisana • ${items.length} dostawców`);renderuj();}catch(e){toast("⚠️ Biała lista inFakt: "+(e.message||e));}
}
async function infaktSynchronizuj(){
  try{toast("Sprawdzam zadania, faktury i ceny zakupu inFakt…");const d=await chmura("infakt-sync",{method:"POST",body:{},timeout:120000});infaktStan.links=d.links||infaktStan.links;if(d.purchaseSync)infaktStan.purchaseSync=d.purchaseSync;await infaktLaduj(true,true);await chmuraPobierzWszystko();toast(`inFakt zsynchronizowany • zadania ${d.results?.length||0} • nowe ceny ${d.purchaseSync?.priceUpdatedCount||0}`);}catch(e){toast("⚠️ Synchronizacja inFakt: "+(e.message||e));}
}
function infaktStatusLinkuHTML(link={}){const s=String(link.status||"brak");return s==="created"?`<span class="lvl lvl-ok">wystawiona ${esc(link.invoiceNumber||"")}</span>`:s==="processing"?`<span class="lvl lvl-info">przetwarzanie</span>`:s==="error"?`<span class="lvl lvl-blad">błąd</span>`:`<span class="lvl lvl-ostrzezenie">brak faktury</span>`;}
function infaktKwota(v){return zl((Number(v)||0)/100);}
function infaktSzukajZakupy(input,history=false){
  const value=String(input?.value||"");if(history)szukajInfaktHistoria=value;else szukajInfaktZakupy=value;
  const id=history?"infaktHistorySearch":"infaktPendingSearch";clearTimeout(window.__infaktPurchaseSearch);window.__infaktPurchaseSearch=setTimeout(()=>{renderuj();requestAnimationFrame(()=>{const el=document.getElementById(id);if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}});},180);
}
let infaktPendingWyniki=[],infaktHistoriaWyniki=[];
function infaktUstawZaznaczenie(rodzaj,ids,zaznacz=true){
  const set=rodzaj==="historia"?zaznaczoneInfaktHistoria:zaznaczoneInfaktZakupy;
  (Array.isArray(ids)?ids:[]).forEach(id=>zaznacz?set.add(String(id)):set.delete(String(id)));renderuj();
}
function infaktZaznaczZakres(rodzaj,zakres){
  const rows=rodzaj==="historia"?infaktHistoriaWyniki:infaktPendingWyniki,limit=rodzaj==="historia"?limitInfaktHistoria:limitInfaktZakupy;
  const ids=(zakres==="strona"?rows.slice(0,limit):rows).map(x=>rodzaj==="historia"?String(x.matchId||x.itemKey):String(x.itemKey));infaktUstawZaznaczenie(rodzaj,ids,true);
}
function infaktWyczyscZaznaczenie(rodzaj){(rodzaj==="historia"?zaznaczoneInfaktHistoria:zaznaczoneInfaktZakupy).clear();renderuj();}
function infaktEksportujZakres(rodzaj,zakres="filtr"){
  const rows=rodzaj==="historia"?infaktHistoriaWyniki:infaktPendingWyniki,set=rodzaj==="historia"?zaznaczoneInfaktHistoria:zaznaczoneInfaktZakupy;
  const lista=rows.filter(x=>zakres!=="zaznaczone"||set.has(rodzaj==="historia"?String(x.matchId||x.itemKey):String(x.itemKey)));
  if(rodzaj==="historia")return adminEksportujCSV(zakres==="zaznaczone"?"infakt-historia-zaznaczone.csv":"infakt-historia-filtrowana.csv",["data_faktury","produkt_id","produkt","cena_zakupu","faktura","dostawca","metoda","status"],lista.map(x=>[x.invoiceDate||"",x.productId||"",x.productName||"",x.price||0,x.invoiceNumber||"",x.supplier||"",x.method||"",x.status||"active"]));
  adminEksportujCSV(zakres==="zaznaczone"?"infakt-pozycje-zaznaczone.csv":"infakt-pozycje-filtrowane.csv",["faktura","data","dostawca","ean","kod","pozycja","ilosc","cena_netto","cena_brutto","powod"],lista.map(x=>[x.invoiceNumber||"",x.invoiceDate||"",x.supplier||"",x.ean||"",x.code||"",x.name||"",x.quantity||"",x.unitNet||0,x.unitGross||0,x.reason||""]));
}
function infaktCenyZakupuPanelHTML(){
  const s=infaktStan.purchaseSync||{},pendingAll=Array.isArray(s.pendingItems)?s.pendingItems:[],matchesAll=Array.isArray(s.recentMatches)?s.recentMatches:[],products=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const q=normalizujSzukanyTekst(szukajInfaktZakupy),terms=q.split(" ").filter(Boolean);
  const pending=pendingAll.filter(item=>{
    const text=normalizujSzukanyTekst([item.invoiceNumber,item.invoiceDate,item.supplier,item.ean,item.code,item.name,item.reason,item.unitGross].join(" "));
    if(terms.some(term=>!text.includes(term)))return false;
    if(filtrInfaktZakupy==="bez_kodu"&&(item.ean||item.code))return false;
    if(filtrInfaktZakupy==="konflikty"&&!/kilku|konflikt/i.test(item.reason||""))return false;
    if(filtrInfaktZakupy==="sugestie"&&!(item.suggestions||[]).length)return false;
    return true;
  });
  const hq=normalizujSzukanyTekst(szukajInfaktHistoria),hterms=hq.split(" ").filter(Boolean);
  const matches=matchesAll.filter(item=>{
    const reverted=item.status==="reverted",manual=String(item.method||"").includes("ręczne"),text=normalizujSzukanyTekst([item.productName,item.productId,item.invoiceNumber,item.invoiceDate,item.supplier,item.method,item.price].join(" "));
    if(hterms.some(term=>!text.includes(term)))return false;
    if(filtrInfaktHistoria==="aktywne"&&reverted)return false;if(filtrInfaktHistoria==="cofniete"&&!reverted)return false;if(filtrInfaktHistoria==="reczne"&&!manual)return false;if(filtrInfaktHistoria==="automatyczne"&&(manual||reverted))return false;
    return true;
  });
  infaktPendingWyniki=pending;infaktHistoriaWyniki=matches;
  const pendingFields=`<label class="search-wide">Pozycja faktury<input id="infaktPendingSearch" value="${esc(szukajInfaktZakupy)}" placeholder="Faktura, dostawca, EAN, kod, nazwa lub cena…" oninput="infaktSzukajZakupy(this)" autocomplete="off"></label><label>Powód decyzji<select onchange="filtrInfaktZakupy=this.value;renderuj()"><option value="wszystkie" ${filtrInfaktZakupy==="wszystkie"?"selected":""}>Wszystkie oczekujące</option><option value="bez_kodu" ${filtrInfaktZakupy==="bez_kodu"?"selected":""}>Bez EAN i kodu</option><option value="konflikty" ${filtrInfaktZakupy==="konflikty"?"selected":""}>Konflikty identyfikatorów</option><option value="sugestie" ${filtrInfaktZakupy==="sugestie"?"selected":""}>Z sugestiami agenta</option></select></label><label>Na stronie<select onchange="limitInfaktZakupy=Number(this.value)||50;renderuj()">${[25,50,100,250].map(n=>`<option value="${n}" ${limitInfaktZakupy===n?"selected":""}>${n}</option>`).join("")}</select></label><button class="btn ghost" type="button" onclick="infaktWyczyscFiltryZakupow()">Wyczyść filtry</button>`;
  const historyFields=`<label class="search-wide">Historia dopasowań<input id="infaktHistorySearch" value="${esc(szukajInfaktHistoria)}" placeholder="Produkt, ID, faktura, dostawca, metoda lub cena…" oninput="infaktSzukajZakupy(this,true)" autocomplete="off"></label><label>Status<select onchange="filtrInfaktHistoria=this.value;renderuj()"><option value="aktywne" ${filtrInfaktHistoria==="aktywne"?"selected":""}>Aktywne dopasowania</option><option value="wszystkie" ${filtrInfaktHistoria==="wszystkie"?"selected":""}>Cała historia</option><option value="reczne" ${filtrInfaktHistoria==="reczne"?"selected":""}>Tylko ręczne</option><option value="automatyczne" ${filtrInfaktHistoria==="automatyczne"?"selected":""}>Tylko automatyczne</option><option value="cofniete" ${filtrInfaktHistoria==="cofniete"?"selected":""}>Cofnięte</option></select></label><label>Na stronie<select onchange="limitInfaktHistoria=Number(this.value)||50;renderuj()">${[25,50,100,250].map(n=>`<option value="${n}" ${limitInfaktHistoria===n?"selected":""}>${n}</option>`).join("")}</select></label><button class="btn ghost" type="button" onclick="infaktWyczyscFiltryHistorii()">Wyczyść filtry</button>`;
  return `<section class="infakt-purchase-sync"><div class="order-section-head"><div><span class="order-pro-label">Automatyczna kartoteka kosztowa</span><h2>💰 Ceny zakupu z faktur dostawców</h2><p class="order-detail-lead">Najpierw EAN/GTIN, potem dokładny kod producenta lub SKU, a na końcu identyczna i unikalna nazwa. Niepewne pozycje zawsze czekają na decyzję administratora.</p></div><div class="diag-actions"><label>Okres <select onchange="infaktOkresCenZakupu=Number(this.value)||180">${[[30,"30 dni"],[90,"90 dni"],[180,"180 dni"],[365,"rok"],[730,"2 lata"]].map(([v,l])=>`<option value="${v}" ${infaktOkresCenZakupu===v?"selected":""}>${l}</option>`).join("")}</select></label><button class="btn" onclick="infaktSynchronizujCenyZakupu(false)" ${infaktStan.purchaseLoading?"disabled":""}>${infaktStan.purchaseLoading?"⏳ Analizuję…":"🔄 Pobierz i dopasuj ceny"}</button></div></div>
  <div class="orders-stat-grid"><div class="order-stat-card"><span>🧾</span><b>${s.allowedDocuments||0}</b><small>faktur dostawców</small></div><div class="order-stat-card"><span>📋</span><b>${s.lineCount||0}</b><small>pozycji</small></div><div class="order-stat-card money"><span>✅</span><b>${s.matchedCount||0}</b><small>dopasowanych</small></div><div class="order-stat-card money"><span>💰</span><b>${s.priceUpdatedCount||0}</b><small>zmienionych cen</small></div><div class="order-stat-card ${pendingAll.length?"hot":""}"><span>🔎</span><b>${pendingAll.length}</b><small>do decyzji</small></div></div>
  ${s.updated_at?`<div class="backend-note"><b>Ostatnia kontrola:</b> ${esc(allegroDataTxt(s.updated_at))} • ${esc(s.source||"inFakt KSeF XML")} • starsza faktura nie nadpisuje nowszej ceny.</div>`:`<div class="backend-note">Pierwszą synchronizację uruchom przyciskiem. Kolejne kontrole wykonuje serwer.</div>`}${s.available===false||s.errors?.length?`<div class="backend-note infakt-purchase-error"><b>Wymaga uwagi:</b> ${esc((s.errors||[]).join(" • ")||"Odczyt pozycji KSeF jest niedostępny.")}</div>`:""}
  <div class="order-section-head"><div><h3>🔎 Pozycje wymagające decyzji</h3><p class="order-detail-lead">Przed zatwierdzeniem możesz przeszukać całą kartotekę. Błędne powiązanie da się później cofnąć z historii.</p></div></div>
  ${adminWyszukiwaniePanelHTML({id:"infakt-pending",description:"Faktura, identyfikatory, dostawca i powód braku automatycznego dopasowania.",fields:pendingFields,results:pending.length,active:!!(szukajInfaktZakupy||filtrInfaktZakupy!=="wszystkie"),open:true,actions:adminOperacjeWynikowHTML({id:"infakt-pending",selected:zaznaczoneInfaktZakupy.size,pageCount:Math.min(limitInfaktZakupy,pending.length),resultCount:pending.length,selectPage:"infaktZaznaczZakres('oczekujace','strona')",selectAll:"infaktZaznaczZakres('oczekujace','filtr')",clear:"infaktWyczyscZaznaczenie('oczekujace')",exportSelected:"infaktEksportujZakres('oczekujace','zaznaczone')",exportAll:"infaktEksportujZakres('oczekujace','filtr')"})})}
  <div class="admin-search-results-line"><span>Znaleziono <b>${pending.length}</b> z ${pendingAll.length} oczekujących pozycji</span><span>Pokazano do <b>${limitInfaktZakupy}</b></span></div>
  <datalist id="infaktProductChoices">${products.map(p=>`<option value="${esc(p.id)} • ${esc(p.sku||p.externalId||p.gtin||p.ean||"bez kodu")} • ${esc(p.nazwa||"Produkt")}"></option>`).join("")}</datalist>
  <div class="warehouse-worktable-wrap"><table class="log-table infakt-purchase-table"><tr><th>Wybór</th><th>Faktura / dostawca</th><th>EAN / kod</th><th>Pozycja</th><th>Ilość</th><th>Cena zakupu</th><th>Właściwy produkt</th></tr>${pending.slice(0,limitInfaktZakupy).map(item=>`<tr><td><input type="checkbox" aria-label="Zaznacz pozycję faktury" ${zaznaczoneInfaktZakupy.has(String(item.itemKey))?"checked":""} onchange="infaktUstawZaznaczenie('oczekujace',[${jsArg(item.itemKey)}],this.checked)"></td><td><b>${esc(item.invoiceNumber||"—")}</b><br><small>${esc(item.invoiceDate||"")} • ${esc(item.supplier||"")}</small></td><td><b>${esc(item.ean||"—")}</b><br><small>${esc(item.code||"—")}</small></td><td><b>${esc(item.name||"Pozycja")}</b><br><small>${esc(item.reason||"")}</small>${item.suggestions?.length?`<div class="infakt-suggestions">${item.suggestions.map(x=>`<button type="button" onclick="this.closest('tr').querySelector('[data-infakt-purchase-item]').value=${jsArg(`${x.id} • ${x.sku||x.ean||""} • ${x.name}`)}">${esc(x.name)} (${Math.round((x.score||0)*100)}%)</button>`).join("")}</div>`:""}</td><td>${esc(item.quantity||"—")} szt.</td><td><b>${zl(item.unitGross||0)}</b><br><small>netto ${zl(item.unitNet||0)}</small></td><td><div class="infakt-match-control"><input list="infaktProductChoices" data-infakt-purchase-item="${esc(item.itemKey)}" placeholder="ID, SKU, EAN lub nazwa"><button class="btn" onclick="infaktPrzypiszCeneZakupu(${jsArg(item.itemKey)})">Zatwierdź</button></div></td></tr>`).join("")||`<tr><td colspan="7">Brak pozycji pasujących do filtrów.</td></tr>`}</table></div>
  <details class="panel-subtle infakt-purchase-history" open><summary>🕓 Historia i korekty dopasowań (${matchesAll.length})</summary>${adminWyszukiwaniePanelHTML({id:"infakt-history",description:"Każda zmiana ma ślad audytowy. Cofnięcie przywraca poprzednią cenę i kieruje pozycję do ponownego wyboru.",fields:historyFields,results:matches.length,active:!!(szukajInfaktHistoria||filtrInfaktHistoria!=="aktywne"),open:false,actions:adminOperacjeWynikowHTML({id:"infakt-history",selected:zaznaczoneInfaktHistoria.size,pageCount:Math.min(limitInfaktHistoria,matches.length),resultCount:matches.length,selectPage:"infaktZaznaczZakres('historia','strona')",selectAll:"infaktZaznaczZakres('historia','filtr')",clear:"infaktWyczyscZaznaczenie('historia')",exportSelected:"infaktEksportujZakres('historia','zaznaczone')",exportAll:"infaktEksportujZakres('historia','filtr')"})})}<div class="warehouse-worktable-wrap"><table class="log-table"><tr><th>Wybór</th><th>Data faktury</th><th>Produkt</th><th>Cena</th><th>Dokument</th><th>Metoda / stan</th><th>Korekta</th></tr>${matches.slice(0,limitInfaktHistoria).map(x=>{const reverted=x.status==="reverted",canUndo=!reverted&&x.priceApplied!==false,key=String(x.matchId||x.itemKey);return `<tr class="${reverted?"infakt-match-reverted":""}"><td><input type="checkbox" aria-label="Zaznacz wpis historii" ${zaznaczoneInfaktHistoria.has(key)?"checked":""} onchange="infaktUstawZaznaczenie('historia',[${jsArg(key)}],this.checked)"></td><td>${esc(x.invoiceDate||"—")}</td><td><b>${esc(x.productName||x.productId||"Produkt")}</b><br><small>ID ${esc(x.productId||"—")}</small></td><td><b>${zl(x.price||0)}</b></td><td>${esc(x.invoiceNumber||"—")}<br><small>${esc(x.supplier||"")}</small></td><td><span class="lvl ${reverted?"lvl-ostrzezenie":"lvl-ok"}">${reverted?"cofnięte":esc(x.method||"kod")}</span>${x.revertedAt?`<br><small>${esc(allegroDataTxt(x.revertedAt))}</small>`:""}</td><td>${canUndo?`<button class="btn danger" onclick="infaktCofnijDopasowanie(${jsArg(x.matchId||x.itemKey)})">↩️ Cofnij i dopasuj ponownie</button>`:`<span class="lvl lvl-info">${reverted?"ślad zachowany":"cena bez zmiany"}</span>`}</td></tr>`;}).join("")||`<tr><td colspan="7">Brak dopasowań w tym filtrze.</td></tr>`}</table></div></details>
  <details class="panel-subtle allegro-info-bottom"><summary>⚙️ Operacja serwisowa</summary><p class="order-detail-lead">Ponowna analiza jest potrzebna po poprawieniu kodów w historycznej fakturze lub kartotece.</p><button class="btn danger" onclick="infaktSynchronizujCenyZakupu(true)">Ponownie przeanalizuj dokumenty</button></details></section>`;
}
function widokAdminInfakt(sekcja="pulpit"){
  const aktywna=["pulpit","zamowienia","faktury","dostawcy","szkice","ustawienia"].includes(sekcja)?sekcja:"pulpit";
  if((!infaktStan.sprawdzono||((aktywna==="faktury"||aktywna==="pulpit")&&infaktStan.configured&&!infaktStan.invoicesLoaded))&&!infaktStan.ladowanie)setTimeout(()=>infaktLaduj(true,aktywna==="faktury"||aktywna==="pulpit"),0);
  if(aktywna==="dostawcy"&&infaktStan.configured&&!infaktStan.costsLoaded&&!infaktStan.costsLoading&&!infaktStan.ladowanie)setTimeout(()=>infaktLadujKoszty(true),50);
  const orders=pobierzZamowienia().filter(z=>String(z.status||"")!=="anulowane").sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  const linked=infaktStan.links||{},company=orders.filter(z=>z.klient?.nip||z.klient?.firma),missing=company.filter(z=>!linked[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  const pending=Object.values(linked).filter(x=>x.status==="processing"),created=Object.values(linked).filter(x=>x.status==="created"),errors=Object.values(linked).filter(x=>x.status==="error");
  const query=String(szukajInfakt||"").toLowerCase().trim();let invoices=infaktFaktury.filter(f=>!query||`${f.number||""} ${f.client_company_name||""} ${f.client_first_name||""} ${f.client_last_name||""} ${f.client_tax_code||""}`.toLowerCase().includes(query));if(filtrInfakt!=="wszystkie")invoices=invoices.filter(f=>String(f.status||"")===filtrInfakt);
  const connection=infaktStan.connected?`<span class="lvl lvl-ok">API połączone • ${esc(infaktStan.env)}</span>`:infaktStan.configured?`<span class="lvl lvl-blad">błąd połączenia</span>`:`<span class="lvl lvl-ostrzezenie">brak INFAKT_API_KEY</span>`;
  const hero=`${infaktSubnavHTML(aktywna)}<div class="panel infakt-hero"><div class="order-section-head"><div><span class="order-pro-label">Wąski, kontrolowany dostęp API</span><h1>🧾 inFakt — sprzedaż i wybrani dostawcy</h1><p class="order-detail-lead">Sklep może wystawiać faktury VAT klientom oraz tylko odczytywać dokumenty kosztowe i pozycje KSeF dostawców z białej listy. Nie obsługuje księgowości, zapisu kosztów, rachunków bankowych ani konfiguracji KSeF.</p></div><div class="diag-actions">${connection}<button class="btn ghost" onclick="infaktLaduj(false,true)">↻ Sprawdź API</button>${infaktStan.configured?`<button class="btn" onclick="infaktSynchronizuj()">🔄 Synchronizuj faktury i ceny</button>`:""}</div></div>${aktywna==="pulpit"?`<div class="orders-stat-grid"><div class="order-stat-card ${missing.length?"hot":"money"}"><span>📦</span><b>${missing.length}</b><small>firmowych bez dokumentu</small></div><div class="order-stat-card"><span>⏳</span><b>${pending.length}</b><small>zadań w toku</small></div><div class="order-stat-card money"><span>✅</span><b>${created.length}</b><small>wystawionych</small></div><div class="order-stat-card"><span>🏭</span><b>${infaktStan.suppliers?.items?.length||0}</b><small>dozwolonych dostawców</small></div><div class="order-stat-card"><span>📥</span><b>${infaktKoszty.length}</b><small>pobranych faktur dostawców</small></div></div>`:""}</div>`;
  const orderRows=orders.filter(z=>{const text=`${z.nr||""} ${z.email||""} ${z.klient?.firma||""} ${z.klient?.nip||""}`.toLowerCase();return !query||text.includes(query);}).slice(0,200);
  const ordersPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>📦 Zamówienia do faktury</h2><p class="order-detail-lead">Jedyna operacja zapisu: utworzenie faktury VAT klienta z autorytatywnego zamówienia. Blokada idempotencji zapobiega podwójnej fakturze.</p></div><input placeholder="Szukaj numeru, klienta lub NIP…" value="${esc(szukajInfakt)}" oninput="szukajInfakt=this.value;zaplanujRenderPoWpisaniu()"></div><div class="infakt-order-list">${orderRows.map(z=>{const link=linked[z.nr],draft=szkiceFaktur.find(f=>f.nrZamowienia===z.nr),firm=!!(z.klient?.nip||z.klient?.firma);return `<article class="infakt-order-card"><div><b>${esc(z.nr)}</b><small>${esc(z.klient?.firma||z.email||"Klient")} ${z.klient?.nip?`• NIP ${esc(z.klient.nip)}`:""}</small><small>${esc(z.data||"")} • ${zl(kosztyZamowienia(z).razem)} • ${firm?"faktura firmowa":"osoba prywatna"}</small></div><div>${infaktStatusLinkuHTML(link||{})}${draft?` <span class="lvl lvl-info">szkic lokalny</span>`:""}</div><div class="diag-actions"><a class="btn ghost" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Zamówienie</a><button class="btn ghost" onclick="utworzSzkicFaktury(${jsArg(z.nr)})">${draft?"Odśwież szkic":"Szkic lokalny"}</button>${infaktStan.configured&&!link?`<button class="btn" onclick="infaktUtworzFakture(${jsArg(z.nr)})">Wystaw FV w inFakt</button>`:""}</div></article>`;}).join("")||`<div class="backend-note">Brak zamówień pasujących do wyszukiwania.</div>`}</div></div>`;
  const invoicesPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>🧾 Faktury sprzedaży utworzone przez sklep</h2><p class="order-detail-lead">Wyłącznie podgląd statusu dokumentów wystawionych z zamówień Artway-TM. Inne faktury z konta inFakt nie są zwracane do sklepu.</p></div><div class="diag-actions"><input placeholder="Numer, klient, NIP…" value="${esc(szukajInfakt)}" oninput="szukajInfakt=this.value;zaplanujRenderPoWpisaniu()"><select onchange="filtrInfakt=this.value;renderuj()">${[["wszystkie","Wszystkie"],["draft","Szkice"],["sent","Wysłane"],["printed","Wydrukowane"],["paid","Opłacone"]].map(([v,l])=>`<option value="${v}" ${filtrInfakt===v?"selected":""}>${l}</option>`).join("")}</select></div></div>${infaktStan.configured?`<div style="overflow:auto"><table class="log-table"><tr><th>Numer</th><th>Data</th><th>Kontrahent</th><th>Brutto</th><th>Status</th></tr>${invoices.map(f=>`<tr><td><b>${esc(f.number||"—")}</b><br><small>${esc(f.uuid||"")}</small></td><td>${esc(f.invoice_date||"—")}</td><td>${esc(f.client_company_name||`${f.client_first_name||""} ${f.client_last_name||""}`.trim()||"—")}<br><small>${esc(f.client_tax_code||"")}</small></td><td>${infaktKwota(f.gross_price)} ${esc(f.currency||"PLN")}</td><td><span class="lvl ${f.status==="paid"?"lvl-ok":"lvl-info"}">${esc(f.status||"—")}</span></td></tr>`).join("")||`<tr><td colspan="5">Brak faktur wystawionych przez sklep.</td></tr>`}</table></div>`:`<div class="backend-note">Integracja oczekuje na bezpieczny klucz serwerowy <b>INFAKT_API_KEY</b>.</div>`}</div>`;
  const draftsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>📝 Szkice robocze Artway-TM</h2><p class="order-detail-lead">Szkice można kontrolować przed wysłaniem. Usunięcie szkicu lokalnego nie usuwa dokumentu utworzonego już w inFakt.</p></div><button class="btn ghost" onclick="eksportujSzkiceFakturJSON()">Eksport JSON</button></div><div style="overflow:auto"><table class="log-table"><tr><th>Zamówienie</th><th>Kontrahent</th><th>Pozycje</th><th>Brutto</th><th>Status</th><th>Akcje</th></tr>${szkiceFaktur.map(f=>`<tr><td><b>${esc(f.nrZamowienia)}</b><br><small>${esc(f.dataTxt||"")}</small></td><td>${esc(f.kontrahent?.nazwa||"—")}<br><small>${esc(f.kontrahent?.nip||"")}</small></td><td>${esc(f.pozycje?.length||0)}</td><td>${zl(f.sumaBrutto)}</td><td>${infaktStatusLinkuHTML(linked[f.nrZamowienia]||{})}</td><td><button class="btn ghost" onclick="infaktUtworzFakture(${jsArg(f.nrZamowienia)})" ${infaktStan.configured&&!linked[f.nrZamowienia]?"":"disabled"}>Wyślij do inFakt</button><button class="btn danger" onclick="if(confirm('Usunąć tylko lokalny szkic?'))usunSzkicFaktury(${jsArg(f.id)})">Usuń szkic</button></td></tr>`).join("")||`<tr><td colspan="6">Brak szkiców.</td></tr>`}</table></div></div>`;
  const costsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>🏭 Faktury od wybranych dostawców</h2><p class="order-detail-lead">Serwer pobiera koszty wyłącznie do odczytu, a następnie ponownie filtruje je białą listą. Gdy lista jest pusta, nie ujawnia żadnego dokumentu.</p></div><button class="btn" onclick="infaktLadujKoszty()">↻ Pobierz dozwolone faktury</button></div>${infaktCenyZakupuPanelHTML()}${!(infaktStan.suppliers?.items?.length)?`<div class="backend-note"><b>Najpierw wybierz dostawców w ustawieniach.</b> Bez białej listy endpoint zwraca 0 dokumentów.</div>`:`<div style="overflow:auto"><table class="log-table"><tr><th>Data</th><th>Dostawca</th><th>Numer</th><th>Netto</th><th>VAT</th><th>Brutto</th><th>Status</th></tr>${infaktKoszty.map(k=>`<tr><td>${esc(k.issue_date||k.created_at?.slice(0,10)||"—")}</td><td><b>${esc(k.supplier?.name||k.seller_name||"—")}</b><br><small>${esc(k.seller_name||"")}</small></td><td>${esc(k.number||"—")}</td><td>${infaktKwota(k.net_price)}</td><td>${infaktKwota(k.tax_price)}</td><td><b>${infaktKwota(k.gross_price)} ${esc(k.currency||"PLN")}</b></td><td>${(k.statuses||[]).map(s=>`<span class="lvl lvl-info">${esc(s.name||s.symbol)}</span>`).join(" ")||"—"}</td></tr>`).join("")||`<tr><td colspan="7">Brak dokumentów pasujących do wybranych dostawców.</td></tr>`}</table></div>`}</div>`;
  const allowedMap=new Map((infaktStan.suppliers?.items||[]).map(x=>[String(x.id),x])),supplierRows=[...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>({id:String(p.id),name:p.name||p.nazwa||"Dostawca",sellerName:allowedMap.get(String(p.id))?.sellerName||p.name||p.nazwa||""})),...(infaktStan.suppliers?.items||[]).filter(x=>!(producenciKartoteka||[]).some(p=>String(p.id)===String(x.id)))];
  const settingsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>⚙️ Minimalny dostęp API</h2><p class="order-detail-lead">Klucz pozostaje wyłącznie na serwerze. Aplikacja korzysta tylko z trzech zakresów. Odczyt XML KSeF służy wyłącznie dopasowaniu pozycji zakupowych; sklep nie zapisuje kosztów i nie zmienia konfiguracji KSeF.</p></div>${connection}</div><div class="info-grid"><div class="info-card"><b>Dozwolone zakresy</b><p><code>api:costs:read</code><br><code>api:invoices:read</code><br><code>api:invoices:write</code></p></div><div class="info-card"><b>Zablokowane funkcje</b><p>zapis kosztów • księgowość • rachunki bankowe • zapis i konfiguracja KSeF</p></div><div class="info-card"><b>Środowisko</b><p>${esc(infaktStan.env||"production")}</p></div><div class="info-card"><b>Sekret serwera</b><p><code>INFAKT_API_KEY</code> — nigdy w HTML</p></div></div><div class="order-section-head"><div><h2>🏭 Biała lista dostawców</h2><p class="order-detail-lead">Zaznacz tylko firmy, których faktury zakupowe wolno pobierać. Pole po prawej musi odpowiadać nazwie sprzedawcy widocznej w inFakt.</p></div><button class="btn" onclick="infaktZapiszDostawcow()">💾 Zapisz białą listę</button></div><div class="infakt-supplier-access">${supplierRows.map(p=>{const a=allowedMap.get(String(p.id));return `<label class="info-card" data-infakt-supplier data-id="${esc(p.id)}" data-name="${esc(p.name)}"><span><input type="checkbox" ${a?"checked":""}> <b>${esc(p.name)}</b></span><input type="text" value="${esc(a?.sellerName||p.sellerName)}" placeholder="Nazwa sprzedawcy w inFakt"></label>`;}).join("")||`<div class="backend-note">Dodaj najpierw dostawców w kartotece producentów.</div>`}</div>${infaktStan.error?`<div class="backend-note" style="border-color:#fecaca;color:#991b1b"><b>Błąd:</b> ${esc(infaktStan.error)}</div>`:""}</div>`;
  const content=aktywna==="zamowienia"?ordersPanel:aktywna==="faktury"?invoicesPanel:aktywna==="dostawcy"?costsPanel:aktywna==="szkice"?draftsPanel:aktywna==="ustawienia"?settingsPanel:`${missing.length?ordersPanel:""}${costsPanel}`;
  return adminSzkielet("/admin/infakt",hero+content);
}
function magazynPlanZatowarowaniaHTML(){
  return `<section class="panel restock-plan-intro"><div class="order-section-head"><div><span class="order-pro-label">Plan → szkic → zatwierdzenie → wysyłka → przyjęcie</span><h2>📦 Plan zatowarowania</h2><p class="order-detail-lead">Jedna kolejka łączy realne braki do aktywnych zamówień z bieżącymi szkicami Alexander, Multigra i pozostałych producentów. Tutaj dodajesz pozycje ręcznie, zmieniasz ilości, kontrolujesz bezcenowy e-mail i plik Optimy oraz przyjmujesz faktyczną dostawę wraz z nadwyżką.</p></div><div class="diag-actions"><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()">↻ Uzgodnij szkice z brakami</button></div></div><div class="supplier-plan-guardrails"><span><b>1. Braki</b><small>tylko aktywne zamówienia</small></span><span><b>2. Szkic</b><small>jeden bieżący na producenta</small></span><span><b>3. Zatwierdzenie</b><small>konkretna rewizja</small></span><span><b>4. E-mail</b><small>wyłącznie po potwierdzeniu</small></span><span><b>5. Przyjęcie</b><small>stan rośnie o realną dostawę</small></span></div></section>${magazynTabelaOperacyjnaHTML()}`;
}
function odswiezPlanZatowarowaniaWidoku(){
  const root=document.getElementById("warehouseRestockWorkspace");if(!root||typeof magazynTabelaOperacyjnaHTML!=="function")return false;
  const aktywny=document.activeElement,focusId=aktywny&&root.contains(aktywny)?String(aktywny.id||""):"",start=typeof aktywny?.selectionStart==="number"?aktywny.selectionStart:null,end=typeof aktywny?.selectionEnd==="number"?aktywny.selectionEnd:null;
  root.innerHTML=magazynPlanZatowarowaniaHTML();
  if(focusId){const nastepny=document.getElementById(focusId);if(nastepny){nastepny.focus({preventScroll:true});if(start!==null&&typeof nastepny.setSelectionRange==="function")nastepny.setSelectionRange(start,end??start);}}
  return true;
}
function widokAdminMagazyn(sekcja="pulpit"){
  const aktywna=["pulpit","dostawcy","stany","lokalizacje","plan","ruchy"].includes(String(sekcja||""))?String(sekcja||""):"pulpit";
  const u=ustawieniaMagazynuPelne();
  if(aktywna==="plan")return adminSzkielet("/admin/magazyn",`
    ${magazynSubnavHTML(aktywna)}
    <div class="panel warehouse-hero-panel is-compact"><div class="warehouse-hero"><div><span class="cat-label">Magazyn i dokumenty</span><h1>🏬 ${esc(u.nazwa)}</h1><p>Plan zatowarowania pokazuje wyłącznie realne braki do aktywnych zamówień i szkice zamówień do producentów.</p></div></div></div>
    <div id="warehouseRestockWorkspace" class="warehouse-restock-workspace">${magazynPlanZatowarowaniaHTML()}</div>
  `);
  const wymagaStanow=aktywna==="pulpit"||aktywna==="stany",rez=wymagaStanow?rezerwacjeMagazynowe():{},kanalySpr=wymagaStanow?sprzedazKanalyMagazynowe(30):{razem:{},sklep:{},allegro:{}},spr=kanalySpr.razem,prog=Math.max(0,Number(u.progNiski)||5);
  const wszystkie=aktywna==="ruchy"?[]:produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const supplierStats=aktywna==="pulpit"||aktywna==="dostawcy"?statystykiDostepnosciProducentow():{rows:[],bezLinku:[],dostepne:[],niskie:[],braki:[],nieznane:[],wymagajaDecyzji:[],aktywneDecyzje:[],wygasleDecyzje:[]},supplierQuery=String(szukajProducentowMagazynu||"").toLowerCase().trim();
  let supplierRows=[];
  if(aktywna==="dostawcy"){
    supplierRows=(filtrProducentowMagazynu==="bez_linku"?supplierStats.bezLinku.map(p=>({p,i:producentDostepnoscInfo(p),priority:priorytetDostepnosciProduktu(p),rank:0})):supplierStats.rows).filter(({p,i,priority})=>{const decision=decyzjaProducentaInfo(p);if(supplierQuery&&!`${p.nazwa||""} ${p.sku||""} ${p.gtin||p.ean||""} ${p.producent||""} ${i.url}`.toLowerCase().includes(supplierQuery))return false;if(filtrProducentowMagazynu==="alerty"&&!i.alert)return false;if(filtrProducentowMagazynu==="bestsellery"&&!priority?.score)return false;if(filtrProducentowMagazynu==="niski"&&i.status!=="niski")return false;if(filtrProducentowMagazynu==="brak"&&i.status!=="brak")return false;if(filtrProducentowMagazynu==="decyzje"&&(!["brak","niski"].includes(i.status)||(decision.code&&!decision.expired)))return false;if(filtrProducentowMagazynu==="wygasle"&&!decision.expired)return false;if(filtrProducentowMagazynu==="aktywne_decyzje"&&(!decision.code||decision.expired))return false;if(filtrProducentowMagazynu==="nieznane"&&i.url&&!i.stale&&!["nieznany","blad"].includes(i.status))return false;if(filtrProducentowMagazynu==="dostepne"&&!["dostepny","dostepny_nieznany"].includes(i.status))return false;return true;});
    const supplierRank={brak:0,niski:1,blad:2,nieznany:2,dostepny_nieznany:3,dostepny:4};supplierRows.sort((a,b)=>Number(b.priority?.score||0)-Number(a.priority?.score||0)||(supplierRank[a.i.status]??5)-(supplierRank[b.i.status]??5)||(a.i.quantity??Number.MAX_SAFE_INTEGER)-(b.i.quantity??Number.MAX_SAFE_INTEGER)||String(a.p.nazwa||"").localeCompare(String(b.p.nazwa||""),"pl"));
  }
  const bestselleryProducentow=aktywna==="dostawcy"?supplierStats.rows.filter(x=>Number(x.priority?.score||0)>0):[],bestselleryNieaktualne=bestselleryProducentow.filter(x=>x.i.stale||["nieznany","blad"].includes(x.i.status));
  const monitorowane=aktywna==="pulpit"?wszystkie.filter(p=>stanMagazynuId(p.id)!==null):[];
  const zarezerwowane=aktywna==="pulpit"?Object.values(rez).reduce((s,n)=>s+Number(n||0),0):0;
  const wartosc=aktywna==="pulpit"?monitorowane.reduce((s,p)=>s+(stanMagazynuId(p.id)||0)*kwotaNum(p.cena),0):0;
  const planZakupu=wymagaStanow?potrzebyZatowarowania():[];
  const planProdukty=planZakupu.map(x=>x.produkt),planIds=new Set(planProdukty.map(p=>String(p.id)));
  const wartoscPlanu=planZakupu.reduce((s,x)=>s+kwotaNum(x.ilosc*kwotaNum(x.produkt.cena)),0);
  const nadrezerwacje=wymagaStanow?wszystkie.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;}):[];
  const brakiKartoteki=planProdukty.filter(p=>!magazynMetaProduktu(p.id).lokalizacja||!magazynMetaProduktu(p.id).dostawca);
  const bestselleryMagazynu=aktywna==="stany"?wszystkie.filter(p=>priorytetDostepnosciProduktu(p,kanalySpr,rez).score>0):[];
  const stareInwentaryzacje=aktywna==="stany"?planProdukty.filter(p=>{const d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja,t=d?Date.parse(d):0;return !t||Date.now()-t>90*86400000;}):[];
  const alertyStanow=planProdukty;
  const wymagaLokalizacji=aktywna==="pulpit"||aktywna==="stany"||aktywna==="lokalizacje",lokalizacje=wymagaLokalizacji?magazynLokalizacjeAktywne():[],statLok=wymagaLokalizacji?statystykiLokalizacji(wszystkie):{};
  const dostawcyMag=aktywna==="stany"?[...new Set(wszystkie.map(p=>magazynMetaProduktu(p.id).dostawca).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl")):[];
  const pozaSlownikiem=Object.keys(statLok).filter(k=>k!=="BRAK" && !magazynLokalizacjaPoKodzie(k));
  const lokDoKompletacji=aktywna==="pulpit"?[...new Set(pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).flatMap(z=>pozycjeZamowieniaMagazyn(z).map(p=>magazynMetaProduktu(p.id).lokalizacja||"BRAK")))].filter(Boolean):[];
  const pracaMagazynu=aktywna==="pulpit"?[
    ...supplierStats.braki.filter(({p})=>planIds.has(String(p.id))).slice(0,4).map(({p})=>({lvl:"bad",ico:"🔴",tytul:p.nazwa,opis:"Producent zgłasza brak produktu potrzebnego do aktywnego zamówienia.",href:"#/admin/magazyn/dostawcy"})),
    ...supplierStats.niskie.filter(({p})=>planIds.has(String(p.id))).slice(0,4).map(({p,i})=>({lvl:"warn",ico:"🟡",tytul:p.nazwa,opis:`Produkt potrzebny do zamówienia • u producenta ${i.quantity} szt. • próg ${i.prog}.`,href:"#/admin/magazyn/dostawcy"})),
    ...nadrezerwacje.slice(0,4).map(p=>({lvl:"bad",ico:"🚨",tytul:p.nazwa,opis:`Nadrezerwacja: dostępne ${dostepneSztukiMagazynu(p,rez)} szt., rezerwacje ${rez[p.id]||0}.`,akcja:"dozamowienia"})),
    ...planZakupu.slice(0,4).map(x=>({lvl:"warn",ico:"📦",tytul:x.produkt.nazwa,opis:`Do zamówienia: ${x.ilosc} szt. • ${x.meta.dostawca||"brak dostawcy"} • ${x.meta.lokalizacja||"brak lokalizacji"}`,akcja:"dozamowienia"})),
    ...brakiKartoteki.slice(0,4).map(p=>({lvl:"info",ico:"🗂️",tytul:p.nazwa,opis:`Uzupełnij kartotekę: ${!magazynMetaProduktu(p.id).lokalizacja?"brak lokalizacji ":""}${!magazynMetaProduktu(p.id).dostawca?"brak dostawcy":""}.`,akcja:"bezlokalizacji"}))
  ].slice(0,8):[];
  let lista=[],liczbaStron=1,fragment=[];
  if(aktywna==="stany"){
    lista=filtrujProduktyMagazynu(wszystkie,rez,spr);
    liczbaStron=Math.max(1,Math.ceil(lista.length/magazynNaStronie));
    stronaMagazynu=Math.min(Math.max(1,stronaMagazynu),liczbaStron);
    fragment=lista.slice((stronaMagazynu-1)*magazynNaStronie,stronaMagazynu*magazynNaStronie);
    magazynWynikiIds=lista.map(p=>p.id);magazynStronaIds=fragment.map(p=>p.id);
  }
  return adminSzkielet("/admin/magazyn", `
  ${magazynSubnavHTML(aktywna)}
  <div class="panel warehouse-hero-panel ${aktywna!=="pulpit"?"is-compact":""}">
    <div class="warehouse-hero">
      <div>
        <span class="cat-label">Magazyn i dokumenty</span>
        <h1>🏬 ${esc(u.nazwa)}</h1>
        <p>Najpierw dostępność u producentów z linków źródłowych, potem braki do aktywnych zamówień. Stan lokalny pozostaje informacją pomocniczą.</p>
      </div>
      ${aktywna==="pulpit"?`<div class="diag-actions">
        <button class="btn" onclick="eksportujMagazynCSV()">📊 Eksport magazynu CSV</button>
        <button class="btn ghost" onclick="agentAISprawdzDostepnoscProducentow()">🏭 Sprawdź producentów</button>
        <button class="btn ghost" onclick="eksportujZatowarowanieCSV()">📊 Prognoza wartościowa (admin)</button>
        <a class="btn ghost" href="#/admin/agent-ai">🤖 Agent AI</a>
        <a class="btn ghost" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a>
      </div>`:""}
    </div>
    <div class="orders-stat-grid" style="${aktywna==="pulpit"?"":"display:none"}">
      <button class="order-stat-card stat-filter money" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='dostepne'"><span>🏭</span><b>${supplierStats.dostepne.length}</b><small>dostępne u producentów</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.niskie.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='niski'"><span>🟡</span><b>${supplierStats.niskie.length}</b><small>niski stan u producenta ≤ ${esc(u.progNiskiProducenta)}</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.braki.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='brak'"><span>🔴</span><b>${supplierStats.braki.length}</b><small>brak u producenta</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.nieznane.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='nieznane'"><span>⚪</span><b>${supplierStats.nieznane.length}</b><small>niepotwierdzone / nieaktualne</small></button>
      <button class="order-stat-card stat-filter ${filtrMagazynu==="rezerwacje"?"active":""}" type="button" onclick="ustawFiltrMagazynu('rezerwacje','rezerwacje')"><span>🧾</span><b>${zarezerwowane}</b><small>szt. w aktywnych zamówieniach</small></button>
      <button class="order-stat-card stat-filter money ${filtrMagazynu==="wszystkie"&&sortowanieMagazynu==="wartosc"?"active":""}" type="button" onclick="ustawFiltrMagazynu('wszystkie','wartosc')"><span>💰</span><b>${zl(wartosc)}</b><small>wartość stanów</small></button>
      <button class="order-stat-card stat-filter ${planZakupu.length?"hot":""} ${filtrMagazynu==="dozamowienia"?"active":""}" type="button" onclick="ustawFiltrMagazynu('dozamowienia','zakup')"><span>📦</span><b>${planZakupu.length}</b><small>braki do zamówień (${zl(wartoscPlanu)})</small></button>
      <button class="order-stat-card stat-filter ${nadrezerwacje.length?"hot":""} ${filtrMagazynu==="nadrezerwacja"?"active":""}" type="button" onclick="ustawFiltrMagazynu('nadrezerwacja','dostepne')"><span>🚨</span><b>${nadrezerwacje.length}</b><small>nadrezerwacje</small></button>
      <button class="order-stat-card stat-filter ${brakiKartoteki.length?"hot":""} ${filtrMagazynu==="bezlokalizacji"||filtrMagazynu==="bezdostawcy"?"active":""}" type="button" onclick="ustawFiltrMagazynu('bezlokalizacji','nazwa')"><span>🗂️</span><b>${brakiKartoteki.length}</b><small>braki kartoteki</small></button>
      <button class="order-stat-card stat-filter ${pozaSlownikiem.length?"hot":""}" type="button" onclick="document.getElementById('warehouseLocationForm')?.scrollIntoView({behavior:'smooth',block:'center'})"><span>🗺️</span><b>${lokalizacje.length}</b><small>lokalizacji w słowniku</small></button>
    </div>
  </div>
  ${aktywna==="dostawcy"?`<div class="panel supplier-monitor-panel" data-stable-key="supplier-availability">
    <div class="order-section-head">
      <div><span class="order-pro-label">Priorytet bestsellerów</span><h2 style="margin-top:.25rem">🏭 Dostępność u producentów</h2><p class="order-detail-lead">Agent co 6 godzin zawsze zaczyna od najlepiej sprzedających się produktów w Allegro i sklepie oraz pozycji z aktywnych zamówień. Zajmują one do 75% każdej próbki; pozostałe miejsca są losowane spośród najdłużej niesprawdzanych produktów.</p></div>
      <div class="diag-actions"><button class="btn" onclick="agentAISprawdzDostepnoscProducentow()">🤖 Sprawdź bestsellery + próbkę (${esc(u.producentProbka)})</button><button class="btn ghost" onclick="agentAISprawdzDostepnoscProducentow(25)">Pełna partia priorytetowa (25)</button></div>
    </div>
    <div class="orders-stat-grid supplier-monitor-stats"><button class="order-stat-card ${supplierStats.wymagajaDecyzji.length?"hot":""}" onclick="filtrProducentowMagazynu='decyzje';odswiezMonitoringProducentow()"><span>🧭</span><b>${supplierStats.wymagajaDecyzji.length}</b><small>wymaga decyzji sprzedażowej</small></button><button class="order-stat-card money" onclick="filtrProducentowMagazynu='aktywne_decyzje';odswiezMonitoringProducentow()"><span>✅</span><b>${supplierStats.aktywneDecyzje.length}</b><small>aktywnych decyzji</small></button><button class="order-stat-card ${supplierStats.wygasleDecyzje.length?"hot":""}" onclick="filtrProducentowMagazynu='wygasle';odswiezMonitoringProducentow()"><span>⏰</span><b>${supplierStats.wygasleDecyzje.length}</b><small>wygasłych terminów</small></button><div class="order-stat-card money"><span>🏆</span><b>${bestselleryProducentow.length}</b><small>bestsellerów z linkiem</small></div><div class="order-stat-card ${bestselleryNieaktualne.length?"hot":""}"><span>⏱️</span><b>${bestselleryNieaktualne.length}</b><small>priorytetowych do kontroli</small></div><div class="order-stat-card ${supplierStats.niskie.length?"hot":""}"><span>🟡</span><b>${supplierStats.niskie.length}</b><small>niski stan ≤ ${esc(u.progNiskiProducenta)} szt.</small></div><div class="order-stat-card ${supplierStats.braki.length?"hot":""}"><span>🔴</span><b>${supplierStats.braki.length}</b><small>brak u producenta</small></div><div class="order-stat-card ${supplierStats.nieznane.length?"hot":""}"><span>⚪</span><b>${supplierStats.nieznane.length}</b><small>nieznane / starsze niż ${esc(u.producentMaxWiekGodz)} h</small></div><div class="order-stat-card"><span>🔗</span><b>${supplierStats.bezLinku.length}</b><small>bez linku źródłowego</small></div></div>
    <div class="supplier-monitor-toolbar"><input placeholder="Szukaj: nazwa, SKU, EAN, producent lub URL…" value="${esc(szukajProducentowMagazynu)}" oninput="szukajProducentowMagazynu=this.value;clearTimeout(window.__supplierSearch);window.__supplierSearch=setTimeout(()=>odswiezMonitoringProducentow(),180)"><select onchange="filtrProducentowMagazynu=this.value;odswiezMonitoringProducentow()">${[["decyzje","Wymagają decyzji"],["wygasle","Wygasłe decyzje"],["aktywne_decyzje","Aktywne decyzje"],["alerty","Wszystkie ostrzeżenia"],["bestsellery","Bestsellery sklepu i Allegro"],["wszystkie","Wszystkie z linkiem"],["niski","Niski stan"],["brak","Brak u producenta"],["nieznane","Niepotwierdzone / nieaktualne"],["dostepne","Dostępne"],["bez_linku","Bez linku źródłowego"]].map(([v,l])=>`<option value="${v}" ${filtrProducentowMagazynu===v?"selected":""}>${l}</option>`).join("")}</select><span><b>${supplierRows.length}</b> wyników</span></div>
    <div class="warehouse-worktable-wrap"><table class="log-table supplier-monitor-table"><tr><th>Produkt</th><th>Priorytet sprzedaży</th><th>Producent i link</th><th>Stan u producenta</th><th>Decyzja sprzedażowa</th><th>Ostatnia kontrola</th><th>Historia 5 kontroli</th><th>Akcje</th></tr>${supplierRows.slice(0,500).map(({p,i,priority,rank})=>`<tr data-product-row="${esc(p.id)}" class="supplier-row ${i.cls}"><td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||"—")}</small></div></div></td><td><div class="supplier-priority ${esc(priority?.level||"niski")}"><b>${priority?.score?`🏆 #${esc(rank||"—")} • ${esc(priority.level)}`:"— brak sprzedaży"}</b><small>Sklep: ${esc(priority?.sklep||0)} • Allegro: ${esc(priority?.allegro||0)} • aktywne: ${esc(priority?.active||0)}</small><em>Główny kanał: ${esc(priority?.channel||"—")}</em></div></td><td><b>${esc(p.producent||p.marka||"Nieprzypisany")}</b><small class="supplier-source-url">${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">Otwórz źródło ↗</a><br>${esc(i.url)}`:"Brak linku źródłowego"}</small></td><td>${producentDostepnoscBadgeHTML(p)}<small>Próg ostrzeżenia: ${esc(i.prog)} szt.</small></td><td>${decyzjaProducentaPanelHTML(p,i)}</td><td><b>${i.checked?esc(allegroDataTxt(i.checked)):"Nigdy"}</b><br><small>${i.stale?`<span class="lvl lvl-ostrzezenie">wynik nieaktualny</span>`:`<span class="lvl lvl-ok">aktualny</span>`}${i.error?`<br>${esc(skrocTekst(i.error,180))}`:""}</small></td><td><div class="supplier-history">${(Array.isArray(p.producentStanHistoria)?p.producentStanHistoria:[]).map(h=>`<span class="${esc(h.status||"nieznany")}"><b>${h.quantity===null||h.quantity===undefined?"—":esc(h.quantity)+" szt."}</b><small>${esc(allegroDataTxt(h.at))}</small></span>`).join("")||`<small>Brak historii</small>`}</div></td><td><div class="warehouse-worktable-actions">${i.url?`<button class="btn" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź teraz</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj produkt</a></div></td></tr>`).join("")||`<tr><td colspan="8">Brak produktów pasujących do filtra.</td></tr>`}</table></div>
    <div class="backend-note allegro-info-bottom"><b>Zasada decyzji:</b> brak lokalnego stanu nie wyłącza produktu ze sprzedaży. Alarm powstaje przede wszystkim wtedy, gdy producent zgłasza brak albo ujawniony stan spada do ${esc(u.progNiskiProducenta)} szt. lub mniej. Błąd pobrania nie jest traktowany jako brak — zostaje oznaczony do ponownej kontroli.</div>
  </div>`:""}
  ${aktywna==="pulpit"?`<div class="panel warehouse-ops-panel">
    <div class="order-section-head">
      <div>
        <h2 style="margin-top:0">🧭 Operacje magazynu dzisiaj</h2>
        <p class="order-detail-lead">Kolejka pracy pod aktywne zamówienia: najpierw nadrezerwacje, potem braki i kartoteka.</p>
      </div>
      <div class="diag-actions" style="margin-top:0"><button class="btn ghost" onclick="agentAIWstawKomende('przygotuj zamówienie do producenta');location.hash='#/admin/agent-ai'">Zapytaj agenta</button></div>
    </div>
    <div class="warehouse-ops-grid">
      <div class="warehouse-ops-summary">
        <span><b>${lokDoKompletacji.length}</b><small>lokalizacji do przejścia</small></span>
        <span><b>${planZakupu.length}</b><small>pozycji brakujących do zamówień</small></span>
        <span><b>${brakiKartoteki.length}</b><small>braków kartoteki</small></span>
        <span><b>${nadrezerwacje.length}</b><small>nadrezerwacji</small></span>
      </div>
      <div class="warehouse-pick-route">
        <b>Trasa kompletacji</b>
        <p>${lokDoKompletacji.length?lokDoKompletacji.map(k=>`<span>${esc(nazwaLokalizacjiMagazynu(k))}</span>`).join(""):`<span>Brak aktywnych lokalizacji w zamówieniach</span>`}</p>
      </div>
    </div>
    <div class="warehouse-work-list">
      ${pracaMagazynu.length?pracaMagazynu.map(x=>`<button class="warehouse-work-item ${x.lvl}" onclick="${x.href?`location.hash=${jsArg(x.href)}`:`ustawFiltrMagazynu(${jsArg(x.akcja||"wszystkie")},'ryzyko')`}">
        <span>${x.ico}</span><b>${esc(x.tytul)}</b><small>${esc(x.opis)}</small>
      </button>`).join(""):`<div class="warehouse-work-empty">✅ Brak pilnych prac magazynowych wynikających z aktywnych zamówień.</div>`}
    </div>
  </div>`:""}
  ${aktywna==="lokalizacje"?`<div class="panel warehouse-location-panel">
    <div class="order-section-head">
      <div>
        <span class="order-pro-label">Struktura fizyczna</span><h2 style="margin-top:.25rem">🗺️ Strefy, regały, półki i miejsca</h2>
        <p class="order-detail-lead">Hierarchia prowadzi od strefy przez regał i półkę do konkretnego miejsca. Generator tworzy całe ciągi kodów bez ręcznego wpisywania każdej półki.</p>
      </div>
      <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż lokalizacje');location.hash='#/admin/agent-ai'">Zapytaj agenta</button>
    </div>
    <div class="warehouse-location-overview"><span><b>${lokalizacje.filter(l=>l.typ==="strefa").length}</b><small>stref</small></span><span><b>${lokalizacje.filter(l=>l.typ==="regał").length}</b><small>regałów</small></span><span><b>${lokalizacje.filter(l=>l.typ==="półka").length}</b><small>półek</small></span><span><b>${lokalizacje.filter(l=>l.typ==="miejsce").length}</b><small>miejsc</small></span><span><b>${statLok.BRAK?.produkty||0}</b><small>produktów bez miejsca</small></span></div>
    <form class="warehouse-generator" onsubmit="return generujRegalyIPolkiMagazynu(event)">
      <div class="order-section-head"><div><h3 style="margin:0">✨ Generator struktury</h3><p class="order-detail-lead">Przykład: strefa A, 3 regały, 5 półek i 4 miejsca utworzą kody A-R01-P01-M01 itd.</p></div><button class="btn" type="submit">✨ Utwórz całą strukturę</button></div>
      <div class="warehouse-generator-grid"><label>Strefa <input name="strefaKod" value="A" maxlength="10" required></label><label>Nazwa strefy <input name="strefaNazwa" value="Strefa A"></label><label>Prefiks regału <input name="prefix" value="R" maxlength="8" required></label><label>Start regału <input name="startRegal" type="number" min="1" value="1"></label><label>Liczba regałów <input name="regaly" type="number" min="1" max="50" value="3"></label><label>Półki / regał <input name="polki" type="number" min="1" max="30" value="5"></label><label>Start półki <input name="startPolka" type="number" min="1" value="1"></label><label>Miejsca / półkę <input name="miejsca" type="number" min="0" max="30" value="0"><small>0 = produkt przypisujesz bezpośrednio do półki</small></label><label>Pojemność miejsca <input name="pojemnosc" type="number" min="0" placeholder="opcjonalnie"></label></div>
    </form>
    <div class="warehouse-location-layout">
      <form id="warehouseLocationForm" class="warehouse-location-form" onsubmit="return zapiszLokalizacjeMagazynu(event)">
        <h3 style="margin-top:0">✏️ Pojedyncza lokalizacja</h3><p class="order-detail-lead">Do nietypowego miejsca, palety, stanowiska albo ręcznej korekty struktury.</p>
        <div class="warehouse-location-form-grid">
          <div class="f-group"><label>Kod *</label><input name="kod" placeholder="np. A-R01-P02" required></div>
          <div class="f-group"><label>Nazwa</label><input name="nazwa" placeholder="Półka 2 / gry rodzinne"></div>
          <div class="f-group"><label>Typ</label><select name="typ"><option>miejsce</option><option>półka</option><option>regał</option><option>strefa</option><option>paleta</option><option>box</option><option>stanowisko pakowania</option><option>zewnętrzna</option></select></div>
          <div class="f-group"><label>Lokalizacja nadrzędna</label><select name="parentKod"><option value="">— poziom główny —</option>${lokalizacje.map(l=>`<option value="${esc(l.kod)}">${"· ".repeat(poziomLokalizacjiMagazynu(l.kod))}${esc(l.kod)} — ${esc(l.nazwa||l.typ)}</option>`).join("")}</select></div>
          <div class="f-group"><label>Strefa</label><input name="strefa" placeholder="np. A / szybka kompletacja"></div>
          <div class="f-group"><label>Kod kreskowy lokalizacji</label><input name="kodKreskowy" placeholder="zeskanuj lub wpisz"></div>
          <div class="f-group"><label>Pojemność szt.</label><input name="pojemnosc" inputmode="numeric" placeholder="opcjonalnie"></div>
          <div class="f-group"><label>Priorytet kompletacji</label><input name="priorytet" inputmode="numeric" placeholder="np. 10"></div>
          <div class="f-group"><label>Szerokość (cm)</label><input name="szerokosc" type="number" min="0"></div><div class="f-group"><label>Głębokość (cm)</label><input name="glebokosc" type="number" min="0"></div><div class="f-group"><label>Wysokość (cm)</label><input name="wysokosc" type="number" min="0"></div><div class="f-group"><label>Maks. waga (kg)</label><input name="maxWaga" inputmode="decimal"></div>
        </div>
        <div class="f-group"><label>Uwagi</label><input name="uwagi" placeholder="np. produkty najczęściej kupowane, ciężkie gry, zapas sezonowy"></div>
        <div class="diag-actions"><button class="btn" type="submit">💾 Zapisz lokalizację</button><button class="btn ghost" type="reset">Wyczyść formularz</button></div>
      </form>
      <div class="warehouse-location-list hierarchy-list">
        ${lokalizacje.map(l=>{
          const s=statLok[l.kod]||{produkty:0,sztuki:0,rezerwacje:0,wartosc:0};
          const zapelnienie=l.pojemnosc?Math.min(100,Math.round((s.sztuki/Math.max(1,l.pojemnosc))*100)):null;
          const level=poziomLokalizacjiMagazynu(l.kod),children=lokalizacje.filter(x=>x.parentKod===l.kod).length;
          return `<div class="warehouse-location-card hierarchy-level-${Math.min(3,level)}" style="--level:${level}">
            <div class="warehouse-location-head"><div><small>${esc(sciezkaLokalizacjiMagazynu(l.kod))}</small><b>${esc(l.kod)}</b></div><span class="lvl lvl-info">${esc(l.typ||"lokalizacja")}</span></div>
            <p>${esc(l.nazwa||"Bez nazwy")}${l.strefa?` • strefa: ${esc(l.strefa)}`:""}${children?` • elementów niżej: ${children}`:""}</p>
            <div class="warehouse-location-metrics">
              <span><b>${s.produkty}</b><small>produktów</small></span>
              <span><b>${s.sztuki}</b><small>sztuk</small></span>
              <span><b>${s.rezerwacje}</b><small>rezerw.</small></span>
              <span><b>${zl(s.wartosc)}</b><small>wartość</small></span>
            </div>
            ${zapelnienie!==null?`<div class="warehouse-fill"><span style="width:${zapelnienie}%"></span></div><small>Zapełnienie wg stanu: ${zapelnienie}% / ${esc(l.pojemnosc)} szt.</small>`:""}
            ${(l.szerokosc||l.glebokosc||l.wysokosc||l.maxWaga)?`<small>Wymiary: ${esc(l.szerokosc||"—")} × ${esc(l.glebokosc||"—")} × ${esc(l.wysokosc||"—")} cm • maks. ${esc(l.maxWaga||"—")} kg</small>`:""}${l.kodKreskowy?`<small>Kod kreskowy: <b>${esc(l.kodKreskowy)}</b></small>`:""}
            ${l.uwagi?`<small>${esc(l.uwagi)}</small>`:""}
            <div class="diag-actions"><button class="btn ghost" type="button" onclick="edytujLokalizacjeMagazynu(${jsArg(l.kod)})">Edytuj</button><button class="btn danger" type="button" onclick="usunLokalizacjeMagazynu(${jsArg(l.kod)})">Ukryj</button></div>
          </div>`;
        }).join("") || `<div class="warehouse-location-card"><b>Brak lokalizacji</b><p>Dodaj pierwszą lokalizację, np. R1-P1, żeby produkty można było przypisywać z listy.</p></div>`}
      </div>
    </div>
    ${statLok.BRAK?.produkty?`<div class="pay-note" style="text-align:left;margin-top:.8rem">Bez lokalizacji: <b>${statLok.BRAK.produkty}</b> produktów. Użyj filtra „Bez lokalizacji”, żeby szybko uzupełnić kartotekę.</div>`:""}
    ${pozaSlownikiem.length?`<div class="pay-note" style="text-align:left;margin-top:.6rem">Lokalizacje wpisane przy produktach, ale nieutworzone w słowniku: <b>${pozaSlownikiem.map(esc).join(", ")}</b>.</div>`:""}
  </div>`:""}
  ${aktywna==="plan"?`<div id="warehouseRestockWorkspace" class="warehouse-restock-workspace">${magazynPlanZatowarowaniaHTML()}</div>`:""}
  ${aktywna==="stany"?`<div class="panel warehouse-stock-page">
    <div class="order-section-head warehouse-stock-head">
      <div><span class="order-pro-label">Centrum kontroli zapasu</span><h2>📋 Stany produktów</h2><p class="order-detail-lead">Jeden czytelny widok łączy dostępność producenta, sprzedaż Allegro i sklepu, rezerwacje, fizyczny zapas, lokalizację oraz decyzję o domówieniu.</p></div>
      <div class="diag-actions"><button class="btn" data-stock-confirm-visible onclick='potwierdzWidoczneStanyMagazynu(${JSON.stringify(fragment.map(p=>p.id))})'>✅ Potwierdź ${fragment.length} widocznych</button><button class="btn ghost" onclick="eksportujMagazynCSV()">📤 Eksport CSV</button><button class="btn ghost" onclick="wyczyscFiltryStanowMagazynu()">Wyczyść filtry</button></div>
    </div>
    <div class="warehouse-stock-summary">
      <button class="stock-summary-card ${filtrMagazynu==="bestsellery"?"active":""}" onclick="ustawFiltrMagazynu('bestsellery','priorytet')"><span>🏆</span><b>${bestselleryMagazynu.length}</b><small>bestsellerów i aktywnych</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="alerty"?"active":""} ${alertyStanow.length?"alert":""}" onclick="ustawFiltrMagazynu('alerty','ryzyko')"><span>🚨</span><b>${alertyStanow.length}</b><small>alertów operacyjnych</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="dozamowienia"?"active":""}" onclick="ustawFiltrMagazynu('dozamowienia','zakup')"><span>📦</span><b>${planZakupu.length}</b><small>produktów do zamówienia</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="nadrezerwacja"?"active":""}" onclick="ustawFiltrMagazynu('nadrezerwacja','dostepne')"><span>🧾</span><b>${nadrezerwacje.length}</b><small>nadrezerwacji</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="bezlokalizacji"?"active":""}" onclick="ustawFiltrMagazynu('bezlokalizacji','priorytet')"><span>🗺️</span><b>${brakiKartoteki.length}</b><small>niepełnych kartotek</small></button>
      <button class="stock-summary-card ${filtrInwentaryzacjiMagazynu==="stara"?"active":""}" onclick="filtrInwentaryzacjiMagazynu='stara';stronaMagazynu=1;renderuj()"><span>📅</span><b>${stareInwentaryzacje.length}</b><small>stanów do potwierdzenia</small></button>
    </div>
    <div class="warehouse-stock-quickfilters" aria-label="Szybkie filtry">
      ${[["wszystkie","Wszystkie"],["bestsellery","🏆 Bestsellery"],["producent-brak","🔴 Brak u producenta"],["producent-niski","🟡 Niski u producenta"],["dozamowienia","📦 Do zamówienia"],["rezerwacje","🧾 Z rezerwacją"],["bezlokalizacji","🗺️ Bez lokalizacji"],["bezdostawcy","🏭 Bez dostawcy"]].map(([v,t])=>`<button type="button" class="${filtrMagazynu===v?"active":""}" onclick="ustawFiltrMagazynu(${jsArg(v)},${jsArg(v==="bestsellery"?"priorytet":v==="dozamowienia"?"zakup":"ryzyko")})">${t}</button>`).join("")}
    </div>
    ${adminWyszukiwaniePanelHTML({id:"warehouse-stock",description:"Nazwa i identyfikatory produktu, status, dostawca, lokalizacja, inwentaryzacja oraz sortowanie.",results:lista.length,active:!!(frazaMagazynu||filtrMagazynu!=="wszystkie"||filtrDostawcyMagazynu!=="wszyscy"||filtrLokalizacjiMagazynu!=="wszystkie"||filtrInwentaryzacjiMagazynu!=="wszystkie"),open:true,fields:`<div class="warehouse-stock-toolbar admin-search-full">
      <label class="warehouse-stock-search"><span>Wyszukaj produkt</span><input data-warehouse-stock-search placeholder="Nazwa, SKU, EAN, ID, kategoria, lokalizacja lub dostawca…" value="${esc(frazaMagazynu)}" oninput="magazynSzukajProdukty(this)" autocomplete="off"></label>
      <label><span>Status</span><select onchange="filtrMagazynu=this.value;stronaMagazynu=1;renderuj()">${[["wszystkie","Wszystkie produkty"],["alerty","Wszystkie alerty"],["bestsellery","Bestsellery / aktywne"],["producent-niski","Producent: niski stan"],["producent-brak","Producent: brak"],["producent-nieznany","Producent: niepotwierdzone"],["dozamowienia","Braki do zamówień"],["nadrezerwacja","Nadrezerwacje"],["monitorowane","Monitorowane lokalnie"],["bezlimitu","Lokalnie bez limitu"],["niskie","Lokalny niski stan"],["brak","Lokalny stan zerowy"],["rezerwacje","Z rezerwacją"],["sprzedaz","Sprzedane 30 dni"],["bezlokalizacji","Bez lokalizacji"],["bezdostawcy","Bez dostawcy"]].map(([v,t])=>`<option value="${v}" ${filtrMagazynu===v?"selected":""}>${t}</option>`).join("")}</select></label>
      <label><span>Sortowanie</span><select onchange="sortowanieMagazynu=this.value;stronaMagazynu=1;renderuj()">${[["ryzyko","Priorytet operacyjny"],["priorytet","Bestsellery najpierw"],["producent","Stan u producenta"],["zakup","Największe braki"],["dostepne","Dostępne po rezerwacji"],["stan","Stan lokalny rosnąco"],["nazwa","Nazwa A–Z"],["rezerwacje","Rezerwacje"],["sprzedaz","Sprzedaż 30 dni"],["wartosc","Wartość stanu"]].map(([v,t])=>`<option value="${v}" ${sortowanieMagazynu===v?"selected":""}>${t}</option>`).join("")}</select></label>
      <label><span>Dostawca</span><select onchange="filtrDostawcyMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszyscy">Każdy dostawca</option>${dostawcyMag.map(d=>`<option value="${esc(d)}" ${filtrDostawcyMagazynu===d?"selected":""}>${esc(d)}</option>`).join("")}</select></label>
      <label><span>Lokalizacja</span><select onchange="filtrLokalizacjiMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszystkie">Każda lokalizacja</option><option value="BRAK" ${filtrLokalizacjiMagazynu==="BRAK"?"selected":""}>Bez lokalizacji</option>${lokalizacje.map(l=>`<option value="${esc(l.kod)}" ${filtrLokalizacjiMagazynu===l.kod?"selected":""}>${esc(l.kod)} — ${esc(l.nazwa||l.typ)}</option>`).join("")}</select></label>
      <label><span>Inwentaryzacja</span><select onchange="filtrInwentaryzacjiMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszystkie">Każda data</option><option value="aktualna" ${filtrInwentaryzacjiMagazynu==="aktualna"?"selected":""}>Aktualna ≤ 90 dni</option><option value="stara" ${filtrInwentaryzacjiMagazynu==="stara"?"selected":""}>Brak / starsza niż 90 dni</option></select></label>
      <label><span>Na stronie</span><select onchange="ustawMagazynNaStronie(this.value)">${[25,50,100,200,500].map(n=>`<option value="${n}" ${magazynNaStronie===n?"selected":""}>${n} produktów</option>`).join("")}</select></label>
    </div>`,actions:adminOperacjeWynikowHTML({id:"warehouse-stock",selected:zaznaczoneMagazynProdukty.size,pageCount:fragment.length,resultCount:lista.length,selectPage:"magazynUstawZaznaczenie('strona')",selectAll:"magazynUstawZaznaczenie('filtr')",clear:"magazynWyczyscZaznaczenie()",exportSelected:"magazynEksportuj('zaznaczone')",exportAll:"magazynEksportuj('filtr')"})})}
    <div class="warehouse-stock-results"><span>Pokazano <b>${fragment.length}</b> z <b>${lista.length}</b> produktów</span><span>Strona ${stronaMagazynu} z ${liczbaStron}</span></div>
    <div class="pagination">${paginacjaHTML(stronaMagazynu,liczbaStron,"ustawStroneMagazynu")}</div>
    <div class="warehouse-stock-list">
      ${fragment.map(p=>{
        const stan=stanMagazynuId(p.id),r=Number(rez[p.id]||0),sp=Number(spr[p.id]||0),plan=sugestiaZatowarowania(p,rez,spr),meta=plan.meta,wart=stan===null?0:stan*kwotaNum(p.cena),pi=producentDostepnoscInfo(p),priority=priorytetDostepnosciProduktu(p,kanalySpr,rez),sklep30=Number(kanalySpr.sklep[p.id]||0),allegro30=Number(kanalySpr.allegro[p.id]||0),invTime=meta.ostatniaInwentaryzacja?Date.parse(meta.ostatniaInwentaryzacja):0,invOld=!invTime||Date.now()-invTime>90*86400000;
        const risk=pi.status==="brak"||plan.dostepne!==null&&plan.dostepne<0?"critical":pi.status==="niski"||plan.ilosc>0?"warning":pi.stale||["nieznany","blad"].includes(pi.status)?"info":"ok";
        const riskLabel=risk==="critical"?"Pilna reakcja":risk==="warning"?"Wymaga uwagi":risk==="info"?"Do weryfikacji":"Bez alarmu";
        return `<article class="warehouse-stock-card stock-${risk} ${zaznaczoneMagazynProdukty.has(String(p.id))?"is-selected":""}">
          <header class="warehouse-stock-card-head">
            <div class="warehouse-stock-product"><label class="warehouse-stock-select" title="Zaznacz produkt"><input type="checkbox" ${zaznaczoneMagazynProdukty.has(String(p.id))?"checked":""} onchange="magazynUstawZaznaczenie([${jsArg(p.id)}],this.checked)"></label>${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><h3>${esc(p.nazwa)}</h3><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||meta.kod||"—")} • ID ${esc(p.id)}</small><small>${esc(p.kategoria||"Bez kategorii")} • ${esc(p.producent||meta.dostawca||"Producent nieprzypisany")}</small></div></div>
            <div class="warehouse-stock-priority ${esc(priority.level)}"><b>${priority.score?`🏆 ${priority.score} pkt`:`${risk==="ok"?"✓":"!"} ${riskLabel}`}</b><small>Sklep ${sklep30} • Allegro ${allegro30} • aktywne ${priority.active}</small></div>
            <div class="warehouse-stock-state"><span class="stock-state-dot ${risk}"></span><div><b>${riskLabel}</b><small>${dostepnoscBadgeAdmin(p)}</small></div></div>
          </header>
          <div class="warehouse-stock-card-grid">
            <section><label>Stan fizyczny</label><div class="warehouse-stock-balance"><span><b>${stan===null?"∞":stan}</b><small>na stanie</small></span><span><b>${r}</b><small>rezerwacje</small></span><span class="${plan.dostepne!==null&&plan.dostepne<0?"negative":""}"><b>${plan.dostepne===null?"∞":plan.dostepne}</b><small>dostępne</small></span></div><small>Wartość: ${stan===null?"—":zl(wart)} • ${stanBadgeMagazynu(stan,progNiskiProduktu(p))}</small></section>
            <section><label>Producent i źródło</label>${producentDostepnoscBadgeHTML(p,true)}<small>${pi.checked?`Kontrola: ${esc(allegroDataTxt(pi.checked))}`:"Nigdy nie sprawdzano"}${pi.stale?" • wynik nieaktualny":""}</small></section>
            <section><label>Sprzedaż i pokrycie</label><b>${sp} szt. / 30 dni</b><small>Sklep ${sklep30} • Allegro ${allegro30} • średnio ${(sp/30).toFixed(2).replace(".",",")} dziennie</small><small>Pokrycie ${plan.dniPokrycia===null?"—":plan.dniPokrycia+" dni"} • cel ${plan.target} • dostawa ${plan.lead} dni</small></section>
            <section class="warehouse-stock-decision ${plan.poziom}"><label>Decyzja magazynowa</label><b>${plan.ilosc?`Domówić ${esc(plan.ilosc)} szt.`:"Nie trzeba domawiać"}</b><small>${esc(plan.powod)}</small><small>Minimum ${esc(plan.min)} • cel ${esc(plan.target)} • min. zakup ${esc(plan.minZakup||0)}</small></section>
          </div>
          <div class="warehouse-stock-location"><span>🗺️ <b>${esc(meta.lokalizacja?nazwaLokalizacjiMagazynu(meta.lokalizacja):"Brak lokalizacji")}</b></span><span>🏭 ${esc(meta.dostawca||"Brak dostawcy")}</span><span class="${invOld?"old":""}">📅 ${meta.ostatniaInwentaryzacja?`Inwentaryzacja ${esc(allegroDataTxt(meta.ostatniaInwentaryzacja))}`:"Stan nigdy niepotwierdzony"}</span></div>
          <div class="warehouse-stock-actions">
            <div class="warehouse-stock-stepper"><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},-10)" ${stan===null?"disabled":""}>−10</button><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},-1)" ${stan===null?"disabled":""}>−1</button><strong>${stan===null?"∞":stan}</strong><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},1)" ${stan===null?"disabled":""}>+1</button><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},10)" ${stan===null?"disabled":""}>+10</button></div>
            <form class="warehouse-stock-set" onsubmit="korygujStanMagazynu(event,${jsArg(p.id)})"><input name="stan" value="${stan===null?"":stan}" placeholder="Nowy stan / puste = ∞" inputmode="numeric"><input name="powod" placeholder="Powód korekty" maxlength="80"><button class="btn" type="submit">Zapisz stan</button></form>
            <div class="warehouse-stock-links"><button class="btn ghost" type="button" onclick="przelaczDostepnoscProduktu(${jsArg(p.id)})">${produktAutomatycznieNiedostepny(p)?"🔄 Sprawdź i przywróć":produktOznaczonyNiedostepny(p)?"▶️ Włącz sprzedaż":"⏸️ Wyłącz sprzedaż"}</button>${pi.url?`<button class="btn ghost" type="button" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź producenta</button><a class="btn ghost" href="${esc(pi.url)}" target="_blank" rel="noopener">Źródło ↗</a>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Produkt</a></div>
          </div>
          <details class="warehouse-stock-details"><summary>⚙️ Kartoteka, lokalizacja i parametry zatowarowania</summary><form class="warehouse-stock-meta-form" onsubmit="zapiszKartotekeMagazynu(event,${jsArg(p.id)})"><label>Lokalizacja ${selectLokalizacjiMagazynu(meta.lokalizacja||"")}</label><label>Dostawca<input name="dostawca" value="${esc(meta.dostawca||"")}" placeholder="np. Alexander"></label><label>EAN / kod<input name="kod" value="${esc(meta.kod||p.gtin||p.ean||"")}"></label><label>Kod w Comarch Optima dostawcy<input name="optimaCode" value="${esc(meta.optimaCode||p.optimaCode||"")}" placeholder="Dokładny kod pola TOWAR"></label><label>Kod dostawcy<input name="kodDostawcy" value="${esc(meta.kodDostawcy||p.kodDostawcy||p.supplierCode||"")}" placeholder="Opcjonalny kod katalogowy"></label><label>Stan minimalny<input name="minStock" value="${esc(meta.minStock??"")}" inputmode="numeric"></label><label>Stan docelowy<input name="targetStock" value="${esc(meta.targetStock??"")}" inputmode="numeric"></label><label>Czas dostawy (dni)<input name="leadTime" value="${esc(meta.leadTime??"")}" inputmode="numeric"></label><label>Minimalny zakup<input name="minZakup" value="${esc(meta.minZakup??"")}" inputmode="numeric"></label><label>Uwagi<input name="uwagi" value="${esc(meta.uwagi||"")}"></label><div class="warehouse-stock-meta-buttons"><button class="btn ghost" type="button" onclick="oznaczInwentaryzacjeProduktu(${jsArg(p.id)})">✅ Potwierdź stan</button><button class="btn" type="submit">💾 Zapisz kartotekę</button></div></form></details>
        </article>`;
      }).join("")||`<div class="warehouse-stock-empty"><b>Brak produktów pasujących do filtrów</b><p>Wyczyść filtry albo zmień kryteria wyszukiwania.</p><button class="btn" onclick="wyczyscFiltryStanowMagazynu()">Pokaż wszystkie</button></div>`}
    </div>
    <div class="pagination">${paginacjaHTML(stronaMagazynu,liczbaStron,"ustawStroneMagazynu")}</div>
  </div>`:""}
  ${aktywna==="ruchy"?`<div class="warehouse-columns">
    <div class="panel">
      <h2 style="margin-top:0">🧾 Historia ruchów</h2>
      <p>Ostatnie korekty, przyjęcia i sprzedaże. Pełna historia synchronizuje się we wspólnej bazie.</p>
      <div style="overflow-x:auto"><table class="log-table">
        <tr><th>Data</th><th>Typ</th><th>Produkt</th><th>Ilość</th><th>Stan</th><th>Dokument</th></tr>
        ${(ruchyMagazynowe||[]).slice(0,40).map(r=>`<tr>
          <td>${esc(r.dataTxt||new Date(r.data).toLocaleString("pl-PL"))}</td>
          <td><span class="lvl lvl-info">${esc(r.typ)}</span></td>
          <td><b>${esc(r.produktNazwa)}</b><br><small>${esc(r.sku||r.produktId||"")}${r.powod?` • ${esc(r.powod)}`:""}</small></td>
          <td><b>${Number(r.ilosc)>0?"+":""}${esc(r.ilosc)}</b></td>
          <td>${r.stanPrzed===null?"∞":esc(r.stanPrzed)} → ${r.stanPo===null?"∞":esc(r.stanPo)}</td>
          <td>${esc(r.dokument||"—")}</td>
        </tr>`).join("") || `<tr><td colspan="6">Brak ruchów magazynowych.</td></tr>`}
      </table></div>
    </div>
    <div class="panel">
      <h2 style="margin-top:0">⚙️ Ustawienia magazynu</h2>
      <form onsubmit="zapiszUstawieniaMagazynu(event)">
        <div class="f-group"><label>Nazwa magazynu</label><input name="nazwa" value="${esc(u.nazwa)}"></div>
        <div class="f-row"><div class="f-group"><label>Próg niskiego stanu</label><input name="progNiski" inputmode="numeric" value="${esc(prog)}"></div><div class="f-group"><label>Operator domyślny</label><input name="operator" value="${esc(u.domyslnyOperator)}"></div></div>
        <div class="f-group"><label>Lokalizacja / uwagi</label><input name="lokalizacja" value="${esc(u.lokalizacja)}" placeholder="np. regał, pomieszczenie, adres"></div>
        <div class="f-row"><div class="f-group"><label>Domyślny dostawca</label><input name="domyslnyDostawca" value="${esc(u.domyslnyDostawca)}" placeholder="np. Pinkfrog / hurtownia"></div><div class="f-group"><label>Domyślny czas dostawy (dni)</label><input name="domyslnyLeadTime" inputmode="numeric" value="${esc(u.domyslnyLeadTime)}"></div></div>
        <div class="f-row"><div class="f-group"><label>Zapas docelowy (dni)</label><input name="domyslnyZapasDni" inputmode="numeric" value="${esc(u.domyslnyZapasDni)}"></div><div class="f-group"><label>Akcja kartoteki</label><button class="btn ghost" type="button" onclick="wypelnijDomyslnaKartotekeMagazynu()">Uzupełnij braki domyślnymi danymi</button></div></div>
        <h2>🏭 Monitoring producentów</h2>
        <p class="order-detail-lead">Automatyczny Agent AI co 6 godzin losuje spośród najdłużej niesprawdzanych linków. Telegram jest wysyłany tylko po pojawieniu się nowego niskiego stanu albo braku.</p>
        <div class="f-row"><div class="f-group"><label>Próg ostrzeżenia u producenta (szt.)</label><input name="progNiskiProducenta" type="number" min="1" value="${esc(u.progNiskiProducenta)}"></div><div class="f-group"><label>Wielkość wyrywkowej próbki</label><input name="producentProbka" type="number" min="1" max="25" value="${esc(u.producentProbka)}"></div></div>
        <div class="f-group"><label>Po ilu godzinach wynik uznać za nieaktualny</label><input name="producentMaxWiekGodz" type="number" min="1" value="${esc(u.producentMaxWiekGodz)}"></div>
        <button class="btn" type="submit">💾 Zapisz ustawienia</button>
      </form>
    </div>
  </div>`:""}
  `);
}
function widokAdminProdukty(){
  allegroLadujJesliTrzeba();
  const audytAllegro=allegroAudytDuplikatow();
  const audytSklep=audytDuplikatowSklepu();
  const katalogWszystkie=produktyDoAdministracji();
  const ofertaCache=new Map(katalogWszystkie.map(p=>[String(p.id),allegroOfertaDlaProduktuSklepu(p)]));
  const duplikatySklepuIds=new Set(audytSklep.grupy.flatMap(g=>g.produkty.map(p=>String(p.id))));
  const duplikatyAllegroIds=new Set((audytAllegro.grupy||[]).map(g=>String(g?.produkt?.id??"")).filter(Boolean));
  let wszystkie=[...katalogWszystkie];
  if(szukajProduktow) wszystkie = wszystkie.filter(p=>produktPasujeFrazie(p,szukajProduktow));
  if(filtrProduktow!=="Wszystkie") wszystkie = wszystkie.filter(p=>p.kategoria===filtrProduktow);
  if(filtrStatusuProduktow==="aktywne") wszystkie=wszystkie.filter(p=>!czyProduktAdminWKoszu(p));
  if(filtrStatusuProduktow==="kosz") wszystkie=wszystkie.filter(p=>czyProduktAdminWKoszu(p));
  if(filtrStatusuProduktow==="duplikaty") wszystkie=wszystkie.filter(p=>duplikatySklepuIds.has(String(p.id)));
  if(filtrZrodlaProduktow==="bazowe") wszystkie=wszystkie.filter(p=>!produktyDodane.some(x=>x.id===p.id)&&!jestProduktemImportowanym(p.id));
  if(filtrZrodlaProduktow==="wlasne") wszystkie=wszystkie.filter(p=>produktyDodane.some(x=>x.id===p.id)||jestProduktemImportowanym(p.id));
  if(filtrStanuProduktow==="dostepne") wszystkie=wszystkie.filter(p=>stanyProduktow[p.id]===undefined||Number(stanyProduktow[p.id])>0);
  if(filtrStanuProduktow==="niskie") wszystkie=wszystkie.filter(p=>Number(stanyProduktow[p.id])>0&&Number(stanyProduktow[p.id])<=5);
  if(filtrStanuProduktow==="brak") wszystkie=wszystkie.filter(p=>Number(stanyProduktow[p.id])===0);
  if(filtrAllegroProduktow==="aktywne") wszystkie=wszystkie.filter(p=>String(ofertaCache.get(String(p.id))?.status||"").toUpperCase()==="ACTIVE");
  if(filtrAllegroProduktow==="szkice") wszystkie=wszystkie.filter(p=>{const o=ofertaCache.get(String(p.id));return o&&String(o.status||"").toUpperCase()!=="ACTIVE";});
  if(filtrAllegroProduktow==="polaczone") wszystkie=wszystkie.filter(p=>!!ofertaCache.get(String(p.id)));
  if(filtrAllegroProduktow==="brak") wszystkie=wszystkie.filter(p=>!ofertaCache.get(String(p.id)));
  if(filtrAllegroProduktow==="duplikaty") wszystkie=wszystkie.filter(p=>duplikatyAllegroIds.has(String(p.id)));
  if(filtrProducentaProduktow!=="wszyscy") wszystkie=wszystkie.filter(p=>String(p.producent||p.marka||"")===filtrProducentaProduktow);
  if(filtrDanychProduktow==="gotowe") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).length===0);
  if(filtrDanychProduktow==="braki") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).length>0);
  if(filtrDanychProduktow==="ean") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).includes("EAN"));
  if(filtrDanychProduktow==="zdjecie") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).includes("zdjęcie"));
  if(filtrDanychProduktow==="opis") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).includes("opis"));
  if(filtrDanychProduktow==="zrodlo") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).includes("źródło"));
  if(filtrDanychProduktow==="producent") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).includes("producent"));
  if(filtrDanychProduktow==="kategoria") wszystkie=wszystkie.filter(p=>asortymentBrakiDanych(p).includes("kategoria"));
  if(filtrDanychProduktow==="koszt") wszystkie=wszystkie.filter(p=>!(Number(p.cenaZakupu)>0));
  if(filtrSprzedazyProduktow==="dostepne") wszystkie=wszystkie.filter(produktDostepnyWSprzedazy);
  if(filtrSprzedazyProduktow==="niedostepne") wszystkie=wszystkie.filter(p=>!produktDostepnyWSprzedazy(p));
  if(filtrSprzedazyProduktow==="reczne") wszystkie=wszystkie.filter(produktOznaczonyNiedostepny);
  if(filtrSprzedazyProduktow==="automat") wszystkie=wszystkie.filter(produktAutomatycznieNiedostepny);
  if(filtrPromocjiProduktow==="promocje") wszystkie=wszystkie.filter(p=>Number(p.staraCena)>Number(p.cena));
  if(filtrPromocjiProduktow==="regularne") wszystkie=wszystkie.filter(p=>!(Number(p.staraCena)>Number(p.cena)));
  if(filtrPromocjiProduktow==="nowosci") wszystkie=wszystkie.filter(p=>String(p.badge||"").toLowerCase().includes("nowo"));
  const cenaOd=parseFloat(String(cenaOdAdminProduktow||"").replace(",",".")),cenaDo=parseFloat(String(cenaDoAdminProduktow||"").replace(",","."));
  if(Number.isFinite(cenaOd))wszystkie=wszystkie.filter(p=>kwotaNum(p.cena)>=cenaOd);
  if(Number.isFinite(cenaDo))wszystkie=wszystkie.filter(p=>kwotaNum(p.cena)<=cenaDo);
  wszystkie=sortujProduktyAdmin(wszystkie);
  const liczbaWynikow=wszystkie.length;
  const liczbaStron=Math.max(1,Math.ceil(liczbaWynikow/produktyNaStronieAdmin));
  stronaAdminProduktow=Math.min(Math.max(1,stronaAdminProduktow),liczbaStron);
  const fragment=wszystkie.slice((stronaAdminProduktow-1)*produktyNaStronieAdmin,stronaAdminProduktow*produktyNaStronieAdmin);
  asortymentWynikiIds=wszystkie.map(p=>p.id);asortymentStronaIds=fragment.map(p=>p.id);
  const katOpcje=[...new Set(katalogWszystkie.map(p=>String(p.kategoria||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
  const producenciOpcje=[...new Set(katalogWszystkie.map(p=>String(p.producent||p.marka||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
  const bazoweWKoszu=bazoweProduktyWKoszu();
  const liczbaWKoszu=koszDodanych.length+bazoweWKoszu.length;
  const aktywneKarty=katalogWszystkie.filter(p=>!czyProduktAdminWKoszu(p));
  const polaczoneAllegro=aktywneKarty.filter(p=>ofertaCache.get(String(p.id))).length;
  const zBrakami=aktywneKarty.filter(p=>asortymentBrakiDanych(p).length).length;
  const gotoweDoSprzedazy=aktywneKarty.filter(p=>asortymentBrakiDanych(p).length===0&&produktDostepnyWSprzedazy(p)).length;
  const ukryteSprzedazowo=aktywneKarty.filter(p=>!produktDostepnyWSprzedazy(p)).length;
  const zakresOd=liczbaWynikow?(stronaAdminProduktow-1)*produktyNaStronieAdmin+1:0,zakresDo=liczbaWynikow?zakresOd+fragment.length-1:0;
  const aktywneFiltry=[];
  if(szukajProduktow)aktywneFiltry.push(["szukaj",`Fraza: ${szukajProduktow}`]);
  if(filtrProduktow!=="Wszystkie")aktywneFiltry.push(["kategoria",`Kategoria: ${filtrProduktow}`]);
  if(filtrProducentaProduktow!=="wszyscy")aktywneFiltry.push(["producent",`Producent: ${filtrProducentaProduktow}`]);
  if(filtrStatusuProduktow!=="aktywne")aktywneFiltry.push(["status",`Kartoteka: ${filtrStatusuProduktow}`]);
  if(filtrSprzedazyProduktow!=="wszystkie")aktywneFiltry.push(["sprzedaz",`Sprzedaż: ${filtrSprzedazyProduktow}`]);
  if(filtrZrodlaProduktow!=="wszystkie")aktywneFiltry.push(["zrodlo",`Źródło: ${filtrZrodlaProduktow}`]);
  if(filtrDanychProduktow!=="wszystkie")aktywneFiltry.push(["dane",`Dane: ${filtrDanychProduktow}`]);
  if(filtrStanuProduktow!=="wszystkie")aktywneFiltry.push(["stan",`Magazyn: ${filtrStanuProduktow}`]);
  if(filtrAllegroProduktow!=="wszystkie")aktywneFiltry.push(["allegro",`Allegro: ${filtrAllegroProduktow}`]);
  if(filtrPromocjiProduktow!=="wszystkie")aktywneFiltry.push(["promocja",`Oferta: ${filtrPromocjiProduktow}`]);
  if(cenaOdAdminProduktow||cenaDoAdminProduktow)aktywneFiltry.push(["cena",`Cena: ${cenaOdAdminProduktow||"0"}–${cenaDoAdminProduktow||"∞"} zł`]);
  const aktywnyWidok=filtrStatusuProduktow==="kosz"?"kosz":filtrDanychProduktow==="gotowe"&&filtrSprzedazyProduktow==="dostepne"?"gotowe":filtrDanychProduktow==="braki"?"braki":filtrAllegroProduktow==="brak"?"bez-allegro":filtrSprzedazyProduktow==="niedostepne"?"ukryte":filtrPromocjiProduktow==="promocje"?"promocje":aktywneFiltry.length===0?"aktywne":"";
  const opcje=(lista,wartosc)=>lista.map(([v,l])=>`<option value="${esc(v)}" ${String(wartosc)===String(v)?"selected":""}>${esc(l)}</option>`).join("");
  return asortymentSzkielet("produkty", `
    <div class="panel assortment-catalog-page">
      <header class="assortment-catalog-hero">
        <div><span class="order-pro-label">Centralna kartoteka sprzedaży</span><h1>🏷️ Katalog produktów</h1><p>Jeden operacyjny widok produktów sklepu, magazynu i Allegro. Wyszukuj po wielu polach, łącz filtry i wykonuj operacje na całym wyniku bez utraty kontekstu.</p><small>${produkty.length} widocznych w sklepie • ${katalogWszystkie.length} wszystkich kart • ${producenciOpcje.length} producentów • wspólna baza danych</small></div>
        <div class="assortment-catalog-actions"><a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a><a class="btn ghost" href="#/admin/produkty/z-pliku">📄 Import linków</a><a class="btn ghost" href="#/admin/mapowanie">🧩 Mapowanie</a><a class="btn ghost" href="#/admin/eksport">⇄ Import / eksport</a><details><summary>Więcej operacji</summary><button class="btn ghost" onclick="eksportujProduktyJSON()">📤 Eksport JSON</button><button class="btn ghost" onclick="eksportujProduktyCSV()">📤 Eksport CSV</button></details></div>
      </header>
      <div class="assortment-search-primary">
        <label><span>Wyszukaj w całym asortymencie</span><input data-assortment-search placeholder="Nazwa, EXTERNAL_ID, SKU, EAN, ID, opis, kategoria lub producent…" value="${esc(szukajProduktow)}" oninput="asortymentSzukajProdukty(this)" autocomplete="off"></label>
        <small>Wyniki zmieniają się bez przeładowania panelu i bez utraty kursora.</small>
      </div>
      <nav class="assortment-saved-views" aria-label="Szybkie widoki katalogu">
        ${[["aktywne","🏷️ Aktywne",aktywneKarty.length],["gotowe","✅ Gotowe do sprzedaży",gotoweDoSprzedazy],["braki","⚠️ Braki danych",zBrakami],["bez-allegro","🟠 Bez Allegro",aktywneKarty.length-polaczoneAllegro],["ukryte","⏸️ Ukryte sprzedażowo",ukryteSprzedazowo],["promocje","🔥 Promocje",aktywneKarty.filter(p=>Number(p.staraCena)>Number(p.cena)).length],["kosz","🗑️ Kosz",liczbaWKoszu]].map(([v,l,n])=>`<button type="button" class="${aktywnyWidok===v?"active":""}" onclick="asortymentUstawWidok(${jsArg(v)})"><span>${l}</span><b>${n}</b></button>`).join("")}
      </nav>
      <div class="orders-stat-grid assortment-audit-grid">
        <button class="order-stat-card stat-filter ${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('aktywne')" aria-pressed="${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"}"><span>🏷️</span><b>${aktywneKarty.length}</b><small>aktywne karty produktów</small></button>
        <button class="order-stat-card stat-filter money ${filtrAllegroProduktow==="polaczone"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_polaczone')" aria-pressed="${filtrAllegroProduktow==="polaczone"}"><span>🟠</span><b>${polaczoneAllegro}</b><small>połączone z Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytAllegro.produkty?"hot":"money"} ${filtrAllegroProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_duplikaty')" aria-pressed="${filtrAllegroProduktow==="duplikaty"}"><span>${audytAllegro.produkty?"⚠️":"✅"}</span><b>${audytAllegro.produkty}</b><small>podejrzenie duplikatu Allegro</small></button>
        <button class="order-stat-card stat-filter ${filtrAllegroProduktow==="brak"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_brak')" aria-pressed="${filtrAllegroProduktow==="brak"}"><span>➕</span><b>${aktywneKarty.length-polaczoneAllegro}</b><small>bez oferty Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytSklep.produkty?"hot":"money"} ${filtrStatusuProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('duplikaty_sklepu')" aria-pressed="${filtrStatusuProduktow==="duplikaty"}"><span>${audytSklep.produkty?"🧬":"✅"}</span><b>${audytSklep.produkty}</b><small>karty w grupach duplikatów sklepu</small></button>
      </div>
      <details class="assortment-maintenance" ${filtrStatusuProduktow==="duplikaty"||filtrAllegroProduktow==="duplikaty"?"open":""}><summary><span><b>🧬 Kontrola duplikatów i porządkowanie</b><small>Rozwiń tylko wtedy, gdy chcesz porównać lub uporządkować powtarzające się karty.</small></span><span><strong>Sklep: ${audytSklep.produkty}</strong><strong>Allegro: ${audytAllegro.produkty}</strong></span></summary><div class="assortment-maintenance-body">
        ${audytSklep.grupy.length?`<section class="allegro-duplicate-center store-duplicate-center"><div class="order-section-head"><div><span class="order-pro-label">Porządkowanie katalogu sklepu</span><h3>Powtarzające się produkty (${audytSklep.grupy.length} grup)</h3><p class="order-detail-lead">Wybierz kartę główną dopiero po porównaniu identyfikatorów i danych.</p></div><button class="btn ghost" onclick="asortymentUstawFiltr('status','duplikaty')">Pokaż wszystkie kopie</button></div><div class="allegro-duplicate-groups">${audytSklep.grupy.slice(0,12).map(g=>`<article class="allegro-duplicate-group"><header><div><b>${esc(g.canonical.nazwa||"Produkt")}</b><small>Wspólny klucz: ${esc(g.keys.join(" • "))}</small></div><span class="lvl lvl-ostrzezenie">${g.produkty.length} kart</span></header><div class="allegro-duplicate-options">${g.produkty.map(p=>`<button type="button" class="allegro-duplicate-option ${String(p.id)===String(g.canonical.id)?"is-canonical":""}" onclick="ustawProduktGlownyDuplikatu(${jsArg(g.groupKey)},${jsArg(p.id)})"><div class="allegro-duplicate-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa)}</b><small>ID ${esc(p.id)} • EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||"—")}</small><em>${String(p.id)===String(g.canonical.id)?"✅ karta główna":"kopia do decyzji"}</em></div></div></button>`).join("")}</div><div class="diag-actions"><button class="btn danger" onclick="usunKopieGrupyProduktuTrwale(${jsArg(g.groupKey)})">🗑️ Pozostaw 1 i usuń trwale ${g.hidden.length} kopii</button></div></article>`).join("")}</div></section>`:`<div class="duplicate-audit-ok"><b>✅ Katalog sklepu:</b> brak powtarzających się produktów.</div>`}
        ${audytAllegro.produkty?`<div class="duplicate-audit-alert"><div><b>⚠️ Powtarzające się dopasowania Allegro</b><small>${audytAllegro.produkty} produktów pasuje do ${audytAllegro.oferty} ofert.</small></div><button class="btn ghost" onclick="asortymentUstawFiltr('allegro','duplikaty')">Pokaż produkty</button><a class="btn" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='duplikaty'">Otwórz oferty</a></div>`:`<div class="duplicate-audit-ok"><b>✅ Allegro:</b> brak produktów połączonych z więcej niż jedną ofertą.</div>`}
      </div></details>
      <details class="assortment-filter-panel admin-search-standard" open><summary><span><b>🔎 Wyszukiwanie zaawansowane</b><small>Łącz producenta, kategorię, kompletność danych, sprzedaż, magazyn, Allegro, ofertę i zakres ceny.</small></span><span class="admin-search-summary-meta" data-assortment-filter-summary>${aktywneFiltry.length?`<em>${aktywneFiltry.length} aktywnych</em>`:""}<strong>${liczbaWynikow} wyników</strong><i aria-hidden="true"></i></span></summary><div class="admin-search-standard-body assortment-advanced-grid">
        <label><span>Kategoria</span><select onchange="asortymentUstawFiltr('kategoria',this.value)"><option value="Wszystkie">Wszystkie kategorie</option>${katOpcje.map(k=>`<option value="${esc(k)}" ${k===filtrProduktow?"selected":""}>${esc(k)}</option>`).join("")}</select></label>
        <label><span>Producent</span><select onchange="asortymentUstawFiltr('producent',this.value)"><option value="wszyscy">Wszyscy producenci</option>${producenciOpcje.map(p=>`<option value="${esc(p)}" ${p===filtrProducentaProduktow?"selected":""}>${esc(p)}</option>`).join("")}</select></label>
        <label><span>Status kartoteki</span><select onchange="asortymentUstawFiltr('status',this.value)">${opcje([["aktywne","Tylko aktywne"],["wszystkie","Aktywne i kosz"],["kosz",`Tylko w koszu (${liczbaWKoszu})`],["duplikaty",`Powtarzające się (${audytSklep.produkty})`]],filtrStatusuProduktow)}</select></label>
        <label><span>Dostępność sprzedażowa</span><select onchange="asortymentUstawFiltr('sprzedaz',this.value)">${opcje([["wszystkie","Każda dostępność"],["dostepne","Widoczne w sprzedaży"],["niedostepne","Ukryte w sprzedaży"],["reczne","Wyłączone ręcznie"],["automat","Wyłączone automatycznie"]],filtrSprzedazyProduktow)}</select></label>
        <label><span>Źródło kartoteki</span><select onchange="asortymentUstawFiltr('zrodlo',this.value)">${opcje([["wszystkie","Każde źródło"],["bazowe","Katalog bazowy"],["wlasne","Dodane / importowane"]],filtrZrodlaProduktow)}</select></label>
        <label><span>Kompletność danych</span><select onchange="asortymentUstawFiltr('dane',this.value)">${opcje([["wszystkie","Każdy stan danych"],["gotowe","Kompletne kartoteki"],["braki","Dowolny brak danych"],["ean","Brak EAN"],["zdjecie","Brak zdjęcia"],["opis","Brak opisu krótkiego lub pełnego"],["producent","Brak producenta"],["kategoria","Brak kategorii"],["zrodlo","Brak linku źródłowego"],["koszt","Brak ceny zakupu (admin)"]],filtrDanychProduktow)}</select></label>
        <label><span>Stan magazynowy</span><select onchange="asortymentUstawFiltr('stan',this.value)">${opcje([["wszystkie","Każdy stan"],["dostepne","Powyżej 0 / bez limitu"],["niskie","Niski stan (1–5)"],["brak","Brak lokalnego stanu"]],filtrStanuProduktow)}</select></label>
        <label><span>Status Allegro</span><select onchange="asortymentUstawFiltr('allegro',this.value)">${opcje([["wszystkie","Wszystkie produkty"],["polaczone","Połączone z ofertą"],["aktywne","Aktywne oferty"],["szkice","Szkice / nieaktywne"],["brak","Bez oferty Allegro"],["duplikaty",`Podejrzane duplikaty (${audytAllegro.produkty})`]],filtrAllegroProduktow)}</select></label>
        <label><span>Oferta i promocja</span><select onchange="asortymentUstawFiltr('promocja',this.value)">${opcje([["wszystkie","Wszystkie ceny"],["promocje","Tylko promocje"],["regularne","Bez promocji"],["nowosci","Oznaczone jako nowość"]],filtrPromocjiProduktow)}</select></label>
        <label><span>Cena od</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaOdAdminProduktow)}" placeholder="0,00 zł" onchange="asortymentUstawFiltr('cenaOd',this.value)"></label>
        <label><span>Cena do</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaDoAdminProduktow)}" placeholder="bez limitu" onchange="asortymentUstawFiltr('cenaDo',this.value)"></label>
        <label><span>Sortowanie</span><select onchange="ustawSortowanieAdminProduktow(this.value)">${opcje([["external","EXTERNAL_ID / SKU (domyślnie)"],["id","ID produktu"],["nazwa","Nazwa A–Z"],["producent","Producent A–Z"],["kategoria","Kategoria A–Z"],["cena-rosnaco","Cena rosnąco"],["cena-malejaco","Cena malejąco"],["stan","Najniższy stan"],["braki-danych","Najwięcej braków danych"],["najnowsze","Najnowsze kartoteki"]],sortowanieAdminProduktow)}</select></label>
        <button class="btn ghost" type="button" onclick="asortymentResetujFiltry()">Wyczyść wszystkie filtry</button>
        <div class="assortment-filter-state admin-search-full" data-assortment-active-filters>${aktywneFiltry.length?`<b>Aktywne filtry:</b>${aktywneFiltry.map(([k,l])=>`<button type="button" onclick="asortymentWyczyscFiltr(${jsArg(k)})">${esc(l)} <span>×</span></button>`).join("")}<button class="clear-all" type="button" onclick="asortymentResetujFiltry()">Wyczyść wszystko</button>`:`<span>Brak dodatkowych filtrów — pokazujesz aktywne kartoteki.</span>`}</div>
        <div class="admin-search-standard-actions" data-assortment-operations>${adminOperacjeWynikowHTML({id:"assortment-products",selected:zaznaczoneProdukty.size,pageCount:fragment.length,resultCount:liczbaWynikow,selectPage:"asortymentZaznaczZakres('strona')",selectAll:"asortymentZaznaczZakres('filtr')",clear:"wyczyscZaznaczenieProduktow()",exportSelected:"asortymentEksportuj('zaznaczone')",exportAll:"asortymentEksportuj('filtr')"})}</div>
      </div></details>
      <div data-assortment-results>
      <div class="assortment-results-toolbar"><div><b>${liczbaWynikow} produktów</b><span>Pokazano ${zakresOd}–${zakresDo} • strona ${stronaAdminProduktow} z ${liczbaStron}</span></div><label>Na stronie<select onchange="ustawProduktyNaStronieAdmin(this.value)">${[25,50,100,200,500,1000].map(n=>`<option value="${n}" ${produktyNaStronieAdmin===n?"selected":""}>${n}</option>`).join("")}</select></label><label>Gęstość<select onchange="ustawGestoscAdminProduktow(this.value)"><option value="zwarta" ${gestoscAdminProduktow==="zwarta"?"selected":""}>Zwarta</option><option value="wygodna" ${gestoscAdminProduktow==="wygodna"?"selected":""}>Wygodna</option></select></label></div>
      <div class="pagination">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div>
      <div class="assortment-bulk-editor"><div><b>Zaznaczone: ${zaznaczoneProdukty.size}</b><small>Operacje dotyczą wyłącznie świadomie zaznaczonych kart.</small></div><button class="btn danger" onclick="usunZaznaczoneProd()" ${zaznaczoneProdukty.size?"":"disabled"}>🗑️ Przenieś do kosza</button><label>Zmiana cen<select id="trybCenProduktow"><option value="percent">O procent (+/−)</option><option value="amount">O kwotę (+/−)</option><option value="fixed">Ustaw cenę</option></select></label><input id="procentCen" placeholder="np. 10 lub -5" inputmode="decimal"><button class="btn ghost" onclick="zmienCenyZaznaczonych()" ${zaznaczoneProdukty.size?"":"disabled"}>💰 Zmień ceny</button></div>
      <div class="assortment-table-wrap"><table class="log-table assortment-product-table density-${gestoscAdminProduktow}">
        <thead><tr><th><input class="assortment-check" type="checkbox" onchange='zaznaczWidoczneProd(this, ${JSON.stringify(fragment.map(p=>p.id))})' title="Zaznacz produkty na tej stronie"></th><th>Produkt</th><th>Identyfikatory</th><th>Klasyfikacja i źródło</th><th>Ceny</th><th>Magazyn i sprzedaż</th><th>Allegro</th><th>Akcje</th></tr></thead><tbody>
        ${fragment.map(p=>{
          const dodany = jestProduktemDodanym(p.id);
          const ukryty = czyProduktAdminWKoszu(p);
          const edytowany = !!produktyEdytowane[p.id];
          const braki=asortymentBrakiDanych(p),sourceUrl=String(p.sourceUrl||p.producentUrl||p.urlProducenta||"").trim(),cena=kwotaNum(p.cena),promocja=Number(p.staraCena)>cena?Math.max(0,Math.round((1-cena/Number(p.staraCena))*100)):0;
          return `<tr class="${ukryty?"is-deleted":""} ${zaznaczoneProdukty.has(p.id)?"is-selected":""}">
          <td><input class="assortment-check" type="checkbox" ${zaznaczoneProdukty.has(p.id)?"checked":""} onchange="przelaczZaznProd(${jsArg(p.id)})"></td>
          <td><div class="assortment-product-cell"><span class="admin-product-thumb">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="admin-product-thumb-fallback" style="display:none">${esc(p.ikona||"📦")}</span>`:`<span class="admin-product-thumb-fallback">${esc(p.ikona||"📦")}</span>`}</span><div><b>${esc(p.nazwa||"Produkt bez nazwy")}</b><small>ID ${esc(p.id)}${dodany?" • dodany":""}${edytowany?" • edytowany":""}${ukryty?" • w koszu":""}</small><div class="assortment-data-status">${braki.length?`<span class="missing">⚠️ Braki: ${braki.slice(0,3).map(esc).join(", ")}${braki.length>3?` +${braki.length-3}`:""}</span>`:`<span class="complete">✅ Dane kompletne</span>`}${audytSklep.hiddenIds.has(String(p.id))?`<span class="duplicate">ukryta kopia</span>`:""}</div></div></div></td>
          <td><div class="assortment-identifiers"><span><small>EXTERNAL_ID</small><b>${esc(p.externalId||"—")}</b></span><span><small>SKU</small><b>${esc(p.sku||"—")}</b></span><span><small>EAN</small><b>${esc(p.gtin||p.ean||"—")}</b></span></div></td>
          <td><div class="assortment-classification"><b>${esc(p.producent||p.marka||"Bez producenta")}</b><span>${esc(p.kategoria||"Bez kategorii")}</span>${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">Źródło produktu ↗</a>`:`<small>Brak linku źródłowego</small>`}</div></td>
          <td><div class="assortment-price-cell"><label><input value="${String(cena.toFixed(2)).replace(".",",")}" inputmode="decimal" onchange="ustawCene(${jsArg(p.id)},this.value)"><span>zł</span></label>${promocja?`<span class="lvl lvl-blad">Promocja −${promocja}%</span>`:`<small>Cena regularna</small>`}<small class="private-cost">Zakup (admin): <b>${Number(p.cenaZakupu)>0?zl(p.cenaZakupu):"brak"}</b></small></div></td>
          <td><div class="assortment-stock-cell"><label><span>Stan</span><input value="${stanyProduktow[p.id]??""}" placeholder="∞" inputmode="numeric" onchange="ustawStan(${jsArg(p.id)},this.value)" class="${Number(stanyProduktow[p.id])===0?"empty":""}"></label>${dostepnoscBadgeAdmin(p)}<button class="btn ghost" onclick="przelaczDostepnoscProduktu(${jsArg(p.id)})">${produktAutomatycznieNiedostepny(p)?"Sprawdź i przywróć":produktOznaczonyNiedostepny(p)?"Włącz sprzedaż":"Wyłącz sprzedaż"}</button></div></td>
          <td>${allegroStatusProduktuHTML(p)}</td>
          <td><div class="assortment-row-actions">
            <a class="btn" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}" title="Edytuj produkt">✏️ Edytuj</a>
            <button class="btn ghost" onclick="duplikujProdukt(${jsArg(p.id)})" title="Duplikuj produkt">📄 Kopia</button>
            ${ukryty
              ? `<button class="btn ghost" onclick="przywrocProdukt(${jsArg(p.id)})" title="Przywróć">↩️ Przywróć</button>`
              : `<button class="btn danger" onclick="if(confirm('Przenieść produkt do kosza?')) usunProduktAdmin(${jsArg(p.id)})" title="Przenieś do kosza">🗑️ Kosz</button>`}
          </div></td>
        </tr>`;}).join("")}
        ${fragment.length?"":`<tr><td colspan="8"><div class="assortment-empty"><b>Brak produktów pasujących do filtrów</b><span>Usuń wybrane kryteria albo wróć do widoku aktywnych produktów.</span><button class="btn ghost" onclick="asortymentResetujFiltry()">Pokaż aktywne produkty</button></div></td></tr>`}
      </tbody></table></div>
      <div class="pagination">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div></div>
      <p class="assortment-sync-note"><b>☁️ Wspólna baza:</b> zmiany kartotek, cen, stanów i dostępności zapisują się centralnie i są widoczne na pozostałych urządzeniach po synchronizacji. Eksport pozostaje kopią roboczą lub narzędziem do operacji hurtowych.</p>
    </div>
    ${liczbaWKoszu ? `
    <div class="panel assortment-trash-panel">
      <div class="results-bar"><h2 style="margin:0">🗑️ Kosz (${liczbaWKoszu})</h2><button class="btn danger" onclick="wyczyscCalKosz()">Opróżnij kosz</button></div>
      <p style="font-size:.82rem;color:var(--muted2);margin-bottom:.6rem">Produkty pozostają w koszu przez 30 dni. W tym czasie możesz je przywrócić; później są automatycznie usuwane definitywnie.</p>
      <div class="assortment-table-wrap"><table class="log-table">
        <tr><th>Produkt</th><th>Typ</th><th>Usunięto</th><th>Wygasa</th><th>Akcje</th></tr>
        ${koszDodanych.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-info">własny</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocZKosza(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnie(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
        ${bazoweWKoszu.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-ostrzezenie">z products.json</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocProdukt(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnieBazowy(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
      </table></div>
    </div>`:""}`);
}
const EMOJI_ZESTAWY=[
  {nazwa:"🎲 Gry, zabawki i edukacja",slowa:"gry zabawki planszowe edukacja puzzle",emoji:["🎲","🧩","♟️","♞","🃏","🎯","🎮","🕹️","🪀","🪁","🧸","🤖","🧠","🔤","🔢","🧮","📚","📖","✏️","🖍️","🎨","🧪","🔬","🔭","🏆","🎳","⚽","🏀","🏓","🥏"]},
  {nazwa:"🎈 Balony, impreza i prezenty",slowa:"balony balon impreza urodziny prezent dekoracje",emoji:["🎈","🎉","🎊","🥳","🎁","🎀","🪅","🪩","🎂","🧁","🍭","🍬","✨","🌟","⭐","💫","❤️","🩷","🧡","💛","💚","🩵","💙","💜","🤍","🖤","🎵","🎶","📣","🔔"]},
  {nazwa:"🧒 Dzieci i kreatywność",slowa:"dzieci kreatywne plastyczne",emoji:["👶","🧒","👧","👦","🍼","🛝","🎠","🎡","🏰","🦄","🐸","🐻","🐼","🐰","🐣","🦋","🌈","☀️","🌙","☁️","🌸","🌻","🍀","🖌️","✂️"]},
  {nazwa:"📦 Sklep i dostawa",slowa:"sklep produkt paczka dostawa promocja",emoji:["📦","🛍️","🛒","🏷️","💰","💳","🧾","🚚","🚛","🚲","✈️","📍","🏪","🏬","✅","🆕","🔥","💥","📢","🔎"]},
  {nazwa:"🏠 Dom, ogród i pozostałe",slowa:"dom ogród narzędzia elektronika sport",emoji:["🏠","🪴","🌿","🌳","🌼","💡","🔧","🧰","🔨","📏","🔦","📱","💻","⌚","📷","🎧","🔋","⚙️","🚗","🚴","🏋️","🧘","👕","👟","🎒"]}
];
let emojiPoleDocelowe=null;
function emojiPoleHTML(nazwa="ikona",wartosc="",fallback="📦"){
  return `<div class="emoji-input-row"><input name="${esc(nazwa)}" value="${esc(wartosc||"")}" placeholder="${esc(fallback)}" maxlength="8"><button class="btn ghost" type="button" onclick="otworzWyborEmoji(this,${jsArg(nazwa)})">😀 Wybierz z dużej listy</button></div>`;
}
function otworzWyborEmoji(btn,nazwa="ikona"){
  const form=btn?.closest?.("form");
  emojiPoleDocelowe=form?.elements?.[nazwa]||null;
  if(!emojiPoleDocelowe){toast("Nie znaleziono pola ikony");return;}
  document.getElementById("emojiPickerModal")?.remove();
  const modal=document.createElement("div");
  modal.id="emojiPickerModal";modal.className="emoji-picker-overlay";
  modal.innerHTML=`<div class="emoji-picker-modal" onclick="event.stopPropagation()"><div class="emoji-picker-head"><div><h2>😀 Wybierz emoji</h2><p>Duży zestaw ikon — gry i balony są na początku.</p></div><button class="btn ghost" type="button" onclick="zamknijWyborEmoji()">✕ Zamknij</button></div><input class="emoji-picker-search" placeholder="Szukaj grupy: gry, balony, dostawa…" oninput="filtrujWyborEmoji(this.value)"><div class="emoji-picker-groups">${EMOJI_ZESTAWY.map(g=>`<section class="emoji-picker-group" data-search="${esc((g.nazwa+' '+g.slowa).toLowerCase())}"><h3>${esc(g.nazwa)}</h3><div class="emoji-picker-grid">${g.emoji.map(e=>`<button type="button" title="${esc(g.nazwa)}" onclick="wybierzEmoji(${jsArg(e)})">${esc(e)}</button>`).join("")}</div></section>`).join("")}</div></div>`;
  modal.onclick=zamknijWyborEmoji;document.body.appendChild(modal);
  modal.querySelector(".emoji-picker-search")?.focus();
}
function filtrujWyborEmoji(q){
  const s=String(q||"").trim().toLowerCase();
  document.querySelectorAll("#emojiPickerModal .emoji-picker-group").forEach(el=>{el.style.display=!s||String(el.dataset.search||"").includes(s)?"":"none";});
}
function wybierzEmoji(emoji){if(emojiPoleDocelowe){emojiPoleDocelowe.value=emoji;emojiPoleDocelowe.dispatchEvent(new Event("input",{bubbles:true}));}zamknijWyborEmoji();}
function zamknijWyborEmoji(){document.getElementById("emojiPickerModal")?.remove();emojiPoleDocelowe=null;}
const ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI=3;
function domyslneUstawieniaRentownosci(){
  const raw=ustawienia.domyslneKosztyRentownosci&&typeof ustawienia.domyslneKosztyRentownosci==="object"?ustawienia.domyslneKosztyRentownosci:{};
  const money=(v,fallback=0)=>Math.max(0,Math.min(100000,kwotaNum(v??fallback))),percent=(v,fallback=0)=>Math.max(0,Math.min(100,Number(v??fallback)||0));
  return {kosztPakowania:money(raw.kosztPakowania),sklepAdditionalCost:money(raw.sklepAdditionalCost),sklepPaymentPercent:percent(raw.sklepPaymentPercent),allegroAdditionalCost:money(raw.allegroAdditionalCost),allegroShippingSubsidy:money(raw.allegroShippingSubsidy,ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI),allegroAdsPercent:percent(raw.allegroAdsPercent),vatRate:percent(raw.vatRate,23)};
}
function wartoscKosztuProduktu(p={},pole){const v=p?.[pole];return v!==undefined&&v!==null&&String(v).trim()!==""?Math.max(0,Number(v)||0):domyslneUstawieniaRentownosci()[pole];}
function domyslneKosztyDoProduktu(p={},wymus=false){const d=domyslneUstawieniaRentownosci(),next={...p};for(const [pole,value] of Object.entries(d))if(wymus||next[pole]===undefined||next[pole]===null||String(next[pole]).trim()==="")next[pole]=value;return next;}
function zastosujDomyslneKosztyProduktow(wymus=false){
  const defaults=domyslneUstawieniaRentownosci(),lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));let changed=0;
  for(const p of lista){const patch={};for(const [pole,value] of Object.entries(defaults))if(wymus||p[pole]===undefined||p[pole]===null||String(p[pole]).trim()==="")patch[pole]=value;if(!Object.keys(patch).length)continue;const key=String(p.id),idx=produktyDodane.findIndex(x=>String(x.id)===key);if(idx>=0)produktyDodane[idx]={...produktyDodane[idx],...patch};else produktyEdytowane={...produktyEdytowane,[key]:{...(produktyEdytowane[key]||{}),...patch}};changed++;}
  if(changed){zapiszLS("artway_produkty_dodane",produktyDodane);zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();zaplanujZapisUstawien();}
  return changed;
}
function zapiszDomyslneUstawieniaRentownosci(event){
  event.preventDefault();const form=event.currentTarget,mode=String(event.submitter?.value||"defaults");if(mode==="all"&&!confirm("Nadpisać koszty operacyjne we wszystkich aktywnych produktach aktualnymi wartościami domyślnymi? Ceny zakupu i prowizje z API nie zostaną zmienione."))return;
  const n=name=>Math.max(0,Number(String(form.elements[name]?.value||"0").replace(",","."))||0),pct=name=>Math.min(100,n(name));
  const defaults={kosztPakowania:n("kosztPakowania"),sklepAdditionalCost:n("sklepAdditionalCost"),sklepPaymentPercent:pct("sklepPaymentPercent"),allegroAdditionalCost:n("allegroAdditionalCost"),allegroShippingSubsidy:n("allegroShippingSubsidy"),allegroAdsPercent:pct("allegroAdsPercent"),vatRate:pct("vatRate")};
  sklepDocelowaMarza=Math.max(1,Math.min(60,n("celMarzySklep")||20));allegroDocelowaMarza=Math.max(1,Math.min(60,n("celMarzyAllegro")||20));allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Math.floor(n("allegroJednostkiOplatCyklicznych")||10)));
  ustawienia={...ustawienia,celMarzySklep:sklepDocelowaMarza,celMarzyAllegro:allegroDocelowaMarza,allegroJednostkiOplatCyklicznych,domyslneKosztyRentownosci:defaults};zapiszLS("artway_ustawienia",ustawienia);zapiszLS("artway_cel_marzy_sklep",sklepDocelowaMarza);zapiszLS("artway_cel_marzy_allegro",allegroDocelowaMarza);
  const applyAll=mode==="all",applyMissing=applyAll||!!form.elements.applyMissing?.checked,changed=applyMissing?zastosujDomyslneKosztyProduktow(applyAll):0;zaplanujZapisUstawien();toast(`✅ Zapisano domyślne koszty i cele${applyMissing?` • zaktualizowano ${changed} produktów`:""}`);renderuj();
}
function domyslneUstawieniaRentownosciHTML(){const d=domyslneUstawieniaRentownosci();return `<details class="profit-defaults-panel" open><summary>⚙️ Domyślne koszty i cele</summary><form onsubmit="zapiszDomyslneUstawieniaRentownosci(event)"><p class="order-detail-lead">Te wartości są używane przy nowych produktach i wszędzie tam, gdzie kartoteka nie ma własnego kosztu. Wartość wpisana bezpośrednio w produkcie ma pierwszeństwo.</p><div class="profit-default-grid"><label>🏪 Cel marży sklepu (%)<input name="celMarzySklep" type="number" min="1" max="60" step="0.1" value="${esc(sklepDocelowaMarza)}"></label><label>🟠 Cel marży Allegro (%)<input name="celMarzyAllegro" type="number" min="1" max="60" step="0.1" value="${esc(allegroDocelowaMarza)}"></label><label>📦 Pakowanie / szt. (zł)<input name="kosztPakowania" inputmode="decimal" value="${esc(d.kosztPakowania)}"></label><label>🏪 Inne koszty sklepu / szt. (zł)<input name="sklepAdditionalCost" inputmode="decimal" value="${esc(d.sklepAdditionalCost)}"></label><label>💳 Płatność sklepu (% ceny)<input name="sklepPaymentPercent" inputmode="decimal" value="${esc(d.sklepPaymentPercent)}"></label><label>🟠 Inne koszty Allegro / szt. (zł)<input name="allegroAdditionalCost" inputmode="decimal" value="${esc(d.allegroAdditionalCost)}"></label><label>🚚 Dopłata do wysyłki Allegro (zł)<input name="allegroShippingSubsidy" inputmode="decimal" value="${esc(d.allegroShippingSubsidy)}"></label><label>📣 Reklama Allegro (% ceny)<input name="allegroAdsPercent" inputmode="decimal" value="${esc(d.allegroAdsPercent)}"></label><label>🧾 Domyślny VAT (%)<input name="vatRate" inputmode="decimal" value="${esc(d.vatRate)}"></label><label>🔁 Opłatę cykliczną podziel na (szt.)<input name="allegroJednostkiOplatCyklicznych" type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}"></label></div><label class="profit-default-check"><input type="checkbox" name="applyMissing" checked> Uzupełnij teraz tylko puste pola kosztowe w istniejących produktach</label><div class="diag-actions"><button class="btn" type="submit" value="defaults">💾 Zapisz ustawienia</button><button class="btn danger" type="submit" value="all">Zapisz i nadpisz koszty wszystkich produktów</button></div></form></details>`;}
function allegroRentownoscProduktu(p={},priceOverride=null,targetMargin=allegroDocelowaMarza){
  const price=kwotaNum(priceOverride??p.cenaAllegro??p.cena),purchase=kwotaNum(p.cenaZakupu),feePrice=kwotaNum(p.allegroFeePrice),savedCommission=kwotaNum(p.allegroCommissionAmount),savedRate=Math.max(0,Number(p.allegroCommissionRate)||0),commission=price>0?(feePrice&&Math.abs(feePrice-price)<.01?savedCommission:price*savedRate/100):0,recurringTotal=kwotaNum(p.allegroRecurringFees),recurringPerUnit=recurringTotal/Math.max(1,Number(allegroJednostkiOplatCyklicznych)||1),packing=wartoscKosztuProduktu(p,"kosztPakowania"),other=wartoscKosztuProduktu(p,"allegroAdditionalCost"),shipping=wartoscKosztuProduktu(p,"allegroShippingSubsidy"),adsRate=Math.max(0,wartoscKosztuProduktu(p,"allegroAdsPercent")),ads=price*adsRate/100,fixed=purchase+packing+other+shipping+recurringPerUnit,variableRate=savedRate/100+adsRate/100,profit=price-purchase-commission-recurringPerUnit-packing-other-shipping-ads,margin=price>0?profit/price*100:0,markup=purchase>0?profit/purchase*100:0,breakEven=1-variableRate>0?fixed/(1-variableRate):0,target=Math.max(0,Math.min(80,Number(targetMargin)||0))/100,recommended=1-variableRate-target>0?fixed/(1-variableRate-target):0;
  const dataComplete=purchase>0&&price>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))&&!!p.allegroFeeCalculatedAt;
  return {price,purchase,commission,commissionRate:savedRate,recurringTotal,recurringPerUnit,packing,other,shipping,ads,adsRate,profit:+profit.toFixed(2),margin:+margin.toFixed(2),markup:+markup.toFixed(2),breakEven:+breakEven.toFixed(2),recommended:+recommended.toFixed(2),dataComplete,feeCurrent:!!feePrice&&Math.abs(feePrice-price)<.01,positive:profit>0};
}
function sklepRentownoscProduktu(p={},priceOverride=null,targetMargin=sklepDocelowaMarza){
  const price=kwotaNum(priceOverride??p.cena),purchase=kwotaNum(p.cenaZakupu),packing=wartoscKosztuProduktu(p,"kosztPakowania"),other=wartoscKosztuProduktu(p,"sklepAdditionalCost"),paymentRate=Math.max(0,wartoscKosztuProduktu(p,"sklepPaymentPercent")),payment=price*paymentRate/100,fixed=purchase+packing+other,variableRate=paymentRate/100,profit=price-fixed-payment,margin=price>0?profit/price*100:0,markup=purchase>0?profit/purchase*100:0,breakEven=1-variableRate>0?fixed/(1-variableRate):0,target=Math.max(0,Math.min(80,Number(targetMargin)||0))/100,recommended=1-variableRate-target>0?fixed/(1-variableRate-target):0;
  return {price,purchase,packing,other,payment,paymentRate,profit:+profit.toFixed(2),margin:+margin.toFixed(2),markup:+markup.toFixed(2),breakEven:+breakEven.toFixed(2),recommended:+recommended.toFixed(2),dataComplete:purchase>0&&price>0};
}
function ustawCelMarzy(kanal,value){const v=Math.max(1,Math.min(60,Number(value)||20));if(kanal==="sklep"){sklepDocelowaMarza=v;ustawienia={...ustawienia,celMarzySklep:v};zapiszLS("artway_cel_marzy_sklep",v);}else{allegroDocelowaMarza=v;ustawienia={...ustawienia,celMarzyAllegro:v};zapiszLS("artway_cel_marzy_allegro",v);}zapiszLS("artway_ustawienia",ustawienia);zaplanujZapisUstawien();renderuj();}
function allegroZapiszProwizjeLokalnie(productId,summary={}){
  const patch={allegroCommissionAmount:kwotaNum(summary.commissionAmount),allegroCommissionRate:Number(summary.commissionRate)||0,allegroRecurringFees:kwotaNum(summary.recurringFees),allegroFeeTotal:kwotaNum(summary.totalPreviewFees),allegroFeePrice:kwotaNum(summary.salePrice),allegroFeeCurrency:summary.currency||"PLN",allegroFeeDetails:{commissions:summary.commissions||[],quotes:summary.quotes||[]},allegroFeeCalculatedAt:summary.calculatedAt||new Date().toISOString(),allegroFeeSource:summary.source||"allegro-offer-fee-preview"};
  zapiszPolaProduktuLokalnie(productId,patch,false);zaplanujZapisUstawien();return patch;
}
async function allegroPobierzProwizjeProduktu(productId,button=null,options={}){
  const form=button?.closest?.("form"),base=pobierzProduktAdmin(Number(productId))||produkty.find(p=>String(p.id)===String(productId))||{},product=form?produktRoboczyAllegroZFormularza(form,productId,base):base,offer=allegroOfertaDlaProduktuSklepu(product),offerId=String(product.allegroOfferId||offer?.id||"").trim(),price=kwotaNum(form?.elements?.cenaAllegro?.value)||kwotaNum(product.cenaAllegro||product.cena);
  if(!price){toast("Uzupełnij cenę Allegro");return null;}if(button)button.disabled=true;
  try{if(!options.silent)toast("🟠 Pobieram aktualne prowizje i opłaty z Allegro…");const d=await chmura("allegro-fee-preview",{method:"POST",body:{productId:String(productId),product,offerId,price,save:true},timeout:90000});const patch=allegroZapiszProwizjeLokalnie(productId,d.summary||{});if(form){for(const [name,value] of Object.entries({allegroCommissionAmount:patch.allegroCommissionAmount,allegroCommissionRate:patch.allegroCommissionRate,allegroRecurringFees:patch.allegroRecurringFees,allegroFeePrice:patch.allegroFeePrice,allegroFeeCalculatedAt:patch.allegroFeeCalculatedAt}))if(form.elements[name])form.elements[name].value=value;aktualizujKalkulatorCenProduktu(form);}if(!options.silent)toast(`✅ Prowizja ${zl(patch.allegroCommissionAmount)} (${Number(patch.allegroCommissionRate).toFixed(2)}%) • opłaty cykliczne ${zl(patch.allegroRecurringFees)}`);if(!form&&!options.silent)renderuj();return d;}catch(e){if(!options.silent)toast("⚠️ Kalkulator opłat Allegro: "+(e.message||e));return null;}finally{if(button)button.disabled=false;}
}
async function allegroPobierzProwizjeMasowo(){
  const complete=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))).slice(0,25);if(!complete.length){toast("Brak produktów z pełnymi danymi do kalkulacji");return;}
  toast(`Pobieram prowizje dla ${complete.length} kompletnych produktów…`);let ok=0,fail=0;for(const p of complete){const r=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});r?ok++:fail++;}toast(`Kalkulacja prowizji zakończona: ${ok} poprawnie, ${fail} błędów`);renderuj();
}
async function ustawRekomendowanaCeneProduktu(productId,kanal,price,targetMargin=null){
  const value=kwotaNum(price);if(!value)return;const p=pobierzProduktAdmin(Number(productId));if(!p)return;
  const appliedMargin=Number.isFinite(Number(targetMargin))?+Number(targetMargin).toFixed(2):null;
  if(kanal==="sklep"){zapiszPolaProduktuLokalnie(productId,{cena:value,sklepPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{sklepPriceTargetMargin:appliedMargin})},false);zaplanujZapisUstawien();toast(`✅ Cena w sklepie została ustawiona na ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`}`);renderuj();return;}
  zapiszPolaProduktuLokalnie(productId,{cenaAllegro:value,allegroPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{allegroPriceTargetMargin:appliedMargin}),allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},false);zaplanujZapisUstawien();toast(`🟠 Ustawiono ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`} i aktualizuję ofertę Allegro…`);
  const next={...p,cenaAllegro:value,allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI};await allegroSynchronizujPowiazanyProduktPoZapisie(next,{forceFees:true});renderuj();
}
function allegroUstawRekomendowanaCene(productId,price){return ustawRekomendowanaCeneProduktu(productId,"allegro",price);}
function aktualizujKalkulatorCenProduktu(form){
  if(!form)return;
  const sklep=kwotaNum(form.elements.cena?.value),allegro=kwotaNum(form.elements.cenaAllegro?.value)||sklep,zakup=kwotaNum(form.elements.cenaZakupu?.value);
  const el=form.querySelector("[data-product-margin]");if(!el)return;
  const product={cena:sklep,cenaAllegro:allegro,cenaZakupu:zakup,allegroCommissionAmount:form.elements.allegroCommissionAmount?.value,allegroCommissionRate:form.elements.allegroCommissionRate?.value,allegroRecurringFees:form.elements.allegroRecurringFees?.value,allegroFeePrice:form.elements.allegroFeePrice?.value||allegro,kosztPakowania:form.elements.kosztPakowania?.value,sklepAdditionalCost:form.elements.sklepAdditionalCost?.value,sklepPaymentPercent:form.elements.sklepPaymentPercent?.value,allegroAdditionalCost:form.elements.allegroAdditionalCost?.value,allegroShippingSubsidy:form.elements.allegroShippingSubsidy?.value||ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI,allegroAdsPercent:form.elements.allegroAdsPercent?.value,allegroFeeCalculatedAt:form.elements.allegroFeeCalculatedAt?.value},r=allegroRentownoscProduktu(product,allegro),s=sklepRentownoscProduktu(product,sklep);
  el.innerHTML=`<span><small>Sklep • cena</small><b>${sklep?zl(sklep):"—"}</b></span><span class="${s.profit<0?"is-negative":""}"><small>Sklep • zysk/marża</small><b>${zakup?`${zl(s.profit)} • ${s.margin.toFixed(1)}%`:"—"}</b></span><span><small>Sklep • cel ${sklepDocelowaMarza}%</small><b>${zakup?zl(s.recommended):"—"}</b></span><span><small>Allegro • cena</small><b>${allegro?zl(allegro):"—"}</b></span><span><small>Allegro • prowizja</small><b>${r.commission?`${zl(r.commission)} • ${r.commissionRate.toFixed(2)}%`:"—"}</b></span><span class="${r.profit<0?"is-negative":""}"><small>Allegro • zysk/marża</small><b>${zakup?`${zl(r.profit)} • ${r.margin.toFixed(1)}%`:"—"}</b></span><span><small>Allegro • cel ${allegroDocelowaMarza}%</small><b>${zakup?zl(r.recommended):"—"}</b></span>`;
}
function agentAIStanWdrozeniaProduktu(p={}){
  const checks=[
    {id:"identity",label:"EAN lub kod",ok:!!(p.gtin||p.ean||p.mpn||p.kodProducenta)},
    {id:"content",label:"Opis krótki i pełny",ok:!!(p.opisKrotki&&p.opis)},
    {id:"images",label:"Zdjęcie",ok:!!p.zdjecie},
    {id:"producer",label:"Producent",ok:!!(p.producent||p.marka)},
    {id:"store",label:"Cena i kategoria sklepu",ok:!!(kwotaNum(p.cena)>0&&p.kategoria)},
    {id:"allegro",label:"Kategoria/katalog Allegro",ok:!!(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean))}
  ];
  return {checks,done:checks.filter(x=>x.ok).length,total:checks.length,ready:checks.every(x=>x.ok)};
}
function agentAIWdrozenieProduktuHTML(p={},edycja=false){
  const state=agentAIStanWdrozeniaProduktu(p),status=p.agentOnboardingStatus||(!p.id?"new":"not_started"),busy=status==="processing";
  return `<section class="product-agent-onboarding ${state.ready?"is-ready":busy?"is-busy":"needs-work"}"><header><div><span class="order-pro-label">Najwyższy priorytet przy dodawaniu</span><h3>🤖 Agent wdrożenia produktu</h3><p>Agent pilnuje kompletności, duplikatów, opisów, zdjęć, producenta, kategorii sklepu i przygotowania Allegro.</p></div><strong>${state.done}/${state.total}</strong></header><div class="product-agent-checks">${state.checks.map(x=>`<span class="${x.ok?"done":"wait"}">${x.ok?"✓":"○"} ${esc(x.label)}</span>`).join("")}</div><footer><small>${state.ready?"Produkt ma komplet kluczowych danych.":busy?"Agent kończy kontrolę i uzupełnianie danych…":"Brakujące pola pozostają widoczne i trafią do planu operacyjnego Agenta."}</small>${edycja?`<button class="btn" type="button" onclick="agentAIUruchomWdrozenieProduktu(${jsArg(p.id)},this)" ${busy?"disabled":""}>${busy?"⏳ Kontrola…":"🤖 Sprawdź i uzupełnij"}</button>`:""}</footer></section>`;
}
async function agentAIUruchomWdrozenieProduktu(id,button=null){
  const product=pobierzProduktAdmin(Number(id));if(!product)return null;
  if(button)button.disabled=true;zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:"processing",agentOnboardingStartedAt:new Date().toISOString()},false);renderuj();
  const result=await allegroSynchronizujPowiazanyProduktPoZapisie(product,{forceFees:true}),updated=pobierzProduktAdmin(Number(id))||product,state=agentAIStanWdrozeniaProduktu(updated),status=result?.ok&&state.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:status,agentOnboardingCompletedAt:status==="completed"?new Date().toISOString():"",agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingMissing:state.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${status==="completed"?"Zakończono":"Sprawdzono"} wdrożenie produktu: ${updated.nazwa||id}`,{produktId:id,status,missing:state.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();toast(status==="completed"?"✅ Agent zakończył wdrożenie produktu":"⚠️ Agent wskazał pola wymagające uzupełnienia");renderuj();return {result,status};
}
function formularzProduktu(p, tryb){
  p=domyslneKosztyDoProduktu(p||{},false);
  const wszystkie = produktyDoAdministracji();
  const edycja = tryb==="edycja";
  const kontrolaDodawania=edycja?null:produktDodawanieStanKontroli(p,{});
  const maTozsamoscProduktu=!!(p.allegroOfferId||p.allegroProductId||p.gtin||p.ean||p.externalId||p.sku||p.nazwa);
  const ofertaAllegro=maTozsamoscProduktu?allegroOfertaDlaProduktuSklepu(p):null,ofertaAllegroId=String(p.allegroOfferId||ofertaAllegro?.id||"").trim(),rentownosc=allegroRentownoscProduktu(p),rentownoscSklep=sklepRentownoscProduktu(p),seoDanePodgladu=seoEfektywneDaneProduktu(p);
  return `
    <form class="product-editor-form" data-product-id="${esc(p.id||0)}" ${!edycja?`data-product-add-form data-product-duplicate-fingerprint="${esc(kontrolaDodawania.fingerprint)}" oninput="produktDodawanieZmienione(event,this)" onchange="produktDodawanieZmienione(event,this)"`:""} onsubmit="${edycja?`zapiszProduktAdmin(event,${p.id})`:"dodajProdukt(event)"}">
      ${agentAIWdrozenieProduktuHTML(p,edycja)}
      ${!edycja?`<section class="product-add-control" data-product-add-control>${produktDodawanieKontrolaHTML(p,{})}</section>`:""}
      ${!edycja?`<section class="product-link-one-workspace product-link-inline-workspace"><div class="order-section-head"><div><span class="order-pro-label">Opcjonalne automatyczne uzupełnienie</span><h3>🔗 Pobierz dane z linku produktu</h3><p class="order-detail-lead">Wklej adres konkretnego produktu albo od razu wypełnij formularz ręcznie. Agent jedynie uzupełni pola — nic nie zostanie dodane bez Twojego zatwierdzenia na dole formularza.</p></div><span class="lvl lvl-ok">bez automatycznego zapisu</span></div><label for="oneProductUrl">Adres konkretnego produktu</label><div class="product-link-one-input"><input id="oneProductUrl" data-one-link-url name="producentUrl" type="url" value="${esc(p.producentUrl||p.sourceUrl||"")}" placeholder="https://strona-producenta.pl/konkretny-produkt"><button class="btn" type="button" onclick="pobierzDaneProduktuZUrl(this)">🤖 Pobierz i uzupełnij formularz</button></div><label class="check product-link-overwrite"><input type="checkbox" name="nadpiszImportUrl"> Nadpisz również pola wpisane przeze mnie</label><small>Po pobraniu sprawdź nazwę, cenę, opis, zdjęcia i kody. Dopiero przycisk „Zatwierdź i dodaj produkt” zapisze kartotekę.</small><div data-product-link-agent-result></div></section>`:""}
      <div class="f-row">
        <div class="f-group"><label>Nazwa *</label><input required name="nazwa" value="${esc(p.nazwa||"")}"></div>
        <div class="f-group"><label>Kategoria *</label><input required name="kategoria" list="katLista" placeholder="np. Elektronika" value="${esc(p.kategoria||kategoriaNowegoProduktu)}">
          <datalist id="katLista">${[...new Set([...wszystkieKategorie(), ...wszystkie.map(x=>x.kategoria)])].map(k=>`<option value="${esc(k)}">`).join("")}</datalist></div>
      </div>
      <div class="product-price-grid">
        <div class="f-group"><label>Cena w sklepie (zł) *</label><input required name="cena" inputmode="decimal" value="${p.cena??""}" placeholder="99.99" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div>
        <div class="f-group"><label>Cena na Allegro (zł)</label><input name="cenaAllegro" inputmode="decimal" value="${p.cenaAllegro??""}" placeholder="pusta = cena sklepu" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Ta cena jest wysyłana do oferty Allegro.</small></div>
        <div class="f-group"><label>🔒 Cena zakupu brutto (zł) — tylko administrator</label><input name="cenaZakupu" inputmode="decimal" value="${p.cenaZakupu??""}" placeholder="wewnętrzna" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Dane prywatne: niewidoczne dla klientów i Allegro, usuwane z publicznego API, products.json, Google/SEO i publikacji sklepu.${p.cenaZakupuNetto!==undefined?`<br>Netto z faktury: ${zl(p.cenaZakupuNetto)} • VAT: ${zl(p.cenaZakupuVat||0)}`:""}${p.cenaZakupuZrodlo?`<br>Źródło: ${esc(p.cenaZakupuZrodlo)} • ${esc(p.cenaZakupuDokument||"")} • ${esc(p.cenaZakupuDostawca||"")} • ${esc(p.cenaZakupuDataDokumentu||"")} • ${esc(p.cenaZakupuDopasowanie||"")}`:""}</small></div>
        <div class="f-group"><label>Stara cena (promocja)</label><input name="staraCena" inputmode="decimal" value="${p.staraCena??""}"></div>
      </div>
      <div class="product-margin-preview" data-product-margin><span><small>Sklep • cena</small><b>${p.cena?zl(p.cena):"—"}</b></span><span class="${rentownoscSklep.profit<0?"is-negative":""}"><small>Sklep • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownoscSklep.profit)} • ${rentownoscSklep.margin.toFixed(1)}%`:"—"}</b></span><span><small>Sklep • cel ${sklepDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownoscSklep.recommended):"—"}</b></span><span><small>Allegro • cena</small><b>${rentownosc.price?zl(rentownosc.price):"—"}</b></span><span><small>Allegro • prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(rentownosc.commission)} • ${rentownosc.commissionRate.toFixed(2)}%`:"—"}</b></span><span class="${rentownosc.profit<0?"is-negative":""}"><small>Allegro • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownosc.profit)} • ${rentownosc.margin.toFixed(1)}%`:"—"}</b></span><span><small>Allegro • cel ${allegroDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownosc.recommended):"—"}</b></span></div>
      <section class="product-profit-editor"><div class="order-section-head"><div><span class="order-pro-label">Dane wewnętrzne</span><h3>📈 Koszty sklepu i Allegro</h3><p class="order-detail-lead">Kanały są liczone oddzielnie. Prowizja jest pobierana z oficjalnego kalkulatora Allegro, a sklep ma własne koszty płatności i obsługi.</p></div><div class="diag-actions">${edycja?`<button class="btn" type="button" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">🟠 Pobierz prowizję</button>`:""}${ofertaAllegroId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(ofertaAllegroId)}" target="_blank" rel="noopener">↗ Otwórz ofertę</a>`:""}<a class="btn ghost" href="#/admin/allegro/rentownosc">Kalkulator marży</a></div></div><input type="hidden" name="allegroFeePrice" value="${esc(p.allegroFeePrice??p.cenaAllegro??p.cena??"")}"><div class="product-profit-fields"><div class="f-group"><label>Prowizja Allegro (zł)</label><input name="allegroCommissionAmount" inputmode="decimal" value="${esc(p.allegroCommissionAmount??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Kwota dla ceny ${p.allegroFeePrice?zl(p.allegroFeePrice):"—"}.</small></div><div class="f-group"><label>Prowizja Allegro (%)</label><input name="allegroCommissionRate" inputmode="decimal" value="${esc(p.allegroCommissionRate??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Opłaty Allegro cykliczne (zł)</label><input name="allegroRecurringFees" inputmode="decimal" value="${esc(p.allegroRecurringFees??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt pakowania / szt. (oba kanały)</label><input name="kosztPakowania" inputmode="decimal" value="${esc(p.kosztPakowania??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Inne koszty sklepu / szt.</label><input name="sklepAdditionalCost" inputmode="decimal" value="${esc(p.sklepAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt płatności sklepu (% ceny)</label><input name="sklepPaymentPercent" inputmode="decimal" value="${esc(p.sklepPaymentPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Inne koszty Allegro / szt.</label><input name="allegroAdditionalCost" inputmode="decimal" value="${esc(p.allegroAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Dopłata do wysyłki Allegro / szt.</label><input name="allegroShippingSubsidy" inputmode="decimal" value="${esc(p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI)}" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Domyślnie zawsze 3,00 zł.</small></div><div class="f-group"><label>Reklama Allegro (% ceny)</label><input name="allegroAdsPercent" inputmode="decimal" value="${esc(p.allegroAdsPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>VAT sprzedaży (%)</label><input name="vatRate" inputmode="decimal" value="${esc(p.vatRate??23)}"></div><div class="f-group"><label>Ostatnie wyliczenie API</label><input name="allegroFeeCalculatedAt" value="${esc(p.allegroFeeCalculatedAt||"")}" readonly><small>${p.allegroFeeCalculatedAt?esc(allegroDataTxt(p.allegroFeeCalculatedAt)):"jeszcze nie pobrano"}</small></div></div><div class="profit-channel-grid"><article><small>Sklep • zysk / marża</small><b>${p.cenaZakupu?`${zl(rentownoscSklep.profit)} • ${rentownoscSklep.margin.toFixed(2)}%`:"—"}</b><span>Cel ${sklepDocelowaMarza}%: ${p.cenaZakupu?zl(rentownoscSklep.recommended):"—"}</span></article><article><small>Allegro • zysk / marża</small><b>${p.cenaZakupu?`${zl(rentownosc.profit)} • ${rentownosc.margin.toFixed(2)}%`:"—"}</b><span>Cel ${allegroDocelowaMarza}%: ${p.cenaZakupu?zl(rentownosc.recommended):"—"}</span></article></div></section>
      <div class="f-row">
        <div class="f-group"><label>Etykieta</label><select name="badge"><option value="">— brak —</option><option ${p.badge==="Nowość"?"selected":""}>Nowość</option><option ${p.badge==="Promocja"?"selected":""}>Promocja</option></select></div>
        <div class="f-group"><label>Ikona (emoji)</label>${emojiPoleHTML("ikona",p.ikona||"","📦")}</div>
        <div class="f-group"><label>Zdjęcie — link lub wgraj z dysku</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie" value="${esc(p.zdjecie||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML("wgrajZdjecieProduktu(this)", "Z dysku")}
          </div>
        </div>
      </div>
      <div id="podgladZdjecia">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="Podgląd ${esc(p.nazwa||'produktu')}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:.6rem">`:""}</div>
      <details ${p.zdjecia?.length?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🖼️ Galeria — ręczna edycja do 16 zdjęć</summary>
        ${Array.from({length:15},(_,i)=>i+2).map(n=>`
        <div class="f-group" style="margin-top:.6rem"><label>Zdjęcie ${n}</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie${n}" value="${esc((p.zdjecia||[])[n-2]||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML(`wgrajZdjecieDoPola(this,'zdjecie${n}')`, "Z dysku")}
          </div>
        </div>`).join("")}
      </details>
      <div class="f-row">
        <div class="f-group"><label>Kod produktu (SKU) <small style="font-weight:400;color:var(--muted2)">opcjonalnie</small></label><input name="sku" value="${esc(p.sku||"")}" placeholder="np. ATM-0001" maxlength="30"></div>
        <div class="f-group"><label>Warianty <small style="font-weight:400;color:var(--muted2)">po przecinku, np. S, M, L, XL</small></label><input name="warianty" value="${esc((p.warianty||[]).join(", "))}" placeholder="np. S, M, L, XL albo Czarny, Biały"></div>
      </div>
      <details ${(p.gtin||p.externalId||p.mpn||p.producent||p.marka||p.kolorProduktu||p.rozmiar||p.material)?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🏷️ Dane z hurtowni / OVF</summary>
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>GTIN / EAN</label><input name="gtin" value="${esc(p.gtin||"")}" placeholder="np. 5901234567891"></div>
          <div class="f-group"><label>EXTERNAL_ID</label><input name="externalId" value="${esc(p.externalId||"")}" placeholder="ID z hurtowni"></div>
          <div class="f-group"><label>MPN</label><input name="mpn" value="${esc(p.mpn||"")}" placeholder="Kod producenta"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Producent *</label><input name="producent" list="allegroProducerList" value="${esc(allegroProducentKanoniczny(p)||p.producent||p.marka||"")}" placeholder="np. Alexander"><datalist id="allegroProducerList">${allegroListaProducentow().map(name=>`<option value="${esc(name)}">`).join("")}</datalist><small>Lista jest zarządzana w Allegro → Ustawienia.</small></div>
          <div class="f-group"><label>Marka / BRAND</label><input name="marka" value="${esc(p.marka||"")}"></div>
          <div class="f-group"><label>Kolor produktu / COLOR</label><input name="kolorProduktu" value="${esc(p.kolorProduktu||"")}" placeholder="np. Czarny matowy"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Rozmiar / SIZE</label><input name="rozmiar" value="${esc(p.rozmiar||"")}" placeholder="np. XL lub 85x60x60 cm"></div>
          <div class="f-group"><label>Materiał / MATERIAL</label><input name="material" value="${esc(p.material||"")}" placeholder="np. bawełna, karton, stal"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Kod producenta</label><input name="kodProducenta" value="${esc(p.kodProducenta||"")}" placeholder="np. 2282 lub kod katalogowy"></div>
          <div class="f-group"><label>Dostępność u producenta</label><input name="dostepnoscProducenta" value="${esc(p.dostepnoscProducenta||"")}" placeholder="dostępny / niedostępny / do sprawdzenia"></div>
          <div class="f-group"><label>Zweryfikowane źródło produktu</label>${edycja?`${p.sourceUrl||p.producentUrl?`<input name="sourceUrl" value="${esc(p.sourceUrl||p.producentUrl||"")}" readonly>`:`<input type="hidden" name="sourceUrl" value="">`}<input type="hidden" name="producentUrl" value="${esc(p.producentUrl||p.sourceUrl||"")}"><small>Adres pochodzi z kartoteki produktu.</small>`:`<input type="hidden" name="sourceUrl" value="${esc(p.sourceUrl||p.producentUrl||"")}"><small>Źródło uzupełnia się z pola na górze formularza.</small>`}</div>
        </div>
        <input type="hidden" name="stanProducenta" value="${esc(p.stanProducenta??"")}"><input type="hidden" name="stanProducentaDokladny" value="${p.stanProducentaDokladny?"1":""}"><input type="hidden" name="stanProducentaZrodlo" value="${esc(p.stanProducentaZrodlo||"")}"><input type="hidden" name="producentStatus" value="${esc(p.producentStatus||"")}"><input type="hidden" name="producentSprawdzonoAt" value="${esc(p.producentSprawdzonoAt||"")}">
        <div class="supplier-editor-status">${producentDostepnoscBadgeHTML(p)}${edycja&&/^https?:\/\//i.test(String(p.producentUrl||p.sourceUrl||""))?`<button class="btn ghost" type="button" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź stan u producenta</button>`:""}</div>
        ${p.sourceEvidence?.canonicalUrl||p.sourceEvidence?.url?`<div class="product-source-evidence"><div><span>🔎 Zweryfikowane źródło danych</span><b>${esc(p.sourceEvidence.host||(()=>{try{return new URL(p.sourceEvidence.canonicalUrl||p.sourceEvidence.url).hostname;}catch(e){return "strona produktu";}})())}</b><small>Odczyt: ${esc(p.sourceEvidence.fetchedAt?new Date(p.sourceEvidence.fetchedAt).toLocaleString("pl-PL"):"brak daty")} • pewność Agenta ${esc(p.agentImportConfidence||0)}%</small></div><a class="btn ghost" href="${esc(p.sourceEvidence.canonicalUrl||p.sourceEvidence.url)}" target="_blank" rel="noopener">Otwórz źródło ↗</a><details><summary>Pobrane informacje (${esc((p.sourceEvidence.fields||[]).length)})</summary><p>${esc((p.sourceEvidence.fields||[]).join(" • ")||"nazwa • cena • opis • zdjęcia • parametry • dostępność")}</p></details></div>`:""}
      </details>
      <details ${(p.allegroCategoryId||p.allegroProductId||p.allegroOfferId)?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🟠 Allegro — dane do wystawienia</summary>
        ${allegroOstatniWynikWystawienia?.produktId===String(p.id)?allegroWynikOperacjiHTML():""}
        <div class="backend-note" style="margin-top:.7rem"><b>Status produktu:</b> ${allegroStatusProduktuHTML(p)}<br><small>Przy zapisie sklep sprawdza ID oferty, external.id/SKU, EAN i kod producenta. Istniejąca oferta zostanie zaktualizowana, a nie powielona.</small></div>
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>ID kategorii Allegro *</label><input name="allegroCategoryId" value="${esc(p.allegroCategoryId||"")}" placeholder="wymagane do wystawienia"></div>
          <div class="f-group"><label>ID produktu Allegro</label><input name="allegroProductId" value="${esc(p.allegroProductId||"")}" placeholder="opcjonalnie, jeśli znany"></div>
          <div class="f-group"><label>ID oferty Allegro</label><input name="allegroOfferId" value="${esc(p.allegroOfferId||"")}" placeholder="uzupełni się po wystawieniu"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Szukaj w katalogu Allegro</label><input name="allegroCategoryPhrase" value="${esc(p.allegroCategoryPhrase||"")}" placeholder="np. gry planszowe, zabawki kreatywne albo nazwa produktu"></div>
          <div class="f-group"><label>Dobieranie kategorii</label><button class="btn ghost" type="button" onclick="allegroDobierzKategorieProduktu(${edycja?jsArg(p.id):"0"},this)">🔎 Dobierz kategorię Allegro</button></div>
        </div>
        <div id="allegroCategoryPreview"></div>
        <div class="f-row">
          <div class="f-group"><label>Stan oferty Allegro <small style="font-weight:400;color:var(--muted2)">(ustawienie globalne; nie zmienia magazynu)</small></label><input name="allegroStock" type="number" value="${allegroStanOfertyProduktu()}" readonly><small>Każda oferta otrzymuje ${allegroStanOfertyProduktu()} szt. i automatyczne wznawianie. Zmienisz to w Ustawieniach Allegro.</small></div>
          <div class="f-group"><label>Publikacja oferty</label><select id="allegroPublicationAction"><option value="keep">Nowa: szkic / istniejąca: zachowaj status</option><option value="activate">Aktywuj po zapisie</option><option value="deactivate">Zapisz jako nieaktywną</option></select></div>
        </div>
        <div class="diag-actions">
          ${edycja?`<button class="btn ghost" type="button" onclick="allegroPrzygotujSzkicProduktu(${jsArg(p.id)})">🧾 Sprawdź szkic Allegro</button>
          <button class="btn" type="button" onclick="allegroWystawProdukt(${jsArg(p.id)})">${allegroOfertaDlaProduktuSklepu(p)?"🤖 Agent: aktualizuj ofertę Allegro":"🤖 Agent: dodaj ofertę Allegro"}</button>${ofertaAllegroId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(ofertaAllegroId)}" target="_blank" rel="noopener">↗ Otwórz istniejącą ofertę</a>`:""}`:`<span style="color:var(--muted2);font-size:.85rem">Najpierw zapisz produkt, potem utworzysz z niego szkic Allegro.</span>`}
        </div>
        <div id="allegroDraftPreview"></div>
        <div id="allegroDescriptionPreview"></div>
      </details>
      <div class="f-group"><label>Opis krótki <small style="font-weight:400;color:var(--muted2)">widoczny na kartach i pod tytułem produktu</small></label><textarea name="opisKrotki" rows="3" maxlength="500" placeholder="Krótki, zachęcający opis w 1–2 zdaniach.">${esc(p.opisKrotki||p.krotkiOpis||"")}</textarea></div>
      <div class="diag-actions" style="margin-top:-.35rem">
        <button class="btn ghost" type="button" onclick="agentAIPoprawOpisyWFormularzu(this.form)">🤖 Popraw opisy stylistycznie</button>
        <button class="btn ghost" type="button" onclick="allegroPoprawOpisyWFormularzu(this)">🟠 Popraw opisy i układ Allegro</button>
      </div>
      <div class="f-group"><label>Opis pełny</label><textarea name="opis" rows="9" maxlength="20000">${esc(p.opis||"")}</textarea></div>
      <details ${(p.seoTitle||p.seoDescription)?"open":""} class="product-seo-editor">
        <summary>📣 Pozycjonowanie produktu</summary>
        <p class="order-detail-lead">Produkt automatycznie otrzymuje komplet metadanych do sklepu, Google, Open Graph, danych Product/Offer, mapy strony i feedu produktowego. Wybierz tryb ręczny tylko wtedy, gdy chcesz chronić własną treść przed regeneracją.</p>
        <div class="f-group"><label>Tryb pozycjonowania</label><select name="seoMode"><option value="auto" ${seoDanePodgladu.seoMode!=="manual"?"selected":""}>⚙️ Automatyczny — aktualizuj razem z produktem</option><option value="manual" ${seoDanePodgladu.seoMode==="manual"?"selected":""}>✍️ Ręczny — zachowaj treść administratora</option></select></div>
        <div class="f-group"><label>Tytuł SEO <small>najlepiej 30–60 znaków</small></label><input name="seoTitle" maxlength="70" value="${esc(seoDanePodgladu.seoTitle)}" placeholder="Nazwa produktu – producent"></div>
        <div class="f-group"><label>Opis SEO <small>najlepiej 80–160 znaków</small></label><textarea name="seoDescription" rows="3" maxlength="180" placeholder="Konkretny opis korzyści i zawartości produktu.">${esc(seoDanePodgladu.seoDescription)}</textarea></div>
        <div class="f-group"><label>Frazy pomocnicze</label><input name="seoKeywords" maxlength="500" value="${esc(seoDanePodgladu.seoKeywords)}" placeholder="nazwa, kategoria, producent, kod"></div>
        <div class="backend-note"><b>Automatyczne pokrycie:</b> sklep • Google • Open Graph • schema Product/Offer • sitemap • feed produktowy.<br><b>Wynik bieżącej kartoteki:</b> ${seoScoreBadge(seoOcenaProduktu(seoDanePodgladu).score)} • ostatnia kontrola: ${p.seoReviewedAt?esc(allegroDataTxt(p.seoReviewedAt)):"automatycznie przy zapisie"}</div>
      </details>
      <div class="f-group" style="max-width:240px"><label>Stan magazynowy <small style="font-weight:400;color:var(--muted2)">(nowy produkt = 0 szt.)</small></label>
        <input name="stan" inputmode="numeric" min="0" placeholder="0" value="${p.id!==undefined && stanyProduktow[p.id]!==undefined ? stanyProduktow[p.id] : 0}"></div>
      <div class="diag-actions">
        <button class="btn" type="submit" data-product-final-approval ${!edycja&&!kontrolaDodawania.canSubmit?`disabled title="Najpierw uzupełnij dane i zakończ kontrolę duplikatów"`:""}>${edycja?"💾 Zapisz zmiany":"✅ Zatwierdź i dodaj produkt"}</button>
        <a class="btn ghost" href="#/admin/produkty">Anuluj</a>
        ${edycja?`<button class="btn ghost" type="button" onclick="duplikujProdukt(${p.id})">📄 Duplikuj</button>`:""}
        ${edycja?`<button class="btn danger" type="button" onclick="if(confirm('Przenieść ten produkt do kosza na 30 dni?')){usunProduktAdmin(${p.id});location.hash='#/admin/produkty'}">🗑️ Przenieś do kosza</button>`:""}
        ${edycja && produktyEdytowane[p.id]?`<button class="btn danger" type="button" onclick="resetujEdycjeProduktu(${p.id})">↩️ Przywróć dane z products.json</button>`:""}
      </div>
    </form>`;
}
function widokAdminProduktyDodaj(){
  const params=parametryTrasy(),agentPrepared=params.get("agent")==="1";let prefill={};
  if(agentPrepared){try{prefill=JSON.parse(sessionStorage.getItem("artway_prefill_product")||"{}")||{};}catch(e){prefill={};}}
  else try{sessionStorage.removeItem("artway_prefill_product");}catch(e){}
  agentAIImportUrlStan={busy:false,data:null,selected:-1,error:""};
  const category=String(params.get("kategoria")||"").trim(),sourceUrl=String(params.get("url")||prefill._agentLinkUrl||prefill.producentUrl||prefill.sourceUrl||"").trim();
  if(/^https?:\/\//i.test(sourceUrl)){prefill.producentUrl=sourceUrl;prefill.sourceUrl=prefill.sourceUrl||sourceUrl;}
  if(category&&!prefill.kategoria)prefill.kategoria=category;
  kategoriaNowegoProduktu=category;
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Dodaj</div>
      <h1>➕ Dodaj produkt</h1>
      <div class="backend-note"><b>Jedna strona dodawania.</b> Możesz pobrać dane z linku albo wypełnić tę samą kartotekę ręcznie. Agent nie zapisuje produktu automatycznie — ostatnia decyzja zawsze należy do administratora.</div>
      ${formularzProduktu(prefill, "dodawanie")}
      <p style="font-size:.8rem;color:var(--muted2);margin-top:.7rem">Produkt trafi do wspólnej bazy dopiero po kliknięciu „Zatwierdź i dodaj produkt”. Stan magazynowy nowego produktu pozostaje równy 0, dopóki go nie zmienisz.</p>
    </div>`);
}
function widokAdminProduktyZLinku(){
  return widokAdminProduktyDodaj();
}
function widokAdminProduktEdytuj(id){
  const p = pobierzProduktAdmin(id);
  if(!p) return asortymentSzkielet("produkty", `<div class="panel"><h1>Nie znaleziono produktu</h1><p><a href="#/admin/produkty">← Wróć do produktów</a></p></div>`);
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Edycja › ${esc(p.nazwa)}</div>
      <h1>✏️ Edytuj produkt #${p.id}</h1>
      ${formularzProduktu(p, "edycja")}
    </div>`);
}
function daneProduktuZFormularza(f, id, poprzedni={}){
  const cena = parseFloat(String(f.get("cena")).replace(",","."));
  if(!(cena>0)) return null;
  const p = {
    ...poprzedni,
    id,
    nazwa:String(f.get("nazwa")).trim(),
    kategoria:String(f.get("kategoria")).trim()||"Inne",
    cena:+cena.toFixed(2),
    opisKrotki:String(f.get("opisKrotki")||"").trim(),
    opis:String(f.get("opis")||"").trim(),
    ikona:String(f.get("ikona")||"").trim()||"📦",
    kolor:poprzedni.kolor||"#dbeafe"
  };
  if(poprzedni.kategoria&&p.kategoria!==poprzedni.kategoria){
    delete p.sciezkaKategorii;delete p.grupaKategorii;delete p.kategoriaPelna;
  }
  const sc = parseFloat(String(f.get("staraCena")||"").replace(",","."));
  if(sc>cena) p.staraCena = +sc.toFixed(2); else delete p.staraCena;
  const cenaAllegro=parseFloat(String(f.get("cenaAllegro")||"").replace(",","."));
  if(cenaAllegro>0)p.cenaAllegro=+cenaAllegro.toFixed(2);else delete p.cenaAllegro;
  const cenaZakupu=parseFloat(String(f.get("cenaZakupu")||"").replace(",","."));
  if(cenaZakupu>=0&&String(f.get("cenaZakupu")||"").trim()!==""){p.cenaZakupu=+cenaZakupu.toFixed(2);p.cenaZakupuPrywatna=true;}else{for(const pole of ["cenaZakupu","cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuPrywatna","cenaZakupuZrodlo","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt"])delete p[pole];}
  if(Number.isFinite(cenaZakupu)&&Number(cenaZakupu.toFixed(2))!==Number(poprzedni.cenaZakupu)){p.cenaZakupuZrodlo="ręczna edycja administratora";p.cenaZakupuZaktualizowanoAt=new Date().toISOString();p.cenaZakupuDopasowanie="ręcznie";for(const pole of ["cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu"])delete p[pole];}
  for(const pole of ["allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){let raw=String(f.get(pole)||"").trim();if(pole==="allegroShippingSubsidy"&&raw==="")raw=String(ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI);const n=Number(raw.replace(",","."));if(raw!==""&&Number.isFinite(n)&&n>=0)p[pole]=+n.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);else if(!["vatRate"].includes(pole))delete p[pole];}
  const feeAt=String(f.get("allegroFeeCalculatedAt")||"").trim();if(feeAt)p.allegroFeeCalculatedAt=feeAt;
  const zdjecie = String(f.get("zdjecie")||"").trim();
  if(zdjecie) p.zdjecie = zdjecie; else delete p.zdjecie;
  if(f.get("badge")) p.badge = String(f.get("badge")); else delete p.badge;
  const sku = String(f.get("sku")||"").trim();
  if(sku) p.sku = sku; else delete p.sku;
  for(const [pole,nazwa] of [
    ["gtin","gtin"],["externalId","externalId"],["mpn","mpn"],["producent","producent"],["marka","marka"],["kolorProduktu","kolorProduktu"],["rozmiar","rozmiar"],["material","material"],
    ["kodProducenta","kodProducenta"],["dostepnoscProducenta","dostepnoscProducenta"],["producentUrl","producentUrl"],["sourceUrl","sourceUrl"],
    ["allegroCategoryId","allegroCategoryId"],["allegroProductId","allegroProductId"],["allegroOfferId","allegroOfferId"],["allegroCategoryPhrase","allegroCategoryPhrase"],
    ["seoTitle","seoTitle"],["seoDescription","seoDescription"],["seoKeywords","seoKeywords"],["seoMode","seoMode"]
  ]){
    const v=String(f.get(nazwa)||"").trim();
    if(v)p[pole]=v;else delete p[pole];
  }
  if(p.producentUrl)p.sourceUrl=p.producentUrl;
  const stanProd=String(f.get("stanProducenta")??"").trim();if(stanProd!=="")p.stanProducenta=Math.max(0,Math.floor(Number(stanProd)||0));else delete p.stanProducenta;
  p.stanProducentaDokladny=String(f.get("stanProducentaDokladny")||"")==="1";
  for(const pole of ["stanProducentaZrodlo","producentStatus","producentSprawdzonoAt"]){const v=String(f.get(pole)||"").trim();if(v)p[pole]=v;else delete p[pole];}
  if(p.gtin) p.ean=p.gtin; else delete p.ean;
  const canonicalProducer=allegroProducentKanoniczny(p);
  if(canonicalProducer){p.producent=canonicalProducer;if(!p.marka)p.marka=canonicalProducer;}
  const warianty = String(f.get("warianty")||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
  if(warianty.length) p.warianty = warianty; else delete p.warianty;
  const zdjecia = Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(n=>String(f.get(n)||"").trim()).filter(Boolean);
  if(zdjecia.length) p.zdjecia = zdjecia; else delete p.zdjecia;
  const allegroParameters=[];
  for(const [key,value] of f.entries()) if(String(key).startsWith("allegroParam_")&&String(value||"").trim()){
    const pid=String(key).slice("allegroParam_".length), el=document.querySelector(`[name="${key}"]`), val=String(value).trim();
    allegroParameters.push(el?.dataset?.paramType==="dictionary"?{id:pid,valuesIds:[val]}:{id:pid,values:[val]});
  }
  if(allegroParameters.length)p.allegroParameters=allegroParameters;
  const improved=agentAIPoprawOpisyDanychProduktu(p);
  return seoAutomatyzujDaneProduktu(improved,improved.seoMode==="manual"?"ręczne SEO administratora":"automatycznie po zapisie produktu",{force:improved.seoMode!=="manual"});
}
function wgrajZdjecieDoPola(input, pole){
  wgrajObrazek(input, 900, url => {
    const form = input.closest ? input.closest("form") : input.form;
    if(form && form[pole]) form[pole].value = url;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj ✅");
  });
}
async function dodajProdukt(e){
  e.preventDefault();
  const submit=e.submitter;if(submit)submit.disabled=true;
  const f = new FormData(e.target);
  let prefillMeta={};
  try{ prefillMeta=JSON.parse(sessionStorage.getItem("artway_prefill_product")||"{}")||{}; }catch(err){ prefillMeta={}; }
  const maxId = najwyzszeIdProduktu();
  const KOLORY = ["#dbeafe","#e0e7ff","#fef3c7","#dcfce7","#fee2e2","#f3e8ff","#fce7f3","#ffedd5"];
  const p = daneProduktuZFormularza(f, maxId+1, {kolor:KOLORY[(maxId+1)%KOLORY.length]});
  if(!p){ if(submit)submit.disabled=false;toast("⚠️ Podaj poprawną cenę"); return; }
  const kontrola=produktDodawanieAktualizuj(e.target);
  if(!kontrola?.canSubmit){
    if(submit)submit.disabled=false;
    e.target.querySelector("[data-product-add-control]")?.scrollIntoView({behavior:"smooth",block:"start"});
    toast(kontrola?.blocking?`Produkt już istnieje (#${kontrola.blocking.product.id})`:kontrola?.potential&&!kontrola.acknowledged?"Najpierw zdecyduj, czy podobna pozycja jest innym produktem":"Najpierw uzupełnij dane i zakończ kontrolę duplikatów");
    return;
  }
  const duplicates=agentAIDuplikatyProduktu(p),blockingDuplicate=duplicates.find(x=>x.blocking);
  if(blockingDuplicate){
    if(submit)submit.disabled=false;
    const box=e.target.querySelector("[data-product-link-agent-result]");
    if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>🛡️ Ochrona katalogu</span><h3>Nie utworzono duplikatu</h3><small>${esc(blockingDuplicate.reasons.join(" • "))}</small></div><span class="lvl lvl-ostrzezenie">produkt #${esc(blockingDuplicate.product.id)}</span></header><div class="diag-actions"><button class="btn" type="button" onclick="location.hash='#/admin/produkty/edytuj/${encodeURIComponent(String(blockingDuplicate.product.id))}'">Otwórz istniejący produkt</button><button class="btn ghost" type="button" onclick="agentAIAktualizujIstniejacyZAnalizy(${jsArg(blockingDuplicate.product.id)},this)">Uzupełnij go danymi Agenta</button></div></div>`;
    toast(`Duplikat zablokowany — istnieje już produkt #${blockingDuplicate.product.id}`);return;
  }
  if(e.target.dataset.agentAdd==="1"||e.target.dataset.agentLinkSource){p.agentImportAt=new Date().toISOString();p.agentImportConfidence=Number(e.target.dataset.agentLinkConfidence||0)||0;p.agentImportSource=agentAIImportUrlStan.data?.fromCache?"pamięć Agenta":"link producenta";p.agentImportUrl=e.target.dataset.agentLinkSource||p.sourceUrl||p.producentUrl||"";}
  p.createdAt=p.createdAt||new Date().toISOString();p.createdBy=sesja?.email||"administrator";p.agentOnboardingStatus="processing";p.agentOnboardingStartedAt=new Date().toISOString();
  produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszStanZFormularza(f, p.id);
  agentAIZakonczLinkProducenta(prefillMeta._agentLinkId||prefillMeta._agentLinkUrl||p.sourceUrl||p.producentUrl,p);
  zapiszHistorieAgenta("opisy-produktow",`Agent AI sprawdził opisy po dodaniu produktu: ${p.nazwa}`,{produktId:p.id,opisKrotki:!!p.opisKrotki,opis:!!p.opis,importConfidence:p.agentImportConfidence||0,zrodlo:p.agentImportSource||"ręczne"});
  try{ sessionStorage.removeItem("artway_prefill_product"); }catch(e){}
  zbudujProdukty();
  kategoriaNowegoProduktu = "";
  loguj("info","Dodano produkt: "+p.nazwa+" ("+zl(p.cena)+")");
  toast("Produkt dodany ✅");
  toast("Produkt zapisany. Automat dobiera dane, kategorię, opisy i opłaty…");
  const onboardingResult=await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true}),onboardingProduct=pobierzProduktAdmin(Number(p.id))||p,onboardingState=agentAIStanWdrozeniaProduktu(onboardingProduct),onboardingStatus=onboardingResult?.ok&&onboardingState.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(p.id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie nowego produktu: ${p.nazwa}`,{produktId:p.id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  if(submit)submit.disabled=false;
  if(["/admin/produkty/dodaj","/admin/produkty/z-linku"].includes(trasa())) location.hash="#/admin/produkty"; else renderuj();
}
function zapiszStanZFormularza(f, id){
  ustawStanMagazynowy(id, String(f.get("stan")??"").trim()===""?0:f.get("stan"), {typ:"korekta",powod:"Formularz produktu"});
}
async function automatyczniePobierzDaneZrodlaProduktu(p={}){
  const url=String(p.producentUrl||p.sourceUrl||"").trim();if(!/^https?:\/\//i.test(url))return p;
  try{
    const d=await chmura("product-url-inspect",{method:"POST",body:{url},timeout:30000}),s=d.product||{},canonical=allegroProducentKanoniczny({...p,...s,sourceUrl:url,producentUrl:url});
    const missing={nazwa:s.nazwa,kategoria:s.kategoria,gtin:s.gtin||s.ean,ean:s.ean||s.gtin,externalId:s.externalId,mpn:s.mpn||s.kodProducenta,kodProducenta:s.kodProducenta||s.mpn,producent:canonical||s.producent||s.marka,marka:s.marka||canonical||s.producent,zdjecie:s.zdjecie,zdjecia:Array.isArray(s.zdjecia)?s.zdjecia.slice(0,15):[],parametryProducenta:s.parametryProducenta,parametryZrodla:s.parametryZrodla};
    zapiszPolaProduktuLokalnie(p.id,missing,true);
    const current=pobierzProduktAdmin(Number(p.id))||p,canonicalUrl=s.sourceUrl||s.producentUrl||url,force={producentUrl:canonicalUrl,sourceUrl:canonicalUrl,sourceEvidence:s.sourceEvidence||current.sourceEvidence||null,opis:s.opis||current.opis||"",opisKrotki:s.opisKrotki||current.opisKrotki||"",dostepnoscProducenta:s.dostepnoscProducenta||current.dostepnoscProducenta||"",stanProducenta:s.stanProducenta??current.stanProducenta??"",stanProducentaDokladny:s.stanProducentaDokladny===true,stanProducentaZrodlo:s.stanProducentaZrodlo||current.stanProducentaZrodlo||"",producentStatus:s.producentStatus||current.producentStatus||"",producentSprawdzonoAt:s.producentSprawdzonoAt||current.producentSprawdzonoAt||new Date().toISOString()};
    zapiszPolaProduktuLokalnie(p.id,force,false);agentAIZakonczLinkProducenta(url,pobierzProduktAdmin(Number(p.id))||p);return pobierzProduktAdmin(Number(p.id))||{...p,...missing,...force};
  }catch(e){agentAIZapiszLinkProducenta(url,"oczekuje","Automatyczne odświeżenie przy zapisie: "+(e.message||e));return p;}
}
async function allegroSynchronizujPowiazanyProduktPoZapisie(p,options={}){
  if(!p)return;
  try{
    if(!options.skipSource)p=await automatyczniePobierzDaneZrodlaProduktu(p);
    const draft=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:60000});
    allegroZapiszAutoUzupelnienia(p,draft);
    let prepared={...(pobierzProduktAdmin(Number(p.id))||p),...(draft.autoFilled||{}),allegroShippingSubsidy:(pobierzProduktAdmin(Number(p.id))||p).allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI};
    const existing=allegroOfertaDlaProduktuSklepu(prepared)||draft.existingOffer?.offer||null;
    let updated=false;
    if(existing||draft.operation==="update"){
      const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:prepared,options:{stock:allegroStanOfertyProduktu(prepared),publicationAction:"keep"}},timeout:120000});
      allegroZapiszAutoUzupelnienia(prepared,d);allegroZastosujWynikWystawienia(prepared,d);allegroZapiszWynikOperacji(prepared,d);updated=true;
      prepared=pobierzProduktAdmin(Number(p.id))||prepared;
    }
    const feeReady=kwotaNum(prepared.cenaAllegro||prepared.cena)>0&&!!(prepared.allegroOfferId||existing?.id||(prepared.allegroCategoryId&&(prepared.allegroProductId||prepared.gtin||prepared.ean)));
    let feesUpdated=false;if(options.forceFees!==false&&feeReady)feesUpdated=!!(await allegroPobierzProwizjeProduktu(prepared.id,null,{silent:true}).catch(()=>null));
    await chmuraZapiszUstawienia().catch(()=>false);
    toast(updated?`✅ Produkt i oferta Allegro zaktualizowane${feesUpdated?" • prowizja odświeżona":" • prowizja wymaga ponownej próby"}`:`✅ Produkt uzupełniony: kategoria i opisy zapisane${feesUpdated?" • prowizja pobrana":""}`);
    return {ok:true,updated,feesUpdated,draft};
  }catch(e){allegroOstatniBladWystawienia=e;if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Automatyka produktu przekazała brak do Agenta AI: "+(e.message||e));return {ok:false,error:e};}
}
async function zapiszProduktAdmin(e,id){
  e.preventDefault();
  const submit=e.submitter;if(submit)submit.disabled=true;
  const f = new FormData(e.target);
  const poprzedni = pobierzProduktAdmin(id);
  const p = daneProduktuZFormularza(f, id, poprzedni||{});
  if(!p){ if(submit)submit.disabled=false;toast("⚠️ Podaj poprawną cenę"); return; }
  zapiszStanZFormularza(f, id);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i] = p;
    zapiszLS("artway_produkty_dodane", produktyDodane);
  }else{
    produktyEdytowane = {...produktyEdytowane, [id]:p};
    zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  }
  zbudujProdukty(); odswiezMenu();
  zapiszHistorieAgenta("opisy-produktow",`Agent AI sprawdził opisy po edycji produktu: ${p.nazwa}`,{produktId:p.id,opisKrotki:!!p.opisKrotki,opis:!!p.opis});
  loguj("info","Zapisano zmiany produktu id="+id);
  toast("Zmiany zapisane. Automat aktualizuje dane, opis, prowizję i ofertę…");
  await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true});
  if(submit)submit.disabled=false;
  location.hash="#/admin/produkty";
}
function duplikujProdukt(id){
  const p = pobierzProduktAdmin(id); if(!p) return;
  const maxId = najwyzszeIdProduktu();
  const kopia = seoAutomatyzujDaneProduktu({...p,id:maxId+1,nazwa:p.nazwa+" — kopia",seoMode:"auto",seoTitle:"",seoDescription:"",seoKeywords:"",createdAt:new Date().toISOString(),createdBy:sesja?.email||"administrator",agentOnboardingStatus:"needs_attention",agentOnboardingStartedAt:new Date().toISOString(),agentOnboardingMissing:["identity"]},"automatycznie po utworzeniu kopii",{force:true});
  produktyDodane.push(kopia);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zbudujProdukty();zapiszHistorieAgenta("wdrozenie-produktu",`Nowa kopia produktu wymaga kontroli Agenta: ${kopia.nazwa}`,{produktId:kopia.id,status:"needs_attention",sourceProductId:id});zaplanujZapisUstawien();loguj("info",`Zduplikowano produkt ${id} jako ${kopia.id}`);
  toast("Utworzono kopię produktu 📄");
  location.hash="#/admin/produkty/edytuj/"+kopia.id;
}
function usunProdukt(id){
  const p = produktyDodane.find(x=>x.id===id);
  if(p){
    if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
    oznaczProduktWKoszu(id,"wlasny");
    zapiszLS("artway_kosz_dodane", koszDodanych);
  }
  produktyDodane = produktyDodane.filter(p=>p.id!==id);
  zapiszLS("artway_produkty_dodane", produktyDodane); zbudujProdukty();
  loguj("info","Przeniesiono produkt do kosza na 30 dni: id="+id); toast("Produkt w koszu przez 30 dni 🗑️"); renderuj();
}
function przywrocZKosza(id){
  const p = koszDodanych.find(x=>x.id===id);
  if(p&&!produktyDodane.some(x=>x.id===id)){ produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane); }
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony z kosza ↩️"); renderuj();
}
function usunDefinitywnie(id){
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  loguj("info","Usunięto definitywnie produkt id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function usunDefinitywnieBazowy(id){
  if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  usunMetaKosza(id);
  delete produktyEdytowane[id];
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zaznaczoneProdukty.delete(id);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Usunięto definitywnie produkt bazowy id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function wyczyscCalKosz(){
  const bazowe=bazoweProduktyWKoszu().map(p=>p.id);
  const ile=koszDodanych.length+bazowe.length;
  if(!ile||!confirm(`Definitywnie usunąć ${ile} produktów z kosza? Tej operacji nie można cofnąć.`)) return;
  koszDodanych.forEach(p=>{delete koszMeta[p.id];delete stanyProduktow[p.id];delete dostepnoscProduktow[String(p.id)];});
  bazowe.forEach(id=>{
    if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
    delete koszMeta[id]; delete produktyEdytowane[id]; delete stanyProduktow[id]; delete dostepnoscProduktow[String(id)];
  });
  koszDodanych=[];
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zbudujProdukty(); odswiezMenu();
  loguj("info",`Opróżniono kosz: ${ile} produktów`);
  toast("Kosz opróżniony"); renderuj();
}
