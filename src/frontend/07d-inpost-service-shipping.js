let inpostServiceStan={loaded:false,loading:false,saving:false,error:"",items:[],addressBook:[],settings:{commissionGross:4,commissionTiers:[{upToGross:20,commissionGross:4},{upToGross:30,commissionGross:6},{upToGross:40,commissionGross:8},{upToGross:50,commissionGross:10}],defaultDeliveryType:"locker",defaultSendingMethod:"parcel_locker",defaultDropoffPoint:"",defaultParcelTemplate:"small",defaultParcelWeight:1,defaultBillingMode:"none",defaultWeekend:false,labelDefaultFormat:"A6",labelOpenMode:"preview",labelAutoPrint:false,sender:{}},billing:{groups:[]},serviceAvailability:null,requestId:"",pricing:null};
let inpostServiceSzukaj="",inpostServiceFiltr="wszystkie",inpostServiceBillingFiltr="wszystkie";

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
  const shipmentClients=(inpostServiceStan.items||[]).map(item=>item.customer||item.sender).filter(Boolean);
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
  if(["/admin/wysylki/inpost","/admin/wysylki/inpost-rejestr","/admin/wysylki/inpost-ustawienia","/admin/wysylki/odbior-kuriera"].includes(trasa()))renderuj();
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
function inpostServiceMetodyNadaniaOpcjeHTML(type="locker",selected=""){
  return (inpostServiceMetodyNadania[type]||inpostServiceMetodyNadania.locker).map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(selected)?"selected":""}>${esc(label)}</option>`).join("");
}
function inpostServiceZastosujZgodnoscTypu(form){
  const type=String(form?.deliveryType?.value||"locker");
  form?.querySelectorAll("[data-inpost-only]").forEach(el=>el.hidden=!String(el.dataset.inpostOnly||"").split(",").includes(type));
  const allowed=inpostServiceMetodyNadania[type]||[],allowedValues=new Set(allowed.map(([value])=>value)),methodInputs=[...(form?.querySelectorAll?.('[name="sendingMethod"]')||[])];
  methodInputs.forEach(input=>{const enabled=allowedValues.has(input.value);input.disabled=!enabled;if(input.closest("[data-inpost-method-card]"))input.closest("[data-inpost-method-card]").hidden=!enabled;});
  let method=String(form?.elements?.sendingMethod?.value||"");
  if(!allowedValues.has(method)){const fallback=methodInputs.find(input=>input.value==="dispatch_order"&&!input.disabled)||methodInputs.find(input=>!input.disabled);if(fallback)fallback.checked=true;method=String(fallback?.value||"");}
  const requiresPoint=inpostServiceMetodyWymagajacePunktu.has(method),dropoff=form?.elements?.dropoffPoint;
  if(dropoff){
    dropoff.required=requiresPoint;
    dropoff.setAttribute("aria-required",requiresPoint?"true":"false");
    if(!requiresPoint)dropoff.value="";
    else if(!String(dropoff.value||"").trim())dropoff.value=String(inpostServiceStan.settings?.defaultDropoffPoint||"").toUpperCase();
    dropoff.placeholder=requiresPoint?"Wybierz automat nadawczy":"";
  }
  const dropoffPanel=form?.querySelector("[data-inpost-dropoff-panel]");if(dropoffPanel)dropoffPanel.hidden=!requiresPoint;
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
  const fields={senderCompany:client.companyName,senderTaxCode:client.taxCode,senderFirstName:client.firstName,senderLastName:client.lastName,senderEmail:client.email,senderPhone:client.phone,senderStreet:client.address?.street,senderBuilding:client.address?.buildingNumber,senderFlat:client.address?.flatNumber,senderPostCode:client.address?.postCode,senderCity:client.address?.city};
  Object.entries(fields).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value||"";});
  toast("Dane stałego klienta uzupełnione ✅");
}
function inpostServiceStronaOsoby(form,prefix){
  return {companyName:form.elements[`${prefix}Company`]?.value||"",taxCode:form.elements[`${prefix}TaxCode`]?.value||"",firstName:form.elements[`${prefix}FirstName`]?.value||"",lastName:form.elements[`${prefix}LastName`]?.value||"",email:form.elements[`${prefix}Email`]?.value||"",phone:form.elements[`${prefix}Phone`]?.value||"",address:{street:form.elements[`${prefix}Street`]?.value||"",buildingNumber:form.elements[`${prefix}Building`]?.value||"",flatNumber:form.elements[`${prefix}Flat`]?.value||"",postCode:form.elements[`${prefix}PostCode`]?.value||"",city:form.elements[`${prefix}City`]?.value||""}};
}
function inpostServiceReferencja(form){
  const field=form?.elements?.reference;if(!field)return "";
  const customer=inpostServiceStronaOsoby(form,"sender"),a=customer.address||{},number=[a.buildingNumber,a.flatNumber].filter(Boolean).join("/"),street=[a.street,number].filter(Boolean).join(" "),address=[street,a.postCode,a.city].filter(Boolean).join(", ");
  const id=String(inpostServiceStan.requestId||inpostServiceNowyRequestId()).replace(/[^a-z0-9]/gi,"").slice(-10).toUpperCase()||Date.now().toString(36).toUpperCase();
  const base=`USL-${id}`,person=[customer.firstName,customer.lastName].filter(Boolean).join(" ").trim(),sender=String(customer.companyName||person||"").trim(),comments=form?.elements?.comments,prefix="Nadawca: ";
  field.value=base.slice(0,30);
  if(comments){
    const senderLimit=Math.max(0,100-prefix.length-address.length-(sender?2:0)),senderLabel=sender.slice(0,senderLimit);
    comments.value=address?`${prefix}${senderLabel?senderLabel+", ":""}${address}`.slice(0,100):sender?`${prefix}${sender}`.slice(0,100):"";
  }
  return field.value;
}
function inpostServicePayload(form){
  inpostServiceReferencja(form);
  const data=new FormData(form),additionalServices=[...form.querySelectorAll('[name="additionalServices"]:checked')].map(input=>input.value);
  const codAmount=Math.max(0,Number(String(data.get("codAmount")||"0").replace(",","."))||0),insuranceAmount=Math.max(0,Number(String(data.get("insuranceAmount")||"0").replace(",","."))||0),sendingMethod=String(data.get("sendingMethod")||"");
  return {requestId:inpostServiceStan.requestId||inpostServiceNowyRequestId(),reference:String(data.get("reference")||"").trim(),comments:String(data.get("comments")||"").trim(),customer:inpostServiceStronaOsoby(form,"sender"),receiver:inpostServiceStronaOsoby(form,"receiver"),saveCustomer:data.get("saveSender")==="on",saveReceiver:data.get("saveReceiver")==="on",deliveryType:data.get("deliveryType"),sendingMethod,targetPoint:data.get("targetPoint"),dropoffPoint:data.get("dropoffPoint"),parcel:{template:data.get("template"),length:data.get("length"),width:data.get("width"),height:data.get("height"),weight:data.get("weight"),nonStandard:data.get("nonStandard")==="on"},cod:{enabled:codAmount>0||data.get("codEnabled")==="on",amount:codAmount},insurance:{enabled:insuranceAmount>0||data.get("insuranceEnabled")==="on",amount:insuranceAmount},weekend:["on","true","1"].includes(String(data.get("weekend")||"")),additionalServices,pickupRequested:data.get("pickupRequested")==="on",billingMode:data.get("billingMode"),billingMonth:data.get("billingMonth"),commissionGross:data.get("commissionGross"),carrierCostOverride:data.get("carrierCostOverride")};
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
  const map={"customer.firstName":"senderFirstName","customer.email":"senderEmail","customer.phone":"senderPhone","customer.address.street":"senderStreet","customer.address.buildingNumber":"senderBuilding","customer.address.postCode":"senderPostCode","customer.address.city":"senderCity","sender.firstName":"senderFirstName","sender.email":"senderEmail","sender.phone":"senderPhone","sender.address.street":"senderStreet","sender.address.buildingNumber":"senderBuilding","sender.address.postCode":"senderPostCode","sender.address.city":"senderCity","receiver.firstName":"receiverFirstName","receiver.email":"receiverEmail","receiver.phone":"receiverPhone","receiver.address.street":"receiverStreet","receiver.address.buildingNumber":"receiverBuilding","receiver.address.postCode":"receiverPostCode","receiver.address.city":"receiverCity","targetPoint":"targetPoint","dropoffPoint":"dropoffPoint","custom_attributes.target_point":"targetPoint","custom_attributes.dropoff_point":"dropoffPoint","custom_attributes.sending_method":"sendingMethod","cod.amount":"codAmount","insurance.amount":"insuranceAmount","parcel.weight":"weight","commissionGross":"commissionGross"};
  return map[path]||path.split(".").at(-1)||"";
}
function inpostServiceWyczyscBledyFormularza(form){
  form?.querySelectorAll(".inpost-field-error").forEach(element=>element.classList.remove("inpost-field-error"));
  const box=form?.querySelector("[data-inpost-form-errors]");if(box){box.hidden=true;box.innerHTML="";}
}
function inpostServiceBladPol(fields=[],form=document.getElementById("inpostServiceForm"),notify=true){
  const details=inpostServiceSzczegolyBledu(fields);
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
  const form=event.currentTarget;if(!confirm("To utworzy prawdziwą przesyłkę w InPost. Jeśli chcesz tylko sprawdzić dane, użyj przycisku „Test bez tworzenia”. Utworzyć przesyłkę?"))return;
  const payload=inpostServicePayload(form),button=form.querySelector('[type="submit"]');
  inpostServiceWyczyscBledyFormularza(form);
  inpostServiceStan={...inpostServiceStan,saving:true};if(button){button.disabled=true;button.textContent="⏳ Tworzę przesyłkę…";}
  try{
    const d=await chmura("inpost-service-create",{method:"POST",body:payload,timeout:90000});
    if(d.item)inpostServiceStan.items=[d.item,...inpostServiceStan.items.filter(item=>item.id!==d.item.id)];
    inpostServiceNowyRequestId();await inpostServiceLaduj(true,true);
    toast(d.invoice?.error?`Przesyłka utworzona ✅ Faktura wymaga uwagi: ${d.invoice.error}`:`Przesyłka InPost utworzona ✅ ${d.item?.trackingNumber||"oczekuje na numer"}`);
    renderuj();
  }catch(e){if(e.code==="previous_attempt_failed"){inpostServiceNowyRequestId();if(form.elements.requestId)form.elements.requestId.value=inpostServiceStan.requestId;}inpostServiceBladPol(e.details,form,false);toast("Nie utworzono przesyłki: "+(e.message||e));}
  finally{inpostServiceStan={...inpostServiceStan,saving:false};if(button){button.disabled=false;button.textContent="🔴 Utwórz prawdziwą przesyłkę";}}
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
  const labels={created:"Przesyłka utworzona",confirmed:"Przesyłka potwierdzona",dispatched_by_sender:"Przekazana przez nadawcę",collected_from_sender:"Odebrana od nadawcy",taken_by_courier:"Odebrana przez kuriera",adopted_at_source_branch:"Przyjęta w oddziale nadawczym",sent_from_source_branch:"Wysłana z oddziału nadawczego",adopted_at_sorting_center:"Przyjęta w sortowni",sent_from_sorting_center:"Wysłana z sortowni",adopted_at_target_branch:"Przyjęta w oddziale docelowym",out_for_delivery:"Wydana do doręczenia",ready_to_pickup:"Gotowa do odbioru",pickup_reminder_sent:"Wysłano przypomnienie o odbiorze",delivered:"Doręczona",avizo:"Nieudana próba doręczenia",undelivered:"Nie doręczono",missing:"Przesyłka poszukiwana",returned_to_sender:"Zwrócona do nadawcy",cancelled:"Przesyłka anulowana"};
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
function inpostServiceMaDaneOsoby(person={}){
  const a=person.address||{};return !!(person.companyName||person.firstName||person.lastName||person.email||person.phone||person.taxCode||a.street||a.city||a.postCode||a.post_code);
}
function inpostServiceAdresTekstPotwierdzenia(person={}){
  const a=person.address||{},number=[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/"),street=[a.street,number].filter(Boolean).join(" ");
  return [street,a.postCode||a.post_code,a.city].filter(Boolean).join(", ");
}
function inpostServicePotwierdzenieHTMLLegacy(item={},warning=""){
  const company=typeof daneFirmy==="function"?daneFirmy():{},config=typeof KONFIG!=="undefined"?KONFIG:{},sender=item.sender||inpostServiceNadawca(),events=Array.isArray(item.trackingHistory)?item.trackingHistory:[],currentStatus=item.inpostStatus||item.status;
  const currentEvent=events[0],updated=item.trackingUpdatedAt||currentEvent?.occurredAt||item.updatedAt||item.createdAt;
  const trackingUrl=item.trackingNumber?`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(item.trackingNumber)}`:"";
  const service=item.deliveryType==="locker"?"InPost Paczkomat® / PaczkoPunkt":"InPost Kurier";
  const methodLabels={parcel_locker:"Nadanie w automacie Paczkomat®",dispatch_order:"Odbiór przez kuriera InPost",pop:"Nadanie w PaczkoPunkcie",any_point:"Nadanie w dowolnym punkcie InPost",pok:"Punkt Obsługi Klienta InPost",courier_pok:"Punkt Obsługi Klienta InPost",branch:"Oddział InPost"},sendingMethod=methodLabels[item.sendingMethod]||"Nadanie w sieci InPost";
  const senderAddress=inpostServiceAdresTekstPotwierdzenia(sender);
  const origin=item.sendingMethod==="dispatch_order"?(senderAddress||"Adres Artway‑TM"):item.dropoffPoint||"Punkt InPost wybrany przy nadaniu";
  const destination=item.deliveryType==="locker"?(item.targetPoint||"Punkt odbioru InPost"):(inpostServiceAdresTekstPotwierdzenia(item.receiver)||"Adres odbiorcy");
  const parcel=item.parcel||{},size=parcel.template?String(parcel.template).toUpperCase():[parcel.length,parcel.width,parcel.height].filter(Boolean).join(" × ");
  const billing={none:"Bez faktury",single:"Faktura wystawiana od razu",monthly:"Rozliczenie na fakturze miesięcznej"}[item.billing?.mode]||"—";
  const timeline=events.length?events:(currentStatus||item.createdAt?[{status:currentStatus||"created",label:inpostServiceStatusNazwa(currentStatus||"created"),occurredAt:updated}]:[]);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Potwierdzenie ${esc(item.reference||item.id||"nadania")}</title><style>
  :root{font-family:Inter,Arial,sans-serif;color:#172033;background:#edf2f7}*{box-sizing:border-box}body{margin:0;padding:26px}.sheet{max-width:900px;margin:auto;background:#fff;border:1px solid #d9e2ec;border-radius:20px;box-shadow:0 18px 55px #17203318;overflow:hidden}.head{display:grid;grid-template-columns:1fr 1.2fr;gap:30px;padding:30px 34px;background:linear-gradient(135deg,#172554,#1d4ed8);color:#fff}.brand{font-size:22px;font-weight:900}.head h1{margin:7px 0;font-size:25px}.head small,.company-data span{display:block;color:#dbeafe}.company-data{border-left:1px solid #ffffff55;padding-left:24px;font-size:12px;line-height:1.55}.company-data b{display:block;margin-bottom:3px;font-size:13px}.tracking{padding:24px 34px;background:#eff6ff;border-bottom:1px solid #bfdbfe}.tracking-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:16px}.tracking small,.meta small,.party small,.parcel small,.route small{display:block;margin-bottom:6px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.tracking strong{display:block;color:#1e3a8a;font-size:20px;white-space:nowrap}.tracking b{font-size:14px}.status-line{display:flex;align-items:center;gap:9px;margin-top:14px;color:#166534;font-weight:800}.status-dot{width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px #dcfce7}.content{padding:26px 34px}.route-grid{display:grid;grid-template-columns:1fr 54px 1fr;align-items:stretch;margin-bottom:18px}.route{padding:17px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc}.route b,.route span{display:block}.route b{font-size:16px}.route span{margin-top:5px;color:#475569;font-size:13px}.route-arrow{display:grid;place-items:center;color:#2563eb;font-size:27px;font-weight:900}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.meta div,.party,.parcel{padding:14px;border:1px solid #e2e8f0;border-radius:13px}.parties{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.party{display:grid;gap:3px}.party span{font-size:13px;color:#475569}.parcel{margin-top:12px}.parcel span{display:inline-block;margin:7px 12px 0 0;color:#475569;font-size:13px}.timeline{margin:18px 0 0;padding:0;list-style:none}.timeline li{position:relative;margin-left:12px;padding:0 0 18px 27px;border-left:2px solid #cbd5e1}.timeline li:last-child{padding-bottom:0}.timeline li:before{content:"";position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 4px #dbeafe}.timeline li:first-child:before{background:#16a34a;box-shadow:0 0 0 4px #dcfce7}.timeline b{display:block}.timeline span,.timeline small{display:block;margin-top:3px;color:#64748b}.track-link{display:inline-block;margin:16px 0 4px;color:#1d4ed8;font-weight:800}.warning{margin:0 34px 20px;padding:12px 14px;border:1px solid #f59e0b;border-radius:12px;background:#fffbeb;color:#92400e}.foot{display:grid;grid-template-columns:1fr auto;gap:20px;padding:20px 34px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}.foot b,.foot span{display:block}.foot b{color:#334155;margin-bottom:3px}.actions{display:flex;justify-content:center;gap:10px;padding:20px}.actions button{padding:11px 18px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.actions button:last-child{background:#e2e8f0;color:#172033}@media(max-width:650px){body{padding:0}.sheet{border:0;border-radius:0}.head,.tracking,.content,.foot{padding-left:18px;padding-right:18px}.head,.tracking-grid,.meta,.parties,.foot{grid-template-columns:1fr}.company-data{border:0;border-top:1px solid #ffffff55;padding:14px 0 0}.tracking strong{white-space:normal;overflow-wrap:anywhere}.route-grid{grid-template-columns:1fr}.route-arrow{transform:rotate(90deg);height:40px}}@page{size:A4;margin:12mm}@media print{body{padding:0;background:#fff}.sheet{max-width:none;border:0;border-radius:0;box-shadow:none}.actions{display:none}.head,.tracking{-webkit-print-color-adjust:exact;print-color-adjust:exact}.timeline li,.route,.party{break-inside:avoid}.warning{margin-left:34px;margin-right:34px}}</style></head><body><main class="sheet">
    <header class="head"><div><div class="brand">ARTWAY‑TM</div><h1>Potwierdzenie przesyłki InPost</h1><small>Profesjonalne potwierdzenie dla klienta</small></div><div class="company-data"><b>Dane Artway‑TM</b><span>${esc(company.nazwa||sender.companyName||"Artway‑TM")}</span><span>${esc([company.adres,company.kodPocztowy,company.miasto].filter(Boolean).join(", ")||senderAddress)}</span>${company.nip||sender.taxCode?`<span>NIP: ${esc(company.nip||sender.taxCode)}</span>`:""}${config.emailSklepu||sender.email?`<span>${esc(config.emailSklepu||sender.email)}</span>`:""}${config.telefon||sender.phone?`<span>tel. ${esc(config.telefon||sender.phone)}</span>`:""}</div></header>
    <section class="tracking"><div class="tracking-grid"><div><small>Numer przesyłki</small><strong>${esc(item.trackingNumber||"Numer oczekuje na przydzielenie")}</strong></div><div><small>Numer referencyjny</small><b>${esc(item.reference||item.id||"—")}</b></div><div><small>Data nadania</small><b>${esc(inpostServiceDataPotwierdzenia(item.createdAt))}</b></div></div><div class="status-line"><span class="status-dot"></span>${esc(currentEvent?.label||inpostServiceStatusNazwa(currentStatus))} • ${esc(inpostServiceDataPotwierdzenia(updated))}</div></section>
    ${warning?`<div class="warning"><b>Nie udało się pobrać świeżego statusu.</b> Wydruk pokazuje ostatnie dane zapisane w systemie: ${esc(warning)}</div>`:""}
    <div class="content"><div class="route-grid"><section class="route"><small>Nadanie</small><b>${esc(sendingMethod)}</b><span>${esc(origin)}</span></section><div class="route-arrow">→</div><section class="route"><small>Doręczenie</small><b>${esc(item.deliveryType==="locker"?"Punkt odbioru InPost":"Adres odbiorcy")}</b><span>${esc(destination)}</span></section></div>
      <div class="meta"><div><small>Sposób nadania</small><b>${esc(sendingMethod)}</b></div><div><small>Usługa</small><b>${esc(service)}</b></div><div><small>Rozliczenie</small><b>${esc(billing)}</b></div></div>
      <div class="parties"><section class="party"><small>Odbiorca</small>${inpostServiceAdresPotwierdzenia(item.receiver)}</section>${inpostServiceMaDaneOsoby(item.customer)?`<section class="party"><small>Klient zlecający</small>${inpostServiceAdresPotwierdzenia(item.customer)}</section>`:""}</div>
      <section class="parcel"><small>Dane przesyłki</small><b>${esc(size?`Gabaryt / wymiary: ${size}`:"Przesyłka InPost")}${parcel.weight?` • ${esc(parcel.weight)} kg`:""}</b>${item.cod?.enabled?`<span>Pobranie: ${esc(zl(item.cod.amount))}</span>`:""}${item.weekend?'<span>Paczka w Weekend</span>':""}</section>
      ${trackingUrl?`<a class="track-link" href="${trackingUrl}" target="_blank" rel="noopener">Sprawdź przesyłkę online w InPost →</a>`:""}
      <h2>Historia przesyłki</h2><ol class="timeline">${timeline.map(event=>`<li><b>${esc(event.label||inpostServiceStatusNazwa(event.status))}</b><span>${esc(inpostServiceDataPotwierdzenia(event.occurredAt))}${event.location?` • ${esc(event.location)}`:""}</span>${event.description?`<small>${esc(event.description)}</small>`:""}</li>`).join("")||"<li><b>Oczekuje na pierwsze zdarzenie przewoźnika</b></li>"}</ol>
    </div><footer class="foot"><div><b>${esc(company.nazwa||sender.companyName||"Artway‑TM")}</b><span>${esc([config.emailSklepu||sender.email,config.telefon||sender.phone].filter(Boolean).join(" • "))}</span></div><span>Potwierdzenie informacyjne • dokument nie jest fakturą ani paragonem</span></footer>
  </main><div class="actions"><button onclick="window.print()">Drukuj / zapisz PDF</button><button onclick="window.close()">Zamknij</button></div></body></html>`;
}
async function inpostServicePotwierdzenieLegacy(id){
  const popup=window.open("","_blank","width=980,height=900");if(!popup)return toast("Przeglądarka zablokowała okno wydruku");
  popup.document.write('<!doctype html><html lang="pl"><meta charset="utf-8"><title>Przygotowanie potwierdzenia</title><body style="font-family:Arial;padding:40px"><h2>Odświeżam tracking InPost…</h2><p>Dokument otworzy się za chwilę.</p></body></html>');popup.document.close();
  let item=inpostServiceStan.items.find(row=>row.id===id),warning="";
  try{item=await inpostServicePobierzStatus(id);}catch(e){warning=e.message||String(e);}
  if(!item){popup.close();return toast("Nie znaleziono nadania");}
  popup.document.open();popup.document.write(inpostServicePotwierdzenieHTMLLegacy(item,warning));popup.document.close();
  renderuj();
}
function inpostServicePotwierdzenieHTML(item={}){
  const sender=item.sender||inpostServiceNadawca(),trackingUrl=item.trackingNumber?`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(item.trackingNumber)}`:"";
  const methodLabels={parcel_locker:"Nadanie w automacie Paczkomat®",dispatch_order:"Odbiór przez kuriera InPost",pop:"Nadanie w PaczkoPunkcie"},sendingMethod=methodLabels[item.sendingMethod]||"Nadanie w sieci InPost";
  const origin=item.sendingMethod==="dispatch_order"?(inpostServiceAdresTekstPotwierdzenia(sender)||"Stały adres nadania"):item.dropoffPoint||"Punkt nadania InPost";
  const destination=item.deliveryType==="locker"?(item.targetPoint||"Punkt odbioru InPost"):(inpostServiceAdresTekstPotwierdzenia(item.receiver)||"Adres odbiorcy"),parcel=item.parcel||{},size=parcel.template?String(parcel.template).toUpperCase():[parcel.length,parcel.width,parcel.height].filter(Boolean).join(" × ");
  const rawCost=item.pricing?.customerTotalGross??(Number(item.pricing?.totalGross||0)+Number(item.billing?.commissionGross||0)),cost=Number(rawCost)>0?zl(rawCost):"Do ustalenia";
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Potwierdzenie nadania ${esc(item.reference||item.id||"")}</title><style>
  :root{font-family:Inter,Arial,sans-serif;color:#172033;background:#eef2f7}*{box-sizing:border-box}body{margin:0;padding:26px}.sheet{max-width:820px;margin:auto;background:#fff;border:1px solid #dbe3ed;border-radius:18px;box-shadow:0 16px 45px #17203318;overflow:hidden}.head{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 32px;background:linear-gradient(135deg,#172554,#1d4ed8);color:#fff}.brand{font-size:20px;font-weight:900;letter-spacing:.04em}.head h1{margin:4px 0 0;font-size:26px}.head span{font-size:13px;color:#dbeafe}.facts{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:12px;padding:22px 32px;background:#eff6ff;border-bottom:1px solid #bfdbfe}.facts div,.card{padding:14px;border:1px solid #dbe3ed;border-radius:12px;background:#fff}.facts small,.card small{display:block;margin-bottom:6px;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.facts strong{display:block;color:#1e3a8a;font-size:18px;overflow-wrap:anywhere}.facts .cost strong{color:#166534;font-size:22px}.content{padding:24px 32px}.route{display:grid;grid-template-columns:1fr 42px 1fr;align-items:center}.arrow{text-align:center;color:#2563eb;font-size:24px;font-weight:900}.card b,.card span{display:block}.card span{margin-top:5px;color:#475569;font-size:13px}.details{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.receiver{display:grid;gap:3px}.receiver span{font-size:13px;color:#475569}.track-link{display:inline-block;margin-top:18px;color:#1d4ed8;font-weight:800}.foot{padding:16px 32px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}.actions{display:flex;justify-content:center;gap:10px;padding:18px}.actions button{padding:11px 18px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.actions button:last-child{background:#e2e8f0;color:#172033}@media(max-width:650px){body{padding:0}.sheet{border:0;border-radius:0}.head{align-items:flex-start;flex-direction:column}.facts,.details,.route{grid-template-columns:1fr}.arrow{transform:rotate(90deg)}.head,.facts,.content,.foot{padding-left:18px;padding-right:18px}}@page{size:A4;margin:12mm}@media print{body{padding:0;background:#fff}.sheet{max-width:none;border:0;border-radius:0;box-shadow:none}.actions{display:none}.head,.facts{-webkit-print-color-adjust:exact;print-color-adjust:exact}.card{break-inside:avoid}}</style></head><body><main class="sheet"><header class="head"><div><div class="brand">ARTWAY‑TM</div><h1>Potwierdzenie nadania</h1></div><span>InPost</span></header><section class="facts"><div><small>Numer przesyłki</small><strong>${esc(item.trackingNumber||"Numer oczekuje")}</strong></div><div><small>Data nadania</small><b>${esc(inpostServiceDataPotwierdzenia(item.createdAt))}</b><br><small style="margin-top:8px">Referencja</small><b>${esc(item.reference||item.id||"—")}</b></div><div class="cost"><small>Koszt nadania</small><strong>${esc(cost)}</strong></div></section><div class="content"><div class="route"><section class="card"><small>Nadanie</small><b>${esc(sendingMethod)}</b><span>${esc(origin)}</span></section><div class="arrow">→</div><section class="card"><small>Doręczenie</small><b>${esc(item.deliveryType==="locker"?"Punkt odbioru InPost":"Adres odbiorcy")}</b><span>${esc(destination)}</span></section></div><div class="details"><section class="card receiver"><small>Odbiorca</small>${inpostServiceAdresPotwierdzenia(item.receiver)}</section><section class="card"><small>Przesyłka</small><b>${esc(size?`Gabaryt / wymiary: ${size}`:"Przesyłka InPost")}${parcel.weight?` • ${esc(parcel.weight)} kg`:""}</b>${item.cod?.enabled?`<span>Pobranie: ${esc(zl(item.cod.amount))}</span>`:""}${item.weekend?'<span>Paczka w Weekend</span>':""}</section></div>${trackingUrl?`<a class="track-link" href="${trackingUrl}" target="_blank" rel="noopener">Sprawdź historię przesyłki w InPost →</a>`:""}</div><footer class="foot">Artway‑TM</footer></main><div class="actions"><button onclick="window.print()">Drukuj / zapisz PDF</button><button onclick="window.close()">Zamknij</button></div></body></html>`;
}
function inpostServiceDodajStyleWydruku(popup){
  const link=popup?.document?.createElement?.("link");if(!link)return;
  link.rel="stylesheet";link.href="/assets/inpost-print.css";popup.document.head?.appendChild(link);
}
function inpostServicePotwierdzenie(id){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item)return toast("Nie znaleziono nadania");
  const popup=window.open("","_blank","width=920,height=900");if(!popup)return toast("Przeglądarka zablokowała okno wydruku");
  popup.document.open();popup.document.write(inpostServicePotwierdzenieHTML(item));popup.document.close();inpostServiceDodajStyleWydruku(popup);
}
function inpostServiceHistoriaPrzesylkiHTML(item={},warning=""){
  const events=Array.isArray(item.trackingHistory)?item.trackingHistory:[],status=item.inpostStatus||item.status,updated=item.trackingUpdatedAt||item.updatedAt||item.createdAt;
  const timeline=events.length?events:[{status:status||"created",label:inpostServiceStatusNazwa(status||"created"),occurredAt:updated}];
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Historia ${esc(item.trackingNumber||item.reference||"")}</title><style>:root{font-family:Inter,Arial,sans-serif;color:#172033;background:#eef2f7}*{box-sizing:border-box}body{margin:0;padding:26px}.sheet{max-width:760px;margin:auto;background:#fff;border:1px solid #dbe3ed;border-radius:18px;box-shadow:0 16px 45px #17203318;overflow:hidden}.head{padding:26px 32px;background:linear-gradient(135deg,#172554,#1d4ed8);color:#fff}.head small{color:#dbeafe}.head h1{margin:6px 0}.content{padding:24px 32px}.status{padding:14px;border:1px solid #86efac;border-radius:12px;background:#f0fdf4;color:#166534}.timeline{margin:22px 0 0;padding:0;list-style:none}.timeline li{position:relative;margin-left:12px;padding:0 0 20px 28px;border-left:2px solid #cbd5e1}.timeline li:last-child{padding-bottom:0}.timeline li:before{content:"";position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 4px #dbeafe}.timeline b,.timeline span,.timeline small{display:block}.timeline span,.timeline small{margin-top:3px;color:#64748b}.warning{margin-bottom:14px;padding:12px;border:1px solid #f59e0b;border-radius:10px;background:#fffbeb;color:#92400e}.actions{text-align:center;padding:18px}.actions button{padding:10px 18px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800}@media(max-width:650px){body{padding:0}.sheet{border:0;border-radius:0}.head,.content{padding-left:18px;padding-right:18px}}</style></head><body><main class="sheet"><header class="head"><small>ARTWAY‑TM • InPost</small><h1>Historia przesyłki</h1><b>${esc(item.trackingNumber||"Numer oczekuje")}</b></header><div class="content">${warning?`<div class="warning">Nie udało się pobrać świeżego statusu: ${esc(warning)}</div>`:""}<div class="status"><b>${esc(inpostServiceStatusNazwa(status))}</b><br><small>Aktualizacja: ${esc(inpostServiceDataPotwierdzenia(updated))}</small></div><ol class="timeline">${timeline.map(event=>`<li><b>${esc(event.label||inpostServiceStatusNazwa(event.status))}</b><span>${esc(inpostServiceDataPotwierdzenia(event.occurredAt))}${event.location?` • ${esc(event.location)}`:""}</span>${event.description?`<small>${esc(event.description)}</small>`:""}</li>`).join("")}</ol></div></main><div class="actions"><button onclick="window.close()">Zamknij</button></div></body></html>`;
}
async function inpostServiceHistoriaPrzesylki(id){
  const popup=window.open("","_blank","width=850,height=900");if(!popup)return toast("Przeglądarka zablokowała okno historii");
  popup.document.write('<!doctype html><html lang="pl"><meta charset="utf-8"><title>Historia przesyłki</title><body style="font-family:Arial;padding:40px"><h2>Pobieram aktualną historię InPost…</h2></body></html>');popup.document.close();
  let item=inpostServiceStan.items.find(row=>row.id===id),warning="";try{item=await inpostServicePobierzStatus(id);}catch(e){warning=e.message||String(e);}
  if(!item){popup.close();return toast("Nie znaleziono nadania");}popup.document.open();popup.document.write(inpostServiceHistoriaPrzesylkiHTML(item,warning));popup.document.close();inpostServiceDodajStyleWydruku(popup);renderuj();
}
async function inpostServiceEtykieta(id,format="A6"){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item?.inpostId)return toast("Przesyłka nie ma jeszcze ID InPost");
  try{await inpostOtworzPodgladEtykiety({id:item.inpostId,format,reference:item.reference||item.trackingNumber||id});}catch(e){toast("Etykieta: "+(e.message||e));}
}
async function inpostServiceOdbior(id){
  if(!confirm("To zamówi prawdziwy odbiór kuriera InPost dla tej przesyłki. Kontynuować?"))return;
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
  window.__inpostPointPurpose=["dropoff","default-dropoff"].includes(purpose)?purpose:"target";window.__geoTarget="inpost-service";otworzGeowidget();
}
async function inpostServiceSzukajPunktow(){
  const query=String(document.getElementById("inpostServicePointSearch")?.value||"").trim(),box=document.getElementById("inpostServicePointResults");
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  if(box)box.innerHTML="<small>Szukam punktów InPost…</small>";
  try{const params={limit:10,...(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query})},d=await chmura("inpost-points",{params,timeout:15000});if(box)box.innerHTML=(d.points||[]).map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))})"><b>${esc(point.name)}</b><span>${esc(opisPunktuInpost(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów.</small>";}catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
