function vonHalskySygnaturaProcesu(){
  const queue=vonHalskyStan.preparationQueue||{},runtime=vonHalskyStan.agentRuntime||{},active=queue.active||{},recent=Array.isArray(queue.recent)?queue.recent:[],work=runtime.currentWork||{},publication=runtime.publication||{};
  return [
    active.id,active.productId,queue.pending,
    recent[0]?.id,recent[0]?.status,recent[0]?.completedAt,
    work.id,work.status,work.phase,work.updatedAt,
    publication.counts?.pending,publication.counts?.attention,publication.counts?.waitingProvider,
  ].join("|");
}
async function vonHalskyPobierzStanProcesow(){
  const [queueData,runtimeData]=await Promise.all([
    chmura("allegro-preparation-queue-status",{timeout:20000}),
    chmura("agent-runtime-status",{timeout:20000}),
  ]);
  vonHalskyStan.preparationQueue=queueData?.queue||vonHalskyStan.preparationQueue;
  vonHalskyStan.agentRuntime=runtimeData?.runtime||vonHalskyStan.agentRuntime;
  return {queue:vonHalskyStan.preparationQueue,runtime:vonHalskyStan.agentRuntime};
}
function vonHalskyAktywnePoleWidoku(){
  const active=document.activeElement;
  return active&&active.closest?.(".von-halsky-listing-workspace")&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
}
function vonHalskyOdmalujWystawianieBezSkoku(){
  if(!String(trasa()).startsWith("/admin/von-halsky/wystawianie"))return false;
  if(vonHalskyAktywnePoleWidoku())return false;
  const current=document.querySelector(".von-halsky-listing-workspace");
  if(!current)return false;
  const x=window.scrollX,y=window.scrollY;
  current.outerHTML=vonHalskyWystawianieHTML();
  requestAnimationFrame(()=>window.scrollTo(x,y));
  return true;
}
function vonHalskyUruchomOdswiezanieNaZywo(){
  if(vonHalskyLiveTimer)return;
  vonHalskyLiveTimer=setInterval(async()=>{
    if(!String(trasa()).startsWith("/admin/von-halsky")||vonHalskyStan.loading||vonHalskyOdswiezenieWToku)return;
    vonHalskyOdswiezenieWToku=true;
    try{
      await vonHalskyPobierzStanProcesow();
      const signature=vonHalskySygnaturaProcesu(),changed=signature!==vonHalskyProcesSygnatura;
      if(changed){
        const queue=vonHalskyStan.preparationQueue||{},ids=[queue.active?.productId,...(queue.recent||[]).slice(0,12).map(item=>item.productId)].filter(Boolean);
        if(ids.length){
          const catalog=await chmura("product-catalog-query",{params:{audience:"admin",ids:[...new Set(ids)].join(","),page:1,limit:50},timeout:30000});
          vonHalskyZastosujAktualizacjeProduktow((catalog?.items||[]).map(product=>({productId:product.id,product})));
        }
        vonHalskyAktualizujPostepDOM();
        if(vonHalskyOdmalujWystawianieBezSkoku())vonHalskyProcesSygnatura=signature;
        else if(!String(trasa()).startsWith("/admin/von-halsky/wystawianie"))vonHalskyProcesSygnatura=signature;
      }
      const interval=Math.max(15,Number(vonHalskyStan.settings?.syncIntervalMinutes)||15)*60000;
      if(Date.now()-vonHalskyOstatniOdczytKanalu>=interval){
        vonHalskyOstatniOdczytKanalu=Date.now();
        await vonHalskyLaduj(true,{render:false,processes:false});
      }
      if(Number(vonHalskyStan.sync?.pendingOfferCount||0)>0)await vonHalskyUzgodnijKatalog({silent:true,render:false});
    }catch(error){console.warn("von_halsky_live_refresh",error);}
    finally{vonHalskyOdswiezenieWToku=false;}
  },4000);
}
