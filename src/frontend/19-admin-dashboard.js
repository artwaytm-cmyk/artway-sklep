/* ═══════════ GŁÓWNY PULPIT ADMINISTRATORA ═══════════
   Jedno centrum operacyjne dla sklepu, Allegro, wysyłek, magazynu,
   komunikacji, finansów i kondycji integracji. */
let pulpitFiltrAlertow="wszystkie";
let pulpitSzukajAlertow="";
let pulpitSzukajTimer=null;

function pulpitStatusSklepuAktywny(z={}){return !["anulowane","dostarczone","zakończone","zwrot","zwrot pieniędzy"].includes(String(z.status||"").toLowerCase());}
function pulpitDataMs(z={}){if(typeof dataZamowieniaMs==="function")return dataZamowieniaMs(z);const raw=z.ts??z.createdAt??z.data??"",n=Number(raw);return Number.isFinite(n)&&n>1e9?(n<1e11?n*1000:n):(Date.parse(raw)||0);}
function pulpitKwotaAllegro(z={}){return kwotaNum(z.total?.amount??z.total??z.summary?.totalToPay?.amount??z.payment?.paidAmount?.amount??0);}
function pulpitZamowieniaOkres(lista,dni=7){const od=Date.now()-dni*86400000;return lista.filter(z=>pulpitDataMs(z)>=od);}
function pulpitZmianaProcent(teraz,poprzednio){if(!poprzednio)return teraz?100:0;return Math.round((teraz-poprzednio)/poprzednio*100);}

function pulpitSystemy(){
  const cloudChecked=!!chmuraStan.sprawdzono,healthChecked=!!stanBramki.sprawdzono,allegroChecked=!!allegroStan.sprawdzono,infaktChecked=!!infaktStan.sprawdzono;
  return [
    {id:"cloud",ico:"☁️",nazwa:"Wspólna baza",status:cloudChecked?(chmuraStan.dostepna?"ok":"blad"):"info",opis:cloudChecked?(chmuraStan.dostepna?`Połączona • rev ${chmuraStan.rev||0}`:chmuraStan.error||"Brak połączenia"):"Oczekuje na pierwszą kontrolę",href:"#/admin/publikacja"},
    {id:"email",ico:"✉️",nazwa:"E-mail automatyczny",status:healthChecked?(stanBramki.email?.configured?"ok":"blad"):"info",opis:healthChecked?(stanBramki.email?.configured?`${stanBramki.email.provider||"SMTP"} gotowy`:"Wymaga konfiguracji serwera"):"Oczekuje na kontrolę",href:"#/diagnostyka"},
    {id:"inpost",ico:"🚚",nazwa:"InPost",status:healthChecked?(stanBramki.inpost?.configured?"ok":"blad"):"info",opis:healthChecked?(stanBramki.inpost?.configured?"API etykiet i śledzenia gotowe":"Wymaga konfiguracji API"):"Oczekuje na kontrolę",href:"#/admin/wysylki"},
    {id:"allegro",ico:"🟠",nazwa:"Allegro",status:allegroChecked?(allegroStan.connected&&!allegroStan.requiresReauth?"ok":"blad"):"info",opis:allegroChecked?(allegroStan.connected&&!allegroStan.requiresReauth?"OAuth i synchronizacja aktywne":allegroStan.requiresReauth?"Wymaga ponownej autoryzacji":"Brak połączenia"):"Oczekuje na kontrolę",href:"#/admin/allegro/ustawienia"},
    {id:"infakt",ico:"🧾",nazwa:"inFakt",status:infaktChecked?(infaktStan.connected?"ok":infaktStan.configured?"blad":"info"):"info",opis:infaktChecked?(infaktStan.connected?"API faktur połączone":infaktStan.configured?infaktStan.error||"Błąd połączenia":"Klucz nie został skonfigurowany"):"Oczekuje na kontrolę",href:"#/admin/infakt/ustawienia"}
  ];
}

