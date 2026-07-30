/* GENERATED ADMIN INVENTORY — loaded on demand */
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
  const zarzadzaDostepem=jestGlownymAdminem(sesja?.email),operacjaWToku=zmianyDostepuUzytkownikowWToku.has(k.email)||resetMfaUzytkownikowWToku.has(k.email)||usunieciaUzytkownikowWToku.has(k.email);
  return adminSzkielet("/admin/klienci", `
  ${klienciSubnavHTML("lista")}
  <div class="panel">
    <div class="crumb"><a href="#/admin/klienci">Klienci</a> › ${esc(k.imie)}</div>
    <h1>📇 ${esc(k.imie)} ${admin?'<span class="lvl lvl-info">ADMIN</span>':""} ${k.nip?'<span class="lvl lvl-info">firma</span>':""}</h1>
    <div class="stat-grid">
      <div class="stat"><b>${zam.length}</b><small>zamówień</small></div>
      <div class="stat"><b>${zl(zam.filter(z=>z.status!=="anulowane").reduce((s,z)=>s+z.razem,0))}</b><small>łączna wartość</small></div>
      <div class="stat"><b>${new Date(k.data).toLocaleDateString("pl-PL")}</b><small>rejestracja</small></div>
      <div class="stat"><b>${admin?(k.mfaEnabled?"MFA aktywne":"Nowy QR przy logowaniu"):"Konto klienta"}</b><small>${admin?"Google Authenticator":"bez dostępu do panelu"}</small></div>
    </div>
    <form onsubmit="zapiszKartoteke(event, '${esc(k.email)}')">
      ${polaKartotekiHTML(k, {edycja:true, blokujEmail:true, bezHasla:!zarzadzaDostepem||sesja?.email===k.email})}
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz kartotekę</button>
        ${!zarzadzaDostepem||glowny||sesja?.email===k.email?"":`<button class="btn ghost" type="button" ${operacjaWToku?"disabled":""} onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')">${operacjaWToku?"⏳ Zapisuję…":admin?"🔒 Odbierz rolę administratora":"🛡️ Nadaj rolę administratora"}</button>`}
        ${zarzadzaDostepem&&admin&&!glowny&&sesja?.email!==k.email?`<button class="btn ghost" type="button" ${operacjaWToku?"disabled":""} onclick="if(confirm('Odłączyć obecny Google Authenticator konta ${esc(k.email)}? Stare sesje zostaną wylogowane, a przy następnym logowaniu pojawi się nowy kod QR.')) resetujMfaUzytkownika('${esc(k.email)}')">${operacjaWToku?"⏳ Resetuję…":"↻ Skonfiguruj MFA ponownie"}</button>`:""}
        ${zam.length?`<a class="btn ghost" href="#/admin/zamowienia" onclick="szukajZamowien='${esc(k.email)}';filtrZamowien='wszystkie'">📦 Zamówienia klienta (${zam.length})</a>`:""}
        <a class="btn ghost" href="mailto:${esc(k.email)}">✉️ Napisz e-mail</a>
        ${zarzadzaDostepem&&!admin&&!glowny?`<button class="btn danger" type="button" ${operacjaWToku?"disabled":""} onclick="if(confirm('Trwale usunąć konto ${esc(k.email)}? Aktywne sesje natychmiast stracą dostęp.')) usunKlienta('${esc(k.email)}',true)">${operacjaWToku?"⏳ Usuwam…":"🗑️ Usuń konto"}</button>`:""}
      </div>
      <p class="pay-note" style="text-align:left">Adres e-mail jest identyfikatorem logowania i nie jest zmieniany w kartotece. Zmiana roli, reset hasła i usunięcie konta unieważniają jego wcześniejsze sesje.</p>
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
  const zarzadzaDostepem=jestGlownymAdminem(sesja?.email);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  const nowyEmail = staryEmail;
  const noweHaslo = String(f.get("haslo")||"");
  const powtorzoneHaslo = String(f.get("haslo2")||"");
  if(dane.imie.length<2){ toast("⚠️ Podaj imię i nazwisko"); return; }
  if(!nowyEmail.includes("@")){ toast("⚠️ Nieprawidłowy e-mail"); return; }
  if(noweHaslo&&!zarzadzaDostepem){toast("⚠️ Tylko główny administrator może ustawiać hasła innych kont");return;}
  if(noweHaslo && noweHaslo.length<8){ toast("⚠️ Nowe hasło: min. 8 znaków"); return; }
  if(noweHaslo!==powtorzoneHaslo){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  const button=e.submitter;if(button){button.disabled=true;button.textContent="Zapisuję…";}
  try{
    const next={...k,...dane,email:nowyEmail};
    const wynik=await chmura("store-user-save",{method:"POST",body:{user:next},timeout:15000});
    if(noweHaslo)await chmura("store-user-password-reset",{method:"POST",body:{email:staryEmail,password:noweHaslo},timeout:20000});
    Object.assign(k,next,wynik.user||{});
    delete k.hash;delete k.passwordHash;
    zapiszLS("artway_uzytkownicy",u);
    if(sesja?.email===staryEmail&&sesja.imie!==dane.imie)ustawSesje({...sesja,imie:dane.imie});
    loguj("info",`Zapisano kartotekę klienta ${staryEmail}${noweHaslo?" i unieważniono jego sesje po zmianie hasła":""}`);
    toast(noweHaslo?"Kartoteka i nowe hasło zapisane — stare sesje wylogowano ✅":"Kartoteka zapisana ✅");
  }catch(bl){toast("⚠️ Nie zapisano kartoteki: "+(bl.message||"błąd serwera"));}
  finally{if(button&&document.contains(button)){button.disabled=false;button.textContent="💾 Zapisz kartotekę";}renderuj();}
}
async function dodajKlientaAdmin(e){
  e.preventDefault();
  if(!jestGlownymAdminem(sesja?.email)){toast("Tylko główny administrator może tworzyć konta z panelu");return;}
  const f = new FormData(e.target);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ toast("⚠️ Wpisane hasła nie są takie same"); return; }
  const email=String(f.get("email")||"").trim().toLowerCase(),password=String(f.get("haslo")||"");
  if(!poprawnyEmailKonta(email)){toast("⚠️ Podaj poprawny adres e-mail");return;}
  if(password.length<8){toast("⚠️ Hasło musi mieć co najmniej 8 znaków");return;}
  const button=e.submitter;if(button){button.disabled=true;button.textContent="Tworzę konto…";}
  try{
    const wynik=await chmura("store-user-create",{method:"POST",body:{user:{...dane,email},password},timeout:20000});
    const lista=pobierzUzytkownikow();lista.push({...dane,...(wynik.user||{}),email,rola:"klient",account:true});zapiszLS("artway_uzytkownicy",lista);
    loguj("info","Utworzono kartotekę klienta: "+email);
    toast("Konto klienta utworzone bez zmiany sesji administratora ✅");e.target.reset();renderuj();
  }catch(bl){toast("⚠️ Nie utworzono konta: "+(bl.message||"błąd serwera"));}
  finally{if(button&&document.contains(button)){button.disabled=false;button.textContent="➕ Utwórz konto klienta";}}
}
const usunieciaUzytkownikowWToku=new Set();
async function usunKlienta(email,przejdzDoListy=false){
  const e=String(email||"").trim().toLowerCase();
  if(!jestGlownymAdminem(sesja?.email)){toast("Tylko główny administrator może usuwać konta");return false;}
  if(jestGlownymAdminem(e)||e===String(sesja?.email||"").toLowerCase()){toast("Nie można usunąć głównego ani aktualnie używanego konta");return false;}
  if(kontoMaRoleAdmin(e)){ toast("Najpierw odbierz temu kontu rolę administratora"); return false; }
  if(usunieciaUzytkownikowWToku.has(e))return false;
  usunieciaUzytkownikowWToku.add(e);renderuj();
  try{
    await chmura("store-user-delete",{method:"POST",body:{email:e},timeout:15000});
    zapiszLS("artway_uzytkownicy",pobierzUzytkownikow().filter(x=>String(x.email||"").toLowerCase()!==e));
    zaznaczeniKlienci.delete(e);loguj("info","Usunięto konto klienta i unieważniono jego sesje: "+e);
    toast("Usunięto konto "+e+" — jego sesje nie mają już dostępu ✅");
    if(przejdzDoListy)location.hash="#/admin/klienci";return true;
  }catch(bl){toast("⚠️ Nie usunięto konta: "+(bl.message||"błąd serwera"));return false;}
  finally{usunieciaUzytkownikowWToku.delete(e);renderuj();}
}
let szukajProduktow = "", filtrProduktow = "Wszystkie", kategoriaNowegoProduktu = "";
let filtrStatusuProduktow = "aktywne", filtrZrodlaProduktow = "wszystkie", filtrStanuProduktow = "wszystkie", filtrAllegroProduktow = "wszystkie";
let filtrProducentaProduktow="wszyscy",filtrDanychProduktow="wszystkie",filtrSprzedazyProduktow="wszystkie",filtrPromocjiProduktow="wszystkie",filtrLinkuProduktow="wszystkie",cenaOdAdminProduktow="",cenaDoAdminProduktow="",cenaAllegroOdAdminProduktow="",cenaAllegroDoAdminProduktow="";
let sortowanieAdminProduktow = ["external","id","nazwa","producent","kategoria","cena-rosnaco","cena-malejaco","stan","braki-danych","najnowsze"].includes(wczytajLS("artway_produkty_sortowanie_admin","external"))?wczytajLS("artway_produkty_sortowanie_admin","external"):"external";
let gestoscAdminProduktow=["zwarta","wygodna"].includes(wczytajLS("artway_produkty_gestosc_admin","zwarta"))?wczytajLS("artway_produkty_gestosc_admin","zwarta"):"zwarta";
let stronaAdminProduktow = 1;
let produktyNaStronieAdmin = [25,50,100,200,500,1000].includes(Number(wczytajLS("artway_produkty_na_stronie_admin",50)))?Number(wczytajLS("artway_produkty_na_stronie_admin",50)):50;
let frazaMagazynu="",kodMagazynu="",typKoduMagazynu="wszystkie",grupowanieStanowMagazynu="lista",filtrMagazynu="na-stanie", filtrDostawcyMagazynu="wszyscy", filtrLokalizacjiMagazynu="wszystkie", filtrInwentaryzacjiMagazynu="wszystkie", sortowanieMagazynu="stan-malejaco", stronaMagazynu=1, szukajProducentowMagazynu="", filtrProducentowMagazynu="wszystkie", sortowanieProducentowMagazynu="priorytet", stronaDostepnosciProducentow=1;
let szukajRuchowMagazynu="",filtrRuchowMagazynu="wszystkie",limitRuchowMagazynu=100;
let magazynLokalizacjeZamowienIds=new Set();
let magazynNaStronie=[25,50,100,200,500].includes(Number(wczytajLS("artway_magazyn_na_stronie",50)))?Number(wczytajLS("artway_magazyn_na_stronie",50)):50;
let dostepnoscProducentowNaStronie=[25,50,100,200,500].includes(Number(wczytajLS("artway_dostepnosc_na_stronie",50)))?Number(wczytajLS("artway_dostepnosc_na_stronie",50)):50;
function ustawKafelkowyFiltrAsortymentu(typ="aktywne"){
  asortymentResetujFiltry(false);
  if(typ==="allegro_polaczone")filtrAllegroProduktow="polaczone";
  else if(typ==="allegro_duplikaty")filtrAllegroProduktow="duplikaty";
  else if(typ==="allegro_brak")filtrAllegroProduktow="brak";
  else if(typ==="duplikaty_sklepu")filtrStatusuProduktow="duplikaty";
  stronaAdminProduktow=1;void asortymentOdswiezWyniki({pelnyInterfejs:true,przewin:true});
}
function dokumentTymczasowyHTML(html){const tpl=document.createElement("template");tpl.innerHTML=String(html||"").trim();return tpl.content;}
let asortymentOdswiezanieNumer=0;
function asortymentUstawStanOdswiezania(root,aktywny){
  if(!root)return;
  root.classList.toggle("is-querying",aktywny);root.setAttribute("aria-busy",aktywny?"true":"false");
}
function asortymentPodmienSekcjeStabilnie(source,selector){
  const current=document.querySelector(selector),next=source.querySelector(selector);if(!current||!next)return false;
  const active=document.activeElement,scrollY=window.scrollY||0,selection=active&&typeof active.selectionStart==="number"?{start:active.selectionStart,end:active.selectionEnd}:null;
  // Wyniki zawierają progresywnie dokładane karty. Ich kolejność może zmienić
  // się całkowicie po filtrze, więc podmieniamy tylko ten jeden lekki blok
  // zamiast wykonywać kosztowną i podatną na przesunięcia rekursję całej strony.
  if(selector==="[data-assortment-results]")current.replaceWith(next.cloneNode(true));
  else if(typeof aktualizujWezelStabilnie==="function")aktualizujWezelStabilnie(current,next,active);
  else current.replaceWith(next.cloneNode(true));
  if(active?.isConnected&&selection&&typeof active.setSelectionRange==="function")try{active.setSelectionRange(selection.start,selection.end);}catch(e){}
  if(Math.abs((window.scrollY||0)-scrollY)>1)window.scrollTo({top:scrollY,behavior:"instant"});
  return true;
}
async function asortymentOdswiezWyniki({pelnyInterfejs=false,przewin=false,force=false}={}){
  const requestId=++asortymentOdswiezanieNumer,root=document.querySelector(".assortment-catalog-workspace");
  if(!root||!asortymentCentralnyTrasaAktywna()){renderuj();return false;}
  asortymentUstawStanOdswiezania(root,true);
  try{
    await asortymentCentralnyPobierz(force,{render:false});
    if(requestId!==asortymentOdswiezanieNumer||!asortymentCentralnyTrasaAktywna())return false;
    const source=dokumentTymczasowyHTML(widokAdminProdukty());
    const selectors=pelnyInterfejs
      ?[".assortment-saved-views",".assortment-audit-grid",".assortment-maintenance",".assortment-filter-panel","[data-assortment-results]"]
      :["[data-assortment-filter-summary]","[data-assortment-active-filters]","[data-assortment-operations]","[data-assortment-results]"];
    let updated=false;for(const selector of selectors)updated=asortymentPodmienSekcjeStabilnie(source,selector)||updated;
    if(!updated){renderuj();return false;}
    if(przewin)setTimeout(()=>document.querySelector("[data-assortment-results]")?.scrollIntoView({behavior:"smooth",block:"start"}),20);
    return true;
  }catch(error){
    loguj("ostrzezenie",`Nie odświeżono wyników asortymentu: ${error?.message||error}`);
    toast("⚠️ Nie udało się odświeżyć katalogu. Obecny widok pozostał bez zmian.");
    return false;
  }finally{
    if(requestId===asortymentOdswiezanieNumer)asortymentUstawStanOdswiezania(document.querySelector(".assortment-catalog-workspace"),false);
  }
}
function asortymentSzukajProdukty(input){
  szukajProduktow=String(input?.value||"");stronaAdminProduktow=1;clearTimeout(window.__assortmentSearch);
  window.__assortmentSearch=setTimeout(()=>void asortymentOdswiezWyniki(),240);
}
function asortymentBrakiDanych(p={}){
  if(Array.isArray(p?._catalog?.missingFields)){
    const labels={nazwa:"nazwa",cena:"cena",ean:"EAN",zdjecie:"zdjęcie",opis:"opis",producent:"producent",kategoria:"kategoria",zrodlo:"źródło"};
    return p._catalog.missingFields.filter(field=>field!=="koszt").map(field=>labels[field]||field);
  }
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
  szukajProduktow="";filtrProduktow="Wszystkie";filtrStatusuProduktow="aktywne";filtrZrodlaProduktow="wszystkie";filtrStanuProduktow="wszystkie";filtrAllegroProduktow="wszystkie";filtrProducentaProduktow="wszyscy";filtrDanychProduktow="wszystkie";filtrSprzedazyProduktow="wszystkie";filtrPromocjiProduktow="wszystkie";filtrLinkuProduktow="wszystkie";cenaOdAdminProduktow="";cenaDoAdminProduktow="";cenaAllegroOdAdminProduktow="";cenaAllegroDoAdminProduktow="";stronaAdminProduktow=1;
  if(render)void asortymentOdswiezWyniki({pelnyInterfejs:true});
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
  else if(nazwa==="link")filtrLinkuProduktow=v||"wszystkie";
  else if(nazwa==="cenaOd")cenaOdAdminProduktow=v;
  else if(nazwa==="cenaDo")cenaDoAdminProduktow=v;
  else if(nazwa==="cenaAllegroOd")cenaAllegroOdAdminProduktow=v;
  else if(nazwa==="cenaAllegroDo")cenaAllegroDoAdminProduktow=v;
  stronaAdminProduktow=1;void asortymentOdswiezWyniki({pelnyInterfejs:true});
}
function asortymentUstawWidok(widok="aktywne"){
  asortymentResetujFiltry(false);
  if(widok==="gotowe"){filtrDanychProduktow="gotowe";filtrSprzedazyProduktow="dostepne";}
  else if(widok==="braki")filtrDanychProduktow="braki";
  else if(widok==="bez-allegro")filtrAllegroProduktow="brak";
  else if(widok==="ukryte")filtrSprzedazyProduktow="niedostepne";
  else if(widok==="promocje")filtrPromocjiProduktow="promocje";
  else if(widok==="kosz")filtrStatusuProduktow="kosz";
  void asortymentOdswiezWyniki({pelnyInterfejs:true});
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
  else if(nazwa==="link")filtrLinkuProduktow="wszystkie";
  else if(nazwa==="cena"){cenaOdAdminProduktow="";cenaDoAdminProduktow="";}
  else if(nazwa==="cenaAllegro"){cenaAllegroOdAdminProduktow="";cenaAllegroDoAdminProduktow="";}
  stronaAdminProduktow=1;void asortymentOdswiezWyniki({pelnyInterfejs:true});
}
function ustawGestoscAdminProduktow(v){
  gestoscAdminProduktow=v==="wygodna"?"wygodna":"zwarta";zapiszLS("artway_produkty_gestosc_admin",gestoscAdminProduktow);
  const list=document.querySelector(".catalog-product-list");if(list){list.classList.remove("density-zwarta","density-wygodna");list.classList.add(`density-${gestoscAdminProduktow}`);}
}
function magazynOdswiezWynikiStanow(){
  clearTimeout(window.__warehouseSearch);
  window.__warehouseSearch=setTimeout(()=>{
    const current=document.querySelector(".warehouse-stock-page"),source=dokumentTymczasowyHTML(widokAdminMagazyn("stany")).querySelector(".warehouse-stock-page");if(!current||!source)return;
    for(const selector of [".warehouse-stock-results",".warehouse-stock-list"]){const a=current.querySelector(selector),b=source.querySelector(selector);if(a&&b)a.innerHTML=b.innerHTML;}
    const aPages=current.querySelectorAll(":scope > .pagination"),bPages=source.querySelectorAll(":scope > .pagination");aPages.forEach((el,i)=>{if(bPages[i])el.innerHTML=bPages[i].innerHTML;});
    const aConfirm=current.querySelector("[data-stock-confirm-visible]"),bConfirm=source.querySelector("[data-stock-confirm-visible]");if(aConfirm&&bConfirm)aConfirm.replaceWith(bConfirm);
  },140);
}
function magazynSzukajProdukty(input){frazaMagazynu=String(input?.value||"");stronaMagazynu=1;magazynOdswiezWynikiStanow();}
function magazynSzukajKod(input){kodMagazynu=String(input?.value||"");stronaMagazynu=1;magazynOdswiezWynikiStanow();}
function odswiezMonitoringProducentow(){
  if(trasa()!=="/admin/magazyn/dostawcy")return false;
  const current=document.querySelector(".supplier-monitor-panel"),source=dokumentTymczasowyHTML(widokAdminMagazyn("dostawcy")).querySelector(".supplier-monitor-panel");
  if(!current||!source)return false;
  const active=document.activeElement,scrollY=window.scrollY||0,selection=active&&typeof active.selectionStart==="number"?{start:active.selectionStart,end:active.selectionEnd}:null;
  aktualizujWezelStabilnie(current,source,active);
  if(active?.isConnected&&selection&&typeof active.setSelectionRange==="function")try{active.setSelectionRange(selection.start,selection.end);}catch(e){}
  if(Math.abs((window.scrollY||0)-scrollY)>1)window.scrollTo({top:scrollY,behavior:"instant"});
  return true;
}
function ustawStroneDostepnosciProducentow(n){stronaDostepnosciProducentow=Math.max(1,Number(n)||1);odswiezMonitoringProducentow();}
function ustawDostepnoscProducentowNaStronie(n){
  dostepnoscProducentowNaStronie=[25,50,100,200,500].includes(Number(n))?Number(n):50;
  stronaDostepnosciProducentow=1;zapiszLS("artway_dostepnosc_na_stronie",dostepnoscProducentowNaStronie);odswiezMonitoringProducentow();
}
function wyczyscFiltryDostepnosciProducentow(){szukajProducentowMagazynu="";filtrProducentowMagazynu="wszystkie";sortowanieProducentowMagazynu="priorytet";stronaDostepnosciProducentow=1;odswiezMonitoringProducentow();}
function eksportujDostepnoscProducentow(zakres="filtr"){
  const ids=zakres==="zaznaczone"?[...zaznaczoneDostepnoscProducentow]:dostepnoscProducentowWynikiIds,rez=rezerwacjeMagazynowe(),kanaly=sprzedazKanalyMagazynowe(30),spr=kanaly.razem;
  const rows=ids.map(produktMagazynowy).filter(Boolean).map(p=>{const id=String(p.id),i=producentDostepnoscInfo(p),stan=stanMagazynuId(p.id),plan=sugestiaZatowarowania(p,rez,spr),meta=magazynMetaProduktu(p.id);return [p.id,p.sku||"",p.gtin||p.ean||meta.kod||"",p.nazwa||"",p.producent||p.marka||meta.dostawca||"",i.status,i.quantity??"",i.checked||"",stan===null?"":stan,rez[id]||0,plan.dostepne===null?"":plan.dostepne,kanaly.sklep[id]||0,kanaly.allegro[id]||0,plan.ilosc||0,meta.lokalizacja||"",produktOznaczonyNiedostepny(p)?"wstrzymana":"aktywna",i.url||""];});
  adminEksportujCSV(`dostepnosc-${zakres}-${new Date().toISOString().slice(0,10)}.csv`,["ID","SKU","EAN","Produkt","Producent","Status producenta","Stan producenta","Ostatnia kontrola","Stan fizyczny","Rezerwacje","Dostępne lokalnie","Sprzedaż sklep 30 dni","Sprzedaż Allegro 30 dni","Do zamówienia","Lokalizacja","Sprzedaż","Źródło"],rows);
}
function ustawStroneAdminProduktow(n){stronaAdminProduktow=Math.max(1,Number(n)||1);void asortymentOdswiezWyniki({przewin:true});}
function ustawProduktyNaStronieAdmin(n){
  produktyNaStronieAdmin=[25,50,100,200,500,1000].includes(Number(n))?Number(n):50;
  stronaAdminProduktow=1;
  zapiszLS("artway_produkty_na_stronie_admin",produktyNaStronieAdmin);
  void asortymentOdswiezWyniki();
}
function ustawSortowanieAdminProduktow(v){sortowanieAdminProduktow=String(v||"external");stronaAdminProduktow=1;zapiszLS("artway_produkty_sortowanie_admin",sortowanieAdminProduktow);void asortymentOdswiezWyniki();}
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

/* Rezerwacje, stany i operacje magazynowe */
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
function klasyfikujPozycjeDoKompletacji({produkt=null,stan=null,brak=0,lokalizacja=""}={}){
  if(!produkt)return {decyzja:"nierozpoznany",gotowe:false,brakLokalizacji:false};
  if(stan===null)return {decyzja:"sprawdz_stan",gotowe:false,brakLokalizacji:false};
  if(Number(brak)>0)return {decyzja:"zamow_u_producenta",gotowe:false,brakLokalizacji:false};
  return {decyzja:"kompletuj",gotowe:true,brakLokalizacji:!String(lokalizacja||"").trim()};
}
function allegroAnalizaMagazynowaZamowienia(z){
  const rez=rezerwacjeMagazynowe();
  const pozycje=pozycjeAllegroMagazyn(z).map(p=>{
    const stan=p.produkt?stanMagazynuId(p.produkt.id):null,meta=p.produkt?magazynMetaProduktu(p.produkt.id):{};
    const laczne=p.produkt?Number(rez[p.produkt.id]||0):0,dostepne=stan===null?null:stan-laczne;
    const brak=!p.produkt||stan===null?null:Math.max(0,-dostepne),lokalizacja=String(meta.lokalizacja||"").trim(),dostawca=String(meta.dostawca||"").trim();
    const dokumenty=p.produkt?(agentAIZlecenia||[]).filter(doc=>agentAIPlanDokumentAktywny(doc)&&(doc.pozycje||[]).some(x=>String(x.produktId)===String(p.produkt.id))).map(doc=>({id:doc.id,numer:doc.numer||doc.id,status:doc.status||"szkic"})):[];
    const klasyfikacja=klasyfikujPozycjeDoKompletacji({produkt:p.produkt,stan,brak,lokalizacja});
    return {...p,stan,laczneRezerwacje:laczne,dostepne,brak,lokalizacja,dostawca,dokumentyProducenta:dokumenty,...klasyfikacja};
  });
  const nierozpoznane=pozycje.filter(p=>!p.produkt).length,bezStanu=pozycje.filter(p=>p.produkt&&p.stan===null).length,bezLokalizacji=pozycje.filter(p=>p.brakLokalizacji).length,braki=pozycje.reduce((s,p)=>s+Number(p.brak||0),0);
  return {pozycje,nierozpoznane,bezStanu,bezLokalizacji,braki,locationTasks:bezLokalizacji,gotowe:nierozpoznane===0&&bezStanu===0&&braki===0,fulfillmentReady:nierozpoznane===0&&bezStanu===0&&braki===0};
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
function magazynKodDoPorownania(value=""){return String(value??"").trim().toLowerCase().replace(/[\s_-]+/g,"");}
function magazynKodyProduktu(p={},meta=magazynMetaProduktu(p.id),typ="wszystkie"){
  const grupy={
    ean:[p.gtin,p.ean,p.gtin13,p.barcode,meta.kod],
    sku:[p.externalId,p.external_id,p.EXTERNAL_ID,p.sku,p.SKU,p.kodProduktu,p.productCode],
    producent:[p.kodProducenta,p.mpn,p.MPN,p.manufacturerCode],
    optima:[meta.optimaCode,p.optimaCode],
    dostawca:[meta.kodDostawcy,p.kodDostawcy,p.supplierCode],
    id:[p.id]
  };
  const values=typ==="wszystkie"?Object.values(grupy).flat():(grupy[typ]||[]);
  return [...new Set(values.map(value=>String(value??"").trim()).filter(Boolean))];
}
function magazynProduktPasujeDoKodu(p={},query="",typ="wszystkie"){
  const wanted=magazynKodDoPorownania(query);if(!wanted)return true;
  const wantedDigits=/^\d+$/.test(wanted)?(wanted.replace(/^0+/,"")||"0"):"";
  return magazynKodyProduktu(p,magazynMetaProduktu(p.id),typ).some(value=>{
    const candidate=magazynKodDoPorownania(value);
    if(candidate.includes(wanted))return true;
    return !!wantedDigits&&/^\d+$/.test(candidate)&&(candidate.replace(/^0+/,"")||"0")===wantedDigits;
  });
}
function magazynLokalizacjaWZakresie(code="",wanted="wszystkie"){
  const target=String(wanted||"wszystkie");if(target==="wszystkie")return true;
  const key=String(code||"").trim();if(target==="BRAK")return !key;
  let current=typeof magazynLokalizacjaPoKodzie==="function"?magazynLokalizacjaPoKodzie(key):null,guard=0;
  while(current&&guard++<12){
    if(String(current.kod)===target)return true;
    current=current.parentKod&&typeof magazynLokalizacjaPoKodzie==="function"?magazynLokalizacjaPoKodzie(current.parentKod):null;
  }
  return key===target||key.startsWith(`${target}-`);
}
function filtrujProduktyMagazynu(lista, rez, sprzedaz){
  const u=ustawieniaMagazynuPelne(), prog=Math.max(0,Number(u.progNiski)||5);
  let out=lista.filter(p=>!czyProduktAdminWKoszu(p));
  if(frazaMagazynu) out=out.filter(p=>{
    const meta=magazynMetaProduktu(p.id);
    const kartoteka=[...magazynKodyProduktu(p,meta),meta.lokalizacja,nazwaLokalizacjiMagazynu(meta.lokalizacja),sciezkaNazwLokalizacjiMagazynu(meta.lokalizacja),meta.dostawca,meta.uwagi].filter(Boolean).join(" ");
    return produktPasujeFrazie(p,frazaMagazynu)||kartoteka.toLowerCase().includes(frazaMagazynu.toLowerCase());
  });
  if(kodMagazynu)out=out.filter(p=>magazynProduktPasujeDoKodu(p,kodMagazynu,typKoduMagazynu));
  if(filtrMagazynu==="na-stanie") out=out.filter(p=>Number(stanMagazynuId(p.id)||0)>0);
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
  if(filtrMagazynu==="lokalizacje-zamowien") out=out.filter(p=>magazynLokalizacjeZamowienIds.has(String(p.id)));
  if(filtrMagazynu==="bezdostawcy") out=out.filter(p=>!magazynMetaProduktu(p.id).dostawca);
  if(filtrDostawcyMagazynu!=="wszyscy") out=out.filter(p=>String(magazynMetaProduktu(p.id).dostawca||"")===filtrDostawcyMagazynu);
  if(filtrLokalizacjiMagazynu!=="wszystkie") out=out.filter(p=>magazynLokalizacjaWZakresie(magazynMetaProduktu(p.id).lokalizacja,filtrLokalizacjiMagazynu));
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
    if(sortowanieMagazynu==="stan-malejaco") return (sb===null?-1:sb)-(sa===null?-1:sa)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="lokalizacja") return String(magazynMetaProduktu(a.id).lokalizacja||"ZZZ").localeCompare(String(magazynMetaProduktu(b.id).lokalizacja||"ZZZ"),"pl",{numeric:true,sensitivity:"base"})||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="inwentaryzacja") return (Date.parse(magazynMetaProduktu(a.id).ostatniaInwentaryzacja||0)||0)-(Date.parse(magazynMetaProduktu(b.id).ostatniaInwentaryzacja||0)||0);
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
function ustawFiltrMagazynu(filtr, sort="stan-malejaco"){
  frazaMagazynu="";kodMagazynu="";
  filtrMagazynu=filtr||"wszystkie";
  sortowanieMagazynu=sort||"stan-malejaco";
  stronaMagazynu=1;
  renderuj();
}
function wyczyscFiltryStanowMagazynu(){
  frazaMagazynu="";kodMagazynu="";typKoduMagazynu="wszystkie";grupowanieStanowMagazynu="lista";filtrMagazynu="na-stanie";filtrDostawcyMagazynu="wszyscy";filtrLokalizacjiMagazynu="wszystkie";filtrInwentaryzacjiMagazynu="wszystkie";sortowanieMagazynu="stan-malejaco";stronaMagazynu=1;renderuj();
}
function magazynUstawGrupowanieStanow(value="lista"){
  grupowanieStanowMagazynu=["lista","strefy","regaly","polki"].includes(value)?value:"lista";
  if(grupowanieStanowMagazynu!=="lista")sortowanieMagazynu="lokalizacja";
  stronaMagazynu=1;renderuj();
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
function eksportujFizyczneStanyMagazynu(ids=null,nazwa="fizyczne-stany-magazynowe.csv"){
  const rez=rezerwacjeMagazynowe(),wybrane=Array.isArray(ids)?new Set(ids.map(String)):null;
  const rows=[["id","sku","ean","produkt","kategoria","lokalizacja","stan_fizyczny","zarezerwowane","wolne","cena_brutto","wartosc_stanu","ostatnia_inwentaryzacja","ostatnia_korekta"].join(";")];
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&(!wybrane||wybrane.has(String(p.id)))).forEach(p=>{
    const stan=stanMagazynuId(p.id);if(stan===null)return;
    const meta=magazynMetaProduktu(p.id),r=Number(rez[String(p.id)]||0),wolne=stan-r,wartosc=kwotaNum(stan*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    rows.push([p.id,p.sku||"",p.gtin||p.ean||meta.kod||"",p.nazwa||"",p.kategoria||"",meta.lokalizacja||"",stan,r,wolne,kwotaNum(p.cena).toFixed(2).replace(".",","),wartosc,meta.ostatniaInwentaryzacja||"",meta.ostatniaKorekta||""].map(csvPole).join(";"));
  });
  if(rows.length===1){toast("Brak fizycznych stanów do eksportu");return;}
  pobierzPlik(nazwa,"\uFEFF"+rows.join("\n"),"text/csv");
  loguj("info",`Wyeksportowano fizyczne stany CSV (${rows.length-1} produktów)`);toast(`Wyeksportowano ${rows.length-1} fizycznych stanów ✅`);
}
function magazynEksportuj(zakres){
  const ids=zakres==="zaznaczone"?[...zaznaczoneMagazynProdukty]:magazynWynikiIds;
  eksportujFizyczneStanyMagazynu(ids,zakres==="zaznaczone"?"stany-fizyczne-zaznaczone.csv":"stany-fizyczne-filtrowane.csv");
}
function ruchMagazynuPasujeDoTypu(r={}){
  const qty=Number(r.ilosc||0),typ=String(r.typ||"").toLowerCase();
  if(filtrRuchowMagazynu==="przyjecia"&&qty<=0)return false;
  if(filtrRuchowMagazynu==="rozchody"&&qty>=0)return false;
  if(filtrRuchowMagazynu==="korekty"&&!typ.includes("korekt"))return false;
  if(filtrRuchowMagazynu==="dokumenty"&&!String(r.dokument||"").trim())return false;
  return true;
}
function ruchMagazynuTekst(r={}){return `${r.produktNazwa||""} ${r.sku||""} ${r.produktId||""} ${r.typ||""} ${r.powod||""} ${r.dokument||""}`.toLowerCase();}
function ruchMagazynuPasujeDoFiltra(r={}){
  if(!ruchMagazynuPasujeDoTypu(r))return false;
  const q=String(szukajRuchowMagazynu||"").trim().toLowerCase();
  return !q||ruchMagazynuTekst(r).includes(q);
}
function magazynSzukajRuchy(input){
  szukajRuchowMagazynu=String(input?.value||"");const q=szukajRuchowMagazynu.trim().toLowerCase();let widoczne=0;
  document.querySelectorAll("[data-warehouse-movement]").forEach(row=>{const show=!q||String(row.dataset.search||"").includes(q);row.hidden=!show;if(show)widoczne++;});
  const count=document.querySelector("[data-warehouse-movement-count]");if(count)count.textContent=String(widoczne);
}
function magazynEksportujRuchyCSV(){
  const rows=(ruchyMagazynowe||[]).filter(ruchMagazynuPasujeDoFiltra),header=["data","typ","produkt","sku_lub_id","ilosc","stan_przed","stan_po","dokument","powod"];
  adminEksportujCSV(`ruchy-magazynowe-${new Date().toISOString().slice(0,10)}.csv`,header,rows.map(r=>[r.dataTxt||r.data||"",r.typ||"",r.produktNazwa||"",r.sku||r.produktId||"",r.ilosc??"",r.stanPrzed??"",r.stanPo??"",r.dokument||"",r.powod||""]));
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

/* ═══════════ KATALOG ADMINA — INDEKS I CACHE DLA DUŻEGO ASORTYMENTU ═══════════ */
let asortymentIndeksCache={revision:-1,source:null,offers:null,mappings:null,states:null,availability:null,hidden:null,added:null,imported:null,value:null};
let asortymentWynikiCache={index:null,signature:"",value:null};
let asortymentCentralnyStan={status:"idle",signature:"",data:null,error:"",request:null};
let asortymentCentralnyCache=new Map(),asortymentCentralnyWylaczonyDo=0;
let asortymentCentralnyOstatni={signature:"",data:null,at:0};
const ASORTYMENT_CACHE_SWIEZY_MS=10*60*1000;
const ASORTYMENT_CACHE_MAX_MS=60*60*1000;
const ASORTYMENT_CACHE_MAX_WPISOW=64;
const ASORTYMENT_CACHE_MAX_PRODUKTOW=6000;

function asortymentCentralnyParametry(){
  return {q:szukajProduktow,category:filtrProduktow,producer:filtrProducentaProduktow,status:filtrStatusuProduktow,source:filtrZrodlaProduktow,stock:filtrStanuProduktow,allegro:filtrAllegroProduktow,data:filtrDanychProduktow,sale:filtrSprzedazyProduktow,promotion:filtrPromocjiProduktow,link:filtrLinkuProduktow,priceMin:cenaOdAdminProduktow,priceMax:cenaDoAdminProduktow,allegroPriceMin:cenaAllegroOdAdminProduktow,allegroPriceMax:cenaAllegroDoAdminProduktow,sort:sortowanieAdminProduktow,page:stronaAdminProduktow,limit:produktyNaStronieAdmin};
}
function asortymentCentralnyTrasaAktywna(){return ["/admin/asortyment","/admin/asortyment/produkty"].includes(trasa());}
function asortymentCentralnySygnatura(){return JSON.stringify(asortymentCentralnyParametry());}
function asortymentCentralnyWyczyscCache(){asortymentCentralnyCache.clear();asortymentCentralnyStan={status:"idle",signature:"",data:null,error:"",request:null};}
function asortymentCentralnyOznaczNieaktualny({hard=false}={}){
  if(hard)return asortymentCentralnyWyczyscCache();
  const staleAt=Date.now()-ASORTYMENT_CACHE_SWIEZY_MS-1;
  for(const entry of asortymentCentralnyCache.values())entry.at=Math.min(Number(entry.at)||staleAt,staleAt);
  if(asortymentCentralnyOstatni.data)asortymentCentralnyOstatni.at=Math.min(Number(asortymentCentralnyOstatni.at)||staleAt,staleAt);
}
function asortymentCentralnyCachePobierz(signature){
  const cached=asortymentCentralnyCache.get(signature);if(!cached)return null;
  if(Date.now()-cached.at>ASORTYMENT_CACHE_MAX_MS){asortymentCentralnyCache.delete(signature);return null;}
  asortymentCentralnyCache.delete(signature);asortymentCentralnyCache.set(signature,cached);return cached;
}
function asortymentCentralnyCacheZapisz(signature,data,at=Date.now()){
  asortymentCentralnyCache.delete(signature);asortymentCentralnyCache.set(signature,{at,data});
  let products=0;for(const entry of asortymentCentralnyCache.values())products+=Array.isArray(entry?.data?.items)?entry.data.items.length:0;
  while(asortymentCentralnyCache.size>ASORTYMENT_CACHE_MAX_WPISOW||products>ASORTYMENT_CACHE_MAX_PRODUKTOW){
    const oldest=asortymentCentralnyCache.keys().next().value,entry=asortymentCentralnyCache.get(oldest);
    products-=Array.isArray(entry?.data?.items)?entry.data.items.length:0;asortymentCentralnyCache.delete(oldest);
  }
}
function asortymentCentralnyProduktPoId(id){
  const key=String(id),find=data=>(data?.items||[]).find(item=>String(item?.id)===key)||null;
  return find(asortymentCentralnyStan.data)||find(asortymentCentralnyOstatni.data)||[...asortymentCentralnyCache.values()].reverse().map(entry=>find(entry.data)).find(Boolean)||null;
}
function asortymentCentralnyPodmienProdukt(id,patch={},usun=[]){
  const key=String(id),seen=new Set(),apply=data=>{
    if(!data||seen.has(data))return;seen.add(data);
    const item=(data.items||[]).find(product=>String(product?.id)===key);if(!item)return;
    Object.assign(item,patch);for(const field of usun)delete item[field];
  };
  apply(asortymentCentralnyStan.data);apply(asortymentCentralnyOstatni.data);
  for(const entry of asortymentCentralnyCache.values())apply(entry.data);
}
async function asortymentCentralnyPobierz(force=false,{render=true}={}){
  if(Date.now()<asortymentCentralnyWylaczonyDo)return null;
  const signature=asortymentCentralnySygnatura(),cached=!force?asortymentCentralnyCachePobierz(signature):null;
  if(cached){asortymentCentralnyStan={status:"ready",signature,data:cached.data,error:"",request:null};return cached.data;}
  if(asortymentCentralnyStan.status==="loading"&&asortymentCentralnyStan.signature===signature&&asortymentCentralnyStan.request)return asortymentCentralnyStan.request;
  const hadVisibleData=asortymentCentralnyStan.signature===signature&&!!asortymentCentralnyStan.data||asortymentCentralnyOstatni.signature===signature&&!!asortymentCentralnyOstatni.data;
  const params=asortymentCentralnyParametry(),request=chmura("product-catalog-query",{params,timeout:30000}).then(data=>{
    if(asortymentCentralnySygnatura()!==signature)return data;
    if(Array.isArray(data.items)&&typeof zapamietajProduktyCentralne==="function")zapamietajProduktyCentralne(data.items);
    const at=Date.now();asortymentCentralnyCacheZapisz(signature,data,at);asortymentCentralnyOstatni={signature,data,at};
    asortymentCentralnyStan={status:"ready",signature,data,error:"",request:null};
    if(render&&!hadVisibleData&&asortymentCentralnyTrasaAktywna())renderuj();return data;
  }).catch(error=>{
    if(asortymentCentralnySygnatura()!==signature)return null;
    asortymentCentralnyStan={status:"error",signature,data:null,error:String(error?.message||error),request:null};asortymentCentralnyWylaczonyDo=Date.now()+60*1000;
    loguj("ostrzezenie",`Centralna kartoteka chwilowo niedostępna — użyto bezpiecznego widoku lokalnego: ${error?.message||error}`);if(render&&!hadVisibleData&&asortymentCentralnyTrasaAktywna())renderuj();return null;
  });
  asortymentCentralnyStan={status:"loading",signature,data:null,error:"",request};return request;
}
function asortymentCentralnyWidok(){
  if(Date.now()<asortymentCentralnyWylaczonyDo)return {fallback:true,error:asortymentCentralnyStan.error};
  const signature=asortymentCentralnySygnatura(),cached=asortymentCentralnyCachePobierz(signature);
  if(cached){
    const refreshing=Date.now()-cached.at>ASORTYMENT_CACHE_SWIEZY_MS;
    if(refreshing&&(asortymentCentralnyStan.status!=="loading"||asortymentCentralnyStan.signature!==signature))setTimeout(()=>void asortymentCentralnyPobierz(true,{render:false}),0);
    return {ready:true,data:cached.data,refreshing,staleAt:cached.at};
  }
  if(asortymentCentralnyStan.status==="ready"&&asortymentCentralnyStan.signature===signature)return {ready:true,data:asortymentCentralnyStan.data};
  if(asortymentCentralnyStan.status!=="loading"||asortymentCentralnyStan.signature!==signature)setTimeout(()=>void asortymentCentralnyPobierz(),0);
  if(asortymentCentralnyOstatni.signature===signature&&asortymentCentralnyOstatni.data)return {ready:true,data:asortymentCentralnyOstatni.data,refreshing:true,staleAt:asortymentCentralnyOstatni.at};
  return {loading:true};
}

function asortymentSzybkieOfertyProduktu(p={},index=allegroIndeksOfert()){
  const wynik=new Map(),dodaj=lista=>{for(const oferta of lista||[]){const id=String(oferta?.id||"");if(id)wynik.set(id,oferta);}};
  const direct=String(p.allegroOfferId||"").trim();if(direct&&index.byId.has(direct))dodaj([index.byId.get(direct)]);
  dodaj(index.byProduct.get(String(p.id??"")));
  if(p.allegroProductId)dodaj(index.byCatalog.get(String(p.allegroProductId)));
  const external=allegroIndeksKandydatowKlucz(p.externalId||p.sku||p.kodProducenta||p.mpn);if(external)dodaj(index.byExternal.get(external));
  const gtin=allegroIndeksKanonicznyGtin(p.gtin||p.ean);if(gtin)dodaj(index.byEan.get(gtin));
  const code=allegroIndeksKandydatowKlucz(p.kodProducenta||p.mpn);if(code)dodaj(index.byCode.get(code));
  if(!wynik.size){const name=allegroIndeksKandydatowKlucz(p.nazwa||p.name);if(name)dodaj(index.byName.get(name));}
  return [...wynik.values()];
}
function asortymentTekstWyszukiwania(p={},offer=null){
  return normalizujSzukanyTekst([p.nazwa,p.opisKrotki,p.opis,p.kategoria,p.sku,p.gtin,p.ean,p.externalId,p.mpn,p.kodProducenta,p.allegroOfferId,offer?.id,p.producent,p.marka,p.kolorProduktu,p.rozmiar,p.material,(p.warianty||[]).join(" "),p.id].join(" "));
}

function asortymentIndeksDanych(){
  const source=produktyDoAdministracji(),revision=Number(adminRewizjaDanych)||0;
  const same=asortymentIndeksCache.revision===revision&&asortymentIndeksCache.source===source&&asortymentIndeksCache.offers===allegroOferty&&asortymentIndeksCache.mappings===allegroMapowania&&asortymentIndeksCache.states===stanyProduktow&&asortymentIndeksCache.availability===dostepnoscProduktow&&asortymentIndeksCache.hidden===produktyUkryte&&asortymentIndeksCache.added===produktyDodane&&asortymentIndeksCache.imported===produktyImportowane;
  if(same&&asortymentIndeksCache.value)return asortymentIndeksCache.value;
  const audytSklep=audytDuplikatowSklepu(),allegroIndex=allegroIndeksOfert(),allegroDuplicateGroups=[],allegroDuplicateOfferIds=new Set(),offerById=new Map(),metaById=new Map(),categories=new Set(),producers=new Set(),active=[],addedIds=new Set((produktyDodane||[]).map(p=>String(p.id))),importedIds=new Set((produktyImportowane||[]).map(p=>String(p.id)));
  const counts={connected:0,missing:0,ready:0,hidden:0,promotions:0,trash:0};
  for(const p of source){
    const id=String(p.id),offers=asortymentSzybkieOfertyProduktu(p,allegroIndex),activeOffers=offers.filter(o=>allegroDopasowanieDuplikatuAktywne({offer:o})),offer=activeOffers[0]||offers[0]||null,missing=asortymentBrakiDanych(p),trash=czyProduktAdminWKoszu(p),available=produktDostepnyWSprzedazy(p),manualUnavailable=produktOznaczonyNiedostepny(p),autoUnavailable=produktAutomatycznieNiedostepny(p);
    if(activeOffers.length>1){const dopasowania=activeOffers.map(offer=>({offer,score:100,reason:"powiązanie indeksu ofert"}));allegroDuplicateGroups.push({produkt:p,dopasowania});activeOffers.forEach(o=>allegroDuplicateOfferIds.add(String(o.id)));}
    if(offer)offerById.set(id,offer);if(p.kategoria)categories.add(String(p.kategoria).trim());const producer=String(p.producent||p.marka||"").trim();if(producer)producers.add(producer);
    metaById.set(id,{offer,missing,trash,available,manualUnavailable,autoUnavailable,search:null});
    if(trash){counts.trash++;continue;}active.push(p);if(offer)counts.connected++;if(missing.length)counts.missing++;else if(available)counts.ready++;if(!available)counts.hidden++;if(Number(p.staraCena)>Number(p.cena))counts.promotions++;
  }
  const audytAllegro={grupy:allegroDuplicateGroups,offerIds:allegroDuplicateOfferIds,produkty:allegroDuplicateGroups.length,oferty:allegroDuplicateOfferIds.size};
  const value={revision,source,audytSklep,audytAllegro,offerById,metaById,active,addedIds,importedIds,categories:[...categories].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pl")),producers:[...producers].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pl")),counts};
  asortymentIndeksCache={revision,source,offers:allegroOferty,mappings:allegroMapowania,states:stanyProduktow,availability:dostepnoscProduktow,hidden:produktyUkryte,added:produktyDodane,imported:produktyImportowane,value};asortymentWynikiCache={index:null,signature:"",value:null};return value;
}

