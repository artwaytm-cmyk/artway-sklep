/* ═══════════ ATOMOWE MUTACJE PÓL USTAWIEŃ ═══════════
   Każda drobna zmiana formularza trafia do trwałej kolejki, jest nakładana na
   najnowszy rekord serwera i znika z kolejki dopiero po odczycie potwierdzenia. */
const CHMURA_MUTACJE_POL_USTAWIEN_KEY = "artway_oczekujace_mutacje_ustawien";
let chmuraMutacjePolUstawien = (()=>{const value=wczytajLS(CHMURA_MUTACJE_POL_USTAWIEN_KEY,[]);return Array.isArray(value)?value.slice(0,250):[];})();
let chmuraMutacjePolUstawienWToku = null;
let chmuraMutacjePolUstawienTimer = null;

function chmuraMutacjePolUstawienZapiszKolejke(){
  try{localStorage.setItem(CHMURA_MUTACJE_POL_USTAWIEN_KEY,JSON.stringify(chmuraMutacjePolUstawien.slice(0,250)));return true;}
  catch(e){return false;}
}
function chmuraMutacjaOdcisk(value){
  try{return JSON.stringify(value);}
  catch(e){return String(value);}
}
function chmuraMutacjePolUstawienZaplanuj(ms=12000){
  clearTimeout(chmuraMutacjePolUstawienTimer);
  if(!chmuraMutacjePolUstawien.length)return;
  chmuraMutacjePolUstawienTimer=setTimeout(()=>chmuraWyslijMutacjePolUstawien().catch(()=>false),ms);
}
async function chmuraWyslijMutacjePolUstawien(){
  if(chmuraMutacjePolUstawienWToku)return chmuraMutacjePolUstawienWToku;
  if(!chmuraMutacjePolUstawien.length)return true;
  if(!maUprawnieniaZapisuChmury()){chmuraMutacjePolUstawienZaplanuj(15000);return false;}
  chmuraMutacjePolUstawienWToku=(async()=>{
    while(chmuraMutacjePolUstawien.length){
      const mutation=chmuraMutacjePolUstawien[0];
      try{
        const d=await chmura("settings-field-mutation",{method:"POST",body:{mutationId:mutation.id,changes:mutation.changes||{},removeKeys:mutation.removeKeys||[],expectedRev:Number(chmuraStan.rev||wczytajLS("artway_chmura_rev",0))||0},timeout:30000});
        const authoritative=d.authoritative||{},values=authoritative.values||{},deleted=new Set(authoritative.deletedKeys||[]);
        for(const [key,value] of Object.entries(mutation.changes||{})){
          if(key in values){
            ustawienia[key]=values[key];
          }else if(Object.prototype.hasOwnProperty.call(mutation.changes,key)){
            ustawienia[key]=mutation.changes[key];
          }
        }
        for(const key of mutation.removeKeys||[]){
          if(deleted.has(key))delete ustawienia[key];
        }
        for(const key of authoritative.deletedKeys||[]){
          if(!Array.isArray(mutation.removeKeys)||!mutation.removeKeys.includes(key)) delete ustawienia[key];
        }
        zapiszLS("artway_ustawienia",ustawienia,{synchronizuj:false});
        chmuraStan={...chmuraStan,dostepna:true,admin:true,rev:d.rev||chmuraStan.rev,updated_at:d.updated_at||null,error:"",ostatniZapis:Date.now()};
        localStorage.setItem("artway_chmura_rev",JSON.stringify(d.rev||chmuraStan.rev));
        chmuraMutacjePolUstawien.shift();
        chmuraMutacjePolUstawienZapiszKolejke();
      }catch(error){
        chmuraStan={...chmuraStan,error:error.message||String(error)};
        chmuraMutacjePolUstawienZaplanuj(error?.code==="auth"?30000:5000);
        return false;
      }
    }
    return true;
  })();
  try{return await chmuraMutacjePolUstawienWToku;}
  finally{
    chmuraMutacjePolUstawienWToku=null;
    if(chmuraMutacjePolUstawien.length)chmuraMutacjePolUstawienZaplanuj();
  }
}
async function chmuraDodajMutacjePolUstawien(changes={},removeKeys=[],options={}){
  let cleanChanges={},cleanRemove=[...new Set((Array.isArray(removeKeys)?removeKeys:[]).map(String).filter(Boolean))];
  for(const [key,value] of Object.entries(changes||{})){
    if(value===undefined){if(!cleanRemove.includes(key))cleanRemove.push(key);}
    else cleanChanges[key]=JSON.parse(JSON.stringify(value));
  }
  if(!options.skipSiteRelease&&typeof siteReleaseStageSettingsMutation==="function"){
    const release=await siteReleaseStageSettingsMutation(cleanChanges,cleanRemove);
    if(release?.handled){cleanChanges=release.liveChanges||{};cleanRemove=release.liveRemove||[];if(!Object.keys(cleanChanges).length&&!cleanRemove.length)return true;}
  }
  if(!Object.keys(cleanChanges).length&&!cleanRemove.length)return true;
  const mutation={id:`setting-${Date.now().toString(36)}-${(++chmuraNumerMutacji).toString(36)}-${Math.random().toString(36).slice(2,8)}`,at:new Date().toISOString(),changes:cleanChanges,removeKeys:cleanRemove};
  chmuraMutacjePolUstawien.push(mutation);
  if(!chmuraMutacjePolUstawienZapiszKolejke()){
    chmuraStan={...chmuraStan,error:"Nie udało się zabezpieczyć kolejki zmian ustawień w pamięci przeglądarki."};
    return false;
  }
  return chmuraWyslijMutacjePolUstawien();
}

