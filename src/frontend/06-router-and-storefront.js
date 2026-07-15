/* ═══════════ ROUTER (podstrony) ═══════════ */
let adminAssetsPromise = null;
function zaladujPanelAdmina(){
  if(window.__artwayAdminReady) return Promise.resolve();
  if(adminAssetsPromise) return adminAssetsPromise;
  const version = document.querySelector('meta[name="artway-version"]')?.content || "dev";
  const cssPromise = new Promise((resolve,reject)=>{
    const obecny=document.getElementById("artwayAdminStyles");
    if(obecny){ resolve(); return; }
    const link=document.createElement("link");
    link.id="artwayAdminStyles"; link.rel="stylesheet"; link.href=`/assets/admin.css?v=${encodeURIComponent(version)}`;
    link.onload=()=>resolve(); link.onerror=()=>reject(new Error("Nie udało się wczytać stylów panelu administratora"));
    document.head.appendChild(link);
  });
  const jsPromise = new Promise((resolve,reject)=>{
    const obecny=document.getElementById("artwayAdminScript");
    if(obecny){ if(window.__artwayAdminReady) resolve(); else obecny.addEventListener("load",resolve,{once:true}); return; }
    const script=document.createElement("script");
    script.id="artwayAdminScript"; script.src=`/assets/admin.js?v=${encodeURIComponent(version)}`;
    script.onload=()=>{ window.__artwayAdminReady=true; resolve(); };
    script.onerror=()=>reject(new Error("Nie udało się wczytać modułów panelu administratora"));
    document.body.appendChild(script);
  });
  adminAssetsPromise=Promise.all([cssPromise,jsPromise]).catch(error=>{adminAssetsPromise=null;throw error;});
  return adminAssetsPromise;
}
function trasa(){
  const path=String(location.pathname||"").replace(/\/+$/,"")||"/";
  if(location.hash)return location.hash.replace(/^#/,"").split("?")[0]||"/";
  if(/^\/produkt\/\d+$/i.test(path))return path;
  return "/";
}
function parametryTrasy(){try{return new URLSearchParams(String(location.hash||"").split("?")[1]||"");}catch(e){return new URLSearchParams();}}
let ostatniaRenderowanaTrasa="";
let renderowanieWidoku=false;
let renderPonowniePoBiezacym=false;
let renderTimerWpisywania=null;
let renderFrameWpisywania=0;
function zaplanujRenderPoWpisaniu(opoznienie=180){
  clearTimeout(renderTimerWpisywania);
  if(renderFrameWpisywania)cancelAnimationFrame(renderFrameWpisywania);
  renderTimerWpisywania=setTimeout(()=>{
    renderFrameWpisywania=requestAnimationFrame(()=>{renderFrameWpisywania=0;renderuj();});
  },Math.max(80,Number(opoznienie)||180));
}
function kluczStabilnegoWezla(node){
  if(!node||node.nodeType!==1)return "";
  for(const attr of ["id","data-stable-key","data-product-row","data-product-id","data-order-id","data-order-number","data-task-id","data-item-key"]){
    const value=node.getAttribute(attr);if(value)return `${node.tagName}:${attr}:${value}`;
  }
  return "";
}
function aktualizujAtrybutyWezla(current,next,active){
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
  for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  const focused=current===active;
  if(current instanceof HTMLInputElement){
    if(["checkbox","radio"].includes(current.type)){if(!focused)current.checked=next.checked;}
    else if(!focused)current.value=next.value;
  }else if(current instanceof HTMLTextAreaElement){if(!focused)current.value=next.value;}
  else if(current instanceof HTMLSelectElement){if(!focused)current.value=next.value;}
  else if(current instanceof HTMLDetailsElement)current.open=next.open;
}
function aktualizujWezelStabilnie(current,next,active){
  if(!current||!next)return;
  if(current.nodeType!==next.nodeType||(current.nodeType===1&&current.tagName!==next.tagName)){
    current.replaceWith(next.cloneNode(true));return;
  }
  if(current.nodeType===3||current.nodeType===8){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  if(current.nodeType!==1)return;
  if(current!==active&&typeof current.isEqualNode==="function"&&current.isEqualNode(next))return;
  aktualizujAtrybutyWezla(current,next,active);
  aktualizujDzieciStabilnie(current,next,active);
}
function aktualizujDzieciStabilnie(current,next,active){
  const incoming=[...next.childNodes];
  const keyed=new Map();
  for(const node of current.childNodes){const key=kluczStabilnegoWezla(node);if(key&&!keyed.has(key))keyed.set(key,node);}
  for(let index=0;index<incoming.length;index++){
    const wanted=incoming[index],wantedKey=kluczStabilnegoWezla(wanted);let existing=current.childNodes[index];
    if(wantedKey&&kluczStabilnegoWezla(existing)!==wantedKey){
      const match=keyed.get(wantedKey);
      if(match){current.insertBefore(match,existing||null);existing=match;}
    }
    if(wantedKey)keyed.delete(wantedKey);
    if(!existing){current.appendChild(wanted.cloneNode(true));continue;}
    aktualizujWezelStabilnie(existing,wanted,active);
  }
  while(current.childNodes.length>incoming.length)current.lastChild.remove();
}
function aktualizujWidokStabilnie(root,html){
  const template=document.createElement("template");template.innerHTML=String(html||"").trim();
  const active=document.activeElement,scrollY=window.scrollY||0,selection=active&&typeof active.selectionStart==="number"?{start:active.selectionStart,end:active.selectionEnd}:null;
  aktualizujDzieciStabilnie(root,template.content,active);
  if(active?.isConnected&&selection&&typeof active.setSelectionRange==="function")try{active.setSelectionRange(selection.start,selection.end);}catch(e){}
  if(Math.abs((window.scrollY||0)-scrollY)>1)window.scrollTo({top:scrollY});
}
function odbiorcaStabilnegoWidoku(root,stabilny){
  if(!stabilny)return root;
  return {get innerHTML(){return root.innerHTML;},set innerHTML(html){aktualizujWidokStabilnie(root,html);}};
}
function renderuj(){
  if(renderowanieWidoku){renderPonowniePoBiezacym=true;return;}
  renderowanieWidoku=true;
  try{
    const t = trasa();
    const root = $("widok"),taSamaTrasa=ostatniaRenderowanaTrasa===t&&root.childNodes.length>0;
    const w = odbiorcaStabilnegoWidoku(root,taSamaTrasa);
    // Moduł panelu zawiera także bezpieczny widok „Brak dostępu”. Ładujemy go
    // wyłącznie po wejściu na trasę administracyjną, również dla gościa.
    const wymagaPanelu=t.startsWith("/admin")||t==="/diagnostyka";
    document.body.classList.toggle("admin-mode",wymagaPanelu);
    if(wymagaPanelu&&!window.__artwayAdminReady){
      w.innerHTML=`<div class="page"><div class="panel admin-loading" role="status" aria-live="polite"><h1>Ładowanie panelu administratora…</h1><p>Wczytuję moduły potrzebne tylko do obsługi sklepu.</p></div></div>`;
      zaladujPanelAdmina().then(()=>renderuj()).catch(error=>{
        loguj("blad",error.message,t);
        w.innerHTML=`<div class="page"><div class="panel"><h1>Nie udało się wczytać panelu</h1><p>${esc(error.message)}</p><button class="btn" onclick="renderuj()">Spróbuj ponownie</button></div></div>`;
      });
      ostatniaRenderowanaTrasa=t;return;
    }
    if(t.startsWith("/admin/zamowienie/")&&!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
    if(t.startsWith("/admin")&&stanBramki.authenticated&&!stanBazyCentralnej.sprawdzono&&!stanBazyCentralnej.synchronizacja) setTimeout(()=>synchronizujBazeCentralna(true),0);
    if(!taSamaTrasa)window.scrollTo({top:0});
    if(t==="/" || t==="") w.innerHTML = widokSklep();
    else if(t.startsWith("/produkt/")) w.innerHTML = widokProdukt(parseInt(t.split("/")[2]));
    else if(t.startsWith("/kategoria/")) w.innerHTML = widokKategoria(decodeURIComponent(t.split("/")[2]||""));
    else if(t==="/promocje") w.innerHTML = widokListaSpecjalna("🔥 Promocje", p=>p.staraCena, "Aktualnie nie mamy promocji — zajrzyj wkrótce!");
    else if(t==="/nowosci") w.innerHTML = widokListaSpecjalna("✨ Nowości", p=>p.badge==="Nowość", "Brak nowości w tej chwili — zajrzyj wkrótce!");
    else if(t==="/logowanie") w.innerHTML = widokLogowanie();
    else if(t==="/rejestracja") w.innerHTML = widokRejestracja();
	    else if(t==="/konto") w.innerHTML = widokKonto();
	    else if(t==="/zamowienia") w.innerHTML = widokZamowienia();
	    else if(t.startsWith("/dziekujemy/")) w.innerHTML = widokDziekujemy(decodeURIComponent(t.split("/")[2]||""));
	    else if(t==="/ulubione") w.innerHTML = widokUlubione();
    else if(t==="/kontakt") w.innerHTML = widokKontakt();
    else if(t==="/o-nas") w.innerHTML = widokONas();
    else if(t==="/faq") w.innerHTML = widokFAQ();
    else if(t==="/regulamin") w.innerHTML = widokRegulamin();
    else if(t==="/prywatnosc") w.innerHTML = widokPrywatnosc();
    else if(t==="/dostawa") w.innerHTML = widokDostawa();
    else if(t==="/zwroty") w.innerHTML = widokZwroty();
    else if(t==="/diagnostyka") w.innerHTML = jestAdmin() ? widokDiagnostyka() : widokBrakDostepu();
    else if(t.startsWith("/admin") ){
      if(!jestAdmin()) w.innerHTML = widokBrakDostepu();
      else if(t==="/admin" || t==="/admin/pulpit") w.innerHTML = widokAdmin("pulpit");
      else if(t.startsWith("/admin/pulpit/")) w.innerHTML = widokAdmin(t.split("/")[3]||"pulpit");
      else if(t==="/admin/zamowienia") w.innerHTML = widokAdminZamowienia();
      else if(t==="/admin/zamowienia/tabela"){
        history.replaceState(null,"",`${location.pathname}${location.search}#/admin/magazyn/plan`);
        w.innerHTML = widokAdminMagazyn("plan");
      }
      else if(t.startsWith("/admin/zamowienie/")) w.innerHTML = widokAdminZamowienie(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/allegro") w.innerHTML = widokAdminAllegro();
      else if(t==="/admin/allegro/zamowienia") w.innerHTML = widokAdminAllegro("zamowienia");
      else if(t==="/admin/allegro/oferty") w.innerHTML = widokAdminAllegro("oferty");
      else if(t==="/admin/allegro/wystawianie") w.innerHTML = widokAdminAllegro("wystawianie");
      else if(t==="/admin/allegro/rentownosc") w.innerHTML = widokAdminAllegro("rentownosc");
      else if(t==="/admin/allegro/komunikacja" || t==="/admin/allegro/wiadomosci") w.innerHTML = widokAdminAllegro("wiadomosci");
      else if(t==="/admin/allegro/dyskusje") w.innerHTML = widokAdminAllegro("dyskusje");
      else if(t==="/admin/allegro/ustawienia") w.innerHTML = widokAdminAllegro("ustawienia");
      else if(t==="/admin/wysylki") w.innerHTML = widokAdminWysylki();
      else if(t==="/admin/magazyn") w.innerHTML = widokAdminMagazyn("pulpit");
      else if(t.startsWith("/admin/magazyn/")) w.innerHTML = widokAdminMagazyn(t.split("/")[3]||"pulpit");
      else if(t==="/admin/infakt") w.innerHTML = widokAdminInfakt("pulpit");
      else if(t.startsWith("/admin/infakt/")) w.innerHTML = widokAdminInfakt(t.split("/")[3]||"pulpit");
      else if(t==="/admin/agent-ai/zlecenia"){
        history.replaceState(null,"",`${location.pathname}${location.search}#/admin/magazyn/plan`);
        w.innerHTML = widokAdminMagazyn("plan");
      }
      else if(t==="/admin/agent-ai"){
        w.innerHTML = widokAdminAgentAI("pulpit");
        if(!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
        if(!agentAIPlanStan.history.length&&!agentAIPlanStan.historyLoading) setTimeout(()=>agentAIPobierzHistorieWykonan(true),0);
      }
      else if(t.startsWith("/admin/agent-ai/")){
        w.innerHTML = widokAdminAgentAI(t.split("/")[3]||"pulpit");
        if(!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
        if(!agentAIPlanStan.history.length&&!agentAIPlanStan.historyLoading) setTimeout(()=>agentAIPobierzHistorieWykonan(true),0);
      }
      else if(t==="/admin/seo") w.innerHTML = widokAdminSEO("pulpit");
      else if(t.startsWith("/admin/seo/")) w.innerHTML = widokAdminSEO(t.split("/")[3]||"pulpit");
      else if(t.startsWith("/admin/asortyment/")){
        const s=t.split("/")[3]||"produkty";
        w.innerHTML = s==="jakosc"?widokAdminJakoscKatalogu():s==="kategorie"?widokAdminKategorie():s==="mapowanie"?widokAdminMapowanie():s==="rabaty"?widokAdminRabaty():s==="opinie"?widokAdminOpinie():widokAdminProdukty();
      }
      else if(t.startsWith("/admin/personalizacja/")){
        const s=t.split("/")[3]||"wyglad";
        w.innerHTML = s==="rozmieszczenie"?widokAdminRozmieszczenie():s==="bannery"?widokAdminBannery():s==="podstrony"?widokAdminPodstrony():s==="strony"?widokAdminStrony():s==="dostawy"?widokAdminDostawy():widokAdminWyglad();
      }
      else if(t==="/admin/asortyment" || t==="/admin/produkty") w.innerHTML = widokAdminProdukty();
      else if(t==="/admin/produkty/dodaj") w.innerHTML = widokAdminProduktyDodaj();
      else if(t==="/admin/produkty/z-linku") w.innerHTML = widokAdminProduktyZLinku();
      else if(t==="/admin/produkty/z-pliku") w.innerHTML = widokAdminProduktyZPliku();
      else if(t.startsWith("/admin/produkty/edytuj/")) w.innerHTML = widokAdminProduktEdytuj(parseInt(t.split("/")[4]));
      else if(t==="/admin/kategorie") w.innerHTML = widokAdminKategorie();
      else if(t==="/admin/mapowanie") w.innerHTML = widokAdminMapowanie();
      else if(t==="/admin/klienci") w.innerHTML = widokAdminKlienci("lista");
      else if(t.startsWith("/admin/klienci/")) w.innerHTML = widokAdminKlienci(t.split("/")[3]||"lista");
      else if(t.startsWith("/admin/klient/")) w.innerHTML = widokAdminKlient(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/rabaty") w.innerHTML = widokAdminRabaty();
      else if(t==="/admin/opinie") w.innerHTML = widokAdminOpinie();
      else if(t==="/admin/dostawy" || t==="/admin/ustawienia") w.innerHTML = widokAdminDostawy();
      else if(t==="/admin/personalizacja" || t==="/admin/wyglad") w.innerHTML = widokAdminWyglad();
      else if(t==="/admin/rozmieszczenie") w.innerHTML = widokAdminRozmieszczenie();
      else if(t==="/admin/bannery") w.innerHTML = widokAdminBannery();
      else if(t==="/admin/podstrony") w.innerHTML = widokAdminPodstrony();
      else if(t==="/admin/strony") w.innerHTML = widokAdminStrony();
      else if(t==="/admin/eksport") w.innerHTML = widokAdminEksport("import");
      else if(t.startsWith("/admin/eksport/")) { const s=t.split("/")[3]||"import"; w.innerHTML = s==="aktualizacja"?widokAdminAktualizacja("status"):widokAdminEksport(s); }
      else if(t==="/admin/aktualizacja") w.innerHTML = widokAdminAktualizacja("status");
      else if(t.startsWith("/admin/aktualizacja/")) w.innerHTML = widokAdminAktualizacja(t.split("/")[3]||"status");
      else if(t==="/admin/publikacja") w.innerHTML = widokAdminPublikacja("kontrola");
      else if(t.startsWith("/admin/publikacja/")) { const s=t.split("/")[3]||"kontrola"; w.innerHTML = s==="aktualizacja"?widokAdminAktualizacja("status"):widokAdminPublikacja(s); }
      else w.innerHTML = widokAdmin();
    }
    else w.innerHTML = `<div class="page"><div class="panel"><h1>404 — nie ma takiej strony 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
    if(t==="/"||t==="") { rysujChipy(); rysuj(); }
    seoAktualizujMetaDlaTrasy(t);
    if(t==="/admin/aktualizacja"&&!stanAktualizacji.sprawdzono&&!stanAktualizacji.ladowanie) setTimeout(()=>sprawdzStatusAktualizacji(true),0);
    ostatniaRenderowanaTrasa=t;
  }catch(e){
    loguj("blad", "Błąd renderowania strony: "+e.message, trasa());
    $("widok").innerHTML = `<div class="page"><div class="panel"><h1>⚠️ Coś poszło nie tak</h1><p>Błąd został zapisany w <a href="#/diagnostyka">diagnostyce</a>.</p><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
  }finally{
    renderowanieWidoku=false;
    odswiezZnacznikDiag();
    if(renderPonowniePoBiezacym){renderPonowniePoBiezacym=false;requestAnimationFrame(()=>renderuj());}
  }
}
window.addEventListener("hashchange",()=>{renderuj();requestAnimationFrame(()=>$("widok")?.focus({preventScroll:true}));});

/* ═══════════ WIDOK: SKLEP (strona główna) ═══════════ */
function ikonaKategorii(nazwa){
  const mapa = {"Elektronika":"🎧","Dom i ogród":"🏡","Narzędzia":"🧰","Odzież":"🧥","Sport":"🏋️"};
  return mapa[nazwa] || "📦";
}
function opisKategorii(nazwa){
  const mapa = {
    "Elektronika":"Sprzęt i akcesoria do pracy, domu oraz podróży.",
    "Dom i ogród":"Praktyczne wyposażenie do codziennych zastosowań.",
    "Narzędzia":"Rozwiązania do warsztatu, garażu i drobnych napraw.",
    "Odzież":"Wygodne produkty na co dzień i aktywny wypoczynek.",
    "Sport":"Akcesoria do treningu, rekreacji i ruchu na świeżym powietrzu."
  };
  return mapa[nazwa] || "Zobacz wszystkie produkty dostępne w tym katalogu.";
}
function banneryHome(){
  const lista=pobierzBannery().filter(b=>b.aktywny!==false);
  if(!lista.length) return "";
  return `<section class="managed-banners">${lista.map(b=>`
    <a class="managed-banner ${b.obraz?'ma-obraz':''}" href="${esc(bezpiecznyLink(b.link))}" ${b.obraz?`style="background-image:linear-gradient(90deg,rgba(15,18,25,.74),rgba(15,18,25,.28)),url('${b.obraz}')"`:""}>
      ${b.obraz?"":`<span class="banner-icon">${esc(b.ikona||"📣")}</span>`}
      <span><h3>${esc(b.tytul||"")}</h3><p>${esc(b.opis||"")}</p><small>${esc(b.przycisk||"Dowiedz się więcej")} →</small></span>
    </a>`).join("")}</section>`;
}
/* ── Sekcje strony głównej: kolejność i widoczność ustawiane wizualnie
      w Panel admina → Personalizacja → 🧭 Rozmieszczenie ── */
const SEKCJE_GLOWNEJ = {
  hero:       { nazwa:"Baner główny (hero)",         ikona:"🖼️" },
  banery:     { nazwa:"Banery promocyjne",           ikona:"📣" },
  kategorie:  { nazwa:"Kafelki katalogów",           ikona:"🗂️" },
  produkty:   { nazwa:"Cała oferta (lista produktów)",ikona:"🏷️" },
  pasekOferty:{ nazwa:"Pasek okazji (kod rabatowy)", ikona:"🎁" },
  zalety:     { nazwa:"Zalety sklepu",               ikona:"🚀" },
  kroki:      { nazwa:"Jak kupić — 4 kroki",         ikona:"🧭" },
  onas:       { nazwa:"O sklepie + pomoc",           ikona:"🏪" },
  faq:        { nazwa:"Najczęstsze pytania",         ikona:"❓" },
  kontakt:    { nazwa:"Końcowa sekcja kontaktu",     ikona:"💬" }
};
const DOMYSLNA_KOLEJNOSC_SEKCJI = ["hero","banery","kategorie","produkty","pasekOferty","zalety","kroki","onas","faq","kontakt"];
function kolejnoscSekcji(){
  const zap = Array.isArray(ustawienia.kolejnoscSekcji) ? ustawienia.kolejnoscSekcji.filter(id=>SEKCJE_GLOWNEJ[id]) : [];
  return [...zap, ...DOMYSLNA_KOLEJNOSC_SEKCJI.filter(id=>!zap.includes(id))];
}
function sekcjaWidoczna(id){
  if((ustawienia.sekcjeUkryte||[]).includes(id)) return false;
  const u = ustawienia.uklad || {};
  const flagi = { kategorie:"sekcjaKategorie", kroki:"sekcjaKroki", onas:"sekcjaOnas", faq:"sekcjaFaq", kontakt:"sekcjaKontakt" };
  if(flagi[id] && u[flagi[id]]===false) return false;
  return true;
}
function widokSklep(){
  const kategorie = wszystkieKategorie();
  const promki = produkty.filter(p=>p.staraCena).length;
  const nowosci = produkty.filter(p=>p.badge==="Nowość").length;
  const hero = ustawienia.hero || {};
  const SEKCJE = {};
  SEKCJE.hero = () => `
  <section class="hero">
    <div class="hero-in" ${hero.obraz?`style="background:linear-gradient(120deg,rgba(30,41,59,.88),rgba(49,46,129,.78) 60%,rgba(91,33,182,.68)),url('${hero.obraz}') center/cover"`:""}>
      <span class="hero-eyebrow">${esc(hero.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}</span>
      <h1>${esc(KONFIG.heroTytul)}</h1>
      <p>${esc(KONFIG.heroOpis)}</p>
      <div class="hero-actions">
        <a href="#produkty" onclick="document.querySelector('.catalog-head')?.scrollIntoView({behavior:'smooth'});return false;">${esc(hero.przycisk1||"Zobacz ofertę")} ↓</a>
        <a class="hero-link-alt" href="${esc(bezpiecznyLink(hero.link2||"#/promocje"))}">${esc(hero.przycisk2||"Sprawdź promocje")}</a>
      </div>
      <div class="hero-meta">
        <div><b>${produkty.length} produktów</b><small>w aktualnej ofercie</small></div>
        <div><b>${kategorie.length} katalogów</b><small>łatwe przeglądanie</small></div>
        <div><b>14 dni</b><small>na wygodny zwrot</small></div>
        <div><b>od ${KONFIG.darmowaDostawaOd} zł</b><small>darmowa dostawa</small></div>
      </div>
    </div>
  </section>`;
  SEKCJE.banery = () => banneryHome();
  SEKCJE.kategorie = () => `
  <section class="home-section home-categories">
    <div class="section-head">
      <div><h2>Znajdź to, czego szukasz</h2><p>Przejdź od razu do wybranego katalogu i zobacz produkty dopasowane do Twoich potrzeb.</p></div>
      <a href="#produkty" onclick="document.querySelector('.catalog-head')?.scrollIntoView({behavior:'smooth'});return false;">Cała oferta →</a>
    </div>
    <div class="category-grid">
      ${kategorie.map(k=>`
        <a class="category-tile" href="#/kategoria/${encodeURIComponent(k)}">
          <span class="category-ico">${ikonaKategorii(k)}</span>
          <b>${esc(k)}</b>
          <p>${esc(opisKategorii(k))}</p>
          <small>${produkty.filter(p=>p.kategoria===k).length} produktów →</small>
        </a>`).join("")}
    </div>
  </section>`;
  SEKCJE.produkty = () => `
  <div class="catalog-head" id="produkty">
    <div class="section-head">
      <div><h2>Cała oferta</h2><p>Porównaj produkty, dodaj wybrane do ulubionych albo od razu przejdź do koszyka.</p></div>
      <span style="font-size:.85rem;color:var(--muted2)">${promki} promocji • ${nowosci} nowości</span>
    </div>
  </div>
  <div class="toolbar">
    <div id="chips" style="display:flex;flex-wrap:wrap;gap:.6rem"></div>
    <select id="sortSelect" onchange="sortowanie=this.value;stronaProduktow=1;rysuj()" aria-label="Sortowanie">
      <option value="default" ${sortowanie==="default"?"selected":""}>Sortuj: domyślnie</option>
      <option value="price-asc" ${sortowanie==="price-asc"?"selected":""}>Cena: od najniższej</option>
      <option value="price-desc" ${sortowanie==="price-desc"?"selected":""}>Cena: od najwyższej</option>
      <option value="name" ${sortowanie==="name"?"selected":""}>Nazwa: A–Z</option>
      <option value="rating" ${sortowanie==="rating"?"selected":""}>Najlepiej oceniane</option>
      <option value="newest" ${sortowanie==="newest"?"selected":""}>Najnowsze</option>
    </select>
  </div>
  <div class="catalog-tools">
    <details class="advanced-search" ${(cenaOd||cenaDo||filtrDostepnosci!=="wszystkie"||filtrOferty!=="wszystkie"||filtrOceny!=="0")?"open":""}>
      <summary>🔎 Zaawansowane wyszukiwanie i filtry</summary>
      <div class="filter-grid">
        <label>Cena od (zł)<input type="number" min="0" step=".01" value="${esc(cenaOd)}" oninput="cenaOd=this.value;stronaProduktow=1;rysuj()" placeholder="0"></label>
        <label>Cena do (zł)<input type="number" min="0" step=".01" value="${esc(cenaDo)}" oninput="cenaDo=this.value;stronaProduktow=1;rysuj()" placeholder="bez limitu"></label>
        <label>Dostępność<select onchange="filtrDostepnosci=this.value;stronaProduktow=1;rysuj()"><option value="wszystkie">Wszystkie</option><option value="dostepne" ${filtrDostepnosci==="dostepne"?"selected":""}>Dostępne w sprzedaży</option><option value="brak" ${filtrDostepnosci==="brak"?"selected":""}>Chwilowo niedostępne</option></select></label>
        <label>Rodzaj oferty<select onchange="filtrOferty=this.value;stronaProduktow=1;rysuj()"><option value="wszystkie">Wszystkie</option><option value="promocje" ${filtrOferty==="promocje"?"selected":""}>Promocje</option><option value="nowosci" ${filtrOferty==="nowosci"?"selected":""}>Nowości</option></select></label>
        <label>Minimalna ocena<select onchange="filtrOceny=this.value;stronaProduktow=1;rysuj()"><option value="0">Dowolna</option><option value="3" ${filtrOceny==="3"?"selected":""}>3★ i więcej</option><option value="4" ${filtrOceny==="4"?"selected":""}>4★ i więcej</option><option value="4.5" ${filtrOceny==="4.5"?"selected":""}>4,5★ i więcej</option></select></label>
      </div>
      <button class="btn ghost" style="margin-top:.65rem" onclick="wyczyscFiltryProduktow()">Wyczyść filtry</button>
    </details>
  </div>
  <div class="results-bar"><span id="wynikowProdukty"></span><label>Na stronie: <select onchange="ustawProduktyNaStronie(this.value)">${[12,24,48,96].map(n=>`<option value="${n}" ${produktyNaStronie===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
  <div class="pagination" id="paginacjaGora"></div>
  <div class="grid" id="grid"></div>
  <div class="pagination" id="paginacjaDol"></div>`;
  SEKCJE.pasekOferty = () => { const o = ustawienia.pasekOkazji || {},promo=glownaPromocja(); return `
  <section class="offer-band">
    <div class="offer-band-in">
      <div><h2>${esc(o.tytul||"Dobry moment na zakupy")}</h2><p>${o.opis?esc(o.opis):(promo?`Użyj kodu <b>${esc(promo.kod)}</b> w koszyku i odbierz ${esc(promo.procent)}% rabatu na zamówienie.`:"Sprawdź aktualne okazje i produkty w dobrych cenach.")}</p></div>
      <a href="${esc(bezpiecznyLink(o.link||"#/promocje"))}">${esc(o.tekstLinku||"Zobacz okazje")} →</a>
    </div>
  </section>`; };
  SEKCJE.zalety = () => `
  <section class="perks">
    <div class="perk"><span class="ico">🚀</span><div><b>Szybka wysyłka</b><small>${esc(tekstWysylki("Nadanie w"))} w dni robocze</small></div></div>
    <div class="perk"><span class="ico">🔒</span><div><b>Wygodne płatności</b><small>mBank Paynow, pobranie i przelew na telefon</small></div></div>
    <div class="perk"><span class="ico">↩️</span><div><b>Łatwe zwroty</b><small>14 dni na zwrot bez podania przyczyny</small></div></div>
    <div class="perk"><span class="ico">💬</span><div><b>Pomoc przed zakupem</b><small>${esc(KONFIG.emailSklepu)}</small></div></div>
  </section>`;
  SEKCJE.kroki = () => `
  <section class="home-section home-steps">
    <div class="section-head">
      <div><h2>Jak kupić w Artway-TM?</h2><p>Cały proces jest przejrzysty — od znalezienia produktu do odbioru przesyłki.</p></div>
    </div>
    <div class="steps">
      <div class="step"><span class="step-no">1</span><b>Wybierz produkt</b><p>Skorzystaj z katalogów, wyszukiwarki, filtrów i listy ulubionych.</p></div>
      <div class="step"><span class="step-no">2</span><b>Dodaj do koszyka</b><p>Ustaw liczbę sztuk, wpisz kod rabatowy i sprawdź podsumowanie.</p></div>
      <div class="step"><span class="step-no">3</span><b>Podaj dane</b><p>Wybierz dostawę oraz płatność. Koszt zobaczysz przed zatwierdzeniem.</p></div>
      <div class="step"><span class="step-no">4</span><b>Odbierz zamówienie</b><p>Przesyłkę wyślemy wybraną metodą na wskazany przez Ciebie adres.</p></div>
    </div>
  </section>`;
  SEKCJE.onas = () => `
  <section class="home-section home-about">
    <div class="about-grid">
      <div class="about-card">
        <h2>Zakupy bez zbędnych komplikacji</h2>
        <p>Artway-TM łączy różne kategorie w jednym miejscu. Stawiamy na czytelną ofertę, jasne koszty i łatwy kontakt na każdym etapie zamówienia.</p>
        <div class="check-list">
          <div class="check-item"><span>✓</span><div><b>Jasne ceny</b><br>Podsumowanie przed złożeniem zamówienia.</div></div>
          <div class="check-item"><span>✓</span><div><b>Dostawa InPost</b><br>Paczkomat/punkt InPost albo Kurier InPost pod wskazany adres.</div></div>
          <div class="check-item"><span>✓</span><div><b>Zakupy z kontem lub bez</b><br>Ty decydujesz, jak chcesz zamówić.</div></div>
          <div class="check-item"><span>✓</span><div><b>Pomoc po zakupie</b><br>Informacje o zwrotach i reklamacjach.</div></div>
        </div>
        <p style="margin-top:1.2rem"><a class="btn ghost" href="#/o-nas">Poznaj Artway-TM →</a></p>
      </div>
      <div class="support-card">
        <div><span style="font-size:2rem">💬</span><h2>Potrzebujesz pomocy?</h2><p>Napisz do nas, jeśli chcesz dopytać o produkt, dostawę, płatność albo swoje zamówienie.</p></div>
        <a href="#/kontakt">Przejdź do kontaktu →</a>
      </div>
    </div>
  </section>`;
  SEKCJE.faq = () => `
  <section class="home-section home-faq">
    <div class="section-head">
      <div><h2>Najczęstsze pytania</h2><p>Najważniejsze informacje zebrane w jednym miejscu.</p></div>
      <a href="#/faq">Zobacz wszystkie →</a>
    </div>
    <div class="faq-list">
      <details><summary>Ile trwa realizacja zamówienia?</summary><p>Zamówienia przygotowujemy do wysyłki w dni robocze. Standardowy deklarowany czas nadania to ${esc(czasWysylki())}.</p></details>
      <details><summary>Kiedy dostawa jest darmowa?</summary><p>Dostawa InPost jest darmowa, gdy wartość produktów po rabacie wynosi co najmniej ${KONFIG.darmowaDostawaOd} zł.</p></details>
      <details><summary>Jak zwrócić produkt?</summary><p>Na odstąpienie od umowy masz 14 dni od odbioru. Napisz na ${esc(KONFIG.emailSklepu)}, a otrzymasz dalsze instrukcje.</p></details>
    </div>
  </section>`;
  SEKCJE.kontakt = () => `
  <section class="home-section home-contact">
    <div class="contact-strip">
      <div><h2>Zostało pytanie?</h2><p>Skontaktuj się z nami — odpowiadamy w dni robocze.</p></div>
      <div class="contact-strip-actions">
        <a class="btn" href="#/kontakt">Napisz wiadomość</a>
        <a class="btn ghost" href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a>
      </div>
    </div>
  </section>`;
  return kolejnoscSekcji().filter(sekcjaWidoczna).map(id => SEKCJE[id] ? SEKCJE[id]() : "").join("\n");
}
function rysujChipy(){
  const c = $("chips"); if(!c) return;
  const kats = ["Wszystkie", ...wszystkieKategorie()];
  c.innerHTML = kats.map(k =>
    `<button class="chip ${k===aktywnaKategoria?'active':''}" onclick="ustawKategorie('${esc(k)}')">${esc(k)}</button>`).join("");
}
function ustawKategorie(k){ aktywnaKategoria=k;stronaProduktow=1;rysujChipy();rysuj(); }
function normalizujSzukanyTekst(s){
  return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
}
function produktPasujeFrazie(p,szukane=fraza){
  const zapytanie=normalizujSzukanyTekst(szukane);
  if(!zapytanie)return true;
  const tekst=normalizujSzukanyTekst([p.nazwa,p.opisKrotki,p.opis,p.kategoria,p.sku,p.gtin,p.externalId,p.mpn,p.producent,p.marka,p.kolorProduktu,p.rozmiar,p.material,(p.warianty||[]).join(" "),p.id].join(" "));
  return zapytanie.split(" ").filter(Boolean).every(slowo=>tekst.includes(slowo));
}
function sortujListeProduktow(lista,sort=sortowanie){
  if(sort==="price-asc") lista.sort((a,b)=>a.cena-b.cena);
  else if(sort==="price-desc") lista.sort((a,b)=>b.cena-a.cena);
  else if(sort==="name") lista.sort((a,b)=>a.nazwa.localeCompare(b.nazwa,"pl"));
  else if(sort==="rating") lista.sort((a,b)=>(sredniaOcen(b.id)?.srednia||0)-(sredniaOcen(a.id)?.srednia||0));
  else if(sort==="newest") lista.sort((a,b)=>(b.badge==="Nowość")-(a.badge==="Nowość")||b.id-a.id);
  return lista;
}
function listaProduktowPoFiltrach(){
  const od=cenaOd===""?null:Number(cenaOd),doC=cenaDo===""?null:Number(cenaDo),minOcena=Number(filtrOceny||0);
  const lista=produkty.filter(p=>{
    const ocena=sredniaOcen(p.id)?.srednia||0, niedostepny=produktOznaczonyNiedostepny(p);
    return (aktywnaKategoria==="Wszystkie"||p.kategoria===aktywnaKategoria)
      && produktPasujeFrazie(p)
      && (od===null||p.cena>=od)&&(doC===null||p.cena<=doC)
      && (filtrDostepnosci==="wszystkie"||(filtrDostepnosci==="dostepne"&&!niedostepny)||(filtrDostepnosci==="brak"&&niedostepny))
      && (filtrOferty==="wszystkie"||(filtrOferty==="promocje"&&!!p.staraCena)||(filtrOferty==="nowosci"&&p.badge==="Nowość"))
      && ocena>=minOcena;
  });
  return sortujListeProduktow(lista);
}
function paginacjaHTML(strona,liczbaStron,fn){
  if(liczbaStron<=1)return "";
  const numery=new Set([1,liczbaStron,strona-2,strona-1,strona,strona+1,strona+2].filter(n=>n>=1&&n<=liczbaStron));
  const uporzadkowane=[...numery].sort((a,b)=>a-b);let poprzednia=0,html="";
  for(const n of uporzadkowane){if(poprzednia&&n-poprzednia>1)html+=`<span style="padding:.3rem">…</span>`;html+=`<button class="page-btn ${n===strona?"active":""}" onclick="${fn}(${n})">${n}</button>`;poprzednia=n;}
  return `<button class="page-btn" ${strona<=1?"disabled":""} onclick="${fn}(${strona-1})">←</button>${html}<button class="page-btn" ${strona>=liczbaStron?"disabled":""} onclick="${fn}(${strona+1})">→</button>`;
}
function ustawStroneProduktow(n){
  stronaProduktow=Math.max(1,Number(n)||1);rysuj();
  document.querySelector(".catalog-head")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function ustawProduktyNaStronie(n){
  produktyNaStronie=[12,24,48,96].includes(Number(n))?Number(n):24;stronaProduktow=1;
  zapiszLS("artway_produkty_na_stronie",produktyNaStronie);rysuj();
}
function wyczyscFiltryProduktow(){
  cenaOd="";cenaDo="";filtrDostepnosci="wszystkie";filtrOferty="wszystkie";filtrOceny="0";fraza="";stronaProduktow=1;
  if($("searchInput"))$("searchInput").value="";renderuj();
}
function kartaProduktu(p,index=0){
  const ulub = ulubione.includes(p.id);
  const oceny = sredniaOcen(p.id);
  const brakCeny = !produktMaCeneSprzedazy(p);
  const niedostepny = produktOznaczonyNiedostepny(p);
  return `
  <article class="card" onclick="location.hash='#/produkt/${p.id}'">
    <div class="thumb" style="background:${p.kolor||'#eef2f7'}">
      ${niedostepny?`<span class="badge" style="background:#64748b">Chwilowo niedostępne</span>`:(brakCeny?`<span class="badge" style="background:#f97316">Do wyceny</span>`:(p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:""))}
      ${jestAdmin()?"":`<button class="fav-btn" onclick="event.stopPropagation();przelaczUlubione(${p.id})" aria-label="Ulubione">${ulub?"❤️":"🤍"}</button>`}
      ${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" loading="${index<4?'eager':'lazy'}" decoding="async" ${index<4?'fetchpriority="high"':''} style="width:100%;height:100%;object-fit:cover;${niedostepny?'filter:grayscale(1);opacity:.6':''}" onerror="this.remove();loguj('ostrzezenie','Nie wczytano zdjęcia produktu: ${esc(p.nazwa)}')">`:(p.ikona||"📦")}
    </div>
    <div class="card-body">
      <span class="cat-label">${esc(p.kategoria)}${oceny?` <span style="color:var(--accent);text-transform:none;letter-spacing:0">★ ${oceny.srednia.toFixed(1)} (${oceny.n})</span>`:""}</span>
      <h3>${esc(p.nazwa)}</h3>
      <p class="desc">${esc(skrocTekst(opisKrotkiProduktu(p),190))}</p>
      <div class="price-row">
        <span class="price">${brakCeny?"Cena do uzupełnienia":zl(p.cena)}</span>
        ${p.staraCena?`<span class="old-price">${zl(p.staraCena)}</span>`:""}
      </div>
      ${brakCeny?`<p style="font-size:.76rem;color:#c2410c;font-weight:700;margin-bottom:.4rem">Produkt zaimportowany z ceną 0,00 — popraw cenę w panelu</p>`:""}
      ${niedostepny?`<p style="font-size:.76rem;color:var(--danger);font-weight:700;margin-bottom:.4rem">Chwilowo niedostępne w sprzedaży</p>`:""}
      ${niedostepny||brakCeny
        ? `<button class="add-btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
        : p.warianty?.length
          ? `<button class="add-btn" onclick="event.stopPropagation();location.hash='#/produkt/${p.id}'" style="background:var(--brand2)">Wybierz wariant →</button>`
          : `<div class="card-purchase" onclick="event.stopPropagation()"><div class="card-quantity" aria-label="Liczba sztuk"><button type="button" onclick="ustawIloscKarty(this.nextElementSibling,-1)" aria-label="Zmniejsz liczbę sztuk">−</button><input data-card-quantity type="number" min="1" max="99" step="1" value="1" inputmode="numeric" aria-label="Liczba sztuk produktu ${esc(p.nazwa)}" onchange="ustawIloscKarty(this)"><button type="button" onclick="ustawIloscKarty(this.previousElementSibling,1)" aria-label="Zwiększ liczbę sztuk">+</button></div><button class="add-btn" onclick="dodajZKarty(${p.id},this)">Do koszyka</button></div>`}
    </div>
  </article>`;
}
function rysuj(){
  const g = $("grid"); if(!g) return;
  const lista=listaProduktowPoFiltrach(),liczbaStron=Math.max(1,Math.ceil(lista.length/produktyNaStronie));
  stronaProduktow=Math.min(Math.max(1,stronaProduktow),liczbaStron);
  const start=(stronaProduktow-1)*produktyNaStronie,fragment=lista.slice(start,start+produktyNaStronie);
  g.innerHTML = fragment.length ? fragment.map(kartaProduktu).join("")
    : `<div class="empty">😕 Brak produktów spełniających kryteria.</div>`;
  const licznik=$("wynikowProdukty");if(licznik)licznik.innerHTML=lista.length?`Znaleziono <b>${lista.length}</b> ${lista.length===1?"produkt":"produktów"} • pokazano ${start+1}–${Math.min(start+produktyNaStronie,lista.length)}`:"Nie znaleziono produktów";
  const pag=paginacjaHTML(stronaProduktow,liczbaStron,"ustawStroneProduktow");
  if($("paginacjaGora"))$("paginacjaGora").innerHTML=pag;
  if($("paginacjaDol"))$("paginacjaDol").innerHTML=pag;
}

/* ═══════════ WIDOKI: KATALOG / PROMOCJE / NOWOŚCI ═══════════ */
function ustawStroneListyProduktow(n){stronaListyProduktow=Math.max(1,Number(n)||1);renderuj();}
function ustawLiczbeListyProduktow(n){
  produktyNaLiscie=[12,24,48,96].includes(Number(n))?Number(n):24;stronaListyProduktow=1;
  zapiszLS("artway_produkty_na_liscie",produktyNaLiscie);renderuj();
}
function listaPodstronyHTML(lista,pusty){
  let filtrowana=lista.filter(p=>produktPasujeFrazie(p,frazaListyProduktow));
  filtrowana=sortujListeProduktow(filtrowana,sortowanieListyProduktow);
  const stron=Math.max(1,Math.ceil(filtrowana.length/produktyNaLiscie));
  stronaListyProduktow=Math.min(Math.max(1,stronaListyProduktow),stron);
  const start=(stronaListyProduktow-1)*produktyNaLiscie,fragment=filtrowana.slice(start,start+produktyNaLiscie);
  return `
    <div class="toolbar" style="padding:0;margin:.6rem 0">
      <input placeholder="Szukaj w tej liście…" value="${esc(frazaListyProduktow)}" oninput="frazaListyProduktow=this.value;stronaListyProduktow=1;zaplanujRenderPoWpisaniu()" style="flex:1;min-width:200px;padding:.45rem .7rem;border:1.5px solid var(--line);border-radius:10px">
      <select onchange="sortowanieListyProduktow=this.value;stronaListyProduktow=1;renderuj()"><option value="default">Domyślne</option><option value="price-asc" ${sortowanieListyProduktow==="price-asc"?"selected":""}>Cena rosnąco</option><option value="price-desc" ${sortowanieListyProduktow==="price-desc"?"selected":""}>Cena malejąco</option><option value="name" ${sortowanieListyProduktow==="name"?"selected":""}>Nazwa A–Z</option><option value="rating" ${sortowanieListyProduktow==="rating"?"selected":""}>Najlepiej oceniane</option></select>
    </div>
    <div class="results-bar" style="padding:0;margin:.5rem 0"><span>${filtrowana.length?`Znaleziono <b>${filtrowana.length}</b> • pokazano ${start+1}–${Math.min(start+produktyNaLiscie,filtrowana.length)}`:"Brak wyników"}</span><label>Na stronie: <select onchange="ustawLiczbeListyProduktow(this.value)">${[12,24,48,96].map(n=>`<option value="${n}" ${produktyNaLiscie===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
    ${fragment.length?`<div class="grid" style="padding:0;margin:.7rem 0">${fragment.map(kartaProduktu).join("")}</div>`:`<div class="panel"><p>${pusty}</p></div>`}
    <div class="pagination">${paginacjaHTML(stronaListyProduktow,stron,"ustawStroneListyProduktow")}</div>`;
}
function widokKategoria(nazwa){
  if(!wszystkieKategorie().includes(nazwa))
    return `<div class="page"><div class="panel"><h1>Nie ma takiego katalogu 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
  const lista = produkty.filter(p=>p.kategoria===nazwa);
  return `
  <div class="page" style="max-width:1200px">
    <div class="crumb"><a href="#/">Sklep</a> › ${esc(nazwa)}</div>
    <h1 style="margin-bottom:.8rem">🗂️ ${esc(nazwa)} <small style="color:var(--muted2);font-size:.9rem">(${lista.length})</small></h1>
    ${listaPodstronyHTML(lista,"Ten katalog jest jeszcze pusty albo żaden produkt nie pasuje do wyszukiwania.")}
  </div>`;
}
function widokListaSpecjalna(tytul, filtr, pusty){
  const lista = produkty.filter(filtr);
  return `
  <div class="page" style="max-width:1200px">
    <h1 style="margin-bottom:.8rem">${tytul} <small style="color:var(--muted2);font-size:.9rem">(${lista.length})</small></h1>
    ${listaPodstronyHTML(lista,pusty)}
  </div>`;
}

/* ═══════════ WIDOK: PRODUKT ═══════════ */
let iloscProduktu = 1,ostatniProduktIlosci=null;
function specyfikacjaProduktuHTML(p){
  const wiersze=[
    ["Marka",p.marka],
    ["GTIN / EAN",p.gtin],
    ["EXTERNAL_ID",p.externalId],
    ["MPN",p.mpn],
    ["Kolor",p.kolorProduktu],
    ["Rozmiar / wymiary",p.rozmiar],
    ["Materiał",p.material]
  ].filter(([,v])=>String(v||"").trim());
  if(!wiersze.length)return "";
  return `<details open style="margin:.85rem 0">
    <summary style="cursor:pointer;font-weight:800">Specyfikacja produktu</summary>
    <table class="log-table" style="margin-top:.55rem">
      ${wiersze.map(([k,v])=>`<tr><th style="width:170px">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
    </table>
  </details>`;
}
function widokProdukt(id){
  const p = produkty.find(x=>x.id===id);
  if(!p){ loguj("ostrzezenie","Otwarto nieistniejący produkt: id="+id); return `<div class="page"><div class="panel"><h1>Nie znaleziono produktu 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`; }
  if(String(ostatniProduktIlosci)!==String(id)){iloscProduktu=1;ostatniProduktIlosci=id;}
  const powiazane = produkty.filter(x=>x.kategoria===p.kategoria && x.id!==p.id).slice(0,4);
  const brakCeny = !produktMaCeneSprzedazy(p);
  const niedostepny = produktOznaczonyNiedostepny(p);
  return `
  <div class="page">
    <div class="crumb"><a href="#/">Sklep</a> › <a href="#/" onclick="ustawKategorie('${esc(p.kategoria)}')">${esc(p.kategoria)}</a> › ${esc(p.nazwa)}</div>
    <div class="panel">
      <div class="prod-detail">
        <div>
          <div class="prod-thumb" style="background:${p.kolor||'#eef2f7'}">
            ${niedostepny?`<span class="badge" style="background:#64748b">Chwilowo niedostępne</span>`:(p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:"")}
            ${p.zdjecie?`<img id="glowneZdjecie" src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}">`:(p.ikona||"📦")}
          </div>
          ${(p.zdjecie && p.zdjecia?.length)?`
          <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
            ${[p.zdjecie,...p.zdjecia].map((z,i)=>`<img src="${esc(z)}" alt="Miniatura ${esc(p.nazwa)} — zdjęcie ${i+1}" onclick="pokazZdjecie('${esc(z)}')" style="width:62px;height:62px;object-fit:cover;border-radius:9px;border:2px solid ${i===0?'var(--brand)':'var(--line)'};cursor:pointer" onmouseover="this.style.borderColor='var(--brand)'" onmouseout="this.style.borderColor='var(--line)'">`).join("")}
          </div>`:""}
        </div>
        <div>
          <span class="cat-label">${esc(p.kategoria)}</span>
          <h1 style="margin:.2rem 0 .6rem">${esc(p.nazwa)}</h1>
          ${p.sku?`<p style="font-size:.76rem;color:var(--muted2);margin:-.3rem 0 .4rem">Kod produktu: ${esc(p.sku)}</p>`:""}
          <div class="price-row">
            <span class="price" style="font-size:1.7rem">${brakCeny?"Cena do uzupełnienia":zl(p.cena)}</span>
            ${p.staraCena?`<span class="old-price">${zl(p.staraCena)}</span>`:""}
          </div>
          ${brakCeny?`<p class="backend-note" style="text-align:left;margin:.4rem 0">Produkt został zaimportowany z ceną 0,00. Administrator musi uzupełnić cenę przed sprzedażą.</p>`:""}
          <p style="color:var(--muted2);font-size:1.02rem;line-height:1.55">${esc(opisKrotkiProduktu(p))}</p>
          ${specyfikacjaProduktuHTML(p)}
          ${p.warianty?.length?`
          <div class="f-group" style="max-width:260px;margin:.6rem 0 0"><label>Wybierz wariant *</label>
            <select id="wariantSel">${p.warianty.map(w=>`<option>${esc(w)}</option>`).join("")}</select>
          </div>`:""}
          <label class="product-detail-quantity">Ilość sztuk</label>
          <div class="qty-big" aria-label="Wybierz liczbę sztuk">
            <button type="button" onclick="zmienIloscProd(-1)" aria-label="Zmniejsz liczbę sztuk">−</button>
            <input id="prodQty" type="number" min="1" max="99" step="1" value="${esc(iloscProduktu)}" inputmode="numeric" aria-label="Liczba sztuk" oninput="ustawIloscProduktu(this.value)" onchange="ustawIloscProduktu(this.value)">
            <button type="button" onclick="zmienIloscProd(1)" aria-label="Zwiększ liczbę sztuk">+</button>
          </div>
          <div style="display:flex;gap:.7rem;flex-wrap:wrap">
            ${niedostepny||brakCeny
              ? `<button class="btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
              : `<button class="btn" onclick="dodajIlosc(${p.id})">🛒 Do koszyka</button>`}
            ${jestAdmin()?"":`<button class="btn ghost" onclick="przelaczUlubione(${p.id});renderuj()">${ulubione.includes(p.id)?"❤️ W ulubionych":"🤍 Dodaj do ulubionych"}</button>`}
          </div>
          ${niedostepny
            ? `<p style="font-size:.83rem;color:var(--danger);margin-top:1rem;font-weight:600">✖ Chwilowo niedostępny — sprawdź później albo skontaktuj się ze sklepem</p>`
            : `<p style="font-size:.83rem;color:var(--ok);margin-top:1rem;font-weight:600">✔ Dostępny w sprzedaży • ${esc(tekstWysylki().toLowerCase())}</p>`}
          ${(()=>{ const o=sredniaOcen(p.id); return o?`<p style="font-size:.95rem;color:var(--accent);font-weight:700;margin-top:.3rem">${gwiazdki(o.srednia)} ${o.srednia.toFixed(1)} <small style="color:var(--muted2)">(${o.n} opinii)</small></p>`:""; })()}
        </div>
      </div>
    </div>
    <div class="prod-extra">
      <div class="info-card">
        <span style="font-size:1.5rem">🚚</span>
        <b>Dostawa InPost</b>
        <p>W koszyku wybierzesz paczkomat/punkt InPost albo Kuriera InPost. Darmowa dostawa od ${KONFIG.darmowaDostawaOd} zł.</p>
      </div>
      <div class="info-card">
        <span style="font-size:1.5rem">↩️</span>
        <b>14 dni na zwrot</b>
        <p>Po odebraniu produktu możesz odstąpić od umowy zgodnie z zasadami opisanymi na stronie zwrotów.</p>
      </div>
      <div class="info-card">
        <span style="font-size:1.5rem">🔒</span>
        <b>Jasne podsumowanie</b>
        <p>Przed zatwierdzeniem zobaczysz cenę produktów, koszt dostawy, rabat i ewentualną opłatę za płatność.</p>
      </div>
      <div class="info-card">
        <span style="font-size:1.5rem">💬</span>
        <b>Pytanie o ten produkt?</b>
        <p>Napisz na <a href="mailto:${esc(KONFIG.emailSklepu)}?subject=${encodeURIComponent("Pytanie o: "+p.nazwa)}">${esc(KONFIG.emailSklepu)}</a> i podaj nazwę produktu.</p>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <h2 style="margin-top:0">Informacje o produkcie</h2>
      <div class="faq-list">
        <details open><summary>Opis</summary>${opisProduktuHTML(p)}</details>
        <details><summary>Dostawa i płatność</summary><p>Dostępne metody oraz aktualne koszty sprawdzisz w koszyku. Możesz zapłacić przez mBank Paynow, za pobraniem albo przelewem na telefon.</p></details>
        <details><summary>Zwrot i reklamacja</summary><p>Masz 14 dni na odstąpienie od umowy. W przypadku problemu z produktem skontaktuj się z nami przez stronę kontaktową.</p></details>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <h2 style="margin-top:0">⭐ Opinie klientów ${opinieProduktu(p.id).length?`(${opinieProduktu(p.id).length})`:""}</h2>
      ${opinieProduktu(p.id).length
        ? opinieProduktu(p.id).map(o=>`<div class="order-box"><div class="order-head"><b>${esc(o.autor)}</b><span style="color:var(--accent);font-weight:700">${gwiazdki(o.ocena)}</span><span>${esc(o.data)}</span></div><div class="order-lines">${esc(o.tekst)}</div></div>`).join("")
        : `<p style="color:var(--muted2);font-size:.9rem">Ten produkt nie ma jeszcze opinii — bądź pierwszy!</p>`}
      <h3 class="f-sekcja">✍️ Dodaj opinię</h3>
      <form onsubmit="dodajOpinie(event, ${p.id})" style="max-width:520px">
        <div class="f-row">
          <div class="f-group"><label>Twoje imię *</label><input required name="autor" maxlength="40"></div>
          <div class="f-group"><label>Ocena *</label><select name="ocena">
            <option value="5">★★★★★ — świetny</option><option value="4">★★★★☆ — dobry</option>
            <option value="3">★★★☆☆ — w porządku</option><option value="2">★★☆☆☆ — słaby</option>
            <option value="1">★☆☆☆☆ — zły</option></select></div>
        </div>
        <div class="f-group"><label>Twoja opinia *</label><textarea required name="tekst" rows="3" maxlength="600" placeholder="Jak sprawdza się produkt?"></textarea></div>
        <button class="btn" type="submit">Wyślij opinię</button>
        <p class="pay-note" style="text-align:left;margin-top:.5rem">Opinia pojawi się po akceptacji przez sklep.</p>
      </form>
    </div>
    ${powiazane.length?`<h2 class="related-h" style="padding:0;margin:1.6rem 0 .2rem">Podobne produkty</h2><div class="grid" style="padding:0;margin:.6rem 0 0">${powiazane.map(kartaProduktu).join("")}</div>`:""}
  </div>`;
}
function ustawIloscProduktu(value){iloscProduktu=Math.max(1,Math.min(99,Math.floor(Number(value)||1)));const e=$("prodQty");if(e)e.value=iloscProduktu;}
function zmienIloscProd(d){ustawIloscProduktu(iloscProduktu+Number(d||0));}
function dodajIlosc(id){
  const wariant = $("wariantSel")?.value || null;
  dodajWIlosci(id,iloscProduktu,null,wariant);
}
function pokazZdjecie(src){ const g=$("glowneZdjecie"); if(g) g.src=src; }

/* ═══════════ WIDOK: LOGOWANIE / REJESTRACJA ═══════════ */
function widokLogowanie(){
  if(sesja) { location.hash="#/konto"; return ""; }
  const us=ustawieniaPodstrony("logowanie");
  return `
  <div class="${klasaPodstrony("logowanie")}"><div class="panel auth-box">
    <h1>${esc(us.tytul)}</h1><p style="color:var(--muted2);margin-bottom:.7rem">${esc(us.opis||"")}</p>
    <div id="authMsg"></div>
    <form onsubmit="obsluzLogowanie(event)">
      <div class="f-group"><label>E-mail</label><input required name="email" type="text" autocomplete="username"></div>
      <div class="f-group"><label>Hasło</label><input required name="haslo" type="password" autocomplete="current-password"></div>
      <button class="checkout-btn" type="submit">Zaloguj się</button>
    </form>
    <p class="auth-alt">Nie masz konta? <a href="#/rejestracja">Zarejestruj się</a></p>
  </div></div>`;
}
function widokRejestracja(){
  if(sesja) { location.hash="#/konto"; return ""; }
  if(ustawieniaPodstrony("rejestracja").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("rejestracja");
  return `
  <div class="${klasaPodstrony("rejestracja")}"><div class="panel auth-box">
    <h1>${esc(us.tytul)}</h1><p style="color:var(--muted2);margin-bottom:.7rem">${esc(us.opis||"")}</p>
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
  const f = new FormData(e.target);
  const w = await sprawdzLogowanie(f.get("email"), f.get("haslo"));
  if(!w.ok){ $("authMsg").innerHTML = `<div class="form-err">${esc(w.blad)}</div>`; return; }
  ustawSesje(w.uzytkownik);
  if(w.uzytkownik.rola==="admin"||jestGlownymAdminem(w.uzytkownik.email)) await synchronizujBazeCentralna(true);
  else await pobierzMojeZamowieniaCentralne(true);
  toast("Witaj, "+w.uzytkownik.imie.split(" ")[0]+"! 👋");
  location.hash=jestAdmin()?"#/admin":"#/konto";
}
async function obsluzRejestracje(e){
  e.preventDefault();
  const f = new FormData(e.target);
  if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ $("authMsg").innerHTML='<div class="form-err">Wpisane hasła nie są takie same.</div>'; return; }
  const w = await zarejestrujUzytkownika(f.get("imie"), f.get("email"), f.get("haslo"));
  if(!w.ok){ $("authMsg").innerHTML = `<div class="form-err">${esc(w.blad)}</div>`; return; }
  ustawSesje(w.uzytkownik);
  await pobierzMojeZamowieniaCentralne(true);
  toast("Konto założone! 🎉");
  location.hash="#/konto";
}

/* ═══════════ WIDOK: KONTO ═══════════ */
function widokKonto(){
  if(!sesja){ location.hash="#/logowanie"; return ""; }
  if(ustawieniaPodstrony("konto").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("konto");
  const admin=jestAdmin();
  const zam = pobierzZamowienia().filter(z=>z.email===sesja.email);
  return `
  <div class="${klasaPodstrony("konto")}"><div class="panel">
    <h1>${esc(us.tytul)}</h1>
    <p style="color:var(--muted2);margin-bottom:.7rem">${admin?"Konto służbowe do zarządzania sklepem.":esc(us.opis||"")}</p>
    <p><b>${esc(sesja.imie)}</b> • ${esc(sesja.email)} ${admin?'<span class="lvl lvl-info">ADMINISTRATOR</span>':""}</p>
    ${admin?`
    <div class="sug" style="margin:.9rem 0"><span class="s-ico">🛡️</span><span><b>Tryb administratora</b><br>To konto nie ma ulubionych ani historii własnych zamówień. Zamówieniami klientów zarządzasz w panelu administracyjnym.</span></div>
    <div class="diag-actions">
      <a class="btn" style="background:var(--brand2)" href="#/admin">⚙️ Otwórz panel administratora</a>
      <button class="btn danger" onclick="wyloguj()">Wyloguj się</button>
    </div>`:`
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
    <details style="margin-top:1.2rem" ${!(pobierzProfil(sesja.email)||{}).ulica?"open":""}>
      <summary style="cursor:pointer;font-weight:700;font-size:.92rem">📇 Moje dane do zamówień (adres, telefon, firma)</summary>
      <form onsubmit="zapiszMojeDane(event)" style="margin-top:.8rem;max-width:640px">
        ${polaKartotekiHTML(pobierzProfil(sesja.email)||{imie:sesja.imie, email:sesja.email}, {edycja:true, blokujEmail:true, bezNotatki:true, bezHasla:true})}
        <button class="btn" type="submit">💾 Zapisz moje dane</button>
        <p class="pay-note" style="text-align:left;margin-top:.5rem">Te dane wypełnią się automatycznie przy każdym zamówieniu.</p>
      </form>
    </details>`}
    <details style="margin-top:.8rem">
      <summary style="cursor:pointer;font-weight:700;font-size:.92rem">🔑 Zmień hasło</summary>
      <form onsubmit="zmienHaslo(event)" style="max-width:380px;margin-top:.8rem">
        <div class="f-group"><label>Obecne hasło</label><input required name="stare" type="password" autocomplete="current-password"></div>
        <div class="f-group"><label>Nowe hasło (min. 6 znaków)</label><input required name="nowe" type="password" minlength="6" autocomplete="new-password"></div>
        <div class="f-group"><label>Powtórz nowe hasło</label><input required name="nowe2" type="password" minlength="6" autocomplete="new-password"></div>
        <button class="btn" type="submit">Zapisz nowe hasło</button>
      </form>
    </details>
  </div></div>`;
}
async function zapiszMojeDane(e){
  if(!sesja) return;
  await zapiszKartoteke(e, sesja.email);
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
    <h1>${esc(us.tytul)}</h1>
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
function widokUlubione(){
  if(jestAdmin()) return `<div class="page"><div class="panel auth-box"><h1>🛡️ Konto administratora</h1><p>Lista ulubionych jest przeznaczona dla kont klientów.</p><p style="margin-top:1rem"><a class="btn" href="#/admin">Otwórz panel administratora</a></p></div></div>`;
  if(ustawieniaPodstrony("ulubione").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("ulubione");
  const lista = produkty.filter(p=>ulubione.includes(p.id));
  return `
  <div class="${klasaPodstrony("ulubione")}">
    <h1 style="margin-bottom:.25rem">${esc(us.tytul)}</h1>
    <p style="color:var(--muted2);margin-bottom:.8rem">${esc(us.opis||"")}</p>
    ${lista.length ? `<div class="grid" style="padding:0">${lista.map(kartaProduktu).join("")}</div>`
      : `<div class="panel"><p>Nie masz jeszcze ulubionych. Kliknij 🤍 na produkcie, żeby go tu dodać.</p><p style="margin-top:.6rem"><a href="#/">← Wróć do sklepu</a></p></div>`}
  </div>`;
}
function przelaczUlubione(id){
  if(jestAdmin()){ toast("Ulubione są dostępne tylko dla kont klientów"); return; }
  ulubione = ulubione.includes(id) ? ulubione.filter(x=>x!==id) : [...ulubione, id];
  zapiszLS("artway_ulubione", ulubione);
  odswiezUlubioneLicznik();
  toast(ulubione.includes(id) ? "Dodano do ulubionych ❤️" : "Usunięto z ulubionych");
  if(trasa()==="/"||trasa()==="") rysuj(); else if(trasa()==="/ulubione") renderuj();
}

/* ═══════════ WIDOK: KONTAKT + STRONY INFORMACYJNE ═══════════ */
function widokKontakt(){
  if(ustawieniaPodstrony("kontakt").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("kontakt");
  return `
  <div class="${klasaPodstrony("kontakt")}">
    <div class="crumb"><a href="#/">Sklep</a> › Kontakt</div>
    <div class="contact-layout">
      <div class="panel">
        <h1>${esc(us.tytul)}</h1>
        <p>${esc(us.opis||"")}</p>
        <form style="margin-top:1rem" onsubmit="wyslijKontakt(event)">
          <div class="f-row">
            <div class="f-group"><label>Twój e-mail</label><input required name="email" type="email" autocomplete="email"></div>
            <div class="f-group"><label>Temat</label><input required name="temat" placeholder="Np. pytanie o produkt"></div>
          </div>
          <div class="f-group"><label>Numer zamówienia (opcjonalnie)</label><input name="numer" placeholder="Np. ATM-123456"></div>
          <div class="f-group"><label>Wiadomość</label><textarea required name="tresc" rows="7" placeholder="W czym możemy pomóc?"></textarea></div>
          <button class="btn" type="submit">📧 Wyślij wiadomość</button>
          <p class="pay-note" style="text-align:left">Formularz otworzy Twój program pocztowy z gotową wiadomością.</p>
        </form>
      </div>
      <aside class="contact-side">
        <div class="info-card"><span style="font-size:1.5rem">✉️</span><b>E-mail</b><p><a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a><br>Najlepsza forma kontaktu w sprawie zamówień.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">📞</span><b>Telefon</b><p>${esc(KONFIG.telefon)}<br>Obsługa w dni robocze.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">🕘</span><b>Godziny odpowiedzi</b><p>Poniedziałek–piątek, 9:00–17:00. Zwykle odpowiadamy w ciągu jednego dnia roboczego.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">📦</span><b>Sprawdź najpierw</b><p><a href="#/faq">Najczęstsze pytania</a><br><a href="#/dostawa">Dostawa i płatności</a><br><a href="#/zwroty">Zwroty i reklamacje</a></p></div>
      </aside>
    </div>
  </div>`;
}
function wyslijKontakt(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const numer = String(f.get("numer")||"").trim();
  const body = `${f.get("tresc")}${numer?"\n\nNumer zamówienia: "+numer:""}\n\nOd: ${f.get("email")}`;
  location.href = `mailto:${KONFIG.emailSklepu}?subject=${encodeURIComponent("[Kontakt] "+f.get("temat"))}&body=${encodeURIComponent(body)}`;
  toast("Otwieram program pocztowy… 📧");
}
function widokONas(){
  if(ustawieniaPodstrony("onas").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("onas");
  return `
  <div class="${klasaPodstrony("onas")}">
    <div class="crumb"><a href="#/">Sklep</a> › O Artway-TM</div>
    <div class="panel">
      <h1>${esc(us.tytul)}</h1>
      <p style="color:var(--muted2);margin-bottom:.8rem">${esc(us.opis||"")}</p>
      <p>Artway-TM to sklep wielobranżowy stworzony z myślą o wygodnych zakupach w jednym miejscu. Oferta obejmuje elektronikę, wyposażenie domu i ogrodu, narzędzia, odzież oraz produkty sportowe.</p>
      <div class="info-grid">
        <div class="info-card"><span style="font-size:1.5rem">🗂️</span><b>Różne kategorie</b><p>Praktyczne produkty do domu, pracy, warsztatu i aktywnego wypoczynku.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">🔎</span><b>Czytelna oferta</b><p>Wyszukiwarka, katalogi, sortowanie i ulubione ułatwiają porównanie produktów.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">💬</span><b>Kontakt z obsługą</b><p>Pomagamy w pytaniach dotyczących produktów, dostawy oraz zamówień.</p></div>
      </div>
      <h2>Nasze podejście</h2>
      <p>Chcemy, aby klient przed złożeniem zamówienia znał cenę, dostępne sposoby dostawy i płatności oraz zasady zwrotu. Dlatego najważniejsze informacje są dostępne bezpośrednio w sklepie i w podsumowaniu koszyka.</p>
      <h2>Masz pytanie?</h2>
      <p>Napisz na <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a> albo przejdź do <a href="#/kontakt">formularza kontaktowego</a>.</p>
    </div>
  </div>`;
}
function widokFAQ(){
  if(ustawieniaPodstrony("faq").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("faq");
  return `
  <div class="${klasaPodstrony("faq")}">
    <div class="crumb"><a href="#/">Sklep</a> › Najczęstsze pytania</div>
    <div class="panel">
      <h1>${esc(us.tytul)}</h1>
      <p style="margin-bottom:1rem">${esc(us.opis||"")}</p>
      <div class="faq-list">
        <details open><summary>Jak znaleźć odpowiedni produkt?</summary><p>Użyj wyszukiwarki w nagłówku, wybierz katalog albo skorzystaj z sortowania cenowego. Produkty możesz zapisywać na liście ulubionych.</p></details>
        <details><summary>Czy muszę zakładać konto?</summary><p>Nie. Zamówienie możesz złożyć bez rejestracji. Konto ułatwia dostęp do historii zakupów i ulubionych produktów na tym urządzeniu.</p></details>
        <details><summary>Jakie są metody dostawy?</summary><p>Sklep realizuje wysyłkę wyłącznie przez InPost: do paczkomatu/punktu odbioru albo Kurierem InPost pod adres. Przy paczkomacie punkt wybierasz w koszyku na mapie albo przez wyszukiwarkę.</p></details>
        <details><summary>Kiedy dostawa jest bezpłatna?</summary><p>Dostawa InPost jest bezpłatna od ${KONFIG.darmowaDostawaOd} zł wartości produktów po uwzględnieniu rabatu.</p></details>
        <details><summary>Jak mogę zapłacić?</summary><p>Aktualne opcje płatności to: ${esc(platnosciOpis())}. Przy przelewie na telefon wpisz w tytule numer zamówienia.</p></details>
        <details><summary>Jak użyć kodu rabatowego?</summary><p>Wpisz kod w koszyku i kliknij „Zastosuj”. Wartość rabatu od razu pojawi się w podsumowaniu.</p></details>
        <details><summary>Jak zwrócić produkt?</summary><p>Na odstąpienie od umowy masz 14 dni od odbioru. Napisz na ${esc(KONFIG.emailSklepu)}, podając numer zamówienia i produkty, które chcesz zwrócić.</p></details>
        <details><summary>Jak zgłosić reklamację?</summary><p>Wyślij opis problemu, numer zamówienia i — jeśli to pomocne — zdjęcia na ${esc(KONFIG.emailSklepu)}. Otrzymasz dalsze instrukcje.</p></details>
        <details><summary>Gdzie sprawdzić status zamówienia?</summary><p>Jeśli zamówienie było przypisane do konta, znajdziesz je w sekcji „Moje zamówienia”. Możesz też skontaktować się z obsługą i podać numer zamówienia.</p></details>
      </div>
      <div class="contact-strip" style="margin-top:1.2rem">
        <div><h2>Nie ma tu odpowiedzi?</h2><p>Napisz do obsługi Artway-TM.</p></div>
        <a class="btn" href="#/kontakt">Przejdź do kontaktu</a>
      </div>
    </div>
  </div>`;
}
function widokRegulamin(){
  if(KONFIG.tresci?.regulamin) return stronaInfo("📜 Regulamin sklepu", KONFIG.tresci.regulamin,"regulamin");
  return stronaInfo("📜 Regulamin sklepu", `
    <p>Regulamin określa zasady sprzedaży w sklepie internetowym Artway-TM oraz prawa kupującego.</p>
    <h2>§1 Sprzedawca i kontakt</h2><p>Sprzedawcą jest:<br>${daneFirmyHTML()}<br>E-mail: <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a><br>Telefon: ${esc(KONFIG.telefon)}.</p>
    <h2>§2 Składanie zamówień</h2><p>Zamówienia można składać przez całą dobę. Klient wybiera produkt, ilość, sposób dostawy i płatności, podaje dane wymagane do realizacji oraz potwierdza zamówienie. Konto klienta jest dobrowolne. Informacja o przyjęciu zamówienia jest wysyłana na wskazany adres e-mail. Umowa sprzedaży zostaje zawarta po potwierdzeniu przyjęcia zamówienia przez sklep.</p>
    <h2>§3 Ceny i płatności</h2><p>Ceny produktów są podawane w złotych polskich i są cenami brutto. Przed złożeniem zamówienia klient widzi łączną cenę produktów, rabaty, koszt dostawy, usługi dodatkowe i opłatę właściwą dla wybranej płatności. Dostępne formy płatności: ${esc(platnosciOpis())}.</p>
    <h2>§4 Dostawa</h2><p>Dostawa jest realizowana przez InPost do wybranego paczkomatu/punktu albo kurierem pod wskazany adres. Deklarowany czas nadania: ${esc(tekstWysylki())} w dni robocze. Aktualny koszt jest zawsze pokazany przed złożeniem zamówienia; darmowa dostawa obowiązuje od ${KONFIG.darmowaDostawaOd} zł, jeśli koszyk spełnia warunki promocji.</p>
    <h2>§5 Odstąpienie od umowy</h2><p>Konsument może odstąpić od umowy zawartej na odległość bez podania przyczyny w ciągu 14 dni od otrzymania towaru. Oświadczenie można przesłać na adres e-mail sklepu. Towar należy odesłać nie później niż 14 dni od złożenia oświadczenia. Sklep zwraca otrzymane płatności, w tym koszt najtańszego zwykłego sposobu dostawy oferowanego dla zamówienia, nie później niż w ciągu 14 dni od otrzymania oświadczenia; zwrot może zostać wstrzymany do chwili otrzymania towaru lub dowodu jego odesłania. Bezpośredni koszt zwykłego zwrotu ponosi konsument. Ustawowe wyjątki od prawa odstąpienia stosuje się tylko w przypadkach przewidzianych prawem.</p>
    <h2>§6 Reklamacje</h2><p>Sprzedawca odpowiada za zgodność towaru z umową na zasadach wynikających z prawa konsumenckiego. Reklamację można przesłać na ${esc(KONFIG.emailSklepu)}, podając dane zamówienia, opis problemu i żądanie. Sklep odpowiada na reklamację konsumenta w terminie 14 dni od jej otrzymania. Koszty uzasadnionej reklamacji towaru niezgodnego z umową ponosi sprzedawca.</p>
    <h2>§7 Dane osobowe i postanowienia końcowe</h2><p>Zasady przetwarzania danych opisuje Polityka prywatności. W sprawach nieuregulowanych stosuje się obowiązujące przepisy prawa polskiego, w szczególności Kodeks cywilny i ustawę o prawach konsumenta. Regulamin jest dostępny nieodpłatnie na stronie sklepu w formie umożliwiającej zapisanie i odtworzenie.</p>`,"regulamin");
}
function widokPrywatnosc(){
  if(KONFIG.tresci?.prywatnosc) return stronaInfo("🔒 Polityka prywatności (RODO)", KONFIG.tresci.prywatnosc,"prywatnosc");
  return stronaInfo("🔒 Polityka prywatności (RODO)", `
    <h2>1. Administrator danych</h2><p>Administratorem danych osobowych jest ${daneFirmyHTML()}. W sprawach dotyczących danych można skontaktować się przez <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a> lub ${esc(KONFIG.telefon)}.</p>
    <h2>2. Zakres, cele i podstawy przetwarzania</h2><p>Przetwarzamy dane podane przy zamówieniu: imię i nazwisko, adres, e-mail, telefon, dane dostawy, a przy zakupie firmowym także nazwę firmy i NIP. Dane są potrzebne do zawarcia i wykonania umowy, obsługi płatności, dostawy, kontaktu oraz reklamacji (art. 6 ust. 1 lit. b RODO). Dane wymagane przepisami rachunkowymi i podatkowymi przetwarzamy w celu wykonania obowiązku prawnego (art. 6 ust. 1 lit. c RODO). Dane techniczne, historia obsługi i niezbędne logi mogą być przetwarzane dla bezpieczeństwa, zapobiegania nadużyciom i ochrony roszczeń (art. 6 ust. 1 lit. f RODO).</p>
    <h2>3. Konto klienta</h2><p>Utworzenie konta jest dobrowolne. Hasło jest przechowywane wyłącznie jako odporny kryptograficznie skrót z indywidualną solą; sklep nie przechowuje jego jawnej treści. Sesja konta jest podpisywana przez serwer i ma ograniczony czas ważności.</p>
    <h2>4. Odbiorcy danych</h2><p>Dane otrzymują tylko podmioty niezbędne do realizacji usługi: dostawca hostingu i utrzymania systemu, operator poczty elektronicznej, InPost, wybrany przez klienta operator płatności oraz — gdy jest to potrzebne — dostawca usług księgowych lub fakturowania. Każdy odbiorca otrzymuje wyłącznie zakres potrzebny do wykonania swojego zadania.</p>
    <h2>5. Okres przechowywania</h2><p>Dane zamówień przechowujemy przez okres realizacji umowy, obsługi reklamacji i możliwych roszczeń, a dokumentację wymaganą prawem — przez okres wynikający z przepisów podatkowych i rachunkowych. Dane konta przechowujemy do jego usunięcia, z wyjątkiem danych, które nadal muszą być przechowywane na innej podstawie prawnej. Logi bezpieczeństwa są przechowywane tylko przez czas potrzebny do wykrywania i wyjaśniania zdarzeń.</p>
    <h2>6. Prawa użytkownika</h2><p>Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia oraz wnieść sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie. Masz też prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych. Żądania można wysyłać na ${esc(KONFIG.emailSklepu)}.</p>
    <h2>7. Pamięć przeglądarki i bezpieczeństwo</h2><p>Sklep korzysta z pamięci przeglądarki do zachowania koszyka, ulubionych, ustawień interfejsu, ograniczonego dziennika diagnostycznego i podpisanej sesji konta. Dane konta, profilu i zamówień są synchronizowane z serwerem sklepu, dlatego nie pozostają wyłącznie na urządzeniu. Strona używa wyłącznie mechanizmów koniecznych do działania sklepu; jeśli w przyszłości zostaną włączone narzędzia analityczne lub marketingowe wymagające zgody, zostanie udostępniony osobny wybór zgód.</p>
    <h2>8. Automatyzacja</h2><p>Narzędzia automatyczne i Agent AI mogą przygotowywać administratorowi propozycje operacyjne, ale nie podejmują wobec klienta decyzji wywołujących skutki prawne wyłącznie w sposób zautomatyzowany.</p>`,"prywatnosc");
}
function widokDostawa(){
  return stronaInfo("🚚 Dostawa i płatności", `
    <h2>Formy dostawy</h2>
    <ul>${dostepneDostawy().map(d=>`<li>${d.nazwa} — ${d.koszt?d.koszt+" zł":"gratis"} (${d.opis})</li>`).join("")}<li><b>Darmowa dostawa InPost</b> przy zamówieniach od ${KONFIG.darmowaDostawaOd} zł</li></ul>
    <p>Przy zamówieniu wybierasz paczkomat/punkt InPost na mapie albo dostawę Kurierem InPost pod adres.</p>
    <p><b>Deklarowany czas nadania:</b> ${esc(czasWysylki())} w dni robocze.</p>
    <h2>Formy płatności</h2>
    <ul>${dostepnePlatnosci().map(p=>`<li>${p.nazwa}${p.oplata?" (+"+p.oplata+" zł)":""}${p.id==="telefon"?` — w tytule wpisz numer zamówienia; numer: ${formatTelefonPlatnosci()}`:""}${p.id==="paynow"?` — bramka mBank Paynow`:""}</li>`).join("")}</ul>
    <h2>Kody rabatowe</h2>
    <p>Aktualne kody: ${Object.entries(KONFIG.kodyRabatowe).map(([k,v])=>`<b>${esc(k)}</b> (−${v}%)`).join(", ")}. Kod wpisz w koszyku.</p>`,"dostawa");
}
function widokZwroty(){
  if(KONFIG.tresci?.zwroty) return stronaInfo("↩️ Zwroty i reklamacje", KONFIG.tresci.zwroty,"zwroty");
  return stronaInfo("↩️ Zwroty i reklamacje", `
    <h2>Zwrot w 14 dni</h2><p>Możesz odstąpić od umowy w ciągu 14 dni od otrzymania przesyłki bez podania przyczyny. Napisz na ${KONFIG.emailSklepu} i odeślij produkt pocztą lub przesyłką kurierską. Przy takim zwrocie bezpośredni koszt odesłania ponosi klient. Nie dołączamy gotowej etykiety zwrotnej.</p>
    <h2>Zwrot pieniędzy</h2><p>Zwrot środków wykonujemy nie później niż w ciągu 14 dni od otrzymania oświadczenia. Możemy wstrzymać zwrot do chwili otrzymania produktu albo przedstawienia potwierdzenia jego odesłania.</p>
    <h2>Wymiana</h2><p>Nie prowadzimy osobnej procedury wymiany. Możesz zwrócić produkt zgodnie z powyższymi zasadami i złożyć nowe zamówienie.</p>
    <h2>Reklamacje</h2><p>Jeśli produkt jest niezgodny z umową, opisz problem i dołącz zdjęcia — odpowiemy w ciągu 14 dni. Uzasadnione koszty odesłania reklamowanego produktu ponosi sprzedawca.</p>`,"zwroty");
}
function widokWylaczonejStrony(){
  return `<div class="page page-compact"><div class="panel" style="text-align:center"><h1>Ta strona jest chwilowo wyłączona</h1><p>Wróć na stronę główną lub skontaktuj się ze sklepem.</p><p style="margin-top:1rem"><a class="btn" href="#/">← Strona główna</a></p></div></div>`;
}
function stronaInfo(tytul, tresc,id){
  const us=id?ustawieniaPodstrony(id):null;
  if(us?.widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const pageId=id||"info";
  const bloki={
    naglowek:`<h1>${us?esc(us.tytul):tytul}</h1>`,
    opis:us?.opis?`<p style="margin-bottom:1rem">${esc(us.opis)}</p>`:"",
    tresc,
    powrot:`<p style="margin-top:1.2rem"><a href="#/">← Wróć do sklepu</a></p>`
  };
  const html=kolejnoscSekcjiPodstrony(pageId).filter(s=>sekcjaPodstronyWidoczna(pageId,s)).map(s=>bloki[s]||"").join("");
  return `<div class="${id?klasaPodstrony(id):"page"}"><div class="panel">${html}</div></div>`;
}