function asortymentSygnaturaFiltrow(){
  return JSON.stringify([szukajProduktow,filtrProduktow,filtrStatusuProduktow,filtrZrodlaProduktow,filtrStanuProduktow,filtrAllegroProduktow,filtrProducentaProduktow,filtrDanychProduktow,filtrSprzedazyProduktow,filtrPromocjiProduktow,filtrLinkuProduktow,cenaOdAdminProduktow,cenaDoAdminProduktow,cenaAllegroOdAdminProduktow,cenaAllegroDoAdminProduktow,sortowanieAdminProduktow]);
}

function asortymentFiltrowaneProdukty(index=asortymentIndeksDanych()){
  const signature=asortymentSygnaturaFiltrow();if(asortymentWynikiCache.index===index&&asortymentWynikiCache.signature===signature&&asortymentWynikiCache.value)return asortymentWynikiCache.value;
  const query=normalizujSzukanyTekst(szukajProduktow).split(" ").filter(Boolean),duplicateStore=filtrStatusuProduktow==="duplikaty"?new Set(index.audytSklep.grupy.flatMap(g=>g.produkty.map(p=>String(p.id)))):null,duplicateAllegro=filtrAllegroProduktow==="duplikaty"?new Set((index.audytAllegro.grupy||[]).map(g=>String(g?.produkt?.id??"")).filter(Boolean)):null;
  const minStore=parseFloat(String(cenaOdAdminProduktow||"").replace(",",".")),maxStore=parseFloat(String(cenaDoAdminProduktow||"").replace(",",".")),minAllegro=parseFloat(String(cenaAllegroOdAdminProduktow||"").replace(",",".")),maxAllegro=parseFloat(String(cenaAllegroDoAdminProduktow||"").replace(",","."));
  const items=index.source.filter(p=>{
    const id=String(p.id),m=index.metaById.get(id),offer=m.offer,stock=stanyProduktow[p.id],missing=m.missing,sourceUrl=String(p.sourceUrl||p.producentUrl||p.urlProducenta||"").trim();
    if(query.length){if(m.search===null)m.search=asortymentTekstWyszukiwania(p,offer);if(!query.every(word=>m.search.includes(word)))return false;}
    if(filtrProduktow!=="Wszystkie"&&p.kategoria!==filtrProduktow)return false;
    if(filtrStatusuProduktow==="aktywne"&&m.trash||filtrStatusuProduktow==="kosz"&&!m.trash||filtrStatusuProduktow==="duplikaty"&&!duplicateStore.has(id))return false;
    if(filtrZrodlaProduktow==="bazowe"&&(index.addedIds.has(id)||index.importedIds.has(id))||filtrZrodlaProduktow==="wlasne"&&!index.addedIds.has(id)&&!index.importedIds.has(id))return false;
    if(filtrStanuProduktow==="dostepne"&&stock!==undefined&&Number(stock)<=0||filtrStanuProduktow==="niskie"&&!(Number(stock)>0&&Number(stock)<=5)||filtrStanuProduktow==="brak"&&Number(stock)!==0)return false;
    const offerStatus=String(offer?.status||"").toUpperCase();if(filtrAllegroProduktow==="aktywne"&&offerStatus!=="ACTIVE"||filtrAllegroProduktow==="szkice"&&(!offer||offerStatus==="ACTIVE")||filtrAllegroProduktow==="polaczone"&&!offer||filtrAllegroProduktow==="brak"&&offer||filtrAllegroProduktow==="duplikaty"&&!duplicateAllegro.has(id))return false;
    if(filtrProducentaProduktow!=="wszyscy"&&String(p.producent||p.marka||"")!==filtrProducentaProduktow)return false;
    if(filtrDanychProduktow==="gotowe"&&missing.length||filtrDanychProduktow==="braki"&&!missing.length||filtrDanychProduktow==="ean"&&!missing.includes("EAN")||filtrDanychProduktow==="zdjecie"&&!missing.includes("zdjęcie")||filtrDanychProduktow==="opis"&&!missing.includes("opis")||filtrDanychProduktow==="zrodlo"&&!missing.includes("źródło")||filtrDanychProduktow==="producent"&&!missing.includes("producent")||filtrDanychProduktow==="kategoria"&&!missing.includes("kategoria")||filtrDanychProduktow==="koszt"&&Number(p.cenaZakupu)>0)return false;
    if(filtrSprzedazyProduktow==="dostepne"&&!m.available||filtrSprzedazyProduktow==="niedostepne"&&m.available||filtrSprzedazyProduktow==="reczne"&&!m.manualUnavailable||filtrSprzedazyProduktow==="automat"&&!m.autoUnavailable)return false;
    if(filtrPromocjiProduktow==="promocje"&&!(Number(p.staraCena)>Number(p.cena))||filtrPromocjiProduktow==="regularne"&&Number(p.staraCena)>Number(p.cena)||filtrPromocjiProduktow==="nowosci"&&!String(p.badge||"").toLowerCase().includes("nowo"))return false;
    if(filtrLinkuProduktow==="z_linkiem"&&!sourceUrl||filtrLinkuProduktow==="bez_linku"&&sourceUrl)return false;
    const storePrice=kwotaNum(p.cena),allegroPrice=kwotaNum(p.cenaAllegro||p.cena);if(Number.isFinite(minStore)&&storePrice<minStore||Number.isFinite(maxStore)&&storePrice>maxStore||Number.isFinite(minAllegro)&&allegroPrice<minAllegro||Number.isFinite(maxAllegro)&&allegroPrice>maxAllegro)return false;
    return true;
  });
  const sorted=sortujProduktyAdmin(items),value={items:sorted,ids:sorted.map(p=>p.id)};asortymentWynikiCache={index,signature,value};return value;
}

let infaktWysylkiStan={loaded:false,loading:false,error:"",items:[],billing:{groups:[],pendingMonthly:0,carrierPendingGross:0,commissionPendingGross:0,customerPendingGross:0},updatedAt:null};
let infaktWysylkiSzukaj="",infaktWysylkiFiltr="wszystkie";

async function infaktWysylkiLaduj(force=false,cicho=false){
  if(infaktWysylkiStan.loading||(!force&&infaktWysylkiStan.loaded))return;
  infaktWysylkiStan={...infaktWysylkiStan,loading:true,error:""};
  try{
    const d=await chmura("inpost-service-shipments",{params:{limit:500},timeout:30000});
    infaktWysylkiStan={...infaktWysylkiStan,loaded:true,loading:false,items:Array.isArray(d.items)?d.items:[],billing:d.billing||{groups:[]},updatedAt:d.updatedAt||null,error:""};
    if(!cicho)toast(`Rozliczenia InPost odświeżone • ${infaktWysylkiStan.items.length} nadań`);
  }catch(e){
    infaktWysylkiStan={...infaktWysylkiStan,loaded:true,loading:false,error:e.message||String(e)};
    if(!cicho)toast("⚠️ Rozliczenia InPost: "+infaktWysylkiStan.error);
  }
  if(trasa()==="/admin/infakt/wysylki")renderuj();
}
async function infaktWysylkiFakturaMiesieczna(month,clientKey){
  try{
    const d=await chmura("inpost-service-bill",{method:"POST",body:{month,clientKey},timeout:60000});
    toast(d.invoice?.duplicatePrevented?"Dokument miesięczny już istnieje":`Przekazano ${d.count||0} nadań do jednej faktury inFakt ✅`);
    await Promise.all([infaktWysylkiLaduj(true,true),infaktLaduj(true,true)]);
    renderuj();
  }catch(e){toast("⚠️ Faktura za nadania: "+(e.message||e));}
}
function infaktWysylkiStatusHTML(item){
  const link=item.billing?.link,status=String(link?.status||item.billing?.status||"");
  if(status==="created")return `<span class="lvl lvl-ok">wystawiona ${esc(link?.invoiceNumber||"")}</span>`;
  if(status==="processing")return '<span class="lvl lvl-info">inFakt przetwarza</span>';
  if(status==="pending")return '<span class="lvl lvl-ostrzezenie">do FV miesięcznej</span>';
  if(status==="error")return `<span class="lvl lvl-blad">błąd</span>`;
  return '<span class="lvl">bez dokumentu</span>';
}
function infaktWysylkiLista(){
  const q=normalizujSzukanyTekst(infaktWysylkiSzukaj),terms=q.split(" ").filter(Boolean);
  return (infaktWysylkiStan.items||[]).filter(item=>{
    if(item.billing?.mode==="none")return false;
    const status=String(item.billing?.link?.status||item.billing?.status||"");
    if(infaktWysylkiFiltr==="oczekuje"&&!["pending","awaiting_invoice","error"].includes(status))return false;
    if(infaktWysylkiFiltr==="w_toku"&&status!=="processing")return false;
    if(infaktWysylkiFiltr==="wystawione"&&status!=="created")return false;
    const text=normalizujSzukanyTekst([item.reference,item.trackingNumber,item.sender?.companyName,item.sender?.firstName,item.sender?.lastName,item.sender?.email,item.sender?.taxCode,item.billing?.month].join(" "));
    return !terms.some(term=>!text.includes(term));
  });
}
function infaktWysylkiInpostPanelHTML(){
  if(infaktWysylkiStan.loading&&!infaktWysylkiStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram rejestr rozliczeń nadań…</div></div>';
  const billing=infaktWysylkiStan.billing||{},groups=billing.groups||[],rows=infaktWysylkiLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(infaktWysylkiSzukaj)}" placeholder="Firma, NIP, e-mail, referencja lub numer nadania…" oninput="infaktWysylkiSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="infaktWysylkiFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie rozliczenia</option><option value="oczekuje" ${infaktWysylkiFiltr==="oczekuje"?"selected":""}>Oczekujące</option><option value="w_toku" ${infaktWysylkiFiltr==="w_toku"?"selected":""}>Przetwarzane</option><option value="wystawione" ${infaktWysylkiFiltr==="wystawione"?"selected":""}>Wystawione</option></select></label><button class="btn ghost" onclick="infaktWysylkiSzukaj='';infaktWysylkiFiltr='wszystkie';renderuj()">Wyczyść</button>`;
  return `<div class="module-page-stack infakt-shipping-billing">
    <section class="orders-stat-grid">
      <div class="order-stat-card"><span>📮</span><b>${infaktWysylkiStan.items.length}</b><small>nadań w rejestrze</small></div>
      <div class="order-stat-card hot"><span>🧾</span><b>${billing.pendingMonthly||0}</b><small>do FV miesięcznej</small></div>
      <div class="order-stat-card"><span>📦</span><b>${zl(billing.carrierPendingGross||0)}</b><small>kosztów nadań</small></div>
      <div class="order-stat-card money"><span>💰</span><b>${zl(billing.customerPendingGross||0)}</b><small>łącznie na FV klientów</small></div>
    </section>
    ${infaktWysylkiStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(infaktWysylkiStan.error)}</div>`:""}
    <section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Rozliczenia firmowe Artway‑TM</span><h2>FV miesięczne dla nadawców</h2><p class="order-detail-lead">Klientem na fakturze zawsze jest nadawca. Jedna faktura obejmuje koszt każdego jego nadania według Twojej umowy InPost oraz prowizję Artway‑TM; odbiorca nie jest stroną rozliczenia.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/wysylki/inpost">Nowe nadanie</a><button class="btn ghost" onclick="infaktWysylkiLaduj(true,false)">↻ Odśwież</button></div></div>
      <div class="inpost-monthly-grid">${groups.map(group=>`<article class="${group.incompletePrices?"has-warning":""}"><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small><small>Koszt ${zl(group.carrierGross||0)} + prowizja ${zl(group.commissionGross||0)}</small>${group.incompletePrices?`<span class="lvl lvl-ostrzezenie">${group.incompletePrices} niepełnych wycen</span>`:""}</div><strong>${zl(group.customerTotalGross||0)}</strong><button class="btn" ${group.incompletePrices?"disabled title='Najpierw uzupełnij koszt wszystkich nadań'":""} onclick="infaktWysylkiFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz FV Artway‑TM</button></article>`).join("")||'<div class="backend-note">Brak nierozliczonych paczek miesięcznych.</div>'}</div>
    </section>
    <section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Ślad dokumentów</span><h2>Nadania przekazane do inFakt</h2><p class="order-detail-lead">Kontrola pokazuje osobno koszt nadania i prowizję, a na fakturę klienta trafia ich prawidłowa suma jako usługa Artway‑TM.</p></div></div>
      ${adminWyszukiwaniePanelHTML({id:"infakt-shipping",description:"Filtruj po kliencie, dokumencie, miesiącu albo numerze nadania.",fields,results:rows.length,active:!!(infaktWysylkiSzukaj||infaktWysylkiFiltr!=="wszystkie"),open:true})}
      <div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Nadawca / klient FV</th><th>Miesiąc</th><th>Koszt InPost</th><th>Prowizja</th><th>Kwota FV klienta</th><th>Status dokumentu</th></tr></thead><tbody>${rows.map(item=>`<tr><td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small></td><td data-label="Nadawca / klient FV"><b>${esc(item.sender?.companyName||`${item.sender?.firstName||""} ${item.sender?.lastName||""}`.trim()||"Nadawca")}</b><br><small>${esc(item.sender?.email||"")}${item.sender?.taxCode?` • NIP ${esc(item.sender.taxCode)}`:""}</small></td><td data-label="Miesiąc">${esc(item.billing?.month||"—")}<br><small>${item.billing?.mode==="monthly"?"zbiorczo":"pojedynczo"}</small></td><td data-label="Koszt InPost"><b>${zl(item.pricing?.totalGross||0)}</b></td><td data-label="Prowizja"><b>${zl(item.billing?.commissionGross||0)}</b></td><td data-label="Kwota FV"><b>${zl(item.pricing?.customerTotalGross||0)}</b>${item.pricing?.complete===true?"":'<br><span class="lvl lvl-ostrzezenie">niepełna wycena</span>'}</td><td data-label="Status">${infaktWysylkiStatusHTML(item)}</td></tr>`).join("")||'<tr><td colspan="7">Brak rozliczeń pasujących do filtrów.</td></tr>'}</tbody></table></div>
    </section>
  </div>`;
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
    if(!cicho)toast(infaktStan.connected?"Połączenie z inFakt działa ✅":infaktStan.credentialIssue==="masked_placeholder"?"⚠️ Na serwerze jest maska zamiast prawidłowego klucza inFakt":infaktStan.configured?"⚠️ Klucz inFakt wymaga sprawdzenia":"Dodaj klucz API inFakt po stronie serwera");
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
  const aktywna=["pulpit","zamowienia","faktury","wysylki","dostawcy","szkice","ustawienia"].includes(sekcja)?sekcja:"pulpit";
  if((!infaktStan.sprawdzono||((aktywna==="faktury"||aktywna==="pulpit")&&infaktStan.configured&&!infaktStan.invoicesLoaded))&&!infaktStan.ladowanie)setTimeout(()=>infaktLaduj(true,aktywna==="faktury"||aktywna==="pulpit"),0);
  if(aktywna==="dostawcy"&&infaktStan.configured&&!infaktStan.costsLoaded&&!infaktStan.costsLoading&&!infaktStan.ladowanie)setTimeout(()=>infaktLadujKoszty(true),50);
  if(aktywna==="wysylki"&&!infaktWysylkiStan.loaded&&!infaktWysylkiStan.loading)setTimeout(()=>infaktWysylkiLaduj(false,true),0);
  const orders=pobierzZamowienia().filter(z=>String(z.status||"")!=="anulowane").sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  const linked=infaktStan.links||{},company=orders.filter(z=>z.klient?.nip||z.klient?.firma),missing=company.filter(z=>!linked[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  const pending=Object.values(linked).filter(x=>x.status==="processing"),created=Object.values(linked).filter(x=>x.status==="created"),errors=Object.values(linked).filter(x=>x.status==="error");
  const query=String(szukajInfakt||"").toLowerCase().trim();let invoices=infaktFaktury.filter(f=>!query||`${f.number||""} ${f.client_company_name||""} ${f.client_first_name||""} ${f.client_last_name||""} ${f.client_tax_code||""}`.toLowerCase().includes(query));if(filtrInfakt!=="wszystkie")invoices=invoices.filter(f=>String(f.status||"")===filtrInfakt);
  const connection=infaktStan.connected?`<span class="lvl lvl-ok">API połączone • ${esc(infaktStan.env)}</span>`:infaktStan.credentialIssue==="masked_placeholder"?`<span class="lvl lvl-blad">zapisano maskę zamiast klucza API</span>`:infaktStan.configured?`<span class="lvl lvl-blad">błąd połączenia</span>`:`<span class="lvl lvl-ostrzezenie">brak INFAKT_API_KEY</span>`;
  const hero=`${infaktSubnavHTML(aktywna)}<div class="panel infakt-hero"><div class="order-section-head"><div><span class="order-pro-label">Wąski, kontrolowany dostęp API</span><h1>🧾 inFakt — sprzedaż i wybrani dostawcy</h1><p class="order-detail-lead">Sklep może wystawiać faktury VAT klientom oraz tylko odczytywać dokumenty kosztowe i pozycje KSeF dostawców z białej listy. Nie obsługuje księgowości, zapisu kosztów, rachunków bankowych ani konfiguracji KSeF.</p></div><div class="diag-actions">${connection}<button class="btn ghost" onclick="infaktLaduj(false,true)">↻ Sprawdź API</button>${infaktStan.configured?`<button class="btn" onclick="infaktSynchronizuj()">🔄 Synchronizuj faktury i ceny</button>`:""}</div></div>${aktywna==="pulpit"?`<div class="orders-stat-grid"><div class="order-stat-card ${missing.length?"hot":"money"}"><span>📦</span><b>${missing.length}</b><small>firmowych bez dokumentu</small></div><div class="order-stat-card"><span>⏳</span><b>${pending.length}</b><small>zadań w toku</small></div><div class="order-stat-card money"><span>✅</span><b>${created.length}</b><small>wystawionych</small></div><div class="order-stat-card"><span>🏭</span><b>${infaktStan.suppliers?.items?.length||0}</b><small>dozwolonych dostawców</small></div><div class="order-stat-card"><span>📥</span><b>${infaktKoszty.length}</b><small>pobranych faktur dostawców</small></div></div>`:""}</div>`;
  const orderRows=orders.filter(z=>{const text=`${z.nr||""} ${z.email||""} ${z.klient?.firma||""} ${z.klient?.nip||""}`.toLowerCase();return !query||text.includes(query);}).slice(0,200);
  const ordersPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>📦 Zamówienia do faktury</h2><p class="order-detail-lead">Jedyna operacja zapisu: utworzenie faktury VAT klienta z autorytatywnego zamówienia. Blokada idempotencji zapobiega podwójnej fakturze.</p></div><input placeholder="Szukaj numeru, klienta lub NIP…" value="${esc(szukajInfakt)}" oninput="szukajInfakt=this.value;zaplanujRenderPoWpisaniu()"></div><div class="infakt-order-list">${orderRows.map(z=>{const link=linked[z.nr],draft=szkiceFaktur.find(f=>f.nrZamowienia===z.nr),firm=!!(z.klient?.nip||z.klient?.firma);return `<article class="infakt-order-card"><div><b>${esc(z.nr)}</b><small>${esc(z.klient?.firma||z.email||"Klient")} ${z.klient?.nip?`• NIP ${esc(z.klient.nip)}`:""}</small><small>${esc(z.data||"")} • ${zl(kosztyZamowienia(z).razem)} • ${firm?"faktura firmowa":"osoba prywatna"}</small></div><div>${infaktStatusLinkuHTML(link||{})}${draft?` <span class="lvl lvl-info">szkic lokalny</span>`:""}</div><div class="diag-actions"><a class="btn ghost" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Zamówienie</a><button class="btn ghost" onclick="utworzSzkicFaktury(${jsArg(z.nr)})">${draft?"Odśwież szkic":"Szkic lokalny"}</button>${infaktStan.configured&&!link?`<button class="btn" onclick="infaktUtworzFakture(${jsArg(z.nr)})">Wystaw FV w inFakt</button>`:""}</div></article>`;}).join("")||`<div class="backend-note">Brak zamówień pasujących do wyszukiwania.</div>`}</div></div>`;
  const invoicesPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>🧾 Faktury sprzedaży utworzone przez sklep</h2><p class="order-detail-lead">Wyłącznie podgląd statusu dokumentów wystawionych z zamówień Artway-TM. Inne faktury z konta inFakt nie są zwracane do sklepu.</p></div><div class="diag-actions"><input placeholder="Numer, klient, NIP…" value="${esc(szukajInfakt)}" oninput="szukajInfakt=this.value;zaplanujRenderPoWpisaniu()"><select onchange="filtrInfakt=this.value;renderuj()">${[["wszystkie","Wszystkie"],["draft","Szkice"],["sent","Wysłane"],["printed","Wydrukowane"],["paid","Opłacone"]].map(([v,l])=>`<option value="${v}" ${filtrInfakt===v?"selected":""}>${l}</option>`).join("")}</select></div></div>${infaktStan.configured?`<div style="overflow:auto"><table class="log-table"><tr><th>Numer</th><th>Data</th><th>Kontrahent</th><th>Brutto</th><th>Status</th></tr>${invoices.map(f=>`<tr><td><b>${esc(f.number||"—")}</b><br><small>${esc(f.uuid||"")}</small></td><td>${esc(f.invoice_date||"—")}</td><td>${esc(f.client_company_name||`${f.client_first_name||""} ${f.client_last_name||""}`.trim()||"—")}<br><small>${esc(f.client_tax_code||"")}</small></td><td>${infaktKwota(f.gross_price)} ${esc(f.currency||"PLN")}</td><td><span class="lvl ${f.status==="paid"?"lvl-ok":"lvl-info"}">${esc(f.status||"—")}</span></td></tr>`).join("")||`<tr><td colspan="5">Brak faktur wystawionych przez sklep.</td></tr>`}</table></div>`:`<div class="backend-note">Integracja oczekuje na bezpieczny klucz serwerowy <b>INFAKT_API_KEY</b>.</div>`}</div>`;
  const draftsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>📝 Szkice robocze Artway-TM</h2><p class="order-detail-lead">Szkice można kontrolować przed wysłaniem. Usunięcie szkicu lokalnego nie usuwa dokumentu utworzonego już w inFakt.</p></div><button class="btn ghost" onclick="eksportujSzkiceFakturJSON()">Eksport JSON</button></div><div style="overflow:auto"><table class="log-table"><tr><th>Zamówienie</th><th>Kontrahent</th><th>Pozycje</th><th>Brutto</th><th>Status</th><th>Akcje</th></tr>${szkiceFaktur.map(f=>`<tr><td><b>${esc(f.nrZamowienia)}</b><br><small>${esc(f.dataTxt||"")}</small></td><td>${esc(f.kontrahent?.nazwa||"—")}<br><small>${esc(f.kontrahent?.nip||"")}</small></td><td>${esc(f.pozycje?.length||0)}</td><td>${zl(f.sumaBrutto)}</td><td>${infaktStatusLinkuHTML(linked[f.nrZamowienia]||{})}</td><td><button class="btn ghost" onclick="infaktUtworzFakture(${jsArg(f.nrZamowienia)})" ${infaktStan.configured&&!linked[f.nrZamowienia]?"":"disabled"}>Wyślij do inFakt</button><button class="btn danger" onclick="if(confirm('Usunąć tylko lokalny szkic?'))usunSzkicFaktury(${jsArg(f.id)})">Usuń szkic</button></td></tr>`).join("")||`<tr><td colspan="6">Brak szkiców.</td></tr>`}</table></div></div>`;
  const costsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>🏭 Faktury od wybranych dostawców</h2><p class="order-detail-lead">Serwer pobiera koszty wyłącznie do odczytu, a następnie ponownie filtruje je białą listą. Gdy lista jest pusta, nie ujawnia żadnego dokumentu.</p></div><button class="btn" onclick="infaktLadujKoszty()">↻ Pobierz dozwolone faktury</button></div>${infaktCenyZakupuPanelHTML()}${!(infaktStan.suppliers?.items?.length)?`<div class="backend-note"><b>Najpierw wybierz dostawców w ustawieniach.</b> Bez białej listy endpoint zwraca 0 dokumentów.</div>`:`<div style="overflow:auto"><table class="log-table"><tr><th>Data</th><th>Dostawca</th><th>Numer</th><th>Netto</th><th>VAT</th><th>Brutto</th><th>Status</th></tr>${infaktKoszty.map(k=>`<tr><td>${esc(k.issue_date||k.created_at?.slice(0,10)||"—")}</td><td><b>${esc(k.supplier?.name||k.seller_name||"—")}</b><br><small>${esc(k.seller_name||"")}</small></td><td>${esc(k.number||"—")}</td><td>${infaktKwota(k.net_price)}</td><td>${infaktKwota(k.tax_price)}</td><td><b>${infaktKwota(k.gross_price)} ${esc(k.currency||"PLN")}</b></td><td>${(k.statuses||[]).map(s=>`<span class="lvl lvl-info">${esc(s.name||s.symbol)}</span>`).join(" ")||"—"}</td></tr>`).join("")||`<tr><td colspan="7">Brak dokumentów pasujących do wybranych dostawców.</td></tr>`}</table></div>`}</div>`;
  const allowedMap=new Map((infaktStan.suppliers?.items||[]).map(x=>[String(x.id),x])),supplierRows=[...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>({id:String(p.id),name:p.name||p.nazwa||"Dostawca",sellerName:allowedMap.get(String(p.id))?.sellerName||p.name||p.nazwa||""})),...(infaktStan.suppliers?.items||[]).filter(x=>!(producenciKartoteka||[]).some(p=>String(p.id)===String(x.id)))];
  const settingsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>⚙️ Minimalny dostęp API</h2><p class="order-detail-lead">Klucz pozostaje wyłącznie na serwerze. Aplikacja korzysta tylko z trzech zakresów. Odczyt XML KSeF służy wyłącznie dopasowaniu pozycji zakupowych; sklep nie zapisuje kosztów i nie zmienia konfiguracji KSeF.</p></div>${connection}</div><div class="info-grid"><div class="info-card"><b>Dozwolone zakresy</b><p><code>api:costs:read</code><br><code>api:invoices:read</code><br><code>api:invoices:write</code></p></div><div class="info-card"><b>Zablokowane funkcje</b><p>zapis kosztów • księgowość • rachunki bankowe • zapis i konfiguracja KSeF</p></div><div class="info-card"><b>Środowisko</b><p>${esc(infaktStan.env||"production")}</p></div><div class="info-card"><b>Sekret serwera</b><p><code>INFAKT_API_KEY</code> — nigdy w HTML</p></div></div><div class="order-section-head"><div><h2>🏭 Biała lista dostawców</h2><p class="order-detail-lead">Zaznacz tylko firmy, których faktury zakupowe wolno pobierać. Pole po prawej musi odpowiadać nazwie sprzedawcy widocznej w inFakt.</p></div><button class="btn" onclick="infaktZapiszDostawcow()">💾 Zapisz białą listę</button></div><div class="infakt-supplier-access">${supplierRows.map(p=>{const a=allowedMap.get(String(p.id));return `<label class="info-card" data-infakt-supplier data-id="${esc(p.id)}" data-name="${esc(p.name)}"><span><input type="checkbox" ${a?"checked":""}> <b>${esc(p.name)}</b></span><input type="text" value="${esc(a?.sellerName||p.sellerName)}" placeholder="Nazwa sprzedawcy w inFakt"></label>`;}).join("")||`<div class="backend-note">Dodaj najpierw dostawców w kartotece producentów.</div>`}</div>${infaktStan.error?`<div class="backend-note" style="border-color:#fecaca;color:#991b1b"><b>Błąd:</b> ${esc(infaktStan.error)}</div>`:""}</div>`;
  const content=aktywna==="zamowienia"?ordersPanel:aktywna==="faktury"?invoicesPanel:aktywna==="wysylki"?infaktWysylkiInpostPanelHTML():aktywna==="dostawcy"?costsPanel:aktywna==="szkice"?draftsPanel:aktywna==="ustawienia"?settingsPanel:`${missing.length?ordersPanel:""}${costsPanel}`;
  return adminSzkielet("/admin/infakt",hero+content);
}