function adminPulpitDane(){
  const sklep=pobierzZamowienia(),sklepAktywne=sklep.filter(pulpitStatusSklepuAktywny),allegro=allegroDaneZaladowane.orders?(Array.isArray(allegroZamowienia)?allegroZamowienia:[]):(allegroPodsumowanie.recentOrders||[]),allegroAktywneRzeczywiste=allegro.filter(allegroZamowienieAktywneLokalnie),allegroAktywne=allegroDaneZaladowane.orders?allegroAktywneRzeczywiste:Array.from({length:Number(allegroPodsumowanie.orders?.active||0)},()=>({summaryOnly:true})),komunikacja=allegroKomunikacjaStaty(),plan=potrzebyZatowarowania(),produktyAktywne=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const wysylkiBezNumeru=sklepAktywne.filter(z=>!daneWysylki(z).numer).length,firmoweBezFaktury=sklepAktywne.filter(z=>(z.klient?.nip||z.klient?.firma)&&!infaktStan.links?.[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length;
  const teraz=Date.now(),siedem=7*86400000,sklep7=sklep.filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&pulpitDataMs(z)>=teraz-siedem),sklepPoprzednie7=sklep.filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&pulpitDataMs(z)>=teraz-2*siedem&&pulpitDataMs(z)<teraz-siedem),allegro7=allegro.filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))&&pulpitDataMs(z)>=teraz-siedem);
  const sprzedazSklep7=sklep7.reduce((s,z)=>s+kwotaNum(z.razem),0),sprzedazAllegro7=allegro7.reduce((s,z)=>s+pulpitKwotaAllegro(z),0),sprzedazPoprzednie7=sklepPoprzednie7.reduce((s,z)=>s+kwotaNum(z.razem),0);
  const seoKrytyczne=seoKolejkaProduktow().filter(x=>x.score<60).length,agentAktywne=typeof agentAIAnalizaAktywna==="function"?agentAIAnalizaAktywna(agentAIAnaliza()).length:0,systemy=pulpitSystemy(),systemBledy=systemy.filter(x=>x.status==="blad").length;
  return {sklep,sklepAktywne,noweSklep:sklepAktywne.filter(z=>z.status==="nowe").length,allegro,allegroAktywne,komunikacja,plan,produktyAktywne,wysylkiBezNumeru,firmoweBezFaktury,sklep7,allegro7,sprzedazSklep7,sprzedazAllegro7,sprzedaz7:sprzedazSklep7+sprzedazAllegro7,sprzedazPoprzednie7,trend:pulpitZmianaProcent(sprzedazSklep7,sprzedazPoprzednie7),seoKrytyczne,agentAktywne,systemy,systemBledy,klienci:pobierzUzytkownikow().filter(u=>!kontoMaRoleAdmin(u.email)).length};
}

