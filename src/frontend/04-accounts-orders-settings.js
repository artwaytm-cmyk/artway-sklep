/* ═══════════ KONTA UŻYTKOWNIKÓW ═══════════
   Lokalna pamięć jest cache. Źródłem wspólnym dla urządzeń jest API serwerowe. */
function pobierzUzytkownikow(){ return wczytajLS("artway_uzytkownicy", []); }
function prostyHash(s){ let h=5381; for(const c of s){ h=((h<<5)+h+c.charCodeAt(0))>>>0; } return "h"+h.toString(16); }
async function hashuj(s){
  try{
    if(crypto?.subtle){
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
    }
  }catch(e){}
  return prostyHash(s);
}
async function zarejestrujUzytkownika(imie, email, haslo){
  imie=imie.trim(); email=email.trim().toLowerCase();
  if(!imie || !email.includes("@")) return {ok:false, blad:"Podaj poprawne imię i adres e-mail."};
  if(haslo.length<6) return {ok:false, blad:"Hasło musi mieć co najmniej 6 znaków."};
  const u = pobierzUzytkownikow();
  if(u.some(x=>x.email===email)) return {ok:false, blad:"Konto z tym adresem już istnieje — zaloguj się."};
  const rekord={ imie, email, hash: await hashuj(haslo), rola:"klient", account:true, data:new Date().toISOString() };
  try{
    // konto zakładane we WSPÓLNEJ bazie — działa na każdym urządzeniu
    await chmura("account-register",{method:"POST",body:{user:rekord}});
    stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
  }catch(bl){
    if(bl.code==="exists") return {ok:false, blad:"Konto z tym adresem już istnieje — zaloguj się."};
    loguj("ostrzezenie","Serwer kont niedostępny — konto zapisane lokalnie: "+bl.message);
  }
  u.push(rekord);
  zapiszLS("artway_uzytkownicy", u);
  loguj("info","Zarejestrowano użytkownika: "+email);
  return {ok:true};
}
async function sprawdzLogowanie(email, haslo){
  email=email.trim().toLowerCase();
  const adminEmail=KONFIG.emailAdmina.toLowerCase();
  // 1) ADMINISTRATOR — hasłem jest token wspólnej bazy (ARTWAY_ADMIN_TOKEN).
  //    Weryfikacja NA SERWERZE → działa na każdym urządzeniu i od razu łączy wspólną bazę.
  if(email==="admin" || email===adminEmail){
    try{
      await chmura("login",{method:"POST",body:{password:haslo}});
      chmuraToken=haslo; zapiszLS("artway_chmura_token",chmuraToken);
      const lista=pobierzUzytkownikow(); const a=lista.find(x=>x.email===adminEmail);
      if(a){ a.hash=""; zapiszLS("artway_uzytkownicy",lista); }
      domyslneHasloAdmina=false;
      chmuraStan={...chmuraStan,dostepna:true,admin:true};
      await synchronizujBazeCentralna(true).catch(()=>{});
      return {ok:true, uzytkownik:{imie:"Administrator", email:adminEmail, rola:"admin"}};
    }catch(bl){
      // serwer niedostępny lub złe hasło → spróbuj lokalnego admin/admin (tryb offline)
    }
  }
  const emailDocelowy = (email==="admin") ? adminEmail : email;
  const hash = await hashuj(haslo);
  // 2) KLIENT — logowanie do konta we WSPÓLNEJ bazie
  if(email!=="admin"){
    try{
      const d=await chmura("account-login",{method:"POST",body:{email:emailDocelowy,hash}});
      const serwer=d.user||{}; const lista=pobierzUzytkownikow(); const lok=lista.find(x=>x.email===serwer.email);
      if(lok) Object.assign(lok,serwer,{hash}); else lista.push({...serwer,hash});
      zapiszLS("artway_uzytkownicy",lista);
      stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
      return {ok:true, uzytkownik:{imie:serwer.imie||serwer.email, email:serwer.email, rola:serwer.rola||"klient"}};
    }catch(bl){ /* serwer niedostępny lub konto tylko lokalne → sprawdzamy lokalnie */ }
  }
  // 3) Awaryjne logowanie lokalne (offline / stare konta)
  const u = pobierzUzytkownikow().find(x=>x.email===emailDocelowy);
  if(!u) return {ok:false, blad:"Nieprawidłowy e-mail lub hasło."};
  if(u.hash !== hash) return {ok:false, blad:"Nieprawidłowe hasło."};
  return {ok:true, uzytkownik:{imie:u.imie, email:u.email, rola:u.rola||"klient"}};
}
function ustawSesje(u){ sesja=u; zapiszLS("artway_sesja", u); odswiezUzytkownika(); }
function wyloguj(){ chmuraToken=""; zapiszLS("artway_chmura_token",""); chmuraStan={...chmuraStan,admin:false}; stanBramki={...stanBramki,authenticated:false}; ustawSesje(null); toast("Wylogowano 👋"); location.hash="#/"; }
function jestGlownymAdminem(email){ return String(email||"").toLowerCase()===KONFIG.emailAdmina.toLowerCase(); }
function kontoMaRoleAdmin(email){
  const e=String(email||"").toLowerCase();
  return jestGlownymAdminem(e)||pobierzUzytkownikow().some(u=>u.email===e&&u.rola==="admin");
}
function jestAdmin(){ return !!sesja&&kontoMaRoleAdmin(sesja.email); }
function odswiezUzytkownika(){
  const nazwaSesji=sesja ? String(sesja.imie||sesja.login||sesja.email||"Konto").trim() : "";
  $("userBtn").textContent = sesja ? "👤 "+(nazwaSesji.split(/\s+/)[0]||"Konto") : "👤 Zaloguj";
  $("userBtn").href = sesja ? "#/konto" : "#/logowanie";
  const widokKlienta=!jestAdmin();
  if($("favoritesBtn")) $("favoritesBtn").style.display=widokKlienta?"":"none";
  if($("ordersBtn")) $("ordersBtn").style.display=widokKlienta?"":"none";
  document.querySelectorAll('[data-page-link="ulubione"],[data-page-link="zamowienia"]').forEach(a=>a.style.display=widokKlienta?"":"none");
  const d = $("diagLink"); if(d) d.style.display = jestAdmin() ? "" : "none";
  odswiezMenu();
}
/* Górne menu = strony główne sklepu: katalogi produktów + Promocje + Nowości */
function wszystkieKategorie(){
  const zProduktow = [...new Set(produkty.map(p=>p.kategoria))];
  const ukryte = ustawienia.ukryteKategorie || [];
  const wlasne = (ustawienia.wlasneKategorie||[]).filter(k=>!ukryte.includes(k));
  return [...new Set([...zProduktow, ...wlasne])];
}
function liczbaProduktowWKategorii(k){ return produkty.filter(p=>p.kategoria===k).length; }
function grupyMenuKategorii(){
  return (Array.isArray(ustawienia.menuKategorii)?ustawienia.menuKategorii:[])
    .map((g,i)=>({
      id:String(g.id||("grp_"+i+"_"+prostyHash(String(g.nazwa||i)))),
      nazwa:String(g.nazwa||"Grupa katalogów").trim()||"Grupa katalogów",
      ikona:String(g.ikona||"🗂️").trim()||"🗂️",
      aktywna:g.aktywna!==false,
      kategorie:[...new Set((Array.isArray(g.kategorie)?g.kategorie:[]).map(x=>String(x).trim()).filter(Boolean))]
    }));
}
function zapiszGrupyMenuKategorii(lista, ekstra={}){
  ustawienia.menuKategorii=lista.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
  zapiszCzescUstawien({menuKategorii:ustawienia.menuKategorii,...ekstra});
}
function kategoriePrzypisaneDoAktywnychGrup(kategorie){
  const dozwolone=new Set(kategorie);
  return new Set(grupyMenuKategorii().filter(g=>g.aktywna).flatMap(g=>g.kategorie.filter(k=>dozwolone.has(k))));
}
function linkKategoriiMenu(k){
  return `<a href="#/kategoria/${encodeURIComponent(k)}"><span>${esc(k)}</span><span class="nav-count">${liczbaProduktowWKategorii(k)}</span></a>`;
}
function dropdownMenuKategorii(label, dzieci, ikona="🗂️"){
  if(!dzieci.length) return "";
  return `<span class="nav-dd"><button class="nav-drop-btn" type="button">${esc(ikona)} ${esc(label)} ▾</button><span class="nav-menu">${dzieci.map(linkKategoriiMenu).join("")}</span></span>`;
}
function odswiezMenu(){
  const n = $("mainNav"); if(!n) return;
  const kategorie = wszystkieKategorie();
  const grupy = grupyMenuKategorii();
  const grupyHTML = grupy.filter(g=>g.aktywna).map(g=>dropdownMenuKategorii(g.nazwa, g.kategorie.filter(k=>kategorie.includes(k)), g.ikona)).join("");
  const przypisane = kategoriePrzypisaneDoAktywnychGrup(kategorie);
  const bezGrup = kategorie.filter(k=>!przypisane.has(k));
  const pokazBezGrup = ustawienia.menuPokazNieprzypisane!==false;
  const bezGrupHTML = pokazBezGrup
    ? (grupy.length && bezGrup.length>4
      ? dropdownMenuKategorii("Pozostałe", bezGrup, "📁")
      : bezGrup.slice(0,grupy.length?8:10).map(k=>`<a href="#/kategoria/${encodeURIComponent(k)}">${esc(k)}</a>`).join("") + (bezGrup.length>(grupy.length?8:10)?dropdownMenuKategorii("Więcej", bezGrup.slice(grupy.length?8:10), "📁"):""))
    : "";
  n.innerHTML = `<a href="#/">🏪 Strona główna</a>`
    + grupyHTML
    + bezGrupHTML
    + `<a href="#/promocje">🔥 Promocje</a><a href="#/nowosci">✨ Nowości</a>`
    + (jestAdmin()?`<a href="#/admin" style="color:var(--brand2)">⚙️ Panel admina</a>`:"");
}
function odswiezUlubioneLicznik(){
  const e = $("ulubCount"); if(!e) return;
  e.textContent = ulubione.length;
  e.style.display = !jestAdmin()&&ulubione.length ? "" : "none";
}
/* Lokalne konto administratora służy wyłącznie do podglądu developerskiego.
   Na opublikowanej stronie login „admin” korzysta z hasła w api/config.php. */