function asortymentAgentMetaHTML(p={}){
  const reviewed=p.agentQualityConfirmedAt||"",time=Date.parse(reviewed||"");
  if(p.agentQualityReadbackConfirmed!==true||String(p.agentQualityReviewStatus||"")!=="confirmed")return "";
  if(!Number.isFinite(time))return "";
  const states=p.contentEditorial?.channelStates||{},publication=(channel)=>{
    const state=String(states[channel]?.publicationStatus||(channel==="allegro"?p.allegroEditorialSyncState:channel==="vonHalsky"?p.vonHalskyEditorialSyncState:"confirmed")||"").toLowerCase();
    if(["confirmed","synced"].includes(state))return "✓";
    if(["queued","pending","publishing","retry"].includes(state))return "↻";
    if(["decision_required","requires_publication_decision","blocked","requires_mapping_review"].includes(state))return "!";
    return "—";
  };
  const date=new Date(time).toLocaleString("pl-PL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  return `<small class="catalog-product-agent-meta" title="Oznaczenie pojawia się dopiero po zapisie całego przeglądu i odczycie kontrolnym centralnej kartoteki.">🤖 Pełny przegląd zapisany ${esc(date)} • sklep ${publication("store")} • Allegro ${publication("allegro")} • Von Halsky ${publication("vonHalsky")}</small>`;
}
function asortymentKartaProduktuHTML(p={},ukrytaKopia=false){
  const dodany=jestProduktemDodanym(p.id)||["dodany","import"].includes(String(p?._catalog?.source||"")),ukryty=czyProduktAdminWKoszu(p)||p?._catalog?.recordStatus==="trash",edytowany=!!produktyEdytowane[p.id],selected=zaznaczoneProdukty.has(p.id)||zaznaczoneProdukty.has(String(p.id));
  const braki=asortymentBrakiDanych(p),sourceUrl=String(p.sourceUrl||p.producentUrl||p.urlProducenta||"").trim(),image=p.zdjecie||(Array.isArray(p.zdjecia)?p.zdjecia[0]:"")||"";
  const cena=kwotaNum(p.cena),cenaAllegro=kwotaNum(p.cenaAllegro||p.cena),cenaVonHalsky=kwotaNum(p.cenaVonHalsky)||cenaAllegro,promocja=Number(p.staraCena)>cena?Math.max(0,Math.round((1-cena/Number(p.staraCena))*100)):0,stan=stanyProduktow[p.id]!==undefined?stanyProduktow[p.id]:(p.stan??p?._catalog?.inventory?.stock);
  const availabilityLabel=produktAutomatycznieNiedostepny(p)?"Sprawdź oba kanały":produktOznaczonyNiedostepny(p)?"Wznów sklep + Allegro":"Wstrzymaj sklep + Allegro";
  return `<article class="allegro-publication-card catalog-product-card ${selected?"selected is-selected":""} ${ukryty?"deleted":""}" data-assortment-product-card data-product-id="${esc(p.id)}" data-assortment-product-key="${esc(p.id)}">
    <label class="allegro-publication-check"><input class="assortment-check" type="checkbox" aria-label="Zaznacz ${esc(p.nazwa||"produkt")}" data-assortment-product-id="${esc(p.id)}" ${selected?"checked":""} onchange="przelaczZaznProd(${jsArg(p.id)})"><span>Zaznacz produkt</span></label>
    <div class="allegro-publication-product catalog-product-identity">${image?`<img src="${esc(image)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="empty-image" style="display:none">${esc(p.ikona||"📦")}</span>`:`<span class="empty-image">${esc(p.ikona||"📦")}</span>`}<div><small class="catalog-column-label">Produkt</small><h3>${esc(p.nazwa||"Produkt bez nazwy")}</h3><p>ID ${esc(p.id)}${dodany?" • dodany":""}${edytowany?" • edytowany":""}${ukryty?" • w koszu":""}${promocja?` • promocja −${promocja}%`:""}</p><div class="allegro-publication-codes"><code>EXTERNAL_ID ${esc(p.externalId||"—")}</code><code>SKU ${esc(p.sku||"—")}</code><code>EAN ${esc(p.gtin||p.ean||"—")}</code></div>${braki.length?`<span class="catalog-product-data-note missing">⚠️ Braki: ${esc(braki.slice(0,3).join(", "))}${braki.length>3?` +${braki.length-3}`:""}</span>`:`<span class="catalog-product-data-note complete">✓ Dane kompletne</span>`}${asortymentAgentMetaHTML(p)}</div></div>
    <div class="catalog-product-classification"><small class="catalog-column-label">Klasyfikacja i źródło</small><b>${esc(p.producent||p.marka||"Bez producenta")}</b><span>${esc(p.kategoria||"Bez kategorii")}</span>${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">Źródło produktu ↗</a>`:`<small>Brak linku źródłowego</small>`}${ukrytaKopia?`<em>Ukryta kopia katalogowa</em>`:""}</div>
    <div class="catalog-product-operational-data"><small class="catalog-column-label">Ceny i magazyn</small><div class="catalog-product-values"><span class="catalog-product-edit-value"><small>Cena sklepu</small><label><input value="${String(cena.toFixed(2)).replace(".",",")}" inputmode="decimal" aria-label="Cena sklepu: ${esc(p.nazwa||"produkt")}" onchange="ustawCene(${jsArg(p.id)},this.value,this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"><em>zł</em></label><i data-inline-price-status aria-live="polite"></i></span><span class="catalog-product-edit-value"><small>Cena Allegro</small><label><input value="${p.cenaAllegro==null?"":String(cenaAllegro.toFixed(2)).replace(".",",")}" placeholder="${cena?String(cena.toFixed(2)).replace(".",","):"dziedziczy sklep"}" inputmode="decimal" aria-label="Cena Allegro: ${esc(p.nazwa||"produkt")}" onchange="ustawCeneKanalu(${jsArg(p.id)},'allegro',this.value,this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"><em>zł</em></label><i data-inline-price-status aria-live="polite"></i></span><span class="catalog-product-edit-value"><small>Von Halsky</small><label><input value="${p.cenaVonHalsky==null?"":String(cenaVonHalsky.toFixed(2)).replace(".",",")}" placeholder="${cenaAllegro?String(cenaAllegro.toFixed(2)).replace(".",","):"dziedziczy Allegro"}" inputmode="decimal" aria-label="Cena Von Halsky: ${esc(p.nazwa||"produkt")}" onchange="ustawCeneKanalu(${jsArg(p.id)},'vonHalsky',this.value,this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"><em>zł</em></label><i data-inline-price-status aria-live="polite"></i><small>pusta = Allegro</small></span><span class="catalog-product-edit-value catalog-product-purchase-price"><small>Zakup — tylko administrator</small><label><input value="${p.cenaZakupu==null?"":String(kwotaNum(p.cenaZakupu).toFixed(2)).replace(".",",")}" placeholder="brak" inputmode="decimal" aria-label="Prywatna cena zakupu: ${esc(p.nazwa||"produkt")}" onchange="ustawCeneZakupu(${jsArg(p.id)},this.value,this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"><em>zł</em></label><i data-inline-price-status aria-live="polite"></i></span><span class="catalog-product-edit-value"><small>Stan magazynowy</small><label><input value="${stan??""}" placeholder="∞" inputmode="numeric" aria-label="Stan magazynowy: ${esc(p.nazwa||"produkt")}" onchange="ustawStan(${jsArg(p.id)},this.value)" class="${Number(stan)===0?"empty":""}"><em>${stan===undefined||stan===""?"bez limitu":"szt."}</em></label></span></div></div>
    <div class="catalog-product-actions"><small class="catalog-column-label">Sprzedaż, Allegro i akcje</small><div class="catalog-product-channel-summary">${allegroStatusProduktuHTML(p)}</div><div class="catalog-product-sale-status">${dostepnoscBadgeAdmin(p)}</div><button class="btn ghost catalog-product-availability-action" onclick="przelaczDostepnoscProduktu(${jsArg(p.id)})">${availabilityLabel}</button><div class="catalog-product-buttons"><a class="btn" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}" title="Edytuj produkt">✏️ Edytuj</a>${asortymentMenuDzialanProduktuHTML(p)}<button class="btn ghost" onclick="duplikujProdukt(${jsArg(p.id)})" title="Duplikuj produkt">📄 Kopia</button>${ukryty?`<button class="btn ghost" onclick="przywrocProdukt(${jsArg(p.id)})" title="Przywróć">↩️ Przywróć</button>`:`<button class="btn danger" onclick="if(confirm('Przenieść produkt do kosza?')) usunProduktAdmin(${jsArg(p.id)})" title="Przenieś do kosza">🗑️ Kosz</button>`}</div></div>
  </article>`;
}

const ASORTYMENT_PARTIA_KART=10;
let asortymentKartyOczekujace=[],asortymentKartyObserwator=null,asortymentKartyGeneracja=0,asortymentKartyZaladowane=0,asortymentKartyRazem=0;
function asortymentRenderujElementKarty(item){return item?.produkt?asortymentKartaProduktuHTML(item.produkt,item.ukrytaKopia===true):String(item||"");}
function asortymentPrzygotujKartyProgresywnie(lista=[]){
  asortymentKartyObserwator?.disconnect();asortymentKartyObserwator=null;
  const generation=++asortymentKartyGeneracja,items=Array.isArray(lista)?lista:[];
  asortymentKartyRazem=items.length;asortymentKartyZaladowane=Math.min(ASORTYMENT_PARTIA_KART,items.length);
  asortymentKartyOczekujace=items.slice(ASORTYMENT_PARTIA_KART);
  const first=items.slice(0,ASORTYMENT_PARTIA_KART).map(asortymentRenderujElementKarty).join("");
  if(!asortymentKartyOczekujace.length)return first;
  setTimeout(()=>asortymentUruchomDoloadowywanieKart(generation),0);
  return `${first}<div class="assortment-progressive-loader" data-assortment-card-loader data-generation="${generation}"><span><b>Załadowano ${Math.min(ASORTYMENT_PARTIA_KART,items.length)} z ${items.length}</b><small>Kolejne produkty pojawią się automatycznie podczas przewijania.</small></span><button class="btn ghost" type="button" onclick="asortymentDoloadujKarty(${generation})">Pokaż kolejne</button></div>`;
}
function asortymentDoloadujKarty(generation=asortymentKartyGeneracja){
  const loader=document.querySelector(`[data-assortment-card-loader][data-generation="${Number(generation)}"]`);
  if(!loader||Number(generation)!==asortymentKartyGeneracja)return false;
  const batch=asortymentKartyOczekujace.splice(0,ASORTYMENT_PARTIA_KART);
  if(batch.length){loader.insertAdjacentHTML("beforebegin",batch.map(asortymentRenderujElementKarty).join(""));asortymentKartyZaladowane+=batch.length;}
  if(!asortymentKartyOczekujace.length){asortymentKartyObserwator?.disconnect();asortymentKartyObserwator=null;loader.remove();return true;}
  const label=loader.querySelector("b");if(label)label.textContent=`Załadowano ${asortymentKartyZaladowane} z ${asortymentKartyRazem}`;
  return true;
}
function asortymentUruchomDoloadowywanieKart(generation=asortymentKartyGeneracja){
  const loader=document.querySelector(`[data-assortment-card-loader][data-generation="${Number(generation)}"]`);if(!loader)return;
  if(typeof IntersectionObserver!=="function")return;
  asortymentKartyObserwator?.disconnect();
  asortymentKartyObserwator=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))asortymentDoloadujKarty(generation);},{rootMargin:"500px 0px"});
  asortymentKartyObserwator.observe(loader);
}

function widokAdminProdukty(){
  allegroLadujJesliTrzeba("offers");
  const centralny=typeof asortymentCentralnyWidok==="function"?asortymentCentralnyWidok():{fallback:true};
  if(centralny.loading)return asortymentSzkielet("produkty",`<div class="assortment-catalog-workspace"><header class="panel assortment-catalog-hero"><div><span class="order-pro-label">Centralna kartoteka PostgreSQL</span><h1>🏷️ Katalog produktów</h1><p>Pobieram wyłącznie bieżącą stronę produktów, filtry i liczniki. Pełny katalog nie jest ponownie przesyłany do przeglądarki.</p></div></header><section class="panel assortment-central-loading" aria-live="polite"><div class="spinner"></div><div><b>Ładowanie kartoteki produktów…</b><small>Wyszukiwanie, sortowanie i paginacja są wykonywane na serwerze.</small></div></section></div>`);
  const centralData=centralny.ready?centralny.data:null,centralSummary=centralData?.summary||{};
  const index=centralData?{source:{length:Number(centralSummary.total)||Number(centralData.total)||0},active:{length:Number(centralSummary.active)||0},categories:(centralData.facets?.categories||[]).map(x=>x.value),producers:(centralData.facets?.producers||[]).map(x=>x.value),counts:{connected:Number(centralSummary.connected)||0,missing:Number(centralSummary.missing)||0,ready:Number(centralSummary.ready)||0,hidden:Number(centralSummary.hidden)||0,promotions:Number(centralSummary.promotions)||0,trash:Number(centralSummary.trash)||0},audytSklep:{produkty:Number(centralSummary.duplicate_store)||0,grupy:[],hiddenIds:new Set(),centralOnly:true},audytAllegro:{produkty:Number(centralSummary.duplicate_allegro)||0,grupy:[],offerIds:new Set(),centralOnly:true}}:asortymentIndeksDanych();
  const audytAllegro=index.audytAllegro,audytSklep=index.audytSklep,katalogWszystkie=index.source,wyniki=centralData?{items:Array.isArray(centralData.items)?centralData.items:[],ids:Array.isArray(centralData.ids)?centralData.ids:(centralData.items||[]).map(p=>p.id)}:asortymentFiltrowaneProdukty(index),wszystkie=wyniki.items;
  const liczbaWynikow=centralData?Number(centralData.total)||0:wszystkie.length;
  const liczbaStron=Math.max(1,Math.ceil(liczbaWynikow/produktyNaStronieAdmin));
  stronaAdminProduktow=Math.min(Math.max(1,stronaAdminProduktow),liczbaStron);
  const fragment=centralData?wszystkie:wszystkie.slice((stronaAdminProduktow-1)*produktyNaStronieAdmin,stronaAdminProduktow*produktyNaStronieAdmin);
  asortymentWynikiIds=wyniki.ids;asortymentStronaIds=fragment.map(p=>p.id);
  const katOpcje=index.categories,producenciOpcje=index.producers;
  const bazoweWKoszu=bazoweProduktyWKoszu();
  const liczbaWKoszu=centralData?Number(centralSummary.trash)||0:koszDodanych.length+bazoweWKoszu.length;
  const aktywneKarty=index.active,polaczoneAllegro=index.counts.connected,zBrakami=index.counts.missing,gotoweDoSprzedazy=index.counts.ready,ukryteSprzedazowo=index.counts.hidden;
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
  if(filtrLinkuProduktow!=="wszystkie")aktywneFiltry.push(["link",`Link producenta: ${filtrLinkuProduktow}`]);
  if(cenaOdAdminProduktow||cenaDoAdminProduktow)aktywneFiltry.push(["cena",`Cena: ${cenaOdAdminProduktow||"0"}–${cenaDoAdminProduktow||"∞"} zł`]);
  if(cenaAllegroOdAdminProduktow||cenaAllegroDoAdminProduktow)aktywneFiltry.push(["cenaAllegro",`Cena Allegro: ${cenaAllegroOdAdminProduktow||"0"}–${cenaAllegroDoAdminProduktow||"∞"} zł`]);
  const aktywnyWidok=filtrStatusuProduktow==="kosz"?"kosz":filtrDanychProduktow==="gotowe"&&filtrSprzedazyProduktow==="dostepne"?"gotowe":filtrDanychProduktow==="braki"?"braki":filtrAllegroProduktow==="brak"?"bez-allegro":filtrSprzedazyProduktow==="niedostepne"?"ukryte":filtrPromocjiProduktow==="promocje"?"promocje":aktywneFiltry.length===0?"aktywne":"";
  const opcje=(lista,wartosc)=>lista.map(([v,l])=>`<option value="${esc(v)}" ${String(wartosc)===String(v)?"selected":""}>${esc(l)}</option>`).join("");
  const kartyProduktowHTML=fragment.length?asortymentPrzygotujKartyProgresywnie(fragment.map(produkt=>({produkt,ukrytaKopia:audytSklep.hiddenIds.has(String(produkt.id))}))):`<div class="allegro-listing-empty assortment-empty"><span>⌕</span><b>Brak produktów pasujących do filtrów</b><small>Usuń wybrane kryteria albo wróć do widoku aktywnych produktów.</small><button class="btn ghost" onclick="asortymentResetujFiltry()">Pokaż aktywne produkty</button></div>`;
  return asortymentSzkielet("produkty", `
    <div class="assortment-catalog-workspace">
      <header class="panel assortment-catalog-hero">
        <div><span class="order-pro-label">Centralna kartoteka sprzedaży</span><h1>🏷️ Katalog produktów</h1><p>Jeden operacyjny widok produktów sklepu, magazynu i Allegro. Wyszukuj po wielu polach, łącz filtry i wykonuj operacje na całym wyniku bez utraty kontekstu.</p><small>${centralData?Number(centralSummary.active)||0:produkty.length} aktywnych w sklepie • ${katalogWszystkie.length} wszystkich kart • ${producenciOpcje.length} producentów • ${centralData?"PostgreSQL i paginacja serwerowa":"bezpieczny cache lokalny"}${centralny.refreshing?" • aktualizacja w tle — obecny wynik pozostaje widoczny":""}</small></div>
        <div class="assortment-catalog-actions"><a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a><a class="btn ghost" href="#/admin/produkty/z-pliku">📄 Import linków</a><a class="btn ghost" href="#/admin/mapowanie">🧩 Mapowanie</a><a class="btn ghost" href="#/admin/eksport">⇄ Import / eksport</a><details><summary>Więcej operacji</summary><button class="btn ghost" onclick="eksportujProduktyJSON()">📤 Eksport JSON</button><button class="btn ghost" onclick="eksportujProduktyCSV()">📤 Eksport CSV</button></details></div>
      </header>
      <nav class="assortment-saved-views" aria-label="Szybkie widoki katalogu">
        ${[["aktywne","🏷️ Aktywne",aktywneKarty.length],["gotowe","✅ Gotowe do sprzedaży",gotoweDoSprzedazy],["braki","⚠️ Braki danych",zBrakami],["bez-allegro","🟠 Bez Allegro",aktywneKarty.length-polaczoneAllegro],["ukryte","⏸️ Ukryte sprzedażowo",ukryteSprzedazowo],["promocje","🔥 Promocje",index.counts.promotions],["kosz","🗑️ Kosz",liczbaWKoszu]].map(([v,l,n])=>`<button type="button" class="${aktywnyWidok===v?"active":""}" onclick="asortymentUstawWidok(${jsArg(v)})"><span>${l}</span><b>${n}</b></button>`).join("")}
      </nav>
      <div class="orders-stat-grid assortment-audit-grid admin-pattern-metrics">
        <button class="order-stat-card stat-filter ${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('aktywne')" aria-pressed="${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"}"><span>🏷️</span><b>${aktywneKarty.length}</b><small>aktywne karty produktów</small></button>
        <button class="order-stat-card stat-filter money ${filtrAllegroProduktow==="polaczone"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_polaczone')" aria-pressed="${filtrAllegroProduktow==="polaczone"}"><span>🟠</span><b>${polaczoneAllegro}</b><small>połączone z Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytAllegro.produkty?"hot":"money"} ${filtrAllegroProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_duplikaty')" aria-pressed="${filtrAllegroProduktow==="duplikaty"}"><span>${audytAllegro.produkty?"⚠️":"✅"}</span><b>${audytAllegro.produkty}</b><small>podejrzenie duplikatu Allegro</small></button>
        <button class="order-stat-card stat-filter ${filtrAllegroProduktow==="brak"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_brak')" aria-pressed="${filtrAllegroProduktow==="brak"}"><span>➕</span><b>${aktywneKarty.length-polaczoneAllegro}</b><small>bez oferty Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytSklep.produkty?"hot":"money"} ${filtrStatusuProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('duplikaty_sklepu')" aria-pressed="${filtrStatusuProduktow==="duplikaty"}"><span>${audytSklep.produkty?"🧬":"✅"}</span><b>${audytSklep.produkty}</b><small>karty w grupach duplikatów sklepu</small></button>
      </div>
      <section class="panel assortment-catalog-page admin-pattern-surface allegro-listing-catalog catalog-product-card-center">
      <details class="assortment-maintenance" ${filtrStatusuProduktow==="duplikaty"||filtrAllegroProduktow==="duplikaty"?"open":""}><summary><span><b>🧬 Kontrola duplikatów i porządkowanie</b><small>Rozwiń tylko wtedy, gdy chcesz porównać lub uporządkować powtarzające się karty.</small></span><span><strong>Sklep: ${audytSklep.produkty}</strong><strong>Allegro: ${audytAllegro.produkty}</strong></span></summary><div class="assortment-maintenance-body">
        ${audytSklep.grupy.length?`<section class="allegro-duplicate-center store-duplicate-center"><div class="order-section-head"><div><span class="order-pro-label">Porządkowanie katalogu sklepu</span><h3>Powtarzające się produkty (${audytSklep.grupy.length} grup)</h3><p class="order-detail-lead">Wybierz kartę główną dopiero po porównaniu identyfikatorów i danych.</p></div><button class="btn ghost" onclick="asortymentUstawFiltr('status','duplikaty')">Pokaż wszystkie kopie</button></div><div class="allegro-duplicate-groups">${audytSklep.grupy.slice(0,12).map(g=>`<article class="allegro-duplicate-group"><header><div><b>${esc(g.canonical.nazwa||"Produkt")}</b><small>Wspólny klucz: ${esc(g.keys.join(" • "))}</small></div><span class="lvl lvl-ostrzezenie">${g.produkty.length} kart</span></header><div class="allegro-duplicate-options">${g.produkty.map(p=>`<button type="button" class="allegro-duplicate-option ${String(p.id)===String(g.canonical.id)?"is-canonical":""}" onclick="ustawProduktGlownyDuplikatu(${jsArg(g.groupKey)},${jsArg(p.id)})"><div class="allegro-duplicate-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa)}</b><small>ID ${esc(p.id)} • EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||"—")}</small><em>${String(p.id)===String(g.canonical.id)?"✅ karta główna":"kopia do decyzji"}</em></div></div></button>`).join("")}</div><div class="diag-actions"><button class="btn danger" onclick="usunKopieGrupyProduktuTrwale(${jsArg(g.groupKey)})">🗑️ Pozostaw 1 i usuń trwale ${g.hidden.length} kopii</button></div></article>`).join("")}</div></section>`:audytSklep.produkty?`<div class="duplicate-audit-ok"><b>🧬 Centralna kontrola:</b> ${audytSklep.produkty} kart ma wspólny silny identyfikator. Użyj filtra „Powtarzające się”, aby wyświetlić je bez pobierania całego katalogu.</div>`:`<div class="duplicate-audit-ok"><b>✅ Katalog sklepu:</b> brak powtarzających się produktów.</div>`}
        ${audytAllegro.produkty&&audytAllegro.grupy?.length?allegroCentrumDuplikatowHTML(audytAllegro,{compact:true,maxGroups:12}):audytAllegro.produkty?`<div class="duplicate-audit-ok"><b>🟠 Centralna kontrola Allegro:</b> ${audytAllegro.produkty} kart wymaga sprawdzenia wielu aktywnych ofert.</div>`:`<div class="duplicate-audit-ok"><b>✅ Allegro:</b> brak produktów połączonych z więcej niż jedną ofertą.</div>`}
      </div></details>
      <details class="assortment-filter-panel admin-search-standard" open><summary><span><b>🔎 Wyszukiwanie zaawansowane</b><small>Ten sam standard co w centrum wystawiania: łącz identyfikatory, producenta, kategorię, dostępność, magazyn, Allegro, źródło i ceny obu kanałów.</small></span><span class="admin-search-summary-meta" data-assortment-filter-summary>${aktywneFiltry.length?`<em>${aktywneFiltry.length} aktywnych</em>`:""}<strong>${liczbaWynikow} wyników</strong><i aria-hidden="true"></i></span></summary><div class="admin-search-standard-body assortment-advanced-grid allegro-listing-advanced-grid">
        <label class="allegro-listing-search-wide"><span>Produkt lub identyfikator</span><input data-assortment-search placeholder="Nazwa, EXTERNAL_ID, SKU, EAN, kod producenta, ID produktu lub oferty…" value="${esc(szukajProduktow)}" oninput="asortymentSzukajProdukty(this)" autocomplete="off"></label>
        <label><span>Kategoria</span><select onchange="asortymentUstawFiltr('kategoria',this.value)"><option value="Wszystkie">Wszystkie kategorie</option>${katOpcje.map(k=>`<option value="${esc(k)}" ${k===filtrProduktow?"selected":""}>${esc(k)}</option>`).join("")}</select></label>
        <label><span>Producent</span><select onchange="asortymentUstawFiltr('producent',this.value)"><option value="wszyscy">Wszyscy producenci</option>${producenciOpcje.map(p=>`<option value="${esc(p)}" ${p===filtrProducentaProduktow?"selected":""}>${esc(p)}</option>`).join("")}</select></label>
        <label><span>Status kartoteki</span><select onchange="asortymentUstawFiltr('status',this.value)">${opcje([["aktywne","Tylko aktywne"],["wszystkie","Aktywne i kosz"],["kosz",`Tylko w koszu (${liczbaWKoszu})`],["duplikaty",`Powtarzające się (${audytSklep.produkty})`]],filtrStatusuProduktow)}</select></label>
        <label><span>Dostępność sprzedażowa</span><select onchange="asortymentUstawFiltr('sprzedaz',this.value)">${opcje([["wszystkie","Każda dostępność"],["dostepne","Widoczne w sprzedaży"],["niedostepne","Ukryte w sprzedaży"],["reczne","Wyłączone ręcznie"],["automat","Wyłączone automatycznie"]],filtrSprzedazyProduktow)}</select></label>
        <label><span>Źródło kartoteki</span><select onchange="asortymentUstawFiltr('zrodlo',this.value)">${opcje([["wszystkie","Każde źródło"],["bazowe","Katalog bazowy"],["wlasne","Dodane / importowane"]],filtrZrodlaProduktow)}</select></label>
        <label><span>Kompletność danych</span><select onchange="asortymentUstawFiltr('dane',this.value)">${opcje([["wszystkie","Każdy stan danych"],["gotowe","Kompletne kartoteki"],["braki","Dowolny brak danych"],["ean","Brak EAN"],["zdjecie","Brak zdjęcia"],["opis","Brak opisu krótkiego lub pełnego"],["producent","Brak producenta"],["kategoria","Brak kategorii"],["zrodlo","Brak linku źródłowego"],["koszt","Brak ceny zakupu (admin)"]],filtrDanychProduktow)}</select></label>
        <label><span>Stan magazynowy</span><select onchange="asortymentUstawFiltr('stan',this.value)">${opcje([["wszystkie","Każdy stan"],["dostepne","Powyżej 0 / bez limitu"],["niskie","Niski stan (1–5)"],["brak","Brak lokalnego stanu"]],filtrStanuProduktow)}</select></label>
        <label><span>Status Allegro</span><select onchange="asortymentUstawFiltr('allegro',this.value)">${opcje([["wszystkie","Wszystkie produkty"],["polaczone","Połączone z ofertą"],["aktywne","Aktywne oferty"],["szkice","Szkice / nieaktywne"],["brak","Bez oferty Allegro"],["duplikaty",`Podejrzane duplikaty (${audytAllegro.produkty})`]],filtrAllegroProduktow)}</select></label>
        <label><span>Oferta i promocja</span><select onchange="asortymentUstawFiltr('promocja',this.value)">${opcje([["wszystkie","Wszystkie ceny"],["promocje","Tylko promocje"],["regularne","Bez promocji"],["nowosci","Oznaczone jako nowość"]],filtrPromocjiProduktow)}</select></label>
        <label><span>Link producenta</span><select onchange="asortymentUstawFiltr('link',this.value)">${opcje([["wszystkie","Każde źródło produktu"],["z_linkiem","Ma link producenta"],["bez_linku","Brak linku producenta"]],filtrLinkuProduktow)}</select></label>
        <label><span>Cena sklepu od</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaOdAdminProduktow)}" placeholder="0,00 zł" onchange="asortymentUstawFiltr('cenaOd',this.value)"></label>
        <label><span>Cena sklepu do</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaDoAdminProduktow)}" placeholder="bez limitu" onchange="asortymentUstawFiltr('cenaDo',this.value)"></label>
        <label><span>Cena Allegro od</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaAllegroOdAdminProduktow)}" placeholder="0,00 zł" onchange="asortymentUstawFiltr('cenaAllegroOd',this.value)"></label>
        <label><span>Cena Allegro do</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaAllegroDoAdminProduktow)}" placeholder="bez limitu" onchange="asortymentUstawFiltr('cenaAllegroDo',this.value)"></label>
        <label><span>Sortowanie</span><select onchange="ustawSortowanieAdminProduktow(this.value)">${opcje([["external","EXTERNAL_ID / SKU (domyślnie)"],["id","ID produktu"],["nazwa","Nazwa A–Z"],["producent","Producent A–Z"],["kategoria","Kategoria A–Z"],["cena-rosnaco","Cena rosnąco"],["cena-malejaco","Cena malejąco"],["stan","Najniższy stan"],["braki-danych","Najwięcej braków danych"],["najnowsze","Najnowsze kartoteki"]],sortowanieAdminProduktow)}</select></label>
        <label><span>Na stronie</span><select onchange="ustawProduktyNaStronieAdmin(this.value)">${[25,50,100,200,500,1000].map(n=>`<option value="${n}" ${produktyNaStronieAdmin===n?"selected":""}>${n}</option>`).join("")}</select></label>
        <button class="btn ghost" type="button" onclick="asortymentResetujFiltry()">Wyczyść wszystkie filtry</button>
        <div class="assortment-filter-state admin-search-full" data-assortment-active-filters>${aktywneFiltry.length?`<b>Aktywne filtry:</b>${aktywneFiltry.map(([k,l])=>`<button type="button" onclick="asortymentWyczyscFiltr(${jsArg(k)})">${esc(l)} <span>×</span></button>`).join("")}<button class="clear-all" type="button" onclick="asortymentResetujFiltry()">Wyczyść wszystko</button>`:`<span>Brak dodatkowych filtrów — pokazujesz aktywne kartoteki.</span>`}</div>
        <div class="admin-search-standard-actions" data-assortment-operations>${adminOperacjeWynikowHTML({id:"assortment-products",selected:zaznaczoneProdukty.size,pageCount:fragment.length,resultCount:liczbaWynikow,selectPage:"asortymentZaznaczZakres('strona')",selectAll:"asortymentZaznaczZakres('filtr')",clear:"wyczyscZaznaczenieProduktow()",exportSelected:"asortymentEksportuj('zaznaczone')",exportAll:"asortymentEksportuj('filtr')"})}</div>
      </div></details>
      <div data-assortment-results>
      <div class="assortment-results-toolbar allegro-listing-results-head"><div><b>${liczbaWynikow} produktów</b><span>Pokazano ${zakresOd}–${zakresDo} • strona ${stronaAdminProduktow} z ${liczbaStron}</span></div><span><b data-product-selection-count>${zaznaczoneProdukty.size}</b> zaznaczonych</span><label>Gęstość widoku<select onchange="ustawGestoscAdminProduktow(this.value)"><option value="zwarta" ${gestoscAdminProduktow==="zwarta"?"selected":""}>Zwarta</option><option value="wygodna" ${gestoscAdminProduktow==="wygodna"?"selected":""}>Wygodna</option></select></label></div>
      <div class="assortment-bulk-editor allegro-listing-selection"><div><b>Operacje dla zaznaczonych: <span data-product-selection-count>${zaznaczoneProdukty.size}</span></b><small>Zarządzaj ceną sklepu i Allegro oddzielnie; publikacja nowych ofert pozostaje w sekcji Wystawianie.</small></div><label>Kanał ceny<select id="kanalCenProduktow"><option value="sklep">Tylko sklep</option><option value="allegro">Tylko Allegro</option><option value="oba">Sklep i Allegro</option></select></label><label>Zmiana cen<select id="trybCenProduktow"><option value="percent">O procent (+/−)</option><option value="amount">O kwotę (+/−)</option><option value="fixed">Ustaw cenę</option></select></label><input id="procentCen" placeholder="np. 10 lub -5" inputmode="decimal"><button class="btn" data-product-selection-required onclick="zmienCenyZaznaczonych()" ${zaznaczoneProdukty.size?"":"disabled"}>💰 Zmień ceny</button><button class="btn danger" data-product-selection-required onclick="usunZaznaczoneProd()" ${zaznaczoneProdukty.size?"":"disabled"}>🗑️ Przenieś do kosza</button></div>
      <div data-product-agent-center>${asortymentCentrumDzialanHTML()}</div>
      <div class="allegro-publication-list catalog-product-list density-${gestoscAdminProduktow}">${kartyProduktowHTML}</div>
      <div class="pagination allegro-listing-pagination">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div></div>
      <p class="assortment-sync-note"><b>☁️ Wspólna baza:</b> zmiany kartotek, cen, stanów i dostępności zapisują się centralnie i są widoczne na pozostałych urządzeniach po synchronizacji. Eksport pozostaje kopią roboczą lub narzędziem do operacji hurtowych.</p>
      </section>
    ${!centralData&&liczbaWKoszu ? `
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
    </div>`:""}
    </div>`);
}

/* ═══════════ KATALOG PRODUKTÓW — AGENT I DECYZJE MASOWE ALLEGRO ═══════════ */
let asortymentAgentKolejka={busy:false,operation:"pelna",ids:[],done:0,total:0,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:"",finishedAt:""};
let asortymentAllegroDecyzja={step:"idle",busy:false,operation:"update",ids:[],skipped:0,done:0,total:0,ok:0,failed:0,error:"",results:[]};
let asortymentPelneProduktyCache=new Map();
let asortymentSerwerowaKolejka={batchId:"",checking:false,timer:null,lastCheck:0};
const ASORTYMENT_PELNY_PRODUKT_CACHE_MS=15*60*1000;

function asortymentProduktPoId(rawId){return pobierzProduktAdmin(rawId)||produktyDoAdministracji().find(p=>String(p.id)===String(rawId))||null;}
function asortymentPelnyProduktPoId(rawId){
  const cached=asortymentPelneProduktyCache.get(String(rawId??""));
  return cached?.product||null;
}
async function asortymentPobierzPelnyProdukt(rawId,{force=false}={}){
  const id=String(rawId??"").trim(),cached=asortymentPelneProduktyCache.get(id);
  if(!force&&cached&&Date.now()-cached.at<ASORTYMENT_PELNY_PRODUKT_CACHE_MS)return cached.product;
  const result=await chmura("product-catalog-item",{params:{id},timeout:30000}),product=result?.product;
  if(!product||String(product.id)!==id)throw new Error(`Nie udało się pobrać pełnej kartoteki produktu ${id}.`);
  const fullProduct={...product,_catalog:{...(product._catalog||{}),detailLevel:"full"}};
  asortymentPelneProduktyCache.delete(id);asortymentPelneProduktyCache.set(id,{at:Date.now(),product:fullProduct});
  if(typeof podmienProduktAdminBezRenderu==="function")podmienProduktAdminBezRenderu(id,fullProduct);
  while(asortymentPelneProduktyCache.size>250)asortymentPelneProduktyCache.delete(asortymentPelneProduktyCache.keys().next().value);
  return fullProduct;
}
function asortymentOfertaProduktu(p={}){return allegroOfertaDlaProduktuSklepu(p)||(p.allegroOfferId?allegroOfertaPoId(String(p.allegroOfferId)):null);}
function asortymentProduktyZId(ids=[]){return [...new Set(ids.map(String))].map(asortymentProduktPoId).filter(p=>p&&!czyProduktAdminWKoszu(p));}
function asortymentOdswiezCentrumDzialan(){
  const listing=document.querySelector("[data-allegro-publication-center]");
  if(listing&&typeof allegroPublikacjaCentrumOperacjiHTML==="function")listing.innerHTML=allegroPublikacjaCentrumOperacjiHTML();
  const el=document.querySelector("[data-product-agent-center]");if(el)el.innerHTML=asortymentCentrumDzialanHTML();
}
function asortymentOdswiezStanZaznaczenia(){
  document.querySelectorAll("[data-assortment-product-id]").forEach(input=>{const checked=zaznaczoneProdukty.has(Number(input.dataset.assortmentProductId))||zaznaczoneProdukty.has(input.dataset.assortmentProductId);input.checked=checked;const card=input.closest("[data-assortment-product-card]")||input.closest("tr");card?.classList.toggle("is-selected",checked);card?.classList.toggle("selected",checked);});
  document.querySelectorAll("[data-product-selection-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  document.querySelectorAll("[data-product-selection-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  const operations=document.querySelector('[data-admin-results-operations="assortment-products"]');
  operations?.querySelectorAll("[data-admin-selected-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  operations?.querySelectorAll("[data-admin-selected-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  asortymentOdswiezCentrumDzialan();
}
function asortymentUstawOperacjeAgenta(value){asortymentAgentKolejka.operation=String(value||"pelna");}
function asortymentUstawOperacjeZewnetrzna(value){asortymentAllegroDecyzja.operation=String(value||"update");}

function asortymentZastosujStanKolejkiSerwera(queue={},preferredBatchId=""){
  const batches=Array.isArray(queue.batches)?queue.batches:[],preferred=batches.find(item=>String(item.id)===String(preferredBatchId||asortymentSerwerowaKolejka.batchId)),working=batches.find(item=>Number(item.pending||0)+Number(item.running||0)>0),newest=batches[0]||null;
  const batch=working||(newest&&preferred&&Date.parse(newest.requestedAt||0)>Date.parse(preferred.requestedAt||0)?newest:preferred)||newest||null;
  if(!batch)return false;
  asortymentSerwerowaKolejka.batchId=String(batch.id||"");
  const trackedTaskIds=new Set((Array.isArray(batch.trackedTaskIds)?batch.trackedTaskIds:[]).map(String));
  const recent=(Array.isArray(queue.recent)?queue.recent:[]).filter(item=>trackedTaskIds.size?trackedTaskIds.has(String(item.id)):String(item.batchId)===asortymentSerwerowaKolejka.batchId);
  const results=recent.map(item=>({id:String(item.productId||""),name:item.name||`Produkt ${item.productId}`,ok:item.status!=="failed",ready:item.ready===true,missing:item.missing||[],savedFields:item.savedFields||[],error:item.error||""}));
  const queuedIds=[...(Array.isArray(batch.pendingProductIds)?batch.pendingProductIds:[]),...(batch.activeProductId?[batch.activeProductId]:[])].map(String);
  queuedIds.forEach(id=>podmienProduktAdminBezRenderu(id,{allegroAgentPreparationStatus:"queued",allegroAgentPreparationError:"",allegroAgentPreparationMissing:[]}));
  recent.forEach(item=>podmienProduktAdminBezRenderu(item.productId,{
    allegroAgentPreparationStatus:item.status==="completed"?"ready":item.status==="attention"?"retrying":item.status==="waiting_provider"?"waiting_provider":item.status==="decision_required"?"decision_required":item.status==="failed"?"failed":"queued",
    allegroAgentPreparationError:item.error||"",
    allegroAgentPreparationMissing:item.missing||[],
    allegroAgentPreparedAt:item.completedAt||"",
  }));
  const unresolved=Number(batch.attention||0)+Number(batch.waitingProvider||0)+Number(batch.decisionRequired||0),done=Number(batch.completed||0)+unresolved+Number(batch.failed||0),total=Math.max(Number(batch.total||0),done+Number(batch.pending||0)+Number(batch.running||0)),busy=Number(batch.pending||0)+Number(batch.running||0)>0;
  asortymentAgentKolejka={...asortymentAgentKolejka,busy,operation:batch.operation||"allegro",ids:[],done,total,ok:Number(batch.completed||0),warnings:unresolved,failed:Number(batch.failed||0),current:queue.active&&String(queue.active.batchId)===asortymentSerwerowaKolejka.batchId?`Produkt ${queue.active.productId}`:"",results,startedAt:batch.requestedAt||"",finishedAt:busy?"":queue.updatedAt||new Date().toISOString(),cloudSaved:!busy&&unresolved===0&&Number(batch.failed||0)===0};
  return true;
}
async function asortymentSprawdzKolejkeSerwera({render=true}={}){
  if(asortymentSerwerowaKolejka.checking)return;
  asortymentSerwerowaKolejka.timer=null;
  asortymentSerwerowaKolejka.checking=true;
  try{
    const response=await chmura("allegro-preparation-queue-status",{timeout:30000}),queue=response?.queue||{};
    const found=asortymentZastosujStanKolejkiSerwera(queue);
    if(found&&render)asortymentOdswiezCentrumDzialan();
    if(asortymentAgentKolejka.busy){
      clearTimeout(asortymentSerwerowaKolejka.timer);asortymentSerwerowaKolejka.timer=setTimeout(()=>void asortymentSprawdzKolejkeSerwera(),2500);
    }else if(found){
      asortymentPelneProduktyCache.clear();
      if(typeof asortymentCentralnyWyczyscCache==="function")asortymentCentralnyWyczyscCache();
      await asortymentCentralnyPobierz(true,{render:false}).catch(()=>null);
      if(render&&asortymentCentralnyTrasaAktywna())renderuj();
    }
  }catch(error){if(asortymentAgentKolejka.busy){clearTimeout(asortymentSerwerowaKolejka.timer);asortymentSerwerowaKolejka.timer=setTimeout(()=>void asortymentSprawdzKolejkeSerwera(),5000);}}
  finally{asortymentSerwerowaKolejka.checking=false;asortymentSerwerowaKolejka.lastCheck=Date.now();}
}
function asortymentZapewnijMonitorKolejkiSerwera(){
  if(asortymentSerwerowaKolejka.checking||asortymentSerwerowaKolejka.timer||Date.now()-asortymentSerwerowaKolejka.lastCheck<10000)return;
  setTimeout(()=>void asortymentSprawdzKolejkeSerwera({render:false}),0);
}
async function asortymentUruchomAgentaNaSerwerze(products=[],operation="allegro"){
  if(asortymentAgentKolejka.busy){toast("Agent ma już aktywną kolejkę produktów");return;}
  asortymentAgentKolejka={busy:true,operation,ids:products.map(p=>String(p.id)),done:0,total:products.length,ok:0,warnings:0,failed:0,cancel:false,current:"przekazywanie na serwer",results:[],startedAt:new Date().toISOString(),finishedAt:""};asortymentOdswiezCentrumDzialan();
  try{
    const response=await chmura("allegro-preparation-queue-enqueue",{method:"POST",body:{productIds:products.map(p=>String(p.id)),operation},timeout:30000}),queue=response?.queue||{};
    products.forEach(p=>podmienProduktAdminBezRenderu(p.id,{allegroAgentPreparationStatus:"queued",allegroAgentPreparationError:"",allegroAgentPreparationMissing:[]}));
    asortymentSerwerowaKolejka.batchId=String(queue.batchId||"");asortymentZastosujStanKolejkiSerwera(queue,queue.batchId);
    toast(`🤖 Serwer przejął kolejkę ${products.length} produktów — możesz odświeżyć lub zamknąć kartę`);
    clearTimeout(asortymentSerwerowaKolejka.timer);asortymentSerwerowaKolejka.timer=setTimeout(()=>void asortymentSprawdzKolejkeSerwera(),1000);asortymentOdswiezCentrumDzialan();
  }catch(error){asortymentAgentKolejka={...asortymentAgentKolejka,busy:false,failed:products.length,current:"",finishedAt:new Date().toISOString(),cloudSaved:false,results:products.map(p=>({id:String(p.id),name:p.nazwa||"Produkt",ok:false,error:error.message||String(error)}))};asortymentOdswiezCentrumDzialan();toast(`⛔ Serwer nie przejął kolejki: ${error.message||error}`);}
}

async function asortymentSeoAgenta(p={}){
  if(typeof seoAutomatyzujDaneProduktu!=="function")return false;
  const next=seoAutomatyzujDaneProduktu({...p},"agent-katalogu",{force:false}),patch={};
  for(const key of ["seoTitle","seoDescription","seoKeywords","seoScore","seoReviewedAt","seoSource","seoMode"])if(next[key]!==undefined&&String(next[key])!==String(p[key]??""))patch[key]=next[key];
  return Object.keys(patch).length?zapiszPolaProduktuTrwale(p.id,patch,false,"catalog-agent-seo"):false;
}
const ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO=["nazwa","allegroTitle","opisKrotki","opis","allegroDescription","producent","marka","gtin","ean","kodProducenta","mpn","zdjecie","zdjecia","sourceEvidence","allegroCategoryId","allegroProductId","allegroParameters","allegroDescriptionSections","allegroSafetyInformation","allegroResponsibleProducer","allegroShippingSubsidy"];
const ASORTYMENT_POLA_TRWALEGO_ZAPISU_ALLEGRO=[...ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO,"allegroShortDescription","contentEditorial","sourceMaterial","sourceUrl","producentUrl","externalId","sku","numerReferencyjny","parametryProducenta","parametryZrodla","dostepnoscProducenta","stanProducenta","stanProducentaDokladny","stanProducentaZrodlo","producentStatus","producentSprawdzonoAt","contentEditorialPreparedAt","contentEditorialSource","allegroDescriptionSource","allegroEditorialSyncPending","allegroEditorialSyncRequestedAt","allegroEditorialSyncError","allegroAgentPreparationStatus","allegroAgentPreparationMissing","allegroAgentSavedFields","allegroAgentPreparedAt","allegroAgentPreparationStartedAt","allegroAgentPreparationSource","allegroAgentDraftOperation","allegroAgentCompliancePolicy","allegroAgentComplianceCheckedAt","allegroAgentPreparationError","allegroAgentPreparationCheckedAt","allegroAgentPreparationFingerprint","allegroAgentPreparationVersion","allegroAgentPreparationRunId","allegroAgentPreparationConfirmedAt","allegroAgentPreparationConfirmedRevision","seoTitle","seoDescription","seoKeywords","seoScore","seoReviewedAt","seoSource","seoMode"];
const ASORTYMENT_ETYKIETY_POL_ALLEGRO={nazwa:"nazwa",allegroTitle:"tytuł Allegro",opisKrotki:"opis krótki sklepu",opis:"opis długi sklepu",allegroDescription:"opis Allegro",producent:"producent",marka:"marka",gtin:"GTIN",ean:"EAN",kodProducenta:"kod producenta",mpn:"MPN",zdjecie:"zdjęcie główne ze źródła",zdjecia:"galeria ze źródła",sourceEvidence:"potwierdzenie źródła zdjęć",allegroCategoryId:"kategoria Allegro",allegroProductId:"produkt katalogowy Allegro",allegroParameters:"parametry Allegro",allegroDescriptionSections:"układ opisu Allegro",allegroSafetyInformation:"informacja bezpieczeństwa GPSR",allegroResponsibleProducer:"odpowiedzialny producent GPSR",allegroShippingSubsidy:"dopłata do wysyłki"};
function asortymentMigawkaPrzygotowania(p={}){return Object.fromEntries(ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.map(key=>[key,p[key]]));}
function asortymentPolaZmienione(before={},after={}){return ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.filter(key=>JSON.stringify(before[key]??null)!==JSON.stringify(after[key]??null));}
function asortymentEtykietyPol(keys=[]){return keys.map(key=>ASORTYMENT_ETYKIETY_POL_ALLEGRO[key]||key);}
function asortymentPolaDoTrwalegoZapisu(p={}){
  return Object.fromEntries(ASORTYMENT_POLA_TRWALEGO_ZAPISU_ALLEGRO.filter(key=>p[key]!==undefined).map(key=>[key,p[key]]));
}
function asortymentStabilnyJson(value){
  if(Array.isArray(value))return `[${value.map(asortymentStabilnyJson).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${asortymentStabilnyJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function asortymentSygnaturaPrzygotowania(p={}){
  const raw=asortymentStabilnyJson(ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.map(key=>[key,p[key]??null])),bytes=new TextEncoder().encode(raw);let hash=2166136261;
  for(const byte of bytes){hash^=byte;hash=Math.imul(hash,16777619);}
  return `allegro-preparation-v4-${(hash>>>0).toString(16).padStart(8,"0")}`;
}
async function asortymentZapiszProduktCentralnie(p={},startedAt=""){
  const productId=String(p.id??"").trim(),mutationId=`allegro-preparation:${productId}:${String(startedAt||Date.now()).replace(/[^0-9A-Za-z:._-]/g,"").slice(0,80)}`;
  if(!productId)throw new Error("Brakuje ID produktu — Agent nie może potwierdzić zapisu.");
  const result=await chmura("catalog-product-fields-update",{method:"POST",body:{productId,fields:asortymentPolaDoTrwalegoZapisu(p),mutationId,area:"allegro-preparation"},timeout:60000});
  if(result?.confirmed!==true||String(result.productId)!==productId||result.publication?.published!==true)throw new Error("Serwer nie potwierdził zapisu i publikacji pełnej kartoteki.");
  const confirmed=result.product&&String(result.product.id)===productId?result.product:{...p,...(result.fields||{})};
  asortymentPelneProduktyCache.set(productId,{at:Date.now(),product:confirmed});
  podmienProduktAdminBezRenderu(productId,result.fields||{});
  return {...result,product:confirmed};
}
function asortymentStatusPrzygotowania(p={}){
  const status=String(p.allegroAgentPreparationStatus||"");
  const missing=Array.isArray(p.allegroAgentPreparationMissing)?p.allegroAgentPreparationMissing:[];
  if(status==="queued")return {code:"queued",label:"W kolejce Agenta",note:"oczekuje na przygotowanie i trwały zapis na serwerze"};
  if(status==="ready"||status==="published")return {code:"ready",label:status==="published"?"Oferta zapisana w Allegro":"Gotowy do Allegro",note:(status==="published"?p.allegroAgentPublishedAt:p.allegroAgentPreparedAt)?`zapis ${new Date(status==="published"?p.allegroAgentPublishedAt:p.allegroAgentPreparedAt).toLocaleString("pl-PL")}`:"komplet danych"};
  if(status==="needs_attention"||status==="retrying"){return {code:"attention",label:"Automatyczna korekta",note:`${missing.join(", ")||"sprawdzanie danych"} • następna próba jest częścią tej samej pracy`};}
  if(status==="waiting_provider"){const retry=Date.parse(p.allegroAgentPreparationNextRetryAt||"");return {code:"attention",label:"Oczekuje na dostępność AI",note:`${missing.join(", ")||"redakcja treści"}${Number.isFinite(retry)?` • automatyczne wznowienie ${new Date(retry).toLocaleString("pl-PL")}`:""}`};}
  if(status==="decision_required")return {code:"failed",label:"Wymaga konkretnej decyzji",note:missing.join(", ")||"automatyczne metody zostały wyczerpane"};
  if(status==="failed")return {code:"failed",label:"Błąd przygotowania",note:p.allegroAgentPreparationError||"uruchom ponownie"};
  return {code:"new",label:"Nieprzygotowany",note:"Agent nie zapisał jeszcze kontroli"};
}
function asortymentStatusPrzygotowaniaHTML(p={}){const s=asortymentStatusPrzygotowania(p);return `<span class="product-allegro-preparation ${s.code}"><b>${s.code==="ready"?"✅":s.code==="attention"?"⚠️":s.code==="failed"?"⛔":s.code==="queued"?"⏳":"○"} ${esc(s.label)}</b><small>${esc(s.note)}</small></span>`;}
function asortymentPatchZPrzygotowania(p={},draft={}){
  const auto=draft.autoFilled||{},catalog=draft.catalogMatch?.selected||{},category=draft.categorySuggestion?.selected||{},patch={};
  const assign=(key,value)=>{if(value!==undefined&&value!==null&&value!=="")patch[key]=value;};
  assign("allegroTitle",auto.allegroTitle||p.allegroTitle);
  assign("producent",allegroProducentKanoniczny({...p,producent:auto.producent||p.producent,marka:auto.marka||p.marka})||auto.producent||p.producent||p.marka);
  assign("marka",auto.marka||p.marka||patch.producent);
  assign("gtin",auto.gtin||auto.ean||(catalog.eans||[])[0]||p.gtin||p.ean);
  assign("ean",auto.ean||auto.gtin||(catalog.eans||[])[0]||p.ean||p.gtin);
  assign("kodProducenta",auto.kodProducenta||auto.mpn||p.kodProducenta||p.mpn);
  assign("mpn",auto.mpn||auto.kodProducenta||p.mpn||p.kodProducenta);
  assign("allegroCategoryId",auto.allegroCategoryId||catalog.categoryId||category.id||p.allegroCategoryId);
  assign("allegroProductId",auto.allegroProductId||catalog.id||p.allegroProductId);
  if(auto.sourceEvidence?.imageSourceType==="product_source_page"){
    assign("zdjecie",auto.zdjecie);
    patch.zdjecia=Array.isArray(auto.zdjecia)?auto.zdjecia.slice(0,15):[];
    patch.sourceEvidence=auto.sourceEvidence;
  }
  if(Array.isArray(auto.allegroParameters)&&auto.allegroParameters.length)patch.allegroParameters=auto.allegroParameters;
  if(auto.allegroSafetyInformation?.type)patch.allegroSafetyInformation=auto.allegroSafetyInformation;
  if(auto.allegroResponsibleProducer?.id)patch.allegroResponsibleProducer=auto.allegroResponsibleProducer;
  const improved=draft.improvedDescriptions||{},safeSections=draft.draft?.description?.sections||improved.sections||[];
  if(Array.isArray(safeSections)&&safeSections.length)patch.allegroDescriptionSections=safeSections;
  const full=String(improved.storeFullDescription||improved.fullDescription||p.opis||"").trim(),short=String(improved.storeShortDescription||improved.shortDescription||p.opisKrotki||(full?agentAITnijDoZdania(full,500):"")).trim(),allegroFull=String(improved.allegroDescription||full||allegroTekstZBezpiecznychSekcji(safeSections)||"").trim();
  if(full)patch.opis=full;if(short)patch.opisKrotki=short;if(allegroFull)patch.allegroDescription=allegroFull;
  patch.allegroShippingSubsidy=p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI;
  return patch;
}
async function asortymentPrzygotujProduktDoAllegro(base={},options={}){
  const productId=String(base.id??"").trim();
  if(!productId)throw new Error("Brakuje ID produktu.");
  const enqueue=await chmura("allegro-preparation-queue-enqueue",{method:"POST",body:{
    productIds:[productId],operation:options.includeSeo?"pelna":"allegro"
  },timeout:30000});
  const batchId=String(enqueue?.queue?.batchId||""),started=Date.now();
  if(!batchId)throw new Error("Serwer nie zwrócił numeru kolejki przygotowania.");
  let result=null;
  while(Date.now()-started<5*60*1000){
    const status=await chmura("allegro-preparation-queue-status",{timeout:30000});
    const queue=status?.queue||{},batch=(queue.batches||[]).find(item=>String(item.id)===batchId);
    if(!batch)throw new Error("Serwer nie odnalazł utworzonej partii przygotowania.");
    const taskIds=new Set((batch.trackedTaskIds||[]).map(String));
    result=(queue.recent||[]).find(item=>taskIds.has(String(item.id)))||null;
    const terminal=Number(batch.completed||0)+Number(batch.attention||0)+Number(batch.waitingProvider||0)+Number(batch.decisionRequired||0)+Number(batch.failed||0);
    if(result&&terminal>=Number(batch.total||1)&&!Number(batch.pending||0)&&!Number(batch.running||0))break;
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!result)throw new Error("Przygotowanie nadal pracuje na serwerze — sprawdź monitor kolejki.");
  if(result.status==="failed")throw new Error(result.error||"Serwer nie potwierdził przygotowania produktu.");
  const p=await asortymentPobierzPelnyProdukt(productId,{force:true});
  if(!p)throw new Error("Po przygotowaniu nie udało się odczytać produktu z centralnej kartoteki.");
  const draft=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:90000});
  const missing=[...new Set([...(result.missing||[]),...(draft.missing||[])].map(String).filter(Boolean))];
  const ready=result.ready===true&&missing.length===0&&draft.compliance?.ok!==false;
  return {
    id:productId,name:p.nazwa||"Produkt",product:p,draft,ready,missing,
    savedFields:result.savedFields||[],warnings:result.reused?["wykorzystano aktualne, wcześniej potwierdzone przygotowanie serwerowe"]:[],
    persistence:{confirmed:true,mutationId:result.mutationId||"",publication:{published:true,readbackConfirmed:true}},
  };
}
async function asortymentAgentPrzetworzProdukt(base,operation){
  let p=asortymentProduktPoId(base.id)||base;const warnings=[];let preparation=null;
  if(["pelna","allegro","szkic","dane"].includes(operation)){
    preparation=await asortymentPrzygotujProduktDoAllegro(p,{refreshSource:["pelna","allegro"].includes(operation),includeSeo:operation==="pelna"});p=preparation.product;warnings.push(...preparation.warnings);if(preparation.missing.length)warnings.push(`do uzupełnienia: ${preparation.missing.join(", ")}`);
  }else if(operation==="zrodlo"){
    if(p.sourceUrl||p.producentUrl)p=await automatyczniePobierzDaneZrodlaProduktu(p);else warnings.push("brak linku producenta");
  }
  if(operation==="seo")await asortymentSeoAgenta(p);
  if(["pelna","prowizja"].includes(operation)){
    const price=kwotaNum(p.cenaAllegro||p.cena),feeReady=price>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)));
    if(feeReady){const fee=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});if(!fee)warnings.push("nie pobrano prowizji");}
    else warnings.push("brak danych do wyliczenia prowizji");
  }
  p=asortymentProduktPoId(p.id)||p;
  return {id:String(p.id),name:p.nazwa||"Produkt",warnings,ready:preparation?.ready??null,missing:preparation?.missing||[],savedFields:preparation?.savedFields||[],persistenceConfirmed:preparation?preparation.persistence?.confirmed===true&&preparation.persistence?.publication?.published===true:true};
}
async function asortymentUruchomAgenta(ids,operation){
  if(asortymentAgentKolejka.busy){toast("Agent ma już aktywną kolejkę produktów");return;}
  const products=asortymentProduktyZId(ids).slice(0,250);if(!products.length){toast("Zaznacz co najmniej jeden aktywny produkt");return;}
  if(["pelna","allegro","szkic","dane"].includes(operation))return asortymentUruchomAgentaNaSerwerze(products,operation);
  asortymentAgentKolejka={busy:true,operation,ids:products.map(p=>String(p.id)),done:0,total:products.length,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:new Date().toISOString(),finishedAt:""};asortymentOdswiezCentrumDzialan();
  let cursor=0;const worker=async()=>{while(cursor<products.length&&!asortymentAgentKolejka.cancel){const p=products[cursor++];asortymentAgentKolejka.current=p.nazwa||`Produkt ${p.id}`;asortymentOdswiezCentrumDzialan();try{const result=await asortymentAgentPrzetworzProdukt(p,operation);if(!result.persistenceConfirmed)throw new Error("Brak potwierdzenia trwałego zapisu produktu.");asortymentAgentKolejka.ok++;if(result.warnings.length)asortymentAgentKolejka.warnings++;asortymentAgentKolejka.results.push({...result,ok:true});}catch(error){if(["pelna","allegro","szkic","dane"].includes(operation))podmienProduktAdminBezRenderu(p.id,{allegroAgentPreparationStatus:"failed",allegroAgentPreparationError:error.message||String(error),allegroAgentPreparationCheckedAt:new Date().toISOString()});asortymentAgentKolejka.failed++;asortymentAgentKolejka.results.push({id:String(p.id),name:p.nazwa||"Produkt",ok:false,error:error.message||String(error)});}finally{asortymentAgentKolejka.done++;asortymentOdswiezCentrumDzialan();}}};
  // Jedna kolejka = jeden zapis naraz. Dzięki temu każdy produkt otrzymuje
  // osobne potwierdzenie odczytu z serwera i nie ściga się o rewizję ustawień
  // z drugim produktem z tej samej partii.
  await worker();
  asortymentAgentKolejka={...asortymentAgentKolejka,busy:false,current:"",finishedAt:new Date().toISOString()};
  zapiszHistorieAgenta("katalog-allegro",`Agent zakończył kolejkę katalogu: ${asortymentAgentKolejka.ok} poprawnie, ${asortymentAgentKolejka.failed} błędów`,{operation,products:asortymentAgentKolejka.ids,warningCount:asortymentAgentKolejka.warnings});
  const preparationOperation=["pelna","allegro","szkic","dane"].includes(operation);
  const cloudSaved=preparationOperation?asortymentAgentKolejka.failed===0&&asortymentAgentKolejka.results.every(result=>result.ok&&result.persistenceConfirmed!==false):await chmuraZapiszUstawienia({flush:true}).catch(()=>false);
  asortymentAgentKolejka={...asortymentAgentKolejka,cloudSaved};asortymentOdswiezCentrumDzialan();toast(cloudSaved?`🤖 Kolejka zakończona: serwer potwierdził zapis i publikację ${asortymentAgentKolejka.ok} produktów`:"⚠️ Nie wszystkie produkty uzyskały potwierdzenie zapisu i publikacji — sprawdź raport kolejki");
}
function asortymentUruchomAgentaDlaZaznaczonych(){return asortymentUruchomAgenta([...zaznaczoneProdukty],String(document.querySelector("[data-agent-product-operation]")?.value||asortymentAgentKolejka.operation||"pelna"));}
function asortymentUruchomAgentaDlaProduktu(id,operation="pelna"){return asortymentUruchomAgenta([id],operation);}
function asortymentPrzygotujZaznaczoneDoAllegro(){return asortymentUruchomAgenta([...zaznaczoneProdukty],"allegro");}
function asortymentPrzygotujProduktDoAllegroZMenu(id){return asortymentUruchomAgenta([id],"allegro");}
function asortymentWystawZaznaczoneNaAllegro(){return asortymentPrzygotujOperacjeZewnetrzna("activate");}
function asortymentAnulujAgenta(){if(asortymentAgentKolejka.busy){asortymentAgentKolejka.cancel=true;asortymentOdswiezCentrumDzialan();}}

