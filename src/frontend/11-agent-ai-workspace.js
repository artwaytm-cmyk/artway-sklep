/* ═══════════ AGENT AI — SCALONE PROFESJONALNE CENTRUM ═══════════ */
const AGENT_AI_SEKCJE_KANONICZNE=Object.freeze({
  pulpit:"pulpit",centrum:"pulpit",
  rozmowa:"rozmowa",komendy:"rozmowa",
  zadania:"zadania",plan:"zadania",produkty:"zadania",zlecenia:"zadania",producenci:"zadania",
  automatyzacje:"automatyzacje",specjalisci:"automatyzacje",uprawnienia:"automatyzacje",pamiec:"automatyzacje",
  komunikacja:"komunikacja",telegram:"komunikacja",
  audyt:"audyt",historia:"audyt"
});
function agentAISekcjaKanoniczna(value="pulpit"){return AGENT_AI_SEKCJE_KANONICZNE[String(value||"").toLowerCase()]||"pulpit";}
function agentAIMetrykiScalone(){
  const analiza=agentAIAnaliza(),tasks=agentAIAnalizaAktywna(analiza),communication=allegroKomunikacjaStaty(),messages=[...(communication.threads||[]),...(communication.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi).length,availability=pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci).length,offers=allegroAktywneZadaniaAgentaOfert().length,surplus=agentAINadwyzkiDoPrzyjecia().length,docs=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length,onboarding=agentAIProduktyWdrozenie().length,runtime=agentAIRuntime.runtime||{},queue=runtime.queue||{},specialistDecisions=(agentAISpecjalisci.data?.decisions||[]).length;
  return {tasks:tasks.length,bad:tasks.filter(x=>x.poziom==="bad").length,warn:tasks.filter(x=>x.poziom==="warn").length,decisions:availability+messages+offers+surplus+docs,messages,onboarding,docs,queue:Number(queue.active||0),queued:Number(queue.counts?.queued||0),working:Number(queue.counts?.processing||0)+Number(queue.counts?.delivering||0),specialistDecisions,history:Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).length};
}
function agentAIStanSystemuMeta(){
  const runtime=agentAIRuntime.runtime||{},state=String(runtime.state||(!agentAIRuntime.loaded?"loading":"stale")),map={online:["online","Agent online","Automatyczne cykle odpowiadają"],working:["working","Agent pracuje",runtime.worker?.currentTask||"Trwa cykl automatyczny"],degraded:["warning","Ograniczone działanie","Jedna integracja wymaga kontroli"],stale:["waiting","Oczekiwanie na cykl","Proces pozostaje gotowy"],offline:["offline","Agent offline","Worker wymaga uruchomienia"],loading:["loading","Sprawdzam stan","Pobieranie sygnału z serwera"]};return map[state]||map.loading;
}
function agentAINawigacjaScalonaHTML(active="pulpit"){
  const m=agentAIMetrykiScalone(),groups=[
    {label:"Sterowanie",items:[{id:"pulpit",href:"#/admin/agent-ai",icon:"⌂",label:"Centrum"},{id:"rozmowa",href:"#/admin/agent-ai/rozmowa",icon:"💬",label:"Rozmowa"}]},
    {label:"Praca",items:[{id:"zadania",href:"#/admin/agent-ai/zadania",icon:"✓",label:"Zadania i decyzje",badge:m.tasks||m.decisions||""}]},
    {label:"System",items:[{id:"automatyzacje",href:"#/admin/agent-ai/automatyzacje",icon:"⚙",label:"Automatyzacje",badge:m.specialistDecisions||""}]},
    {label:"Zespół",items:[{id:"komunikacja",href:"#/admin/agent-ai/komunikacja",icon:"✈",label:"Telegram",badge:agentAITelegram.stats?.critical||""}]},
    {label:"Kontrola",items:[{id:"audyt",href:"#/admin/agent-ai/audyt",icon:"▤",label:"Audyt"}]}
  ];
  return `<nav class="panel agent-module-nav" aria-label="Podsekcje Agenta AI"><div class="agent-module-brand"><span>🤖</span><div><small>Centrum wykonawcze</small><b>Agent AI</b></div></div><div class="agent-module-groups">${groups.map(group=>`<section><small>${esc(group.label)}</small><div>${group.items.map(item=>`<a class="${item.id===active?"active":""}" href="${item.href}" ${item.id===active?'aria-current="page"':""}><span>${item.icon}</span><b>${esc(item.label)}</b>${item.badge?`<em>${esc(item.badge)}</em>`:""}</a>`).join("")}</div></section>`).join("")}</div></nav>`;
}
agentAISubnavHTML=function(active="pulpit"){return agentAINawigacjaScalonaHTML(agentAISekcjaKanoniczna(active));};

