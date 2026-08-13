/* ═══════════ GŁÓWNY PULPIT ADMINISTRATORA ═══════════
   Jedno centrum operacyjne dla sklepu, Allegro, wysyłek, magazynu,
   komunikacji, finansów i kondycji integracji. */
let pulpitFiltrAlertow="wszystkie";
let pulpitSzukajAlertow="";
let pulpitSzukajTimer=null;
const ADMIN_PULPIT_SNAPSHOT_KEY="artway_admin_pulpit_snapshot_v1";
const ADMIN_PULPIT_SNAPSHOT_DNI=45;
let adminPulpitSnapshot=(()=>{try{const value=JSON.parse(localStorage.getItem(ADMIN_PULPIT_SNAPSHOT_KEY)||"null");return value&&[1,2].includes(value.schema)?{...value,schema:2,vonHalsky:value.vonHalsky||{}}:{schema:2,sklep:{},allegro:{},vonHalsky:{},recentAllegro:[],savedAt:0};}catch(e){return {schema:2,sklep:{},allegro:{},vonHalsky:{},recentAllegro:[],savedAt:0};}})();
let adminPulpitOdswiezaniePromise=null;
let adminPulpitOdswiezenieTimer=null;
let adminPulpitNieudaneOdczyty=0;
let adminPulpitPonowOdczytPo=0;
const adminPulpitVonHalsky={loaded:false,loading:false,error:"",truth:{},orders:{active:0,total:0,daily:[]},sync:{},updatedAt:""};

async function adminPulpitLadujVonHalsky(force=false){
  if(adminPulpitVonHalsky.loading||(!force&&adminPulpitVonHalsky.loaded))return true;
  adminPulpitVonHalsky.loading=true;adminPulpitVonHalsky.error="";
  try{
    const data=await chmura("von-halsky-dashboard-summary",{timeout:20000});
    Object.assign(adminPulpitVonHalsky,{loaded:true,truth:data.truth||{},orders:data.orders||{},sync:data.sync||{},updatedAt:data.updatedAt||new Date().toISOString()});
    adminPulpitSnapshot.vonHalsky=Object.fromEntries((data.orders?.daily||[]).map(row=>[String(row.day),{value:Number(row.total)||0,count:Number(row.count)||0}]));
    adminPulpitSnapshot.savedAt=Date.now();try{localStorage.setItem(ADMIN_PULPIT_SNAPSHOT_KEY,JSON.stringify(adminPulpitSnapshot));}catch(e){}
    return true;
  }catch(error){adminPulpitVonHalsky.error=String(error?.message||error);return false;}
  finally{adminPulpitVonHalsky.loading=false;}
}

function pulpitStatusSklepuAktywny(z={}){return !["anulowane","dostarczone","zakończone","zwrot","zwrot pieniędzy"].includes(String(z.status||"").toLowerCase());}
function pulpitDataMs(z={}){if(typeof dataZamowieniaMs==="function")return dataZamowieniaMs(z);const raw=z.ts??z.createdAt??z.data??"",n=Number(raw);return Number.isFinite(n)&&n>1e9?(n<1e11?n*1000:n):(Date.parse(raw)||0);}
function pulpitKwotaAllegro(z={}){return kwotaNum(z.total?.amount??z.total??z.summary?.totalToPay?.amount??z.payment?.paidAmount?.amount??0);}
function pulpitZamowieniaOkres(lista,dni=7){const od=Date.now()-dni*86400000;return lista.filter(z=>pulpitDataMs(z)>=od);}
function pulpitZmianaProcent(teraz,poprzednio){if(!poprzednio)return teraz?100:0;return Math.round((teraz-poprzednio)/poprzednio*100);}
function pulpitKluczDnia(value){const date=new Date(Number(value)||0);if(!Number.isFinite(date.getTime())||date.getTime()<=0)return "";return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function pulpitAgregujDni(lista=[],kwota=()=>0){const wynik={};for(const item of lista||[]){const key=pulpitKluczDnia(pulpitDataMs(item));if(!key)continue;const row=wynik[key]||{value:0,count:0};row.value=kwotaNum(row.value+kwotaNum(kwota(item)));row.count++;wynik[key]=row;}return wynik;}
function pulpitOgraniczDni(rows={}){const od=Date.now()-ADMIN_PULPIT_SNAPSHOT_DNI*86400000;return Object.fromEntries(Object.entries(rows||{}).filter(([key])=>Date.parse(`${key}T00:00:00`)>=od));}
function pulpitBezpieczneZamowienieAllegro(z={}){return {id:String(z.id||z.nr||""),nr:String(z.nr||""),createdAt:z.createdAt||z.firstFetchedAt||z.ts||"",firstFetchedAt:z.firstFetchedAt||"",status:z.status||"",fulfillmentStatus:z.fulfillmentStatus||z.fulfillment?.status||z.allegroStatus||"",warehouseStage:z.warehouseStage||"",agentStage:z.agentStage||"",localStage:z.localStage||"",magazynStatus:z.magazynStatus||"",localStatus:z.localStatus||"",agentHandled:z.agentHandled===true,localCompleted:z.localCompleted===true,total:pulpitKwotaAllegro(z)};}
function adminPulpitZapiszSnapshot(sklep=[],allegro=[],allegroPelne=false){
  const next={schema:2,sklep:{},allegro:adminPulpitSnapshot.allegro||{},vonHalsky:adminPulpitSnapshot.vonHalsky||{},recentAllegro:adminPulpitSnapshot.recentAllegro||[]};
  next.sklep=pulpitOgraniczDni(pulpitAgregujDni((sklep||[]).filter(z=>String(z.status||"").toLowerCase()!=="anulowane"),z=>z.razem));
  const dzienneSerwera=allegroPodsumowanie?.salesDaily&&typeof allegroPodsumowanie.salesDaily==="object"?allegroPodsumowanie.salesDaily:null;
  if(allegroPelne)next.allegro=pulpitOgraniczDni(pulpitAgregujDni((allegro||[]).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))),pulpitKwotaAllegro));
  else if(dzienneSerwera)next.allegro=pulpitOgraniczDni(dzienneSerwera);
  if(allegroPelne||(allegro||[]).length)next.recentAllegro=(allegro||[]).slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,30).map(pulpitBezpieczneZamowienieAllegro);
  const before=JSON.stringify({schema:adminPulpitSnapshot.schema,sklep:adminPulpitSnapshot.sklep,allegro:adminPulpitSnapshot.allegro,vonHalsky:adminPulpitSnapshot.vonHalsky,recentAllegro:adminPulpitSnapshot.recentAllegro});
  if(before===JSON.stringify(next))return false;
  adminPulpitSnapshot={...next,savedAt:Date.now()};
  try{localStorage.setItem(ADMIN_PULPIT_SNAPSHOT_KEY,JSON.stringify(adminPulpitSnapshot));}catch(e){}
  return true;
}
function pulpitSumaSnapshot(kanal="allegro",dni=7){const od=Date.now()-dni*86400000;return Object.entries(adminPulpitSnapshot?.[kanal]||{}).reduce((sum,[key,row])=>Date.parse(`${key}T23:59:59`)>=od?sum+kwotaNum(row?.value):sum,0);}
function pulpitSnapshotMaDane(kanal="allegro",dni=14){const od=Date.now()-dni*86400000;return Object.keys(adminPulpitSnapshot?.[kanal]||{}).some(key=>Date.parse(`${key}T23:59:59`)>=od);}
function adminPulpitStatusDanych(){
  if(adminPulpitOdswiezaniePromise)return {className:"syncing",label:"Aktualizuję w tle — poprzednie dane pozostają widoczne"};
  if(adminPulpitPonowOdczytPo>Date.now())return {className:"warning",label:`Serwer chwilowo zajęty — ponowię za ${Math.max(1,Math.ceil((adminPulpitPonowOdczytPo-Date.now())/1000))} s`};
  const at=Number(adminPulpitSnapshot.savedAt)||Number(allegroDaneOdczytAt?.summary)||0;
  return {className:"",label:at?`Dane zapisane ${new Date(at).toLocaleString("pl-PL",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}`:"Dane wspólne aktywne"};
}
function adminPulpitAktualizujStatusDOM(){const status=adminPulpitStatusDanych(),node=document.querySelector("[data-dashboard-data-status]"),button=document.querySelector("[data-dashboard-refresh]");if(node){node.classList.toggle("syncing",status.className==="syncing");const text=node.querySelector("span");if(text)text.textContent=status.label;}if(button){button.disabled=!!adminPulpitOdswiezaniePromise;button.textContent=adminPulpitOdswiezaniePromise?"↻ Aktualizuję w tle…":"↻ Odśwież dane";}}

