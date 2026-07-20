/* ═══════════ WCZYTANIE PRODUKTÓW ═══════════
   Lista = (products.json lub zapasowa) − ukryte + dodane w panelu admina */
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
function magazynLokalizacjeAktywne(){
  const lista=Array.isArray(magazynLokalizacje)?magazynLokalizacje:[];
  return lista.filter(l=>l&&l.aktywna!==false).sort((a,b)=>sciezkaLokalizacjiMagazynu(a.kod).localeCompare(sciezkaLokalizacjiMagazynu(b.kod),"pl",{numeric:true})||(Number(a.priorytet)||9999)-(Number(b.priorytet)||9999));
}
function magazynLokalizacjaPoKodzie(kod){
  const k=kodLokalizacjiMagazynu(kod);
  return (Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).find(l=>kodLokalizacjiMagazynu(l.kod)===k)||null;
}
function nazwaLokalizacjiMagazynu(kod){
  const l=magazynLokalizacjaPoKodzie(kod);
  return l?`${l.kod}${l.nazwa?` — ${l.nazwa}`:""}`:String(kod||"");
}
function sciezkaLokalizacjiMagazynu(kod){
  const parts=[],seen=new Set();let current=magazynLokalizacjaPoKodzie(kod),guard=0;
  while(current&&guard++<10&&!seen.has(current.kod)){seen.add(current.kod);parts.unshift(current.kod);current=current.parentKod?magazynLokalizacjaPoKodzie(current.parentKod):null;}
  return parts.join(" / ")||String(kod||"");
}
function poziomLokalizacjiMagazynu(kod){return Math.max(0,sciezkaLokalizacjiMagazynu(kod).split(" / ").filter(Boolean).length-1);}
function sciezkaNazwLokalizacjiMagazynu(kod){
  const parts=[],seen=new Set();let current=magazynLokalizacjaPoKodzie(kod),guard=0;
  while(current&&guard++<10&&!seen.has(current.kod)){seen.add(current.kod);parts.unshift(String(current.nazwa||current.kod));current=current.parentKod?magazynLokalizacjaPoKodzie(current.parentKod):null;}
  return parts.join(" → ")||String(kod||"");
}
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
  const v=String(value||"").trim(), aktywne=magazynLokalizacjeAktywne();
  return `<select name="lokalizacja">
    <option value="" ${!v?"selected":""}>— brak lokalizacji —</option>
    ${aktywne.map(l=>`<option value="${esc(l.kod)}" ${v===l.kod?"selected":""}>${"· ".repeat(poziomLokalizacjiMagazynu(l.kod))}${esc(l.kod)}${l.nazwa?` — ${esc(l.nazwa)}`:""} [${esc(l.typ||"miejsce")}]</option>`).join("")}
    ${v&&!aktywne.some(l=>l.kod===v)?`<option value="${esc(v)}" selected>${esc(v)} — spoza słownika</option>`:""}
  </select>`;
}
function statystykiLokalizacji(produktyLista=produktyDoAdministracji()){
  const rez=rezerwacjeMagazynowe(), mapa={};
  produktyLista.filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    const meta=magazynMetaProduktu(p.id), kod=String(meta.lokalizacja||"").trim()||"BRAK";
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
  if(originalKod&&originalKod!==kod){toast("Kod zapisanej lokalizacji jest stały. Utwórz nowe miejsce, aby użyć innego kodu.");return false;}
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
    pojemnosc:bezLimitu?0:Math.max(1,Math.trunc(limit)),
    bezLimitu,
    priorytet:intNieujemny(f.get("priorytet"),999),
    uwagi:String(f.get("uwagi")||"").trim(),
    aktywna:true,
    utworzono:istnieje?.utworzono||teraz,
    aktualizacja:teraz,
    operator:sesja?.email||"administrator"
  };
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
  // Kanoniczna hierarchia fizyczna: strefa → regał → półka → miejsce.
  e.preventDefault();const f=new FormData(e.target),zone=kodLokalizacjiMagazynu(f.get("strefaKod")||"PAK"),zoneName=String(f.get("strefaNazwa")||"Pakownia").trim()||"Pakownia",rackMode=String(f.get("trybRegalow")||"litery"),rackCount=Math.max(1,Math.min(100,intNieujemny(f.get("regaly"),1))),shelfCount=Math.max(1,Math.min(200,intNieujemny(f.get("polki"),5))),placeCount=Math.max(0,Math.min(500,intNieujemny(f.get("miejsca"),0))),startRack=magazynIndeksRegalu(f.get("startRegal")||"A"),startShelf=Math.max(1,intNieujemny(f.get("startPolka"),1)),startPlace=Math.max(1,intNieujemny(f.get("startMiejsce"),1)),limit=Number(String(f.get("pojemnosc")||"0").replace(",","."))||0,unlimited=f.get("bezLimitu")==="on"||limit<=0,capacity=unlimited?0:Math.max(1,Math.trunc(limit)),now=new Date().toISOString();
  if(!zone){toast("Podaj kod obszaru, np. PAK");return false;}
  const requested=1+rackCount+rackCount*shelfCount+rackCount*shelfCount*placeCount;if(requested>5000){toast(`Wybrana struktura ma ${requested} elementów. Podziel tworzenie na mniejsze obszary (maks. 5000 elementów jednorazowo).`);return false;}
  const existing=new Map((Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).map(l=>[kodLokalizacjiMagazynu(l.kod),l])),created=[];let overflow=false;
  const put=(rec)=>{const old=existing.get(rec.kod);if(old&&old.aktywna!==false)return;if(!old&&existing.size>=5000){overflow=true;return;}const next={...old,id:old?.id||`LOC-${Date.now().toString(36)}-${created.length}`,aktywna:true,utworzono:old?.utworzono||now,aktualizacja:now,operator:sesja?.email||"administrator",...rec};existing.set(rec.kod,next);created.push(next);};
  put({kod:zone,nazwa:zoneName,typ:"strefa",parentKod:"",strefa:zone,priorytet:1,pojemnosc:0,bezLimitu:true,uwagi:"Obszar wygenerowany w kreatorze struktury"});
  for(let r=0;r<rackCount;r++){
    const rackLabel=rackMode==="numery"?String(startRack+r):magazynLiteraRegalu(startRack+r),rack=`${zone}-R${rackLabel}`;put({kod:rack,nazwa:`Regał ${rackLabel}`,typ:"regał",parentKod:zone,strefa:zone,priorytet:10+r,pojemnosc:0,bezLimitu:true,uwagi:""});
    for(let s=0;s<shelfCount;s++){
      const shelfNo=startShelf+s,shelf=`${rack}-P${String(shelfNo).padStart(2,"0")}`;put({kod:shelf,nazwa:`Półka ${shelfNo}`,typ:"półka",parentKod:rack,strefa:zone,priorytet:100+r*100+s,pojemnosc:placeCount?0:capacity,bezLimitu:placeCount?true:unlimited,uwagi:""});
      for(let m=0;m<placeCount;m++){const placeNo=startPlace+m,place=`${shelf}-M${String(placeNo).padStart(3,"0")}`;put({kod:place,nazwa:`Miejsce ${placeNo}`,typ:"miejsce",parentKod:shelf,strefa:zone,priorytet:10000+r*100000+s*1000+m,pojemnosc:capacity,bezLimitu:unlimited,uwagi:""});}
    }
  }
  if(overflow){toast("Struktura przekracza limit 5000 aktywnych elementów. Zmniejsz liczbę regałów, półek albo miejsc.");return false;}
  magazynLokalizacje=[...existing.values()].slice(0,5000);zapiszLokalizacjeMagazynuWspolnie(`Generator utworzył ${created.length} elementów struktury magazynu`);toast(created.length?`✅ Utworzono ${created.length} nowych elementów: strefę, regały, półki${placeCount?" i miejsca":""}`:"Wszystkie wskazane lokalizacje już istnieją");renderuj();return false;
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
  const rez=rezerwacjeMagazynowe(), spr=sprzedazMagazynowa(30);
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>sugestiaZatowarowania(p,rez,spr)).sort((a,b)=>{
    const pa=a.poziom==="bad"?0:a.poziom==="warn"?1:2, pb=b.poziom==="bad"?0:b.poziom==="warn"?1:2;
    return pa-pb || Number(b.ilosc||0)-Number(a.ilosc||0) || String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl");
  });
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
  if(!product.zdjecie)warnings.push("brak zdjęcia głównego");
  if(String(product.opisKrotki||"").length<40)warnings.push("krótki opis wymaga rozwinięcia");
  if(String(product.opis||"").length<150)warnings.push("pełny opis jest zbyt krótki");
  const dataScore=Math.max(0,Math.min(100,Math.round((product.nazwa?15:0)+(Number(product.cena)>0?15:0)+(product.kategoria?10:0)+((product.gtin||product.ean)?15:0)+((product.mpn||product.kodProducenta||product.externalId)?10:0)+(product.zdjecie?10:0)+(String(product.opisKrotki||"").length>=40?10:0)+(String(product.opis||"").length>=150?10:0)+((product.producent||product.marka)?5:0))));
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
async function pobierzBazoweProdukty(){
  try{
    const wersja = document.querySelector('meta[name="artway-version"]')?.content || String(Date.now());
    const r = await fetch(`/products.json?v=${encodeURIComponent(wersja)}`, {cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const dane = await r.json();
    if(!Array.isArray(dane)) throw new Error("products.json nie zawiera tablicy produktów");
    const poprawne = dane.filter(p=>p&&p.id!==undefined&&String(p.nazwa||"").trim());
    const unikalne = new Set(poprawne.map(p=>String(p.id)));
    if(poprawne.length!==dane.length||unikalne.size!==poprawne.length) throw new Error("products.json zawiera niepoprawne lub powtórzone rekordy");
    prodBazowe = poprawne;
    zrodloProduktow = "json";
  }catch(e){
    prodBazowe = PRODUKTY_ZAPASOWE;
    zrodloProduktow = "zapasowe";
    loguj("ostrzezenie","products.json niedostępny — katalog demonstracyjny został zablokowany, aby nie pokazywać nieaktualnych produktów.");
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