let domyslneHasloAdmina = false;
async function zainicjujAdmina(){
  const u = pobierzUzytkownikow();
  const email = KONFIG.emailAdmina.toLowerCase();
  let admin = u.find(x=>x.email===email);
  if(!admin){
    admin = { imie:"Administrator", email, hash: await hashuj("admin"), rola:"admin", data:new Date().toISOString() };
    u.push(admin); zapiszLS("artway_uzytkownicy", u);
    loguj("info","Utworzono konto administratora (login: admin, hasło: admin). Zmień hasło po pierwszym logowaniu!");
  }
  if(admin.rola!=="admin"){ admin.rola="admin"; zapiszLS("artway_uzytkownicy",u); }
  domyslneHasloAdmina = admin.hash === await hashuj("admin");
}
async function zmienHaslo(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const nowe=String(f.get("nowe")||""),powtorz=String(f.get("nowe2")||"");
  if(nowe.length<6){ toast("⚠️ Nowe hasło musi mieć min. 6 znaków"); return; }
  if(nowe!==powtorz){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  try{
    await wywolajBramke("account-password-change",{method:"POST",body:{current_password:String(f.get("stare")||""),new_password:nowe}});
  }catch(bl){
    const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
    if(!lokalnyPodglad){toast("⚠️ Nie zmieniono hasła: "+bl.message);return;}
    const w = await sprawdzLogowanie(sesja.email, f.get("stare"));
    if(!w.ok){ toast("⚠️ Obecne hasło nieprawidłowe"); return; }
  }
  const u = pobierzUzytkownikow(); const ja = u.find(x=>x.email===sesja.email);
  if(ja){ja.hash = await hashuj(nowe);zapiszLS("artway_uzytkownicy", u);}
  if(jestGlownymAdminem(sesja.email)) domyslneHasloAdmina = nowe==="admin";
  loguj("info","Zmieniono hasło konta: "+sesja.email);
  toast("Hasło zmienione ✅"); e.target.reset();
}

/* ═══════════ ZAMÓWIENIA ═══════════ */
function pobierzZamowienia(){ return filtrujAktywneZamowienia(wczytajLS("artway_zamowienia", [])); }
function zapiszZamowienie(z){
  if(czyZamowienieUsuniete(z?.nr)){ loguj("ostrzezenie","Pominięto zapis wcześniej usuniętego zlecenia "+(z?.nr||"")); return false; }
  const t=pobierzZamowienia(); const i=t.findIndex(x=>x.nr===z.nr);
  if(i>=0) t[i]={...t[i],...z}; else t.unshift(z);
  zapiszLS("artway_zamowienia", t); return true;
}

/* ═══════════ USTAWIENIA SKLEPU (panel admina → Ustawienia) ═══════════
   Zapisywane w tej przeglądarce (artway_ustawienia) i nakładane na KONFIG.
   Zmieniają: nazwę sklepu, pasek u góry, stopkę, telefon, bramkę
   płatności, koszty dostaw, opłatę pobrania i kody rabatowe.          */
function zastosujUstawienia(){
  const u = ustawienia || {};
  if(u.nazwaSklepu) KONFIG.nazwaSklepu = u.nazwaSklepu;
  if(u.pasekInfo!==undefined && u.pasekInfo!=="") KONFIG.pasekInfo = u.pasekInfo;
  if(u.czasWysylki!==undefined && u.czasWysylki!=="") KONFIG.czasWysylki = String(u.czasWysylki).trim();
  else {
    const czasZPaska=wykryjCzasWysylkiZTekstu(u.pasekInfo||KONFIG.pasekInfo);
    if(czasZPaska) KONFIG.czasWysylki=czasZPaska;
  }
  if(u.telefon) KONFIG.telefon = u.telefon;
  if(u.opisSklepu) KONFIG.opisSklepu = u.opisSklepu;
  if(u.emailSklepu) KONFIG.emailSklepu = u.emailSklepu;
  if(u.daneFirmy && typeof u.daneFirmy==="object") KONFIG.daneFirmy = {...DANE_FIRMY_DOMYSLNE, ...u.daneFirmy};
  else KONFIG.daneFirmy = {...DANE_FIRMY_DOMYSLNE, ...(KONFIG.daneFirmy||{})};
  if(u.linkPlatnosci!==undefined) KONFIG.linkPlatnosci = u.linkPlatnosci;
  if(u.numerPrzelewuTelefon!==undefined) ustawNumerPrzelewuTelefon(u.numerPrzelewuTelefon);
  else ustawNumerPrzelewuTelefon(KONFIG.numerPrzelewuTelefon);
  if(u.darmowaDostawaOd!==undefined && u.darmowaDostawaOd!=="") KONFIG.darmowaDostawaOd = +u.darmowaDostawaOd;
  KONFIG.kurierInpostAktywny = true; // wymuszone: klient zawsze ma Paczkomat i Kurier InPost
  if(Array.isArray(u.dostawy) && u.dostawy.length) KONFIG.dostawy = normalizujDostawyInPost(u.dostawy.map(x=>({...x})));
  else KONFIG.dostawy = normalizujDostawyInPost(KONFIG.dostawy);
  if(Array.isArray(u.platnosci) && u.platnosci.length) KONFIG.platnosci = u.platnosci.map(x=>({...x}));
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  ustawienia.dostawy = KONFIG.dostawy.map(x=>({...x}));
  ustawienia.platnosci = KONFIG.platnosci.map(x=>({...x}));
  ustawienia.numerPrzelewuTelefon = KONFIG.numerPrzelewuTelefon;
  ustawienia.daneFirmy = {...daneFirmy()};
  const paczkomat = KONFIG.dostawy.find(d=>d.id==="paczkomat");
  const kurierInpost = KONFIG.dostawy.find(d=>d.id==="kurier_inpost");
  if(paczkomat && u.kosztPaczkomat!==undefined && u.kosztPaczkomat!==""){
    const kosztPaczkomat = Number(String(u.kosztPaczkomat).replace(",","."));
    if(Number.isFinite(kosztPaczkomat)) paczkomat.koszt = +kosztPaczkomat.toFixed(2);
  }
  if(kurierInpost && u.kosztKurierInpost!==undefined && u.kosztKurierInpost!==""){
    const kosztKurier = Number(String(u.kosztKurierInpost).replace(",","."));
    if(Number.isFinite(kosztKurier)) kurierInpost.koszt = +kosztKurier.toFixed(2);
  }
  ustawienia.dostawy = KONFIG.dostawy.map(x=>({...x}));
  ustawienia.kurierInpostAktywny = true;
  const pobranie = KONFIG.platnosci.find(p=>p.id==="pobranie"), paynow = KONFIG.platnosci.find(p=>p.id==="paynow"), telefon = KONFIG.platnosci.find(p=>p.id==="telefon");
  if(pobranie && u.oplataPobranie!==undefined && u.oplataPobranie!=="") pobranie.oplata = +u.oplataPobranie;
  if(pobranie && u.pobranieWl!==undefined) pobranie.wylaczona = !u.pobranieWl;
  if(paynow && u.paynowWl!==undefined) paynow.wylaczona = !u.paynowWl;
  if(telefon && u.telefonWl!==undefined) telefon.wylaczona = !u.telefonWl;
  if(telefon) telefon.nazwa = `Przelew na telefon ${formatTelefonPlatnosci()}`;
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  ustawienia.platnosci = KONFIG.platnosci.map(x=>({...x}));
  if(u.kody) KONFIG.kodyRabatowe = {...u.kody};
  if(u.heroTytul) KONFIG.heroTytul = u.heroTytul;
  if(u.heroOpis) KONFIG.heroOpis = u.heroOpis;
  if(Object.prototype.hasOwnProperty.call(u,"tresci")){ KONFIG.tresci = migrujTresciPrawne(u.tresci); ustawienia.tresci = KONFIG.tresci; }
  const ukl = u.uklad || {};
  const szer = ["1100px","1200px","1400px"].includes(ukl.szerokosc) ? ukl.szerokosc : "1200px";
  const karta = ["200px","240px","280px"].includes(ukl.kartaMin) ? ukl.kartaMin : "240px";
  const promien = ["10px","16px","22px"].includes(ukl.promien) ? ukl.promien : "16px";
  document.documentElement.style.setProperty("--content",szer);
  document.documentElement.style.setProperty("--card-min",karta);
  document.documentElement.style.setProperty("--radius",promien);
  document.body.dataset.density = ukl.gestosc || "standard";
  const klasy = {
    "header-static":ukl.statycznyNaglowek===true,
    "hide-home-categories":ukl.sekcjaKategorie===false,
    "hide-home-steps":ukl.sekcjaKroki===false,
    "hide-home-about":ukl.sekcjaOnas===false,
    "hide-home-faq":ukl.sekcjaFaq===false,
    "hide-home-contact":ukl.sekcjaKontakt===false
  };
  Object.entries(klasy).forEach(([k,v])=>document.body.classList[v?"add":"remove"](k));
  // odświeżenie stałych elementów strony
  const n = KONFIG.nazwaSklepu, i = n.indexOf("-");
  $("logoA").innerHTML = ustawienia.logoObraz
    ? `<img src="${ustawienia.logoObraz}" alt="${esc(n)}" style="height:36px;display:block;max-width:190px;object-fit:contain">`
    : (i>0 ? esc(n.slice(0,i))+"<span>"+esc(n.slice(i))+"</span>" : "<span>"+esc(n)+"</span>");
  $("topbar").innerHTML = pasekInfoHTML();
  document.title = u.seo?.tytul || KONFIG.nazwaSklepu + " — Sklep internetowy";
  const metaOpis=document.querySelector('meta[name="description"]');
  if(metaOpis&&u.seo?.opis)metaOpis.setAttribute("content",u.seo.opis);
  $("footNazwa").textContent = KONFIG.nazwaSklepu;
  $("footOpis").textContent = KONFIG.opisSklepu;
  $("footMail").textContent = "✉️ " + KONFIG.emailSklepu;
  $("footMail").href = "mailto:" + KONFIG.emailSklepu;
  $("footTel").textContent = "📞 " + KONFIG.telefon;
  $("topbar").style.display = u.uklad?.pasekInfoWidoczny===false ? "none" : "";
  $("searchInput").placeholder = u.tekstSzukaj || "Szukaj produktu…";
  $("footCopy").textContent = u.stopkaCopy || `© ${new Date().getFullYear()} ${KONFIG.nazwaSklepu}. Wszystkie prawa zastrzeżone.`;
  aktualizujFavicon();
  document.querySelectorAll("[data-page-link]").forEach(a=>{
    a.style.display = ustawieniaPodstrony(a.dataset.pageLink).widoczna===false ? "none" : "";
  });
  if(jestAdmin()) document.querySelectorAll('[data-page-link="ulubione"],[data-page-link="zamowienia"]').forEach(a=>a.style.display="none");
}
