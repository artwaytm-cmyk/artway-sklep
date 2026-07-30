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
  const items=[["wszystkie","▦","Wszystkie"],["sprzedaz","✓","W sprzedaży"],["publikowanie","…","W publikacji"],["wystawienie","＋","Do wystawienia"],["przygotowanie","⚠","Do przygotowania"],["aktualizacja","↻","Do aktualizacji"],["wstrzymane","⏸","Wstrzymane"]];
  return `<section class="von-halsky-stage-panel" data-vh-stage-filters aria-labelledby="vonHalskyStageTitle"><header><div><small>Wewnętrzna kolejka Artway-TM</small><h3 id="vonHalskyStageTitle">Etap przygotowania kartotek</h3></div><span>Stan ofert sprzedawanych pokazuje osobny pasek API powyżej.</span></header><div class="von-halsky-stage-filters" role="toolbar" aria-label="Filtry etapów kartotek Artway">${items.map(([value,icon,label])=>`<button class="${vonHalskyEtap===value?"active":""}" type="button" aria-pressed="${vonHalskyEtap===value?"true":"false"}" onclick="vonHalskyEtap=${jsArg(value)};vonHalskyZmienFiltr()"><span aria-hidden="true">${icon}</span><b>${counts[value]||0}</b><small>${esc(label)}</small></button>`).join("")}</div></section>`;
}
function vonHalskyKanalPrawdyHTML(){
  const truth=vonHalskyStan.truth||{},status=vonHalskyStan.channelStatus||{};
  const verifiedAt=status.verifiedAt||vonHalskyStan.sync?.lastCatalogVerifiedAt||vonHalskyStan.sync?.lastCatalogAt;
  const pendingCommands=Number(status.operations?.pendingCommands??vonHalskyStan.sync?.pendingCommandCount??0)||0;
  const consistent=status.consistent!==false;
  return `<section class="von-halsky-channel-truth ${consistent?"is-consistent":"is-warning"}" data-vh-channel-truth>
    <div class="von-halsky-channel-truth-head"><div><span>Stan potwierdzony bezpośrednio przez API</span><h3>InPost Von Halsky — faktyczny stan kanału</h3></div><div><span class="lvl ${consistent?"lvl-ok":"lvl-ostrzezenie"}">${consistent?"spójny":"wymaga uzgodnienia"}</span><small>Odczyt: ${esc(verifiedAt?allegroDataTxt(verifiedAt):"jeszcze nie wykonano")}</small></div></div>
    <div class="von-halsky-channel-truth-grid">
      <article><small>Oferty w API</small><b>${Number(truth.total)||0}</b><span>wszystkie stany z kanału</span></article>
      <article class="success"><small>W sprzedaży</small><b>${Number(truth.published)||0}</b><span>wyłącznie PUBLISHED</span></article>
      <article class="pending"><small>Po stronie API</small><b>${Number(truth.pending)||0}</b><span>PENDING / PROCESSING</span></article>
      <article class="danger"><small>Odrzucone</small><b>${Number(truth.rejected)||0}</b><span>REJECTED / ERROR</span></article>
      <article><small>Polecenia oczekujące</small><b>${pendingCommands}</b><span>osobno od liczby ofert</span></article>
    </div>
  </section>`;
}