function adminPulpitAlerty(d=adminPulpitDane()){
  const alerty=[],add=(level,ico,title,count,description,href,group="operacje")=>{if(Number(count)>0)alerty.push({id:`${group}-${alerty.length}`,level,ico,title,count:Number(count),description,href,group});};
  add("krytyczny","📦","Nowe zamówienia sklepu",d.noweSklep,"Otwórz zamówienia i rozpocznij obsługę.","#/admin/zamowienia");
  add("krytyczny","🟠","Zamówienia Allegro do obsługi",d.allegroAktywne.length,"Sprawdź pozycje, magazyn i przygotowanie wysyłki.","#/admin/allegro/zamowienia");
  add("krytyczny","💬","Klienci czekają na odpowiedź",d.komunikacja.totalNeed,"Wiadomości i dyskusje wymagające ręcznej odpowiedzi.",d.komunikacja.threadNeed?"#/admin/allegro/wiadomosci":"#/admin/allegro/dyskusje","komunikacja");
  add("ostrzezenie","🚚","Przesyłki bez numeru nadania",d.wysylkiBezNumeru,"Aktywne zamówienia bez utworzonej etykiety lub numeru.","#/admin/wysylki");
  add("krytyczny","📦","Braki do aktywnych zamówień",d.plan.length,"Wyłącznie produkty, których realnie brakuje do realizacji.","#/admin/magazyn/plan","magazyn");
  add("ostrzezenie","🧾","Firmowe zamówienia bez faktury",d.firmoweBezFaktury,"Przygotuj szkice lub wystaw dokumenty w inFakt.","#/admin/infakt/zamowienia","finanse");
  add("ostrzezenie","🤖","Otwarte zadania Agenta AI",d.agentAktywne,"Przejrzyj zadania wymagające decyzji administratora.","#/admin/agent-ai/plan","agent");
  add("informacja","🏷️","Karty produktów wymagają uzupełnienia",d.seoKrytyczne,"Braki jakości i SEO w aktywnym katalogu.","#/admin/seo/produkty","katalog");
  d.systemy.filter(x=>x.status==="blad").forEach(x=>add("krytyczny",x.ico,`${x.nazwa} wymaga uwagi`,1,x.opis,x.href,"system"));
  const rank={krytyczny:0,ostrzezenie:1,informacja:2};return alerty.sort((a,b)=>rank[a.level]-rank[b.level]||b.count-a.count||a.title.localeCompare(b.title,"pl"));
}

function adminPulpitSubnavHTML(aktywny="pulpit",d=adminPulpitDane()){
  const alerty=adminPulpitAlerty(d),pilne=alerty.filter(x=>x.level==="krytyczny").reduce((s,x)=>s+x.count,0),operacje=d.noweSklep+d.allegroAktywne.length+d.wysylkiBezNumeru+d.plan.length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin",label:"📊 Przegląd"},
    {id:"operacje",href:"#/admin/pulpit/operacje",label:"🎯 Operacje dzisiaj",badge:operacje||""},
    {id:"sprzedaz",href:"#/admin/pulpit/sprzedaz",label:"📈 Sprzedaż"},
    {id:"alerty",href:"#/admin/pulpit/alerty",label:"🔔 Alerty",badge:pilne||""},
    {id:"system",href:"#/admin/pulpit/system",label:"🛠️ Stan systemu",badge:d.systemBledy||""}
  ],aktywny);
}

function adminPulpitHeroHTML(aktywny,d){
  const cfg={pulpit:["Centrum dowodzenia","📊 Pulpit operacyjny","Najważniejsze dane, priorytety i kondycja całego sklepu w jednym miejscu."],operacje:["Dzisiaj","🎯 Operacje do wykonania","Uporządkowana kolejka pracy od sprzedaży i komunikacji po magazyn, wysyłkę i dokumenty."],sprzedaz:["Analiza kanałów","📈 Sprzedaż i zamówienia","Porównanie sklepu i Allegro, trend okresowy, statusy oraz ostatnie transakcje."],alerty:["Kontrola wyjątków","🔔 Alerty i decyzje","Tylko aktywne sprawy wymagające działania; zamknięte pozycje nie wracają do kolejki."],system:["Integracje i automatyzacje","🛠️ Stan systemu","Połączenia, ostatnie synchronizacje, harmonogramy i szybka diagnostyka."]}[aktywny];
  return `<section class="panel dashboard-hero"><div><span class="order-pro-label">${cfg[0]}</span><h1>${cfg[1]}</h1><p>${cfg[2]}</p></div><div class="dashboard-hero-actions"><span class="dashboard-live"><i></i> dane wspólne aktywne</span><button class="btn ghost" onclick="adminPulpitOdswiez()">↻ Odśwież dane</button><button class="btn" onclick="adminPulpitEksportujRaport()">📤 Raport CSV</button></div></section>`;
}

