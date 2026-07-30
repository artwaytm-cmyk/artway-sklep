function vonHalskyStatystyki(){
  const products=vonHalskyProdukty(),rows=products.map(product=>vonHalskyOcenaProduktu(product));
  const orders=Array.isArray(vonHalskyStan.orders)?vonHalskyStan.orders:[];
  const stages=products.map((product,index)=>vonHalskyEtapOferty(product,rows[index]));
  const truth=vonHalskyStan.truth||{};
  return {wszystkie:rows.length,gotowe:rows.filter(x=>x.gotowy).length,braki:rows.filter(x=>!x.gotowy).length,ean:rows.filter(x=>x.ean).length,aktywne:Number(truth.published)||0,zdalneRazem:Number(truth.total)||0,zdalneOczekuje:Number(truth.pending)||0,zdalneOdrzucone:Number(truth.rejected)||0,zdalneWstrzymane:Number(truth.closed)||0,lokalnieAktywne:rows.filter(x=>String(x.offerStatus).toUpperCase()==="PUBLISHED"&&x.offerVerified).length,publikowanie:stages.filter(x=>x==="publikowanie").length,doWystawienia:stages.filter(x=>x==="wystawienie").length,doPrzygotowania:stages.filter(x=>x==="przygotowanie").length,doAktualizacji:stages.filter(x=>x==="aktualizacja").length,doDzialania:stages.filter(x=>["wystawienie","przygotowanie","aktualizacja"].includes(x)).length,wstrzymane:rows.filter(x=>!x.dostepny).length,noweZamowienia:orders.filter(order=>["CREATED","NEW","PAID"].includes(String(order.status||"").toUpperCase())).length};
}
function vonHalskyEtapySprzedazyHTML(){
  const counts={wszystkie:0,sprzedaz:0,publikowanie:0,wystawienie:0,przygotowanie:0,aktualizacja:0,wstrzymane:0};
  for(const product of vonHalskyProdukty()){const quality=vonHalskyOcenaProduktu(product);counts.wszystkie+=1;counts[vonHalskyEtapOferty(product,quality)]+=1;}
  const items=[["wszystkie","▦","Wszystkie"],["sprzedaz","✓","W sprzedaży"],["publikowanie","…","W publikacji"],["wystawienie","＋","Do wystawienia"],["przygotowanie","⚠","Do przygotowania"],["aktualizacja","↻","Do aktualizacji"],["wstrzymane","⏸","Wstrzymane"]];
  return `<section class="allegro-listing-metrics von-halsky-stage-filters" data-vh-stage-filters aria-label="Etapy kartotek Artway">${items.map(([value,icon,label])=>`<button class="${vonHalskyEtap===value?"active":""}" type="button" onclick="vonHalskyEtap=${jsArg(value)};vonHalskyStrona=1;renderuj()"><span>${icon}</span><b>${counts[value]||0}</b><small>${esc(label)}</small></button>`).join("")}</section>`;
}
function vonHalskyKanalPrawdyHTML(){
  const truth=vonHalskyStan.truth||{},status=vonHalskyStan.channelStatus||{},stats=vonHalskyStatystyki();
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
    <div class="von-halsky-channel-local"><b>Kolejka Artway:</b><span>${stats.doWystawienia} do wystawienia</span><span>${stats.doPrzygotowania} do przygotowania</span><span>${stats.doAktualizacji} do aktualizacji</span><small>Te liczby opisują kartoteki sklepu i nie są liczbą ofert sprzedawanych w Von Halsky.</small></div>
  </section>`;
}