function asortymentPrzygotujOperacjeZewnetrzna(operation=null,singleId=null,executeNow=false){
  const op=String(operation||document.querySelector("[data-external-product-operation]")?.value||asortymentAllegroDecyzja.operation||"update"),source=singleId===null?[...zaznaczoneProdukty]:[singleId],all=asortymentProduktyZId(source);
  const unresolved=all.filter(p=>["activate","draft"].includes(op)&&String(p.allegroOfferId||p.allegro?.offerId||"").trim()&&!asortymentOfertaProduktu(p));
  const eligibleAll=all.filter(p=>{
    if(op==="update"||op==="withdraw")return !!asortymentOfertaProduktu(p);
    return !unresolved.some(item=>String(item.id)===String(p.id));
  }),eligible=eligibleAll.slice(0,50),remaining=Math.max(0,eligibleAll.length-eligible.length),blocked=Math.max(0,all.length-eligibleAll.length);
  if(!eligible.length){toast(unresolved.length?"Zapisane ID oferty wymaga weryfikacji — tworzenie możliwego duplikatu zostało zablokowane":op==="update"||op==="withdraw"?"Zaznaczone produkty nie mają powiązanych ofert Allegro":"Zaznacz produkty");return;}
  if(unresolved.length)toast(`Pominięto ${unresolved.length} produktów wymagających weryfikacji ID oferty`);
  asortymentAllegroDecyzja={step:"confirm",busy:false,direct:executeNow&&op!=="withdraw",operation:op,operationId:`allegro_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`,ids:eligible.map(p=>String(p.id)),skipped:remaining+blocked,remaining,blocked,done:0,total:eligible.length,ok:0,failed:0,error:"",results:[]};
  if(executeNow&&op!=="withdraw"){void asortymentPotwierdzOperacjeZewnetrzna(true);return;}
  asortymentOdswiezCentrumDzialan();setTimeout(()=>document.querySelector(".product-external-confirm")?.scrollIntoView({behavior:"smooth",block:"center"}),0);
}
function asortymentAnulujOperacjeZewnetrzna(){asortymentAllegroDecyzja={step:"idle",busy:false,operation:"update",ids:[],skipped:0,done:0,total:0,ok:0,failed:0,error:"",results:[]};asortymentOdswiezCentrumDzialan();}
async function asortymentPotwierdzOperacjeZewnetrzna(direct=false){
  const state=asortymentAllegroDecyzja;if(state.busy||state.step!=="confirm")return;
  if(!direct&&!document.querySelector("[data-external-product-confirm]")?.checked){toast("Zaznacz potwierdzenie świadomej operacji przez API Allegro");return;}
  asortymentAllegroDecyzja={...state,busy:true,error:""};asortymentOdswiezCentrumDzialan();
  try{
    const health=await chmura("allegro-connection-check",{timeout:30000});
    allegroStan={...allegroStan,...(health.allegro||{}),sprawdzono:true,error:""};
    if(!health.ready)throw Object.assign(new Error("Połączenie Allegro wymaga ponownej autoryzacji przed wykonaniem zatwierdzonej operacji."),{code:"allegro_reauth_required"});
  }catch(error){
    allegroStan={...allegroStan,connected:false,requiresReauth:true,sprawdzono:true,error:error.message||String(error)};
    asortymentAllegroDecyzja={...state,busy:false,error:`Połączenie Allegro nie jest gotowe: ${error.message||error}`};asortymentOdswiezCentrumDzialan();toast("⚠️ Najpierw napraw połączenie Allegro — żadna oferta nie została zmieniona");return;
  }
  asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:true,error:""};asortymentOdswiezCentrumDzialan();
  try{
    const products=asortymentProduktyZId(state.ids);
    if(state.operation==="withdraw"){
      const offerIds=[...new Set(products.map(p=>String(asortymentOfertaProduktu(p)?.id||p.allegroOfferId||"")).filter(Boolean))];
      const d=await chmura("allegro-withdraw-offers",{method:"POST",body:{offerIds,reason:"admin_decision"},timeout:120000});allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;allegroMapowania=d.mappings||allegroMapowania;
      asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,step:"done",done:offerIds.length,total:offerIds.length,ok:Number(d.ended)||0,failed:Number(d.failed)||0,results:d.results||[]};
    }else{
      for(const sourceProduct of products){
        try{
          const preparation=await asortymentPrzygotujProduktDoAllegro(sourceProduct,{refreshSource:true});
          if(!preparation.ready)throw new Error(`Agent zapisał poprawki, ale produkt nadal wymaga uzupełnienia: ${preparation.missing.join(", ")||"sprawdź kartotekę"}`);
          const p=preparation.product,existing=asortymentOfertaProduktu(p),publicationAction=state.operation==="activate"?"activate":state.operation==="draft"&&!existing?"deactivate":"keep";
          const preparedDraft=preparation.draft?.draft?{...preparation.draft.draft,publication:{...(preparation.draft.draft.publication||{}),status:publicationAction==="activate"?"ACTIVE":"INACTIVE",republish:true}}:null;
          const operationId=`${state.operationId||`allegro_${Date.now().toString(36)}`}:${String(p.id)}`;
          const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,...(preparedDraft?{draft:preparedDraft}:{}),options:{stock:allegroStanOfertyProduktu(p),publicationAction,publishNow:publicationAction==="activate"},approval:{approved:true,operationId,productId:String(p.id),action:state.operation,approvedAt:new Date().toISOString()}},timeout:120000});
          allegroZastosujWynikWystawienia(p,d);allegroZapiszWynikOperacji(p,d);
          const expectedOfferId=String(d.offer?.id||existing?.id||p.allegroOfferId||"").trim();
          const persisted=await asortymentPobierzPelnyProdukt(p.id,{force:true});
          if(!expectedOfferId||String(persisted?.allegroOfferId||"").trim()!==expectedOfferId||String(persisted?.allegroAgentPreparationStatus||"")!=="published"){
            throw Object.assign(new Error("Allegro przyjęło ofertę, ale serwer nie potwierdził jeszcze jej trwałego zapisu w kartotece."),{code:"allegro_publication_readback_mismatch"});
          }
          if(typeof asortymentCentralnyPodmienProdukt==="function")asortymentCentralnyPodmienProdukt(p.id,persisted);
          asortymentAllegroDecyzja.ok++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:true,offerId:expectedOfferId,operationId,savedFields:preparation.savedFields,catalogRecovery:d.catalogRecovery||null,readbackConfirmed:true});
        }catch(error){
          const p=asortymentProduktPoId(sourceProduct.id)||sourceProduct,currentStatus=String(p.allegroAgentPreparationStatus||"");await zapiszPolaProduktuTrwale(p.id,{...(currentStatus==="needs_attention"?{}:{allegroAgentPreparationStatus:"failed",allegroAgentPreparationError:error.message||String(error)}),allegroAgentPublicationError:error.message||String(error),allegroAgentPreparationCheckedAt:new Date().toISOString()},false,"allegro-publication-failure").catch(()=>false);
          asortymentAllegroDecyzja.failed++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:false,operationId:`${state.operationId||"allegro"}:${String(p.id)}`,error:error.message||String(error),code:error.code||""});
        }finally{asortymentAllegroDecyzja.done++;asortymentOdswiezCentrumDzialan();}
      }
      asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,step:"done"};
    }
    asortymentAllegroDecyzja.results.filter(result=>result.ok&&result.id!==undefined).forEach(result=>{const id=String(result.id);zaznaczoneProdukty.delete(id);zaznaczoneProdukty.delete(Number(id));zaznaczoneAllegroProduktyKatalogu?.delete?.(id);});
    const successful=asortymentAllegroDecyzja.results.filter(result=>result.ok),cloudSaved=state.operation==="withdraw"||successful.length===asortymentAllegroDecyzja.ok&&successful.every(result=>result.readbackConfirmed===true);
    asortymentAllegroDecyzja={...asortymentAllegroDecyzja,cloudSaved};await allegroWczytajDane(true).catch(()=>{});allegroZapiszCache();asortymentCentralnyWyczyscCache();asortymentOdswiezCentrumDzialan();toast(cloudSaved?`🟠 Operacja Allegro zakończona i trwale zapisana: ${asortymentAllegroDecyzja.ok} poprawnie${asortymentAllegroDecyzja.failed?` • ${asortymentAllegroDecyzja.failed} błędów`:""}${asortymentAllegroDecyzja.remaining?` • pozostało ${asortymentAllegroDecyzja.remaining}`:""}`:"⚠️ Allegro przyjęło operację, ale serwer nie potwierdził jeszcze całej kolejki kartotek");
  }catch(error){asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,error:error.message||String(error)};asortymentOdswiezCentrumDzialan();toast("⚠️ Operacja Allegro: "+(error.message||error));}
}

function asortymentOperacjaZewnetrznaOpis(op){return ({update:["Aktualizacja istniejących ofert","Agent ponownie przygotuje i zapisze dane, a następnie zmieni istniejące oferty bez tworzenia duplikatów."],draft:["Szkice / oferty nieaktywne","Agent najpierw uzupełni kartoteki. Kompletne brakujące oferty utworzy jako nieaktywne."],activate:["Przygotowanie, publikacja i aktywacja","Agent zapisze poprawione dane każdego produktu. Tylko kompletne pozycje zostaną wystawione lub zaktualizowane i aktywowane."],withdraw:["Zakończenie ofert","Zakończy powiązane oferty i wyłączy ich odnawianie."]})[op]||["Operacja Allegro",""];}
function asortymentDecyzjaZewnetrznaHTML(){
  const s=asortymentAllegroDecyzja;if(s.step==="idle")return "";const [title,description]=asortymentOperacjaZewnetrznaOpis(s.operation),products=asortymentProduktyZId(s.ids);
  if(s.step==="done")return `<section class="product-external-result ${s.failed||s.cloudSaved===false?"partial":"ok"}"><div><b>${s.failed?"⚠️ Operacja zakończona częściowo":s.cloudSaved===false?"⚠️ Allegro zapisane, kartoteki czekają na synchronizację":"✅ Operacja zakończona i zapisana"}</b><small>${esc(title)} • poprawnie ${s.ok} • błędy ${s.failed}${s.remaining?` • kolejna partia ${s.remaining}`:""}${s.blocked?` • wymaga kontroli ${s.blocked}`:""} • serwer ${s.cloudSaved===false?"oczekuje na ponowną próbę":"potwierdził zapis"}</small>${s.results.length?`<details><summary>Raport dla ${s.results.length} produktów</summary>${s.results.map(x=>`<p class="${x.ok?"ok":"error"}"><b>${x.ok?"✅":"⚠️"} ${esc(x.name||x.id)}</b> — ${x.ok?`oferta ${esc(x.offerId||"zapisana")}${x.catalogRecovery?.applied?` • automatycznie poprawiono dane katalogu Allegro`:""}${x.savedFields?.length?` • zapisano: ${esc(asortymentEtykietyPol(x.savedFields).join(", "))}`:""}`:esc(x.error||"błąd")}</p>`).join("")}</details>`:""}</div><div class="product-external-result-actions">${s.remaining?`<button class="btn" onclick="asortymentPrzygotujOperacjeZewnetrzna('${esc(s.operation)}',null,true)">Następna partia (${s.remaining})</button>`:""}<button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()">Zamknij</button></div></section>`;
  if(s.direct)return `<section class="product-external-direct ${s.error?"error":""}" aria-live="polite"><span>${s.error?"⚠️":"🟠"}</span><div><b>${s.error?"Nie rozpoczęto publikacji":esc(title)}</b><small>${s.error?esc(s.error):"Kontrola połączenia, przygotowanie danych i publikacja trwają bez dodatkowego potwierdzenia."}</small>${s.error?`<button class="btn ghost" onclick="${allegroStan.requiresReauth?"allegroPolacz()":"asortymentPotwierdzOperacjeZewnetrzna(true)"}">${allegroStan.requiresReauth?"🔐 Połącz Allegro ponownie":"↻ Ponów operację"}</button>`:`<progress max="${Math.max(1,s.total)}" value="${s.done}"></progress><em>${s.done}/${s.total} • poprawnie ${s.ok} • błędy ${s.failed}</em>`}</div></section>`;
  return `<section class="product-external-confirm"><header><span>⚠️</span><div><small>Świadoma decyzja administratora • API Allegro</small><h3>${esc(title)} — ${products.length} produktów</h3><p>${esc(description)} Ostateczna publikacja nastąpi dopiero po tym potwierdzeniu.</p></div></header><div class="product-external-preview">${products.slice(0,8).map(p=>`<span><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • oferta ${esc(asortymentOfertaProduktu(p)?.id||p.allegroOfferId||"nowa")}</small>${asortymentStatusPrzygotowaniaHTML(p)}</span>`).join("")}${products.length>8?`<em>+ ${products.length-8} kolejnych</em>`:""}</div><label class="product-external-check"><input type="checkbox" data-external-product-confirm> Potwierdzam przygotowanie i wykonanie tej operacji na Allegro${s.skipped?` • pominięto ${s.skipped} niepasujących produktów`:""}</label>${s.busy?`<div class="product-agent-progress"><progress max="${s.total}" value="${s.done}"></progress><span>${s.done}/${s.total} • Agent zapisuje dane przed publikacją</span></div>`:""}${s.error?`<div class="backend-note allegro-mapping-error"><b>${esc(s.error)}</b>${allegroStan.requiresReauth?`<button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button>`:""}</div>`:""}<footer><button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()" ${s.busy?"disabled":""}>Anuluj</button><button class="btn danger" onclick="asortymentPotwierdzOperacjeZewnetrzna()" ${s.busy?"disabled":""}>${s.busy?"⏳ Przygotowuję i wystawiam…":"Potwierdzam przygotowanie i publikację"}</button></footer></section>`;
}
function asortymentCentrumDzialanHTML(){
  asortymentZapewnijMonitorKolejkiSerwera();
  const q=asortymentAgentKolejka,selected=zaznaczoneProdukty.size,dirty=typeof chmuraBrudneKlucze!=="undefined"?chmuraBrudneKlucze.size:0;
  return `<section class="product-action-center"><header><div><span class="order-pro-label">Automatyzacje katalogu i Allegro</span><h3>⚡ Centrum przygotowania i wystawiania</h3><p>Najpierw Agent zapisuje poprawione dane w kartotece. Dopiero osobna, potwierdzona operacja wysyła kompletną ofertę do Allegro.</p></div><span class="product-save-state ${dirty?"pending":"saved"}">${dirty?`☁️ ${dirty} zmian czeka na bezpieczny zapis`:"☁️ Dane zsynchronizowane"}</span></header><div class="product-action-columns"><article class="product-action-primary"><small>KROK 1 • PRZYGOTUJ I ZAPISZ</small><b>${selected} zaznaczonych produktów</b><button class="btn" onclick="asortymentPrzygotujZaznaczoneDoAllegro()" ${!selected||q.busy?"disabled":""}>🤖 Przygotuj i zapisz do Allegro</button><small>Agent odświeży źródło, poprawi oba opisy, dobierze katalog, kategorię, parametry, zdjęcia i zapisze wynik kontroli.</small><details><summary>Inne działania Agenta</summary><div class="product-action-advanced"><select data-agent-product-operation onchange="asortymentUstawOperacjeAgenta(this.value)" ${q.busy?"disabled":""}><option value="pelna" ${q.operation==="pelna"?"selected":""}>Pełna kontrola i uzupełnienie</option><option value="zrodlo" ${q.operation==="zrodlo"?"selected":""}>Odśwież dane producenta</option><option value="dane" ${q.operation==="dane"?"selected":""}>Kompletność i kategoria Allegro</option><option value="szkic" ${q.operation==="szkic"?"selected":""}>Przygotuj / sprawdź szkic</option><option value="prowizja" ${q.operation==="prowizja"?"selected":""}>Pobierz prowizje i opłaty</option><option value="seo" ${q.operation==="seo"?"selected":""}>Popraw SEO produktu</option></select><button class="btn ghost" onclick="asortymentUruchomAgentaDlaZaznaczonych()" ${!selected||q.busy?"disabled":""}>Uruchom wybrane</button></div></details></article><article class="product-action-primary external"><small>KROK 2 • WYSTAW GOTOWE</small><b>Publikacja po kontroli aktualności</b><button class="btn product-allegro-publish" onclick="asortymentWystawZaznaczoneNaAllegro()" ${!selected||q.busy?"disabled":""}>🟠 Wystaw gotowe na Allegro</button><small>Potwierdzone przygotowanie jest używane ponownie. Agent generuje opisy od nowa wyłącznie po zmianie danych produktu.</small><details><summary>Inna operacja Allegro</summary><div class="product-action-advanced"><select data-external-product-operation onchange="asortymentUstawOperacjeZewnetrzna(this.value)" ${q.busy?"disabled":""}><option value="update">Aktualizuj istniejące oferty</option><option value="draft">Utwórz brakujące jako nieaktywne</option><option value="activate">Opublikuj / aktywuj sprzedaż</option><option value="withdraw">Zakończ powiązane oferty</option></select><button class="btn ghost" onclick="asortymentPrzygotujOperacjeZewnetrzna()" ${!selected||q.busy?"disabled":""}>Przygotuj decyzję</button></div></details></article></div>${q.busy||q.finishedAt?`<div class="product-agent-progress" aria-live="polite"><progress max="${q.total||1}" value="${q.done}"></progress><div><b>${q.busy?`Agent zapisuje: ${esc(q.current||"uruchamianie kolejki")}`:q.cloudSaved===false?"Kolejka zakończona — sprawdź błędy zapisu":"Kolejka Agenta zakończona i zapisana"}</b><small>${q.done}/${q.total} • poprawnie ${q.ok} • uwagi ${q.warnings} • błędy ${q.failed}${q.cancel?" • zatrzymywanie":""}</small></div>${q.busy?`<button class="btn ghost" onclick="asortymentAnulujAgenta()">Zatrzymaj po bieżącym</button>`:""}</div>`:""}${q.results.length?`<details class="product-agent-results" ${!q.busy?"open":""}><summary>Konkretny zapis Agenta (${q.results.length})</summary>${q.results.slice(-30).map(x=>`<p class="${x.ok?x.ready===false?"warning":"ok":"error"}"><b>${x.ok?x.ready===false?"⚠️":"✅":"⛔"} ${esc(x.name)}</b>${x.ok?`<span>${x.savedFields?.length?`Zapisano: ${esc(asortymentEtykietyPol(x.savedFields).join(", "))}`:"Dane sprawdzone — bez nowych zmian"}</span>${x.missing?.length?`<small>Do uzupełnienia: ${esc(x.missing.join(", "))}</small>`:`<small>Komplet danych do wystawienia</small>`}`:`<span>${esc(x.error)}</span>`}</p>`).join("")}</details>`:""}${asortymentDecyzjaZewnetrznaHTML()}</section>`;
}
function asortymentMenuDzialanProduktuHTML(p={}){
  const offer=asortymentOfertaProduktu(p);return `<details class="product-row-action-menu"><summary class="btn ghost">⚡ Działania</summary><div>${asortymentStatusPrzygotowaniaHTML(p)}<button class="primary" onclick="asortymentPrzygotujProduktDoAllegroZMenu(${jsArg(p.id)})">🤖 Przygotuj i zapisz do Allegro</button><button class="allegro" onclick="asortymentPrzygotujOperacjeZewnetrzna('${offer?"update":"activate"}',${jsArg(p.id)})">🟠 ${offer?"Zapisz poprawki w ofercie":"Wystaw gotowy produkt"}</button><button onclick="asortymentUruchomAgentaDlaProduktu(${jsArg(p.id)},'prowizja')">📊 Pobierz prowizję</button>${offer?`<a href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener">↗ Otwórz ofertę Allegro</a><button class="danger" onclick="asortymentPrzygotujOperacjeZewnetrzna('withdraw',${jsArg(p.id)})">⏹ Przygotuj zakończenie</button>`:""}</div></details>`;
}