function adminPulpitKpiHTML(d){
  const kpis=[
    {ico:"🎯",value:d.noweSklep+d.allegroAktywne.length,label:"zamówień do obsługi",note:`Sklep ${d.noweSklep} • Allegro ${d.allegroAktywne.length}`,href:"#/admin/pulpit/operacje",hot:d.noweSklep+d.allegroAktywne.length>0},
    {ico:"💰",value:zl(d.sprzedaz7),label:"sprzedaż 7 dni",note:`Sklep ${zl(d.sprzedazSklep7)} • Allegro ${zl(d.sprzedazAllegro7)}`,href:"#/admin/pulpit/sprzedaz",money:true},
    {ico:"🚚",value:d.wysylkiBezNumeru,label:"przesyłek bez nadania",note:"aktywne zamówienia",href:"#/admin/wysylki",hot:d.wysylkiBezNumeru>0},
    {ico:"💬",value:d.komunikacja.totalNeed,label:"spraw do odpowiedzi",note:`Wiadomości ${d.komunikacja.threadNeed} • dyskusje ${d.komunikacja.issueNeed}`,href:"#/admin/pulpit/alerty",hot:d.komunikacja.totalNeed>0},
    {ico:"📦",value:d.plan.length,label:"braków do zamówień",note:"bez alarmów od samego stanu 0",href:"#/admin/magazyn/plan",hot:d.plan.length>0},
    {ico:"🛠️",value:d.systemBledy?d.systemBledy:"OK",label:"kondycja integracji",note:d.systemBledy?"wymaga reakcji":"brak aktywnych błędów",href:"#/admin/pulpit/system",hot:d.systemBledy>0,money:!d.systemBledy}
  ];
  return `<div class="dashboard-kpi-grid">${kpis.map(k=>`<a class="dashboard-kpi ${k.hot?"hot":""} ${k.money?"money":""}" href="${k.href}"><span>${k.ico}</span><div><b>${esc(k.value)}</b><strong>${k.label}</strong><small>${k.note}</small></div><em>Otwórz →</em></a>`).join("")}</div>`;
}

function adminPulpitDni(dni=14){
  const out=[];for(let i=dni-1;i>=0;i--){const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-i);out.push({start:date.getTime(),end:date.getTime()+86400000,label:date.toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit"}),weekday:date.toLocaleDateString("pl-PL",{weekday:"short"}),sklep:0,allegro:0,count:0});}
  pobierzZamowienia().filter(z=>String(z.status||"").toLowerCase()!=="anulowane").forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.sklep+=kwotaNum(z.razem);day.count++;}});
  (allegroZamowienia||[]).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))).forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.allegro+=pulpitKwotaAllegro(z);day.count++;}});return out;
}

function adminPulpitWykresHTML(dni=14){
  const rows=adminPulpitDni(dni),max=Math.max(1,...rows.map(x=>x.sklep+x.allegro)),total=rows.reduce((s,x)=>s+x.sklep+x.allegro,0);
  return `<section class="panel dashboard-chart-panel"><div class="order-section-head"><div><span class="order-pro-label">Dwa kanały sprzedaży</span><h2>Sprzedaż — ostatnie ${dni} dni</h2><p class="order-detail-lead">Sklep i Allegro są pokazane oddzielnie; wartości anulowane i zwrócone nie podbijają wykresu.</p></div><div class="dashboard-chart-total"><b>${zl(total)}</b><small>łącznie w okresie</small></div></div><div class="dashboard-chart-legend"><span><i class="store"></i> Sklep</span><span><i class="allegro"></i> Allegro</span></div><div class="dashboard-chart" style="--days:${rows.length}">${rows.map(x=>{const sh=Math.max(x.sklep?3:0,Math.round(x.sklep/max*100)),ah=Math.max(x.allegro?3:0,Math.round(x.allegro/max*100));return `<div class="dashboard-chart-day" title="${x.label}: sklep ${zl(x.sklep)}, Allegro ${zl(x.allegro)}"><div class="dashboard-bars"><i class="store" style="height:${sh}%"></i><i class="allegro" style="height:${ah}%"></i></div><b>${x.weekday}</b><small>${x.label}</small></div>`;}).join("")}</div></section>`;
}