function inpostServiceWybierzPunkt(code,address="",purpose=window.__inpostPointPurpose||"target"){
  const defaultDropoff=purpose==="default-dropoff",dropoff=purpose==="dropoff",input=document.getElementById(defaultDropoff?"inpostServiceDefaultDropoffPoint":dropoff?"inpostServiceDropoffPoint":"inpostServiceTargetPoint"),label=document.getElementById(defaultDropoff?"inpostServiceDefaultDropoffPointLabel":dropoff?"inpostServiceDropoffPointLabel":"inpostServiceTargetPointLabel");
  if(input){input.value=String(code||"").toUpperCase();input.dispatchEvent(new Event("input",{bubbles:true}));}
  if(label)label.textContent=address||code;window.__inpostPointPurpose="";toast(`${dropoff||defaultDropoff?"Automat nadawczy":"Punkt odbioru"}: ${code}`);
}
function inpostServiceLista(){
  const q=normalizujSzukanyTekst(inpostServiceSzukaj),terms=q.split(" ").filter(Boolean);
  return (inpostServiceStan.items||[]).filter(item=>{
    const customer=item.customer||item.sender||{},text=normalizujSzukanyTekst([item.id,item.reference,item.trackingNumber,item.inpostStatus,customer.companyName,customer.firstName,customer.lastName,customer.email,customer.taxCode,item.receiver?.companyName,item.receiver?.firstName,item.receiver?.lastName,item.receiver?.email,item.receiver?.taxCode,item.targetPoint].join(" "));
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
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr operacyjny</span><h2>Nadania i rozliczenia</h2><p class="order-detail-lead">Tracking, etykieta, zlecenie odbioru i faktura tworzą jeden ślad operacyjny. Koszt umowny przewoźnika nie jest wyświetlany.</p></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Filtry działają po danych nadania i rozliczenia klienta.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table"><thead><tr><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Status</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(item=>`<tr data-stable-key="${esc(item.id)}"><td><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td><td><b>${esc(item.receiver?.companyName||`${item.receiver?.firstName||""} ${item.receiver?.lastName||""}`.trim()||"Klient")}</b><br><small>${esc(item.receiver?.email||"")}${item.receiver?.taxCode?` • NIP ${esc(item.receiver.taxCode)}`:""}</small></td><td>${item.deliveryType==="locker"?"📮 Paczkomat / punkt":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Paczka w Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td><td>${inpostServiceStatusLabel(item)}<br><small>${esc(item.inpostStatus||"")}</small>${item.pickup?.id?`<br><span class="lvl lvl-ok">odbiór kuriera ${esc(item.pickup.status||"")}</span>`:""}</td><td>${inpostServiceBillingLabel(item)}<br><small>prowizja ${zl(item.billing?.commissionGross||0)}</small>${item.billing?.error?`<br><small class="error">${esc(item.billing.error)}</small>`:""}</td><td><div class="inpost-row-actions"><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.pickupRequested&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">Odbiór kuriera</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="6">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
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
