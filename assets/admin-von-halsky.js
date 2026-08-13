/* GENERATED ADMIN VON HALSKY — loaded on demand */
function vonHalskyPrezentacjaProduktu(product={}){
  const custom=String(product.vonHalskyContentMode||"").toLowerCase()==="custom";
  const storeName=String(product.nazwa||product.name||"").trim(),storeShort=String(product.opisKrotki||product.krotkiOpis||product.shortDescription||"").trim(),storeLong=String(product.opis||product.dlugiOpis||product.description||"").trim();
  const clean=value=>String(value||"").replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|div|section|li|h[1-6])>/gi,"\n").replace(/<[^>]*>/g," ").replace(/\r/g,"").split("\n").map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean).join("\n\n");
  const name=String(custom?product.vonHalskyTitle||storeName:storeName).trim(),shortDescription=clean(custom?product.vonHalskyShortDescription||storeShort:storeShort),longDescription=clean(custom?product.vonHalskyDescription||storeLong:storeLong);
  const description=[shortDescription,longDescription].filter((value,index,list)=>value&&(index===0||value!==list[0])).join("\n\n");
  return {mode:custom?"custom":"store",source:custom?"Dopasowanie Von Halsky":"Oferta sklepowa",name,shortDescription,longDescription,description};
}
function vonHalskyOpisProduktu(product={}){
  return vonHalskyPrezentacjaProduktu(product).description;
}
function vonHalskyGtin(product={}){
  const digits=String(product.gtin||product.ean||product.EAN||"").replace(/\D/g,"");
  if(![8,12,13,14].includes(digits.length))return "";
  const sum=digits.slice(0,-1).split("").reverse().reduce((total,digit,index)=>total+Number(digit)*(index%2===0?3:1),0);
  return (10-sum%10)%10===Number(digits.at(-1))?digits:"";
}
function vonHalskyKodProducenta(product={}){
  return String(product.kodProducenta||product.mpn||product.externalId||product.sku||"").trim();
}
function vonHalskyGpsr(product={}){
  const value=product.vonHalskyResponsibleProducer&&typeof product.vonHalskyResponsibleProducer==="object"?product.vonHalskyResponsibleProducer:{};
  const name=String(value.legalName||value.name||"").trim(),address=String(value.address||"").trim(),email=String(value.email||"").trim(),phone=String(value.phone||"").trim();
  const required=product.vonHalskyDoesNotRequireGpsrInfo!==true,missing=required?[!name&&"nazwa",!address&&"adres",!email&&"e-mail"].filter(Boolean):[];
  return {required,ready:missing.length===0,name,address,email,phone,missing,source:String(value.source||"")};
}
function vonHalskyParametryKategorii(product={}){
  const definitions=Array.isArray(product.vonHalskyAttributeDefinitions)?product.vonHalskyAttributeDefinitions:[],values=product.vonHalskyAttributes&&typeof product.vonHalskyAttributes==="object"?product.vonHalskyAttributes:{};
  const missing=definitions.filter(definition=>{
    const expected=String(definition.expectedValue||"").toUpperCase(),required=definition.required===true||["ONE","ONE_OR_MANY"].includes(expected),multiple=definition.multiple===true||["NULL_OR_MANY","ONE_OR_MANY"].includes(expected);
    if(!required)return false;const raw=values[String(definition.id||definition.attributeId||"")],items=(Array.isArray(raw)?raw:[raw]).map(value=>String(value??"").trim()).filter(Boolean);
    return !items.length||(!multiple&&items.length!==1);
  }).map(definition=>String(definition.name||definition.label||definition.id||"parametr"));
  return {schemaKnown:Array.isArray(product.vonHalskyAttributeDefinitions),definitions,missing};
}
function vonHalskyStatusOferty(item={}){
  const status=String(item?.status||item?.offer?.status||"").toUpperCase(),errors=[...(item?.validationErrors||item?.metadata?.validationErrors||[]),...(item?.rejectionReasons||item?.metadata?.rejectionReasons||[])];
  return !["PUBLISHED","CLOSED","SOLDOUT","INACTIVE","REJECTED","ERROR"].includes(status)&&errors.length?"VERIFICATION_ERROR":status;
}
function vonHalskyZdalnaOfertaProduktu(product={}){
  // Po uzgodnieniu z API wartość false jest rozstrzygająca. Nie próbujemy
  // ponownie zgadywać oferty po historycznym EXTERNAL_ID, bo ten numer może
  // należeć także do produktu innego producenta.
  if(product.vonHalskyRemotePresent===false)return null;
  const externalId=String(product.externalId||product.sku||product.id||""),localOfferId=String(product.vonHalskyOfferId||product.inpostVonHalskyOfferId||"");
  if(product.vonHalskyRemotePresent===true&&localOfferId)return {id:localOfferId,offerId:localOfferId,externalId,status:String(product.vonHalskyRemoteStatus||"")};
  const priority={PUBLISHED:60,PENDING:50,PROCESSING:40,CLOSED:30,SOLDOUT:25,INACTIVE:20,REJECTED:10,VERIFICATION_ERROR:8,ERROR:5};
  return (Array.isArray(vonHalskyStan.offers)?vonHalskyStan.offers:[])
    .map(item=>item?.offer||item||{})
    .filter(item=>(localOfferId&&String(item.id||item.offerId||"")===localOfferId)||(externalId&&String(item.externalId||"")===externalId))
    .map(item=>({...item,status:vonHalskyStatusOferty(item)}))
    .sort((left,right)=>(priority[String(right.status||"").toUpperCase()]||0)-(priority[String(left.status||"").toUpperCase()]||0))[0]||null;
}
function vonHalskyOcenaProduktu(product={}){
  if(product&&typeof product==="object"&&vonHalskyOcenaRenderCache.has(product))return vonHalskyOcenaRenderCache.get(product);
  const presentation=vonHalskyPrezentacjaProduktu(product),nazwa=presentation.name,surowyOpis=presentation.description,opis=presentation.description,ean=vonHalskyGtin(product);
  const kod=vonHalskyKodProducenta(product),marka=String(product.marka||product.producent||"").trim(),zdjecia=[...(Array.isArray(product.zdjecia)?product.zdjecia:[]),...(Array.isArray(product.images)?product.images:[]),product.zdjecie,product.image].map(item=>String(typeof item==="object"?item?.url||"":item||"").trim()).filter(Boolean);
  const cena=[product.cenaVonHalsky,product.vonHalskyPrice,product.cenaAllegro,product.allegroPrice,product.cena,product.price].map(Number).find(value=>Number.isFinite(value)&&value>0)||0,braki=[],ostrzezenia=[];
  if(nazwa.length<7||nazwa.length>150)braki.push("Nazwa 7–150 znaków");
  if(opis.length<100)braki.push("Opis minimum 100 znaków");
  if(/https?:\/\/|www\.|<a\b/i.test(surowyOpis))braki.push("Usuń linki z opisu");
  if(new RegExp("<"+"img\\b","i").test(surowyOpis))braki.push("Usuń zdjęcia osadzone w opisie");
  if(!ean&&!(kod&&marka))braki.push("EAN albo kod producenta + marka");
  if(!zdjecia.length)braki.push("Zdjęcie");
  if(!Number.isFinite(cena)||cena<=0)braki.push("Cena");
  if(!String(product.vonHalskyCategoryId||"").trim())braki.push("Kategoria Von Halsky");
  if(product.vonHalskyCategoryTreeValid===false)braki.push("Kategoria nie występuje w aktualnym drzewie Von Halsky");
  const gpsr=vonHalskyGpsr(product);
  if(gpsr.required&&!gpsr.ready)braki.push(`GPSR: ${gpsr.missing.join(", ")}`);
  const attributes=vonHalskyParametryKategorii(product);
  if(!attributes.schemaKnown)braki.push("Pobierz aktualne parametry kategorii Von Halsky");
  if(attributes.missing.length)braki.push(`Parametry wymagane: ${attributes.missing.join(", ")}`);
  if(!String(product.externalId||product.sku||product.id||"").trim())ostrzezenia.push("Brak stabilnego EXTERNAL_ID");
  if(zdjecia.length===1)ostrzezenia.push("Warto dodać więcej zdjęć");
  if(!String(product.vonHalskySafetyInformation||"").trim()&&gpsr.required)ostrzezenia.push("Sprawdź informację bezpieczeństwa GPSR");
  const dostepny=typeof produktDostepnyWSprzedazy==="function"?produktDostepnyWSprzedazy(product):product.sprzedazAktywna!==false;
  if(!dostepny)braki.push("Sprzedaż wstrzymana");
  const remote=vonHalskyZdalnaOfertaProduktu(product),ofertaId=String(remote?.id||remote?.offerId||"");
  const remoteErrors=Array.isArray(product.vonHalskyRemoteErrors)?product.vonHalskyRemoteErrors:[];
  const result={gotowy:braki.length===0,wynik:Math.max(0,Math.round(100-braki.length*18-ostrzezenia.length*3)),braki,ostrzezenia,ean,kod,marka,opis,nazwa,cena:Number.isFinite(cena)?cena:0,dostepny,ofertaId,localOfferId:String(product.vonHalskyOfferId||""),offerStatus:String(remote?.status||product.vonHalskyRemoteStatus||""),providerStatus:String(product.vonHalskyProviderStatus||""),remoteErrors,offerVerified:Boolean(remote&&ofertaId),categoryId:String(product.vonHalskyCategoryId||""),categoryPath:String(product.vonHalskyCategoryPath||""),categoryResolution:product.vonHalskyCategoryResolution||null,gpsr,attributes,zdjecie:zdjecia[0]||"",presentation};
  if(product&&typeof product==="object")vonHalskyOcenaRenderCache.set(product,result);
  return result;
}
function vonHalskyProdukty(){
  if(vonHalskyProduktyRenderCache)return vonHalskyProduktyRenderCache;
  const deleted=new Set(produktyDefinitywne.map(String));
  vonHalskyProduktyRenderCache=produktyDoAdministracji().filter(product=>!czyProduktAdminWKoszu(product)&&!deleted.has(String(product.id)));
  return vonHalskyProduktyRenderCache;
}

const vonHalskyStan={
  loaded:false,loading:false,error:"",lastLoadAttemptAt:"",config:{configured:false,missingEnv:[]},
  settings:{integrationMethod:"api",integrator:"",channelAlias:"VH",merchantStoreName:"Artway-TM",notificationEmail:"",minimumStock:1,defaultStock:1,maximumStock:25,syncIntervalMinutes:15,automaticPriceSync:true,automaticStockSync:true,automaticResume:true,agentPreparationEnabled:true,agentCategoryAutoMatchEnabled:true,agentAttributeAutoMatchEnabled:true,agentMinimumConfidence:.82,newOfferPublicationMode:"manual_selection",catalogAutomationEnabled:false,customerZone:true,onboarding:{}},
  sync:{status:"not_connected",lastConnectionAt:null,lastCatalogAt:null,lastCatalogCount:0,lastOrdersAt:null,lastError:"",lastRequestId:""},
  diagnostics:[],offers:[],orders:[],returns:[],claims:[],events:[],commands:[],categories:[],preview:null,operation:"",
  truth:{total:0,published:0,pending:0,rejected:0,closed:0,statuses:{}},
  channelStatus:{source:"inpost-von-halsky-api",verifiedAt:null,truth:{total:0,published:0,pending:0,rejected:0,closed:0,statuses:{}},operations:{pendingCommands:0,recentCommands:0},consistent:false},
  dashboard:{loaded:false,loading:false,error:"",orders:{total:0,active:0,statuses:{},daily:[]},commands:{pending:0,total:0},rejectionReasons:[],recent:[],updatedAt:""},
  productQueue:{loaded:false,loading:false,error:"",items:[],total:0,summary:{},facets:{producers:[],categories:[]},nextCursor:null,previousCursor:null,cursor:"",queryKey:""},
  records:{view:"orders",query:"",status:"wszystkie",fulfillment:"wszystkie",period:"wszystkie",delivery:"wszystkie",sort:"najnowsze",limit:25,offset:0,facets:{},sourceHealth:{},loading:false,error:"",items:[],total:0,nextCursor:null,previousCursor:null,cursor:"",queryKey:""},
  preparationQueue:{running:false,active:null,pending:0,recent:[],current:[],currentSummary:{},batches:[],updatedAt:""},
  agentRuntime:{state:"ready",currentWork:null,publication:{counts:{},pending:[],recent:[]},updatedAt:""},
  preparationBatchId:"",
  preparation:{active:false,paused:false,pauseRequested:false,cancelRequested:false,total:0,completed:0,currentIndex:0,currentProductId:"",currentName:"",startedAt:"",finishedAt:"",results:[],error:""}
};
let vonHalskySzukaj="",vonHalskyEtap="wszystkie",vonHalskyFiltr="wszystkie",vonHalskyAgentFiltr="wszystkie",vonHalskyStatusKanalu="wszystkie",vonHalskyDostepnosc="wszystkie",vonHalskyProducent="wszyscy",vonHalskyKategoria="wszystkie",vonHalskyProblem="wszystkie",vonHalskyCena="wszystkie",vonHalskySort="jakosc",vonHalskyStrona=1,vonHalskyNaStronie=25;
const vonHalskyZaznaczone=new Set();
const vonHalskyAgentWToku=new Set();
let vonHalskyProduktyRenderCache=null,vonHalskyOcenaRenderCache=new WeakMap();
let vonHalskyWznowProces=null,vonHalskyLiveTimer=null,vonHalskyReconcilePromise=null,vonHalskyProcesSygnatura="",vonHalskyOstatniOdczytKanalu=0,vonHalskyOdswiezenieWToku=false,vonHalskyOstatniaRewizjaKanalu="";
let vonHalskyFiltrTimer=null,vonHalskyWyborWToku=false;
let vonHalskyUstawieniaSekcja="identity";
function vonHalskyMigawkaFiltrow(){
  return {
    search:vonHalskySzukaj,stage:vonHalskyEtap,quality:vonHalskyFiltr,agent:vonHalskyAgentFiltr,
    channel:vonHalskyStatusKanalu,availability:vonHalskyDostepnosc,producer:vonHalskyProducent,
    category:vonHalskyKategoria,problem:vonHalskyProblem,price:vonHalskyCena,sort:vonHalskySort,
    page:vonHalskyStrona,pageSize:vonHalskyNaStronie,
  };
}
function vonHalskyPrzywrocFiltry(snapshot={}){
  vonHalskySzukaj=snapshot.search??vonHalskySzukaj;vonHalskyEtap=snapshot.stage??vonHalskyEtap;
  vonHalskyFiltr=snapshot.quality??vonHalskyFiltr;vonHalskyAgentFiltr=snapshot.agent??vonHalskyAgentFiltr;
  vonHalskyStatusKanalu=snapshot.channel??vonHalskyStatusKanalu;vonHalskyDostepnosc=snapshot.availability??vonHalskyDostepnosc;
  vonHalskyProducent=snapshot.producer??vonHalskyProducent;vonHalskyKategoria=snapshot.category??vonHalskyKategoria;
  vonHalskyProblem=snapshot.problem??vonHalskyProblem;vonHalskyCena=snapshot.price??vonHalskyCena;
  vonHalskySort=snapshot.sort??vonHalskySort;vonHalskyStrona=Number(snapshot.page)||1;
  vonHalskyNaStronie=Number(snapshot.pageSize)||25;
}
function vonHalskyUniewaznijWidokProduktow(){
  vonHalskyProduktyRenderCache=null;vonHalskyOcenaRenderCache=new WeakMap();
}
function vonHalskyZastosujAktualizacjeProduktow(updates=[]){
  for(const update of Array.isArray(updates)?updates:[]){
    const productId=String(update?.productId||update?.id||"");
    const patch=update?.fields&&typeof update.fields==="object"?update.fields:update?.product&&typeof update.product==="object"?update.product:update;
    if(!productId||!patch||typeof patch!=="object")continue;
    podmienProduktAdminBezRenderu(productId,patch,Array.isArray(update?.remove)?update.remove:[]);
    const queueIndex=(vonHalskyStan.productQueue?.items||[]).findIndex(product=>String(product?.id)===productId);
    if(queueIndex>=0){
      const next={...vonHalskyStan.productQueue.items[queueIndex],...patch};
      for(const field of Array.isArray(update?.remove)?update.remove:[])delete next[field];
      vonHalskyStan.productQueue.items[queueIndex]=next;
    }
  }
  vonHalskyUniewaznijWidokProduktow();
}
async function vonHalskyLaduj(force=false,{render=true,processes=true}={}){
  if(vonHalskyStan.loading||(!force&&vonHalskyStan.loaded))return;
  vonHalskyStan.loading=true;vonHalskyStan.error="";vonHalskyStan.lastLoadAttemptAt=new Date().toISOString();
  try{
    const [data]=await Promise.all([
      chmura("von-halsky-overview",{timeout:20000}),
      processes?vonHalskyPobierzStanProcesow().catch(error=>{console.warn("von_halsky_process_status",error);return null;}):Promise.resolve(null),
    ]);
    Object.assign(vonHalskyStan,{loaded:true,config:data.config||{},settings:{...vonHalskyStan.settings,...(data.settings||{})},sync:data.sync||vonHalskyStan.sync,diagnostics:Array.isArray(data.diagnostics)?data.diagnostics:[],offers:Array.isArray(data.offers)?data.offers:[],orders:Array.isArray(data.orders)?data.orders:[],returns:Array.isArray(data.returns)?data.returns:[],claims:Array.isArray(data.claims)?data.claims:[],events:Array.isArray(data.events)?data.events:[],commands:Array.isArray(data.commands)?data.commands:[],truth:data.truth||vonHalskyStan.truth,channelStatus:data.channelStatus||vonHalskyStan.channelStatus,updatedAt:data.updatedAt||null});
    vonHalskyProcesSygnatura=vonHalskySygnaturaProcesu();
    vonHalskyOstatniaRewizjaKanalu=String(data.sync?.reconciliationRevision||data.sync?.lastCatalogVerifiedAt||data.updatedAt||"");
  }catch(error){
    // Nie uruchamiamy automatycznie kolejnego żądania przy każdym renderze.
    // Gdy API jest chwilowo niedostępne, zachowujemy ostatni stan widoku,
    // pokazujemy błąd i czekamy na świadome użycie „Odśwież status”.
    vonHalskyStan.loaded=true;
    vonHalskyStan.error=String(error?.message||error);
  }
  vonHalskyStan.loading=false;
  if(render&&String(trasa()).startsWith("/admin/von-halsky/wystawianie")&&document.querySelector(".von-halsky-listing-workspace"))vonHalskyAktualizujWystawianieDOM();
  else if(render&&String(trasa()).startsWith("/admin/von-halsky/ustawienia")&&typeof vonHalskyAktualizujUstawieniaDOM==="function")vonHalskyAktualizujUstawieniaDOM();
  else if(render&&String(trasa())==="/admin/von-halsky"&&typeof vonHalskyAktualizujPulpitDOM==="function")vonHalskyAktualizujPulpitDOM({dashboard:false});
  else if(render&&String(trasa()).startsWith("/admin/von-halsky"))renderuj();
}
async function vonHalskyUzgodnijKatalog({silent=false,repeat=false,render=true}={}){
  if(vonHalskyReconcilePromise)return vonHalskyReconcilePromise;
  vonHalskyReconcilePromise=(async()=>{
    try{
      let data=null;
      for(let attempt=0;attempt<(repeat?2:1);attempt+=1){
        if(attempt)await new Promise(resolve=>setTimeout(resolve,20000));
        data=await chmura("von-halsky-reconcile-catalog",{method:"POST",body:{},timeout:120000});
        if(Array.isArray(data.offers))vonHalskyStan.offers=data.offers;
        if(data.truth)vonHalskyStan.truth=data.truth;
        if(data.sync)vonHalskyStan.sync={...vonHalskyStan.sync,...data.sync};
        vonHalskyStan.channelStatus={
          ...vonHalskyStan.channelStatus,
          verifiedAt:data.sync?.lastCatalogVerifiedAt||data.sync?.lastCatalogAt||vonHalskyStan.channelStatus?.verifiedAt||null,
          truth:data.truth||vonHalskyStan.truth,
          operations:{
            ...vonHalskyStan.channelStatus?.operations,
            pendingCommands:Number(data.sync?.pendingCommandCount??vonHalskyStan.channelStatus?.operations?.pendingCommands??0),
          },
          consistent:true,
        };
        vonHalskyZastosujAktualizacjeProduktow(data.productUpdates||[]);
        if(!repeat||Number(data.sync?.pendingCommandCount||0)<=0)break;
      }
      if(!silent)toast(`API potwierdza: ${data.truth?.published||0} w sprzedaży • ${data.truth?.pending||0} w publikacji • ${(data.reconciliation?.staleCleared||0)+(data.reconciliation?.duplicateMappings||0)} błędnych powiązań usunięto ✅`);
      return data;
    }catch(error){
      if(!silent)toast("Nie uzgodniono katalogu z API: "+(error.message||error));
      throw error;
    }finally{
      vonHalskyReconcilePromise=null;
      if(render&&String(trasa()).startsWith("/admin/von-halsky/wystawianie"))vonHalskyAktualizujWystawianieDOM();
      else if(render&&String(trasa()).startsWith("/admin/von-halsky"))renderuj();
    }
  })();
  return vonHalskyReconcilePromise;
}
async function vonHalskyOdswiezPelnyStatus(){
  if(vonHalskyStan.operation)return;
  const snapshot=vonHalskyMigawkaFiltrow();
  vonHalskyStan.operation="reconcile";
  vonHalskyAktualizujWystawianieDOM();
  try{
    await vonHalskyUzgodnijKatalog({silent:false,render:false});
    await vonHalskyLaduj(true,{render:false});
  }finally{
    vonHalskyStan.operation="";
    vonHalskyPrzywrocFiltry(snapshot);
    vonHalskyAktualizujWystawianieDOM();
  }
}

