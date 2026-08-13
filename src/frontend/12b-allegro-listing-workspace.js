/* ═══════════ ALLEGRO — PROFESJONALNE CENTRUM WYSTAWIANIA ═══════════ */
let allegroWystawianieSort="gotowosc",allegroWystawianieStrona=1;
let allegroWystawianieFiltry={kategoria:"wszystkie",producent:"wszyscy",dane:"wszystkie",sprzedaz:"wszystkie",magazyn:"wszystkie",zrodlo:"wszystkie",cenaOd:"",cenaDo:""};
let allegroPublikacjaCentralna={signature:"",loading:false,data:null,error:"",request:null,cache:new Map()};
const ALLEGRO_PUBLICATION_CACHE_MS=5*60*1000;

function allegroPublikacjaTrybSerwera(filter=filtrAllegroWystawiania){
  return ({bez_oferty:"publikacja-bez-oferty",gotowe_nowe:"publikacja-gotowe",braki_nowe:"publikacja-braki",do_aktualizacji:"publikacja-aktualizacja",szkice_do_aktywacji:"publikacja-szkice",zakonczone:"publikacja-zakonczone",wycofane_brak_towaru:"publikacja-wstrzymane",do_weryfikacji:"publikacja-weryfikacja",do_dzialania:"publikacja-kolejka"})[filter]||"publikacja-kolejka";
}
function allegroPublikacjaSortSerwera(value=allegroWystawianieSort){
  return ({nazwa:"nazwa",producent:"producent",external:"external",najnowsze:"najnowsze",cena:"cena-rosnaco",cena_desc:"cena-malejaco"})[value]||"braki-danych";
}
function allegroPublikacjaCentralnaParametry(mode=allegroPublikacjaTrybSerwera()){
  const f=allegroWystawianieFiltry||{},data=({kompletne:"gotowe",braki:"braki",ean:"ean",zdjecie:"zdjecie",opis:"opis",producent:"producent",kategoria:"kategoria"})[f.dane]||"wszystkie",stock=({dostepne:"dostepne",niskie:"niskie",brak:"brak",bez_limitu:"bez_limitu"})[f.magazyn]||"wszystkie";
  const sale=f.sprzedaz==="aktywna"?"dostepne":f.sprzedaz==="wycofana_brak_towaru"?"niedostepne":"wszystkie";
  return {q:String(szukajAllegroWystawiania||"").trim(),category:f.kategoria==="wszystkie"?"":f.kategoria,producer:f.producent==="wszyscy"?"":f.producent,status:"active",stock,allegro:mode,data,sale,link:f.zrodlo,allegroPriceMin:f.cenaOd,allegroPriceMax:f.cenaDo,sort:allegroPublikacjaSortSerwera(),page:allegroWystawianieStrona,limit:Math.max(25,Number(allegroLimitWystawiania)||50)};
}
function allegroPublikacjaCentralnaSygnatura(){return JSON.stringify(allegroPublikacjaCentralnaParametry());}
function allegroPublikacjaCentralnaTrasa(){return trasa()==="/admin/allegro/oferty";}
function allegroPublikacjaCentralnaUniewaznij(){allegroPublikacjaCentralna.cache.clear();allegroPublikacjaCentralna.data=null;allegroPublikacjaCentralna.signature="";}
function allegroPublikacjaAktualizujDOM(){
  if(!allegroPublikacjaCentralnaTrasa()||allegroCentrumOfertTryb==="sprzedaz")return false;
  const current=document.querySelector(".allegro-offer-unified-content .allegro-listing-workspace");if(!current)return false;
  const active=document.activeElement,restoreSearch=active?.matches?.("[data-allegro-publication-search]")===true,selection=restoreSearch?[active.selectionStart,active.selectionEnd]:null,scrollY=window.scrollY;
  const renderer=typeof allegroWystawianieAktualnePanelHTML==="function"?allegroWystawianieAktualnePanelHTML:allegroWystawianieBazowePanelHTML;
  const template=document.createElement("template");template.innerHTML=renderer().trim();const next=template.content.firstElementChild;if(!next)return false;
  current.replaceWith(next);window.scrollTo({top:scrollY,left:window.scrollX,behavior:"auto"});
  const currentStages=document.querySelector("[data-allegro-stage-filters]");
  if(currentStages&&typeof allegroEtapyOfertHTML==="function"){
    const stageTemplate=document.createElement("template"),truth=(Array.isArray(allegroOferty)?allegroOferty:[]).map(allegroAnalizaMapowaniaOferty);
    stageTemplate.innerHTML=allegroEtapyOfertHTML(allegroPublikacjaCentralna.data||{},truth).trim();
    if(stageTemplate.content.firstElementChild)currentStages.replaceWith(stageTemplate.content.firstElementChild);
  }
  if(restoreSearch){const input=document.querySelector("[data-allegro-publication-search]");if(input){input.focus({preventScroll:true});try{input.setSelectionRange(selection[0],selection[1]);}catch(error){}}}
  return true;
}
async function allegroPublikacjaCentralnaPobierz(force=false){
  const signature=allegroPublikacjaCentralnaSygnatura(),cached=allegroPublikacjaCentralna.cache.get(signature);
  if(!force&&cached&&Date.now()-cached.at<ALLEGRO_PUBLICATION_CACHE_MS){allegroPublikacjaCentralna={...allegroPublikacjaCentralna,signature,loading:false,data:cached.data,error:"",request:null};allegroPublikacjaAktualizujDOM();return cached.data;}
  if(allegroPublikacjaCentralna.loading&&allegroPublikacjaCentralna.signature===signature&&allegroPublikacjaCentralna.request)return allegroPublikacjaCentralna.request;
  const request=chmura("product-catalog-query",{params:allegroPublikacjaCentralnaParametry(),timeout:30000,headers:cached?.etag?{"If-None-Match":cached.etag}:{},allowNotModified:true}).then(data=>{
    if(allegroPublikacjaCentralnaSygnatura()!==signature)return data;
    if(data?.notModified&&cached){cached.at=Date.now();cached.etag=data.etag||cached.etag;allegroPublikacjaCentralna={...allegroPublikacjaCentralna,signature,loading:false,data:cached.data,error:"",request:null};allegroPublikacjaAktualizujDOM();return cached.data;}
    if(Array.isArray(data.items))zapamietajProduktyCentralne(data.items);
    const result={...data};allegroPublikacjaCentralna.cache.set(signature,{at:Date.now(),data:result,etag:data?._etag||""});
    while(allegroPublikacjaCentralna.cache.size>32)allegroPublikacjaCentralna.cache.delete(allegroPublikacjaCentralna.cache.keys().next().value);
    allegroPublikacjaCentralna={...allegroPublikacjaCentralna,signature,loading:false,data:result,error:"",request:null};if(!allegroPublikacjaAktualizujDOM()&&allegroPublikacjaCentralnaTrasa())renderuj();return result;
  }).catch(error=>{if(allegroPublikacjaCentralnaSygnatura()===signature){allegroPublikacjaCentralna={...allegroPublikacjaCentralna,signature,loading:false,data:cached?.data||allegroPublikacjaCentralna.data,error:String(error?.message||error),request:null};if(!allegroPublikacjaAktualizujDOM()&&allegroPublikacjaCentralnaTrasa())renderuj();}return null;});
  allegroPublikacjaCentralna={...allegroPublikacjaCentralna,signature,loading:true,data:cached?.data||allegroPublikacjaCentralna.data,error:"",request};return request;
}
function allegroPublikacjaCentralnaWidok(){
  const signature=allegroPublikacjaCentralnaSygnatura(),cached=allegroPublikacjaCentralna.cache.get(signature);
  if(cached){if(Date.now()-cached.at>=ALLEGRO_PUBLICATION_CACHE_MS&&(!allegroPublikacjaCentralna.loading||allegroPublikacjaCentralna.signature!==signature))setTimeout(()=>allegroPublikacjaCentralnaPobierz(false),0);return {ready:true,data:cached.data,refreshing:Date.now()-cached.at>=ALLEGRO_PUBLICATION_CACHE_MS};}
  if(allegroPublikacjaCentralna.signature===signature&&allegroPublikacjaCentralna.data)return {ready:true,data:allegroPublikacjaCentralna.data,refreshing:allegroPublikacjaCentralna.loading};
  if(allegroPublikacjaCentralna.signature===signature&&allegroPublikacjaCentralna.error)return {error:allegroPublikacjaCentralna.error};
  if(!allegroPublikacjaCentralna.loading||allegroPublikacjaCentralna.signature!==signature)setTimeout(()=>allegroPublikacjaCentralnaPobierz(false),0);
  return {loading:true};
}

