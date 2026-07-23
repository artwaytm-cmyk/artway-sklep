let infaktWysylkiStan={loaded:false,loading:false,error:"",items:[],billing:{groups:[],pendingMonthly:0,carrierPendingGross:0,commissionPendingGross:0,customerPendingGross:0},updatedAt:null};
let infaktWysylkiSzukaj="",infaktWysylkiFiltr="wszystkie";

async function infaktWysylkiLaduj(force=false,cicho=false){
  if(infaktWysylkiStan.loading||(!force&&infaktWysylkiStan.loaded))return;
  infaktWysylkiStan={...infaktWysylkiStan,loading:true,error:""};
  try{
    const d=await chmura("inpost-service-shipments",{params:{limit:500},timeout:30000});
    infaktWysylkiStan={...infaktWysylkiStan,loaded:true,loading:false,items:Array.isArray(d.items)?d.items:[],billing:d.billing||{groups:[]},updatedAt:d.updatedAt||null,error:""};
    if(!cicho)toast(`Rozliczenia InPost odświeżone • ${infaktWysylkiStan.items.length} nadań`);
  }catch(e){
    infaktWysylkiStan={...infaktWysylkiStan,loaded:true,loading:false,error:e.message||String(e)};
    if(!cicho)toast("⚠️ Rozliczenia InPost: "+infaktWysylkiStan.error);
  }
  if(trasa()==="/admin/infakt/wysylki")renderuj();
}
async function infaktWysylkiFakturaMiesieczna(month,clientKey){
  try{
    const d=await chmura("inpost-service-bill",{method:"POST",body:{month,clientKey},timeout:60000});
    toast(d.invoice?.duplicatePrevented?"Dokument miesięczny już istnieje":`Przekazano ${d.count||0} nadań do jednej faktury inFakt ✅`);
    await Promise.all([infaktWysylkiLaduj(true,true),infaktLaduj(true,true)]);
    renderuj();
  }catch(e){toast("⚠️ Faktura za nadania: "+(e.message||e));}
}
function infaktWysylkiStatusHTML(item){
  const link=item.billing?.link,status=String(link?.status||item.billing?.status||"");
  if(status==="created")return `<span class="lvl lvl-ok">wystawiona ${esc(link?.invoiceNumber||"")}</span>`;
  if(status==="processing")return '<span class="lvl lvl-info">inFakt przetwarza</span>';
  if(status==="pending")return '<span class="lvl lvl-ostrzezenie">do FV miesięcznej</span>';
  if(status==="error")return `<span class="lvl lvl-blad">błąd</span>`;
  return '<span class="lvl">bez dokumentu</span>';
}
function infaktWysylkiLista(){
  const q=normalizujSzukanyTekst(infaktWysylkiSzukaj),terms=q.split(" ").filter(Boolean);
  return (infaktWysylkiStan.items||[]).filter(item=>{
    if(item.billing?.mode==="none")return false;
    const status=String(item.billing?.link?.status||item.billing?.status||"");
    if(infaktWysylkiFiltr==="oczekuje"&&!["pending","awaiting_invoice","error"].includes(status))return false;
    if(infaktWysylkiFiltr==="w_toku"&&status!=="processing")return false;
    if(infaktWysylkiFiltr==="wystawione"&&status!=="created")return false;
    const text=normalizujSzukanyTekst([item.reference,item.trackingNumber,item.receiver?.companyName,item.receiver?.firstName,item.receiver?.lastName,item.receiver?.email,item.receiver?.taxCode,item.billing?.month].join(" "));
    return !terms.some(term=>!text.includes(term));
  });
}
function infaktWysylkiInpostPanelHTML(){
  if(infaktWysylkiStan.loading&&!infaktWysylkiStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram rejestr rozliczeń nadań…</div></div>';
  const billing=infaktWysylkiStan.billing||{},groups=billing.groups||[],rows=infaktWysylkiLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(infaktWysylkiSzukaj)}" placeholder="Firma, NIP, e-mail, referencja lub numer nadania…" oninput="infaktWysylkiSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="infaktWysylkiFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie rozliczenia</option><option value="oczekuje" ${infaktWysylkiFiltr==="oczekuje"?"selected":""}>Oczekujące</option><option value="w_toku" ${infaktWysylkiFiltr==="w_toku"?"selected":""}>Przetwarzane</option><option value="wystawione" ${infaktWysylkiFiltr==="wystawione"?"selected":""}>Wystawione</option></select></label><button class="btn ghost" onclick="infaktWysylkiSzukaj='';infaktWysylkiFiltr='wszystkie';renderuj()">Wyczyść</button>`;
  return `<div class="module-page-stack infakt-shipping-billing">
    <section class="orders-stat-grid">
      <div class="order-stat-card"><span>📮</span><b>${infaktWysylkiStan.items.length}</b><small>nadań w rejestrze</small></div>
      <div class="order-stat-card hot"><span>🧾</span><b>${billing.pendingMonthly||0}</b><small>do FV miesięcznej</small></div>
      <div class="order-stat-card"><span>📦</span><b>${zl(billing.carrierPendingGross||0)}</b><small>kosztów nadań</small></div>
      <div class="order-stat-card money"><span>💰</span><b>${zl(billing.customerPendingGross||0)}</b><small>łącznie na FV klientów</small></div>
    </section>
    ${infaktWysylkiStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(infaktWysylkiStan.error)}</div>`:""}
    <section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Rozliczenia firmowe Artway‑TM</span><h2>FV miesięczne za nadania</h2><p class="order-detail-lead">Jedna faktura klienta obejmuje koszt każdego nadania według Twojej umowy InPost oraz prowizję Artway‑TM. InPost nie jest wystawcą dokumentu.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/wysylki/inpost">Nowe nadanie</a><button class="btn ghost" onclick="infaktWysylkiLaduj(true,false)">↻ Odśwież</button></div></div>
      <div class="inpost-monthly-grid">${groups.map(group=>`<article class="${group.incompletePrices?"has-warning":""}"><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small><small>Koszt ${zl(group.carrierGross||0)} + prowizja ${zl(group.commissionGross||0)}</small>${group.incompletePrices?`<span class="lvl lvl-ostrzezenie">${group.incompletePrices} niepełnych wycen</span>`:""}</div><strong>${zl(group.customerTotalGross||0)}</strong><button class="btn" ${group.incompletePrices?"disabled title='Najpierw uzupełnij koszt wszystkich nadań'":""} onclick="infaktWysylkiFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz FV Artway‑TM</button></article>`).join("")||'<div class="backend-note">Brak nierozliczonych paczek miesięcznych.</div>'}</div>
    </section>
    <section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Ślad dokumentów</span><h2>Nadania przekazane do inFakt</h2><p class="order-detail-lead">Kontrola pokazuje osobno koszt nadania i prowizję, a na fakturę klienta trafia ich prawidłowa suma jako usługa Artway‑TM.</p></div></div>
      ${adminWyszukiwaniePanelHTML({id:"infakt-shipping",description:"Filtruj po kliencie, dokumencie, miesiącu albo numerze nadania.",fields,results:rows.length,active:!!(infaktWysylkiSzukaj||infaktWysylkiFiltr!=="wszystkie"),open:true})}
      <div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Klient</th><th>Miesiąc</th><th>Koszt InPost</th><th>Prowizja</th><th>Kwota FV klienta</th><th>Status dokumentu</th></tr></thead><tbody>${rows.map(item=>`<tr><td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small></td><td data-label="Klient"><b>${esc(item.receiver?.companyName||`${item.receiver?.firstName||""} ${item.receiver?.lastName||""}`.trim()||"Klient")}</b><br><small>${esc(item.receiver?.email||"")}${item.receiver?.taxCode?` • NIP ${esc(item.receiver.taxCode)}`:""}</small></td><td data-label="Miesiąc">${esc(item.billing?.month||"—")}<br><small>${item.billing?.mode==="monthly"?"zbiorczo":"pojedynczo"}</small></td><td data-label="Koszt InPost"><b>${zl(item.pricing?.totalGross||0)}</b></td><td data-label="Prowizja"><b>${zl(item.billing?.commissionGross||0)}</b></td><td data-label="Kwota FV"><b>${zl(item.pricing?.customerTotalGross||0)}</b>${item.pricing?.complete===true?"":'<br><span class="lvl lvl-ostrzezenie">niepełna wycena</span>'}</td><td data-label="Status">${infaktWysylkiStatusHTML(item)}</td></tr>`).join("")||'<tr><td colspan="7">Brak rozliczeń pasujących do filtrów.</td></tr>'}</tbody></table></div>
    </section>
  </div>`;
}
