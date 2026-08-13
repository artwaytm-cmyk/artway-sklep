function productEditorListaBrakow(...values){
  return [...new Set(values.flatMap(value=>Array.isArray(value)?value:[]).map(value=>String(value||"").trim()).filter(Boolean))];
}
function productEditorKanalStanOperacyjny(p={},channel="store"){
  const definition=productEditorKanalDefinicja(p,channel),missing=productEditorListaBrakow(definition.missing);
  if(channel==="store")return {channel,ready:missing.length===0,pending:false,status:missing.length?"needs_review":"ready",label:missing.length?"! Do uzupełnienia":"✓ Gotowe",missing,definition,apiStatus:"WIDOCZNOŚĆ SKLEPU"};
  if(channel==="allegro"){
    let offer=null;try{offer=allegroOfertaDlaProduktuSklepu(p);}catch(error){offer=null;}
    const apiStatus=String(offer?.status||offer?.publication?.status||p.allegroStatus||p.allegroPublicationStatus||"").toUpperCase(),agentStatus=String(p.allegroAgentPreparationStatus||"").toLowerCase(),offerId=String(offer?.id||p.allegroOfferId||""),hasOffer=!!offerId;
    const exactMissing=productEditorListaBrakow(missing,p.allegroAgentPreparationMissing);
    const pending=["queued","pending","processing","preparing","running","retry","retrying","retry_pending","waiting_provider"].includes(agentStatus),agentReady=["ready","published","completed","confirmed"].includes(agentStatus);
    const active=apiStatus==="ACTIVE",ready=active||exactMissing.length===0&&(!hasOffer&&agentReady);
    const label=active?"● Aktywna":ready?"✓ Gotowa do publikacji":pending?"↻ Agent pracuje":hasOffer?`! ${apiStatus||"Oferta do kontroli"}`:"! Do przygotowania";
    return {channel,ready,pending,status:ready?"ready":pending?"retry_pending":"needs_review",label,missing:exactMissing,definition,apiStatus:apiStatus||"BRAK OFERTY",agentStatus:agentStatus||"nieprzygotowany",offerId};
  }
  const apiStatus=String(p.vonHalskyRemoteStatus||p.vonHalskyProviderStatus||"").toUpperCase(),agentStatus=String(p.vonHalskyAgentStatus||"").toLowerCase();
  const exactMissing=productEditorListaBrakow(missing,p.vonHalskyAgentMissingAttributes,p.vonHalskyRequiredAttributesMissing,p.vonHalskyResponsibleProducerMissing,p.vonHalskyAgentIssues);
  const pending=["queued","pending","processing","preparing","running","retry","retrying","retry_pending","waiting_provider"].includes(agentStatus)||["PENDING","PROCESSING"].includes(apiStatus),agentReady=["ready","confirmed"].includes(agentStatus);
  const blockingApi=["VERIFICATION_ERROR","REJECTED","ERROR","IDENTITY_CONFLICT","DUPLICATE_MAPPING"].includes(apiStatus);
  const active=apiStatus==="PUBLISHED",ready=active||!blockingApi&&exactMissing.length===0&&agentReady&&p.vonHalskyAgentReadbackConfirmed===true;
  const blockedLabel=apiStatus==="IDENTITY_CONFLICT"?"! Konflikt produktu":apiStatus==="DUPLICATE_MAPPING"?"! Powiązanie do kontroli":"! Błąd kanału";
  const label=active?"● Opublikowana":ready?"✓ Gotowa do publikacji":pending&&!blockingApi?"↻ Agent pracuje":blockingApi?blockedLabel:"! Do przygotowania";
  return {channel,ready,pending,status:ready?"ready":pending?"retry_pending":"needs_review",label,missing:exactMissing,definition,apiStatus:apiStatus||"BRAK OFERTY",agentStatus:agentStatus||"nieprzygotowany",offerId:String(p.vonHalskyOfferId||p.inpostVonHalskyOfferId||"")};
}
function productEditorKanalAutomatykaHTML(p={},channel="allegro"){
  const state=productEditorKanalStanOperacyjny(p,channel),allegro=channel==="allegro",id=String(p.id||"");
  const preparedAt=allegro?p.allegroAgentPreparationConfirmedAt||p.allegroAgentPreparedAt:p.vonHalskyAgentConfirmedAt||p.vonHalskyAgentPreparedAt;
  const checkedAt=allegro?p.allegroAgentPreparationCheckedAt:p.vonHalskyAttributesVerifiedAt||p.vonHalskyAgentPreparedAt;
  const primary=allegro?`allegroPublikacjaPrzygotujWybrane(${jsArg(id)})`:`vonHalskyPrzygotujAgentem([${jsArg(id)}])`,center=allegro?"#/admin/allegro/oferty":"#/admin/von-halsky/wystawianie";
  const publish=allegro&&!state.offerId?`<button class="btn product-allegro-publish" type="button" onclick="allegroPublikacjaOtworzDecyzje(${jsArg(id)},'activate')" ${state.ready?"":"disabled"}>Wystaw po kontroli</button>`:"";
  return `<section class="product-channel-automation ${allegro?"allegro":"von-halsky"} ${state.ready?"is-ready":state.pending?"is-pending":"needs-work"}"><header><div><small>AUTOMATYKA I STAN OPERACYJNY</small><h3>${allegro?"Allegro":"Von Halsky"} • ${esc(state.label)}</h3><p>Jedna kontrola obejmuje identyfikację, kategorię, wymagane parametry, GPSR, treść, media i ochronę przed duplikatem.</p></div><strong>${state.ready?"✓":state.pending?"↻":"!"}</strong></header><div class="product-channel-automation-facts"><span><small>Stan API</small><b>${esc(state.apiStatus)}</b></span><span><small>Agent</small><b>${esc(state.agentStatus)}</b></span><span><small>Przygotowanie</small><b>${preparedAt?esc(allegroDataTxt(preparedAt)):"brak potwierdzenia"}</b></span><span><small>Schemat kanału</small><b>${checkedAt?esc(allegroDataTxt(checkedAt)):"oczekuje na odczyt"}</b></span></div>${state.missing.length?`<div class="product-channel-automation-missing"><b>Dokładna lista napraw (${state.missing.length})</b><div>${state.missing.slice(0,12).map(item=>`<span>${esc(item)}</span>`).join("")}</div></div>`:`<div class="product-channel-automation-ok">✓ Wszystkie kontrole wymagane przed publikacją są potwierdzone.</div>`}<footer><button class="btn ghost" type="button" onclick="${primary}">🤖 Przygotuj ponownie</button>${publish}<a class="btn ghost" href="${center}">Centrum kanału →</a></footer></section>`;
}
