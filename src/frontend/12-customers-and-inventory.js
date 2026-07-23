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
  const zarzadzaDostepem=jestGlownymAdminem(sesja?.email),operacjaWToku=zmianyDostepuUzytkownikowWToku.has(k.email)||usunieciaUzytkownikowWToku.has(k.email);
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
      ${polaKartotekiHTML(k, {edycja:true, blokujEmail:true, bezHasla:!zarzadzaDostepem||sesja?.email===k.email})}
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz kartotekę</button>
        ${!zarzadzaDostepem||glowny||sesja?.email===k.email?"":`<button class="btn ghost" type="button" ${operacjaWToku?"disabled":""} onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')">${operacjaWToku?"⏳ Zapisuję…":admin?"🔒 Odbierz rolę administratora":"🛡️ Nadaj rolę administratora"}</button>`}
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
let frazaMagazynu="", filtrMagazynu="na-stanie", filtrDostawcyMagazynu="wszyscy", filtrLokalizacjiMagazynu="wszystkie", filtrInwentaryzacjiMagazynu="wszystkie", sortowanieMagazynu="stan-malejaco", stronaMagazynu=1, szukajProducentowMagazynu="", filtrProducentowMagazynu="wszystkie", sortowanieProducentowMagazynu="priorytet", stronaDostepnosciProducentow=1;
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
  else if(nazwa==="link")filtrLinkuProduktow=v||"wszystkie";
  else if(nazwa==="cenaOd")cenaOdAdminProduktow=v;
  else if(nazwa==="cenaDo")cenaDoAdminProduktow=v;
  else if(nazwa==="cenaAllegroOd")cenaAllegroOdAdminProduktow=v;
  else if(nazwa==="cenaAllegroDo")cenaAllegroDoAdminProduktow=v;
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
  else if(nazwa==="link")filtrLinkuProduktow="wszystkie";
  else if(nazwa==="cena"){cenaOdAdminProduktow="";cenaDoAdminProduktow="";}
  else if(nazwa==="cenaAllegro"){cenaAllegroOdAdminProduktow="";cenaAllegroDoAdminProduktow="";}
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
