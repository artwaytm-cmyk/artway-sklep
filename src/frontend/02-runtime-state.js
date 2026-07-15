/* ═══════════ REJESTR BŁĘDÓW (logi + sugestie) ═══════════
   Każdy błąd strony jest zapisywany w pamięci przeglądarki
   (localStorage → klucz artway_logi). Podgląd, pobieranie pliku
   logu i sugestie poprawek: podstrona  #/diagnostyka          */
const MAX_LOGOW = 200;
function pobierzLogi(){ try{ return JSON.parse(localStorage.getItem("artway_logi")||"[]"); }catch(e){ return []; } }
function loguj(poziom, tresc, zrodlo){
  try{
    const logi = pobierzLogi();
    logi.unshift({ czas:new Date().toLocaleString("pl-PL"), poziom, tresc:String(tresc).slice(0,500), zrodlo:zrodlo||"" });
    localStorage.setItem("artway_logi", JSON.stringify(logi.slice(0, MAX_LOGOW)));
    odswiezZnacznikDiag();
  }catch(e){/* pamięć pełna — nic więcej nie zrobimy */}
}
window.onerror = (msg, src, linia, kol) => { loguj("blad", msg, `${(src||"").split("/").pop()}:${linia}:${kol}`); };
window.onunhandledrejection = e => { loguj("blad", "Nieobsłużona obietnica: " + (e.reason?.message || e.reason)); };
const _konsolaBlad = console.error.bind(console);
console.error = (...a) => { loguj("blad", a.map(x=>x?.message||x).join(" "), "console"); _konsolaBlad(...a); };
function odswiezZnacznikDiag(){
  const el = document.getElementById("diagBadge"); if(!el) return;
  const n = pobierzLogi().filter(l=>l.poziom==="blad").length;
  el.textContent = n ? `(${n})` : "";
}

/* ═══════════ PRODUKTY ═══════════
   Strona najpierw próbuje wczytać products.json. Jeśli się nie uda
   (np. otwarta z dysku), nie pokazuje nieaktualnych produktów demonstracyjnych. */
const PRODUKTY_ZAPASOWE = []; // brak demonstracyjnych towarów — źródłem awaryjnym jest aktualny products.json

