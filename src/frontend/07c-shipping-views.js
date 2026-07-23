function nawigacjaWysylek(aktywna="zlecenia"){
  const aktywne=pobierzZamowienia().filter(z=>!["dostarczona","anulowana","zwrot"].includes(etapWysylki(z))).length,problemy=pobierzZamowienia().filter(z=>etapWysylki(z)==="problem").length;
  return adminSubnavHTML([
    {id:"zlecenia",href:"#/admin/wysylki",label:"📋 Obsługa zleceń",badge:aktywne||""},
    {id:"inpost",href:"#/admin/wysylki/inpost",label:"📮 Wysyłka z InPost"},
    {id:"tracking",href:"#/admin/wysylki/tracking",label:"📡 Monitoring i tracking",badge:problemy||""},
    {id:"automatyzacje",href:"#/admin/wysylki/automatyzacje",label:"⚡ Automatyzacje"},
    {id:"ustawienia",href:"#/admin/wysylki/ustawienia",label:"⚙️ Bramka i ustawienia"}
  ],aktywna);
}
function wysylkiKontekstPodstronyHTML(aktywna="zlecenia"){
  const cfg={
    zlecenia:{icon:"📋",eyebrow:"Realizacja zamówień",title:"Obsługa zleceń InPost",description:"Dane odbiorcy, sposób nadania, etykieta i przekazanie przesyłki w jednym procesie."},
    inpost:{icon:"📮",eyebrow:"Nadania umowne",title:"Wysyłka z InPost",description:"Ręczne nadania dla klientów, wszystkie aktywne usługi umowy InPost oraz rozliczenie własnej prowizji."},
    tracking:{icon:"📡",eyebrow:"Monitoring przesyłek",title:"Tracking i wyjątki",description:"Numery nadania, zdarzenia InPost, SLA oraz przesyłki wymagające reakcji operatora."},
    automatyzacje:{icon:"⚡",eyebrow:"Reguły operacyjne",title:"Automatyzacje wysyłek",description:"Automatyczne statusy, tracking, e-maile i alarmy czasu nadania."},
    ustawienia:{icon:"⚙️",eyebrow:"Integracja przewoźnika",title:"Bramka InPost i nadawca",description:"Stan API, usługi, dane nadawcy oraz bezpieczna konfiguracja integracji serwerowej."}
  }[aktywna];
  return `<header class="shipping-page-context"><div><span>${esc(cfg.icon)}</span><div><small>${esc(cfg.eyebrow)}</small><h1>${esc(cfg.title)}</h1><p>${esc(cfg.description)}</p></div></div><a class="btn ghost" href="#/admin/zamowienia">📦 Zamówienia sklepu</a></header>`;
}
function listaWysylekPoFiltrze(){
  let lista=pobierzZamowienia();
  if(filtrWysylek==="aktywne") lista=lista.filter(z=>!["dostarczona","anulowana","zwrot"].includes(etapWysylki(z)));
  else if(filtrWysylek!=="wszystkie") lista=lista.filter(z=>etapWysylki(z)===filtrWysylek);
  if(szukajWysylek) lista=lista.filter(z=>(`${z.nr} ${z.email||""} ${z.wysylka?.numer||""} ${z.adres||""} ${z.wysylka?.operator||""}`).toLowerCase().includes(szukajWysylek));
  return lista;
}
function wysylkiWyczyscZaznaczenie(){zaznaczoneNadania.clear();renderuj();}
function wysylkiEksportujZakres(zakres="filtr",format="tab"){
  const nry=zakres==="zaznaczone"?[...zaznaczoneNadania]:listaWysylekPoFiltrze().map(z=>String(z.nr));
  eksportNadaniaInpostCSV(nry,format);
}
function kartaZleceniaWysylki(z){
  const w=daneWysylki(z), etap=ETAPY_WYSYLKI[etapWysylki(z)], sla=slaWysylki(z);
  const koszty=kosztyZamowienia(z);
  const zad=w.zadania||{}, wykonane=["dane","kompletacja","etykieta","przekazanie"].filter(k=>zad[k]).length;
  const etykietaGotowa=czyEtykietaInpostGotowa(z);
  const zazn=zaznaczoneNadania.has(String(z.nr)), got=gotoweDoNadaniaInpost(z), odbior=String(z?.dostawaId||"").toLowerCase()==="odbior";
  const znacznik = odbior?"":(got.ok?`<span class="lvl" style="background:#dcfce7;color:#166534" title="Dane kompletne — gotowe do nadania">✅ gotowe</span>`:`<span class="lvl" style="background:#fef3c7;color:#92400e" title="Uzupełnij dane odbiorcy przed nadaniem">⚠️ ${esc(got.powod)}</span>`);
  return `<div class="ship-card ${etapWysylki(z)==="problem"?"problem":""}" style="${zazn?"border:2px solid #ffcc00;background:#fffdf3;":""}">
    <div class="ship-card-head">
      <span><label style="margin-right:.5rem;cursor:pointer" title="Zaznacz do nadania z pliku"><input type="checkbox" style="transform:scale(1.25)" ${zazn?"checked":""} onchange="przelaczZaznaczenieNadania(${jsArg(z.nr)})"></label><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a> • ${esc([z.klient?.imie,z.klient?.nazwisko].filter(Boolean).join(" ")||z.email||"gość")}</span>
      <span>${znacznik} <span class="shipment-priority priority-${esc(w.priorytet||"normalny")}">${esc(w.priorytet||"normalny")}</span> <span class="lvl" style="background:${etap.kolor}">${etap.ikona} ${etap.nazwa}</span></span>
    </div>
	    <div class="ship-meta">🚚 ${esc(nazwaPrzewoznika(w.przewoznik||przewoznikDlaZamowienia(z)))} • ${esc(w.usluga||uslugaInpostZamowienia(z))} • 🔢 ${w.numer?esc(w.numer):"<b>oczekuje na etykietę</b>"}<br>
	      📍 ${esc(z.adres||"brak adresu")} • 👤 ${esc(w.operator||"nieprzypisane")} • <span class="${sla.klasa}">⏱ ${esc(sla.tekst)}</span><br>
	      💰 Dostawa: ${koszty.dostawa?zl(koszty.dostawa):"GRATIS"}${koszty.paczkaWeekend?` • Paczka w Weekend: ${zl(koszty.paczkaWeekend)}`:""} • Razem: <b>${zl(koszty.razem)}</b>
	    </div>
    <div style="margin:.5rem 0;font-size:.75rem;color:var(--muted2)">Postęp ${wykonane}/4:
      ${[["dane","dane"],["kompletacja","kompletacja"],["etykieta","etykieta"],["przekazanie","przekazanie"]].map(([k,n])=>`<label style="margin-right:.5rem;white-space:nowrap"><input type="checkbox" ${zad[k]?"checked":""} onchange="przelaczZadanieWysylki('${esc(z.nr)}','${k}')"> ${n}</label>`).join("")}
    </div>
    ${w.bladIntegracji?`<div class="backend-note" style="border-color:var(--danger);background:#fff1f2;color:#991b1b"><b>Wyjątek:</b> ${esc(w.bladIntegracji)}</div>`:""}
    <div class="diag-actions">
      <a class="btn" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Obsłuż zlecenie</a>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'tab')">📄 TXT z nagłówkami InPost</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'csv')">CSV przecinek</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'txt')">TXT średnik</button>
      ${!w.inpostId?`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="utworzPrzesylkeAPI(${jsArg(z.nr)})">🟡 Generuj etykietę InPost</button>`:etykietaGotowa?`<button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(z.nr)},'A6')">🏷️ A6</button><button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(z.nr)},'A4')">🏷️ A4</button>`:`<button class="btn ghost" type="button" disabled title="${esc(opisGotowosciEtykietyInpost(z))}">🏷️ PDF po potwierdzeniu</button>`}
      ${w.inpostId?`<button class="btn ghost" type="button" onclick="synchronizujTrackingAPI(${jsArg(z.nr)})">🔄 Status InPost</button>`:""}
      ${urlSledzenia(z)?`<a class="btn ghost" href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Śledź</a>`:""}
    </div>
  </div>`;
}
function panelZlecenWysylkowych(){
  const wszystkie=pobierzZamowienia(), lista=listaWysylekPoFiltrze();
  const doN = lista.filter(z=>String(z?.dostawaId||"").toLowerCase()!=="odbior" && !["dostarczona","anulowana","zwrot"].includes(etapWysylki(z)));
  const gotoweN = lista.filter(z=>gotoweDoNadaniaInpost(z).ok).length;
  const paczkDoN = doN.filter(z=>paczkomatoweInpost(z)).length, kurierDoN = doN.length - paczkDoN;
  const etapy=["do_obslugi","przygotowanie","etykieta","transport","doreczenie","problem"];
  return `<div class="panel">
    <h1>🚚 Centrum obsługi InPost</h1>
    <p style="color:var(--muted2)">Jeden proces dla zamówień InPost: wybór paczkomatu, etykieta, przekazanie, tracking, doręczenie albo wyjątek.</p>
    <div class="pipeline">${etapy.map(id=>`<div class="pipeline-step ${id==="problem"?"problem":""}"><b>${wszystkie.filter(z=>etapWysylki(z)===id).length}</b><small>${ETAPY_WYSYLKI[id].ikona} ${ETAPY_WYSYLKI[id].nazwa}</small></div>`).join("")}</div>
    ${adminWyszukiwaniePanelHTML({id:"shipping-orders",description:"Zlecenie, klient, numer nadania, operator oraz etap procesu InPost.",results:lista.length,active:!!(szukajWysylek||filtrWysylek!=="aktywne"),open:true,fields:`<div class="orders-toolbar admin-search-full">
      <select onchange="filtrWysylek=this.value;renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option value="aktywne" ${filtrWysylek==="aktywne"?"selected":""}>Wszystkie aktywne</option>
        <option value="wszystkie" ${filtrWysylek==="wszystkie"?"selected":""}>Cała historia</option>
        ${Object.entries(ETAPY_WYSYLKI).map(([id,e])=>`<option value="${id}" ${filtrWysylek===id?"selected":""}>${e.ikona} ${e.nazwa}</option>`).join("")}
      </select>
      <input placeholder="Szukaj: zlecenie, klient, tracking, operator…" value="${esc(szukajWysylek)}" oninput="szukajWysylek=this.value.toLowerCase();zaplanujRenderPoWpisaniu()" style="flex:1;min-width:210px;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
      <button class="btn ghost" onclick="zastosujRegulyWysylek()">⚡ Zastosuj reguły</button>
    </div>`,actions:adminOperacjeWynikowHTML({id:"shipping-orders",selected:zaznaczoneNadania.size,pageCount:lista.length,resultCount:lista.length,selectPage:"zaznaczWszystkieNadania(true)",selectAll:"zaznaczWszystkieNadania(true)",clear:"wysylkiWyczyscZaznaczenie()",exportSelected:"wysylkiEksportujZakres('zaznaczone','tab')",exportAll:"wysylkiEksportujZakres('filtr','tab')",exportLabel:"TXT InPost"})})}
    <div style="border:2px solid #ffcc00;background:linear-gradient(180deg,#fffbeb,#fff);border-radius:14px;padding:.85rem 1rem;margin:.2rem 0 .9rem">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:space-between">
        <div style="font-size:1rem"><b>📄 Nadanie z pliku (InPost)</b> <span style="color:var(--muted2);font-size:.82rem">— hurtowe / awaryjne, bez umowy kurierskiej</span></div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn" style="background:#ffcc00;color:#111;font-weight:800;box-shadow:0 2px 8px rgba(255,204,0,.45)" onclick="eksportNadaniaInpostCSV(null,'tab')">⬇️ TXT z nagłówkami InPost${zaznaczoneNadania.size?` — ${zaznaczoneNadania.size} zazn.`:` — wszystkie (${doN.length})`}</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'csv')">CSV przecinek</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'txt')">TXT średnik</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'extended')">📋 CSV rozszerzony</button>
        </div>
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-top:.65rem">
        <span style="font-size:.8rem;color:var(--muted2);font-weight:700">Zaznacz:</span>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczWszystkieNadania(true)">☑️ Wszystkie (${lista.length})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczGotoweNadania()">✅ Gotowe (${gotoweN})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczTypNadania('paczkomat')">📦 Paczkomat (${paczkDoN})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczTypNadania('kurier')">🚚 Kurier (${kurierDoN})</button>
        ${zaznaczoneNadania.size?`<button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem;color:#b91c1c" onclick="zaznaczoneNadania.clear();renderuj()">✖ Odznacz (${zaznaczoneNadania.size})</button>
        <button class="btn" style="padding:.32rem .7rem;font-size:.83rem;background:#ffcc00;color:#111;margin-left:auto" title="Utwórz przesyłki i etykiety InPost przez API dla zaznaczonych zleceń" onclick="utworzEtykietyZaznaczoneAPI()">🟡 Etykiety API (${zaznaczoneNadania.size})</button>`:""}
      </div>
      <p style="font-size:.77rem;color:var(--muted2);margin:.55rem 0 0">Plik wgraj w InPost: <b>manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU</b> (max 100). Użyj głównego <b>TXT z nagłówkami InPost</b>: zostaw <b>Separator kolumn: Tabulator</b>, ustaw <b>Czy ma nagłówki: Tak</b>, a potem dopasowuj nazwa do nazwy, np. <b>e-mail → E-mail</b>, <b>telefon → Telefon</b>, <b>miasto → Miasto</b>, <b>typ_przesylki → Typ przesyłki</b>. Błąd „nie znaleziono adresu e-mail w pierwszej linii” oznacza, że nagłówki nadal są ustawione na „Nie”.</p>
    </div>
    ${lista.length?lista.map(kartaZleceniaWysylki).join(""):"<p>Brak zleceń dla wybranego filtra.</p>"}
  </div>`;
}
function panelTrackinguWysylek(){
  const lista=pobierzZamowienia().filter(z=>daneWysylki(z).numer||["problem","transport","doreczenie"].includes(etapWysylki(z)));
  return `<div class="panel">
    <h1>📡 Monitoring i tracking</h1>
    <p style="color:var(--muted2)">Monitoring numerów InPost, ostatnich zdarzeń, SLA i wyjątków z automatycznego webhooka oraz ręcznego odświeżenia statusu.</p>
    <div style="border:1.5px solid #86efac;background:#f0fdf4;border-radius:12px;padding:.7rem .9rem;margin:.2rem 0 .9rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:space-between">
      <div style="font-size:.88rem;color:#166534"><b>🤖 Automatyczne sprawdzanie statusów</b><br><span style="color:var(--muted2)">Wszystkie przesyłki są sprawdzane <b>samoczynnie co 6 godzin</b> (harmonogram) + na bieżąco przez webhook InPost. Statusy i e-maile aktualizują się same.</span></div>
      <button class="btn" style="background:#166534;color:#fff;white-space:nowrap" onclick="synchronizujWszystkieStatusyAPI()">🔄 Sprawdź teraz wszystkie</button>
    </div>
    <div class="ship-grid">
      <div class="ship-stat"><b>${lista.length}</b><small>monitorowanych</small></div>
      <div class="ship-stat"><b>${lista.filter(z=>etapWysylki(z)==="transport").length}</b><small>w transporcie</small></div>
      <div class="ship-stat"><b>${lista.filter(z=>etapWysylki(z)==="doreczenie").length}</b><small>w doręczeniu</small></div>
      <div class="ship-stat" style="background:#fff1f2"><b>${lista.filter(z=>etapWysylki(z)==="problem").length}</b><small>wymaga reakcji</small></div>
    </div>
    ${lista.length?`<table class="tracking-table"><tr><th>Zlecenie</th><th>Przewoźnik / numer</th><th>Etap wspólny</th><th>Ostatnie zdarzenie</th><th>SLA</th><th>Akcja</th></tr>
      ${lista.map(z=>{const w=daneWysylki(z),h=[...(w.historia||[])].pop(),e=ETAPY_WYSYLKI[etapWysylki(z)],sla=slaWysylki(z);return`<tr>
        <td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a><br><small>${esc(z.email||"")}</small></td>
        <td>${esc(nazwaPrzewoznika(w.przewoznik))}<br><b>${esc(w.numer||"brak")}</b></td>
        <td><span class="lvl" style="background:${e.kolor}">${e.ikona} ${e.nazwa}</span></td>
        <td>${h?`<b>${esc(h.status)}</b><br><small>${esc(h.czas)}</small>`:"brak zdarzeń"}</td>
        <td class="${sla.klasa}">${esc(sla.tekst)}${w.ostatniaSynchronizacja?`<br><small>synch. ${esc(new Date(w.ostatniaSynchronizacja).toLocaleString("pl-PL"))}</small>`:""}</td>
        <td>${urlSledzenia(z)?`<a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Śledź →</a>`:`<a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Uzupełnij →</a>`}</td>
      </tr>`}).join("")}</table>`:"<p>Brak przesyłek objętych monitoringiem.</p>"}
    <div class="backend-note"><b>Automatyzacja:</b> webhook InPost aktualizuje tę tabelę po zmianie statusu przesyłki. Jeśli etykieta jest tworzona ręcznie w InPost Managerze, w polu referencji/opisu wpisz numer zamówienia ze sklepu, np. <code>ATM-123456</code>.</div>
  </div>`;
}
function panelAutomatyzacjiWysylek(){
  const u=ustawieniaWysylki();
  const emailGotowy=!!stanBramki.email?.configured, emailPolaczony=!!stanBramki.email?.authenticated&&maUprawnieniaZapisuChmury();
  return `<div class="panel">
    <h1>⚡ Automatyzacje wysyłek</h1>
    <p style="color:var(--muted2)">Reguły obowiązują wszystkie zlecenia. Aktywny jest jeden przewoźnik: InPost, z usługami Paczkomat i Kurier.</p>
    <form data-flagi="autoStatus,autoEmail,autoTracking,alarmSla,powiadomieniaWyjatki" onsubmit="zapiszUstawieniaWysylki(event)">
      <h2>Reguły przypisania</h2>
      <div class="automation-row"><span><b>InPost</b><small style="display:block;color:var(--muted2)">Paczkomat wymaga punktu, Kurier używa adresu dostawy</small></span><select name="regulaPaczkomat">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<option value="${id}" selected>${esc(p.nazwa)}</option>`).join("")}</select><span>→ zawsze</span></div>
      <input type="hidden" name="regulaKurier" value="inpost">
      <h2>Synchronizacja i reakcje</h2>
      <label class="chk-row"><input type="checkbox" name="autoTracking" ${u.autoTracking?"checked":""}> Automatycznie pobieraj zdarzenia i normalizuj statusy</label>
      <label class="chk-row"><input type="checkbox" name="autoStatus" ${u.autoStatus?"checked":""}> Aktualizuj status zamówienia na podstawie trackingu</label>
      <label class="chk-row"><input type="checkbox" name="autoEmail" ${u.autoEmail?"checked":""}> Automatycznie wysyłaj e-mail przez API po zmianie statusu, nadaniu, doręczeniu, zwrocie lub problemie</label>
      <label class="chk-row"><input type="checkbox" name="alarmSla" ${u.alarmSla?"checked":""}> Alarmuj o przekroczeniu czasu na nadanie</label>
      <label class="chk-row"><input type="checkbox" name="powiadomieniaWyjatki" ${u.powiadomieniaWyjatki?"checked":""}> Wyróżniaj wyjątki wymagające działania operatora</label>
      <div class="f-row" style="margin-top:.8rem"><div class="f-group"><label>SLA nadania (godziny)</label><input type="number" min="1" name="slaNadanie" value="${esc(u.slaNadanie)}"></div><div class="f-group"><label>Planowany czas doręczenia (godziny)</label><input type="number" min="1" name="slaDoreczenie" value="${esc(u.slaDoreczenie)}"></div></div>
      <button class="btn" type="submit">💾 Zapisz automatyzacje</button>
    </form>
    <div class="backend-note" style="${emailPolaczony?"border-color:#86efac;background:#f0fdf4;color:#166534":emailGotowy?"":"border-color:#f59e0b"}">
      <b>E-mail SMTP:</b> ${emailPolaczony?`${esc(stanBramki.email.provider||"SMTP")} — autoryzacja sprawdzona, automatyczne wiadomości są gotowe`:emailGotowy?`dane są zapisane na serwerze, ale autoryzacja nie została potwierdzona`:stanBramki.email?.credentialIssue==="masked_placeholder"?"wykryto maskę zamiast prawidłowego hasła aplikacji Google":"brak prawidłowej trwałej konfiguracji serwera"}.
      ${!emailPolaczony?` <button class="btn ghost" type="button" onclick="testujEmailPolaczenie()">Sprawdź pocztę</button>`:""}
    </div>
    <form onsubmit="wyslijTestEmail(event)" style="margin-top:1rem">
      <h2>Test wiadomości API</h2>
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>Adres odbiorcy testu</label><input type="email" name="email" value="${esc(KONFIG.emailSklepu)}" required></div>
        <div class="f-group"><button class="btn ghost" type="submit" ${emailPolaczony?"":"disabled"}>📧 Wyślij test</button></div>
      </div>
    </form>
    <div class="backend-note"><b>Sposób działania:</b> e-mail jest wysyłany natychmiast przez serwerowe API, gdy administrator zmienia status zamówienia lub zapisuje nowy numer nadania. Historia i identyfikator wiadomości są zapisywane przy zamówieniu.</div>
  </div>`;
}
function widokAdminWysylki(sekcja="zlecenia"){
  const aktywna=["zlecenia","inpost","tracking","automatyzacje","ustawienia"].includes(String(sekcja||""))?String(sekcja):"zlecenia";tabWysylek=aktywna;
  const widok=aktywna==="inpost"?panelWysylkiUslugowejInpost():aktywna==="tracking"?panelTrackinguWysylek():aktywna==="automatyzacje"?panelAutomatyzacjiWysylek():aktywna==="ustawienia"?panelUstawienBramki():panelZlecenWysylkowych();
  return adminSzkielet("/admin/wysylki",`<div class="module-page-stack shipping-module-page">${nawigacjaWysylek(aktywna)}${wysylkiKontekstPodstronyHTML(aktywna)}<div class="shipping-workspace section-${esc(aktywna)}">${widok}</div></div>`);
}
