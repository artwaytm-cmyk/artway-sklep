/* ═══════════ PANEL ADMINA (tylko administrator) ═══════════
   Podstrony: #/admin (pulpit), #/admin/zamowienia (zmiana statusów),
   #/admin/klienci, #/admin/produkty. Klienci ich nie widzą.        */
const STATUSY = ["nowe","potwierdzone","w realizacji","gotowe do wysyłki","nadane","wysłane","w doręczeniu","dostarczone","zakończone","zwrot","zwrot pieniędzy","anulowane"];
const KOLOR_STATUSU = {
  "nowe":"#dbeafe","potwierdzone":"#e0f2fe","w realizacji":"#fef3c7","gotowe do wysyłki":"#ffedd5",
  "nadane":"#e0e7ff","wysłane":"#e0e7ff","w doręczeniu":"#ede9fe","dostarczone":"#dcfce7",
  "zakończone":"#dcfce7","zwrot":"#fce7f3","zwrot pieniędzy":"#cffafe","anulowane":"#fee2e2"
};
const PRZEWOZNICY = {
  inpost:{nazwa:"InPost",uslugi:["Paczkomat 24/7","Kurier InPost"],url:n=>`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(n)}`},
  dpd:{nazwa:"DPD",uslugi:["DPD Classic","DPD Pickup","DPD pobranie"],url:n=>`https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(n)}`},
  dhl:{nazwa:"DHL",uslugi:["DHL Parcel","DHL POP","DHL Express"],url:n=>`https://www.dhl.com/pl-pl/home/tracking.html?tracking-id=${encodeURIComponent(n)}`},
  orlen:{nazwa:"ORLEN Paczka",uslugi:["Automat paczkowy","Punkt odbioru","Kurier"],url:()=>`https://www.orlenpaczka.pl/sledz-paczke/`},
  gls:{nazwa:"GLS",uslugi:["BusinessParcel","ParcelShop","Pobranie"],url:n=>`https://gls-group.com/PL/pl/sledzenie-paczek/?match=${encodeURIComponent(n)}`},
  ups:{nazwa:"UPS",uslugi:["UPS Standard","UPS Access Point","UPS Express"],url:n=>`https://www.ups.com/track?loc=pl_PL&tracknum=${encodeURIComponent(n)}`},
  pocztex:{nazwa:"Pocztex",uslugi:["Kurier","PUNKT","Automat"],url:()=>`https://emonitoring.poczta-polska.pl/`},
  inny:{nazwa:"Inny / własny",uslugi:["Przesyłka standardowa"],url:()=>""}
};
const PRZEWOZNICY_AKTYWNI = ["inpost"];
function przewoznicyAktywni(){
  return Object.fromEntries(PRZEWOZNICY_AKTYWNI.map(id=>[id,PRZEWOZNICY[id]]).filter(([,p])=>p));
}
const ETAPY_WYSYLKI = {
  do_obslugi:{nazwa:"Do obsługi",ikona:"📥",kolor:"#dbeafe"},
  przygotowanie:{nazwa:"Przygotowanie",ikona:"📦",kolor:"#fef3c7"},
  etykieta:{nazwa:"Etykieta gotowa",ikona:"🏷️",kolor:"#ffedd5"},
  przekazana:{nazwa:"Przekazana",ikona:"🤝",kolor:"#e0e7ff"},
  transport:{nazwa:"W transporcie",ikona:"🚚",kolor:"#ede9fe"},
  doreczenie:{nazwa:"W doręczeniu",ikona:"📍",kolor:"#fce7f3"},
  dostarczona:{nazwa:"Dostarczona",ikona:"✅",kolor:"#dcfce7"},
  problem:{nazwa:"Wymaga reakcji",ikona:"⚠️",kolor:"#fee2e2"},
  zwrot:{nazwa:"Zwrot",ikona:"↩️",kolor:"#fce7f3"},
  anulowana:{nazwa:"Anulowana",ikona:"⛔",kolor:"#e2e8f0"}
};
const MENU_ADMINA_PULPIT = ["/admin","📊","Pulpit","Priorytety i praca na dziś"];
const MENU_ADMINA = [
  {id:"sprzedaz",ikona:"🛒",nazwa:"Obsługa sprzedaży",opis:"Od zamówienia do doręczenia",elementy:[
    ["/admin/zamowienia","📦","Zamówienia sklepu","Statusy, płatności i obsługa"],
    ["/admin/allegro","🟠","Allegro","Oferty, zamówienia i komunikacja"],
    ["/admin/wysylki","🚚","Centrum wysyłek","InPost, etykiety i tracking"],
    ["/admin/klienci","👥","Klienci","Konta, uprawnienia i historia"]
  ]},
  {id:"towar",ikona:"🏷️",nazwa:"Towar i dane",opis:"Katalog, stany i wymiana danych",elementy:[
    ["/admin/asortyment","🏷️","Asortyment","Produkty, katalogi i mapowanie"],
    ["/admin/magazyn","🏬","Magazyn","Stany, lokalizacje i dostawcy"],
    ["/admin/eksport","⇄","Import i eksport","Przenoszenie i kontrola danych"]
  ]},
  {id:"finanse",ikona:"🧾",nazwa:"Finanse",opis:"Koszty, faktury i rentowność",elementy:[
    ["/admin/infakt","🧾","inFakt i faktury","Koszty, dokumenty i rozliczenia"]
  ]},
  {id:"rozwoj",ikona:"✨",nazwa:"Rozwój sklepu",opis:"Automatyzacja, wygląd i widoczność",elementy:[
    ["/admin/agent-ai","🤖","Agent AI","Zadania, decyzje i automaty"],
    ["/admin/seo","📣","Pozycjonowanie","Widoczność i promocja produktów"],
    ["/admin/personalizacja","🎨","Personalizacja","Wygląd, układy i ustawienia sklepu"]
  ]},
  {id:"system",ikona:"🛠️",nazwa:"System",opis:"Publikacja, wersje i diagnostyka",elementy:[
    ["/admin/aktualizacja","⬆️","Aktualizacja strony","Pliki i wersja aplikacji"],
    ["/admin/publikacja","🌍","Publikacja","Wdrożenie i status online"],
    ["/diagnostyka","🩺","Diagnostyka","Integracje, błędy i kondycja"]
  ]}
];
function adminMenuPozycjaAktywna(aktywna,href){
  if(href==="/admin")return aktywna==="/admin";
  return aktywna===href||String(aktywna||"").startsWith(href+"/");
}
function adminMenuLinkHTML(pozycja,aktywna,powiadomienia,dodatkowaKlasa=""){
  const [href,ikona,nazwa,podpis]=pozycja,czyAktywna=adminMenuPozycjaAktywna(aktywna,href),licznik=powiadomienia[href]||0;
  return `<a href="#${href}" class="admin-nav-link ${dodatkowaKlasa} ${czyAktywna?"active":""}" title="${esc(nazwa)}${podpis?` — ${esc(podpis)}`:""}" ${czyAktywna?'aria-current="page"':""}><span class="admin-nav-link-main"><i>${ikona}</i><span><b>${esc(nazwa)}</b>${podpis?`<small>${esc(podpis)}</small>`:""}</span></span>${licznik?`<span class="nav-badge" aria-label="${licznik} aktywnych spraw">${licznik}</span>`:""}</a>`;
}
function adminKontekstWidoku(aktywna){
  if(adminMenuPozycjaAktywna(aktywna,"/admin"))return {grupa:"Centrum zarządzania",ikona:MENU_ADMINA_PULPIT[1],nazwa:MENU_ADMINA_PULPIT[2],podpis:MENU_ADMINA_PULPIT[3]};
  for(const grupa of MENU_ADMINA){const pozycja=grupa.elementy.find(p=>adminMenuPozycjaAktywna(aktywna,p[0]));if(pozycja)return {grupa:grupa.nazwa,ikona:pozycja[1],nazwa:pozycja[2],podpis:pozycja[3]||grupa.opis};}
  return {grupa:"Panel administratora",ikona:"🛠️",nazwa:"Narzędzia systemowe",podpis:"Zarządzanie sklepem Artway-TM"};
}
function adminMenuMobilneHTML(aktywna,powiadomienia,kontekst){
  return `<details class="admin-mobile-menu" ontoggle="if(!this.open&&this.classList.contains('pwa-sheet-open'))pwaZamknijMenuAdmina()"><summary><span><i>☰</i><small>Menu panelu</small><b>${kontekst.ikona} ${esc(kontekst.nazwa)}</b></span><em>⌄</em></summary><div class="admin-mobile-menu-body" onclick="if(event.target.closest('a'))pwaZamknijMenuAdmina()">${adminMenuLinkHTML(MENU_ADMINA_PULPIT,aktywna,powiadomienia,"admin-mobile-home")}${MENU_ADMINA.map(grupa=>`<section><header><span>${grupa.ikona}</span><div><b>${esc(grupa.nazwa)}</b><small>${esc(grupa.opis||"")}</small></div></header><div>${grupa.elementy.map(p=>adminMenuLinkHTML(p,aktywna,powiadomienia,"admin-mobile-link")).join("")}</div></section>`).join("")}</div></details>`;
}
function adminPwaDolneMenuPozycjaHTML(href,icon,label,aktywna,powiadomienia){const active=adminMenuPozycjaAktywna(aktywna,href),count=powiadomienia[href]||0;return `<a href="#${href}" class="pwa-admin-bottom-link ${active?"active":""}" ${active?'aria-current="page"':""} onclick="pwaZamknijMenuAdmina()"><i>${icon}</i><span>${esc(label)}</span>${count?`<b>${count}</b>`:""}</a>`;}
function adminPwaDolneMenuHTML(aktywna,powiadomienia){return `<nav class="pwa-admin-bottom-nav" aria-label="Menu aplikacji administratora">${adminPwaDolneMenuPozycjaHTML("/admin","📊","Pulpit",aktywna,powiadomienia)}${adminPwaDolneMenuPozycjaHTML("/admin/zamowienia","📦","Zamówienia",aktywna,powiadomienia)}${adminPwaDolneMenuPozycjaHTML("/admin/magazyn","🏬","Magazyn",aktywna,powiadomienia)}<button type="button" class="pwa-admin-bottom-link" onclick="pwaZamknijMenuAdmina();magazynGlobalnySkanerOtworz()"><i>📷</i><span>Skanuj</span></button><button type="button" class="pwa-admin-bottom-link pwa-admin-more" onclick="pwaPrzelaczMenuAdmina(this)" aria-expanded="false"><i>☰</i><span>Menu</span></button></nav>`;}
function pwaZamknijMenuAdmina(){const menu=document.querySelector(".admin-mobile-menu");if(menu){menu.open=false;menu.classList.remove("pwa-sheet-open");}document.body.classList.remove("pwa-admin-menu-open");document.querySelector(".pwa-admin-more")?.setAttribute("aria-expanded","false");}
function pwaPrzelaczMenuAdmina(button){const menu=document.querySelector(".admin-mobile-menu");if(!menu)return;const open=!menu.classList.contains("pwa-sheet-open");menu.open=open;menu.classList.toggle("pwa-sheet-open",open);document.body.classList.toggle("pwa-admin-menu-open",open);button?.setAttribute("aria-expanded",String(open));}
function adminMenuOtwartaGrupa(){return String(wczytajLS("artway_admin_menu_otwarta_v2","")||"");}
function przelaczGrupeMenuAdmina(id,button){
  const grupa=button?.closest?.(".admin-nav-group");if(!grupa)return;
  const nav=grupa.closest(".admin-nav"),otwieramy=grupa.classList.contains("collapsed");
  nav?.querySelectorAll(".admin-nav-group").forEach(g=>{g.classList.add("collapsed");g.querySelector(".admin-nav-group-toggle")?.setAttribute("aria-expanded","false");});
  if(otwieramy){grupa.classList.remove("collapsed");button.setAttribute("aria-expanded","true");}
  zapiszLS("artway_admin_menu_otwarta_v2",otwieramy?id:"");
}
function przelaczTrybMenuAdmina(button){
  const shell=button?.closest?.("[data-admin-shell]");if(!shell)return;
  const kompaktowy=!shell.classList.contains("admin-nav-compact");
  shell.classList.toggle("admin-nav-compact",kompaktowy);zapiszLS("artway_admin_menu_kompaktowe_v1",kompaktowy);
  button.setAttribute("aria-pressed",String(kompaktowy));button.textContent=kompaktowy?"⇥":"⇤";button.title=kompaktowy?"Rozwiń menu":"Zwiń menu";
}
function filtrujMenuAdmina(input){
  const nav=input?.closest?.(".admin-nav"),q=normalizujSzukanyTekst(input?.value||"");if(!nav)return;
  nav.classList.toggle("is-searching",!!q);
  nav.querySelectorAll(".admin-nav-group").forEach(grupa=>{
    let trafienia=0;grupa.querySelectorAll(".admin-nav-link").forEach(link=>{const pasuje=!q||normalizujSzukanyTekst(link.textContent).includes(q);link.hidden=!pasuje;if(pasuje)trafienia++;});
    const pasujeNaglowek=!q||normalizujSzukanyTekst(grupa.querySelector(".admin-nav-group-toggle")?.textContent||"").includes(q);grupa.hidden=!!q&&!trafienia&&!pasujeNaglowek;grupa.classList.toggle("search-open",!!q&&(trafienia>0||pasujeNaglowek));
  });
  nav.querySelector(".admin-nav-home")?.toggleAttribute("hidden",!!q&&!normalizujSzukanyTekst("pulpit priorytety praca dzisiaj").includes(q));
}
let adminMenuStatCache={revision:-1,expiresAt:0,powiadomienia:null,licznikOperacyjny:0};
function uniewaznijAdminMenuStatCache(){adminMenuStatCache={revision:-1,expiresAt:0,powiadomienia:null,licznikOperacyjny:0};}
function adminMenuStatystyki(){
  const now=Date.now();
  if(adminMenuStatCache.powiadomienia&&adminMenuStatCache.revision===adminRewizjaDanych&&now<adminMenuStatCache.expiresAt){
    return {powiadomienia:{...adminMenuStatCache.powiadomienia},licznikOperacyjny:adminMenuStatCache.licznikOperacyjny};
  }
  const allegroDoObslugi=typeof statusAllegroRezerwujeMagazyn==="function"?(Array.isArray(allegroZamowienia)?allegroZamowienia.filter(statusAllegroRezerwujeMagazyn).length:0):Number(allegroPodsumowanie?.orders?.active||0);
  const komunikacjaDoObslugi=typeof allegroKomunikacjaStaty==="function"?Number(allegroKomunikacjaStaty().totalNeed||0):Number(allegroPodsumowanie?.communication?.needReply||0);
  const zadaniaAgenta=typeof agentAIAnalizaAktywna==="function"&&typeof agentAIAnaliza==="function"?agentAIAnalizaAktywna(agentAIAnaliza()).length:0;
  const brakiDoZamowien=typeof rezerwacjeMagazynowe==="function"?potrzebyZatowarowania().length:0;
  const jakoscKatalogu=typeof produktyDoAdministracji==="function"?seoKolejkaProduktow().filter(x=>x.score<85).length:0;
  const powiadomienia={
    "/admin/zamowienia": pobierzZamowienia().filter(z=>z.status==="nowe").length,
    "/admin/allegro": allegroDoObslugi+komunikacjaDoObslugi,
    "/admin/wysylki": pobierzZamowienia().filter(z=>!["anulowane","dostarczone","zakończone"].includes(z.status)&&!z.wysylka?.numer).length,
    "/admin/magazyn": brakiDoZamowien,
    "/admin/infakt": pobierzZamowienia().filter(z=>String(z.status||"")!=="anulowane"&&(z.klient?.nip||z.klient?.firma)&&!infaktStan.links?.[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length,
    "/admin/agent-ai": zadaniaAgenta,
    "/admin/asortyment": opinie.filter(o=>o.status==="oczekuje").length,
    "/admin/seo": jakoscKatalogu
  };
  const licznikOperacyjny=["/admin/zamowienia","/admin/allegro","/admin/wysylki","/admin/magazyn","/admin/infakt"].reduce((s,h)=>s+(powiadomienia[h]||0),0);
  powiadomienia["/admin"]=licznikOperacyjny;
  adminMenuStatCache={revision:adminRewizjaDanych,expiresAt:now+15000,powiadomienia:{...powiadomienia},licznikOperacyjny};
  return {powiadomienia,licznikOperacyjny};
}
let adminStandaryzacjaProba=0;
function adminStandaryzujPoRenderze(){
  const wykonaj=()=>{
    const root=document.getElementById("widok")||document;
    if(typeof window.adminUjednolicWidok==="function"){window.adminUjednolicWidok(root);return;}
    if(++adminStandaryzacjaProba<20)setTimeout(wykonaj,50);
  };
  adminStandaryzacjaProba=0;queueMicrotask(()=>requestAnimationFrame(wykonaj));
}
function adminSzkielet(aktywna, tresc){
  if(typeof chmuraOdswiezSesjeAdministratora==="function")setTimeout(()=>chmuraOdswiezSesjeAdministratora(),0);
  adminStandaryzujPoRenderze();
  const {powiadomienia,licznikOperacyjny}=adminMenuStatystyki();
  const otwartaGrupa=adminMenuOtwartaGrupa();
  const kontekst=adminKontekstWidoku(aktywna);
  const menuKompaktowe=!!wczytajLS("artway_admin_menu_kompaktowe_v1",false);
  return `
  <div class="admin-page ${menuKompaktowe?"admin-nav-compact":""}" data-admin-shell>
    <aside class="admin-nav" aria-label="Główna nawigacja administratora">
      <div class="admin-nav-heading"><span class="admin-nav-brand-mark">A</span><span class="admin-nav-brand-copy"><b>Artway-TM</b><small>Panel operacyjny</small></span><button type="button" onclick="przelaczTrybMenuAdmina(this)" title="${menuKompaktowe?"Rozwiń menu":"Zwiń menu"}" aria-label="Zmień szerokość menu" aria-pressed="${String(menuKompaktowe)}">${menuKompaktowe?"⇥":"⇤"}</button></div>
      <label class="admin-nav-search"><span>🔎</span><input type="search" placeholder="Znajdź moduł…" aria-label="Znajdź moduł panelu" oninput="filtrujMenuAdmina(this)"></label>
      ${adminMenuLinkHTML(MENU_ADMINA_PULPIT,aktywna,powiadomienia,"admin-nav-home")}
      <div class="admin-nav-separator"></div>
      ${MENU_ADMINA.map(grupa=>{
        const aktywnaGrupa=grupa.elementy.some(p=>adminMenuPozycjaAktywna(aktywna,p[0])),zwinieta=!aktywnaGrupa&&otwartaGrupa!==grupa.id;
        const licznikGrupy=grupa.elementy.reduce((s,p)=>s+(powiadomienia[p[0]]||0),0);
        return `<section class="admin-nav-group ${aktywnaGrupa?"is-active":""} ${zwinieta?"collapsed":""}" data-admin-menu-group="${esc(grupa.id)}"><button type="button" class="admin-nav-group-toggle" onclick="przelaczGrupeMenuAdmina('${esc(grupa.id)}',this)" title="${esc(grupa.nazwa)} — ${esc(grupa.opis||"")}" aria-expanded="${String(!zwinieta)}"><span class="admin-nav-group-title"><i>${grupa.ikona}</i><span><b>${esc(grupa.nazwa)}</b><small>${esc(grupa.opis||"")}</small></span></span><span class="admin-nav-group-meta">${licznikGrupy?`<b>${licznikGrupy}</b>`:""}<em>⌄</em></span></button><div class="admin-nav-items">${grupa.elementy.map(p=>adminMenuLinkHTML(p,aktywna,powiadomienia)).join("")}</div></section>`;
      }).join("")}
      <div class="admin-nav-footer"><span class="${licznikOperacyjny?"has-work":"is-clear"}"></span><small>${licznikOperacyjny?`${licznikOperacyjny} aktywnych spraw operacyjnych`:"Brak pilnych spraw operacyjnych"}</small></div>
    </aside>
	    <div class="admin-tresc">
      ${adminMenuMobilneHTML(aktywna,powiadomienia,kontekst)}
      <header class="admin-workspace-header"><div class="admin-workspace-context"><button class="admin-history-back" type="button" onclick="adminWrocDoPoprzedniejStrony()" ${adminPoprzedniaTrasa()?`title="Wróć do: ${esc(adminPoprzedniaTrasa())}"`:`disabled title="Brak wcześniejszej strony panelu"`} aria-label="Wróć do poprzedniej strony panelu">←</button><span>${kontekst.ikona}</span><div><small>Panel administratora <i>›</i> ${esc(kontekst.grupa)}</small><b>${esc(kontekst.nazwa)}</b><em>${esc(kontekst.podpis||"")}</em></div></div><div class="admin-workspace-actions"><span class="admin-workspace-health"><i class="${licznikOperacyjny?"has-work":"is-clear"}"></i>${licznikOperacyjny?`${licznikOperacyjny} spraw`:"System gotowy"}</span><button class="btn ghost admin-global-scanner" type="button" onclick="if(typeof magazynGlobalnySkanerOtworz==='function')magazynGlobalnySkanerOtworz();else location.hash='#/admin/magazyn/etykiety-qr'">📷 Skaner</button>${typeof pwaPrzyciskInstalacjiHTML==="function"?pwaPrzyciskInstalacjiHTML():""}${aktywna!=="/admin"?`<a class="btn ghost" href="#/admin">📊 Pulpit</a>`:""}<a class="btn ghost" href="#/konto">👤 Konto</a><a class="btn ghost" href="#/">↗ Sklep</a></div></header>
	      <div class="admin-workspace-content admin-page-pattern admin-unified-view" data-admin-layout="unified-v2" data-admin-route="${esc(aktywna)}">${tresc}</div>
	    </div>
	    ${adminPwaDolneMenuHTML(aktywna,powiadomienia)}
	  </div>`;
}
/* Wykres sprzedaży z ostatnich 7 dni (bez bibliotek — słupki CSS) */
function sprzedaz7dni(){
  const dni = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    dni.push({ start:d.getTime(), koniec:d.getTime()+86400000,
      etykieta:d.toLocaleDateString("pl-PL",{weekday:"short"}), suma:0, ile:0 });
  }
  for(const z of pobierzZamowienia()){
    if(z.status==="anulowane") continue;
    let ts = z.ts;
    if(!ts && z.data){ const m = String(z.data).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); if(m) ts = new Date(+m[3], +m[2]-1, +m[1]).getTime(); }
    if(!ts) continue;
    const dzien = dni.find(d=>ts>=d.start && ts<d.koniec);
    if(dzien){ dzien.suma += z.razem; dzien.ile++; }
  }
  return dni;
}
function wykresSprzedazyHTML(){
  const dni = sprzedaz7dni();
  const max = Math.max(1, ...dni.map(d=>d.suma));
  const razem = dni.reduce((s,d)=>s+d.suma,0);
  return `
  <div class="panel">
    <h2 style="margin-top:0">📈 Sprzedaż — ostatnie 7 dni <small style="font-size:.8rem;color:var(--muted2)">razem: ${zl(razem)}</small></h2>
    <div class="wykres">
      ${dni.map(d=>`
        <div class="wykres-kol" title="${d.etykieta}: ${zl(d.suma)} (${d.ile} zam.)">
          <span class="wykres-kwota">${d.suma?zl(d.suma).replace(",00",""):""}</span>
          <div class="wykres-slupek" style="height:${Math.max(4, Math.round(d.suma/max*110))}px;${d.suma?'':'background:var(--line)'}"></div>
          <span class="wykres-dzien">${d.etykieta}</span>
        </div>`).join("")}
    </div>
  </div>`;
}
/* Wydruk zamówienia (potwierdzenie dla klienta / do paczki) */
function drukujZamowienie(nr){
  const z = pobierzZamowienia().find(x=>x.nr===nr);
  if(!z){ toast("Nie znaleziono zamówienia"); return; }
  const obszar = $("obszarWydruku");
  obszar.innerHTML = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px">
        <div><h1 style="margin:0;font-size:22px">${esc(KONFIG.nazwaSklepu)}</h1>
        <small>${esc(KONFIG.emailSklepu)} • ${esc(KONFIG.telefon)}</small></div>
        <div style="text-align:right"><b>ZAMÓWIENIE ${esc(z.nr)}</b><br><small>${esc(z.data)}</small><br><small>Status: ${esc(z.status)}</small></div>
      </div>
      <p><b>Klient:</b> ${z.email?esc(z.email):"gość (bez konta)"}<br><b>Adres:</b> ${esc(z.adres||"—")}<br><b>Dostawa:</b> ${esc(z.dostawa||"—")} • <b>Płatność:</b> ${esc(z.platnosc||"—")}</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0">
        <tr style="border-bottom:1px solid #999"><th style="text-align:left;padding:6px 0">Pozycja</th></tr>
        ${z.pozycje.map(p=>`<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 0">${esc(p)}</td></tr>`).join("")}
      </table>
      <div class="summary" style="margin:12px 0">${podsumowanieKosztowHTML(z,"RAZEM")}</div>
      <p style="font-size:11px;color:#666">Dokument wygenerowany ${new Date().toLocaleString("pl-PL")}. Nie stanowi faktury VAT.</p>
    </div>`;
  document.body.classList.add("drukowanie");
  loguj("info","Wydrukowano zamówienie "+nr);
  window.print();
  setTimeout(()=>{ document.body.classList.remove("drukowanie"); obszar.innerHTML=""; }, 400);
}
/* Centrum wysyłek. Dane i etykieta robocza działają lokalnie.
   Oficjalne etykiety, webhooki i automatyczna poczta wymagają backendu. */