function agentAIKontekstHTML(){
  const m=agentAIMetrykiScalone(),[state,label,detail]=agentAIStanSystemuMeta(),runtime=agentAIRuntime.runtime||{},next=runtime.scheduler?.nextRunAt||runtime.nextRunAt||agentAISpecjalisci.data?.scheduler?.nextRunAt||"";
  return `<section class="agent-context-strip"><span class="agent-context-state ${state}"><i></i><b>${esc(label)}</b><small>${esc(detail)}</small></span><span><small>KOLEJKA</small><b>${m.queue} aktywnych • ${m.queued} oczekuje</b></span><span><small>AUTONOMIA</small><b>opisy i SEO • działania zewnętrzne chronione</b></span><span><small>NASTĘPNY CYKL</small><b>${next?esc(agentAIRuntimeCzas(next)):"harmonogram 15 min"}</b></span><button class="btn ghost" onclick="agentAIRuntimePobierz(false)">↻ Sprawdź stan</button></section>`;
}
function agentAIPodstronaScalonyNaglowekHTML(active="pulpit"){
  if(active==="pulpit")return "";const m=agentAIMetrykiScalone(),pages={
    rozmowa:["💬","Rozmowa z Agentem","Jedno miejsce do wydawania poleceń zwykłym językiem, sprawdzania odpowiedzi i bezpiecznego potwierdzania zmian.","Nowe polecenie"],
    zadania:["✓","Zadania i decyzje","Wspólna kolejka aktywnych problemów, decyzji administratora, nowych produktów i źródeł producentów — bez powielania tych samych braków.",`${m.tasks+m.decisions} otwartych`],
    automatyzacje:["⚙","Automatyzacje i zasady","Specjaliści GPT, granice autonomii i pamięć procedur w jednym miejscu konfiguracji.",`${m.specialistDecisions} wyjątków`],
    komunikacja:["✈","Komunikacja zespołu","Jeden bot Telegram, wspólna kolejka spraw, dostarczenia i ręczne notatki do zespołu.",`${agentAITelegram.stats?.critical||0} pilnych`],
    audyt:["▤","Audyt i historia","Rozliczalny rejestr zakończonych zadań, wykonań planów i działań administratora oraz Agenta.",`${m.history} zakończonych`]
  },p=pages[active]||pages.zadania;
  return `<section class="panel agent-workspace-header"><div><span>${p[0]}</span><div><small>AGENT AI • ${esc(p[1].toUpperCase())}</small><h1>${esc(p[1])}</h1><p>${esc(p[2])}</p></div></div><strong>${esc(p[3])}</strong></section>`;
}
agentAIPodstronaNaglowekHTML=function(active="pulpit"){return agentAIPodstronaScalonyNaglowekHTML(agentAISekcjaKanoniczna(active));};

