/* ═══════════ KATALOG PRODUKTÓW — AGENT I DECYZJE MASOWE ALLEGRO ═══════════ */
let asortymentAgentKolejka={busy:false,operation:"pelna",ids:[],done:0,total:0,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:"",finishedAt:""};
let asortymentAllegroDecyzja={step:"idle",busy:false,operation:"update",ids:[],skipped:0,done:0,total:0,ok:0,failed:0,error:"",results:[]};
let asortymentPelneProduktyCache=new Map();
let asortymentSerwerowaKolejka={batchId:"",checking:false,timer:null,lastCheck:0};
const ASORTYMENT_PELNY_PRODUKT_CACHE_MS=15*60*1000;

function asortymentProduktPoId(rawId){return pobierzProduktAdmin(rawId)||produktyDoAdministracji().find(p=>String(p.id)===String(rawId))||null;}
async function asortymentPobierzPelnyProdukt(rawId,{force=false}={}){
  const id=String(rawId??"").trim(),cached=asortymentPelneProduktyCache.get(id);
  if(!force&&cached&&Date.now()-cached.at<ASORTYMENT_PELNY_PRODUKT_CACHE_MS)return cached.product;
  const result=await chmura("product-catalog-item",{params:{id},timeout:30000}),product=result?.product;
  if(!product||String(product.id)!==id)throw new Error(`Nie udało się pobrać pełnej kartoteki produktu ${id}.`);
  asortymentPelneProduktyCache.delete(id);asortymentPelneProduktyCache.set(id,{at:Date.now(),product});
  while(asortymentPelneProduktyCache.size>250)asortymentPelneProduktyCache.delete(asortymentPelneProduktyCache.keys().next().value);
  return product;
}
function asortymentOfertaProduktu(p={}){return allegroOfertaDlaProduktuSklepu(p)||(p.allegroOfferId?allegroOfertaPoId(String(p.allegroOfferId)):null);}
function asortymentProduktyZId(ids=[]){return [...new Set(ids.map(String))].map(asortymentProduktPoId).filter(p=>p&&!czyProduktAdminWKoszu(p));}
function asortymentOdswiezCentrumDzialan(){
  const listing=document.querySelector("[data-allegro-publication-center]");
  if(listing&&typeof allegroPublikacjaCentrumOperacjiHTML==="function")listing.innerHTML=allegroPublikacjaCentrumOperacjiHTML();
  const el=document.querySelector("[data-product-agent-center]");if(el)el.innerHTML=asortymentCentrumDzialanHTML();
}
function asortymentOdswiezStanZaznaczenia(){
  document.querySelectorAll("[data-assortment-product-id]").forEach(input=>{const checked=zaznaczoneProdukty.has(Number(input.dataset.assortmentProductId))||zaznaczoneProdukty.has(input.dataset.assortmentProductId);input.checked=checked;const card=input.closest("[data-assortment-product-card]")||input.closest("tr");card?.classList.toggle("is-selected",checked);card?.classList.toggle("selected",checked);});
  document.querySelectorAll("[data-product-selection-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  document.querySelectorAll("[data-product-selection-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  const operations=document.querySelector('[data-admin-results-operations="assortment-products"]');
  operations?.querySelectorAll("[data-admin-selected-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  operations?.querySelectorAll("[data-admin-selected-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  asortymentOdswiezCentrumDzialan();
}
function asortymentUstawOperacjeAgenta(value){asortymentAgentKolejka.operation=String(value||"pelna");}
function asortymentUstawOperacjeZewnetrzna(value){asortymentAllegroDecyzja.operation=String(value||"update");}

function asortymentZastosujStanKolejkiSerwera(queue={},preferredBatchId=""){
  const batches=Array.isArray(queue.batches)?queue.batches:[],preferred=batches.find(item=>String(item.id)===String(preferredBatchId||asortymentSerwerowaKolejka.batchId)),working=batches.find(item=>Number(item.pending||0)+Number(item.running||0)>0),newest=batches[0]||null;
  const batch=working||(newest&&preferred&&Date.parse(newest.requestedAt||0)>Date.parse(preferred.requestedAt||0)?newest:preferred)||newest||null;
  if(!batch)return false;
  asortymentSerwerowaKolejka.batchId=String(batch.id||"");
  const trackedTaskIds=new Set((Array.isArray(batch.trackedTaskIds)?batch.trackedTaskIds:[]).map(String));
  const recent=(Array.isArray(queue.recent)?queue.recent:[]).filter(item=>trackedTaskIds.size?trackedTaskIds.has(String(item.id)):String(item.batchId)===asortymentSerwerowaKolejka.batchId);
  const results=recent.map(item=>({id:String(item.productId||""),name:item.name||`Produkt ${item.productId}`,ok:item.status!=="failed",ready:item.ready===true,missing:item.missing||[],savedFields:item.savedFields||[],error:item.error||""}));
  const queuedIds=[...(Array.isArray(batch.pendingProductIds)?batch.pendingProductIds:[]),...(batch.activeProductId?[batch.activeProductId]:[])].map(String);
  queuedIds.forEach(id=>podmienProduktAdminBezRenderu(id,{allegroAgentPreparationStatus:"queued",allegroAgentPreparationError:"",allegroAgentPreparationMissing:[]}));
  recent.forEach(item=>podmienProduktAdminBezRenderu(item.productId,{
    allegroAgentPreparationStatus:item.status==="completed"?"ready":item.status==="attention"?"needs_attention":item.status==="failed"?"failed":"queued",
    allegroAgentPreparationError:item.error||"",
    allegroAgentPreparationMissing:item.missing||[],
    allegroAgentPreparedAt:item.completedAt||"",
  }));
  const done=Number(batch.completed||0)+Number(batch.attention||0)+Number(batch.failed||0),total=Math.max(Number(batch.total||0),done+Number(batch.pending||0)+Number(batch.running||0)),busy=Number(batch.pending||0)+Number(batch.running||0)>0;
  asortymentAgentKolejka={...asortymentAgentKolejka,busy,operation:batch.operation||"allegro",ids:[],done,total,ok:Number(batch.completed||0)+Number(batch.attention||0),warnings:Number(batch.attention||0),failed:Number(batch.failed||0),current:queue.active&&String(queue.active.batchId)===asortymentSerwerowaKolejka.batchId?`Produkt ${queue.active.productId}`:"",results,startedAt:batch.requestedAt||"",finishedAt:busy?"":queue.updatedAt||new Date().toISOString(),cloudSaved:!busy&&Number(batch.failed||0)===0};
  return true;
}
async function asortymentSprawdzKolejkeSerwera({render=true}={}){
  if(asortymentSerwerowaKolejka.checking)return;
  asortymentSerwerowaKolejka.timer=null;
  asortymentSerwerowaKolejka.checking=true;
  try{
    const response=await chmura("allegro-preparation-queue-status",{timeout:30000}),queue=response?.queue||{};
    const found=asortymentZastosujStanKolejkiSerwera(queue);
    if(found&&render)asortymentOdswiezCentrumDzialan();
    if(asortymentAgentKolejka.busy){
      clearTimeout(asortymentSerwerowaKolejka.timer);asortymentSerwerowaKolejka.timer=setTimeout(()=>void asortymentSprawdzKolejkeSerwera(),2500);
    }else if(found){
      asortymentPelneProduktyCache.clear();
      if(typeof asortymentCentralnyWyczyscCache==="function")asortymentCentralnyWyczyscCache();
      await asortymentCentralnyPobierz(true,{render:false}).catch(()=>null);
      if(render&&asortymentCentralnyTrasaAktywna())renderuj();
    }
  }catch(error){if(asortymentAgentKolejka.busy){clearTimeout(asortymentSerwerowaKolejka.timer);asortymentSerwerowaKolejka.timer=setTimeout(()=>void asortymentSprawdzKolejkeSerwera(),5000);}}
  finally{asortymentSerwerowaKolejka.checking=false;asortymentSerwerowaKolejka.lastCheck=Date.now();}
}
function asortymentZapewnijMonitorKolejkiSerwera(){
  if(asortymentSerwerowaKolejka.checking||asortymentSerwerowaKolejka.timer||Date.now()-asortymentSerwerowaKolejka.lastCheck<10000)return;
  setTimeout(()=>void asortymentSprawdzKolejkeSerwera({render:false}),0);
}
async function asortymentUruchomAgentaNaSerwerze(products=[],operation="allegro"){
  if(asortymentAgentKolejka.busy){toast("Agent ma już aktywną kolejkę produktów");return;}
  asortymentAgentKolejka={busy:true,operation,ids:products.map(p=>String(p.id)),done:0,total:products.length,ok:0,warnings:0,failed:0,cancel:false,current:"przekazywanie na serwer",results:[],startedAt:new Date().toISOString(),finishedAt:""};asortymentOdswiezCentrumDzialan();
  try{
    const response=await chmura("allegro-preparation-queue-enqueue",{method:"POST",body:{productIds:products.map(p=>String(p.id)),operation},timeout:30000}),queue=response?.queue||{};
    products.forEach(p=>podmienProduktAdminBezRenderu(p.id,{allegroAgentPreparationStatus:"queued",allegroAgentPreparationError:"",allegroAgentPreparationMissing:[]}));
    asortymentSerwerowaKolejka.batchId=String(queue.batchId||"");asortymentZastosujStanKolejkiSerwera(queue,queue.batchId);
    toast(`🤖 Serwer przejął kolejkę ${products.length} produktów — możesz odświeżyć lub zamknąć kartę`);
    clearTimeout(asortymentSerwerowaKolejka.timer);asortymentSerwerowaKolejka.timer=setTimeout(()=>void asortymentSprawdzKolejkeSerwera(),1000);asortymentOdswiezCentrumDzialan();
  }catch(error){asortymentAgentKolejka={...asortymentAgentKolejka,busy:false,failed:products.length,current:"",finishedAt:new Date().toISOString(),cloudSaved:false,results:products.map(p=>({id:String(p.id),name:p.nazwa||"Produkt",ok:false,error:error.message||String(error)}))};asortymentOdswiezCentrumDzialan();toast(`⛔ Serwer nie przejął kolejki: ${error.message||error}`);}
}

async function asortymentSeoAgenta(p={}){
  if(typeof seoAutomatyzujDaneProduktu!=="function")return false;
  const next=seoAutomatyzujDaneProduktu({...p},"agent-katalogu",{force:false}),patch={};
  for(const key of ["seoTitle","seoDescription","seoKeywords","seoScore","seoReviewedAt","seoSource","seoMode"])if(next[key]!==undefined&&String(next[key])!==String(p[key]??""))patch[key]=next[key];
  return Object.keys(patch).length?zapiszPolaProduktuTrwale(p.id,patch,false,"catalog-agent-seo"):false;
}
const ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO=["nazwa","allegroTitle","opisKrotki","opis","allegroDescription","producent","marka","gtin","ean","kodProducenta","mpn","zdjecie","zdjecia","sourceEvidence","allegroCategoryId","allegroProductId","allegroParameters","allegroDescriptionSections","allegroSafetyInformation","allegroResponsibleProducer","allegroShippingSubsidy"];
const ASORTYMENT_POLA_TRWALEGO_ZAPISU_ALLEGRO=[...ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO,"allegroShortDescription","contentEditorial","sourceMaterial","sourceUrl","producentUrl","externalId","sku","numerReferencyjny","parametryProducenta","parametryZrodla","dostepnoscProducenta","stanProducenta","stanProducentaDokladny","stanProducentaZrodlo","producentStatus","producentSprawdzonoAt","contentEditorialPreparedAt","contentEditorialSource","allegroDescriptionSource","allegroEditorialSyncPending","allegroEditorialSyncRequestedAt","allegroEditorialSyncError","allegroAgentPreparationStatus","allegroAgentPreparationMissing","allegroAgentSavedFields","allegroAgentPreparedAt","allegroAgentPreparationStartedAt","allegroAgentPreparationSource","allegroAgentDraftOperation","allegroAgentCompliancePolicy","allegroAgentComplianceCheckedAt","allegroAgentPreparationError","allegroAgentPreparationCheckedAt","allegroAgentPreparationFingerprint","allegroAgentPreparationVersion","allegroAgentPreparationRunId","allegroAgentPreparationConfirmedAt","allegroAgentPreparationConfirmedRevision","seoTitle","seoDescription","seoKeywords","seoScore","seoReviewedAt","seoSource","seoMode"];
const ASORTYMENT_ETYKIETY_POL_ALLEGRO={nazwa:"nazwa",allegroTitle:"tytuł Allegro",opisKrotki:"opis krótki sklepu",opis:"opis długi sklepu",allegroDescription:"opis Allegro",producent:"producent",marka:"marka",gtin:"GTIN",ean:"EAN",kodProducenta:"kod producenta",mpn:"MPN",zdjecie:"zdjęcie główne ze źródła",zdjecia:"galeria ze źródła",sourceEvidence:"potwierdzenie źródła zdjęć",allegroCategoryId:"kategoria Allegro",allegroProductId:"produkt katalogowy Allegro",allegroParameters:"parametry Allegro",allegroDescriptionSections:"układ opisu Allegro",allegroSafetyInformation:"informacja bezpieczeństwa GPSR",allegroResponsibleProducer:"odpowiedzialny producent GPSR",allegroShippingSubsidy:"dopłata do wysyłki"};
function asortymentMigawkaPrzygotowania(p={}){return Object.fromEntries(ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.map(key=>[key,p[key]]));}
function asortymentPolaZmienione(before={},after={}){return ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.filter(key=>JSON.stringify(before[key]??null)!==JSON.stringify(after[key]??null));}
function asortymentEtykietyPol(keys=[]){return keys.map(key=>ASORTYMENT_ETYKIETY_POL_ALLEGRO[key]||key);}
function asortymentPolaDoTrwalegoZapisu(p={}){
  return Object.fromEntries(ASORTYMENT_POLA_TRWALEGO_ZAPISU_ALLEGRO.filter(key=>p[key]!==undefined).map(key=>[key,p[key]]));
}
function asortymentStabilnyJson(value){
  if(Array.isArray(value))return `[${value.map(asortymentStabilnyJson).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${asortymentStabilnyJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function asortymentSygnaturaPrzygotowania(p={}){
  const raw=asortymentStabilnyJson(ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.map(key=>[key,p[key]??null])),bytes=new TextEncoder().encode(raw);let hash=2166136261;
  for(const byte of bytes){hash^=byte;hash=Math.imul(hash,16777619);}
  return `allegro-preparation-v4-${(hash>>>0).toString(16).padStart(8,"0")}`;
}
async function asortymentZapiszProduktCentralnie(p={},startedAt=""){
  const productId=String(p.id??"").trim(),mutationId=`allegro-preparation:${productId}:${String(startedAt||Date.now()).replace(/[^0-9A-Za-z:._-]/g,"").slice(0,80)}`;
  if(!productId)throw new Error("Brakuje ID produktu — Agent nie może potwierdzić zapisu.");
  const result=await chmura("catalog-product-fields-update",{method:"POST",body:{productId,fields:asortymentPolaDoTrwalegoZapisu(p),mutationId,area:"allegro-preparation"},timeout:60000});
  if(result?.confirmed!==true||String(result.productId)!==productId||result.publication?.published!==true)throw new Error("Serwer nie potwierdził zapisu i publikacji pełnej kartoteki.");
  const confirmed=result.product&&String(result.product.id)===productId?result.product:{...p,...(result.fields||{})};
  asortymentPelneProduktyCache.set(productId,{at:Date.now(),product:confirmed});
  podmienProduktAdminBezRenderu(productId,result.fields||{});
  return {...result,product:confirmed};
}
function asortymentStatusPrzygotowania(p={}){
  const status=String(p.allegroAgentPreparationStatus||"");
  const missing=Array.isArray(p.allegroAgentPreparationMissing)?p.allegroAgentPreparationMissing:[];
  if(status==="queued")return {code:"queued",label:"W kolejce Agenta",note:"oczekuje na przygotowanie i trwały zapis na serwerze"};
  if(status==="ready"||status==="published")return {code:"ready",label:status==="published"?"Oferta zapisana w Allegro":"Gotowy do Allegro",note:(status==="published"?p.allegroAgentPublishedAt:p.allegroAgentPreparedAt)?`zapis ${new Date(status==="published"?p.allegroAgentPublishedAt:p.allegroAgentPreparedAt).toLocaleString("pl-PL")}`:"komplet danych"};
  if(status==="needs_attention"){const retry=Date.parse(p.allegroAgentPreparationNextRetryAt||"");return {code:"attention",label:"Wymaga uzupełnienia",note:`${missing.join(", ")||"sprawdź dane"}${Number.isFinite(retry)?` • Agent ponowi ${new Date(retry).toLocaleString("pl-PL")}`:" • Agent ponowi automatycznie"}`};}
  if(status==="failed")return {code:"failed",label:"Błąd przygotowania",note:p.allegroAgentPreparationError||"uruchom ponownie"};
  return {code:"new",label:"Nieprzygotowany",note:"Agent nie zapisał jeszcze kontroli"};
}
function asortymentStatusPrzygotowaniaHTML(p={}){const s=asortymentStatusPrzygotowania(p);return `<span class="product-allegro-preparation ${s.code}"><b>${s.code==="ready"?"✅":s.code==="attention"?"⚠️":s.code==="failed"?"⛔":s.code==="queued"?"⏳":"○"} ${esc(s.label)}</b><small>${esc(s.note)}</small></span>`;}
function asortymentPatchZPrzygotowania(p={},draft={}){
  const auto=draft.autoFilled||{},catalog=draft.catalogMatch?.selected||{},category=draft.categorySuggestion?.selected||{},patch={};
  const assign=(key,value)=>{if(value!==undefined&&value!==null&&value!=="")patch[key]=value;};
  assign("allegroTitle",auto.allegroTitle||p.allegroTitle);
  assign("producent",allegroProducentKanoniczny({...p,producent:auto.producent||p.producent,marka:auto.marka||p.marka})||auto.producent||p.producent||p.marka);
  assign("marka",auto.marka||p.marka||patch.producent);
  assign("gtin",auto.gtin||auto.ean||(catalog.eans||[])[0]||p.gtin||p.ean);
  assign("ean",auto.ean||auto.gtin||(catalog.eans||[])[0]||p.ean||p.gtin);
  assign("kodProducenta",auto.kodProducenta||auto.mpn||p.kodProducenta||p.mpn);
  assign("mpn",auto.mpn||auto.kodProducenta||p.mpn||p.kodProducenta);
  assign("allegroCategoryId",auto.allegroCategoryId||catalog.categoryId||category.id||p.allegroCategoryId);
  assign("allegroProductId",auto.allegroProductId||catalog.id||p.allegroProductId);
  if(auto.sourceEvidence?.imageSourceType==="product_source_page"){
    assign("zdjecie",auto.zdjecie);
    patch.zdjecia=Array.isArray(auto.zdjecia)?auto.zdjecia.slice(0,15):[];
    patch.sourceEvidence=auto.sourceEvidence;
  }
  if(Array.isArray(auto.allegroParameters)&&auto.allegroParameters.length)patch.allegroParameters=auto.allegroParameters;
  if(auto.allegroSafetyInformation?.type)patch.allegroSafetyInformation=auto.allegroSafetyInformation;
  if(auto.allegroResponsibleProducer?.id)patch.allegroResponsibleProducer=auto.allegroResponsibleProducer;
  const improved=draft.improvedDescriptions||{},safeSections=draft.draft?.description?.sections||improved.sections||[];
  if(Array.isArray(safeSections)&&safeSections.length)patch.allegroDescriptionSections=safeSections;
  const full=String(improved.storeFullDescription||improved.fullDescription||p.opis||"").trim(),short=String(improved.storeShortDescription||improved.shortDescription||p.opisKrotki||(full?agentAITnijDoZdania(full,500):"")).trim(),allegroFull=String(improved.allegroDescription||full||allegroTekstZBezpiecznychSekcji(safeSections)||"").trim();
  if(full)patch.opis=full;if(short)patch.opisKrotki=short;if(allegroFull)patch.allegroDescription=allegroFull;
  patch.allegroShippingSubsidy=p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI;
  return patch;
}
async function asortymentPrzygotujProduktDoAllegro(base={},options={}){
  const productId=String(base.id??"").trim();
  if(!productId)throw new Error("Brakuje ID produktu.");
  const enqueue=await chmura("allegro-preparation-queue-enqueue",{method:"POST",body:{
    productIds:[productId],operation:options.includeSeo?"pelna":"allegro"
  },timeout:30000});
  const batchId=String(enqueue?.queue?.batchId||""),started=Date.now();
  if(!batchId)throw new Error("Serwer nie zwrócił numeru kolejki przygotowania.");
  let result=null;
  while(Date.now()-started<5*60*1000){
    const status=await chmura("allegro-preparation-queue-status",{timeout:30000});
    const queue=status?.queue||{},batch=(queue.batches||[]).find(item=>String(item.id)===batchId);
    if(!batch)throw new Error("Serwer nie odnalazł utworzonej partii przygotowania.");
    const taskIds=new Set((batch.trackedTaskIds||[]).map(String));
    result=(queue.recent||[]).find(item=>taskIds.has(String(item.id)))||null;
    const terminal=Number(batch.completed||0)+Number(batch.attention||0)+Number(batch.failed||0);
    if(result&&terminal>=Number(batch.total||1)&&!Number(batch.pending||0)&&!Number(batch.running||0))break;
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!result)throw new Error("Przygotowanie nadal pracuje na serwerze — sprawdź monitor kolejki.");
  if(result.status==="failed")throw new Error(result.error||"Serwer nie potwierdził przygotowania produktu.");
  const p=await asortymentPobierzPelnyProdukt(productId,{force:true});
  if(!p)throw new Error("Po przygotowaniu nie udało się odczytać produktu z centralnej kartoteki.");
  const draft=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:90000});
  const missing=[...new Set([...(result.missing||[]),...(draft.missing||[])].map(String).filter(Boolean))];
  const ready=result.ready===true&&missing.length===0&&draft.compliance?.ok!==false;
  return {
    id:productId,name:p.nazwa||"Produkt",product:p,draft,ready,missing,
    savedFields:result.savedFields||[],warnings:result.reused?["wykorzystano aktualne, wcześniej potwierdzone przygotowanie serwerowe"]:[],
    persistence:{confirmed:true,mutationId:result.mutationId||"",publication:{published:true,readbackConfirmed:true}},
  };
}
async function asortymentAgentPrzetworzProdukt(base,operation){
  let p=asortymentProduktPoId(base.id)||base;const warnings=[];let preparation=null;
  if(["pelna","allegro","szkic","dane"].includes(operation)){
    preparation=await asortymentPrzygotujProduktDoAllegro(p,{refreshSource:["pelna","allegro"].includes(operation),includeSeo:operation==="pelna"});p=preparation.product;warnings.push(...preparation.warnings);if(preparation.missing.length)warnings.push(`do uzupełnienia: ${preparation.missing.join(", ")}`);
  }else if(operation==="zrodlo"){
    if(p.sourceUrl||p.producentUrl)p=await automatyczniePobierzDaneZrodlaProduktu(p);else warnings.push("brak linku producenta");
  }
  if(operation==="seo")await asortymentSeoAgenta(p);
  if(["pelna","prowizja"].includes(operation)){
    const price=kwotaNum(p.cenaAllegro||p.cena),feeReady=price>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)));
    if(feeReady){const fee=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});if(!fee)warnings.push("nie pobrano prowizji");}
    else warnings.push("brak danych do wyliczenia prowizji");
  }
  p=asortymentProduktPoId(p.id)||p;
  return {id:String(p.id),name:p.nazwa||"Produkt",warnings,ready:preparation?.ready??null,missing:preparation?.missing||[],savedFields:preparation?.savedFields||[],persistenceConfirmed:preparation?preparation.persistence?.confirmed===true&&preparation.persistence?.publication?.published===true:true};
}
async function asortymentUruchomAgenta(ids,operation){
  if(asortymentAgentKolejka.busy){toast("Agent ma już aktywną kolejkę produktów");return;}
  const products=asortymentProduktyZId(ids).slice(0,250);if(!products.length){toast("Zaznacz co najmniej jeden aktywny produkt");return;}
  if(["pelna","allegro","szkic","dane"].includes(operation))return asortymentUruchomAgentaNaSerwerze(products,operation);
  asortymentAgentKolejka={busy:true,operation,ids:products.map(p=>String(p.id)),done:0,total:products.length,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:new Date().toISOString(),finishedAt:""};asortymentOdswiezCentrumDzialan();
  let cursor=0;const worker=async()=>{while(cursor<products.length&&!asortymentAgentKolejka.cancel){const p=products[cursor++];asortymentAgentKolejka.current=p.nazwa||`Produkt ${p.id}`;asortymentOdswiezCentrumDzialan();try{const result=await asortymentAgentPrzetworzProdukt(p,operation);if(!result.persistenceConfirmed)throw new Error("Brak potwierdzenia trwałego zapisu produktu.");asortymentAgentKolejka.ok++;if(result.warnings.length)asortymentAgentKolejka.warnings++;asortymentAgentKolejka.results.push({...result,ok:true});}catch(error){if(["pelna","allegro","szkic","dane"].includes(operation))podmienProduktAdminBezRenderu(p.id,{allegroAgentPreparationStatus:"failed",allegroAgentPreparationError:error.message||String(error),allegroAgentPreparationCheckedAt:new Date().toISOString()});asortymentAgentKolejka.failed++;asortymentAgentKolejka.results.push({id:String(p.id),name:p.nazwa||"Produkt",ok:false,error:error.message||String(error)});}finally{asortymentAgentKolejka.done++;asortymentOdswiezCentrumDzialan();}}};
  // Jedna kolejka = jeden zapis naraz. Dzięki temu każdy produkt otrzymuje
  // osobne potwierdzenie odczytu z serwera i nie ściga się o rewizję ustawień
  // z drugim produktem z tej samej partii.
  await worker();
  asortymentAgentKolejka={...asortymentAgentKolejka,busy:false,current:"",finishedAt:new Date().toISOString()};
  zapiszHistorieAgenta("katalog-allegro",`Agent zakończył kolejkę katalogu: ${asortymentAgentKolejka.ok} poprawnie, ${asortymentAgentKolejka.failed} błędów`,{operation,products:asortymentAgentKolejka.ids,warningCount:asortymentAgentKolejka.warnings});
  const preparationOperation=["pelna","allegro","szkic","dane"].includes(operation);
  const cloudSaved=preparationOperation?asortymentAgentKolejka.failed===0&&asortymentAgentKolejka.results.every(result=>result.ok&&result.persistenceConfirmed!==false):await chmuraZapiszUstawienia({flush:true}).catch(()=>false);
  asortymentAgentKolejka={...asortymentAgentKolejka,cloudSaved};asortymentOdswiezCentrumDzialan();toast(cloudSaved?`🤖 Kolejka zakończona: serwer potwierdził zapis i publikację ${asortymentAgentKolejka.ok} produktów`:"⚠️ Nie wszystkie produkty uzyskały potwierdzenie zapisu i publikacji — sprawdź raport kolejki");
}
function asortymentUruchomAgentaDlaZaznaczonych(){return asortymentUruchomAgenta([...zaznaczoneProdukty],String(document.querySelector("[data-agent-product-operation]")?.value||asortymentAgentKolejka.operation||"pelna"));}
function asortymentUruchomAgentaDlaProduktu(id,operation="pelna"){return asortymentUruchomAgenta([id],operation);}
function asortymentPrzygotujZaznaczoneDoAllegro(){return asortymentUruchomAgenta([...zaznaczoneProdukty],"allegro");}
function asortymentPrzygotujProduktDoAllegroZMenu(id){return asortymentUruchomAgenta([id],"allegro");}
function asortymentWystawZaznaczoneNaAllegro(){return asortymentPrzygotujOperacjeZewnetrzna("activate");}
function asortymentAnulujAgenta(){if(asortymentAgentKolejka.busy){asortymentAgentKolejka.cancel=true;asortymentOdswiezCentrumDzialan();}}

function asortymentPrzygotujOperacjeZewnetrzna(operation=null,singleId=null,executeNow=false){
  const op=String(operation||document.querySelector("[data-external-product-operation]")?.value||asortymentAllegroDecyzja.operation||"update"),source=singleId===null?[...zaznaczoneProdukty]:[singleId],all=asortymentProduktyZId(source);
  const unresolved=all.filter(p=>["activate","draft"].includes(op)&&String(p.allegroOfferId||p.allegro?.offerId||"").trim()&&!asortymentOfertaProduktu(p));
  const eligibleAll=all.filter(p=>{
    if(op==="update"||op==="withdraw")return !!asortymentOfertaProduktu(p);
    return !unresolved.some(item=>String(item.id)===String(p.id));
  }),eligible=eligibleAll.slice(0,50),remaining=Math.max(0,eligibleAll.length-eligible.length),blocked=Math.max(0,all.length-eligibleAll.length);
  if(!eligible.length){toast(unresolved.length?"Zapisane ID oferty wymaga weryfikacji — tworzenie możliwego duplikatu zostało zablokowane":op==="update"||op==="withdraw"?"Zaznaczone produkty nie mają powiązanych ofert Allegro":"Zaznacz produkty");return;}
  if(unresolved.length)toast(`Pominięto ${unresolved.length} produktów wymagających weryfikacji ID oferty`);
  asortymentAllegroDecyzja={step:"confirm",busy:false,direct:executeNow&&op!=="withdraw",operation:op,operationId:`allegro_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`,ids:eligible.map(p=>String(p.id)),skipped:remaining+blocked,remaining,blocked,done:0,total:eligible.length,ok:0,failed:0,error:"",results:[]};
  if(executeNow&&op!=="withdraw"){void asortymentPotwierdzOperacjeZewnetrzna(true);return;}
  asortymentOdswiezCentrumDzialan();setTimeout(()=>document.querySelector(".product-external-confirm")?.scrollIntoView({behavior:"smooth",block:"center"}),0);
}
function asortymentAnulujOperacjeZewnetrzna(){asortymentAllegroDecyzja={step:"idle",busy:false,operation:"update",ids:[],skipped:0,done:0,total:0,ok:0,failed:0,error:"",results:[]};asortymentOdswiezCentrumDzialan();}
async function asortymentPotwierdzOperacjeZewnetrzna(direct=false){
  const state=asortymentAllegroDecyzja;if(state.busy||state.step!=="confirm")return;
  if(!direct&&!document.querySelector("[data-external-product-confirm]")?.checked){toast("Zaznacz potwierdzenie świadomej operacji przez API Allegro");return;}
  asortymentAllegroDecyzja={...state,busy:true,error:""};asortymentOdswiezCentrumDzialan();
  try{
    const health=await chmura("allegro-connection-check",{timeout:30000});
    allegroStan={...allegroStan,...(health.allegro||{}),sprawdzono:true,error:""};
    if(!health.ready)throw Object.assign(new Error("Połączenie Allegro wymaga ponownej autoryzacji przed wykonaniem zatwierdzonej operacji."),{code:"allegro_reauth_required"});
  }catch(error){
    allegroStan={...allegroStan,connected:false,requiresReauth:true,sprawdzono:true,error:error.message||String(error)};
    asortymentAllegroDecyzja={...state,busy:false,error:`Połączenie Allegro nie jest gotowe: ${error.message||error}`};asortymentOdswiezCentrumDzialan();toast("⚠️ Najpierw napraw połączenie Allegro — żadna oferta nie została zmieniona");return;
  }
  asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:true,error:""};asortymentOdswiezCentrumDzialan();
  try{
    const products=asortymentProduktyZId(state.ids);
    if(state.operation==="withdraw"){
      const offerIds=[...new Set(products.map(p=>String(asortymentOfertaProduktu(p)?.id||p.allegroOfferId||"")).filter(Boolean))];
      const d=await chmura("allegro-withdraw-offers",{method:"POST",body:{offerIds,reason:"admin_decision"},timeout:120000});allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;allegroMapowania=d.mappings||allegroMapowania;
      asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,step:"done",done:offerIds.length,total:offerIds.length,ok:Number(d.ended)||0,failed:Number(d.failed)||0,results:d.results||[]};
    }else{
      for(const sourceProduct of products){
        try{
          const preparation=await asortymentPrzygotujProduktDoAllegro(sourceProduct,{refreshSource:true});
          if(!preparation.ready)throw new Error(`Agent zapisał poprawki, ale produkt nadal wymaga uzupełnienia: ${preparation.missing.join(", ")||"sprawdź kartotekę"}`);
          const p=preparation.product,existing=asortymentOfertaProduktu(p),publicationAction=state.operation==="activate"?"activate":state.operation==="draft"&&!existing?"deactivate":"keep";
          const preparedDraft=preparation.draft?.draft?{...preparation.draft.draft,publication:{...(preparation.draft.draft.publication||{}),status:publicationAction==="activate"?"ACTIVE":"INACTIVE",republish:true}}:null;
          const operationId=`${state.operationId||`allegro_${Date.now().toString(36)}`}:${String(p.id)}`;
          const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,...(preparedDraft?{draft:preparedDraft}:{}),options:{stock:allegroStanOfertyProduktu(p),publicationAction,publishNow:publicationAction==="activate"},approval:{approved:true,operationId,productId:String(p.id),action:state.operation,approvedAt:new Date().toISOString()}},timeout:120000});
          allegroZastosujWynikWystawienia(p,d);allegroZapiszWynikOperacji(p,d);
          const expectedOfferId=String(d.offer?.id||existing?.id||p.allegroOfferId||"").trim();
          const persisted=await asortymentPobierzPelnyProdukt(p.id,{force:true});
          if(!expectedOfferId||String(persisted?.allegroOfferId||"").trim()!==expectedOfferId||String(persisted?.allegroAgentPreparationStatus||"")!=="published"){
            throw Object.assign(new Error("Allegro przyjęło ofertę, ale serwer nie potwierdził jeszcze jej trwałego zapisu w kartotece."),{code:"allegro_publication_readback_mismatch"});
          }
          if(typeof asortymentCentralnyPodmienProdukt==="function")asortymentCentralnyPodmienProdukt(p.id,persisted);
          asortymentAllegroDecyzja.ok++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:true,offerId:expectedOfferId,operationId,savedFields:preparation.savedFields,catalogRecovery:d.catalogRecovery||null,readbackConfirmed:true});
        }catch(error){
          const p=asortymentProduktPoId(sourceProduct.id)||sourceProduct,currentStatus=String(p.allegroAgentPreparationStatus||"");await zapiszPolaProduktuTrwale(p.id,{...(currentStatus==="needs_attention"?{}:{allegroAgentPreparationStatus:"failed",allegroAgentPreparationError:error.message||String(error)}),allegroAgentPublicationError:error.message||String(error),allegroAgentPreparationCheckedAt:new Date().toISOString()},false,"allegro-publication-failure").catch(()=>false);
          asortymentAllegroDecyzja.failed++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:false,operationId:`${state.operationId||"allegro"}:${String(p.id)}`,error:error.message||String(error),code:error.code||""});
        }finally{asortymentAllegroDecyzja.done++;asortymentOdswiezCentrumDzialan();}
      }
      asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,step:"done"};
    }
    asortymentAllegroDecyzja.results.filter(result=>result.ok&&result.id!==undefined).forEach(result=>{const id=String(result.id);zaznaczoneProdukty.delete(id);zaznaczoneProdukty.delete(Number(id));zaznaczoneAllegroProduktyKatalogu?.delete?.(id);});
    const successful=asortymentAllegroDecyzja.results.filter(result=>result.ok),cloudSaved=state.operation==="withdraw"||successful.length===asortymentAllegroDecyzja.ok&&successful.every(result=>result.readbackConfirmed===true);
    asortymentAllegroDecyzja={...asortymentAllegroDecyzja,cloudSaved};await allegroWczytajDane(true).catch(()=>{});allegroZapiszCache();asortymentCentralnyWyczyscCache();asortymentOdswiezCentrumDzialan();toast(cloudSaved?`🟠 Operacja Allegro zakończona i trwale zapisana: ${asortymentAllegroDecyzja.ok} poprawnie${asortymentAllegroDecyzja.failed?` • ${asortymentAllegroDecyzja.failed} błędów`:""}${asortymentAllegroDecyzja.remaining?` • pozostało ${asortymentAllegroDecyzja.remaining}`:""}`:"⚠️ Allegro przyjęło operację, ale serwer nie potwierdził jeszcze całej kolejki kartotek");
  }catch(error){asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,error:error.message||String(error)};asortymentOdswiezCentrumDzialan();toast("⚠️ Operacja Allegro: "+(error.message||error));}
}

function asortymentOperacjaZewnetrznaOpis(op){return ({update:["Aktualizacja istniejących ofert","Agent ponownie przygotuje i zapisze dane, a następnie zmieni istniejące oferty bez tworzenia duplikatów."],draft:["Szkice / oferty nieaktywne","Agent najpierw uzupełni kartoteki. Kompletne brakujące oferty utworzy jako nieaktywne."],activate:["Przygotowanie, publikacja i aktywacja","Agent zapisze poprawione dane każdego produktu. Tylko kompletne pozycje zostaną wystawione lub zaktualizowane i aktywowane."],withdraw:["Zakończenie ofert","Zakończy powiązane oferty i wyłączy ich odnawianie."]})[op]||["Operacja Allegro",""];}
function asortymentDecyzjaZewnetrznaHTML(){
  const s=asortymentAllegroDecyzja;if(s.step==="idle")return "";const [title,description]=asortymentOperacjaZewnetrznaOpis(s.operation),products=asortymentProduktyZId(s.ids);
  if(s.step==="done")return `<section class="product-external-result ${s.failed||s.cloudSaved===false?"partial":"ok"}"><div><b>${s.failed?"⚠️ Operacja zakończona częściowo":s.cloudSaved===false?"⚠️ Allegro zapisane, kartoteki czekają na synchronizację":"✅ Operacja zakończona i zapisana"}</b><small>${esc(title)} • poprawnie ${s.ok} • błędy ${s.failed}${s.remaining?` • kolejna partia ${s.remaining}`:""}${s.blocked?` • wymaga kontroli ${s.blocked}`:""} • serwer ${s.cloudSaved===false?"oczekuje na ponowną próbę":"potwierdził zapis"}</small>${s.results.length?`<details><summary>Raport dla ${s.results.length} produktów</summary>${s.results.map(x=>`<p class="${x.ok?"ok":"error"}"><b>${x.ok?"✅":"⚠️"} ${esc(x.name||x.id)}</b> — ${x.ok?`oferta ${esc(x.offerId||"zapisana")}${x.catalogRecovery?.applied?` • automatycznie poprawiono dane katalogu Allegro`:""}${x.savedFields?.length?` • zapisano: ${esc(asortymentEtykietyPol(x.savedFields).join(", "))}`:""}`:esc(x.error||"błąd")}</p>`).join("")}</details>`:""}</div><div class="product-external-result-actions">${s.remaining?`<button class="btn" onclick="asortymentPrzygotujOperacjeZewnetrzna('${esc(s.operation)}',null,true)">Następna partia (${s.remaining})</button>`:""}<button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()">Zamknij</button></div></section>`;
  if(s.direct)return `<section class="product-external-direct ${s.error?"error":""}" aria-live="polite"><span>${s.error?"⚠️":"🟠"}</span><div><b>${s.error?"Nie rozpoczęto publikacji":esc(title)}</b><small>${s.error?esc(s.error):"Kontrola połączenia, przygotowanie danych i publikacja trwają bez dodatkowego potwierdzenia."}</small>${s.error?`<button class="btn ghost" onclick="${allegroStan.requiresReauth?"allegroPolacz()":"asortymentPotwierdzOperacjeZewnetrzna(true)"}">${allegroStan.requiresReauth?"🔐 Połącz Allegro ponownie":"↻ Ponów operację"}</button>`:`<progress max="${Math.max(1,s.total)}" value="${s.done}"></progress><em>${s.done}/${s.total} • poprawnie ${s.ok} • błędy ${s.failed}</em>`}</div></section>`;
  return `<section class="product-external-confirm"><header><span>⚠️</span><div><small>Świadoma decyzja administratora • API Allegro</small><h3>${esc(title)} — ${products.length} produktów</h3><p>${esc(description)} Ostateczna publikacja nastąpi dopiero po tym potwierdzeniu.</p></div></header><div class="product-external-preview">${products.slice(0,8).map(p=>`<span><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • oferta ${esc(asortymentOfertaProduktu(p)?.id||p.allegroOfferId||"nowa")}</small>${asortymentStatusPrzygotowaniaHTML(p)}</span>`).join("")}${products.length>8?`<em>+ ${products.length-8} kolejnych</em>`:""}</div><label class="product-external-check"><input type="checkbox" data-external-product-confirm> Potwierdzam przygotowanie i wykonanie tej operacji na Allegro${s.skipped?` • pominięto ${s.skipped} niepasujących produktów`:""}</label>${s.busy?`<div class="product-agent-progress"><progress max="${s.total}" value="${s.done}"></progress><span>${s.done}/${s.total} • Agent zapisuje dane przed publikacją</span></div>`:""}${s.error?`<div class="backend-note allegro-mapping-error"><b>${esc(s.error)}</b>${allegroStan.requiresReauth?`<button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button>`:""}</div>`:""}<footer><button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()" ${s.busy?"disabled":""}>Anuluj</button><button class="btn danger" onclick="asortymentPotwierdzOperacjeZewnetrzna()" ${s.busy?"disabled":""}>${s.busy?"⏳ Przygotowuję i wystawiam…":"Potwierdzam przygotowanie i publikację"}</button></footer></section>`;
}
function asortymentCentrumDzialanHTML(){
  asortymentZapewnijMonitorKolejkiSerwera();
  const q=asortymentAgentKolejka,selected=zaznaczoneProdukty.size,dirty=typeof chmuraBrudneKlucze!=="undefined"?chmuraBrudneKlucze.size:0;
  return `<section class="product-action-center"><header><div><span class="order-pro-label">Automatyzacje katalogu i Allegro</span><h3>⚡ Centrum przygotowania i wystawiania</h3><p>Najpierw Agent zapisuje poprawione dane w kartotece. Dopiero osobna, potwierdzona operacja wysyła kompletną ofertę do Allegro.</p></div><span class="product-save-state ${dirty?"pending":"saved"}">${dirty?`☁️ ${dirty} zmian czeka na bezpieczny zapis`:"☁️ Dane zsynchronizowane"}</span></header><div class="product-action-columns"><article class="product-action-primary"><small>KROK 1 • PRZYGOTUJ I ZAPISZ</small><b>${selected} zaznaczonych produktów</b><button class="btn" onclick="asortymentPrzygotujZaznaczoneDoAllegro()" ${!selected||q.busy?"disabled":""}>🤖 Przygotuj i zapisz do Allegro</button><small>Agent odświeży źródło, poprawi oba opisy, dobierze katalog, kategorię, parametry, zdjęcia i zapisze wynik kontroli.</small><details><summary>Inne działania Agenta</summary><div class="product-action-advanced"><select data-agent-product-operation onchange="asortymentUstawOperacjeAgenta(this.value)" ${q.busy?"disabled":""}><option value="pelna" ${q.operation==="pelna"?"selected":""}>Pełna kontrola i uzupełnienie</option><option value="zrodlo" ${q.operation==="zrodlo"?"selected":""}>Odśwież dane producenta</option><option value="dane" ${q.operation==="dane"?"selected":""}>Kompletność i kategoria Allegro</option><option value="szkic" ${q.operation==="szkic"?"selected":""}>Przygotuj / sprawdź szkic</option><option value="prowizja" ${q.operation==="prowizja"?"selected":""}>Pobierz prowizje i opłaty</option><option value="seo" ${q.operation==="seo"?"selected":""}>Popraw SEO produktu</option></select><button class="btn ghost" onclick="asortymentUruchomAgentaDlaZaznaczonych()" ${!selected||q.busy?"disabled":""}>Uruchom wybrane</button></div></details></article><article class="product-action-primary external"><small>KROK 2 • WYSTAW GOTOWE</small><b>Publikacja po kontroli aktualności</b><button class="btn product-allegro-publish" onclick="asortymentWystawZaznaczoneNaAllegro()" ${!selected||q.busy?"disabled":""}>🟠 Wystaw gotowe na Allegro</button><small>Potwierdzone przygotowanie jest używane ponownie. Agent generuje opisy od nowa wyłącznie po zmianie danych produktu.</small><details><summary>Inna operacja Allegro</summary><div class="product-action-advanced"><select data-external-product-operation onchange="asortymentUstawOperacjeZewnetrzna(this.value)" ${q.busy?"disabled":""}><option value="update">Aktualizuj istniejące oferty</option><option value="draft">Utwórz brakujące jako nieaktywne</option><option value="activate">Opublikuj / aktywuj sprzedaż</option><option value="withdraw">Zakończ powiązane oferty</option></select><button class="btn ghost" onclick="asortymentPrzygotujOperacjeZewnetrzna()" ${!selected||q.busy?"disabled":""}>Przygotuj decyzję</button></div></details></article></div>${q.busy||q.finishedAt?`<div class="product-agent-progress" aria-live="polite"><progress max="${q.total||1}" value="${q.done}"></progress><div><b>${q.busy?`Agent zapisuje: ${esc(q.current||"uruchamianie kolejki")}`:q.cloudSaved===false?"Kolejka zakończona — sprawdź błędy zapisu":"Kolejka Agenta zakończona i zapisana"}</b><small>${q.done}/${q.total} • poprawnie ${q.ok} • uwagi ${q.warnings} • błędy ${q.failed}${q.cancel?" • zatrzymywanie":""}</small></div>${q.busy?`<button class="btn ghost" onclick="asortymentAnulujAgenta()">Zatrzymaj po bieżącym</button>`:""}</div>`:""}${q.results.length?`<details class="product-agent-results" ${!q.busy?"open":""}><summary>Konkretny zapis Agenta (${q.results.length})</summary>${q.results.slice(-30).map(x=>`<p class="${x.ok?x.ready===false?"warning":"ok":"error"}"><b>${x.ok?x.ready===false?"⚠️":"✅":"⛔"} ${esc(x.name)}</b>${x.ok?`<span>${x.savedFields?.length?`Zapisano: ${esc(asortymentEtykietyPol(x.savedFields).join(", "))}`:"Dane sprawdzone — bez nowych zmian"}</span>${x.missing?.length?`<small>Do uzupełnienia: ${esc(x.missing.join(", "))}</small>`:`<small>Komplet danych do wystawienia</small>`}`:`<span>${esc(x.error)}</span>`}</p>`).join("")}</details>`:""}${asortymentDecyzjaZewnetrznaHTML()}</section>`;
}
function asortymentMenuDzialanProduktuHTML(p={}){
  const offer=asortymentOfertaProduktu(p);return `<details class="product-row-action-menu"><summary class="btn ghost">⚡ Działania</summary><div>${asortymentStatusPrzygotowaniaHTML(p)}<button class="primary" onclick="asortymentPrzygotujProduktDoAllegroZMenu(${jsArg(p.id)})">🤖 Przygotuj i zapisz do Allegro</button><button class="allegro" onclick="asortymentPrzygotujOperacjeZewnetrzna('${offer?"update":"activate"}',${jsArg(p.id)})">🟠 ${offer?"Zapisz poprawki w ofercie":"Wystaw gotowy produkt"}</button><button onclick="asortymentUruchomAgentaDlaProduktu(${jsArg(p.id)},'prowizja')">📊 Pobierz prowizję</button>${offer?`<a href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener">↗ Otwórz ofertę Allegro</a><button class="danger" onclick="asortymentPrzygotujOperacjeZewnetrzna('withdraw',${jsArg(p.id)})">⏹ Przygotuj zakończenie</button>`:""}</div></details>`;
}