/* ═══════════ ATOMOWE MUTACJE PRODUKTÓW ═══════════
   Przeglądarka przechowuje tylko krótką kolejkę poleceń. Źródłem prawdy jest
   centralna kartoteka PostgreSQL, a wpis znika dopiero po potwierdzonym
   zapisie i odczycie tego samego produktu z serwera. */
const CHMURA_MUTACJE_PRODUKTOW_KEY="artway_oczekujace_mutacje_produktow_v1";
let chmuraMutacjeProduktow=(()=>{const value=wczytajLS(CHMURA_MUTACJE_PRODUKTOW_KEY,[]);return Array.isArray(value)?value.slice(0,200):[];})();
let chmuraMutacjeProduktowWToku=null;
let chmuraMutacjeProduktowTimer=null;
function chmuraMutacjeProduktowZapisz(){
  try{localStorage.setItem(CHMURA_MUTACJE_PRODUKTOW_KEY,JSON.stringify(chmuraMutacjeProduktow.slice(0,200)));return true;}
  catch(e){return false;}
}
function chmuraMutacjeProduktowZaplanuj(ms=3000){
  clearTimeout(chmuraMutacjeProduktowTimer);
  if(!chmuraMutacjeProduktow.length)return;
  chmuraMutacjeProduktowTimer=setTimeout(()=>chmuraWyslijMutacjeProduktow().catch(()=>false),ms);
}
async function chmuraWyslijMutacjeProduktow(){
  if(chmuraMutacjeProduktowWToku)return chmuraMutacjeProduktowWToku;
  if(!chmuraMutacjeProduktow.length)return true;
  if(!maUprawnieniaZapisuChmury()){chmuraMutacjeProduktowZaplanuj(15000);return false;}
  chmuraMutacjeProduktowWToku=(async()=>{
    while(chmuraMutacjeProduktow.length){
      const mutation=chmuraMutacjeProduktow[0];
      try{
        const result=await chmura("catalog-product-fields-update",{method:"POST",body:{
          productId:mutation.productId,fields:mutation.fields||{},remove:mutation.remove||[],mutationId:mutation.id,
          area:mutation.area||"admin-product-editor"
        },timeout:60000});
        if(result?.confirmed!==true||result?.publication?.published!==true)throw new Error("Serwer nie potwierdził publikacji produktu.");
        const product=result.product&&String(result.product.id)===String(mutation.productId)?result.product:null;
        if(product&&typeof asortymentCentralnyPodmienProdukt==="function")asortymentCentralnyPodmienProdukt(mutation.productId,product);
        if(product&&typeof asortymentPelneProduktyCache!=="undefined")asortymentPelneProduktyCache.set(String(mutation.productId),{at:Date.now(),product});
        chmuraMutacjeProduktow.shift();chmuraMutacjeProduktowZapisz();
      }catch(error){
        chmuraStan={...chmuraStan,error:error.message||String(error)};
        chmuraMutacjeProduktowZaplanuj(error?.code==="auth"?30000:8000);
        return false;
      }
    }
    return true;
  })();
  try{return await chmuraMutacjeProduktowWToku;}
  finally{
    chmuraMutacjeProduktowWToku=null;
    if(chmuraMutacjeProduktow.length)chmuraMutacjeProduktowZaplanuj();
  }
}
function chmuraDodajMutacjeProduktu(productId,fields={},remove=[],area="admin-product-editor"){
  const id=String(productId??"").trim(),cleanFields={};
  for(const [key,value] of Object.entries(fields||{})){
    if(["id","_catalog","stan","dostepny"].includes(key)||value===undefined)continue;
    cleanFields[key]=JSON.parse(JSON.stringify(value));
  }
  const cleanRemove=[...new Set((Array.isArray(remove)?remove:[]).map(String).filter(key=>key&&!["_catalog","stan","dostepny","id"].includes(key)))];
  if(!id||(!Object.keys(cleanFields).length&&!cleanRemove.length))return Promise.resolve(true);
  const mutation={id:`product:${id}:${Date.now().toString(36)}:${(++chmuraNumerMutacji).toString(36)}:${Math.random().toString(36).slice(2,8)}`,productId:id,fields:cleanFields,remove:cleanRemove,area:String(area||"admin-product-editor"),at:new Date().toISOString()};
  chmuraMutacjeProduktow.push(mutation);
  if(!chmuraMutacjeProduktowZapisz()){
    chmuraStan={...chmuraStan,error:"Nie udało się zabezpieczyć kolejki zmian produktów w przeglądarce."};
    return Promise.resolve(false);
  }
  return chmuraWyslijMutacjeProduktow();
}
async function chmuraZapiszProduktyCentralnie(operations=[],area="admin-product-batch"){
  let normalized=(Array.isArray(operations)?operations:[]).map((operation,index)=>{
    const productId=String(operation?.productId??operation?.id??"").trim(),fields={};
    for(const [key,value] of Object.entries(operation?.fields||{})){
      if(["id","_catalog","stan","dostepny"].includes(key)||value===undefined)continue;
      fields[key]=JSON.parse(JSON.stringify(value));
    }
    const remove=[...new Set((Array.isArray(operation?.remove)?operation.remove:[]).map(String).filter(key=>key&&!["id","_catalog","stan","dostepny"].includes(key)))];
    return {productId,fields,remove,mutationId:String(operation?.mutationId||`product-batch:${productId}:${Date.now().toString(36)}:${index}`)};
  }).filter(operation=>operation.productId&&(Object.keys(operation.fields).length||operation.remove.length));
  const requested=normalized.length;let staged=0;
  if(normalized.length&&typeof siteReleaseStageProductOperations==="function"){
    const release=await siteReleaseStageProductOperations(normalized);if(release?.handled){normalized=release.liveOperations||[];staged=Number(release.staged)||0;}
  }
  if(!normalized.length)return {ok:true,confirmed:true,changed:0,staged,requested,products:[]};
  const results=[];
  for(let offset=0;offset<normalized.length;offset+=250){
    const batch=normalized.slice(offset,offset+250);
    const result=await chmura("catalog-product-fields-batch-update",{method:"POST",body:{operations:batch,area},timeout:120000});
    if(result?.confirmed!==true)throw new Error(`Serwer nie potwierdził ${result?.skippedProductIds?.length||batch.length} zmian produktów.`);
    for(const product of result.products||[]){
      const id=String(product?.id??"");if(!id)continue;
      if(typeof podmienProduktAdminBezRenderu==="function")podmienProduktAdminBezRenderu(id,product,[]);
      if(typeof asortymentCentralnyPodmienProdukt==="function")asortymentCentralnyPodmienProdukt(id,product,[]);
      if(typeof asortymentPelneProduktyCache!=="undefined")asortymentPelneProduktyCache.set(id,{at:Date.now(),product});
    }
    results.push(result);
  }
  return {
    ok:true,confirmed:true,
    changed:results.reduce((sum,result)=>sum+(Number(result.changed)||0),0),
    staged,requested,
    products:results.flatMap(result=>result.products||[]),
  };
}
setTimeout(()=>chmuraMutacjeProduktowZaplanuj(1000),0);
