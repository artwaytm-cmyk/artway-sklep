const vonHalskyStan={
  loaded:false,loading:false,error:"",lastLoadAttemptAt:"",config:{configured:false,missingEnv:[]},
  settings:{integrationMethod:"api",integrator:"",channelAlias:"VH",merchantStoreName:"Artway-TM",notificationEmail:"",minimumStock:1,maximumStock:25,syncIntervalMinutes:15,automaticPriceSync:true,automaticStockSync:true,automaticResume:true,agentPreparationEnabled:true,agentCategoryAutoMatchEnabled:true,agentAttributeAutoMatchEnabled:true,agentMinimumConfidence:.82,newOfferPublicationMode:"manual_selection",catalogAutomationEnabled:false,customerZone:true,onboarding:{}},
  sync:{status:"not_connected",lastConnectionAt:null,lastCatalogAt:null,lastCatalogCount:0,lastOrdersAt:null,lastError:"",lastRequestId:""},
  diagnostics:[],offers:[],orders:[],returns:[],claims:[],events:[],commands:[],categories:[],preview:null,operation:"",
  truth:{total:0,published:0,pending:0,rejected:0,closed:0,statuses:{}},
  channelStatus:{source:"inpost-von-halsky-api",verifiedAt:null,truth:{total:0,published:0,pending:0,rejected:0,closed:0,statuses:{}},operations:{pendingCommands:0,recentCommands:0},consistent:false},
  dashboard:{loaded:false,loading:false,error:"",orders:{total:0,active:0,statuses:{},daily:[]},commands:{pending:0,total:0},rejectionReasons:[],recent:[],updatedAt:""},
  productQueue:{loaded:false,loading:false,error:"",items:[],total:0,summary:{},facets:{producers:[],categories:[]},nextCursor:null,previousCursor:null,cursor:"",queryKey:""},
  records:{view:"orders",query:"",status:"wszystkie",loading:false,error:"",items:[],total:0,nextCursor:null,previousCursor:null,cursor:"",queryKey:""},
  preparationQueue:{running:false,active:null,pending:0,recent:[],current:[],currentSummary:{},batches:[],updatedAt:""},
  agentRuntime:{state:"ready",currentWork:null,publication:{counts:{},pending:[],recent:[]},updatedAt:""},
  preparationBatchId:"",
  preparation:{active:false,paused:false,pauseRequested:false,cancelRequested:false,total:0,completed:0,currentIndex:0,currentProductId:"",currentName:"",startedAt:"",finishedAt:"",results:[],error:""}
};
let vonHalskySzukaj="",vonHalskyEtap="wszystkie",vonHalskyFiltr="wszystkie",vonHalskyAgentFiltr="wszystkie",vonHalskyStatusKanalu="wszystkie",vonHalskyDostepnosc="wszystkie",vonHalskyProducent="wszyscy",vonHalskyKategoria="wszystkie",vonHalskyProblem="wszystkie",vonHalskyCena="wszystkie",vonHalskySort="jakosc",vonHalskyStrona=1,vonHalskyNaStronie=25;
const vonHalskyZaznaczone=new Set();
const vonHalskyAgentWToku=new Set();
let vonHalskyProduktyRenderCache=null,vonHalskyOcenaRenderCache=new WeakMap();
let vonHalskyWznowProces=null,vonHalskyLiveTimer=null,vonHalskyReconcilePromise=null,vonHalskyProcesSygnatura="",vonHalskyOstatniOdczytKanalu=0,vonHalskyOdswiezenieWToku=false,vonHalskyOstatniaRewizjaKanalu="";
let vonHalskyFiltrTimer=null;
let vonHalskyUstawieniaSekcja="identity";

