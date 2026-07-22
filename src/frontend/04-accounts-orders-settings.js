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
  if(haslo.length<8) return {ok:false, blad:"Hasło musi mieć co najmniej 8 znaków."};
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  try{
    const d=await chmura("account-register",{method:"POST",body:{user:{imie,email},password:haslo}});
    const rekord={...(d.user||{imie,email,rola:"klient"}),verified:d.authenticated===true};
    const u=pobierzUzytkownikow(),i=u.findIndex(x=>x.email===email);
    if(i>=0)u[i]={...u[i],imie:rekord.imie,email:rekord.email,rola:rekord.rola,account:true};else u.push({imie:rekord.imie,email:rekord.email,rola:rekord.rola,account:true});
    zapiszLS("artway_uzytkownicy",u);
    stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
    loguj("info","Zarejestrowano użytkownika: "+email);
    return {ok:true,uzytkownik:rekord};
  }catch(bl){
    if(bl.code==="exists") return {ok:false, blad:"Konto z tym adresem już istnieje — zaloguj się."};
    if(!lokalnyPodglad) return {ok:false,blad:"Nie udało się bezpiecznie utworzyć konta: "+bl.message};
    const u=pobierzUzytkownikow();
    if(u.some(x=>x.email===email)) return {ok:false,blad:"Konto z tym adresem już istnieje — zaloguj się."};
    const rekord={imie,email,hash:await hashuj(haslo),rola:"klient",account:true,data:new Date().toISOString()};
    u.push(rekord);zapiszLS("artway_uzytkownicy",u);
    return {ok:true,uzytkownik:{imie,email,rola:"klient"}};
  }
}
async function sprawdzLogowanie(email, haslo){
  email=email.trim().toLowerCase();
  const adminEmail=KONFIG.emailAdmina.toLowerCase();
  // 1) ADMINISTRATOR — hasłem jest token wspólnej bazy (ARTWAY_ADMIN_TOKEN).
  //    Weryfikacja NA SERWERZE → działa na każdym urządzeniu i od razu łączy wspólną bazę.
  if(email==="admin" || email===adminEmail){
    try{
      const d=await chmura("login",{method:"POST",body:{password:haslo,email:adminEmail}});
      if(d.mfaRequired)return {ok:true,mfa:d};
      chmuraToken=""; sessionStorage.removeItem("artway_chmura_token"); localStorage.removeItem("artway_chmura_token");
      const lista=pobierzUzytkownikow(); const a=lista.find(x=>x.email===adminEmail);
      if(a){ a.hash=""; zapiszLS("artway_uzytkownicy",lista); }
      domyslneHasloAdmina=false;
      chmuraStan={...chmuraStan,dostepna:true,admin:true};
      const serwer=d.user||{};
      return {ok:true, uzytkownik:{imie:serwer.imie||"Administrator",email:serwer.email||adminEmail,rola:"admin",verified:true}};
    }catch(bl){
      // serwer niedostępny lub złe hasło → spróbuj lokalnego admin/admin (tryb offline)
    }
  }
  const emailDocelowy = (email==="admin") ? adminEmail : email;
  // 2) KLIENT — logowanie do konta we WSPÓLNEJ bazie
  if(email!=="admin"){
    try{
      const d=await chmura("account-login",{method:"POST",body:{email:emailDocelowy,password:haslo}});
      if(d.mfaRequired)return {ok:true,mfa:d};
      const serwer=d.user||{}; const lista=pobierzUzytkownikow(); const lok=lista.find(x=>x.email===serwer.email);
      if(lok) Object.assign(lok,serwer,{hash:""}); else lista.push({...serwer,hash:""});
      zapiszLS("artway_uzytkownicy",lista);
      stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
      return {ok:true, uzytkownik:{imie:serwer.imie||serwer.email,email:serwer.email,rola:serwer.rola||"klient",verified:true}};
    }catch(bl){
      const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
      if(!lokalnyPodglad) return {ok:false,blad:bl.message||"Nieprawidłowy e-mail lub hasło."};
    }
  }
  // 3) Awaryjne logowanie lokalne (offline / stare konta)
  const hash = await hashuj(haslo);
  const u = pobierzUzytkownikow().find(x=>x.email===emailDocelowy);
  if(!u) return {ok:false, blad:"Nieprawidłowy e-mail lub hasło."};
  if(u.hash !== hash) return {ok:false, blad:"Nieprawidłowe hasło."};
  return {ok:true, uzytkownik:{imie:u.imie, email:u.email, rola:u.rola||"klient"}};
}
function ustawSesje(u){
  if(u){u={...u};delete u.token;u.verified=u.verified===true;}
  sesja=u; zapiszLS("artway_sesja",u); odswiezUzytkownika();
}
function wyloguj(){ void chmura("session-logout",{method:"POST",timeout:5000}).catch(()=>{});chmuraToken=""; try{sessionStorage.removeItem("artway_chmura_token");localStorage.removeItem("artway_chmura_token");}catch(e){} chmuraStan={...chmuraStan,admin:false}; stanBramki={...stanBramki,authenticated:false}; ustawSesje(null); toast("Wylogowano 👋"); location.hash="#/"; }
function jestGlownymAdminem(email){ return String(email||"").toLowerCase()===KONFIG.emailAdmina.toLowerCase(); }
function kontoMaRoleAdmin(email){
  const e=String(email||"").toLowerCase();
  return jestGlownymAdminem(e)||pobierzUzytkownikow().some(u=>u.email===e&&u.rola==="admin");
}
function jestAdmin(){
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  return !!sesja&&kontoMaRoleAdmin(sesja.email)&&(!!chmuraToken||sesja.verified===true||!!sesja.token||lokalnyPodglad);
}
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
  const zCentralnej=(typeof sklepKatalogCentralnyFacety!=="undefined"&&Array.isArray(sklepKatalogCentralnyFacety.categories))?sklepKatalogCentralnyFacety.categories.map(item=>item.value):[];
  const ukryte = ustawienia.ukryteKategorie || [];
  const wlasne = (ustawienia.wlasneKategorie||[]).filter(k=>!ukryte.includes(k));
  return [...new Set([...zProduktow, ...zCentralnej, ...wlasne])];
}
let indeksDrzewaKategoriiCache={products:null,parents:null,signature:"",value:null};
function indeksDrzewaKategoriiMenu(kategorie=wszystkieKategorie()){
  const lista=[...new Set((kategorie||[]).map(x=>String(x||"").trim()).filter(Boolean))],signature=lista.join("\u0001"),parentsSource=ustawienia.rodziceKategorii||null;
  if(indeksDrzewaKategoriiCache.products===produkty&&indeksDrzewaKategoriiCache.parents===parentsSource&&indeksDrzewaKategoriiCache.signature===signature&&indeksDrzewaKategoriiCache.value)return indeksDrzewaKategoriiCache.value;
  const allowed=new Set(lista),raw=rodziceKategoriiMenu(),parents={},children=new Map(lista.map(k=>[k,[]])),directCounts=Object.fromEntries(lista.map(k=>[k,0]));
  for(const k of lista){const parent=raw[k];if(parent&&allowed.has(parent)&&parent!==k){parents[k]=parent;children.get(parent).push(k);}}
  for(const p of produkty){const k=String(p?.kategoria||"").trim();if(allowed.has(k))directCounts[k]=(directCounts[k]||0)+1;}
  if(typeof sklepKatalogCentralnyFacety!=="undefined")for(const item of sklepKatalogCentralnyFacety.categories||[]){const k=String(item?.value||"").trim();if(allowed.has(k))directCounts[k]=Math.max(directCounts[k]||0,Number(item?.count)||0);}
  children.forEach(items=>items.sort((a,b)=>a.localeCompare(b,"pl")));
  const depth={},paths={},branchCounts={},descendants={},visit=(k,trail=new Set())=>{
    if(trail.has(k))return {count:directCounts[k]||0,items:new Set()};
    const next=new Set(trail);next.add(k);let count=directCounts[k]||0;const items=new Set();
    for(const child of children.get(k)||[]){items.add(child);const nested=visit(child,next);count+=nested.count;nested.items.forEach(x=>items.add(x));}
    branchCounts[k]=count;descendants[k]=items;return {count,items};
  };
  const pathFor=k=>{const out=[k],seen=new Set([k]);let current=k;while(parents[current]&&!seen.has(parents[current])){current=parents[current];seen.add(current);out.unshift(current);}return out;};
  lista.forEach(k=>{const path=pathFor(k);paths[k]=path;depth[k]=Math.max(0,path.length-1);});
  lista.filter(k=>!parents[k]).forEach(k=>visit(k));lista.forEach(k=>{if(branchCounts[k]===undefined)visit(k);});
  const value={lista,allowed,parents,children,directCounts,branchCounts,descendants,depth,paths,roots:lista.filter(k=>!parents[k])};
  indeksDrzewaKategoriiCache={products:produkty,parents:parentsSource,signature,value};return value;
}
function kategoriePotomneMenu(k,kategorie=wszystkieKategorie()){return indeksDrzewaKategoriiMenu(kategorie).descendants[String(k||"")]||new Set();}
function kategorieGaleziMenu(k,kategorie=wszystkieKategorie()){return new Set([String(k||""),...kategoriePotomneMenu(k,kategorie)]);}
function sciezkaKategoriiMenu(k,kategorie=wszystkieKategorie()){return indeksDrzewaKategoriiMenu(kategorie).paths[String(k||"")]||[String(k||"")];}
function produktNalezyDoGaleziKategorii(p,k,kategorie=wszystkieKategorie()){return k==="Wszystkie"||kategorieGaleziMenu(k,kategorie).has(String(p?.kategoria||""));}
function liczbaProduktowWKategorii(k){ return indeksDrzewaKategoriiMenu().branchCounts[String(k||"")]||0; }
function grupyMenuKategorii(){
  return (Array.isArray(ustawienia.menuKategorii)?ustawienia.menuKategorii:[])
    .map((g,i)=>({
      id:String(g.id||("grp_"+i+"_"+prostyHash(String(g.nazwa||i)))),
      nazwa:String(g.nazwa||"Grupa katalogów").trim()||"Grupa katalogów",
      ikona:String(g.ikona||"🗂️").trim()||"🗂️",
      ikonaObraz:String(g.ikonaObraz||"").trim(),
      ikonaAssetId:String(g.ikonaAssetId||"").trim(),
      aktywna:g.aktywna!==false,
      kategorie:[...new Set((Array.isArray(g.kategorie)?g.kategorie:[]).map(x=>String(x).trim()).filter(Boolean))]
    }));
}
function rodziceKategoriiMenu(){
  const raw=ustawienia.rodziceKategorii&&typeof ustawienia.rodziceKategorii==="object"?ustawienia.rodziceKategorii:{};
  return Object.fromEntries(Object.entries(raw).map(([dziecko,rodzic])=>[String(dziecko||"").trim(),String(rodzic||"").trim()]).filter(([dziecko,rodzic])=>dziecko&&rodzic&&dziecko!==rodzic));
}
function korzenKategoriiMenu(kategoria,dozwolone=null){
  const rodzice=rodziceKategoriiMenu(),seen=new Set();let current=String(kategoria||"").trim();
  for(let i=0;i<8&&rodzice[current]&&!seen.has(current);i++){seen.add(current);const parent=rodzice[current];if(dozwolone&&!dozwolone.has(parent))break;current=parent;}
  return current;
}
function dzieciKategoriiMenu(kategoria,kategorie){
  return indeksDrzewaKategoriiMenu(kategorie).children.get(String(kategoria||""))||[];
}
function zapiszGrupyMenuKategorii(lista, ekstra={}){
  ustawienia.menuKategorii=lista.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz||"",ikonaAssetId:g.ikonaAssetId||"",aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
  zapiszCzescUstawien({menuKategorii:ustawienia.menuKategorii,...ekstra});
}
function kategoriePrzypisaneDoAktywnychGrup(kategorie){
  const dozwolone=new Set(kategorie);
  const przypisaneBezposrednio=new Set(grupyMenuKategorii().filter(g=>g.aktywna).flatMap(g=>g.kategorie.filter(k=>dozwolone.has(k))));
  return new Set(kategorie.filter(k=>przypisaneBezposrednio.has(k)||przypisaneBezposrednio.has(korzenKategoriiMenu(k,dozwolone))));
}
function linkKategoriiMenu(k,index=null){
  const count=index?.branchCounts?.[k]??liczbaProduktowWKategorii(k);
  return `<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))"><span>${esc(k)}</span><span class="nav-count" aria-label="Liczba produktów w gałęzi: ${count}">${count}</span></a>`;
}
function drzewoKategoriiMenuHTML(k,kategorie,poziom=0,index=null){
  const tree=index||indeksDrzewaKategoriiMenu(kategorie),dzieci=tree.children.get(k)||[];
  return `<span class="nav-category-node level-${Math.min(5,poziom)}">${linkKategoriiMenu(k,tree)}${dzieci.length?`<span class="nav-category-children">${dzieci.map(d=>drzewoKategoriiMenuHTML(d,kategorie,poziom+1,tree)).join("")}</span>`:""}</span>`;
}
let licznikMenuKategorii=0;
let globalnaObslugaMenuKategorii=false;
function identyfikatorMenuKategorii(){return `nav-category-menu-${++licznikMenuKategorii}`;}
function naglowekMenuKategorii(label,ikona,ikonaObraz,podpis="Kategorie w tym dziale"){
  return `<span class="nav-menu-heading"><span class="nav-menu-heading-icon" aria-hidden="true">${ikonaObraz?`<img class="nav-generated-icon" src="${esc(ikonaObraz)}" alt="">`:esc(ikona||"🗂️")}</span><span><b>${esc(label)}</b><small>${esc(podpis)}</small></span></span>`;
}
function dropdownMenuKategorii(label, dzieci, ikona="🗂️",kategorie=[],ikonaObraz="",extraClass=""){
  if(!dzieci.length) return "";
  const wszystkie=kategorie.length?kategorie:dzieci;
  const id=identyfikatorMenuKategorii();
  const podpis=`${dzieci.length} ${dzieci.length===1?"kategoria":dzieci.length<5?"kategorie":"kategorii"}`;
  const tree=indeksDrzewaKategoriiMenu(wszystkie);
  return `<span class="nav-dd ${esc(extraClass)}"><button class="nav-drop-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="${id}" onclick="return przelaczMenuKategorii(event,this)">${ikonaObraz?`<img class="nav-generated-icon" src="${esc(ikonaObraz)}" alt="">`:esc(ikona)} <span>${esc(label)}</span> <i aria-hidden="true">⌄</i></button><span class="nav-menu" id="${id}" role="region" aria-label="${esc(label)}">${naglowekMenuKategorii(label,ikona,ikonaObraz,podpis)}<span class="nav-menu-list">${dzieci.map(k=>drzewoKategoriiMenuHTML(k,wszystkie,0,tree)).join("")}</span></span></span>`;
}
function dropdownZbiorczyKategorii(sekcje,kategorie=[],label="Więcej",extraClass=""){
  const gotowe=(Array.isArray(sekcje)?sekcje:[]).filter(s=>Array.isArray(s.korzenie)&&s.korzenie.length);
  if(!gotowe.length)return "";
  const id=identyfikatorMenuKategorii();
  const odmianaDzialu=gotowe.length===1?"dział":gotowe.length<5?"działy":"działów";
  const tree=indeksDrzewaKategoriiMenu(kategorie);
  return `<span class="nav-dd nav-dd-more ${esc(extraClass)}"><button class="nav-drop-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="${id}" onclick="return przelaczMenuKategorii(event,this)"><span aria-hidden="true">🗂️</span> <span>${esc(label)}</span> <i aria-hidden="true">⌄</i></button><span class="nav-menu nav-menu-mega${gotowe.length===1?" nav-menu-single":""}" id="${id}" role="region" aria-label="${esc(label)}">${naglowekMenuKategorii(label,"🗂️","",`${gotowe.length} ${odmianaDzialu} w jednym miejscu`)}<label class="nav-menu-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Szukaj kategorii…" aria-label="Szukaj kategorii" oninput="filtrujKategorieMenu(this)"></label><span class="nav-menu-empty" hidden>Brak kategorii pasujących do wyszukiwania.</span>${gotowe.map(s=>`<span class="nav-menu-section"><b>${s.ikonaObraz?`<img class="nav-generated-icon" src="${esc(s.ikonaObraz)}" alt="">`:esc(s.ikona||"📁")} ${esc(s.nazwa||"Kategorie")}</b><span>${s.korzenie.map(k=>drzewoKategoriiMenuHTML(k,kategorie,0,tree)).join("")}</span></span>`).join("")}</span></span>`;
}
function zamknijMenuKategorii(wyjatek=null,przywrocFokus=false){
  document.querySelectorAll("#mainNav .nav-dd.is-open").forEach(menu=>{
    if(menu===wyjatek)return;
    menu.classList.remove("is-open");
    const przycisk=menu.querySelector(":scope > .nav-drop-btn");
    if(przycisk){przycisk.setAttribute("aria-expanded","false");if(przywrocFokus)przycisk.focus();}
  });
}
function przelaczMenuKategorii(event,przycisk){
  event.preventDefault();event.stopPropagation();
  const menu=przycisk.closest(".nav-dd");if(!menu)return false;
  const otworzyc=!menu.classList.contains("is-open");
  zamknijMenuKategorii(menu);
  menu.classList.toggle("is-open",otworzyc);
  przycisk.setAttribute("aria-expanded",otworzyc?"true":"false");
  if(!otworzyc)przycisk.blur();
  return false;
}
function filtrujKategorieMenu(input){
  const panel=input.closest(".nav-menu");if(!panel)return;
  const fraza=String(input.value||"").trim().toLocaleLowerCase("pl");
  let widoczne=0;
  panel.querySelectorAll(":scope > .nav-menu-section").forEach(sekcja=>{
    const naglowek=sekcja.querySelector(":scope > b")?.textContent.toLocaleLowerCase("pl")||"";
    const pasujeNaglowek=!!fraza&&naglowek.includes(fraza);
    let widoczneWSekcji=0;
    sekcja.querySelectorAll(":scope > span > .nav-category-node").forEach(kategoria=>{
      const pasuje=!fraza||pasujeNaglowek||kategoria.textContent.toLocaleLowerCase("pl").includes(fraza);
      kategoria.hidden=!pasuje;if(pasuje)widoczneWSekcji++;
    });
    sekcja.hidden=widoczneWSekcji===0;widoczne+=widoczneWSekcji;
  });
  const pusty=panel.querySelector(":scope > .nav-menu-empty");if(pusty)pusty.hidden=widoczne>0;
}
function zainicjujObslugeMenuKategorii(n){
  if(!n.dataset.menuKategoriiGotowe){
    n.dataset.menuKategoriiGotowe="1";
    n.addEventListener("keydown",event=>{
      const przycisk=event.target.closest(".nav-drop-btn");
      if(przycisk&&event.key==="ArrowDown"){
        const menu=przycisk.closest(".nav-dd");
        if(!menu.classList.contains("is-open"))przelaczMenuKategorii(event,przycisk);
        event.preventDefault();menu.querySelector(".nav-menu input,.nav-menu a")?.focus();
      }
    });
  }
  if(!globalnaObslugaMenuKategorii){
    globalnaObslugaMenuKategorii=true;
    document.addEventListener("click",event=>{if(!event.target.closest("#mainNav .nav-dd"))zamknijMenuKategorii();});
    document.addEventListener("keydown",event=>{if(event.key==="Escape")zamknijMenuKategorii(null,true);});
  }
}
function odswiezMenu(){
  const n = $("mainNav"); if(!n) return;
  licznikMenuKategorii=0;
  const kategorie = wszystkieKategorie();
  const grupy = grupyMenuKategorii().filter(g=>g.aktywna);
  const rodzice=rodziceKategoriiMenu(),dozwolone=new Set(kategorie);
  const grupyZKorzeniami=grupy.map(g=>{
    const bezposrednie=g.kategorie.filter(k=>dozwolone.has(k));
    const korzenie=[...new Set(bezposrednie.map(k=>rodzice[k]&&dozwolone.has(korzenKategoriiMenu(k,dozwolone))?korzenKategoriiMenu(k,dozwolone):k))];
    return {...g,korzenie};
  }).filter(g=>g.korzenie.length);
  // Na szerokim pasku zostają maksymalnie cztery najważniejsze grupy. Pozostałe
  // nadal są dostępne w jednym, pełnym katalogu „Więcej”, dzięki czemu nawigacja
  // nie tworzy przypadkowego drugiego wiersza przy dłuższych nazwach.
  const limitGrupBezposrednich=4;
  const grupyBezposrednie=grupyZKorzeniami.slice(0,limitGrupBezposrednich);
  const grupyDodatkowe=grupyZKorzeniami.slice(limitGrupBezposrednich);
  const grupyHTML = grupyBezposrednie.map((g,index)=>dropdownMenuKategorii(g.nazwa,g.korzenie,g.ikona,kategorie,g.ikonaObraz,index>=2?"nav-align-right":"")).join("");
  const przypisane = kategoriePrzypisaneDoAktywnychGrup(kategorie);
  const bezGrup = kategorie.filter(k=>!przypisane.has(k));
  const bezGrupKorzenie=bezGrup.filter(k=>!rodzice[k]||!dozwolone.has(rodzice[k]));
  const pokazBezGrup = ustawienia.menuPokazNieprzypisane!==false;
  const limitBezGrupBezposrednich=grupyZKorzeniami.length?0:6;
  const bezGrupBezposrednie=pokazBezGrup?bezGrupKorzenie.slice(0,limitBezGrupBezposrednich):[];
  const bezGrupDodatkowe=pokazBezGrup?bezGrupKorzenie.slice(limitBezGrupBezposrednich):[];
  const bezGrupHTML=bezGrupBezposrednie.map(k=>`<a class="nav-category-direct" href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">${esc(k)}</a>`).join("");
  const sekcjeDodatkowe=[...grupyDodatkowe.map(g=>({nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz,korzenie:g.korzenie})),...(bezGrupDodatkowe.length?[{nazwa:"Pozostałe kategorie",ikona:"📁",korzenie:bezGrupDodatkowe}]:[])];
  const wszystkieSekcje=[...grupyZKorzeniami.map(g=>({nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz,korzenie:g.korzenie})),...(bezGrupKorzenie.length?[{nazwa:"Pozostałe kategorie",ikona:"📁",korzenie:bezGrupKorzenie}]:[])];
  const wiecejHTML=dropdownZbiorczyKategorii(sekcjeDodatkowe,kategorie);
  const mobilneKategorieHTML=dropdownZbiorczyKategorii(wszystkieSekcje,kategorie,"Kategorie","nav-mobile-categories");
  n.innerHTML = mobilneKategorieHTML
    + `<a class="nav-home-link" href="#/">🏪 Strona główna</a>`
    + grupyHTML
    + bezGrupHTML
    + wiecejHTML
    + `<a href="/promocje" onclick="return nawigujSklep(event,this.getAttribute('href'))">🔥 Promocje</a><a href="/nowosci" onclick="return nawigujSklep(event,this.getAttribute('href'))">✨ Nowości</a>`
    + (jestAdmin()?`<a class="nav-admin-link" href="#/admin">⚙️ Panel admina</a>`:"");
  zainicjujObslugeMenuKategorii(n);
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
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  const u = pobierzUzytkownikow();
  const email = KONFIG.emailAdmina.toLowerCase();
  if(!lokalnyPodglad){
    const czysta=u.filter(x=>!(x.email===email&&x.hash));
    if(czysta.length!==u.length)zapiszLS("artway_uzytkownicy",czysta);
    domyslneHasloAdmina=false;
    return;
  }
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
  if(nowe.length<8){ toast("⚠️ Nowe hasło musi mieć min. 8 znaków"); return; }
  if(nowe!==powtorz){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  try{
    const d=await chmura("account-password-change",{method:"POST",body:{currentPassword:String(f.get("stare")||""),newPassword:nowe}});
    if(d.authenticated&&sesja)ustawSesje({...sesja,verified:true});
  }catch(bl){
    const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
    if(!lokalnyPodglad){toast("⚠️ Nie zmieniono hasła: "+bl.message);return;}
    const w = await sprawdzLogowanie(sesja.email, f.get("stare"));
    if(!w.ok){ toast("⚠️ Obecne hasło nieprawidłowe"); return; }
  }
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  const u = pobierzUzytkownikow(); const ja = u.find(x=>x.email===sesja.email);
  if(ja){ja.hash=lokalnyPodglad?await hashuj(nowe):"";zapiszLS("artway_uzytkownicy",u);}
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
  if(u.opisSklepu) KONFIG.opisSklepu = /Sklep wielobranżowy z asortymentem od sprawdzonych dostawców\. Nowe technologie, uczciwe ceny\./i.test(String(u.opisSklepu))
    ? "Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów. Czytelna oferta, uczciwe ceny i szybka wysyłka."
    : u.opisSklepu;
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
  const ofertaGlowna=ustawieniaOfertyGlownej();
  if(!localStorage.getItem("artway_produkty_na_stronie")&&[12,24,48,96].includes(Number(ofertaGlowna.naStronie)))produktyNaStronie=Number(ofertaGlowna.naStronie);
  if(u.heroTytul) KONFIG.heroTytul = u.heroTytul;
  if(u.heroOpis) KONFIG.heroOpis = /^Elektronika, dom i ogród, narzędzia, odzież i sport\./i.test(String(u.heroOpis))
    ? "Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów — między innymi Alexander, Multigra i GoDan."
    : u.heroOpis;
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
  const footFirma=$("footFirma"),df=daneFirmy();
  if(footFirma)footFirma.innerHTML=`${esc(df.nazwa)}<br>NIP ${esc(df.nip)} • REGON ${esc(df.regon)}<br>${esc(pelnyAdresFirmy(df))}`;
  $("topbar").style.display = u.uklad?.pasekInfoWidoczny===false ? "none" : "";
  $("searchInput").placeholder = u.tekstSzukaj || "Szukaj produktu…";
  $("footCopy").textContent = u.stopkaCopy || `© ${new Date().getFullYear()} ${KONFIG.nazwaSklepu}. Wszystkie prawa zastrzeżone.`;
  aktualizujFavicon();
  document.querySelectorAll("[data-page-link]").forEach(a=>{
    a.style.display = ustawieniaPodstrony(a.dataset.pageLink).widoczna===false ? "none" : "";
  });
  if(jestAdmin()) document.querySelectorAll('[data-page-link="ulubione"],[data-page-link="zamowienia"]').forEach(a=>a.style.display="none");
}
