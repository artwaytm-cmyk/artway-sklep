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
   (np. otwarta z dysku), używa listy zapasowej poniżej. */
const PRODUKTY_ZAPASOWE = [
  {id:1, nazwa:"Słuchawki bezprzewodowe Pro ANC", kategoria:"Elektronika", cena:189.99, staraCena:249.99, opis:"Aktywna redukcja szumów, 40 h pracy, Bluetooth 5.3.", ikona:"🎧", badge:"Promocja", kolor:"#dbeafe"},
  {id:2, nazwa:"Smartwatch Fit X2", kategoria:"Elektronika", cena:229.00, opis:"Pomiar tętna, GPS, 100+ trybów sportowych, wodoodporny.", ikona:"⌚", badge:"Nowość", kolor:"#e0e7ff"},
  {id:3, nazwa:"Powerbank 20000 mAh 65W", kategoria:"Elektronika", cena:119.00, opis:"Szybkie ładowanie laptopa i telefonu, USB-C PD.", ikona:"🔋", kolor:"#dbeafe"},
  {id:4, nazwa:"Kamera IP Wi-Fi 2K", kategoria:"Elektronika", cena:99.00, staraCena:139.00, opis:"Obrót 360°, tryb nocny, wykrywanie ruchu, aplikacja PL.", ikona:"📷", badge:"Promocja", kolor:"#e0e7ff"},
  {id:5, nazwa:"Lampa LED biurkowa z ładowarką", kategoria:"Dom i ogród", cena:79.90, opis:"3 barwy światła, ładowanie indukcyjne telefonu, port USB.", ikona:"💡", kolor:"#fef3c7"},
  {id:6, nazwa:"Robot sprzątający SmartClean", kategoria:"Dom i ogród", cena:499.00, staraCena:649.00, opis:"Mapowanie laserowe, mopowanie, sterowanie aplikacją.", ikona:"🤖", badge:"Promocja", kolor:"#fef3c7"},
  {id:7, nazwa:"Zestaw doniczek samopodlewających", kategoria:"Dom i ogród", cena:59.00, opis:"3 szt., system knotowy, idealne na balkon i parapet.", ikona:"🪴", kolor:"#dcfce7"},
  {id:8, nazwa:"Girlanda solarna 10 m", kategoria:"Dom i ogród", cena:45.00, opis:"100 LED, czujnik zmierzchu, 8 trybów świecenia.", ikona:"✨", badge:"Nowość", kolor:"#dcfce7"},
  {id:9, nazwa:"Wkrętarka akumulatorowa 21V", kategoria:"Narzędzia", cena:179.00, staraCena:219.00, opis:"2 akumulatory, walizka, 45 akcesoriów w zestawie.", ikona:"🔧", badge:"Promocja", kolor:"#fee2e2"},
  {id:10, nazwa:"Zestaw kluczy nasadowych 108 el.", kategoria:"Narzędzia", cena:149.00, opis:"Stal CrV, grzechotki 72-zębowe, solidna walizka.", ikona:"🧰", kolor:"#fee2e2"},
  {id:11, nazwa:"Miernik laserowy 50 m", kategoria:"Narzędzia", cena:89.00, opis:"Pomiar odległości, powierzchni i objętości, ±2 mm.", ikona:"📏", kolor:"#ffedd5"},
  {id:12, nazwa:"Latarka czołowa LED 1200 lm", kategoria:"Narzędzia", cena:39.90, opis:"Ładowana USB, czujnik ruchu ręki, IPX5.", ikona:"🔦", kolor:"#ffedd5"},
  {id:13, nazwa:"Kurtka softshell outdoor", kategoria:"Odzież", cena:159.00, staraCena:199.00, opis:"Membrana 8000 mm, kaptur, rozmiary S–3XL.", ikona:"🧥", badge:"Promocja", kolor:"#f3e8ff"},
  {id:14, nazwa:"Buty trekkingowe TrailGrip", kategoria:"Odzież", cena:219.00, opis:"Podeszwa antypoślizgowa, wodoodporne, r. 36–47.", ikona:"🥾", kolor:"#f3e8ff"},
  {id:15, nazwa:"Plecak miejski 25 l z USB", kategoria:"Odzież", cena:99.00, opis:"Kieszeń na laptopa 15,6 cala, port USB, antykradzieżowy.", ikona:"🎒", badge:"Nowość", kolor:"#fce7f3"},
  {id:16, nazwa:"Mata do jogi premium 6 mm", kategoria:"Sport", cena:69.00, opis:"Antypoślizgowa TPE, pasek do przenoszenia.", ikona:"🧘", kolor:"#dcfce7"},
  {id:17, nazwa:"Hantle regulowane 2×10 kg", kategoria:"Sport", cena:249.00, staraCena:299.00, opis:"Szybka regulacja obciążenia, gumowane talerze.", ikona:"🏋️", badge:"Promocja", kolor:"#dcfce7"},
  {id:18, nazwa:"Rower — licznik GPS", kategoria:"Sport", cena:139.00, opis:"Nawigacja, czujnik kadencji, 30 h na baterii.", ikona:"🚴", kolor:"#dbeafe"}
];

/* ═══════════ STAN ═══════════ */
let produkty = [];
let prodBazowe = [];
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
const SEO_USTAWIENIA_DOMYSLNE={enabled:true,dailyLimit:5,autoFillMissing:true,autoAllProducts:true,preferBestsellers:true,searchConsoleReady:false,merchantCenterReady:false,businessProfileReady:false,lastRunAt:"",lastRunCount:0};
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