function vonHalskyEtapOferty(product={},quality=vonHalskyOcenaProduktu(product)){
  const status=String(quality.offerStatus||"").toUpperCase();
  if(status==="PUBLISHED")return "sprzedaz";
  if(status==="SOLDOUT")return "wyprzedane";
  if(!quality.dostepny||["CLOSED","INACTIVE"].includes(status))return "wstrzymane";
  if(["PENDING","PROCESSING","VERIFYING"].includes(status)||(!quality.offerVerified&&["queued","publishing"].includes(String(product.vonHalskyEditorialSyncState||"").toLowerCase())))return "publikowanie";
  if(["REJECTED","ERROR","VERIFICATION_ERROR"].includes(status))return "aktualizacja";
  if(status==="PUBLISHED"&&(!quality.gotowy||product.vonHalskyEditorialSyncPending===true))return "aktualizacja";
  if(quality.gotowy)return "wystawienie";
  return "przygotowanie";
}
function vonHalskyAgentStan(product={}){
  if(vonHalskyAgentWToku.has(String(product.id)))return {id:"w-toku",label:"Agent pracuje",cls:"running"};
  const raw=String(product.vonHalskyAgentStatus||product.contentEditorial?.channelStates?.vonHalsky?.status||"").toLowerCase();
  if(["ready","confirmed"].includes(raw))return {id:"gotowe",label:"Agent: gotowe",cls:"ready"};
  if(["retry","retry_pending"].includes(raw))return {id:"ponowienie",label:"Agent: ponowienie",cls:"retry"};
  if(["error","failed"].includes(raw))return {id:"blad",label:"Agent: błąd",cls:"error"};
  if(["requires_data","review","decision_required"].includes(raw))return {id:"wymaga-danych",label:"Agent: wymaga danych",cls:"attention"};
  return {id:"oczekuje",label:"Agent: oczekuje",cls:"waiting"};
}
function vonHalskyProblemProduktu(quality={},problem="wszystkie"){
  if(problem==="wszystkie")return true;
  const issues=normalizujSzukanyTekst((quality.braki||[]).join(" "));
  if(problem==="identyfikacja")return !quality.ean&&!(quality.kod&&quality.marka);
  if(problem==="zdjecie")return issues.includes("zdjec");
  if(problem==="opis")return issues.includes("opis")||issues.includes("nazwa");
  if(problem==="kategoria")return !quality.categoryId;
  if(problem==="gpsr")return quality.gpsr.required&&!quality.gpsr.ready;
  if(problem==="cena")return !quality.cena;
  return true;
}
function vonHalskyOpcjeFiltrow(){
  if(vonHalskyStan.productQueue.loaded){
    const facets=vonHalskyStan.productQueue.facets||{};
    return {
      producers:(facets.producers||[]).map(item=>({id:String(item.value||""),label:String(item.value||""),count:Number(item.count)||0})),
      categories:(facets.categories||[]).map(item=>({id:String(item.value||""),label:String(item.value||""),count:Number(item.count)||0})),
    };
  }
  const producers=new Map(),categories=new Map();
  for(const product of vonHalskyProdukty()){
    const producer=String(product.producent||product.marka||"").trim(),category=String(product.kategoria||"").trim();
    if(producer){const id=normalizujSzukanyTekst(producer);producers.set(id,{id,label:producer,count:(producers.get(id)?.count||0)+1});}
    if(category){const id=normalizujSzukanyTekst(category);categories.set(id,{id,label:category,count:(categories.get(id)?.count||0)+1});}
  }
  const sorter=(left,right)=>left.label.localeCompare(right.label,"pl");
  return {producers:[...producers.values()].sort(sorter),categories:[...categories.values()].sort(sorter)};
}
function vonHalskyLiczbaAktywnychFiltrow(){
  return [
    !!vonHalskySzukaj,
    vonHalskyEtap!=="wszystkie",
    vonHalskyFiltr!=="wszystkie",
    vonHalskyAgentFiltr!=="wszystkie",
    vonHalskyStatusKanalu!=="wszystkie",
    vonHalskyDostepnosc!=="wszystkie",
    vonHalskyProducent!=="wszyscy",
    vonHalskyKategoria!=="wszystkie",
    vonHalskyProblem!=="wszystkie",
    vonHalskyCena!=="wszystkie",
    vonHalskySort!=="jakosc",
  ].filter(Boolean).length;
}
function vonHalskyResetujFiltry(){
  vonHalskySzukaj="";vonHalskyEtap="wszystkie";vonHalskyFiltr="wszystkie";vonHalskyAgentFiltr="wszystkie";
  vonHalskyStatusKanalu="wszystkie";vonHalskyDostepnosc="wszystkie";vonHalskyProducent="wszyscy";
  vonHalskyKategoria="wszystkie";vonHalskyProblem="wszystkie";vonHalskyCena="wszystkie";
  vonHalskySort="jakosc";vonHalskyStrona=1;vonHalskyStan.productQueue.cursor="";void vonHalskyPobierzKolejkeProduktow({force:true});
}
function vonHalskyKluczZapytaniaProduktow(){
  return JSON.stringify(vonHalskyMigawkaFiltrow());
}
function vonHalskyParametryKolejki(extra={}){
  return {
    q:vonHalskySzukaj,stage:vonHalskyEtap,quality:vonHalskyFiltr,agent:vonHalskyAgentFiltr,
    channel:vonHalskyStatusKanalu,availability:vonHalskyDostepnosc,producer:vonHalskyProducent,
    category:vonHalskyKategoria,problem:vonHalskyProblem,price:vonHalskyCena,sort:vonHalskySort,
    page:vonHalskyStrona,limit:vonHalskyNaStronie,cursor:vonHalskyStan.productQueue.cursor,
    ...extra,
  };
}
async function vonHalskyPobierzKolejkeProduktow({force=false,cursor=null}={}){
  const queue=vonHalskyStan.productQueue,key=vonHalskyKluczZapytaniaProduktow();
  if(queue.loading){if(force||queue.queryKey!==key)queue.pendingReload=true;return;}
  if(!force&&queue.loaded&&queue.queryKey===key&&cursor===null)return;
  queue.pendingReload=false;
  queue.loading=true;queue.error="";
  if(cursor!==null)queue.cursor=String(cursor||"");
  if(String(trasa()).startsWith("/admin/von-halsky/wystawianie"))vonHalskyAktualizujWystawianieDOM({stages:false,truth:false});
  try{
    const data=await chmura("von-halsky-product-queue",{params:vonHalskyParametryKolejki({cursor:queue.cursor}),timeout:30000});
    Object.assign(queue,{loaded:true,items:Array.isArray(data.items)?data.items:[],total:Number(data.total)||0,
      summary:data.summary||{},facets:data.facets||{producers:[],categories:[]},nextCursor:data.nextCursor||null,
      previousCursor:data.previousCursor||null,queryKey:key,error:""});
    vonHalskyProduktyRenderCache=queue.items;vonHalskyOcenaRenderCache=new WeakMap();
  }catch(error){queue.error=String(error?.message||error);}
  queue.loading=false;
  if(queue.pendingReload||key!==vonHalskyKluczZapytaniaProduktow()){
    queue.pendingReload=false;queue.cursor="";queue.queryKey="";
    void vonHalskyPobierzKolejkeProduktow({force:true,cursor:""});return;
  }
  if(String(trasa()).startsWith("/admin/von-halsky/wystawianie"))vonHalskyAktualizujWystawianieDOM();
}
function vonHalskyPrzejdzKolejke(kierunek=1){
  const queue=vonHalskyStan.productQueue,cursor=kierunek>0?queue.nextCursor:queue.previousCursor;
  if(!cursor)return;
  vonHalskyStrona=Math.max(1,vonHalskyStrona+(kierunek>0?1:-1));
  void vonHalskyPobierzKolejkeProduktow({force:true,cursor});
}
function vonHalskyOdswiezFiltrowanyWidok({filters=false}={}){
  if(filters)vonHalskyPodmienWyspe('[data-admin-search-panel="von-halsky-products"]',vonHalskyFiltryHTML(vonHalskyWiersze()));
  vonHalskyPodmienWyspe("[data-vh-stage-filters]",vonHalskyEtapySprzedazyHTML());
  vonHalskyPodmienWyspe("[data-vh-results-region]",vonHalskyWynikiHTML());
}
function vonHalskyZmienFiltr(){
  vonHalskyStrona=1;vonHalskyStan.productQueue.cursor="";
  void vonHalskyPobierzKolejkeProduktow({force:true});
}
function vonHalskySzukajPoWpisaniu(value){
  vonHalskySzukaj=String(value||"");vonHalskyStrona=1;
  clearTimeout(vonHalskyFiltrTimer);
  vonHalskyFiltrTimer=setTimeout(()=>{vonHalskyStan.productQueue.cursor="";void vonHalskyPobierzKolejkeProduktow({force:true});},350);
}
function vonHalskyWiersze(){
  if(vonHalskyStan.productQueue.loaded){
    return (vonHalskyStan.productQueue.items||[]).map(product=>({product,quality:vonHalskyOcenaProduktu(product)}));
  }
  const q=normalizujSzukanyTekst(vonHalskySzukaj),terms=q.split(" ").filter(Boolean);
  const rows=vonHalskyProdukty().map(product=>({product,quality:vonHalskyOcenaProduktu(product)})).filter(({product,quality})=>{
    const searchable=normalizujSzukanyTekst([product.nazwa,product.externalId,product.sku,product.id,quality.ean,quality.kod,quality.marka,product.producent,product.kategoria,quality.categoryPath,quality.ofertaId,quality.offerStatus,quality.gpsr?.name].join(" "));
    if(terms.some(term=>!searchable.includes(term)))return false;
    if(vonHalskyFiltr==="gotowe"&&!quality.gotowy)return false;
    if(vonHalskyFiltr==="braki"&&quality.gotowy)return false;
    if(vonHalskyFiltr==="ean"&&!quality.ean)return false;
    if(vonHalskyFiltr==="bez-ean"&&quality.ean)return false;
    if(vonHalskyFiltr==="kategoria"&&!quality.categoryId)return false;
    if(vonHalskyFiltr==="bez-kategorii"&&quality.categoryId)return false;
    if(vonHalskyFiltr==="gpsr"&&!quality.gpsr.ready)return false;
    if(vonHalskyFiltr==="bez-gpsr"&&quality.gpsr.ready)return false;
    const remoteStatus=String(quality.offerStatus||"").toUpperCase();
    if(vonHalskyStatusKanalu==="aktywne"&&remoteStatus!=="PUBLISHED")return false;
    if(vonHalskyStatusKanalu==="weryfikacja"&&!["PENDING","PROCESSING","VERIFYING"].includes(remoteStatus))return false;
    if(vonHalskyStatusKanalu==="blad-weryfikacji"&&remoteStatus!=="VERIFICATION_ERROR")return false;
    if(vonHalskyStatusKanalu==="odrzucone"&&!["REJECTED","ERROR"].includes(remoteStatus))return false;
    if(vonHalskyStatusKanalu==="niewystawione"&&quality.offerVerified)return false;
    if(vonHalskyDostepnosc==="dostepne"&&!quality.dostepny)return false;
    if(vonHalskyDostepnosc==="wstrzymane"&&quality.dostepny)return false;
    if(vonHalskyProducent!=="wszyscy"&&normalizujSzukanyTekst(product.producent||product.marka)!==vonHalskyProducent)return false;
    if(vonHalskyKategoria!=="wszystkie"&&normalizujSzukanyTekst(product.kategoria)!==vonHalskyKategoria)return false;
    if(vonHalskyCena==="z-cena"&&!quality.cena)return false;
    if(vonHalskyCena==="bez-ceny"&&quality.cena)return false;
    if(!vonHalskyProblemProduktu(quality,vonHalskyProblem))return false;
    if(vonHalskyEtap==="sprzedaz"&&String(quality.offerStatus||"").toUpperCase()!=="PUBLISHED")return false;
    if(vonHalskyEtap!=="wszystkie"&&vonHalskyEtap!=="sprzedaz"&&vonHalskyEtapOferty(product,quality)!==vonHalskyEtap)return false;
    if(vonHalskyAgentFiltr!=="wszystkie"&&vonHalskyAgentStan(product).id!==vonHalskyAgentFiltr)return false;
    return true;
  });
  rows.sort((left,right)=>{
    if(vonHalskySort==="nazwa")return left.quality.nazwa.localeCompare(right.quality.nazwa,"pl");
    if(vonHalskySort==="ean")return String(left.quality.ean||"~").localeCompare(String(right.quality.ean||"~"));
    if(vonHalskySort==="cena")return right.quality.cena-left.quality.cena;
    return left.quality.wynik-right.quality.wynik||left.quality.nazwa.localeCompare(right.quality.nazwa,"pl");
  });
  return rows;
}
async function vonHalskyIdsFiltrowanychWynikow(){
  if(!vonHalskyStan.productQueue.loaded)return vonHalskyWiersze().map(({product})=>String(product.id));
  const data=await chmura("von-halsky-product-queue",{params:vonHalskyParametryKolejki({selection:"ids",page:1,limit:1,cursor:""}),timeout:30000});
  const ids=Array.isArray(data.selectedIds)?data.selectedIds.map(String).filter(Boolean):[];
  if(ids.length!==Number(data.total||0))throw new Error("Serwer nie zwrócił pełnego zakresu zaznaczenia.");
  return ids;
}
async function vonHalskyUstawZaznaczenieZakres(zakres="strona",checked=true){
  if(vonHalskyWyborWToku)return;
  const rows=vonHalskyWiersze(),start=vonHalskyStan.productQueue.loaded?0:(vonHalskyStrona-1)*vonHalskyNaStronie;
  if(zakres==="strona"){
    const ids=rows.slice(start,start+vonHalskyNaStronie).map(({product})=>String(product.id));
    vonHalskyUstawZaznaczenie(ids,checked);
    return;
  }
  vonHalskyWyborWToku=true;vonHalskyAktualizujWystawianieDOM({stages:false,truth:false});
  try{
    const ids=await vonHalskyIdsFiltrowanychWynikow();
    for(const id of ids)checked?vonHalskyZaznaczone.add(id):vonHalskyZaznaczone.delete(id);
    toast(`${checked?"Zaznaczono":"Odznaczono"} ${ids.length} wyników bieżącego filtrowania ✅`);
  }catch(error){
    toast("Nie zmieniono pełnego zaznaczenia: "+(error?.message||error));
  }finally{
    vonHalskyWyborWToku=false;vonHalskyAktualizujWystawianieDOM({stages:false,truth:false});
  }
}
function vonHalskyWyczyscZaznaczenie(){
  vonHalskyZaznaczone.clear();
  requestAnimationFrame(()=>vonHalskyAktualizujWystawianieDOM({stages:false,truth:false}));
}
function vonHalskySubnavHTML(aktywny="pulpit"){
  const stats=vonHalskyStatystyki();
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/von-halsky",label:"📊 Pulpit"},
    {id:"zamowienia",href:"#/admin/von-halsky/zamowienia",label:"📦 Zamówienia"},
    {id:"wystawianie",href:"#/admin/von-halsky/wystawianie",label:"🏷️ Wystawianie",badge:stats.doDzialania||""},
    {id:"ustawienia",href:"#/admin/von-halsky/ustawienia",label:"⚙️ Ustawienia"}
  ],aktywny);
}
function vonHalskyNaglowekHTML(aktywny="pulpit"){
  const stats=vonHalskyStatystyki(),cfg={
    pulpit:["🐕","Centrum operacyjne","InPost Von Halsky","Aktualny stan sprzedaży, kolejka pracy i najważniejsze działania kanału.",[["Aktywne oferty",stats.aktywne],["Do działania",stats.braki],["Nowe zamówienia",stats.noweZamowienia]]],
    wystawianie:["🏷️","Kompletny proces ofertowy","Wystawianie Von Halsky","Dopasowanie produktu, kontrola danych, podgląd i publikacja są teraz jednym spójnym procesem.",[["Wszystkie",stats.wszystkie],["Gotowe",stats.gotowe],["Aktywne",stats.aktywne]]],
    zamowienia:["📦","Obsługa sprzedaży","Zamówienia InPost+","Każde zamówienie ma pełne szczegóły, nadanie InPost, tracking i etykiety A6/A4. Centrum wysyłek pozostaje widokiem zbiorczym.",[["Połączenie",vonHalskyPolaczenieEtykieta()],["Ostatni odczyt",allegroDataTxt(vonHalskyStan.sync?.lastOrdersAt)],["Kanał","InPost+"]]],
    ustawienia:["⚙️","Konfiguracja kanału","Zaawansowane ustawienia Von Halsky","Integracja, synchronizacja, polityka danych, onboarding i diagnostyka są zarządzane wyłącznie tutaj.",[["Metoda","Bezpośrednie API"],["Interwał",`${vonHalskyStan.settings.syncIntervalMinutes||15} min`],["Dane API",vonHalskyStan.config.configured?"gotowe":"oczekują"]]]
  }[aktywny]||[];
  return `<section class="panel von-halsky-workspace-head admin-unified-hero ${aktywny==="zamowienia"?"channel-orders-header channel-orders-header-von":""}" data-vh-channel-header><div class="von-halsky-workspace-title"><span>${cfg[0]}</span><div><small>${esc(cfg[1])}</small><h1>${esc(cfg[2])}</h1><p>${esc(cfg[3])}</p></div></div><div class="von-halsky-workspace-metrics">${(cfg[4]||[]).map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div></section>`;
}
function vonHalskyPolaczenieEtykieta(){
  if(vonHalskyStan.sync?.status==="connected")return "połączone";
  if(vonHalskyStan.config.configured)return "gotowe do testu";
  if(vonHalskyStan.config.credentialsConfigured)return "brak kontraktu";
  return "do konfiguracji";
}
function vonHalskyEtapy(){
  const onboarding=vonHalskyStan.settings.onboarding||{};
  return [
    ["merchantAccount","Konto w Portalu Merchanta","Dane firmy i rachunek bankowy"],
    ["merchantProfile","Konfiguracja sklepu","Nazwa, kontakt, wysyłka i zwroty"],
    ["paymentKyc","Bramka płatnicza i KYC","Pozytywna weryfikacja płatności"],
    ["technicalDocs","Dokumentacja techniczna","Dokumentacja API albo instrukcja integratora"],
    ["catalogConnection","Połączenie katalogu","Autoryzacja i pierwszy odczyt kanału"]
  ].map(([id,title,desc])=>({id,title,desc,done:onboarding[id]===true}));
}
function vonHalskyPulpitHTML(){
  const stats=vonHalskyStatystyki(),lastCatalog=vonHalskyStan.sync?.lastCatalogAt,lastOrders=vonHalskyStan.sync?.lastOrdersAt;
  return `<div class="von-halsky-dashboard">
    <section class="von-halsky-stat-grid">${[["🏷️",stats.aktywne,"aktywnych lub połączonych ofert","sprzedaz"],["✅",stats.gotowe,"gotowych do wystawienia","wystawienie"],["⚠️",stats.braki,"produktów wymaga działania","przygotowanie"],["📦",stats.noweZamowienia,"nowych zamówień do obsługi",""]].map(([icon,count,label,stage],index)=>`<a href="${index===3?"#/admin/von-halsky/zamowienia":"#/admin/von-halsky/wystawianie"}" ${stage?`onclick="vonHalskyEtap=${jsArg(stage)}"`:""}><span>${icon}</span><b>${count}</b><small>${label}</small></a>`).join("")}</section>
    <section class="von-halsky-operations-grid"><article class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kolejka pracy</span><h2>Najbliższe działania</h2></div><a class="btn" href="#/admin/von-halsky/wystawianie">Otwórz wystawianie</a></div><div class="von-halsky-operation-list"><a href="#/admin/von-halsky/wystawianie" onclick="vonHalskyEtap='przygotowanie'"><span>01</span><div><b>Popraw dane i dopasowania</b><small>${stats.braki} produktów nie przechodzi pełnej kontroli.</small></div><em>${stats.braki}</em></a><a href="#/admin/von-halsky/wystawianie" onclick="vonHalskyEtap='wystawienie'"><span>02</span><div><b>Zdecyduj o nowych ofertach</b><small>Gotowe pozycje oczekują na ręczny wybór administratora.</small></div><em>${Math.max(0,stats.gotowe-stats.aktywne)}</em></a><a href="#/admin/von-halsky/zamowienia"><span>03</span><div><b>Obsłuż nowe zamówienia</b><small>Do kolejki trafiają całe zlecenia sprzedaży.</small></div><em>${stats.noweZamowienia}</em></a></div></article>
    <article class="panel von-halsky-channel-activity"><div class="order-section-head"><div><span class="order-pro-label">Aktywność kanału</span><h2>Ostatnie zdarzenia</h2></div><button class="btn ghost" type="button" onclick="vonHalskyLaduj(true)">↻ Odśwież</button></div><dl><div><dt>Katalog ofert</dt><dd>${esc(lastCatalog?allegroDataTxt(lastCatalog):"brak synchronizacji")}</dd></div><div><dt>Zamówienia</dt><dd>${esc(lastOrders?allegroDataTxt(lastOrders):"brak synchronizacji")}</dd></div><div><dt>Ostatnia operacja</dt><dd>${esc(vonHalskyStan.diagnostics?.[0]?.message||"Brak zarejestrowanych operacji")}</dd></div><div><dt>Stan operacyjny</dt><dd><span class="lvl ${vonHalskyStan.sync?.status==="connected"?"lvl-ok":"lvl-ostrzezenie"}">${esc(vonHalskyPolaczenieEtykieta())}</span></dd></div></dl><small>Konfiguracja techniczna, onboarding i pełna diagnostyka znajdują się w Ustawieniach.</small></article></section>
  </div>`;
}
function vonHalskyUstawZaznaczenie(ids=[],checked=true){
  for(const id of ids)checked?vonHalskyZaznaczone.add(String(id)):vonHalskyZaznaczone.delete(String(id));
  requestAnimationFrame(()=>vonHalskyAktualizujWystawianieDOM({stages:false,truth:false}));
}
function vonHalskyAktualizujCheckboxStrony(){
  const checkbox=document.querySelector("[data-vh-page-checkbox]");if(!checkbox)return false;
  const selected=Number(checkbox.dataset.selected)||0,total=Number(checkbox.dataset.total)||0;
  checkbox.checked=total>0&&selected===total;
  checkbox.indeterminate=selected>0&&selected<total;
  checkbox.setAttribute("aria-checked",checkbox.indeterminate?"mixed":checkbox.checked?"true":"false");
  return true;
}
async function vonHalskyProduktyPoIds(ids=[]){
  const products=[];
  for(let index=0;index<ids.length;index+=250){
    const part=ids.slice(index,index+250),data=await chmura("product-catalog-query",{params:{audience:"admin",ids:part.join(","),page:1,limit:part.length},timeout:30000});
    products.push(...(Array.isArray(data.items)?data.items:[]));
  }
  return products;
}
async function vonHalskyEksportuj(scope="selected"){
  try{
    const ids=scope==="selected"?[...vonHalskyZaznaczone]:await vonHalskyIdsFiltrowanychWynikow();
    if(!ids.length){toast("Brak produktów do eksportu.");return;}
    const products=await vonHalskyProduktyPoIds(ids),rows=products.map(product=>({product,quality:vonHalskyOcenaProduktu(product)}));
    adminEksportujCSV(`von-halsky-katalog-${new Date().toISOString().slice(0,10)}.csv`,
      ["EXTERNAL_ID","EAN","Kod producenta","Marka","Nazwa","Opis","Cena PLN","Stan maksymalny","Gotowość","Braki"],
      rows.map(({product,quality})=>[product.externalId||product.sku||product.id,quality.ean,quality.kod,quality.marka,quality.nazwa,quality.opis,quality.cena,vonHalskyStan.settings.maximumStock,quality.gotowy?"gotowy":"wymaga poprawy",[...quality.braki,...quality.ostrzezenia].join(" | ")]));
  }catch(error){toast("Nie wyeksportowano pełnego zakresu: "+(error?.message||error));}
}
function vonHalskyZamknijPodglad(){
  document.getElementById("vonHalskyProductPreview")?.remove();
}
function vonHalskyZamknijKategorie(){
  document.getElementById("vonHalskyCategoryPicker")?.remove();
}
function vonHalskyZamknijDopasowanie(){
  document.getElementById("vonHalskyMatchingEditor")?.remove();
}
function vonHalskyZnajdzProdukt(productId){
  const id=String(productId);
  return pobierzProduktAdmin(productId)
    ||(vonHalskyStan.productQueue?.items||[]).find(item=>String(item?.id)===id)
    ||vonHalskyProdukty().find(item=>String(item?.id)===id)
    ||null;
}
function vonHalskyMetodaDopasowania(product={},quality=vonHalskyOcenaProduktu(product)){
  if(quality.ean)return {level:"certain",label:"EAN/GTIN",description:"Jednoznaczny identyfikator produktu"};
  if(quality.kod&&quality.marka)return {level:"review",label:"Kod + marka",description:"Dopasowanie zastępcze do kontroli"};
  return {level:"missing",label:"Brak dopasowania",description:"Uzupełnij EAN albo kod producenta i markę"};
}
function vonHalskyOtworzDopasowanie(productId){
  const product=vonHalskyZnajdzProdukt(productId);if(!product)return;
  const quality=vonHalskyOcenaProduktu(product),match=vonHalskyMetodaDopasowania(product,quality);
  vonHalskyZamknijDopasowanie();
  const shell=document.createElement("div");shell.id="vonHalskyMatchingEditor";shell.className="von-halsky-product-preview-shell";
  shell.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="vonHalskyMatchingTitle" class="von-halsky-matching-editor"><header><div><span>Identyfikacja i powiązanie</span><h2 id="vonHalskyMatchingTitle">Popraw dopasowanie produktu</h2><small>${esc(quality.nazwa||product.nazwa||"Produkt")}</small></div><button class="btn ghost" type="button" data-close>✕ Zamknij</button></header><form onsubmit="vonHalskyZapiszDopasowanie(event,${jsArg(String(product.id))})"><div class="von-halsky-matching-summary"><article class="${match.level}"><small>Aktualna metoda</small><b>${esc(match.label)}</b><span>${esc(match.description)}</span></article><article><small>EXTERNAL_ID</small><b>${esc(product.externalId||product.sku||product.id||"—")}</b><span>Stały identyfikator kartoteki Artway-TM</span></article><article><small>Oferta Von Halsky</small><b>${esc(quality.ofertaId||"jeszcze niepołączona")}</b><span>${quality.ofertaId?"Powiązanie potwierdzone przez API":"ID zostanie zapisane po potwierdzeniu publikacji"}</span></article></div><div class="von-halsky-matching-fields"><label>EAN / GTIN<input name="ean" inputmode="numeric" maxlength="14" value="${esc(quality.ean||product.ean||product.gtin||"")}" placeholder="8, 12, 13 albo 14 cyfr"><small>Najpewniejsza metoda. System sprawdzi długość, cyfrę kontrolną i duplikaty.</small></label><label>Kod producenta<input name="producerCode" maxlength="160" value="${esc(quality.kod||"")}" placeholder="Kod lub numer referencyjny"><small>Używany razem z marką, jeżeli produkt nie ma EAN.</small></label><label>Producent<input name="producer" maxlength="160" value="${esc(product.producent||"")}" placeholder="np. Alexander"><small>Faktyczny producent lub wydawca.</small></label><label>Marka<input name="brand" maxlength="160" value="${esc(product.marka||product.producent||"")}" placeholder="np. MilliWOOD"><small>Marka handlowa może być inna niż producent.</small></label></div><section class="von-halsky-category-link"><div><small>Kategoria końcowa API</small><b>${esc(quality.categoryPath||quality.categoryId||"nieprzypisana")}</b><span>Kategoria jest częścią tego samego procesu wystawiania, ale wybierana z aktualnego drzewa InPost.</span></div><button class="btn ghost" type="button" onclick="vonHalskyZamknijDopasowanie();vonHalskyWybierzKategorie(${jsArg(String(product.id))})">${quality.categoryId?"Zmień kategorię":"Przypisz kategorię"}</button></section><section class="von-halsky-category-link"><div><small>Producent odpowiedzialny GPSR</small><b>${esc(quality.gpsr.name||"wymaga uzupełnienia")}</b><span>${quality.gpsr.ready?`${esc(quality.gpsr.address)} • ${esc(quality.gpsr.email)} • ${esc(quality.gpsr.phone)}`:`Brakuje: ${esc(quality.gpsr.missing.join(", "))}`}</span></div><span class="lvl ${quality.gpsr.ready?"lvl-ok":"lvl-ostrzezenie"}">${quality.gpsr.ready?"potwierdzone":"braki"}</span></section><div class="von-halsky-matching-validation"><b>Bezpieczne dopasowanie</b><span>Nie można ręcznie wkleić obcego ID oferty. Powiązanie kanału zapisuje się dopiero z potwierdzenia API dla tej kartoteki.</span></div><footer><button class="btn ghost" type="button" data-close>Anuluj</button><button class="btn" type="submit">Zapisz i przelicz gotowość</button></footer></form></section>`;
  shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))vonHalskyZamknijDopasowanie();});
  document.body.appendChild(shell);shell.querySelector("[name='ean']")?.focus();
}
async function vonHalskyZapiszDopasowanie(event,productId){
  event.preventDefault();const form=event.currentTarget,button=event.submitter,fd=new FormData(form);button.disabled=true;
  try{
    const data=await chmura("von-halsky-product-matching",{method:"POST",body:{productId,ean:fd.get("ean"),producerCode:fd.get("producerCode"),producer:fd.get("producer"),brand:fd.get("brand")},timeout:30000});
    toast(`Dopasowanie zapisane • ${data.matching?.label||"przeliczono"} ✅`);vonHalskyZamknijDopasowanie();
    if(typeof odswiezProduktyAdmin==="function")await odswiezProduktyAdmin();
    await vonHalskyLaduj(true);
  }catch(error){toast("Nie zapisano dopasowania: "+(error.message||error));button.disabled=false;}
}
async function vonHalskyPobierzKategorie(force=false){
  if(vonHalskyStan.categories.length&&!force)return vonHalskyStan.categories;
  const data=await chmura("von-halsky-categories",{method:"POST",body:{},timeout:60000});
  vonHalskyStan.categories=Array.isArray(data.categories)?data.categories:[];
  return vonHalskyStan.categories;
}
async function vonHalskyWybierzKategorie(productId){
  try{
    const categories=await vonHalskyPobierzKategorie(false),product=vonHalskyZnajdzProdukt(productId);
    const suggestion=product?.vonHalskyAgentCategorySuggestion||null;
    vonHalskyZamknijKategorie();
    const shell=document.createElement("div");shell.id="vonHalskyCategoryPicker";shell.className="von-halsky-product-preview-shell";
    shell.innerHTML=`<section role="dialog" aria-modal="true" class="von-halsky-product-preview"><header><div><span>Aktualne drzewo API • ${categories.length} kategorii końcowych</span><h2>Przypisz kategorię Von Halsky</h2><small>${esc(product?.nazwa||productId)}</small></div><button class="btn ghost" type="button" data-close>✕ Zamknij</button></header><main style="padding:20px">${suggestion?.path?`<section class="von-halsky-category-link"><div><small>Najlepsza propozycja Agenta</small><b>${esc(suggestion.path)}</b><span>${Math.round(Number(suggestion.confidence||0)*100)}% pewności • ${esc((suggestion.evidence||[]).slice(0,2).join(" • "))}</span></div><button class="btn" type="button" data-category-id="${esc(suggestion.id)}">Wybierz propozycję</button></section>`:""}<label>Wyszukaj w pełnym drzewie kategorii<input data-category-search autofocus placeholder="np. gry planszowe, balony, zabawki"></label><div data-category-results class="von-halsky-diagnostic-list"></div></main></section>`;
    const input=shell.querySelector("[data-category-search]"),results=shell.querySelector("[data-category-results]");
    const draw=()=>{const q=normalizujSzukanyTekst(input.value),rows=categories.filter(item=>!q||normalizujSzukanyTekst(item.path||item.name).includes(q)).slice(0,100);results.innerHTML=rows.map(item=>`<article><span>›</span><div><b>${esc(item.name)}</b><small>${esc(item.path)}</small></div><button class="btn" type="button" data-category-id="${esc(item.id)}">Wybierz</button></article>`).join("")||"<small>Brak kategorii pasującej do wyszukiwania.</small>";};
    input.addEventListener("input",draw);shell.addEventListener("click",async event=>{if(event.target===shell||event.target.closest("[data-close]"))return vonHalskyZamknijKategorie();const button=event.target.closest("[data-category-id]");if(!button)return;button.disabled=true;try{await chmura("von-halsky-product-category",{method:"POST",body:{productId,categoryId:button.dataset.categoryId},timeout:30000});toast("Kategoria Von Halsky zapisana ✅");vonHalskyZamknijKategorie();if(typeof odswiezProduktyAdmin==="function")await odswiezProduktyAdmin();await vonHalskyLaduj(true);}catch(error){toast("Nie zapisano kategorii: "+(error.message||error));button.disabled=false;}});
    document.body.appendChild(shell);draw();input.focus();
  }catch(error){toast("Nie pobrano kategorii Von Halsky: "+(error.message||error));}
}
async function vonHalskyZmienStanOferty(offerId,open){
  if(!confirm(`${open?"Wznowić":"Zamknąć"} tę ofertę w Von Halsky?`))return;
  try{const data=await chmura(open?"von-halsky-offer-resume":"von-halsky-offer-state",{method:"POST",body:{offerId,open},timeout:30000});toast(open?`Ustawiono ${Number(data.quantity)||vonHalskyStan.settings.defaultStock||1} szt. i przekazano wznowienie ✅`:"Zamknięcie przekazane ✅");await vonHalskyUzgodnijKatalog({silent:true,repeat:true});}catch(error){toast("Nie zmieniono stanu oferty: "+(error.message||error));}
}
function vonHalskyOtworzPodglad(productId){
  const product=vonHalskyZnajdzProdukt(productId);if(!product)return;
  const presentation=vonHalskyPrezentacjaProduktu(product),quality=vonHalskyOcenaProduktu(product),images=[quality.zdjecie,...(Array.isArray(product.zdjecia)?product.zdjecia:[])].filter((url,index,list)=>url&&list.indexOf(url)===index).slice(0,8),parameters=Object.entries(product.parametryZrodla||product.parametryProducenta||product.parametry||{}).filter(([,value])=>String(value??"").trim()).slice(0,18);
  vonHalskyZamknijPodglad();
  const shell=document.createElement("div");shell.id="vonHalskyProductPreview";shell.className="von-halsky-product-preview-shell";
  shell.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="vonHalskyPreviewTitle" class="von-halsky-product-preview"><header><div><span>Podgląd oferty • ${esc(presentation.source)}</span><h2 id="vonHalskyPreviewTitle">${esc(presentation.name||"Produkt")}</h2><small>Tak klient zobaczy treść przygotowaną dla kanału Von Halsky.</small></div><button type="button" class="btn ghost" data-close aria-label="Zamknij">✕ Zamknij</button></header><div class="von-halsky-product-page"><aside><div class="von-halsky-product-main-image">${images[0]?`<img src="${esc(images[0])}" alt="${esc(presentation.name)}">`:"<span>📦</span>"}</div>${images.length>1?`<div class="von-halsky-product-thumbs">${images.map((url,index)=>`<button type="button" class="${index===0?"active":""}" data-image="${esc(url)}"><img src="${esc(url)}" alt=""></button>`).join("")}</div>`:""}</aside><main><div class="von-halsky-product-buybox"><span class="lvl ${quality.gotowy?"lvl-ok":"lvl-ostrzezenie"}">${quality.gotowy?"Gotowa do kanału":"Wymaga uzupełnienia"}</span><h1>${esc(presentation.name||"Produkt")}</h1>${presentation.shortDescription?`<p class="von-halsky-product-lead">${esc(presentation.shortDescription)}</p>`:""}<div class="von-halsky-product-price">${quality.cena?zl(quality.cena):"Cena do ustalenia"}</div><dl><div><dt>Producent</dt><dd>${esc(product.producent||product.marka||"—")}</dd></div><div><dt>EAN</dt><dd>${esc(quality.ean||"—")}</dd></div><div><dt>Kod produktu</dt><dd>${esc(quality.kod||"—")}</dd></div></dl></div></main><article class="von-halsky-product-description"><span>Opis produktu</span>${presentation.longDescription.split(/\n{2,}/).filter(Boolean).map((paragraph,index)=>index===0?`<h3>${esc(paragraph)}</h3>`:`<p>${esc(paragraph)}</p>`).join("")||"<p>Opis zostanie pobrany z oferty sklepowej.</p>"}</article>${parameters.length?`<article class="von-halsky-product-parameters"><span>Najważniejsze informacje</span><dl>${parameters.map(([label,value])=>`<div><dt>${esc(String(label).replace(/_/g," "))}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></article>`:""}</div><footer><span>Źródło treści: <b>${esc(presentation.source)}</b></span><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(product.id)}" data-edit>Edytuj prezentację</a><button class="btn" type="button" data-close>Gotowe</button></footer></section>`;
  shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))vonHalskyZamknijPodglad();const thumb=event.target.closest("[data-image]");if(thumb){shell.querySelector(".von-halsky-product-main-image img").src=thumb.dataset.image;shell.querySelectorAll("[data-image]").forEach(button=>button.classList.toggle("active",button===thumb));}});
  document.body.appendChild(shell);shell.querySelector("[data-close]")?.focus();
}
function vonHalskyFiltryHTML(rows){
  const {producers,categories}=vonHalskyOpcjeFiltrow(),active=vonHalskyLiczbaAktywnychFiltrow();
  const results=vonHalskyStan.productQueue.loaded?Number(vonHalskyStan.productQueue.total)||0:rows.length;
  const options=(items,current)=>items.map(([value,label])=>`<option value="${esc(value)}" ${current===value?"selected":""}>${esc(label)}</option>`).join("");
  const fields=`<div class="allegro-listing-advanced-grid admin-search-full von-halsky-filter-grid">
    <label class="allegro-listing-search-wide"><span>Produkt, oferta lub identyfikator</span><input placeholder="Nazwa, EAN, EXTERNAL_ID, SKU, kod producenta, ID oferty…" value="${esc(vonHalskySzukaj)}" oninput="vonHalskySzukajPoWpisaniu(this.value)"></label>
    <label><span>Etap sprzedaży</span><select onchange="vonHalskyEtap=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Wszystkie etapy"],["sprzedaz","W sprzedaży"],["publikowanie","W publikacji / weryfikacji"],["wystawienie","Do wystawienia"],["przygotowanie","Do przygotowania"],["aktualizacja","Do aktualizacji"],["wyprzedane","Wyprzedane — SOLDOUT"],["wstrzymane","Wstrzymane"]],vonHalskyEtap)}</select></label>
    <label><span>Problem do rozwiązania</span><select onchange="vonHalskyProblem=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy problem"],["identyfikacja","Brak identyfikacji"],["zdjecie","Brak zdjęcia"],["opis","Nazwa lub opis"],["kategoria","Brak kategorii"],["gpsr","Niekompletny GPSR"],["cena","Brak ceny"]],vonHalskyProblem)}</select></label>
    <label><span>Jakość danych</span><select onchange="vonHalskyFiltr=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy poziom"],["gotowe","Gotowe do publikacji"],["braki","Wymagają uzupełnienia"],["ean","Z poprawnym EAN"],["bez-ean","Bez poprawnego EAN"],["kategoria","Z kategorią kanału"],["bez-kategorii","Bez kategorii kanału"],["gpsr","Z kompletnym GPSR"],["bez-gpsr","Bez kompletnego GPSR"]],vonHalskyFiltr)}</select></label>
    <label><span>Praca Agenta</span><select onchange="vonHalskyAgentFiltr=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy stan"],["w-toku","Wykonywane teraz"],["gotowe","Potwierdzone zapisem"],["wymaga-danych","Wymagają danych"],["ponowienie","Zaplanowane ponowienie"],["blad","Błąd wykonania"],["oczekuje","Jeszcze niesprawdzone"]],vonHalskyAgentFiltr)}</select></label>
    <label><span>Status kanału</span><select onchange="vonHalskyStatusKanalu=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy status"],["aktywne","Potwierdzone PUBLISHED"],["wyprzedane","Wyprzedane — SOLDOUT"],["weryfikacja","Prawidłowo oczekujące"],["blad-weryfikacji","Błąd weryfikacji — do poprawy"],["odrzucone","Odrzucone przez kanał"],["niewystawione","Brak oferty w API"]],vonHalskyStatusKanalu)}</select></label>
    <label><span>Producent</span><select onchange="vonHalskyProducent=this.value;vonHalskyZmienFiltr()"><option value="wszyscy">Wszyscy producenci</option>${producers.map(item=>`<option value="${esc(item.id)}" ${vonHalskyProducent===item.id?"selected":""}>${esc(item.label)} (${item.count})</option>`).join("")}</select></label>
    <label><span>Kategoria sklepu</span><select onchange="vonHalskyKategoria=this.value;vonHalskyZmienFiltr()"><option value="wszystkie">Wszystkie kategorie</option>${categories.map(item=>`<option value="${esc(item.id)}" ${vonHalskyKategoria===item.id?"selected":""}>${esc(item.label)} (${item.count})</option>`).join("")}</select></label>
    <label><span>Cena kanału</span><select onchange="vonHalskyCena=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Z ceną i bez ceny"],["z-cena","Cena ustalona"],["bez-ceny","Brak ceny"]],vonHalskyCena)}</select></label>
    <label><span>Dostępność</span><select onchange="vonHalskyDostepnosc=this.value;vonHalskyZmienFiltr()">${options([["wszystkie","Każdy stan"],["dostepne","Dostępne w sprzedaży"],["wstrzymane","Wstrzymane"]],vonHalskyDostepnosc)}</select></label>
    <label><span>Sortowanie</span><select onchange="vonHalskySort=this.value;vonHalskyZmienFiltr()">${options([["jakosc","Najpierw wymagające pracy"],["nazwa","Nazwa A–Z"],["ean","EAN / GTIN"],["cena","Cena malejąco"]],vonHalskySort)}</select></label>
    <label><span>Na stronie</span><select onchange="vonHalskyNaStronie=Number(this.value)||50;vonHalskyZmienFiltr()">${[25,50,100,250,500,1000].map(value=>`<option value="${value}" ${vonHalskyNaStronie===value?"selected":""}>${value}</option>`).join("")}</select></label>
    <button class="btn ghost allegro-listing-reset" type="button" onclick="vonHalskyResetujFiltry()" ${active?"":"disabled"}>Wyczyść filtry${active?` (${active})`:""}</button>
  </div>`;
  return adminWyszukiwaniePanelHTML({id:"von-halsky-products",title:"Wyszukiwanie i filtry ofert",description:"Łącz identyfikatory, problem, jakość, Agenta, producenta, kategorię, cenę i dostępność. Etap sprzedaży wybierasz kafelkami powyżej.",fields,results,active:active>0,open:true});
}
function vonHalskyAktualizujPodsumowanieFiltrowDOM(){
  const panel=document.querySelector('[data-admin-search-panel="von-halsky-products"]');if(!panel)return false;
  const active=vonHalskyLiczbaAktywnychFiltrow(),results=vonHalskyStan.productQueue.loaded?Number(vonHalskyStan.productQueue.total)||0:vonHalskyWiersze().length;
  const meta=panel.querySelector(".admin-search-summary-meta"),count=meta?.querySelector("strong");
  if(count)count.textContent=`${results} wyników`;
  let badge=meta?.querySelector("em");
  if(active&&!badge){badge=document.createElement("em");badge.textContent="Aktywne filtry";meta?.prepend(badge);}
  else if(!active&&badge)badge.remove();
  const reset=panel.querySelector(".allegro-listing-reset");
  if(reset){reset.disabled=!active;reset.textContent=`Wyczyść filtry${active?` (${active})`:""}`;}
  return true;
}
function vonHalskyPublikacjaWyboruHTML(rows){
  const selectedVisible=rows.filter(({product})=>vonHalskyZaznaczone.has(String(product.id))),selectedCount=vonHalskyZaznaczone.size;
  const ready=selectedVisible.filter(({quality})=>quality.gotowy),blocked=selectedVisible.length-ready.length;
  const repairs=selectedVisible.filter(({quality})=>["VERIFICATION_ERROR","REJECTED","ERROR"].includes(String(quality.offerStatus||"").toUpperCase())).length;
  const connected=vonHalskyStan.sync?.status==="connected",configured=vonHalskyStan.config?.configured===true,busy=!!vonHalskyStan.operation;
  const spansPages=selectedCount>selectedVisible.length;
  const status=!selectedCount?"Zaznacz produkty w tabeli":!configured?"Uzupełnij prywatny kontrakt API":!connected?"Najpierw wykonaj test połączenia":spansPages?`${selectedCount} wybranych z wielu stron • serwer sprawdzi każdą pozycję`:blocked?`${ready.length} gotowych • ${blocked} zablokowanych`:`${ready.length} gotowych do przekazania`;
  const publishLabel=repairs&&!spansPages?`Popraw i ponów (${selectedCount})`:`Opublikuj / aktualizuj (${selectedCount})`;
  const queue=vonHalskyStan.sync?.publicationQueue||{},queueActive=["queued","running","paused"].includes(String(queue.status||""));
  const queueTotal=Number(queue.total)||Number(queue.productIds?.length)||0,queueCompleted=Number(queue.completed)||Number(queue.completedIds?.length)||0,queueRemaining=Number.isFinite(Number(queue.remaining))?Number(queue.remaining):Math.max(0,queueTotal-queueCompleted),queueFailed=Number(queue.failed)||Number(queue.failures?.length)||0;
  const currentId=String(queue.currentBatchIds?.[0]||""),currentProduct=currentId?vonHalskyZnajdzProdukt(currentId):null;
  const queueLabel=queue.status==="running"?`Serwer wykonuje teraz: ${currentProduct?.nazwa||`produkt ${currentId||"—"}`}`:queue.status==="paused"?"Kolejka publikacji jest wstrzymana":queue.status==="queued"?"Kolejka czeka na najbliższe pobranie przez serwer":queue.status==="completed"?`Ostatnia kolejka zakończona • błędy: ${queueFailed}`:"";
  return `${queue.id?`<section class="von-halsky-server-queue ${esc(queue.status||"idle")}"><div><small>TRWAŁA KOLEJKA SERWEROWA • DZIAŁA PO ZAMKNIĘCIU KARTY</small><b>${esc(queueLabel)}</b><span>Wykonano ${queueCompleted} z ${queueTotal} • pozostało ${queueRemaining} • odłożono do poprawy ${queueFailed}</span></div><strong>${queueTotal>0?Math.round(queueCompleted/queueTotal*100):100}%</strong>${queueActive?`<nav>${queue.status==="paused"?`<button class="btn" type="button" onclick="vonHalskySterujPublikacja('resume')">▶ Wznów</button>`:`<button class="btn ghost" type="button" onclick="vonHalskySterujPublikacja('pause')">⏸ Wstrzymaj</button>`}<button class="btn danger" type="button" onclick="vonHalskySterujPublikacja('cancel')">⛔ Anuluj</button></nav>`:""}</section>`:""}<section class="von-halsky-publication-bar ${selectedCount?"has-selection":""}" aria-label="Przygotowanie i ręczna publikacja ofert"><div class="von-halsky-publication-icon">↗</div><div><small>Agent przygotowuje • administrator zleca publikację</small><b>Praca wyłącznie na zaznaczonych produktach</b><span>${esc(status)}. Po kliknięciu cała lista zostaje zapisana na serwerze; błąd jednej oferty nie zatrzyma pozostałych.</span></div><div class="von-halsky-publication-count"><strong>${selectedCount}</strong><small>zaznaczono</small></div><div class="von-halsky-publication-actions"><button class="btn ghost" type="button" ${!selectedCount||busy?"disabled":""} onclick="vonHalskyPrzygotujWybraneAgentem()">${vonHalskyStan.operation==="agent"?"Agent pracuje…":`🤖 Przygotuj Agentem (${selectedCount})`}</button><button class="btn" type="button" ${!selectedCount||!configured||!connected||busy?"disabled":""} onclick="vonHalskySynchronizujKatalog()">${vonHalskyStan.operation==="catalog"?"Zapisuję kolejkę…":publishLabel}</button></div></section>`;
}
function vonHalskyTabelaWierszHTML({product,quality}={}){
  const productId=String(product.id),match=vonHalskyMetodaDopasowania(product,quality),agent=vonHalskyAgentStan(product);
  const offerClosed=["CLOSED","SOLDOUT","INACTIVE"].includes(String(quality.offerStatus||"").toUpperCase());
  const remoteStatus=String(quality.offerStatus||"").toUpperCase(),channelActive=remoteStatus==="PUBLISHED"&&quality.offerVerified===true;
  const requiresRepair=["VERIFICATION_ERROR","REJECTED","ERROR"].includes(remoteStatus);
  const channelLabel=channelActive?"Aktywna sprzedaż":remoteStatus==="SOLDOUT"?"Wyprzedana":remoteStatus==="VERIFICATION_ERROR"?"Błąd weryfikacji":["PENDING","PROCESSING","VERIFYING"].includes(remoteStatus)?"Prawidłowo oczekuje":["REJECTED","ERROR"].includes(remoteStatus)?"Odrzucona":offerClosed?"Wstrzymana":quality.ofertaId?"Stan niepotwierdzony":"Jeszcze niewystawiona";
  const channelClass=channelActive?"lvl-ok":["PENDING","PROCESSING","VERIFYING"].includes(remoteStatus)?"lvl-info":requiresRepair?"lvl-bad":"lvl-ostrzezenie";
  return `<tr class="${quality.gotowy?"is-ready":"needs-work"} ${vonHalskyZaznaczone.has(productId)?"is-selected":""}">
    <td data-label="" class="von-halsky-cell-select"><input type="checkbox" aria-label="Zaznacz ${esc(quality.nazwa||"produkt")}" ${vonHalskyZaznaczone.has(productId)?"checked":""} onchange="vonHalskyUstawZaznaczenie([${jsArg(productId)}],this.checked)"></td>
    <td data-label="Produkt" class="von-halsky-cell-product"><div class="von-halsky-product"><span>${quality.zdjecie?`<img src="${esc(quality.zdjecie)}" loading="lazy" alt="">`:esc(product.ikona||"📦")}</span><div><b>${esc(quality.nazwa||"Produkt")}</b><small>${esc(product.kategoria||"bez kategorii")} • ${esc(product.producent||product.marka||"producent —")}</small><em>${quality.presentation.mode==="custom"?"Dopasowanie Von Halsky":"Treść ze sklepu"}</em></div></div></td>
    <td data-label="Identyfikacja" class="von-halsky-cell-identity"><div class="von-halsky-identity"><span class="von-halsky-match-state ${match.level}">${esc(match.label)}</span><b>EAN ${esc(quality.ean||"—")}</b><small>EXTERNAL_ID ${esc(product.externalId||product.sku||product.id||"—")}</small><small>Kod ${esc(quality.kod||"—")} • marka ${esc(quality.marka||"—")}</small><small>Kategoria ${esc(quality.categoryPath||quality.categoryId||"nieprzypisana")}${quality.categoryResolution?.source?` • ${esc(vonHalskyZrodloKategorii(quality.categoryResolution.source))}`:""}</small><small class="${quality.gpsr.ready?"von-halsky-ok":"von-halsky-issues"}">GPSR ${quality.gpsr.ready?`✓ ${esc(quality.gpsr.name)}`:`— ${esc(quality.gpsr.missing.join(", "))}`}</small></div></td>
    <td data-label="Gotowość" class="von-halsky-cell-quality"><div class="von-halsky-quality"><div class="von-halsky-score"><strong>${quality.wynik}%</strong><span><i style="width:${quality.wynik}%"></i></span></div><span class="von-halsky-agent-state ${agent.cls}">${esc(agent.label)}</span>${product.vonHalskyAgentReadbackConfirmed===true&&product.vonHalskyAgentConfirmedAt?`<small>potwierdzony zapis ${esc(allegroDataTxt(product.vonHalskyAgentConfirmedAt))}</small>`:""}${quality.braki.length?`<small class="von-halsky-issues">${quality.braki.map(esc).join(" • ")}</small>`:'<small class="von-halsky-ok">Dane spełniają kontrolę obowiązkową</small>'}${quality.ostrzezenia.length?`<small>${quality.ostrzezenia.map(esc).join(" • ")}</small>`:""}</div></td>
    <td data-label="Cena" class="von-halsky-cell-price"><div class="von-halsky-channel-cell"><b>${quality.cena?zl(quality.cena):"Cena —"}</b><small>${quality.dostepny?"produkt dostępny":"sprzedaż produktu wstrzymana"}</small><small>Zakres ${vonHalskyStan.settings.minimumStock}–${vonHalskyStan.settings.maximumStock} szt.</small></div></td>
    <td data-label="Kanał sprzedaży" class="von-halsky-cell-channel"><div class="channel-sales-state"><b>InPost Von Halsky</b><span class="lvl ${channelClass}">${channelActive?"● ":""}${esc(channelLabel)}</span>${remoteStatus?`<small>Artway: ${esc(remoteStatus)}${quality.providerStatus&&quality.providerStatus!==remoteStatus?` • API: ${esc(quality.providerStatus)}`:""}${quality.offerVerified?" • potwierdzono":""}</small>`:"<small>Brak oferty potwierdzonej przez API</small>"}${quality.ofertaId?`<small>ID ${esc(quality.ofertaId)}</small>`:""}${quality.remoteErrors.length?`<small class="von-halsky-issues">${quality.remoteErrors.map(esc).join(" • ")}</small>`:""}${!quality.ofertaId&&quality.localOfferId?`<small>Lokalne ID oczekuje na potwierdzenie API</small>`:""}</div></td>
    <td data-label="Akcje" class="von-halsky-cell-actions"><div class="von-halsky-row-actions">${requiresRepair?`<a class="btn" href="#/admin/produkty/edytuj/${encodeURIComponent(product.id)}">Popraw wymagane dane</a>`:`<button class="btn" type="button" onclick="vonHalskyOtworzDopasowanie(${jsArg(product.id)})">Popraw dopasowanie</button>`}<div class="von-halsky-row-secondary"><button class="btn ghost" type="button" ${vonHalskyStan.operation?"disabled":""} onclick="vonHalskyPrzygotujAgentem([${jsArg(productId)}])">🤖 Przygotuj</button><button class="btn ghost" type="button" onclick="vonHalskyOtworzPodglad(${jsArg(product.id)})">Podgląd</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(product.id)}">Edycja</a>${quality.ofertaId&&!requiresRepair?`<button class="btn ghost" type="button" onclick="vonHalskyZmienStanOferty(${jsArg(quality.ofertaId)},${offerClosed?"true":"false"})">${offerClosed?"Wznów":"Zamknij"}</button>`:""}</div></div></td>
  </tr>`;
}
function vonHalskyWynikiHTML(){
  const rows=vonHalskyWiersze(),server=vonHalskyStan.productQueue.loaded,total=server?vonHalskyStan.productQueue.total:rows.length,pages=Math.max(1,Math.ceil(total/vonHalskyNaStronie));vonHalskyStrona=Math.min(vonHalskyStrona,pages);
  const start=server?Math.max(0,(vonHalskyStrona-1)*vonHalskyNaStronie):(vonHalskyStrona-1)*vonHalskyNaStronie,visible=server?rows:rows.slice(start,start+vonHalskyNaStronie);
  const selectedCount=vonHalskyZaznaczone.size,selectedVisible=visible.filter(({product})=>vonHalskyZaznaczone.has(String(product.id))).length;
  const shownFrom=visible.length?start+1:0,shownTo=start+visible.length;
  return `<div data-vh-results-region>
    ${vonHalskyStan.productQueue.loading?`<div class="von-halsky-inline-loading"><span></span><b>Pobieram właściwy fragment katalogu z PostgreSQL…</b></div>`:""}
    ${vonHalskyStan.productQueue.error?`<div class="backend-note warning"><b>Nie pobrano kolejki produktów</b><span>${esc(vonHalskyStan.productQueue.error)}</span></div>`:""}
    ${adminOperacjeWynikowHTML({id:"von-halsky-products",selected:selectedCount,pageCount:visible.length,resultCount:total,selectPage:"vonHalskyUstawZaznaczenieZakres('strona',true)",selectAll:"vonHalskyUstawZaznaczenieZakres('filtr',true)",deselectPage:selectedVisible?"vonHalskyUstawZaznaczenieZakres('strona',false)":"",deselectAll:selectedCount?"vonHalskyUstawZaznaczenieZakres('filtr',false)":"",clear:"vonHalskyWyczyscZaznaczenie()",exportSelected:"vonHalskyEksportuj('selected')",exportAll:"vonHalskyEksportuj('all')",exportLabel:"CSV Von Halsky",busy:vonHalskyWyborWToku,extra:vonHalskyWyborWToku?'<span class="von-halsky-selection-loading">Pobieram pełny zakres z PostgreSQL…</span>':""})}
    ${vonHalskyPublikacjaWyboruHTML(rows)}
    <div class="allegro-listing-results-head"><div><b>${total} produktów w aktywnym widoku</b><small>Pokazano ${shownFrom}–${shownTo} • strona ${vonHalskyStrona} z ${pages} • paginacja serwerowa</small></div><span><b>${selectedCount}</b> zaznaczonych łącznie • ${selectedVisible} na tej stronie</span></div>
    <div class="admin-standard-table-wrap von-halsky-table-wrap"><table class="admin-standard-table admin-responsive-table von-halsky-table"><colgroup><col class="von-halsky-col-select"><col class="von-halsky-col-product"><col class="von-halsky-col-identity"><col class="von-halsky-col-quality"><col class="von-halsky-col-price"><col class="von-halsky-col-channel"><col class="von-halsky-col-actions"></colgroup><thead><tr><th><input type="checkbox" data-vh-page-checkbox data-selected="${selectedVisible}" data-total="${visible.length}" aria-label="Zaznacz produkty na stronie" ${visible.length&&selectedVisible===visible.length?"checked":""} onchange="vonHalskyUstawZaznaczenieZakres('strona',this.checked)"></th><th>Produkt</th><th>Identyfikacja</th><th>Gotowość</th><th>Cena</th><th>Kanał sprzedaży</th><th>Akcje</th></tr></thead><tbody>${visible.map(vonHalskyTabelaWierszHTML).join("")||'<tr><td data-label="" colspan="7"><div class="allegro-listing-empty"><span>⌕</span><b>Brak produktów w tym widoku</b><small>Zmień filtry albo wyczyść wyszukiwanie.</small></div></td></tr>'}</tbody></table></div>
    ${pages>1?`<nav class="allegro-listing-pagination von-halsky-pagination" aria-label="Paginacja produktów"><button class="btn ghost" ${vonHalskyStrona<=1||server&&!vonHalskyStan.productQueue.previousCursor?"disabled":""} onclick="${server?"vonHalskyPrzejdzKolejke(-1)":"vonHalskyStrona--;vonHalskyOdswiezFiltrowanyWidok()"}">← Poprzednia</button><span>Strona <b>${vonHalskyStrona}</b> z <b>${pages}</b></span><button class="btn ghost" ${vonHalskyStrona>=pages||server&&!vonHalskyStan.productQueue.nextCursor?"disabled":""} onclick="${server?"vonHalskyPrzejdzKolejke(1)":"vonHalskyStrona++;vonHalskyOdswiezFiltrowanyWidok()"}">Następna →</button></nav>`:""}
  </div>`;
}
function vonHalskyWystawianieHTML(){
  const rows=vonHalskyWiersze();
  if(!vonHalskyStan.productQueue.loaded&&!vonHalskyStan.productQueue.loading)setTimeout(()=>vonHalskyPobierzKolejkeProduktow({force:true}),0);
  setTimeout(vonHalskyAktualizujCheckboxStrony,0);
  return `<div class="allegro-listing-workspace von-halsky-listing-workspace"><section class="panel von-halsky-catalog-panel"><div class="order-section-head"><div><span class="order-pro-label">Jedno centrum ofert</span><h2>Przygotowanie i wystawianie produktów</h2><p class="order-detail-lead">Powiązanie, jakość danych, podgląd i publikacja są wykonywane w jednym miejscu. „W sprzedaży” oznacza wyłącznie status PUBLISHED potwierdzony aktualnym odczytem API.</p></div><button class="btn ghost" ${vonHalskyStan.operation?"disabled":""} onclick="vonHalskyOdswiezPelnyStatus()">${vonHalskyStan.operation==="reconcile"?"Uzgadniam…":"↻ Uzgodnij z API"}</button></div>
    ${vonHalskyKanalPrawdyHTML()}
    ${vonHalskyEtapySprzedazyHTML()}
    ${vonHalskyFiltryHTML(rows)}
    ${vonHalskyWynikiHTML()}
    ${vonHalskyPanelProcesuHTML()}
  </section></div>`;
}
function vonHalskyZamowieniaHTML(){
  const connected=vonHalskyPolaczenieEtykieta()==="połączone";
  const orders=Array.isArray(vonHalskyStan.orders)?vonHalskyStan.orders:[],returns=Array.isArray(vonHalskyStan.returns)?vonHalskyStan.returns:[],claims=Array.isArray(vonHalskyStan.claims)?vonHalskyStan.claims:[],commands=Array.isArray(vonHalskyStan.commands)?vonHalskyStan.commands:[];
  const orderRows=orders.length?`<div class="warehouse-worktable-wrap"><table class="log-table"><thead><tr><th>Zamówienie</th><th>Status</th><th>Klient</th><th>Pozycje</th><th>Wartość</th><th>Aktualizacja</th><th>Operacje</th></tr></thead><tbody>${orders.map(order=>{const amount=Number(order.finalPrice?.amount||0),refundable=!["REFUNDED","CANCELLED","REFUSED"].includes(String(order.status||""));return `<tr><td><b>${esc(order.id||"—")}</b></td><td><span class="lvl ${order.status==="CREATED"?"lvl-ostrzezenie":"lvl-info"}">${esc(order.status||"—")}</span><small>${esc(order.paymentDetails?.status||"")}</small></td><td>${esc(order.customer?.firstName||order.customer?.name||"—")} ${esc(order.customer?.lastName||"")}</td><td>${(order.orderLines||[]).map(line=>`${esc(line.offer?.product?.name||"Produkt")} × ${Number(line.quantity||1)}`).join("<br>")||"—"}</td><td><b>${esc(order.finalPrice?.amount??"—")} ${esc(order.finalPrice?.currency||"")}</b></td><td>${esc(allegroDataTxt(order.updatedAt||order.createdAt))}</td><td><div class="warehouse-worktable-actions">${order.status==="CREATED"?`<button class="btn" type="button" onclick="vonHalskyDecyzjaZamowienia(${jsArg(order.id)},true)">Przyjmij</button><button class="btn ghost" type="button" onclick="vonHalskyDecyzjaZamowienia(${jsArg(order.id)},false)">Odrzuć</button>`:""}${refundable&&amount>0?`<button class="btn ghost" type="button" onclick="vonHalskyRefunduj(${jsArg(order.id)},${amount})">Refunduj</button>`:""}<a class="btn ghost" href="#/admin/wysylki">Wysyłka</a></div></td></tr>`;}).join("")}</tbody></table></div>`:`<div class="admin-empty-state"><span>📭</span><h3>Brak nowych zamówień Von Halsky</h3><p>Połączenie działa, a kolejka nie zawiera obecnie zleceń.</p></div>`;
  const returnsRows=returns.length?`<div class="warehouse-worktable-wrap"><table class="log-table"><thead><tr><th>Zwrot</th><th>Zamówienie</th><th>Powód</th><th>Status</th><th>Termin</th><th>Decyzja</th></tr></thead><tbody>${returns.map(item=>`<tr><td><b>${esc(item.id||"—")}</b><small>${esc(item.trackingNumber||"")}</small></td><td>${esc(item.orderId||"—")}</td><td>${esc(item.returnReason?.text||"—")}</td><td><span class="lvl ${item.status?"lvl-info":"lvl-ostrzezenie"}">${esc(item.status||"NOWY")}</span></td><td>${esc(allegroDataTxt(item.expiresAt||item.createdAt))}</td><td>${item.status? "—":`<div class="warehouse-worktable-actions"><button class="btn" type="button" onclick="vonHalskyDecyzjaZwrotu(${jsArg(item.id)},true)">Akceptuj</button><button class="btn ghost" type="button" onclick="vonHalskyDecyzjaZwrotu(${jsArg(item.id)},false)">Odrzuć</button></div>`}</td></tr>`).join("")}</tbody></table></div>`:`<div class="admin-empty-state compact"><span>↩</span><div><b>Brak zwrotów do decyzji</b><small>Lista odświeża się bezpośrednio z API.</small></div></div>`;
  const claimsRows=claims.length?`<div class="warehouse-worktable-wrap"><table class="log-table"><thead><tr><th>Reklamacja</th><th>Zamówienie</th><th>Powód</th><th>Status</th><th>Termin</th><th>Rozstrzygnięcie</th></tr></thead><tbody>${claims.map(item=>{const claimId=item.claimId||item.id,orderId=item.relatedOrder?.orderId||item.orderId||"";return `<tr><td><b>${esc(claimId||"—")}</b></td><td>${esc(orderId||"—")}</td><td>${esc(item.specification?.claimTypeDescription||item.specification?.claimType?.description||"—")}</td><td><span class="lvl ${item.state==="RESOLUTION_IN_PROGRESS"?"lvl-ostrzezenie":"lvl-info"}">${esc(item.state||"NOWA")}</span></td><td>${esc(allegroDataTxt(item.expiresAt||item.createdAt))}</td><td>${item.state&&item.state!=="RESOLUTION_IN_PROGRESS"?"—":`<div class="warehouse-worktable-actions"><button class="btn ghost" type="button" onclick="vonHalskyRozstrzygnijReklamacje(${jsArg(orderId)},${jsArg(claimId)},'reject')">Odrzuć</button><button class="btn ghost" type="button" onclick="vonHalskyRozstrzygnijReklamacje(${jsArg(orderId)},${jsArg(claimId)},'partial-refund')">Częściowy zwrot</button><button class="btn" type="button" onclick="vonHalskyRozstrzygnijReklamacje(${jsArg(orderId)},${jsArg(claimId)},'refund')">Pełny zwrot</button></div>`}</td></tr>`;}).join("")}</tbody></table></div>`:`<div class="admin-empty-state compact"><span>🛡</span><div><b>Brak reklamacji do rozstrzygnięcia</b><small>Lista odświeża się bezpośrednio z API.</small></div></div>`;
  const commandRows=commands.slice(0,10).map(item=>{const failed=["FAILURE","FAILED","NOT_FOUND"].includes(String(item.status||"").toUpperCase());return `<article class="${item.status==="SUCCESS"?"ok":failed?"error":""}"><span>${item.status==="SUCCESS"?"✓":failed?"!":"…"}</span><div><b>${esc(item.type||"polecenie")} • ${esc(item.entityId||"")}</b><small>${esc(item.commandId)} • ${esc(item.status||"PENDING")}</small>${item.error?`<small class="von-halsky-issues">${esc(item.error)}</small>`:""}</div><button class="btn ghost" type="button" onclick="vonHalskySprawdzPolecenie(${jsArg(item.commandId)},${jsArg(item.type)})">Sprawdź</button></article>`;}).join("");
  return `<section class="panel von-halsky-orders"><div class="order-section-head"><div><span class="order-pro-label">Pełny cykl zamówienia</span><h2>Zamówienia, płatności i wysyłka</h2><p class="order-detail-lead">Przyjęcie, odmowa, refundacja i przekazanie do centrum wysyłek są dostępne w jednym panelu Artway-TM.</p></div><div class="diag-actions"><button class="btn" type="button" ${!connected||vonHalskyStan.operation?"disabled":""} onclick="vonHalskySynchronizujZamowienia()">${vonHalskyStan.operation==="orders"?"Pobieram…":"↻ Pobierz zamówienia"}</button><a class="btn ghost" href="#/admin/wysylki">Centrum wysyłek</a></div></div>${!connected?`<div class="von-halsky-connection-gate"><span>🔐</span><div><h3>Najpierw dokończ połączenie kanału</h3><p>Autoryzacja serwerowa musi przejść test połączenia.</p><a class="btn" href="#/admin/von-halsky/ustawienia">Otwórz ustawienia integracji</a></div></div>`:orderRows}</section>
    <section class="panel von-halsky-orders"><div class="order-section-head"><div><span class="order-pro-label">Obsługa posprzedażowa</span><h2>Zwroty i reklamacje</h2><p class="order-detail-lead">Decyzje trafiają bezpośrednio do produkcyjnego API Von Halsky i wymagają potwierdzenia administratora.</p></div><button class="btn" type="button" ${!connected||vonHalskyStan.operation?"disabled":""} onclick="vonHalskySynchronizujPosprzedaz()">${vonHalskyStan.operation==="post-sales"?"Pobieram…":"↻ Pobierz sprawy"}</button></div><h3>Zwroty</h3>${returnsRows}<h3>Reklamacje</h3>${claimsRows}</section>
    <section class="panel von-halsky-diagnostics"><div class="order-section-head"><div><span class="order-pro-label">Operacje asynchroniczne</span><h2>Statusy poleceń API</h2></div><button class="btn ghost" type="button" onclick="vonHalskySynchronizujZdarzenia()">↻ Pobierz zdarzenia</button></div><div class="von-halsky-diagnostic-list">${commandRows||`<div class="admin-empty-state compact"><span>⏱</span><div><b>Brak oczekujących poleceń</b><small>Statusy pojawią się po operacji na ofercie lub zamówieniu.</small></div></div>`}</div></section>`;
}
async function vonHalskySynchronizujZamowienia(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="orders";
  if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();
  try{const data=await chmura("von-halsky-sync-orders",{method:"POST",body:{limit:250},timeout:60000});vonHalskyStan.orders=data.orders||[];vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};toast(`Pobrano ${data.fetched||0} zamówień Von Halsky ✅`);}catch(error){toast("Zamówienia Von Halsky: "+(error.message||error));}finally{vonHalskyStan.operation="";if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();}
}
async function vonHalskyDecyzjaZamowienia(orderId,accepted){
  if(!confirm(`${accepted?"Przyjąć":"Odrzucić"} zamówienie ${orderId} w InPost Von Halsky?`))return;
  try{const data=await chmura("von-halsky-order-state",{method:"POST",body:{orderId,accepted},timeout:30000});vonHalskyStan.orders=data.orders||vonHalskyStan.orders;toast(accepted?"Zamówienie przyjęte ✅":"Zamówienie odrzucone");renderuj();}catch(error){toast("Nie zapisano decyzji: "+(error.message||error));}
}
async function vonHalskySynchronizujPosprzedaz(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="post-sales";
  if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();
  try{const data=await chmura("von-halsky-post-sales-sync",{method:"POST",body:{limit:250},timeout:60000});vonHalskyStan.returns=data.returns||[];vonHalskyStan.claims=data.claims||[];if(data.sourceHealth)vonHalskyStan.records.sourceHealth=data.sourceHealth;toast(data.partial?`Synchronizacja zapisana; część danych wymaga ponowienia: ${(data.warnings||[]).join(" ")}`:"Zwroty i reklamacje odświeżone ✅");}catch(error){toast("Obsługa posprzedażowa: "+(error.message||error));}finally{vonHalskyStan.operation="";if(typeof vonHalskyAktualizujZamowieniaDOM==="function")vonHalskyAktualizujZamowieniaDOM();else renderuj();}
}
async function vonHalskyDecyzjaZwrotu(returnId,accepted){
  if(!confirm(`${accepted?"Zaakceptować":"Odrzucić"} zwrot ${returnId} w Von Halsky?`))return;
  try{const data=await chmura("von-halsky-return-state",{method:"POST",body:{returnId,accepted},timeout:30000});vonHalskyStan.returns=data.returns||vonHalskyStan.returns;toast(accepted?"Zwrot zaakceptowany ✅":"Zwrot odrzucony");renderuj();}catch(error){toast("Nie zapisano decyzji zwrotu: "+(error.message||error));}
}
async function vonHalskyRefunduj(orderId,maximum){
  const raw=prompt(`Podaj kwotę refundacji dla zamówienia ${orderId} (maks. ${Number(maximum).toFixed(2)} PLN):`,Number(maximum).toFixed(2));if(raw===null)return;
  const amount=Number(String(raw).replace(",","."));
  if(!Number.isFinite(amount)||amount<=0||amount>Number(maximum)){toast("Podaj poprawną kwotę refundacji w dozwolonym zakresie.");return;}
  if(!confirm(`Zlecić refundację ${amount.toFixed(2)} PLN dla zamówienia ${orderId}? Tej operacji nie można cofnąć w panelu.`))return;
  try{await chmura("von-halsky-order-refund",{method:"POST",body:{orderId,amount},timeout:30000});toast("Refundacja została przyjęta przez API ✅");await vonHalskySynchronizujZamowienia();}catch(error){toast("Nie zlecono refundacji: "+(error.message||error));}
}
async function vonHalskyRozstrzygnijReklamacje(orderId,claimId,resolution){
  const labels={reject:"odrzucić", "partial-refund":"uznać z częściowym zwrotem",refund:"uznać z pełnym zwrotem"},description=prompt("Opcjonalne uzasadnienie decyzji (do 1000 znaków):","");if(description===null)return;
  if(!confirm(`Czy na pewno ${labels[resolution]||"rozstrzygnąć"} reklamację ${claimId}?`))return;
  try{const data=await chmura("von-halsky-claim-state",{method:"POST",body:{orderId,claimId,resolution,description},timeout:30000});vonHalskyStan.claims=data.claims||vonHalskyStan.claims;toast("Reklamacja rozstrzygnięta ✅");renderuj();}catch(error){toast("Nie rozstrzygnięto reklamacji: "+(error.message||error));}
}
async function vonHalskySprawdzPolecenie(commandId,type){
  try{const data=await chmura("von-halsky-command-status",{method:"POST",body:{commandId,type},timeout:30000});const command=data.command||{};vonHalskyStan.commands=[command,...vonHalskyStan.commands.filter(item=>item.commandId!==commandId)];toast(`Polecenie: ${command.status||"PENDING"}`);renderuj();}catch(error){toast("Nie pobrano statusu polecenia: "+(error.message||error));}
}
async function vonHalskySynchronizujZdarzenia(){
  try{const data=await chmura("von-halsky-events-sync",{method:"POST",body:{limit:30},timeout:60000});vonHalskyStan.events=data.events||[];toast(`Pobrano ${vonHalskyStan.events.length} ostatnich zdarzeń ✅`);await vonHalskyLaduj(true);}catch(error){toast("Nie pobrano zdarzeń: "+(error.message||error));}
}
function vonHalskySettingsBody(form){
  const fd=new FormData(form),onboarding={};
  form.querySelectorAll("[name^='onboarding.']").forEach(input=>onboarding[input.name.split(".")[1]]=input.checked);
  return {
    integrationMethod:"api",integrator:"",channelAlias:fd.get("channelAlias"),merchantStoreName:fd.get("merchantStoreName"),notificationEmail:fd.get("notificationEmail"),
    minimumStock:Number(fd.get("minimumStock")),defaultStock:Number(fd.get("defaultStock")),maximumStock:Number(fd.get("maximumStock")),syncIntervalMinutes:Number(fd.get("syncIntervalMinutes")),
    automaticPriceSync:form.automaticPriceSync.checked,automaticStockSync:form.automaticStockSync.checked,automaticResume:form.automaticResume.checked,
    agentPreparationEnabled:form.agentPreparationEnabled.checked,agentCategoryAutoMatchEnabled:form.agentCategoryAutoMatchEnabled.checked,agentAttributeAutoMatchEnabled:form.agentAttributeAutoMatchEnabled.checked,agentMinimumConfidence:Number(fd.get("agentMinimumConfidence"))/100,
    newOfferPublicationMode:"manual_selection",catalogAutomationEnabled:false,customerZone:form.customerZone.checked,onboarding
  };
}
function vonHalskyUstawieniaBrudne(form){
  form.classList.add("is-dirty");
  const state=form.querySelector("[data-save-state]");
  if(state){state.textContent="Masz niezapisane zmiany";state.classList.add("is-dirty");}
}
async function vonHalskyZapiszUstawienia(event){
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{
    const form=event.currentTarget,data=await chmura("von-halsky-settings",{method:"POST",body:vonHalskySettingsBody(form),timeout:20000});
    vonHalskyStan.settings={...vonHalskyStan.settings,...data.settings};vonHalskyStan.config=data.config||vonHalskyStan.config;
    form.classList.remove("is-dirty");const state=form.querySelector("[data-save-state]");
    if(state){state.textContent="Wszystkie ustawienia zapisane";state.classList.remove("is-dirty");}
    toast("Ustawienia Von Halsky zapisane ✅");
  }catch(error){toast("Nie zapisano ustawień: "+(error.message||error));}
  finally{button.disabled=false;}
}
async function vonHalskySprawdzPolaczenie(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="connection";vonHalskyAktualizujUstawieniaDOM();
  try{const data=await chmura("von-halsky-connection-check",{method:"POST",body:{},timeout:25000});vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};toast(data.connected?"Połączenie API Von Halsky działa ✅":"Nie potwierdzono połączenia");if(data.connected)await vonHalskyUzgodnijKatalog({silent:true,render:false});await vonHalskyLaduj(true,{render:false});}catch(error){toast("Von Halsky: "+(error.message||error));await vonHalskyLaduj(true,{render:false});}finally{vonHalskyStan.operation="";vonHalskyAktualizujUstawieniaDOM();}
}
async function vonHalskySprawdzPakiet(){
  if(vonHalskyStan.operation)return;vonHalskyStan.operation="preview";vonHalskyAktualizujUstawieniaDOM();
  try{const data=await chmura("von-halsky-catalog-preview",{timeout:30000});vonHalskyStan.preview=data;toast(`Pakiet sprawdzony: ${data.eligible||0} gotowych ofert ✅`);}catch(error){toast("Nie sprawdzono pakietu: "+(error.message||error));}finally{vonHalskyStan.operation="";vonHalskyAktualizujUstawieniaDOM();}
}
async function vonHalskySynchronizujKatalog(){
  if(vonHalskyStan.operation)return;
  const productIds=[...vonHalskyZaznaczone];
  if(!productIds.length){toast("Zaznacz produkty, które chcesz opublikować lub zaktualizować.");return;}
  if(vonHalskyStan.config?.configured!==true){toast("Najpierw uzupełnij prywatny kontrakt API Von Halsky.");return;}
  if(vonHalskyStan.sync?.status!=="connected"){toast("Najpierw wykonaj poprawny test połączenia API.");return;}
  const filterSnapshot=vonHalskyMigawkaFiltrow();
  vonHalskyStan.operation="catalog";vonHalskyAktualizujWystawianieDOM();
  try{
    const data=await chmura("von-halsky-publication-queue",{method:"POST",body:{productIds},timeout:45000});
    vonHalskyStan.sync={...vonHalskyStan.sync,...(data.sync||{})};
    vonHalskyZaznaczone.clear();
    vonHalskyPrzywrocFiltry(filterSnapshot);
    toast(`✅ Agent rozpocznie ${data.queued||productIds.length} produktów zaraz po aktualnej partii. Możesz zamknąć kartę — publikacja będzie kontynuowana.`);
    await vonHalskyLaduj(true,{render:false});
  }catch(error){
    toast("Nie zapisano kolejki Von Halsky: "+(error.message||error));
    await vonHalskyLaduj(true);
  }finally{vonHalskyStan.operation="";vonHalskyPrzywrocFiltry(filterSnapshot);vonHalskyAktualizujWystawianieDOM();}
}
async function vonHalskySterujPublikacja(command){
  if(vonHalskyStan.operation)return;
  vonHalskyStan.operation="publication-control";vonHalskyAktualizujWystawianieDOM();
  try{
    const data=await chmura("von-halsky-publication-queue-control",{method:"POST",body:{command},timeout:30000});
    vonHalskyStan.sync={...vonHalskyStan.sync,publicationQueue:data.queue||vonHalskyStan.sync?.publicationQueue};
    toast(command==="pause"?"⏸ Kolejka zostanie zatrzymana po bezpiecznym zakończeniu bieżącego produktu.":command==="resume"?"▶ Wznowiono publikację na serwerze.":"⛔ Anulowano pozostałą część kolejki.");
  }catch(error){toast("Sterowanie kolejką: "+(error.message||error));}
  finally{vonHalskyStan.operation="";vonHalskyAktualizujWystawianieDOM();}
}
function vonHalskyDiagnostykaHTML(){
  const latestByOperation=new Map();
  for(const row of Array.isArray(vonHalskyStan.diagnostics)?vonHalskyStan.diagnostics:[]){
    const key=String(row.operation||"operacja-api");
    if(!latestByOperation.has(key))latestByOperation.set(key,row);
  }
  const rows=[...latestByOperation.values()].slice(0,6);
  const action=String(trasa()).endsWith("/ustawienia")?`<button class="btn ghost" type="button" onclick="vonHalskyLaduj(true)">↻ Odśwież rejestr</button>`:`<a class="btn ghost" href="#/admin/von-halsky/ustawienia">Pełna konfiguracja</a>`;
  return `<section class="panel von-halsky-diagnostics"><div class="order-section-head"><div><span class="order-pro-label">Rejestr techniczny</span><h2>Ostatnie operacje API</h2></div>${action}</div><div class="von-halsky-diagnostic-list">${rows.map(row=>`<article class="${row.status==="ok"?"ok":"error"}"><span>${row.status==="ok"?"✓":"!"}</span><div><b>${esc(row.operation||"operacja API")}</b><small>${esc(row.message||"")}</small></div><time>${esc(allegroDataTxt(row.at))}</time></article>`).join("")||`<div class="admin-empty-state compact"><span>🧪</span><div><b>Brak wykonanych testów API</b><small>Pierwszy prawdziwy wynik pojawi się po sprawdzeniu połączenia.</small></div></div>`}</div></section>`;
}
function vonHalskyPrzewinUstawienia(section,button){
  vonHalskyUstawieniaSekcja=String(section||"identity");
  document.querySelectorAll("[data-von-settings-nav]").forEach(item=>item.classList.toggle("active",item===button||item.dataset.vonSettingsNav===vonHalskyUstawieniaSekcja));
  const page=document.querySelector(".von-halsky-settings-page");
  page?.querySelector(".von-halsky-stock-default")?.setAttribute("data-von-settings-section","sync");
  page?.querySelectorAll("[id^='von-halsky-settings-'],[data-von-settings-section]").forEach(item=>item.classList.toggle("von-halsky-setting-visible",item.id===`von-halsky-settings-${vonHalskyUstawieniaSekcja}`||item.dataset.vonSettingsSection===vonHalskyUstawieniaSekcja));
  page?.setAttribute("data-settings-section",vonHalskyUstawieniaSekcja);
}
function widokAdminVonHalsky(sekcja="pulpit"){
  const alias={oferty:"wystawianie",powiazania:"wystawianie"}[sekcja]||sekcja;
  const aktywna=["wystawianie","zamowienia","ustawienia"].includes(alias)?alias:"pulpit";
  if(!vonHalskyStan.loaded&&!vonHalskyStan.loading)setTimeout(()=>vonHalskyLaduj(false),0);
  vonHalskyUruchomOdswiezanieNaZywo();
  const content=aktywna==="wystawianie"?vonHalskyWystawianieHTML():aktywna==="zamowienia"&&typeof vonHalskyOrdersWorkspaceHTML==="function"?vonHalskyOrdersWorkspaceHTML():aktywna==="zamowienia"?vonHalskyZamowieniaHTML():aktywna==="ustawienia"?vonHalskyUstawieniaHTML():typeof vonHalskyDashboardWorkspaceHTML==="function"?vonHalskyDashboardWorkspaceHTML():vonHalskyPulpitHTML();
  if(aktywna==="ustawienia")setTimeout(()=>vonHalskyPrzewinUstawienia(vonHalskyUstawieniaSekcja),0);
  return adminSzkielet("/admin/von-halsky",`<div class="module-page-stack von-halsky-module-page">${vonHalskySubnavHTML(aktywna)}${aktywna==="zamowienia"&&typeof adminKanalyZamowienHTML==="function"?adminKanalyZamowienHTML("von-halsky"):""}${aktywna==="zamowienia"?"":vonHalskyNaglowekHTML(aktywna)}${vonHalskyStan.error?`<div class="backend-note error"><b>Von Halsky:</b> ${esc(vonHalskyStan.error)}</div>`:""}${content}</div>`);
}