function adminPulpitAlertCardHTML(a){return `<article class="dashboard-alert ${a.level}"><span>${a.ico}</span><div><small>${a.level==="krytyczny"?"Pilne":a.level==="ostrzezenie"?"Wymaga uwagi":"Kontrola jakości"}</small><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p></div><b>${esc(a.count)}</b><a class="btn ${a.level==="krytyczny"?"":"ghost"}" href="${a.href}">Przejdź →</a></article>`;}
function adminPulpitAlertyPasujace(d){const q=normalizujSzukanyTekst(pulpitSzukajAlertow);return adminPulpitAlerty(d).filter(a=>(pulpitFiltrAlertow==="wszystkie"||a.level===pulpitFiltrAlertow||a.group===pulpitFiltrAlertow)&&(!q||normalizujSzukanyTekst(`${a.title} ${a.description} ${a.group}`).includes(q)));}
function adminPulpitSzukajAlerty(input){pulpitSzukajAlertow=String(input?.value||"");clearTimeout(pulpitSzukajTimer);pulpitSzukajTimer=setTimeout(()=>renderuj(),220);}

function adminPulpitOstatnieHTML(d,limit=8){
  const sklep=d.sklep.slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,limit),allegro=d.allegro.slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,limit);
  return `<section class="dashboard-columns"><div class="panel"><div class="order-section-head"><div><h2>📦 Ostatnie zamówienia sklepu</h2><p class="order-detail-lead">Najnowsze transakcje i bieżący status realizacji.</p></div><a class="btn ghost" href="#/admin/zamowienia">Pełna lista</a></div><div class="table-scroll"><table class="mini-tab"><tr><th>Numer</th><th>Data</th><th>Status</th><th>Wartość</th></tr>${sklep.map(z=>`<tr><td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a></td><td>${esc(z.data||(pulpitDataMs(z)?new Date(pulpitDataMs(z)).toLocaleString("pl-PL"):"—"))}</td><td><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||"var(--bg)"}">${esc(z.status||"—")}</span></td><td><b>${zl(z.razem)}</b></td></tr>`).join("")||`<tr><td colspan="4">Brak zamówień.</td></tr>`}</table></div></div><div class="panel"><div class="order-section-head"><div><h2>🟠 Ostatnie zlecenia Allegro</h2><p class="order-detail-lead">Oficjalny status Allegro oraz lokalny etap obsługi.</p></div><a class="btn ghost" href="#/admin/allegro/zamowienia">Pełna lista</a></div><div class="table-scroll"><table class="mini-tab"><tr><th>Zlecenie</th><th>Data</th><th>Allegro</th><th>Magazyn</th></tr>${allegro.map(z=>`<tr><td><b>${esc(z.id||z.nr||"—")}</b></td><td>${esc(allegroDataTxt(z.createdAt||z.firstFetchedAt))}</td><td><span class="lvl ${allegroStatusKolejkiMeta(z).klasa}">${esc(allegroStatusKolejkiMeta(z).label)}</span></td><td><span class="lvl ${allegroEtapMagazynuMeta(z).klasa}">${esc(allegroEtapMagazynuMeta(z).label)}</span></td></tr>`).join("")||`<tr><td colspan="4">Brak zleceń Allegro.</td></tr>`}</table></div></div></section>`;
}

function adminPulpitSystemHTML(d){return `<div class="dashboard-system-grid">${d.systemy.map(s=>`<a href="${s.href}" class="dashboard-system-card ${s.status}"><span>${s.ico}</span><div><b>${esc(s.nazwa)}</b><small>${esc(s.opis)}</small></div><em>${s.status==="ok"?"działa":s.status==="blad"?"uwaga":"kontrola"}</em></a>`).join("")}</div>`;}

