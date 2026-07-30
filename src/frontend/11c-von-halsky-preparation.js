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
  const progress=vonHalskyStan.preparation||{},started=Number(progress.total)>0,active=progress.active===true,paused=progress.paused===true;
  const total=Math.max(0,Number(progress.total)||0),completed=Math.min(total,Math.max(0,Number(progress.completed)||0));
  const percent=total?Math.round(completed/total*100):0,results=Array.isArray(progress.results)?progress.results:[];
  const ready=results.filter(item=>item.status==="ready").length,attention=results.filter(item=>["requires_data","retry"].includes(String(item.status))).length,errors=results.filter(item=>item.status==="error"||item.saved===false).length;
  const stateClass=paused?"is-paused":active?"is-running":started?(errors?"has-errors":"is-complete"):"is-idle";
  const headline=paused?`Wstrzymano po ${completed} z ${total}`:active?`Przygotowuję ${Math.min(total,Math.max(1,Number(progress.currentIndex)||1))} z ${total}`:started?`Zakończono ${completed} z ${total}`:"Proces jest gotowy";
  const detail=paused?`Pozostało ${Math.max(0,total-completed)} produktów. Filtry i wyniki są zachowane.`:active?`${progress.currentName||"Produkt"} • dopasowanie, uzupełnienie i odczyt kontrolny na serwerze`:started?`Gotowe ${ready} • wymagają danych ${attention} • błędy ${errors}`:"Zaznacz produkty i uruchom Agenta. Najsłabsze kartoteki są wykonywane jako pierwsze, a każdy zapis jest potwierdzany osobno.";
  const recent=results.slice(-6).reverse();
  return `<section class="von-halsky-preparation-progress ${stateClass}" data-vh-preparation-progress aria-live="polite">
    <header><div class="von-halsky-preparation-progress-title"><span>${active?"⟳":started&&!errors?"✓":started?"!":"▶"}</span><div><small>Rzeczywisty postęp przygotowania</small><h3>${esc(headline)}</h3><p>${esc(detail)}</p></div></div><strong data-vh-progress-percent>${percent}%</strong></header>
    <div class="von-halsky-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${total||100}" aria-valuenow="${completed}"><i style="width:${percent}%"></i></div>
    ${active?`<div class="von-halsky-progress-controls"><span>${paused?"Proces czeka na wznowienie":progress.pauseRequested?"Kończę bieżący produkt i wstrzymuję":"Kolejka działa na serwerze produkt po produkcie"}</span><div>${paused?`<button class="btn" type="button" onclick="vonHalskyWznowPrzygotowanie()">▶ Wznów</button>`:`<button class="btn ghost" type="button" ${progress.pauseRequested?"disabled":""} onclick="vonHalskyWstrzymajPrzygotowanie()">Ⅱ Wstrzymaj po bieżącym</button>`}<button class="btn ghost" type="button" onclick="vonHalskyZatrzymajPrzygotowanie()">Zakończ po bieżącym</button></div></div>`:""}
    <div class="von-halsky-progress-stages"><div class="${active||started?"active":""}"><span>1</span><b>Dopasowanie</b><small>tożsamość, kategoria, GPSR</small></div><div class="${active||started?"active":""}"><span>2</span><b>Uzupełnienie</b><small>nazwa i oba opisy</small></div><div class="${completed?"active":""}"><span>3</span><b>Zapis centralny</b><small>potwierdzony odczytem</small></div><div class="${!active&&started&&ready?"active manual":""}"><span>4</span><b>Publikacja</b><small>osobna decyzja administratora</small></div></div>
    ${started?`<div class="von-halsky-progress-summary"><span><b>${completed}</b> zapisanych odpowiedzi</span><span class="ok"><b>${ready}</b> gotowych</span><span class="attention"><b>${attention}</b> do uzupełnienia</span><span class="${errors?"error":""}"><b>${errors}</b> błędów</span></div>`:""}
    ${recent.length?`<div class="von-halsky-progress-results">${recent.map(item=>{const fields=vonHalskyNazwyZapisanychPol(item.savedFields),ok=item.saved!==false&&item.status!=="error",category=item.category||item.categorySuggestion;return `<article class="${ok?"saved":"error"}"><span>${ok?"✓":"!"}</span><div><b>${esc(item.name||item.productId||"Produkt")}</b><small>${ok?`Zapis centralny potwierdzony${fields.length?` • ${fields.slice(0,6).map(esc).join(", ")}`:""}`:esc(item.error||"Nie potwierdzono zapisu")}</small>${category?.path?`<em>Kategoria: ${esc(category.path)} • ${esc(vonHalskyZrodloKategorii(category.source))}${Number.isFinite(Number(category.confidence))?` • ${Math.round(Number(category.confidence)*100)}%`:""}</em>`:""}${(item.issues||[]).length?`<em>Pozostało: ${item.issues.slice(0,5).map(esc).join(" • ")}</em>`:""}</div><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(item.productId||"")}">Edytor</a></article>`;}).join("")}</div>`:""}
  </section>`;
}
function vonHalskyAktualizujPostepDOM(){
  const current=document.querySelector("[data-vh-preparation-progress]");
  if(current)current.outerHTML=vonHalskyPostepPrzygotowaniaHTML();
}
function vonHalskyWstrzymajPrzygotowanie(){
  const progress=vonHalskyStan.preparation||{};
  if(!progress.active||progress.paused)return;
  progress.pauseRequested=true;vonHalskyAktualizujPostepDOM();
}
function vonHalskyWznowPrzygotowanie(){
  const progress=vonHalskyStan.preparation||{};
  progress.pauseRequested=false;progress.paused=false;
  const resume=vonHalskyWznowProces;vonHalskyWznowProces=null;
  if(typeof resume==="function")resume();
  vonHalskyAktualizujPostepDOM();
}
function vonHalskyZatrzymajPrzygotowanie(){
  const progress=vonHalskyStan.preparation||{};
  if(!progress.active)return;
  progress.cancelRequested=true;progress.pauseRequested=false;
  const resume=vonHalskyWznowProces;vonHalskyWznowProces=null;
  if(typeof resume==="function")resume();
  vonHalskyAktualizujPostepDOM();
}
async function vonHalskyPrzygotujAgentem(productIds=[]){
  const requested=[...new Set((Array.isArray(productIds)?productIds:[productIds]).map(String).filter(Boolean))].slice(0,50);
  const productList=vonHalskyProdukty(),products=new Map(productList.map(product=>[String(product.id),product]));
  const ids=requested.sort((left,right)=>{
    const leftQuality=vonHalskyOcenaProduktu(products.get(left)||{}),rightQuality=vonHalskyOcenaProduktu(products.get(right)||{});
    return leftQuality.wynik-rightQuality.wynik||rightQuality.braki.length-leftQuality.braki.length||String(left).localeCompare(String(right));
  });
  if(!ids.length||vonHalskyStan.operation)return;
  const filterSnapshot=vonHalskyMigawkaFiltrow();
  vonHalskyStan.preparation={active:true,paused:false,pauseRequested:false,cancelRequested:false,total:ids.length,completed:0,currentIndex:0,currentProductId:"",currentName:"",startedAt:new Date().toISOString(),finishedAt:"",results:[],error:""};
  vonHalskyStan.operation="agent";renderuj();
  try{
    for(let index=0;index<ids.length;index+=1){
      const progress=vonHalskyStan.preparation;
      if(progress.cancelRequested)break;
      const productId=ids[index],product=products.get(productId)||{};
      vonHalskyAgentWToku.clear();vonHalskyAgentWToku.add(productId);
      Object.assign(progress,{currentIndex:index+1,currentProductId:productId,currentName:String(product.nazwa||product.name||productId)});
      vonHalskyAktualizujPostepDOM();
      let result;
      try{
        const data=await chmura("von-halsky-agent-prepare",{method:"POST",body:{productIds:[productId]},timeout:180000});
        result=(Array.isArray(data.results)?data.results[0]:null)||{productId,name:progress.currentName,status:"error",saved:false,error:"Serwer nie zwrócił potwierdzenia produktu."};
      }catch(error){
        result={productId,name:progress.currentName,status:"error",saved:false,error:String(error?.message||error)};
      }
      progress.results.push(result);progress.completed=index+1;
      if(result?.product)vonHalskyZastosujAktualizacjeProduktow([{productId,product:result.product}]);
      vonHalskyAgentWToku.delete(productId);
      vonHalskyPrzywrocFiltry(filterSnapshot);
      if(String(trasa()).startsWith("/admin/von-halsky"))renderuj();
      if(progress.pauseRequested&&!progress.cancelRequested&&index<ids.length-1){
        progress.paused=true;vonHalskyAktualizujPostepDOM();
        await new Promise(resolve=>{vonHalskyWznowProces=resolve;});
        progress.paused=false;
      }
    }
    const results=vonHalskyStan.preparation.results,errors=results.filter(item=>item.status==="error"||item.saved===false),ready=results.filter(item=>item.status==="ready").length,requiresData=results.filter(item=>["requires_data","retry"].includes(String(item.status))).length;
    toast(`Agent Von Halsky: gotowe ${ready}, wymagają danych ${requiresData}${errors.length?`, błędy ${errors.length}`:""} ${errors.length?"⚠️":"✅"}`);
  }finally{
    const cancelled=vonHalskyStan.preparation.cancelRequested===true;
    vonHalskyAgentWToku.clear();vonHalskyStan.preparation.active=false;vonHalskyStan.preparation.currentProductId="";vonHalskyStan.preparation.finishedAt=new Date().toISOString();vonHalskyStan.operation="";
    vonHalskyStan.preparation.paused=false;vonHalskyStan.preparation.pauseRequested=false;vonHalskyWznowProces=null;
    vonHalskyPrzywrocFiltry(filterSnapshot);
    if(cancelled)toast(`Zakończono kolejkę po ${vonHalskyStan.preparation.completed} zapisanych produktach.`);
    if(String(trasa()).startsWith("/admin/von-halsky"))renderuj();
  }
}
function vonHalskyPrzygotujWybraneAgentem(){
  return vonHalskyPrzygotujAgentem([...vonHalskyZaznaczone]);
}