function pulpitSystemy(){
  const cloudChecked=!!chmuraStan.sprawdzono,healthChecked=!!stanBramki.sprawdzono,allegroChecked=!!allegroStan.sprawdzono,infaktChecked=!!infaktStan.sprawdzono;
  const server=systemSerwerStan?.status,serverChecked=!!server,diskPercent=Number(server?.disk?.usedPercent)||0;
  return [
    {id:"server",ico:"🖥️",nazwa:"Serwer VPS",status:serverChecked?(diskPercent>=90?"blad":"ok"):"info",opis:serverChecked?`Dysk ${diskPercent}% • ${systemBajty(server.disk?.availableBytes)} wolne`:"Oczekuje na lekką kontrolę zasobów",href:"#/admin/system/serwer"},
    {id:"cloud",ico:"☁️",nazwa:"Wspólna baza",status:cloudChecked?(chmuraStan.dostepna?"ok":"blad"):"info",opis:cloudChecked?(chmuraStan.dostepna?`Połączona • rev ${chmuraStan.rev||0}`:chmuraStan.error||"Brak połączenia"):"Oczekuje na pierwszą kontrolę",href:"#/admin/system"},
    {id:"email",ico:"✉️",nazwa:"E-mail automatyczny",status:healthChecked?(stanBramki.email?.configured?"ok":"blad"):"info",opis:healthChecked?(stanBramki.email?.configured?`${stanBramki.email.provider||"SMTP"} gotowy`:"Wymaga konfiguracji serwera"):"Oczekuje na kontrolę",href:"#/admin/system/diagnostyka"},
    {id:"inpost",ico:"🚚",nazwa:"InPost",status:healthChecked?(stanBramki.inpost?.configured?"ok":"blad"):"info",opis:healthChecked?(stanBramki.inpost?.configured?"API etykiet i śledzenia gotowe":"Wymaga konfiguracji API"):"Oczekuje na kontrolę",href:"#/admin/wysylki"},
    {id:"allegro",ico:"🟠",nazwa:"Allegro",status:allegroChecked?(allegroStan.connected&&!allegroStan.requiresReauth?"ok":"blad"):"info",opis:allegroChecked?(allegroStan.connected&&!allegroStan.requiresReauth?"OAuth i synchronizacja aktywne":allegroStan.requiresReauth?"Wymaga ponownej autoryzacji":"Brak połączenia"):"Oczekuje na kontrolę",href:"#/admin/allegro/ustawienia"},
    {id:"von-halsky",ico:"🦘",nazwa:"InPost Von Halsky",status:adminPulpitVonHalsky.loaded?(adminPulpitVonHalsky.sync?.status==="connected"?"ok":"blad"):"info",opis:adminPulpitVonHalsky.loaded?(adminPulpitVonHalsky.sync?.status==="connected"?`${Number(adminPulpitVonHalsky.truth?.published)||0} ofert w sprzedaży`:"Kanał wymaga kontroli połączenia"):"Oczekuje na lekki odczyt kanału",href:"#/admin/von-halsky"},
    {id:"infakt",ico:"🧾",nazwa:"inFakt",status:infaktChecked?(infaktStan.connected?"ok":infaktStan.configured?"blad":"info"):"info",opis:infaktChecked?(infaktStan.connected?"API faktur połączone":infaktStan.configured?infaktStan.error||"Błąd połączenia":"Klucz nie został skonfigurowany"):"Oczekuje na kontrolę",href:"#/admin/infakt/ustawienia"}
  ];
}