function vonHalskyUstawieniaHTML(){
  const settings=vonHalskyStan.settings,onboarding=settings.onboarding||{},config=vonHalskyStan.config||{},busy=!!vonHalskyStan.operation;
  const stages=[
    ["Dane dostępowe",config.credentialsConfigured,"Client ID, Client Secret, Merchant ID i adres autoryzacji"],
    ["Kontrakt endpointów",config.contractConfigured,"Ścieżki testu, katalogu i zamówień z prywatnej dokumentacji"],
    ["Kanał zdarzeń API",config.eventFeedConfigured,"Oficjalne dzienniki zdarzeń ofert i zamówień są pobierane przez pracownika serwerowego"],
    ["Test rzeczywisty",vonHalskyStan.sync?.status==="connected",vonHalskyStan.sync?.lastConnectionAt?`Ostatnio: ${allegroDataTxt(vonHalskyStan.sync.lastConnectionAt)}`:"Nie wykonano poprawnego testu"]
  ];
  const missingCredentials=config.missingCredentialsEnv||[],missingContract=config.missingContractEnv||[];
  return `<div class="von-halsky-settings-page"><section class="panel von-halsky-settings"><div class="order-section-head von-halsky-settings-head"><div><span class="order-pro-label">Bezpośrednie API</span><h2>Połączenie InPost Von Halsky</h2><p class="order-detail-lead">Ustawienia biznesowe są oddzielone od sekretów i prywatnego kontraktu przechowywanego wyłącznie na serwerze.</p></div><div class="von-halsky-connection-actions"><span class="lvl ${vonHalskyStan.sync?.status==="connected"?"lvl-ok":config.configured?"lvl-info":"lvl-ostrzezenie"}">${esc(vonHalskyPolaczenieEtykieta())}</span><button class="btn ghost" type="button" ${busy||!config.configured?"disabled":""} onclick="vonHalskySprawdzPolaczenie()">${vonHalskyStan.operation==="connection"?"Sprawdzam…":"Sprawdź połączenie API"}</button></div></div>
    <div class="von-halsky-api-readiness">${stages.map(([title,ready,desc])=>`<article class="${ready?"ready":"pending"}"><span>${ready?"✓":"•"}</span><div><b>${esc(title)}</b><small>${esc(desc)}</small></div><em>${ready?"gotowe":"oczekuje"}</em></article>`).join("")}</div>
    <nav class="von-halsky-settings-index" aria-label="Sekcje ustawień">${[["identity","Tożsamość"],["sync","Synchronizacja"],["agent","Agent"],["policy","Polityka danych"],["contract","Kontrakt API"],["onboarding","Onboarding"],["diagnostics","Diagnostyka"]].map(([id,label])=>`<button type="button" data-von-settings-nav="${id}" class="${vonHalskyUstawieniaSekcja===id?"active":""}" onclick="vonHalskyPrzewinUstawienia(${jsArg(id)},this)">${label}</button>`).join("")}</nav>
    <form onsubmit="vonHalskyZapiszUstawienia(event)" oninput="vonHalskyUstawieniaBrudne(this)" onchange="vonHalskyUstawieniaBrudne(this)">
      <div class="von-halsky-settings-layout"><main>
        <section class="von-halsky-setting-card von-halsky-stock-default"><header><span>↻</span><div><small>Wystawienie i SOLDOUT</small><h3>Domyślna ilość przy wznowieniu</h3></div></header><div class="von-halsky-settings-grid"><label>Domyślny stan oferty<input name="defaultStock" type="number" min="0" max="99999" value="${esc(settings.defaultStock??settings.minimumStock??1)}"><small>Używany, gdy kartoteka nie ma dodatniego stanu. Dodatni stan magazynu nadal ogranicza ilość.</small></label></div><div class="backend-note"><b>Oferta SOLDOUT wraca przez aktualizację stanu.</b><span>To właściwy mechanizm API Von Halsky; nie używamy dla niej polecenia „reopen”.</span></div></section>
        <section class="von-halsky-setting-card" id="von-halsky-settings-identity"><header><span>01</span><div><small>Tożsamość kanału</small><h3>Sklep i powiadomienia</h3></div></header><div class="von-halsky-settings-grid"><label>Nazwa sklepu w Portalu Merchanta<input name="merchantStoreName" value="${esc(settings.merchantStoreName||"Artway-TM")}" required></label><label>Alias zamówień<input name="channelAlias" maxlength="2" pattern="[A-Za-z0-9]{2}" value="${esc(settings.channelAlias||"VH")}" required><small>Dokładnie 2 litery lub cyfry.</small></label><label>E-mail powiadomień<input name="notificationEmail" type="email" value="${esc(settings.notificationEmail||"")}"></label></div></section>
        <section class="von-halsky-setting-card" id="von-halsky-settings-sync"><header><span>02</span><div><small>Synchronizacja</small><h3>Częstotliwość i prezentowany stan</h3></div></header><div class="von-halsky-settings-grid"><label>Synchronizacja istniejących ofert<select name="syncIntervalMinutes">${[15,30,60,180,360,720,1440].map(value=>`<option value="${value}" ${Number(settings.syncIntervalMinutes)===value?"selected":""}>${value<60?value+" min":value/60+" godz."}</option>`).join("")}</select></label><label>Minimalny stan kanału<input name="minimumStock" type="number" min="0" max="99999" value="${esc(settings.minimumStock)}"><small>Pokazywany przy aktywnej sprzedaży.</small></label><label>Maksymalny stan pokazywany<input name="maximumStock" type="number" min="1" max="99999" value="${esc(settings.maximumStock)}"><small>Chroni rzeczywisty stan magazynu.</small></label></div><div class="von-halsky-switches"><label><input type="checkbox" name="automaticPriceSync" ${settings.automaticPriceSync?"checked":""}><span><b>Ceny istniejących ofert</b><small>Aktualizuj z kartoteki Artway-TM.</small></span></label><label><input type="checkbox" name="automaticStockSync" ${settings.automaticStockSync?"checked":""}><span><b>Stany istniejących ofert</b><small>Synchronizuj dostępność i ilości.</small></span></label><label><input type="checkbox" name="automaticResume" ${settings.automaticResume?"checked":""}><span><b>Automatyczne wznowienie</b><small>Po powrocie dostępności produktu.</small></span></label><label><input type="checkbox" name="customerZone" ${settings.customerZone?"checked":""}><span><b>Strefa klienta</b><small>Pokazuj odnośnik w obsłudze zamówienia.</small></span></label></div></section>
        <section class="von-halsky-setting-card" id="von-halsky-settings-agent"><header><span>AI</span><div><small>Bezpieczna automatyzacja</small><h3>Agent przygotowania ofert</h3></div><span class="lvl ${settings.agentPreparationEnabled?"lvl-ok":"lvl-ostrzezenie"}">${settings.agentPreparationEnabled?"aktywny":"wyłączony"}</span></header><div class="von-halsky-switches"><label><input type="checkbox" name="agentPreparationEnabled" ${settings.agentPreparationEnabled?"checked":""}><span><b>Przygotowanie treści i danych</b><small>Agent zapisuje wynik bezpośrednio w centralnej kartotece produktu.</small></span></label><label><input type="checkbox" name="agentCategoryAutoMatchEnabled" ${settings.agentCategoryAutoMatchEnabled?"checked":""}><span><b>Bezpieczne dopasowanie kategorii</b><small>Automatyczny zapis tylko po przekroczeniu progu i przewagi nad drugim wynikiem.</small></span></label><label><input type="checkbox" name="agentAttributeAutoMatchEnabled" ${settings.agentAttributeAutoMatchEnabled?"checked":""}><span><b>Dokładne mapowanie parametrów</b><small>Wyłącznie identyczna nazwa i dozwolona wartość — bez zgadywania.</small></span></label></div><div class="von-halsky-agent-threshold"><label>Minimalna pewność kategorii<input name="agentMinimumConfidence" type="number" min="55" max="99" step="1" value="${Math.round(Number(settings.agentMinimumConfidence||.82)*100)}"><small>Domyślnie 82%. Niższy wynik pozostaje propozycją do kontroli.</small></label><div><b>Granica odpowiedzialności</b><span>Agent może przygotować i trwale zapisać kartotekę. Publikacja nowej oferty zawsze wymaga zaznaczenia przez administratora.</span></div></div></section>
        <section class="von-halsky-setting-card von-halsky-data-policy" id="von-halsky-settings-policy"><header><span>03</span><div><small>Zasady kartoteki</small><h3>Źródła i priorytety danych</h3></div></header><div class="von-halsky-policy-grid"><article><span>Identyfikacja</span><b>EAN/GTIN → kod + marka</b><small>Nazwa produktu nigdy nie tworzy samodzielnie powiązania.</small></article><article><span>Treść oferty</span><b>Kartoteka Artway-TM</b><small>Własna wersja Von Halsky może świadomie nadpisać treść sklepu.</small></article><article><span>Cena kanału</span><b>Von Halsky → Allegro → sklep</b><small>Własna cena kanału ma pierwszeństwo, dalej działa kontrolowany fallback.</small></article><article><span>Nowe oferty</span><b>Wyłącznie ręczny wybór</b><small>Automatyka aktualizuje istniejące oferty, ale nie tworzy nowych bez decyzji.</small></article><article><span>Dostępność</span><b>Jedna decyzja sprzedażowa</b><small>Ukrycie w kartotece przekazuje do kanału stan zero i zamknięcie oferty.</small></article><article><span>Powiązanie API</span><b>Tylko potwierdzenie serwera</b><small>ID oferty zapisuje odpowiedź Von Halsky, nie ręcznie wpisany tekst.</small></article></div></section>
        <section class="von-halsky-setting-card von-halsky-contract-card" id="von-halsky-settings-contract"><header><span>04</span><div><small>Kontrakt techniczny</small><h3>Status konfiguracji serwera</h3></div><span class="lvl ${config.configured?"lvl-ok":"lvl-ostrzezenie"}">${config.configured?"kompletny":"wymaga danych"}</span></header><div class="von-halsky-contract-facts"><div><small>Środowisko</small><b>${esc(config.environment||"production")}</b></div><div><small>Wersja kontraktu</small><b>${esc(config.contractVersion||"oczekuje")}</b></div><div><small>Zdarzenia</small><b>${config.eventFeedConfigured?"aktywne przez API":"oczekują na API"}</b></div><div><small>Ostatni test</small><b>${esc(vonHalskyStan.sync?.lastConnectionAt?allegroDataTxt(vonHalskyStan.sync.lastConnectionAt):"nie wykonano")}</b></div></div>${config.configured?`<div class="backend-note success"><b>Kontrakt jest kompletny</b><span>Zgodnie z kontraktem 1.5.8 zdarzenia są pobierane z dzienników API i potwierdzane odczytem katalogu. Nie jest wymagany sekret webhooka.</span></div>`:missingCredentials.length||missingContract.length?`<div class="von-halsky-missing-contract"><b>Brakujące elementy</b><div>${[...missingCredentials,...missingContract].map(item=>`<code>${esc(item)}</code>`).join("")}</div></div>`:`<div class="backend-note warning"><b>Dane API oczekują na import</b><span>Po zalogowaniu do Portalu Merchanta uzupełnimy prywatny kontrakt bez ujawniania sekretów w przeglądarce.</span></div>`}</section>
      </main><aside>
        <section class="von-halsky-setting-card von-halsky-manual-policy" data-von-settings-section="policy"><header><span>✓</span><div><small>Publikacja nowych ofert</small><h3>Decyzja ręczna</h3></div></header><p>Każdy gotowy produkt może zostać wystawiony. Nowa oferta powstaje dopiero po zaznaczeniu jej w podstronie Wystawianie.</p><ul><li>brak limitu jednego kodu testowego</li><li>brak automatycznego tworzenia nowych ofert</li><li>automatyczne aktualizacje tylko istniejących ofert</li></ul><a class="btn" href="#/admin/von-halsky/wystawianie">Przejdź do wystawiania</a></section>
        <section class="von-halsky-setting-card" id="von-halsky-settings-onboarding"><header><span>05</span><div><small>Uruchomienie kanału</small><h3>Lista kontrolna</h3></div></header><div class="von-halsky-onboarding-checklist">${vonHalskyEtapy().map(step=>`<label><input type="checkbox" name="onboarding.${step.id}" ${onboarding[step.id]?"checked":""}><span><b>${esc(step.title)}</b><small>${esc(step.desc)}</small></span></label>`).join("")}</div></section>
        <section class="von-halsky-setting-card" data-von-settings-section="onboarding"><header><span>06</span><div><small>Kontrola przed publikacją</small><h3>Podgląd pakietu</h3></div></header><div class="von-halsky-package-preview">${vonHalskyStan.preview?`<div><strong>${Number(vonHalskyStan.preview.eligible)||0}</strong><small>gotowych</small></div><div><strong>${Number(vonHalskyStan.preview.blocked)||0}</strong><small>zablokowanych</small></div><div><strong>${Number(vonHalskyStan.preview.duplicates)||0}</strong><small>duplikatów</small></div>`:`<p>Kontrola analizuje katalog bez wysyłania danych.</p>`}</div><button class="btn ghost" type="button" ${busy?"disabled":""} onclick="vonHalskySprawdzPakiet()">${vonHalskyStan.operation==="preview"?"Analizuję…":"Sprawdź pakiet bez wysyłania"}</button></section>
      </aside></div>
      <div class="von-halsky-settings-footer"><div><b data-save-state>Wszystkie ustawienia zapisane</b><small>Zmiany dotyczą polityki kanału, nie sekretów API.</small></div><button class="btn" type="submit">Zapisz ustawienia</button><a class="btn ghost" href="https://inpost.pl/aktualnosci-inpost-von-halsky-integracja" target="_blank" rel="noopener">Dokumentacja InPost ↗</a></div>
    </form>
  </section><div id="von-halsky-settings-diagnostics">${vonHalskyDiagnostykaHTML()}</div></div>`;
}
function vonHalskyAktualizujUstawieniaDOM(){
  const current=document.querySelector(".von-halsky-settings-page");
  if(!current)return false;
  if(typeof vonHalskyPodmienWyspe==="function")vonHalskyPodmienWyspe("[data-vh-channel-header]",vonHalskyNaglowekHTML("ustawienia"));
  const template=document.createElement("template");template.innerHTML=vonHalskyUstawieniaHTML().trim();
  const next=template.content.firstElementChild;if(!next)return false;
  current.replaceWith(next);
  vonHalskyPrzewinUstawienia(vonHalskyUstawieniaSekcja);
  return true;
}