function vonHalskyMigawkaFiltrow(){
  return {
    search:vonHalskySzukaj,stage:vonHalskyEtap,quality:vonHalskyFiltr,agent:vonHalskyAgentFiltr,
    channel:vonHalskyStatusKanalu,availability:vonHalskyDostepnosc,producer:vonHalskyProducent,
    category:vonHalskyKategoria,problem:vonHalskyProblem,price:vonHalskyCena,sort:vonHalskySort,
    page:vonHalskyStrona,pageSize:vonHalskyNaStronie,
  };
}
function vonHalskyPrzywrocFiltry(snapshot={}){
  vonHalskySzukaj=snapshot.search??vonHalskySzukaj;vonHalskyEtap=snapshot.stage??vonHalskyEtap;
  vonHalskyFiltr=snapshot.quality??vonHalskyFiltr;vonHalskyAgentFiltr=snapshot.agent??vonHalskyAgentFiltr;
  vonHalskyStatusKanalu=snapshot.channel??vonHalskyStatusKanalu;vonHalskyDostepnosc=snapshot.availability??vonHalskyDostepnosc;
  vonHalskyProducent=snapshot.producer??vonHalskyProducent;vonHalskyKategoria=snapshot.category??vonHalskyKategoria;
  vonHalskyProblem=snapshot.problem??vonHalskyProblem;vonHalskyCena=snapshot.price??vonHalskyCena;
  vonHalskySort=snapshot.sort??vonHalskySort;vonHalskyStrona=Number(snapshot.page)||1;
  vonHalskyNaStronie=Number(snapshot.pageSize)||25;
}
function vonHalskyUniewaznijWidokProduktow(){
  vonHalskyProduktyRenderCache=null;vonHalskyOcenaRenderCache=new WeakMap();
}
function vonHalskyZastosujAktualizacjeProduktow(updates=[]){
  for(const update of Array.isArray(updates)?updates:[]){
    const productId=String(update?.productId||update?.id||"");
    const patch=update?.fields&&typeof update.fields==="object"?update.fields:update?.product&&typeof update.product==="object"?update.product:update;
    if(!productId||!patch||typeof patch!=="object")continue;
    podmienProduktAdminBezRenderu(productId,patch,Array.isArray(update?.remove)?update.remove:[]);
    const queueIndex=(vonHalskyStan.productQueue?.items||[]).findIndex(product=>String(product?.id)===productId);
    if(queueIndex>=0){
      const next={...vonHalskyStan.productQueue.items[queueIndex],...patch};
      for(const field of Array.isArray(update?.remove)?update.remove:[])delete next[field];
      vonHalskyStan.productQueue.items[queueIndex]=next;
    }
  }
  vonHalskyUniewaznijWidokProduktow();
}
async function vonHalskyLaduj(force=false,{render=true,processes=true}={}){
  if(vonHalskyStan.loading||(!force&&vonHalskyStan.loaded))return;
  vonHalskyStan.loading=true;vonHalskyStan.error="";vonHalskyStan.lastLoadAttemptAt=new Date().toISOString();
  try{
    const [data]=await Promise.all([
      chmura("von-halsky-overview",{timeout:20000}),
      processes?vonHalskyPobierzStanProcesow().catch(error=>{console.warn("von_halsky_process_status",error);return null;}):Promise.resolve(null),
    ]);
    Object.assign(vonHalskyStan,{loaded:true,config:data.config||{},settings:{...vonHalskyStan.settings,...(data.settings||{})},sync:data.sync||vonHalskyStan.sync,diagnostics:Array.isArray(data.diagnostics)?data.diagnostics:[],offers:Array.isArray(data.offers)?data.offers:[],orders:Array.isArray(data.orders)?data.orders:[],returns:Array.isArray(data.returns)?data.returns:[],claims:Array.isArray(data.claims)?data.claims:[],events:Array.isArray(data.events)?data.events:[],commands:Array.isArray(data.commands)?data.commands:[],truth:data.truth||vonHalskyStan.truth,channelStatus:data.channelStatus||vonHalskyStan.channelStatus,updatedAt:data.updatedAt||null});
    vonHalskyProcesSygnatura=vonHalskySygnaturaProcesu();
    vonHalskyOstatniaRewizjaKanalu=String(data.sync?.reconciliationRevision||data.sync?.lastCatalogVerifiedAt||data.updatedAt||"");
  }catch(error){
    // Nie uruchamiamy automatycznie kolejnego żądania przy każdym renderze.
    // Gdy API jest chwilowo niedostępne, zachowujemy ostatni stan widoku,
    // pokazujemy błąd i czekamy na świadome użycie „Odśwież status”.
    vonHalskyStan.loaded=true;
    vonHalskyStan.error=String(error?.message||error);
  }
  vonHalskyStan.loading=false;
  if(render&&String(trasa()).startsWith("/admin/von-halsky/wystawianie")&&document.querySelector(".von-halsky-listing-workspace"))vonHalskyAktualizujWystawianieDOM();
  else if(render&&String(trasa()).startsWith("/admin/von-halsky/ustawienia")&&typeof vonHalskyAktualizujUstawieniaDOM==="function")vonHalskyAktualizujUstawieniaDOM();
  else if(render&&String(trasa())==="/admin/von-halsky"&&typeof vonHalskyAktualizujPulpitDOM==="function")vonHalskyAktualizujPulpitDOM({dashboard:false});
  else if(render&&String(trasa()).startsWith("/admin/von-halsky"))renderuj();
}
async function vonHalskyUzgodnijKatalog({silent=false,repeat=false,render=true}={}){
  if(vonHalskyReconcilePromise)return vonHalskyReconcilePromise;
  vonHalskyReconcilePromise=(async()=>{
    try{
      const data=await chmura("von-halsky-reconcile-catalog",{method:"POST",body:{},timeout:120000});
      if(Array.isArray(data.offers))vonHalskyStan.offers=data.offers;
      if(data.truth)vonHalskyStan.truth=data.truth;
      if(data.sync)vonHalskyStan.sync={...vonHalskyStan.sync,...data.sync};
      vonHalskyStan.channelStatus={
        ...vonHalskyStan.channelStatus,
        verifiedAt:data.sync?.lastCatalogVerifiedAt||data.sync?.lastCatalogAt||vonHalskyStan.channelStatus?.verifiedAt||null,
        truth:data.truth||vonHalskyStan.truth,
        operations:{
          ...vonHalskyStan.channelStatus?.operations,
          pendingCommands:Number(data.sync?.pendingCommandCount??vonHalskyStan.channelStatus?.operations?.pendingCommands??0),
        },
        consistent:true,
      };
      vonHalskyZastosujAktualizacjeProduktow(data.productUpdates||[]);
      if(!silent)toast(`API potwierdza: ${data.truth?.published||0} w sprzedaży • ${data.truth?.pending||0} w publikacji • ${(data.reconciliation?.staleCleared||0)+(data.reconciliation?.duplicateMappings||0)} błędnych powiązań usunięto ✅`);
      return data;
    }catch(error){
      if(!silent)toast("Nie uzgodniono katalogu z API: "+(error.message||error));
      throw error;
    }finally{
      vonHalskyReconcilePromise=null;
      if(render&&String(trasa()).startsWith("/admin/von-halsky/wystawianie"))vonHalskyAktualizujWystawianieDOM();
      else if(render&&String(trasa()).startsWith("/admin/von-halsky"))renderuj();
    }
  })();
  return vonHalskyReconcilePromise;
}
async function vonHalskyOdswiezPelnyStatus(){
  if(vonHalskyStan.operation)return;
  const snapshot=vonHalskyMigawkaFiltrow();
  vonHalskyStan.operation="reconcile";
  vonHalskyAktualizujWystawianieDOM();
  try{
    await vonHalskyUzgodnijKatalog({silent:false,render:false});
    await vonHalskyLaduj(true,{render:false});
  }finally{
    vonHalskyStan.operation="";
    vonHalskyPrzywrocFiltry(snapshot);
    vonHalskyAktualizujWystawianieDOM();
  }
}