/* ═══════════ ALLEGRO — PROFESJONALNE CENTRUM WYSTAWIANIA ═══════════ */
let allegroWystawianieSort="gotowosc",allegroWystawianieStrona=1;
let allegroWystawianieFiltry={kategoria:"wszystkie",producent:"wszyscy",dane:"wszystkie",sprzedaz:"wszystkie",magazyn:"wszystkie",zrodlo:"wszystkie",cenaOd:"",cenaDo:""};

function allegroPublikacjaWybraneIds(){
  const active=new Set(produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&allegroPublikacjaMetaProduktu(p).selectable).map(p=>String(p.id)));
  return [...zaznaczoneAllegroProduktyKatalogu].map(String).filter(id=>active.has(id));
}
function allegroPublikacjaUstawStrone(value){allegroWystawianieStrona=Math.max(1,Number(value)||1);renderuj();}
function allegroPublikacjaPrzelaczFiltr(value){filtrAllegroWystawiania=String(value||"bez_oferty");allegroWystawianieStrona=1;renderuj();}
function allegroPublikacjaPrzelaczSort(value){allegroWystawianieSort=String(value||"gotowosc");allegroWystawianieStrona=1;renderuj();}
function allegroPublikacjaUstawFiltrZaawansowany(key,value){if(!(key in allegroWystawianieFiltry))return;allegroWystawianieFiltry={...allegroWystawianieFiltry,[key]:String(value??"")};allegroWystawianieStrona=1;renderuj();}
function allegroPublikacjaResetujFiltry(){szukajAllegroWystawiania="";filtrAllegroWystawiania="bez_oferty";allegroWystawianieSort="gotowosc";allegroWystawianieFiltry={kategoria:"wszystkie",producent:"wszyscy",dane:"wszystkie",sprzedaz:"wszystkie",magazyn:"wszystkie",zrodlo:"wszystkie",cenaOd:"",cenaDo:""};allegroWystawianieStrona=1;renderuj();}
function allegroPublikacjaZaznaczIds(ids=[]){
  const safe=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id);return p&&allegroPublikacjaMetaProduktu(p).selectable;});
  allegroZaznaczOfertyProduktow(safe,true);
}
function allegroPublikacjaPrzelaczWybor(id,checked){
  const p=asortymentProduktPoId(id),allowed=p&&allegroPublikacjaMetaProduktu(p).selectable;
  allegroZaznaczOfertyProduktow([id],!!checked&&!!allowed);
}
function allegroPublikacjaPrzeniesWyborDoAgenta(ids=[]){
  zaznaczoneProdukty.clear();
  ids.map(String).forEach(id=>{const p=asortymentProduktPoId(id);if(p)zaznaczoneProdukty.add(String(p.id));});
}
function allegroPublikacjaDostepnoscMeta(p={},offer=null){
  const status=String(offer?.status||offer?.publication?.status||"").toUpperCase();
  const availability=typeof wpisDostepnosciProduktu==="function"?(wpisDostepnosciProduktu(p?.id)||{}):{};
  const decision=String(availability.decision||availability.decyzja||"").trim().toLowerCase();
  const availabilityStatus=String(availability.status||"").trim().toLowerCase();
  const productUnavailable=typeof produktOznaczonyNiedostepny==="function"&&produktOznaczonyNiedostepny(p);
  const saleAvailable=typeof produktDostepnyWSprzedazy==="function"?produktDostepnyWSprzedazy(p):!productUnavailable;
  const withdrawnReason=String(offer?.withdrawnReason||p.allegroOfferWithdrawnReason||"").trim().toLowerCase();
  const unavailableReason=["unavailable","brak_towaru","brak","niedostepny"].includes(withdrawnReason)
    ||["wait_available","hide_manual"].includes(decision)
    ||["niedostepny","ukryty","wstrzymany","brak"].includes(availabilityStatus);
  const linkedToAvailability=offer?.saleAvailabilityBlocked===true||productUnavailable||unavailableReason;
  const linkedOffer=!!offer||!!String(p.allegroOfferId||p.allegro?.offerId||"").trim();
  const withdrawnNoStock=linkedOffer&&linkedToAvailability;
  const pendingWithdrawal=withdrawnNoStock&&["","ACTIVE","UNKNOWN"].includes(status);
  const automatic=availability.automatic===true||availability.source==="producent-agent";
  const reason=String(availability.reason||availability.powod||p.allegroOfferWithdrawnReason||"").trim()
    ||(automatic?"brak dostępności potwierdzony przez kontrolę producenta":"produkt ukryty decyzją dostępności");
  return {availability,decision,saleAvailable,productUnavailable,withdrawnNoStock,pendingWithdrawal,automatic,reason};
}
function allegroPublikacjaMetaProduktu(p={}){
  const offer=typeof asortymentOfertaProduktu==="function"?asortymentOfertaProduktu(p):allegroOfertaDlaProduktuSklepu(p);
  const offerId=String(offer?.id||p.allegroOfferId||p.allegro?.offerId||"").trim();
  const status=String(offer?.status||offer?.publication?.status||(offerId?"UNKNOWN":"")).toUpperCase();
  const missing=allegroBrakiProduktuDoWystawienia(p);
  const unresolved=!!offerId&&!offer;
  const noOffer=!offerId;
  const differences=offer?allegroRozniceOfertyProduktu(p,offer):[];
  const inactive=!!offer&&status!=="ACTIVE";
  const needsUpdate=!!offer&&!!differences.length;
  const availability=allegroPublikacjaDostepnoscMeta(p,offer);
  const draft=inactive&&!availability.withdrawnNoStock&&!["ENDED","ARCHIVED"].includes(status);
  const ended=inactive&&!availability.withdrawnNoStock&&["ENDED","ARCHIVED"].includes(status);
  const selectable=availability.saleAvailable&&!availability.withdrawnNoStock&&!unresolved;
  return {
    offer,offerId,status,missing,differences,
    noOffer,unresolved,
    active:!!offer&&status==="ACTIVE",
    inactive,draft,ended,needsUpdate,selectable,
    saleAvailable:availability.saleAvailable,
    withdrawnNoStock:availability.withdrawnNoStock,
    pendingStockWithdrawal:availability.pendingWithdrawal,
    availabilityReason:availability.reason,
    availabilityAutomatic:availability.automatic,
    actionable:availability.withdrawnNoStock||(availability.saleAvailable&&(noOffer||unresolved||inactive||needsUpdate)),
    ready:!missing.length,
    readyNew:availability.saleAvailable&&noOffer&&!missing.length,
    missingNew:availability.saleAvailable&&noOffer&&!!missing.length,
  };
}
function allegroPublikacjaOtworzDecyzje(singleId=null,operation="activate"){
  const source=singleId===null?allegroPublikacjaWybraneIds():[String(singleId)],blocked=[];
  const ids=source.filter(id=>{const p=asortymentProduktPoId(id);if(!p||!produktDostepnyWSprzedazy(p))return false;const meta=allegroPublikacjaMetaProduktu(p);if(meta.unresolved){blocked.push(p);return false;}return true;});
  if(!ids.length){toast(blocked.length?"Najpierw odśwież i zweryfikuj zapisane powiązanie oferty — publikacja duplikatu została zablokowana":"Zaznacz co najmniej jeden produkt do wystawienia");return;}
  if(blocked.length)toast(`Pominięto ${blocked.length} produktów z niezweryfikowanym ID oferty`);
  allegroPublikacjaPrzeniesWyborDoAgenta(ids);
  asortymentPrzygotujOperacjeZewnetrzna(operation,singleId,true);
}
function allegroPublikacjaPrzygotujWybrane(singleId=null){
  const ids=singleId===null?allegroPublikacjaWybraneIds():[String(singleId)];
  if(!ids.length){toast("Zaznacz produkty, które Agent ma przygotować");return;}
  allegroPublikacjaPrzeniesWyborDoAgenta(ids);
  return asortymentUruchomAgenta(ids,"allegro");
}
function allegroPublikacjaPrzygotujWybranePoId(ids=[]){
  const selected=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id);return p&&produktDostepnyWSprzedazy(p);}).slice(0,250);
  if(!selected.length){toast("W aktywnym filtrze nie ma produktów wymagających przygotowania");return;}
  allegroWyczyscZaznaczenieOfert();allegroPublikacjaZaznaczIds(selected);
  return allegroPublikacjaPrzygotujWybrane();
}
function allegroPublikacjaWystawGotowe(ids=[]){
  const ready=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id),meta=p?allegroPublikacjaMetaProduktu(p):null;return p&&meta?.selectable&&meta.ready&&!meta.active;});
  if(!ready.length){toast("W bieżącym widoku nie ma gotowych produktów możliwych do bezpiecznej publikacji");return;}
  allegroWyczyscZaznaczenieOfert();
  ready.forEach(id=>zaznaczoneAllegroProduktyKatalogu.add(String(id)));
  allegroPublikacjaOtworzDecyzje(null,"activate");renderuj();
}
function allegroPublikacjaZaznaczGotoweNowe(ids=[]){
  const ready=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id);return p&&produktDostepnyWSprzedazy(p)&&allegroPublikacjaMetaProduktu(p).readyNew;});
  allegroWyczyscZaznaczenieOfert();allegroPublikacjaZaznaczIds(ready);renderuj();
  if(!ready.length)toast("W aktywnym filtrze nie ma gotowych nowych ofert");
}
function allegroPublikacjaZaznaczDoAktualizacji(ids=[]){
  const selected=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id);return p&&produktDostepnyWSprzedazy(p)&&allegroPublikacjaMetaProduktu(p).needsUpdate;});
  allegroWyczyscZaznaczenieOfert();allegroPublikacjaZaznaczIds(selected);renderuj();
  if(!selected.length)toast("W aktywnym filtrze nie ma ofert wymagających aktualizacji");
}
function allegroPublikacjaTrybProduktu(p={},offer=null){
  const meta=allegroPublikacjaMetaProduktu(p),status=meta.status;
  if(meta.withdrawnNoStock)return {operation:"",label:meta.pendingStockWithdrawal?"Oczekuje na wycofanie":"Wycofana — brak towaru",note:meta.availabilityReason,icon:"⏸",disabled:true};
  if(!offer)return {operation:"activate",label:"Wystaw na Allegro",note:"nowa aktywna oferta",icon:"🟠"};
  if(meta.ended)return {operation:"activate",label:"Wznów zakończoną ofertę",note:`zakończona oferta ${offer.id}`,icon:"↗"};
  if(status!=="ACTIVE")return {operation:"activate",label:"Aktywuj szkic",note:`szkic oferty ${offer.id}`,icon:"🚀"};
  return {operation:"update",label:"Opublikuj aktualizację",note:`aktywna oferta ${offer.id}`,icon:"↻"};
}
function allegroPublikacjaOcena(p={},offer=null,missing=[]){
  const meta=allegroPublikacjaMetaProduktu(p);
  if(meta.withdrawnNoStock)return {code:"stock-blocked",label:meta.pendingStockWithdrawal?"Oczekuje na wycofanie z Allegro":"Wycofana z powodu braku towaru",detail:`Wspólna decyzja sklep + Allegro • ${meta.availabilityReason}`,score:0};
  if(missing.length)return {code:"missing",label:"Wymaga uzupełnienia",detail:missing.join(", "),score:Math.max(8,Math.round((7-Math.min(7,missing.length))/7*100))};
  if(p.allegroAgentPublicationError)return {code:"verify",label:"Kompletne lokalnie • ponowna kontrola API",detail:"Poprzednią próbę odrzucił katalog Allegro; przy kolejnym wystawieniu system spróbuje bezpiecznej korekty i ponowi operację.",score:90};
  const differences=offer?allegroRozniceOfertyProduktu(p,offer):[];
  if(!offer)return {code:"ready",label:"Gotowy do wystawienia",detail:"komplet danych • brak oferty",score:100};
  if(String(offer.status||"").toUpperCase()!=="ACTIVE")return {code:"draft",label:"Gotowy do aktywacji",detail:`oferta ${offer.id} • ${offer.status||"nieaktywna"}`,score:100};
  if(differences.length)return {code:"update",label:"Aktualizacja gotowa",detail:`zmiany: ${differences.join(", ")}`,score:100};
  return {code:"synced",label:"Oferta aktualna",detail:`oferta ${offer.id} • bez zmian`,score:100};
}
function allegroPublikacjaCentrumOperacjiHTML(){
  const ids=allegroPublikacjaWybraneIds(),products=ids.map(asortymentProduktPoId).filter(Boolean),metas=products.map(allegroPublikacjaMetaProduktu),q=asortymentAgentKolejka,d=asortymentAllegroDecyzja,ready=metas.filter(x=>x.ready&&!x.unresolved).length,missing=metas.filter(x=>!x.ready).length,unresolved=metas.filter(x=>x.unresolved).length;
  return `<section class="allegro-publication-command"><div class="allegro-publication-steps allegro-publication-steps-three"><article class="${ids.length?"active":""}"><span>1</span><div><small>WYBÓR ZAKRESU</small><b>${ids.length} produktów wybranych</b><p>Gotowe ${ready} • z brakami ${missing} • do weryfikacji ${unresolved}.</p></div></article><article class="${q.busy?"active":""}"><span>2</span><div><small>KONTROLA I ZAPIS</small><b>Agent przygotowuje kartoteki</b><p>Tożsamość, opis, zgodność, katalog, parametry, zdjęcia i cena.</p></div><button class="btn ghost" onclick="allegroPublikacjaPrzygotujWybrane()" ${!ids.length||q.busy||d.busy?"disabled":""}>🤖 Przygotuj zaznaczone</button></article><article class="publication ${d.step!=="idle"?"active":""}"><span>3</span><div><small>PUBLIKACJA PRZEZ API</small><b>${ready} gotowych do wysłania</b><p>Ponowna walidacja i blokada duplikatu dla każdej pozycji • bezpieczna partia do 50 produktów.</p></div><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${!ids.length||q.busy||d.busy||unresolved?"disabled":""}>🟠 Wystaw zaznaczone</button></article></div>${q.busy||q.finishedAt?`<div class="product-agent-progress" aria-live="polite"><progress max="${q.total||1}" value="${q.done}"></progress><div><b>${q.busy?`Przygotowuję: ${esc(q.current||"kolejkę produktów")}`:"Przygotowanie zakończone"}</b><small>${q.done}/${q.total} • poprawnie ${q.ok} • uwagi ${q.warnings} • błędy ${q.failed}</small></div>${q.busy?`<button class="btn ghost" onclick="asortymentAnulujAgenta()">Zatrzymaj po bieżącym</button>`:""}</div>`:""}${asortymentDecyzjaZewnetrznaHTML()}</section>`;
}
function allegroPublikacjaKartaHTML(p={}){
  const meta=allegroPublikacjaMetaProduktu(p),offer=meta.offer,missing=meta.missing,assessment=meta.withdrawnNoStock?allegroPublikacjaOcena(p,offer,missing):meta.unresolved?{code:"verify",label:"Zweryfikuj powiązanie",detail:`zapisane ID ${meta.offerId} nie jest jeszcze w rejestrze ofert`,score:35}:allegroPublikacjaOcena(p,offer,missing),action=allegroPublikacjaTrybProduktu(p,offer),selected=zaznaczoneAllegroProduktyKatalogu.has(String(p.id)),image=p.zdjecie||(p.zdjecia||[])[0]||"",status=meta.status;
  const categoryResolution=p.allegroCategoryResolution&&typeof p.allegroCategoryResolution==="object"?p.allegroCategoryResolution:{},categoryLabel=p.allegroCategoryName||categoryResolution.categoryName||p.allegroCategoryId||"do dobrania",categoryProof=categoryResolution.source?`${categoryResolution.source}${categoryResolution.confidence?` • ${Math.round(Number(categoryResolution.confidence))}%`:""}`:(p.allegroCategoryId?"zapisana w kartotece":"Agent dobierze podczas przygotowania");
  const statusLabel=meta.withdrawnNoStock?(meta.pendingStockWithdrawal?"ACTIVE • oczekuje na wycofanie":"WYCOFANA • brak towaru"):meta.unresolved?`weryfikacja • ${meta.offerId}`:offer?`${status||"SZKIC"} • ${offer.id}`:"nowa";
  const primaryAction=action.disabled?`<button class="btn stock-blocked-action" disabled>${action.icon} ${esc(action.label)}</button>${meta.unresolved?`<button class="btn ghost" onclick="allegroWczytajDane(true).then(()=>renderuj())">↻ Zweryfikuj ofertę</button>`:""}`:meta.unresolved?`<button class="btn product-allegro-publish" onclick="allegroWczytajDane(true).then(()=>renderuj())">↻ Zweryfikuj ofertę</button>`:`<button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(${jsArg(p.id)},'${action.operation}')">${action.icon} ${esc(action.label)}</button>`;
  return `<article class="allegro-publication-card ${selected?"selected":""} ${assessment.code}" data-allegro-listing-product="${esc(p.id)}"><label class="allegro-publication-check"><input type="checkbox" ${selected?"checked":""} ${meta.selectable?"":"disabled"} onchange="allegroPublikacjaPrzelaczWybor(${jsArg(p.id)},this.checked)"><span>${meta.selectable?"Zaznacz":"Niedostępny do publikacji"}</span></label><div class="allegro-publication-product">${image?`<img src="${esc(image)}" alt="" loading="lazy">`:`<span class="empty-image">📦</span>`}<div><small>${esc(p.producent||p.marka||"Producent nieuzupełniony")}</small><h3>${esc(p.nazwa||"Produkt bez nazwy")}</h3><p>ID ${esc(p.id)}${p.sku?` • SKU ${esc(p.sku)}`:""}</p><div class="allegro-publication-codes"><code>EAN ${esc(p.gtin||p.ean||"—")}</code><code>MPN ${esc(p.kodProducenta||p.mpn||p.externalId||"—")}</code></div></div></div><div class="allegro-publication-readiness"><div><span class="${assessment.code}">${assessment.code==="missing"||assessment.code==="verify"?"⚠️":assessment.code==="stock-blocked"?"⏸":assessment.code==="synced"?"✓":"●"} ${esc(assessment.label)}</span><b>${assessment.score}%</b></div><progress max="100" value="${assessment.score}"></progress><small>${esc(assessment.detail)}</small></div><div class="allegro-publication-data"><span><small>Cena sklepu</small><b>${zl(p.cena)}</b></span><span><small>Cena Allegro</small><b>${zl(p.cenaAllegro||p.cena)}</b></span><span class="allegro-publication-category-data"><small>Kategoria</small><b>${esc(categoryLabel)}</b><em>${esc(categoryProof)}</em></span><span><small>Oferta</small><b class="${status==="ACTIVE"&&!meta.withdrawnNoStock?"active":meta.withdrawnNoStock?"stock-blocked":""}">${esc(statusLabel)}</b></span></div><div class="allegro-publication-actions">${primaryAction}${meta.withdrawnNoStock?`<a class="btn ghost" href="#/admin/magazyn/dostawcy">Dostępność i decyzja</a>`:`<button class="btn ghost" onclick="allegroPublikacjaPrzygotujWybrane(${jsArg(p.id)})">🤖 Przygotuj dane</button>`}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj</a>${offer?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener">↗ Otwórz</a>`:""}<small>${meta.unresolved?"Najpierw potwierdź zapisane powiązanie; tworzenie duplikatu jest zablokowane":meta.withdrawnNoStock?`Status wynika z tej samej decyzji dostępności, która ukryła produkt w sklepie. ${esc(action.note)}`:`${esc(action.note)} • przed wysłaniem działa ponowna kontrola`}</small></div></article>`;
}

allegroWystawianiePanelHTML=function(){
  const query=String(szukajAllegroWystawiania||"").toLowerCase().trim(),all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&produktDostepnyWSprzedazy(p)),counts={wszystkie:all.length,aktywne:0,szkice:0,brak:0,gotowe:0,braki:0,do_aktualizacji:0};
  all.forEach(p=>{const o=allegroOfertaDlaProduktuSklepu(p),m=allegroBrakiProduktuDoWystawienia(p),status=String(o?.status||"").toUpperCase();if(!o)counts.brak++;else if(status==="ACTIVE")counts.aktywne++;else counts.szkice++;if(m.length)counts.braki++;else counts.gotowe++;if(o&&allegroRozniceOfertyProduktu(p,o).length)counts.do_aktualizacji++;});
  let filtered=all.filter(p=>{const o=allegroOfertaDlaProduktuSklepu(p),m=allegroBrakiProduktuDoWystawienia(p),status=String(o?.status||"").toUpperCase();if(filtrAllegroWystawiania==="aktywne"&&status!=="ACTIVE")return false;if(filtrAllegroWystawiania==="szkice"&&(!o||status==="ACTIVE"))return false;if(filtrAllegroWystawiania==="brak"&&o)return false;if(filtrAllegroWystawiania==="gotowe"&&m.length)return false;if(filtrAllegroWystawiania==="braki"&&!m.length)return false;if(filtrAllegroWystawiania==="do_aktualizacji"&&(!o||!allegroRozniceOfertyProduktu(p,o).length))return false;const text=`${p.id||""} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||p.marka||""} ${o?.id||p.allegroOfferId||""}`.toLowerCase();return !query||text.includes(query);});
  const priority=p=>{const o=allegroOfertaDlaProduktuSklepu(p),m=allegroBrakiProduktuDoWystawienia(p);if(!m.length&&!o)return 0;if(!m.length&&String(o?.status||"").toUpperCase()!=="ACTIVE")return 1;if(o&&allegroRozniceOfertyProduktu(p,o).length)return 2;if(m.length)return 3;return 4;};
  filtered.sort((a,b)=>allegroWystawianieSort==="nazwa"?String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl"):allegroWystawianieSort==="najnowsze"?Number(b.id||0)-Number(a.id||0):allegroWystawianieSort==="cena"?kwotaNum(a.cenaAllegro||a.cena)-kwotaNum(b.cenaAllegro||b.cena):priority(a)-priority(b)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl"));
  const pageSize=Math.max(25,Number(allegroLimitWystawiania)||50),pages=Math.max(1,Math.ceil(filtered.length/pageSize));allegroWystawianieStrona=Math.min(Math.max(1,allegroWystawianieStrona),pages);const start=(allegroWystawianieStrona-1)*pageSize,rows=filtered.slice(start,start+pageSize),readyVisible=rows.filter(p=>!allegroBrakiProduktuDoWystawienia(p).length&&String(allegroOfertaDlaProduktuSklepu(p)?.status||"").toUpperCase()!=="ACTIVE");
  allegroWystawianieWynikiIds=filtered.map(p=>p.id);allegroWystawianieStronaIds=rows.map(p=>p.id);const selected=allegroPublikacjaWybraneIds().length;
  return `<div class="allegro-listing-workspace"><section class="panel allegro-listing-hero"><div><span class="order-pro-label">PUBLIKACJA • API ALLEGRO</span><h2>🟠 Centrum wystawiania ofert</h2><p>Przygotuj dane, sprawdź gotowość i wystaw produkt bez opuszczania tej podstrony. System blokuje duplikaty i nie publikuje pozycji z nierozwiązanymi brakami.</p></div><div class="allegro-listing-hero-actions"><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${selected?"":"disabled"}>🟠 Wystaw zaznaczone (${selected})</button><button class="btn ghost" onclick='allegroPublikacjaWystawGotowe(${JSON.stringify(readyVisible.map(p=>String(p.id)))})' ${readyVisible.length?"":"disabled"}>🚀 Wystaw gotowe z widoku (${readyVisible.length})</button><a class="btn ghost" href="#/admin/produkty/dodaj">＋ Dodaj produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia</a></div></section>${!allegroStan.connected?`<section class="allegro-permission-alert"><div><b>Połączenie Allegro wymaga kontroli</b><p>Przed publikacją system wykona test dostępu. Bez ważnej autoryzacji żadna oferta nie zostanie zmieniona.</p></div><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro</button></section>`:""}<section class="allegro-listing-metrics">${[["wszystkie","▦","Produkty",counts.wszystkie],["brak","＋","Nowe oferty",counts.brak],["gotowe","✓","Kompletne dane",counts.gotowe],["braki","⚠","Do uzupełnienia",counts.braki],["do_aktualizacji","↻","Do aktualizacji",counts.do_aktualizacji],["aktywne","●","Aktywne",counts.aktywne]].map(([id,icon,label,value])=>`<button class="${filtrAllegroWystawiania===id?"active":""}" onclick="allegroPublikacjaPrzelaczFiltr('${id}')"><span>${icon}</span><b>${value}</b><small>${label}</small></button>`).join("")}</section><section data-allegro-publication-center>${allegroPublikacjaCentrumOperacjiHTML()}</section><section class="panel allegro-listing-catalog"><div class="allegro-listing-filter"><div class="allegro-listing-search"><small>WYSZUKIWANIE ZAAWANSOWANE</small><input value="${esc(szukajAllegroWystawiania)}" placeholder="Nazwa, ID, SKU, EXTERNAL_ID, EAN, kod producenta, producent lub ID oferty…" oninput="szukajAllegroWystawiania=this.value.toLowerCase();allegroWystawianieStrona=1;zaplanujRenderPoWpisaniu()"></div><label>Stan publikacji<select onchange="allegroPublikacjaPrzelaczFiltr(this.value)">${[["wszystkie","Wszystkie produkty"],["brak","Brak oferty Allegro"],["szkice","Szkice / nieaktywne"],["aktywne","Aktywne"],["do_aktualizacji","Do aktualizacji"],["gotowe","Kompletne dane"],["braki","Wymaga uzupełnienia"]].map(([id,label])=>`<option value="${id}" ${filtrAllegroWystawiania===id?"selected":""}>${label} (${counts[id]||0})</option>`).join("")}</select></label><label>Sortowanie<select onchange="allegroPublikacjaPrzelaczSort(this.value)"><option value="gotowosc" ${allegroWystawianieSort==="gotowosc"?"selected":""}>Najpierw gotowe do publikacji</option><option value="nazwa" ${allegroWystawianieSort==="nazwa"?"selected":""}>Nazwa A–Z</option><option value="najnowsze" ${allegroWystawianieSort==="najnowsze"?"selected":""}>Najnowsze produkty</option><option value="cena" ${allegroWystawianieSort==="cena"?"selected":""}>Cena rosnąco</option></select></label><label>Na stronie<select onchange="allegroLimitWystawiania=Number(this.value)||50;allegroWystawianieStrona=1;renderuj()">${[25,50,100,250,500,1000].map(n=>`<option value="${n}" ${pageSize===n?"selected":""}>${n}</option>`).join("")}</select></label>${query||filtrAllegroWystawiania!=="wszystkie"?`<button class="btn ghost" onclick="szukajAllegroWystawiania='';filtrAllegroWystawiania='wszystkie';allegroWystawianieStrona=1;renderuj()">Wyczyść filtry</button>`:""}</div><div class="allegro-listing-selection"><div><b>${filtered.length} wyników</b><small>Pokazano ${rows.length} • wybrano ${selected}</small></div><button class="btn ghost" onclick='allegroPublikacjaZaznaczIds(${JSON.stringify(rows.map(p=>String(p.id)))})'>☑ Zaznacz stronę</button><button class="btn ghost" onclick='allegroPublikacjaZaznaczIds(${JSON.stringify(filtered.slice(0,1000).map(p=>String(p.id)))})'>☑ Zaznacz wyniki (${Math.min(1000,filtered.length)})</button><button class="btn ghost" onclick="allegroWyczyscZaznaczenieOfert()" ${selected?"":"disabled"}>Odznacz</button><button class="btn ghost" onclick="allegroEksportujProduktyWystawiania('zaznaczone')" ${selected?"":"disabled"}>⇩ Eksportuj zaznaczone</button><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${selected?"":"disabled"}>🟠 Wystaw (${selected})</button></div><div class="allegro-publication-list">${rows.map(allegroPublikacjaKartaHTML).join("")||`<div class="allegro-listing-empty"><span>⌕</span><b>Brak produktów w tym widoku</b><small>Zmień filtry albo dodaj nowy produkt do katalogu.</small></div>`}</div>${pages>1?`<nav class="allegro-listing-pagination"><button class="btn ghost" onclick="allegroPublikacjaUstawStrone(${allegroWystawianieStrona-1})" ${allegroWystawianieStrona===1?"disabled":""}>← Poprzednia</button><span>Strona <b>${allegroWystawianieStrona}</b> z <b>${pages}</b></span><button class="btn ghost" onclick="allegroPublikacjaUstawStrone(${allegroWystawianieStrona+1})" ${allegroWystawianieStrona===pages?"disabled":""}>Następna →</button></nav>`:""}</section>${allegroOstatniBladWystawienia?`<section class="allegro-permission-alert"><div><b>⚠️ Ostatnia operacja wymaga uwagi</b><p>${esc(allegroOstatniBladWystawienia.message||"Błąd Allegro")}</p></div><button class="btn ghost" onclick="allegroOstatniBladWystawienia=null;renderuj()">Zamknij</button></section>`:""}${allegroWynikOperacjiHTML()}${allegroZadaniaAgentaOfertHTML()}</div>`;
};

/* ═══════════ ALLEGRO — WSPÓLNY PROCES OFERT, POWIĄZAŃ I PUBLIKACJI ═══════════ */
let allegroProgresywneKarty={generation:0,scope:"",items:[],renderer:null,index:0,observer:null};
let allegroCentrumOfertTryb="publikacja";
function allegroProgresywneKartyHTML(items=[],renderer,scope="lista"){
  allegroProgresywneKarty.observer?.disconnect?.();
  const generation=allegroProgresywneKarty.generation+1,batch=4,first=items.slice(0,batch);
  allegroProgresywneKarty={generation,scope,items,renderer,index:first.length,observer:null};
  if(items.length<=first.length)return first.map(renderer).join("");
  setTimeout(()=>allegroUruchomProgresywneKarty(generation),0);
  return `${first.map(renderer).join("")}<div class="allegro-progressive-loader" data-allegro-progressive="${esc(scope)}" data-generation="${generation}"><small>Wyświetlono ${first.length} z ${items.length}. Kolejne pozycje są przygotowywane dopiero przy przewijaniu.</small><button class="btn ghost" type="button" onclick="allegroDoloadujProgresywneKarty(${generation})">Pokaż kolejne</button></div>`;
}
function allegroUruchomProgresywneKarty(generation){
  const state=allegroProgresywneKarty;if(state.generation!==generation)return;
  const loader=document.querySelector(`[data-allegro-progressive][data-generation="${generation}"]`);if(!loader)return;
  if(typeof IntersectionObserver!=="function")return;
  state.observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))allegroDoloadujProgresywneKarty(generation);},{rootMargin:"500px 0px"});state.observer.observe(loader);
}
function allegroDoloadujProgresywneKarty(generation){
  const state=allegroProgresywneKarty;if(state.generation!==generation)return;
  const loader=document.querySelector(`[data-allegro-progressive][data-generation="${generation}"]`);if(!loader)return;
  const next=state.items.slice(state.index,state.index+12);if(!next.length){state.observer?.disconnect?.();loader.remove();return;}
  loader.insertAdjacentHTML("beforebegin",next.map(state.renderer).join(""));state.index+=next.length;
  const info=loader.querySelector("small");if(info)info.textContent=`Wyświetlono ${state.index} z ${state.items.length}.`;
  if(state.index>=state.items.length){state.observer?.disconnect?.();loader.remove();}
}
function allegroPublikacjaFiltryAktywne(){
  const f=allegroWystawianieFiltry||{};return [filtrAllegroWystawiania!=="bez_oferty",String(szukajAllegroWystawiania||"").trim(),f.kategoria!=="wszystkie",f.producent!=="wszyscy",f.dane!=="wszystkie",f.sprzedaz!=="wszystkie",f.magazyn!=="wszystkie",f.zrodlo!=="wszystkie",f.cenaOd,f.cenaDo].filter(Boolean).length;
}
function allegroPublikacjaPasujeDoFiltrowZaawansowanych(p={},meta=allegroPublikacjaMetaProduktu(p)){
  const f=allegroWystawianieFiltry||{},missing=meta.missing,source=String(p.sourceUrl||p.producentUrl||p.urlProducenta||"").trim(),stock=stanyProduktow[p.id],price=kwotaNum(p.cenaAllegro||p.cena),from=Number(String(f.cenaOd||"").replace(",",".")),to=Number(String(f.cenaDo||"").replace(",","."));
  if(f.kategoria!=="wszystkie"&&String(p.kategoria||p.kategoriaGlowna||"")!==f.kategoria)return false;
  if(f.producent!=="wszyscy"&&String(p.producent||p.marka||"")!==f.producent)return false;
  if(f.sprzedaz==="aktywna"&&!meta.saleAvailable)return false;
  if(f.sprzedaz==="wycofana_brak_towaru"&&!meta.withdrawnNoStock)return false;
  if(f.magazyn==="dostepne"&&!(Number(stock)>5))return false;
  if(f.magazyn==="niskie"&&!(Number(stock)>0&&Number(stock)<=5))return false;
  if(f.magazyn==="brak"&&Number(stock)!==0)return false;
  if(f.magazyn==="bez_limitu"&&!(stock===undefined||stock===null||stock===""))return false;
  if(f.zrodlo==="z_linkiem"&&!source)return false;
  if(f.zrodlo==="bez_linku"&&source)return false;
  if(f.dane==="kompletne"&&missing.length)return false;
  if(f.dane==="braki"&&!missing.length)return false;
  if(f.dane==="ean"&&(p.gtin||p.ean))return false;
  if(f.dane==="zdjecie"&&(p.zdjecie||(p.zdjecia||[])[0]))return false;
  if(f.dane==="opis"&&String(p.opisKrotki||"").trim()&&String(p.opis||p.allegroDescription||"").trim())return false;
  if(f.dane==="producent"&&String(p.producent||p.marka||"").trim())return false;
  if(f.dane==="kategoria"&&String(p.allegroCategoryId||"").trim())return false;
  if(f.dane==="cena"&&price>0)return false;
  if(String(f.cenaOd||"").trim()&&Number.isFinite(from)&&price<from)return false;
  if(String(f.cenaDo||"").trim()&&Number.isFinite(to)&&price>to)return false;
  return true;
}
function allegroPublikacjaPasujeDoStanu(p={},meta=allegroPublikacjaMetaProduktu(p)){
  const filter=filtrAllegroWystawiania;
  if(["do_dzialania","wszystkie"].includes(filter)&&!meta.actionable)return false;
  if(["bez_oferty","brak"].includes(filter)&&!meta.noOffer)return false;
  if(["gotowe_nowe","gotowe"].includes(filter)&&!meta.readyNew)return false;
  if(["braki_nowe","braki"].includes(filter)&&!meta.missingNew)return false;
  if(filter==="szkice_do_aktywacji"&&!meta.draft)return false;
  if(filter==="zakonczone"&&!meta.ended)return false;
  if(filter==="wycofane_brak_towaru"&&!meta.withdrawnNoStock)return false;
  if(filter==="do_weryfikacji"&&!meta.unresolved)return false;
  if(filter==="do_aktualizacji"&&!(meta.needsUpdate&&meta.saleAvailable&&!meta.withdrawnNoStock))return false;
  return true;
}
function allegroPublikacjaNazwaFiltra(value){
  return ({bez_oferty:"Bez oferty Allegro",gotowe_nowe:"Gotowe nowe oferty",braki_nowe:"Nowe oferty z brakami",do_aktualizacji:"Oferty do aktualizacji",szkice_do_aktywacji:"Szkice do aktywacji",zakonczone:"Zakończone z innego powodu",wycofane_brak_towaru:"Wycofane z powodu braku towaru",do_weryfikacji:"Powiązania do weryfikacji",do_dzialania:"Cała kolejka działań"})[value]||"Kolejka działań";
}
function allegroPublikacjaOpcjeHTML(values,current){return values.map(([value,label])=>`<option value="${esc(value)}" ${String(current)===String(value)?"selected":""}>${esc(label)}</option>`).join("");}

allegroWystawianiePanelHTML=function(){
  const allowedFilters=["bez_oferty","gotowe_nowe","braki_nowe","do_aktualizacji","szkice_do_aktywacji","zakonczone","wycofane_brak_towaru","do_weryfikacji","do_dzialania"];
  if(!allowedFilters.includes(filtrAllegroWystawiania))filtrAllegroWystawiania="bez_oferty";
  const metaCache=new Map(),metaFor=p=>{if(!metaCache.has(p))metaCache.set(p,allegroPublikacjaMetaProduktu(p));return metaCache.get(p);};
  const query=String(szukajAllegroWystawiania||"").toLowerCase().trim(),catalogProducts=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),all=catalogProducts.filter(p=>metaFor(p).actionable),counts={wszystkie:all.length,bez_oferty:0,gotowe_nowe:0,braki_nowe:0,szkice_do_aktywacji:0,zakonczone:0,wycofane_brak_towaru:0,oczekuje_na_wycofanie:0,do_weryfikacji:0,do_aktualizacji:0};
  all.forEach(p=>{const meta=metaFor(p);if(meta.noOffer&&meta.saleAvailable)counts.bez_oferty++;if(meta.readyNew)counts.gotowe_nowe++;if(meta.missingNew)counts.braki_nowe++;if(meta.draft)counts.szkice_do_aktywacji++;if(meta.ended)counts.zakonczone++;if(meta.withdrawnNoStock)counts.wycofane_brak_towaru++;if(meta.pendingStockWithdrawal)counts.oczekuje_na_wycofanie++;if(meta.unresolved)counts.do_weryfikacji++;if(meta.needsUpdate&&meta.saleAvailable&&!meta.withdrawnNoStock)counts.do_aktualizacji++;});
  counts.brak=counts.bez_oferty;counts.gotowe=counts.gotowe_nowe;counts.braki=counts.braki_nowe;
  const categories=[...new Set(all.map(p=>String(p.kategoria||p.kategoriaGlowna||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl")),producers=[...new Set(all.map(p=>String(p.producent||p.marka||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
  let filtered=all.filter(p=>{const meta=metaFor(p);if(!allegroPublikacjaPasujeDoStanu(p,meta)||!allegroPublikacjaPasujeDoFiltrowZaawansowanych(p,meta))return false;const offer=meta.offer||allegroOfertaDlaProduktuSklepu(p),text=`${p.id||""} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||p.marka||""} ${p.kategoria||""} ${offer?.id||p.allegroOfferId||""}`.toLowerCase();return !query||text.includes(query);});
  const priority=p=>{const meta=metaFor(p);if(meta.pendingStockWithdrawal)return 0;if(meta.readyNew)return 1;if(meta.missingNew)return 2;if(meta.needsUpdate&&meta.saleAvailable)return 3;if(meta.draft&&meta.ready)return 4;if(meta.ended)return 5;if(meta.withdrawnNoStock)return 6;if(meta.unresolved)return 7;return 8;};
  filtered.sort((a,b)=>allegroWystawianieSort==="nazwa"?String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl"):allegroWystawianieSort==="producent"?String(a.producent||a.marka||"").localeCompare(String(b.producent||b.marka||""),"pl"):allegroWystawianieSort==="external"?String(a.externalId||a.sku||a.id||"").localeCompare(String(b.externalId||b.sku||b.id||""),"pl",{numeric:true}):allegroWystawianieSort==="status"?priority(a)-priority(b):allegroWystawianieSort==="najnowsze"?Number(b.id||0)-Number(a.id||0):allegroWystawianieSort==="cena"?kwotaNum(a.cenaAllegro||a.cena)-kwotaNum(b.cenaAllegro||b.cena):allegroWystawianieSort==="cena_desc"?kwotaNum(b.cenaAllegro||b.cena)-kwotaNum(a.cenaAllegro||a.cena):priority(a)-priority(b)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl"));
  const pageSize=Math.max(25,Number(allegroLimitWystawiania)||50),pages=Math.max(1,Math.ceil(filtered.length/pageSize));allegroWystawianieStrona=Math.min(Math.max(1,allegroWystawianieStrona),pages);const start=(allegroWystawianieStrona-1)*pageSize,rows=filtered.slice(start,start+pageSize),readyVisible=rows.filter(p=>{const meta=metaFor(p);return meta.selectable&&meta.ready&&!meta.active;}),readyNewFiltered=filtered.filter(p=>metaFor(p).readyNew),missingFiltered=filtered.filter(p=>{const meta=metaFor(p);return meta.selectable&&!meta.ready;}),updateFiltered=filtered.filter(p=>{const meta=metaFor(p);return meta.selectable&&meta.needsUpdate;}),selected=allegroPublikacjaWybraneIds().length,activeFilters=allegroPublikacjaFiltryAktywne(),f=allegroWystawianieFiltry;
  allegroWystawianieWynikiIds=filtered.map(p=>p.id);allegroWystawianieStronaIds=rows.map(p=>p.id);
  const fields=`<div class="allegro-listing-advanced-grid admin-search-full">
    <label class="allegro-listing-search-wide"><span>Produkt lub identyfikator</span><input value="${esc(szukajAllegroWystawiania)}" placeholder="Nazwa, EXTERNAL_ID, SKU, EAN, kod producenta lub ID oferty…" oninput="szukajAllegroWystawiania=this.value.toLowerCase();allegroWystawianieStrona=1;zaplanujRenderPoWpisaniu()"></label>
    <label><span>Dokładny stan kolejki</span><select onchange="allegroPublikacjaPrzelaczFiltr(this.value)">${allegroPublikacjaOpcjeHTML([
      ["bez_oferty",`Bez oferty Allegro (${counts.bez_oferty})`],
      ["gotowe_nowe",`Gotowe do pierwszego wystawienia (${counts.gotowe_nowe})`],
      ["braki_nowe",`Nowe wymagające uzupełnienia (${counts.braki_nowe})`],
      ["do_aktualizacji",`Aktywne wymagające aktualizacji (${counts.do_aktualizacji})`],
      ["szkice_do_aktywacji",`Szkice do aktywacji (${counts.szkice_do_aktywacji})`],
      ["zakonczone",`Zakończone z innego powodu (${counts.zakonczone})`],
      ["wycofane_brak_towaru",`Wycofane — brak towaru (${counts.wycofane_brak_towaru})`],
      ["do_weryfikacji",`Powiązania do weryfikacji (${counts.do_weryfikacji})`],
      ["do_dzialania",`Cała kolejka działań (${counts.wszystkie})`]
    ],filtrAllegroWystawiania)}</select></label>
    <label><span>Dostępność w sprzedaży</span><select onchange="allegroPublikacjaUstawFiltrZaawansowany('sprzedaz',this.value)">${allegroPublikacjaOpcjeHTML([["wszystkie","Każdy stan sprzedaży"],["aktywna","Dostępne w sklepie"],["wycofana_brak_towaru","Ukryte i wycofane — brak towaru"]],f.sprzedaz)}</select></label>
    <label><span>Kategoria sklepu</span><select onchange="allegroPublikacjaUstawFiltrZaawansowany('kategoria',this.value)"><option value="wszystkie">Wszystkie kategorie</option>${categories.map(value=>`<option value="${esc(value)}" ${f.kategoria===value?"selected":""}>${esc(value)}</option>`).join("")}</select></label>
    <label><span>Producent</span><select onchange="allegroPublikacjaUstawFiltrZaawansowany('producent',this.value)"><option value="wszyscy">Wszyscy producenci</option>${producers.map(value=>`<option value="${esc(value)}" ${f.producent===value?"selected":""}>${esc(value)}</option>`).join("")}</select></label>
    <label><span>Gotowość danych</span><select onchange="allegroPublikacjaUstawFiltrZaawansowany('dane',this.value)">${allegroPublikacjaOpcjeHTML([["wszystkie","Każdy stan danych"],["kompletne","Kompletne do publikacji"],["braki","Dowolny brak"],["ean","Brak EAN / GTIN"],["zdjecie","Brak zdjęcia"],["opis","Brak opisu"],["producent","Brak producenta"],["kategoria","Brak kategorii Allegro"],["cena","Brak prawidłowej ceny"]],f.dane)}</select></label>
    <label><span>Stan magazynowy</span><select onchange="allegroPublikacjaUstawFiltrZaawansowany('magazyn',this.value)">${allegroPublikacjaOpcjeHTML([["wszystkie","Każdy stan magazynowy"],["dostepne","Dostępne — powyżej 5 szt."],["niskie","Niski stan — 1–5 szt."],["brak","Brak fizyczny — 0 szt."],["bez_limitu","Stan bez limitu"]],f.magazyn)}</select></label>
    <label><span>Źródło produktu</span><select onchange="allegroPublikacjaUstawFiltrZaawansowany('zrodlo',this.value)">${allegroPublikacjaOpcjeHTML([["wszystkie","Każde źródło"],["z_linkiem","Ma link producenta"],["bez_linku","Brak linku producenta"]],f.zrodlo)}</select></label>
    <label><span>Cena Allegro od</span><input type="number" min="0" step="0.01" value="${esc(f.cenaOd)}" placeholder="0,00 zł" onchange="allegroPublikacjaUstawFiltrZaawansowany('cenaOd',this.value)"></label>
    <label><span>Cena Allegro do</span><input type="number" min="0" step="0.01" value="${esc(f.cenaDo)}" placeholder="bez limitu" onchange="allegroPublikacjaUstawFiltrZaawansowany('cenaDo',this.value)"></label>
    <label><span>Sortowanie</span><select onchange="allegroPublikacjaPrzelaczSort(this.value)">${allegroPublikacjaOpcjeHTML([["gotowosc","Najpierw pilne i gotowe"],["status","Według stanu kolejki"],["external","EXTERNAL_ID / SKU"],["nazwa","Nazwa A–Z"],["producent","Producent A–Z"],["najnowsze","Najnowsze produkty"],["cena","Cena rosnąco"],["cena_desc","Cena malejąco"]],allegroWystawianieSort)}</select></label>
    <label><span>Na stronie</span><select onchange="allegroLimitWystawiania=Number(this.value)||50;allegroWystawianieStrona=1;renderuj()">${[25,50,100,250,500,1000].map(n=>`<option value="${n}" ${pageSize===n?"selected":""}>${n}</option>`).join("")}</select></label>
    <button class="btn ghost allegro-listing-reset" type="button" onclick="allegroPublikacjaResetujFiltry()" ${activeFilters?"":"disabled"}>Wyczyść i pokaż bez oferty</button>
  </div>`;
  const operations=adminOperacjeWynikowHTML({id:"allegro-listing-products",selected,pageCount:rows.length,resultCount:filtered.length,selectPage:"allegroZaznaczZakresWystawiania('strona')",selectAll:"allegroZaznaczZakresWystawiania('filtr')",clear:"allegroWyczyscZaznaczenieOfert()",exportSelected:"allegroEksportujProduktyWystawiania('zaznaczone')",exportAll:"allegroEksportujProduktyWystawiania('filtr')",extra:`<button class="btn ghost" onclick='allegroPublikacjaZaznaczGotoweNowe(${JSON.stringify(readyNewFiltered.map(p=>String(p.id)))})' ${readyNewFiltered.length?"":"disabled"}>☑ Gotowe nowe (${readyNewFiltered.length})</button><button class="btn ghost" onclick='allegroPublikacjaZaznaczDoAktualizacji(${JSON.stringify(updateFiltered.map(p=>String(p.id)))})' ${updateFiltered.length?"":"disabled"}>↻ Do aktualizacji (${updateFiltered.length})</button><button class="btn ghost" onclick='allegroPublikacjaPrzygotujWybranePoId(${JSON.stringify(missingFiltered.slice(0,250).map(p=>String(p.id)))})' ${missingFiltered.length?"":"disabled"}>🤖 Uzupełnij braki (${Math.min(250,missingFiltered.length)})</button><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${selected?"":"disabled"}>🟠 Wystaw lub aktualizuj (${selected})</button>`});
  const cards=rows.length?allegroProgresywneKartyHTML(rows,allegroPublikacjaKartaHTML,"wystawianie"):`<div class="allegro-listing-empty"><span>⌕</span><b>Brak produktów: ${esc(allegroPublikacjaNazwaFiltra(filtrAllegroWystawiania))}</b><small>Zmień albo wyczyść aktywne filtry.</small></div>`;
  const withdrawalInfo=counts.wycofane_brak_towaru?` • ${counts.wycofane_brak_towaru} wycofanych z braku towaru${counts.oczekuje_na_wycofanie?` (${counts.oczekuje_na_wycofanie} oczekuje na potwierdzenie Allegro)`:""}`:"";
  const publicationCenter=allegroPublikacjaCentrumOperacjiHTML();
  const operationResult=allegroWynikOperacjiHTML();
  const agentTasks=allegroZadaniaAgentaOfertHTML();
  const html=`<div class="allegro-listing-workspace"><section class="panel allegro-listing-hero"><div><span class="order-pro-label">KOLEJKA PUBLIKACJI • API ALLEGRO</span><h2>🟠 Wystawianie i aktualizacje</h2><p>Widzisz wyłącznie produkty wymagające działania oraz oferty wycofane wspólną decyzją dostępności sklep + Allegro. Aktualne, poprawne oferty są automatycznie pomijane.</p></div><div class="allegro-listing-hero-actions"><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${selected?"":"disabled"}>🟠 Wystaw lub aktualizuj (${selected})</button><button class="btn ghost" onclick='allegroPublikacjaWystawGotowe(${JSON.stringify(readyVisible.map(p=>String(p.id)))})' ${readyVisible.length?"":"disabled"}>🚀 Publikuj gotowe z widoku (${readyVisible.length})</button><a class="btn ghost" href="#/admin/produkty/dodaj">＋ Dodaj produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia</a></div></section>${!allegroStan.connected?`<section class="allegro-permission-alert"><div><b>Połączenie Allegro wymaga kontroli</b><p>System sprawdzi dostęp przed operacją. Bez ważnej autoryzacji żadna oferta nie zostanie utworzona.</p></div><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro</button></section>`:""}<section class="allegro-listing-metrics">${[["bez_oferty","＋","Bez oferty",counts.bez_oferty],["gotowe_nowe","✓","Gotowe nowe",counts.gotowe_nowe],["braki_nowe","⚠","Nowe z brakami",counts.braki_nowe],["do_aktualizacji","↻","Do aktualizacji",counts.do_aktualizacji],["wycofane_brak_towaru","⏸","Wycofane — brak towaru",counts.wycofane_brak_towaru],["do_weryfikacji","⌕","Zweryfikuj ID",counts.do_weryfikacji]].map(([id,icon,label,value])=>`<button class="${filtrAllegroWystawiania===id?"active":""}" onclick="allegroPublikacjaPrzelaczFiltr('${id}')"><span>${icon}</span><b>${value}</b><small>${label}</small></button>`).join("")}</section>${adminWyszukiwaniePanelHTML({id:"allegro-listing",description:`Kolejka rozdziela nowe oferty, aktualizacje, szkice, zakończone oraz wycofane z powodu braku towaru${withdrawalInfo}.`,results:filtered.length,active:activeFilters>0,open:true,fields,actions:operations})}<section data-allegro-publication-center>${publicationCenter}</section><section class="panel allegro-listing-catalog"><div class="allegro-listing-results-head"><div><b>${filtered.length} produktów do działania</b><small>Pokazano ${rows.length} • strona ${allegroWystawianieStrona} z ${pages} • ${esc(allegroPublikacjaNazwaFiltra(filtrAllegroWystawiania))}</small></div><span>${selected} zaznaczonych</span></div><div class="allegro-publication-list">${cards}</div>${pages>1?`<nav class="allegro-listing-pagination"><button class="btn ghost" onclick="allegroPublikacjaUstawStrone(${allegroWystawianieStrona-1})" ${allegroWystawianieStrona===1?"disabled":""}>← Poprzednia</button><span>Strona <b>${allegroWystawianieStrona}</b> z <b>${pages}</b></span><button class="btn ghost" onclick="allegroPublikacjaUstawStrone(${allegroWystawianieStrona+1})" ${allegroWystawianieStrona===pages?"disabled":""}>Następna →</button></nav>`:""}</section>${allegroOstatniBladWystawienia?`<section class="allegro-permission-alert"><div><b>⚠️ Ostatnia operacja wymaga uwagi</b><p>${esc(allegroOstatniBladWystawienia.message||"Błąd Allegro")}</p></div><button class="btn ghost" onclick="allegroOstatniBladWystawienia=null;renderuj()">Zamknij</button></section>`:""}${operationResult}${agentTasks}</div>`;
  return html;
};

let allegroOfertyStrona=1,allegroOfertyWynikiIds=[],allegroOfertyStronaIds=[];
function allegroOfertyUstawStrone(value){allegroOfertyStrona=Math.max(1,Number(value)||1);renderuj();}
function allegroOfertyUstawFiltr(key,value){
  if(key==="publikacja")filtrStatusuAllegroOfert=String(value||"aktywne");
  else if(key==="powiazanie")filtrAllegroOfert=String(value||"problemy");
  else if(key==="sort")sortAllegroOfert=String(value||"priorytet");
  allegroOfertyStrona=1;renderuj();
}
function allegroOfertyResetujFiltry(){szukajAllegroOfert="";filtrStatusuAllegroOfert="aktywne";filtrAllegroOfert="problemy";sortAllegroOfert="priorytet";allegroOfertyStrona=1;renderuj();}
function allegroOfertyZaznaczZakres(scope="strona"){allegroZaznaczOfertyMapowania(scope==="filtr"?allegroOfertyWynikiIds:allegroOfertyStronaIds,true);}
function allegroOfertyEksportujZakres(scope="filtr"){
  const ids=scope==="zaznaczone"?[...zaznaczoneMapowaniaAllegro]:allegroOfertyWynikiIds,rows=ids.map(id=>{const o=allegroOfertaPoId(id),productId=allegroProduktIdDlaOferty(id),p=productId?pobierzProduktAdmin(productId):null;if(!o)return null;return [o.id,o.name||"",o.status||o.publication?.status||"",o.externalId||"",o.ean||o.gtin||"",o.manufacturerCode||o.producerCode||"",productId||"",p?.nazwa||""];}).filter(Boolean);
  adminEksportujCSV(`oferty-allegro-${new Date().toISOString().slice(0,10)}.csv`,["ID oferty","Nazwa Allegro","Status","EXTERNAL_ID","EAN","Kod producenta","ID produktu sklepu","Produkt sklepu"],rows);
}

allegroOfertyTabelaHTML=function(){
  const q=String(szukajAllegroOfert||"").toLowerCase().trim(),audyt=allegroAudytDuplikatow(),all=(Array.isArray(allegroOferty)?allegroOferty:[]).map(allegroAnalizaMapowaniaOferty),operational=all.filter(a=>allegroOferteMoznaWycofac(a.oferta));
  const counts={wszystkie:all.length,aktywne:operational.length,sprzedaz:0,szkice:0,zakonczone:0,poprawne:0,kanoniczne:0,duplikat:0,synchronizacja:0,konflikt:0,sugestia:0,niepodpiete:0,sprawdz:0,problemy:0,duplikaty:audyt.oferty};
  all.forEach(a=>{const pub=allegroStatusOfertyMeta(a.oferta);counts[pub.group]=(counts[pub.group]||0)+1;if(pub.withdrawable){counts[a.status]=(counts[a.status]||0)+1;if(!["poprawne","kanoniczne","synchronizacja"].includes(a.status))counts.problemy++;}});
  let filtered=all.filter(a=>{const pub=allegroStatusOfertyMeta(a.oferta);if(filtrStatusuAllegroOfert==="aktywne"&&!pub.withdrawable)return false;if(!["wszystkie","aktywne"].includes(filtrStatusuAllegroOfert)&&pub.group!==filtrStatusuAllegroOfert)return false;if(filtrAllegroOfert==="problemy"&&(["poprawne","kanoniczne","synchronizacja"].includes(a.status)||!pub.withdrawable))return false;if(filtrAllegroOfert==="duplikaty"&&!audyt.offerIds.has(String(a.oferta.id)))return false;if(!["wszystkie","problemy","duplikaty"].includes(filtrAllegroOfert)&&a.status!==filtrAllegroOfert)return false;const o=a.oferta,p=a.mapped,s=a.suggestion?.produkt,text=`${o.id} ${o.name||""} ${o.externalId||""} ${o.ean||o.gtin||""} ${o.manufacturerCode||o.producerCode||""} ${p?.id||""} ${p?.nazwa||""} ${p?.sku||p?.externalId||""} ${s?.nazwa||""}`.toLowerCase();return !q||text.includes(q);});
  const priority={konflikt:0,duplikat:1,sugestia:2,niepodpiete:3,sprawdz:4,synchronizacja:5,kanoniczne:6,poprawne:7};
  filtered.sort((a,b)=>sortAllegroOfert==="nazwa"?String(a.oferta.name||"").localeCompare(String(b.oferta.name||""),"pl"):sortAllegroOfert==="status"?String(a.oferta.status||"").localeCompare(String(b.oferta.status||"")):(priority[a.status]??9)-(priority[b.status]??9)||Number(b.suggestion?.score||b.current?.score||0)-Number(a.suggestion?.score||a.current?.score||0));
  const pageSize=Math.max(25,Number(allegroLimitWidokuOfert)||100),pages=Math.max(1,Math.ceil(filtered.length/pageSize));allegroOfertyStrona=Math.min(Math.max(1,allegroOfertyStrona),pages);const start=(allegroOfertyStrona-1)*pageSize,rows=filtered.slice(start,start+pageSize);
  allegroOfertyWynikiIds=filtered.map(a=>String(a.oferta.id));allegroOfertyStronaIds=rows.map(a=>String(a.oferta.id));
  const offerIds=new Set(all.map(a=>String(a.oferta.id))),selectedIds=[...zaznaczoneMapowaniaAllegro].filter(id=>offerIds.has(String(id))),withdrawSelected=selectedIds.filter(id=>allegroOferteMoznaWycofac(allegroOfertaPoId(id))),safeVisible=rows.filter(a=>(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length&&allegroOferteMoznaWycofac(a.oferta)),safeSelected=all.filter(a=>zaznaczoneMapowaniaAllegro.has(String(a.oferta.id))&&(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length&&allegroOferteMoznaWycofac(a.oferta));
  const activeFilters=[q,filtrStatusuAllegroOfert!=="aktywne",filtrAllegroOfert!=="problemy",sortAllegroOfert!=="priorytet"].filter(Boolean).length;
  const fields=`<div class="allegro-listing-advanced-grid admin-search-full"><label class="allegro-listing-search-wide"><span>Oferta, produkt lub identyfikator</span><input value="${esc(szukajAllegroOfert)}" placeholder="Nazwa, ID oferty, EAN, SKU, EXTERNAL_ID lub kod producenta…" oninput="szukajAllegroOfert=this.value.toLowerCase();allegroOfertyStrona=1;zaplanujRenderPoWpisaniu()"></label><label><span>Status publikacji</span><select onchange="allegroOfertyUstawFiltr('publikacja',this.value)">${allegroPublikacjaOpcjeHTML([["aktywne",`Aktywne i szkice (${counts.aktywne})`],["sprzedaz",`W sprzedaży (${counts.sprzedaz})`],["szkice",`Szkice / nieaktywne (${counts.szkice})`],["zakonczone",`Zakończone (${counts.zakonczone})`],["wszystkie",`Cały rejestr (${counts.wszystkie})`]],filtrStatusuAllegroOfert)}</select></label><label><span>Stan powiązania</span><select onchange="allegroOfertyUstawFiltr('powiazanie',this.value)">${allegroPublikacjaOpcjeHTML([["problemy",`Wymaga decyzji (${counts.problemy})`],["wszystkie","Każdy stan powiązania"],["kanoniczne",`Oferty główne (${counts.kanoniczne})`],["synchronizacja",`Agent aktualizuje (${counts.synchronizacja})`],["duplikat",`Drugie oferty (${counts.duplikat})`],["konflikt",`Konflikty (${counts.konflikt})`],["sugestia",`Pewne sugestie (${counts.sugestia})`],["niepodpiete",`Niepodpięte (${counts.niepodpiete})`],["sprawdz",`Do sprawdzenia (${counts.sprawdz})`],["poprawne",`Poprawne (${counts.poprawne})`],["duplikaty",`Centrum duplikatów (${counts.duplikaty})`]],filtrAllegroOfert)}</select></label><label><span>Sortowanie</span><select onchange="allegroOfertyUstawFiltr('sort',this.value)">${allegroPublikacjaOpcjeHTML([["priorytet","Najpierw decyzje"],["nazwa","Nazwa A–Z"],["status","Status Allegro"]],sortAllegroOfert)}</select></label><label><span>Na stronie</span><select onchange="allegroLimitWidokuOfert=Number(this.value)||100;allegroOfertyStrona=1;renderuj()">${[25,50,100,250,500,1000].map(n=>`<option value="${n}" ${pageSize===n?"selected":""}>${n}</option>`).join("")}</select></label><button class="btn ghost allegro-listing-reset" type="button" onclick="allegroOfertyResetujFiltry()" ${activeFilters?"":"disabled"}>Wyczyść wszystkie filtry</button></div>`;
  const targetIds=selectedIds.length?selectedIds:(safeVisible.map(a=>String(a.oferta.id))),targetSafe=selectedIds.length?safeSelected.length:safeVisible.length;
  const extra=`<button class="btn ghost" ${allegroMapowanieMasowe.busy||!targetSafe?"disabled":""} onclick='allegroZastosujPewneSugestieMapowania(${JSON.stringify(targetIds)})'>${allegroMapowanieMasowe.busy?"⏳ Zapisuję…":`🧩 Połącz pewne (${targetSafe})`}</button><button class="btn danger" ${withdrawSelected.length&&!allegroWycofywanieOfert.busy?"":"disabled"} onclick='allegroPrzygotujWycofanieOfert(${JSON.stringify(withdrawSelected)})'>Zakończ zaznaczone (${withdrawSelected.length})</button>`;
  const operations=adminOperacjeWynikowHTML({id:"allegro-offers",selected:selectedIds.length,pageCount:rows.length,resultCount:filtered.length,selectPage:"allegroOfertyZaznaczZakres('strona')",selectAll:"allegroOfertyZaznaczZakres('filtr')",clear:"zaznaczoneMapowaniaAllegro.clear();renderuj()",exportSelected:"allegroOfertyEksportujZakres('zaznaczone')",exportAll:"allegroOfertyEksportujZakres('filtr')",extra});
  const cards=rows.length?allegroProgresywneKartyHTML(rows,allegroOfertaMapowanieCardHTML,"oferty"):`<div class="allegro-listing-empty"><span>⌕</span><b>Brak ofert w tym widoku</b><small>Zmień albo wyczyść aktywne filtry.</small></div>`;
  return `<div class="allegro-listing-workspace allegro-offers-workspace"><section class="panel allegro-listing-hero"><div><span class="order-pro-label">KATALOG OFERT • API ALLEGRO</span><h2>🏷️ Oferty i powiązania produktów</h2><p>Jedna oferta główna jest trwale połączona z produktem sklepu. Dane sklepu pozostają źródłem nazwy, ceny, opisów, zdjęć i parametrów.</p></div><div class="allegro-listing-hero-actions"><button class="btn" onclick="allegroUruchomAutomatyczneMapowanie(false)" ${allegroAutoMapowanieSerwera.busy?"disabled":""}>${allegroAutoMapowanieSerwera.busy?"⏳ Kontroluję…":"🤖 Sprawdź nowe oferty"}</button><a class="btn ghost" href="#/admin/allegro/oferty">🟠 Wystaw produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia</a></div></section><section class="allegro-listing-metrics">${[["problemy","⚠","Do decyzji",counts.problemy],["kanoniczne","🔒","Oferty główne",counts.kanoniczne],["synchronizacja","↻","Agent aktualizuje",counts.synchronizacja],["duplikat","⧉","Drugie oferty",counts.duplikat],["niepodpiete","○","Niepodpięte",counts.niepodpiete],["wszystkie","▦","Wszystkie",counts.wszystkie]].map(([id,icon,label,value])=>`<button class="${filtrAllegroOfert===id?"active":""}" onclick="allegroOfertyUstawFiltr('powiazanie','${id}')"><span>${icon}</span><b>${value}</b><small>${label}</small></button>`).join("")}</section>${adminWyszukiwaniePanelHTML({id:"allegro-offers",description:"Połącz status publikacji, stan powiązania, identyfikatory i sortowanie. Duże listy są doładowywane stopniowo.",results:filtered.length,active:activeFilters>0,open:true,fields,actions:operations})}${allegroWycofaniePanelHTML()}${allegroAutoMapowanieSerwera.error?`<div class="backend-note allegro-mapping-error"><b>Błąd automatu:</b> ${esc(allegroAutoMapowanieSerwera.error)}</div>`:""}${allegroMapowanieMasowe.error?`<div class="backend-note allegro-mapping-error"><b>Błąd operacji:</b> ${esc(allegroMapowanieMasowe.error)}</div>`:""}${audyt.produkty&&filtrAllegroOfert==="duplikaty"?allegroCentrumDuplikatowHTML(audyt):""}<section class="panel allegro-listing-catalog"><div class="allegro-listing-results-head"><div><b>${filtered.length} ofert</b><small>Pokazano ${rows.length} • strona ${allegroOfertyStrona} z ${pages}</small></div><span>${selectedIds.length} zaznaczonych</span></div><div class="allegro-offer-map-list">${cards}</div>${pages>1?`<nav class="allegro-listing-pagination"><button class="btn ghost" onclick="allegroOfertyUstawStrone(${allegroOfertyStrona-1})" ${allegroOfertyStrona===1?"disabled":""}>← Poprzednia</button><span>Strona <b>${allegroOfertyStrona}</b> z <b>${pages}</b></span><button class="btn ghost" onclick="allegroOfertyUstawStrone(${allegroOfertyStrona+1})" ${allegroOfertyStrona===pages?"disabled":""}>Następna →</button></nav>`:""}</section></div>`;
};

allegroZgodnoscPozycje=function(){
  const items=Array.isArray(allegroStan.complianceAudit?.items)?allegroStan.complianceAudit.items:[],q=String(szukajAllegroZgodnosc||"").trim().toLowerCase();
  return items.filter(item=>{const text=[item.offerId,item.name,item.status,...(item.violations||[]).flatMap(v=>[v.label,...(v.matches||[])])].join(" ").toLowerCase(),actionable=!item.ok&&!item.fixed&&!item.error;const match=filtrAllegroZgodnosc==="wszystkie"||(filtrAllegroZgodnosc==="naruszenia"&&actionable)||(filtrAllegroZgodnosc==="naprawione"&&item.fixed)||(filtrAllegroZgodnosc==="poprawne"&&item.ok&&!item.fixed&&!item.error)||(filtrAllegroZgodnosc==="bledy"&&!!item.error);return match&&(!q||text.includes(q));});
};
function allegroZgodnoscResetujFiltry(){szukajAllegroZgodnosc="";filtrAllegroZgodnosc="naruszenia";renderuj();}
function allegroZgodnoscEksportuj(scope="filtr"){
  const all=Array.isArray(allegroStan.complianceAudit?.items)?allegroStan.complianceAudit.items:[],ids=scope==="zaznaczone"?new Set([...zaznaczoneAllegroZgodnosc].map(String)):null,rows=(ids?all.filter(x=>ids.has(String(x.offerId))):allegroZgodnoscPozycje()).map(item=>[item.offerId,item.name||"",item.status||"",item.error?"Błąd API":item.fixed?"Naprawiona":item.ok?"Zgodna":"Do naprawy",(item.violations||[]).map(v=>v.label).join(" | "),item.checkedAt||""]);
  adminEksportujCSV(`zgodnosc-allegro-${new Date().toISOString().slice(0,10)}.csv`,["ID oferty","Nazwa","Status Allegro","Wynik","Wykryte reguły","Data kontroli"],rows);
}

allegroZgodnoscPanelHTML=function(){
  const audit=allegroStan.complianceAudit||{},all=Array.isArray(audit.items)?audit.items:[],items=allegroZgodnoscPozycje(),open=all.filter(x=>!x.ok&&!x.fixed&&!x.error).length,fixed=all.filter(x=>x.fixed).length,errors=all.filter(x=>x.error).length,safe=all.filter(x=>x.ok&&!x.fixed&&!x.error).length,selected=[...zaznaczoneAllegroZgodnosc].filter(id=>items.some(x=>String(x.offerId)===String(id))),selectedOpen=selected.filter(id=>all.some(x=>String(x.offerId)===String(id)&&!x.ok&&!x.fixed&&!x.error));
  const activeFilters=!!(String(szukajAllegroZgodnosc||"").trim()||filtrAllegroZgodnosc!=="naruszenia");
  const fields=`<div class="allegro-listing-advanced-grid admin-search-full"><label class="allegro-listing-search-wide"><span>Oferta lub wykryta treść</span><input value="${esc(szukajAllegroZgodnosc)}" placeholder="Nazwa, ID oferty albo niedozwolony zwrot…" oninput="szukajAllegroZgodnosc=this.value;clearTimeout(window.__allegroComplianceSearch);window.__allegroComplianceSearch=setTimeout(()=>renderuj(),250)"></label><label><span>Wynik kontroli</span><select onchange="filtrAllegroZgodnosc=this.value;renderuj()">${allegroPublikacjaOpcjeHTML([["naruszenia",`Do naprawy (${open})`],["wszystkie",`Wszystkie (${all.length})`],["naprawione",`Naprawione (${fixed})`],["poprawne",`Zgodne (${safe})`],["bledy",`Błędy połączenia (${errors})`]],filtrAllegroZgodnosc)}</select></label><button class="btn ghost allegro-listing-reset" type="button" onclick="allegroZgodnoscResetujFiltry()" ${activeFilters?"":"disabled"}>Wyczyść filtry</button></div>`;
  const operations=adminOperacjeWynikowHTML({id:"allegro-compliance",selected:selected.length,pageCount:items.length,resultCount:items.length,selectPage:`allegroZaznaczZgodnosc(${JSON.stringify(items.map(x=>String(x.offerId)))},true)`,selectAll:`allegroZaznaczZgodnosc(${JSON.stringify(items.map(x=>String(x.offerId)))},true)`,clear:"zaznaczoneAllegroZgodnosc.clear();renderuj()",exportSelected:"allegroZgodnoscEksportuj('zaznaczone')",exportAll:"allegroZgodnoscEksportuj('filtr')",extra:`<button class="btn" ${!selectedOpen.length||allegroZgodnoscBusy?"disabled":""} onclick='allegroAudytujZgodnosc({fix:true,offerIds:${JSON.stringify(selectedOpen)}})'>🛡️ Napraw zaznaczone (${selectedOpen.length})</button>`});
  const tableRows=items.map(item=>{const actionable=!item.ok&&!item.fixed&&!item.error,status=item.error?"błąd połączenia":item.fixed?"naprawiona":item.ok?"zgodna":"zablokowana",statusClass=item.error?"lvl-bad":item.ok||item.fixed?"lvl-ok":"lvl-ostrzezenie";return `<tr class="${actionable?"has-risk":"is-safe"}"><td><input type="checkbox" ${zaznaczoneAllegroZgodnosc.has(String(item.offerId))?"checked":""} onchange="allegroZaznaczZgodnosc([${jsArg(String(item.offerId))}],this.checked)"></td><td><b>${esc(item.name||"Oferta")}</b><small>ID ${esc(item.offerId||"—")} • ${esc(item.checkedAt?new Date(item.checkedAt).toLocaleString("pl-PL"):"—")}</small></td><td><span class="lvl ${statusClass}">${esc(status)}</span><small>${esc(item.status||"—")}</small></td><td><b>${actionable?"Opis wymaga oczyszczenia":item.error?"Nie udało się pobrać opisu":"Brak aktywnego naruszenia"}</b>${item.removedCount?`<small>Usunięto ${esc(item.removedCount)} fragmentów</small>`:""}${item.fixed&&item.layoutPreserved===true?`<small>✅ Układ opisu zachowany</small>`:""}${item.error?`<small class="compliance-error">${esc(item.error)}</small>`:""}</td><td>${(item.violations||[]).map(v=>`<span class="compliance-rule"><b>${esc(v.label)}</b><small>${esc((v.matches||[]).join(" • "))}</small></span>`).join("")||"—"}</td><td><div class="warehouse-worktable-actions"><a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(item.offerId||"")}" target="_blank" rel="noopener">Oferta ↗</a>${actionable?`<button class="btn" onclick="allegroAudytujZgodnosc({fix:true,offerId:${jsArg(String(item.offerId))}})" ${allegroZgodnoscBusy?"disabled":""}>Napraw</button>`:""}</div></td></tr>`;}).join("");
  return `<div class="allegro-listing-workspace allegro-compliance-workspace"><section class="panel allegro-listing-hero"><div><span class="order-pro-label">TARCZA OPISÓW • BEZPIECZEŃSTWO KONTA</span><h2>🛡️ Bezpieczeństwo opisów Allegro</h2><p>Ta podstrona nie zmienia sprzedaży ani stanów. Wykrywa wyłącznie treści ryzykowne regulaminowo, blokuje ich publikację i bezpiecznie oczyszcza opis bez niszczenia sekcji, zdjęć oraz akapitów.</p></div><div class="allegro-listing-hero-actions"><button class="btn product-allegro-publish" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroAudytujZgodnosc({fix:true})">${allegroZgodnoscBusy?"⏳ Kontroluję…":open?`🛡️ Napraw i sprawdź (${open})`:"🛡️ Sprawdź 50 ofert"}</button><button class="btn ghost" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroAudytujZgodnosc({fix:false})">Tylko sprawdź</button></div></section><section class="allegro-compliance-flow"><article><span>1</span><div><b>Sprawdza opis</b><small>Analizuje tekst aktywnej oferty.</small></div></article><article><span>2</span><div><b>Blokuje ryzyko</b><small>Nie pozwala opublikować niedozwolonego zwrotu.</small></div></article><article><span>3</span><div><b>Naprawia układ</b><small>Usuwa tylko ryzykowną treść.</small></div></article></section><section class="allegro-listing-metrics">${[["naruszenia","⚠","Do naprawy",open],["naprawione","✓","Naprawione",fixed],["poprawne","🛡","Zgodne",safe],["bledy","!","Błędy połączenia",errors],["wszystkie","▦","Skontrolowane",all.length]].map(([id,icon,label,value])=>`<button class="${filtrAllegroZgodnosc===id?"active":""}" onclick="filtrAllegroZgodnosc='${id}';renderuj()"><span>${icon}</span><b>${value}</b><small>${label}</small></button>`).join("")}</section>${adminWyszukiwaniePanelHTML({id:"allegro-compliance",description:"Domyślnie widzisz tylko oferty wymagające działania. Naprawione pozycje nie wracają do alarmów.",results:items.length,active:activeFilters,open:true,fields,actions:operations})}<section class="panel allegro-listing-catalog"><div class="allegro-listing-results-head"><div><b>${items.length} wyników kontroli</b><small>${open?`${open} ofert wymaga naprawy`:"Brak aktywnych naruszeń"}</small></div><span>${selected.length} zaznaczonych</span></div><div class="warehouse-worktable-wrap"><table class="log-table allegro-compliance-table"><tr><th></th><th>Oferta</th><th>Status</th><th>Wynik kontroli</th><th>Wykryte treści</th><th>Akcje</th></tr>${tableRows||`<tr><td colspan="6"><div class="allegro-listing-empty"><span>${open?"⌕":"✅"}</span><b>${all.length?"Brak ofert w tym filtrze":"Uruchom pierwszą kontrolę ofert"}</b><small>${all.length?"W aktywnym widoku nie ma spraw wymagających działania.":"Kontrola pobierze aktywne opisy z Allegro."}</small></div></td></tr>`}</table></div></section><details class="panel allegro-compliance-tools"><summary><b>Jak działa ochrona i narzędzia dodatkowe</b><small>Kontrola pojedynczej oferty, zasady i zakres blokady</small></summary><div class="allegro-compliance-tools-body"><div class="allegro-compliance-guard"><span>✅</span><div><b>Blokada przed publikacją jest zawsze włączona</b><small>Korekta zachowuje sekcje, nagłówki, akapity, listy, zdjęcia i ich kolejność. Usuwany jest wyłącznie niedozwolony fragment.</small></div></div><form class="allegro-compliance-single" onsubmit="event.preventDefault();allegroSprawdzOferteZFormularza(this,false)"><div><b>Sprawdź konkretną ofertę</b><small>Wklej ID oferty z jej adresu.</small></div><input name="offerId" inputmode="numeric" placeholder="ID oferty Allegro" required><button class="btn ghost" type="submit" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź</button><button class="btn" type="button" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroSprawdzOferteZFormularza(this.form,true)">Sprawdź i napraw</button></form><div class="allegro-compliance-rules"><div><b>Treści usuwane lub blokowane</b><span>kontakt przed zakupem • sprawdzanie dostępności • negocjacja ceny • e-mail • telefon • zewnętrzna strona • sprzedaż poza Allegro</span></div><div class="diag-actions"><a class="btn ghost" href="https://help.allegro.com/pl/sell/a/sprzedaz-poza-allegro-i-omijanie-oplat-aMloER9LrH8" target="_blank" rel="noopener">Oficjalna zasada ↗</a><a class="btn ghost" href="https://help.allegro.com/pl/sell/c/jak-wystawiac-oferty" target="_blank" rel="noopener">Zasady opisów ↗</a></div></div></div></details></div>`;
};

