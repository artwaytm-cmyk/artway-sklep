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
