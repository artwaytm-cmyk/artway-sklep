/* GENERATED ADMIN COMMUNICATIONS — loaded on demand */
function allegroAutoReplyKlucz(type,id,sourceId=""){
  return `${type}:${id}${sourceId?":"+sourceId:""}`;
}
function allegroAutoReplyDla(type,item={}){
  const replies=allegroKomunikacja?.autoReplies||{};
  const source=String(item.latestNewIncomingKey||item.latestNewIncoming?.id||item.latestNewIncoming?.createdAt||"");
  return replies[`${type}:${item.id}:first-contact`]||(source&&replies[allegroAutoReplyKlucz(type,item.id,source)])||replies[allegroAutoReplyKlucz(type,item.id)]||Object.values(replies).find(x=>x?.type===type&&String(x?.id)===String(item.id))||null;
}
function allegroKomunikacjaZalatwiona(item={}){
  return item?.internalResolved===true||item?.internalResolution?.resolved===true;
}
function allegroKomunikacjaWymagaOdpowiedzi(item={}){
  return !allegroKomunikacjaZalatwiona(item)&&!!(item?.humanReplyNeeded||item?.needsReply||Number(item?.newIncomingCount||0)>0);
}
function allegroKomunikacjaObsluzona(item={}){
  return !allegroKomunikacjaWymagaOdpowiedzi(item);
}
function allegroKomunikacjaStaty(){
  const threads=Array.isArray(allegroKomunikacja?.threads)?allegroKomunikacja.threads:[];
  const issues=Array.isArray(allegroKomunikacja?.issues)?allegroKomunikacja.issues:[];
  const replies=allegroKomunikacja?.autoReplies||{};
  const threadNeed=threads.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  const issueNeed=issues.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  return {threads,issues,replies,threadNeed,issueNeed,totalNeed:threadNeed+issueNeed,sent:Object.keys(replies).length};
}
function allegroKomunikacjaBledyHTML(){
  const errors=Array.isArray(allegroKomunikacja?.errors)?allegroKomunikacja.errors:[];
  if(!errors.length) return "";
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth;
  const brakDostepu=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||errors.some(e=>Number(e.status)===403)));
  if(brakDostepu) return `<div class="allegro-permission-alert"><div><b>🔐 Allegro blokuje wiadomości i dyskusje — HTTP 403</b><p>Token oraz deklaracja aplikacji nie mają jeszcze aktywnych uprawnień <code>allegro:api:messaging</code> i <code>allegro:api:disputes</code>. Po rozszerzeniu uprawnień aplikacji trzeba jednorazowo połączyć konto ponownie — starego refresh tokenu nie da się rozszerzyć automatycznie.</p><small>${errors.map(e=>`${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}`).join(" • ")}</small></div><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button></div>`;
  return `<div class="backend-note" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Diagnostyka komunikacji Allegro:</b><br>${errors.map(e=>`• ${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}${e.status?` (HTTP ${esc(e.status)})`:""}`).join("<br>")}</div>`;
}
function allegroReplyFieldId(type,id){return `allegro-reply-${String(type||"thread").replace(/[^a-z0-9_-]/gi,"-")}-${String(id||"").replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroReplyContextId(type,id){return `allegro-reply-context-${String(type||"thread").replace(/[^a-z0-9_-]/gi,"-")}-${String(id||"").replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroKontekstOdpowiedziHTML(context={}){
  const style=context.styleProfile||{},styleCount=Number(style.exampleCount||0);
  if(context.mode==="style")return `<div class="allegro-agent-check-head"><b>✨ Profesjonalna redakcja gotowa</b><small>${esc(allegroDataTxt(context.verifiedAt))}</small></div><div class="allegro-agent-check-chips"><span class="ok">poprawiono język, interpunkcję i układ</span><span class="info">bez dopisywania niepotwierdzonych faktów</span><span class="${styleCount?"ok":"info"}">${styleCount?`styl na podstawie ${styleCount} odpowiedzi Artway-TM`:`profesjonalny styl domyślny`}</span><span class="info">tylko szkic — nic nie wysłano</span></div>`;
  const shipment=context.shipment||{},checks=context.checks||{},errors=Array.isArray(context.errors)?context.errors:[],history=context.history||{};
  const conversation=context.conversation||{};
  const chips=[
    [conversation.messageCount>0?(history.live?"ok":"warn"):"warn",conversation.messageCount>0?`${history.live?"Pełna historia Allegro":"Historia z bezpiecznej kopii"}: ${conversation.messageCount} wiadomości`:`Brak historii rozmowy`],
    [conversation.relatedConversationCount>0?"info":"ok",conversation.relatedConversationCount>0?`Poprzednie sprawy klienta: ${conversation.relatedConversationCount}`:"Brak innych spraw klienta"],
    [context.orderFound?"ok":"warn",context.orderFound?`Zamówienie ${context.orderId}`:"Brak jednoznacznego zamówienia"],
    [checks.liveOrder?"ok":"warn",checks.liveOrder?`Status Allegro: ${context.statusLabel||context.status||"sprawdzony"}`:"Status bieżący niedostępny"],
    [checks.shipments?"ok":"warn",shipment.tracking?`Numer nadania: ${shipment.tracking}`:shipment.sent?"Wysłane — bez numeru w danych":"Brak potwierdzonego nadania"],
    [checks.warehouse?context.shortages>0?"bad":"ok":"info",checks.warehouse?(context.shortages>0?`Braki magazynowe: ${context.shortages} szt.`:"Magazyn sprawdzony"):"Brak analizy magazynowej"],
    [checks.localShipping?"ok":"info",checks.localShipping?"Sprawdzono obsługę InPost w sklepie":"Brak lokalnej przesyłki"],
    [styleCount?"ok":"info",styleCount?`Styl z ${styleCount} wysłanych odpowiedzi Artway-TM`:`Profesjonalny styl domyślny`],
  ];
  return `<div class="allegro-agent-check-head"><b>🧠 Agent dopasował szkic do całej rozmowy i danych zamówienia</b><small>${esc(allegroDataTxt(context.verifiedAt))}</small></div><div class="allegro-agent-check-chips">${chips.map(([cls,label])=>`<span class="${cls}">${esc(label)}</span>`).join("")}</div>${history.truncated?`<small class="allegro-agent-check-warning">Rozmowa przekroczyła bezpieczny limit pobierania; wykorzystano ${esc(conversation.messageCount||0)} najnowszych wiadomości.</small>`:""}${!history.live&&history.error?`<small class="allegro-agent-check-warning">Nie udało się odświeżyć pełnego archiwum Allegro. Wykorzystano zachowaną historię: ${esc(history.error)}</small>`:""}${(conversation.warnings||[]).map(warning=>`<small class="allegro-agent-check-warning">${esc(warning)}</small>`).join("")}${conversation.contradictoryReshipmentRemoved?`<small class="allegro-agent-check-warning">Usunięto propozycję kolejnej przesyłki, ponieważ klient wyraźnie jej odmówił.</small>`:""}${errors.length?`<small class="allegro-agent-check-warning">Nie wszystkie źródła odpowiedziały: ${errors.map(esc).join(" • ")}. Propozycja nie zgaduje brakujących danych.</small>`:""}`;
}
async function allegroAgentPropozycjaOdpowiedzi(type,id,mode="context"){
  const field=document.getElementById(allegroReplyFieldId(type,id));
  const before=String(field?.value||"");
  if(!field){toast("Nie znaleziono pola odpowiedzi");return;}
  if(mode==="style"&&!before.trim()){toast("Najpierw wpisz treść do poprawy stylistycznej");field.focus();return;}
  const box=field.closest(".allegro-reply-box"),buttons=[...(box?.querySelectorAll("[data-reply-improve]")||[])];
  buttons.forEach(button=>{button.disabled=true;button.setAttribute("aria-busy","true");});
  try{
    const d=await chmura("allegro-reply-suggestion",{method:"POST",body:{type,id,mode,draft:before},timeout:30000});
    let suggestion=d.suggestion||before;try{const textRun=await agentAISpecjalistaWykonaj("customer_reply",{draft:suggestion,verifiedContext:d.context||{},mode},mode==="style"?"Popraw profesjonalnie styl wpisanego szkicu, zachowując jego znaczenie i wyłącznie potwierdzone fakty.":"Przygotuj serdeczną, konkretną odpowiedź na podstawie sprawdzonego kontekstu. Nie obiecuj niczego bez potwierdzenia.",{},{}),fields=agentAISpecjalistaPola(textRun?.result||{});suggestion=fields.reply||textRun?.result?.content||suggestion;}catch(textError){console.warn("GPT-5 nano reply fallback",textError);}
    if(field){field.dataset.previousDraft=before;field.dataset.lastImprovement=mode;field.value=suggestion;field.focus();field.dispatchEvent(new Event("input",{bubbles:true}));}
    const contextBox=document.getElementById(allegroReplyContextId(type,id));if(contextBox){contextBox.innerHTML=allegroKontekstOdpowiedziHTML(d.context||{});contextBox.hidden=false;}
    const undo=box?.querySelector("[data-reply-undo]");if(undo)undo.hidden=false;
    toast(mode==="style"?"✨ Poprawiono styl szkicu — nic nie wysłano":"🧠 Dopasowano szkic do całej rozmowy — sprawdź go przed wysłaniem");
  }catch(e){toast("⚠️ Poprawa odpowiedzi przez Agenta AI: "+(e.message||e));}
  finally{buttons.forEach(button=>{button.disabled=false;button.removeAttribute("aria-busy");});}
}
function allegroCofnijPopraweOdpowiedzi(type,id){
  const field=document.getElementById(allegroReplyFieldId(type,id));if(!field||field.dataset.previousDraft===undefined)return;
  const current=field.value;field.value=field.dataset.previousDraft;field.dataset.previousDraft=current;field.focus();field.dispatchEvent(new Event("input",{bubbles:true}));toast("↩️ Przywrócono poprzednią wersję szkicu — nic nie wysłano");
}
async function allegroWyslijOdpowiedz(type,id){
  const field=document.getElementById(allegroReplyFieldId(type,id));
  const text=String(field?.value||"").trim();
  if(!text){toast("Wpisz odpowiedź albo użyj propozycji Agenta AI");return;}
  if(field.dataset.sending==="1")return;
  const sendButton=field.closest(".allegro-reply-box")?.querySelector("[data-reply-send]");field.dataset.sending="1";if(sendButton){sendButton.disabled=true;sendButton.setAttribute("aria-busy","true");}
  try{
    const d=await chmura("allegro-send-reply",{method:"POST",body:{type,id,text},timeout:30000});
    allegroKomunikacja={...allegroKomunikacja,threads:Array.isArray(d.threads)?d.threads:allegroKomunikacja.threads,issues:Array.isArray(d.issues)?d.issues:allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at,sprawdzono:true};
    allegroZapiszCache();toast(d.styleLearned?"✅ Odpowiedź wysłana • Agent zapamiętał jej profesjonalny styl":"Odpowiedź została wysłana przez Allegro ✅");renderuj();
  }catch(e){toast("⚠️ Wysyłanie odpowiedzi Allegro: "+(e.message||e));}
  finally{field.dataset.sending="0";if(sendButton){sendButton.disabled=false;sendButton.removeAttribute("aria-busy");}}
}
function allegroTypAutoraHTML(m={}){
  const explicit=String(m.authorType||"").toLowerCase(),role=String(m.role||m.author?.role||"").toUpperCase();
  if(role==="BUYER")return "buyer";
  if(role==="SELLER")return "seller";
  if(["ADMIN","ALLEGRO","SYSTEM","MODERATOR","FULFILLMENT"].includes(role))return "allegro";
  if(typeof m.isInterlocutor==="boolean")return m.isInterlocutor?"buyer":"seller";
  if(m.system===true)return "allegro";
  if(explicit==="buyer"||explicit==="seller")return explicit;
  if(m.incoming===true)return "buyer";
  if(m.seller===true||m.incoming===false)return "seller";
  return "allegro";
}
function allegroCzytelnaTrescWiadomosci(value=""){
  return String(value||"").replace(/<\s*br\s*\/?\s*>/gi,"\n").replace(/<\s*\/\s*(?:p|div|li)\s*>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&oacute;/g,"ó").replace(/&Oacute;/g,"Ó").replace(/&aogon;/g,"ą").replace(/&Aogon;/g,"Ą").replace(/&cacute;/g,"ć").replace(/&Cacute;/g,"Ć").replace(/&eogon;/g,"ę").replace(/&Eogon;/g,"Ę").replace(/&lstrok;/g,"ł").replace(/&Lstrok;/g,"Ł").replace(/&nacute;/g,"ń").replace(/&Nacute;/g,"Ń").replace(/&sacute;/g,"ś").replace(/&Sacute;/g,"Ś").replace(/&zacute;/g,"ź").replace(/&Zacute;/g,"Ź").replace(/&zdot;/g,"ż").replace(/&Zdot;/g,"Ż").replace(/[ \t]+/g," ").replace(/[ \t]*\n[ \t]*/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function allegroWiadomosciWedlugAutora(messages=[],author="buyer"){
  return (Array.isArray(messages)?messages:[]).filter(m=>allegroTypAutoraHTML(m)===author).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
}
function allegroWiadomoscHTML(m={},author="buyer"){
  const buyer=author==="buyer",system=author==="allegro",label=buyer?`👤 Klient${m.authorLogin?` • ${esc(m.authorLogin)}`:""}`:system?`${String(m.role||"").toUpperCase()==="ADMIN"?"🛡️ Zespół Allegro":"🔔 Komunikat Allegro"}`:"🏪 Artway-TM";
  return `<article class="allegro-message ${buyer?"incoming":system?"system":"seller"}" data-message-source="${author}"><header><b>${label}</b><small>${esc(allegroDataTxt(m.createdAt))}</small></header><p>${esc(allegroCzytelnaTrescWiadomosci(m.text)||"Wiadomość bez treści")}</p>${Array.isArray(m.attachments)&&m.attachments.length?`<footer>📎 ${m.attachments.length} ${m.attachments.length===1?"załącznik":"załączniki"}</footer>`:""}</article>`;
}
function allegroHistoriaRozmowyHTML(messages=[]){
  const sorted=(Array.isArray(messages)?messages:[]).slice().sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
  const human=sorted.filter(m=>allegroTypAutoraHTML(m)!=="allegro"),system=sorted.filter(m=>allegroTypAutoraHTML(m)==="allegro");
  return `<section class="allegro-history-block"><header class="allegro-history-head"><div><b>Historia rozmowy</b><small>Klient ${human.filter(m=>allegroTypAutoraHTML(m)==="buyer").length} • Artway-TM ${human.filter(m=>allegroTypAutoraHTML(m)==="seller").length}</small></div><div class="allegro-source-legend"><span class="customer">● Klient</span><span class="artway">● Artway-TM</span><span class="platform">● Allegro</span></div></header><div class="allegro-conversation">${human.map(m=>allegroWiadomoscHTML(m,allegroTypAutoraHTML(m))).join("")||`<div class="backend-note">Brak wiadomości klienta lub Artway-TM w tej sprawie.</div>`}</div>${system.length?`<details class="allegro-system-log"><summary>🔔 Komunikaty i działania Allegro <span>${system.length}</span><small>oddzielone od rozmowy z klientem</small></summary><div>${system.map(m=>allegroWiadomoscHTML(m,"allegro")).join("")}</div></details>`:""}</section>`;
}
function allegroInternalNoteId(type,id){return `allegro-internal-note-${String(type)}-${String(id).replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroZaznaczeniaKomunikacji(type){return type==="issue"?zaznaczoneAllegroDyskusje:zaznaczoneAllegroWiadomosci;}
function allegroPrzelaczZaznaczenieKomunikacji(type,id,checked){const set=allegroZaznaczeniaKomunikacji(type);checked?set.add(String(id)):set.delete(String(id));renderuj();}
function allegroSzukajKomunikacje(type,value){
  if(type==="issue")szukajAllegroDyskusji=String(value||"");else szukajAllegroWiadomosci=String(value||"");
  clearTimeout(window.__allegroCommunicationSearchTimer);window.__allegroCommunicationSearchTimer=setTimeout(()=>{renderuj();setTimeout(()=>{const el=document.getElementById(type==="issue"?"allegroIssueSearch":"allegroThreadSearch");if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0);},280);
}
function allegroUstawFiltrKomunikacji(type,value){
  if(type==="issue")filtrAllegroDyskusji=String(value||"wszystkie");else filtrAllegroWiadomosci=String(value||"wszystkie");
  allegroLimitKomunikacji=Math.max(50,allegroLimitKomunikacji);renderuj();
  setTimeout(()=>document.querySelector(".allegro-communication-list")?.scrollIntoView({behavior:"smooth",block:"start"}),30);
}
function allegroAktywujKafelkiKomunikacji(type="thread"){
  const root=document.querySelector(".allegro-communication-page"),cards=[...(root?.querySelectorAll(":scope > .orders-stat-grid .order-stat-card")||[])],values=["wszystkie","wymaga","zalatwione","obsluzone","systemowe"],current=type==="issue"?filtrAllegroDyskusji:filtrAllegroWiadomosci;
  cards.forEach((card,index)=>{const value=values[index];if(!value)return;card.classList.add("stat-filter");card.classList.toggle("active",current===value);card.setAttribute("role","button");card.setAttribute("tabindex","0");card.setAttribute("aria-pressed",String(current===value));card.onclick=()=>allegroUstawFiltrKomunikacji(type,value);card.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();allegroUstawFiltrKomunikacji(type,value);}};});
}
function allegroTekstKomunikacji(item={}){return `${item.id||""} ${item.buyerLogin||""} ${item.subject||""} ${item.orderId||""} ${(item.messages||[]).map(m=>`${m.authorLogin||""} ${m.text||""} ${m.orderId||""}`).join(" ")}`.toLowerCase();}
function allegroKomunikacjaPasujaca(type="thread"){
  const list=type==="issue"?(allegroKomunikacja?.issues||[]):(allegroKomunikacja?.threads||[]),q=String(type==="issue"?szukajAllegroDyskusji:szukajAllegroWiadomosci).toLowerCase().trim(),filter=type==="issue"?filtrAllegroDyskusji:filtrAllegroWiadomosci,sort=type==="issue"?sortAllegroDyskusje:sortAllegroWiadomosci;
  return list.filter(item=>{
    if(q&&!allegroTekstKomunikacji(item).includes(q))return false;
    const need=allegroKomunikacjaWymagaOdpowiedzi(item),resolved=allegroKomunikacjaZalatwiona(item),status=String(item.status||"").toUpperCase(),closed=/CLOSED|RESOLVED|CANCELLED|REJECTED/.test(status)||item.chatActive===false;
    const hasSystem=(item.messages||[]).some(m=>allegroTypAutoraHTML(m)==="allegro");
    if(filter==="wymaga"&&!need)return false;if(filter==="zalatwione"&&!resolved)return false;if(filter==="obsluzone"&&!allegroKomunikacjaObsluzona(item))return false;if(filter==="systemowe"&&!hasSystem)return false;if(filter==="aktywne"&&closed)return false;if(filter==="zamkniete"&&!closed)return false;
    return true;
  }).sort((a,b)=>{const ad=Date.parse(a.lastMessageDateTime||a.lastMessage?.createdAt||a.openedDate||0)||0,bd=Date.parse(b.lastMessageDateTime||b.lastMessage?.createdAt||b.openedDate||0)||0;return sort==="najstarsze"?ad-bd:bd-ad;});
}
function allegroZaznaczWidocznaKomunikacje(type,checked){const set=allegroZaznaczeniaKomunikacji(type);allegroKomunikacjaPasujaca(type).slice(0,allegroLimitKomunikacji).forEach(x=>checked?set.add(String(x.id)):set.delete(String(x.id)));renderuj();}
async function allegroOznaczSpraweWewnetrznie(type,id,resolved=true){
  const note=String(document.getElementById(allegroInternalNoteId(type,id))?.value||"").trim();
  try{const d=await chmura("allegro-communication-resolve",{method:"POST",body:{type,id,resolved,note},timeout:20000});allegroKomunikacja={...allegroKomunikacja,threads:d.threads||allegroKomunikacja.threads,issues:d.issues||allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at};allegroZapiszCache();toast(resolved?"✅ Sprawa trafiła do Obsłużonych — nic nie wysłano klientowi":"↩️ Sprawa przywrócona do obsługi wewnętrznej");renderuj();}catch(e){toast("⚠️ Status wewnętrzny: "+(e.message||e));}
}
async function allegroOznaczZaznaczoneSprawy(type,resolved=true){
  const set=allegroZaznaczeniaKomunikacji(type),items=[...set].map(id=>({type,id,resolved}));if(!items.length){toast("Zaznacz co najmniej jedną sprawę");return;}
  try{const d=await chmura("allegro-communication-resolve",{method:"POST",body:{items},timeout:30000});allegroKomunikacja={...allegroKomunikacja,threads:d.threads||allegroKomunikacja.threads,issues:d.issues||allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at};set.clear();allegroZapiszCache();toast(`✅ ${d.results?.filter(x=>x.ok).length||0} spraw trafiło do Obsłużonych — bez wiadomości do klientów`);renderuj();}catch(e){toast("⚠️ Operacja grupowa: "+(e.message||e));}
}
function allegroRozmowaHTML(type,item={},label="Wiadomość"){
  const sent=allegroAutoReplyDla(type,item),last=item.lastMessage||{},resolved=allegroKomunikacjaZalatwiona(item),nowa=allegroKomunikacjaWymagaOdpowiedzi(item),fieldId=allegroReplyFieldId(type,item.id),contextId=allegroReplyContextId(type,item.id),noteId=allegroInternalNoteId(type,item.id),selected=allegroZaznaczeniaKomunikacji(type).has(String(item.id));
  const messages=Array.isArray(item.messages)&&item.messages.length?item.messages:[last].filter(Boolean);
  const buyerMessages=allegroWiadomosciWedlugAutora(messages,"buyer"),sellerMessages=allegroWiadomosciWedlugAutora(messages,"seller"),systemMessages=allegroWiadomosciWedlugAutora(messages,"allegro"),latestBuyer=buyerMessages.at(-1)||null,latestSystem=systemMessages.at(-1)||null,summaryMessage=latestBuyer||latestSystem||last,summaryLabel=latestBuyer?"Ostatnia wiadomość klienta":latestSystem?"Ostatni komunikat Allegro":"Ostatnia aktywność";
  const orderId=item.orderId||messages.find(m=>m.orderId)?.orderId||"";
  return `<details class="allegro-conversation-card ${nowa?"needs-reply":""} ${resolved?"is-internally-resolved":""}" ${nowa?"open":""}>
    <summary><label class="allegro-communication-select" onclick="event.stopPropagation()"><input type="checkbox" ${selected?"checked":""} onchange="allegroPrzelaczZaznaczenieKomunikacji(${jsArg(type)},${jsArg(item.id)},this.checked)"></label><span class="allegro-conversation-icon">${type==="issue"?"🛟":"💬"}</span><span class="allegro-conversation-summary"><small>${esc(summaryLabel)}</small><b>${esc(label)} — ${esc(item.buyerLogin||"Klient Allegro")}</b><em>${esc(skrocTekst(allegroCzytelnaTrescWiadomosci(summaryMessage?.text||item.subject)||"Brak treści",210))}</em></span><span>${resolved?`<span class="lvl lvl-ok">✅ załatwiona wewnętrznie</span>`:nowa?`<span class="lvl lvl-ostrzezenie">wymaga odpowiedzi</span>`:sent?`<span class="lvl lvl-ok">pierwsza odpowiedź wysłana</span>`:`<span class="lvl lvl-info">obsłużona</span>`}</span></summary>
    <div class="allegro-conversation-meta"><span>🔑 ID ${esc(item.id)}</span>${orderId?`<span>📦 Zamówienie ${esc(orderId)}</span>`:""}<span>🕒 Aktywność ${esc(allegroDataTxt(item.lastMessageDateTime||last.createdAt||item.openedDate))}</span><span>👤 Klient ${buyerMessages.length}</span><span>🏪 Artway-TM ${sellerMessages.length}</span><span>🔔 Allegro ${systemMessages.length}</span>${item.status?`<span>Stan Allegro ${esc(item.status)}</span>`:""}</div>
    <div class="allegro-internal-resolution"><div><b>✅ Obsługa wewnętrzna</b><small>Ta operacja nie wysyła wiadomości do klienta ani nie zmienia statusu w Allegro. Agent przestanie zgłaszać sprawę do wyjaśnienia. Nowa wiadomość klienta automatycznie otworzy ją ponownie.</small>${resolved&&item.internalResolution?.resolvedAt?`<em>Załatwiono: ${esc(allegroDataTxt(item.internalResolution.resolvedAt))}${item.internalResolution.note?` • ${esc(item.internalResolution.note)}`:""}</em>`:""}</div><input id="${esc(noteId)}" maxlength="1000" value="${esc(item.internalResolution?.note||"")}" placeholder="Notatka wewnętrzna (opcjonalnie)">${resolved?`<button class="btn ghost" type="button" onclick="allegroOznaczSpraweWewnetrznie(${jsArg(type)},${jsArg(item.id)},false)">↩️ Przywróć do obsługi</button>`:`<button class="btn" type="button" onclick="allegroOznaczSpraweWewnetrznie(${jsArg(type)},${jsArg(item.id)},true)">✅ Oznacz jako załatwioną</button>`}</div>
    ${allegroHistoriaRozmowyHTML(messages)}
    <div class="allegro-reply-box"><header><div><span class="order-pro-label">Szkic pod kontrolą administratora</span><h3>Odpowiedź do klienta</h3><p>Agent oddziela wypowiedzi klienta, Artway‑TM i Allegro. Treść przygotowuje na podstawie ostatniej rzeczywistej wiadomości klienta, pełnego wątku i potwierdzonych danych zamówienia.</p></div><span class="allegro-learning-badge">🧠 Uczy się stylu z wysłanych odpowiedzi</span></header><div id="${esc(contextId)}" class="allegro-agent-check" hidden></div><label class="sr-only" for="${esc(fieldId)}">Odpowiedź wychodząca do klienta</label><textarea id="${esc(fieldId)}" rows="8" maxlength="20000" placeholder="Wpisz własną treść albo wybierz „Przygotuj profesjonalną odpowiedź”…"></textarea><div class="allegro-reply-safety"><span>🔒 Przygotowanie i poprawa tworzą tylko szkic. Wiadomość wysyła wyłącznie przycisk „Wyślij przez Allegro”.</span><button class="btn ghost" type="button" data-reply-undo hidden onclick="allegroCofnijPopraweOdpowiedzi(${jsArg(type)},${jsArg(item.id)})">↩️ Cofnij poprawę</button></div><div class="diag-actions allegro-reply-actions"><button class="btn ghost" type="button" data-reply-improve="style" onclick="allegroAgentPropozycjaOdpowiedzi(${jsArg(type)},${jsArg(item.id)},'style')">✨ Popraw język i układ</button><button class="btn secondary" type="button" data-reply-improve="context" onclick="allegroAgentPropozycjaOdpowiedzi(${jsArg(type)},${jsArg(item.id)},'context')">🧠 Przygotuj profesjonalną odpowiedź</button><button class="btn" type="button" data-reply-send onclick="allegroWyslijOdpowiedz(${jsArg(type)},${jsArg(item.id)})">✉️ Wyślij przez Allegro</button></div></div>
  </details>`;
}
function allegroWatekHTML(t){
  return allegroRozmowaHTML("thread",t,"Wiadomość");
}
function allegroIssueHTML(i){
  return allegroRozmowaHTML("issue",i,i.type==="CLAIM"?"Reklamacja":"Dyskusja");
}
function allegroKomunikacjaPanelLegacyHTML(){
  const st=allegroKomunikacjaStaty();
  const s=allegroKomunikacjaUstawienia();
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth;
  const wymagaPonownegoPolaczenia=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||(allegroKomunikacja?.errors||[]).some(e=>Number(e.status)===403)));
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">💬 Wiadomości, dyskusje i autoresponder Allegro</h2><p class="order-detail-lead">Autoresponder wysyła najwyżej jedną wiadomość: wyłącznie po pierwszej wiadomości klienta w całkowicie nowej rozmowie. Każdy dalszy kontakt wymaga ręcznego zatwierdzenia odpowiedzi przygotowanej po sprawdzeniu zamówienia i wysyłki.</p></div>
      ${wymagaPonownegoPolaczenia?`<button class="btn" onclick="allegroPolacz()">🔐 Napraw połączenie Allegro</button>`:""}
    </div>
    <div class="panel-subtle">
      <div class="order-section-head"><div><h3 style="margin:0">💬 Centrum wiadomości</h3><p class="order-detail-lead">Otwórz rozmowę, zobacz historię, poproś Agenta AI o propozycję i odpowiedz klientowi bez opuszczania sklepu.</p></div></div>
      <div class="ai-task-list">${st.threads.map(allegroWatekHTML).join("") || `<p style="color:var(--muted2)">Brak pobranych wątków. Dane odświeżą się automatycznie.</p>`}</div>
    </div>
    <div class="panel-subtle" style="margin-top:1rem">
      <div class="order-section-head"><div><h3 style="margin:0">🛟 Dyskusje i reklamacje</h3><p class="order-detail-lead">Używane jest nowe API Allegro <code>/sale/issues</code>, a nie stare <code>/sale/disputes</code>.</p></div></div>
      <div class="ai-task-list">${st.issues.map(allegroIssueHTML).join("") || `<p style="color:var(--muted2)">Brak pobranych dyskusji/reklamacji. Dane odświeżą się automatycznie.</p>`}</div>
    </div>
    <div class="orders-stat-grid allegro-info-bottom">
      <div class="order-stat-card ${st.threadNeed?"hot":""}"><span>💬</span><b>${st.threads.length}</b><small>wątki wiadomości</small></div>
      <div class="order-stat-card ${st.issueNeed?"hot":""}"><span>🛟</span><b>${st.issues.length}</b><small>dyskusje/reklamacje</small></div>
      <div class="order-stat-card ${st.totalNeed?"hot":"money"}"><span>⚡</span><b>${st.totalNeed}</b><small>wymaga ręcznej odpowiedzi</small></div>
      <div class="order-stat-card money"><span>✅</span><b>${st.sent}</b><small>auto-odpowiedzi zapisane</small></div>
    </div>
    ${allegroKomunikacjaBledyHTML()}
    <form class="panel-subtle allegro-info-bottom" onsubmit="event.preventDefault();allegroZapiszUstawieniaKomunikacji(this)">
      <div class="order-section-head">
        <div><h3 style="margin:0">⚙️ Ustawienia autorespondera</h3><p class="order-detail-lead">Harmonogram sprawdza komunikację co 15 minut. Automat odpowiada tylko na pierwszą wiadomość klienta w nowym wątku lub nowej dyskusji. Druga i każda kolejna wiadomość nigdy nie uruchamia autorespondera.</p></div>
        <button class="btn" type="submit">💾 Zapisz ustawienia</button>
      </div>
      <div class="form-grid">
        <label class="check"><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Autoresponder aktywny</label>
        <label class="check"><input type="checkbox" name="messageCenter" ${s.messageCenter?"checked":""}> Centrum wiadomości</label>
        <label class="check"><input type="checkbox" name="issues" ${s.issues?"checked":""}> Dyskusje i reklamacje</label>
        <label class="check"><input type="checkbox" name="telegramReminders" ${s.telegramReminders!==false?"checked":""}> Telegram: przypominaj tylko o nowych rozmowach wymagających odpowiedzi</label>
        <div class="f-group"><label>Odpowiadaj tylko na wiadomości z ostatnich godzin</label><input name="freshHours" type="number" min="1" max="168" value="${esc(s.freshHours||48)}"></div>
      </div>
      <div class="f-group"><label>Treść automatycznej pierwszej odpowiedzi <small style="font-weight:400;color:var(--muted2)">zmienne: {login}, {typ}</small></label><textarea name="template" rows="7" maxlength="2000">${esc(s.template||"")}</textarea></div>
    </form>
  </div>`;
}
function allegroKomunikacjaUstawieniaHTML(){
  const s=allegroKomunikacjaUstawienia();return `<form class="panel-subtle allegro-info-bottom" onsubmit="event.preventDefault();allegroZapiszUstawieniaKomunikacji(this)"><div class="order-section-head"><div><h3 style="margin:0">⚙️ Ustawienia pierwszej odpowiedzi</h3><p class="order-detail-lead"><b>Twarda reguła:</b> automat odpowiada tylko raz — na pierwszy kontakt w nowej rozmowie. Kolejne wiadomości wyłącznie otwierają zadanie dla obsługi i Agenta. Wewnętrznie załatwione sprawy są pomijane przez przypomnienia Telegram.</p></div><button class="btn" type="submit">💾 Zapisz ustawienia</button></div><div class="form-grid"><label class="check"><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Pierwsza odpowiedź automatyczna aktywna</label><label class="check"><input type="checkbox" name="messageCenter" ${s.messageCenter?"checked":""}> Nowe wątki Centrum wiadomości</label><label class="check"><input type="checkbox" name="issues" ${s.issues?"checked":""}> Nowe dyskusje i reklamacje</label><label class="check"><input type="checkbox" name="telegramReminders" ${s.telegramReminders!==false?"checked":""}> Telegram tylko dla nowych spraw wymagających odpowiedzi</label><div class="f-group"><label>Okno świeżości pierwszego kontaktu (godziny)</label><input name="freshHours" type="number" min="1" max="168" value="${esc(s.freshHours||48)}"></div></div><div class="f-group"><label>Treść jednorazowej odpowiedzi powitalnej <small style="font-weight:400;color:var(--muted2)">zmienne: {login}, {typ}</small></label><textarea name="template" rows="7" maxlength="2000">${esc(s.template||"")}</textarea></div></form>`;
}
function allegroKomunikacjaPanelHTML(type="thread"){
  const isIssue=type==="issue",st=allegroKomunikacjaStaty(),all=isIssue?st.issues:st.threads,list=allegroKomunikacjaPasujaca(type),visible=list.slice(0,allegroLimitKomunikacji),set=allegroZaznaczeniaKomunikacji(type),selected=[...set].filter(id=>all.some(x=>String(x.id)===id)),allVisible=!!visible.length&&visible.every(x=>set.has(String(x.id))),need=all.filter(allegroKomunikacjaWymagaOdpowiedzi).length,resolved=all.filter(allegroKomunikacjaZalatwiona).length,handled=all.filter(allegroKomunikacjaObsluzona).length,withSystem=all.filter(item=>(item.messages||[]).some(m=>allegroTypAutoraHTML(m)==="allegro")).length,query=isIssue?szukajAllegroDyskusji:szukajAllegroWiadomosci,filter=isIssue?filtrAllegroDyskusji:filtrAllegroWiadomosci,sort=isIssue?sortAllegroDyskusje:sortAllegroWiadomosci;
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth,wymagaPonownegoPolaczenia=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||(allegroKomunikacja?.errors||[]).some(e=>Number(e.status)===403)));
  const filterOptions=isIssue?[["wszystkie","Wszystkie"],["aktywne","Aktywne w Allegro"],["zamkniete","Zamknięte w Allegro"],["wymaga","Wymagają odpowiedzi"],["zalatwione","Załatwione wewnętrznie"],["obsluzone","Obsłużone"],["systemowe","Z komunikatami Allegro"]]:[["wszystkie","Wszystkie"],["wymaga","Wymagają odpowiedzi"],["zalatwione","Załatwione wewnętrznie"],["obsluzone","Obsłużone"],["systemowe","Z komunikatami Allegro"]];
  return `<div class="panel allegro-section-panel allegro-communication-page"><div class="order-section-head"><div><span class="order-pro-label">${isIssue?"Zgłoszenia formalne":"Obsługa korespondencji"}</span><h2>${isIssue?"🛟 Dyskusje i reklamacje Allegro":"💬 Centrum wiadomości Allegro"}</h2><p class="order-detail-lead">${isIssue?"Dyskusje i reklamacje są oddzielone od zwykłych wiadomości. Wpisy zespołu Allegro pozostają dostępne, ale są pokazane osobno i nigdy nie udają wiadomości klienta.":"Każdy wątek ma osobno wiadomości klienta, odpowiedzi Artway‑TM i komunikaty Allegro. Agent przygotowuje szkic wyłącznie dla właściwego klienta i właściwej rozmowy."}</p></div><div class="diag-actions">${wymagaPonownegoPolaczenia?`<button class="btn" onclick="allegroPolacz()">🔐 Napraw połączenie</button>`:""}<button class="btn ghost" onclick="allegroSynchronizujKomunikacje(false)">↻ Sprawdź nowe wiadomości</button></div></div><div class="allegro-source-model"><div class="customer"><span>👤</span><b>Klient</b><small>tylko jego wiadomości otwierają sprawę</small></div><div class="artway"><span>🏪</span><b>Artway‑TM</b><small>odpowiedzi ręczne uczą stylu Agenta</small></div><div class="platform"><span>🔔</span><b>Allegro</b><small>komunikaty systemowe są oddzielone</small></div></div><div class="orders-stat-grid allegro-communication-stats"><div class="order-stat-card"><span>${isIssue?"🛟":"💬"}</span><b>${all.length}</b><small>wszystkich</small></div><div class="order-stat-card ${need?"hot":""}"><span>⚡</span><b>${need}</b><small>wymaga odpowiedzi • bez załatwionych</small></div><div class="order-stat-card money"><span>✅</span><b>${resolved}</b><small>załatwionych wewnętrznie</small></div><div class="order-stat-card"><span>📁</span><b>${handled}</b><small>obsłużonych łącznie</small></div><div class="order-stat-card"><span>🔔</span><b>${withSystem}</b><small>z komunikatami Allegro</small></div></div><div class="allegro-communication-toolbar"><input id="${isIssue?"allegroIssueSearch":"allegroThreadSearch"}" placeholder="Szukaj: klient, numer zamówienia, ID, temat lub treść…" value="${esc(query)}" oninput="allegroSzukajKomunikacje(${jsArg(type)},this.value)"><select onchange="${isIssue?"filtrAllegroDyskusji":"filtrAllegroWiadomosci"}=this.value;renderuj()">${filterOptions.map(([v,l])=>`<option value="${v}" ${filter===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="${isIssue?"sortAllegroDyskusje":"sortAllegroWiadomosci"}=this.value;renderuj()"><option value="najnowsze" ${sort==="najnowsze"?"selected":""}>Najnowsze najpierw</option><option value="najstarsze" ${sort==="najstarsze"?"selected":""}>Najstarsze najpierw</option></select><label>Pokaż <select onchange="allegroLimitKomunikacji=Number(this.value)||50;renderuj()">${[20,50,100].map(n=>`<option value="${n}" ${allegroLimitKomunikacji===n?"selected":""}>${n}</option>`).join("")}</select></label></div><div class="allegro-communication-bulk"><label><input type="checkbox" ${allVisible?"checked":""} onchange="allegroZaznaczWidocznaKomunikacje(${jsArg(type)},this.checked)"> Zaznacz/odznacz widoczne (${visible.length})</label><span><b>${selected.length}</b> zaznaczonych</span><button class="btn" onclick="allegroOznaczZaznaczoneSprawy(${jsArg(type)},true)" ${selected.length?"":"disabled"}>✅ Załatw wewnętrznie</button><button class="btn ghost" onclick="allegroOznaczZaznaczoneSprawy(${jsArg(type)},false)" ${selected.length?"":"disabled"}>↩️ Przywróć do obsługi</button></div><div class="allegro-internal-banner"><b>🔒 Status wewnętrzny ma pierwszeństwo</b><span>Po oznaczeniu „załatwione” sprawa znika z „Wymaga odpowiedzi” i trafia także do filtra „Obsłużone”. Nie wysyła to wiadomości i nie zmienia oficjalnego statusu Allegro. Dopiero nowa wiadomość klienta może ponownie otworzyć sprawę — sam komunikat Allegro tego nie robi.</span></div><div class="ai-task-list allegro-communication-list">${visible.map(item=>isIssue?allegroIssueHTML(item):allegroWatekHTML(item)).join("")||`<div class="backend-note">Brak spraw pasujących do wyszukiwania i filtrów.</div>`}</div>${list.length>visible.length?`<p class="order-detail-lead">Pokazano ${visible.length} z ${list.length} wyników. Zwiększ limit widoku.</p>`:""}${allegroKomunikacjaBledyHTML()}${!isIssue?allegroKomunikacjaUstawieniaHTML():`<div class="backend-note allegro-info-bottom"><b>Ustawienia autorespondera</b> znajdują się na podstronie Wiadomości. Status „załatwiona wewnętrznie” zawsze ma pierwszeństwo przed automatyką.</div>`}</div>`;
}
