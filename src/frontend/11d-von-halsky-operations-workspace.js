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
  if(String(trasa())==="/admin/von-halsky")vonHalskyAktualizujDashboardDOM();
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
  const template=document.createElement("template");template.innerHTML=vonHalskyDashboardWorkspaceHTML().trim();
  const next=template.content.firstElementChild;if(!next)return false;
  current.replaceWith(next);return true;
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
  return `<div class="von-halsky-dashboard-pro" data-vh-dashboard>
    ${dashboard.loading?`<div class="von-halsky-inline-loading"><span></span><b>Aktualizuję statystyki kanału…</b></div>`:""}
    ${dashboard.error?`<div class="backend-note warning"><b>Nie pobrano statystyk</b><span>${esc(dashboard.error)}</span><button class="btn ghost" onclick="vonHalskyLadujDashboard(true)">Ponów</button></div>`:""}
    <section class="von-halsky-dashboard-kpis">${cards.map(([icon,value,label,note,href,cls])=>`<a class="${cls}" href="${href}"><span>${icon}</span><div><b>${esc(value)}</b><strong>${esc(label)}</strong><small>${esc(note)}</small></div><em>Otwórz →</em></a>`).join("")}</section>
    <section class="von-halsky-dashboard-main">${vonHalskyDashboardChartHTML()}<aside class="panel von-halsky-sync-health"><div class="order-section-head"><div><span class="order-pro-label">Automatyzacja serwera</span><h2>Kondycja synchronizacji</h2></div><span class="lvl ${sync.status==="connected"?"lvl-ok":"lvl-ostrzezenie"}">${esc(vonHalskyPolaczenieEtykieta())}</span></div><dl><div><dt>Ostatnie uzgodnienie</dt><dd>${esc(last?allegroDataTxt(last):"brak")}</dd></div><div><dt>Tryb</dt><dd>${sync.reconciliationMode==="webhook_with_polling_fallback"?"Webhook + kontrola":"Kontrola serwerowa"}</dd></div><div><dt>Regularny interwał</dt><dd>${interval} min</dd></div><div><dt>Przy ofertach oczekujących</dt><dd>3 min</dd></div><div><dt>Polecenia oczekujące</dt><dd>${Number(commands.pending)||0}</dd></div></dl><button class="btn ghost" onclick="vonHalskyOdswiezPelnyStatus().then(()=>vonHalskyLadujDashboard(true))">Uzgodnij teraz</button></aside></section>
    <section class="von-halsky-dashboard-columns"><article class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kolejka wyjątków</span><h2>Najczęstsze powody odrzucenia</h2></div><a class="btn ghost" href="#/admin/von-halsky/wystawianie">Pełna lista</a></div><div class="von-halsky-operation-list">${reasons||`<div class="admin-empty-state compact"><span>✓</span><div><b>Brak powodów odrzucenia</b><small>API nie zwróciło aktywnych błędów ofert.</small></div></div>`}</div></article><article class="panel"><div class="order-section-head"><div><span class="order-pro-label">Dziennik kanału</span><h2>Ostatnie operacje</h2></div><button class="btn ghost" onclick="vonHalskyLadujDashboard(true)">Odśwież</button></div><div class="von-halsky-dashboard-activity">${recent||`<div class="admin-empty-state compact"><span>○</span><div><b>Brak nowych zdarzeń</b><small>Kanał działa bez dodatkowych komunikatów.</small></div></div>`}</div></article></section>
  </div>`;
}