function adminPulpitDane(){
  const sklep=pobierzZamowienia(),sklepAktywne=sklep.filter(pulpitStatusSklepuAktywny),allegroPelne=!!allegroDaneZaladowane.orders,allegroPodreczne=Array.isArray(allegroPodsumowanie.recentOrders)&&allegroPodsumowanie.recentOrders.length?allegroPodsumowanie.recentOrders:(adminPulpitSnapshot.recentAllegro||[]),allegro=allegroPelne?(Array.isArray(allegroZamowienia)?allegroZamowienia:[]):allegroPodreczne,allegroAktywneRzeczywiste=allegro.filter(allegroZamowienieAktywneLokalnie),allegroAktywne=allegroPelne?allegroAktywneRzeczywiste:Array.from({length:Number(allegroPodsumowanie.orders?.active||0)},()=>({summaryOnly:true})),komunikacja=allegroKomunikacjaStaty(),plan=potrzebyZatowarowania();
  const wysylkiBezNumeru=sklepAktywne.filter(z=>!daneWysylki(z).numer).length,firmoweBezFaktury=sklepAktywne.filter(z=>(z.klient?.nip||z.klient?.firma)&&!infaktStan.links?.[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length;
  const teraz=Date.now(),siedem=7*86400000,sklep7=sklep.filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&pulpitDataMs(z)>=teraz-siedem),sklepPoprzednie7=sklep.filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&pulpitDataMs(z)>=teraz-2*siedem&&pulpitDataMs(z)<teraz-siedem),allegro7=allegro.filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))&&pulpitDataMs(z)>=teraz-siedem);
  adminPulpitZapiszSnapshot(sklep,allegro,allegroPelne);
  const sprzedazSklep7=sklep7.reduce((s,z)=>s+kwotaNum(z.razem),0),sprzedazAllegro7=allegroPelne?allegro7.reduce((s,z)=>s+pulpitKwotaAllegro(z),0):(pulpitSnapshotMaDane("allegro",7)?pulpitSumaSnapshot("allegro",7):allegro7.reduce((s,z)=>s+pulpitKwotaAllegro(z),0)),sprzedazVonHalsky7=pulpitSumaSnapshot("vonHalsky",7),sprzedazPoprzednie7=sklepPoprzednie7.reduce((s,z)=>s+kwotaNum(z.razem),0);
  const seoKrytyczne=typeof seoKolejkaProduktow==="function"?seoKolejkaProduktow().filter(x=>x.score<60).length:0,agentAktywne=typeof agentAIAnalizaAktywna==="function"?agentAIAnalizaAktywna(agentAIAnaliza()).length:0,systemy=pulpitSystemy(),systemBledy=systemy.filter(x=>x.status==="blad").length;
  return {sklep,sklepAktywne,noweSklep:sklepAktywne.filter(z=>z.status==="nowe").length,allegro,allegroPelne,allegroAktywne,vonHalskyAktywne:Number(adminPulpitVonHalsky.orders?.active)||0,vonHalskyTruth:adminPulpitVonHalsky.truth||{},komunikacja,plan,wysylkiBezNumeru,firmoweBezFaktury,sklep7,allegro7,sprzedazSklep7,sprzedazAllegro7,sprzedazVonHalsky7,sprzedaz7:sprzedazSklep7+sprzedazAllegro7+sprzedazVonHalsky7,sprzedazPoprzednie7,trend:pulpitZmianaProcent(sprzedazSklep7,sprzedazPoprzednie7),seoKrytyczne,agentAktywne,systemy,systemBledy,klienci:pobierzUzytkownikow().filter(u=>!kontoMaRoleAdmin(u.email)).length};
}

function adminPulpitAlerty(d=adminPulpitDane()){
  const alerty=[],add=(level,ico,title,count,description,href,group="operacje")=>{if(Number(count)>0)alerty.push({id:`${group}-${alerty.length}`,level,ico,title,count:Number(count),description,href,group});};
  add("krytyczny","📦","Nowe zamówienia sklepu",d.noweSklep,"Otwórz zamówienia i rozpocznij obsługę.","#/admin/zamowienia");
  add("krytyczny","🟠","Zamówienia Allegro do obsługi",d.allegroAktywne.length,"Sprawdź pozycje, magazyn i przygotowanie wysyłki.","#/admin/allegro/zamowienia");
  add("krytyczny","🦘","Zamówienia Von Halsky do obsługi",d.vonHalskyAktywne,"Nowe i aktywne zamówienia z trzeciego kanału sprzedaży.","#/admin/von-halsky/zamowienia");
  add("krytyczny","💬","Klienci czekają na odpowiedź",d.komunikacja.totalNeed,"Wiadomości i dyskusje wymagające ręcznej odpowiedzi.",d.komunikacja.threadNeed?"#/admin/allegro/wiadomosci":"#/admin/allegro/dyskusje","komunikacja");
  add("ostrzezenie","🚚","Przesyłki bez numeru nadania",d.wysylkiBezNumeru,"Aktywne zamówienia bez utworzonej etykiety lub numeru.","#/admin/wysylki");
  add("krytyczny","📦","Braki do aktywnych zamówień",d.plan.length,"Wyłącznie produkty, których realnie brakuje do realizacji.","#/admin/magazyn/plan","magazyn");
  add("ostrzezenie","🧾","Firmowe zamówienia bez faktury",d.firmoweBezFaktury,"Przygotuj szkice lub wystaw dokumenty w inFakt.","#/admin/infakt/zamowienia","finanse");
  add("ostrzezenie","🤖","Otwarte zadania Agenta AI",d.agentAktywne,"Przejrzyj zadania wymagające decyzji administratora.","#/admin/agent-ai/plan","agent");
  add("informacja","🏷️","Karty produktów wymagają uzupełnienia",d.seoKrytyczne,"Braki jakości i SEO w aktywnym katalogu.","#/admin/seo/produkty","katalog");
  d.systemy.filter(x=>x.status==="blad").forEach(x=>add("krytyczny",x.ico,`${x.nazwa} wymaga uwagi`,1,x.opis,x.href,"system"));
  const rank={krytyczny:0,ostrzezenie:1,informacja:2};return alerty.sort((a,b)=>rank[a.level]-rank[b.level]||b.count-a.count||a.title.localeCompare(b.title,"pl"));
}