function vonHalskyStatystyki(){
  if(vonHalskyStan.productQueue.loaded){
    const summary=vonHalskyStan.productQueue.summary||{},orders=vonHalskyStan.dashboard?.orders||{},truth=vonHalskyStan.truth||{};
    return {wszystkie:Number(summary.total)||0,gotowe:Number(summary.publishable)||0,braki:Number(summary.missing)||0,ean:0,aktywne:Number(truth.published)||0,zdalneRazem:Number(truth.total)||0,zdalneOczekuje:Number(truth.pending)||0,zdalneBledyWeryfikacji:Number(truth.verificationErrors)||0,zdalneOdrzucone:Number(truth.rejected)||0,zdalneProblemy:Number(truth.problems)||0,zdalneWstrzymane:Number(truth.closed)||0,lokalnieAktywne:Number(summary.selling)||0,publikowanie:Number(summary.publishing)||0,doWystawienia:Number(summary.publishable)||0,doPrzygotowania:Number(summary.preparation)||0,doAktualizacji:Number(summary.update_required)||0,doDzialania:(Number(summary.publishable)||0)+(Number(summary.preparation)||0)+(Number(summary.update_required)||0),wstrzymane:Number(summary.paused)||0,noweZamowienia:Number(orders.active)||0};
  }
  const products=vonHalskyProdukty(),rows=products.map(product=>vonHalskyOcenaProduktu(product));
  const orders=Array.isArray(vonHalskyStan.orders)?vonHalskyStan.orders:[];
  const stages=products.map((product,index)=>vonHalskyEtapOferty(product,rows[index]));
  const truth=vonHalskyStan.truth||{};
  return {wszystkie:rows.length,gotowe:rows.filter(x=>x.gotowy).length,braki:rows.filter(x=>!x.gotowy).length,ean:rows.filter(x=>x.ean).length,aktywne:Number(truth.published)||0,zdalneRazem:Number(truth.total)||0,zdalneOczekuje:Number(truth.pending)||0,zdalneBledyWeryfikacji:Number(truth.verificationErrors)||0,zdalneOdrzucone:Number(truth.rejected)||0,zdalneProblemy:Number(truth.problems)||0,zdalneWstrzymane:Number(truth.closed)||0,lokalnieAktywne:rows.filter(x=>String(x.offerStatus).toUpperCase()==="PUBLISHED"&&x.offerVerified).length,publikowanie:stages.filter(x=>x==="publikowanie").length,doWystawienia:stages.filter(x=>x==="wystawienie").length,doPrzygotowania:stages.filter(x=>x==="przygotowanie").length,doAktualizacji:stages.filter(x=>x==="aktualizacja").length,doDzialania:stages.filter(x=>["wystawienie","przygotowanie","aktualizacja"].includes(x)).length,wstrzymane:rows.filter(x=>!x.dostepny).length,noweZamowienia:orders.filter(order=>["CREATED","NEW","PAID"].includes(String(order.status||"").toUpperCase())).length};
}
function vonHalskyEtapySprzedazyHTML(){
  const summary=vonHalskyStan.productQueue?.summary||{},counts=vonHalskyStan.productQueue?.loaded?{wszystkie:Number(summary.total)||0,sprzedaz:Number(summary.selling)||0,publikowanie:Number(summary.publishing)||0,wystawienie:Number(summary.publishable)||0,przygotowanie:Number(summary.preparation)||0,aktualizacja:Number(summary.update_required)||0,wyprzedane:Number(summary.sold_out)||0,wstrzymane:Number(summary.paused)||0}:{wszystkie:0,sprzedaz:0,publikowanie:0,wystawienie:0,przygotowanie:0,aktualizacja:0,wyprzedane:0,wstrzymane:0};
  if(!vonHalskyStan.productQueue?.loaded)for(const product of vonHalskyProdukty()){const quality=vonHalskyOcenaProduktu(product);counts.wszystkie+=1;counts[vonHalskyEtapOferty(product,quality)]+=1;}
  const items=[["wszystkie","▦","Wszystkie"],["sprzedaz","✓","W sprzedaży"],["publikowanie","…","W publikacji"],["wystawienie","＋","Do wystawienia"],["przygotowanie","⚠","Do przygotowania"],["aktualizacja","↻","Do aktualizacji"],["wyprzedane","×","Wyprzedane"],["wstrzymane","⏸","Wstrzymane"]].map(([value,icon,label])=>({value,icon,label,count:counts[value]||0}));
  return adminKanalEtapyHTML({id:"vonHalskyStageTitle",accent:"von-halsky",title:"Etap przygotowania kartotek",description:"Stan ofert sprzedawanych pokazuje osobny pasek API powyżej.",active:vonHalskyEtap,items,onSelect:"vonHalskyUstawEtap",dataAttribute:"data-vh-stage-filters",ariaLabel:"Filtry etapów kartotek Artway"});
}
function vonHalskyUstawEtap(value){vonHalskyEtap=value;vonHalskyZmienFiltr();}
function vonHalskyKanalPrawdyHTML(){
  const truth=vonHalskyStan.truth||{},status=vonHalskyStan.channelStatus||{};
  const verifiedAt=status.verifiedAt||vonHalskyStan.sync?.lastCatalogVerifiedAt||vonHalskyStan.sync?.lastCatalogAt;
  const pendingCommands=Number(status.operations?.pendingCommands??vonHalskyStan.sync?.pendingCommandCount??0)||0;
  const consistent=status.consistent!==false;
  return adminKanalStanApiHTML({channel:"InPost Von Halsky",accent:"von-halsky",connected:consistent,consistent,verifiedAt:verifiedAt?allegroDataTxt(verifiedAt):"",dataAttribute:"data-vh-channel-truth",metrics:[
    {label:"Po stronie API",value:Number(truth.total)||0,detail:"wszystkie oferty i stany z kanału"},
    {label:"W sprzedaży",value:Number(truth.published)||0,detail:"wyłącznie PUBLISHED",tone:"success"},
    {label:"Prawidłowo oczekują",value:Number(truth.pending)||0,detail:"PENDING / PROCESSING bez błędu",tone:"pending"},
    {label:"Błąd weryfikacji",value:Number(truth.verificationErrors)||0,detail:"oferta istnieje — popraw dane",tone:"danger"},
    {label:"Odrzucone",value:Number(truth.rejected)||0,detail:"REJECTED / ERROR",tone:"danger"},
    {label:"Wyprzedane",value:Number(truth.soldout)||0,detail:"SOLDOUT — wznów stanem",tone:"pending"},
    {label:"Polecenia oczekujące",value:pendingCommands,detail:"osobno od liczby ofert"},
  ]});
}

