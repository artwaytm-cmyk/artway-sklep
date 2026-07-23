function agentAISubnavHTML(aktywny="pulpit"){
  const analiza=agentAIAnaliza();
  const aktywneZadania=agentAIAnalizaAktywna(analiza),problemy=aktywneZadania.length;
  const plan=aktywneZadania.length;
  const produktyWdrozenie=agentAIProduktyWdrozenie().length;
  const zlecenia=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length;
  const producenciGotowi=(producenciKartoteka||[]).filter(p=>p.active!==false&&p.orderEmail).length;
  const pamiec=(agentAIPamiec||[]).length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/agent-ai",label:"🤖 Pulpit",badge:problemy||""},
    {id:"komendy",href:"#/admin/agent-ai/komendy",label:"💬 Komendy"},
    {id:"specjalisci",href:"#/admin/agent-ai/specjalisci",label:"✦ Specjaliści GPT"},
    {id:"uprawnienia",href:"#/admin/agent-ai/uprawnienia",label:"🛡️ Uprawnienia"},
    {id:"plan",href:"#/admin/agent-ai/plan",label:"🧭 Plan operacyjny",badge:plan||""},
    {id:"produkty",href:"#/admin/agent-ai/produkty",label:"✨ Nowe produkty",badge:produktyWdrozenie||""},
    {id:"zakupy",href:"#/admin/magazyn/plan",label:"📦 Plan zatowarowania",badge:zlecenia||""},
    {id:"producenci",href:"#/admin/agent-ai/producenci",label:"🏭 Producenci i kontakt",badge:producenciGotowi||""},
    {id:"telegram",href:"#/admin/agent-ai/telegram",label:"✈️ Telegram",badge:agentAITelegram.stats?.critical||""},
    {id:"pamiec",href:"#/admin/agent-ai/pamiec",label:"🧠 Pamięć",badge:pamiec||""},
    {id:"historia",href:"#/admin/agent-ai/historia",label:"🕓 Historia",badge:Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).length||""}
  ],aktywny);
}
function klienciSubnavHTML(aktywny="lista"){
  const u=pobierzUzytkownikow();
  const admini=u.filter(x=>kontoMaRoleAdmin(x.email)).length;
  const owner=jestGlownymAdminem(sesja?.email);
  return adminSubnavHTML([
    {id:"lista",href:"#/admin/klienci",label:"👥 Lista klientów",badge:u.length},
    ...(owner?[
      {id:"dodaj",href:"#/admin/klienci/dodaj",label:"➕ Dodaj klienta"},
      {id:"uprawnienia",href:"#/admin/klienci/uprawnienia",label:"🛡️ Uprawnienia",badge:admini},
    ]:[]),
    {id:"zamowienia",href:"#/admin/klienci/zamowienia",label:"📦 Zamówienia klientów"}
  ],aktywny);
}
function allegroZgodnoscPozycje(){
  const items=Array.isArray(allegroStan.complianceAudit?.items)?allegroStan.complianceAudit.items:[],q=String(szukajAllegroZgodnosc||"").trim().toLowerCase();
  return items.filter(item=>{
    const text=[item.offerId,item.name,item.status,...(item.violations||[]).flatMap(v=>[v.label,...(v.matches||[])])].join(" ").toLowerCase();
    const filtrOk=filtrAllegroZgodnosc==="wszystkie"||(filtrAllegroZgodnosc==="naruszenia"&&!item.ok)||(filtrAllegroZgodnosc==="naprawione"&&item.fixed)||(filtrAllegroZgodnosc==="poprawne"&&item.ok&&!item.fixed)||(filtrAllegroZgodnosc==="bledy"&&item.error);
    return filtrOk&&(!q||text.includes(q));
  });
}
function allegroZaznaczZgodnosc(ids=[],checked=true){for(const id of ids)checked?zaznaczoneAllegroZgodnosc.add(String(id)):zaznaczoneAllegroZgodnosc.delete(String(id));renderuj();}
async function allegroAudytujZgodnosc({fix=false,offerIds=[],offerId=""}={}){
  if(allegroZgodnoscBusy)return;
  allegroZgodnoscBusy=true;renderuj();
  try{
    const body={fix,activeOnly:true,limit:50};if(offerId)body.offerId=String(offerId).trim();if(Array.isArray(offerIds)&&offerIds.length)body.offerIds=offerIds.map(String).slice(0,50);
    const d=await chmura("allegro-offer-compliance",{method:"POST",body,timeout:180000});
    allegroStan={...allegroStan,complianceAudit:{items:Array.isArray(d.items)?d.items:[],summary:d.summary||{},updated_at:d.updated_at||null,policy:d.policy||null}};
    if(fix)zaznaczoneAllegroZgodnosc.clear();
    const s=d.summary||{};toast(fix?`✅ Kontrola Allegro: naprawiono ${s.fixed||0}, pozostało ${s.remaining||0}`:`🛡️ Sprawdzono ${s.checked||0} ofert • naruszenia: ${s.violations||0}`);
  }catch(e){toast("⚠️ Kontrola zgodności: "+(e.message||e));}
  allegroZgodnoscBusy=false;renderuj();
}
function allegroSprawdzOferteZFormularza(form,fix=false){const id=String(new FormData(form).get("offerId")||"").trim();if(!id){toast("Wpisz ID oferty Allegro");return;}void allegroAudytujZgodnosc({offerId:id,fix});}
function allegroZgodnoscPanelHTML(){
  const audit=allegroStan.complianceAudit||{},all=Array.isArray(audit.items)?audit.items:[],items=allegroZgodnoscPozycje(),open=all.filter(x=>!x.ok).length,fixed=all.filter(x=>x.fixed).length,errors=all.filter(x=>x.error).length,selected=[...zaznaczoneAllegroZgodnosc].filter(id=>items.some(x=>String(x.offerId)===id));
  return `<div class="panel allegro-section-panel allegro-compliance-page">
    <div class="order-section-head"><div><span class="order-pro-label">Ochrona konta sprzedawcy</span><h2>🛡️ Zgodność ofert z zasadami Allegro</h2><p class="order-detail-lead">Każdy opis jest oczyszczany i sprawdzany przed utworzeniem albo aktualizacją oferty. Publikacja zostaje zablokowana, jeśli pozostanie zaproszenie do kontaktu, sprawdzania dostępności, negocjacji, dane kontaktowe lub odsyłacz poza Allegro.</p></div><button class="btn" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroAudytujZgodnosc({fix:true})">${allegroZgodnoscBusy?"⏳ Kontroluję…":"🛡️ Sprawdź i napraw 50 ofert"}</button></div>
    <div class="allegro-compliance-guard"><span>✅</span><div><b>Blokada przed publikacją jest zawsze włączona</b><small>Nie można jej wyłączyć ustawieniem. Korekta zachowuje układ opisu Allegro: sekcje, nagłówki, akapity, pogrubienia, listy, zdjęcia i ich kolejność. Usuwany jest wyłącznie niedozwolony fragment.</small></div></div>
    <div class="orders-stat-grid">${[["📋",all.length,"skontrolowanych"],["⚠️",open,"wymaga naprawy"],["✅",fixed,"naprawionych automatycznie"],["⛔",errors,"błędów API"]].map(([i,n,l])=>`<button class="order-stat-card stat-filter ${l.includes("wymaga")&&n?"hot":l.includes("naprawionych")?"money":""}" onclick="filtrAllegroZgodnosc=${jsArg(l.includes("wymaga")?"naruszenia":l.includes("naprawionych")?"naprawione":l.includes("błędów")?"bledy":"wszystkie")};renderuj()"><span>${i}</span><b>${n}</b><small>${l}</small></button>`).join("")}</div>
    <form class="allegro-compliance-single" onsubmit="event.preventDefault();allegroSprawdzOferteZFormularza(this,false)"><div><b>Sprawdź konkretną ofertę</b><small>Wklej ID z adresu oferty, np. 12212218115.</small></div><input name="offerId" inputmode="numeric" placeholder="ID oferty Allegro" required><button class="btn ghost" type="submit" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź</button><button class="btn" type="button" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroSprawdzOferteZFormularza(this.form,true)">Sprawdź i napraw</button></form>
    <div class="orders-toolbar allegro-toolbar"><input placeholder="Szukaj: nazwa, ID, wykryty zwrot…" value="${esc(szukajAllegroZgodnosc)}" oninput="szukajAllegroZgodnosc=this.value;clearTimeout(window.__allegroComplianceSearch);window.__allegroComplianceSearch=setTimeout(()=>renderuj(),250)"><select onchange="filtrAllegroZgodnosc=this.value;renderuj()">${[["naruszenia","Wymaga naprawy"],["wszystkie","Wszystkie wyniki"],["naprawione","Naprawione"],["poprawne","Zgodne"],["bledy","Błędy API"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroZgodnosc===v?"selected":""}>${l}</option>`).join("")}</select><button class="btn ghost" onclick="allegroAudytujZgodnosc({fix:false})" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź 50</button></div>
    <div class="allegro-compliance-bulk"><label class="check"><input type="checkbox" onchange='allegroZaznaczZgodnosc(${JSON.stringify(items.map(x=>String(x.offerId)))},this.checked)'> Zaznacz widoczne (${items.length})</label><span>${selected.length} zaznaczonych</span><button class="btn" ${!selected.length||allegroZgodnoscBusy?"disabled":""} onclick='allegroAudytujZgodnosc({fix:true,offerIds:${JSON.stringify(selected)}})'>Napraw zaznaczone</button></div>
    <div class="warehouse-worktable-wrap"><table class="log-table allegro-compliance-table"><tr><th></th><th>Oferta</th><th>Status</th><th>Wynik kontroli</th><th>Wykryte treści</th><th>Akcje</th></tr>${items.map(item=>`<tr class="${item.ok?"is-safe":"has-risk"}"><td><input type="checkbox" ${zaznaczoneAllegroZgodnosc.has(String(item.offerId))?"checked":""} onchange="allegroZaznaczZgodnosc([${jsArg(String(item.offerId))}],this.checked)"></td><td><b>${esc(item.name||"Oferta")}</b><small>ID ${esc(item.offerId||"—")} • ${esc(item.checkedAt?new Date(item.checkedAt).toLocaleString("pl-PL"):"—")}</small></td><td><span class="lvl ${item.error?"lvl-bad":item.ok?"lvl-ok":"lvl-ostrzezenie"}">${item.error?"błąd API":item.fixed?"naprawiona":item.ok?"zgodna":"blokada"}</span><small>${esc(item.status||"—")}</small></td><td><b>${item.ok?"Brak aktywnego naruszenia":"Wymaga oczyszczenia"}</b>${item.removedCount?`<small>Usunięto ${esc(item.removedCount)} fragmentów</small>`:""}${item.fixed&&item.layoutPreserved===true?`<small>✅ Układ Allegro zachowany</small>`:""}${item.error?`<small class="compliance-error">${esc(item.error)}</small>`:""}</td><td>${(item.violations||[]).map(v=>`<span class="compliance-rule"><b>${esc(v.label)}</b><small>${esc((v.matches||[]).join(" • "))}</small></span>`).join("")||"—"}</td><td><div class="warehouse-worktable-actions"><a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(item.offerId||"")}" target="_blank" rel="noopener">Oferta ↗</a>${!item.ok?`<button class="btn" onclick="allegroAudytujZgodnosc({fix:true,offerId:${jsArg(String(item.offerId))}})" ${allegroZgodnoscBusy?"disabled":""}>Napraw</button>`:""}</div></td></tr>`).join("")||`<tr><td colspan="6">Brak wyników dla wybranego filtra. Uruchom audyt aktywnych ofert.</td></tr>`}</table></div>
    <div class="allegro-compliance-rules"><div><b>Treści usuwane lub blokowane</b><span>kontakt przed zakupem • sprawdzanie dostępności • negocjacja ceny • e-mail • telefon • zewnętrzna strona • sprzedaż poza Allegro</span><small>Wygląd pozostaje w formacie edytora Allegro — korekta nie spłaszcza opisu do zwykłego tekstu.</small></div><div class="diag-actions"><a class="btn ghost" href="https://help.allegro.com/pl/sell/a/sprzedaz-poza-allegro-i-omijanie-oplat-aMloER9LrH8" target="_blank" rel="noopener">Oficjalna zasada ↗</a><a class="btn ghost" href="https://help.allegro.com/pl/sell/c/jak-wystawiac-oferty" target="_blank" rel="noopener">Zasady opisów ↗</a></div></div>
  </div>`;
}
let allegroPanelStatyCache={oferty:null,zamowienia:null,mapowania:null,produkty:null,komunikacja:null,compliance:null,zadania:null,sync:null,result:null};
function allegroPanelOperacyjnyStaty(){
  const oferty=Array.isArray(allegroOferty)?allegroOferty:[],zamowienia=Array.isArray(allegroZamowienia)?allegroZamowienia:[],produktyZrodlo=produktyDoAdministracji(),compliance=allegroStan.complianceAudit?.items||[],zadania=agentAIAllegroZadania||[];
  const cache=allegroPanelStatyCache;
  if(cache.oferty===oferty&&cache.zamowienia===zamowienia&&cache.mapowania===allegroMapowania&&cache.produkty===produktyZrodlo&&cache.komunikacja===allegroKomunikacja&&cache.compliance===compliance&&cache.zadania===zadania&&cache.sync===allegroStan.offerSyncState&&cache.result)return cache.result;
  const komunikacja=allegroKomunikacjaStaty(),produkty=produktyZrodlo.filter(p=>!czyProduktAdminWKoszu(p)),produktIds=new Set(produkty.map(p=>String(p.id)));
  let podpiete=0;
  for(const oferta of oferty){
    const id=allegroProduktIdDlaOferty(oferta.id);
    if(id&&produktIds.has(String(id)))podpiete++;
  }
  const aktywneZamowienia=zamowienia.filter(statusAllegroRezerwujeMagazyn),braki=aktywneZamowienia.filter(z=>allegroEtapMagazynu(z)==="braki");
  const liczbaOfert=allegroDaneZaladowane.offers?oferty.length:Number(allegroPodsumowanie.offers?.count||0),liczbaPodpietych=allegroDaneZaladowane.offers?podpiete:Number(allegroPodsumowanie.offers?.mapped||0),liczbaAktywnych=allegroDaneZaladowane.orders?aktywneZamowienia.length:Number(allegroPodsumowanie.orders?.active||0);
  const zadaniaWystawiania=allegroAktywneZadaniaAgentaOfert().length,naruszenia=compliance.filter(x=>!x.ok&&!x.fixed&&!x.error).length;
  const pilne=liczbaAktywnych+komunikacja.threadNeed+komunikacja.issueNeed+naruszenia;
  const result={oferty:liczbaOfert,podpiete:liczbaPodpietych,niepodpiete:Math.max(0,liczbaOfert-liczbaPodpietych),produkty:produkty.length,aktywneZamowienia:liczbaAktywnych,braki:allegroDaneZaladowane.orders?braki.length:0,zadaniaWystawiania,wiadomosci:komunikacja.threadNeed,dyskusje:komunikacja.issueNeed,naruszenia,pilne,synchronizacja:allegroStan.offerSyncState||{}};
  allegroPanelStatyCache={oferty,zamowienia,mapowania:allegroMapowania,produkty:produktyZrodlo,komunikacja:allegroKomunikacja,compliance,zadania,sync:allegroStan.offerSyncState,result};return result;
}
function allegroSubnavHTML(aktywny="start",st=allegroPanelOperacyjnyStaty()){
  const zadaniaWystawiania=st.zadaniaWystawiania;
  return adminSubnavHTML([
    {id:"start",href:"#/admin/allegro",label:"📊 Pulpit"},
    {id:"zamowienia",href:"#/admin/allegro/zamowienia",label:"📦 Zamówienia",badge:st.aktywneZamowienia||""},
    {id:"oferty",href:"#/admin/allegro/oferty",label:"🏷️ Oferty"},
    {id:"wystawianie",href:"#/admin/allegro/wystawianie",label:"🟠 Wystawianie",badge:zadaniaWystawiania||""},
    {id:"rentownosc",href:"#/admin/allegro/rentownosc",label:"📈 Opłacalność"},
    {id:"wiadomosci",href:"#/admin/allegro/wiadomosci",label:"💬 Wiadomości",badge:st.wiadomosci||""},
    {id:"dyskusje",href:"#/admin/allegro/dyskusje",label:"🛟 Dyskusje",badge:st.dyskusje||""},
    {id:"tabela",href:"#/admin/magazyn/plan",label:"📦 Plan zatowarowania"},
    {id:"zgodnosc",href:"#/admin/allegro/zgodnosc",label:"🛡️ Zgodność",badge:st.naruszenia||""},
    {id:"ustawienia",href:"#/admin/allegro/ustawienia",label:"⚙️ Ustawienia"}
  ],aktywny);
}
function allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete,st=allegroPanelOperacyjnyStaty()){
  const cfg={
    start:{ico:"🟠",kicker:"Centrum Allegro",title:"Pulpit integracji",opis:"Jedno miejsce do kontroli zamówień, katalogu ofert, wystawiania i komunikacji.",metryki:[["Połączenie",allegroStan.connected?"Aktywne":"Wymaga uwagi"],["Oferty",st.oferty],["Do obsługi",st.aktywneZamowienia]]},
    zamowienia:{ico:"📦",kicker:"Sprzedaż",title:"Kolejka zamówień Allegro",opis:"Status pochodzi z Allegro. Obsługa sprawdza rozpoznanie, stan i realny brak; fizyczne miejsce prowadzi osobno magazyn.",metryki:[["Do obsługi",st.aktywneZamowienia],["Z brakami",st.braki],["Ostatni odczyt",allegroDataTxt(allegroPodsumowanie.orders?.updated_at)||"oczekuje"]]},
    oferty:{ico:"🏷️",kicker:"Katalog Allegro",title:"Oferty i powiązania",opis:"Profesjonalny katalog ofert z miniaturą, identyfikatorami, ceną, stanem i kontrolą powiązania z produktem sklepu.",metryki:[["Wszystkie",st.oferty],["Podpięte",mapped],["Do powiązania",niepodpiete]]},
    wystawianie:{ico:"🟠",kicker:"Publikowanie",title:"Przygotowanie ofert",opis:"Kontrola kompletności danych produktu przed utworzeniem bezpiecznego szkicu oferty.",metryki:[["Produkty",st.produkty],["Zadania agenta",st.zadaniaWystawiania],["Widok","stronicowany"]]},
    rentownosc:{ico:"📈",kicker:"Finanse produktu",title:"Opłacalność sklepu, Allegro i Von Halsky",opis:"Trzy oddzielne ceny, cele marży i rekomendacje kanałowe. Von Halsky domyślnie dziedziczy cenę Allegro, ale może mieć własną wartość.",metryki:[["Produkty",st.produkty],["Kalkulacja","na aktywnej stronie"],["Cele",`Sklep ${sklepDocelowaMarza}% • Allegro ${allegroDocelowaMarza}% • Von Halsky ${vonHalskyDocelowaMarza}%`]]},
    wiadomosci:{ico:"💬",kicker:"Obsługa klienta",title:"Centrum wiadomości",opis:"Wyszukiwanie, filtry, historia korespondencji i wewnętrzne zamykanie spraw bez wysyłania wiadomości.",metryki:[["Wątki",allegroKomunikacjaStaty().threads.length],["Do odpowiedzi",allegroKomunikacjaStaty().threadNeed],["Załatwione",allegroKomunikacjaStaty().threads.filter(allegroKomunikacjaZalatwiona).length]]},
    dyskusje:{ico:"🛟",kicker:"Dyskusje i reklamacje",title:"Obsługa zgłoszeń Allegro",opis:"Oddzielny rejestr dyskusji i reklamacji z filtrami oficjalnego statusu oraz statusem wewnętrznym.",metryki:[["Zgłoszenia",allegroKomunikacjaStaty().issues.length],["Do odpowiedzi",allegroKomunikacjaStaty().issueNeed],["Załatwione",allegroKomunikacjaStaty().issues.filter(allegroKomunikacjaZalatwiona).length]]},
    zgodnosc:{ico:"🛡️",kicker:"Bezpieczeństwo opisów",title:"Ochrona ofert Allegro",opis:"Tarcza wykrywa treści naruszające zasady Allegro, blokuje ryzykowną publikację i naprawia opis bez zmiany jego układu.",metryki:[["Skontrolowane",(allegroStan.complianceAudit?.items||[]).length],["Do naprawy",(allegroStan.complianceAudit?.items||[]).filter(x=>!x.ok&&!x.fixed&&!x.error).length],["Naprawione",(allegroStan.complianceAudit?.items||[]).filter(x=>x.fixed).length]]},
    ustawienia:{ico:"⚙️",kicker:"Konfiguracja",title:"Ustawienia integracji Allegro",opis:"Połączenie OAuth, zakresy uprawnień, środowisko i kontrola synchronizacji w jednym miejscu.",metryki:[["API",allegroStan.configured?"OK":"Brak"],["OAuth",allegroStan.connected?"Połączone":"Rozłączone"],["Środowisko",allegroStan.env||"production"]]}
  }[aktywna]||{};
  return `<section class="panel allegro-workspace-section"><div class="allegro-workspace-title"><span>${cfg.ico||"🟠"}</span><div><small>${esc(cfg.kicker||"Allegro")}</small><h2>${esc(cfg.title||"Panel Allegro")}</h2><p>${esc(cfg.opis||"")}</p></div></div><div class="allegro-workspace-metrics">${(cfg.metryki||[]).map(([l,v])=>`<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join("")}</div></section>`;
}
function allegroStartPanelHTML(st=allegroPanelOperacyjnyStaty()){
  const sync=st.synchronizacja||{},ostatniaOferta=sync.lastLightSyncAt||sync.lastFullSyncAt,ostatniaKomunikacja=allegroKomunikacja?.updated_at;
  const kolejka=[
    {n:st.aktywneZamowienia,ico:"📦",tytul:"Zamówienia do obsługi",opis:st.braki?`${st.braki} ma realne braki do Planu zatowarowania`:"sprawdzenie rozpoznania, stanu i kompletacji",href:"#/admin/allegro/zamowienia",akcja:"Otwórz zlecenia"},
    {n:st.wiadomosci,ico:"💬",tytul:"Wiadomości wymagające odpowiedzi",opis:"wyłącznie nowe, niezałatwione sprawy klientów",href:"#/admin/allegro/wiadomosci",akcja:"Otwórz wiadomości"},
    {n:st.dyskusje,ico:"🛟",tytul:"Dyskusje wymagające reakcji",opis:"status wewnętrzny nie zmienia danych Allegro",href:"#/admin/allegro/dyskusje",akcja:"Otwórz dyskusje"},
    {n:st.naruszenia,ico:"🛡️",tytul:"Oferty wymagające kontroli zgodności",opis:"publikacja pozostaje chroniona blokadą treści",href:"#/admin/allegro/zgodnosc",akcja:"Otwórz kontrolę"}
  ].filter(x=>x.n>0);
  const katalogProc=st.oferty?Math.round(st.podpiete/st.oferty*100):100;
  return `<div class="allegro-command-center">
    <section class="panel allegro-command-hero">
      <div class="allegro-command-hero-copy"><span class="order-pro-label">Centrum operacyjne sprzedaży</span><h1>🟠 Panel Allegro</h1><p>Zlecenia, katalog ofert, publikowanie, opłacalność i obsługa klienta są rozdzielone na jasne etapy. Liczniki w menu pokazują wyłącznie realną pracę — nigdy rozmiar całego katalogu.</p><div class="allegro-command-health"><span class="${allegroStan.connected?"ok":"warning"}"><i></i>${allegroStan.connected?"API Allegro połączone":"Połączenie wymaga uwagi"}</span><span>↻ zamówienia i komunikacja co 15 min</span><span>🏷️ ostatni odczyt ofert: ${esc(ostatniaOferta?allegroDataTxt(ostatniaOferta):"oczekuje")}</span></div></div>
      <div class="allegro-command-hero-actions"><a class="btn" href="#/admin/allegro/zamowienia">📦 Obsłuż zamówienia${st.aktywneZamowienia?` (${st.aktywneZamowienia})`:""}</a><a class="btn ghost" href="#/admin/allegro/wystawianie">🟠 Wystaw produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia integracji</a></div>
    </section>
    <div class="orders-stat-grid allegro-command-kpis">
      <a class="order-stat-card stat-filter ${st.aktywneZamowienia?"hot":"money"}" href="#/admin/allegro/zamowienia"><span>📦</span><b>${st.aktywneZamowienia}</b><small>zamówień do obsługi</small></a>
      <a class="order-stat-card stat-filter ${st.braki?"hot":""}" href="#/admin/magazyn/plan"><span>🧾</span><b>${st.braki}</b><small>zleceń z brakami</small></a>
      <a class="order-stat-card stat-filter ${st.wiadomosci?"hot":""}" href="#/admin/allegro/wiadomosci"><span>💬</span><b>${st.wiadomosci}</b><small>wiadomości do odpowiedzi</small></a>
      <a class="order-stat-card stat-filter ${st.dyskusje?"hot":""}" href="#/admin/allegro/dyskusje"><span>🛟</span><b>${st.dyskusje}</b><small>dyskusji do reakcji</small></a>
      <a class="order-stat-card stat-filter ${st.naruszenia?"hot":"money"}" href="#/admin/allegro/zgodnosc"><span>🛡️</span><b>${st.naruszenia}</b><small>otwartych kontroli zgodności</small></a>
    </div>
    <div class="allegro-command-layout">
      <section class="panel allegro-command-priorities"><div class="order-section-head"><div><span class="order-pro-label">Kolejka pracy</span><h2>Co wymaga działania</h2><p class="order-detail-lead">Lista zawiera tylko niezakończone sprawy. Cały katalog ofert pozostaje informacją, nie alarmem.</p></div><span class="allegro-action-total ${st.pilne?"has-work":"is-clear"}">${st.pilne?`${st.pilne} do obsługi`:"Wszystko pod kontrolą"}</span></div>${kolejka.length?`<div class="allegro-priority-list">${kolejka.map(x=>`<a href="${x.href}"><span>${x.ico}</span><div><b>${esc(x.tytul)}</b><small>${esc(x.opis)}</small></div><strong>${x.n}</strong><em>${esc(x.akcja)} →</em></a>`).join("")}</div>`:`<div class="allegro-command-empty"><span>✅</span><div><b>Brak pilnych spraw</b><small>Nowe zamówienia i wiadomości pojawią się tu po kolejnej synchronizacji.</small></div></div>`}</section>
      <section class="panel allegro-catalog-overview"><div class="order-section-head"><div><span class="order-pro-label">Katalog sprzedażowy</span><h2>Oferty i powiązania</h2><p class="order-detail-lead">Liczby katalogowe są widoczne tutaj, bez pomarańczowego alarmu w menu.</p></div><a class="btn ghost" href="#/admin/allegro/oferty">Otwórz katalog</a></div><div class="allegro-catalog-progress"><div><b>${katalogProc}%</b><small>ofert podpiętych do produktów sklepu</small></div><progress max="100" value="${katalogProc}"></progress></div><div class="allegro-catalog-numbers"><span><small>Wszystkie oferty</small><b>${st.oferty}</b></span><span class="ok"><small>Podpięte</small><b>${st.podpiete}</b></span><span class="${st.niepodpiete?"warning":"ok"}"><small>Do powiązania</small><b>${st.niepodpiete}</b></span><span><small>Produkty sklepu</small><b>${st.produkty}</b></span></div></section>
    </div>
    <section class="panel allegro-system-overview"><div class="order-section-head"><div><span class="order-pro-label">Automatyka i integracje</span><h2>Stan kanałów Allegro</h2></div><a class="btn ghost" href="#/admin/allegro/ustawienia">Pełne ustawienia</a></div><div class="allegro-system-grid"><article><span class="${allegroStan.connected?"ok":"warning"}">${allegroStan.connected?"✓":"!"}</span><div><b>Połączenie API</b><small>${allegroStan.connected?"Autoryzacja aktywna":"Wymaga ponownego połączenia"}</small></div></article><article><span class="ok">↻</span><div><b>Zamówienia</b><small>automatyczna kontrola co 15 minut</small></div></article><article><span class="ok">🏷️</span><div><b>Oferty</b><small>${esc(ostatniaOferta?`ostatnio ${allegroDataTxt(ostatniaOferta)}`:"pierwsza synchronizacja oczekuje")}</small></div></article><article><span class="${ostatniaKomunikacja?"ok":"neutral"}">💬</span><div><b>Wiadomości i dyskusje</b><small>${esc(ostatniaKomunikacja?`ostatnio ${allegroDataTxt(ostatniaKomunikacja)}`:"brak ostatniego odczytu")}</small></div></article><article><span class="ok">🛡️</span><div><b>Ochrona opisów</b><small>blokada treści niezgodnych przed publikacją</small></div></article><article><span class="neutral">📈</span><div><b>Opłacalność</b><small>ceny sklepu i Allegro liczone osobno</small></div></article></div></section>
    <section class="panel allegro-module-directory"><div class="order-section-head"><div><span class="order-pro-label">Nawigacja procesowa</span><h2>Wszystkie obszary pracy</h2></div></div><div>${[["📦","Zamówienia","Zlecenia, stan, braki i realizacja","#/admin/allegro/zamowienia"],["🏷️","Oferty","Katalog i powiązania produktów","#/admin/allegro/oferty"],["🟠","Wystawianie","Przygotowanie i publikowanie","#/admin/allegro/wystawianie"],["📈","Opłacalność","Marża, prowizje i rekomendacje","#/admin/allegro/rentownosc"],["💬","Wiadomości","Korespondencja z klientami","#/admin/allegro/wiadomosci"],["🛟","Dyskusje","Reklamacje i sprawy formalne","#/admin/allegro/dyskusje"],["🛡️","Zgodność","Kontrola opisów i bezpieczeństwo","#/admin/allegro/zgodnosc"],["⚙️","Ustawienia","OAuth, synchronizacja i automatyka","#/admin/allegro/ustawienia"]].map(([i,t,d,h])=>`<a href="${h}"><span>${i}</span><div><b>${t}</b><small>${d}</small></div><em>→</em></a>`).join("")}</div></section>
  </div>`;
}
function allegroPostepUstawienHTML(){
  const o=allegroOperacjaUstawien;
  if(!o.busy&&!o.done&&!o.error)return "";
  const pct=o.total?Math.round(o.done/o.total*100):0;
  return `<div class="allegro-settings-progress ${o.error?"has-error":""}"><div><b>${o.busy?`Aktualizuję istniejące oferty: ${o.done}/${o.total}`:o.error?"Aktualizacja przerwana":"Aktualizacja istniejących ofert zakończona"}</b><small>Stan zmieniony: ${o.stockUpdated} • błędy stanu: ${o.stockFailed} • wznawianie: ${o.republishUpdated} • starsze oferty do uzupełnienia: ${o.republishFailed}</small></div><div class="allegro-settings-progress-bar"><i style="width:${pct}%"></i></div>${o.error?`<p>${esc(o.error)}</p>`:""}</div>`;
}
async function allegroZastosujUstawieniaDoIstniejacych(){
  const ids=[...new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean))];
  allegroOperacjaUstawien={busy:true,done:0,total:ids.length,stockUpdated:0,stockFailed:0,republishUpdated:0,republishFailed:0,error:""};renderuj();
  try{
    for(let i=0;i<ids.length;i+=50){
      const batch=ids.slice(i,i+50),d=await chmura("allegro-apply-offer-defaults",{method:"POST",body:{offerIds:batch},timeout:180000});
      allegroOperacjaUstawien={...allegroOperacjaUstawien,done:i+batch.length,stockUpdated:allegroOperacjaUstawien.stockUpdated+Number(d.stockUpdated||0),stockFailed:allegroOperacjaUstawien.stockFailed+Number(d.stockFailed||0),republishUpdated:allegroOperacjaUstawien.republishUpdated+Number(d.republishUpdated||0),republishFailed:allegroOperacjaUstawien.republishFailed+Number(d.republishFailed||0)};
      renderuj();
    }
    const sync=await chmura("allegro-sync-offers",{method:"POST",body:{limit:10000,details:false},timeout:180000});
    allegroOferty=Array.isArray(sync.offers)?sync.offers:allegroOferty;allegroMapowania=sync.mappings||allegroMapowania;
    allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false};
    await allegroWczytajDane(true);allegroZapiszCache();toast(`✅ Stan ${allegroStanOfertyProduktu()} zapisany dla ${allegroOperacjaUstawien.stockUpdated} ofert`);renderuj();
  }catch(e){allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false,error:e.message||String(e)};toast("⚠️ Aktualizacja ofert: "+(e.message||e));renderuj();}
}
async function allegroZapiszUstawieniaOfert(form){
  const fd=new FormData(form),defaultStock=Number(fd.get("defaultStock")),applyExisting=fd.get("applyExisting")==="on";
  if(!Number.isInteger(defaultStock)||defaultStock<1||defaultStock>99999){toast("Podaj stan od 1 do 99999 szt.");return;}
  const producers=String(fd.get("producers")||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).slice(0,50);
  if(!producers.length){toast("Dodaj przynajmniej jednego producenta.");return;}
  try{
    const d=await chmura("allegro-offer-settings",{method:"POST",body:{
      defaultStock,producers,
      autoMapping:fd.get("autoMapping")==="on",
      mappingMinScore:Number(fd.get("mappingMinScore")||88),
      lightSyncMinutes:Number(fd.get("lightSyncMinutes")||15),
      fullSyncHours:Number(fd.get("fullSyncHours")||6),
      autoCatalog:fd.get("autoCatalog")==="on",
      syncDescriptions:fd.get("syncDescriptions")==="on",
      autoUpdateOffers:fd.get("autoUpdateOffers")==="on",
      autoFees:fd.get("autoFees")==="on",
      autoCorrections:fd.get("autoCorrections")==="on",
      autonomousAgent:fd.get("autonomousAgent")==="on",
      autonomousAgentMinutes:Number(fd.get("autonomousAgentMinutes")||15),
      autoResolveDuplicates:fd.get("autoResolveDuplicates")==="on",
      autoResolveDuplicateMinScore:Number(fd.get("autoResolveDuplicateMinScore")||97)
    },timeout:12000});
    allegroStan={...allegroStan,offerSettings:d.settings||{defaultStock,republish:true}};
    toast(`Zapisano automatykę Allegro i ${producers.length} producentów.`);renderuj();
    if(allegroStan.offerSettings.autoMapping!==false)await allegroUruchomAutomatyczneMapowanie(true);
    if(applyExisting)await allegroZastosujUstawieniaDoIstniejacych();
  }catch(e){toast("⚠️ Ustawienia ofert Allegro: "+(e.message||e));}
}
async function allegroUruchomAutomatycznaKonserwacje(){
  try{toast("🟠 Agent sprawdza katalog, opisy i producentów…");const d=await chmura("allegro-auto-maintenance",{method:"POST",body:{limit:50},timeout:180000});await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true);const r=d.maintenance||{};toast(`✅ Sprawdzono ${r.scanned||0}, poprawiono ${r.updated||0}, katalog dopasowano dla ${r.matched||0} produktów.`);}catch(e){toast("⚠️ Automatyka katalogu Allegro: "+(e.message||e));}
}
async function allegroUruchomAgentAutonomiczny(){
  try{
    toast("🤖 Agent analizuje powiązania i bezpieczne duplikaty…");
    const d=await chmura("allegro-autonomous-agent-cycle",{method:"POST",body:{source:"manual-admin",maxActions:10},timeout:180000});
    if(Array.isArray(d.offers))allegroOferty=d.offers;if(d.mappings&&typeof d.mappings==="object")allegroMapowania=d.mappings;
    allegroStan={...allegroStan,autonomousAgent:d.state||allegroStan.autonomousAgent};allegroZapiszCache();
    const s=d.state||{},m=s.mapping||{};toast(`✅ Agent: połączono ${m.autoMapped||0}, zakończono duplikatów ${s.duplicateOffersEnded||0}, do decyzji ${s.reviewCount||0}`);renderuj();
  }catch(e){toast("⚠️ Autonomiczny Agent Allegro: "+(e.message||e));}
}
function allegroProduktMaPelneDaneMarzowe(p={}){return kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))&&!!p.allegroFeeCalculatedAt;}
function rentownoscSygnaturaWeryfikacji(p={}){
  const effective=field=>typeof wartoscKosztuProduktu==="function"?wartoscKosztuProduktu(p,field):kwotaNum(p[field]);
  return JSON.stringify({
    purchase:kwotaNum(p.cenaZakupu),storePrice:kwotaNum(p.cena),allegroPrice:kwotaNum(p.cenaAllegro||p.cena),vonHalskyPrice:kwotaNum(p.cenaVonHalsky??p.cenaAllegro??p.cena),
    commission:kwotaNum(p.allegroCommissionAmount),commissionRate:Number(p.allegroCommissionRate)||0,recurring:kwotaNum(p.allegroRecurringFees),
    packing:effective("kosztPakowania"),storeOther:effective("sklepAdditionalCost"),storePayment:effective("sklepPaymentPercent"),
    allegroOther:effective("allegroAdditionalCost"),shipping:effective("allegroShippingSubsidy"),ads:effective("allegroAdsPercent"),vat:effective("vatRate"),
    storeTarget:Number(p.sklepPriceTargetMargin||sklepDocelowaMarza)||0,allegroTarget:Number(p.allegroPriceTargetMargin||allegroDocelowaMarza)||0,vonHalskyTarget:Number(p.vonHalskyPriceTargetMargin||vonHalskyDocelowaMarza)||0,
    recurringUnits:Number(allegroJednostkiOplatCyklicznych)||1
  });
}
function rentownoscStatusWeryfikacji(p={}){
  if(p.profitabilityReviewed!==true)return "unreviewed";
  return String(p.profitabilityReviewSignature||"")===rentownoscSygnaturaWeryfikacji(p)?"reviewed":"outdated";
}
function rentownoscPolaWeryfikacji(p={},approved=true,at=new Date().toISOString()){
  if(!approved)return {profitabilityReviewed:false};
  const store=sklepRentownoscProduktu(p),allegro=allegroRentownoscProduktu(p),vonHalsky=vonHalskyRentownoscProduktu(p);
  return {profitabilityReviewed:true,profitabilityReviewedAt:at,profitabilityReviewedBy:sesja?.email||"administrator",profitabilityReviewSignature:rentownoscSygnaturaWeryfikacji(p),profitabilityReviewSnapshot:{storePrice:store.price,allegroPrice:allegro.price,vonHalskyPrice:vonHalsky.price,purchasePrice:kwotaNum(p.cenaZakupu),storeMargin:store.margin,allegroMargin:allegro.margin,vonHalskyMargin:vonHalsky.margin,storeTarget:Number(p.sklepPriceTargetMargin||sklepDocelowaMarza)||0,allegroTarget:Number(p.allegroPriceTargetMargin||allegroDocelowaMarza)||0,vonHalskyTarget:Number(p.vonHalskyPriceTargetMargin||vonHalskyDocelowaMarza)||0},profitabilityReviewRevision:2};
}
function rentownoscZapiszWeryfikacje(ids=[],approved=true){
  const unique=[...new Set(ids.map(String))],products=new Map(produktyDoAdministracji().map(p=>[String(p.id),p])),at=new Date().toISOString();let changed=0;
  for(const id of unique){const p=products.get(id);if(!p||czyProduktAdminWKoszu(p))continue;const patch=rentownoscPolaWeryfikacji(p,approved,at),idx=produktyDodane.findIndex(x=>String(x.id)===id);if(idx>=0)produktyDodane[idx]={...produktyDodane[idx],...patch};else produktyEdytowane={...produktyEdytowane,[id]:{...(produktyEdytowane[id]||{}),...patch}};changed++;}
  if(!changed)return 0;
  zapiszLS("artway_produkty_dodane",produktyDodane);zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();zaplanujZapisUstawien();
  zapiszHistorieAgenta("kontrola-rentownosci",`${approved?"Zatwierdzono":"Cofnięto zatwierdzenie"} kalkulacji rentowności: ${changed}`,{productIds:unique.slice(0,500),approved});
  return changed;
}
function ustawFiltrAllegroRentownosc(value="wszystkie"){filtrAllegroRentownosc=value;renderuj();}
function oznaczRentownoscSprawdzona(productId,approved=true){const changed=rentownoscZapiszWeryfikacje([productId],approved);if(changed)toast(approved?"✅ Produkt oznaczony jako sprawdzony według Twojego ustawienia":"Cofnięto oznaczenie produktu jako sprawdzony");renderuj();}
function przelaczZaznaczenieRentownosci(productId,checked){const id=String(productId);checked?zaznaczoneRentownosc.add(id):zaznaczoneRentownosc.delete(id);renderuj();}
function zaznaczWidoczneRentownosc(){for(const {p} of allegroRentownoscLista().slice(0,500))zaznaczoneRentownosc.add(String(p.id));renderuj();}
function wyczyscZaznaczenieRentownosci(){zaznaczoneRentownosc.clear();renderuj();}
function oznaczZaznaczoneRentownosc(approved=true){const ids=[...zaznaczoneRentownosc];if(!ids.length){toast("Najpierw zaznacz produkty");return;}const changed=rentownoscZapiszWeryfikacje(ids,approved);zaznaczoneRentownosc.clear();toast(`${approved?"✅ Oznaczono jako sprawdzone":"Cofnięto oznaczenie"}: ${changed} produktów`);renderuj();}
function rentownoscStatusWeryfikacjiHTML(p={}){const status=rentownoscStatusWeryfikacji(p);if(status==="reviewed"){const snapshot=p.profitabilityReviewSnapshot||{};return `<span class="profit-review-status reviewed"><b>✅ Sprawdzone przeze mnie</b><small>${p.profitabilityReviewedAt?esc(new Date(p.profitabilityReviewedAt).toLocaleString("pl-PL")):"zatwierdzone"}${snapshot.storePrice||snapshot.allegroPrice?` • sklep ${snapshot.storePrice?zl(snapshot.storePrice):"—"} • Allegro ${snapshot.allegroPrice?zl(snapshot.allegroPrice):"—"}`:""}</small></span>`;}if(status==="outdated")return `<span class="profit-review-status outdated"><b>⚠️ Sprawdź ponownie</b><small>Od zatwierdzenia zmieniła się cena, koszt, prowizja lub cel marży.</small></span>`;return `<span class="profit-review-status unreviewed"><b>○ Jeszcze niesprawdzone</b><small>Oznacz po ustawieniu właściwej ceny i marży.</small></span>`;}
function allegroRentownoscLista(){
  const q=String(szukajAllegroRentownosc||"").toLowerCase().trim();let list=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>({p,r:allegroRentownoscProduktu(p),v:vonHalskyRentownoscProduktu(p)})).filter(({p,r,v})=>{const review=rentownoscStatusWeryfikacji(p);if(q&&!`${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||""} ${p.kategoria||""}`.toLowerCase().includes(q))return false;if(filtrAllegroRentownosc==="niesprawdzone"&&review!=="unreviewed")return false;if(filtrAllegroRentownosc==="sprawdzone"&&review!=="reviewed")return false;if(filtrAllegroRentownosc==="nieaktualne"&&review!=="outdated")return false;if(filtrAllegroRentownosc==="kompletne"&&!r.dataComplete)return false;if(filtrAllegroRentownosc==="brak_prowizji"&&p.allegroFeeCalculatedAt)return false;if(filtrAllegroRentownosc==="strata"&&r.profit>=0)return false;if(filtrAllegroRentownosc==="niska"&&(!r.dataComplete||r.margin>=allegroDocelowaMarza))return false;if(filtrAllegroRentownosc==="oplacalne"&&(!r.dataComplete||r.margin<allegroDocelowaMarza))return false;if(filtrAllegroRentownosc==="vonhalsky_niska"&&(!v.dataComplete||v.margin>=vonHalskyDocelowaMarza))return false;if(filtrAllegroRentownosc==="vonhalsky_oplacalne"&&(!v.dataComplete||v.margin<vonHalskyDocelowaMarza))return false;return true;});
  list.sort((a,b)=>sortAllegroRentownosc==="marza_malejaco"?b.r.margin-a.r.margin:sortAllegroRentownosc==="vonhalsky_rosnaco"?a.v.margin-b.v.margin:sortAllegroRentownosc==="vonhalsky_malejaco"?b.v.margin-a.v.margin:sortAllegroRentownosc==="nazwa"?String(a.p.nazwa).localeCompare(String(b.p.nazwa),"pl"):a.r.margin-b.r.margin);return list;
}
function produktDlaWyboruMarzy(productId){return produktyDoAdministracji().find(p=>String(p.id)===String(productId))||null;}
function wyborCenyMarzowejHTML(p={},kanal="allegro"){
  const isStore=kanal==="sklep",isVon=kanal==="vonHalsky",defaultTarget=isStore?sklepDocelowaMarza:isVon?vonHalskyDocelowaMarza:allegroDocelowaMarza,savedTarget=Number(p[isStore?"sklepPriceTargetMargin":isVon?"vonHalskyPriceTargetMargin":"allegroPriceTargetMargin"]),target=Math.max(.1,Math.min(75,Number.isFinite(savedTarget)&&savedTarget>0?savedTarget:defaultTarget)),r=isStore?sklepRentownoscProduktu(p,null,target):isVon?vonHalskyRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target),presets=[10,15,20,25,30],preset=presets.includes(target)?String(target):"custom";
  return `<div class="profit-price-picker ${isStore?"store":isVon?"von-halsky":"allegro"}" data-profit-choice data-product-id="${esc(p.id)}" data-channel="${kanal}"><label>Wariant marży<select data-profit-margin-preset onchange="aktualizujWyborCenyMarzowej(this,'preset')">${presets.map(v=>`<option value="${v}" ${preset===String(v)?"selected":""}>${v}% marży</option>`).join("")}<option value="custom" ${preset==="custom"?"selected":""}>Własna marża</option></select></label><div class="profit-price-fields"><label>Marża %<input data-profit-margin type="number" min="0.1" max="75" step="0.1" value="${esc(target)}" oninput="aktualizujWyborCenyMarzowej(this,'margin')"></label><label>Cena zł<input data-profit-price inputmode="decimal" value="${r.recommended?esc(r.recommended.toFixed(2)):""}" oninput="aktualizujWyborCenyMarzowej(this,'price')"></label></div><small data-profit-choice-result>${r.recommended?`Wybrana marża ${target.toFixed(1)}% → ${zl(r.recommended)}`:"Uzupełnij cenę zakupu i koszty"}</small><button class="btn ${isStore||isVon?"ghost":""}" type="button" ${r.recommended?"":"disabled"} onclick="zastosujWyborCenyMarzowej(this)">${isStore?"🏪 Zastosuj w sklepie":isVon?"🐕 Ustaw Von Halsky":"🟠 Opublikuj na Allegro"}</button></div>`;
}
function aktualizujWyborCenyMarzowej(el,source="margin"){
  const box=el?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId);if(!p)return;
  const kanal=["sklep","vonHalsky"].includes(box.dataset.channel)?box.dataset.channel:"allegro",preset=box.querySelector("[data-profit-margin-preset]"),marginInput=box.querySelector("[data-profit-margin]"),priceInput=box.querySelector("[data-profit-price]"),result=box.querySelector("[data-profit-choice-result]"),button=box.querySelector("button");
  if(source==="preset"){if(preset.value!=="custom")marginInput.value=preset.value;else marginInput.focus();}
  if(source==="margin")preset.value="custom";
  const target=Math.max(.1,Math.min(75,Number(String(marginInput.value).replace(",","."))||0));
  if(source!=="price"){const recommendation=kanal==="sklep"?sklepRentownoscProduktu(p,null,target):kanal==="vonHalsky"?vonHalskyRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target);priceInput.value=recommendation.recommended?recommendation.recommended.toFixed(2):"";}
  const price=kwotaNum(priceInput.value),actual=kanal==="sklep"?sklepRentownoscProduktu(p,price,target):kanal==="vonHalsky"?vonHalskyRentownoscProduktu(p,price,target):allegroRentownoscProduktu(p,price,target);
  result.textContent=price?`Cena ${zl(price)} • zysk ${zl(actual.profit)} • rzeczywista marża ${actual.margin.toFixed(2)}%`:"Wpisz marżę albo własną cenę";button.disabled=!price||kwotaNum(p.cenaZakupu)<=0;
}
async function zastosujWyborCenyMarzowej(button){
  const box=button?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId),kanal=["sklep","vonHalsky"].includes(box.dataset.channel)?box.dataset.channel:"allegro",price=kwotaNum(box.querySelector("[data-profit-price]")?.value);if(!p||!price){toast("Uzupełnij prawidłową cenę");return;}
  const calculation=kanal==="sklep"?sklepRentownoscProduktu(p,price):kanal==="vonHalsky"?vonHalskyRentownoscProduktu(p,price):allegroRentownoscProduktu(p,price);button.disabled=true;button.textContent=kanal==="allegro"?"⏳ Publikuję…":"⏳ Zapisuję…";try{await ustawRekomendowanaCeneProduktu(p.id,kanal,price,calculation.margin);}catch(e){toast("⚠️ Nie udało się zastosować ceny: "+(e.message||e));button.disabled=false;}
}
function allegroScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"allegro");}
function vonHalskyScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"vonHalsky");}
function allegroRentownoscPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),complete=all.filter(allegroProduktMaPelneDaneMarzowe),rows=allegroRentownoscLista(),loss=complete.filter(p=>allegroRentownoscProduktu(p).profit<0).length,low=complete.filter(p=>{const r=allegroRentownoscProduktu(p);return r.profit>=0&&r.margin<allegroDocelowaMarza;}).length,good=complete.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length;
  return `<div class="panel allegro-section-panel profitability-page"><div class="order-section-head"><div><span class="order-pro-label">Decyzje cenowe</span><h2>📈 Opłacalność i wyliczenie marżowe</h2><p class="order-detail-lead">Zaawansowany przelicznik dla gier i pozostałych produktów z ceną zakupu, ceną sprzedaży oraz prowizją pobraną z Allegro. Rozdziela prowizję sprzedażową, opłaty cykliczne, reklamę, pakowanie, dopłatę do dostawy i inne koszty.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Pobierz prowizje dla kompletnych produktów</button></div><div class="orders-stat-grid"><div class="order-stat-card"><span>🧮</span><b>${complete.length}</b><small>pełnych kalkulacji</small></div><div class="order-stat-card ${loss?"hot":""}"><span>🔴</span><b>${loss}</b><small>sprzedaż ze stratą</small></div><div class="order-stat-card ${low?"hot":""}"><span>🟡</span><b>${low}</b><small>poniżej celu ${allegroDocelowaMarza}%</small></div><div class="order-stat-card money"><span>🟢</span><b>${good}</b><small>osiąga cel marży</small></div></div><div class="profitability-controls"><input placeholder="Szukaj: nazwa, SKU, EAN, producent, kategoria…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="filtrAllegroRentownosc=this.value;renderuj()">${[["kompletne","Pełne dane"],["wszystkie","Wszystkie produkty"],["brak_prowizji","Brak pobranej prowizji"],["strata","Sprzedaż ze stratą"],["niska","Marża poniżej celu"],["oplacalne","Osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>Cel marży <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="allegroDocelowaMarza=Math.max(1,Math.min(60,Number(this.value)||20));renderuj()">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div><div class="profitability-guide"><b>Jak czytać wynik?</b><span><i class="green"></i> marża osiąga cel</span><span><i class="yellow"></i> dodatni wynik poniżej celu</span><span><i class="red"></i> strata</span><small>Rekomendacja jest oparta na aktualnej procentowej prowizji. Po zmianie ceny pobierz prowizję ponownie, ponieważ Allegro może stosować progi lub stawki minimalne.</small></div><div class="warehouse-worktable-wrap"><table class="log-table profitability-table"><tr><th>Produkt</th><th>Dane wejściowe</th><th>Prowizja i koszty</th><th>Wynik</th><th>Rekomendowana cena</th><th>Akcje</th></tr>${rows.slice(0,500).map(({p,r})=>{const offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||"");const cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit";return `<tr class="${cls}"><td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small>${!r.dataComplete?`<em>Brakuje: ${[!p.cenaZakupu?"ceny zakupu":"",!p.allegroFeeCalculatedAt?"prowizji Allegro":"",!(p.allegroOfferId||p.allegroCategoryId)?"danych oferty":""].filter(Boolean).join(", ")}</em>`:""}</div></div></td><td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Cena Allegro</small><b>${r.price?zl(r.price):"—"}</b></td><td><small>Prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"}</b><br><small>Pozostałe / szt.</small><b>${zl(r.recurringPerUnit+r.packing+r.other+r.shipping+r.ads)}</b>${p.allegroFeeCalculatedAt&&!r.feeCurrent?`<br><span class="lvl lvl-ostrzezenie">przelicz dla nowej ceny</span>`:""}</td><td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"} • narzut ${r.dataComplete?r.markup.toFixed(2)+"%":"—"}</small><em>próg: ${r.breakEven?zl(r.breakEven):"—"}</em></span></td><td><b>${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></td><td><div class="warehouse-worktable-actions"><button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">🟠 Prowizja</button>${r.recommended?`<button class="btn" onclick="allegroUstawRekomendowanaCene(${jsArg(p.id)},${r.recommended})">Ustaw ${zl(r.recommended)}</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6">Brak produktów pasujących do filtrów.</td></tr>`}</table></div><div class="backend-note allegro-info-bottom"><b>Ważne:</b> kalkulator pokazuje rentowność operacyjną jednej sztuki przed podatkiem dochodowym. VAT jest zapisany w kartotece jako informacja do dalszych rozszerzeń księgowych; wynik korzysta z faktycznych kwot sprzedaży, zakupu i opłat podanych w panelu.</div></div>`;
}
function sklepScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"sklep");}
async function zapiszSzybkaCeneVonHalsky(button,productId){
  const cell=button?.closest?.("[data-von-halsky-profit]"),input=cell?.querySelector?.("[data-von-halsky-price]"),value=kwotaNum(input?.value);
  if(!value){toast("Wpisz prawidłową cenę Von Halsky albo wybierz „Dziedzicz Allegro”.");input?.focus();return;}
  button.disabled=true;button.textContent="⏳ Zapisuję…";
  try{await ustawRekomendowanaCeneProduktu(productId,"vonHalsky",value);}
  finally{button.disabled=false;}
}
async function przywrocDziedziczenieCenyVonHalsky(button,productId){
  const p=produktDlaWyboruMarzy(productId);if(!p)return;
  button.disabled=true;button.textContent="⏳ Zapisuję…";
  zapiszPolaProduktuLokalnie(productId,{cenaVonHalsky:"",vonHalskyPriceRecommendedAt:new Date().toISOString()},false);zaplanujZapisUstawien();
  const ok=await chmuraZapiszUstawienia();toast(ok?"🐕 Von Halsky ponownie dziedziczy cenę Allegro.":"⚠️ Zmiana została zachowana lokalnie i oczekuje na synchronizację.");renderuj();
}
function rentownoscKanalowaWierszHTML({p,r}={}){
  const s=sklepRentownoscProduktu(p),vonTarget=Math.max(.1,Math.min(75,Number(p.vonHalskyPriceTargetMargin||vonHalskyDocelowaMarza)||vonHalskyDocelowaMarza)),v=vonHalskyRentownoscProduktu(p,null,vonTarget),offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||"");
  const cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit",vonCls=!v.dataComplete?"incomplete":v.profit<0?"loss":v.margin<vonTarget?"warning":"profit",review=rentownoscStatusWeryfikacji(p),checked=zaznaczoneRentownosc.has(String(p.id)),ownVon=kwotaNum(p.cenaVonHalsky)>0;
  return `<tr class="${cls} review-${review} ${checked?"is-selected":""}" data-product-row="${esc(p.id)}">
    <td><div class="profit-product-review-cell"><label class="profit-row-select" title="Zaznacz produkt"><input type="checkbox" ${checked?"checked":""} onchange="przelaczZaznaczenieRentownosci(${jsArg(p.id)},this.checked)"></label><div><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small></div></div>${rentownoscStatusWeryfikacjiHTML(p)}</div></div></td>
    <td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Sklep</small><b>${p.cena?zl(p.cena):"—"}</b><br><small>Allegro</small><b>${r.price?zl(r.price):"—"}</b><br><small>Von Halsky</small><b>${v.price?zl(v.price):"—"}</b></td>
    <td><span class="profitability-result ${s.profit<0?"loss":s.margin<sklepDocelowaMarza?"warning":"profit"}"><b>${s.dataComplete?zl(s.profit):"—"}</b><small>marża ${s.dataComplete?s.margin.toFixed(2)+"%":"—"}</small><em>próg ${s.breakEven?zl(s.breakEven):"—"}</em></span><small>Płatność ${s.paymentRate.toFixed(2)}% • inne ${zl(s.other)}</small></td>
    <td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"}</small><em>próg ${r.breakEven?zl(r.breakEven):"—"}</em></span><small>Prowizja ${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"} • wysyłka ${zl(r.shipping)}</small></td>
    <td data-von-halsky-profit><span class="profitability-result ${vonCls}"><b>${v.dataComplete?zl(v.profit):"—"}</b><small>marża ${v.dataComplete?v.margin.toFixed(2)+"%":"—"} • cel ${vonTarget.toFixed(1)}%</small><em>propozycja ${v.recommended?zl(v.recommended):"—"}</em></span><label class="profit-von-price-field"><span>Cena Von Halsky</span><input data-von-halsky-price inputmode="decimal" value="${esc((ownVon?kwotaNum(p.cenaVonHalsky):v.price).toFixed(2))}" aria-label="Cena Von Halsky dla ${esc(p.nazwa||"produktu")}"></label><small class="profit-von-price-source">${ownVon?"Własna cena kanału":"Dziedziczy aktualną cenę Allegro"}</small><div class="profit-von-price-actions"><button class="btn" type="button" onclick="zapiszSzybkaCeneVonHalsky(this,${jsArg(p.id)})">💾 Zapisz</button>${v.recommended?`<button class="btn ghost" type="button" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'vonHalsky',${v.recommended},${vonTarget})">Ustaw ${zl(v.recommended)}</button>`:""}${ownVon?`<button class="btn ghost" type="button" onclick="przywrocDziedziczenieCenyVonHalsky(this,${jsArg(p.id)})">↩ Dziedzicz Allegro</button>`:""}</div></td>
    <td><div class="profit-recommendation-channel"><b>🏪 ${s.recommended?zl(s.recommended):"—"}</b><div class="profit-scenarios">${sklepScenariuszeMarzyHTML(p)}</div></div><div class="profit-recommendation-channel allegro"><b>🟠 ${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></div></td>
    <td><div class="warehouse-worktable-actions">${s.recommended?`<button class="btn ghost" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'sklep',${s.recommended})">Ustaw sklep ${zl(s.recommended)}</button>`:""}${r.recommended?`<button class="btn" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'allegro',${r.recommended})">Ustaw Allegro ${zl(r.recommended)}</button>`:""}<button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">Prowizja</button><button class="btn ${review==="reviewed"?"ghost":""}" onclick="oznaczRentownoscSprawdzona(${jsArg(p.id)},${review==="reviewed"?"false":"true"})">${review==="reviewed"?"Cofnij sprawdzenie":"✅ Sprawdzone — moje ustawienie"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td>
  </tr>`;
}
function rentownoscKanalowaPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),rows=allegroRentownoscLista();
  const sklepPelne=all.filter(p=>sklepRentownoscProduktu(p).dataComplete),allegroPelne=all.filter(allegroProduktMaPelneDaneMarzowe);
  const vonHalskyPelne=all.filter(p=>vonHalskyRentownoscProduktu(p).dataComplete),sklepCel=sklepPelne.filter(p=>sklepRentownoscProduktu(p).margin>=sklepDocelowaMarza).length,allegroCel=allegroPelne.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length,vonHalskyCel=vonHalskyPelne.filter(p=>vonHalskyRentownoscProduktu(p).margin>=vonHalskyDocelowaMarza).length;
  const reviewCounts=all.reduce((acc,p)=>(acc[rentownoscStatusWeryfikacji(p)]++,acc),{unreviewed:0,reviewed:0,outdated:0}),visible=rows.slice(0,500),allIds=new Set(all.map(p=>String(p.id))),selected=[...zaznaczoneRentownosc].filter(id=>allIds.has(id)).length;
  const reviewCards=[["niesprawdzone","⚠️",reviewCounts.unreviewed,"do sprawdzenia","hot"],["nieaktualne","⏳",reviewCounts.outdated,"do ponownej kontroli",reviewCounts.outdated?"hot":""],["sprawdzone","✅",reviewCounts.reviewed,"sprawdzone przeze mnie","money"],["wszystkie","📦",all.length,"wszystkie produkty",""]];
  return `<div class="panel allegro-section-panel profitability-page">
    <div class="order-section-head"><div><span class="order-pro-label">Trzy kanały sprzedaży</span><h2>📈 Opłacalność: sklep, Allegro i Von Halsky</h2><p class="order-detail-lead">Każdy kanał ma własną cenę i cel marży. Cena Von Halsky domyślnie dziedziczy cenę Allegro; własną wartość zapisujesz tylko wtedy, gdy ma być inna.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Odśwież prowizje Allegro</button></div>
    <div class="profit-channel-summary"><article class="store"><span>🏪</span><div><small>Sklep internetowy</small><b>${sklepCel}/${sklepPelne.length} osiąga cel ${sklepDocelowaMarza}%</b></div></article><article class="allegro"><span>🟠</span><div><small>Allegro</small><b>${allegroCel}/${allegroPelne.length} osiąga cel ${allegroDocelowaMarza}%</b></div></article><article class="von-halsky"><span>🐕</span><div><small>Von Halsky</small><b>${vonHalskyCel}/${vonHalskyPelne.length} osiąga cel ${vonHalskyDocelowaMarza}%</b></div></article></div>
    <div class="orders-stat-grid profitability-review-stats">${reviewCards.map(([id,icon,count,label,cls])=>`<button type="button" class="order-stat-card stat-filter ${cls} ${filtrAllegroRentownosc===id?"active":""}" onclick="ustawFiltrAllegroRentownosc(${jsArg(id)})"><span>${icon}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div>
    ${domyslneUstawieniaRentownosciHTML()}
    <div class="profitability-controls"><input placeholder="Szukaj: nazwa, EXTERNAL_ID, SKU, EAN, kod producenta…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="ustawFiltrAllegroRentownosc(this.value)">${[["niesprawdzone","Do sprawdzenia"],["nieaktualne","Do ponownej kontroli"],["sprawdzone","Sprawdzone przeze mnie"],["wszystkie","Wszystkie produkty"],["kompletne","Pełne dane Allegro"],["brak_prowizji","Brak prowizji Allegro"],["strata","Strata na Allegro"],["niska","Allegro poniżej celu"],["oplacalne","Allegro osiąga cel"],["vonhalsky_niska","Von Halsky poniżej celu"],["vonhalsky_oplacalne","Von Halsky osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża Allegro</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża Allegro</option><option value="vonhalsky_rosnaco" ${sortAllegroRentownosc==="vonhalsky_rosnaco"?"selected":""}>Najniższa marża Von Halsky</option><option value="vonhalsky_malejaco" ${sortAllegroRentownosc==="vonhalsky_malejaco"?"selected":""}>Najwyższa marża Von Halsky</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>🏪 Cel sklepu <input type="number" min="1" max="60" value="${esc(sklepDocelowaMarza)}" onchange="ustawCelMarzy('sklep',this.value)">%</label><label>🟠 Cel Allegro <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="ustawCelMarzy('allegro',this.value)">%</label><label>🐕 Cel Von Halsky <input type="number" min="1" max="60" value="${esc(vonHalskyDocelowaMarza)}" onchange="ustawCelMarzy('vonHalsky',this.value)">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div>
    <div class="profitability-review-toolbar"><div><b>${rows.length}</b><span>wyników • <b>${selected}</b> zaznaczonych</span></div><div class="diag-actions"><button class="btn ghost" type="button" onclick="zaznaczWidoczneRentownosc()">Zaznacz widoczne (${visible.length})</button><button class="btn ghost" type="button" onclick="wyczyscZaznaczenieRentownosci()" ${selected?"":"disabled"}>Odznacz</button><button class="btn" type="button" onclick="oznaczZaznaczoneRentownosc(true)" ${selected?"":"disabled"}>✅ Oznacz sprawdzone</button><button class="btn ghost" type="button" onclick="oznaczZaznaczoneRentownosc(false)" ${selected?"":"disabled"}>Cofnij oznaczenie</button></div></div>
    <div class="warehouse-worktable-wrap"><table class="log-table profitability-table profitability-channel-table"><tr><th>Produkt i kontrola</th><th>Zakup i ceny</th><th>🏪 Sklep</th><th>🟠 Allegro</th><th>🐕 Von Halsky — cena i wynik</th><th>Rekomendacje sklepu i Allegro</th><th>Akcje</th></tr>${visible.map(rentownoscKanalowaWierszHTML).join("")||`<tr><td colspan="7">Brak produktów pasujących do aktywnego filtra.</td></tr>`}</table></div>
    <div class="backend-note allegro-info-bottom"><b>Automatyka:</b> Von Halsky dziedziczy cenę Allegro, dopóki nie zapiszesz własnej. Kalkulacja Von używa obecnie tej samej potwierdzonej bazy kosztowej co Allegro; po uruchomieniu prywatnego API kanału stawki zostaną zastąpione jego rzeczywistymi opłatami.</div>
  </div>`;
}
function widokAdminAllegro(sekcja="start"){
  const aktywna=["zamowienia","oferty","wystawianie","rentownosc","wiadomosci","dyskusje","zgodnosc","ustawienia"].includes(sekcja)?sekcja:"start";
  const zakres=aktywna==="zamowienia"?"orders":["oferty","wystawianie","rentownosc","zgodnosc"].includes(aktywna)?"offers":aktywna==="ustawienia"?"config":"summary";
  allegroLadujJesliTrzeba(zakres);
  if(["wiadomosci","dyskusje"].includes(sekcja)&&!allegroKomunikacja?.updated_at&&!allegroKomunikacja?.sprawdzono&&!allegroStan.ladowanie) setTimeout(()=>allegroWczytajKomunikacje(true),0);
  if(["wiadomosci","dyskusje"].includes(sekcja)) setTimeout(()=>allegroAktywujKafelkiKomunikacji(sekcja==="dyskusje"?"issue":"thread"),0);
  const staty=allegroPanelOperacyjnyStaty(),mapped=staty.podpiete,niepodpiete=staty.niepodpiete;
  return adminSzkielet("/admin/allegro", `
  <div class="module-page-stack allegro-module-page">
  ${allegroSubnavHTML(aktywna,staty)}
  ${aktywna==="zamowienia"?allegroZamowieniaTabelaHTML():aktywna==="oferty"?allegroOfertyTabelaHTML():aktywna==="wystawianie"?allegroWystawianiePanelHTML():aktywna==="rentownosc"?rentownoscKanalowaPanelHTML():aktywna==="wiadomosci"?allegroKomunikacjaPanelHTML("thread"):aktywna==="dyskusje"?allegroKomunikacjaPanelHTML("issue"):aktywna==="zgodnosc"?allegroZgodnoscPanelHTML():aktywna==="ustawienia"?allegroUstawieniaPanelHTML():allegroStartPanelHTML(staty)}
  ${allegroStan.error?`<div class="backend-note allegro-info-bottom" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Allegro:</b> ${esc(allegroStan.error)}</div>`:""}
  ${aktywna==="start"?"":allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete,staty)}
  </div>
  `);
}
