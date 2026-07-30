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
function vonHalskyPostepPrzygotowaniaHTML(){
  const queue=vonHalskyStan.preparationQueue||{},runtime=vonHalskyStan.agentRuntime||{},summary=queue.currentSummary||{};
  const batches=Array.isArray(queue.batches)?queue.batches:[],activeTask=queue.active||null;
  const tracked=batches.find(item=>item.id===activeTask?.batchId)||(vonHalskyStan.preparationBatchId?batches.find(item=>item.id===vonHalskyStan.preparationBatchId):null)||batches.find(item=>Number(item.pending||0)>0||Number(item.running||0)>0)||batches[0]||null;
  const pending=Math.max(0,Number(tracked?.pending??queue.pending)||0),running=activeTask?1:Math.max(0,Number(tracked?.running)||0);
  const completed=Math.max(0,Number(tracked?.completed??summary.completed)||0),attention=Math.max(0,Number(tracked?.attention??summary.attention)||0),waiting=Math.max(0,Number(tracked?.waitingProvider??summary.waitingProvider)||0),decisions=Math.max(0,Number(tracked?.decisionRequired??summary.decisionRequired)||0),errors=Math.max(0,Number(tracked?.failed??summary.failed)||0);
  const publicationItems=[
    ...(runtime.currentWork?.channel==="vonHalsky"?[runtime.currentWork]:[]),
    ...((runtime.publication?.pending||[]).filter(item=>item.channel==="vonHalsky")),
  ].filter((item,index,list)=>list.findIndex(candidate=>candidate.id===item.id)===index);
  const publishing=publicationItems.filter(item=>["running","pending","attention","waiting_provider","failed"].includes(String(item.status))).length;
  const total=Math.max(0,Number(tracked?.total)||pending+running+completed+attention+waiting+decisions+errors);
  const done=completed+attention+waiting+decisions+errors,started=Boolean(total||queue.running||publishing||activeTask),active=Boolean(queue.running||publishing||activeTask);
  const percent=total?Math.min(100,Math.round(done/total*100)):publishing?70:0;
  const results=(Array.isArray(queue.recent)?queue.recent:[]).filter(item=>!tracked||item.batchId===tracked.id).slice(0,8);
  const activeProduct=activeTask?{...(vonHalskyProdukty().find(item=>String(item.id)===String(activeTask.productId))||{}),...activeTask}:null;
  const stateClass=active?"is-running":started?(errors?"has-errors":"is-complete"):"is-idle";
  const headline=activeTask?`Przygotowanie na serwerze • ${done+1} z ${Math.max(total,done+1)}`:publishing?`${publishing} ${publishing===1?"oferta jest":"oferty są"} w publikacji`:started?`Ostatnia partia: ${done} z ${total}`:"Proces jest gotowy";
  const detail=activeTask?`${activeProduct?.nazwa||activeProduct?.name||activeTask.productId||"Produkt"} • ${String(activeTask.requestedBy||"").includes("codex")?"plan Codex wykonują agenci pomocniczy":"bezpieczny przepływ serwerowy"} • praca trwa niezależnie od tej przeglądarki`:publishing?"API kanału przetwarza wysłane karty. Status zmieni się dopiero po potwierdzeniu zdalnym.":started?`Potwierdzone ${completed} • uwaga ${attention+waiting+decisions} • błędy ${errors}`:"Zaznacz produkty i zleć przygotowanie. Codex koordynuje zadanie, specjaliści uzupełniają treść, a serwer zapisuje każdy wynik w centralnej kartotece.";
  return `<section class="von-halsky-preparation-progress ${stateClass}" data-vh-preparation-progress aria-live="polite">
    <header><div class="von-halsky-preparation-progress-title"><span>${active?"⟳":started&&!errors?"✓":started?"!":"▶"}</span><div><small>Trwały proces serwerowy • widoczny na każdym urządzeniu</small><h3>${esc(headline)}</h3><p>${esc(detail)}</p></div></div><strong data-vh-progress-percent>${percent}%</strong></header>
    <div class="von-halsky-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total||100}" aria-valuenow="${done}"><i style="width:${percent}%"></i></div>
    <div class="von-halsky-progress-controls"><span>${active?"Kolejka PostgreSQL działa na serwerze — możesz zamknąć tę kartę.":"Ostatni stan pochodzi bezpośrednio z serwera."}</span><button class="btn ghost" type="button" onclick="vonHalskyOdswiezProces()">↻ Odśwież proces</button></div>
    <div class="von-halsky-progress-stages"><div class="${activeTask||started?"active":""}"><span>1</span><b>Codex</b><small>ustala kolejność i kryteria</small></div><div class="${activeTask||started?"active":""}"><span>2</span><b>Agenci pomocniczy</b><small>treść, kategoria, GPSR</small></div><div class="${done?"active":""}"><span>3</span><b>Zapis centralny</b><small>PostgreSQL + odczyt kontrolny</small></div><div class="${publishing?"active manual":""}"><span>4</span><b>Publikacja API</b><small>${publishing?`${publishing} w toku`:"po decyzji administratora"}</small></div></div>
    ${started?`<div class="von-halsky-progress-summary"><span><b>${pending}</b> oczekuje</span><span class="${running?"attention":""}"><b>${running}</b> wykonywane</span><span class="ok"><b>${completed}</b> potwierdzone</span><span class="attention"><b>${attention+waiting+decisions}</b> wymaga danych</span><span class="${errors?"error":""}"><b>${errors}</b> błędów</span><span><b>${publishing}</b> publikowane</span></div>`:""}
    ${activeProduct?`<div class="von-halsky-progress-now"><span>●</span><div><small>Wykonywane teraz na serwerze</small><b>${esc(activeProduct.nazwa||activeProduct.name||activeProduct.productId)}</b><em>pełny przegląd edytora → sklep → Allegro → Von Halsky</em></div><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(activeProduct.productId||activeProduct.id||"")}">Edytor</a></div>`:""}
    ${publicationItems.length?`<div class="von-halsky-progress-publications">${publicationItems.slice(0,6).map(item=>`<article><span>↗</span><div><b>${esc(item.productName||item.productId||"Oferta")}</b><small>${esc(item.message||item.phase||"Oczekuje na odpowiedź API")}</small></div><em>${esc(item.status||"pending")}</em></article>`).join("")}</div>`:""}
    ${results.length?`<div class="von-halsky-progress-results">${results.map(item=>{const fields=vonHalskyNazwyZapisanychPol(item.savedFields),ok=item.status==="completed";return `<article class="${ok?"saved":"error"}"><span>${ok?"✓":"!"}</span><div><b>${esc(item.name||item.productId||"Produkt")}</b><small>${ok?`Zapis centralny potwierdzony${fields.length?` • ${fields.slice(0,6).map(esc).join(", ")}`:""}`:esc(item.error||(item.missing||[]).join(", ")||"Wymaga danych lub decyzji")}</small></div><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(item.productId||"")}">Edytor</a></article>`;}).join("")}</div>`:""}
  </section>`;
}
function vonHalskyAktualizujPostepDOM(){
  const current=document.querySelector("[data-vh-preparation-progress]");
  if(current)current.outerHTML=vonHalskyPostepPrzygotowaniaHTML();
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
  const requested=[...new Set((Array.isArray(productIds)?productIds:[productIds]).map(String).filter(Boolean))].slice(0,50);
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
    toast(`Przekazano ${ids.length} ${ids.length===1?"produkt":"produktów"} do trwałej kolejki serwerowej ✅`);
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
