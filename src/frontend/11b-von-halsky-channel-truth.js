function vonHalskyStatystyki(){
  if(vonHalskyStan.productQueue.loaded){
    const summary=vonHalskyStan.productQueue.summary||{},orders=vonHalskyStan.dashboard?.orders||{},truth=vonHalskyStan.truth||{};
    return {wszystkie:Number(summary.total)||0,gotowe:Number(summary.ready)||0,braki:Number(summary.missing)||0,ean:0,aktywne:Number(truth.published)||0,zdalneRazem:Number(truth.total)||0,zdalneOczekuje:Number(truth.pending)||0,zdalneOdrzucone:Number(truth.rejected)||0,zdalneWstrzymane:Number(truth.closed)||0,lokalnieAktywne:Number(summary.selling)||0,publikowanie:Number(summary.publishing)||0,doWystawienia:Number(summary.publishable)||0,doPrzygotowania:Number(summary.preparation)||0,doAktualizacji:Number(summary.update_required)||0,doDzialania:(Number(summary.publishable)||0)+(Number(summary.preparation)||0)+(Number(summary.update_required)||0),wstrzymane:Number(summary.paused)||0,noweZamowienia:Number(orders.active)||0};
  }
  const products=vonHalskyProdukty(),rows=products.map(product=>vonHalskyOcenaProduktu(product));
  const orders=Array.isArray(vonHalskyStan.orders)?vonHalskyStan.orders:[];
  const stages=products.map((product,index)=>vonHalskyEtapOferty(product,rows[index]));
  const truth=vonHalskyStan.truth||{};
  return {wszystkie:rows.length,gotowe:rows.filter(x=>x.gotowy).length,braki:rows.filter(x=>!x.gotowy).length,ean:rows.filter(x=>x.ean).length,aktywne:Number(truth.published)||0,zdalneRazem:Number(truth.total)||0,zdalneOczekuje:Number(truth.pending)||0,zdalneOdrzucone:Number(truth.rejected)||0,zdalneWstrzymane:Number(truth.closed)||0,lokalnieAktywne:rows.filter(x=>String(x.offerStatus).toUpperCase()==="PUBLISHED"&&x.offerVerified).length,publikowanie:stages.filter(x=>x==="publikowanie").length,doWystawienia:stages.filter(x=>x==="wystawienie").length,doPrzygotowania:stages.filter(x=>x==="przygotowanie").length,doAktualizacji:stages.filter(x=>x==="aktualizacja").length,doDzialania:stages.filter(x=>["wystawienie","przygotowanie","aktualizacja"].includes(x)).length,wstrzymane:rows.filter(x=>!x.dostepny).length,noweZamowienia:orders.filter(order=>["CREATED","NEW","PAID"].includes(String(order.status||"").toUpperCase())).length};
}
function vonHalskyEtapySprzedazyHTML(){
  const summary=vonHalskyStan.productQueue?.summary||{},counts=vonHalskyStan.productQueue?.loaded?{wszystkie:Number(summary.total)||0,sprzedaz:Number(summary.selling)||0,publikowanie:Number(summary.publishing)||0,wystawienie:Number(summary.publishable)||0,przygotowanie:Number(summary.preparation)||0,aktualizacja:Number(summary.update_required)||0,wstrzymane:Number(summary.paused)||0}:{wszystkie:0,sprzedaz:0,publikowanie:0,wystawienie:0,przygotowanie:0,aktualizacja:0,wstrzymane:0};
  if(!vonHalskyStan.productQueue?.loaded)for(const product of vonHalskyProdukty()){const quality=vonHalskyOcenaProduktu(product);counts.wszystkie+=1;counts[vonHalskyEtapOferty(product,quality)]+=1;}
  const items=[["wszystkie","▦","Wszystkie"],["sprzedaz","✓","W sprzedaży"],["publikowanie","…","W publikacji"],["wystawienie","＋","Do wystawienia"],["przygotowanie","⚠","Do przygotowania"],["aktualizacja","↻","Do aktualizacji"],["wstrzymane","⏸","Wstrzymane"]].map(([value,icon,label])=>({value,icon,label,count:counts[value]||0}));
  return adminKanalEtapyHTML({id:"vonHalskyStageTitle",accent:"von-halsky",title:"Etap przygotowania kartotek",description:"Stan ofert sprzedawanych pokazuje osobny pasek API powyżej.",active:vonHalskyEtap,items,onSelect:"vonHalskyUstawEtap",dataAttribute:"data-vh-stage-filters",ariaLabel:"Filtry etapów kartotek Artway"});
}
function vonHalskyUstawEtap(value){vonHalskyEtap=value;vonHalskyZmienFiltr();}
function vonHalskyKanalPrawdyHTML(){
  const truth=vonHalskyStan.truth||{},status=vonHalskyStan.channelStatus||{};
  const verifiedAt=status.verifiedAt||vonHalskyStan.sync?.lastCatalogVerifiedAt||vonHalskyStan.sync?.lastCatalogAt;
  const pendingCommands=Number(status.operations?.pendingCommands??vonHalskyStan.sync?.pendingCommandCount??0)||0;
  const consistent=status.consistent!==false;
  return adminKanalStanApiHTML({channel:"InPost Von Halsky",accent:"von-halsky",connected:consistent,consistent,verifiedAt:verifiedAt?allegroDataTxt(verifiedAt):"",dataAttribute:"data-vh-channel-truth",metrics:[
    {label:"Oferty w API",value:Number(truth.total)||0,detail:"wszystkie stany z kanału"},
    {label:"W sprzedaży",value:Number(truth.published)||0,detail:"wyłącznie PUBLISHED",tone:"success"},
    {label:"Po stronie API",value:Number(truth.pending)||0,detail:"PENDING / PROCESSING",tone:"pending"},
    {label:"Odrzucone",value:Number(truth.rejected)||0,detail:"REJECTED / ERROR",tone:"danger"},
    {label:"Polecenia oczekujące",value:pendingCommands,detail:"osobno od liczby ofert"},
  ]});
}