function vonHalskySygnaturaProcesu(){
  const queue=vonHalskyStan.preparationQueue||{},runtime=vonHalskyStan.agentRuntime||{},active=queue.active||{},recent=Array.isArray(queue.recent)?queue.recent:[],work=runtime.currentWork||{},publication=runtime.publication||{};
  const truth=vonHalskyStan.truth||{};
  return [
    active.id,active.productId,queue.pending,
    recent[0]?.id,recent[0]?.status,recent[0]?.completedAt,
    work.id,work.status,work.phase,work.updatedAt,
    publication.counts?.pending,publication.counts?.attention,publication.counts?.waitingProvider,
    truth.total,truth.published,truth.pending,truth.rejected,truth.closed,
  ].join("|");
}
async function vonHalskyPobierzStanProcesow(){
  const [queueData,runtimeData]=await Promise.all([
    chmura("allegro-preparation-queue-status",{timeout:20000}),
    chmura("agent-runtime-status",{timeout:20000}),
  ]);
  vonHalskyStan.preparationQueue=queueData?.queue||vonHalskyStan.preparationQueue;
  vonHalskyStan.agentRuntime=runtimeData?.runtime||vonHalskyStan.agentRuntime;
  return {queue:vonHalskyStan.preparationQueue,runtime:vonHalskyStan.agentRuntime};
}
function vonHalskyPodmienWyspe(selector,html){
  const current=document.querySelector(selector);
  const active=document.activeElement,editing=active?.closest?.(selector)&&(
    /^(SELECT|TEXTAREA)$/.test(active.tagName)
    || (active.tagName==="INPUT"&&!["checkbox","radio","button"].includes(String(active.type||"text").toLowerCase()))
  );
  if(!current||editing)return false;
  const template=document.createElement("template");
  template.innerHTML=String(html||"").trim();
  const next=template.content.firstElementChild;
  if(!next)return false;
  const scrollX=window.scrollX,scrollY=window.scrollY;
  current.replaceWith(next);
  requestAnimationFrame(()=>window.scrollTo(scrollX,scrollY));
  return true;
}
function vonHalskyAktualizujWystawianieDOM({results=true,stages=true,truth=true}={}){
  if(!String(trasa()).startsWith("/admin/von-halsky/wystawianie"))return false;
  vonHalskyAktualizujPostepDOM();
  const headerChanged=vonHalskyPodmienWyspe("[data-vh-channel-header]",vonHalskyNaglowekHTML("wystawianie"));
  const subnavChanged=vonHalskyPodmienWyspe('nav[aria-label="Podsekcje panelu"]',vonHalskySubnavHTML("wystawianie"));
  const filtersChanged=results&&vonHalskyPodmienWyspe('[data-admin-search-panel="von-halsky-products"]',vonHalskyFiltryHTML(vonHalskyWiersze()));
  if(results)vonHalskyAktualizujPodsumowanieFiltrowDOM();
  const truthChanged=truth&&vonHalskyPodmienWyspe("[data-vh-channel-truth]",vonHalskyKanalPrawdyHTML());
  const stagesChanged=stages&&vonHalskyPodmienWyspe("[data-vh-stage-filters]",vonHalskyEtapySprzedazyHTML());
  const resultsChanged=results&&vonHalskyPodmienWyspe("[data-vh-results-region]",vonHalskyWynikiHTML());
  if(results)vonHalskyAktualizujCheckboxStrony();
  return headerChanged||subnavChanged||filtersChanged||truthChanged||stagesChanged||resultsChanged;
}
async function vonHalskyPobierzLekkiStatus(){
  const data=await chmura("von-halsky-status",{timeout:15000});
  const revision=String(data.sync?.reconciliationRevision||data.sync?.lastCatalogVerifiedAt||data.updatedAt||"");
  const revisionChanged=Boolean(revision&&revision!==vonHalskyOstatniaRewizjaKanalu);
  if(data.sync)vonHalskyStan.sync={...vonHalskyStan.sync,...data.sync};
  if(data.truth)vonHalskyStan.truth=data.truth;
  if(data.channelStatus)vonHalskyStan.channelStatus=data.channelStatus;
  if(data.config)vonHalskyStan.config=data.config;
  let visibleProductsChanged=false;
  if(revisionChanged){
    vonHalskyUniewaznijWidokProduktow();
    const changedIds=[...new Set((data.sync?.lastChangedProductIds||[]).map(String).filter(Boolean))];
    if(String(trasa()).startsWith("/admin/von-halsky/wystawianie")){
      // Zmiana rewizji oznacza realną mutację, nie kolejny odczyt czasu.
      // Jeden odczyt kolejki odświeża stronę, liczniki i właściwy filtr.
      vonHalskyStan.productQueue.queryKey="";
      await vonHalskyPobierzKolejkeProduktow({force:true});
      visibleProductsChanged=changedIds.length>0;
    }
    vonHalskyOstatniaRewizjaKanalu=revision;
  }
  return {...data,revisionChanged,visibleProductsChanged};
}
function vonHalskyNastepnyInterwal(){
  if(document.hidden)return 60000;
  const queue=vonHalskyStan.preparationQueue||{},work=vonHalskyStan.agentRuntime?.currentWork||{};
  return queue.running||queue.active||work.status==="running"?15000:60000;
}
function vonHalskyUruchomOdswiezanieNaZywo(){
  if(vonHalskyLiveTimer)return;
  const tick=async()=>{
    vonHalskyLiveTimer=null;
    try{
      if(!String(trasa()).startsWith("/admin/von-halsky")||document.hidden||vonHalskyStan.loading||vonHalskyOdswiezenieWToku)return;
      vonHalskyOdswiezenieWToku=true;
      const previousCompletion=String(vonHalskyStan.preparationQueue?.recent?.[0]?.completedAt||"");
      await vonHalskyPobierzStanProcesow();
      const signature=vonHalskySygnaturaProcesu(),changed=signature!==vonHalskyProcesSygnatura;
      if(changed){
        const queue=vonHalskyStan.preparationQueue||{},completion=String(queue.recent?.[0]?.completedAt||"");
        const completedNow=Boolean(completion&&completion!==previousCompletion);
        const ids=completedNow?[queue.recent?.[0]?.productId].filter(Boolean):[];
        if(completedNow&&ids.length){
          const catalog=await chmura("product-catalog-query",{params:{audience:"admin",ids:[...new Set(ids)].join(","),page:1,limit:50},timeout:30000});
          vonHalskyZastosujAktualizacjeProduktow((catalog?.items||[]).map(product=>({productId:product.id,product})));
          vonHalskyAktualizujWystawianieDOM();
        }else{
          // Postęp procesu zmienia się często. Aktualizujemy tylko jego mały
          // panel, aby tabela, filtry, zaznaczenie i przewinięcie nie skakały.
          vonHalskyAktualizujWystawianieDOM({results:false,stages:false,truth:false});
        }
        vonHalskyProcesSygnatura=signature;
      }
      if(Date.now()-vonHalskyOstatniOdczytKanalu>=60000){
        vonHalskyOstatniOdczytKanalu=Date.now();
        const status=await vonHalskyPobierzLekkiStatus();
        vonHalskyAktualizujWystawianieDOM({
          results:status.revisionChanged===true,
          stages:status.revisionChanged===true,
          truth:true,
        });
      }
    }catch(error){console.warn("von_halsky_live_refresh",error);}
    finally{
      vonHalskyOdswiezenieWToku=false;
      if(!vonHalskyLiveTimer)vonHalskyLiveTimer=setTimeout(tick,vonHalskyNastepnyInterwal());
    }
  };
  vonHalskyLiveTimer=setTimeout(tick,15000);
}

function vonHalskyNazwyZapisanychPol(fields=[]){
  const labels={
    vonHalskyTitle:"nazwa kanału",vonHalskyShortDescription:"opis krótki",vonHalskyDescription:"opis pełny",
    vonHalskyCategoryId:"kategoria",vonHalskyCategoryPath:"ścieżka kategorii",vonHalskyAttributes:"parametry",
    vonHalskyResponsibleProducer:"GPSR",vonHalskyResponsibleProducerStatus:"status GPSR",
    zdjecie:"zdjęcie główne",zdjecia:"galeria",contentEditorial:"stan redakcji",
  };
  return [...new Set((Array.isArray(fields)?fields:[]).map(field=>labels[field]||String(field||"").replace(/^vonHalsky/,"")).filter(Boolean))];
}
function vonHalskyZrodloKategorii(source=""){
  return source==="accepted_catalog_consensus"?"zaakceptowane podobne oferty":source==="api_tree_semantic"?"pełne drzewo API":source==="admin-current-api-tree"?"wybór administratora":"kartoteka produktu";
}
function vonHalskyStatusProcesu(status=""){
  return ({
    running:{label:"Wykonywane teraz",cls:"running"},
    pending:{label:"Przekazane do API",cls:"pending"},
    waiting_provider:{label:"Przetwarzane przez API",cls:"pending"},
    attention:{label:"Wymaga uzupełnienia",cls:"attention"},
    decision_required:{label:"Wymaga decyzji",cls:"attention"},
    failed:{label:"Błąd przygotowania",cls:"error"},
    retry:{label:"Zaplanowano ponowienie",cls:"attention"},
    completed:{label:"Zapis potwierdzony",cls:"success"},
    confirmed:{label:"Potwierdzone",cls:"success"},
  })[String(status||"").toLowerCase()]||{label:"Stan roboczy",cls:"pending"};
}
function vonHalskyGrupujProby(items=[]){
  const unique=new Map(),groups=new Map();
  for(const item of Array.isArray(items)?items:[]){
    const id=String(item?.id||`${item?.productId||""}:${item?.status||""}:${item?.updatedAt||item?.completedAt||item?.at||""}`);
    if(!unique.has(id))unique.set(id,item);
  }
  for(const item of unique.values()){
    const key=String(item?.productId||item?.productName||item?.name||item?.id||"operacja");
    const current=groups.get(key);
    const itemAt=Date.parse(String(item?.updatedAt||item?.completedAt||item?.at||""))||0;
    const currentAt=Date.parse(String(current?.updatedAt||current?.completedAt||current?.at||""))||0;
    if(!current||itemAt>=currentAt)groups.set(key,{...item,attempts:(current?.attempts||0)+1});
    else current.attempts=(current.attempts||1)+1;
  }
  return [...groups.values()];
}
function vonHalskyProcesAktywny(){
  const queue=vonHalskyStan.preparationQueue||{},runtime=vonHalskyStan.agentRuntime||{};
  const publication=Array.isArray(runtime.publication?.pending)?runtime.publication.pending:[];
  const currentWork=runtime.currentWork||{};
  return Boolean(queue.running||queue.active||(currentWork.channel==="vonHalsky"&&currentWork.status==="running")||publication.some(item=>item?.channel==="vonHalsky"&&["running","pending","waiting_provider"].includes(String(item?.status||""))));
}
function vonHalskyPanelProcesuHTML(){
  const queue=vonHalskyStan.preparationQueue||{},paused=queue.paused===true,active=vonHalskyProcesAktywny(),pending=Math.max(0,Number(queue.pending)||0);
  return `<details class="von-halsky-process-drawer" data-vh-process-drawer ${active||paused?"open":""}><summary data-vh-process-summary><span>${paused?"Ⅱ":active?"⟳":"✓"}</span><div><b>Proces przygotowania i historia</b><small>${paused?`Kolejka wstrzymana • ${pending} zadań oczekuje`:active?`Serwer pracuje • ${pending} zadań w kolejce`:"Brak aktywnej pracy • rozwiń, aby zobaczyć ostatnie wyniki"}</small></div><em>${paused?"wstrzymane":active?"wykonywane":"gotowe"}</em></summary><div class="von-halsky-process-drawer-body"><div class="von-halsky-offer-flow" aria-label="Proces wystawiania"><div><span>1</span><b>Dopasuj</b><small>EAN lub kod + marka</small></div><i>›</i><div><span>2</span><b>Uzupełnij</b><small>Treść, zdjęcia i kategorię</small></div><i>›</i><div><span>3</span><b>Sprawdź</b><small>Podgląd i kontrola jakości</small></div><i>›</i><div><span>4</span><b>Opublikuj</b><small>Wyłącznie zaznaczone</small></div></div>${vonHalskyPostepPrzygotowaniaHTML()}</div></details>`;
}
function vonHalskyPostepPrzygotowaniaHTML(){
  const queue=vonHalskyStan.preparationQueue||{},runtime=vonHalskyStan.agentRuntime||{},summary=queue.currentSummary||{};
  const batches=Array.isArray(queue.batches)?queue.batches:[],activeTask=queue.active||null;
  const tracked=batches.find(item=>item.id===activeTask?.batchId)||(vonHalskyStan.preparationBatchId?batches.find(item=>item.id===vonHalskyStan.preparationBatchId):null)||batches.find(item=>Number(item.pending||0)>0||Number(item.running||0)>0)||batches[0]||null;
  const pending=Math.max(0,Number(tracked?.pending??queue.pending)||0),previousPending=Math.max(0,(Number(queue.pending)||0)-pending),running=activeTask?1:Math.max(0,Number(tracked?.running)||0);
  const completed=Math.max(0,Number(tracked?.completed??summary.completed)||0),attention=Math.max(0,Number(tracked?.attention??summary.attention)||0),waiting=Math.max(0,Number(tracked?.waitingProvider??summary.waitingProvider)||0),decisions=Math.max(0,Number(tracked?.decisionRequired??summary.decisionRequired)||0),errors=Math.max(0,Number(tracked?.failed??summary.failed)||0);
  const reportedPublicationItems=vonHalskyGrupujProby([
    ...(runtime.currentWork?.channel==="vonHalsky"?[runtime.currentWork]:[]),
    ...((runtime.publication?.pending||[]).filter(item=>item.channel==="vonHalsky")),
  ].filter(item=>["running","pending","waiting_provider"].includes(String(item?.status||""))));
  const verifiedPublishingCount=Math.max(0,Number(vonHalskyStan.truth?.pending)||0)
    +Math.max(0,Number(vonHalskyStan.channelStatus?.operations?.pendingCommands??vonHalskyStan.sync?.pendingCommandCount)||0);
  const publicationItems=reportedPublicationItems.slice(0,verifiedPublishingCount);
  const publishing=publicationItems.length;
  const total=Math.max(0,Number(tracked?.total)||pending+running+completed+attention+waiting+decisions+errors);
  const cancelled=Math.max(0,Number(tracked?.cancelled??summary.cancelled)||0),paused=queue.paused===true;
  const done=completed+attention+waiting+decisions+errors+cancelled,started=Boolean(total||queue.running||publishing||activeTask||paused),active=Boolean(!paused&&(queue.running||publishing||activeTask));
  const percent=total?Math.min(100,Math.round(done/total*100)):publishing?70:0;
  const queueResults=(Array.isArray(queue.recent)?queue.recent:[]).filter(item=>!tracked||item.batchId===tracked.id);
  const runtimeProblems=(Array.isArray(runtime.publication?.recent)?runtime.publication.recent:[]).filter(item=>item.channel==="vonHalsky"&&["failed","attention","decision_required"].includes(String(item.status)));
  const results=vonHalskyGrupujProby([...queueResults,...runtimeProblems]).slice(0,8);
  const activeProduct=activeTask?{...(vonHalskyProdukty().find(item=>String(item.id)===String(activeTask.productId))||{}),...activeTask}:null;
  const stateClass=paused?"is-paused":active?"is-running":started?(errors?"has-errors":"is-complete"):"is-idle";
  const headline=paused?`Kolejka wstrzymana • ${pending} zadań oczekuje`:activeTask?`Przygotowanie na serwerze • ${done+1} z ${Math.max(total,done+1)}`:publishing?`${publishing} ${publishing===1?"oferta jest":"oferty są"} w publikacji`:started?`Ostatnia partia: ${done} z ${total}`:"Proces jest gotowy";
  const detail=paused?"Nowe zadania nie rozpoczną się do czasu wznowienia. Stan jest zapisany w PostgreSQL.":activeTask?`${activeProduct?.nazwa||activeProduct?.name||activeTask.productId||"Produkt"} • ${String(activeTask.requestedBy||"").includes("codex")?"plan Codex wykonują agenci pomocniczy":"bezpieczny przepływ serwerowy"} • praca trwa niezależnie od tej przeglądarki`:publishing?"API kanału przetwarza wysłane karty. Status zmieni się dopiero po potwierdzeniu zdalnym.":started?`Potwierdzone ${completed} • uwaga ${attention+waiting+decisions} • błędy ${errors}`:"Zaznacz produkty i zleć przygotowanie. Codex koordynuje zadanie, specjaliści uzupełniają treść, a serwer zapisuje każdy wynik w centralnej kartotece.";
  return `<section class="von-halsky-preparation-progress ${stateClass}" data-vh-preparation-progress aria-live="polite">
    <header><div class="von-halsky-preparation-progress-title"><span>${paused?"Ⅱ":active?"⟳":started&&!errors?"✓":started?"!":"▶"}</span><div><small>Trwały proces serwerowy • widoczny na każdym urządzeniu</small><h3>${esc(headline)}</h3><p>${esc(detail)}</p></div></div><strong data-vh-progress-percent>${percent}%</strong></header>
    <div class="von-halsky-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total||100}" aria-valuenow="${done}"><i style="width:${percent}%"></i></div>
    <div class="von-halsky-progress-controls"><span>${paused?"Kolejka PostgreSQL jest trwale wstrzymana.":active?"Kolejka PostgreSQL działa na serwerze — możesz zamknąć tę kartę.":"Ostatni stan pochodzi bezpośrednio z serwera."}</span><div>${paused?`<button class="btn" type="button" onclick="asortymentSterujKolejkaSerwera('resume')">▶ Wznów</button>`:active?`<button class="btn ghost" type="button" onclick="asortymentSterujKolejkaSerwera('pause')">⏸ Wstrzymaj</button>`:""}${previousPending?`<button class="btn danger" type="button" onclick="asortymentSterujKolejkaSerwera('cancel_previous',${jsArg(String(tracked?.id||""))})">⛔ Anuluj wcześniejsze (${previousPending})</button>`:""}${pending?`<button class="btn danger" type="button" onclick="asortymentSterujKolejkaSerwera('cancel',${jsArg(String(tracked?.id||""))})">⛔ Anuluj bieżące (${pending})</button>`:""}<button class="btn ghost" type="button" onclick="vonHalskyOdswiezProces()">↻ Odśwież proces</button><a class="btn ghost" href="#/admin/agent-ai/praca">Agent AI</a></div></div>
    <div class="von-halsky-progress-stages"><div class="${activeTask||started?"active":""}"><span>1</span><b>Codex</b><small>ustala kolejność i kryteria</small></div><div class="${activeTask||started?"active":""}"><span>2</span><b>Agenci pomocniczy</b><small>treść, kategoria, GPSR</small></div><div class="${done?"active":""}"><span>3</span><b>Zapis centralny</b><small>PostgreSQL + odczyt kontrolny</small></div><div class="${publishing?"active manual":""}"><span>4</span><b>Publikacja API</b><small>${publishing?`${publishing} w toku`:"po decyzji administratora"}</small></div></div>
    ${started?`<div class="von-halsky-progress-summary"><span><b>${pending}</b> oczekuje</span><span class="${running?"attention":""}"><b>${running}</b> wykonywane</span><span class="ok"><b>${completed}</b> potwierdzone</span><span class="attention"><b>${attention+waiting+decisions}</b> wymaga danych</span><span class="${errors?"error":""}"><b>${errors}</b> błędów</span>${cancelled?`<span><b>${cancelled}</b> anulowane</span>`:""}<span><b>${publishing}</b> publikowane</span></div>`:""}
    ${activeProduct?`<div class="von-halsky-progress-now"><span>●</span><div><small>Wykonywane teraz na serwerze</small><b>${esc(activeProduct.nazwa||activeProduct.name||activeProduct.productId)}</b><em>pełny przegląd edytora → sklep → Allegro → Von Halsky</em></div><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(activeProduct.productId||activeProduct.id||"")}">Edytor</a></div>`:""}
    ${publicationItems.length?`<div class="von-halsky-progress-publications">${publicationItems.slice(0,6).map(item=>{const status=vonHalskyStatusProcesu(item.status);return `<article class="${status.cls}"><span>↗</span><div><b>${esc(item.productName||item.productId||"Oferta")}</b><small>${esc(item.message||item.phase||"Oczekuje na odpowiedź API")}</small></div><em>${esc(status.label)}</em></article>`;}).join("")}</div>`:""}
    ${results.length?`<div class="von-halsky-progress-results">${results.map(item=>{const fields=vonHalskyNazwyZapisanychPol(item.savedFields),ok=["completed","confirmed"].includes(String(item.status)),status=vonHalskyStatusProcesu(item.status),attempts=Math.max(1,Number(item.attempts)||1);return `<article class="${ok?"saved":"error"}"><span>${ok?"✓":"!"}</span><div><b>${esc(item.name||item.productName||item.productId||"Produkt")}</b><small>${ok?`Zapis centralny potwierdzony${fields.length?` • ${fields.slice(0,6).map(esc).join(", ")}`:""}`:esc(item.error||(item.missing||[]).join(", ")||item.message||"Wymaga danych lub decyzji")}</small><em>${esc(status.label)}${attempts>1?` • ${attempts} próby`:""}</em></div><div class="von-halsky-progress-result-actions">${!ok&&item.productId?`<button class="btn ghost" type="button" onclick="vonHalskyPrzygotujAgentem([${jsArg(String(item.productId))}])">Ponów</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(item.productId||"")}">Edytor</a></div></article>`;}).join("")}</div>`:""}
  </section>`;
}
function vonHalskyAktualizujPostepDOM(){
  const current=document.querySelector("[data-vh-preparation-progress]");
  if(current)current.outerHTML=vonHalskyPostepPrzygotowaniaHTML();
  const summary=document.querySelector("[data-vh-process-summary]");
  if(summary){
    const next=document.createElement("template");
    next.innerHTML=vonHalskyPanelProcesuHTML();
    const nextSummary=next.content.querySelector("[data-vh-process-summary]");
    if(nextSummary)summary.replaceWith(nextSummary);
  }
}
async function vonHalskyOdswiezProces(){
  if(vonHalskyOdswiezenieWToku)return;
  vonHalskyOdswiezenieWToku=true;
  try{
    await vonHalskyPobierzStanProcesow();
    vonHalskyProcesSygnatura=vonHalskySygnaturaProcesu();
    vonHalskyAktualizujPostepDOM();
    toast("Stan procesu odświeżony z serwera ✅");
  }catch(error){toast("Nie pobrano procesu: "+(error?.message||error));}
  finally{vonHalskyOdswiezenieWToku=false;}
}
async function vonHalskyPrzygotujAgentem(productIds=[]){
  const requested=[...new Set((Array.isArray(productIds)?productIds:[productIds]).map(id=>String(id??"").trim()).filter(Boolean))];
  const max=typeof ASORTYMENT_MAX_PRODUKTOW_KOLEJKI==="number"?ASORTYMENT_MAX_PRODUKTOW_KOLEJKI:2000;
  if(requested.length>max){toast(`Zaznaczono ${requested.length} produktów. Jedna kolejka przyjmuje maksymalnie ${max} — niczego nie ucięto ani nie uruchomiono.`);return;}
  const productList=vonHalskyProdukty(),products=new Map(productList.map(product=>[String(product.id),product]));
  const ids=requested.sort((left,right)=>{
    const leftQuality=vonHalskyOcenaProduktu(products.get(left)||{}),rightQuality=vonHalskyOcenaProduktu(products.get(right)||{});
    return leftQuality.wynik-rightQuality.wynik||rightQuality.braki.length-leftQuality.braki.length||String(left).localeCompare(String(right));
  });
  if(!ids.length||vonHalskyStan.operation)return;
  vonHalskyStan.operation="agent";
  vonHalskyAktualizujPostepDOM();
  try{
    const data=await chmura("allegro-preparation-queue-enqueue",{method:"POST",body:{productIds:ids,operation:"product-full-review"},timeout:30000});
    vonHalskyStan.preparationQueue=data?.queue||vonHalskyStan.preparationQueue;
    vonHalskyStan.preparationBatchId=data?.queue?.batchId||data?.batchId||vonHalskyStan.preparationBatchId;
    vonHalskyProcesSygnatura=vonHalskySygnaturaProcesu();
    toast(`Agent zaczyna ${ids.length} ${ids.length===1?"produkt":"produktów"} zaraz po aktualnej kartotece ✅`);
  }catch(error){
    toast("Nie uruchomiono przygotowania: "+(error?.message||error));
  }finally{
    vonHalskyStan.operation="";
    await vonHalskyPobierzStanProcesow().catch(()=>{});
    vonHalskyAktualizujPostepDOM();
  }
}
function vonHalskyPrzygotujWybraneAgentem(){
  return vonHalskyPrzygotujAgentem([...vonHalskyZaznaczone]);
}

const vonHalskyRekordyZaznaczone=new Set();
let vonHalskyRekordyTimer=null;