function adminPulpitSubnavHTML(aktywny="pulpit",d=adminPulpitDane()){
  const alerty=adminPulpitAlerty(d),pilne=alerty.filter(x=>x.level==="krytyczny").reduce((s,x)=>s+x.count,0),operacje=d.noweSklep+d.allegroAktywne.length+d.vonHalskyAktywne+d.wysylkiBezNumeru+d.plan.length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin",label:"📊 Przegląd"},
    {id:"operacje",href:"#/admin/pulpit/operacje",label:"🎯 Operacje dzisiaj",badge:operacje||""},
    {id:"sprzedaz",href:"#/admin/pulpit/sprzedaz",label:"📈 Sprzedaż"},
    {id:"alerty",href:"#/admin/pulpit/alerty",label:"🔔 Alerty",badge:pilne||""},
    {id:"system",href:"#/admin/pulpit/system",label:"🛠️ Stan systemu",badge:d.systemBledy||""}
  ],aktywny);
}

function adminPulpitHeroHTML(aktywny,d){
  const cfg={pulpit:["Centrum dowodzenia","📊 Pulpit operacyjny","Najważniejsze dane, priorytety i kondycja całego sklepu w jednym miejscu."],operacje:["Dzisiaj","🎯 Operacje do wykonania","Uporządkowana kolejka pracy od sprzedaży i komunikacji po magazyn, wysyłkę i dokumenty."],sprzedaz:["Analiza kanałów","📈 Sprzedaż i zamówienia","Porównanie sklepu i Allegro, trend okresowy, statusy oraz ostatnie transakcje."],alerty:["Kontrola wyjątków","🔔 Alerty i decyzje","Tylko aktywne sprawy wymagające działania; zamknięte pozycje nie wracają do kolejki."],system:["Integracje i automatyzacje","🛠️ Stan systemu","Połączenia, ostatnie synchronizacje, harmonogramy i szybka diagnostyka."]}[aktywny];
  const status=adminPulpitStatusDanych();
  return `<section class="panel dashboard-hero"><div><span class="order-pro-label">${cfg[0]}</span><h1>${cfg[1]}</h1><p>${cfg[2]}</p></div><div class="dashboard-hero-actions"><span class="dashboard-live ${status.className}" data-dashboard-data-status><i></i><span>${esc(status.label)}</span></span><button class="btn ghost" data-dashboard-refresh onclick="adminPulpitOdswiez()" ${adminPulpitOdswiezaniePromise?"disabled":""}>${adminPulpitOdswiezaniePromise?"↻ Aktualizuję w tle…":"↻ Odśwież dane"}</button><button class="btn" onclick="adminPulpitEksportujRaport()">📤 Raport CSV</button></div></section>`;
}

function adminPulpitKpiHTML(d){
  const kpis=[
    {ico:"🎯",value:d.noweSklep+d.allegroAktywne.length+d.vonHalskyAktywne,label:"zamówień do obsługi",note:`Sklep ${d.noweSklep} • Allegro ${d.allegroAktywne.length} • VH ${d.vonHalskyAktywne}`,href:"#/admin/pulpit/operacje",hot:d.noweSklep+d.allegroAktywne.length+d.vonHalskyAktywne>0},
    {ico:"💰",value:zl(d.sprzedaz7),label:"sprzedaż 7 dni",note:`Sklep ${zl(d.sprzedazSklep7)} • Allegro ${zl(d.sprzedazAllegro7)} • VH ${zl(d.sprzedazVonHalsky7)}`,href:"#/admin/pulpit/sprzedaz",money:true},
    {ico:"🚚",value:d.wysylkiBezNumeru,label:"przesyłek bez nadania",note:"aktywne zamówienia",href:"#/admin/wysylki",hot:d.wysylkiBezNumeru>0},
    {ico:"💬",value:d.komunikacja.totalNeed,label:"spraw do odpowiedzi",note:`Wiadomości ${d.komunikacja.threadNeed} • dyskusje ${d.komunikacja.issueNeed}`,href:"#/admin/pulpit/alerty",hot:d.komunikacja.totalNeed>0},
    {ico:"📦",value:d.plan.length,label:"braków do zamówień",note:"bez alarmów od samego stanu 0",href:"#/admin/magazyn/plan",hot:d.plan.length>0},
    {ico:"🛠️",value:d.systemBledy?d.systemBledy:"OK",label:"kondycja integracji",note:d.systemBledy?"wymaga reakcji":"brak aktywnych błędów",href:"#/admin/pulpit/system",hot:d.systemBledy>0,money:!d.systemBledy}
  ];
  return `<div class="dashboard-kpi-grid">${kpis.map(k=>`<a class="dashboard-kpi ${k.hot?"hot":""} ${k.money?"money":""}" href="${k.href}"><span>${k.ico}</span><div><b>${esc(k.value)}</b><strong>${k.label}</strong><small>${k.note}</small></div><em>Otwórz →</em></a>`).join("")}</div>`;
}

