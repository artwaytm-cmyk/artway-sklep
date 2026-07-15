const ALLEGRO_ODSWIEZANIE_PANELU_MS=15*60*1000;
let allegroAutoOdswiezanie={busy:false,lastChecked:0,lastChanged:0,orders:0,threads:0,issues:0,offers:0,error:""};
function klientZamowieniaLabel(z){
  const k=z?.klient||{};
  return [k.imie,k.nazwisko].filter(Boolean).join(" ") || z?.email || "gość";
}
function adminZamowienieSearchText(z){
  const k=z?.klient||{}, w=daneWysylki(z);
  return `${z?.nr||""} ${z?.email||""} ${k.imie||""} ${k.nazwisko||""} ${k.telefon||""} ${k.firma||""} ${z?.adres||""} ${z?.dostawa||""} ${z?.platnosc||""} ${w.numer||""} ${w.inpostId||""}`.toLowerCase();
}
function adminZamowieniaStatyHTML(wszystkie,zam){
  const sumaWidocznych=zam.reduce((s,z)=>s+kwotaNum(kosztyZamowienia(z).razem||z.razem),0);
  const nowe=wszystkie.filter(z=>z.status==="nowe").length;
  const realizacja=wszystkie.filter(z=>["potwierdzone","w realizacji","gotowe do wysyłki"].includes(z.status)).length;
  const bezNumeru=wszystkie.filter(z=>!["anulowane","zakończone","dostarczone"].includes(String(z.status||"").toLowerCase())&&!daneWysylki(z).numer).length;
  const maile=wszystkie.filter(z=>(daneWysylki(z).powiadomienia||[]).length).length;
  return `<div class="orders-stat-grid">
    <div class="order-stat-card hot"><span>🆕</span><b>${nowe}</b><small>nowe zamówienia</small></div>
    <div class="order-stat-card"><span>📦</span><b>${wszystkie.length}</b><small>wszystkie aktywne</small></div>
    <div class="order-stat-card"><span>⚙️</span><b>${realizacja}</b><small>w obsłudze</small></div>
    <div class="order-stat-card"><span>🏷️</span><b>${bezNumeru}</b><small>bez numeru nadania</small></div>
    <div class="order-stat-card"><span>✉️</span><b>${maile}</b><small>z historią e-maili</small></div>
    <div class="order-stat-card money"><span>💰</span><b>${zl(sumaWidocznych)}</b><small>suma widocznych</small></div>
  </div>`;
}
function adminStatusyZamowienHTML(wszystkie){
  const ile=s=>s==="wszystkie"?wszystkie.length:wszystkie.filter(z=>z.status===s).length;
  return `<div class="orders-status-strip">
    <button class="${filtrZamowien==="wszystkie"?"active":""}" onclick="filtrZamowien='wszystkie';renderuj()">Wszystkie <b>${ile("wszystkie")}</b></button>
    ${STATUSY.map(s=>`<button class="${filtrZamowien===s?"active":""}" onclick="filtrZamowien=${jsArg(s)};renderuj()">${esc(s)} <b>${ile(s)}</b></button>`).join("")}
  </div>`;
}
function adminPasujaceZamowieniaSklepu(){
  let lista=pobierzZamowienia().slice();
  if(filtrZamowien!=="wszystkie")lista=lista.filter(z=>z.status===filtrZamowien);
  if(szukajZamowien)lista=lista.filter(z=>adminZamowienieSearchText(z).includes(szukajZamowien));
  return lista;
}
function adminPrzelaczZaznaczenieZamowienia(nr,checked){
  const id=String(nr||"");if(!id)return;
  checked?zaznaczoneZamowieniaSklepu.add(id):zaznaczoneZamowieniaSklepu.delete(id);renderuj();
}
function adminZaznaczWidoczneZamowienia(checked=true){
  adminPasujaceZamowieniaSklepu().forEach(z=>checked?zaznaczoneZamowieniaSklepu.add(String(z.nr)):zaznaczoneZamowieniaSklepu.delete(String(z.nr)));renderuj();
}
function adminWyczyscZaznaczenieZamowien(){zaznaczoneZamowieniaSklepu.clear();renderuj();}
function adminEksportujZamowieniaZakres(zakres="filtr"){
  const selected=new Set([...zaznaczoneZamowieniaSklepu].map(String));
  const lista=adminPasujaceZamowieniaSklepu().filter(z=>zakres!=="zaznaczone"||selected.has(String(z.nr)));
  eksportujZamowienia(lista,zakres==="zaznaczone"?"zamowienia-zaznaczone.csv":"zamowienia-filtrowane.csv");
}
function zastosujStatusZamowieniaLokalnie(z,status){
  if(!z||!STATUSY.includes(status)||z.status===status)return null;
  const poprzedni=z.status;z.status=status;
  const w=daneWysylki(z);
  const mapaEtapow={"nowe":"do_obslugi","potwierdzone":"do_obslugi","w realizacji":"przygotowanie","gotowe do wysyłki":"przygotowanie","nadane":"transport","wysłane":"transport","w doręczeniu":"doreczenie","dostarczone":"dostarczona","zakończone":"dostarczona","zwrot":"zwrot","zwrot pieniędzy":"zwrot","anulowane":"anulowana"};
  if(mapaEtapow[status])w.etap=mapaEtapow[status];
  w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status:"Status zamówienia",opis:`${poprzedni} → ${status}`}];
  z.wysylka=w;return {z,poprzedni,status};
}
async function adminMasowoZmienStatusZamowien(){
  const status=String(document.getElementById("bulkOrderStatus")?.value||"");
  const wybrane=new Set([...zaznaczoneZamowieniaSklepu]);
  if(!wybrane.size){toast("Zaznacz co najmniej jedno zamówienie");return;}
  if(!STATUSY.includes(status)){toast("Wybierz nowy status zamówień");return;}
  const lista=pobierzZamowienia(),zmiany=[];
  for(const z of lista)if(wybrane.has(String(z.nr))){const wynik=zastosujStatusZamowieniaLokalnie(z,status);if(wynik)zmiany.push(wynik);}
  if(!zmiany.length){toast("Wybrane zamówienia mają już ten status");return;}
  zapiszLS("artway_zamowienia",lista);zaznaczoneZamowieniaSklepu.clear();
  loguj("info",`Masowa zmiana statusu ${zmiany.length} zamówień → ${status}`);renderuj();
  toast(`Zmieniam status ${zmiany.length} zamówień → ${status}…`);
  let bledy=0;
  for(let i=0;i<zmiany.length;i+=5){
    const wyniki=await Promise.allSettled(zmiany.slice(i,i+5).map(async x=>{const d=await zapiszZamowienieCentralnie(x.z,false);if(!d)await obsluzAutomatycznyEmail(x.z.nr,status);return d;}));
    bledy+=wyniki.filter(x=>x.status==="rejected").length;
  }
  toast(`✅ Zmieniono ${zmiany.length} zamówień na „${status}”${bledy?` • błędy synchronizacji: ${bledy}`:""}`);
}
function allegroZapiszCache(){
  // Pełne rejestry pozostają w backendzie i w pamięci bieżącej sesji.
  // Nie duplikujemy tysięcy ofert, zamówień i wiadomości w localStorage,
  // ponieważ prowadziło to do przekroczenia limitu pamięci przeglądarki.
  for(const klucz of ["artway_allegro_zamowienia_cache","artway_allegro_oferty_cache","artway_allegro_komunikacja_cache"]){
    try{localStorage.removeItem(klucz);}catch(e){}
  }
  zapiszLS("artway_allegro_mapowania_cache", allegroMapowania);
}
function allegroProduktIdDlaOferty(offerId){
  const rec=(allegroMapowania||{})[String(offerId)];
  if(rec && typeof rec==="object") return rec.productId ?? rec.produktId ?? rec.id ?? "";
  return rec || "";
}
function allegroProduktDlaOferty(offerId){
  const id=allegroProduktIdDlaOferty(offerId);
  if(!id) return null;
  return pobierzProduktAdmin(Number(id)) || produktyDoAdministracji().find(p=>String(p.id)===String(id)) || null;
}
function allegroKodProduktu(p){
  return String(p?.sku||p?.kod||p?.externalId||p?.gtin||p?.id||"").trim();
}
function allegroEANProduktu(p){
  return String(p?.gtin||p?.ean||p?.kodKreskowy||"").trim();
}
function allegroKodOferty(o){
  return String(o?.externalId||o?.id||"").trim();
}
function allegroKluczeKodu(v){
  const raw=String(v||"").trim().toLowerCase();
  if(!raw) return [];
  const bezSpacji=raw.replace(/\s+/g,"");
  const bezUniw=bezSpacji.replace(/[-_ ]?uniw$/,"");
  const bezPrefixu=bezUniw.replace(/^(sku|kod|ean|gtin)[:#-]?/,"");
  const cyfry=(bezPrefixu.match(/\d{3,}/)||[])[0]||"";
  return [...new Set([raw,bezSpacji,bezUniw,bezPrefixu,cyfry].filter(Boolean))];
}
function allegroIndeksProduktowPoKodzie(){
  const indeks=new Map(), konflikty=new Set();
  const dodaj=(kod,p)=>{
    for(const k of allegroKluczeKodu(kod)){
      if(!k) continue;
      const poprzedni=indeks.get(k);
      if(poprzedni && String(poprzedni.id)!==String(p.id)){
        konflikty.add(k);
        continue;
      }
      indeks.set(k,p);
    }
  };
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    [p.sku,p.kod,p.externalId,p.gtin,p.ean,p.kodKreskowy,p.producentKod,p.kodProducenta].forEach(k=>dodaj(k,p));
  });
  konflikty.forEach(k=>indeks.delete(k));
  return indeks;
}
function allegroNormalizujNazwe(v){
  return String(v||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/&/g," i ")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function allegroTokenyNazwy(v){
  const stop=new Set(["gra","gry","planszowa","planszowe","edukacyjna","edukacyjne","zabawka","zestaw","alexander","dla","oraz","plus","wersja","mini","duza","duzy","mala","maly","od","do","na","w","i","z"]);
  return allegroNormalizujNazwe(v).split(" ").filter(t=>t.length>=3&&!stop.has(t));
}
function allegroDopasujProduktPoNazwie(nazwa, produktyLista){
  const norm=allegroNormalizujNazwe(nazwa);
  const tokeny=allegroTokenyNazwy(nazwa);
  if(!norm || !tokeny.length) return null;
  let najlepszy=null, drugi=0;
  for(const p of produktyLista){
    const pn=allegroNormalizujNazwe(p.nazwa);
    const pt=allegroTokenyNazwy(p.nazwa);
    if(!pn || !pt.length) continue;
    let score=0;
    if(pn===norm) score=1;
    else if(pt.length>=2 && pt.every(t=>tokeny.includes(t))) score=Math.min(0.94,0.62+(pt.length/Math.max(tokeny.length,pt.length))*0.34);
    else if(tokeny.length>=2 && tokeny.every(t=>pt.includes(t))) score=Math.min(0.9,0.58+(tokeny.length/Math.max(tokeny.length,pt.length))*0.32);
    if(score>0){
      if(!najlepszy || score>najlepszy.score){ drugi=najlepszy?.score||0; najlepszy={produkt:p,score}; }
      else if(score>drugi) drugi=score;
    }
  }
  return najlepszy && najlepszy.score>=0.82 && (najlepszy.score-drugi)>=0.08 ? najlepszy.produkt : null;
}
function allegroKodyZamowienDlaOferty(){
  const mapa=new Map();
  (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).forEach(z=>{
    (Array.isArray(z.lineItems)?z.lineItems:[]).forEach(it=>{
      const oid=String(it.offerId||"").trim();
      if(!oid) return;
      if(!mapa.has(oid)) mapa.set(oid,new Set());
      [it.externalId,it.offerName].filter(Boolean).forEach(k=>mapa.get(oid).add(k));
    });
  });
  return mapa;
}
function allegroSugestieAutomapowania(){
  const indeks=allegroIndeksProduktowPoKodzie();
  const produktyLista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const zZamowien=allegroKodyZamowienDlaOferty();
  const wyniki=[];
  (Array.isArray(allegroOferty)?allegroOferty:[]).forEach(o=>{
    if(allegroProduktDlaOferty(o.id)) return;
    const kody=[o.externalId,o.sku,o.gtin,o.ean,o.id];
    const dodatkowe=zZamowien.get(String(o.id||""));
    if(dodatkowe) kody.push(...dodatkowe);
    let produkt=null, kod="";
    for(const k of kody){
      for(const klucz of allegroKluczeKodu(k)){
        const p=indeks.get(klucz);
        if(p){ produkt=p; kod=klucz; break; }
      }
      if(produkt) break;
    }
    if(!produkt){
      const nazwy=[o.name];
      if(dodatkowe) nazwy.push(...[...dodatkowe].filter(x=>!allegroKluczeKodu(x).length || String(x).length>18));
      for(const n of nazwy){
        produkt=allegroDopasujProduktPoNazwie(n,produktyLista);
        if(produkt){ kod="nazwa"; break; }
      }
    }
    if(produkt) wyniki.push({offerId:String(o.id), productId:String(produkt.id), produkt, oferta:o, kod});
  });
  return wyniki;
}
async function allegroAutomapujOfertyLegacy(){
  const sugestie=allegroSugestieAutomapowania();
  if(!sugestie.length){ toast("Brak pewnych dopasowań po kodach lub nazwach Allegro"); return; }
  if(!confirm(`Automatycznie podpiąć ${sugestie.length} ofert Allegro po pewnych kodach/nazwach do produktów sklepu?`)) return;
  let ok=0, bledy=0, ostatnie=null;
  toast(`Mapuję oferty Allegro: ${sugestie.length}…`);
  for(const s of sugestie){
    try{
      ostatnie=await chmura("allegro-map-offer",{method:"POST",body:{offerId:s.offerId,productId:s.productId},timeout:12000});
      ok++;
    }catch(e){ bledy++; }
  }
  if(ostatnie?.mappings&&typeof ostatnie.mappings==="object") allegroMapowania=ostatnie.mappings;
  await allegroWczytajDane(true);
  allegroZapiszCache();
  toast(`Automapowanie Allegro: podpięto ${ok}${bledy?`, błędy: ${bledy}`:""}`);
  renderuj();
}
function allegroStatusHTML(){
  if(!allegroStan.sprawdzono && allegroStan.ladowanie) return `<span class="lvl lvl-info">sprawdzam API</span>`;
  if(allegroStan.connected&&allegroStan.requiresReauth) return `<span class="lvl lvl-ostrzezenie">połączone — brak części uprawnień</span>`;
  if(allegroStan.connected) return `<span class="lvl lvl-ok">połączone</span>`;
  if(allegroStan.configured) return `<span class="lvl lvl-ostrzezenie">wymaga autoryzacji</span>`;
  return `<span class="lvl lvl-bad">brak konfiguracji</span>`;
}
function allegroLadujJesliTrzeba(){
  if(allegroStan.sprawdzono || allegroStan.ladowanie) return;
  allegroStan={...allegroStan,ladowanie:true};
  setTimeout(()=>allegroWczytajDane(true),0);
}
async function allegroWczytajDane(cicho=false,odswiezWidok=true){
  let ok=false;
  try{
    const d=await chmura("allegro-data",{timeout:16000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:"",offerDefaultsAudit:d.offerDefaultsAudit||{items:{},updated_at:null},catalogMaintenance:d.catalogMaintenance||allegroStan.catalogMaintenance||{cursor:0,lastRun:null},complianceAudit:d.complianceAudit||allegroStan.complianceAudit||{items:[],summary:{},updated_at:null},offerSettings:d.offerSettings||allegroStan.offerSettings||{defaultStock:5,republish:true,producers:["Alexander","Multigra","GoDan"],autoCatalog:true,syncDescriptions:true,autoUpdateOffers:true,autoFees:true,autoCorrections:true,updated_at:null}};
    allegroZamowienia=Array.isArray(d.orders)?d.orders:[];
    allegroOferty=Array.isArray(d.offers)?d.offers:[];
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:{};
    if(d.offerLastError) allegroOstatniBladWystawienia={message:d.offerLastError.message,allegroError:{errors:d.offerLastError.errors||[]},...d.offerLastError};
    if(Array.isArray(d.threads)||Array.isArray(d.issues)) allegroKomunikacja={...allegroKomunikacja,threads:Array.isArray(d.threads)?d.threads:allegroKomunikacja.threads,issues:Array.isArray(d.issues)?d.issues:allegroKomunikacja.issues,settings:d.settings||allegroKomunikacja.settings,autoReplies:d.autoReplies||allegroKomunikacja.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:allegroKomunikacja.errors,requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||allegroKomunikacja.updated_at,sprawdzono:true};
    allegroZapiszCache();
    ok=true;
    if(!cicho) toast("Dane Allegro odświeżone");
  }catch(e){
    allegroStan={...allegroStan,sprawdzono:true,ladowanie:false,error:e.message||String(e)};
    if(!cicho) toast("⚠️ Allegro: "+allegroStan.error);
  }
  if(odswiezWidok)renderuj();
  return ok;
}
function allegroAktywneIdDoOdswiezenia(){return new Set((allegroZamowienia||[]).filter(allegroZamowienieAktywneLokalnie).map(z=>String(z.id||z.nr||"")).filter(Boolean));}
function allegroOfertaIdDoOdswiezenia(){return new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean));}
function allegroKomunikacjaKluczeDoOdswiezenia(type="thread"){const list=type==="issue"?(allegroKomunikacja?.issues||[]):(allegroKomunikacja?.threads||[]);return new Set(list.filter(allegroKomunikacjaWymagaOdpowiedzi).map(x=>{const id=String(x.id||""),last=x.latestNewIncoming||x.lastMessage||{},marker=String(x.latestNewIncomingKey||last.id||last.createdAt||x.newIncomingCount||"");return id?`${id}:${marker}`:"";}).filter(Boolean));}
function allegroNoweIdPoOdswiezeniu(przed,po){let n=0;for(const id of po)if(!przed.has(id))n++;return n;}
async function allegroOdswiezDaneZSerweraJesliCzas(powod="timer"){
  if(allegroAutoOdswiezanie.busy||typeof jestAdmin!=="function"||!jestAdmin())return false;
  if(typeof document!=="undefined"&&document.hidden&&powod==="timer")return false;
  const teraz=Date.now(),minimalnyOdstep=ALLEGRO_ODSWIEZANIE_PANELU_MS;
  if(teraz-Number(allegroAutoOdswiezanie.lastChecked||0)<minimalnyOdstep)return false;
  const mialDane=!!allegroStan.sprawdzono,przedOrders=allegroAktywneIdDoOdswiezenia(),przedOffers=allegroOfertaIdDoOdswiezenia(),przedThreads=allegroKomunikacjaKluczeDoOdswiezenia("thread"),przedIssues=allegroKomunikacjaKluczeDoOdswiezenia("issue");
  allegroAutoOdswiezanie={...allegroAutoOdswiezanie,busy:true,error:""};
  const ok=await allegroWczytajDane(true,false);
  const orders=ok?allegroNoweIdPoOdswiezeniu(przedOrders,allegroAktywneIdDoOdswiezenia()):0,offers=ok?allegroNoweIdPoOdswiezeniu(przedOffers,allegroOfertaIdDoOdswiezenia()):0,threads=ok?allegroNoweIdPoOdswiezeniu(przedThreads,allegroKomunikacjaKluczeDoOdswiezenia("thread")):0,issues=ok?allegroNoweIdPoOdswiezeniu(przedIssues,allegroKomunikacjaKluczeDoOdswiezenia("issue")):0,changed=orders+offers+threads+issues;
  allegroAutoOdswiezanie={busy:false,lastChecked:Date.now(),lastChanged:changed?Date.now():allegroAutoOdswiezanie.lastChanged,orders,threads,issues,offers,error:ok?"":allegroStan.error||"Nie udało się odświeżyć danych"};
  if(ok&&mialDane&&changed)toast(`🟠 Allegro: zlecenia ${orders} • wiadomości ${threads} • dyskusje ${issues} • oferty ${offers}`);
  return ok;
}
async function allegroPolacz(){
  try{
    const d=await chmura("allegro-auth-url",{timeout:12000});
    if(!d.url) throw new Error("Serwer nie zwrócił linku autoryzacji Allegro");
    location.href=d.url;
  }catch(e){ toast("⚠️ Allegro: "+(e.message||e)); }
}
async function allegroSynchronizujZamowienia(){
  try{
    toast("Pobieram zamówienia Allegro i uruchamiam kontrolę magazynową agenta…");
    await chmuraZapiszUstawienia().catch(()=>false);
    const d=await chmura("allegro-sync-orders",{method:"POST",body:{limit:1000},timeout:120000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    await chmuraWczytajStan();
    allegroZapiszCache();
    toast(`Agent Allegro: nowe ${d.imported_new||0} • sprawdzone ${d.agent?.reviewed||0} • gotowe ${d.agent?.ready||0} • nowe do automatyzacji ${d.agent?.autoEligible||0} • braki dopisane ${d.agent?.shortagesAdded||0} • cały rejestr ${allegroZamowienia.length}`);
    renderuj();
  }catch(e){ toast("⚠️ Allegro zamówienia: "+(e.message||e)); }
}
async function allegroOznaczZamowienieSprawdzone(orderId,checked=true){
  try{
    const orderIds=Array.isArray(orderId)?orderId:[orderId];
    const d=await chmura("allegro-order-checked",{method:"POST",body:{orderIds,checked},timeout:30000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia.map(z=>String(z.id)===String(orderId)?d.order:z);
    orderIds.forEach(id=>zaznaczoneAllegroZamowienia.delete(String(id)));
    allegroZapiszCache();
    toast(checked?`Oznaczono jako sprawdzone: ${d.changed||orderIds.length} zleceń.`:`Przywrócono do obsługi: ${d.changed||orderIds.length} zleceń.`);
    renderuj();
  }catch(e){ toast("⚠️ Status obsługi Allegro: "+(e.message||e)); }
}
function allegroPrzelaczZaznaczenieZamowienia(orderId,checked){
  const id=String(orderId||"");
  if(!id)return;
  if(checked)zaznaczoneAllegroZamowienia.add(id);else zaznaczoneAllegroZamowienia.delete(id);
  renderuj();
}
function allegroWyczyscZaznaczenieZamowien(){
  zaznaczoneAllegroZamowienia.clear();
  renderuj();
}
function allegroEksportujZamowienia(zakres="filtr"){
  const selected=new Set([...zaznaczoneAllegroZamowienia].map(String));
  const lista=allegroPasujaceZamowienia().filter(z=>zakres!=="zaznaczone"||selected.has(String(z.id)));
  const rows=lista.map(z=>[z.id||z.nr||"",allegroStatusKolejki(z),z.email||"",z.buyerLogin||"",z.buyerName||"",z.phone||"",z.createdAt||z.data||"",z.warehouseStage||"",(z.lineItems||[]).map(it=>`${it.offerId||""} | ${it.offerName||it.name||""} | ${it.quantity||0} szt.`).join(" || ")]);
  adminEksportujCSV(zakres==="zaznaczone"?"allegro-zamowienia-zaznaczone.csv":"allegro-zamowienia-filtrowane.csv",["id_zlecenia","status_allegro","email","login","klient","telefon","data","etap_magazynu","pozycje"],rows);
}
function allegroOznaczZaznaczoneSprawdzone(checked=true){
  const ids=[...zaznaczoneAllegroZamowienia];
  if(!ids.length){toast("Zaznacz co najmniej jedno zlecenie");return;}
  allegroOznaczZamowienieSprawdzone(ids,checked);
}
async function allegroZmienStatusRealizacji(orderId,status){
  try{
    const d=await chmura("allegro-order-fulfillment",{method:"POST",body:{orderId,status},timeout:18000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia.map(z=>String(z.id)===String(orderId)?d.order:z);
    allegroZapiszCache();
    toast(`Status zamówienia zmieniony w Allegro: ${status}`);
    renderuj();
  }catch(e){ toast("⚠️ Zmiana statusu Allegro: "+(e.message||e)); }
}
async function allegroSynchronizujOferty(){
  try{
    toast("Pobieram wszystkie oferty Allegro — kolejne strony po 1000…");
    const d=await chmura("allegro-sync-offers",{method:"POST",body:{limit:10000,details:true,detailsLimit:1000},timeout:180000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    await chmuraWczytajStan().catch(()=>{});
    allegroZapiszCache();
    toast(`Pobrano oferty Allegro: ${allegroOferty.length} • szczegóły: ${d.detailedCount||0} • nowe automatyczne powiązania: ${d.autoMapped||0}`);
    renderuj();
  }catch(e){ toast("⚠️ Allegro oferty: "+(e.message||e)); }
}
function allegroUstawieniaKomunikacjiDomyslne(){
  return {
    enabled:true,
    messageCenter:true,
    issues:true,
    freshHours:48,
    template:"Dzień dobry,\n\ndziękujemy za wiadomość. Potwierdzamy, że zgłoszenie trafiło do obsługi Artway-TM. Odpowiemy możliwie jak najszybciej.\n\nPozdrawiamy\nArtway-TM"
  };
}
function allegroKomunikacjaUstawienia(){
  return {...allegroUstawieniaKomunikacjiDomyslne(), ...(allegroKomunikacja?.settings||{})};
}
async function allegroWczytajKomunikacje(cicho=false){
  try{
    const d=await chmura("allegro-communications-data",{timeout:16000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroKomunikacja={threads:Array.isArray(d.threads)?d.threads:[],issues:Array.isArray(d.issues)?d.issues:[],settings:d.settings||allegroUstawieniaKomunikacjiDomyslne(),autoReplies:d.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:[],requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||null,lastSyncSummary:d.lastSyncSummary||null,autoRepliesUpdatedAt:d.autoRepliesUpdatedAt||null,sprawdzono:true};
    allegroZapiszCache();
    if(!cicho) toast("Wczytano komunikację Allegro");
  }catch(e){ allegroStan={...allegroStan,error:e.message||String(e)};allegroKomunikacja={...allegroKomunikacja,sprawdzono:true}; if(!cicho) toast("⚠️ Komunikacja Allegro: "+(e.message||e)); }
  renderuj();
}
async function allegroSynchronizujKomunikacje(autoReply=true){
  try{
    toast(autoReply?"Synchronizuję Allegro i wysyłam brakujące pierwsze odpowiedzi…":"Synchronizuję komunikację Allegro…");
    const d=await chmura("allegro-sync-communications",{method:"POST",body:{limit:100,autoReply},timeout:120000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroKomunikacja={threads:Array.isArray(d.threads)?d.threads:[],issues:Array.isArray(d.issues)?d.issues:[],settings:d.settings||allegroKomunikacjaUstawienia(),autoReplies:d.autoReply?.items||allegroKomunikacja.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:[],requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||null,lastSyncSummary:d.syncSummary||d.lastSyncSummary||null,autoReply:d.autoReply||null,sprawdzono:true};
    allegroZapiszCache();
    const summary=d.syncSummary||{},newCount=Number(summary.newBuyerMessages||0),sent=Number(d.autoReply?.sent?.length||0);
    toast(newCount?`Allegro: ${newCount} ${newCount===1?"nowa wiadomość klienta":"nowych wiadomości klientów"} • wątki ${summary.newThreads||0} • dyskusje ${summary.newIssues||0}${sent?` • pierwsze odpowiedzi ${sent}`:""}`:`Allegro: brak nowych wiadomości klientów${sent?` • pierwsze odpowiedzi ${sent}`:""}`);
  }catch(e){ toast("⚠️ Synchronizacja komunikacji Allegro: "+(e.message||e)); }
  renderuj();
}
async function allegroSynchronizujWszystko(){
  try{
    toast("Uruchamiam pełną synchronizację Allegro…");
    await allegroSynchronizujZamowienia();
    await allegroSynchronizujOferty();
    await allegroSynchronizujKomunikacje(true);
    toast("Pełna synchronizacja Allegro zakończona ✅");
  }catch(e){toast("⚠️ Pełna synchronizacja Allegro: "+(e.message||e));}
}
async function allegroZapiszUstawieniaKomunikacji(form){
  const fd=new FormData(form);
  const settings={
    enabled:fd.get("enabled")==="on",
    messageCenter:fd.get("messageCenter")==="on",
    issues:fd.get("issues")==="on",
    telegramReminders:fd.get("telegramReminders")==="on",
    freshHours:Number(fd.get("freshHours")||48),
    template:String(fd.get("template")||"").trim()
  };
  try{
    const d=await chmura("allegro-communications-settings",{method:"POST",body:{settings},timeout:12000});
    allegroKomunikacja={...allegroKomunikacja,settings:d.settings||settings};
    allegroZapiszCache();
    toast("Zapisano ustawienia autorespondera Allegro");
    renderuj();
  }catch(e){ toast("⚠️ Ustawienia komunikacji Allegro: "+(e.message||e)); }
}
async function allegroMapujOferte(offerId, productId, options={}){
  try{
    const id=String(productId||"").trim();
    const d=await chmura(id?"allegro-map-offer":"allegro-unmap-offer",{method:"POST",body:{offerId,productId:id,force:options.force===true,replaceExisting:options.replaceExisting===true},timeout:45000});
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    rezerwacjeMagazynowe._cache=null;
    if(id)await chmuraWczytajStan().catch(()=>{});
    allegroZapiszCache();
    toast(id?`Połączono ofertę z produktem sklepu${d.validation?.score?` • pewność ${d.validation.score}%`:""}`:"Powiązanie produktu zostało usunięte");
    renderuj();
    return {ok:true,data:d};
  }catch(e){allegroMapowaniePozycjiCel={...allegroMapowaniePozycjiCel,error:e};toast("⚠️ Mapowanie Allegro: "+(e.message||e));return {ok:false,error:e};}
}
async function allegroDodajProduktZOferty(offerId){
  const o=allegroOferty.find(x=>String(x.id)===String(offerId));
  if(!o){ toast("Nie znaleziono oferty Allegro"); return; }
  const maxId=Math.max(0,...prodBazowe.map(p=>Number(p.id)||0),...produktyDodane.map(p=>Number(p.id)||0));
  const id=maxId+1;
  const cena=kwotaNum(o.price?.amount ?? o.price ?? 0);
  const KOLORY=["#dbeafe","#e0e7ff","#fef3c7","#dcfce7","#fee2e2","#f3e8ff","#fce7f3","#ffedd5"];
  const p={
    id,
    nazwa:o.name||`Oferta Allegro ${o.id}`,
    kategoria:"Allegro",
    cena,
    opis:`Produkt utworzony z oferty Allegro ${o.id}. Uzupełnij opis, zdjęcia i kategorię docelową w Asortymencie.`,
    ikona:"🟠",
    badge:"Allegro",
    kolor:KOLORY[id%KOLORY.length],
    sku:String(o.externalId||o.id||"").trim(),
    externalId:String(o.externalId||o.id||"").trim(),
    gtin:String(o.gtin||o.ean||"").trim(),
    ean:String(o.ean||o.gtin||"").trim(),
    mpn:String(o.manufacturerCode||o.producerCode||"").trim(),
    kodProducenta:String(o.manufacturerCode||o.producerCode||"").trim(),
    producent:String(o.brand||"").trim(),
    marka:String(o.brand||"").trim(),
    zdjecie:o.mainImage||((o.images||[])[0])||"",
    zdjecia:(o.images||[]).slice(1,16),
    allegroOfferId:String(o.id||"").trim(),
    allegroCategoryId:String(o.categoryId||"").trim(),
    allegroProductId:String(o.productId||"").trim(),
    allegroShippingSubsidy:ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI,
    createdAt:new Date().toISOString(),
    createdBy:sesja?.email||"administrator",
    agentOnboardingStatus:"processing",
    agentOnboardingStartedAt:new Date().toISOString()
  };
  if(o.descriptionText) p.opis=o.descriptionText;
  const poprawiony=agentAIPoprawOpisyDanychProduktu(p);
  produktyDodane.push(poprawiony);
  zapiszLS("artway_produkty_dodane",produktyDodane);
  zbudujProdukty();
  await allegroMapujOferte(o.id,id);
  const onboardingProduct=pobierzProduktAdmin(id)||poprawiony,onboardingState=agentAIStanWdrozeniaProduktu(onboardingProduct),onboardingStatus=onboardingState.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie produktu utworzonego z Allegro: ${poprawiony.nazwa}`,{produktId:id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  toast("Produkt utworzony z Allegro i podpięty");
}
function produktDlaAllegroZFormularza(form,id,poprzedni={}){
  const fd=new FormData(form);
  const dane=daneProduktuZFormularza(fd,id,poprzedni);
  if(!dane){ toast("⚠️ Uzupełnij poprawną nazwę i cenę produktu"); return null; }
  return dane;
}
function produktRoboczyAllegroZFormularza(form,id,poprzedni={}){
  const fd=new FormData(form);
  const pelny=daneProduktuZFormularza(fd,id,poprzedni);
  if(pelny) return pelny;
  const cena=parseFloat(String(fd.get("cena")||poprzedni.cena||"0").replace(",","."));
  const cenaAllegro=parseFloat(String(fd.get("cenaAllegro")||poprzedni.cenaAllegro||"0").replace(",","."));
  const cenaZakupu=parseFloat(String(fd.get("cenaZakupu")||poprzedni.cenaZakupu||"0").replace(",","."));
  const p={...poprzedni,id,nazwa:String(fd.get("nazwa")||poprzedni.nazwa||"").trim(),kategoria:String(fd.get("kategoria")||poprzedni.kategoria||"").trim(),cena:Number.isFinite(cena)?cena:0,...(cenaAllegro>0?{cenaAllegro:+cenaAllegro.toFixed(2)}:{}),...(cenaZakupu>=0&&String(fd.get("cenaZakupu")||"").trim()?{cenaZakupu:+cenaZakupu.toFixed(2)}:{}),opisKrotki:String(fd.get("opisKrotki")||poprzedni.opisKrotki||"").trim(),opis:String(fd.get("opis")||poprzedni.opis||"").trim()};
  for(const [pole,nazwa] of [["gtin","gtin"],["ean","gtin"],["externalId","externalId"],["mpn","mpn"],["producent","producent"],["marka","marka"],["kodProducenta","kodProducenta"],["allegroCategoryId","allegroCategoryId"],["allegroProductId","allegroProductId"],["allegroOfferId","allegroOfferId"],["allegroCategoryPhrase","allegroCategoryPhrase"],["sourceUrl","sourceUrl"],["producentUrl","producentUrl"]]){
    const v=String(fd.get(nazwa)||poprzedni[pole]||"").trim();
    if(v)p[pole]=v;
  }
  const zdjecie=String(fd.get("zdjecie")||poprzedni.zdjecie||"").trim();
  if(zdjecie)p.zdjecie=zdjecie;
  const zdjecia=Array.from({length:15},(_,i)=>String(fd.get("zdjecie"+(i+2))||"").trim()).filter(Boolean);
  if(zdjecia.length)p.zdjecia=zdjecia;
  return p;
}
function allegroKategorieHTML(d){
  const selected=d?.selected||null;
  const suggestions=Array.isArray(d?.suggestions)?d.suggestions:[];
  if(!selected&&!suggestions.length&&!d?.errors?.length) return "";
  const row=(c,main=false)=>`<div class="allegro-category-row ${main?"main":""}">
    <div><b>${main?"✅ Dobrana kategoria: ":""}${esc(c.name||"—")}</b><br><small>ID: ${esc(c.id||"—")}${c.pathText?` • ${esc(c.pathText)}`:""}${c.leaf===false?" • niekońcowa":""}</small></div>
    <button class="btn ghost" type="button" onclick="allegroUstawKategorieWFormularzu(${jsArg(c.id)})">Wybierz</button>
  </div>`;
  return `<div class="backend-note allegro-category-box">
    ${selected?row(selected,true):`<b>Nie udało się automatycznie dobrać kategorii.</b>`}
    ${suggestions.length>1?`<details style="margin-top:.55rem"><summary>Inne pasujące kategorie (${suggestions.length})</summary>${suggestions.slice(0,10).map(c=>row(c,false)).join("")}</details>`:""}
    ${d?.errors?.length?`<small style="color:var(--muted2)">Część zapytań Allegro nie zwróciła danych: ${esc(d.errors.map(e=>e.phrase).join(", "))}</small>`:""}
  </div>`;
}
function allegroDraftDiagnostykaHTML(d={},msg="",brak=""){
  const sc=d.salesConditions||{};
  const defs=sc.defaults||{};
  const params=Array.isArray(d.categoryParameters)?d.categoryParameters:[];
  const supportErrors=Array.isArray(d.supportErrors)?d.supportErrors:[];
  const allegroErrors=Array.isArray(d.allegroError?.errors)?d.allegroError.errors:[];
  const autoParams=Array.isArray(d.draft?.parameters)?d.draft.parameters:[];
  const required=Array.isArray(d.requiredParameters)?d.requiredParameters:[];
  const catalog=d.catalogMatch?.selected||null;
  return `<div class="backend-note">
    <b>${esc(msg||"Podgląd szkicu Allegro")}</b><br>
    Operacja: <b>${d.operation==="update"?`aktualizacja istniejącej oferty ${esc(d.existingOffer?.offer?.id||"")}`:"utworzenie nowej oferty"}</b>${d.existingOffer?.reason?` • dopasowanie: ${esc(d.existingOffer.reason)}`:""}<br>
    Krótki opis: <b>${esc(d.improvedDescriptions?.shortDescription||"przygotowany z danych produktu")}</b><br>
    Katalog Allegro: <b>${catalog?`${esc(catalog.name)} • ID ${esc(catalog.id)}`:"nie znaleziono produktu — wymagane pełne parametry"}</b><br>
    Braki bazowe: ${esc(brak||"brak")}<br>
    Warunki sprzedaży: cennik dostawy <b>${esc(defs.shippingRateId||"domyślny/brak")}</b>, zwroty <b>${esc(defs.returnPolicyId||"domyślne/brak")}</b>, reklamacje <b>${esc(defs.impliedWarrantyId||"domyślne/brak")}</b>, gwarancja <b>${esc(defs.warrantyId||"domyślna/brak")}</b><br>
    Parametry kategorii pobrane z Allegro: <b>${esc(params.length)}</b>; automatycznie dopisane do szkicu: <b>${esc(autoParams.length)}</b>.
    ${supportErrors.length?`<div style="margin-top:.5rem;color:#9a3412"><b>Uwagi API:</b><br>${supportErrors.map(e=>`• ${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}`).join("<br>")}</div>`:""}
    ${allegroErrors.length?`<div style="margin-top:.5rem;color:#991b1b"><b>Błąd Allegro:</b><br>${allegroErrors.map(e=>`• ${esc(e.userMessage||e.message||e.code||"błąd")}${e.path?` <small>(${esc(e.path)})</small>`:""}`).join("<br>")}</div>`:""}
    ${required.length?`<div class="allegro-required-params"><h4>Uzupełnij wymagane parametry Allegro</h4><p>Produkt nie został znaleziony w katalogu po EAN. Te pola są wymagane do utworzenia nowego produktu.</p>${required.map(p=>`<label><span>${esc(p.name)}${p.unit?` (${esc(p.unit)})`:""}</span>${Array.isArray(p.dictionary)&&p.dictionary.length?`<select name="allegroParam_${esc(p.id)}" data-param-type="dictionary" required><option value="">— wybierz —</option>${p.dictionary.map(v=>`<option value="${esc(v.id||v.valueId||v.value)}">${esc(v.value||v.name||v.label)}</option>`).join("")}</select>`:`<input name="allegroParam_${esc(p.id)}" placeholder="${esc(p.name)}" required>`}</label>`).join("")}</div>`:""}
    <details><summary>Podgląd JSON wysyłany do Allegro</summary><pre style="white-space:pre-wrap;font-size:.75rem">${esc(JSON.stringify(d.draft||d,null,2))}</pre></details>
  </div>`;
}
function allegroUstawKategorieWFormularzu(id){
  const form=document.querySelector("form.product-editor-form");
  if(!form?.elements?.allegroCategoryId){ toast("Nie znaleziono pola kategorii Allegro"); return; }
  form.elements.allegroCategoryId.value=String(id||"").trim();
  toast("🟠 Ustawiono kategorię Allegro: "+String(id||""));
}
function allegroPokazKategorieWFormularzu(d){
  const box=document.getElementById("allegroCategoryPreview");
  if(box) box.innerHTML=allegroKategorieHTML(d);
  const id=d?.selected?.id;
  const form=document.querySelector("form.product-editor-form");
  if(id&&form?.elements?.allegroCategoryId&&!String(form.elements.allegroCategoryId.value||"").trim()) form.elements.allegroCategoryId.value=String(id);
}
async function allegroDobierzKategorieProduktu(id=0,btn=null){
  const form=document.querySelector("form.product-editor-form");
  if(!form){ toast("Nie znaleziono formularza produktu"); return; }
  const poprzedni=id?pobierzProduktAdmin(Number(id))||{}:{};
  const product=produktRoboczyAllegroZFormularza(form,id,poprzedni);
  const phrase=String(form.elements.allegroCategoryPhrase?.value||"").trim();
  if(!phrase&&!String(product.nazwa||"").trim()&&!String(product.kategoria||"").trim()){ toast("Podaj nazwę produktu albo frazę do katalogu Allegro"); return; }
  try{
    if(btn)btn.disabled=true;
    toast("🟠 Szukam kategorii w katalogu Allegro…");
    const d=await chmura("allegro-category-suggest",{method:"POST",body:{product,phrase,limit:10},timeout:18000});
    allegroPokazKategorieWFormularzu(d);
    toast(d.selected?.id?`🟠 Dobrano kategorię Allegro: ${d.selected.name} (${d.selected.id})`:"⚠️ Allegro nie zwróciło pasującej kategorii");
  }catch(e){ toast("⚠️ Kategorie Allegro: "+(e.message||e)); }
  finally{ if(btn)btn.disabled=false; }
}
function allegroZapiszKategorieProduktu(id,categoryId){
  if(!id||!categoryId) return false;
  const p=pobierzProduktAdmin(Number(id));
  if(p?.allegroCategoryId) return false;
  produktyEdytowane[id]={...(produktyEdytowane[id]||{}),allegroCategoryId:String(categoryId)};
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zbudujProdukty();
  return true;
}
function allegroTrybPublikacji(){ return String(document.getElementById("allegroPublicationAction")?.value||"keep"); }
function allegroListaProducentow(){
  const ustawione=Array.isArray(allegroStan.offerSettings?.producers)&&allegroStan.offerSettings.producers.length?allegroStan.offerSettings.producers:["Alexander","Multigra","GoDan"];
  return [...new Set([...ustawione,...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>p.name||p.nazwa)].map(x=>String(x||"").trim()).filter(Boolean))];
}
function allegroProducentKanoniczny(p={}){
  const list=allegroListaProducentow(),norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const text=norm([p.producent,p.marka,p.nazwa,p.name,p.sourceUrl,p.producentUrl].filter(Boolean).join(" "));
  const direct=list.find(name=>text.includes(norm(name)));if(direct)return direct;
  const find=name=>list.find(x=>norm(x)===norm(name))||"";
  if(/alexander|sklep alexander|origami 3d|maly konstruktor|constructor junior|zlotowki/.test(text))return find("Alexander");
  if(/multigra/.test(text))return find("Multigra");
  if(/go dan|godan|godanparty/.test(text))return find("GoDan");
  return "";
}
function zapiszPolaProduktuLokalnie(id,fields={},tylkoBrakujace=false){
  const key=String(id),idx=produktyDodane.findIndex(x=>String(x.id)===key),base=idx>=0?produktyDodane[idx]:(produktyEdytowane[key]||{}),next={...base};let changed=false;
  for(const [field,value] of Object.entries(fields)){if(value===undefined||value===null||value==="")continue;if(tylkoBrakujace&&(next[field]!==undefined&&next[field]!==null&&String(next[field]).trim()!==""))continue;if(JSON.stringify(next[field])!==JSON.stringify(value)){next[field]=value;changed=true;}}
  if(!changed)return false;
  if(idx>=0){produktyDodane[idx]=next;zapiszLS("artway_produkty_dodane",produktyDodane);}else{produktyEdytowane={...produktyEdytowane,[key]:next};zapiszLS("artway_produkty_edytowane",produktyEdytowane);}
  zbudujProdukty();return true;
}
function allegroZastosujWynikWystawienia(p,d={}){
  const id=String(d.offer?.id||p.allegroOfferId||"").trim();
  if(!id)return;
  const old=allegroOfertaPoId(id)||{};
  const publication=d.offer?.publication||{};
  const next={...old,...d.offer,id,name:d.offer?.name||p.nazwa||old.name,externalId:d.offer?.external?.id||p.externalId||p.sku||old.externalId||"",ean:p.gtin||p.ean||old.ean||"",gtin:p.gtin||p.ean||old.gtin||"",manufacturerCode:p.kodProducenta||p.mpn||old.manufacturerCode||"",categoryId:d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||old.categoryId||"",priceText:d.offer?.sellingMode?.price?`${String(d.offer.sellingMode.price.amount).replace(".",",")} ${d.offer.sellingMode.price.currency||"PLN"}`:old.priceText||zl(p.cena),status:publication.status||old.status||(allegroTrybPublikacji()==="activate"?"ACTIVE":"INACTIVE"),mainImage:d.offer?.images?.[0]||p.zdjecie||old.mainImage||"",images:(d.offer?.images||[p.zdjecie,...(p.zdjecia||[])]).filter(Boolean)};
  allegroOferty=[next,...allegroOferty.filter(o=>String(o.id)!==id)];
  allegroMapowania={...allegroMapowania,[id]:{offerId:id,productId:String(p.id),operator:"auto-offer-save"}};
  allegroZapiszCache();
}
function allegroZapiszWynikOperacji(p,d={}){
  const offerId=String(d.offer?.id||p.allegroOfferId||"").trim();
  allegroOstatniWynikWystawienia={
    produktId:String(p.id??""),produktNazwa:p.nazwa||p.name||"Produkt",offerId,
    mode:d.mode||"updated",status:d.offer?.publication?.status||d.offer?.status||"INACTIVE",
    duplicatePrevented:!!d.duplicatePrevented,reason:d.match?.reason||d.existingOffer?.reason||"",
    catalogId:d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"",
    categoryId:d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||"",
    at:new Date().toISOString()
  };
  return allegroOstatniWynikWystawienia;
}
function allegroWynikOperacjiHTML(){
  const w=allegroOstatniWynikWystawienia;if(!w?.offerId)return "";
  const updated=w.mode==="updated";
  return `<div class="duplicate-audit-ok allegro-operation-success"><div><b>✅ ${updated?"Oferta została znaleziona i zaktualizowana":"Oferta została utworzona"}</b><small>${esc(w.produktNazwa)} • ID oferty ${esc(w.offerId)} • status ${esc(w.status)}${w.duplicatePrevented?" • nie utworzono duplikatu":""}</small><small>Produkt katalogowy: ${esc(w.catalogId||"—")} • kategoria: ${esc(w.categoryId||"—")}${w.reason?` • rozpoznano po: ${esc(w.reason)}`:""}</small></div><div class="warehouse-worktable-actions"><button class="btn ghost" onclick="window.open('https://allegro.pl/oferta/${encodeURIComponent(w.offerId)}','_blank','noopener')">Otwórz w Allegro</button><button class="btn ghost" onclick="allegroOstatniWynikWystawienia=null;renderuj()">Zamknij</button></div></div>`;
}
function allegroZapiszAutoUzupelnienia(p,d={}){
  if(!p?.id)return false;
  const auto=d.autoFilled||{},catalog=d.catalogMatch?.selected||{},category=d.categorySuggestion?.selected||{};
  const canonical=allegroProducentKanoniczny({...p,producent:auto.producent||p.producent,marka:auto.marka||p.marka});
  const fields={
    producent:canonical||auto.producent||p.producent||p.marka||"",
    marka:auto.marka||p.marka||canonical||auto.producent||p.producent||"",
    gtin:auto.gtin||auto.ean||(catalog.eans||[])[0]||p.gtin||p.ean||"",
    ean:auto.ean||auto.gtin||(catalog.eans||[])[0]||p.ean||p.gtin||"",
    kodProducenta:auto.kodProducenta||auto.mpn||p.kodProducenta||p.mpn||"",
    mpn:auto.mpn||auto.kodProducenta||p.mpn||p.kodProducenta||"",
    zdjecie:auto.zdjecie||(auto.zdjecia||[])[0]||p.zdjecie||"",
    allegroProductId:auto.allegroProductId||catalog.id||p.allegroProductId||"",
    allegroCategoryId:auto.allegroCategoryId||category.id||catalog.categoryId||p.allegroCategoryId||""
  };
  const improved=d.improvedDescriptions||{},next={allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},force={};let changed=p.allegroShippingSubsidy===undefined;
  for(const [key,value] of Object.entries(fields))if(value&&(!p[key]||(canonical&&key==="producent"&&String(p[key])!==String(value)))){next[key]=String(value);changed=true;}
  const extraImages=(Array.isArray(auto.zdjecia)?auto.zdjecia:[]).filter(Boolean).filter(x=>x!==fields.zdjecie).slice(0,15);
  if(extraImages.length&&!(Array.isArray(p.zdjecia)&&p.zdjecia.length)){next.zdjecia=extraImages;changed=true;}
  if(Array.isArray(auto.allegroParameters)&&auto.allegroParameters.length&&!Array.isArray(p.allegroParameters)){next.allegroParameters=auto.allegroParameters;changed=true;}
  if(improved.shortDescription&&String(improved.shortDescription)!==String(p.opisKrotki||"")){force.opisKrotki=String(improved.shortDescription);changed=true;}
  if(improved.fullDescription&&String(improved.fullDescription)!==String(p.opis||"")){force.opis=String(improved.fullDescription);changed=true;}
  if(Array.isArray(improved.sections)&&improved.sections.length){force.allegroDescriptionSections=improved.sections;changed=true;}
  const form=document.querySelector("form.product-editor-form");
  if(form){
    for(const [key,value] of Object.entries(fields))uzupelnijPoleFormularza(form,key,value,false);
    extraImages.forEach((url,i)=>uzupelnijPoleFormularza(form,"zdjecie"+(i+2),url,false));
    uzupelnijPoleFormularza(form,"opisKrotki",improved.shortDescription,true);
    uzupelnijPoleFormularza(form,"opis",improved.fullDescription,true);
    uzupelnijPoleFormularza(form,"allegroShippingSubsidy",next.allegroShippingSubsidy,false);
  }
  if(canonical){const producerFields={producent:canonical,...(!p.marka&&!auto.marka?{marka:canonical}:{})};if(zapiszPolaProduktuLokalnie(p.id,producerFields,false))changed=true;delete next.producent;if(p.marka||auto.marka)delete next.marka;}
  const missingSaved=Object.keys(next).length?zapiszPolaProduktuLokalnie(p.id,next,true):false;
  const forcedSaved=Object.keys(force).length?zapiszPolaProduktuLokalnie(p.id,force,false):false;
  return missingSaved||forcedSaved||changed;
}
async function allegroPrzygotujSzkicProduktu(id){
  const form=document.querySelector("form.product-editor-form");
  const produkt=id?produktDlaAllegroZFormularza(form,id,pobierzProduktAdmin(id)||{}):null;
  if(!produkt) return;
  try{
    const d=await chmura("allegro-offer-draft",{method:"POST",body:{product:produkt,options:{stock:allegroStanOfertyProduktu(produkt)}},timeout:60000});
    allegroZapiszAutoUzupelnienia(produkt,d);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    const brak=(d.missing||[]).join(", ")||"brak";
    const cat=d.categorySuggestion?.selected;
    const msg=d.ready?(d.operation==="update"?`Znaleziono ofertę ${d.existingOffer?.offer?.id||""} — zostanie zaktualizowana bez duplikatu.`:"Szkic jest gotowy technicznie do wysłania do Allegro."):"Szkic wymaga uzupełnienia: "+brak;
    toast("🟠 Allegro: "+msg);
    const box=document.getElementById("allegroDraftPreview");
    if(box) box.innerHTML=`${allegroKategorieHTML(d.categorySuggestion)}${cat?`<div class="backend-note">Dobrana kategoria: <b>${esc(cat.name)}</b> (${esc(cat.id)})</div>`:""}${allegroDraftDiagnostykaHTML(d,msg,brak)}`;
  }catch(e){ allegroZapiszAutoUzupelnienia(produkt,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProdukt(id){
  const form=document.querySelector("form.product-editor-form");
  const produkt=id?produktDlaAllegroZFormularza(form,id,pobierzProduktAdmin(id)||{}):null;
  if(!produkt) return;
  try{
    const publicationAction=allegroTrybPublikacji();
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:produkt,options:{stock:allegroStanOfertyProduktu(produkt),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(produkt,d);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    allegroZapiszAutoUzupelnienia(produkt,d);
    toast(d.operation?.completed===false?"🟠 Allegro przyjęło operację — kończy przetwarzanie oferty w tle":d.mode==="updated"?`🟠 Zaktualizowano istniejącą ofertę Allegro — ${d.match?.reason||"dopasowanie"}`:"🟠 Utworzono nową ofertę Allegro");
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||form.elements.allegroCategoryId?.value||"";
      produktyEdytowane[id]={...(produktyEdytowane[id]||{}),allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})};
      zapiszLS("artway_produkty_edytowane",produktyEdytowane);
      allegroZastosujWynikWystawienia(produkt,d);
      await allegroPobierzProwizjeProduktu(id,null,{silent:true}).catch(()=>null);
      await chmuraWczytajStan().catch(()=>{});
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      renderuj();
    }
  }catch(e){
    allegroOstatniBladWystawienia=e;
    allegroZapiszAutoUzupelnienia(produkt,e);
    if(e.agentTask)await chmuraWczytajStan().catch(()=>{});
    allegroPokazKategorieWFormularzu(e.categorySuggestion);
    const box=document.getElementById("allegroDraftPreview");
    if(box&&e.draft) box.innerHTML=`${allegroKategorieHTML(e.categorySuggestion)}${allegroDraftDiagnostykaHTML(e,"Nie utworzono oferty: "+(e.message||"błąd Allegro"),(e.missing||[]).join(", ")||"—")}`;
    toast("⚠️ Wystawianie Allegro: "+(e.message||e));
  }
}
function uzupelnijPoleFormularza(form,nazwa,wartosc,overwrite){
  if(wartosc===undefined||wartosc===null||wartosc==="") return;
  const el=form.elements[nazwa];
  if(!el) return;
  if(overwrite||!String(el.value||"").trim()) el.value=wartosc;
}
function agentAIUzupelnijFormularzZLinku(form,p={},d={},overwrite=false,url=""){
  const category=d.storeCategory?.name?d.storeCategory:agentAIDobierzKategorieProduktu(p);p={...p,kategoria:category.name||p.kategoria||""};
  uzupelnijPoleFormularza(form,"nazwa",p.nazwa,overwrite);uzupelnijPoleFormularza(form,"kategoria",p.kategoria,overwrite);uzupelnijPoleFormularza(form,"opisKrotki",p.opisKrotki||agentAIUtworzOpisKrotki(p),overwrite);uzupelnijPoleFormularza(form,"opis",p.opis,overwrite);uzupelnijPoleFormularza(form,"cena",p.cena,overwrite);uzupelnijPoleFormularza(form,"zdjecie",p.zdjecie,overwrite);(p.zdjecia||[]).slice(0,15).forEach((z,i)=>uzupelnijPoleFormularza(form,"zdjecie"+(i+2),z,overwrite));uzupelnijPoleFormularza(form,"gtin",p.gtin||p.ean,overwrite);uzupelnijPoleFormularza(form,"mpn",p.mpn||p.kodProducenta,overwrite);uzupelnijPoleFormularza(form,"kodProducenta",p.kodProducenta||p.mpn,overwrite);uzupelnijPoleFormularza(form,"externalId",p.externalId,overwrite);
  const canonicalProducer=allegroProducentKanoniczny({...p,sourceUrl:p.sourceUrl||url,producentUrl:url});uzupelnijPoleFormularza(form,"marka",p.marka||canonicalProducer||p.producent,overwrite);uzupelnijPoleFormularza(form,"producent",canonicalProducer||p.producent||p.marka,overwrite||!!canonicalProducer);uzupelnijPoleFormularza(form,"rozmiar",p.rozmiar,overwrite);uzupelnijPoleFormularza(form,"dostepnoscProducenta",p.dostepnoscProducenta,overwrite);uzupelnijPoleFormularza(form,"producentUrl",p.producentUrl||p.sourceUrl||url,overwrite);uzupelnijPoleFormularza(form,"sourceUrl",p.sourceUrl||p.producentUrl||url,overwrite);uzupelnijPoleFormularza(form,"allegroCategoryId",p.allegroCategoryId,overwrite);uzupelnijPoleFormularza(form,"allegroProductId",p.allegroProductId,overwrite);for(const field of ["stanProducenta","stanProducentaZrodlo","producentStatus","producentSprawdzonoAt"])uzupelnijPoleFormularza(form,field,p[field],true);if(form.elements.stanProducentaDokladny)form.elements.stanProducentaDokladny.value=p.stanProducentaDokladny?"1":"";
  form.dataset.agentLinkConfidence=String(d.confidence||0);form.dataset.agentLinkSource=String(d.canonicalUrl||d.resolvedUrl||url||"");form.dataset.agentCategoryConfidence=String(category.confidence||0);
  const pg=document.getElementById("podgladZdjecia");if(pg&&form.elements.zdjecie?.value)pg.innerHTML=`<img src="${esc(form.elements.zdjecie.value)}" alt="Podgląd zdjęcia produktu" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:.6rem">`;
  produktDodawanieAktualizuj(form);
  return brakiDanychProducenta(p,d);
}
function agentAIAudytDodaniaHTML(product={},d={}){
  const audit=agentAIOcenaDodaniaProduktu(product,d),dup=audit.blockingDuplicate;
  return `<section class="product-link-add-audit"><div class="product-link-add-score"><span>Gotowość danych</span><b>${esc(audit.score)}%</b><small>${audit.ready?"formularz jest gotowy do Twojego zatwierdzenia":dup?`dane ${audit.dataScore}%, znaleziono możliwy duplikat`:"najpierw wykonaj wskazane czynności"}</small></div><div class="product-link-add-steps">${[["Link",!d.needsChoice,"źródło rozpoznane"],["Tożsamość",!!(product.gtin||product.ean||product.mpn||product.kodProducenta),"EAN lub kod producenta"],["Dane sklepu",!!(product.nazwa&&Number(product.cena)>0&&audit.product.kategoria),"nazwa, cena i kategoria"],["Duplikaty",!dup,dup?`produkt #${dup.product.id}`:"brak pewnego duplikatu"],["Zatwierdzenie",false,"decyzja administratora na dole formularza"]].map(([label,ok,note])=>`<span class="${ok?"ok":"wait"}"><b>${ok?"✓":"○"} ${esc(label)}</b><small>${esc(note)}</small></span>`).join("")}</div>${audit.blockers.length?`<div class="backend-note product-link-blockers"><b>Agent wskazuje problem przed zatwierdzeniem:</b> ${esc(audit.blockers.join(" • "))}</div>`:""}${audit.warnings.length?`<div class="backend-note"><b>Do późniejszego uzupełnienia:</b> ${esc(audit.warnings.join(" • "))}</div>`:""}${audit.duplicates.length?`<div class="product-link-duplicates"><b>Możliwe istniejące produkty</b>${audit.duplicates.slice(0,4).map(x=>`<article><span><strong>#${esc(x.product.id)} ${esc(x.product.nazwa||"Produkt")}</strong><small>${esc(x.reasons.join(" • "))} • zgodność ${esc(x.score)}%</small></span><button class="btn ghost" type="button" onclick="location.hash='#/admin/produkty/edytuj/${encodeURIComponent(String(x.product.id))}'">Otwórz</button>${x.blocking?`<button class="btn" type="button" onclick="agentAIAktualizujIstniejacyZAnalizy(${jsArg(x.product.id)},this)">Uzupełnij istniejący</button>`:""}</article>`).join("")}</div>`:""}<div class="diag-actions">${audit.ready?`<button class="btn product-link-agent-add" type="button" onclick="agentAIDodajProduktZAnalizy(this)">Przejdź do zatwierdzenia ↓</button>`:`<button class="btn ghost" type="button" onclick="agentAIPokazPierwszyBrak(this)">Przejdź do brakujących danych</button>`}</div></section>`;
}
function agentAIRaportLinkuHTML(d={},selected=-1){
  const alternatives=Array.isArray(d.alternatives)?d.alternatives:[],attempts=Array.isArray(d.diagnostics?.attempts)?d.diagnostics.attempts:[],candidate=d.needsChoice&&selected>=0?alternatives[selected]:null,product=candidate?.product||d.product||{},sources=candidate?.fieldSources||d.fieldSources||{},missing=candidate?.missing||brakiDanychProducenta(product,d),confidence=candidate?.confidence||d.confidence||0,workflow=d.workflow||{},allegro=d.allegroPreparation||{},category=d.storeCategory||{};
  const preparation=!d.needsChoice?`<div class="product-link-field-grid product-link-channel-readiness"><span class="${workflow.readyForStore?"ok":"missing"}"><small>Sklep</small><b>${workflow.readyForStore?"gotowe do zapisu":"wymaga uzupełnienia"}</b><em>${esc(category.name?`${category.name} • pewność ${category.confidence||0}%`:"brak pewnej kategorii")}</em></span><span class="${workflow.readyForAllegro?"ok":"missing"}"><small>Allegro</small><b>${workflow.readyForAllegro?"szkic przygotowany":"wymaga uzupełnienia"}</b><em>${esc(product.allegroCategoryId?`kategoria ${product.allegroCategoryId}${product.allegroProductId?` • katalog ${product.allegroProductId}`:""}`:(allegro.missing||[]).join(", ")||"brak kategorii")}</em></span><span class="${d.duplicateAudit?.blocking?"missing":"ok"}"><small>Duplikaty</small><b>${d.duplicateAudit?.blocking?"zapis zablokowany":"brak pewnego duplikatu"}</b><em>${esc(d.duplicateAudit?.selected?.productName||"kontrola centralnej bazy zakończona")}</em></span></div>`:"";
  return `<div class="product-link-agent-report ${d.needsChoice&&selected<0?"needs-choice":""}"><header><div><span>🤖 Analiza linku + przygotowanie Allegro</span><h3>${d.needsChoice&&selected<0?`Znaleziono ${alternatives.length} możliwe produkty`:esc(product.nazwa||"Wynik analizy produktu")}</h3><small>Kompletność ${esc(confidence)}% • ${esc(d.fromCache?"pewny wynik z pamięci Agenta":d.diagnostics?.selectedReason||"najpełniejsze dane")}</small></div><span class="lvl ${missing.length?"lvl-ostrzezenie":"lvl-ok"}">${workflow.readyForAllegro?"sklep + Allegro gotowe":missing.length?`${missing.length} uwag`:"komplet danych"}</span></header>${d.fromCache?`<div class="backend-note product-link-cache-note"><b>🧠 Pamięć Agenta:</b> producent chwilowo nie odpowiedział, dlatego użyto ostatniego poprawnego wyniku z ${esc(d.cacheSavedAt?new Date(d.cacheSavedAt).toLocaleString("pl-PL"):"wcześniejszej kontroli")}. Agent nadal zaplanował świeżą kontrolę.</div>`:""}${d.repaired?`<div class="backend-note"><b>Naprawiono lub przekierowano adres:</b> ${esc(d.resolvedUrl||d.canonicalUrl||"")}</div>`:""}${d.needsChoice&&selected<0?`<div class="product-link-candidate-grid">${alternatives.map((c,i)=>`<article>${c.product?.zdjecie?`<img src="${esc(c.product.zdjecie)}" alt="">`:`<span>📦</span>`}<div><b>${esc(c.product?.nazwa||`Wariant ${i+1}`)}</b><small>EAN ${esc(c.product?.ean||c.product?.gtin||"—")} • kod ${esc(c.product?.kodProducenta||c.product?.mpn||"—")}</small><small>${esc(c.confidence||0)}% • braki: ${esc(c.missing?.join(", ")||"brak")}</small><small>${esc(c.url||"")}</small></div><button class="btn" type="button" onclick="agentAIWybierzKandydataZLinku(${i},this)">Wybierz i przygotuj</button></article>`).join("")}</div>`:`${preparation}<div class="product-link-field-grid">${[["Nazwa",product.nazwa,sources.nazwa],["EAN",product.ean||product.gtin,sources.ean],["Kod",product.kodProducenta||product.mpn,sources.kod],["Cena",product.cena?zl(product.cena):"",sources.cena],["Opis",product.opis?`${String(product.opis).length} znaków`:"",sources.opis],["Zdjęcia",[product.zdjecie,...(product.zdjecia||[])].filter(Boolean).length,sources.zdjecia],["Dostępność",product.dostepnoscProducenta,sources.dostepnosc]].map(([label,value,source])=>`<span class="${value!==""&&value!==0?"ok":"missing"}"><small>${label}</small><b>${esc(value||"brak")}</b><em>${esc(source||"uzupełnione przez Agenta/katalog")}</em></span>`).join("")}</div>${agentAIAudytDodaniaHTML(product,{...d,needsChoice:false})}`}<details><summary>Diagnostyka pobierania (${attempts.filter(x=>x.ok).length}/${attempts.length} wariantów poprawnych)</summary><div class="product-link-attempts">${attempts.map(a=>`<span class="${a.ok?"ok":"error"}"><b>${a.ok?"✅":"⚠️"} ${esc(a.reason||"próba")}</b><small>${esc(a.url||"")}</small><small>${a.ok?`HTTP ${esc(a.status)} • ${Math.max(1,Math.round((a.durationMs||0)/1000))} s • ${esc(a.confidence||0)}%`:`${esc(a.error||"błąd")} • ${Math.max(1,Math.round((a.durationMs||0)/1000))} s`}</small></span>`).join("")}</div></details></div>`;
}
async function agentAIWybierzKandydataZLinku(index,button){
  const form=button?.closest("form"),current=agentAIImportUrlStan.data,c=current?.alternatives?.[index];if(!form||!c?.product)return;
  const requested=current.requestedUrl||form.elements.producentUrl?.value||form.elements.sourceUrl?.value||c.url,overwrite=!!form.elements.nadpiszImportUrl?.checked;button.disabled=true;
  try{
    toast("Agent przygotowuje wybrany wariant i katalog Allegro…");
    const d=await chmura("product-url-prepare",{method:"POST",body:{url:requested,choice:index},timeout:90000}),p=d.product||c.product,url=d.canonicalUrl||c.url||requested,braki=agentAIUzupelnijFormularzZLinku(form,p,d,overwrite,url);if(form.elements.producentUrl)form.elements.producentUrl.value=url;if(form.elements.sourceUrl)form.elements.sourceUrl.value=url;agentAIImportUrlStan={busy:false,data:d,selected:index,error:""};
    const box=form.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(d,index);agentAIZapiszLinkProducenta(requested,braki.length?"do uzupełnienia":"pobrano",braki.length?`Wybrano wariant — uwagi: ${braki.join(", ")}`:"Wybrano i przygotowano właściwy wariant",{lastProductName:p.nazwa||"",lastProduct:agentAIProduktZLinkuMini(p),lastMissing:braki,lastCandidates:current.alternatives||[],linkConfidence:d.confidence||c.confidence||0,diagnostics:d.diagnostics||{},resolvedUrl:url,nextRetryAt:null});toast(`✅ Przygotowano: ${p.nazwa||"produkt"} • sklep ${d.workflow?.readyForStore?"gotowy":"do uzupełnienia"} • Allegro ${d.workflow?.readyForAllegro?"gotowe":"do uzupełnienia"}`);
  }catch(e){toast("⚠️ Przygotowanie wariantu: "+(e.message||e));button.disabled=false;}
}
function agentAIWybranyProduktImportu(d={},selected=-1){return d.needsChoice&&selected>=0?d.alternatives?.[selected]?.product||d.product||{}:d.product||{};}
function agentAIPokazPierwszyBrak(button){
  const form=button?.closest("form"),d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected),p=agentAIProduktZFormularzaDoOceny(form,source),audit=agentAIOcenaDodaniaProduktu(p,{...d,needsChoice:selected<0&&d.needsChoice});
  const text=audit.blockers[0]||audit.warnings[0]||"",name=/nazw/i.test(text)?"nazwa":/cen/i.test(text)?"cena":/kategor/i.test(text)?"kategoria":/ean/i.test(text)?"gtin":/kod/i.test(text)?"kodProducenta":/zdję/i.test(text)?"zdjecie":/krótki/i.test(text)?"opisKrotki":/opis/i.test(text)?"opis":"producentUrl",el=form?.elements?.[name];
  if(el){el.focus();el.scrollIntoView({behavior:"smooth",block:"center"});toast(`Uzupełnij: ${text}`);}else toast(text||"Wybierz najpierw właściwy wariant produktu");
}
function agentAIDodajProduktZAnalizy(button){
  const form=button?.closest("form"),d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected),p=agentAIProduktZFormularzaDoOceny(form,source),audit=agentAIOcenaDodaniaProduktu(p,{...d,needsChoice:selected<0&&d.needsChoice});
  if(!audit.ready){toast("Agent zatrzymał dodanie: "+audit.blockers.join(" • "));return;}
  const kontrola=produktDodawanieAktualizuj(form);if(!kontrola?.canSubmit){form?.querySelector("[data-product-add-control]")?.scrollIntoView({behavior:"smooth",block:"start"});toast(kontrola?.potential&&!kontrola.acknowledged?"Najpierw zdecyduj, czy podobna pozycja jest innym produktem":"Najpierw zakończ kontrolę danych i duplikatów");return;}
  form.dataset.agentAdd="1";form.dataset.agentLinkConfidence=String(selected>=0?d.alternatives?.[selected]?.confidence||d.confidence||0:d.confidence||0);const approval=form.querySelector("[data-product-final-approval]");approval?.scrollIntoView({behavior:"smooth",block:"center"});approval?.focus();toast("Dane są gotowe — sprawdź formularz i zatwierdź dodanie produktu");
}
function agentAIAktualizujIstniejacyZAnalizy(id,button){
  const d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected);if(!source?.nazwa){toast("Brak danych analizy do aktualizacji");return;}
  const category=agentAIDobierzKategorieProduktu(source),canonical=allegroProducentKanoniczny(source),fields={...source,kategoria:category.name||source.kategoria||"",producent:canonical||source.producent||source.marka||"",marka:source.marka||canonical||source.producent||"",agentImportAt:new Date().toISOString(),agentImportConfidence:selected>=0?d.alternatives?.[selected]?.confidence||d.confidence||0:d.confidence||0,agentImportSource:d.fromCache?"pamięć Agenta":"link producenta"};delete fields.id;
  zapiszPolaProduktuLokalnie(id,fields,true);const updated=pobierzProduktAdmin(Number(id))||{id,...fields};agentAIZakonczLinkProducenta(updated.sourceUrl||updated.producentUrl,updated);zapiszHistorieAgenta("produkt-z-linku",`Agent uzupełnił istniejący produkt #${id}: ${updated.nazwa||source.nazwa}`,{produktId:id,zrodlo:fields.agentImportSource,confidence:fields.agentImportConfidence});if(chmuraToken)void chmuraZapiszUstawienia();toast("Istniejący produkt uzupełniony — nie utworzono duplikatu");location.hash=`#/admin/produkty/edytuj/${encodeURIComponent(String(id))}`;
}
function agentAIWariantyJednegoLinkuHTML(d={}){
  const alternatives=Array.isArray(d.alternatives)?d.alternatives:[];
  return `<div class="product-link-agent-report needs-choice"><header><div><span>🤖 Agent rozpoznał kilka kart</span><h3>Wybierz właściwy produkt</h3><small>Tylko w tej wyjątkowej sytuacji potrzebna jest jedna decyzja. Po wyborze Agent wykona całą resztę.</small></div><span class="lvl lvl-ostrzezenie">${alternatives.length} możliwości</span></header><div class="product-link-candidate-grid">${alternatives.map((c,i)=>`<article>${c.product?.zdjecie?`<img src="${esc(c.product.zdjecie)}" alt="">`:`<span>📦</span>`}<div><b>${esc(c.product?.nazwa||`Produkt ${i+1}`)}</b><small>EAN ${esc(c.product?.ean||c.product?.gtin||"—")} • kod ${esc(c.product?.kodProducenta||c.product?.mpn||"—")}</small><small>${esc(c.confidence||0)}% • ${esc(c.url||"")}</small></div><button class="btn" type="button" onclick="agentAIWybierzWariantJednegoLinku(${i},this)">Wybierz — Agent zrobi resztę</button></article>`).join("")}</div></div>`;
}
function agentAIProduktGotowyZLinku(d={},url=""){
  const source={...(d.product||{})},category=d.storeCategory?.name?d.storeCategory:agentAIDobierzKategorieProduktu(source),canonical=allegroProducentKanoniczny({...source,sourceUrl:source.sourceUrl||url,producentUrl:source.producentUrl||url}),canonicalUrl=String(d.canonicalUrl||d.resolvedUrl||source.sourceUrl||url).trim(),now=new Date().toISOString();
  const product={...source,kategoria:category.name||source.kategoria||"",producent:canonical||source.producent||source.marka||"",marka:source.marka||canonical||source.producent||"",sourceUrl:canonicalUrl,producentUrl:canonicalUrl,agentImportAt:now,agentImportConfidence:Number(d.confidence||source.agentImportConfidence||0),agentImportSource:d.fromCache?"pamięć Agenta + źródło produktu":"strona źródłowa produktu + Agent",agentImportUrl:canonicalUrl,sourceEvidence:{...(source.sourceEvidence||{}),requestedUrl:url,canonicalUrl,fetchedAt:source.sourceEvidence?.fetchedAt||source.producentSprawdzonoAt||now,fieldSources:d.fieldSources||source.sourceEvidence?.fieldSources||{}},ikona:source.ikona||(/\b(gra|gry|puzzle|układank|zabaw)/i.test(`${source.nazwa||""} ${category.name||""}`)?"🎲":"📦"),sku:source.sku||source.externalId||"",externalId:source.externalId||source.sku||"",cena:Number(source.cena)||0,createdAt:now,createdBy:sesja?.email||"administrator",agentOnboardingStatus:"processing",agentOnboardingStartedAt:now};
  return domyslneKosztyDoProduktu(agentAIPoprawOpisyDanychProduktu(product),false);
}
async function agentAIPrzygotujProduktZJednegoLinku(d={},url="",box=null){
  const product=agentAIProduktGotowyZLinku(d,url);
  agentAIImportUrlStan={busy:false,data:d,selected:Number.isInteger(d.selectedChoice)?d.selectedChoice:0,error:""};
  try{sessionStorage.setItem("artway_prefill_product",JSON.stringify({...product,_agentLinkUrl:url,_agentPrepared:true}));}catch(e){}
  if(box)box.innerHTML=`<div class="product-link-agent-report"><header><div><span>✅ Dane przygotowane</span><h3>${esc(product.nazwa||"Produkt")}</h3><small>Agent nie zapisał kartoteki. Sprawdź wspólny formularz i samodzielnie zatwierdź dodanie produktu.</small></div><span class="lvl lvl-ok">oczekuje na decyzję</span></header></div>`;
  toast("✅ Dane przygotowane — produkt czeka na Twoje zatwierdzenie");
  location.hash="#/admin/produkty/dodaj?agent=1";
  return {mode:"awaiting_approval",product};
}
async function agentAIUruchomJedenLink(url,button=null,choice=null){
  const clean=String(url||"").trim(),box=document.querySelector("[data-one-link-result]");if(!/^https?:\/\//i.test(clean)){toast("Wklej pełny adres konkretnego produktu, zaczynający się od https://");document.querySelector("[data-one-link-url]")?.focus();return;}
  if(button)button.disabled=true;if(box)box.innerHTML=`<div class="product-link-one-progress"><span>🤖</span><div><b>Agent analizuje konkretny produkt…</b><small>Pobieram dane bezpośrednio ze wskazanej strony, następnie sprawdzam duplikaty, kategorię i przygotowanie Allegro.</small></div></div>`;agentAIZapiszLinkProducenta(clean,"pobieranie","Agent rozpoczął kompletny import z jednego adresu");
  try{const body={url:clean,...(Number.isInteger(choice)?{choice}: {})},d=await chmura("product-url-prepare",{method:"POST",body,timeout:120000});agentAIImportUrlStan={busy:false,data:d,selected:d.needsChoice?-1:(Number.isInteger(choice)?choice:0),error:""};if(d.needsChoice){if(box)box.innerHTML=agentAIWariantyJednegoLinkuHTML(d);return;}await agentAIPrzygotujProduktZJednegoLinku(d,clean,box);}catch(e){const nextRetryAt=agentAINastepnaProbaLinku(1);agentAIImportUrlStan={busy:false,data:null,selected:-1,error:e.message||String(e)};agentAIZapiszLinkProducenta(clean,"oczekuje",e.message||String(e),{nextRetryAt,failureCode:e.code||"fetch_error",diagnostics:e.linkDiagnostics||{}});if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>⚠️ Nie udało się odczytać źródła</span><h3>Agent zapisał adres do ponowienia</h3><small>${esc(e.message||e)}</small></div><span class="lvl lvl-ostrzezenie">bez utraty linku</span></header><div class="backend-note">Nie utworzono pustego ani błędnego produktu. Agent ponowi próbę, a Ty możesz użyć tego samego pola ponownie.</div></div>`;toast("⚠️ Nie utworzono produktu — link zachowano dla Agenta");}finally{if(button)button.disabled=false;}
}
async function agentAIDodajProduktTylkoZLinku(event){event.preventDefault();const form=event.currentTarget,button=event.submitter||form.querySelector('button[type="submit"]');await agentAIUruchomJedenLink(form.elements.url?.value,button,null);}
async function agentAIWybierzWariantJednegoLinku(index,button){const d=agentAIImportUrlStan.data||{},url=d.requestedUrl||document.querySelector("[data-one-link-url]")?.value||d.alternatives?.[index]?.url||"";await agentAIUruchomJedenLink(url,button,index);}
async function pobierzDaneProduktuZUrl(btn){
  const form=btn.closest("form");
  const url=String(form?.elements?.producentUrl?.value||"").trim();
  if(!url){ toast("⚠️ Wklej adres strony produktu producenta"); return; }
  const overwrite=!!form?.elements?.nadpiszImportUrl?.checked;
  const progressBox=form?.querySelector("[data-product-link-agent-result]");if(progressBox)progressBox.innerHTML=`<div class="product-link-fetch-progress"><div><span>🤖</span><b>Agent przygotowuje produkt z linku</b><small>Źródło → dane i kody → duplikaty → gotowy formularz</small></div><div class="product-link-fetch-track"><span></span></div><div class="product-link-fetch-stages"><span class="active">1. Źródło</span><span>2. Dane</span><span>3. Duplikaty</span><span>4. Formularz</span></div></div>`;
  try{
    btn.disabled=true;
    toast("Pobieram dane produktu ze strony producenta…");
    agentAIImportUrlStan={busy:true,data:null,selected:0,error:""};const d=await chmura("product-url-prepare",{method:"POST",body:{url},timeout:90000});agentAIImportUrlStan={busy:false,data:d,selected:d.needsChoice?-1:0,error:""};
    const p=d.product||{};
    const braki=d.needsChoice?[]:agentAIUzupelnijFormularzZLinku(form,p,d,overwrite,d.canonicalUrl||d.resolvedUrl||url);
    const box=form.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(d,d.needsChoice?-1:0);
    agentAIZapiszLinkProducenta(url,d.needsChoice?"wymaga wyboru":braki.length?"do uzupełnienia":"pobrano",d.needsChoice?`Znaleziono ${d.alternatives?.length||2} produkty — wybierz wariant`:braki.length?`Pobrano częściowo — braki: ${braki.join(", ")}`:"Pobrano i dopasowano do formularza",{lastProductName:p.nazwa||"",lastProduct:agentAIProduktZLinkuMini(p),lastMissing:braki,lastCandidates:(d.alternatives||[]).map(x=>({...x,product:agentAIProduktZLinkuMini(x.product||{})})),lastAvailability:p.dostepnoscProducenta||d.availability?.text||"",lastPrice:p.cena||"",linkConfidence:d.confidence||0,fieldSources:d.fieldSources||{},diagnostics:d.diagnostics||{},resolvedUrl:d.resolvedUrl||d.canonicalUrl||url,nextRetryAt:null});
    toast(d.needsChoice?`Agent znalazł ${d.alternatives?.length||2} produkty — wybierz właściwy poniżej`:braki.length?`Pobrano ${d.confidence||0}% danych; braki: ${braki.join(", ")}`:`Dane pobrane i dopasowane • kompletność ${d.confidence||0}%`);
  }catch(e){
    const cached=agentAIWynikLinkuZPamieci(url);
    if(cached){
      const p=cached.product||{},braki=cached.needsChoice?[]:agentAIUzupelnijFormularzZLinku(form,p,cached,overwrite,cached.canonicalUrl||cached.resolvedUrl||url);agentAIImportUrlStan={busy:false,data:cached,selected:cached.needsChoice?-1:0,error:""};const box=form?.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(cached,cached.needsChoice?-1:0);const proby=Number((agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===normalizujUrlProducenta(url))?.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);agentAIZapiszLinkProducenta(url,cached.needsChoice?"wymaga wyboru":"oczekuje","Użyto pamięci Agenta; świeża kontrola zostanie ponowiona",{proby,nextRetryAt,lastProduct:agentAIProduktZLinkuMini(p),lastCandidates:cached.alternatives||[],linkConfidence:cached.confidence||0,resolvedUrl:cached.resolvedUrl||url});toast(cached.needsChoice?`Pamięć Agenta znalazła ${cached.alternatives.length} warianty — wybierz właściwy`:`Producent chwilowo nie odpowiedział — użyto ostatnich poprawnych danych (${cached.confidence||0}%)`);return;
    }
    const current=(agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===normalizujUrlProducenta(url)),proby=Number(current?.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);agentAIImportUrlStan={busy:false,data:null,selected:-1,error:e.message||String(e)};
    agentAIZapiszLinkProducenta(url,"oczekuje",e.message||String(e),{proby,nextRetryAt,failureCode:e.code||"fetch_error",diagnostics:e.linkDiagnostics||{},lastError:e.message||String(e)});
    const box=form?.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>⚠️ Agent linków</span><h3>Nie udało się pobrać produktu</h3><small>${esc(e.message||e)}</small></div><span class="lvl lvl-ostrzezenie">ponowienie zaplanowane</span></header><div class="backend-note">Następna automatyczna próba: <b>${esc(new Date(nextRetryAt).toLocaleString("pl-PL"))}</b>. Możesz poprawić adres albo użyć przycisku ponownie ręcznie.</div></div>`;
    toast(`⚠️ Link zapisany; następna próba ${new Date(nextRetryAt).toLocaleString("pl-PL")}`);
  }
  finally{ btn.disabled=false; }
}
function allegroProduktSelectHTML(offerId){
  const pid=String(allegroProduktIdDlaOferty(offerId)||"");
  const lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).sort((a,b)=>String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl")).slice(0,1000);
  return `<select class="allegro-map-select" onchange="allegroMapujOferte(${jsArg(offerId)},this.value)">
    <option value="">Nie podpięto</option>
    ${lista.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===pid?"selected":""}>${esc(allegroKodProduktu(p)||"ID "+p.id)} — ${esc(skrocTekst(p.nazwa,70))}</option>`).join("")}
  </select>`;
}
function allegroStatusKolejki(z){
  const status=String(z?.status||"").toUpperCase(), fulfillment=String(z?.fulfillmentStatus||"").toUpperCase();
  if(status==="CANCELLED"||fulfillment==="CANCELLED") return "CANCELLED";
  return fulfillment||"NEW";
}
function allegroStatusKolejkiMeta(z){
  const s=allegroStatusKolejki(z);
  return ({
    NEW:{label:"Nowe",klasa:"lvl-ostrzezenie"},PROCESSING:{label:"W realizacji",klasa:"lvl-info"},READY_FOR_SHIPMENT:{label:"Gotowe do wysłania",klasa:"lvl-info"},READY_FOR_PICKUP:{label:"Gotowe do odbioru",klasa:"lvl-info"},SENT:{label:"Wysłane",klasa:"lvl-ok"},PICKED_UP:{label:"Odebrane",klasa:"lvl-ok"},CANCELLED:{label:"Anulowane",klasa:"lvl-blad"},SUSPENDED:{label:"Wstrzymane",klasa:"lvl-blad"},RETURNED:{label:"Zwrócone",klasa:"lvl-blad"}
  })[s]||{label:s||"NEW",klasa:"lvl-info"};
}
function allegroLokalnyStatus(z={}){return [z.warehouseStage,z.agentStage,z.localStage,z.magazynStatus,z.localStatus].map(v=>String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l"));}
function allegroZamowienieZrealizowaneLokalnie(z={}){return allegroLokalnyStatus(z).some(s=>["zrealizowane","zamkniete","wyslane","anulowane"].includes(s))||z.agentHandled===true||z.localCompleted===true;}
const ALLEGRO_STATUSY_ZAMKNIETE=new Set(["SENT","PICKED_UP","CANCELLED","RETURNED"]);
function allegroZamowienieZamknieteWAllegro(z={}){return ALLEGRO_STATUSY_ZAMKNIETE.has(allegroStatusKolejki(z));}
function allegroKategoriaKolejki(z={}){const status=allegroStatusKolejki(z);if(ALLEGRO_STATUSY_ZAMKNIETE.has(status))return status;return allegroZamowienieZrealizowaneLokalnie(z)?"zrealizowane":status;}
function allegroZamowienieAktywneLokalnie(z={}){return !allegroZamowienieZamknieteWAllegro(z)&&!allegroZamowienieZrealizowaneLokalnie(z);}
function allegroEtapMagazynu(z={}){if(allegroZamowienieZamknieteWAllegro(z))return "zamkniete";if(allegroZamowienieZrealizowaneLokalnie(z))return "zrealizowane";const s=String(z.warehouseStage||"").toLowerCase();return ["do_sprawdzenia","braki","kompletacja","spakowane"].includes(s)?s:"do_sprawdzenia";}
function allegroEtapMagazynuMeta(z={}){return ({do_sprawdzenia:{label:"Do sprawdzenia",klasa:"lvl-ostrzezenie"},braki:{label:"Braki — zamówić",klasa:"lvl-blad"},kompletacja:{label:"Kompletacja",klasa:"lvl-info"},spakowane:{label:"Spakowane",klasa:"lvl-ok"},zrealizowane:{label:"Zrealizowane lokalnie",klasa:"lvl-ok"},zamkniete:{label:"Zamknięte przez Allegro",klasa:"lvl-ok"}})[allegroEtapMagazynu(z)];}
async function allegroUstawEtapMagazynu(orderId,stage){
  try{const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderId,stage},timeout:18000});allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;allegroZapiszCache();toast("Etap magazynu zapisany — status Allegro pozostał bez zmian");renderuj();}catch(e){toast("⚠️ Etap magazynu: "+(e.message||e));}
}
async function allegroUstawEtapZaznaczonychZamowien(){
  const stage=String(document.getElementById("bulkAllegroWarehouseStage")?.value||"");
  const ids=[...zaznaczoneAllegroZamowienia];
  if(!ids.length){toast("Zaznacz co najmniej jedno zlecenie Allegro");return;}
  if(!["do_sprawdzenia","braki","kompletacja","spakowane","zrealizowane"].includes(stage)){toast("Wybierz etap magazynowy");return;}
  try{
    toast(`Zmieniam etap ${ids.length} zleceń Allegro…`);
    const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderIds:ids,stage},timeout:45000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;zaznaczoneAllegroZamowienia.clear();allegroZapiszCache();
    toast(`✅ Zmieniono etap ${d.changed||0} zleceń${d.skipped?.length?` • pominięto zamknięte: ${d.skipped.length}`:""}. Statusy Allegro pozostały bez zmian.`);renderuj();
  }catch(e){toast("⚠️ Masowy etap Allegro: "+(e.message||e));}
}
function allegroOfertaPoId(offerId){
  return (Array.isArray(allegroOferty)?allegroOferty:[]).find(o=>String(o.id)===String(offerId))||null;
}
function allegroKluczPorownania(v){ return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
function allegroOfertyPasujaceDoProduktu(p={}){
  const oferty=Array.isArray(allegroOferty)?allegroOferty:[];
  const direct=String(p.allegroOfferId||"").trim();
  const pid=String(p.id??"").trim();
  const mappedIds=new Set(Object.values(allegroMapowania||{}).filter(m=>String(m?.productId??"")===pid).map(m=>String(m?.offerId||"")).filter(Boolean));
  const external=allegroKluczPorownania(p.externalId||p.sku||p.kodProducenta||p.mpn);
  const ean=allegroKluczPorownania(p.gtin||p.ean);
  const code=allegroKluczPorownania(p.kodProducenta||p.mpn);
  const catalog=String(p.allegroProductId||"").trim();
  const name=allegroKluczPorownania(p.nazwa||p.name);
  return oferty.map(o=>{
    let score=0,reason="";
    if(direct&&String(o.id)===direct){score=100;reason="ID oferty";}
    else if(mappedIds.has(String(o.id))){score=99;reason="mapowanie";}
    else if(catalog&&String(o.productId||"")===catalog){score=97;reason="ID produktu Allegro";}
    else if(external&&allegroKluczPorownania(o.externalId)===external){score=95;reason="SKU / external.id";}
    else if(ean&&allegroKluczPorownania(o.ean||o.gtin)===ean){score=93;reason="EAN/GTIN";}
    else if(code&&allegroKluczPorownania(o.manufacturerCode||o.producerCode)===code){score=90;reason="kod producenta";}
    else if(name&&allegroKluczPorownania(o.name)===name){score=86;reason="identyczna nazwa";}
    return score?{offer:o,score,reason}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.offer.id).localeCompare(String(b.offer.id)));
}
function allegroAudytDuplikatow(){
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const grupy=produkty.map(p=>({produkt:p,dopasowania:allegroOfertyPasujaceDoProduktu(p).filter(allegroDopasowanieDuplikatuAktywne)})).filter(x=>x.dopasowania.length>1);
  const offerIds=new Set(grupy.flatMap(x=>x.dopasowania.map(d=>String(d.offer.id))));
  return {grupy,offerIds,produkty:grupy.length,oferty:offerIds.size};
}
function allegroDopasowanieDuplikatuAktywne(d={}){const id=String(d.offer?.id||""),status=String(d.offer?.status||d.offer?.publication?.status||"").toUpperCase();return !["ENDED","ARCHIVED"].includes(status)&&allegroMapowania?.[id]?.blocked!==true;}
function allegroDuplikatWybierzPozostaw(form,offerId){
  form.querySelectorAll('input[name="withdrawOfferIds"]').forEach(input=>{input.disabled=String(input.value)===String(offerId);if(input.disabled)input.checked=false;});
}
async function allegroRozstrzygnijDuplikaty(event,productId){
  event.preventDefault();const form=event.currentTarget,fd=new FormData(form),keepOfferId=String(fd.get("keepOfferId")||""),withdrawOfferIds=fd.getAll("withdrawOfferIds").map(String).filter(id=>id&&id!==keepOfferId);
  if(!keepOfferId||!withdrawOfferIds.length){toast("Wskaż jedną ofertę pozostawianą i co najmniej jedną do wycofania");return;}
  const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{
    toast(`Wycofuję ${withdrawOfferIds.length} duplikat(y) i zachowuję ofertę ${keepOfferId}…`);
    const d=await chmura("allegro-resolve-duplicate",{method:"POST",body:{productId:String(productId),keepOfferId,withdrawOfferIds},timeout:120000});
    allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;allegroMapowania=d.mappings||allegroMapowania;
    produktyEdytowane[productId]={...(produktyEdytowane[productId]||{}),allegroOfferId:keepOfferId,allegroDuplicateResolvedAt:d.updated_at||new Date().toISOString()};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();allegroZapiszCache();toast(`✅ Pozostawiono ${keepOfferId}; wycofano ${withdrawOfferIds.length} ofert bez usuwania ich historii`);renderuj();
  }catch(e){toast("⚠️ Rozstrzyganie duplikatów: "+(e.message||e));if(button)button.disabled=false;}
}
function allegroCentrumDuplikatowHTML(audyt=allegroAudytDuplikatow()){
  if(!audyt.grupy.length)return `<div class="duplicate-audit-ok"><b>✅ Centrum duplikatów:</b> nie ma grup wymagających decyzji administratora.</div>`;
  return `<section class="allegro-duplicate-center"><div class="order-section-head"><div><span class="order-pro-label">Kontrolowane rozstrzygnięcie</span><h3>🧭 Centrum duplikatów (${audyt.produkty})</h3><p class="order-detail-lead">Dla każdej grupy wskaż ofertę główną oraz oferty do wycofania. System zakończy tylko zaznaczone oferty w Allegro, wyłączy ich odnawianie, zachowa historię i przypnie produkt do pozostawionej pozycji.</p></div></div><div class="allegro-duplicate-groups">${audyt.grupy.map(({produkt,dopasowania})=>{const domyslna=String(dopasowania[0]?.offer?.id||"");return `<form class="allegro-duplicate-group" onsubmit="allegroRozstrzygnijDuplikaty(event,${jsArg(produkt.id)})"><header><div class="allegro-duplicate-product">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="">`:`<span>🎲</span>`}<div><b>${esc(produkt.nazwa||"Produkt")}</b><small>ID ${esc(produkt.id)} • SKU ${esc(produkt.sku||"—")} • EAN ${esc(produkt.gtin||produkt.ean||"—")}</small></div></div><span class="lvl lvl-blad">${dopasowania.length} pasujących ofert</span></header><div class="allegro-duplicate-options">${dopasowania.map((d,index)=>{const o=d.offer,id=String(o.id);return `<article class="allegro-duplicate-option"><div class="allegro-duplicate-offer">${o.mainImage?`<img src="${esc(o.mainImage)}" alt="" loading="lazy">`:`<span>🏷️</span>`}<div><b>${esc(o.name||"Oferta Allegro")}</b><small>ID ${esc(id)} • ${esc(o.priceText||"cena —")} • stan ${esc(o.stockAvailable??"—")} • sprzedano ${esc(o.stockSold??"—")}</small><em>Dopasowanie: ${esc(d.reason)} • pewność ${esc(d.score)}%</em></div></div><div class="allegro-duplicate-choice"><label><input type="radio" name="keepOfferId" value="${esc(id)}" ${index===0?"checked":""} onchange="allegroDuplikatWybierzPozostaw(this.form,this.value)"> <b>Pozostaw tę ofertę</b></label><label><input type="checkbox" name="withdrawOfferIds" value="${esc(id)}" ${index===0?"disabled":"checked"}> Wycofaj jako duplikat</label><a href="https://allegro.pl/oferta/${encodeURIComponent(id)}" target="_blank" rel="noopener">Otwórz ofertę ↗</a></div></article>`;}).join("")}</div><footer><span>Operacja nie usuwa sprzedaży ani historii oferty.</span><button class="btn" type="submit">Zastosuj wybraną decyzję</button></footer></form>`;}).join("")}</div></section>`;
}
function allegroOfertaDlaProduktuSklepu(p={}){
  const matches=allegroOfertyPasujaceDoProduktu(p);return matches.find(allegroDopasowanieDuplikatuAktywne)?.offer||matches[0]?.offer||null;
}
function allegroStatusProduktuHTML(p={}){
  const wszystkie=allegroOfertyPasujaceDoProduktu(p),dopasowania=wszystkie.filter(allegroDopasowanieDuplikatuAktywne),o=dopasowania[0]?.offer||wszystkie[0]?.offer;
  if(!o)return `<span class="lvl lvl-ostrzezenie">brak na Allegro</span>`;
  const active=String(o.status||"").toUpperCase()==="ACTIVE";
  const duplikaty=dopasowania.slice(1);
  return `<span class="lvl ${active?"lvl-ok":"lvl-info"}">${active?"aktywna":"na Allegro: "+(o.status||"szkic")}</span>${duplikaty.length?` <span class="lvl lvl-blad" title="${esc(dopasowania.map(x=>`${x.offer.id}: ${x.reason}`).join(" • "))}">⚠️ ${dopasowania.length} ofert</span>`:""}<br><small>ID ${esc(o.id)}${duplikaty.length?` • sprawdź duplikaty`:""}</small>`;
}
function allegroDanePozycjiZamowienia(it={}){
  const oferta=allegroOfertaPoId(it.offerId);
  return {
    kod:String(it.externalId||oferta?.externalId||it.offerId||"").trim(),
    ean:String(oferta?.ean||oferta?.gtin||oferta?.manufacturerCode||oferta?.producerCode||"").trim(),
    nazwa:String(it.offerName||oferta?.name||"Produkt Allegro").trim(),
    ilosc:Math.max(1,Number(it.quantity)||1),
    zdjecie:String(oferta?.mainImage||(oferta?.images||[])[0]||it.image||"").trim()
  };
}
function allegroPodobienstwoNazwProduktow(a,b){
  const aa=new Set(allegroTokenyNazwy(a)),bb=new Set(allegroTokenyNazwy(b));if(!aa.size||!bb.size)return 0;
  let wspolne=0;aa.forEach(x=>{if(bb.has(x))wspolne++;});return wspolne/Math.max(aa.size,bb.size);
}
function allegroTokenyIstotneMapowania(v=""){
  const stop=new Set(["gra","gry","zabawka","zabawki","zestaw","alexander","multigra","godan","origami","konstruktor","junior","maly","mala","duzy","duza","dla","oraz","wersja","szt","elementow"]);
  return new Set(allegroNormalizujNazwe(v).split(/\s+/).filter(x=>x.length>2&&!stop.has(x)));
}
function allegroPodobienstwoIstotneMapowania(a="",b=""){
  const aa=allegroTokenyIstotneMapowania(a),bb=allegroTokenyIstotneMapowania(b);if(!aa.size||!bb.size)return 0;let common=0;aa.forEach(x=>{if(bb.has(x))common++;});return common/Math.max(aa.size,bb.size);
}
let allegroIndeksMapowanZrodlo=null,allegroIndeksMapowanProduktu=new Map();
function allegroIndeksOfertWedlugProduktu(){
  if(allegroIndeksMapowanZrodlo===allegroMapowania)return allegroIndeksMapowanProduktu;
  const index=new Map();
  Object.values(allegroMapowania||{}).forEach(m=>{const productId=String(m?.productId??m?.produktId??"");if(!productId||m?.blocked===true)return;const list=index.get(productId)||[];list.push(String(m?.offerId||""));index.set(productId,list.filter(Boolean));});
  allegroIndeksMapowanZrodlo=allegroMapowania;allegroIndeksMapowanProduktu=index;return index;
}
function allegroInneOfertyProduktu(productId,excludeOfferId=""){
  return (allegroIndeksOfertWedlugProduktu().get(String(productId))||[]).filter(id=>id!==String(excludeOfferId));
}
function allegroOcenaMapowaniaKandydata(oferta={},produkt={}){
  const norm=allegroKluczPorownania,p={ean:norm(produkt.gtin||produkt.ean),external:norm(produkt.externalId||produkt.sku),code:norm(produkt.kodProducenta||produkt.mpn),catalog:String(produkt.allegroProductId||""),offerId:String(produkt.allegroOfferId||""),name:String(produkt.nazwa||"")},o={ean:norm(oferta.ean||oferta.gtin),external:norm(oferta.externalId),code:norm(oferta.manufacturerCode||oferta.producerCode),catalog:String(oferta.productId||""),id:String(oferta.id||""),name:String(oferta.name||"")};
  const evidence=[],conflicts=[];let score=0,reason="";const hit=(value,label)=>{if(value>score){score=value;reason=label;}evidence.push(label);};
  if(p.ean&&o.ean)(p.ean===o.ean?hit(100,"identyczny EAN/GTIN"):conflicts.push("różny EAN/GTIN"));
  if(p.catalog&&o.catalog)(p.catalog===o.catalog?hit(99,"identyczny produkt katalogowy Allegro"):conflicts.push("różne ID produktu katalogowego"));
  if(p.external&&o.external)(p.external===o.external?hit(97,"identyczny EXTERNAL_ID/SKU"):conflicts.push("różny EXTERNAL_ID/SKU"));
  if(p.code&&o.code)(p.code===o.code?hit(95,"identyczny kod producenta"):conflicts.push("różny kod producenta"));
  const exact=p.name&&o.name&&allegroNormalizujNazwe(p.name)===allegroNormalizujNazwe(o.name),similarity=p.name&&o.name?allegroPodobienstwoIstotneMapowania(p.name,o.name):0;
  if(exact)hit(92,"identyczna nazwa");else if(similarity>=.72)hit(Math.round(72+similarity*18),"bardzo podobna nazwa");else if(similarity>=.45)hit(Math.round(52+similarity*20),"częściowo podobna nazwa");
  if(p.offerId&&o.id&&p.offerId===o.id&&!conflicts.includes("różny EAN/GTIN"))hit(Math.max(score,70),"zapisane ID oferty");
  const strongConflict=conflicts.includes("różny EAN/GTIN")||(conflicts.includes("różne ID produktu katalogowego")&&p.catalog&&o.catalog);
  if(strongConflict)score=Math.min(score,35);else if(conflicts.length&&score<95)score=Math.max(0,score-Math.min(25,conflicts.length*8));
  const occupied=allegroInneOfertyProduktu(produkt.id,oferta.id);
  return {produkt,score,reason:reason||"brak wspólnych identyfikatorów",evidence,conflicts,similarity:Math.round(similarity*100),strongConflict,occupied,valid:score>=65&&!strongConflict};
}
function allegroKandydaciMapowaniaOferty(oferta={}){
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>allegroOcenaMapowaniaKandydata(oferta,p)).filter(x=>x.score>0||String(x.produkt.id)===String(allegroProduktIdDlaOferty(oferta.id))).sort((a,b)=>b.score-a.score||Number(a.occupied.length)-Number(b.occupied.length)||String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl")).slice(0,30);
}
function allegroAnalizaMapowaniaOferty(oferta={}){
  const mappedId=String(allegroProduktIdDlaOferty(oferta.id)||""),mapped=mappedId?produktyDoAdministracji().find(p=>String(p.id)===mappedId)||null:null,candidates=allegroKandydaciMapowaniaOferty(oferta),current=mapped?candidates.find(x=>String(x.produkt.id)===mappedId)||allegroOcenaMapowaniaKandydata(oferta,mapped):null,available=candidates.filter(x=>!x.occupied.length||String(x.produkt.id)===mappedId),best=available[0]||null,second=available[1]||null;
  const suggestion=best&&best.valid&&best.score>=88&&(!second||best.score-second.score>=6)?best:null,different=suggestion&&mapped&&String(suggestion.produkt.id)!==mappedId,conflict=!!mapped&&(!!current?.strongConflict||Number(current?.score||0)<65||(different&&suggestion.score-Number(current?.score||0)>=12));
  const status=conflict?"konflikt":mapped?(Number(current?.score||0)>=85?"poprawne":"sprawdz"):suggestion?"sugestia":"niepodpiete";
  return {oferta,mapped,mappedId,current,candidates,best,suggestion,second,conflict,status,canAuto:!mapped&&!!suggestion&&!suggestion.occupied.length,correction:conflict&&different?suggestion:null};
}
function allegroDopasowaniePozycjiDoProduktu(it={}){
  const offerId=String(it.offerId||it.offer?.id||"").trim(),oferta=allegroOfertaPoId(offerId)||{},d=allegroDanePozycjiZamowienia({...it,offerId});
  const rec=(allegroMapowania||{})[offerId],blocked=rec?.blocked===true,mappedId=String(rec?.productId??rec?.produktId??rec?.id??rec??"").trim();
  const virtualOffer={...oferta,id:offerId,name:d.nazwa||oferta.name,externalId:it.externalId||oferta.externalId||d.kod,ean:oferta.ean||oferta.gtin||d.ean},candidates=allegroKandydaciMapowaniaOferty(virtualOffer).slice(0,8),current=mappedId?candidates.find(x=>String(x.produkt.id)===mappedId):null;
  if(mappedId&&current?.valid&&!current.strongConflict)return{produkt:current.produkt,match:String(rec?.operator||"").startsWith("auto-order:")?String(rec.operator).replace("auto-order:",""):current.reason||"zweryfikowane mapowanie",confidence:Number(current.score||rec?.confidence||0),candidates};
  const available=candidates.filter(x=>!x.occupied.length),best=available[0],second=available[1],pewne=!blocked&&best&&best.valid&&best.score>=88&&(!second||best.score-second.score>=6);
  return {produkt:pewne?best.produkt:null,match:blocked?"automatyczne dopasowanie wyłączone ręcznie":mappedId?"obecne mapowanie jest sprzeczne z identyfikatorami":pewne?best.reason:"brak pewnego dopasowania",confidence:pewne?best.score:0,candidates,mappingConflict:!!mappedId&&!current?.valid};
}
let allegroMapowaniePozycjiCel={offerId:"",offerName:"",error:null};
function allegroZamknijMapowaniePozycji(){document.getElementById("allegroMappingModal")?.remove();allegroMapowaniePozycjiCel={offerId:"",offerName:"",error:null};}
function allegroOtworzMapowaniePozycji(offerId,offerName=""){
  allegroMapowaniePozycjiCel={offerId:String(offerId||""),offerName:String(offerName||""),error:null};document.getElementById("allegroMappingModal")?.remove();
  const modal=document.createElement("div");modal.id="allegroMappingModal";modal.className="emoji-picker-overlay";modal.onclick=allegroZamknijMapowaniePozycji;
  modal.innerHTML=`<div class="emoji-picker-modal allegro-mapping-modal" onclick="event.stopPropagation()"><div class="emoji-picker-head"><div><span class="order-pro-label">Bezpieczne powiązanie 1:1</span><h2>🧩 Wybierz produkt sklepu</h2><p>Agent porówna identyfikatory i nie zapisze sprzecznego połączenia bez świadomego wyboru.</p></div><button class="btn ghost" type="button" onclick="allegroZamknijMapowaniePozycji()">✕ Zamknij</button></div><input class="emoji-picker-search" id="allegroMappingSearch" placeholder="Szukaj po nazwie, ID produktu, EAN, SKU, EXTERNAL_ID lub kodzie producenta…" oninput="allegroRenderujKandydatowMapowania(this.value)"><div id="allegroMappingCandidates"></div></div>`;
  document.body.appendChild(modal);allegroRenderujKandydatowMapowania("");modal.querySelector("#allegroMappingSearch")?.focus();
}
function allegroRenderujKandydatowMapowania(q=""){
  const box=document.getElementById("allegroMappingCandidates");if(!box)return;
  const offerId=allegroMapowaniePozycjiCel.offerId,oferta=allegroOfertaPoId(offerId)||{},query=String(q||"").trim().toLowerCase(),currentId=String(allegroProduktIdDlaOferty(offerId)||""),all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  let lista=query?all.filter(p=>`${p.id} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||p.marka||""}`.toLowerCase().includes(query)).map(p=>allegroOcenaMapowaniaKandydata(oferta,p)):allegroKandydaciMapowaniaOferty(oferta).slice(0,12);
  lista.sort((a,b)=>b.score-a.score||Number(a.occupied.length)-Number(b.occupied.length)||String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl"));lista=lista.slice(0,50);
  const err=allegroMapowaniePozycjiCel.error,errValidation=err?.validation||{};
  box.innerHTML=`<div class="allegro-mapping-source-card">${oferta.mainImage?`<img src="${esc(oferta.mainImage)}" alt="">`:`<span>🏷️</span>`}<div><small>OFERTA ALLEGRO</small><b>${esc(oferta.name||allegroMapowaniePozycjiCel.offerName||"—")}</b><p>ID ${esc(offerId)} • EAN ${esc(oferta.ean||oferta.gtin||"—")} • EXTERNAL_ID ${esc(oferta.externalId||"—")} • kod ${esc(oferta.manufacturerCode||oferta.producerCode||"—")}</p></div></div>${err?`<div class="backend-note allegro-mapping-error"><b>Nie zapisano połączenia:</b> ${esc(err.message||err)}${errValidation.conflicts?.length?`<br><small>${esc(errValidation.conflicts.join(" • "))}</small>`:""}</div>`:""}<div class="allegro-mapping-results pro">${lista.map(x=>{const p=x.produkt,isCurrent=String(p.id)===currentId,cls=x.strongConflict?"conflict":x.score>=88?"strong":x.score>=65?"review":"weak",occupied=x.occupied.length>0&&!isCurrent;return `<article class="allegro-mapping-candidate ${cls} ${isCurrent?"is-current":""}"><div class="allegro-mapping-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • EAN ${esc(p.gtin||p.ean||"—")} • SKU/EXTERNAL_ID ${esc(p.sku||p.externalId||"—")} • kod ${esc(p.kodProducenta||p.mpn||"—")}</small><div class="allegro-evidence-chips">${x.evidence.map(v=>`<span class="ok">✓ ${esc(v)}</span>`).join("")}${x.conflicts.map(v=>`<span class="bad">! ${esc(v)}</span>`).join("")||(!x.evidence.length?`<span>brak wspólnych kodów</span>`:"")}</div></div></div><div class="allegro-mapping-confidence"><b>${esc(x.score)}%</b><small>${esc(x.reason)}</small>${occupied?`<em>Połączony także z ofertą ${esc(x.occupied.join(", "))}</em>`:""}</div><div class="allegro-mapping-choice">${isCurrent?`<span class="lvl ${x.valid?"lvl-ok":"lvl-blad"}">${x.valid?"obecne, zweryfikowane":"obecne, błędne"}</span>`:x.strongConflict?`<button class="btn danger" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)},true,${occupied})">Połącz mimo konfliktu</button>`:occupied?`<button class="btn ghost" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)},false,true)">Przenieś powiązanie tutaj</button>`:`<button class="btn" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)})">Połącz ten produkt</button>`}<a href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Otwórz kartę produktu</a></div></article>`;}).join("")||`<div class="backend-note">Brak wyników. Wpisz nazwę, ID produktu, EAN, SKU, EXTERNAL_ID albo kod producenta.</div>`}</div>${currentId?`<button class="btn danger" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},'')">Usuń obecne powiązanie</button>`:""}`;
}
async function allegroWybierzMapowaniePozycji(offerId,productId,force=false,replaceExisting=false){const result=await allegroMapujOferte(offerId,productId,{force,replaceExisting});if(result?.ok)allegroZamknijMapowaniePozycji();else allegroRenderujKandydatowMapowania(document.getElementById("allegroMappingSearch")?.value||"");}
function allegroZamowieniePasujeDoFiltra(z){
  const kategoria=allegroKategoriaKolejki(z);
  const statusOk=filtrAllegroZamowien==="wszystkie"||(filtrAllegroZamowien==="do_obslugi"?allegroZamowienieAktywneLokalnie(z):kategoria===filtrAllegroZamowien);
  const etapOk=filtrEtapuAllegroZamowien==="wszystkie"||allegroEtapMagazynu(z)===filtrEtapuAllegroZamowien;
  return statusOk&&etapOk;
}
function allegroWierszeZamowien(){
  const rows=[];
  for(const z of Array.isArray(allegroZamowienia)?allegroZamowienia:[]){
    const items=Array.isArray(z.lineItems)&&z.lineItems.length?z.lineItems:[{offerId:"",offerName:"Brak pozycji",quantity:0}];
    for(const it of items){
      const dane=allegroDanePozycjiZamowienia(it);
      rows.push({z,it,dane,tekst:`${z.id||""} ${z.nr||""} ${z.email||""} ${z.buyerLogin||""} ${z.buyerName||""} ${z.phone||""} ${it.offerId||""} ${dane.kod} ${dane.ean} ${dane.nazwa} ${allegroStatusKolejki(z)}`.toLowerCase()});
    }
  }
  return rows;
}
function allegroPasujaceZamowienia(){
  const q=String(szukajAllegroZamowien||"").toLowerCase().trim();
  const wszystkie=Array.isArray(allegroZamowienia)?allegroZamowienia:[];
  const pasujaceIds=q?new Set(allegroWierszeZamowien().filter(r=>r.tekst.includes(q)).map(r=>String(r.z.id))):null;
  return wszystkie.filter(allegroZamowieniePasujeDoFiltra).filter(z=>!pasujaceIds||pasujaceIds.has(String(z.id)));
}
function allegroZaznaczWidoczneZamowienia(checked=true){
  allegroPasujaceZamowienia().slice(0,allegroLimitWidokuZamowien).forEach(z=>checked?zaznaczoneAllegroZamowienia.add(String(z.id)):zaznaczoneAllegroZamowienia.delete(String(z.id)));
  renderuj();
}
function allegroZaznaczWszystkiePasujaceZamowienia(){
  allegroPasujaceZamowienia().forEach(z=>zaznaczoneAllegroZamowienia.add(String(z.id)));
  renderuj();
}
function allegroZamowieniaTabelaHTML(){
  const wszystkie=Array.isArray(allegroZamowienia)?allegroZamowienia:[];
  const aktywne=wszystkie.filter(statusAllegroRezerwujeMagazyn);
  const analizy=aktywne.map(z=>allegroAnalizaMagazynowaZamowienia(z));
  const wszystkiePozycje=analizy.flatMap(a=>a.pozycje||[]);
  const agentStat={
    gotowe:analizy.filter(a=>a.gotowe).length,
    zBrakami:analizy.filter(a=>a.braki>0).length,
    doWyjasnienia:analizy.filter(a=>a.nierozpoznane>0||a.bezStanu>0||a.bezLokalizacji>0).length,
    brakiSzt:analizy.reduce((s,a)=>s+Number(a.braki||0),0),
    dokumenty:(agentAIZlecenia||[]).filter(z=>!["zrealizowane","anulowane"].includes(String(z.status||"").toLowerCase())).length,
    pozycje:wszystkiePozycje.length,
    rozpoznane:wszystkiePozycje.filter(p=>p.produkt).length,
    reczne:wszystkiePozycje.filter(p=>String(p.match||"").includes("ręczne")).length
  };
  const pasujaceZamowienia=allegroPasujaceZamowienia();
  const widoczneZamowienia=pasujaceZamowienia.slice(0,allegroLimitWidokuZamowien);
  const zaznaczone=[...zaznaczoneAllegroZamowienia].filter(id=>wszystkie.some(z=>String(z.id)===id));
  const wszystkieWidoczneZaznaczone=!!widoczneZamowienia.length&&widoczneZamowienia.every(z=>zaznaczoneAllegroZamowienia.has(String(z.id)));
  const counts={do_obslugi:0,zrealizowane:0,wszystkie:wszystkie.length};
  wszystkie.forEach(z=>{const kategoria=allegroKategoriaKolejki(z);counts[kategoria]=(counts[kategoria]||0)+1;if(allegroZamowienieAktywneLokalnie(z))counts.do_obslugi++;});
  const filtry=[["do_obslugi","Do obsługi"],["NEW","Nowe"],["PROCESSING","W realizacji"],["READY_FOR_SHIPMENT","Do wysłania"],["zrealizowane","Zrealizowane lokalnie"],["SENT","Wysłane"],["CANCELLED","Anulowane"],["RETURNED","Zwrócone"],["wszystkie","Wszystkie"]];
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">📦 Zamówienia Allegro</h2><p class="order-detail-lead">Agent rozpoznaje pozycje po identyfikatorach, rezerwuje towar, pokazuje dokładną lokalizację albo dopisuje realny brak do właściwego szkicu zamówienia producenta. Oficjalny status zawsze pochodzi z Allegro.</p></div>
    </div>
    <div class="orders-status-strip">${filtry.map(([id,label])=>`<button class="${filtrAllegroZamowien===id?"active":""}" onclick="filtrAllegroZamowien=${jsArg(id)};renderuj()">${label} <b>${counts[id]||0}</b></button>`).join("")}</div>
    ${adminWyszukiwaniePanelHTML({id:"allegro-orders",description:"Zlecenie, klient, telefon, kod produktu, EAN, nazwa i etap magazynowy.",results:pasujaceZamowienia.length,active:!!(szukajAllegroZamowien||filtrAllegroZamowien!=="do_obslugi"||filtrEtapuAllegroZamowien!=="wszystkie"),open:true,fields:`<div class="orders-toolbar allegro-toolbar admin-search-full">
      <input placeholder="Szukaj: zamówienie, klient, telefon, kod, EAN, nazwa produktu…" value="${esc(szukajAllegroZamowien)}" oninput="szukajAllegroZamowien=this.value.toLowerCase();renderuj()">
      <label>Etap magazynu <select onchange="filtrEtapuAllegroZamowien=this.value;renderuj()">${[["wszystkie","Wszystkie etapy"],["do_sprawdzenia","Do sprawdzenia"],["braki","Braki"],["kompletacja","Kompletacja"],["spakowane","Spakowane"],["zrealizowane","Zrealizowane lokalnie"]].map(([v,l])=>`<option value="${v}" ${filtrEtapuAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <label class="allegro-view-limit">Pokaż zleceń <select onchange="allegroLimitWidokuZamowien=Number(this.value)||100;renderuj()">${[25,50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWidokuZamowien===n?"selected":""}>${n}</option>`).join("")}</select></label>
      ${szukajAllegroZamowien?`<button class="btn ghost" onclick="szukajAllegroZamowien='';renderuj()">Wyczyść</button>`:""}
    </div>`,actions:adminOperacjeWynikowHTML({id:"allegro-orders",selected:zaznaczone.length,pageCount:widoczneZamowienia.length,resultCount:pasujaceZamowienia.length,selectPage:"allegroZaznaczWidoczneZamowienia(true)",selectAll:"allegroZaznaczWszystkiePasujaceZamowienia()",clear:"allegroWyczyscZaznaczenieZamowien()",exportSelected:"allegroEksportujZamowienia('zaznaczone')",exportAll:"allegroEksportujZamowienia('filtr')"})})}
    <div class="allegro-bulk-toolbar">
      <div><b>Operacje na zleceniach</b><small>${zaznaczone.length} zaznaczonych • checkbox służy tylko do operacji grupowych</small></div>
      <div class="allegro-bulk-stage"><label for="bulkAllegroWarehouseStage">Etap magazynu</label><select id="bulkAllegroWarehouseStage"><option value="">— wybierz etap —</option><option value="do_sprawdzenia">Do sprawdzenia</option><option value="braki">Braki — zamówić</option><option value="kompletacja">Kompletacja</option><option value="spakowane">Spakowane</option><option value="zrealizowane">✅ Zrealizowane lokalnie</option></select><button class="btn" onclick="allegroUstawEtapZaznaczonychZamowien()" ${zaznaczone.length?"":"disabled"}>Zastosuj do ${zaznaczone.length}</button></div>
    </div>
    <div class="allegro-order-list">${widoczneZamowienia.map(allegroZlecenieHTML).join("") || `<div class="backend-note">Brak zamówień w tym filtrze. Synchronizacja pobiera wyłącznie nowe i gotowe do wysłania.</div>`}</div>
    ${widoczneZamowienia.length>=allegroLimitWidokuZamowien?`<p class="order-detail-lead">Pokazano pierwsze ${allegroLimitWidokuZamowien} zleceń. Zwiększ limit widoku powyżej, aby zobaczyć więcej.</p>`:""}
    <section class="allegro-stock-agent allegro-info-bottom"><div class="allegro-stock-agent-head"><div><b>🤖 Agent magazynowy i mapowanie produktów</b><small>Nowe zlecenia są sprawdzane co 15 minut. Agent łączy pozycje kolejno po ręcznym powiązaniu, EAN, SKU, kodzie producenta i jednoznacznej nazwie. Niepewne dopasowania zostawia do decyzji administratora.</small></div><a class="btn ghost" href="#/admin/agent-ai/zlecenia">🧾 Zamówienia producentów</a></div><div class="allegro-stock-agent-stats allegro-mapping-stats"><span><b>${agentStat.rozpoznane}/${agentStat.pozycje}</b><small>pozycji połączonych</small></span><span><b>${agentStat.reczne}</b><small>powiązań ręcznych</small></span><span><b>${agentStat.gotowe}</b><small>zleceń gotowych</small></span><span class="${agentStat.zBrakami?"alert":""}"><b>${agentStat.zBrakami}</b><small>z brakami (${agentStat.brakiSzt} szt.)</small></span><span class="${agentStat.doWyjasnienia?"warn":""}"><b>${agentStat.doWyjasnienia}</b><small>do wyjaśnienia</small></span></div></section>
    <div class="backend-note allegro-info-bottom"><b>Status zamówienia jest wyłącznie z Allegro.</b> Lokalny etap możesz zmienić ręcznie, także na „Zrealizowane lokalnie”. Tak oznaczone zlecenie znika z kolejki „Do obsługi”, przestaje rezerwować stan i nie wraca do niej przy kolejnej synchronizacji.</div>
  </div>`;
}
function allegroStanPozycjiHTML(p={}){
  if(!p.produkt)return `<span class="lvl lvl-blad">nierozpoznany produkt</span><br><small>Wymagany EAN, SKU albo mapowanie oferty.</small>`;
  if(p.stan===null)return `<span class="lvl lvl-ostrzezenie">brak kontrolowanego stanu</span><br><small>Uzupełnij stan produktu ID ${esc(p.produkt.id)} w Magazynie.</small>`;
  return `stan: <b>${esc(p.stan)}</b> szt.<br><small>łączne rezerwacje: ${esc(p.laczneRezerwacje)} • po rezerwacji: ${esc(p.dostepne)}</small>${p.lokalizacja?`<br><span class="warehouse-location-chip">📍 ${esc(nazwaLokalizacjiMagazynu(p.lokalizacja))}</span>`:`<br><small class="warehouse-location-missing">⚠️ brak lokalizacji</small>`}`;
}
function allegroDecyzjaAgentaHTML(p={}){
  if(p.decyzja==="nierozpoznany")return `<span class="lvl lvl-blad">sprawdź EAN/SKU</span><br><small>Agent nie połączył pozycji z kartoteką.</small>`;
  if(p.decyzja==="sprawdz_stan")return `<span class="lvl lvl-ostrzezenie">ustal stan magazynowy</span><br><a href="#/admin/magazyn/stany">Otwórz stany produktów</a>`;
  if(p.decyzja==="uzupelnij_lokalizacje")return `<span class="lvl lvl-ostrzezenie">uzupełnij lokalizację</span><br><a href="#/admin/produkty/edytuj/${encodeURIComponent(p.produkt?.id||"")}">Edytuj kartotekę</a>`;
  if(p.decyzja==="zamow_u_producenta")return `<span class="lvl lvl-blad">zamówić ${esc(p.brak)} szt.</span><br><small>Dostawca: ${esc(p.dostawca||"nieprzypisany")}</small>${p.dokumentyProducenta?.length?`<br><a href="#/admin/agent-ai/zlecenia">🧾 ${esc(p.dokumentyProducenta.map(x=>x.numer).join(", "))}</a>`:`<br><small>Agent utworzy szkic producenta przy synchronizacji.</small>`}`;
  return `<span class="lvl lvl-ok">pobierz z magazynu</span><br><b>📍 ${esc(nazwaLokalizacjiMagazynu(p.lokalizacja))}</b>`;
}
function allegroMapowaniePozycjiHTML(p={}){
  const suggestion=(p.candidates||[])[0];
  return `<div class="allegro-line-mapping ${p.produkt?"is-linked":"needs-link"}">${p.produkt?`<span class="lvl lvl-ok">połączono • ${esc(p.confidence||100)}%</span><b>${esc(p.produkt.nazwa||`Produkt ${p.produkt.id}`)}</b><small>ID ${esc(p.produkt.id)} • ${esc(p.match||"mapowanie")}</small>`:`<span class="lvl lvl-blad">brak powiązania</span>${suggestion?`<small>Najlepsza sugestia: <b>${esc(suggestion.produkt.nazwa)}</b> (${esc(suggestion.score)}%)</small>`:`<small>Brak jednoznacznej sugestii po identyfikatorach.</small>`}`}<button class="btn ${p.produkt?"ghost":""}" type="button" onclick="allegroOtworzMapowaniePozycji(${jsArg(p.offerId)},${jsArg(p.nazwa)})">${p.produkt?"Zmień powiązanie":"🧩 Połącz produkt"}</button></div>`;
}
function allegroZlecenieHTML(z){
  const meta=allegroStatusKolejkiMeta(z), s=allegroStatusKolejki(z);
  const etap=allegroEtapMagazynuMeta(z), analiza=allegroAnalizaMagazynowaZamowienia(z);
  const items=Array.isArray(z.lineItems)&&z.lineItems.length?z.lineItems:[];
  const sztuk=items.reduce((sum,it)=>sum+Math.max(1,Number(it.quantity)||1),0);
  const idEtap=`allegro-etap-${z.id}`;
  const zaznaczone=zaznaczoneAllegroZamowienia.has(String(z.id));
  const lokalnieDone=allegroZamowienieZrealizowaneLokalnie(z);
  return `<article class="allegro-order-card ${zaznaczone?"is-selected ":""}${allegroZamowienieAktywneLokalnie(z)?"is-active":"is-closed"}">
    <header class="allegro-order-head">
      <div class="allegro-order-title"><label class="allegro-order-select" title="Zaznaczenie tylko do operacji grupowych"><input type="checkbox" ${zaznaczone?"checked":""} onchange="allegroPrzelaczZaznaczenieZamowienia(${jsArg(z.id)},this.checked)"></label><span class="allegro-order-ico">📦</span><div><b>Zlecenie ${esc(z.id||z.nr||"—")}</b><small>${esc(allegroDataTxt(z.createdAt||z.firstFetchedAt))} • ${items.length} pozycji / ${sztuk} szt. • ${esc(z.total||"—")}</small></div></div>
      <div class="allegro-order-state"><span class="lvl ${meta.klasa}">Allegro: ${esc(meta.label)}</span><span class="lvl ${etap.klasa}">Magazyn: ${esc(etap.label)}</span><small>Ostatnia synchronizacja: ${esc(allegroDataTxt(z.rawUpdatedAt||z.lastSeenAt))}</small></div>
    </header>
    <div class="allegro-order-info">
      <div><b>👤 ${esc(z.buyerName||z.buyerLogin||z.email||"Klient Allegro")}</b><small>${esc(z.email||"—")} ${z.phone?`• ${esc(z.phone)}`:""}</small></div>
      <div><b>🚚 ${esc(z.deliveryMethod||"Dostawa")}</b><small>${esc(z.deliveryPoint||z.deliveryAddress||"—")}</small></div>
      <div><b>💳 ${esc(z.paymentStatus||"Płatność")}</b><small>${esc(z.total||"—")}</small></div>
    </div>
    <details class="allegro-order-products" open>
      <summary>Produkty w zleceniu (${items.length})</summary>
      <div class="warehouse-worktable-wrap"><table class="log-table allegro-order-products-table"><tr><th>Zdjęcie</th><th>Pozycja z Allegro</th><th>Produkt sklepu i dopasowanie</th><th>Ilość</th><th>Stan i rezerwacje</th><th>Decyzja agenta</th></tr>
        ${analiza.pozycje.map(p=>{const d=allegroDanePozycjiZamowienia({offerId:p.offerId,offerName:p.nazwa,quantity:p.ilosc});return `<tr class="${p.decyzja!=="kompletuj"?"row-alert":""}"><td>${d.zdjecie?`<img class="allegro-order-thumb" src="${esc(d.zdjecie)}" alt="" loading="lazy">`:`<span class="allegro-order-thumb fallback">🎲</span>`}</td><td><b>${esc(p.nazwa||"—")}</b><small>Oferta: ${esc(p.offerId||"—")} • kod: ${esc(p.externalId||"—")} • EAN: ${esc(p.ean||"—")}</small></td><td>${allegroMapowaniePozycjiHTML(p)}</td><td><b>${esc(p.ilosc)}</b> szt.</td><td>${allegroStanPozycjiHTML(p)}</td><td>${allegroDecyzjaAgentaHTML(p)}</td></tr>`;}).join("")||`<tr><td colspan="6">Brak pozycji w zleceniu.</td></tr>`}
      </table></div>
    </details>
    <footer class="allegro-order-actions">
      ${!allegroZamowienieZamknieteWAllegro(z)?`<span class="${analiza.gotowe?"lvl lvl-ok":"lvl lvl-blad"}">${analiza.gotowe?"✅ Wszystkie pozycje mają stan i lokalizację":`⚠️ Braki ${analiza.braki} szt. • nierozpoznane ${analiza.nierozpoznane} • bez stanu ${analiza.bezStanu} • bez lokalizacji ${analiza.bezLokalizacji}`}</span><select id="${esc(idEtap)}" aria-label="Etap magazynu">${[["do_sprawdzenia","Do sprawdzenia"],["braki","Braki — zamówić"],["kompletacja","Kompletacja"],["spakowane","Spakowane"],["zrealizowane","✅ Zrealizowane lokalnie"]].map(([id,label])=>`<option value="${id}" ${allegroEtapMagazynu(z)===id?"selected":""}>${label}</option>`).join("")}</select><button class="btn ghost" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},document.getElementById(${jsArg(idEtap)}).value)">Zapisz etap</button>${!lokalnieDone?`<button class="btn" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},'zrealizowane')">✅ Oznacz jako zrealizowane</button>`:`<button class="btn ghost" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},'do_sprawdzenia')">↩️ Przywróć do obsługi</button>`}`:""}
    </footer>
  </article>`;
}
function allegroZaznaczOfertyMapowania(ids=[],checked=true){ids.forEach(id=>checked?zaznaczoneMapowaniaAllegro.add(String(id)):zaznaczoneMapowaniaAllegro.delete(String(id)));renderuj();}
async function allegroZastosujPewneSugestieMapowania(ids=null){
  if(allegroMapowanieMasowe.busy)return;const set=ids?new Set(ids.map(String)):null,analizy=(allegroOferty||[]).filter(o=>!set||set.has(String(o.id))).map(allegroAnalizaMapowaniaOferty),items=analizy.map(a=>({a,target:a.correction||(!a.mapped?a.suggestion:null)})).filter(x=>x.target?.valid&&!x.target.occupied.length).map(x=>({offerId:String(x.a.oferta.id),productId:String(x.target.produkt.id)}));
  if(!items.length){toast("Brak jednoznacznych, bezkolizyjnych sugestii do zapisania");return;}
  allegroMapowanieMasowe={busy:true,total:items.length,mapped:0,skipped:0,error:""};renderuj();
  try{const d=await chmura("allegro-map-offers-batch",{method:"POST",body:{items},timeout:120000});allegroMapowania=d.mappings||allegroMapowania;allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;allegroMapowanieMasowe={busy:false,total:items.length,mapped:d.mapped||0,skipped:d.skipped||0,error:""};zaznaczoneMapowaniaAllegro.clear();await chmuraWczytajStan().catch(()=>{});allegroZapiszCache();toast(`✅ Bezpieczne mapowanie: połączono ${d.mapped||0}${d.skipped?` • pominięto ${d.skipped}`:""}`);renderuj();}catch(e){allegroMapowanieMasowe={...allegroMapowanieMasowe,busy:false,error:e.message||String(e)};toast("⚠️ Mapowanie grupowe: "+(e.message||e));renderuj();}
}
async function allegroAutomapujOferty(){return allegroZastosujPewneSugestieMapowania();}
function allegroStatusMapowaniaMeta(status){return ({konflikt:{label:"Błędne połączenie",cls:"bad",icon:"⚠️"},sugestia:{label:"Pewna sugestia",cls:"suggest",icon:"✨"},niepodpiete:{label:"Niepodpięta",cls:"empty",icon:"○"},sprawdz:{label:"Do sprawdzenia",cls:"review",icon:"?"},poprawne:{label:"Połączenie poprawne",cls:"ok",icon:"✓"}})[status]||{label:status,cls:"review",icon:"?"};}
function allegroDaneKodyHTML(label,obj={},type="offer"){
  const ean=type==="offer"?(obj.ean||obj.gtin):(obj.gtin||obj.ean),external=type==="offer"?obj.externalId:(obj.externalId||obj.sku),code=type==="offer"?(obj.manufacturerCode||obj.producerCode):(obj.kodProducenta||obj.mpn);
  return `<div class="allegro-map-identifiers"><small>${esc(label)}</small><span><em>EAN</em><b>${esc(ean||"—")}</b></span><span><em>EXTERNAL_ID / SKU</em><b>${esc(external||"—")}</b></span><span><em>Kod producenta</em><b>${esc(code||"—")}</b></span></div>`;
}
function allegroProduktMapowanieMiniHTML(p={},evaluation=null,title="Produkt sklepu"){
  return `<div class="allegro-map-product-mini">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><small>${esc(title)}</small><b>${esc(p.nazwa||"Produkt")}</b><p>ID ${esc(p.id)} • ${esc(p.kategoria||"bez kategorii")}</p>${evaluation?`<div class="allegro-evidence-chips">${evaluation.evidence.map(x=>`<span class="ok">✓ ${esc(x)}</span>`).join("")}${evaluation.conflicts.map(x=>`<span class="bad">! ${esc(x)}</span>`).join("")}</div>`:""}</div></div>`;
}
function allegroOfertaMapowanieCardHTML(a){
  const o=a.oferta,m=a.mapped,e=a.current,s=a.correction||(!m?a.suggestion:null),meta=allegroStatusMapowaniaMeta(a.status),checked=zaznaczoneMapowaniaAllegro.has(String(o.id));
  return `<article class="allegro-offer-map-card ${meta.cls}"><header><label class="allegro-map-checkbox"><input type="checkbox" ${checked?"checked":""} onchange="allegroPrzelaczOferteDoCeny(${jsArg(o.id)},this.checked)"><span></span></label><div class="allegro-offer-title-cell">${o.mainImage?`<img src="${esc(o.mainImage)}" alt="" loading="lazy">`:`<span>🏷️</span>`}<div><small>OFERTA ALLEGRO • ID ${esc(o.id)}</small><b>${esc(o.name||"—")}</b><p>${esc(o.priceText||"cena —")} • stan ${esc(o.stockAvailable??"—")} • ${esc(o.status||"—")} • kategoria ${esc(o.categoryId||"—")}</p></div></div><span class="allegro-map-status ${meta.cls}">${meta.icon} ${meta.label}</span></header><div class="allegro-map-compare"><section>${allegroDaneKodyHTML("Dane Allegro",o,"offer")}</section><div class="allegro-map-link-state"><b>${e?`${esc(e.score)}%`:"—"}</b><small>${esc(e?.reason||"brak połączenia")}</small><span>Allegro ↔ sklep</span></div><section>${m?`${allegroProduktMapowanieMiniHTML(m,e,"Aktualnie podpięty produkt")}${allegroDaneKodyHTML("Dane sklepu",m,"product")}`:`<div class="allegro-map-empty-product"><span>○</span><b>Brak produktu sklepu</b><small>Wybierz pewną sugestię albo wyszukaj ręcznie.</small></div>`}</section></div>${a.conflict?`<div class="allegro-map-conflict-note"><b>Agent wykrył sprzeczne połączenie.</b><span>${esc(e?.conflicts?.join(" • ")||"Aktualny produkt nie zgadza się z ofertą")}</span></div>`:""}${s&&String(s.produkt.id)!==String(m?.id)?`<div class="allegro-map-suggestion">${allegroProduktMapowanieMiniHTML(s.produkt,s,"Najlepsza sugestia Agenta")}<div><b>${esc(s.score)}% zgodności</b><small>${esc(s.reason)}${s.occupied.length?` • używany przez ofertę ${esc(s.occupied.join(", "))}`:""}</small>${!s.occupied.length&&s.valid?`<button class="btn" onclick="allegroMapujOferte(${jsArg(o.id)},${jsArg(s.produkt.id)})">${a.conflict?"Napraw połączenie":"Połącz sugestię"}</button>`:`<button class="btn ghost" onclick="allegroOtworzMapowaniePozycji(${jsArg(o.id)},${jsArg(o.name)})">Rozstrzygnij ręcznie</button>`}</div></div>`:""}<footer><button class="btn ${a.conflict||!m?"":"ghost"}" onclick="allegroOtworzMapowaniePozycji(${jsArg(o.id)},${jsArg(o.name)})">${m?"Zmień produkt sklepu":"🧩 Wybierz produkt sklepu"}</button>${m?`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(m.id)}">Otwórz produkt</a><button class="btn ghost" onclick="allegroMapujOferte(${jsArg(o.id)},'')">Odłącz</button>`:!s?`<button class="btn ghost" onclick="allegroDodajProduktZOferty(${jsArg(o.id)})">➕ Utwórz nowy produkt</button>`:""}<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(o.id)}" target="_blank" rel="noopener">Otwórz Allegro ↗</a></footer></article>`;
}
function allegroOfertyTabelaHTML(){
  const q=String(szukajAllegroOfert||"").toLowerCase().trim(),audyt=allegroAudytDuplikatow(),all=(Array.isArray(allegroOferty)?allegroOferty:[]).map(allegroAnalizaMapowaniaOferty),counts={wszystkie:all.length,poprawne:0,konflikt:0,sugestia:0,niepodpiete:0,sprawdz:0,problemy:0,duplikaty:audyt.oferty};all.forEach(a=>{counts[a.status]=(counts[a.status]||0)+1;if(a.status!=="poprawne")counts.problemy++;});
  let rows=all.filter(a=>{if(filtrAllegroOfert==="problemy"&&a.status==="poprawne")return false;if(filtrAllegroOfert==="duplikaty"&&!audyt.offerIds.has(String(a.oferta.id)))return false;if(!["wszystkie","problemy","duplikaty"].includes(filtrAllegroOfert)&&a.status!==filtrAllegroOfert)return false;const o=a.oferta,p=a.mapped,s=a.suggestion?.produkt,txt=`${o.id} ${o.name||""} ${o.externalId||""} ${o.ean||o.gtin||""} ${o.manufacturerCode||o.producerCode||""} ${p?.id||""} ${p?.nazwa||""} ${p?.sku||p?.externalId||""} ${s?.nazwa||""}`.toLowerCase();return !q||txt.includes(q);});
  const priority={konflikt:0,sugestia:1,niepodpiete:2,sprawdz:3,poprawne:4};rows.sort((a,b)=>sortAllegroOfert==="nazwa"?String(a.oferta.name||"").localeCompare(String(b.oferta.name||""),"pl"):sortAllegroOfert==="status"?String(a.oferta.status||"").localeCompare(String(b.oferta.status||"")):priority[a.status]-priority[b.status]||Number(b.suggestion?.score||b.current?.score||0)-Number(a.suggestion?.score||a.current?.score||0));const visible=rows.slice(0,allegroLimitWidokuOfert),selected=[...zaznaczoneMapowaniaAllegro],safeVisible=visible.filter(a=>(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length),safeSelected=all.filter(a=>zaznaczoneMapowaniaAllegro.has(String(a.oferta.id))&&(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length);
  return `<div class="panel allegro-section-panel allegro-mapping-workspace"><div class="order-section-head"><div><span class="order-pro-label">Powiązanie 1:1 z kartoteką sklepu</span><h2 style="margin-top:.15rem">🏷️ Oferty Allegro i produkty sklepu</h2><p class="order-detail-lead">Najpierw popraw konflikty, potem zatwierdź pewne sugestie. System porównuje EAN, produkt katalogowy, EXTERNAL_ID/SKU, kod producenta i istotne słowa nazwy. Sprzeczne połączenie jest blokowane również przez serwer.</p></div><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia synchronizacji</a></div><div class="allegro-map-stats">${[["⚠️","Konflikty",counts.konflikt,"konflikt"],["✨","Pewne sugestie",counts.sugestia,"sugestia"],["○","Niepodpięte",counts.niepodpiete,"niepodpiete"],["?","Do sprawdzenia",counts.sprawdz,"sprawdz"],["✓","Poprawne",counts.poprawne,"poprawne"]].map(([ico,label,count,id])=>`<button class="${filtrAllegroOfert===id?"active":""}" onclick="filtrAllegroOfert=${jsArg(id)};renderuj()"><span>${ico}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div><div class="orders-toolbar allegro-toolbar"><input placeholder="Szukaj: oferta, produkt, ID, EAN, SKU, EXTERNAL_ID, kod producenta…" value="${esc(szukajAllegroOfert)}" oninput="szukajAllegroOfert=this.value.toLowerCase();renderuj()"><select onchange="filtrAllegroOfert=this.value;renderuj()">${[["problemy",`Wymagające pracy (${counts.problemy})`],["wszystkie",`Wszystkie (${counts.wszystkie})`],["konflikt",`Konflikty (${counts.konflikt})`],["sugestia",`Pewne sugestie (${counts.sugestia})`],["niepodpiete",`Niepodpięte (${counts.niepodpiete})`],["sprawdz",`Do sprawdzenia (${counts.sprawdz})`],["poprawne",`Poprawne (${counts.poprawne})`],["duplikaty",`Duplikaty (${counts.duplikaty})`]].map(([id,label])=>`<option value="${id}" ${filtrAllegroOfert===id?"selected":""}>${label}</option>`).join("")}</select><select onchange="sortAllegroOfert=this.value;renderuj()"><option value="priorytet" ${sortAllegroOfert==="priorytet"?"selected":""}>Najpierw problemy</option><option value="nazwa" ${sortAllegroOfert==="nazwa"?"selected":""}>Nazwa A–Z</option><option value="status" ${sortAllegroOfert==="status"?"selected":""}>Status Allegro</option></select><label class="allegro-view-limit">Pokaż <select onchange="allegroLimitWidokuOfert=Number(this.value)||100;renderuj()">${[50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWidokuOfert===n?"selected":""}>${n}</option>`).join("")}</select></label></div><div class="allegro-map-bulk"><div><b>Operacje na widoku</b><small>${selected.length} zaznaczonych • ${safeVisible.length} bezpiecznych sugestii w bieżącym widoku</small></div><button class="btn ghost" onclick='allegroZaznaczOfertyMapowania(${JSON.stringify(visible.map(a=>String(a.oferta.id)))},true)'>☑️ Zaznacz widoczne</button>${selected.length?`<button class="btn ghost" onclick="zaznaczoneMapowaniaAllegro.clear();renderuj()">Odznacz</button>`:""}<button class="btn" ${allegroMapowanieMasowe.busy||!(selected.length?safeSelected.length:safeVisible.length)?"disabled":""} onclick='allegroZastosujPewneSugestieMapowania(${selected.length?JSON.stringify(selected):JSON.stringify(safeVisible.map(a=>String(a.oferta.id)))})'>${allegroMapowanieMasowe.busy?"⏳ Zapisuję…":`🤖 Zastosuj pewne sugestie${selected.length?" dla zaznaczonych":" w widoku"}`}</button></div>${allegroMapowanieMasowe.error?`<div class="backend-note allegro-mapping-error"><b>Błąd operacji:</b> ${esc(allegroMapowanieMasowe.error)}</div>`:""}${audyt.produkty&&filtrAllegroOfert==="duplikaty"?allegroCentrumDuplikatowHTML(audyt):""}<div class="allegro-offer-map-list">${visible.map(allegroOfertaMapowanieCardHTML).join("")||`<div class="backend-note">Brak ofert pasujących do filtrów.</div>`}</div>${rows.length>visible.length?`<div class="backend-note">Pokazano ${visible.length} z ${rows.length}. Zwiększ limit albo zawęź wyszukiwanie.</div>`:""}</div>`;
}
function allegroBrakiProduktuDoWystawienia(p){
  const braki=[];
  if(!p.nazwa) braki.push("nazwa");
  if(!Number(p.cena)) braki.push("cena");
  if(!(p.gtin||p.ean)) braki.push("EAN");
  if(!(p.kodProducenta||p.mpn||p.externalId||p.sku)) braki.push("kod producenta/SKU");
  if(!(p.producent||p.marka)) braki.push("producent");
  if(!(p.zdjecie||(p.zdjecia||[]).length)) braki.push("zdjęcie");
  if(!p.allegroCategoryId) braki.push("ID kategorii Allegro");
  return braki;
}
function allegroStanOfertyProduktu(){
  const n=Number(allegroStan.offerSettings?.defaultStock??5);
  return Number.isInteger(n)&&n>0?Math.min(99999,n):5;
}
function allegroRozniceOfertyProduktu(p={},o=null){
  if(!o)return ["brak oferty"];
  const roznice=[];
  if(allegroKluczPorownania(p.nazwa)!==allegroKluczPorownania(o.name))roznice.push("nazwa");
  if(Math.abs(kwotaNum(p.cenaAllegro||p.cena)-kwotaNum(o.price))>.009)roznice.push("cena Allegro");
  const stan=allegroStanOfertyProduktu(p);if(Number(o.stockAvailable)!==Number(stan))roznice.push("stan Allegro");
  if((p.zdjecie||(p.zdjecia||[]).length)&&!(o.mainImage||(o.images||[]).length))roznice.push("zdjęcia");
  if((p.opis||p.opisKrotki)&&!o.descriptionText)roznice.push("opis");
  if((p.producent||p.marka)&&allegroKluczPorownania(p.producent||p.marka)!==allegroKluczPorownania(o.brand||""))roznice.push("producent");
  if(p.allegroProductId&&String(o.productId||"")!==String(p.allegroProductId))roznice.push("produkt katalogowy");
  return [...new Set(roznice)];
}
function allegroAktywneZadaniaAgentaOfert(){return (agentAIAllegroZadania||[]).filter(x=>!["wykonane","anulowane"].includes(String(x.status||"").toLowerCase()));}
const ALLEGRO_PROCEDURA_AGENTA_OFERT=[
  "Sprawdź ID oferty i zapisane mapowanie, następnie UUID katalogu, external.id/SKU, EAN, kod producenta i identyczną nazwę.",
  "Jeżeli oferta istnieje — połącz ją z produktem i aktualizuj; nigdy nie twórz duplikatu.",
  "Dobierz produkt katalogowy najpierw po EAN, potem po MPN; nazwę wykorzystuj tylko przy wysokiej zgodności.",
  "Uzupełnij producenta, markę, EAN, MPN, kategorię, UUID, parametry oraz zdjęcia z Katalogu Allegro, jeśli źródło sklepu nie działa.",
  "Nową ofertę zapisuj jako nieaktywną ze stanem magazynowym produktu; brak stanu oznacza 0.",
  "Po sukcesie zapisz potrójne powiązanie produkt sklepu ↔ produkt katalogowy ↔ oferta, odśwież dane i zamknij zadanie Agenta.",
  "Gdy nadal brakuje danych, nie zgaduj — zapisz konkretne braki i błąd API jako jedno zadanie do ponowienia."
];
function allegroProceduraAgentaOfertHTML(){
  return `<details class="backend-note allegro-info-bottom"><summary><b>🤖 Stała procedura Agenta przy dodawaniu oferty</b></summary><ol>${ALLEGRO_PROCEDURA_AGENTA_OFERT.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></details>`;
}
async function allegroAgentUzupelnijZadanieOferty(taskId){
  const task=(agentAIAllegroZadania||[]).find(x=>String(x.id)===String(taskId));if(!task){toast("Nie znaleziono zadania Agenta AI");return;}
  const p=pobierzProduktAdmin(Number(task.productId));if(!p){toast("Produkt z zadania nie istnieje");return;}
  const s=task.suggestions||{},next={...(produktyEdytowane[p.id]||{})};
  for(const key of ["producent","marka","gtin","ean","kodProducenta","mpn","zdjecie","allegroCategoryId","allegroProductId"]){
    if(s[key]&&!p[key])next[key]=String(s[key]);
  }
  if(Array.isArray(s.zdjecia)&&s.zdjecia.length&&!(p.zdjecia||[]).length)next.zdjecia=s.zdjecia.slice(0,15);
  if(Array.isArray(s.allegroParameters)&&s.allegroParameters.length&&!Array.isArray(p.allegroParameters))next.allegroParameters=s.allegroParameters;
  produktyEdytowane[p.id]=next;zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();
  toast("Agent uzupełnił dostępne dane i ponownie sprawdza szkic…");
  await allegroPrzygotujSzkicProduktZListy(p.id);
}
function allegroZadaniaAgentaOfertHTML(){
  const tasks=allegroAktywneZadaniaAgentaOfert();if(!tasks.length)return `<div class="duplicate-audit-ok"><b>✅ Agent AI:</b> brak otwartych zadań dotyczących ofert Allegro.</div>`;
  return `<section class="allegro-agent-tasks"><div class="order-section-head"><div><b>🤖 Zadania przekazane Agentowi AI</b><small>Agent najpierw szuka istniejącej oferty, blokuje duplikat, uzupełnia dane katalogowe i ponawia operację. Zgadywanie brakujących danych jest zabronione.</small></div><a class="btn ghost" href="#/admin/agent-ai">Otwórz Agenta AI</a></div><div class="allegro-agent-task-list">${tasks.slice(0,30).map(t=>`<article><div><b>${esc(t.productName||"Produkt")}</b><small>ID ${esc(t.productId)} • ${esc(t.status||"oczekuje")} • próby: ${esc(t.attempts||1)}</small><p>${[...(t.missing||[]),...(t.errors||[]).map(e=>e.message||e.code)].map(esc).join(" • ")||"Weryfikacja danych"}</p></div><div class="warehouse-worktable-actions"><button class="btn" onclick="allegroAgentUzupelnijZadanieOferty(${jsArg(t.id)})">🤖 Uzupełnij i sprawdź</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(t.productId)}">✏️ Edytuj produkt</a></div></article>`).join("")}</div></section>`;
}
async function allegroPrzygotujSzkicProduktZListy(id){
  const p=pobierzProduktAdmin(Number(id));
  if(!p){ toast("Nie znaleziono produktu"); return; }
  try{
    const d=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:60000});
    allegroZapiszAutoUzupelnienia(p,d);
    const cat=d.categorySuggestion?.selected;
    const saved=cat?.id?allegroZapiszKategorieProduktu(p.id,cat.id):false;
    toast(d.ready?`🟠 Szkic Allegro gotowy technicznie${cat?` — kategoria: ${cat.name}`:""}`:`🟠 Braki: ${((d.missing||[]).join(", ")||"brak")}${cat?` • dobrano kategorię: ${cat.name}`:""}`);
    if(saved) renderuj();
  }catch(e){ allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProduktZListy(id){
  const p=pobierzProduktAdmin(Number(id));
  if(!p){ toast("Nie znaleziono produktu"); return; }
  try{
    const publicationAction=allegroTrybPublikacji();
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(p,d);
    allegroZapiszAutoUzupelnienia(p,d);
    toast(d.operation?.completed===false?`🟠 Oferta ${d.offer?.id||""} jest jeszcze przetwarzana przez Allegro`:d.mode==="updated"?`🟠 Zaktualizowano ofertę ${d.offer?.id||""} bez tworzenia duplikatu`:`🟠 Utworzono nową ofertę ${d.offer?.id||""}`);
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||"";
      produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})};
      zapiszLS("artway_produkty_edytowane",produktyEdytowane);
      allegroZastosujWynikWystawienia(p,d);
      await chmuraWczytajStan().catch(()=>{});
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      renderuj();
    }
  }catch(e){ allegroOstatniBladWystawienia=e;allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Wystawianie Allegro: "+(e.message||e)+" • zadanie przekazano Agentowi AI");renderuj(); }
}
async function allegroAktywujProduktZListy(id){
  const p=pobierzProduktAdmin(Number(id));if(!p){toast("Nie znaleziono produktu");return;}
  const qty=allegroStanOfertyProduktu(p);
  try{
    toast(`Aktywuję ofertę ${p.nazwa} ze stanem Allegro ${qty} szt.…`);
    const product={...p,allegroStock:qty};
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product,options:{stock:qty,publicationAction:"activate",publishNow:true}},timeout:120000});
    allegroOstatniBladWystawienia=null;allegroZapiszWynikOperacji(product,d);allegroZapiszAutoUzupelnienia(product,d);allegroZastosujWynikWystawienia(product,d);
    const categoryId=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||p.allegroCategoryId||"";
    const productId=d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"";
    produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroStock:qty,allegroOfferId:String(d.offer?.id||p.allegroOfferId||""),...(categoryId?{allegroCategoryId:String(categoryId)}:{}),...(productId?{allegroProductId:String(productId)}:{})};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
    await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});zbudujProdukty();
    toast(`✅ Oferta ${d.offer?.id||""} aktywna • stan Allegro ${qty} szt. • magazyn bez zmian`);renderuj();
  }catch(e){allegroOstatniBladWystawienia=e;allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Aktywacja Allegro: "+(e.message||e));renderuj();}
}
async function allegroAktualizujZaznaczoneOfertyDanymiSklepu(){
  const ids=[...zaznaczoneAllegroOferty].slice(0,100),produkty=[...new Map(ids.map(id=>allegroProduktDlaOferty(id)).filter(Boolean).map(p=>[String(p.id),p])).values()];
  if(!produkty.length){toast("Zaznacz powiązane oferty, które mają zostać zaktualizowane danymi sklepu");return;}
  let ok=0,bledy=0;toast(`Aktualizuję ${produkty.length} ofert nowszymi danymi sklepu…`);
  for(const p of produkty){try{const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publicationAction:"keep"}},timeout:120000});allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);ok++;}catch(e){bledy++;allegroOstatniBladWystawienia=e;}}
  zaznaczoneAllegroOferty.clear();await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});
  toast(`Synchronizacja ofert: zaktualizowano ${ok}${bledy?` • do Agenta AI / błędy: ${bledy}`:""}`);renderuj();
}
function allegroPrzelaczOferteDoCeny(id,checked){const set=location.hash.startsWith("#/admin/allegro/oferty")?zaznaczoneMapowaniaAllegro:zaznaczoneAllegroOferty;checked?set.add(String(id)):set.delete(String(id));renderuj();}
let allegroWystawianieWynikiIds=[],allegroWystawianieStronaIds=[];
function allegroZaznaczOfertyProduktow(ids=[],checked=true){
  ids.forEach(raw=>{const id=String(raw),p=pobierzProduktAdmin(Number(raw)),o=p?allegroOfertaDlaProduktuSklepu(p):null;checked?zaznaczoneAllegroProduktyKatalogu.add(id):zaznaczoneAllegroProduktyKatalogu.delete(id);if(o)checked?zaznaczoneAllegroOferty.add(String(o.id)):zaznaczoneAllegroOferty.delete(String(o.id));});renderuj();
}
function allegroPrzelaczProduktKatalogu(id,checked){allegroZaznaczOfertyProduktow([id],checked);}
function allegroZaznaczZakresWystawiania(zakres){allegroZaznaczOfertyProduktow(zakres==="strona"?allegroWystawianieStronaIds:allegroWystawianieWynikiIds,true);}
function allegroWyczyscZaznaczenieOfert(){zaznaczoneAllegroProduktyKatalogu.clear();zaznaczoneAllegroOferty.clear();renderuj();}
function allegroEksportujProduktyWystawiania(zakres="filtr"){
  let ids=allegroWystawianieWynikiIds;
  if(zakres==="zaznaczone")ids=[...zaznaczoneAllegroProduktyKatalogu];
  eksportujProduktyPoIdCSV(ids,zakres==="zaznaczone"?"allegro-produkty-zaznaczone.csv":"allegro-produkty-filtrowane.csv");
}
async function allegroZmienCenyZaznaczonychOfert(){
  const mode=String(document.getElementById("allegroPriceMode")?.value||"percent");
  const value=Number(String(document.getElementById("allegroPriceValue")?.value||"").replace(",","."));
  const ids=[...zaznaczoneAllegroOferty];
  if(!ids.length){ toast("Zaznacz oferty Allegro"); return; }
  if(!Number.isFinite(value)||value===0){ toast("Podaj prawidłową wartość zmiany ceny"); return; }
  try{
    const d=await chmura("allegro-offer-price-change",{method:"POST",body:{offerIds:ids,mode,value},timeout:30000});
    toast(`🟠 Zlecono zmianę cen ${d.offerCount||ids.length} ofert • komenda ${d.commandId}`);
    zaznaczoneAllegroOferty.clear();
    setTimeout(()=>allegroSynchronizujOferty(),2200);
  }catch(e){ toast("⚠️ Zmiana cen Allegro: "+(e.message||e)); }
}
function allegroWystawianiePanelHTML(){
  const q=String(szukajAllegroWystawiania||"").toLowerCase().trim();
  const wszystkie=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const counts={wszystkie:wszystkie.length,aktywne:0,szkice:0,brak:0,gotowe:0,braki:0,do_aktualizacji:0};
  wszystkie.forEach(p=>{const o=allegroOfertaDlaProduktuSklepu(p), br=allegroBrakiProduktuDoWystawienia(p);if(!o)counts.brak++;else if(String(o.status||"").toUpperCase()==="ACTIVE")counts.aktywne++;else counts.szkice++;if(br.length)counts.braki++;else counts.gotowe++;if(o&&allegroRozniceOfertyProduktu(p,o).length)counts.do_aktualizacji++;});
  const pasujace=wszystkie.filter(p=>{
    const o=allegroOfertaDlaProduktuSklepu(p), br=allegroBrakiProduktuDoWystawienia(p);
    if(filtrAllegroWystawiania==="aktywne"&&String(o?.status||"").toUpperCase()!=="ACTIVE")return false;
    if(filtrAllegroWystawiania==="szkice"&&(!o||String(o.status||"").toUpperCase()==="ACTIVE"))return false;
    if(filtrAllegroWystawiania==="brak"&&o)return false;
    if(filtrAllegroWystawiania==="gotowe"&&br.length)return false;
    if(filtrAllegroWystawiania==="braki"&&!br.length)return false;
    if(filtrAllegroWystawiania==="do_aktualizacji"&&(!o||!allegroRozniceOfertyProduktu(p,o).length))return false;
    const txt=`${p.id||""} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||""} ${p.ean||""} ${p.kodProducenta||""} ${p.mpn||""} ${p.producent||""} ${p.marka||""} ${p.allegroOfferId||""}`.toLowerCase();
    return !q||txt.includes(q);
  });
  const rows=pasujace.slice(0,allegroLimitWystawiania);
  allegroWystawianieWynikiIds=pasujace.map(p=>p.id);allegroWystawianieStronaIds=rows.map(p=>p.id);
  const selectedCount=[...zaznaczoneAllegroProduktyKatalogu].filter(id=>wszystkie.some(p=>String(p.id)===id)).length;
  const defaultsAudit=allegroStan.offerDefaultsAudit||{items:{},updated_at:null};
  const defaultsIssues=Object.values(defaultsAudit.items||{}).filter(x=>!x.stockUpdated||!x.republishUpdated);
  const defaultsErrors=[...new Set(defaultsIssues.map(x=>String(x.error||"").trim()).filter(Boolean))].slice(0,3);
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">🟠 Wystawianie produktów na Allegro</h2><p class="order-detail-lead">Tu przygotujesz szkic oferty Allegro z produktu sklepu. Najbezpieczniej twórz ofertę jako nieaktywną, sprawdź parametry w Allegro i dopiero ją aktywuj.</p></div>
      <a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a>
    </div>
    <div class="orders-status-strip">${[["wszystkie","Wszystkie"],["aktywne","Aktywne"],["szkice","Szkice / nieaktywne"],["brak","Brak na Allegro"],["do_aktualizacji","Do aktualizacji"],["gotowe","Gotowe"],["braki","Do uzupełnienia"]].map(([id,label])=>`<button class="${filtrAllegroWystawiania===id?"active":""}" onclick="filtrAllegroWystawiania=${jsArg(id)};renderuj()">${label} <b>${counts[id]||0}</b></button>`).join("")}</div>
    ${adminWyszukiwaniePanelHTML({id:"allegro-products",description:"Produkt sklepu, SKU, EAN, kod producenta, oferta Allegro i stan przygotowania.",results:pasujace.length,active:!!(szukajAllegroWystawiania||filtrAllegroWystawiania!=="wszystkie"),open:true,fields:`<div class="orders-toolbar allegro-toolbar admin-search-full">
      <input placeholder="Szukaj: produkt, SKU, EAN, kod producenta, oferta Allegro…" value="${esc(szukajAllegroWystawiania)}" oninput="szukajAllegroWystawiania=this.value.toLowerCase();renderuj()">
      <label>Pokaż <select onchange="allegroLimitWystawiania=Number(this.value)||250;renderuj()">${[50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWystawiania===n?"selected":""}>${n}</option>`).join("")}</select></label>
      <label>Po zapisie <select id="allegroPublicationAction"><option value="keep">nowa: szkic / istniejąca: bez zmiany statusu</option><option value="activate">aktywuj</option><option value="deactivate">dezaktywuj</option></select></label>
      ${szukajAllegroWystawiania?`<button class="btn ghost" onclick="szukajAllegroWystawiania='';renderuj()">Wyczyść</button>`:""}
    </div>`,actions:adminOperacjeWynikowHTML({id:"allegro-products",selected:selectedCount,pageCount:rows.length,resultCount:pasujace.length,selectPage:"allegroZaznaczZakresWystawiania('strona')",selectAll:"allegroZaznaczZakresWystawiania('filtr')",clear:"allegroWyczyscZaznaczenieOfert()",exportSelected:"allegroEksportujProduktyWystawiania('zaznaczone')",exportAll:"allegroEksportujProduktyWystawiania('filtr')"})})}
    ${allegroWynikOperacjiHTML()}
    <div class="allegro-bulk-toolbar"><div><b>Operacje na ofertach Allegro</b><small>${selectedCount} zaznaczonych • pełne dane synchronizują się automatycznie</small></div><select id="allegroPriceMode"><option value="percent">O procent (+/−)</option><option value="amount">O kwotę (+/−)</option><option value="fixed">Ustaw cenę docelową</option></select><input id="allegroPriceValue" inputmode="decimal" placeholder="np. 10 lub -5" style="max-width:150px"><button class="btn ghost" onclick="allegroZmienCenyZaznaczonychOfert()">💰 Zmień ceny</button></div>
    <div class="warehouse-worktable-wrap"><table class="log-table warehouse-worktable">
      <tr><th>Wybór</th><th>Produkt</th><th>Producent</th><th>EAN / kod prod.</th><th>Oferta Allegro</th><th>Zdjęcia</th><th>Stan synchronizacji</th><th>Akcje</th></tr>
      ${rows.map(p=>{
        const braki=allegroBrakiProduktuDoWystawienia(p);
        const oferta=allegroOfertaDlaProduktuSklepu(p);
        const roznice=oferta?allegroRozniceOfertyProduktu(p,oferta):[];
        return `<tr class="${braki.length||roznice.length?"row-alert":""}">
          <td><input type="checkbox" ${zaznaczoneAllegroProduktyKatalogu.has(String(p.id))?"checked":""} onchange="allegroPrzelaczProduktKatalogu(${jsArg(p.id)},this.checked)"></td>
          <td><b>${esc(p.nazwa)}</b><br><small>ID: ${esc(p.id)}${p.sku?` • SKU: ${esc(p.sku)}`:""}</small></td>
          <td><b>${esc(p.producent||p.marka||"—")}</b><br><small>${p.marka&&p.producent!==p.marka?`marka: ${esc(p.marka)}`:""}</small></td>
          <td><b>${esc(p.gtin||p.ean||"—")}</b><br><small>${esc(p.kodProducenta||p.mpn||p.externalId||"—")}</small></td>
          <td>${allegroStatusProduktuHTML(p)}<br><small>${oferta?`${esc(oferta.priceText||"—")} • stan ${esc(oferta.stockAvailable??"—")}`:`Kategoria: ${esc(p.allegroCategoryId||"—")}`}</small></td>
          <td>${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:"—"}<br><small>${(p.zdjecia||[]).length+(p.zdjecie?1:0)} zdj.</small></td>
          <td>${braki.length?braki.map(b=>`<span class="lvl lvl-ostrzezenie">${esc(b)}</span>`).join(" "):roznice.length?`<span class="lvl lvl-info">nowsze w sklepie: ${esc(roznice.join(", "))}</span>`:`<span class="lvl lvl-ok">zsynchronizowane</span>`}</td>
          <td><div class="warehouse-worktable-actions">
            <a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj dane</a>
            <button class="btn ghost" onclick="allegroPrzygotujSzkicProduktZListy(${jsArg(p.id)})">🧾 Sprawdź szkic</button>
            <button class="btn" onclick="allegroWystawProduktZListy(${jsArg(p.id)})">${oferta?"🤖 Agent: aktualizuj ofertę":"🤖 Agent: dodaj szkic"}</button>
            ${oferta&&String(oferta.status||"").toUpperCase()!=="ACTIVE"?`<div class="allegro-activate-control"><b>${allegroStanOfertyProduktu()} szt.</b><button class="btn" onclick="allegroAktywujProduktZListy(${jsArg(p.id)})">🚀 Aktywuj</button><small>Domyślny stan oferty Allegro: ${allegroStanOfertyProduktu()} szt. • automatyczne wznawianie włączone • magazyn pozostaje ${esc(stanMagazynuId(p.id))} szt.</small></div>`:""}
          </div></td>
        </tr>`;
      }).join("") || `<tr><td colspan="8">Brak produktów w tym filtrze.</td></tr>`}
    </table></div>
    ${pasujace.length>rows.length?`<p class="order-detail-lead">Pokazano ${rows.length} z ${pasujace.length} produktów. Zwiększ limit widoku.</p>`:""}
    ${allegroOstatniBladWystawienia?`<div class="allegro-permission-alert allegro-info-bottom"><div><b>⚠️ Ostatnia próba wystawienia nie powiodła się</b><p>${esc(allegroOstatniBladWystawienia.message||"Błąd Allegro")}</p>${(allegroOstatniBladWystawienia.allegroError?.errors||allegroOstatniBladWystawienia.errors||[]).map(x=>`<small>• ${esc(x.userMessage||x.message||x.code||"błąd")}${x.path?` (${esc(x.path)})`:""}</small>`).join("<br>")}</div><button class="btn ghost" onclick="allegroOstatniBladWystawienia=null;renderuj()">Zamknij</button></div>`:""}
    <div class="backend-note allegro-info-bottom"><b>Reguła wszystkich ofert:</b> domyślny stan sprzedażowy Allegro = <b>${allegroStanOfertyProduktu()} szt.</b>, niezależnie od stanu fizycznego magazynu; wartość możesz zmienić w <a href="#/admin/allegro/ustawienia">Ustawieniach Allegro</a>. Automatyczne wznawianie jest włączane przy każdym utworzeniu i zapisie oferty.${defaultsIssues.length?`<br><span class="lvl lvl-ostrzezenie">${defaultsIssues.length} starszych ofert do uzupełnienia</span> Allegro blokuje w nich wznawianie do czasu uzupełnienia aktualnie wymaganych parametrów. Agent AI ma zapisany audyt i będzie pokazywał je jako zadania.${defaultsErrors.length?`<br><small>${defaultsErrors.map(x=>`• ${esc(skrocTekst(x,220))}`).join("<br>")}</small>`:""}`:` <span class="lvl lvl-ok">Audyt bez wyjątków</span>`}</div>
    <div class="allegro-info-bottom">${allegroZadaniaAgentaOfertHTML()}</div>
    ${allegroProceduraAgentaOfertHTML()}
    <div class="backend-note allegro-info-bottom"><b>Sklep jest źródłem najnowszych danych.</b> Powiązanie zapisuje jednocześnie produkt sklepu, produkt katalogowy Allegro i ofertę. Nazwa, cena, stan, zdjęcia, opis oraz producent są aktualizowane automatycznie z kartoteki sklepu bez tworzenia duplikatu i bez zmiany statusu publikacji.</div>
  </div>`;
}
function allegroDataTxt(v){
  const t=Date.parse(v||"");
  return t?new Date(t).toLocaleString("pl-PL"):"—";
}
function allegroAutoReplyKlucz(type,id,sourceId=""){
  return `${type}:${id}${sourceId?":"+sourceId:""}`;
}
function allegroAutoReplyDla(type,item={}){
  const replies=allegroKomunikacja?.autoReplies||{};
  const source=String(item.latestNewIncomingKey||item.latestNewIncoming?.id||item.latestNewIncoming?.createdAt||"");
  return replies[`${type}:${item.id}:first-contact`]||(source&&replies[allegroAutoReplyKlucz(type,item.id,source)])||replies[allegroAutoReplyKlucz(type,item.id)]||Object.values(replies).find(x=>x?.type===type&&String(x?.id)===String(item.id))||null;
}
function allegroKomunikacjaZalatwiona(item={}){
  return item?.internalResolved===true||item?.internalResolution?.resolved===true;
}
function allegroKomunikacjaWymagaOdpowiedzi(item={}){
  return !allegroKomunikacjaZalatwiona(item)&&!!(item?.humanReplyNeeded||item?.needsReply||Number(item?.newIncomingCount||0)>0);
}
function allegroKomunikacjaObsluzona(item={}){
  return !allegroKomunikacjaWymagaOdpowiedzi(item);
}
function allegroKomunikacjaStaty(){
  const threads=Array.isArray(allegroKomunikacja?.threads)?allegroKomunikacja.threads:[];
  const issues=Array.isArray(allegroKomunikacja?.issues)?allegroKomunikacja.issues:[];
  const replies=allegroKomunikacja?.autoReplies||{};
  const threadNeed=threads.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  const issueNeed=issues.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  return {threads,issues,replies,threadNeed,issueNeed,totalNeed:threadNeed+issueNeed,sent:Object.keys(replies).length};
}
function allegroKomunikacjaBledyHTML(){
  const errors=Array.isArray(allegroKomunikacja?.errors)?allegroKomunikacja.errors:[];
  if(!errors.length) return "";
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth;
  const brakDostepu=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||errors.some(e=>Number(e.status)===403)));
  if(brakDostepu) return `<div class="allegro-permission-alert"><div><b>🔐 Allegro blokuje wiadomości i dyskusje — HTTP 403</b><p>Token oraz deklaracja aplikacji nie mają jeszcze aktywnych uprawnień <code>allegro:api:messaging</code> i <code>allegro:api:disputes</code>. Po rozszerzeniu uprawnień aplikacji trzeba jednorazowo połączyć konto ponownie — starego refresh tokenu nie da się rozszerzyć automatycznie.</p><small>${errors.map(e=>`${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}`).join(" • ")}</small></div><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button></div>`;
  return `<div class="backend-note" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Diagnostyka komunikacji Allegro:</b><br>${errors.map(e=>`• ${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}${e.status?` (HTTP ${esc(e.status)})`:""}`).join("<br>")}</div>`;
}
function allegroReplyFieldId(type,id){return `allegro-reply-${String(type||"thread").replace(/[^a-z0-9_-]/gi,"-")}-${String(id||"").replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroReplyContextId(type,id){return `allegro-reply-context-${String(type||"thread").replace(/[^a-z0-9_-]/gi,"-")}-${String(id||"").replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroKontekstOdpowiedziHTML(context={}){
  if(context.mode==="style")return `<div class="allegro-agent-check-head"><b>✨ Poprawiono wyłącznie styl wpisanego tekstu</b><small>${esc(allegroDataTxt(context.verifiedAt))}</small></div><div class="allegro-agent-check-chips"><span class="ok">bez dodawania nowych faktów</span><span class="info">tylko szkic — nic nie wysłano</span></div>`;
  const shipment=context.shipment||{},checks=context.checks||{},errors=Array.isArray(context.errors)?context.errors:[],history=context.history||{};
  const conversation=context.conversation||{};
  const chips=[
    [conversation.messageCount>0?(history.live?"ok":"warn"):"warn",conversation.messageCount>0?`${history.live?"Pełna historia Allegro":"Historia z bezpiecznej kopii"}: ${conversation.messageCount} wiadomości`:`Brak historii rozmowy`],
    [conversation.relatedConversationCount>0?"info":"ok",conversation.relatedConversationCount>0?`Poprzednie sprawy klienta: ${conversation.relatedConversationCount}`:"Brak innych spraw klienta"],
    [context.orderFound?"ok":"warn",context.orderFound?`Zamówienie ${context.orderId}`:"Brak jednoznacznego zamówienia"],
    [checks.liveOrder?"ok":"warn",checks.liveOrder?`Status Allegro: ${context.statusLabel||context.status||"sprawdzony"}`:"Status bieżący niedostępny"],
    [checks.shipments?"ok":"warn",shipment.tracking?`Numer nadania: ${shipment.tracking}`:shipment.sent?"Wysłane — bez numeru w danych":"Brak potwierdzonego nadania"],
    [checks.warehouse?context.shortages>0?"bad":"ok":"info",checks.warehouse?(context.shortages>0?`Braki magazynowe: ${context.shortages} szt.`:"Magazyn sprawdzony"):"Brak analizy magazynowej"],
    [checks.localShipping?"ok":"info",checks.localShipping?"Sprawdzono obsługę InPost w sklepie":"Brak lokalnej przesyłki"],
  ];
  return `<div class="allegro-agent-check-head"><b>🧠 Agent dopasował szkic do całej rozmowy i danych zamówienia</b><small>${esc(allegroDataTxt(context.verifiedAt))}</small></div><div class="allegro-agent-check-chips">${chips.map(([cls,label])=>`<span class="${cls}">${esc(label)}</span>`).join("")}</div>${history.truncated?`<small class="allegro-agent-check-warning">Rozmowa przekroczyła bezpieczny limit pobierania; wykorzystano ${esc(conversation.messageCount||0)} najnowszych wiadomości.</small>`:""}${!history.live&&history.error?`<small class="allegro-agent-check-warning">Nie udało się odświeżyć pełnego archiwum Allegro. Wykorzystano zachowaną historię: ${esc(history.error)}</small>`:""}${(conversation.warnings||[]).map(warning=>`<small class="allegro-agent-check-warning">${esc(warning)}</small>`).join("")}${conversation.contradictoryReshipmentRemoved?`<small class="allegro-agent-check-warning">Usunięto propozycję kolejnej przesyłki, ponieważ klient wyraźnie jej odmówił.</small>`:""}${errors.length?`<small class="allegro-agent-check-warning">Nie wszystkie źródła odpowiedziały: ${errors.map(esc).join(" • ")}. Propozycja nie zgaduje brakujących danych.</small>`:""}`;
}
async function allegroAgentPropozycjaOdpowiedzi(type,id,mode="context"){
  const field=document.getElementById(allegroReplyFieldId(type,id));
  const before=String(field?.value||"");
  if(!field){toast("Nie znaleziono pola odpowiedzi");return;}
  if(mode==="style"&&!before.trim()){toast("Najpierw wpisz treść do poprawy stylistycznej");field.focus();return;}
  const box=field.closest(".allegro-reply-box"),buttons=[...(box?.querySelectorAll("[data-reply-improve]")||[])];
  buttons.forEach(button=>{button.disabled=true;button.setAttribute("aria-busy","true");});
  try{
    const d=await chmura("allegro-reply-suggestion",{method:"POST",body:{type,id,mode,draft:before},timeout:30000});
    if(field){field.dataset.previousDraft=before;field.dataset.lastImprovement=mode;field.value=d.suggestion||before;field.focus();field.dispatchEvent(new Event("input",{bubbles:true}));}
    const contextBox=document.getElementById(allegroReplyContextId(type,id));if(contextBox){contextBox.innerHTML=allegroKontekstOdpowiedziHTML(d.context||{});contextBox.hidden=false;}
    const undo=box?.querySelector("[data-reply-undo]");if(undo)undo.hidden=false;
    toast(mode==="style"?"✨ Poprawiono styl szkicu — nic nie wysłano":"🧠 Dopasowano szkic do całej rozmowy — sprawdź go przed wysłaniem");
  }catch(e){toast("⚠️ Poprawa odpowiedzi przez Agenta AI: "+(e.message||e));}
  finally{buttons.forEach(button=>{button.disabled=false;button.removeAttribute("aria-busy");});}
}
function allegroCofnijPopraweOdpowiedzi(type,id){
  const field=document.getElementById(allegroReplyFieldId(type,id));if(!field||field.dataset.previousDraft===undefined)return;
  const current=field.value;field.value=field.dataset.previousDraft;field.dataset.previousDraft=current;field.focus();field.dispatchEvent(new Event("input",{bubbles:true}));toast("↩️ Przywrócono poprzednią wersję szkicu — nic nie wysłano");
}
async function allegroWyslijOdpowiedz(type,id){
  const field=document.getElementById(allegroReplyFieldId(type,id));
  const text=String(field?.value||"").trim();
  if(!text){toast("Wpisz odpowiedź albo użyj propozycji Agenta AI");return;}
  if(field.dataset.sending==="1")return;
  const sendButton=field.closest(".allegro-reply-box")?.querySelector("[data-reply-send]");field.dataset.sending="1";if(sendButton){sendButton.disabled=true;sendButton.setAttribute("aria-busy","true");}
  try{
    const d=await chmura("allegro-send-reply",{method:"POST",body:{type,id,text},timeout:30000});
    allegroKomunikacja={...allegroKomunikacja,threads:Array.isArray(d.threads)?d.threads:allegroKomunikacja.threads,issues:Array.isArray(d.issues)?d.issues:allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at,sprawdzono:true};
    allegroZapiszCache();toast("Odpowiedź została wysłana przez Allegro ✅");renderuj();
  }catch(e){toast("⚠️ Wysyłanie odpowiedzi Allegro: "+(e.message||e));}
  finally{field.dataset.sending="0";if(sendButton){sendButton.disabled=false;sendButton.removeAttribute("aria-busy");}}
}
function allegroTypAutoraHTML(m={}){
  const explicit=String(m.authorType||"").toLowerCase(),role=String(m.role||"").toUpperCase(),login=String(m.authorLogin||"").toLowerCase();
  if(["buyer","seller","allegro"].includes(explicit))return explicit;
  if(m.system===true||["ADMIN","ALLEGRO","SYSTEM","MODERATOR"].includes(role)||/^(allegro|administrator|admin|system|moderator)([-_. ]|$)/i.test(login))return "allegro";
  if(role==="BUYER"||m.incoming===true)return "buyer";
  if(role==="SELLER"||m.seller===true||m.incoming===false)return "seller";
  return "allegro";
}
function allegroHistoriaRozmowyHTML(messages=[]){
  const sorted=(Array.isArray(messages)?messages:[]).slice().sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
  return `<div class="allegro-conversation">${sorted.map(m=>{const author=allegroTypAutoraHTML(m),buyer=author==="buyer",system=author==="allegro",label=buyer?`👤 ${esc(m.authorLogin||"Klient")}`:system?"🔔 Allegro / wiadomość systemowa":"🏪 Artway-TM";return `<div class="allegro-message ${buyer?"incoming":system?"system":"seller"}"><div><b>${label}</b><small>${esc(allegroDataTxt(m.createdAt))}</small></div><p>${esc(m.text||"Wiadomość bez treści")}</p></div>`;}).join("")||`<div class="backend-note">Brak treści wiadomości w lokalnym podglądzie.</div>`}</div>`;
}
function allegroInternalNoteId(type,id){return `allegro-internal-note-${String(type)}-${String(id).replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroZaznaczeniaKomunikacji(type){return type==="issue"?zaznaczoneAllegroDyskusje:zaznaczoneAllegroWiadomosci;}
function allegroPrzelaczZaznaczenieKomunikacji(type,id,checked){const set=allegroZaznaczeniaKomunikacji(type);checked?set.add(String(id)):set.delete(String(id));renderuj();}
function allegroSzukajKomunikacje(type,value){
  if(type==="issue")szukajAllegroDyskusji=String(value||"");else szukajAllegroWiadomosci=String(value||"");
  clearTimeout(window.__allegroCommunicationSearchTimer);window.__allegroCommunicationSearchTimer=setTimeout(()=>{renderuj();setTimeout(()=>{const el=document.getElementById(type==="issue"?"allegroIssueSearch":"allegroThreadSearch");if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0);},280);
}
function allegroUstawFiltrKomunikacji(type,value){
  if(type==="issue")filtrAllegroDyskusji=String(value||"wszystkie");else filtrAllegroWiadomosci=String(value||"wszystkie");
  allegroLimitKomunikacji=Math.max(50,allegroLimitKomunikacji);renderuj();
  setTimeout(()=>document.querySelector(".allegro-communication-list")?.scrollIntoView({behavior:"smooth",block:"start"}),30);
}
function allegroAktywujKafelkiKomunikacji(type="thread"){
  const root=document.querySelector(".allegro-communication-page"),cards=[...(root?.querySelectorAll(":scope > .orders-stat-grid .order-stat-card")||[])],values=["wszystkie","wymaga","zalatwione","obsluzone"],current=type==="issue"?filtrAllegroDyskusji:filtrAllegroWiadomosci;
  cards.forEach((card,index)=>{const value=values[index];if(!value)return;card.classList.add("stat-filter");card.classList.toggle("active",current===value);card.setAttribute("role","button");card.setAttribute("tabindex","0");card.setAttribute("aria-pressed",String(current===value));card.onclick=()=>allegroUstawFiltrKomunikacji(type,value);card.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();allegroUstawFiltrKomunikacji(type,value);}};});
}
function allegroTekstKomunikacji(item={}){return `${item.id||""} ${item.buyerLogin||""} ${item.subject||""} ${item.orderId||""} ${(item.messages||[]).map(m=>`${m.authorLogin||""} ${m.text||""} ${m.orderId||""}`).join(" ")}`.toLowerCase();}
function allegroKomunikacjaPasujaca(type="thread"){
  const list=type==="issue"?(allegroKomunikacja?.issues||[]):(allegroKomunikacja?.threads||[]),q=String(type==="issue"?szukajAllegroDyskusji:szukajAllegroWiadomosci).toLowerCase().trim(),filter=type==="issue"?filtrAllegroDyskusji:filtrAllegroWiadomosci,sort=type==="issue"?sortAllegroDyskusje:sortAllegroWiadomosci;
  return list.filter(item=>{
    if(q&&!allegroTekstKomunikacji(item).includes(q))return false;
    const need=allegroKomunikacjaWymagaOdpowiedzi(item),resolved=allegroKomunikacjaZalatwiona(item),status=String(item.status||"").toUpperCase(),closed=/CLOSED|RESOLVED|CANCELLED|REJECTED/.test(status)||item.chatActive===false;
    if(filter==="wymaga"&&!need)return false;if(filter==="zalatwione"&&!resolved)return false;if(filter==="obsluzone"&&!allegroKomunikacjaObsluzona(item))return false;if(filter==="aktywne"&&closed)return false;if(filter==="zamkniete"&&!closed)return false;
    return true;
  }).sort((a,b)=>{const ad=Date.parse(a.lastMessageDateTime||a.lastMessage?.createdAt||a.openedDate||0)||0,bd=Date.parse(b.lastMessageDateTime||b.lastMessage?.createdAt||b.openedDate||0)||0;return sort==="najstarsze"?ad-bd:bd-ad;});
}
function allegroZaznaczWidocznaKomunikacje(type,checked){const set=allegroZaznaczeniaKomunikacji(type);allegroKomunikacjaPasujaca(type).slice(0,allegroLimitKomunikacji).forEach(x=>checked?set.add(String(x.id)):set.delete(String(x.id)));renderuj();}
async function allegroOznaczSpraweWewnetrznie(type,id,resolved=true){
  const note=String(document.getElementById(allegroInternalNoteId(type,id))?.value||"").trim();
  try{const d=await chmura("allegro-communication-resolve",{method:"POST",body:{type,id,resolved,note},timeout:20000});allegroKomunikacja={...allegroKomunikacja,threads:d.threads||allegroKomunikacja.threads,issues:d.issues||allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at};allegroZapiszCache();toast(resolved?"✅ Sprawa trafiła do Obsłużonych — nic nie wysłano klientowi":"↩️ Sprawa przywrócona do obsługi wewnętrznej");renderuj();}catch(e){toast("⚠️ Status wewnętrzny: "+(e.message||e));}
}
async function allegroOznaczZaznaczoneSprawy(type,resolved=true){
  const set=allegroZaznaczeniaKomunikacji(type),items=[...set].map(id=>({type,id,resolved}));if(!items.length){toast("Zaznacz co najmniej jedną sprawę");return;}
  try{const d=await chmura("allegro-communication-resolve",{method:"POST",body:{items},timeout:30000});allegroKomunikacja={...allegroKomunikacja,threads:d.threads||allegroKomunikacja.threads,issues:d.issues||allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at};set.clear();allegroZapiszCache();toast(`✅ ${d.results?.filter(x=>x.ok).length||0} spraw trafiło do Obsłużonych — bez wiadomości do klientów`);renderuj();}catch(e){toast("⚠️ Operacja grupowa: "+(e.message||e));}
}
function allegroRozmowaHTML(type,item={},label="Wiadomość"){
  const sent=allegroAutoReplyDla(type,item),last=item.lastMessage||{},resolved=allegroKomunikacjaZalatwiona(item),nowa=allegroKomunikacjaWymagaOdpowiedzi(item),fieldId=allegroReplyFieldId(type,item.id),contextId=allegroReplyContextId(type,item.id),noteId=allegroInternalNoteId(type,item.id),selected=allegroZaznaczeniaKomunikacji(type).has(String(item.id));
  const messages=Array.isArray(item.messages)&&item.messages.length?item.messages:[last].filter(Boolean);
  const orderId=item.orderId||messages.find(m=>m.orderId)?.orderId||"";
  return `<details class="allegro-conversation-card ${nowa?"needs-reply":""} ${resolved?"is-internally-resolved":""}" ${nowa?"open":""}>
    <summary><label class="allegro-communication-select" onclick="event.stopPropagation()"><input type="checkbox" ${selected?"checked":""} onchange="allegroPrzelaczZaznaczenieKomunikacji(${jsArg(type)},${jsArg(item.id)},this.checked)"></label><span class="allegro-conversation-icon">${type==="issue"?"🛟":"💬"}</span><span><b>${esc(label)} — ${esc(item.buyerLogin||"Klient Allegro")}</b><small>${esc(skrocTekst(last.text||item.subject||"Brak treści",180))}</small></span><span>${resolved?`<span class="lvl lvl-ok">✅ załatwiona wewnętrznie</span>`:nowa?`<span class="lvl lvl-ostrzezenie">wymaga odpowiedzi</span>`:sent?`<span class="lvl lvl-ok">pierwsza odpowiedź wysłana</span>`:`<span class="lvl lvl-info">obsłużona</span>`}</span></summary>
    <div class="allegro-conversation-meta"><span>ID: ${esc(item.id)}</span>${orderId?`<span>Zamówienie: ${esc(orderId)}</span>`:""}<span>Ostatnia: ${esc(allegroDataTxt(item.lastMessageDateTime||last.createdAt||item.openedDate))}</span>${item.status?`<span>Status: ${esc(item.status)}</span>`:""}</div>
    <div class="allegro-internal-resolution"><div><b>✅ Obsługa wewnętrzna</b><small>Ta operacja nie wysyła wiadomości do klienta ani nie zmienia statusu w Allegro. Agent przestanie zgłaszać sprawę do wyjaśnienia. Nowa wiadomość klienta automatycznie otworzy ją ponownie.</small>${resolved&&item.internalResolution?.resolvedAt?`<em>Załatwiono: ${esc(allegroDataTxt(item.internalResolution.resolvedAt))}${item.internalResolution.note?` • ${esc(item.internalResolution.note)}`:""}</em>`:""}</div><input id="${esc(noteId)}" maxlength="1000" value="${esc(item.internalResolution?.note||"")}" placeholder="Notatka wewnętrzna (opcjonalnie)">${resolved?`<button class="btn ghost" type="button" onclick="allegroOznaczSpraweWewnetrznie(${jsArg(type)},${jsArg(item.id)},false)">↩️ Przywróć do obsługi</button>`:`<button class="btn" type="button" onclick="allegroOznaczSpraweWewnetrznie(${jsArg(type)},${jsArg(item.id)},true)">✅ Oznacz jako załatwioną</button>`}</div>
    ${allegroHistoriaRozmowyHTML(messages)}
    <div class="allegro-reply-box"><label for="${esc(fieldId)}"><b>Odpowiedź wychodząca do klienta</b><small>Agent analizuje pełną historię tej rozmowy, a w trybie treści dodatkowo sprawdza zamówienie, status Allegro, magazyn, przesyłkę i numer nadania. Poprawa zmienia wyłącznie poniższy szkic — wiadomość wysyła dopiero osobny niebieski przycisk.</small></label><div id="${esc(contextId)}" class="allegro-agent-check" hidden></div><textarea id="${esc(fieldId)}" rows="6" maxlength="20000" placeholder="Wpisz odpowiedź dla klienta…"></textarea><div class="allegro-reply-safety"><span>🔒 Poprawianie nie wysyła wiadomości. Przed wysłaniem zawsze widzisz pełny tekst.</span><button class="btn ghost" type="button" data-reply-undo hidden onclick="allegroCofnijPopraweOdpowiedzi(${jsArg(type)},${jsArg(item.id)})">↩️ Cofnij poprawę</button></div><div class="diag-actions allegro-reply-actions"><button class="btn ghost" type="button" data-reply-improve="style" onclick="allegroAgentPropozycjaOdpowiedzi(${jsArg(type)},${jsArg(item.id)},'style')">✨ Popraw stylistycznie</button><button class="btn ghost" type="button" data-reply-improve="context" onclick="allegroAgentPropozycjaOdpowiedzi(${jsArg(type)},${jsArg(item.id)},'context')">🧠 Popraw treść według rozmowy</button><button class="btn" type="button" data-reply-send onclick="allegroWyslijOdpowiedz(${jsArg(type)},${jsArg(item.id)})">✉️ Wyślij przez Allegro</button></div></div>
  </details>`;
}
function allegroWatekHTML(t){
  return allegroRozmowaHTML("thread",t,"Wiadomość");
}
function allegroIssueHTML(i){
  return allegroRozmowaHTML("issue",i,i.type==="CLAIM"?"Reklamacja":"Dyskusja");
}
function allegroKomunikacjaPanelLegacyHTML(){
  const st=allegroKomunikacjaStaty();
  const s=allegroKomunikacjaUstawienia();
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth;
  const wymagaPonownegoPolaczenia=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||(allegroKomunikacja?.errors||[]).some(e=>Number(e.status)===403)));
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">💬 Wiadomości, dyskusje i autoresponder Allegro</h2><p class="order-detail-lead">Autoresponder wysyła najwyżej jedną wiadomość: wyłącznie po pierwszej wiadomości klienta w całkowicie nowej rozmowie. Każdy dalszy kontakt wymaga ręcznego zatwierdzenia odpowiedzi przygotowanej po sprawdzeniu zamówienia i wysyłki.</p></div>
      ${wymagaPonownegoPolaczenia?`<button class="btn" onclick="allegroPolacz()">🔐 Napraw połączenie Allegro</button>`:""}
    </div>
    <div class="panel-subtle">
      <div class="order-section-head"><div><h3 style="margin:0">💬 Centrum wiadomości</h3><p class="order-detail-lead">Otwórz rozmowę, zobacz historię, poproś Agenta AI o propozycję i odpowiedz klientowi bez opuszczania sklepu.</p></div></div>
      <div class="ai-task-list">${st.threads.map(allegroWatekHTML).join("") || `<p style="color:var(--muted2)">Brak pobranych wątków. Dane odświeżą się automatycznie.</p>`}</div>
    </div>
    <div class="panel-subtle" style="margin-top:1rem">
      <div class="order-section-head"><div><h3 style="margin:0">🛟 Dyskusje i reklamacje</h3><p class="order-detail-lead">Używane jest nowe API Allegro <code>/sale/issues</code>, a nie stare <code>/sale/disputes</code>.</p></div></div>
      <div class="ai-task-list">${st.issues.map(allegroIssueHTML).join("") || `<p style="color:var(--muted2)">Brak pobranych dyskusji/reklamacji. Dane odświeżą się automatycznie.</p>`}</div>
    </div>
    <div class="orders-stat-grid allegro-info-bottom">
      <div class="order-stat-card ${st.threadNeed?"hot":""}"><span>💬</span><b>${st.threads.length}</b><small>wątki wiadomości</small></div>
      <div class="order-stat-card ${st.issueNeed?"hot":""}"><span>🛟</span><b>${st.issues.length}</b><small>dyskusje/reklamacje</small></div>
      <div class="order-stat-card ${st.totalNeed?"hot":"money"}"><span>⚡</span><b>${st.totalNeed}</b><small>wymaga ręcznej odpowiedzi</small></div>
      <div class="order-stat-card money"><span>✅</span><b>${st.sent}</b><small>auto-odpowiedzi zapisane</small></div>
    </div>
    ${allegroKomunikacjaBledyHTML()}
    <form class="panel-subtle allegro-info-bottom" onsubmit="event.preventDefault();allegroZapiszUstawieniaKomunikacji(this)">
      <div class="order-section-head">
        <div><h3 style="margin:0">⚙️ Ustawienia autorespondera</h3><p class="order-detail-lead">Harmonogram sprawdza komunikację co 15 minut. Automat odpowiada tylko na pierwszą wiadomość klienta w nowym wątku lub nowej dyskusji. Druga i każda kolejna wiadomość nigdy nie uruchamia autorespondera.</p></div>
        <button class="btn" type="submit">💾 Zapisz ustawienia</button>
      </div>
      <div class="form-grid">
        <label class="check"><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Autoresponder aktywny</label>
        <label class="check"><input type="checkbox" name="messageCenter" ${s.messageCenter?"checked":""}> Centrum wiadomości</label>
        <label class="check"><input type="checkbox" name="issues" ${s.issues?"checked":""}> Dyskusje i reklamacje</label>
        <label class="check"><input type="checkbox" name="telegramReminders" ${s.telegramReminders!==false?"checked":""}> Telegram: przypominaj tylko o nowych rozmowach wymagających odpowiedzi</label>
        <div class="f-group"><label>Odpowiadaj tylko na wiadomości z ostatnich godzin</label><input name="freshHours" type="number" min="1" max="168" value="${esc(s.freshHours||48)}"></div>
      </div>
      <div class="f-group"><label>Treść automatycznej pierwszej odpowiedzi <small style="font-weight:400;color:var(--muted2)">zmienne: {login}, {typ}</small></label><textarea name="template" rows="7" maxlength="2000">${esc(s.template||"")}</textarea></div>
    </form>
  </div>`;
}
function allegroKomunikacjaUstawieniaHTML(){
  const s=allegroKomunikacjaUstawienia();return `<form class="panel-subtle allegro-info-bottom" onsubmit="event.preventDefault();allegroZapiszUstawieniaKomunikacji(this)"><div class="order-section-head"><div><h3 style="margin:0">⚙️ Ustawienia pierwszej odpowiedzi</h3><p class="order-detail-lead"><b>Twarda reguła:</b> automat odpowiada tylko raz — na pierwszy kontakt w nowej rozmowie. Kolejne wiadomości wyłącznie otwierają zadanie dla obsługi i Agenta. Wewnętrznie załatwione sprawy są pomijane przez przypomnienia Telegram.</p></div><button class="btn" type="submit">💾 Zapisz ustawienia</button></div><div class="form-grid"><label class="check"><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Pierwsza odpowiedź automatyczna aktywna</label><label class="check"><input type="checkbox" name="messageCenter" ${s.messageCenter?"checked":""}> Nowe wątki Centrum wiadomości</label><label class="check"><input type="checkbox" name="issues" ${s.issues?"checked":""}> Nowe dyskusje i reklamacje</label><label class="check"><input type="checkbox" name="telegramReminders" ${s.telegramReminders!==false?"checked":""}> Telegram tylko dla nowych spraw wymagających odpowiedzi</label><div class="f-group"><label>Okno świeżości pierwszego kontaktu (godziny)</label><input name="freshHours" type="number" min="1" max="168" value="${esc(s.freshHours||48)}"></div></div><div class="f-group"><label>Treść jednorazowej odpowiedzi powitalnej <small style="font-weight:400;color:var(--muted2)">zmienne: {login}, {typ}</small></label><textarea name="template" rows="7" maxlength="2000">${esc(s.template||"")}</textarea></div></form>`;
}
function allegroKomunikacjaPanelHTML(type="thread"){
  const isIssue=type==="issue",st=allegroKomunikacjaStaty(),all=isIssue?st.issues:st.threads,list=allegroKomunikacjaPasujaca(type),visible=list.slice(0,allegroLimitKomunikacji),set=allegroZaznaczeniaKomunikacji(type),selected=[...set].filter(id=>all.some(x=>String(x.id)===id)),allVisible=!!visible.length&&visible.every(x=>set.has(String(x.id))),need=all.filter(allegroKomunikacjaWymagaOdpowiedzi).length,resolved=all.filter(allegroKomunikacjaZalatwiona).length,handled=all.filter(allegroKomunikacjaObsluzona).length,query=isIssue?szukajAllegroDyskusji:szukajAllegroWiadomosci,filter=isIssue?filtrAllegroDyskusji:filtrAllegroWiadomosci,sort=isIssue?sortAllegroDyskusje:sortAllegroWiadomosci;
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth,wymagaPonownegoPolaczenia=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||(allegroKomunikacja?.errors||[]).some(e=>Number(e.status)===403)));
  const filterOptions=isIssue?[["wszystkie","Wszystkie"],["aktywne","Aktywne w Allegro"],["zamkniete","Zamknięte w Allegro"],["wymaga","Wymagają odpowiedzi"],["zalatwione","Załatwione wewnętrznie"],["obsluzone","Obsłużone"]]:[["wszystkie","Wszystkie"],["wymaga","Wymagają odpowiedzi"],["zalatwione","Załatwione wewnętrznie"],["obsluzone","Obsłużone"]];
  return `<div class="panel allegro-section-panel allegro-communication-page"><div class="order-section-head"><div><span class="order-pro-label">${isIssue?"Zgłoszenia formalne":"Obsługa korespondencji"}</span><h2>${isIssue?"🛟 Dyskusje i reklamacje Allegro":"💬 Centrum wiadomości Allegro"}</h2><p class="order-detail-lead">${isIssue?"Dyskusje i reklamacje są oddzielone od zwykłych wiadomości. Wpisy administratora lub systemu Allegro pozostają w historii, ale nie są traktowane jako wiadomości klienta.":"Przeszukuj historię po kliencie, zamówieniu, treści i identyfikatorze. Odświeżanie oznacza jako nowe wyłącznie wiadomości kupujących, których nie było podczas poprzedniej synchronizacji."}</p></div><div class="diag-actions">${wymagaPonownegoPolaczenia?`<button class="btn" onclick="allegroPolacz()">🔐 Napraw połączenie</button>`:""}<button class="btn ghost" onclick="allegroSynchronizujKomunikacje(false)">↻ Sprawdź nowe wiadomości</button></div></div><div class="orders-stat-grid"><div class="order-stat-card"><span>${isIssue?"🛟":"💬"}</span><b>${all.length}</b><small>wszystkich</small></div><div class="order-stat-card ${need?"hot":""}"><span>⚡</span><b>${need}</b><small>wymaga odpowiedzi • bez załatwionych</small></div><div class="order-stat-card money"><span>✅</span><b>${resolved}</b><small>załatwionych wewnętrznie</small></div><div class="order-stat-card"><span>📁</span><b>${handled}</b><small>obsłużonych łącznie</small></div></div><div class="allegro-communication-toolbar"><input id="${isIssue?"allegroIssueSearch":"allegroThreadSearch"}" placeholder="Szukaj: klient, numer zamówienia, ID, temat lub treść…" value="${esc(query)}" oninput="allegroSzukajKomunikacje(${jsArg(type)},this.value)"><select onchange="${isIssue?"filtrAllegroDyskusji":"filtrAllegroWiadomosci"}=this.value;renderuj()">${filterOptions.map(([v,l])=>`<option value="${v}" ${filter===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="${isIssue?"sortAllegroDyskusje":"sortAllegroWiadomosci"}=this.value;renderuj()"><option value="najnowsze" ${sort==="najnowsze"?"selected":""}>Najnowsze najpierw</option><option value="najstarsze" ${sort==="najstarsze"?"selected":""}>Najstarsze najpierw</option></select><label>Pokaż <select onchange="allegroLimitKomunikacji=Number(this.value)||50;renderuj()">${[20,50,100].map(n=>`<option value="${n}" ${allegroLimitKomunikacji===n?"selected":""}>${n}</option>`).join("")}</select></label></div><div class="allegro-communication-bulk"><label><input type="checkbox" ${allVisible?"checked":""} onchange="allegroZaznaczWidocznaKomunikacje(${jsArg(type)},this.checked)"> Zaznacz/odznacz widoczne (${visible.length})</label><span><b>${selected.length}</b> zaznaczonych</span><button class="btn" onclick="allegroOznaczZaznaczoneSprawy(${jsArg(type)},true)" ${selected.length?"":"disabled"}>✅ Załatw wewnętrznie</button><button class="btn ghost" onclick="allegroOznaczZaznaczoneSprawy(${jsArg(type)},false)" ${selected.length?"":"disabled"}>↩️ Przywróć do obsługi</button></div><div class="allegro-internal-banner"><b>🔒 Status wewnętrzny ma pierwszeństwo</b><span>Po oznaczeniu „załatwione” sprawa znika z „Wymaga odpowiedzi” i trafia także do filtra „Obsłużone”. Nadal pozostaje widoczna w dokładniejszym filtrze „Załatwione wewnętrznie”. Nie wysyła to wiadomości i nie zmienia oficjalnego statusu Allegro. Dopiero rzeczywiście nowa wiadomość klienta może ponownie otworzyć sprawę.</span></div><div class="ai-task-list allegro-communication-list">${visible.map(item=>isIssue?allegroIssueHTML(item):allegroWatekHTML(item)).join("")||`<div class="backend-note">Brak spraw pasujących do wyszukiwania i filtrów.</div>`}</div>${list.length>visible.length?`<p class="order-detail-lead">Pokazano ${visible.length} z ${list.length} wyników. Zwiększ limit widoku.</p>`:""}${allegroKomunikacjaBledyHTML()}${!isIssue?allegroKomunikacjaUstawieniaHTML():`<div class="backend-note allegro-info-bottom"><b>Ustawienia autorespondera</b> znajdują się na podstronie Wiadomości. Status „załatwiona wewnętrznie” zawsze ma pierwszeństwo przed automatyką.</div>`}</div>`;
}
function adminSubnavHTML(items, aktywny){
  const safe = (items||[]).filter(x=>x&&x.id&&x.href&&x.label);
  return `<nav class="panel admin-tabs-panel module-tabs-panel" aria-label="Podsekcje panelu"><div class="shipping-tabs admin-main-tabs">${safe.map(x=>`<a class="${x.id===aktywny?"active":""}" href="${esc(x.href)}" ${x.id===aktywny?'aria-current="page"':""} title="${esc(x.label)}"><span class="tab-label">${esc(x.label)}</span>${x.badge?`<span class="nav-badge">${esc(x.badge)}</span>`:""}</a>`).join("")}</div></nav>`;
}
function magazynSubnavHTML(aktywny="pulpit"){
  const plan=potrzebyZatowarowania(),braki=plan.length;
  const bezLok=plan.filter(x=>!x.meta?.lokalizacja).length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/magazyn",label:"📊 Pulpit"},
    {id:"dostawcy",href:"#/admin/magazyn/dostawcy",label:"🏭 Dostępność producentów",badge:braki||""},
    {id:"stany",href:"#/admin/magazyn/stany",label:"📦 Stany produktów",badge:braki||""},
    {id:"lokalizacje",href:"#/admin/magazyn/lokalizacje",label:"🗺️ Lokalizacje",badge:bezLok||""},
    {id:"plan",href:"#/admin/magazyn/plan",label:"📦 Plan zatowarowania",badge:braki||""},
    {id:"ruchy",href:"#/admin/magazyn/ruchy",label:"🧾 Ruchy i ustawienia"}
  ],aktywny);
}
function infaktSubnavHTML(aktywny="pulpit"){
  return adminSubnavHTML([
    {id:"pulpit",label:"📊 Pulpit",href:"#/admin/infakt"},
    {id:"zamowienia",label:"📦 Zamówienia do faktury",href:"#/admin/infakt/zamowienia"},
    {id:"faktury",label:"🧾 Faktury inFakt",href:"#/admin/infakt/faktury"},
    {id:"dostawcy",label:"🏭 Faktury dostawców",href:"#/admin/infakt/dostawcy"},
    {id:"szkice",label:"📝 Szkice robocze",href:"#/admin/infakt/szkice"},
    {id:"ustawienia",label:"⚙️ Dostęp API",href:"#/admin/infakt/ustawienia"},
  ],aktywny);
}
function agentAISubnavHTML(aktywny="pulpit"){
  const analiza=agentAIAnaliza();
  const aktywneZadania=agentAIAnalizaAktywna(analiza),problemy=aktywneZadania.length;
  const plan=aktywneZadania.length;
  const produktyWdrozenie=agentAIProduktyWdrozenie().length;
  const zlecenia=(agentAIZlecenia||[]).filter(z=>!agentAIStatusZamknietyDlaNowejWersji(z.status)).length;
  const producenciGotowi=(producenciKartoteka||[]).filter(p=>p.active!==false&&p.orderEmail).length;
  const pamiec=(agentAIPamiec||[]).length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/agent-ai",label:"🤖 Pulpit",badge:problemy||""},
    {id:"komendy",href:"#/admin/agent-ai/komendy",label:"💬 Komendy"},
    {id:"plan",href:"#/admin/agent-ai/plan",label:"🧭 Plan operacyjny",badge:plan||""},
    {id:"produkty",href:"#/admin/agent-ai/produkty",label:"✨ Nowe produkty",badge:produktyWdrozenie||""},
    {id:"zlecenia",href:"#/admin/agent-ai/zlecenia",label:"📑 Zlecenia i tabela",badge:zlecenia||""},
    {id:"producenci",href:"#/admin/agent-ai/producenci",label:"🏭 Producenci i kontakt",badge:producenciGotowi||""},
    {id:"telegram",href:"#/admin/agent-ai/telegram",label:"✈️ Telegram",badge:agentAITelegram.stats?.critical||""},
    {id:"pamiec",href:"#/admin/agent-ai/pamiec",label:"🧠 Pamięć",badge:pamiec||""},
    {id:"historia",href:"#/admin/agent-ai/historia",label:"🕓 Historia",badge:Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).length||""}
  ],aktywny);
}
function klienciSubnavHTML(aktywny="lista"){
  const u=pobierzUzytkownikow();
  const admini=u.filter(x=>kontoMaRoleAdmin(x.email)).length;
  return adminSubnavHTML([
    {id:"lista",href:"#/admin/klienci",label:"👥 Lista klientów",badge:u.length},
    {id:"dodaj",href:"#/admin/klienci/dodaj",label:"➕ Dodaj klienta"},
    {id:"uprawnienia",href:"#/admin/klienci/uprawnienia",label:"🛡️ Uprawnienia",badge:admini},
    {id:"zamowienia",href:"#/admin/klienci/zamowienia",label:"📦 Zamówienia klientów"}
  ],aktywny);
}
function eksportSubnavHTML(aktywny="import"){
  return adminSubnavHTML([
    {id:"import",href:"#/admin/eksport",label:"📥 Import produktów"},
    {id:"eksport",href:"#/admin/eksport/eksport",label:"📤 Eksport produktów"},
    {id:"kopie",href:"#/admin/eksport/kopie",label:"💾 Kopie i raporty"},
    {id:"aktualizacja",href:"#/admin/aktualizacja",label:"⬆️ Aktualizacja strony"}
  ],aktywny);
}
function aktualizacjaSubnavHTML(aktywny="status"){
  return adminSubnavHTML([
    {id:"status",href:"#/admin/aktualizacja",label:"📡 Status"},
    {id:"publikuj",href:"#/admin/aktualizacja/publikuj",label:"⬆️ Publikuj zmiany"},
    {id:"index",href:"#/admin/aktualizacja/index",label:"📄 Nowy index.html"},
    {id:"kopie",href:"#/admin/aktualizacja/kopie",label:"↩️ Kopie"}
  ],aktywny);
}
function publikacjaSubnavHTML(aktywny="kontrola"){
  return adminSubnavHTML([
    {id:"kontrola",href:"#/admin/publikacja",label:"✅ Gotowość"},
    {id:"pliki",href:"#/admin/publikacja/pliki",label:"📁 Pliki i hosting"},
    {id:"kroki",href:"#/admin/publikacja/kroki",label:"🧭 Kroki publikacji"},
    {id:"aktualizacja",href:"#/admin/aktualizacja",label:"⬆️ Aktualizacja"}
  ],aktywny);
}
function allegroZgodnoscPozycje(){
  const items=Array.isArray(allegroStan.complianceAudit?.items)?allegroStan.complianceAudit.items:[],q=String(szukajAllegroZgodnosc||"").trim().toLowerCase();
  return items.filter(item=>{
    const text=[item.offerId,item.name,item.status,...(item.violations||[]).flatMap(v=>[v.label,...(v.matches||[])])].join(" ").toLowerCase();
    const filtrOk=filtrAllegroZgodnosc==="wszystkie"||(filtrAllegroZgodnosc==="naruszenia"&&!item.ok)||(filtrAllegroZgodnosc==="naprawione"&&item.fixed)||(filtrAllegroZgodnosc==="poprawne"&&item.ok&&!item.fixed)||(filtrAllegroZgodnosc==="bledy"&&item.error);
    return filtrOk&&(!q||text.includes(q));
  });
}
function allegroZaznaczZgodnosc(ids=[],checked=true){for(const id of ids)checked?zaznaczoneAllegroZgodnosc.add(String(id)):zaznaczoneAllegroZgodnosc.delete(String(id));renderuj();}
async function allegroAudytujZgodnosc({fix=false,offerIds=[],offerId=""}={}){
  if(allegroZgodnoscBusy)return;
  allegroZgodnoscBusy=true;renderuj();
  try{
    const body={fix,activeOnly:true,limit:50};if(offerId)body.offerId=String(offerId).trim();if(Array.isArray(offerIds)&&offerIds.length)body.offerIds=offerIds.map(String).slice(0,50);
    const d=await chmura("allegro-offer-compliance",{method:"POST",body,timeout:180000});
    allegroStan={...allegroStan,complianceAudit:{items:Array.isArray(d.items)?d.items:[],summary:d.summary||{},updated_at:d.updated_at||null,policy:d.policy||null}};
    if(fix)zaznaczoneAllegroZgodnosc.clear();
    const s=d.summary||{};toast(fix?`✅ Kontrola Allegro: naprawiono ${s.fixed||0}, pozostało ${s.remaining||0}`:`🛡️ Sprawdzono ${s.checked||0} ofert • naruszenia: ${s.violations||0}`);
  }catch(e){toast("⚠️ Kontrola zgodności: "+(e.message||e));}
  allegroZgodnoscBusy=false;renderuj();
}
function allegroSprawdzOferteZFormularza(form,fix=false){const id=String(new FormData(form).get("offerId")||"").trim();if(!id){toast("Wpisz ID oferty Allegro");return;}void allegroAudytujZgodnosc({offerId:id,fix});}
function allegroZgodnoscPanelHTML(){
  const audit=allegroStan.complianceAudit||{},all=Array.isArray(audit.items)?audit.items:[],items=allegroZgodnoscPozycje(),open=all.filter(x=>!x.ok).length,fixed=all.filter(x=>x.fixed).length,errors=all.filter(x=>x.error).length,selected=[...zaznaczoneAllegroZgodnosc].filter(id=>items.some(x=>String(x.offerId)===id));
  return `<div class="panel allegro-section-panel allegro-compliance-page">
    <div class="order-section-head"><div><span class="order-pro-label">Ochrona konta sprzedawcy</span><h2>🛡️ Zgodność ofert z zasadami Allegro</h2><p class="order-detail-lead">Każdy opis jest oczyszczany i sprawdzany przed utworzeniem albo aktualizacją oferty. Publikacja zostaje zablokowana, jeśli pozostanie zaproszenie do kontaktu, sprawdzania dostępności, negocjacji, dane kontaktowe lub odsyłacz poza Allegro.</p></div><button class="btn" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroAudytujZgodnosc({fix:true})">${allegroZgodnoscBusy?"⏳ Kontroluję…":"🛡️ Sprawdź i napraw 50 ofert"}</button></div>
    <div class="allegro-compliance-guard"><span>✅</span><div><b>Blokada przed publikacją jest zawsze włączona</b><small>Nie można jej wyłączyć ustawieniem. Korekta zachowuje układ opisu Allegro: sekcje, nagłówki, akapity, pogrubienia, listy, zdjęcia i ich kolejność. Usuwany jest wyłącznie niedozwolony fragment.</small></div></div>
    <div class="orders-stat-grid">${[["📋",all.length,"skontrolowanych"],["⚠️",open,"wymaga naprawy"],["✅",fixed,"naprawionych automatycznie"],["⛔",errors,"błędów API"]].map(([i,n,l])=>`<button class="order-stat-card stat-filter ${l.includes("wymaga")&&n?"hot":l.includes("naprawionych")?"money":""}" onclick="filtrAllegroZgodnosc=${jsArg(l.includes("wymaga")?"naruszenia":l.includes("naprawionych")?"naprawione":l.includes("błędów")?"bledy":"wszystkie")};renderuj()"><span>${i}</span><b>${n}</b><small>${l}</small></button>`).join("")}</div>
    <form class="allegro-compliance-single" onsubmit="event.preventDefault();allegroSprawdzOferteZFormularza(this,false)"><div><b>Sprawdź konkretną ofertę</b><small>Wklej ID z adresu oferty, np. 12212218115.</small></div><input name="offerId" inputmode="numeric" placeholder="ID oferty Allegro" required><button class="btn ghost" type="submit" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź</button><button class="btn" type="button" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroSprawdzOferteZFormularza(this.form,true)">Sprawdź i napraw</button></form>
    <div class="orders-toolbar allegro-toolbar"><input placeholder="Szukaj: nazwa, ID, wykryty zwrot…" value="${esc(szukajAllegroZgodnosc)}" oninput="szukajAllegroZgodnosc=this.value;clearTimeout(window.__allegroComplianceSearch);window.__allegroComplianceSearch=setTimeout(()=>renderuj(),250)"><select onchange="filtrAllegroZgodnosc=this.value;renderuj()">${[["naruszenia","Wymaga naprawy"],["wszystkie","Wszystkie wyniki"],["naprawione","Naprawione"],["poprawne","Zgodne"],["bledy","Błędy API"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroZgodnosc===v?"selected":""}>${l}</option>`).join("")}</select><button class="btn ghost" onclick="allegroAudytujZgodnosc({fix:false})" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź 50</button></div>
    <div class="allegro-compliance-bulk"><label class="check"><input type="checkbox" onchange='allegroZaznaczZgodnosc(${JSON.stringify(items.map(x=>String(x.offerId)))},this.checked)'> Zaznacz widoczne (${items.length})</label><span>${selected.length} zaznaczonych</span><button class="btn" ${!selected.length||allegroZgodnoscBusy?"disabled":""} onclick='allegroAudytujZgodnosc({fix:true,offerIds:${JSON.stringify(selected)}})'>Napraw zaznaczone</button></div>
    <div class="warehouse-worktable-wrap"><table class="log-table allegro-compliance-table"><tr><th></th><th>Oferta</th><th>Status</th><th>Wynik kontroli</th><th>Wykryte treści</th><th>Akcje</th></tr>${items.map(item=>`<tr class="${item.ok?"is-safe":"has-risk"}"><td><input type="checkbox" ${zaznaczoneAllegroZgodnosc.has(String(item.offerId))?"checked":""} onchange="allegroZaznaczZgodnosc([${jsArg(String(item.offerId))}],this.checked)"></td><td><b>${esc(item.name||"Oferta")}</b><small>ID ${esc(item.offerId||"—")} • ${esc(item.checkedAt?new Date(item.checkedAt).toLocaleString("pl-PL"):"—")}</small></td><td><span class="lvl ${item.error?"lvl-bad":item.ok?"lvl-ok":"lvl-ostrzezenie"}">${item.error?"błąd API":item.fixed?"naprawiona":item.ok?"zgodna":"blokada"}</span><small>${esc(item.status||"—")}</small></td><td><b>${item.ok?"Brak aktywnego naruszenia":"Wymaga oczyszczenia"}</b>${item.removedCount?`<small>Usunięto ${esc(item.removedCount)} fragmentów</small>`:""}${item.fixed&&item.layoutPreserved===true?`<small>✅ Układ Allegro zachowany</small>`:""}${item.error?`<small class="compliance-error">${esc(item.error)}</small>`:""}</td><td>${(item.violations||[]).map(v=>`<span class="compliance-rule"><b>${esc(v.label)}</b><small>${esc((v.matches||[]).join(" • "))}</small></span>`).join("")||"—"}</td><td><div class="warehouse-worktable-actions"><a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(item.offerId||"")}" target="_blank" rel="noopener">Oferta ↗</a>${!item.ok?`<button class="btn" onclick="allegroAudytujZgodnosc({fix:true,offerId:${jsArg(String(item.offerId))}})" ${allegroZgodnoscBusy?"disabled":""}>Napraw</button>`:""}</div></td></tr>`).join("")||`<tr><td colspan="6">Brak wyników dla wybranego filtra. Uruchom audyt aktywnych ofert.</td></tr>`}</table></div>
    <div class="allegro-compliance-rules"><div><b>Treści usuwane lub blokowane</b><span>kontakt przed zakupem • sprawdzanie dostępności • negocjacja ceny • e-mail • telefon • zewnętrzna strona • sprzedaż poza Allegro</span><small>Wygląd pozostaje w formacie edytora Allegro — korekta nie spłaszcza opisu do zwykłego tekstu.</small></div><div class="diag-actions"><a class="btn ghost" href="https://help.allegro.com/pl/sell/a/sprzedaz-poza-allegro-i-omijanie-oplat-aMloER9LrH8" target="_blank" rel="noopener">Oficjalna zasada ↗</a><a class="btn ghost" href="https://help.allegro.com/pl/sell/c/jak-wystawiac-oferty" target="_blank" rel="noopener">Zasady opisów ↗</a></div></div>
  </div>`;
}
function allegroSubnavHTML(aktywny="start"){
  const st=allegroKomunikacjaStaty();
  const aktywneZamowienia=(allegroZamowienia||[]).filter(statusAllegroRezerwujeMagazyn).length;
  const zadaniaWystawiania=allegroAktywneZadaniaAgentaOfert().length;
  const naruszenia=(allegroStan.complianceAudit?.items||[]).filter(x=>!x.ok).length;
  return adminSubnavHTML([
    {id:"start",href:"#/admin/allegro",label:"📊 Pulpit"},
    {id:"zamowienia",href:"#/admin/allegro/zamowienia",label:"📦 Zamówienia",badge:aktywneZamowienia||""},
    {id:"oferty",href:"#/admin/allegro/oferty",label:"🏷️ Oferty",badge:(allegroOferty||[]).length||""},
    {id:"wystawianie",href:"#/admin/allegro/wystawianie",label:"🟠 Wystawianie",badge:zadaniaWystawiania||""},
    {id:"rentownosc",href:"#/admin/allegro/rentownosc",label:"📈 Opłacalność"},
    {id:"wiadomosci",href:"#/admin/allegro/wiadomosci",label:"💬 Wiadomości",badge:st.threadNeed||""},
    {id:"dyskusje",href:"#/admin/allegro/dyskusje",label:"🛟 Dyskusje",badge:st.issueNeed||""},
    {id:"tabela",href:"#/admin/zamowienia/tabela",label:"📑 Tabela operacyjna"},
    {id:"zgodnosc",href:"#/admin/allegro/zgodnosc",label:"🛡️ Zgodność",badge:naruszenia||""},
    {id:"ustawienia",href:"#/admin/allegro/ustawienia",label:"⚙️ Ustawienia"}
  ],aktywny);
}
function allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete){
  const cfg={
    start:{ico:"🟠",kicker:"Centrum Allegro",title:"Pulpit integracji",opis:"Jedno miejsce do kontroli zamówień, katalogu ofert, wystawiania i komunikacji.",metryki:[["Połączenie",allegroStan.connected?"Aktywne":"Wymaga uwagi"],["Oferty",(allegroOferty||[]).length],["Zamówienia",(allegroZamowienia||[]).length]]},
    zamowienia:{ico:"📦",kicker:"Sprzedaż",title:"Kolejka zamówień Allegro",opis:"Status zawsze pochodzi z Allegro; agent osobno prowadzi sprawdzenie stanu, lokalizacji, zamówienie u producenta i kompletację.",metryki:[["Do obsługi",(allegroZamowienia||[]).filter(statusAllegroRezerwujeMagazyn).length],["Z brakami",(allegroZamowienia||[]).filter(z=>allegroEtapMagazynu(z)==="braki").length],["Zrealizowane lokalnie",(allegroZamowienia||[]).filter(z=>allegroKategoriaKolejki(z)==="zrealizowane").length]]},
    oferty:{ico:"🏷️",kicker:"Katalog Allegro",title:"Oferty i powiązania",opis:"Profesjonalny katalog ofert z miniaturą, identyfikatorami, ceną, stanem i kontrolą powiązania z produktem sklepu.",metryki:[["Wszystkie",(allegroOferty||[]).length],["Podpięte",mapped],["Do powiązania",niepodpiete]]},
    wystawianie:{ico:"🟠",kicker:"Publikowanie",title:"Przygotowanie ofert",opis:"Kontrola kompletności danych produktu przed utworzeniem bezpiecznego szkicu oferty.",metryki:[["Produkty",produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).length],["Gotowe",produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&!allegroBrakiProduktuDoWystawienia(p).length).length],["Do uzupełnienia",produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&allegroBrakiProduktuDoWystawienia(p).length).length]]},
    rentownosc:{ico:"📈",kicker:"Finanse produktu",title:"Opłacalność sklepu i Allegro",opis:"Dwa oddzielne modele kosztów, osobne cele marży i rekomendowane ceny. Allegro korzysta z prowizji pobieranej bezpośrednio przez API.",metryki:[["Pełne Allegro",produktyDoAdministracji().filter(allegroProduktMaPelneDaneMarzowe).length],["Bez prowizji",produktyDoAdministracji().filter(p=>!p.allegroFeeCalculatedAt).length],["Cele",`Sklep ${sklepDocelowaMarza}% • Allegro ${allegroDocelowaMarza}%`]]},
    wiadomosci:{ico:"💬",kicker:"Obsługa klienta",title:"Centrum wiadomości",opis:"Wyszukiwanie, filtry, historia korespondencji i wewnętrzne zamykanie spraw bez wysyłania wiadomości.",metryki:[["Wątki",allegroKomunikacjaStaty().threads.length],["Do odpowiedzi",allegroKomunikacjaStaty().threadNeed],["Załatwione",allegroKomunikacjaStaty().threads.filter(allegroKomunikacjaZalatwiona).length]]},
    dyskusje:{ico:"🛟",kicker:"Dyskusje i reklamacje",title:"Obsługa zgłoszeń Allegro",opis:"Oddzielny rejestr dyskusji i reklamacji z filtrami oficjalnego statusu oraz statusem wewnętrznym.",metryki:[["Zgłoszenia",allegroKomunikacjaStaty().issues.length],["Do odpowiedzi",allegroKomunikacjaStaty().issueNeed],["Załatwione",allegroKomunikacjaStaty().issues.filter(allegroKomunikacjaZalatwiona).length]]},
    zgodnosc:{ico:"🛡️",kicker:"Bezpieczeństwo sprzedaży",title:"Kontrola zgodności ofert",opis:"Stała blokada niedozwolonych treści przed publikacją oraz audyt i bezpieczna naprawa opisów już wystawionych ofert.",metryki:[["Skontrolowane",(allegroStan.complianceAudit?.items||[]).length],["Otwarte",(allegroStan.complianceAudit?.items||[]).filter(x=>!x.ok).length],["Naprawione",(allegroStan.complianceAudit?.items||[]).filter(x=>x.fixed).length]]},
    ustawienia:{ico:"⚙️",kicker:"Konfiguracja",title:"Ustawienia integracji Allegro",opis:"Połączenie OAuth, zakresy uprawnień, środowisko i kontrola synchronizacji w jednym miejscu.",metryki:[["API",allegroStan.configured?"OK":"Brak"],["OAuth",allegroStan.connected?"Połączone":"Rozłączone"],["Środowisko",allegroStan.env||"production"]]}
  }[aktywna]||{};
  return `<section class="panel allegro-workspace-section"><div class="allegro-workspace-title"><span>${cfg.ico||"🟠"}</span><div><small>${esc(cfg.kicker||"Allegro")}</small><h2>${esc(cfg.title||"Panel Allegro")}</h2><p>${esc(cfg.opis||"")}</p></div></div><div class="allegro-workspace-metrics">${(cfg.metryki||[]).map(([l,v])=>`<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join("")}</div></section>`;
}
function allegroStartPanelHTML(mapped,niepodpiete){
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div>
        <h2 style="margin-top:0">Panel Allegro</h2>
        <p class="order-detail-lead">Zamówienia są pobierane jako całe zlecenia. Każda pozycja jest łączona z aktualnym produktem sklepu po mapowaniu, EAN, SKU, kodzie producenta lub jednoznacznej nazwie, aby poprawnie sprawdzić magazyn, lokalizację i braki do zamówienia.</p>
      </div>
      <div class="diag-actions" style="margin-top:0">
        <a class="btn" href="#/admin/allegro/zamowienia">📦 Zamówienia Allegro</a>
        <a class="btn ghost" href="#/admin/allegro/oferty">🏷️ Mapuj oferty</a>
        <a class="btn ghost" href="#/admin/allegro/wystawianie">🟠 Wystaw produkt</a>
        <a class="btn ghost" href="#/admin/allegro/rentownosc">📈 Opłacalność</a>
        <a class="btn ghost" href="#/admin/allegro/wiadomosci">💬 Wiadomości</a>
        <a class="btn ghost" href="#/admin/allegro/dyskusje">🛟 Dyskusje</a>
        <a class="btn ghost" href="#/admin/allegro/zgodnosc">🛡️ Zgodność ofert</a>
      </div>
    </div>
    <div class="orders-stat-grid allegro-dashboard-links">
      <a class="order-stat-card stat-filter hot" href="#/admin/allegro/zamowienia" onclick="filtrAllegroZamowien='do_obslugi'"><span>📦</span><b>${(allegroZamowienia||[]).filter(statusAllegroRezerwujeMagazyn).length}</b><small>zamówień do obsługi</small></a>
      <a class="order-stat-card stat-filter" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='wszystkie'"><span>🏷️</span><b>${(allegroOferty||[]).length}</b><small>wszystkich ofert</small></a>
      <a class="order-stat-card stat-filter money" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='poprawne'"><span>🔗</span><b>${mapped}</b><small>poprawnie podpiętych</small></a>
      <a class="order-stat-card stat-filter ${niepodpiete?"hot":""}" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='niepodpiete'"><span>🧩</span><b>${niepodpiete}</b><small>ofert bez produktu</small></a>
      <a class="order-stat-card stat-filter" href="#/admin/allegro/wiadomosci" onclick="filtrAllegroWiadomosci='wymaga'"><span>💬</span><b>${allegroKomunikacjaStaty().threadNeed}</b><small>wiadomości do odpowiedzi</small></a>
      <a class="order-stat-card stat-filter" href="#/admin/allegro/dyskusje" onclick="filtrAllegroDyskusji='aktywne'"><span>🛟</span><b>${allegroKomunikacjaStaty().issues.length}</b><small>dyskusji i reklamacji</small></a>
    </div>
  </div>`;
}
function allegroPostepUstawienHTML(){
  const o=allegroOperacjaUstawien;
  if(!o.busy&&!o.done&&!o.error)return "";
  const pct=o.total?Math.round(o.done/o.total*100):0;
  return `<div class="allegro-settings-progress ${o.error?"has-error":""}"><div><b>${o.busy?`Aktualizuję istniejące oferty: ${o.done}/${o.total}`:o.error?"Aktualizacja przerwana":"Aktualizacja istniejących ofert zakończona"}</b><small>Stan zmieniony: ${o.stockUpdated} • błędy stanu: ${o.stockFailed} • wznawianie: ${o.republishUpdated} • starsze oferty do uzupełnienia: ${o.republishFailed}</small></div><div class="allegro-settings-progress-bar"><i style="width:${pct}%"></i></div>${o.error?`<p>${esc(o.error)}</p>`:""}</div>`;
}
async function allegroZastosujUstawieniaDoIstniejacych(){
  const ids=[...new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean))];
  allegroOperacjaUstawien={busy:true,done:0,total:ids.length,stockUpdated:0,stockFailed:0,republishUpdated:0,republishFailed:0,error:""};renderuj();
  try{
    for(let i=0;i<ids.length;i+=50){
      const batch=ids.slice(i,i+50),d=await chmura("allegro-apply-offer-defaults",{method:"POST",body:{offerIds:batch},timeout:180000});
      allegroOperacjaUstawien={...allegroOperacjaUstawien,done:i+batch.length,stockUpdated:allegroOperacjaUstawien.stockUpdated+Number(d.stockUpdated||0),stockFailed:allegroOperacjaUstawien.stockFailed+Number(d.stockFailed||0),republishUpdated:allegroOperacjaUstawien.republishUpdated+Number(d.republishUpdated||0),republishFailed:allegroOperacjaUstawien.republishFailed+Number(d.republishFailed||0)};
      renderuj();
    }
    const sync=await chmura("allegro-sync-offers",{method:"POST",body:{limit:10000,details:false},timeout:180000});
    allegroOferty=Array.isArray(sync.offers)?sync.offers:allegroOferty;allegroMapowania=sync.mappings||allegroMapowania;
    allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false};
    await allegroWczytajDane(true);allegroZapiszCache();toast(`✅ Stan ${allegroStanOfertyProduktu()} zapisany dla ${allegroOperacjaUstawien.stockUpdated} ofert`);renderuj();
  }catch(e){allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false,error:e.message||String(e)};toast("⚠️ Aktualizacja ofert: "+(e.message||e));renderuj();}
}
async function allegroZapiszUstawieniaOfert(form){
  const fd=new FormData(form),defaultStock=Number(fd.get("defaultStock")),applyExisting=fd.get("applyExisting")==="on";
  if(!Number.isInteger(defaultStock)||defaultStock<1||defaultStock>99999){toast("Podaj stan od 1 do 99999 szt.");return;}
  const producers=String(fd.get("producers")||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).slice(0,50);
  if(!producers.length){toast("Dodaj przynajmniej jednego producenta.");return;}
  try{
    const d=await chmura("allegro-offer-settings",{method:"POST",body:{defaultStock,producers,autoCatalog:fd.get("autoCatalog")==="on",syncDescriptions:fd.get("syncDescriptions")==="on",autoUpdateOffers:fd.get("autoUpdateOffers")==="on",autoFees:fd.get("autoFees")==="on",autoCorrections:fd.get("autoCorrections")==="on"},timeout:12000});
    allegroStan={...allegroStan,offerSettings:d.settings||{defaultStock,republish:true}};
    toast(`Zapisano automatykę Allegro i ${producers.length} producentów.`);renderuj();
    if(applyExisting)await allegroZastosujUstawieniaDoIstniejacych();
  }catch(e){toast("⚠️ Ustawienia ofert Allegro: "+(e.message||e));}
}
async function allegroUruchomAutomatycznaKonserwacje(){
  try{toast("🟠 Agent sprawdza katalog, opisy i producentów…");const d=await chmura("allegro-auto-maintenance",{method:"POST",body:{limit:50},timeout:180000});await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true);const r=d.maintenance||{};toast(`✅ Sprawdzono ${r.scanned||0}, poprawiono ${r.updated||0}, katalog dopasowano dla ${r.matched||0} produktów.`);}catch(e){toast("⚠️ Automatyka katalogu Allegro: "+(e.message||e));}
}
function allegroProduktMaPelneDaneMarzowe(p={}){return kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))&&!!p.allegroFeeCalculatedAt;}
function rentownoscSygnaturaWeryfikacji(p={}){
  const effective=field=>typeof wartoscKosztuProduktu==="function"?wartoscKosztuProduktu(p,field):kwotaNum(p[field]);
  return JSON.stringify({
    purchase:kwotaNum(p.cenaZakupu),storePrice:kwotaNum(p.cena),allegroPrice:kwotaNum(p.cenaAllegro||p.cena),
    commission:kwotaNum(p.allegroCommissionAmount),commissionRate:Number(p.allegroCommissionRate)||0,recurring:kwotaNum(p.allegroRecurringFees),
    packing:effective("kosztPakowania"),storeOther:effective("sklepAdditionalCost"),storePayment:effective("sklepPaymentPercent"),
    allegroOther:effective("allegroAdditionalCost"),shipping:effective("allegroShippingSubsidy"),ads:effective("allegroAdsPercent"),vat:effective("vatRate"),
    storeTarget:Number(p.sklepPriceTargetMargin||sklepDocelowaMarza)||0,allegroTarget:Number(p.allegroPriceTargetMargin||allegroDocelowaMarza)||0,
    recurringUnits:Number(allegroJednostkiOplatCyklicznych)||1
  });
}
function rentownoscStatusWeryfikacji(p={}){
  if(p.profitabilityReviewed!==true)return "unreviewed";
  return String(p.profitabilityReviewSignature||"")===rentownoscSygnaturaWeryfikacji(p)?"reviewed":"outdated";
}
function rentownoscPolaWeryfikacji(p={},approved=true,at=new Date().toISOString()){
  if(!approved)return {profitabilityReviewed:false};
  const store=sklepRentownoscProduktu(p),allegro=allegroRentownoscProduktu(p);
  return {profitabilityReviewed:true,profitabilityReviewedAt:at,profitabilityReviewedBy:sesja?.email||"administrator",profitabilityReviewSignature:rentownoscSygnaturaWeryfikacji(p),profitabilityReviewSnapshot:{storePrice:store.price,allegroPrice:allegro.price,purchasePrice:kwotaNum(p.cenaZakupu),storeMargin:store.margin,allegroMargin:allegro.margin,storeTarget:Number(p.sklepPriceTargetMargin||sklepDocelowaMarza)||0,allegroTarget:Number(p.allegroPriceTargetMargin||allegroDocelowaMarza)||0},profitabilityReviewRevision:1};
}
function rentownoscZapiszWeryfikacje(ids=[],approved=true){
  const unique=[...new Set(ids.map(String))],products=new Map(produktyDoAdministracji().map(p=>[String(p.id),p])),at=new Date().toISOString();let changed=0;
  for(const id of unique){const p=products.get(id);if(!p||czyProduktAdminWKoszu(p))continue;const patch=rentownoscPolaWeryfikacji(p,approved,at),idx=produktyDodane.findIndex(x=>String(x.id)===id);if(idx>=0)produktyDodane[idx]={...produktyDodane[idx],...patch};else produktyEdytowane={...produktyEdytowane,[id]:{...(produktyEdytowane[id]||{}),...patch}};changed++;}
  if(!changed)return 0;
  zapiszLS("artway_produkty_dodane",produktyDodane);zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();zaplanujZapisUstawien();
  zapiszHistorieAgenta("kontrola-rentownosci",`${approved?"Zatwierdzono":"Cofnięto zatwierdzenie"} kalkulacji rentowności: ${changed}`,{productIds:unique.slice(0,500),approved});
  return changed;
}
function ustawFiltrAllegroRentownosc(value="wszystkie"){filtrAllegroRentownosc=value;renderuj();}
function oznaczRentownoscSprawdzona(productId,approved=true){const changed=rentownoscZapiszWeryfikacje([productId],approved);if(changed)toast(approved?"✅ Produkt oznaczony jako sprawdzony według Twojego ustawienia":"Cofnięto oznaczenie produktu jako sprawdzony");renderuj();}
function przelaczZaznaczenieRentownosci(productId,checked){const id=String(productId);checked?zaznaczoneRentownosc.add(id):zaznaczoneRentownosc.delete(id);renderuj();}
function zaznaczWidoczneRentownosc(){for(const {p} of allegroRentownoscLista().slice(0,500))zaznaczoneRentownosc.add(String(p.id));renderuj();}
function wyczyscZaznaczenieRentownosci(){zaznaczoneRentownosc.clear();renderuj();}
function oznaczZaznaczoneRentownosc(approved=true){const ids=[...zaznaczoneRentownosc];if(!ids.length){toast("Najpierw zaznacz produkty");return;}const changed=rentownoscZapiszWeryfikacje(ids,approved);zaznaczoneRentownosc.clear();toast(`${approved?"✅ Oznaczono jako sprawdzone":"Cofnięto oznaczenie"}: ${changed} produktów`);renderuj();}
function rentownoscStatusWeryfikacjiHTML(p={}){const status=rentownoscStatusWeryfikacji(p);if(status==="reviewed"){const snapshot=p.profitabilityReviewSnapshot||{};return `<span class="profit-review-status reviewed"><b>✅ Sprawdzone przeze mnie</b><small>${p.profitabilityReviewedAt?esc(new Date(p.profitabilityReviewedAt).toLocaleString("pl-PL")):"zatwierdzone"}${snapshot.storePrice||snapshot.allegroPrice?` • sklep ${snapshot.storePrice?zl(snapshot.storePrice):"—"} • Allegro ${snapshot.allegroPrice?zl(snapshot.allegroPrice):"—"}`:""}</small></span>`;}if(status==="outdated")return `<span class="profit-review-status outdated"><b>⚠️ Sprawdź ponownie</b><small>Od zatwierdzenia zmieniła się cena, koszt, prowizja lub cel marży.</small></span>`;return `<span class="profit-review-status unreviewed"><b>○ Jeszcze niesprawdzone</b><small>Oznacz po ustawieniu właściwej ceny i marży.</small></span>`;}
function allegroRentownoscLista(){
  const q=String(szukajAllegroRentownosc||"").toLowerCase().trim();let list=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>({p,r:allegroRentownoscProduktu(p)})).filter(({p,r})=>{const review=rentownoscStatusWeryfikacji(p);if(q&&!`${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||""} ${p.kategoria||""}`.toLowerCase().includes(q))return false;if(filtrAllegroRentownosc==="niesprawdzone"&&review!=="unreviewed")return false;if(filtrAllegroRentownosc==="sprawdzone"&&review!=="reviewed")return false;if(filtrAllegroRentownosc==="nieaktualne"&&review!=="outdated")return false;if(filtrAllegroRentownosc==="kompletne"&&!r.dataComplete)return false;if(filtrAllegroRentownosc==="brak_prowizji"&&p.allegroFeeCalculatedAt)return false;if(filtrAllegroRentownosc==="strata"&&r.profit>=0)return false;if(filtrAllegroRentownosc==="niska"&&(!r.dataComplete||r.margin>=allegroDocelowaMarza))return false;if(filtrAllegroRentownosc==="oplacalne"&&(!r.dataComplete||r.margin<allegroDocelowaMarza))return false;return true;});
  list.sort((a,b)=>sortAllegroRentownosc==="marza_malejaco"?b.r.margin-a.r.margin:sortAllegroRentownosc==="nazwa"?String(a.p.nazwa).localeCompare(String(b.p.nazwa),"pl"):a.r.margin-b.r.margin);return list;
}
function produktDlaWyboruMarzy(productId){return produktyDoAdministracji().find(p=>String(p.id)===String(productId))||null;}
function wyborCenyMarzowejHTML(p={},kanal="allegro"){
  const isStore=kanal==="sklep",defaultTarget=isStore?sklepDocelowaMarza:allegroDocelowaMarza,savedTarget=Number(p[isStore?"sklepPriceTargetMargin":"allegroPriceTargetMargin"]),target=Math.max(.1,Math.min(75,Number.isFinite(savedTarget)&&savedTarget>0?savedTarget:defaultTarget)),r=isStore?sklepRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target),presets=[10,15,20,25,30],preset=presets.includes(target)?String(target):"custom";
  return `<div class="profit-price-picker ${isStore?"store":"allegro"}" data-profit-choice data-product-id="${esc(p.id)}" data-channel="${kanal}"><label>Wariant marży<select data-profit-margin-preset onchange="aktualizujWyborCenyMarzowej(this,'preset')">${presets.map(v=>`<option value="${v}" ${preset===String(v)?"selected":""}>${v}% marży</option>`).join("")}<option value="custom" ${preset==="custom"?"selected":""}>Własna marża</option></select></label><div class="profit-price-fields"><label>Marża %<input data-profit-margin type="number" min="0.1" max="75" step="0.1" value="${esc(target)}" oninput="aktualizujWyborCenyMarzowej(this,'margin')"></label><label>Cena zł<input data-profit-price inputmode="decimal" value="${r.recommended?esc(r.recommended.toFixed(2)):""}" oninput="aktualizujWyborCenyMarzowej(this,'price')"></label></div><small data-profit-choice-result>${r.recommended?`Wybrana marża ${target.toFixed(1)}% → ${zl(r.recommended)}`:"Uzupełnij cenę zakupu i koszty"}</small><button class="btn ${isStore?"ghost":""}" type="button" ${r.recommended?"":"disabled"} onclick="zastosujWyborCenyMarzowej(this)">${isStore?"🏪 Zastosuj w sklepie":"🟠 Opublikuj na Allegro"}</button></div>`;
}
function aktualizujWyborCenyMarzowej(el,source="margin"){
  const box=el?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId);if(!p)return;
  const kanal=box.dataset.channel==="sklep"?"sklep":"allegro",preset=box.querySelector("[data-profit-margin-preset]"),marginInput=box.querySelector("[data-profit-margin]"),priceInput=box.querySelector("[data-profit-price]"),result=box.querySelector("[data-profit-choice-result]"),button=box.querySelector("button");
  if(source==="preset"){if(preset.value!=="custom")marginInput.value=preset.value;else marginInput.focus();}
  if(source==="margin")preset.value="custom";
  const target=Math.max(.1,Math.min(75,Number(String(marginInput.value).replace(",","."))||0));
  if(source!=="price"){const recommendation=kanal==="sklep"?sklepRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target);priceInput.value=recommendation.recommended?recommendation.recommended.toFixed(2):"";}
  const price=kwotaNum(priceInput.value),actual=kanal==="sklep"?sklepRentownoscProduktu(p,price,target):allegroRentownoscProduktu(p,price,target);
  result.textContent=price?`Cena ${zl(price)} • zysk ${zl(actual.profit)} • rzeczywista marża ${actual.margin.toFixed(2)}%`:"Wpisz marżę albo własną cenę";button.disabled=!price||kwotaNum(p.cenaZakupu)<=0;
}
async function zastosujWyborCenyMarzowej(button){
  const box=button?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId),kanal=box.dataset.channel==="sklep"?"sklep":"allegro",price=kwotaNum(box.querySelector("[data-profit-price]")?.value);if(!p||!price){toast("Uzupełnij prawidłową cenę");return;}
  const calculation=kanal==="sklep"?sklepRentownoscProduktu(p,price):allegroRentownoscProduktu(p,price);button.disabled=true;button.textContent=kanal==="sklep"?"⏳ Zapisuję…":"⏳ Publikuję…";try{await ustawRekomendowanaCeneProduktu(p.id,kanal,price,calculation.margin);}catch(e){toast("⚠️ Nie udało się zastosować ceny: "+(e.message||e));button.disabled=false;}
}
function allegroScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"allegro");}
function allegroRentownoscPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),complete=all.filter(allegroProduktMaPelneDaneMarzowe),rows=allegroRentownoscLista(),loss=complete.filter(p=>allegroRentownoscProduktu(p).profit<0).length,low=complete.filter(p=>{const r=allegroRentownoscProduktu(p);return r.profit>=0&&r.margin<allegroDocelowaMarza;}).length,good=complete.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length;
  return `<div class="panel allegro-section-panel profitability-page"><div class="order-section-head"><div><span class="order-pro-label">Decyzje cenowe</span><h2>📈 Opłacalność i wyliczenie marżowe</h2><p class="order-detail-lead">Zaawansowany przelicznik dla gier i pozostałych produktów z ceną zakupu, ceną sprzedaży oraz prowizją pobraną z Allegro. Rozdziela prowizję sprzedażową, opłaty cykliczne, reklamę, pakowanie, dopłatę do dostawy i inne koszty.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Pobierz prowizje dla kompletnych produktów</button></div><div class="orders-stat-grid"><div class="order-stat-card"><span>🧮</span><b>${complete.length}</b><small>pełnych kalkulacji</small></div><div class="order-stat-card ${loss?"hot":""}"><span>🔴</span><b>${loss}</b><small>sprzedaż ze stratą</small></div><div class="order-stat-card ${low?"hot":""}"><span>🟡</span><b>${low}</b><small>poniżej celu ${allegroDocelowaMarza}%</small></div><div class="order-stat-card money"><span>🟢</span><b>${good}</b><small>osiąga cel marży</small></div></div><div class="profitability-controls"><input placeholder="Szukaj: nazwa, SKU, EAN, producent, kategoria…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="filtrAllegroRentownosc=this.value;renderuj()">${[["kompletne","Pełne dane"],["wszystkie","Wszystkie produkty"],["brak_prowizji","Brak pobranej prowizji"],["strata","Sprzedaż ze stratą"],["niska","Marża poniżej celu"],["oplacalne","Osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>Cel marży <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="allegroDocelowaMarza=Math.max(1,Math.min(60,Number(this.value)||20));renderuj()">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div><div class="profitability-guide"><b>Jak czytać wynik?</b><span><i class="green"></i> marża osiąga cel</span><span><i class="yellow"></i> dodatni wynik poniżej celu</span><span><i class="red"></i> strata</span><small>Rekomendacja jest oparta na aktualnej procentowej prowizji. Po zmianie ceny pobierz prowizję ponownie, ponieważ Allegro może stosować progi lub stawki minimalne.</small></div><div class="warehouse-worktable-wrap"><table class="log-table profitability-table"><tr><th>Produkt</th><th>Dane wejściowe</th><th>Prowizja i koszty</th><th>Wynik</th><th>Rekomendowana cena</th><th>Akcje</th></tr>${rows.slice(0,500).map(({p,r})=>{const offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||"");const cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit";return `<tr class="${cls}"><td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small>${!r.dataComplete?`<em>Brakuje: ${[!p.cenaZakupu?"ceny zakupu":"",!p.allegroFeeCalculatedAt?"prowizji Allegro":"",!(p.allegroOfferId||p.allegroCategoryId)?"danych oferty":""].filter(Boolean).join(", ")}</em>`:""}</div></div></td><td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Cena Allegro</small><b>${r.price?zl(r.price):"—"}</b></td><td><small>Prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"}</b><br><small>Pozostałe / szt.</small><b>${zl(r.recurringPerUnit+r.packing+r.other+r.shipping+r.ads)}</b>${p.allegroFeeCalculatedAt&&!r.feeCurrent?`<br><span class="lvl lvl-ostrzezenie">przelicz dla nowej ceny</span>`:""}</td><td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"} • narzut ${r.dataComplete?r.markup.toFixed(2)+"%":"—"}</small><em>próg: ${r.breakEven?zl(r.breakEven):"—"}</em></span></td><td><b>${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></td><td><div class="warehouse-worktable-actions"><button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">🟠 Prowizja</button>${r.recommended?`<button class="btn" onclick="allegroUstawRekomendowanaCene(${jsArg(p.id)},${r.recommended})">Ustaw ${zl(r.recommended)}</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6">Brak produktów pasujących do filtrów.</td></tr>`}</table></div><div class="backend-note allegro-info-bottom"><b>Ważne:</b> kalkulator pokazuje rentowność operacyjną jednej sztuki przed podatkiem dochodowym. VAT jest zapisany w kartotece jako informacja do dalszych rozszerzeń księgowych; wynik korzysta z faktycznych kwot sprzedaży, zakupu i opłat podanych w panelu.</div></div>`;
}
function sklepScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"sklep");}
function rentownoscKanalowaPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),rows=allegroRentownoscLista();
  const sklepPelne=all.filter(p=>sklepRentownoscProduktu(p).dataComplete),allegroPelne=all.filter(allegroProduktMaPelneDaneMarzowe);
  const sklepCel=sklepPelne.filter(p=>sklepRentownoscProduktu(p).margin>=sklepDocelowaMarza).length,allegroCel=allegroPelne.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length;
  const reviewCounts=all.reduce((acc,p)=>(acc[rentownoscStatusWeryfikacji(p)]++,acc),{unreviewed:0,reviewed:0,outdated:0}),visible=rows.slice(0,500),allIds=new Set(all.map(p=>String(p.id))),selected=[...zaznaczoneRentownosc].filter(id=>allIds.has(id)).length;
  const reviewCards=[["niesprawdzone","⚠️",reviewCounts.unreviewed,"do sprawdzenia","hot"],["nieaktualne","⏳",reviewCounts.outdated,"do ponownej kontroli",reviewCounts.outdated?"hot":""],["sprawdzone","✅",reviewCounts.reviewed,"sprawdzone przeze mnie","money"],["wszystkie","📦",all.length,"wszystkie produkty",""]];
  return `<div class="panel allegro-section-panel profitability-page">
    <div class="order-section-head"><div><span class="order-pro-label">Dwa niezależne kanały</span><h2>📈 Opłacalność: sklep i Allegro</h2><p class="order-detail-lead">Cena, koszty, cel marży i rekomendacja są liczone osobno. Ustawienie ceny sklepu zmienia kartę sklepu, a ustawienie ceny Allegro zapisuje cenę i od razu aktualizuje powiązaną ofertę oraz prowizję.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Odśwież prowizje Allegro</button></div>
    <div class="profit-channel-summary"><article class="store"><span>🏪</span><div><small>Sklep internetowy</small><b>${sklepCel}/${sklepPelne.length} osiąga cel ${sklepDocelowaMarza}%</b></div></article><article class="allegro"><span>🟠</span><div><small>Allegro</small><b>${allegroCel}/${allegroPelne.length} osiąga cel ${allegroDocelowaMarza}%</b></div></article></div>
    <div class="orders-stat-grid profitability-review-stats">${reviewCards.map(([id,icon,count,label,cls])=>`<button type="button" class="order-stat-card stat-filter ${cls} ${filtrAllegroRentownosc===id?"active":""}" onclick="ustawFiltrAllegroRentownosc(${jsArg(id)})"><span>${icon}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div>
    ${domyslneUstawieniaRentownosciHTML()}
    <div class="profitability-controls"><input placeholder="Szukaj: nazwa, EXTERNAL_ID, SKU, EAN, kod producenta…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="ustawFiltrAllegroRentownosc(this.value)">${[["niesprawdzone","Do sprawdzenia"],["nieaktualne","Do ponownej kontroli"],["sprawdzone","Sprawdzone przeze mnie"],["wszystkie","Wszystkie produkty"],["kompletne","Pełne dane Allegro"],["brak_prowizji","Brak prowizji Allegro"],["strata","Strata na Allegro"],["niska","Allegro poniżej celu"],["oplacalne","Allegro osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża Allegro</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża Allegro</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>🏪 Cel sklepu <input type="number" min="1" max="60" value="${esc(sklepDocelowaMarza)}" onchange="ustawCelMarzy('sklep',this.value)">%</label><label>🟠 Cel Allegro <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="ustawCelMarzy('allegro',this.value)">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div>
    <div class="profitability-review-toolbar"><div><b>${rows.length}</b><span>wyników • <b>${selected}</b> zaznaczonych</span></div><div class="diag-actions"><button class="btn ghost" type="button" onclick="zaznaczWidoczneRentownosc()">Zaznacz widoczne (${visible.length})</button><button class="btn ghost" type="button" onclick="wyczyscZaznaczenieRentownosci()" ${selected?"":"disabled"}>Odznacz</button><button class="btn" type="button" onclick="oznaczZaznaczoneRentownosc(true)" ${selected?"":"disabled"}>✅ Oznacz sprawdzone</button><button class="btn ghost" type="button" onclick="oznaczZaznaczoneRentownosc(false)" ${selected?"":"disabled"}>Cofnij oznaczenie</button></div></div>
    <div class="warehouse-worktable-wrap"><table class="log-table profitability-table profitability-channel-table"><tr><th>Produkt i kontrola</th><th>Zakup i ceny</th><th>🏪 Sklep</th><th>🟠 Allegro</th><th>Rekomendacje kanałów</th><th>Akcje</th></tr>${visible.map(({p,r})=>{const s=sklepRentownoscProduktu(p),offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||""),cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit",review=rentownoscStatusWeryfikacji(p),checked=zaznaczoneRentownosc.has(String(p.id));return `<tr class="${cls} review-${review} ${checked?"is-selected":""}" data-product-row="${esc(p.id)}"><td><div class="profit-product-review-cell"><label class="profit-row-select" title="Zaznacz produkt"><input type="checkbox" ${checked?"checked":""} onchange="przelaczZaznaczenieRentownosci(${jsArg(p.id)},this.checked)"></label><div><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small></div></div>${rentownoscStatusWeryfikacjiHTML(p)}</div></div></td><td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Sklep</small><b>${p.cena?zl(p.cena):"—"}</b><br><small>Allegro</small><b>${r.price?zl(r.price):"—"}</b></td><td><span class="profitability-result ${s.profit<0?"loss":s.margin<sklepDocelowaMarza?"warning":"profit"}"><b>${s.dataComplete?zl(s.profit):"—"}</b><small>marża ${s.dataComplete?s.margin.toFixed(2)+"%":"—"}</small><em>próg ${s.breakEven?zl(s.breakEven):"—"}</em></span><small>Płatność ${s.paymentRate.toFixed(2)}% • inne ${zl(s.other)}</small></td><td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"}</small><em>próg ${r.breakEven?zl(r.breakEven):"—"}</em></span><small>Prowizja ${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"} • wysyłka ${zl(r.shipping)}</small></td><td><div class="profit-recommendation-channel"><b>🏪 ${s.recommended?zl(s.recommended):"—"}</b><div class="profit-scenarios">${sklepScenariuszeMarzyHTML(p)}</div></div><div class="profit-recommendation-channel allegro"><b>🟠 ${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></div></td><td><div class="warehouse-worktable-actions">${s.recommended?`<button class="btn ghost" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'sklep',${s.recommended})">Ustaw sklep ${zl(s.recommended)}</button>`:""}${r.recommended?`<button class="btn" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'allegro',${r.recommended})">Ustaw Allegro ${zl(r.recommended)}</button>`:""}<button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">Prowizja</button><button class="btn ${review==="reviewed"?"ghost":""}" onclick="oznaczRentownoscSprawdzona(${jsArg(p.id)},${review==="reviewed"?"false":"true"})">${review==="reviewed"?"Cofnij sprawdzenie":"✅ Sprawdzone — moje ustawienie"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6">Brak produktów pasujących do aktywnego filtra.</td></tr>`}</table></div>
    <div class="backend-note allegro-info-bottom"><b>Automatyka:</b> dopłata do wysyłki Allegro wynosi domyślnie 3,00 zł. Po ustawieniu ceny Allegro system aktualizuje istniejącą ofertę przez API i ponownie pobiera kalkulację opłat; cena sklepu pozostaje niezależna.</div>
  </div>`;
}
function allegroUstawieniaPanelHTML(){
  const offerStock=allegroStanOfertyProduktu(),audit=Object.values(allegroStan.offerDefaultsAudit?.items||{}),auditOpen=audit.filter(x=>!x.stockUpdated||!x.republishUpdated).length,offerSettings=allegroStan.offerSettings||{},maintenance=allegroStan.catalogMaintenance||{};
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">⚙️ Ustawienia integracji Allegro</h2><p class="order-detail-lead">Konfiguracja techniczna znajduje się na końcu podkart, żeby nie przeszkadzała w codziennej obsłudze zamówień i ofert.</p></div>
      <div class="diag-actions"><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button><button class="btn ghost" onclick="allegroWczytajDane()">📥 Sprawdź połączenie</button></div>
    </div>
    <div class="orders-stat-grid">
      <div class="order-stat-card ${allegroStan.configured?"money":"hot"}"><span>🔧</span><b>${allegroStan.configured?"OK":"BRAK"}</b><small>konfiguracja aplikacji</small></div>
      <div class="order-stat-card ${allegroStan.connected?"money":"hot"}"><span>🔐</span><b>${allegroStan.connected?"TAK":"NIE"}</b><small>autoryzacja OAuth</small></div>
      <div class="order-stat-card"><span>🌐</span><b>${esc(allegroStan.env||"production")}</b><small>środowisko Allegro</small></div>
      <div class="order-stat-card ${allegroStan.requiresReauth?"hot":"money"}"><span>${allegroStan.requiresReauth?"⚠️":"✅"}</span><b>${allegroStan.requiresReauth?"ODŚWIEŻ":"PEŁNE"}</b><small>zakresy uprawnień</small></div>
    </div>
    <form class="panel-subtle allegro-offer-settings-card" onsubmit="event.preventDefault();allegroZapiszUstawieniaOfert(this)">
      <div class="order-section-head"><div><h3 style="margin:0">📦 Domyślny stan i odnawianie ofert</h3><p class="order-detail-lead">Ta liczba trafia do każdej nowej i aktualizowanej oferty Allegro. Jest niezależna od fizycznego stanu magazynu.</p></div><button class="btn" type="submit" ${allegroOperacjaUstawien.busy?"disabled":""}>💾 Zapisz ustawienie</button></div>
      <div class="allegro-offer-settings-grid"><div class="f-group"><label>Domyślny stan każdej oferty Allegro</label><input name="defaultStock" type="number" min="1" max="99999" step="1" required value="${offerStock}"><small>Obecnie: ${offerStock} szt. Cena i stan magazynu pozostają niezależne.</small></div><div class="allegro-renewal-status"><span>♻️</span><div><b>Automatyczne wznawianie: zawsze włączone</b><small>Nowe i aktualizowane oferty otrzymują ustawienie ponownego wystawienia.</small></div></div></div>
      <div class="f-group" style="margin-top:.85rem"><label>Dozwoleni producenci — po jednym wierszu</label><textarea name="producers" rows="4" required>${esc(allegroListaProducentow().join("\n"))}</textarea><small>Agent przypisuje wyłącznie producentów z tej listy. Rozpoznane nazwy „Origami 3D” i produkty ze sklep.alexander.com.pl są normalizowane do Alexander.</small></div>
      <div class="diag-actions" style="align-items:flex-start"><label class="check"><input type="checkbox" name="autoCatalog" ${offerSettings.autoCatalog!==false?"checked":""}> Automatycznie dobieraj katalog i kategorię</label><label class="check"><input type="checkbox" name="syncDescriptions" ${offerSettings.syncDescriptions!==false?"checked":""}> Automatycznie poprawiaj krótki opis, pełny opis i układ</label><label class="check"><input type="checkbox" name="autoUpdateOffers" ${offerSettings.autoUpdateOffers!==false?"checked":""}> Aktualizuj powiązaną ofertę przy zapisie i konserwacji</label><label class="check"><input type="checkbox" name="autoFees" ${offerSettings.autoFees!==false?"checked":""}> Pobieraj prowizję i opłaty po aktualizacji</label><label class="check"><input type="checkbox" name="autoCorrections" ${offerSettings.autoCorrections!==false?"checked":""}> Kwarantanna błędnych powiązań</label></div>
      <label class="check allegro-apply-existing"><input type="checkbox" name="applyExisting"> Po zapisaniu ustaw również nowy stan i wznawianie we wszystkich ${allegroOferty.length} istniejących ofertach</label>
      ${audit.length?`<small>Ostatni audyt: ${audit.length-auditOpen} bez problemu • ${auditOpen} starszych ofert wymaga uzupełnienia danych przed włączeniem wznawiania.</small>`:""}
    </form>
    ${allegroPostepUstawienHTML()}
    <div class="allegro-config-note">
      <b>Zmienne serwera Netlify</b>
      <span>Wymagane: <code>ALLEGRO_CLIENT_ID</code>, <code>ALLEGRO_CLIENT_SECRET</code>. Opcjonalne: <code>ALLEGRO_REDIRECT_URI</code>, <code>ALLEGRO_ENV</code>, <code>ALLEGRO_SCOPE</code>.</span>
      <span>Tokeny i sekrety pozostają wyłącznie na serwerze. Nie są zapisywane w przeglądarce ani w publicznych plikach strony.</span>
      <span>Ostatnia synchronizacja: ${esc(allegroStan.updated_at||"—")}</span>
      ${allegroStan.requiresReauth?`<span style="color:#9a3412"><b>Brakujące zakresy:</b> ${esc((allegroStan.missingAuthorizedScopes||[]).join(", ")||"token wymaga ponownej autoryzacji")}. Kliknij „Połącz Allegro ponownie”.</span>`:""}
    </div>
    <div class="panel-subtle" style="margin-top:1rem">
      <div class="order-section-head"><div><h3 style="margin:0">🔄 Automatyczna synchronizacja danych</h3><p class="order-detail-lead">Serwer sprawdza zamówienia, wiadomości, dyskusje i listę ofert co 15 minut. Pełne szczegóły, opisy oraz kategorie katalogu kontroluje co 6 godzin. Otwarty panel pobiera wyniki co ${Math.round(ALLEGRO_ODSWIEZANIE_PANELU_MS/60000)} minut oraz po powrocie do karty, jeśli minął ten czas — bez przerywania pisania w formularzu.</p></div><button class="btn" onclick="allegroSynchronizujWszystko()">Synchronizuj wszystko teraz</button></div>
      <div class="allegro-schedule-grid"><span><b>📦 Zamówienia</b><small>automatycznie co 15 minut</small></span><span><b>💬 Wiadomości i dyskusje</b><small>automatycznie co 15 minut</small></span><span><b>🏷️ Lista ofert</b><small>lekko co 15 minut • pełny katalog automatycznie co 6 godzin</small></span></div>
      <div class="backend-note allegro-info-bottom"><b>Automatyczna konserwacja katalogu:</b> ${maintenance.lastRun?`ostatnio ${esc(new Date(maintenance.lastRun).toLocaleString("pl-PL"))} • sprawdzono ${esc(maintenance.scanned||0)} • poprawiono ${esc(maintenance.updated||0)}`:"uruchomi się wraz z najbliższą synchronizacją ofert"}. Obejmuje katalog, kategorię, producenta, opis i kontrolę błędnych powiązań.${allegroAutoOdswiezanie.lastChecked?`<br><b>Ostatni odczyt panelu:</b> ${esc(new Date(allegroAutoOdswiezanie.lastChecked).toLocaleString("pl-PL"))}${allegroAutoOdswiezanie.error?` • ${esc(allegroAutoOdswiezanie.error)}`:" • połączenie działa"}.`:""}</div>
      <details class="allegro-manual-sync"><summary>Zaawansowane: uruchom tylko wybraną synchronizację</summary><div class="diag-actions"><button class="btn ghost" onclick="allegroSynchronizujZamowienia()">Zamówienia</button><button class="btn ghost" onclick="allegroSynchronizujOferty()">Oferty</button><button class="btn ghost" onclick="allegroUruchomAutomatycznaKonserwacje()">Katalog, opisy i producenci</button><button class="btn ghost" onclick="allegroSynchronizujKomunikacje(false)">Komunikacja</button><button class="btn ghost" onclick="window.open('https://salescenter.allegro.com/my-sales','_blank','noopener')">Otwórz Sales Center</button></div></details>
    </div>
  </div>`;
}
function widokAdminAllegro(sekcja="start"){
  allegroLadujJesliTrzeba();
  if(["wiadomosci","dyskusje"].includes(sekcja)&&!allegroKomunikacja?.updated_at&&!allegroKomunikacja?.sprawdzono&&!allegroStan.ladowanie) setTimeout(()=>allegroWczytajKomunikacje(true),0);
  if(["wiadomosci","dyskusje"].includes(sekcja)) setTimeout(()=>allegroAktywujKafelkiKomunikacji(sekcja==="dyskusje"?"issue":"thread"),0);
  const mapped=(allegroOferty||[]).filter(o=>allegroProduktDlaOferty(o.id)).length;
  const niepodpiete=Math.max(0,(allegroOferty||[]).length-mapped);
  const aktywna=["zamowienia","oferty","wystawianie","rentownosc","wiadomosci","dyskusje","zgodnosc","ustawienia"].includes(sekcja)?sekcja:"start";
  return adminSzkielet("/admin/allegro", `
  <div class="module-page-stack allegro-module-page">
  ${allegroSubnavHTML(aktywna)}
  ${aktywna==="zamowienia"?allegroZamowieniaTabelaHTML():aktywna==="oferty"?allegroOfertyTabelaHTML():aktywna==="wystawianie"?allegroWystawianiePanelHTML():aktywna==="rentownosc"?rentownoscKanalowaPanelHTML():aktywna==="wiadomosci"?allegroKomunikacjaPanelHTML("thread"):aktywna==="dyskusje"?allegroKomunikacjaPanelHTML("issue"):aktywna==="zgodnosc"?allegroZgodnoscPanelHTML():aktywna==="ustawienia"?allegroUstawieniaPanelHTML():allegroStartPanelHTML(mapped,niepodpiete)}
  ${allegroStan.error?`<div class="backend-note allegro-info-bottom" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Allegro:</b> ${esc(allegroStan.error)}</div>`:""}
  ${allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete)}
  </div>
  `);
}
function decyzjaDostepnosciZamowieniaInfo(z={}){
  const d=z.decyzjaDostepnosci&&typeof z.decyzjaDostepnosci==="object"?z.decyzjaDostepnosci:{},expiresMs=Date.parse(d.expiresAt||""),expired=String(d.code||"").startsWith("wait_")&&Number.isFinite(expiresMs)&&expiresMs<=Date.now();
  const labels={confirmed:"✅ dostępność potwierdzona",wait_1:"⏳ oczekiwanie 1 dzień",wait_2:"⏳ oczekiwanie 2 dni",contact_client:"📞 skontaktować się z klientem",unavailable:"⛔ brak — decyzja o realizacji",reset:"🔎 wymaga ponownej kontroli"};
  return {...d,expired,label:expired?"⏰ minął termin decyzji":labels[d.code]||"brak zapisanej decyzji"};
}
async function ustawDecyzjeDostepnosciZamowienia(nr,code){
  const lista=pobierzZamowienia(),z=lista.find(x=>String(x.nr)===String(nr));if(!z)return;
  const now=new Date(),days=code==="wait_1"?1:code==="wait_2"?2:0,previous=decyzjaDostepnosciZamowieniaInfo(z),labels={confirmed:"Dostępność potwierdzona",wait_1:"Oczekiwanie na potwierdzenie — 1 dzień",wait_2:"Oczekiwanie na potwierdzenie — 2 dni",contact_client:"Brak pewności — skontaktować się z klientem",unavailable:"Brak dostępności potwierdzony",reset:"Ponowna kontrola dostępności"};
  z.decyzjaDostepnosci={code,label:labels[code]||code,at:now.toISOString(),expiresAt:days?new Date(now.getTime()+days*86400000).toISOString():null,operator:sesja?.email||"administrator",history:[{code,at:now.toISOString(),operator:sesja?.email||"administrator"},...(previous.history||[])].slice(0,20)};
  z.wymagaPotwierdzeniaDostepnosci=["wait_1","wait_2","reset"].includes(code);
  zapiszLS("artway_zamowienia",lista);zapiszHistorieAgenta("decyzja-zamowienia",`Zamówienie ${nr}: ${labels[code]||code}`,{nr,code,expiresAt:z.decyzjaDostepnosci.expiresAt});renderuj();
  try{await zapiszZamowienieCentralnie(z,false);toast(`✅ Zapisano decyzję dla zamówienia ${nr}`);}catch(e){toast(`⚠️ Decyzja lokalna zapisana, synchronizacja: ${e.message||e}`);}renderuj();
}
function zastosujWyborDecyzjiZamowienia(nr){const el=document.querySelector(`[data-order-availability-decision="${CSS.escape(String(nr))}"]`);if(el)void ustawDecyzjeDostepnosciZamowienia(nr,el.value);}
function alertDostepnosciZamowieniaHTML(z){
  const lista=Array.isArray(z?.dostepnoscDoPotwierdzenia)?z.dostepnoscDoPotwierdzenia:[];
  const decision=decyzjaDostepnosciZamowieniaInfo(z);
  if(!z?.wymagaPotwierdzeniaDostepnosci&&!lista.length&&!decision.code)return "";
  const txt=lista.length?lista.map(x=>`${esc(x.nazwa||"Produkt")} × ${esc(x.ilosc||"")}`).join(", "):"większa ilość produktów";
  return `<div class="order-availability-decision ${decision.expired?"is-overdue":""}"><div><b>${z.wymagaPotwierdzeniaDostepnosci?"⚠️ Potwierdzić dostępność przed realizacją":"🧭 Decyzja dostępności"}</b><p>${txt}</p><small>${esc(decision.label)}${decision.expiresAt?` • termin ${esc(new Date(decision.expiresAt).toLocaleString("pl-PL"))}`:""}${decision.operator?` • ${esc(decision.operator)}`:""}</small></div><div><select data-order-availability-decision="${esc(z.nr)}"><option value="confirmed">✅ Potwierdź pełną dostępność</option><option value="wait_1">⏳ Poczekaj na producenta 1 dzień</option><option value="wait_2">⏳ Poczekaj na producenta 2 dni</option><option value="contact_client">📞 Brak pewności — kontakt z klientem</option><option value="unavailable">⛔ Potwierdzony brak produktu</option><option value="reset">🔎 Wróć do kontroli</option></select><button class="btn" type="button" onclick="zastosujWyborDecyzjiZamowienia(${jsArg(z.nr)})">Zapisz decyzję</button></div></div>`;
}
function adminZaopatrzenieZamowieniaDane(z={}){
  const nr=String(z.nr||""),rezerwacje=typeof rezerwacjeMagazynowe==="function"?rezerwacjeMagazynowe():{},plan=typeof planZatowarowania==="function"?planZatowarowania():[];
  const planMap=new Map(plan.map(x=>[String(x?.produkt?.id??""),x]));
  const dokumenty=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(doc=>String(doc?.status||"").toLowerCase()!=="anulowane");
  return (Array.isArray(z.pozycjeDane)?z.pozycjeDane:[]).map(item=>{
    const id=String(item?.id??item?.produktId??""),produkt=typeof produktMagazynowy==="function"?produktMagazynowy(id):null,stan=typeof stanMagazynuId==="function"?stanMagazynuId(id):null,sugestia=planMap.get(id)||{};
    let dokument=null,pozycja=null;
    for(const doc of dokumenty){
      const hit=(Array.isArray(doc.pozycje)?doc.pozycje:[]).find(p=>String(p?.produktId??p?.id??"")===id&&(Array.isArray(p?.zamowienia)?p.zamowienia.map(String).includes(nr):false));
      if(hit){dokument=doc;pozycja=hit;break;}
    }
    const brak=Math.max(0,Number(pozycja?.iloscPotrzebna??sugestia?.ilosc)||0),qty=Math.max(1,Number(item?.ilosc)||1),lokalizacja=magazynMetaProduktu(id)?.lokalizacja||pozycja?.lokalizacja||"";
    return {id,nazwa:item?.nazwa||produkt?.nazwa||`Produkt ${id}`,kod:pozycja?.kod||produkt?.kodProducenta||produkt?.mpn||produkt?.externalId||produkt?.sku||"—",qty,stan,rezerwacje:Math.max(0,Number(rezerwacje[id])||0),brak,lokalizacja,dokument,pozycja};
  });
}
function adminZaopatrzenieZamowieniaHTML(z={}){
  const rows=adminZaopatrzenieZamowieniaDane(z),braki=rows.filter(x=>x.brak>0),docs=[...new Map(rows.filter(x=>x.dokument).map(x=>[String(x.dokument.id),x.dokument])).values()];
  const statusDoc=docs.length?docs.map(d=>`${d.numer||d.id}: ${d.status||"szkic"}`).join(" • "):braki.length?"Szkic tworzy się automatycznie po synchronizacji":"Nie jest potrzebne zamówienie u producenta";
  return `<section class="order-detail-card order-procurement-card">
    <div class="order-section-head"><div><span class="order-pro-label">Magazyn → producent</span><h2>🏭 Kontrola realizacji produktów</h2><p class="order-detail-lead">Stan jest sprawdzany dla całej aktywnej kolejki. Zamawiamy wyłącznie rzeczywisty brak, a wysyłka do producenta czeka na zatwierdzenie aktualnej wersji.</p></div><a class="btn ${braki.length?"":"ghost"}" href="#/admin/agent-ai/zlecenia">${braki.length?"Otwórz szkic producenta":"Centrum zakupów"}</a></div>
    <div class="procurement-flow" aria-label="Etapy zaopatrzenia"><span class="done"><b>1</b> Stan sprawdzony</span><span class="${braki.length?"active":"done"}"><b>2</b> ${braki.length?`Brak ${braki.reduce((s,x)=>s+x.brak,0)} szt.`:"Pokrycie kompletne"}</span><span class="${docs.length?"active":""}"><b>3</b> ${docs.length?"Szkic producenta":"Bez szkicu"}</span><span class="${docs.some(d=>String(d.status||"").toLowerCase().includes("wysłane do"))?"done":""}"><b>4</b> Zatwierdź i wyślij</span></div>
    <div class="procurement-order-table"><table><thead><tr><th>Kod</th><th>Produkt</th><th>Zamówiono</th><th>Stan fizyczny</th><th>Rezerwacje</th><th>Brak łączny</th><th>Lokalizacja / dokument</th></tr></thead><tbody>${rows.map(x=>`<tr class="${x.brak>0?"needs-order":"stock-covered"}"><td><b>${esc(x.kod)}</b></td><td>${esc(x.nazwa)}</td><td>${x.qty} szt.</td><td>${x.stan===null?"niemonitorowany":`${x.stan} szt.`}</td><td>${x.rezerwacje} szt.</td><td>${x.brak>0?`<span class="lvl lvl-ostrzezenie">${x.brak} szt.</span>`:`<span class="lvl lvl-ok">0</span>`}</td><td>${x.lokalizacja?`📍 ${esc(x.lokalizacja)}<br>`:""}<small>${x.dokument?`${esc(x.dokument.numer||x.dokument.id)} • ${esc(x.dokument.status||"szkic")}`:(x.brak?"oczekuje na szkic":"zapas wystarcza")}</small></td></tr>`).join("")||`<tr><td colspan="7">Brak pozycji magazynowych w zamówieniu.</td></tr>`}</tbody></table></div>
    <div class="backend-note ${braki.length?"":"is-ok"}"><b>${braki.length?"Dalszy etap:":"Wynik kontroli:"}</b> ${esc(statusDoc)}. ${braki.length?"Najpierw sprawdź tabelę i zatwierdź dokładną rewizję; dopiero potem system pozwoli wysłać e-mail do właściwego producenta.":"Produkty można przekazać do kompletacji bez tworzenia zlecenia zakupowego."}</div>
  </section>`;
}
function kartaAdminZamowieniaHTML(z){
  const k=kosztyZamowienia(z), w=daneWysylki(z), klient=klientZamowieniaLabel(z);
  const zaznaczone=zaznaczoneZamowieniaSklepu.has(String(z.nr));
  const pozycje=Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
    ? z.pozycjeDane.map(p=>`${p.ilosc||1} × ${p.nazwa||p.produkt||p.id||"produkt"}${p.wariant?` (${p.wariant})`:""} — ${zl(p.wartosc||kwotaNum(p.cena)*(Number(p.ilosc)||1))}`)
    : (Array.isArray(z.pozycje)?z.pozycje:["brak pozycji"]);
  const tracking=w.numer?`${nazwaPrzewoznika(w.przewoznik||"inpost")}: ${w.numer}`:(w.inpostId?`InPost ID ${w.inpostId} — ${w.inpostStatus||"czeka na numer"}`:"bez numeru nadania");
  const platnosc=z.platnosc||dostepnePlatnosci().find(p=>p.id===z.platnoscId)?.nazwa||"—";
  return `<article class="order-pro-card ${zaznaczone?"is-selected":""}">
    <div class="order-pro-top">
      <div class="order-pro-title-row">
        <label class="order-bulk-check" title="Zaznacz całe zamówienie"><input type="checkbox" ${zaznaczone?"checked":""} onchange="adminPrzelaczZaznaczenieZamowienia(${jsArg(z.nr)},this.checked)"></label>
        <div><a class="order-pro-number" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">${esc(z.nr)}</a>
        <div class="order-pro-muted">${esc(z.data||"")} • ${esc(klient)} ${z.wymagaPotwierdzeniaDostepnosci?'<span class="lvl lvl-ostrzezenie">sprawdź dostępność</span>':""}</div></div>
      </div>
      <div class="order-pro-right">
        <select onchange="zmienStatus(${jsArg(z.nr)}, this.value)" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">
          ${STATUSY.map(s=>`<option value="${esc(s)}" ${s===z.status?"selected":""}>${esc(s)}</option>`).join("")}
        </select>
        <b>${zl(k.razem)}</b>
      </div>
    </div>
    <div class="order-pro-grid">
      <div class="order-pro-section">
        <span class="order-pro-label">Produkty</span>
        <p>${pozycje.slice(0,3).map(p=>esc(p)).join("<br>")}${pozycje.length>3?`<br><span style="color:var(--muted2)">+ ${pozycje.length-3} kolejnych pozycji</span>`:""}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Klient</span>
        <p>${z.email?`✉️ ${esc(z.email)}`:"👤 gość"}${z.klient?.telefon?`<br>📞 ${esc(z.klient.telefon)}`:""}${z.klient?.firma?`<br>🏢 ${esc(z.klient.firma)}`:""}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Dostawa</span>
        <p>🚚 ${esc(z.dostawa||uslugaInpostZamowienia(z))}<br>💰 ${k.dostawa?zl(k.dostawa):"GRATIS"}${k.paczkaWeekend?` + Weekend ${zl(k.paczkaWeekend)}`:""}<br>🏷️ ${esc(tracking)}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Płatność i adres</span>
        <p>💳 ${esc(platnosc)}${k.platnosc?` + ${zl(k.platnosc)}`:""}<br>📍 ${esc(z.adres||"brak adresu")}</p>
      </div>
    </div>
    ${alertDostepnosciZamowieniaHTML(z)}
    <div class="order-pro-bottom">
      <div class="order-pro-costs">
        <span>Produkty <b>${zl(k.poRabacie||k.produkty)}</b></span>
        <span>Dostawa <b>${k.dostawa?zl(k.dostawa):"GRATIS"}</b></span>
        ${k.paczkaWeekend?`<span>Weekend <b>${zl(k.paczkaWeekend)}</b></span>`:""}
        ${k.platnosc?`<span>Płatność <b>${zl(k.platnosc)}</b></span>`:""}
      </div>
      <div class="diag-actions">
        <a class="btn" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Obsłuż</a>
        <a class="btn ghost" href="#/admin/wysylki">Centrum wysyłek</a>
        <button class="btn ghost" onclick="drukujZamowienie(${jsArg(z.nr)})">🖨️ Druk</button>
        <button class="ci-remove" onclick="if(confirm('Usunąć zamówienie ${esc(z.nr)}?')) usunZamowienie(${jsArg(z.nr)})" title="Usuń zamówienie">🗑️</button>
      </div>
    </div>
  </article>`;
}
function adminPozycjeZamowieniaHTML(z){
  const dane=Array.isArray(z?.pozycjeDane)?z.pozycjeDane:[];
  if(dane.length){
    return `<div class="order-items-pro">${dane.map(p=>{
      const nazwa=p.nazwa||p.produkt||p.id||"produkt", il=Number(p.ilosc)||1, cena=kwotaNum(p.cena), wartosc=kwotaNum(p.wartosc||(cena*il));
      return `<div class="order-item-pro">
        <div><b>${esc(nazwa)}</b>${p.wariant?`<small>Wariant: ${esc(p.wariant)}</small>`:""}${p.sku?`<small>SKU: ${esc(p.sku)}</small>`:""}</div>
        <span>${il} × ${cena?zl(cena):"—"}</span>
        <strong>${zl(wartosc)}</strong>
      </div>`;
    }).join("")}</div>`;
  }
  const tekstowe=Array.isArray(z?.pozycje)?z.pozycje:[];
  return `<div class="order-items-pro">${tekstowe.length?tekstowe.map(p=>`<div class="order-item-pro"><div><b>${esc(p)}</b></div></div>`).join(""):`<div class="order-item-pro"><div><b>Brak pozycji w zamówieniu</b></div></div>`}</div>`;
}
function adminZamowienieSnapshotHTML(z){
  const w=daneWysylki(z), k=kosztyZamowienia(z), klient=z?.klient||{}, pay=paynowDane(z);
  const osoba=[klient.imie,klient.nazwisko].filter(Boolean).join(" ")||z.email||"gość";
  const platnosc=z.platnosc||dostepnePlatnosci().find(p=>p.id===z.platnoscId)?.nazwa||"—";
  const platStatus=z.platnoscStatus||(z.platnoscId==="paynow"?paynowStatusTekst(pay.status):"—");
  const tracking=w.numer?`${w.numer}`:(w.inpostId?`${w.inpostId} • ${w.inpostStatus||"czeka"}`:"brak numeru");
  const etap=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi;
  const inpostOpcje=[
    pobranieAktywneZamowienia(z,w)?`COD ${zl(kwotaPobraniaZamowienia(z,w))}`:"COD NIE",
    (w.paczkaWeekend||z.paczkaWeekend)?`Weekend ${zl(OPLATA_PACZKA_WEEKEND)}`:"Weekend NIE",
    w.ochrona?`Ochrona ${zl(w.ochrona)}`:"Ochrona NIE",
    inpostSposobNadaniaLabel(inpostSposobNadania(z,w))
  ].join(" • ");
  return `<div class="order-detail-grid">
    <div class="order-detail-tile"><span>👤 Klient</span><b>${esc(osoba)}</b><small>${z.email?`✉️ ${esc(z.email)}`:"bez konta"}${klient.telefon?` • 📞 ${esc(klient.telefon)}`:""}</small></div>
    <div class="order-detail-tile"><span>💳 Płatność</span><b>${esc(platnosc)}</b><small>Status: ${esc(platStatus)}${k.platnosc?` • opłata ${zl(k.platnosc)}`:""}</small></div>
    <div class="order-detail-tile"><span>🚚 Dostawa</span><b>${esc(z.dostawa||uslugaInpostZamowienia(z))}</b><small>${k.dostawa?zl(k.dostawa):"GRATIS"}${k.paczkaWeekend?` • Weekend ${zl(k.paczkaWeekend)}`:""} • ${esc(etap.nazwa||"")}</small></div>
    <div class="order-detail-tile"><span>🏷️ Nadanie</span><b>${esc(tracking)}</b><small>${w.etykietaGotowa?"Etykieta gotowa":w.inpostId?"Czeka na potwierdzenie InPost":"Nieutworzona przesyłka"} • ${esc(inpostOpcje)}</small></div>
  </div>`;
}
function adminZamowienieStatusPanelHTML(z){
  return `<div class="order-status-flow">
    ${STATUSY.map(s=>`<button class="${s===z.status?"active":""}" onclick="zmienStatus(${jsArg(z.nr)},${jsArg(s)})"><span>${s===z.status?"●":"○"}</span>${esc(s)}</button>`).join("")}
  </div>`;
}
function adminZamowieniaSubnavHTML(aktywny="lista"){
  const sklep=pobierzZamowienia(),allegroAktywne=(allegroZamowienia||[]).filter(allegroZamowienieAktywneLokalnie).length;
  const doWysylki=sklep.filter(z=>!["anulowane","dostarczone","zakończone"].includes(String(z.status||"").toLowerCase())&&!daneWysylki(z).numer).length;
  return adminSubnavHTML([
    {id:"lista",href:"#/admin/zamowienia",label:"📦 Lista sklepu",badge:sklep.length||""},
    {id:"allegro",href:"#/admin/allegro/zamowienia",label:"🟠 Zamówienia Allegro",badge:allegroAktywne||""},
    {id:"tabela",href:"#/admin/zamowienia/tabela",label:"📑 Tabela operacyjna"},
    {id:"wysylki",href:"#/admin/wysylki",label:"🚚 Wysyłki i etykiety",badge:doWysylki||""}
  ],aktywny);
}
function widokAdminZamowienia(){
  const wszystkie = pobierzZamowienia();
  const zam = adminPasujaceZamowieniaSklepu();
  const istniejace=new Set(wszystkie.map(z=>String(z.nr))),zaznaczone=[...zaznaczoneZamowieniaSklepu].filter(id=>istniejace.has(id));
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("lista")}
  <div class="panel orders-page">
    <div class="orders-hero">
      <div>
        <span class="order-pro-label">Centrum zamówień</span>
        <h1>📦 Zamówienia</h1>
        <p>Pełna obsługa sprzedaży: statusy, płatności, koszty InPost, etykiety, e-maile i szybkie przejście do wysyłki.</p>
      </div>
      <div class="diag-actions">
        <button class="btn ghost" onclick="synchronizujBazeCentralna(true)">🔄 Synchronizuj</button>
        <button class="btn ghost" onclick="eksportujZamowienia()">📤 CSV</button>
        <a class="btn ghost" href="#/admin/allegro">🟠 Allegro</a>
        <a class="btn" href="#/admin/wysylki">🚚 Centrum wysyłek</a>
      </div>
    </div>
    ${adminZamowieniaStatyHTML(wszystkie,zam)}
    ${adminWyszukiwaniePanelHTML({id:"store-orders",description:"Numer zamówienia, klient, dane kontaktowe, adres, numer nadania i status.",results:zam.length,active:!!(szukajZamowien||filtrZamowien!=="wszystkie"),open:true,fields:`<div class="orders-toolbar admin-search-full">
      <input placeholder="Szukaj: nr, klient, e-mail, telefon, adres, tracking…" value="${esc(szukajZamowien)}" oninput="szukajZamowien=this.value.toLowerCase();renderuj()">
      <select onchange="filtrZamowien=this.value;renderuj()">
        <option value="wszystkie" ${filtrZamowien==="wszystkie"?"selected":""}>Wszystkie statusy</option>
        ${STATUSY.map(s=>`<option value="${esc(s)}" ${s===filtrZamowien?"selected":""}>${esc(s)}</option>`).join("")}
      </select>
      ${szukajZamowien||filtrZamowien!=="wszystkie"?`<button class="btn ghost" onclick="szukajZamowien='';filtrZamowien='wszystkie';renderuj()">Wyczyść filtry</button>`:""}
    </div>`,actions:adminOperacjeWynikowHTML({id:"store-orders",selected:zaznaczone.length,pageCount:zam.length,resultCount:zam.length,selectPage:"adminZaznaczWidoczneZamowienia(true)",selectAll:"adminZaznaczWidoczneZamowienia(true)",clear:"adminWyczyscZaznaczenieZamowien()",exportSelected:"adminEksportujZamowieniaZakres('zaznaczone')",exportAll:"adminEksportujZamowieniaZakres('filtr')"})})}
    ${adminStatusyZamowienHTML(wszystkie)}
    <div class="order-bulk-toolbar">
      <div class="order-bulk-summary"><b>Operacje na zamówieniach</b><small>${zaznaczone.length} zaznaczonych • ${zam.length} w aktualnym widoku</small></div>
      <div class="order-bulk-status">
        <label for="bulkOrderStatus">Nowy status</label>
        <select id="bulkOrderStatus"><option value="">— wybierz status —</option>${STATUSY.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
        <button class="btn" onclick="adminMasowoZmienStatusZamowien()" ${zaznaczone.length?"":"disabled"}>Zastosuj do ${zaznaczone.length}</button>
      </div>
    </div>
    <div class="orders-list">
      ${zam.length ? zam.map(kartaAdminZamowieniaHTML).join("") : `<div class="order-empty"><b>Brak zamówień dla tego widoku.</b><br>Zmień filtr albo wyczyść wyszukiwarkę.</div>`}
    </div>
  </div>`);
}
function widokAdminZamowieniaTabela(){
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("tabela")}
  ${magazynTabelaOperacyjnaHTML({limit:420})}
  <div class="panel orders-page">
    <div class="orders-hero">
      <div>
        <span class="order-pro-label">Tabela operacyjna</span>
        <h1>📑 Braki i zamówienia do producentów</h1>
        <p>Pełna tabela operacyjna pozostaje w panelu. Wiadomość wysyłana do Telegrama zawiera wyłącznie: kod, nazwę produktu i potrzebną ilość.</p>
      </div>
      <div class="diag-actions">
        <a class="btn ghost" href="#/admin/zamowienia">← Lista zamówień</a>
      </div>
    </div>
  </div>
  `);
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
  const koszty=kosztyZamowienia(z), etapInfo=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi, sla=slaWysylki(z);
  const pobranieAktywne=pobranieAktywneZamowienia(z,w);
  const pobranieKwota=kwotaPobraniaZamowienia(z,w);
  const paczkaWeekendAktywna=!!(w.paczkaWeekend||z.paczkaWeekend);
  const sposobNadania=inpostSposobNadania(z,w);
  const punktNadania=String(w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
  const ochronaKwota=String(w.ochrona||"").trim();
  const ochronaPreset=inpostOchronaPreset(ochronaKwota);
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("lista")}
  <div class="panel order-detail-page">
    <div class="crumb"><a href="#/admin/zamowienia">Zamówienia</a> › ${esc(z.nr)}</div>
    <div class="order-detail-hero">
      <div>
        <span class="order-pro-label">Obsługa zamówienia</span>
        <h1>📦 ${esc(z.nr)} <span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'};font-size:.85rem;vertical-align:middle">${esc(z.status)}</span></h1>
        <p>${esc(z.data||"")} • <span class="${sla.klasa}">⏱ ${esc(sla.tekst)}</span> • etap: <b>${esc(etapInfo.nazwa||nazwaEtapu(z))}</b></p>
      </div>
      <div class="order-detail-total">
        <small>Do zapłaty</small>
        <b>${zl(koszty.razem)}</b>
        <span>produkty ${zl(koszty.poRabacie||koszty.produkty)} • dostawa ${koszty.dostawa?zl(koszty.dostawa):"gratis"}</span>
      </div>
    </div>
    ${adminZamowienieSnapshotHTML(z)}
    ${alertDostepnosciZamowieniaHTML(z)}
    ${adminZaopatrzenieZamowieniaHTML(z)}
    <div class="order-detail-columns">
      <div class="order-detail-card">
        <div class="order-section-head"><div><span class="order-pro-label">Produkty</span><h2>🧾 Pozycje zamówienia</h2></div><b>${zl(koszty.produkty)}</b></div>
        ${adminPozycjeZamowieniaHTML(z)}
      </div>
      <div class="order-detail-card">
        <div class="order-section-head"><div><span class="order-pro-label">Finanse</span><h2>💰 Podsumowanie</h2></div></div>
        <div class="summary" style="margin:.55rem 0">${podsumowanieKosztowHTML(z,"Razem")}</div>
        ${z.uwagi?`<div class="backend-note"><b>Uwagi klienta:</b> ${esc(z.uwagi)}</div>`:""}
      </div>
    </div>
    <div class="order-detail-card" style="margin-top:1rem">
      <div class="order-section-head"><div><span class="order-pro-label">Status</span><h2>Zmiana statusu zamówienia</h2></div><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">${esc(z.status)}</span></div>
      ${adminZamowienieStatusPanelHTML(z)}
    </div>
  </div>
  <div class="panel order-fulfillment-panel">
    <div class="order-section-head">
      <div><span class="order-pro-label">InPost / realizacja</span><h2>🚚 Nadanie i dane odbiorcy</h2></div>
      <div class="order-pro-costs"><span style="background:${etapInfo.kolor||'var(--bg)'};color:var(--ink)">${esc(nazwaEtapu(z))}</span>${w.numer?`<span>Numer <b>${esc(w.numer)}</b></span>`:""}${w.inpostId?`<span>InPost <b>${esc(w.inpostId)}</b></span>`:""}</div>
    </div>
    <p class="order-detail-lead">${w.inpostStatus?`Status InPost: ${esc(w.inpostStatus)}. `:""}${urlSledzenia(z)?`<a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Otwórz śledzenie przesyłki</a>`:"Najpierw zapisz dane, potem utwórz przesyłkę i etykietę."}</p>
    <div class="backend-note">Pola z <b>*</b> są wymagane przed utworzeniem przesyłki InPost.</div>
    <form class="order-form-pro shipment-manager-form inpost-like-form" onsubmit="zapiszNadanie(event,'${esc(z.nr)}')">
      <div class="shipment-manager-box inpost-like-box">
        <h3 class="inpost-like-title">Nadanie przesyłki</h3>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Dane odbiorcy</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Imię</label><div><input name="imie" value="${esc(klient.imie||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nazwisko</label><div><input name="nazwisko" value="${esc(klient.nazwisko||"")}"></div></div>
            <div class="shipment-manager-field"><label>E-mail *</label><div><input name="email" type="email" value="${esc(z.email||"")}"></div></div>
            <div class="shipment-manager-field"><label>Telefon *</label><div><input name="telefon" value="${esc(klient.telefon||"")}" placeholder="9 cyfr"></div></div>
            <div class="shipment-manager-field"><label>Firma</label><div><input name="firma" value="${esc(klient.firma||"")}" placeholder="opcjonalnie"></div></div>
            <div class="shipment-manager-field"><label>NIP</label><div><input name="nip" value="${esc(klient.nip||"")}" placeholder="opcjonalnie"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Dostawa i gabaryt</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Sposób dostawy</label><div><select name="dostawaTyp" onchange="przelaczDostawaAdmin(this)">
              <option value="paczkomat" ${paczkomatZam?"selected":""}>Paczkomat / punkt InPost</option>
              <option value="kurier_inpost" ${!paczkomatZam?"selected":""}>Kurier InPost</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Gabaryt paczki</label><div><select name="gabaryt">
              <option value="small" ${(w.gabaryt||"small")==="small"?"selected":""}>Gabaryt A — mały (8 × 38 × 64 cm)</option>
              <option value="medium" ${w.gabaryt==="medium"?"selected":""}>Gabaryt B — średni (19 × 38 × 64 cm)</option>
              <option value="large" ${w.gabaryt==="large"?"selected":""}>Gabaryt C — duży (41 × 38 × 64 cm)</option>
            </select></div></div>
            <div class="shipment-manager-field span-2" id="admPaczkomatRow" style="${paczkomatZam?"":"display:none"}"><label>Paczkomat / punkt InPost *</label><div class="shipment-inline-control"><input name="paczkomat" id="admPaczkomat" value="${esc(z.paczkomat||w.punktKod||"")}" placeholder="np. WAW01M" style="text-transform:uppercase"><button type="button" class="btn" onclick="otworzGeowidgetAdmin()">🗺️ Wybierz na mapie</button></div></div>
            <input type="hidden" name="paczkomatAdres" id="admPaczkomatAdresVal" value="${esc(z.paczkomatAdres||"")}">
            <div class="shipment-manager-note span-2" id="admPaczkomatAdres">${(z.paczkomatAdres||"").trim()?`📮 ${esc(czyscAdresPaczkomatu(z.paczkomatAdres))}`:""}</div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Adres odbiorcy${paczkomatZam?" / awaryjny":" *"}</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Ulica${paczkomatZam?"":" *"}</label><div><input name="ulica" value="${esc(adres.ulica||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nr domu${paczkomatZam?"":" *"}</label><div><input name="nrDomu" value="${esc(adres.nrDomu||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nr lokalu</label><div><input name="nrLokalu" value="${esc(adres.nrLokalu||"")}"></div></div>
            <div class="shipment-manager-field"><label>Kod pocztowy${paczkomatZam?"":" *"}</label><div><input name="kod" value="${esc(adres.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div></div>
            <div class="shipment-manager-field"><label>Miejscowość${paczkomatZam?"":" *"}</label><div><input name="miasto" value="${esc(adres.miasto||"")}"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Usługi InPost</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Zlecenie za pobraniem</label><div><select name="pobranieAktywne" onchange="if(this.value==='tak'&&!this.form.pobranie.value)this.form.pobranie.value='${esc(kwotaNum(z.razem).toFixed(2))}'">
              <option value="" ${!pobranieAktywne?"selected":""}>NIE — jak w InPost</option>
              <option value="tak" ${pobranieAktywne?"selected":""}>TAK — pobranie od klienta</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Wartość pobrania</label><div><input name="pobranie" inputmode="decimal" value="${esc(pobranieKwota)}" placeholder="np. ${esc(kwotaNum(z.razem).toFixed(2))}"></div></div>
            <div class="shipment-manager-field"><label>Paczka w Weekend</label><div><select name="paczkaWeekend">
              <option value="" ${!paczkaWeekendAktywna?"selected":""}>NIE — jak w InPost</option>
              <option value="tak" ${paczkaWeekendAktywna?"selected":""}>TAK (+${zl(OPLATA_PACZKA_WEEKEND)})</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Sposób nadania</label><div><select name="sposobNadania">
              ${Object.entries(INPOST_SP_NADANIA).map(([id,nazwa])=>`<option value="${esc(id)}" ${sposobNadania===id?"selected":""}>${esc(nazwa)}</option>`).join("")}
            </select></div></div>
            <div class="shipment-manager-field"><label>Punkt nadania</label><div><input name="punktNadania" value="${esc(punktNadania)}" placeholder="${esc(INPOST_DOMYSLNY_PUNKT_NADANIA)}" style="text-transform:uppercase"></div></div>
            <div class="shipment-manager-field"><label>Dodatkowa ochrona</label><div><select name="ochronaPreset" onchange="if(this.value!=='custom')this.form.ochrona.value=this.value">
              ${INPOST_OCHRONA_PRESETY.map(p=>`<option value="${esc(p.wartosc)}" ${ochronaPreset===p.wartosc?"selected":""}>${esc(p.etykieta)}</option>`).join("")}
              <option value="custom" ${ochronaPreset==="custom"?"selected":""}>Własna kwota</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Kwota ochrony</label><div><input name="ochrona" inputmode="decimal" value="${esc(ochronaKwota)}" placeholder="puste = brak"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <details class="shipment-advanced"><summary>Wymiary, waga i ręczny numer nadania</summary>
            <div class="shipment-manager-grid">
              <div class="shipment-manager-field"><label>Waga (kg)</label><div><input name="waga" type="number" step=".01" min=".01" value="${esc(w.waga||uw.waga)}"></div></div>
              <div class="shipment-manager-field"><label>Długość (cm)</label><div><input name="dlugosc" type="number" min="1" value="${esc(w.dlugosc||uw.dlugosc)}"></div></div>
              <div class="shipment-manager-field"><label>Szerokość (cm)</label><div><input name="szerokosc" type="number" min="1" value="${esc(w.szerokosc||uw.szerokosc)}"></div></div>
              <div class="shipment-manager-field"><label>Wysokość (cm)</label><div><input name="wysokosc" type="number" min="1" value="${esc(w.wysokosc||uw.wysokosc)}"></div></div>
              <div class="shipment-manager-field"><label>Numer nadania</label><div><input name="numer" value="${esc(w.numer)}" placeholder="Zwykle uzupełni się automatycznie"></div></div>
              <div class="shipment-manager-field"><label>Własny link śledzenia</label><div><input name="trackingUrl" type="url" value="${esc(w.trackingUrl)}" placeholder="https://…"></div></div>
            </div>
          </details>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Etykieta i zapis</h4>
          <div class="shipment-manager-field full"><label>Uwagi do zamówienia</label><div><textarea name="uwagi" rows="2">${esc(z.uwagi||"")}</textarea></div></div>
          ${panelEtykietInpostHTML(z)}
        </section>
      </div>
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
    const pobranieAktywneForm=g("pobranieAktywne")==="tak";
    const pobranieForm=pobranieAktywneForm ? g("pobranie") : "";
    const sposobNadania=g("sposobNadania");
    w.ochrona=g("ochrona");
    w.pobranieAktywne=pobranieAktywneForm;
    w.pobranie=pobranieForm;
    w.paczkaWeekend=g("paczkaWeekend")==="tak";
    w.sposobNadania=INPOST_SP_NADANIA[sposobNadania]?sposobNadania:INPOST_DOMYSLNY_SP_NADANIA;
    w.punktNadania=g("punktNadania").toUpperCase()||INPOST_DOMYSLNY_PUNKT_NADANIA;
    w.formatEtykiety=g("formatEtykiety").toUpperCase()==="A4"?"A4":"A6";
    if(f.has("numer")) w.numer=g("numer");
    if(f.has("trackingUrl")) w.trackingUrl=g("trackingUrl");
    w.przewoznik="inpost"; w.usluga = typ==="paczkomat" ? "Paczkomat 24/7" : "Kurier InPost";
    z.wysylka=w;
    zapiszKosztyZamowienia(z,{dostawaId:typ,paczkaWeekend:w.paczkaWeekend});
    if(pobranieAktywneForm && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) w.pobranie=kwotaNum(z.razem).toFixed(2);
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
    const zmiana=zastosujStatusZamowieniaLokalnie(z,status);
    if(!zmiana){renderuj();return;}
    zapiszLS("artway_zamowienia", t);
    loguj("info",`Zmieniono status zamówienia ${nr} → ${status}`);
    toast(`${nr}: ${status} ✅`);
    // Serwer sam wyśle e-mail statusowy przy zapisie; awaryjnie (brak połączenia z bazą) próbujemy z panelu
    zapiszZamowienieCentralnie(z,false).then(d=>{ if(!d) void obsluzAutomatycznyEmail(nr,status); });
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
let szukajKlientow = "",klienciWynikiEmails=[];
function klienciUstawZaznaczenie(zakres,zaznacz=true){
  const emails=zakres==="filtr"||zakres==="strona"?klienciWynikiEmails:Array.isArray(zakres)?zakres:[];
  emails.forEach(email=>zaznacz?zaznaczeniKlienci.add(String(email).toLowerCase()):zaznaczeniKlienci.delete(String(email).toLowerCase()));renderuj();
}
function klienciWyczyscZaznaczenie(){zaznaczeniKlienci.clear();renderuj();}
function klienciEksportujZakres(zakres="filtr"){
  const ids=zakres==="zaznaczone"?new Set([...zaznaczeniKlienci]):new Set(klienciWynikiEmails);
  const lista=pobierzUzytkownikow().filter(k=>ids.has(String(k.email||"").toLowerCase()));
  eksportujKlientow(lista,zakres==="zaznaczone"?"klienci-zaznaczeni.csv":"klienci-filtrowani.csv");
}
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
function widokAdminKlienci(sekcja="lista"){
  const aktywna=["lista","dodaj","uprawnienia","zamowienia"].includes(String(sekcja||""))?String(sekcja||""):"lista";
  let kl = pobierzUzytkownikow();
  if(szukajKlientow) kl = kl.filter(k=>(k.imie+" "+k.email).toLowerCase().includes(szukajKlientow));
  if(aktywna==="uprawnienia") kl=kl.slice().sort((a,b)=>Number(kontoMaRoleAdmin(b.email))-Number(kontoMaRoleAdmin(a.email))||String(a.email).localeCompare(String(b.email),"pl"));
  klienciWynikiEmails=kl.map(k=>String(k.email||"").toLowerCase()).filter(Boolean);
  const zam = pobierzZamowienia();
  const klienciZZamowieniami=kl.map(k=>{
    const z=zam.filter(x=>x.email===k.email);
    return {k,z,ile:z.length,suma:z.filter(x=>x.status!=="anulowane").reduce((s,x)=>s+kwotaNum(x.razem),0),ostatnie:z.slice().sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0))[0]};
  }).filter(x=>x.ile).sort((a,b)=>b.suma-a.suma);
  return adminSzkielet("/admin/klienci", `
  ${klienciSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="dodaj"?"":"display:none"}">
    <h1>➕ Dodaj klienta (pełna kartoteka)</h1>
    <form onsubmit="dodajKlientaAdmin(event)">
      ${polaKartotekiHTML({})}
      <button class="btn" type="submit">➕ Utwórz konto klienta</button>
    </form>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">Konto trafia do wspólnej bazy serwerowej. Klient może zalogować się na dowolnym urządzeniu.</p>
  </div>
  <div class="panel" style="${["lista","uprawnienia"].includes(aktywna)?"":"display:none"}">
    <h1>${aktywna==="uprawnienia"?"🛡️ Uprawnienia użytkowników":"👥 Użytkownicy"} (${kl.length}) <button class="btn ghost" style="float:right" onclick="eksportujKlientow()">📤 CSV</button></h1>
    ${aktywna==="uprawnienia"?`<div class="backend-note" style="margin-bottom:.8rem">Tutaj szybko nadajesz lub odbierasz rolę administratora. Konto głównego właściciela i aktualnie używane konto są chronione przed przypadkową zmianą.</div>`:""}
    ${adminWyszukiwaniePanelHTML({id:"customers",description:"Imię, nazwisko albo adres e-mail użytkownika.",results:kl.length,active:!!szukajKlientow,open:true,fields:`<label class="search-wide">Klient<input placeholder="Imię, nazwisko lub e-mail…" value="${esc(szukajKlientow)}" oninput="szukajKlientow=this.value.toLowerCase();renderuj()"></label>${szukajKlientow?`<button class="btn ghost" onclick="szukajKlientow='';renderuj()">Wyczyść filtry</button>`:""}`,actions:adminOperacjeWynikowHTML({id:"customers",selected:zaznaczeniKlienci.size,pageCount:kl.length,resultCount:kl.length,selectPage:"klienciUstawZaznaczenie('strona')",selectAll:"klienciUstawZaznaczenie('filtr')",clear:"klienciWyczyscZaznaczenie()",exportSelected:"klienciEksportujZakres('zaznaczone')",exportAll:"klienciEksportujZakres('filtr')"})})}
    <div class="table-scroll"><table class="log-table">
      <tr><th>Wybór</th><th>Imię i nazwisko</th><th>E-mail</th><th>Rola</th><th>Rejestracja</th><th>Zamówień</th><th>Akcje</th></tr>
      ${kl.map(k=>{
        const admin = kontoMaRoleAdmin(k.email), glowny=jestGlownymAdminem(k.email);
        const nZam = zam.filter(z=>z.email===k.email).length;
        return `<tr>
        <td><input type="checkbox" aria-label="Zaznacz ${esc(k.email)}" ${zaznaczeniKlienci.has(String(k.email||"").toLowerCase())?"checked":""} onchange="klienciUstawZaznaczenie([${jsArg(k.email)}],this.checked)"></td>
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
    </table></div>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">📇 otwiera pełną kartotekę klienta: dane kontaktowe, adres, dane firmowe, notatka, nowe hasło. Zamówienia klienta otworzysz, klikając ich liczbę.</p>
  </div>
  <div class="panel" style="${aktywna==="zamowienia"?"":"display:none"}">
    <div class="order-section-head">
      <div><h1 style="margin:0">📦 Zamówienia klientów</h1><p class="order-detail-lead">Szybki widok klientów według liczby i wartości zamówień.</p></div>
      <a class="btn ghost" href="#/admin/zamowienia">Pełna lista zamówień</a>
    </div>
    <div class="table-scroll"><table class="log-table">
      <tr><th>Klient</th><th>E-mail</th><th>Zamówień</th><th>Wartość</th><th>Ostatnie</th><th>Akcje</th></tr>
      ${klienciZZamowieniami.map(x=>`<tr>
        <td><a href="#/admin/klient/${encodeURIComponent(x.k.email)}"><b>${esc(x.k.imie||"Klient")}</b></a></td>
        <td>${esc(x.k.email)}</td>
        <td><b>${x.ile}</b></td>
        <td>${zl(x.suma)}</td>
        <td>${x.ostatnie?`<a href="#/admin/zamowienie/${encodeURIComponent(x.ostatnie.nr)}">${esc(x.ostatnie.nr)}</a><br><small>${esc(x.ostatnie.data||"")}</small>`:"—"}</td>
        <td><a class="btn ghost" href="#/admin/zamowienia" onclick="szukajZamowien=${jsArg(x.k.email)};filtrZamowien='wszystkie'">Pokaż zamówienia</a></td>
      </tr>`).join("") || `<tr><td colspan="6">Brak klientów z zamówieniami.</td></tr>`}
    </table></div>
  </div>`);
}
