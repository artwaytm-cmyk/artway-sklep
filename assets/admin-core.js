/* GENERATED ADMIN CORE — edit src/frontend/*.js and run npm run build */
/* Personalizacja = wszystkie ustawienia wyglądu i sklepu w JEDNYM miejscu,
   podzielone na zakładki. Stare adresy (#/admin/wyglad itd.) dalej działają
   i otwierają właściwą zakładkę.                                          */
let chmuraOdswiezanieSesji=null;
async function chmuraOdswiezSesjeAdministratora(force=false){
  if(!sesja||!jestAdmin())return false;
  const last=Number(wczytajLS("artway_admin_session_refreshed_at",0))||0;
  const refreshAfter=Math.max(5,Math.floor((typeof adminIdleTimeoutMinutes==="function"?adminIdleTimeoutMinutes():60)/2))*60*1000;
  if(!force&&Date.now()-last<refreshAfter)return true;
  if(chmuraOdswiezanieSesji)return chmuraOdswiezanieSesji;
  chmuraOdswiezanieSesji=(async()=>{try{const d=await chmura("session-refresh",{method:"POST",timeout:9000});if(!d.authenticated)return false;sesja={...sesja,...(d.user||{}),verified:true};delete sesja.token;zapiszLS("artway_sesja",sesja);zapiszLS("artway_admin_session_refreshed_at",Date.now());chmuraStan={...chmuraStan,dostepna:true,admin:true,error:""};return true;}catch(e){return false;}finally{chmuraOdswiezanieSesji=null;}})();
  return chmuraOdswiezanieSesji;
}
async function testujEmailPolaczenie(cicho=false){
  if(!maUprawnieniaZapisuChmury()){if(!cicho)chmuraUstawToken();return false;}
  try{const d=await chmura("email-test",{method:"POST",body:{source:"admin-integration-center"},timeout:18000});stanBramki={...stanBramki,email:{...(d.email||{}),authenticated:true},emailError:""};if(!cicho){toast("Poczta Gmail jest połączona trwale z serwerem ✅");renderuj();}return true;}
  catch(bl){stanBramki={...stanBramki,email:{...(stanBramki.email||{}),...(bl.email||{}),authenticated:false,lastError:bl.message,lastErrorCode:bl.code||"email_error"},emailError:bl.message};if(!cicho){toast("Poczta: "+bl.message);renderuj();}return false;}
}
async function sprawdzPolaczeniaSerwerowe(cicho=false){
  if(testIntegracjiWToku||!maUprawnieniaZapisuChmury()){if(!cicho&&!maUprawnieniaZapisuChmury())chmuraUstawToken();return false;}
  testIntegracjiWToku=true;try{const [inpost,email]=await Promise.all([testujInPost(true),testujEmailPolaczenie(true)]);ostatniTestIntegracjiSerwerowych=Date.now();if(!cicho)toast(`Kontrola połączeń: InPost ${inpost?"✅":"❌"} • e-mail ${email?"✅":"❌"}`);renderuj();return inpost&&email;}finally{testIntegracjiWToku=false;}
}
const TABY_PERSONALIZACJI = [
  ["home","🏠 Strona główna"], ["wyglad","🎨 Układ globalny"], ["rozmieszczenie","🧭 Rozmieszczenie"], ["bannery","🖼️ Kreator bannerów"],
  ["ikony","✨ Ikony AI"], ["rabaty","🎁 Kody rabatowe","#/admin/asortyment/rabaty"], ["podstrony","🧱 Układ podstron"], ["strony","📄 Treści prawne"], ["dostawy","🚚 Dostawa i płatności"]
];
function personalizacjaSzkielet(tab, tresc){
  return adminSzkielet("/admin/personalizacja", `
    <div class="module-page-stack personalization-workspace">
      <header class="personalization-commandbar"><div><span class="order-pro-label">Projekt sklepu</span><b>Personalizacja wszystkich ekranów</b><small>Strona główna, układ globalny, bannery, podstrony i treści działają ze wspólnej konfiguracji.</small></div><div class="diag-actions"><span class="personalization-save-state">● Wspólna baza aktywna</span><a class="btn ghost" href="#/">👁️ Podgląd sklepu</a><a class="btn" href="#/admin/system">🛠️ Stan systemu</a></div></header>
      ${adminSubnavHTML(TABY_PERSONALIZACJI.map(([id,label,href])=>({id,href:href||`#/admin/personalizacja/${id}`,label})),tab)}
      ${tresc}
    </div>`);
}
/* Asortyment = produkty, katalogi, mapowanie i rabaty w JEDNYM dziale z zakładkami */
const TABY_ASORTYMENTU = [
  ["produkty","🏷️ Produkty"], ["jakosc","🧪 Jakość katalogu"], ["kategorie","🗂️ Katalogi"], ["mapowanie","🧩 Mapowanie"], ["rabaty","🎁 Kody rabatowe"], ["opinie","⭐ Opinie"]
];
function asortymentSzkielet(tab, tresc){
  return adminSzkielet("/admin/asortyment", `
    <div class="module-page-stack assortment-module-page">
      ${adminSubnavHTML(TABY_ASORTYMENTU.map(([id,label])=>({id,href:`#/admin/asortyment/${id}`,label})),tab)}
      ${tresc}
    </div>`);
}
function adminSubnavHTML(items, aktywny){
  const safe=(items||[]).filter(x=>x&&x.id&&x.href&&x.label);
  return `<nav class="panel admin-tabs-panel module-tabs-panel" aria-label="Podsekcje panelu"><div class="shipping-tabs admin-main-tabs">${safe.map(x=>`<a class="${x.id===aktywny?"active":""}" href="${esc(x.href)}" ${x.id===aktywny?'aria-current="page"':""} title="${esc(x.label)}"><span class="tab-label">${esc(x.label)}</span>${x.badge?`<span class="nav-badge">${esc(x.badge)}</span>`:""}</a>`).join("")}</div></nav>`;
}

// Wspólne kontrolki plików muszą być dostępne w rdzeniu panelu. Korzystają
// z nich zarówno edytor produktu, jak i personalizacja ładowane osobno.
function wgrajObrazek(input,maxSzer,poWgraniu){
  const plik=input.files&&input.files[0];
  if(!plik)return;
  if(!plik.type.startsWith("image/")){toast("⚠️ Wybierz plik graficzny (JPG/PNG)");return;}
  const czytnik=new FileReader();
  czytnik.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const skala=Math.min(1,maxSzer/img.width),c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(img.width*skala));c.height=Math.max(1,Math.round(img.height*skala));
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        const png=plik.type==="image/png"&&plik.size<300_000;
        let dataUrl=png?c.toDataURL("image/png"):c.toDataURL("image/jpeg",.82);
        if(dataUrl.length>900_000)dataUrl=c.toDataURL("image/jpeg",.6);
        if(dataUrl.length>1_200_000){toast("⚠️ Obrazek za duży nawet po kompresji — wybierz mniejszy");return;}
        poWgraniu(dataUrl);
      }catch(error){loguj("blad","Kompresja obrazka nie powiodła się: "+error.message);toast("⚠️ Nie udało się przetworzyć obrazka");}
    };
    img.onerror=()=>{toast("⚠️ Nie udało się odczytać obrazka");loguj("ostrzezenie","Błąd odczytu wgrywanego obrazka");};
    img.src=czytnik.result;
  };
  czytnik.readAsDataURL(plik);
}
function polePlikuHTML(onchange,etykieta){
  return `<label class="btn ghost" style="cursor:pointer;white-space:nowrap">📁 ${etykieta||"Wgraj z dysku"}<input type="file" accept="image/*" style="display:none" onchange="${onchange}"></label>`;
}
function eksportSubnavHTML(aktywny="import"){return adminSubnavHTML([{id:"import",href:"#/admin/eksport",label:"📥 Import produktów"},{id:"eksport",href:"#/admin/eksport/eksport",label:"📤 Eksport produktów"},{id:"kopie",href:"#/admin/eksport/kopie",label:"💾 Kopie i raporty"}],aktywny);}
function systemSubnavHTML(aktywny="status"){return adminSubnavHTML([{id:"status",href:"#/admin/system",label:"📡 Wersja i aktualizacja"},{id:"diagnostyka",href:"#/admin/system/diagnostyka",label:"🩺 Diagnostyka"},{id:"logi",href:"#/admin/system/logi",label:"📋 Dziennik"},{id:"kopie",href:"#/admin/system/kopie",label:"💾 Kopie danych"}],aktywny);}
function infaktSubnavHTML(aktywny="pulpit"){return adminSubnavHTML([{id:"pulpit",label:"📊 Pulpit",href:"#/admin/infakt"},{id:"zamowienia",label:"📦 Zamówienia do faktury",href:"#/admin/infakt/zamowienia"},{id:"faktury",label:"🧾 Faktury inFakt",href:"#/admin/infakt/faktury"},{id:"wysylki",label:"📮 Rozliczenia InPost",href:"#/admin/infakt/wysylki"},{id:"dostawcy",label:"🏭 Faktury dostawców",href:"#/admin/infakt/dostawcy"},{id:"szkice",label:"📝 Szkice robocze",href:"#/admin/infakt/szkice"},{id:"ustawienia",label:"⚙️ Dostęp API",href:"#/admin/infakt/ustawienia"}],aktywny);}
function allegroDataTxt(v){const t=Date.parse(v||"");return t?new Date(t).toLocaleString("pl-PL"):"—";}

/* Jeden standard wyszukiwania w całym panelu: zwijany nagłówek, opis,
   licznik wyników i responsywna siatka. Poszczególne domeny przekazują tylko pola. */
function adminWyszukiwaniePanelHTML({id="filtry",title="Wyszukiwanie zaawansowane",description="Wyszukuj i zawężaj wyniki bez opuszczania podstrony.",fields="",actions="",results="",active=false,open=true}={}){
  return `<details class="admin-search-standard" data-admin-search-panel="${esc(id)}" ${(open||active)?"open":""}><summary><span><b>🔎 ${esc(title)}</b><small>${esc(description)}</small></span><span class="admin-search-summary-meta">${active?`<em>Aktywne filtry</em>`:""}${results!==""?`<strong>${esc(results)} wyników</strong>`:""}<i aria-hidden="true"></i></span></summary><div class="admin-search-standard-body">${fields}${actions?`<div class="admin-search-standard-actions">${actions}</div>`:""}</div></details>`;
}
function adminOperacjeWynikowHTML({id="wyniki",selected=0,pageCount=0,resultCount=0,selectPage="",selectAll="",clear="",exportSelected="",exportAll="",exportLabel="CSV",extra=""}={}){
  const n=Math.max(0,Number(selected)||0),page=Math.max(0,Number(pageCount)||0),results=Math.max(0,Number(resultCount)||0);
  return `<div class="admin-results-operations" data-admin-results-operations="${esc(id)}"><div class="admin-results-operations-summary"><b>Operacje na wynikach</b><small>Wybrano <strong data-admin-selected-count>${n}</strong> • ${results} wyników po filtrach</small></div><div class="admin-results-selection">${selectPage?`<button class="btn ghost" type="button" onclick="${selectPage}">☑️ Zaznacz stronę (${page})</button>`:""}${selectAll?`<button class="btn ghost" type="button" onclick="${selectAll}">☑️ Zaznacz wszystkie wyniki (${results})</button>`:""}${clear?`<button class="btn ghost" data-admin-selected-required type="button" onclick="${clear}" ${n?"":"disabled"}>☐ Odznacz (<span data-admin-selected-count>${n}</span>)</button>`:""}</div>${exportSelected||exportAll?`<details class="admin-results-export"><summary>📤 Eksportuj plik</summary><div>${exportSelected?`<button class="btn ghost" data-admin-selected-required type="button" onclick="${exportSelected}" ${n?"":"disabled"}>Zaznaczone (<span data-admin-selected-count>${n}</span>) — ${esc(exportLabel)}</button>`:""}${exportAll?`<button class="btn ghost" type="button" onclick="${exportAll}" ${results?"":"disabled"}>Wszystkie wyniki (${results}) — ${esc(exportLabel)}</button>`:""}</div></details>`:""}${extra?`<div class="admin-results-extra">${extra}</div>`:""}</div>`;
}
function adminEksportujCSV(nazwa,naglowki,wiersze){
  const quote=value=>`"${String(value??"").replace(/"/g,'""')}"`,rows=Array.isArray(wiersze)?wiersze:[];
  if(!rows.length){toast("Brak danych do eksportu");return false;}
  const csv=[(naglowki||[]).map(quote).join(";"),...rows.map(row=>(Array.isArray(row)?row:[]).map(quote).join(";"))].join("\n");
  pobierzPlik(nazwa||"wyniki.csv","\uFEFF"+csv,"text/csv");toast(`Wyeksportowano ${rows.length} pozycji ✅`);return true;
}
const EMOJI_ZESTAWY=[
  {nazwa:"🎲 Gry, zabawki i edukacja",slowa:"gry zabawki planszowe edukacja puzzle",emoji:["🎲","🧩","♟️","♞","🃏","🎯","🎮","🕹️","🪀","🪁","🧸","🤖","🧠","🔤","🔢","🧮","📚","📖","✏️","🖍️","🎨","🧪","🔬","🔭","🏆","🎳","⚽","🏀","🏓","🥏"]},
  {nazwa:"🎈 Balony, impreza i prezenty",slowa:"balony balon impreza urodziny prezent dekoracje",emoji:["🎈","🎉","🎊","🥳","🎁","🎀","🪅","🪩","🎂","🧁","🍭","🍬","✨","🌟","⭐","💫","❤️","🩷","🧡","💛","💚","🩵","💙","💜","🤍","🖤","🎵","🎶","📣","🔔"]},
  {nazwa:"🧒 Dzieci i kreatywność",slowa:"dzieci kreatywne plastyczne",emoji:["👶","🧒","👧","👦","🍼","🛝","🎠","🎡","🏰","🦄","🐸","🐻","🐼","🐰","🐣","🦋","🌈","☀️","🌙","☁️","🌸","🌻","🍀","🖌️","✂️"]},
  {nazwa:"📦 Sklep i dostawa",slowa:"sklep produkt paczka dostawa promocja",emoji:["📦","🛍️","🛒","🏷️","💰","💳","🧾","🚚","🚛","🚲","✈️","📍","🏪","🏬","✅","🆕","🔥","💥","📢","🔎"]},
  {nazwa:"🏠 Dom, ogród i pozostałe",slowa:"dom ogród narzędzia elektronika sport",emoji:["🏠","🪴","🌿","🌳","🌼","💡","🔧","🧰","🔨","📏","🔦","📱","💻","⌚","📷","🎧","🔋","⚙️","🚗","🚴","🏋️","🧘","👕","👟","🎒"]}
];
let emojiPoleDocelowe=null;
function emojiPoleHTML(nazwa="ikona",wartosc="",fallback="📦"){return `<div class="emoji-input-row"><input name="${esc(nazwa)}" value="${esc(wartosc||"")}" placeholder="${esc(fallback)}" maxlength="8"><button class="btn ghost" type="button" onclick="otworzWyborEmoji(this,${jsArg(nazwa)})">😀 Wybierz z dużej listy</button></div>`;}
function otworzWyborEmoji(btn,nazwa="ikona"){
  const form=btn?.closest?.("form");emojiPoleDocelowe=form?.elements?.[nazwa]||null;if(!emojiPoleDocelowe){toast("Nie znaleziono pola ikony");return;}
  document.getElementById("emojiPickerModal")?.remove();const modal=document.createElement("div");modal.id="emojiPickerModal";modal.className="emoji-picker-overlay";
  modal.innerHTML=`<div class="emoji-picker-modal" onclick="event.stopPropagation()"><div class="emoji-picker-head"><div><h2>😀 Wybierz emoji</h2><p>Duży zestaw ikon — gry i balony są na początku.</p></div><button class="btn ghost" type="button" onclick="zamknijWyborEmoji()">✕ Zamknij</button></div><input class="emoji-picker-search" placeholder="Szukaj grupy: gry, balony, dostawa…" oninput="filtrujWyborEmoji(this.value)"><div class="emoji-picker-groups">${EMOJI_ZESTAWY.map(g=>`<section class="emoji-picker-group" data-search="${esc((g.nazwa+' '+g.slowa).toLowerCase())}"><h3>${esc(g.nazwa)}</h3><div class="emoji-picker-grid">${g.emoji.map(e=>`<button type="button" title="${esc(g.nazwa)}" onclick="wybierzEmoji(${jsArg(e)})">${esc(e)}</button>`).join("")}</div></section>`).join("")}</div></div>`;
  modal.onclick=zamknijWyborEmoji;document.body.appendChild(modal);modal.querySelector(".emoji-picker-search")?.focus();
}
function filtrujWyborEmoji(q){const s=String(q||"").trim().toLowerCase();document.querySelectorAll("#emojiPickerModal .emoji-picker-group").forEach(el=>{el.style.display=!s||String(el.dataset.search||"").includes(s)?"":"none";});}
function wybierzEmoji(emoji){if(emojiPoleDocelowe){emojiPoleDocelowe.value=emoji;emojiPoleDocelowe.dispatchEvent(new Event("input",{bubbles:true}));}zamknijWyborEmoji();}
function zamknijWyborEmoji(){document.getElementById("emojiPickerModal")?.remove();emojiPoleDocelowe=null;}
