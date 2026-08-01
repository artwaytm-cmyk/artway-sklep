/* ═══════════ REJESTR BŁĘDÓW (logi + sugestie) ═══════════
   Każdy błąd strony jest zapisywany w pamięci przeglądarki
   (localStorage → klucz artway_logi). Podgląd, pobieranie pliku
   logu i sugestie poprawek: #/admin/system/diagnostyka       */
const MAX_LOGOW = 200;
const DIAGNOSTYKA_KOLEJKA_KEY = "artway_diagnostyka_kolejka";
let diagnostykaWysylkaTimer=null,diagnostykaWysylkaWToku=false;
function diagnostykaKolejka(){
  try{const value=JSON.parse(localStorage.getItem(DIAGNOSTYKA_KOLEJKA_KEY)||"[]");return Array.isArray(value)?value.slice(-30):[];}catch(e){return [];}
}
function diagnostykaWersja(){
  return document.querySelector('meta[name="artway-version"]')?.content||"";
}
function diagnostykaDodajDoKolejki(event){
  if(!["blad","ostrzezenie"].includes(event?.poziom))return;
  try{
    const queue=diagnostykaKolejka(),signature=`${event.poziom}|${event.tresc}|${event.zrodlo}|${location.hash}`;
    if(!queue.some(item=>item.signature===signature))queue.push({
      signature,level:event.poziom,message:event.tresc,source:event.zrodlo||"przeglądarka",
      route:`${location.pathname}${location.hash||""}`,release:diagnostykaWersja(),kind:"browser",at:event.czasIso
    });
    localStorage.setItem(DIAGNOSTYKA_KOLEJKA_KEY,JSON.stringify(queue.slice(-30)));
    clearTimeout(diagnostykaWysylkaTimer);diagnostykaWysylkaTimer=setTimeout(()=>diagnostykaWyslijKolejke(),1200);
  }catch(e){}
}
async function diagnostykaWyslijKolejke(){
  if(diagnostykaWysylkaWToku)return false;
  const queue=diagnostykaKolejka();if(!queue.length)return true;
  diagnostykaWysylkaWToku=true;
  try{
    const headers=typeof chmuraNaglowki==="function"?chmuraNaglowki(true):{"Accept":"application/json","Content-Type":"application/json"};
    const response=await fetch("/api/store?action=diagnostics-ingest",{method:"POST",headers,credentials:"same-origin",body:JSON.stringify({events:queue.map(({signature,...event})=>event)}),keepalive:true});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    localStorage.removeItem(DIAGNOSTYKA_KOLEJKA_KEY);
    return true;
  }catch(e){
    clearTimeout(diagnostykaWysylkaTimer);diagnostykaWysylkaTimer=setTimeout(()=>diagnostykaWyslijKolejke(),30000);
    return false;
  }finally{diagnostykaWysylkaWToku=false;}
}
function normalizujNazweProducenta(value=""){
  const name=String(value??"").replace(/\u0000/g,"").replace(/\s+/g," ").trim().slice(0,160);
  return name&&/\p{L}/u.test(name)?name:"";
}
function poprawnaNazwaProducenta(value=""){return !!normalizujNazweProducenta(value);}
function walidujPoleProducenta(input){
  if(!input)return true;
  const value=String(input.value||"").trim(),valid=!value||poprawnaNazwaProducenta(value);
  input.setCustomValidity(valid?"":"Producent musi być nazwą zawierającą co najmniej jedną literę. Numer wpisz jako kod produktu / producenta.");
  return valid;
}
function pobierzLogi(){ try{ return JSON.parse(localStorage.getItem("artway_logi")||"[]"); }catch(e){ return []; } }
function loguj(poziom, tresc, zrodlo){
  try{
    const logi = pobierzLogi(),teraz=new Date(),tekst=String(tresc).slice(0,500),source=zrodlo||"",czasIso=teraz.toISOString();
    const poprzedni=logi[0],powtorzony=poprzedni&&poprzedni.poziom===poziom&&poprzedni.tresc===tekst&&poprzedni.zrodlo===source&&Date.now()-Date.parse(poprzedni.czasIso||"")<15*60*1000;
    const event={czas:teraz.toLocaleString("pl-PL"),czasIso,poziom,tresc:tekst,zrodlo:source,powtorzenia:powtorzony?Number(poprzedni.powtorzenia||1)+1:1};
    if(powtorzony)logi[0]=event;else logi.unshift(event);
    localStorage.setItem("artway_logi", JSON.stringify(logi.slice(0, MAX_LOGOW)));
    diagnostykaDodajDoKolejki(event);
    odswiezZnacznikDiag();
  }catch(e){/* pamięć pełna — nic więcej nie zrobimy */}
}
window.onerror = (msg, src, linia, kol) => { loguj("blad", msg, `${(src||"").split("/").pop()}:${linia}:${kol}`); };
window.onunhandledrejection = e => { loguj("blad", "Nieobsłużona obietnica: " + (e.reason?.message || e.reason)); };
const _konsolaBlad = console.error.bind(console);
console.error = (...a) => { loguj("blad", a.map(x=>x?.message||x).join(" "), "console"); _konsolaBlad(...a); };
window.addEventListener("online",()=>diagnostykaWyslijKolejke());
window.addEventListener("pagehide",()=>{
  const queue=diagnostykaKolejka();
  if(queue.length&&navigator.sendBeacon){
    const queued=navigator.sendBeacon("/api/store?action=diagnostics-ingest",new Blob([JSON.stringify({events:queue.map(({signature,...event})=>event)})],{type:"application/json"}));
    if(queued)localStorage.removeItem(DIAGNOSTYKA_KOLEJKA_KEY);
  }
});
function odswiezZnacznikDiag(){
  const el = document.getElementById("diagBadge"); if(!el) return;
  const n = pobierzLogi().filter(l=>l.poziom==="blad").length;
  el.textContent = n ? `(${n})` : "";
}

