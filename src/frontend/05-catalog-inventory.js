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
function zbudujProdukty(){
  if(typeof uniewaznijProduktyAdminCache==="function")uniewaznijProduktyAdminCache();
  naprawKolizjeIdProduktow();
  const zmianyKat = ustawienia.kategorie || {};
  const ukryteKat = ustawienia.ukryteKategorie || [];
  const mapa = ustawienia.mapaProduktow || {};    // zaawansowane mapowanie: id produktu → katalog
  const dodaneIds = new Set(produktyDodane.map(p=>Number(p.id)));
  const bazowePoEdycji = produktyBazoweWspolne()
    .filter(p=>!dodaneIds.has(Number(p.id))&&!produktyUkryte.includes(p.id))
    .map(p=>produktyEdytowane[p.id] ? {...p, ...produktyEdytowane[p.id], id:p.id} : p);
  produkty = [ ...bazowePoEdycji, ...produktyDodane ]
    .map(p => { let k = mapa[p.id] || p.kategoria;
                for(let i=0; i<3 && zmianyKat[k]; i++) k = zmianyKat[k];
                return k===p.kategoria ? p : {...p, kategoria:k}; })
    .map(p => stanyProduktow[p.id]!==undefined ? {...p, stan:+stanyProduktow[p.id]} : p)
    .filter(p => !ukryteKat.includes(p.kategoria))
    .filter(p => !produktOznaczonyNiedostepny(p));
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
