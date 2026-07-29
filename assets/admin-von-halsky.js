/* GENERATED ADMIN VON HALSKY — loaded on demand */
const vonHalskyStan={
  loaded:false,loading:false,error:"",config:{configured:false,missingEnv:[]},
  settings:{integrationMethod:"api",integrator:"",channelAlias:"VH",merchantStoreName:"Artway-TM",notificationEmail:"",minimumStock:1,maximumStock:25,syncIntervalMinutes:15,automaticPriceSync:true,automaticStockSync:true,automaticResume:true,agentPreparationEnabled:true,agentCategoryAutoMatchEnabled:true,agentAttributeAutoMatchEnabled:true,agentMinimumConfidence:.82,newOfferPublicationMode:"manual_selection",catalogAutomationEnabled:false,customerZone:true,onboarding:{}},
  sync:{status:"not_connected",lastConnectionAt:null,lastCatalogAt:null,lastCatalogCount:0,lastOrdersAt:null,lastError:"",lastRequestId:""},
  diagnostics:[],offers:[],orders:[],returns:[],claims:[],events:[],commands:[],categories:[],preview:null,operation:""
};
let vonHalskySzukaj="",vonHalskyEtap="wszystkie",vonHalskyFiltr="wszystkie",vonHalskyAgentFiltr="wszystkie",vonHalskyStatusKanalu="wszystkie",vonHalskyDostepnosc="wszystkie",vonHalskySort="jakosc",vonHalskyStrona=1,vonHalskyNaStronie=50;
const vonHalskyZaznaczone=new Set();
const vonHalskyAgentWToku=new Set();

async function vonHalskyLaduj(force=false){
  if(vonHalskyStan.loading||(!force&&vonHalskyStan.loaded))return;
  vonHalskyStan.loading=true;vonHalskyStan.error="";
  try{
    const data=await chmura("von-halsky-overview",{timeout:20000});
    Object.assign(vonHalskyStan,{loaded:true,config:data.config||{},settings:{...vonHalskyStan.settings,...(data.settings||{})},sync:data.sync||vonHalskyStan.sync,diagnostics:Array.isArray(data.diagnostics)?data.diagnostics:[],offers:Array.isArray(data.offers)?data.offers:[],orders:Array.isArray(data.orders)?data.orders:[],returns:Array.isArray(data.returns)?data.returns:[],claims:Array.isArray(data.claims)?data.claims:[],events:Array.isArray(data.events)?data.events:[],commands:Array.isArray(data.commands)?data.commands:[],updatedAt:data.updatedAt||null});
  }catch(error){vonHalskyStan.error=String(error?.message||error);}
  vonHalskyStan.loading=false;
  if(String(trasa()).startsWith("/admin/von-halsky"))renderuj();
}

