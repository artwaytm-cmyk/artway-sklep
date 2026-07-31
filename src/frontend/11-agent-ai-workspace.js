/* ═══════════ AGENT AI — SCALONE PROFESJONALNE CENTRUM ═══════════ */
const AGENT_AI_SEKCJE_KANONICZNE=Object.freeze({
  pulpit:"pulpit",centrum:"pulpit",
  rozmowa:"rozmowa",komendy:"rozmowa",
  praca:"praca",status:"praca",runtime:"praca",
  raport:"raport",wyniki:"raport",produkty:"raport",kanaly:"raport",
  zadania:"zadania",plan:"zadania",zlecenia:"zadania",producenci:"zadania",
  automatyzacje:"automatyzacje",specjalisci:"automatyzacje",uprawnienia:"automatyzacje",pamiec:"automatyzacje",
  jakosc:"jakosc",diagnostyka:"jakosc",
  audyt:"audyt",historia:"audyt"
});
function agentAISekcjaKanoniczna(value="pulpit"){return AGENT_AI_SEKCJE_KANONICZNE[String(value||"").toLowerCase()]||"pulpit";}
function agentAIMetrykiScalone(){
  const analiza=agentAIAnaliza(),tasks=agentAIAnalizaAktywna(analiza),communication=allegroKomunikacjaStaty(),messages=[...(communication.threads||[]),...(communication.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi).length,availability=pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci).length,offers=allegroAktywneZadaniaAgentaOfert().length,surplus=agentAINadwyzkiDoPrzyjecia().length,docs=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length,onboarding=agentAIProduktyWdrozenie().length,runtime=agentAIRuntime.runtime||{},events=runtime.eventQueue||{},queue=runtime.queue||{},report=agentAIProductReport.data?.summary||{},specialistDecisions=(agentAISpecjalisci.data?.decisions||[]).length;
  return {tasks:tasks.length,bad:tasks.filter(x=>x.poziom==="bad").length,warn:tasks.filter(x=>x.poziom==="warn").length,decisions:availability+messages+offers+surplus+docs,messages,onboarding,docs,queue:Number(events.active||queue.active||0),queued:Number(events.queued||queue.counts?.queued||0),working:Number(events.running||0)+Number(queue.counts?.processing||0)+Number(queue.counts?.delivering||0),readyToList:Number(report.ready_to_list||0),productDecisions:Number(report.decision||0),specialistDecisions,history:Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).length};
}
function agentAIStanSystemuMeta(){
  const runtime=agentAIRuntime.runtime||{},state=String(runtime.state||(!agentAIRuntime.loaded?"loading":"stale")),map={ready:["online","Agent gotowy","Czeka na rzeczywiste zdarzenie"],online:["online","Agent gotowy","Czeka na rzeczywiste zdarzenie"],working:["working","Agent pracuje",runtime.currentWork?.productName||runtime.worker?.currentTask||"Obsługuje odebrany sygnał"],degraded:["warning","Ograniczone działanie","Jedna integracja wymaga kontroli"],stale:["waiting","Agent w gotowości","Brak pracy oznacza brak nowego sygnału"],offline:["offline","Agent offline","Worker wymaga uruchomienia"],loading:["loading","Sprawdzam stan","Pobieranie sygnału z serwera"]};return map[state]||map.loading;
}
function agentAINawigacjaScalonaHTML(active="pulpit"){
  const m=agentAIMetrykiScalone(),groups=[
    {label:"Sterowanie",items:[{id:"pulpit",href:"#/admin/agent-ai",icon:"⌂",label:"Centrum"},{id:"rozmowa",href:"#/admin/agent-ai/rozmowa",icon:"💬",label:"Polecenie"}]},
    {label:"Wykonanie",items:[{id:"praca",href:"#/admin/agent-ai/praca",icon:"◉",label:"Na żywo",badge:m.working||m.queued||""},{id:"raport",href:"#/admin/agent-ai/raport",icon:"▦",label:"Produkty i kanały",badge:m.readyToList||m.productDecisions||""},{id:"zadania",href:"#/admin/agent-ai/zadania",icon:"✓",label:"Decyzje",badge:m.tasks||m.decisions||""}]},
    {label:"System",items:[{id:"automatyzacje",href:"#/admin/agent-ai/automatyzacje",icon:"⚙",label:"Reguły i role",badge:m.specialistDecisions||""},{id:"audyt",href:"#/admin/agent-ai/audyt",icon:"▤",label:"Historia"}]}
  ];
  return `<nav class="panel agent-module-nav" aria-label="Podsekcje Agenta AI"><div class="agent-module-brand"><span>🤖</span><div><small>Centrum wykonawcze</small><b>Agent AI</b></div></div><div class="agent-module-groups">${groups.map(group=>`<section><small>${esc(group.label)}</small><div>${group.items.map(item=>`<a class="${item.id===active?"active":""}" href="${item.href}" ${item.id===active?'aria-current="page"':""}><span>${item.icon}</span><b>${esc(item.label)}</b>${item.badge?`<em>${esc(item.badge)}</em>`:""}</a>`).join("")}</div></section>`).join("")}</div></nav>`;
}
agentAISubnavHTML=function(active="pulpit"){return agentAINawigacjaScalonaHTML(agentAISekcjaKanoniczna(active));};

