function vonHalskySygnaturaProcesu(){
  const queue=vonHalskyStan.preparationQueue||{},runtime=vonHalskyStan.agentRuntime||{},active=queue.active||{},recent=Array.isArray(queue.recent)?queue.recent:[],work=runtime.currentWork||{},publication=runtime.publication||{};
  const truth=vonHalskyStan.truth||{};
  return [
    active.id,active.productId,queue.pending,
    recent[0]?.id,recent[0]?.status,recent[0]?.completedAt,
    work.id,work.status,work.phase,work.updatedAt,
    publication.counts?.pending,publication.counts?.attention,publication.counts?.waitingProvider,
    truth.total,truth.published,truth.pending,truth.rejected,truth.closed,
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
function vonHalskyPodmienWyspe(selector,html){
  const current=document.querySelector(selector);
  const active=document.activeElement,editing=active?.closest?.(selector)&&(
    /^(SELECT|TEXTAREA)$/.test(active.tagName)
    || (active.tagName==="INPUT"&&!["checkbox","radio","button"].includes(String(active.type||"text").toLowerCase()))
  );
  if(!current||editing)return false;
  const template=document.createElement("template");
  template.innerHTML=String(html||"").trim();
  const next=template.content.firstElementChild;
  if(!next)return false;
  current.replaceWith(next);
  return true;
}
function vonHalskyAktualizujWystawianieDOM(){
  if(!String(trasa()).startsWith("/admin/von-halsky/wystawianie"))return false;
  vonHalskyAktualizujPostepDOM();
  const truth=vonHalskyPodmienWyspe("[data-vh-channel-truth]",vonHalskyKanalPrawdyHTML());
  const stages=vonHalskyPodmienWyspe("[data-vh-stage-filters]",vonHalskyEtapySprzedazyHTML());
  const results=vonHalskyPodmienWyspe("[data-vh-results-region]",vonHalskyWynikiHTML());
  return truth||stages||results;
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
        vonHalskyAktualizujWystawianieDOM();
        vonHalskyProcesSygnatura=signature;
      }
      const interval=Math.max(15,Number(vonHalskyStan.settings?.syncIntervalMinutes)||15)*60000;
      if(Date.now()-vonHalskyOstatniOdczytKanalu>=interval){
        vonHalskyOstatniOdczytKanalu=Date.now();
        await vonHalskyLaduj(true,{render:false,processes:false});
        vonHalskyAktualizujWystawianieDOM();
      }
      const pendingRemote=Number(vonHalskyStan.truth?.pending||0);
      if(pendingRemote>0&&Date.now()>=vonHalskyNastepneUzgodnienieAt){
        vonHalskyNastepneUzgodnienieAt=Date.now()+60000;
        await vonHalskyUzgodnijKatalog({silent:true,render:false});
        vonHalskyAktualizujWystawianieDOM();
      }
    }catch(error){console.warn("von_halsky_live_refresh",error);}
    finally{vonHalskyOdswiezenieWToku=false;}
  },5000);
}