function adminPulpitDni(d={},dni=14){
  const out=[];for(let i=dni-1;i>=0;i--){const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-i);out.push({key:pulpitKluczDnia(date.getTime()),start:date.getTime(),end:date.getTime()+86400000,label:date.toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit"}),weekday:date.toLocaleDateString("pl-PL",{weekday:"short"}),sklep:0,allegro:0,vonHalsky:0,count:0});}
  (d.sklep||pobierzZamowienia()).filter(z=>String(z.status||"").toLowerCase()!=="anulowane").forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.sklep+=kwotaNum(z.razem);day.count++;}});
  if(d.allegroPelne)(d.allegro||[]).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))).forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.allegro+=pulpitKwotaAllegro(z);day.count++;}});
  else if(pulpitSnapshotMaDane("allegro",dni))out.forEach(day=>{const saved=adminPulpitSnapshot.allegro?.[day.key];if(saved){day.allegro=kwotaNum(saved.value);day.count+=Number(saved.count)||0;}});
  else (d.allegro||[]).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))).forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.allegro+=pulpitKwotaAllegro(z);day.count++;}});
  out.forEach(day=>{const saved=adminPulpitSnapshot.vonHalsky?.[day.key];if(saved){day.vonHalsky=kwotaNum(saved.value);day.count+=Number(saved.count)||0;}});
  return out;
}

function adminPulpitWykresHTML(d,dni=14){
  const rows=adminPulpitDni(d,dni),max=Math.max(1,...rows.map(x=>x.sklep+x.allegro+x.vonHalsky)),total=rows.reduce((s,x)=>s+x.sklep+x.allegro+x.vonHalsky,0),pamiec=!d.allegroPelne&&pulpitSnapshotMaDane("allegro",dni);
  return `<section class="panel dashboard-chart-panel"><div class="order-section-head"><div><span class="order-pro-label">Trzy kanały sprzedaży</span><h2>Sprzedaż — ostatnie ${dni} dni</h2><p class="order-detail-lead">Sklep, Allegro i InPost Von Halsky są pokazane oddzielnie; anulowane i zwrócone zamówienia nie podbijają wykresu.${pamiec?" Ostatni poprawny wynik pozostaje widoczny podczas cichej aktualizacji.":""}</p></div><div class="dashboard-chart-total"><b>${zl(total)}</b><small>${pamiec?"z pamięci • aktualizacja w tle":"łącznie w okresie"}</small></div></div><div class="dashboard-chart-legend"><span><i class="store"></i> Sklep</span><span><i class="allegro"></i> Allegro</span><span><i class="von-halsky"></i> Von Halsky</span></div><div class="dashboard-chart" style="--days:${rows.length}">${rows.map(x=>{const sh=Math.max(x.sklep?3:0,Math.round(x.sklep/max*100)),ah=Math.max(x.allegro?3:0,Math.round(x.allegro/max*100)),vh=Math.max(x.vonHalsky?3:0,Math.round(x.vonHalsky/max*100));return `<div class="dashboard-chart-day" title="${x.label}: sklep ${zl(x.sklep)}, Allegro ${zl(x.allegro)}, Von Halsky ${zl(x.vonHalsky)}"><div class="dashboard-bars"><i class="store" style="height:${sh}%"></i><i class="allegro" style="height:${ah}%"></i><i class="von-halsky" style="height:${vh}%"></i></div><b>${x.weekday}</b><small>${x.label}</small></div>`;}).join("")}</div></section>`;
}

function adminPulpitAlertCardHTML(a){return `<article class="dashboard-alert ${a.level}"><span>${a.ico}</span><div><small>${a.level==="krytyczny"?"Pilne":a.level==="ostrzezenie"?"Wymaga uwagi":"Kontrola jakości"}</small><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p></div><b>${esc(a.count)}</b><a class="btn ${a.level==="krytyczny"?"":"ghost"}" href="${a.href}">Przejdź →</a></article>`;}
function adminPulpitAlertyPasujace(d){const q=normalizujSzukanyTekst(pulpitSzukajAlertow);return adminPulpitAlerty(d).filter(a=>(pulpitFiltrAlertow==="wszystkie"||a.level===pulpitFiltrAlertow||a.group===pulpitFiltrAlertow)&&(!q||normalizujSzukanyTekst(`${a.title} ${a.description} ${a.group}`).includes(q)));}
function adminPulpitSzukajAlerty(input){pulpitSzukajAlertow=String(input?.value||"");clearTimeout(pulpitSzukajTimer);pulpitSzukajTimer=setTimeout(()=>renderuj(),220);}

function adminPulpitOstatnieHTML(d,limit=8){
  const sklep=d.sklep.slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,limit),allegro=d.allegro.slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,limit);
  return `<section class="dashboard-columns"><div class="panel"><div class="order-section-head"><div><h2>📦 Ostatnie zamówienia sklepu</h2><p class="order-detail-lead">Najnowsze transakcje i bieżący status realizacji.</p></div><a class="btn ghost" href="#/admin/zamowienia">Pełna lista</a></div><div class="table-scroll"><table class="mini-tab"><tr><th>Numer</th><th>Data</th><th>Status</th><th>Wartość</th></tr>${sklep.map(z=>`<tr><td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a></td><td>${esc(z.data||(pulpitDataMs(z)?new Date(pulpitDataMs(z)).toLocaleString("pl-PL"):"—"))}</td><td><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||"var(--bg)"}">${esc(z.status||"—")}</span></td><td><b>${zl(z.razem)}</b></td></tr>`).join("")||`<tr><td colspan="4">Brak zamówień.</td></tr>`}</table></div></div><div class="panel"><div class="order-section-head"><div><h2>🟠 Ostatnie zlecenia Allegro</h2><p class="order-detail-lead">Oficjalny status Allegro oraz lokalny etap obsługi.</p></div><a class="btn ghost" href="#/admin/allegro/zamowienia">Pełna lista</a></div><div class="table-scroll"><table class="mini-tab"><tr><th>Zlecenie</th><th>Data</th><th>Allegro</th><th>Magazyn</th></tr>${allegro.map(z=>`<tr><td><b>${esc(z.id||z.nr||"—")}</b></td><td>${esc(allegroDataTxt(z.createdAt||z.firstFetchedAt))}</td><td><span class="lvl ${allegroStatusKolejkiMeta(z).klasa}">${esc(allegroStatusKolejkiMeta(z).label)}</span></td><td><span class="lvl ${allegroEtapMagazynuMeta(z).klasa}">${esc(allegroEtapMagazynuMeta(z).label)}</span></td></tr>`).join("")||`<tr><td colspan="4">Brak zleceń Allegro.</td></tr>`}</table></div></div></section>`;
}

