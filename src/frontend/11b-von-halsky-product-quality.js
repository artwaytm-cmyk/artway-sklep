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