function vonHalskyDziennyZakres(dni=14){
  const source=new Map((vonHalskyStan.dashboard?.orders?.daily||[]).map(item=>[String(item.day),item]));
  const rows=[];
  for(let index=dni-1;index>=0;index-=1){
    const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-index);
    const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`,item=source.get(key)||{};
    rows.push({key,label:date.toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit"}),weekday:date.toLocaleDateString("pl-PL",{weekday:"short"}),count:Number(item.count)||0,total:Number(item.total)||0});
  }
  return rows;
}
function vonHalskySumaOkresu(dni=7){
  return vonHalskyDziennyZakres(dni).reduce((sum,row)=>sum+row.total,0);
}
async function vonHalskyLadujDashboard(force=false){
  const dashboard=vonHalskyStan.dashboard;
  if(dashboard.loading||(!force&&dashboard.loaded))return;
  dashboard.loading=true;dashboard.error="";
  const current=String(trasa())==="/admin/von-halsky"?document.querySelector("[data-vh-dashboard]"):null;
  current?.classList.add("is-refreshing");current?.setAttribute("aria-busy","true");
  try{
    const data=await chmura("von-halsky-dashboard-summary",{timeout:20000});
    Object.assign(dashboard,{loaded:true,orders:data.orders||dashboard.orders,commands:data.commands||dashboard.commands,rejectionReasons:data.rejectionReasons||[],recent:data.recent||[],updatedAt:data.updatedAt||"",error:""});
    if(data.truth)vonHalskyStan.truth=data.truth;
    if(data.sync)vonHalskyStan.sync={...vonHalskyStan.sync,...data.sync};
    if(data.settings)vonHalskyStan.settings={...vonHalskyStan.settings,...data.settings};
  }catch(error){dashboard.error=String(error?.message||error);}
  dashboard.loading=false;
  if(String(trasa())==="/admin/von-halsky")vonHalskyAktualizujDashboardDOM();
}
function vonHalskyAktualizujDashboardDOM(){
  const current=document.querySelector("[data-vh-dashboard]");
  if(!current)return false;
  const template=document.createElement("template");
  template.innerHTML=vonHalskyDashboardWorkspaceHTML().trim();
  const next=template.content.firstElementChild;
  if(!next)return false;
  const previousHeight=current.getBoundingClientRect().height;
  if(previousHeight>0)current.style.minHeight=`${Math.ceil(previousHeight)}px`;
  current.className=next.className;
  current.setAttribute("aria-busy",next.getAttribute("aria-busy")||"false");
  current.replaceChildren(...next.childNodes);
  requestAnimationFrame(()=>{
    current.style.removeProperty("min-height");
    if(!current.getAttribute("style"))current.removeAttribute("style");
  });
  return true;
}
function vonHalskyAktualizujPulpitDOM({dashboard=true}={}){
  if(String(trasa())!=="/admin/von-halsky")return false;
  const header=typeof vonHalskyPodmienWyspe==="function"&&vonHalskyPodmienWyspe("[data-vh-channel-header]",vonHalskyNaglowekHTML("pulpit"));
  const dashboardChanged=dashboard&&vonHalskyAktualizujDashboardDOM();
  return Boolean(header||dashboardChanged);
}
function vonHalskyDashboardChartHTML(){
  const rows=vonHalskyDziennyZakres(14),max=Math.max(1,...rows.map(row=>row.total));
  return `<section class="panel von-halsky-dashboard-chart"><div class="order-section-head"><div><span class="order-pro-label">Sprzedaż potwierdzona</span><h2>Ostatnie 14 dni</h2><p class="order-detail-lead">Wartości pochodzą z zamówień zapisanych przez API kanału.</p></div><div class="von-halsky-chart-total"><b>${zl(rows.reduce((sum,row)=>sum+row.total,0))}</b><small>${rows.reduce((sum,row)=>sum+row.count,0)} zamówień</small></div></div><div class="von-halsky-sales-chart">${rows.map(row=>`<div title="${esc(row.label)} • ${row.count} zam. • ${esc(zl(row.total))}"><span><i style="height:${Math.max(row.total?4:0,Math.round(row.total/max*100))}%"></i></span><b>${esc(row.weekday)}</b><small>${esc(row.label)}</small></div>`).join("")}</div></section>`;
}
function vonHalskyDashboardWorkspaceHTML(){
  const dashboard=vonHalskyStan.dashboard,truth=vonHalskyStan.truth||{},orders=dashboard.orders||{},sync=vonHalskyStan.sync||{},commands=dashboard.commands||{};
  if(!dashboard.loaded&&!dashboard.loading)setTimeout(()=>vonHalskyLadujDashboard(false),0);
  const last=sync.lastCatalogVerifiedAt||sync.lastCatalogAt,interval=Math.max(15,Number(vonHalskyStan.settings.syncIntervalMinutes)||15);
  const cards=[
    ["✓",Number(truth.published)||0,"W sprzedaży","Potwierdzone PUBLISHED","#/admin/von-halsky/wystawianie","success"],
    ["…",Number(truth.pending)||0,"W publikacji","PENDING / PROCESSING","#/admin/von-halsky/wystawianie","pending"],
    ["!",Number(truth.rejected)||0,"Odrzucone","Wymagają korekty danych","#/admin/von-halsky/wystawianie","danger"],
    ["📦",Number(orders.active)||0,"Do obsługi","Aktywne zamówienia","#/admin/von-halsky/zamowienia",""],
    ["7",zl(vonHalskySumaOkresu(7)),"Sprzedaż 7 dni",`${vonHalskyDziennyZakres(7).reduce((sum,row)=>sum+row.count,0)} zamówień`,"#/admin/von-halsky/zamowienia","money"],
    ["30",zl(vonHalskySumaOkresu(30)),"Sprzedaż 30 dni",`${vonHalskyDziennyZakres(30).reduce((sum,row)=>sum+row.count,0)} zamówień`,"#/admin/von-halsky/zamowienia","money"],
  ];
  const reasons=(dashboard.rejectionReasons||[]).map(item=>`<a href="#/admin/von-halsky/wystawianie" onclick="vonHalskyEtap='aktualizacja';vonHalskyProblem='wszystkie'"><span>!</span><div><b>${esc(item.label)}</b><small>Powód zwrócony przez API</small></div><em>${Number(item.count)||0}</em></a>`).join("");
  const recent=(dashboard.recent||[]).slice(0,8).map(item=>{const data=item.data||{},ok=String(data.status||"").toLowerCase()==="ok"||String(data.status||"").toUpperCase()==="SUCCESS";return `<article class="${ok?"ok":""}"><span>${ok?"✓":"•"}</span><div><b>${esc(data.message||data.type||data.operation||item.kind)}</b><small>${esc(item.kind)} • ${esc(allegroDataTxt(item.updatedAt))}</small></div></article>`;}).join("");
  return `<div class="von-halsky-dashboard-pro${dashboard.loading?" is-refreshing":""}" data-vh-dashboard aria-busy="${dashboard.loading?"true":"false"}">
    ${dashboard.error?`<div class="backend-note warning"><b>Nie pobrano statystyk</b><span>${esc(dashboard.error)}</span><button class="btn ghost" onclick="vonHalskyLadujDashboard(true)">Ponów</button></div>`:""}
    <section class="von-halsky-dashboard-kpis">${cards.map(([icon,value,label,note,href,cls])=>`<a class="${cls}" href="${href}"><span>${icon}</span><div><b>${esc(value)}</b><strong>${esc(label)}</strong><small>${esc(note)}</small></div><em>Otwórz →</em></a>`).join("")}</section>
    <section class="von-halsky-dashboard-main">${vonHalskyDashboardChartHTML()}<aside class="panel von-halsky-sync-health"><div class="order-section-head"><div><span class="order-pro-label">Automatyzacja serwera</span><h2>Kondycja synchronizacji</h2></div><span class="lvl ${sync.status==="connected"?"lvl-ok":"lvl-ostrzezenie"}">${esc(vonHalskyPolaczenieEtykieta())}</span></div><dl><div><dt>Ostatnie uzgodnienie</dt><dd>${esc(last?allegroDataTxt(last):"brak")}</dd></div><div><dt>Tryb</dt><dd>Dzienniki zdarzeń API + kontrola katalogu</dd></div><div><dt>Regularny interwał</dt><dd>${interval} min</dd></div><div><dt>Przy ofertach oczekujących</dt><dd>3 min</dd></div><div><dt>Polecenia oczekujące</dt><dd>${Number(commands.pending)||0}</dd></div></dl><button class="btn ghost" onclick="vonHalskyOdswiezPelnyStatus().then(()=>vonHalskyLadujDashboard(true))">Uzgodnij teraz</button></aside></section>
    <section class="von-halsky-dashboard-columns"><article class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kolejka wyjątków</span><h2>Najczęstsze powody odrzucenia</h2></div><a class="btn ghost" href="#/admin/von-halsky/wystawianie">Pełna lista</a></div><div class="von-halsky-operation-list">${reasons||`<div class="admin-empty-state compact"><span>✓</span><div><b>Brak powodów odrzucenia</b><small>API nie zwróciło aktywnych błędów ofert.</small></div></div>`}</div></article><article class="panel"><div class="order-section-head"><div><span class="order-pro-label">Dziennik kanału</span><h2>Ostatnie operacje</h2></div><button class="btn ghost" onclick="vonHalskyLadujDashboard(true)">Odśwież</button></div><div class="von-halsky-dashboard-activity">${recent||`<div class="admin-empty-state compact"><span>○</span><div><b>Brak nowych zdarzeń</b><small>Kanał działa bez dodatkowych komunikatów.</small></div></div>`}</div></article></section>
  </div>`;
}

function vonHalskyRekordyStatusy(kind){
  return {
    orders:["CREATED","NEW","PAID","ACCEPTED","PROCESSING","READY","COMPLETED","REFUSED","CANCELLED","REFUNDED"],
    returns:["NEW","ACCEPTED","REJECTED","COMPLETED"],
    claims:["NEW","RESOLUTION_IN_PROGRESS","APPROVED","REJECTED"],
    cases:["NEW","RESOLUTION_IN_PROGRESS","ACCEPTED","APPROVED","REJECTED","COMPLETED"],
    commands:["PENDING","PROVIDER_PROCESSING","SUCCESS","FAILED","NOT_FOUND"],
  }[kind]||[];
}
function vonHalskyRekordyKlucz(){const r=vonHalskyStan.records;return JSON.stringify([r.view,r.query,r.status,r.fulfillment,r.period,r.delivery,r.sort,r.limit,r.cursor]);}
async function vonHalskyLadujRekordy({force=false,cursor=null}={}){
  const records=vonHalskyStan.records;if(records.loading)return;
  if(cursor!==null)records.cursor=String(cursor||"");
  const key=vonHalskyRekordyKlucz();if(!force&&records.queryKey===key)return;
  records.loading=true;records.error="";vonHalskyAktualizujZamowieniaDOM();
  try{
    const params={q:records.query,status:records.status==="wszystkie"?"":records.status,fulfillment:records.view==="orders"&&records.fulfillment!=="wszystkie"?records.fulfillment:"",period:records.period==="wszystkie"?"":records.period,delivery:records.view==="orders"&&records.delivery!=="wszystkie"?records.delivery:"",sort:records.sort,limit:records.limit,cursor:records.cursor};
    if(records.view==="cases"){
      const [returns,claims]=await Promise.all(["returns","claims"].map(kind=>chmura("von-halsky-records",{params:{...params,kind,cursor:""},timeout:20000})));
      const items=[...(returns.items||[]).map(item=>({...item,_caseKind:"return"})),...(claims.items||[]).map(item=>({...item,_caseKind:"claim"}))].sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0)).slice(0,records.limit);
      Object.assign(records,{items,total:(Number(returns.total)||0)+(Number(claims.total)||0),facets:{returns:Number(returns.total)||0,claims:Number(claims.total)||0},sourceHealth:{returns:returns.sourceHealth||null,claims:claims.sourceHealth||null},offset:0,nextCursor:null,previousCursor:null,queryKey:key,error:""});
    }else{
      const data=await chmura("von-halsky-records",{params:{...params,kind:records.view},timeout:20000});
      Object.assign(records,{items:data.items||[],total:Number(data.total)||0,facets:data.facets||{},sourceHealth:{[records.view]:data.sourceHealth||null},offset:Number(data.offset)||0,limit:Number(data.limit)||records.limit,nextCursor:data.nextCursor||null,previousCursor:data.previousCursor||null,queryKey:key,error:""});
    }
  }catch(error){records.error=String(error?.message||error);}
  records.loading=false;vonHalskyAktualizujZamowieniaDOM();
}
function vonHalskyZmienWidokRekordow(kind){
  Object.assign(vonHalskyStan.records,{view:kind,status:"wszystkie",fulfillment:"wszystkie",period:"wszystkie",delivery:"wszystkie",sort:"najnowsze",cursor:"",offset:0,queryKey:""});
  vonHalskyRekordyZaznaczone.clear();void vonHalskyLadujRekordy({force:true});
}
function vonHalskySzukajRekordy(value){
  vonHalskyStan.records.query=String(value||"");vonHalskyStan.records.cursor="";clearTimeout(vonHalskyRekordyTimer);
  vonHalskyRekordyTimer=setTimeout(()=>vonHalskyLadujRekordy({force:true}),350);
}
function vonHalskyFiltrujRekordy(value){
  vonHalskyStan.records.status=String(value||"wszystkie");vonHalskyStan.records.cursor="";void vonHalskyLadujRekordy({force:true});
}
function vonHalskyFiltrujRealizacje(value){
  vonHalskyStan.records.fulfillment=String(value||"wszystkie");vonHalskyStan.records.cursor="";void vonHalskyLadujRekordy({force:true});
}
function vonHalskyFiltrujOkres(value){
  vonHalskyStan.records.period=String(value||"wszystkie");vonHalskyStan.records.cursor="";void vonHalskyLadujRekordy({force:true});
}
function vonHalskyFiltrujDostawe(value){
  vonHalskyStan.records.delivery=String(value||"wszystkie");vonHalskyStan.records.cursor="";void vonHalskyLadujRekordy({force:true});
}
function vonHalskySortujRekordy(value){
  vonHalskyStan.records.sort=String(value||"najnowsze");vonHalskyStan.records.cursor="";void vonHalskyLadujRekordy({force:true});
}
function vonHalskyUstawLimitRekordow(value){
  vonHalskyStan.records.limit=Math.max(10,Math.min(100,Number(value)||25));vonHalskyStan.records.cursor="";void vonHalskyLadujRekordy({force:true});
}
function vonHalskyWyczyscFiltryRekordow(){
  Object.assign(vonHalskyStan.records,{query:"",status:"wszystkie",fulfillment:"wszystkie",period:"wszystkie",delivery:"wszystkie",sort:"najnowsze",cursor:"",offset:0,queryKey:""});
  vonHalskyRekordyZaznaczone.clear();void vonHalskyLadujRekordy({force:true});
}
function vonHalskyPrzejdzRekordy(direction=1){
  const records=vonHalskyStan.records,cursor=direction>0?records.nextCursor:records.previousCursor;if(!cursor)return;
  void vonHalskyLadujRekordy({force:true,cursor});
}
function vonHalskyZaznaczRekord(id,checked){
  checked?vonHalskyRekordyZaznaczone.add(String(id)):vonHalskyRekordyZaznaczone.delete(String(id));
  vonHalskyAktualizujZamowieniaDOM();
}
function vonHalskyZaznaczRekordyWidoku(checked){
  for(const item of vonHalskyStan.records.items||[]){const id=String(item.id||item.claimId||item.commandId||item._recordId||"");if(id)(checked?vonHalskyRekordyZaznaczone.add(id):vonHalskyRekordyZaznaczone.delete(id));}
  vonHalskyAktualizujZamowieniaDOM();
}
function vonHalskyEksportujRekordy(){
  const selected=vonHalskyRekordyZaznaczone,items=(vonHalskyStan.records.items||[]).filter(item=>!selected.size||selected.has(String(item.id||item.claimId||item.commandId||item._recordId||"")));
  adminEksportujCSV(`von-halsky-${vonHalskyStan.records.view}-${new Date().toISOString().slice(0,10)}.csv`,["ID","Status","Data","Dane"],items.map(item=>[item.id||item.claimId||item.commandId||item._recordId,item.status||item.state||item._status,item.updatedAt||item.createdAt||item._updatedAt,JSON.stringify(item)]));
}
function vonHalskyRekordId(item={}){return String(item.id||item.claimId||item.commandId||item._recordId||"");}
function vonHalskyRealizacjaZamowienia(item={}){
  const stage=item._fulfillment||item._artwayShipment?.stage||{},key=String(stage.key||"unknown"),tracking=String(stage.trackingNumber||item._artwayShipment?.trackingNumber||item.delivery?.parcels?.[0]?.trackingNumber||"");
  const cls={decision:"attention",awaiting_shipment:"attention",shipped:"ready",in_transit:"ready",delivered:"ready",closed:"muted"}[key]||"attention";
  return {key,label:stage.label||"Do sprawdzenia",tracking,cls,requiresAction:stage.requiresAction!==false};
}
function vonHalskyStatusZamowieniaMeta(status=""){
  const key=String(status||"").toUpperCase(),map={
    CREATED:["Nowe","new"],NEW:["Nowe","new"],PAID:["Opłacone","paid"],ACCEPTED:["Przyjęte","accepted"],PROCESSING:["W realizacji","processing"],READY:["Gotowe","ready"],COMPLETED:["Zrealizowane","completed"],REFUSED:["Odrzucone","cancelled"],CANCELLED:["Anulowane","cancelled"],REFUNDED:["Zwrócono środki","cancelled"],RETURNED:["Zwrócone","cancelled"]
  };
  const selected=map[key]||[key||"Nieznany","neutral"];return {key,label:selected[0],tone:selected[1]};
}
function vonHalskyZamowienieKlient(item={}){
  const customer=item.customer||{},delivery=item.delivery||{};
  return {name:[customer.firstName||customer.name,customer.lastName].filter(Boolean).join(" ")||delivery.name||customer.email||"—",email:delivery.email||customer.email||"",phone:delivery.phoneNumber||customer.phoneNumber||""};
}
function vonHalskyZamowienieDostawa(item={}){
  const delivery=item.delivery||{},type=String(delivery.deliveryType||"").toUpperCase(),point=delivery.deliveryPoint||delivery.pointId||"";
  const label=type==="APM"?"Paczkomat":type.includes("COURIER")||["P2D","ADDRESS"].includes(type)?"Kurier":type?["POP","PUDO","PICKUP_POINT"].includes(type)?"PaczkoPunkt":type:"Nieokreślona";
  return {label,point,address:vonHalskyAdresZamowienia(item)};
}
function vonHalskyHistoriaWiadomosci(order={}){return (Array.isArray(order?._artwayCommunication?.history)?order._artwayCommunication.history.filter(item=>item&&typeof item==="object"):[]).sort((a,b)=>Date.parse(b.sentAt||b.createdAt||0)-Date.parse(a.sentAt||a.createdAt||0));}
function vonHalskyAdresSledzenia(tracking=""){return tracking?`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(tracking)}`:"";}
function vonHalskyPozycjaZamowienia(line={}){
  const offer=line.offer||{},product=offer.product||{};
  return {line,productId:String(product.productId||line.productId||""),ean:String(product.ean||product.gtin||line.ean||line.gtin||"").trim(),sku:String(product.sku||offer.externalId||line.sku||line.externalId||"").trim(),name:String(product.name||line.name||line.nazwa||"Produkt").trim()||"Produkt",quantity:Math.max(1,Number(line.quantity)||1),price:line.finalPrice||line.price||offer.finalPrice||offer.price||offer.basePrice||{}};
}
let vonHalskyKartotekiZamowienCache=[];
function vonHalskyKluczProduktu(value=""){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");}
function vonHalskyKartotekaPozycji(line={}){
  const item=vonHalskyPozycjaZamowienia(line),local=typeof produktyDoAdministracji==="function"?produktyDoAdministracji():[],catalog=[...vonHalskyKartotekiZamowienCache,...local];
  let found=item.productId?catalog.find(product=>String(product?.id||"")===item.productId):null;
  const ean=vonHalskyKluczProduktu(item.ean),sku=vonHalskyKluczProduktu(item.sku);
  if(!found&&ean)found=catalog.find(product=>[product?.gtin,product?.ean].map(vonHalskyKluczProduktu).includes(ean));
  if(!found&&sku)found=catalog.find(product=>[product?.sku,product?.externalId,product?.kodProducenta,product?.mpn].map(vonHalskyKluczProduktu).includes(sku));
  if(!found&&item.name){const key=item.name.toLowerCase().replace(/\s+/g," "),matches=catalog.filter(product=>String(product?.nazwa||"").toLowerCase().replace(/\s+/g," ")===key);if(matches.length===1)found=matches[0];}
  return found||null;
}
function vonHalskyDokumentyPlanuDlaProduktu(productId,orderId="",warehouse={}){
  const id=String(productId||""),reference=`Von Halsky ${String(orderId||"").trim()}`,remote=Array.isArray(warehouse?.supplierDocuments)?warehouse.supplierDocuments:[],local=(typeof agentAIZlecenia!=="undefined"&&Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).map(document=>{
    const lines=Array.isArray(document?.pozycje)?document.pozycje:[],matching=lines.filter(line=>String(line?.produktId||line?.productId||line?.id||"")===id&&[...(Array.isArray(line?.zamowienia)?line.zamowienia:[]),...Object.keys(line?.orderAllocations&&typeof line.orderAllocations==="object"?line.orderAllocations:{})].map(String).includes(reference));
    return matching.length?{id:String(document.id||""),number:String(document.numer||document.number||document.id||"Plan"),status:String(document.status||"szkic"),supplier:String(document.supplier||document.dostawca||"Dostawca nieprzypisany"),productIds:[id]}:null;
  }).filter(Boolean),documents=[...remote,...local].filter(document=>Array.isArray(document?.productIds)&&document.productIds.map(String).includes(id)),unique=new Map();
  documents.forEach(document=>unique.set(String(document.id||document.number||""),document));return [...unique.values()];
}
function vonHalskyRozpiskaZamowienia(order={},warehouse={}){
  const lines=Array.isArray(order.orderLines)?order.orderLines:[];
  return lines.map((line,index)=>{const item=vonHalskyPozycjaZamowienia(line),product=vonHalskyKartotekaPozycji(line),inventory=product?._catalog?.inventory||{},meta=product&&typeof magazynMetaProduktu==="function"?magazynMetaProduktu(product.id):{},stock=product&&typeof stanMagazynuId==="function"?stanMagazynuId(product.id):(inventory.stock??null),location=String(meta?.lokalizacja||meta?.location||inventory.lokalizacja||inventory.location||"").trim(),locationName=location&&typeof sciezkaNazwLokalizacjiMagazynu==="function"?(sciezkaNazwLokalizacjiMagazynu(location)||location):location,supplierDocuments=product?vonHalskyDokumentyPlanuDlaProduktu(product.id,order.id,warehouse):[],state=!product?"unmatched":stock===0?"unavailable":!location?"missing-location":"ready";return {...item,index,product,stock,location,locationName,supplierDocuments,state};});
}
async function vonHalskyZaladujKartotekiZamowienia(order={}){
  const queries=[...new Set(vonHalskyRozpiskaZamowienia(order).filter(row=>!row.product).map(row=>row.ean||row.sku||row.name).map(value=>String(value||"").trim()).filter(Boolean))];
  if(!queries.length)return [];
  const responses=await Promise.all(queries.map(query=>chmura("product-catalog-query",{params:{audience:"admin",q:query,page:1,limit:10},timeout:30000}).catch(()=>null))),items=responses.flatMap(data=>Array.isArray(data?.items)?data.items:[]),byId=new Map(vonHalskyKartotekiZamowienCache.map(product=>[String(product.id),product]));
  items.forEach(product=>{if(product?.id!==undefined&&product?.id!==null)byId.set(String(product.id),product);});vonHalskyKartotekiZamowienCache=[...byId.values()];
  if(items.length&&typeof zapamietajProduktyCentralne==="function")zapamietajProduktyCentralne(items);
  return items;
}
function vonHalskyZamowieniePozycje(item={}){
  const picking=vonHalskyRozpiskaZamowienia(item),quantity=picking.reduce((sum,row)=>sum+row.quantity,0),located=picking.filter(row=>row.location).length,matched=picking.filter(row=>row.product).length;
  const first=picking.length?`${picking[0].name}${picking.length>1?` + ${picking.length-1} ${picking.length===2?"gra":"gry"}`:""} • 📍 ${located}/${picking.length} lokalizacji`:"";
  return {lines:picking.length,quantity,first,located,matched,picking};
}
function vonHalskyMiniEtapyHTML(stage={}){
  const keys=["decision","awaiting_shipment","shipped","in_transit","delivered"],current=Math.max(0,keys.indexOf(stage.key));
  return `<span class="von-halsky-mini-flow" aria-label="Postęp: ${esc(stage.label||"Do sprawdzenia")}">${keys.map((key,index)=>`<i class="${index<current?"done":index===current?"current":""}"></i>`).join("")}</span>`;
}
function vonHalskyEtykietaZListy(orderId,button){
  const format=inpostEtykietaUstawieniaLokalne().labelDefaultFormat;return vonHalskyPobierzEtykiete(orderId,format,button);
}
function vonHalskyZamowieniaKartyHTML(items=[]){
  if(!items.length)return `<div class="von-halsky-orders-empty"><span>⌕</span><div><b>Brak zamówień w tym widoku</b><small>Zmień etap lub wyczyść filtry.</small></div></div>`;
  return `<section class="von-halsky-order-board" role="list" aria-label="Zamówienia InPost+">${items.map(item=>{
    const id=vonHalskyRekordId(item),status=String(item.status||item._status||"").toUpperCase(),statusMeta=vonHalskyStatusZamowieniaMeta(status),stage=vonHalskyRealizacjaZamowienia(item),customer=vonHalskyZamowienieKlient(item),delivery=vonHalskyZamowienieDostawa(item),products=vonHalskyZamowieniePozycje(item),shipment=item._artwayShipment||{},created=item.createdAt||item.updatedAt||item._updatedAt,updated=item.updatedAt||item._updatedAt||item.createdAt,newOrder=["CREATED","NEW","PAID"].includes(status),refundable=!["REFUNDED","CANCELLED","REFUSED"].includes(status),messages=vonHalskyHistoriaWiadomosci(item).filter(row=>row.status==="sent"),trackingUrl=vonHalskyAdresSledzenia(stage.tracking),amount=item.finalPrice?.amount??item.total?.amount??"—",currency=item.finalPrice?.currency||item.total?.currency||"";
    return `<article class="von-halsky-order-ticket fulfillment-${esc(stage.key)} ${stage.requiresAction?"requires-action":"is-complete"}" role="listitem">
      <header><label class="von-halsky-ticket-select"><input type="checkbox" aria-label="Zaznacz zamówienie ${esc(id)}" ${vonHalskyRekordyZaznaczone.has(id)?"checked":""} onchange="vonHalskyZaznaczRekord(${jsArg(id)},this.checked)"><span></span></label><div class="von-halsky-ticket-id"><small>Zamówienie InPost+</small><b>${esc(id)}</b><span class="von-halsky-order-status ${esc(statusMeta.tone)}">${esc(statusMeta.label)}</span></div><div class="von-halsky-ticket-date"><small>Ostatnia aktywność</small><b>${esc(allegroDataTxt(updated||created))}</b></div><div class="von-halsky-ticket-value"><small>Wartość</small><b>${esc(amount)} <span>${esc(currency)}</span></b></div><button class="btn von-halsky-ticket-primary" onclick="vonHalskyOtworzSzczegolyRekordu(${jsArg(id)})">${stage.requiresAction?"Obsłuż teraz":"Otwórz centrum"} →</button></header>
      <div class="von-halsky-ticket-body"><section class="von-halsky-ticket-flow"><span class="von-halsky-fulfillment ${esc(stage.cls)}">${stage.requiresAction?"!":"✓"} ${esc(stage.label)}</span>${vonHalskyMiniEtapyHTML(stage)}<small>${stage.tracking?`Numer nadania <b>${esc(stage.tracking)}</b>`:"Przesyłka nie ma jeszcze numeru nadania"}</small></section><section class="von-halsky-ticket-contact"><span>👤</span><div><b>${esc(customer.name)}</b><small>${esc(customer.email||"Brak adresu e-mail")}</small><em>${esc(delivery.label)}${delivery.point?` • ${esc(delivery.point)}`:""}</em></div></section><section class="von-halsky-ticket-products"><span>🎯</span><div><b>${products.quantity||0} szt. • ${products.lines||0} ${products.lines===1?"pozycja":"pozycje"}</b><small>${esc(products.first||"Szczegóły produktów po otwarciu")}</small><em class="${products.matched===products.lines?"ready":"attention"}">${products.matched}/${products.lines||0} rozpoznane • ${products.located}/${products.lines||0} lokalizacje</em></div></section></div>
      <footer><div class="von-halsky-ticket-communication"><span>✉</span><div><b>${messages.length?`${messages.length} ${messages.length===1?"wiadomość":"wiadomości"}`:"Kontakt z klientem"}</b><small>${messages.length?`Ostatnia ${esc(allegroDataTxt(messages[0]?.sentAt))}`:"Napisz z poziomu zamówienia"}</small></div></div><div class="von-halsky-ticket-actions"><button class="btn ghost" onclick="vonHalskyOtworzKomunikacje(${jsArg(id)})">✉ Napisz</button>${shipment.labelReady&&shipment.inpostId?`<button class="btn ghost" onclick="vonHalskyEtykietaZListy(${jsArg(id)},this)">🏷 Etykieta</button>`:""}${trackingUrl?`<a class="btn ghost" href="${esc(trackingUrl)}" target="_blank" rel="noopener">↗ Śledź</a>`:""}${newOrder?`<button class="btn" onclick="vonHalskyOtworzDecyzje('order-accept',${jsArg(id)})">✓ Przyjmij</button><button class="btn ghost danger" onclick="vonHalskyOtworzDecyzje('order-refuse',${jsArg(id)})">Odrzuć</button>`:""}${refundable?`<details class="von-halsky-order-more"><summary>Więcej</summary><button class="btn ghost" onclick="vonHalskyOtworzDecyzje('refund',${jsArg(id)})">Refunduj zamówienie</button></details>`:""}</div></footer>
    </article>`;
  }).join("")}</section>`;
}
function vonHalskyRekordyTabelaHTML(){
  const records=vonHalskyStan.records,items=records.items||[],kind=records.view;
  const empty=`<tr><td colspan="7"><div class="allegro-listing-empty"><span>⌕</span><b>Brak danych w tym widoku</b><small>Filtry nie zwracają żadnych rekordów z API.</small></div></td></tr>`;
  if(kind==="orders")return vonHalskyZamowieniaKartyHTML(items);
  if(kind==="commands")return `<table class="admin-standard-table admin-responsive-table"><thead><tr><th></th><th>Polecenie</th><th>Typ</th><th>Status</th><th>Obiekt</th><th>Aktualizacja</th><th>Akcja</th></tr></thead><tbody>${items.map(item=>{const id=vonHalskyRekordId(item);return `<tr><td data-label=""><input type="checkbox" onchange="vonHalskyZaznaczRekord(${jsArg(id)},this.checked)"></td><td data-label="Polecenie"><b>${esc(id)}</b></td><td data-label="Typ">${esc(item.type||"—")}</td><td data-label="Status"><span class="lvl ${item.status==="SUCCESS"?"lvl-ok":"lvl-info"}">${esc(item.status||"—")}</span></td><td data-label="Obiekt">${esc(item.entityId||item.externalId||"—")}</td><td data-label="Aktualizacja">${esc(allegroDataTxt(item.updatedAt||item._updatedAt))}</td><td data-label="Akcja"><button class="btn ghost" onclick="vonHalskySprawdzPolecenie(${jsArg(id)},${jsArg(item.type||"offer")});setTimeout(()=>vonHalskyLadujRekordy({force:true}),500)">Sprawdź</button></td></tr>`;}).join("")||empty}</tbody></table>`;
  const health=records.sourceHealth||{},issues=Object.entries(health).filter(([,value])=>value?.status==="error");
  const healthHtml=issues.map(([source,value])=>`<article class="von-halsky-case-source-error" role="alert"><span>!</span><div><small>${source==="claims"?"REKLAMACJE":"ZWROTY"} • BŁĄD ŹRÓDŁA</small><h3>${source==="claims"?"Nie można potwierdzić pełnej listy reklamacji":"Nie można potwierdzić pełnej listy zwrotów"}</h3><p>API InPost Von Halsky odrzuciło odczyt: ${esc(value.message||"nieznany błąd źródła")}. To nie oznacza, że spraw klienta nie ma.</p><em>Ostatnia próba: ${esc(allegroDataTxt(value.checkedAt))}</em></div><button class="btn" onclick="vonHalskySynchronizujPosprzedaz().then(()=>vonHalskyLadujRekordy({force:true}))">↻ Ponów pobranie</button></article>`).join("");
  const emptyHtml=issues.length?`<div class="von-halsky-orders-empty is-warning"><span>!</span><div><b>Lista jest obecnie niepełna</b><small>Nie podejmuj decyzji na podstawie liczby 0, dopóki źródło nie odpowie poprawnie.</small></div></div>`:`<div class="von-halsky-orders-empty"><span>✓</span><div><b>Brak aktywnych spraw klienta</b><small>Zwroty i reklamacje pojawią się tutaj razem z zamówieniem i historią wiadomości.</small></div></div>`;
  return `<section class="von-halsky-case-list" role="list" aria-label="Zwroty i reklamacje klientów">${healthHtml}${items.map(item=>{const id=vonHalskyRekordId(item),claim=item._caseKind==="claim"||kind==="claims",orderId=item.relatedOrder?.orderId||item.orderId||item.order?.id||"",reason=claim?(item.specification?.claimTypeDescription||item.specification?.claimType?.description):(item.returnReason?.text||item.reason?.description),status=item.state||item.status||"NOWY",open=!['APPROVED','REJECTED','COMPLETED'].includes(String(status).toUpperCase());return `<article class="${claim?"is-claim":"is-return"} ${open?"is-open":"is-closed"}" role="listitem"><label><input type="checkbox" aria-label="Zaznacz sprawę ${esc(id)}" onchange="vonHalskyZaznaczRekord(${jsArg(id)},this.checked)"><span></span></label><span class="von-halsky-case-icon">${claim?"🛡":"↩"}</span><div class="von-halsky-case-main"><small>${claim?"REKLAMACJA":"ZWROT"} • ${esc(id)}</small><h3>${esc(reason||"Sprawa klienta bez opisu")}</h3><p>Zamówienie <b>${esc(orderId||"niepowiązane")}</b> • ${esc(allegroDataTxt(item.updatedAt||item.createdAt))}</p></div><span class="lvl ${open?"lvl-ostrzezenie":"lvl-ok"}">${esc(status)}</span><div class="von-halsky-case-actions">${orderId?`<button class="btn" onclick="vonHalskyOtworzSpraweZamowienia(${jsArg(orderId)},'after-sales')">Otwórz całą sprawę</button><button class="btn ghost" onclick="vonHalskyOtworzWiadomoscSprawy(${jsArg(orderId)},${jsArg(claim?"claim":"return")},${jsArg(id)},${jsArg(reason||"")})">✉ Napisz klientowi</button>`:`<button class="btn ghost" disabled>Brak powiązania z zamówieniem</button>`}${claim?`<button class="btn ghost" onclick="vonHalskyOtworzDecyzje('claim',${jsArg(id)})">Rozstrzygnij</button>`:`<button class="btn ghost" onclick="vonHalskyOtworzDecyzje('return-accept',${jsArg(id)})">Akceptuj</button><button class="btn ghost danger" onclick="vonHalskyOtworzDecyzje('return-refuse',${jsArg(id)})">Odrzuć</button>`}</div></article>`;}).join("")||emptyHtml}</section>`;
}
function vonHalskyEtapyZamowienHTML(){
  const records=vonHalskyStan.records,facets=records.facets||{},stages=[
    ["wszystkie","▦","Wszystkie","pełny rejestr"],["nowe","✦","Nowe","czekają na przyjęcie"],["do_obslugi","!","Do obsługi","wymagają działania"],["do_decyzji","?","Do decyzji","przyjmij lub odrzuć"],["do_nadania","＋","Do nadania","bez przesyłki"],["nadane","🏷","Nadane","etykieta utworzona"],["w_transporcie","→","W transporcie","śledzenie InPost"],["zrealizowane","✓","Zrealizowane","dostarczone"],["anulowane","×","Anulowane","zwroty i odrzucenia"]
  ];
  return adminEtapyRealizacjiZamowienHTML({active:records.fulfillment,items:stages.map(([id,icon,label,note])=>({id,icon,label,note,count:Number(facets[id])||0,onclick:`vonHalskyFiltrujRealizacje(${jsArg(id)})`}))});
}
function vonHalskyLiczbaAktywnychFiltrow(){
  const r=vonHalskyStan.records;return [r.query,r.status!=="wszystkie",r.fulfillment!=="wszystkie",r.period!=="wszystkie",r.delivery!=="wszystkie",r.sort!=="najnowsze"].filter(Boolean).length;
}
function vonHalskyCentrumZamowienHTML({busy=false}={}){
  const facets=vonHalskyStan.records.facets||{},urgent=Number(facets.do_obslugi)||0,shipping=Number(facets.do_nadania)||0,transit=Number(facets.w_transporcie)||0,done=Number(facets.zrealizowane)||0;
  return adminCentrumZamowienHTML({kanal:"von-halsky",ikona:"📦",etykieta:"Centrum realizacji • Von Halsky",tytul:"Zamówienia i kontakt z klientem",opis:"Jedno miejsce: decyzja, kompletacja, przesyłka, etykieta i wiadomości.",className:"von-halsky-order-command-center",metricsClass:"von-halsky-command-metrics",metryki:[{icon:"!",value:urgent,label:"Wymaga działania",note:"sprawdź teraz",tone:urgent?"danger":"ready",onclick:"vonHalskyFiltrujRealizacje('do_obslugi')"},{icon:"🏷",value:shipping,label:"Do nadania",note:"bez etykiety",tone:shipping?"attention":"ready",onclick:"vonHalskyFiltrujRealizacje('do_nadania')"},{icon:"🚚",value:transit,label:"W drodze",note:"tracking InPost",tone:"transit",onclick:"vonHalskyFiltrujRealizacje('w_transporcie')"},{icon:"✓",value:done,label:"Zakończone",note:"dostarczone",tone:"done",onclick:"vonHalskyFiltrujRealizacje('zrealizowane')"}],akcje:adminAkcjeCentrumZamowienHTML({source:"von-halsky-orders-manual",syncAction:"vonHalskySynchronizujZamowienia().then(()=>vonHalskyLadujRekordy({force:true}))",syncBusy:busy})});
}
function vonHalskyFiltryCentrumHTML(kind,statuses,activeFilters){
  const records=vonHalskyStan.records,searchLabel=kind==="cases"?"Szukaj sprawy klienta":kind==="commands"?"Szukaj operacji":"Szukaj zamówienia";
  const fields=`<div class="von-halsky-order-filters channel-orders-filter-fields admin-search-full"><label class="von-halsky-order-search"><span>${searchLabel}</span><input value="${esc(records.query)}" oninput="vonHalskySzukajRekordy(this.value)" placeholder="ID, klient, e-mail, telefon, produkt lub tracking…"></label>${kind==="orders"?`<label><span>Etap realizacji</span><select onchange="vonHalskyFiltrujRealizacje(this.value)">${[["wszystkie","Wszystkie etapy"],["nowe","Nowe"],["do_obslugi","Do obsługi"],["do_decyzji","Do decyzji"],["do_nadania","Do nadania"],["nadane","Nadane"],["w_transporcie","W transporcie"],["zrealizowane","Zrealizowane"],["anulowane","Anulowane / zwrócone"]].map(([value,label])=>`<option value="${value}" ${records.fulfillment===value?"selected":""}>${label}</option>`).join("")}</select></label>`:""}<label><span>Status kanału</span><select onchange="vonHalskyFiltrujRekordy(this.value)"><option value="wszystkie" ${records.status==="wszystkie"?"selected":""}>Wszystkie statusy</option>${statuses.map(status=>{const meta=vonHalskyStatusZamowieniaMeta(status);return `<option value="${status}" ${records.status===status?"selected":""}>${esc(meta.label)} (${status})</option>`;}).join("")}</select></label><label><span>Okres</span><select onchange="vonHalskyFiltrujOkres(this.value)">${[["wszystkie","Cały okres"],["dzisiaj","Dzisiaj"],["7","Ostatnie 7 dni"],["30","Ostatnie 30 dni"],["90","Ostatnie 90 dni"]].map(([value,label])=>`<option value="${value}" ${records.period===value?"selected":""}>${label}</option>`).join("")}</select></label>${kind==="orders"?`<label><span>Sposób doręczenia</span><select onchange="vonHalskyFiltrujDostawe(this.value)">${[["wszystkie","Każda dostawa"],["paczkomat","Paczkomat"],["kurier","Kurier"],["punkt","PaczkoPunkt"]].map(([value,label])=>`<option value="${value}" ${records.delivery===value?"selected":""}>${label}</option>`).join("")}</select></label>`:""}<label><span>Sortowanie</span><select onchange="vonHalskySortujRekordy(this.value)">${[["najnowsze","Najnowsza aktualizacja"],["najstarsze","Najstarsze najpierw"],["wartosc_desc","Najwyższa wartość"],["wartosc_asc","Najniższa wartość"]].map(([value,label])=>`<option value="${value}" ${records.sort===value?"selected":""}>${label}</option>`).join("")}</select></label><button class="btn ghost" type="button" ${activeFilters?"":"disabled"} onclick="vonHalskyWyczyscFiltryRekordow()">Wyczyść filtry (${activeFilters})</button></div>`;
  return adminWyszukiwaniePanelHTML({id:"von-halsky-orders",title:"Wyszukiwanie i filtry",description:"ID, klient, dane kontaktowe, produkt, tracking, etap i okres.",results:records.total,active:!!activeFilters,open:true,fields});
}
function vonHalskyOrdersWorkspaceHTML(){
  const records=vonHalskyStan.records,kind=records.view,statuses=vonHalskyRekordyStatusy(kind),busy=!!vonHalskyStan.operation;
  if(!records.queryKey&&!records.loading)setTimeout(()=>vonHalskyLadujRekordy({force:true}),0);
  const tabs=[["orders","📦","Zamówienia"],["cases","🛡","Sprawy klienta"],["commands","⏱","Operacje API"]],activeFilters=vonHalskyLiczbaAktywnychFiltrow(),from=records.total?records.offset+1:0,to=Math.min(records.total,records.offset+records.items.length),entityLabel=kind==="cases"?(records.total===1?"sprawa":"spraw"):kind==="commands"?(records.total===1?"operacja":"operacji"):(records.total===1?"zamówienie":"zamówień"),orderAttention=Math.max(0,Number(records.facets?.do_obslugi)||0);
  return `<div class="von-halsky-orders-workspace channel-orders-page channel-orders-von-halsky" data-vh-orders>
    <section class="panel von-halsky-order-tabs"><div class="von-halsky-order-tabbar">${tabs.map(([id,icon,label])=>{const badge=id==="orders"?orderAttention:records.total;return `<button class="${kind===id?"active":""}" onclick="vonHalskyZmienWidokRekordow(${jsArg(id)})"><span>${icon}</span><b>${label}</b>${kind===id&&badge?`<em>${badge}</em>`:""}</button>`;}).join("")}</div></section>
    <section class="panel von-halsky-order-list channel-orders-register">${kind==="orders"?vonHalskyCentrumZamowienHTML({busy}):`<div class="order-section-head"><div><span class="order-pro-label">${kind==="cases"?"Jedna sprawa klienta":"Dane bezpośrednio z API"}</span><h2>${kind==="cases"?"Zwroty, reklamacje i kontakt":esc(tabs.find(row=>row[0]===kind)?.[2]||"Obsługa sprzedaży")}</h2><p class="order-detail-lead">${kind==="cases"?"Każde zgłoszenie otwiera pełne zamówienie, wiadomości, przesyłkę i wspólną historię działań.":"Lista jest stronicowana na serwerze. Operacje aktualizują wyłącznie właściwy rekord."}</p></div><div class="diag-actions"><button class="btn ghost" ${busy?"disabled":""} onclick="${kind==="commands"?"vonHalskySynchronizujZdarzenia().then(()=>vonHalskyLadujRekordy({force:true}))":"vonHalskySynchronizujPosprzedaz().then(()=>vonHalskyLadujRekordy({force:true}))"}">${busy?"↻ Pobieram…":"↻ Pobierz z API"}</button></div></div>`}
      ${kind==="orders"?vonHalskyEtapyZamowienHTML():""}
      ${vonHalskyFiltryCentrumHTML(kind,statuses,activeFilters)}
      ${records.loading?`<div class="von-halsky-inline-loading"><span></span><b>Pobieram rekordy…</b></div>`:""}${records.error?`<div class="backend-note warning"><b>Nie pobrano danych</b><span>${esc(records.error)}</span></div>`:""}
      ${adminNaglowekListyZamowienHTML({id:`von-halsky-${kind}`,title:entityLabel,total:records.total,from,to,selected:vonHalskyRekordyZaznaczone.size,selectPage:"vonHalskyZaznaczRekordyWidoku(true)",clear:"vonHalskyZaznaczRekordyWidoku(false)",exportAll:"vonHalskyEksportujRekordy()",limit:records.limit,limits:[10,25,50,100],onLimit:"vonHalskyUstawLimitRekordow(this.value)"})}<div class="admin-standard-table-wrap von-halsky-orders-table-wrap">${vonHalskyRekordyTabelaHTML()}</div>
      <nav class="allegro-listing-pagination von-halsky-order-pagination"><button class="btn ghost" ${!records.previousCursor?"disabled":""} onclick="vonHalskyPrzejdzRekordy(-1)">← Poprzednia</button><span>${from}–${to} z ${records.total}</span><button class="btn ghost" ${!records.nextCursor?"disabled":""} onclick="vonHalskyPrzejdzRekordy(1)">Następna →</button></nav>
    </section>
  </div>`;
}
function vonHalskyAktualizujZamowieniaDOM(){
  if(!String(trasa()).startsWith("/admin/von-halsky/zamowienia"))return false;
  const current=document.querySelector("[data-vh-orders]");if(!current)return false;
  const template=document.createElement("template");template.innerHTML=vonHalskyOrdersWorkspaceHTML().trim();const next=template.content.firstElementChild;
  if(!next)return false;current.replaceWith(next);return true;
}
function vonHalskyAdresZamowienia(order={}){
  const a=order.delivery?.address||order.customer?.address||{};
  return [a.street||a.streetName||a.line1,[a.building||a.buildingNumber||a.houseNumber,a.flat||a.flatNumber||a.apartmentNumber].filter(Boolean).join("/"),a.postCode||a.postalCode||a.zipCode,a.city||a.town].filter(Boolean).join(" ");
}
function vonHalskySzablonWiadomosci(type="status",data={}){
  const order=data.order||{},shipment=data.shipment||{},customer=order.customer||{},name=String(customer.firstName||"Dzień dobry").trim(),id=String(order.id||""),tracking=String(shipment.trackingNumber||order.delivery?.parcels?.[0]?.trackingNumber||""),stage=shipment.stage?.label||vonHalskyRealizacjaZamowienia(order).label||"w realizacji";
  const templates={
    status:{subject:`Status zamówienia ${id} — Artway-TM`,message:`Dzień dobry ${name},\n\ninformujemy, że zamówienie ${id} ma obecnie status: ${stage}.\n\nW razie pytań prosimy o odpowiedź na tę wiadomość.`},
    shipped:{subject:`Przesyłka do zamówienia ${id} została nadana`,message:`Dzień dobry ${name},\n\nprzesyłka dotycząca zamówienia ${id} została nadana.${tracking?`\nNumer przesyłki: ${tracking}`:""}\n\nStatus doręczenia można sprawdzić w serwisie InPost.`},
    delay:{subject:`Aktualizacja terminu realizacji zamówienia ${id}`,message:`Dzień dobry ${name},\n\nrealizacja zamówienia ${id} wymaga dodatkowego czasu. Przepraszamy za opóźnienie. Poinformujemy od razu, gdy przesyłka będzie gotowa do nadania.`},
    availability:{subject:`Ważna informacja o zamówieniu ${id}`,message:`Dzień dobry ${name},\n\nkontaktujemy się w sprawie dostępności produktu z zamówienia ${id}. Prosimy o odpowiedź na tę wiadomość — przedstawimy możliwe rozwiązania.`},
    return:{subject:`Zwrot dotyczący zamówienia ${id} — Artway-TM`,message:`Dzień dobry ${name},\n\npotwierdzamy, że zajmujemy się zwrotem dotyczącym zamówienia ${id}. O kolejnych krokach i wyniku poinformujemy w tej samej korespondencji.`},
    claim:{subject:`Reklamacja dotycząca zamówienia ${id} — Artway-TM`,message:`Dzień dobry ${name},\n\npotwierdzamy przyjęcie sprawy dotyczącej zamówienia ${id}. Analizujemy zgłoszenie i przekażemy odpowiedź w tej samej korespondencji.`},
    custom:{subject:`Zamówienie ${id} — Artway-TM`,message:""},
  };
  return templates[type]||templates.status;
}
function vonHalskyHistoriaWiadomosciElementHTML(item={}){
  const sent=item.status==="sent",accepted=sent&&item.deliveryStatus==="accepted_by_server";
  const status=sent?(accepted?"Przyjęta przez serwer pocztowy • doręczenie niepotwierdzone":"Wysłana • historyczny zapis bez potwierdzenia doręczenia"):"Wysyłka nieudana";
  return `<article class="${sent?"sent":"failed"}"><span>${sent?"✓":"!"}</span><div><b>${esc(item.subject||"Wiadomość")}</b><small>${esc(allegroDataTxt(item.sentAt||item.createdAt))}${item.sentBy?` • ${esc(item.sentBy)}`:""}</small><em class="von-halsky-message-delivery">${esc(status)}</em><p>${esc(String(item.message||item.error||"").slice(0,180))}</p>${item.messageId?`<button class="btn ghost von-halsky-message-id" type="button" onclick="vonHalskyKopiuj(${jsArg(item.messageId)},'Identyfikator wiadomości')">Kopiuj ID wiadomości</button>`:""}</div></article>`;
}
function vonHalskyKomunikacjaHTML(data={}){
  const order=data.order||{},communication=data.communication||{},contact=communication.recipient||vonHalskyZamowienieKlient(order),history=Array.isArray(communication.history)?communication.history:vonHalskyHistoriaWiadomosci(order),preset=vonHalskySzablonWiadomosci("status",data),ready=communication.configured===true&&Boolean(contact.email),id=String(order.id||"");
  return `<section class="von-halsky-order-card von-halsky-communication-card" id="vh-communication-${esc(id)}"><header><span>✉</span><div><small>Komunikacja z klientem</small><h3>Wiadomości dotyczące całej sprawy</h3></div><em class="lvl ${ready?"lvl-ok":"lvl-ostrzezenie"}">${ready?"poczta gotowa":"sprawdź pocztę"}</em></header><div class="von-halsky-communication-recipient"><div><small>Odbiorca</small><b>${esc(contact.name||"Klient")}</b><span>${esc(contact.email||"Brak adresu e-mail")}</span></div>${contact.email?`<button class="btn ghost" type="button" onclick="vonHalskyKopiuj(${jsArg(contact.email)},'Adres e-mail')">Kopiuj adres</button>`:""}</div><div class="von-halsky-communication-layout"><form class="von-halsky-message-compose" onsubmit="vonHalskyWyslijWiadomosc(event,${jsArg(id)})"><section class="von-halsky-agent-composer"><header><span>✨</span><div><small>Kreator wiadomości Agent AI</small><b>Agent przygotuje szkic z zamówienia, zwrotu lub reklamacji</b></div><em>bez wysyłki</em></header><div><label>Co ma przekazać Agent?<input name="agentInstruction" maxlength="1200" placeholder="np. odpowiedz na reklamację i opisz kolejne kroki"></label><label>Ton<select name="agentTone"><option value="profesjonalny i konkretny">Profesjonalny</option><option value="serdeczny i pomocny">Serdeczny</option><option value="krótki i rzeczowy">Krótki</option><option value="przepraszający i rozwiązujący problem">Przeprosiny</option></select></label></div><button class="btn von-halsky-agent-draft-button" type="button" onclick="vonHalskyPrzygotujSzkicAgentem(this,${jsArg(id)})">✨ Przygotuj / popraw szkic</button><p>Agent przygotowuje szkic, ale nigdy nie wysyła go bez sprawdzenia i osobnego potwierdzenia operatora.</p></section><div class="von-halsky-message-templates" role="group" aria-label="Szablon wiadomości"><button type="button" class="active" data-template="status" onclick="vonHalskyWybierzSzablonWiadomosci(this,'status')">Status</button><button type="button" data-template="shipped" onclick="vonHalskyWybierzSzablonWiadomosci(this,'shipped')">Nadanie</button><button type="button" data-template="return" onclick="vonHalskyWybierzSzablonWiadomosci(this,'return')">Zwrot</button><button type="button" data-template="claim" onclick="vonHalskyWybierzSzablonWiadomosci(this,'claim')">Reklamacja</button><button type="button" data-template="delay" onclick="vonHalskyWybierzSzablonWiadomosci(this,'delay')">Opóźnienie</button><button type="button" data-template="availability" onclick="vonHalskyWybierzSzablonWiadomosci(this,'availability')">Dostępność</button><button type="button" data-template="custom" onclick="vonHalskyWybierzSzablonWiadomosci(this,'custom')">Własna</button></div><input type="hidden" name="template" value="status"><label>Temat<input name="subject" maxlength="180" value="${esc(preset.subject)}" required></label><label>Treść wiadomości<textarea name="message" rows="8" maxlength="5000" required>${esc(preset.message)}</textarea></label><label class="von-halsky-message-confirm"><input type="checkbox" name="confirmed" required><span>Sprawdziłem odbiorcę i treść. Potwierdzam wysłanie jednej wiadomości.</span></label><div class="von-halsky-message-sendbar"><span>Od: <b>${esc(communication.from||"Artway-TM")}</b></span><button class="btn" type="submit" ${ready?"":"disabled"}>✉ Wyślij wiadomość</button></div></form><aside class="von-halsky-message-history"><header><div><small>Historia kontaktu</small><b>${history.length} ${history.length===1?"wiadomość":"wiadomości"}</b></div><span>${communication.sentCount||history.filter(item=>item.status==="sent").length} zapisanych wysyłek</span></header><div>${history.slice(0,12).map(vonHalskyHistoriaWiadomosciElementHTML).join("")||`<div class="von-halsky-message-empty"><span>○</span><b>Brak wysłanych wiadomości</b><small>Pierwsza wiadomość pojawi się tu po potwierdzonej wysyłce.</small></div>`}</div></aside></div><p class="von-halsky-message-channel-note"><b>Ważne:</b> wpis „przyjęta przez serwer” oznacza przyjęcie do kolejki SMTP. Faktyczne doręczenie do skrzynki klienta zależy także od jego dostawcy i filtrów antyspamowych. Von Halsky nie udostępnia osobnego czatu API, dlatego wiadomości z zamówienia, zwrotu i reklamacji są prowadzone wspólnie przez pocztę Artway-TM.</p></section>`;
}
function vonHalskyHistoriaOperacjiHTML(data={}){
  const order=data.order||{},shipment=data.shipment||{},communication=data.communication||{},afterSales=data.afterSales||{},events=[
    order.createdAt&&{at:order.createdAt,icon:"＋",title:"Zamówienie utworzone",note:"Von Halsky"},
    order.updatedAt&&{at:order.updatedAt,icon:"↻",title:"Dane zamówienia zaktualizowane",note:String(order.status||"")},
    shipment.createdAt&&{at:shipment.createdAt,icon:"🏷",title:"Przesyłka InPost utworzona",note:String(shipment.trackingNumber||shipment.inpostId||"")},
    shipment.linkedAt&&{at:shipment.linkedAt,icon:"🔗",title:"Tracking połączony z Von Halsky",note:String(shipment.trackingNumber||"")},
    ...(Array.isArray(communication.history)?communication.history:[]).filter(item=>item.status==="sent").map(item=>({at:item.sentAt,icon:"✉",title:"Wiadomość przyjęta przez serwer",note:item.subject})),
    ...(Array.isArray(afterSales.returns)?afterSales.returns:[]).map(item=>({at:item.updatedAt||item.createdAt,icon:"↩",title:"Zwrot klienta",note:`${item.id||""} • ${item.status||item.state||"NEW"}`})),
    ...(Array.isArray(afterSales.claims)?afterSales.claims:[]).map(item=>({at:item.updatedAt||item.createdAt,icon:"🛡",title:"Reklamacja klienta",note:`${item.claimId||item.id||""} • ${item.state||item.status||"NEW"}`})),
  ].filter(Boolean).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,10);
  return `<section class="von-halsky-order-card von-halsky-history-card"><header><span>◷</span><div><small>Historia realizacji</small><h3>Oś zdarzeń zamówienia</h3></div></header><div class="von-halsky-order-timeline">${events.map(item=>`<article><span>${item.icon}</span><div><b>${esc(item.title)}</b><small>${esc(allegroDataTxt(item.at))} • ${esc(item.note||"")}</small></div></article>`).join("")||`<div class="admin-empty-state compact"><span>○</span><div><b>Brak zdarzeń</b></div></div>`}</div></section>`;
}
function vonHalskyZnajdzRekordSprawy(id){
  const key=String(id||""),records=vonHalskyStan.records.items||[];
  const direct=records.find(item=>vonHalskyRekordId(item)===key);if(direct)return direct;
  for(const shell of document.querySelectorAll(".von-halsky-record-dialog-shell")){const afterSales=shell._vonHalskyDetailData?.afterSales||{},items=[...(afterSales.returns||[]),...(afterSales.claims||[])],found=items.find(item=>vonHalskyRekordId(item)===key);if(found)return found;}
  return null;
}
function vonHalskyPosprzedazHTML(data={}){
  const afterSales=data.afterSales||{},returns=Array.isArray(afterSales.returns)?afterSales.returns:[],claims=Array.isArray(afterSales.claims)?afterSales.claims:[],items=[...returns.map(item=>({...item,_caseKind:"return"})),...claims.map(item=>({...item,_caseKind:"claim"}))].sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0));
  return `<section class="von-halsky-order-card von-halsky-after-sales-card"><header><span>🛡</span><div><small>Obsługa posprzedażowa</small><h3>Zwroty i reklamacje tego zamówienia</h3></div><em class="lvl ${Number(afterSales.open)>0?"lvl-ostrzezenie":"lvl-ok"}">${Number(afterSales.open)||0} otwartych</em></header><div class="von-halsky-after-sales-summary"><span><b>${returns.length}</b><small>zwrotów</small></span><span><b>${claims.length}</b><small>reklamacji</small></span><span><b>${(data.communication?.history||[]).length}</b><small>wiadomości</small></span></div><div class="von-halsky-after-sales-list">${items.map(item=>{const claim=item._caseKind==="claim",id=vonHalskyRekordId(item),reason=claim?(item.specification?.claimTypeDescription||item.specification?.claimType?.description):(item.returnReason?.text||item.reason?.description),status=item.state||item.status||"NEW",open=!['APPROVED','REJECTED','COMPLETED'].includes(String(status).toUpperCase());return `<article class="${claim?"is-claim":"is-return"}"><span>${claim?"🛡":"↩"}</span><div><small>${claim?"REKLAMACJA":"ZWROT"} • ${esc(id)}</small><b>${esc(reason||"Brak opisu z API")}</b><p>${esc(allegroDataTxt(item.updatedAt||item.createdAt))}</p></div><em class="lvl ${open?"lvl-ostrzezenie":"lvl-ok"}">${esc(status)}</em><div><button class="btn ghost" type="button" onclick="vonHalskyWiadomoscDoSprawy(this,${jsArg(claim?"claim":"return")},${jsArg(id)},${jsArg(reason||"")})">✉ Przygotuj wiadomość</button>${claim?`<button class="btn" type="button" onclick="vonHalskyOtworzDecyzje('claim',${jsArg(id)})">Rozstrzygnij</button>`:`<button class="btn" type="button" onclick="vonHalskyOtworzDecyzje('return-accept',${jsArg(id)})">Akceptuj</button><button class="btn ghost danger" type="button" onclick="vonHalskyOtworzDecyzje('return-refuse',${jsArg(id)})">Odrzuć</button>`}</div></article>`;}).join("")||`<div class="von-halsky-message-empty"><span>✓</span><b>Brak zwrotów i reklamacji</b><small>Nowe zgłoszenie zostanie połączone z tym zamówieniem i historią kontaktu.</small></div>`}</div></section>`;
}
function vonHalskySprawaNawigacjaHTML(data={},active="overview"){
  const order=data.order||{},shipment=data.shipment||{},afterSales=data.afterSales||{},lines=Array.isArray(order.orderLines)?order.orderLines:[],messages=Array.isArray(data.communication?.history)?data.communication.history.length:0,cases=(afterSales.returns||[]).length+(afterSales.claims||[]).length,stage=shipment.stage||vonHalskyRealizacjaZamowienia(order),tabs=[["overview","▦","Przegląd",stage.label||"status"],["products","🎯","Produkty",`${lines.length} pozycji`],["shipment","📦","Wysyłka",shipment.trackingNumber?"tracking":"do nadania"],["communication","✉","Wiadomości",messages||""],["after-sales","🛡","Zwrot i reklamacja",cases||""],["history","◷","Historia",""]];
  return `<nav class="von-halsky-case-nav" aria-label="Sekcje centrum obsługi"><div>${tabs.map(([id,icon,label,badge])=>`<button type="button" data-case-target="${id}" class="${id===active?"active":""}" onclick="vonHalskyWybierzSekcjeSprawy(this,'${id}')"><span>${icon}</span><b>${label}</b>${badge?`<em>${esc(badge)}</em>`:""}</button>`).join("")}</div><p>Jedno zamówienie • jedna historia • jeden kontakt z klientem</p></nav>`;
}
function vonHalskyWybierzSekcjeSprawy(button,section){
  const root=button.closest(".von-halsky-order-detail-grid");if(!root)return;
  root.querySelectorAll("[data-case-target]").forEach(item=>item.classList.toggle("active",item.dataset.caseTarget===section));
  root.querySelectorAll("[data-case-section]").forEach(panel=>{panel.hidden=panel.dataset.caseSection!==section;});
  const shell=root.closest(".von-halsky-record-dialog-shell");if(shell)shell.dataset.activeSection=section;
  root.closest(".von-halsky-record-dialog>main")?.scrollTo({top:Math.max(0,root.querySelector(".von-halsky-case-nav")?.offsetTop||0),behavior:"smooth"});
}
function vonHalskyWiadomoscDoSprawy(button,type,id,reason=""){
  const root=button.closest(".von-halsky-order-detail-grid"),tab=root?.querySelector('[data-case-target="communication"]');if(!tab)return;
  vonHalskyWybierzSekcjeSprawy(tab,"communication");const form=root.querySelector(".von-halsky-message-compose"),template=form?.querySelector(`[data-template="${type}"]`);if(template)vonHalskyWybierzSzablonWiadomosci(template,type);
  if(form?.elements.agentInstruction)form.elements.agentInstruction.value=`Przygotuj odpowiedź dotyczącą ${type==="claim"?"reklamacji":"zwrotu"} ${id}${reason?`: ${reason}`:""}. Podaj obecny stan sprawy i kolejne kroki.`;
}
async function vonHalskyOtworzWiadomoscSprawy(orderId,type,id,reason=""){
  await vonHalskyOtworzSpraweZamowienia(orderId,"communication");const shell=[...document.querySelectorAll(".von-halsky-record-dialog-shell")].find(node=>node.dataset.orderId===String(orderId)),form=shell?.querySelector(".von-halsky-message-compose"),template=form?.querySelector(`[data-template="${type}"]`);if(template)vonHalskyWybierzSzablonWiadomosci(template,type);if(form?.elements.agentInstruction)form.elements.agentInstruction.value=`Przygotuj odpowiedź dotyczącą ${type==="claim"?"reklamacji":"zwrotu"} ${id}${reason?`: ${reason}`:""}. Podaj obecny stan sprawy i kolejne kroki.`;
}
function vonHalskySzybkieAkcjeHTML(data={}){
  const order=data.order||{},shipment=data.shipment||{},tracking=String(shipment.trackingNumber||""),trackingUrl=vonHalskyAdresSledzenia(tracking),format=inpostEtykietaUstawieniaLokalne().labelDefaultFormat;
  return `<nav class="von-halsky-order-quickbar" aria-label="Szybkie działania zamówienia"><button class="btn" type="button" onclick="vonHalskyPrzewinDoKomunikacji(${jsArg(order.id)})">✉ Napisz do klienta</button>${shipment.labelReady?`<button class="btn ghost" type="button" onclick="vonHalskyPobierzEtykiete(${jsArg(order.id)},${jsArg(format)},this)">🏷 Etykieta ${esc(format)}</button>`:""}${tracking?`<button class="btn ghost" type="button" onclick="vonHalskyKopiuj(${jsArg(tracking)},'Numer przesyłki')">⧉ Kopiuj tracking</button>`:""}${trackingUrl?`<a class="btn ghost" href="${esc(trackingUrl)}" target="_blank" rel="noopener">↗ Śledź w InPost</a>`:""}</nav>`;
}
function vonHalskyWybierzSzablonWiadomosci(button,type){
  const shell=button.closest(".von-halsky-record-dialog-shell"),form=button.closest("form"),data=shell?._vonHalskyDetailData||{},preset=vonHalskySzablonWiadomosci(type,data);if(!form)return;
  form.querySelectorAll(".von-halsky-message-templates button").forEach(item=>item.classList.toggle("active",item===button));form.elements.template.value=type;form.elements.subject.value=preset.subject;form.elements.message.value=preset.message;form.elements.message.focus();
}
function vonHalskyPrzewinDoKomunikacji(orderId){const card=document.getElementById(`vh-communication-${orderId}`),root=card?.closest(".von-halsky-order-detail-grid"),tab=root?.querySelector('[data-case-target="communication"]');if(tab)vonHalskyWybierzSekcjeSprawy(tab,"communication");}
async function vonHalskyOtworzKomunikacje(orderId){await vonHalskyOtworzSpraweZamowienia(orderId,"communication");}
async function vonHalskyPrzygotujSzkicAgentem(button,orderId){
  const form=button.closest("form"),original=button.textContent;if(!form)return;button.disabled=true;button.textContent="✨ Agent przygotowuje…";
  try{const result=await chmura("von-halsky-order-message-draft",{method:"POST",body:{orderId,instruction:String(form.elements.agentInstruction?.value||"").trim(),tone:String(form.elements.agentTone?.value||""),subject:String(form.elements.subject?.value||"").trim(),message:String(form.elements.message?.value||"").trim()},timeout:120000});form.elements.subject.value=result.draft?.subject||form.elements.subject.value;form.elements.message.value=result.draft?.message||form.elements.message.value;form.elements.template.value="custom";form.elements.confirmed.checked=false;form.dataset.requestId="";form.querySelectorAll(".von-halsky-message-templates button").forEach(item=>item.classList.toggle("active",item.dataset.template==="custom"));button.textContent="✓ Szkic Agenta gotowy";toast("Agent przygotował szkic — sprawdź go przed wysłaniem ✅");setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent=original;}},1800);}
  catch(error){toast("Agent nie przygotował szkicu: "+(error.message||error));button.disabled=false;button.textContent=original;}
}
async function vonHalskyWyslijWiadomosc(event,orderId){
  event.preventDefault();const form=event.currentTarget,button=event.submitter,fd=new FormData(form);if(!button)return;button.disabled=true;button.textContent="Wysyłam…";
  const requestId=form.dataset.requestId||(form.dataset.requestId=`vhmsg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`),body={orderId,requestId,confirmed:fd.get("confirmed")==="on",template:String(fd.get("template")||"custom"),subject:String(fd.get("subject")||"").trim(),message:String(fd.get("message")||"").trim()};
  try{const result=await chmura("von-halsky-order-message-send",{method:"POST",body,timeout:30000}),shell=form.closest(".von-halsky-record-dialog-shell"),data=shell?._vonHalskyDetailData||{};data.communication=result.communication||data.communication;if(data.order&&data.communication)data.order._artwayCommunication={...(data.order._artwayCommunication||{}),history:data.communication.history||[]};vonHalskyZapiszKomunikacjeWRekordach(orderId,data.communication);vonHalskyPodmienSzczegolyZamowienia(orderId,data);vonHalskyAktualizujZamowieniaDOM();toast(result.idempotent?"Wiadomość była już przyjęta przez serwer — nie utworzono duplikatu ✅":"Serwer pocztowy przyjął wiadomość ✅");}
  catch(error){toast("Nie wysłano wiadomości: "+(error.message||error));button.disabled=false;button.textContent="✉ Wyślij wiadomość";}
}
function vonHalskyFormPrzesylkiHTML(order={},shipping={},shipment={},replacement=false){
  const draft={...(shipping.draft||{}),...(shipment.configuration||{})},validation=shipping.validation||{},errors=Array.isArray(validation.errors)?validation.errors:[];
  const selected=(name,value)=>String(draft[name]||"")===value?"selected":"";
  return `<form class="von-halsky-shipment-form${replacement?" is-replacement":""}" onsubmit="vonHalskyUtworzPrzesylke(event,${jsArg(order.id)},${replacement})">
    <div class="von-halsky-shipment-primary"><label>Gabaryt<select name="gabaryt"><option value="small" ${selected("gabaryt","small")}>A — 8 × 38 × 64 cm</option><option value="medium" ${selected("gabaryt","medium")}>B — 19 × 38 × 64 cm</option><option value="large" ${selected("gabaryt","large")}>C — 41 × 38 × 64 cm</option></select></label><label>Sposób przekazania<select name="sposobNadania"><option value="parcel_locker" ${selected("sposobNadania","parcel_locker")}>Nadaję w Paczkomacie</option><option value="dispatch_order" ${selected("sposobNadania","dispatch_order")}>Przesyłkę odbierze kurier</option><option value="pop" ${selected("sposobNadania","pop")}>Nadaję w PaczkoPunkcie</option></select></label><label>Punkt nadawczy<input name="punktNadania" maxlength="40" value="${esc(draft.punktNadania||"")}" placeholder="opcjonalnie, np. BOJ01N"></label><label>Punkt odbioru<input name="targetPoint" maxlength="40" value="${esc(draft.targetPoint||"")}" ${String(order.delivery?.deliveryType||"").toUpperCase()==="APM"?"required":""}></label></div>
    <fieldset><legend>Dane odbiorcy przekazywane do InPost</legend><div><label>Imię<input name="recipientFirstName" maxlength="80" value="${esc(draft.recipientFirstName||"")}" required></label><label>Nazwisko<input name="recipientLastName" maxlength="80" value="${esc(draft.recipientLastName||"")}" required></label><label>E-mail<input name="recipientEmail" type="email" maxlength="200" value="${esc(draft.recipientEmail||"")}" required></label><label>Telefon<input name="recipientPhone" maxlength="20" value="${esc(draft.recipientPhone||"")}" required></label></div></fieldset>
    <details class="von-halsky-shipment-address"><summary>Adres odbiorcy i dane dodatkowe</summary><div><label>Ulica<input name="street" maxlength="160" value="${esc(draft.street||"")}"></label><label>Numer domu<input name="buildingNumber" maxlength="40" value="${esc(draft.buildingNumber||"")}"></label><label>Numer lokalu<input name="flatNumber" maxlength="40" value="${esc(draft.flatNumber||"")}"></label><label>Kod pocztowy<input name="postCode" maxlength="20" value="${esc(draft.postCode||"")}"></label><label>Miasto<input name="city" maxlength="120" value="${esc(draft.city||"")}"></label><label>Kraj<input name="countryCode" maxlength="2" value="${esc(draft.countryCode||"PL")}"></label></div></details>
    ${errors.length?`<div class="backend-note warning"><b>Przed nadaniem popraw dane</b><span>${errors.map(error=>esc(error.message||error)).join(" • ")}</span></div>`:""}
    ${replacement?`<div class="backend-note warning"><b>To będzie dodatkowa płatna przesyłka.</b><span>Potwierdzonej etykiety ${esc(shipment.trackingNumber||shipment.inpostId||"")} nie można już edytować ani anulować przez ShipX. Nowa przesyłka zostanie dopisana do tego samego zamówienia jako korekta / ponowne nadanie.</span></div>`:""}
    <label class="von-halsky-shipment-confirm"><input type="checkbox" name="confirmed" required><span>Sprawdziłem dane i potwierdzam utworzenie ${replacement?"nowej przesyłki korekcyjnej":"jednej płatnej przesyłki InPost"} dla zamówienia <b>${esc(order.id)}</b>.</span></label>
    ${replacement?`<label class="von-halsky-shipment-confirm danger"><input type="checkbox" name="replacementConfirmed" required><span>Rozumiem, że poprzednia etykieta pozostaje aktywna w InPost i może zostać rozliczona osobno.</span></label>`:""}
    <button class="btn" type="submit" ${shipping.configured===false||validation.ok===false?"disabled":""}>${replacement?"Utwórz nową przesyłkę korekcyjną":"Utwórz przesyłkę i połącz tracking"}</button>
  </form>`;
}
function vonHalskyRozpiskaKompletacjiHTML(order={},warehouse={}){
  const rows=vonHalskyRozpiskaZamowienia(order,warehouse),quantity=rows.reduce((sum,row)=>sum+row.quantity,0),matched=rows.filter(row=>row.product).length,located=rows.filter(row=>row.location).length,ready=rows.filter(row=>row.state==="ready").length,inPlan=rows.filter(row=>row.supplierDocuments.length).length,missing=rows.length-located;
  return `<section class="von-halsky-order-card von-halsky-products-card von-halsky-picking-card"><header><span>🎯</span><div><small>Produkty, stan i położenie — tylko odczyt</small><h3>${quantity} sztuk • ${rows.length} ${rows.length===1?"gra":"gry"}</h3></div><em class="von-halsky-readonly-badge">bez zmian Planu</em></header><div class="von-halsky-picking-overview"><span class="${matched===rows.length?"ready":"attention"}"><b>${matched}/${rows.length}</b><small>rozpoznane kartoteki</small></span><span class="${located===rows.length?"ready":"attention"}"><b>${located}/${rows.length}</b><small>ma zapisaną lokalizację</small></span><span class="${ready===rows.length?"ready":"attention"}"><b>${ready}/${rows.length}</b><small>gotowe do pobrania</small></span><span class="${inPlan?"attention":"ready"}"><b>${inPlan}/${rows.length}</b><small>informacyjnie w Planie</small></span>${missing?`<em>ℹ️ Brak lokalizacji jest informacją. Półki przypisuje się wyłącznie w Magazynie.</em>`:`<em class="ready">✓ Trasa kompletacji jest pełna</em>`}</div><div class="von-halsky-picking-list">${rows.map(row=>{const amount=Number(row.price?.amount),price=Number.isFinite(amount)?amount.toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2}):"—",currency=row.price?.currency||order.finalPrice?.currency||order.total?.currency||"PLN",stock=row.stock===null||row.stock===undefined?"niemonitorowany":`${row.stock} szt.`,location=row.location?`<span class="von-halsky-picking-location ready"><b>📍 ${esc(row.locationName||row.location)}</b><small>${esc(row.location)} • stan ${esc(stock)}</small></span>`:`<span class="von-halsky-picking-location ${row.stock===0?"unavailable":"missing"}"><b>${row.stock===0?"⛔ Brak sztuki do pobrania":"📍 Brak lokalizacji"}</b><small>${row.product?`Stan ${esc(stock)} • zarządzanie wyłącznie w Magazynie`:"Najpierw połącz pozycję z kartoteką"}</small></span>`,procurement=row.supplierDocuments.length?`<div class="von-halsky-picking-procurement in-plan"><b>🚚 Informacja z Planu zatowarowania</b>${row.supplierDocuments.map(document=>`<span>${esc(document.number)} • ${esc(document.supplier)} • ${esc(document.status)}</span>`).join("")}</div>`:row.stock===0?`<div class="von-halsky-picking-procurement pending"><b>Brak pokrycia w aktywnym dokumencie</b><small>Decyzje i aktualizacja są dostępne wyłącznie na podstronie Planu.</small></div>`:`<div class="von-halsky-picking-procurement stock"><b>✓ Pokryte z obecnego stanu</b><small>Nie wymaga zamówienia u producenta.</small></div>`;return `<article class="state-${esc(row.state)}"><span class="von-halsky-line-number">${row.index+1}</span>${row.product?.zdjecie?`<img src="${esc(row.product.zdjecie)}" alt="" loading="lazy">`:`<span class="von-halsky-picking-placeholder">🎲</span>`}<div class="von-halsky-picking-product"><b>${esc(row.name)}</b><small>EAN ${esc(row.ean||"—")} • SKU ${esc(row.sku||"—")}${row.product?` • ID ${esc(row.product.id)}`:""}</small><span>${row.quantity} szt. × ${esc(price)} ${esc(currency)}</span></div><div class="von-halsky-picking-place">${location}${row.product?procurement:`<div class="von-halsky-picking-unmatched"><b>Nie rozpoznano kartoteki</b><small>Sprawdź EAN ${esc(row.ean||"—")} lub SKU ${esc(row.sku||"—")} w katalogu produktów.</small></div>`}</div></article>`;}).join("")||`<div class="admin-empty-state compact"><span>○</span><div><b>Brak pozycji</b><small>Pobierz ponownie zamówienie z API.</small></div></div>`}</div></section>`;
}
function vonHalskyRozliczenieZamowieniaHTML(order={}){
  const rows=(Array.isArray(order.orderLines)?order.orderLines:[]).map(vonHalskyPozycjaZamowienia),currency=order.finalPrice?.currency||order.total?.currency||rows.find(row=>row.price?.currency)?.price?.currency||"PLN";
  const money=value=>{const amount=Number(value);return Number.isFinite(amount)?`${amount.toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency}`:"—";};
  const itemsTotal=rows.reduce((sum,row)=>{const amount=Number(row.price?.amount);return sum+(Number.isFinite(amount)?amount*row.quantity:0);},0),hasItemsAmount=rows.some(row=>Number.isFinite(Number(row.price?.amount))),finalTotal=order.finalPrice?.amount??order.total?.amount;
  const deliveryAmount=order.delivery?.price?.amount??order.deliveryPrice?.amount??order.shippingPrice?.amount,discountAmount=order.discount?.amount??order.totalDiscount?.amount??order.discounts?.total?.amount,payment=order.paymentDetails||order.payment||{},paymentStatus=payment.status||"status płatności nieprzekazany",paymentMethod=payment.method||payment.type||payment.provider||"metoda nieprzekazana";
  return `<section class="von-halsky-commercial-foreground"><article class="von-halsky-order-card von-halsky-commercial-products"><header><span>🛒</span><div><small>Najważniejsze w zamówieniu</small><h3>Produkty i ilości</h3></div><b>${rows.reduce((sum,row)=>sum+row.quantity,0)} szt.</b></header><div>${rows.map((row,index)=>{const unit=Number(row.price?.amount),lineTotal=Number.isFinite(unit)?unit*row.quantity:null;return `<article><span>${index+1}</span><div><b>${esc(row.name)}</b><small>${row.quantity} szt. × ${esc(money(row.price?.amount))} • EAN ${esc(row.ean||"—")}</small></div><strong>${esc(money(lineTotal))}</strong></article>`;}).join("")||`<div class="admin-empty-state compact"><span>○</span><div><b>Brak pozycji z API</b></div></div>`}</div></article><article class="von-halsky-order-card von-halsky-payment-card"><header><span>💳</span><div><small>Rozliczenie</small><h3>Płatność i opłaty</h3></div></header><dl><div><dt>Produkty</dt><dd>${esc(hasItemsAmount?money(itemsTotal):"brak rozbicia w API")}</dd></div><div><dt>Dostawa</dt><dd>${esc(deliveryAmount===undefined?"brak osobnej pozycji w API":money(deliveryAmount))}</dd></div><div><dt>Rabat</dt><dd>${esc(discountAmount===undefined?"brak osobnej pozycji w API":`− ${money(discountAmount)}`)}</dd></div><div class="total"><dt>Łącznie</dt><dd>${esc(money(finalTotal))}</dd></div></dl><footer><span><small>Status płatności</small><b>${esc(paymentStatus)}</b></span><span><small>Metoda</small><b>${esc(paymentMethod)}</b></span></footer></article></section>`;
}
function vonHalskySzczegolyZamowieniaHTML(data={},activeSection="overview"){
  const order=data.order||{},shipment=data.shipment||{},shipping=data.shipping||{},customer=order.customer||{},delivery=order.delivery||{},lines=Array.isArray(order.orderLines)?order.orderLines:[],status=String(order.status||"—");
  const recipient=[customer.firstName,customer.lastName].filter(Boolean).join(" ")||delivery.name||"—",amount=order.finalPrice?.amount??order.total?.amount??"—",currency=order.finalPrice?.currency||order.total?.currency||"PLN";
  const hasShipment=Boolean(shipment.inpostId),linked=shipment.vonHalskyLinked===true,stage=shipment.stage||vonHalskyRealizacjaZamowienia(order);
  const steps=[["decision","Przyjęte"],["awaiting_shipment","Do nadania"],["shipped","Nadane"],["in_transit","W transporcie"],["delivered","Dostarczone"]],current=Math.max(0,steps.findIndex(([key])=>key===stage.key));
  const quantity=lines.reduce((sum,line)=>sum+(Number(line.quantity)||1),0),payment=order.paymentDetails?.status||order.payment?.status||"opłacone / przyjęte",labelFormat=inpostEtykietaUstawieniaLokalne().labelDefaultFormat,otherFormat=labelFormat==="A6"?"A4":"A6";
  return `<div class="von-halsky-order-detail-grid">
    <section class="von-halsky-order-hero"><div><span class="von-halsky-order-channel">INPOST VON HALSKY • ZAMÓWIENIE ${esc(order.id)}</span><h2>${esc(recipient)}</h2><p>${esc(vonHalskyAdresZamowienia(order)||delivery.deliveryPoint||"Adres oczekuje na uzupełnienie")}</p><div class="von-halsky-order-hero-badges"><span>${esc(status)}</span><span class="${stage.requiresAction?"attention":"ready"}">${stage.requiresAction?"!":"✓"} ${esc(stage.label||"Do sprawdzenia")}</span><span>${esc(payment)}</span></div></div><div class="von-halsky-order-value"><small>Wartość zamówienia</small><strong>${esc(amount)} <span>${esc(currency)}</span></strong><em>${quantity} szt. • ${lines.length} ${lines.length===1?"pozycja":"pozycji"}</em></div></section>
    ${vonHalskySprawaNawigacjaHTML(data,activeSection)}
    <section class="von-halsky-case-panel overview" data-case-section="overview" ${activeSection==="overview"?"":"hidden"}>${vonHalskyRozliczenieZamowieniaHTML(order)}<section class="von-halsky-fulfillment-flow" aria-label="Etap realizacji">${steps.map(([key,label],index)=>`<div class="${index<=current?"done":""} ${key===stage.key?"current":""}"><span>${index<current?"✓":index+1}</span><b>${label}</b><small>${key===stage.key?"aktualny etap":index<current?"zakończone":"oczekuje"}</small></div>`).join("")}</section>${vonHalskySzybkieAkcjeHTML(data)}<section class="von-halsky-order-card von-halsky-customer-card"><header><span>👤</span><div><small>Dane doręczenia</small><h3>${esc(recipient)}</h3></div></header><dl><div><dt>E-mail</dt><dd>${esc(delivery.email||customer.email||"—")}</dd></div><div><dt>Telefon</dt><dd>${esc(delivery.phoneNumber||customer.phoneNumber||"—")}</dd></div><div><dt>Pełny adres</dt><dd>${esc(vonHalskyAdresZamowienia(order)||"—")}</dd></div><div><dt>Rodzaj dostawy</dt><dd>${esc(delivery.deliveryType||"—")}${delivery.deliveryPoint?` • ${esc(delivery.deliveryPoint)}`:""}</dd></div></dl></section></section>
    <section class="von-halsky-case-panel products" data-case-section="products" ${activeSection==="products"?"":"hidden"}>${vonHalskyRozpiskaKompletacjiHTML(order,data.warehouse||{})}</section>
    <section class="von-halsky-case-panel shipment" data-case-section="shipment" ${activeSection==="shipment"?"":"hidden"}><section class="von-halsky-order-card von-halsky-shipment-card"><header><span>📦</span><div><small>Centrum przesyłki</small><h3>${hasShipment?esc(stage.label||"Przesyłka utworzona"):"Nadaj przesyłkę"}</h3></div><em class="lvl ${hasShipment?(linked?"lvl-ok":"lvl-info"):"lvl-ostrzezenie"}">${hasShipment?(linked?"połączona":"synchronizacja"):"nie nadano"}</em></header>
      ${hasShipment?`<div class="von-halsky-shipment-ids"><div><small>Numer przesyłki</small><b>${esc(shipment.trackingNumber||"oczekuje")}</b>${shipment.trackingNumber?`<button type="button" onclick="vonHalskyKopiuj(${jsArg(shipment.trackingNumber)},'Numer przesyłki')">Kopiuj</button>`:""}</div><div><small>Status InPost</small><b>${esc(shipment.status||"utworzona")}</b></div><div><small>ID ShipX</small><b>${esc(shipment.inpostId)}</b></div><div><small>Reference</small><b>${esc(shipment.reference||order.id)}</b></div></div><div class="von-halsky-label-console"><div><span>🏷️</span><div><small>Domyślny wydruk</small><b>${esc(labelFormat)} • ${inpostEtykietaUstawieniaLokalne().labelAutoPrint?"automatyczny dialog":"podgląd przed drukiem"}</b></div><a href="#/admin/wysylki/inpost-ustawienia">Ustawienia</a></div>${shipment.labelReady?`<button class="btn von-halsky-label-primary" type="button" onclick="vonHalskyPobierzEtykiete(${jsArg(order.id)},${jsArg(labelFormat)},this)">👁 Podgląd i druk ${esc(labelFormat)}</button><button class="btn ghost" type="button" onclick="vonHalskyPobierzEtykiete(${jsArg(order.id)},${jsArg(otherFormat)},this)">Podgląd ${esc(otherFormat)}</button>`:`<button class="btn ghost" type="button" disabled>PDF po potwierdzeniu InPost</button>`}</div><div class="von-halsky-shipment-actions"><button class="btn ghost" type="button" onclick="vonHalskySprawdzPrzesylke(${jsArg(order.id)},this)">↻ Odśwież status InPost</button></div><div class="backend-note ${shipment.editable?"":"warning"}"><b>${shipment.editable?"Przesyłkę można jeszcze zmienić.":"Przesyłka jest potwierdzona."}</b><span>${shipment.editable?"Korekta danych jest możliwa przed zakupem etykiety.":"Dalsza zmiana wymaga utworzenia kontrolowanej przesyłki korekcyjnej."}</span></div>${!shipment.editable?`<details class="von-halsky-replacement"><summary>＋ Korekta / ponowne nadanie</summary>${vonHalskyFormPrzesylkiHTML(order,shipping,shipment,true)}</details>`:""}`:vonHalskyFormPrzesylkiHTML(order,shipping,shipment,false)}
    </section></section>
    <section class="von-halsky-case-panel communication" data-case-section="communication" ${activeSection==="communication"?"":"hidden"}>${vonHalskyKomunikacjaHTML(data)}</section>
    <section class="von-halsky-case-panel after-sales" data-case-section="after-sales" ${activeSection==="after-sales"?"":"hidden"}>${vonHalskyPosprzedazHTML(data)}</section>
    <section class="von-halsky-case-panel history" data-case-section="history" ${activeSection==="history"?"":"hidden"}>${vonHalskyHistoriaOperacjiHTML(data)}</section>
  </div>`;
}
function vonHalskyPodmienSzczegolyZamowienia(id,data){
  const shell=[...document.querySelectorAll(".von-halsky-record-dialog-shell")].find(node=>node.dataset.orderId===String(id)),main=shell?.querySelector("main");if(!main)return;
  const activeSection=shell.dataset.activeSection||"overview";shell._vonHalskyDetailData=data;main.innerHTML=vonHalskySzczegolyZamowieniaHTML(data,activeSection);
}
function vonHalskyZapiszZamowienieWRekordach(order,shipment={}){
  const index=(vonHalskyStan.records.items||[]).findIndex(item=>String(item.id||"")===String(order?.id||""));if(index>=0)vonHalskyStan.records.items[index]={...order,_artwayShipment:{...(vonHalskyStan.records.items[index]?._artwayShipment||{}),...shipment},...(shipment?.stage?{_fulfillment:shipment.stage}:{})};
}
function vonHalskyZapiszKomunikacjeWRekordach(orderId,communication={}){
  const index=(vonHalskyStan.records.items||[]).findIndex(item=>String(item.id||"")===String(orderId||""));if(index<0)return;const item=vonHalskyStan.records.items[index];vonHalskyStan.records.items[index]={...item,_artwayCommunication:{...(item._artwayCommunication||{}),history:Array.isArray(communication.history)?communication.history:[]}};
}
async function vonHalskyKopiuj(value,label="Wartość"){
  try{await navigator.clipboard.writeText(String(value||""));toast(`${label} skopiowany ✅`);}catch(e){toast(`Nie skopiowano: ${value}`);}
}
async function vonHalskyUtworzPrzesylke(event,orderId,replaceExisting=false){
  event.preventDefault();const form=event.currentTarget,button=event.submitter||form.querySelector("button[type=submit]"),fd=new FormData(form);button.disabled=true;
  const fields=["gabaryt","sposobNadania","punktNadania","targetPoint","recipientFirstName","recipientLastName","recipientEmail","recipientPhone","street","buildingNumber","flatNumber","postCode","city","countryCode"],body={orderId,confirmed:fd.get("confirmed")==="on",replaceExisting,replacementConfirmed:fd.get("replacementConfirmed")==="on"};
  for(const field of fields)body[field]=String(fd.get(field)||"").trim();
  try{const data=await chmura("von-halsky-order-shipment-create",{method:"POST",body,timeout:45000});vonHalskyZapiszZamowienieWRekordach(data.order,data.shipment);vonHalskyPodmienSzczegolyZamowienia(orderId,data);vonHalskyAktualizujZamowieniaDOM();void vonHalskyLadujDashboard(true);toast(data.idempotent?"Ta przesyłka już istniała — nie utworzono duplikatu ✅":data.replacement?"Nowa przesyłka korekcyjna została utworzona ✅":"Przesyłka InPost utworzona i zapisana ✅");}catch(error){toast("Nie utworzono przesyłki: "+(error.message||error));button.disabled=false;}
}
async function vonHalskySprawdzPrzesylke(orderId,button){
  button.disabled=true;try{const data=await chmura("von-halsky-order-shipment-status",{method:"POST",body:{orderId},timeout:30000});vonHalskyZapiszZamowienieWRekordach(data.order,data.shipment);vonHalskyPodmienSzczegolyZamowienia(orderId,data);vonHalskyAktualizujZamowieniaDOM();void vonHalskyLadujDashboard(true);toast(data.shipment?.vonHalskyLinked?"Numer przesyłki jest dopisany do Von Halsky ✅":"InPost działa; Von Halsky jeszcze nie zwrócił parceli — sprawdź ponownie za chwilę");}catch(error){toast("Nie odświeżono przesyłki: "+(error.message||error));button.disabled=false;}
}
async function vonHalskyPobierzEtykiete(orderId,format,button){
  const shell=[...document.querySelectorAll(".von-halsky-record-dialog-shell")].find(node=>node.dataset.orderId===String(orderId)),order=(vonHalskyStan.records.items||[]).find(item=>String(item.id||"")===String(orderId))||shell?._vonHalskyDetailData?.order,id=order?._artwayShipment?.inpostId||shell?._vonHalskyDetailData?.shipment?.inpostId;if(!id)return toast("Brak ID przesyłki InPost");button.disabled=true;
  try{await inpostOtworzPodgladEtykiety({id,format,reference:orderId});}catch(error){toast("Nie otwarto etykiety: "+(error.message||error));}finally{button.disabled=false;}
}
async function vonHalskyOtworzSpraweZamowienia(orderId,activeSection="overview"){
  const key=String(orderId||"").trim();if(!key)return toast("Brak numeru powiązanego zamówienia");
  const existing=[...document.querySelectorAll(".von-halsky-record-dialog-shell")].find(node=>node.dataset.orderId===key);
  if(existing){const tab=existing.querySelector(`[data-case-target="${activeSection}"]`);if(tab)vonHalskyWybierzSekcjeSprawy(tab,activeSection);return;}
  const cachedOrder=(vonHalskyStan.records.items||[]).find(item=>String(item?.id||"")===key)||{id:key,orderLines:[]};
  const related=(vonHalskyStan.records.items||[]).find(item=>String(item?.relatedOrder?.orderId||item?.orderId||item?.order?.id||"")===key);
  const cachedAfterSales={returns:related?._caseKind==="return"?[related]:[],claims:related?._caseKind==="claim"?[related]:[],open:related?1:0};
  const cachedData={order:cachedOrder,shipment:{...(cachedOrder._artwayShipment||{}),stage:vonHalskyRealizacjaZamowienia(cachedOrder)},communication:{configured:false,recipient:vonHalskyZamowienieKlient(cachedOrder),history:vonHalskyHistoriaWiadomosci(cachedOrder)},afterSales:cachedAfterSales,warehouse:{readOnly:true,supplierDocuments:[]},shipping:{configured:false,validation:{ok:false,errors:[{message:"Trwa szybki odczyt ustawień wysyłki."}]}},loading:true};
  const shell=document.createElement("div");shell.className="von-halsky-record-dialog-shell";shell.dataset.orderId=key;shell.dataset.activeSection=activeSection;shell.innerHTML=`<section role="dialog" aria-modal="true" class="von-halsky-record-dialog von-halsky-order-center"><header><div><small>Centrum sprawy klienta</small><h2>Zamówienie ${esc(key)}</h2></div><button class="btn ghost" data-close>✕ Zamknij</button></header><main>${vonHalskySzczegolyZamowieniaHTML(cachedData,activeSection)}</main></section>`;shell._vonHalskyDetailData=cachedData;shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))shell.remove();});document.body.appendChild(shell);
  try{const [data]=await Promise.all([chmura("von-halsky-order-shipment-preview",{params:{orderId:key},timeout:20000}),inpostEtykietaPobierzUstawienia().catch(()=>null)]);if(!shell.isConnected)return;vonHalskyZapiszZamowienieWRekordach(data.order,data.shipment);vonHalskyPodmienSzczegolyZamowienia(key,data);vonHalskyAktualizujZamowieniaDOM();void vonHalskyLadujDashboard(true);void vonHalskyZaladujKartotekiZamowienia(data.order).then(()=>{if(shell.isConnected)vonHalskyPodmienSzczegolyZamowienia(key,data);});}catch(error){const main=shell.querySelector("main");if(main)main.insertAdjacentHTML("afterbegin",`<div class="backend-note warning"><b>Nie odświeżono pełnych danych sprawy</b><span>${esc(error.message||error)}</span></div>`);}
}
async function vonHalskyOtworzSzczegolyRekordu(id){
  const item=(vonHalskyStan.records.items||[]).find(row=>vonHalskyRekordId(row)===String(id));if(!item)return;
  if(vonHalskyStan.records.view==="orders")return vonHalskyOtworzSpraweZamowienia(id,"overview");
  if(vonHalskyStan.records.view==="cases"){const orderId=item.relatedOrder?.orderId||item.orderId||item.order?.id;if(!orderId)return toast("Zgłoszenie nie ma numeru powiązanego zamówienia");return vonHalskyOtworzSpraweZamowienia(orderId,"after-sales");}
  const shell=document.createElement("div");shell.className="von-halsky-record-dialog-shell";shell.innerHTML=`<section role="dialog" aria-modal="true" class="von-halsky-record-dialog"><header><div><small>Szczegóły rekordu API</small><h2>${esc(id)}</h2></div><button class="btn ghost" data-close>✕ Zamknij</button></header><main><dl>${Object.entries(item).filter(([key,value])=>!key.startsWith("_")&&value!==null&&value!==undefined&&typeof value!=="object").map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></main></section>`;shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))shell.remove();});document.body.appendChild(shell);
}
function vonHalskyOtworzDecyzje(type,id){
  const item=vonHalskyZnajdzRekordSprawy(id)||{},refund=type==="refund",claim=type==="claim";
  const title={ "order-accept":"Przyjąć zamówienie?","order-refuse":"Odrzucić zamówienie?","return-accept":"Zaakceptować zwrot?","return-refuse":"Odrzucić zwrot?",refund:"Zlecić refundację?",claim:"Rozstrzygnąć reklamację?" }[type]||"Potwierdź operację";
  const maximum=Number(item.finalPrice?.amount||item.total?.amount||0);
  const shell=document.createElement("div");shell.className="von-halsky-record-dialog-shell";shell.innerHTML=`<section role="dialog" aria-modal="true" class="von-halsky-decision-dialog"><header><div><small>Operacja wymagająca potwierdzenia</small><h2>${esc(title)}</h2><p>${esc(id)}</p></div><button class="btn ghost" data-close>✕</button></header><form><main>${refund?`<label>Kwota refundacji<input name="amount" type="number" min="0.01" max="${maximum}" step="0.01" value="${maximum.toFixed(2)}" required><small>Maksymalnie ${maximum.toFixed(2)} PLN.</small></label>`:""}${claim?`<label>Rozstrzygnięcie<select name="resolution"><option value="reject">Odrzuć reklamację</option><option value="partial-refund">Częściowy zwrot</option><option value="refund">Pełny zwrot</option></select></label><label>Uzasadnienie<textarea name="description" maxlength="1000" rows="5"></textarea></label>`:""}<div class="backend-note warning"><b>Operacja zostanie przekazana do API Von Halsky.</b><span>Po odpowiedzi zmieni się tylko właściwy rekord, bez przeładowania całej strony.</span></div></main><footer><button class="btn ghost" type="button" data-close>Anuluj</button><button class="btn" type="submit">Potwierdzam operację</button></footer></form></section>`;
  shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))shell.remove();});
  shell.querySelector("form").addEventListener("submit",async event=>{event.preventDefault();const button=event.submitter,fd=new FormData(event.currentTarget);button.disabled=true;try{
    if(type.startsWith("order-"))await chmura("von-halsky-order-state",{method:"POST",body:{orderId:id,accepted:type==="order-accept"},timeout:30000});
    else if(type.startsWith("return-"))await chmura("von-halsky-return-state",{method:"POST",body:{returnId:id,accepted:type==="return-accept"},timeout:30000});
    else if(refund)await chmura("von-halsky-order-refund",{method:"POST",body:{orderId:id,amount:Number(fd.get("amount"))},timeout:30000});
    else if(claim)await chmura("von-halsky-claim-state",{method:"POST",body:{orderId:item.relatedOrder?.orderId||item.orderId||"",claimId:id,resolution:fd.get("resolution"),description:fd.get("description")},timeout:30000});
    shell.remove();toast("Operacja została przyjęta przez API ✅");await vonHalskyLadujRekordy({force:true});void vonHalskyLadujDashboard(true);
  }catch(error){toast("Nie wykonano operacji: "+(error.message||error));button.disabled=false;}});
  document.body.appendChild(shell);shell.querySelector("input,select,textarea")?.focus();
}
