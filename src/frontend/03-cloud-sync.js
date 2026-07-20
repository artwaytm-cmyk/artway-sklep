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
function naprawKolizjeIdProduktow(){
  if(!produktyDodane.length) return false;
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
  if(!zmiana) return false;
  produktyDodane=poprawione;
  zapiszLS("artway_produkty_dodane",produktyDodane);
  loguj("ostrzezenie","Naprawiono wyłącznie nieprawidłowe lub powtórzone ID w produktach dodanych. ID usuniętego produktu bazowego może być ponownie użyte przez nowy produkt.");
  return true;
}
