/* ═══════════ KONFIGURACJA ═══════════ */
const DANE_FIRMY_DOMYSLNE = {
  nazwa: "Artway-TM",
  identyfikator: "5882468333",
  nip: "5882468333",
  pesel: "5882468333",
  adres: ""
};
const NUMER_PRZELEWU_TELEFON_DOMYSLNY = "530038914";
const DOMYSLNE_PLATNOSCI = [
  { id:"pobranie", nazwa:"Za pobraniem — płatność przy odbiorze", oplata:5 },
  { id:"paynow",   nazwa:"mBank Paynow — BLIK, karta lub szybki przelew", oplata:0, bramka:"paynow" },
  { id:"telefon",  nazwa:"Przelew na telefon 530 038 914", oplata:0, typ:"telefon" }
];
const LEGACY_PRZELEW_TEKST = "przelew " + "tradycyjny";
const KONFIG = {
  nazwaSklepu: "Artway-TM",
  pasekInfo: "🚚 Darmowa dostawa od 200 zł &nbsp;•&nbsp; 📦 Wysyłka w 24h &nbsp;•&nbsp; ↩️ 14 dni na zwrot &nbsp;•&nbsp; 🎁 Kod <b>START10</b> = −10%",
  czasWysylki: "24 h",
  telefon: "+48 530 038 914",
  daneFirmy: {...DANE_FIRMY_DOMYSLNE},
  opisSklepu: "Sklep wielobranżowy z asortymentem od sprawdzonych dostawców. Nowe technologie, uczciwe ceny.",
  heroTytul: "Wszystko, czego potrzebujesz — w jednym miejscu",
  heroOpis: "Elektronika, dom i ogród, narzędzia, odzież i sport. Nowości od sprawdzonych dostawców, atrakcyjne ceny i szybka wysyłka.",
  tresci: null,   // własne treści stron (regulamin itd.) — ustawiane w panelu admina
  emailSklepu: "artwaytm@gmail.com",
  // Konto zarejestrowane na ten adres = administrator (widzi diagnostykę):
  emailAdmina: "artwaytm@gmail.com",
  // Płatność online przez mBank Paynow — po aktywacji bramki można wkleić link/panel płatności:
  linkPlatnosci: "",
  numerPrzelewuTelefon: NUMER_PRZELEWU_TELEFON_DOMYSLNY,
  darmowaDostawaOd: 200,
  kodyRabatowe: { "START10": 10, "LATO15": 15 },  // kod → % rabatu
  dostawy: [
    { id:"paczkomat", nazwa:"Paczkomat InPost 24/7", koszt:12, opis:"odbiór w wybranym paczkomacie / punkcie InPost" },
    { id:"kurier_inpost", nazwa:"Kurier InPost", koszt:20, opis:"dostawa kurierem InPost pod wskazany adres" }
  ],
  kurierInpostAktywny: true,    // Klient widzi tylko dwie metody: Paczkomat InPost i Kurier InPost
  platnosci: DOMYSLNE_PLATNOSCI.map(p=>({...p}))
};
const DOMYSLNA_DOSTAWA_INPOST = { id:"paczkomat", nazwa:"Paczkomat InPost 24/7", koszt:12, opis:"odbiór w wybranym paczkomacie / punkcie InPost" };
const DOMYSLNA_DOSTAWA_INPOST_KURIER = { id:"kurier_inpost", nazwa:"Kurier InPost", koszt:20, opis:"dostawa kurierem InPost pod wskazany adres" };
const OPLATA_PACZKA_WEEKEND = 5;
function normalizujDostawyInPost(lista){
  const zrodlo = Array.isArray(lista) ? lista : [];
  const cena = (v, fallback) => { const n=Number(String(v ?? "").replace(",",".")); return Number.isFinite(n) ? +n.toFixed(2) : fallback; };
  const paczkomat = zrodlo.find(d=>d&&d.id==="paczkomat") || zrodlo.find(d=>String(d?.nazwa||"").toLowerCase().includes("paczkomat")) || {};
  const kurier = zrodlo.find(d=>d&&["kurier_inpost","kurier"].includes(d.id)) || zrodlo.find(d=>String(d?.nazwa||"").toLowerCase().includes("kurier")) || {};
  return [
    { ...DOMYSLNA_DOSTAWA_INPOST, koszt:cena(paczkomat.koszt, DOMYSLNA_DOSTAWA_INPOST.koszt), opis:String(paczkomat.opis||DOMYSLNA_DOSTAWA_INPOST.opis).trim()||DOMYSLNA_DOSTAWA_INPOST.opis },
    { ...DOMYSLNA_DOSTAWA_INPOST_KURIER, koszt:20, opis:String(kurier.opis||DOMYSLNA_DOSTAWA_INPOST_KURIER.opis).trim()||DOMYSLNA_DOSTAWA_INPOST_KURIER.opis }
  ];
}
function dostepneDostawy(){
  KONFIG.dostawy = normalizujDostawyInPost(KONFIG.dostawy);
  return KONFIG.dostawy;
}
function czyDostawaPaczkomat(id){ return String(id||"")==="paczkomat"; }
function uslugaInpostDlaDostawy(id){ return czyDostawaPaczkomat(id) ? "Paczkomat 24/7" : "Kurier InPost"; }
function oplataPaczkaWeekend(wlaczona){ return wlaczona ? OPLATA_PACZKA_WEEKEND : 0; }

const DOMYSLNE_BANNERY = [
  {id:"promocje",ikona:"🔥",tytul:"Aktualne promocje",opis:"Zobacz produkty w obniżonych cenach.",przycisk:"Sprawdź promocje",link:"#/promocje",aktywny:true},
  {id:"nowosci",ikona:"✨",tytul:"Nowości w sklepie",opis:"Poznaj ostatnio dodane produkty.",przycisk:"Zobacz nowości",link:"#/nowosci",aktywny:true},
  {id:"dostawa",ikona:"🚚",tytul:"Darmowa dostawa",opis:"Dla zamówień od 200 zł.",przycisk:"Warunki dostawy",link:"#/dostawa",aktywny:true}
];
const DOMYSLNE_PODSTRONY = {
  kontakt:{nazwa:"Kontakt",tytul:"💬 Napisz do nas",opis:"Masz pytanie o produkt, dostawę lub zamówienie? Opisz sprawę możliwie dokładnie.",szerokosc:"standard",styl:"panel",widoczna:true},
  onas:{nazwa:"O Artway-TM",tytul:"O Artway-TM",opis:"Poznaj sklep, nasze podejście i najważniejsze zasady obsługi.",szerokosc:"standard",styl:"panel",widoczna:true},
  faq:{nazwa:"Najczęstsze pytania",tytul:"Najczęstsze pytania",opis:"Odpowiedzi dotyczące zakupów, dostawy, płatności, zwrotów i konta klienta.",szerokosc:"standard",styl:"panel",widoczna:true},
  dostawa:{nazwa:"Dostawa i płatności",tytul:"🚚 Dostawa i płatności",opis:"Aktualne sposoby dostawy, płatności i koszty.",szerokosc:"standard",styl:"panel",widoczna:true},
  zwroty:{nazwa:"Zwroty i reklamacje",tytul:"↩️ Zwroty i reklamacje",opis:"Zasady odstąpienia od umowy i składania reklamacji.",szerokosc:"standard",styl:"panel",widoczna:true},
  regulamin:{nazwa:"Regulamin",tytul:"📜 Regulamin sklepu",opis:"Zasady korzystania ze sklepu i składania zamówień.",szerokosc:"standard",styl:"panel",widoczna:true},
  prywatnosc:{nazwa:"Polityka prywatności",tytul:"🔒 Polityka prywatności (RODO)",opis:"Informacje o przetwarzaniu danych i prywatności.",szerokosc:"standard",styl:"panel",widoczna:true},
  logowanie:{nazwa:"Logowanie",tytul:"👤 Logowanie",opis:"Zaloguj się do swojego konta klienta.",szerokosc:"compact",styl:"panel",widoczna:true},
  rejestracja:{nazwa:"Rejestracja",tytul:"✨ Rejestracja",opis:"Załóż konto, aby korzystać z historii zakupów i ulubionych.",szerokosc:"compact",styl:"panel",widoczna:true},
  konto:{nazwa:"Moje konto",tytul:"👤 Moje konto",opis:"Twoje dane, historia aktywności i ustawienia konta.",szerokosc:"standard",styl:"panel",widoczna:true},
  zamowienia:{nazwa:"Moje zamówienia",tytul:"📦 Moje zamówienia",opis:"Historia i bieżące informacje o Twoich zamówieniach.",szerokosc:"standard",styl:"panel",widoczna:true},
  ulubione:{nazwa:"Ulubione",tytul:"❤️ Ulubione produkty",opis:"Produkty zapisane do późniejszego sprawdzenia.",szerokosc:"wide",styl:"panel",widoczna:true}
};
const SEKCJE_PODSTRONY = {
  naglowek:{nazwa:"Nagłówek strony",ikona:"🏷️"},
  opis:{nazwa:"Opis pod nagłówkiem",ikona:"📝"},
  tresc:{nazwa:"Główna treść",ikona:"📄"},
  powrot:{nazwa:"Link powrotu do sklepu",ikona:"↩️"}
};
const DOMYSLNA_KOLEJNOSC_PODSTRONY = ["naglowek","opis","tresc","powrot"];
function pobierzBannery(){ return Array.isArray(ustawienia.bannery) ? ustawienia.bannery : DOMYSLNE_BANNERY.map(x=>({...x})); }
function ustawieniaPodstrony(id){ return {...(DOMYSLNE_PODSTRONY[id]||{}),...((ustawienia.podstrony||{})[id]||{})}; }
function klasaPodstrony(id){
  const u=ustawieniaPodstrony(id);
  return `page page-${u.szerokosc||"standard"} ${u.styl==="plain"?"page-plain":""}`;
}
function kolejnoscSekcjiPodstrony(id){
  const u=ustawieniaPodstrony(id);
  const zap=Array.isArray(u.sekcjeOrder)?u.sekcjeOrder.filter(x=>SEKCJE_PODSTRONY[x]):[];
  return [...zap,...DOMYSLNA_KOLEJNOSC_PODSTRONY.filter(x=>!zap.includes(x))];
}
function sekcjaPodstronyWidoczna(id,sekcja){
  const u=ustawieniaPodstrony(id);
  return !(Array.isArray(u.sekcjeUkryte)&&u.sekcjeUkryte.includes(sekcja));
}
function czasWysylki(){
  return String(ustawienia.czasWysylki||KONFIG.czasWysylki||"24 h").trim()||"24 h";
}
function wykryjCzasWysylkiZTekstu(tekst){
  const m=String(tekst||"").match(/wysyłka\s+w\s*(\d+\s*(?:h|godziny|godzin|godz\.?))/i)||String(tekst||"").match(/wysylka\s+w\s*(\d+\s*(?:h|godziny|godzin|godz\.?))/i);
  return m?m[1].replace(/\s+/g," ").trim():"";
}
function tekstWysylki(prefix="Wysyłka w"){
  return `${prefix} ${czasWysylki()}`;
}
function pasekInfoHTML(){
  const domyslny=`🚚 Darmowa dostawa od ${KONFIG.darmowaDostawaOd} zł &nbsp;•&nbsp; 📦 ${tekstWysylki()} &nbsp;•&nbsp; ↩️ 14 dni na zwrot &nbsp;•&nbsp; 🎁 Kod <b>START10</b> = −10%`;
  let t=String(KONFIG.pasekInfo||domyslny);
  t=t.replace(/Darmowa dostawa od\s*\d+(?:[,.]\d+)?\s*zł/gi,`Darmowa dostawa od ${KONFIG.darmowaDostawaOd} zł`);
  t=t.replace(/Wysyłka w\s*\d+\s*(?:h|godziny|godzin|godz\.?)(?:\s*robocze)?/gi,tekstWysylki());
  t=t.replace(/Wysylka w\s*\d+\s*(?:h|godziny|godzin|godz\.?)(?:\s*robocze)?/gi,tekstWysylki("Wysylka w"));
  return t;
}
function domyslnyFavicon(){
  const litera=encodeURIComponent((KONFIG.nazwaSklepu||"A").trim()[0]||"A");
  return `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="14" fill="%232563eb"/%3E%3Ctext x="32" y="42" text-anchor="middle" font-size="30" font-family="Arial" font-weight="700" fill="white"%3E${litera}%3C/text%3E%3C/svg%3E`;
}
function aktualizujFavicon(){
  const l=document.getElementById("faviconLink"); if(!l) return;
  const url=ustawienia.faviconObraz||domyslnyFavicon();
  l.setAttribute("href",url);
  l.setAttribute("type",String(url).startsWith("data:image/svg")?"image/svg+xml":"image/png");
}

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
let koszDodanych = wczytajLS("artway_kosz_dodane", []); // kosz: usunięte produkty własne (można przywrócić)
let koszMeta = wczytajLS("artway_kosz_meta", {});      // id → data usunięcia i typ; automatyczne czyszczenie po 30 dniach
let produktyDefinitywne = wczytajLS("artway_produkty_definitywne", []); // bazowe produkty usunięte po okresie kosza
let opinie = wczytajLS("artway_opinie", []);          // opinie klientów (moderowane w panelu)
let ulubione = wczytajLS("artway_ulubione", []);
let rabat = wczytajLS("artway_rabat", null);
let sesja = wczytajLS("artway_sesja", null);
let zamowieniaUsuniete = wczytajLS("artway_zamowienia_usuniete", []); // tombstone: skasowane zlecenia nie wracają po synchronizacji
let stanBazyCentralnej={sprawdzono:false,online:false,synchronizacja:false,orders:0,users:0,updatedAt:null,error:""};
let aktywnaKategoria = "Wszystkie";
let fraza = "";
let sortowanie = "default";
let cenaOd="", cenaDo="", filtrDostepnosci="wszystkie", filtrOferty="wszystkie", filtrOceny="0";
let stronaProduktow=1, produktyNaStronie=[12,24,48,96].includes(Number(wczytajLS("artway_produkty_na_stronie",24)))?Number(wczytajLS("artway_produkty_na_stronie",24)):24;
let stronaListyProduktow=1, produktyNaLiscie=[12,24,48,96].includes(Number(wczytajLS("artway_produkty_na_liscie",24)))?Number(wczytajLS("artway_produkty_na_liscie",24)):24;
let frazaListyProduktow="", sortowanieListyProduktow="default";

/* ═══════════ WSPÓLNA BAZA SERWEROWA (Netlify Functions + Blobs) ═══════════
   Ustawienia sklepu, zamówienia i klienci są zapisywane na serwerze, więc są
   widoczne na KAŻDYM urządzeniu. Bez połączenia z serwerem sklep dalej działa
   na pamięci przeglądarki (localStorage) jak dotychczas. */
const CHMURA_URL = "/.netlify/functions/store";
const CHMURA_AUTO_SYNC_MS = 60000;
const KLUCZE_WSPOLNE = ["artway_ustawienia","artway_produkty_dodane","artway_produkty_edytowane","artway_produkty_ukryte","artway_produkty_definitywne","artway_stany","artway_opinie","artway_kosz_dodane","artway_kosz_meta"];
let chmuraToken = (function(){ try{ return JSON.parse(localStorage.getItem("artway_chmura_token"))||""; }catch(e){ return ""; } })();
let chmuraStan = {dostepna:false, sprawdzono:false, admin:false, rev:0, updated_at:null, error:"", ostatniZapis:0};
let chmuraWczytywanie = false;   // blokada pętli podczas nakładania danych z serwera
let chmuraTimerZapisu = null;
let chmuraTimerAutoSync = null;
let chmuraAutoSyncBusy = false;

function chmuraNaglowki(json){ const h={"Accept":"application/json"}; if(json) h["Content-Type"]="application/json"; if(chmuraToken) h["x-admin-token"]=chmuraToken; return h; }
async function chmura(action, {method="GET", body=null, params={}, timeout=9000}={}){
  const url = new URL(CHMURA_URL, location.href);
  url.searchParams.set("action", action);
  for(const [k,v] of Object.entries(params)) if(v!==undefined&&v!==null&&v!=="") url.searchParams.set(k,String(v));
  const opt = {method, headers: chmuraNaglowki(body!==null)};
  if(body!==null) opt.body = JSON.stringify(body);
  const ac = (typeof AbortController!=="undefined") ? new AbortController() : null;
  let timer=null;
  if(ac){ opt.signal=ac.signal; timer=setTimeout(()=>ac.abort(),timeout); }
  let r;
  try{ r = await fetch(url.toString(), opt); }
  catch(e){ if(timer)clearTimeout(timer); throw new Error(e&&e.name==="AbortError"?"Serwer nie odpowiedział w wyznaczonym czasie":"Brak połączenia z serwerem"); }
  if(timer)clearTimeout(timer);
  const t = await r.text(); let d;
  try{ d = JSON.parse(t); }catch(e){ throw new Error("Serwer nie zwrócił danych — czy backend Netlify jest opublikowany?"); }
  if(!r.ok || d.ok===false){ const b=new Error(d.error||("Błąd bazy HTTP "+r.status)); Object.assign(b,d); b.code=d.code||""; b.status=r.status; throw b; }
  return d;
}
function nrZamowienia(v){ return String(v??"").trim().slice(0,80); }
function normalizujUsunieteZamowienie(raw){
  const nr = nrZamowienia(raw?.nr || raw?.number || raw);
  if(!nr) return null;
  return {
    nr,
    email:String(raw?.email||"").trim().toLowerCase().slice(0,200),
    by:String(raw?.by||raw?.kto||"local").slice(0,40),
    deleted_at:String(raw?.deleted_at||raw?.usunietoAt||new Date().toISOString()).slice(0,80)
  };
}
function zapiszUsunieteZamowienia(lista){
  const mapa=new Map();
  (Array.isArray(lista)?lista:[]).forEach(raw=>{const r=normalizujUsunieteZamowienie(raw); if(r) mapa.set(r.nr,{...mapa.get(r.nr),...r});});
  zamowieniaUsuniete=[...mapa.values()].sort((a,b)=>String(b.deleted_at||"").localeCompare(String(a.deleted_at||""))).slice(0,50000);
  try{localStorage.setItem("artway_zamowienia_usuniete",JSON.stringify(zamowieniaUsuniete));}catch(e){}
  return zamowieniaUsuniete;
}
function scalUsunieteZamowienia(lista){
  return zapiszUsunieteZamowienia([...(zamowieniaUsuniete||[]),...(Array.isArray(lista)?lista:[])]);
}
function czyZamowienieUsuniete(nr){
  const n=nrZamowienia(nr);
  return !!n && (zamowieniaUsuniete||[]).some(x=>x&&x.nr===n);
}
function oznaczZamowienieUsuniete(nr, meta={}){
  const rec=normalizujUsunieteZamowienie({nr,...meta,deleted_at:meta.deleted_at||new Date().toISOString()});
  if(!rec) return false;
  scalUsunieteZamowienia([rec]);
  return true;
}
function filtrujAktywneZamowienia(lista){
  if(!Array.isArray(lista)) return [];
  const usuniete=new Set((zamowieniaUsuniete||[]).map(x=>x&&x.nr).filter(Boolean));
  const widziane=new Set();
  return lista.filter(z=>{
    const nr=nrZamowienia(z?.nr);
    if(!nr || usuniete.has(nr) || widziane.has(nr)) return false;
    widziane.add(nr);
    return true;
  });
}
function zbierzWspolneUstawienia(){
  return {
    artway_ustawienia: ustawienia,
    artway_produkty_dodane: produktyDodane,
    artway_produkty_edytowane: produktyEdytowane,
    artway_produkty_ukryte: produktyUkryte,
    artway_produkty_definitywne: produktyDefinitywne,
    artway_stany: stanyProduktow,
    artway_opinie: opinie,
    artway_kosz_dodane: koszDodanych,
    artway_kosz_meta: koszMeta,
  };
}
function nalozWspolneUstawienia(dane){
  if(!dane || typeof dane!=="object") return false;
  chmuraWczytywanie = true;
  try{
    if(dane.artway_ustawienia && typeof dane.artway_ustawienia==="object"){
      ustawienia = {...USTAWIENIA_PUBLICZNE, ...dane.artway_ustawienia};
      zapiszLS("artway_ustawienia", ustawienia);
    }
    const setter = {
      artway_produkty_dodane:(v)=>{produktyDodane=v;}, artway_produkty_ukryte:(v)=>{produktyUkryte=v;},
      artway_produkty_edytowane:(v)=>{produktyEdytowane=v;}, artway_produkty_definitywne:(v)=>{produktyDefinitywne=v;},
      artway_stany:(v)=>{stanyProduktow=v;}, artway_opinie:(v)=>{opinie=v;},
      artway_kosz_dodane:(v)=>{koszDodanych=v;}, artway_kosz_meta:(v)=>{koszMeta=v;},
    };
    for(const k of Object.keys(setter)){
      if(k in dane && dane[k]!==undefined && dane[k]!==null){ setter[k](dane[k]); zapiszLS(k, dane[k]); }
    }
    return true;
  } finally { chmuraWczytywanie = false; }
}
async function chmuraWczytajStan(){
  try{
    const d = await chmura("pull");
    chmuraStan = {...chmuraStan, dostepna:true, sprawdzono:true, rev:d.rev||0, updated_at:d.updated_at||null, error:""};
    const revLok = Number(wczytajLS("artway_chmura_rev", 0))||0;
    const serwerNowszy = (d.rev||0) > revLok;
    // Klient (bez tokenu): serwer jest źródłem prawdy → zawsze nakładaj.
    // Admin (z tokenem): nakładaj TYLKO gdy serwer ma nowszą wersję niż ostatnio zsynchronizowana —
    // dzięki temu wczytanie strony NIE kasuje świeżych, jeszcze niewysłanych zmian admina.
    if(d.settings && Object.keys(d.settings).length && (!chmuraToken || serwerNowszy)){
      nalozWspolneUstawienia(d.settings);
      zapiszLS("artway_chmura_rev", d.rev||0);
    }
    if(Array.isArray(d.deleted_orders)) scalUsunieteZamowienia(d.deleted_orders);
    if(Array.isArray(d.orders)){ zapiszLS("artway_zamowienia", filtrujAktywneZamowienia(d.orders)); chmuraStan.admin=true; }
    if(Array.isArray(d.users)){ zapiszLS("artway_uzytkownicy", polaczUzytkownikowCentralnych(d.users)); chmuraStan.admin=true; }
    return true;
  }catch(e){ chmuraStan = {...chmuraStan, dostepna:false, sprawdzono:true, error:e.message}; return false; }
}
function zaplanujZapisUstawien(){
  if(!chmuraToken) return;
  clearTimeout(chmuraTimerZapisu);
  chmuraTimerZapisu = setTimeout(chmuraZapiszUstawienia, 1200);
}
async function chmuraZapiszUstawienia(){
  if(!chmuraToken) return false;
  try{
    const d = await chmura("settings", {method:"POST", body:{settings: zbierzWspolneUstawienia()}});
    chmuraStan = {...chmuraStan, dostepna:true, admin:true, rev:d.rev||chmuraStan.rev, updated_at:d.updated_at||null, error:"", ostatniZapis:Date.now()};
    zapiszLS("artway_chmura_rev", d.rev||chmuraStan.rev);   // zapamiętaj, że to my mamy najnowszą wersję
    return true;
  }catch(e){
    chmuraStan = {...chmuraStan, error:e.message};
    if(e.code==="auth") toast("⚠️ Hasło bazy nieprawidłowe — ustawienia nie zapisały się w chmurze");
    loguj("blad","Zapis ustawień w chmurze: "+e.message);
    return false;
  }
}
// Ręczne WYSŁANIE całego sklepu z tego urządzenia na serwer (dla wszystkich).
async function chmuraWyslijWszystko(){
  if(!chmuraToken){ chmuraUstawToken(); return; }
  toast("Wysyłanie na serwer…");
  const okU = await chmuraZapiszUstawienia();
  await synchronizujBazeCentralna(true).catch(()=>{});
  if(okU) toast("📤 Cały sklep wysłany na serwer — widoczny na każdym urządzeniu ✅");
  else toast("⚠️ Nie udało się wysłać — sprawdź hasło bazy");
  renderuj();
}
// Ręczne POBRANIE sklepu z serwera i nałożenie na to urządzenie.
async function chmuraPobierzWszystko(){
  try{
    const d = await chmura("pull");
    if(d.settings && Object.keys(d.settings).length){ nalozWspolneUstawienia(d.settings); zapiszLS("artway_chmura_rev", d.rev||0); }
    chmuraStan = {...chmuraStan, dostepna:true, rev:d.rev||0, updated_at:d.updated_at||null, error:""};
    if(chmuraToken) await synchronizujBazeCentralna(true).catch(()=>{});
    zastosujUstawienia(); zbudujProdukty(); odswiezMenu(); odswiezKoszyk();
    toast("📥 Pobrano sklep z serwera ✅"); renderuj();
  }catch(e){ toast("Błąd pobierania: "+e.message); }
}
function chmuraUstawToken(){
  const t = prompt("Wklej hasło administratora wspólnej bazy (wartość ARTWAY_ADMIN_TOKEN ustawiona w Netlify):", chmuraToken||"");
  if(t===null) return;
  chmuraToken = t.trim();
  zapiszLS("artway_chmura_token", chmuraToken);
  if(!chmuraToken){ toast("Odłączono hasło bazy"); renderuj(); return; }
  (async ()=>{
    try{
      await chmura("login",{method:"POST",body:{password:chmuraToken}});
      chmuraStan={...chmuraStan,dostepna:true,admin:true};
      await synchronizujBazeCentralna(true);
      toast("Połączono ze wspólną bazą ✅ — kliknij 📤 Wyślij wszystko na serwer, aby przenieść obecny wygląd na inne urządzenia.");
    }catch(e){ toast("Błąd połączenia z bazą: "+e.message); }
    renderuj();
  })();
}
function chmuraWyczyscToken(){ chmuraToken=""; zapiszLS("artway_chmura_token",""); chmuraStan={...chmuraStan,admin:false}; toast("Odłączono hasło bazy"); renderuj(); }
function chmuraStatusHTML(){
  const ok = chmuraStan.dostepna, adm = chmuraStan.admin && chmuraToken;
  const kolor = adm?"#166534":(ok?"#92400e":"#b91c1c"), tlo = adm?"#f0fdf4":(ok?"#fffbeb":"#fef2f2"), br = adm?"#86efac":(ok?"#fcd34d":"#fecaca");
  const opis = adm ? `<b>Połączono ✅</b> — Twoje zmiany zapisują się na serwerze automatycznie i są widoczne na każdym urządzeniu.${chmuraStan.updated_at?` Ostatni zapis: ${new Date(chmuraStan.updated_at).toLocaleString("pl-PL")}.`:""} Synchronizacja odświeża dane co ${Math.round(CHMURA_AUTO_SYNC_MS/1000)} s.`
    : ok ? `<b>⚠️ NIE połączono z bazą</b> — Twoje zmiany zapisują się TYLKO na tym urządzeniu i NIE są widoczne gdzie indziej. Zaloguj się jako <b>admin</b> hasłem = token bazy, albo kliknij „Wpisz hasło bazy".`
    : "Brak połączenia z serwerem — sklep działa lokalnie w tej przeglądarce.";
  return `<div class="backend-note" style="border-color:${br};background:${tlo};color:${kolor}">
    <b>☁️ Wspólna baza:</b> ${opis}
    <div class="diag-actions" style="margin-top:.5rem">
    ${adm?`<button class="btn" style="background:var(--brand2)" onclick="chmuraWyslijWszystko()">📤 Wyślij wszystko na serwer</button>
      <button class="btn ghost" onclick="chmuraPobierzWszystko()">📥 Pobierz z serwera</button>
      <button class="btn ghost" onclick="chmuraWyczyscToken()">Odłącz hasło</button>`
      :`<button class="btn" onclick="chmuraUstawToken()">🔑 Wpisz hasło bazy</button>`}
    </div>
  </div>`;
}

function wczytajLS(klucz, domyslne){ try{ return JSON.parse(localStorage.getItem(klucz)) ?? domyslne; }catch(e){ return domyslne; } }
function zapiszLS(klucz, dane){
  if(klucz==="artway_zamowienia" && Array.isArray(dane)) dane = filtrujAktywneZamowienia(dane);
  try{ localStorage.setItem(klucz, JSON.stringify(dane)); }catch(e){ loguj("ostrzezenie","Nie udało się zapisać: "+klucz); }
  if(!chmuraWczytywanie && chmuraToken && KLUCZE_WSPOLNE.includes(klucz)){ zaplanujZapisUstawien(); } }
const kwotaNum = v => { const n=Number(String(v ?? 0).replace(",",".").replace(/[^0-9.-]/g,"")); return Number.isFinite(n) ? +n.toFixed(2) : 0; };
const zl = n => kwotaNum(n).toFixed(2).replace(".", ",") + " zł";
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const jsArg = s => esc(JSON.stringify(String(s??"")));
function skrocTekst(v, max=190){
  const s=String(v??"").replace(/\s+/g," ").trim();
  return s.length>max ? s.slice(0,max).replace(/\s+\S*$/,"")+"…" : s;
}
function tylkoCyfry(v){ return String(v??"").replace(/[^0-9]/g,""); }
function formatTelefonPlatnosci(v=KONFIG.numerPrzelewuTelefon){
  const c = tylkoCyfry(v || NUMER_PRZELEWU_TELEFON_DOMYSLNY);
  return c.length===9 ? `${c.slice(0,3)} ${c.slice(3,6)} ${c.slice(6)}` : String(v||NUMER_PRZELEWU_TELEFON_DOMYSLNY).trim();
}
function ustawNumerPrzelewuTelefon(v){
  const c = tylkoCyfry(v || NUMER_PRZELEWU_TELEFON_DOMYSLNY).slice(0,15);
  KONFIG.numerPrzelewuTelefon = c || NUMER_PRZELEWU_TELEFON_DOMYSLNY;
  return KONFIG.numerPrzelewuTelefon;
}
function daneFirmy(){
  const d = {...DANE_FIRMY_DOMYSLNE, ...(KONFIG.daneFirmy||{})};
  const ident = tylkoCyfry(d.identyfikator || d.nip || d.pesel || DANE_FIRMY_DOMYSLNE.identyfikator);
  d.identyfikator = ident;
  d.nip = tylkoCyfry(d.nip || ident);
  d.pesel = tylkoCyfry(d.pesel || ident);
  return d;
}
function daneFirmyTekst(){
  const d = daneFirmy();
  return `${d.nazwa}${d.adres?`, ${d.adres}`:""}, identyfikator firmy (NIP/PESEL): ${d.identyfikator}`;
}
function daneFirmyHTML(){
  const d = daneFirmy();
  return `${esc(d.nazwa)}${d.adres?`, ${esc(d.adres)}`:""}<br><b>Identyfikator firmy (NIP/PESEL):</b> ${esc(d.identyfikator)}`;
}
function normalizujPlatnosci(lista){
  const bazowe = DOMYSLNE_PLATNOSCI.map(p=>({...p}));
  const domyslne = Object.fromEntries(bazowe.map(p=>[p.id,p]));
  const wynik = [], widziane = new Set();
  const zrodlo = Array.isArray(lista) ? lista : [];
  for(const raw of zrodlo){
    if(!raw || typeof raw!=="object") continue;
    let id = String(raw.id||"").trim();
    if(id==="przelew") continue;          // usuwamy starą metodę bankową ze starych ustawień
    if(id==="online") id = "paynow";      // stara płatność online staje się Paynow
    const podstawa = domyslne[id] || null;
    const p = {...(podstawa||{}), ...raw, id};
    delete p.wymagaLink;
    if(id==="paynow"){
      p.nazwa = "mBank Paynow — BLIK, karta lub szybki przelew";
      p.bramka = "paynow";
    }
    if(id==="telefon"){
      p.nazwa = `Przelew na telefon ${formatTelefonPlatnosci()}`;
      p.typ = "telefon";
      p.oplata = Number(p.oplata||0);
    }
    if(!id || widziane.has(id)) continue;
    widziane.add(id); wynik.push(p);
  }
  for(const p of bazowe){
    if(!widziane.has(p.id)){
      wynik.push(p.id==="telefon" ? {...p,nazwa:`Przelew na telefon ${formatTelefonPlatnosci()}`} : p);
      widziane.add(p.id);
    }
  }
  return wynik;
}
function migrujTresciPrawne(tresci){
  if(!tresci || typeof tresci!=="object") return tresci || null;
  const zamien = v => String(v||"")
    .replace(/\[nazwa firmy,\s*NIP,\s*adres\]/gi, daneFirmyTekst())
    .replace(/\[nazwa firmy,\s*adres\]/gi, daneFirmyTekst())
    .replace(new RegExp(LEGACY_PRZELEW_TEKST, "gi"), "przelew na telefon")
    .replace(/Przelewy24\s*\/\s*PayU\s*\/\s*Stripe/gi, "mBank Paynow");
  return Object.fromEntries(Object.entries(tresci).map(([k,v])=>[k,zamien(v)]));
}
function platnosciOpis(){
  return dostepnePlatnosci().map(p=>p.nazwa).join(", ") || "brak aktywnych metod płatności";
}
function instrukcjaPlatnosciTekst(id, nr, kwota){
  const kw = typeof kwota==="number" ? zl(kwota) : String(kwota||"");
  if(id==="pobranie") return `Płatność przy odbiorze: do zapłaty ${kw}.`;
  if(id==="telefon") return `Przelew na telefon: ${formatTelefonPlatnosci()}. W tytule/wiadomości wpisz: Zamówienie ${nr}. Kwota: ${kw}.`;
  if(id==="paynow") return KONFIG.linkPlatnosci
    ? `mBank Paynow: opłać zamówienie tutaj: ${KONFIG.linkPlatnosci}. Numer zamówienia: ${nr}. Kwota: ${kw}.`
    : `mBank Paynow: po złożeniu zamówienia sklep utworzy płatność i pokaże przycisk zapłaty. Numer zamówienia: ${nr}. Kwota: ${kw}.`;
  return `Płatność: ${kw}. Numer zamówienia: ${nr}.`;
}
function paynowDane(z){ return (z && typeof z==="object" && (z.paynow || z.platnoscPaynow)) || {}; }
function paynowStatusTekst(status){
  switch(String(status||"").toUpperCase()){
    case "CONFIRMED": return "opłacone";
    case "PENDING": return "oczekuje na potwierdzenie";
    case "NEW": return "rozpoczęte";
    case "EXPIRED": return "wygasła";
    case "REJECTED": return "odrzucona";
    case "ABANDONED": return "porzucona";
    case "ERROR": return "błąd płatności";
    default: return status ? String(status) : "brak statusu";
  }
}
function paynowKolorStatusu(status){
  status=String(status||"").toUpperCase();
  if(status==="CONFIRMED") return "var(--ok)";
  if(status==="ERROR"||status==="REJECTED"||status==="EXPIRED"||status==="ABANDONED") return "var(--danger)";
  return "var(--warn)";
}
const paynowStatusAutosprawdzone = new Set();
function instrukcjaPaynowHTML(nr, kwota, zam=null){
  const kw = typeof kwota==="number" ? zl(kwota) : esc(kwota||"");
  const p = paynowDane(zam);
  const link = p.redirectUrl || p.redirect_url || KONFIG.linkPlatnosci || "";
  const status = p.status || "";
  const paymentId = p.paymentId || "";
  const statusHtml = status ? `<p class="pay-note" style="text-align:left;margin-top:.5rem;border-left-color:${paynowKolorStatusu(status)}">Status Paynow: <b>${esc(paynowStatusTekst(status))}</b>${paymentId?` • ID: <code>${esc(paymentId)}</code>`:""}</p>` : "";
  if(link){
    return `<div>
      <a href="${esc(link)}" target="_blank" rel="noopener" class="checkout-btn" style="display:block;text-decoration:none;text-align:center;background:var(--ok)">💳 Zapłać przez mBank Paynow ${kw}</a>
      ${statusHtml || `<p class="pay-note">Płatność Paynow utworzona dla zamówienia <b>${esc(nr)}</b>.</p>`}
      ${paymentId?`<div class="diag-actions" style="margin-top:.45rem"><button class="btn ghost" type="button" onclick="odswiezStatusPaynow(${jsArg(nr)},${jsArg(paymentId)})">🔄 Sprawdź status Paynow</button></div>`:""}
    </div>`;
  }
  return `<div class="pay-note" style="font-size:.95rem;text-align:left">💳 <b>mBank Paynow</b><br>Brama jest wybrana, ale link płatności nie został jeszcze utworzony. Jeżeli zamówienie już istnieje, odśwież status albo sprawdź konfigurację Paynow w panelu admina.<br><b>Numer zamówienia:</b> ${esc(nr)} • <b>Kwota:</b> ${kw}</div>`;
}
async function utworzPlatnoscPaynow(zamowienie){
  if(!zamowienie || zamowienie.platnoscId!=="paynow") return {ok:false, skipped:true};
  try{
    toast("Tworzę płatność Paynow…");
    const d = await chmura("paynow-create",{method:"POST",body:{order:zamowienie},timeout:18000});
    zamowienie.paynow = {...paynowDane(zamowienie), ...(d.paynow||{}), paymentId:d.paymentId||d.paynow?.paymentId||paynowDane(zamowienie).paymentId||"", status:d.status||d.paynow?.status||"", redirectUrl:d.redirectUrl||d.paynow?.redirectUrl||""};
    zamowienie.platnoscStatus = d.paymentStatus || paynowStatusTekst(zamowienie.paynow.status);
    zapiszZamowienie(zamowienie);
    loguj("info",`Paynow: utworzono płatność ${zamowienie.paynow.paymentId||""} dla ${zamowienie.nr}`);
    return d;
  }catch(e){
    loguj("blad",`Paynow: nie udało się utworzyć płatności dla ${zamowienie.nr}: ${e.message}`);
    return {ok:false,error:e.message,code:e.code||""};
  }
}
async function odswiezStatusPaynow(nr,paymentId=""){
  try{
    toast("Sprawdzam status Paynow…");
    const d = await chmura("paynow-status",{params:{nr,paymentId},timeout:15000});
    const lista=pobierzZamowienia(), i=lista.findIndex(z=>z.nr===nr);
    if(i>=0 && d.order){
      lista[i]={...lista[i],...d.order,paynow:{...paynowDane(lista[i]),...(d.order.paynow||{})},platnoscStatus:d.paymentStatus||d.order.platnoscStatus||lista[i].platnoscStatus};
      zapiszLS("artway_zamowienia",lista);
    }
    toast("Paynow: "+paynowStatusTekst(d.status));
    renderuj();
  }catch(e){
    toast("Paynow: "+e.message);
    loguj("blad","Paynow status: "+e.message);
  }
}
async function zwrotPieniedzyPaynow(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z){ toast("Nie znaleziono zamówienia"); return; }
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora, aby zlecić zwrot"); chmuraUstawToken(); return; }
  const pelna=Number(z.razem)||0;
  const juz=(Array.isArray(z?.paynow?.refunds)?z.paynow.refunds:[]).reduce((s,r)=>s+(Number(r.amount)||0),0)/100;
  const pozostalo=Math.max(0,pelna-juz);
  const wpis=prompt(`Kwota zwrotu w zł dla ${nr} (pozostało do zwrotu: ${zl(pozostalo)}).\nZostaw domyślną wartość, aby zwrócić całą pozostałą kwotę:`, pozostalo.toFixed(2));
  if(wpis===null) return;
  const kwota=Number(String(wpis).replace(",",".").replace(/[^0-9.]/g,""))||0;
  if(kwota<=0){ toast("Podaj poprawną kwotę zwrotu"); return; }
  if(kwota>pozostalo+0.001){ toast(`Kwota przekracza pozostałe ${zl(pozostalo)}`); return; }
  if(!confirm(`Zwrócić ${zl(kwota)} klientowi przez Paynow?\nKlient dostanie automatyczny e-mail o zwrocie pieniędzy.`)) return;
  toast("Wysyłam zlecenie zwrotu do Paynow…");
  try{
    const d=await chmura("paynow-refund",{method:"POST",body:{nr,amount:kwota},timeout:25000});
    aktualizujZamowienie(nr,zam=>{
      zam.status="zwrot pieniędzy";
      if(d.order?.paynow) zam.paynow={...paynowDane(zam),...d.order.paynow};
      if(d.order?.platnoscStatus) zam.platnoscStatus=d.order.platnoscStatus;
      if(Array.isArray(d.powiadomienia)){ zam.wysylka=zam.wysylka||{}; zam.wysylka.powiadomienia=d.powiadomienia; }
    });
    loguj("info",`Zwrot Paynow ${nr}: ${d.refundId||""} (${d.status||""})`);
    toast(`Zwrot zlecony ✅ ${d.email?.sent?"E-mail wysłany":""}`);
    renderuj();
  }catch(e){
    loguj("blad",`Zwrot Paynow ${nr}: ${e.message}`);
    toast("Nie udało się zlecić zwrotu: "+e.message);
  }
}
function instrukcjaPlatnosciHTML(id, nr, kwota, zam=null){
  const kw = typeof kwota==="number" ? zl(kwota) : esc(kwota||"");
  if(id==="pobranie") return `<div class="pay-note" style="font-size:.95rem">💵 <b>Zapłacisz ${kw} przy odbiorze przesyłki InPost</b>. Nic więcej nie musisz robić.</div>`;
  if(id==="telefon"){
    const numer = formatTelefonPlatnosci(), tytul = `Zamówienie ${nr}`;
    return `<div class="pay-note" style="font-size:.95rem">
      📱 <b>Przelew na telefon</b><br>
      Numer: <code>${esc(numer)}</code> &nbsp; Tytuł/wiadomość: <code>${esc(tytul)}</code><br>
      Kwota: <b>${kw}</b>. Wyślij przelew na telefon i koniecznie wpisz numer zamówienia.
      <div class="diag-actions" style="margin-top:.55rem">
        <button class="btn ghost" type="button" onclick="navigator.clipboard?.writeText(${jsArg(tylkoCyfry(numer))});toast('Skopiowano numer telefonu')">Kopiuj numer</button>
        <button class="btn ghost" type="button" onclick="navigator.clipboard?.writeText(${jsArg(tytul)});toast('Skopiowano tytuł płatności')">Kopiuj tytuł</button>
      </div>
    </div>`;
  }
  if(id==="paynow"){
    return instrukcjaPaynowHTML(nr, kwota, zam);
  }
  return `<p class="pay-note">Płatność: <b>${kw}</b>. Numer zamówienia: <b>${esc(nr)}</b>.</p>`;
}
const bezpiecznyLink = s => /^(#\/|https?:\/\/|mailto:)/i.test(String(s||"")) ? String(s) : "#/";
const OKRES_KOSZA_MS = 30*24*60*60*1000;
function oznaczProduktWKoszu(id,typ){
  koszMeta={...koszMeta,[id]:{usunietoAt:Date.now(),typ}};
  zapiszLS("artway_kosz_meta",koszMeta);
}
function usunMetaKosza(id){
  delete koszMeta[id]; zapiszLS("artway_kosz_meta",koszMeta);
}
function dniDoUsuniecia(id){
  const ts=Number(koszMeta[id]?.usunietoAt||Date.now());
  return Math.max(0,Math.ceil((ts+OKRES_KOSZA_MS-Date.now())/86400000));
}
function wyczyscPrzeterminowanyKosz(){
  let zmiana=false;
  for(const p of koszDodanych) if(!koszMeta[p.id]){koszMeta[p.id]={usunietoAt:Date.now(),typ:"wlasny"};zmiana=true;}
  for(const id of produktyUkryte) if(!produktyDefinitywne.includes(id)&&!koszMeta[id]){koszMeta[id]={usunietoAt:Date.now(),typ:"bazowy"};zmiana=true;}
  const wygasle=Object.entries(koszMeta).filter(([,m])=>Date.now()-Number(m.usunietoAt||0)>=OKRES_KOSZA_MS);
  for(const [idTekst,m] of wygasle){
    const id=Number(idTekst);
    if(m.typ==="wlasny"){
      koszDodanych=koszDodanych.filter(p=>p.id!==id);
    }else{
      if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
      if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
      delete produktyEdytowane[id];
    }
    delete stanyProduktow[id];
    delete koszMeta[idTekst]; zmiana=true;
    loguj("info",`Kosz: automatycznie usunięto definitywnie produkt ${id} po 30 dniach`);
  }
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  if(zmiana){
    zapiszLS("artway_kosz_dodane",koszDodanych);
    zapiszLS("artway_kosz_meta",koszMeta);
    zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
    zapiszLS("artway_produkty_ukryte",produktyUkryte);
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
    zapiszLS("artway_stany",stanyProduktow);
  }
}
function najwyzszeIdProduktu(){
  const liczby=[
    ...prodBazowe.map(p=>Number(p.id)||0),
    ...produktyDodane.map(p=>Number(p.id)||0),
    ...koszDodanych.map(p=>Number(p.id)||0),
    ...produktyUkryte.map(id=>Number(id)||0),
    ...produktyDefinitywne.map(id=>Number(id)||0),
    ...Object.keys(produktyEdytowane||{}).map(id=>Number(id)||0),
    ...Object.keys(stanyProduktow||{}).map(id=>Number(id)||0),
    ...Object.keys(ustawienia.mapaProduktow||{}).map(id=>Number(id)||0)
  ];
  return Math.max(0,...liczby);
}
function naprawKolizjeIdProduktow(){
  if(!produktyDodane.length) return false;
  const zajete=new Set();
  let nastepne=najwyzszeIdProduktu()+1, zmiana=false;
  const wezNoweId=()=>{while(zajete.has(nastepne))nastepne++;const id=nastepne;zajete.add(id);nastepne++;return id;};
  produktyDodane=produktyDodane.map(p=>{
    const id=Number(p.id);
    if(!Number.isInteger(id)||id<=0||zajete.has(id)){
      const nowe=wezNoweId();
      zmiana=true;
      return {...p,id:nowe};
    }
    zajete.add(id);
    if(p.id!==id){ zmiana=true; return {...p,id}; }
    return p;
  });
  if(!zmiana) return false;
  zapiszLS("artway_produkty_dodane",produktyDodane);
  loguj("ostrzezenie","Naprawiono wyłącznie nieprawidłowe lub powtórzone ID w produktach dodanych. ID usuniętego produktu bazowego może być ponownie użyte przez nowy produkt.");
  return true;
}

/* ═══════════ KONTA UŻYTKOWNIKÓW ═══════════
   Lokalna pamięć jest cache. Źródłem wspólnym dla urządzeń jest API serwerowe. */
function pobierzUzytkownikow(){ return wczytajLS("artway_uzytkownicy", []); }
function prostyHash(s){ let h=5381; for(const c of s){ h=((h<<5)+h+c.charCodeAt(0))>>>0; } return "h"+h.toString(16); }
async function hashuj(s){
  try{
    if(crypto?.subtle){
      const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
    }
  }catch(e){}
  return prostyHash(s);
}
async function zarejestrujUzytkownika(imie, email, haslo){
  imie=imie.trim(); email=email.trim().toLowerCase();
  if(!imie || !email.includes("@")) return {ok:false, blad:"Podaj poprawne imię i adres e-mail."};
  if(haslo.length<6) return {ok:false, blad:"Hasło musi mieć co najmniej 6 znaków."};
  const u = pobierzUzytkownikow();
  if(u.some(x=>x.email===email)) return {ok:false, blad:"Konto z tym adresem już istnieje — zaloguj się."};
  const rekord={ imie, email, hash: await hashuj(haslo), rola:"klient", account:true, data:new Date().toISOString() };
  try{
    // konto zakładane we WSPÓLNEJ bazie — działa na każdym urządzeniu
    await chmura("account-register",{method:"POST",body:{user:rekord}});
    stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
  }catch(bl){
    if(bl.code==="exists") return {ok:false, blad:"Konto z tym adresem już istnieje — zaloguj się."};
    loguj("ostrzezenie","Serwer kont niedostępny — konto zapisane lokalnie: "+bl.message);
  }
  u.push(rekord);
  zapiszLS("artway_uzytkownicy", u);
  loguj("info","Zarejestrowano użytkownika: "+email);
  return {ok:true};
}
async function sprawdzLogowanie(email, haslo){
  email=email.trim().toLowerCase();
  const adminEmail=KONFIG.emailAdmina.toLowerCase();
  // 1) ADMINISTRATOR — hasłem jest token wspólnej bazy (ARTWAY_ADMIN_TOKEN).
  //    Weryfikacja NA SERWERZE → działa na każdym urządzeniu i od razu łączy wspólną bazę.
  if(email==="admin" || email===adminEmail){
    try{
      await chmura("login",{method:"POST",body:{password:haslo}});
      chmuraToken=haslo; zapiszLS("artway_chmura_token",chmuraToken);
      const lista=pobierzUzytkownikow(); const a=lista.find(x=>x.email===adminEmail);
      if(a){ a.hash=""; zapiszLS("artway_uzytkownicy",lista); }
      domyslneHasloAdmina=false;
      chmuraStan={...chmuraStan,dostepna:true,admin:true};
      await synchronizujBazeCentralna(true).catch(()=>{});
      return {ok:true, uzytkownik:{imie:"Administrator", email:adminEmail, rola:"admin"}};
    }catch(bl){
      // serwer niedostępny lub złe hasło → spróbuj lokalnego admin/admin (tryb offline)
    }
  }
  const emailDocelowy = (email==="admin") ? adminEmail : email;
  const hash = await hashuj(haslo);
  // 2) KLIENT — logowanie do konta we WSPÓLNEJ bazie
  if(email!=="admin"){
    try{
      const d=await chmura("account-login",{method:"POST",body:{email:emailDocelowy,hash}});
      const serwer=d.user||{}; const lista=pobierzUzytkownikow(); const lok=lista.find(x=>x.email===serwer.email);
      if(lok) Object.assign(lok,serwer,{hash}); else lista.push({...serwer,hash});
      zapiszLS("artway_uzytkownicy",lista);
      stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
      return {ok:true, uzytkownik:{imie:serwer.imie||serwer.email, email:serwer.email, rola:serwer.rola||"klient"}};
    }catch(bl){ /* serwer niedostępny lub konto tylko lokalne → sprawdzamy lokalnie */ }
  }
  // 3) Awaryjne logowanie lokalne (offline / stare konta)
  const u = pobierzUzytkownikow().find(x=>x.email===emailDocelowy);
  if(!u) return {ok:false, blad:"Nieprawidłowy e-mail lub hasło."};
  if(u.hash !== hash) return {ok:false, blad:"Nieprawidłowe hasło."};
  return {ok:true, uzytkownik:{imie:u.imie, email:u.email, rola:u.rola||"klient"}};
}
function ustawSesje(u){ sesja=u; zapiszLS("artway_sesja", u); odswiezUzytkownika(); }
function wyloguj(){ chmuraToken=""; zapiszLS("artway_chmura_token",""); chmuraStan={...chmuraStan,admin:false}; stanBramki={...stanBramki,authenticated:false}; ustawSesje(null); toast("Wylogowano 👋"); location.hash="#/"; }
function jestGlownymAdminem(email){ return String(email||"").toLowerCase()===KONFIG.emailAdmina.toLowerCase(); }
function kontoMaRoleAdmin(email){
  const e=String(email||"").toLowerCase();
  return jestGlownymAdminem(e)||pobierzUzytkownikow().some(u=>u.email===e&&u.rola==="admin");
}
function jestAdmin(){ return !!sesja&&kontoMaRoleAdmin(sesja.email); }
function odswiezUzytkownika(){
  $("userBtn").textContent = sesja ? "👤 "+sesja.imie.split(" ")[0] : "👤 Zaloguj";
  $("userBtn").href = sesja ? "#/konto" : "#/logowanie";
  const widokKlienta=!jestAdmin();
  if($("favoritesBtn")) $("favoritesBtn").style.display=widokKlienta?"":"none";
  if($("ordersBtn")) $("ordersBtn").style.display=widokKlienta?"":"none";
  document.querySelectorAll('[data-page-link="ulubione"],[data-page-link="zamowienia"]').forEach(a=>a.style.display=widokKlienta?"":"none");
  const d = $("diagLink"); if(d) d.style.display = jestAdmin() ? "" : "none";
  odswiezMenu();
}
/* Górne menu = strony główne sklepu: katalogi produktów + Promocje + Nowości */
function wszystkieKategorie(){
  const zProduktow = [...new Set(produkty.map(p=>p.kategoria))];
  const ukryte = ustawienia.ukryteKategorie || [];
  const wlasne = (ustawienia.wlasneKategorie||[]).filter(k=>!ukryte.includes(k));
  return [...new Set([...zProduktow, ...wlasne])];
}
function liczbaProduktowWKategorii(k){ return produkty.filter(p=>p.kategoria===k).length; }
function grupyMenuKategorii(){
  return (Array.isArray(ustawienia.menuKategorii)?ustawienia.menuKategorii:[])
    .map((g,i)=>({
      id:String(g.id||("grp_"+i+"_"+prostyHash(String(g.nazwa||i)))),
      nazwa:String(g.nazwa||"Grupa katalogów").trim()||"Grupa katalogów",
      ikona:String(g.ikona||"🗂️").trim()||"🗂️",
      aktywna:g.aktywna!==false,
      kategorie:[...new Set((Array.isArray(g.kategorie)?g.kategorie:[]).map(x=>String(x).trim()).filter(Boolean))]
    }));
}
function zapiszGrupyMenuKategorii(lista, ekstra={}){
  ustawienia.menuKategorii=lista.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
  zapiszCzescUstawien({menuKategorii:ustawienia.menuKategorii,...ekstra});
}
function kategoriePrzypisaneDoAktywnychGrup(kategorie){
  const dozwolone=new Set(kategorie);
  return new Set(grupyMenuKategorii().filter(g=>g.aktywna).flatMap(g=>g.kategorie.filter(k=>dozwolone.has(k))));
}
function linkKategoriiMenu(k){
  return `<a href="#/kategoria/${encodeURIComponent(k)}"><span>${esc(k)}</span><span class="nav-count">${liczbaProduktowWKategorii(k)}</span></a>`;
}
function dropdownMenuKategorii(label, dzieci, ikona="🗂️"){
  if(!dzieci.length) return "";
  return `<span class="nav-dd"><button class="nav-drop-btn" type="button">${esc(ikona)} ${esc(label)} ▾</button><span class="nav-menu">${dzieci.map(linkKategoriiMenu).join("")}</span></span>`;
}
function odswiezMenu(){
  const n = $("mainNav"); if(!n) return;
  const kategorie = wszystkieKategorie();
  const grupy = grupyMenuKategorii();
  const grupyHTML = grupy.filter(g=>g.aktywna).map(g=>dropdownMenuKategorii(g.nazwa, g.kategorie.filter(k=>kategorie.includes(k)), g.ikona)).join("");
  const przypisane = kategoriePrzypisaneDoAktywnychGrup(kategorie);
  const bezGrup = kategorie.filter(k=>!przypisane.has(k));
  const pokazBezGrup = ustawienia.menuPokazNieprzypisane!==false;
  const bezGrupHTML = pokazBezGrup
    ? (grupy.length && bezGrup.length>4
      ? dropdownMenuKategorii("Pozostałe", bezGrup, "📁")
      : bezGrup.slice(0,grupy.length?8:10).map(k=>`<a href="#/kategoria/${encodeURIComponent(k)}">${esc(k)}</a>`).join("") + (bezGrup.length>(grupy.length?8:10)?dropdownMenuKategorii("Więcej", bezGrup.slice(grupy.length?8:10), "📁"):""))
    : "";
  n.innerHTML = `<a href="#/">🏪 Strona główna</a>`
    + grupyHTML
    + bezGrupHTML
    + `<a href="#/promocje">🔥 Promocje</a><a href="#/nowosci">✨ Nowości</a>`
    + (jestAdmin()?`<a href="#/admin" style="color:var(--brand2)">⚙️ Panel admina</a>`:"");
}
function odswiezUlubioneLicznik(){
  const e = $("ulubCount"); if(!e) return;
  e.textContent = ulubione.length;
  e.style.display = !jestAdmin()&&ulubione.length ? "" : "none";
}
/* Lokalne konto administratora służy wyłącznie do podglądu developerskiego.
   Na opublikowanej stronie login „admin” korzysta z hasła w api/config.php. */
let domyslneHasloAdmina = false;
async function zainicjujAdmina(){
  const u = pobierzUzytkownikow();
  const email = KONFIG.emailAdmina.toLowerCase();
  let admin = u.find(x=>x.email===email);
  if(!admin){
    admin = { imie:"Administrator", email, hash: await hashuj("admin"), rola:"admin", data:new Date().toISOString() };
    u.push(admin); zapiszLS("artway_uzytkownicy", u);
    loguj("info","Utworzono konto administratora (login: admin, hasło: admin). Zmień hasło po pierwszym logowaniu!");
  }
  if(admin.rola!=="admin"){ admin.rola="admin"; zapiszLS("artway_uzytkownicy",u); }
  domyslneHasloAdmina = admin.hash === await hashuj("admin");
}
async function zmienHaslo(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const nowe=String(f.get("nowe")||""),powtorz=String(f.get("nowe2")||"");
  if(nowe.length<6){ toast("⚠️ Nowe hasło musi mieć min. 6 znaków"); return; }
  if(nowe!==powtorz){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  try{
    await wywolajBramke("account-password-change",{method:"POST",body:{current_password:String(f.get("stare")||""),new_password:nowe}});
  }catch(bl){
    const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
    if(!lokalnyPodglad){toast("⚠️ Nie zmieniono hasła: "+bl.message);return;}
    const w = await sprawdzLogowanie(sesja.email, f.get("stare"));
    if(!w.ok){ toast("⚠️ Obecne hasło nieprawidłowe"); return; }
  }
  const u = pobierzUzytkownikow(); const ja = u.find(x=>x.email===sesja.email);
  if(ja){ja.hash = await hashuj(nowe);zapiszLS("artway_uzytkownicy", u);}
  if(jestGlownymAdminem(sesja.email)) domyslneHasloAdmina = nowe==="admin";
  loguj("info","Zmieniono hasło konta: "+sesja.email);
  toast("Hasło zmienione ✅"); e.target.reset();
}

/* ═══════════ ZAMÓWIENIA ═══════════ */
function pobierzZamowienia(){ return filtrujAktywneZamowienia(wczytajLS("artway_zamowienia", [])); }
function zapiszZamowienie(z){
  if(czyZamowienieUsuniete(z?.nr)){ loguj("ostrzezenie","Pominięto zapis wcześniej usuniętego zlecenia "+(z?.nr||"")); return false; }
  const t=pobierzZamowienia(); const i=t.findIndex(x=>x.nr===z.nr);
  if(i>=0) t[i]={...t[i],...z}; else t.unshift(z);
  zapiszLS("artway_zamowienia", t); return true;
}

/* ═══════════ USTAWIENIA SKLEPU (panel admina → Ustawienia) ═══════════
   Zapisywane w tej przeglądarce (artway_ustawienia) i nakładane na KONFIG.
   Zmieniają: nazwę sklepu, pasek u góry, stopkę, telefon, bramkę
   płatności, koszty dostaw, opłatę pobrania i kody rabatowe.          */
function zastosujUstawienia(){
  const u = ustawienia || {};
  if(u.nazwaSklepu) KONFIG.nazwaSklepu = u.nazwaSklepu;
  if(u.pasekInfo!==undefined && u.pasekInfo!=="") KONFIG.pasekInfo = u.pasekInfo;
  if(u.czasWysylki!==undefined && u.czasWysylki!=="") KONFIG.czasWysylki = String(u.czasWysylki).trim();
  else {
    const czasZPaska=wykryjCzasWysylkiZTekstu(u.pasekInfo||KONFIG.pasekInfo);
    if(czasZPaska) KONFIG.czasWysylki=czasZPaska;
  }
  if(u.telefon) KONFIG.telefon = u.telefon;
  if(u.opisSklepu) KONFIG.opisSklepu = u.opisSklepu;
  if(u.emailSklepu) KONFIG.emailSklepu = u.emailSklepu;
  if(u.daneFirmy && typeof u.daneFirmy==="object") KONFIG.daneFirmy = {...DANE_FIRMY_DOMYSLNE, ...u.daneFirmy};
  else KONFIG.daneFirmy = {...DANE_FIRMY_DOMYSLNE, ...(KONFIG.daneFirmy||{})};
  if(u.linkPlatnosci!==undefined) KONFIG.linkPlatnosci = u.linkPlatnosci;
  if(u.numerPrzelewuTelefon!==undefined) ustawNumerPrzelewuTelefon(u.numerPrzelewuTelefon);
  else ustawNumerPrzelewuTelefon(KONFIG.numerPrzelewuTelefon);
  if(u.darmowaDostawaOd!==undefined && u.darmowaDostawaOd!=="") KONFIG.darmowaDostawaOd = +u.darmowaDostawaOd;
  KONFIG.kurierInpostAktywny = true; // wymuszone: klient zawsze ma Paczkomat i Kurier InPost
  if(Array.isArray(u.dostawy) && u.dostawy.length) KONFIG.dostawy = normalizujDostawyInPost(u.dostawy.map(x=>({...x})));
  else KONFIG.dostawy = normalizujDostawyInPost(KONFIG.dostawy);
  if(Array.isArray(u.platnosci) && u.platnosci.length) KONFIG.platnosci = u.platnosci.map(x=>({...x}));
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  ustawienia.dostawy = KONFIG.dostawy.map(x=>({...x}));
  ustawienia.platnosci = KONFIG.platnosci.map(x=>({...x}));
  ustawienia.numerPrzelewuTelefon = KONFIG.numerPrzelewuTelefon;
  ustawienia.daneFirmy = {...daneFirmy()};
  const paczkomat = KONFIG.dostawy.find(d=>d.id==="paczkomat");
  const kurierInpost = KONFIG.dostawy.find(d=>d.id==="kurier_inpost");
  if(paczkomat && u.kosztPaczkomat!==undefined && u.kosztPaczkomat!==""){
    const kosztPaczkomat = Number(String(u.kosztPaczkomat).replace(",","."));
    if(Number.isFinite(kosztPaczkomat)) paczkomat.koszt = +kosztPaczkomat.toFixed(2);
  }
  if(kurierInpost && u.kosztKurierInpost!==undefined && u.kosztKurierInpost!==""){
    const kosztKurier = Number(String(u.kosztKurierInpost).replace(",","."));
    if(Number.isFinite(kosztKurier)) kurierInpost.koszt = +kosztKurier.toFixed(2);
  }
  if(kurierInpost) kurierInpost.koszt = 20; // wymuszone: Kurier InPost dla klienta kosztuje 20 zł
  ustawienia.dostawy = KONFIG.dostawy.map(x=>({...x}));
  ustawienia.kurierInpostAktywny = true;
  const pobranie = KONFIG.platnosci.find(p=>p.id==="pobranie"), paynow = KONFIG.platnosci.find(p=>p.id==="paynow"), telefon = KONFIG.platnosci.find(p=>p.id==="telefon");
  if(pobranie && u.oplataPobranie!==undefined && u.oplataPobranie!=="") pobranie.oplata = +u.oplataPobranie;
  if(pobranie && u.pobranieWl!==undefined) pobranie.wylaczona = !u.pobranieWl;
  if(paynow && u.paynowWl!==undefined) paynow.wylaczona = !u.paynowWl;
  if(telefon && u.telefonWl!==undefined) telefon.wylaczona = !u.telefonWl;
  if(telefon) telefon.nazwa = `Przelew na telefon ${formatTelefonPlatnosci()}`;
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  ustawienia.platnosci = KONFIG.platnosci.map(x=>({...x}));
  if(u.kody) KONFIG.kodyRabatowe = {...u.kody};
  if(u.heroTytul) KONFIG.heroTytul = u.heroTytul;
  if(u.heroOpis) KONFIG.heroOpis = u.heroOpis;
  if(Object.prototype.hasOwnProperty.call(u,"tresci")){ KONFIG.tresci = migrujTresciPrawne(u.tresci); ustawienia.tresci = KONFIG.tresci; }
  const ukl = u.uklad || {};
  const szer = ["1100px","1200px","1400px"].includes(ukl.szerokosc) ? ukl.szerokosc : "1200px";
  const karta = ["200px","240px","280px"].includes(ukl.kartaMin) ? ukl.kartaMin : "240px";
  const promien = ["10px","16px","22px"].includes(ukl.promien) ? ukl.promien : "16px";
  document.documentElement.style.setProperty("--content",szer);
  document.documentElement.style.setProperty("--card-min",karta);
  document.documentElement.style.setProperty("--radius",promien);
  document.body.dataset.density = ukl.gestosc || "standard";
  const klasy = {
    "header-static":ukl.statycznyNaglowek===true,
    "hide-home-categories":ukl.sekcjaKategorie===false,
    "hide-home-steps":ukl.sekcjaKroki===false,
    "hide-home-about":ukl.sekcjaOnas===false,
    "hide-home-faq":ukl.sekcjaFaq===false,
    "hide-home-contact":ukl.sekcjaKontakt===false
  };
  Object.entries(klasy).forEach(([k,v])=>document.body.classList[v?"add":"remove"](k));
  // odświeżenie stałych elementów strony
  const n = KONFIG.nazwaSklepu, i = n.indexOf("-");
  $("logoA").innerHTML = ustawienia.logoObraz
    ? `<img src="${ustawienia.logoObraz}" alt="${esc(n)}" style="height:36px;display:block;max-width:190px;object-fit:contain">`
    : (i>0 ? esc(n.slice(0,i))+"<span>"+esc(n.slice(i))+"</span>" : "<span>"+esc(n)+"</span>");
  $("topbar").innerHTML = pasekInfoHTML();
  document.title = u.seo?.tytul || KONFIG.nazwaSklepu + " — Sklep internetowy";
  const metaOpis=document.querySelector('meta[name="description"]');
  if(metaOpis&&u.seo?.opis)metaOpis.setAttribute("content",u.seo.opis);
  $("footNazwa").textContent = KONFIG.nazwaSklepu;
  $("footOpis").textContent = KONFIG.opisSklepu;
  $("footMail").textContent = "✉️ " + KONFIG.emailSklepu;
  $("footMail").href = "mailto:" + KONFIG.emailSklepu;
  $("footTel").textContent = "📞 " + KONFIG.telefon;
  $("topbar").style.display = u.uklad?.pasekInfoWidoczny===false ? "none" : "";
  $("searchInput").placeholder = u.tekstSzukaj || "Szukaj produktu…";
  $("footCopy").textContent = u.stopkaCopy || `© ${new Date().getFullYear()} ${KONFIG.nazwaSklepu}. Wszystkie prawa zastrzeżone.`;
  aktualizujFavicon();
  document.querySelectorAll("[data-page-link]").forEach(a=>{
    a.style.display = ustawieniaPodstrony(a.dataset.pageLink).widoczna===false ? "none" : "";
  });
  if(jestAdmin()) document.querySelectorAll('[data-page-link="ulubione"],[data-page-link="zamowienia"]').forEach(a=>a.style.display="none");
}

/* ═══════════ WCZYTANIE PRODUKTÓW ═══════════
   Lista = (products.json lub zapasowa) − ukryte + dodane w panelu admina */
function zbudujProdukty(){
  naprawKolizjeIdProduktow();
  const zmianyKat = ustawienia.kategorie || {};
  const ukryteKat = ustawienia.ukryteKategorie || [];
  const mapa = ustawienia.mapaProduktow || {};    // zaawansowane mapowanie: id produktu → katalog
  const dodaneIds = new Set(produktyDodane.map(p=>Number(p.id)));
  const bazowePoEdycji = prodBazowe
    .filter(p=>!dodaneIds.has(Number(p.id))&&!produktyUkryte.includes(p.id))
    .map(p=>produktyEdytowane[p.id] ? {...p, ...produktyEdytowane[p.id], id:p.id} : p);
  produkty = [ ...bazowePoEdycji, ...produktyDodane ]
    .map(p => { let k = mapa[p.id] || p.kategoria;
                for(let i=0; i<3 && zmianyKat[k]; i++) k = zmianyKat[k];
                return k===p.kategoria ? p : {...p, kategoria:k}; })
    .map(p => stanyProduktow[p.id]!==undefined ? {...p, stan:+stanyProduktow[p.id]} : p)
    .filter(p => !ukryteKat.includes(p.kategoria));
}
/* ── Magazyn ── */
function stanProduktu(p){ return (typeof p.stan==="number" && p.stan>=0) ? p.stan : null; }   // null = bez limitu
function produktMaCeneSprzedazy(p){ return Number(p?.cena)>0; }
function ustawStan(id, wartosc){
  const s = String(wartosc??"").trim();
  if(s==="") delete stanyProduktow[id];
  else stanyProduktow[id] = Math.max(0, parseInt(s)||0);
  zapiszLS("artway_stany", stanyProduktow); zbudujProdukty();
  loguj("info",`Magazyn: produkt ${id} → ${s===""?"bez limitu":stanyProduktow[id]+" szt."}`);
  toast("Stan magazynowy zapisany ✅");
}
function zmniejszStany(pozycjeKoszyka){
  // sumuj sztuki per produkt (warianty liczą się razem)
  const sprzedane = {};
  for(const x of pozycjeKoszyka) sprzedane[x.id] = (sprzedane[x.id]||0) + x.ile;
  let zmiana = false;
  for(const id in sprzedane){
    const p = produkty.find(p=>p.id===+id);
    if(p && stanProduktu(p)!==null){
      stanyProduktow[id] = Math.max(0, stanProduktu(p) - sprzedane[id]);
      zmiana = true;
    }
  }
  if(zmiana){ zapiszLS("artway_stany", stanyProduktow); zbudujProdukty(); }
}
/* ── Opinie ── */
function opinieProduktu(pid){ return opinie.filter(o=>o.produktId===pid && o.status==="zatwierdzona"); }
function sredniaOcen(pid){
  const z = opinieProduktu(pid);
  if(!z.length) return null;
  return { srednia: z.reduce((s,o)=>s+o.ocena,0)/z.length, n: z.length };
}
function gwiazdki(ocena){
  const pelne = Math.round(ocena);
  return "★".repeat(pelne) + "☆".repeat(5-pelne);
}
function dodajOpinie(e, pid){
  e.preventDefault();
  const f = new FormData(e.target);
  const ocena = Math.min(5, Math.max(1, parseInt(f.get("ocena"))||5));
  const tekst = String(f.get("tekst")||"").trim();
  const autor = String(f.get("autor")||"").trim();
  if(!autor || tekst.length<3){ toast("⚠️ Podaj imię i treść opinii"); return; }
  const nowaOpinia={ id:"o_"+Date.now(), produktId:pid, autor:autor.slice(0,40), ocena,
    tekst:tekst.slice(0,600), data:new Date().toLocaleDateString("pl-PL"), status:"oczekuje" };
  opinie.unshift(nowaOpinia);
  zapiszLS("artway_opinie", opinie);
  void chmura("store-review-add",{method:"POST",body:{review:nowaOpinia}}).catch(()=>{});  // do moderacji we wspólnej bazie
  loguj("info",`Nowa opinia (${ocena}★) do produktu ${pid} — czeka na akceptację`);
  e.target.reset();
  toast("Dziękujemy! Opinia pojawi się po akceptacji przez sklep ⭐");
}
function moderujOpinie(id, akcja){
  if(akcja==="zatwierdz"){ const o=opinie.find(x=>x.id===id); if(o) o.status="zatwierdzona"; toast("Opinia opublikowana ✅"); }
  if(akcja==="usun"){ opinie = opinie.filter(x=>x.id!==id); toast("Opinia usunięta"); }
  zapiszLS("artway_opinie", opinie);
  loguj("info",`Moderacja opinii ${id}: ${akcja}`);
  renderuj();
}
async function wczytajProdukty(){
  try{
    const r = await fetch("products.json", {cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    prodBazowe = await r.json();
    zrodloProduktow = "json";
  }catch(e){
    prodBazowe = PRODUKTY_ZAPASOWE;
    zrodloProduktow = "zapasowe";
    loguj("info","products.json niedostępny — użyto listy zapasowej (to normalne przy otwarciu z dysku).");
  }
  naprawKolizjeIdProduktow();
  wyczyscPrzeterminowanyKosz();
  zbudujProdukty();
  odswiezMenu();
  renderuj(); odswiezKoszyk();
}

/* ═══════════ ROUTER (podstrony) ═══════════ */
function trasa(){ return (location.hash || "#/").replace(/^#/,""); }
function renderuj(){
  try{
    const t = trasa();
    const w = $("widok");
    if(t.startsWith("/admin/zamowienie/")&&!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
    if(t.startsWith("/admin")&&stanBramki.authenticated&&!stanBazyCentralnej.sprawdzono&&!stanBazyCentralnej.synchronizacja) setTimeout(()=>synchronizujBazeCentralna(true),0);
    window.scrollTo({top:0});
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
      else if(t==="/admin") w.innerHTML = widokAdmin();
      else if(t==="/admin/zamowienia") w.innerHTML = widokAdminZamowienia();
      else if(t.startsWith("/admin/zamowienie/")) w.innerHTML = widokAdminZamowienie(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/wysylki") w.innerHTML = widokAdminWysylki();
      else if(t==="/admin/asortyment" || t==="/admin/produkty") w.innerHTML = widokAdminProdukty();
      else if(t==="/admin/produkty/dodaj") w.innerHTML = widokAdminProduktyDodaj();
      else if(t.startsWith("/admin/produkty/edytuj/")) w.innerHTML = widokAdminProduktEdytuj(parseInt(t.split("/")[4]));
      else if(t==="/admin/kategorie") w.innerHTML = widokAdminKategorie();
      else if(t==="/admin/mapowanie") w.innerHTML = widokAdminMapowanie();
      else if(t==="/admin/klienci") w.innerHTML = widokAdminKlienci();
      else if(t.startsWith("/admin/klient/")) w.innerHTML = widokAdminKlient(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/rabaty") w.innerHTML = widokAdminRabaty();
      else if(t==="/admin/opinie") w.innerHTML = widokAdminOpinie();
      else if(t==="/admin/dostawy" || t==="/admin/ustawienia") w.innerHTML = widokAdminDostawy();
      else if(t==="/admin/personalizacja" || t==="/admin/wyglad") w.innerHTML = widokAdminWyglad();
      else if(t==="/admin/rozmieszczenie") w.innerHTML = widokAdminRozmieszczenie();
      else if(t==="/admin/bannery") w.innerHTML = widokAdminBannery();
      else if(t==="/admin/podstrony") w.innerHTML = widokAdminPodstrony();
      else if(t==="/admin/strony") w.innerHTML = widokAdminStrony();
      else if(t==="/admin/eksport") w.innerHTML = widokAdminEksport();
      else if(t==="/admin/aktualizacja") w.innerHTML = widokAdminAktualizacja();
      else if(t==="/admin/publikacja") w.innerHTML = widokAdminPublikacja();
      else w.innerHTML = widokAdmin();
    }
    else w.innerHTML = `<div class="page"><div class="panel"><h1>404 — nie ma takiej strony 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
    if(t==="/"||t==="") { rysujChipy(); rysuj(); }
    if(t==="/admin/aktualizacja"&&!stanAktualizacji.sprawdzono&&!stanAktualizacji.ladowanie) setTimeout(()=>sprawdzStatusAktualizacji(true),0);
  }catch(e){
    loguj("blad", "Błąd renderowania strony: "+e.message, trasa());
    $("widok").innerHTML = `<div class="page"><div class="panel"><h1>⚠️ Coś poszło nie tak</h1><p>Błąd został zapisany w <a href="#/diagnostyka">diagnostyce</a>.</p><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
  }
  odswiezZnacznikDiag();
}
window.addEventListener("hashchange", renderuj);

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
        <label>Dostępność<select onchange="filtrDostepnosci=this.value;stronaProduktow=1;rysuj()"><option value="wszystkie">Wszystkie</option><option value="dostepne" ${filtrDostepnosci==="dostepne"?"selected":""}>Dostępne</option><option value="ostatnie" ${filtrDostepnosci==="ostatnie"?"selected":""}>Ostatnie sztuki</option><option value="brak" ${filtrDostepnosci==="brak"?"selected":""}>Wyprzedane</option></select></label>
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
  SEKCJE.pasekOferty = () => { const o = ustawienia.pasekOkazji || {}; return `
  <section class="offer-band">
    <div class="offer-band-in">
      <div><h2>${esc(o.tytul||"Dobry moment na zakupy")}</h2><p>${o.opis?esc(o.opis):`Użyj kodu <b>START10</b> w koszyku i odbierz 10% rabatu na zamówienie.`}</p></div>
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
  const tekst=normalizujSzukanyTekst([p.nazwa,p.opis,p.kategoria,p.sku,p.gtin,p.externalId,p.mpn,p.marka,p.kolorProduktu,p.rozmiar,p.material,(p.warianty||[]).join(" "),p.id].join(" "));
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
    const stan=stanProduktu(p),ocena=sredniaOcen(p.id)?.srednia||0;
    return (aktywnaKategoria==="Wszystkie"||p.kategoria===aktywnaKategoria)
      && produktPasujeFrazie(p)
      && (od===null||p.cena>=od)&&(doC===null||p.cena<=doC)
      && (filtrDostepnosci==="wszystkie"||(filtrDostepnosci==="dostepne"&&stan!==0)||(filtrDostepnosci==="ostatnie"&&stan!==null&&stan>0&&stan<=3)||(filtrDostepnosci==="brak"&&stan===0))
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
function kartaProduktu(p){
  const ulub = ulubione.includes(p.id);
  const stan = stanProduktu(p);
  const oceny = sredniaOcen(p.id);
  const brakCeny = !produktMaCeneSprzedazy(p);
  return `
  <article class="card" onclick="location.hash='#/produkt/${p.id}'">
    <div class="thumb" style="background:${p.kolor||'#eef2f7'}">
      ${stan===0?`<span class="badge" style="background:#64748b">Wyprzedane</span>`:(brakCeny?`<span class="badge" style="background:#f97316">Do wyceny</span>`:(p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:""))}
      ${jestAdmin()?"":`<button class="fav-btn" onclick="event.stopPropagation();przelaczUlubione(${p.id})" aria-label="Ulubione">${ulub?"❤️":"🤍"}</button>`}
      ${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" style="width:100%;height:100%;object-fit:cover;${stan===0?'filter:grayscale(1);opacity:.6':''}" onerror="this.remove();loguj('ostrzezenie','Nie wczytano zdjęcia produktu: ${esc(p.nazwa)}')">`:(p.ikona||"📦")}
    </div>
    <div class="card-body">
      <span class="cat-label">${esc(p.kategoria)}${oceny?` <span style="color:var(--accent);text-transform:none;letter-spacing:0">★ ${oceny.srednia.toFixed(1)} (${oceny.n})</span>`:""}</span>
      <h3>${esc(p.nazwa)}</h3>
      <p class="desc">${esc(skrocTekst(p.opis||"",190))}</p>
      <div class="price-row">
        <span class="price">${brakCeny?"Cena do uzupełnienia":zl(p.cena)}</span>
        ${p.staraCena?`<span class="old-price">${zl(p.staraCena)}</span>`:""}
      </div>
      ${brakCeny?`<p style="font-size:.76rem;color:#c2410c;font-weight:700;margin-bottom:.4rem">Produkt zaimportowany z ceną 0,00 — popraw cenę w panelu</p>`:""}
      ${stan!==null && stan>0 && stan<=3 ? `<p style="font-size:.76rem;color:var(--danger);font-weight:700;margin-bottom:.4rem">🔥 Ostatnie sztuki: ${stan}</p>`:""}
      ${stan===0||brakCeny
        ? `<button class="add-btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
        : p.warianty?.length
          ? `<button class="add-btn" onclick="event.stopPropagation();location.hash='#/produkt/${p.id}'" style="background:var(--brand2)">Wybierz wariant →</button>`
          : `<button class="add-btn" onclick="event.stopPropagation();dodaj(${p.id}, this)">Do koszyka</button>`}
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
      <input placeholder="Szukaj w tej liście…" value="${esc(frazaListyProduktow)}" oninput="frazaListyProduktow=this.value;stronaListyProduktow=1;renderuj()" style="flex:1;min-width:200px;padding:.45rem .7rem;border:1.5px solid var(--line);border-radius:10px">
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
let iloscProduktu = 1;
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
  iloscProduktu = 1;
  const powiazane = produkty.filter(x=>x.kategoria===p.kategoria && x.id!==p.id).slice(0,4);
  const brakCeny = !produktMaCeneSprzedazy(p);
  return `
  <div class="page">
    <div class="crumb"><a href="#/">Sklep</a> › <a href="#/" onclick="ustawKategorie('${esc(p.kategoria)}')">${esc(p.kategoria)}</a> › ${esc(p.nazwa)}</div>
    <div class="panel">
      <div class="prod-detail">
        <div>
          <div class="prod-thumb" style="background:${p.kolor||'#eef2f7'}">
            ${p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:""}
            ${p.zdjecie?`<img id="glowneZdjecie" src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}">`:(p.ikona||"📦")}
          </div>
          ${(p.zdjecie && p.zdjecia?.length)?`
          <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
            ${[p.zdjecie,...p.zdjecia].map((z,i)=>`<img src="${esc(z)}" onclick="pokazZdjecie('${esc(z)}')" style="width:62px;height:62px;object-fit:cover;border-radius:9px;border:2px solid ${i===0?'var(--brand)':'var(--line)'};cursor:pointer" onmouseover="this.style.borderColor='var(--brand)'" onmouseout="this.style.borderColor='var(--line)'">`).join("")}
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
          <p style="color:var(--muted2)">${esc(p.opis||"")}</p>
          ${specyfikacjaProduktuHTML(p)}
          ${p.warianty?.length?`
          <div class="f-group" style="max-width:260px;margin:.6rem 0 0"><label>Wybierz wariant *</label>
            <select id="wariantSel">${p.warianty.map(w=>`<option>${esc(w)}</option>`).join("")}</select>
          </div>`:""}
          <div class="qty-big">
            <button onclick="zmienIloscProd(-1)">−</button>
            <span id="prodQty">1</span>
            <button onclick="zmienIloscProd(1)">+</button>
          </div>
          <div style="display:flex;gap:.7rem;flex-wrap:wrap">
            ${stanProduktu(p)===0||brakCeny
              ? `<button class="btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
              : `<button class="btn" onclick="dodajIlosc(${p.id})">🛒 Do koszyka</button>`}
            ${jestAdmin()?"":`<button class="btn ghost" onclick="przelaczUlubione(${p.id});renderuj()">${ulubione.includes(p.id)?"❤️ W ulubionych":"🤍 Dodaj do ulubionych"}</button>`}
          </div>
          ${(()=>{ const s=stanProduktu(p);
            if(s===0) return `<p style="font-size:.83rem;color:var(--danger);margin-top:1rem;font-weight:600">✖ Chwilowo niedostępny — zajrzyj wkrótce</p>`;
            if(s!==null && s<=3) return `<p style="font-size:.83rem;color:var(--danger);margin-top:1rem;font-weight:600">🔥 Ostatnie sztuki: ${s} • ${esc(tekstWysylki().toLowerCase())}</p>`;
            if(s!==null) return `<p style="font-size:.83rem;color:var(--ok);margin-top:1rem;font-weight:600">✔ Dostępny: ${s} szt. • ${esc(tekstWysylki().toLowerCase())}</p>`;
            return `<p style="font-size:.83rem;color:var(--ok);margin-top:1rem;font-weight:600">✔ Dostępny • ${esc(tekstWysylki().toLowerCase())}</p>`; })()}
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
        <details open><summary>Opis</summary><p>${esc(p.opis||"Szczegółowy opis produktu zostanie wkrótce uzupełniony.")}</p></details>
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
function zmienIloscProd(d){ iloscProduktu=Math.max(1, iloscProduktu+d); const e=$("prodQty"); if(e) e.textContent=iloscProduktu; }
function dodajIlosc(id){
  const wariant = $("wariantSel")?.value || null;
  for(let i=0;i<iloscProduktu;i++) dodaj(id, null, wariant);
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
      <div class="f-group"><label>Hasło (min. 6 znaków)</label><input required name="haslo" type="password" minlength="6" autocomplete="new-password"></div>
      <div class="f-group"><label>Powtórz hasło</label><input required name="haslo2" type="password" minlength="6" autocomplete="new-password"></div>
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
  ustawSesje({imie:f.get("imie").trim(), email:f.get("email").trim().toLowerCase()});
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
      await chmura("store-order-delete-mine",{method:"POST",body:{number:numer,email}});
      serwerOk=true;
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
    <p><i>Szablon regulaminu — sprawdź go prawnie przed startem sprzedaży.</i></p>
    <h2>§1 Postanowienia ogólne</h2><p>Sklep internetowy Artway-TM prowadzony jest przez:<br>${daneFirmyHTML()}<br>Kontakt: ${KONFIG.emailSklepu}, ${KONFIG.telefon}.</p>
    <h2>§2 Zamówienia</h2><p>Zamówienia można składać 24/7 przez stronę. Zawarcie umowy następuje z chwilą potwierdzenia zamówienia przez sklep.</p>
    <h2>§3 Ceny i płatności</h2><p>Ceny są cenami brutto (zawierają VAT). Dostępne formy płatności: ${esc(platnosciOpis())}. Przy przelewie na telefon klient wpisuje w tytule numer zamówienia.</p>
    <h2>§4 Dostawa</h2><p>${esc(tekstWysylki())} w dni robocze. Koszty dostawy podane są w koszyku. Darmowa dostawa od ${KONFIG.darmowaDostawaOd} zł.</p>
    <h2>§5 Zwroty</h2><p>Konsument ma prawo odstąpić od umowy w terminie 14 dni bez podania przyczyny.</p>
    <h2>§6 Reklamacje</h2><p>Reklamacje rozpatrujemy w ciągu 14 dni. Zgłoszenia: ${KONFIG.emailSklepu}.</p>`,"regulamin");
}
function widokPrywatnosc(){
  if(KONFIG.tresci?.prywatnosc) return stronaInfo("🔒 Polityka prywatności (RODO)", KONFIG.tresci.prywatnosc,"prywatnosc");
  return stronaInfo("🔒 Polityka prywatności (RODO)", `
    <p><i>Szablon polityki prywatności — sprawdź go prawnie przed startem sprzedaży.</i></p>
    <h2>Administrator danych</h2><p>${daneFirmyHTML()}. Kontakt: ${KONFIG.emailSklepu}, ${KONFIG.telefon}.</p>
    <h2>Jakie dane zbieramy</h2><p>Dane podane w zamówieniu (imię i nazwisko, adres, e-mail, telefon) — wyłącznie w celu realizacji zamówienia. Dane konta (imię, e-mail) — w celu prowadzenia konta klienta.</p>
    <h2>Twoje prawa</h2><p>Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia. Zgłoszenia: ${KONFIG.emailSklepu}.</p>
    <h2>Pliki cookie i pamięć przeglądarki</h2><p>Strona zapisuje w pamięci przeglądarki: zawartość koszyka, ulubione, dane konta i dziennik błędów — dane te nie opuszczają Twojego urządzenia.</p>`,"prywatnosc");
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
    <h2>Zwrot w 14 dni</h2><p>Możesz odstąpić od umowy w ciągu 14 dni od otrzymania przesyłki bez podania przyczyny. Napisz na ${KONFIG.emailSklepu}, odeślij towar, a my zwrócimy pieniądze w ciągu 14 dni.</p>
    <h2>Reklamacje</h2><p>Jeśli towar ma wadę, przysługuje Ci reklamacja z tytułu rękojmi. Opisz problem i dołącz zdjęcia — odpowiemy w ciągu 14 dni.</p>`,"zwroty");
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
const MENU_ADMINA = [
  ["/admin","📊 Pulpit"], ["/admin/zamowienia","📦 Zamówienia"],
  ["/admin/wysylki","🚚 Centrum wysyłek"],
  ["/admin/asortyment","🏷️ Asortyment"],
  ["/admin/klienci","👥 Klienci"],
  ["/admin/personalizacja","🎨 Personalizacja i ustawienia"],
  ["/admin/eksport","⇄ Import / eksport"], ["/admin/aktualizacja","⬆️ Aktualizacja strony"],
  ["/admin/publikacja","🌍 Publikacja"], ["/diagnostyka","🛠️ Diagnostyka"]
];
function adminSzkielet(aktywna, tresc){
  const powiadomienia = {
    "/admin/zamowienia": pobierzZamowienia().filter(z=>z.status==="nowe").length,
    "/admin/wysylki": pobierzZamowienia().filter(z=>!["anulowane","dostarczone","zakończone"].includes(z.status)&&!z.wysylka?.numer).length,
    "/admin/asortyment": opinie.filter(o=>o.status==="oczekuje").length
  };
  return `
  <div class="admin-page">
    <aside class="admin-nav">${MENU_ADMINA.map(([h,t])=>{
      const n = powiadomienia[h]||0;
      return `<a href="#${h}" class="${aktywna===h?'active':''}">${t}${n?` <span class="nav-badge">${n}</span>`:""}</a>`;
    }).join("")}</aside>
    <div class="admin-tresc">${tresc}</div>
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
function nazwaPrzewoznika(id){ return PRZEWOZNICY[id]?.nazwa || (id?String(id):"nie wybrano"); }
function daneWysylki(z){
  return {
    przewoznik:"", usluga:"", numer:"", trackingUrl:"", status:"nieprzygotowana",
    etap:"", priorytet:"normalny", operator:"", terminNadania:"", przewidywaneDoreczenie:"",
    ostatniaSynchronizacja:"", bladIntegracji:"", waga:"", dlugosc:"", szerokosc:"", wysokosc:"",
    historia:[], powiadomienia:[], zadania:{dane:false,kompletacja:false,etykieta:false,przekazanie:false},
    ...(z?.wysylka||{})
  };
}
function etapWysylki(z){
  const w=daneWysylki(z);
  if(w.etap&&ETAPY_WYSYLKI[w.etap]) return w.etap;
  if(z.status==="anulowane") return "anulowana";
  if(z.status==="zwrot"||z.status==="zwrot pieniędzy") return "zwrot";
  if(z.status==="dostarczone"||z.status==="zakończone") return "dostarczona";
  if(z.status==="w doręczeniu") return "doreczenie";
  if(w.bladIntegracji) return "problem";
  if(z.status==="nadane"||z.status==="wysłane") return w.numer?"transport":"przygotowanie";
  if(w.numer) return "etykieta";
  if(z.status==="w realizacji"||z.status==="gotowe do wysyłki") return "przygotowanie";
  return "do_obslugi";
}
function nazwaEtapu(z){ const e=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi; return `${e.ikona} ${e.nazwa}`; }
function godzinyOd(ts){ return ts?Math.max(0,(Date.now()-Number(ts))/3600000):0; }
function slaWysylki(z){
  const uw=ustawieniaWysylki(), etap=etapWysylki(z);
  if(["dostarczona","anulowana","zwrot"].includes(etap)) return {klasa:"sla-ok",tekst:"zamknięte"};
  if(etap==="problem") return {klasa:"sla-bad",tekst:"wymaga reakcji"};
  const limit=Number(uw.slaNadanie||24), h=godzinyOd(z.ts);
  if(!daneWysylki(z).numer&&h>limit) return {klasa:"sla-bad",tekst:`SLA +${Math.round(h-limit)} h`};
  if(!daneWysylki(z).numer&&h>limit*.75) return {klasa:"sla-warn",tekst:`pozostało ${Math.max(0,Math.round(limit-h))} h`};
  return {klasa:"sla-ok",tekst:daneWysylki(z).numer?"monitorowana":`${Math.max(0,Math.round(limit-h))} h do nadania`};
}
function przewoznikDlaZamowienia(z){
  if(z?.wysylka?.przewoznik) return z.wysylka.przewoznik;
  return "inpost";
}
function czyZamowieniePaczkomat(z){
  return czyDostawaPaczkomat(z?.dostawaId) || !!(z?.paczkomat || z?.wysylka?.punktKod);
}
function uslugaInpostZamowienia(z){
  return uslugaInpostDlaDostawy(czyZamowieniePaczkomat(z) ? "paczkomat" : "kurier_inpost");
}
function normalizujEtapZdarzenia(status){
  const s=String(status||"").toLowerCase();
  if(s.includes("problem")||s.includes("nieud")||s.includes("opóź")) return "problem";
  if(s.includes("zwrot")) return "zwrot";
  if(s.includes("dostarcz")) return "dostarczona";
  if(s.includes("doręcz")) return "doreczenie";
  if(s.includes("drodze")||s.includes("sortown")||s.includes("transport")) return "transport";
  if(s.includes("przyję")||s.includes("przekazan")) return "przekazana";
  return "";
}
function urlSledzenia(z){
  const w=daneWysylki(z), wlasny=String(w.trackingUrl||"").trim();
  if(/^https?:\/\//i.test(wlasny)) return wlasny;
  if(!w.numer) return "";
  return PRZEWOZNICY[w.przewoznik]?.url?.(w.numer)||"";
}
function ustawieniaWysylki(){
  const u = {
    przewoznik:"inpost",waga:"1",dlugosc:"30",szerokosc:"20",wysokosc:"15",
    nadawca:"Artway-TM",ulica:"",kod:"",miasto:"",telefon:KONFIG.telefon,email:KONFIG.emailSklepu,
    regulaPaczkomat:"inpost",regulaKurier:"inpost",slaNadanie:"24",slaDoreczenie:"72",
    apiEndpoint:"api/index.php",tryb:"sandbox",autoStatus:true,autoEmail:true,autoTracking:true,
    alarmSla:true,powiadomieniaWyjatki:true,
    ...(ustawienia.wysylka||{})
  };
  return {...u, przewoznik:"inpost", regulaPaczkomat:"inpost", regulaKurier:"inpost"};
}
function aktualizujZamowienie(nr, zmiana){
  const lista=pobierzZamowienia(), z=lista.find(x=>x.nr===nr);
  if(!z) return null;
  zmiana(z);
  zapiszLS("artway_zamowienia",lista);
  void zapiszZamowienieCentralnie(z,false);
  return z;
}
function zapiszWysylke(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), teraz=new Date().toLocaleString("pl-PL");
  const przewoznik="inpost", numer=String(f.get("numer")||"").trim();
  const punktKod=String(f.get("punktKod")||"").trim().toUpperCase();
  const przed=pobierzZamowienia().find(x=>x.nr===nr), staryNumer=przed?daneWysylki(przed).numer:"";
  const z=aktualizujZamowienie(nr, zam=>{
    const stara=daneWysylki(zam);
    const paczkomat = czyZamowieniePaczkomat(zam);
    const usluga = String(f.get("usluga")||stara.usluga||uslugaInpostZamowienia(zam)).trim() || uslugaInpostZamowienia(zam);
    const zmieniono=stara.numer!==numer||stara.przewoznik!==przewoznik||stara.usluga!==usluga||stara.punktKod!==(paczkomat?punktKod:"");
    if(paczkomat && punktKod) zam.paczkomat=punktKod;
    if(!paczkomat){ zam.paczkomat=""; zam.paczkomatAdres=""; }
    zam.wysylka={...stara,
      przewoznik, usluga, numer, punktKod:paczkomat?(punktKod||stara.punktKod||zam.paczkomat||""):"",
      trackingUrl:String(f.get("trackingUrl")||"").trim(),
      priorytet:String(f.get("priorytet")||stara.priorytet||"normalny"),
      operator:String(f.get("operator")||"").trim(),
      terminNadania:String(f.get("terminNadania")||"").trim(),
      przewidywaneDoreczenie:String(f.get("przewidywaneDoreczenie")||"").trim(),
      waga:String(f.get("waga")||"").trim(), dlugosc:String(f.get("dlugosc")||"").trim(),
      szerokosc:String(f.get("szerokosc")||"").trim(), wysokosc:String(f.get("wysokosc")||"").trim(),
      status:numer?"nadana":"przygotowywana", etap:numer?(stara.etap&&stara.etap!=="do_obslugi"?stara.etap:"etykieta"):"przygotowanie",
      zaktualizowano:new Date().toISOString(),
      zadania:{...(stara.zadania||{}),dane:true,etykieta:!!numer},
      historia:zmieniono?[...(stara.historia||[]),{czas:teraz,status:numer?"Numer nadania zapisany":"Konfiguracja przesyłki",opis:`${nazwaPrzewoznika(przewoznik)}${numer?" • "+numer:""}`}]:stara.historia
    };
    if(numer&&["nowe","potwierdzone","w realizacji"].includes(zam.status)) zam.status="gotowe do wysyłki";
    else if(!numer&&["nowe","potwierdzone","w realizacji"].includes(zam.status)) zam.status="gotowe do wysyłki";
  });
  if(!z) return toast("Nie znaleziono zamówienia");
  loguj("info",`Zapisano przesyłkę ${nr}: ${nazwaPrzewoznika(przewoznik)}${numer?" "+numer:""}`);
  toast("Dane przesyłki zapisane ✅"); renderuj();
  // E-mail „nadanie" wysyła się automatycznie z serwera po zapisaniu numeru nadania (awaryjnie z panelu, gdy baza offline)
  if(numer&&numer!==staryNumer&&!chmuraToken) void obsluzAutomatycznyEmail(nr,z.status,"nadanie");
}
function uzupelnijUslugi(select){
  const form=select.form, uslugi=PRZEWOZNICY[select.value]?.uslugi||[];
  form.usluga.innerHTML=uslugi.map(x=>`<option>${esc(x)}</option>`).join("");
}
function dodajZdarzenieWysylki(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), status=String(f.get("status")||""), opis=String(f.get("opis")||"").trim();
  let statusZamowienia="", typEmaila="";
  aktualizujZamowienie(nr,z=>{
    const w=daneWysylki(z);
    w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status,opis}];
    w.status=status.toLowerCase(); w.etap=normalizujEtapZdarzenia(status)||w.etap;
    w.bladIntegracji=w.etap==="problem"?(opis||status):"";
    w.ostatniaSynchronizacja=new Date().toISOString(); w.zaktualizowano=new Date().toISOString(); z.wysylka=w;
    const mapa={"Przekazana do InPost":"nadane","Przyjęta przez InPost":"nadane","W sortowni":"nadane","W drodze":"nadane","W doręczeniu":"w doręczeniu","Dostarczona":"dostarczone","Zwrot do nadawcy":"zwrot"};
    if(mapa[status]){z.status=mapa[status];statusZamowienia=mapa[status];}
    if(w.etap==="problem") typEmaila="problem";
  });
  loguj("info",`Dodano zdarzenie przesyłki ${nr}: ${status}`);
  toast("Zdarzenie dodane"); renderuj();
  // E-mail (nadanie/dostarczenie/zwrot/problem) wysyła się automatycznie z serwera po zapisaniu zdarzenia; awaryjnie z panelu przy braku bazy
  if((statusZamowienia||typEmaila)&&!chmuraToken) void obsluzAutomatycznyEmail(nr,statusZamowienia,typEmaila);
}
function trescPowiadomienia(z,typ){
  const w=daneWysylki(z), klient=z.klient||{}, imie=klient.imie||"";
  const powitanie=`Dzień dobry${imie?", "+imie:""},`;
  const sledzenie=urlSledzenia(z);
  const pozycje=Array.isArray(z.pozycje)&&z.pozycje.length?`\n\nZamówione produkty:\n${z.pozycje.map(p=>`• ${p}`).join("\n")}`:"";
  const podsumowanie=`\n\n${podsumowanieKosztowTekst(z)}\nPłatność: ${z.platnosc||"—"}`;
  const stopka=`\n\nPozdrawiamy\n${KONFIG.nazwaSklepu}\n${KONFIG.emailSklepu}`;
  const warianty={
    potwierdzenie:{temat:`Potwierdzenie zamówienia ${z.nr}`,body:`${powitanie}\n\npotwierdzamy przyjęcie zamówienia ${z.nr}.${pozycje}${podsumowanie}`},
    przygotowanie:{temat:`Zamówienie ${z.nr} jest przygotowywane`,body:`${powitanie}\n\nTwoje zamówienie ${z.nr} jest obecnie przygotowywane do wysyłki.${podsumowanie}`},
    nadanie:{temat:`Zamówienie ${z.nr} zostało nadane`,body:`${powitanie}\n\nprzesyłka dla zamówienia ${z.nr} została nadana przez ${nazwaPrzewoznika(w.przewoznik)}.${w.numer?`\nNumer przesyłki: ${w.numer}`:""}${sledzenie?`\nŚledzenie: ${sledzenie}`:""}`},
    dostarczenie:{temat:`Zamówienie ${z.nr} zostało dostarczone`,body:`${powitanie}\n\nprzesyłka dla zamówienia ${z.nr} została oznaczona jako dostarczona. Dziękujemy za zakupy.`},
    anulowanie:{temat:`Aktualizacja zamówienia ${z.nr}`,body:`${powitanie}\n\nzamówienie ${z.nr} zostało anulowane. W razie pytań odpowiedz na tę wiadomość.`},
    zwrot:{temat:`Zwrot przesyłki dla zamówienia ${z.nr}`,body:`${powitanie}\n\nprzesyłka dla zamówienia ${z.nr} została oznaczona jako zwrot do nadawcy. Skontaktujemy się w sprawie dalszych kroków.`},
    zwrot_pieniedzy:{temat:`Zwrot pieniędzy za zamówienie ${z.nr}`,body:`${powitanie}\n\nzwróciliśmy pieniądze za zamówienie ${z.nr}.\nKwota zwrotu: ${zl(z.razem)}\nŚrodki wrócą na Twoje konto w ciągu kilku dni roboczych, zależnie od banku.`},
    problem:{temat:`Ważna informacja o przesyłce ${z.nr}`,body:`${powitanie}\n\nprzewoźnik zgłosił problem dotyczący przesyłki dla zamówienia ${z.nr}. Monitorujemy sytuację i przekażemy kolejną informację po jej wyjaśnieniu.${w.numer?`\nNumer przesyłki: ${w.numer}`:""}${sledzenie?`\nŚledzenie: ${sledzenie}`:""}`}
  };
  const p=warianty[typ]||warianty.potwierdzenie;
  const body=p.body+stopka;
  return {temat:p.temat,body,html:htmlPowiadomieniaKlienta(z,typ,p.temat,body)};
}
function produktyEmailHtmlKlient(z){
  const dane=Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
    ? z.pozycjeDane.map(p=>({nazwa:p.nazwa||"Produkt",ilosc:Number(p.ilosc)||1,wartosc:Number(p.wartosc)||((Number(p.cena)||0)*(Number(p.ilosc)||1)),sku:p.sku||""}))
    : (Array.isArray(z.pozycje)?z.pozycje.map(p=>({nazwa:p,ilosc:1,wartosc:0,sku:""})):[]);
  if(!dane.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff">
    <thead><tr style="background:#f8fafc;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">
      <th align="left" style="padding:10px">Produkt</th><th align="center" style="padding:10px;width:70px">Ilość</th><th align="right" style="padding:10px;width:120px">Wartość</th>
    </tr></thead>
    <tbody>${dane.map(p=>`<tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb"><b>${esc(p.nazwa)}</b>${p.sku?`<br><span style="font-size:12px;color:#6b7280">SKU: ${esc(p.sku)}</span>`:""}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${p.ilosc}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800">${p.wartosc?zl(p.wartosc):"—"}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}
function htmlPowiadomieniaKlienta(z,typ,temat,body){
  const w=daneWysylki(z), klient=z.klient||{}, imie=klient.imie||"";
  const sledzenie=urlSledzenia(z);
  const statusy={
    potwierdzenie:["Dziękujemy za zakupy","Przyjęliśmy zamówienie i mamy wszystkie najważniejsze dane. Będziemy informować o kolejnych etapach realizacji.","#2563eb"],
    przygotowanie:["Zamówienie jest przygotowywane","Kompletujemy produkty i przygotowujemy paczkę do wysyłki.","#7c3aed"],
    nadanie:["Paczka została nadana","Przesyłka jest już w InPost. Możesz śledzić jej drogę do Ciebie.","#059669"],
    dostarczenie:["Dziękujemy — przesyłka dostarczona","Mamy nadzieję, że zakupy sprawią dużo satysfakcji. Zapraszamy ponownie do Artway-TM.","#16a34a"],
    anulowanie:["Aktualizacja zamówienia","Zamówienie zostało anulowane. Jeśli to pomyłka lub masz pytania, odpowiedz na tę wiadomość.","#dc2626"],
    zwrot:["Informacja o zwrocie","Przesyłka została oznaczona jako zwrot. Skontaktujemy się w sprawie dalszych kroków.","#ea580c"],
    zwrot_pieniedzy:["Zwróciliśmy Ci pieniądze","Zwrot środków został zainicjowany. Pieniądze wrócą na Twoje konto w ciągu kilku dni roboczych.","#0ea5e9"],
    problem:["Ważna informacja o przesyłce","Przewoźnik zgłosił problem. Monitorujemy sytuację i przekażemy kolejną informację po wyjaśnieniu.","#dc2626"]
  };
  const [naglowek,opis,kolor]=statusy[typ]||statusy.potwierdzenie;
  const sklepUrl=location.origin+"/#/";
  const zamUrl=location.origin+"/#/zamowienia";
  const karta=(tytul,tresc,accent="#2563eb")=>`<div style="border:1px solid #e5e7eb;border-left:5px solid ${accent};border-radius:16px;background:#ffffff;padding:16px;margin:14px 0">
    <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:6px">${esc(tytul)}</div>
    <div style="color:#111827;font-size:15px;line-height:1.6">${tresc}</div>
  </div>`;
  const przycisk=(label,url,bg="#2563eb")=>`<a href="${esc(url)}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 20px;margin:4px 8px 4px 0">${esc(label)}</a>`;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(temat)}</title></head>
  <body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opis)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:26px 10px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(37,99,235,.14)">
        <tr><td style="background:linear-gradient(135deg,#2563eb,#6d28d9);padding:28px;color:#fff">
          <div style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">Artway-TM</div>
          <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.18">${esc(naglowek)}</h1>
          <p style="margin:0;font-size:16px;line-height:1.55;opacity:.96">Dzień dobry${imie?", "+esc(imie):""}. ${esc(opis)}</p>
        </td></tr>
        <tr><td style="padding:26px 28px">
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:18px;padding:14px 16px;margin-bottom:16px;color:#78350f">
            <b>Zamówienie:</b> ${esc(z.nr)} &nbsp; • &nbsp; <b>Kwota:</b> ${zl(z.razem)}
          </div>
          ${karta("Status", esc(body).replace(/\n/g,"<br>"), kolor)}
          ${karta("Podsumowanie kosztów", podsumowanieKosztowTekst(z).split("\n").map(esc).join("<br>"), "#f59e0b")}
          ${w.numer||sledzenie?karta("Śledzenie", `${w.numer?`Numer przesyłki: <b>${esc(w.numer)}</b><br>`:""}${sledzenie?`Link śledzenia: <a href="${esc(sledzenie)}" style="color:#2563eb;font-weight:800">${esc(sledzenie)}</a>`:""}`,"#059669"):""}
          ${produktyEmailHtmlKlient(z)?`<h2 style="font-size:18px;margin:22px 0 10px;color:#111827">Produkty</h2>${produktyEmailHtmlKlient(z)}`:""}
          <div style="margin:22px 0 8px">${przycisk("Moje zamówienia",zamUrl)}${przycisk("Wróć do sklepu",sklepUrl,"#111827")}</div>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:18px 0 0">Dziękujemy za zaufanie. Zapraszamy ponownie — w sklepie czekają kolejne produkty i okazje.</p>
        </td></tr>
        <tr><td style="background:#111827;color:#d1d5db;padding:20px 28px;font-size:13px;line-height:1.55"><b style="color:#fff">${esc(KONFIG.nazwaSklepu)}</b><br>${esc(KONFIG.emailSklepu)}<br>Wiadomość wysłana automatycznie.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}
const NAZWY_EMAILI={potwierdzenie:"Potwierdzenie",przygotowanie:"Przygotowanie",nadanie:"Nadanie",dostarczenie:"Dostarczenie",anulowanie:"Anulowanie",zwrot:"Zwrot",zwrot_pieniedzy:"Zwrot pieniędzy",problem:"Problem z przesyłką"};
function zapiszHistorieEmaila(nr,wpis){
  aktualizujZamowienie(nr,zam=>{
    const w=daneWysylki(zam);
    w.powiadomienia=[...(w.powiadomienia||[]),{czas:new Date().toLocaleString("pl-PL"),...wpis}];
    zam.wysylka=w;
  });
}
function otworzEmailWysylki(nr,typ){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.email){ toast("Brak adresu e-mail klienta"); return; }
  const p=trescPowiadomienia(z,typ);
  zapiszHistorieEmaila(nr,{typ,status:"otwarto szkic"});
  loguj("info",`Otwarto szkic e-maila ${typ} dla ${nr}`);
  location.href=`mailto:${z.email}?subject=${encodeURIComponent(p.temat)}&body=${encodeURIComponent(p.body)}`;
}
async function wyslijEmailWysylki(nr,typ,automatycznie=false){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.email){toast("Brak adresu e-mail klienta");return false;}
  if(!stanBramki.email?.configured){
    if(!automatycznie) toast("Najpierw skonfiguruj SMTP/Gmail w zmiennych Netlify");
    return false;
  }
  if(!chmuraToken){
    if(!automatycznie) chmuraUstawToken();
    return false;
  }
  if(!automatycznie&&!confirm(`Wysłać „${NAZWY_EMAILI[typ]||typ}” na ${z.email} przez API?`)) return false;
  try{
    // Ten sam, jednolity szablon co potwierdzenie zakupu — budowany po stronie serwera
    const d=await chmura("send-status-email",{method:"POST",body:{nr,typ},timeout:18000});
    if(Array.isArray(d.powiadomienia)){ aktualizujZamowienie(nr,zam=>{ zam.wysylka=zam.wysylka||{}; zam.wysylka.powiadomienia=d.powiadomienia; }); }
    else { zapiszHistorieEmaila(nr,{typ,status:"wysłano",provider:d.provider||stanBramki.email.provider||"",id:d.message_id||"",automatyczne:automatycznie}); }
    loguj("info",`${automatycznie?"Automatycznie wysłano":"Wysłano"} e-mail ${typ} dla ${nr} przez ${d.provider||"API"}`);
    toast(`${automatycznie?"Automatyczny e-mail":"E-mail"} wysłany ✅`);
    renderuj();
    return true;
  }catch(bl){
    zapiszHistorieEmaila(nr,{typ,status:"błąd wysyłki",blad:bl.message,automatyczne:automatycznie});
    loguj("error",`Błąd e-maila ${typ} dla ${nr}: ${bl.message}`);
    toast("Nie wysłano e-maila: "+bl.message);
    renderuj();
    return false;
  }
}
function typEmailaDlaStatusu(status){
  return {
    "potwierdzone":"potwierdzenie","w realizacji":"przygotowanie","gotowe do wysyłki":"przygotowanie",
    "nadane":"nadanie","wysłane":"nadanie","dostarczone":"dostarczenie","zakończone":"dostarczenie",
    "zwrot":"zwrot","zwrot pieniędzy":"zwrot_pieniedzy","anulowane":"anulowanie"
  }[status]||"";
}
async function obsluzAutomatycznyEmail(nr,status,typWymuszony=""){
  if(!ustawieniaWysylki().autoEmail) return;
  const typ=typWymuszony||typEmailaDlaStatusu(status);
  if(!typ) return;
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.email) return;
  const historia=daneWysylki(z).powiadomienia||[];
  if(historia.some(p=>p.typ===typ&&p.status==="wysłano")) return;
  if(!stanBramki.email?.configured||!chmuraToken){
    const istnieje=historia.some(p=>p.typ===typ&&String(p.status).startsWith("oczekuje"));
    if(!istnieje) zapiszHistorieEmaila(nr,{typ,status:"oczekuje — skonfiguruj SMTP / połącz bazę",automatyczne:true});
    renderuj();
    return;
  }
  await wyslijEmailWysylki(nr,typ,true);
}
async function wyslijTestEmail(e){
  e.preventDefault();
  const email=String(new FormData(e.target).get("email")||"").trim();
  if(!stanBramki.email?.configured) return toast("Skonfiguruj SMTP/Gmail w Netlify");
  if(!chmuraToken){ chmuraUstawToken(); return; }
  if(!confirm(`Wysłać testową wiadomość na ${email}?`)) return;
  try{
    const html=`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test e-mail Artway-TM</title></head>
      <body style="margin:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#111827">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:26px 10px"><tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(37,99,235,.14)">
          <tr><td style="background:linear-gradient(135deg,#2563eb,#6d28d9);padding:28px;color:#fff">
            <div style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">${esc(KONFIG.nazwaSklepu)}</div>
            <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.18">Test automatycznych wiadomości działa</h1>
            <p style="margin:0;font-size:16px;line-height:1.55;opacity:.96">Tak będą wyglądać eleganckie wiadomości wysyłane klientom po zakupie i podczas obsługi zamówienia.</p>
          </td></tr>
          <tr><td style="padding:26px 28px">
            <div style="border:1px solid #e5e7eb;border-left:5px solid #10b981;border-radius:16px;background:#fff;padding:16px;margin:14px 0">
              <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:6px">Status</div>
              <div style="font-size:15px;line-height:1.6">Konfiguracja Gmail SMTP i Netlify działa poprawnie. Wiadomości są teraz czytelne, estetyczne i zachęcają klienta do dalszych zakupów.</div>
            </div>
            <a href="${location.origin}/#/" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 20px;margin-top:10px">Wróć do sklepu</a>
            <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:18px 0 0">To jest test z panelu administracyjnego ${esc(KONFIG.nazwaSklepu)}.</p>
          </td></tr>
          <tr><td style="background:#111827;color:#d1d5db;padding:20px 28px;font-size:13px;line-height:1.55"><b style="color:#fff">${esc(KONFIG.nazwaSklepu)}</b><br>${esc(KONFIG.emailSklepu)}</td></tr>
        </table>
      </td></tr></table></body></html>`;
    const d=await chmura("send-email",{method:"POST",body:{to:email,subject:`Test automatycznych e-maili — ${KONFIG.nazwaSklepu}`,text:`To jest test poprawnej konfiguracji automatycznych wiadomości API sklepu ${KONFIG.nazwaSklepu}. Wiadomości mają teraz elegancki wygląd HTML.`,html},timeout:18000});
    loguj("info",`Wysłano test e-mail przez ${d.provider||"API"}`);
    toast("Testowy e-mail wysłany ✅");
  }catch(bl){loguj("error","Test e-mail: "+bl.message);toast("Test e-mail nieudany: "+bl.message);}
}
function drukujEtykieteRobocza(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z) return toast("Nie znaleziono zamówienia");
  const w=daneWysylki(z), k=z.klient||{}, adres=z.adresDostawy||{};
  const adresPelny=adres.ulica?`${adres.ulica} ${adres.nrDomu||""}${adres.nrLokalu?"/"+adres.nrLokalu:""}, ${adres.kod||""} ${adres.miasto||""}`:(z.adres||"—");
  const obszar=$("obszarWydruku");
  obszar.innerHTML=`
    <div style="font-family:Arial,sans-serif;width:100mm;min-height:145mm;margin:0 auto;padding:8mm;border:2px solid #111;color:#111;box-sizing:border-box">
      <div style="font-size:10px;font-weight:800;border:2px solid #111;padding:4px;text-align:center">ETYKIETA ROBOCZA — NIE ZASTĘPUJE OFICJALNEJ ETYKIETY PRZEWOŹNIKA</div>
      <div style="display:flex;justify-content:space-between;margin:10px 0;border-bottom:1px solid #111;padding-bottom:8px">
        <b>${esc(nazwaPrzewoznika(w.przewoznik))}</b><b>${esc(z.nr)}</b>
      </div>
      <small>ODBIORCA</small>
      <div style="font-size:19px;font-weight:800;margin:5px 0">${esc([k.imie,k.nazwisko].filter(Boolean).join(" ")||z.email||"Klient")}</div>
      <div style="font-size:16px;line-height:1.45">${esc(adresPelny)}</div>
      ${k.telefon?`<div style="margin-top:5px">Tel. ${esc(k.telefon)}</div>`:""}
      ${z.paczkomat?`<div style="font-size:20px;font-weight:800;margin-top:12px;border:2px solid #111;padding:6px">PUNKT: ${esc(z.paczkomat)}</div>`:""}
      <div style="margin-top:16px;border-top:1px solid #111;padding-top:8px"><small>NUMER PRZESYŁKI</small>
        <div style="font-size:22px;letter-spacing:1px;font-weight:800;word-break:break-all">${esc(w.numer||"BRAK — UZUPEŁNIJ W PANELU")}</div>
      </div>
      <div style="margin-top:14px;font-size:12px">Usługa: ${esc(w.usluga||"—")}<br>Paczka: ${esc(w.waga||"—")} kg • ${esc(w.dlugosc||"—")} × ${esc(w.szerokosc||"—")} × ${esc(w.wysokosc||"—")} cm</div>
      <div style="margin-top:15px;font-size:11px;color:#555">Nadawca: ${esc(ustawieniaWysylki().nadawca)} • ${esc(ustawieniaWysylki().email)}</div>
    </div>`;
  document.body.classList.add("drukowanie");
  loguj("info","Wydrukowano etykietę roboczą "+nr);
  window.print();
  setTimeout(()=>{document.body.classList.remove("drukowanie");obszar.innerHTML="";},400);
}
function zapiszUstawieniaWysylki(e){
  e.preventDefault();
  const f=new FormData(e.target), obj={};
  for(const [k,v] of f.entries()) obj[k]=String(v).trim();
  for(const k of String(e.target.dataset.flagi||"").split(",").filter(Boolean)) obj[k]=f.has(k);
  obj.przewoznik="inpost";
  obj.regulaPaczkomat="inpost";
  obj.regulaKurier="inpost";
  zapiszCzescUstawien({wysylka:{...ustawieniaWysylki(),...obj}});
}
let stanBramki={sprawdzono:false,online:false,configured:false,ready:false,authenticated:false,error:"",organizations:[],email:{configured:false,provider:null},store:{configured:false,writable:false,orders:0,users:0},inpost:{configured:false,geowidgetConfigured:false,env:"production"}};
function urlBramki(action,parametry={}){
  const baza=String(ustawieniaWysylki().apiEndpoint||"api/index.php").trim();
  const url=new URL(baza,location.href);
  if(url.origin!==location.origin) throw new Error("Bramka musi działać w tej samej domenie co sklep.");
  url.searchParams.set("action",action);
  for(const [k,v] of Object.entries(parametry)) if(v!==undefined&&v!==null&&v!=="") url.searchParams.set(k,String(v));
  return url.toString();
}
async function wywolajBramke(action,{method="GET",body=null,parametry={}}={}){
  const opcje={method,credentials:"same-origin",headers:{"Accept":"application/json"}};
  if(body!==null){opcje.headers["Content-Type"]="application/json";opcje.body=JSON.stringify(body);}
  const r=await fetch(urlBramki(action,parametry),opcje);
  const tekst=await r.text(); let dane;
  try{dane=JSON.parse(tekst);}catch(e){throw new Error(r.ok?"Serwer nie uruchomił PHP dla katalogu api.":"Bramka zwróciła nieprawidłową odpowiedź.");}
  if(!r.ok||dane.ok===false){const blad=new Error(dane.error||`Błąd bramki HTTP ${r.status}`);blad.code=dane.code||"";blad.status=r.status;throw blad;}
  return dane;
}
function polaczUzytkownikowCentralnych(serwerowi){
  const lokalni=pobierzUzytkownikow(), mapa=new Map(lokalni.map(u=>[u.email,u]));
  const wynik=(serwerowi||[]).map(u=>({...mapa.get(u.email),...u}));
  for(const u of lokalni) if(!wynik.some(x=>x.email===u.email)) wynik.push(u);
  return wynik;
}
async function synchronizujBazeCentralna(cicho=false){
  if(stanBazyCentralnej.synchronizacja) return false;
  if(!chmuraToken){ if(!cicho) chmuraUstawToken(); return false; }
  stanBazyCentralnej={...stanBazyCentralnej,synchronizacja:true};
  try{
    const d=await chmura("store-sync",{method:"POST",body:{orders:pobierzZamowienia(),users:pobierzUzytkownikow(),deleted_orders:zamowieniaUsuniete}});
    if(Array.isArray(d.deleted_orders)) scalUsunieteZamowienia(d.deleted_orders);
    zapiszLS("artway_zamowienia",Array.isArray(d.orders)?filtrujAktywneZamowienia(d.orders):[]);
    zapiszLS("artway_uzytkownicy",polaczUzytkownikowCentralnych(d.users));
    stanBazyCentralnej={sprawdzono:true,online:true,synchronizacja:false,orders:d.orders?.length||0,users:d.users?.length||0,updatedAt:d.updated_at||null,error:""};
    chmuraStan={...chmuraStan,dostepna:true,admin:true,updated_at:d.updated_at||chmuraStan.updated_at};
    if(!cicho) toast(`Wspólna baza zsynchronizowana ✅ (${stanBazyCentralnej.orders} zamówień)`);
    if(!cicho) renderuj();
    return true;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,synchronizacja:false,error:bl.message};
    if(bl.code==="auth"){ chmuraStan={...chmuraStan,admin:false}; if(!cicho) toast("Hasło bazy nieprawidłowe — wpisz je ponownie"); }
    else if(!cicho) toast("Błąd wspólnej bazy: "+bl.message);
    return false;
  }
}
async function pobierzMojeZamowieniaCentralne(cicho=false){
  if(!sesja||jestAdmin()) return false;
  try{
    const d=await chmura("store-orders-mine",{params:{email:sesja.email}});
    const pozostale=pobierzZamowienia().filter(z=>z.email!==sesja.email);
    zapiszLS("artway_zamowienia",[...filtrujAktywneZamowienia(d.orders||[]),...pozostale]);
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    if(!cicho){toast("Pobrano zamówienia ze wspólnej bazy ✅");renderuj();}
    return true;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
    return false;
  }
}
async function zapiszZamowienieCentralnie(z,publiczne=false){
  if(czyZamowienieUsuniete(z?.nr)) return false;
  try{
    const action=publiczne?"store-order-create":"store-order-save";
    if(!publiczne&&!chmuraToken) return false;
    const d=await chmura(action,{method:"POST",body:{order:z}});
    if(d?.deleted){ oznaczZamowienieUsuniete(z.nr,{by:"server"}); zapiszLS("artway_zamowienia",pobierzZamowienia()); return false; }
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    chmuraStan={...chmuraStan,dostepna:true};
    // serwer wysyła automatyczne e-maile statusowe — wczytaj świeżą historię powiadomień
    if(!publiczne && d && Array.isArray(d.powiadomienia)){
      const lista=pobierzZamowienia(), lokalny=lista.find(x=>x.nr===z.nr);
      if(lokalny){ lokalny.wysylka=lokalny.wysylka||{}; lokalny.wysylka.powiadomienia=d.powiadomienia; zapiszLS("artway_zamowienia",lista); if(typeof renderuj==="function") renderuj(); }
    }
    return d;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
    loguj("blad",`Wspólna baza — zamówienie ${z?.nr||""}: ${bl.message}`);
    return false;
  }
}
async function zapiszUzytkownikaCentralnie(u){
  try{
    const action=chmuraToken?"store-user-save":"account-profile-save";
    await chmura(action,{method:"POST",body:{user:u}});
    return true;
  }catch(bl){ return false; }
}
async function odtworzSesjeCentralna(){
  try{
    if(chmuraToken){ await synchronizujBazeCentralna(true); }
    else if(sesja && !jestAdmin()){ await pobierzMojeZamowieniaCentralne(true); }
  }catch(e){}
}
function odswiezPoCichejSynchronizacji(){
  if(typeof document!=="undefined" && document.hidden) return;
  const aktywny=document.activeElement, tag=aktywneTag => aktywneTag && ["INPUT","TEXTAREA","SELECT"].includes(aktywneTag.tagName);
  if(tag(aktywny)) return;
  const t=trasa();
  const odswiezane=["/admin","/admin/zamowienia","/admin/wysylki","/zamowienia"];
  if(!odswiezane.some(x=>t===x || (x==="/admin/wysylki"&&t.startsWith("/admin/zamowienie/")))) return;
  const y=window.scrollY||0;
  renderuj();
  setTimeout(()=>window.scrollTo({top:y}),0);
}
async function automatycznaSynchronizacjaChmury(powod="timer"){
  if(chmuraAutoSyncBusy) return false;
  if(typeof document!=="undefined" && document.hidden && powod==="timer") return false;
  chmuraAutoSyncBusy=true;
  try{
    let ok=false;
    if(chmuraToken){
      ok = await synchronizujBazeCentralna(true);
      await chmuraWczytajStan();
    }else{
      ok = await chmuraWczytajStan();
      if(sesja && !jestAdmin()) ok = (await pobierzMojeZamowieniaCentralne(true)) || ok;
    }
    if(ok){
      zastosujUstawienia(); zbudujProdukty(); odswiezMenu(); odswiezKoszyk();
      odswiezPoCichejSynchronizacji();
    }
    return ok;
  }catch(e){ return false; }
  finally{ chmuraAutoSyncBusy=false; }
}
function uruchomAutoSynchronizacjeChmury(){
  if(chmuraTimerAutoSync) clearInterval(chmuraTimerAutoSync);
  chmuraTimerAutoSync=setInterval(()=>automatycznaSynchronizacjaChmury("timer"),CHMURA_AUTO_SYNC_MS);
  window.addEventListener("focus",()=>automatycznaSynchronizacjaChmury("focus"));
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) automatycznaSynchronizacjaChmury("visible"); });
}
async function sprawdzBramke(cicho=false){
  try{
    const cloud=await chmura("health",{timeout:9000});
    stanBramki={...stanBramki,sprawdzono:true,online:true,email:cloud.email||stanBramki.email,store:cloud.store||stanBramki.store,inpost:cloud.inpost||stanBramki.inpost,error:""};
    if(cloud.inpost) INPOST_PUBLIC=cloud.inpost;
    if(cloud.store) stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,orders:cloud.store.orders||0,users:cloud.store.users||0,updatedAt:cloud.store.settings_updated_at||cloud.store.updated_at||null,error:""};
    if(!cicho){
      const ip=cloud.inpost||{};
      const czesci=[];
      czesci.push("Netlify Functions działa ✅");
      czesci.push(cloud.email?.configured?`SMTP ${cloud.email.provider||""} gotowy`:"SMTP do konfiguracji");
      czesci.push(ip.configured?`InPost ShipX gotowy (${ip.env||"production"})`:`InPost: brakuje ${(ip.missingEnv&&ip.missingEnv.length?ip.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")}`);
      if(!ip.geowidgetConfigured) czesci.push("mapa paczkomatów: brak INPOST_GEOWIDGET_TOKEN");
      toast(czesci.join(" • "));
    }
    if(trasa()==="/admin/wysylki"||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy") renderuj();
    return;
  }catch(e){ /* Netlify może być chwilowo niedostępne — niżej próbujemy awaryjny backend PHP */ }
  try{
    const d=await wywolajBramke("health");
    stanBramki={...stanBramki,...d,email:d.email||stanBramki.email,store:d.store||stanBramki.store,sprawdzono:true,online:true,error:""};
    if(!cicho) toast(d.ready?"Awaryjna bramka PHP gotowa ✅":d.configured?"Awaryjna bramka PHP skonfigurowana":"Bramka InPost wymaga konfiguracji");
  }catch(e){
    stanBramki={...stanBramki,sprawdzono:true,online:false,error:e.message};
    if(!cicho) toast("Bramka niedostępna — sprawdź Netlify Functions");
  }
  if(trasa()==="/admin/wysylki"||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy") renderuj();
}
async function polaczBramke(e){
  e.preventDefault();
  const f=new FormData(e.target), haslo=String(f.get("apiPassword")||"");
  try{
    await wywolajBramke("login",{method:"POST",body:{password:haslo}});
    e.target.reset(); await sprawdzBramke(true);
    await synchronizujBazeCentralna(true);
    toast("Sesja integracji połączona ✅");
  }catch(bl){stanBramki={...stanBramki,error:bl.message};toast("Nie udało się połączyć: "+bl.message);renderuj();}
}
async function rozlaczBramke(){
  try{await wywolajBramke("logout",{method:"POST",body:{}});}catch(e){}
  stanBramki={sprawdzono:true,online:true,configured:stanBramki.configured,ready:stanBramki.ready,authenticated:false,error:"",organizations:[],email:stanBramki.email||{configured:false,provider:null}};
  toast("Rozłączono sesję integracji");renderuj();
}
async function testujInPost(){
  try{
    const cfg=await pobierzInpostConfig(true);
    stanBramki={...stanBramki,inpost:cfg||stanBramki.inpost};
    if(!chmuraToken){ toast("Wpisz hasło bazy administratora, aby wykonać realny test tokenu InPost"); chmuraUstawToken(); return; }
    const d=await chmura("inpost-test",{timeout:15000});
    const ip=d.inpost||cfg||{};
    stanBramki={...stanBramki,inpost:ip,error:""};
    const org=ip.organization?.id?` • organizacja ${ip.organization.id}`:"";
    const uslugi=ip.organization?.services?.length?` • usługi: ${ip.organization.services.slice(0,3).join(", ")}`:"";
    const av=ip.serviceAvailability||{};
    const uwagaPaczkomat=av.locker===false?` • paczkomat ${av.lockerService||"inpost_locker_standard"} wymaga włączenia`:"";
    const uwagaKurier=av.courier===false?` • kurier ${av.courierService||"inpost_courier_standard"} wymaga włączenia`:"";
    toast(`InPost ShipX połączony ✅ (${ip.env||"production"})${org}${ip.geowidgetConfigured?" • mapa aktywna":" • brak tokenu Geowidget"}${uslugi}${uwagaPaczkomat}${uwagaKurier}`);
    renderuj();
  }catch(bl){
    const ip=bl.inpost||stanBramki.inpost||{};
    stanBramki={...stanBramki,inpost:ip,error:bl.message};
    if(bl.code==="inpost_not_configured") toast("InPost niegotowy — brakuje: "+((bl.missingEnv&&bl.missingEnv.length?bl.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")));
    else toast("Test InPost: "+bl.message);
    renderuj();
  }
}
function b64toBlob(b64,typ="application/pdf"){
  const bin=atob(String(b64||"")); const len=bin.length; const arr=new Uint8Array(len);
  for(let i=0;i<len;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:typ});
}
async function zapiszFormularzWysylkiPrzedAPI(nr){
  const form=[...document.forms].find(f=>(String(f.getAttribute("onsubmit")||"").includes(nr) && (f.querySelector('[name="usluga"]')||f.querySelector('[name="dostawaTyp"]')) && f.querySelector('[name="waga"]')));
  if(!form) return null;
  const f=new FormData(form);
  const zapisane=aktualizujZamowienie(nr,zam=>{
    const stareRazem=kwotaNum(zam.razem);
    const w=daneWysylki(zam);
    const typ=String(f.get("dostawaTyp")||zam.dostawaId||"").trim();
    const paczkomat=typ ? typ!=="kurier_inpost" : czyZamowieniePaczkomat(zam);
    const punktKod=String(f.get("punktKod")||f.get("paczkomat")||"").trim().toUpperCase();
    if(typ==="paczkomat"||typ==="kurier_inpost"){ zam.dostawaId=typ; zam.dostawa=typ==="paczkomat"?"Paczkomat InPost 24/7":"Kurier InPost"; }
    if(paczkomat&&punktKod) zam.paczkomat=punktKod;
    if(!paczkomat){ zam.paczkomat=""; zam.paczkomatAdres=""; }
    const uslugaZTypu=typ==="kurier_inpost"?"Kurier InPost":uslugaInpostZamowienia(zam);
    const pobranieForm=String(f.get("pobranie")||w.pobranie||"").trim();
    const paczkaWeekendForm=f.has("paczkaWeekend") ? String(f.get("paczkaWeekend")||"").trim()==="tak" : !!(w.paczkaWeekend||zam.paczkaWeekend);
    zam.wysylka={...w,
      przewoznik:"inpost",
      usluga:String(f.get("usluga")||w.usluga||uslugaZTypu).trim()||uslugaZTypu,
      punktKod:paczkomat?(punktKod||w.punktKod||zam.paczkomat||""):"",
      numer:String(f.get("numer")||w.numer||"").trim(),
      trackingUrl:String(f.get("trackingUrl")||w.trackingUrl||"").trim(),
      priorytet:String(f.get("priorytet")||w.priorytet||"normalny"),
      operator:String(f.get("operator")||w.operator||"").trim(),
      terminNadania:String(f.get("terminNadania")||w.terminNadania||"").trim(),
      przewidywaneDoreczenie:String(f.get("przewidywaneDoreczenie")||w.przewidywaneDoreczenie||"").trim(),
      waga:String(f.get("waga")||w.waga||"").trim(),
      dlugosc:String(f.get("dlugosc")||w.dlugosc||"").trim(),
      szerokosc:String(f.get("szerokosc")||w.szerokosc||"").trim(),
      wysokosc:String(f.get("wysokosc")||w.wysokosc||"").trim(),
      ochrona:String(f.get("ochrona")||w.ochrona||"").trim(),
      pobranie:pobranieForm,
      paczkaWeekend:paczkaWeekendForm,
      formatEtykiety:String(f.get("formatEtykiety")||w.formatEtykiety||"A6").trim().toUpperCase()==="A4"?"A4":"A6",
      zadania:{...(w.zadania||{}),dane:true},
      zaktualizowano:new Date().toISOString()
    };
    zapiszKosztyZamowienia(zam,{dostawaId:zam.dostawaId,paczkaWeekend:zam.wysylka.paczkaWeekend});
    if(zam.platnoscId==="pobranie" && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) zam.wysylka.pobranie=kwotaNum(zam.razem).toFixed(2);
  });
  if(zapisane) await zapiszZamowienieCentralnie(zapisane,false);
  return zapisane;
}
async function utworzPrzesylkeAPI(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z)return toast("Nie znaleziono zamówienia");
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora"); chmuraUstawToken(); return; }
  if(!confirm(`Utworzyć prawdziwą przesyłkę InPost dla ${nr}? W trybie produkcyjnym operacja może naliczyć opłatę zgodnie z umową.`))return;
  try{
    await zapiszFormularzWysylkiPrzedAPI(nr);
    toast("Tworzę przesyłkę InPost…");
    const d=await chmura("inpost-create",{method:"POST",body:{nr},timeout:25000});
    const labelReady=!!(d.labelReady||d.trackingNumber);
    aktualizujZamowienie(nr,zam=>{
      const w=daneWysylki(zam);
      zam.wysylka=d.order?.wysylka?{...w,...d.order.wysylka}:{...w,przewoznik:"inpost",usluga:uslugaInpostZamowienia(zam),inpostId:d.inpostId||w.inpostId,numer:d.trackingNumber||w.numer,inpostStatus:d.status||w.inpostStatus,etykietaGotowa:labelReady,etap:labelReady?"etykieta":(w.etap&&w.etap!=="problem"?w.etap:"przygotowanie"),zadania:{...(w.zadania||{}),dane:true,etykieta:labelReady}};
      if(d.order?.status) zam.status=d.order.status;
      else if(labelReady&&["nowe","potwierdzone","w realizacji"].includes(zam.status))zam.status="gotowe do wysyłki";
    });
    loguj("info",`InPost utworzył przesyłkę ${d.inpostId||""} (${d.trackingNumber||"bez numeru"}) dla ${nr}`);
    toast(labelReady?`Przesyłka InPost utworzona ✅ ${d.trackingNumber||"etykieta gotowa"}`:"Przesyłka utworzona, ale InPost jeszcze potwierdza etykietę — użyj „Sprawdź status InPost” za chwilę.");
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Najpierw skonfiguruj InPost w Netlify (INPOST_TOKEN, INPOST_ORG_ID)"); location.hash="#/admin/dostawy"; return; }
    if(bl.code==="no_point"){ toast("Brak punktu InPost — otwórz zlecenie i wpisz paczkomat przed etykietą"); return; }
    if(bl.code==="exists"){ toast("Przesyłka InPost już istnieje dla tego zamówienia"); return; }
    if(bl.code==="inpost_validation"){ toast("Uzupełnij dane do InPost: "+((bl.details||[]).map(x=>x.message||x).join(" • ")||bl.message)); return; }
    if(bl.code==="inpost_service_unavailable"){ toast(bl.message||"Ta usługa InPost nie jest aktywna na koncie"); return; }
    aktualizujZamowienie(nr,zam=>{const w=daneWysylki(zam);w.bladIntegracji=bl.message;w.etap="problem";zam.wysylka=w;});
    loguj("blad",`InPost create ${nr}: ${bl.message}`);toast("InPost: "+bl.message);renderuj();
  }
}
async function pobierzEtykieteAPI(nr,format="A6"){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.wysylka?.inpostId)return toast("Najpierw utwórz przesyłkę InPost");
  if(!chmuraToken){ chmuraUstawToken(); return; }
  try{
    toast("Pobieram etykietę InPost…");
    const d=await chmura("inpost-label",{params:{nr,type:format},timeout:25000});
    const url=URL.createObjectURL(b64toBlob(d.base64,"application/pdf"));
    window.open(url,"_blank","noopener");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    aktualizujZamowienie(nr,zam=>{
      const w=daneWysylki(zam);
      if(d.status)w.inpostStatus=d.status;
      if(d.trackingNumber)w.numer=d.trackingNumber;
      w.etykietaGotowa=true;
      w.zadania={...(w.zadania||{}),dane:true,etykieta:true};
      if(!w.etap||w.etap==="przygotowanie"||w.etap==="problem")w.etap="etykieta";
      zam.wysylka=w;
    });
    loguj("info",`Pobrano etykietę InPost ${format} dla ${nr}`);
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Skonfiguruj InPost w Netlify"); return; }
    if(bl.code==="no_shipment"){ toast("Najpierw utwórz przesyłkę InPost"); return; }
    if(bl.code==="label_not_ready"){
      aktualizujZamowienie(nr,zam=>{ const w=daneWysylki(zam); if(bl.status)w.inpostStatus=bl.status; if(bl.trackingNumber)w.numer=bl.trackingNumber; w.etykietaGotowa=false; w.zadania={...(w.zadania||{}),dane:true,etykieta:false}; zam.wysylka=w; });
      toast(bl.message||"InPost jeszcze nie potwierdził etykiety — sprawdź status za chwilę");
      renderuj();
      return;
    }
    toast("Etykieta: "+bl.message); loguj("blad",`InPost label ${nr}: ${bl.message}`);
  }
}
function idEtykietyInpost(nr){ return "etykietaFormat_"+String(nr||"").replace(/[^a-z0-9_-]/gi,"_"); }
function wybranyFormatEtykietyInpost(nr, fallback="A6"){
  const v=String($(idEtykietyInpost(nr))?.value||fallback||"A6").toUpperCase();
  return v==="A4"?"A4":"A6";
}
const INPOST_STATUSY_ETYKIETA_GOTOWA = ["confirmed","dispatched_by_sender","collected_from_sender","taken_by_courier","adopted_at_source_branch","sent_from_source_branch","ready_to_pickup","out_for_delivery","delivered","returned_to_sender","return_redirected_to_sender"];
function czyEtykietaInpostGotowa(z){
  const w=daneWysylki(z);
  if(w.etykietaGotowa||w.numer)return true;
  const s=String(w.inpostStatus||"").trim().toLowerCase();
  if(!s)return false;
  if(INPOST_STATUSY_ETYKIETA_GOTOWA.includes(s)||s.includes("confirmed"))return true;
  if(s.includes("created")||s.includes("offer")||s.includes("prepared")||s.includes("cancel"))return false;
  return ["transport","doreczenie","dostarczona","zwrot"].includes(String(w.etap||"").toLowerCase());
}
function opisGotowosciEtykietyInpost(z){
  const w=daneWysylki(z), status=String(w.inpostStatus||"").trim();
  if(czyEtykietaInpostGotowa(z))return `Etykieta gotowa${w.numer?` • numer ${w.numer}`:""}${status?` • ${status}`:""}`;
  if(w.inpostId)return `Przesyłka ma ID ${w.inpostId}, ale InPost jeszcze nie potwierdził/opłacił etykiety${status?` • status: ${status}`:""}.`;
  return "Najpierw utwórz przesyłkę InPost.";
}
function pobierzWybranaEtykieteAPI(nr){ return pobierzEtykieteAPI(nr, wybranyFormatEtykietyInpost(nr)); }
function panelEtykietInpostHTML(z){
  const w=daneWysylki(z), nr=z?.nr||"", id=idEtykietyInpost(nr), fmt=String(w.formatEtykiety||"A6").toUpperCase()==="A4"?"A4":"A6";
  const ma=!!w.inpostId, gotowa=czyEtykietaInpostGotowa(z);
  return `<div style="border:2px solid #ffcc00;background:linear-gradient(180deg,#fff7cc,#fff);border-radius:14px;padding:.85rem 1rem;margin:.7rem 0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.7rem;flex-wrap:wrap">
      <div><b>🏷️ Etykiety i import InPost</b><br><small style="color:var(--muted2)">Wybierz format etykiety, pobierz PDF albo przygotuj plik importu do InPost Managera.</small></div>
      <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;font-weight:800">Format PDF:
        <select id="${esc(id)}" name="formatEtykiety" style="padding:.38rem .6rem;border:1.5px solid var(--line);border-radius:10px">
          <option value="A6" ${fmt==="A6"?"selected":""}>A6 — mała etykieta</option>
          <option value="A4" ${fmt==="A4"?"selected":""}>A4 — kartka</option>
        </select>
      </label>
    </div>
    <div class="diag-actions" style="margin-top:.7rem">
      ${ma&&gotowa?`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="pobierzWybranaEtykieteAPI(${jsArg(nr)})">🏷️ Pobierz wybraną etykietę</button>
      <button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(nr)},'A6')">A6</button>
      <button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(nr)},'A4')">A4</button>`:ma?`<button class="btn ghost" type="button" disabled title="InPost musi potwierdzić/opłacić przesyłkę przed pobraniem PDF">🏷️ PDF po potwierdzeniu</button>
      <button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="synchronizujTrackingAPI(${jsArg(nr)})">🔄 Sprawdź status InPost</button>`:`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="utworzPrzesylkeAPI(${jsArg(nr)})">🟡 Utwórz przesyłkę i numer</button>
      <button class="btn ghost" type="button" disabled title="Najpierw utwórz przesyłkę InPost">PDF po nadaniu</button>`}
      <button class="btn ghost" type="button" onclick="drukujEtykieteRobocza(${jsArg(nr)})">🏷️ Robocza A6</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'tab')">📄 TXT z nagłówkami InPost</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'csv')">CSV przecinek</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'txt')">📄 TXT średnik</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'extended')">📋 CSV rozszerzony</button>
      ${ma&&gotowa?`<button class="btn ghost" type="button" onclick="synchronizujTrackingAPI(${jsArg(nr)})">🔄 Status InPost</button>`:""}
    </div>
    <p style="font-size:.78rem;color:${ma&&!gotowa?"#92400e":"var(--muted2)"};margin:.55rem 0 0"><b>Status etykiety:</b> ${esc(opisGotowosciEtykietyInpost(z))}</p>
    <p style="font-size:.78rem;color:var(--muted2);margin:.35rem 0 0"><b>TXT z nagłówkami InPost</b> działa z ustawieniem InPost „Separator kolumn: Tabulator”. W InPost zmień tylko <b>„Czy ma nagłówki?” na TAK</b>, wtedy dopasowujesz nazwa do nazwy: e-mail → E-mail, telefon → Telefon, miasto → Miasto.</p>
  </div>`;
}
async function synchronizujTrackingAPI(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.wysylka?.inpostId)return toast("To zamówienie nie ma przesyłki InPost");
  if(!chmuraToken){ chmuraUstawToken(); return; }
  try{
    toast("Pobieram status z InPost…");
    const d=await chmura("inpost-status",{params:{nr},timeout:20000});
    aktualizujZamowienie(nr,zam=>{ if(d.order?.wysylka) zam.wysylka={...daneWysylki(zam),...d.order.wysylka}; });
    loguj("info",`InPost status ${nr}: ${d.status||""} ${d.trackingNumber||""}`);
    toast((d.labelReady||d.trackingNumber)?"Status InPost zaktualizowany ✅ — etykieta gotowa":"Status InPost zaktualizowany — etykieta jeszcze czeka na potwierdzenie");
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Skonfiguruj InPost w Netlify"); return; }
    if(bl.code==="no_shipment"){ toast("To zamówienie nie ma przesyłki InPost"); return; }
    aktualizujZamowienie(nr,zam=>{const w=daneWysylki(zam);w.bladIntegracji=bl.message;zam.wysylka=w;});
    loguj("blad",`InPost status ${nr}: ${bl.message}`);toast("Status: "+bl.message);renderuj();
  }
}
// Ręczne sprawdzenie statusów WSZYSTKICH przesyłek InPost (to samo robi harmonogram co 6h)
async function synchronizujWszystkieStatusyAPI(){
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora"); chmuraUstawToken(); return; }
  try{
    toast("Sprawdzam statusy wszystkich przesyłek InPost…");
    const d=await chmura("inpost-sync-all",{method:"POST",body:{},timeout:60000});
    await synchronizujBazeCentralna(true).catch(()=>{});
    loguj("info",`InPost sync: sprawdzone ${d.sprawdzone||0}, zmienione ${d.zmienione||0}, e-maile ${d.maile||0}, błędy ${d.bledy||0}`);
    toast(`✅ Sprawdzono ${d.sprawdzone||0} przesyłek — ${d.zmienione||0} zmian statusu, ${d.maile||0} e-maili`);
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured") toast("InPost nie jest skonfigurowany w Netlify");
    else toast("Błąd sprawdzania statusów: "+bl.message);
  }
}
// Hurtowe tworzenie etykiet InPost (API) dla zaznaczonych zleceń
async function utworzEtykietyZaznaczoneAPI(){
  const nry=[...zaznaczoneNadania];
  if(!nry.length){ toast("Zaznacz zlecenia (☑ na karcie)"); return; }
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora"); chmuraUstawToken(); return; }
  if(!confirm(`Utworzyć przesyłki InPost (API) dla ${nry.length} zaznaczonych zleceń? W trybie produkcyjnym mogą naliczyć się opłaty zgodnie z umową.`)) return;
  let ok=0,bl=0,pom=0;
  toast(`Tworzę przesyłki InPost dla ${nry.length} zleceń…`);
  for(const nr of nry){
    const z=pobierzZamowienia().find(x=>x.nr===nr);
    if(z?.wysylka?.inpostId){ pom++; continue; }
    try{ await chmura("inpost-create",{method:"POST",body:{nr},timeout:25000}); ok++; }
    catch(e){ bl++; loguj("blad",`InPost etykieta ${nr}: ${e.message}`); }
  }
  await synchronizujBazeCentralna(true).catch(()=>{});
  toast(`🟡 InPost: ${ok} przesyłek zleconych${pom?`, ${pom} już było`:""}${bl?`, ${bl} błędów`:""} — PDF odblokuje się po potwierdzeniu`);
  renderuj();
}
function przelaczZadanieWysylki(nr,klucz){
  aktualizujZamowienie(nr,z=>{const w=daneWysylki(z);w.zadania={...(w.zadania||{}),[klucz]:!w.zadania?.[klucz]};z.wysylka=w;});
  renderuj();
}
function zastosujRegulyWysylek(){
  const lista=pobierzZamowienia(); let ile=0;
  for(const z of lista){
    if(["anulowane","zakończone","dostarczone"].includes(z.status)||z.wysylka?.przewoznik) continue;
    const w=daneWysylki(z); w.przewoznik=przewoznikDlaZamowienia(z); w.etap="przygotowanie";
    w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status:"Reguła automatyczna",opis:`Przypisano ${nazwaPrzewoznika(w.przewoznik)}`}];
    z.wysylka=w; if(z.status==="nowe") z.status="w realizacji"; ile++;
  }
  zapiszLS("artway_zamowienia",lista); loguj("info",`Reguły wysyłkowe przypisały ${ile} zleceń`);
  toast(ile?`Przypisano ${ile} zleceń ✅`:"Brak zleceń do przypisania"); renderuj();
}
let tabWysylek="zlecenia", filtrWysylek="aktywne", szukajWysylek="";
function nawigacjaWysylek(){
  const taby=[["zlecenia","📋 Obsługa zleceń"],["tracking","📡 Monitoring i tracking"],["automatyzacje","⚡ Automatyzacje"],["ustawienia","⚙️ Bramka i ustawienia"]];
  return `<div class="panel" style="padding:.65rem .8rem"><div class="shipping-tabs">${taby.map(([id,n])=>`<button class="${tabWysylek===id?"active":""}" onclick="tabWysylek='${id}';renderuj()">${n}</button>`).join("")}</div></div>`;
}
function listaWysylekPoFiltrze(){
  let lista=pobierzZamowienia();
  if(filtrWysylek==="aktywne") lista=lista.filter(z=>!["dostarczona","anulowana","zwrot"].includes(etapWysylki(z)));
  else if(filtrWysylek!=="wszystkie") lista=lista.filter(z=>etapWysylki(z)===filtrWysylek);
  if(szukajWysylek) lista=lista.filter(z=>(`${z.nr} ${z.email||""} ${z.wysylka?.numer||""} ${z.adres||""} ${z.wysylka?.operator||""}`).toLowerCase().includes(szukajWysylek));
  return lista;
}
function kartaZleceniaWysylki(z){
  const w=daneWysylki(z), etap=ETAPY_WYSYLKI[etapWysylki(z)], sla=slaWysylki(z);
  const koszty=kosztyZamowienia(z);
  const zad=w.zadania||{}, wykonane=["dane","kompletacja","etykieta","przekazanie"].filter(k=>zad[k]).length;
  const etykietaGotowa=czyEtykietaInpostGotowa(z);
  const zazn=zaznaczoneNadania.has(String(z.nr)), got=gotoweDoNadaniaInpost(z), odbior=String(z?.dostawaId||"").toLowerCase()==="odbior";
  const znacznik = odbior?"":(got.ok?`<span class="lvl" style="background:#dcfce7;color:#166534" title="Dane kompletne — gotowe do nadania">✅ gotowe</span>`:`<span class="lvl" style="background:#fef3c7;color:#92400e" title="Uzupełnij dane odbiorcy przed nadaniem">⚠️ ${esc(got.powod)}</span>`);
  return `<div class="ship-card ${etapWysylki(z)==="problem"?"problem":""}" style="${zazn?"border:2px solid #ffcc00;background:#fffdf3;":""}">
    <div class="ship-card-head">
      <span><label style="margin-right:.5rem;cursor:pointer" title="Zaznacz do nadania z pliku"><input type="checkbox" style="transform:scale(1.25)" ${zazn?"checked":""} onchange="przelaczZaznaczenieNadania(${jsArg(z.nr)})"></label><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a> • ${esc([z.klient?.imie,z.klient?.nazwisko].filter(Boolean).join(" ")||z.email||"gość")}</span>
      <span>${znacznik} <span class="shipment-priority priority-${esc(w.priorytet||"normalny")}">${esc(w.priorytet||"normalny")}</span> <span class="lvl" style="background:${etap.kolor}">${etap.ikona} ${etap.nazwa}</span></span>
    </div>
	    <div class="ship-meta">🚚 ${esc(nazwaPrzewoznika(w.przewoznik||przewoznikDlaZamowienia(z)))} • ${esc(w.usluga||uslugaInpostZamowienia(z))} • 🔢 ${w.numer?esc(w.numer):"<b>oczekuje na etykietę</b>"}<br>
	      📍 ${esc(z.adres||"brak adresu")} • 👤 ${esc(w.operator||"nieprzypisane")} • <span class="${sla.klasa}">⏱ ${esc(sla.tekst)}</span><br>
	      💰 Dostawa: ${koszty.dostawa?zl(koszty.dostawa):"GRATIS"}${koszty.paczkaWeekend?` • Paczka w Weekend: ${zl(koszty.paczkaWeekend)}`:""} • Razem: <b>${zl(koszty.razem)}</b>
	    </div>
    <div style="margin:.5rem 0;font-size:.75rem;color:var(--muted2)">Postęp ${wykonane}/4:
      ${[["dane","dane"],["kompletacja","kompletacja"],["etykieta","etykieta"],["przekazanie","przekazanie"]].map(([k,n])=>`<label style="margin-right:.5rem;white-space:nowrap"><input type="checkbox" ${zad[k]?"checked":""} onchange="przelaczZadanieWysylki('${esc(z.nr)}','${k}')"> ${n}</label>`).join("")}
    </div>
    ${w.bladIntegracji?`<div class="backend-note" style="border-color:var(--danger);background:#fff1f2;color:#991b1b"><b>Wyjątek:</b> ${esc(w.bladIntegracji)}</div>`:""}
    <div class="diag-actions">
      <a class="btn" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Obsłuż zlecenie</a>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'tab')">📄 TXT z nagłówkami InPost</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'csv')">CSV przecinek</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'txt')">TXT średnik</button>
      ${!w.inpostId?`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="utworzPrzesylkeAPI(${jsArg(z.nr)})">🟡 Generuj etykietę InPost</button>`:etykietaGotowa?`<button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(z.nr)},'A6')">🏷️ A6</button><button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(z.nr)},'A4')">🏷️ A4</button>`:`<button class="btn ghost" type="button" disabled title="${esc(opisGotowosciEtykietyInpost(z))}">🏷️ PDF po potwierdzeniu</button>`}
      ${w.inpostId?`<button class="btn ghost" type="button" onclick="synchronizujTrackingAPI(${jsArg(z.nr)})">🔄 Status InPost</button>`:""}
      ${urlSledzenia(z)?`<a class="btn ghost" href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Śledź</a>`:""}
    </div>
  </div>`;
}
function panelZlecenWysylkowych(){
  const wszystkie=pobierzZamowienia(), lista=listaWysylekPoFiltrze();
  const doN = lista.filter(z=>String(z?.dostawaId||"").toLowerCase()!=="odbior" && !["dostarczona","anulowana","zwrot"].includes(etapWysylki(z)));
  const gotoweN = lista.filter(z=>gotoweDoNadaniaInpost(z).ok).length;
  const paczkDoN = doN.filter(z=>paczkomatoweInpost(z)).length, kurierDoN = doN.length - paczkDoN;
  const etapy=["do_obslugi","przygotowanie","etykieta","transport","doreczenie","problem"];
  return `<div class="panel">
    <h1>🚚 Centrum obsługi InPost</h1>
    <p style="color:var(--muted2)">Jeden proces dla zamówień InPost: wybór paczkomatu, etykieta, przekazanie, tracking, doręczenie albo wyjątek.</p>
    <div class="pipeline">${etapy.map(id=>`<div class="pipeline-step ${id==="problem"?"problem":""}"><b>${wszystkie.filter(z=>etapWysylki(z)===id).length}</b><small>${ETAPY_WYSYLKI[id].ikona} ${ETAPY_WYSYLKI[id].nazwa}</small></div>`).join("")}</div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin:.8rem 0">
      <select onchange="filtrWysylek=this.value;renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option value="aktywne" ${filtrWysylek==="aktywne"?"selected":""}>Wszystkie aktywne</option>
        <option value="wszystkie" ${filtrWysylek==="wszystkie"?"selected":""}>Cała historia</option>
        ${Object.entries(ETAPY_WYSYLKI).map(([id,e])=>`<option value="${id}" ${filtrWysylek===id?"selected":""}>${e.ikona} ${e.nazwa}</option>`).join("")}
      </select>
      <input placeholder="Szukaj: zlecenie, klient, tracking, operator…" value="${esc(szukajWysylek)}" oninput="szukajWysylek=this.value.toLowerCase();renderuj()" style="flex:1;min-width:210px;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
      <button class="btn ghost" onclick="zastosujRegulyWysylek()">⚡ Zastosuj reguły</button>
    </div>
    <div style="border:2px solid #ffcc00;background:linear-gradient(180deg,#fffbeb,#fff);border-radius:14px;padding:.85rem 1rem;margin:.2rem 0 .9rem">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:space-between">
        <div style="font-size:1rem"><b>📄 Nadanie z pliku (InPost)</b> <span style="color:var(--muted2);font-size:.82rem">— hurtowe / awaryjne, bez umowy kurierskiej</span></div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn" style="background:#ffcc00;color:#111;font-weight:800;box-shadow:0 2px 8px rgba(255,204,0,.45)" onclick="eksportNadaniaInpostCSV(null,'tab')">⬇️ TXT z nagłówkami InPost${zaznaczoneNadania.size?` — ${zaznaczoneNadania.size} zazn.`:` — wszystkie (${doN.length})`}</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'csv')">CSV przecinek</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'txt')">TXT średnik</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'extended')">📋 CSV rozszerzony</button>
        </div>
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-top:.65rem">
        <span style="font-size:.8rem;color:var(--muted2);font-weight:700">Zaznacz:</span>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczWszystkieNadania(true)">☑️ Wszystkie (${lista.length})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczGotoweNadania()">✅ Gotowe (${gotoweN})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczTypNadania('paczkomat')">📦 Paczkomat (${paczkDoN})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczTypNadania('kurier')">🚚 Kurier (${kurierDoN})</button>
        ${zaznaczoneNadania.size?`<button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem;color:#b91c1c" onclick="zaznaczoneNadania.clear();renderuj()">✖ Odznacz (${zaznaczoneNadania.size})</button>
        <button class="btn" style="padding:.32rem .7rem;font-size:.83rem;background:#ffcc00;color:#111;margin-left:auto" title="Utwórz przesyłki i etykiety InPost przez API dla zaznaczonych zleceń" onclick="utworzEtykietyZaznaczoneAPI()">🟡 Etykiety API (${zaznaczoneNadania.size})</button>`:""}
      </div>
      <p style="font-size:.77rem;color:var(--muted2);margin:.55rem 0 0">Plik wgraj w InPost: <b>manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU</b> (max 100). Użyj głównego <b>TXT z nagłówkami InPost</b>: zostaw <b>Separator kolumn: Tabulator</b>, ustaw <b>Czy ma nagłówki: Tak</b>, a potem dopasowuj nazwa do nazwy, np. <b>e-mail → E-mail</b>, <b>telefon → Telefon</b>, <b>miasto → Miasto</b>, <b>typ_przesylki → Typ przesyłki</b>. Błąd „nie znaleziono adresu e-mail w pierwszej linii” oznacza, że nagłówki nadal są ustawione na „Nie”.</p>
    </div>
    ${lista.length?lista.map(kartaZleceniaWysylki).join(""):"<p>Brak zleceń dla wybranego filtra.</p>"}
  </div>`;
}
function panelTrackinguWysylek(){
  const lista=pobierzZamowienia().filter(z=>daneWysylki(z).numer||["problem","transport","doreczenie"].includes(etapWysylki(z)));
  return `<div class="panel">
    <h1>📡 Monitoring i tracking</h1>
    <p style="color:var(--muted2)">Monitoring numerów InPost, ostatnich zdarzeń, SLA i wyjątków z automatycznego webhooka oraz ręcznego odświeżenia statusu.</p>
    <div style="border:1.5px solid #86efac;background:#f0fdf4;border-radius:12px;padding:.7rem .9rem;margin:.2rem 0 .9rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:space-between">
      <div style="font-size:.88rem;color:#166534"><b>🤖 Automatyczne sprawdzanie statusów</b><br><span style="color:var(--muted2)">Wszystkie przesyłki są sprawdzane <b>samoczynnie co 6 godzin</b> (harmonogram) + na bieżąco przez webhook InPost. Statusy i e-maile aktualizują się same.</span></div>
      <button class="btn" style="background:#166534;color:#fff;white-space:nowrap" onclick="synchronizujWszystkieStatusyAPI()">🔄 Sprawdź teraz wszystkie</button>
    </div>
    <div class="ship-grid">
      <div class="ship-stat"><b>${lista.length}</b><small>monitorowanych</small></div>
      <div class="ship-stat"><b>${lista.filter(z=>etapWysylki(z)==="transport").length}</b><small>w transporcie</small></div>
      <div class="ship-stat"><b>${lista.filter(z=>etapWysylki(z)==="doreczenie").length}</b><small>w doręczeniu</small></div>
      <div class="ship-stat" style="background:#fff1f2"><b>${lista.filter(z=>etapWysylki(z)==="problem").length}</b><small>wymaga reakcji</small></div>
    </div>
    ${lista.length?`<table class="tracking-table"><tr><th>Zlecenie</th><th>Przewoźnik / numer</th><th>Etap wspólny</th><th>Ostatnie zdarzenie</th><th>SLA</th><th>Akcja</th></tr>
      ${lista.map(z=>{const w=daneWysylki(z),h=[...(w.historia||[])].pop(),e=ETAPY_WYSYLKI[etapWysylki(z)],sla=slaWysylki(z);return`<tr>
        <td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a><br><small>${esc(z.email||"")}</small></td>
        <td>${esc(nazwaPrzewoznika(w.przewoznik))}<br><b>${esc(w.numer||"brak")}</b></td>
        <td><span class="lvl" style="background:${e.kolor}">${e.ikona} ${e.nazwa}</span></td>
        <td>${h?`<b>${esc(h.status)}</b><br><small>${esc(h.czas)}</small>`:"brak zdarzeń"}</td>
        <td class="${sla.klasa}">${esc(sla.tekst)}${w.ostatniaSynchronizacja?`<br><small>synch. ${esc(new Date(w.ostatniaSynchronizacja).toLocaleString("pl-PL"))}</small>`:""}</td>
        <td>${urlSledzenia(z)?`<a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Śledź →</a>`:`<a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Uzupełnij →</a>`}</td>
      </tr>`}).join("")}</table>`:"<p>Brak przesyłek objętych monitoringiem.</p>"}
    <div class="backend-note"><b>Automatyzacja:</b> webhook InPost aktualizuje tę tabelę po zmianie statusu przesyłki. Jeśli etykieta jest tworzona ręcznie w InPost Managerze, w polu referencji/opisu wpisz numer zamówienia ze sklepu, np. <code>ATM-123456</code>.</div>
  </div>`;
}
function panelAutomatyzacjiWysylek(){
  const u=ustawieniaWysylki();
  const emailGotowy=!!stanBramki.email?.configured, emailPolaczony=emailGotowy&&!!chmuraToken;
  return `<div class="panel">
    <h1>⚡ Automatyzacje wysyłek</h1>
    <p style="color:var(--muted2)">Reguły obowiązują wszystkie zlecenia. Aktywny jest jeden przewoźnik: InPost, z usługami Paczkomat i Kurier.</p>
    <form data-flagi="autoStatus,autoEmail,autoTracking,alarmSla,powiadomieniaWyjatki" onsubmit="zapiszUstawieniaWysylki(event)">
      <h2>Reguły przypisania</h2>
      <div class="automation-row"><span><b>InPost</b><small style="display:block;color:var(--muted2)">Paczkomat wymaga punktu, Kurier używa adresu dostawy</small></span><select name="regulaPaczkomat">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<option value="${id}" selected>${esc(p.nazwa)}</option>`).join("")}</select><span>→ zawsze</span></div>
      <input type="hidden" name="regulaKurier" value="inpost">
      <h2>Synchronizacja i reakcje</h2>
      <label class="chk-row"><input type="checkbox" name="autoTracking" ${u.autoTracking?"checked":""}> Automatycznie pobieraj zdarzenia i normalizuj statusy</label>
      <label class="chk-row"><input type="checkbox" name="autoStatus" ${u.autoStatus?"checked":""}> Aktualizuj status zamówienia na podstawie trackingu</label>
      <label class="chk-row"><input type="checkbox" name="autoEmail" ${u.autoEmail?"checked":""}> Automatycznie wysyłaj e-mail przez API po zmianie statusu, nadaniu, doręczeniu, zwrocie lub problemie</label>
      <label class="chk-row"><input type="checkbox" name="alarmSla" ${u.alarmSla?"checked":""}> Alarmuj o przekroczeniu czasu na nadanie</label>
      <label class="chk-row"><input type="checkbox" name="powiadomieniaWyjatki" ${u.powiadomieniaWyjatki?"checked":""}> Wyróżniaj wyjątki wymagające działania operatora</label>
      <div class="f-row" style="margin-top:.8rem"><div class="f-group"><label>SLA nadania (godziny)</label><input type="number" min="1" name="slaNadanie" value="${esc(u.slaNadanie)}"></div><div class="f-group"><label>Planowany czas doręczenia (godziny)</label><input type="number" min="1" name="slaDoreczenie" value="${esc(u.slaDoreczenie)}"></div></div>
      <button class="btn" type="submit">💾 Zapisz automatyzacje</button>
    </form>
    <div class="backend-note" style="${emailPolaczony?"border-color:#86efac;background:#f0fdf4;color:#166534":emailGotowy?"":"border-color:#f59e0b"}">
      <b>E-mail SMTP:</b> ${emailPolaczony?`skonfigurowano ${esc(stanBramki.email.provider||"SMTP")} i panel ma hasło bazy — automatyczne wiadomości są gotowe`:emailGotowy?`SMTP jest skonfigurowany, wpisz hasło bazy administratora, aby wysyłać testy i ręczne wiadomości`:"brak konfiguracji — ustaw SMTP/Gmail w zmiennych Netlify"}.
      ${!emailPolaczony?` <a href="#/admin/dostawy">Konfiguracja e-mail →</a>`:""}
    </div>
    <form onsubmit="wyslijTestEmail(event)" style="margin-top:1rem">
      <h2>Test wiadomości API</h2>
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>Adres odbiorcy testu</label><input type="email" name="email" value="${esc(KONFIG.emailSklepu)}" required></div>
        <div class="f-group"><button class="btn ghost" type="submit" ${emailPolaczony?"":"disabled"}>📧 Wyślij test</button></div>
      </div>
    </form>
    <div class="backend-note"><b>Sposób działania:</b> e-mail jest wysyłany natychmiast przez serwerowe API, gdy administrator zmienia status zamówienia lub zapisuje nowy numer nadania. Historia i identyfikator wiadomości są zapisywane przy zamówieniu.</div>
  </div>`;
}
function panelUstawienBramki(){
  const u=ustawieniaWysylki();
  const ip=stanBramki.inpost||{};
  const ipGotowy=!!ip.configured, ipMapa=!!ip.geowidgetConfigured, ipWebhook=!!ip.webhookConfigured;
  const av=ip.serviceAvailability||{};
  const braki=Array.isArray(ip.missingEnv)&&ip.missingEnv.length?ip.missingEnv:[...(ipGotowy?[]:["INPOST_TOKEN","INPOST_ORG_ID"])];
  const orgInfo=ip.organization?.id?`Organizacja: <b>${esc(ip.organization.id)}</b>${ip.organization.name?` • ${esc(ip.organization.name)}`:""}`:"Organizacja zostanie pokazana po realnym teście API.";
  const uslugiInfo=av.services?.length?`<br>Usługa paczkomatowa <code>${esc(av.lockerService||"inpost_locker_standard")}</code>: <b>${av.locker?"aktywna ✅":"brak — włącz usługę paczkomatową w InPost"}</b> • Kurier InPost <code>${esc(av.courierService||"inpost_courier_standard")}</code>: <b>${av.courier?"aktywny ✅":"brak — włącz usługę kurierską w InPost"}</b>`:"";
  return `<div class="panel">
    <h1>⚙️ Bramka InPost</h1>
    <div class="integration-hub" style="border:2px solid ${ipGotowy?'#86efac':'#fcd34d'};background:${ipGotowy?'#f0fdf4':'#fffbeb'}">
      <div class="integration-hub-status"><span><b>🟡 InPost (ShipX) — Netlify</b><br><small style="color:var(--muted2)">Prawdziwe przesyłki, etykiety i mapa paczkomatów — tokeny w zmiennych Netlify</small></span>
        <span class="integration-state" style="background:${ipGotowy?'#dcfce7':'#fef3c7'};color:${ipGotowy?'#166534':'#854d0e'}">${ipGotowy?`tokeny obecne • ${esc(ip.env||'production')}`:`brakuje: ${esc(braki.join(", "))}`}</span></div>
      <p class="ship-meta">Przesyłki ShipX: <b>${ipGotowy?"aktywne po pozytywnym teście ✅":"uzupełnij brakujące zmienne Netlify"}</b> &nbsp;•&nbsp; Mapa paczkomatów: <b>${ipMapa?"aktywna ✅":"ustaw INPOST_GEOWIDGET_TOKEN"}</b> &nbsp;•&nbsp; Webhook statusów: <b>${ipWebhook?"aktywny ✅":"ustaw INPOST_WEBHOOK_SECRET i dodaj URL w InPost"}</b><br>${orgInfo}${uslugiInfo}</p>
      <div class="diag-actions">
        <button class="btn ghost" onclick="sprawdzBramke()">🔎 Sprawdź Netlify</button>
        <button class="btn" style="background:#ffcc00;color:#111" onclick="testujInPost()">🟡 Test API InPost</button>
      </div>
      ${stanBramki.error?`<div class="backend-note" style="border-color:var(--danger);background:#fff1f2;color:#991b1b"><b>Błąd połączenia:</b> ${esc(stanBramki.error)}</div>`:""}
      <div class="backend-note" style="margin-top:.6rem"><b>Wymagane dla etykiet:</b> <code>INPOST_TOKEN</code> i <code>INPOST_ORG_ID</code>. <b>Dla mapy:</b> <code>INPOST_GEOWIDGET_TOKEN</code>. <b>Dla automatycznego śledzenia z Managera:</b> <code>INPOST_WEBHOOK_SECRET</code> oraz adres webhooka wpisany w InPost API. Opcjonalnie: <code>INPOST_ENV</code>, <code>INPOST_SENDING_METHOD</code>, <code>INPOST_LOCKER_SERVICE</code>, <code>INPOST_COURIER_SERVICE</code>. Przy ręcznie tworzonych etykietach wpisuj w InPost numer zamówienia w referencji, np. <code>ATM-123456</code>.</div>
      <details style="margin-top:.6rem"><summary style="cursor:pointer;font-weight:700">Awaryjny/stary backend PHP na hostingu</summary>
        <p class="ship-meta">Główna integracja działa przez Netlify Functions. Ten adres zostaje tylko jako informacja dla pierwszej instalacji na nazwa.pl albo awaryjnego hostingu bez Netlify: <code>${esc(u.apiEndpoint)}</code>.</p>
      </details>
    </div>
    <div class="integration-card" style="margin-top:1rem">
      <b>📧 Automatyczne e-maile</b>
      <span class="integration-state">${stanBramki.email?.configured?`${esc(stanBramki.email.provider||"SMTP")} skonfigurowany${chmuraToken?" i gotowy":" — wpisz hasło bazy do testów"}`:"ustaw SMTP/Gmail w Netlify"}</span>
      <p class="ship-meta">Hasło SMTP pozostaje wyłącznie w zmiennych Netlify. Wysyłkę testową i reguły statusów znajdziesz w zakładce Automatyzacje.</p>
    </div>
    <form onsubmit="zapiszUstawieniaWysylki(event)" style="margin-top:1rem">
      <div class="f-row"><div class="f-group"><label>Adres bramki backendowej</label><input name="apiEndpoint" value="${esc(u.apiEndpoint)}" placeholder="/api/shipping"></div><div class="f-group"><label>Tryb</label><select name="tryb"><option value="sandbox" ${u.tryb==="sandbox"?"selected":""}>Sandbox / testowy</option><option value="production" ${u.tryb==="production"?"selected":""}>Produkcyjny</option></select></div></div>
      <div class="backend-note"><b>Bez sekretów:</b> w tym miejscu zapisuje się tylko adres wspólnej bramki. Tokeny InPost pozostają na serwerze, poza publicznym katalogiem strony.</div>
      <h2>Aktywny adapter</h2>
      <div class="integration-grid">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<div class="integration-card"><b>${esc(p.nazwa)}</b><span class="integration-state">${ipGotowy?"adapter Netlify gotowy — przesyłki, etykiety, mapa":"ustaw tokeny InPost w Netlify"}</span><p class="ship-meta">ShipX (Netlify) • Paczkomat + Kurier InPost • numer nadania • PDF A6/A4 • status • Geowidget • webhook</p></div>`).join("")}</div>
      <h2>Dane nadawcy i paczki</h2>
      <div class="f-row"><div class="f-group"><label>Domyślny przewoźnik</label><select name="przewoznik">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<option value="${id}" selected>${esc(p.nazwa)}</option>`).join("")}</select></div><div class="f-group"><label>Nazwa nadawcy</label><input name="nadawca" value="${esc(u.nadawca)}"></div></div>
      <div class="f-row"><div class="f-group"><label>Ulica i numer</label><input name="ulica" value="${esc(u.ulica)}"></div><div class="f-group"><label>Kod pocztowy</label><input name="kod" value="${esc(u.kod)}"></div><div class="f-group"><label>Miasto</label><input name="miasto" value="${esc(u.miasto)}"></div></div>
      <div class="f-row"><div class="f-group"><label>Telefon</label><input name="telefon" value="${esc(u.telefon)}"></div><div class="f-group"><label>E-mail nadawcy</label><input type="email" name="email" value="${esc(u.email)}"></div></div>
      <div class="f-row"><div class="f-group"><label>Waga (kg)</label><input type="number" step=".01" min=".01" name="waga" value="${esc(u.waga)}"></div><div class="f-group"><label>Długość (cm)</label><input type="number" min="1" name="dlugosc" value="${esc(u.dlugosc)}"></div><div class="f-group"><label>Szerokość (cm)</label><input type="number" min="1" name="szerokosc" value="${esc(u.szerokosc)}"></div><div class="f-group"><label>Wysokość (cm)</label><input type="number" min="1" name="wysokosc" value="${esc(u.wysokosc)}"></div></div>
      <button class="btn" type="submit">💾 Zapisz bramkę i dane nadawcy</button>
    </form>
  </div>`;
}
function widokAdminWysylki(){
  const widok=tabWysylek==="tracking"?panelTrackinguWysylek():tabWysylek==="automatyzacje"?panelAutomatyzacjiWysylek():tabWysylek==="ustawienia"?panelUstawienBramki():panelZlecenWysylkowych();
  return adminSzkielet("/admin/wysylki",nawigacjaWysylek()+widok);
}
/* Personalizacja = wszystkie ustawienia wyglądu i sklepu w JEDNYM miejscu,
   podzielone na zakładki. Stare adresy (#/admin/wyglad itd.) dalej działają
   i otwierają właściwą zakładkę.                                          */
const TABY_PERSONALIZACJI = [
  ["wyglad","🎨 Układ globalny"], ["rozmieszczenie","🧭 Rozmieszczenie"], ["bannery","🖼️ Banery"],
  ["podstrony","🧱 Układ podstron"], ["strony","📄 Treści prawne"], ["dostawy","🚚 Dostawa i płatności"]
];
function personalizacjaSzkielet(tab, tresc){
  return adminSzkielet("/admin/personalizacja", `
    <div class="panel" style="padding:.7rem .9rem">
      <div class="tab-bar">${TABY_PERSONALIZACJI.map(([id,t])=>`<a href="#/admin/${id}" class="${tab===id?'active':''}">${t}</a>`).join("")}</div>
    </div>
    ${tresc}`);
}
/* Asortyment = produkty, katalogi, mapowanie i rabaty w JEDNYM dziale z zakładkami */
const TABY_ASORTYMENTU = [
  ["produkty","🏷️ Produkty"], ["kategorie","🗂️ Katalogi"], ["mapowanie","🧩 Mapowanie"], ["rabaty","🎁 Kody rabatowe"], ["opinie","⭐ Opinie"]
];
function asortymentSzkielet(tab, tresc){
  return adminSzkielet("/admin/asortyment", `
    <div class="panel" style="padding:.7rem .9rem">
      <div class="tab-bar">${TABY_ASORTYMENTU.map(([id,t])=>`<a href="#/admin/${id}" class="${tab===id?'active':''}">${t}</a>`).join("")}</div>
    </div>
    ${tresc}`);
}
function zapiszCzescUstawien(obj){
  ustawienia = {...ustawienia, ...obj};
  zapiszLS("artway_ustawienia", ustawienia);
  zastosujUstawienia(); zbudujProdukty(); odswiezMenu(); odswiezKoszyk();
  loguj("info","Zapisano ustawienia sklepu");
  toast("Zapisane ✅"); renderuj();
}
function widokAdmin(){
  const zam = pobierzZamowienia(), kl = pobierzUzytkownikow().filter(u=>!kontoMaRoleAdmin(u.email));
  const przychod = zam.filter(z=>z.status!=="anulowane").reduce((s,z)=>s+z.razem,0);
  const nowe = zam.filter(z=>z.status==="nowe").length;
  const wgStatusu = STATUSY.map(s=>[s, zam.filter(z=>z.status===s).length]).filter(x=>x[1]);
  return adminSzkielet("/admin", `
    <div class="panel">
      <h1>📊 Pulpit</h1>
      <div class="stat-grid">
        <div class="stat" style="${nowe?'background:#fef3c7':''}"><b>${nowe}</b><small>nowych zamówień</small></div>
        <div class="stat"><b>${zam.length}</b><small>wszystkich zamówień</small></div>
        <div class="stat"><b>${zl(przychod)}</b><small>wartość sprzedaży</small></div>
        <div class="stat"><b>${kl.length}</b><small>klientów</small></div>
        <div class="stat"><b>${produkty.length}</b><small>produktów</small></div>
      </div>
      ${chmuraStatusHTML()}
      ${wgStatusu.length?`<p style="font-size:.85rem;color:var(--muted2)">Zamówienia: ${wgStatusu.map(([s,n])=>`<span class="lvl" style="background:${KOLOR_STATUSU[s]}">${s}: ${n}</span>`).join(" ")}</p>`:""}
      ${domyslneHasloAdmina?`<div class="sug" style="margin-top:1rem"><span class="s-ico">🔑</span><span><b>Masz domyślne hasło (admin)!</b> Zmień je w <a href="#/konto">Moje konto → Zmień hasło</a>, zanim wgrasz stronę do internetu.</span></div>`:""}
      <h2>⚡ Sklep i sprzedaż</h2>
      <div class="diag-actions" style="margin-top:.4rem">
        <a class="btn" href="#/admin/wysylki">🚚 Centrum wysyłek</a>
        <a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a>
        <a class="btn ghost" href="#/admin/kategorie">🗂️ Utwórz katalog</a>
        <a class="btn ghost" href="#/admin/mapowanie">🧩 Mapuj produkty</a>
        <a class="btn ghost" href="#/admin/rabaty">🎁 Dodaj kod rabatowy</a>
      </div>
      <h2>🎨 Wygląd i konfiguracja — wszystko w jednym miejscu</h2>
      <div class="diag-actions" style="margin-top:.4rem">
        <a class="btn" style="background:var(--brand2)" href="#/admin/personalizacja">🎨 Personalizacja i ustawienia</a>
        <a class="btn" href="#/admin/aktualizacja">⬆️ Aktualizuj stronę</a>
        <a class="btn ghost" href="#/admin/publikacja">🌍 Publikacja</a>
        <a class="btn ghost" href="#/diagnostyka">🛠️ Sprawdź kondycję</a>
      </div>
    </div>
    ${wykresSprzedazyHTML()}
    <div class="panel">
      <h2 style="margin-top:0">🕐 Ostatnie zamówienia</h2>
      ${zam.length ? `<table class="mini-tab">${zam.slice(0,6).map(z=>`
        <tr><td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a></td>
        <td>${esc(z.data)}</td><td><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">${esc(z.status)}</span></td>
        <td style="text-align:right"><b>${zl(z.razem)}</b></td></tr>`).join("")}</table>
        <p style="margin-top:.6rem"><a href="#/admin/zamowienia">Wszystkie zamówienia →</a></p>`
      : `<p style="color:var(--muted2)">Brak zamówień — gdy klienci zaczną kupować, zobaczysz je tutaj.</p>`}
    </div>`);
}
let filtrZamowien = "wszystkie", szukajZamowien = "";
function widokAdminZamowienia(){
  let zam = pobierzZamowienia();
  if(filtrZamowien!=="wszystkie") zam = zam.filter(z=>z.status===filtrZamowien);
  if(szukajZamowien) zam = zam.filter(z=>(z.nr+" "+(z.email||"")+" "+(z.adres||"")).toLowerCase().includes(szukajZamowien));
  return adminSzkielet("/admin/zamowienia", `
  <div class="panel">
    <h1>📦 Zamówienia (${zam.length}) <small style="font-size:.8rem;color:var(--muted2)">suma widocznych: ${zl(zam.reduce((s,z)=>s+z.razem,0))}</small></h1>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin:.6rem 0 1rem">
      <select onchange="filtrZamowien=this.value;renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option value="wszystkie" ${filtrZamowien==="wszystkie"?"selected":""}>Wszystkie statusy</option>
        ${STATUSY.map(s=>`<option ${s===filtrZamowien?"selected":""}>${s}</option>`).join("")}
      </select>
      <input placeholder="Szukaj: nr, e-mail, adres…" value="${esc(szukajZamowien)}" oninput="szukajZamowien=this.value.toLowerCase();renderuj()" style="flex:1;min-width:180px;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
      <button class="btn ghost" onclick="eksportujZamowienia()">📤 CSV</button>
    </div>
    ${zam.length ? zam.map(z=>`
      <div class="order-box">
        <div class="order-head">
          <a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a>
          <span>${esc(z.data)}</span>
          <select onchange="zmienStatus('${esc(z.nr)}', this.value)" style="padding:.2rem .5rem;border-radius:8px;border:1.5px solid var(--line);background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">
            ${STATUSY.map(s=>`<option ${s===z.status?"selected":""}>${s}</option>`).join("")}
          </select>
          <b>${zl(z.razem)}</b>
          <button class="ci-remove" onclick="if(confirm('Usunąć zamówienie ${esc(z.nr)}?')) usunZamowienie('${esc(z.nr)}')" title="Usuń zamówienie">🗑️</button>
        </div>
        <div class="order-lines">
          ${z.pozycje.map(p=>esc(p)).join("<br>")}
          ${z.email?`<br>👤 ${esc(z.email)}`:"<br>👤 gość (bez konta)"}
          <br>💰 Dostawa: ${zl(kosztyZamowienia(z).dostawa)}${kosztyZamowienia(z).paczkaWeekend?` • Paczka w Weekend: ${zl(kosztyZamowienia(z).paczkaWeekend)}`:""}
          ${z.wysylka?.numer?`<br>🚚 ${esc(nazwaPrzewoznika(z.wysylka.przewoznik))}: ${esc(z.wysylka.numer)}`:"<br>🚚 bez numeru nadania"}
          — <a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">szczegóły →</a>
        </div>
      </div>`).join("")
    : `<p>Brak zamówień${filtrZamowien!=="wszystkie"||szukajZamowien?" dla tego filtra":""}.</p>`}
  </div>`);
}
function widokAdminZamowienie(nr){
  const z = pobierzZamowienia().find(x=>x.nr===nr);
  if(!z) return adminSzkielet("/admin/zamowienia", `<div class="panel"><h1>Nie znaleziono zamówienia ${esc(nr)}</h1><p><a href="#/admin/zamowienia">← Wróć do listy</a></p></div>`);
  const w=daneWysylki(z), uw=ustawieniaWysylki(), klient=z.klient||{}, adres=z.adresDostawy||{};
  const emailGotowy=!!stanBramki.email?.configured, emailPolaczony=emailGotowy&&!!chmuraToken;
  const przewoznik="inpost";
  const uslugi=PRZEWOZNICY[przewoznik]?.uslugi||[];
  const paczkomatZam = czyZamowieniePaczkomat(z);
  const uslugaDomyslna = w.usluga || uslugaInpostZamowienia(z);
  const paynow=paynowDane(z);
  return adminSzkielet("/admin/zamowienia", `
  <div class="panel">
    <div class="crumb"><a href="#/admin/zamowienia">Zamówienia</a> › ${esc(z.nr)}</div>
    <h1>📦 ${esc(z.nr)} <span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'};font-size:.85rem;vertical-align:middle">${esc(z.status)}</span></h1>
    <p style="color:var(--muted2)">${esc(z.data)}</p>
    <div class="ship-layout">
      <div>
        <h2>Pozycje</h2>
        <div class="summary" style="margin:.5rem 0 1rem">${z.pozycje.map(p=>`<div><span>${esc(p)}</span></div>`).join("")}
          ${podsumowanieKosztowHTML(z)}</div>
      </div>
      <div class="ship-card">
        <h2 style="margin-top:0">Klient</h2>
        <p>${[klient.imie,klient.nazwisko].filter(Boolean).length?`👤 ${esc([klient.imie,klient.nazwisko].filter(Boolean).join(" "))}<br>`:""}
        ${z.email?`✉️ <a href="mailto:${esc(z.email)}">${esc(z.email)}</a><br>`:"✉️ brak e-maila<br>"}
        ${klient.telefon?`📞 ${esc(klient.telefon)}<br>`:""}
        ${klient.firma?`🏢 ${esc(klient.firma)} • NIP ${esc(klient.nip||"—")}<br>`:""}
        ${z.uwagi?`📝 ${esc(z.uwagi)}`:""}</p>
      </div>
    </div>
    <h2>Status zamówienia</h2>
    <div class="diag-actions">
      ${STATUSY.map(s=>`<button class="btn ${s===z.status?'':'ghost'}" onclick="zmienStatus('${esc(z.nr)}','${s}')">${s}</button>`).join("")}
    </div>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">🚚 Nadanie przez InPost</h2>
    <p><span class="lvl" style="background:${ETAPY_WYSYLKI[etapWysylki(z)].kolor};font-size:.82rem">${esc(nazwaEtapu(z))}</span> <span class="${slaWysylki(z).klasa}" style="margin-left:.4rem">⏱ ${esc(slaWysylki(z).tekst)}</span>${w.numer?` &nbsp;•&nbsp; Numer nadania: <b>${esc(w.numer)}</b>`:""}${w.inpostId?` &nbsp;•&nbsp; InPost: <code>${esc(w.inpostId)}</code>${w.inpostStatus?` (${esc(w.inpostStatus)})`:""}`:""}${urlSledzenia(z)?` &nbsp;•&nbsp; <a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">śledź</a>`:""}</p>
    <div class="backend-note">Wszystko do nadania w jednym miejscu: dane odbiorcy, paczkomat/adres i gabaryt. Zapisz zmiany, a potem kliknij „Utwórz przesyłkę InPost". Pola z <b>*</b> są wymagane.</div>
    <form onsubmit="zapiszNadanie(event,'${esc(z.nr)}')">
      <h3 class="f-sekcja">👤 Odbiorca</h3>
      <div class="f-row">
        <div class="f-group"><label>Imię</label><input name="imie" value="${esc(klient.imie||"")}"></div>
        <div class="f-group"><label>Nazwisko</label><input name="nazwisko" value="${esc(klient.nazwisko||"")}"></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>E-mail *</label><input name="email" type="email" value="${esc(z.email||"")}"></div>
        <div class="f-group"><label>Telefon *</label><input name="telefon" value="${esc(klient.telefon||"")}" placeholder="9 cyfr"></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Firma (opcjonalnie)</label><input name="firma" value="${esc(klient.firma||"")}"></div>
        <div class="f-group"><label>NIP (opcjonalnie)</label><input name="nip" value="${esc(klient.nip||"")}"></div>
      </div>
      <h3 class="f-sekcja">📦 Dostawa i gabaryt</h3>
      <div class="f-row">
        <div class="f-group"><label>Sposób dostawy</label><select name="dostawaTyp" onchange="przelaczDostawaAdmin(this)">
          <option value="paczkomat" ${paczkomatZam?"selected":""}>Paczkomat / punkt InPost</option>
          <option value="kurier_inpost" ${!paczkomatZam?"selected":""}>Kurier InPost</option>
        </select></div>
        <div class="f-group"><label>Gabaryt paczki</label><select name="gabaryt">
          <option value="small" ${(w.gabaryt||"small")==="small"?"selected":""}>Gabaryt A — mały (8 × 38 × 64 cm)</option>
          <option value="medium" ${w.gabaryt==="medium"?"selected":""}>Gabaryt B — średni (19 × 38 × 64 cm)</option>
          <option value="large" ${w.gabaryt==="large"?"selected":""}>Gabaryt C — duży (41 × 38 × 64 cm)</option>
        </select></div>
      </div>
      <div class="f-row" id="admPaczkomatRow" style="${paczkomatZam?"":"display:none"}">
        <div class="f-group"><label>Paczkomat / punkt InPost *</label><input name="paczkomat" id="admPaczkomat" value="${esc(z.paczkomat||w.punktKod||"")}" placeholder="np. WAW01M" style="text-transform:uppercase"></div>
        <div class="f-group" style="display:flex;align-items:flex-end"><button type="button" class="btn" style="background:#ffcc00;color:#111;font-weight:800" onclick="otworzGeowidgetAdmin()">🗺️ Wybierz paczkomat na mapie</button></div>
      </div>
      <input type="hidden" name="paczkomatAdres" id="admPaczkomatAdresVal" value="${esc(z.paczkomatAdres||"")}">
      <div id="admPaczkomatAdres" style="font-size:.85rem;color:var(--muted2);margin:-.3rem 0 .7rem">${(z.paczkomatAdres||"").trim()?`📮 ${esc(czyscAdresPaczkomatu(z.paczkomatAdres))}`:""}</div>
      <h3 class="f-sekcja">📍 Adres odbiorcy${paczkomatZam?" (do faktury / awaryjnie)":" *"}</h3>
      <div class="f-row">
        <div class="f-group"><label>Ulica${paczkomatZam?"":" *"}</label><input name="ulica" value="${esc(adres.ulica||"")}"></div>
        <div class="f-group"><label>Nr domu${paczkomatZam?"":" *"}</label><input name="nrDomu" value="${esc(adres.nrDomu||"")}"></div>
        <div class="f-group"><label>Nr lokalu</label><input name="nrLokalu" value="${esc(adres.nrLokalu||"")}"></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Kod pocztowy${paczkomatZam?"":" *"}</label><input name="kod" value="${esc(adres.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div>
        <div class="f-group"><label>Miejscowość${paczkomatZam?"":" *"}</label><input name="miasto" value="${esc(adres.miasto||"")}"></div>
      </div>
      <details style="margin:.4rem 0"><summary style="cursor:pointer;color:var(--muted2)">Wymiary i waga (użyj, gdy nie chcesz gabarytu) oraz numer nadania ręcznie</summary>
        <div class="f-row" style="margin-top:.6rem">
          <div class="f-group"><label>Waga (kg)</label><input name="waga" type="number" step=".01" min=".01" value="${esc(w.waga||uw.waga)}"></div>
          <div class="f-group"><label>Długość (cm)</label><input name="dlugosc" type="number" min="1" value="${esc(w.dlugosc||uw.dlugosc)}"></div>
          <div class="f-group"><label>Szerokość (cm)</label><input name="szerokosc" type="number" min="1" value="${esc(w.szerokosc||uw.szerokosc)}"></div>
          <div class="f-group"><label>Wysokość (cm)</label><input name="wysokosc" type="number" min="1" value="${esc(w.wysokosc||uw.wysokosc)}"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Numer nadania (ręcznie)</label><input name="numer" value="${esc(w.numer)}" placeholder="Zwykle uzupełni się automatycznie"></div>
          <div class="f-group"><label>Własny link śledzenia</label><input name="trackingUrl" type="url" value="${esc(w.trackingUrl)}" placeholder="https://…"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Dodatkowa ochrona / ubezpieczenie (zł)</label><input name="ochrona" inputmode="decimal" value="${esc(w.ochrona||"")}" placeholder="np. 200.00"></div>
          <div class="f-group"><label>Wartość pobrania (zł)</label><input name="pobranie" inputmode="decimal" value="${esc(w.pobranie||(z.platnoscId==="pobranie"?kwotaNum(z.razem).toFixed(2):""))}" placeholder="tylko dla pobrania"></div>
          <div class="f-group"><label>Paczka w Weekend</label><select name="paczkaWeekend"><option value="" ${!w.paczkaWeekend?"selected":""}>NIE</option><option value="tak" ${w.paczkaWeekend?"selected":""}>TAK (+${zl(OPLATA_PACZKA_WEEKEND)})</option></select></div>
        </div>
      </details>
      <div class="f-group"><label>Uwagi do zamówienia</label><textarea name="uwagi" rows="2">${esc(z.uwagi||"")}</textarea></div>
      ${panelEtykietInpostHTML(z)}
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz dane</button>
      </div>
      <p style="font-size:.8rem;color:var(--muted2);margin:.4rem 0 0">Najpierw „Zapisz dane”, potem użyj panelu etykiet. Numer nadania i status pojawią się automatycznie u góry tej sekcji.</p>
    </form>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">💳 Płatność</h2>
      <div class="summary" style="margin:.4rem 0 ${z.platnoscId==="paynow"?".8rem":"0"}">
        <div><span>Metoda</span><span><b>${esc(z.platnosc||"—")}</b></span></div>
        <div><span>Status płatności</span><span>${esc(z.platnoscStatus||(z.platnoscId==="paynow"?paynowStatusTekst(paynow.status):"—"))}</span></div>
      ${podsumowanieKosztowHTML(z,"Kwota")}
    </div>
    ${z.platnoscId==="paynow"?`<div class="diag-actions"><button class="btn ghost" type="button" onclick="odswiezStatusPaynow(${jsArg(z.nr)},${jsArg(paynow.paymentId||"")})">🔄 Odśwież Paynow</button>${paynow.redirectUrl?`<a class="btn" href="${esc(paynow.redirectUrl)}" target="_blank" rel="noopener">Otwórz link płatności</a>`:""}${String(paynow.status||"").toUpperCase()==="CONFIRMED"?`<button class="btn" type="button" style="background:#0ea5e9;color:#fff" onclick="zwrotPieniedzyPaynow(${jsArg(z.nr)})">💸 Zwrot pieniędzy przez Paynow</button>`:""}</div>`:""}
    ${Array.isArray(paynow.refunds)&&paynow.refunds.length?`<div class="backend-note" style="border-color:#7dd3fc;background:#f0f9ff;color:#075985"><b>Zwroty Paynow:</b><br>${paynow.refunds.map(r=>`${zl((Number(r.amount)||0)/100)} • <code>${esc(r.refundId||"—")}</code> • ${esc(r.status||"—")}${r.ts?` • ${esc(new Date(r.ts).toLocaleString("pl-PL"))}`:""}`).join("<br>")}</div>`:""}
  </div>
  <div class="panel">
    <h2 style="margin-top:0">📍 Historia śledzenia</h2>
    ${(w.historia||[]).length?`<div class="ship-timeline">${[...(w.historia||[])].reverse().map(h=>`<div class="ship-event"><b>${esc(h.status)}</b>${h.opis?` — ${esc(h.opis)}`:""}<small>${esc(h.czas)}</small></div>`).join("")}</div>`:`<p style="color:var(--muted2)">Brak zdarzeń. Po podłączeniu webhooków historia będzie aktualizowana automatycznie.</p>`}
    <form onsubmit="dodajZdarzenieWysylki(event,'${esc(z.nr)}')">
      <div class="f-row"><div class="f-group"><label>Status zdarzenia</label><select name="status"><option>Przyjęta przez InPost</option><option>Przekazana do InPost</option><option>W sortowni</option><option>W drodze</option><option>W doręczeniu</option><option>Dostarczona</option><option>Zwrot do nadawcy</option><option>Problem z doręczeniem</option><option>Opóźnienie InPost</option><option>Nieudana próba doręczenia</option></select></div><div class="f-group"><label>Opis / lokalizacja</label><input name="opis" placeholder="Np. sortownia Warszawa"></div></div>
      <button class="btn ghost" type="submit">➕ Dodaj zdarzenie ręcznie</button>
    </form>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">✉️ Powiadomienia klienta</h2>
    <div class="backend-note" style="${emailPolaczony?"border-color:#86efac;background:#f0fdf4;color:#166534":emailGotowy?"":"border-color:#f59e0b"}">
      <b>${emailPolaczony?"Automatyczna wysyłka SMTP jest gotowa":emailGotowy?"SMTP jest skonfigurowany":"Automatyczna wysyłka wymaga konfiguracji SMTP/Gmail w Netlify"}.</b>
      ${emailPolaczony?` Wiadomości wysyła ${esc(stanBramki.email.provider||"SMTP")}; wynik i identyfikator trafiają do historii.`:emailGotowy?` Wpisz hasło bazy administratora, aby wysyłać ręczne wiadomości.`:` Ustaw zmienne <code>SMTP_USER</code> i <code>SMTP_PASS</code> w Netlify.`}
      ${!emailPolaczony?` <a href="#/admin/dostawy">Konfiguracja e-mail →</a>`:""}
    </div>
    <div class="diag-actions">
      ${Object.entries(NAZWY_EMAILI).map(([id,n])=>emailPolaczony
        ?`<button class="btn" onclick="wyslijEmailWysylki('${esc(z.nr)}','${id}')" ${z.email?"":"disabled"}>📧 Wyślij: ${esc(n)}</button>`
        :`<button class="btn ghost" onclick="otworzEmailWysylki('${esc(z.nr)}','${id}')" ${z.email?"":"disabled"}>✉️ Szkic: ${esc(n)}</button>`
      ).join("")}
    </div>
    ${(w.powiadomienia||[]).length?`<div class="ship-timeline">${[...(w.powiadomienia||[])].reverse().map(p=>`<div class="ship-event"><b>${esc(NAZWY_EMAILI[p.typ]||p.typ)}</b> — ${esc(p.status)}${p.automatyczne?" • automatycznie":""}${p.provider?` • ${esc(p.provider)}`:""}${p.id?`<br><code>${esc(p.id)}</code>`:""}${p.blad?`<br><span style="color:var(--danger)">${esc(p.blad)}</span>`:""}<small>${esc(p.czas)}</small></div>`).join("")}</div>`:`<p style="color:var(--muted2)">Brak wysłanych wiadomości dla tego zamówienia.</p>`}
    <div class="diag-actions" style="margin-top:.7rem">
      <button class="btn ghost" onclick="drukujZamowienie('${esc(z.nr)}')">🖨️ Drukuj zamówienie</button>
      <button class="btn danger" onclick="if(confirm('Usunąć zamówienie ${esc(z.nr)}?')) usunZamowienie('${esc(z.nr)}')">🗑️ Usuń zamówienie</button>
    </div>
  </div>`);
}
function zapiszDaneOdbiorcy(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), g=k=>String(f.get(k)||"").trim();
  aktualizujZamowienie(nr, z=>{
    z.klient=z.klient||{};
    z.klient.imie=g("imie"); z.klient.nazwisko=g("nazwisko"); z.klient.telefon=g("telefon");
    z.klient.firma=g("firma"); z.klient.nip=g("nip").replace(/[^0-9]/g,"");
    const em=g("email").toLowerCase(); if(em) z.email=em;
    z.adresDostawy=z.adresDostawy||{};
    z.adresDostawy.ulica=g("ulica"); z.adresDostawy.nrDomu=g("nrDomu"); z.adresDostawy.nrLokalu=g("nrLokalu");
    z.adresDostawy.kod=g("kod"); z.adresDostawy.miasto=g("miasto");
    if(f.has("paczkomat")){ const kod=g("paczkomat").toUpperCase(); z.paczkomat=kod; z.paczkomatAdres=g("paczkomatAdres"); const w=daneWysylki(z); w.punktKod=kod; z.wysylka=w; }
    z.uwagi=g("uwagi");
    const a=z.adresDostawy;
    z.adres=`${a.ulica} ${a.nrDomu}${a.nrLokalu?"/"+a.nrLokalu:""}, ${a.kod} ${a.miasto}`.replace(/\s+/g," ").replace(/^[,\s]+|[,\s]+$/g,"").trim();
  });
  loguj("info",`Zaktualizowano dane odbiorcy zamówienia ${nr}`);
  toast("Dane odbiorcy zapisane ✅");
  renderuj();
}
function przelaczDostawaAdmin(sel){
  const row=$("admPaczkomatRow"); if(row) row.style.display = sel.value==="paczkomat" ? "" : "none";
}
function zapiszNadanie(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), g=k=>String(f.get(k)||"").trim();
  aktualizujZamowienie(nr, z=>{
    const stareRazem=kwotaNum(z.razem);
    z.klient=z.klient||{};
    z.klient.imie=g("imie"); z.klient.nazwisko=g("nazwisko"); z.klient.telefon=g("telefon");
    z.klient.firma=g("firma"); z.klient.nip=g("nip").replace(/[^0-9]/g,"");
    const em=g("email").toLowerCase(); if(em) z.email=em;
    z.adresDostawy=z.adresDostawy||{};
    z.adresDostawy.ulica=g("ulica"); z.adresDostawy.nrDomu=g("nrDomu"); z.adresDostawy.nrLokalu=g("nrLokalu");
    z.adresDostawy.kod=g("kod"); z.adresDostawy.miasto=g("miasto");
    const typ = g("dostawaTyp")==="kurier_inpost" ? "kurier_inpost" : "paczkomat";
    z.dostawaId=typ;
    z.dostawa = typ==="paczkomat" ? "Paczkomat InPost 24/7" : "Kurier InPost";
    const w=daneWysylki(z);
    if(typ==="paczkomat"){ const kod=g("paczkomat").toUpperCase(); z.paczkomat=kod; w.punktKod=kod; z.paczkomatAdres=g("paczkomatAdres"); }
    else { z.paczkomat=""; z.paczkomatAdres=""; w.punktKod=""; }
    const gab=g("gabaryt"); if(["small","medium","large"].includes(gab)) w.gabaryt=gab;
    if(g("waga")) w.waga=g("waga"); if(g("dlugosc")) w.dlugosc=g("dlugosc"); if(g("szerokosc")) w.szerokosc=g("szerokosc"); if(g("wysokosc")) w.wysokosc=g("wysokosc");
    const pobranieForm=g("pobranie");
    w.ochrona=g("ochrona"); w.pobranie=pobranieForm; w.paczkaWeekend=g("paczkaWeekend")==="tak"; w.formatEtykiety=g("formatEtykiety").toUpperCase()==="A4"?"A4":"A6";
    if(f.has("numer")) w.numer=g("numer");
    if(f.has("trackingUrl")) w.trackingUrl=g("trackingUrl");
    w.przewoznik="inpost"; w.usluga = typ==="paczkomat" ? "Paczkomat 24/7" : "Kurier InPost";
    z.wysylka=w;
    zapiszKosztyZamowienia(z,{dostawaId:typ,paczkaWeekend:w.paczkaWeekend});
    if(z.platnoscId==="pobranie" && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) w.pobranie=kwotaNum(z.razem).toFixed(2);
    z.uwagi=g("uwagi");
    const a=z.adresDostawy;
    z.adres=`${a.ulica} ${a.nrDomu}${a.nrLokalu?"/"+a.nrLokalu:""}, ${a.kod} ${a.miasto}`.replace(/\s+/g," ").replace(/^[,\s]+|[,\s]+$/g,"").trim();
  });
  loguj("info",`Zapisano dane nadania zamówienia ${nr}`);
  toast("Zapisano dane nadania ✅");
  renderuj();
}
async function otworzGeowidgetAdmin(){
  const cfg=await pobierzInpostConfig();
  if(!cfg||!cfg.geowidgetToken){ toast("Mapa paczkomatów niedostępna — wpisz kod ręcznie"); const h=$("admPaczkomat"); if(h) h.focus(); return; }
  try{ await ladujGeowidgetSDK(); }catch(e){ toast(e.message||"Błąd mapy InPost"); return; }
  window.__geoTarget="admin";
  let ov=$("geoOverlay");
  if(!ov){ ov=document.createElement("div"); ov.id="geoOverlay"; ov.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:2vmin"; document.body.appendChild(ov); }
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;width:min(980px,96vw);height:min(88vh,780px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;background:#111;color:#fff"><b>Wybierz paczkomat InPost</b><button type="button" onclick="zamknijGeowidget()" style="background:#ffcc00;color:#111;border:0;border-radius:8px;padding:.4rem .8rem;font-weight:800;cursor:pointer">Zamknij ✕</button></div>
    <div style="flex:1;min-height:0"><inpost-geowidget onpoint="artwayPunktWybrany" token="${esc(cfg.geowidgetToken)}" language="pl" config="parcelCollect" style="width:100%;height:100%;display:block"></inpost-geowidget></div>
  </div>`;
  ov.style.display="flex";
}
function zmienStatus(nr, status){
  const t = pobierzZamowienia();
  const z = t.find(x=>x.nr===nr);
  if(z){
    const poprzedni=z.status;
    z.status = status;
    const w=daneWysylki(z);
    const mapaEtapow={"nowe":"do_obslugi","potwierdzone":"do_obslugi","w realizacji":"przygotowanie","gotowe do wysyłki":"przygotowanie","nadane":"transport","wysłane":"transport","w doręczeniu":"doreczenie","dostarczone":"dostarczona","zakończone":"dostarczona","zwrot":"zwrot","zwrot pieniędzy":"zwrot","anulowane":"anulowana"};
    if(mapaEtapow[status]) w.etap=mapaEtapow[status];
    w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status:"Status zamówienia",opis:`${poprzedni} → ${status}`}];
    z.wysylka=w;
    zapiszLS("artway_zamowienia", t);
    loguj("info",`Zmieniono status zamówienia ${nr} → ${status}`);
    toast(`${nr}: ${status} ✅`);
    // Serwer sam wyśle e-mail statusowy przy zapisie; awaryjnie (brak połączenia z bazą) próbujemy z panelu
    zapiszZamowienieCentralnie(z,false).then(d=>{ if(poprzedni!==status && !d) void obsluzAutomatycznyEmail(nr,status); });
  }
  renderuj();
}
async function usunZamowienie(nr){
  const numer=nrZamowienia(nr), z=pobierzZamowienia().find(x=>x.nr===numer);
  oznaczZamowienieUsuniete(numer,{by:"admin",email:z?.email||""});
  zapiszLS("artway_zamowienia", pobierzZamowienia().filter(x=>x.nr!==numer));
  if(chmuraToken){
    try{
      await chmura("store-order-delete",{method:"POST",body:{number:numer}});
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    }catch(bl){
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
      toast("Usunięto lokalnie, ale nie zapisano na serwerze: "+bl.message);
    }
  }else{
    toast("Usunięto lokalnie. Wpisz hasło bazy, aby utrwalić usunięcie na serwerze.");
  }
  loguj("info","Usunięto zamówienie "+nr);
  toast("Zamówienie usunięte — nie wróci do obsługi");
  if(trasa().startsWith("/admin/zamowienie/")) location.hash="#/admin/zamowienia"; else renderuj();
}
let szukajKlientow = "";
function zmienRoleUzytkownika(email){
  if(!jestAdmin()){ toast("Brak uprawnień"); return; }
  const e=String(email||"").toLowerCase(),u=pobierzUzytkownikow(),k=u.find(x=>x.email===e);
  if(!k){ toast("Nie znaleziono użytkownika"); return; }
  if(jestGlownymAdminem(e)){ toast("Nie można zmienić roli głównego administratora"); return; }
  const maRole=k.rola==="admin";
  if(maRole&&sesja?.email===e){ toast("Nie możesz odebrać uprawnień aktualnie używanemu kontu"); return; }
  k.rola=maRole?"klient":"admin";
  zapiszLS("artway_uzytkownicy",u);
  void zapiszUzytkownikaCentralnie(k);
  loguj("info",`${maRole?"Odebrano":"Nadano"} rolę administratora: ${e}`);
  toast(maRole?"Odebrano uprawnienia administratora":"Nadano uprawnienia administratora 🛡️");
  renderuj();
}
function widokAdminKlienci(){
  let kl = pobierzUzytkownikow();
  if(szukajKlientow) kl = kl.filter(k=>(k.imie+" "+k.email).toLowerCase().includes(szukajKlientow));
  const zam = pobierzZamowienia();
  return adminSzkielet("/admin/klienci", `
  <div class="panel">
    <h1>➕ Dodaj klienta (pełna kartoteka)</h1>
    <form onsubmit="dodajKlientaAdmin(event)">
      ${polaKartotekiHTML({})}
      <button class="btn" type="submit">➕ Utwórz konto klienta</button>
    </form>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">Konto trafia do wspólnej bazy serwerowej. Klient może zalogować się na dowolnym urządzeniu.</p>
  </div>
  <div class="panel">
    <h1>👥 Użytkownicy (${kl.length}) <button class="btn ghost" style="float:right" onclick="eksportujKlientow()">📤 CSV</button></h1>
    <input placeholder="Szukaj: imię, e-mail…" value="${esc(szukajKlientow)}" oninput="szukajKlientow=this.value.toLowerCase();renderuj()" style="width:100%;max-width:320px;margin:.5rem 0 .8rem;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
    <table class="log-table">
      <tr><th>Imię i nazwisko</th><th>E-mail</th><th>Rola</th><th>Rejestracja</th><th>Zamówień</th><th>Akcje</th></tr>
      ${kl.map(k=>{
        const admin = kontoMaRoleAdmin(k.email), glowny=jestGlownymAdminem(k.email);
        const nZam = zam.filter(z=>z.email===k.email).length;
        return `<tr>
        <td><a href="#/admin/klient/${encodeURIComponent(k.email)}"><b>${esc(k.imie)}</b></a>${admin?' <span class="lvl lvl-info">ADMIN</span>':""}${k.nip?' <span class="lvl lvl-info">firma</span>':""}</td>
        <td>${esc(k.email)}${k.telefon?`<br><small style="color:var(--muted2)">📞 ${esc(k.telefon)}</small>`:""}</td>
        <td><span class="lvl ${admin?"lvl-info":""}">${admin?"administrator":"klient"}</span>${glowny?"<br><small>właściciel</small>":""}</td>
        <td>${new Date(k.data).toLocaleDateString("pl-PL")}</td>
        <td>${nZam ? `<a href="#/admin/zamowienia" onclick="szukajZamowien='${esc(k.email)}';filtrZamowien='wszystkie'" title="Zamówienia klienta">${nZam} →</a>` : "0"}</td>
        <td style="white-space:nowrap">
          <a class="btn ghost" href="#/admin/klient/${encodeURIComponent(k.email)}" style="padding:.3rem .55rem" title="Kartoteka klienta">📇</a>
          ${glowny||sesja?.email===k.email?"":`<button class="btn ghost" onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')" style="padding:.3rem .55rem" title="${admin?"Odbierz rolę administratora":"Nadaj rolę administratora"}">${admin?"🔒":"🛡️"}</button>`}
          ${admin?"":`<button class="ci-remove" onclick="if(confirm('Usunąć konto ${esc(k.email)}?')) usunKlienta('${esc(k.email)}')" title="Usuń konto">🗑️</button>`}
        </td>
      </tr>`;}).join("")}
    </table>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">📇 otwiera pełną kartotekę klienta: dane kontaktowe, adres, dane firmowe, notatka, nowe hasło. Zamówienia klienta otworzysz, klikając ich liczbę.</p>
  </div>`);
}
/* ── Pełna kartoteka klienta ── */
function pobierzProfil(email){ return pobierzUzytkownikow().find(x=>x.email===String(email||"").toLowerCase()); }
function polaKartotekiHTML(k, opcje={}){
  return `
      <h3 class="f-sekcja">👤 Dane kontaktowe</h3>
      <div class="f-row">
        <div class="f-group"><label>Imię i nazwisko *</label><input required name="imie" value="${esc(k.imie||"")}"></div>
        <div class="f-group"><label>E-mail *</label><input required name="email" type="email" value="${esc(k.email||"")}" ${opcje.blokujEmail?"readonly style='background:var(--line)'":""}></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Telefon</label><input name="telefon" type="tel" value="${esc(k.telefon||"")}" placeholder="np. 600 100 200"></div>
      </div>
      ${opcje.bezHasla?"":`<div class="f-row">
        <div class="f-group"><label>${opcje.edycja?"Nowe hasło (puste = bez zmiany)":"Hasło startowe * (min. 6 znaków)"}</label>
          <input name="haslo" type="password" minlength="6" ${opcje.edycja?"":"required"} autocomplete="new-password"></div>
        <div class="f-group"><label>${opcje.edycja?"Powtórz nowe hasło":"Powtórz hasło startowe *"}</label>
          <input name="haslo2" type="password" minlength="6" ${opcje.edycja?"":"required"} autocomplete="new-password"></div>
      </div>`}
      <h3 class="f-sekcja">📍 Adres</h3>
      <div class="f-row" style="grid-template-columns:2fr 1fr 1fr">
        <div class="f-group"><label>Ulica</label><input name="ulica" value="${esc(k.ulica||"")}"></div>
        <div class="f-group"><label>Nr domu</label><input name="nrDomu" value="${esc(k.nrDomu||"")}"></div>
        <div class="f-group"><label>Nr lokalu</label><input name="nrLokalu" value="${esc(k.nrLokalu||"")}"></div>
      </div>
      <div class="f-row" style="grid-template-columns:1fr 2fr">
        <div class="f-group"><label>Kod pocztowy</label><input name="kod" value="${esc(k.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div>
        <div class="f-group"><label>Miejscowość</label><input name="miasto" value="${esc(k.miasto||"")}"></div>
      </div>
      <h3 class="f-sekcja">🧾 Dane firmowe (jeśli klient kupuje na firmę)</h3>
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>NIP</label><input name="nip" value="${esc(k.nip||"")}" placeholder="10 cyfr" maxlength="13" inputmode="numeric"></div>
        <div class="f-group"><button type="button" class="btn ghost" onclick="nipDoFormularza(this.form, this)">⬇️ Pobierz dane z NIP</button></div>
      </div>
      <div class="f-group"><label>Nazwa firmy</label><input name="firma" value="${esc(k.firma||"")}"></div>
      ${opcje.bezNotatki?"":`<div class="f-group"><label>📝 Notatka o kliencie (widzi tylko admin)</label><textarea name="notatka" rows="2" maxlength="500">${esc(k.notatka||"")}</textarea></div>`}`;
}
function daneKartotekiZFormularza(f){
  const d = {
    imie: String(f.get("imie")||"").trim(),
    telefon: String(f.get("telefon")||"").trim(),
    ulica: String(f.get("ulica")||"").trim(),
    nrDomu: String(f.get("nrDomu")||"").trim(),
    nrLokalu: String(f.get("nrLokalu")||"").trim(),
    kod: String(f.get("kod")||"").trim(),
    miasto: String(f.get("miasto")||"").trim(),
    nip: String(f.get("nip")||"").replace(/[^0-9]/g,""),
    firma: String(f.get("firma")||"").trim()
  };
  if(f.get("notatka")!==null) d.notatka = String(f.get("notatka")||"").trim();
  if(d.nip && !walidujNip(d.nip)) return {blad:"Nieprawidłowy NIP — sprawdź numer"};
  return d;
}
function widokAdminKlient(email){
  const k = pobierzProfil(email);
  if(!k) return adminSzkielet("/admin/klienci", `<div class="panel"><h1>Nie znaleziono klienta</h1><p><a href="#/admin/klienci">← Wróć do listy</a></p></div>`);
  const zam = pobierzZamowienia().filter(z=>z.email===k.email);
  const admin = kontoMaRoleAdmin(k.email), glowny=jestGlownymAdminem(k.email);
  return adminSzkielet("/admin/klienci", `
  <div class="panel">
    <div class="crumb"><a href="#/admin/klienci">Klienci</a> › ${esc(k.imie)}</div>
    <h1>📇 ${esc(k.imie)} ${admin?'<span class="lvl lvl-info">ADMIN</span>':""} ${k.nip?'<span class="lvl lvl-info">firma</span>':""}</h1>
    <div class="stat-grid">
      <div class="stat"><b>${zam.length}</b><small>zamówień</small></div>
      <div class="stat"><b>${zl(zam.filter(z=>z.status!=="anulowane").reduce((s,z)=>s+z.razem,0))}</b><small>łączna wartość</small></div>
      <div class="stat"><b>${new Date(k.data).toLocaleDateString("pl-PL")}</b><small>rejestracja</small></div>
    </div>
    <form onsubmit="zapiszKartoteke(event, '${esc(k.email)}')">
      ${polaKartotekiHTML(k, {edycja:true, blokujEmail:glowny})}
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz kartotekę</button>
        ${glowny||sesja?.email===k.email?"":`<button class="btn ghost" type="button" onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')">${admin?"🔒 Odbierz rolę administratora":"🛡️ Nadaj rolę administratora"}</button>`}
        ${zam.length?`<a class="btn ghost" href="#/admin/zamowienia" onclick="szukajZamowien='${esc(k.email)}';filtrZamowien='wszystkie'">📦 Zamówienia klienta (${zam.length})</a>`:""}
        <a class="btn ghost" href="mailto:${esc(k.email)}">✉️ Napisz e-mail</a>
        ${admin?"":`<button class="btn danger" type="button" onclick="if(confirm('Usunąć konto ${esc(k.email)}?')){usunKlienta('${esc(k.email)}');location.hash='#/admin/klienci';}">🗑️ Usuń konto</button>`}
      </div>
    </form>
  </div>
  ${zam.length?`<div class="panel">
    <h2 style="margin-top:0">🕐 Ostatnie zamówienia klienta</h2>
    <table class="mini-tab">${zam.slice(0,5).map(z=>`
      <tr><td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a></td>
      <td>${esc(z.data)}</td><td><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">${esc(z.status)}</span></td>
      <td style="text-align:right"><b>${zl(z.razem)}</b></td></tr>`).join("")}</table>
  </div>`:""}`);
}
async function zapiszKartoteke(e, staryEmail){
  e.preventDefault();
  const f = new FormData(e.target);
  const u = pobierzUzytkownikow();
  const k = u.find(x=>x.email===staryEmail);
  if(!k){ toast("Nie znaleziono klienta"); return; }
  const glownyAdmin = jestGlownymAdminem(staryEmail);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  const nowyEmail = glownyAdmin ? staryEmail : String(f.get("email")||"").trim().toLowerCase();
  const noweHaslo = String(f.get("haslo")||"");
  const powtorzoneHaslo = String(f.get("haslo2")||"");
  if(dane.imie.length<2){ toast("⚠️ Podaj imię i nazwisko"); return; }
  if(!nowyEmail.includes("@")){ toast("⚠️ Nieprawidłowy e-mail"); return; }
  if(nowyEmail!==staryEmail && u.some(x=>x.email===nowyEmail)){ toast("⚠️ Ten e-mail jest już zajęty"); return; }
  if(noweHaslo && noweHaslo.length<6){ toast("⚠️ Nowe hasło: min. 6 znaków"); return; }
  if(noweHaslo!==powtorzoneHaslo){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  Object.assign(k, dane, {email: nowyEmail});
  if(noweHaslo){ k.hash = await hashuj(noweHaslo); if(glownyAdmin) domyslneHasloAdmina = noweHaslo==="admin"; }
  zapiszLS("artway_uzytkownicy", u);
  void zapiszUzytkownikaCentralnie(k);
  if(nowyEmail!==staryEmail){
    const zam = pobierzZamowienia();
    zam.forEach(z=>{ if(z.email===staryEmail) z.email=nowyEmail; });
    zapiszLS("artway_zamowienia", zam);
    if(stanBramki.authenticated){
      void wywolajBramke("store-user-delete",{method:"POST",body:{email:staryEmail}}).catch(()=>{});
      zam.filter(z=>z.email===nowyEmail).forEach(z=>void zapiszZamowienieCentralnie(z,false));
    }
    if(sesja?.email===staryEmail) ustawSesje({imie:dane.imie, email:nowyEmail, rola:k.rola||"klient"});
    location.hash = "#/admin/klient/"+encodeURIComponent(nowyEmail);
  } else if(sesja?.email===staryEmail && sesja.imie!==dane.imie){
    ustawSesje({imie:dane.imie, email:staryEmail, rola:k.rola||"klient"});
  }
  loguj("info",`Zapisano kartotekę klienta ${staryEmail}${nowyEmail!==staryEmail?" → "+nowyEmail:""}${noweHaslo?" (nowe hasło)":""}`);
  toast("Kartoteka zapisana ✅"); renderuj();
}
async function dodajKlientaAdmin(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ toast("⚠️ Wpisane hasła nie są takie same"); return; }
  const wynik = await zarejestrujUzytkownika(String(f.get("imie")),String(f.get("email")),String(f.get("haslo")));
  if(!wynik.ok){ toast("⚠️ "+wynik.blad); return; }
  // dopisz pełną kartotekę (adres, firma, notatka)
  const u = pobierzUzytkownikow();
  const k = u.find(x=>x.email===String(f.get("email")).trim().toLowerCase());
  if(k){ Object.assign(k, dane); zapiszLS("artway_uzytkownicy", u); }
  if(k) void zapiszUzytkownikaCentralnie(k);
  loguj("info","Utworzono kartotekę klienta: "+f.get("email"));
  toast("Konto klienta z kartoteką utworzone ✅"); renderuj();
}
function usunKlienta(email){
  if(kontoMaRoleAdmin(email)){ toast("Najpierw odbierz temu kontu rolę administratora"); return; }
  zapiszLS("artway_uzytkownicy", pobierzUzytkownikow().filter(x=>x.email!==email));
  if(stanBramki.authenticated) void wywolajBramke("store-user-delete",{method:"POST",body:{email}}).catch(bl=>toast("Nie usunięto klienta z serwera: "+bl.message));
  loguj("info","Usunięto konto klienta: "+email);
  toast("Usunięto konto "+email);
  renderuj();
}
let szukajProduktow = "", filtrProduktow = "Wszystkie", kategoriaNowegoProduktu = "";
let filtrStatusuProduktow = "wszystkie", filtrZrodlaProduktow = "wszystkie", filtrStanuProduktow = "wszystkie";
let sortowanieAdminProduktow = "id";
let stronaAdminProduktow = 1;
let produktyNaStronieAdmin = [25,50,100,200].includes(Number(wczytajLS("artway_produkty_na_stronie_admin",50)))?Number(wczytajLS("artway_produkty_na_stronie_admin",50)):50;
function jestProduktemDodanym(id){ return produktyDodane.some(p=>Number(p.id)===Number(id)); }
function produktDodanyPoId(id){ return produktyDodane.find(p=>Number(p.id)===Number(id)); }
function czyProduktAdminWKoszu(p){
  if(!p) return false;
  if(jestProduktemDodanym(p.id)) return false;
  return produktyUkryte.includes(p.id);
}
function bazoweProduktyWKoszu(){
  const dodaneIds=new Set(produktyDodane.map(p=>Number(p.id)));
  return produktyUkryte
    .filter(id=>!dodaneIds.has(Number(id))&&koszMeta[id]&&!produktyDefinitywne.includes(id))
    .map(id=>prodBazowe.find(x=>Number(x.id)===Number(id)))
    .filter(Boolean);
}
function produktyDoAdministracji(){
  naprawKolizjeIdProduktow();
  const dodaneIds = new Set(produktyDodane.map(p=>Number(p.id)));
  return [
    ...prodBazowe.filter(p=>!dodaneIds.has(Number(p.id))&&!produktyDefinitywne.includes(p.id)).map(p=>produktyEdytowane[p.id] ? {...p, ...produktyEdytowane[p.id], id:p.id} : p),
    ...produktyDodane
  ];
}
function pobierzProduktAdmin(id){ return produktDodanyPoId(id) || produktyDoAdministracji().find(p=>p.id===id); }
function ustawStroneAdminProduktow(n){ stronaAdminProduktow=Math.max(1,Number(n)||1); renderuj(); }
function ustawProduktyNaStronieAdmin(n){
  produktyNaStronieAdmin=[25,50,100,200].includes(Number(n))?Number(n):50;
  stronaAdminProduktow=1;
  zapiszLS("artway_produkty_na_stronie_admin",produktyNaStronieAdmin);
  renderuj();
}
function sortujProduktyAdmin(lista){
  return [...lista].sort((a,b)=>{
    if(sortowanieAdminProduktow==="nazwa") return a.nazwa.localeCompare(b.nazwa,"pl");
    if(sortowanieAdminProduktow==="cena-rosnaco") return a.cena-b.cena;
    if(sortowanieAdminProduktow==="cena-malejaco") return b.cena-a.cena;
    if(sortowanieAdminProduktow==="stan"){
      const sa=stanyProduktow[a.id]===undefined?Number.MAX_SAFE_INTEGER:Number(stanyProduktow[a.id]);
      const sb=stanyProduktow[b.id]===undefined?Number.MAX_SAFE_INTEGER:Number(stanyProduktow[b.id]);
      return sa-sb;
    }
    return Number(a.id)-Number(b.id);
  });
}
function widokAdminProdukty(){
  let wszystkie = produktyDoAdministracji();
  if(szukajProduktow) wszystkie = wszystkie.filter(p=>produktPasujeFrazie(p,szukajProduktow));
  if(filtrProduktow!=="Wszystkie") wszystkie = wszystkie.filter(p=>p.kategoria===filtrProduktow);
  if(filtrStatusuProduktow==="aktywne") wszystkie=wszystkie.filter(p=>!czyProduktAdminWKoszu(p));
  if(filtrStatusuProduktow==="kosz") wszystkie=wszystkie.filter(p=>czyProduktAdminWKoszu(p));
  if(filtrZrodlaProduktow==="bazowe") wszystkie=wszystkie.filter(p=>!produktyDodane.some(x=>x.id===p.id));
  if(filtrZrodlaProduktow==="wlasne") wszystkie=wszystkie.filter(p=>produktyDodane.some(x=>x.id===p.id));
  if(filtrStanuProduktow==="dostepne") wszystkie=wszystkie.filter(p=>stanyProduktow[p.id]===undefined||Number(stanyProduktow[p.id])>0);
  if(filtrStanuProduktow==="niskie") wszystkie=wszystkie.filter(p=>Number(stanyProduktow[p.id])>0&&Number(stanyProduktow[p.id])<=5);
  if(filtrStanuProduktow==="brak") wszystkie=wszystkie.filter(p=>Number(stanyProduktow[p.id])===0);
  wszystkie=sortujProduktyAdmin(wszystkie);
  const liczbaWynikow=wszystkie.length;
  const liczbaStron=Math.max(1,Math.ceil(liczbaWynikow/produktyNaStronieAdmin));
  stronaAdminProduktow=Math.min(Math.max(1,stronaAdminProduktow),liczbaStron);
  const fragment=wszystkie.slice((stronaAdminProduktow-1)*produktyNaStronieAdmin,stronaAdminProduktow*produktyNaStronieAdmin);
  const katOpcje = [...new Set(produktyDoAdministracji().map(p=>p.kategoria))];
  const bazoweWKoszu=bazoweProduktyWKoszu();
  const liczbaWKoszu=koszDodanych.length+bazoweWKoszu.length;
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <h1>🏷️ Produkty (${produkty.length} widocznych / ${produktyDoAdministracji().length}) <small style="font-size:.75rem;color:var(--muted2)">źródło: ${zrodloProduktow==="json"?"products.json":"lista zapasowa"} + zmiany lokalne</small></h1>
      <div class="diag-actions" style="margin:.4rem 0 .8rem">
        <a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a>
        <a class="btn ghost" href="#/admin/mapowanie">🧩 Mapuj produkty</a>
        <a class="btn ghost" href="#/admin/eksport">⇄ Import / eksport</a>
        <button class="btn ghost" onclick="eksportujProduktyJSON()">📤 products.json</button>
        <button class="btn ghost" onclick="eksportujProduktyCSV()">📤 CSV</button>
      </div>
      <div class="filter-grid" style="margin-bottom:.8rem">
        <input placeholder="Nazwa, SKU, ID, opis lub kategoria…" value="${esc(szukajProduktow)}" oninput="szukajProduktow=this.value;stronaAdminProduktow=1;renderuj()">
        <select onchange="filtrProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option ${filtrProduktow==="Wszystkie"?"selected":""}>Wszystkie</option>
          ${katOpcje.map(k=>`<option ${k===filtrProduktow?"selected":""}>${esc(k)}</option>`).join("")}
        </select>
        <select onchange="filtrStatusuProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="wszystkie" ${filtrStatusuProduktow==="wszystkie"?"selected":""}>Wszystkie statusy</option>
          <option value="aktywne" ${filtrStatusuProduktow==="aktywne"?"selected":""}>Tylko aktywne</option>
          <option value="kosz" ${filtrStatusuProduktow==="kosz"?"selected":""}>Tylko w koszu</option>
        </select>
        <select onchange="filtrZrodlaProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="wszystkie" ${filtrZrodlaProduktow==="wszystkie"?"selected":""}>Każde źródło</option>
          <option value="bazowe" ${filtrZrodlaProduktow==="bazowe"?"selected":""}>products.json</option>
          <option value="wlasne" ${filtrZrodlaProduktow==="wlasne"?"selected":""}>Dodane w panelu</option>
        </select>
        <select onchange="filtrStanuProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="wszystkie" ${filtrStanuProduktow==="wszystkie"?"selected":""}>Każdy stan</option>
          <option value="dostepne" ${filtrStanuProduktow==="dostepne"?"selected":""}>Dostępne</option>
          <option value="niskie" ${filtrStanuProduktow==="niskie"?"selected":""}>Niski stan (1–5)</option>
          <option value="brak" ${filtrStanuProduktow==="brak"?"selected":""}>Brak na stanie</option>
        </select>
        <select onchange="sortowanieAdminProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="id" ${sortowanieAdminProduktow==="id"?"selected":""}>Sortuj: ID</option>
          <option value="nazwa" ${sortowanieAdminProduktow==="nazwa"?"selected":""}>Nazwa A–Z</option>
          <option value="cena-rosnaco" ${sortowanieAdminProduktow==="cena-rosnaco"?"selected":""}>Cena rosnąco</option>
          <option value="cena-malejaco" ${sortowanieAdminProduktow==="cena-malejaco"?"selected":""}>Cena malejąco</option>
          <option value="stan" ${sortowanieAdminProduktow==="stan"?"selected":""}>Najniższy stan</option>
        </select>
      </div>
      <div class="results-bar">
        <span>Znaleziono: <b>${liczbaWynikow}</b>. Strona ${stronaAdminProduktow} z ${liczbaStron}.</span>
        <label>Na stronie:
          <select onchange="ustawProduktyNaStronieAdmin(this.value)">
            ${[25,50,100,200].map(n=>`<option value="${n}" ${produktyNaStronieAdmin===n?"selected":""}>${n}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="pagination" style="margin:.7rem auto">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div>
      <div class="masowe-akcje">
        <b style="font-size:.85rem">Zaznaczone (${zaznaczoneProdukty.size}):</b>
        <button class="btn danger" onclick="usunZaznaczoneProd()" style="padding:.35rem .8rem">🗑️ Usuń</button>
        <span style="display:flex;gap:.4rem;align-items:center">
          <input id="procentCen" placeholder="np. 10 lub -15" inputmode="decimal" style="width:110px;padding:.35rem .6rem;border:1.5px solid var(--line);border-radius:9px">
          <button class="btn ghost" onclick="zmienCenyZaznaczonych()" style="padding:.35rem .8rem">💰 Zmień ceny o %</button>
        </span>
      </div>
      <div style="overflow-x:auto"><table class="log-table">
        <tr><th><input type="checkbox" onchange="zaznaczWidoczneProd(this, [${fragment.map(p=>p.id).join(",")}])" style="width:16px;height:16px" title="Zaznacz produkty na tej stronie"></th><th>ID</th><th>Produkt</th><th>Kategoria</th><th>Cena (kliknij, by zmienić)</th><th>Promocja</th><th>Stan</th><th>Zdjęcie</th><th>Akcje</th></tr>
        ${fragment.map(p=>{
          const dodany = jestProduktemDodanym(p.id);
          const ukryty = czyProduktAdminWKoszu(p);
          const edytowany = !!produktyEdytowane[p.id];
          return `<tr style="${ukryty?'opacity:.45':''}">
          <td><input type="checkbox" ${zaznaczoneProdukty.has(p.id)?"checked":""} onchange="przelaczZaznProd(${p.id})" style="width:16px;height:16px"></td>
          <td>${p.id}</td>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b>${dodany?' <span class="lvl lvl-info">dodany</span>':""}${edytowany?' <span class="lvl lvl-info">edytowany</span>':""}${ukryty?' <span class="lvl lvl-ostrzezenie">usunięty</span>':""}</td>
          <td>${esc(p.kategoria)}</td>
          <td><input value="${String(p.cena.toFixed(2)).replace(".",",")}" inputmode="decimal" onchange="ustawCene(${p.id}, this.value)" style="width:80px;padding:.25rem .4rem;border:1.5px solid var(--line);border-radius:8px;text-align:right;font-weight:700"> zł</td>
          <td>${p.staraCena?`<span class="lvl lvl-blad">−${Math.round((1-p.cena/p.staraCena)*100)}%</span>`:"—"}</td>
          <td><input value="${stanyProduktow[p.id]??""}" placeholder="∞" inputmode="numeric" onchange="ustawStan(${p.id}, this.value)" style="width:58px;padding:.25rem .4rem;border:1.5px solid var(--line);border-radius:8px;text-align:center;${stanyProduktow[p.id]===0?'background:#fee2e2':''}"></td>
          <td>${p.zdjecie?"🖼️":'<span style="color:var(--muted2)">ikona</span>'}</td>
          <td style="white-space:nowrap">
            <a class="btn ghost" href="#/admin/produkty/edytuj/${p.id}" style="padding:.3rem .55rem" title="Edytuj">✏️</a>
            <button class="btn ghost" onclick="duplikujProdukt(${p.id})" style="padding:.3rem .55rem" title="Duplikuj">📄</button>
            ${ukryty
              ? `<button class="btn ghost" onclick="przywrocProdukt(${p.id})" style="padding:.3rem .55rem" title="Przywróć">↩️</button>`
              : `<button class="btn danger" onclick="if(confirm('Usunąć produkt z oferty?')) usunProduktAdmin(${p.id})" style="padding:.3rem .55rem" title="Usuń">🗑️</button>`}
          </td>
        </tr>`;}).join("")}
      </table></div>
      <div class="pagination" style="margin:.7rem auto">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div>
      <p style="font-size:.8rem;color:var(--muted2);margin-top:.8rem">Zmiany wykonane tutaj działają od razu w tej przeglądarce. Po zakończeniu pobierz nowy <b>products.json</b> i podmień go na hostingu.</p>
    </div>
    ${liczbaWKoszu ? `
    <div class="panel">
      <div class="results-bar"><h2 style="margin:0">🗑️ Kosz (${liczbaWKoszu})</h2><button class="btn danger" onclick="wyczyscCalKosz()">Opróżnij kosz</button></div>
      <p style="font-size:.82rem;color:var(--muted2);margin-bottom:.6rem">Produkty pozostają w koszu przez 30 dni. W tym czasie możesz je przywrócić; później są automatycznie usuwane definitywnie.</p>
      <table class="log-table">
        <tr><th>Produkt</th><th>Typ</th><th>Usunięto</th><th>Wygasa</th><th>Akcje</th></tr>
        ${koszDodanych.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-info">własny</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocZKosza(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnie(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
        ${bazoweWKoszu.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-ostrzezenie">z products.json</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocProdukt(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnieBazowy(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
      </table>
    </div>`:""}`);
}
function formularzProduktu(p, tryb){
  const wszystkie = produktyDoAdministracji();
  const edycja = tryb==="edycja";
  return `
    <form onsubmit="${edycja?`zapiszProduktAdmin(event,${p.id})`:"dodajProdukt(event)"}">
      <div class="f-row">
        <div class="f-group"><label>Nazwa *</label><input required name="nazwa" value="${esc(p.nazwa||"")}"></div>
        <div class="f-group"><label>Kategoria *</label><input required name="kategoria" list="katLista" placeholder="np. Elektronika" value="${esc(p.kategoria||kategoriaNowegoProduktu)}">
          <datalist id="katLista">${[...new Set([...wszystkieKategorie(), ...wszystkie.map(x=>x.kategoria)])].map(k=>`<option value="${esc(k)}">`).join("")}</datalist></div>
      </div>
      <div class="f-row" style="grid-template-columns:1fr 1fr 1fr">
        <div class="f-group"><label>Cena (zł) *</label><input required name="cena" inputmode="decimal" value="${p.cena??""}" placeholder="99.99"></div>
        <div class="f-group"><label>Stara cena (promocja)</label><input name="staraCena" inputmode="decimal" value="${p.staraCena??""}"></div>
        <div class="f-group"><label>Etykieta</label><select name="badge"><option value="">— brak —</option><option ${p.badge==="Nowość"?"selected":""}>Nowość</option><option ${p.badge==="Promocja"?"selected":""}>Promocja</option></select></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Ikona (emoji)</label><input name="ikona" value="${esc(p.ikona||"")}" placeholder="📦" maxlength="8"></div>
        <div class="f-group"><label>Zdjęcie — link lub wgraj z dysku</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie" value="${esc(p.zdjecie||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML("wgrajZdjecieProduktu(this)", "Z dysku")}
          </div>
        </div>
      </div>
      <div id="podgladZdjecia">${p.zdjecie?`<img src="${esc(p.zdjecie)}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:.6rem">`:""}</div>
      <details ${p.zdjecia?.length?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🖼️ Galeria — ręczna edycja do 16 zdjęć</summary>
        ${Array.from({length:15},(_,i)=>i+2).map(n=>`
        <div class="f-group" style="margin-top:.6rem"><label>Zdjęcie ${n}</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie${n}" value="${esc((p.zdjecia||[])[n-2]||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML(`wgrajZdjecieDoPola(this,'zdjecie${n}')`, "Z dysku")}
          </div>
        </div>`).join("")}
      </details>
      <div class="f-row">
        <div class="f-group"><label>Kod produktu (SKU) <small style="font-weight:400;color:var(--muted2)">opcjonalnie</small></label><input name="sku" value="${esc(p.sku||"")}" placeholder="np. ATM-0001" maxlength="30"></div>
        <div class="f-group"><label>Warianty <small style="font-weight:400;color:var(--muted2)">po przecinku, np. S, M, L, XL</small></label><input name="warianty" value="${esc((p.warianty||[]).join(", "))}" placeholder="np. S, M, L, XL albo Czarny, Biały"></div>
      </div>
      <details ${(p.gtin||p.externalId||p.mpn||p.marka||p.kolorProduktu||p.rozmiar||p.material)?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🏷️ Dane z hurtowni / OVF</summary>
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>GTIN / EAN</label><input name="gtin" value="${esc(p.gtin||"")}" placeholder="np. 5901234567891"></div>
          <div class="f-group"><label>EXTERNAL_ID</label><input name="externalId" value="${esc(p.externalId||"")}" placeholder="ID z hurtowni"></div>
          <div class="f-group"><label>MPN</label><input name="mpn" value="${esc(p.mpn||"")}" placeholder="Kod producenta"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Marka / BRAND</label><input name="marka" value="${esc(p.marka||"")}"></div>
          <div class="f-group"><label>Kolor produktu / COLOR</label><input name="kolorProduktu" value="${esc(p.kolorProduktu||"")}" placeholder="np. Czarny matowy"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Rozmiar / SIZE</label><input name="rozmiar" value="${esc(p.rozmiar||"")}" placeholder="np. XL lub 85x60x60 cm"></div>
          <div class="f-group"><label>Materiał / MATERIAL</label><input name="material" value="${esc(p.material||"")}" placeholder="np. bawełna, karton, stal"></div>
        </div>
      </details>
      <div class="f-group"><label>Opis pełny</label><textarea name="opis" rows="6" maxlength="10000">${esc(p.opis||"")}</textarea></div>
      <div class="f-group" style="max-width:240px"><label>Stan magazynowy <small style="font-weight:400;color:var(--muted2)">(puste = bez limitu)</small></label>
        <input name="stan" inputmode="numeric" placeholder="∞" value="${p.id!==undefined && stanyProduktow[p.id]!==undefined ? stanyProduktow[p.id] : ""}"></div>
      <div class="diag-actions">
        <button class="btn" type="submit">${edycja?"💾 Zapisz zmiany":"➕ Dodaj produkt"}</button>
        <a class="btn ghost" href="#/admin/produkty">Anuluj</a>
        ${edycja?`<button class="btn ghost" type="button" onclick="duplikujProdukt(${p.id})">📄 Duplikuj</button>`:""}
        ${edycja?`<button class="btn danger" type="button" onclick="if(confirm('Przenieść ten produkt do kosza na 30 dni?')){usunProduktAdmin(${p.id});location.hash='#/admin/produkty'}">🗑️ Przenieś do kosza</button>`:""}
        ${edycja && produktyEdytowane[p.id]?`<button class="btn danger" type="button" onclick="resetujEdycjeProduktu(${p.id})">↩️ Przywróć dane z products.json</button>`:""}
      </div>
    </form>`;
}
function widokAdminProduktyDodaj(){
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Dodaj</div>
      <h1>➕ Dodaj produkt</h1>
      ${formularzProduktu({}, "dodawanie")}
      <p style="font-size:.8rem;color:var(--muted2);margin-top:.7rem">Produkt zapisze się w tej przeglądarce i od razu pojawi w sklepie. Aby trafił na hosting dla wszystkich klientów: <b>Produkty → 📤 products.json</b> i wgraj plik na serwer. Import hurtowy z hurtowni: <b>import_produktow.py</b>.</p>
    </div>`);
}
function widokAdminProduktEdytuj(id){
  const p = pobierzProduktAdmin(id);
  if(!p) return asortymentSzkielet("produkty", `<div class="panel"><h1>Nie znaleziono produktu</h1><p><a href="#/admin/produkty">← Wróć do produktów</a></p></div>`);
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Edycja › ${esc(p.nazwa)}</div>
      <h1>✏️ Edytuj produkt #${p.id}</h1>
      ${formularzProduktu(p, "edycja")}
    </div>`);
}
function daneProduktuZFormularza(f, id, poprzedni={}){
  const cena = parseFloat(String(f.get("cena")).replace(",","."));
  if(!(cena>0)) return null;
  const p = {
    ...poprzedni,
    id,
    nazwa:String(f.get("nazwa")).trim(),
    kategoria:String(f.get("kategoria")).trim()||"Inne",
    cena:+cena.toFixed(2),
    opis:String(f.get("opis")||"").trim(),
    ikona:String(f.get("ikona")||"").trim()||"📦",
    kolor:poprzedni.kolor||"#dbeafe"
  };
  if(poprzedni.kategoria&&p.kategoria!==poprzedni.kategoria){
    delete p.sciezkaKategorii;delete p.grupaKategorii;delete p.kategoriaPelna;
  }
  const sc = parseFloat(String(f.get("staraCena")||"").replace(",","."));
  if(sc>cena) p.staraCena = +sc.toFixed(2); else delete p.staraCena;
  const zdjecie = String(f.get("zdjecie")||"").trim();
  if(zdjecie) p.zdjecie = zdjecie; else delete p.zdjecie;
  if(f.get("badge")) p.badge = String(f.get("badge")); else delete p.badge;
  const sku = String(f.get("sku")||"").trim();
  if(sku) p.sku = sku; else delete p.sku;
  for(const [pole,nazwa] of [["gtin","gtin"],["externalId","externalId"],["mpn","mpn"],["marka","marka"],["kolorProduktu","kolorProduktu"],["rozmiar","rozmiar"],["material","material"]]){
    const v=String(f.get(nazwa)||"").trim();
    if(v)p[pole]=v;else delete p[pole];
  }
  const warianty = String(f.get("warianty")||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
  if(warianty.length) p.warianty = warianty; else delete p.warianty;
  const zdjecia = Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(n=>String(f.get(n)||"").trim()).filter(Boolean);
  if(zdjecia.length) p.zdjecia = zdjecia; else delete p.zdjecia;
  return p;
}
function wgrajZdjecieDoPola(input, pole){
  wgrajObrazek(input, 900, url => {
    const form = input.closest ? input.closest("form") : input.form;
    if(form && form[pole]) form[pole].value = url;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj ✅");
  });
}
function dodajProdukt(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const maxId = Math.max(0, ...prodBazowe.map(p=>p.id), ...produktyDodane.map(p=>p.id));
  const KOLORY = ["#dbeafe","#e0e7ff","#fef3c7","#dcfce7","#fee2e2","#f3e8ff","#fce7f3","#ffedd5"];
  const p = daneProduktuZFormularza(f, maxId+1, {kolor:KOLORY[(maxId+1)%KOLORY.length]});
  if(!p){ toast("⚠️ Podaj poprawną cenę"); return; }
  produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszStanZFormularza(f, p.id);
  zbudujProdukty();
  kategoriaNowegoProduktu = "";
  loguj("info","Dodano produkt: "+p.nazwa+" ("+zl(p.cena)+")");
  toast("Produkt dodany ✅");
  if(trasa()==="/admin/produkty/dodaj") location.hash="#/admin/produkty"; else renderuj();
}
function zapiszStanZFormularza(f, id){
  const s = String(f.get("stan")??"").trim();
  if(s==="") delete stanyProduktow[id];
  else stanyProduktow[id] = Math.max(0, parseInt(s)||0);
  zapiszLS("artway_stany", stanyProduktow);
}
function zapiszProduktAdmin(e,id){
  e.preventDefault();
  const f = new FormData(e.target);
  const poprzedni = pobierzProduktAdmin(id);
  const p = daneProduktuZFormularza(f, id, poprzedni||{});
  if(!p){ toast("⚠️ Podaj poprawną cenę"); return; }
  zapiszStanZFormularza(f, id);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i] = p;
    zapiszLS("artway_produkty_dodane", produktyDodane);
  }else{
    produktyEdytowane = {...produktyEdytowane, [id]:p};
    zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  }
  zbudujProdukty(); odswiezMenu();
  loguj("info","Zapisano zmiany produktu id="+id);
  toast("Zmiany produktu zapisane ✅");
  location.hash="#/admin/produkty";
}
function duplikujProdukt(id){
  const p = pobierzProduktAdmin(id); if(!p) return;
  const maxId = Math.max(0, ...prodBazowe.map(x=>x.id), ...produktyDodane.map(x=>x.id));
  const kopia = {...p, id:maxId+1, nazwa:p.nazwa+" — kopia"};
  produktyDodane.push(kopia);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zbudujProdukty(); loguj("info",`Zduplikowano produkt ${id} jako ${kopia.id}`);
  toast("Utworzono kopię produktu 📄");
  location.hash="#/admin/produkty/edytuj/"+kopia.id;
}
function usunProdukt(id){
  const p = produktyDodane.find(x=>x.id===id);
  if(p){
    if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
    oznaczProduktWKoszu(id,"wlasny");
    zapiszLS("artway_kosz_dodane", koszDodanych);
  }
  produktyDodane = produktyDodane.filter(p=>p.id!==id);
  zapiszLS("artway_produkty_dodane", produktyDodane); zbudujProdukty();
  loguj("info","Przeniesiono produkt do kosza na 30 dni: id="+id); toast("Produkt w koszu przez 30 dni 🗑️"); renderuj();
}
function przywrocZKosza(id){
  const p = koszDodanych.find(x=>x.id===id);
  if(p&&!produktyDodane.some(x=>x.id===id)){ produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane); }
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony z kosza ↩️"); renderuj();
}
function usunDefinitywnie(id){
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  delete stanyProduktow[id];
  zapiszLS("artway_stany",stanyProduktow);
  loguj("info","Usunięto definitywnie produkt id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function usunDefinitywnieBazowy(id){
  if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  usunMetaKosza(id);
  delete produktyEdytowane[id];
  delete stanyProduktow[id];
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zaznaczoneProdukty.delete(id);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Usunięto definitywnie produkt bazowy id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function wyczyscCalKosz(){
  const bazowe=bazoweProduktyWKoszu().map(p=>p.id);
  const ile=koszDodanych.length+bazowe.length;
  if(!ile||!confirm(`Definitywnie usunąć ${ile} produktów z kosza? Tej operacji nie można cofnąć.`)) return;
  koszDodanych.forEach(p=>{delete koszMeta[p.id];delete stanyProduktow[p.id];});
  bazowe.forEach(id=>{
    if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
    delete koszMeta[id]; delete produktyEdytowane[id]; delete stanyProduktow[id];
  });
  koszDodanych=[];
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zbudujProdukty(); odswiezMenu();
  loguj("info",`Opróżniono kosz: ${ile} produktów`);
  toast("Kosz opróżniony"); renderuj();
}
/* ── Edycja ceny bezpośrednio w tabeli ── */
function ustawCene(id, wartosc){
  const cena = parseFloat(String(wartosc).replace(",","."));
  if(!(cena>0)){ toast("⚠️ Nieprawidłowa cena"); renderuj(); return; }
  const nowa = +cena.toFixed(2);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i].cena = nowa;
    if(produktyDodane[i].staraCena && produktyDodane[i].staraCena<=nowa) delete produktyDodane[i].staraCena;
    zapiszLS("artway_produkty_dodane", produktyDodane);
  }else{
    const baza = pobierzProduktAdmin(id) || {};
    const edycja = {...(produktyEdytowane[id]||{}), cena:nowa};
    if(baza.staraCena && baza.staraCena<=nowa) edycja.staraCena = undefined;
    produktyEdytowane = {...produktyEdytowane, [id]:edycja};
    zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  }
  zbudujProdukty();
  loguj("info",`Zmieniono cenę produktu ${id} → ${zl(nowa)}`);
  toast("Cena zapisana ✅"); renderuj();
}
/* ── Akcje masowe na produktach ── */
let zaznaczoneProdukty = new Set();
function przelaczZaznProd(id){ zaznaczoneProdukty.has(id) ? zaznaczoneProdukty.delete(id) : zaznaczoneProdukty.add(id); }
function zaznaczWidoczneProd(chk, ids){
  ids.forEach(id => chk.checked ? zaznaczoneProdukty.add(id) : zaznaczoneProdukty.delete(id));
  renderuj();
}
function usunZaznaczoneProd(){
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!confirm(`Usunąć ${zaznaczoneProdukty.size} zaznaczonych produktów?`)) return;
  for(const id of [...zaznaczoneProdukty]){
    const p = produktyDodane.find(x=>x.id===id);
    if(p){
      if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
      produktyDodane = produktyDodane.filter(x=>x.id!==id);
      oznaczProduktWKoszu(id,"wlasny");
    }else if(!produktyDefinitywne.includes(id)){
      if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
      oznaczProduktWKoszu(id,"bazowy");
    }
  }
  zapiszLS("artway_kosz_dodane", koszDodanych);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  loguj("info",`Masowo usunięto ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); odswiezMenu(); toast("Usunięto zaznaczone 🗑️"); renderuj();
}
function zmienCenyZaznaczonych(){
  const proc = parseFloat(String($("procentCen")?.value||"").replace(",","."));
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!proc || proc<=-100){ toast("⚠️ Podaj procent, np. 10 lub -15"); return; }
  for(const id of [...zaznaczoneProdukty]){
    const p = pobierzProduktAdmin(id); if(!p) continue;
    const nowa = Math.max(0.01, +(p.cena*(1+proc/100)).toFixed(2));
    const i = produktyDodane.findIndex(x=>x.id===id);
    if(i>=0){ produktyDodane[i].cena = nowa; if(produktyDodane[i].staraCena && produktyDodane[i].staraCena<=nowa) delete produktyDodane[i].staraCena; }
    else produktyEdytowane = {...produktyEdytowane, [id]:{...(produktyEdytowane[id]||{}), cena:nowa}};
  }
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  loguj("info",`Masowa zmiana cen ${proc>0?"+":""}${proc}% dla ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); toast(`Ceny zmienione o ${proc>0?"+":""}${proc}% ✅`); renderuj();
}
function usunProduktAdmin(id){
  if(produktyDodane.some(p=>p.id===id)){
    usunProdukt(id);
    return;
  }
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  oznaczProduktWKoszu(id,"bazowy");
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Przeniesiono do kosza na 30 dni produkt bazowy id="+id);
  toast("Produkt w koszu przez 30 dni 🗑️");
  renderuj();
}
function przywrocProdukt(id){
  if(produktyDefinitywne.includes(id)){ toast("Ten produkt został już usunięty definitywnie"); return; }
  produktyUkryte = produktyUkryte.filter(x=>x!==id);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony ↩️"); renderuj();
}
function resetujEdycjeProduktu(id){
  delete produktyEdytowane[id];
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  zbudujProdukty(); odswiezMenu();
  toast("Przywrócono dane z products.json");
  location.hash="#/admin/produkty";
}
function przelaczWidocznosc(id){
  produktyUkryte = produktyUkryte.includes(id) ? produktyUkryte.filter(x=>x!==id) : [...produktyUkryte, id];
  zapiszLS("artway_produkty_ukryte", produktyUkryte); zbudujProdukty();
  toast(produktyUkryte.includes(id)?"Produkt ukryty 🙈":"Produkt widoczny 👁️"); renderuj();
}

/* ── Eksporty (CSV dla Excela, JSON dla hostingu) ── */
function pobierzPlik(nazwa, tresc, typ){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([tresc], {type:(typ||"text/plain")+";charset=utf-8"}));
  a.download = nazwa; a.click(); URL.revokeObjectURL(a.href);
}
function osadzUstawieniaWIndexie(html){
  const bezpieczne=JSON.stringify(ustawienia,null,2).replace(/</g,"\\u003c");
  const blok=`/* PUBLIC_SETTINGS_START */\nconst USTAWIENIA_PUBLICZNE = ${bezpieczne};\n/* PUBLIC_SETTINGS_END */`;
  const wzor=/\/\* PUBLIC_SETTINGS_START \*\/[\s\S]*?\/\* PUBLIC_SETTINGS_END \*\//;
  if(!wzor.test(html))throw new Error("Nie znaleziono znacznika ustawień w index.html");
  return html.replace(wzor,blok);
}
async function eksportujIndexHTML(){
  try{
    const r=await fetch("index.html",{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);
    const html=osadzUstawieniaWIndexie(await r.text());
    pobierzPlik("index.html",html,"text/html");
    localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    loguj("info","Wyeksportowano index.html z publicznymi ustawieniami panelu");
    toast("Pobrano index.html — wgraj go na hosting ✅");
  }catch(e){loguj("blad","Eksport index.html: "+e.message);toast("⚠️ Nie udało się przygotować index.html");}
}
const csvPole = v => '"' + String(v??"").replace(/"/g,'""') + '"';
function eksportujZamowienia(){
  const z = pobierzZamowienia();
  const csv = [["nr","data","status","klient","produkty_zl","rabat_zl","dostawa_zl","paczka_weekend_zl","platnosc_oplata_zl","razem_zl","dostawa","platnosc","adres","pozycje"].join(";"),
    ...z.map(x=>{const k=kosztyZamowienia(x); return [x.nr,x.data,x.status,x.email||"gość",k.produkty,k.rabat,k.dostawa,k.paczkaWeekend,k.platnosc,k.razem,x.dostawa||"",x.platnosc||"",x.adres||"",(x.pozycje||[]).join(" | ")].map(v=>typeof v==="number"?String(v.toFixed(2)).replace(".",","):v).map(csvPole).join(";");})].join("\n");
  pobierzPlik("zamowienia.csv","﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano zamówienia ("+z.length+")");
}
function eksportujKlientow(){
  const k = pobierzUzytkownikow();
  const csv = [["imie_nazwisko","email","rola","data_rejestracji"].join(";"),
    ...k.map(x=>[x.imie,x.email,kontoMaRoleAdmin(x.email)?"administrator":"klient",new Date(x.data).toLocaleDateString("pl-PL")].map(csvPole).join(";"))].join("\n");
  pobierzPlik("klienci.csv","﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano klientów ("+k.length+")");
}
// InPost „nadanie z pliku": eksport zamówień do CSV/TXT do wgrania w InPost Managerze
// (manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU). Działa dla paczkomatu i kuriera —
// obejście/awaryjne nadawanie do czasu umowy kurierskiej. Format zgodny ze wzorem InPost.
let zaznaczoneNadania = new Set();
function przelaczZaznaczenieNadania(nr){ nr=String(nr); if(zaznaczoneNadania.has(nr)) zaznaczoneNadania.delete(nr); else zaznaczoneNadania.add(nr); renderuj(); }
function zaznaczWszystkieNadania(zazn){ listaWysylekPoFiltrze().forEach(z=>zazn?zaznaczoneNadania.add(String(z.nr)):zaznaczoneNadania.delete(String(z.nr))); renderuj(); }
// czy zamówienie idzie do paczkomatu (InPost)
function paczkomatoweInpost(z){ const id=String(z?.dostawaId||"").toLowerCase(); if(id==="kurier"||id==="kurier_inpost") return false; if(id==="paczkomat") return true; return !!(z?.paczkomat||z?.wysylka?.punktKod); }
// czy zlecenie ma komplet danych do nadania w InPost (żeby import z pliku nie odrzucił)
function gotoweDoNadaniaInpost(z){
  const k=z.klient||{}, a=z.adresDostawy||{};
  if(String(z?.dostawaId||"").toLowerCase()==="odbior") return {ok:false, powod:"odbiór osobisty"};
  const tel=String(k.telefon||z.telefon||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"");
  if(!/@/.test(String(z.email||k.email||""))) return {ok:false, powod:"brak e-mail"};
  if(tel.length<9) return {ok:false, powod:"brak/zły telefon"};
  if(paczkomatoweInpost(z)){ if(!(z.paczkomat||z.wysylka?.punktKod)) return {ok:false, powod:"brak paczkomatu"}; }
  else { if(!a.ulica||!a.nrDomu) return {ok:false, powod:"brak adresu"}; if(!/^\d{2}-\d{3}$/.test(String(a.kod||""))) return {ok:false, powod:"zły kod pocztowy"}; if(!a.miasto) return {ok:false, powod:"brak miasta"}; }
  return {ok:true, paczk:paczkomatoweInpost(z)};
}
function zaznaczGotoweNadania(){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(gotoweDoNadaniaInpost(z).ok){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(n?`Zaznaczono ${n} gotowych do nadania`:"Brak gotowych zleceń w tym filtrze"); renderuj(); }
function zaznaczTypNadania(typ){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(String(z?.dostawaId||"").toLowerCase()==="odbior") return; const p=paczkomatoweInpost(z); if((typ==="paczkomat"&&p)||(typ==="kurier"&&!p)){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(`Zaznaczono ${n} (${typ})`); renderuj(); }
// nry (opcjonalnie) = tablica numerów zamówień do eksportu (pojedyncze zlecenie / zaznaczone). Bez nry: zaznaczone albo cały filtr.
function eksportNadaniaInpostCSV(nry, format="txt"){
  const tryb=String(format||"txt").toLowerCase();
  const rozszerzony=tryb==="extended"||tryb==="rozszerzony";
  const kolumnowy=tryb==="csv"||tryb==="kolumny"||tryb==="columns";
  const tabulator=tryb==="tab"||tryb==="tsv"||tryb==="inpost";
  const sep=tabulator ? "\t" : (kolumnowy ? "," : ";");
  const ext=kolumnowy||rozszerzony ? "csv" : "txt";
  const mime=ext==="csv" ? "text/csv" : "text/plain";
  const czysc = v => String(v==null?"":v).replace(/[\t;\r\n]+/g," ").replace(/\s+/g," ").trim();
  const telCyfry = t => String(t||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"").slice(-9);
  const telInpost = t => { const d=telCyfry(t); return d.length===9 ? "+48"+d : ""; };
  const kwota = v => { const n=Number(String(v??"").replace(",",".").replace(/[^0-9.]/g,"")); return Number.isFinite(n)&&n>0 ? n.toFixed(2) : ""; };
  const rozmiarInpost = z => { const g=String(z?.wysylka?.gabaryt||"").toLowerCase(); return g==="large"?"C":g==="medium"?"B":"A"; };
  const pole = v => {
    const s=czysc(v);
    return kolumnowy ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const jawne = Array.isArray(nry) && nry.length;
  let bazaZ;
  if(jawne){ const zb=new Set(nry.map(String)); bazaZ = pobierzZamowienia().filter(z=>zb.has(String(z.nr))); }
  else if(zaznaczoneNadania.size){ bazaZ = pobierzZamowienia().filter(z=>zaznaczoneNadania.has(String(z.nr))); }
  else { bazaZ = listaWysylekPoFiltrze(); }
  const lista = bazaZ.filter(z=>{
    if(String(z?.dostawaId||"").toLowerCase()==="odbior") return false;
    if(!jawne && ["dostarczona","anulowana","zwrot"].includes(etapWysylki(z))) return false;
    return true;
  }).slice(0,100);
  if(!lista.length){ toast("Brak zamówień do nadania (sprawdź zaznaczenie lub filtr)"); return; }
  const polaPodstawowe=["e-mail","telefon","rozmiar","paczkomat","numer_referencyjny","dodatkowa_ochrona","za_pobraniem","imie_i_nazwisko","nazwa_firmy","ulica","kod_pocztowy","miasto","typ_przesylki","paczka_w_weekend"];
  const polaRozszerzone=["uwagi","produkty","kwota_zamowienia","metoda_platnosci","sposob_dostawy","gabaryt_sklepu","waga_kg","dlugosc_cm","szerokosc_cm","wysokosc_cm","telefon_9_cyfr"];
  const pola=rozszerzony?[...polaPodstawowe,...polaRozszerzone]:polaPodstawowe;
  const wiersze=lista.map(z=>{
    const k=z.klient||{}, a=z.adresDostawy||{}, w=z.wysylka||{};
    const paczk=paczkomatoweInpost(z);
    const ulica = czysc(`${a.ulica||""} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`.trim());
    const pobranie = kwota(w.pobranie || (z.platnoscId==="pobranie" ? z.razem : ""));
    const ochrona = kwota(w.ochrona || "");
    const produktyTxt = Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
      ? z.pozycjeDane.map(p=>`${p.nazwa||""}${p.sku?` SKU:${p.sku}`:""} x${p.ilosc||1}`).join(" | ")
      : (Array.isArray(z.pozycje)?z.pozycje.join(" | "):"");
    const podstawowe=[
      z.email||k.email,
      telInpost(k.telefon||z.telefon),
      rozmiarInpost(z),
      paczk ? String(z.paczkomat||w.punktKod||"").toUpperCase() : "",
      z.nr,
      ochrona,
      pobranie,
      [k.imie,k.nazwisko].filter(Boolean).join(" "),
      k.firma,
      ulica,
      a.kod,
      a.miasto,
      paczk ? "paczkomat" : "kurier",
      (w.paczkaWeekend || z.paczkaWeekend) ? "TAK" : "NIE"
    ];
    const extra=[
      z.uwagi,
      produktyTxt,
      kwota(z.razem),
      z.platnosc,
      z.dostawa,
      w.gabaryt||"small",
      w.waga,
      w.dlugosc,
      w.szerokosc,
      w.wysokosc,
      telCyfry(k.telefon||z.telefon)
    ];
    return (rozszerzony?[...podstawowe,...extra]:podstawowe).map(pole).join(sep);
  });
  const tresc=[pola.map(pole).join(sep),...wiersze].join("\r\n");
  const nazwaTrybu=rozszerzony?"rozszerzony":(tabulator?"naglowki-tabulator":(kolumnowy?"naglowki":tryb));
  pobierzPlik(`inpost-nadania-${nazwaTrybu}-${new Date().toISOString().slice(0,10)}.${ext}`, tresc, mime);
  const npaczk=lista.filter(z=>paczkomatoweInpost(z)).length, nbrak=lista.filter(z=>!gotoweDoNadaniaInpost(z).ok).length;
  loguj("info",`Eksport nadań InPost ${nazwaTrybu}: ${lista.length} przesyłek (${npaczk} paczkomat, ${lista.length-npaczk} kurier)`);
  toast(tabulator
    ? `📄 TXT InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK, separator Tabulator${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
    : (kolumnowy
      ? `📄 CSV InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK i separator przecinek${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
      : `📄 Plik InPost ${nazwaTrybu.toUpperCase()}: ${lista.length} przesyłek — dla TXT ustaw w InPost separator średnik${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`));
}
let podgladImportuProduktow=null, ostatniRaportImportu=null;
const POLA_CSV_PRODUKTU=["id","nazwa","kategoria","cena","stara_cena","stan","sku","gtin","external_id","mpn","marka","opis","badge","ikona","zdjecie","zdjecie2","zdjecie3","zdjecie4","zdjecie5","zdjecie6","zdjecie7","zdjecie8","zdjecie9","zdjecie10","zdjecie11","zdjecie12","zdjecie13","zdjecie14","zdjecie15","zdjecie16","warianty","kolor","kolor_produktu","rozmiar","material"];
const POLA_OVF_PRODUKTU=["GTIN","EXTERNAL_ID","NAME","STOCK","PRICE","MPN","DESCRIPTION","IMAGE1","IMAGE2","IMAGE3","IMAGE4","IMAGE5","IMAGE6","IMAGE7","IMAGE8","IMAGE9","IMAGE10","IMAGE11","IMAGE12","IMAGE13","IMAGE14","IMAGE15","IMAGE16","CATEGORY","BRAND","COLOR","SIZE","MATERIAL"];
function normalizujNaglowekCSV(v){
  return normalizujSzukanyTekst(v).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
function kanonicznePoleProduktu(naglowek){
  const h=normalizujNaglowekCSV(naglowek);
  const aliasy={
    id:["id","product_id","produkt_id","item_id","id_produktu"],
    nazwa:["nazwa","name","product_name","nazwa_produktu","tytul","title","product_title"],
    kategoria:["kategoria","category","katalog","catalog","category_path","categorypath","breadcrumb","category_tree","category_name","categories","sciezka_kategorii"],
    cena:["cena","price","cena_zl","sale_price","gross_price","net_price","price_gross","price_net","retail_price"],
    staraCena:["stara_cena","old_price","regular_price","cena_regularna","oldprice","rrp","msrp"],
    stan:["stan","stock","quantity","ilosc","stan_magazynowy","available","availability","qty"],
    sku:["sku","kod","kod_produktu","symbol","seller_sku","item_sku","offer_sku","symbol_produktu"],
    gtin:["gtin","ean","ean13","barcode","kod_ean"],
    externalId:["external_id","externalid","kod_zewnetrzny","supplier_id","vendor_id","ext_id","supplier_sku"],
    mpn:["mpn","manufacturer_part_number","kod_producenta"],
    marka:["brand","marka","producent","brand_name","manufacturer"],
    opis:["opis","description","desc","long_description","description_html","full_description"],
    badge:["badge","etykieta","label"],
    ikona:["ikona","icon","emoji"],
    zdjecie:["zdjecie","image","image1","image_1","image_url","url_zdjecia","main_image","image_url_1","photo","photo1","picture","picture1"],
    warianty:["warianty","variants","options"],
    kolor:["kolor","kolor_tla","background","background_color","card_color"],
    kolorProduktu:["color","kolor_produktu","product_color","barwa"],
    rozmiar:["size","rozmiar","wymiar","wymiary","dimensions"],
    material:["material","material_produktu","tworzywo"]
  };
  for(let i=2;i<=16;i++) aliasy["zdjecie"+i]=["zdjecie"+i,"image"+i,"image_"+i,"image"+String(i).padStart(2,"0"),String("image_"+String(i).padStart(2,"0")),"image_url_"+i,"photo"+i,"picture"+i,"url_zdjecia"+i];
  return Object.keys(aliasy).find(k=>aliasy[k].includes(h))||null;
}
function liczbaImportu(v){
  let s=String(v??"").trim().replace(/\s/g,"").replace(/[^\d,.\-]/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else s=s.replace(",",".");
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function wykryjSeparatorCSV(tekst){
  const probka=String(tekst||"").split(/\r?\n/).slice(0,5).join("\n");
  const liczniki={";":0,",":0,"\t":0};let cytat=false;
  for(let i=0;i<probka.length;i++){
    if(probka[i]==='"'&&probka[i+1]==='"'){i++;continue;}
    if(probka[i]==='"'){cytat=!cytat;continue;}
    if(!cytat&&Object.prototype.hasOwnProperty.call(liczniki,probka[i]))liczniki[probka[i]]++;
  }
  return Object.entries(liczniki).sort((a,b)=>b[1]-a[1])[0][0];
}
function parsujCSVProduktow(tekst){
  tekst=String(tekst||"").replace(/^\uFEFF/,"");
  const sep=wykryjSeparatorCSV(tekst),wiersze=[];let wiersz=[],pole="",cytat=false;
  for(let i=0;i<tekst.length;i++){
    const c=tekst[i];
    if(c==='"'&&cytat&&tekst[i+1]==='"'){pole+='"';i++;continue;}
    if(c==='"'){cytat=!cytat;continue;}
    if(c===sep&&!cytat){wiersz.push(pole);pole="";continue;}
    if((c==="\n"||c==="\r")&&!cytat){
      if(c==="\r"&&tekst[i+1]==="\n")i++;
      wiersz.push(pole);pole="";
      if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
      wiersz=[];continue;
    }
    pole+=c;
  }
  wiersz.push(pole);if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
  if(wiersze.length<2)throw new Error("CSV nie zawiera wierszy produktów");
  const naglowki=wiersze.shift().map(kanonicznePoleProduktu);
  if(!naglowki.includes("nazwa")||!naglowki.includes("cena"))throw new Error("CSV musi zawierać co najmniej kolumny: nazwa i cena");
  return wiersze.map(r=>{const o={};naglowki.forEach((k,i)=>{if(k)o[k]=r[i]??"";});return o;});
}
function tablicaWartosci(v){
  if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);
  return String(v||"").split(/\s*[|,]\s*/).map(x=>x.trim()).filter(Boolean);
}
function czyKolorKarty(v){
  const s=String(v||"").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)||/^rgba?\(/i.test(s)||/^hsla?\(/i.test(s);
}
function rozbijSciezkeKategoriiImportu(v){
  const tekst=String(v||"").trim();
  if(!tekst)return {pelna:"",grupa:"",kategoria:"",poziomy:[]};
  const czesci=tekst.split(/\s*(?:\/|\\|>|»|›|\||::)\s*/).map(x=>x.trim()).filter(Boolean);
  if(czesci.length<=1)return {pelna:tekst,grupa:"",kategoria:tekst,poziomy:[tekst]};
  return {pelna:tekst,grupa:czesci.slice(0,-1).join(" / "),kategoria:czesci.at(-1),poziomy:czesci};
}
function normalizujProduktImportu(r,nr){
  const pobierz=(...nazwy)=>{for(const n of nazwy)if(r?.[n]!==undefined&&r[n]!==null)return r[n];return "";};
  const bledy=[],ostrzezenia=[];
  const nazwa=String(pobierz("nazwa","name","product_name")).trim();
  const kategoriaInfo=rozbijSciezkeKategoriiImportu(pobierz("kategoria","category","katalog"));
  const kategoria=kategoriaInfo.kategoria;
  const cena=liczbaImportu(pobierz("cena","price","sale_price"));
  const idRaw=pobierz("id","product_id"),id=idRaw===""||idRaw===null?null:Number(idRaw);
  if(!nazwa)bledy.push("brak nazwy");
  if(!kategoria)bledy.push("brak kategorii");
  if(cena===null||cena<0)bledy.push("cena musi być liczbą 0 lub większą");
  if(cena===0)ostrzezenia.push("cena 0,00 — produkt zostanie zaimportowany, ale będzie zablokowany do sprzedaży do czasu uzupełnienia ceny");
  if(id!==null&&(!Number.isInteger(id)||id<=0))bledy.push("ID musi być dodatnią liczbą całkowitą");
  const stanRaw=pobierz("stan","stock","quantity","ilosc"),stan=stanRaw===""||stanRaw===null?null:liczbaImportu(stanRaw);
  if(stan!==null&&(!Number.isInteger(stan)||stan<0))bledy.push("stan musi być liczbą całkowitą 0 lub większą");
  const stara=liczbaImportu(pobierz("staraCena","stara_cena","old_price","regular_price"));
  if(stara!==null&&cena!==null&&stara<=cena)ostrzezenia.push("stara cena pominięta, bo nie jest wyższa od ceny");
  const galeria=Array.isArray(r?.zdjecia)?r.zdjecia:Array.isArray(r?.images)?r.images:null;
  const zdjecia=galeria?galeria.map(String).filter(Boolean):Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(k=>String(pobierz(k)).trim()).filter(Boolean);
  const p={id,nazwa,kategoria,cena:cena===null?0:+cena.toFixed(2)};
  if(kategoriaInfo.poziomy.length>1){
    p.sciezkaKategorii=kategoriaInfo.poziomy;
    p.grupaKategorii=kategoriaInfo.grupa;
    p.kategoriaPelna=kategoriaInfo.pelna;
  }
  if(cena===0)p.wymagaCeny=true;else delete p.wymagaCeny;
  const opis=String(pobierz("opis","description")).trim();if(opis)p.opis=opis;
  const ikona=String(pobierz("ikona","icon","emoji")).trim();if(ikona)p.ikona=ikona;
  const kolor=String(pobierz("kolor")).trim();if(kolor&&czyKolorKarty(kolor))p.kolor=kolor;
  const kolorProduktu=String(pobierz("kolorProduktu")).trim();if(kolorProduktu)p.kolorProduktu=kolorProduktu;
  if(stara!==null&&stara>cena)p.staraCena=+stara.toFixed(2);
  if(stan!==null)p.stan=stan;
  const gtin=String(pobierz("gtin")).trim();if(gtin)p.gtin=gtin;
  const externalId=String(pobierz("externalId")).trim();if(externalId)p.externalId=externalId;
  const mpn=String(pobierz("mpn")).trim();if(mpn)p.mpn=mpn;
  const marka=String(pobierz("marka")).trim();if(marka)p.marka=marka;
  const rozmiar=String(pobierz("rozmiar")).trim();if(rozmiar)p.rozmiar=rozmiar;
  const material=String(pobierz("material")).trim();if(material)p.material=material;
  const sku=String(pobierz("sku","kod","kod_produktu")).trim()||externalId||mpn||gtin;if(sku)p.sku=sku;
  const badge=String(pobierz("badge","etykieta","label")).trim();if(badge)p.badge=badge;
  const zdjecie=String(pobierz("zdjecie","image","image_url")).trim();if(zdjecie)p.zdjecie=zdjecie;
  if(zdjecia.length)p.zdjecia=zdjecia.slice(0,15);
  const warianty=tablicaWartosci(pobierz("warianty","variants","options"));if(warianty.length)p.warianty=warianty.slice(0,30);
  return {nr,produkt:p,bledy,ostrzezenia};
}
function analizujTekstImportu(tekst,nazwa="wklejone dane"){
  try{
    const t=String(tekst||"").trim();if(!t)throw new Error("Brak danych do analizy");
    let surowe,format;
    if(t.startsWith("[")||t.startsWith("{")){
      const j=JSON.parse(t);surowe=Array.isArray(j)?j:(Array.isArray(j.products)?j.products:Array.isArray(j.produkty)?j.produkty:null);format="JSON";
      if(!surowe)throw new Error('JSON musi być tablicą produktów albo obiektem z polem "products"');
    }else{surowe=parsujCSVProduktow(t);format="CSV";}
    if(!surowe.length)throw new Error("Plik nie zawiera produktów");
    if(surowe.length>100000)throw new Error("Jednorazowo można zaimportować maksymalnie 100 000 produktów");
    const wyniki=surowe.map((r,i)=>normalizujProduktImportu(r,i+2));
    const idy=new Map(),sku=new Map(),external=new Map();
    for(const w of wyniki){
      const p=w.produkt;
      if(p.id!==null){if(idy.has(p.id))w.bledy.push(`powtórzone ID ${p.id} (także w wierszu ${idy.get(p.id)})`);else idy.set(p.id,w.nr);}
      if(p.sku){const s=p.sku.toLowerCase();if(sku.has(s))w.bledy.push(`powtórzone SKU ${p.sku} (także w wierszu ${sku.get(s)})`);else sku.set(s,w.nr);}
      if(p.externalId){const s=p.externalId.toLowerCase();if(external.has(s))w.bledy.push(`powtórzone EXTERNAL_ID ${p.externalId} (także w wierszu ${external.get(s)})`);else external.set(s,w.nr);}
    }
    podgladImportuProduktow={
      nazwa,format,wszystkich:wyniki.length,
      produkty:wyniki.filter(w=>!w.bledy.length).map(w=>w.produkt),
      bledy:wyniki.filter(w=>w.bledy.length).map(w=>`Wiersz ${w.nr}: ${w.bledy.join(", ")}`),
      ostrzezenia:wyniki.filter(w=>w.ostrzezenia.length).map(w=>`Wiersz ${w.nr}: ${w.ostrzezenia.join(", ")}`)
    };
    ostatniRaportImportu=null;renderuj();
  }catch(e){
    podgladImportuProduktow={nazwa,format:"—",wszystkich:0,produkty:[],bledy:[e.message],ostrzezenia:[]};
    renderuj();
  }
}
function analizujWklejonyImport(){
  analizujTekstImportu($("importTekstProduktow")?.value||"","wklejone dane");
}
function wczytajPlikImportuProduktow(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>20*1024*1024){toast("⚠️ Maksymalny rozmiar pliku to 20 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>analizujTekstImportu(r.result,plik.name);
  r.onerror=()=>toast("⚠️ Nie udało się odczytać pliku");
  r.readAsText(plik,"UTF-8");
}
function zapiszStanProduktowPoOperacji(){
  zapiszLS("artway_produkty_dodane",produktyDodane);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_ustawienia",ustawienia);
}
function dodajSciezkiKategoriiZImportuDoMenu(lista){
  const importowane=(Array.isArray(lista)?lista:[]).filter(p=>p?.grupaKategorii&&p?.kategoria);
  if(!importowane.length)return 0;
  const grupy=grupyMenuKategorii();let dodane=0;
  const klucz=v=>normalizujSzukanyTekst(v);
  for(const p of importowane){
    const nazwa=String(p.grupaKategorii||"").trim(),kat=String(p.kategoria||"").trim();
    if(!nazwa||!kat)continue;
    let g=grupy.find(x=>klucz(x.nazwa)===klucz(nazwa));
    if(!g){
      g={id:"menu_import_"+prostyHash(nazwa),nazwa,ikona:ikonaKategorii(nazwa),aktywna:true,kategorie:[]};
      grupy.push(g);
    }
    if(!g.kategorie.some(x=>klucz(x)===klucz(kat))){g.kategorie.push(kat);dodane++;}
  }
  if(dodane){
    ustawienia.menuKategorii=grupy.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
    ustawienia.menuPokazNieprzypisane=true;
  }
  return dodane;
}
function wykonajImportProduktow(){
  const d=podgladImportuProduktow;if(!d?.produkty?.length){toast("Najpierw przeanalizuj poprawne dane");return;}
  const tryb=$("trybImportuProduktow")?.value||"scal";
  if(tryb==="zastap"&&!confirm(`Zastąpić obecny katalog ${d.produkty.length} produktami? Przed zmianą zostanie utworzona kopia do cofnięcia.`))return;
  const kopia={data:new Date().toISOString(),produktyDodane,produktyUkryte,produktyEdytowane,produktyDefinitywne,koszDodanych,koszMeta,stanyProduktow,ustawienia};
  try{localStorage.setItem("artway_ostatnia_kopia_importu",JSON.stringify(kopia));}catch(e){toast("⚠️ Nie udało się utworzyć kopii przed importem");return;}
  let dodane=0,zaktualizowane=0;const wejscie=d.produkty.map(p=>JSON.parse(JSON.stringify(p)));
  if(tryb==="zastap"){
    const zajete=new Set();let nastepne=Math.max(0,...wejscie.map(p=>Number(p.id)||0),...prodBazowe.map(p=>Number(p.id)||0))+1;
    for(const p of wejscie){if(!p.id||zajete.has(p.id)){while(zajete.has(nastepne))nastepne++;p.id=nastepne++;}zajete.add(p.id);if(!p.ikona)p.ikona="📦";if(!p.kolor)p.kolor="#dbeafe";if(p.opis===undefined)p.opis="";}
    produktyDodane=wejscie;
    produktyUkryte=[...new Set(prodBazowe.map(p=>p.id))];
    produktyEdytowane={};produktyDefinitywne=[...produktyUkryte];koszDodanych=[];koszMeta={};stanyProduktow={};
    wejscie.forEach(p=>{if(Number.isInteger(p.stan)&&p.stan>=0)stanyProduktow[p.id]=p.stan;});
    ustawienia={...ustawienia,mapaProduktow:{}};
    dodane=wejscie.length;
  }else{
    const kluczKodu=v=>String(v||"").trim().toLowerCase();
    const aktywne=produktyDoAdministracji(),poSku=new Map(aktywne.filter(p=>p.sku).map(p=>[kluczKodu(p.sku),p])),poExternal=new Map(aktywne.filter(p=>p.externalId).map(p=>[kluczKodu(p.externalId),p]));
    const zajete=new Set([...aktywne.map(p=>Number(p.id)),...koszDodanych.map(p=>Number(p.id))].filter(id=>Number.isInteger(id)&&id>0));let nastepne=Math.max(0,...prodBazowe.map(p=>Number(p.id)||0),...zajete,...wejscie.map(p=>Number(p.id)||0))+1;
    for(const p0 of wejscie){
      const poExternalId=p0.externalId?poExternal.get(kluczKodu(p0.externalId)):null,poKodzie=p0.sku?poSku.get(kluczKodu(p0.sku)):null,poId=(!p0.externalId&&!p0.sku&&p0.id)?aktywne.find(x=>x.id===p0.id):null,istniejacy=poExternalId||poKodzie||poId;
      if(istniejacy){
        const p={...istniejacy,...p0,id:istniejacy.id};
        const i=produktyDodane.findIndex(x=>x.id===p.id);
        if(i>=0)produktyDodane[i]=p;else produktyEdytowane={...produktyEdytowane,[p.id]:p};
        produktyUkryte=produktyUkryte.filter(id=>id!==p.id);produktyDefinitywne=produktyDefinitywne.filter(id=>id!==p.id);
        koszDodanych=koszDodanych.filter(x=>x.id!==p.id);delete koszMeta[p.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p.id]=p0.stan;
        if(p.sku)poSku.set(kluczKodu(p.sku),p);
        if(p.externalId)poExternal.set(kluczKodu(p.externalId),p);
        zaktualizowane++;
      }else{
        if(!p0.id||zajete.has(p0.id)){while(zajete.has(nastepne))nastepne++;p0.id=nastepne++;}
        if(!p0.ikona)p0.ikona="📦";if(!p0.kolor)p0.kolor="#dbeafe";if(p0.opis===undefined)p0.opis="";
        zajete.add(p0.id);produktyDodane.push(p0);
        koszDodanych=koszDodanych.filter(x=>x.id!==p0.id);delete koszMeta[p0.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p0.id]=p0.stan;
        if(p0.sku)poSku.set(kluczKodu(p0.sku),p0);
        if(p0.externalId)poExternal.set(kluczKodu(p0.externalId),p0);
        aktywne.push(p0);dodane++;
      }
    }
  }
  const menuZImportu=dodajSciezkiKategoriiZImportuDoMenu(wejscie);
  zaznaczoneProdukty.clear();zapiszStanProduktowPoOperacji();zbudujProdukty();odswiezMenu();
  ostatniRaportImportu={dodane,zaktualizowane,pominiete:d.bledy.length,tryb,plik:d.nazwa,menuZImportu};
  podgladImportuProduktow=null;
  loguj("info",`Import produktów: ${dodane} dodanych, ${zaktualizowane} zaktualizowanych, ${d.bledy.length} pominiętych, ${menuZImportu} dopisań do menu`);
  toast(`Import zakończony: +${dodane}, aktualizacje ${zaktualizowane}${menuZImportu?`, menu +${menuZImportu}`:""} ✅`);renderuj();
}
function cofnijOstatniImportProduktow(){
  const k=wczytajLS("artway_ostatnia_kopia_importu",null);
  if(!k){toast("Brak kopii ostatniego importu");return;}
  if(!confirm(`Cofnąć import i przywrócić stan z ${new Date(k.data).toLocaleString("pl-PL")}?`))return;
  produktyDodane=k.produktyDodane||[];produktyUkryte=k.produktyUkryte||[];produktyEdytowane=k.produktyEdytowane||{};
  produktyDefinitywne=k.produktyDefinitywne||[];koszDodanych=k.koszDodanych||[];koszMeta=k.koszMeta||{};stanyProduktow=k.stanyProduktow||{};ustawienia=k.ustawienia||ustawienia;
  zapiszStanProduktowPoOperacji();localStorage.removeItem("artway_ostatnia_kopia_importu");
  podgladImportuProduktow=null;ostatniRaportImportu=null;zbudujProdukty();odswiezMenu();
  loguj("info","Cofnięto ostatni import produktów");toast("Przywrócono stan sprzed importu ↩️");renderuj();
}
function produktDoEksportu(p){
  const o={id:p.id,nazwa:p.nazwa,kategoria:p.kategoria,cena:+Number(p.cena).toFixed(2)};
  if(p.staraCena>p.cena)o.staraCena=+Number(p.staraCena).toFixed(2);
  const stan=stanProduktu(p);if(stan!==null)o.stan=stan;
  for(const k of ["sku","gtin","externalId","mpn","marka","opis","badge","ikona","kolor","kolorProduktu","rozmiar","material","zdjecie"])if(p[k]!==undefined&&p[k]!=="")o[k]=p[k];
  if(p.wymagaCeny)o.wymagaCeny=true;
  if(Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length)o.sciezkaKategorii=p.sciezkaKategorii;
  if(p.grupaKategorii)o.grupaKategorii=p.grupaKategorii;
  if(p.kategoriaPelna)o.kategoriaPelna=p.kategoriaPelna;
  if(p.zdjecia?.length)o.zdjecia=p.zdjecia.slice(0,15);
  if(p.warianty?.length)o.warianty=p.warianty;
  return o;
}
function zakresEksportuProduktow(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  let lista=[...produkty];
  if(zakres==="zaznaczone")lista=lista.filter(p=>zaznaczoneProdukty.has(p.id));
  if(zakres==="kategoria"){const k=$("kategoriaEksportuProduktow")?.value||"";lista=lista.filter(p=>p.kategoria===k);}
  return lista.map(produktDoEksportu);
}
function nazwaZakresuEksportu(zakres){
  if(zakres==="zaznaczone")return "zaznaczone";
  if(zakres==="kategoria")return normalizujNaglowekCSV($("kategoriaEksportuProduktow")?.value||"kategoria");
  return "widoczne";
}
function eksportujProduktyJSON(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const nazwa=zakres==="widoczne"?"products.json":`products-${nazwaZakresuEksportu(zakres)}.json`;
  pobierzPlik(nazwa,JSON.stringify(lista,null,2),"application/json");
  if(zakres==="widoczne")localStorage.setItem("artway_produkty_export_hash",prostyHash(JSON.stringify(lista)));
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(zakres==="widoczne"?"Pobrano products.json — wgraj go na hosting ✅":`Wyeksportowano ${lista.length} produktów`);
}
function eksportujProduktyCSV(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty.csv":`produkty-${nazwaZakresuEksportu(zakres)}.csv`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);toast(`Wyeksportowano ${lista.length} produktów do CSV`);
}
function wartoscPolaCSVProduktu(p,pole){
  if(pole==="stara_cena")return p.staraCena?String(p.staraCena.toFixed(2)).replace(".",","):"";
  if(pole==="cena")return String(Number(p.cena||0).toFixed(2)).replace(".",",");
  if(pole==="external_id")return p.externalId||"";
  if(pole==="kolor_produktu")return p.kolorProduktu||"";
  if(pole==="warianty")return (p.warianty||[]).join(" | ");
  if(pole==="stan")return p.stan??"";
  if(pole==="zdjecie")return p.zdjecie||"";
  const m=String(pole).match(/^zdjecie(\d+)$/);
  if(m)return (p.zdjecia||[])[Number(m[1])-2]||"";
  return p[pole]??"";
}
function wartoscPolaOVF(p,pole){
  const zdj=[p.zdjecie||"",...(p.zdjecia||[])];
  const kategoriaPelna=Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length?p.sciezkaKategorii.join("/"):p.kategoriaPelna||p.kategoria||"";
  const mapa={
    GTIN:p.gtin||"",
    EXTERNAL_ID:p.externalId||p.sku||String(p.id||""),
    NAME:p.nazwa||"",
    STOCK:p.stan??"",
    PRICE:p.cena!==undefined?String(Number(p.cena||0).toFixed(2)).replace(".",","):"",
    MPN:p.mpn||p.sku||"",
    DESCRIPTION:p.opis||"",
    CATEGORY:kategoriaPelna,
    BRAND:p.marka||"",
    COLOR:p.kolorProduktu||"",
    SIZE:p.rozmiar||(p.warianty||[]).join(" | "),
    MATERIAL:p.material||""
  };
  const img=String(pole).match(/^IMAGE(\d+)$/);
  return img ? (zdj[Number(img[1])-1]||"") : (mapa[pole]??"");
}
function eksportujProduktyOVF(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_OVF_PRODUKTU.join(","),...lista.map(p=>POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(","))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty-ovf.xls":`produkty-ovf-${nazwaZakresuEksportu(zakres)}.xls`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(`Wyeksportowano ${lista.length} produktów w formacie OVF`);
}
function pobierzSzablonProduktowCSV(){
  const przyklad=[1,"Przykładowy produkt","Nowa kategoria","99,90","129,90",25,"SKU-001","5901234567891","EXT-001","MPN-001","Marka","Opis produktu","Nowość","📦","https://adres.pl/zdjecie.jpg","","","","","","","","","","","","","","","","S | M | L","#dbeafe","Czarny","XL","Bawełna"];
  pobierzPlik("szablon-importu-produktow.csv","\uFEFF"+POLA_CSV_PRODUKTU.join(";")+"\n"+przyklad.map(csvPole).join(";"),"text/csv");
}
function pobierzSzablonProduktowOVF(){
  const p={id:1,nazwa:"Przykładowa gra edukacyjna",kategoria:"Gry edukacyjne",cena:99.90,stan:25,sku:"GRA-001",externalId:"GRA-001",gtin:"5901234567891",mpn:"GRA-001",opis:"Krótki opis produktu. Pełny opis będzie widoczny na stronie produktu, a na listach pojawi się skrót.",zdjecie:"https://adres.pl/zdjecie1.jpg",zdjecia:["https://adres.pl/zdjecie2.jpg"],marka:"Artway",kolorProduktu:"Kolorowy",rozmiar:"30x20x5 cm",material:"Karton"};
  const csv=POLA_OVF_PRODUKTU.join(",")+"\n"+POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(",");
  pobierzPlik("ovf-template-dla-rozszerzonego-pliku-csv-dane.xls","\uFEFF"+csv,"text/csv");
}

/* ── Katalogi produktów (kategorie) ── */
function widokAdminKategorie(){
  const wszystkie = produktyDoAdministracji();
  const zmiany = ustawienia.kategorie || {};
  const mapa = ustawienia.mapaProduktow || {};
  const zProduktow = [...new Set(wszystkie.map(p=>{ let k=mapa[p.id]||p.kategoria; for(let i=0;i<3&&zmiany[k];i++) k=zmiany[k]; return k; }))];
  const wlasne = ustawienia.wlasneKategorie || [];
  const nazwy = [...new Set([...zProduktow, ...wlasne])];
  const ukryte = ustawienia.ukryteKategorie || [];
  const grupy = grupyMenuKategorii();
  const pokazNieprzypisane = ustawienia.menuPokazNieprzypisane!==false;
  const przypisane = new Set(grupy.flatMap(g=>g.kategorie).filter(k=>nazwy.includes(k)));
  const bezGrup = nazwy.filter(k=>!przypisane.has(k));
  return asortymentSzkielet("kategorie", `
  <div class="panel">
    <h1>➕ Utwórz nowy katalog</h1>
    <form onsubmit="dodajKatalog(event)" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin:.6rem 0">
      <div class="f-group" style="margin:0;flex:1;min-width:200px"><label>Nazwa katalogu</label><input required name="nazwa" placeholder="np. Zabawki, AGD, Ogród…" maxlength="40"></div>
      <button class="btn" type="submit">➕ Utwórz</button>
    </form>
    <p style="font-size:.8rem;color:var(--muted2)">Nowy katalog od razu pojawi się w górnym menu sklepu i na stronie głównej. Produkty przypiszesz do niego w <a href="#/admin/mapowanie">🧩 Mapowaniu produktów</a> lub przy dodawaniu produktu.</p>
  </div>
  <div class="panel">
    <div class="results-bar" style="padding:0;margin:0 0 .8rem">
      <div><h1 style="margin:0">🧭 Wyższy poziom kategorii w menu</h1><p style="font-size:.85rem;color:var(--muted2);margin:.25rem 0 0">Poziom 1: grupa w górnym menu • Poziom 2: wybrane katalogi • Poziom 3: produkty. To porządkuje sklep przy dużej liczbie produktów.</p></div>
      <label style="font-size:.82rem;font-weight:700;color:var(--muted2)"><input type="checkbox" ${pokazNieprzypisane?"checked":""} onchange="przelaczNieprzypisaneMenu(this.checked)"> Pokaż katalogi bez grupy w menu</label>
    </div>
    <form onsubmit="dodajGrupeMenuKategorii(event)" class="f-row" style="grid-template-columns:1fr 130px auto;align-items:end;margin-bottom:1rem">
      <div class="f-group"><label>Nazwa grupy nadrzędnej</label><input required name="nazwa" placeholder="np. Gry i zabawki, Edukacja, Ogród…"></div>
      <div class="f-group"><label>Ikona</label><input name="ikona" value="🗂️" maxlength="4"></div>
      <div class="f-group"><button class="btn" type="submit">➕ Dodaj grupę</button></div>
    </form>
    ${grupy.length?grupy.map((g,i)=>{
      const dzieci=g.kategorie.filter(k=>nazwy.includes(k));
      const martwe=g.kategorie.filter(k=>!nazwy.includes(k));
      return `<div class="menu-group-box" style="${g.aktywna?"":"opacity:.6"}">
        <form onsubmit="zapiszGrupeMenuKategorii(event,${jsArg(g.id)})">
          <div class="f-row" style="grid-template-columns:90px 1fr auto auto auto;align-items:end">
            <div class="f-group"><label>Ikona</label><input name="ikona" value="${esc(g.ikona)}" maxlength="4"></div>
            <div class="f-group"><label>Nazwa grupy</label><input name="nazwa" value="${esc(g.nazwa)}" required></div>
            <label class="chk-row" style="margin:.2rem 0 .55rem"><input type="checkbox" name="aktywna" ${g.aktywna?"checked":""}> <span>Widoczna</span></label>
            <div class="diag-actions" style="margin:0">
              <button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},-1)" ${i===0?"disabled":""}>↑</button>
              <button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},1)" ${i===grupy.length-1?"disabled":""}>↓</button>
            </div>
            <div class="diag-actions" style="margin:0"><button class="btn" type="submit">💾 Zapisz</button><button class="btn danger" type="button" onclick="if(confirm('Usunąć grupę menu? Produkty i katalogi zostaną.')) usunGrupeMenuKategorii(${jsArg(g.id)})">🗑️</button></div>
          </div>
        </form>
        <p style="font-size:.82rem;color:var(--muted2);margin:.35rem 0">W grupie: <b>${dzieci.length}</b> katalogów${martwe.length?` • ${martwe.length} nieistniejących odwołań do wyczyszczenia przy zapisie`:""}</p>
        <div class="diag-actions" style="margin:.4rem 0"><button class="btn ghost" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'wszystkie')">☑ Zaznacz wszystkie</button><button class="btn ghost" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'puste')">☐ Wyczyść grupę</button></div>
        <div class="menu-cat-grid">
          ${nazwy.map(k=>`<label><input type="checkbox" ${g.kategorie.includes(k)?"checked":""} onchange="przelaczKategorieWGrupie(${jsArg(g.id)},${jsArg(k)},this.checked)"> <span><b>${esc(k)}</b><br><small>${liczbaProduktowWKategorii(k)} produktów${przypisane.has(k)&&!g.kategorie.includes(k)?" • w innej grupie":""}</small></span></label>`).join("")}
        </div>
      </div>`;
    }).join(""):`<div class="backend-note">Nie ma jeszcze grup nadrzędnych. Dodaj np. „Gry i zabawki”, a potem zaznacz katalogi, które mają się pod nią pojawić w górnym menu.</div>`}
    ${bezGrup.length?`<p style="font-size:.82rem;color:var(--muted2);margin-top:.75rem">Katalogi bez grupy: ${bezGrup.map(esc).join(", ")}</p>`:""}
  </div>
  <div class="panel">
    <h1>🗂️ Katalogi (${nazwy.length})</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin-bottom:.8rem">Zmiana nazwy przenosi wszystkie produkty do nowej nazwy. Ukrycie chowa katalog i jego produkty w sklepie (nic nie jest kasowane). Każdy katalog ma własną podstronę w menu sklepu.</p>
    <table class="log-table">
      <tr><th>Katalog</th><th>Produktów</th><th>Nowa nazwa</th><th>Akcje</th></tr>
      ${nazwy.map(k=>{
        const n = wszystkie.filter(p=>{let x=(ustawienia.mapaProduktow||{})[p.id]||p.kategoria;for(let i=0;i<3&&zmiany[x];i++)x=zmiany[x];return x===k;}).length;
        const uk = ukryte.includes(k);
        const wlasny = wlasne.includes(k);
        const idKat = btoa(encodeURIComponent(k)).replace(/[^a-zA-Z0-9]/g,"");
        return `<tr style="${uk?'opacity:.5':''}">
        <td><b>${esc(k)}</b>${uk?' <span class="lvl lvl-ostrzezenie">ukryty</span>':""}${wlasny&&!n?' <span class="lvl lvl-info">nowy</span>':""}</td>
        <td>${n} ${n?`— <a href="#/kategoria/${encodeURIComponent(k)}">podgląd</a>`:""}</td>
        <td><div style="display:flex;gap:.4rem"><input value="${esc(k)}" id="kat_${idKat}" style="padding:.3rem .6rem;border:1.5px solid var(--line);border-radius:8px;max-width:170px">
          <button class="btn ghost" style="padding:.3rem .7rem" onclick="zmienKategorie('${esc(k)}', document.getElementById('kat_${idKat}').value)">Zmień</button></div></td>
        <td style="white-space:nowrap">
          <button class="btn ghost" style="padding:.3rem .55rem" onclick="otworzDodawanieProduktu(${jsArg(k)})" title="Dodaj produkt do katalogu">➕</button>
          <a class="btn ghost" style="padding:.3rem .55rem" href="#/admin/mapowanie" onclick="filtrMapowania=${jsArg(k)}" title="Mapuj produkty">🧩</a>
          <button class="ci-remove" style="color:var(--muted2)" onclick="przelaczKategorie(${jsArg(k)})" title="${uk?'Pokaż':'Ukryj'}">${uk?"👁️":"🙈"}</button>
          ${wlasny&&!n?`<button class="ci-remove" onclick="usunKatalog('${esc(k)}')" title="Usuń pusty katalog">🗑️</button>`:""}</td>
      </tr>`;}).join("")}
    </table>
  </div>`);
}
function dodajKatalog(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const k = String(f.get("nazwa")).trim();
  if(k.length<2){ toast("⚠️ Nazwa musi mieć min. 2 znaki"); return; }
  if(wszystkieKategorie().includes(k) || (ustawienia.wlasneKategorie||[]).includes(k)){ toast("Taki katalog już istnieje"); return; }
  ustawienia.wlasneKategorie = [...(ustawienia.wlasneKategorie||[]), k];
  loguj("info","Utworzono katalog: "+k);
  zapiszCzescUstawien({wlasneKategorie: ustawienia.wlasneKategorie});
}
function usunKatalog(k){
  ustawienia.wlasneKategorie = (ustawienia.wlasneKategorie||[]).filter(x=>x!==k);
  ustawienia.menuKategorii = grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(x=>x!==k)}));
  loguj("info","Usunięto pusty katalog: "+k);
  zapiszCzescUstawien({wlasneKategorie: ustawienia.wlasneKategorie, menuKategorii: ustawienia.menuKategorii});
}
function dodajGrupeMenuKategorii(e){
  e.preventDefault();
  const f=new FormData(e.target), nazwa=String(f.get("nazwa")||"").trim(), ikona=String(f.get("ikona")||"🗂️").trim()||"🗂️";
  if(nazwa.length<2){ toast("Podaj nazwę grupy"); return; }
  const grupy=grupyMenuKategorii();
  if(grupy.some(g=>g.nazwa.toLowerCase()===nazwa.toLowerCase())){ toast("Taka grupa już istnieje"); return; }
  grupy.push({id:"grp_"+Date.now().toString(36),nazwa,ikona,aktywna:true,kategorie:[]});
  loguj("info","Dodano grupę menu kategorii: "+nazwa);
  zapiszGrupyMenuKategorii(grupy);
}
function zapiszGrupeMenuKategorii(e,id){
  e.preventDefault();
  const f=new FormData(e.target), grupy=grupyMenuKategorii(), dozwolone=new Set(wszystkieKategorie());
  const i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i]={...grupy[i],nazwa:String(f.get("nazwa")||"").trim()||grupy[i].nazwa,ikona:String(f.get("ikona")||"🗂️").trim()||"🗂️",aktywna:!!f.get("aktywna"),kategorie:grupy[i].kategorie.filter(k=>dozwolone.has(k))};
  loguj("info","Zapisano grupę menu kategorii: "+grupy[i].nazwa);
  zapiszGrupyMenuKategorii(grupy);
}
function przelaczKategorieWGrupie(id,kat,wl){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i].kategorie = wl ? [...new Set([...grupy[i].kategorie,kat])] : grupy[i].kategorie.filter(k=>k!==kat);
  zapiszGrupyMenuKategorii(grupy);
}
function ustawKategorieWGrupie(id,tryb){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i].kategorie = tryb==="wszystkie" ? wszystkieKategorie() : [];
  zapiszGrupyMenuKategorii(grupy);
}
function przesunGrupeMenuKategorii(id,kierunek){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id), j=i+kierunek;
  if(i<0||j<0||j>=grupy.length) return;
  [grupy[i],grupy[j]]=[grupy[j],grupy[i]];
  zapiszGrupyMenuKategorii(grupy);
}
function usunGrupeMenuKategorii(id){
  zapiszGrupyMenuKategorii(grupyMenuKategorii().filter(g=>g.id!==id));
}
function przelaczNieprzypisaneMenu(wl){
  ustawienia.menuPokazNieprzypisane=!!wl;
  zapiszCzescUstawien({menuPokazNieprzypisane:ustawienia.menuPokazNieprzypisane});
}
function otworzDodawanieProduktu(kategoria){
  kategoriaNowegoProduktu = String(kategoria||"");
  location.hash="#/admin/produkty/dodaj";
}

/* ── Zaawansowane mapowanie produktów (produkt → katalog) ── */
let zaznaczoneMap = new Set(), filtrMapowania = "Wszystkie";
function widokAdminMapowanie(){
  const zmiany = ustawienia.kategorie || {};
  const mapa = ustawienia.mapaProduktow || {};
  const wszystkie = produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p))
    .map(p=>{ let k=mapa[p.id]||p.kategoria; for(let i=0;i<3&&zmiany[k];i++) k=zmiany[k]; return {...p, kategoria:k}; });
  const katalogi = wszystkieKategorie();
  const lista = filtrMapowania==="Wszystkie" ? wszystkie : wszystkie.filter(p=>p.kategoria===filtrMapowania);
  const opcje = katalogi.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join("");
  return asortymentSzkielet("mapowanie", `
  <div class="panel">
    <h1>🧩 Mapowanie produktów (${lista.length})</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin:.4rem 0 .8rem">Przypisuj produkty do katalogów: pojedynczo (lista w wierszu) albo masowo — zaznacz produkty, wybierz katalog docelowy i kliknij „Przenieś”. Działa też na produkty z products.json.</p>
    <div class="diag-actions" style="margin-bottom:.8rem">
      <button class="btn" onclick="otworzDodawanieProduktu(filtrMapowania==='Wszystkie'?'':filtrMapowania)">➕ Dodaj produkt</button>
      <form onsubmit="dodajKatalogZMapowania(event)" style="display:flex;gap:.5rem;flex:1;min-width:260px">
        <input required name="nazwa" placeholder="Nazwa nowego katalogu…" maxlength="40" style="flex:1;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <button class="btn ghost" type="submit">➕ Katalog</button>
      </form>
    </div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;background:var(--bg);border-radius:12px;padding:.7rem">
      <select onchange="filtrMapowania=this.value;zaznaczoneMap.clear();renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option ${filtrMapowania==="Wszystkie"?"selected":""}>Wszystkie</option>
        ${katalogi.map(k=>`<option ${k===filtrMapowania?"selected":""}>${esc(k)}</option>`).join("")}
      </select>
      <span style="font-size:.85rem;font-weight:700">Zaznaczone przenieś do:</span>
      <select id="mapCel" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">${opcje}</select>
      <button class="btn" onclick="przeniesZaznaczone()">🧩 Przenieś</button>
      <button class="btn ghost" onclick="zaznaczWszystkieMapowania()">☑ Zaznacz widoczne</button>
      <button class="btn ghost" onclick="usunMapowanieZaznaczonych()">↩️ Usuń wybrane mapowania</button>
      <button class="btn ghost" onclick="wyczyscMapowanie()">↩️ Wyczyść całe mapowanie</button>
    </div>
    <div style="overflow-x:auto"><table class="log-table">
      <tr><th></th><th>Produkt</th><th>Katalog</th><th>Przenieś do</th><th>Akcje</th></tr>
      ${lista.map(p=>`<tr>
        <td><input type="checkbox" ${zaznaczoneMap.has(p.id)?"checked":""} onchange="przelaczZaznaczenieMap(${p.id})" style="width:17px;height:17px;accent-color:var(--brand)"></td>
        <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b>${mapa[p.id]?' <span class="lvl lvl-info">zmapowany</span>':""}</td>
        <td>${esc(p.kategoria)}</td>
        <td><select onchange="mapujProdukt(${p.id}, this.value)" style="padding:.3rem .5rem;border-radius:8px;border:1.5px solid var(--line)">
          ${katalogi.map(k=>`<option ${k===p.kategoria?"selected":""}>${esc(k)}</option>`).join("")}
        </select></td>
        <td style="white-space:nowrap">
          <a class="btn ghost" href="#/admin/produkty/edytuj/${p.id}" style="padding:.3rem .55rem" title="Edytuj produkt">✏️</a>
          ${mapa[p.id]?`<button class="btn ghost" onclick="usunMapowanieProduktu(${p.id})" style="padding:.3rem .55rem" title="Usuń mapowanie">↩️</button>`:""}
        </td>
      </tr>`).join("")}
    </table></div>
  </div>`);
}
function przelaczZaznaczenieMap(id){ zaznaczoneMap.has(id) ? zaznaczoneMap.delete(id) : zaznaczoneMap.add(id); }
function zaznaczWszystkieMapowania(){
  const zmiany = ustawienia.kategorie || {}, mapa = ustawienia.mapaProduktow || {};
  let lista = produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p))
    .map(p=>{let k=mapa[p.id]||p.kategoria;for(let i=0;i<3&&zmiany[k];i++)k=zmiany[k];return {...p,kategoria:k};});
  if(filtrMapowania!=="Wszystkie") lista=lista.filter(p=>p.kategoria===filtrMapowania);
  lista.forEach(p=>zaznaczoneMap.add(p.id));
  renderuj();
}
function mapujProdukt(id, kat){
  ustawienia.mapaProduktow = {...(ustawienia.mapaProduktow||{}), [id]: kat};
  loguj("info",`Przemapowano produkt ${id} → ${kat}`);
  zapiszCzescUstawien({mapaProduktow: ustawienia.mapaProduktow});
}
function usunMapowanieProduktu(id){
  const mapa = {...(ustawienia.mapaProduktow||{})};
  delete mapa[id];
  loguj("info","Usunięto mapowanie produktu "+id);
  zapiszCzescUstawien({mapaProduktow:mapa});
}
function usunMapowanieZaznaczonych(){
  if(!zaznaczoneMap.size){ toast("Zaznacz produkty"); return; }
  const mapa = {...(ustawienia.mapaProduktow||{})};
  zaznaczoneMap.forEach(id=>delete mapa[id]);
  loguj("info",`Usunięto mapowanie ${zaznaczoneMap.size} produktów`);
  zaznaczoneMap.clear();
  zapiszCzescUstawien({mapaProduktow:mapa});
}
function przeniesZaznaczone(){
  const cel = $("mapCel")?.value;
  if(!cel || !zaznaczoneMap.size){ toast("Zaznacz produkty i wybierz katalog docelowy"); return; }
  const mapa = {...(ustawienia.mapaProduktow||{})};
  zaznaczoneMap.forEach(id=>mapa[id]=cel);
  loguj("info",`Przemapowano ${zaznaczoneMap.size} produktów → ${cel}`);
  zaznaczoneMap.clear();
  zapiszCzescUstawien({mapaProduktow: mapa});
}
function wyczyscMapowanie(){
  zaznaczoneMap.clear();
  loguj("info","Wyczyszczono mapowanie produktów");
  zapiszCzescUstawien({mapaProduktow: {}});
}
function dodajKatalogZMapowania(e){
  e.preventDefault();
  const nazwa = String(new FormData(e.target).get("nazwa")||"").trim();
  if(nazwa.length<2){ toast("Nazwa katalogu musi mieć minimum 2 znaki"); return; }
  if(wszystkieKategorie().includes(nazwa)){ toast("Taki katalog już istnieje"); return; }
  const wlasne = [...(ustawienia.wlasneKategorie||[]), nazwa];
  filtrMapowania = nazwa;
  zapiszCzescUstawien({wlasneKategorie:wlasne});
  loguj("info","Dodano katalog z mapowania: "+nazwa);
}
function zmienKategorie(stara, nowa){
  nowa = String(nowa||"").trim();
  if(!nowa || nowa===stara){ toast("Wpisz inną nazwę"); return; }
  ustawienia.kategorie = {...(ustawienia.kategorie||{}), [stara]: nowa};
  ustawienia.menuKategorii = grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.map(k=>k===stara?nowa:k)}));
  if(aktywnaKategoria===stara) aktywnaKategoria = nowa;
  zapiszCzescUstawien({kategorie: ustawienia.kategorie, menuKategorii: ustawienia.menuKategorii});
  loguj("info",`Zmieniono kategorię: ${stara} → ${nowa}`);
}
function przelaczKategorie(kat){
  const u = ustawienia.ukryteKategorie || [];
  ustawienia.ukryteKategorie = u.includes(kat) ? u.filter(x=>x!==kat) : [...u, kat];
  if(aktywnaKategoria===kat) aktywnaKategoria = "Wszystkie";
  zapiszCzescUstawien({ukryteKategorie: ustawienia.ukryteKategorie});
}

/* ── ⭐ Moderacja opinii ── */
let filtrOpinii = "oczekuje";
function widokAdminOpinie(){
  const oczekujace = opinie.filter(o=>o.status==="oczekuje").length;
  const lista = filtrOpinii==="wszystkie" ? opinie : opinie.filter(o=>o.status===filtrOpinii);
  return asortymentSzkielet("opinie", `
  <div class="panel">
    <h1>⭐ Opinie klientów (${opinie.length}) ${oczekujace?`<span class="lvl lvl-ostrzezenie">${oczekujace} do akceptacji</span>`:""}</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin:.4rem 0 .8rem">Opinie pojawiają się na stronie produktu dopiero po Twojej akceptacji. Klient wystawia je na dole strony produktu.</p>
    <div style="display:flex;gap:.6rem;margin-bottom:1rem">
      <select onchange="filtrOpinii=this.value;renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option value="oczekuje" ${filtrOpinii==="oczekuje"?"selected":""}>Oczekujące (${opinie.filter(o=>o.status==="oczekuje").length})</option>
        <option value="zatwierdzona" ${filtrOpinii==="zatwierdzona"?"selected":""}>Opublikowane (${opinie.filter(o=>o.status==="zatwierdzona").length})</option>
        <option value="wszystkie" ${filtrOpinii==="wszystkie"?"selected":""}>Wszystkie</option>
      </select>
    </div>
    ${lista.length ? lista.map(o=>{
      const p = produkty.find(x=>x.id===o.produktId) || [...prodBazowe,...produktyDodane].find(x=>x.id===o.produktId);
      return `<div class="order-box">
        <div class="order-head">
          <b>${esc(o.autor)}</b>
          <span style="color:var(--accent);font-weight:700">${gwiazdki(o.ocena)}</span>
          <span>${esc(o.data)}</span>
          <span class="lvl ${o.status==="zatwierdzona"?"lvl-info":"lvl-ostrzezenie"}">${o.status==="zatwierdzona"?"opublikowana":"oczekuje"}</span>
        </div>
        <div class="order-lines">
          ${p?`🏷️ <a href="#/produkt/${o.produktId}">${esc(p.nazwa)}</a><br>`:""}
          ${esc(o.tekst)}
        </div>
        <div class="diag-actions" style="margin-top:.6rem">
          ${o.status!=="zatwierdzona"?`<button class="btn" onclick="moderujOpinie('${o.id}','zatwierdz')">✅ Opublikuj</button>`:""}
          <button class="btn danger" onclick="if(confirm('Usunąć opinię?')) moderujOpinie('${o.id}','usun')">🗑️ Usuń</button>
        </div>
      </div>`;}).join("")
    : `<p style="color:var(--muted2)">Brak opinii w tym widoku.</p>`}
  </div>`);
}

/* ── 🧭 Rozmieszczenie sekcji strony głównej (wizualnie) ── */
function widokAdminRozmieszczenie(){
  const kolej = kolejnoscSekcji();
  return personalizacjaSzkielet("rozmieszczenie", `
  <div class="panel">
    <h1>🧭 Rozmieszczenie sekcji strony głównej</h1>
    <p style="font-size:.86rem;color:var(--muted2);margin:.4rem 0 1rem">Ułóż stronę dokładnie tak, jak chcesz: strzałki <b>↑ ↓</b> zmieniają kolejność, oko włącza/wyłącza sekcję. Po prawej widzisz schemat strony — klienci zobaczą ją dokładnie w tej kolejności. Zmiany zapisują się od razu.</p>
    <div class="rozm-grid">
      <div>
        ${kolej.map((id,i)=>{ const s=SEKCJE_GLOWNEJ[id]; const wid=sekcjaWidoczna(id); return `
        <div class="uklad-box ${wid?'':'wylaczona'}">
          <span class="uklad-nr">${i+1}</span>
          <span style="font-size:1.15rem">${s.ikona}</span>
          <b style="flex:1;font-size:.9rem">${s.nazwa}${wid?"":" <span class='lvl lvl-ostrzezenie'>ukryta</span>"}</b>
          <button class="btn ghost uklad-btn" ${i===0?"disabled":""} onclick="przesunSekcjeGlownej('${id}',-1)" title="Wyżej">↑</button>
          <button class="btn ghost uklad-btn" ${i===kolej.length-1?"disabled":""} onclick="przesunSekcjeGlownej('${id}',1)" title="Niżej">↓</button>
          <button class="btn ghost uklad-btn" onclick="przelaczSekcjeGlownej('${id}')" title="${wid?'Ukryj sekcję':'Pokaż sekcję'}">${wid?"👁️":"🙈"}</button>
        </div>`;}).join("")}
        <div class="diag-actions" style="margin-top:1rem">
          <a class="btn" href="#/">👁️ Zobacz stronę na żywo</a>
          <button class="btn danger" onclick="resetujRozmieszczenie()">↩️ Przywróć domyślne</button>
        </div>
      </div>
      <div class="mini-strona">
        <div class="mini-pasek">pasek info + nagłówek + menu</div>
        ${kolej.map(id=>{ const s=SEKCJE_GLOWNEJ[id]; const wid=sekcjaWidoczna(id);
          const h = id==="hero" ? 54 : id==="produkty" ? 66 : id==="kategorie" ? 44 : 28;
          return `<div class="mini-blok ${wid?'':'mini-ukryty'}" style="min-height:${h}px">${s.ikona} ${s.nazwa}</div>`;}).join("")}
        <div class="mini-pasek">stopka</div>
      </div>
    </div>
  </div>`);
}
function przesunSekcjeGlownej(id, dir){
  const k = kolejnoscSekcji();
  const i = k.indexOf(id), j = i+dir;
  if(i<0 || j<0 || j>=k.length) return;
  [k[i], k[j]] = [k[j], k[i]];
  loguj("info","Rozmieszczenie: przesunięto sekcję "+id);
  zapiszCzescUstawien({kolejnoscSekcji: k});
}
function przelaczSekcjeGlownej(id){
  const u = new Set(ustawienia.sekcjeUkryte||[]);
  u.has(id) ? u.delete(id) : u.add(id);
  loguj("info","Rozmieszczenie: przełączono widoczność sekcji "+id);
  zapiszCzescUstawien({sekcjeUkryte: [...u]});
}
function resetujRozmieszczenie(){
  loguj("info","Rozmieszczenie: przywrócono domyślne");
  zapiszCzescUstawien({kolejnoscSekcji: null, sekcjeUkryte: []});
}

/* ── Kody rabatowe ── */
function widokAdminRabaty(){
  const kody = Object.entries(KONFIG.kodyRabatowe);
  return asortymentSzkielet("rabaty", `
  <div class="panel">
    <h1>🎁 Kody rabatowe (${kody.length})</h1>
    <form onsubmit="dodajKod(event)" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin:.8rem 0 1rem">
      <div class="f-group" style="margin:0"><label>Kod</label><input required name="kod" placeholder="np. WIOSNA10" maxlength="20" style="text-transform:uppercase"></div>
      <div class="f-group" style="margin:0;max-width:120px"><label>Rabat %</label><input required name="procent" type="number" min="1" max="90"></div>
      <button class="btn" type="submit">➕ Dodaj</button>
    </form>
    ${kody.length?`<table class="log-table"><tr><th>Kod</th><th>Rabat</th><th>Akcje</th></tr>
      ${kody.map(([k,v])=>`<tr><td><b>${esc(k)}</b></td><td><input id="kod_${esc(k)}" type="number" min="1" max="90" value="${v}" style="width:80px;padding:.3rem .5rem;border:1.5px solid var(--line);border-radius:8px"> %</td>
        <td><button class="btn ghost" style="padding:.3rem .55rem" onclick="zmienKod('${esc(k)}',document.getElementById('kod_${esc(k)}').value)">💾</button>
        <button class="ci-remove" onclick="usunKod('${esc(k)}')">🗑️</button></td></tr>`).join("")}</table>`
    : `<p style="color:var(--muted2)">Brak kodów — klienci nie mają teraz żadnych rabatów.</p>`}
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.8rem">Kody możesz ogłosić w pasku na górze strony (🎨 Wygląd i treści).</p>
  </div>`);
}
function dodajKod(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const kod = String(f.get("kod")).trim().toUpperCase();
  const proc = +f.get("procent");
  if(!/^[A-Z0-9]{2,20}$/.test(kod) || !(proc>=1 && proc<=90)){ toast("⚠️ Kod: 2–20 znaków (litery/cyfry), rabat 1–90%"); return; }
  KONFIG.kodyRabatowe[kod] = proc;
  zapiszCzescUstawien({kody: {...KONFIG.kodyRabatowe}});
  loguj("info",`Dodano kod rabatowy ${kod} (−${proc}%)`);
}
function usunKod(kod){
  delete KONFIG.kodyRabatowe[kod];
  if(rabat?.kod===kod) usunRabat();
  zapiszCzescUstawien({kody: {...KONFIG.kodyRabatowe}});
  loguj("info","Usunięto kod rabatowy "+kod);
}
function zmienKod(kod, procent){
  procent = +procent;
  if(!(procent>=1&&procent<=90)){ toast("Rabat musi wynosić 1–90%"); return; }
  KONFIG.kodyRabatowe[kod] = procent;
  zapiszCzescUstawien({kody:{...KONFIG.kodyRabatowe}});
  loguj("info",`Zmieniono kod ${kod} na −${procent}%`);
}

/* ── Dostawa i płatności ── */
let stanPaynowAdmin={sprawdzono:false,configured:false,env:"production",continueUrl:"",notificationUrl:"",apiBaseUrl:"",error:""};
function domyslneUrlePaynow(){
  return {notificationUrl:`${location.origin}/api/store?action=paynow-notification`, continueUrl:`${location.origin}/#/zamowienia`};
}
function paynowStatusAdminHTML(){
  const s=stanPaynowAdmin;
  if(!s.sprawdzono) return `<div class="pay-note" style="text-align:left">Kliknij „Sprawdź konfigurację Paynow”, aby zobaczyć czy Netlify ma ustawione klucze API.</div>`;
  if(s.error) return `<div class="pay-note" style="text-align:left;color:var(--danger)">Błąd sprawdzania Paynow: ${esc(s.error)}</div>`;
  return `<div class="backend-note" style="${s.configured?"border-color:#86efac;background:#f0fdf4;color:#166534":"border-color:#f59e0b;background:#fffbeb;color:#92400e"}">
    <b>${s.configured?"Paynow API skonfigurowane ✅":"Paynow API nie ma jeszcze kluczy na serwerze"}</b><br>
    Środowisko: <code>${esc(s.env||"production")}</code>${s.apiBaseUrl?` • API: <code>${esc(s.apiBaseUrl)}</code>`:""}<br>
    ${s.configured?"Klient po wybraniu Paynow dostanie automatyczny link płatności, a webhook zaktualizuje status zamówienia.":"Ustaw w Netlify zmienne PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY, potem zrób redeploy."}
  </div>`;
}
function paynowPanelAdminHTML(){
  const urls=domyslneUrlePaynow();
  return `<div class="panel">
    <h2 style="margin-top:0">💳 mBank Paynow API</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">To jest prawdziwa integracja API. Sekrety muszą być w Netlify Environment Variables, nie w HTML ani localStorage.</p>
    ${paynowStatusAdminHTML()}
    <div class="f-row" style="grid-template-columns:1fr 1fr;margin-top:1rem">
      <div class="f-group"><label>URL powiadomień / webhook Paynow</label><input readonly value="${esc(stanPaynowAdmin.notificationUrl||urls.notificationUrl)}" onclick="this.select()"></div>
      <div class="f-group"><label>URL powrotu klienta po płatności</label><input readonly value="${esc(stanPaynowAdmin.continueUrl||urls.continueUrl)}" onclick="this.select()"></div>
    </div>
    <table class="log-table" style="margin-top:.7rem">
      <tr><th>Zmienna Netlify</th><th>Co wpisać</th></tr>
      <tr><td><code>PAYNOW_API_KEY</code></td><td>Api-Key z panelu Paynow: Settings → Shops and poses → Authentication</td></tr>
      <tr><td><code>PAYNOW_SIGNATURE_KEY</code></td><td>Signature-Key z tego samego miejsca</td></tr>
      <tr><td><code>PAYNOW_ENV</code></td><td><code>production</code> dla prawdziwej sprzedaży albo <code>sandbox</code> do testów</td></tr>
      <tr><td><code>PAYNOW_CONTINUE_URL</code></td><td>Opcjonalnie: własny URL powrotu; domyślnie <code>${esc(urls.continueUrl)}</code></td></tr>
      <tr><td><code>PAYNOW_NOTIFICATION_URL</code></td><td>Opcjonalnie: własny webhook; domyślnie <code>${esc(urls.notificationUrl)}</code></td></tr>
    </table>
    <div class="diag-actions" style="margin-top:.9rem">
      <button class="btn" type="button" onclick="sprawdzPaynowKonfiguracje()">🔎 Sprawdź konfigurację Paynow</button>
      <button class="btn ghost" type="button" onclick="ustawUrlePaynow()">🔗 Ustaw URL-e w Paynow przez API</button>
      <a class="btn ghost" href="https://docs.paynow.pl/docs/v3/integration" target="_blank" rel="noopener">Dokumentacja Paynow</a>
    </div>
    <p class="pay-note" style="text-align:left;margin-top:.8rem">Po ustawieniu zmiennych w Netlify wykonaj redeploy. Dopiero wtedy przycisk „Sprawdź konfigurację” pokaże zielony status.</p>
  </div>`;
}
async function sprawdzPaynowKonfiguracje(){
  try{
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:""};
    const d=await chmura("paynow-config",{timeout:10000});
    stanPaynowAdmin={sprawdzono:true,configured:!!d.configured,env:d.env||"",continueUrl:d.continueUrl||"",notificationUrl:d.notificationUrl||"",apiBaseUrl:d.apiBaseUrl||"",error:""};
    toast(d.configured?"Paynow API skonfigurowane ✅":"Brak kluczy Paynow w Netlify");
  }catch(e){
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:e.message};
    toast("Paynow: "+e.message);
  }
  renderuj();
}
async function ustawUrlePaynow(){
  if(!chmuraToken){ chmuraUstawToken(); return; }
  try{
    toast("Ustawiam URL-e Paynow…");
    const d=await chmura("paynow-configure-urls",{method:"POST",body:domyslneUrlePaynow(),timeout:18000});
    stanPaynowAdmin={sprawdzono:true,configured:true,env:d.env||stanPaynowAdmin.env,continueUrl:d.continueUrl||"",notificationUrl:d.notificationUrl||"",apiBaseUrl:stanPaynowAdmin.apiBaseUrl,error:""};
    toast("URL-e Paynow ustawione ✅");
  }catch(e){
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:e.message};
    toast("Nie ustawiono URL-i Paynow: "+e.message);
    loguj("blad","Paynow configure urls: "+e.message);
  }
  renderuj();
}
function emailPanelAdminHTML(){
  const e=stanBramki.email||{};
  const gotowy=!!e.configured, polaczony=gotowy&&!!chmuraToken;
  return `<div class="panel">
    <h2 style="margin-top:0">📧 Bramka e-mail SMTP / Gmail</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">Automatyczne wiadomości wychodzą z serwera Netlify. Logowanie w Chrome do Gmaila nie wystarcza dla backendu — potrzebne jest hasło aplikacji Google albo dane SMTP zapisane jako sekrety Netlify.</p>
    <div class="backend-note" style="${gotowy?"border-color:#86efac;background:#f0fdf4;color:#166534":"border-color:#f59e0b;background:#fffbeb;color:#92400e"}">
      <b>${gotowy?"SMTP skonfigurowany ✅":"SMTP/Gmail nie jest jeszcze skonfigurowany"}</b><br>
      Nadawca: <code>${esc(e.from||"sklepartway@gmail.com")}</code> • Provider: <code>${esc(e.provider||"gmail-smtp")}</code><br>
      ${polaczony?"Panel ma hasło bazy — test i ręczne wiadomości mogą być wysyłane.":gotowy?"Wpisz hasło bazy administratora, aby wysyłać testy z panelu.":"Ustaw zmienne poniżej w Netlify i zrób redeploy."}
    </div>
    <table class="log-table" style="margin-top:.7rem">
      <tr><th>Zmienna Netlify</th><th>Wartość dla Gmail</th></tr>
      <tr><td><code>EMAIL_PROVIDER</code></td><td><code>gmail</code></td></tr>
      <tr><td><code>EMAIL_FROM</code></td><td><code>sklepartway@gmail.com</code></td></tr>
      <tr><td><code>EMAIL_FROM_NAME</code></td><td><code>Artway-TM</code></td></tr>
      <tr><td><code>SMTP_HOST</code></td><td><code>smtp.gmail.com</code></td></tr>
      <tr><td><code>SMTP_PORT</code></td><td><code>465</code></td></tr>
      <tr><td><code>SMTP_SECURE</code></td><td><code>true</code></td></tr>
      <tr><td><code>SMTP_USER</code></td><td><code>sklepartway@gmail.com</code></td></tr>
      <tr><td><code>SMTP_PASS</code></td><td>hasło aplikacji Google — nie zwykłe hasło do Gmaila</td></tr>
      <tr><td><code>EMAIL_ADMIN_TO</code></td><td>adres, na który sklep wyśle powiadomienie o nowym zamówieniu</td></tr>
    </table>
    <form onsubmit="wyslijTestEmail(event)" style="margin-top:1rem">
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>Wyślij test na adres</label><input type="email" name="email" value="${esc(KONFIG.emailSklepu)}" required></div>
        <div class="f-group"><button class="btn" type="submit" ${gotowy?"":"disabled"}>📧 Wyślij test</button></div>
      </div>
    </form>
    <div class="diag-actions" style="margin-top:.8rem">
      <button class="btn ghost" type="button" onclick="sprawdzBramke()">🔎 Sprawdź e-mail / Netlify</button>
      ${chmuraToken?"":`<button class="btn ghost" type="button" onclick="chmuraUstawToken()">🔑 Wpisz hasło bazy</button>`}
    </div>
  </div>`;
}
function widokAdminDostawy(){
  KONFIG.dostawy = normalizujDostawyInPost(KONFIG.dostawy);
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  const pobranie = KONFIG.platnosci.find(p=>p.id==="pobranie"), paynow = KONFIG.platnosci.find(p=>p.id==="paynow"), telefon = KONFIG.platnosci.find(p=>p.id==="telefon");
  const paczkomat = KONFIG.dostawy.find(d=>d.id==="paczkomat") || DOMYSLNA_DOSTAWA_INPOST;
  const kurierInpost = KONFIG.dostawy.find(d=>d.id==="kurier_inpost") || DOMYSLNA_DOSTAWA_INPOST_KURIER;
  return personalizacjaSzkielet("dostawy", `
  <div class="panel">
    <h1>🚚 Dostawa i płatności</h1>
    <form onsubmit="zapiszDostawy(event)">
      <h3 class="f-sekcja">🚚 Dostawy InPost</h3>
      <div class="backend-note" style="border-color:#facc15;background:#fffbeb;color:#713f12"><b>Aktywne są tylko metody InPost:</b> Paczkomat/Punkt InPost oraz Kurier InPost. Inni przewoźnicy i odbiór osobisty pozostają wyłączone.</div>
      <div class="f-row" style="grid-template-columns:1fr 1fr 1fr">
        <div class="f-group"><label>Paczkomat InPost (zł)</label><input name="kosztPaczkomat" inputmode="decimal" value="${paczkomat.koszt}"></div>
        <div class="f-group"><label>Kurier InPost (zł)</label><input name="kosztKurierInpost" inputmode="decimal" value="20" readonly><small style="color:var(--muted2)">Stały koszt dla klienta: 20 zł.</small></div>
        <div class="f-group"><label>Darmowa dostawa od (zł)</label><input name="darmowaDostawaOd" inputmode="decimal" value="${KONFIG.darmowaDostawaOd}"></div>
      </div>
      <div class="backend-note"><b>Dla klienta dostępne są zawsze dokładnie dwie metody:</b> Paczkomat/Punkt InPost oraz Kurier InPost za 20 zł.</div>
      <div class="f-group" style="max-width:320px"><label>Deklarowany czas wysyłki — zmienia się wszędzie</label><input name="czasWysylki" value="${esc(czasWysylki())}" placeholder="np. 24 h, 48 h, 2 dni robocze"></div>
      <h3 class="f-sekcja">💳 Płatności i bramka</h3>
      <div class="f-group"><label>Awaryjny ręczny link mBank Paynow (opcjonalnie — gdy API nie jest jeszcze skonfigurowane)</label>
        <input name="linkPlatnosci" placeholder="https://paynow.pl/… albo link płatności z panelu" value="${esc(KONFIG.linkPlatnosci)}"></div>
      <div class="f-group" style="max-width:260px"><label>Numer do przelewu na telefon</label>
        <input name="numerPrzelewuTelefon" inputmode="tel" value="${esc(formatTelefonPlatnosci())}"></div>
      <div class="f-row">
        <label class="chk-row"><input type="checkbox" name="pobranieWl" ${pobranie.wylaczona?"":"checked"}> 💵 Za pobraniem włączone</label>
        <label class="chk-row"><input type="checkbox" name="paynowWl" ${paynow.wylaczona?"":"checked"}> 💳 mBank Paynow włączony</label>
        <label class="chk-row"><input type="checkbox" name="telefonWl" ${telefon.wylaczona?"":"checked"}> 📱 Przelew na telefon włączony</label>
      </div>
      <div class="f-group" style="max-width:220px"><label>Opłata za pobranie (zł)</label><input name="oplataPobranie" inputmode="decimal" value="${pobranie.oplata}"></div>
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz</button>
        <button class="btn danger" type="button" onclick="resetujUstawienia()">↩️ Przywróć wszystkie domyślne</button>
      </div>
	    </form>
	  </div>
	  ${paynowPanelAdminHTML()}
	  ${emailPanelAdminHTML()}
  <div class="panel">
    <h2 style="margin-top:0">➕ Dodatkowa metoda płatności</h2>
    <form onsubmit="dodajMetodePlatnosci(event)">
      <div class="f-row admin-three">
        <div class="f-group"><label>Nazwa</label><input required name="nazwa" placeholder="np. Płatność przy odbiorze osobistym"></div>
        <div class="f-group"><label>Opłata (zł)</label><input required name="oplata" inputmode="decimal" value="0"></div>
        <div class="f-group"><button class="btn" type="submit">➕ Dodaj</button></div>
      </div>
    </form>
    ${KONFIG.platnosci.filter(p=>!["pobranie","paynow","telefon","przelew","online"].includes(p.id)).length?`
      <table class="log-table"><tr><th>Metoda</th><th>Opłata</th><th></th></tr>
      ${KONFIG.platnosci.filter(p=>!["pobranie","paynow","telefon","przelew","online"].includes(p.id)).map(p=>`<tr><td><b>${esc(p.nazwa)}</b></td><td>${p.oplata?zl(p.oplata):"bez opłaty"}</td><td><button class="ci-remove" onclick="usunMetodePlatnosci('${p.id}')">🗑️</button></td></tr>`).join("")}</table>`:""}
  </div>`);
}
function zapiszDostawy(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const numer = tylkoCyfry(f.get("numerPrzelewuTelefon") || NUMER_PRZELEWU_TELEFON_DOMYSLNY);
  const platnosci = normalizujPlatnosci(KONFIG.platnosci).map(p=>({...p}));
  platnosci.forEach(p=>{
    if(p.id==="pobranie"){ p.oplata = +(parseFloat(String(f.get("oplataPobranie")).replace(",","."))||0).toFixed(2); p.wylaczona = !f.get("pobranieWl"); }
    if(p.id==="paynow") p.wylaczona = !f.get("paynowWl");
    if(p.id==="telefon"){ p.wylaczona = !f.get("telefonWl"); p.nazwa = `Przelew na telefon ${formatTelefonPlatnosci(numer)}`; }
  });
  zapiszCzescUstawien({
    linkPlatnosci: String(f.get("linkPlatnosci")).trim(),
    numerPrzelewuTelefon: numer,
    czasWysylki: String(f.get("czasWysylki")||"").trim(),
    darmowaDostawaOd: f.get("darmowaDostawaOd"),
    kurierInpostAktywny: true,
    kosztPaczkomat: f.get("kosztPaczkomat"),
    kosztKurierInpost: f.get("kosztKurierInpost"),
    dostawy: normalizujDostawyInPost([
      {...DOMYSLNA_DOSTAWA_INPOST,koszt:(()=>{const n=Number(String(f.get("kosztPaczkomat")).replace(",","."));return Number.isFinite(n)?n:DOMYSLNA_DOSTAWA_INPOST.koszt;})()},
      {...DOMYSLNA_DOSTAWA_INPOST_KURIER,koszt:20}
    ]),
    oplataPobranie: f.get("oplataPobranie"),
    pobranieWl: !!f.get("pobranieWl"),
    paynowWl: !!f.get("paynowWl"),
    telefonWl: !!f.get("telefonWl"),
    platnosci
  });
}
function dodajMetodeDostawy(e){
  e.preventDefault();
  KONFIG.dostawy=normalizujDostawyInPost(KONFIG.dostawy);
  zapiszCzescUstawien({dostawy:KONFIG.dostawy.map(x=>({...x}))});
  toast("Dodatkowe metody dostawy są wyłączone — sklep wysyła tylko przez InPost");
  loguj("info","Zablokowano dodanie dodatkowej metody dostawy — aktywny tylko InPost");
}
function usunMetodeDostawy(id){
  KONFIG.dostawy=normalizujDostawyInPost(KONFIG.dostawy);
  zapiszCzescUstawien({dostawy:KONFIG.dostawy.map(x=>({...x}))});
  loguj("info","Znormalizowano metody dostawy do InPost");
}
function dodajMetodePlatnosci(e){
  e.preventDefault();
  const f = new FormData(e.target), oplata=parseFloat(String(f.get("oplata")).replace(",","."));
  if(!(oplata>=0)){ toast("Podaj poprawną opłatę"); return; }
  const p={id:"wlasna_p_"+Date.now(),nazwa:String(f.get("nazwa")).trim(),oplata:+oplata.toFixed(2)};
  KONFIG.platnosci=[...KONFIG.platnosci,p];
  zapiszCzescUstawien({platnosci:KONFIG.platnosci.map(x=>({...x}))});
  loguj("info","Dodano metodę płatności: "+p.nazwa);
}
function usunMetodePlatnosci(id){
  KONFIG.platnosci=KONFIG.platnosci.filter(p=>p.id!==id);
  zapiszCzescUstawien({platnosci:KONFIG.platnosci.map(x=>({...x}))});
  loguj("info","Usunięto dodatkową metodę płatności");
}

/* ── Wygląd i treści ── */
function widokAdminWyglad(){
  const u=ustawienia.uklad||{}, h=ustawienia.hero||{};
  const df=daneFirmy();
  return personalizacjaSzkielet("wyglad", `
  <div class="panel">
    <h1>🎨 Zaawansowany układ globalny</h1>
    <p style="font-size:.86rem;color:var(--muted2);margin-bottom:1rem">Ustawienia działają na całym sklepie. Kolorystyka pozostaje bez zmian.</p>
    <form onsubmit="zapiszWyglad(event)">
      <h3 class="f-sekcja">🏪 Sklep</h3>
      <div class="f-row">
        <div class="f-group"><label>Nazwa sklepu (logo)</label><input name="nazwaSklepu" value="${esc(KONFIG.nazwaSklepu)}"></div>
        <div class="f-group"><label>Telefon (stopka i kontakt)</label><input name="telefon" value="${esc(KONFIG.telefon)}"></div>
      </div>
      <div class="f-group"><label>E-mail sklepu (zamówienia i kontakt)</label><input name="emailSklepu" type="email" value="${esc(KONFIG.emailSklepu)}"></div>
      <h3 class="f-sekcja">🏢 Dane firmy do regulaminu i polityki prywatności</h3>
      <div class="f-row">
        <div class="f-group"><label>Nazwa firmy / sklepu</label><input name="firmaNazwa" value="${esc(df.nazwa)}"></div>
        <div class="f-group"><label>Identyfikator firmy (NIP/PESEL)</label><input name="firmaId" inputmode="numeric" value="${esc(df.identyfikator)}"></div>
      </div>
      <div class="f-group"><label>Adres firmy (opcjonalnie)</label><input name="firmaAdres" value="${esc(df.adres||"")}" placeholder="Ulica, kod pocztowy, miejscowość"></div>
      <div class="f-group"><label>Logo graficzne (zamiast nazwy tekstowej)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          ${ustawienia.logoObraz?`<img src="${ustawienia.logoObraz}" style="height:36px;max-width:190px;object-fit:contain;border-radius:6px;background:var(--bg);padding:2px 6px">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — wyświetlana jest nazwa tekstowa</span>`}
          ${polePlikuHTML("wgrajLogo(this)", "Wgraj logo")}
          ${ustawienia.logoObraz?`<button class="btn danger" type="button" onclick="usunLogo()">🗑️ Usuń logo</button>`:""}
        </div>
      </div>
      <div class="f-group"><label>Miniaturka w zakładce przeglądarki (favicon)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          <img src="${esc(ustawienia.faviconObraz||domyslnyFavicon())}" style="width:34px;height:34px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:var(--bg);padding:2px">
          ${polePlikuHTML("wgrajFavicon(this)", "Wgraj miniaturkę")}
          ${ustawienia.faviconObraz?`<button class="btn danger" type="button" onclick="usunFavicon()">🗑️ Usuń miniaturkę</button>`:""}
          <small style="color:var(--muted2)">Najlepiej kwadrat PNG/JPG. Zmieni ikonę w karcie przeglądarki.</small>
        </div>
      </div>
      <div class="f-group"><label>Pasek na górze strony (może zawierać HTML, np. &lt;b&gt;)</label><input name="pasekInfo" value="${esc(pasekInfoHTML())}"></div>
      <div class="f-group" style="max-width:320px"><label>Czas wysyłki używany na całej stronie</label><input name="czasWysylki" value="${esc(czasWysylki())}" placeholder="np. 24 h, 48 h, 2 dni robocze"></div>
      <div class="f-group"><label>Tekst w wyszukiwarce</label><input name="tekstSzukaj" value="${esc(ustawienia.tekstSzukaj||"Szukaj produktu…")}"></div>
      <h3 class="f-sekcja">🖼️ Baner na stronie głównej</h3>
      <div class="f-group"><label>Mała etykieta nad tytułem</label><input name="heroEtykieta" value="${esc(h.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}"></div>
      <div class="f-group"><label>Tytuł banera</label><input name="heroTytul" value="${esc(KONFIG.heroTytul)}"></div>
      <div class="f-group"><label>Opis banera</label><textarea name="heroOpis" rows="2">${esc(KONFIG.heroOpis)}</textarea></div>
      <div class="f-row">
        <div class="f-group"><label>Tekst pierwszego przycisku</label><input name="heroPrzycisk1" value="${esc(h.przycisk1||"Zobacz ofertę")}"></div>
        <div class="f-group"><label>Tekst drugiego przycisku</label><input name="heroPrzycisk2" value="${esc(h.przycisk2||"Sprawdź promocje")}"></div>
      </div>
      <div class="f-group"><label>Link drugiego przycisku</label><input name="heroLink2" value="${esc(h.link2||"#/promocje")}" placeholder="#/promocje lub https://…"></div>
      <div class="f-group"><label>Zdjęcie tła baneru (opcjonalnie — z przyciemnieniem, tekst zostaje czytelny)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          ${h.obraz?`<img src="${h.obraz}" style="width:150px;height:60px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — kolorowy gradient</span>`}
          ${polePlikuHTML("wgrajTloHero(this)", "Wgraj tło")}
          ${h.obraz?`<button class="btn danger" type="button" onclick="usunTloHero()">🗑️ Usuń tło</button>`:""}
        </div>
      </div>
      <h3 class="f-sekcja">🎁 Pasek okazji (sekcja strony głównej)</h3>
      <div class="f-row">
        <div class="f-group"><label>Tytuł</label><input name="okazjaTytul" value="${esc(ustawienia.pasekOkazji?.tytul||"Dobry moment na zakupy")}"></div>
        <div class="f-group"><label>Tekst przycisku</label><input name="okazjaTekstLinku" value="${esc(ustawienia.pasekOkazji?.tekstLinku||"Zobacz okazje")}"></div>
      </div>
      <div class="f-group"><label>Opis (np. z aktualnym kodem rabatowym)</label><input name="okazjaOpis" value="${esc(ustawienia.pasekOkazji?.opis||"")}" placeholder="Użyj kodu START10 w koszyku i odbierz 10% rabatu na zamówienie."></div>
      <div class="f-group"><label>Link przycisku</label><input name="okazjaLink" value="${esc(ustawienia.pasekOkazji?.link||"#/promocje")}"></div>
      <p style="font-size:.82rem;margin:-.3rem 0 1rem"><a href="#/admin/bannery">Zarządzaj dodatkowymi banerami →</a> • <a href="#/admin/rozmieszczenie">Zmień kolejność sekcji →</a></p>
      <h3 class="f-sekcja">📐 Szerokość i gęstość</h3>
      <div class="settings-grid">
        <div class="setting-box"><h3>Szerokość strony</h3><select name="szerokosc" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="1100px" ${u.szerokosc==="1100px"?"selected":""}>Kompaktowa — 1100 px</option>
          <option value="1200px" ${!u.szerokosc||u.szerokosc==="1200px"?"selected":""}>Standardowa — 1200 px</option>
          <option value="1400px" ${u.szerokosc==="1400px"?"selected":""}>Szeroka — 1400 px</option>
        </select></div>
        <div class="setting-box"><h3>Karty produktów</h3><select name="kartaMin" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="200px" ${u.kartaMin==="200px"?"selected":""}>Więcej kart w rzędzie</option>
          <option value="240px" ${!u.kartaMin||u.kartaMin==="240px"?"selected":""}>Standardowe</option>
          <option value="280px" ${u.kartaMin==="280px"?"selected":""}>Duże karty</option>
        </select></div>
        <div class="setting-box"><h3>Odstępy</h3><select name="gestosc" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="compact" ${u.gestosc==="compact"?"selected":""}>Kompaktowe</option>
          <option value="standard" ${!u.gestosc||u.gestosc==="standard"?"selected":""}>Standardowe</option>
          <option value="comfortable" ${u.gestosc==="comfortable"?"selected":""}>Przestronne</option>
        </select></div>
        <div class="setting-box"><h3>Zaokrąglenia</h3><select name="promien" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="10px" ${u.promien==="10px"?"selected":""}>Małe</option>
          <option value="16px" ${!u.promien||u.promien==="16px"?"selected":""}>Standardowe</option>
          <option value="22px" ${u.promien==="22px"?"selected":""}>Duże</option>
        </select></div>
      </div>
      <h3 class="f-sekcja">🧩 Widoczność sekcji strony głównej</h3>
      <div class="settings-grid">
        <label class="chk-row"><input type="checkbox" name="sekcjaKategorie" ${u.sekcjaKategorie===false?"":"checked"}> Katalogi produktów</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaKroki" ${u.sekcjaKroki===false?"":"checked"}> Jak kupić — 4 kroki</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaOnas" ${u.sekcjaOnas===false?"":"checked"}> Sekcja o sklepie</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaFaq" ${u.sekcjaFaq===false?"":"checked"}> FAQ na stronie głównej</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaKontakt" ${u.sekcjaKontakt===false?"":"checked"}> Końcowa sekcja kontaktu</label>
        <label class="chk-row"><input type="checkbox" name="pasekInfoWidoczny" ${u.pasekInfoWidoczny===false?"":"checked"}> Pasek informacyjny u góry</label>
        <label class="chk-row"><input type="checkbox" name="statycznyNaglowek" ${u.statycznyNaglowek?"checked":""}> Nagłówek niesticky</label>
      </div>
      <h3 class="f-sekcja">📃 Stopka</h3>
      <div class="f-group"><label>Opis sklepu w stopce</label><textarea name="opisSklepu" rows="2">${esc(KONFIG.opisSklepu)}</textarea></div>
      <div class="f-group"><label>Dolny tekst stopki</label><input name="stopkaCopy" value="${esc(ustawienia.stopkaCopy||`© ${new Date().getFullYear()} ${KONFIG.nazwaSklepu}. Wszystkie prawa zastrzeżone.`)}"></div>
      <h3 class="f-sekcja">🔎 SEO i tytuł przeglądarki</h3>
      <div class="f-group"><label>Tytuł strony w Google i karcie przeglądarki</label><input name="seoTytul" value="${esc(ustawienia.seo?.tytul||KONFIG.nazwaSklepu+" — Sklep internetowy")}"></div>
      <div class="f-group"><label>Opis strony dla wyszukiwarek</label><textarea name="seoOpis" rows="2">${esc(ustawienia.seo?.opis||"Sklep wielobranżowy Artway-TM. Elektronika, dom i ogród, narzędzia, odzież i sport.")}</textarea></div>
      <div class="diag-actions"><button class="btn" type="submit">💾 Zapisz cały układ</button><button class="btn ghost" type="button" onclick="eksportujIndexHTML()">⬇️ Pobierz publiczny index.html</button><a class="btn ghost" href="#/">👁️ Podgląd sklepu</a></div>
    </form>
  </div>`);
}
function zapiszWyglad(e){
  e.preventDefault();
  const f = new FormData(e.target);
  zapiszCzescUstawien({
    nazwaSklepu: String(f.get("nazwaSklepu")).trim(),
    telefon: String(f.get("telefon")).trim(),
    emailSklepu: String(f.get("emailSklepu")).trim(),
    daneFirmy:{
      nazwa:String(f.get("firmaNazwa")||"Artway-TM").trim()||"Artway-TM",
      identyfikator:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      nip:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      pesel:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      adres:String(f.get("firmaAdres")||"").trim()
    },
    pasekInfo: String(f.get("pasekInfo")),
    czasWysylki: String(f.get("czasWysylki")||"").trim(),
    heroTytul: String(f.get("heroTytul")).trim(),
    heroOpis: String(f.get("heroOpis")).trim(),
    opisSklepu: String(f.get("opisSklepu")).trim(),
    tekstSzukaj:String(f.get("tekstSzukaj")).trim(),
    stopkaCopy:String(f.get("stopkaCopy")).trim(),
    seo:{tytul:String(f.get("seoTytul")).trim(),opis:String(f.get("seoOpis")).trim()},
    hero:{
      ...(ustawienia.hero||{}),   // zachowaj wgrane tło (obraz)
      etykieta:String(f.get("heroEtykieta")).trim(),
      przycisk1:String(f.get("heroPrzycisk1")).trim(),
      przycisk2:String(f.get("heroPrzycisk2")).trim(),
      link2:String(f.get("heroLink2")).trim()
    },
    pasekOkazji:{
      tytul:String(f.get("okazjaTytul")||"").trim(),
      opis:String(f.get("okazjaOpis")||"").trim(),
      tekstLinku:String(f.get("okazjaTekstLinku")||"").trim(),
      link:bezpiecznyLink(String(f.get("okazjaLink")||"#/promocje").trim())
    },
    uklad:{
      szerokosc:String(f.get("szerokosc")),
      kartaMin:String(f.get("kartaMin")),
      gestosc:String(f.get("gestosc")),
      promien:String(f.get("promien")),
      sekcjaKategorie:!!f.get("sekcjaKategorie"),
      sekcjaKroki:!!f.get("sekcjaKroki"),
      sekcjaOnas:!!f.get("sekcjaOnas"),
      sekcjaFaq:!!f.get("sekcjaFaq"),
      sekcjaKontakt:!!f.get("sekcjaKontakt"),
      pasekInfoWidoczny:!!f.get("pasekInfoWidoczny"),
      statycznyNaglowek:!!f.get("statycznyNaglowek")
    }
  });
}

/* ── 📁 OBRAZKI Z DYSKU (bez hostingu zdjęć) ──
   Wgrywane pliki są zmniejszane i zapisywane w ustawieniach sklepu
   (data-URL). Trafiają też do eksportowanego index.html — więc po
   publikacji klienci widzą Twoje grafiki. Limit ~1 MB po kompresji. */
function wgrajObrazek(input, maxSzer, poWgraniu){
  const plik = input.files && input.files[0];
  if(!plik) return;
  if(!plik.type.startsWith("image/")){ toast("⚠️ Wybierz plik graficzny (JPG/PNG)"); return; }
  const czytnik = new FileReader();
  czytnik.onload = () => {
    const img = new Image();
    img.onload = () => {
      try{
        const skala = Math.min(1, maxSzer / img.width);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * skala));
        c.height = Math.max(1, Math.round(img.height * skala));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const png = plik.type === "image/png" && plik.size < 300_000;   // małe PNG (logo) bez utraty przezroczystości
        let dataUrl = png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82);
        if(dataUrl.length > 900_000) dataUrl = c.toDataURL("image/jpeg", 0.6);
        if(dataUrl.length > 1_200_000){ toast("⚠️ Obrazek za duży nawet po kompresji — wybierz mniejszy"); return; }
        poWgraniu(dataUrl);
      }catch(b){ loguj("blad","Kompresja obrazka nie powiodła się: "+b.message); toast("⚠️ Nie udało się przetworzyć obrazka"); }
    };
    img.onerror = () => { toast("⚠️ Nie udało się odczytać obrazka"); loguj("ostrzezenie","Błąd odczytu wgrywanego obrazka"); };
    img.src = czytnik.result;
  };
  czytnik.readAsDataURL(plik);
}
function polePlikuHTML(onchange, etykieta){
  return `<label class="btn ghost" style="cursor:pointer;white-space:nowrap">📁 ${etykieta||"Wgraj z dysku"}<input type="file" accept="image/*" style="display:none" onchange="${onchange}"></label>`;
}
/* banery */
function wgrajObrazBanera(input, id){
  wgrajObrazek(input, 1200, url => {
    zapiszCzescUstawien({bannery: pobierzBannery().map(x=>x.id===id?{...x, obraz:url}:x)});
    loguj("info","Wgrano obrazek banera "+id);
  });
}
function usunObrazBanera(id){
  zapiszCzescUstawien({bannery: pobierzBannery().map(x=>{ const {obraz, ...reszta}=x; return x.id===id?reszta:x; })});
}
/* logo sklepu */
function wgrajLogo(input){ wgrajObrazek(input, 420, url => zapiszCzescUstawien({logoObraz:url})); }
function usunLogo(){ zapiszCzescUstawien({logoObraz:null}); }
/* miniaturka karty przeglądarki */
function wgrajFavicon(input){ wgrajObrazek(input, 96, url => zapiszCzescUstawien({faviconObraz:url})); }
function usunFavicon(){ zapiszCzescUstawien({faviconObraz:null}); }
/* tło baneru głównego */
function wgrajTloHero(input){ wgrajObrazek(input, 1600, url => zapiszCzescUstawien({hero:{...(ustawienia.hero||{}), obraz:url}})); }
function usunTloHero(){ const {obraz, ...h}=(ustawienia.hero||{}); zapiszCzescUstawien({hero:h}); }
/* zdjęcie produktu (wpisuje się do pola formularza) */
function wgrajZdjecieProduktu(input){
  wgrajObrazek(input, 900, url => {
    const form = input.closest ? input.closest("form") : input.form;
    const pole = form && form.zdjecie;
    if(pole) pole.value = url;
    const pg = $("podgladZdjecia");
    if(pg) pg.innerHTML = `<img src="${url}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">`;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj, aby zachować ✅");
  });
}

/* ── Wiele banerów ── */
function widokAdminBannery(){
  const bannery=pobierzBannery();
  return personalizacjaSzkielet("bannery",`
  <div class="panel">
    <h1>🖼️ Zarządzanie banerami</h1>
    <p style="font-size:.86rem;color:var(--muted2)">Banery pojawiają się pod głównym banerem strony. Możesz je dodawać, edytować, wyłączać, usuwać i zmieniać kolejność.</p>
    <form onsubmit="dodajBaner(event)" class="admin-banner">
      <div class="admin-banner-head"><b>➕ Nowy baner</b><span class="lvl lvl-info">${bannery.length}/8</span></div>
      <div class="f-row">
        <div class="f-group"><label>Tytuł</label><input required name="tytul" placeholder="Np. Wakacyjna promocja"></div>
        <div class="f-group"><label>Ikona</label><input name="ikona" value="📣" maxlength="8"></div>
      </div>
      <div class="f-group"><label>Opis</label><input name="opis" placeholder="Krótki opis banera"></div>
      <div class="f-row">
        <div class="f-group"><label>Tekst przycisku</label><input name="przycisk" value="Dowiedz się więcej"></div>
        <div class="f-group"><label>Link</label><input name="link" value="#/promocje" placeholder="#/promocje lub https://…"></div>
      </div>
      <button class="btn" type="submit" ${bannery.length>=8?"disabled":""}>➕ Dodaj baner</button>
    </form>
  </div>
  <div class="panel">
    <div class="admin-banner-head"><h2 style="margin:0">Aktywne i zapisane banery</h2><div><button class="btn ghost" onclick="eksportujIndexHTML()">⬇️ Publiczny index.html</button><button class="btn ghost" onclick="resetujBannery()">↩️ Domyślne</button></div></div>
    ${bannery.length?bannery.map((b,i)=>`
      <form class="admin-banner" onsubmit="zapiszBaner(event,'${b.id}')">
        <div class="admin-banner-head">
          <b>${esc(b.ikona||"📣")} Baner ${i+1}</b>
          <div>
            <button class="btn ghost" type="button" onclick="przesunBaner('${b.id}',-1)" ${i===0?"disabled":""}>↑</button>
            <button class="btn ghost" type="button" onclick="przesunBaner('${b.id}',1)" ${i===bannery.length-1?"disabled":""}>↓</button>
          </div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Tytuł</label><input required name="tytul" value="${esc(b.tytul||"")}"></div>
          <div class="f-group"><label>Ikona</label><input name="ikona" value="${esc(b.ikona||"📣")}" maxlength="8"></div>
        </div>
        <div class="f-group"><label>Opis</label><input name="opis" value="${esc(b.opis||"")}"></div>
        <div class="f-row">
          <div class="f-group"><label>Tekst przycisku</label><input name="przycisk" value="${esc(b.przycisk||"")}"></div>
          <div class="f-group"><label>Link</label><input name="link" value="${esc(b.link||"#/")}"></div>
        </div>
        <div class="f-group"><label>Obrazek banera (opcjonalnie — zastępuje ikonę, tekst zostaje)</label>
          <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
            ${b.obraz?`<img src="${b.obraz}" style="width:130px;height:58px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — baner z ikoną</span>`}
            ${polePlikuHTML(`wgrajObrazBanera(this,'${b.id}')`, "Wgraj obrazek")}
            ${b.obraz?`<button class="btn danger" type="button" onclick="usunObrazBanera('${b.id}')">🗑️ Usuń obrazek</button>`:""}
          </div>
        </div>
        <div class="diag-actions">
          <label class="chk-row"><input type="checkbox" name="aktywny" ${b.aktywny===false?"":"checked"}> Widoczny na stronie</label>
          <button class="btn" type="submit">💾 Zapisz</button>
          <button class="btn danger" type="button" onclick="if(confirm('Usunąć ten baner?')) usunBaner('${b.id}')">🗑️ Usuń</button>
        </div>
      </form>`).join(""):`<p>Brak banerów. Dodaj pierwszy powyżej.</p>`}
    <p><a class="btn ghost" href="#/">👁️ Zobacz banery na stronie</a></p>
  </div>`);
}
function daneBanera(f,id){
  return {id,ikona:String(f.get("ikona")||"📣").trim()||"📣",tytul:String(f.get("tytul")||"").trim(),
    opis:String(f.get("opis")||"").trim(),przycisk:String(f.get("przycisk")||"").trim()||"Dowiedz się więcej",
    link:bezpiecznyLink(String(f.get("link")||"#/").trim()),aktywny:!!f.get("aktywny")};
}
function dodajBaner(e){
  e.preventDefault(); const lista=pobierzBannery();
  if(lista.length>=8){toast("Możesz mieć maksymalnie 8 banerów");return;}
  const f=new FormData(e.target), b=daneBanera(f,"b_"+Date.now()); b.aktywny=true;
  zapiszCzescUstawien({bannery:[...lista,b]}); loguj("info","Dodano baner: "+b.tytul);
}
function zapiszBaner(e,id){
  e.preventDefault(); const b=daneBanera(new FormData(e.target),id);
  const stary = pobierzBannery().find(x=>x.id===id);
  if(stary?.obraz) b.obraz = stary.obraz;   // zachowaj wgrany obrazek
  zapiszCzescUstawien({bannery:pobierzBannery().map(x=>x.id===id?b:x)});
  loguj("info","Zapisano baner: "+b.tytul);
}
function usunBaner(id){ zapiszCzescUstawien({bannery:pobierzBannery().filter(x=>x.id!==id)}); loguj("info","Usunięto baner "+id); }
function przesunBaner(id,kierunek){
  const lista=pobierzBannery(), i=lista.findIndex(x=>x.id===id), j=i+kierunek;
  if(i<0||j<0||j>=lista.length)return;
  [lista[i],lista[j]]=[lista[j],lista[i]];
  zapiszCzescUstawien({bannery:lista});
}
function resetujBannery(){ zapiszCzescUstawien({bannery:DOMYSLNE_BANNERY.map(x=>({...x}))}); }

/* ── Układ każdej podstrony ── */
function widokAdminPodstrony(){
  return personalizacjaSzkielet("podstrony",`
  <div class="panel">
    <div class="admin-banner-head"><div><h1>🧱 Układ i nagłówki podstron</h1><p style="font-size:.86rem;color:var(--muted2)">Każda podstrona ma osobny tytuł, opis, szerokość, styl panelu i widoczność.</p></div>
      <div><button class="btn ghost" onclick="eksportujIndexHTML()">⬇️ Publiczny index.html</button><button class="btn ghost" onclick="resetujPodstrony()">↩️ Domyślne</button></div></div>
  </div>
  ${Object.entries(DOMYSLNE_PODSTRONY).map(([id,d])=>{const u=ustawieniaPodstrony(id);return `
    <form class="panel" style="margin-bottom:1rem" onsubmit="zapiszPodstrone(event,'${id}')">
      <div class="admin-banner-head"><h2 style="margin:0">${esc(d.nazwa)}</h2><a href="#/${id==="onas"?"o-nas":id}" class="btn ghost">👁️ Podgląd</a></div>
      <div class="f-group"><label>Tytuł strony</label><input required name="tytul" value="${esc(u.tytul)}"></div>
      <div class="f-group"><label>Opis pod tytułem</label><textarea name="opis" rows="2">${esc(u.opis||"")}</textarea></div>
      <div class="f-row">
        <div class="f-group"><label>Szerokość</label><select name="szerokosc">
          <option value="compact" ${u.szerokosc==="compact"?"selected":""}>Kompaktowa</option>
          <option value="standard" ${u.szerokosc==="standard"?"selected":""}>Standardowa</option>
          <option value="wide" ${u.szerokosc==="wide"?"selected":""}>Szeroka</option>
        </select></div>
        <div class="f-group"><label>Styl zawartości</label><select name="styl">
          <option value="panel" ${u.styl==="panel"?"selected":""}>Panel z cieniem</option>
          <option value="plain" ${u.styl==="plain"?"selected":""}>Prosty panel z ramką</option>
        </select></div>
      </div>
      <h3 class="f-sekcja">🧭 Rozmieszczenie sekcji tej podstrony</h3>
      <div style="display:grid;gap:.4rem;margin-bottom:.8rem">
        ${kolejnoscSekcjiPodstrony(id).map((sid,i)=>{const s=SEKCJE_PODSTRONY[sid], wid=sekcjaPodstronyWidoczna(id,sid);return `
        <div class="uklad-box ${wid?'':'wylaczona'}" style="margin-bottom:0">
          <span class="uklad-nr">${i+1}</span>
          <span style="flex:1"><b>${s.ikona} ${esc(s.nazwa)}</b></span>
          <button class="btn ghost uklad-btn" type="button" ${i===0?"disabled":""} onclick="przesunSekcjePodstrony('${id}','${sid}',-1)">↑</button>
          <button class="btn ghost uklad-btn" type="button" ${i===kolejnoscSekcjiPodstrony(id).length-1?"disabled":""} onclick="przesunSekcjePodstrony('${id}','${sid}',1)">↓</button>
          <button class="btn ghost uklad-btn" type="button" onclick="przelaczSekcjePodstrony('${id}','${sid}')">${wid?"👁️":"🙈"}</button>
        </div>`;}).join("")}
      </div>
      <div class="diag-actions"><label class="chk-row"><input type="checkbox" name="widoczna" ${u.widoczna===false?"":"checked"} ${id==="logowanie"?"disabled":""}> ${id==="logowanie"?"Logowanie zawsze dostępne":"Widoczna dla klientów"}</label><button class="btn" type="submit">💾 Zapisz podstronę</button></div>
    </form>`;}).join("")}`);
}
function zapiszPodstrone(e,id){
  e.preventDefault(); const f=new FormData(e.target);
  const podstrony={...(ustawienia.podstrony||{})};
  const poprzednia=podstrony[id]||{};
  podstrony[id]={...poprzednia,tytul:String(f.get("tytul")).trim(),opis:String(f.get("opis")||"").trim(),
    szerokosc:String(f.get("szerokosc")),styl:String(f.get("styl")),widoczna:id==="logowanie"?true:!!f.get("widoczna")};
  zapiszCzescUstawien({podstrony}); loguj("info","Zapisano układ podstrony "+id);
}
function przesunSekcjePodstrony(id,sekcja,kierunek){
  const podstrony={...(ustawienia.podstrony||{})};
  const u={...ustawieniaPodstrony(id)};
  const k=kolejnoscSekcjiPodstrony(id);
  const i=k.indexOf(sekcja), j=i+kierunek;
  if(i<0||j<0||j>=k.length)return;
  [k[i],k[j]]=[k[j],k[i]];
  podstrony[id]={...u,sekcjeOrder:k};
  zapiszCzescUstawien({podstrony});
}
function przelaczSekcjePodstrony(id,sekcja){
  const podstrony={...(ustawienia.podstrony||{})};
  const u={...ustawieniaPodstrony(id)};
  const uk=new Set(Array.isArray(u.sekcjeUkryte)?u.sekcjeUkryte:[]);
  uk.has(sekcja)?uk.delete(sekcja):uk.add(sekcja);
  podstrony[id]={...u,sekcjeUkryte:[...uk]};
  zapiszCzescUstawien({podstrony});
}
function resetujPodstrony(){ zapiszCzescUstawien({podstrony:{}}); }

/* ── Strony informacyjne (regulamin itd.) ── */
function widokAdminStrony(){
  const t = KONFIG.tresci || {};
  return personalizacjaSzkielet("strony", `
  <div class="panel">
    <h1>📄 Treści prawne</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin-bottom:.8rem">Własna treść zastępuje szablon. Możesz używać HTML (&lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;…). Puste pole = wraca szablon domyślny.</p>
    <form onsubmit="zapiszStrony(event)">
      <div class="f-group"><label>📜 Regulamin (<a href="#/regulamin" target="_self">podgląd</a>)</label><textarea name="regulamin" rows="7" placeholder="Puste = szablon domyślny">${esc(t.regulamin||"")}</textarea></div>
      <div class="f-group"><label>🔒 Polityka prywatności (<a href="#/prywatnosc">podgląd</a>)</label><textarea name="prywatnosc" rows="7" placeholder="Puste = szablon domyślny">${esc(t.prywatnosc||"")}</textarea></div>
      <div class="f-group"><label>↩️ Zwroty i reklamacje (<a href="#/zwroty">podgląd</a>)</label><textarea name="zwroty" rows="5" placeholder="Puste = szablon domyślny">${esc(t.zwroty||"")}</textarea></div>
      <button class="btn" type="submit">💾 Zapisz treści</button>
    </form>
  </div>`);
}
function zapiszStrony(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const tresci = {};
  for(const k of ["regulamin","prywatnosc","zwroty"]){
    const v = String(f.get(k)||"").trim();
    if(v) tresci[k] = v;
  }
  KONFIG.tresci = Object.keys(tresci).length ? tresci : null;
  zapiszCzescUstawien({tresci: KONFIG.tresci});
}

/* ── Eksporty ── */
function widokAdminEksport(){
  const p=podgladImportuProduktow,kopia=wczytajLS("artway_ostatnia_kopia_importu",null);
  return adminSzkielet("/admin/eksport", `
  <div class="panel">
    <h1>⇄ Import i eksport produktów</h1>
    <p style="color:var(--muted2)">Obsługa dużych katalogów JSON, CSV oraz OVF <code>.xls</code> zapisanego jako CSV. Import zawsze zaczyna się od analizy — żadne dane nie zmienią się przed kliknięciem „Wykonaj import”.</p>
    <div class="import-grid">
      <div class="import-box">
        <h2 style="margin-top:0">1. Wczytaj dane</h2>
        <label class="btn" style="cursor:pointer">📁 Wybierz JSON, CSV lub OVF .xls<input type="file" accept=".json,.csv,.xls,.txt,application/json,text/csv,application/vnd.ms-excel" onchange="wczytajPlikImportuProduktow(this)" style="display:none"></label>
        <button class="btn ghost" onclick="pobierzSzablonProduktowCSV()">⬇️ Pobierz szablon CSV</button>
        <button class="btn ghost" onclick="pobierzSzablonProduktowOVF()">⬇️ Szablon OVF .xls</button>
        <p class="pay-note" style="text-align:left">Możesz też wkleić dane z hurtowni lub arkusza:</p>
        <textarea id="importTekstProduktow" placeholder='JSON: [{"nazwa":"Produkt","kategoria":"AGD","cena":99.90}]&#10;&#10;CSV/OVF: GTIN,EXTERNAL_ID,NAME,STOCK,PRICE,MPN,DESCRIPTION,IMAGE1,CATEGORY,BRAND,COLOR,SIZE,MATERIAL'></textarea>
        <button class="btn ghost" style="margin-top:.5rem" onclick="analizujWklejonyImport()">🔎 Analizuj wklejone dane</button>
      </div>
      <div class="import-box">
        <h2 style="margin-top:0">2. Tryb importu</h2>
        <div class="f-group"><label>Sposób zapisu</label><select id="trybImportuProduktow">
          <option value="scal">Dodaj nowe i aktualizuj istniejące</option>
          <option value="zastap">Zastąp cały katalog importowanymi produktami</option>
        </select></div>
        <div class="backend-note"><b>Scalanie:</b> produkt jest rozpoznawany najpierw po EXTERNAL_ID/SKU, a dopiero potem po lokalnym ID. Istniejący zostanie zaktualizowany, a nowy dostanie wolne ID.<br><b>Zastąpienie:</b> obecny katalog zostanie ukryty i zastąpiony importem.</div>
        <p style="font-size:.82rem;color:var(--muted2)">Przed wykonaniem importu tworzona jest automatyczna kopia produktów, stanów magazynowych, kosza i mapowania.</p>
        ${kopia?`<button class="btn danger" onclick="cofnijOstatniImportProduktow()">↩️ Cofnij ostatni import (${new Date(kopia.data).toLocaleString("pl-PL")})</button>`:""}
        ${ostatniRaportImportu?`<div class="sug" style="margin-top:.7rem"><span class="s-ico">✅</span><span><b>Ostatni import zakończony</b><br>Dodano: ${ostatniRaportImportu.dodane} • zaktualizowano: ${ostatniRaportImportu.zaktualizowane} • pominięto: ${ostatniRaportImportu.pominiete}${ostatniRaportImportu.menuZImportu?` • dopisano do menu: ${ostatniRaportImportu.menuZImportu}`:""}</span></div>`:""}
      </div>
    </div>
    ${p?`
    <div class="import-box" style="margin-top:1rem">
      <h2 style="margin-top:0">3. Podgląd importu — ${esc(p.nazwa)} <span class="lvl lvl-info">${esc(p.format)}</span></h2>
      <div class="import-summary">
        <span>Wiersze: ${p.wszystkich}</span><span>Poprawne: ${p.produkty.length}</span><span>Błędy: ${p.bledy.length}</span><span>Ostrzeżenia: ${p.ostrzezenia.length}</span>
      </div>
      ${p.bledy.length?`<div class="import-errors"><b>Pozycje pominięte:</b><br>${p.bledy.slice(0,100).map(esc).join("<br>")}${p.bledy.length>100?`<br>… i ${p.bledy.length-100} kolejnych`:""}</div>`:""}
      ${p.ostrzezenia.length?`<details><summary>Ostrzeżenia (${p.ostrzezenia.length})</summary><div class="import-errors">${p.ostrzezenia.slice(0,100).map(esc).join("<br>")}</div></details>`:""}
      ${p.produkty.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>ID</th><th>Nazwa</th><th>Grupa menu</th><th>Katalog</th><th>Cena</th><th>Stan</th><th>EXTERNAL_ID / SKU</th><th>Zdjęcia</th></tr>
        ${p.produkty.slice(0,20).map(x=>`<tr><td>${x.id??"auto"}</td><td><b>${esc(x.nazwa)}</b></td><td>${esc(x.grupaKategorii||"—")}</td><td>${esc(x.kategoria)}</td><td>${zl(x.cena)}</td><td>${x.stan??"∞"}</td><td>${esc(x.externalId||x.sku||"—")}</td><td>${(x.zdjecie?1:0)+(x.zdjecia?.length||0)}</td></tr>`).join("")}
      </table></div>${p.produkty.length>20?`<p class="pay-note">Podgląd pokazuje pierwsze 20 z ${p.produkty.length} poprawnych produktów.</p>`:""}
      <button class="btn" style="margin-top:.7rem" onclick="wykonajImportProduktow()">✅ Wykonaj import ${p.produkty.length} ${p.produkty.length===1?"produktu":"produktów"}</button>`:"<p>Brak poprawnych produktów do importu.</p>"}
    </div>`:""}
  </div>
  <div class="panel">
    <h1>📤 Eksport produktów</h1>
    <div class="f-row" style="align-items:end">
      <div class="f-group"><label>Zakres</label><select id="zakresEksportuProduktow" onchange="$('kategoriaEksportuBox').style.display=this.value==='kategoria'?'':'none'">
        <option value="widoczne">Cały aktywny katalog — gotowy na hosting (${produkty.length})</option>
        <option value="zaznaczone">Tylko zaznaczone produkty (${zaznaczoneProdukty.size})</option>
        <option value="kategoria">Wybrana kategoria</option>
      </select></div>
      <div class="f-group" id="kategoriaEksportuBox" style="display:none"><label>Kategoria</label><select id="kategoriaEksportuProduktow">${wszystkieKategorie().map(k=>`<option>${esc(k)}</option>`).join("")}</select></div>
    </div>
    <div class="diag-actions">
      <button class="btn" onclick="eksportujProduktyJSON()">📤 products.json na hosting</button>
      <button class="btn ghost" onclick="eksportujProduktyCSV()">📊 Pełny CSV do Excela</button>
      <button class="btn ghost" onclick="eksportujProduktyOVF()">📄 OVF .xls jak szablon</button>
      <button class="btn ghost" onclick="pobierzSzablonProduktowCSV()">📄 Szablon CSV</button>
      <button class="btn ghost" onclick="pobierzSzablonProduktowOVF()">📄 Szablon OVF .xls</button>
    </div>
    <p class="pay-note" style="text-align:left">Eksport zawiera: ID, nazwę, kategorię, ceny, stan, SKU, GTIN/EAN, EXTERNAL_ID, MPN, markę, opis, etykietę, ikonę, zdjęcie główne, galerię do 16 zdjęć, warianty, kolor karty, kolor produktu, rozmiar i materiał. Produkty z kosza nie trafiają do pliku na hosting.</p>
  </div>
  <div class="panel">
    <h1>📦 Pozostałe eksporty i kopie</h1>
    <div class="sug"><span class="s-ico">🌍</span><span><b>Publiczny index.html</b> — po rozbiciu projektu jest lekkim szkieletem strony i zawiera zapisane ustawienia publiczne. Kod działania sklepu jest w <code>assets/app.js</code>, a wygląd w <code>assets/styles.css</code>.<br>
      <button class="btn" style="margin-top:.4rem" onclick="eksportujIndexHTML()">Pobierz index.html z ustawieniami</button></span></div>
    <div class="sug"><span class="s-ico">📦</span><span><b>Zamówienia (CSV)</b> — wszystkie zamówienia do Excela: numery, statusy, kwoty, adresy.<br><button class="btn ghost" style="margin-top:.4rem" onclick="eksportujZamowienia()">Pobierz zamowienia.csv</button></span></div>
    <div class="sug"><span class="s-ico">👥</span><span><b>Klienci (CSV)</b> — lista zarejestrowanych kont.<br><button class="btn ghost" style="margin-top:.4rem" onclick="eksportujKlientow()">Pobierz klienci.csv</button></span></div>
    <div class="sug"><span class="s-ico">🛠️</span><span><b>Dziennik zdarzeń</b> — log błędów i zdarzeń; raport możesz wkleić w rozmowie z Claude.<br>
      <button class="btn ghost" style="margin-top:.4rem" onclick="pobierzPlikLogu()">Pobierz log (.txt)</button>
      <button class="btn ghost" style="margin-top:.4rem" onclick="kopiujRaport()">📋 Kopiuj raport dla Claude</button></span></div>
    <div class="sug"><span class="s-ico">💾</span><span><b>Pełna kopia panelu</b> — ustawienia, banery, układy podstron, produkty lokalne, klienci i zamówienia z tej przeglądarki.<br>
      <button class="btn ghost" style="margin-top:.4rem" onclick="eksportujKopieDanych()">Pobierz kopię JSON</button>
      <a class="btn ghost" style="margin-top:.4rem" href="#/diagnostyka">Przywracanie i kontrola →</a></span></div>
  </div>`);
}
let stanAktualizacji={sprawdzono:false,ladowanie:false,online:false,authenticated:false,enabled:false,publisher:null,error:""};
let wybranyIndexAktualizacji=null;
function formatRozmiaruPliku(n){
  n=Number(n)||0;return n>=1048576?(n/1048576).toFixed(2)+" MB":n>=1024?(n/1024).toFixed(1)+" KB":n+" B";
}
function wersjaZIndexu(html){
  return String(html||"").match(/<meta\s+name=["']artway-version["']\s+content=["']([^"']+)/i)?.[1]||"brak numeru";
}
async function sprawdzStatusAktualizacji(cicho=false){
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};if(!cicho)renderuj();
  try{
    const health=await wywolajBramke("health");
    stanAktualizacji={...stanAktualizacji,sprawdzono:true,ladowanie:false,online:true,authenticated:!!health.authenticated,enabled:!!health.publisher?.enabled,error:""};
    if(health.authenticated){
      const d=await wywolajBramke("site-status");
      stanAktualizacji={...stanAktualizacji,authenticated:true,enabled:!!d.publisher?.enabled,publisher:d.publisher||null};
    }
    if(!cicho)toast(health.authenticated?"Status aktualizacji pobrany ✅":"Backend działa — połącz bezpieczną sesję");
  }catch(e){
    stanAktualizacji={...stanAktualizacji,sprawdzono:true,ladowanie:false,online:false,error:e.message};
    if(!cicho)toast("Nie udało się sprawdzić aktualizacji");
  }
  if(trasa()==="/admin/aktualizacja")renderuj();
}
async function polaczAktualizacje(e){
  e.preventDefault();const f=new FormData(e.target);
  try{
    await wywolajBramke("login",{method:"POST",body:{password:String(f.get("apiPassword")||"")}});
    f.set("apiPassword","");await sprawdzStatusAktualizacji(true);toast("Bezpieczna sesja aktualizacji połączona ✅");
  }catch(bl){stanAktualizacji={...stanAktualizacji,error:bl.message};toast("Nie udało się połączyć");renderuj();}
}
function wczytajIndexDoAktualizacji(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>6*1024*1024){toast("⚠️ index.html może mieć maksymalnie 6 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>{
    try{
      const html=String(r.result||"");
      if(html.length<1000||!/<html/i.test(html)||!/<script/i.test(html)||!html.includes("PUBLIC_SETTINGS_START")||!html.includes("assets/app.js")||!html.includes("assets/styles.css"))throw new Error("To nie jest poprawny plik index.html Artway-TM po rozbiciu na pliki");
      wybranyIndexAktualizacji={nazwa:plik.name,rozmiar:plik.size,wersja:wersjaZIndexu(html),html};
      toast("Nowy index.html sprawdzony ✅");renderuj();
    }catch(e){wybranyIndexAktualizacji=null;toast("⚠️ "+e.message);renderuj();}
  };
  r.onerror=()=>toast("⚠️ Nie udało się odczytać index.html");
  r.readAsText(plik,"UTF-8");
}
function usunWybranyIndexAktualizacji(){wybranyIndexAktualizacji=null;renderuj();}
async function publikujAktualizacjeStrony(e){
  e.preventDefault();const f=new FormData(e.target),index=!!f.get("index"),produktyPlik=!!f.get("produkty");
  if(!index&&!produktyPlik){toast("Wybierz co najmniej jeden plik do aktualizacji");return;}
  if(!stanAktualizacji.authenticated){toast("Najpierw połącz bezpieczną sesję");return;}
  if(!stanAktualizacji.enabled){toast("Publikator jest wyłączony w config.php");return;}
  const nazwy=[index?"index.html":null,produktyPlik?"products.json":null].filter(Boolean).join(" i ");
  if(!confirm(`Opublikować ${nazwy} na działającej stronie? Poprzednia wersja zostanie automatycznie zapisana jako kopia.`))return;
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};renderuj();
  try{
    const body={note:String(f.get("notatka")||"Aktualizacja z panelu administratora").trim()};
    if(index){
      let html=wybranyIndexAktualizacji?.html;
      if(!html){const r=await fetch("index.html",{cache:"no-store"});if(!r.ok)throw new Error("Nie udało się pobrać bieżącego index.html");html=await r.text();}
      body.index_html=osadzUstawieniaWIndexie(html);
    }
    if(produktyPlik)body.products=zakresEksportuProduktow("widoczne");
    const d=await wywolajBramke("site-publish",{method:"POST",body});
    stanAktualizacji={...stanAktualizacji,ladowanie:false,sprawdzono:true,online:true,authenticated:true,enabled:!!d.publisher?.enabled,publisher:d.publisher||null,error:""};
    if(index)localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    if(produktyPlik){
      const hash=prostyHash(JSON.stringify(body.products));
      localStorage.setItem("artway_produkty_publish_hash",hash);
      localStorage.setItem("artway_produkty_export_hash",hash);
    }
    wybranyIndexAktualizacji=null;
    loguj("info","Opublikowano bezpośrednio na hostingu: "+nazwy);
    toast("Strona została zaktualizowana ✅");renderuj();
  }catch(bl){
    stanAktualizacji={...stanAktualizacji,ladowanie:false,error:bl.message};
    loguj("blad","Aktualizacja strony: "+bl.message);toast("Aktualizacja nie powiodła się");renderuj();
  }
}
async function cofnijPublikacjeStrony(id){
  if(!confirm("Przywrócić tę kopię strony? Obecna wersja również zostanie zabezpieczona przed zmianą."))return;
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};renderuj();
  try{
    const d=await wywolajBramke("site-rollback",{method:"POST",body:{backup_id:id}});
    stanAktualizacji={...stanAktualizacji,ladowanie:false,publisher:d.publisher||null,error:""};
    loguj("info","Przywrócono kopię strony "+id);toast("Poprzednia wersja została przywrócona ↩️");renderuj();
  }catch(bl){stanAktualizacji={...stanAktualizacji,ladowanie:false,error:bl.message};toast("Nie udało się przywrócić kopii");renderuj();}
}
async function kopiujKonfiguracjePublikatora(){
  const tekst=`'publisher' => [\n    'enabled' => true,\n    'root' => dirname(__DIR__),\n    'max_backups' => 10,\n],`;
  try{await navigator.clipboard.writeText(tekst);toast("Konfiguracja skopiowana 📋");}
  catch(e){toast("Skopiuj konfigurację z instrukcji api/config.example.php");}
}
function statusPlikuPublikacji(nazwa,dane){
  if(!dane)return `<div class="info-card"><b>${nazwa}</b><p>brak danych</p></div>`;
  return `<div class="info-card"><b>${nazwa}</b><p>${dane.exists?"✅ istnieje":"❌ brak"} • ${dane.writable?"zapis możliwy":"brak zapisu"}<br>${dane.exists?`${formatRozmiaruPliku(dane.size)} • ${new Date(dane.modified).toLocaleString("pl-PL")}<br><code>${esc(dane.sha256||"")}</code>`:""}</p></div>`;
}
function widokAdminAktualizacja(){
  const s=stanAktualizacji,p=s.publisher||{},last=p.last_publication,backups=p.backups||[];
  return adminSzkielet("/admin/aktualizacja",`
  <div class="panel">
    <div class="admin-banner-head"><div><h1 style="margin:0">⬆️ Aktualizacja strony</h1><p style="color:var(--muted2);margin-top:.35rem">Wersja panelu: <b>${esc(document.querySelector('meta[name="artway-version"]')?.content||"—")}</b> • publikuj ustawienia i produkty; pełne aktualizacje kodu idą przez GitHub/Netlify razem z <code>assets/app.js</code> i <code>assets/styles.css</code>.</p></div>
      <button class="btn ghost" onclick="sprawdzStatusAktualizacji()" ${s.ladowanie?"disabled":""}>${s.ladowanie?"⏳ Sprawdzam…":"🔄 Odśwież status"}</button></div>
    <div class="import-summary">
      <span>${s.online?"✅ Backend online":"⚠️ Backend niesprawdzony"}</span>
      <span>${s.authenticated?"🔐 Sesja połączona":"🔒 Wymaga połączenia"}</span>
      <span>${s.enabled?"✅ Publikator włączony":"⚠️ Publikator wyłączony"}</span>
    </div>
    ${s.error?`<div class="backend-note" style="border-color:var(--danger)"><b>Błąd:</b> ${esc(s.error)}</div>`:""}
    ${s.online&&!s.authenticated?`<form onsubmit="polaczAktualizacje(event)" style="max-width:620px"><div class="f-row" style="grid-template-columns:1fr auto;align-items:end"><div class="f-group"><label>Hasło integracji z api/config.php</label><input type="password" name="apiPassword" required autocomplete="current-password"></div><div class="f-group"><button class="btn" type="submit">🔐 Połącz sesję</button></div></div></form>`:""}
    ${s.sprawdzono&&!s.enabled?`<div class="backend-note"><b>Jednorazowa konfiguracja:</b> dodaj sekcję <code>publisher</code> z pliku <code>api/config.example.php</code> do chronionego <code>api/config.php</code>. Pierwsze wgranie tej wersji API nadal wykonujesz przez SFTP; następne aktualizacje zrobisz tutaj.<br><button class="btn ghost" style="margin-top:.5rem" onclick="kopiujKonfiguracjePublikatora()">📋 Kopiuj sekcję konfiguracji</button></div>`:""}
    ${p.files?`<div class="info-grid">${statusPlikuPublikacji("index.html",p.files["index.html"])}${statusPlikuPublikacji("products.json",p.files["products.json"])}</div>`:""}
    ${last?`<div class="sug" style="margin-top:.8rem"><span class="s-ico">✅</span><span><b>Ostatnia aktualizacja: ${new Date(last.published_at).toLocaleString("pl-PL")}</b><br>Pliki: ${(last.files||[]).map(esc).join(", ")}${last.note?` • ${esc(last.note)}`:""}${last.restored_from?` • przywrócono z ${esc(last.restored_from)}`:""}</span></div>`:""}
  </div>
  <div class="panel">
    <h2 style="margin-top:0">Publikuj bieżące zmiany</h2>
    <form onsubmit="publikujAktualizacjeStrony(event)">
      <label class="chk-row"><input type="checkbox" name="index" checked> <span><b>index.html</b> — lekki szkielet strony i publiczne ustawienia panelu</span></label>
      <label class="chk-row"><input type="checkbox" name="produkty" checked> <span><b>products.json</b> — ${produkty.length} aktywnych produktów, ceny, stany, zdjęcia i warianty</span></label>
      <div class="f-group" style="margin-top:.7rem"><label>Notatka do aktualizacji</label><input name="notatka" maxlength="200" value="Aktualizacja z panelu administratora"></div>
      <div class="diag-actions"><button class="btn" type="submit" ${!s.authenticated||!s.enabled||s.ladowanie?"disabled":""}>${s.ladowanie?"⏳ Aktualizacja…":"⬆️ Publikuj na stronie"}</button></div>
    </form>
    <div class="backend-note" style="margin-top:1rem"><b>Co zostanie opublikowane?</b> Jeśli nie wybierzesz nowego pliku poniżej, panel użyje bieżącego index.html i automatycznie osadzi w nim aktualne ustawienia. Po rozbiciu kodu techniczne zmiany w JavaScript/CSS wdrażamy przez GitHub/Netlify, żeby nie pominąć żadnego pliku. Zawsze powstaje kopia poprzedniej wersji.</div>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">Wgraj nową wersję index.html</h2>
    <p style="color:var(--muted2)">Ten plik jest teraz szkieletem strony. Pełna aktualizacja techniczna wymaga też plików <code>assets/app.js</code> i <code>assets/styles.css</code>, dlatego standardowo wdrażamy ją przez GitHub/Netlify.</p>
    <label class="btn ghost" style="cursor:pointer">📁 Wybierz nowy index.html<input type="file" accept=".html,text/html" onchange="wczytajIndexDoAktualizacji(this)" style="display:none"></label>
    ${wybranyIndexAktualizacji?`<div class="sug" style="margin-top:.7rem"><span class="s-ico">📄</span><span><b>${esc(wybranyIndexAktualizacji.nazwa)}</b><br>Wersja ${esc(wybranyIndexAktualizacji.wersja)} • ${formatRozmiaruPliku(wybranyIndexAktualizacji.rozmiar)} <button class="btn danger" style="margin-left:.5rem" onclick="usunWybranyIndexAktualizacji()">Usuń wybór</button></span></div>`:""}
  </div>
  <div class="panel">
    <h2 style="margin-top:0">Kopie i przywracanie</h2>
    ${backups.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>Data</th><th>Powód</th><th>Pliki</th><th>Akcja</th></tr>${backups.slice(0,10).map(b=>`<tr><td>${b.created?new Date(b.created).toLocaleString("pl-PL"):esc(b.id)}</td><td>${b.reason==="before-rollback"?"Przed przywróceniem":"Przed publikacją"}</td><td>${(b.files||[]).map(esc).join(", ")}</td><td><button class="btn ghost" onclick="cofnijPublikacjeStrony('${esc(b.id)}')" ${s.ladowanie?"disabled":""}>↩️ Przywróć</button></td></tr>`).join("")}</table></div>`:`<p style="color:var(--muted2)">Kopie pojawią się automatycznie po pierwszej publikacji.</p>`}
  </div>`);
}
function resetujUstawienia(){
  localStorage.removeItem("artway_ustawienia");
  loguj("info","Przywrócono domyślne ustawienia");
  location.reload();
}

/* ── Publikacja strony ── */
function kontrolePublikacji(){
  const k = [];
  k.push({ok:!domyslneHasloAdmina, tekst:"Hasło administratora zmienione z domyślnego (admin)", link:"#/konto", akcja:"Zmień hasło"});
  k.push({ok:!KONFIG.telefon.includes("000 000 000"), tekst:"Prawdziwy numer telefonu w stopce i kontakcie", link:"#/admin/wyglad", akcja:"Ustaw telefon"});
  k.push({ok:!widokRegulamin().includes("[nazwa firmy"), tekst:"Regulamin i polityka prywatności z danymi firmy", link:"#/admin/strony", akcja:"Uzupełnij"});
  k.push({ok:dostepnePlatnosci().length>0, tekst:"Co najmniej jedna forma płatności włączona ("+dostepnePlatnosci().map(p=>p.id).join(", ")+")", link:"#/admin/dostawy", akcja:"Ustaw płatności"});
  k.push({ok:produkty.length>0, tekst:"Produkty w sklepie ("+produkty.length+")", link:"#/admin/produkty", akcja:"Dodaj produkty"});
  const lokalneUstawienia=wczytajLS("artway_ustawienia",{}), kluczeUstawien=Object.keys(lokalneUstawienia).filter(x=>x!=="krokiPublikacji");
  const ustawieniaWyeksportowane=!kluczeUstawien.length||localStorage.getItem("artway_ustawienia_export_hash")===prostyHash(JSON.stringify(ustawienia));
  k.push({ok:ustawieniaWyeksportowane,tekst:ustawieniaWyeksportowane
    ?"Układ i ustawienia są przygotowane do publikacji"
    :`Masz zmiany panelu (${kluczeUstawien.length} sekcji) — opublikuj index.html bezpośrednio z panelu`,link:"#/admin/aktualizacja",akcja:"Aktualizuj stronę"});
  const zmianyLokalne = produktyDodane.length + produktyUkryte.length + Object.keys(produktyEdytowane).length
    + Object.keys(ustawienia.mapaProduktow||{}).length + Object.keys(ustawienia.kategorie||{}).length
    + (ustawienia.menuKategorii||[]).length + (ustawienia.menuPokazNieprzypisane===false?1:0);
  const aktualnyHashProduktow=prostyHash(JSON.stringify(zakresEksportuProduktow("widoczne")));
  const produktyPrzygotowane=!zmianyLokalne||localStorage.getItem("artway_produkty_export_hash")===aktualnyHashProduktow;
  k.push({ok:produktyPrzygotowane, tekst: produktyPrzygotowane
    ? "Produkty są przygotowane do publikacji"
    : "Masz lokalne zmiany produktów/katalogów ("+zmianyLokalne+") — opublikuj products.json bezpośrednio z panelu",
    link:"#/admin/aktualizacja", akcja:"Aktualizuj stronę"});
  return k;
}
const KROKI_PUBLIKACJI = [
  "Zalogowałem się do CloudHosting Panel nazwa.pl",
  "Wgrałem index.html, products.json i cały katalog api przez SFTP",
  "Ustawiłem zmienne Netlify dla SMTP, Paynow i InPost ShipX",
  "Skierowałem domenę na katalog z plikami strony",
  "Otworzyłem stronę pod własną domeną i wszystko działa",
  "Sprawdziłem stronę na telefonie",
  "Złożyłem testowe zamówienie i wysłałem jego potwierdzenie"
];
function przelaczKrok(i){
  const kroki = {...(ustawienia.krokiPublikacji||{})};
  kroki[i] = !kroki[i];
  zapiszCzescUstawien({krokiPublikacji: kroki});
}
function widokAdminPublikacja(){
  const kontrole = kontrolePublikacji();
  const gotowe = kontrole.filter(x=>x.ok).length;
  const kroki = ustawienia.krokiPublikacji || {};
  return adminSzkielet("/admin/publikacja", `
  <div class="panel">
    <h1>🌍 Publikacja strony</h1>
    <h2>Gotowość do startu: ${gotowe}/${kontrole.length} ${gotowe===kontrole.length?"— można publikować! 🎉":""}</h2>
    ${kontrole.map(x=>`<div class="sug" style="${x.ok?'':'background:#fef3c7'}">
      <span class="s-ico">${x.ok?"✅":"⚠️"}</span>
      <span>${x.tekst}${x.ok?"":` — <a href="${x.link}">${x.akcja} →</a>`}</span></div>`).join("")}
  </div>
  <div class="panel">
    <h2 style="margin-top:0">📁 Co wgrywasz na serwer</h2>
    <p style="font-size:.9rem;color:var(--muted2)">Przy pierwszym uruchomieniu na hostingu statycznym wgraj <b>index.html</b>, <b>products.json</b> oraz katalog <b>api</b>, jeżeli korzystasz z awaryjnego PHP. Aktualna, profesjonalna wersja sklepu używa jednak <b>Netlify Functions</b> do wspólnej bazy, e-maili, Paynow i InPost.</p>
    <div class="backend-note"><b>Ważne:</b> GitHub/Netlify są obecnie główną ścieżką publikacji. SFTP/nazwa.pl traktuj jako hosting plików lub plan awaryjny; sekrety InPost i płatności pozostają w zmiennych Netlify, nie w public_html.</div>
    <h2>Publikacja na nazwa.pl</h2>
    <details open style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">1. Połącz się bezpiecznie przez SFTP</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>Zaloguj się na <b>admin.nazwa.pl</b> identyfikatorem serwera (np. server123456)</li>
        <li>W CloudHosting Panel wybierz <b>WWW I FTP → Wykaz kont FTP</b></li>
        <li>Do połączenia SFTP użyj hosta <b>identyfikatorserwera.nazwa.pl</b> i portu <b>22</b></li>
        <li>Login i hasło są takie jak do CloudHosting Panel albo jak w utworzonym dodatkowym koncie FTP</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">2. Wgraj gotową paczkę</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>Otwórz katalog docelowy domeny. Jeśli domena wskazuje na <b>public_html</b>, wejdź do public_html</li>
        <li>Jeżeli public_html nie istnieje, wybierz katalog wskazany dla domeny w CloudHosting Panel</li>
        <li>Wgraj tam całą zawartość folderu <b>artway-tm-nazwa-pl</b>: index.html, products.json i katalog api</li>
        <li>Nazwy plików pozostaw bez zmian; nie umieszczaj ich w dodatkowym zagnieżdżonym folderze</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">3. Skonfiguruj adapter InPost</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>W Parcel Manager InPost wygeneruj token API ShipX oraz publiczny token Geowidget</li>
        <li>W Netlify ustaw: <b>INPOST_TOKEN</b>, <b>INPOST_ORG_ID</b>, opcjonalnie <b>INPOST_GEOWIDGET_TOKEN</b></li>
        <li>Dla testów ustaw <b>INPOST_ENV=sandbox</b>; po testach zmień na <b>production</b></li>
        <li>W panelu sklepu otwórz Centrum wysyłek → Bramka i ustawienia → Test API InPost</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">4. Skieruj domenę na katalog strony</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>W Panelu Klienta nazwa.pl przejdź do <b>Usługi → Domeny → konfiguruj</b></li>
        <li>Przekieruj domenę na zakupiony CloudHosting</li>
        <li>W CloudHosting Panel wskaż katalog, do którego zostały wgrane pliki</li>
        <li>Po propagacji domeny otwórz stronę i wykonaj test na komputerze oraz telefonie</li>
      </ol></details>
    <h2>✅ Lista startowa</h2>
    ${KROKI_PUBLIKACJI.map((k,i)=>`<label class="chk-row"><input type="checkbox" ${kroki[i]?"checked":""} onchange="przelaczKrok(${i})"> ${k}</label>`).join("")}
    <p class="pay-note" style="text-align:left;margin-top:.8rem">Pamiętaj: zamówienia, klienci i ustawienia synchronizują się przez wspólną bazę Netlify. Gdy Netlify jest niedostępne, sklep zachowuje lokalną kopię i ponowi synchronizację po odzyskaniu połączenia.</p>
  </div>`);
}

/* ═══════════ WIDOK: DIAGNOSTYKA (tylko administrator) ═══════════
   Dostęp mają konta z rolą administratora. Zwykli klienci nie
   widzą linku w stopce ani samej strony.                         */
function widokBrakDostepu(){
  return `<div class="page"><div class="panel auth-box" style="text-align:center">
    <h1>🔒 Strefa właściciela</h1>
    <p>Ta strona jest dostępna tylko dla administratora sklepu.</p>
    <p style="margin-top:1rem">${sesja?`<a href="#/">← Wróć do sklepu</a>`:`<a class="btn" href="#/logowanie">Zaloguj się</a>`}</p>
  </div></div>`;
}
let filtrLogowDiag="wszystkie", szukajLogowDiag="", ostatniAutotest=[], diagSearchT;
function rozmiarDanychLokalnych(){
  let n=0;
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=(k?.length||0)+(localStorage.getItem(k)?.length||0);}}catch(e){}
  return n*2;
}
function testyDiagnostyczne(){
  const t=[], dodaj=(grupa,nazwa,status,szczegoly)=>t.push({grupa,nazwa,status,szczegoly});
  const zamowieniaDiag=pobierzZamowienia();
  const kontaDiag=pobierzUzytkownikow(), administratorzyDiag=kontaDiag.filter(u=>kontoMaRoleAdmin(u.email));
  const ids=produkty.map(p=>p.id), unikalne=new Set(ids), wszystkieAdmin=produktyDoAdministracji(), adminIds=new Set(wszystkieAdmin.map(p=>p.id));
  const mapa=ustawienia.mapaProduktow||{}, osieroconeMap=Object.keys(mapa).filter(id=>!adminIds.has(+id));
  const osieroconyKoszyk=koszyk.filter(x=>!ids.includes(x.id)), osieroconeUlub=ulubione.filter(id=>!ids.includes(id));
  const bezZdjec=produkty.filter(p=>!p.zdjecie).length, bledneProdukty=produkty.filter(p=>!p.nazwa||!p.kategoria||!(p.cena>0));
  const idsKosza=[...koszDodanych.map(p=>p.id),...bazoweProduktyWKoszu().map(p=>p.id)];
  const brakMetaKosza=idsKosza.filter(id=>!koszMeta[id]), wygasleKosza=idsKosza.filter(id=>Date.now()-Number(koszMeta[id]?.usunietoAt||Date.now())>=OKRES_KOSZA_MS);
  const pamiec=rozmiarDanychLokalnych(), zmiany=produktyDodane.length+produktyUkryte.length+produktyDefinitywne.length+Object.keys(produktyEdytowane).length+Object.keys(mapa).length;
  dodaj("Produkty","Produkty są wczytane",produkty.length?"ok":"bad",`${produkty.length} widocznych produktów`);
  dodaj("Produkty","Unikalne identyfikatory produktów",unikalne.size===ids.length?"ok":"bad",unikalne.size===ids.length?"Brak duplikatów ID":`${ids.length-unikalne.size} zduplikowanych ID`);
  dodaj("Produkty","Poprawne dane i ceny",bledneProdukty.length?"bad":"ok",bledneProdukty.length?`${bledneProdukty.length} produktów wymaga poprawy`:"Nazwy, katalogi i ceny są poprawne");
  dodaj("Produkty","Zdjęcia produktów",bezZdjec?"warn":"ok",bezZdjec?`${bezZdjec} produktów korzysta z ikon zamiast zdjęć`:"Wszystkie produkty mają zdjęcia");
  dodaj("Produkty","Kosz produktów na 30 dni",brakMetaKosza.length||wygasleKosza.length?"warn":"ok",brakMetaKosza.length?`${brakMetaKosza.length} pozycji nie ma daty usunięcia`:wygasleKosza.length?`${wygasleKosza.length} pozycji czeka na automatyczne czyszczenie`:`${idsKosza.length} pozycji w koszu; metadane retencji są spójne`);
  dodaj("Produkty","Stronicowanie dużego katalogu",[12,24,48,96].includes(produktyNaStronie)&&[25,50,100,200].includes(produktyNaStronieAdmin)?"ok":"warn",`Sklep: ${produktyNaStronie} / strona • panel: ${produktyNaStronieAdmin} / strona`);
  dodaj("Produkty","Schemat importu i eksportu",POLA_CSV_PRODUKTU.length>=16?"ok":"warn",`${POLA_CSV_PRODUKTU.length} obsługiwanych kolumn • JSON i CSV • kopia przed importem`);
  dodaj("Dane","Spójność koszyka",osieroconyKoszyk.length?"warn":"ok",osieroconyKoszyk.length?`${osieroconyKoszyk.length} nieistniejących pozycji`:"Brak osieroconych pozycji");
  dodaj("Dane","Spójność ulubionych",osieroconeUlub.length?"warn":"ok",osieroconeUlub.length?`${osieroconeUlub.length} nieistniejących produktów`:"Lista jest spójna");
  dodaj("Dane","Spójność mapowania",osieroconeMap.length?"warn":"ok",osieroconeMap.length?`${osieroconeMap.length} osieroconych mapowań`:"Wszystkie mapowania wskazują produkty");
  dodaj("Konfiguracja","Metoda dostawy",KONFIG.dostawy.length?"ok":"bad",`${KONFIG.dostawy.length} dostępnych metod`);
  dodaj("Konfiguracja","Metoda płatności",dostepnePlatnosci().length?"ok":"bad",`${dostepnePlatnosci().length} aktywnych metod`);
  const niepelneDaneWysylki=zamowieniaDiag.filter(z=>!z.klient?.telefon||!z.adresDostawy?.kod).length;
  const bezNumeru=zamowieniaDiag.filter(z=>!["anulowane","zakończone","dostarczone"].includes(z.status)&&!z.wysylka?.numer).length;
  const wyjatkiWysylki=zamowieniaDiag.filter(z=>etapWysylki(z)==="problem").length, uwDiag=ustawieniaWysylki();
  dodaj("Wysyłki","Dane odbiorców",niepelneDaneWysylki?"warn":"ok",niepelneDaneWysylki?`${niepelneDaneWysylki} starszych zamówień nie ma pełnego telefonu lub adresu`:"Dane nowych zamówień są gotowe do API InPost");
  dodaj("Wysyłki","Numery nadania",bezNumeru?"warn":"ok",bezNumeru?`${bezNumeru} aktywnych zamówień czeka na numer nadania`:"Wszystkie aktywne przesyłki mają numer");
  dodaj("Wysyłki","Kolejka wyjątków",wyjatkiWysylki?"bad":"ok",wyjatkiWysylki?`${wyjatkiWysylki} przesyłek wymaga reakcji operatora`:"Brak nierozwiązanych wyjątków");
  dodaj("Wysyłki","Reguły automatycznego wyboru",uwDiag.regulaPaczkomat==="inpost"?"ok":"bad",`Aktywne metody: InPost Paczkomat i Kurier InPost`);
  const poprawnyEndpoint=String(uwDiag.apiEndpoint||"").startsWith("/")||String(uwDiag.apiEndpoint||"").startsWith("https://")||String(uwDiag.apiEndpoint||"").startsWith("http://");
  dodaj("Integracje","Uniwersalna bramka",stanBramki.online?"ok":poprawnyEndpoint?"warn":"bad",stanBramki.online?`Netlify Functions dostępne • tryb wysyłek ${uwDiag.tryb}`:`Endpoint awaryjny ${uwDiag.apiEndpoint} • sprawdź Netlify Functions`);
  dodaj("Integracje","Centralna baza zamówień",stanBazyCentralnej.online?"ok":stanBazyCentralnej.sprawdzono?"bad":"warn",stanBazyCentralnej.online
    ?`${stanBazyCentralnej.orders} zamówień • ${stanBazyCentralnej.users} klientów • wspólne dla wszystkich urządzeń`
    :stanBazyCentralnej.error||"Połącz backend, aby sprawdzić i zsynchronizować wspólną bazę");
  const ipDiag=stanBramki.inpost||{};
  const avDiag=ipDiag.serviceAvailability||{};
  dodaj("Integracje","InPost ShipX API",ipDiag.configured?((avDiag.locker===false||avDiag.courier===false)?"warn":"ok"):"warn",ipDiag.configured
    ?`Token i Organization ID są ustawione${ipDiag.geowidgetConfigured?" • Geowidget aktywny":" • brakuje tylko Geowidget"}${ipDiag.webhookConfigured?" • webhook aktywny":" • webhook do konfiguracji"}${avDiag.locker===false?" • brak usługi paczkomatowej":""}${avDiag.courier===false?" • kurier InPost nieaktywny":""}`
    :`Brakuje: ${((ipDiag.missingEnv&&ipDiag.missingEnv.length?ipDiag.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", "))}`);
  const emailDiag=!!stanBramki.email?.configured;
  dodaj("Integracje","Automatyczne e-maile",emailDiag&&chmuraToken?"ok":"warn",emailDiag
    ?`${stanBramki.email.provider||"SMTP"} skonfigurowany${chmuraToken?" — wysyłka automatyczna aktywna":" — wpisz hasło bazy do testów i ręcznej wysyłki"}`
    :"Skonfiguruj SMTP/Gmail w zmiennych Netlify");
  dodaj("Konfiguracja","Telefon sklepu",KONFIG.telefon.includes("000 000 000")?"warn":"ok",KONFIG.telefon);
  dodaj("Konfiguracja","Dane prawne",widokRegulamin().includes("[nazwa firmy")?"bad":"ok",widokRegulamin().includes("[nazwa firmy")?"Uzupełnij dane firmy w treściach prawnych":"Brak pól przykładowych");
  dodaj("Bezpieczeństwo","Hasło administratora",domyslneHasloAdmina?"bad":"ok",domyslneHasloAdmina?"Nadal ustawione jest hasło admin":"Hasło zostało zmienione");
  dodaj("Bezpieczeństwo","Role kont administracyjnych",administratorzyDiag.length?"ok":"bad",`${administratorzyDiag.length} kont z rolą administratora • ${kontaDiag.length-administratorzyDiag.length} kont klientów`);
  dodaj("Publikacja","Źródło produktów",zrodloProduktow==="json"?"ok":"warn",zrodloProduktow==="json"?"products.json dostępny":"Używana jest lista zapasowa");
  const hashProduktowDiag=prostyHash(JSON.stringify(zakresEksportuProduktow("widoczne"))),produktyGotoweDiag=!zmiany||localStorage.getItem("artway_produkty_export_hash")===hashProduktowDiag;
  dodaj("Publikacja","Zmiany lokalne",produktyGotoweDiag?"ok":"warn",produktyGotoweDiag?"Produkty są przygotowane do publikacji":`${zmiany} zmian wymaga publikacji products.json`);
  dodaj("Publikacja","Aktualizacja strony bez FTP",!stanAktualizacji.sprawdzono?"warn":stanAktualizacji.online&&stanAktualizacji.enabled?"ok":stanAktualizacji.online?"warn":"bad",!stanAktualizacji.sprawdzono?"Sprawdź status w panelu Aktualizacja strony":stanAktualizacji.online&&stanAktualizacji.enabled?"Publikator backendowy jest dostępny":stanAktualizacji.online?"Backend działa, ale publisher.enabled nie jest włączony":"Backend aktualizacji jest niedostępny");
  dodaj("Pamięć","Wykorzystanie pamięci",pamiec>4_000_000?"bad":pamiec>2_500_000?"warn":"ok",`${(pamiec/1024).toFixed(1)} KB zapisanych danych`);
  const zleBannery=pobierzBannery().filter(b=>!b.tytul||bezpiecznyLink(b.link)==="#/"&&b.link!=="#/");
  dodaj("Wygląd","Konfiguracja banerów",zleBannery.length?"warn":"ok",zleBannery.length?`${zleBannery.length} banerów wymaga sprawdzenia`:`${pobierzBannery().length} poprawnych banerów`);
  return [...t,...ostatniAutotest];
}
function wynikKondycji(testy=testyDiagnostyczne()){
  const bad=testy.filter(x=>x.status==="bad").length, warn=testy.filter(x=>x.status==="warn").length;
  return Math.max(0,Math.min(100,100-bad*12-warn*4));
}
function generujSugestie(){
  const problemy=testyDiagnostyczne().filter(x=>x.status!=="ok");
  if(!problemy.length)return [{ico:"✅",tekst:"Wszystkie kontrole zakończone poprawnie."}];
  return problemy.slice(0,8).map(x=>({ico:x.status==="bad"?"❌":"⚠️",tekst:`${x.nazwa}: ${x.szczegoly}`}));
}
function widokDiagnostyka(){
  const wszystkieLogi=pobierzLogi(), testy=testyDiagnostyczne(), wynik=wynikKondycji(testy), pamiec=rozmiarDanychLokalnych();
  let logi=wszystkieLogi;
  if(filtrLogowDiag!=="wszystkie")logi=logi.filter(l=>l.poziom===filtrLogowDiag);
  if(szukajLogowDiag)logi=logi.filter(l=>(l.tresc+" "+l.zrodlo).toLowerCase().includes(szukajLogowDiag));
  const nazwaPoziomu={blad:"BŁĄD",ostrzezenie:"UWAGA",info:"INFO"};
  const grupy=[...new Set(testy.map(x=>x.grupa))];
  return `
  <div class="page page-wide">
    <div class="panel" style="margin-bottom:1rem">
      <h1>🛠️ Centrum diagnostyczne</h1>
      <div class="health-card">
        <div class="health-score">${wynik}%</div>
        <div><h2 style="margin:0">Kondycja sklepu: ${wynik>=90?"bardzo dobra":wynik>=70?"dobra":wynik>=50?"wymaga uwagi":"wymaga naprawy"}</h2>
          <p>${testy.filter(x=>x.status==="ok").length} testów poprawnych • ${testy.filter(x=>x.status==="warn").length} ostrzeżeń • ${testy.filter(x=>x.status==="bad").length} błędów</p>
          <div class="health-bar"><span style="width:${wynik}%"></span></div>
        </div>
      </div>
      <div class="diag-grid">
        <div class="diag-card"><b>${produkty.length}</b><small>produktów • ${zrodloProduktow}</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().length}</b><small>zamówień</small></div>
        <div class="diag-card"><b>${pobierzUzytkownikow().filter(u=>!kontoMaRoleAdmin(u.email)).length}</b><small>kont klientów</small></div>
        <div class="diag-card"><b>${pobierzUzytkownikow().filter(u=>kontoMaRoleAdmin(u.email)).length}</b><small>administratorów</small></div>
        <div class="diag-card"><b>${(pamiec/1024).toFixed(1)} KB</b><small>pamięci lokalnej</small><div class="storage-bar"><span style="width:${Math.min(100,pamiec/50000)}%"></span></div></div>
        <div class="diag-card"><b>${wszystkieLogi.filter(l=>l.poziom==="blad").length}</b><small>błędów w dzienniku</small></div>
        <div class="diag-card"><b>${pobierzBannery().filter(b=>b.aktywny!==false).length}</b><small>aktywnych banerów</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().filter(z=>z.wysylka?.numer).length}</b><small>przesyłek z numerem nadania</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().filter(z=>!["anulowane","zakończone","dostarczone"].includes(z.status)&&!z.wysylka?.numer).length}</b><small>przesyłek do przygotowania</small></div>
      </div>
      <div class="diag-actions">
        <button class="btn" onclick="uruchomAutotest()">🧪 Pełny autotest</button>
        <button class="btn ghost" onclick="kopiujRaport()">📋 Kopiuj raport</button>
        <button class="btn ghost" onclick="pobierzRaportJSON()">⬇️ Raport JSON</button>
        <button class="btn ghost" onclick="eksportujKopieDanych()">💾 Kopia danych</button>
        <label class="btn ghost" style="cursor:pointer">📥 Przywróć kopię<input type="file" accept="application/json" onchange="importujKopieDanych(event)" style="display:none"></label>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">✅ Testy integralności i konfiguracji</h2>
      ${grupy.map(g=>`<h3 class="f-sekcja">${esc(g)}</h3><div class="test-list">${testy.filter(x=>x.grupa===g).map(x=>`
        <div class="test-row"><span>${x.status==="ok"?"✅":x.status==="warn"?"⚠️":"❌"}</span><span><b>${esc(x.nazwa)}</b><small>${esc(x.szczegoly)}</small></span><span class="test-status ${x.status}">${x.status==="ok"?"OK":x.status==="warn"?"UWAGA":"BŁĄD"}</span></div>`).join("")}</div>`).join("")}
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">🔧 Narzędzia naprawcze</h2>
      <p style="font-size:.86rem;color:var(--muted2)">Naprawa usuwa wyłącznie odwołania do nieistniejących produktów, duplikaty i osierocone mapowania. Nie usuwa prawidłowych produktów ani zamówień.</p>
      <div class="diag-actions">
        <button class="btn" onclick="naprawDaneSklepu()">🧹 Napraw spójność danych</button>
        <a class="btn ghost" href="#/admin/publikacja">🌍 Kontrola publikacji</a>
        <a class="btn ghost" href="#/admin/wyglad">🎨 Ustawienia układu</a>
        <a class="btn ghost" href="#/admin/podstrony">🧱 Ustawienia podstron</a>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">🖥️ Środowisko</h2>
      <div class="info-grid">
        <div class="info-card"><b>Adres</b><p>${esc(location.href)}</p></div>
        <div class="info-card"><b>Widok</b><p>${window.innerWidth||"—"} × ${window.innerHeight||"—"} px</p></div>
        <div class="info-card"><b>Połączenie</b><p>${navigator.onLine===false?"offline":"online"} • ${location.protocol==="https:"?"HTTPS":location.hostname==="localhost"||location.hostname==="127.0.0.1"?"lokalnie":"HTTP"}</p></div>
        <div class="info-card"><b>Przeglądarka</b><p>${esc((navigator.userAgent||"").slice(0,100))}</p></div>
      </div>
    </div>
    <div class="panel">
      <div class="admin-banner-head"><h2 style="margin:0">📋 Dziennik zdarzeń (${logi.length}/${wszystkieLogi.length})</h2>
        <div><button class="btn ghost" onclick="pobierzPlikLogu()">⬇️ TXT</button><button class="btn danger" onclick="wyczyscLogi()">🗑️ Wyczyść</button></div></div>
      <div class="diag-toolbar">
        <select onchange="filtrLogowDiag=this.value;renderuj()"><option value="wszystkie">Wszystkie poziomy</option><option value="blad" ${filtrLogowDiag==="blad"?"selected":""}>Błędy</option><option value="ostrzezenie" ${filtrLogowDiag==="ostrzezenie"?"selected":""}>Ostrzeżenia</option><option value="info" ${filtrLogowDiag==="info"?"selected":""}>Informacje</option></select>
        <input placeholder="Szukaj w dzienniku…" value="${esc(szukajLogowDiag)}" oninput="szukajLogowDiag=this.value.toLowerCase();clearTimeout(diagSearchT);diagSearchT=setTimeout(renderuj,350)">
      </div>
      ${logi.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>Czas</th><th>Poziom</th><th>Zdarzenie</th><th>Źródło</th></tr>
        ${logi.slice(0,100).map(l=>`<tr><td style="white-space:nowrap">${esc(l.czas)}</td><td><span class="lvl lvl-${l.poziom}">${nazwaPoziomu[l.poziom]||l.poziom}</span></td><td>${esc(l.tresc)}</td><td>${esc(l.zrodlo)}</td></tr>`).join("")}</table></div>`
      :`<p style="color:var(--muted2)">Brak zdarzeń pasujących do filtra.</p>`}
    </div>
  </div>`;
}
function wyczyscLogi(){ localStorage.removeItem("artway_logi"); toast("Dziennik wyczyszczony"); renderuj(); }
async function kopiujRaport(){
  const testy=testyDiagnostyczne(), raport=[
    "RAPORT DIAGNOSTYCZNY Artway-TM — "+new Date().toLocaleString("pl-PL"),
    `Kondycja: ${wynikKondycji(testy)}% | Produkty: ${produkty.length} (${zrodloProduktow}) | Konta: ${pobierzUzytkownikow().length} | Zamówienia: ${pobierzZamowienia().length}`,
    "","TESTY:",...testy.map(x=>`- [${x.status.toUpperCase()}] ${x.grupa} / ${x.nazwa}: ${x.szczegoly}`),
    "","OSTATNIE ZDARZENIA:",...pobierzLogi().slice(0,30).map(l=>`[${l.czas}] ${l.poziom.toUpperCase()}: ${l.tresc}${l.zrodlo?" ("+l.zrodlo+")":""}`)
  ].join("\n");
  try{await navigator.clipboard.writeText(raport);toast("Raport skopiowany 📋");}
  catch(e){pobierzPlik("raport-diagnostyczny.txt",raport,"text/plain");}
}
function pobierzRaportJSON(){
  const testy=testyDiagnostyczne();
  pobierzPlik("artway-diagnostyka-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({
    data:new Date().toISOString(),wynik:wynikKondycji(testy),testy,logi:pobierzLogi(),produkty:produkty.length,zamowienia:pobierzZamowienia().length
  },null,2),"application/json");
}
function pobierzPlikLogu(){
  const tekst=pobierzLogi().map(l=>`[${l.czas}] ${l.poziom.toUpperCase()}: ${l.tresc}${l.zrodlo?" ("+l.zrodlo+")":""}`).join("\n")||"Dziennik pusty.";
  pobierzPlik("artway-log-"+new Date().toISOString().slice(0,10)+".txt",tekst,"text/plain");
}
function eksportujKopieDanych(){
  const dane={wersja:1,data:new Date().toISOString(),localStorage:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith("artway_"))dane.localStorage[k]=localStorage.getItem(k);}
  pobierzPlik("artway-kopia-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(dane,null,2),"application/json");
  loguj("info","Utworzono kopię danych lokalnych");
}
function importujKopieDanych(e){
  const plik=e.target.files?.[0];if(!plik)return;
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.localStorage||typeof d.localStorage!=="object")throw new Error("Niepoprawny format");
    if(!confirm("Przywrócić kopię? Obecne dane lokalne zostaną zastąpione."))return;
    Object.entries(d.localStorage).forEach(([k,v])=>{if(k.startsWith("artway_"))localStorage.setItem(k,String(v));});
    location.reload();
  }catch(bl){toast("⚠️ Nie udało się wczytać kopii: "+bl.message);}};
  r.readAsText(plik);
}
function naprawDaneSklepu(){
  naprawKolizjeIdProduktow();
  zbudujProdukty();
  const widoczne=new Set(produkty.map(p=>p.id)), wszystkie=new Set(produktyDoAdministracji().map(p=>p.id));
  koszyk=koszyk.filter((x,i,a)=>widoczne.has(x.id)&&x.ile>0&&a.findIndex(y=>y.id===x.id)===i);
  ulubione=[...new Set(ulubione.filter(id=>widoczne.has(id)))];
  produktyUkryte=[...new Set(produktyUkryte.filter(id=>prodBazowe.some(p=>p.id===id)))];
  const mapa={...(ustawienia.mapaProduktow||{})};Object.keys(mapa).forEach(id=>{if(!wszystkie.has(+id))delete mapa[id];});
  const kat=new Set(wszystkieKategorie());
  const menuKategorii=grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(k=>kat.has(k))})).filter(g=>g.nazwa);
  const uzytkownicy=pobierzUzytkownikow().filter((u,i,a)=>u.email&&a.findIndex(x=>x.email===u.email)===i);
  zapiszLS("artway_koszyk",koszyk);zapiszLS("artway_ulubione",ulubione);zapiszLS("artway_produkty_ukryte",produktyUkryte);
  zapiszLS("artway_uzytkownicy",uzytkownicy);ustawienia={...ustawienia,mapaProduktow:mapa,menuKategorii};zapiszLS("artway_ustawienia",ustawienia);
  zbudujProdukty();odswiezKoszyk();odswiezUlubioneLicznik();loguj("info","Wykonano naprawę spójności danych");toast("Dane zostały sprawdzone i naprawione ✅");renderuj();
}
async function uruchomAutotest(){
  ostatniAutotest=[];const dodaj=(nazwa,status,szczegoly)=>ostatniAutotest.push({grupa:"Autotest techniczny",nazwa,status,szczegoly});
  try{localStorage.setItem("artway_test","1");const ok=localStorage.getItem("artway_test")==="1";localStorage.removeItem("artway_test");dodaj("Zapis i odczyt pamięci",ok?"ok":"bad",ok?"Pamięć działa":"Brak możliwości zapisu");}catch(e){dodaj("Zapis i odczyt pamięci","bad",e.message);}
  try{const h=await hashuj("test");dodaj("Szyfrowanie haseł",h.length===64?"ok":"warn",h.length===64?"SHA-256 dostępne":"Użyto mechanizmu zapasowego");}catch(e){dodaj("Szyfrowanie haseł","bad",e.message);}
  try{const r=await fetch("products.json",{cache:"no-store"}),j=r.ok?await r.json():null;dodaj("Dostęp do products.json",r.ok&&Array.isArray(j)?"ok":"bad",r.ok?`${j.length} rekordów`:`HTTP ${r.status}`);}catch(e){dodaj("Dostęp do products.json","bad",e.message);}
  try{const widoki=[widokSklep(),widokKontakt(),widokFAQ(),widokDostawa(),widokAdminProdukty()];dodaj("Renderowanie głównych widoków",widoki.every(x=>typeof x==="string"&&x.length>100)?"ok":"bad","Sprawdzono 5 kluczowych ekranów");}catch(e){dodaj("Renderowanie głównych widoków","bad",e.message);}
  loguj("info","Wykonano pełny autotest: "+ostatniAutotest.map(x=>x.status).join(","));
  renderuj();
}

/* ═══════════ KOSZYK ═══════════ */
function ileWKoszyku(id){ return koszyk.filter(x=>x.id===id).reduce((s,x)=>s+x.ile,0); }
function dodaj(id, btn, wariant){
  wariant = wariant || null;
  const p = produkty.find(x=>x.id===id);
  if(p&&!produktMaCeneSprzedazy(p)){ toast("⚠️ Ten produkt wymaga uzupełnienia ceny przez administratora"); return; }
  if(p?.warianty?.length && !wariant){ location.hash="#/produkt/"+id; toast("Wybierz wariant produktu"); return; }
  const stan = p ? stanProduktu(p) : null;
  if(stan!==null && ileWKoszyku(id)+1 > stan){
    toast(stan===0 ? "⚠️ Produkt chwilowo niedostępny" : `⚠️ Na stanie zostało tylko ${stan} szt.`);
    return;
  }
  const poz = koszyk.find(x=>x.id===id && (x.wariant||null)===wariant);
  poz ? poz.ile++ : koszyk.push({id, ile:1, ...(wariant?{wariant}:{})});
  zapiszLS("artway_koszyk", koszyk); odswiezKoszyk();
  if(btn){ btn.textContent="✓ Dodano"; btn.classList.add("added");
    setTimeout(()=>{btn.textContent="Do koszyka"; btn.classList.remove("added");},900); }
  toast("Dodano do koszyka 🛒"+(wariant?" ("+wariant+")":""));
}
function zmienIloscIdx(i, d){
  const poz = koszyk[i]; if(!poz) return;
  if(d>0){
    const p = produkty.find(x=>x.id===poz.id);
    const stan = p ? stanProduktu(p) : null;
    if(stan!==null && ileWKoszyku(poz.id)+1 > stan){ toast(`⚠️ Na stanie jest tylko ${stan} szt.`); return; }
  }
  poz.ile += d;
  if(poz.ile<=0) koszyk.splice(i,1);
  zapiszLS("artway_koszyk", koszyk); odswiezKoszyk();
}
function usunIdx(i){ koszyk.splice(i,1); zapiszLS("artway_koszyk", koszyk); odswiezKoszyk(); }
function zmienIlosc(id, d){ const i = koszyk.findIndex(x=>x.id===id); if(i>=0) zmienIloscIdx(i, d); }
function usun(id){ koszyk = koszyk.filter(x=>x.id!==id); zapiszLS("artway_koszyk", koszyk); odswiezKoszyk(); }
function sumaKoszyka(){
  return koszyk.reduce((s,x)=>{ const p=produkty.find(p=>p.id===x.id); return s+(p?p.cena*x.ile:0); },0);
}
function kwotaRabatu(){ return rabat ? sumaKoszyka()*rabat.procent/100 : 0; }
function sumaPoRabacie(){ return Math.max(0, sumaKoszyka()-kwotaRabatu()); }
function zastosujKod(){
  const kod = ($("promoInput")?.value||"").trim().toUpperCase();
  if(KONFIG.kodyRabatowe[kod]){ rabat={kod, procent:KONFIG.kodyRabatowe[kod]}; zapiszLS("artway_rabat", rabat); toast(`Kod ${kod} aktywny: −${rabat.procent}% 🎉`); }
  else { toast("Nieznany kod rabatowy 😕"); loguj("info","Próba użycia nieznanego kodu: "+kod); }
  odswiezKoszyk();
}
function usunRabat(){ rabat=null; zapiszLS("artway_rabat", null); odswiezKoszyk(); }
function odswiezKoszyk(){
  const n = koszyk.reduce((s,x)=>s+x.ile,0);
  $("cartCount").textContent = n;
  const suma = sumaPoRabacie();
  $("cartTotal").textContent = zl(suma);
  $("checkoutBtn").disabled = !n;
  $("rabatBox").innerHTML = rabat ? `<div class="rabat-info"><span>🎁 Kod ${esc(rabat.kod)}: −${zl(kwotaRabatu())}</span><button onclick="usunRabat()">usuń</button></div>` : "";
  $("freeShip").textContent = suma>=KONFIG.darmowaDostawaOd ? "🎉 Masz darmową dostawę!"
    : suma>0 ? `Do darmowej dostawy brakuje ${zl(KONFIG.darmowaDostawaOd-suma)}` : "";
  $("cartItems").innerHTML = n ? koszyk.map((x,i)=>{
    const p = produkty.find(p=>p.id===x.id); if(!p) return "";
    return `<div class="cart-item">
      <div class="ci-thumb" style="background:${p.kolor||'#eef2f7'}">${p.zdjecie?`<img src="${esc(p.zdjecie)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:(p.ikona||"📦")}</div>
      <div class="ci-info"><b>${esc(p.nazwa)}</b>${x.wariant?`<small style="display:block;color:var(--brand);font-weight:700">${esc(x.wariant)}</small>`:""}<small>${zl(p.cena)} / szt.</small></div>
      <div class="qty">
        <button onclick="zmienIloscIdx(${i},-1)">−</button><span>${x.ile}</span>
        <button onclick="zmienIloscIdx(${i},1)">+</button>
      </div>
      <button class="ci-remove" onclick="usunIdx(${i})" aria-label="Usuń">🗑️</button>
    </div>`;}).join("")
    : `<div class="cart-empty">Koszyk jest pusty.<br>Dodaj coś fajnego! 😊</div>`;
}

/* ═══════════ ZAMÓWIENIE — system dostawy i płatności ═══════════
   Dostawy i płatności konfigurujesz w KONFIG (góra pliku).
   „Za pobraniem” działa od razu — bez umów z bramkami płatności.
   Koszty przeliczają się na żywo przy zmianie opcji.             */
function kosztDostawyDlaKwoty(idDostawy, kwotaProdukow=sumaPoRabacie()){
  const d = dostepneDostawy().find(x=>x.id===idDostawy) || dostepneDostawy()[0];
  if(d.koszt>0 && kwotaNum(kwotaProdukow)>=KONFIG.darmowaDostawaOd) return 0;
  return kwotaNum(d.koszt);
}
function kosztDostawy(idDostawy){
  return kosztDostawyDlaKwoty(idDostawy, sumaPoRabacie());
}
function oplataPlatnosci(idPlat){
  const p = KONFIG.platnosci.find(x=>x.id===idPlat);
  return p ? kwotaNum(p.oplata) : 0;
}
function kosztyZamowienia(z){
  const k=z?.koszty||{}, ma=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key)&&obj[key]!=null;
  const pozycje=Array.isArray(z?.pozycjeDane)?z.pozycjeDane:[];
  const produktyZPozycji=pozycje.reduce((s,p)=>s+kwotaNum(p.wartosc || (kwotaNum(p.cena)*(Number(p.ilosc)||1))),0);
  const metoda=z?.dostawaId || (czyZamowieniePaczkomat(z)?"paczkomat":"kurier_inpost");
  const weekendAktywny=!!(z?.paczkaWeekend || z?.wysylka?.paczkaWeekend);
  const weekend=kwotaNum(ma(z,"oplataPaczkaWeekend")?z.oplataPaczkaWeekend:(ma(k,"paczkaWeekend")?k.paczkaWeekend:oplataPaczkaWeekend(weekendAktywny)));
  const platnosc=kwotaNum(ma(z,"oplataPlatnosci")?z.oplataPlatnosci:(ma(k,"platnosc")?k.platnosc:oplataPlatnosci(z?.platnoscId)));
  const dostawaZapisana=ma(z,"dostawaKoszt")||ma(k,"dostawa");
  const dostawa=dostawaZapisana ? kwotaNum(ma(z,"dostawaKoszt")?z.dostawaKoszt:k.dostawa) : kosztDostawyDlaKwoty(metoda, ma(k,"poRabacie")?k.poRabacie:produktyZPozycji);
  const razemZapisane=kwotaNum(z?.razem);
  let poRabacie=ma(k,"poRabacie") ? kwotaNum(k.poRabacie) : 0;
  if(!poRabacie && razemZapisane) poRabacie=Math.max(0, kwotaNum(razemZapisane-dostawa-weekend-platnosc));
  const produkty=ma(k,"produkty") ? kwotaNum(k.produkty) : (produktyZPozycji || poRabacie);
  const rabat=ma(k,"rabat") ? kwotaNum(k.rabat) : Math.max(0, kwotaNum(produkty-poRabacie));
  if(!poRabacie) poRabacie=Math.max(0, kwotaNum(produkty-rabat));
  const razem=razemZapisane || kwotaNum(poRabacie+dostawa+weekend+platnosc);
  return {produkty,rabat,poRabacie,dostawa,paczkaWeekend:weekend,platnosc,razem,metoda,weekendAktywny:weekend>0||weekendAktywny};
}
function zapiszKosztyZamowienia(z, zmiany={}){
  const c=kosztyZamowienia(z);
  const metoda=zmiany.dostawaId || z?.dostawaId || c.metoda || "paczkomat";
  const weekendAktywny=Object.prototype.hasOwnProperty.call(zmiany,"paczkaWeekend") ? !!zmiany.paczkaWeekend : c.weekendAktywny;
  const dostawa=kosztDostawyDlaKwoty(metoda, c.poRabacie);
  const weekend=oplataPaczkaWeekend(weekendAktywny);
  const razem=kwotaNum(c.poRabacie+dostawa+weekend+c.platnosc);
  z.dostawaKoszt=dostawa;
  z.oplataPaczkaWeekend=weekend;
  z.oplataPlatnosci=c.platnosc;
  z.paczkaWeekend=weekendAktywny;
  z.koszty={...(z.koszty||{}),produkty:c.produkty,rabat:c.rabat,poRabacie:c.poRabacie,dostawa,paczkaWeekend:weekend,platnosc:c.platnosc,razem};
  z.razem=razem;
  return z.koszty;
}
function podsumowanieKosztowHTML(z, podpisRazem="Razem"){
  const c=kosztyZamowienia(z);
  return `${c.produkty?`<div><span>Produkty</span><span>${zl(c.produkty)}</span></div>`:""}
    ${c.rabat?`<div><span>Rabat</span><span>−${zl(c.rabat)}</span></div><div><span>Po rabacie</span><span>${zl(c.poRabacie)}</span></div>`:""}
    <div><span>Dostawa</span><span>${c.dostawa?zl(c.dostawa):"GRATIS"}</span></div>
    ${c.paczkaWeekend?`<div><span>Paczka w Weekend</span><span>${zl(c.paczkaWeekend)}</span></div>`:""}
    ${c.platnosc?`<div><span>Opłata płatności / pobrania</span><span>${zl(c.platnosc)}</span></div>`:""}
    <div class="sum-total"><span>${esc(podpisRazem)}</span><span>${zl(c.razem)}</span></div>`;
}
function podsumowanieKosztowTekst(z){
  const c=kosztyZamowienia(z);
  return [
    `Produkty: ${zl(c.produkty || c.poRabacie)}`,
    c.rabat ? `Rabat: -${zl(c.rabat)}` : "",
    `Dostawa: ${c.dostawa?zl(c.dostawa):"GRATIS"} (${z?.dostawa||"—"})`,
    c.paczkaWeekend ? `Paczka w Weekend: ${zl(c.paczkaWeekend)}` : "",
    c.platnosc ? `Opłata płatności / pobrania: ${zl(c.platnosc)}` : "",
    `Razem do zapłaty: ${zl(c.razem)}`
  ].filter(Boolean).join("\n");
}
function dostepnePlatnosci(){
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  return KONFIG.platnosci.filter(p => !p.wylaczona);
}
function formatujKod(el){
  const c = el.value.replace(/[^0-9]/g,"").slice(0,5);
  el.value = c.length>2 ? c.slice(0,2)+"-"+c.slice(2) : c;
}
function walidujNip(nip){
  const c = String(nip||"").replace(/[^0-9]/g,"");
  if(c.length!==10) return false;
  const wagi = [6,5,7,2,3,4,5,6,7];
  const suma = wagi.reduce((s,w,i)=>s+w*+c[i],0);
  return suma%11!==10 && suma%11===+c[9];
}
function przelaczFirme(chk){
  const b = $("firmaBox"); if(b) b.style.display = chk.checked ? "" : "none";
  chk.form.firma.required = chk.form.nip.required = chk.checked;
}
function przelaczKonto(chk){
  const b = $("kontoBox"); if(b) b.style.display = chk.checked ? "" : "none";
  chk.form.haslo.required = chk.checked;
  chk.form.haslo2.required = chk.checked;
}
/* Pobieranie danych firmy z NIP — oficjalny, darmowy rejestr VAT
   Ministerstwa Finansów (wl-api.mf.gov.pl). Wymaga internetu;
   gdy się nie uda, klient uzupełnia dane ręcznie.               */
/* Wspólne pobieranie danych firmy z rejestru VAT (checkout, kartoteka klienta, konto) */
async function pobierzDaneFirmy(nip){
  nip = String(nip||"").replace(/[^0-9]/g,"");
  if(!walidujNip(nip)) return {blad:"Wpisz poprawny NIP (10 cyfr)"};
  try{
    const dzis = new Date().toISOString().slice(0,10);
    const r = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${dzis}`);
    if(!r.ok) throw new Error("HTTP "+r.status);
    const s = (await r.json())?.result?.subject;
    if(!s) throw new Error("nie znaleziono firmy w rejestrze VAT");
    const adr = s.workingAddress || s.residenceAddress || "";
    const m = adr.match(/^(.*?),\s*(\d{2}-\d{3})\s+(.*)$/);
    let ulica="", nrDomu="", kod="", miasto="";
    if(m){
      const ul = m[1].replace(/^UL\.\s*/i,"");
      const um = ul.match(/^(.*?)\s+([\d\/A-Za-z]+)$/);
      ulica = um ? um[1] : ul; nrDomu = um ? um[2] : "";
      kod = m[2]; miasto = m[3];
    }
    loguj("info","Pobrano dane firmy z NIP "+nip+": "+(s.name||"").slice(0,60));
    return { nazwa:s.name||"", nip, ulica, nrDomu, kod, miasto };
  }catch(e){
    loguj("ostrzezenie","Pobieranie danych z NIP nie powiodło się: "+e.message);
    return {blad:"Nie udało się pobrać danych z rejestru — uzupełnij ręcznie"};
  }
}
/* wypełnia pola formularza (po atrybucie name) danymi z rejestru */
async function nipDoFormularza(form, przycisk){
  if(!form) return;
  if(przycisk){ przycisk.disabled=true; przycisk.textContent="⏳ Pobieram…"; }
  const d = await pobierzDaneFirmy(form.nip.value);
  if(przycisk){ przycisk.disabled=false; przycisk.textContent="⬇️ Pobierz dane z NIP"; }
  if(d.blad){ toast("⚠️ "+d.blad); return; }
  if(form.firma) form.firma.value = d.nazwa;
  if(form.ulica && !form.ulica.value){ form.ulica.value=d.ulica; if(form.nrDomu) form.nrDomu.value=d.nrDomu;
    if(form.kod) form.kod.value=d.kod; if(form.miasto) form.miasto.value=d.miasto; }
  toast("✅ Pobrano: "+d.nazwa.slice(0,40));
}
async function pobierzDaneZNip(){
  await nipDoFormularza($("orderForm"), $("nipBtn"));
}
function otworzModal(){
  zamknijKoszyk();
  window.__paczkomatAdres="";
  const profil = sesja ? (pobierzProfil(sesja.email)||{}) : {};
  const czesci = (sesja?.imie||"").split(" ");
  const imieS = czesci[0]||"", nazwiskoS = czesci.slice(1).join(" ");
  const maFirme = !!(profil.nip && profil.firma);
  $("modalBox").innerHTML = `
    <h2>Dane do zamówienia</h2>
    <p class="sub">Pola z * są wymagane. Koszty przeliczają się automatycznie.${sesja&&(profil.ulica||profil.telefon)?" Dane wstawiono z Twojego profilu.":""}</p>
    <form id="orderForm" onsubmit="zlozZamowienie(event)">
      <h3 class="f-sekcja">👤 Dane kontaktowe</h3>
      <div class="f-row">
        <div class="f-group"><label>Imię *</label><input required name="imie" autocomplete="given-name" value="${esc(imieS)}"></div>
        <div class="f-group"><label>Nazwisko *</label><input required name="nazwisko" autocomplete="family-name" value="${esc(nazwiskoS)}"></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Telefon *</label><input required name="phone" type="tel" pattern="[0-9+\\- ]{9,15}" placeholder="np. 600 100 200" autocomplete="tel" value="${esc(profil.telefon||"")}"></div>
        <div class="f-group"><label>E-mail *</label><input required name="email" type="email" autocomplete="email" value="${sesja?esc(sesja.email):""}"></div>
      </div>
      <h3 class="f-sekcja">📍 Adres dostawy</h3>
      <div class="f-row" style="grid-template-columns:2fr 1fr 1fr">
        <div class="f-group"><label>Ulica *</label><input required name="ulica" autocomplete="address-line1" value="${esc(profil.ulica||"")}"></div>
        <div class="f-group"><label>Nr domu *</label><input required name="nrDomu" value="${esc(profil.nrDomu||"")}"></div>
        <div class="f-group"><label>Nr lokalu</label><input name="nrLokalu" value="${esc(profil.nrLokalu||"")}"></div>
      </div>
      <div class="f-row" style="grid-template-columns:1fr 2fr">
        <div class="f-group"><label>Kod pocztowy *</label><input required name="kod" placeholder="00-000" maxlength="6" pattern="\\d{2}-\\d{3}" oninput="formatujKod(this)" autocomplete="postal-code" value="${esc(profil.kod||"")}"></div>
        <div class="f-group"><label>Miejscowość *</label><input required name="miasto" autocomplete="address-level2" value="${esc(profil.miasto||"")}"></div>
      </div>
      <label class="chk-row"><input type="checkbox" name="firmaChk" onchange="przelaczFirme(this)" ${maFirme?"checked":""}> 🧾 Kupuję jako firma (faktura VAT)</label>
      <div id="firmaBox" style="display:${maFirme?"block":"none"}">
        <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
          <div class="f-group"><label>NIP *</label><input name="nip" placeholder="10 cyfr" maxlength="13" inputmode="numeric" ${maFirme?"required":""} value="${esc(profil.nip||"")}"></div>
          <div class="f-group"><button type="button" class="btn ghost" id="nipBtn" onclick="pobierzDaneZNip()">⬇️ Pobierz dane z NIP</button></div>
        </div>
        <div class="f-group"><label>Nazwa firmy *</label><input name="firma" autocomplete="organization" ${maFirme?"required":""} value="${esc(profil.firma||"")}"></div>
      </div>
      ${sesja ? `
      <label class="chk-row"><input type="checkbox" name="zapamietaj" checked> 💾 Zapamiętaj te dane w moim profilu (następne zamówienia wypełnią się same)</label>` : `
      <label class="chk-row"><input type="checkbox" name="kontoChk" onchange="przelaczKonto(this)"> ✨ Załóż mi od razu konto (historia zamówień i szybsze zakupy)</label>
      <div id="kontoBox" style="display:none">
        <div class="f-group"><label>Hasło do konta * (min. 6 znaków)</label><input name="haslo" type="password" minlength="6" autocomplete="new-password"></div>
        <div class="f-group"><label>Powtórz hasło do konta *</label><input name="haslo2" type="password" minlength="6" autocomplete="new-password"></div>
      </div>`}
      <h3 class="f-sekcja">🚚 Dostawa i płatność</h3>
      <div class="f-row">
        <div class="f-group"><label>Dostawa</label>
          <select name="delivery" onchange="przeliczZamowienie()">
            ${dostepneDostawy().map(d=>`<option value="${d.id}">${esc(d.nazwa)} — ${d.koszt?zl(d.koszt):"gratis"} (${esc(d.opis)})</option>`).join("")}
          </select>
          <small style="color:var(--muted2)">Dostawa wyłącznie przez InPost: Paczkomat/Punkt InPost albo Kurier InPost.</small>
        </div>
        <div class="f-group"><label>Płatność</label>
          <select name="payment" onchange="przeliczZamowienie()">
            ${dostepnePlatnosci().map(p=>`<option value="${p.id}">${esc(p.nazwa)}${p.oplata?" (+"+zl(p.oplata)+")":""}</option>`).join("")}
          </select>
        </div>
      </div>
      <label class="chk-row"><input type="checkbox" name="paczkaWeekend" onchange="przeliczZamowienie()"> 🟡 Paczka w Weekend (+${zl(OPLATA_PACZKA_WEEKEND)}) <small style="color:var(--muted2);font-weight:600">opcjonalna usługa InPost doliczana do zamówienia</small></label>
      <div class="f-group" id="paczkomatBox" style="display:block">
        <label>Paczkomat InPost *</label>
        <input type="hidden" name="paczkomat" id="paczkomatKod">
        <div class="f-row" style="grid-template-columns:1fr auto;align-items:end;margin:.25rem 0">
          <div class="f-group" style="margin:0"><input id="paczkomatSzukaj" placeholder="Wpisz kod pocztowy, miasto albo kod paczkomatu, np. WAW01M" onkeydown="if(event.key==='Enter'){event.preventDefault();szukajPaczkomatow()}"></div>
          <div class="f-group" style="margin:0"><button type="button" class="btn ghost" onclick="szukajPaczkomatow()">🔎 Szukaj</button></div>
        </div>
        <div class="diag-actions" style="margin:.35rem 0">
          <button type="button" class="btn" style="background:#ffcc00;color:#111;font-weight:800" onclick="otworzGeowidget()">🗺️ Mapa InPost</button>
          <button type="button" class="btn ghost" onclick="szukajPaczkomatow('geo')">📍 Najbliższe</button>
          <button type="button" class="btn ghost" onclick="const f=document.getElementById('orderForm'); const q=document.getElementById('paczkomatSzukaj'); if(q&&f){q.value=f.kod.value||f.miasto.value||'';} szukajPaczkomatow()">🏠 Szukaj przy adresie</button>
        </div>
        <div id="paczkomatWybrany" style="font-size:.9rem;color:var(--muted2)">Wybierz punkt z listy, mapy albo wpisz kod ręcznie.</div>
        <div id="paczkomatWyniki"></div>
        <input id="paczkomatReczny" placeholder="Awaryjnie: wpisz kod ręcznie, np. WAW01M" style="margin-top:.55rem;text-transform:uppercase" oninput="ustawPaczkomatReczny(this.value)">
      </div>
      <div class="f-group"><label>Uwagi do zamówienia</label><textarea name="notes" rows="2"></textarea></div>
      <div class="summary" id="orderSummary"></div>
      <button type="submit" class="checkout-btn">Zamawiam →</button>
      <p class="pay-note">Klikając, akceptujesz <a href="#/regulamin" onclick="document.getElementById('modal').classList.remove('open')">regulamin</a>. Dane służą wyłącznie realizacji zamówienia.</p>
    </form>`;
  przeliczZamowienie();
  $("modal").classList.add("open");
}
function przeliczZamowienie(){
  const form = $("orderForm"); if(!form) return;
  const idD = form.delivery?.value || "paczkomat", idP = form.payment.value;
  const pBox = $("paczkomatBox");
  if(pBox){ pBox.style.display = czyDostawaPaczkomat(idD) ? "" : "none"; }
  const suma = sumaPoRabacie(), dostawa = kosztDostawy(idD), oplata = oplataPlatnosci(idP), weekend = oplataPaczkaWeekend(!!form.paczkaWeekend?.checked);
  $("orderSummary").innerHTML =
    koszyk.map(x=>{const p=produkty.find(p=>p.id===x.id);
      return `<div><span>${esc(p.nazwa)}${x.wariant?` (${esc(x.wariant)})`:""} × ${x.ile}</span><span>${zl(p.cena*x.ile)}</span></div>`;}).join("")
    + (rabat?`<div><span>Rabat (${esc(rabat.kod)})</span><span>−${zl(kwotaRabatu())}</span></div>`:"")
    + `<div><span>Dostawa</span><span>${dostawa?zl(dostawa):"GRATIS"}</span></div>`
    + (weekend?`<div><span>Paczka w Weekend</span><span>${zl(weekend)}</span></div>`:"")
    + (oplata?`<div><span>Opłata za pobranie</span><span>${zl(oplata)}</span></div>`:"")
    + `<div class="sum-total"><span>Do zapłaty</span><span>${zl(suma+dostawa+oplata+weekend)}</span></div>`;
}
// ─── InPost Geowidget (wybór paczkomatu na mapie) ───
let INPOST_PUBLIC=null, geowidgetSDK=null;
async function pobierzInpostConfig(force=false){
  if(INPOST_PUBLIC&&!force) return INPOST_PUBLIC;
  try{ const d=await chmura("inpost-config",{timeout:9000}); INPOST_PUBLIC=d.inpost||null; }catch(e){ INPOST_PUBLIC=null; }
  return INPOST_PUBLIC;
}
function ladujGeowidgetSDK(){
  if(geowidgetSDK) return geowidgetSDK;
  geowidgetSDK=new Promise((res,rej)=>{
    if(!document.getElementById("inpost-geo-css")){ const l=document.createElement("link"); l.id="inpost-geo-css"; l.rel="stylesheet"; l.href="https://geowidget.inpost.pl/inpost-geowidget.css"; document.head.appendChild(l); }
    if(window.customElements&&window.customElements.get("inpost-geowidget")){ res(true); return; }
    const s=document.createElement("script"); s.src="https://geowidget.inpost.pl/inpost-geowidget.js"; s.defer=true;
    s.onload=()=>res(true); s.onerror=()=>rej(new Error("Nie udało się załadować mapy InPost")); document.head.appendChild(s);
  });
  return geowidgetSDK;
}
function ustawPaczkomatReczny(v){
  const kod=String(v||"").trim().toUpperCase();
  const h=$("paczkomatKod"); if(h) h.value=kod;
  window.__paczkomatAdres="";
  const d=$("paczkomatWybrany"); if(d) d.innerHTML = kod?`📮 Wybrany paczkomat: <b>${esc(kod)}</b>`:"Wybierz punkt z listy, mapy albo wpisz kod ręcznie.";
}
function czyscAdresPaczkomatu(str){
  const parts=String(str||"").split("•").map(s=>s.trim()).filter(Boolean);
  const keep=[];
  for(const p of parts){
    const lp=p.toLowerCase();
    if(keep.some(k=>k.toLowerCase().includes(lp))) continue;         // pomiń, jeśli już zawarte w innej części
    for(let i=keep.length-1;i>=0;i--){ if(lp.includes(keep[i].toLowerCase())) keep.splice(i,1); } // usuń krótsze duplikaty
    keep.push(p);
  }
  return keep.join(" • ");
}
function opisPunktuInpost(p){
  return czyscAdresPaczkomatu([p.address,[p.postCode,p.city].filter(Boolean).join(" "),p.description].filter(Boolean).join(" • "));
}
function wybierzPaczkomatZListy(kod, adres){
  kod=String(kod||"").trim().toUpperCase();
  if(!kod) return;
  const h=$("paczkomatKod"); if(h) h.value=kod;
  const r=$("paczkomatReczny"); if(r) r.value=kod;
  window.__paczkomatAdres=String(adres||"").trim();
  const d=$("paczkomatWybrany"); if(d) d.innerHTML=`📮 Wybrany paczkomat: <b>${esc(kod)}</b>${adres?`<br><small>${esc(adres)}</small>`:""}`;
  toast("Wybrano paczkomat "+kod);
}
function pokazListePaczkomatow(punkty){
  const box=$("paczkomatWyniki"); if(!box) return;
  if(!punkty.length){ box.innerHTML=`<div class="backend-note" style="margin-top:.5rem">Nie znaleziono punktów. Spróbuj wpisać kod pocztowy, nazwę miasta albo kod paczkomatu, np. WAW01M.</div>`; return; }
  box.innerHTML=`<div style="display:grid;gap:.45rem;margin-top:.55rem">${punkty.map(p=>{
    const adres=opisPunktuInpost(p);
    const dyst=Number.isFinite(Number(p.distance))?` • ${(Number(p.distance)/1000).toFixed(Number(p.distance)>=1000?1:2).replace(".",",")} km`:"";
    return `<button type="button" class="btn ghost" style="text-align:left;display:block;width:100%;padding:.65rem .75rem" onclick="wybierzPaczkomatZListy(${jsArg(p.name)},${jsArg(adres)})">
      <b>📮 ${esc(p.name)}</b>${p.location247?" <span class=\"lvl lvl-info\">24/7</span>":""}${p.easyAccessZone?" <span class=\"lvl lvl-info\">łatwy dostęp</span>":""}${dyst}<br>
      <small style="color:var(--muted2)">${esc(adres||"brak adresu")}${p.openingHours?` • ${esc(p.openingHours)}`:""}</small>
    </button>`;
  }).join("")}</div>`;
}
async function szukajPaczkomatow(tryb="tekst"){
  const box=$("paczkomatWyniki"); if(box) box.innerHTML=`<p class="pay-note" style="text-align:left">Szukam punktów InPost…</p>`;
  const form=$("orderForm"), input=$("paczkomatSzukaj");
  const q=String(input?.value||"").trim();
  const params={limit:12};
  try{
    if(tryb==="geo"){
      if(!navigator.geolocation){ toast("Przeglądarka nie udostępnia lokalizacji"); return; }
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:false,timeout:8000,maximumAge:300000}));
      params.lat=pos.coords.latitude; params.lng=pos.coords.longitude;
    }else{
      const kod=String(form?.kod?.value||"").trim();
      const miasto=String(form?.miasto?.value||"").trim();
      const zapytanie=q || kod || miasto;
      if(!zapytanie){ toast("Wpisz miasto, kod pocztowy albo nazwę paczkomatu"); input?.focus(); return; }
      if(/^\d{2}-?\d{3}$/.test(zapytanie)) params.post_code=zapytanie;
      else params.q=zapytanie;
    }
    const d=await chmura("inpost-points",{params,timeout:12000});
    pokazListePaczkomatow(d.points||[]);
  }catch(e){
    if(box) box.innerHTML=`<div class="backend-note" style="border-color:var(--danger);background:#fff1f2;color:#991b1b;margin-top:.5rem"><b>Nie udało się pobrać punktów:</b> ${esc(e.message||"błąd")}. Możesz użyć mapy InPost albo wpisać kod ręcznie.</div>`;
    loguj("blad","Wyszukiwarka paczkomatów: "+(e.message||e));
  }
}
window.artwayPunktWybrany=function(point){
  try{
    const kod=(point&&(point.name||point.id))||"";
    const adr=czyscAdresPaczkomatu(point&&point.address?[point.address.line1,point.address.line2].filter(Boolean).join(" • "):((point&&point.location_description)||""));
    if(window.__geoTarget==="admin"){
      const ah=$("admPaczkomat"); if(ah) ah.value=kod;
      const av=$("admPaczkomatAdresVal"); if(av) av.value=adr;
      const ad=$("admPaczkomatAdres"); if(ad) ad.innerHTML=kod?`📮 ${esc(adr||kod)}`:"";
      window.__geoTarget="";
      zamknijGeowidget();
      toast("Wybrano paczkomat "+kod);
      return;
    }
    const h=$("paczkomatKod"); if(h) h.value=kod;
    const r=$("paczkomatReczny"); if(r) r.value=kod;
    window.__paczkomatAdres=adr;
    const d=$("paczkomatWybrany"); if(d) d.innerHTML=kod?`📮 Wybrany paczkomat: <b>${esc(kod)}</b>${adr?`<br><small>${esc(adr)}</small>`:""}`:"Wybierz punkt z listy, mapy albo wpisz kod ręcznie.";
    zamknijGeowidget();
    toast("Wybrano paczkomat "+kod);
  }catch(e){ loguj("blad","Geowidget punkt: "+(e&&e.message||e)); }
};
async function otworzGeowidget(){
  const cfg=await pobierzInpostConfig();
  if(!cfg||!cfg.geowidgetToken){ toast("Mapa paczkomatów nie jest jeszcze skonfigurowana — wpisz kod paczkomatu ręcznie w polu poniżej"); const r=$("paczkomatReczny"); if(r) r.focus(); return; }
  try{ await ladujGeowidgetSDK(); }catch(e){ toast(e.message||"Błąd mapy InPost"); return; }
  const form=$("orderForm"); const cod = !!(form&&form.payment&&form.payment.value==="pobranie");
  const config = cod ? "parcelCollectPayment" : "parcelCollect";
  let ov=$("geoOverlay");
  if(!ov){ ov=document.createElement("div"); ov.id="geoOverlay"; ov.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:2vmin"; document.body.appendChild(ov); }
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;width:min(980px,96vw);height:min(88vh,780px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;background:#111;color:#fff">
      <b>Wybierz paczkomat InPost</b><button type="button" onclick="zamknijGeowidget()" style="background:#ffcc00;color:#111;border:0;border-radius:8px;padding:.4rem .8rem;font-weight:800;cursor:pointer">Zamknij ✕</button></div>
    <div style="flex:1;min-height:0"><inpost-geowidget onpoint="artwayPunktWybrany" token="${esc(cfg.geowidgetToken)}" language="pl" config="${config}" style="width:100%;height:100%;display:block"></inpost-geowidget></div>
  </div>`;
  ov.style.display="flex";
}
function zamknijGeowidget(){ const ov=$("geoOverlay"); if(ov){ ov.style.display="none"; ov.innerHTML=""; } }
async function zlozZamowienie(e){
  e.preventDefault();
  try{
    const f = new FormData(e.target);
    // walidacja NIP przy fakturze
    if(f.get("firmaChk") && !walidujNip(f.get("nip"))){
      toast("⚠️ Nieprawidłowy NIP — sprawdź numer");
      loguj("info","Odrzucono zamówienie: błędny NIP");
      return;
    }
    // opcjonalna rejestracja konta przy zamówieniu
    if(!sesja && f.get("kontoChk")){
      if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ toast("⚠️ Wpisane hasła do konta nie są takie same"); return; }
      const w = await zarejestrujUzytkownika(f.get("imie")+" "+f.get("nazwisko"), f.get("email"), f.get("haslo")||"");
      if(w.ok){ ustawSesje({imie:(f.get("imie")+" "+f.get("nazwisko")).trim(), email:f.get("email").trim().toLowerCase()}); toast("Konto założone! 🎉"); }
      else { loguj("ostrzezenie","Konto przy zamówieniu nieutworzone: "+w.blad); }
    }
    const idD = String(f.get("delivery")||"paczkomat"), idP = f.get("payment");
    if(czyDostawaPaczkomat(idD) && !String(f.get("paczkomat")||"").trim()){
      toast("⚠️ Wybierz paczkomat na mapie lub wpisz jego kod");
      const r=$("paczkomatReczny"); if(r) r.focus();
      return;
    }
    const dost = dostepneDostawy().find(x=>x.id===idD) || DOMYSLNA_DOSTAWA_INPOST;
    const plat = KONFIG.platnosci.find(x=>x.id===idP);
    const paczkaWeekend = !!f.get("paczkaWeekend");
    const suma = sumaPoRabacie(), dostawa = kosztDostawy(idD), oplata = oplataPlatnosci(idP), oplataWeekend = oplataPaczkaWeekend(paczkaWeekend);
    const razem = kwotaNum(suma+dostawa+oplata+oplataWeekend);
    const nr = "ATM-" + Date.now().toString().slice(-6);
    const paczkomat = czyDostawaPaczkomat(idD) ? " • Paczkomat: "+f.get("paczkomat") : "";
    const adres = `${f.get("ulica")} ${f.get("nrDomu")}${f.get("nrLokalu")?"/"+f.get("nrLokalu"):""}, ${f.get("kod")} ${f.get("miasto")}`;
    const firma = f.get("firmaChk") ? `\nFirma: ${f.get("firma")} • NIP: ${String(f.get("nip")).replace(/[^0-9]/g,"")}` : "";
    const pozycjeDane = koszyk.map(x=>{const p=produkty.find(p=>p.id===x.id);
      return {id:p.id,nazwa:p.nazwa,sku:p.sku||"",wariant:x.wariant||"",ilosc:x.ile,cena:p.cena,wartosc:p.cena*x.ile};});
    const pozycje = pozycjeDane.map(p=>{
      return `${p.nazwa}${p.wariant?` (${p.wariant})`:""}${p.sku?` [${p.sku}]`:""} × ${p.ilosc} = ${zl(p.wartosc)}`;});
    const tresc =
`NOWE ZAMÓWIENIE ${nr}
================================
${pozycje.map(p=>"- "+p).join("\n")}
${rabat?`Rabat ${rabat.kod}: -${zl(kwotaRabatu())}\n`:""}Dostawa: ${dost.nazwa}${paczkomat} — ${dostawa?zl(dostawa):"gratis"}
${paczkaWeekend?`Paczka w Weekend: ${zl(oplataWeekend)}\n`:""}
${oplata?`Opłata za pobranie: ${zl(oplata)}\n`:""}RAZEM: ${zl(razem)}
Płatność: ${plat.nazwa}
${instrukcjaPlatnosciTekst(idP,nr,razem)}
--------------------------------
Klient: ${f.get("imie")} ${f.get("nazwisko")}${firma}
Tel: ${f.get("phone")}
E-mail: ${f.get("email")}
Adres: ${adres}
Uwagi: ${f.get("notes")||"brak"}`;

    // zapamiętaj dane w profilu zalogowanego klienta
    if(sesja && f.get("zapamietaj")){
      const u = pobierzUzytkownikow();
      const k = u.find(x=>x.email===sesja.email);
      if(k){
        Object.assign(k, {
          telefon:String(f.get("phone")||"").trim(), ulica:String(f.get("ulica")||"").trim(),
          nrDomu:String(f.get("nrDomu")||"").trim(), nrLokalu:String(f.get("nrLokalu")||"").trim(),
          kod:String(f.get("kod")||"").trim(), miasto:String(f.get("miasto")||"").trim()
        });
        if(f.get("firmaChk")){ k.nip = String(f.get("nip")||"").replace(/[^0-9]/g,""); k.firma = String(f.get("firma")||"").trim(); }
        zapiszLS("artway_uzytkownicy", u);
        void zapiszUzytkownikaCentralnie(k);
      }
    }
    zmniejszStany(koszyk);   // magazyn: odejmij sprzedane sztuki
    const emailKlienta=String(f.get("email")||"").trim().toLowerCase();
    const noweZamowienie={
      nr, data:new Date().toLocaleString("pl-PL"), ts:Date.now(), email:emailKlienta,
      klient:{imie:String(f.get("imie")||"").trim(),nazwisko:String(f.get("nazwisko")||"").trim(),telefon:String(f.get("phone")||"").trim(),
        firma:f.get("firmaChk")?String(f.get("firma")||"").trim():"",nip:f.get("firmaChk")?String(f.get("nip")||"").replace(/[^0-9]/g,""):""},
      adresDostawy:{ulica:String(f.get("ulica")||"").trim(),nrDomu:String(f.get("nrDomu")||"").trim(),nrLokalu:String(f.get("nrLokalu")||"").trim(),kod:String(f.get("kod")||"").trim(),miasto:String(f.get("miasto")||"").trim()},
      pozycje,pozycjeDane,razem,status:"nowe",dostawa:dost.nazwa,dostawaId:idD,dostawaKoszt:dostawa,paczkaWeekend,oplataPaczkaWeekend:oplataWeekend,
      oplataPlatnosci:oplata,koszty:{produkty:sumaKoszyka(),rabat:kwotaRabatu(),poRabacie:suma,dostawa,paczkaWeekend:oplataWeekend,platnosc:oplata,razem},
      platnosc:plat.nazwa,platnoscId:idP,platnoscInstrukcja:instrukcjaPlatnosciTekst(idP,nr,razem),adres,
      paczkomat:czyDostawaPaczkomat(idD)?String(f.get("paczkomat")||"").trim():"",paczkomatAdres:czyDostawaPaczkomat(idD)?String(window.__paczkomatAdres||"").trim():"",uwagi:String(f.get("notes")||"").trim(),
      wysylka:{przewoznik:"inpost",usluga:uslugaInpostDlaDostawy(idD),punktKod:czyDostawaPaczkomat(idD)?String(f.get("paczkomat")||"").trim():"",status:"nieprzygotowana",etap:"do_obslugi",priorytet:"normalny",zadania:{dane:true,kompletacja:false,etykieta:false,przekazanie:false},
        paczkaWeekend,oplataWeekend,dodatkoweUslugi:paczkaWeekend?[{id:"paczka_weekend",nazwa:"Paczka w Weekend",koszt:oplataWeekend}]:[],
        historia:[{czas:new Date().toLocaleString("pl-PL"),status:"Zamówienie utworzone",opis:"Oczekuje na potwierdzenie i przygotowanie"}],powiadomienia:[]}
    };
    zapiszZamowienie(noweZamowienie);
    const zapisanoCentralnie=await zapiszZamowienieCentralnie(noweZamowienie,true);
    let paynowWynik=null;
    if(idP==="paynow"){
      paynowWynik = await utworzPlatnoscPaynow(noweZamowienie);
    }
    if(zapisanoCentralnie&&sesja) await pobierzMojeZamowieniaCentralne(true);
    if(!zapisanoCentralnie){
      toast("⚠️ Zamówienie zapisano lokalnie, ale serwer jest niedostępny");
      loguj("blad",`Zamówienie ${nr} oczekuje na synchronizację ze wspólną bazą`);
    }
    if(!sesja){
      const numery=wczytajLS("artway_zamowienia_goscia",[]);
      zapiszLS("artway_zamowienia_goscia",[nr,...numery.filter(x=>x!==nr)].slice(0,20));
    }
    loguj("info",`Złożono zamówienie ${nr} na ${zl(razem)} (${dost.nazwa}, ${plat.nazwa})`);

	    const infoPlatnosci = instrukcjaPlatnosciHTML(idP,nr,razem,noweZamowienie);
	    const bladPaynow = idP==="paynow" && paynowWynik && paynowWynik.ok===false && !paynowWynik.skipped
	      ? `<p class="pay-note" style="color:var(--danger);text-align:left">Paynow nie utworzył linku automatycznie: ${esc(paynowWynik.error||"brak konfiguracji")}. Zamówienie zostało zapisane — po uzupełnieniu konfiguracji można odświeżyć płatność w panelu.</p>` : "";
	    const urlDziekujemy = `#/dziekujemy/${encodeURIComponent(nr)}`;
	    const linkPaynow = noweZamowienie.paynow?.redirectUrl || (idP==="paynow" && KONFIG.linkPlatnosci ? KONFIG.linkPlatnosci : "");
	    $("modalBox").innerHTML = `<div class="success">
	      <div class="big">✅</div>
	      <h2>${linkPaynow?"Przekierowujemy do płatności…":"Dziękujemy za zamówienie!"}</h2>
	      <p class="sub">Numer zamówienia: <b>${nr}</b> • Kwota: <b>${zl(razem)}</b><br>${esc(dost.nazwa)} • ${esc(plat.nazwa)}</p>
	      <p class="pay-note" style="${zapisanoCentralnie?"color:var(--ok)":"color:var(--danger)"}">${zapisanoCentralnie?"☁️ Zamówienie zapisano we wspólnej bazie sklepu.":"⚠️ Brak połączenia z serwerem — zamówienie czeka na synchronizację."}</p>
	      <p class="pay-note" style="text-align:left">📧 Potwierdzenie zamówienia jest wysyłane automatycznie na e-mail klienta, jeśli bramka e-mail jest skonfigurowana.</p>
	      ${bladPaynow}
	      ${infoPlatnosci}
	      <p class="pay-note" style="margin-top:1rem"><a href="${linkPaynow?esc(linkPaynow):urlDziekujemy}" onclick="document.getElementById('modal').classList.remove('open')" style="color:var(--brand)">${linkPaynow?"Przejdź do płatności teraz →":"Przejdź do podziękowania →"}</a></p>
	    </div>`;
	    koszyk=[]; rabat=null; zapiszLS("artway_koszyk",koszyk); zapiszLS("artway_rabat",null); odswiezKoszyk();
	    setTimeout(()=>{
	      $("modal")?.classList.remove("open");
	      if(linkPaynow) location.href=linkPaynow;
	      else location.hash=urlDziekujemy;
	    }, linkPaynow?900:650);
  }catch(bl){
    loguj("blad","Błąd składania zamówienia: "+bl.message);
    toast("⚠️ Wystąpił błąd — zapisano w diagnostyce");
  }
}

/* ═══════════ UI ═══════════ */
function otworzKoszyk(){ $("drawer").classList.add("open"); $("overlay").classList.add("open"); }
function zamknijKoszyk(){ $("drawer").classList.remove("open"); $("overlay").classList.remove("open"); }
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1800); }

$("cartBtn").onclick = otworzKoszyk;
$("closeCart").onclick = zamknijKoszyk;
$("overlay").onclick = zamknijKoszyk;
$("checkoutBtn").onclick = otworzModal;
$("modal").onclick = e=>{ if(e.target.id==="modal") $("modal").classList.remove("open"); };
$("searchInput").oninput = e=>{
  fraza = e.target.value.toLowerCase();
  stronaProduktow = 1;
  if(trasa()!=="/" && trasa()!=="") location.hash="#/";
  else rysuj();
};

/* ═══════════ START ═══════════ */
(async ()=>{
  await chmuraWczytajStan();          // pobierz wspólne ustawienia z serwera — te same na każdym urządzeniu
  zastosujUstawienia();
  await zainicjujAdmina();
  await odtworzSesjeCentralna();
  odswiezUzytkownika();
  odswiezUlubioneLicznik();
  odswiezZnacznikDiag();
  wczytajProdukty();
  uruchomAutoSynchronizacjeChmury();
})();
