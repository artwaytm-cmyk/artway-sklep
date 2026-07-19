/* ═══════════ KATALOG PRODUKTÓW — AGENT I DECYZJE MASOWE ALLEGRO ═══════════ */
let asortymentAgentKolejka={busy:false,operation:"pelna",ids:[],done:0,total:0,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:"",finishedAt:""};
let asortymentAllegroDecyzja={step:"idle",busy:false,operation:"update",ids:[],skipped:0,done:0,total:0,ok:0,failed:0,error:"",results:[]};

function asortymentProduktPoId(rawId){return pobierzProduktAdmin(rawId)||produktyDoAdministracji().find(p=>String(p.id)===String(rawId))||null;}
function asortymentOfertaProduktu(p={}){return allegroOfertaDlaProduktuSklepu(p)||(p.allegroOfferId?allegroOfertaPoId(String(p.allegroOfferId)):null);}
function asortymentProduktyZId(ids=[]){return [...new Set(ids.map(String))].map(asortymentProduktPoId).filter(p=>p&&!czyProduktAdminWKoszu(p));}
function asortymentOdswiezCentrumDzialan(){
  const listing=document.querySelector("[data-allegro-publication-center]");
  if(listing&&typeof allegroPublikacjaCentrumOperacjiHTML==="function")listing.innerHTML=allegroPublikacjaCentrumOperacjiHTML();
  const el=document.querySelector("[data-product-agent-center]");if(el)el.innerHTML=asortymentCentrumDzialanHTML();
}
function asortymentOdswiezStanZaznaczenia(){
  document.querySelectorAll("[data-assortment-product-id]").forEach(input=>{const checked=zaznaczoneProdukty.has(Number(input.dataset.assortmentProductId))||zaznaczoneProdukty.has(input.dataset.assortmentProductId);input.checked=checked;input.closest("tr")?.classList.toggle("is-selected",checked);});
  document.querySelectorAll("[data-product-selection-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  document.querySelectorAll("[data-product-selection-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  const operations=document.querySelector('[data-admin-results-operations="assortment-products"]');
  operations?.querySelectorAll("[data-admin-selected-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  operations?.querySelectorAll("[data-admin-selected-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  asortymentOdswiezCentrumDzialan();
}
function asortymentUstawOperacjeAgenta(value){asortymentAgentKolejka.operation=String(value||"pelna");}
function asortymentUstawOperacjeZewnetrzna(value){asortymentAllegroDecyzja.operation=String(value||"update");}

function asortymentSeoAgenta(p={}){
  if(typeof seoAutomatyzujDaneProduktu!=="function")return false;
  const next=seoAutomatyzujDaneProduktu({...p},"agent-katalogu",{force:false}),patch={};
  for(const key of ["seoTitle","seoDescription","seoKeywords","seoScore","seoReviewedAt","seoSource","seoMode"])if(next[key]!==undefined&&String(next[key])!==String(p[key]??""))patch[key]=next[key];
  return Object.keys(patch).length?zapiszPolaProduktuLokalnie(p.id,patch,false):false;
}
const ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO=["nazwa","allegroTitle","opisKrotki","opis","allegroDescription","producent","marka","gtin","ean","kodProducenta","mpn","zdjecie","zdjecia","allegroCategoryId","allegroProductId","allegroParameters","allegroDescriptionSections","allegroShippingSubsidy"];
const ASORTYMENT_ETYKIETY_POL_ALLEGRO={nazwa:"nazwa",allegroTitle:"tytuł Allegro",opisKrotki:"opis krótki sklepu",opis:"opis długi sklepu",allegroDescription:"opis Allegro",producent:"producent",marka:"marka",gtin:"GTIN",ean:"EAN",kodProducenta:"kod producenta",mpn:"MPN",zdjecie:"zdjęcie główne",zdjecia:"galeria",allegroCategoryId:"kategoria Allegro",allegroProductId:"produkt katalogowy Allegro",allegroParameters:"parametry Allegro",allegroDescriptionSections:"układ opisu Allegro",allegroShippingSubsidy:"dopłata do wysyłki"};
function asortymentMigawkaPrzygotowania(p={}){return Object.fromEntries(ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.map(key=>[key,p[key]]));}
function asortymentPolaZmienione(before={},after={}){return ASORTYMENT_POLA_PRZYGOTOWANIA_ALLEGRO.filter(key=>JSON.stringify(before[key]??null)!==JSON.stringify(after[key]??null));}
function asortymentEtykietyPol(keys=[]){return keys.map(key=>ASORTYMENT_ETYKIETY_POL_ALLEGRO[key]||key);}
function asortymentStatusPrzygotowania(p={}){
  const status=String(p.allegroAgentPreparationStatus||"");
  const missing=Array.isArray(p.allegroAgentPreparationMissing)?p.allegroAgentPreparationMissing:[];
  if(status==="ready"||status==="published")return {code:"ready",label:status==="published"?"Oferta zapisana w Allegro":"Gotowy do Allegro",note:(status==="published"?p.allegroAgentPublishedAt:p.allegroAgentPreparedAt)?`zapis ${new Date(status==="published"?p.allegroAgentPublishedAt:p.allegroAgentPreparedAt).toLocaleString("pl-PL")}`:"komplet danych"};
  if(status==="needs_attention")return {code:"attention",label:"Wymaga uzupełnienia",note:missing.join(", ")||"sprawdź dane"};
  if(status==="failed")return {code:"failed",label:"Błąd przygotowania",note:p.allegroAgentPreparationError||"uruchom ponownie"};
  return {code:"new",label:"Nieprzygotowany",note:"Agent nie zapisał jeszcze kontroli"};
}
function asortymentStatusPrzygotowaniaHTML(p={}){const s=asortymentStatusPrzygotowania(p);return `<span class="product-allegro-preparation ${s.code}"><b>${s.code==="ready"?"✅":s.code==="attention"?"⚠️":s.code==="failed"?"⛔":"○"} ${esc(s.label)}</b><small>${esc(s.note)}</small></span>`;}
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
  if(Array.isArray(auto.allegroParameters)&&auto.allegroParameters.length)patch.allegroParameters=auto.allegroParameters;
  const improved=draft.improvedDescriptions||{},safeSections=draft.draft?.description?.sections||improved.sections||[];
  if(Array.isArray(safeSections)&&safeSections.length)patch.allegroDescriptionSections=safeSections;
  const full=String(improved.storeFullDescription||improved.fullDescription||p.opis||"").trim(),short=String(improved.storeShortDescription||improved.shortDescription||p.opisKrotki||(full?agentAITnijDoZdania(full,500):"")).trim(),allegroFull=String(improved.allegroDescription||allegroTekstZBezpiecznychSekcji(safeSections)||p.allegroDescription||"").trim();
  if(full)patch.opis=full;if(short)patch.opisKrotki=short;if(allegroFull)patch.allegroDescription=allegroFull;
  patch.allegroShippingSubsidy=p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI;
  return patch;
}
async function asortymentPrzygotujProduktDoAllegro(base={},options={}){
  let p=asortymentProduktPoId(base.id)||base;const warnings=[],before=asortymentMigawkaPrzygotowania(p),startedAt=new Date().toISOString();
  if(options.refreshSource!==false){
    if(p.sourceUrl||p.producentUrl)p=await automatyczniePobierzDaneZrodlaProduktu(p);
    else warnings.push("brak linku producenta — użyto danych kartoteki i katalogu Allegro");
  }
  try{
    const improved=await chmura("allegro-description-improve",{method:"POST",body:{product:p},timeout:120000});
    if(improved.compliance?.ok!==false){
      zapiszPolaProduktuLokalnie(p.id,{nazwa:improved.name||p.nazwa,opisKrotki:improved.shortDescription||p.opisKrotki,opis:improved.fullDescription||p.opis,allegroTitle:improved.allegroTitle||p.allegroTitle,allegroDescription:improved.allegroDescription||p.allegroDescription,contentEditorial:improved.contentEditorial||p.contentEditorial,allegroDescriptionSections:improved.sections||p.allegroDescriptionSections},false);
      p=asortymentProduktPoId(p.id)||p;
    }else warnings.push("opis wymagał oczyszczenia przez końcową bramkę zgodności");
  }catch(error){warnings.push(`poprawa opisu: ${error.message||error}`);}
  const draft=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:90000});
  allegroZapiszAutoUzupelnienia(p,draft);
  p=asortymentProduktPoId(p.id)||p;
  zapiszPolaProduktuLokalnie(p.id,asortymentPatchZPrzygotowania(p,draft),false);
  p=asortymentProduktPoId(p.id)||p;
  const missing=[...new Set((draft.missing||[]).map(String).filter(Boolean))],ready=missing.length===0&&draft.compliance?.ok!==false,savedFields=asortymentPolaZmienione(before,asortymentMigawkaPrzygotowania(p)),finishedAt=new Date().toISOString();
  zapiszPolaProduktuLokalnie(p.id,{allegroAgentPreparationStatus:ready?"ready":"needs_attention",allegroAgentPreparationMissing:missing,allegroAgentSavedFields:savedFields,allegroAgentPreparedAt:finishedAt,allegroAgentPreparationStartedAt:startedAt,allegroAgentPreparationSource:"agent-katalogu",allegroAgentDraftOperation:draft.operation||"create",allegroAgentCompliancePolicy:draft.compliance?.policyId||"",allegroAgentComplianceCheckedAt:draft.compliance?.checkedAt||finishedAt,allegroAgentPreparationError:""},false);
  p=asortymentProduktPoId(p.id)||p;
  return {id:String(p.id),name:p.nazwa||"Produkt",product:p,draft,ready,missing,savedFields,warnings};
}
async function asortymentAgentPrzetworzProdukt(base,operation){
  let p=asortymentProduktPoId(base.id)||base;const warnings=[];let preparation=null;
  if(["pelna","allegro","szkic","dane"].includes(operation)){
    preparation=await asortymentPrzygotujProduktDoAllegro(p,{refreshSource:["pelna","allegro"].includes(operation)});p=preparation.product;warnings.push(...preparation.warnings);if(preparation.missing.length)warnings.push(`do uzupełnienia: ${preparation.missing.join(", ")}`);
  }else if(operation==="zrodlo"){
    if(p.sourceUrl||p.producentUrl)p=await automatyczniePobierzDaneZrodlaProduktu(p);else warnings.push("brak linku producenta");
  }
  if(["pelna","seo"].includes(operation))asortymentSeoAgenta(p);
  if(["pelna","prowizja"].includes(operation)){
    const price=kwotaNum(p.cenaAllegro||p.cena),feeReady=price>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)));
    if(feeReady){const fee=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});if(!fee)warnings.push("nie pobrano prowizji");}
    else warnings.push("brak danych do wyliczenia prowizji");
  }
  p=asortymentProduktPoId(p.id)||p;
  return {id:String(p.id),name:p.nazwa||"Produkt",warnings,ready:preparation?.ready??null,missing:preparation?.missing||[],savedFields:preparation?.savedFields||[]};
}
async function asortymentUruchomAgenta(ids,operation){
  if(asortymentAgentKolejka.busy){toast("Agent ma już aktywną kolejkę produktów");return;}
  const products=asortymentProduktyZId(ids).slice(0,250);if(!products.length){toast("Zaznacz co najmniej jeden aktywny produkt");return;}
  asortymentAgentKolejka={busy:true,operation,ids:products.map(p=>String(p.id)),done:0,total:products.length,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:new Date().toISOString(),finishedAt:""};asortymentOdswiezCentrumDzialan();
  let cursor=0;const worker=async()=>{while(cursor<products.length&&!asortymentAgentKolejka.cancel){const p=products[cursor++];asortymentAgentKolejka.current=p.nazwa||`Produkt ${p.id}`;asortymentOdswiezCentrumDzialan();try{const result=await asortymentAgentPrzetworzProdukt(p,operation);asortymentAgentKolejka.ok++;if(result.warnings.length)asortymentAgentKolejka.warnings++;asortymentAgentKolejka.results.push({...result,ok:true});}catch(error){if(["pelna","allegro","szkic","dane"].includes(operation))zapiszPolaProduktuLokalnie(p.id,{allegroAgentPreparationStatus:"failed",allegroAgentPreparationError:error.message||String(error),allegroAgentPreparationCheckedAt:new Date().toISOString()},false);asortymentAgentKolejka.failed++;asortymentAgentKolejka.results.push({id:String(p.id),name:p.nazwa||"Produkt",ok:false,error:error.message||String(error)});}finally{asortymentAgentKolejka.done++;asortymentOdswiezCentrumDzialan();}}};
  await Promise.all(Array.from({length:Math.min(2,products.length)},worker));
  asortymentAgentKolejka={...asortymentAgentKolejka,busy:false,current:"",finishedAt:new Date().toISOString()};
  zapiszHistorieAgenta("katalog-allegro",`Agent zakończył kolejkę katalogu: ${asortymentAgentKolejka.ok} poprawnie, ${asortymentAgentKolejka.failed} błędów`,{operation,products:asortymentAgentKolejka.ids,warningCount:asortymentAgentKolejka.warnings});
  const cloudSaved=await chmuraZapiszUstawienia().catch(()=>false);asortymentAgentKolejka={...asortymentAgentKolejka,cloudSaved};zbudujProdukty();asortymentOdswiezCentrumDzialan();toast(cloudSaved?`🤖 Kolejka zakończona i zapisana na serwerze: ${asortymentAgentKolejka.ok} poprawnie${asortymentAgentKolejka.failed?` • ${asortymentAgentKolejka.failed} błędów`:""}`:"⚠️ Poprawki są zapisane lokalnie, ale serwer ich jeszcze nie potwierdził — automatyczna ponowna próba pozostaje aktywna");
}
function asortymentUruchomAgentaDlaZaznaczonych(){return asortymentUruchomAgenta([...zaznaczoneProdukty],String(document.querySelector("[data-agent-product-operation]")?.value||asortymentAgentKolejka.operation||"pelna"));}
function asortymentUruchomAgentaDlaProduktu(id,operation="pelna"){return asortymentUruchomAgenta([id],operation);}
function asortymentPrzygotujZaznaczoneDoAllegro(){return asortymentUruchomAgenta([...zaznaczoneProdukty],"allegro");}
function asortymentPrzygotujProduktDoAllegroZMenu(id){return asortymentUruchomAgenta([id],"allegro");}
function asortymentWystawZaznaczoneNaAllegro(){return asortymentPrzygotujOperacjeZewnetrzna("activate");}
function asortymentAnulujAgenta(){if(asortymentAgentKolejka.busy){asortymentAgentKolejka.cancel=true;asortymentOdswiezCentrumDzialan();}}

