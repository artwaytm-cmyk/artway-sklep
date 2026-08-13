let inpostServiceStan={loaded:false,loading:false,saving:false,error:"",items:[],addressBook:[],settings:{commissionGross:4,sender:{}},billing:{groups:[]},serviceAvailability:null,requestId:"",pricing:null};
let inpostServiceSzukaj="",inpostServiceFiltr="wszystkie",inpostServiceBillingFiltr="wszystkie";
let inpostServicePotwierdzenieWybrane=new Set();

function inpostServiceNowyRequestId(){
  inpostServiceStan.requestId=(globalThis.crypto?.randomUUID?.()||`inpost-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return inpostServiceStan.requestId;
}
function inpostServiceAdresFirmy(){
  const d=daneFirmy(),raw=String(d.adres||"").trim(),match=raw.match(/^(.+?)\s+([0-9][0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż/.-]*)$/);
  return {companyName:d.nazwa||"",taxCode:d.nip||"",firstName:"Artway",lastName:"TM",email:KONFIG.emailSklepu||"",phone:String(KONFIG.telefon||"").replace(/\D/g,"").slice(-9),address:{street:match?match[1]:raw,buildingNumber:match?match[2]:"",flatNumber:"",postCode:d.kodPocztowy||"",city:d.miasto||""}};
}
function inpostServiceNadawca(){
  const fallback=inpostServiceAdresFirmy(),saved=inpostServiceStan.settings?.sender||{};
  return {...fallback,...saved,address:{...(fallback.address||{}),...(saved.address||{})}};
}
function inpostServiceKlienci(){
  const users=typeof pobierzUzytkownikow==="function"?pobierzUzytkownikow():[];
  const shipmentClients=(inpostServiceStan.items||[]).map(item=>item.receiver).filter(Boolean);
  const map=new Map();
  [...users,...shipmentClients].forEach(raw=>{
    const company=raw.daneFirmy||{},email=String(raw.email||company.email||"").trim().toLowerCase(),nip=String(raw.nip||company.nip||raw.taxCode||"").replace(/\D/g,""),key=nip||email;
    if(!key)return;
    const address=raw.address||raw.adresDostawy||company.address||company.adres||{};
    map.set(key,{key,companyName:raw.companyName||raw.firma||company.nazwa||"",taxCode:nip,firstName:raw.firstName||raw.imie||"",lastName:raw.lastName||raw.nazwisko||"",email,phone:raw.phone||raw.telefon||"",address:{street:address.street||address.ulica||raw.ulica||"",buildingNumber:address.buildingNumber||address.nrDomu||raw.nrDomu||"",flatNumber:address.flatNumber||address.nrLokalu||raw.nrLokalu||"",postCode:address.postCode||address.kod||address.kodPocztowy||raw.kod||"",city:address.city||address.miasto||raw.miasto||""}});
  });
  return [...map.values()].slice(0,1000);
}
async function inpostServiceLaduj(force=false,cicho=true){
  if(inpostServiceStan.loading||(!force&&inpostServiceStan.loaded))return;
  inpostServiceStan={...inpostServiceStan,loading:true,error:""};
  try{
    const d=await chmura("inpost-service-shipments",{params:{limit:300},timeout:30000});
    inpostServiceStan={...inpostServiceStan,loaded:true,loading:false,items:Array.isArray(d.items)?d.items:[],addressBook:Array.isArray(d.addressBook)?d.addressBook:[],settings:d.settings||{commissionGross:4,sender:{}},billing:d.billing||{groups:[]},serviceAvailability:d.serviceAvailability||null,error:""};
    if(!inpostServiceStan.requestId)inpostServiceNowyRequestId();
  }catch(e){inpostServiceStan={...inpostServiceStan,loaded:true,loading:false,error:e.message||String(e)};if(!cicho)toast("InPost: "+inpostServiceStan.error);}
  if(trasa().startsWith("/admin/wysylki/inpost")||trasa()==="/admin/wysylki/odbior-kuriera")renderuj();
}
const inpostServiceMetodyNadania={
  locker:[
    ["parcel_locker","Nadam w automacie Paczkomat"],
    ["dispatch_order","Przesyłkę odbierze kurier InPost"],
    ["pop","Nadam w PaczkoPunkcie"]
  ],
  courier:[
    ["parcel_locker","Nadam w automacie Paczkomat"],
    ["dispatch_order","Przesyłkę odbierze kurier InPost"],
    ["pop","Nadam w PaczkoPunkcie"]
  ]
};
const inpostServiceMetodyWymagajacePunktu=new Set(["parcel_locker","pok","courier_pok"]);
function inpostServiceCourierC2CAktywny(){return (inpostServiceStan.serviceAvailability?.services||[]).includes("inpost_courier_c2c");}
function inpostServiceMetodyNadaniaOpcjeHTML(type="locker",selected=""){
  return (inpostServiceMetodyNadania[type]||inpostServiceMetodyNadania.locker).map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(selected)?"selected":""}>${esc(label)}</option>`).join("");
}
function inpostServiceZastosujZgodnoscTypu(form,preferDefault=false){
  const type=String(form?.deliveryType?.value||"locker");
  form?.querySelectorAll("[data-inpost-only]").forEach(el=>el.hidden=!String(el.dataset.inpostOnly||"").split(",").includes(type));
  const allowed=(inpostServiceMetodyNadania[type]||[]).filter(([value])=>type!=="courier"||value!=="parcel_locker"||inpostServiceCourierC2CAktywny()),allowedValues=new Set(allowed.map(([value])=>value)),methodInputs=[...(form?.querySelectorAll?.('[name="sendingMethod"]')||[])];
  methodInputs.forEach(input=>{const enabled=allowedValues.has(input.value),card=input.closest("[data-inpost-method-card]");input.disabled=!enabled;if(card){card.hidden=!enabled;if(enabled)card.style.removeProperty("display");else card.style.setProperty("display","none","important");}});
  let method=String(form?.elements?.sendingMethod?.value||"");
  if(preferDefault){
    const preferred=methodInputs.find(input=>input.value==="parcel_locker"&&!input.disabled);
    methodInputs.forEach(input=>{input.checked=Boolean(preferred&&input===preferred);});
    method=preferred?.value||"";
  }
  if(!allowedValues.has(method)){
    methodInputs.forEach(input=>{input.checked=false;});method="";
    if(type==="locker"){const preferred=methodInputs.find(input=>input.value==="parcel_locker"&&!input.disabled);if(preferred){preferred.checked=true;method=preferred.value;}}
  }
  const requiresPoint=inpostServiceMetodyWymagajacePunktu.has(method),dropoff=form?.elements?.dropoffPoint;
  if(dropoff){
    dropoff.required=requiresPoint;
    dropoff.setAttribute("aria-required",requiresPoint?"true":"false");
    if(!requiresPoint)dropoff.value="";
    dropoff.placeholder=requiresPoint?"Wybierz automat nadawczy":"";
  }
  const dropoffPanel=form?.querySelector("[data-inpost-dropoff-panel]");if(dropoffPanel)dropoffPanel.hidden=!requiresPoint;
  const compatibility=form?.querySelector("[data-inpost-method-compatibility]");if(compatibility){compatibility.hidden=type!=="courier";compatibility.innerHTML=inpostServiceCourierC2CAktywny()?"<b>Domyślny Paczkomat jest dostępny.</b> Formularz użyje usługi Kurier C2C z tej samej organizacji InPost. Możesz też świadomie wybrać PaczkoPunkt albo odbiór przez kuriera.":"<b>Domyślny Paczkomat nie jest dostępny dla Kuriera Standard.</b> Wybierz PaczkoPunkt/POP albo odbiór przez kuriera — formularz nie przełączy metody automatycznie.";}
  const label=form?.querySelector("[data-inpost-dropoff-label]"),hint=form?.querySelector("[data-inpost-dropoff-hint]");
  if(label)label.textContent=requiresPoint?"Automat nadawczy *":"";
  if(hint)hint.textContent=requiresPoint?"ShipX wymaga kodu automatu dla tego sposobu nadania.":"";
  form?.querySelectorAll('[data-receiver-address]').forEach(input=>input.required=type==="courier");
  const target=form?.elements?.targetPoint;if(target)target.required=type==="locker";
  const xlarge=form?.querySelector('[data-inpost-size="xlarge"]');if(xlarge)xlarge.hidden=type!=="courier";
  if(type!=="courier"&&form?.elements?.template?.value==="xlarge"){const small=form.querySelector('[name="template"][value="small"]');if(small){small.checked=true;inpostServiceUstawGabaryt(form,"small",false);}}
  return {type,method,requiresPoint};
}
function inpostServiceUstawGabaryt(form,size="",recalculate=true){
  const dimensions={small:[64,38,8],medium:[64,38,19],large:[64,38,41],xlarge:[80,50,50]}[String(size||form?.elements?.template?.value||"small")]||[64,38,8];
  ["length","width","height"].forEach((name,index)=>{if(form?.elements?.[name])form.elements[name].value=dimensions[index];});
  if(recalculate)inpostServiceZaplanujWycene(form);
}
function inpostServicePrzelicz(form){
  const fee=Math.max(0,Number(String(form?.commissionGross?.value||0).replace(",","."))||0),out=form?.querySelector("[data-inpost-commission-total]");
  if(out)out.textContent=fee.toLocaleString("pl-PL",{style:"currency",currency:"PLN"});
}
function inpostServiceWypelnijKlienta(input){
  const form=input?.form,key=String(input?.value||"").trim().toLowerCase(),client=inpostServiceKlienci().find(item=>item.key.toLowerCase()===key||item.email===key||item.taxCode===key);
  if(!form||!client)return;
  const fields={receiverCompany:client.companyName,receiverTaxCode:client.taxCode,receiverFirstName:client.firstName,receiverLastName:client.lastName,receiverEmail:client.email,receiverPhone:client.phone,receiverStreet:client.address?.street,receiverBuilding:client.address?.buildingNumber,receiverFlat:client.address?.flatNumber,receiverPostCode:client.address?.postCode,receiverCity:client.address?.city};
  Object.entries(fields).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value||"";});
  toast("Dane stałego klienta uzupełnione ✅");
}
function inpostServiceStronaOsoby(form,prefix){
  return {companyName:form.elements[`${prefix}Company`]?.value||"",taxCode:form.elements[`${prefix}TaxCode`]?.value||"",firstName:form.elements[`${prefix}FirstName`]?.value||"",lastName:form.elements[`${prefix}LastName`]?.value||"",email:form.elements[`${prefix}Email`]?.value||"",phone:form.elements[`${prefix}Phone`]?.value||"",address:{street:form.elements[`${prefix}Street`]?.value||"",buildingNumber:form.elements[`${prefix}Building`]?.value||"",flatNumber:form.elements[`${prefix}Flat`]?.value||"",postCode:form.elements[`${prefix}PostCode`]?.value||"",city:form.elements[`${prefix}City`]?.value||""}};
}
function inpostServiceTekstPorownawczy(value){return String(value||"").trim().toLocaleLowerCase("pl-PL");}
function inpostServiceAdresKlucz(person={}){const a=person.address||{};return [a.street,a.buildingNumber||a.building_number,a.flatNumber||a.flat_number,a.postCode||a.post_code,a.city].map(inpostServiceTekstPorownawczy).filter(Boolean).join("|");}
function inpostServiceNormalizujNadawceKlienta(form){
  if(!form)return;
  const current=inpostServiceStronaOsoby(form,"sender"),technical=inpostServiceNadawca();
  const personalChanged=!!(current.firstName||current.lastName)&&[current.firstName,current.lastName].map(inpostServiceTekstPorownawczy).join("|")!==[technical.firstName,technical.lastName].map(inpostServiceTekstPorownawczy).join("|");
  const currentAddress=inpostServiceAdresKlucz(current),technicalAddress=inpostServiceAdresKlucz(technical),addressChanged=!!currentAddress&&currentAddress!==technicalAddress;
  if(!personalChanged&&!addressChanged)return;
  const company=form.elements.senderCompany,taxCode=form.elements.senderTaxCode;
  if(company&&technical.companyName&&inpostServiceTekstPorownawczy(company.value)===inpostServiceTekstPorownawczy(technical.companyName))company.value="";
  if(taxCode&&technical.taxCode&&String(taxCode.value||"").replace(/\D/g,"")===String(technical.taxCode||"").replace(/\D/g,""))taxCode.value="";
}
function inpostServiceAdresZwrotuNotatka(person={}){
  const a=person.address||{},name=person.companyName||`${person.firstName||""} ${person.lastName||""}`.trim(),building=[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/"),street=[a.street,building].filter(Boolean).join(" "),city=[a.postCode||a.post_code,a.city].filter(Boolean).join(" "),destination=[name,street,city].filter(Boolean).join(", ");
  return `Zwroty kierować pod adres nadawcy: ${destination}${destination?".":""}`.replace(/\s+/g," ").trim().slice(0,100);
}
function inpostServiceUwagiZeZwrotem(value,sender){
  const note=inpostServiceAdresZwrotuNotatka(sender),custom=String(value||"").replace(/(?:^|\s)Zwroty\s+kierować(?:\s+pod|\s+na)?\s+adres(?:\s+nadawcy)?\s*:?.*$/iu,"").replace(/\s+/g," ").trim();
  if(!custom)return note;
  const prefix=custom.slice(0,Math.max(0,100-note.length-1)).replace(/[\s,;:-]+$/u,"");
  return [prefix,note].filter(Boolean).join(" ").slice(0,100);
}
function inpostServiceAktualizujAdresZwrotu(form){
  const target=form?.querySelector?.("[data-inpost-return-address]");if(!target)return;
  target.textContent=inpostServiceAdresZwrotuNotatka(inpostServiceStronaOsoby(form,"sender"))||"Uzupełnij adres nadawcy.";
}
function inpostServiceUzupelnijKontaktTechniczny(form){
  const technical=inpostServiceNadawca(),fallback=inpostServiceAdresFirmy(),email=technical.email||fallback.email||"",phone=technical.phone||fallback.phone||"";
  ["sender","receiver"].forEach(prefix=>{
    const emailInput=form?.elements?.[`${prefix}Email`],phoneInput=form?.elements?.[`${prefix}Phone`];
    if(emailInput&&!String(emailInput.value||"").trim()&&email){emailInput.value=email;emailInput.dataset.inpostTechnicalContact="true";}
    if(phoneInput&&!String(phoneInput.value||"").trim()&&phone){phoneInput.value=phone;phoneInput.dataset.inpostTechnicalContact="true";}
  });
}
function inpostServicePayload(form){
  inpostServiceNormalizujNadawceKlienta(form);
  inpostServiceUzupelnijKontaktTechniczny(form);
  const data=new FormData(form),additionalServices=[...form.querySelectorAll('[name="additionalServices"]:checked')].map(input=>input.value);
  const codAmount=Math.max(0,Number(String(data.get("codAmount")||"0").replace(",","."))||0),insuranceAmount=Math.max(0,Number(String(data.get("insuranceAmount")||"0").replace(",","."))||0),sendingMethod=String(data.get("sendingMethod")||"");
  const sender=inpostServiceStronaOsoby(form,"sender");
  return {requestId:inpostServiceStan.requestId||inpostServiceNowyRequestId(),reference:String(data.get("reference")||"").trim(),comments:inpostServiceUwagiZeZwrotem(data.get("comments"),sender),returnAddress:sender.address,principal:sender,sender,receiver:inpostServiceStronaOsoby(form,"receiver"),saveSender:data.get("saveSender")==="on",saveReceiver:data.get("saveReceiver")==="on",deliveryType:data.get("deliveryType"),sendingMethod,targetPoint:data.get("targetPoint"),dropoffPoint:data.get("dropoffPoint"),parcel:{template:data.get("template"),length:data.get("length"),width:data.get("width"),height:data.get("height"),weight:data.get("weight"),nonStandard:data.get("nonStandard")==="on"},cod:{enabled:codAmount>0||data.get("codEnabled")==="on",amount:codAmount},insurance:{enabled:insuranceAmount>0||data.get("insuranceEnabled")==="on",amount:insuranceAmount},weekend:["on","true","1"].includes(String(data.get("weekend")||"")),additionalServices,pickupRequested:sendingMethod==="dispatch_order"||data.get("pickupRequested")==="on",billingMode:data.get("billingMode"),billingMonth:data.get("billingMonth"),commissionGross:data.get("commissionGross"),carrierCostOverride:data.get("carrierCostOverride")};
}
function inpostServiceSzczegolyBledu(fields,prefix=""){
  const out=[];
  const visit=(value,path)=>{
    if(value==null)return;
    if(typeof value==="string"||typeof value==="number"||typeof value==="boolean"){out.push({field:path,message:String(value)});return;}
    if(Array.isArray(value)){value.forEach((item,index)=>visit(item,path));return;}
    if(typeof value==="object"){
      if(typeof value.message==="string"){out.push({field:String(value.field||path),message:value.message});return;}
      Object.entries(value).forEach(([key,item])=>visit(item,path?`${path}.${key}`:key));
    }
  };
  visit(fields,prefix);return out;
}
function inpostServiceNazwaPola(path=""){
  const map={"sender.firstName":"senderFirstName","sender.email":"senderEmail","sender.phone":"senderPhone","sender.address.street":"senderStreet","sender.address.buildingNumber":"senderBuilding","sender.address.postCode":"senderPostCode","sender.address.city":"senderCity","receiver.firstName":"receiverFirstName","receiver.email":"receiverEmail","receiver.phone":"receiverPhone","receiver.address.street":"receiverStreet","receiver.address.buildingNumber":"receiverBuilding","receiver.address.postCode":"receiverPostCode","receiver.address.city":"receiverCity","targetPoint":"targetPoint","dropoffPoint":"dropoffPoint","sending_method":"sendingMethod","custom_attributes.target_point":"targetPoint","custom_attributes.dropoff_point":"dropoffPoint","custom_attributes.sending_method":"sendingMethod","cod.amount":"codAmount","insurance.amount":"insuranceAmount","parcel.weight":"weight","commissionGross":"commissionGross"};
  return map[path]||path.split(".").at(-1)||"";
}
function inpostServicePrzyjaznyBlad(detail={},form=null){
  const field=String(detail.field||""),message=String(detail.message||"").trim(),type=String(form?.elements?.deliveryType?.value||"");
  if(/sending_method/.test(field)||/sending[_ ]method/i.test(message))return type==="courier"?"Dla przesyłki kurierskiej wybierz nadanie w PaczkoPunkcie albo odbiór przez kuriera.":"Wybierz sposób nadania zgodny z wybraną usługą InPost.";
  if(/dropoff_point/.test(field))return "Wybierz punkt nadania dla wskazanego sposobu przekazania paczki.";
  if(/target_point/.test(field))return "Wybierz Paczkomat lub PaczkoPunkt odbiorcy.";
  if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(message)||/custom_attributes|uuid|request[_ ]?id/i.test(message))return "InPost odrzucił jedną z opcji. Sprawdź sposób nadania i dane przesyłki.";
  return message||"Sprawdź wskazane pole.";
}
function inpostServiceWyczyscBledyFormularza(form){
  form?.querySelectorAll(".inpost-field-error").forEach(element=>element.classList.remove("inpost-field-error"));
  const box=form?.querySelector("[data-inpost-form-errors]");if(box){box.hidden=true;box.innerHTML="";}
}
function inpostServiceBladPol(fields=[],form=document.getElementById("inpostServiceForm"),notify=true){
  const details=inpostServiceSzczegolyBledu(fields).map(detail=>({...detail,message:inpostServicePrzyjaznyBlad(detail,form)}));
  inpostServiceWyczyscBledyFormularza(form);
  details.forEach(detail=>{const input=form?.elements?.[inpostServiceNazwaPola(detail.field)];input?.classList?.add("inpost-field-error");});
  const messages=[...new Set(details.map(item=>item.message).filter(Boolean))],box=form?.querySelector("[data-inpost-form-errors]");
  if(box&&messages.length){box.hidden=false;box.innerHTML=`<b>Popraw dane przed nadaniem:</b><ul>${messages.map(message=>`<li>${esc(message)}</li>`).join("")}</ul>`;}
  const firstField=details.map(detail=>form?.elements?.[inpostServiceNazwaPola(detail.field)]).find(Boolean);firstField?.focus?.();
  if(notify&&messages[0])toast(messages[0]);
  return details;
}
async function inpostServiceUtworz(event){
  event.preventDefault();if(inpostServiceStan.saving)return;
  const form=event.currentTarget,payload=inpostServicePayload(form),button=form.querySelector('[type="submit"]');
  inpostServiceWyczyscBledyFormularza(form);
  inpostServiceStan={...inpostServiceStan,saving:true};if(button){button.disabled=true;button.textContent="⏳ Tworzę przesyłkę…";}
  try{
    const d=await chmura("inpost-service-create",{method:"POST",body:payload,timeout:90000});
    if(d.item)inpostServiceStan.items=[d.item,...inpostServiceStan.items.filter(item=>item.id!==d.item.id)];
    inpostServiceNowyRequestId();await inpostServiceLaduj(true,true);
    if(d.item){inpostServiceSzukaj=String(d.item.trackingNumber||d.item.reference||d.item.id||"");inpostServiceFiltr="wszystkie";inpostServiceBillingFiltr="wszystkie";}
    toast(d.invoice?.error?`Przesyłka utworzona ✅ Faktura wymaga uwagi: ${d.invoice.error}`:`Przesyłka InPost utworzona ✅ ${d.item?.trackingNumber||"oczekuje na numer"}`);
    renderuj();
  }catch(e){if(e.code==="previous_attempt_failed"){inpostServiceNowyRequestId();if(form.elements.requestId)form.elements.requestId.value=inpostServiceStan.requestId;}const details=inpostServiceBladPol(e.details,form,false),message=details[0]?.message||"Nie udało się utworzyć przesyłki. Sprawdź dane i spróbuj ponownie.";toast("Nie utworzono przesyłki: "+message);}
  finally{inpostServiceStan={...inpostServiceStan,saving:false};if(button){button.disabled=false;button.textContent="🟡 Utwórz przesyłkę InPost";}}
}
async function inpostServiceZapiszUstawienia(event){
  event.preventDefault();const form=event.currentTarget,body={commissionGross:form.commissionGross.value,sender:inpostServiceStronaOsoby(form,"sender")};
  try{const d=await chmura("inpost-service-settings",{method:"POST",body,timeout:20000});inpostServiceStan.settings=d.settings||inpostServiceStan.settings;toast("Domyślny nadawca i prowizja zapisane ✅");renderuj();}catch(e){toast("Nie zapisano ustawień: "+(e.message||e));}
}
async function inpostServicePobierzStatus(id){
  const current=inpostServiceStan.items.find(item=>item.id===id);if(!current)throw new Error("Nie znaleziono nadania");
  if(!current.inpostId)return current;
  const d=await chmura("inpost-service-status",{params:{id},timeout:30000});
  if(d.item)inpostServiceStan.items=inpostServiceStan.items.map(item=>item.id===id?d.item:item);
  return d.item||current;
}
async function inpostServiceStatus(id){
  try{await inpostServicePobierzStatus(id);toast("Status i historia InPost odświeżone ✅");renderuj();}catch(e){toast("Status InPost: "+(e.message||e));}
}
function inpostServiceStatusNazwa(status){
  const labels={created:"Przesyłka utworzona",confirmed:"Etykieta utworzona — paczka czeka na nadanie",dispatched_by_sender:"Przekazana przez nadawcę",collected_from_sender:"Odebrana od nadawcy",taken_by_courier:"Odebrana przez kuriera",adopted_at_source_branch:"Przyjęta w oddziale nadawczym",sent_from_source_branch:"Wysłana z oddziału nadawczego",adopted_at_sorting_center:"Przyjęta w sortowni",sent_from_sorting_center:"Wysłana z sortowni",adopted_at_target_branch:"Przyjęta w oddziale docelowym",out_for_delivery:"Wydana do doręczenia",ready_to_pickup:"Gotowa do odbioru",pickup_reminder_sent:"Wysłano przypomnienie o odbiorze",delivered:"Doręczona",avizo:"Nieudana próba doręczenia",undelivered:"Nie doręczono",missing:"Przesyłka poszukiwana",returned_to_sender:"Zwrócona do nadawcy",cancelled:"Przesyłka anulowana"};
  const key=String(status||"").trim().toLowerCase();return labels[key]||key.replaceAll("_"," ")||"Oczekuje na pierwszy status";
}
function inpostServiceDataPotwierdzenia(value){
  if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleString("pl-PL",{dateStyle:"medium",timeStyle:"short"});
}
function inpostServiceAdresPotwierdzenia(person={}){
  const a=person.address||{},name=person.companyName||`${person.firstName||""} ${person.lastName||""}`.trim()||"—";
  const street=[a.street,[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/")].filter(Boolean).join(" ");
  return `<b>${esc(name)}</b>${street?`<span>${esc(street)}</span>`:""}<span>${esc([a.postCode||a.post_code,a.city].filter(Boolean).join(" "))}</span>${person.email?`<span>${esc(person.email)}</span>`:""}${person.phone?`<span>${esc(person.phone)}</span>`:""}`;
}
function inpostServiceZleceniodawca(item={}){return item.principal||item.requester||item.customer||item.sender||{};}
function inpostServiceKluczZleceniodawcy(item={}){
  const person=inpostServiceZleceniodawca(item),a=person.address||{};
  return [person.taxCode,person.email,person.companyName,person.firstName,person.lastName,a.street,a.buildingNumber||a.building_number,a.postCode||a.post_code,a.city].map(value=>normalizujSzukanyTekst(String(value||""))).join("|");
}
function inpostServiceCenaKoncowa(item={}){
  const stored=item.pricing?.customerTotalGross;
  if(stored!==null&&stored!==undefined&&String(stored).trim()!==""&&Number.isFinite(Number(stored)))return Number(stored);
  const carrier=item.pricing?.totalGross,commission=item.billing?.commissionGross??item.pricing?.commissionGross;
  return carrier!==null&&carrier!==undefined&&String(carrier).trim()!==""&&Number.isFinite(Number(carrier))?Number(carrier)+(Number.isFinite(Number(commission))?Number(commission):0):NaN;
}
function inpostServiceNazwaPotwierdzenia(person={}){return person.companyName||`${person.firstName||""} ${person.lastName||""}`.trim()||"—";}
function inpostServiceAdresTekstPotwierdzenia(person={}){
  const a=person.address||{},street=[a.street,[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/")].filter(Boolean).join(" ");
  return [street,[a.postCode||a.post_code,a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")||"—";
}
function inpostServicePotwierdzenieHTML(input={},warning=""){
  const items=(Array.isArray(input)?input:[input]).filter(Boolean),first=items[0]||{},company=typeof daneFirmy==="function"?daneFirmy():{},multi=items.length>1;
  const principal=inpostServiceZleceniodawca(first),keys=new Set(items.map(inpostServiceKluczZleceniodawcy)),samePrincipal=keys.size<=1;
  if(!samePrincipal)throw new Error("Jedno potwierdzenie może obejmować tylko przesyłki tego samego zleceniodawcy.");
  const eventLabel=event=>String(event?.status||"").toLowerCase()==="confirmed"?inpostServiceStatusNazwa("confirmed"):(event?.label||inpostServiceStatusNazwa(event?.status));
  const latestAt=items.map(item=>item.trackingUpdatedAt||item.updatedAt||item.createdAt).filter(Boolean).sort().at(-1)||"";
  const prices=items.map(inpostServiceCenaKoncowa),finalTotal=prices.every(Number.isFinite)?prices.reduce((sum,value)=>sum+value,0):NaN;
  const billingLabels=[...new Set(items.map(item=>({none:"Bez faktury",single:"Faktura wystawiana od razu",monthly:"Rozliczenie na fakturze miesięcznej"}[item.billing?.mode]||"—")))];
  const documentNumber=multi?`ZBIORCZE-${items.length}-${first.reference||first.id||"NADANIE"}`:(first.reference||first.id||"—");
  const title=multi?"Potwierdzenie nadania przesyłek":"Potwierdzenie nadania przesyłki";
  const itemRows=items.map((item,index)=>{
    const parcel=item.parcel||{},size=parcel.template?String(parcel.template).toUpperCase():[parcel.length,parcel.width,parcel.height].filter(Boolean).join(" × "),service=item.deliveryType==="locker"?`Paczkomat / PaczkoPunkt${item.targetPoint?` • ${item.targetPoint}`:""}`:"Kurier InPost",status=eventLabel((item.trackingHistory||[])[0]||{status:item.inpostStatus||item.status});
    return `<tr><td>${index+1}</td><td><b>${esc(item.trackingNumber||"Oczekuje na numer")}</b><small>${esc(item.reference||item.id||"")}</small></td><td><b>${esc(inpostServiceNazwaPotwierdzenia(item.receiver))}</b><small>${esc(inpostServiceAdresTekstPotwierdzenia(item.receiver))}</small></td><td><b>${esc(service)}</b><small>${esc(size?`Gabaryt / wymiary: ${size}`:"Przesyłka")}${parcel.weight?` • ${esc(parcel.weight)} kg`:""}</small></td><td><b>${esc(status)}</b><small>${esc(inpostServiceDataPotwierdzenia(item.trackingUpdatedAt||item.updatedAt||item.createdAt))}</small></td></tr>`;
  }).join("");
  const history=items.flatMap(item=>{
    const events=Array.isArray(item.trackingHistory)&&item.trackingHistory.length?item.trackingHistory:[{status:item.inpostStatus||item.status||"created",occurredAt:item.trackingUpdatedAt||item.updatedAt||item.createdAt}];
    return events.slice(0,multi?1:8).map(event=>({...event,shipment:item.trackingNumber||item.reference||item.id}));
  });
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Potwierdzenie ${esc(documentNumber)}</title></head><body><main class="sheet">
    <header class="head"><div><div class="brand">${esc(company.nazwa||"Artway‑TM")}</div><h1>${title}</h1><small>Dokument potwierdzający przyjęcie i realizację usługi przewozu</small></div><div class="head-meta"><b>Nr dokumentu: ${esc(documentNumber)}</b><small>Data wystawienia: ${esc(inpostServiceDataPotwierdzenia(new Date().toISOString()))}</small></div></header>
    <section class="status"><b>${multi?`${items.length} przesyłek na jednym potwierdzeniu`:esc(eventLabel((first.trackingHistory||[])[0]||{status:first.inpostStatus||first.status}))}</b><span>Stan danych na: ${esc(inpostServiceDataPotwierdzenia(latestAt))}</span></section>
    ${warning?`<div class="warning"><b>Uwaga:</b> ${esc(warning)} Dokument pokazuje ostatnie dane zapisane w systemie.</div>`:""}
    <div class="content"><div class="meta"><div><small>Liczba przesyłek</small><b>${items.length}</b></div><div><small>Rozliczenie</small><b>${esc(billingLabels.join(" / "))}</b></div><div><small>Format dokumentu</small><b>A4 • czarno-biały</b></div></div>
      <div class="parties principal-only"><section class="party"><small>Zleceniodawca</small>${inpostServiceAdresPotwierdzenia(principal)}</section><section class="party issuer"><small>Wystawca dokumentu</small><b>${esc(company.nazwa||"Artway‑TM")}</b><span>${esc(pelnyAdresFirmy?.(company)||"")}</span></section></div>
      <h2 class="section-title">Przesyłki objęte potwierdzeniem</h2><table class="shipments"><thead><tr><th>Lp.</th><th>Numer przesyłki</th><th>Odbiorca</th><th>Usługa i paczka</th><th>Status</th></tr></thead><tbody>${itemRows}</tbody></table>
      <section class="final-price"><small>Cena końcowa usługi${multi?" — łącznie":""}</small><b>${esc(Number.isFinite(finalTotal)?zl(finalTotal):"—")}</b><span>Kwota należna od zleceniodawcy. Dokument nie ujawnia kosztów wewnętrznych ani sposobu kalkulacji ceny.</span></section>
      <h2 class="section-title">Aktualny przebieg transportu</h2><ol class="timeline">${history.map(event=>`<li><b>${esc(eventLabel(event))}</b><span>${esc(inpostServiceDataPotwierdzenia(event.occurredAt))}${event.location?` • ${esc(event.location)}`:""}</span><small>Przesyłka: ${esc(event.shipment)}${event.description?` • ${esc(event.description)}`:""}</small></li>`).join("")||"<li><b>Oczekuje na pierwsze zdarzenie przewoźnika</b></li>"}</ol>
      <div class="signatures"><div class="signature-box">Podpis osoby wystawiającej</div><div class="stamp-box">Pieczęć firmowa Artway-TM</div></div>
      <p class="formal-note">Dokument potwierdza utworzenie wskazanych przesyłek i zapisanie ich danych w systemie. Status „Etykieta utworzona — paczka czeka na nadanie” nie oznacza fizycznego przekazania paczki przewoźnikowi.</p>
    </div><footer class="foot"><span>${esc([company.nazwa,pelnyAdresFirmy?.(company)].filter(Boolean).join(" • "))}</span><span>Drukarka docelowa: Brother DCP‑T525W • A4</span><span>Dokument nie jest fakturą ani paragonem.</span></footer>
  </main><div class="actions"><div><b>Brother DCP‑T525W</b><small>A4 • pionowo • czarno-biały</small></div><button onclick="window.print()">Drukuj na Brother A4</button><button onclick="window.close()">Zamknij</button></div></body></html>`;
}
function inpostServiceCzekajNaOknoPotwierdzenia(popup,timeout=7000){
  return new Promise((resolve,reject)=>{const started=Date.now(),check=()=>{
    if(!popup||popup.closed)return reject(new Error("Okno potwierdzenia zostało zamknięte"));
    try{if(popup.location.pathname==="/assets/inpost-confirmation.html"&&popup.document.readyState==="complete")return resolve();}catch{}
    if(Date.now()-started>=timeout)return reject(new Error("Nie udało się przygotować okna potwierdzenia"));
    setTimeout(check,50);
  };check();});
}
async function inpostServicePrzygotujPotwierdzenie(ids=[]){
  const unique=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean))],popup=window.open("/assets/inpost-confirmation.html","_blank","width=1100,height=920");if(!popup)return toast("Przeglądarka zablokowała okno wydruku");
  let items=[],failures=0;
  for(const id of unique){const current=inpostServiceStan.items.find(row=>row.id===id);if(!current)continue;try{items.push(await inpostServicePobierzStatus(id));}catch{items.push(current);failures+=1;}}
  if(!items.length){popup.close();return toast("Nie znaleziono nadań do potwierdzenia");}
  const keys=new Set(items.map(inpostServiceKluczZleceniodawcy));if(keys.size>1){popup.close();return toast("Wybierz przesyłki tylko jednego zleceniodawcy");}
  try{
    await inpostServiceCzekajNaOknoPotwierdzenia(popup);
    const warning=failures?`Nie udało się odświeżyć statusu ${failures} ${failures===1?"przesyłki":"przesyłek"}.`:"",documentHtml=new DOMParser().parseFromString(inpostServicePotwierdzenieHTML(items,warning),"text/html");
    popup.document.title=documentHtml.title;popup.document.body.innerHTML=documentHtml.body.innerHTML;
  }catch(e){popup.close();return toast(e.message||String(e));}
  renderuj();
}
async function inpostServicePotwierdzenie(id){return inpostServicePrzygotujPotwierdzenie([id]);}
async function inpostServicePotwierdzenieZbiorcze(){
  const ids=[...inpostServicePotwierdzenieWybrane];if(!ids.length)return toast("Zaznacz co najmniej jedną przesyłkę");return inpostServicePrzygotujPotwierdzenie(ids);
}
function inpostServiceOdswiezWyborPotwierdzenia(){
  const count=inpostServicePotwierdzenieWybrane.size;document.querySelectorAll("[data-inpost-confirm-count]").forEach(el=>el.textContent=String(count));document.querySelectorAll("[data-inpost-confirm-selected]").forEach(el=>{el.disabled=count===0;});document.querySelectorAll("[data-inpost-confirm-clear]").forEach(el=>{el.disabled=count===0;});
}
function inpostServiceZaznaczPotwierdzenie(id,checked,input=null){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item)return;
  if(checked&&inpostServicePotwierdzenieWybrane.size){const firstId=[...inpostServicePotwierdzenieWybrane][0],first=inpostServiceStan.items.find(row=>row.id===firstId);if(first&&inpostServiceKluczZleceniodawcy(first)!==inpostServiceKluczZleceniodawcy(item)){if(input)input.checked=false;return toast("Do jednego potwierdzenia wybierz paczki tego samego zleceniodawcy");}}
  if(checked)inpostServicePotwierdzenieWybrane.add(id);else inpostServicePotwierdzenieWybrane.delete(id);inpostServiceOdswiezWyborPotwierdzenia();
}
function inpostServiceWyczyscWyborPotwierdzenia(){inpostServicePotwierdzenieWybrane.clear();document.querySelectorAll("[data-inpost-confirm-checkbox]").forEach(input=>{input.checked=false;});inpostServiceOdswiezWyborPotwierdzenia();}
async function inpostServiceEtykieta(id,format="A6"){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item?.inpostId)return toast("Przesyłka nie ma jeszcze ID InPost");
  try{const d=await chmura("inpost-label",{params:{id:item.inpostId,type:format},timeout:30000}),url=URL.createObjectURL(b64toBlob(d.base64,"application/pdf"));window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){toast("Etykieta: "+(e.message||e));}
}
async function inpostServiceOdbior(id){
  const item=inpostServiceStan.items.find(record=>record.id===id),sender=item?.sender||{},address=sender.address||{},senderName=sender.companyName||`${sender.firstName||""} ${sender.lastName||""}`.trim()||"nadawca",addressText=[address.street,[address.buildingNumber||address.building_number,address.flatNumber||address.flat_number].filter(Boolean).join("/"),address.postCode||address.post_code,address.city].filter(Boolean).join(" ");
  if(!confirm(`Zamówić kuriera InPost po paczkę od: ${senderName}, ${addressText}? InPost może naliczyć opłatę za odbiór. Paczka i koszt pozostaną w organizacji firmowej InPost.`))return;
  try{const d=await chmura("inpost-service-pickup",{method:"POST",body:{id},timeout:45000});if(d.item)inpostServiceStan.items=inpostServiceStan.items.map(item=>item.id===id?d.item:item);toast(d.duplicatePrevented?"Odbiór kuriera jest już zlecony":"Odbiór kuriera zlecony ✅");renderuj();}catch(e){toast("Odbiór kuriera: "+(e.message||e));}
}
async function inpostServiceAnuluj(id){
  if(!confirm("Anulować tę przesyłkę w InPost? Operacja jest możliwa tylko przed jej potwierdzeniem."))return;
  try{const d=await chmura("inpost-service-cancel",{method:"POST",body:{id},timeout:30000});if(d.item)inpostServiceStan.items=inpostServiceStan.items.map(item=>item.id===id?d.item:item);toast("Przesyłka anulowana w InPost");renderuj();}catch(e){toast("Nie anulowano: "+(e.message||e));}
}
async function inpostServiceFaktura(id){
  try{const d=await chmura("inpost-service-bill",{method:"POST",body:{id},timeout:60000});toast(d.invoice?.duplicatePrevented?"Dokument inFakt już istnieje":"Szkic FV przekazany do inFakt ✅");await inpostServiceLaduj(true,true);renderuj();}catch(e){toast("Faktura inFakt: "+(e.message||e));}
}
async function inpostServiceFakturaMiesieczna(month,clientKey){
  try{const d=await chmura("inpost-service-bill",{method:"POST",body:{month,clientKey},timeout:60000});toast(d.invoice?.duplicatePrevented?"Miesięczny dokument już istnieje":`Przekazano ${d.count||0} nadań do jednej FV inFakt ✅`);await inpostServiceLaduj(true,true);renderuj();}catch(e){toast("Faktura miesięczna: "+(e.message||e));}
}
function inpostServiceOtworzMape(purpose="target"){
  window.__inpostPointPurpose=purpose==="dropoff"?"dropoff":"target";window.__geoTarget="inpost-service";otworzGeowidget();
}
async function inpostServiceSzukajPunktow(){
  const query=String(document.getElementById("inpostServicePointSearch")?.value||"").trim(),box=document.getElementById("inpostServicePointResults");
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  if(box)box.innerHTML="<small>Szukam punktów InPost…</small>";
  try{const params={limit:10,...(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query})},d=await chmura("inpost-points",{params,timeout:15000});if(box)box.innerHTML=(d.points||[]).map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))})"><b>${esc(point.name)}</b><span>${esc(opisPunktuInpost(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów.</small>";}catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
function inpostServiceWybierzPunkt(code,address="",purpose=window.__inpostPointPurpose||"target"){
  const dropoff=purpose==="dropoff",input=document.getElementById(dropoff?"inpostServiceDropoffPoint":"inpostServiceTargetPoint"),label=document.getElementById(dropoff?"inpostServiceDropoffPointLabel":"inpostServiceTargetPointLabel");
  if(input){input.value=String(code||"").toUpperCase();input.dispatchEvent(new Event("input",{bubbles:true}));}
  if(label)label.textContent=address||code;window.__inpostPointPurpose="";toast(`${dropoff?"Automat nadawczy":"Punkt odbioru"}: ${code}`);
}
function inpostServiceLista(){
  const q=normalizujSzukanyTekst(inpostServiceSzukaj),terms=q.split(" ").filter(Boolean);
  return (inpostServiceStan.items||[]).filter(item=>{
    const text=normalizujSzukanyTekst([item.id,item.reference,item.trackingNumber,item.inpostStatus,item.receiver?.companyName,item.receiver?.firstName,item.receiver?.lastName,item.receiver?.email,item.receiver?.taxCode,item.targetPoint].join(" "));
    if(terms.some(term=>!text.includes(term)))return false;
    if(inpostServiceFiltr!=="wszystkie"&&String(item.status)!==inpostServiceFiltr)return false;
    if(inpostServiceBillingFiltr==="oczekuje"&&item.billing?.status!=="pending")return false;
    if(inpostServiceBillingFiltr==="rozliczone"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status)))return false;
    if(inpostServiceBillingFiltr==="bez"&&item.billing?.mode!=="none")return false;
    return true;
  });
}
function inpostServiceStatusLabel(item){
  if(item.status==="cancelled")return '<span class="lvl lvl-blad">anulowana</span>';
  if(item.status==="error")return '<span class="lvl lvl-blad">błąd</span>';
  if(item.labelReady)return '<span class="lvl lvl-ok">etykieta gotowa</span>';
  return `<span class="lvl lvl-info">${esc(item.inpostStatus||item.status||"utworzona")}</span>`;
}
function inpostServiceBillingLabel(item){
  const link=item.billing?.link,status=link?.status||item.billing?.status;
  if(item.billing?.mode==="none")return '<span class="lvl">bez faktury</span>';
  if(status==="created")return `<span class="lvl lvl-ok">FV ${esc(link?.invoiceNumber||"wystawiona")}</span>`;
  if(status==="processing")return '<span class="lvl lvl-info">inFakt przetwarza</span>';
  if(status==="pending")return '<span class="lvl lvl-ostrzezenie">do FV miesięcznej</span>';
  if(status==="error")return '<span class="lvl lvl-blad">błąd inFakt</span>';
  return '<span class="lvl lvl-ostrzezenie">do rozliczenia</span>';
}
function inpostServiceHistoriaHTML(){
  const rows=inpostServiceLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(inpostServiceSzukaj)}" placeholder="Numer nadania, klient, NIP, e-mail, punkt lub referencja…" oninput="inpostServiceSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="inpostServiceFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie statusy</option>${[["label_ready","Etykieta gotowa"],["created","Utworzone"],["error","Błędy"],["cancelled","Anulowane"]].map(([v,l])=>`<option value="${v}" ${inpostServiceFiltr===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Rozliczenie<select onchange="inpostServiceBillingFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie rozliczenia</option><option value="oczekuje" ${inpostServiceBillingFiltr==="oczekuje"?"selected":""}>Do FV miesięcznej</option><option value="rozliczone" ${inpostServiceBillingFiltr==="rozliczone"?"selected":""}>Przekazane do inFakt</option><option value="bez" ${inpostServiceBillingFiltr==="bez"?"selected":""}>Bez faktury</option></select></label><button class="btn ghost" onclick="inpostServiceSzukaj='';inpostServiceFiltr='wszystkie';inpostServiceBillingFiltr='wszystkie';renderuj()">Wyczyść</button>`;
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr operacyjny</span><h2>Nadania i rozliczenia</h2><p class="order-detail-lead">Tracking, etykieta, zlecenie odbioru i faktura tworzą jeden ślad operacyjny. Koszt umowny przewoźnika nie jest wyświetlany.</p></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Filtry działają po danych nadania i rozliczenia klienta.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table"><thead><tr><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Status</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(item=>`<tr data-stable-key="${esc(item.id)}"><td><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td><td><b>${esc(item.receiver?.companyName||`${item.receiver?.firstName||""} ${item.receiver?.lastName||""}`.trim()||"Klient")}</b><br><small>${esc(item.receiver?.email||"")}${item.receiver?.taxCode?` • NIP ${esc(item.receiver.taxCode)}`:""}</small></td><td>${item.deliveryType==="locker"?"📮 Paczkomat / punkt":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Paczka w Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td><td>${inpostServiceStatusLabel(item)}<br><small>${esc(item.inpostStatus||"")}</small>${item.pickup?.id?`<br><span class="lvl lvl-ok">odbiór kuriera ${esc(item.pickup.status||"")}</span>`:""}</td><td>${inpostServiceBillingLabel(item)}<br><small>prowizja ${zl(item.billing?.commissionGross||0)}</small>${item.billing?.error?`<br><small class="error">${esc(item.billing.error)}</small>`:""}</td><td><div class="inpost-row-actions"><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.labelReady&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">🚚 Zamów kuriera</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="6">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function inpostServiceMiesieczneHTML(){
  const groups=inpostServiceStan.billing?.groups||[];if(!groups.length)return "";
  return `<section class="panel inpost-monthly-billing"><div class="order-section-head"><div><span class="order-pro-label">Stałe firmy</span><h2>FV miesięczne do przygotowania</h2><p class="order-detail-lead">Jedna faktura grupuje prowizję za wszystkie nierozliczone nadania firmy w danym miesiącu.</p></div><a class="btn ghost" href="#/admin/infakt/wysylki">Otwórz w inFakt</a></div><div class="inpost-monthly-grid">${groups.map(group=>`<article><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small></div><strong>${zl(group.commissionGross)}</strong><button class="btn" onclick="inpostServiceFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz jedną FV</button></article>`).join("")}</div></section>`;
}
function inpostServiceOsobaFields(prefix,title,person={},withNip=false){
  const a=person.address||{};
  return `<fieldset class="inpost-party-card"><legend>${esc(title)}</legend><div class="inpost-form-grid"><label>Firma${withNip?" / stały klient":""}<input name="${prefix}Company" value="${esc(person.companyName||"")}"></label>${withNip?`<label>NIP<input name="${prefix}TaxCode" inputmode="numeric" maxlength="10" value="${esc(person.taxCode||"")}"></label>`:""}<label>Imię<input name="${prefix}FirstName" value="${esc(person.firstName||"")}"></label><label>Nazwisko<input name="${prefix}LastName" value="${esc(person.lastName||"")}"></label><label>E-mail *<input name="${prefix}Email" type="email" required value="${esc(person.email||"")}"></label><label>Telefon *<input name="${prefix}Phone" inputmode="tel" required value="${esc(person.phone||"")}"></label><label class="wide">Ulica *<input name="${prefix}Street" required value="${esc(a.street||"")}"></label><label>Nr budynku *<input name="${prefix}Building" required value="${esc(a.buildingNumber||a.building_number||"")}"></label><label>Nr lokalu<input name="${prefix}Flat" value="${esc(a.flatNumber||a.flat_number||"")}"></label><label>Kod pocztowy *<input name="${prefix}PostCode" required pattern="\\d{2}-?\\d{3}" value="${esc(a.postCode||a.post_code||"")}"></label><label>Miasto *<input name="${prefix}City" required value="${esc(a.city||"")}"></label></div></fieldset>`;
}
function inpostServiceFormHTML(){
  const sender=inpostServiceNadawca(),clients=inpostServiceKlienci(),fee=Number(inpostServiceStan.settings?.commissionGross??4),month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability;
  return `<section class="panel inpost-service-create"><div class="order-section-head"><div><span class="order-pro-label">Umowa InPost • ShipX</span><h2>Utwórz przesyłkę</h2><p class="order-detail-lead">Wpisz nadawcę i odbiorcę, wybierz usługę oraz opcje dodatkowe. System zapisze numer, etykietę, tracking i rozliczenie prowizji.</p></div><div class="diag-actions"><span class="lvl ${available?.locker?"lvl-ok":"lvl-ostrzezenie"}">Paczkomat ${available?.locker?"aktywny":"do sprawdzenia"}</span><span class="lvl ${available?.courier?"lvl-ok":"lvl-ostrzezenie"}">Kurier ${available?.courier?"aktywny":"do sprawdzenia"}</span></div></div><form id="inpostServiceForm" onsubmit="inpostServiceUtworz(event)"><input type="hidden" name="requestId" value="${esc(inpostServiceStan.requestId||inpostServiceNowyRequestId())}"><div class="inpost-form-top"><label>Referencja / numer klienta<input name="reference" required value="USL-${Date.now().toString(36).toUpperCase()}"></label><label>Stały klient / firma<input list="inpostServiceClients" placeholder="Wpisz e-mail lub NIP i wybierz" onchange="inpostServiceWypelnijKlienta(this)"><datalist id="inpostServiceClients">${clients.map(client=>`<option value="${esc(client.key)}">${esc(client.companyName||`${client.firstName} ${client.lastName}`.trim()||client.email)} • ${esc(client.email||client.taxCode)}</option>`).join("")}</datalist></label></div><div class="inpost-parties-grid">${inpostServiceOsobaFields("sender","Nadawca",sender,false)}${inpostServiceOsobaFields("receiver","Odbiorca",{},true)}</div><div class="inpost-options-layout"><fieldset><legend>Usługa i nadanie</legend><div class="inpost-form-grid"><label>Rodzaj dostawy<select name="deliveryType" onchange="inpostServiceUstawTyp(this.form)"><option value="locker">Paczkomat / PaczkoPunkt InPost</option><option value="courier">Kurier InPost</option></select></label><label>Sposób nadania<select name="sendingMethod" onchange="inpostServiceUstawTyp(this.form)"><option value="parcel_locker">Nadanie w Paczkomacie</option><option value="any_point">Dowolny punkt InPost</option><option value="pok">Punkt Obsługi Klienta</option><option value="pop">Punkt Obsługi Przesyłek</option><option value="branch">Oddział InPost</option><option value="dispatch_order">Odbiór przez kuriera</option></select></label><div class="wide" data-inpost-only="locker"><label>Paczkomat / punkt odbiorcy *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" placeholder="np. BOJ01N"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape()">Mapa</button></div><small id="inpostServiceTargetPointLabel">Wybierz punkt na mapie, z wyszukiwarki albo wpisz kod.</small></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod pocztowy lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow()">Szukaj</button></div><div id="inpostServicePointResults"></div></div><label>Punkt nadania (opcjonalnie)<input name="dropoffPoint" placeholder="kod punktu, jeśli wybrano konkretny"></label><label class="check" data-inpost-only="courier"><input type="checkbox" name="pickupRequested"> Zleć odbiór przez kuriera po potwierdzeniu</label></div></fieldset><fieldset><legend>Paczka i usługi dodatkowe</legend><div class="inpost-form-grid"><label>Gabaryt<select name="template"><option value="small">A / small</option><option value="medium">B / medium</option><option value="large">C / large</option><option value="">Wymiary własne</option></select></label><label>Waga (kg)<input name="weight" type="number" min=".01" max="50" step=".01" value="1"></label><label>Długość (cm)<input name="length" type="number" min="1" step=".1" value="30"></label><label>Szerokość (cm)<input name="width" type="number" min="1" step=".1" value="20"></label><label>Wysokość (cm)<input name="height" type="number" min="1" step=".1" value="15"></label><label class="check"><input type="checkbox" name="nonStandard"> Element niestandardowy</label><label class="check wide"><input type="checkbox" name="codEnabled"> Pobranie <input name="codAmount" type="number" min="0" step=".01" placeholder="kwota PLN"></label><label class="check wide"><input type="checkbox" name="insuranceEnabled"> Dodatkowa ochrona <input name="insuranceAmount" type="number" min="0" step=".01" placeholder="wartość PLN"></label><label class="check" data-inpost-only="locker"><input type="checkbox" name="weekend"> Paczka w Weekend</label><label class="check" data-inpost-only="locker"><input type="checkbox" name="additionalServices" value="labelless"> Nadanie bez etykiety</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="sms"> Powiadomienie SMS</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="email"> Powiadomienie e-mail</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="saturday"> Doręczenie w sobotę</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="dor1720"> Doręczenie 17:00–20:00</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label><label class="wide">Uwagi do przesyłki<input name="comments" maxlength="100"></label></div></fieldset><fieldset class="inpost-billing-card"><legend>Rozliczenie klienta</legend><div class="inpost-form-grid"><label>Sposób rozliczenia<select name="billingMode"><option value="none">Bez faktury</option><option value="single">FV od razu po nadaniu</option><option value="monthly">Dopisz do FV miesięcznej</option></select></label><label>Miesiąc rozliczenia<input name="billingMonth" type="month" value="${esc(month)}"></label><label>Prowizja za nadanie<input name="commissionGross" type="number" min="0" step=".01" value="${esc(fee)}" oninput="inpostServicePrzelicz(this.form)"></label><div class="inpost-fee-summary"><small>Do rozliczenia za tę usługę</small><strong data-inpost-commission-total>${zl(fee)}</strong></div></div><div class="backend-note"><b>Koszt umowny InPost jest ukryty.</b> Panel i odpowiedź API pokazują wyłącznie prowizję Artway-TM. Dla FV miesięcznej każda przesyłka trafia do jednej paczki rozliczeniowej klienta.</div></fieldset></div><div class="inpost-create-footer"><button class="btn" type="submit">🟡 Utwórz przesyłkę InPost</button><small>Jedno kliknięcie rezerwuje operację — ponowne kliknięcie nie utworzy duplikatu.</small></div></form></section>`;
}
function panelWysylkiUslugowejInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram konfigurację InPost i rejestr nadań…</div></div>';
  setTimeout(()=>inpostServiceUstawTyp(document.getElementById("inpostServiceForm")),0);
  const billing=inpostServiceStan.billing||{};
  return `<div class="inpost-service-workspace"><section class="inpost-service-stats"><article><span>📦</span><b>${inpostServiceStan.items.length}</b><small>nadań usługowych</small></article><article><span>🧾</span><b>${billing.pendingMonthly||0}</b><small>do FV miesięcznej</small></article><article><span>💰</span><b>${zl(billing.commissionPendingGross||0)}</b><small>prowizji oczekującej</small></article><article><span>🔐</span><b>ukryty</b><small>koszt umowny InPost</small></article></section>${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceFormHTML()}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}<details class="panel inpost-service-settings"><summary>⚙️ Domyślny nadawca i prowizja</summary><form onsubmit="inpostServiceZapiszUstawienia(event)">${inpostServiceOsobaFields("sender","Stałe dane nadawcy",inpostServiceNadawca(),false)}<div class="inpost-settings-footer"><label>Domyślna prowizja brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(inpostServiceStan.settings?.commissionGross??4)}"></label><button class="btn" type="submit">Zapisz ustawienia</button><a class="btn ghost" href="#/admin/infakt/wysylki">Rozliczenia inFakt</a></div></form></details></div>`;
}