function adminPulpitSystemHTML(d){return `<div class="dashboard-system-grid">${d.systemy.map(s=>`<a href="${s.href}" class="dashboard-system-card ${s.status}"><span>${s.ico}</span><div><b>${esc(s.nazwa)}</b><small>${esc(s.opis)}</small></div><em>${s.status==="ok"?"działa":s.status==="blad"?"uwaga":"kontrola"}</em></a>`).join("")}</div>`;}

function adminPulpitPrzegladHTML(d){const alerty=adminPulpitAlerty(d),pilne=alerty.slice(0,6);return `${adminPulpitKpiHTML(d)}<section class="dashboard-main-grid"><div class="panel dashboard-priority"><div class="order-section-head"><div><span class="order-pro-label">Kolejka priorytetowa</span><h2>Co wymaga działania</h2><p class="order-detail-lead">Najpierw klient i sprzedaż, potem wysyłka, magazyn, dokumenty i jakość katalogu.</p></div><a class="btn ghost" href="#/admin/pulpit/alerty">Wszystkie alerty</a></div><div class="dashboard-alert-list">${pilne.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Brak pilnych zadań</b><small>Wszystkie aktywne kolejki są obecnie puste.</small></div></div>`}</div></div><div class="panel dashboard-quick"><div class="order-section-head"><div><span class="order-pro-label">Szybkie działania</span><h2>Najczęstsze operacje</h2></div></div><div class="dashboard-quick-grid">${[["➕","Dodaj produkt","Ręcznie lub z linku","#/admin/produkty/dodaj"],["🚚","Nadaj przesyłkę","Etykieta i tracking InPost","#/admin/wysylki"],["🟠","Sprawdź Allegro","Zamówienia i komunikacja","#/admin/allegro"],["🦘","Von Halsky","Sprzedaż, oferty i zamówienia","#/admin/von-halsky"],["🧾","Wystaw fakturę","Zamówienia firmowe","#/admin/infakt/zamowienia"],["🤖","Polecenie dla Agenta","Kontekst całego sklepu","#/admin/agent-ai/komendy"],["🎨","Zmień wygląd","Strona i podstrony","#/admin/personalizacja"]].map(([i,t,o,h])=>`<a href="${h}"><span>${i}</span><b>${t}</b><small>${o}</small></a>`).join("")}</div></div></section>${adminPulpitWykresHTML(d,7)}<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kondycja techniczna</span><h2>Integracje i automatyzacje</h2></div><a class="btn ghost" href="#/admin/pulpit/system">Pełny stan systemu</a></div>${adminPulpitSystemHTML(d)}</section>${adminPulpitOstatnieHTML(d,5)}`;}

function adminPulpitOperacjeHTML(d){
  const alerty=adminPulpitAlerty(d).filter(a=>a.group!=="system"),grupy=[{id:"sprzedaz",title:"Sprzedaż i klient",items:alerty.filter(x=>["operacje","komunikacja"].includes(x.group))},{id:"realizacja",title:"Realizacja i magazyn",items:alerty.filter(x=>["magazyn"].includes(x.group)||x.title.includes("Przesyłki"))},{id:"zaplecze",title:"Dokumenty, Agent i katalog",items:alerty.filter(x=>["finanse","agent","katalog"].includes(x.group))}];
  return `<section class="dashboard-operations-head">${[["📥",d.noweSklep,"nowych w sklepie"],["🟠",d.allegroAktywne.length,"Allegro do obsługi"],["🦘",d.vonHalskyAktywne,"Von Halsky do obsługi"],["🚚",d.wysylkiBezNumeru,"bez nadania"],["📦",d.plan.length,"braków do zleceń"]].map(([i,n,l])=>`<div><span>${i}</span><b>${n}</b><small>${l}</small></div>`).join("")}</section><div class="dashboard-operation-groups">${grupy.map(g=>`<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Etap operacyjny</span><h2>${g.title}</h2></div><span class="lvl ${g.items.length?"lvl-ostrzezenie":"lvl-ok"}">${g.items.length?`${g.items.reduce((s,x)=>s+x.count,0)} zadań`:`gotowe`}</span></div><div class="dashboard-alert-list">${g.items.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Etap bez zaległości</b><small>Nie ma obecnie aktywnych spraw w tej części procesu.</small></div></div>`}</div></section>`).join("")}</div>${adminPulpitOstatnieHTML(d,6)}`;
}