function asortymentAktualizujZaznaczoneOferty(){return asortymentPrzygotujOperacjeZewnetrzna("update",null,true);}
function asortymentWycofajZaznaczoneOferty(){return asortymentPrzygotujOperacjeZewnetrzna("withdraw");}
asortymentCentrumDzialanHTML=function(){
  const q=asortymentAgentKolejka,selected=zaznaczoneProdukty.size,offers=[...zaznaczoneProdukty].map(asortymentProduktPoId).filter(p=>p&&asortymentOfertaProduktu(p)).length,dirty=typeof chmuraBrudneKlucze!=="undefined"?chmuraBrudneKlucze.size:0;
  return `<section class="product-action-center catalog-management-center"><header><div><span class="order-pro-label">Operacje na kartotekach i istniejących ofertach</span><h3>⚡ Centrum zarządzania produktami</h3><p>Nowe oferty powstają wyłącznie w sekcji Allegro → Oferty i publikacja. Tutaj porządkujesz dane, ceny, widoczność oraz istniejące oferty.</p></div><span class="product-save-state ${dirty?"pending":"saved"}">${dirty?`☁️ ${dirty} zmian czeka na zapis`:"☁️ Dane zsynchronizowane"}</span></header><div class="product-action-columns"><article class="product-action-primary"><small class="catalog-action-eyebrow">DANE I JAKOŚĆ KARTOTEKI</small><b class="catalog-action-count">${selected} zaznaczonych produktów</b><div class="product-action-advanced"><select data-agent-product-operation onchange="asortymentUstawOperacjeAgenta(this.value)" ${q.busy?"disabled":""}><option value="zrodlo">Odśwież dane producenta</option><option value="seo">Popraw SEO i wyszukiwanie</option><option value="prowizja">Pobierz prowizje i opłaty</option><option value="dane">Sprawdź kompletność danych Allegro</option></select><button class="btn" onclick="asortymentUruchomAgentaDlaZaznaczonych()" ${!selected||q.busy?"disabled":""}>🤖 Wykonaj dla zaznaczonych</button></div><small class="catalog-action-note">Agent zapisuje wynik w kartotekach, ale nie tworzy stąd nowej oferty.</small></article><article class="product-action-primary external"><small class="catalog-action-eyebrow">ISTNIEJĄCE OFERTY ALLEGRO</small><b class="catalog-action-count">${offers} powiązanych ofert w zaznaczeniu</b><div class="catalog-offer-actions"><button class="btn" onclick="asortymentAktualizujZaznaczoneOferty()" ${!offers||q.busy?"disabled":""}>↻ Synchronizuj dane i ceny</button><button class="btn danger" onclick="asortymentWycofajZaznaczoneOferty()" ${!offers||q.busy?"disabled":""}>⏹ Wycofaj oferty</button></div><small class="catalog-action-note">Aktualizacja jest wykonywana jednym kliknięciem. Wycofanie pozostaje chronione osobną decyzją.</small></article></div>${q.busy||q.finishedAt?`<div class="product-agent-progress" aria-live="polite"><progress max="${q.total||1}" value="${q.done}"></progress><div><b>${q.busy?`Agent zapisuje: ${esc(q.current||"uruchamianie kolejki")}`:q.cloudSaved===false?"Kolejka zakończona — serwer ponowi zapis":"Kolejka Agenta zakończona i zapisana"}</b><small>${q.done}/${q.total} • poprawnie ${q.ok} • uwagi ${q.warnings} • błędy ${q.failed}</small></div>${q.busy?`<button class="btn ghost" onclick="asortymentAnulujAgenta()">Zatrzymaj po bieżącym</button>`:""}</div>`:""}${q.results.length?`<details class="product-agent-results"><summary>Raport ostatniej operacji (${q.results.length})</summary>${q.results.slice(-30).map(x=>`<p class="${x.ok?x.ready===false?"warning":"ok":"error"}"><b>${x.ok?"✅":"⛔"} ${esc(x.name)}</b><span>${x.ok?x.savedFields?.length?`Zapisano: ${esc(asortymentEtykietyPol(x.savedFields).join(", "))}`:"Dane sprawdzone":esc(x.error)}</span></p>`).join("")}</details>`:""}${asortymentDecyzjaZewnetrznaHTML()}</section>`;
};