/* ═══════════ STAN ═══════════ */
let produkty = [];
let prodBazowe = [];
const PRODUCT_LINK_IMPORT_FIRST_ID = 1000000;
// Produkty dodane przez trwały importer plików są pobierane z osobnego,
// dzielonego katalogu serwerowego. Nie zapisujemy ich w localStorage ani w
// ogólnym rekordzie settings, aby duży katalog nie przekroczył limitu 4 MB.
let produktyImportowane = [];
function produktyBazoweWspolne(){
  const mapa=new Map();
  [...(Array.isArray(prodBazowe)?prodBazowe:[]),...(Array.isArray(produktyImportowane)?produktyImportowane:[])].forEach(p=>{if(p&&p.id!==undefined)mapa.set(String(p.id),p);});
  return [...mapa.values()];
}
let zrodloProduktow = "zapasowe";
let produktyDodane = wczytajLS("artway_produkty_dodane", []);
let produktyUkryte = wczytajLS("artway_produkty_ukryte", []);
let produktyEdytowane = wczytajLS("artway_produkty_edytowane", {});
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
let agentAIAllegroZadania = wczytajLS("artway_agent_ai_allegro_zadania", []); // braki i błędy wystawiania przekazane agentowi
let koszDodanych = wczytajLS("artway_kosz_dodane", []); // kosz: usunięte produkty własne (można przywrócić)
let koszMeta = wczytajLS("artway_kosz_meta", {});      // id → data usunięcia i typ; automatyczne czyszczenie po 30 dniach
let produktyDefinitywne = wczytajLS("artway_produkty_definitywne", []); // bazowe produkty usunięte po okresie kosza
let opinie = wczytajLS("artway_opinie", []);          // opinie klientów (moderowane w panelu)
const SEO_USTAWIENIA_DOMYSLNE={enabled:true,dailyLimit:5,autoFillMissing:true,autoAllProducts:true,preferBestsellers:true,indexNowEnabled:true,searchConsoleReady:false,merchantCenterReady:false,businessProfileReady:false,lastRunAt:"",lastRunCount:0,lastPromotionAt:"",lastPromotionStatus:"",lastPromotionCount:0,lastPromotionHttpStatus:null,indexNowFullCatalogAt:"",indexNowFullCatalogCount:0};
let seoUstawienia={...SEO_USTAWIENIA_DOMYSLNE,...wczytajLS("artway_seo_ustawienia",{})};
let seoHistoria=wczytajLS("artway_seo_historia",[]);
let seoZaznaczoneProdukty=new Set(),seoSzukaj="",seoFiltrOceny="wszystkie",seoFiltrKontroli="wszystkie",seoFiltrPromocji="wszystkie",seoFiltrBrakow="wszystkie",seoFiltrKategorii="wszystkie",seoFiltrProducenta="wszyscy",seoSortowanie="priorytet",seoStrona=1,seoSzukajTimer=null;
let seoNaStronie=[25,50,100,250,500].includes(Number(wczytajLS("artway_seo_na_stronie",50)))?Number(wczytajLS("artway_seo_na_stronie",50)):50;
let ulubione = wczytajLS("artway_ulubione", []);
let rabat = wczytajLS("artway_rabat", null);
let sesja = wczytajLS("artway_sesja", null);
if(sesja && !sesja.token && !["localhost","127.0.0.1"].includes(location.hostname) && location.protocol!=="file:"){
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
let allegroZamowienia = wczytajLS("artway_allegro_zamowienia_cache", []);
let allegroOferty = wczytajLS("artway_allegro_oferty_cache", []);
let allegroMapowania = wczytajLS("artway_allegro_mapowania_cache", {});
let allegroKomunikacja = wczytajLS("artway_allegro_komunikacja_cache", {threads:[],issues:[],settings:null,autoReplies:{},errors:[],requiresReauth:false,updated_at:null,lastSyncSummary:null,sprawdzono:false});
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
let allegroStan = {sprawdzono:false, configured:false, connected:false, env:"production", error:"", updated_at:null, offerDefaultsAudit:{items:{},updated_at:null}, catalogMaintenance:{cursor:0,lastRun:null}, complianceAudit:{items:[],summary:{},updated_at:null}, offerSettings:{defaultStock:5,republish:true,producers:["Alexander","Multigra","GoDan"],autoCatalog:true,syncDescriptions:true,autoUpdateOffers:true,autoFees:true,autoCorrections:true,updated_at:null}};
let allegroOperacjaUstawien = {busy:false,done:0,total:0,stockUpdated:0,stockFailed:0,republishUpdated:0,republishFailed:0,error:""};
let allegroMapowanieMasowe={busy:false,total:0,mapped:0,skipped:0,error:""};
let szukajAllegroZamowien="", szukajAllegroOfert="", szukajAllegroWystawiania="", szukajAllegroWiadomosci="", szukajAllegroDyskusji="", szukajAllegroRentownosc="", szukajAllegroZgodnosc="", filtrAllegroZamowien="do_obslugi", filtrEtapuAllegroZamowien="wszystkie", filtrAllegroOfert="problemy", filtrAllegroWystawiania="wszystkie", filtrAllegroWiadomosci="wymaga", filtrAllegroDyskusji="aktywne", filtrAllegroRentownosc="niesprawdzone", filtrAllegroZgodnosc="naruszenia", sortAllegroOfert="priorytet", sortAllegroWiadomosci="najnowsze", sortAllegroDyskusje="najnowsze", sortAllegroRentownosc="marza_rosnaco", allegroZgodnoscBusy=false, allegroDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzyAllegro??wczytajLS("artway_cel_marzy_allegro",20))||20)), sklepDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzySklep??wczytajLS("artway_cel_marzy_sklep",20))||20)), allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Number(ustawienia.allegroJednostkiOplatCyklicznych)||10)), allegroLimitWidokuZamowien=100, allegroLimitWidokuOfert=100, allegroLimitWystawiania=250, allegroLimitKomunikacji=50;
let filtrAgentAIProdukty="wszystkie", zaznaczoneRentownosc=new Set();
let infaktStan={sprawdzono:false,ladowanie:false,invoicesLoaded:false,costsLoaded:false,costsLoading:false,purchaseLoading:false,configured:false,connected:false,env:"production",error:"",links:{},suppliers:{items:[]},purchaseSync:{pendingItems:[],recentMatches:[]},updated_at:null};
let infaktFaktury=[],infaktKoszty=[],szukajInfakt="",filtrInfakt="wszystkie",infaktLimit=50,infaktOkresCenZakupu=180;
let szukajInfaktZakupy="",filtrInfaktZakupy="wszystkie",limitInfaktZakupy=50,szukajInfaktHistoria="",filtrInfaktHistoria="aktywne",limitInfaktHistoria=50;
let zaznaczoneInfaktZakupy=new Set(),zaznaczoneInfaktHistoria=new Set(),zaznaczoneMagazynProdukty=new Set(),magazynWynikiIds=[],magazynStronaIds=[],zaznaczeniKlienci=new Set();
let agentAIPlanProfil=["full","data","health"].includes(wczytajLS("artway_agent_plan_profil","full"))?wczytajLS("artway_agent_plan_profil","full"):"full";
let agentAIPlanStan={busy:false,current:"",startedAt:null,completedAt:null,results:[],error:"",profile:agentAIPlanProfil,runId:"",history:[],historyLoading:false};
let agentAITelegram={loading:false,loaded:false,saving:false,error:"",settings:null,status:null,stats:{},state:{},events:[],history:[],quietNow:false};
