let inpostServiceStan={loaded:false,loading:false,saving:false,error:"",items:[],addressBook:[],settings:{commissionGross:4,sender:{}},billing:{groups:[]},serviceAvailability:null,requestId:"",pricing:null};
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
  if(trasa()==="/admin/wysylki/inpost")renderuj();
}
function inpostServiceUstawTyp(form){
  const type=String(form?.deliveryType?.value||"locker");
  form?.querySelectorAll("[data-inpost-only]").forEach(el=>el.hidden=!String(el.dataset.inpostOnly||"").split(",").includes(type));
  if(type==="locker"&&form?.sendingMethod?.value==="dispatch_order")form.sendingMethod.value="parcel_locker";
  inpostServicePrzelicz(form);
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
function inpostServicePayload(form){
  const data=new FormData(form),additionalServices=[...form.querySelectorAll('[name="additionalServices"]:checked')].map(input=>input.value);
  return {requestId:inpostServiceStan.requestId||inpostServiceNowyRequestId(),reference:String(data.get("reference")||"").trim(),comments:String(data.get("comments")||"").trim(),sender:inpostServiceStronaOsoby(form,"sender"),receiver:inpostServiceStronaOsoby(form,"receiver"),saveSender:data.get("saveSender")==="on",saveReceiver:data.get("saveReceiver")==="on",deliveryType:data.get("deliveryType"),sendingMethod:data.get("sendingMethod"),targetPoint:data.get("targetPoint"),dropoffPoint:data.get("dropoffPoint"),parcel:{template:data.get("template"),length:data.get("length"),width:data.get("width"),height:data.get("height"),weight:data.get("weight"),nonStandard:data.get("nonStandard")==="on"},cod:{enabled:data.get("codEnabled")==="on",amount:data.get("codAmount")},insurance:{enabled:data.get("insuranceEnabled")==="on",amount:data.get("insuranceAmount")},weekend:data.get("weekend")==="on",additionalServices,pickupRequested:data.get("pickupRequested")==="on",billingMode:data.get("billingMode"),billingMonth:data.get("billingMonth"),commissionGross:data.get("commissionGross"),carrierCostOverride:data.get("carrierCostOverride")};
}
function inpostServiceBladPol(fields=[]){
  const first=Array.isArray(fields)?fields[0]:null;
  if(first?.message)toast(first.message);
}
async function inpostServiceUtworz(event){
  event.preventDefault();if(inpostServiceStan.saving)return;
  const form=event.currentTarget,payload=inpostServicePayload(form),button=form.querySelector('[type="submit"]');
  inpostServiceStan={...inpostServiceStan,saving:true};if(button){button.disabled=true;button.textContent="⏳ Tworzę przesyłkę…";}
  try{
    const d=await chmura("inpost-service-create",{method:"POST",body:payload,timeout:90000});
    if(d.item)inpostServiceStan.items=[d.item,...inpostServiceStan.items.filter(item=>item.id!==d.item.id)];
    inpostServiceNowyRequestId();await inpostServiceLaduj(true,true);
    toast(d.invoice?.error?`Przesyłka utworzona ✅ Faktura wymaga uwagi: ${d.invoice.error}`:`Przesyłka InPost utworzona ✅ ${d.item?.trackingNumber||"oczekuje na numer"}`);
    renderuj();
  }catch(e){if(e.code==="previous_attempt_failed")inpostServiceNowyRequestId();inpostServiceBladPol(e.details);toast("Nie utworzono przesyłki: "+(e.message||e));}
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
function inpostServicePotwierdzenieHTML(item={},warning=""){
  const company=typeof daneFirmy==="function"?daneFirmy():{},events=Array.isArray(item.trackingHistory)?item.trackingHistory:[],currentStatus=item.inpostStatus||item.status;
  const currentEvent=events[0],updated=item.trackingUpdatedAt||currentEvent?.occurredAt||item.updatedAt||item.createdAt;
  const trackingUrl=item.trackingNumber?`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(item.trackingNumber)}`:"";
  const service=item.deliveryType==="locker"?`Paczkomat / PaczkoPunkt${item.targetPoint?` • ${item.targetPoint}`:""}`:"Kurier InPost";
  const parcel=item.parcel||{},size=parcel.template?String(parcel.template).toUpperCase():[parcel.length,parcel.width,parcel.height].filter(Boolean).join(" × ");
  const billing={none:"Bez faktury",single:"Faktura wystawiana od razu",monthly:"Rozliczenie na fakturze miesięcznej"}[item.billing?.mode]||"—";
  const timeline=events.length?events:(currentStatus||item.createdAt?[{status:currentStatus||"created",label:inpostServiceStatusNazwa(currentStatus||"created"),occurredAt:updated}]:[]);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Potwierdzenie ${esc(item.reference||item.id||"nadania")}</title><style>
  :root{font-family:Inter,Arial,sans-serif;color:#172033;background:#eef2f7}*{box-sizing:border-box}body{margin:0;padding:28px}.sheet{max-width:900px;margin:auto;background:#fff;border:1px solid #dbe3ee;border-radius:22px;box-shadow:0 18px 55px #17203318;overflow:hidden}.head{display:flex;justify-content:space-between;gap:24px;padding:30px 34px;background:linear-gradient(135deg,#111827,#312e81);color:#fff}.brand{font-size:24px;font-weight:900}.head h1{margin:5px 0 0;font-size:26px}.head small{color:#dbeafe}.status{padding:22px 34px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.status b{display:block;font-size:24px;color:#166534}.status span{display:block;margin-top:5px;color:#64748b}.content{padding:28px 34px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}.meta div,.party,.parcel{padding:14px;border:1px solid #e2e8f0;border-radius:14px}.meta small,.party small,.parcel small{display:block;margin-bottom:6px;color:#64748b;font-weight:700}.meta b{font-size:15px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:14px}.party{display:grid;gap:3px}.party span{font-size:13px;color:#475569}.parcel{margin-top:14px}.timeline{margin:24px 0 0;padding:0;list-style:none}.timeline li{position:relative;margin-left:12px;padding:0 0 20px 28px;border-left:2px solid #cbd5e1}.timeline li:last-child{padding-bottom:0}.timeline li:before{content:"";position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 4px #dbeafe}.timeline li:first-child:before{background:#16a34a;box-shadow:0 0 0 4px #dcfce7}.timeline b{display:block}.timeline span,.timeline small{display:block;margin-top:3px;color:#64748b}.track-link{display:inline-block;margin-top:16px;color:#1d4ed8;font-weight:800}.warning{margin:0 34px 20px;padding:12px 14px;border:1px solid #f59e0b;border-radius:12px;background:#fffbeb;color:#92400e}.foot{display:flex;justify-content:space-between;gap:20px;padding:20px 34px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}.actions{display:flex;justify-content:center;gap:10px;padding:20px}.actions button{padding:11px 18px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.actions button:last-child{background:#e2e8f0;color:#172033}@media(max-width:650px){body{padding:0}.sheet{border:0;border-radius:0}.head,.status,.content,.foot{padding-left:18px;padding-right:18px}.head,.foot{display:block}.meta,.parties{grid-template-columns:1fr}.foot span{display:block;margin-top:6px}}@media print{body{padding:0;background:#fff}.sheet{max-width:none;border:0;border-radius:0;box-shadow:none}.actions{display:none}.head{-webkit-print-color-adjust:exact;print-color-adjust:exact}.timeline li{break-inside:avoid}.warning{margin-left:34px;margin-right:34px}}</style></head><body><main class="sheet">
    <header class="head"><div><div class="brand">${esc(company.nazwa||"Artway‑TM")}</div><h1>Potwierdzenie nadania przesyłki</h1><small>Dokument informacyjny dla klienta</small></div><div><b>${esc(item.reference||item.id||"—")}</b><small>Wydruk: ${esc(inpostServiceDataPotwierdzenia(new Date().toISOString()))}</small></div></header>
    <section class="status"><b>${esc(currentEvent?.label||inpostServiceStatusNazwa(currentStatus))}</b><span>Stan potwierdzony na: ${esc(inpostServiceDataPotwierdzenia(updated))}</span></section>
    ${warning?`<div class="warning"><b>Nie udało się pobrać świeżego statusu.</b> Wydruk pokazuje ostatnie dane zapisane w systemie: ${esc(warning)}</div>`:""}
    <div class="content"><div class="meta"><div><small>Numer nadania</small><b>${esc(item.trackingNumber||"Oczekuje na nadanie numeru")}</b></div><div><small>Usługa</small><b>${esc(service)}</b></div><div><small>Rozliczenie</small><b>${esc(billing)}</b></div></div>
      <div class="parties"><section class="party"><small>Nadawca</small>${inpostServiceAdresPotwierdzenia(item.sender)}</section><section class="party"><small>Odbiorca</small>${inpostServiceAdresPotwierdzenia(item.receiver)}</section></div>
      <section class="parcel"><small>Dane przesyłki</small><b>${esc(size?`Gabaryt / wymiary: ${size}`:"Przesyłka InPost")}${parcel.weight?` • ${esc(parcel.weight)} kg`:""}</b>${item.cod?.enabled?`<span>Pobranie: ${esc(zl(item.cod.amount))}</span>`:""}${item.weekend?'<span>Paczka w Weekend</span>':""}</section>
      ${trackingUrl?`<a class="track-link" href="${trackingUrl}" target="_blank" rel="noopener">Sprawdź przesyłkę online w InPost →</a>`:""}
      <h2>Historia transportu</h2><ol class="timeline">${timeline.map(event=>`<li><b>${esc(event.label||inpostServiceStatusNazwa(event.status))}</b><span>${esc(inpostServiceDataPotwierdzenia(event.occurredAt))}${event.location?` • ${esc(event.location)}`:""}</span>${event.description?`<small>${esc(event.description)}</small>`:""}</li>`).join("")||"<li><b>Oczekuje na pierwsze zdarzenie przewoźnika</b></li>"}</ol>
    </div><footer class="foot"><span>${esc([company.nazwa,pelnyAdresFirmy?.(company)].filter(Boolean).join(" • "))}</span><span>Dokument nie jest fakturą ani paragonem.</span></footer>
  </main><div class="actions"><button onclick="window.print()">Drukuj / zapisz PDF</button><button onclick="window.close()">Zamknij</button></div></body></html>`;
}
async function inpostServicePotwierdzenie(id){
  const popup=window.open("","_blank","width=980,height=900");if(!popup)return toast("Przeglądarka zablokowała okno wydruku");
  popup.document.write('<!doctype html><html lang="pl"><meta charset="utf-8"><title>Przygotowanie potwierdzenia</title><body style="font-family:Arial;padding:40px"><h2>Odświeżam tracking InPost…</h2><p>Dokument otworzy się za chwilę.</p></body></html>');popup.document.close();
  let item=inpostServiceStan.items.find(row=>row.id===id),warning="";
  try{item=await inpostServicePobierzStatus(id);}catch(e){warning=e.message||String(e);}
  if(!item){popup.close();return toast("Nie znaleziono nadania");}
  popup.document.open();popup.document.write(inpostServicePotwierdzenieHTML(item,warning));popup.document.close();
  renderuj();
}
async function inpostServiceEtykieta(id,format="A6"){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item?.inpostId)return toast("Przesyłka nie ma jeszcze ID InPost");
  try{const d=await chmura("inpost-label",{params:{id:item.inpostId,type:format},timeout:30000}),url=URL.createObjectURL(b64toBlob(d.base64,"application/pdf"));window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){toast("Etykieta: "+(e.message||e));}
}
async function inpostServiceOdbior(id){
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
function inpostServiceOtworzMape(){
  window.__geoTarget="inpost-service";otworzGeowidget();
}
async function inpostServiceSzukajPunktow(){
  const query=String(document.getElementById("inpostServicePointSearch")?.value||"").trim(),box=document.getElementById("inpostServicePointResults");
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  if(box)box.innerHTML="<small>Szukam punktów InPost…</small>";
  try{const params={limit:10,...(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query})},d=await chmura("inpost-points",{params,timeout:15000});if(box)box.innerHTML=(d.points||[]).map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))})"><b>${esc(point.name)}</b><span>${esc(opisPunktuInpost(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów.</small>";}catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
function inpostServiceWybierzPunkt(code,address=""){
  const input=document.getElementById("inpostServiceTargetPoint"),label=document.getElementById("inpostServiceTargetPointLabel");if(input)input.value=String(code||"").toUpperCase();if(label)label.textContent=address||code;toast("Wybrano "+code);
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
