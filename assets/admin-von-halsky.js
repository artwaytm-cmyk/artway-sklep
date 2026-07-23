/* GENERATED ADMIN VON HALSKY — loaded on demand */
const vonHalskyStan={
  loaded:false,loading:false,error:"",config:{configured:false,missingEnv:[]},
  settings:{integrationMethod:"api",integrator:"",channelAlias:"VH",merchantStoreName:"Artway-TM",notificationEmail:"",minimumStock:1,maximumStock:25,syncIntervalMinutes:15,automaticPriceSync:true,automaticStockSync:true,automaticResume:true,customerZone:true,onboarding:{}},
  sync:{status:"not_connected",lastCatalogAt:null,lastOrdersAt:null,lastError:""}
};
let vonHalskySzukaj="",vonHalskyFiltr="wszystkie",vonHalskySort="jakosc",vonHalskyStrona=1,vonHalskyNaStronie=50;
const vonHalskyZaznaczone=new Set();

async function vonHalskyLaduj(force=false){
  if(vonHalskyStan.loading||(!force&&vonHalskyStan.loaded))return;
  vonHalskyStan.loading=true;vonHalskyStan.error="";
  try{
    const data=await chmura("von-halsky-overview",{timeout:20000});
    Object.assign(vonHalskyStan,{loaded:true,config:data.config||{},settings:{...vonHalskyStan.settings,...(data.settings||{})},sync:data.sync||vonHalskyStan.sync,updatedAt:data.updatedAt||null});
  }catch(error){vonHalskyStan.error=String(error?.message||error);}
  vonHalskyStan.loading=false;
  if(String(trasa()).startsWith("/admin/von-halsky"))renderuj();
}