function agentAIKontekstHTML(){
  const m=agentAIMetrykiScalone(),[state,label,detail]=agentAIStanSystemuMeta(),runtime=agentAIRuntime.runtime||{},events=runtime.eventQueue||{},last=events.recent?.[0],lastAt=last?.completedAt||last?.startedAt||last?.createdAt;
  return `<section class="agent-context-strip"><span class="agent-context-state ${state}"><i></i><b>${esc(label)}</b><small>${esc(detail)}</small></span><span><small>KOLEJKA ZDARZEŃ</small><b>${m.queue} aktywnych • ${m.queued} oczekuje</b></span><span><small>AUTONOMIA</small><b>bezpieczny zapis treści • publikacje chronione</b></span><span><small>OSTATNI SYGNAŁ</small><b>${lastAt?esc(agentAIRuntimeCzas(lastAt)):"brak nowego zdarzenia"}</b></span><button class="btn ghost" onclick="agentAIRuntimePobierz(false)">↻ Odśwież dane</button></section>`;
}
function agentAIPodstronaScalonyNaglowekHTML(active="pulpit"){
  if(active==="pulpit")return "";const m=agentAIMetrykiScalone(),pages={
    rozmowa:["💬","Rozmowa z Agentem","Jedno miejsce do wydawania poleceń zwykłym językiem, sprawdzania odpowiedzi i bezpiecznego potwierdzania zmian.","Nowe polecenie"],
    praca:["◉","Praca Agenta na żywo","Rzeczywisty stan procesu z serwera: aktualnie wykonywane zadanie, kolejne etapy, kolejka, wynik i ewentualny błąd. Gdy Agent czeka, widok mówi o tym wprost.","odświeżanie co 10 s"],
    raport:["▦","Produkty i kanały","Raport trwałych zapisów dla sklepu, Allegro i Von Halsky. Filtry oraz gotowość do wystawienia są aktualizowane po każdym nowym zdarzeniu.","dane z PostgreSQL"],
    zadania:["✓","Zadania i decyzje","Wspólna kolejka aktywnych problemów, decyzji administratora, nowych produktów i źródeł producentów — bez powielania tych samych braków.",`${m.tasks+m.decisions} otwartych`],
    automatyzacje:["⚙","Automatyzacje i zasady","Specjaliści GPT, granice autonomii i pamięć procedur w jednym miejscu konfiguracji.",`${m.specialistDecisions} wyjątków`],
    jakosc:["🛠","Jakość i rozwój strony","Diagnostyka, trwałość zapisów, wydajność i błędy funkcjonalne w jednym miejscu. Agent ma kończyć realne naprawy, a nie tworzyć pozorne zadania.",`${m.bad+m.warn} spraw`],
    audyt:["▤","Audyt i historia","Rozliczalny rejestr zakończonych zadań, wykonań planów i działań administratora oraz Agenta.",`${m.history} zakończonych`]
  },p=pages[active]||pages.zadania;
  return `<section class="panel agent-workspace-header"><div><span>${p[0]}</span><div><small>AGENT AI • ${esc(p[1].toUpperCase())}</small><h1>${esc(p[1])}</h1><p>${esc(p[2])}</p></div></div><strong>${esc(p[3])}</strong></section>`;
}
agentAIPodstronaNaglowekHTML=function(active="pulpit"){return agentAIPodstronaScalonyNaglowekHTML(agentAISekcjaKanoniczna(active));};