function vonHalskyRekordyStatusy(kind){
  return {
    orders:["CREATED","NEW","PAID","ACCEPTED","PROCESSING","READY","COMPLETED","REFUSED","CANCELLED","REFUNDED"],
    returns:["NEW","ACCEPTED","REJECTED","COMPLETED"],
    claims:["NEW","RESOLUTION_IN_PROGRESS","APPROVED","REJECTED"],
    commands:["PENDING","PROVIDER_PROCESSING","SUCCESS","FAILED","NOT_FOUND"],
  }[kind]||[];
}
function vonHalskyRekordyKlucz(){const r=vonHalskyStan.records;return JSON.stringify([r.view,r.query,r.status,r.cursor]);}
async function vonHalskyLadujRekordy({force=false,cursor=null}={}){
  const records=vonHalskyStan.records;if(records.loading)return;
  if(cursor!==null)records.cursor=String(cursor||"");
  const key=vonHalskyRekordyKlucz();if(!force&&records.queryKey===key)return;
  records.loading=true;records.error="";vonHalskyAktualizujZamowieniaDOM();
  try{
    const data=await chmura("von-halsky-records",{params:{kind:records.view,q:records.query,status:records.status==="wszystkie"?"":records.status,limit:50,cursor:records.cursor},timeout:20000});
    Object.assign(records,{items:data.items||[],total:Number(data.total)||0,nextCursor:data.nextCursor||null,previousCursor:data.previousCursor||null,queryKey:key,error:""});
  }catch(error){records.error=String(error?.message||error);}
  records.loading=false;vonHalskyAktualizujZamowieniaDOM();
}
function vonHalskyZmienWidokRekordow(kind){
  Object.assign(vonHalskyStan.records,{view:kind,status:"wszystkie",cursor:"",queryKey:""});
  vonHalskyRekordyZaznaczone.clear();void vonHalskyLadujRekordy({force:true});
}
function vonHalskySzukajRekordy(value){
  vonHalskyStan.records.query=String(value||"");vonHalskyStan.records.cursor="";clearTimeout(vonHalskyRekordyTimer);
  vonHalskyRekordyTimer=setTimeout(()=>vonHalskyLadujRekordy({force:true}),350);
}
function vonHalskyFiltrujRekordy(value){
  vonHalskyStan.records.status=String(value||"wszystkie");vonHalskyStan.records.cursor="";void vonHalskyLadujRekordy({force:true});
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
function vonHalskyRekordyTabelaHTML(){
  const records=vonHalskyStan.records,items=records.items||[],kind=records.view;
  const empty=`<tr><td colspan="7"><div class="allegro-listing-empty"><span>⌕</span><b>Brak danych w tym widoku</b><small>Filtry nie zwracają żadnych rekordów z API.</small></div></td></tr>`;
  if(kind==="orders")return `<table class="admin-standard-table admin-responsive-table von-halsky-orders-table"><thead><tr><th></th><th>Zamówienie</th><th>Klient</th><th>Płatność</th><th>Wartość</th><th>Data</th><th>Akcje</th></tr></thead><tbody>${items.map(item=>{const id=vonHalskyRekordId(item),status=String(item.status||item._status||"");return `<tr><td data-label=""><input type="checkbox" ${vonHalskyRekordyZaznaczone.has(id)?"checked":""} onchange="vonHalskyZaznaczRekord(${jsArg(id)},this.checked)"></td><td data-label="Zamówienie"><b>${esc(id)}</b><small><span class="lvl ${["CREATED","NEW","PAID"].includes(status)?"lvl-ostrzezenie":"lvl-info"}">${esc(status||"—")}</span></small></td><td data-label="Klient">${esc([item.customer?.firstName||item.customer?.name,item.customer?.lastName].filter(Boolean).join(" ")||item.customer?.email||"—")}</td><td data-label="Płatność">${esc(item.paymentDetails?.status||item.payment?.status||"—")}</td><td data-label="Wartość"><b>${esc(item.finalPrice?.amount??item.total?.amount??"—")} ${esc(item.finalPrice?.currency||item.total?.currency||"")}</b></td><td data-label="Data">${esc(allegroDataTxt(item.updatedAt||item.createdAt))}</td><td data-label="Akcje"><div class="von-halsky-row-actions"><button class="btn ghost" onclick="vonHalskyOtworzSzczegolyRekordu(${jsArg(id)})">Szczegóły</button>${["CREATED","NEW","PAID"].includes(status)?`<button class="btn" onclick="vonHalskyOtworzDecyzje('order-accept',${jsArg(id)})">Przyjmij</button><button class="btn ghost" onclick="vonHalskyOtworzDecyzje('order-refuse',${jsArg(id)})">Odrzuć</button>`:""}${!["REFUNDED","CANCELLED","REFUSED"].includes(status)?`<button class="btn ghost" onclick="vonHalskyOtworzDecyzje('refund',${jsArg(id)})">Refunduj</button>`:""}</div></td></tr>`;}).join("")||empty}</tbody></table>`;
  if(kind==="commands")return `<table class="admin-standard-table admin-responsive-table"><thead><tr><th></th><th>Polecenie</th><th>Typ</th><th>Status</th><th>Obiekt</th><th>Aktualizacja</th><th>Akcja</th></tr></thead><tbody>${items.map(item=>{const id=vonHalskyRekordId(item);return `<tr><td data-label=""><input type="checkbox" onchange="vonHalskyZaznaczRekord(${jsArg(id)},this.checked)"></td><td data-label="Polecenie"><b>${esc(id)}</b></td><td data-label="Typ">${esc(item.type||"—")}</td><td data-label="Status"><span class="lvl ${item.status==="SUCCESS"?"lvl-ok":"lvl-info"}">${esc(item.status||"—")}</span></td><td data-label="Obiekt">${esc(item.entityId||item.externalId||"—")}</td><td data-label="Aktualizacja">${esc(allegroDataTxt(item.updatedAt||item._updatedAt))}</td><td data-label="Akcja"><button class="btn ghost" onclick="vonHalskySprawdzPolecenie(${jsArg(id)},${jsArg(item.type||"offer")});setTimeout(()=>vonHalskyLadujRekordy({force:true}),500)">Sprawdź</button></td></tr>`;}).join("")||empty}</tbody></table>`;
  const claim=kind==="claims";
  return `<table class="admin-standard-table admin-responsive-table"><thead><tr><th></th><th>${claim?"Reklamacja":"Zwrot"}</th><th>Zamówienie</th><th>Powód</th><th>Status</th><th>Termin</th><th>Akcje</th></tr></thead><tbody>${items.map(item=>{const id=vonHalskyRekordId(item),orderId=item.relatedOrder?.orderId||item.orderId||"";return `<tr><td data-label=""><input type="checkbox" onchange="vonHalskyZaznaczRekord(${jsArg(id)},this.checked)"></td><td data-label="${claim?"Reklamacja":"Zwrot"}"><b>${esc(id)}</b></td><td data-label="Zamówienie">${esc(orderId||"—")}</td><td data-label="Powód">${esc(claim?(item.specification?.claimTypeDescription||item.specification?.claimType?.description):(item.returnReason?.text)||"—")}</td><td data-label="Status"><span class="lvl lvl-info">${esc(item.state||item.status||"NOWY")}</span></td><td data-label="Termin">${esc(allegroDataTxt(item.expiresAt||item.createdAt))}</td><td data-label="Akcje"><div class="von-halsky-row-actions"><button class="btn ghost" onclick="vonHalskyOtworzSzczegolyRekordu(${jsArg(id)})">Szczegóły</button>${claim?`<button class="btn" onclick="vonHalskyOtworzDecyzje('claim',${jsArg(id)})">Rozstrzygnij</button>`:`<button class="btn" onclick="vonHalskyOtworzDecyzje('return-accept',${jsArg(id)})">Akceptuj</button><button class="btn ghost" onclick="vonHalskyOtworzDecyzje('return-refuse',${jsArg(id)})">Odrzuć</button>`}</div></td></tr>`;}).join("")||empty}</tbody></table>`;
}
function vonHalskyOrdersWorkspaceHTML(){
  const records=vonHalskyStan.records,kind=records.view,statuses=vonHalskyRekordyStatusy(kind),busy=!!vonHalskyStan.operation;
  if(!records.queryKey&&!records.loading)setTimeout(()=>vonHalskyLadujRekordy({force:true}),0);
  const tabs=[["orders","📦","Zamówienia"],["returns","↩","Zwroty"],["claims","🛡","Reklamacje"],["commands","⏱","Operacje API"]];
  return `<div class="von-halsky-orders-workspace" data-vh-orders>
    <section class="panel von-halsky-order-tabs"><div class="von-halsky-order-tabbar">${tabs.map(([id,icon,label])=>`<button class="${kind===id?"active":""}" onclick="vonHalskyZmienWidokRekordow(${jsArg(id)})"><span>${icon}</span><b>${label}</b>${kind===id?`<em>${records.total}</em>`:""}</button>`).join("")}</div></section>
    <section class="panel von-halsky-order-list"><div class="order-section-head"><div><span class="order-pro-label">Dane bezpośrednio z API</span><h2>${esc(tabs.find(row=>row[0]===kind)?.[2]||"Obsługa sprzedaży")}</h2><p class="order-detail-lead">Lista jest stronicowana na serwerze. Operacje aktualizują wyłącznie właściwy rekord.</p></div><div class="diag-actions"><button class="btn ghost" ${busy?"disabled":""} onclick="${kind==="orders"?"vonHalskySynchronizujZamowienia().then(()=>vonHalskyLadujRekordy({force:true}))":kind==="commands"?"vonHalskySynchronizujZdarzenia().then(()=>vonHalskyLadujRekordy({force:true}))":"vonHalskySynchronizujPosprzedaz().then(()=>vonHalskyLadujRekordy({force:true}))"}">${busy?"↻ Pobieram…":"↻ Pobierz z API"}</button>${kind==="orders"?`<a class="btn" href="#/admin/wysylki">Centrum wysyłek</a>`:""}</div></div>
      <div class="von-halsky-order-filters"><label><span>Szukaj</span><input value="${esc(records.query)}" oninput="vonHalskySzukajRekordy(this.value)" placeholder="ID, klient, e-mail, produkt, status…"></label><label><span>Status</span><select onchange="vonHalskyFiltrujRekordy(this.value)"><option value="wszystkie">Wszystkie statusy</option>${statuses.map(status=>`<option ${records.status===status?"selected":""}>${status}</option>`).join("")}</select></label><button class="btn ghost" onclick="vonHalskyZaznaczRekordyWidoku(true)">Zaznacz stronę</button><button class="btn ghost" onclick="vonHalskyZaznaczRekordyWidoku(false)">Odznacz</button><button class="btn ghost" onclick="vonHalskyEksportujRekordy()">Eksport CSV</button></div>
      ${records.loading?`<div class="von-halsky-inline-loading"><span></span><b>Pobieram rekordy…</b></div>`:""}${records.error?`<div class="backend-note warning"><b>Nie pobrano danych</b><span>${esc(records.error)}</span></div>`:""}
      <div class="allegro-listing-results-head"><div><b>${records.total} rekordów</b><small>Pokazano ${records.items.length} • odczyt serwerowy</small></div><span><b>${vonHalskyRekordyZaznaczone.size}</b> zaznaczonych</span></div><div class="admin-standard-table-wrap">${vonHalskyRekordyTabelaHTML()}</div>
      <nav class="allegro-listing-pagination"><button class="btn ghost" ${!records.previousCursor?"disabled":""} onclick="vonHalskyPrzejdzRekordy(-1)">← Poprzednia</button><span>Stronicowanie kursorowe</span><button class="btn ghost" ${!records.nextCursor?"disabled":""} onclick="vonHalskyPrzejdzRekordy(1)">Następna →</button></nav>
    </section>
  </div>`;
}
function vonHalskyAktualizujZamowieniaDOM(){
  if(!String(trasa()).startsWith("/admin/von-halsky/zamowienia"))return false;
  const current=document.querySelector("[data-vh-orders]");if(!current)return false;
  const template=document.createElement("template");template.innerHTML=vonHalskyOrdersWorkspaceHTML().trim();const next=template.content.firstElementChild;
  if(!next)return false;current.replaceWith(next);return true;
}
function vonHalskyOtworzSzczegolyRekordu(id){
  const item=(vonHalskyStan.records.items||[]).find(row=>vonHalskyRekordId(row)===String(id));if(!item)return;
  const shell=document.createElement("div");shell.className="von-halsky-record-dialog-shell";shell.innerHTML=`<section role="dialog" aria-modal="true" class="von-halsky-record-dialog"><header><div><small>Szczegóły rekordu API</small><h2>${esc(id)}</h2></div><button class="btn ghost" data-close>✕ Zamknij</button></header><main><dl>${Object.entries(item).filter(([key,value])=>!key.startsWith("_")&&value!==null&&value!==undefined&&typeof value!=="object").map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>${Array.isArray(item.orderLines)?`<h3>Pozycje zamówienia</h3><div class="von-halsky-record-lines">${item.orderLines.map(line=>`<article><b>${esc(line.offer?.product?.name||"Produkt")}</b><span>${Number(line.quantity)||1} szt.</span></article>`).join("")}</div>`:""}</main></section>`;shell.addEventListener("click",event=>{if(event.target===shell||event.target.closest("[data-close]"))shell.remove();});document.body.appendChild(shell);
}
function vonHalskyOtworzDecyzje(type,id){
  const item=(vonHalskyStan.records.items||[]).find(row=>vonHalskyRekordId(row)===String(id))||{},refund=type==="refund",claim=type==="claim";
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