function asortymentPrzygotujOperacjeZewnetrzna(operation=null,singleId=null,executeNow=false){
  const op=String(operation||document.querySelector("[data-external-product-operation]")?.value||asortymentAllegroDecyzja.operation||"update"),source=singleId===null?[...zaznaczoneProdukty]:[singleId],all=asortymentProduktyZId(source);
  const eligible=all.filter(p=>op==="update"||op==="withdraw"?!!asortymentOfertaProduktu(p):true).slice(0,50);
  if(!eligible.length){toast(op==="update"||op==="withdraw"?"Zaznaczone produkty nie mają powiązanych ofert Allegro":"Zaznacz produkty");return;}
  asortymentAllegroDecyzja={step:"confirm",busy:false,direct:executeNow&&op!=="withdraw",operation:op,operationId:`allegro_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`,ids:eligible.map(p=>String(p.id)),skipped:Math.max(0,all.length-eligible.length),done:0,total:eligible.length,ok:0,failed:0,error:"",results:[]};
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
          allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);allegroZapiszWynikOperacji(p,d);
          zapiszPolaProduktuLokalnie(p.id,{allegroAgentPreparationStatus:"published",allegroAgentPublishedAt:new Date().toISOString(),allegroOfferId:String(d.offer?.id||existing?.id||p.allegroOfferId||"")},false);
          asortymentAllegroDecyzja.ok++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:true,offerId:d.offer?.id||existing?.id||"",operationId,savedFields:preparation.savedFields});
        }catch(error){
          const p=asortymentProduktPoId(sourceProduct.id)||sourceProduct,currentStatus=String(p.allegroAgentPreparationStatus||"");zapiszPolaProduktuLokalnie(p.id,{...(currentStatus==="needs_attention"?{}:{allegroAgentPreparationStatus:"failed",allegroAgentPreparationError:error.message||String(error)}),allegroAgentPublicationError:error.message||String(error),allegroAgentPreparationCheckedAt:new Date().toISOString()},false);
          asortymentAllegroDecyzja.failed++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:false,operationId:`${state.operationId||"allegro"}:${String(p.id)}`,error:error.message||String(error),code:error.code||""});
        }finally{asortymentAllegroDecyzja.done++;asortymentOdswiezCentrumDzialan();}
      }
      asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,step:"done"};
    }
    const cloudSaved=await chmuraZapiszUstawienia().catch(()=>false);asortymentAllegroDecyzja={...asortymentAllegroDecyzja,cloudSaved};await allegroWczytajDane(true).catch(()=>{});allegroZapiszCache();asortymentOdswiezCentrumDzialan();toast(cloudSaved?`🟠 Operacja Allegro zakończona i zapisana: ${asortymentAllegroDecyzja.ok} poprawnie${asortymentAllegroDecyzja.failed?` • ${asortymentAllegroDecyzja.failed} błędów`:""}`:"⚠️ Allegro przyjęło operację, ale zapis kartotek na serwer wymaga ponownej próby");
  }catch(error){asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,error:error.message||String(error)};asortymentOdswiezCentrumDzialan();toast("⚠️ Operacja Allegro: "+(error.message||error));}
}

