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
