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
  const scrollX=window.scrollX,scrollY=window.scrollY;
  current.replaceWith(next);
  requestAnimationFrame(()=>window.scrollTo(scrollX,scrollY));
  return true;
}
function vonHalskyAktualizujWystawianieDOM({results=true,stages=true,truth=true}={}){
  if(!String(trasa()).startsWith("/admin/von-halsky/wystawianie"))return false;
  vonHalskyAktualizujPostepDOM();
  const truthChanged=truth&&vonHalskyPodmienWyspe("[data-vh-channel-truth]",vonHalskyKanalPrawdyHTML());
  const stagesChanged=stages&&vonHalskyPodmienWyspe("[data-vh-stage-filters]",vonHalskyEtapySprzedazyHTML());
  const resultsChanged=results&&vonHalskyPodmienWyspe("[data-vh-results-region]",vonHalskyWynikiHTML());
  return truthChanged||stagesChanged||resultsChanged;
}
async function vonHalskyPobierzLekkiStatus(){
  const data=await chmura("von-halsky-status",{timeout:15000});
  const revision=String(data.sync?.reconciliationRevision||data.sync?.lastCatalogVerifiedAt||data.updatedAt||"");
  const revisionChanged=Boolean(revision&&revision!==vonHalskyOstatniaRewizjaKanalu);
  if(data.sync)vonHalskyStan.sync={...vonHalskyStan.sync,...data.sync};
  if(data.truth)vonHalskyStan.truth=data.truth;
  if(data.channelStatus)vonHalskyStan.channelStatus=data.channelStatus;
  if(data.config)vonHalskyStan.config=data.config;
  let visibleProductsChanged=false;
  if(revisionChanged){
    vonHalskyUniewaznijWidokProduktow();
    const changedIds=[...new Set((data.sync?.lastChangedProductIds||[]).map(String).filter(Boolean))];
    if(String(trasa()).startsWith("/admin/von-halsky/wystawianie")){
      // Zmiana rewizji oznacza realną mutację, nie kolejny odczyt czasu.
      // Jeden odczyt kolejki odświeża stronę, liczniki i właściwy filtr.
      vonHalskyStan.productQueue.queryKey="";
      await vonHalskyPobierzKolejkeProduktow({force:true});
      visibleProductsChanged=changedIds.length>0;
    }
    vonHalskyOstatniaRewizjaKanalu=revision;
  }
  return {...data,revisionChanged,visibleProductsChanged};
}
function vonHalskyNastepnyInterwal(){
  if(document.hidden)return 60000;
  const queue=vonHalskyStan.preparationQueue||{},work=vonHalskyStan.agentRuntime?.currentWork||{};
  return queue.running||queue.active||work.status==="running"?15000:60000;
}
function vonHalskyUruchomOdswiezanieNaZywo(){
  if(vonHalskyLiveTimer)return;
  const tick=async()=>{
    vonHalskyLiveTimer=null;
    try{
      if(!String(trasa()).startsWith("/admin/von-halsky")||document.hidden||vonHalskyStan.loading||vonHalskyOdswiezenieWToku)return;
      vonHalskyOdswiezenieWToku=true;
      const previousCompletion=String(vonHalskyStan.preparationQueue?.recent?.[0]?.completedAt||"");
      await vonHalskyPobierzStanProcesow();
      const signature=vonHalskySygnaturaProcesu(),changed=signature!==vonHalskyProcesSygnatura;
      if(changed){
        const queue=vonHalskyStan.preparationQueue||{},completion=String(queue.recent?.[0]?.completedAt||"");
        const completedNow=Boolean(completion&&completion!==previousCompletion);
        const ids=completedNow?[queue.recent?.[0]?.productId].filter(Boolean):[];
        if(completedNow&&ids.length){
          const catalog=await chmura("product-catalog-query",{params:{audience:"admin",ids:[...new Set(ids)].join(","),page:1,limit:50},timeout:30000});
          vonHalskyZastosujAktualizacjeProduktow((catalog?.items||[]).map(product=>({productId:product.id,product})));
          vonHalskyAktualizujWystawianieDOM();
        }else{
          // Postęp procesu zmienia się często. Aktualizujemy tylko jego mały
          // panel, aby tabela, filtry, zaznaczenie i przewinięcie nie skakały.
          vonHalskyAktualizujWystawianieDOM({results:false,stages:false,truth:false});
        }
        vonHalskyProcesSygnatura=signature;
      }
      if(Date.now()-vonHalskyOstatniOdczytKanalu>=60000){
        vonHalskyOstatniOdczytKanalu=Date.now();
        const status=await vonHalskyPobierzLekkiStatus();
        vonHalskyAktualizujWystawianieDOM({
          results:status.revisionChanged===true,
          stages:status.revisionChanged===true,
          truth:true,
        });
      }
    }catch(error){console.warn("von_halsky_live_refresh",error);}
    finally{
      vonHalskyOdswiezenieWToku=false;
      if(!vonHalskyLiveTimer)vonHalskyLiveTimer=setTimeout(tick,vonHalskyNastepnyInterwal());
    }
  };
  vonHalskyLiveTimer=setTimeout(tick,15000);
}
