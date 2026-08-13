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