function vonHalskyEtapOferty(product={},quality=vonHalskyOcenaProduktu(product)){
  const status=String(quality.offerStatus||"").toUpperCase();
  if(!quality.dostepny||["CLOSED","SOLDOUT","INACTIVE"].includes(status))return "wstrzymane";
  if(["PENDING","PROCESSING","VERIFYING"].includes(status)||(!quality.offerVerified&&["queued","publishing"].includes(String(product.vonHalskyEditorialSyncState||"").toLowerCase())))return "publikowanie";
  if(["REJECTED","ERROR"].includes(status))return "aktualizacja";
  if(status==="PUBLISHED"&&(!quality.gotowy||product.vonHalskyEditorialSyncPending===true))return "aktualizacja";
  if(status==="PUBLISHED"&&quality.offerVerified)return "sprzedaz";
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
function vonHalskyProblemProduktu(quality={},problem="wszystkie"){
  if(problem==="wszystkie")return true;
  const issues=normalizujSzukanyTekst((quality.braki||[]).join(" "));
  if(problem==="identyfikacja")return !quality.ean&&!(quality.kod&&quality.marka);
  if(problem==="zdjecie")return issues.includes("zdjec");
  if(problem==="opis")return issues.includes("opis")||issues.includes("nazwa");
  if(problem==="kategoria")return !quality.categoryId;
  if(problem==="gpsr")return quality.gpsr.required&&!quality.gpsr.ready;
  if(problem==="cena")return !quality.cena;
  return true;
}
function vonHalskyOpcjeFiltrow(){
  if(vonHalskyStan.productQueue.loaded){
    const facets=vonHalskyStan.productQueue.facets||{};
    return {
      producers:(facets.producers||[]).map(item=>({id:String(item.value||""),label:String(item.value||""),count:Number(item.count)||0})),
      categories:(facets.categories||[]).map(item=>({id:String(item.value||""),label:String(item.value||""),count:Number(item.count)||0})),
    };
  }
  const producers=new Map(),categories=new Map();
  for(const product of vonHalskyProdukty()){
    const producer=String(product.producent||product.marka||"").trim(),category=String(product.kategoria||"").trim();
    if(producer){const id=normalizujSzukanyTekst(producer);producers.set(id,{id,label:producer,count:(producers.get(id)?.count||0)+1});}
    if(category){const id=normalizujSzukanyTekst(category);categories.set(id,{id,label:category,count:(categories.get(id)?.count||0)+1});}
  }
  const sorter=(left,right)=>left.label.localeCompare(right.label,"pl");
  return {producers:[...producers.values()].sort(sorter),categories:[...categories.values()].sort(sorter)};
}
function vonHalskyLiczbaAktywnychFiltrow(){
  return [
    !!vonHalskySzukaj,
    vonHalskyEtap!=="wszystkie",
    vonHalskyFiltr!=="wszystkie",
    vonHalskyAgentFiltr!=="wszystkie",
    vonHalskyStatusKanalu!=="wszystkie",
    vonHalskyDostepnosc!=="wszystkie",
    vonHalskyProducent!=="wszyscy",
    vonHalskyKategoria!=="wszystkie",
    vonHalskyProblem!=="wszystkie",
    vonHalskyCena!=="wszystkie",
    vonHalskySort!=="jakosc",
  ].filter(Boolean).length;
}
function vonHalskyResetujFiltry(){
  vonHalskySzukaj="";vonHalskyEtap="wszystkie";vonHalskyFiltr="wszystkie";vonHalskyAgentFiltr="wszystkie";
  vonHalskyStatusKanalu="wszystkie";vonHalskyDostepnosc="wszystkie";vonHalskyProducent="wszyscy";
  vonHalskyKategoria="wszystkie";vonHalskyProblem="wszystkie";vonHalskyCena="wszystkie";
  vonHalskySort="jakosc";vonHalskyStrona=1;vonHalskyStan.productQueue.cursor="";void vonHalskyPobierzKolejkeProduktow({force:true});
}
function vonHalskyKluczZapytaniaProduktow(){
  return JSON.stringify(vonHalskyMigawkaFiltrow());
}
async function vonHalskyPobierzKolejkeProduktow({force=false,cursor=null}={}){
  const queue=vonHalskyStan.productQueue,key=vonHalskyKluczZapytaniaProduktow();
  if(queue.loading||(!force&&queue.loaded&&queue.queryKey===key&&cursor===null))return;
  queue.loading=true;queue.error="";
  if(cursor!==null)queue.cursor=String(cursor||"");
  if(String(trasa()).startsWith("/admin/von-halsky/wystawianie"))vonHalskyAktualizujWystawianieDOM({stages:false,truth:false});
  try{
    const data=await chmura("von-halsky-product-queue",{params:{
      q:vonHalskySzukaj,stage:vonHalskyEtap,quality:vonHalskyFiltr,agent:vonHalskyAgentFiltr,
      channel:vonHalskyStatusKanalu,availability:vonHalskyDostepnosc,producer:vonHalskyProducent,
      category:vonHalskyKategoria,problem:vonHalskyProblem,price:vonHalskyCena,sort:vonHalskySort,
      page:vonHalskyStrona,limit:vonHalskyNaStronie,cursor:queue.cursor,
    },timeout:30000});
    Object.assign(queue,{loaded:true,items:Array.isArray(data.items)?data.items:[],total:Number(data.total)||0,
      summary:data.summary||{},facets:data.facets||{producers:[],categories:[]},nextCursor:data.nextCursor||null,
      previousCursor:data.previousCursor||null,queryKey:key,error:""});
    vonHalskyProduktyRenderCache=queue.items;vonHalskyOcenaRenderCache=new WeakMap();
  }catch(error){queue.error=String(error?.message||error);}
  queue.loading=false;
  if(String(trasa()).startsWith("/admin/von-halsky/wystawianie"))vonHalskyAktualizujWystawianieDOM();
}
function vonHalskyPrzejdzKolejke(kierunek=1){
  const queue=vonHalskyStan.productQueue,cursor=kierunek>0?queue.nextCursor:queue.previousCursor;
  if(!cursor)return;
  vonHalskyStrona=Math.max(1,vonHalskyStrona+(kierunek>0?1:-1));
  void vonHalskyPobierzKolejkeProduktow({force:true,cursor});
}
function vonHalskyOdswiezFiltrowanyWidok({filters=false}={}){
  if(filters)vonHalskyPodmienWyspe('[data-admin-search-panel="von-halsky-products"]',vonHalskyFiltryHTML(vonHalskyWiersze()));
  vonHalskyPodmienWyspe("[data-vh-stage-filters]",vonHalskyEtapySprzedazyHTML());
  vonHalskyPodmienWyspe("[data-vh-results-region]",vonHalskyWynikiHTML());
}
function vonHalskyZmienFiltr(){
  vonHalskyStrona=1;vonHalskyStan.productQueue.cursor="";
  void vonHalskyPobierzKolejkeProduktow({force:true});
}
function vonHalskySzukajPoWpisaniu(value){
  vonHalskySzukaj=String(value||"");vonHalskyStrona=1;
  clearTimeout(vonHalskyFiltrTimer);
  vonHalskyFiltrTimer=setTimeout(()=>{vonHalskyStan.productQueue.cursor="";void vonHalskyPobierzKolejkeProduktow({force:true});},350);
}
function vonHalskyWiersze(){
  if(vonHalskyStan.productQueue.loaded){
    return (vonHalskyStan.productQueue.items||[]).map(product=>({product,quality:vonHalskyOcenaProduktu(product)}));
  }
  const q=normalizujSzukanyTekst(vonHalskySzukaj),terms=q.split(" ").filter(Boolean);
  const rows=vonHalskyProdukty().map(product=>({product,quality:vonHalskyOcenaProduktu(product)})).filter(({product,quality})=>{
    const searchable=normalizujSzukanyTekst([product.nazwa,product.externalId,product.sku,product.id,quality.ean,quality.kod,quality.marka,product.producent,product.kategoria,quality.categoryPath,quality.ofertaId,quality.offerStatus,quality.gpsr?.name].join(" "));
    if(terms.some(term=>!searchable.includes(term)))return false;
    if(vonHalskyFiltr==="gotowe"&&!quality.gotowy)return false;
    if(vonHalskyFiltr==="braki"&&quality.gotowy)return false;
    if(vonHalskyFiltr==="ean"&&!quality.ean)return false;
    if(vonHalskyFiltr==="bez-ean"&&quality.ean)return false;
    if(vonHalskyFiltr==="kategoria"&&!quality.categoryId)return false;
    if(vonHalskyFiltr==="bez-kategorii"&&quality.categoryId)return false;
    if(vonHalskyFiltr==="gpsr"&&!quality.gpsr.ready)return false;
    if(vonHalskyFiltr==="bez-gpsr"&&quality.gpsr.ready)return false;
    const remoteStatus=String(quality.offerStatus||"").toUpperCase();
    if(vonHalskyStatusKanalu==="aktywne"&&remoteStatus!=="PUBLISHED")return false;
    if(vonHalskyStatusKanalu==="weryfikacja"&&!["PENDING","PROCESSING","VERIFYING"].includes(remoteStatus))return false;
    if(vonHalskyStatusKanalu==="odrzucone"&&!["REJECTED","ERROR"].includes(remoteStatus))return false;
    if(vonHalskyStatusKanalu==="niewystawione"&&quality.offerVerified)return false;
    if(vonHalskyDostepnosc==="dostepne"&&!quality.dostepny)return false;
    if(vonHalskyDostepnosc==="wstrzymane"&&quality.dostepny)return false;
    if(vonHalskyProducent!=="wszyscy"&&normalizujSzukanyTekst(product.producent||product.marka)!==vonHalskyProducent)return false;
    if(vonHalskyKategoria!=="wszystkie"&&normalizujSzukanyTekst(product.kategoria)!==vonHalskyKategoria)return false;
    if(vonHalskyCena==="z-cena"&&!quality.cena)return false;
    if(vonHalskyCena==="bez-ceny"&&quality.cena)return false;
    if(!vonHalskyProblemProduktu(quality,vonHalskyProblem))return false;
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
function vonHalskyUstawZaznaczenieZakres(zakres="strona",checked=true){
  const rows=vonHalskyWiersze(),start=vonHalskyStan.productQueue.loaded?0:(vonHalskyStrona-1)*vonHalskyNaStronie;
  const ids=(zakres==="strona"?rows.slice(start,start+vonHalskyNaStronie):rows).map(({product})=>String(product.id));
  vonHalskyUstawZaznaczenie(ids,checked);
}
function vonHalskySubnavHTML(aktywny="pulpit"){
  const stats=vonHalskyStatystyki();
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/von-halsky",label:"📊 Pulpit"},
    {id:"zamowienia",href:"#/admin/von-halsky/zamowienia",label:"📦 Zamówienia"},
    {id:"wystawianie",href:"#/admin/von-halsky/wystawianie",label:"🏷️ Wystawianie",badge:stats.doDzialania||""},
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
  return `<section class="panel von-halsky-workspace-head" data-vh-channel-header><div class="von-halsky-workspace-title"><span>${cfg[0]}</span><div><small>${esc(cfg[1])}</small><h1>${esc(cfg[2])}</h1><p>${esc(cfg[3])}</p></div></div><div class="von-halsky-workspace-metrics">${(cfg[4]||[]).map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div></section>`;
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
  requestAnimationFrame(()=>vonHalskyAktualizujWystawianieDOM({stages:false,truth:false}));
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
    const suggestion=product?.vonHalskyAgentCategorySuggestion||null;
    vonHalskyZamknijKategorie();
    const shell=document.createElement("div");shell.id="vonHalskyCategoryPicker";shell.className="von-halsky-product-preview-shell";
    shell.innerHTML=`<section role="dialog" aria-modal="true" class="von-halsky-product-preview"><header><div><span>Aktualne drzewo API • ${categories.length} kategorii końcowych</span><h2>Przypisz kategorię Von Halsky</h2><small>${esc(product?.nazwa||productId)}</small></div><button class="btn ghost" type="button" data-close>✕ Zamknij</button></header><main style="padding:20px">${suggestion?.path?`<section class="von-halsky-category-link"><div><small>Najlepsza propozycja Agenta</small><b>${esc(suggestion.path)}</b><span>${Math.round(Number(suggestion.confidence||0)*100)}% pewności • ${esc((suggestion.evidence||[]).slice(0,2).join(" • "))}</span></div><button class="btn" type="button" data-category-id="${esc(suggestion.id)}">Wybierz propozycję</button></section>`:""}<label>Wyszukaj w pełnym drzewie kategorii<input data-category-search autofocus placeholder="np. gry planszowe, balony, zabawki"></label><div data-category-results class="von-halsky-diagnostic-list"></div></main></section>`;
    const input=shell.querySelector("[data-category-search]"),results=shell.querySelector("[data-category-results]");
    const draw=()=>{const q=normalizujSzukanyTekst(input.value),rows=categories.filter(item=>!q||normalizujSzukanyTekst(item.path||item.name).includes(q)).slice(0,100);results.innerHTML=rows.map(item=>`<article><span>›</span><div><b>${esc(item.name)}</b><small>${esc(item.path)}</small></div><button class="btn" type="button" data-category-id="${esc(item.id)}">Wybierz</button></article>`).join("")||"<small>Brak kategorii pasującej do wyszukiwania.</small>";};
    input.addEventListener("input",draw);shell.addEventListener("click",async event=>{if(event.target===shell||event.target.closest("[data-close]"))return vonHalskyZamknijKategorie();const button=event.target.closest("[data-category-id]");if(!button)return;button.disabled=true;try{await chmura("von-halsky-product-category",{method:"POST",body:{productId,categoryId:button.dataset.categoryId},timeout:30000});toast("Kategoria Von Halsky zapisana ✅");vonHalskyZamknijKategorie();if(typeof odswiezProduktyAdmin==="function")await odswiezProduktyAdmin();await vonHalskyLaduj(true);}catch(error){toast("Nie zapisano kategorii: "+(error.message||error));button.disabled=false;}});
    document.body.appendChild(shell);draw();input.focus();
  }catch(error){toast("Nie pobrano kategorii Von Halsky: "+(error.message||error));}
}
async function vonHalskyZmienStanOferty(offerId,open){
  if(!confirm(`${open?"Wznowić":"Zamknąć"} tę ofertę w Von Halsky?`))return;
  try{await chmura("von-halsky-offer-state",{method:"POST",body:{offerId,open},timeout:30000});toast(open?"Wznowienie przekazane ✅":"Zamknięcie przekazane ✅");await vonHalskyUzgodnijKatalog({silent:true,repeat:true});}catch(error){toast("Nie zmieniono stanu oferty: "+(error.message||error));}
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
  const {producers,categories}=vonHalskyOpcjeFiltrow(),active=vonHalskyLiczbaAktywnychFiltrow();
  const options=(items,current)=>items.map(([value,label])=>`<option value="${esc(value)}" ${current===value?"selected":""}>${esc(label)}</option>`).join("");
  const fields=`<div class="allegro-listing-advanced-grid admin-search-full von-halsky-filter-grid">
    <label class="allegro-listing-search-wide"><span>Produkt, oferta lub identyfikator</span><input placeholder="Nazwa, EAN, EXTERNAL_ID, SKU, kod producenta, ID oferty…" value="${esc(vonHalskySzukaj)}" oninput="vonHalskySzukajPoWpisaniu(this.value)"></label>
    <label><span>Etap sprzedaży</span><select onchange="vonHalskyEtap=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Wszystkie etapy"],["sprzedaz","W sprzedaży"],["publikowanie","W publikacji / weryfikacji"],["wystawienie","Do wystawienia"],["przygotowanie","Do przygotowania"],["aktualizacja","Do aktualizacji"],["wstrzymane","Wstrzymane"]],vonHalskyEtap)}</select></label>
    <label><span>Problem do rozwiązania</span><select onchange="vonHalskyProblem=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy problem"],["identyfikacja","Brak identyfikacji"],["zdjecie","Brak zdjęcia"],["opis","Nazwa lub opis"],["kategoria","Brak kategorii"],["gpsr","Niekompletny GPSR"],["cena","Brak ceny"]],vonHalskyProblem)}</select></label>
    <label><span>Jakość danych</span><select onchange="vonHalskyFiltr=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy poziom"],["gotowe","Gotowe do publikacji"],["braki","Wymagają uzupełnienia"],["ean","Z poprawnym EAN"],["bez-ean","Bez poprawnego EAN"],["kategoria","Z kategorią kanału"],["bez-kategorii","Bez kategorii kanału"],["gpsr","Z kompletnym GPSR"],["bez-gpsr","Bez kompletnego GPSR"]],vonHalskyFiltr)}</select></label>
    <label><span>Praca Agenta</span><select onchange="vonHalskyAgentFiltr=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy stan"],["w-toku","Wykonywane teraz"],["gotowe","Potwierdzone zapisem"],["wymaga-danych","Wymagają danych"],["ponowienie","Zaplanowane ponowienie"],["blad","Błąd wykonania"],["oczekuje","Jeszcze niesprawdzone"]],vonHalskyAgentFiltr)}</select></label>
    <label><span>Status kanału</span><select onchange="vonHalskyStatusKanalu=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy status"],["aktywne","Potwierdzone PUBLISHED"],["weryfikacja","PENDING / w weryfikacji"],["odrzucone","Odrzucone przez kanał"],["niewystawione","Brak oferty w API"]],vonHalskyStatusKanalu)}</select></label>
    <label><span>Producent</span><select onchange="vonHalskyProducent=this.value;vonHalskyZmienFiltr()"><option value="wszyscy">Wszyscy producenci</option>${producers.map(item=>`<option value="${esc(item.id)}" ${vonHalskyProducent===item.id?"selected":""}>${esc(item.label)} (${item.count})</option>`).join("")}</select></label>
    <label><span>Kategoria sklepu</span><select onchange="vonHalskyKategoria=this.value;vonHalskyZmienFiltr()"><option value="wszystkie">Wszystkie kategorie</option>${categories.map(item=>`<option value="${esc(item.id)}" ${vonHalskyKategoria===item.id?"selected":""}>${esc(item.label)} (${item.count})</option>`).join("")}</select></label>
    <label><span>Cena kanału</span><select onchange="vonHalskyCena=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Z ceną i bez ceny"],["z-cena","Cena ustalona"],["bez-ceny","Brak ceny"]],vonHalskyCena)}</select></label>
    <label><span>Dostępność</span><select onchange="vonHalskyDostepnosc=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy stan"],["dostepne","Dostępne w sprzedaży"],["wstrzymane","Wstrzymane"]],vonHalskyDostepnosc)}</select></label>
    <label><span>Sortowanie</span><select onchange="vonHalskySort=this.value;vonHalskyZmienFiltr()">${options([["jakosc","Najpierw wymagające pracy"],["nazwa","Nazwa A–Z"],["ean","EAN / GTIN"],["cena","Cena malejąco"]],vonHalskySort)}</select></label>
    <label><span>Na stronie</span><select onchange="vonHalskyNaStronie=Number(this.value)||50;vonHalskyZmienFiltr()">${[25,50,100,250,500,1000].map(value=>`<option value="${value}" ${vonHalskyNaStronie===value?"selected":""}>${value}</option>`).join("")}</select></label>
    <button class="btn ghost allegro-listing-reset" type="button" onclick="vonHalskyResetujFiltry()" ${active?"":"disabled"}>Wyczyść filtry${active?` (${active})`:""}</button>
  </div>`;
  return adminWyszukiwaniePanelHTML({id:"von-halsky-products",title:"Wyszukiwanie i filtry ofert",description:"Łącz identyfikatory, problem, jakość, Agenta, producenta, kategorię, cenę i dostępność. Etap sprzedaży wybierasz kafelkami powyżej.",fields,results:rows.length,active:active>0,open:true});
}
function vonHalskyPublikacjaWyboruHTML(rows){
  const selected=rows.filter(({product})=>vonHalskyZaznaczone.has(String(product.id))),ready=selected.filter(({quality})=>quality.gotowy),blocked=selected.length-ready.length;
  const connected=vonHalskyStan.sync?.status==="connected",configured=vonHalskyStan.config?.configured===true,busy=!!vonHalskyStan.operation;
  const status=!selected.length?"Zaznacz produkty w tabeli":!configured?"Uzupełnij prywatny kontrakt API":!connected?"Najpierw wykonaj test połączenia":blocked?`${ready.length} gotowych • ${blocked} zablokowanych`:`${ready.length} gotowych do przekazania`;
  return `<section class="von-halsky-publication-bar ${selected.length?"has-selection":""}" aria-label="Przygotowanie i ręczna publikacja ofert"><div class="von-halsky-publication-icon">↗</div><div><small>Agent przygotowuje • administrator publikuje</small><b>Praca wyłącznie na zaznaczonych produktach</b><span>${esc(status)}. Agent zaczyna od najsłabszej kartoteki i nie zmienia aktywnych filtrów.</span></div><div class="von-halsky-publication-count"><strong>${selected.length}</strong><small>zaznaczono</small></div><div class="von-halsky-publication-actions"><button class="btn ghost" type="button" ${!selected.length||busy?"disabled":""} onclick="vonHalskyPrzygotujWybraneAgentem()">${vonHalskyStan.operation==="agent"?"Agent pracuje…":`🤖 Przygotuj Agentem (${selected.length})`}</button><button class="btn" type="button" ${!selected.length||!configured||!connected||busy?"disabled":""} onclick="vonHalskySynchronizujKatalog()">${vonHalskyStan.operation==="catalog"?"Przekazuję…":`Opublikuj / aktualizuj (${selected.length})`}</button></div></section>`;
}
function vonHalskyTabelaWierszHTML({product,quality}={}){
  const productId=String(product.id),match=vonHalskyMetodaDopasowania(product,quality),agent=vonHalskyAgentStan(product);
  const offerClosed=["CLOSED","SOLDOUT","INACTIVE"].includes(String(quality.offerStatus||"").toUpperCase());
  const remoteStatus=String(quality.offerStatus||"").toUpperCase(),channelLabel=remoteStatus==="PUBLISHED"?"W sprzedaży • PUBLISHED":["PENDING","PROCESSING","VERIFYING"].includes(remoteStatus)?"W publikacji • "+remoteStatus:["REJECTED","ERROR"].includes(remoteStatus)?"Odrzucona • "+remoteStatus:quality.gotowy?"gotowy do przekazania":"wymaga danych";
  return `<tr class="${quality.gotowy?"is-ready":"needs-work"} ${vonHalskyZaznaczone.has(productId)?"is-selected":""}">
    <td data-label="" class="von-halsky-cell-select"><input type="checkbox" aria-label="Zaznacz ${esc(quality.nazwa||"produkt")}" ${vonHalskyZaznaczone.has(productId)?"checked":""} onchange="vonHalskyUstawZaznaczenie([${jsArg(productId)}],this.checked)"></td>
    <td data-label="Produkt" class="von-halsky-cell-product"><div class="von-halsky-product"><span>${quality.zdjecie?`<img src="${esc(quality.zdjecie)}" loading="lazy" alt="">`:esc(product.ikona||"📦")}</span><div><b>${esc(quality.nazwa||"Produkt")}</b><small>${esc(product.kategoria||"bez kategorii")} • ${esc(product.producent||product.marka||"producent —")}</small><em>${quality.presentation.mode==="custom"?"Dopasowanie Von Halsky":"Treść ze sklepu"}</em></div></div></td>
    <td data-label="Identyfikacja" class="von-halsky-cell-identity"><div class="von-halsky-identity"><span class="von-halsky-match-state ${match.level}">${esc(match.label)}</span><b>EAN ${esc(quality.ean||"—")}</b><small>EXTERNAL_ID ${esc(product.externalId||product.sku||product.id||"—")}</small><small>Kod ${esc(quality.kod||"—")} • marka ${esc(quality.marka||"—")}</small><small>Kategoria ${esc(quality.categoryPath||quality.categoryId||"nieprzypisana")}${quality.categoryResolution?.source?` • ${esc(vonHalskyZrodloKategorii(quality.categoryResolution.source))}`:""}</small><small class="${quality.gpsr.ready?"von-halsky-ok":"von-halsky-issues"}">GPSR ${quality.gpsr.ready?`✓ ${esc(quality.gpsr.name)}`:`— ${esc(quality.gpsr.missing.join(", "))}`}</small></div></td>
    <td data-label="Gotowość" class="von-halsky-cell-quality"><div class="von-halsky-quality"><div class="von-halsky-score"><strong>${quality.wynik}%</strong><span><i style="width:${quality.wynik}%"></i></span></div><span class="von-halsky-agent-state ${agent.cls}">${esc(agent.label)}</span>${product.vonHalskyAgentReadbackConfirmed===true&&product.vonHalskyAgentConfirmedAt?`<small>potwierdzony zapis ${esc(allegroDataTxt(product.vonHalskyAgentConfirmedAt))}</small>`:""}${quality.braki.length?`<small class="von-halsky-issues">${quality.braki.map(esc).join(" • ")}</small>`:'<small class="von-halsky-ok">Dane spełniają kontrolę obowiązkową</small>'}${quality.ostrzezenia.length?`<small>${quality.ostrzezenia.map(esc).join(" • ")}</small>`:""}</div></td>
    <td data-label="Cena i kanał" class="von-halsky-cell-channel"><div class="von-halsky-channel-cell"><b>${quality.cena?zl(quality.cena):"Cena —"}</b><small>${quality.dostepny?"sprzedaż aktywna":"sprzedaż wstrzymana"}</small><span class="lvl ${remoteStatus==="PUBLISHED"?"lvl-ok":["PENDING","PROCESSING","VERIFYING"].includes(remoteStatus)?"lvl-info":"lvl-ostrzezenie"}">${esc(channelLabel)}</span>${quality.ofertaId?`<small>ID z API ${esc(quality.ofertaId)}</small>`:""}${!quality.ofertaId&&quality.localOfferId?`<small>lokalne ID odrzucone do czasu potwierdzenia API</small>`:""}<small>Zakres ${vonHalskyStan.settings.minimumStock}–${vonHalskyStan.settings.maximumStock} szt.</small></div></td>
    <td data-label="Akcje" class="von-halsky-cell-actions"><div class="von-halsky-row-actions"><button class="btn" type="button" onclick="vonHalskyOtworzDopasowanie(${jsArg(product.id)})">Popraw dopasowanie</button><div class="von-halsky-row-secondary"><button class="btn ghost" type="button" ${vonHalskyStan.operation?"disabled":""} onclick="vonHalskyPrzygotujAgentem([${jsArg(productId)}])">🤖 Przygotuj</button><button class="btn ghost" type="button" onclick="vonHalskyOtworzPodglad(${jsArg(product.id)})">Podgląd</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(product.id)}">Edycja</a>${quality.ofertaId?`<button class="btn ghost" type="button" onclick="vonHalskyZmienStanOferty(${jsArg(quality.ofertaId)},${offerClosed?"true":"false"})">${offerClosed?"Wznów":"Zamknij"}</button>`:""}</div></div></td>
  </tr>`;
}
function vonHalskyWynikiHTML(){
  const rows=vonHalskyWiersze(),server=vonHalskyStan.productQueue.loaded,total=server?vonHalskyStan.productQueue.total:rows.length,pages=Math.max(1,Math.ceil(total/vonHalskyNaStronie));vonHalskyStrona=Math.min(vonHalskyStrona,pages);
  const start=server?Math.max(0,(vonHalskyStrona-1)*vonHalskyNaStronie):(vonHalskyStrona-1)*vonHalskyNaStronie,visible=server?rows:rows.slice(start,start+vonHalskyNaStronie),selected=[...vonHalskyZaznaczone].filter(id=>rows.some(({product})=>String(product.id)===id));
  const shownFrom=visible.length?start+1:0,shownTo=start+visible.length;
  return `<div data-vh-results-region>
    ${vonHalskyStan.productQueue.loading?`<div class="von-halsky-inline-loading"><span></span><b>Pobieram właściwy fragment katalogu z PostgreSQL…</b></div>`:""}
    ${vonHalskyStan.productQueue.error?`<div class="backend-note warning"><b>Nie pobrano kolejki produktów</b><span>${esc(vonHalskyStan.productQueue.error)}</span></div>`:""}
    ${adminOperacjeWynikowHTML({id:"von-halsky-products",selected:selected.length,pageCount:visible.length,resultCount:total,selectPage:"vonHalskyUstawZaznaczenieZakres('strona',true)",selectAll:"vonHalskyUstawZaznaczenieZakres('filtr',true)",clear:"vonHalskyUstawZaznaczenieZakres('filtr',false)",exportSelected:"vonHalskyEksportuj('selected')",exportAll:"vonHalskyEksportuj('all')",exportLabel:"CSV Von Halsky"})}
    ${vonHalskyPublikacjaWyboruHTML(rows)}
    <div class="allegro-listing-results-head"><div><b>${total} produktów w aktywnym widoku</b><small>Pokazano ${shownFrom}–${shownTo} • strona ${vonHalskyStrona} z ${pages} • paginacja serwerowa</small></div><span><b>${selected.length}</b> zaznaczonych</span></div>
    <div class="admin-standard-table-wrap von-halsky-table-wrap"><table class="admin-standard-table admin-responsive-table von-halsky-table"><colgroup><col class="von-halsky-col-select"><col class="von-halsky-col-product"><col class="von-halsky-col-identity"><col class="von-halsky-col-quality"><col class="von-halsky-col-channel"><col class="von-halsky-col-actions"></colgroup><thead><tr><th><input type="checkbox" aria-label="Zaznacz produkty na stronie" ${visible.length&&visible.every(({product})=>vonHalskyZaznaczone.has(String(product.id)))?"checked":""} onchange="vonHalskyUstawZaznaczenieZakres('strona',this.checked)"></th><th>Produkt</th><th>Identyfikacja</th><th>Gotowość</th><th>Cena i kanał</th><th>Akcje</th></tr></thead><tbody>${visible.map(vonHalskyTabelaWierszHTML).join("")||'<tr><td data-label="" colspan="6"><div class="allegro-listing-empty"><span>⌕</span><b>Brak produktów w tym widoku</b><small>Zmień filtry albo wyczyść wyszukiwanie.</small></div></td></tr>'}</tbody></table></div>
    ${pages>1?`<nav class="allegro-listing-pagination von-halsky-pagination" aria-label="Paginacja produktów"><button class="btn ghost" ${vonHalskyStrona<=1||server&&!vonHalskyStan.productQueue.previousCursor?"disabled":""} onclick="${server?"vonHalskyPrzejdzKolejke(-1)":"vonHalskyStrona--;vonHalskyOdswiezFiltrowanyWidok()"}">← Poprzednia</button><span>Strona <b>${vonHalskyStrona}</b> z <b>${pages}</b></span><button class="btn ghost" ${vonHalskyStrona>=pages||server&&!vonHalskyStan.productQueue.nextCursor?"disabled":""} onclick="${server?"vonHalskyPrzejdzKolejke(1)":"vonHalskyStrona++;vonHalskyOdswiezFiltrowanyWidok()"}">Następna →</button></nav>`:""}
  </div>`;
}
function vonHalskyWystawianieHTML(){
  const rows=vonHalskyWiersze();
  if(!vonHalskyStan.productQueue.loaded&&!vonHalskyStan.productQueue.loading)setTimeout(()=>vonHalskyPobierzKolejkeProduktow({force:true}),0);
  return `<div class="allegro-listing-workspace von-halsky-listing-workspace"><section class="panel von-halsky-catalog-panel"><div class="order-section-head"><div><span class="order-pro-label">Jedno centrum ofert</span><h2>Przygotowanie i wystawianie produktów</h2><p class="order-detail-lead">Powiązanie, jakość danych, podgląd i publikacja są wykonywane w jednym miejscu. „W sprzedaży” oznacza wyłącznie status PUBLISHED potwierdzony aktualnym odczytem API.</p></div><button class="btn ghost" ${vonHalskyStan.operation?"disabled":""} onclick="vonHalskyOdswiezPelnyStatus()">${vonHalskyStan.operation==="reconcile"?"Uzgadniam…":"↻ Uzgodnij z API"}</button></div>
    ${vonHalskyKanalPrawdyHTML()}
    ${vonHalskyEtapySprzedazyHTML()}
    ${vonHalskyFiltryHTML(rows)}
    ${vonHalskyWynikiHTML()}
    ${vonHalskyPanelProcesuHTML()}
  </section></div>`;
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
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="orders";
  if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();
  try{const data=await chmura("von-halsky-sync-orders",{method:"POST",body:{limit:250},timeout:60000});vonHalskyStan.orders=data.orders||[];vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};toast(`Pobrano ${data.fetched||0} zamówień Von Halsky ✅`);}catch(error){toast("Zamówienia Von Halsky: "+(error.message||error));}finally{vonHalskyStan.operation="";if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();}
}
async function vonHalskyDecyzjaZamowienia(orderId,accepted){
  if(!confirm(`${accepted?"Przyjąć":"Odrzucić"} zamówienie ${orderId} w InPost Von Halsky?`))return;
  try{const data=await chmura("von-halsky-order-state",{method:"POST",body:{orderId,accepted},timeout:30000});vonHalskyStan.orders=data.orders||vonHalskyStan.orders;toast(accepted?"Zamówienie przyjęte ✅":"Zamówienie odrzucone");renderuj();}catch(error){toast("Nie zapisano decyzji: "+(error.message||error));}
}
async function vonHalskySynchronizujPosprzedaz(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="post-sales";
  if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();
  try{const data=await chmura("von-halsky-post-sales-sync",{method:"POST",body:{limit:250},timeout:60000});vonHalskyStan.returns=data.returns||[];vonHalskyStan.claims=data.claims||[];toast("Zwroty i reklamacje odświeżone ✅");}catch(error){toast("Obsługa posprzedażowa: "+(error.message||error));}finally{vonHalskyStan.operation="";if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();}
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
  try{
    const form=event.currentTarget,data=await chmura("von-halsky-settings",{method:"POST",body:vonHalskySettingsBody(form),timeout:20000});
    vonHalskyStan.settings={...vonHalskyStan.settings,...data.settings};vonHalskyStan.config=data.config||vonHalskyStan.config;
    form.classList.remove("is-dirty");const state=form.querySelector("[data-save-state]");
    if(state){state.textContent="Wszystkie ustawienia zapisane";state.classList.remove("is-dirty");}
    toast("Ustawienia Von Halsky zapisane ✅");
  }catch(error){toast("Nie zapisano ustawień: "+(error.message||error));}
  finally{button.disabled=false;}
}
async function vonHalskySprawdzPolaczenie(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="connection";vonHalskyAktualizujUstawieniaDOM();
  try{const data=await chmura("von-halsky-connection-check",{method:"POST",body:{},timeout:25000});vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};toast(data.connected?"Połączenie API Von Halsky działa ✅":"Nie potwierdzono połączenia");if(data.connected)await vonHalskyUzgodnijKatalog({silent:true,render:false});await vonHalskyLaduj(true,{render:false});}catch(error){toast("Von Halsky: "+(error.message||error));await vonHalskyLaduj(true,{render:false});}finally{vonHalskyStan.operation="";vonHalskyAktualizujUstawieniaDOM();}
}
async function vonHalskySprawdzPakiet(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="preview";vonHalskyAktualizujUstawieniaDOM();
  try{const data=await chmura("von-halsky-catalog-preview",{timeout:30000});vonHalskyStan.preview=data;toast(`Pakiet sprawdzony: ${data.eligible||0} gotowych ofert ✅`);}catch(error){toast("Nie sprawdzono pakietu: "+(error.message||error));}finally{vonHalskyStan.operation="";vonHalskyAktualizujUstawieniaDOM();}
}
async function vonHalskySynchronizujKatalog(){
  if(vonHalskyStan.operation)return;
  const productIds=[...vonHalskyZaznaczone];
  if(!productIds.length){toast("Zaznacz produkty, które chcesz opublikować lub zaktualizować.");return;}
  if(vonHalskyStan.config?.configured!==true){toast("Najpierw uzupełnij prywatny kontrakt API Von Halsky.");return;}
  if(vonHalskyStan.sync?.status!=="connected"){toast("Najpierw wykonaj poprawny test połączenia API.");return;}
  const filterSnapshot=vonHalskyMigawkaFiltrow();
  vonHalskyStan.operation="catalog";vonHalskyAktualizujWystawianieDOM();
  try{
    const data=await chmura("von-halsky-sync-catalog",{method:"POST",body:{publish:true,batchSize:50,productIds},timeout:180000});
    vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};
    if(Array.isArray(data.offers))vonHalskyStan.offers=data.offers;
    vonHalskyZastosujAktualizacjeProduktow(data.productUpdates||[]);
    vonHalskyZaznaczone.clear();
    vonHalskyPrzywrocFiltry(filterSnapshot);
    const unconfirmed=Number(data.unconfirmed)||0;
    toast(`API potwierdziło przyjęcie: ${data.accepted??data.created??0} • bez potwierdzenia: ${unconfirmed} • aktualizacje: ${data.updated||0}. Sprzedaż liczymy dopiero po odczycie PUBLISHED.`);
    await vonHalskyUzgodnijKatalog({silent:true,repeat:true});
  }catch(error){
    toast("Synchronizacja Von Halsky: "+(error.message||error));
    await vonHalskyLaduj(true);
  }finally{vonHalskyStan.operation="";vonHalskyPrzywrocFiltry(filterSnapshot);vonHalskyAktualizujWystawianieDOM();}
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
function vonHalskyPrzewinUstawienia(section,button){
  vonHalskyUstawieniaSekcja=String(section||"identity");
  document.querySelectorAll("[data-von-settings-nav]").forEach(item=>item.classList.toggle("active",item===button||item.dataset.vonSettingsNav===vonHalskyUstawieniaSekcja));
  const page=document.querySelector(".von-halsky-settings-page");
  page?.querySelectorAll("[id^='von-halsky-settings-'],[data-von-settings-section]").forEach(item=>item.classList.toggle("von-halsky-setting-visible",item.id===`von-halsky-settings-${vonHalskyUstawieniaSekcja}`||item.dataset.vonSettingsSection===vonHalskyUstawieniaSekcja));
  page?.setAttribute("data-settings-section",vonHalskyUstawieniaSekcja);
}
function widokAdminVonHalsky(sekcja="pulpit"){
  const alias={oferty:"wystawianie",powiazania:"wystawianie"}[sekcja]||sekcja;
  const aktywna=["wystawianie","zamowienia","ustawienia"].includes(alias)?alias:"pulpit";
  if(!vonHalskyStan.loaded&&!vonHalskyStan.loading)setTimeout(()=>vonHalskyLaduj(false),0);
  vonHalskyUruchomOdswiezanieNaZywo();
  const content=aktywna==="wystawianie"?vonHalskyWystawianieHTML():aktywna==="zamowienia"&&typeof vonHalskyOrdersWorkspaceHTML==="function"?vonHalskyOrdersWorkspaceHTML():aktywna==="zamowienia"?vonHalskyZamowieniaHTML():aktywna==="ustawienia"?vonHalskyUstawieniaHTML():typeof vonHalskyDashboardWorkspaceHTML==="function"?vonHalskyDashboardWorkspaceHTML():vonHalskyPulpitHTML();
  if(aktywna==="ustawienia")setTimeout(()=>vonHalskyPrzewinUstawienia(vonHalskyUstawieniaSekcja),0);
  return adminSzkielet("/admin/von-halsky",`<div class="module-page-stack von-halsky-module-page">${vonHalskySubnavHTML(aktywna)}${vonHalskyNaglowekHTML(aktywna)}${vonHalskyStan.error?`<div class="backend-note error"><b>Von Halsky:</b> ${esc(vonHalskyStan.error)}</div>`:""}${content}</div>`);
}