function agentAIPulpitScalonyHTML(score=0){
  const m=agentAIMetrykiScalone(),[state,label,detail]=agentAIStanSystemuMeta();
  return `<section class="panel agent-command-center"><div class="agent-command-center-main"><span class="order-pro-label">SYSTEM ZDARZENIOWY • SERWER</span><h1>🤖 Centrum dowodzenia Agenta</h1><p>Agent uruchamia właściwy moduł dopiero po nowym zamówieniu, wiadomości, zmianie produktu albo poleceniu. Trwająca zaległość produktowa jest wykonywana do końca i zapisywana w centralnej kartotece.</p><div class="agent-command-center-actions"><a class="btn" href="#/admin/agent-ai/raport">▦ Raport produktów</a><a class="btn ghost" href="#/admin/agent-ai/rozmowa">💬 Wydaj polecenie</a><a class="btn ghost" href="#/admin/agent-ai/zadania">✓ Otwórz decyzje</a></div></div><aside><div class="health-score">${score}%</div><span class="agent-command-health ${state}"><i></i><b>${esc(label)}</b><small>${esc(detail)}</small></span></aside></section><section class="agent-command-metrics">${[["↗",m.readyToList,"Gotowe do wystawienia","trwale przygotowane w kartotece","#/admin/agent-ai/raport"],["◉",m.productDecisions,"Produkty wymagające decyzji","konkretne braki albo błąd","#/admin/agent-ai/raport"],["⚙",m.queue,"Kolejka zdarzeń",`${m.working} wykonywane • ${m.queued} oczekuje`,`#/admin/agent-ai/praca`],["✓",m.decisions,"Decyzje administratora","sprzedaż i operacje chronione","#/admin/agent-ai/zadania"]].map(([icon,value,title,note,href])=>`<a href="${href}"><span>${icon}</span><div><b>${value}</b><strong>${esc(title)}</strong><small>${esc(note)}</small></div><em>→</em></a>`).join("")}</section><div id="agentAIRuntimePanel">${agentAIRuntimePanelHTML()}</div>`;
}
function agentAIRozmowaScalonaHTML(){
  const answers=(agentAIHistoria||[]).filter(h=>h.typ==="komenda"&&h.dane&&h.dane.odpowiedz).slice(0,8);
  const quick=[["📦","Sprawdź nowe zamówienia","sprawdź czy wpadło nowe zlecenie"],["🏬","Pokaż realne braki","czego brakuje do aktywnych zamówień"],["🚚","Sprawdź wysyłki","sprawdź wysyłki i InPost"],["🏷️","Audyt produktów","audyt produktów i katalogu"],["🏭","Sprawdź producentów","sprawdź dostępność u producentów"],["🔄","Synchronizuj dane","synchronizuj bazę"]];
  const more=[["Przygotuj zamówienie do producenta","przygotuj zamówienie do producenta"],["Popraw opisy produktów","popraw opisy produktów"],["Pokaż stan magazynu","pokaż stan magazynu"],["Sprawdź integracje","diagnostyka integracji"],["Pokaż pamięć","pokaż pamięć"],["Naucz Agenta","zapamiętaj: "]];
  return `<section class="panel agent-conversation"><div class="agent-conversation-head"><div><span>🤖</span><div><small>CODEX + GPT‑5 NANO + DANE SKLEPU</small><h2>Co mam zrobić?</h2><p>Pisz normalnie po polsku. Agent najpierw sprawdza dane i pokazuje plan; zmiany magazynowe oraz działania zewnętrzne wymagają osobnego potwierdzenia.</p></div></div><span id="agentAICommandCloudState" class="lvl ${chmuraStan.dostepna?"lvl-ok":"lvl-info"}">${chmuraStan.dostepna?`wspólna baza • rewizja ${chmuraStan.rev||0}`:"łączenie z bazą"}</span></div><form class="agent-conversation-form" onsubmit="return agentAIPrzyjmijKomende(event)"><textarea id="agentAICommandInput" rows="4" placeholder="Np. sprawdź nowe zamówienia i przygotuj listę brakujących produktów…"></textarea><div><button class="btn" type="submit">🤖 Przekaż Agentowi</button><button class="btn ghost" type="button" onclick="agentAIWstawKomende('wykonaj bezpieczny plan agenta')">▶ Bezpieczna kontrola</button></div></form><div class="agent-command-presets">${quick.map(([icon,label,command])=>`<button type="button" onclick="agentAIWstawKomende(${jsArg(command)})"><span>${icon}</span><b>${esc(label)}</b></button>`).join("")}</div><details class="agent-more-commands"><summary>Więcej gotowych poleceń</summary><div>${more.map(([label,command])=>`<button class="btn ghost" type="button" onclick="agentAIWstawKomende(${jsArg(command)})">${esc(label)}</button>`).join("")}</div></details><div class="agent-command-safety"><span>🛡️</span><div><b>Bezpieczna zasada wykonania</b><small>Rozmowa nie zmienia stanu sama. Agent tworzy osobną decyzję z lokalizacją, ilością i przyciskami Potwierdzam / Odrzucam.</small></div></div><div id="agentAICommandLiveResult" class="agent-response-card agent-command-live-result" hidden></div><div id="agentInventoryDecisionPanel">${agentAIDecyzjeMagazynowePanelHTML()}</div>${answers.length?`<section class="agent-conversation-history"><div><b>Ostatnie odpowiedzi</b><a href="#/admin/agent-ai/audyt">Pełny audyt →</a></div>${answers.map(h=>`<article><header><b>${esc(h.dane.polecenie||"Polecenie")}</b><small>${esc(h.dataTxt||"")}</small></header><pre>${esc(h.dane.odpowiedz||"")}</pre></article>`).join("")}</section>`:`<div class="agent-ops-empty">Nie ma jeszcze odpowiedzi z panelu. Wpisz pierwsze polecenie powyżej.</div>`}</section>`;
}
function agentAIPracaNaZywoHTML(){
  const runtime=agentAIRuntime.runtime||{},worker=runtime.worker||{},queue=runtime.queue||{},counts=queue.counts||{},current=runtime.currentRun,work=runtime.currentWork;
  const working=!!(current||work||worker.currentTask||Number(counts.processing||0)+Number(counts.delivering||0));
  const exact=work?`${work.productName||"Zadanie"}: ${work.action||"operacja"} — ${work.phase||"wykonywanie"} → ${work.target||work.channel||"system"}`:"";
  return `<section class="agent-live-truth ${working?"is-working":"is-waiting"}"><div><span>${working?"⚙":"✓"}</span><div><small>STAN POTWIERDZONY PRZEZ SERWER</small><b>${working?"Agent wykonuje teraz konkretną czynność":"Agent jest gotowy i obecnie czeka"}</b><p>${esc(exact||current?.summary||worker.currentTask||(agentAIRuntime.loaded?"Nie ma aktywnej czynności. Następna praca rozpocznie się dopiero po nowym zdarzeniu albo poleceniu administratora.":"Łączenie z procesem wykonawczym…"))}</p></div></div><div><span><small>W toku</small><b>${esc((counts.processing||0)+(counts.delivering||0)+(work?1:0))}</b></span><span><small>Publikacje oczekujące</small><b>${esc(runtime.publication?.counts?.pending||0)}</b></span><a class="btn" href="#/admin/agent-ai/rozmowa">Wydaj polecenie</a></div></section><div id="agentAIRuntimePanel">${agentAIRuntimePanelHTML()}</div>`;
}
function agentAIProductReportChannel(channel="all"){
  return {all:"Wszystkie kanały",store:"Sklep",allegro:"Allegro",von_halsky:"Von Halsky"}[channel]||"Wszystkie kanały";
}
function agentAIProductReportStatus(status=""){
  return {working:["W toku","lvl-info"],ready:["Gotowe","lvl-ok"],needs_data:["Do uzupełnienia","lvl-ostrzezenie"],decision:["Decyzja / błąd","lvl-blad"],not_started:["Nie rozpoczęto","lvl-info"]}[status]||["Sprawdzanie","lvl-info"];
}
function agentAIProductReportChannelCell(channel={}){
  const state=channel.ready?"ready":channel.prepared?"attention":"empty",label=channel.ready?"gotowe":channel.prepared?"wymaga uzupełnienia":"nie rozpoczęto";
  return `<span class="agent-report-channel ${state}"><i>${channel.ready?"✓":channel.prepared?"!":"○"}</i><b>${label}</b><small>${channel.updatedAt?esc(agentAIRuntimeCzas(channel.updatedAt)):"brak zapisu"}</small>${channel.savedFields?.length?`<em>${esc(channel.savedFields.slice(0,3).map(agentAIPolePracyLabel).join(", "))}${channel.savedFields.length>3?` +${channel.savedFields.length-3}`:""}</em>`:""}</span>`;
}
function agentAIProductReportHTML(){
  const state=agentAIProductReport,data=state.data||{},summary=data.summary||{},items=Array.isArray(data.items)?data.items:[],filters=agentAIProductReportFilters||{},pages=Math.max(1,Number(data.pages)||1),page=Math.min(pages,Number(data.page||filters.page)||1);
  if(state.loading&&!state.loaded)return `<section class="panel agent-report-loading"><div class="agent-runtime-loading"><i></i><div><b>Pobieram raport centralnych kartotek…</b><small>Liczenie odbywa się na serwerze bez ładowania całego katalogu do przeglądarki.</small></div></div></section>`;
  if(state.error&&!data.available)return `<section class="panel"><div class="backend-note warn"><b>Nie udało się pobrać raportu produktów.</b><p>${esc(state.error)}</p><button class="btn" onclick="agentAIProductReportPobierz(false)">Ponów</button></div></section>`;
  const progress=(ready,total)=>total?Math.round(Number(ready||0)/Number(total)*100):0;
  const cards=[
    ["working","⚙",summary.working||0,"Agent pracuje"],
    ["decision","!",summary.decision||0,"Decyzje i błędy"],
    ["ready","✓",summary.full_review_confirmed||0,"Pełna kontrola zakończona"],
    ["ready_to_list","↗",summary.ready_to_list||0,"Gotowe do wystawienia"],
    ["needs_update","↻",summary.needs_update||0,"Oferty do aktualizacji"]
  ];
  return `<section class="agent-product-report">
    <section class="agent-report-overview">
      <article><div><span>🛍</span><b>Sklep</b><small>${esc(summary.store_prepared||0)} opisów zapisanych</small></div><strong>${progress(summary.store_ready,summary.total)}%</strong><progress max="100" value="${progress(summary.store_ready,summary.total)}"></progress></article>
      <article><div><span>🟠</span><b>Allegro</b><small>${esc(summary.allegro_prepared||0)} produktów przygotowanych</small></div><strong>${progress(summary.allegro_ready,summary.total)}%</strong><progress max="100" value="${progress(summary.allegro_ready,summary.total)}"></progress></article>
      <article><div><span>📦</span><b>Von Halsky</b><small>${esc(summary.von_prepared||0)} produktów sprawdzonych</small></div><strong>${progress(summary.von_ready,summary.total)}%</strong><progress max="100" value="${progress(summary.von_ready,summary.total)}"></progress></article>
    </section>
    <section class="agent-report-counters">${cards.map(([id,icon,count,label])=>`<button type="button" class="${filters.status===id||filters.listing===id?"active":""}" onclick="${["ready_to_list","needs_update"].includes(id)?`agentAIProductReportFiltr('listing','${id}')`:`agentAIProductReportFiltr('status','${id}')`}"><span>${icon}</span><b>${esc(count)}</b><small>${esc(label)}</small></button>`).join("")}</section>
    <section class="panel agent-report-catalog">
      <header><div><span class="order-pro-label">TRWAŁY ZAPIS • RAPORT NA ŻYWO</span><h2>Produkty obsłużone przez Agenta</h2><p>Wiersz pojawia się lub zmienia dopiero po rzeczywistym zdarzeniu i zapisie centralnej kartoteki.</p></div><span class="agent-report-live"><i></i> automatyczne odświeżanie co 10 s</span></header>
      <div class="agent-report-filters">
        <label class="search-wide">Szukaj<input id="agentAIProductReportSearch" value="${esc(filters.query||"")}" placeholder="Nazwa, EAN, SKU, EXTERNAL_ID lub producent…" oninput="agentAIProductReportSzukaj(this)" autocomplete="off"></label>
        <label>Kanał<select onchange="agentAIProductReportFiltr('channel',this.value)">${[["all","Wszystkie"],["store","Sklep"],["allegro","Allegro"],["von_halsky","Von Halsky"]].map(([id,label])=>`<option value="${id}" ${filters.channel===id?"selected":""}>${label}</option>`).join("")}</select></label>
        <label>Stan pracy<select onchange="agentAIProductReportFiltr('status',this.value)">${[["all","Wszystkie"],["working","W toku"],["ready","Gotowe"],["needs_data","Do uzupełnienia"],["decision","Decyzja / błąd"],["not_started","Nie rozpoczęto"]].map(([id,label])=>`<option value="${id}" ${filters.status===id?"selected":""}>${label}</option>`).join("")}</select></label>
        <label>Publikacja<select onchange="agentAIProductReportFiltr('listing',this.value)">${[["all","Wszystkie"],["ready_to_list","Gotowe do wystawienia"],["needs_update","Do aktualizacji"],["already_listed","Już na Allegro"],["hidden","Ukryte w sprzedaży"]].map(([id,label])=>`<option value="${id}" ${filters.listing===id?"selected":""}>${label}</option>`).join("")}</select></label>
        <label>Na stronie<select onchange="agentAIProductReportFiltr('limit',this.value)">${[25,50,100,250].map(limit=>`<option value="${limit}" ${Number(filters.limit)===limit?"selected":""}>${limit}</option>`).join("")}</select></label>
        <button class="btn ghost" onclick="agentAIProductReportWyczysc()">Wyczyść filtry</button>
      </div>
      <div class="agent-report-result-meta"><div><b>${esc(data.total||0)} wyników</b><small>${esc(agentAIProductReportChannel(filters.channel))} • aktualizacja ${data.revision?esc(agentAIRuntimeCzas(data.revision)):"brak zmian"}</small></div><button class="btn ghost" onclick="agentAIProductReportPobierz(false)">↻ Odśwież teraz</button></div>
      <div class="agent-report-table">
        <div class="agent-report-table-head"><span>Produkt</span><span>Sklep</span><span>Allegro</span><span>Von Halsky</span><span>Wynik i działanie</span></div>
        ${items.map(item=>{const status=agentAIProductReportStatus(item.status),missing=item.task?.missing||[],review=item.fullReview||{},reviewDue=review.verificationDueAt?new Date(review.verificationDueAt).toLocaleDateString("pl-PL"):"";return `<article class="status-${esc(item.status)}">
          <div class="agent-report-product">${item.image?`<img src="${esc(item.image)}" alt="" loading="lazy">`:`<span>📦</span>`}<div><b>${esc(item.name||`Produkt ${item.productId}`)}</b><small>ID ${esc(item.productId)} • EAN ${esc(item.ean||"—")}</small><em>${esc(item.producer||"producent nieustalony")}</em></div></div>
          ${agentAIProductReportChannelCell(item.store)}${agentAIProductReportChannelCell(item.allegro)}${agentAIProductReportChannelCell(item.vonHalsky)}
          <div class="agent-report-result"><span class="lvl ${status[1]}">${esc(status[0])}</span>${review.current?`<b>✓ Pełna kontrola zapisana</b><small>Nie wymaga natychmiastowej weryfikacji${reviewDue?` • następna po ${esc(reviewDue)}`:""}</small>`:item.allegro?.readyToList?`<b>Gotowy do wystawienia na Allegro</b>`:item.allegro?.needsUpdate?`<b>Oferta wymaga aktualizacji</b>`:""}${missing.length&&!review.current?`<small>Braki: ${esc(missing.slice(0,4).join(", "))}</small>`:!review.current?`<small>Ostatni zapis ${esc(agentAIRuntimeCzas(item.updatedAt))}</small>`:""}<div><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(item.productId)}">Edytuj</a>${item.allegro?.readyToList?`<a class="btn" href="#/admin/allegro/oferty">Wystaw</a>`:""}</div></div>
        </article>`;}).join("")||`<div class="agent-ops-empty"><span>✓</span><b>Brak produktów dla wybranych filtrów</b><small>Widok odświeży się automatycznie, gdy wpłynie nowe zdarzenie.</small></div>`}
      </div>
      ${pages>1?`<nav class="agent-report-pagination"><button class="btn ghost" onclick="agentAIProductReportFiltr('page',${page-1})" ${page<=1?"disabled":""}>← Poprzednia</button><span>Strona <b>${page}</b> z <b>${pages}</b></span><button class="btn ghost" onclick="agentAIProductReportFiltr('page',${page+1})" ${page>=pages?"disabled":""}>Następna →</button></nav>`:""}
    </section>
  </section>`;
}
function agentAIProductReportPageHTML(){return `<div id="agentAIProductReportPanel">${agentAIProductReportHTML()}</div>`;}
function agentAIObszarHTML(id,title,description,content,open=false,badge=""){
  return `<details class="agent-workspace-fold" id="${esc(id)}" ${open?"open":""}><summary><span><b>${esc(title)}</b><small>${esc(description)}</small></span>${badge?`<em>${esc(badge)}</em>`:""}<i>⌄</i></summary><div>${content}</div></details>`;
}
function agentAIOtworzObszar(id){
  const area=document.getElementById(String(id||""));if(!area)return;area.open=true;area.scrollIntoView({behavior:"smooth",block:"start"});
}
function agentAIZadaniaScaloneHTML(analysis,requested="zadania"){
  const m=agentAIMetrykiScalone(),openPlan=!['produkty','producenci'].includes(requested),openProducts=requested==='produkty',openSources=requested==='producenci';
  return `<section class="agent-section-directory"><button type="button" onclick="agentAIOtworzObszar('agent-work-plan')"><span>✓</span><div><b>${m.tasks}</b><small>aktywnych zadań</small></div></button><button type="button" onclick="agentAIOtworzObszar('agent-work-decisions')"><span>◉</span><div><b>${m.decisions}</b><small>decyzji administratora</small></div></button><button type="button" onclick="agentAIOtworzObszar('agent-work-products')"><span>✨</span><div><b>${m.onboarding}</b><small>nowych produktów</small></div></button><button type="button" onclick="agentAIOtworzObszar('agent-work-sources')"><span>🏭</span><div><b>${m.docs}</b><small>dokumentów producentów</small></div></button></section>${agentAIObszarHTML("agent-work-plan","Plan operacyjny","Jedna kolejka rzeczywistych problemów i bezpiecznych działań Agenta.",agentAIPlanOperacyjnyHTML(analysis),openPlan,`${m.tasks} aktywnych`)}${agentAIObszarHTML("agent-work-decisions","Decyzje administratora","Tylko operacje wymagające świadomego wyboru człowieka.",agentAICentrumDecyzjiHTML(),requested==='plan',`${m.decisions} otwartych`)}${agentAIObszarHTML("agent-work-products","Wdrożenie nowych produktów","Kontrola kartoteki, opisów, zdjęć, duplikatów i gotowości Allegro.",agentAIProduktyWdrozeniePanelHTML(),openProducts,`${m.onboarding} pozycji`)}${agentAIObszarHTML("agent-work-sources","Producenci i źródła danych","Kolejka linków oraz kartoteki kontaktowe wykorzystywane przez Agentów i Plan zatowarowania.",`${agentAILinkiProducentowPanelHTML()}${producenciKartotekaPanelHTML()}`,openSources,`${m.docs} dokumentów`)}`;
}
function agentAIAutomatyzacjeScaloneHTML(requested="automatyzacje"){
  const decisions=(agentAISpecjalisci.data?.decisions||[]).length,memory=(agentAIPamiec||[]).length;
  return `<section class="agent-automation-overview"><article><span>✦</span><div><b>Specjaliści GPT‑5 nano</b><small>Role do opisów, SEO, Allegro, komunikacji i kontroli jakości.</small></div><em>${decisions} wyjątków</em></article><article><span>🛡️</span><div><b>Granice autonomii</b><small>Wyraźny podział: wykonaj automatycznie, przygotuj albo zapytaj.</small></div><em>ochrona aktywna</em></article><article><span>🧠</span><div><b>Pamięć procedur</b><small>Reguły synchronizowane między urządzeniami administratorów.</small></div><em>${memory} reguł</em></article></section>${agentAIObszarHTML("agent-auto-specialists","Specjaliści i wykonania","Uruchamianie konkretnych ról oraz podgląd ich wyników.",agentAISpecjalisciPanelHTML(),requested!=="uprawnienia"&&requested!=="pamiec",`${decisions} wyjątków`)}${agentAIObszarHTML("agent-auto-permissions","Uprawnienia i potwierdzenia","Jedno źródło zasad określających, co Agent może zapisać sam.",agentAIUprawnieniaPanelHTML(),requested==="uprawnienia","chronione")}${agentAIObszarHTML("agent-auto-memory","Pamięć i procedury","Trwałe reguły pracy używane przy kolejnych analizach.",agentAIPamiecPanelHTML(),requested==="pamiec",`${memory} reguł`)}`;
}
function agentAIJakoscStronyHTML(){
  const m=agentAIMetrykiScalone(),runtime=agentAIRuntime.runtime||{},warnings=Array.isArray(runtime.integrationWarnings)?runtime.integrationWarnings:[];
  return `<section class="agent-observer-metrics"><article class="${m.bad?"warning":"safe"}"><span>×</span><div><b>${esc(m.bad)}</b><small>błędów wymagających naprawy</small></div></article><article class="${m.warn?"warning":"safe"}"><span>!</span><div><b>${esc(m.warn)}</b><small>ostrzeżeń do sprawdzenia</small></div></article><article class="${warnings.length?"warning":"safe"}"><span>⚙</span><div><b>${esc(warnings.length)}</b><small>błędów ostatniego zdarzenia</small></div></article></section><section class="panel agent-live-work"><div class="order-section-head"><div><span class="order-pro-label">Rzeczywista kontrola serwera</span><h2>Funkcjonalność i trwałość strony</h2><p class="order-detail-lead">Kontrola odczytuje stan serwera, zapisów i integracji. Zakończenie jest raportowane dopiero po otrzymaniu odpowiedzi i trwałym zapisie wyniku.</p></div><div class="diag-actions"><button class="btn" onclick="agentAIWykonaj('plan-bezpieczny')">▶ Uruchom kontrolę</button><a class="btn ghost" href="#/admin/system/diagnostyka">Pełna diagnostyka</a></div></div>${warnings.length?`<div class="agent-now-steps">${warnings.map(item=>`<article class="warning"><span>!</span><div><b>${esc(item.label||item.id)}</b><small>${esc(item.error||"Wymaga sprawdzenia")}</small></div></article>`).join("")}</div>`:`<div class="agent-decision-empty"><span>✓</span><div><b>Ostatnie zdarzenie bez błędów wykonania</b><small>Agent pozostaje gotowy na nowy sygnał lub ręczne polecenie.</small></div></div>`}</section>`;
}
function agentAIScalonaTrescSekcji(active,analysis,requested,score){
  if(active==="rozmowa")return agentAIRozmowaScalonaHTML();
  if(active==="praca")return agentAIPracaNaZywoHTML();
  if(active==="raport")return agentAIProductReportPageHTML();
  if(active==="zadania")return agentAIZadaniaScaloneHTML(analysis,requested);
  if(active==="automatyzacje")return agentAIAutomatyzacjeScaloneHTML(requested);
  if(active==="jakosc")return agentAIJakoscStronyHTML();
  if(active==="audyt")return agentAIHistoriaPanelHTML();
  return typeof agentAIPulpitObserwowalnoscHTML==="function"?agentAIPulpitObserwowalnoscHTML(score):agentAIPulpitScalonyHTML(score);
}
widokAdminAgentAI=function(section="pulpit"){
  allegroLadujJesliTrzeba("orders");const requested=String(section||"pulpit").toLowerCase(),active=agentAISekcjaKanoniczna(requested),analysis=agentAIAnaliza(),tasks=agentAIAnalizaAktywna(analysis),score=Math.max(0,Math.round(100-(tasks.filter(x=>x.poziom==="bad").length*18)-(tasks.filter(x=>x.poziom==="warn").length*8))),runtimeAge=Date.now()-Number(agentAIRuntime.updatedAt||0);
  if((!agentAIRuntime.loaded||runtimeAge>60_000)&&!agentAIRuntime.loading)setTimeout(()=>agentAIRuntimePobierz(true),0);
  if(["pulpit","praca","raport"].includes(active))setTimeout(()=>agentAIRuntimePolling(),0);
  if(active==="raport"&&(!agentAIProductReport.loaded||Date.now()-Number(agentAIProductReport.updatedAt||0)>30_000)&&!agentAIProductReport.loading)setTimeout(()=>agentAIProductReportPobierz(true),0);
  if(["pulpit","automatyzacje"].includes(active)&&!agentAISpecjalisci.loaded&&!agentAISpecjalisci.loading)setTimeout(()=>agentAISpecjalisciPobierz(false),0);
  if(["pulpit","automatyzacje"].includes(active))setTimeout(()=>agentAISpecjalisciPolling(),0);
  const decisionAge=Date.now()-(Date.parse(agentAIDecyzjeMagazynowe.updatedAt)||0);if(["rozmowa","zadania"].includes(active)&&(!agentAIDecyzjeMagazynowe.loaded||decisionAge>60_000)&&!agentAIDecyzjeMagazynowe.loading)setTimeout(()=>agentAIDecyzjeMagazynowePobierz(true),0);
  return adminSzkielet("/admin/agent-ai",`${agentAINawigacjaScalonaHTML(active)}${agentAIKontekstHTML()}${agentAIPodstronaScalonyNaglowekHTML(active)}<main class="agent-workspace agent-workspace-${active}">${agentAIScalonaTrescSekcji(active,analysis,requested,score)}</main>`);
};
