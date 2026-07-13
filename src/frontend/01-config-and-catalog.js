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