function adminPulpitPrzegladHTML(d){const alerty=adminPulpitAlerty(d),pilne=alerty.slice(0,6);return `${adminPulpitKpiHTML(d)}<section class="dashboard-main-grid"><div class="panel dashboard-priority"><div class="order-section-head"><div><span class="order-pro-label">Kolejka priorytetowa</span><h2>Co wymaga działania</h2><p class="order-detail-lead">Najpierw klient i sprzedaż, potem wysyłka, magazyn, dokumenty i jakość katalogu.</p></div><a class="btn ghost" href="#/admin/pulpit/alerty">Wszystkie alerty</a></div><div class="dashboard-alert-list">${pilne.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Brak pilnych zadań</b><small>Wszystkie aktywne kolejki są obecnie puste.</small></div></div>`}</div></div><div class="panel dashboard-quick"><div class="order-section-head"><div><span class="order-pro-label">Szybkie działania</span><h2>Najczęstsze operacje</h2></div></div><div class="dashboard-quick-grid">${[["➕","Dodaj produkt","Ręcznie lub z linku","#/admin/produkty/dodaj"],["🚚","Nadaj przesyłkę","Etykieta i tracking InPost","#/admin/wysylki"],["🟠","Sprawdź Allegro","Zamówienia i komunikacja","#/admin/allegro"],["🧾","Wystaw fakturę","Zamówienia firmowe","#/admin/infakt/zamowienia"],["🤖","Polecenie dla Agenta","Kontekst całego sklepu","#/admin/agent-ai/komendy"],["🎨","Zmień wygląd","Strona i podstrony","#/admin/personalizacja"]].map(([i,t,o,h])=>`<a href="${h}"><span>${i}</span><b>${t}</b><small>${o}</small></a>`).join("")}</div></div></section>${adminPulpitWykresHTML(7)}<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kondycja techniczna</span><h2>Integracje i automatyzacje</h2></div><a class="btn ghost" href="#/admin/pulpit/system">Pełny stan systemu</a></div>${adminPulpitSystemHTML(d)}</section>${adminPulpitOstatnieHTML(d,5)}`;}

function adminPulpitOperacjeHTML(d){
  const alerty=adminPulpitAlerty(d).filter(a=>a.group!=="system"),grupy=[{id:"sprzedaz",title:"Sprzedaż i klient",items:alerty.filter(x=>["operacje","komunikacja"].includes(x.group))},{id:"realizacja",title:"Realizacja i magazyn",items:alerty.filter(x=>["magazyn"].includes(x.group)||x.title.includes("Przesyłki"))},{id:"zaplecze",title:"Dokumenty, Agent i katalog",items:alerty.filter(x=>["finanse","agent","katalog"].includes(x.group))}];
  return `<section class="dashboard-operations-head">${[["📥",d.noweSklep,"nowych w sklepie"],["🟠",d.allegroAktywne.length,"Allegro do obsługi"],["🚚",d.wysylkiBezNumeru,"bez nadania"],["📦",d.plan.length,"braków do zleceń"]].map(([i,n,l])=>`<div><span>${i}</span><b>${n}</b><small>${l}</small></div>`).join("")}</section><div class="dashboard-operation-groups">${grupy.map(g=>`<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Etap operacyjny</span><h2>${g.title}</h2></div><span class="lvl ${g.items.length?"lvl-ostrzezenie":"lvl-ok"}">${g.items.length?`${g.items.reduce((s,x)=>s+x.count,0)} zadań`:`gotowe`}</span></div><div class="dashboard-alert-list">${g.items.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Etap bez zaległości</b><small>Nie ma obecnie aktywnych spraw w tej części procesu.</small></div></div>`}</div></section>`).join("")}</div>${adminPulpitOstatnieHTML(d,6)}`;
}