function adminPulpitSprzedazHTML(d){
  const statuses=STATUSY.map(s=>({status:s,count:d.sklep.filter(z=>z.status===s).length,value:d.sklep.filter(z=>z.status===s).reduce((n,z)=>n+kwotaNum(z.razem),0)})).filter(x=>x.count),allegro30=pulpitZamowieniaOkres(d.allegro,30).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))),sklep30=pulpitZamowieniaOkres(d.sklep,30).filter(z=>z.status!=="anulowane");
  const allegro30Wartosc=d.allegroPelne?allegro30.reduce((s,z)=>s+pulpitKwotaAllegro(z),0):(pulpitSnapshotMaDane("allegro",30)?pulpitSumaSnapshot("allegro",30):allegro30.reduce((s,z)=>s+pulpitKwotaAllegro(z),0)),vonHalsky30=pulpitSumaSnapshot("vonHalsky",30),vonHalsky30Count=Object.entries(adminPulpitSnapshot.vonHalsky||{}).reduce((sum,[day,row])=>Date.parse(`${day}T23:59:59`)>=Date.now()-30*86400000?sum+(Number(row.count)||0):sum,0);
  return `${adminPulpitKpiHTML(d)}${adminPulpitWykresHTML(d,14)}<section class="dashboard-columns"><div class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kanały</span><h2>Porównanie 30 dni</h2></div></div><div class="dashboard-channel-grid"><a href="#/admin/zamowienia"><span>🏪</span><b>${sklep30.length}</b><strong>Sklep</strong><small>${zl(sklep30.reduce((s,z)=>s+kwotaNum(z.razem),0))}</small></a><a href="#/admin/allegro/zamowienia"><span>🟠</span><b>${d.allegroPelne?allegro30.length:Number(allegroPodsumowanie.orders?.live||allegro30.length)}</b><strong>Allegro</strong><small>${zl(allegro30Wartosc)}</small></a><a href="#/admin/von-halsky/zamowienia"><span>🦘</span><b>${vonHalsky30Count}</b><strong>Von Halsky</strong><small>${zl(vonHalsky30)}</small></a></div></div><div class="panel"><div class="order-section-head"><div><span class="order-pro-label">Realizacja sklepu</span><h2>Statusy zamówień</h2></div></div><div class="dashboard-status-list">${statuses.map(x=>`<a href="#/admin/zamowienia" onclick="filtrZamowien=${jsArg(x.status)}"><span style="background:${KOLOR_STATUSU[x.status]||"var(--bg)"}"></span><b>${esc(x.status)}</b><strong>${x.count}</strong><small>${zl(x.value)}</small></a>`).join("")||`<div class="dashboard-all-clear">Brak danych sprzedażowych.</div>`}</div></div></section>${adminPulpitOstatnieHTML(d,10)}`;
}