function agentAIPulpitScalonyHTML(score=0){
  const m=agentAIMetrykiScalone(),[state,label,detail]=agentAIStanSystemuMeta();
  return `<section class="panel agent-command-center"><div class="agent-command-center-main"><span class="order-pro-label">AUTOMATYCZNY KONTROLER SKLEPU</span><h1>🤖 Centrum dowodzenia Agenta</h1><p>Agent stale kontroluje sklep, porządkuje treści i przygotowuje pracę. Tutaj widzisz wyłącznie aktualny stan, najważniejszą kolejkę i działania wymagające Twojej decyzji.</p><div class="agent-command-center-actions"><a class="btn" href="#/admin/agent-ai/rozmowa">💬 Wydaj polecenie</a><a class="btn ghost" href="#/admin/agent-ai/zadania">✓ Otwórz kolejkę</a><button class="btn ghost" onclick="agentAIWykonaj('plan-bezpieczny')" ${agentAIPlanStan.busy?"disabled":""}>${agentAIPlanStan.busy?"⏳ Kontrola trwa":"▶ Uruchom bezpieczną kontrolę"}</button></div></div><aside><div class="health-score">${score}%</div><span class="agent-command-health ${state}"><i></i><b>${esc(label)}</b><small>${esc(detail)}</small></span></aside></section><section class="agent-command-metrics">${[["⚠",m.tasks,"Aktywne zadania",m.bad?`${m.bad} pilnych`:`${m.warn} ostrzeżeń`,"#/admin/agent-ai/zadania"],["◉",m.decisions,"Decyzje administratora","sprzedaż i operacje chronione","#/admin/agent-ai/zadania"],["⚙",m.queue,"Kolejka wykonawcza",`${m.working} wykonywane • ${m.queued} oczekuje`,`#/admin/agent-ai/automatyzacje`],["✨",m.onboarding,"Nowe produkty","kontrola kartotek i Allegro","#/admin/agent-ai/zadania"]].map(([icon,value,title,note,href])=>`<a href="${href}"><span>${icon}</span><div><b>${value}</b><strong>${esc(title)}</strong><small>${esc(note)}</small></div><em>→</em></a>`).join("")}</section><div id="agentAIRuntimePanel">${agentAIRuntimePanelHTML()}</div>${agentAIInicjatywaPanelHTML()}`;
}
function agentAIRozmowaScalonaHTML(){
  const answers=(agentAIHistoria||[]).filter(h=>h.typ==="komenda"&&h.dane&&h.dane.odpowiedz).slice(0,8);
  const quick=[["📦","Sprawdź nowe zamówienia","sprawdź czy wpadło nowe zlecenie"],["🏬","Pokaż realne braki","czego brakuje do aktywnych zamówień"],["🚚","Sprawdź wysyłki","sprawdź wysyłki i InPost"],["🏷️","Audyt produktów","audyt produktów i katalogu"],["🏭","Sprawdź producentów","sprawdź dostępność u producentów"],["🔄","Synchronizuj dane","synchronizuj bazę"]];
  const more=[["Przygotuj zamówienie do producenta","przygotuj zamówienie do producenta"],["Popraw opisy produktów","popraw opisy produktów"],["Pokaż stan magazynu","pokaż stan magazynu"],["Sprawdź integracje","diagnostyka integracji"],["Pokaż pamięć","pokaż pamięć"],["Naucz Agenta","zapamiętaj: "]];
  return `<section class="panel agent-conversation"><div class="agent-conversation-head"><div><span>🤖</span><div><small>CODEX + GPT‑5 NANO + DANE SKLEPU</small><h2>Co mam zrobić?</h2><p>Pisz normalnie po polsku. Agent najpierw sprawdza dane i pokazuje plan; zmiany magazynowe oraz działania zewnętrzne wymagają osobnego potwierdzenia.</p></div></div><span id="agentAICommandCloudState" class="lvl ${chmuraStan.dostepna?"lvl-ok":"lvl-info"}">${chmuraStan.dostepna?`wspólna baza • rewizja ${chmuraStan.rev||0}`:"łączenie z bazą"}</span></div><form class="agent-conversation-form" onsubmit="return agentAIPrzyjmijKomende(event)"><textarea id="agentAICommandInput" rows="4" placeholder="Np. sprawdź nowe zamówienia i przygotuj listę brakujących produktów…"></textarea><div><button class="btn" type="submit">🤖 Przekaż Agentowi</button><button class="btn ghost" type="button" onclick="agentAIWstawKomende('wykonaj bezpieczny plan agenta')">▶ Bezpieczna kontrola</button></div></form><div class="agent-command-presets">${quick.map(([icon,label,command])=>`<button type="button" onclick="agentAIWstawKomende(${jsArg(command)})"><span>${icon}</span><b>${esc(label)}</b></button>`).join("")}</div><details class="agent-more-commands"><summary>Więcej gotowych poleceń</summary><div>${more.map(([label,command])=>`<button class="btn ghost" type="button" onclick="agentAIWstawKomende(${jsArg(command)})">${esc(label)}</button>`).join("")}</div></details><div class="agent-command-safety"><span>🛡️</span><div><b>Bezpieczna zasada wykonania</b><small>Rozmowa nie zmienia stanu sama. Agent tworzy osobną decyzję z lokalizacją, ilością i przyciskami Potwierdzam / Odrzucam.</small></div></div><div id="agentAICommandLiveResult" class="agent-response-card agent-command-live-result" hidden></div><div id="agentInventoryDecisionPanel">${agentAIDecyzjeMagazynowePanelHTML()}</div>${answers.length?`<section class="agent-conversation-history"><div><b>Ostatnie odpowiedzi</b><a href="#/admin/agent-ai/audyt">Pełny audyt →</a></div>${answers.map(h=>`<article><header><b>${esc(h.dane.polecenie||"Polecenie")}</b><small>${esc(h.dataTxt||"")}</small></header><pre>${esc(h.dane.odpowiedz||"")}</pre></article>`).join("")}</section>`:`<div class="agent-ops-empty">Nie ma jeszcze odpowiedzi z panelu. Wpisz pierwsze polecenie powyżej.</div>`}</section>`;
}
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
function agentAIScalonaTrescSekcji(active,analysis,requested,score){
  if(active==="rozmowa")return agentAIRozmowaScalonaHTML();
  if(active==="zadania")return agentAIZadaniaScaloneHTML(analysis,requested);
  if(active==="automatyzacje")return agentAIAutomatyzacjeScaloneHTML(requested);
  if(active==="komunikacja")return agentAITelegramPanelHTML();
  if(active==="audyt")return agentAIHistoriaPanelHTML();
  return typeof agentAIPulpitObserwowalnoscHTML==="function"?agentAIPulpitObserwowalnoscHTML(score):agentAIPulpitScalonyHTML(score);
}
widokAdminAgentAI=function(section="pulpit"){
  allegroLadujJesliTrzeba("orders");const requested=String(section||"pulpit").toLowerCase(),active=agentAISekcjaKanoniczna(requested),analysis=agentAIAnaliza(),tasks=agentAIAnalizaAktywna(analysis),score=Math.max(0,Math.round(100-(tasks.filter(x=>x.poziom==="bad").length*18)-(tasks.filter(x=>x.poziom==="warn").length*8))),runtimeAge=Date.now()-Number(agentAIRuntime.updatedAt||0);
  if((!agentAIRuntime.loaded||runtimeAge>60_000)&&!agentAIRuntime.loading)setTimeout(()=>agentAIRuntimePobierz(true),0);
  if(active==="pulpit")setTimeout(()=>agentAIRuntimePolling(),0);
  if(active==="komunikacja"&&!agentAITelegram.loaded&&!agentAITelegram.loading)setTimeout(()=>agentAITelegramPobierz(true,true),0);
  if(["pulpit","automatyzacje"].includes(active)&&!agentAISpecjalisci.loaded&&!agentAISpecjalisci.loading)setTimeout(()=>agentAISpecjalisciPobierz(false),0);
  if(["pulpit","automatyzacje"].includes(active))setTimeout(()=>agentAISpecjalisciPolling(),0);
  const decisionAge=Date.now()-(Date.parse(agentAIDecyzjeMagazynowe.updatedAt)||0);if(["rozmowa","zadania"].includes(active)&&(!agentAIDecyzjeMagazynowe.loaded||decisionAge>60_000)&&!agentAIDecyzjeMagazynowe.loading)setTimeout(()=>agentAIDecyzjeMagazynowePobierz(true),0);
  return adminSzkielet("/admin/agent-ai",`${agentAINawigacjaScalonaHTML(active)}${agentAIKontekstHTML()}${agentAIPodstronaScalonyNaglowekHTML(active)}<main class="agent-workspace agent-workspace-${active}">${agentAIScalonaTrescSekcji(active,analysis,requested,score)}</main>`);
};