function adminPulpitSprzedazHTML(d){
  const statuses=STATUSY.map(s=>({status:s,count:d.sklep.filter(z=>z.status===s).length,value:d.sklep.filter(z=>z.status===s).reduce((n,z)=>n+kwotaNum(z.razem),0)})).filter(x=>x.count),allegro30=pulpitZamowieniaOkres(d.allegro,30).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))),sklep30=pulpitZamowieniaOkres(d.sklep,30).filter(z=>z.status!=="anulowane");
  return `${adminPulpitKpiHTML(d)}${adminPulpitWykresHTML(14)}<section class="dashboard-columns"><div class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kanały</span><h2>Porównanie 30 dni</h2></div></div><div class="dashboard-channel-grid"><a href="#/admin/zamowienia"><span>🏪</span><b>${sklep30.length}</b><strong>Sklep</strong><small>${zl(sklep30.reduce((s,z)=>s+kwotaNum(z.razem),0))}</small></a><a href="#/admin/allegro/zamowienia"><span>🟠</span><b>${allegro30.length}</b><strong>Allegro</strong><small>${zl(allegro30.reduce((s,z)=>s+pulpitKwotaAllegro(z),0))}</small></a></div></div><div class="panel"><div class="order-section-head"><div><span class="order-pro-label">Realizacja sklepu</span><h2>Statusy zamówień</h2></div></div><div class="dashboard-status-list">${statuses.map(x=>`<a href="#/admin/zamowienia" onclick="filtrZamowien=${jsArg(x.status)}"><span style="background:${KOLOR_STATUSU[x.status]||"var(--bg)"}"></span><b>${esc(x.status)}</b><strong>${x.count}</strong><small>${zl(x.value)}</small></a>`).join("")||`<div class="dashboard-all-clear">Brak danych sprzedażowych.</div>`}</div></div></section>${adminPulpitOstatnieHTML(d,10)}`;
}

