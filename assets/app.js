/* GENERATED FILE — edit src/frontend/*.js and run npm run build */
/* ═══════════ KONFIGURACJA ═══════════ */
const DANE_FIRMY_DOMYSLNE = {
  nazwa: "Artway-TM",
  identyfikator: "5882468333",
  nip: "5882468333",
  adres: "Gryfa Pomorskiego 1/A, 84-207 Bojano"
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
  opisSklepu: "Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów. Czytelna oferta, uczciwe ceny i szybka wysyłka.",
  heroTytul: "Wszystko, czego potrzebujesz — w jednym miejscu",
  heroOpis: "Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów — między innymi Alexander, Multigra i GoDan.",
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
const INPOST_DOMYSLNY_SP_NADANIA = "parcel_locker";
const INPOST_DOMYSLNY_PUNKT_NADANIA = "BOJ01N";
const INPOST_SP_NADANIA = {
  parcel_locker:"Nadam w automacie Paczkomat®",
  dispatch_order:"Przesyłkę odbierze kurier InPost",
  pop:"Nadam w PaczkoPunkcie"
};
const INPOST_OCHRONA_PRESETY = [
  {wartosc:"", etykieta:"Brak — jak domyślnie w Managerze"},
  {wartosc:"5000", etykieta:"Do 5 000 zł"},
  {wartosc:"10000", etykieta:"Do 10 000 zł"},
  {wartosc:"20000", etykieta:"Do 20 000 zł"}
];
function normalizujDostawyInPost(lista){
  const zrodlo = Array.isArray(lista) ? lista : [];
  const cena = (v, fallback) => { const n=Number(String(v ?? "").replace(",",".")); return Number.isFinite(n) ? +n.toFixed(2) : fallback; };
  const paczkomat = zrodlo.find(d=>d&&d.id==="paczkomat") || zrodlo.find(d=>String(d?.nazwa||"").toLowerCase().includes("paczkomat")) || {};
  const kurier = zrodlo.find(d=>d&&["kurier_inpost","kurier"].includes(d.id)) || zrodlo.find(d=>String(d?.nazwa||"").toLowerCase().includes("kurier")) || {};
  return [
    { ...DOMYSLNA_DOSTAWA_INPOST, koszt:cena(paczkomat.koszt, DOMYSLNA_DOSTAWA_INPOST.koszt), opis:String(paczkomat.opis||DOMYSLNA_DOSTAWA_INPOST.opis).trim()||DOMYSLNA_DOSTAWA_INPOST.opis },
    { ...DOMYSLNA_DOSTAWA_INPOST_KURIER, koszt:cena(kurier.koszt, DOMYSLNA_DOSTAWA_INPOST_KURIER.koszt), opis:String(kurier.opis||DOMYSLNA_DOSTAWA_INPOST_KURIER.opis).trim()||DOMYSLNA_DOSTAWA_INPOST_KURIER.opis }
  ];
}
function dostepneDostawy(){
  KONFIG.dostawy = normalizujDostawyInPost(KONFIG.dostawy);
  return KONFIG.dostawy;
}
function czyDostawaPaczkomat(id){ return String(id||"")==="paczkomat"; }
function uslugaInpostDlaDostawy(id){ return czyDostawaPaczkomat(id) ? "Paczkomat 24/7" : "Kurier InPost"; }
function oplataPaczkaWeekend(wlaczona){ return wlaczona ? OPLATA_PACZKA_WEEKEND : 0; }
function wartoscBoolInpost(v){
  const s=String(v??"").trim().toLowerCase();
  return v===true || s==="tak" || s==="true" || s==="1" || s==="yes";
}
function pobranieAktywneZamowienia(z,w=daneWysylki(z)){
  if(w && Object.prototype.hasOwnProperty.call(w,"pobranieAktywne")) return wartoscBoolInpost(w.pobranieAktywne);
  return z?.platnoscId==="pobranie";
}
function kwotaPobraniaZamowienia(z,w=daneWysylki(z)){
  if(!pobranieAktywneZamowienia(z,w)) return "";
  const zapisana=String(w?.pobranie||"").trim();
  return zapisana || kwotaNum(z?.razem).toFixed(2);
}
function inpostSposobNadania(z,w=daneWysylki(z)){
  const v=String(w?.sposobNadania||INPOST_DOMYSLNY_SP_NADANIA).trim();
  return INPOST_SP_NADANIA[v] ? v : INPOST_DOMYSLNY_SP_NADANIA;
}
function inpostSposobNadaniaLabel(v){ return INPOST_SP_NADANIA[v] || INPOST_SP_NADANIA[INPOST_DOMYSLNY_SP_NADANIA]; }
function inpostOchronaPreset(wartosc){
  const v=String(wartosc||"").replace(",",".").replace(/\s/g,"");
  return INPOST_OCHRONA_PRESETY.some(p=>p.wartosc===v) ? v : (v ? "custom" : "");
}

const DOMYSLNE_BANNERY = [
  {id:"promocje",ikona:"🔥",tytul:"Aktualne promocje",opis:"Zobacz produkty w obniżonych cenach.",przycisk:"Sprawdź promocje",link:"#/promocje",aktywny:true},
  {id:"nowosci",ikona:"✨",tytul:"Nowości w sklepie",opis:"Poznaj ostatnio dodane produkty.",przycisk:"Zobacz nowości",link:"#/nowosci",aktywny:true},
  {id:"dostawa",ikona:"🚚",tytul:"Darmowa dostawa",opis:"Dla zamówień od 200 zł.",przycisk:"Warunki dostawy",link:"#/dostawa",aktywny:true}
];
const TYPY_BANNEROW={
  "pasek-okazji":"Pasek okazji",
  hero:"Banner główny",
  sekcyjny:"Banner sekcyjny",
  kafelek:"Kafelek promocyjny",
  komunikat:"Komunikat informacyjny"
};
const MIEJSCA_BANNEROW={
  "nad-hero":"Nad bannerem głównym",
  "pod-hero":"Pod bannerem głównym",
  "sekcja-banery":"W sekcji bannerów",
  "nad-produktami":"Nad ofertą produktów",
  "pod-produktami":"Pod ofertą produktów",
  "przed-stopka":"Przed końcową sekcją strony"
};
function normalizujBaner(b={}){
  const legacyDostawa=!b.typ&&!b.szerokosc&&String(b.id||"")==="dostawa";
  const typ=TYPY_BANNEROW[b.typ]?b.typ:(legacyDostawa||b.rozmiar==="kompaktowy"&&b.styl==="informacyjny"?"komunikat":"kafelek");
  const umiejscowienie=MIEJSCA_BANNEROW[b.umiejscowienie]?b.umiejscowienie:"sekcja-banery";
  const szerokosci=["pelna","dwie-trzecie","polowa","jedna-trzecia"],wysokosci=["pasek","niski","standard","wysoki"],mobile=["pelny","kompaktowy","bez-obrazu","ukryty"];
  const szerokosc=szerokosci.includes(b.szerokosc)?b.szerokosc:(legacyDostawa||b.rozmiar==="szeroki"?"pelna":"polowa");
  const wysokosc=wysokosci.includes(b.wysokosc)?b.wysokosc:(legacyDostawa||b.rozmiar==="kompaktowy"?"niski":b.rozmiar==="szeroki"?"wysoki":"standard");
  return {...b,typ,umiejscowienie,szerokosc,wysokosc,mobileMode:mobile.includes(b.mobileMode)?b.mobileMode:"kompaktowy",zamykany:!!b.zamykany,przyklejony:typ==="pasek-okazji"&&!!b.przyklejony};
}
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
function pobierzBannery(){ return (Array.isArray(ustawienia.bannery) ? ustawienia.bannery : DOMYSLNE_BANNERY).map(normalizujBaner); }
function ustawieniaOfertyGlownej(){
  const source=ustawienia.ofertaGlowna&&typeof ustawienia.ofertaGlowna==="object"?ustawienia.ofertaGlowna:{};
  return {
    tytul:"Cała oferta",
    opis:"Porównaj produkty, dodaj wybrane do ulubionych albo od razu przejdź do koszyka.",
    zakres:"wszystkie",
    kategoria:"",
    produkty:[],
    sortowanie:"default",
    naStronie:24,
    wyborDzialu:"pod-produktami",
    filtryZaawansowane:true,
    liczniki:true,
    ...source,
    produkty:Array.isArray(source.produkty)?source.produkty.map(String):[]
  };
}
function regulyRabatowe(){
  const maZapisaneReguly=Object.prototype.hasOwnProperty.call(ustawienia,"kodyRabatoweZaawansowane");
  const advanced=Array.isArray(ustawienia.kodyRabatoweZaawansowane)?ustawienia.kodyRabatoweZaawansowane:[];
  const result=[],seen=new Set();
  for(const raw of advanced){
    const kod=String(raw?.kod||"").trim().toUpperCase();if(!/^[A-Z0-9_-]{2,30}$/.test(kod)||seen.has(kod))continue;
    seen.add(kod);result.push({typ:"procent",wartosc:0,minKoszyk:0,maxRabat:0,zakres:"wszystkie",kategorie:[],produkty:[],aktywny:true,publiczny:false,...raw,kod});
  }
  // Starsze kody są importowane tylko raz — zanim administrator zapisze nowy moduł.
  // Inaczej usunięty kod wracał z KONFIG przy każdym renderowaniu podstrony.
  for(const [kod,procent] of Object.entries(maZapisaneReguly?{}:(KONFIG.kodyRabatowe||{}))){
    const key=String(kod).toUpperCase();if(seen.has(key))continue;
    result.push({kod:key,typ:"procent",wartosc:Number(procent)||0,minKoszyk:0,maxRabat:0,zakres:"wszystkie",kategorie:[],produkty:[],aktywny:true,publiczny:true});
  }
  return result;
}
function regulaRabatowaStatus(regula,teraz=Date.now()){
  if(!regula||regula.aktywny===false)return {aktywna:false,powod:"Kod jest wyłączony"};
  const start=regula.start?Date.parse(regula.start):NaN,koniec=regula.koniec?Date.parse(regula.koniec):NaN;
  if(Number.isFinite(start)&&teraz<start)return {aktywna:false,powod:"Kod nie jest jeszcze aktywny"};
  if(Number.isFinite(koniec)&&teraz>koniec)return {aktywna:false,powod:"Kod stracił ważność"};
  const limit=Math.max(0,Number(regula.limitUzyc)||0),uzycia=Math.max(0,Number(regula.uzycia)||0);
  if(limit&&uzycia>=limit)return {aktywna:false,powod:"Limit użyć kodu został wyczerpany"};
  return {aktywna:true,powod:""};
}
function znajdzReguleRabatowa(kod){
  const key=String(kod||"").trim().toUpperCase();
  return regulyRabatowe().find(x=>x.kod===key)||null;
}
function ustawieniaPodstrony(id){ return {...(DOMYSLNE_PODSTRONY[id]||{}),...((ustawienia.podstrony||{})[id]||{})}; }
function ikonaPodstronyHTML(id){const u=ustawieniaPodstrony(id);return u.ikonaObraz?`<span class="page-ai-icon"><img src="${esc(u.ikonaObraz)}" alt="" loading="lazy"></span>`:"";}
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
function glownaPromocja(){
  const kody=KONFIG.kodyRabatowe&&typeof KONFIG.kodyRabatowe==="object"?KONFIG.kodyRabatowe:{};
  const zPaska=String(KONFIG.pasekInfo||"").match(/Kod\s*(?:<b>)?([A-Z0-9]{2,20})(?:<\/b>)?\s*=\s*[−-]?(\d{1,2})%/i);
  const kodZPaska=String(zPaska?.[1]||"").toUpperCase(),rabatZPaska=Number(zPaska?.[2]||0);
  if(kodZPaska&&Number(kody[kodZPaska])===rabatZPaska)return {kod:kodZPaska,procent:rabatZPaska};
  const wybrany=String(ustawienia?.promocjaGlowna||"").toUpperCase();
  const regula=znajdzReguleRabatowa(wybrany)||regulyRabatowe().find(x=>x.publiczny&&x.typ==="procent"&&regulaRabatowaStatus(x).aktywna);
  if(regula&&regula.typ==="procent"&&Number(regula.wartosc)>0)return {kod:regula.kod,procent:Number(regula.wartosc)};
  if(wybrany&&Number(kody[wybrany])>0)return {kod:wybrany,procent:Number(kody[wybrany])};
  const pierwszy=Object.entries(kody).find(([kod,procent])=>/^[A-Z0-9]{2,20}$/.test(kod)&&Number(procent)>0);
  return pierwszy?{kod:pierwszy[0],procent:Number(pierwszy[1])}:null;
}
function tekstGlownejPromocji(){
  const p=glownaPromocja();
  return p?`Kod <b>${p.kod}</b> = −${p.procent}%`:"";
}
function pasekInfoHTML(){
  const promocja=tekstGlownejPromocji();
  const domyslny=`🚚 Darmowa dostawa od ${KONFIG.darmowaDostawaOd} zł &nbsp;•&nbsp; 📦 ${tekstWysylki()} &nbsp;•&nbsp; ↩️ 14 dni na zwrot${promocja?` &nbsp;•&nbsp; 🎁 ${promocja}`:""}`;
  let t=String(KONFIG.pasekInfo||domyslny);
  t=t.replace(/Darmowa dostawa od\s*\d+(?:[,.]\d+)?\s*zł/gi,`Darmowa dostawa od ${KONFIG.darmowaDostawaOd} zł`);
  t=t.replace(/Wysyłka w\s*\d+\s*(?:h|godziny|godzin|godz\.?)(?:\s*robocze)?/gi,tekstWysylki());
  t=t.replace(/Wysylka w\s*\d+\s*(?:h|godziny|godzin|godz\.?)(?:\s*robocze)?/gi,tekstWysylki("Wysylka w"));
  if(promocja)t=t.replace(/Kod\s*(?:<b>)?[A-Z0-9]{2,20}(?:<\/b>)?\s*=\s*[−-]?\d{1,2}%/gi,promocja);
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
let allegroZamowienia = [];
let allegroOferty = [];
// Duże rejestry Allegro są cache'em bieżącej sesji, nie localStorage. Przy
// dziesiątkach tysięcy ofert parsowanie wielomegabajtowego JSON-u blokowało
// start i przełączanie kart panelu.
let allegroMapowania = {};
try{["artway_allegro_zamowienia_cache","artway_allegro_oferty_cache","artway_allegro_mapowania_cache","artway_allegro_komunikacja_cache"].forEach(k=>localStorage.removeItem(k));}catch(e){}
let allegroKomunikacja = {threads:[],issues:[],settings:null,autoReplies:{},errors:[],requiresReauth:false,updated_at:null,lastSyncSummary:null,sprawdzono:false};
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
let allegroStan = {sprawdzono:false, configured:false, connected:false, env:"production", error:"", updated_at:null, autonomousAgent:{enabled:true,status:"waiting",completedAt:null,nextRunAt:null,mapping:{},stats:{},duplicateGroupsResolved:0,duplicateOffersEnded:0,reviewCount:0}, offerDefaultsAudit:{items:{},updated_at:null}, catalogMaintenance:{cursor:0,lastRun:null}, complianceAudit:{items:[],summary:{},updated_at:null}, offerSyncState:{lastLightSyncAt:null,lastFullSyncAt:null,nextLightSyncAt:null,nextFullSyncAt:null,lastSource:null,lastResult:null}, offerSettings:{defaultStock:5,republish:true,producers:["Alexander","Multigra","GoDan"],autoCatalog:true,syncDescriptions:true,autoUpdateOffers:true,autoFees:true,autoCorrections:true,autoMapping:true,mappingMinScore:88,lightSyncMinutes:15,fullSyncHours:6,autonomousAgent:true,autonomousAgentMinutes:15,autoResolveDuplicates:true,autoResolveDuplicateMinScore:97,updated_at:null}};
let allegroDaneZaladowane={summary:false,orders:false,offers:false,config:false};
let allegroDaneLadowane=new Set();
let allegroDaneOdczytAt={summary:0,orders:0,offers:0,config:0};
let allegroDaneObietnice=new Map();
let allegroPodsumowanie={orders:{live:0,active:0,statusCounts:{},archived:0,retentionDays:30,updated_at:null},offers:{count:0,updated_at:null},recentOrders:[]};
let allegroArchiwum={loaded:false,busy:false,items:[],summary:{total:0,months:[],retentionDays:30,updated_at:null},month:"",offset:0,hasMore:false,error:""};
let allegroOperacjaUstawien = {busy:false,done:0,total:0,stockUpdated:0,stockFailed:0,republishUpdated:0,republishFailed:0,error:""};
let allegroMapowanieMasowe={busy:false,total:0,mapped:0,skipped:0,error:""};
let allegroWycofywanieOfert={busy:false,step:"idle",ids:[],reason:"admin_decision",error:"",results:[]};
let szukajAllegroZamowien="", szukajAllegroOfert="", szukajAllegroWystawiania="", szukajAllegroWiadomosci="", szukajAllegroDyskusji="", szukajAllegroRentownosc="", szukajAllegroZgodnosc="", filtrAllegroZamowien="do_obslugi", filtrEtapuAllegroZamowien="wszystkie", filtrAllegroOfert="problemy", filtrStatusuAllegroOfert="aktywne", filtrAllegroWystawiania="wszystkie", filtrAllegroWiadomosci="wymaga", filtrAllegroDyskusji="aktywne", filtrAllegroRentownosc="niesprawdzone", filtrAllegroZgodnosc="naruszenia", sortAllegroOfert="priorytet", sortAllegroWiadomosci="najnowsze", sortAllegroDyskusje="najnowsze", sortAllegroRentownosc="marza_rosnaco", allegroZgodnoscBusy=false, allegroDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzyAllegro??wczytajLS("artway_cel_marzy_allegro",20))||20)), sklepDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzySklep??wczytajLS("artway_cel_marzy_sklep",20))||20)), allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Number(ustawienia.allegroJednostkiOplatCyklicznych)||10)), allegroLimitWidokuZamowien=100, allegroLimitWidokuOfert=100, allegroLimitWystawiania=250, allegroLimitKomunikacji=50;
let filtrAgentAIProdukty="wszystkie", zaznaczoneRentownosc=new Set();
let infaktStan={sprawdzono:false,ladowanie:false,invoicesLoaded:false,costsLoaded:false,costsLoading:false,purchaseLoading:false,configured:false,connected:false,env:"production",error:"",links:{},suppliers:{items:[]},purchaseSync:{pendingItems:[],recentMatches:[]},updated_at:null};
let infaktFaktury=[],infaktKoszty=[],szukajInfakt="",filtrInfakt="wszystkie",infaktLimit=50,infaktOkresCenZakupu=180;
let szukajInfaktZakupy="",filtrInfaktZakupy="wszystkie",limitInfaktZakupy=50,szukajInfaktHistoria="",filtrInfaktHistoria="aktywne",limitInfaktHistoria=50;
let zaznaczoneInfaktZakupy=new Set(),zaznaczoneInfaktHistoria=new Set(),zaznaczoneMagazynProdukty=new Set(),magazynWynikiIds=[],magazynStronaIds=[],zaznaczoneDostepnoscProducentow=new Set(),dostepnoscProducentowWynikiIds=[],dostepnoscProducentowStronaIds=[],zaznaczeniKlienci=new Set();
let agentAIPlanProfil=["full","data","health"].includes(wczytajLS("artway_agent_plan_profil","full"))?wczytajLS("artway_agent_plan_profil","full"):"full";
let agentAIPlanStan={busy:false,current:"",startedAt:null,completedAt:null,results:[],error:"",profile:agentAIPlanProfil,runId:"",history:[],historyLoading:false};
let agentAIRuntime={loading:false,loaded:false,error:"",runtime:null,updatedAt:0,pollTimer:null};
let agentAISpecjalisci={loading:false,loaded:false,saving:false,running:false,error:"",data:null,activeRun:null};
let agentAISpecjalistaDecyzjeWToku=new Set();
let agentAITelegram={loading:false,loaded:false,saving:false,error:"",settings:null,status:null,stats:{},state:{},events:[],history:[],quietNow:false};

/* ═══════════ WSPÓLNA BAZA SERWEROWA (Netlify Functions + Blobs) ═══════════
   Ustawienia sklepu, zamówienia i klienci są zapisywane na serwerze, więc są
   widoczne na KAŻDYM urządzeniu. Bez połączenia z serwerem sklep dalej działa
   na pamięci przeglądarki (localStorage) jak dotychczas. */
const CHMURA_URL = "/.netlify/functions/store";
const CHMURA_AUTO_SYNC_MS = 15*60*1000;
const CHMURA_FOCUS_SYNC_MIN_MS = 5*60*1000;
const KLUCZE_WSPOLNE = ["artway_ustawienia","artway_produkty_dodane","artway_produkty_edytowane","artway_produkty_katalog","artway_produkty_ukryte","artway_produkty_definitywne","artway_stany","artway_dostepnosc","artway_ruchy_magazynowe","artway_magazyn_ustawienia","artway_magazyn_produkty","artway_magazyn_lokalizacje","artway_faktury_szkice","artway_agent_ai_historia","artway_agent_ai_pamiec","artway_agent_ai_zlecenia","artway_agent_ai_plan_cykl","artway_producenci","artway_agent_ai_linki_producentow","artway_agent_ai_allegro_zadania","artway_opinie","artway_kosz_dodane","artway_kosz_meta","artway_seo_ustawienia","artway_seo_historia"];
let chmuraToken = (function(){
  try{
    const token=sessionStorage.getItem("artway_chmura_token")||"";
    localStorage.removeItem("artway_chmura_token");
    return token;
  }catch(e){ return ""; }
})();
let chmuraStan = {dostepna:false, sprawdzono:false, admin:false, rev:0, updated_at:null, error:"", ostatniZapis:0};
let chmuraWczytywanie = false;   // blokada pętli podczas nakładania danych z serwera
let chmuraTimerZapisu = null;
let chmuraTimerAutoSync = null;
let chmuraAutoSyncBusy = false;
let chmuraAutoSyncOstatniStart = 0;
let chmuraOstatniPullZmienilDane = false;
let chmuraOstatniaSynchronizacjaCentralnaZmienilaDane = false;
let chmuraKatalogImportowanyRev = "";
const CHMURA_KATALOG_CACHE_DB = "artway-runtime-cache";
const CHMURA_KATALOG_CACHE_STORE = "catalogs";
const CHMURA_KATALOG_CACHE_KEY = "imported-products-v1";
let chmuraKatalogCacheBazaPromise = null;
let chmuraBrudneKlucze = new Set();
let chmuraZapisWToku = null;
let chmuraZapisPonowPoZakonczeniu = false;
let chmuraNumerMutacji = 0;
let chmuraPobraniaWToku = new Map();
function chmuraKatalogCacheBaza(){
  if(chmuraKatalogCacheBazaPromise)return chmuraKatalogCacheBazaPromise;
  if(typeof indexedDB==="undefined")return Promise.resolve(null);
  chmuraKatalogCacheBazaPromise=new Promise(resolve=>{
    let zakonczono=false,finish=value=>{if(zakonczono)return;zakonczono=true;resolve(value);};
    try{
      const request=indexedDB.open(CHMURA_KATALOG_CACHE_DB,1);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(CHMURA_KATALOG_CACHE_STORE))db.createObjectStore(CHMURA_KATALOG_CACHE_STORE);};
      request.onsuccess=()=>finish(request.result);
      request.onerror=()=>finish(null);
      request.onblocked=()=>finish(null);
    }catch(e){finish(null);}
  });
  return chmuraKatalogCacheBazaPromise;
}
async function chmuraKatalogCacheOdczytaj(){
  return chmuraRuntimeCacheOdczytaj(CHMURA_KATALOG_CACHE_KEY);
}
async function chmuraKatalogCacheZapisz(revision,products){
  return chmuraRuntimeCacheZapisz(CHMURA_KATALOG_CACHE_KEY,{revision:String(revision||""),count:Array.isArray(products)?products.length:0,products:Array.isArray(products)?products:[],savedAt:Date.now()});
}
async function chmuraRuntimeCacheOdczytaj(key){
  const db=await chmuraKatalogCacheBaza();if(!db)return false;
  return new Promise(resolve=>{try{const tx=db.transaction(CHMURA_KATALOG_CACHE_STORE,"readonly"),request=tx.objectStore(CHMURA_KATALOG_CACHE_STORE).get(String(key));request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>resolve(null);}catch(e){resolve(null);}});
}
async function chmuraRuntimeCacheZapisz(key,value){
  const db=await chmuraKatalogCacheBaza();if(!db)return false;
  return new Promise(resolve=>{try{const tx=db.transaction(CHMURA_KATALOG_CACHE_STORE,"readwrite");tx.objectStore(CHMURA_KATALOG_CACHE_STORE).put(value,String(key));tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);}catch(e){resolve(false);}});
}
async function chmuraRuntimeCacheUsun(key){
  const db=await chmuraKatalogCacheBaza();if(!db)return false;
  return new Promise(resolve=>{try{const tx=db.transaction(CHMURA_KATALOG_CACHE_STORE,"readwrite");tx.objectStore(CHMURA_KATALOG_CACHE_STORE).delete(String(key));tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false);}catch(e){resolve(false);}});
}
async function chmuraPobierzKatalogImportowany(meta={},force=false){
  const revision=String(meta.imported_catalog_rev||""),count=Math.max(0,Number(meta.imported_catalog_count)||0);
  if(!force&&revision===chmuraKatalogImportowanyRev)return false;
  if(!force&&typeof productLinkImportStan!=="undefined"&&productLinkImportStan.loopActive)return false;
  if(!count){produktyImportowane=[];chmuraKatalogImportowanyRev=revision;chmuraKatalogCacheZapisz(revision,[]).catch(()=>{});return true;}
  if(!force){
    const cache=await chmuraKatalogCacheOdczytaj();
    if(cache&&String(cache.revision||"")===revision&&Number(cache.count)===count&&Array.isArray(cache.products)&&cache.products.length===count){
      produktyImportowane=cache.products;
      chmuraKatalogImportowanyRev=revision;
      return true;
    }
  }
  const pageSize=500,offsets=[];for(let offset=0;offset<count;offset+=pageSize)offsets.push(offset);
  const pages=[];
  for(let start=0;start<offsets.length;start+=4){
    const batch=await Promise.all(offsets.slice(start,start+4).map(offset=>chmura("product-link-import-catalog",{params:{offset,limit:pageSize,catalogRev:revision},timeout:30000})));
    pages.push(...batch);
  }
  if(pages.some(page=>String(page.imported_catalog_rev||"")!==revision))throw new Error("Katalog produktów zmienił się podczas pobierania — ponowię synchronizację.");
  const imported=pages.flatMap(page=>Array.isArray(page.products)?page.products:[]).slice(0,count);
  if(imported.length!==count)throw new Error("Katalog produktów nie jest jeszcze kompletny — ponowię synchronizację.");
  produktyImportowane=imported;
  chmuraKatalogImportowanyRev=revision;
  chmuraKatalogCacheZapisz(revision,imported).catch(()=>{});
  return true;
}
function maUprawnieniaZapisuChmury(){
  return !!(chmuraToken||(sesja?.token&&typeof jestAdmin==="function"&&jestAdmin()));
}


function chmuraNaglowki(json){
  const h={"Accept":"application/json"};
  if(json) h["Content-Type"]="application/json";
  if(chmuraToken) h["x-admin-token"]=chmuraToken;
  if(sesja?.token) h.Authorization=`Bearer ${sesja.token}`;
  return h;
}
async function chmura(action, {method="GET", body=null, params={}, timeout=9000}={}){
  const url = new URL(CHMURA_URL, location.href);
  url.searchParams.set("action", action);
  for(const [k,v] of Object.entries(params)) if(v!==undefined&&v!==null&&v!=="") url.searchParams.set(k,String(v));
  const requestKey=method==="GET"&&body===null?url.toString():"",istniejace=requestKey?chmuraPobraniaWToku.get(requestKey):null;
  if(istniejace)return istniejace;
  const request=(async()=>{
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
  })();
  if(requestKey)chmuraPobraniaWToku.set(requestKey,request);
  try{return await request;}finally{if(requestKey&&chmuraPobraniaWToku.get(requestKey)===request)chmuraPobraniaWToku.delete(requestKey);}
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
  const katalogAllegro=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&!jestProduktemImportowanym(p.id)).map(p=>({
    id:p.id,nazwa:p.nazwa||"",opisKrotki:p.opisKrotki||p.krotkiOpis||"",opis:p.opis||"",kategoria:p.kategoria||"",zdjecie:p.zdjecie||"",zdjecia:Array.isArray(p.zdjecia)?p.zdjecia.slice(0,15):[],ikona:p.ikona||"",sku:p.sku||"",externalId:p.externalId||"",gtin:p.gtin||p.ean||"",ean:p.ean||p.gtin||"",kodProducenta:p.kodProducenta||p.mpn||"",mpn:p.mpn||p.kodProducenta||"",producent:p.producent||p.marka||"",marka:p.marka||p.producent||"",cena:p.cena||0,cenaAllegro:p.cenaAllegro||0,cenaZakupu:p.cenaZakupu||0,allegroOfferId:p.allegroOfferId||"",producentUrl:p.producentUrl||p.sourceUrl||"",sourceUrl:p.sourceUrl||p.producentUrl||"",sourceEvidence:p.sourceEvidence||null,parametryProducenta:p.parametryProducenta||null,parametryZrodla:p.parametryZrodla||null,agentImportAt:p.agentImportAt||"",agentImportConfidence:Number(p.agentImportConfidence)||0,agentImportSource:p.agentImportSource||"",agentImportUrl:p.agentImportUrl||"",dostepnoscProducenta:p.dostepnoscProducenta||"",stanProducenta:p.stanProducenta??"",stanProducentaDokladny:!!p.stanProducentaDokladny,stanProducentaZrodlo:p.stanProducentaZrodlo||"",producentStatus:p.producentStatus||"",producentSprawdzonoAt:p.producentSprawdzonoAt||"",producentOstatniBlad:p.producentOstatniBlad||"",producentAlertAktywny:!!p.producentAlertAktywny,allegroCommissionAmount:p.allegroCommissionAmount||0,allegroCommissionRate:p.allegroCommissionRate||0,allegroRecurringFees:p.allegroRecurringFees||0,allegroFeeCalculatedAt:p.allegroFeeCalculatedAt||"",allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI,kosztPakowania:p.kosztPakowania||0,sklepAdditionalCost:p.sklepAdditionalCost||0,sklepPaymentPercent:p.sklepPaymentPercent||0,allegroAdditionalCost:p.allegroAdditionalCost||0,allegroAdsPercent:p.allegroAdsPercent||0,seoTitle:p.seoTitle||"",seoDescription:p.seoDescription||"",seoKeywords:p.seoKeywords||"",seoScore:Number(p.seoScore)||0,seoReviewedAt:p.seoReviewedAt||"",seoSource:p.seoSource||"",seoMode:p.seoMode||"auto",seoPromoted:!!p.seoPromoted
  }));
  return {
    artway_ustawienia: ustawienia,
    artway_produkty_dodane: produktyDodane,
    artway_produkty_edytowane: produktyEdytowane,
    artway_produkty_katalog: katalogAllegro,
    artway_produkty_ukryte: produktyUkryte,
    artway_produkty_definitywne: produktyDefinitywne,
    artway_stany: stanyProduktow,
    artway_dostepnosc: dostepnoscProduktow,
    artway_ruchy_magazynowe: ruchyMagazynowe,
    artway_magazyn_ustawienia: ustawieniaMagazynu,
    artway_magazyn_produkty: magazynProdukty,
    artway_magazyn_lokalizacje: magazynLokalizacje,
    artway_faktury_szkice: szkiceFaktur,
    artway_agent_ai_historia: agentAIHistoria,
    artway_agent_ai_pamiec: agentAIPamiec,
    artway_agent_ai_zlecenia: agentAIZlecenia,
    artway_agent_ai_plan_cykl: agentAIPlanCykl,
    artway_producenci: producenciKartoteka,
    artway_agent_ai_linki_producentow: agentAILinkiProducentow,
    artway_agent_ai_allegro_zadania: agentAIAllegroZadania,
    artway_opinie: opinie,
    artway_kosz_dodane: koszDodanych,
    artway_kosz_meta: koszMeta,
    artway_seo_ustawienia: seoUstawienia,
    artway_seo_historia: seoHistoria,
  };
}
function nalozWspolneUstawienia(dane){
  if(!dane || typeof dane!=="object") return false;
  let zmieniono=false;
  chmuraWczytywanie = true;
  try{
    if(dane.artway_ustawienia && typeof dane.artway_ustawienia==="object"){
      ustawienia = {...USTAWIENIA_PUBLICZNE, ...dane.artway_ustawienia};
      zmieniono=zapiszLS("artway_ustawienia", ustawienia)||zmieniono;
      sklepDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzySklep)||sklepDocelowaMarza||20));
      allegroDocelowaMarza=Math.max(1,Math.min(60,Number(ustawienia.celMarzyAllegro)||allegroDocelowaMarza||20));
      allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Number(ustawienia.allegroJednostkiOplatCyklicznych)||allegroJednostkiOplatCyklicznych||10));
    }
    const setter = {
      artway_produkty_dodane:(v)=>{produktyDodane=v;}, artway_produkty_ukryte:(v)=>{produktyUkryte=v;},
      artway_produkty_edytowane:(v)=>{produktyEdytowane=v;}, artway_produkty_definitywne:(v)=>{produktyDefinitywne=v;},
      artway_stany:(v)=>{stanyProduktow=v;}, artway_dostepnosc:(v)=>{dostepnoscProduktow=(v&&typeof v==="object")?v:{};},
      artway_ruchy_magazynowe:(v)=>{ruchyMagazynowe=Array.isArray(v)?v:[];},
      artway_magazyn_ustawienia:(v)=>{ustawieniaMagazynu=(v&&typeof v==="object")?v:{};}, artway_magazyn_produkty:(v)=>{magazynProdukty=(v&&typeof v==="object")?v:{};},
      artway_magazyn_lokalizacje:(v)=>{magazynLokalizacje=Array.isArray(v)?v:[];},
      artway_faktury_szkice:(v)=>{szkiceFaktur=Array.isArray(v)?v:[];}, artway_agent_ai_historia:(v)=>{agentAIHistoria=Array.isArray(v)?v:[];},
      artway_agent_ai_pamiec:(v)=>{agentAIPamiec=Array.isArray(v)?v:[];},
      artway_agent_ai_zlecenia:(v)=>{agentAIZlecenia=Array.isArray(v)?v:[];},
      artway_agent_ai_plan_cykl:(v)=>{agentAIPlanCykl=(v&&typeof v==="object"&&!Array.isArray(v))?v:{};},
      artway_producenci:(v)=>{producenciKartoteka=Array.isArray(v)?v:[];},
      artway_agent_ai_linki_producentow:(v)=>{agentAILinkiProducentow=Array.isArray(v)?v:[];},
      artway_agent_ai_allegro_zadania:(v)=>{agentAIAllegroZadania=Array.isArray(v)?v:[];},
      artway_opinie:(v)=>{opinie=v;},
      artway_kosz_dodane:(v)=>{koszDodanych=v;}, artway_kosz_meta:(v)=>{koszMeta=v;},
      artway_seo_ustawienia:(v)=>{seoUstawienia={...SEO_USTAWIENIA_DOMYSLNE,...((v&&typeof v==="object")?v:{})};},
      artway_seo_historia:(v)=>{seoHistoria=Array.isArray(v)?v:[];},
    };
    for(const k of Object.keys(setter)){
      if(k in dane && dane[k]!==undefined && dane[k]!==null){ setter[k](dane[k]); zmieniono=zapiszLS(k, dane[k])||zmieniono; }
    }
    return zmieniono;
  } finally { chmuraWczytywanie = false; }
}
function chmuraPominBrudneDaneSerwera(dane={}){
  if(!maUprawnieniaZapisuChmury()||!chmuraBrudneKlucze.size)return dane;
  return Object.fromEntries(Object.entries(dane||{}).filter(([klucz])=>!chmuraBrudneKlucze.has(klucz)));
}
async function chmuraWczytajStan(){
  chmuraOstatniPullZmienilDane=false;
  try{
    const lokalnaRewizja=Math.max(0,Number(wczytajLS("artway_chmura_rev",0))||0);
    const d = await chmura("pull",{params:{catalogRev:chmuraKatalogImportowanyRev,...(lokalnaRewizja?{settingsRev:lokalnaRewizja}:{})}});
    chmuraOstatniPullZmienilDane=(await chmuraPobierzKatalogImportowany(d))||chmuraOstatniPullZmienilDane;
    chmuraStan = {...chmuraStan, dostepna:true, sprawdzono:true, rev:d.rev||0, updated_at:d.updated_at||null, error:""};
    const revLok = lokalnaRewizja;
    const serwerNowszy = (d.rev||0) > revLok;
    // Klient (bez tokenu): serwer jest źródłem prawdy → zawsze nakładaj.
    // Admin (z tokenem): nakładaj TYLKO gdy serwer ma nowszą wersję niż ostatnio zsynchronizowana —
    // dzięki temu wczytanie strony NIE kasuje świeżych, jeszcze niewysłanych zmian admina.
    if(d.settings && Object.keys(d.settings).length && (!maUprawnieniaZapisuChmury() || serwerNowszy)){
      chmuraOstatniPullZmienilDane=nalozWspolneUstawienia(chmuraPominBrudneDaneSerwera(d.settings))||chmuraOstatniPullZmienilDane;
      zapiszLS("artway_chmura_rev", d.rev||0);
    }
    if(Array.isArray(d.deleted_orders)) scalUsunieteZamowienia(d.deleted_orders);
    if(Array.isArray(d.orders)){ chmuraOstatniPullZmienilDane=zapiszLS("artway_zamowienia", filtrujAktywneZamowienia(d.orders))||chmuraOstatniPullZmienilDane; chmuraStan.admin=true; }
    if(Array.isArray(d.users)){ chmuraOstatniPullZmienilDane=zapiszLS("artway_uzytkownicy", polaczUzytkownikowCentralnych(d.users))||chmuraOstatniPullZmienilDane; chmuraStan.admin=true; }
    return true;
  }catch(e){ chmuraStan = {...chmuraStan, dostepna:false, sprawdzono:true, error:e.message}; return false; }
}
function zaplanujZapisUstawien(){
  if(!maUprawnieniaZapisuChmury()) return;
  clearTimeout(chmuraTimerZapisu);
  chmuraTimerZapisu = setTimeout(chmuraZapiszUstawienia, 1200);
}
async function chmuraZapiszUstawienia(opcje={}){
  if(!maUprawnieniaZapisuChmury()) return false;
  if(chmuraZapisWToku){chmuraZapisPonowPoZakonczeniu=true;return chmuraZapisWToku;}
  chmuraZapisWToku=(async()=>{
    const snapshot=zbierzWspolneUstawienia(),klucze=(opcje.all===true?KLUCZE_WSPOLNE:[...chmuraBrudneKlucze]).filter(k=>Object.prototype.hasOwnProperty.call(snapshot,k));
    if(!klucze.length)return true;
    const patch=Object.fromEntries(klucze.map(k=>[k,snapshot[k]])),odciski=Object.fromEntries(klucze.map(k=>[k,JSON.stringify(snapshot[k])]));
    const expectedRev=Number(chmuraStan.rev||wczytajLS("artway_chmura_rev",0))||0,mutationId=`web-${Date.now().toString(36)}-${(++chmuraNumerMutacji).toString(36)}`;
    try{
      const d=await chmura("settings",{method:"POST",body:{mode:"patch",patch,expectedRev,mutationId},timeout:30000});
      chmuraStan={...chmuraStan,dostepna:true,admin:true,rev:d.rev||chmuraStan.rev,updated_at:d.updated_at||null,error:"",ostatniZapis:Date.now()};
      localStorage.setItem("artway_chmura_rev",JSON.stringify(d.rev||chmuraStan.rev));
      const teraz=zbierzWspolneUstawienia();
      for(const k of klucze)if(JSON.stringify(teraz[k])===odciski[k])chmuraBrudneKlucze.delete(k);
      return true;
    }catch(e){
      chmuraStan={...chmuraStan,error:e.message};
      if(e.code==="auth")toast("⚠️ Hasło bazy nieprawidłowe — ustawienia nie zapisały się w chmurze");
      else if(e.code==="settings_write_conflict")toast("⚠️ Serwer jest zajęty inną zmianą — dane lokalne zostały zachowane i zapis zostanie ponowiony.");
      loguj("blad","Zapis ustawień w chmurze: "+e.message);return false;
    }
  })();
  try{return await chmuraZapisWToku;}finally{
    chmuraZapisWToku=null;
    if(chmuraBrudneKlucze.size||chmuraZapisPonowPoZakonczeniu){chmuraZapisPonowPoZakonczeniu=false;clearTimeout(chmuraTimerZapisu);chmuraTimerZapisu=setTimeout(chmuraZapiszUstawienia,1200);}
  }
}
// Ręczne WYSŁANIE całego sklepu z tego urządzenia na serwer (dla wszystkich).
async function chmuraWyslijWszystko(){
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
  toast("Wysyłanie na serwer…");
  const okU = await chmuraZapiszUstawienia({all:true});
  await synchronizujBazeCentralna(true).catch(()=>{});
  if(okU) toast("📤 Cały sklep wysłany na serwer — widoczny na każdym urządzeniu ✅");
  else toast("⚠️ Nie udało się wysłać — sprawdź hasło bazy");
  renderuj();
}
// Ręczne POBRANIE sklepu z serwera i nałożenie na to urządzenie.
async function chmuraPobierzWszystko(){
  try{
    const d = await chmura("pull",{params:{catalogRev:""}});
    await chmuraPobierzKatalogImportowany(d,true);
    chmuraBrudneKlucze.clear();
    if(d.settings && Object.keys(d.settings).length){ nalozWspolneUstawienia(d.settings); zapiszLS("artway_chmura_rev", d.rev||0); }
    chmuraStan = {...chmuraStan, dostepna:true, rev:d.rev||0, updated_at:d.updated_at||null, error:""};
    if(chmuraToken) await synchronizujBazeCentralna(true).catch(()=>{});
    zastosujUstawienia(); zbudujProdukty();
    odswiezMenu(); odswiezKoszyk();
    toast("📥 Pobrano sklep z serwera ✅"); renderuj();
  }catch(e){ toast("Błąd pobierania: "+e.message); }
}
function chmuraUstawToken(){
  if(maUprawnieniaZapisuChmury()){
    toast("Trwała sesja administratora jest aktywna ✅");
    return;
  }
  toast("Zaloguj się jako administrator — połączenie z serwerem odnowi się automatycznie.");
  location.hash="#/logowanie";
}
function chmuraWyczyscToken(){ chmuraToken=""; try{sessionStorage.removeItem("artway_chmura_token");localStorage.removeItem("artway_chmura_token");}catch(e){} chmuraStan={...chmuraStan,admin:false}; toast("Odłączono hasło bazy"); renderuj(); }
function chmuraStatusHTML(){
  const ok = chmuraStan.dostepna, adm = chmuraStan.admin && maUprawnieniaZapisuChmury();
  const kolor = adm?"#166534":(ok?"#92400e":"#b91c1c"), tlo = adm?"#f0fdf4":(ok?"#fffbeb":"#fef2f2"), br = adm?"#86efac":(ok?"#fcd34d":"#fecaca");
  const opis = adm ? `<b>Połączono trwale ✅</b> — podpisana sesja administratora odnawia się automatycznie, a zmiany zapisują się na serwerze i są widoczne na każdym urządzeniu.${chmuraStan.updated_at?` Ostatni zapis: ${new Date(chmuraStan.updated_at).toLocaleString("pl-PL")}.`:""} Synchronizacja odświeża dane co ${Math.round(CHMURA_AUTO_SYNC_MS/60000)} min.`
    : ok ? `<b>⚠️ Wymagane logowanie administratora</b> — zaloguj się normalnie do panelu. Nie trzeba wklejać żadnego tokenu.`
    : "Brak połączenia z serwerem — sklep działa lokalnie w tej przeglądarce.";
  return `<div class="backend-note" style="border-color:${br};background:${tlo};color:${kolor}">
    <b>☁️ Wspólna baza:</b> ${opis}
    <div class="diag-actions" style="margin-top:.5rem">
    ${adm?`<button class="btn" style="background:var(--brand2)" onclick="chmuraWyslijWszystko()">📤 Wyślij wszystko na serwer</button>
      <button class="btn ghost" onclick="chmuraPobierzWszystko()">📥 Pobierz z serwera</button>
      <button class="btn ghost" onclick="typeof chmuraOdswiezSesjeAdministratora==='function'&&chmuraOdswiezSesjeAdministratora(true).then(()=>toast('Sesja odnowiona ✅'))">Odśwież sesję</button>`
      :`<a class="btn" href="#/logowanie">🔐 Zaloguj administratora</a>`}
    </div>
  </div>`;
}

const KLUCZE_PRZESTARZALYCH_CACHE = [
  "artway_allegro_oferty_cache",
  "artway_allegro_zamowienia_cache",
  "artway_allegro_mapowania_cache",
  "artway_allegro_komunikacja_cache"
];
function rozmiarLokalnejPamieci(){
  let n=0;
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||"",v=localStorage.getItem(k)||"";n+=(k.length+v.length)*2;}}catch(e){}
  return n;
}
function zwolnijPamiecPodreczna({wymus=false}={}){
  const przed=rozmiarLokalnejPamieci();
  if(!wymus&&przed<7_500_000)return {przed,po:przed,usunieto:[]};
  const usunieto=[];
  for(const klucz of KLUCZE_PRZESTARZALYCH_CACHE){
    try{if(localStorage.getItem(klucz)!==null){localStorage.removeItem(klucz);usunieto.push(klucz);}}catch(e){}
  }
  try{
    const logi=JSON.parse(localStorage.getItem("artway_logi")||"[]");
    if(Array.isArray(logi)&&logi.length>80){localStorage.setItem("artway_logi",JSON.stringify(logi.slice(0,80)));usunieto.push("artway_logi:archiwum");}
  }catch(e){}
  return {przed,po:rozmiarLokalnejPamieci(),usunieto};
}
function wczytajLS(klucz, domyslne){ try{ return JSON.parse(localStorage.getItem(klucz)) ?? domyslne; }catch(e){ return domyslne; } }
// Rewizja danych zasila lekki cache podstron administratora. Zmieniamy ją
// wyłącznie dla danych biznesowych, nie dla kosmetycznych preferencji widoku.
var adminRewizjaDanych = 0;
var adminCachePodstron = new Map();
var adminRewizjeDomenCache = {catalog:0,orders:0,warehouse:0,allegro:0,agent:0,infakt:0,seo:0,settings:0,system:0};
const ADMIN_KLUCZE_WIDOKU = new Set([
  "artway_admin_menu_otwarta_v2","artway_admin_menu_kompaktowe_v1",
  "artway_produkty_na_stronie_admin","artway_produkty_gestosc_admin",
  "artway_produkty_sortowanie_admin","artway_seo_na_stronie"
]);
function kluczZmieniaDaneAdmina(klucz=""){
  if(ADMIN_KLUCZE_WIDOKU.has(klucz))return false;
  return ["artway_ustawienia","artway_produkty","artway_zamowienia","artway_uzytkownicy","artway_stany","artway_dostepnosc","artway_ruchy_magazynowe","artway_magazyn","artway_faktury","artway_agent","artway_producenci","artway_opinie","artway_kosz","artway_seo"].some(prefix=>String(klucz).startsWith(prefix));
}
function adminDomenaCacheDlaKlucza(klucz=""){
  const value=String(klucz||"");
  if(value==="allegro"||value.startsWith("artway_allegro"))return "allegro";
  if(value.startsWith("artway_zamowienia")||value.startsWith("artway_uzytkownicy"))return "orders";
  if(value.startsWith("artway_stany")||value.startsWith("artway_dostepnosc")||value.startsWith("artway_ruchy_magazynowe")||value.startsWith("artway_magazyn")||value.startsWith("artway_producenci"))return "warehouse";
  if(value.startsWith("artway_agent"))return "agent";
  if(value.startsWith("artway_faktury")||value.startsWith("artway_infakt"))return "infakt";
  if(value.startsWith("artway_seo"))return "seo";
  if(value.startsWith("artway_ustawienia"))return "settings";
  if(value.startsWith("artway_produkty")||value.startsWith("artway_opinie")||value.startsWith("artway_kosz"))return "catalog";
  return "system";
}
function uniewaznijCachePodstronAdmina(zakres="all"){
  adminRewizjaDanych++;
  const domena=zakres==="all"||!zakres?"all":adminDomenaCacheDlaKlucza(zakres);
  if(domena==="all"){
    Object.keys(adminRewizjeDomenCache).forEach(key=>adminRewizjeDomenCache[key]++);adminCachePodstron.clear();
  }else{
    adminRewizjeDomenCache[domena]=(Number(adminRewizjeDomenCache[domena])||0)+1;
    for(const [route,entry] of adminCachePodstron)if((entry?.domains||[]).includes(domena))adminCachePodstron.delete(route);
  }
  if(typeof uniewaznijAdminMenuStatCache==="function")uniewaznijAdminMenuStatCache();
}
function zapiszLS(klucz, dane){
  if(klucz==="artway_zamowienia" && Array.isArray(dane)) dane = filtrujAktywneZamowienia(dane);
  const serial=JSON.stringify(dane);
  let zmieniono=true;
  try{
    if(localStorage.getItem(klucz)===serial)zmieniono=false;
    else localStorage.setItem(klucz, serial);
  }
  catch(e){
    const wynik=zwolnijPamiecPodreczna({wymus:true});
    try{localStorage.setItem(klucz,serial);zmieniono=true;}
    catch(e2){zmieniono=false;loguj("ostrzezenie",`Nie udało się zapisać: ${klucz} • pamięć po oczyszczeniu ${(wynik.po/1024).toFixed(0)} KB`);}
  }
  if(zmieniono&&kluczZmieniaDaneAdmina(klucz))uniewaznijCachePodstronAdmina(klucz);
  if(zmieniono&&["artway_produkty_dodane","artway_produkty_edytowane","artway_produkty_katalog","artway_produkty_ukryte","artway_produkty_definitywne","artway_stany","artway_dostepnosc","artway_magazyn_produkty","artway_ustawienia"].includes(klucz)&&typeof asortymentCentralnyWyczyscCache==="function")asortymentCentralnyWyczyscCache();
  if(zmieniono && !chmuraWczytywanie && maUprawnieniaZapisuChmury() && KLUCZE_WSPOLNE.includes(klucz)){ chmuraBrudneKlucze.add(klucz); zaplanujZapisUstawien(); }
  return zmieniono;
}
const kwotaNum = v => { const n=Number(String(v ?? 0).replace(",",".").replace(/[^0-9.-]/g,"")); return Number.isFinite(n) ? +n.toFixed(2) : 0; };
const zl = n => kwotaNum(n).toFixed(2).replace(".", ",") + " zł";
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const jsArg = s => esc(JSON.stringify(String(s??"")));
function skrocTekst(v, max=190){
  const s=String(v??"").replace(/\s+/g," ").trim();
  return s.length>max ? s.slice(0,max).replace(/\s+\S*$/,"")+"…" : s;
}
function zdaniaOpisu(v){
  return String(v??"")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(x=>x.trim())
    .filter(x=>x.length>18);
}
function agentAICzyscOpis(v,max=20000){
  let s=String(v??"")
    .replace(/^Domyślny opis(?: krótki| pełny)?\s*/i,"")
    .replace(/\r/g,"\n")
    .replace(/\t+/g," ")
    .replace(/[ \u00a0]{2,}/g," ")
    .replace(/\n{3,}/g,"\n\n")
    .replace(/\s+([,.!?;:])/g,"$1")
    .replace(/([.!?])([A-ZĄĆĘŁŃÓŚŹŻ])/g,"$1 $2")
    .trim();
  s=s.replace(/\b(Zawartość opakowania|W zestawie|Skład zestawu|Wymiary opakowania|Liczba graczy|Wiek graczy)\s*:/gi,"\n\n$1:");
  s=s.replace(/\n{3,}/g,"\n\n").trim();
  return s.length>max ? s.slice(0,max).replace(/\s+\S*$/,"")+"…" : s;
}
function agentAITnijDoZdania(s,max=280){
  s=String(s||"").replace(/\s+/g," ").trim();
  if(s.length<=max) return s;
  const cut=s.slice(0,max+1);
  const idx=Math.max(cut.lastIndexOf("."),cut.lastIndexOf("!"),cut.lastIndexOf("?"));
  if(idx>90) return cut.slice(0,idx+1).trim();
  return cut.slice(0,max).replace(/\s+\S*$/,"").trim()+"…";
}
function agentAIUtworzOpisKrotki(p={}){
  const raw=String(p.opisKrotki||p.krotkiOpis||p.shortDescription||"").replace(/^Domyślny opis krótki\s*/i,"").trim();
  if(raw) return agentAITnijDoZdania(agentAICzyscOpis(raw,500),300);
  const opis=agentAICzyscOpis(p.opis||"",20000);
  const zd=zdaniaOpisu(opis).filter(x=>!/^(zawartość opakowania|skład zestawu|wymiary|ostrzeżenie)/i.test(x));
  if(zd.length) return agentAITnijDoZdania(zd.slice(0,2).join(" "),300);
  const kat=String(p.kategoria||"produkt").toLowerCase();
  return agentAITnijDoZdania(`${p.nazwa||"Produkt"} to propozycja z kategorii ${kat}, przygotowana z myślą o wygodnym wyborze i szybkim zakupie w Artway-TM.`,300);
}
function agentAIFormatujOpisPelny(p={}){
  const raw=agentAICzyscOpis(p.opis||"",20000);
  if(!raw)return "";
  const etykieta=/^(opis produktu|najważniejsze cechy|cechy produktu|zawartość opakowania|w zestawie|skład zestawu|zasady gry|jak grać|wymiary|dane techniczne|informacje dodatkowe|ostrzeżenie|bezpieczeństwo)\s*:?[\s]*$/i;
  const wejscie=raw
    .replace(/\s*[•·▪◦]\s*/g,"\n• ")
    .replace(/\b(Opis produktu|Najważniejsze cechy|Cechy produktu|Zawartość opakowania|W zestawie|Skład zestawu|Zasady gry|Jak grać|Wymiary|Dane techniczne|Informacje dodatkowe|Ostrzeżenie|Bezpieczeństwo)\s*:/gi,"\n\n$1\n")
    .split(/\n{2,}/)
    .map(x=>x.trim()).filter(Boolean);
  const bloki=[];
  for(const blok of wejscie){
    const linie=blok.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    for(const linia of linie){
      if(etykieta.test(linia)){bloki.push(linia.replace(/:$/,""));continue;}
      if(/^[-•]\s+/.test(linia)){bloki.push("• "+linia.replace(/^[-•]\s+/,""));continue;}
      const zd=zdaniaOpisu(linia);
      if(zd.length>3){for(let i=0;i<zd.length;i+=2)bloki.push(zd.slice(i,i+2).join(" "));}
      else bloki.push(linia);
    }
  }
  const maNaglowek=bloki.some(x=>etykieta.test(x));
  const wynik=maNaglowek?bloki:["Opis produktu",...bloki];
  const fakty=[
    p.producent?`Producent: ${p.producent}`:"",
    p.marka?`Marka: ${p.marka}`:"",
    (p.kodProducenta||p.mpn)?`Kod producenta: ${p.kodProducenta||p.mpn}`:"",
    (p.gtin||p.ean)?`EAN/GTIN: ${p.gtin||p.ean}`:"",
    p.rozmiar?`Wymiary / rozmiar: ${p.rozmiar}`:"",
    p.material?`Materiał: ${p.material}`:""
  ].filter(Boolean).filter(x=>!raw.toLowerCase().includes(x.toLowerCase()));
  if(fakty.length)wynik.push("Najważniejsze informacje",...fakty.map(x=>"• "+x));
  return wynik.join("\n\n").replace(/\n{3,}/g,"\n\n").trim();
}
function opisProduktuHTML(p={}){
  if(p.contentEditorial?.layoutPolicy==="allegro_sections"&&Array.isArray(p.allegroDescriptionSections)&&p.allegroDescriptionSections.length){
    const safeHtml=value=>{const tpl=document.createElement("template");tpl.innerHTML=String(value||"");tpl.content.querySelectorAll("*").forEach(el=>{if(!["P","H2","UL","LI","B","STRONG"].includes(el.tagName))el.replaceWith(document.createTextNode(el.textContent||""));else[...el.attributes].forEach(a=>el.removeAttribute(a.name));});return tpl.innerHTML;};
    const sections=p.allegroDescriptionSections.map(section=>(section.items||[]).map(item=>item.type==="IMAGE"&&/^https?:\/\//i.test(String(item.url||""))?`<figure><img src="${esc(item.url)}" alt="${esc(p.nazwa||"Produkt")}" loading="lazy"></figure>`:`<section>${safeHtml(item.content)}</section>`).join("")).join("");
    if(sections)return `<div class="product-description-content product-description-shared-layout">${sections}</div>`;
  }
  const tekst=agentAIFormatujOpisPelny(p)||"Szczegółowy opis produktu zostanie wkrótce uzupełniony.";
  const etykieta=/^(opis produktu|najważniejsze informacje|najważniejsze cechy|cechy produktu|zawartość opakowania|w zestawie|skład zestawu|zasady gry|jak grać|wymiary|dane techniczne|informacje dodatkowe|ostrzeżenie|bezpieczeństwo)$/i;
  const bloki=tekst.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  let html="",lista=[];
  const zamknijListe=()=>{if(lista.length){html+=`<ul>${lista.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;lista=[];}};
  for(const blok of bloki){
    if(/^•\s+/.test(blok)){lista.push(blok.replace(/^•\s+/,""));continue;}
    zamknijListe();
    if(etykieta.test(blok))html+=`<h3>${esc(blok)}</h3>`;
    else html+=`<p>${esc(blok).replace(/\n/g,"<br>")}</p>`;
  }
  zamknijListe();
  return `<div class="product-description-content">${html}</div>`;
}
function opisKrotkiProduktu(p={}){
  return agentAIUtworzOpisKrotki(p);
}
function agentAIPoprawOpisyDanychProduktu(p={}){
  const out={...p};
  out.opis=agentAIFormatujOpisPelny(out);
  out.opisKrotki=agentAIUtworzOpisKrotki(out);
  if(out.opisKrotki&&out.opis&&out.opisKrotki===out.opis) out.opisKrotki=agentAITnijDoZdania(out.opis,300);
  return out;
}
function agentAIProduktGotowyZLinku(d={},url=""){
  const source={...(d.product||{})},category=d.storeCategory?.name?d.storeCategory:agentAIDobierzKategorieProduktu(source),canonical=allegroProducentKanoniczny({...source,sourceUrl:source.sourceUrl||url,producentUrl:source.producentUrl||url}),canonicalUrl=String(d.canonicalUrl||d.resolvedUrl||source.sourceUrl||url).trim(),now=new Date().toISOString();
  const product={...source,kategoria:category.name||source.kategoria||"",producent:canonical||source.producent||source.marka||"",marka:source.marka||canonical||source.producent||"",sourceUrl:canonicalUrl,producentUrl:canonicalUrl,agentImportAt:now,agentImportConfidence:Number(d.confidence||source.agentImportConfidence||0),agentImportSource:d.fromCache?"pamięć Agenta + źródło produktu":"strona źródłowa produktu + Agent",agentImportUrl:canonicalUrl,sourceEvidence:{...(source.sourceEvidence||{}),requestedUrl:url,canonicalUrl,fetchedAt:source.sourceEvidence?.fetchedAt||source.producentSprawdzonoAt||now,fieldSources:d.fieldSources||source.sourceEvidence?.fieldSources||{}},ikona:source.ikona||(/\b(gra|gry|puzzle|układank|zabaw)/i.test(`${source.nazwa||""} ${category.name||""}`)?"🎲":"📦"),sku:source.sku||source.externalId||"",externalId:source.externalId||source.sku||"",cena:Number(source.cena)||0,createdAt:now,createdBy:sesja?.email||"administrator",agentOnboardingStatus:"processing",agentOnboardingStartedAt:now};
  const curated=product.contentEditorial?.channels==="shared_store_and_allegro"?product:agentAIPoprawOpisyDanychProduktu(product);if(curated.contentEditorial?.channels==="shared_store_and_allegro"){curated.allegroTitle=curated.nazwa;curated.allegroDescription=curated.opis;}
  return domyslneKosztyDoProduktu(curated,false);
}
async function agentAIPoprawOpisyWFormularzu(form){
  if(!form){toast("Nie znaleziono formularza produktu");return;}
  return allegroPoprawOpisyWFormularzu(form.querySelector('[onclick^="agentAIPoprawOpisyWFormularzu"]'));
}
async function allegroPoprawOpisyWFormularzu(btn){
  const form=btn?.closest("form");
  if(!form){ toast("Nie znaleziono formularza produktu"); return; }
  const id=Number(form.dataset?.productId||0);
  const produkt=produktRoboczyAllegroZFormularza(form,id,id?pobierzProduktAdmin(id)||{}:{});
  try{
    btn.disabled=true;
    toast("🤖 Przygotowuję krótki i pełny opis oraz układ wizualny Allegro…");
    const d=await chmura("allegro-description-improve",{method:"POST",body:{product:produkt},timeout:120000});
    if(form.elements.nazwa&&d.name) form.elements.nazwa.value=d.name;
    if(form.elements.opisKrotki) form.elements.opisKrotki.value=d.shortDescription||form.elements.opisKrotki.value||"";
    if(form.elements.opis&&d.fullDescription) form.elements.opis.value=d.fullDescription;
    let cloudSaved=null;
    if(id){
      zapiszPolaProduktuLokalnie(id,{nazwa:d.name||produkt.nazwa||"",opisKrotki:d.shortDescription||produkt.opisKrotki||"",opis:d.fullDescription||produkt.opis||"",allegroTitle:d.allegroTitle||produkt.allegroTitle||"",allegroDescription:d.allegroDescription||produkt.allegroDescription||"",contentEditorial:d.contentEditorial||produkt.contentEditorial,allegroDescriptionSections:Array.isArray(d.sections)?d.sections:[],allegroDescriptionEditedAt:new Date().toISOString(),allegroDescriptionSource:"agent-editorial-shared-content"},false);
      cloudSaved=await chmuraZapiszUstawienia().catch(()=>false);
    }
    const box=document.getElementById("allegroDescriptionPreview");
    if(box) box.innerHTML=`<div class="backend-note"><b>✅ Wspólna treść sklepu i Allegro przygotowana</b><br>Nazwa: ${esc(d.allegroTitle||"—")}<br><small>Link źródłowy był wyłącznie podstawą faktów. Ta sama zredagowana nazwa i treść trafią do sklepu oraz Allegro.</small></div><div class="allegro-description-preview"><div class="allegro-description-preview-head"><b>Podgląd układu w Allegro</b><small>Treść pozostaje taka sama; Allegro otrzyma tylko wymagany układ sekcji.</small></div>${(d.sections||[]).map(s=>(s.items||[]).map(item=>item.type==="IMAGE"?`<img src="${esc(item.url||"")}" alt="Podgląd zdjęcia produktu" loading="lazy">`:`<section>${item.content||""}</section>`).join("")).join("")||`<section><p>Brak sekcji do podglądu.</p></section>`}</div>`;
    toast(id?(cloudSaved?"✅ Wspólną treść sklepu i Allegro zapisano na serwerze":"⚠️ Treść zapisana lokalnie; serwer ponowi synchronizację"):`🤖 Wspólna treść sklepu i Allegro zostanie zapisana z produktem`);
  }catch(e){ toast("⚠️ Poprawianie opisów Allegro: "+(e.message||e)); }
  finally{ btn.disabled=false; }
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

/* Dane firmy, płatności oraz utrzymanie identyfikatorów produktu */
function daneFirmy(){
  const d = {...DANE_FIRMY_DOMYSLNE, ...(KONFIG.daneFirmy||{})};
  const ident = tylkoCyfry(d.identyfikator || d.nip || d.pesel || DANE_FIRMY_DOMYSLNE.identyfikator);
  d.identyfikator = ident;
  d.nip = tylkoCyfry(d.nip || ident);
  delete d.pesel;
  return d;
}
function daneFirmyTekst(){
  const d = daneFirmy();
  return `${d.nazwa}${d.adres?`, ${d.adres}`:""}, NIP: ${d.nip}`;
}
function daneFirmyHTML(){
  const d = daneFirmy();
  return `${esc(d.nazwa)}${d.adres?`, ${esc(d.adres)}`:""}<br><b>NIP:</b> ${esc(d.nip)}`;
}
function danePrawneFirmyKompletne(){
  const d=daneFirmy(),wartosci=[d.nazwa,d.nip,d.adres,d.kodPocztowy,d.miasto];
  return wartosci.every(value=>{const tekst=String(value||"").trim().toLowerCase();return tekst&&!tekst.includes("[nazwa firmy")&&!tekst.includes("uzupełnij")&&!tekst.includes("000 000");});
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
    .replace(/Przelewy24\s*\/\s*PayU\s*\/\s*Stripe/gi, "mBank Paynow")
    .replace(/<p><i>Szablon (regulaminu|polityki prywatności)[^<]*<\/i><\/p>/gi, "")
    .replace(/dane te nie opuszczają Twojego urządzenia/gi, "część danych pozostaje lokalnie, a dane konta i zamówień są synchronizowane z zabezpieczonym serwerem sklepu");
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
  ].filter(id=>Number(id)>0&&Number(id)<PRODUCT_LINK_IMPORT_FIRST_ID);
  return Math.max(0,...liczby);
}
let produktyDodaneAudytId={source:null,length:-1,first:"",last:""};
function naprawKolizjeIdProduktow(){
  if(!produktyDodane.length){produktyDodaneAudytId={source:produktyDodane,length:0,first:"",last:""};return false;}
  const first=String(produktyDodane[0]?.id??""),last=String(produktyDodane.at(-1)?.id??"");
  if(produktyDodaneAudytId.source===produktyDodane&&produktyDodaneAudytId.length===produktyDodane.length&&produktyDodaneAudytId.first===first&&produktyDodaneAudytId.last===last)return false;
  const zajete=new Set();
  let nastepne=najwyzszeIdProduktu()+1, zmiana=false;
  const wezNoweId=()=>{while(zajete.has(nastepne))nastepne++;const id=nastepne;zajete.add(id);nastepne++;return id;};
  const poprawione=produktyDodane.map(p=>{
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
  if(!zmiana){produktyDodaneAudytId={source:produktyDodane,length:produktyDodane.length,first,last};return false;}
  produktyDodane=poprawione;
  produktyDodaneAudytId={source:produktyDodane,length:produktyDodane.length,first:String(produktyDodane[0]?.id??""),last:String(produktyDodane.at(-1)?.id??"")};
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
  if(haslo.length<8) return {ok:false, blad:"Hasło musi mieć co najmniej 8 znaków."};
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  try{
    const d=await chmura("account-register",{method:"POST",body:{user:{imie,email},password:haslo}});
    const rekord={...(d.user||{imie,email,rola:"klient"}),token:d.sessionToken||""};
    const u=pobierzUzytkownikow(),i=u.findIndex(x=>x.email===email);
    if(i>=0)u[i]={...u[i],imie:rekord.imie,email:rekord.email,rola:rekord.rola,account:true};else u.push({imie:rekord.imie,email:rekord.email,rola:rekord.rola,account:true});
    zapiszLS("artway_uzytkownicy",u);
    stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
    loguj("info","Zarejestrowano użytkownika: "+email);
    return {ok:true,uzytkownik:rekord};
  }catch(bl){
    if(bl.code==="exists") return {ok:false, blad:"Konto z tym adresem już istnieje — zaloguj się."};
    if(!lokalnyPodglad) return {ok:false,blad:"Nie udało się bezpiecznie utworzyć konta: "+bl.message};
    const u=pobierzUzytkownikow();
    if(u.some(x=>x.email===email)) return {ok:false,blad:"Konto z tym adresem już istnieje — zaloguj się."};
    const rekord={imie,email,hash:await hashuj(haslo),rola:"klient",account:true,data:new Date().toISOString()};
    u.push(rekord);zapiszLS("artway_uzytkownicy",u);
    return {ok:true,uzytkownik:{imie,email,rola:"klient"}};
  }
}
async function sprawdzLogowanie(email, haslo){
  email=email.trim().toLowerCase();
  const adminEmail=KONFIG.emailAdmina.toLowerCase();
  // 1) ADMINISTRATOR — hasłem jest token wspólnej bazy (ARTWAY_ADMIN_TOKEN).
  //    Weryfikacja NA SERWERZE → działa na każdym urządzeniu i od razu łączy wspólną bazę.
  if(email==="admin" || email===adminEmail){
    try{
      const d=await chmura("login",{method:"POST",body:{password:haslo,email:adminEmail}});
      chmuraToken=""; sessionStorage.removeItem("artway_chmura_token"); localStorage.removeItem("artway_chmura_token");
      const lista=pobierzUzytkownikow(); const a=lista.find(x=>x.email===adminEmail);
      if(a){ a.hash=""; zapiszLS("artway_uzytkownicy",lista); }
      domyslneHasloAdmina=false;
      chmuraStan={...chmuraStan,dostepna:true,admin:true};
      return {ok:true, uzytkownik:{imie:"Administrator",email:adminEmail,rola:"admin",token:d.sessionToken||"",verified:true}};
    }catch(bl){
      // serwer niedostępny lub złe hasło → spróbuj lokalnego admin/admin (tryb offline)
    }
  }
  const emailDocelowy = (email==="admin") ? adminEmail : email;
  // 2) KLIENT — logowanie do konta we WSPÓLNEJ bazie
  if(email!=="admin"){
    try{
      const d=await chmura("account-login",{method:"POST",body:{email:emailDocelowy,password:haslo}});
      const serwer=d.user||{}; const lista=pobierzUzytkownikow(); const lok=lista.find(x=>x.email===serwer.email);
      if(lok) Object.assign(lok,serwer,{hash:""}); else lista.push({...serwer,hash:""});
      zapiszLS("artway_uzytkownicy",lista);
      stanBazyCentralnej={...stanBazyCentralnej,online:true,error:""};
      return {ok:true, uzytkownik:{imie:serwer.imie||serwer.email,email:serwer.email,rola:serwer.rola||"klient",token:d.sessionToken||"",verified:true}};
    }catch(bl){
      const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
      if(!lokalnyPodglad) return {ok:false,blad:bl.message||"Nieprawidłowy e-mail lub hasło."};
    }
  }
  // 3) Awaryjne logowanie lokalne (offline / stare konta)
  const hash = await hashuj(haslo);
  const u = pobierzUzytkownikow().find(x=>x.email===emailDocelowy);
  if(!u) return {ok:false, blad:"Nieprawidłowy e-mail lub hasło."};
  if(u.hash !== hash) return {ok:false, blad:"Nieprawidłowe hasło."};
  return {ok:true, uzytkownik:{imie:u.imie, email:u.email, rola:u.rola||"klient"}};
}
function ustawSesje(u){
  if(u&&sesja?.email===u.email&&!u.token&&sesja.token)u={...u,token:sesja.token,verified:sesja.verified};
  sesja=u; zapiszLS("artway_sesja",u); odswiezUzytkownika();
}
function wyloguj(){ chmuraToken=""; try{sessionStorage.removeItem("artway_chmura_token");localStorage.removeItem("artway_chmura_token");}catch(e){} chmuraStan={...chmuraStan,admin:false}; stanBramki={...stanBramki,authenticated:false}; ustawSesje(null); toast("Wylogowano 👋"); location.hash="#/"; }
function jestGlownymAdminem(email){ return String(email||"").toLowerCase()===KONFIG.emailAdmina.toLowerCase(); }
function kontoMaRoleAdmin(email){
  const e=String(email||"").toLowerCase();
  return jestGlownymAdminem(e)||pobierzUzytkownikow().some(u=>u.email===e&&u.rola==="admin");
}
function jestAdmin(){
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  return !!sesja&&kontoMaRoleAdmin(sesja.email)&&(!!chmuraToken||!!sesja.token||lokalnyPodglad);
}
function odswiezUzytkownika(){
  const nazwaSesji=sesja ? String(sesja.imie||sesja.login||sesja.email||"Konto").trim() : "";
  $("userBtn").textContent = sesja ? "👤 "+(nazwaSesji.split(/\s+/)[0]||"Konto") : "👤 Zaloguj";
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
let indeksDrzewaKategoriiCache={products:null,parents:null,signature:"",value:null};
function indeksDrzewaKategoriiMenu(kategorie=wszystkieKategorie()){
  const lista=[...new Set((kategorie||[]).map(x=>String(x||"").trim()).filter(Boolean))],signature=lista.join("\u0001"),parentsSource=ustawienia.rodziceKategorii||null;
  if(indeksDrzewaKategoriiCache.products===produkty&&indeksDrzewaKategoriiCache.parents===parentsSource&&indeksDrzewaKategoriiCache.signature===signature&&indeksDrzewaKategoriiCache.value)return indeksDrzewaKategoriiCache.value;
  const allowed=new Set(lista),raw=rodziceKategoriiMenu(),parents={},children=new Map(lista.map(k=>[k,[]])),directCounts=Object.fromEntries(lista.map(k=>[k,0]));
  for(const k of lista){const parent=raw[k];if(parent&&allowed.has(parent)&&parent!==k){parents[k]=parent;children.get(parent).push(k);}}
  for(const p of produkty){const k=String(p?.kategoria||"").trim();if(allowed.has(k))directCounts[k]=(directCounts[k]||0)+1;}
  children.forEach(items=>items.sort((a,b)=>a.localeCompare(b,"pl")));
  const depth={},paths={},branchCounts={},descendants={},visit=(k,trail=new Set())=>{
    if(trail.has(k))return {count:directCounts[k]||0,items:new Set()};
    const next=new Set(trail);next.add(k);let count=directCounts[k]||0;const items=new Set();
    for(const child of children.get(k)||[]){items.add(child);const nested=visit(child,next);count+=nested.count;nested.items.forEach(x=>items.add(x));}
    branchCounts[k]=count;descendants[k]=items;return {count,items};
  };
  const pathFor=k=>{const out=[k],seen=new Set([k]);let current=k;while(parents[current]&&!seen.has(parents[current])){current=parents[current];seen.add(current);out.unshift(current);}return out;};
  lista.forEach(k=>{const path=pathFor(k);paths[k]=path;depth[k]=Math.max(0,path.length-1);});
  lista.filter(k=>!parents[k]).forEach(k=>visit(k));lista.forEach(k=>{if(branchCounts[k]===undefined)visit(k);});
  const value={lista,allowed,parents,children,directCounts,branchCounts,descendants,depth,paths,roots:lista.filter(k=>!parents[k])};
  indeksDrzewaKategoriiCache={products:produkty,parents:parentsSource,signature,value};return value;
}
function kategoriePotomneMenu(k,kategorie=wszystkieKategorie()){return indeksDrzewaKategoriiMenu(kategorie).descendants[String(k||"")]||new Set();}
function kategorieGaleziMenu(k,kategorie=wszystkieKategorie()){return new Set([String(k||""),...kategoriePotomneMenu(k,kategorie)]);}
function sciezkaKategoriiMenu(k,kategorie=wszystkieKategorie()){return indeksDrzewaKategoriiMenu(kategorie).paths[String(k||"")]||[String(k||"")];}
function produktNalezyDoGaleziKategorii(p,k,kategorie=wszystkieKategorie()){return k==="Wszystkie"||kategorieGaleziMenu(k,kategorie).has(String(p?.kategoria||""));}
function liczbaProduktowWKategorii(k){ return indeksDrzewaKategoriiMenu().branchCounts[String(k||"")]||0; }
function grupyMenuKategorii(){
  return (Array.isArray(ustawienia.menuKategorii)?ustawienia.menuKategorii:[])
    .map((g,i)=>({
      id:String(g.id||("grp_"+i+"_"+prostyHash(String(g.nazwa||i)))),
      nazwa:String(g.nazwa||"Grupa katalogów").trim()||"Grupa katalogów",
      ikona:String(g.ikona||"🗂️").trim()||"🗂️",
      ikonaObraz:String(g.ikonaObraz||"").trim(),
      ikonaAssetId:String(g.ikonaAssetId||"").trim(),
      aktywna:g.aktywna!==false,
      kategorie:[...new Set((Array.isArray(g.kategorie)?g.kategorie:[]).map(x=>String(x).trim()).filter(Boolean))]
    }));
}
function rodziceKategoriiMenu(){
  const raw=ustawienia.rodziceKategorii&&typeof ustawienia.rodziceKategorii==="object"?ustawienia.rodziceKategorii:{};
  return Object.fromEntries(Object.entries(raw).map(([dziecko,rodzic])=>[String(dziecko||"").trim(),String(rodzic||"").trim()]).filter(([dziecko,rodzic])=>dziecko&&rodzic&&dziecko!==rodzic));
}
function korzenKategoriiMenu(kategoria,dozwolone=null){
  const rodzice=rodziceKategoriiMenu(),seen=new Set();let current=String(kategoria||"").trim();
  for(let i=0;i<8&&rodzice[current]&&!seen.has(current);i++){seen.add(current);const parent=rodzice[current];if(dozwolone&&!dozwolone.has(parent))break;current=parent;}
  return current;
}
function dzieciKategoriiMenu(kategoria,kategorie){
  return indeksDrzewaKategoriiMenu(kategorie).children.get(String(kategoria||""))||[];
}
function zapiszGrupyMenuKategorii(lista, ekstra={}){
  ustawienia.menuKategorii=lista.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz||"",ikonaAssetId:g.ikonaAssetId||"",aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
  zapiszCzescUstawien({menuKategorii:ustawienia.menuKategorii,...ekstra});
}
function kategoriePrzypisaneDoAktywnychGrup(kategorie){
  const dozwolone=new Set(kategorie);
  const przypisaneBezposrednio=new Set(grupyMenuKategorii().filter(g=>g.aktywna).flatMap(g=>g.kategorie.filter(k=>dozwolone.has(k))));
  return new Set(kategorie.filter(k=>przypisaneBezposrednio.has(k)||przypisaneBezposrednio.has(korzenKategoriiMenu(k,dozwolone))));
}
function linkKategoriiMenu(k,index=null){
  const count=index?.branchCounts?.[k]??liczbaProduktowWKategorii(k);
  return `<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))"><span>${esc(k)}</span><span class="nav-count" aria-label="Liczba produktów w gałęzi: ${count}">${count}</span></a>`;
}
function drzewoKategoriiMenuHTML(k,kategorie,poziom=0,index=null){
  const tree=index||indeksDrzewaKategoriiMenu(kategorie),dzieci=tree.children.get(k)||[];
  return `<span class="nav-category-node level-${Math.min(5,poziom)}">${linkKategoriiMenu(k,tree)}${dzieci.length?`<span class="nav-category-children">${dzieci.map(d=>drzewoKategoriiMenuHTML(d,kategorie,poziom+1,tree)).join("")}</span>`:""}</span>`;
}
let licznikMenuKategorii=0;
let globalnaObslugaMenuKategorii=false;
function identyfikatorMenuKategorii(){return `nav-category-menu-${++licznikMenuKategorii}`;}
function naglowekMenuKategorii(label,ikona,ikonaObraz,podpis="Kategorie w tym dziale"){
  return `<span class="nav-menu-heading"><span class="nav-menu-heading-icon" aria-hidden="true">${ikonaObraz?`<img class="nav-generated-icon" src="${esc(ikonaObraz)}" alt="">`:esc(ikona||"🗂️")}</span><span><b>${esc(label)}</b><small>${esc(podpis)}</small></span></span>`;
}
function dropdownMenuKategorii(label, dzieci, ikona="🗂️",kategorie=[],ikonaObraz="",extraClass=""){
  if(!dzieci.length) return "";
  const wszystkie=kategorie.length?kategorie:dzieci;
  const id=identyfikatorMenuKategorii();
  const podpis=`${dzieci.length} ${dzieci.length===1?"kategoria":dzieci.length<5?"kategorie":"kategorii"}`;
  const tree=indeksDrzewaKategoriiMenu(wszystkie);
  return `<span class="nav-dd ${esc(extraClass)}"><button class="nav-drop-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="${id}" onclick="return przelaczMenuKategorii(event,this)">${ikonaObraz?`<img class="nav-generated-icon" src="${esc(ikonaObraz)}" alt="">`:esc(ikona)} <span>${esc(label)}</span> <i aria-hidden="true">⌄</i></button><span class="nav-menu" id="${id}" role="region" aria-label="${esc(label)}">${naglowekMenuKategorii(label,ikona,ikonaObraz,podpis)}<span class="nav-menu-list">${dzieci.map(k=>drzewoKategoriiMenuHTML(k,wszystkie,0,tree)).join("")}</span></span></span>`;
}
function dropdownZbiorczyKategorii(sekcje,kategorie=[],label="Więcej",extraClass=""){
  const gotowe=(Array.isArray(sekcje)?sekcje:[]).filter(s=>Array.isArray(s.korzenie)&&s.korzenie.length);
  if(!gotowe.length)return "";
  const id=identyfikatorMenuKategorii();
  const odmianaDzialu=gotowe.length===1?"dział":gotowe.length<5?"działy":"działów";
  const tree=indeksDrzewaKategoriiMenu(kategorie);
  return `<span class="nav-dd nav-dd-more ${esc(extraClass)}"><button class="nav-drop-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="${id}" onclick="return przelaczMenuKategorii(event,this)"><span aria-hidden="true">🗂️</span> <span>${esc(label)}</span> <i aria-hidden="true">⌄</i></button><span class="nav-menu nav-menu-mega${gotowe.length===1?" nav-menu-single":""}" id="${id}" role="region" aria-label="${esc(label)}">${naglowekMenuKategorii(label,"🗂️","",`${gotowe.length} ${odmianaDzialu} w jednym miejscu`)}<label class="nav-menu-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Szukaj kategorii…" aria-label="Szukaj kategorii" oninput="filtrujKategorieMenu(this)"></label><span class="nav-menu-empty" hidden>Brak kategorii pasujących do wyszukiwania.</span>${gotowe.map(s=>`<span class="nav-menu-section"><b>${s.ikonaObraz?`<img class="nav-generated-icon" src="${esc(s.ikonaObraz)}" alt="">`:esc(s.ikona||"📁")} ${esc(s.nazwa||"Kategorie")}</b><span>${s.korzenie.map(k=>drzewoKategoriiMenuHTML(k,kategorie,0,tree)).join("")}</span></span>`).join("")}</span></span>`;
}
function zamknijMenuKategorii(wyjatek=null,przywrocFokus=false){
  document.querySelectorAll("#mainNav .nav-dd.is-open").forEach(menu=>{
    if(menu===wyjatek)return;
    menu.classList.remove("is-open");
    const przycisk=menu.querySelector(":scope > .nav-drop-btn");
    if(przycisk){przycisk.setAttribute("aria-expanded","false");if(przywrocFokus)przycisk.focus();}
  });
}
function przelaczMenuKategorii(event,przycisk){
  event.preventDefault();event.stopPropagation();
  const menu=przycisk.closest(".nav-dd");if(!menu)return false;
  const otworzyc=!menu.classList.contains("is-open");
  zamknijMenuKategorii(menu);
  menu.classList.toggle("is-open",otworzyc);
  przycisk.setAttribute("aria-expanded",otworzyc?"true":"false");
  if(!otworzyc)przycisk.blur();
  return false;
}
function filtrujKategorieMenu(input){
  const panel=input.closest(".nav-menu");if(!panel)return;
  const fraza=String(input.value||"").trim().toLocaleLowerCase("pl");
  let widoczne=0;
  panel.querySelectorAll(":scope > .nav-menu-section").forEach(sekcja=>{
    const naglowek=sekcja.querySelector(":scope > b")?.textContent.toLocaleLowerCase("pl")||"";
    const pasujeNaglowek=!!fraza&&naglowek.includes(fraza);
    let widoczneWSekcji=0;
    sekcja.querySelectorAll(":scope > span > .nav-category-node").forEach(kategoria=>{
      const pasuje=!fraza||pasujeNaglowek||kategoria.textContent.toLocaleLowerCase("pl").includes(fraza);
      kategoria.hidden=!pasuje;if(pasuje)widoczneWSekcji++;
    });
    sekcja.hidden=widoczneWSekcji===0;widoczne+=widoczneWSekcji;
  });
  const pusty=panel.querySelector(":scope > .nav-menu-empty");if(pusty)pusty.hidden=widoczne>0;
}
function zainicjujObslugeMenuKategorii(n){
  if(!n.dataset.menuKategoriiGotowe){
    n.dataset.menuKategoriiGotowe="1";
    n.addEventListener("keydown",event=>{
      const przycisk=event.target.closest(".nav-drop-btn");
      if(przycisk&&event.key==="ArrowDown"){
        const menu=przycisk.closest(".nav-dd");
        if(!menu.classList.contains("is-open"))przelaczMenuKategorii(event,przycisk);
        event.preventDefault();menu.querySelector(".nav-menu input,.nav-menu a")?.focus();
      }
    });
  }
  if(!globalnaObslugaMenuKategorii){
    globalnaObslugaMenuKategorii=true;
    document.addEventListener("click",event=>{if(!event.target.closest("#mainNav .nav-dd"))zamknijMenuKategorii();});
    document.addEventListener("keydown",event=>{if(event.key==="Escape")zamknijMenuKategorii(null,true);});
  }
}
function odswiezMenu(){
  const n = $("mainNav"); if(!n) return;
  licznikMenuKategorii=0;
  const kategorie = wszystkieKategorie();
  const grupy = grupyMenuKategorii().filter(g=>g.aktywna);
  const rodzice=rodziceKategoriiMenu(),dozwolone=new Set(kategorie);
  const grupyZKorzeniami=grupy.map(g=>{
    const bezposrednie=g.kategorie.filter(k=>dozwolone.has(k));
    const korzenie=[...new Set(bezposrednie.map(k=>rodzice[k]&&dozwolone.has(korzenKategoriiMenu(k,dozwolone))?korzenKategoriiMenu(k,dozwolone):k))];
    return {...g,korzenie};
  }).filter(g=>g.korzenie.length);
  // Na szerokim pasku zostają maksymalnie cztery najważniejsze grupy. Pozostałe
  // nadal są dostępne w jednym, pełnym katalogu „Więcej”, dzięki czemu nawigacja
  // nie tworzy przypadkowego drugiego wiersza przy dłuższych nazwach.
  const limitGrupBezposrednich=4;
  const grupyBezposrednie=grupyZKorzeniami.slice(0,limitGrupBezposrednich);
  const grupyDodatkowe=grupyZKorzeniami.slice(limitGrupBezposrednich);
  const grupyHTML = grupyBezposrednie.map((g,index)=>dropdownMenuKategorii(g.nazwa,g.korzenie,g.ikona,kategorie,g.ikonaObraz,index>=2?"nav-align-right":"")).join("");
  const przypisane = kategoriePrzypisaneDoAktywnychGrup(kategorie);
  const bezGrup = kategorie.filter(k=>!przypisane.has(k));
  const bezGrupKorzenie=bezGrup.filter(k=>!rodzice[k]||!dozwolone.has(rodzice[k]));
  const pokazBezGrup = ustawienia.menuPokazNieprzypisane!==false;
  const limitBezGrupBezposrednich=grupyZKorzeniami.length?0:6;
  const bezGrupBezposrednie=pokazBezGrup?bezGrupKorzenie.slice(0,limitBezGrupBezposrednich):[];
  const bezGrupDodatkowe=pokazBezGrup?bezGrupKorzenie.slice(limitBezGrupBezposrednich):[];
  const bezGrupHTML=bezGrupBezposrednie.map(k=>`<a class="nav-category-direct" href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">${esc(k)}</a>`).join("");
  const sekcjeDodatkowe=[...grupyDodatkowe.map(g=>({nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz,korzenie:g.korzenie})),...(bezGrupDodatkowe.length?[{nazwa:"Pozostałe kategorie",ikona:"📁",korzenie:bezGrupDodatkowe}]:[])];
  const wszystkieSekcje=[...grupyZKorzeniami.map(g=>({nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz,korzenie:g.korzenie})),...(bezGrupKorzenie.length?[{nazwa:"Pozostałe kategorie",ikona:"📁",korzenie:bezGrupKorzenie}]:[])];
  const wiecejHTML=dropdownZbiorczyKategorii(sekcjeDodatkowe,kategorie);
  const mobilneKategorieHTML=dropdownZbiorczyKategorii(wszystkieSekcje,kategorie,"Kategorie","nav-mobile-categories");
  n.innerHTML = mobilneKategorieHTML
    + `<a class="nav-home-link" href="#/">🏪 Strona główna</a>`
    + grupyHTML
    + bezGrupHTML
    + wiecejHTML
    + `<a href="/promocje" onclick="return nawigujSklep(event,this.getAttribute('href'))">🔥 Promocje</a><a href="/nowosci" onclick="return nawigujSklep(event,this.getAttribute('href'))">✨ Nowości</a>`
    + (jestAdmin()?`<a class="nav-admin-link" href="#/admin">⚙️ Panel admina</a>`:"");
  zainicjujObslugeMenuKategorii(n);
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
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  const u = pobierzUzytkownikow();
  const email = KONFIG.emailAdmina.toLowerCase();
  if(!lokalnyPodglad){
    const czysta=u.filter(x=>!(x.email===email&&x.hash));
    if(czysta.length!==u.length)zapiszLS("artway_uzytkownicy",czysta);
    domyslneHasloAdmina=false;
    return;
  }
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
  if(nowe.length<8){ toast("⚠️ Nowe hasło musi mieć min. 8 znaków"); return; }
  if(nowe!==powtorz){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  try{
    const d=await chmura("account-password-change",{method:"POST",body:{currentPassword:String(f.get("stare")||""),newPassword:nowe}});
    if(d.sessionToken&&sesja)ustawSesje({...sesja,token:d.sessionToken,verified:true});
  }catch(bl){
    const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
    if(!lokalnyPodglad){toast("⚠️ Nie zmieniono hasła: "+bl.message);return;}
    const w = await sprawdzLogowanie(sesja.email, f.get("stare"));
    if(!w.ok){ toast("⚠️ Obecne hasło nieprawidłowe"); return; }
  }
  const lokalnyPodglad=["localhost","127.0.0.1"].includes(location.hostname)||location.protocol==="file:";
  const u = pobierzUzytkownikow(); const ja = u.find(x=>x.email===sesja.email);
  if(ja){ja.hash=lokalnyPodglad?await hashuj(nowe):"";zapiszLS("artway_uzytkownicy",u);}
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
  if(u.opisSklepu) KONFIG.opisSklepu = /Sklep wielobranżowy z asortymentem od sprawdzonych dostawców\. Nowe technologie, uczciwe ceny\./i.test(String(u.opisSklepu))
    ? "Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów. Czytelna oferta, uczciwe ceny i szybka wysyłka."
    : u.opisSklepu;
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
  const ofertaGlowna=ustawieniaOfertyGlownej();
  if(!localStorage.getItem("artway_produkty_na_stronie")&&[12,24,48,96].includes(Number(ofertaGlowna.naStronie)))produktyNaStronie=Number(ofertaGlowna.naStronie);
  if(u.heroTytul) KONFIG.heroTytul = u.heroTytul;
  if(u.heroOpis) KONFIG.heroOpis = /^Elektronika, dom i ogród, narzędzia, odzież i sport\./i.test(String(u.heroOpis))
    ? "Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów — między innymi Alexander, Multigra i GoDan."
    : u.heroOpis;
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
// Lekki indeks kartotek jest częścią podstawowych danych sklepu. Dzięki temu
// magazyn, lokalizacje i generator QR nie muszą pobierać całego modułu edytora.
function jestProduktemDodanym(id){ return produktyDodane.some(p=>Number(p.id)===Number(id)); }
function jestProduktemImportowanym(id){ return produktyImportowane.some(p=>String(p.id)===String(id)); }
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
    .map(id=>produktyBazoweWspolne().find(x=>Number(x.id)===Number(id)))
    .filter(Boolean);
}
let produktyAdminCache={bazowe:null,dodane:null,edytowane:null,definitywne:null,items:[],byId:new Map()};
function uniewaznijProduktyAdminCache(){produktyAdminCache={bazowe:null,dodane:null,edytowane:null,definitywne:null,items:[],byId:new Map()};}
function produktyDoAdministracji(){
  naprawKolizjeIdProduktow();
  const bazowe=produktyBazoweWspolne();
  if(produktyAdminCache.bazowe===bazowe&&produktyAdminCache.dodane===produktyDodane&&produktyAdminCache.edytowane===produktyEdytowane&&produktyAdminCache.definitywne===produktyDefinitywne)return produktyAdminCache.items;
  const dodaneIds=new Set(produktyDodane.map(p=>Number(p.id)));
  const items=[...bazowe.filter(p=>!dodaneIds.has(Number(p.id))&&!produktyDefinitywne.includes(p.id)).map(p=>produktyEdytowane[p.id]?{...p,...produktyEdytowane[p.id],id:p.id}:p),...produktyDodane];
  produktyAdminCache={bazowe,dodane:produktyDodane,edytowane:produktyEdytowane,definitywne:produktyDefinitywne,items,byId:new Map(items.map(p=>[String(p.id),p]))};return items;
}
function pobierzProduktAdmin(id){produktyDoAdministracji();return produktyAdminCache.byId.get(String(id));}
function przygotujProduktDlaSklepu(p){
  if(!p)return null;
  const zmianyKat=ustawienia.kategorie||{},mapa=ustawienia.mapaProduktow||{};
  let k=mapa[p.id]||p.kategoria;
  for(let i=0;i<3&&zmianyKat[k];i++)k=zmianyKat[k];
  const zKategoria=k===p.kategoria?p:{...p,kategoria:k};
  return stanyProduktow[p.id]!==undefined?{...zKategoria,stan:+stanyProduktow[p.id]}:zKategoria;
}
function produktSklepuPoId(id){
  const key=String(id),bezposredni=produkty.find(p=>String(p.id)===key);
  if(bezposredni)return bezposredni;
  // Po połączeniu duplikatów stary adres produktu nadal prowadzi do zachowanej,
  // kanonicznej kartoteki. Aktualizacja identyfikatorów nie może tworzyć 404.
  const grupa=audytDuplikatowSklepu().grupy.find(g=>g.produkty.some(p=>String(p.id)===key));
  if(grupa){
    const kanoniczny=produkty.find(p=>String(p.id)===String(grupa.canonical.id));
    if(kanoniczny)return kanoniczny;
  }
  return null;
}
function zbudujProdukty(){
  if(typeof uniewaznijProduktyAdminCache==="function")uniewaznijProduktyAdminCache();
  naprawKolizjeIdProduktow();
  const ukryteKat = ustawienia.ukryteKategorie || [];
  const dodaneIds = new Set(produktyDodane.map(p=>Number(p.id)));
  const bazowePoEdycji = produktyBazoweWspolne()
    .filter(p=>!dodaneIds.has(Number(p.id))&&!produktyUkryte.includes(p.id))
    .map(p=>produktyEdytowane[p.id] ? {...p, ...produktyEdytowane[p.id], id:p.id} : p);
  produkty = [ ...bazowePoEdycji, ...produktyDodane ]
    .map(przygotujProduktDlaSklepu)
    .filter(p => !ukryteKat.includes(p.kategoria));
  // Brak u producenta wstrzymuje zakup, ale nie usuwa karty, adresu ani treści.
  // Tylko świadome przeniesienie do kosza / definitywne usunięcie wyłącza produkt.
  produkty=filtrujDuplikatySklepu(produkty);
}
function podpisPublikacjiProduktu(p={}){
  return JSON.stringify({
    id:String(p.id??""),nazwa:String(p.nazwa||""),kategoria:String(p.kategoria||""),
    cena:Number(p.cena)||0,zdjecie:String(p.zdjecie||""),ean:String(p.gtin||p.ean||""),
    externalId:String(p.externalId||""),sku:String(p.sku||""),producent:String(p.producent||p.marka||""),
    opisKrotki:agentAIUtworzOpisKrotki(p),opis:agentAIFormatujOpisPelny(p)
  });
}
function stanPublikacjiKatalogu(){
  const bazowe=new Map(produktyBazoweWspolne().map(p=>[String(p.id),p]));
  const aktualne=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&!produktyDefinitywne.some(id=>String(id)===String(p.id)));
  const brakujace=[],nieaktualne=[];
  for(const p of aktualne){
    const baza=bazowe.get(String(p.id));
    if(!baza)brakujace.push(p.id);
    else if(podpisPublikacjiProduktu(baza)!==podpisPublikacjiProduktu(p))nieaktualne.push(p.id);
  }
  return {gotowy:zrodloProduktow==="json"&&!brakujace.length&&!nieaktualne.length,razem:aktualne.length,bazowe:bazowe.size,brakujace,nieaktualne};
}
function porzadkujBezpieczneReferencje(){
  const widoczne=new Set(produkty.map(p=>String(p.id))),wszystkie=new Set([...produktyBazoweWspolne(),...(produktyDodane||[]),...(koszDodanych||[])].map(p=>String(p.id)));
  const koszykPrzed=koszyk.length;
  koszyk=koszyk.filter((x,i,a)=>widoczne.has(String(x.id))&&Number(x.ile)>0&&a.findIndex(y=>String(y.id)===String(x.id)&&String(y.wariant||"")===String(x.wariant||""))===i);
  if(koszyk.length!==koszykPrzed)zapiszLS("artway_koszyk",koszyk);
  const mapa={...(ustawienia.mapaProduktow||{})},usuniete=[];
  for(const id of Object.keys(mapa))if(!wszystkie.has(String(id))){delete mapa[id];usuniete.push(id);}
  if(usuniete.length){
    ustawienia={...ustawienia,mapaProduktow:mapa};
    if(typeof produktyDoAdministracji==="function")zapiszLS("artway_ustawienia",ustawienia);
    else try{localStorage.setItem("artway_ustawienia",JSON.stringify(ustawienia));}catch(e){}
    loguj("info",`Usunięto ${usuniete.length} osieroconych mapowań bez zmiany katalogu produktów`);
  }
  return {koszyk:koszykPrzed-koszyk.length,mapowania:usuniete.length};
}
function kluczDuplikatuProduktu(v){return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"");}
function kluczeDuplikatuProduktu(p={}){
  const out=[];const add=(typ,v)=>{const k=kluczDuplikatuProduktu(v);if(k)out.push(`${typ}:${k}`);};
  add("external",p.externalId);add("sku",p.sku);add("ean",p.gtin||p.ean);add("mpn",p.kodProducenta||p.mpn);
  if(!out.length&&p.nazwa)add("nazwa",`${p.producent||p.marka||""}:${p.nazwa}`);
  return [...new Set(out)];
}
function kompletnoscProduktuDlaDuplikatu(p={}){return [p.externalId,p.sku,p.gtin||p.ean,p.kodProducenta||p.mpn,p.producent||p.marka,p.zdjecie,p.opis,p.cena>0].filter(Boolean).length;}
let audytDuplikatowSklepuCache={source:null,choices:null,hidden:null,added:null,result:null};
function audytDuplikatowSklepu(lista){
  const domyslna=!Array.isArray(lista),source=domyslna?produktyDoAdministracji():lista,choices=ustawienia.kanoniczneDuplikatySklepu&&typeof ustawienia.kanoniczneDuplikatySklepu==="object"?ustawienia.kanoniczneDuplikatySklepu:{};
  if(audytDuplikatowSklepuCache.source===source&&audytDuplikatowSklepuCache.choices===choices&&audytDuplikatowSklepuCache.hidden===(domyslna?produktyUkryte:null)&&audytDuplikatowSklepuCache.added===(domyslna?produktyDodane:null)&&audytDuplikatowSklepuCache.result)return audytDuplikatowSklepuCache.result;
  const items=source.filter(p=>p&&p.id!==undefined&&(!domyslna||!czyProduktAdminWKoszu(p))),parent=new Map(items.map(p=>[String(p.id),String(p.id)])),owner=new Map(),shared=new Map();
  const find=id=>{let x=String(id);while(parent.get(x)!==x){parent.set(x,parent.get(parent.get(x)));x=parent.get(x);}return x;};
  const union=(a,b,key)=>{let ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra);if(!shared.has(key))shared.set(key,new Set());shared.get(key).add(String(a));shared.get(key).add(String(b));};
  items.forEach(p=>kluczeDuplikatuProduktu(p).forEach(key=>{if(owner.has(key))union(p.id,owner.get(key),key);else owner.set(key,String(p.id));}));
  const groups=new Map();items.forEach(p=>{const root=find(p.id);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(p);});
  const wynik=[...groups.values()].filter(g=>g.length>1).map(group=>{
    const ids=new Set(group.map(p=>String(p.id))),keys=[...shared.entries()].filter(([,set])=>[...set].some(id=>ids.has(id))).map(([key])=>key).sort(),groupKey=keys[0]||`ids:${[...ids].sort().join("-")}`;
    const selected=group.find(p=>String(p.id)===String(choices[groupKey]||""));
    const canonical=selected||[...group].sort((a,b)=>kompletnoscProduktuDlaDuplikatu(b)-kompletnoscProduktuDlaDuplikatu(a)||String(a.externalId||a.sku||a.gtin||a.id).localeCompare(String(b.externalId||b.sku||b.gtin||b.id),"pl",{numeric:true})||Number(a.id)-Number(b.id))[0];
    return {groupKey,keys,produkty:group,canonical,hidden:group.filter(p=>String(p.id)!==String(canonical.id))};
  });
  const result={grupy:wynik,produkty:wynik.reduce((s,g)=>s+g.produkty.length,0),ukryte:wynik.reduce((s,g)=>s+g.hidden.length,0),hiddenIds:new Set(wynik.flatMap(g=>g.hidden.map(p=>String(p.id))))};
  audytDuplikatowSklepuCache={source,choices,hidden:domyslna?produktyUkryte:null,added:domyslna?produktyDodane:null,result};return result;
}
function filtrujDuplikatySklepu(lista=[]){const audit=audytDuplikatowSklepu(lista);return lista.filter(p=>!audit.hiddenIds.has(String(p.id)));}
function ustawProduktGlownyDuplikatu(groupKey,productId){
  ustawienia={...ustawienia,kanoniczneDuplikatySklepu:{...(ustawienia.kanoniczneDuplikatySklepu||{}),[String(groupKey)]:String(productId)}};zapiszLS("artway_ustawienia",ustawienia);zbudujProdukty();odswiezMenu();toast("Wybrano kartę, która ma pozostać");renderuj();
}
async function usunKopieGrupyProduktuTrwale(groupKey){
  const grupa=audytDuplikatowSklepu().grupy.find(g=>String(g.groupKey)===String(groupKey));
  if(!grupa||grupa.produkty.length<2){toast("Ta grupa nie zawiera już powtórzeń");renderuj();return;}
  const keepId=String(grupa.canonical.id),usun=grupa.produkty.filter(p=>String(p.id)!==keepId);
  const lista=usun.map(p=>`${p.nazwa} (ID ${p.id})`).join("\n");
  if(!confirm(`Pozostawić „${grupa.canonical.nazwa}” (ID ${grupa.canonical.id}) i TRWALE usunąć ${usun.length} powtarzające się rekordy?\n\n${lista}\n\nOperacji nie można cofnąć.`))return;
  const ids=new Set(usun.map(p=>String(p.id)));
  const scalony=usun.reduce((keep,copy)=>{const next={...keep};for(const [k,v] of Object.entries(copy)){if(k!=="id"&&(next[k]===undefined||next[k]===null||next[k]==="")&&v!==undefined&&v!==null&&v!=="")next[k]=v;}if(String(copy.opis||"").length>String(next.opis||"").length)next.opis=copy.opis;if(String(copy.opisKrotki||"").length>String(next.opisKrotki||"").length)next.opisKrotki=copy.opisKrotki;if((copy.zdjecia||[]).length>(next.zdjecia||[]).length)next.zdjecia=copy.zdjecia;return next;},{...grupa.canonical,id:grupa.canonical.id});
  const keepAdded=produktyDodane.findIndex(p=>String(p.id)===keepId);if(keepAdded>=0)produktyDodane[keepAdded]=scalony;else produktyEdytowane[keepId]={...(produktyEdytowane[keepId]||{}),...scalony,id:grupa.canonical.id};
  produktyDodane=produktyDodane.filter(p=>!ids.has(String(p.id)));
  koszDodanych=koszDodanych.filter(p=>!ids.has(String(p.id)));
  for(const p of usun){
    const id=p.id,key=String(id),jestBazowy=produktyBazoweWspolne().some(x=>String(x.id)===key);
    if(jestBazowy&&!produktyDefinitywne.some(x=>String(x)===key))produktyDefinitywne.push(id);
    produktyUkryte=produktyUkryte.filter(x=>String(x)!==key);
    delete produktyEdytowane[key];delete produktyEdytowane[id];delete stanyProduktow[key];delete stanyProduktow[id];delete dostepnoscProduktow[key];delete magazynProdukty[key];delete koszMeta[key];
    zaznaczoneProdukty.delete(id);zaznaczoneProdukty.delete(key);
  }
  produktyDefinitywne=[...new Map(produktyDefinitywne.map(x=>[String(x),x])).values()];
  if(ustawienia.mapaProduktow&&typeof ustawienia.mapaProduktow==="object"){const mapa={...ustawienia.mapaProduktow};ids.forEach(id=>delete mapa[id]);ustawienia={...ustawienia,mapaProduktow:mapa};}
  const kanoniczne={...(ustawienia.kanoniczneDuplikatySklepu||{})};delete kanoniczne[String(groupKey)];ustawienia={...ustawienia,kanoniczneDuplikatySklepu:kanoniczne};
  zapiszLS("artway_produkty_dodane",produktyDodane);zapiszLS("artway_kosz_dodane",koszDodanych);zapiszLS("artway_produkty_definitywne",produktyDefinitywne);zapiszLS("artway_produkty_ukryte",produktyUkryte);zapiszLS("artway_produkty_edytowane",produktyEdytowane);zapiszLS("artway_stany",stanyProduktow);zapiszLS("artway_dostepnosc",dostepnoscProduktow);zapiszLS("artway_magazyn_produkty",magazynProdukty);zapiszLS("artway_kosz_meta",koszMeta);zapiszLS("artway_ustawienia",ustawienia);
  zbudujProdukty();odswiezMenu();zapiszHistorieAgenta("katalog",`Trwale usunięto ${usun.length} powtarzające się rekordy; pozostawiono ${grupa.canonical.nazwa}`,{keepId:grupa.canonical.id,deletedIds:[...ids],groupKey});
  if(chmuraToken)await chmuraZapiszUstawienia();
  toast(`✅ Pozostawiono 1 kartę i trwale usunięto ${usun.length} kopii`);renderuj();
}
/* ── Magazyn ── */
const LIMIT_POTWIERDZENIA_DOSTEPNOSCI = 5;

function stanProduktu(p){ return (typeof p.stan==="number" && p.stan>=0) ? p.stan : null; }   // null = bez limitu
function produktMaCeneSprzedazy(p){ return Number(p?.cena)>0; }
function wpisDostepnosciProduktu(id){
  return (dostepnoscProduktow||{})[String(id)] || (dostepnoscProduktow||{})[id] || null;
}
function decyzjaProducentaInfo(p={}){
  const d=wpisDostepnosciProduktu(p?.id)||{},code=String(d.decision||d.decyzja||"").toLowerCase(),expiresAt=d.expiresAt||d.waznaDo||"",expiresMs=Date.parse(expiresAt||""),expired=code==="grace"&&Number.isFinite(expiresMs)&&expiresMs<=Date.now(),remainingHours=Number.isFinite(expiresMs)?Math.max(0,Math.ceil((expiresMs-Date.now())/3600000)):null;
  const meta={
    grace:{label:expired?"termin minął — sprzedaż wstrzymana":`sprzedaż pozostaje aktywna${remainingHours!==null?` • ${remainingHours} h`:""}`,cls:expired?"bad":"warn",ico:expired?"⛔":"⏳"},
    wait_available:{label:"ukryty do powrotu u producenta",cls:"info",ico:"🔄"},
    hide_manual:{label:"ukryty do ręcznego wznowienia",cls:"bad",ico:"⏸️"},
    manual_available:{label:"ręcznie pozostawiony w sprzedaży",cls:"warn",ico:"🟠"},
    auto:{label:"decyzję prowadzi automat producenta",cls:"info",ico:"🤖"}
  }[code]||null;
  return {record:d,code,expiresAt,expiresMs,expired,remainingHours,label:meta?.label||"brak decyzji administratora",cls:meta?.cls||"unknown",ico:meta?.ico||"❔",operator:d.operator||"",reason:d.reason||d.powod||"",history:Array.isArray(d.history)?d.history:[]};
}
function produktOznaczonyNiedostepny(p){
  const d=wpisDostepnosciProduktu(p?.id);
  const decision=decyzjaProducentaInfo(p);
  if(decision.code==="manual_available")return false;
  if(decision.code==="grace")return decision.expired;
  return !!d && String(d.status||"").toLowerCase()==="niedostepny";
}
function produktAutomatycznieNiedostepny(p){const d=wpisDostepnosciProduktu(p?.id);return produktOznaczonyNiedostepny(p)&&(d?.automatic===true||d?.source==="producent-agent");}
function powodNiedostepnosci(p){
  const d=wpisDostepnosciProduktu(p?.id);
  return String(d?.powod||"").trim();
}
function produktDostepnyWSprzedazy(p){
  return !!p && produktMaCeneSprzedazy(p) && !produktOznaczonyNiedostepny(p);
}
function odswiezDostepnoscProducentowWidoku(){
  if(typeof odswiezMonitoringProducentow==="function"&&odswiezMonitoringProducentow())return;
  renderuj();
}
async function ustawDostepnoscProduktu(id, status="dostepny", powod=""){
  const key=String(id);
  const s=String(status||"dostepny").toLowerCase();
  if(chmuraToken&&maUprawnieniaZapisuChmury()){
    toast(s==="niedostepny"?"⏳ Wstrzymuję sprzedaż w sklepie i na Allegro…":"⏳ Wznawiam sprzedaż w sklepie i na Allegro…");
    try{
      const d=await chmura("product-sale-availability",{method:"POST",body:{productId:id,available:s!=="niedostepny",reason:String(powod||"").trim()},timeout:120000});
      await chmuraWczytajStan();if(typeof allegroWczytajDane==="function")await allegroWczytajDane(true,false,"offers");zbudujProdukty();
      loguj("info",`Dostępność produktu ${id} zmieniona jako jedna operacja sklep + Allegro`);
      toast(s==="niedostepny"?`✅ Sprzedaż wstrzymana • sklep + Allegro (${d.saleAutomation?.allegroHidden||0} ofert)`:`✅ Sprzedaż wznowiona • sklep + Allegro (${d.saleAutomation?.allegroRestored||0} ofert)`);
    }catch(e){loguj("blad",`Spójna zmiana sprzedaży produktu ${id}: ${e.message||e}`);toast(`⛔ Niczego nie zmieniono — sklep i Allegro muszą potwierdzić operację razem: ${e.message||e}`);}
    odswiezDostepnoscProducentowWidoku();return;
  }
  if(s==="niedostepny")dostepnoscProduktow={...(dostepnoscProduktow||{}),[key]:{status:"niedostepny",powod:String(powod||"").trim(),data:new Date().toISOString(),operator:sesja?.email||"administrator",source:"manual",automatic:false}};
  else{dostepnoscProduktow={...(dostepnoscProduktow||{})};delete dostepnoscProduktow[key];delete dostepnoscProduktow[id];}
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zbudujProdukty();
  loguj("info",`Dostępność sprzedażowa: produkt ${id} → ${s}`);
  toast(s==="niedostepny"?"Produkt ukryty lokalnie — połącz wspólną bazę, aby wstrzymać również Allegro":"Produkt dostępny lokalnie — połącz wspólną bazę, aby wznowić również Allegro");
  odswiezDostepnoscProducentowWidoku();
}
function przelaczDostepnoscProduktu(id){
  const p=produktMagazynowy(id);
  if(!p)return;
  if(produktOznaczonyNiedostepny(p)){
    if(produktAutomatycznieNiedostepny(p)){
      toast("Status ustala kontrola producenta — sprawdzam dostępność ponownie");
      agentAISprawdzDostepnoscProducentow(1,[id]);
      return;
    }
    void ustawDostepnoscProduktu(id,"dostepny");
  }
  else {
    const powod=prompt("Powód niedostępności widoczny tylko w panelu (opcjonalnie):","chwilowo niedostępny");
    if(powod===null)return;
    void ustawDostepnoscProduktu(id,"niedostepny",powod);
  }
}
function dostepnoscBadgeAdmin(p){
  const automat=produktAutomatycznieNiedostepny(p);
  const decision=decyzjaProducentaInfo(p);
  return produktOznaczonyNiedostepny(p)
    ? `<span class="lvl lvl-blad">sprzedaż wstrzymana • sklep + Allegro${automat?" • automatycznie":""}</span>${powodNiedostepnosci(p)?`<br><small>${esc(powodNiedostepnosci(p))}</small>`:""}${decision.code?`<br><small>${decision.ico} ${esc(decision.label)}</small>`:""}`
    : `<span class="lvl lvl-ok">sprzedaż aktywna • oba kanały</span>${decision.code?`<br><small>${decision.ico} ${esc(decision.label)}</small>`:""}`;
}
function decyzjaProducentaDane(id,value="auto"){
  const p=produktMagazynowy(id),i=producentDostepnoscInfo(p||{}),current=decyzjaProducentaInfo(p||{}),now=new Date(),parts=String(value||"auto").split(":"),code=parts[0],days=Math.max(0,Math.min(30,Number(parts[1])||0)),history=[{at:now.toISOString(),decision:code,days,operator:sesja?.email||"administrator"},...current.history].slice(0,20),base={data:now.toISOString(),operator:sesja?.email||"administrator",source:"supplier-decision",automatic:false,producerStatus:i.status,producerCheckedAt:i.checked,history};
  if(code==="grace")return {...base,status:"dostepny",decision:"grace",expiresAt:new Date(now.getTime()+days*86400000).toISOString(),powod:`Decyzja administratora: pozostaw sprzedaż przez ${days} ${days===1?"dzień":"dni"}`,reason:`Pozostaw sprzedaż przez ${days} dni`};
  if(code==="wait_available")return {...base,status:"niedostepny",decision:code,autoRestore:true,powod:"Ukryty do ponownej dostępności u producenta",reason:"Automatycznie wznów po powrocie"};
  if(code==="hide_manual")return {...base,status:"niedostepny",decision:code,autoRestore:false,powod:"Ręcznie ukryty bez automatycznego wznowienia",reason:"Wznowienie wyłącznie decyzją administratora"};
  if(code==="manual_available")return {...base,status:"dostepny",decision:code,autoRestore:false,powod:"Ręcznie pozostawiony w sprzedaży mimo sygnału producenta",reason:"Ręczne utrzymanie sprzedaży"};
  if(i.status==="brak")return {...base,status:"niedostepny",decision:"auto",automatic:true,source:"producent-agent",autoRestore:true,powod:"Automatycznie: produkt niedostępny u producenta",reason:"Automatyczna decyzja wg producenta"};
  return null;
}
const DECYZJE_PRODUCENTA_OPCJE=[
  ["auto","🤖 Automat według producenta"],["grace:1","⏳ Zostaw sprzedaż jeszcze 1 dzień"],["grace:2","⏳ Zostaw sprzedaż jeszcze 2 dni"],["grace:3","⏳ Zostaw sprzedaż jeszcze 3 dni"],["grace:7","⏳ Zostaw sprzedaż jeszcze 7 dni"],["wait_available","🔄 Ukryj i wznów po powrocie"],["hide_manual","⏸️ Ukryj do mojej decyzji"],["manual_available","🟠 Pozostaw aktywny bez terminu"]
];
function decyzjaProducentaOpcjeHTML(selected="auto"){return DECYZJE_PRODUCENTA_OPCJE.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?"selected":""}>${esc(label)}</option>`).join("");}
function decyzjaProducentaEtykieta(value="auto"){return DECYZJE_PRODUCENTA_OPCJE.find(([key])=>key===value)?.[1]||"Wybrana decyzja";}
function zapiszDecyzjeProducentowLokalnie(ids=[],value="auto",historia=true){
  const unique=[...new Set((Array.isArray(ids)?ids:[]).map(String))].map(produktMagazynowy).filter(Boolean);if(!unique.length)return 0;
  dostepnoscProduktow={...(dostepnoscProduktow||{})};
  for(const p of unique){const next=decyzjaProducentaDane(p.id,value),key=String(p.id),i=producentDostepnoscInfo(p);if(next)dostepnoscProduktow[key]=next;else{delete dostepnoscProduktow[key];delete dostepnoscProduktow[p.id];}if(historia)zapiszHistorieAgenta("decyzja-producenta",`Decyzja sprzedażowa dla ${p.nazwa}: ${next?.reason||"automat — produkt dostępny"}`,{productId:p.id,decision:value,producerStatus:i.status,expiresAt:next?.expiresAt||null});}
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);zbudujProdukty();return unique.length;
}
async function ustawDecyzjeProducenta(id,value="auto"){
  const p=produktMagazynowy(id);if(!p)return;
  const next=decyzjaProducentaDane(id,value),key=String(id),i=producentDostepnoscInfo(p);
  if(maUprawnieniaZapisuChmury()){
    toast("⏳ Zapisuję jedną decyzję dla sklepu i Allegro…");
    try{const d=await chmura("product-sale-decision",{method:"POST",body:{productId:id,decision:String(value).split(":")[0],days:Number(String(value).split(":")[1])||0,producerStatus:i.status,producerQuantity:i.quantity,reason:next?.reason||"Automatyczna decyzja"},timeout:120000});await chmuraWczytajStan();if(typeof allegroWczytajDane==="function")await allegroWczytajDane(true,false,"offers");zbudujProdukty();toast(`✅ Jedna decyzja zapisana • sklep: ${d.available?"aktywny":"wstrzymany"} • Allegro: wstrzymano ${d.saleAutomation?.allegroHidden||0}, wznowiono ${d.saleAutomation?.allegroRestored||0}`);}
    catch(e){toast(`⛔ Niczego nie zmieniono — operacja sklep + Allegro nie została potwierdzona: ${e.message||e}`);}
  }else{
    dostepnoscProduktow={...(dostepnoscProduktow||{})};if(next)dostepnoscProduktow[key]=next;else{delete dostepnoscProduktow[key];delete dostepnoscProduktow[id];}
    zapiszLS("artway_dostepnosc",dostepnoscProduktow);zbudujProdukty();zapiszHistorieAgenta("decyzja-producenta",`Decyzja sprzedażowa dla ${p.nazwa}: ${next?.reason||"automat — produkt dostępny"}`,{productId:id,decision:value,producerStatus:i.status,expiresAt:next?.expiresAt||null});toast("Decyzja zapisana lokalnie — połącz wspólną bazę, aby zmienić oba kanały");
  }
  odswiezDostepnoscProducentowWidoku();
}
function zastosujWyborDecyzjiProducenta(id){const el=document.querySelector(`[data-supplier-decision="${CSS.escape(String(id))}"]`);if(el)void ustawDecyzjeProducenta(id,el.value);}
function ustawZaznaczenieDostepnosciProducentow(zakres,zaznacz=true){
  const ids=zakres==="strona"?dostepnoscProducentowStronaIds:zakres==="filtr"?dostepnoscProducentowWynikiIds:Array.isArray(zakres)?zakres:[];
  ids.slice(0,500).forEach(id=>zaznacz?zaznaczoneDostepnoscProducentow.add(String(id)):zaznaczoneDostepnoscProducentow.delete(String(id)));if(ids.length>500)toast("Zaznaczono bezpieczną partię 500 produktów");odswiezDostepnoscProducentowWidoku();
}
function wyczyscZaznaczenieDostepnosciProducentow(){zaznaczoneDostepnoscProducentow.clear();odswiezDostepnoscProducentowWidoku();}
async function zastosujGrupowaDecyzjeProducenta(){
  const select=document.querySelector("[data-supplier-bulk-decision]"),button=document.querySelector("[data-supplier-bulk-apply]"),value=String(select?.value||"auto"),ids=[...zaznaczoneDostepnoscProducentow].filter(id=>produktMagazynowy(id)).slice(0,500);
  if(!ids.length){toast("Zaznacz co najmniej jeden produkt");return;}if(!confirm(`${decyzjaProducentaEtykieta(value)} — zastosować do ${ids.length} zaznaczonych produktów?`))return;
  const parts=value.split(":"),items=ids.map(id=>{const p=produktMagazynowy(id),i=producentDostepnoscInfo(p);return{productId:id,decision:parts[0],days:Number(parts[1])||0,producerStatus:i.status,producerQuantity:i.quantity};});if(button){button.disabled=true;button.textContent=`⏳ Zapisuję ${ids.length}…`;}
  try{
    if(maUprawnieniaZapisuChmury()){const d=await chmura("product-sale-decision",{method:"POST",body:{items},timeout:180000});await chmuraWczytajStan();if(typeof allegroWczytajDane==="function")await allegroWczytajDane(true,false,"offers");zbudujProdukty();toast(`✅ Zapisano ${d.changed||ids.length} spójnych decyzji • Allegro: wstrzymano ${d.saleAutomation?.allegroHidden||0}, wznowiono ${d.saleAutomation?.allegroRestored||0}`);}else{zapiszDecyzjeProducentowLokalnie(ids,value,true);toast(`Zapisano lokalnie ${ids.length} decyzji — połącz wspólną bazę, aby zmienić oba kanały`);}
    ids.forEach(id=>zaznaczoneDostepnoscProducentow.delete(String(id)));
  }catch(e){toast(`⛔ Niczego nie zmieniono — operacja sklep + Allegro nie została potwierdzona: ${e.message||e}`);}
  odswiezDostepnoscProducentowWidoku();
}
function grupowaDecyzjaProducentaHTML(){const n=zaznaczoneDostepnoscProducentow.size;return `<div class="supplier-bulk-decision"><label><span>Decyzja dla zaznaczonych</span><select data-supplier-bulk-decision>${decyzjaProducentaOpcjeHTML("auto")}</select></label><button class="btn" type="button" data-supplier-bulk-apply onclick="zastosujGrupowaDecyzjeProducenta()" ${n?"":"disabled"}>Zastosuj do ${n}</button><small>Jedno potwierdzenie i jeden spójny zapis dla całej grupy. Sklep i powiązane oferty Allegro zmienią się dopiero po zatwierdzeniu.</small></div>`;}
function decyzjaProducentaPanelHTML(p={},i=producentDostepnoscInfo(p)){
  const d=decyzjaProducentaInfo(p),requires=["brak","niski"].includes(i.status)&&(!d.code||d.expired);
  const selected=zaznaczoneDostepnoscProducentow.has(String(p.id));
  return `<div class="supplier-sale-decision ${d.cls} ${requires?"requires":""} ${selected?"is-selected":""}"><label class="supplier-decision-select"><input type="checkbox" aria-label="Zaznacz ${esc(p.nazwa||"produkt")}" ${selected?"checked":""} onchange="ustawZaznaczenieDostepnosciProducentow([${jsArg(p.id)}],this.checked)"><span>${selected?"Zaznaczony do operacji grupowej":"Zaznacz produkt"}</span></label><div><b>${d.ico} ${esc(d.label)}</b><small>${d.expiresAt?`Do ${esc(new Date(d.expiresAt).toLocaleString("pl-PL"))}`:d.reason?esc(d.reason):requires?"Wybierz dalsze działanie sprzedażowe.":"Brak aktywnego wyjątku."}</small></div><select data-supplier-decision="${esc(p.id)}">${decyzjaProducentaOpcjeHTML("auto")}</select><button class="btn ${requires?"":"ghost"}" type="button" onclick="zastosujWyborDecyzjiProducenta(${jsArg(p.id)})">Zastosuj decyzję</button></div>`;
}
function stanMagazynuId(id){
  if(stanyProduktow[id]===undefined || stanyProduktow[id]===null || stanyProduktow[id]==="") return null;
  const n=Number(stanyProduktow[id]);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}
function produktMagazynowy(id){ return produktyDoAdministracji().find(p=>String(p.id)===String(id)) || produkty.find(p=>String(p.id)===String(id)) || null; }
function ustawieniaMagazynuPelne(){
  return {
    nazwa:"Magazyn główny",
    progNiski:5,
    lokalizacja:"",
    domyslnyOperator:sesja?.email||"administrator",
    domyslnyDostawca:"",
    domyslnyLeadTime:7,
    domyslnyZapasDni:21,
    progNiskiProducenta:50,
    producentProbka:8,
    producentMaxWiekGodz:48,
    ...(ustawieniaMagazynu||{})
  };
}
function intNieujemny(v, dom=0){
  const n=parseInt(String(v??"").replace(/[^0-9-]/g,""),10);
  return Number.isFinite(n) ? Math.max(0,n) : dom;
}
function magazynMetaProduktu(id){
  const raw=(magazynProdukty||{})[String(id)] || (magazynProdukty||{})[id] || {};
  return raw && typeof raw==="object" ? raw : {};
}
function zapiszMagazynMeta(id, meta){
  const key=String(id);
  const czysty={
    lokalizacja:String(meta.lokalizacja||"").trim(),
    dostawca:String(meta.dostawca||"").trim(),
    kod:String(meta.kod||"").trim(),
    minStock:meta.minStock===""||meta.minStock===null||meta.minStock===undefined?"":intNieujemny(meta.minStock,0),
    targetStock:meta.targetStock===""||meta.targetStock===null||meta.targetStock===undefined?"":intNieujemny(meta.targetStock,0),
    leadTime:meta.leadTime===""||meta.leadTime===null||meta.leadTime===undefined?"":intNieujemny(meta.leadTime,0),
    minZakup:meta.minZakup===""||meta.minZakup===null||meta.minZakup===undefined?"":intNieujemny(meta.minZakup,0),
    uwagi:String(meta.uwagi||"").trim(),
    ostatniaInwentaryzacja:String(meta.ostatniaInwentaryzacja||"").trim(),
    aktualizacja:new Date().toISOString(),
    operator:sesja?.email||"administrator"
  };
  const maDane=Object.entries(czysty).some(([k,v])=>!["aktualizacja","operator"].includes(k)&&String(v||"").trim()!=="");
  magazynProdukty={...(magazynProdukty||{})};
  if(maDane) magazynProdukty[key]=czysty;
  else delete magazynProdukty[key];
  zapiszLS("artway_magazyn_produkty",magazynProdukty);
  return czysty;
}
function kodLokalizacjiMagazynu(v=""){
  const mapa={"ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z"};
  return String(v||"").trim().toLowerCase()
    .replace(/[ąćęłńóśźż]/g,m=>mapa[m]||m)
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]+/g,"-")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"")
    .slice(0,40);
}
let magazynLokalizacjeIndexCache={source:null,lista:[],aktywne:[],poKodzie:new Map(),sciezki:new Map(),sciezkiNazw:new Map(),poziomy:new Map(),opcjeHTML:""};
function magazynLokalizacjeIndex(){
  const source=Array.isArray(magazynLokalizacje)?magazynLokalizacje:[];
  if(magazynLokalizacjeIndexCache.source===source)return magazynLokalizacjeIndexCache;
  const lista=source.filter(Boolean),poKodzie=new Map();
  lista.forEach(l=>{const kod=kodLokalizacjiMagazynu(l.kod);if(kod&&!poKodzie.has(kod))poKodzie.set(kod,l);});
  const sciezki=new Map(),sciezkiNazw=new Map(),poziomy=new Map();
  const policz=(rawKod)=>{
    const kod=kodLokalizacjiMagazynu(rawKod);if(sciezki.has(kod))return;
    const kody=[],nazwy=[],seen=new Set();let current=poKodzie.get(kod)||null,guard=0;
    while(current&&guard++<20){
      const currentKod=kodLokalizacjiMagazynu(current.kod);if(!currentKod||seen.has(currentKod))break;
      seen.add(currentKod);kody.unshift(String(current.kod||currentKod));nazwy.unshift(String(current.nazwa||current.kod||currentKod));
      current=current.parentKod?poKodzie.get(kodLokalizacjiMagazynu(current.parentKod))||null:null;
    }
    sciezki.set(kod,kody.join(" / ")||String(rawKod||""));sciezkiNazw.set(kod,nazwy.join(" → ")||String(rawKod||""));poziomy.set(kod,Math.max(0,kody.length-1));
  };
  lista.forEach(l=>policz(l.kod));
  // Starsze rekordy typu „miejsce” pozostają w indeksie tylko po to, aby
  // historyczne dokumenty i etykiety nadal dawały się odczytać. W bieżącej
  // pracy magazynu ostatnim poziomem jest półka.
  const aktywne=lista.filter(l=>l.aktywna!==false&&l.typ!=="miejsce").sort((a,b)=>{
    const ka=kodLokalizacjiMagazynu(a.kod),kb=kodLokalizacjiMagazynu(b.kod);
    return String(sciezki.get(ka)||ka).localeCompare(String(sciezki.get(kb)||kb),"pl",{numeric:true})||(Number(a.priorytet)||9999)-(Number(b.priorytet)||9999);
  });
  const opcjeHTML=aktywne.map(l=>{const kod=kodLokalizacjiMagazynu(l.kod),opis=`${"\u00b7 ".repeat(poziomy.get(kod)||0)}${l.kod}${l.nazwa?` — ${l.nazwa}`:""} [${l.typ||"miejsce"}]`;return `<option value="${esc(l.kod)}">${esc(opis)}</option>`;}).join("");
  magazynLokalizacjeIndexCache={source,lista,aktywne,poKodzie,sciezki,sciezkiNazw,poziomy,opcjeHTML};return magazynLokalizacjeIndexCache;
}
function magazynLokalizacjeAktywne(){return magazynLokalizacjeIndex().aktywne;}
function magazynLokalizacjaPoKodzie(kod){return magazynLokalizacjeIndex().poKodzie.get(kodLokalizacjiMagazynu(kod))||null;}
function magazynPolkaPoKodzie(kod){
  let location=magazynLokalizacjaPoKodzie(kod),guard=0;
  while(location&&location.typ!=="półka"&&guard++<12)location=location.parentKod?magazynLokalizacjaPoKodzie(location.parentKod):null;
  return location?.typ==="półka"?location:null;
}
function nazwaLokalizacjiMagazynu(kod){
  const l=magazynLokalizacjaPoKodzie(kod);
  return l?`${l.kod}${l.nazwa?` — ${l.nazwa}`:""}`:String(kod||"");
}
function sciezkaLokalizacjiMagazynu(kod){const key=kodLokalizacjiMagazynu(kod);return magazynLokalizacjeIndex().sciezki.get(key)||String(kod||"");}
function poziomLokalizacjiMagazynu(kod){return magazynLokalizacjeIndex().poziomy.get(kodLokalizacjiMagazynu(kod))||0;}
function sciezkaNazwLokalizacjiMagazynu(kod){const key=kodLokalizacjiMagazynu(kod);return magazynLokalizacjeIndex().sciezkiNazw.get(key)||String(kod||"");}
function czyLokalizacjaBezLimitu(location){return !location||location.bezLimitu===true||!(Number(location.pojemnosc)>0);}
function magazynLiteraRegalu(index=1){let n=Math.max(1,Math.trunc(Number(index)||1)),out="";while(n>0){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}return out;}
function magazynIndeksRegalu(value="A"){
  const text=String(value||"A").trim().toUpperCase();if(/^\d+$/.test(text))return Math.max(1,Number(text)||1);
  return Math.max(1,[...text.replace(/[^A-Z]/g,"")].reduce((sum,char)=>sum*26+char.charCodeAt(0)-64,0)||1);
}
function zapiszLokalizacjeMagazynuWspolnie(opis="Zapisano lokalizacje"){
  zapiszLS("artway_magazyn_lokalizacje",magazynLokalizacje);
  zapiszHistorieAgenta("lokalizacja",opis,{liczba:magazynLokalizacjeAktywne().length});
  if(chmuraToken)void chmuraZapiszUstawienia();
}
function selectLokalizacjiMagazynu(value=""){
  const raw=String(value||"").trim(),v=magazynPolkaPoKodzie(raw)?.kod||raw, aktywne=magazynLokalizacjeAktywne();
  return `<select name="lokalizacja">
    <option value="" ${!v?"selected":""}>— brak lokalizacji —</option>
    ${aktywne.map(l=>`<option value="${esc(l.kod)}" ${v===l.kod?"selected":""}>${"· ".repeat(poziomLokalizacjiMagazynu(l.kod))}${esc(l.kod)}${l.nazwa?` — ${esc(l.nazwa)}`:""} [${esc(l.typ||"miejsce")}]</option>`).join("")}
    ${v&&!aktywne.some(l=>l.kod===v)?`<option value="${esc(v)}" selected>${esc(v)} — spoza słownika</option>`:""}
  </select>`;
}
function poleLokalizacjiMagazynu(value="",listId="warehouseLocationOptions"){
  const raw=String(value||"").trim(),normalized=magazynPolkaPoKodzie(raw)?.kod||raw;return `<input name="lokalizacja" list="${esc(listId)}" value="${esc(normalized)}" placeholder="Wpisz lub wybierz kod półki" autocomplete="off">`;
}
function magazynLokalizacjeDatalistHTML(id="warehouseLocationOptions"){
  return `<datalist id="${esc(id)}">${magazynLokalizacjeIndex().opcjeHTML}</datalist>`;
}
function statystykiLokalizacji(produktyLista=produktyDoAdministracji()){
  // Podstrona lokalizacji działa bez ciężkiego modułu operacji magazynowych.
  // Po jego doładowaniu statystyki automatycznie uwzględniają rezerwacje.
  const rez=typeof rezerwacjeMagazynowe==="function"?rezerwacjeMagazynowe():{}, mapa={};
  produktyLista.filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    const meta=magazynMetaProduktu(p.id), rawKod=String(meta.lokalizacja||"").trim(),kod=magazynPolkaPoKodzie(rawKod)?.kod||rawKod||"BRAK";
    const stan=stanMagazynuId(p.id), rezerwacje=Number(rez[p.id]||0);
    const rec=mapa[kod]||(mapa[kod]={kod,produkty:0,sztuki:0,rezerwacje:0,wartosc:0,brakiKartoteki:0});
    rec.produkty++;
    if(stan!==null){ rec.sztuki+=stan; rec.wartosc+=stan*kwotaNum(p.cena); }
    rec.rezerwacje+=rezerwacje;
    if(!meta.dostawca||!meta.lokalizacja) rec.brakiKartoteki++;
  });
  const direct=Object.entries(mapa).filter(([kod])=>kod!=="BRAK").map(([kod,rec])=>[kod,{...rec}]);
  for(const [kod,rec] of direct){let parent=magazynLokalizacjaPoKodzie(kod)?.parentKod||"",guard=0,seen=new Set([kod]);while(parent&&guard++<10&&!seen.has(parent)){seen.add(parent);const sum=mapa[parent]||(mapa[parent]={kod:parent,produkty:0,sztuki:0,rezerwacje:0,wartosc:0,brakiKartoteki:0});sum.produkty+=rec.produkty;sum.sztuki+=rec.sztuki;sum.rezerwacje+=rec.rezerwacje;sum.wartosc+=rec.wartosc;sum.brakiKartoteki+=rec.brakiKartoteki;parent=magazynLokalizacjaPoKodzie(parent)?.parentKod||"";}}
  return mapa;
}
function zapiszLokalizacjeMagazynu(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const kod=kodLokalizacjiMagazynu(f.get("kod"));
  if(!kod){ toast("Podaj kod lokalizacji, np. R1-P2"); return false; }
  const originalKod=kodLokalizacjiMagazynu(f.get("originalKod")),teraz=new Date().toISOString(), istnieje=magazynLokalizacjaPoKodzie(originalKod||kod),limit=Number(String(f.get("pojemnosc")||"0").replace(",","."))||0,bezLimitu=f.get("bezLimitu")==="on"||limit<=0;
  if(originalKod&&originalKod!==kod){toast("Kod zapisanej lokalizacji jest stały. Utwórz nową półkę, aby użyć innego kodu.");return false;}
  const rec={
    id:istnieje?.id||("LOC-"+Date.now().toString(36)),
    kod,
    nazwa:String(f.get("nazwa")||"").trim(),
    typ:String(f.get("typ")||"regał").trim(),
    strefa:String(f.get("strefa")||"").trim(),
    parentKod:kodLokalizacjiMagazynu(f.get("parentKod")),
    kodKreskowy:String(f.get("kodKreskowy")||"").trim(),
    szerokosc:intNieujemny(f.get("szerokosc"),0),
    glebokosc:intNieujemny(f.get("glebokosc"),0),
    wysokosc:intNieujemny(f.get("wysokosc"),0),
    maxWaga:Math.max(0,Number(String(f.get("maxWaga")||"0").replace(",","."))||0),
    pojemnosc:0,
    bezLimitu:true,
    priorytet:intNieujemny(f.get("priorytet"),999),
    uwagi:String(f.get("uwagi")||"").trim(),
    aktywna:true,
    utworzono:istnieje?.utworzono||teraz,
    aktualizacja:teraz,
    operator:sesja?.email||"administrator"
  };
  if(rec.typ==="miejsce"){toast("Miejsca nie są już osobnym poziomem. Wybierz lub utwórz półkę.");return false;}
  const bez=(Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).filter(l=>kodLokalizacjiMagazynu(l.kod)!==kod);
  if(rec.parentKod===kod){toast("Lokalizacja nie może być swoim rodzicem");return false;}
  if(rec.parentKod&&!magazynLokalizacjaPoKodzie(rec.parentKod)){toast("Najpierw utwórz wskazaną lokalizację nadrzędną");return false;}
  if(rec.parentKod&&sciezkaLokalizacjiMagazynu(rec.parentKod).split(" / ").includes(kod)){toast("Nie można utworzyć pętli w hierarchii lokalizacji");return false;}
  magazynLokalizacje=[rec,...bez].slice(0,5000);
  zapiszLokalizacjeMagazynuWspolnie(`${istnieje?"Zaktualizowano":"Utworzono"} lokalizację magazynową ${kod}`);
  toast(`${istnieje?"Zaktualizowano":"Utworzono"} lokalizację ${kod} ✅`);
  if(typeof nowaLokalizacjaMagazynu==="function")nowaLokalizacjaMagazynu();else e.target.reset();
  renderuj();
  return false;
}
function edytujLokalizacjeMagazynu(kod){
  const l=magazynLokalizacjaPoKodzie(kod);
  if(!l){ toast("Nie znaleziono lokalizacji"); return; }
  if(typeof magazynOtworzKreatorLokalizacji==="function"){magazynOtworzKreatorLokalizacji(l.typ,l.parentKod,l.kod);return;}
  const form=$("warehouseLocationForm");
  if(!form) return;
  ["kod","nazwa","typ","strefa","parentKod","kodKreskowy","szerokosc","glebokosc","wysokosc","maxWaga","pojemnosc","priorytet","uwagi"].forEach(k=>{ if(form.elements[k]) form.elements[k].value=l[k]??""; });
  if(form.elements.originalKod)form.elements.originalKod.value=l.kod;
  if(form.elements.kod)form.elements.kod.readOnly=true;
  if(form.elements.bezLimitu){form.elements.bezLimitu.checked=czyLokalizacjaBezLimitu(l);if(form.elements.pojemnosc)form.elements.pojemnosc.disabled=form.elements.bezLimitu.checked;}
  form.querySelector("[data-location-form-title]")?.replaceChildren(document.createTextNode(`✏️ Edycja: ${sciezkaNazwLokalizacjiMagazynu(l.kod)}`));
  form.scrollIntoView({behavior:"smooth",block:"center"});
  form.elements.kod?.focus();
}
function usunLokalizacjeMagazynu(kod){
  const k=kodLokalizacjiMagazynu(kod), stat=statystykiLokalizacji()[k];
  const msg=stat&&stat.produkty?`Lokalizacja ${k} ma przypisane ${stat.produkty} produktów. Ukryć ją w słowniku? Przypisania przy produktach zostaną jako tekst.`:`Ukryć lokalizację ${k}?`;
  if(!confirm(msg)) return;
  magazynLokalizacje=(Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).map(l=>kodLokalizacjiMagazynu(l.kod)===k?{...l,aktywna:false,aktualizacja:new Date().toISOString()}:l);
  zapiszLokalizacjeMagazynuWspolnie(`Ukryto lokalizację magazynową ${k}`);
  toast(`Ukryto lokalizację ${k}`);
  renderuj();
}
function generujRegalyIPolkiMagazynu(e){
  // Kanoniczna hierarchia fizyczna: obszar → regał → półka. Półka nie ma limitu sztuk.
  e.preventDefault();const f=new FormData(e.target),zone=kodLokalizacjiMagazynu(f.get("strefaKod")||"PAK"),zoneName=String(f.get("strefaNazwa")||"Pakownia").trim()||"Pakownia",rackMode=String(f.get("trybRegalow")||"litery"),rackCount=Math.max(1,Math.min(100,intNieujemny(f.get("regaly"),1))),shelfCount=Math.max(1,Math.min(200,intNieujemny(f.get("polki"),5))),startRack=magazynIndeksRegalu(f.get("startRegal")||"A"),startShelf=Math.max(1,intNieujemny(f.get("startPolka"),1)),now=new Date().toISOString();
  if(!zone){toast("Podaj kod obszaru, np. PAK");return false;}
  const requested=1+rackCount+rackCount*shelfCount;if(requested>5000){toast(`Wybrana struktura ma ${requested} elementów. Podziel tworzenie na mniejsze obszary (maks. 5000 elementów jednorazowo).`);return false;}
  const existing=new Map((Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).map(l=>[kodLokalizacjiMagazynu(l.kod),l])),created=[];let overflow=false;
  const put=(rec)=>{const old=existing.get(rec.kod);if(old&&old.aktywna!==false)return;if(!old&&existing.size>=5000){overflow=true;return;}const next={...old,id:old?.id||`LOC-${Date.now().toString(36)}-${created.length}`,aktywna:true,utworzono:old?.utworzono||now,aktualizacja:now,operator:sesja?.email||"administrator",...rec};existing.set(rec.kod,next);created.push(next);};
  put({kod:zone,nazwa:zoneName,typ:"strefa",parentKod:"",strefa:zone,priorytet:1,pojemnosc:0,bezLimitu:true,uwagi:"Obszar wygenerowany w kreatorze struktury"});
  for(let r=0;r<rackCount;r++){
    const rackLabel=rackMode==="numery"?String(startRack+r):magazynLiteraRegalu(startRack+r),rack=`${zone}-R${rackLabel}`;put({kod:rack,nazwa:`Regał ${rackLabel}`,typ:"regał",parentKod:zone,strefa:zone,priorytet:10+r,pojemnosc:0,bezLimitu:true,uwagi:""});
    for(let s=0;s<shelfCount;s++){
      const shelfNo=startShelf+s,shelf=`${rack}-P${String(shelfNo).padStart(2,"0")}`;put({kod:shelf,nazwa:`Półka ${shelfNo}`,typ:"półka",parentKod:rack,strefa:zone,priorytet:100+r*100+s,pojemnosc:0,bezLimitu:true,uwagi:""});
    }
  }
  if(overflow){toast("Struktura przekracza limit 5000 aktywnych elementów. Zmniejsz liczbę regałów lub półek.");return false;}
  magazynLokalizacje=[...existing.values()].slice(0,5000);zapiszLokalizacjeMagazynuWspolnie(`Generator utworzył ${created.length} elementów struktury magazynu`);toast(created.length?`✅ Utworzono ${created.length} nowych elementów: obszar, regały i półki`:"Wszystkie wskazane lokalizacje już istnieją");renderuj();return false;
}
function ustawLokalizacjeProduktu(id,kod){
  const meta=magazynMetaProduktu(id);
  zapiszMagazynMeta(id,{...meta,lokalizacja:String(kod||"").trim()});
  toast("Lokalizacja produktu zapisana ✅");
  renderuj();
}
function zapiszKartotekeMagazynu(e,id){
  e.preventDefault();
  const f=new FormData(e.target);
  zapiszMagazynMeta(id,{
    lokalizacja:f.get("lokalizacja"),
    dostawca:f.get("dostawca"),
    kod:f.get("kod"),
    optimaCode:f.get("optimaCode"),
    kodDostawcy:f.get("kodDostawcy"),
    minStock:f.get("minStock"),
    targetStock:f.get("targetStock"),
    leadTime:f.get("leadTime"),
    minZakup:f.get("minZakup"),
    uwagi:f.get("uwagi"),
    ostatniaInwentaryzacja:magazynMetaProduktu(id).ostatniaInwentaryzacja||""
  });
  loguj("info","Zapisano kartotekę magazynową produktu "+id);
  toast("Kartoteka magazynowa zapisana ✅");
  renderuj();
}
function oznaczInwentaryzacjeProduktu(id){
  const meta=magazynMetaProduktu(id);
  zapiszMagazynMeta(id,{...meta,ostatniaInwentaryzacja:new Date().toISOString().slice(0,10)});
  zapiszRuchMagazynowy({produktId:id,typ:"inwentaryzacja",ilosc:0,stanPrzed:stanMagazynuId(id),stanPo:stanMagazynuId(id),powod:"Potwierdzono stan w panelu magazynu"});
  toast("Inwentaryzacja produktu oznaczona ✅");
  renderuj();
}
function potwierdzWidoczneStanyMagazynu(ids=[]){
  const data=new Date().toISOString().slice(0,10);let ile=0;
  ids.forEach(id=>{const meta=magazynMetaProduktu(id);zapiszMagazynMeta(id,{...meta,ostatniaInwentaryzacja:data});ile++;});
  zapiszHistorieAgenta("inwentaryzacja",`Potwierdzono widoczne stany magazynowe: ${ile}`,{ids:ids.slice(0,500)});
  toast(`Potwierdzono inwentaryzację ${ile} produktów ✅`);renderuj();
}
function progNiskiProduktu(p){
  const u=ustawieniaMagazynuPelne(), meta=magazynMetaProduktu(p?.id);
  return meta.minStock!=="" && meta.minStock!==undefined ? intNieujemny(meta.minStock,Number(u.progNiski)||5) : Math.max(0,Number(u.progNiski)||5);
}
function targetStockProduktu(p, sprzedaz30=0){
  const u=ustawieniaMagazynuPelne(), meta=magazynMetaProduktu(p?.id), min=progNiskiProduktu(p), lead=leadTimeProduktu(p);
  if(meta.targetStock!=="" && meta.targetStock!==undefined) return Math.max(min,intNieujemny(meta.targetStock,min));
  const srednioDziennie=Math.max(0,Number(sprzedaz30||0)/30);
  const zapasDni=Math.max(7,Number(u.domyslnyZapasDni)||21);
  return Math.max(min+Math.max(3,min), Math.ceil(srednioDziennie*(lead+zapasDni)), min);
}
function leadTimeProduktu(p){
  const u=ustawieniaMagazynuPelne(), meta=magazynMetaProduktu(p?.id);
  return meta.leadTime!=="" && meta.leadTime!==undefined ? intNieujemny(meta.leadTime,Number(u.domyslnyLeadTime)||7) : Math.max(0,Number(u.domyslnyLeadTime)||7);
}
function dostepneSztukiMagazynu(p, rez={}){
  const stan=stanMagazynuId(p?.id);
  return stan===null ? null : stan-Number(rez[p.id]||0);
}
function sugestiaZatowarowania(p, rez={}, sprzedaz={}){
  const stan=stanMagazynuId(p.id), r=Number(rez[p.id]||0), sp=Number(sprzedaz[p.id]||0);
  const dost=stan===null?null:stan-r, min=progNiskiProduktu(p), lead=leadTimeProduktu(p), target=targetStockProduktu(p,sp);
  const avg=Math.max(0,sp/30), dniPokrycia=(dost===null||avg<=0)?null:Math.floor(Math.max(0,dost)/avg);
  const meta=magazynMetaProduktu(p.id);
  let ilosc=0, poziom="ok", powod="Brak braków do aktywnych zamówień.";
  if(stan!==null){
    if(dost<0){
      ilosc=Math.abs(dost);
      poziom="bad";
      powod=dost<0?`Rezerwacje przekraczają stan o ${Math.abs(dost)} szt.`:(stan===0?"Brak stanu magazynowego.":`Dostępne ${dost} szt., próg ${min}.`);
    }else if(r>0){
      powod=`Stan wystarcza na aktywne zamówienia. Po rezerwacjach zostaje ${dost} szt.`;
    }
  }else{
    powod="Produkt bez monitorowanego stanu — nie trafia do planu braków zamówień.";
  }
  return {produkt:p,stan,rezerwacje:r,dostepne:dost,sprzedaz30:sp,min,lead,target,dniPokrycia,ilosc,poziom,powod,meta};
}
function planZatowarowania(){
  const revision=Number(typeof adminRewizjaDanych!=="undefined"?adminRewizjaDanych:0)||0,produktyLista=produktyDoAdministracji(),cached=planZatowarowania._cache;
  if(cached&&cached.revision===revision&&cached.produkty===produktyLista)return cached.value;
  const rez=rezerwacjeMagazynowe(), spr=sprzedazMagazynowa(30);
  const value=produktyLista.filter(p=>!czyProduktAdminWKoszu(p)).map(p=>sugestiaZatowarowania(p,rez,spr)).sort((a,b)=>{
    const pa=a.poziom==="bad"?0:a.poziom==="warn"?1:2, pb=b.poziom==="bad"?0:b.poziom==="warn"?1:2;
    return pa-pb || Number(b.ilosc||0)-Number(a.ilosc||0) || String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl");
  });
  planZatowarowania._cache={revision,produkty:produktyLista,value};return value;
}
function potrzebyZatowarowania(){ return planZatowarowania().filter(x=>Number(x.ilosc)>0); }

function zapiszHistorieAgenta(typ, opis, dane={}){
  const rec={id:"AI-"+Date.now().toString(36),typ,opis,data:new Date().toISOString(),dataTxt:new Date().toLocaleString("pl-PL"),operator:sesja?.email||"administrator",dane};
  agentAIHistoria=[rec,...(Array.isArray(agentAIHistoria)?agentAIHistoria:[])].slice(0,500);
  zapiszLS("artway_agent_ai_historia",agentAIHistoria);
  return rec;
}
function normalizujUrlProducenta(url=""){
  try{
    const raw=String(url||"").trim().replace(/https\/\//gi,"https://").replace(/http\/\//gi,"http://");
    const starts=[...raw.matchAll(/https?:\/\//gi)].map(m=>m.index),candidate=starts.length>1?raw.slice(starts[starts.length-1]):raw;
    const u=new URL(candidate);
    ["query_id","utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach(k=>u.searchParams.delete(k));
    u.hash="";
    return u.toString();
  }catch(e){ return String(url||"").trim(); }
}
function brakiDanychProducenta(p={}, dane={}){
  const b=[];
  if(!p.nazwa)b.push("nazwa");
  if(!p.cena)b.push("cena");
  if(!(p.gtin||p.ean))b.push("EAN");
  if(!(p.mpn||p.kodProducenta||p.externalId))b.push("kod producenta/MPN");
  if(!poprawnaNazwaProducenta(p.producent||p.marka))b.push("producent");
  if(!p.zdjecie)b.push("zdjęcie");
  if(!p.opisKrotki)b.push("krótki opis");
  if(!p.opis)b.push("opis");
  if(!p.dostepnoscProducenta||p.dostepnoscProducenta==="do sprawdzenia")b.push("dostępność");
  (Array.isArray(dane.missing)?dane.missing:[]).forEach(x=>{if(x&&!b.includes(x))b.push(x);});
  return b;
}
function agentAIKluczProduktu(v=""){
  return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function agentAITokenyProduktu(v=""){
  return new Set(agentAIKluczProduktu(v).split(/\s+/).filter(x=>x.length>2&&!['oraz','dla','zestaw','produkt','sztuki','sztuka'].includes(x)));
}
function agentAIPodobienstwoProduktu(a="",b=""){
  const aa=agentAITokenyProduktu(a),bb=agentAITokenyProduktu(b);if(!aa.size||!bb.size)return 0;
  const wsp=[...aa].filter(x=>bb.has(x)).length,union=new Set([...aa,...bb]).size;
  return union?wsp/union:0;
}
function agentAIDuplikatyProduktu(p={}){
  const kod=(v)=>agentAIKluczProduktu(v),ean=kod(p.gtin||p.ean),external=kod(p.externalId||p.sku),mpn=kod(p.mpn||p.kodProducenta),url=normalizujUrlProducenta(p.sourceUrl||p.producentUrl||""),name=kod(p.nazwa||p.name);
  return produktyDoAdministracji().filter(x=>!czyProduktAdminWKoszu(x)&&String(x.id)!==String(p.id??"")).map(x=>{
    const reasons=[];let score=0,blocking=false;
    const xEan=kod(x.gtin||x.ean),xExternal=kod(x.externalId||x.sku),xMpn=kod(x.mpn||x.kodProducenta),xUrl=normalizujUrlProducenta(x.sourceUrl||x.producentUrl||""),xName=kod(x.nazwa||x.name);
    if(ean&&xEan===ean){reasons.push("ten sam EAN");score=100;blocking=true;}
    if(url&&xUrl&&xUrl===url){reasons.push("ten sam link producenta");score=Math.max(score,100);blocking=true;}
    if(external&&external.length>=3&&xExternal===external){reasons.push("ten sam EXTERNAL_ID/SKU");score=Math.max(score,98);blocking=true;}
    if(mpn&&mpn.length>=3&&xMpn===mpn){reasons.push("ten sam kod producenta");score=Math.max(score,96);blocking=true;}
    const similarity=agentAIPodobienstwoProduktu(name,xName);
    if(name&&xName===name){reasons.push("identyczna nazwa");score=Math.max(score,90);}
    else if(similarity>=.72){reasons.push(`bardzo podobna nazwa ${Math.round(similarity*100)}%`);score=Math.max(score,Math.round(70+similarity*20));}
    return reasons.length?{product:x,score,reasons,blocking,similarity}:null;
  }).filter(Boolean).sort((a,b)=>Number(b.blocking)-Number(a.blocking)||b.score-a.score).slice(0,8);
}
function agentAIDobierzKategorieProduktu(p={}){
  const categories=wszystkieKategorie().filter(Boolean),raw=String(p.kategoria||"").trim(),rawKey=agentAIKluczProduktu(raw);
  const exact=categories.find(x=>agentAIKluczProduktu(x)===rawKey);
  if(exact)return {name:exact,confidence:100,reason:"kategoria producenta istnieje w sklepie"};
  const near=rawKey&&categories.find(x=>agentAIKluczProduktu(x).includes(rawKey)||rawKey.includes(agentAIKluczProduktu(x)));
  if(near)return {name:near,confidence:90,reason:"dopasowano kategorię producenta do katalogu"};
  const name=String(p.nazwa||p.name||""),producer=agentAIKluczProduktu(p.producent||p.marka),scores=new Map();
  for(const x of produktyDoAdministracji().filter(x=>!czyProduktAdminWKoszu(x)&&x.kategoria)){
    let score=agentAIPodobienstwoProduktu(name,x.nazwa||x.name||"");
    if(producer&&producer===agentAIKluczProduktu(x.producent||x.marka))score+=.08;
    if(score<.22)continue;
    const current=scores.get(x.kategoria)||{name:x.kategoria,score:0,count:0,example:x.nazwa||""};current.score=Math.max(current.score,score);current.count++;scores.set(x.kategoria,current);
  }
  const best=[...scores.values()].sort((a,b)=>(b.score+Math.min(.12,b.count*.02))-(a.score+Math.min(.12,a.count*.02)))[0];
  if(best&&(best.score+Math.min(.12,best.count*.02))>=.38)return {name:best.name,confidence:Math.min(89,Math.round((best.score+Math.min(.12,best.count*.02))*100)),reason:`podobny produkt: ${best.example}`};
  return {name:raw||"",confidence:raw?55:0,reason:raw?"kategoria ze strony wymaga sprawdzenia":"brak pewnego dopasowania kategorii"};
}
function agentAIOcenaDodaniaProduktu(p={},d={}){
  const category=agentAIDobierzKategorieProduktu(p),product={...p,kategoria:category.name||p.kategoria||""},duplicates=agentAIDuplikatyProduktu(product),blockingDuplicate=duplicates.find(x=>x.blocking),blockers=[],warnings=[];
  if(!String(product.nazwa||"").trim())blockers.push("brak nazwy");
  if(!(Number(product.cena)>0))blockers.push("brak poprawnej ceny");
  if(!String(product.kategoria||"").trim())blockers.push("brak kategorii sklepu");
  if(d.needsChoice)blockers.push("najpierw wybierz właściwy produkt");
  if(blockingDuplicate)blockers.push(`duplikat produktu #${blockingDuplicate.product.id}`);
  if(!(product.gtin||product.ean))warnings.push("brak EAN");
  if(!(product.mpn||product.kodProducenta||product.externalId))warnings.push("brak kodu producenta");
  if(!poprawnaNazwaProducenta(product.producent||product.marka))blockers.push("brak prawidłowej nazwy producenta");
  if(!product.zdjecie)warnings.push("brak zdjęcia głównego");
  if(String(product.opisKrotki||"").length<40)warnings.push("krótki opis wymaga rozwinięcia");
  if(String(product.opis||"").length<150)warnings.push("pełny opis jest zbyt krótki");
  const dataScore=Math.max(0,Math.min(100,Math.round((product.nazwa?15:0)+(Number(product.cena)>0?15:0)+(product.kategoria?10:0)+((product.gtin||product.ean)?15:0)+((product.mpn||product.kodProducenta||product.externalId)?10:0)+(product.zdjecie?10:0)+(String(product.opisKrotki||"").length>=40?10:0)+(String(product.opis||"").length>=150?10:0)+(poprawnaNazwaProducenta(product.producent||product.marka)?5:0))));
  const score=d.needsChoice?Math.min(dataScore,45):blockingDuplicate?Math.min(dataScore,75):blockers.length?Math.min(dataScore,65):dataScore;
  return {product,category,duplicates,blockingDuplicate,blockers,warnings,dataScore,score,ready:!blockers.length};
}
function agentAIProduktZFormularzaDoOceny(form,fallback={}){
  if(!form)return fallback;const v=(name)=>String(form.elements[name]?.value||"").trim(),n=(name)=>Number(v(name).replace(",","."))||0;
  return {...fallback,nazwa:v("nazwa")||fallback.nazwa,kategoria:v("kategoria")||fallback.kategoria,cena:n("cena")||fallback.cena,gtin:v("gtin")||fallback.gtin||fallback.ean,ean:v("gtin")||fallback.ean||fallback.gtin,externalId:v("externalId")||fallback.externalId,sku:v("sku")||fallback.sku,mpn:v("mpn")||fallback.mpn||fallback.kodProducenta,kodProducenta:v("kodProducenta")||fallback.kodProducenta||fallback.mpn,producent:v("producent")||fallback.producent,marka:v("marka")||fallback.marka,zdjecie:v("zdjecie")||fallback.zdjecie,opisKrotki:v("opisKrotki")||fallback.opisKrotki,opis:v("opis")||fallback.opis,sourceUrl:v("producentUrl")||v("sourceUrl")||fallback.sourceUrl,producentUrl:v("producentUrl")||fallback.producentUrl};
}
function produktDodawanieOdciskKontroli(p={}){
  const key=v=>agentAIKluczProduktu(v),url=normalizujUrlProducenta(p.sourceUrl||p.producentUrl||"");
  return [key(p.nazwa),key(p.gtin||p.ean),key(p.externalId),key(p.sku),key(p.mpn),key(p.kodProducenta),key(p.producent||p.marka),url].join("|");
}
function produktDodawanieStanKontroli(p={},options={}){
  const nazwa=String(p.nazwa||"").trim(),category=String(p.kategoria||"").trim(),price=Number(p.cena)||0,url=normalizujUrlProducenta(p.sourceUrl||p.producentUrl||"");
  const preciseIdentity=!!(p.gtin||p.ean||p.externalId||p.sku||p.mpn||p.kodProducenta||(/^https?:\/\//i.test(url)&&url.length>12));
  const hasBasis=preciseIdentity||nazwa.length>=3,fingerprint=produktDodawanieOdciskKontroli(p),duplicates=hasBasis?agentAIDuplikatyProduktu({...p,id:""}):[];
  const blocking=duplicates.find(x=>x.blocking)||null,potential=duplicates.find(x=>!x.blocking&&(x.score>=84||x.reasons.includes("identyczna nazwa")))||null;
  const acknowledged=!potential||String(options.ackFingerprint||"")===fingerprint,dataReady=!!(nazwa&&category&&price>0),duplicateChecked=hasBasis;
  const duplicateReady=duplicateChecked&&!blocking&&acknowledged,canSubmit=dataReady&&duplicateReady;
  let progress=10;if(nazwa)progress=25;if(dataReady)progress=50;if(duplicateChecked)progress=65;if(duplicateReady)progress=82;if(canSubmit)progress=92;
  return {p,nazwa,category,price,url,preciseIdentity,hasBasis,fingerprint,duplicates,blocking,potential,acknowledged,dataReady,duplicateChecked,duplicateReady,canSubmit,progress};
}
function produktDodawanieDuplikatKartaHTML(x={}){
  const p=x.product||{};
  return `<article class="product-add-duplicate-card ${x.blocking?"blocking":"review"}">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span class="product-add-duplicate-fallback">${esc(p.ikona||"📦")}</span>`}<div><strong>#${esc(p.id)} ${esc(p.nazwa||"Produkt")}</strong><small>EAN ${esc(p.gtin||p.ean||"—")} • SKU/EXTERNAL_ID ${esc(p.sku||p.externalId||"—")} • kod ${esc(p.kodProducenta||p.mpn||"—")}</small><em>${esc((x.reasons||[]).join(" • "))} • zgodność ${esc(x.score||0)}%</em></div><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Otwórz produkt</a></article>`;
}
function produktDodawanieKontrolaHTML(p={},options={}){
  const s=produktDodawanieStanKontroli(p,options),duplicateClass=s.blocking?"blocked":s.potential&&!s.acknowledged?"review":s.duplicateChecked?"clear":"waiting";
  const duplicateTitle=s.blocking?`Produkt już istnieje — znaleziono pewne dopasowanie #${s.blocking.product.id}`:s.potential&&!s.acknowledged?"Znaleziono bardzo podobny produkt — potrzebna Twoja decyzja":s.duplicateChecked?"Nie znaleziono pewnego duplikatu":"Kontrola duplikatów czeka na dane produktu";
  const duplicateNote=s.blocking?"Dodanie nowej kartoteki jest zablokowane. Otwórz i edytuj istniejący produkt.":s.potential&&!s.acknowledged?"Porównaj rekord poniżej. Kontynuuj tylko wtedy, gdy to faktycznie inny produkt lub wariant.":s.duplicateChecked?`Sprawdzono ${produktyDoAdministracji().filter(x=>!czyProduktAdminWKoszu(x)).length} aktywnych kart po ${s.preciseIdentity?"EAN, kodach, SKU, linku i nazwie":"znormalizowanej nazwie"}.`:"Wpisz nazwę, EAN, SKU, kod producenta albo link źródłowy.";
  const steps=[
    ["1","Dane podstawowe",s.dataReady,"nazwa, kategoria i cena"],
    ["2","Tożsamość",s.hasBasis,s.preciseIdentity?"kody lub link źródłowy":"nazwa produktu"],
    ["3","Duplikaty",s.duplicateReady,s.blocking?`istnieje #${s.blocking.product.id}`:s.potential&&!s.acknowledged?"wymaga decyzji":s.duplicateChecked?"kontrola zakończona":"oczekuje"],
    ["4","Zatwierdzenie",false,s.canSubmit?"przycisk jest odblokowany":"najpierw zakończ kontrolę"]
  ];
  return `<div class="product-add-progress-head"><div><span>Postęp dodawania produktu</span><b>${esc(s.progress)}% gotowości</b><small>${s.canSubmit?"Możesz sprawdzić formularz i zatwierdzić dodanie.":"System nie zapisze produktu, dopóki kontrola nie zostanie zakończona."}</small></div><button class="btn ghost" type="button" onclick="produktDodawanieSprawdzTeraz(this)">🔎 Sprawdź teraz</button></div><div class="product-add-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${esc(s.progress)}"><span style="width:${esc(s.progress)}%"></span></div><div class="product-add-progress-steps">${steps.map(([nr,label,ok,note],i)=>`<span class="${ok?"done":i===3&&s.canSubmit?"active":"wait"}"><b>${ok?"✓":nr}</b><span><strong>${esc(label)}</strong><small>${esc(note)}</small></span></span>`).join("")}</div><section class="product-add-duplicate-check ${duplicateClass}"><header><span>${s.blocking?"⛔":s.potential&&!s.acknowledged?"⚠️":s.duplicateChecked?"✅":"🔎"}</span><div><b>${esc(duplicateTitle)}</b><small>${esc(duplicateNote)}</small></div></header>${s.duplicates.length?`<div class="product-add-duplicate-list">${s.duplicates.slice(0,4).map(produktDodawanieDuplikatKartaHTML).join("")}</div>`:""}${s.potential&&!s.blocking&&!s.acknowledged?`<div class="product-add-duplicate-decision"><button class="btn" type="button" onclick="produktDodawaniePotwierdzNowy(this.form)">To inny produkt — zezwól na dodanie</button><small>Ta decyzja jest ważna tylko dla obecnego zestawu nazwy i kodów. Po ich zmianie kontrola wykona się ponownie.</small></div>`:""}</section>`;
}
function produktDodawanieAktualizuj(form){
  if(!form||!form.querySelector("[data-product-add-control]"))return null;
  const p=agentAIProduktZFormularzaDoOceny(form,{}),fingerprint=produktDodawanieOdciskKontroli(p),previous=String(form.dataset.productDuplicateFingerprint||"");
  if(previous&&previous!==fingerprint)form.dataset.productDuplicateAck="";
  form.dataset.productDuplicateFingerprint=fingerprint;
  const state=produktDodawanieStanKontroli(p,{ackFingerprint:form.dataset.productDuplicateAck||""}),box=form.querySelector("[data-product-add-control]");
  if(box)box.innerHTML=produktDodawanieKontrolaHTML(p,{ackFingerprint:form.dataset.productDuplicateAck||""});
  const approval=form.querySelector("[data-product-final-approval]");if(approval){approval.disabled=!state.canSubmit;approval.title=state.canSubmit?"Kontrola zakończona — możesz zatwierdzić":"Najpierw uzupełnij dane i zakończ kontrolę duplikatów";}
  form.dataset.productDuplicateVerified=state.duplicateReady?"1":"0";form.dataset.productReadyToAdd=state.canSubmit?"1":"0";
  return state;
}
function produktDodawanieZmienione(event,form){
  if(!form||event?.target?.closest?.("[data-product-add-control]"))return;
  clearTimeout(window.__productDuplicateCheck);window.__productDuplicateCheck=setTimeout(()=>produktDodawanieAktualizuj(form),220);
}
function produktDodawanieSprawdzTeraz(button){
  const state=produktDodawanieAktualizuj(button?.form||button?.closest("form"));if(!state)return;
  toast(state.blocking?`Produkt już istnieje (#${state.blocking.product.id})`:state.potential&&!state.acknowledged?"Znaleziono podobny produkt — podejmij decyzję":state.canSubmit?"Kontrola zakończona — możesz zatwierdzić dodanie":"Uzupełnij brakujące dane podstawowe");
}
function produktDodawaniePotwierdzNowy(form){
  if(!form)return;const p=agentAIProduktZFormularzaDoOceny(form,{}),state=produktDodawanieStanKontroli(p,{});if(state.blocking){toast(`Pewnego duplikatu #${state.blocking.product.id} nie można ominąć`);return;}
  form.dataset.productDuplicateAck=state.fingerprint;produktDodawanieAktualizuj(form);toast("Decyzja zapisana — nadal musisz zatwierdzić dodanie produktu na dole formularza");
}
function agentAIProduktZLinkuMini(p={}){
  if(!p||typeof p!=="object") return {};
  const mini={...p};
  mini.opisKrotki=String(mini.opisKrotki||"").slice(0,500);
  mini.opis=String(mini.opis||"").slice(0,12000);
  mini.zdjecie=String(mini.zdjecie||"").slice(0,1000);
  mini.zdjecia=(Array.isArray(mini.zdjecia)?mini.zdjecia:[]).map(x=>String(x||"").slice(0,1000)).filter(Boolean).slice(0,8);
  if(mini.parametryProducenta) mini.parametryProducenta=Object.fromEntries(Object.entries(mini.parametryProducenta).map(([k,v])=>[k,String(v||"").slice(0,500)]).slice(0,20));
  return mini;
}
function agentAIWynikLinkuZPamieci(url=""){
  const key=normalizujUrlProducenta(url),rec=(agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===key||normalizujUrlProducenta(x.resolvedUrl||"")===key||x.lastCandidates?.some(c=>normalizujUrlProducenta(c.url||"")===key));if(!rec)return null;
  const alternatives=(Array.isArray(rec.lastCandidates)?rec.lastCandidates:[]).filter(x=>x?.product?.nazwa);
  if(alternatives.length)return {ok:true,product:alternatives[0].product,alternatives,needsChoice:alternatives.length>1,confidence:Number(rec.linkConfidence||alternatives[0]?.confidence||0),missing:rec.lastMissing||[],fieldSources:rec.fieldSources||{},requestedUrl:url,resolvedUrl:rec.resolvedUrl||alternatives[0]?.url||url,canonicalUrl:alternatives[0]?.url||rec.resolvedUrl||url,fromCache:true,stale:true,cacheSavedAt:rec.ostatniaProba||rec.aktualizacja,diagnostics:{...(rec.diagnostics||{}),cacheFallback:true,retryRecommended:true,selectedReason:"ostatni poprawny wynik zapisany przez Agenta"}};
  if(rec.lastProduct?.nazwa)return {ok:true,product:rec.lastProduct,alternatives:[{id:"cached-1",url:rec.resolvedUrl||rec.url,confidence:Number(rec.linkConfidence||0),missing:rec.lastMissing||[],fieldSources:rec.fieldSources||{},product:rec.lastProduct}],needsChoice:false,confidence:Number(rec.linkConfidence||0),missing:rec.lastMissing||[],fieldSources:rec.fieldSources||{},requestedUrl:url,resolvedUrl:rec.resolvedUrl||rec.url,canonicalUrl:rec.resolvedUrl||rec.url,fromCache:true,stale:true,cacheSavedAt:rec.ostatniaProba||rec.aktualizacja,diagnostics:{...(rec.diagnostics||{}),cacheFallback:true,retryRecommended:true,selectedReason:"ostatni poprawny wynik zapisany przez Agenta"}};
  return null;
}
function agentAIZapiszLinkProducenta(url,status="oczekuje",powod="",extra={}){
  const clean=normalizujUrlProducenta(url);
  if(!/^https?:\/\//i.test(clean)) return null;
  const teraz=new Date(), poprzednie=Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[];
  const idx=poprzednie.findIndex(x=>normalizujUrlProducenta(x.url)===clean);
  const baza=idx>=0?poprzednie[idx]:{id:"PURL-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),url:clean,dodano:teraz.toISOString(),dodanoTxt:teraz.toLocaleString("pl-PL"),proby:0};
  const rec={...baza,...extra,url:clean,status,powod:String(powod||extra.powod||"").slice(0,500),aktualizacja:teraz.toISOString(),aktualizacjaTxt:teraz.toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
  const lista=idx>=0?[...poprzednie.slice(0,idx),rec,...poprzednie.slice(idx+1)]:[rec,...poprzednie];
  agentAILinkiProducentow=lista.slice(0,500);
  zapiszLS("artway_agent_ai_linki_producentow",agentAILinkiProducentow);
  if(chmuraToken&&!chmuraWczytywanie)zaplanujZapisUstawien();
  return rec;
}
function agentAIUsunLinkProducenta(ref){
  const r=String(ref||"");
  const teraz=new Date(), clean=normalizujUrlProducenta(r);
  agentAILinkiProducentow=(Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[]).map(x=>{
    if(x.id===r||normalizujUrlProducenta(x.url)===clean) return {...x,status:"usunieto",powod:"Usunięte ręcznie z kolejki agenta",usunieto:teraz.toISOString(),aktualizacja:teraz.toISOString(),aktualizacjaTxt:teraz.toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
    return x;
  }).slice(0,500);
  zapiszLS("artway_agent_ai_linki_producentow",agentAILinkiProducentow);
  if(chmuraToken) void chmuraZapiszUstawienia();
  toast("Link usunięty z kolejki agenta");
  renderuj();
}
function agentAIZakonczLinkProducenta(ref, produkt={}){
  const r=String(ref||""), clean=normalizujUrlProducenta(r), teraz=new Date();
  let zmieniono=false;
  agentAILinkiProducentow=(Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[]).map(x=>{
    const pasuje=x.id===r||normalizujUrlProducenta(x.url)===clean||normalizujUrlProducenta(x.url)===normalizujUrlProducenta(produkt.sourceUrl||produkt.producentUrl||"");
    if(!pasuje) return x;
    zmieniono=true;
    return {...x,status:"zamknięte",powod:"Produkt dodany do sklepu — zadanie wykonane",produktId:produkt.id||x.produktId||"",lastProductName:produkt.nazwa||x.lastProductName||"",zamknieto:teraz.toISOString(),aktualizacja:teraz.toISOString(),aktualizacjaTxt:teraz.toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
  });
  if(zmieniono){
    zapiszLS("artway_agent_ai_linki_producentow",agentAILinkiProducentow);
    if(chmuraToken) void chmuraZapiszUstawienia();
  }
  return zmieniono;
}
function agentAILinkiOczekujace(){
  return (Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[]).filter(x=>!["pobrano","zamkniete","zamknięte","usunieto","usunięto"].includes(String(x.status||"").toLowerCase()));
}
function agentAILinkiGotoweDoPonowienia(){const now=Date.now();return agentAILinkiOczekujace().filter(x=>["oczekuje","błąd"].includes(String(x.status||"oczekuje").toLowerCase())&&(!x.nextRetryAt||Date.parse(x.nextRetryAt)<=now));}
function agentAINastepnaProbaLinku(proby=1){const delays=[15,60,360,1440,2880],minutes=delays[Math.min(delays.length-1,Math.max(0,Number(proby||1)-1))];return new Date(Date.now()+minutes*60000).toISOString();}
async function agentAISprawdzLinkProducenta(ref,cicho=false){
  const lista=Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[];
  const rec=lista.find(x=>x.id===ref||normalizujUrlProducenta(x.url)===normalizujUrlProducenta(ref))||{id:"tmp",url:ref,proby:0};
  if(!rec.url) return null;
  const teraz=new Date();
  try{
    const d=await chmura("product-url-prepare",{method:"POST",body:{url:rec.url},timeout:90000});
    const p=d.product||{}, braki=brakiDanychProducenta(p,d),workflow=d.workflow||{};
    const status=d.needsChoice?"wymaga wyboru":d.duplicateAudit?.blocking?"duplikat":workflow.readyForStore?"pobrano":"do uzupełnienia";
    const reason=d.needsChoice?`Agent znalazł ${d.alternatives?.length||2} różne produkty — wybierz właściwy wariant`:d.duplicateAudit?.blocking?`Produkt istnieje już w sklepie: ${d.duplicateAudit.selected?.productName||d.duplicateAudit.selected?.productId||"duplikat"}`:workflow.readyForStore?`Kartoteka sklepu gotowa • Allegro ${workflow.readyForAllegro?"gotowe":"wymaga uzupełnienia"}`:`Braki po pobraniu: ${braki.join(", ")}`;
    const next=agentAIZapiszLinkProducenta(rec.url,status,reason,{
      proby:Number(rec.proby||0)+1,
      ostatniaProba:teraz.toISOString(),
      ostatniaProbaTxt:teraz.toLocaleString("pl-PL"),
      lastProductName:p.nazwa||"",
      lastAvailability:p.dostepnoscProducenta||d.availability?.text||"",
      lastPrice:p.cena||"",
      lastMissing:braki,
      lastProduct:agentAIProduktZLinkuMini(p),
      lastCandidates:(d.alternatives||[]).map(x=>({...x,product:agentAIProduktZLinkuMini(x.product||{})})).slice(0,5),
      linkConfidence:d.confidence||0,
      fieldSources:d.fieldSources||{},
      diagnostics:d.diagnostics||{},
      lastWorkflow:workflow,
      lastStoreCategory:d.storeCategory||null,
      lastDuplicateAudit:d.duplicateAudit||null,
      resolvedUrl:d.resolvedUrl||d.canonicalUrl||rec.url,
      nextRetryAt:null,
      lastError:""
    });
    if(!cicho) toast(status==="pobrano"?`Agent przygotował produkt ✅ • sklep gotowy • Allegro ${workflow.readyForAllegro?"gotowe":"do uzupełnienia"}`:d.needsChoice?`Agent znalazł ${d.alternatives?.length||2} produkty — wybierz właściwy`:status==="duplikat"?"Agent zablokował utworzenie duplikatu":`Agent pobrał link, ale są braki: ${braki.join(", ")}`);
    return {rec:next,dane:d,braki,status};
  }catch(e){
    const proby=Number(rec.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);
    const next=agentAIZapiszLinkProducenta(rec.url,"oczekuje",e.message||String(e),{
      proby,
      ostatniaProba:teraz.toISOString(),
      ostatniaProbaTxt:teraz.toLocaleString("pl-PL"),
      nextRetryAt,
      failureCode:e.code||"fetch_error",
      diagnostics:e.linkDiagnostics||{},
      lastError:e.message||String(e)
    });
    if(!cicho) toast(`Agent zapisał link do ponowienia ${new Date(nextRetryAt).toLocaleString("pl-PL")}: ${e.message||e}`);
    return {rec:next,blad:e};
  }
}
async function agentAISprawdzLinkiProducentow(limit=5){
  const lista=agentAILinkiGotoweDoPonowienia().slice(0,limit);
  if(!lista.length) return agentAILinkiOczekujace().length?"Linki są zaplanowane do późniejszego ponowienia — Agent nie powtarza teraz tych samych błędów.":"Nie ma linków producentów oczekujących na pobranie.";
  const wyniki=[];
  for(const rec of lista) wyniki.push(await agentAISprawdzLinkProducenta(rec.id,true));
  const wybor=wyniki.filter(x=>x?.status==="wymaga wyboru").length,ok=wyniki.filter(x=>x&&!x.blad&&x.status==="pobrano").length,braki=wyniki.filter(x=>x&&!x.blad&&x.status==="do uzupełnienia").length,blad=wyniki.filter(x=>x?.blad).length;
  zapiszHistorieAgenta("linki-producentow",`Agent sprawdził ${wyniki.length} linków producentów`,{ok,braki,wybor,blad});
  renderuj();
  return `Sprawdziłem ${wyniki.length} linków producentów. Pobrane poprawnie: ${ok}. Do uzupełnienia: ${braki}. Wymagają wyboru produktu: ${wybor}. Błędy / zaplanowane ponowienie: ${blad}.`;
}
function producentDostepnoscInfo(p={}){
  const u=ustawieniaMagazynuPelne(),prog=Math.max(1,Number(u.progNiskiProducenta)||50),maxAge=Math.max(1,Number(u.producentMaxWiekGodz)||48),url=String(p.producentUrl||p.sourceUrl||"").trim(),raw=p.stanProducenta,quantity=raw===""||raw===null||raw===undefined?null:Math.max(0,Math.floor(Number(raw)||0)),checked=p.producentSprawdzonoAt||"",age=checked?Math.max(0,(Date.now()-Date.parse(checked))/3600000):Infinity,stale=!checked||!Number.isFinite(age)||age>maxAge;
  let status=String(p.producentStatus||"").toLowerCase();
  if(quantity===0)status="brak";else if(quantity!==null&&quantity<=prog)status="niski";else if(quantity!==null)status="dostepny";else if(/niedost/i.test(p.dostepnoscProducenta||""))status="brak";else if(/dostęp|dostep/i.test(p.dostepnoscProducenta||""))status="dostepny_nieznany";else if(!status)status="nieznany";
  const meta={dostepny:{label:quantity===null?"dostępny":"dostępny "+quantity+" szt.",cls:"ok",ico:"🟢"},dostepny_nieznany:{label:"dostępny • ilość nieujawniona",cls:"info",ico:"🔵"},niski:{label:`niski stan: ${quantity??"—"} szt.`,cls:"warn",ico:"🟡"},brak:{label:"brak u producenta",cls:"bad",ico:"🔴"},nieznany:{label:"niepotwierdzona",cls:"unknown",ico:"⚪"},blad:{label:"błąd ostatniej próby",cls:"unknown",ico:"⚪"}}[status]||{label:"niepotwierdzona",cls:"unknown",ico:"⚪"};
  return {url,quantity,exact:p.stanProducentaDokladny===true,status,prog,checked,ageHours:age,stale,alert:["niski","brak"].includes(status),...meta,error:p.producentOstatniBlad||"",source:p.stanProducentaZrodlo||""};
}
function producentDostepnoscBadgeHTML(p={},compact=false){
  const i=producentDostepnoscInfo(p),date=i.checked?allegroDataTxt(i.checked):"nigdy";
  return `<div class="supplier-availability ${i.cls} ${i.stale?"stale":""}"><b>${i.ico} ${esc(i.label)}</b>${compact?"":`<small>Sprawdzono: ${esc(date)}${i.stale?" • wynik nieaktualny":""}${i.source?` • ${esc(i.source)}`:""}</small>${i.error?`<em>${esc(skrocTekst(i.error,180))}</em>`:""}`}</div>`;
}
function produktyMonitorowaneUProducentow(){return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&/^https?:\/\//i.test(String(p.producentUrl||p.sourceUrl||"")));}
function statystykiDostepnosciProducentow(){
  const products=produktyMonitorowaneUProducentow(),rows=rankingDostepnosciProducentow(products).map(x=>({p:x.p,i:x.availability,priority:x.priority,rank:x.rank}));
  const decyzje=rows.map(x=>({...x,decision:decyzjaProducentaInfo(x.p)})),wymagajaDecyzji=decyzje.filter(x=>["brak","niski"].includes(x.i.status)&&(!x.decision.code||x.decision.expired)),aktywneDecyzje=decyzje.filter(x=>x.decision.code&&!x.decision.expired),wygasleDecyzje=decyzje.filter(x=>x.decision.expired);
  return {products,rows,decyzje,wymagajaDecyzji,aktywneDecyzje,wygasleDecyzje,dostepne:rows.filter(x=>["dostepny","dostepny_nieznany"].includes(x.i.status)&&!x.i.stale),niskie:rows.filter(x=>x.i.status==="niski"),braki:rows.filter(x=>x.i.status==="brak"),nieznane:rows.filter(x=>["nieznany","blad"].includes(x.i.status)||x.i.stale),bezLinku:produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&!/^https?:\/\//i.test(String(p.producentUrl||p.sourceUrl||"")))};
}
async function agentAISprawdzDostepnoscProducentow(limit=null,productIds=[]){
  const u=ustawieniaMagazynuPelne(),sample=Math.max(1,Math.min(25,Number(limit??u.producentProbka)||8)),ids=(Array.isArray(productIds)?productIds:[]).map(String);
  try{
    toast(ids.length?"Agent sprawdza wybrany produkt u producenta…":`Agent wyrywkowo sprawdza ${sample} produktów u producentów…`);
    const d=await chmura("supplier-availability-sample",{method:"POST",body:{limit:sample,productIds:ids,threshold:Math.max(1,Number(u.progNiskiProducenta)||50),source:"admin-agent-ai"},timeout:120000});
    await chmuraWczytajStan().catch(()=>{});zbudujProdukty();
    const s=d.summary||{};toast(`✅ Sprawdzono ${s.checked||0}, w tym priorytetowych ${s.priorityChecked||0}: dostępne ${s.available||0}, niski stan ${s.low||0}, brak ${s.unavailable||0}`);odswiezDostepnoscProducentowWidoku();return d;
  }catch(e){toast("⚠️ Monitoring producentów: "+(e.message||e));return null;}
}
function agentAILinkiProducentowTekst(){
  const lista=agentAILinkiOczekujace();
  if(!lista.length) return "Nie ma obecnie linków producentów oczekujących na pobranie.";
  return ["🔗 Linki producentów do sprawdzenia przez agenta:",...lista.slice(0,15).map((x,i)=>`• ${i+1}. ${x.lastProductName?`${x.lastProductName} — `:""}${x.url} [${x.status||"oczekuje"}]${x.powod?` — ${x.powod}`:""}`)].join("\n");
}
function agentAILinkiProducentowPanelHTML(){
  const lista=agentAILinkiOczekujace().slice(0,25);
  const ocz=agentAILinkiOczekujace().length;
  return `<div class="panel agent-link-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">🔗 Linki producentów dla agenta</h2><p class="order-detail-lead">Gdy pobieranie produktu z URL się nie uda albo dane są niepełne, link trafia tutaj. Agent może później ponowić pobranie i pokazać braki.</p></div>
      <span class="lvl ${ocz?"lvl-ostrzezenie":"lvl-ok"}">${ocz?`${ocz} do sprawdzenia`:"brak zaległych linków"}</span>
    </div>
    <div class="diag-actions" style="margin-top:0">
      <button class="btn" type="button" onclick="agentAISprawdzLinkiProducentow().then(t=>toast(t))">🤖 Sprawdź oczekujące</button>
      <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż linki producentów do pobrania')">Wpisz komendę</button>
    </div>
    <div class="agent-memory-list">
      ${lista.length?lista.map(x=>`<div class="agent-memory-item agent-link-work-item">
        <div><b>${esc(x.lastProductName||x.url)}</b><p>${esc(x.url)}</p><small>Status: ${esc(x.status||"oczekuje")} • próby: ${esc(x.proby||0)}${x.linkConfidence?` • kompletność: ${esc(x.linkConfidence)}%`:""}${x.powod?` • ${esc(x.powod)}`:""}${Array.isArray(x.lastMissing)&&x.lastMissing.length?` • braki: ${esc(x.lastMissing.join(", "))}`:""}${x.nextRetryAt?` • następna próba: ${esc(new Date(x.nextRetryAt).toLocaleString("pl-PL"))}`:""}</small>${Array.isArray(x.lastCandidates)&&x.lastCandidates.length>1?`<div class="agent-link-candidates">${x.lastCandidates.map((c,i)=>`<button type="button" onclick="agentAIWypelnijNowyProduktZLinku(${jsArg(x.id)},${i})"><b>${esc(c.product?.nazwa||`Wariant ${i+1}`)}</b><small>${esc(c.confidence||0)}% • ${esc(c.url||"")}</small></button>`).join("")}</div>`:""}</div>
        <div class="warehouse-worktable-actions">
          <button class="btn ghost" type="button" onclick="agentAISprawdzLinkProducenta(${jsArg(x.id)}).then(()=>renderuj())">Sprawdź</button>
          ${x.lastProduct&&!(x.lastCandidates?.length>1)?`<button class="btn ghost" type="button" onclick="agentAIWypelnijNowyProduktZLinku(${jsArg(x.id)})">Przygotuj dodanie produktu</button>`:""}
          ${x.lastCandidates?.length>1?`<span class="lvl lvl-ostrzezenie">Najpierw wybierz wariant powyżej</span>`:""}
          <button class="btn danger" type="button" onclick="agentAIUsunLinkProducenta(${jsArg(x.id)})">Usuń</button>
        </div>
      </div>`).join(""):`<div class="agent-ops-empty">Brak zapisanych linków producentów.</div>`}
    </div>
  </div>`;
}
async function agentAIWypelnijNowyProduktZLinku(id,candidateIndex=null){
  const rec=(agentAILinkiProducentow||[]).find(x=>x.id===id);
  if(!rec?.url){toast("Nie znaleziono linku w kolejce Agenta");return;}
  try{
    toast("Agent przygotowuje kompletną kartotekę sklepu i Allegro…");
    const body={url:rec.url};if(Number.isInteger(candidateIndex))body.choice=candidateIndex;
    const d=await chmura("product-url-prepare",{method:"POST",body,timeout:90000});
    if(d.needsChoice){toast("Wybierz właściwy wariant produktu");return;}
    const product=d.product||rec.lastProduct;
    if(!product){toast("Agent nie otrzymał danych produktu");return;}
    agentAIImportUrlStan={busy:false,data:d,selected:Number.isInteger(candidateIndex)?candidateIndex:0,error:""};
    sessionStorage.setItem("artway_prefill_product",JSON.stringify({...product,_agentLinkId:rec.id,_agentLinkUrl:d.canonicalUrl||d.resolvedUrl||rec.url,_agentPrepared:true}));
    location.hash="#/admin/produkty/dodaj?agent=1";
  }catch(e){toast("⚠️ Przygotowanie produktu: "+(e.message||e));}
}

function zapiszRuchMagazynowy(ruch){
  const p=produktMagazynowy(ruch.produktId);
  const rec={
    id:"MAG-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7),
    data:new Date().toISOString(),
    dataTxt:new Date().toLocaleString("pl-PL"),
    produktId:String(ruch.produktId??""),
    produktNazwa:ruch.produktNazwa||p?.nazwa||"Produkt",
    sku:ruch.sku||p?.sku||"",
    typ:String(ruch.typ||"korekta"),
    ilosc:Number(ruch.ilosc)||0,
    stanPrzed:ruch.stanPrzed===null?null:(Number(ruch.stanPrzed)||0),
    stanPo:ruch.stanPo===null?null:(Number(ruch.stanPo)||0),
    dokument:String(ruch.dokument||""),
    powod:String(ruch.powod||""),
    operator:String(ruch.operator||sesja?.email||"administrator")
  };
  ruchyMagazynowe=[rec,...(Array.isArray(ruchyMagazynowe)?ruchyMagazynowe:[])].slice(0,3000);
  zapiszLS("artway_ruchy_magazynowe", ruchyMagazynowe);
  return rec;
}
function ustawStanMagazynowy(id, wartosc, meta={}){
  const przed=stanMagazynuId(id);
  const s=String(wartosc??"").trim();
  let po=null;
  if(s==="") delete stanyProduktow[id];
  else { po=Math.max(0, parseInt(s,10)||0); stanyProduktow[id]=po; }
  zapiszLS("artway_stany", stanyProduktow);
  zbudujProdukty();
  const zmieniono = przed!==po;
  if(zmieniono) zapiszRuchMagazynowy({
    produktId:id,
    typ:meta.typ||"korekta",
    ilosc:po===null ? 0 : (przed===null ? po : po-przed),
    stanPrzed:przed,
    stanPo:po,
    powod:meta.powod||"Ręczna korekta stanu",
    dokument:meta.dokument||"",
    operator:meta.operator||sesja?.email||"administrator"
  });
  return {przed,po,zmieniono};
}
function ustawStan(id, wartosc){
  const wynik=ustawStanMagazynowy(id, wartosc, {typ:"korekta",powod:"Edycja w tabeli produktów"});
  loguj("info",`Magazyn: produkt ${id} → ${wynik.po===null?"bez limitu":wynik.po+" szt."}`);
  toast("Stan magazynowy zapisany ✅");
}
function zmniejszStany(pozycjeKoszyka, dokument=""){
  // sumuj sztuki per produkt (warianty liczą się razem)
  const sprzedane = {};
  for(const x of pozycjeKoszyka) sprzedane[x.id] = (sprzedane[x.id]||0) + x.ile;
  let zmiana = false;
  for(const id in sprzedane){
    const p = produkty.find(p=>String(p.id)===String(id));
    if(p && stanProduktu(p)!==null){
      const przed=stanProduktu(p), po=Math.max(0, przed - sprzedane[id]);
      stanyProduktow[id] = Math.max(0, stanProduktu(p) - sprzedane[id]);
      zapiszRuchMagazynowy({produktId:id,produktNazwa:p.nazwa,sku:p.sku||"",typ:"sprzedaż",ilosc:-sprzedane[id],stanPrzed:przed,stanPo:po,dokument,powod:"Zamówienie klienta"});
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
const PRODUKTY_BAZOWE_CACHE_KEY="base-products-v2";
const PRODUKTY_BAZOWE_CACHE_TTL_MS=6*60*60*1000;
function walidujBazoweProdukty(dane){
  if(!Array.isArray(dane))throw new Error("products.json nie zawiera tablicy produktów");
  const poprawne=dane.filter(p=>p&&p.id!==undefined&&String(p.nazwa||"").trim()),unikalne=new Set(poprawne.map(p=>String(p.id)));
  if(poprawne.length!==dane.length||unikalne.size!==poprawne.length)throw new Error("products.json zawiera niepoprawne lub powtórzone rekordy");
  return poprawne;
}
async function pobierzBazoweProdukty(){
  const wersja=document.querySelector('meta[name="artway-version"]')?.content||"dev",teraz=Date.now();
  let cache=null,cacheProducts=null;
  try{cache=typeof chmuraRuntimeCacheOdczytaj==="function"?await chmuraRuntimeCacheOdczytaj(PRODUKTY_BAZOWE_CACHE_KEY):null;cacheProducts=cache?.products?walidujBazoweProdukty(cache.products):null;}catch(e){cache=null;cacheProducts=null;}
  if(cacheProducts){prodBazowe=cacheProducts;zrodloProduktow="json";}
  if(cacheProducts&&String(cache.version||"")===wersja&&teraz-Number(cache.savedAt||0)<PRODUKTY_BAZOWE_CACHE_TTL_MS)return true;
  try{
    const headers={};if(cache?.etag)headers["If-None-Match"]=String(cache.etag);if(cache?.lastModified)headers["If-Modified-Since"]=String(cache.lastModified);
    const r=await fetch(`/products.json?v=${encodeURIComponent(wersja)}`,{cache:"no-cache",headers});
    if(r.status===304&&cacheProducts){await chmuraRuntimeCacheZapisz(PRODUKTY_BAZOWE_CACHE_KEY,{...cache,version:wersja,savedAt:teraz});return true;}
    if(!r.ok)throw new Error("HTTP "+r.status);
    const poprawne=walidujBazoweProdukty(await r.json());prodBazowe=poprawne;zrodloProduktow="json";
    if(typeof chmuraRuntimeCacheZapisz==="function")await chmuraRuntimeCacheZapisz(PRODUKTY_BAZOWE_CACHE_KEY,{version:wersja,count:poprawne.length,products:poprawne,etag:r.headers.get("etag")||"",lastModified:r.headers.get("last-modified")||"",savedAt:teraz});
    return true;
  }catch(e){
    if(cacheProducts){loguj("info","Użyto trwałej pamięci katalogu; odświeżenie products.json zostanie ponowione później.");return true;}
    prodBazowe=PRODUKTY_ZAPASOWE;zrodloProduktow="zapasowe";
    loguj("ostrzezenie","products.json niedostępny — katalog demonstracyjny został zablokowany, aby nie pokazywać nieaktualnych produktów.");return false;
  }
}
function finalizujWczytanieProduktow(){
  naprawKolizjeIdProduktow();
  wyczyscPrzeterminowanyKosz();
  zbudujProdukty();
  odswiezMenu();
  renderuj(); odswiezKoszyk();
}
async function wczytajProdukty(){ await pobierzBazoweProdukty(); finalizujWczytanieProduktow(); }

/* ═══════════ ROUTER (podstrony) ═══════════ */
const ADMIN_MODULY_RUNTIME = Object.freeze({
  core:"admin-core",shell:"admin-shell",ui:"admin-ui",agent:"admin-agent",warehouse:"admin-warehouse",shipping:"admin-shipping",commerce:"admin-commerce",communications:"admin-communications",
  inventory:"admin-inventory",catalog:"admin-catalog",personalization:"admin-personalization",system:"admin-system"
});
const ADMIN_STYLE_RUNTIME = Object.freeze({agent:"admin-agent",warehouse:"admin-warehouse",commerce:"admin-commerce"});
const SKLEP_MODULY_RUNTIME = Object.freeze({account:"store-account",content:"store-content"});
const adminZaladowaneModuly = new Set();
const adminObietniceModulow = new Map();
const adminZaladowaneStyle = new Set();
const adminObietniceStyle = new Map();
const sklepZaladowaneModuly = new Set();
const sklepObietniceModulow = new Map();
let adminStylePromise = null;
function identyfikatorZTrasy(route,index){
  const raw=String(route||"").split("/")[index]||"";let decoded=raw;
  try{decoded=decodeURIComponent(raw);}catch(e){}
  return /^(0|[1-9]\d*)$/.test(decoded)?Number(decoded):decoded;
}
function adminModulyDlaTrasy(route=""){
  const t=String(route||"").split("?")[0],moduly=["core","ui"],add=(...items)=>items.forEach(item=>{if(!moduly.includes(item))moduly.push(item);});
  add("shell");
  if((t.startsWith("/admin")||t==="/diagnostyka")&&typeof jestAdmin==="function"&&!jestAdmin()){add("system");return moduly;}
  if(t==="/diagnostyka")add("agent","warehouse","shipping","commerce","communications","inventory","catalog","personalization","system");
  else if(t==="/admin"||t.startsWith("/admin/pulpit"))add("commerce","communications","inventory","system");
  else if(t.startsWith("/admin/agent-ai"))add("agent","warehouse","commerce","communications","inventory");
  else if(["/admin/magazyn/lokalizacje","/admin/magazyn/etykiety-qr"].includes(t))add("warehouse");
  else if(t==="/admin/magazyn/ruchy")add("warehouse","inventory");
  else if(t==="/admin/magazyn/stany")add("warehouse","commerce","inventory");
  else if(t.startsWith("/admin/magazyn"))add("agent","warehouse","commerce","inventory");
  else if(t.startsWith("/admin/wysylki"))add("agent","warehouse","shipping","commerce","inventory");
  else if(["/admin/allegro/komunikacja","/admin/allegro/wiadomosci","/admin/allegro/dyskusje"].includes(t))add("agent","warehouse","commerce","communications","inventory");
  else if(t.startsWith("/admin/allegro")||t.startsWith("/admin/zamowien")||t.startsWith("/admin/zamowienie/")||t.startsWith("/admin/klient"))add("agent","warehouse","commerce","communications","inventory");
  else if(t.startsWith("/admin/infakt"))add("inventory");
  else if(t==="/admin/asortyment"||t==="/admin/asortyment/produkty")add("commerce","inventory");
  else if(t.startsWith("/admin/produkty/edytuj/")||t==="/admin/produkty/dodaj"||t==="/admin/produkty/z-linku")add("agent","commerce","inventory");
  else if(t.startsWith("/admin/asortyment")||t.startsWith("/admin/produkty")||t==="/admin/kategorie"||t==="/admin/mapowanie"||t==="/admin/opinie"){
    add("commerce","inventory","catalog");
    if(t==="/admin/asortyment/rabaty")add("personalization");
  }
  else if(t.startsWith("/admin/personalizacja")||["/admin/dostawy","/admin/ustawienia","/admin/wyglad","/admin/rozmieszczenie","/admin/bannery","/admin/podstrony","/admin/strony","/admin/rabaty"].includes(t)){
    add("personalization");
    if(t==="/admin/personalizacja/rozmieszczenie"||t==="/admin/rozmieszczenie")add("catalog");
  }
  else if(t.startsWith("/admin/eksport"))add("inventory","catalog","personalization");
  else if(t.startsWith("/admin/aktualizacja"))add("personalization");
  else if(t.startsWith("/admin/publikacja"))add("inventory","personalization");
  else if(t.startsWith("/admin/seo"))add("inventory");
  else if(t.startsWith("/admin"))add("agent","warehouse","commerce","inventory","catalog","personalization","system");
  return moduly;
}
function sklepModulyDlaTrasy(route=""){
  const t=String(route||"").split("?")[0];
  if(["/logowanie","/rejestracja","/konto","/zamowienia"].includes(t)||t.startsWith("/dziekujemy/"))return ["account"];
  if(["/ulubione","/kontakt","/o-nas","/faq","/regulamin","/prywatnosc","/dostawa","/zwroty"].includes(t))return ["content"];
  return [];
}
function sklepModulyTrasyGotowe(route=""){return sklepModulyDlaTrasy(route).every(modul=>sklepZaladowaneModuly.has(modul));}
function zaladujSklepModul(modul,version){
  if(sklepZaladowaneModuly.has(modul))return Promise.resolve();
  if(sklepObietniceModulow.has(modul))return sklepObietniceModulow.get(modul);
  const asset=SKLEP_MODULY_RUNTIME[modul];if(!asset)return Promise.reject(new Error(`Nieznany moduł sklepu: ${modul}`));
  const promise=new Promise((resolve,reject)=>{const script=document.createElement("script");script.id=`artwayStoreModule-${modul}`;script.src=`/assets/${asset}.js?v=${encodeURIComponent(version)}`;script.async=false;script.onload=()=>{sklepZaladowaneModuly.add(modul);resolve();};script.onerror=()=>reject(new Error(`Nie udało się wczytać podstrony sklepu: ${modul}`));document.body.appendChild(script);}).catch(error=>{sklepObietniceModulow.delete(modul);document.getElementById(`artwayStoreModule-${modul}`)?.remove();throw error;});
  sklepObietniceModulow.set(modul,promise);return promise;
}
function adminModulyTrasyGotowe(route=""){return adminModulyDlaTrasy(route).every(modul=>adminZaladowaneModuly.has(modul));}
function zaladujAdminStyle(version){
  if(adminStylePromise)return adminStylePromise;
  adminStylePromise=new Promise((resolve,reject)=>{
    const obecny=document.getElementById("artwayAdminStyles");
    if(obecny){if(obecny.sheet)resolve();else{obecny.addEventListener("load",resolve,{once:true});obecny.addEventListener("error",()=>reject(new Error("Nie udało się wczytać stylów panelu administratora")),{once:true});}return;}
    const link=document.createElement("link");link.id="artwayAdminStyles";link.rel="stylesheet";link.href=`/assets/admin.css?v=${encodeURIComponent(version)}`;
    link.onload=()=>resolve();link.onerror=()=>reject(new Error("Nie udało się wczytać stylów panelu administratora"));document.head.appendChild(link);
  }).catch(error=>{adminStylePromise=null;throw error;});
  return adminStylePromise;
}
function zaladujAdminModul(modul,version){
  if(adminZaladowaneModuly.has(modul))return Promise.resolve();
  if(adminObietniceModulow.has(modul))return adminObietniceModulow.get(modul);
  const asset=ADMIN_MODULY_RUNTIME[modul];
  if(!asset)return Promise.reject(new Error(`Nieznany moduł panelu: ${modul}`));
  const promise=new Promise((resolve,reject)=>{
    const id=`artwayAdminModule-${modul}`,obecny=document.getElementById(id);
    if(obecny){obecny.addEventListener("load",()=>{adminZaladowaneModuly.add(modul);resolve();},{once:true});obecny.addEventListener("error",()=>reject(new Error(`Nie udało się wczytać modułu ${modul}`)),{once:true});return;}
    const script=document.createElement("script");script.id=id;script.src=`/assets/${asset}.js?v=${encodeURIComponent(version)}`;script.async=false;
    script.onload=()=>{adminZaladowaneModuly.add(modul);if(modul==="core")window.__artwayAdminReady=true;resolve();};
    script.onerror=()=>reject(new Error(`Nie udało się wczytać modułu panelu: ${modul}`));document.body.appendChild(script);
  }).catch(error=>{adminObietniceModulow.delete(modul);document.getElementById(`artwayAdminModule-${modul}`)?.remove();throw error;});
  adminObietniceModulow.set(modul,promise);return promise;
}
function zaladujAdminStyleModul(modul,version){
  const asset=ADMIN_STYLE_RUNTIME[modul];if(!asset||adminZaladowaneStyle.has(modul))return Promise.resolve();
  if(adminObietniceStyle.has(modul))return adminObietniceStyle.get(modul);
  const promise=new Promise((resolve,reject)=>{const link=document.createElement("link");link.id=`artwayAdminStyle-${modul}`;link.rel="stylesheet";link.href=`/assets/${asset}.css?v=${encodeURIComponent(version)}`;link.onload=()=>{adminZaladowaneStyle.add(modul);resolve();};link.onerror=()=>reject(new Error(`Nie udało się wczytać stylów modułu ${modul}`));document.head.appendChild(link);}).catch(error=>{adminObietniceStyle.delete(modul);document.getElementById(`artwayAdminStyle-${modul}`)?.remove();throw error;});
  adminObietniceStyle.set(modul,promise);return promise;
}
function zaladujPanelAdmina(route=trasa()){
  const version = document.querySelector('meta[name="artway-version"]')?.content || "dev";
  const modules=adminModulyDlaTrasy(route);
  const core=modules.includes("core")?zaladujAdminModul("core",version):Promise.resolve();
  const scripts=core.then(()=>Promise.all(modules.filter(module=>module!=="core").map(module=>zaladujAdminModul(module,version))));
  const styles=Promise.all(modules.map(module=>zaladujAdminStyleModul(module,version)));
  return Promise.all([zaladujAdminStyle(version),styles,scripts]).then(result=>{if(typeof zaplanujWstepneLadowaniePanelu==="function")zaplanujWstepneLadowaniePanelu(version);return result;});
}
function trasa(){
  const path=String(location.pathname||"").replace(/\/+$/,"")||"/";
  if(location.hash)return location.hash.replace(/^#/,"").split("?")[0]||"/";
  if(/^\/(?:produkt|kategoria)\/[^/]+$/i.test(path)||["/promocje","/nowosci"].includes(path))return path;
  return "/";
}
function seoSlugKategorii(value=""){return String(value||"").toLocaleLowerCase("pl-PL").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"produkty";}
function przejdzDoSklepu(path="/"){history.pushState(null,"",path);renderuj();requestAnimationFrame(()=>$("widok")?.focus({preventScroll:true}));}
function nawigujSklep(event,path="/"){if(event&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0))return true;event?.preventDefault?.();przejdzDoSklepu(path);return false;}
function parametryTrasy(){try{return new URLSearchParams(String(location.hash||"").split("?")[1]||"");}catch(e){return new URLSearchParams();}}
let ostatniaRenderowanaTrasa="";
let renderowanieWidoku=false;
let renderPonowniePoBiezacym=false;
let renderTimerWpisywania=null;
let renderFrameWpisywania=0;
function zaplanujRenderPoWpisaniu(opoznienie=180){
  clearTimeout(renderTimerWpisywania);
  if(renderFrameWpisywania)cancelAnimationFrame(renderFrameWpisywania);
  renderTimerWpisywania=setTimeout(()=>{
    renderFrameWpisywania=requestAnimationFrame(()=>{renderFrameWpisywania=0;renderuj();});
  },Math.max(80,Number(opoznienie)||180));
}
function adminTrasaCacheowalna(route=""){
  const value=String(route||"");
  return value.startsWith("/admin")&&!value.startsWith("/admin/zamowienie/")&&!value.startsWith("/admin/produkty/edytuj/")&&!value.startsWith("/admin/produkty/dodaj")&&!value.startsWith("/admin/produkty/z-linku");
}
function adminKontenerTresci(shell){return shell?.querySelector(":scope > .admin-tresc")||null;}
function adminTrescBezposrednia(shell){return adminKontenerTresci(shell)?.querySelector(":scope > .admin-workspace-content")||null;}
function adminLiczbaWezlowCache(){let total=0;for(const entry of adminCachePodstron.values())total+=Number(entry?.nodes)||0;return total;}
function adminZapiszPodstroneWCache(root,route){
  if(!adminTrasaCacheowalna(route)||!root)return false;
  const shell=root.querySelector(":scope > .admin-page"),workspace=adminTrescBezposrednia(shell);
  if(!shell||!workspace)return false;
  const nodes=workspace.getElementsByTagName("*").length;
  if(nodes>ADMIN_CACHE_PODSTRON_MAX_WEZLOW)return false;
  adminCachePodstron.delete(route);
  workspace.remove();
  const domains=adminDomenyCacheDlaTrasy(route);
  adminCachePodstron.set(route,{workspace,nodes,header:shell.querySelector(":scope > .admin-tresc > .admin-workspace-header")?.cloneNode(true)||null,mobile:shell.querySelector(":scope > .admin-tresc > .admin-mobile-menu")?.cloneNode(true)||null,domains,signature:adminSygnaturaCacheTrasy(route),scrollY:window.scrollY||0,savedAt:Date.now()});
  while(adminCachePodstron.size>ADMIN_CACHE_PODSTRON_LIMIT||adminLiczbaWezlowCache()>ADMIN_CACHE_PODSTRON_MAX_LACZNIE)adminCachePodstron.delete(adminCachePodstron.keys().next().value);
  return true;
}
function adminAktualizujAktywnaNawigacje(shell,route){
  const nav=shell?.querySelector(".admin-nav");if(!nav)return;
  shell.querySelectorAll(".admin-nav .admin-nav-link[href],.pwa-admin-bottom-nav a[href]").forEach(link=>{
    const href=String(link.getAttribute("href")||"").replace(/^#/,"");
    const active=typeof adminMenuPozycjaAktywna==="function"?adminMenuPozycjaAktywna(route,href):route===href;
    link.classList.toggle("active",active);if(active)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
  });
  const open=typeof adminMenuOtwartaGrupa==="function"?adminMenuOtwartaGrupa():"";
  nav.querySelectorAll(".admin-nav-group").forEach(group=>{
    const active=!!group.querySelector(".admin-nav-link.active"),expanded=active||String(group.dataset.adminMenuGroup||"")===String(open||"");
    group.classList.toggle("is-active",active);group.classList.toggle("collapsed",!expanded);
    group.querySelector(".admin-nav-group-toggle")?.setAttribute("aria-expanded",String(expanded));
  });
}
function adminPrzywrocPodstroneZCache(root,route){
  const entry=adminCachePodstron.get(route);if(!entry)return false;
  adminCachePodstron.delete(route);
  if(entry.signature!==adminSygnaturaCacheTrasy(route))return false;
  const shell=root?.querySelector(":scope > .admin-page");if(!shell)return false;
  const container=adminKontenerTresci(shell),current=adminTrescBezposrednia(shell);if(!container)return false;
  if(current)current.replaceWith(entry.workspace);else container.appendChild(entry.workspace);
  const currentHeader=container.querySelector(":scope > .admin-workspace-header");if(entry.header&&currentHeader)aktualizujWezelStabilnie(currentHeader,entry.header,document.activeElement);
  const currentMobile=container.querySelector(":scope > .admin-mobile-menu");if(entry.mobile&&currentMobile)aktualizujWezelStabilnie(currentMobile,entry.mobile,document.activeElement);
  adminAktualizujAktywnaNawigacje(shell,route);adminAktualizujPrzyciskHistorii(shell);
  requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,Number(entry.scrollY)||0),behavior:"instant"}));
  return true;
}
function kluczStabilnegoWezla(node){
  if(!node||node.nodeType!==1)return "";
  for(const attr of ["id","data-stable-key","data-product-row","data-product-id","data-order-id","data-order-number","data-task-id","data-item-key"]){
    const value=node.getAttribute(attr);if(value)return `${node.tagName}:${attr}:${value}`;
  }
  return "";
}
function aktualizujAtrybutyWezla(current,next,active){
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
  for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  const focused=current===active;
  if(current instanceof HTMLInputElement){
    if(["checkbox","radio"].includes(current.type)){if(!focused)current.checked=next.checked;}
    else if(!focused)current.value=next.value;
  }else if(current instanceof HTMLTextAreaElement){if(!focused)current.value=next.value;}
  else if(current instanceof HTMLSelectElement){if(!focused)current.value=next.value;}
  else if(current instanceof HTMLDetailsElement)current.open=next.open;
}
function aktualizujWezelStabilnie(current,next,active){
  if(!current||!next)return;
  if(current.nodeType!==next.nodeType||(current.nodeType===1&&current.tagName!==next.tagName)){
    current.replaceWith(next.cloneNode(true));return;
  }
  if(current.nodeType===3||current.nodeType===8){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  if(current.nodeType!==1)return;
  if(current!==active&&typeof current.isEqualNode==="function"&&current.isEqualNode(next))return;
  aktualizujAtrybutyWezla(current,next,active);
  aktualizujDzieciStabilnie(current,next,active);
}
function aktualizujDzieciStabilnie(current,next,active){
  const incoming=[...next.childNodes];
  const keyed=new Map();
  for(const node of current.childNodes){const key=kluczStabilnegoWezla(node);if(key&&!keyed.has(key))keyed.set(key,node);}
  for(let index=0;index<incoming.length;index++){
    const wanted=incoming[index],wantedKey=kluczStabilnegoWezla(wanted);let existing=current.childNodes[index];
    if(wantedKey&&kluczStabilnegoWezla(existing)!==wantedKey){
      const match=keyed.get(wantedKey);
      if(match){current.insertBefore(match,existing||null);existing=match;}
    }
    if(wantedKey)keyed.delete(wantedKey);
    if(!existing){current.appendChild(wanted.cloneNode(true));continue;}
    aktualizujWezelStabilnie(existing,wanted,active);
  }
  while(current.childNodes.length>incoming.length)current.lastChild.remove();
}
function aktualizujWidokStabilnie(root,html){
  const template=document.createElement("template");template.innerHTML=String(html||"").trim();
  const active=document.activeElement,scrollY=window.scrollY||0,selection=active&&typeof active.selectionStart==="number"?{start:active.selectionStart,end:active.selectionEnd}:null;
  aktualizujDzieciStabilnie(root,template.content,active);
  if(active?.isConnected&&selection&&typeof active.setSelectionRange==="function")try{active.setSelectionRange(selection.start,selection.end);}catch(e){}
  if(Math.abs((window.scrollY||0)-scrollY)>1)window.scrollTo({top:scrollY,behavior:"instant"});
}
function aktualizujPanelAdminaStabilnie(root,html,taSamaTrasa=false){
  const template=document.createElement("template");template.innerHTML=String(html||"").trim();
  const next=[...template.content.children].find(node=>node.classList?.contains("admin-page"))||null,current=root.querySelector(":scope > .admin-page");
  if(!next||!current)return false;
  aktualizujAtrybutyWezla(current,next,document.activeElement);
  const currentNav=current.querySelector(":scope > .admin-nav"),nextNav=next.querySelector(":scope > .admin-nav");
  if(currentNav&&nextNav)aktualizujWezelStabilnie(currentNav,nextNav,document.activeElement);
  const currentBottom=current.querySelector(":scope > .pwa-admin-bottom-nav"),nextBottom=next.querySelector(":scope > .pwa-admin-bottom-nav");
  if(currentBottom&&nextBottom)aktualizujWezelStabilnie(currentBottom,nextBottom,document.activeElement);
  const currentContainer=adminKontenerTresci(current),nextContainer=adminKontenerTresci(next);
  const currentMobile=currentContainer?.querySelector(":scope > .admin-mobile-menu"),nextMobile=nextContainer?.querySelector(":scope > .admin-mobile-menu");
  if(currentMobile&&nextMobile)aktualizujWezelStabilnie(currentMobile,nextMobile,document.activeElement);
  const currentHeader=currentContainer?.querySelector(":scope > .admin-workspace-header"),nextHeader=nextContainer?.querySelector(":scope > .admin-workspace-header");
  if(currentHeader&&nextHeader)aktualizujWezelStabilnie(currentHeader,nextHeader,document.activeElement);
  const nextWorkspace=adminTrescBezposrednia(next),currentWorkspace=adminTrescBezposrednia(current);
  if(nextWorkspace){
    if(currentWorkspace&&taSamaTrasa)aktualizujWezelStabilnie(currentWorkspace,nextWorkspace,document.activeElement);
    else if(currentWorkspace)currentWorkspace.replaceWith(nextWorkspace.cloneNode(true));
    else currentContainer?.appendChild(nextWorkspace.cloneNode(true));
  }
  return true;
}
function odbiorcaStabilnegoWidoku(root,stabilny,panelAdmin=false,taSamaTrasa=false){
  if(!stabilny&&!panelAdmin)return root;
  return {get innerHTML(){return root.innerHTML;},set innerHTML(html){
    if(panelAdmin&&aktualizujPanelAdminaStabilnie(root,html,taSamaTrasa))return;
    if(stabilny)aktualizujWidokStabilnie(root,html);else root.innerHTML=html;
  }};
}
function renderuj(){
  if(renderowanieWidoku){renderPonowniePoBiezacym=true;return;}
  renderowanieWidoku=true;
  try{
    const t = trasa();
    const root = $("widok"),poprzedniaTrasa=ostatniaRenderowanaTrasa,taSamaTrasa=ostatniaRenderowanaTrasa===t&&root.childNodes.length>0;
    const przejsciePanelu=!taSamaTrasa&&t.startsWith("/admin")&&poprzedniaTrasa.startsWith("/admin")&&root.childNodes.length>0;
    if(przejsciePanelu){
      adminZapiszPodstroneWCache(root,poprzedniaTrasa);
      if(adminPrzywrocPodstroneZCache(root,t)){
        document.body.classList.add("admin-mode");seoAktualizujMetaDlaTrasy(t);ostatniaRenderowanaTrasa=t;return;
      }
    }
    const panelAdmin=t.startsWith("/admin")&&poprzedniaTrasa.startsWith("/admin")&&root.querySelector(":scope > .admin-page");
    const wStabilny = odbiorcaStabilnegoWidoku(root,taSamaTrasa);
    const w = panelAdmin?odbiorcaStabilnegoWidoku(root,true,true,taSamaTrasa):wStabilny;
    // Moduł panelu zawiera także bezpieczny widok „Brak dostępu”. Ładujemy go
    // wyłącznie po wejściu na trasę administracyjną, również dla gościa.
    const wymagaPanelu=t.startsWith("/admin")||t==="/diagnostyka";
    document.body.classList.toggle("admin-mode",wymagaPanelu);
    if(!wymagaPanelu&&!sklepModulyTrasyGotowe(t)){
      w.innerHTML=`<div class="page"><div class="panel admin-loading" role="status" aria-live="polite"><h1>Ładowanie podstrony…</h1><p>Wczytuję tylko funkcje potrzebne w tym miejscu sklepu.</p></div></div>`;
      const trasaLadowania=t,version=document.querySelector('meta[name="artway-version"]')?.content||"dev";
      Promise.all(sklepModulyDlaTrasy(t).map(modul=>zaladujSklepModul(modul,version))).then(()=>{if(trasa()===trasaLadowania)renderuj();}).catch(error=>{loguj("blad",error.message,t);w.innerHTML=`<div class="page"><div class="panel"><h1>Nie udało się wczytać podstrony</h1><p>${esc(error.message)}</p><button class="btn" onclick="renderuj()">Spróbuj ponownie</button></div></div>`;});
      ostatniaRenderowanaTrasa=t;return;
    }
    if(wymagaPanelu&&!adminModulyTrasyGotowe(t)){
      w.innerHTML=`<div class="page"><div class="panel admin-loading" role="status" aria-live="polite"><h1>Ładowanie panelu administratora…</h1><p>Wczytuję moduły potrzebne tylko do obsługi sklepu.</p></div></div>`;
      const trasaLadowania=t;
      zaladujPanelAdmina(t).then(()=>{if(trasa()===trasaLadowania)renderuj();}).catch(error=>{
        loguj("blad",error.message,t);
        w.innerHTML=`<div class="page"><div class="panel"><h1>Nie udało się wczytać panelu</h1><p>${esc(error.message)}</p><button class="btn" onclick="renderuj()">Spróbuj ponownie</button></div></div>`;
      });
      ostatniaRenderowanaTrasa=t;return;
    }
    if(t.startsWith("/admin/zamowienie/")&&!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
    if(t.startsWith("/admin")&&stanBramki.authenticated&&!stanBazyCentralnej.sprawdzono&&!stanBazyCentralnej.synchronizacja) setTimeout(()=>synchronizujBazeCentralna(true),0);
    if(!taSamaTrasa)window.scrollTo({top:0,behavior:"instant"});
    if(t==="/" || t==="") w.innerHTML = widokSklep();
    else if(t.startsWith("/produkt/")) w.innerHTML = widokProdukt(identyfikatorZTrasy(t,2));
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
      else if(t==="/admin" || t==="/admin/pulpit") w.innerHTML = widokAdmin("pulpit");
      else if(t.startsWith("/admin/pulpit/")) w.innerHTML = widokAdmin(t.split("/")[3]||"pulpit");
      else if(t==="/admin/zamowienia") w.innerHTML = widokAdminZamowienia();
      else if(t==="/admin/zamowienia/tabela"){
        history.replaceState(null,"",`${location.pathname}${location.search}#/admin/magazyn/plan`);
        w.innerHTML = widokAdminMagazyn("plan");
      }
      else if(t.startsWith("/admin/zamowienie/")) w.innerHTML = widokAdminZamowienie(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/allegro") w.innerHTML = widokAdminAllegro();
      else if(t==="/admin/allegro/zamowienia") w.innerHTML = widokAdminAllegro("zamowienia");
      else if(t==="/admin/allegro/oferty") w.innerHTML = widokAdminAllegro("oferty");
      else if(t==="/admin/allegro/wystawianie") w.innerHTML = widokAdminAllegro("wystawianie");
      else if(t==="/admin/allegro/rentownosc") w.innerHTML = widokAdminAllegro("rentownosc");
      else if(t==="/admin/allegro/komunikacja" || t==="/admin/allegro/wiadomosci") w.innerHTML = widokAdminAllegro("wiadomosci");
      else if(t==="/admin/allegro/dyskusje") w.innerHTML = widokAdminAllegro("dyskusje");
      else if(t==="/admin/allegro/zgodnosc") w.innerHTML = widokAdminAllegro("zgodnosc");
      else if(t==="/admin/allegro/ustawienia") w.innerHTML = widokAdminAllegro("ustawienia");
      else if(t==="/admin/wysylki") w.innerHTML = widokAdminWysylki("zlecenia");
      else if(t.startsWith("/admin/wysylki/")) w.innerHTML = widokAdminWysylki(t.split("/")[3]||"zlecenia");
      else if(t==="/admin/magazyn") w.innerHTML = widokAdminMagazyn("pulpit");
      else if(t.startsWith("/admin/magazyn/")) w.innerHTML = widokAdminMagazyn(t.split("/")[3]||"pulpit");
      else if(t==="/admin/infakt") w.innerHTML = widokAdminInfakt("pulpit");
      else if(t.startsWith("/admin/infakt/")) w.innerHTML = widokAdminInfakt(t.split("/")[3]||"pulpit");
      else if(t==="/admin/agent-ai/zlecenia"){
        history.replaceState(null,"",`${location.pathname}${location.search}#/admin/magazyn/plan`);
        w.innerHTML = widokAdminMagazyn("plan");
      }
      else if(t==="/admin/agent-ai"){
        w.innerHTML = widokAdminAgentAI("pulpit");
        if(!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
        if(!agentAIPlanStan.history.length&&!agentAIPlanStan.historyLoading) setTimeout(()=>agentAIPobierzHistorieWykonan(true),0);
      }
      else if(t.startsWith("/admin/agent-ai/")){
        w.innerHTML = widokAdminAgentAI(t.split("/")[3]||"pulpit");
        if(!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
        if(!agentAIPlanStan.history.length&&!agentAIPlanStan.historyLoading) setTimeout(()=>agentAIPobierzHistorieWykonan(true),0);
      }
      else if(t==="/admin/seo") w.innerHTML = widokAdminSEO("pulpit");
      else if(t.startsWith("/admin/seo/")) w.innerHTML = widokAdminSEO(t.split("/")[3]||"pulpit");
      else if(t.startsWith("/admin/asortyment/")){
        const s=t.split("/")[3]||"produkty";
        w.innerHTML = s==="jakosc"?widokAdminJakoscKatalogu():s==="kategorie"?widokAdminKategorie():s==="mapowanie"?widokAdminMapowanie():s==="rabaty"?widokAdminRabatyZaawansowane():s==="opinie"?widokAdminOpinie():widokAdminProdukty();
      }
      else if(t.startsWith("/admin/personalizacja/")){
        const s=t.split("/")[3]||"home";
        w.innerHTML = s==="home"?widokAdminStronaGlowna():s==="rozmieszczenie"?widokAdminRozmieszczenie():s==="bannery"?widokAdminBanneryZaawansowane():s==="ikony"?widokAdminIkonyAI():s==="podstrony"?widokAdminPodstrony():s==="strony"?widokAdminStrony():s==="dostawy"?widokAdminDostawy():widokAdminWyglad();
      }
      else if(t==="/admin/asortyment" || t==="/admin/produkty") w.innerHTML = widokAdminProdukty();
      else if(t==="/admin/produkty/dodaj") w.innerHTML = widokAdminProduktyDodaj();
      else if(t==="/admin/produkty/z-linku") w.innerHTML = widokAdminProduktyZLinku();
      else if(t==="/admin/produkty/z-pliku") w.innerHTML = widokAdminProduktyZPliku();
      else if(t.startsWith("/admin/produkty/edytuj/")) w.innerHTML = widokAdminProduktEdytuj(identyfikatorZTrasy(t,4));
      else if(t==="/admin/kategorie") w.innerHTML = widokAdminKategorie();
      else if(t==="/admin/mapowanie") w.innerHTML = widokAdminMapowanie();
      else if(t==="/admin/klienci") w.innerHTML = widokAdminKlienci("lista");
      else if(t.startsWith("/admin/klienci/")) w.innerHTML = widokAdminKlienci(t.split("/")[3]||"lista");
      else if(t.startsWith("/admin/klient/")) w.innerHTML = widokAdminKlient(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/rabaty") w.innerHTML = widokAdminRabatyZaawansowane();
      else if(t==="/admin/opinie") w.innerHTML = widokAdminOpinie();
      else if(t==="/admin/dostawy" || t==="/admin/ustawienia") w.innerHTML = widokAdminDostawy();
      else if(t==="/admin/personalizacja") w.innerHTML = widokAdminStronaGlowna();
      else if(t==="/admin/wyglad") w.innerHTML = widokAdminWyglad();
      else if(t==="/admin/rozmieszczenie") w.innerHTML = widokAdminRozmieszczenie();
      else if(t==="/admin/bannery") w.innerHTML = widokAdminBanneryZaawansowane();
      else if(t==="/admin/podstrony") w.innerHTML = widokAdminPodstrony();
      else if(t==="/admin/strony") w.innerHTML = widokAdminStrony();
      else if(t==="/admin/eksport") w.innerHTML = widokAdminEksport("import");
      else if(t.startsWith("/admin/eksport/")) { const s=t.split("/")[3]||"import"; w.innerHTML = s==="aktualizacja"?widokAdminAktualizacja("status"):widokAdminEksport(s); }
      else if(t==="/admin/aktualizacja") w.innerHTML = widokAdminAktualizacja("status");
      else if(t.startsWith("/admin/aktualizacja/")) w.innerHTML = widokAdminAktualizacja(t.split("/")[3]||"status");
      else if(t==="/admin/publikacja") w.innerHTML = widokAdminPublikacja("kontrola");
      else if(t.startsWith("/admin/publikacja/")) { const s=t.split("/")[3]||"kontrola"; w.innerHTML = s==="aktualizacja"?widokAdminAktualizacja("status"):widokAdminPublikacja(s); }
      else w.innerHTML = widokAdmin();
    }
    else w.innerHTML = `<div class="page"><div class="panel"><h1>404 — nie ma takiej strony 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
    if(t==="/"||t==="") { rysujChipy(); rysuj(); }
    seoAktualizujMetaDlaTrasy(t);
    if(typeof seoSledzTrase==="function")seoSledzTrase(t);
    if(t==="/admin/aktualizacja"&&!stanAktualizacji.sprawdzono&&!stanAktualizacji.ladowanie) setTimeout(()=>sprawdzStatusAktualizacji(true),0);
    ostatniaRenderowanaTrasa=t;
  }catch(e){
    loguj("blad", "Błąd renderowania strony: "+e.message, trasa());
    $("widok").innerHTML = `<div class="page"><div class="panel"><h1>⚠️ Coś poszło nie tak</h1><p>Błąd został zapisany w <a href="#/diagnostyka">diagnostyce</a>.</p><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
  }finally{
    renderowanieWidoku=false;
    odswiezZnacznikDiag();
    if(renderPonowniePoBiezacym){renderPonowniePoBiezacym=false;requestAnimationFrame(()=>renderuj());}
  }
}
window.addEventListener("hashchange",()=>{if(typeof adminZarejestrujTrase==="function")adminZarejestrujTrase(trasa());renderuj();requestAnimationFrame(()=>$("widok")?.focus({preventScroll:true}));});
window.addEventListener("popstate",()=>{renderuj();requestAnimationFrame(()=>$("widok")?.focus({preventScroll:true}));});

/* ═══════════ WIDOK: SKLEP (strona główna) ═══════════ */

function ikonaKategorii(nazwa){
  const mapa = {"Elektronika":"🎧","Dom i ogród":"🏡","Narzędzia":"🧰","Odzież":"🧥","Sport":"🏋️"};
  return mapa[nazwa] || "📦";
}
function ikonaKategoriiHTML(nazwa){const item=(ustawienia.ikonyKategorii||{})[nazwa];return item?.url?`<img src="${esc(item.url)}" alt="" loading="lazy">`:esc(ikonaKategorii(nazwa));}
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
function bannerUkrytyPrzezKlienta(id){try{return sessionStorage.getItem(`artway_banner_hidden_${id}`)==="1";}catch(e){return false;}}
function zamknijBannerSklepu(event,id){event.preventDefault();event.stopPropagation();try{sessionStorage.setItem(`artway_banner_hidden_${id}`,"1");}catch(e){}event.currentTarget.closest(".managed-banner-shell")?.remove();}
function bannerSklepuHTML(b){
  const n=normalizujBaner(b),type=esc(n.typ),width=esc(n.szerokosc),height=esc(n.wysokosc),mobile=esc(n.mobileMode);
  const shade=Math.max(0,Math.min(90,Number(n.przyciemnienie)||68))/100,fx=Number(n.focalX),fy=Number(n.focalY),x=Number.isFinite(fx)?Math.max(0,Math.min(100,fx)):50,y=Number.isFinite(fy)?Math.max(0,Math.min(100,fy)):50,position=`${x}% ${y}%`,direction=n.kierunekNakladki==="prawo"?"270deg":n.kierunekNakladki==="dookola"?"135deg":"90deg";
  const content=Math.max(30,Math.min(100,Number(n.szerokoscTresci)||62)),padding=Math.max(8,Math.min(48,Number(n.odstep)||18)),radius=Math.max(0,Math.min(40,Number(n.promien)||14));
  return `<article class="managed-banner-shell banner-type-${type} banner-width-${width} banner-height-${height} banner-mobile-${mobile} ${n.przyklejony?"is-sticky":""}">
    <a class="managed-banner ${n.obraz?'ma-obraz':''} banner-${esc(n.styl||"karta")} align-${esc(n.wyrownanie||"lewo")} audience-${esc(n.odbiorcy||"wszyscy")} anim-${esc(n.animacja||"brak")}" href="${esc(bezpiecznyLink(n.link))}" ${n.obraz?`aria-label="${esc(n.obrazAlt||n.tytul||"Banner")}" style="background-image:linear-gradient(${direction},rgba(15,18,25,${shade}),rgba(15,18,25,${Math.max(.08,shade-.42)})),url('${esc(n.obraz)}');background-position:${position};--banner-content:${content}%;--banner-padding:${padding}px;--banner-radius:${radius}px"`:`style="--banner-content:${content}%;--banner-padding:${padding}px;--banner-radius:${radius}px"`}>
      ${n.obraz?"":`<span class="banner-icon">${esc(n.ikona||"📣")}</span>`}
      <span class="managed-banner-content">${n.etykieta?`<em class="managed-banner-badge">${esc(n.etykieta)}</em>`:""}<h3>${esc(n.tytul||"")}</h3><p>${esc(n.opis||"")}</p>${n.kodRabatowy?`<strong class="managed-banner-code">Kod: ${esc(n.kodRabatowy)}</strong>`:""}<small class="managed-banner-cta cta-${esc(n.stylPrzycisku||"pelny")}">${esc(n.przycisk||"Dowiedz się więcej")} →</small></span>
    </a>${n.zamykany?`<button class="managed-banner-close" type="button" aria-label="Zamknij banner" onclick="zamknijBannerSklepu(event,${jsArg(n.id)})">×</button>`:""}
  </article>`;
}
function banneryHome(miejsce="sekcja-banery"){
  const teraz=Date.now();
  const lista=pobierzBannery().filter(b=>{
    if(b.aktywny===false)return false;
    const start=b.start?Date.parse(b.start):NaN,koniec=b.koniec?Date.parse(b.koniec):NaN;
    return b.umiejscowienie===miejsce&&!bannerUkrytyPrzezKlienta(b.id)&&(!Number.isFinite(start)||teraz>=start)&&(!Number.isFinite(koniec)||teraz<=koniec);
  });
  if(!lista.length) return "";
  return `<section class="managed-banners banner-placement-${esc(miejsce)}" aria-label="Bannery promocyjne">${lista.map(bannerSklepuHTML).join("")}</section>`;
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
const DOMYSLNA_KOLEJNOSC_SEKCJI = ["hero","banery","produkty","kategorie","pasekOferty","zalety","kroki","onas","faq","kontakt"];
function kolejnoscSekcji(){
  const zap = Array.isArray(ustawienia.kolejnoscSekcji) ? ustawienia.kolejnoscSekcji.filter(id=>SEKCJE_GLOWNEJ[id]) : [];
  const wynik=[...zap, ...DOMYSLNA_KOLEJNOSC_SEKCJI.filter(id=>!zap.includes(id))],produktyIndex=wynik.indexOf("produkty"),kategorieIndex=wynik.indexOf("kategorie");
  if(produktyIndex>=0&&kategorieIndex>=0&&kategorieIndex<produktyIndex){wynik.splice(kategorieIndex,1);wynik.splice(wynik.indexOf("produkty")+1,0,"kategorie");}
  return wynik;
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
  const drzewoKategorii=indeksDrzewaKategoriiMenu(kategorie),kategorieGlowne=drzewoKategorii.roots;
  const promki = produkty.filter(p=>p.staraCena).length;
  const nowosci = produkty.filter(p=>p.badge==="Nowość").length;
  const widoczneSekcje=kolejnoscSekcji().filter(sekcjaWidoczna);
  const heroMaNaglowekGlowny=widoczneSekcje.includes("hero");
  const ofertaMaNaglowekGlowny=!heroMaNaglowekGlowny&&widoczneSekcje.includes("produkty");
  const awaryjnyNaglowekGlowny=!heroMaNaglowekGlowny&&!ofertaMaNaglowekGlowny
    ?`<h1 class="sr-only home-canonical-title">Gry, zabawki i artykuły imprezowe — Artway-TM</h1>`
    :"";
  const hero = ustawienia.hero || {},oferta=ustawieniaOfertyGlownej(),heroFx=Number(hero.focalX),heroFy=Number(hero.focalY),heroX=Number.isFinite(heroFx)?Math.max(0,Math.min(100,heroFx)):50,heroY=Number.isFinite(heroFy)?Math.max(0,Math.min(100,heroFy)):50,heroShade=Math.max(0,Math.min(90,Number(hero.przyciemnienie)||76))/100,heroMin=hero.wysokosc==="niski"?280:hero.wysokosc==="wysoki"?460:360;
  const SEKCJE = {};
  SEKCJE.hero = () => `${banneryHome("nad-hero")}
  <section class="hero hero-mobile-${esc(hero.mobileMode||"kompaktowy")}">
    <div class="hero-in hero-align-${esc(hero.wyrownanie||"lewo")}" style="min-height:${heroMin}px;${hero.obraz?`background-image:linear-gradient(120deg,rgba(30,41,59,${heroShade}),rgba(49,46,129,${Math.max(.22,heroShade-.25)}) 60%,rgba(91,33,182,${Math.max(.15,heroShade-.35)})),url('${esc(hero.obraz)}');background-position:${heroX}% ${heroY}%;background-size:cover`:""}">
      <span class="hero-eyebrow">${esc(hero.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}</span>
      <h1>${esc(KONFIG.heroTytul)}</h1>
      <p>${esc(KONFIG.heroOpis)}</p>
      <div class="hero-actions">
        <a href="${esc(bezpiecznyLink(hero.link1||"#produkty"))}" ${String(hero.link1||"#produkty")==="#produkty"?`onclick="document.querySelector('.catalog-head')?.scrollIntoView({behavior:'smooth'});return false;"`:""}>${esc(hero.przycisk1||"Zobacz ofertę")} ↓</a>
        <a class="hero-link-alt" href="${esc(bezpiecznyLink(hero.link2||"#/promocje"))}">${esc(hero.przycisk2||"Sprawdź promocje")}</a>
      </div>
      <div class="hero-meta">
        <div><b>${produkty.length} produktów</b><small>w aktualnej ofercie</small></div>
        <div><b>${kategorie.length} katalogów</b><small>łatwe przeglądanie</small></div>
        <div><b>14 dni</b><small>na wygodny zwrot</small></div>
        <div><b>od ${KONFIG.darmowaDostawaOd} zł</b><small>darmowa dostawa</small></div>
      </div>
    </div>
  </section>${banneryHome("pod-hero")}`;
  SEKCJE.banery = () => banneryHome("sekcja-banery");
  SEKCJE.kategorie = () => `
  <section class="home-section home-categories">
    <div class="section-head">
      <div><h2>Znajdź to, czego szukasz</h2><p>Przejdź od razu do wybranego katalogu i zobacz produkty dopasowane do Twoich potrzeb.</p></div>
      <a href="#produkty" onclick="document.querySelector('.catalog-head')?.scrollIntoView({behavior:'smooth'});return false;">Cała oferta →</a>
    </div>
    <div class="category-grid">
      ${(Array.isArray(oferta.kategorie)&&oferta.kategorie.length?kategorie.filter(k=>oferta.kategorie.includes(k)):kategorieGlowne).map(k=>`
        <a class="category-tile" href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">
          <span class="category-ico">${ikonaKategoriiHTML(k)}</span>
          <b>${esc(k)}</b>
          <p>${esc(opisKategorii(k))}</p>
          <small>${drzewoKategorii.branchCounts[k]||0} produktów${(drzewoKategorii.children.get(k)||[]).length?` • ${(drzewoKategorii.children.get(k)||[]).length} gałęzi`:""} →</small>
        </a>`).join("")}
    </div>
  </section>`;
  SEKCJE.produkty = () => `${banneryHome("nad-produktami")}
  <div class="catalog-head" id="produkty">
    <div class="section-head">
      <div><${ofertaMaNaglowekGlowny?"h1":"h2"}>${esc(String(oferta.tytul||"").trim()||"Cała oferta")}</${ofertaMaNaglowekGlowny?"h1":"h2"}><p>${esc(oferta.opis||"")}</p></div>
      ${oferta.liczniki===false?"":`<span style="font-size:.85rem;color:var(--muted2)">${promki} promocji • ${nowosci} nowości</span>`}
    </div>
  </div>
  <div class="toolbar">
    ${oferta.wyborDzialu==="nad-produktami"?`<div id="chips" class="home-category-chips"></div>`:""}
    <select id="sortSelect" onchange="sortowanie=this.value;stronaProduktow=1;rysuj()" aria-label="Sortowanie">
      <option value="default" ${sortowanie==="default"?"selected":""}>Sortuj: domyślnie</option>
      <option value="price-asc" ${sortowanie==="price-asc"?"selected":""}>Cena: od najniższej</option>
      <option value="price-desc" ${sortowanie==="price-desc"?"selected":""}>Cena: od najwyższej</option>
      <option value="name" ${sortowanie==="name"?"selected":""}>Nazwa: A–Z</option>
      <option value="rating" ${sortowanie==="rating"?"selected":""}>Najlepiej oceniane</option>
      <option value="newest" ${sortowanie==="newest"?"selected":""}>Najnowsze</option>
    </select>
  </div>
  <div class="catalog-tools" ${oferta.filtryZaawansowane===false?`style="display:none"`:""}>
    <details class="advanced-search" ${(cenaOd||cenaDo||filtrDostepnosci!=="wszystkie"||filtrOferty!=="wszystkie"||filtrOceny!=="0")?"open":""}>
      <summary>🔎 Zaawansowane wyszukiwanie i filtry</summary>
      <div class="filter-grid">
        <label>Cena od (zł)<input type="number" min="0" step=".01" value="${esc(cenaOd)}" oninput="cenaOd=this.value;stronaProduktow=1;rysuj()" placeholder="0"></label>
        <label>Cena do (zł)<input type="number" min="0" step=".01" value="${esc(cenaDo)}" oninput="cenaDo=this.value;stronaProduktow=1;rysuj()" placeholder="bez limitu"></label>
        <label>Dostępność<select onchange="filtrDostepnosci=this.value;stronaProduktow=1;rysuj()"><option value="wszystkie">Wszystkie</option><option value="dostepne" ${filtrDostepnosci==="dostepne"?"selected":""}>Dostępne w sprzedaży</option><option value="brak" ${filtrDostepnosci==="brak"?"selected":""}>Chwilowo niedostępne</option></select></label>
        <label>Rodzaj oferty<select onchange="filtrOferty=this.value;stronaProduktow=1;rysuj()"><option value="wszystkie">Wszystkie</option><option value="promocje" ${filtrOferty==="promocje"?"selected":""}>Promocje</option><option value="nowosci" ${filtrOferty==="nowosci"?"selected":""}>Nowości</option></select></label>
        <label>Minimalna ocena<select onchange="filtrOceny=this.value;stronaProduktow=1;rysuj()"><option value="0">Dowolna</option><option value="3" ${filtrOceny==="3"?"selected":""}>3★ i więcej</option><option value="4" ${filtrOceny==="4"?"selected":""}>4★ i więcej</option><option value="4.5" ${filtrOceny==="4.5"?"selected":""}>4,5★ i więcej</option></select></label>
      </div>
      <button class="btn ghost" style="margin-top:.65rem" onclick="wyczyscFiltryProduktow()">Wyczyść filtry</button>
    </details>
  </div>
  <div class="results-bar"><span id="wynikowProdukty"></span><label>Na stronie: <select onchange="ustawProduktyNaStronie(this.value)">${[12,24,48,96].map(n=>`<option value="${n}" ${produktyNaStronie===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
  <div class="pagination" id="paginacjaGora"></div>
  <div class="grid" id="grid"></div>
  <div class="pagination" id="paginacjaDol"></div>
  ${oferta.wyborDzialu!=="ukryty"&&oferta.wyborDzialu!=="nad-produktami"?`<div class="home-department-picker"><span>Wybierz dział oferty</span><div id="chips" class="home-category-chips"></div></div>`:""}${banneryHome("pod-produktami")}`;
  SEKCJE.pasekOferty = () => { const o = ustawienia.pasekOkazji || {},promo=glownaPromocja(),kod=o.kodRabatowy||promo?.kod||"",fx=Number(o.focalX),fy=Number(o.focalY),x=Number.isFinite(fx)?Math.max(0,Math.min(100,fx)):50,y=Number.isFinite(fy)?Math.max(0,Math.min(100,fy)):50,shade=Math.max(0,Math.min(90,Number(o.przyciemnienie)||72))/100,min=o.wysokosc==="niski"?90:o.wysokosc==="wysoki"?190:130; return `
  <section class="offer-band offer-band-${esc(o.mobileMode||"kompaktowy")} ${o.przyklejony?"offer-band-sticky":""}">
    <div class="offer-band-in" style="min-height:${min}px;${o.obraz?`background-image:linear-gradient(90deg,rgba(30,41,59,${shade}),rgba(49,46,129,${Math.max(.18,shade-.28)})),url('${esc(o.obraz)}');background-position:${x}% ${y}%;background-size:cover`:""}">
      <span class="offer-band-icon">${esc(o.ikona||"🎁")}</span><div>${o.etykieta?`<small>${esc(o.etykieta)}</small>`:""}<h2>${esc(o.tytul||"Dobry moment na zakupy")}</h2><p>${o.opis?esc(o.opis):(kod?`Użyj kodu <b>${esc(kod)}</b>${promo?.procent?` w koszyku i odbierz ${esc(promo.procent)}% rabatu na zamówienie.`:" w koszyku."}`:"Sprawdź aktualne okazje i produkty w dobrych cenach.")}</p></div>
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
  SEKCJE.kontakt = () => `${banneryHome("przed-stopka")}
  <section class="home-section home-contact">
    <div class="contact-strip">
      <div><h2>Zostało pytanie?</h2><p>Skontaktuj się z nami — odpowiadamy w dni robocze.</p></div>
      <div class="contact-strip-actions">
        <a class="btn" href="#/kontakt">Napisz wiadomość</a>
        <a class="btn ghost" href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a>
      </div>
    </div>
  </section>`;
  return awaryjnyNaglowekGlowny+widoczneSekcje.map(id => SEKCJE[id] ? SEKCJE[id]() : "").join("\n");
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
  const tekst=normalizujSzukanyTekst([p.nazwa,p.opisKrotki,p.opis,p.kategoria,p.sku,p.gtin,p.ean,p.externalId,p.mpn,p.kodProducenta,p.allegroOfferId,p.producent,p.marka,p.kolorProduktu,p.rozmiar,p.material,(p.warianty||[]).join(" "),p.id].join(" "));
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
  const od=cenaOd===""?null:Number(cenaOd),doC=cenaDo===""?null:Number(cenaDo),minOcena=Number(filtrOceny||0),oferta=ustawieniaOfertyGlownej();
  const lista=produkty.filter(p=>{
    const ocena=sredniaOcen(p.id)?.srednia||0, niedostepny=produktOznaczonyNiedostepny(p);
    const zakres=oferta.zakres==="promocje"?!!p.staraCena:oferta.zakres==="nowosci"?p.badge==="Nowość":oferta.zakres==="kategoria"?produktNalezyDoGaleziKategorii(p,oferta.kategoria):oferta.zakres==="wybrane"?oferta.produkty.includes(String(p.id)):true;
    return zakres&&produktNalezyDoGaleziKategorii(p,aktywnaKategoria)
      && produktPasujeFrazie(p)
      && (od===null||p.cena>=od)&&(doC===null||p.cena<=doC)
      && (filtrDostepnosci==="wszystkie"||(filtrDostepnosci==="dostepne"&&!niedostepny)||(filtrDostepnosci==="brak"&&niedostepny))
      && (filtrOferty==="wszystkie"||(filtrOferty==="promocje"&&!!p.staraCena)||(filtrOferty==="nowosci"&&p.badge==="Nowość"))
      && ocena>=minOcena;
  });
  return sortujListeProduktow(lista,sortowanie==="default"?(oferta.sortowanie||"default"):sortowanie);
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
function kartaProduktu(p,index=0){
  const ulub = ulubione.includes(p.id);
  const oceny = sredniaOcen(p.id);
  const brakCeny = !produktMaCeneSprzedazy(p);
  const niedostepny = produktOznaczonyNiedostepny(p);
  return `
  <article class="card" onclick="przejdzDoSklepu('/produkt/${encodeURIComponent(p.id)}')">
    <div class="thumb" style="background:${p.kolor||'#eef2f7'}">
      ${niedostepny?`<span class="badge" style="background:#64748b">Chwilowo niedostępne</span>`:(brakCeny?`<span class="badge" style="background:#f97316">Do wyceny</span>`:(p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:""))}
      ${jestAdmin()?"":`<button class="fav-btn" onclick="event.stopPropagation();przelaczUlubione(${p.id})" aria-label="Ulubione">${ulub?"❤️":"🤍"}</button>`}
      ${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" loading="${index<4?'eager':'lazy'}" decoding="async" ${index<4?'fetchpriority="high"':''} style="width:100%;height:100%;object-fit:cover;${niedostepny?'filter:grayscale(1);opacity:.6':''}" onerror="this.remove();loguj('ostrzezenie','Nie wczytano zdjęcia produktu: ${esc(p.nazwa)}')">`:(p.ikona||"📦")}
    </div>
    <div class="card-body">
      <span class="cat-label">${esc(p.kategoria)}${oceny?` <span style="color:var(--accent);text-transform:none;letter-spacing:0">★ ${oceny.srednia.toFixed(1)} (${oceny.n})</span>`:""}</span>
      <h3><a href="/produkt/${encodeURIComponent(p.id)}" onclick="event.stopPropagation();return nawigujSklep(event,this.getAttribute('href'))">${esc(p.nazwa)}</a></h3>
      <p class="desc">${esc(skrocTekst(opisKrotkiProduktu(p),190))}</p>
      <div class="price-row">
        <span class="price">${brakCeny?"Cena do uzupełnienia":zl(p.cena)}</span>
        ${p.staraCena?`<span class="old-price">${zl(p.staraCena)}</span>`:""}
      </div>
      ${brakCeny?`<p style="font-size:.76rem;color:#c2410c;font-weight:700;margin-bottom:.4rem">Produkt zaimportowany z ceną 0,00 — popraw cenę w panelu</p>`:""}
      ${niedostepny?`<p style="font-size:.76rem;color:var(--danger);font-weight:700;margin-bottom:.4rem">Chwilowo niedostępne w sprzedaży</p>`:""}
      ${niedostepny||brakCeny
        ? `<button class="add-btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
        : p.warianty?.length
          ? `<button class="add-btn" onclick="event.stopPropagation();przejdzDoSklepu('/produkt/${encodeURIComponent(p.id)}')" style="background:var(--brand2)">Wybierz wariant →</button>`
          : `<div class="card-purchase" onclick="event.stopPropagation()"><div class="card-quantity" aria-label="Liczba sztuk"><button type="button" onclick="ustawIloscKarty(this.nextElementSibling,-1)" aria-label="Zmniejsz liczbę sztuk">−</button><input data-card-quantity type="number" min="1" max="99" step="1" value="1" inputmode="numeric" aria-label="Liczba sztuk produktu ${esc(p.nazwa)}" onchange="ustawIloscKarty(this)"><button type="button" onclick="ustawIloscKarty(this.previousElementSibling,1)" aria-label="Zwiększ liczbę sztuk">+</button></div><button class="add-btn" onclick="dodajZKarty(${p.id},this)">Do koszyka</button></div>`}
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
      <input placeholder="Szukaj w tej liście…" value="${esc(frazaListyProduktow)}" oninput="frazaListyProduktow=this.value;stronaListyProduktow=1;zaplanujRenderPoWpisaniu()" style="flex:1;min-width:200px;padding:.45rem .7rem;border:1.5px solid var(--line);border-radius:10px">
      <select onchange="sortowanieListyProduktow=this.value;stronaListyProduktow=1;renderuj()"><option value="default">Domyślne</option><option value="price-asc" ${sortowanieListyProduktow==="price-asc"?"selected":""}>Cena rosnąco</option><option value="price-desc" ${sortowanieListyProduktow==="price-desc"?"selected":""}>Cena malejąco</option><option value="name" ${sortowanieListyProduktow==="name"?"selected":""}>Nazwa A–Z</option><option value="rating" ${sortowanieListyProduktow==="rating"?"selected":""}>Najlepiej oceniane</option></select>
    </div>
    <div class="results-bar" style="padding:0;margin:.5rem 0"><span>${filtrowana.length?`Znaleziono <b>${filtrowana.length}</b> • pokazano ${start+1}–${Math.min(start+produktyNaLiscie,filtrowana.length)}`:"Brak wyników"}</span><label>Na stronie: <select onchange="ustawLiczbeListyProduktow(this.value)">${[12,24,48,96].map(n=>`<option value="${n}" ${produktyNaLiscie===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
    ${fragment.length?`<div class="grid" style="padding:0;margin:.7rem 0">${fragment.map(kartaProduktu).join("")}</div>`:`<div class="panel"><p>${pusty}</p></div>`}
    <div class="pagination">${paginacjaHTML(stronaListyProduktow,stron,"ustawStroneListyProduktow")}</div>`;
}
function widokKategoria(nazwa){
  nazwa=wszystkieKategorie().find(k=>k===nazwa||seoSlugKategorii(k)===seoSlugKategorii(nazwa))||nazwa;
  if(!wszystkieKategorie().includes(nazwa))
    return `<div class="page"><div class="panel"><h1>Nie ma takiego katalogu 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
  const kategorie=wszystkieKategorie(),tree=indeksDrzewaKategoriiMenu(kategorie),galaz=kategorieGaleziMenu(nazwa,kategorie),lista=produkty.filter(p=>galaz.has(p.kategoria)),dzieci=tree.children.get(nazwa)||[],sciezka=tree.paths[nazwa]||[nazwa];
  return `
  <div class="page" style="max-width:1200px">
    <div class="crumb"><a href="/" onclick="return nawigujSklep(event,'/')">Sklep</a> › ${sciezka.map((k,i)=>i===sciezka.length-1?esc(k):`<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">${esc(k)}</a>`).join(" › ")}</div>
    <h1 style="margin-bottom:.8rem">🗂️ ${esc(nazwa)} <small style="color:var(--muted2);font-size:.9rem">(${lista.length})</small></h1>
    ${dzieci.length?`<section class="category-branch-grid" aria-label="Podkatalogi ${esc(nazwa)}">${dzieci.map(k=>`<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))"><span>${ikonaKategoriiHTML(k)}</span><div><b>${esc(k)}</b><small>${tree.branchCounts[k]||0} produktów${(tree.children.get(k)||[]).length?` • ${(tree.children.get(k)||[]).length} kolejnych gałęzi`:""}</small></div><i>›</i></a>`).join("")}</section>`:""}
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
let iloscProduktu = 1,ostatniProduktIlosci=null;
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
  const p = produktSklepuPoId(id);
  if(!p){ loguj("ostrzezenie","Otwarto nieistniejący produkt: id="+id); return `<div class="page"><div class="panel"><h1>Nie znaleziono produktu 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`; }
  if(String(ostatniProduktIlosci)!==String(id)){iloscProduktu=1;ostatniProduktIlosci=id;}
  const powiazane = produkty.filter(x=>x.kategoria===p.kategoria && x.id!==p.id).slice(0,4);
  const brakCeny = !produktMaCeneSprzedazy(p);
  const niedostepny = produktOznaczonyNiedostepny(p);
  const sciezkaKategorii=sciezkaKategoriiMenu(p.kategoria);
  return `
  <div class="page">
    <div class="crumb"><a href="/" onclick="return nawigujSklep(event,'/')">Sklep</a> › ${sciezkaKategorii.map(k=>`<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">${esc(k)}</a>`).join(" › ")} › ${esc(p.nazwa)}</div>
    <div class="panel">
      <div class="prod-detail">
        <div>
          <div class="prod-thumb" style="background:${p.kolor||'#eef2f7'}">
            ${niedostepny?`<span class="badge" style="background:#64748b">Chwilowo niedostępne</span>`:(p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:"")}
            ${p.zdjecie?`<img id="glowneZdjecie" src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}">`:(p.ikona||"📦")}
          </div>
          ${(p.zdjecie && p.zdjecia?.length)?`
          <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
            ${[p.zdjecie,...p.zdjecia].map((z,i)=>`<img src="${esc(z)}" alt="Miniatura ${esc(p.nazwa)} — zdjęcie ${i+1}" onclick="pokazZdjecie('${esc(z)}')" style="width:62px;height:62px;object-fit:cover;border-radius:9px;border:2px solid ${i===0?'var(--brand)':'var(--line)'};cursor:pointer" onmouseover="this.style.borderColor='var(--brand)'" onmouseout="this.style.borderColor='var(--line)'">`).join("")}
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
          <p style="color:var(--muted2);font-size:1.02rem;line-height:1.55">${esc(opisKrotkiProduktu(p))}</p>
          ${specyfikacjaProduktuHTML(p)}
          ${p.warianty?.length?`
          <div class="f-group" style="max-width:260px;margin:.6rem 0 0"><label>Wybierz wariant *</label>
            <select id="wariantSel">${p.warianty.map(w=>`<option>${esc(w)}</option>`).join("")}</select>
          </div>`:""}
          <label class="product-detail-quantity">Ilość sztuk</label>
          <div class="qty-big" aria-label="Wybierz liczbę sztuk">
            <button type="button" onclick="zmienIloscProd(-1)" aria-label="Zmniejsz liczbę sztuk">−</button>
            <input id="prodQty" type="number" min="1" max="99" step="1" value="${esc(iloscProduktu)}" inputmode="numeric" aria-label="Liczba sztuk" oninput="ustawIloscProduktu(this.value)" onchange="ustawIloscProduktu(this.value)">
            <button type="button" onclick="zmienIloscProd(1)" aria-label="Zwiększ liczbę sztuk">+</button>
          </div>
          <div style="display:flex;gap:.7rem;flex-wrap:wrap">
            ${niedostepny||brakCeny
              ? `<button class="btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
              : `<button class="btn" onclick="dodajIlosc(${p.id})">🛒 Do koszyka</button>`}
            ${jestAdmin()?"":`<button class="btn ghost" onclick="przelaczUlubione(${p.id});renderuj()">${ulubione.includes(p.id)?"❤️ W ulubionych":"🤍 Dodaj do ulubionych"}</button>`}
          </div>
          ${niedostepny
            ? `<p style="font-size:.83rem;color:var(--danger);margin-top:1rem;font-weight:600">✖ Chwilowo niedostępny — sprawdź później albo skontaktuj się ze sklepem</p>`
            : `<p style="font-size:.83rem;color:var(--ok);margin-top:1rem;font-weight:600">✔ Dostępny w sprzedaży • ${esc(tekstWysylki().toLowerCase())}</p>`}
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
        <details open><summary>Opis</summary>${opisProduktuHTML(p)}</details>
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
function ustawIloscProduktu(value){iloscProduktu=Math.max(1,Math.min(99,Math.floor(Number(value)||1)));const e=$("prodQty");if(e)e.value=iloscProduktu;}
function zmienIloscProd(d){ustawIloscProduktu(iloscProduktu+Number(d||0));}
function dodajIlosc(id){
  const wariant = $("wariantSel")?.value || null;
  dodajWIlosci(id,iloscProduktu,null,wariant);
}
function pokazZdjecie(src){ const g=$("glowneZdjecie"); if(g) g.src=src; }

/* ═══════════ WIDOK: LOGOWANIE / REJESTRACJA ═══════════ */

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
  if(!maUprawnieniaZapisuChmury()){ if(!cicho) chmuraUstawToken(); return false; }
  chmuraOstatniaSynchronizacjaCentralnaZmienilaDane=false;
  stanBazyCentralnej={...stanBazyCentralnej,synchronizacja:true};
  try{
    const d=await chmura("store-sync",{method:"POST",body:{orders:pobierzZamowienia(),users:pobierzUzytkownikow(),deleted_orders:zamowieniaUsuniete}});
    if(Array.isArray(d.deleted_orders)) scalUsunieteZamowienia(d.deleted_orders);
    chmuraOstatniaSynchronizacjaCentralnaZmienilaDane=zapiszLS("artway_zamowienia",Array.isArray(d.orders)?filtrujAktywneZamowienia(d.orders):[])||chmuraOstatniaSynchronizacjaCentralnaZmienilaDane;
    chmuraOstatniaSynchronizacjaCentralnaZmienilaDane=zapiszLS("artway_uzytkownicy",polaczUzytkownikowCentralnych(d.users))||chmuraOstatniaSynchronizacjaCentralnaZmienilaDane;
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
    if(!publiczne&&!maUprawnieniaZapisuChmury()) return false;
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
    const action=maUprawnieniaZapisuChmury()?"store-user-save":"account-profile-save";
    await chmura(action,{method:"POST",body:{user:u}});
    return true;
  }catch(bl){ return false; }
}
async function odtworzSesjeCentralna(){
  try{
    if(maUprawnieniaZapisuChmury()){ await synchronizujBazeCentralna(true); }
    else if(sesja && !jestAdmin()){ await pobierzMojeZamowieniaCentralne(true); }
  }catch(e){}
}
function odswiezPoCichejSynchronizacji(){
  if(typeof document!=="undefined" && document.hidden) return;
  if(typeof agentAIDecyzjeMagazynoweBusy!=="undefined" && agentAIDecyzjeMagazynoweBusy.size) return;
  const aktywny=document.activeElement, tag=aktywneTag => aktywneTag && ["INPUT","TEXTAREA","SELECT"].includes(aktywneTag.tagName);
  if(tag(aktywny)) return;
  const t=trasa();
  const odswiezane=["/admin","/admin/pulpit","/admin/zamowienia","/admin/wysylki","/admin/agent-ai","/admin/magazyn","/admin/allegro","/zamowienia"];
  if(!odswiezane.some(x=>t===x || (["/admin/pulpit","/admin/agent-ai","/admin/magazyn","/admin/allegro"].includes(x)&&t.startsWith(x+"/")) || (x==="/admin/wysylki"&&t.startsWith("/admin/zamowienie/")))) return;
  const y=window.scrollY||0;
  renderuj();
  setTimeout(()=>window.scrollTo({top:y,behavior:"instant"}),0);
}
async function automatycznaSynchronizacjaChmury(powod="timer"){
  if(chmuraAutoSyncBusy) return false;
  if(typeof document!=="undefined" && document.hidden && powod==="timer") return false;
  const teraz=Date.now();
  if(powod!=="timer"&&teraz-chmuraAutoSyncOstatniStart<CHMURA_FOCUS_SYNC_MIN_MS)return false;
  chmuraAutoSyncOstatniStart=teraz;
  chmuraAutoSyncBusy=true;
  try{
    let ok=false,daneZmienione=false;
    if(maUprawnieniaZapisuChmury()){
      ok = await synchronizujBazeCentralna(true);
      daneZmienione=chmuraOstatniaSynchronizacjaCentralnaZmienilaDane;
      ok = (await chmuraWczytajStan()) || ok;
      daneZmienione=chmuraOstatniPullZmienilDane||daneZmienione;
    }else{
      ok = await chmuraWczytajStan();
      daneZmienione=chmuraOstatniPullZmienilDane;
      if(sesja && !jestAdmin()){
        const przed=localStorage.getItem("artway_zamowienia");
        ok = (await pobierzMojeZamowieniaCentralne(true)) || ok;
        daneZmienione=przed!==localStorage.getItem("artway_zamowienia")||daneZmienione;
      }
    }
    const allegroOk=typeof allegroOdswiezDaneZSerweraJesliCzas==="function"?await allegroOdswiezDaneZSerweraJesliCzas(powod):false;
    if(daneZmienione){
      zastosujUstawienia(); zbudujProdukty();
      odswiezMenu(); odswiezKoszyk();
      odswiezPoCichejSynchronizacji();
    }else if(allegroOk){
      odswiezMenu();odswiezPoCichejSynchronizacji();
    }
    return ok||allegroOk;
  }catch(e){ return false; }
  finally{ chmuraAutoSyncBusy=false; }
}
function uruchomAutoSynchronizacjeChmury(){
  if(chmuraTimerAutoSync) clearInterval(chmuraTimerAutoSync);
  chmuraAutoSyncOstatniStart=Date.now();
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
      czesci.push(cloud.email?.authenticated?`SMTP ${cloud.email.provider||""} połączony`:cloud.email?.configured?"SMTP zapisany — wymaga testu":"SMTP wymaga naprawy poświadczenia");
      czesci.push(ip.authenticated?`InPost ShipX połączony (${ip.env||"production"})`:ip.configured?`InPost ShipX zapisany (${ip.env||"production"})`:`InPost: brakuje ${(ip.missingEnv&&ip.missingEnv.length?ip.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")}`);
      if(!ip.geowidgetConfigured) czesci.push("mapa paczkomatów: brak INPOST_GEOWIDGET_TOKEN");
      toast(czesci.join(" • "));
    }
    if(maUprawnieniaZapisuChmury()&&Date.now()-ostatniTestIntegracjiSerwerowych>15*60*1000)setTimeout(()=>sprawdzPolaczeniaSerwerowe(true),0);
    if(trasa().startsWith("/admin/wysylki")||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy"||trasa().startsWith("/admin/agent-ai")) renderuj();
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
  if(trasa().startsWith("/admin/wysylki")||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy"||trasa().startsWith("/admin/agent-ai")) renderuj();
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
async function testujInPost(cicho=false){
  try{
    const cfg=await pobierzInpostConfig(true);
    stanBramki={...stanBramki,inpost:cfg||stanBramki.inpost};
    if(!maUprawnieniaZapisuChmury()){ if(!cicho)chmuraUstawToken(); return false; }
    const d=await chmura("inpost-test",{timeout:15000});
    const ip=d.inpost||cfg||{};
    stanBramki={...stanBramki,inpost:ip,error:""};
    const org=ip.organization?.id?` • organizacja ${ip.organization.id}`:"";
    const uslugi=ip.organization?.services?.length?` • usługi: ${ip.organization.services.slice(0,3).join(", ")}`:"";
    const av=ip.serviceAvailability||{};
    const uwagaPaczkomat=av.locker===false?` • paczkomat ${av.lockerService||"inpost_locker_standard"} wymaga włączenia`:"";
    const uwagaKurier=av.courier===false?` • kurier ${av.courierService||"inpost_courier_standard"} wymaga włączenia`:"";
    if(!cicho)toast(`InPost ShipX połączony trwale ✅ (${ip.env||"production"})${org}${ip.geowidgetConfigured?" • mapa aktywna":" • mapa wymaga konfiguracji"}${uslugi}${uwagaPaczkomat}${uwagaKurier}`);
    if(!cicho)renderuj();
    return true;
  }catch(bl){
    const ip=bl.inpost||stanBramki.inpost||{};
    stanBramki={...stanBramki,inpost:ip,error:bl.message};
    if(!cicho){
      if(bl.code==="inpost_not_configured") toast("InPost niegotowy — brakuje: "+((bl.missingEnv&&bl.missingEnv.length?bl.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")));
      else toast("Test InPost: "+bl.message);
      renderuj();
    }
    return false;
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
    const pobranieAktywneForm=f.has("pobranieAktywne")
      ? String(f.get("pobranieAktywne")||"").trim()==="tak"
      : pobranieAktywneZamowienia(zam,w);
    const pobranieForm=pobranieAktywneForm ? String(f.get("pobranie")||w.pobranie||kwotaNum(zam.razem).toFixed(2)).trim() : "";
    const paczkaWeekendForm=f.has("paczkaWeekend") ? String(f.get("paczkaWeekend")||"").trim()==="tak" : !!(w.paczkaWeekend||zam.paczkaWeekend);
    const sposobNadania=String(f.get("sposobNadania")||w.sposobNadania||INPOST_DOMYSLNY_SP_NADANIA).trim();
    const punktNadania=String(f.get("punktNadania")||w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
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
      pobranieAktywne:pobranieAktywneForm,
      pobranie:pobranieForm,
      paczkaWeekend:paczkaWeekendForm,
      sposobNadania:INPOST_SP_NADANIA[sposobNadania]?sposobNadania:INPOST_DOMYSLNY_SP_NADANIA,
      punktNadania,
      formatEtykiety:String(f.get("formatEtykiety")||w.formatEtykiety||"A6").trim().toUpperCase()==="A4"?"A4":"A6",
      zadania:{...(w.zadania||{}),dane:true},
      zaktualizowano:new Date().toISOString()
    };
    zapiszKosztyZamowienia(zam,{dostawaId:zam.dostawaId,paczkaWeekend:zam.wysylka.paczkaWeekend});
    if(pobranieAktywneForm && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) zam.wysylka.pobranie=kwotaNum(zam.razem).toFixed(2);
  });
  if(zapisane) await zapiszZamowienieCentralnie(zapisane,false);
  return zapisane;
}
async function utworzPrzesylkeAPI(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z)return toast("Nie znaleziono zamówienia");
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
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
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
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
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
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
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
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
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
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

/* Pozycjonowanie i darmowa promocja — bez płatnych API i bez sztucznych zmian treści. */
const TABY_SEO=[
  ["pulpit","📊 Pulpit"],["efekty","📈 Efekty"],["plan","🗓️ Plan dzienny"],["produkty","🏷️ Produkty SEO"],["tresci","✍️ Frazy i treści"],
  ["promocja","📣 Darmowa promocja"],["techniczne","🛠️ Techniczne SEO"],["historia","🧾 Historia"],["ustawienia","⚙️ Ustawienia"]
];
function seoSzkielet(tab,tresc){const extras=tab==="promocja"?seoDodatkoweKanalyHTML():"";return adminSzkielet("/admin/seo",`${adminSubnavHTML(TABY_SEO.map(([id,label])=>({id,href:`#/admin/seo/${id}`,label})),tab)}${tresc}${extras}`);}
function seoDodatkoweKanalyHTML(){return `<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Dodatkowe kanały bez budżetu</span><h2>🌐 Pełne bezpłatne pokrycie</h2><p class="order-detail-lead">Automaty uruchamiamy tam, gdzie jest to bezpieczne. Kanały wymagające konta lub ręcznej publikacji pozostają wyraźnie oznaczone.</p></div></div><div class="seo-free-channels"><article><b>🖼️ Google Images i Lens — automatycznie</b><p>Mapa obrazów oraz dodatkowe zdjęcia w feedzie pomagają prezentować produkty w bezpłatnych wynikach obrazów i Lens.</p><a class="btn ghost" href="/sitemap.xml" target="_blank">Mapa obrazów</a></article><article><b>🔍 Bing i inne wyszukiwarki — automatycznie</b><p>IndexNow przekazuje nowe i zmienione adresy. Bezpłatne Bing Webmaster Tools pozwala dodatkowo kontrolować raporty.</p><a class="btn ghost" href="https://www.bing.com/webmasters/" target="_blank" rel="noopener">Bing Webmaster Tools ↗</a></article><article><b>📤 Udostępnianie organiczne — na żądanie</b><p>Produkt ma gotowy tytuł, opis i czysty adres do bezpłatnego udostępnienia. Publikacja pozostaje ręczna, aby nie wysyłać spamu.</p><a class="btn ghost" href="#/admin/seo/produkty">Wybierz produkt</a></article><article><b>📍 Profil Firmy Google — warunkowo</b><p>Bezpłatny profil lokalny ma sens wyłącznie przy rzeczywistej obsłudze klientów pod adresem lub na określonym obszarze.</p><a class="btn ghost" href="https://business.google.com/" target="_blank" rel="noopener">Profil Firmy Google ↗</a></article></div></section>`;}
function seoTekstBezHTML(value=""){const el=document.createElement("div");el.innerHTML=String(value||"");return String(el.textContent||"").replace(/\s+/g," ").trim();}
function seoPropozycjaProduktu(p={}){
  const brand=String(p.producent||p.marka||"").trim(),category=String(p.kategoria||"").trim();
  let title=[p.nazwa,brand&&!String(p.nazwa||"").toLowerCase().includes(brand.toLowerCase())?brand:""].filter(Boolean).join(" – ");if(title.length<30&&category&&!title.toLowerCase().includes(category.toLowerCase()))title+=` – ${category}`;if(title.length<30)title+=` | Artway-TM`;title=skrocTekst(title,60);
  const source=seoTekstBezHTML(p.opisKrotki||p.krotkiOpis||p.opis||"");
  let description=source||`${p.nazwa||"Produkt"}${category?` z kategorii ${category}`:""}. Sprawdź szczegóły, dostępność i bezpieczne zakupy w Artway-TM.`;
  if(description.length<80)description=`${description} Poznaj opis, aktualną cenę i warunki dostawy w sklepie Artway-TM.`;
  description=skrocTekst(description,158);
  const keywords=[p.nazwa,category,brand,p.gtin||p.ean,p.sku].filter(Boolean).flatMap(v=>String(v).split(/[|,;/]+/)).map(v=>v.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,8).join(", ");
  return {seoTitle:title,seoDescription:description,seoKeywords:keywords};
}
function seoEfektywneDaneProduktu(p={}){
  const proposal=seoPropozycjaProduktu(p);
  return {...p,seoTitle:String(p.seoTitle||proposal.seoTitle||""),seoDescription:String(p.seoDescription||proposal.seoDescription||""),seoKeywords:String(p.seoKeywords||proposal.seoKeywords||""),seoMode:p.seoMode==="manual"?"manual":"auto"};
}
function seoAutomatyzujDaneProduktu(p={},source="automatyczne SEO produktu",options={}){
  const proposal=seoPropozycjaProduktu(p),mode=p.seoMode==="manual"?"manual":"auto",force=options.force===true||mode==="auto",now=new Date().toISOString(),next={...p,seoMode:mode};
  for(const field of ["seoTitle","seoDescription","seoKeywords"])if(force||!String(next[field]||"").trim())next[field]=proposal[field];
  next.seoReviewedAt=now;next.seoSource=source;next.seoScore=seoOcenaProduktu({...next,seoReviewedAt:now}).score;
  return next;
}
function seoOcenaProduktu(p={}){
  const proposed=seoPropozycjaProduktu(p),title=String(p.seoTitle||""),desc=String(p.seoDescription||""),full=seoTekstBezHTML(p.opis||""),issues=[];let score=0;
  if(title.length>=30&&title.length<=65)score+=18;else issues.push("tytuł SEO");
  if(desc.length>=80&&desc.length<=165)score+=18;else issues.push("opis SEO");
  if(full.length>=250)score+=16;else issues.push("pełny opis");
  if(p.zdjecie)score+=12;else issues.push("zdjęcie");
  if(p.kategoria)score+=8;else issues.push("kategoria");
  if(p.gtin||p.ean)score+=8;else issues.push("EAN/GTIN");
  if(p.producent||p.marka)score+=7;else issues.push("producent");
  if(Number(p.cena)>0)score+=7;else issues.push("cena");
  if(p.sourceUrl||p.producentUrl)score+=3;else issues.push("źródło");
  if(p.seoReviewedAt)score+=3;
  return {score:Math.min(100,score),issues,proposed};
}
function seoKolejkaProduktow(){
  const hidden=new Set([...(produktyUkryte||[]),...(produktyDefinitywne||[]),...(koszDodanych||[]).map(x=>x.id)].map(String));
  return produktyDoAdministracji().filter(p=>!hidden.has(String(p.id))&&!produktOznaczonyNiedostepny(p)&&Number(p.cena)>0).map(p=>{const effective=seoEfektywneDaneProduktu(p);return {...seoOcenaProduktu(effective),product:p,effective,coverage:"sklep • Google • Open Graph • dane strukturalne"};}).sort((a,b)=>{
    const ap=a.product.seoPromoted||a.product.badge?1:0,bp=b.product.seoPromoted||b.product.badge?1:0;
    if(seoUstawienia.preferBestsellers!==false&&bp!==ap)return bp-ap;
    return a.score-b.score||String(a.product.seoReviewedAt||"").localeCompare(String(b.product.seoReviewedAt||""))||String(a.product.nazwa||"").localeCompare(String(b.product.nazwa||""),"pl");
  });
}
function seoZapiszLokalnie(id,patch){zapiszPolaProduktuLokalnie(id,patch,false);}
function seoWykonajPlanLokalny(limit=seoUstawienia.dailyLimit,source="ręcznie"){
  const amount=Math.max(1,Math.min(50,Number(limit)||5)),today=new Date().toISOString().slice(0,10),queue=seoKolejkaProduktow(),fresh=queue.filter(x=>!String(x.product.seoReviewedAt||"").startsWith(today)),selected=fresh.slice(0,amount),now=new Date().toISOString();
  for(const item of selected){const p=item.product,next=seoAutomatyzujDaneProduktu(p,source,{force:p.seoMode!=="manual"&&seoUstawienia.autoFillMissing!==false}),patch={seoTitle:next.seoTitle,seoDescription:next.seoDescription,seoKeywords:next.seoKeywords,seoMode:next.seoMode,seoReviewedAt:next.seoReviewedAt,seoSource:next.seoSource,seoScore:next.seoScore};seoZapiszLokalnie(p.id,patch);}
  seoUstawienia={...seoUstawienia,lastRunAt:now,lastRunCount:selected.length};seoHistoria=[{id:`seo-${Date.now()}`,at:now,type:"daily",source,count:selected.length,products:selected.map(x=>({id:x.product.id,name:x.product.nazwa,scoreBefore:x.score}))},...(seoHistoria||[])].slice(0,500);
  zapiszLS("artway_seo_ustawienia",seoUstawienia);zapiszLS("artway_seo_historia",seoHistoria);zaplanujZapisUstawien();zbudujProdukty();return selected;
}
async function seoUruchomPlanDzienny(button){
  if(button)button.disabled=true;try{const d=await chmura("seo-daily-run",{method:"POST",body:{limit:seoUstawienia.dailyLimit,source:"manual-admin"},timeout:60000});await chmuraWczytajStan();zbudujProdukty();const sent=d.promotion?.accepted?` • zgłoszono ${d.promotion.count||0} adresów przez IndexNow`:"";toast(`✅ Plan SEO: opracowano ${d.processed||0} produktów${sent}`);}catch(e){const done=seoWykonajPlanLokalny(seoUstawienia.dailyLimit,"lokalnie — synchronizacja oczekuje");toast(`✅ Plan SEO wykonany lokalnie: ${done.length} produktów`);}finally{if(button)button.disabled=false;renderuj();}
}
function zapiszSeoUstawienia(event){event.preventDefault();const f=new FormData(event.currentTarget),limit=Math.max(1,Math.min(50,Number(f.get("dailyLimit"))||5));seoUstawienia={...seoUstawienia,enabled:f.get("enabled")==="on",autoFillMissing:f.get("autoFillMissing")==="on",autoAllProducts:true,preferBestsellers:f.get("preferBestsellers")==="on",indexNowEnabled:f.get("indexNowEnabled")==="on",dailyLimit:limit,searchConsoleReady:f.get("searchConsoleReady")==="on",merchantCenterReady:f.get("merchantCenterReady")==="on",businessProfileReady:f.get("businessProfileReady")==="on"};zapiszLS("artway_seo_ustawienia",seoUstawienia);zaplanujZapisUstawien();toast("Ustawienia pozycjonowania zapisane ✅");renderuj();}
function seoUstawLimit(value){const input=document.querySelector('[name="dailyLimit"]');if(input){input.value=value;input.focus();}}
function seoPrzelaczPromowanie(id){const p=pobierzProduktAdmin(id);if(!p)return;seoZapiszLokalnie(id,{seoPromoted:!p.seoPromoted,seoPromotedAt:!p.seoPromoted?new Date().toISOString():""});zaplanujZapisUstawien();zbudujProdukty();toast(!p.seoPromoted?"Produkt otrzymał wyższy priorytet promocji ⭐":"Usunięto dodatkowy priorytet — produkt nadal promuje się automatycznie");renderuj();}
function seoUzupelnijProdukt(id){const p=pobierzProduktAdmin(id);if(!p)return;const now=new Date().toISOString(),next=seoAutomatyzujDaneProduktu(p,"ręczna kontrola SEO",{force:p.seoMode!=="manual"}),patch={seoTitle:next.seoTitle,seoDescription:next.seoDescription,seoKeywords:next.seoKeywords,seoMode:next.seoMode,seoReviewedAt:next.seoReviewedAt,seoSource:next.seoSource,seoScore:next.seoScore};seoZapiszLokalnie(id,patch);seoHistoria=[{id:`seo-${Date.now()}-${id}`,at:now,type:"single",source:"ręczna kontrola SEO",count:1,products:[{id:p.id,name:p.nazwa,scoreBefore:seoOcenaProduktu(seoEfektywneDaneProduktu(p)).score}]},...(seoHistoria||[])].slice(0,500);zapiszLS("artway_seo_historia",seoHistoria);zaplanujZapisUstawien();zbudujProdukty();toast("Metadane SEO produktu uzupełnione ✅");renderuj();}
async function seoUdostepnijProdukt(id){const p=pobierzProduktAdmin(id);if(!p)return;const url=`${location.origin}/produkt/${encodeURIComponent(p.id)}`,data={title:p.seoTitle||p.nazwa,text:p.seoDescription||opisKrotkiProduktu(p),url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(`${data.title}\n${data.text}\n${url}`);toast("Skopiowano gotowy, bezpłatny materiał promocyjny 📋");}}catch(e){if(e?.name!=="AbortError")toast("Nie udało się udostępnić materiału");}}
function seoCSV(value){const s=String(value??"");return `"${s.replace(/"/g,'""')}"`;}
function seoEksportujFeedGoogleCSV(){const rows=[["id","title","description","link","image_link","availability","price","brand","gtin","mpn","condition"],...produkty.filter(p=>!produktOznaczonyNiedostepny(p)&&Number(p.cena)>0&&p.zdjecie).map(p=>[p.externalId||p.sku||p.id,p.seoTitle||p.nazwa,p.seoDescription||seoPropozycjaProduktu(p).seoDescription,`${location.origin}/produkt/${p.id}`,p.zdjecie||"","in_stock",`${Number(p.cena).toFixed(2)} PLN`,p.producent||p.marka||"",p.gtin||p.ean||"",p.mpn||p.kodProducenta||p.sku||"","new"])];pobierzPlik(`google-free-listings-${new Date().toISOString().slice(0,10)}.csv`,`\ufeff${rows.map(r=>r.map(seoCSV).join(",")).join("\n")}`,"text/csv");}
function seoFiltrujKolejke(items=seoKolejkaProduktow()){
  const query=normalizujSzukanyTekst(seoSzukaj),terms=query.split(" ").filter(Boolean),now=Date.now(),month=30*24*60*60*1000;
  const filtered=items.filter(x=>{
    const p=x.product,e=x.effective||seoEfektywneDaneProduktu(p),reviewed=p.seoReviewedAt?new Date(p.seoReviewedAt).getTime():0;
    const search=normalizujSzukanyTekst([p.id,p.externalId,p.sku,p.gtin,p.ean,p.mpn,p.kodProducenta,p.nazwa,p.kategoria,p.producent,p.marka,e.seoTitle,e.seoDescription,e.seoKeywords,x.issues.join(" ")].join(" "));
    if(terms.some(term=>!search.includes(term)))return false;
    if(seoFiltrOceny==="krytyczne"&&x.score>=60)return false;if(seoFiltrOceny==="poprawa"&&(x.score<60||x.score>=85))return false;if(seoFiltrOceny==="gotowe"&&x.score<85)return false;
    if(seoFiltrKontroli==="nigdy"&&reviewed)return false;if(seoFiltrKontroli==="dzisiaj"&&!String(p.seoReviewedAt||"").startsWith(new Date().toISOString().slice(0,10)))return false;if(seoFiltrKontroli==="stare"&&reviewed&&now-reviewed<=month)return false;
    if(seoFiltrPromocji==="promowane"&&!p.seoPromoted)return false;if(seoFiltrPromocji==="niepromowane"&&p.seoPromoted)return false;
    if(seoFiltrBrakow==="ean"&&(p.gtin||p.ean))return false;if(seoFiltrBrakow==="zdjecie"&&p.zdjecie)return false;if(seoFiltrBrakow==="opis"&&seoTekstBezHTML(p.opis||"").length>=250)return false;if(seoFiltrBrakow==="zrodlo"&&(p.sourceUrl||p.producentUrl))return false;
    if(seoFiltrKategorii!=="wszystkie"&&String(p.kategoria||"")!==seoFiltrKategorii)return false;if(seoFiltrProducenta!=="wszyscy"&&String(p.producent||p.marka||"")!==seoFiltrProducenta)return false;
    return true;
  });
  return filtered.sort((a,b)=>{const an=String(a.product.nazwa||""),bn=String(b.product.nazwa||"");if(seoSortowanie==="wynik-rosnaco")return a.score-b.score||an.localeCompare(bn,"pl");if(seoSortowanie==="wynik-malejaco")return b.score-a.score||an.localeCompare(bn,"pl");if(seoSortowanie==="nazwa")return an.localeCompare(bn,"pl");if(seoSortowanie==="kontrola")return String(a.product.seoReviewedAt||"").localeCompare(String(b.product.seoReviewedAt||""));return 0;});
}
function seoUstawFiltr(pole,value){
  const v=String(value||"");if(pole==="seoFiltrOceny")seoFiltrOceny=v;else if(pole==="seoFiltrKontroli")seoFiltrKontroli=v;else if(pole==="seoFiltrPromocji")seoFiltrPromocji=v;else if(pole==="seoFiltrBrakow")seoFiltrBrakow=v;else if(pole==="seoFiltrKategorii")seoFiltrKategorii=v;else if(pole==="seoFiltrProducenta")seoFiltrProducenta=v;else if(pole==="seoSortowanie")seoSortowanie=v;else return;seoStrona=1;seoOdswiezWorkspace();
}
function seoSzukajProdukty(input){seoSzukaj=String(input?.value||input||"");seoStrona=1;clearTimeout(seoSzukajTimer);seoSzukajTimer=setTimeout(()=>seoOdswiezWorkspace({focusSearch:true}),180);}
function seoResetujFiltry(){seoSzukaj="";seoFiltrOceny="wszystkie";seoFiltrKontroli="wszystkie";seoFiltrPromocji="wszystkie";seoFiltrBrakow="wszystkie";seoFiltrKategorii="wszystkie";seoFiltrProducenta="wszyscy";seoSortowanie="priorytet";seoStrona=1;seoOdswiezWorkspace({focusSearch:true});}
function seoOdswiezWorkspace(options={}){const current=document.querySelector("[data-seo-list-workspace]");if(!current)return renderuj();const tab=current.dataset.seoTab||"produkty",fragment=dokumentTymczasowyHTML(seoProduktyWorkspaceHTML(seoKolejkaProduktow(),tab)),next=fragment.querySelector("[data-seo-list-workspace]");if(!next)return;current.replaceWith(next);seoOdswiezStanZaznaczen();if(options.focusSearch){const input=next.querySelector("[data-seo-search]");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}}}
function seoUstawStrone(page){const total=Math.max(1,Math.ceil(seoFiltrujKolejke().length/seoNaStronie));seoStrona=Math.max(1,Math.min(total,Number(page)||1));seoOdswiezWorkspace();document.querySelector("[data-seo-list-workspace]")?.scrollIntoView({behavior:"smooth",block:"start"});}
function seoUstawNaStronie(value){const n=Number(value);seoNaStronie=[25,50,100,250,500].includes(n)?n:50;seoStrona=1;zapiszLS("artway_seo_na_stronie",seoNaStronie);seoOdswiezWorkspace();}
function seoPrzelaczZaznaczenie(id,checked){const key=String(id);if(checked)seoZaznaczoneProdukty.add(key);else seoZaznaczoneProdukty.delete(key);seoOdswiezStanZaznaczen();}
function seoUstawZaznaczenie(ids,checked=true){for(const id of Array.isArray(ids)?ids:[])if(checked)seoZaznaczoneProdukty.add(String(id));else seoZaznaczoneProdukty.delete(String(id));seoOdswiezStanZaznaczen();}
function seoZaznaczBiezacaStrone(checked=true){seoUstawZaznaczenie([...document.querySelectorAll("[data-seo-product-row]")].map(row=>row.dataset.seoProductId).filter(Boolean),checked);}
function seoZaznaczWszystkieWyniki(){seoUstawZaznaczenie(seoFiltrujKolejke().map(x=>x.product.id),true);}
function seoWyczyscZaznaczenie(){seoZaznaczoneProdukty.clear();seoOdswiezStanZaznaczen();}
function seoEksportujWynikiCSV(zakres="filtr"){
  const selected=new Set([...seoZaznaczoneProdukty].map(String));
  const rows=seoFiltrujKolejke().filter(x=>zakres!=="zaznaczone"||selected.has(String(x.product.id))).map(x=>{const p=x.product,e=x.effective||seoEfektywneDaneProduktu(p);return [p.id,p.externalId||"",p.sku||"",p.gtin||p.ean||"",p.nazwa,p.kategoria||"",p.producent||p.marka||"",x.score,(x.issues||[]).join(" | "),e.seoTitle||"",e.seoDescription||"",e.seoKeywords||"",p.seoReviewedAt||""];});
  adminEksportujCSV(zakres==="zaznaczone"?"seo-zaznaczone.csv":"seo-wyniki-filtra.csv",["id","external_id","sku","ean","nazwa","kategoria","producent","ocena","braki","tytul_seo","opis_seo","frazy","ostatnia_kontrola"],rows);
}
function seoOdswiezStanZaznaczen(){const selected=seoZaznaczoneProdukty.size;document.querySelectorAll("[data-seo-selected-count]").forEach(el=>el.textContent=String(selected));document.querySelectorAll("[data-seo-bulk-action]").forEach(el=>el.disabled=!selected);document.querySelectorAll("[data-seo-product-row]").forEach(row=>{const active=seoZaznaczoneProdukty.has(String(row.dataset.seoProductId));row.classList.toggle("is-selected",active);const box=row.querySelector("[data-seo-select]");if(box)box.checked=active;});}
function seoWykonajOperacjeZbiorcza(mode){
  const ids=[...seoZaznaczoneProdukty],now=new Date().toISOString();if(!ids.length)return toast("Najpierw zaznacz produkty");if(!["optimize","promote","unpromote","auto","manual","audit"].includes(mode))return toast("Wybierz operację zbiorczą");let changed=0,names=[];
  for(const id of ids){const p=pobierzProduktAdmin(id);if(!p)continue;let patch={};if(mode==="promote")patch={seoPromoted:true,seoPromotedAt:now};else if(mode==="unpromote")patch={seoPromoted:false,seoPromotedAt:""};else{const base=mode==="auto"?{...p,seoMode:"auto"}:mode==="manual"?{...seoEfektywneDaneProduktu(p),seoMode:"manual"}:p,next=seoAutomatyzujDaneProduktu(base,mode==="audit"?"zbiorczy audyt SEO":"zbiorcza optymalizacja SEO",{force:mode==="auto"||mode==="optimize"});patch={seoTitle:next.seoTitle,seoDescription:next.seoDescription,seoKeywords:next.seoKeywords,seoMode:next.seoMode,seoReviewedAt:next.seoReviewedAt,seoSource:next.seoSource,seoScore:next.seoScore};}seoZapiszLokalnie(id,patch);changed++;names.push(p.nazwa||id);}
  seoHistoria=[{id:`seo-bulk-${Date.now()}`,at:now,type:"bulk",source:`operacja zbiorcza: ${mode}`,count:changed,products:names.slice(0,100).map((name,i)=>({id:ids[i],name}))},...(seoHistoria||[])].slice(0,500);zapiszLS("artway_seo_historia",seoHistoria);zaplanujZapisUstawien();zbudujProdukty();seoZaznaczoneProdukty.clear();toast(`Zmieniono ${changed} produktów ✅`);seoOdswiezWorkspace();
}
function seoScoreBadge(score){return `<span class="seo-score ${score>=85?"good":score>=60?"medium":"bad"}">${score}/100</span>`;}
function seoProduktRows(items,limit=200,options={}){const selectable=options.selectable===true;return items.slice(0,limit).map(x=>{const p=x.product,e=x.effective||seoEfektywneDaneProduktu(p),selected=seoZaznaczoneProdukty.has(String(p.id));return `<tr data-seo-product-row data-seo-product-id="${esc(p.id)}" class="${selected?"is-selected":""}">${selectable?`<td><input class="seo-row-checkbox" data-seo-select type="checkbox" aria-label="Zaznacz ${esc(p.nazwa)}" ${selected?"checked":""} onchange="seoPrzelaczZaznaczenie(${jsArg(p.id)},this.checked)"></td>`:""}<td>${p.zdjecie?`<img class="seo-product-thumb" src="${esc(p.zdjecie)}" alt="">`:esc(p.ikona||"📦")}</td><td><b>${esc(p.nazwa)}</b><br><small>${esc(p.externalId||p.sku||`ID ${p.id}`)} • ${esc(p.kategoria||"bez kategorii")} • ${esc(p.producent||p.marka||"bez producenta")}</small></td>${selectable?`<td><span class="seo-coverage-status ${e.seoMode}">${e.seoMode==="manual"?"✍️ ręczne":"⚙️ automatyczne"}</span><small>${esc(x.coverage||"")}</small></td>`:""}<td>${seoScoreBadge(x.score)}</td><td>${x.issues.length?esc(x.issues.slice(0,4).join(", ")):`<span class="lvl lvl-ok">kompletne</span>`}</td><td>${p.seoReviewedAt?esc(allegroDataTxt(p.seoReviewedAt)):"automatycznie"}</td><td class="seo-row-actions"><button class="btn ghost" onclick="seoUzupelnijProdukt(${jsArg(p.id)})">✨ Uzupełnij SEO</button><button class="btn ghost" onclick="seoPrzelaczPromowanie(${jsArg(p.id)})">${p.seoPromoted?"★ Priorytet":"☆ Nadaj priorytet"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj</a></td></tr>`;}).join("")||`<tr><td colspan="${selectable?8:6}">Brak produktów pasujących do filtrów.</td></tr>`;}
function seoProduktyWorkspaceHTML(queue,tab="produkty"){
  const filtered=seoFiltrujKolejke(queue),pages=Math.max(1,Math.ceil(filtered.length/seoNaStronie));seoStrona=Math.max(1,Math.min(seoStrona,pages));const start=(seoStrona-1)*seoNaStronie,current=filtered.slice(start,start+seoNaStronie),categories=[...new Set(queue.map(x=>String(x.product.kategoria||"")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl")),producers=[...new Set(queue.map(x=>String(x.product.producent||x.product.marka||"")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
  const option=(value,label,currentValue)=>`<option value="${esc(value)}" ${value===currentValue?"selected":""}>${esc(label)}</option>`;
  return `<section class="panel seo-product-workspace" data-seo-list-workspace data-seo-tab="${esc(tab)}"><div class="order-section-head"><div><span class="order-pro-label">Automatyczne pokrycie całego katalogu</span><h2>${tab==="produkty"?"🏷️ Produkty SEO":"✍️ Frazy i treści"}</h2><p class="order-detail-lead">Każdy aktywny produkt działa automatycznie w sklepie, Google, Open Graph, danych Product/Offer, mapie strony i feedzie. Limit dzienny służy wyłącznie kolejnym audytom jakości.</p></div><span class="lvl lvl-ok">${queue.length}/${queue.length} objętych automatem</span></div>
    ${adminWyszukiwaniePanelHTML({id:"seo-products",description:"Nazwa, identyfikatory, kategoria, producent, jakość treści, priorytet i data kontroli.",results:filtered.length,active:!!(seoSzukaj||seoFiltrOceny!=="wszystkie"||seoFiltrKontroli!=="wszystkie"||seoFiltrPromocji!=="wszystkie"||seoFiltrBrakow!=="wszystkie"||seoFiltrKategorii!=="wszystkie"||seoFiltrProducenta!=="wszyscy"),open:true,fields:`<div class="seo-advanced-toolbar admin-search-full"><label class="seo-search-wide">Produkt lub fraza<input class="seo-table-search" data-seo-search value="${esc(seoSzukaj)}" placeholder="Nazwa, EXTERNAL_ID, SKU, EAN, kod producenta, kategoria, producent, fraza…" oninput="seoSzukajProdukty(this)"></label><label>Ocena<select onchange="seoUstawFiltr('seoFiltrOceny',this.value)">${option("wszystkie","Wszystkie wyniki",seoFiltrOceny)}${option("krytyczne","Krytyczne: poniżej 60",seoFiltrOceny)}${option("poprawa","Do poprawy: 60–84",seoFiltrOceny)}${option("gotowe","Gotowe: 85–100",seoFiltrOceny)}</select></label><label>Kontrola<select onchange="seoUstawFiltr('seoFiltrKontroli',this.value)">${option("wszystkie","Każda kontrola",seoFiltrKontroli)}${option("nigdy","Nigdy niekontrolowane",seoFiltrKontroli)}${option("dzisiaj","Sprawdzone dzisiaj",seoFiltrKontroli)}${option("stare","Starsze niż 30 dni",seoFiltrKontroli)}</select></label><label>Priorytet promocji<select onchange="seoUstawFiltr('seoFiltrPromocji',this.value)">${option("wszystkie","Wszystkie — automatyczne",seoFiltrPromocji)}${option("promowane","Z dodatkowym priorytetem",seoFiltrPromocji)}${option("niepromowane","Standardowy priorytet",seoFiltrPromocji)}</select></label><label>Brak danych<select onchange="seoUstawFiltr('seoFiltrBrakow',this.value)">${option("wszystkie","Dowolny stan",seoFiltrBrakow)}${option("ean","Bez EAN/GTIN",seoFiltrBrakow)}${option("zdjecie","Bez zdjęcia",seoFiltrBrakow)}${option("opis","Bez pełnego opisu",seoFiltrBrakow)}${option("zrodlo","Bez linku źródłowego",seoFiltrBrakow)}</select></label><label>Kategoria<select onchange="seoUstawFiltr('seoFiltrKategorii',this.value)">${option("wszystkie","Wszystkie kategorie",seoFiltrKategorii)}${categories.map(v=>option(v,v,seoFiltrKategorii)).join("")}</select></label><label>Producent<select onchange="seoUstawFiltr('seoFiltrProducenta',this.value)">${option("wszyscy","Wszyscy producenci",seoFiltrProducenta)}${producers.map(v=>option(v,v,seoFiltrProducenta)).join("")}</select></label><label>Sortowanie<select onchange="seoUstawFiltr('seoSortowanie',this.value)">${option("priorytet","Priorytet automatu",seoSortowanie)}${option("wynik-rosnaco","Ocena: od najniższej",seoSortowanie)}${option("wynik-malejaco","Ocena: od najwyższej",seoSortowanie)}${option("nazwa","Nazwa A–Z",seoSortowanie)}${option("kontrola","Najdawniej kontrolowane",seoSortowanie)}</select></label><button class="btn ghost seo-reset-filters" type="button" onclick="seoResetujFiltry()">Wyczyść filtry</button></div>`,actions:adminOperacjeWynikowHTML({id:"seo-products",selected:seoZaznaczoneProdukty.size,pageCount:current.length,resultCount:filtered.length,selectPage:"seoZaznaczBiezacaStrone(true)",selectAll:"seoZaznaczWszystkieWyniki()",clear:"seoWyczyscZaznaczenie()",exportSelected:"seoEksportujWynikiCSV('zaznaczone')",exportAll:"seoEksportujWynikiCSV('filtr')"})})}
    <div class="seo-results-summary"><b>Znaleziono ${filtered.length}</b><span>Pokazano ${filtered.length?start+1:0}–${Math.min(start+seoNaStronie,filtered.length)}</span><label>Na stronie <select onchange="seoUstawNaStronie(this.value)">${[25,50,100,250,500].map(v=>option(String(v),String(v),String(seoNaStronie))).join("")}</select></label></div>
    <div class="seo-bulk-toolbar"><span>Wybrano: <b data-seo-selected-count>${seoZaznaczoneProdukty.size}</b></span><select data-seo-bulk-operation><option value="">Operacja dla zaznaczonych…</option><option value="optimize">Uzupełnij i zoptymalizuj SEO</option><option value="audit">Oznacz jako sprawdzone</option><option value="promote">Nadaj dodatkowy priorytet</option><option value="unpromote">Usuń priorytet — promocja pozostaje</option><option value="auto">Włącz tryb automatyczny</option><option value="manual">Chroń jako ręczne treści</option></select><button class="btn" data-seo-bulk-action ${seoZaznaczoneProdukty.size?"":"disabled"} onclick="seoWykonajOperacjeZbiorcza(this.previousElementSibling.value)">Wykonaj</button></div>
    <div class="seo-table-wrap"><table class="log-table seo-product-table"><thead><tr><th></th><th></th><th>Produkt</th><th>Pokrycie</th><th>Wynik</th><th>Braki</th><th>Ostatnia kontrola</th><th>Akcje</th></tr></thead><tbody>${seoProduktRows(current,seoNaStronie,{selectable:true})}</tbody></table></div><div class="pagination">${paginacjaHTML(seoStrona,pages,"seoUstawStrone")}</div></section>`;
}
function seoAktualizujMetaDlaTrasy(route=trasa()){
  const ensure=(selector,create)=>{let el=document.head.querySelector(selector);if(!el){el=document.createElement(create.tag||"meta");for(const [k,v] of Object.entries(create.attrs||{}))el.setAttribute(k,v);document.head.appendChild(el);}return el;},setMeta=(name,value,property=false)=>{const attr=property?"property":"name",el=ensure(`meta[${attr}="${name}"]`,{tag:"meta",attrs:{[attr]:name}});el.setAttribute("content",String(value||""));};
  const baseTitle=ustawienia.nazwaSklepu||"Artway-TM",baseDesc=ustawienia.seo?.opis||ustawienia.opisSklepu||"Gry, zabawki kreatywne, balony i artykuły imprezowe od sprawdzonych producentów.";let title=ustawienia.seo?.tytul||`Gry, zabawki i artykuły imprezowe | ${baseTitle}`,desc=baseDesc,canonical=location.origin+"/",image="",price="",schema={"@context":"https://schema.org","@graph":[{"@type":"WebSite",name:baseTitle,url:canonical,inLanguage:"pl-PL"},{"@type":"OnlineStore",name:baseTitle,url:canonical,email:ustawienia.email||"artwaytm@gmail.com",telephone:ustawienia.telefon||"+48530038914"}]};
  if(route.startsWith("/produkt/")){const p=produktSklepuPoId(route.split("/")[2]);if(p){const effective=seoEfektywneDaneProduktu(p);title=effective.seoTitle||`${p.nazwa} | ${baseTitle}`;desc=effective.seoDescription;canonical=`${location.origin}/produkt/${p.id}`;image=p.zdjecie||p.zdjecia?.[0]||"";price=Number(p.cena||0)>0?Number(p.cena).toFixed(2):"";const gtin=String(p.gtin||p.ean||"").replace(/\D/g,"");schema={"@context":"https://schema.org","@graph":[{"@type":"Product",name:p.nazwa,description:seoTekstBezHTML(p.opis||desc),image:[p.zdjecie,...(p.zdjecia||[])].filter(Boolean),sku:p.sku||p.externalId||String(p.id),...(gtin?{[`gtin${gtin.length}`]:gtin}:{}),brand:(p.producent||p.marka)?{"@type":"Brand",name:p.producent||p.marka}:undefined,offers:{"@type":"Offer",url:canonical,priceCurrency:"PLN",price,availability:produktOznaczonyNiedostepny(p)?"https://schema.org/OutOfStock":"https://schema.org/InStock",itemCondition:"https://schema.org/NewCondition"}},{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Strona główna",item:location.origin+"/"},{"@type":"ListItem",position:2,name:p.nazwa,item:canonical}]}]};}}
  else if(route.startsWith("/kategoria/")){const raw=decodeURIComponent(route.split("/")[2]||""),category=wszystkieKategorie().find(k=>k===raw||seoSlugKategorii(k)===seoSlugKategorii(raw))||raw,list=produkty.filter(p=>p.kategoria===category);title=`${category} | ${baseTitle}`;desc=`Produkty z kategorii ${category}. Sprawdź aktualną ofertę, ceny i wygodną dostawę InPost.`;canonical=`${location.origin}/kategoria/${seoSlugKategorii(category)}`;image=list.find(p=>p.zdjecie)?.zdjecie||"";schema={"@context":"https://schema.org","@type":"CollectionPage",name:category,description:desc,url:canonical};}
  else if(route==="/promocje"||route==="/nowosci"){const name=route==="/promocje"?"Promocje":"Nowości";title=`${name} | ${baseTitle}`;desc=route==="/promocje"?"Aktualne promocje na gry, zabawki kreatywne, balony i artykuły imprezowe.":"Nowe gry, zabawki kreatywne, balony i artykuły imprezowe w Artway-TM.";canonical=`${location.origin}${route}`;schema={"@context":"https://schema.org","@type":"CollectionPage",name,description:desc,url:canonical};}
  document.title=title;setMeta("description",desc);setMeta("robots",route.startsWith("/admin")||["/diagnostyka","/logowanie","/rejestracja","/konto","/zamowienia"].includes(route)?"noindex,nofollow":"index,follow,max-image-preview:large");setMeta("og:locale","pl_PL",true);setMeta("og:site_name",baseTitle,true);setMeta("og:title",title,true);setMeta("og:description",desc,true);setMeta("og:url",canonical,true);setMeta("og:type",route.startsWith("/produkt/")?"product":"website",true);setMeta("og:image",image,true);setMeta("twitter:card",image?"summary_large_image":"summary");setMeta("twitter:title",title);setMeta("twitter:description",desc);setMeta("twitter:image",image);setMeta("product:price:amount",price,true);setMeta("product:price:currency",price?"PLN":"",true);
  let link=document.head.querySelector('link[rel="canonical"]');if(!link){link=document.createElement("link");link.rel="canonical";document.head.appendChild(link);}link.href=canonical;let script=document.getElementById("artway-seo-schema");if(!script){script=document.createElement("script");script.id="artway-seo-schema";script.type="application/ld+json";document.head.appendChild(script);}script.textContent=JSON.stringify(schema);
}
function widokAdminSEO(sekcja="pulpit"){
  const tab=TABY_SEO.some(([id])=>id===sekcja)?sekcja:"pulpit",queue=seoKolejkaProduktow(),limit=Math.max(1,Math.min(50,Number(seoUstawienia.dailyLimit)||5)),daily=queue.filter(x=>!String(x.product.seoReviewedAt||"").startsWith(new Date().toISOString().slice(0,10))).slice(0,limit),good=queue.filter(x=>x.score>=85).length,missing=queue.filter(x=>x.score<60).length,priority=queue.filter(x=>x.product.seoPromoted),avg=queue.length?Math.round(queue.reduce((s,x)=>s+x.score,0)/queue.length):0,indexNowOk=seoUstawienia.lastPromotionStatus==="accepted",indexNowState=indexNowOk?`Ostatnio zgłoszono ${Number(seoUstawienia.lastPromotionCount)||0} adresów — ${allegroDataTxt(seoUstawienia.lastPromotionAt)}`:seoUstawienia.lastPromotionStatus==="error"?"Ostatnie zgłoszenie nie powiodło się — automat ponowi próbę przy kolejnej partii":"Pierwsze zgłoszenie nastąpi przy najbliższej dziennej partii";
  if(typeof seoPobierzEfekty==="function")queueMicrotask(()=>seoPobierzEfekty(typeof seoEfektyStan==="object"?seoEfektyStan.days:30));
  const head=`<div class="panel seo-hero seo-control-hero"><div><span class="order-pro-label">Centrum bezpłatnego wzrostu</span><h1>📣 Pozycjonowanie i promocja produktów</h1><p>Techniczne SEO, uporządkowane treści, czyste adresy, dane Product/Offer, bezpłatny feed oraz rzeczywisty pomiar wejść i sprzedaży.</p><div class="seo-status-ribbon"><span class="ok">● Automat aktywny</span><span class="ok">● HTML produktów dla Google</span><span class="${indexNowOk?"ok":"wait"}">● IndexNow ${indexNowOk?"przyjęty":"oczekuje"}</span><span>● ${queue.length} produktów w mapie/feedzie</span></div></div><div class="seo-hero-score"><b>${avg}%</b><small>średnia gotowość katalogu</small></div></div>`;
  if(tab==="efekty")return seoSzkielet(tab,`${head}${seoEfektyPanelHTML()}`);
  if(tab==="pulpit")return seoSzkielet(tab,`${head}<div class="orders-stat-grid seo-stat-grid"><div class="order-stat-card money"><span>✅</span><b>${good}</b><small>produktów gotowych</small></div><div class="order-stat-card ${missing?"hot":""}"><span>⚠️</span><b>${missing}</b><small>wymaga uzupełnienia</small></div><div class="order-stat-card"><span>🗓️</span><b>${daily.length}</b><small>w najbliższej partii</small></div><div class="order-stat-card money"><span>📣</span><b>${queue.length}</b><small>aktywnych w darmowej promocji</small></div></div><div class="panel"><div class="order-section-head"><div><h2>Plan na dziś: ${limit} produktów</h2><p class="order-detail-lead">Wszystkie aktywne produkty są promowane automatycznie. W kolejce kontroli najpierw są produkty z dodatkowym priorytetem i bestsellery, potem karty z największymi brakami.</p></div><button class="btn" onclick="seoUruchomPlanDzienny(this)" ${seoUstawienia.enabled?"":"disabled"}>▶️ Wykonaj dzisiejszą partię</button></div><div class="seo-progress"><span style="width:${avg}%"></span></div><div style="overflow:auto"><table class="log-table"><tr><th></th><th>Produkt</th><th>Wynik</th><th>Braki</th><th>Kontrola</th><th>Akcje</th></tr>${seoProduktRows(daily,limit)}</table></div></div>`);
  if(tab==="plan")return seoSzkielet(tab,`${head}<div class="panel"><div class="order-section-head"><div><h2>🗓️ Kolejka dzienna</h2><p class="order-detail-lead">Domyślnie 5 pozycji dziennie. Przy obecnym katalogu daje to pełny, spokojny cykl mniej więcej raz na tydzień. Nie zmieniamy treści tylko po to, by wyglądały na świeże.</p></div><button class="btn" onclick="seoUruchomPlanDzienny(this)">Uruchom ${limit} teraz</button></div><div style="overflow:auto"><table class="log-table"><tr><th></th><th>Produkt</th><th>Wynik</th><th>Braki</th><th>Ostatnio</th><th>Akcje</th></tr>${seoProduktRows(daily,limit)}</table></div></div>`);
  if(tab==="produkty"||tab==="tresci")return seoSzkielet(tab,`${head}${seoProduktyWorkspaceHTML(queue,tab)}`);
  if(tab==="promocja")return seoSzkielet(tab,`${head}<div class="panel"><div class="order-section-head"><div><h2>📣 Darmowa promocja całego katalogu</h2><p class="order-detail-lead"><b>${queue.length} aktywnych produktów</b> jest objętych automatem bez ręcznego zaznaczania. Kanały są wyłącznie bezpłatne — bez kampanii i budżetu reklamowego.</p></div><div class="diag-actions"><a class="btn" href="/google-products.xml" target="_blank">🔄 Automatyczny feed XML</a><button class="btn ghost" onclick="seoEksportujFeedGoogleCSV()">⬇️ Kopia CSV</button></div></div><div class="seo-free-channels"><article><b>🛍️ Bezpłatne informacje Google — automatycznie</b><p>Google cyklicznie pobiera wszystkie kwalifikujące się aktywne produkty z <code>${esc(location.origin)}/google-products.xml</code>. Ukryte lub niedostępne pozycje są automatycznie wycofywane z feedu.</p><div class="diag-actions"><a class="btn ghost" href="/google-products.xml" target="_blank">Sprawdź feed</a><a class="btn ghost" href="https://merchants.google.com/" target="_blank" rel="noopener">Merchant Center ↗</a></div></article><article><b>🔎 Google Search Console — automatycznie</b><p>Mapa <code>${esc(location.origin)}/sitemap.xml</code> obejmuje wszystkie aktywne karty. Nowe produkty trafiają do niej bez ręcznego zgłaszania.</p><div class="diag-actions"><a class="btn ghost" href="/sitemap.xml" target="_blank">Sprawdź mapę</a><a class="btn ghost" href="https://search.google.com/search-console" target="_blank" rel="noopener">Search Console ↗</a></div></article><article><b>${indexNowOk?"✅":"⚡"} IndexNow — automatycznie</b><p>Cały aktywny katalog jest zgłaszany przy pierwszym uruchomieniu, a potem automat przekazuje poprawione i nowe karty do Bing oraz innych uczestniczących wyszukiwarek. ${esc(indexNowState)}.</p><small>Zgłoszenie przyspiesza wykrycie zmiany, ale nie gwarantuje pozycji ani indeksacji.</small></article><article><b>🔗 allsklep.pl — drugi adres podpięty</b><p>Krótki adres marketingowy działa i przekierowuje kodem 301 na właściwą podstronę <code>artwaytm.pl</code>. Jedna domena kanoniczna chroni pozycjonowanie przed duplikacją treści.</p><a class="btn ghost" href="https://allsklep.pl/" target="_blank" rel="noopener">Sprawdź drugi adres ↗</a></article></div><div class="backend-note"><b>Automatyczne pokrycie:</b> wszystkie aktywne produkty trafiają do mapy strony, bezpłatnego feedu Google i systemu zgłoszeń wyszukiwarkom. Gwiazdka priorytetu zmienia wyłącznie kolejność audytu — nigdy nie wyłącza produktu z darmowej promocji.</div><h3>Produkty z dodatkowym priorytetem (${priority.length})</h3><div class="seo-promotion-grid">${priority.map(x=>`<article>${x.product.zdjecie?`<img src="${esc(x.product.zdjecie)}" alt="">`:"📦"}<div><b>${esc(x.product.nazwa)}</b><small>${esc(x.product.seoDescription||x.proposed.seoDescription)}</small><div class="diag-actions"><button class="btn" onclick="seoUdostepnijProdukt(${jsArg(x.product.id)})">Udostępnij bezpłatnie</button><button class="btn ghost" onclick="seoPrzelaczPromowanie(${jsArg(x.product.id)})">Zdejmij dodatkowy priorytet</button></div></div></article>`).join("")||`<div class="backend-note">Brak dodatkowych priorytetów. Wszystkie aktywne produkty nadal promują się automatycznie.</div>`}</div></div>`);
  if(tab==="techniczne")return seoSzkielet(tab,`${head}<div class="panel"><h2>🛠️ Techniczne SEO</h2><div class="seo-technical-grid"><article><span>✅</span><b>Mapa produktów XML</b><small>Automatyczna, tylko aktywne produkty, prawdziwe daty ostatniej kontroli.</small><a class="btn ghost" href="/sitemap.xml" target="_blank">Otwórz sitemap.xml</a></article><article><span>✅</span><b>Feed Google Merchant XML</b><small>Aktualne ceny, opisy, zdjęcia, dostępność, marka, GTIN/MPN i linki produktów. Gotowy do cyklicznego pobierania.</small><a class="btn ghost" href="/google-products.xml" target="_blank">Otwórz feed produktowy</a></article><article><span>✅</span><b>Dane Product/Offer</b><small>Nazwa, opis, zdjęcia, SKU, GTIN, marka, cena i dostępność na karcie produktu.</small><a class="btn ghost" href="https://search.google.com/test/rich-results" target="_blank" rel="noopener">Test wyników z elementami rozszerzonymi ↗</a></article><article><span>✅</span><b>Canonical i Open Graph</b><small>Każdy produkt ma własny czysty adres /produkt/ID oraz właściwe metadane.</small></article><article><span>✅</span><b>robots.txt</b><small>Sklep jest dostępny dla robotów, panel administracyjny ma noindex.</small><a class="btn ghost" href="/robots.txt" target="_blank">Otwórz robots.txt</a></article></div></div>`);
  if(tab==="historia")return seoSzkielet(tab,`${head}<div class="panel"><h2>🧾 Historia pracy</h2><table class="log-table"><tr><th>Data</th><th>Źródło</th><th>Produkty</th><th>Szczegóły</th></tr>${(seoHistoria||[]).map(h=>`<tr><td>${esc(allegroDataTxt(h.at))}</td><td>${esc(h.source||h.type||"automat")}</td><td><b>${esc(h.count||0)}</b></td><td>${esc((h.products||[]).slice(0,8).map(x=>x.name||x.id).join(", "))}</td></tr>`).join("")||`<tr><td colspan="4">Plan nie był jeszcze uruchamiany.</td></tr>`}</table></div>`);
  return seoSzkielet("ustawienia",`${head}<div class="panel"><form onsubmit="zapiszSeoUstawienia(event)"><div class="order-section-head"><div><h2>⚙️ Ustawienia automatu i audytów</h2><p class="order-detail-lead">Każdy produkt jest objęty pozycjonowaniem od razu. Limit 1–50 określa jedynie liczbę kart poddawanych dziennie ponownej kontroli jakości.</p></div><button class="btn" type="submit">💾 Zapisz</button></div><div class="seo-settings-grid"><label class="check"><input type="checkbox" checked disabled> Każdy aktywny produkt automatycznie wszędzie — zawsze aktywne</label><label class="check"><input type="checkbox" name="enabled" ${seoUstawienia.enabled?"checked":""}> Automatyczne audyty aktywne</label><label class="check"><input type="checkbox" name="autoFillMissing" ${seoUstawienia.autoFillMissing!==false?"checked":""}> Uzupełniaj bezpieczne metadane</label><label class="check"><input type="checkbox" name="preferBestsellers" ${seoUstawienia.preferBestsellers!==false?"checked":""}> Najpierw produkty z dodatkowym priorytetem i bestsellery</label><label class="check"><input type="checkbox" name="indexNowEnabled" ${seoUstawienia.indexNowEnabled!==false?"checked":""}> Zgłaszaj poprawione produkty bezpłatnie przez IndexNow</label><label>Dzienny limit ponownych audytów<input name="dailyLimit" type="number" min="1" max="50" value="${esc(limit)}"><span class="seo-limit-presets"><button type="button" onclick="seoUstawLimit(5)">5</button><button type="button" onclick="seoUstawLimit(10)">10</button><button type="button" onclick="seoUstawLimit(20)">20</button></span></label></div><h3>Stan bezpłatnych kanałów</h3><div class="seo-settings-grid"><label class="check"><input type="checkbox" name="searchConsoleReady" ${seoUstawienia.searchConsoleReady?"checked":""}> Search Console skonfigurowane</label><label class="check"><input type="checkbox" name="merchantCenterReady" ${seoUstawienia.merchantCenterReady?"checked":""}> Merchant Center / bezpłatne informacje skonfigurowane</label><label class="check"><input type="checkbox" checked disabled> allsklep.pl podpięty jako adres marketingowy 301</label></div><div class="backend-note"><b>Wyłącznie darmowe rozwiązania.</b> Wszystkie aktywne produkty automatycznie otrzymują tytuł, opis i frazy oraz trafiają do mapy strony, feedu Google, danych Product/Offer i zgłoszeń IndexNow. Drugi adres prowadzi do tej samej domeny kanonicznej, więc nie tworzy duplikatów SEO. Moduł nie uruchamia reklam i nie wymaga płatnego API. Ostatni audyt: ${seoUstawienia.lastRunAt?esc(allegroDataTxt(seoUstawienia.lastRunAt)):"jeszcze nie było"}.</div></form></div>`);
}
function zapiszCzescUstawien(obj){
  ustawienia = {...ustawienia, ...obj};
  zapiszLS("artway_ustawienia", ustawienia);
  zastosujUstawienia(); zbudujProdukty(); odswiezMenu(); odswiezKoszyk();
  loguj("info","Zapisano ustawienia sklepu");
  toast("Zapisane ✅"); renderuj();
}

/* Anonimowy pomiar efektów SEO. Zapisuje wyłącznie dzienne sumy kanałów, domen wejścia i konwersji. */
let seoEfektyStan={loading:false,loadedAt:0,error:"",days:30,totals:{landing:0,product_view:0,add_to_cart:0,order:0,revenue:0},channels:{},domains:{},landingPages:[],campaigns:[],referrers:[],timeline:[],products:[],updatedAt:null};
const SEO_DOMENY=new Set(["artwaytm.pl","allsklep.pl"]);
function seoNormalizujDomene(value=""){const host=String(value||"").toLowerCase().replace(/^www\./,"").split(":")[0];return SEO_DOMENY.has(host)?host:"";}
function seoBezpiecznaSciezka(value="/"){const path=String(value||"/").split(/[?#]/)[0].replace(/[\u0000-\u001f\u007f]/g,"").slice(0,180);return path.startsWith("/")?path:"/";}
function seoUsunZnacznikDomeny(){try{const url=new URL(location.href);if(!url.searchParams.has("entry_domain"))return;url.searchParams.delete("entry_domain");history.replaceState(history.state,"",`${url.pathname}${url.search}${url.hash}`);}catch(e){}}
function seoKanalZHosta(host=""){
  const value=String(host||"").toLowerCase();
  if(/(^|\.)google\./.test(value))return "google";
  if(/(^|\.)bing\.com$/.test(value))return "bing";
  if(/(^|\.)duckduckgo\.com$/.test(value))return "duckduckgo";
  if(/(^|\.)yahoo\./.test(value))return "yahoo";
  if(/(^|\.)ecosia\.org$/.test(value))return "ecosia";
  if(/(^|\.)(?:search\.brave\.com|qwant\.com|startpage\.com|yandex\.[a-z.]+|seznam\.cz)$/.test(value))return "other_search";
  return "";
}
function seoAtrybucjaSesji(route="/"){
  try{
    const stored=JSON.parse(sessionStorage.getItem("artway_seo_attribution_v2")||"null");if(stored?.entryDomain&&stored?.channel)return stored;
    const url=new URL(location.href),own=seoNormalizujDomene(location.hostname)||"artwaytm.pl",via=seoNormalizujDomene(url.searchParams.get("entry_domain")),referrer=document.referrer?new URL(document.referrer):null,referrerHost=String(referrer?.hostname||"").toLowerCase().replace(/^www\./,""),searchChannel=seoKanalZHosta(referrerHost),campaignName=String(url.searchParams.get("utm_campaign")||url.searchParams.get("utm_source")||"").toLowerCase().replace(/[^a-z0-9_.-]/g,"").slice(0,80);
    const externalReferrer=referrerHost&&!SEO_DOMENY.has(referrerHost)?referrerHost.replace(/[^a-z0-9.-]/g,"").slice(0,120):"";
    const attribution={entryDomain:via||own,landingPath:seoBezpiecznaSciezka(route||location.pathname),channel:searchChannel||(campaignName?"campaign":externalReferrer?"referral":"direct"),campaign:campaignName,referrerDomain:externalReferrer};
    sessionStorage.setItem("artway_seo_attribution_v2",JSON.stringify(attribution));seoUsunZnacznikDomeny();return attribution;
  }catch(e){return {entryDomain:"artwaytm.pl",landingPath:seoBezpiecznaSciezka(route),channel:"direct",campaign:"",referrerDomain:""};}
}
function seoWyslijZdarzenie(event,data={}){
  const attribution=seoAtrybucjaSesji(data.route||trasa());if(!attribution.channel||jestAdmin())return;
  const body={event,channel:attribution.channel,entryDomain:attribution.entryDomain,landingPath:attribution.landingPath,campaign:attribution.campaign,referrerDomain:attribution.referrerDomain,productId:data.productId||"",value:Math.max(0,Number(data.value)||0)};
  fetch("/api/seo/event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),keepalive:true,credentials:"omit"}).catch(()=>{});
}
function seoSledzTrase(route="/"){
  if(String(route).startsWith("/admin"))return;seoAtrybucjaSesji(route);
  try{
    if(!sessionStorage.getItem("artway_seo_landing")){sessionStorage.setItem("artway_seo_landing","1");seoWyslijZdarzenie("landing",{route});}
    if(String(route).startsWith("/produkt/")){
      const id=String(route).split("/")[2]||"",key=`artway_seo_view_${id}`;
      if(id&&!sessionStorage.getItem(key)){sessionStorage.setItem(key,"1");seoWyslijZdarzenie("product_view",{productId:id});}
    }
  }catch(e){}
}
function seoSledzKoszyk(productId){seoWyslijZdarzenie("add_to_cart",{productId});}
function seoSledzZamowienie(value){
  try{if(sessionStorage.getItem("artway_seo_order_sent"))return;sessionStorage.setItem("artway_seo_order_sent","1");}catch(e){}
  seoWyslijZdarzenie("order",{value});
}
async function seoPobierzEfekty(days=30,force=false){
  if(seoEfektyStan.loading||(!force&&Date.now()-seoEfektyStan.loadedAt<60_000))return;
  seoEfektyStan={...seoEfektyStan,loading:true,error:"",days};
  try{
    const response=await fetch(`/api/seo/performance?days=${Math.max(7,Math.min(365,Number(days)||30))}`,{cache:"no-store",headers:chmuraNaglowki(false),credentials:"same-origin"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();seoEfektyStan={...seoEfektyStan,...data,loading:false,loadedAt:Date.now(),error:""};
  }catch(error){seoEfektyStan={...seoEfektyStan,loading:false,loadedAt:Date.now(),error:String(error?.message||error)};}
  if(trasa().startsWith("/admin/seo"))renderuj();
}

/* ═══════════ KOSZYK ═══════════ */
function ileWKoszyku(id){ return koszyk.filter(x=>x.id===id).reduce((s,x)=>s+x.ile,0); }
function kontrolowanyStanDlaZakupu(id){
  if(!Object.prototype.hasOwnProperty.call(stanyProduktow||{},id)||stanyProduktow[id]===null||stanyProduktow[id]==="")return null;
  const n=Number(stanyProduktow[id]);return Number.isFinite(n)?Math.max(0,Math.floor(n)):null;
}
function wymagaPotwierdzeniaIlosci(id,ilosc){
  const qty=Math.max(0,Number(ilosc)||0),stan=kontrolowanyStanDlaZakupu(id);
  return qty>LIMIT_POTWIERDZENIA_DOSTEPNOSCI&&(stan===null||qty>stan);
}
function pozycjeDoPotwierdzeniaDostepnosci(){
  const mapa=new Map();
  for(const x of koszyk){
    const key=String(x.id);
    const rec=mapa.get(key)||{id:x.id,ilosc:0,warianty:[]};
    rec.ilosc+=Number(x.ile)||0;
    if(x.wariant)rec.warianty.push(`${x.wariant} × ${x.ile}`);
    mapa.set(key,rec);
  }
  return [...mapa.values()].filter(x=>wymagaPotwierdzeniaIlosci(x.id,x.ilosc)).map(x=>{
    const p=produkty.find(p=>String(p.id)===String(x.id));
    return {...x,nazwa:p?.nazwa||"Produkt",sku:p?.sku||"",stanMagazynowy:kontrolowanyStanDlaZakupu(x.id)};
  });
}
function potwierdzProgDostepnosci(id, nastepnaIlosc){
  if(!wymagaPotwierdzeniaIlosci(id,nastepnaIlosc)) return true;
  const obecnie=ileWKoszyku(id);
  if(wymagaPotwierdzeniaIlosci(id,obecnie)) return true;
  const stan=kontrolowanyStanDlaZakupu(id),opis=stan===null?`więcej niż ${LIMIT_POTWIERDZENIA_DOSTEPNOSCI} sztuk`:`${nastepnaIlosc} szt., przy aktualnym stanie ${stan} szt.`;
  return confirm(`Wybrano ${opis}. Sklep potwierdzi brakującą ilość przed realizacją. Kontynuować?`);
}
function alertDostepnosciKoszykaHTML(){
  const lista=pozycjeDoPotwierdzeniaDostepnosci();
  if(!lista.length)return "";
  return `<div class="backend-note" style="margin-top:.7rem;border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Potwierdzenie dostępności:</b> dla ${lista.map(x=>`${esc(x.nazwa)} × ${x.ilosc}`).join(", ")} obsługa sklepu potwierdzi aktualną dostępność przed wysyłką.</div>`;
}
function normalizujIloscZakupu(value){return Math.max(1,Math.min(99,Math.floor(Number(value)||1)));}
function ustawIloscKarty(input,delta=0){if(!input)return 1;const value=normalizujIloscZakupu(Number(input.value||1)+Number(delta||0));input.value=value;return value;}
function dodajZKarty(id,btn){const box=btn?.closest?.(".card-purchase"),input=box?.querySelector?.("[data-card-quantity]");return dodajWIlosci(id,normalizujIloscZakupu(input?.value||1),btn,null);}
function dodajWIlosci(id,ilosc=1,btn=null,wariant=null){
  const ile=normalizujIloscZakupu(ilosc);
  wariant = wariant || null;
  const p = produkty.find(x=>x.id===id);
  if(p&&!produktMaCeneSprzedazy(p)){ toast("⚠️ Ten produkt wymaga uzupełnienia ceny przez administratora"); return; }
  if(p&&produktOznaczonyNiedostepny(p)){ toast("⚠️ Produkt jest chwilowo niedostępny"); return; }
  if(p?.warianty?.length && !wariant){ location.hash="#/produkt/"+id; toast("Wybierz wariant produktu"); return; }
  if(!potwierdzProgDostepnosci(id, ileWKoszyku(id)+ile)) return;
  const poz = koszyk.find(x=>x.id===id && (x.wariant||null)===wariant);
  poz ? poz.ile+=ile : koszyk.push({id, ile, ...(wariant?{wariant}:{})});
  zapiszLS("artway_koszyk", koszyk); odswiezKoszyk();
  if(btn){const label=btn.dataset.originalLabel||btn.textContent;btn.dataset.originalLabel=label;btn.textContent=`✓ Dodano ${ile} szt.`;btn.classList.add("added");
    setTimeout(()=>{if(btn.isConnected){btn.textContent=label;btn.classList.remove("added");}},1100); }
  toast(`Dodano ${ile} ${ile===1?"sztukę":"szt."} do koszyka 🛒${wariant?" ("+wariant+")":""}`);
  if(typeof seoSledzKoszyk==="function")seoSledzKoszyk(id);
  return true;
}
function dodaj(id,btn,wariant){return dodajWIlosci(id,1,btn,wariant);}
function zmienIloscIdx(i, d){
  const poz = koszyk[i]; if(!poz) return;
  if(d>0){
    const p = produkty.find(x=>x.id===poz.id);
    if(p&&produktOznaczonyNiedostepny(p)){ toast("⚠️ Produkt jest chwilowo niedostępny"); return; }
    if(!potwierdzProgDostepnosci(poz.id, ileWKoszyku(poz.id)+1)) return;
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
function produktObjetyRegulaRabatowa(p,regula){
  if(!p||!regula)return false;
  if(regula.zakres==="kategorie")return (regula.kategorie||[]).includes(p.kategoria);
  if(regula.zakres==="produkty")return (regula.produkty||[]).map(String).includes(String(p.id));
  return true;
}
function wynikRegulyRabatowej(regula){
  if(!regula)return {ok:false,powod:"Nieznany kod rabatowy",kwota:0,darmowaDostawa:false};
  const status=regulaRabatowaStatus(regula);if(!status.aktywna)return {ok:false,powod:status.powod,kwota:0,darmowaDostawa:false};
  const suma=sumaKoszyka(),minimum=Math.max(0,Number(regula.minKoszyk)||0);
  if(suma<minimum)return {ok:false,powod:`Minimalna wartość koszyka dla tego kodu to ${zl(minimum)}`,kwota:0,darmowaDostawa:false};
  const podstawa=koszyk.reduce((sum,x)=>{const p=produkty.find(p=>String(p.id)===String(x.id));return sum+(produktObjetyRegulaRabatowa(p,regula)?Number(p.cena||0)*Number(x.ile||0):0);},0);
  if(!podstawa&&regula.typ!=="darmowa_dostawa")return {ok:false,powod:"Kod nie obejmuje produktów znajdujących się w koszyku",kwota:0,darmowaDostawa:false};
  let kwota=regula.typ==="kwota"?Math.min(podstawa,Math.max(0,Number(regula.wartosc)||0)):regula.typ==="procent"?podstawa*Math.max(0,Math.min(100,Number(regula.wartosc)||0))/100:0;
  const limit=Math.max(0,Number(regula.maxRabat)||0);if(limit)kwota=Math.min(kwota,limit);
  return {ok:true,powod:"",kwota:+Math.max(0,kwota).toFixed(2),darmowaDostawa:regula.typ==="darmowa_dostawa",podstawa};
}
function aktywnaRegulaRabatowa(){return rabat?znajdzReguleRabatowa(rabat.kod):null;}
function kwotaRabatu(){ const wynik=wynikRegulyRabatowej(aktywnaRegulaRabatowa());return wynik.ok?wynik.kwota:0; }
function sumaPoRabacie(){ return Math.max(0, sumaKoszyka()-kwotaRabatu()); }
function zastosujKod(){
  const kod = ($("promoInput")?.value||"").trim().toUpperCase();
  const regula=znajdzReguleRabatowa(kod),wynik=wynikRegulyRabatowej(regula);
  if(wynik.ok){rabat={kod:regula.kod,typ:regula.typ,wartosc:Number(regula.wartosc)||0};zapiszLS("artway_rabat",rabat);toast(regula.typ==="darmowa_dostawa"?`Kod ${kod} aktywny: darmowa dostawa 🎉`:`Kod ${kod} aktywny: −${zl(wynik.kwota)} 🎉`);}
  else { toast(`${wynik.powod||"Nieznany kod rabatowy"} 😕`); loguj("info","Nieudana próba użycia kodu "+kod+": "+(wynik.powod||"nieznany")); }
  odswiezKoszyk();
}
function usunRabat(){ rabat=null; zapiszLS("artway_rabat", null); odswiezKoszyk(); }
function odswiezKoszyk(){
  const n = koszyk.reduce((s,x)=>s+x.ile,0);
  $("cartCount").textContent = n;
  const suma = sumaPoRabacie();
  $("cartTotal").textContent = zl(suma);
  $("checkoutBtn").disabled = !n;
  const regulaRabatu=aktywnaRegulaRabatowa(),wynikRabatu=wynikRegulyRabatowej(regulaRabatu);
  if(rabat&&!wynikRabatu.ok){rabat=null;zapiszLS("artway_rabat",null);}
  $("rabatBox").innerHTML = rabat ? `<div class="rabat-info"><span>🎁 Kod ${esc(rabat.kod)}: ${wynikRabatu.darmowaDostawa?"darmowa dostawa":"−"+zl(wynikRabatu.kwota)}</span><button onclick="usunRabat()">usuń</button></div>` : "";
  $("freeShip").textContent = suma>=KONFIG.darmowaDostawaOd ? "🎉 Masz darmową dostawę!"
    : suma>0 ? `Do darmowej dostawy brakuje ${zl(KONFIG.darmowaDostawaOd-suma)}` : "";
  $("cartItems").innerHTML = n ? koszyk.map((x,i)=>{
    const p = produkty.find(p=>p.id===x.id); if(!p) return "";
    return `<div class="cart-item">
      <div class="ci-thumb" style="background:${p.kolor||'#eef2f7'}">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:(p.ikona||"📦")}</div>
      <div class="ci-info"><b>${esc(p.nazwa)}</b>${x.wariant?`<small style="display:block;color:var(--brand);font-weight:700">${esc(x.wariant)}</small>`:""}<small>${zl(p.cena)} / szt.</small></div>
      <div class="qty">
        <button onclick="zmienIloscIdx(${i},-1)">−</button><span>${x.ile}</span>
        <button onclick="zmienIloscIdx(${i},1)">+</button>
      </div>
      <button class="ci-remove" onclick="usunIdx(${i})" aria-label="Usuń">🗑️</button>
    </div>`;}).join("") + alertDostepnosciKoszykaHTML()
    : `<div class="cart-empty">Koszyk jest pusty.<br>Dodaj coś fajnego! 😊</div>`;
}

/* ═══════════ ZAMÓWIENIE — system dostawy i płatności ═══════════
   Dostawy i płatności konfigurujesz w KONFIG (góra pliku).
   „Za pobraniem” działa od razu — bez umów z bramkami płatności.
   Koszty przeliczają się na żywo przy zmianie opcji.             */
function kosztDostawyDlaKwoty(idDostawy, kwotaProdukow=sumaPoRabacie()){
  const d = dostepneDostawy().find(x=>x.id===idDostawy) || dostepneDostawy()[0];
  const wynik=wynikRegulyRabatowej(aktywnaRegulaRabatowa());
  if(wynik.ok&&wynik.darmowaDostawa)return 0;
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
  const brakujace=koszyk.filter(x=>!produkty.some(p=>String(p.id)===String(x.id)));
  if(brakujace.length){
    koszyk=koszyk.filter(x=>produkty.some(p=>String(p.id)===String(x.id)));
    zapiszLS("artway_koszyk",koszyk);odswiezKoszyk();
    loguj("ostrzezenie",`Usunięto z koszyka ${brakujace.length} nieaktualnych pozycji przed otwarciem zamówienia`);
    toast(brakujace.length===1?"Usunięto z koszyka produkt, który nie jest już dostępny":"Usunięto z koszyka nieaktualne produkty");
  }
  if(!koszyk.length){zamknijKoszyk();return;}
  zamknijKoszyk();
  window.__paczkomatAdres="";
  const profil = sesja ? (pobierzProfil(sesja.email)||{}) : {};
  const czesci = (sesja?.imie||"").split(" ");
  const imieS = czesci[0]||"", nazwiskoS = czesci.slice(1).join(" ");
  const maFirme = !!(profil.nip && profil.firma);
  $("modalBox").innerHTML = `
    <button type="button" class="modal-close" onclick="zamknijModalCheckout()" aria-label="Zamknij formularz zamówienia">✕</button>
    <h2 id="checkoutTitle">Dane do zamówienia</h2>
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
      <div id="availabilityConfirmBox"></div>
      <div class="summary" id="orderSummary"></div>
      <button type="submit" class="checkout-btn">Zamawiam →</button>
      <p class="pay-note">Klikając, akceptujesz <a href="#/regulamin" onclick="zamknijModalCheckout({restoreFocus:false})">regulamin</a>. Dane służą wyłącznie realizacji zamówienia.</p>
    </form>`;
  przeliczZamowienie();
  aktywujModalCheckout();
}
function przeliczZamowienie(){
  const form = $("orderForm"); if(!form) return;
  const idD = form.delivery?.value || "paczkomat", idP = form.payment.value;
  const pBox = $("paczkomatBox");
  if(pBox){ pBox.style.display = czyDostawaPaczkomat(idD) ? "" : "none"; }
  const suma = sumaPoRabacie(), dostawa = kosztDostawy(idD), oplata = oplataPlatnosci(idP), weekend = oplataPaczkaWeekend(!!form.paczkaWeekend?.checked);
  const box=$("availabilityConfirmBox"), potwierdzenia=pozycjeDoPotwierdzeniaDostepnosci();
  if(box) box.innerHTML = potwierdzenia.length ? `<div class="backend-note" style="margin:.8rem 0;border-color:#fed7aa;background:#fff7ed;color:#9a3412">
    <b>Sprawdzenie dostępności przy większej ilości</b><br>
    Dla ${potwierdzenia.map(x=>`${esc(x.nazwa)} × ${x.ilosc}`).join(", ")} obsługa potwierdzi aktualną dostępność przed realizacją.
    <label class="chk-row" style="margin-top:.45rem"><input type="checkbox" name="potwierdzenieDostepnosci" required> Rozumiem, że dostępność tej ilości zostanie potwierdzona przez sklep.</label>
  </div>` : "";
  $("orderSummary").innerHTML =
    koszyk.map(x=>{const p=produkty.find(p=>String(p.id)===String(x.id));
      return p?`<div><span>${esc(p.nazwa)}${x.wariant?` (${esc(x.wariant)})`:""} × ${x.ile}</span><span>${zl(p.cena*x.ile)}</span></div>`:"";}).join("")
    + (rabat?`<div><span>Kod (${esc(rabat.kod)})</span><span>${wynikRegulyRabatowej(aktywnaRegulaRabatowa()).darmowaDostawa?"Darmowa dostawa":"−"+zl(kwotaRabatu())}</span></div>`:"")
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
    const niedostepneWKoszyku=koszyk.map(x=>produkty.find(p=>p.id===x.id)).filter(p=>!p||!produktDostepnyWSprzedazy(p));
    if(niedostepneWKoszyku.length){
      toast("⚠️ Usuń z koszyka produkty chwilowo niedostępne lub bez ceny");
      return;
    }
    const potwierdzeniaDostepnosci = pozycjeDoPotwierdzeniaDostepnosci();
    if(potwierdzeniaDostepnosci.length && !f.get("potwierdzenieDostepnosci")){
      toast("⚠️ Potwierdź informację o sprawdzeniu dostępności większej ilości");
      return;
    }
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
      if(w.ok){ ustawSesje(w.uzytkownik); toast("Konto założone! 🎉"); }
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
    const pozycjeDane = koszyk.map(x=>{const p=produkty.find(p=>String(p.id)===String(x.id));
      return p?{id:p.id,nazwa:p.nazwa,sku:p.sku||"",wariant:x.wariant||"",ilosc:x.ile,cena:p.cena,wartosc:p.cena*x.ile}:null;}).filter(Boolean);
    if(!pozycjeDane.length)throw new Error("Koszyk nie zawiera aktualnie dostępnych produktów");
    const pozycje = pozycjeDane.map(p=>{
      return `${p.nazwa}${p.wariant?` (${p.wariant})`:""}${p.sku?` [${p.sku}]`:""} × ${p.ilosc} = ${zl(p.wartosc)}`;});
    const tresc =
`NOWE ZAMÓWIENIE ${nr}
================================
${pozycje.map(p=>"- "+p).join("\n")}
${rabat?`Kod ${rabat.kod}: ${wynikRegulyRabatowej(aktywnaRegulaRabatowa()).darmowaDostawa?"darmowa dostawa":"-"+zl(kwotaRabatu())}\n`:""}Dostawa: ${dost.nazwa}${paczkomat} — ${dostawa?zl(dostawa):"gratis"}
${paczkaWeekend?`Paczka w Weekend: ${zl(oplataWeekend)}\n`:""}
${oplata?`Opłata za pobranie: ${zl(oplata)}\n`:""}RAZEM: ${zl(razem)}
${potwierdzeniaDostepnosci.length?`UWAGA: potwierdzić dostępność większej ilości: ${potwierdzeniaDostepnosci.map(x=>`${x.nazwa} × ${x.ilosc}`).join(", ")}\n`:""}
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
    zmniejszStany(koszyk, nr);   // magazyn: odejmij sprzedane sztuki
    const emailKlienta=String(f.get("email")||"").trim().toLowerCase();
    const noweZamowienie={
      nr, data:new Date().toLocaleString("pl-PL"), ts:Date.now(), email:emailKlienta,rabatKod:rabat?.kod||"",
      klient:{imie:String(f.get("imie")||"").trim(),nazwisko:String(f.get("nazwisko")||"").trim(),telefon:String(f.get("phone")||"").trim(),
        firma:f.get("firmaChk")?String(f.get("firma")||"").trim():"",nip:f.get("firmaChk")?String(f.get("nip")||"").replace(/[^0-9]/g,""):""},
      adresDostawy:{ulica:String(f.get("ulica")||"").trim(),nrDomu:String(f.get("nrDomu")||"").trim(),nrLokalu:String(f.get("nrLokalu")||"").trim(),kod:String(f.get("kod")||"").trim(),miasto:String(f.get("miasto")||"").trim()},
      pozycje,pozycjeDane,razem,status:"nowe",dostawa:dost.nazwa,dostawaId:idD,dostawaKoszt:dostawa,paczkaWeekend,oplataPaczkaWeekend:oplataWeekend,
      wymagaPotwierdzeniaDostepnosci:potwierdzeniaDostepnosci.length>0,dostepnoscDoPotwierdzenia:potwierdzeniaDostepnosci,
      oplataPlatnosci:oplata,koszty:{produkty:sumaKoszyka(),rabat:kwotaRabatu(),poRabacie:suma,dostawa,paczkaWeekend:oplataWeekend,platnosc:oplata,razem},
      platnosc:plat.nazwa,platnoscId:idP,platnoscInstrukcja:instrukcjaPlatnosciTekst(idP,nr,razem),adres,
      paczkomat:czyDostawaPaczkomat(idD)?String(f.get("paczkomat")||"").trim():"",paczkomatAdres:czyDostawaPaczkomat(idD)?String(window.__paczkomatAdres||"").trim():"",uwagi:String(f.get("notes")||"").trim(),
      wysylka:{przewoznik:"inpost",usluga:uslugaInpostDlaDostawy(idD),punktKod:czyDostawaPaczkomat(idD)?String(f.get("paczkomat")||"").trim():"",status:"nieprzygotowana",etap:"do_obslugi",priorytet:"normalny",zadania:{dane:true,kompletacja:false,etykieta:false,przekazanie:false},
        paczkaWeekend,oplataWeekend,dodatkoweUslugi:paczkaWeekend?[{id:"paczka_weekend",nazwa:"Paczka w Weekend",koszt:oplataWeekend}]:[],
        historia:[{czas:new Date().toLocaleString("pl-PL"),status:"Zamówienie utworzone",opis:"Oczekuje na potwierdzenie i przygotowanie"}],powiadomienia:[]}
    };
    zapiszZamowienie(noweZamowienie);
    const zapisanoCentralnie=await zapiszZamowienieCentralnie(noweZamowienie,true);
    if(zapisanoCentralnie?.orderAccessToken){
      noweZamowienie.orderAccessToken=zapisanoCentralnie.orderAccessToken;
      zapiszZamowienie(noweZamowienie);
      const dostepy=wczytajLS("artway_dostep_zamowien",{});
      dostepy[nr]=zapisanoCentralnie.orderAccessToken;
      zapiszLS("artway_dostep_zamowien",dostepy);
    }
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
    if(typeof seoSledzZamowienie==="function")seoSledzZamowienie(razem);

	    const infoPlatnosci = instrukcjaPlatnosciHTML(idP,nr,razem,noweZamowienie);
	    const bladPaynow = idP==="paynow" && paynowWynik && paynowWynik.ok===false && !paynowWynik.skipped
	      ? `<p class="pay-note" style="color:var(--danger);text-align:left">Paynow nie utworzył linku automatycznie: ${esc(paynowWynik.error||"brak konfiguracji")}. Zamówienie zostało zapisane — po uzupełnieniu konfiguracji można odświeżyć płatność w panelu.</p>` : "";
	    const urlDziekujemy = `#/dziekujemy/${encodeURIComponent(nr)}`;
	    const linkPaynow = noweZamowienie.paynow?.redirectUrl || (idP==="paynow" && KONFIG.linkPlatnosci ? KONFIG.linkPlatnosci : "");
	    $("modalBox").innerHTML = `<div class="success">
	      <div class="big">✅</div>
	      <h2 id="checkoutTitle">${linkPaynow?"Przekierowujemy do płatności…":"Dziękujemy za zamówienie!"}</h2>
	      <p class="sub">Numer zamówienia: <b>${nr}</b> • Kwota: <b>${zl(razem)}</b><br>${esc(dost.nazwa)} • ${esc(plat.nazwa)}</p>
	      <p class="pay-note" style="${zapisanoCentralnie?"color:var(--ok)":"color:var(--danger)"}">${zapisanoCentralnie?"☁️ Zamówienie zapisano we wspólnej bazie sklepu.":"⚠️ Brak połączenia z serwerem — zamówienie czeka na synchronizację."}</p>
	      <p class="pay-note" style="text-align:left">📧 Potwierdzenie zamówienia jest wysyłane automatycznie na e-mail klienta, jeśli bramka e-mail jest skonfigurowana.</p>
	      ${bladPaynow}
	      ${infoPlatnosci}
	      <p class="pay-note" style="margin-top:1rem"><a href="${linkPaynow?esc(linkPaynow):urlDziekujemy}" onclick="zamknijModalCheckout({restoreFocus:false})" style="color:var(--brand)">${linkPaynow?"Przejdź do płatności teraz →":"Przejdź do podziękowania →"}</a></p>
	    </div>`;
	    koszyk=[]; rabat=null; zapiszLS("artway_koszyk",koszyk); zapiszLS("artway_rabat",null); odswiezKoszyk();
	    setTimeout(()=>{
	      zamknijModalCheckout({restoreFocus:false});
	      if(linkPaynow) location.href=linkPaynow;
	      else location.hash=urlDziekujemy;
	    }, linkPaynow?900:650);
  }catch(bl){
    loguj("blad","Błąd składania zamówienia: "+bl.message);
    toast("⚠️ Wystąpił błąd — zapisano w diagnostyce");
  }
}

/* Instalowalny panel administratora (PWA). Aplikacja używa dokładnie tego
   samego panelu i API co strona, dlatego nie tworzy drugiej kopii danych. */
let pwaOdroczoneZaproszenie=null;

function pwaDzialaJakoAplikacja(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true;
}
function pwaUstawTrybWyswietlania(){const standalone=pwaDzialaJakoAplikacja();document.documentElement.classList.toggle("artway-pwa-standalone",standalone);document.body?.classList.toggle("artway-pwa-standalone",standalone);if(!standalone&&typeof pwaZamknijMenuAdmina==="function")pwaZamknijMenuAdmina();return standalone;}
function pwaIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent||"");}
function pwaPrzyciskInstalacjiHTML(){
  return `<button class="btn ghost admin-pwa-install" type="button" onclick="pwaZainstalujPanelAdmina()" ${pwaDzialaJakoAplikacja()?"hidden":""}>📲 Zainstaluj</button>`;
}
function pwaOdswiezPrzyciski(){
  document.querySelectorAll(".admin-pwa-install").forEach(button=>{button.hidden=pwaDzialaJakoAplikacja();button.classList.toggle("is-ready",!!pwaOdroczoneZaproszenie);});
}
function pwaZamknijInstrukcje(){document.getElementById("adminPwaHelp")?.remove();}
function pwaPokazInstrukcje(){
  pwaZamknijInstrukcje();
  const ios=pwaIOS(),dialog=document.createElement("div");dialog.id="adminPwaHelp";dialog.className="admin-pwa-help";
  dialog.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="adminPwaHelpTitle"><button class="admin-pwa-help-close" type="button" onclick="pwaZamknijInstrukcje()" aria-label="Zamknij">✕</button><span class="admin-pwa-help-icon">📲</span><h2 id="adminPwaHelpTitle">Zainstaluj panel Artway-TM</h2><p>${ios?"W Safari wybierz przycisk <b>Udostępnij</b>, a następnie <b>Do ekranu początkowego</b> i potwierdź <b>Dodaj</b>.":"Otwórz menu przeglądarki i wybierz <b>Zainstaluj aplikację</b> albo <b>Dodaj do ekranu głównego</b>."}</p><small>Po instalacji panel otworzy się jak aplikacja: z własną ikoną, bez paska adresu i ze skrótami do najważniejszych modułów.</small><button class="btn" type="button" onclick="pwaZamknijInstrukcje()">Rozumiem</button></section>`;
  dialog.addEventListener("click",event=>{if(event.target===dialog)pwaZamknijInstrukcje();});document.body.appendChild(dialog);dialog.querySelector("button")?.focus();
}
async function pwaZainstalujPanelAdmina(){
  if(pwaDzialaJakoAplikacja()){toast("Panel jest już uruchomiony jako aplikacja");return;}
  if(!pwaOdroczoneZaproszenie){pwaPokazInstrukcje();return;}
  const prompt=pwaOdroczoneZaproszenie;pwaOdroczoneZaproszenie=null;await prompt.prompt();
  const result=await prompt.userChoice.catch(()=>({outcome:"dismissed"}));
  if(result.outcome==="accepted")toast("✅ Panel Artway-TM został dodany do telefonu");
  pwaOdswiezPrzyciski();
}
async function pwaZarejestrujAplikacje(){
  if(!("serviceWorker" in navigator)||!window.isSecureContext)return;
  try{await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});}
  catch(error){console.warn("Nie udało się zarejestrować aplikacji PWA",error);}
}
function pwaUruchomSkrotSkanera(){
  const params=new URLSearchParams(location.search);if(params.get("scanner")!=="1")return;
  let attempts=0;const timer=setInterval(()=>{attempts++;if(typeof magazynGlobalnySkanerOtworz==="function"){clearInterval(timer);params.delete("scanner");const query=params.toString();history.replaceState(null,"",`${location.pathname}${query?`?${query}`:""}${location.hash}`);void magazynGlobalnySkanerOtworz();}else if(attempts>30)clearInterval(timer);},250);
}
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();pwaOdroczoneZaproszenie=event;pwaOdswiezPrzyciski();});
window.addEventListener("appinstalled",()=>{pwaOdroczoneZaproszenie=null;pwaUstawTrybWyswietlania();pwaOdswiezPrzyciski();});
window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change",()=>{pwaUstawTrybWyswietlania();pwaOdswiezPrzyciski();});
window.addEventListener("DOMContentLoaded",()=>{pwaUstawTrybWyswietlania();void pwaZarejestrujAplikacje();pwaUruchomSkrotSkanera();});

/* ═══════════ UI ═══════════ */
let dialogPoprzedniFocus=null;
function elementyFokusu(root){return [...(root?.querySelectorAll?.('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')||[])].filter(el=>!el.hidden&&el.getAttribute("aria-hidden")!=="true"&&el.offsetParent!==null);}
function ustawBlokadeDialogu(){document.body.classList.toggle("has-dialog",$("drawer")?.classList.contains("open")||$("modal")?.classList.contains("open"));}
function otworzKoszyk(){dialogPoprzedniFocus=document.activeElement;const drawer=$("drawer"),overlay=$("overlay");drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");overlay.classList.add("open");overlay.setAttribute("aria-hidden","false");ustawBlokadeDialogu();requestAnimationFrame(()=>$("closeCart")?.focus());}
function zamknijKoszyk({restoreFocus=true}={}){const drawer=$("drawer"),overlay=$("overlay");drawer.classList.remove("open");overlay.classList.remove("open");const target=restoreFocus&&dialogPoprzedniFocus?.isConnected?dialogPoprzedniFocus:$("widok");target?.focus?.({preventScroll:true});drawer.setAttribute("aria-hidden","true");overlay.setAttribute("aria-hidden","true");ustawBlokadeDialogu();}
function aktywujModalCheckout(){dialogPoprzedniFocus=document.activeElement;const modal=$("modal");modal.classList.add("open");modal.setAttribute("aria-hidden","false");ustawBlokadeDialogu();requestAnimationFrame(()=>modal.querySelector("input,select,button,a[href]")?.focus()||$("modalBox")?.focus());}
function zamknijModalCheckout({restoreFocus=true}={}){const modal=$("modal");modal.classList.remove("open");const target=restoreFocus&&dialogPoprzedniFocus?.isConnected?dialogPoprzedniFocus:$("widok");target?.focus?.({preventScroll:true});modal.setAttribute("aria-hidden","true");ustawBlokadeDialogu();}
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1800); }

$("cartBtn").onclick = otworzKoszyk;
$("closeCart").onclick = zamknijKoszyk;
$("overlay").onclick = zamknijKoszyk;
$("checkoutBtn").onclick = otworzModal;
$("modal").onclick = e=>{ if(e.target.id==="modal") zamknijModalCheckout(); };
document.addEventListener("keydown",event=>{
  const modal=$("modal"),drawer=$("drawer");
  const root=modal?.classList.contains("open")?modal:drawer?.classList.contains("open")?drawer:null;
  if(!root)return;
  if(event.key==="Escape"){event.preventDefault();root===modal?zamknijModalCheckout():zamknijKoszyk();return;}
  if(event.key!=="Tab")return;
  const focusable=elementyFokusu(root);if(!focusable.length){event.preventDefault();root.focus?.();return;}
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
$("searchInput").oninput = e=>{
  fraza = e.target.value.toLowerCase();
  stronaProduktow = 1;
  if(trasa()!=="/" && trasa()!=="") location.hash="#/";
  else rysuj();
};

/* ═══════════ START ═══════════ */
(async ()=>{
  const porzadkowaniePamieci=zwolnijPamiecPodreczna();
  if(porzadkowaniePamieci.usunieto.length)loguj("info",`Odciążono pamięć podręczną: ${(porzadkowaniePamieci.przed/1024).toFixed(0)} KB → ${(porzadkowaniePamieci.po/1024).toFixed(0)} KB`);
  const ladowanieProduktow=pobierzBazoweProdukty();
  await Promise.all([chmuraWczytajStan(),ladowanieProduktow]); // ustawienia i katalog pobieramy równolegle
  zastosujUstawienia();
  await zainicjujAdmina();
  await odtworzSesjeCentralna();
  odswiezUzytkownika();
  odswiezUlubioneLicznik();
  odswiezZnacznikDiag();
  finalizujWczytanieProduktow();
  const porzadkowanieReferencji=porzadkujBezpieczneReferencje();
  if(porzadkowanieReferencji.koszyk||porzadkowanieReferencji.mapowania){odswiezKoszyk();zbudujProdukty();}
  uruchomAutoSynchronizacjeChmury();
})();