function vonHalskyPrezentacjaProduktu(product={}){
  const custom=String(product.vonHalskyContentMode||"").toLowerCase()==="custom";
  const storeName=String(product.nazwa||product.name||"").trim(),storeShort=String(product.opisKrotki||product.krotkiOpis||product.shortDescription||"").trim(),storeLong=String(product.opis||product.dlugiOpis||product.description||"").trim();
  const clean=value=>String(value||"").replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|div|section|li|h[1-6])>/gi,"\n").replace(/<[^>]*>/g," ").replace(/\r/g,"").split("\n").map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean).join("\n\n");
  const name=String(custom?product.vonHalskyTitle||storeName:storeName).trim(),shortDescription=clean(custom?product.vonHalskyShortDescription||storeShort:storeShort),longDescription=clean(custom?product.vonHalskyDescription||storeLong:storeLong);
  const description=[shortDescription,longDescription].filter((value,index,list)=>value&&(index===0||value!==list[0])).join("\n\n");
  return {mode:custom?"custom":"store",source:custom?"Dopasowanie Von Halsky":"Oferta sklepowa",name,shortDescription,longDescription,description};
}
function vonHalskyOpisProduktu(product={}){
  return vonHalskyPrezentacjaProduktu(product).description;
}
function vonHalskyGtin(product={}){
  const digits=String(product.gtin||product.ean||product.EAN||"").replace(/\D/g,"");
  if(![8,12,13,14].includes(digits.length))return "";
  const sum=digits.slice(0,-1).split("").reverse().reduce((total,digit,index)=>total+Number(digit)*(index%2===0?3:1),0);
  return (10-sum%10)%10===Number(digits.at(-1))?digits:"";
}
function vonHalskyKodProducenta(product={}){
  return String(product.kodProducenta||product.mpn||product.externalId||product.sku||"").trim();
}
function vonHalskyGpsr(product={}){
  const value=product.vonHalskyResponsibleProducer&&typeof product.vonHalskyResponsibleProducer==="object"?product.vonHalskyResponsibleProducer:{};
  const name=String(value.legalName||value.name||"").trim(),address=String(value.address||"").trim(),email=String(value.email||"").trim(),phone=String(value.phone||"").trim();
  const missing=[!name&&"nazwa",!address&&"adres",!email&&"e-mail",!phone&&"telefon"].filter(Boolean);
  return {required:product.vonHalskyGpsrRequired===true,ready:missing.length===0,name,address,email,phone,missing,source:String(value.source||"")};
}
function vonHalskyOcenaProduktu(product={}){
  const presentation=vonHalskyPrezentacjaProduktu(product),nazwa=presentation.name,surowyOpis=presentation.description,opis=presentation.description,ean=vonHalskyGtin(product);
  const kod=vonHalskyKodProducenta(product),marka=String(product.marka||product.producent||"").trim(),zdjecia=[...(Array.isArray(product.zdjecia)?product.zdjecia:[]),...(Array.isArray(product.images)?product.images:[]),product.zdjecie,product.image].map(item=>String(typeof item==="object"?item?.url||"":item||"").trim()).filter(Boolean);
  const cena=[product.cenaVonHalsky,product.vonHalskyPrice,product.cenaAllegro,product.allegroPrice,product.cena,product.price].map(Number).find(value=>Number.isFinite(value)&&value>0)||0,braki=[],ostrzezenia=[];
  if(nazwa.length<7||nazwa.length>150)braki.push("Nazwa 7–150 znaków");
  if(opis.length<100)braki.push("Opis minimum 100 znaków");
  if(/https?:\/\/|www\.|<a\b/i.test(surowyOpis))braki.push("Usuń linki z opisu");
  if(new RegExp("<"+"img\\b","i").test(surowyOpis))braki.push("Usuń zdjęcia osadzone w opisie");
  if(!ean&&!(kod&&marka))braki.push("EAN albo kod producenta + marka");
  if(!zdjecia.length)braki.push("Zdjęcie");
  if(!Number.isFinite(cena)||cena<=0)braki.push("Cena");
  if(!String(product.vonHalskyCategoryId||"").trim())braki.push("Kategoria Von Halsky");
  const gpsr=vonHalskyGpsr(product);
  if(gpsr.required&&!gpsr.ready)braki.push(`GPSR: ${gpsr.missing.join(", ")}`);
  if(!String(product.externalId||product.sku||product.id||"").trim())ostrzezenia.push("Brak stabilnego EXTERNAL_ID");
  if(zdjecia.length===1)ostrzezenia.push("Warto dodać więcej zdjęć");
  if(!Object.keys(product.parametry||product.parameters||{}).length)ostrzezenia.push("Brak parametrów kategorii");
  const dostepny=typeof produktDostepnyWSprzedazy==="function"?produktDostepnyWSprzedazy(product):product.sprzedazAktywna!==false;
  if(!dostepny)braki.push("Sprzedaż wstrzymana");
  const remote=(vonHalskyStan.offers||[]).find(item=>String(item.externalId||"")===String(product.externalId||product.sku||product.id||""));
  const ofertaId=String(product.vonHalskyOfferId||product.inpostBuyOfferId||remote?.offerId||"");
  return {gotowy:braki.length===0,wynik:Math.max(0,Math.round(100-braki.length*18-ostrzezenia.length*3)),braki,ostrzezenia,ean,kod,marka,opis,nazwa,cena:Number.isFinite(cena)?cena:0,dostepny,ofertaId,offerStatus:String(remote?.status||""),categoryId:String(product.vonHalskyCategoryId||""),categoryPath:String(product.vonHalskyCategoryPath||""),gpsr,zdjecie:zdjecia[0]||"",presentation};
}
function vonHalskyProdukty(){
  return produktyDoAdministracji().filter(product=>!czyProduktAdminWKoszu(product)&&!produktyDefinitywne.some(id=>String(id)===String(product.id)));
}
function vonHalskyEtapOferty(product={},quality=vonHalskyOcenaProduktu(product)){
  const status=String(quality.offerStatus||"").toUpperCase();
  if(!quality.dostepny||["CLOSED","SOLDOUT","INACTIVE"].includes(status))return "wstrzymane";
  if(quality.ofertaId&&(!quality.gotowy||product.vonHalskyEditorialSyncPending===true||["REJECTED","ERROR"].includes(status)))return "aktualizacja";
  if(quality.ofertaId)return "sprzedaz";
  if(quality.gotowy)return "wystawienie";
  return "przygotowanie";
}
function vonHalskyAgentStan(product={}){
  if(vonHalskyAgentWToku.has(String(product.id)))return {id:"w-toku",label:"Agent pracuje",cls:"running"};
  const raw=String(product.vonHalskyAgentStatus||product.contentEditorial?.channelStates?.vonHalsky?.status||"").toLowerCase();
  if(["ready","confirmed"].includes(raw))return {id:"gotowe",label:"Agent: gotowe",cls:"ready"};
  if(["retry","retry_pending"].includes(raw))return {id:"ponowienie",label:"Agent: ponowienie",cls:"retry"};
  if(["error","failed"].includes(raw))return {id:"blad",label:"Agent: błąd",cls:"error"};
  if(["requires_data","review","decision_required"].includes(raw))return {id:"wymaga-danych",label:"Agent: wymaga danych",cls:"attention"};
  return {id:"oczekuje",label:"Agent: oczekuje",cls:"waiting"};
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
    if(vonHalskyFiltr==="kategoria"&&!quality.categoryId)return false;
    if(vonHalskyFiltr==="bez-kategorii"&&quality.categoryId)return false;
    if(vonHalskyFiltr==="gpsr"&&!quality.gpsr.ready)return false;
    if(vonHalskyFiltr==="bez-gpsr"&&quality.gpsr.ready)return false;
    if(vonHalskyStatusKanalu==="aktywne"&&!quality.ofertaId)return false;
    if(vonHalskyStatusKanalu==="niewystawione"&&quality.ofertaId)return false;
    if(vonHalskyDostepnosc==="dostepne"&&!quality.dostepny)return false;
    if(vonHalskyDostepnosc==="wstrzymane"&&quality.dostepny)return false;
    if(vonHalskyEtap!=="wszystkie"&&vonHalskyEtapOferty(product,quality)!==vonHalskyEtap)return false;
    if(vonHalskyAgentFiltr!=="wszystkie"&&vonHalskyAgentStan(product).id!==vonHalskyAgentFiltr)return false;
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
  const orders=Array.isArray(vonHalskyStan.orders)?vonHalskyStan.orders:[];
  return {wszystkie:rows.length,gotowe:rows.filter(x=>x.gotowy).length,braki:rows.filter(x=>!x.gotowy).length,ean:rows.filter(x=>x.ean).length,aktywne:rows.filter(x=>x.ofertaId).length,wstrzymane:rows.filter(x=>!x.dostepny).length,noweZamowienia:orders.filter(order=>["CREATED","NEW","PAID"].includes(String(order.status||"").toUpperCase())).length};
}
function vonHalskyEtapySprzedazyHTML(){
  const counts={wszystkie:0,sprzedaz:0,wystawienie:0,przygotowanie:0,aktualizacja:0,wstrzymane:0};
  for(const product of vonHalskyProdukty()){const quality=vonHalskyOcenaProduktu(product);counts.wszystkie+=1;counts[vonHalskyEtapOferty(product,quality)]+=1;}
  const items=[["wszystkie","Wszystkie"],["sprzedaz","W sprzedaży"],["wystawienie","Do wystawienia"],["przygotowanie","Do przygotowania"],["aktualizacja","Do aktualizacji"],["wstrzymane","Wstrzymane"]];
  return `<div class="von-halsky-stage-filters" aria-label="Etapy sprzedaży">${items.map(([value,label])=>`<button class="${vonHalskyEtap===value?"active":""}" type="button" onclick="vonHalskyEtap=${jsArg(value)};vonHalskyStrona=1;renderuj()"><span>${esc(label)}</span><b>${counts[value]||0}</b></button>`).join("")}</div>`;
}
function vonHalskyUstawZaznaczenieZakres(zakres="strona",checked=true){
  const rows=vonHalskyWiersze(),start=(vonHalskyStrona-1)*vonHalskyNaStronie;
  const ids=(zakres==="strona"?rows.slice(start,start+vonHalskyNaStronie):rows).map(({product})=>String(product.id));
  vonHalskyUstawZaznaczenie(ids,checked);
}
function vonHalskySubnavHTML(aktywny="pulpit"){
  const stats=vonHalskyStatystyki();
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/von-halsky",label:"📊 Pulpit"},
    {id:"wystawianie",href:"#/admin/von-halsky/wystawianie",label:"🏷️ Wystawianie",badge:stats.braki||""},
    {id:"zamowienia",href:"#/admin/von-halsky/zamowienia",label:"📦 Zamówienia"},
    {id:"ustawienia",href:"#/admin/von-halsky/ustawienia",label:"⚙️ Ustawienia"}
  ],aktywny);
}
function vonHalskyNaglowekHTML(aktywny="pulpit"){
  const stats=vonHalskyStatystyki(),cfg={
    pulpit:["🐕","Centrum operacyjne","InPost Von Halsky","Aktualny stan sprzedaży, kolejka pracy i najważniejsze działania kanału.",[["Aktywne oferty",stats.aktywne],["Do działania",stats.braki],["Nowe zamówienia",stats.noweZamowienia]]],
    wystawianie:["🏷️","Kompletny proces ofertowy","Wystawianie Von Halsky","Dopasowanie produktu, kontrola danych, podgląd i publikacja są teraz jednym spójnym procesem.",[["Wszystkie",stats.wszystkie],["Gotowe",stats.gotowe],["Aktywne",stats.aktywne]]],
    zamowienia:["📦","Obsługa sprzedaży","Zamówienia InPost+","Po połączeniu kanału nowe zamówienia trafią do tej kolejki jako całe zlecenia, a wysyłka pozostanie w Centrum wysyłek.",[["Połączenie",vonHalskyPolaczenieEtykieta()],["Ostatni odczyt",allegroDataTxt(vonHalskyStan.sync?.lastOrdersAt)],["Kanał","InPost+"]]],
    ustawienia:["⚙️","Konfiguracja kanału","Zaawansowane ustawienia Von Halsky","Integracja, synchronizacja, polityka danych, onboarding i diagnostyka są zarządzane wyłącznie tutaj.",[["Metoda","Bezpośrednie API"],["Interwał",`${vonHalskyStan.settings.syncIntervalMinutes||15} min`],["Dane API",vonHalskyStan.config.configured?"gotowe":"oczekują"]]]
  }[aktywny]||[];
  return `<section class="panel von-halsky-workspace-head"><div class="von-halsky-workspace-title"><span>${cfg[0]}</span><div><small>${esc(cfg[1])}</small><h1>${esc(cfg[2])}</h1><p>${esc(cfg[3])}</p></div></div><div class="von-halsky-workspace-metrics">${(cfg[4]||[]).map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div></section>`;
}
function vonHalskyPolaczenieEtykieta(){
  if(vonHalskyStan.sync?.status==="connected")return "połączone";
  if(vonHalskyStan.config.configured)return "gotowe do testu";
  if(vonHalskyStan.config.credentialsConfigured)return "brak kontraktu";
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
  const stats=vonHalskyStatystyki(),lastCatalog=vonHalskyStan.sync?.lastCatalogAt,lastOrders=vonHalskyStan.sync?.lastOrdersAt;
  return `<div class="von-halsky-dashboard">
    <section class="von-halsky-stat-grid">${[["🏷️",stats.aktywne,"aktywnych lub połączonych ofert","sprzedaz"],["✅",stats.gotowe,"gotowych do wystawienia","wystawienie"],["⚠️",stats.braki,"produktów wymaga działania","przygotowanie"],["📦",stats.noweZamowienia,"nowych zamówień do obsługi",""]].map(([icon,count,label,stage],index)=>`<a href="${index===3?"#/admin/von-halsky/zamowienia":"#/admin/von-halsky/wystawianie"}" ${stage?`onclick="vonHalskyEtap=${jsArg(stage)}"`:""}><span>${icon}</span><b>${count}</b><small>${label}</small></a>`).join("")}</section>
    <section class="von-halsky-operations-grid"><article class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kolejka pracy</span><h2>Najbliższe działania</h2></div><a class="btn" href="#/admin/von-halsky/wystawianie">Otwórz wystawianie</a></div><div class="von-halsky-operation-list"><a href="#/admin/von-halsky/wystawianie" onclick="vonHalskyEtap='przygotowanie'"><span>01</span><div><b>Popraw dane i dopasowania</b><small>${stats.braki} produktów nie przechodzi pełnej kontroli.</small></div><em>${stats.braki}</em></a><a href="#/admin/von-halsky/wystawianie" onclick="vonHalskyEtap='wystawienie'"><span>02</span><div><b>Zdecyduj o nowych ofertach</b><small>Gotowe pozycje oczekują na ręczny wybór administratora.</small></div><em>${Math.max(0,stats.gotowe-stats.aktywne)}</em></a><a href="#/admin/von-halsky/zamowienia"><span>03</span><div><b>Obsłuż nowe zamówienia</b><small>Do kolejki trafiają całe zlecenia sprzedaży.</small></div><em>${stats.noweZamowienia}</em></a></div></article>
    <article class="panel von-halsky-channel-activity"><div class="order-section-head"><div><span class="order-pro-label">Aktywność kanału</span><h2>Ostatnie zdarzenia</h2></div><button class="btn ghost" type="button" onclick="vonHalskyLaduj(true)">↻ Odśwież</button></div><dl><div><dt>Katalog ofert</dt><dd>${esc(lastCatalog?allegroDataTxt(lastCatalog):"brak synchronizacji")}</dd></div><div><dt>Zamówienia</dt><dd>${esc(lastOrders?allegroDataTxt(lastOrders):"brak synchronizacji")}</dd></div><div><dt>Ostatnia operacja</dt><dd>${esc(vonHalskyStan.diagnostics?.[0]?.message||"Brak zarejestrowanych operacji")}</dd></div><div><dt>Stan operacyjny</dt><dd><span class="lvl ${vonHalskyStan.sync?.status==="connected"?"lvl-ok":"lvl-ostrzezenie"}">${esc(vonHalskyPolaczenieEtykieta())}</span></dd></div></dl><small>Konfiguracja techniczna, onboarding i pełna diagnostyka znajdują się w Ustawieniach.</small></article></section>
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
    rows.map(({product,quality})=>[product.externalId||product.sku||product.id,quality.ean,quality.kod,quality.marka,quality.nazwa,quality.opis,quality.cena,vonHalskyStan.settings.maximumStock,quality.gotowy?"gotowy":"wymaga poprawy",[...quality.braki,...quality.ostrzezenia].join(" | ")]));
}
function vonHalskyZamknijPodglad(){
  document.getElementById("vonHalskyProductPreview")?.remove();
}
function vonHalskyZamknijKategorie(){
  document.getElementById("vonHalskyCategoryPicker")?.remove();
}
function vonHalskyZamknijDopasowanie(){
  document.getElementById("vonHalskyMatchingEditor")?.remove();
}
function vonHalskyMetodaDopasowania(product={},quality=vonHalskyOcenaProduktu(product)){
  if(quality.ean)return {level:"certain",label:"EAN/GTIN",description:"Jednoznaczny identyfikator produktu"};
  if(quality.kod&&quality.marka)return {level:"review",label:"Kod + marka",description:"Dopasowanie zastępcze do kontroli"};
  return {level:"missing",label:"Brak dopasowania",description:"Uzupełnij EAN albo kod producenta i markę"};
}
function vonHalskyOtworzDopasowanie(productId){
  const product=pobierzProduktAdmin(productId)||vonHalskyProdukty().find(item=>String(item.id)===String(productId));if(!product)return;
  const quality=vonHalskyOcenaProduktu(product),match=vonHalskyMetodaDopasowania(product,quality);
  vonHalskyZamknijDopasowanie();
  const shell=document.createElement("div");shell.id="vonHalskyMatchingEditor";shell.className="von-halsky-product-preview-shell";
  shell.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="vonHalskyMatchingTitle" class="von-halsky-matching-editor"><header><div><span>Identyfikacja i powiązanie</span><h2 id="vonHalskyMatchingTitle">Popraw dopasowanie produktu</h2><small>${esc(quality.nazwa||product.nazwa||"Produkt")}</small></div><button class="btn ghost" type="button" data-close>✕ Zamknij</button></header><form onsubmit="vonHalskyZapiszDopasowanie(event,${jsArg(String(product.id))})"><div class="von-halsky-matching-summary"><article class="${match.level}"><small>Aktualna metoda</small><b>${esc(match.label)}</b><span>${esc(match.description)}</span></article><article><small>EXTERNAL_ID</small><b>${esc(product.externalId||product.sku||product.id||"—")}</b><span>Stały identyfikator kartoteki Artway-TM</span></article><article><small>Oferta Von Halsky</small><b>${esc(quality.ofertaId||"jeszcze niepołączona")}</b><span>${quality.ofertaId?"Powiązanie potwierdzone przez API":"ID zostanie zapisane po potwierdzeniu publikacji"}</span></article></div><div class="von-halsky-matching-fields"><label>EAN / GTIN<input name="ean" inputmode="numeric" maxlength="14" value="${esc(quality.ean||product.ean||product.gtin||"")}" placeholder="8, 12, 13 albo 14 cyfr"><small>Najpewniejsza metoda. System sprawdzi długość, cyfrę kontrolną i duplikaty.</small></label><label>Kod producenta<input name="producerCode" maxlength="160" value="${esc(quality.kod||"")}" placeholder="Kod lub numer referencyjny"><small>Używany razem z marką, jeżeli produkt nie ma EAN.</small></label><label>Producent<input name="producer" maxlength="160" value="${esc(product.producent||"")}" placeholder="np. Alexander"><small>Faktyczny producent lub wydawca.</small></label><label>Marka<input name="brand" maxlength="160" value="${esc(product.marka||product.producent||"")}" placeholder="np. MilliWOOD"><small>Marka handlowa może być inna niż producent.</small></label></div><section class="von-halsky-category-link"><div><small>Kategoria końcowa API</small><b>${esc(quality.categoryPath||quality.categoryId||"nieprzypisana")}</b><span>Kategoria jest częścią tego samego procesu wystawiania, ale wybierana z aktualnego drzewa InPost.</span></div><button class="btn ghost" type="button" onclick="vonHalskyZamknijDopasowanie();vonHalskyWybierzKategorie(${jsArg(String(product.id))})">${quality.categoryId?"Zmień kategorię":"Przypisz kategorię"}</button></section><section class="von-halsky-category-link"><div><small>Producent odpowiedzialny GPSR</small><b>${esc(quality.gpsr.name||"wymaga uzupełnienia")}</b><span>${quality.gpsr.ready?`${esc(quality.gpsr.address)} • ${esc(quality.gpsr.email)} • ${esc(quality.gpsr.phone)}`:`Brakuje: ${esc(quality.gpsr.missing.join(", "))}`}</span></div><span class="lvl ${quality.gpsr.ready?"lvl-ok":"lvl-ostrzezenie"}">${quality.gpsr.ready?"potwierdzone":"braki"}</span></section><div class="von-halsky-matching-validation"><b>Bezpieczne dopasowanie</b><span>Nie można ręcznie wkleić obcego ID oferty. Powiązanie kanału zapisuje się dopiero z potwierdzenia API dla tej kartoteki.</span></div><footer><button class="btn ghost" type="button" data-close>Anuluj</button><button class="btn" type="submit">Zapisz i przelicz gotowość</button></footer></form></section>`;
  shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))vonHalskyZamknijDopasowanie();});
  document.body.appendChild(shell);shell.querySelector("[name='ean']")?.focus();
}
async function vonHalskyZapiszDopasowanie(event,productId){
  event.preventDefault();const form=event.currentTarget,button=event.submitter,fd=new FormData(form);button.disabled=true;
  try{
    const data=await chmura("von-halsky-product-matching",{method:"POST",body:{productId,ean:fd.get("ean"),producerCode:fd.get("producerCode"),producer:fd.get("producer"),brand:fd.get("brand")},timeout:30000});
    toast(`Dopasowanie zapisane • ${data.matching?.label||"przeliczono"} ✅`);vonHalskyZamknijDopasowanie();
    if(typeof odswiezProduktyAdmin==="function")await odswiezProduktyAdmin();
    await vonHalskyLaduj(true);
  }catch(error){toast("Nie zapisano dopasowania: "+(error.message||error));button.disabled=false;}
}
async function vonHalskyPobierzKategorie(force=false){
  if(vonHalskyStan.categories.length&&!force)return vonHalskyStan.categories;
  const data=await chmura("von-halsky-categories",{method:"POST",body:{},timeout:60000});
  vonHalskyStan.categories=Array.isArray(data.categories)?data.categories:[];
  return vonHalskyStan.categories;
}
async function vonHalskyWybierzKategorie(productId){
  try{
    const categories=await vonHalskyPobierzKategorie(false),product=pobierzProduktAdmin(productId)||vonHalskyProdukty().find(item=>String(item.id)===String(productId));
    vonHalskyZamknijKategorie();
    const shell=document.createElement("div");shell.id="vonHalskyCategoryPicker";shell.className="von-halsky-product-preview-shell";
    shell.innerHTML=`<section role="dialog" aria-modal="true" class="von-halsky-product-preview"><header><div><span>Kategoria końcowa API</span><h2>Przypisz kategorię Von Halsky</h2><small>${esc(product?.nazwa||productId)}</small></div><button class="btn ghost" type="button" data-close>✕ Zamknij</button></header><main style="padding:20px"><label>Wyszukaj kategorię<input data-category-search autofocus placeholder="np. gry planszowe, balony, zabawki"></label><div data-category-results class="von-halsky-diagnostic-list"></div></main></section>`;
    const input=shell.querySelector("[data-category-search]"),results=shell.querySelector("[data-category-results]");
    const draw=()=>{const q=normalizujSzukanyTekst(input.value),rows=categories.filter(item=>!q||normalizujSzukanyTekst(item.path||item.name).includes(q)).slice(0,100);results.innerHTML=rows.map(item=>`<article><span>›</span><div><b>${esc(item.name)}</b><small>${esc(item.path)}</small></div><button class="btn" type="button" data-category-id="${esc(item.id)}">Wybierz</button></article>`).join("")||"<small>Brak kategorii pasującej do wyszukiwania.</small>";};
    input.addEventListener("input",draw);shell.addEventListener("click",async event=>{if(event.target===shell||event.target.closest("[data-close]"))return vonHalskyZamknijKategorie();const button=event.target.closest("[data-category-id]");if(!button)return;button.disabled=true;try{await chmura("von-halsky-product-category",{method:"POST",body:{productId,categoryId:button.dataset.categoryId},timeout:30000});toast("Kategoria Von Halsky zapisana ✅");vonHalskyZamknijKategorie();if(typeof odswiezProduktyAdmin==="function")await odswiezProduktyAdmin();await vonHalskyLaduj(true);}catch(error){toast("Nie zapisano kategorii: "+(error.message||error));button.disabled=false;}});
    document.body.appendChild(shell);draw();input.focus();
  }catch(error){toast("Nie pobrano kategorii Von Halsky: "+(error.message||error));}
}
async function vonHalskyPrzygotujAgentem(productIds=[]){
  const ids=[...new Set((Array.isArray(productIds)?productIds:[productIds]).map(String).filter(Boolean))].slice(0,50);
  if(!ids.length||vonHalskyStan.operation)return;
  ids.forEach(id=>vonHalskyAgentWToku.add(id));vonHalskyStan.operation="agent";renderuj();
  try{
    const data=await chmura("von-halsky-agent-prepare",{method:"POST",body:{productIds:ids},timeout:Math.max(120000,ids.length*45000)});
    const errors=(data.results||[]).filter(item=>item.status==="error");
    toast(`Agent Von Halsky: gotowe ${data.ready||0}, wymagają danych ${data.requiresData||0}${errors.length?`, błędy ${errors.length}`:""} ${errors.length?"⚠️":"✅"}`);
    if(typeof odswiezProduktyAdmin==="function")await odswiezProduktyAdmin();
    await vonHalskyLaduj(true);
  }catch(error){toast("Agent Von Halsky: "+(error.message||error));}
  finally{ids.forEach(id=>vonHalskyAgentWToku.delete(id));vonHalskyStan.operation="";renderuj();}
}
function vonHalskyPrzygotujWybraneAgentem(){
  return vonHalskyPrzygotujAgentem([...vonHalskyZaznaczone]);
}
async function vonHalskyZmienStanOferty(offerId,open){
  if(!confirm(`${open?"Wznowić":"Zamknąć"} tę ofertę w Von Halsky?`))return;
  try{const data=await chmura("von-halsky-offer-state",{method:"POST",body:{offerId,open},timeout:30000});vonHalskyStan.offers=data.offers||vonHalskyStan.offers;toast(open?"Wznowienie przekazane ✅":"Zamknięcie przekazane ✅");renderuj();}catch(error){toast("Nie zmieniono stanu oferty: "+(error.message||error));}
}
function vonHalskyOtworzPodglad(productId){
  const product=pobierzProduktAdmin(productId)||vonHalskyProdukty().find(item=>String(item.id)===String(productId));if(!product)return;
  const presentation=vonHalskyPrezentacjaProduktu(product),quality=vonHalskyOcenaProduktu(product),images=[quality.zdjecie,...(Array.isArray(product.zdjecia)?product.zdjecia:[])].filter((url,index,list)=>url&&list.indexOf(url)===index).slice(0,8),parameters=Object.entries(product.parametryZrodla||product.parametryProducenta||product.parametry||{}).filter(([,value])=>String(value??"").trim()).slice(0,18);
  vonHalskyZamknijPodglad();
  const shell=document.createElement("div");shell.id="vonHalskyProductPreview";shell.className="von-halsky-product-preview-shell";
  shell.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="vonHalskyPreviewTitle" class="von-halsky-product-preview"><header><div><span>Podgląd oferty • ${esc(presentation.source)}</span><h2 id="vonHalskyPreviewTitle">${esc(presentation.name||"Produkt")}</h2><small>Tak klient zobaczy treść przygotowaną dla kanału Von Halsky.</small></div><button type="button" class="btn ghost" data-close aria-label="Zamknij">✕ Zamknij</button></header><div class="von-halsky-product-page"><aside><div class="von-halsky-product-main-image">${images[0]?`<img src="${esc(images[0])}" alt="${esc(presentation.name)}">`:"<span>📦</span>"}</div>${images.length>1?`<div class="von-halsky-product-thumbs">${images.map((url,index)=>`<button type="button" class="${index===0?"active":""}" data-image="${esc(url)}"><img src="${esc(url)}" alt=""></button>`).join("")}</div>`:""}</aside><main><div class="von-halsky-product-buybox"><span class="lvl ${quality.gotowy?"lvl-ok":"lvl-ostrzezenie"}">${quality.gotowy?"Gotowa do kanału":"Wymaga uzupełnienia"}</span><h1>${esc(presentation.name||"Produkt")}</h1>${presentation.shortDescription?`<p class="von-halsky-product-lead">${esc(presentation.shortDescription)}</p>`:""}<div class="von-halsky-product-price">${quality.cena?zl(quality.cena):"Cena do ustalenia"}</div><dl><div><dt>Producent</dt><dd>${esc(product.producent||product.marka||"—")}</dd></div><div><dt>EAN</dt><dd>${esc(quality.ean||"—")}</dd></div><div><dt>Kod produktu</dt><dd>${esc(quality.kod||"—")}</dd></div></dl></div></main><article class="von-halsky-product-description"><span>Opis produktu</span>${presentation.longDescription.split(/\n{2,}/).filter(Boolean).map((paragraph,index)=>index===0?`<h3>${esc(paragraph)}</h3>`:`<p>${esc(paragraph)}</p>`).join("")||"<p>Opis zostanie pobrany z oferty sklepowej.</p>"}</article>${parameters.length?`<article class="von-halsky-product-parameters"><span>Najważniejsze informacje</span><dl>${parameters.map(([label,value])=>`<div><dt>${esc(String(label).replace(/_/g," "))}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></article>`:""}</div><footer><span>Źródło treści: <b>${esc(presentation.source)}</b></span><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(product.id)}" data-edit>Edytuj prezentację</a><button class="btn" type="button" data-close>Gotowe</button></footer></section>`;
  shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))vonHalskyZamknijPodglad();const thumb=event.target.closest("[data-image]");if(thumb){shell.querySelector(".von-halsky-product-main-image img").src=thumb.dataset.image;shell.querySelectorAll("[data-image]").forEach(button=>button.classList.toggle("active",button===thumb));}});
  document.body.appendChild(shell);shell.querySelector("[data-close]")?.focus();
}
function vonHalskyFiltryHTML(rows){
  const fields=`<label class="search-wide">Produkt lub identyfikator<input placeholder="Nazwa, EAN, EXTERNAL_ID, SKU, producent, kategoria…" value="${esc(vonHalskySzukaj)}" oninput="vonHalskySzukaj=this.value;vonHalskyStrona=1;zaplanujRenderPoWpisaniu()"></label><label>Etap sprzedaży<select onchange="vonHalskyEtap=this.value;vonHalskyStrona=1;renderuj()">${[["wszystkie","Wszystkie etapy"],["sprzedaz","W sprzedaży"],["wystawienie","Do wystawienia"],["przygotowanie","Do przygotowania"],["aktualizacja","Do aktualizacji"],["wstrzymane","Wstrzymane"]].map(([value,label])=>`<option value="${value}" ${vonHalskyEtap===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Jakość danych<select onchange="vonHalskyFiltr=this.value;vonHalskyStrona=1;renderuj()">${[["wszystkie","Wszystkie"],["gotowe","Gotowe do publikacji"],["braki","Wymagają uzupełnienia"],["ean","Z poprawnym EAN"],["bez-ean","Bez EAN"],["kategoria","Z kategorią"],["bez-kategorii","Bez kategorii"],["gpsr","Z kompletnym GPSR"],["bez-gpsr","Bez kompletnego GPSR"]].map(([value,label])=>`<option value="${value}" ${vonHalskyFiltr===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Praca Agenta<select onchange="vonHalskyAgentFiltr=this.value;vonHalskyStrona=1;renderuj()">${[["wszystkie","Każdy stan"],["w-toku","Wykonywane teraz"],["gotowe","Potwierdzone zapisem"],["wymaga-danych","Wymagają danych"],["ponowienie","Zaplanowane ponowienie"],["blad","Błąd wykonania"],["oczekuje","Jeszcze niesprawdzone"]].map(([value,label])=>`<option value="${value}" ${vonHalskyAgentFiltr===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Status kanału<select onchange="vonHalskyStatusKanalu=this.value;vonHalskyStrona=1;renderuj()">${[["wszystkie","Wszystkie"],["aktywne","Połączone z Von Halsky"],["niewystawione","Jeszcze niewystawione"]].map(([value,label])=>`<option value="${value}" ${vonHalskyStatusKanalu===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Dostępność<select onchange="vonHalskyDostepnosc=this.value;vonHalskyStrona=1;renderuj()">${[["wszystkie","Wszystkie"],["dostepne","Dostępne w sprzedaży"],["wstrzymane","Wstrzymane"]].map(([value,label])=>`<option value="${value}" ${vonHalskyDostepnosc===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Sortowanie<select onchange="vonHalskySort=this.value;renderuj()">${[["jakosc","Najpierw wymagające pracy"],["nazwa","Nazwa A–Z"],["ean","EAN"],["cena","Cena malejąco"]].map(([value,label])=>`<option value="${value}" ${vonHalskySort===value?"selected":""}>${label}</option>`).join("")}</select></label><label>Na stronie<select onchange="vonHalskyNaStronie=Number(this.value);vonHalskyStrona=1;renderuj()">${[25,50,100,250].map(value=>`<option ${vonHalskyNaStronie===value?"selected":""}>${value}</option>`).join("")}</select></label><button class="btn ghost" type="button" onclick="vonHalskySzukaj='';vonHalskyEtap='wszystkie';vonHalskyFiltr='wszystkie';vonHalskyAgentFiltr='wszystkie';vonHalskyStatusKanalu='wszystkie';vonHalskyDostepnosc='wszystkie';vonHalskySort='jakosc';vonHalskyStrona=1;renderuj()">Wyczyść filtry</button>`;
  return adminWyszukiwaniePanelHTML({id:"von-halsky-products",title:"Wyszukiwanie katalogu Von Halsky",description:"Etap sprzedaży, jakość danych, praca Agenta, stan kanału i dostępność są niezależnymi filtrami.",fields,results:rows.length,active:!!(vonHalskySzukaj||vonHalskyEtap!=="wszystkie"||vonHalskyFiltr!=="wszystkie"||vonHalskyAgentFiltr!=="wszystkie"||vonHalskyStatusKanalu!=="wszystkie"||vonHalskyDostepnosc!=="wszystkie"||vonHalskySort!=="jakosc"),open:true});
}
function vonHalskyPublikacjaWyboruHTML(rows){
  const selected=rows.filter(({product})=>vonHalskyZaznaczone.has(String(product.id))),ready=selected.filter(({quality})=>quality.gotowy),blocked=selected.length-ready.length;
  const connected=vonHalskyStan.sync?.status==="connected",configured=vonHalskyStan.config?.configured===true,busy=!!vonHalskyStan.operation;
  const status=!selected.length?"Zaznacz produkty w tabeli":!configured?"Uzupełnij prywatny kontrakt API":!connected?"Najpierw wykonaj test połączenia":blocked?`${ready.length} gotowych • ${blocked} zablokowanych`:`${ready.length} gotowych do przekazania`;
  return `<section class="von-halsky-publication-bar ${selected.length?"has-selection":""}" aria-label="Przygotowanie i ręczna publikacja ofert"><div class="von-halsky-publication-icon">↗</div><div><small>Agent przygotowuje • administrator publikuje</small><b>Praca wyłącznie na zaznaczonych produktach</b><span>${esc(status)}. Agent zapisuje kartotekę, ale nigdy sam nie tworzy nowej oferty.</span></div><div class="von-halsky-publication-count"><strong>${selected.length}</strong><small>zaznaczono</small></div><div class="von-halsky-publication-actions"><button class="btn ghost" type="button" ${!selected.length||busy?"disabled":""} onclick="vonHalskyPrzygotujWybraneAgentem()">${vonHalskyStan.operation==="agent"?"Agent pracuje…":`🤖 Przygotuj Agentem (${selected.length})`}</button><button class="btn" type="button" ${!selected.length||!configured||!connected||busy?"disabled":""} onclick="vonHalskySynchronizujKatalog()">${vonHalskyStan.operation==="catalog"?"Przekazuję…":`Opublikuj / aktualizuj (${selected.length})`}</button></div></section>`;
}
function vonHalskyWystawianieHTML(){
  const rows=vonHalskyWiersze(),pages=Math.max(1,Math.ceil(rows.length/vonHalskyNaStronie));vonHalskyStrona=Math.min(vonHalskyStrona,pages);
  const start=(vonHalskyStrona-1)*vonHalskyNaStronie,visible=rows.slice(start,start+vonHalskyNaStronie),selected=[...vonHalskyZaznaczone].filter(id=>rows.some(({product})=>String(product.id)===id));
  return `<section class="panel von-halsky-catalog-panel"><div class="order-section-head"><div><span class="order-pro-label">Jedno centrum ofert</span><h2>Przygotowanie i wystawianie produktów</h2><p class="order-detail-lead">Powiązanie, jakość danych, podgląd i publikacja są wykonywane w jednym miejscu. EAN ma pierwszeństwo; bez EAN wymagane są kod producenta i marka.</p></div><button class="btn ghost" onclick="vonHalskyLaduj(true)">↻ Odśwież status</button></div>
    <div class="von-halsky-offer-flow" aria-label="Proces wystawiania"><div><span>1</span><b>Dopasuj</b><small>EAN lub kod + marka</small></div><i>›</i><div><span>2</span><b>Uzupełnij</b><small>Treść, zdjęcia i kategorię</small></div><i>›</i><div><span>3</span><b>Sprawdź</b><small>Podgląd i kontrola jakości</small></div><i>›</i><div><span>4</span><b>Opublikuj</b><small>Wyłącznie zaznaczone</small></div></div>
    ${vonHalskyEtapySprzedazyHTML()}
    ${vonHalskyFiltryHTML(rows)}
    ${adminOperacjeWynikowHTML({id:"von-halsky-products",selected:selected.length,pageCount:visible.length,resultCount:rows.length,selectPage:"vonHalskyUstawZaznaczenieZakres('strona',true)",selectAll:"vonHalskyUstawZaznaczenieZakres('filtr',true)",clear:"vonHalskyUstawZaznaczenieZakres('filtr',false)",exportSelected:"vonHalskyEksportuj('selected')",exportAll:"vonHalskyEksportuj('all')",exportLabel:"CSV Von Halsky"})}
    ${vonHalskyPublikacjaWyboruHTML(rows)}
    <div class="warehouse-worktable-wrap"><table class="log-table von-halsky-table"><thead><tr><th></th><th>Produkt</th><th>Dopasowanie i identyfikacja</th><th>Jakość oferty</th><th>Cena i dostępność</th><th>Status kanału</th><th>Akcje</th></tr></thead><tbody>${visible.map(({product,quality})=>{const match=vonHalskyMetodaDopasowania(product,quality),agent=vonHalskyAgentStan(product);return `<tr class="${quality.gotowy?"is-ready":"needs-work"}"><td><input type="checkbox" ${vonHalskyZaznaczone.has(String(product.id))?"checked":""} onchange="vonHalskyUstawZaznaczenie([${jsArg(String(product.id))}],this.checked)"></td><td><div class="von-halsky-product"><span>${quality.zdjecie?`<img src="${esc(quality.zdjecie)}" loading="lazy" alt="">`:esc(product.ikona||"📦")}</span><div><b>${esc(quality.nazwa||"Produkt")}</b><small>${esc(product.kategoria||"bez kategorii")} • ${esc(product.producent||product.marka||"producent —")}</small><em>${quality.presentation.mode==="custom"?"Dopasowanie Von Halsky":"Treść ze sklepu"}</em></div></div></td><td><span class="von-halsky-match-state ${match.level}">${esc(match.label)}</span><b>EAN ${esc(quality.ean||"—")}</b><small>EXTERNAL_ID ${esc(product.externalId||product.sku||product.id||"—")}</small><small>Kod ${esc(quality.kod||"—")} • marka ${esc(quality.marka||"—")}</small><small>Kategoria ${esc(quality.categoryPath||quality.categoryId||"nieprzypisana")}</small><small class="${quality.gpsr.ready?"von-halsky-ok":"von-halsky-issues"}">GPSR ${quality.gpsr.ready?`✓ ${esc(quality.gpsr.name)}`:`— ${esc(quality.gpsr.missing.join(", "))}`}</small></td><td><div class="von-halsky-score"><strong>${quality.wynik}%</strong><span><i style="width:${quality.wynik}%"></i></span></div><span class="von-halsky-agent-state ${agent.cls}">${esc(agent.label)}</span>${product.vonHalskyAgentPreparedAt?`<small>zapis ${esc(allegroDataTxt(product.vonHalskyAgentPreparedAt))}</small>`:""}${quality.braki.length?`<small class="von-halsky-issues">${quality.braki.map(esc).join(" • ")}</small>`:'<small class="von-halsky-ok">Dane spełniają kontrolę obowiązkową</small>'}${quality.ostrzezenia.length?`<small>${quality.ostrzezenia.map(esc).join(" • ")}</small>`:""}</td><td><b>${quality.cena?zl(quality.cena):"—"}</b><small>${quality.dostepny?"sprzedaż aktywna":"sprzedaż wstrzymana"}</small><small>kanał: ${vonHalskyStan.settings.minimumStock}–${vonHalskyStan.settings.maximumStock} szt.</small></td><td><span class="lvl ${quality.ofertaId?"lvl-ok":quality.gotowy?"lvl-info":"lvl-ostrzezenie"}">${quality.ofertaId?esc(quality.offerStatus||"oferta połączona"):quality.gotowy?"gotowy do przekazania":"wymaga danych"}</span>${quality.ofertaId?`<small>ID ${esc(quality.ofertaId)}</small>`:""}</td><td><div class="warehouse-worktable-actions"><button class="btn" type="button" onclick="vonHalskyOtworzDopasowanie(${jsArg(product.id)})">Popraw dopasowanie</button><button class="btn ghost" type="button" ${vonHalskyStan.operation?"disabled":""} onclick="vonHalskyPrzygotujAgentem([${jsArg(String(product.id))}])">🤖 Przygotuj</button><button class="btn ghost" type="button" onclick="vonHalskyOtworzPodglad(${jsArg(product.id)})">Podgląd</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(product.id)}">Pełna edycja</a>${quality.ofertaId?`<button class="btn ghost" type="button" onclick="vonHalskyZmienStanOferty(${jsArg(quality.ofertaId)},${quality.offerStatus==="CLOSED"||quality.offerStatus==="SOLDOUT"?"true":"false"})">${quality.offerStatus==="CLOSED"||quality.offerStatus==="SOLDOUT"?"Wznów":"Zamknij"}</button>`:""}</div></td></tr>`;}).join("")||'<tr><td colspan="7">Brak produktów pasujących do aktywnych filtrów.</td></tr>'}</tbody></table></div>
    <div class="von-halsky-pagination"><button class="btn ghost" ${vonHalskyStrona<=1?"disabled":""} onclick="vonHalskyStrona--;renderuj()">← Poprzednia</button><span>Strona <b>${vonHalskyStrona}</b> z ${pages} • pokazano ${visible.length} z ${rows.length}</span><button class="btn ghost" ${vonHalskyStrona>=pages?"disabled":""} onclick="vonHalskyStrona++;renderuj()">Następna →</button></div>
  </section>`;
}
function vonHalskyZamowieniaHTML(){
  const connected=vonHalskyPolaczenieEtykieta()==="połączone";
  const orders=Array.isArray(vonHalskyStan.orders)?vonHalskyStan.orders:[],returns=Array.isArray(vonHalskyStan.returns)?vonHalskyStan.returns:[],claims=Array.isArray(vonHalskyStan.claims)?vonHalskyStan.claims:[],commands=Array.isArray(vonHalskyStan.commands)?vonHalskyStan.commands:[];
  const orderRows=orders.length?`<div class="warehouse-worktable-wrap"><table class="log-table"><thead><tr><th>Zamówienie</th><th>Status</th><th>Klient</th><th>Pozycje</th><th>Wartość</th><th>Aktualizacja</th><th>Operacje</th></tr></thead><tbody>${orders.map(order=>{const amount=Number(order.finalPrice?.amount||0),refundable=!["REFUNDED","CANCELLED","REFUSED"].includes(String(order.status||""));return `<tr><td><b>${esc(order.id||"—")}</b></td><td><span class="lvl ${order.status==="CREATED"?"lvl-ostrzezenie":"lvl-info"}">${esc(order.status||"—")}</span><small>${esc(order.paymentDetails?.status||"")}</small></td><td>${esc(order.customer?.firstName||order.customer?.name||"—")} ${esc(order.customer?.lastName||"")}</td><td>${(order.orderLines||[]).map(line=>`${esc(line.offer?.product?.name||"Produkt")} × ${Number(line.quantity||1)}`).join("<br>")||"—"}</td><td><b>${esc(order.finalPrice?.amount??"—")} ${esc(order.finalPrice?.currency||"")}</b></td><td>${esc(allegroDataTxt(order.updatedAt||order.createdAt))}</td><td><div class="warehouse-worktable-actions">${order.status==="CREATED"?`<button class="btn" type="button" onclick="vonHalskyDecyzjaZamowienia(${jsArg(order.id)},true)">Przyjmij</button><button class="btn ghost" type="button" onclick="vonHalskyDecyzjaZamowienia(${jsArg(order.id)},false)">Odrzuć</button>`:""}${refundable&&amount>0?`<button class="btn ghost" type="button" onclick="vonHalskyRefunduj(${jsArg(order.id)},${amount})">Refunduj</button>`:""}<a class="btn ghost" href="#/admin/wysylki">Wysyłka</a></div></td></tr>`;}).join("")}</tbody></table></div>`:`<div class="admin-empty-state"><span>📭</span><h3>Brak nowych zamówień Von Halsky</h3><p>Połączenie działa, a kolejka nie zawiera obecnie zleceń.</p></div>`;
  const returnsRows=returns.length?`<div class="warehouse-worktable-wrap"><table class="log-table"><thead><tr><th>Zwrot</th><th>Zamówienie</th><th>Powód</th><th>Status</th><th>Termin</th><th>Decyzja</th></tr></thead><tbody>${returns.map(item=>`<tr><td><b>${esc(item.id||"—")}</b><small>${esc(item.trackingNumber||"")}</small></td><td>${esc(item.orderId||"—")}</td><td>${esc(item.returnReason?.text||"—")}</td><td><span class="lvl ${item.status?"lvl-info":"lvl-ostrzezenie"}">${esc(item.status||"NOWY")}</span></td><td>${esc(allegroDataTxt(item.expiresAt||item.createdAt))}</td><td>${item.status? "—":`<div class="warehouse-worktable-actions"><button class="btn" type="button" onclick="vonHalskyDecyzjaZwrotu(${jsArg(item.id)},true)">Akceptuj</button><button class="btn ghost" type="button" onclick="vonHalskyDecyzjaZwrotu(${jsArg(item.id)},false)">Odrzuć</button></div>`}</td></tr>`).join("")}</tbody></table></div>`:`<div class="admin-empty-state compact"><span>↩</span><div><b>Brak zwrotów do decyzji</b><small>Lista odświeża się bezpośrednio z API.</small></div></div>`;
  const claimsRows=claims.length?`<div class="warehouse-worktable-wrap"><table class="log-table"><thead><tr><th>Reklamacja</th><th>Zamówienie</th><th>Powód</th><th>Status</th><th>Termin</th><th>Rozstrzygnięcie</th></tr></thead><tbody>${claims.map(item=>{const claimId=item.claimId||item.id,orderId=item.relatedOrder?.orderId||item.orderId||"";return `<tr><td><b>${esc(claimId||"—")}</b></td><td>${esc(orderId||"—")}</td><td>${esc(item.specification?.claimTypeDescription||item.specification?.claimType?.description||"—")}</td><td><span class="lvl ${item.state==="RESOLUTION_IN_PROGRESS"?"lvl-ostrzezenie":"lvl-info"}">${esc(item.state||"NOWA")}</span></td><td>${esc(allegroDataTxt(item.expiresAt||item.createdAt))}</td><td>${item.state&&item.state!=="RESOLUTION_IN_PROGRESS"?"—":`<div class="warehouse-worktable-actions"><button class="btn ghost" type="button" onclick="vonHalskyRozstrzygnijReklamacje(${jsArg(orderId)},${jsArg(claimId)},'reject')">Odrzuć</button><button class="btn ghost" type="button" onclick="vonHalskyRozstrzygnijReklamacje(${jsArg(orderId)},${jsArg(claimId)},'partial-refund')">Częściowy zwrot</button><button class="btn" type="button" onclick="vonHalskyRozstrzygnijReklamacje(${jsArg(orderId)},${jsArg(claimId)},'refund')">Pełny zwrot</button></div>`}</td></tr>`;}).join("")}</tbody></table></div>`:`<div class="admin-empty-state compact"><span>🛡</span><div><b>Brak reklamacji do rozstrzygnięcia</b><small>Lista odświeża się bezpośrednio z API.</small></div></div>`;
  const commandRows=commands.slice(0,10).map(item=>`<article class="${item.status==="SUCCESS"?"ok":item.status==="FAILURE"?"error":""}"><span>${item.status==="SUCCESS"?"✓":item.status==="FAILURE"?"!":"…"}</span><div><b>${esc(item.type||"polecenie")} • ${esc(item.entityId||"")}</b><small>${esc(item.commandId)} • ${esc(item.status||"PENDING")}</small></div><button class="btn ghost" type="button" onclick="vonHalskySprawdzPolecenie(${jsArg(item.commandId)},${jsArg(item.type)})">Sprawdź</button></article>`).join("");
  return `<section class="panel von-halsky-orders"><div class="order-section-head"><div><span class="order-pro-label">Pełny cykl zamówienia</span><h2>Zamówienia, płatności i wysyłka</h2><p class="order-detail-lead">Przyjęcie, odmowa, refundacja i przekazanie do centrum wysyłek są dostępne w jednym panelu Artway-TM.</p></div><div class="diag-actions"><button class="btn" type="button" ${!connected||vonHalskyStan.operation?"disabled":""} onclick="vonHalskySynchronizujZamowienia()">${vonHalskyStan.operation==="orders"?"Pobieram…":"↻ Pobierz zamówienia"}</button><a class="btn ghost" href="#/admin/wysylki">Centrum wysyłek</a></div></div>${!connected?`<div class="von-halsky-connection-gate"><span>🔐</span><div><h3>Najpierw dokończ połączenie kanału</h3><p>Autoryzacja serwerowa musi przejść test połączenia.</p><a class="btn" href="#/admin/von-halsky/ustawienia">Otwórz ustawienia integracji</a></div></div>`:orderRows}</section>
    <section class="panel von-halsky-orders"><div class="order-section-head"><div><span class="order-pro-label">Obsługa posprzedażowa</span><h2>Zwroty i reklamacje</h2><p class="order-detail-lead">Decyzje trafiają bezpośrednio do produkcyjnego API Von Halsky i wymagają potwierdzenia administratora.</p></div><button class="btn" type="button" ${!connected||vonHalskyStan.operation?"disabled":""} onclick="vonHalskySynchronizujPosprzedaz()">${vonHalskyStan.operation==="post-sales"?"Pobieram…":"↻ Pobierz sprawy"}</button></div><h3>Zwroty</h3>${returnsRows}<h3>Reklamacje</h3>${claimsRows}</section>
    <section class="panel von-halsky-diagnostics"><div class="order-section-head"><div><span class="order-pro-label">Operacje asynchroniczne</span><h2>Statusy poleceń API</h2></div><button class="btn ghost" type="button" onclick="vonHalskySynchronizujZdarzenia()">↻ Pobierz zdarzenia</button></div><div class="von-halsky-diagnostic-list">${commandRows||`<div class="admin-empty-state compact"><span>⏱</span><div><b>Brak oczekujących poleceń</b><small>Statusy pojawią się po operacji na ofercie lub zamówieniu.</small></div></div>`}</div></section>`;
}
async function vonHalskySynchronizujZamowienia(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="orders";renderuj();
  try{const data=await chmura("von-halsky-sync-orders",{method:"POST",body:{limit:30},timeout:60000});vonHalskyStan.orders=data.orders||[];vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};toast(`Pobrano ${data.fetched||0} zamówień Von Halsky ✅`);}catch(error){toast("Zamówienia Von Halsky: "+(error.message||error));}finally{vonHalskyStan.operation="";renderuj();}
}
async function vonHalskyDecyzjaZamowienia(orderId,accepted){
  if(!confirm(`${accepted?"Przyjąć":"Odrzucić"} zamówienie ${orderId} w InPost Von Halsky?`))return;
  try{const data=await chmura("von-halsky-order-state",{method:"POST",body:{orderId,accepted},timeout:30000});vonHalskyStan.orders=data.orders||vonHalskyStan.orders;toast(accepted?"Zamówienie przyjęte ✅":"Zamówienie odrzucone");renderuj();}catch(error){toast("Nie zapisano decyzji: "+(error.message||error));}
}
async function vonHalskySynchronizujPosprzedaz(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="post-sales";renderuj();
  try{const data=await chmura("von-halsky-post-sales-sync",{method:"POST",body:{limit:30},timeout:60000});vonHalskyStan.returns=data.returns||[];vonHalskyStan.claims=data.claims||[];toast("Zwroty i reklamacje odświeżone ✅");}catch(error){toast("Obsługa posprzedażowa: "+(error.message||error));}finally{vonHalskyStan.operation="";renderuj();}
}
async function vonHalskyDecyzjaZwrotu(returnId,accepted){
  if(!confirm(`${accepted?"Zaakceptować":"Odrzucić"} zwrot ${returnId} w Von Halsky?`))return;
  try{const data=await chmura("von-halsky-return-state",{method:"POST",body:{returnId,accepted},timeout:30000});vonHalskyStan.returns=data.returns||vonHalskyStan.returns;toast(accepted?"Zwrot zaakceptowany ✅":"Zwrot odrzucony");renderuj();}catch(error){toast("Nie zapisano decyzji zwrotu: "+(error.message||error));}
}
async function vonHalskyRefunduj(orderId,maximum){
  const raw=prompt(`Podaj kwotę refundacji dla zamówienia ${orderId} (maks. ${Number(maximum).toFixed(2)} PLN):`,Number(maximum).toFixed(2));if(raw===null)return;
  const amount=Number(String(raw).replace(",","."));
  if(!Number.isFinite(amount)||amount<=0||amount>Number(maximum)){toast("Podaj poprawną kwotę refundacji w dozwolonym zakresie.");return;}
  if(!confirm(`Zlecić refundację ${amount.toFixed(2)} PLN dla zamówienia ${orderId}? Tej operacji nie można cofnąć w panelu.`))return;
  try{await chmura("von-halsky-order-refund",{method:"POST",body:{orderId,amount},timeout:30000});toast("Refundacja została przyjęta przez API ✅");await vonHalskySynchronizujZamowienia();}catch(error){toast("Nie zlecono refundacji: "+(error.message||error));}
}
async function vonHalskyRozstrzygnijReklamacje(orderId,claimId,resolution){
  const labels={reject:"odrzucić", "partial-refund":"uznać z częściowym zwrotem",refund:"uznać z pełnym zwrotem"},description=prompt("Opcjonalne uzasadnienie decyzji (do 1000 znaków):","");if(description===null)return;
  if(!confirm(`Czy na pewno ${labels[resolution]||"rozstrzygnąć"} reklamację ${claimId}?`))return;
  try{const data=await chmura("von-halsky-claim-state",{method:"POST",body:{orderId,claimId,resolution,description},timeout:30000});vonHalskyStan.claims=data.claims||vonHalskyStan.claims;toast("Reklamacja rozstrzygnięta ✅");renderuj();}catch(error){toast("Nie rozstrzygnięto reklamacji: "+(error.message||error));}
}
async function vonHalskySprawdzPolecenie(commandId,type){
  try{const data=await chmura("von-halsky-command-status",{method:"POST",body:{commandId,type},timeout:30000});const command=data.command||{};vonHalskyStan.commands=[command,...vonHalskyStan.commands.filter(item=>item.commandId!==commandId)];toast(`Polecenie: ${command.status||"PENDING"}`);renderuj();}catch(error){toast("Nie pobrano statusu polecenia: "+(error.message||error));}
}
async function vonHalskySynchronizujZdarzenia(){
  try{const data=await chmura("von-halsky-events-sync",{method:"POST",body:{limit:30},timeout:60000});vonHalskyStan.events=data.events||[];toast(`Pobrano ${vonHalskyStan.events.length} ostatnich zdarzeń ✅`);await vonHalskyLaduj(true);}catch(error){toast("Nie pobrano zdarzeń: "+(error.message||error));}
}
function vonHalskySettingsBody(form){
  const fd=new FormData(form),onboarding={};
  form.querySelectorAll("[name^='onboarding.']").forEach(input=>onboarding[input.name.split(".")[1]]=input.checked);
  return {
    integrationMethod:"api",integrator:"",channelAlias:fd.get("channelAlias"),merchantStoreName:fd.get("merchantStoreName"),notificationEmail:fd.get("notificationEmail"),
    minimumStock:Number(fd.get("minimumStock")),maximumStock:Number(fd.get("maximumStock")),syncIntervalMinutes:Number(fd.get("syncIntervalMinutes")),
    automaticPriceSync:form.automaticPriceSync.checked,automaticStockSync:form.automaticStockSync.checked,automaticResume:form.automaticResume.checked,
    agentPreparationEnabled:form.agentPreparationEnabled.checked,agentCategoryAutoMatchEnabled:form.agentCategoryAutoMatchEnabled.checked,agentAttributeAutoMatchEnabled:form.agentAttributeAutoMatchEnabled.checked,agentMinimumConfidence:Number(fd.get("agentMinimumConfidence"))/100,
    newOfferPublicationMode:"manual_selection",catalogAutomationEnabled:false,customerZone:form.customerZone.checked,onboarding
  };
}
function vonHalskyUstawieniaBrudne(form){
  form.classList.add("is-dirty");
  const state=form.querySelector("[data-save-state]");
  if(state){state.textContent="Masz niezapisane zmiany";state.classList.add("is-dirty");}
}
async function vonHalskyZapiszUstawienia(event){
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{const data=await chmura("von-halsky-settings",{method:"POST",body:vonHalskySettingsBody(event.currentTarget),timeout:20000});vonHalskyStan.settings={...vonHalskyStan.settings,...data.settings};vonHalskyStan.config=data.config||vonHalskyStan.config;toast("Ustawienia Von Halsky zapisane ✅");renderuj();}catch(error){toast("Nie zapisano ustawień: "+(error.message||error));button.disabled=false;}
}
async function vonHalskySprawdzPolaczenie(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="connection";renderuj();
  try{const data=await chmura("von-halsky-connection-check",{method:"POST",body:{},timeout:25000});vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};toast(data.connected?"Połączenie API Von Halsky działa ✅":"Nie potwierdzono połączenia");await vonHalskyLaduj(true);}catch(error){toast("Von Halsky: "+(error.message||error));await vonHalskyLaduj(true);}finally{vonHalskyStan.operation="";renderuj();}
}
async function vonHalskySprawdzPakiet(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="preview";renderuj();
  try{const data=await chmura("von-halsky-catalog-preview",{timeout:30000});vonHalskyStan.preview=data;toast(`Pakiet sprawdzony: ${data.eligible||0} gotowych ofert ✅`);}catch(error){toast("Nie sprawdzono pakietu: "+(error.message||error));}finally{vonHalskyStan.operation="";renderuj();}
}
async function vonHalskySynchronizujKatalog(){
  if(vonHalskyStan.operation)return;
  const productIds=[...vonHalskyZaznaczone];
  if(!productIds.length){toast("Zaznacz produkty, które chcesz opublikować lub zaktualizować.");return;}
  if(vonHalskyStan.config?.configured!==true){toast("Najpierw uzupełnij prywatny kontrakt API Von Halsky.");return;}
  if(vonHalskyStan.sync?.status!=="connected"){toast("Najpierw wykonaj poprawny test połączenia API.");return;}
  vonHalskyStan.operation="catalog";renderuj();
  try{const data=await chmura("von-halsky-sync-catalog",{method:"POST",body:{publish:true,batchSize:50,productIds},timeout:180000});vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};vonHalskyZaznaczone.clear();toast(`Nowe ${data.created||0} • aktualizacje ${data.updated||0} • zamknięte ${data.closed||0} • wznowione ${data.reopened||0} ✅`);await vonHalskyLaduj(true);}catch(error){toast("Synchronizacja Von Halsky: "+(error.message||error));await vonHalskyLaduj(true);}finally{vonHalskyStan.operation="";renderuj();}
}
function vonHalskyDiagnostykaHTML(){
  const latestByOperation=new Map();
  for(const row of Array.isArray(vonHalskyStan.diagnostics)?vonHalskyStan.diagnostics:[]){
    const key=String(row.operation||"operacja-api");
    if(!latestByOperation.has(key))latestByOperation.set(key,row);
  }
  const rows=[...latestByOperation.values()].slice(0,6);
  const action=String(trasa()).endsWith("/ustawienia")?`<button class="btn ghost" type="button" onclick="vonHalskyLaduj(true)">↻ Odśwież rejestr</button>`:`<a class="btn ghost" href="#/admin/von-halsky/ustawienia">Pełna konfiguracja</a>`;
  return `<section class="panel von-halsky-diagnostics"><div class="order-section-head"><div><span class="order-pro-label">Rejestr techniczny</span><h2>Ostatnie operacje API</h2></div>${action}</div><div class="von-halsky-diagnostic-list">${rows.map(row=>`<article class="${row.status==="ok"?"ok":"error"}"><span>${row.status==="ok"?"✓":"!"}</span><div><b>${esc(row.operation||"operacja API")}</b><small>${esc(row.message||"")}</small></div><time>${esc(allegroDataTxt(row.at))}</time></article>`).join("")||`<div class="admin-empty-state compact"><span>🧪</span><div><b>Brak wykonanych testów API</b><small>Pierwszy prawdziwy wynik pojawi się po sprawdzeniu połączenia.</small></div></div>`}</div></section>`;
}
function vonHalskyUstawieniaHTML(){
  const settings=vonHalskyStan.settings,onboarding=settings.onboarding||{},config=vonHalskyStan.config||{},busy=!!vonHalskyStan.operation;
  const stages=[
    ["Dane dostępowe",config.credentialsConfigured,"Client ID, Client Secret, Merchant ID i adres autoryzacji"],
    ["Kontrakt endpointów",config.contractConfigured,"Ścieżki testu, katalogu i zamówień z prywatnej dokumentacji"],
    ["Sekret webhooka",config.webhookConfigured,"Sekret podpisu zdarzeń przychodzących; sposób walidacji określi prywatny kontrakt"],
    ["Test rzeczywisty",vonHalskyStan.sync?.status==="connected",vonHalskyStan.sync?.lastConnectionAt?`Ostatnio: ${allegroDataTxt(vonHalskyStan.sync.lastConnectionAt)}`:"Nie wykonano poprawnego testu"]
  ];
  const missingCredentials=config.missingCredentialsEnv||[],missingContract=config.missingContractEnv||[];
  return `<div class="von-halsky-settings-page"><section class="panel von-halsky-settings"><div class="order-section-head von-halsky-settings-head"><div><span class="order-pro-label">Bezpośrednie API</span><h2>Połączenie InPost Von Halsky</h2><p class="order-detail-lead">Ustawienia biznesowe są oddzielone od sekretów i prywatnego kontraktu przechowywanego wyłącznie na serwerze.</p></div><div class="von-halsky-connection-actions"><span class="lvl ${vonHalskyStan.sync?.status==="connected"?"lvl-ok":config.configured?"lvl-info":"lvl-ostrzezenie"}">${esc(vonHalskyPolaczenieEtykieta())}</span><button class="btn ghost" type="button" ${busy||!config.configured?"disabled":""} onclick="vonHalskySprawdzPolaczenie()">${vonHalskyStan.operation==="connection"?"Sprawdzam…":"Sprawdź połączenie API"}</button></div></div>
    <div class="von-halsky-api-readiness">${stages.map(([title,ready,desc])=>`<article class="${ready?"ready":"pending"}"><span>${ready?"✓":"•"}</span><div><b>${esc(title)}</b><small>${esc(desc)}</small></div><em>${ready?"gotowe":"oczekuje"}</em></article>`).join("")}</div>
    <nav class="von-halsky-settings-index" aria-label="Sekcje ustawień"><a href="#von-halsky-settings-identity">Tożsamość</a><a href="#von-halsky-settings-sync">Synchronizacja</a><a href="#von-halsky-settings-agent">Agent</a><a href="#von-halsky-settings-policy">Polityka danych</a><a href="#von-halsky-settings-contract">Kontrakt API</a><a href="#von-halsky-settings-onboarding">Onboarding</a><a href="#von-halsky-settings-diagnostics">Diagnostyka</a></nav>
    <form onsubmit="vonHalskyZapiszUstawienia(event)" oninput="vonHalskyUstawieniaBrudne(this)" onchange="vonHalskyUstawieniaBrudne(this)">
      <div class="von-halsky-settings-layout"><main>
        <section class="von-halsky-setting-card" id="von-halsky-settings-identity"><header><span>01</span><div><small>Tożsamość kanału</small><h3>Sklep i powiadomienia</h3></div></header><div class="von-halsky-settings-grid"><label>Nazwa sklepu w Portalu Merchanta<input name="merchantStoreName" value="${esc(settings.merchantStoreName||"Artway-TM")}" required></label><label>Alias zamówień<input name="channelAlias" maxlength="2" pattern="[A-Za-z0-9]{2}" value="${esc(settings.channelAlias||"VH")}" required><small>Dokładnie 2 litery lub cyfry.</small></label><label>E-mail powiadomień<input name="notificationEmail" type="email" value="${esc(settings.notificationEmail||"")}"></label></div></section>
        <section class="von-halsky-setting-card" id="von-halsky-settings-sync"><header><span>02</span><div><small>Synchronizacja</small><h3>Częstotliwość i prezentowany stan</h3></div></header><div class="von-halsky-settings-grid"><label>Synchronizacja istniejących ofert<select name="syncIntervalMinutes">${[15,30,60,180,360,720,1440].map(value=>`<option value="${value}" ${Number(settings.syncIntervalMinutes)===value?"selected":""}>${value<60?value+" min":value/60+" godz."}</option>`).join("")}</select></label><label>Minimalny stan kanału<input name="minimumStock" type="number" min="0" max="99999" value="${esc(settings.minimumStock)}"><small>Pokazywany przy aktywnej sprzedaży.</small></label><label>Maksymalny stan pokazywany<input name="maximumStock" type="number" min="1" max="99999" value="${esc(settings.maximumStock)}"><small>Chroni rzeczywisty stan magazynu.</small></label></div><div class="von-halsky-switches"><label><input type="checkbox" name="automaticPriceSync" ${settings.automaticPriceSync?"checked":""}><span><b>Ceny istniejących ofert</b><small>Aktualizuj z kartoteki Artway-TM.</small></span></label><label><input type="checkbox" name="automaticStockSync" ${settings.automaticStockSync?"checked":""}><span><b>Stany istniejących ofert</b><small>Synchronizuj dostępność i ilości.</small></span></label><label><input type="checkbox" name="automaticResume" ${settings.automaticResume?"checked":""}><span><b>Automatyczne wznowienie</b><small>Po powrocie dostępności produktu.</small></span></label><label><input type="checkbox" name="customerZone" ${settings.customerZone?"checked":""}><span><b>Strefa klienta</b><small>Pokazuj odnośnik w obsłudze zamówienia.</small></span></label></div></section>
        <section class="von-halsky-setting-card" id="von-halsky-settings-agent"><header><span>AI</span><div><small>Bezpieczna automatyzacja</small><h3>Agent przygotowania ofert</h3></div><span class="lvl ${settings.agentPreparationEnabled?"lvl-ok":"lvl-ostrzezenie"}">${settings.agentPreparationEnabled?"aktywny":"wyłączony"}</span></header><div class="von-halsky-switches"><label><input type="checkbox" name="agentPreparationEnabled" ${settings.agentPreparationEnabled?"checked":""}><span><b>Przygotowanie treści i danych</b><small>Agent zapisuje wynik bezpośrednio w centralnej kartotece produktu.</small></span></label><label><input type="checkbox" name="agentCategoryAutoMatchEnabled" ${settings.agentCategoryAutoMatchEnabled?"checked":""}><span><b>Bezpieczne dopasowanie kategorii</b><small>Automatyczny zapis tylko po przekroczeniu progu i przewagi nad drugim wynikiem.</small></span></label><label><input type="checkbox" name="agentAttributeAutoMatchEnabled" ${settings.agentAttributeAutoMatchEnabled?"checked":""}><span><b>Dokładne mapowanie parametrów</b><small>Wyłącznie identyczna nazwa i dozwolona wartość — bez zgadywania.</small></span></label></div><div class="von-halsky-agent-threshold"><label>Minimalna pewność kategorii<input name="agentMinimumConfidence" type="number" min="55" max="99" step="1" value="${Math.round(Number(settings.agentMinimumConfidence||.82)*100)}"><small>Domyślnie 82%. Niższy wynik pozostaje propozycją do kontroli.</small></label><div><b>Granica odpowiedzialności</b><span>Agent może przygotować i trwale zapisać kartotekę. Publikacja nowej oferty zawsze wymaga zaznaczenia przez administratora.</span></div></div></section>
        <section class="von-halsky-setting-card von-halsky-data-policy" id="von-halsky-settings-policy"><header><span>03</span><div><small>Zasady kartoteki</small><h3>Źródła i priorytety danych</h3></div></header><div class="von-halsky-policy-grid"><article><span>Identyfikacja</span><b>EAN/GTIN → kod + marka</b><small>Nazwa produktu nigdy nie tworzy samodzielnie powiązania.</small></article><article><span>Treść oferty</span><b>Kartoteka Artway-TM</b><small>Własna wersja Von Halsky może świadomie nadpisać treść sklepu.</small></article><article><span>Cena kanału</span><b>Von Halsky → Allegro → sklep</b><small>Własna cena kanału ma pierwszeństwo, dalej działa kontrolowany fallback.</small></article><article><span>Nowe oferty</span><b>Wyłącznie ręczny wybór</b><small>Automatyka aktualizuje istniejące oferty, ale nie tworzy nowych bez decyzji.</small></article><article><span>Dostępność</span><b>Jedna decyzja sprzedażowa</b><small>Ukrycie w kartotece przekazuje do kanału stan zero i zamknięcie oferty.</small></article><article><span>Powiązanie API</span><b>Tylko potwierdzenie serwera</b><small>ID oferty zapisuje odpowiedź Von Halsky, nie ręcznie wpisany tekst.</small></article></div></section>
        <section class="von-halsky-setting-card von-halsky-contract-card" id="von-halsky-settings-contract"><header><span>04</span><div><small>Kontrakt techniczny</small><h3>Status konfiguracji serwera</h3></div><span class="lvl ${config.configured?"lvl-ok":"lvl-ostrzezenie"}">${config.configured?"kompletny":"wymaga danych"}</span></header><div class="von-halsky-contract-facts"><div><small>Środowisko</small><b>${esc(config.environment||"production")}</b></div><div><small>Wersja kontraktu</small><b>${esc(config.contractVersion||"oczekuje")}</b></div><div><small>Webhook</small><b>${config.webhookConfigured?"skonfigurowany":"oczekuje"}</b></div><div><small>Ostatni test</small><b>${esc(vonHalskyStan.sync?.lastConnectionAt?allegroDataTxt(vonHalskyStan.sync.lastConnectionAt):"nie wykonano")}</b></div></div>${config.configured?`<div class="backend-note success"><b>Kontrakt jest kompletny</b><span>Żaden klucz ani token nie jest wysyłany do przeglądarki.</span></div>`:missingCredentials.length||missingContract.length?`<div class="von-halsky-missing-contract"><b>Brakujące elementy</b><div>${[...missingCredentials,...missingContract].map(item=>`<code>${esc(item)}</code>`).join("")}</div></div>`:`<div class="backend-note warning"><b>Dane API oczekują na import</b><span>Po zalogowaniu do Portalu Merchanta uzupełnimy prywatny kontrakt bez ujawniania sekretów w przeglądarce.</span></div>`}</section>
      </main><aside>
        <section class="von-halsky-setting-card von-halsky-manual-policy"><header><span>✓</span><div><small>Publikacja nowych ofert</small><h3>Decyzja ręczna</h3></div></header><p>Każdy gotowy produkt może zostać wystawiony. Nowa oferta powstaje dopiero po zaznaczeniu jej w podstronie Wystawianie.</p><ul><li>brak limitu jednego kodu testowego</li><li>brak automatycznego tworzenia nowych ofert</li><li>automatyczne aktualizacje tylko istniejących ofert</li></ul><a class="btn" href="#/admin/von-halsky/wystawianie">Przejdź do wystawiania</a></section>
        <section class="von-halsky-setting-card" id="von-halsky-settings-onboarding"><header><span>05</span><div><small>Uruchomienie kanału</small><h3>Lista kontrolna</h3></div></header><div class="von-halsky-onboarding-checklist">${vonHalskyEtapy().map(step=>`<label><input type="checkbox" name="onboarding.${step.id}" ${onboarding[step.id]?"checked":""}><span><b>${esc(step.title)}</b><small>${esc(step.desc)}</small></span></label>`).join("")}</div></section>
        <section class="von-halsky-setting-card"><header><span>06</span><div><small>Kontrola przed publikacją</small><h3>Podgląd pakietu</h3></div></header><div class="von-halsky-package-preview">${vonHalskyStan.preview?`<div><strong>${Number(vonHalskyStan.preview.eligible)||0}</strong><small>gotowych</small></div><div><strong>${Number(vonHalskyStan.preview.blocked)||0}</strong><small>zablokowanych</small></div><div><strong>${Number(vonHalskyStan.preview.duplicates)||0}</strong><small>duplikatów</small></div>`:`<p>Kontrola analizuje katalog bez wysyłania danych.</p>`}</div><button class="btn ghost" type="button" ${busy?"disabled":""} onclick="vonHalskySprawdzPakiet()">${vonHalskyStan.operation==="preview"?"Analizuję…":"Sprawdź pakiet bez wysyłania"}</button></section>
      </aside></div>
      <div class="von-halsky-settings-footer"><div><b data-save-state>Wszystkie ustawienia zapisane</b><small>Zmiany dotyczą polityki kanału, nie sekretów API.</small></div><button class="btn" type="submit">Zapisz ustawienia</button><a class="btn ghost" href="https://inpost.pl/aktualnosci-inpost-von-halsky-integracja" target="_blank" rel="noopener">Dokumentacja InPost ↗</a></div>
    </form>
  </section><div id="von-halsky-settings-diagnostics">${vonHalskyDiagnostykaHTML()}</div></div>`;
}
function widokAdminVonHalsky(sekcja="pulpit"){
  const alias={oferty:"wystawianie",powiazania:"wystawianie"}[sekcja]||sekcja;
  const aktywna=["wystawianie","zamowienia","ustawienia"].includes(alias)?alias:"pulpit";
  if(!vonHalskyStan.loaded&&!vonHalskyStan.loading)setTimeout(()=>vonHalskyLaduj(false),0);
  const content=aktywna==="wystawianie"?vonHalskyWystawianieHTML():aktywna==="zamowienia"?vonHalskyZamowieniaHTML():aktywna==="ustawienia"?vonHalskyUstawieniaHTML():vonHalskyPulpitHTML();
  return adminSzkielet("/admin/von-halsky",`<div class="module-page-stack von-halsky-module-page">${vonHalskySubnavHTML(aktywna)}${vonHalskyNaglowekHTML(aktywna)}${vonHalskyStan.error?`<div class="backend-note error"><b>Von Halsky:</b> ${esc(vonHalskyStan.error)}</div>`:""}${content}</div>`);
}