function asortymentOperacjaZewnetrznaOpis(op){return ({update:["Aktualizacja istniejących ofert","Agent ponownie przygotuje i zapisze dane, a następnie zmieni istniejące oferty bez tworzenia duplikatów."],draft:["Szkice / oferty nieaktywne","Agent najpierw uzupełni kartoteki. Kompletne brakujące oferty utworzy jako nieaktywne."],activate:["Przygotowanie, publikacja i aktywacja","Agent zapisze poprawione dane każdego produktu. Tylko kompletne pozycje zostaną wystawione lub zaktualizowane i aktywowane."],withdraw:["Zakończenie ofert","Zakończy powiązane oferty i wyłączy ich odnawianie."]})[op]||["Operacja Allegro",""];}
function asortymentDecyzjaZewnetrznaHTML(){
  const s=asortymentAllegroDecyzja;if(s.step==="idle")return "";const [title,description]=asortymentOperacjaZewnetrznaOpis(s.operation),products=asortymentProduktyZId(s.ids);
  if(s.step==="done")return `<section class="product-external-result ${s.failed||s.cloudSaved===false?"partial":"ok"}"><div><b>${s.failed?"⚠️ Operacja zakończona częściowo":s.cloudSaved===false?"⚠️ Allegro zapisane, kartoteki czekają na synchronizację":"✅ Operacja zakończona i zapisana"}</b><small>${esc(title)} • poprawnie ${s.ok} • błędy ${s.failed} • serwer ${s.cloudSaved===false?"oczekuje na ponowną próbę":"potwierdził zapis"}</small>${s.results.length?`<details><summary>Raport dla ${s.results.length} produktów</summary>${s.results.map(x=>`<p class="${x.ok?"ok":"error"}"><b>${x.ok?"✅":"⚠️"} ${esc(x.name||x.id)}</b> — ${x.ok?`oferta ${esc(x.offerId||"zapisana")}${x.savedFields?.length?` • zapisano: ${esc(asortymentEtykietyPol(x.savedFields).join(", "))}`:""}`:esc(x.error||"błąd")}</p>`).join("")}</details>`:""}</div><button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()">Zamknij</button></section>`;
  if(s.direct)return `<section class="product-external-direct ${s.error?"error":""}" aria-live="polite"><span>${s.error?"⚠️":"🟠"}</span><div><b>${s.error?"Nie rozpoczęto publikacji":esc(title)}</b><small>${s.error?esc(s.error):"Kontrola połączenia, przygotowanie danych i publikacja trwają bez dodatkowego potwierdzenia."}</small>${s.error?`<button class="btn ghost" onclick="${allegroStan.requiresReauth?"allegroPolacz()":"asortymentPotwierdzOperacjeZewnetrzna(true)"}">${allegroStan.requiresReauth?"🔐 Połącz Allegro ponownie":"↻ Ponów operację"}</button>`:`<progress max="${Math.max(1,s.total)}" value="${s.done}"></progress><em>${s.done}/${s.total} • poprawnie ${s.ok} • błędy ${s.failed}</em>`}</div></section>`;
  return `<section class="product-external-confirm"><header><span>⚠️</span><div><small>Świadoma decyzja administratora • API Allegro</small><h3>${esc(title)} — ${products.length} produktów</h3><p>${esc(description)} Ostateczna publikacja nastąpi dopiero po tym potwierdzeniu.</p></div></header><div class="product-external-preview">${products.slice(0,8).map(p=>`<span><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • oferta ${esc(asortymentOfertaProduktu(p)?.id||p.allegroOfferId||"nowa")}</small>${asortymentStatusPrzygotowaniaHTML(p)}</span>`).join("")}${products.length>8?`<em>+ ${products.length-8} kolejnych</em>`:""}</div><label class="product-external-check"><input type="checkbox" data-external-product-confirm> Potwierdzam przygotowanie i wykonanie tej operacji na Allegro${s.skipped?` • pominięto ${s.skipped} niepasujących produktów`:""}</label>${s.busy?`<div class="product-agent-progress"><progress max="${s.total}" value="${s.done}"></progress><span>${s.done}/${s.total} • Agent zapisuje dane przed publikacją</span></div>`:""}${s.error?`<div class="backend-note allegro-mapping-error"><b>${esc(s.error)}</b>${allegroStan.requiresReauth?`<button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button>`:""}</div>`:""}<footer><button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()" ${s.busy?"disabled":""}>Anuluj</button><button class="btn danger" onclick="asortymentPotwierdzOperacjeZewnetrzna()" ${s.busy?"disabled":""}>${s.busy?"⏳ Przygotowuję i wystawiam…":"Potwierdzam przygotowanie i publikację"}</button></footer></section>`;
}
function asortymentCentrumDzialanHTML(){
  const q=asortymentAgentKolejka,selected=zaznaczoneProdukty.size,dirty=typeof chmuraBrudneKlucze!=="undefined"?chmuraBrudneKlucze.size:0;
  return `<section class="product-action-center"><header><div><span class="order-pro-label">Automatyzacje katalogu i Allegro</span><h3>⚡ Centrum przygotowania i wystawiania</h3><p>Najpierw Agent zapisuje poprawione dane w kartotece. Dopiero osobna, potwierdzona operacja wysyła kompletną ofertę do Allegro.</p></div><span class="product-save-state ${dirty?"pending":"saved"}">${dirty?`☁️ ${dirty} zmian czeka na bezpieczny zapis`:"☁️ Dane zsynchronizowane"}</span></header><div class="product-action-columns"><article class="product-action-primary"><small>KROK 1 • PRZYGOTUJ I ZAPISZ</small><b>${selected} zaznaczonych produktów</b><button class="btn" onclick="asortymentPrzygotujZaznaczoneDoAllegro()" ${!selected||q.busy?"disabled":""}>🤖 Przygotuj i zapisz do Allegro</button><small>Agent odświeży źródło, poprawi oba opisy, dobierze katalog, kategorię, parametry, zdjęcia i zapisze wynik kontroli.</small><details><summary>Inne działania Agenta</summary><div class="product-action-advanced"><select data-agent-product-operation onchange="asortymentUstawOperacjeAgenta(this.value)" ${q.busy?"disabled":""}><option value="pelna" ${q.operation==="pelna"?"selected":""}>Pełna kontrola i uzupełnienie</option><option value="zrodlo" ${q.operation==="zrodlo"?"selected":""}>Odśwież dane producenta</option><option value="dane" ${q.operation==="dane"?"selected":""}>Kompletność i kategoria Allegro</option><option value="szkic" ${q.operation==="szkic"?"selected":""}>Przygotuj / sprawdź szkic</option><option value="prowizja" ${q.operation==="prowizja"?"selected":""}>Pobierz prowizje i opłaty</option><option value="seo" ${q.operation==="seo"?"selected":""}>Popraw SEO produktu</option></select><button class="btn ghost" onclick="asortymentUruchomAgentaDlaZaznaczonych()" ${!selected||q.busy?"disabled":""}>Uruchom wybrane</button></div></details></article><article class="product-action-primary external"><small>KROK 2 • WYSTAW GOTOWE</small><b>Publikacja po ponownej kontroli</b><button class="btn product-allegro-publish" onclick="asortymentWystawZaznaczoneNaAllegro()" ${!selected||q.busy?"disabled":""}>🟠 Wystaw gotowe na Allegro</button><small>Każdy produkt zostanie ponownie przygotowany. Braki zatrzymają tylko daną pozycję i pojawią się w raporcie.</small><details><summary>Inna operacja Allegro</summary><div class="product-action-advanced"><select data-external-product-operation onchange="asortymentUstawOperacjeZewnetrzna(this.value)" ${q.busy?"disabled":""}><option value="update">Aktualizuj istniejące oferty</option><option value="draft">Utwórz brakujące jako nieaktywne</option><option value="activate">Opublikuj / aktywuj sprzedaż</option><option value="withdraw">Zakończ powiązane oferty</option></select><button class="btn ghost" onclick="asortymentPrzygotujOperacjeZewnetrzna()" ${!selected||q.busy?"disabled":""}>Przygotuj decyzję</button></div></details></article></div>${q.busy||q.finishedAt?`<div class="product-agent-progress" aria-live="polite"><progress max="${q.total||1}" value="${q.done}"></progress><div><b>${q.busy?`Agent zapisuje: ${esc(q.current||"uruchamianie kolejki")}`:q.cloudSaved===false?"Kolejka zakończona — serwer ponowi zapis":"Kolejka Agenta zakończona i zapisana"}</b><small>${q.done}/${q.total} • poprawnie ${q.ok} • uwagi ${q.warnings} • błędy ${q.failed}${q.cancel?" • zatrzymywanie":""}</small></div>${q.busy?`<button class="btn ghost" onclick="asortymentAnulujAgenta()">Zatrzymaj po bieżącym</button>`:""}</div>`:""}${q.results.length?`<details class="product-agent-results" ${!q.busy?"open":""}><summary>Konkretny zapis Agenta (${q.results.length})</summary>${q.results.slice(-30).map(x=>`<p class="${x.ok?x.ready===false?"warning":"ok":"error"}"><b>${x.ok?x.ready===false?"⚠️":"✅":"⛔"} ${esc(x.name)}</b>${x.ok?`<span>${x.savedFields?.length?`Zapisano: ${esc(asortymentEtykietyPol(x.savedFields).join(", "))}`:"Dane sprawdzone — bez nowych zmian"}</span>${x.missing?.length?`<small>Do uzupełnienia: ${esc(x.missing.join(", "))}</small>`:`<small>Komplet danych do wystawienia</small>`}`:`<span>${esc(x.error)}</span>`}</p>`).join("")}</details>`:""}${asortymentDecyzjaZewnetrznaHTML()}</section>`;
}
function asortymentMenuDzialanProduktuHTML(p={}){
  const offer=asortymentOfertaProduktu(p);return `<details class="product-row-action-menu"><summary class="btn ghost">⚡ Działania</summary><div>${asortymentStatusPrzygotowaniaHTML(p)}<button class="primary" onclick="asortymentPrzygotujProduktDoAllegroZMenu(${jsArg(p.id)})">🤖 Przygotuj i zapisz do Allegro</button><button class="allegro" onclick="asortymentPrzygotujOperacjeZewnetrzna('${offer?"update":"activate"}',${jsArg(p.id)})">🟠 ${offer?"Zapisz poprawki w ofercie":"Wystaw gotowy produkt"}</button><button onclick="asortymentUruchomAgentaDlaProduktu(${jsArg(p.id)},'prowizja')">📊 Pobierz prowizję</button>${offer?`<a href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener">↗ Otwórz ofertę Allegro</a><button class="danger" onclick="asortymentPrzygotujOperacjeZewnetrzna('withdraw',${jsArg(p.id)})">⏹ Przygotuj zakończenie</button>`:""}</div></details>`;
}