/* ═══════════ PRODUKTY ═══════════
   Sklep pobiera z PostgreSQL wyłącznie potrzebną stronę listy, a pełną kartę
   dopiero po jej otwarciu. products.json pozostaje artefaktem wydania do
   ręcznego eksportu i diagnostyki — nigdy nie jest ładowany przy starcie. */
const PRODUKTY_ZAPASOWE = []; // brak demonstracyjnych towarów i ciężkich snapshotów w pamięci przeglądarki

// Stan integracji jest częścią wspólnego rdzenia aplikacji. Panel korzysta z
// niego na każdej trasie (m.in. przy synchronizacji bazy), dlatego nie może być
// deklarowany dopiero w ładowanym na żądanie module Centrum wysyłek.
let stanBramki={sprawdzono:false,online:false,configured:false,ready:false,authenticated:false,error:"",organizations:[],email:{configured:false,authenticated:false,provider:null},store:{configured:false,writable:false,orders:0,users:0},inpost:{configured:false,authenticated:false,geowidgetConfigured:false,env:"production"}};

/* ═══════════ STAN ═══════════ */
let produkty = [];
let prodBazowe = [];
const PRODUCT_LINK_IMPORT_FIRST_ID = 1000000;
// Produkty dodane przez trwały importer plików są pobierane z osobnego,
// dzielonego katalogu serwerowego. Nie zapisujemy ich w localStorage ani w
// ogólnym rekordzie settings, aby duży katalog nie przekroczył limitu 4 MB.
let produktyImportowane = [];
let produktyCentralnePobrane = [];
let produktyBazoweCache={bazowe:null,importowane:null,centralne:null,items:[]};
function produktyBazoweWspolne(){
  if(produktyBazoweCache.bazowe===prodBazowe&&produktyBazoweCache.importowane===produktyImportowane&&produktyBazoweCache.centralne===produktyCentralnePobrane)return produktyBazoweCache.items;
  const mapa=new Map();
  [...(Array.isArray(prodBazowe)?prodBazowe:[]),...(Array.isArray(produktyImportowane)?produktyImportowane:[])].forEach(p=>{if(p&&p.id!==undefined)mapa.set(String(p.id),p);});
  (Array.isArray(produktyCentralnePobrane)?produktyCentralnePobrane:[]).forEach(p=>{if(p&&p.id!==undefined){const id=String(p.id),old=mapa.get(id)||{};mapa.set(id,{...old,...p,_catalog:{...(old._catalog||{}),...(p._catalog||{})}});}});
  const items=[...mapa.values()];produktyBazoweCache={bazowe:prodBazowe,importowane:produktyImportowane,centralne:produktyCentralnePobrane,items};return items;
}
function zapamietajProduktyCentralne(lista=[]){
  const mapa=new Map((produktyCentralnePobrane||[]).map(p=>[String(p.id),p]));
  (Array.isArray(lista)?lista:[]).forEach(p=>{if(p&&p.id!==undefined)mapa.set(String(p.id),p);});
  produktyCentralnePobrane=[...mapa.values()].slice(-5000);produktyBazoweCache={bazowe:null,importowane:null,centralne:null,items:[]};if(typeof uniewaznijProduktyAdminCache==="function")uniewaznijProduktyAdminCache();
}
let zrodloProduktow = "oczekuje-na-postgresql";
// Wyłącznie nietrwały cache widoku. Pełne kartoteki nigdy nie startują już
// z localStorage — źródłem jest PostgreSQL, a products.json to generowany
// podczas wydania publiczny snapshot awaryjny.
let produktyDodane = [];
let produktyUkryte = [];
let produktyEdytowane = {};
let ustawienia = {...USTAWIENIA_PUBLICZNE, ...wczytajLS("artway_ustawienia", {})};
let koszyk = wczytajLS("artway_koszyk", []);
let stanyProduktow = wczytajLS("artway_stany", {});   // magazyn: id → liczba sztuk (brak wpisu = bez limitu)
let dostepnoscProduktow = wczytajLS("artway_dostepnosc", {}); // status sprzedażowy: niezależny od magazynu, widoczny klientowi
let ruchyMagazynowe = wczytajLS("artway_ruchy_magazynowe", []); // historia przyjęć, korekt i sprzedaży
let ustawieniaMagazynu = wczytajLS("artway_magazyn_ustawienia", {});
let magazynProdukty = wczytajLS("artway_magazyn_produkty", {}); // kartoteka magazynowa per produkt: lokalizacja, dostawca, progi i lead time
let magazynLokalizacje = wczytajLS("artway_magazyn_lokalizacje", []); // słownik lokalizacji: regały, strefy, półki, stanowiska
let szkiceFaktur = wczytajLS("artway_faktury_szkice", []); // przygotowane dokumenty pod przyszłą integrację inFakt
let agentAIHistoria = wczytajLS("artway_agent_ai_historia", []); // audyty i akcje agenta administratora
let agentAIPamiec = wczytajLS("artway_agent_ai_pamiec", []); // zapamiętane procedury, reguły i notatki operacyjne agenta
let agentAIZlecenia = wczytajLS("artway_agent_ai_zlecenia", []); // szkice zleceń utworzone przez agenta AI
let agentAIPlanCykl = wczytajLS("artway_agent_ai_plan_cykl", {}); // stan open/done/resolved każdego problemu planu operacyjnego
let producenciKartoteka = wczytajLS("artway_producenci", [
  {id:"producer-alexander",name:"Alexander",website:"https://www.sklep.alexander.com.pl",orderEmail:"",contactPerson:"",phone:"",address:"",nip:"",leadTimeDays:3,minimumOrder:"",paymentTerms:"",emailSubject:"Zamówienie {numer} — Artway-TM",emailIntro:"Dzień dobry,\nprzesyłamy zatwierdzone zamówienie {numer}. Prosimy o potwierdzenie dostępności i terminu realizacji.",notes:"",active:true},
  {id:"producer-multigra",name:"Multigra",website:"",orderEmail:"",contactPerson:"",phone:"",address:"",nip:"",leadTimeDays:3,minimumOrder:"",paymentTerms:"",emailSubject:"Zamówienie {numer} — Artway-TM",emailIntro:"Dzień dobry,\nprzesyłamy zatwierdzone zamówienie {numer}. Prosimy o potwierdzenie dostępności i terminu realizacji.",notes:"",active:true},
  {id:"producer-godan",name:"GoDan",website:"",orderEmail:"",contactPerson:"",phone:"",address:"",nip:"",leadTimeDays:3,minimumOrder:"",paymentTerms:"",emailSubject:"Zamówienie {numer} — Artway-TM",emailIntro:"Dzień dobry,\nprzesyłamy zatwierdzone zamówienie {numer}. Prosimy o potwierdzenie dostępności i terminu realizacji.",notes:"",active:true}
]);
let agentAILinkiProducentow = wczytajLS("artway_agent_ai_linki_producentow", []); // kolejka URL-i produktów producentów do pobrania/sprawdzenia przez agenta
let agentAIImportUrlStan={busy:false,data:null,selected:0,error:""};
// Stan przygotowania Allegro pochodzi wyłącznie z serwerowej kolejki
// PostgreSQL. Stara kopia przeglądarkowa powodowała powrót wykonanych zadań.
let agentAIAllegroZadania = [];
try{localStorage.removeItem("artway_agent_ai_allegro_zadania");}catch(e){}
let koszDodanych = []; // nietrwały cache widoku centralnego kosza
let koszMeta = {};     // metadane widoku; retencję wykonuje PostgreSQL
let produktyDefinitywne = []; // nietrwały cache widoku
let opinie = wczytajLS("artway_opinie", []);          // opinie klientów (moderowane w panelu)
const SEO_USTAWIENIA_DOMYSLNE={enabled:true,dailyLimit:50,autoFillMissing:true,autoAllProducts:true,preferBestsellers:true,indexNowEnabled:true,searchConsoleReady:false,merchantCenterReady:false,businessProfileReady:false,lastRunAt:"",lastRunCount:0,lastScheduledDay:"",lastChannels:null,lastPromotionAt:"",lastPromotionStatus:"",lastPromotionCount:0,lastPromotionHttpStatus:null,indexNowFullCatalogAt:"",indexNowFullCatalogCount:0};
let seoUstawienia={...SEO_USTAWIENIA_DOMYSLNE,...wczytajLS("artway_seo_ustawienia",{})};
let seoHistoria=wczytajLS("artway_seo_historia",[]);
let seoZaznaczoneProdukty=new Set(),seoSzukaj="",seoFiltrOceny="wszystkie",seoFiltrKontroli="wszystkie",seoFiltrPromocji="wszystkie",seoFiltrBrakow="wszystkie",seoFiltrKategorii="wszystkie",seoFiltrProducenta="wszyscy",seoSortowanie="priorytet",seoStrona=1,seoSzukajTimer=null;
let seoNaStronie=[25,50,100,250,500].includes(Number(wczytajLS("artway_seo_na_stronie",50)))?Number(wczytajLS("artway_seo_na_stronie",50)):50;
let ulubione = wczytajLS("artway_ulubione", []);
let rabat = wczytajLS("artway_rabat", null);
let sesja = wczytajLS("artway_sesja", null);
if(sesja && !sesja.token && !sesja.verified && !["localhost","127.0.0.1"].includes(location.hostname) && location.protocol!=="file:"){
  sesja=null;
  try{localStorage.removeItem("artway_sesja");}catch(e){}
}
let zamowieniaUsuniete = wczytajLS("artway_zamowienia_usuniete", []); // tombstone: skasowane zlecenia nie wracają po synchronizacji
let stanBazyCentralnej={sprawdzono:false,online:false,synchronizacja:false,orders:0,users:0,updatedAt:null,error:""};
let aktywnaKategoria = "Wszystkie";
let fraza = "";
let sortowanie = "default";
let cenaOd="", cenaDo="", filtrDostepnosci="wszystkie", filtrOferty="wszystkie", filtrOceny="0";
let stronaProduktow=1, produktyNaStronie=[12,24,48,96].includes(Number(wczytajLS("artway_produkty_na_stronie",24)))?Number(wczytajLS("artway_produkty_na_stronie",24)):24;
let stronaListyProduktow=1, produktyNaLiscie=[12,24,48,96].includes(Number(wczytajLS("artway_produkty_na_liscie",24)))?Number(wczytajLS("artway_produkty_na_liscie",24)):24;
let frazaListyProduktow="", sortowanieListyProduktow="default";
let allegroZamowienia = [];
let allegroOferty = [];
// Duże rejestry Allegro są cache'em bieżącej sesji, nie localStorage. Przy
// dziesiątkach tysięcy ofert parsowanie wielomegabajtowego JSON-u blokowało
// start i przełączanie kart panelu.
let allegroMapowania = {};
try{["artway_allegro_zamowienia_cache","artway_allegro_oferty_cache","artway_allegro_mapowania_cache","artway_allegro_komunikacja_cache"].forEach(k=>localStorage.removeItem(k));}catch(e){}
let allegroKomunikacja = {threads:[],issues:[],settings:null,autoReplies:{},errors:[],requiresReauth:false,updated_at:null,lastSyncSummary:null,sprawdzono:false};
// Filtry zamówień należą do wspólnego stanu panelu, ponieważ odwołują się do
// nich moduł zamówień, pulpit i karta klienta. Muszą istnieć przed
// doładowaniem któregokolwiek z tych pakietów.
let szukajZamowien = "", filtrZamowien = "wszystkie";
let zaznaczoneZamowieniaSklepu = new Set();
let zaznaczoneAllegroZamowienia = new Set();
let zaznaczoneAllegroOferty = new Set();
let zaznaczoneAllegroProduktyKatalogu = new Set();
let zaznaczoneMapowaniaAllegro = new Set();
let zaznaczoneAllegroWiadomosci = new Set();
let zaznaczoneAllegroDyskusje = new Set();
let zaznaczoneAllegroZgodnosc = new Set();
let allegroOstatniBladWystawienia = null;
let allegroOstatniWynikWystawienia = null;
let allegroStan = {sprawdzono:false, configured:false, connected:false, env:"production", error:"", updated_at:null, autonomousAgent:{enabled:true,status:"waiting",completedAt:null,nextRunAt:null,mapping:{},stats:{},duplicateGroupsResolved:0,duplicateOffersEnded:0,reviewCount:0}, offerDefaultsAudit:{items:{},updated_at:null}, catalogMaintenance:{cursor:0,lastRun:null}, complianceAudit:{items:[],summary:{},updated_at:null}, offerSyncState:{lastLightSyncAt:null,lastFullSyncAt:null,nextLightSyncAt:null,nextFullSyncAt:null,lastSource:null,lastResult:null}, offerSettings:{defaultStock:5,republish:true,producers:["Alexander","Multigra","GoDan","Gabo"],autoCatalog:true,syncDescriptions:true,autoUpdateOffers:true,autoFees:true,autoCorrections:true,autoMapping:true,mappingMinScore:88,lightSyncMinutes:15,fullSyncHours:6,autonomousAgent:true,autoResolveDuplicates:true,autoResolveDuplicateMinScore:97,updated_at:null}};
let allegroDaneZaladowane={summary:false,orders:false,offers:false,config:false};
let allegroDaneLadowane=new Set();
let allegroDaneOdczytAt={summary:0,orders:0,offers:0,config:0};
let allegroDaneObietnice=new Map();
let allegroPodsumowanie={orders:{live:0,active:0,statusCounts:{},archived:0,retentionDays:30,updated_at:null},offers:{count:0,updated_at:null},recentOrders:[]};
let allegroArchiwum={loaded:false,busy:false,items:[],summary:{total:0,months:[],retentionDays:30,updated_at:null},month:"",offset:0,hasMore:false,error:""};
let allegroOperacjaUstawien = {busy:false,done:0,total:0,stockUpdated:0,stockFailed:0,republishUpdated:0,republishFailed:0,error:""};
let allegroMapowanieMasowe={busy:false,total:0,mapped:0,skipped:0,error:""};
let allegroWycofywanieOfert={busy:false,step:"idle",ids:[],reason:"admin_decision",error:"",results:[]};
let szukajAllegroZamowien="", szukajAllegroOfert="", szukajAllegroWystawiania="", szukajAllegroWiadomosci="", szukajAllegroDyskusji="", szukajAllegroRentownosc="", szukajAllegroZgodnosc="", filtrAllegroZamowien="do_obslugi", filtrEtapuAllegroZamowien="wszystkie", filtrAllegroOfert="wszystkie", filtrStatusuAllegroOfert="sprzedaz", filtrAllegroWystawiania="bez_oferty", filtrAllegroWiadomosci="wymaga", filtrAllegroDyskusji="aktywne", filtrAllegroRentownosc="niesprawdzone", filtrAllegroZgodnosc="naruszenia", sortAllegroOfert="priorytet", sortAllegroWiadomosci="najnowsze", sortAllegroDyskusje="najnowsze", sortAllegroRentownosc="marza_rosnaco", allegroZgodnoscBusy=false, allegroDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzyAllegro??wczytajLS("artway_cel_marzy_allegro",20))||20)), vonHalskyDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzyVonHalsky??ustawienia.celMarzyAllegro??wczytajLS("artway_cel_marzy_allegro",20))||20)), sklepDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzySklep??wczytajLS("artway_cel_marzy_sklep",20))||20)), allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Number(ustawienia.allegroJednostkiOplatCyklicznych)||10)), allegroLimitWidokuZamowien=100, allegroLimitWidokuOfert=100, allegroLimitWystawiania=50, allegroLimitKomunikacji=50;
let filtrAgentAIProdukty="wszystkie", zaznaczoneRentownosc=new Set();
let infaktStan={sprawdzono:false,ladowanie:false,invoicesLoaded:false,costsLoaded:false,costsLoading:false,purchaseLoading:false,configured:false,connected:false,env:"production",error:"",links:{},suppliers:{items:[]},purchaseSync:{pendingItems:[],recentMatches:[]},updated_at:null};
let infaktFaktury=[],infaktKoszty=[],szukajInfakt="",filtrInfakt="wszystkie",infaktLimit=50,infaktOkresCenZakupu=180;
let szukajInfaktZakupy="",filtrInfaktZakupy="wszystkie",limitInfaktZakupy=50,szukajInfaktHistoria="",filtrInfaktHistoria="aktywne",limitInfaktHistoria=50;
let zaznaczoneInfaktZakupy=new Set(),zaznaczoneInfaktHistoria=new Set(),zaznaczoneMagazynProdukty=new Set(),magazynWynikiIds=[],magazynStronaIds=[],zaznaczoneDostepnoscProducentow=new Set(),dostepnoscProducentowWynikiIds=[],dostepnoscProducentowStronaIds=[],zaznaczeniKlienci=new Set();
let agentAIPlanProfil=["full","data","health"].includes(wczytajLS("artway_agent_plan_profil","full"))?wczytajLS("artway_agent_plan_profil","full"):"full";
let agentAIPlanStan={busy:false,current:"",startedAt:null,completedAt:null,results:[],error:"",profile:agentAIPlanProfil,runId:"",history:[],historyLoading:false};
let agentAIRuntime={loading:false,loaded:false,error:"",runtime:null,updatedAt:0,pollTimer:null};
let agentAIOperations={loading:false,loaded:false,error:"",data:null,updatedAt:0,requestId:0};
let agentAIProductReport={loading:false,loaded:false,error:"",data:null,requestId:0};
let agentAIProductReportFilters={channel:"all",status:"all",listing:"all",query:"",page:1,limit:50};
let agentAISpecjalisci={loading:false,loaded:false,saving:false,running:false,error:"",data:null,activeRun:null};
let agentAISpecjalistaDecyzjeWToku=new Set();