function allegroPublikacjaWybraneIds(){
  const data=allegroPublikacjaCentralna?.data,allowed=new Set((Array.isArray(data?.ids)?data.ids:data?.items||[]).map(item=>String(item?.id??item)));
  return [...zaznaczoneAllegroProduktyKatalogu].map(String).filter(id=>{if(allowed.size&&!allowed.has(id))return false;const product=asortymentProduktPoId(id);return product?!czyProduktAdminWKoszu(product)&&allegroPublikacjaMetaProduktu(product).selectable:allowed.has(id);});
}
function allegroPublikacjaZmienZapytanie(){document.querySelector(".allegro-offer-unified-content .allegro-listing-workspace")?.classList.add("is-refreshing");return allegroPublikacjaCentralnaPobierz(false);}
function allegroPublikacjaUstawStrone(value){allegroWystawianieStrona=Math.max(1,Number(value)||1);allegroPublikacjaZmienZapytanie();}
function allegroPublikacjaPrzelaczFiltr(value){filtrAllegroWystawiania=String(value||"bez_oferty");allegroWystawianieStrona=1;allegroPublikacjaZmienZapytanie();}
function allegroPublikacjaPrzelaczSort(value){allegroWystawianieSort=String(value||"gotowosc");allegroWystawianieStrona=1;allegroPublikacjaZmienZapytanie();}
function allegroPublikacjaUstawFiltrZaawansowany(key,value){if(!(key in allegroWystawianieFiltry))return;allegroWystawianieFiltry={...allegroWystawianieFiltry,[key]:String(value??"")};allegroWystawianieStrona=1;allegroPublikacjaZmienZapytanie();}
function allegroPublikacjaUstawLimit(value){allegroLimitWystawiania=Number(value)||50;allegroWystawianieStrona=1;allegroPublikacjaZmienZapytanie();}
function allegroPublikacjaSzukaj(value){szukajAllegroWystawiania=String(value||"").toLowerCase();allegroWystawianieStrona=1;clearTimeout(window.__allegroPublicationSearch);window.__allegroPublicationSearch=setTimeout(()=>allegroPublikacjaZmienZapytanie(),280);}
function allegroPublikacjaResetujFiltry(){szukajAllegroWystawiania="";filtrAllegroWystawiania="bez_oferty";allegroWystawianieSort="gotowosc";allegroWystawianieFiltry={kategoria:"wszystkie",producent:"wszyscy",dane:"wszystkie",sprzedaz:"wszystkie",magazyn:"wszystkie",zrodlo:"wszystkie",cenaOd:"",cenaDo:""};allegroWystawianieStrona=1;allegroPublikacjaZmienZapytanie();}
function allegroPublikacjaZaznaczIds(ids=[],checked=true){
  const data=allegroPublikacjaCentralna?.data,allowed=new Set((Array.isArray(data?.ids)?data.ids:data?.items||[]).map(item=>String(item?.id??item)));
  const safe=ids.map(String).filter(id=>{if(allowed.size&&!allowed.has(id))return false;const p=asortymentProduktPoId(id);return p?allegroPublikacjaMetaProduktu(p).selectable:allowed.has(id);});
  allegroZaznaczOfertyProduktow(safe,checked);
}
function allegroPublikacjaWyczyscWybor(){zaznaczoneAllegroProduktyKatalogu.clear();zaznaczoneAllegroOferty.clear();renderuj();}
function allegroPublikacjaPrzelaczWybor(id,checked){
  const p=asortymentProduktPoId(id),allowed=p&&allegroPublikacjaMetaProduktu(p).selectable;
  allegroZaznaczOfertyProduktow([id],!!checked&&!!allowed);
}
function allegroPublikacjaPrzeniesWyborDoAgenta(ids=[]){
  zaznaczoneProdukty.clear();
  ids.map(String).filter(Boolean).forEach(id=>zaznaczoneProdukty.add(id));
}
function allegroPublikacjaDostepnoscMeta(p={},offer=null){
  const status=String(offer?.status||offer?.publication?.status||"").toUpperCase();
  const availability=typeof wpisDostepnosciProduktu==="function"?(wpisDostepnosciProduktu(p?.id)||{}):{};
  const decision=String(availability.decision||availability.decyzja||"").trim().toLowerCase();
  const availabilityStatus=String(availability.status||"").trim().toLowerCase();
  const productUnavailable=typeof produktOznaczonyNiedostepny==="function"&&produktOznaczonyNiedostepny(p);
  const saleAvailable=typeof produktDostepnyWSprzedazy==="function"?produktDostepnyWSprzedazy(p):!productUnavailable;
  const withdrawnReason=String(offer?.withdrawnReason||p.allegroOfferWithdrawnReason||"").trim().toLowerCase();
  const unavailableReason=["unavailable","brak_towaru","brak","niedostepny"].includes(withdrawnReason)
    ||["wait_available","hide_manual"].includes(decision)
    ||["niedostepny","ukryty","wstrzymany","brak"].includes(availabilityStatus);
  const linkedToAvailability=offer?.saleAvailabilityBlocked===true||productUnavailable||unavailableReason;
  const linkedOffer=!!offer||!!String(p.allegroOfferId||p.allegro?.offerId||"").trim();
  const withdrawnNoStock=linkedOffer&&linkedToAvailability;
  const pendingWithdrawal=withdrawnNoStock&&["","ACTIVE","UNKNOWN"].includes(status);
  const automatic=availability.automatic===true||availability.source==="producent-agent";
  const reason=String(availability.reason||availability.powod||p.allegroOfferWithdrawnReason||"").trim()
    ||(automatic?"brak dostępności potwierdzony przez kontrolę producenta":"produkt ukryty decyzją dostępności");
  return {availability,decision,saleAvailable,productUnavailable,withdrawnNoStock,pendingWithdrawal,automatic,reason};
}
function allegroPublikacjaMetaProduktu(p={}){
  const registeredOffer=typeof asortymentOfertaProduktu==="function"?asortymentOfertaProduktu(p):allegroOfertaDlaProduktuSklepu(p),channel=p?._catalog?.channels?.allegro||{};
  const channelOfferId=String(channel.offerId||p.allegroOfferId||p.allegro?.offerId||"").trim(),offer=registeredOffer||(channelOfferId?{id:channelOfferId,status:channel.status||""}:null);
  const offerId=String(offer?.id||channelOfferId).trim();
  const status=String(offer?.status||offer?.publication?.status||(offerId?"UNKNOWN":"")).toUpperCase();
  const missing=allegroBrakiProduktuDoWystawienia(p);
  const unresolved=!!offerId&&!registeredOffer&&!channel.offerId;
  const noOffer=!offerId;
  const differences=registeredOffer?allegroRozniceOfertyProduktu(p,registeredOffer):[];
  const inactive=!!offer&&status!=="ACTIVE";
  const needsUpdate=!!offer&&(p.allegroEditorialSyncPending===true||!!differences.length);
  const availability=allegroPublikacjaDostepnoscMeta(p,offer);
  const draft=inactive&&!availability.withdrawnNoStock&&!["ENDED","ARCHIVED"].includes(status);
  const ended=inactive&&!availability.withdrawnNoStock&&["ENDED","ARCHIVED"].includes(status);
  const selectable=availability.saleAvailable&&!availability.withdrawnNoStock&&!unresolved;
  return {
    offer,offerId,status,missing,differences,
    noOffer,unresolved,
    active:!!offer&&status==="ACTIVE",
    inactive,draft,ended,needsUpdate,selectable,
    saleAvailable:availability.saleAvailable,
    withdrawnNoStock:availability.withdrawnNoStock,
    pendingStockWithdrawal:availability.pendingWithdrawal,
    availabilityReason:availability.reason,
    availabilityAutomatic:availability.automatic,
    actionable:availability.withdrawnNoStock||(availability.saleAvailable&&(noOffer||unresolved||inactive||needsUpdate)),
    ready:!missing.length,
    readyNew:availability.saleAvailable&&noOffer&&!missing.length,
    missingNew:availability.saleAvailable&&noOffer&&!!missing.length,
  };
}
function allegroPublikacjaOtworzDecyzje(singleId=null,operation="activate"){
  const source=singleId===null?allegroPublikacjaWybraneIds():[String(singleId)],blocked=[];
  const ids=source.filter(id=>{const p=asortymentProduktPoId(id);if(!p||!produktDostepnyWSprzedazy(p))return false;const meta=allegroPublikacjaMetaProduktu(p);if(meta.unresolved){blocked.push(p);return false;}return true;});
  if(!ids.length){toast(blocked.length?"Najpierw odśwież i zweryfikuj zapisane powiązanie oferty — publikacja duplikatu została zablokowana":"Zaznacz co najmniej jeden produkt do wystawienia");return;}
  if(blocked.length)toast(`Pominięto ${blocked.length} produktów z niezweryfikowanym ID oferty`);
  allegroPublikacjaPrzeniesWyborDoAgenta(ids);
  asortymentPrzygotujOperacjeZewnetrzna(operation,singleId,true);
}
function allegroPublikacjaPrzygotujWybrane(singleId=null){
  const ids=singleId===null?allegroPublikacjaWybraneIds():[String(singleId)];
  if(!ids.length){toast("Zaznacz produkty, które Agent ma przygotować");return;}
  allegroPublikacjaPrzeniesWyborDoAgenta(ids);
  return asortymentUruchomAgenta(ids,"product-full-review");
}
function allegroPublikacjaPrzygotujWybranePoId(ids=[]){
  const selected=[...new Set(ids.map(String).filter(Boolean))];
  if(!selected.length){toast("W aktywnym filtrze nie ma produktów wymagających przygotowania");return;}
  allegroWyczyscZaznaczenieOfert();allegroPublikacjaZaznaczIds(selected);
  return allegroPublikacjaPrzygotujWybrane();
}
function allegroPublikacjaWystawGotowe(ids=[]){
  const ready=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id),meta=p?allegroPublikacjaMetaProduktu(p):null;return p&&meta?.selectable&&meta.ready&&!meta.active;});
  if(!ready.length){toast("W bieżącym widoku nie ma gotowych produktów możliwych do bezpiecznej publikacji");return;}
  allegroWyczyscZaznaczenieOfert();
  ready.forEach(id=>zaznaczoneAllegroProduktyKatalogu.add(String(id)));
  allegroPublikacjaOtworzDecyzje(null,"activate");renderuj();
}
function allegroPublikacjaZaznaczGotoweNowe(ids=[]){
  const ready=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id);return p&&produktDostepnyWSprzedazy(p)&&allegroPublikacjaMetaProduktu(p).readyNew;});
  allegroWyczyscZaznaczenieOfert();allegroPublikacjaZaznaczIds(ready);renderuj();
  if(!ready.length)toast("W aktywnym filtrze nie ma gotowych nowych ofert");
}
function allegroPublikacjaZaznaczDoAktualizacji(ids=[]){
  const selected=ids.map(String).filter(id=>{const p=asortymentProduktPoId(id);return p&&produktDostepnyWSprzedazy(p)&&allegroPublikacjaMetaProduktu(p).needsUpdate;});
  allegroWyczyscZaznaczenieOfert();allegroPublikacjaZaznaczIds(selected);renderuj();
  if(!selected.length)toast("W aktywnym filtrze nie ma ofert wymagających aktualizacji");
}
function allegroPublikacjaOtworzEdytor(id,section="allegro"){
  try{sessionStorage.setItem("artway_product_editor_section",String(section||"allegro"));}catch(error){}
  location.hash=`#/admin/produkty/edytuj/${encodeURIComponent(id)}`;
}
function allegroPublikacjaTrybProduktu(p={},offer=null){
  const meta=allegroPublikacjaMetaProduktu(p),status=meta.status;
  if(meta.withdrawnNoStock)return {operation:"",label:meta.pendingStockWithdrawal?"Oczekuje na wycofanie":"Wycofana — brak towaru",note:meta.availabilityReason,icon:"⏸",disabled:true};
  if(!offer)return {operation:"activate",label:"Wystaw na Allegro",note:"nowa aktywna oferta",icon:"🟠"};
  if(meta.ended)return {operation:"activate",label:"Wznów zakończoną ofertę",note:`zakończona oferta ${offer.id}`,icon:"↗"};
  if(status!=="ACTIVE")return {operation:"activate",label:"Aktywuj szkic",note:`szkic oferty ${offer.id}`,icon:"🚀"};
  return {operation:"update",label:"Opublikuj aktualizację",note:`aktywna oferta ${offer.id}`,icon:"↻"};
}
function allegroPublikacjaOcena(p={},offer=null,missing=[]){
  const meta=allegroPublikacjaMetaProduktu(p);
  if(meta.withdrawnNoStock)return {code:"stock-blocked",label:meta.pendingStockWithdrawal?"Oczekuje na wycofanie z Allegro":"Wycofana z powodu braku towaru",detail:`Wspólna decyzja sklep + Allegro • ${meta.availabilityReason}`,score:0};
  if(missing.length)return {code:"missing",label:"Wymaga uzupełnienia",detail:missing.join(", "),score:Math.max(8,Math.round((7-Math.min(7,missing.length))/7*100))};
  if(p.allegroAgentPublicationError)return {code:"verify",label:"Kompletne lokalnie • ponowna kontrola API",detail:"Poprzednią próbę odrzucił katalog Allegro; przy kolejnym wystawieniu system spróbuje bezpiecznej korekty i ponowi operację.",score:90};
  const differences=offer?allegroRozniceOfertyProduktu(p,offer):[];
  if(!offer)return {code:"ready",label:"Gotowy do wystawienia",detail:"komplet danych • brak oferty",score:100};
  if(String(offer.status||"").toUpperCase()!=="ACTIVE")return {code:"draft",label:"Gotowy do aktywacji",detail:`oferta ${offer.id} • ${offer.status||"nieaktywna"}`,score:100};
  if(differences.length)return {code:"update",label:"Aktualizacja gotowa",detail:`zmiany: ${differences.join(", ")}`,score:100};
  return {code:"synced",label:"Oferta aktualna",detail:`oferta ${offer.id} • bez zmian`,score:100};
}
function allegroPublikacjaCzyBlokadaDostawcyAI(value=""){return /(?:429|credit|credits|quota|billing|insufficient_quota|rate.?limit)/i.test(String(value||""));}
function allegroPublikacjaKomunikatWyniku(item={}){
  const raw=String(item.error||(item.missing||[]).join(", ")||item.message||"").trim();
  if(String(item.status||"")==="waiting_provider"||allegroPublikacjaCzyBlokadaDostawcyAI(raw))return "Dostęp AI jest wstrzymany. Zadanie i dotychczasowe dane są bezpiecznie zapisane; system nie publikuje ani nie tworzy duplikatu.";
  return raw||"Kontrola kartoteki zakończona bez dodatkowego komunikatu.";
}
function allegroPublikacjaPostepSerweraHTML(){
  const queue=typeof allegroStanKolejkiPrzygotowania==="function"?allegroStanKolejkiPrzygotowania():null;
  if(!queue){
    if(typeof asortymentSprawdzKolejkeSerwera==="function"&&!asortymentSerwerowaKolejka?.checking)setTimeout(()=>void asortymentSprawdzKolejkeSerwera({render:true}),0);
    return `<section class="allegro-server-preparation-progress is-loading" data-allegro-server-preparation aria-live="polite"><header><div><span>⟳</span><div><small>TRWAŁA KOLEJKA POSTGRESQL</small><h3>Odczytuję stan przygotowania produktów…</h3><p>Ten odczyt nie uruchamia publikacji ani nowej pracy Agenta.</p></div></div></header></section>`;
  }
  const batches=Array.isArray(queue.batches)?queue.batches:[],preferred=batches.find(item=>String(item.id)===String(asortymentSerwerowaKolejka?.batchId||"")),working=batches.find(item=>Number(item.pending||0)+Number(item.running||0)>0),batch=preferred||working||batches[0]||null;
  if(!batch)return `<section class="allegro-server-preparation-progress is-idle" data-allegro-server-preparation><header><div><span>✓</span><div><small>TRWAŁA KOLEJKA POSTGRESQL</small><h3>Brak aktywnej partii przygotowania</h3><p>Po użyciu „Przygotuj zaznaczone” pojawi się tutaj pełny postęp pracy na serwerze.</p></div></div><strong>0</strong></header><div class="allegro-server-progress-controls"><span>Kolejką możesz sterować również w Agent AI → Praca na serwerze.</span><button class="btn ghost" type="button" onclick="asortymentSprawdzKolejkeSerwera({render:true})">↻ Odśwież</button></div></section>`;
  const pending=Math.max(0,Number(batch.pending)||0),running=Math.max(0,Number(batch.running)||0),completed=Math.max(0,Number(batch.completed)||0),attention=Math.max(0,Number(batch.attention)||0),waiting=Math.max(0,Number(batch.waitingProvider)||0),decisions=Math.max(0,Number(batch.decisionRequired)||0),failed=Math.max(0,Number(batch.failed)||0),cancelled=Math.max(0,Number(batch.cancelled)||0),paused=queue.paused===true,total=Math.max(0,Number(batch.total)||pending+running+completed+attention+waiting+decisions+failed+cancelled),done=completed+attention+waiting+decisions+failed+cancelled,busy=pending+running>0,percent=total?Math.min(100,Math.round(done/total*100)):0;
  const previousPending=Math.max(0,(Number(queue.pending)||0)-pending),active=queue.active&&String(queue.active.batchId)===String(batch.id)?queue.active:null,product=active&&typeof asortymentProduktPoId==="function"?asortymentProduktPoId(active.productId):null,tracked=new Set((batch.trackedTaskIds||[]).map(String)),results=(Array.isArray(queue.recent)?queue.recent:[]).filter(item=>tracked.size?tracked.has(String(item.id)):String(item.batchId)===String(batch.id)).slice(0,6);
  return `<section class="allegro-server-preparation-progress ${paused?"is-paused":busy?"is-running":"is-complete"}" data-allegro-server-preparation aria-live="polite"><header><div><span>${paused?"Ⅱ":busy?"⟳":"✓"}</span><div><small>TRWAŁY PROCES SERWEROWY • WIDOCZNY NA KAŻDYM URZĄDZENIU</small><h3>${paused?`Kolejka wstrzymana • ${pending} oczekuje`:busy?`Przygotowanie na serwerze • ${Math.min(total,done+running)} z ${total}`:`Ostatnia partia • ${done} z ${total}`}</h3><p>${active?`${esc(product?.nazwa||active.productId)} • pełny przegląd edytora → sklep → Allegro → Von Halsky`:paused?"Nowe zadanie nie rozpocznie się do chwili wznowienia.":"Stan zapisany w PostgreSQL; zamknięcie karty nie przerywa procesu."}</p></div></div><strong>${percent}%</strong></header><div class="allegro-server-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total||100}" aria-valuenow="${done}"><i style="width:${percent}%"></i></div><div class="allegro-server-progress-controls"><span>${paused?"Kolejka jest trwale wstrzymana w PostgreSQL.":busy?"Bieżący zapis kończy się bezpiecznie; sterowanie dotyczy następnych zadań.":"Ostatni stan pochodzi bezpośrednio z serwera."}</span><div>${paused?`<button class="btn" type="button" onclick="asortymentSterujKolejkaSerwera('resume')">▶ Wznów</button>`:busy?`<button class="btn ghost" type="button" onclick="asortymentSterujKolejkaSerwera('pause')">⏸ Wstrzymaj</button>`:""}${previousPending?`<button class="btn danger" type="button" onclick="asortymentSterujKolejkaSerwera('cancel_previous',${jsArg(String(batch.id))})">⛔ Anuluj wcześniejsze (${previousPending})</button>`:""}${pending?`<button class="btn danger" type="button" onclick="asortymentSterujKolejkaSerwera('cancel',${jsArg(String(batch.id))})">⛔ Anuluj bieżące (${pending})</button>`:""}<button class="btn ghost" type="button" onclick="asortymentSprawdzKolejkeSerwera({render:true})">↻ Odśwież</button><a class="btn ghost" href="#/admin/agent-ai/praca">Agent AI</a></div></div><div class="allegro-server-progress-stages"><div class="active"><span>1</span><b>Dobór pracy</b><small>kolejność i kryteria</small></div><div class="${busy?"active":""}"><span>2</span><b>Agent</b><small>treść, kategoria, GPSR</small></div><div class="${done?"active":""}"><span>3</span><b>Zapis centralny</b><small>PostgreSQL + odczyt</small></div><div><span>4</span><b>Publikacja API</b><small>po decyzji administratora</small></div></div><div class="allegro-server-progress-summary"><span><b>${pending}</b> oczekuje</span><span><b>${running}</b> wykonywane</span><span class="ok"><b>${completed}</b> potwierdzone</span><span class="attention"><b>${attention+waiting+decisions}</b> wymaga danych</span><span class="${failed?"error":""}"><b>${failed}</b> błędów</span>${cancelled?`<span><b>${cancelled}</b> anulowane</span>`:""}</div>${results.length?`<div class="allegro-server-progress-results">${results.map(item=>{const ok=String(item.status)==="completed",provider=String(item.status)==="waiting_provider"||allegroPublikacjaCzyBlokadaDostawcyAI(item.error),label=ok?"Zapis potwierdzony":provider?"Oczekuje na dostęp AI":"Wymaga danych";return `<article class="${ok?"saved":provider?"waiting":"attention"}"><span>${ok?"✓":provider?"◷":"!"}</span><div><b>${esc(item.name||item.productName||item.productId||"Produkt")}</b><small>${esc(allegroPublikacjaKomunikatWyniku(item))}</small></div><em>${label}</em>${item.productId?`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(item.productId)}">Edytor</a>`:""}</article>`;}).join("")}</div>`:""}</section>`;
}
function allegroPublikacjaCentrumOperacjiHTML(){
  const ids=allegroPublikacjaWybraneIds(),products=ids.map(asortymentProduktPoId).filter(Boolean),metas=products.map(allegroPublikacjaMetaProduktu),q=asortymentAgentKolejka,d=asortymentAllegroDecyzja,ready=metas.filter(x=>x.ready&&!x.unresolved).length,missing=metas.filter(x=>!x.ready).length,unresolved=metas.filter(x=>x.unresolved).length;
  return `<section class="allegro-publication-command"><div class="allegro-publication-flow"><div><span>1</span><b>Dopasuj</b><small>GTIN, kod, katalog i oferta</small></div><i>›</i><div><span>2</span><b>Uzupełnij</b><small>Treść, zdjęcia, parametry i GPSR</small></div><i>›</i><div><span>3</span><b>Sprawdź</b><small>Podgląd, cena i kontrola jakości</small></div><i>›</i><div><span>4</span><b>Opublikuj</b><small>Wyłącznie zaznaczone po decyzji</small></div></div><div class="allegro-publication-steps allegro-publication-steps-three allegro-publication-steps-four"><article class="${ids.length?"active":""}"><span>1</span><div><small>DOPASOWANIE • WYBÓR ZAKRESU</small><b>${ids.length} produktów wybranych</b><p>Gotowe ${ready} • z brakami ${missing} • do weryfikacji ${unresolved}.</p></div></article><article class="${q.busy?"active":""}"><span>2</span><div><small>UZUPEŁNIENIE</small><b>Agent przygotowuje kartoteki</b><p>Katalog, parametry, GPSR, opis, zdjęcia i warunki Allegro.</p></div><button class="btn ghost" onclick="allegroPublikacjaPrzygotujWybrane()" ${!ids.length||q.busy||d.busy?"disabled":""}>🤖 Przygotuj zaznaczone</button></article><article class="${ids.length&&ready===ids.length?"active":""}"><span>3</span><div><small>KONTROLA I ZAPIS</small><b>${ready} kartotek przeszło kontrolę</b><p>Wynik 100% wymaga aktualnego zapisu i odczytu kontrolnego z PostgreSQL.</p></div></article><article class="publication ${d.step!=="idle"?"active":""}"><span>4</span><div><small>PUBLIKACJA PRZEZ API</small><b>${ready} gotowych do wysłania</b><p>Ponowna walidacja i blokada duplikatu dla każdej pozycji • bezpieczne partie po 50 aż do końca wyboru.</p></div><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${!ids.length||q.busy||d.busy||unresolved?"disabled":""}>🟠 Wystaw zaznaczone</button></article></div>${asortymentDecyzjaZewnetrznaHTML()}</section>`;
}
function allegroPublikacjaKartaHTML(p={}){
  const meta=allegroPublikacjaMetaProduktu(p),offer=meta.offer,missing=meta.missing,assessment=meta.withdrawnNoStock?allegroPublikacjaOcena(p,offer,missing):meta.unresolved?{code:"verify",label:"Zweryfikuj powiązanie",detail:`zapisane ID ${meta.offerId} nie jest jeszcze w rejestrze ofert`,score:35}:allegroPublikacjaOcena(p,offer,missing),action=allegroPublikacjaTrybProduktu(p,offer),selected=zaznaczoneAllegroProduktyKatalogu.has(String(p.id)),image=p.zdjecie||(p.zdjecia||[])[0]||"",status=meta.status;
  const categoryResolution=p.allegroCategoryResolution&&typeof p.allegroCategoryResolution==="object"?p.allegroCategoryResolution:{},categoryLabel=p.allegroCategoryName||categoryResolution.categoryName||p.allegroCategoryId||"do dobrania",categoryProof=categoryResolution.source?`${categoryResolution.source}${categoryResolution.confidence?` • ${Math.round(Number(categoryResolution.confidence))}%`:""}`:(p.allegroCategoryId?"zapisana w kartotece":"Agent dobierze podczas przygotowania");
  const statusLabel=meta.withdrawnNoStock?(meta.pendingStockWithdrawal?"ACTIVE • oczekuje na wycofanie":"WYCOFANA • brak towaru"):meta.unresolved?`weryfikacja • ${meta.offerId}`:offer?`${status||"SZKIC"} • ${offer.id}`:"nowa";
  const primaryAction=action.disabled?`<button class="btn stock-blocked-action" disabled>${action.icon} ${esc(action.label)}</button>${meta.unresolved?`<button class="btn ghost" onclick="allegroWczytajDane(true).then(()=>renderuj())">↻ Zweryfikuj ofertę</button>`:""}`:meta.unresolved?`<button class="btn product-allegro-publish" onclick="allegroWczytajDane(true).then(()=>renderuj())">↻ Zweryfikuj ofertę</button>`:missing.length?`<button class="btn product-allegro-publish" onclick="allegroPublikacjaPrzygotujWybrane(${jsArg(p.id)})">Uzupełnij wymagane dane</button>`:`<button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(${jsArg(p.id)},'${action.operation}')">${action.icon} ${esc(action.label)}</button>`;
  const preparation=typeof asortymentStatusPrzygotowania==="function"?asortymentStatusPrzygotowania(p):{code:"new",label:"Nieprzygotowany dla wszystkich kanałów",note:""},preparedAt=p.agentQualityConfirmedAt||p.allegroAgentPreparationConfirmedAt||p.allegroAgentPreparedAt||"";
  const identityLabel=p.allegroProductId?"PRODUKT KATALOGOWY":(p.gtin||p.ean)?"EAN / GTIN":"DO DOPASOWANIA",identityClass=p.allegroProductId?"ok":(p.gtin||p.ean)?"match":"warn";
  const responsible=p.allegroResponsibleProducer&&typeof p.allegroResponsibleProducer==="object"?p.allegroResponsibleProducer:{},safety=p.allegroSafetyInformation&&typeof p.allegroSafetyInformation==="object"?p.allegroSafetyInformation:{},gpsrReady=!!(responsible.id&&safety.type)||assessment.score===100;
  const stock=p?._catalog?.inventory?.stock??p.stan,offerStock=typeof allegroStanOfertyProduktu==="function"?allegroStanOfertyProduktu(p):"—",channelClass=status==="ACTIVE"&&!meta.withdrawnNoStock?"lvl-ok":meta.unresolved?"lvl-bad":meta.withdrawnNoStock?"lvl-ostrzezenie":offer?"lvl-info":"lvl-ostrzezenie",channelLabel=status==="ACTIVE"&&!meta.withdrawnNoStock?"Aktywna sprzedaż":meta.unresolved?"Zweryfikuj powiązanie":meta.withdrawnNoStock?"Wstrzymana — brak towaru":offer?statusLabel:"Jeszcze niewystawiona";
  return `<tr class="allegro-publication-card allegro-publication-table-row ${selected?"selected":""} ${assessment.code}" data-allegro-listing-product="${esc(p.id)}">
    <td data-label="" class="allegro-publication-cell-select"><input type="checkbox" aria-label="Zaznacz ${esc(p.nazwa||"produkt")}" ${selected?"checked":""} ${meta.selectable?"":"disabled"} onchange="allegroPublikacjaPrzelaczWybor(${jsArg(p.id)},this.checked)"></td>
    <td data-label="Produkt" class="allegro-publication-cell-product"><div class="allegro-publication-product">${image?`<img src="${esc(image)}" alt="" loading="lazy">`:`<span class="empty-image">📦</span>`}<div><h3>${esc(p.nazwa||"Produkt bez nazwy")}</h3><p>${esc(p.kategoria||"bez kategorii")} • ${esc(p.producent||p.marka||"producent —")}</p><em>Prezentacja Allegro</em></div></div></td>
    <td data-label="Identyfikacja" class="allegro-publication-cell-identity"><div class="allegro-publication-identity"><span class="allegro-publication-match ${identityClass}">${esc(identityLabel)}</span><b>EAN ${esc(p.gtin||p.ean||"—")}</b><small>EXTERNAL_ID ${esc(p.externalId||p.sku||p.id||"—")}</small><small>Kod ${esc(p.kodProducenta||p.mpn||"—")} • marka ${esc(p.producent||p.marka||"—")}</small><small>Produkt Allegro ${esc(p.allegroProductId||"do wyszukania po GTIN")}</small><small>Kategoria ${esc(categoryLabel)} • ${esc(categoryProof)}</small><small class="${gpsrReady?"allegro-publication-ok":"allegro-publication-issues"}">GPSR ${gpsrReady?`✓ ${esc(responsible.name||responsible.displayName||"kontrola Agenta potwierdzona")}`:"— wymaga przygotowania"}</small></div></td>
    <td data-label="Gotowość" class="allegro-publication-cell-quality"><div class="allegro-publication-readiness"><div><b>${assessment.score}%</b><span><i style="width:${assessment.score}%"></i></span></div><em class="${esc(preparation.code)}">Agent: ${esc(preparation.label)}</em>${preparedAt?`<small>potwierdzony zapis ${esc(typeof allegroDataTxt==="function"?allegroDataTxt(preparedAt):preparedAt)}</small>`:""}${missing.length?`<small class="allegro-publication-issues">${missing.map(esc).join(" • ")}</small>`:`<small class="allegro-publication-ok">Dane spełniają kontrolę obowiązkową</small>`}${assessment.detail?`<small>${esc(assessment.detail)}</small>`:""}</div></td>
    <td data-label="Cena" class="allegro-publication-cell-price"><div class="allegro-publication-channel-data"><b>${zl(p.cenaAllegro||p.cena)}</b><small>Cena sklepu ${zl(p.cena)}</small><small>${meta.saleAvailable?"produkt dostępny":"sprzedaż produktu wstrzymana"}</small><small>${stock===null||stock===undefined?"stan bez limitu":`magazyn ${esc(stock)} szt.`}</small><small>Stan oferty ${esc(offerStock)} szt.</small></div></td>
    <td data-label="Kanał sprzedaży" class="allegro-publication-cell-channel"><div class="allegro-publication-channel-state"><b>Allegro</b><span class="lvl ${channelClass}">${status==="ACTIVE"&&!meta.withdrawnNoStock?"● ":""}${esc(channelLabel)}</span><small>${offer?`API: ${esc(status||"NIEAKTYWNA")}`:"Brak oferty potwierdzonej przez API"}</small>${offer?`<small>ID ${esc(offer.id)}</small>`:""}${p.allegroProductId?`<small>UUID produktu ${esc(p.allegroProductId)}</small>`:""}</div></td>
    <td data-label="Akcje" class="allegro-publication-cell-actions"><div class="allegro-publication-actions">${primaryAction}${meta.withdrawnNoStock?`<a class="btn ghost" href="#/admin/magazyn/dostawcy">Dostępność i decyzja</a>`:`<div class="allegro-publication-secondary"><button class="btn ghost" onclick="allegroPublikacjaPrzygotujWybrane(${jsArg(p.id)})">🤖 Przygotuj</button><button class="btn ghost" onclick="allegroPublikacjaOtworzEdytor(${jsArg(p.id)},'allegro')">Podgląd</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edycja</a>${offer?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div>`}<small>${meta.unresolved?"Najpierw potwierdź powiązanie — duplikat jest zablokowany":meta.withdrawnNoStock?`Status wynika z tej samej decyzji dostępności, która ukryła produkt w sklepie. ${esc(action.note)}`:"Przed wysłaniem działa ponowna kontrola i blokada duplikatu"}</small></div></td>
  </tr>`;
}

function allegroWystawianieBazowePanelHTML(){
  const query=String(szukajAllegroWystawiania||"").toLowerCase().trim(),all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&produktDostepnyWSprzedazy(p)),counts={wszystkie:all.length,aktywne:0,szkice:0,brak:0,gotowe:0,braki:0,do_aktualizacji:0};
  all.forEach(p=>{const o=allegroOfertaDlaProduktuSklepu(p),m=allegroBrakiProduktuDoWystawienia(p),status=String(o?.status||"").toUpperCase();if(!o)counts.brak++;else if(status==="ACTIVE")counts.aktywne++;else counts.szkice++;if(m.length)counts.braki++;else counts.gotowe++;if(o&&allegroRozniceOfertyProduktu(p,o).length)counts.do_aktualizacji++;});
  let filtered=all.filter(p=>{const o=allegroOfertaDlaProduktuSklepu(p),m=allegroBrakiProduktuDoWystawienia(p),status=String(o?.status||"").toUpperCase();if(filtrAllegroWystawiania==="aktywne"&&status!=="ACTIVE")return false;if(filtrAllegroWystawiania==="szkice"&&(!o||status==="ACTIVE"))return false;if(filtrAllegroWystawiania==="brak"&&o)return false;if(filtrAllegroWystawiania==="gotowe"&&m.length)return false;if(filtrAllegroWystawiania==="braki"&&!m.length)return false;if(filtrAllegroWystawiania==="do_aktualizacji"&&(!o||!allegroRozniceOfertyProduktu(p,o).length))return false;const text=`${p.id||""} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||p.marka||""} ${o?.id||p.allegroOfferId||""}`.toLowerCase();return !query||text.includes(query);});
  const priority=p=>{const o=allegroOfertaDlaProduktuSklepu(p),m=allegroBrakiProduktuDoWystawienia(p);if(!m.length&&!o)return 0;if(!m.length&&String(o?.status||"").toUpperCase()!=="ACTIVE")return 1;if(o&&allegroRozniceOfertyProduktu(p,o).length)return 2;if(m.length)return 3;return 4;};
  filtered.sort((a,b)=>allegroWystawianieSort==="nazwa"?String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl"):allegroWystawianieSort==="najnowsze"?Number(b.id||0)-Number(a.id||0):allegroWystawianieSort==="cena"?kwotaNum(a.cenaAllegro||a.cena)-kwotaNum(b.cenaAllegro||b.cena):priority(a)-priority(b)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl"));
  const pageSize=Math.max(25,Number(allegroLimitWystawiania)||50),pages=Math.max(1,Math.ceil(filtered.length/pageSize));allegroWystawianieStrona=Math.min(Math.max(1,allegroWystawianieStrona),pages);const start=(allegroWystawianieStrona-1)*pageSize,rows=filtered.slice(start,start+pageSize),readyVisible=rows.filter(p=>!allegroBrakiProduktuDoWystawienia(p).length&&String(allegroOfertaDlaProduktuSklepu(p)?.status||"").toUpperCase()!=="ACTIVE");
  allegroWystawianieWynikiIds=filtered.map(p=>p.id);allegroWystawianieStronaIds=rows.map(p=>p.id);const selected=allegroPublikacjaWybraneIds().length;
  return `<div class="allegro-listing-workspace"><section class="panel allegro-listing-hero"><div><span class="order-pro-label">PUBLIKACJA • API ALLEGRO</span><h2>🟠 Centrum wystawiania ofert</h2><p>Przygotuj dane, sprawdź gotowość i wystaw produkt bez opuszczania tej podstrony. System blokuje duplikaty i nie publikuje pozycji z nierozwiązanymi brakami.</p></div><div class="allegro-listing-hero-actions"><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${selected?"":"disabled"}>🟠 Wystaw zaznaczone (${selected})</button><button class="btn ghost" onclick='allegroPublikacjaWystawGotowe(${JSON.stringify(readyVisible.map(p=>String(p.id)))})' ${readyVisible.length?"":"disabled"}>🚀 Wystaw gotowe z widoku (${readyVisible.length})</button><a class="btn ghost" href="#/admin/produkty/dodaj">＋ Dodaj produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia</a></div></section>${!allegroStan.connected?`<section class="allegro-permission-alert"><div><b>Połączenie Allegro wymaga kontroli</b><p>Przed publikacją system wykona test dostępu. Bez ważnej autoryzacji żadna oferta nie zostanie zmieniona.</p></div><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro</button></section>`:""}<section class="allegro-listing-metrics">${[["wszystkie","▦","Produkty",counts.wszystkie],["brak","＋","Nowe oferty",counts.brak],["gotowe","✓","Kompletne dane",counts.gotowe],["braki","⚠","Do uzupełnienia",counts.braki],["do_aktualizacji","↻","Do aktualizacji",counts.do_aktualizacji],["aktywne","●","Aktywne",counts.aktywne]].map(([id,icon,label,value])=>`<button class="${filtrAllegroWystawiania===id?"active":""}" onclick="allegroPublikacjaPrzelaczFiltr('${id}')"><span>${icon}</span><b>${value}</b><small>${label}</small></button>`).join("")}</section><section data-allegro-publication-center>${allegroPublikacjaCentrumOperacjiHTML()}</section><section class="panel allegro-listing-catalog"><div class="allegro-listing-filter"><div class="allegro-listing-search"><small>WYSZUKIWANIE ZAAWANSOWANE</small><input value="${esc(szukajAllegroWystawiania)}" placeholder="Nazwa, ID, SKU, EXTERNAL_ID, EAN, kod producenta, producent lub ID oferty…" oninput="szukajAllegroWystawiania=this.value.toLowerCase();allegroWystawianieStrona=1;zaplanujRenderPoWpisaniu()"></div><label>Stan publikacji<select onchange="allegroPublikacjaPrzelaczFiltr(this.value)">${[["wszystkie","Wszystkie produkty"],["brak","Brak oferty Allegro"],["szkice","Szkice / nieaktywne"],["aktywne","Aktywne"],["do_aktualizacji","Do aktualizacji"],["gotowe","Kompletne dane"],["braki","Wymaga uzupełnienia"]].map(([id,label])=>`<option value="${id}" ${filtrAllegroWystawiania===id?"selected":""}>${label} (${counts[id]||0})</option>`).join("")}</select></label><label>Sortowanie<select onchange="allegroPublikacjaPrzelaczSort(this.value)"><option value="gotowosc" ${allegroWystawianieSort==="gotowosc"?"selected":""}>Najpierw gotowe do publikacji</option><option value="nazwa" ${allegroWystawianieSort==="nazwa"?"selected":""}>Nazwa A–Z</option><option value="najnowsze" ${allegroWystawianieSort==="najnowsze"?"selected":""}>Najnowsze produkty</option><option value="cena" ${allegroWystawianieSort==="cena"?"selected":""}>Cena rosnąco</option></select></label><label>Na stronie<select onchange="allegroLimitWystawiania=Number(this.value)||50;allegroWystawianieStrona=1;renderuj()">${[25,50,100,250,500,1000].map(n=>`<option value="${n}" ${pageSize===n?"selected":""}>${n}</option>`).join("")}</select></label>${query||filtrAllegroWystawiania!=="wszystkie"?`<button class="btn ghost" onclick="szukajAllegroWystawiania='';filtrAllegroWystawiania='wszystkie';allegroWystawianieStrona=1;renderuj()">Wyczyść filtry</button>`:""}</div><div class="allegro-listing-selection"><div><b>${filtered.length} wyników</b><small>Pokazano ${rows.length} • wybrano ${selected}</small></div><button class="btn ghost" onclick='allegroPublikacjaZaznaczIds(${JSON.stringify(rows.map(p=>String(p.id)))})'>☑ Zaznacz stronę</button><button class="btn ghost" onclick='allegroPublikacjaZaznaczIds(${JSON.stringify(filtered.slice(0,ASORTYMENT_MAX_PRODUKTOW_KOLEJKI).map(p=>String(p.id)))})'>☑ Zaznacz wyniki (${Math.min(ASORTYMENT_MAX_PRODUKTOW_KOLEJKI,filtered.length)})</button><button class="btn ghost" onclick="allegroWyczyscZaznaczenieOfert()" ${selected?"":"disabled"}>Odznacz</button><button class="btn ghost" onclick="allegroEksportujProduktyWystawiania('zaznaczone')" ${selected?"":"disabled"}>⇩ Eksportuj zaznaczone</button><button class="btn product-allegro-publish" onclick="allegroPublikacjaOtworzDecyzje(null,'activate')" ${selected?"":"disabled"}>🟠 Wystaw (${selected})</button></div><div class="allegro-publication-list">${rows.map(allegroPublikacjaKartaHTML).join("")||`<div class="allegro-listing-empty"><span>⌕</span><b>Brak produktów w tym widoku</b><small>Zmień filtry albo dodaj nowy produkt do katalogu.</small></div>`}</div>${pages>1?`<nav class="allegro-listing-pagination"><button class="btn ghost" onclick="allegroPublikacjaUstawStrone(${allegroWystawianieStrona-1})" ${allegroWystawianieStrona===1?"disabled":""}>← Poprzednia</button><span>Strona <b>${allegroWystawianieStrona}</b> z <b>${pages}</b></span><button class="btn ghost" onclick="allegroPublikacjaUstawStrone(${allegroWystawianieStrona+1})" ${allegroWystawianieStrona===pages?"disabled":""}>Następna →</button></nav>`:""}</section>${allegroOstatniBladWystawienia?`<section class="allegro-permission-alert"><div><b>⚠️ Ostatnia operacja wymaga uwagi</b><p>${esc(allegroOstatniBladWystawienia.message||"Błąd Allegro")}</p></div><button class="btn ghost" onclick="allegroOstatniBladWystawienia=null;renderuj()">Zamknij</button></section>`:""}${allegroWynikOperacjiHTML()}${allegroZadaniaAgentaOfertHTML()}</div>`;
}