asortymentMenuDzialanProduktuHTML=function(p={}){
  const offer=asortymentOfertaProduktu(p);if(!offer)return `<span class="catalog-no-offer-note">Brak oferty Allegro — nowe oferty obsługuje sekcja „Oferty i publikacja”.</span>`;
  return `<details class="product-row-action-menu"><summary class="btn ghost">🟠 Oferta</summary><div><a class="allegro" href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener">↗ Otwórz ofertę ${esc(offer.id)}</a><button onclick="asortymentPrzygotujOperacjeZewnetrzna('update',${jsArg(p.id)},true)">↻ Synchronizuj dane i cenę</button><button onclick="asortymentUruchomAgentaDlaProduktu(${jsArg(p.id)},'prowizja')">📊 Pobierz prowizję</button><button class="danger" onclick="asortymentPrzygotujOperacjeZewnetrzna('withdraw',${jsArg(p.id)})">⏹ Wycofaj ofertę</button></div></details>`;
};

allegroStatusProduktuHTML=function(p={}){
  const matches=allegroOfertyPasujaceDoProduktu(p),activeMatches=matches.filter(allegroDopasowanieDuplikatuAktywne),offer=activeMatches[0]?.offer||matches[0]?.offer;if(!offer)return `<span class="catalog-allegro-empty">○ Brak oferty</span>`;
  const blocked=produktOznaczonyNiedostepny(p)||offer.saleAvailabilityBlocked===true,active=String(offer.status||offer.publication?.status||"").toUpperCase()==="ACTIVE"&&!blocked,duplicates=activeMatches.slice(1);return `<a class="catalog-allegro-offer-link ${blocked?"blocked":active?"active":"inactive"}" href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener" title="Otwórz ofertę w Allegro"><span>${blocked?"⏸ Wstrzymana razem ze sklepem":active?"● Aktywna":`○ ${esc(offer.status||offer.publication?.status||"nieaktywna")}`}</span><b>Oferta ${esc(offer.id)} ↗</b></a>${duplicates.length?`<a class="catalog-allegro-duplicate" href="#/admin/allegro/oferty" title="Sprawdź powiązane duplikaty">⚠️ ${activeMatches.length} powiązanych ofert</a>`:""}`;
};

function allegroCentrumOfertUstawTryb(tryb="publikacja",filtr=""){
  allegroCentrumOfertTryb=tryb==="rejestr"?"rejestr":"publikacja";
  if(allegroCentrumOfertTryb==="rejestr"&&filtr){
    filtrAllegroOfert=filtr;
    allegroOfertyStrona=1;
  }
  renderuj();
}

function allegroOfertyIPublikacjaHTML(){
  const st=allegroPanelOperacyjnyStaty(),tryb=allegroCentrumOfertTryb==="rejestr"?"rejestr":"publikacja";
  const steps=[
    ["1","Dopasowanie","EAN, SKU i oferta główna"],
    ["2","Kontrola danych","kategoria, parametry i opis"],
    ["3","Publikacja","utworzenie albo aktualizacja"],
    ["4","Potwierdzenie","odczyt rzeczywistego stanu API"]
  ];
  const content=tryb==="rejestr"?allegroOfertyTabelaHTML():allegroWystawianiePanelHTML();
  return `<div class="allegro-unified-offers" data-allegro-offers-mode="${esc(tryb)}">
    <section class="panel allegro-unified-offers-command">
      <div class="allegro-unified-offer-flow">${steps.map(([n,title,description],index)=>`${index?`<i aria-hidden="true">›</i>`:""}<div><span>${n}</span><b>${esc(title)}</b><small>${esc(description)}</small></div>`).join("")}</div>
      <div class="allegro-unified-offers-switch">
        <div><span class="order-pro-label">Obszar roboczy</span><b>Jedna podstrona — dwa potrzebne widoki danych</b><small>Zmiana widoku nie uruchamia mapowania, publikacji ani ponownego pobierania całej kartoteki.</small></div>
        <nav aria-label="Widok ofert i publikacji">
          <button type="button" class="${tryb==="publikacja"?"active":""}" aria-pressed="${tryb==="publikacja"}" onclick="allegroCentrumOfertUstawTryb('publikacja')"><span>🟠</span><div><b>Do działania i publikacji</b><small>${esc(st.zadaniaWystawiania)} zadań Agenta</small></div></button>
          <button type="button" class="${tryb==="rejestr"?"active":""}" aria-pressed="${tryb==="rejestr"}" onclick="allegroCentrumOfertUstawTryb('rejestr')"><span>🏷️</span><div><b>Rejestr i powiązania</b><small>${esc(st.podpiete)} trwałych powiązań</small></div></button>
          <button type="button" class="${tryb==="rejestr"&&filtrAllegroOfert==="problemy"?"active warning":""}" onclick="allegroCentrumOfertUstawTryb('rejestr','problemy')"><span>⚠️</span><div><b>Problemy i duplikaty</b><small>${esc(st.niepodpiete)} ofert bez powiązania</small></div></button>
        </nav>
      </div>
    </section>
    <div class="allegro-offer-unified-content">${content}</div>
  </div>`;
}