function vonHalskyOpisProduktu(product={}){
  return String(product.opisAllegro||product.opis||product.dlugiOpis||product.description||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function vonHalskyGtin(product={}){
  const digits=String(product.gtin||product.ean||product.EAN||"").replace(/\D/g,"");
  return [8,12,13,14].includes(digits.length)?digits:"";
}
function vonHalskyKodProducenta(product={}){
  return String(product.kodProducenta||product.mpn||product.externalId||product.sku||"").trim();
}
function vonHalskyOcenaProduktu(product={}){
  const nazwa=String(product.nazwa||product.name||"").trim(),opis=vonHalskyOpisProduktu(product),ean=vonHalskyGtin(product);
  const kod=vonHalskyKodProducenta(product),marka=String(product.marka||product.producent||"").trim(),zdjecie=String(product.zdjecie||product.image||"").trim();
  const cena=Number(product.cena??product.price),braki=[];
  if(nazwa.length<7||nazwa.length>150)braki.push("Nazwa 7–150 znaków");
  if(opis.length<100)braki.push("Opis minimum 100 znaków");
  if(/https?:\/\/|www\./i.test(opis))braki.push("Usuń linki z opisu");
  if(!ean&&!(kod&&marka))braki.push("EAN albo kod producenta + marka");
  if(!zdjecie)braki.push("Zdjęcie");
  if(!Number.isFinite(cena)||cena<=0)braki.push("Cena");
  const dostepny=typeof produktDostepnyWSprzedazy==="function"?produktDostepnyWSprzedazy(product):product.sprzedazAktywna!==false;
  if(!dostepny)braki.push("Sprzedaż wstrzymana");
  const ofertaId=String(product.vonHalskyOfferId||product.inpostBuyOfferId||"");
  return {gotowy:braki.length===0,wynik:Math.max(0,Math.round(100-braki.length*16)),braki,ean,kod,marka,opis,nazwa,cena:Number.isFinite(cena)?cena:0,dostepny,ofertaId};
}
function vonHalskyProdukty(){
  return produktyDoAdministracji().filter(product=>!czyProduktAdminWKoszu(product)&&!produktyDefinitywne.some(id=>String(id)===String(product.id)));
}
function vonHalskyWiersze(){
  const q=normalizujSzukanyTekst(vonHalskySzukaj),terms=q.split(" ").filter(Boolean);
  const rows=vonHalskyProdukty().map(product=>({product,quality:vonHalskyOcenaProduktu(product)})).filter(({product,quality})=>{
    const searchable=normalizujSzukanyTekst([product.nazwa,product.externalId,product.sku,quality.ean,quality.kod,quality.marka,product.kategoria].join(" "));
    if(terms.some(term=>!searchable.includes(term)))return false;
    if(vonHalskyFiltr==="gotowe"&&!quality.gotowy)return false;
    if(vonHalskyFiltr==="braki"&&quality.gotowy)return false;
    if(vonHalskyFiltr==="ean"&&!quality.ean)return false;
    if(vonHalskyFiltr==="bez-ean"&&quality.ean)return false;
    if(vonHalskyFiltr==="aktywne"&&!quality.ofertaId)return false;
    if(vonHalskyFiltr==="wstrzymane"&&quality.dostepny)return false;
    return true;
  });
  rows.sort((left,right)=>{
    if(vonHalskySort==="nazwa")return left.quality.nazwa.localeCompare(right.quality.nazwa,"pl");
    if(vonHalskySort==="ean")return String(left.quality.ean||"~").localeCompare(String(right.quality.ean||"~"));
    if(vonHalskySort==="cena")return right.quality.cena-left.quality.cena;
    return left.quality.wynik-right.quality.wynik||left.quality.nazwa.localeCompare(right.quality.nazwa,"pl");
  });
  return rows;
}
function vonHalskyStatystyki(){
  const rows=vonHalskyProdukty().map(product=>vonHalskyOcenaProduktu(product));
  return {wszystkie:rows.length,gotowe:rows.filter(x=>x.gotowy).length,braki:rows.filter(x=>!x.gotowy).length,ean:rows.filter(x=>x.ean).length,aktywne:rows.filter(x=>x.ofertaId).length,wstrzymane:rows.filter(x=>!x.dostepny).length};
}
function vonHalskySubnavHTML(aktywny="pulpit"){
  const stats=vonHalskyStatystyki();
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/von-halsky",label:"📊 Pulpit"},
    {id:"oferty",href:"#/admin/von-halsky/oferty",label:"🏷️ Oferty",badge:stats.braki||""},
    {id:"powiazania",href:"#/admin/von-halsky/powiazania",label:"🔗 Powiązania",badge:Math.max(0,stats.wszystkie-stats.ean)||""},
    {id:"zamowienia",href:"#/admin/von-halsky/zamowienia",label:"📦 Zamówienia"},
    {id:"ustawienia",href:"#/admin/von-halsky/ustawienia",label:"⚙️ Ustawienia"}
  ],aktywny);
}
function vonHalskyNaglowekHTML(aktywny="pulpit"){
  const stats=vonHalskyStatystyki(),cfg={
    pulpit:["🐕","Nowy kanał sprzedaży","InPost Von Halsky","Katalog produktów sklepu, gotowość integracji i operacje kanału InPost+ w jednym miejscu.",[["Gotowe produkty",stats.gotowe],["Do uzupełnienia",stats.braki],["Integracja",vonHalskyPolaczenieEtykieta()]]],
    oferty:["🏷️","Katalog kanału","Oferty Von Halsky","Jedna kartoteka sklepu zasila oferty. Kontrola jakości pilnuje zasad InPost przed przekazaniem katalogu.",[["Wszystkie",stats.wszystkie],["Gotowe",stats.gotowe],["Aktywne",stats.aktywne]]],
    powiazania:["🔗","Produktyzacja","Powiązania produktów","EAN jest identyfikatorem pierwszego wyboru. Bez EAN wymagane są jednocześnie kod producenta i marka.",[["Z EAN",stats.ean],["Bez EAN",stats.wszystkie-stats.ean],["Gotowe",stats.gotowe]]],
    zamowienia:["📦","Obsługa sprzedaży","Zamówienia InPost+","Po połączeniu kanału nowe zamówienia trafią do tej kolejki jako całe zlecenia, a wysyłka pozostanie w Centrum wysyłek.",[["Połączenie",vonHalskyPolaczenieEtykieta()],["Ostatni odczyt",allegroDataTxt(vonHalskyStan.sync?.lastOrdersAt)],["Kanał","InPost+"]]],
    ustawienia:["⚙️","Portal Merchanta","Integracja i synchronizacja","Wybierz jedną metodę integracji, skonfiguruj politykę stanów i przejdź bezpiecznie przez onboarding.",[["Metoda",vonHalskyStan.settings.integrationMethod==="api"?"Bezpośrednie API":"Integrator"],["Interwał",`${vonHalskyStan.settings.syncIntervalMinutes||15} min`],["Dane API",vonHalskyStan.config.configured?"gotowe":"oczekują"]]]
  }[aktywny]||[];
  return `<section class="panel von-halsky-workspace-head"><div class="von-halsky-workspace-title"><span>${cfg[0]}</span><div><small>${esc(cfg[1])}</small><h1>${esc(cfg[2])}</h1><p>${esc(cfg[3])}</p></div></div><div class="von-halsky-workspace-metrics">${(cfg[4]||[]).map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div></section>`;
}
function vonHalskyPolaczenieEtykieta(){
  if(vonHalskyStan.settings.integrationMethod==="integrator"&&vonHalskyStan.settings.onboarding?.catalogConnection)return "połączone";
  if(vonHalskyStan.config.configured)return "dane gotowe";
  return "do konfiguracji";
}
function vonHalskyEtapy(){
  const onboarding=vonHalskyStan.settings.onboarding||{};
  return [
    ["merchantAccount","Konto w Portalu Merchanta","Dane firmy i rachunek bankowy"],
    ["merchantProfile","Konfiguracja sklepu","Nazwa, kontakt, wysyłka i zwroty"],
    ["paymentKyc","Bramka płatnicza i KYC","Pozytywna weryfikacja płatności"],
    ["technicalDocs","Dokumentacja techniczna","Dokumentacja API albo instrukcja integratora"],
    ["catalogConnection","Połączenie katalogu","Autoryzacja i pierwszy odczyt kanału"]
  ].map(([id,title,desc])=>({id,title,desc,done:onboarding[id]===true}));
}
function vonHalskyPulpitHTML(){
  const stats=vonHalskyStatystyki(),steps=vonHalskyEtapy(),done=steps.filter(step=>step.done).length,percent=Math.round(done/steps.length*100);
  return `<div class="von-halsky-dashboard">
    <section class="panel von-halsky-hero"><div><span class="order-pro-label">InPost Mobile • kanał sprzedaży AI</span><h2>Przygotuj Artway-TM do sprzedaży z Von Halskym</h2><p>To odrębny kanał sprzedaży, nie moduł nadawania paczek. Produkty pozostają w jednej kartotece Artway-TM, a do InPost trafia wyłącznie bezpieczny widok oferty.</p><div class="diag-actions"><a class="btn" href="#/admin/von-halsky/oferty">Sprawdź katalog produktów</a><a class="btn ghost" href="#/admin/von-halsky/ustawienia">Dokończ integrację</a></div></div><div class="von-halsky-progress"><strong>${percent}%</strong><span>gotowości onboardingu</span><div><i style="width:${percent}%"></i></div><small>${done} z ${steps.length} etapów potwierdzonych</small></div></section>
    <section class="von-halsky-stat-grid">${[["📚",stats.wszystkie,"produktów w kartotece","wszystkie"],["✅",stats.gotowe,"gotowych do kanału","gotowe"],["⚠️",stats.braki,"wymaga uzupełnienia","braki"],["🔢",stats.ean,"z poprawnym EAN","ean"]].map(([icon,count,label,filter])=>`<a href="#/admin/von-halsky/oferty" onclick="vonHalskyFiltr=${jsArg(filter)}"><span>${icon}</span><b>${count}</b><small>${label}</small></a>`).join("")}</section>
    <section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Proces uruchomienia</span><h2>Onboarding kanału</h2><p class="order-detail-lead">InPost pozwala korzystać w danym momencie tylko z jednego integratora. Zmiana metody wymaga kontaktu z opiekunem kanału.</p></div><a class="btn ghost" href="https://inpost.pl/aktualnosci-inpost-von-halsky-onboarding" target="_blank" rel="noopener">Instrukcja InPost ↗</a></div><div class="von-halsky-steps">${steps.map((step,index)=>`<article class="${step.done?"done":""}"><span>${step.done?"✓":index+1}</span><div><b>${esc(step.title)}</b><small>${esc(step.desc)}</small></div><em>${step.done?"gotowe":"oczekuje"}</em></article>`).join("")}</div></section>
    <section class="panel von-halsky-channel-rules"><div><b>Jedna kartoteka produktów</b><small>Cena, stan, dostępność i opisy pozostają własnością katalogu Artway-TM. Von Halsky otrzymuje ich kanałową projekcję.</small></div><div><b>Oferty oceniane przez AI InPost</b><small>Nazwa 7–150 znaków, opis minimum 100 znaków, zdjęcie bez znaku wodnego i identyfikator produktu.</small></div><div><b>Wysyłka bez duplikowania</b><small>Zamówienie trafi do obsługi sprzedaży, a etykieta Paczkomat lub Kurier powstanie w istniejącym Centrum wysyłek.</small></div></section>
  </div>`;
}
function vonHalskyUstawZaznaczenie(ids=[],checked=true){
  for(const id of ids)checked?vonHalskyZaznaczone.add(String(id)):vonHalskyZaznaczone.delete(String(id));
  renderuj();
}
function vonHalskyEksportuj(scope="selected"){
  const allowed=scope==="selected"?vonHalskyZaznaczone:null;
  const rows=vonHalskyWiersze().filter(({product})=>!allowed||allowed.has(String(product.id)));
  adminEksportujCSV(`von-halsky-katalog-${new Date().toISOString().slice(0,10)}.csv`,
    ["EXTERNAL_ID","EAN","Kod producenta","Marka","Nazwa","Opis","Cena PLN","Stan maksymalny","Gotowość","Braki"],
    rows.map(({product,quality})=>[product.externalId||product.sku||product.id,quality.ean,quality.kod,quality.marka,quality.nazwa,quality.opis,quality.cena,vonHalskyStan.settings.maximumStock,quality.gotowy?"gotowy":"wymaga poprawy",quality.braki.join(" | ")]));
}
function vonHalskyFiltryHTML(rows){
  const fields=`<label class="search-wide">Produkt lub identyfikator<input placeholder="Nazwa, EAN, EXTERNAL_ID, SKU, producent, kategoria…" value="${esc(vonHalskySzukaj)}" oninput="vonHalskySzukaj=this.value;vonHalskyStrona=1;zaplanujRenderPoWpisaniu()"></label><label>Gotowość<select onchange="vonHalskyFiltr=this.value;vonHalskyStrona=1;renderuj()">${[["wszystkie","Wszystkie produkty"],["gotowe","Gotowe do kanału"],["braki","Wymaga uzupełnienia"],["ean","Z poprawnym EAN"],["bez-ean","Bez EAN"],["aktywne","Aktywne w Von Halsky"],["wstrzymane","Sprzedaż wstrzymana"]].map(([value,label])=>`<option value="${value}" ${vonHalskyFiltr===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Sortowanie<select onchange="vonHalskySort=this.value;renderuj()">${[["jakosc","Najpierw wymagające pracy"],["nazwa","Nazwa A–Z"],["ean","EAN"],["cena","Cena malejąco"]].map(([value,label])=>`<option value="${value}" ${vonHalskySort===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Na stronie<select onchange="vonHalskyNaStronie=Number(this.value);vonHalskyStrona=1;renderuj()">${[25,50,100,250].map(value=>`<option ${vonHalskyNaStronie===value?"selected":""}>${value}</option>`).join("")}</select></label><button class="btn ghost" onclick="vonHalskySzukaj='';vonHalskyFiltr='wszystkie';vonHalskySort='jakosc';vonHalskyStrona=1;renderuj()">Wyczyść filtry</button>`;
  return adminWyszukiwaniePanelHTML({id:"von-halsky-products",title:"Wyszukiwanie katalogu Von Halsky",description:"Filtruj po nazwie, identyfikatorach, producencie, jakości danych i stanie kanału.",fields,results:rows.length,active:!!(vonHalskySzukaj||vonHalskyFiltr!=="wszystkie"||vonHalskySort!=="jakosc"),open:true});
}
function vonHalskyOfertyHTML(mode="oferty"){
  const rows=vonHalskyWiersze(),pages=Math.max(1,Math.ceil(rows.length/vonHalskyNaStronie));vonHalskyStrona=Math.min(vonHalskyStrona,pages);
  const start=(vonHalskyStrona-1)*vonHalskyNaStronie,visible=rows.slice(start,start+vonHalskyNaStronie),visibleIds=visible.map(({product})=>String(product.id)),selected=[...vonHalskyZaznaczone].filter(id=>rows.some(({product})=>String(product.id)===id));
  return `<section class="panel von-halsky-catalog-panel"><div class="order-section-head"><div><span class="order-pro-label">${mode==="powiazania"?"Produktyzacja":"Katalog ofert"}</span><h2>${mode==="powiazania"?"Powiązania z kartami produktów InPost":"Produkty przygotowywane do Von Halsky"}</h2><p class="order-detail-lead">${mode==="powiazania"?"Najpierw jednoznaczny EAN. Jeżeli go nie ma, dopuszczalne jest połączenie kodu producenta i marki; nie zgadujemy produktu wyłącznie po nazwie.":"Ocena odzwierciedla oficjalne wymagania InPost. Eksport jest paczką kontrolną, nie udaje publikacji bez aktywnego API."}</p></div><button class="btn ghost" onclick="vonHalskyLaduj(true)">↻ Odśwież status</button></div>
    ${vonHalskyFiltryHTML(rows)}
    ${adminOperacjeWynikowHTML({id:"von-halsky-products",selected:selected.length,pageCount:visible.length,resultCount:rows.length,selectPage:`vonHalskyUstawZaznaczenie(${JSON.stringify(visibleIds)},true)`,selectAll:`vonHalskyUstawZaznaczenie(${JSON.stringify(rows.map(({product})=>String(product.id)))},true)`,clear:"vonHalskyUstawZaznaczenie([...vonHalskyZaznaczone],false)",exportSelected:"vonHalskyEksportuj('selected')",exportAll:"vonHalskyEksportuj('all')",exportLabel:"CSV Von Halsky"})}
    <div class="warehouse-worktable-wrap"><table class="log-table von-halsky-table"><thead><tr><th></th><th>Produkt</th><th>Identyfikacja</th><th>Jakość oferty</th><th>Cena i dostępność</th><th>Status kanału</th><th>Akcje</th></tr></thead><tbody>${visible.map(({product,quality})=>`<tr class="${quality.gotowy?"is-ready":"needs-work"}"><td><input type="checkbox" ${vonHalskyZaznaczone.has(String(product.id))?"checked":""} onchange="vonHalskyUstawZaznaczenie([${jsArg(String(product.id))}],this.checked)"></td><td><div class="von-halsky-product"><span>${product.zdjecie?`<img src="${esc(product.zdjecie)}" loading="lazy" alt="">`:esc(product.ikona||"📦")}</span><div><b>${esc(product.nazwa||"Produkt")}</b><small>${esc(product.kategoria||"bez kategorii")} • ${esc(product.producent||product.marka||"producent —")}</small></div></div></td><td><b>EAN ${esc(quality.ean||"—")}</b><small>EXTERNAL_ID ${esc(product.externalId||"—")}</small><small>Kod producenta ${esc(quality.kod||"—")}</small></td><td><div class="von-halsky-score"><strong>${quality.wynik}%</strong><span><i style="width:${quality.wynik}%"></i></span></div>${quality.braki.length?`<small class="von-halsky-issues">${quality.braki.map(esc).join(" • ")}</small>`:'<small class="von-halsky-ok">Dane spełniają kontrolę wstępną</small>'}</td><td><b>${quality.cena?zl(quality.cena):"—"}</b><small>${quality.dostepny?"sprzedaż aktywna":"sprzedaż wstrzymana"}</small><small>kanał: ${vonHalskyStan.settings.minimumStock}–${vonHalskyStan.settings.maximumStock} szt.</small></td><td><span class="lvl ${quality.ofertaId?"lvl-ok":quality.gotowy?"lvl-info":"lvl-ostrzezenie"}">${quality.ofertaId?"aktywna oferta":quality.gotowy?"gotowy do przekazania":"wymaga danych"}</span>${quality.ofertaId?`<small>ID ${esc(quality.ofertaId)}</small>`:""}</td><td><div class="warehouse-worktable-actions"><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(product.id)}">Edytuj produkt</a>${quality.ofertaId?`<button class="btn ghost" disabled title="Adres oferty zostanie udostępniony przez API kanału">Oferta InPost+</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="7">Brak produktów pasujących do aktywnych filtrów.</td></tr>'}</tbody></table></div>
    <div class="von-halsky-pagination"><button class="btn ghost" ${vonHalskyStrona<=1?"disabled":""} onclick="vonHalskyStrona--;renderuj()">← Poprzednia</button><span>Strona <b>${vonHalskyStrona}</b> z ${pages} • pokazano ${visible.length} z ${rows.length}</span><button class="btn ghost" ${vonHalskyStrona>=pages?"disabled":""} onclick="vonHalskyStrona++;renderuj()">Następna →</button></div>
  </section>`;
}
function vonHalskyZamowieniaHTML(){
  const connected=vonHalskyPolaczenieEtykieta()==="połączone";
  return `<section class="panel von-halsky-orders"><div class="order-section-head"><div><span class="order-pro-label">Nowe i niezrealizowane</span><h2>Kolejka zamówień InPost+</h2><p class="order-detail-lead">Zamówienia będą pobierane jako całe zlecenia. Po imporcie przejdą przez istniejący magazyn, plan zatowarowania i Centrum wysyłek — bez osobnych kopii pozycji.</p></div><a class="btn ghost" href="#/admin/wysylki">Centrum wysyłek</a></div>${connected?`<div class="admin-empty-state"><span>📭</span><h3>Brak nowych zamówień Von Halsky</h3><p>Połączenie jest gotowe, a kolejka nie zawiera obecnie zleceń do obsługi.</p></div>`:`<div class="von-halsky-connection-gate"><span>🔐</span><div><h3>Najpierw dokończ połączenie kanału</h3><p>InPost udostępnia dokumentację API indywidualnie w Portalu Merchanta. Do czasu autoryzacji panel nie generuje przykładowych zamówień i nie pokazuje fałszywego statusu połączenia.</p><a class="btn" href="#/admin/von-halsky/ustawienia">Otwórz ustawienia integracji</a></div></div>`}</section>`;
}
function vonHalskyUstawMetode(select){
  const form=select.form;form?.querySelectorAll("[data-vh-mode]").forEach(section=>section.hidden=section.dataset.vhMode!==select.value);
}
function vonHalskySettingsBody(form){
  const fd=new FormData(form),onboarding={};
  form.querySelectorAll("[name^='onboarding.']").forEach(input=>onboarding[input.name.split(".")[1]]=input.checked);
  return {
    integrationMethod:fd.get("integrationMethod"),integrator:fd.get("integrator"),channelAlias:fd.get("channelAlias"),merchantStoreName:fd.get("merchantStoreName"),notificationEmail:fd.get("notificationEmail"),
    minimumStock:Number(fd.get("minimumStock")),maximumStock:Number(fd.get("maximumStock")),syncIntervalMinutes:Number(fd.get("syncIntervalMinutes")),
    automaticPriceSync:form.automaticPriceSync.checked,automaticStockSync:form.automaticStockSync.checked,automaticResume:form.automaticResume.checked,customerZone:form.customerZone.checked,onboarding
  };
}
async function vonHalskyZapiszUstawienia(event){
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{const data=await chmura("von-halsky-settings",{method:"POST",body:vonHalskySettingsBody(event.currentTarget),timeout:20000});vonHalskyStan.settings={...vonHalskyStan.settings,...data.settings};vonHalskyStan.config=data.config||vonHalskyStan.config;toast("Ustawienia Von Halsky zapisane ✅");renderuj();}catch(error){toast("Nie zapisano ustawień: "+(error.message||error));button.disabled=false;}
}
async function vonHalskySprawdzPolaczenie(){
  try{const data=await chmura("von-halsky-connection-check",{method:"POST",body:{},timeout:20000});toast(data.connected?"Von Halsky połączone ✅":data.message||"Dane integracji są gotowe");}catch(error){toast("Von Halsky: "+(error.message||error));}
}
function vonHalskyUstawieniaHTML(){
  const settings=vonHalskyStan.settings,onboarding=settings.onboarding||{},api=settings.integrationMethod==="api";
  return `<section class="panel von-halsky-settings"><div class="order-section-head"><div><span class="order-pro-label">Jedna aktywna metoda</span><h2>Połączenie InPost Von Halsky</h2><p class="order-detail-lead">Bezpośrednie API wymaga prywatnej dokumentacji i danych wydanych przez InPost. Alternatywą jest jeden autoryzowany integrator.</p></div><button class="btn ghost" onclick="vonHalskySprawdzPolaczenie()">Sprawdź gotowość</button></div>
    <form onsubmit="vonHalskyZapiszUstawienia(event)">
      <fieldset><legend>Metoda integracji</legend><div class="von-halsky-methods"><label class="${api?"active":""}"><input type="radio" name="integrationMethod" value="api" ${api?"checked":""} onchange="vonHalskyUstawMetode(this)"> <span>🔌</span><b>Bezpośrednie API</b><small>Najlepsze dla własnego, rozbudowanego systemu Artway-TM.</small></label><label class="${!api?"active":""}"><input type="radio" name="integrationMethod" value="integrator" ${!api?"checked":""} onchange="vonHalskyUstawMetode(this)"> <span>🧩</span><b>Gotowy integrator</b><small>Base, Apilo, IdoSell, SellAssist, Shoper, AtomStore albo xSale.</small></label></div>
        <div class="von-halsky-method-detail" data-vh-mode="api" ${api?"":"hidden"}><b>${vonHalskyStan.config.configured?"✅ Dane API są zapisane na serwerze":"⏳ Oczekuje na dane z Portalu Merchanta"}</b><p>Klucze nie są zapisywane w przeglądarce ani w bazie ustawień. Wymagane zmienne serwera: ${(vonHalskyStan.config.missingEnv||[]).map(esc).join(", ")||"kompletne"}.</p></div>
        <div class="von-halsky-method-detail" data-vh-mode="integrator" ${!api?"":"hidden"}><label>Integrator<select name="integrator"><option value="">— wybierz po rejestracji —</option>${[["base","Base"],["apilo","Apilo"],["idosell","IdoSell"],["sellassist","SellAssist"],["shoper","Shoper"],["atomstore","AtomStore"],["xsale","xSale"],["other","Inny zatwierdzony"]].map(([value,label])=>`<option value="${value}" ${settings.integrator===value?"selected":""}>${label}</option>`).join("")}</select></label><p>W danej chwili może działać tylko jeden integrator. Zmiana wymaga kontaktu z opiekunem InPost.</p></div>
      </fieldset>
      <fieldset><legend>Sklep i synchronizacja</legend><div class="von-halsky-settings-grid"><label>Nazwa sklepu w Portalu Merchanta<input name="merchantStoreName" value="${esc(settings.merchantStoreName||"Artway-TM")}" required></label><label>Alias zamówień<input name="channelAlias" maxlength="2" pattern="[A-Za-z0-9]{2}" value="${esc(settings.channelAlias||"VH")}" required></label><label>E-mail powiadomień<input name="notificationEmail" type="email" value="${esc(settings.notificationEmail||"")}"></label><label>Synchronizacja co<select name="syncIntervalMinutes">${[15,30,60,180,360,720,1440].map(value=>`<option value="${value}" ${Number(settings.syncIntervalMinutes)===value?"selected":""}>${value<60?value+" min":value/60+" godz."}</option>`).join("")}</select></label><label>Minimalny stan kanału<input name="minimumStock" type="number" min="0" max="99999" value="${esc(settings.minimumStock)}"></label><label>Maksymalny stan pokazywany<input name="maximumStock" type="number" min="1" max="99999" value="${esc(settings.maximumStock)}"></label></div><div class="von-halsky-switches"><label><input type="checkbox" name="automaticPriceSync" ${settings.automaticPriceSync?"checked":""}> Automatycznie aktualizuj ceny</label><label><input type="checkbox" name="automaticStockSync" ${settings.automaticStockSync?"checked":""}> Automatycznie aktualizuj stany</label><label><input type="checkbox" name="automaticResume" ${settings.automaticResume?"checked":""}> Automatycznie wznawiaj po powrocie dostępności</label><label><input type="checkbox" name="customerZone" ${settings.customerZone?"checked":""}> Link strefy klienta w obsłudze zamówienia</label></div></fieldset>
      <fieldset><legend>Lista kontrolna onboardingu</legend><div class="von-halsky-onboarding-checklist">${vonHalskyEtapy().map(step=>`<label><input type="checkbox" name="onboarding.${step.id}" ${onboarding[step.id]?"checked":""}><span><b>${esc(step.title)}</b><small>${esc(step.desc)}</small></span></label>`).join("")}</div></fieldset>
      <div class="von-halsky-settings-footer"><button class="btn" type="submit">Zapisz konfigurację</button><a class="btn ghost" href="https://inpost.pl/aktualnosci-inpost-von-halsky-integracja" target="_blank" rel="noopener">Metody integracji InPost ↗</a><a class="btn ghost" href="https://inpost.pl/aktualnosci/inpost-von-halsky" target="_blank" rel="noopener">Centrum informacji ↗</a></div>
    </form>
  </section>`;
}
function widokAdminVonHalsky(sekcja="pulpit"){
  const aktywna=["oferty","powiazania","zamowienia","ustawienia"].includes(sekcja)?sekcja:"pulpit";
  if(!vonHalskyStan.loaded&&!vonHalskyStan.loading)setTimeout(()=>vonHalskyLaduj(false),0);
  const content=aktywna==="oferty"?vonHalskyOfertyHTML("oferty"):aktywna==="powiazania"?vonHalskyOfertyHTML("powiazania"):aktywna==="zamowienia"?vonHalskyZamowieniaHTML():aktywna==="ustawienia"?vonHalskyUstawieniaHTML():vonHalskyPulpitHTML();
  return adminSzkielet("/admin/von-halsky",`<div class="module-page-stack von-halsky-module-page">${vonHalskySubnavHTML(aktywna)}${vonHalskyNaglowekHTML(aktywna)}${vonHalskyStan.error?`<div class="backend-note error"><b>Von Halsky:</b> ${esc(vonHalskyStan.error)}</div>`:""}${content}</div>`);
}