function adminPulpitAlertyHTML(d){
  const all=adminPulpitAlerty(d),items=adminPulpitAlertyPasujace(d),critical=all.filter(x=>x.level==="krytyczny").length,warnings=all.filter(x=>x.level==="ostrzezenie").length,systems=all.filter(x=>x.group==="system").length;
  return `<section class="panel dashboard-alert-workspace"><div class="order-section-head"><div><span class="order-pro-label">Aktywna kolejka wyjątków</span><h2>Alerty wymagające decyzji</h2><p class="order-detail-lead">Lista nie zawiera zamkniętych zamówień ani produktów z zerowym stanem, jeżeli niczego nie brakuje do aktywnej realizacji.</p></div><button class="btn ghost" onclick="adminPulpitEksportujRaport('alerty')">📤 Eksport alertów</button></div><div class="dashboard-alert-filters"><input placeholder="Szukaj alertu, modułu lub opisu…" value="${esc(pulpitSzukajAlertow)}" oninput="adminPulpitSzukajAlerty(this)">${[["wszystkie",`Wszystkie ${all.length}`],["krytyczny",`Pilne ${critical}`],["ostrzezenie",`Ostrzeżenia ${warnings}`],["system",`System ${systems}`],["katalog","Katalog"]].map(([v,l])=>`<button class="${pulpitFiltrAlertow===v?"active":""}" onclick="pulpitFiltrAlertow=${jsArg(v)};renderuj()">${l}</button>`).join("")}</div><div class="dashboard-alert-list expanded">${items.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Brak alertów dla wybranego filtra</b><small>Nie ma obecnie spraw wymagających działania.</small></div></div>`}</div></section>`;
}

function adminPulpitStanSystemuHTML(d){
  return `<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kontrola połączeń</span><h2>Integracje produkcyjne</h2><p class="order-detail-lead">Każda karta prowadzi bezpośrednio do ustawień albo modułu naprawczego.</p></div><button class="btn" onclick="adminPulpitOdswiez(true)">🩺 Uruchom kontrolę</button></div>${adminPulpitSystemHTML(d)}</section><section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Integracje i zdarzenia</span><h2>Sygnały zewnętrzne i kolejka zadań</h2></div><a class="btn ghost" href="#/admin/allegro/ustawienia">Ustawienia Allegro</a></div><div class="dashboard-schedule">${[["🧹","Utrzymanie serwera","codziennie 02:35","stare pliki techniczne; aktywne wydanie i kopie są chronione"],["☁️","Wspólna baza","co 60 sekund na aktywnym urządzeniu","ustawienia, produkty i zamówienia"],["📦","Zamówienia Allegro","detektor co 15 minut","tylko nowe lub zmienione zlecenia"],["💬","Wiadomości i dyskusje","detektor co 15 minut","tylko nowe kontakty i przypomnienia"],["🏷️","Lista ofert Allegro","najwyżej raz na godzinę","lekka kontrola wykonywana z kolejki"],["🧩","Pełny katalog Allegro","najwyżej raz na dobę","ograniczona porcja szczegółów, opisów i kategorii"],["🤖","Agent AI","natychmiast po sygnale","uruchamia tylko właściwy moduł; bez szerokiego cyklu"],["🏭","Dostępność producentów","partie priorytetowe","najpierw bestsellery i aktywne zamówienia"],["📣","SEO produktów","limit dzienny","bezpłatna kontrola małych partii"]].map(([i,t,c,o])=>`<article><span>${i}</span><div><b>${t}</b><small>${o}</small></div><em>${c}</em></article>`).join("")}</div></section><section class="panel dashboard-system-actions"><div><span>🖥️</span><b>Serwer VPS</b><small>Dysk, RAM, obciążenie, wydanie, kopie i bezpieczne czyszczenie.</small><a class="btn" href="#/admin/system/serwer">Otwórz serwer</a></div><div><span>🩺</span><b>Diagnostyka</b><small>Sprawdź błędy JavaScript, serwer, SMTP, InPost i bazę.</small><a class="btn ghost" href="#/admin/system/diagnostyka">Uruchom kontrolę</a></div><div><span>🤖</span><b>Agent AI</b><small>Przegląd aktywnych zdarzeń i potwierdzonych zapisów.</small><a class="btn ghost" href="#/admin/agent-ai">Otwórz Agenta</a></div></section>`;
}

async function adminPulpitOdswiez(pelnaKontrola=false,cicho=false,tylkoSprzedaz=false){
  if(adminPulpitOdswiezaniePromise)return adminPulpitOdswiezaniePromise;
  adminPulpitOdswiezaniePromise=(async()=>{
    adminPulpitAktualizujStatusDOM();
    const zadania=[allegroWczytajDane(true,false,tylkoSprzedaz?"summary":"orders"),adminPulpitLadujVonHalsky(true)];
    if(!tylkoSprzedaz)zadania.push(chmuraWczytajStan(),pelnaKontrola?sprawdzBramke(true):Promise.resolve(true));
    const wyniki=await Promise.allSettled(zadania);
    if(!tylkoSprzedaz&&chmuraOstatniPullZmienilDane){zastosujUstawienia();zbudujProdukty();}
    adminPulpitZapiszSnapshot(pobierzZamowienia(),Array.isArray(allegroZamowienia)?allegroZamowienia:[],!!allegroDaneZaladowane.orders);
    odswiezMenu();
    const ok=wyniki.every(result=>result.status==="fulfilled"&&result.value!==false);
    if(ok){adminPulpitNieudaneOdczyty=0;adminPulpitPonowOdczytPo=0;}
    else{
      adminPulpitNieudaneOdczyty=Math.min(8,adminPulpitNieudaneOdczyty+1);
      adminPulpitPonowOdczytPo=Date.now()+Math.min(5*60*1000,15000*(2**(adminPulpitNieudaneOdczyty-1)));
    }
    return ok;
  })();
  try{const ok=await adminPulpitOdswiezaniePromise;if(trasa()==="/admin"||trasa().startsWith("/admin/pulpit"))renderuj();if(!cicho)toast(ok?"Pulpit odświeżony ✅":"⚠️ Nie udało się odświeżyć wszystkich danych");return ok;}
  finally{adminPulpitOdswiezaniePromise=null;adminPulpitAktualizujStatusDOM();}
}
function adminPulpitZaplanujOdswiezenieWTle(){
  if(adminPulpitOdswiezaniePromise||adminPulpitOdswiezenieTimer)return;
  const ostatni=Number(allegroDaneOdczytAt?.summary)||0;if(allegroDaneZaladowane.summary&&adminPulpitVonHalsky.loaded&&Date.now()-ostatni<ALLEGRO_DANE_TTL_MS)return;
  const opoznienie=Math.max(50,adminPulpitPonowOdczytPo-Date.now());
  adminPulpitOdswiezenieTimer=setTimeout(()=>{
    adminPulpitOdswiezenieTimer=null;
    if((trasa()==="/admin"||trasa().startsWith("/admin/pulpit"))&&!adminPulpitOdswiezaniePromise)void adminPulpitOdswiez(false,true,true);
  },opoznienie);
}
function adminPulpitEksportujRaport(zakres="calosc"){
  const d=adminPulpitDane(),alerty=adminPulpitAlerty(d),rows=alerty.map(a=>[new Date().toISOString(),a.level,a.group,a.title,a.count,a.description,a.href]);
  if(zakres!=="alerty")rows.push([new Date().toISOString(),"podsumowanie","sprzedaz","Sprzedaż 7 dni",d.sprzedaz7,`Sklep ${zl(d.sprzedazSklep7)} | Allegro ${zl(d.sprzedazAllegro7)} | Von Halsky ${zl(d.sprzedazVonHalsky7)}`,"#/admin/pulpit/sprzedaz"]);
  adminEksportujCSV(zakres==="alerty"?"pulpit-alerty.csv":"pulpit-operacyjny.csv",["czas","poziom","obszar","pozycja","liczba","opis","trasa"],rows);
}

function widokAdmin(sekcja="pulpit"){
  setTimeout(()=>adminPulpitZaplanujOdswiezenieWTle(),0);
  if(!stanBramki.sprawdzono)setTimeout(()=>sprawdzBramke(true),0);
  const aktywna=["pulpit","operacje","sprzedaz","alerty","system"].includes(String(sekcja||""))?String(sekcja):"pulpit",d=adminPulpitDane();
  if(aktywna==="system"&&!systemSerwerStan.loading&&!systemSerwerStan.loaded)setTimeout(()=>systemPobierzSerwer(false),0);
  const body=aktywna==="operacje"?adminPulpitOperacjeHTML(d):aktywna==="sprzedaz"?adminPulpitSprzedazHTML(d):aktywna==="alerty"?adminPulpitAlertyHTML(d):aktywna==="system"?adminPulpitStanSystemuHTML(d):adminPulpitPrzegladHTML(d);
  return adminSzkielet("/admin",`${adminPulpitSubnavHTML(aktywna,d)}${adminPulpitHeroHTML(aktywna,d)}<div class="dashboard-workspace">${body}</div>${domyslneHasloAdmina?`<div class="panel dashboard-security-warning"><span>🔑</span><div><b>Administrator używa domyślnego hasła</b><small>Zmień je przed dalszą publikacją strony.</small></div><a class="btn" href="#/konto">Zmień hasło</a></div>`:""}`);
}
