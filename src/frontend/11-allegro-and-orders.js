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
  for(const klucz of ["artway_allegro_zamowienia_cache","artway_allegro_oferty_cache","artway_allegro_mapowania_cache","artway_allegro_komunikacja_cache"]){
    try{localStorage.removeItem(klucz);}catch(e){}
  }
}
function allegroProduktIdDlaOferty(offerId){
  const rec=(allegroMapowania||{})[String(offerId)];
  if(rec && typeof rec==="object") return rec.productId || (rec.withdrawnAt?rec.previousProductId:"") || rec.produktId || rec.id || "";
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
  if(allegroStan.credentialsRedacted) return `<span class="lvl lvl-bad">zapisano maskę zamiast danych</span>`;
  if(allegroStan.credentialsInvalid) return `<span class="lvl lvl-bad">błędne dane aplikacji</span>`;
  if(allegroStan.authError) return `<span class="lvl lvl-bad">połączenie wymaga naprawy</span>`;
  if(allegroStan.connected&&allegroStan.requiresReauth) return `<span class="lvl lvl-ostrzezenie">połączone — brak części uprawnień</span>`;
  if(allegroStan.connected) return `<span class="lvl lvl-ok">połączone</span>`;
  if(allegroStan.configured) return `<span class="lvl lvl-ostrzezenie">wymaga autoryzacji</span>`;
  return `<span class="lvl lvl-bad">brak konfiguracji</span>`;
}
function allegroZakresDanych(scope="summary"){return ["summary","orders","offers","config","all"].includes(String(scope||""))?String(scope):"summary";}
const ALLEGRO_DANE_TTL_MS=15*60*1000;
function allegroZakresZaladowany(zakres="summary"){
  return zakres==="all"?!!(allegroDaneZaladowane.orders&&allegroDaneZaladowane.offers&&allegroDaneZaladowane.config):!!allegroDaneZaladowane[zakres];
}
function allegroWersjaSerwerowaZakresu(zakres="summary"){
  const orders=allegroPodsumowanie.orders||{},offers=allegroPodsumowanie.offers||{},communication=allegroKomunikacja||{},statusCounts=orders.statusCounts||{};
  const orderVersion=`${orders.updated_at||""}:${orders.live||0}:${orders.active||0}:${Object.entries(statusCounts).sort().map(([k,v])=>`${k}=${v}`).join(",")}`;
  const offerVersion=`${offers.updated_at||""}:${offers.count||0}:${offers.mapped||0}`;
  const configVersion=`${allegroStan.offerSettings?.updated_at||""}:${allegroStan.offerSyncState?.lastLightSyncAt||""}:${allegroStan.offerSyncState?.lastFullSyncAt||""}`;
  if(zakres==="orders")return orderVersion;
  if(zakres==="offers")return offerVersion;
  if(zakres==="config")return configVersion;
  return `${orderVersion}|${offerVersion}|${communication.updated_at||""}|${configVersion}`;
}
function allegroLadujJesliTrzeba(scope="summary"){
  const zakres=allegroZakresDanych(scope),zaladowany=allegroZakresZaladowany(zakres),ostatni=zakres==="all"?Math.min(...["orders","offers","config"].map(k=>Number(allegroDaneOdczytAt[k]||0))):Number(allegroDaneOdczytAt[zakres]||0);
  if(allegroDaneObietnice.has(zakres)||allegroDaneLadowane.has(zakres)||(zaladowany&&Date.now()-ostatni<ALLEGRO_DANE_TTL_MS))return;
  if(!zaladowany)allegroStan={...allegroStan,ladowanie:true};
  setTimeout(()=>allegroWczytajDane(true,true,zakres),0);
}
async function allegroWczytajDane(cicho=false,odswiezWidok=true,scope="all"){
  const zakres=allegroZakresDanych(scope),istniejaca=allegroDaneObietnice.get(zakres);
  if(istniejaca){const wynik=await istniejaca;if(odswiezWidok&&wynik.changed)renderuj();return wynik.ok;}
  const byloZaladowane=allegroZakresZaladowany(zakres),przed=allegroWersjaSerwerowaZakresu(zakres);
  const zadanie=(async()=>{
    allegroDaneLadowane.add(zakres);allegroStan={...allegroStan,ladowanie:true};
    try{
      const d=await chmura("allegro-data",{params:{scope:zakres},timeout:20000});
      allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,error:"",offerDefaultsAudit:d.offerDefaultsAudit||allegroStan.offerDefaultsAudit||{items:{},updated_at:null},catalogMaintenance:d.catalogMaintenance||allegroStan.catalogMaintenance||{cursor:0,lastRun:null},complianceAudit:d.complianceAudit||allegroStan.complianceAudit||{items:[],summary:{},updated_at:null},offerSyncState:d.offerSyncState||allegroStan.offerSyncState||{lastLightSyncAt:null,lastFullSyncAt:null,nextLightSyncAt:null,nextFullSyncAt:null},offerSettings:d.offerSettings||allegroStan.offerSettings||{defaultStock:5,republish:true,producers:["Alexander","Multigra","GoDan"],autoCatalog:true,syncDescriptions:true,autoUpdateOffers:true,autoFees:true,autoCorrections:true,autoMapping:true,mappingMinScore:88,lightSyncMinutes:15,fullSyncHours:6,autonomousAgent:true,autonomousAgentMinutes:15,autoResolveDuplicates:true,autoResolveDuplicateMinScore:97,updated_at:null}};
      if(Array.isArray(d.orders))allegroZamowienia=d.orders;
      if(Array.isArray(d.offers))allegroOferty=d.offers;
      if(d.mappings&&typeof d.mappings==="object")allegroMapowania=d.mappings;
      if(d.summary&&typeof d.summary==="object")allegroPodsumowanie={...allegroPodsumowanie,...d.summary};
      if(d.archive&&typeof d.archive==="object")allegroArchiwum={...allegroArchiwum,summary:{...allegroArchiwum.summary,...d.archive}};
      allegroDaneZaladowane.summary=true;
      const odczyt=Date.now();
      if(zakres==="all"){allegroDaneZaladowane={summary:true,orders:true,offers:true,config:true};["summary","orders","offers","config"].forEach(k=>allegroDaneOdczytAt[k]=odczyt);}
      else{allegroDaneZaladowane[zakres]=true;allegroDaneOdczytAt[zakres]=odczyt;allegroDaneOdczytAt.summary=odczyt;}
      if(d.offerLastError) allegroOstatniBladWystawienia={message:d.offerLastError.message,allegroError:{errors:d.offerLastError.errors||[]},...d.offerLastError};
      if(Array.isArray(d.threads)||Array.isArray(d.issues)) allegroKomunikacja={...allegroKomunikacja,threads:Array.isArray(d.threads)?d.threads:allegroKomunikacja.threads,issues:Array.isArray(d.issues)?d.issues:allegroKomunikacja.issues,settings:d.settings||allegroKomunikacja.settings,autoReplies:d.autoReplies||allegroKomunikacja.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:allegroKomunikacja.errors,requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||allegroKomunikacja.updated_at,sprawdzono:true};
      allegroZapiszCache();
      if(location.hash==="#/admin/allegro/oferty"&&allegroStan.offerSettings?.autoMapping!==false)setTimeout(()=>allegroUruchomAutomatyczneMapowanie(true),0);
      if(!cicho)toast("Dane Allegro odświeżone");
      const changed=!byloZaladowane||przed!==allegroWersjaSerwerowaZakresu(zakres);
      if(changed&&typeof uniewaznijCachePodstronAdmina==="function")uniewaznijCachePodstronAdmina();
      return {ok:true,changed};
    }catch(e){
      allegroStan={...allegroStan,sprawdzono:true,error:e.message||String(e)};
      if(!cicho)toast("⚠️ Allegro: "+allegroStan.error);
      return {ok:false,changed:false};
    }finally{
      allegroDaneLadowane.delete(zakres);allegroStan={...allegroStan,ladowanie:allegroDaneLadowane.size>0};
    }
  })();
  allegroDaneObietnice.set(zakres,zadanie);
  try{const wynik=await zadanie;if(odswiezWidok&&wynik.changed)renderuj();return wynik.ok;}
  finally{if(allegroDaneObietnice.get(zakres)===zadanie)allegroDaneObietnice.delete(zakres);}
}
async function allegroPolacz(){
  if(allegroStan.credentialsRedacted){location.hash="#/admin/allegro/ustawienia";toast("Najpierw wpisz pełny Client ID i Client Secret w bezpiecznym sejfie Allegro");return;}
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
    const d=await chmura("allegro-sync-orders",{method:"POST",body:{limit:200},timeout:120000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    if(d.archive&&typeof d.archive==="object")allegroArchiwum={...allegroArchiwum,summary:{...allegroArchiwum.summary,...d.archive}};
    const odczyt=Date.now();allegroDaneZaladowane.orders=true;allegroDaneZaladowane.summary=true;allegroDaneOdczytAt.orders=odczyt;allegroDaneOdczytAt.summary=odczyt;allegroAktualizujPodsumowanieZamowien(d.updated_at,d.archive);
    await chmuraWczytajStan();
    allegroZapiszCache();
    toast(`Agent Allegro: nowe ${d.imported_new||0} • odświeżone ${d.refreshed||0} • do obsługi ${allegroZamowienia.filter(allegroZamowienieAktywneLokalnie).length} • archiwum ${d.archive?.total||0}`);
    renderuj();
  }catch(e){ toast("⚠️ Allegro zamówienia: "+(e.message||e)); }
}
async function allegroOznaczZamowienieSprawdzone(orderId,checked=true){
  try{
    const orderIds=Array.isArray(orderId)?orderId:[orderId];
    const d=await chmura("allegro-order-checked",{method:"POST",body:{orderIds,checked},timeout:30000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia.map(z=>String(z.id)===String(orderId)?d.order:z);
    allegroAktualizujPodsumowanieZamowien(d.updated_at);
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
    allegroAktualizujPodsumowanieZamowien(d.updated_at);
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
    const odczyt=Date.now();allegroDaneZaladowane.offers=true;allegroDaneZaladowane.summary=true;allegroDaneOdczytAt.offers=odczyt;allegroDaneOdczytAt.summary=odczyt;allegroPodsumowanie.offers={...(allegroPodsumowanie.offers||{}),count:allegroOferty.length,mapped:Object.values(allegroMapowania||{}).filter(x=>x?.productId&&x?.blocked!==true).length,updated_at:d.updated_at||new Date().toISOString()};
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
let allegroAutoMapowanieSerwera={busy:false,lastAttempt:0,lastMapped:0,error:""};
async function allegroUruchomAutomatyczneMapowanie(cicho=false){
  if(allegroAutoMapowanieSerwera.busy||allegroStan.offerSettings?.autoMapping===false)return false;
  const now=Date.now();if(cicho&&now-Number(allegroAutoMapowanieSerwera.lastAttempt||0)<5*60*1000)return false;
  allegroAutoMapowanieSerwera={...allegroAutoMapowanieSerwera,busy:true,lastAttempt:now,error:""};
  if(!cicho){toast("Agent łączy pewne, bezkolizyjne oferty z produktami sklepu…");renderuj();}
  try{
    const d=await chmura("allegro-auto-map-offers",{method:"POST",body:{source:cicho?"panel-auto":"admin"},timeout:180000});
    allegroMapowania=d.mappings&&typeof d.mappings==="object"?d.mappings:allegroMapowania;
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    allegroAutoMapowanieSerwera={busy:false,lastAttempt:now,lastMapped:Number(d.autoMapped)||0,error:""};
    allegroZapiszCache();
    if(d.autoMapped||d.quarantined||!cicho){toast(`✅ Automatyczne mapowanie: połączono ${d.autoMapped||0}${d.quarantined?` • wstrzymano błędnych ${d.quarantined}`:""}`);renderuj();}
    return true;
  }catch(e){
    allegroAutoMapowanieSerwera={busy:false,lastAttempt:now,lastMapped:0,error:e.message||String(e)};
    if(!cicho)toast("⚠️ Automatyczne mapowanie Allegro: "+(e.message||e));
    renderuj();return false;
  }
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
  await allegroMapujOferte(o.id,id,{syncOffer:false});
  const onboardingProduct=pobierzProduktAdmin(id)||poprawiony,onboardingState=agentAIStanWdrozeniaProduktu(onboardingProduct),onboardingStatus=onboardingState.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie produktu utworzonego z Allegro: ${poprawiony.nazwa}`,{produktId:id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  toast("Produkt utworzony z Allegro i podpięty");
}