/* ── Edycja ceny bezpośrednio w tabeli ── */
let katalogJakoscStan={loading:false,error:"",report:null,filter:"all",query:"",lastAction:null};
function katalogJakoscStatusLabel(status){return status==="critical"?"Wymaga naprawy":status==="warning"?"Do uzupełnienia":"Gotowy";}
function katalogJakoscStatusIcon(status){return status==="critical"?"⛔":status==="warning"?"⚠️":"✅";}
function katalogJakoscPasuje(row){
  if(katalogJakoscStan.filter!=="all"&&row.severity!==katalogJakoscStan.filter)return false;
  const q=normalizujSzukanyTekst(katalogJakoscStan.query||"");if(!q)return true;
  return normalizujSzukanyTekst([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" ")).includes(q);
}
function katalogJakoscUstawFiltr(filter){katalogJakoscStan.filter=filter||"all";renderuj();}
function katalogJakoscSzukaj(input){
  katalogJakoscStan.query=input?.value||"";
  const q=normalizujSzukanyTekst(katalogJakoscStan.query),filter=katalogJakoscStan.filter;
  document.querySelectorAll("[data-quality-row]").forEach(row=>{const matches=(!q||normalizujSzukanyTekst(row.dataset.search||"").includes(q))&&(filter==="all"||row.dataset.status===filter);row.hidden=!matches;});
  const visible=[...document.querySelectorAll("[data-quality-row]")].filter(row=>!row.hidden).length;
  const counter=document.querySelector("[data-quality-visible]");if(counter)counter.textContent=String(visible);
}
async function katalogJakoscPobierz(fixSafe=false){
  if(katalogJakoscStan.loading)return;
  katalogJakoscStan.loading=true;katalogJakoscStan.error="";renderuj();
  try{
    const result=await chmura("catalog-quality-audit",{method:"POST",body:{fixSafe,quarantineOrphans:fixSafe,source:fixSafe?"manual-safe-fix":"manual-audit"},timeout:120000});
    katalogJakoscStan.report=result.report||null;
    katalogJakoscStan.lastAction={fixed:!!fixSafe,changes:(result.changes||[]).length,quarantined:(result.quarantined||[]).length,at:result.updated_at};
    if(fixSafe&&result.saved){
      const pull=await chmura("pull",{timeout:30000});
      if(pull.settings){nalozWspolneUstawienia(pull.settings);zapiszLS("artway_chmura_rev",pull.rev||0);zbudujProdukty();odswiezMenu();}
      toast(`✅ Poprawiono ${result.changes?.length||0} kart; uporządkowano ${result.quarantined?.length||0} osieroconych zapisów`);
    }else toast("Audyt jakości katalogu zakończony ✅");
  }catch(error){katalogJakoscStan.error=error.message||String(error);loguj("blad","Audyt jakości katalogu: "+katalogJakoscStan.error);}
  finally{katalogJakoscStan.loading=false;renderuj();}
}
function katalogJakoscEksportCSV(){
  const report=katalogJakoscStan.report;if(!report?.rows?.length){toast("Najpierw uruchom audyt");return;}
  const rows=[["ID","Nazwa","Ocena","Status","Problemy","EAN","Kod","Producent","Kategoria","Źródło"],...report.rows.map(row=>[row.id,row.name,row.score,katalogJakoscStatusLabel(row.severity),(row.issues||[]).map(x=>x.label).join(" | "),row.ean,row.externalId,row.manufacturer,row.category,row.sourceUrl])];
  pobierzPlik(`audyt-katalogu-${new Date().toISOString().slice(0,10)}.csv`,"\uFEFF"+rows.map(row=>row.map(csvPole).join(";")).join("\n"),"text/csv");
}
function widokAdminJakoscKatalogu(){
  const report=katalogJakoscStan.report,summary=report?.summary||{total:0,ready:0,warning:0,critical:0,averageScore:0,duplicateGroups:0,orphanEdits:0,safeFixes:0};
  if(!report&&!katalogJakoscStan.loading&&!katalogJakoscStan.error)setTimeout(()=>katalogJakoscPobierz(false),0);
  const rows=(report?.rows||[]).filter(katalogJakoscPasuje),action=katalogJakoscStan.lastAction;
  return asortymentSzkielet("jakosc",`<div class="panel catalog-quality-page">
    <header class="catalog-quality-hero"><div><span class="order-pro-label">Stała kontrola danych sprzedażowych</span><h1>🧪 Jakość katalogu</h1><p>Jedna kontrola dla sklepu, Allegro, Google, SEO i Agenta AI. System wykrywa braki, nieprawidłowe identyfikatory, duplikaty, powtarzające się opisy oraz osierocone dane synchronizacji.</p><small>Automatyczny audyt działa codziennie. Bezpieczna korekta porządkuje wyłącznie dane wynikające z istniejących pól — nigdy nie wymyśla ceny, EAN-u ani informacji o produkcie.</small></div><div class="catalog-quality-actions"><button class="btn ghost" onclick="katalogJakoscPobierz(false)" ${katalogJakoscStan.loading?"disabled":""}>↻ Uruchom audyt</button><button class="btn" onclick="katalogJakoscPobierz(true)" ${katalogJakoscStan.loading||!report?"disabled":""}>✨ Zastosuj bezpieczne poprawki</button><button class="btn ghost" onclick="katalogJakoscEksportCSV()" ${report?"":"disabled"}>⇩ Raport CSV</button></div></header>
    ${katalogJakoscStan.loading?`<div class="catalog-quality-progress" role="status"><span class="spinner"></span><div><b>${report?"Aktualizuję kontrolę katalogu…":"Analizuję wszystkie aktywne produkty…"}</b><small>Sprawdzam dane identyfikacyjne, opisy, zdjęcia, źródła, SEO i powiązania.</small></div></div>`:""}
    ${katalogJakoscStan.error?`<div class="form-err" role="alert"><b>Audyt nie został wykonany.</b><br>${esc(katalogJakoscStan.error)} <button class="btn ghost" onclick="katalogJakoscPobierz(false)">Spróbuj ponownie</button></div>`:""}
    ${action?`<div class="catalog-quality-last ${action.fixed?"fixed":""}"><b>${action.fixed?"✅ Zakończono bezpieczne porządkowanie":"✅ Audyt zakończony"}</b><span>${action.fixed?`Zmieniono ${action.changes} kart i odseparowano ${action.quarantined} osieroconych zapisów.`:`Wynik zapisano ${new Date(action.at||Date.now()).toLocaleString("pl-PL")}.`}</span></div>`:""}
    <div class="orders-stat-grid catalog-quality-stats">
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="all"?"active":""}" onclick="katalogJakoscUstawFiltr('all')"><span>📚</span><b>${summary.total}</b><small>aktywnych produktów</small></button>
      <button class="order-stat-card stat-filter ${summary.critical?"hot":""} ${katalogJakoscStan.filter==="critical"?"active":""}" onclick="katalogJakoscUstawFiltr('critical')"><span>⛔</span><b>${summary.critical}</b><small>wymaga naprawy</small></button>
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="warning"?"active":""}" onclick="katalogJakoscUstawFiltr('warning')"><span>⚠️</span><b>${summary.warning}</b><small>do uzupełnienia</small></button>
      <button class="order-stat-card stat-filter money ${katalogJakoscStan.filter==="ready"?"active":""}" onclick="katalogJakoscUstawFiltr('ready')"><span>✅</span><b>${summary.ready}</b><small>gotowych kart</small></button>
      <div class="order-stat-card"><span>🎯</span><b>${summary.averageScore}%</b><small>średnia jakość</small></div>
    </div>
    ${summary.orphanEdits?`<div class="catalog-quality-warning"><div><b>🧹 ${summary.orphanEdits} osierocone ${summary.orphanEdits===1?"dane edycji":"zapisy edycji"}</b><span>Nie są produktami i nie trafią już do sitemap, Google, SEO, monitoringu ani zadań Agenta. „Bezpieczne poprawki” przeniosą ich kopię do prywatnego archiwum audytu i usuną z katalogu roboczego.</span></div></div>`:""}
    ${summary.duplicateGroups?`<div class="catalog-quality-warning"><div><b>🧬 ${summary.duplicateGroups} grup potencjalnych duplikatów</b><span>System niczego nie usuwa automatycznie. Otwórz kartę produktu i zdecyduj, która pozycja ma pozostać.</span></div><a class="btn ghost" href="#/admin/asortyment/produkty" onclick="filtrStatusuProduktow='duplikaty'">Sprawdź duplikaty</a></div>`:""}
    ${report?`<section class="catalog-quality-toolbar"><label><span>Szukaj w raporcie</span><input placeholder="Nazwa, ID, EAN, kod, producent, kategoria lub problem…" value="${esc(katalogJakoscStan.query)}" oninput="katalogJakoscSzukaj(this)" autocomplete="off"></label><span>Widoczne: <b data-quality-visible>${rows.length}</b> z ${summary.total}</span><span>Możliwe bezpieczne poprawki: <b>${summary.safeFixes}</b></span></section>
    <div class="catalog-quality-table-wrap"><table class="log-table catalog-quality-table"><thead><tr><th>Produkt</th><th>Identyfikatory</th><th>Jakość</th><th>Wykryte problemy</th><th>Źródło</th><th>Akcje</th></tr></thead><tbody>${rows.map(row=>`<tr data-quality-row data-status="${esc(row.severity)}" data-search="${esc([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" "))}"><td><div class="catalog-quality-product">${row.image?`<img src="${esc(row.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'📦'}))">`:`<span>📦</span>`}<div><b>${esc(row.name)}</b><small>ID ${esc(row.id)} • ${esc(row.category||"bez kategorii")}</small><em>${esc(row.manufacturer||"producent nieuzupełniony")}</em></div></div></td><td><small>EAN/GTIN</small><b>${esc(row.ean||"—")}</b><small>Kod / EXTERNAL_ID</small><b>${esc(row.externalId||"—")}</b></td><td><div class="catalog-quality-score ${esc(row.severity)}"><b>${row.score}%</b><span>${katalogJakoscStatusIcon(row.severity)} ${katalogJakoscStatusLabel(row.severity)}</span></div></td><td><div class="catalog-quality-issues">${(row.issues||[]).map(issue=>`<span class="${esc(issue.severity)}">${esc(issue.label)}</span>`).join("")||`<span class="ready">Komplet podstawowych danych</span>`}${Object.keys(row.safePatch||{}).length?`<small>✨ Bezpieczna korekta: ${Object.keys(row.safePatch).map(field=>esc(field)).join(", ")}</small>`:""}</div></td><td>${row.sourceUrl?`<a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">Otwórz źródło ↗</a>`:"<span class='muted'>Brak linku</span>"}${row.allegroOfferId?`<a href="https://allegro.pl/oferta/${encodeURIComponent(row.allegroOfferId)}" target="_blank" rel="noopener">Oferta Allegro ↗</a>`:""}</td><td><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(row.id)}">✏️ Uzupełnij</a></td></tr>`).join("")||`<tr><td colspan="6">Brak produktów w wybranym filtrze.</td></tr>`}</tbody></table></div>`:`<div class="backend-note">Raport pojawi się po zakończeniu analizy.</div>`}
    <div class="catalog-quality-rules"><h2>Co system poprawia sam, a czego nie zgaduje</h2><div><article><b>✅ Automatycznie i bezpiecznie</b><p>Porządkuje spacje i linki, uzupełnia zgodne pola EAN/GTIN, usuwa identyczne powtórzenia akapitów, tworzy krótki opis z istniejącego opisu, uzupełnia SEO oraz producenta tylko z jednoznacznego źródła.</p></article><article><b>🔒 Zawsze wymaga faktów</b><p>Cena, kod EAN, zdjęcia, kategoria, parametry, dostępność i brakujący pełny opis nie są wymyślane. Trafiają do raportu oraz zadań Agenta do sprawdzenia w źródle producenta.</p></article></div></div>
  </div>`);
}

function asortymentStanZapisuCeny(input,status="",tekst=""){
  const pole=input?.closest?.(".catalog-product-edit-value");if(!pole)return;
  pole.classList.remove("is-saving","is-saved","has-error");
  if(status)pole.classList.add(status);
  input.setAttribute("aria-busy",status==="is-saving"?"true":"false");
  input.setAttribute("aria-invalid",status==="has-error"?"true":"false");
  const info=pole.querySelector("[data-inline-price-status]");if(info)info.textContent=tekst;
  clearTimeout(input._artwayPriceStateTimer);
  if(status==="is-saved")input._artwayPriceStateTimer=setTimeout(()=>{pole.classList.remove("is-saved");if(info)info.textContent="";},1800);
}
function asortymentPodmienCeneBezRenderu(id,patch={},usun=[]){
  return podmienProduktAdminBezRenderu(id,patch,usun);
}
async function asortymentZapiszCeneSerwer(id,channel,value,clear=false){
  return chmura("catalog-product-price-update",{method:"POST",body:{productId:String(id),channel,...(clear?{clear:true}:{value})},timeout:30000});
}
function asortymentStatusPublikacjiCeny(saved={}){
  return saved.publication?.published===false?"Zapisano • publikacja w tle":"Zapisano i opublikowano";
}
async function ustawCeneKanalu(id,kanal,wartosc,input=null){
  const pola={sklep:"cena",allegro:"cenaAllegro",vonHalsky:"cenaVonHalsky"},pole=pola[kanal]||"cena",poprzedni=pobierzProduktAdmin(id)||{},raw=String(wartosc).trim(),cena=parseFloat(raw.replace(/\s/g,"").replace(",",".")),dziedziczony=kanal==="vonHalsky"?kwotaNum(poprzedni.cenaAllegro||poprzedni.cena):kwotaNum(poprzedni.cena);
  if(raw===""&&kanal!=="sklep"){
    asortymentStanZapisuCeny(input,"is-saving","Zapisuję dziedziczenie…");
    try{const saved=await asortymentZapiszCeneSerwer(id,kanal==="vonHalsky"?"vonHalsky":"allegro",null,true);asortymentPodmienCeneBezRenderu(id,saved.fields||{},saved.remove||[pole],false);
      if(input)input.value="";loguj("info",`Cena ${kanal} produktu ${id} dziedziczy cenę ${kanal==="vonHalsky"?"Allegro":"sklepu"}`);asortymentStanZapisuCeny(input,"is-saved",asortymentStatusPublikacjiCeny(saved));return true;
    }catch(error){asortymentStanZapisuCeny(input,"has-error","Nie zapisano — spróbuj ponownie");toast(`⚠️ ${error.message||"Nie udało się zapisać ceny"}`);return false;}
  }
  if(!(cena>0)){
    const previousValue=kwotaNum(poprzedni[pole]||(kanal==="vonHalsky"?poprzedni.cenaAllegro:poprzedni.cena));
    if(input)input.value=poprzedni[pole]==null&&kanal!=="sklep"?"":String(previousValue.toFixed(2)).replace(".",",");
    asortymentStanZapisuCeny(input,"has-error",kanal==="sklep"?"Podaj cenę większą od 0":"Podaj cenę albo pozostaw puste");toast("⚠️ Nieprawidłowa cena sprzedaży");return false;
  }
  asortymentStanZapisuCeny(input,"is-saving","Zapisuję na serwerze…");
  const nowa=+cena.toFixed(2),usun=kanal==="sklep"&&Number(poprzedni.staraCena)>0&&Number(poprzedni.staraCena)<=nowa?["staraCena"]:[];
  try{const saved=await asortymentZapiszCeneSerwer(id,kanal==="sklep"?"store":kanal,nowa);asortymentPodmienCeneBezRenderu(id,saved.fields||{[pole]:nowa},[...new Set([...(saved.remove||[]),...usun])],false);if(input)input.value=String(nowa.toFixed(2)).replace(".",",");
    loguj("info",`Zmieniono cenę ${kanal} produktu ${id} → ${zl(nowa)}`);asortymentStanZapisuCeny(input,"is-saved",asortymentStatusPublikacjiCeny(saved));return true;
  }catch(error){if(input)input.value=poprzedni[pole]==null&&kanal!=="sklep"?"":String(kwotaNum(poprzedni[pole]||poprzedni.cena).toFixed(2)).replace(".",",");asortymentStanZapisuCeny(input,"has-error","Nie zapisano — spróbuj ponownie");toast(`⚠️ ${error.message||"Nie udało się zapisać ceny"}`);return false;}
}
function ustawCene(id, wartosc, input=null){
  return ustawCeneKanalu(id,"sklep",wartosc,input);
}
async function ustawCeneZakupu(id, wartosc, input=null){
  const poprzedni=pobierzProduktAdmin(id)||{},raw=String(wartosc).trim(),cena=parseFloat(raw.replace(/\s/g,"").replace(",","."));
  const polaFaktury=["cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu"];
  if(raw===""){
    asortymentStanZapisuCeny(input,"is-saving","Usuwam…");
    try{const saved=await asortymentZapiszCeneSerwer(id,"purchase",null,true);asortymentPodmienCeneBezRenderu(id,saved.fields||{},saved.remove||["cenaZakupu",...polaFaktury],false);loguj("info",`Usunięto ręczną cenę zakupu produktu ${id}`);asortymentStanZapisuCeny(input,"is-saved","Usunięto");return true;
    }catch(error){asortymentStanZapisuCeny(input,"has-error","Nie usunięto");toast(`⚠️ ${error.message||"Nie udało się usunąć ceny"}`);return false;}
  }
  if(!Number.isFinite(cena)||cena<0){
    if(input)input.value=poprzedni.cenaZakupu==null?"":String(kwotaNum(poprzedni.cenaZakupu).toFixed(2)).replace(".",",");
    asortymentStanZapisuCeny(input,"has-error","Podaj 0 lub więcej");toast("⚠️ Nieprawidłowa cena zakupu");return false;
  }
  asortymentStanZapisuCeny(input,"is-saving","Zapisuję…");
  const nowa=+cena.toFixed(2);
  try{const saved=await asortymentZapiszCeneSerwer(id,"purchase",nowa);asortymentPodmienCeneBezRenderu(id,saved.fields||{cenaZakupu:nowa},saved.remove||polaFaktury,false);
    if(input)input.value=String(nowa.toFixed(2)).replace(".",",");loguj("info",`Zmieniono prywatną cenę zakupu produktu ${id} → ${zl(nowa)}`);asortymentStanZapisuCeny(input,"is-saved",asortymentStatusPublikacjiCeny(saved));return true;
  }catch(error){if(input)input.value=poprzedni.cenaZakupu==null?"":String(kwotaNum(poprzedni.cenaZakupu).toFixed(2)).replace(".",",");asortymentStanZapisuCeny(input,"has-error","Nie zapisano — spróbuj ponownie");toast(`⚠️ ${error.message||"Nie udało się zapisać ceny zakupu"}`);return false;}
}
/* ── Akcje masowe na produktach ── */
let zaznaczoneProdukty = new Set();
let asortymentWynikiIds=[],asortymentStronaIds=[];
function przelaczZaznProd(id){ zaznaczoneProdukty.has(id) ? zaznaczoneProdukty.delete(id) : zaznaczoneProdukty.add(id); asortymentOdswiezStanZaznaczenia(); }
function zaznaczWidoczneProd(chk, ids){
  ids.forEach(id => chk.checked ? zaznaczoneProdukty.add(id) : zaznaczoneProdukty.delete(id));
  asortymentOdswiezStanZaznaczenia();
}
function ustawZaznaczenieProduktow(ids,zaznacz=true){
  for(const raw of Array.isArray(ids)?ids:[]){const id=Number(raw);if(!Number.isFinite(id))continue;zaznacz?zaznaczoneProdukty.add(id):zaznaczoneProdukty.delete(id);}
  asortymentOdswiezStanZaznaczenia();
}
function wyczyscZaznaczenieProduktow(){zaznaczoneProdukty.clear();asortymentOdswiezStanZaznaczenia();}
function asortymentZaznaczZakres(zakres){ustawZaznaczenieProduktow(zakres==="strona"?asortymentStronaIds:asortymentWynikiIds,true);}
function asortymentEksportuj(zakres){
  if(zakres==="zaznaczone")return eksportujProduktyPoIdCSV([...zaznaczoneProdukty],"produkty-zaznaczone.csv");
  eksportujProduktyPoIdCSV(asortymentWynikiIds,"produkty-filtrowane.csv");
}
async function produktCyklCentralny(productIds=[],operation="trash"){
  const ids=[...new Set((Array.isArray(productIds)?productIds:[productIds]).map(id=>String(id??"").trim()).filter(Boolean))];
  if(!ids.length)return {changed:0,results:[]};
  const result=await chmura("catalog-product-lifecycle",{method:"POST",body:{
    productIds:ids,
    operation,
    mutationId:`product-${operation}-batch:${Date.now().toString(36)}`
  },timeout:60000});
  if(result?.ok!==true)throw new Error(result?.error||"Serwer nie potwierdził operacji na produktach.");
  const failed=(result.results||[]).filter(item=>operation==="purge"?!item.deleted:!item.updated);
  if(failed.length)throw new Error(`Nie zmieniono ${failed.length} z ${ids.length} produktów.`);
  if(typeof asortymentCentralnyWyczyscCache==="function")asortymentCentralnyWyczyscCache();
  return result;
}
async function usunZaznaczoneProd(){
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!confirm(`Usunąć ${zaznaczoneProdukty.size} zaznaczonych produktów?`)) return;
  const ids=[...zaznaczoneProdukty];
  try{await produktCyklCentralny(ids,"trash");}
  catch(error){toast("⛔ Nie usunięto zaznaczonych: "+(error.message||error));return;}
  for(const id of ids){
    const p = produktyDodane.find(x=>x.id===id);
    if(p){
      if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
      produktyDodane = produktyDodane.filter(x=>x.id!==id);
      oznaczProduktWKoszu(id,"wlasny");
    }else if(!produktyDefinitywne.includes(id)){
      if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
      oznaczProduktWKoszu(id,"bazowy");
    }
  }
  loguj("info",`Masowo usunięto ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); odswiezMenu(); toast("Usunięto zaznaczone 🗑️"); renderuj();
}
async function zmienCenyZaznaczonych(){
  const wartosc = parseFloat(String($("procentCen")?.value||"").replace(",","."));
  const tryb=String($("trybCenProduktow")?.value||"percent");
  const kanal=String($("kanalCenProduktow")?.value||"sklep");
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!Number.isFinite(wartosc)||wartosc===0){ toast("⚠️ Podaj wartość zmiany, np. 10 lub -5"); return; }
  if(tryb==="percent"&&wartosc<=-100){ toast("⚠️ Obniżka procentowa musi być większa niż -100%"); return; }
  if(tryb==="fixed"&&wartosc<=0){ toast("⚠️ Cena docelowa musi być większa od zera"); return; }
  const operations=[];
  for(const id of [...zaznaczoneProdukty]){
    const p = pobierzProduktAdmin(id); if(!p) continue;
    const wylicz=base=>Math.max(0.01, +(tryb==="percent"?kwotaNum(base)*(1+wartosc/100):tryb==="amount"?kwotaNum(base)+wartosc:wartosc).toFixed(2)),patch={};
    if(kanal==="sklep"||kanal==="oba")patch.cena=wylicz(p.cena);
    if(kanal==="allegro"||kanal==="oba")patch.cenaAllegro=wylicz(p.cenaAllegro||p.cena);
    const remove=patch.cena&&Number(p.staraCena)>0&&Number(p.staraCena)<=patch.cena?["staraCena"]:[];
    operations.push({productId:id,fields:patch,remove});
  }
  if(!operations.length){toast("Brak produktów możliwych do zmiany");return;}
  try{await chmuraZapiszProduktyCentralnie(operations,"catalog-bulk-price");}
  catch(error){toast("⛔ Serwer nie potwierdził masowej zmiany cen: "+(error.message||error));return;}
  const opis=tryb==="percent"?`${wartosc>0?"+":""}${wartosc}%`:tryb==="amount"?`${wartosc>0?"+":""}${zl(wartosc)}`:`na ${zl(wartosc)}`;
  const kanalLabel=kanal==="oba"?"sklepu i Allegro":kanal==="allegro"?"Allegro":"sklepu";
  loguj("info",`Masowa zmiana cen ${kanalLabel} ${opis} dla ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); toast(`Ceny ${kanalLabel} zmienione ${opis} ✅`); renderuj();
}
async function usunProduktAdmin(id){
  if(produktyDodane.some(p=>p.id===id)){
    await usunProdukt(id);
    return;
  }
  try{await produktCyklCentralny([id],"trash");}
  catch(error){toast("⛔ Nie przeniesiono produktu do kosza: "+(error.message||error));return;}
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  oznaczProduktWKoszu(id,"bazowy");
  zbudujProdukty(); odswiezMenu();
  loguj("info","Przeniesiono do kosza na 30 dni produkt bazowy id="+id);
  toast("Produkt w koszu przez 30 dni 🗑️");
  renderuj();
}
async function przywrocProdukt(id){
  if(produktyDefinitywne.includes(id)){ toast("Ten produkt został już usunięty definitywnie"); return; }
  try{await produktCyklCentralny([id],"restore");}
  catch(error){toast("⛔ Nie przywrócono produktu: "+(error.message||error));return;}
  produktyUkryte = produktyUkryte.filter(x=>x!==id);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony ↩️"); renderuj();
}
function resetujEdycjeProduktu(){
  toast("Kartoteka ma teraz jedno źródło na serwerze. Nie istnieje już osobna warstwa products.json do przywrócenia.");
}
async function przelaczWidocznosc(id){
  const product=pobierzProduktAdmin(id)||{},hidden=product.ukryty===true||product.sprzedazAktywna===false||product.saleAvailable===false;
  const fields=hidden
    ? {ukryty:false,sprzedazAktywna:true,saleAvailable:true,aktywny:true}
    : {ukryty:true,sprzedazAktywna:false,saleAvailable:false};
  try{await chmuraZapiszProduktyCentralnie([{productId:id,fields}],"catalog-sale-visibility");}
  catch(error){toast("⛔ Nie zmieniono widoczności: "+(error.message||error));return;}
  zbudujProdukty();toast(hidden?"Produkt widoczny 👁️":"Produkt ukryty 🙈");renderuj();
}

/* ── Eksporty (CSV dla Excela, JSON dla hostingu) ── */
function pobierzPlik(nazwa, tresc, typ){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([tresc], {type:(typ||"text/plain")+";charset=utf-8"}));
  a.download = nazwa; a.click(); URL.revokeObjectURL(a.href);
}
function osadzUstawieniaWIndexie(html){
  const bezpieczne=JSON.stringify(ustawienia,null,2).replace(/</g,"\\u003c");
  const blok=`<!-- PUBLIC_SETTINGS_START -->\n<script id="artway-public-settings" type="application/json">${bezpieczne}</script>\n<!-- PUBLIC_SETTINGS_END -->`;
  const wzor=/<!-- PUBLIC_SETTINGS_START -->[\s\S]*?<!-- PUBLIC_SETTINGS_END -->/;
  if(!wzor.test(html))throw new Error("Nie znaleziono znacznika ustawień w index.html");
  return html.replace(wzor,blok);
}
async function eksportujIndexHTML(){
  try{
    const r=await fetch("/index.html",{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);
    const html=osadzUstawieniaWIndexie(await r.text());
    pobierzPlik("index.html",html,"text/html");
    localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    loguj("info","Wyeksportowano index.html z publicznymi ustawieniami panelu");
    toast("Pobrano index.html — wgraj go na hosting ✅");
  }catch(e){loguj("blad","Eksport index.html: "+e.message);toast("⚠️ Nie udało się przygotować index.html");}
}
const csvPole = v => '"' + String(v??"").replace(/"/g,'""') + '"';
function eksportujZamowienia(wybrane=null,nazwa="zamowienia.csv"){
  const z = Array.isArray(wybrane)?wybrane:pobierzZamowienia();
  const csv = [["nr","data","status","klient","produkty_zl","rabat_zl","dostawa_zl","paczka_weekend_zl","platnosc_oplata_zl","razem_zl","dostawa","platnosc","adres","pozycje"].join(";"),
    ...z.map(x=>{const k=kosztyZamowienia(x); return [x.nr,x.data,x.status,x.email||"gość",k.produkty,k.rabat,k.dostawa,k.paczkaWeekend,k.platnosc,k.razem,x.dostawa||"",x.platnosc||"",x.adres||"",(x.pozycje||[]).join(" | ")].map(v=>typeof v==="number"?String(v.toFixed(2)).replace(".",","):v).map(csvPole).join(";");})].join("\n");
  pobierzPlik(nazwa,"﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano zamówienia ("+z.length+")");
}
function eksportujKlientow(wybrani=null,nazwa="klienci.csv"){
  const k = Array.isArray(wybrani)?wybrani:pobierzUzytkownikow();
  const csv = [["imie_nazwisko","email","rola","data_rejestracji"].join(";"),
    ...k.map(x=>[x.imie,x.email,kontoMaRoleAdmin(x.email)?"administrator":"klient",new Date(x.data).toLocaleDateString("pl-PL")].map(csvPole).join(";"))].join("\n");
  pobierzPlik(nazwa,"﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano klientów ("+k.length+")");
}
// InPost „nadanie z pliku": eksport zamówień do CSV/TXT do wgrania w InPost Managerze
// (manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU). Działa dla paczkomatu i kuriera —
// obejście/awaryjne nadawanie do czasu umowy kurierskiej. Format zgodny ze wzorem InPost.
let zaznaczoneNadania = new Set();
function przelaczZaznaczenieNadania(nr){ nr=String(nr); if(zaznaczoneNadania.has(nr)) zaznaczoneNadania.delete(nr); else zaznaczoneNadania.add(nr); renderuj(); }
function zaznaczWszystkieNadania(zazn){ listaWysylekPoFiltrze().forEach(z=>zazn?zaznaczoneNadania.add(String(z.nr)):zaznaczoneNadania.delete(String(z.nr))); renderuj(); }
// czy zamówienie idzie do paczkomatu (InPost)
function paczkomatoweInpost(z){ const id=String(z?.dostawaId||"").toLowerCase(); if(id==="kurier"||id==="kurier_inpost") return false; if(id==="paczkomat") return true; return !!(z?.paczkomat||z?.wysylka?.punktKod); }
// czy zlecenie ma komplet danych do nadania w InPost (żeby import z pliku nie odrzucił)
function gotoweDoNadaniaInpost(z){
  const k=z.klient||{}, a=z.adresDostawy||{};
  if(String(z?.dostawaId||"").toLowerCase()==="odbior") return {ok:false, powod:"odbiór osobisty"};
  const tel=String(k.telefon||z.telefon||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"");
  if(!/@/.test(String(z.email||k.email||""))) return {ok:false, powod:"brak e-mail"};
  if(tel.length<9) return {ok:false, powod:"brak/zły telefon"};
  if(paczkomatoweInpost(z)){ if(!(z.paczkomat||z.wysylka?.punktKod)) return {ok:false, powod:"brak paczkomatu"}; }
  else { if(!a.ulica||!a.nrDomu) return {ok:false, powod:"brak adresu"}; if(!/^\d{2}-\d{3}$/.test(String(a.kod||""))) return {ok:false, powod:"zły kod pocztowy"}; if(!a.miasto) return {ok:false, powod:"brak miasta"}; }
  return {ok:true, paczk:paczkomatoweInpost(z)};
}
function zaznaczGotoweNadania(){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(gotoweDoNadaniaInpost(z).ok){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(n?`Zaznaczono ${n} gotowych do nadania`:"Brak gotowych zleceń w tym filtrze"); renderuj(); }
function zaznaczTypNadania(typ){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(String(z?.dostawaId||"").toLowerCase()==="odbior") return; const p=paczkomatoweInpost(z); if((typ==="paczkomat"&&p)||(typ==="kurier"&&!p)){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(`Zaznaczono ${n} (${typ})`); renderuj(); }
// nry (opcjonalnie) = tablica numerów zamówień do eksportu (pojedyncze zlecenie / zaznaczone). Bez nry: zaznaczone albo cały filtr.
function eksportNadaniaInpostCSV(nry, format="txt"){
  const tryb=String(format||"txt").toLowerCase();
  const rozszerzony=tryb==="extended"||tryb==="rozszerzony";
  const kolumnowy=tryb==="csv"||tryb==="kolumny"||tryb==="columns";
  const tabulator=tryb==="tab"||tryb==="tsv"||tryb==="inpost";
  const sep=tabulator ? "\t" : (kolumnowy ? "," : ";");
  const ext=kolumnowy||rozszerzony ? "csv" : "txt";
  const mime=ext==="csv" ? "text/csv" : "text/plain";
  const czysc = v => String(v==null?"":v).replace(/[\t;\r\n]+/g," ").replace(/\s+/g," ").trim();
  const telCyfry = t => String(t||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"").slice(-9);
  const telInpost = t => { const d=telCyfry(t); return d.length===9 ? "+48"+d : ""; };
  const kwota = v => { const n=Number(String(v??"").replace(",",".").replace(/[^0-9.]/g,"")); return Number.isFinite(n)&&n>0 ? n.toFixed(2) : ""; };
  const rozmiarInpost = z => { const g=String(z?.wysylka?.gabaryt||"").toLowerCase(); return g==="large"?"C":g==="medium"?"B":"A"; };
  const pole = v => {
    const s=czysc(v);
    return kolumnowy ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const jawne = Array.isArray(nry) && nry.length;
  let bazaZ;
  if(jawne){ const zb=new Set(nry.map(String)); bazaZ = pobierzZamowienia().filter(z=>zb.has(String(z.nr))); }
  else if(zaznaczoneNadania.size){ bazaZ = pobierzZamowienia().filter(z=>zaznaczoneNadania.has(String(z.nr))); }
  else { bazaZ = listaWysylekPoFiltrze(); }
  const lista = bazaZ.filter(z=>{
    if(String(z?.dostawaId||"").toLowerCase()==="odbior") return false;
    if(!jawne && ["dostarczona","anulowana","zwrot"].includes(etapWysylki(z))) return false;
    return true;
  }).slice(0,100);
  if(!lista.length){ toast("Brak zamówień do nadania (sprawdź zaznaczenie lub filtr)"); return; }
  const polaPodstawowe=["e-mail","telefon","rozmiar","paczkomat","numer_referencyjny","dodatkowa_ochrona","za_pobraniem","imie_i_nazwisko","nazwa_firmy","ulica","kod_pocztowy","miasto","typ_przesylki","sposob_nadania","punkt_nadania","paczka_w_weekend"];
  const polaRozszerzone=["uwagi","produkty","kwota_zamowienia","metoda_platnosci","sposob_dostawy","gabaryt_sklepu","waga_kg","dlugosc_cm","szerokosc_cm","wysokosc_cm","telefon_9_cyfr"];
  const pola=rozszerzony?[...polaPodstawowe,...polaRozszerzone]:polaPodstawowe;
  const wiersze=lista.map(z=>{
    const k=z.klient||{}, a=z.adresDostawy||{}, w=z.wysylka||{};
    const paczk=paczkomatoweInpost(z);
    const ulica = czysc(`${a.ulica||""} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`.trim());
    const pobranie = kwota(kwotaPobraniaZamowienia(z,w));
    const ochrona = kwota(w.ochrona || "");
    const sposob=inpostSposobNadania(z,w);
    const punktNadania=String(w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
    const produktyTxt = Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
      ? z.pozycjeDane.map(p=>`${p.nazwa||""}${p.sku?` SKU:${p.sku}`:""} x${p.ilosc||1}`).join(" | ")
      : (Array.isArray(z.pozycje)?z.pozycje.join(" | "):"");
    const podstawowe=[
      z.email||k.email,
      telInpost(k.telefon||z.telefon),
      rozmiarInpost(z),
      paczk ? String(z.paczkomat||w.punktKod||"").toUpperCase() : "",
      z.nr,
      ochrona,
      pobranie,
      [k.imie,k.nazwisko].filter(Boolean).join(" "),
      k.firma,
      ulica,
      a.kod,
      a.miasto,
      paczk ? "paczkomat" : "kurier",
      inpostSposobNadaniaLabel(sposob),
      punktNadania,
      (w.paczkaWeekend || z.paczkaWeekend) ? "TAK" : "NIE"
    ];
    const extra=[
      z.uwagi,
      produktyTxt,
      kwota(z.razem),
      z.platnosc,
      z.dostawa,
      w.gabaryt||"small",
      w.waga,
      w.dlugosc,
      w.szerokosc,
      w.wysokosc,
      telCyfry(k.telefon||z.telefon)
    ];
    return (rozszerzony?[...podstawowe,...extra]:podstawowe).map(pole).join(sep);
  });
  const tresc=[pola.map(pole).join(sep),...wiersze].join("\r\n");
  const nazwaTrybu=rozszerzony?"rozszerzony":(tabulator?"naglowki-tabulator":(kolumnowy?"naglowki":tryb));
  pobierzPlik(`inpost-nadania-${nazwaTrybu}-${new Date().toISOString().slice(0,10)}.${ext}`, tresc, mime);
  const npaczk=lista.filter(z=>paczkomatoweInpost(z)).length, nbrak=lista.filter(z=>!gotoweDoNadaniaInpost(z).ok).length;
  loguj("info",`Eksport nadań InPost ${nazwaTrybu}: ${lista.length} przesyłek (${npaczk} paczkomat, ${lista.length-npaczk} kurier)`);
  toast(tabulator
    ? `📄 TXT InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK, separator Tabulator${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
    : (kolumnowy
      ? `📄 CSV InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK i separator przecinek${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
      : `📄 Plik InPost ${nazwaTrybu.toUpperCase()}: ${lista.length} przesyłek — dla TXT ustaw w InPost separator średnik${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`));
}
let podgladImportuProduktow=null, ostatniRaportImportu=null;

/* Import i eksport kartoteki produktów */
const POLA_CSV_PRODUKTU=["id","nazwa","kategoria","cena","cena_allegro","cena_zakupu","prowizja_allegro","prowizja_allegro_procent","oplaty_allegro_cykliczne","koszt_pakowania","koszt_dodatkowy_sklepu","platnosc_sklepu_procent","koszt_dodatkowy_allegro","doplata_wysylki_allegro","reklama_allegro_procent","vat","stara_cena","stan","sku","gtin","external_id","mpn","marka","producent","opis_krotki","opis","badge","ikona","zdjecie","zdjecie2","zdjecie3","zdjecie4","zdjecie5","zdjecie6","zdjecie7","zdjecie8","zdjecie9","zdjecie10","zdjecie11","zdjecie12","zdjecie13","zdjecie14","zdjecie15","zdjecie16","warianty","kolor","kolor_produktu","rozmiar","material"];
const POLA_OVF_PRODUKTU=["GTIN","EXTERNAL_ID","NAME","STOCK","PRICE","MPN","DESCRIPTION","IMAGE1","IMAGE2","IMAGE3","IMAGE4","IMAGE5","IMAGE6","IMAGE7","IMAGE8","IMAGE9","IMAGE10","IMAGE11","IMAGE12","IMAGE13","IMAGE14","IMAGE15","IMAGE16","CATEGORY","BRAND","MANUFACTURER","COLOR","SIZE","MATERIAL"];
function normalizujNaglowekCSV(v){
  return normalizujSzukanyTekst(v).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
function kanonicznePoleProduktu(naglowek){
  const h=normalizujNaglowekCSV(naglowek);
  const aliasy={
    id:["id","product_id","produkt_id","item_id","id_produktu"],
    nazwa:["nazwa","name","product_name","nazwa_produktu","tytul","title","product_title"],
    kategoria:["kategoria","category","katalog","catalog","category_path","categorypath","breadcrumb","category_tree","category_name","categories","sciezka_kategorii"],
    cena:["cena","price","cena_zl","sale_price","gross_price","net_price","price_gross","price_net","retail_price"],
    cenaAllegro:["cena_allegro","allegro_price","price_allegro"],
    cenaZakupu:["cena_zakupu","purchase_price","cost_price","buy_price"],
    allegroCommissionAmount:["prowizja_allegro","allegro_commission","commission_amount"],
    allegroCommissionRate:["prowizja_allegro_procent","allegro_commission_rate","commission_rate"],
    allegroRecurringFees:["oplaty_allegro_cykliczne","allegro_recurring_fees","listing_fees"],
    kosztPakowania:["koszt_pakowania","packaging_cost"],
    sklepAdditionalCost:["koszt_dodatkowy_sklepu","store_additional_cost"],
    sklepPaymentPercent:["platnosc_sklepu_procent","store_payment_percent"],
    allegroAdditionalCost:["koszt_dodatkowy_allegro","allegro_additional_cost"],
    allegroShippingSubsidy:["doplata_wysylki_allegro","allegro_shipping_subsidy"],
    allegroAdsPercent:["reklama_allegro_procent","allegro_ads_percent"],
    vatRate:["vat","vat_rate","stawka_vat"],
    staraCena:["stara_cena","old_price","regular_price","cena_regularna","oldprice","rrp","msrp"],
    stan:["stan","stock","quantity","ilosc","stan_magazynowy","available","availability","qty"],
    sku:["sku","kod","kod_produktu","symbol","seller_sku","item_sku","offer_sku","symbol_produktu"],
    gtin:["gtin","ean","ean13","barcode","kod_ean"],
    externalId:["external_id","externalid","kod_zewnetrzny","supplier_id","vendor_id","ext_id","supplier_sku"],
    mpn:["mpn","manufacturer_part_number","kod_producenta"],
    marka:["brand","marka","brand_name"],
    producent:["producent","manufacturer","manufacturer_name","producer","producer_name"],
    opisKrotki:["opis_krotki","krotki_opis","krótki_opis","short_description","short_desc","description_short","summary","lead"],
    opis:["opis","description","desc","long_description","description_html","full_description"],
    badge:["badge","etykieta","label"],
    ikona:["ikona","icon","emoji"],
    zdjecie:["zdjecie","image","image1","image_1","image_url","url_zdjecia","main_image","image_url_1","photo","photo1","picture","picture1"],
    warianty:["warianty","variants","options"],
    kolor:["kolor","kolor_tla","background","background_color","card_color"],
    kolorProduktu:["color","kolor_produktu","product_color","barwa"],
    rozmiar:["size","rozmiar","wymiar","wymiary","dimensions"],
    material:["material","material_produktu","tworzywo"]
  };
  for(let i=2;i<=16;i++) aliasy["zdjecie"+i]=["zdjecie"+i,"image"+i,"image_"+i,"image"+String(i).padStart(2,"0"),String("image_"+String(i).padStart(2,"0")),"image_url_"+i,"photo"+i,"picture"+i,"url_zdjecia"+i];
  return Object.keys(aliasy).find(k=>aliasy[k].includes(h))||null;
}
function liczbaImportu(v){
  let s=String(v??"").trim().replace(/\s/g,"").replace(/[^\d,.\-]/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else s=s.replace(",",".");
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function wykryjSeparatorCSV(tekst){
  const probka=String(tekst||"").split(/\r?\n/).slice(0,5).join("\n");
  const liczniki={";":0,",":0,"\t":0};let cytat=false;
  for(let i=0;i<probka.length;i++){
    if(probka[i]==='"'&&probka[i+1]==='"'){i++;continue;}
    if(probka[i]==='"'){cytat=!cytat;continue;}
    if(!cytat&&Object.prototype.hasOwnProperty.call(liczniki,probka[i]))liczniki[probka[i]]++;
  }
  return Object.entries(liczniki).sort((a,b)=>b[1]-a[1])[0][0];
}
function parsujCSVProduktow(tekst){
  tekst=String(tekst||"").replace(/^\uFEFF/,"");
  const sep=wykryjSeparatorCSV(tekst),wiersze=[];let wiersz=[],pole="",cytat=false;
  for(let i=0;i<tekst.length;i++){
    const c=tekst[i];
    if(c==='"'&&cytat&&tekst[i+1]==='"'){pole+='"';i++;continue;}
    if(c==='"'){cytat=!cytat;continue;}
    if(c===sep&&!cytat){wiersz.push(pole);pole="";continue;}
    if((c==="\n"||c==="\r")&&!cytat){
      if(c==="\r"&&tekst[i+1]==="\n")i++;
      wiersz.push(pole);pole="";
      if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
      wiersz=[];continue;
    }
    pole+=c;
  }
  wiersz.push(pole);if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
  if(wiersze.length<2)throw new Error("CSV nie zawiera wierszy produktów");
  const naglowki=wiersze.shift().map(kanonicznePoleProduktu);
  if(!naglowki.includes("nazwa")||!naglowki.includes("cena"))throw new Error("CSV musi zawierać co najmniej kolumny: nazwa i cena");
  return wiersze.map(r=>{const o={};naglowki.forEach((k,i)=>{if(k)o[k]=r[i]??"";});return o;});
}
function tablicaWartosci(v){
  if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);
  return String(v||"").split(/\s*[|,]\s*/).map(x=>x.trim()).filter(Boolean);
}
function czyKolorKarty(v){
  const s=String(v||"").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)||/^rgba?\(/i.test(s)||/^hsla?\(/i.test(s);
}
function rozbijSciezkeKategoriiImportu(v){
  const tekst=String(v||"").trim();
  if(!tekst)return {pelna:"",grupa:"",kategoria:"",poziomy:[]};
  const czesci=tekst.split(/\s*(?:\/|\\|>|»|›|\||::)\s*/).map(x=>x.trim()).filter(Boolean);
  if(czesci.length<=1)return {pelna:tekst,grupa:"",kategoria:tekst,poziomy:[tekst]};
  return {pelna:tekst,grupa:czesci.slice(0,-1).join(" / "),kategoria:czesci.at(-1),poziomy:czesci};
}
function normalizujProduktImportu(r,nr){
  const pobierz=(...nazwy)=>{for(const n of nazwy)if(r?.[n]!==undefined&&r[n]!==null)return r[n];return "";};
  const bledy=[],ostrzezenia=[];
  const nazwa=String(pobierz("nazwa","name","product_name")).trim();
  const kategoriaInfo=rozbijSciezkeKategoriiImportu(pobierz("kategoria","category","katalog"));
  const kategoria=kategoriaInfo.kategoria;
  const cena=liczbaImportu(pobierz("cena","price","sale_price"));
  const idRaw=pobierz("id","product_id"),id=idRaw===""||idRaw===null?null:Number(idRaw);
  if(!nazwa)bledy.push("brak nazwy");
  if(!kategoria)bledy.push("brak kategorii");
  if(cena===null||cena<0)bledy.push("cena musi być liczbą 0 lub większą");
  if(cena===0)ostrzezenia.push("cena 0,00 — produkt zostanie zaimportowany, ale będzie zablokowany do sprzedaży do czasu uzupełnienia ceny");
  if(id!==null&&(!Number.isInteger(id)||id<=0))bledy.push("ID musi być dodatnią liczbą całkowitą");
  const stanRaw=pobierz("stan","stock","quantity","ilosc"),stan=stanRaw===""||stanRaw===null?null:liczbaImportu(stanRaw);
  if(stan!==null&&(!Number.isInteger(stan)||stan<0))bledy.push("stan musi być liczbą całkowitą 0 lub większą");
  const stara=liczbaImportu(pobierz("staraCena","stara_cena","old_price","regular_price"));
  if(stara!==null&&cena!==null&&stara<=cena)ostrzezenia.push("stara cena pominięta, bo nie jest wyższa od ceny");
  const galeria=Array.isArray(r?.zdjecia)?r.zdjecia:Array.isArray(r?.images)?r.images:null;
  const zdjecia=galeria?galeria.map(String).filter(Boolean):Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(k=>String(pobierz(k)).trim()).filter(Boolean);
  const p={id,nazwa,kategoria,cena:cena===null?0:+cena.toFixed(2)};
  for(const pole of ["cenaAllegro","cenaZakupu","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){const value=liczbaImportu(pobierz(pole));if(value!==null&&value>=0)p[pole]=+value.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);}
  if(p.cenaZakupu!==undefined)p.cenaZakupuPrywatna=true;
  if(p.allegroShippingSubsidy===undefined)p.allegroShippingSubsidy=ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI;
  if(kategoriaInfo.poziomy.length>1){
    p.sciezkaKategorii=kategoriaInfo.poziomy;
    p.grupaKategorii=kategoriaInfo.grupa;
    p.kategoriaPelna=kategoriaInfo.pelna;
  }
  if(cena===0)p.wymagaCeny=true;else delete p.wymagaCeny;
  const opisKrotki=String(pobierz("opisKrotki","opis_krotki","short_description","summary")).trim();if(opisKrotki)p.opisKrotki=opisKrotki;
  const opis=String(pobierz("opis","description")).trim();if(opis)p.opis=opis;
  const ikona=String(pobierz("ikona","icon","emoji")).trim();if(ikona)p.ikona=ikona;
  const kolor=String(pobierz("kolor")).trim();if(kolor&&czyKolorKarty(kolor))p.kolor=kolor;
  const kolorProduktu=String(pobierz("kolorProduktu")).trim();if(kolorProduktu)p.kolorProduktu=kolorProduktu;
  if(stara!==null&&stara>cena)p.staraCena=+stara.toFixed(2);
  if(stan!==null)p.stan=stan;
  const gtin=String(pobierz("gtin")).trim();if(gtin)p.gtin=gtin;
  const externalId=String(pobierz("externalId")).trim();if(externalId)p.externalId=externalId;
  const mpn=String(pobierz("mpn")).trim();if(mpn)p.mpn=mpn;
  const rawMarka=String(pobierz("marka")).trim(),marka=normalizujNazweProducenta(rawMarka);if(rawMarka&&!marka)bledy.push("marka musi zawierać co najmniej jedną literę");if(marka)p.marka=marka;
  const rawProducent=String(pobierz("producent")).trim()||rawMarka,producent=normalizujNazweProducenta(rawProducent);if(rawProducent&&!producent)bledy.push("producent musi być nazwą, a nie samym numerem");if(producent)p.producent=producent;
  const rozmiar=String(pobierz("rozmiar")).trim();if(rozmiar)p.rozmiar=rozmiar;
  const material=String(pobierz("material")).trim();if(material)p.material=material;
  const sku=String(pobierz("sku","kod","kod_produktu")).trim()||externalId||mpn||gtin;if(sku)p.sku=sku;
  const badge=String(pobierz("badge","etykieta","label")).trim();if(badge)p.badge=badge;
  const zdjecie=String(pobierz("zdjecie","image","image_url")).trim();if(zdjecie)p.zdjecie=zdjecie;
  if(zdjecia.length)p.zdjecia=zdjecia.slice(0,15);
  const warianty=tablicaWartosci(pobierz("warianty","variants","options"));if(warianty.length)p.warianty=warianty.slice(0,30);
  return {nr,produkt:agentAIPoprawOpisyDanychProduktu(p),bledy,ostrzezenia};
}
function analizujTekstImportu(tekst,nazwa="wklejone dane"){
  try{
    const t=String(tekst||"").trim();if(!t)throw new Error("Brak danych do analizy");
    let surowe,format;
    if(t.startsWith("[")||t.startsWith("{")){
      const j=JSON.parse(t);surowe=Array.isArray(j)?j:(Array.isArray(j.products)?j.products:Array.isArray(j.produkty)?j.produkty:null);format="JSON";
      if(!surowe)throw new Error('JSON musi być tablicą produktów albo obiektem z polem "products"');
    }else{surowe=parsujCSVProduktow(t);format="CSV";}
    if(!surowe.length)throw new Error("Plik nie zawiera produktów");
    if(surowe.length>100000)throw new Error("Jednorazowo można zaimportować maksymalnie 100 000 produktów");
    const wyniki=surowe.map((r,i)=>normalizujProduktImportu(r,i+2));
    const idy=new Map(),sku=new Map(),external=new Map();
    for(const w of wyniki){
      const p=w.produkt;
      if(p.id!==null){if(idy.has(p.id))w.bledy.push(`powtórzone ID ${p.id} (także w wierszu ${idy.get(p.id)})`);else idy.set(p.id,w.nr);}
      if(p.sku){const s=p.sku.toLowerCase();if(sku.has(s))w.bledy.push(`powtórzone SKU ${p.sku} (także w wierszu ${sku.get(s)})`);else sku.set(s,w.nr);}
      if(p.externalId){const s=p.externalId.toLowerCase();if(external.has(s))w.bledy.push(`powtórzone EXTERNAL_ID ${p.externalId} (także w wierszu ${external.get(s)})`);else external.set(s,w.nr);}
    }
    podgladImportuProduktow={
      nazwa,format,wszystkich:wyniki.length,
      produkty:wyniki.filter(w=>!w.bledy.length).map(w=>w.produkt),
      bledy:wyniki.filter(w=>w.bledy.length).map(w=>`Wiersz ${w.nr}: ${w.bledy.join(", ")}`),
      ostrzezenia:wyniki.filter(w=>w.ostrzezenia.length).map(w=>`Wiersz ${w.nr}: ${w.ostrzezenia.join(", ")}`)
    };
    ostatniRaportImportu=null;renderuj();
  }catch(e){
    podgladImportuProduktow={nazwa,format:"—",wszystkich:0,produkty:[],bledy:[e.message],ostrzezenia:[]};
    renderuj();
  }
}
function analizujWklejonyImport(){
  analizujTekstImportu($("importTekstProduktow")?.value||"","wklejone dane");
}
function wczytajPlikImportuProduktow(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>20*1024*1024){toast("⚠️ Maksymalny rozmiar pliku to 20 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>analizujTekstImportu(r.result,plik.name);
  r.onerror=()=>toast("⚠️ Nie udało się odczytać pliku");
  r.readAsText(plik,"UTF-8");
}
function dodajSciezkiKategoriiZImportuDoMenu(lista){
  const importowane=(Array.isArray(lista)?lista:[]).filter(p=>p?.grupaKategorii&&p?.kategoria);
  if(!importowane.length)return 0;
  const grupy=grupyMenuKategorii();let dodane=0;
  const klucz=v=>normalizujSzukanyTekst(v);
  for(const p of importowane){
    const nazwa=String(p.grupaKategorii||"").trim(),kat=String(p.kategoria||"").trim();
    if(!nazwa||!kat)continue;
    let g=grupy.find(x=>klucz(x.nazwa)===klucz(nazwa));
    if(!g){
      g={id:"menu_import_"+prostyHash(nazwa),nazwa,ikona:ikonaKategorii(nazwa),aktywna:true,kategorie:[]};
      grupy.push(g);
    }
    if(!g.kategorie.some(x=>klucz(x)===klucz(kat))){g.kategorie.push(kat);dodane++;}
  }
  if(dodane){
    ustawienia.menuKategorii=grupy.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz||"",ikonaAssetId:g.ikonaAssetId||"",aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
    ustawienia.menuPokazNieprzypisane=true;
  }
  return dodane;
}
async function wykonajImportProduktow(){
  const d=podgladImportuProduktow;if(!d?.produkty?.length){toast("Najpierw przeanalizuj poprawne dane");return;}
  const tryb=$("trybImportuProduktow")?.value||"scal";
  if(tryb!=="scal"){toast("⛔ Zastępowanie całego katalogu zostało wyłączone. Użyj bezpiecznego scalania z centralną kartoteką.");return;}
  const kluczKodu=v=>String(v||"").trim().toLowerCase(),aktywne=produktyDoAdministracji();
  const poSku=new Map(aktywne.filter(p=>p.sku).map(p=>[kluczKodu(p.sku),p]));
  const poExternal=new Map(aktywne.filter(p=>p.externalId).map(p=>[kluczKodu(p.externalId),p]));
  const poEan=new Map(aktywne.filter(p=>p.gtin||p.ean).map(p=>[kluczKodu(p.gtin||p.ean),p]));
  const poId=new Map(aktywne.map(p=>[String(p.id),p]));
  const zajete=new Set(aktywne.map(p=>Number(p.id)).filter(id=>Number.isInteger(id)&&id>0));
  let nastepne=Math.max(1000000,...zajete)+1,dodane=0,zaktualizowane=0;
  const wejscie=d.produkty.map(p=>JSON.parse(JSON.stringify(p))).map(p0=>{
    const istniejacy=(p0.externalId&&poExternal.get(kluczKodu(p0.externalId)))
      ||(p0.sku&&poSku.get(kluczKodu(p0.sku)))
      ||((p0.gtin||p0.ean)&&poEan.get(kluczKodu(p0.gtin||p0.ean)))
      ||(p0.id&&poId.get(String(p0.id)));
    if(istniejacy){p0.id=istniejacy.id;zaktualizowane++;}
    else{
      if(!Number.isInteger(Number(p0.id))||Number(p0.id)<=0||zajete.has(Number(p0.id))){
        while(zajete.has(nastepne))nastepne++;p0.id=nastepne++;
      }
      zajete.add(Number(p0.id));dodane++;
    }
    if(!p0.ikona)p0.ikona="📦";if(!p0.kolor)p0.kolor="#dbeafe";if(p0.opis===undefined)p0.opis="";
    return p0;
  });
  const importId=`catalog-import:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,8)}`;
  const zapisane=[];
  try{
    for(let offset=0;offset<wejscie.length;offset+=200){
      const result=await chmura("catalog-products-import",{method:"POST",body:{products:wejscie.slice(offset,offset+200),importId:`${importId}:${offset}`},timeout:180000});
      if(result?.confirmed!==true)throw new Error(result?.errors?.map(x=>`${x.productId}: ${x.error}`).slice(0,3).join(" • ")||"Serwer nie potwierdził importu.");
      zapisane.push(...(result.products||[]));
    }
  }catch(error){
    loguj("blad",`Import centralnej kartoteki przerwany: ${error.message||error}`);
    toast("⛔ Import przerwany — można go bezpiecznie ponowić: "+(error.message||error));return;
  }
  for(const product of zapisane){
    const id=String(product.id),stan=wejscie.find(p=>String(p.id)===id)?.stan;
    if(Number.isInteger(stan)&&stan>=0)stanyProduktow[id]=stan;
    podmienProduktAdminBezRenderu(id,product,[]);
    if(!aktywne.some(p=>String(p.id)===id))produktyDodane.push(product);
  }
  const menuZImportu=dodajSciezkiKategoriiZImportuDoMenu(wejscie);
  zaznaczoneProdukty.clear();
  zapiszLS("artway_stany",stanyProduktow);
  if(menuZImportu)await chmuraDodajMutacjePolUstawien({menuKategorii:ustawienia.menuKategorii||[],menuPokazNieprzypisane:true});
  await chmuraZapiszUstawienia({flush:true});
  if(typeof asortymentCentralnyWyczyscCache==="function")asortymentCentralnyWyczyscCache();
  zbudujProdukty();odswiezMenu();
  ostatniRaportImportu={dodane,zaktualizowane,pominiete:d.bledy.length,tryb,plik:d.nazwa,menuZImportu};
  podgladImportuProduktow=null;
  loguj("info",`Import produktów: ${dodane} dodanych, ${zaktualizowane} zaktualizowanych, ${d.bledy.length} pominiętych, ${menuZImportu} dopisań do menu`);
  toast(`Import zakończony: +${dodane}, aktualizacje ${zaktualizowane}${menuZImportu?`, menu +${menuZImportu}`:""} ✅`);renderuj();
}
function cofnijOstatniImportProduktow(){
  localStorage.removeItem("artway_ostatnia_kopia_importu");
  toast("Cofanie przez lokalną kopię zostało wyłączone. Centralna kartoteka ma historię mutacji i kopię serwerową.");
}
function produktDoEksportu(p,administracyjny=false){
  const o={id:p.id,nazwa:p.nazwa,kategoria:p.kategoria,cena:+Number(p.cena).toFixed(2)};
  if(p.staraCena>p.cena)o.staraCena=+Number(p.staraCena).toFixed(2);
  const stan=stanProduktu(p);if(stan!==null)o.stan=stan;
  const polaPubliczne=["cenaAllegro","vatRate","sku","gtin","externalId","mpn","marka","producent","opisKrotki","opis","badge","ikona","kolor","kolorProduktu","rozmiar","material","zdjecie"];
  const polaPrywatne=["cenaZakupu","cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuZrodlo","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt","cenaZakupuHistoria","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","allegroFeeCalculatedAt","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent"];
  for(const k of administracyjny?[...polaPubliczne,...polaPrywatne]:polaPubliczne)if(p[k]!==undefined&&p[k]!=="")o[k]=p[k];
  if(p.wymagaCeny)o.wymagaCeny=true;
  if(Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length)o.sciezkaKategorii=p.sciezkaKategorii;
  if(p.grupaKategorii)o.grupaKategorii=p.grupaKategorii;
  if(p.kategoriaPelna)o.kategoriaPelna=p.kategoriaPelna;
  if(p.zdjecia?.length)o.zdjecia=p.zdjecia.slice(0,15);
  if(p.warianty?.length)o.warianty=p.warianty;
  return o;
}
function zakresEksportuProduktow(zakres,administracyjny=false){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  let lista=[...produkty];
  if(zakres==="zaznaczone")lista=lista.filter(p=>zaznaczoneProdukty.has(p.id));
  if(zakres==="kategoria"){const k=$("kategoriaEksportuProduktow")?.value||"";lista=lista.filter(p=>p.kategoria===k);}
  return lista.map(p=>produktDoEksportu(p,administracyjny));
}
function nazwaZakresuEksportu(zakres){
  if(zakres==="zaznaczone")return "zaznaczone";
  if(zakres==="kategoria")return normalizujNaglowekCSV($("kategoriaEksportuProduktow")?.value||"kategoria");
  return "widoczne";
}
function eksportujProduktyJSON(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const nazwa=zakres==="widoczne"?"products.json":`products-${nazwaZakresuEksportu(zakres)}.json`;
  pobierzPlik(nazwa,JSON.stringify(lista,null,2),"application/json");
  if(zakres==="widoczne")localStorage.setItem("artway_produkty_export_hash",prostyHash(JSON.stringify(lista)));
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(zakres==="widoczne"?"Pobrano products.json — wgraj go na hosting ✅":`Wyeksportowano ${lista.length} produktów`);
}
function eksportujProduktyCSV(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres,true);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty.csv":`produkty-${nazwaZakresuEksportu(zakres)}.csv`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);toast(`Wyeksportowano ${lista.length} produktów do CSV`);
}
function eksportujProduktyPoIdCSV(ids,nazwa="produkty-filtrowane.csv"){
  const wybrane=new Set((Array.isArray(ids)?ids:[]).map(String));
  const lista=produktyDoAdministracji().filter(p=>wybrane.has(String(p.id))).map(p=>produktDoEksportu(p,true));
  if(!lista.length){toast("Brak produktów do eksportu");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${lista.length} produktów z aktualnego wyboru`);toast(`Wyeksportowano ${lista.length} produktów ✅`);
}
function wartoscPolaCSVProduktu(p,pole){
  if(pole==="stara_cena")return p.staraCena?String(p.staraCena.toFixed(2)).replace(".",","):"";
  if(pole==="cena")return String(Number(p.cena||0).toFixed(2)).replace(".",",");
  if(pole==="external_id")return p.externalId||"";
  const financial={cena_allegro:"cenaAllegro",cena_zakupu:"cenaZakupu",prowizja_allegro:"allegroCommissionAmount",prowizja_allegro_procent:"allegroCommissionRate",oplaty_allegro_cykliczne:"allegroRecurringFees",koszt_pakowania:"kosztPakowania",koszt_dodatkowy_sklepu:"sklepAdditionalCost",platnosc_sklepu_procent:"sklepPaymentPercent",koszt_dodatkowy_allegro:"allegroAdditionalCost",doplata_wysylki_allegro:"allegroShippingSubsidy",reklama_allegro_procent:"allegroAdsPercent",vat:"vatRate"};
  if(financial[pole])return p[financial[pole]]??"";
  if(pole==="opis_krotki")return p.opisKrotki||opisKrotkiProduktu(p)||"";
  if(pole==="kolor_produktu")return p.kolorProduktu||"";
  if(pole==="warianty")return (p.warianty||[]).join(" | ");
  if(pole==="stan")return p.stan??"";
  if(pole==="zdjecie")return p.zdjecie||"";
  const m=String(pole).match(/^zdjecie(\d+)$/);
  if(m)return (p.zdjecia||[])[Number(m[1])-2]||"";
  return p[pole]??"";
}
function wartoscPolaOVF(p,pole){
  const zdj=[p.zdjecie||"",...(p.zdjecia||[])];
  const kategoriaPelna=Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length?p.sciezkaKategorii.join("/"):p.kategoriaPelna||p.kategoria||"";
  const mapa={
    GTIN:p.gtin||"",
    EXTERNAL_ID:p.externalId||p.sku||String(p.id||""),
    NAME:p.nazwa||"",
    STOCK:p.stan??"",
    PRICE:p.cena!==undefined?String(Number(p.cena||0).toFixed(2)).replace(".",","):"",
    MPN:p.mpn||p.sku||"",
    DESCRIPTION:p.opis||"",
    CATEGORY:kategoriaPelna,
    BRAND:p.marka||"",
    MANUFACTURER:p.producent||p.marka||"",
    COLOR:p.kolorProduktu||"",
    SIZE:p.rozmiar||(p.warianty||[]).join(" | "),
    MATERIAL:p.material||""
  };
  const img=String(pole).match(/^IMAGE(\d+)$/);
  return img ? (zdj[Number(img[1])-1]||"") : (mapa[pole]??"");
}
function eksportujProduktyOVF(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_OVF_PRODUKTU.join(","),...lista.map(p=>POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(","))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty-ovf.xls":`produkty-ovf-${nazwaZakresuEksportu(zakres)}.xls`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(`Wyeksportowano ${lista.length} produktów w formacie OVF`);
}
function pobierzSzablonProduktowCSV(){
  const p={id:1,nazwa:"Przykładowa gra",kategoria:"Gry edukacyjne",cena:99.90,cenaAllegro:109.90,cenaZakupu:55,allegroCommissionAmount:11,allegroCommissionRate:10,allegroRecurringFees:0,kosztPakowania:1.5,sklepAdditionalCost:0,sklepPaymentPercent:1.5,allegroAdditionalCost:0,allegroShippingSubsidy:3,allegroAdsPercent:0,vatRate:23,staraCena:129.90,stan:25,sku:"SKU-001",gtin:"5901234567891",externalId:"EXT-001",mpn:"MPN-001",marka:"Marka",producent:"Producent",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis produktu z najważniejszymi cechami.",badge:"Nowość",ikona:"🎲",zdjecie:"https://adres.pl/zdjecie.jpg",warianty:["S","M","L"],kolor:"#dbeafe",kolorProduktu:"Kolorowy",rozmiar:"XL",material:"Karton"};
  pobierzPlik("szablon-importu-produktow.csv","\uFEFF"+POLA_CSV_PRODUKTU.join(";")+"\n"+POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"),"text/csv");
}
function pobierzSzablonProduktowOVF(){
  const p={id:1,nazwa:"Przykładowa gra edukacyjna",kategoria:"Gry edukacyjne",cena:99.90,stan:25,sku:"GRA-001",externalId:"GRA-001",gtin:"5901234567891",mpn:"GRA-001",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis będzie widoczny na stronie produktu, a na listach pojawi się skrót.",zdjecie:"https://adres.pl/zdjecie1.jpg",zdjecia:["https://adres.pl/zdjecie2.jpg"],marka:"Artway",producent:"Artway",kolorProduktu:"Kolorowy",rozmiar:"30x20x5 cm",material:"Karton"};
  const csv=POLA_OVF_PRODUKTU.join(",")+"\n"+POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(",");
  pobierzPlik("ovf-template-dla-rozszerzonego-pliku-csv-dane.xls","\uFEFF"+csv,"text/csv");
}