function adminPulpitAlertyHTML(d){
  const all=adminPulpitAlerty(d),items=adminPulpitAlertyPasujace(d),critical=all.filter(x=>x.level==="krytyczny").length,warnings=all.filter(x=>x.level==="ostrzezenie").length,systems=all.filter(x=>x.group==="system").length;
  return `<section class="panel dashboard-alert-workspace"><div class="order-section-head"><div><span class="order-pro-label">Aktywna kolejka wyjątków</span><h2>Alerty wymagające decyzji</h2><p class="order-detail-lead">Lista nie zawiera zamkniętych zamówień ani produktów z zerowym stanem, jeżeli niczego nie brakuje do aktywnej realizacji.</p></div><button class="btn ghost" onclick="adminPulpitEksportujRaport('alerty')">📤 Eksport alertów</button></div><div class="dashboard-alert-filters"><input placeholder="Szukaj alertu, modułu lub opisu…" value="${esc(pulpitSzukajAlertow)}" oninput="adminPulpitSzukajAlerty(this)">${[["wszystkie",`Wszystkie ${all.length}`],["krytyczny",`Pilne ${critical}`],["ostrzezenie",`Ostrzeżenia ${warnings}`],["system",`System ${systems}`],["katalog","Katalog"]].map(([v,l])=>`<button class="${pulpitFiltrAlertow===v?"active":""}" onclick="pulpitFiltrAlertow=${jsArg(v)};renderuj()">${l}</button>`).join("")}</div><div class="dashboard-alert-list expanded">${items.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Brak alertów dla wybranego filtra</b><small>Nie ma obecnie spraw wymagających działania.</small></div></div>`}</div></section>`;
}

function adminPulpitStanSystemuHTML(d){
  return `<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kontrola połączeń</span><h2>Integracje produkcyjne</h2><p class="order-detail-lead">Każda karta prowadzi bezpośrednio do ustawień albo modułu naprawczego.</p></div><button class="btn" onclick="adminPulpitOdswiez(true)">🩺 Uruchom kontrolę</button></div>${adminPulpitSystemHTML(d)}</section><section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Harmonogram automatyczny</span><h2>Synchronizacje i zadania cykliczne</h2></div><a class="btn ghost" href="#/admin/allegro/ustawienia">Ustawienia Allegro</a></div><div class="dashboard-schedule">${[["☁️","Wspólna baza","co 60 sekund na aktywnym urządzeniu","ustawienia, produkty i zamówienia"],["📦","Zamówienia Allegro","co 15 minut","nowe zlecenia i agent magazynowy"],["💬","Wiadomości i dyskusje","co 15 minut","tylko nowe kontakty i przypomnienia"],["🏷️","Lista ofert Allegro","co 15 minut","lekka kontrola zmian"],["🧩","Pełny katalog Allegro","co 6 godzin","szczegóły, opisy i kategorie"],["🏭","Dostępność producentów","partie priorytetowe","najpierw bestsellery i aktywne zamówienia"],["📣","SEO produktów","limit dzienny","bezpłatna kontrola małych partii"]].map(([i,t,c,o])=>`<article><span>${i}</span><div><b>${t}</b><small>${o}</small></div><em>${c}</em></article>`).join("")}</div></section><section class="panel dashboard-system-actions"><div><span>🛠️</span><b>Diagnostyka pełna</b><small>Sprawdź błędy JavaScript, serwer, SMTP, InPost i bazę.</small><a class="btn" href="#/diagnostyka">Otwórz diagnostykę</a></div><div><span>🌍</span><b>Publikacja</b><small>Kontrola wersji i stanu wdrożenia strony.</small><a class="btn ghost" href="#/admin/publikacja">Stan publikacji</a></div><div><span>🤖</span><b>Agent AI</b><small>Przegląd aktywnych zadań i planu operacyjnego.</small><a class="btn ghost" href="#/admin/agent-ai">Otwórz Agenta</a></div></section>`;
}

async function adminPulpitOdswiez(pelnaKontrola=false){
  toast("Odświeżam dane pulpitu…");
  await Promise.allSettled([chmuraWczytajStan(),allegroWczytajDane(true,false,"summary"),pelnaKontrola?sprawdzBramke(true):Promise.resolve(true)]);
  zastosujUstawienia();zbudujProdukty();odswiezMenu();renderuj();toast("Pulpit odświeżony ✅");
}
function adminPulpitEksportujRaport(zakres="calosc"){
  const d=adminPulpitDane(),alerty=adminPulpitAlerty(d),rows=alerty.map(a=>[new Date().toISOString(),a.level,a.group,a.title,a.count,a.description,a.href]);
  if(zakres!=="alerty")rows.push([new Date().toISOString(),"podsumowanie","sprzedaz","Sprzedaż 7 dni",d.sprzedaz7,`Sklep ${zl(d.sprzedazSklep7)} | Allegro ${zl(d.sprzedazAllegro7)}`,"#/admin/pulpit/sprzedaz"]);
  adminEksportujCSV(zakres==="alerty"?"pulpit-alerty.csv":"pulpit-operacyjny.csv",["czas","poziom","obszar","pozycja","liczba","opis","trasa"],rows);
}

function widokAdmin(sekcja="pulpit"){
  if(typeof allegroLadujJesliTrzeba==="function")setTimeout(()=>allegroLadujJesliTrzeba("summary"),0);
  if(!stanBramki.sprawdzono)setTimeout(()=>sprawdzBramke(true),0);
  const aktywna=["pulpit","operacje","sprzedaz","alerty","system"].includes(String(sekcja||""))?String(sekcja):"pulpit",d=adminPulpitDane();
  const body=aktywna==="operacje"?adminPulpitOperacjeHTML(d):aktywna==="sprzedaz"?adminPulpitSprzedazHTML(d):aktywna==="alerty"?adminPulpitAlertyHTML(d):aktywna==="system"?adminPulpitStanSystemuHTML(d):adminPulpitPrzegladHTML(d);
  return adminSzkielet("/admin",`${adminPulpitSubnavHTML(aktywna,d)}${adminPulpitHeroHTML(aktywna,d)}<div class="dashboard-workspace">${body}</div>${domyslneHasloAdmina?`<div class="panel dashboard-security-warning"><span>🔑</span><div><b>Administrator używa domyślnego hasła</b><small>Zmień je przed dalszą publikacją strony.</small></div><a class="btn" href="#/konto">Zmień hasło</a></div>`:""}`);
}
