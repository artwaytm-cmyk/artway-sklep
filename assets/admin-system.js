/* GENERATED ADMIN SYSTEM — loaded on demand */
/* ═══════════ WIDOK: DIAGNOSTYKA (tylko administrator) ═══════════
   Dostęp mają konta z rolą administratora. Zwykli klienci nie
   widzą linku w stopce ani samej strony.                         */
function widokBrakDostepu(){
  return `<div class="page"><div class="panel auth-box" style="text-align:center">
    <h1>🔒 Strefa właściciela</h1>
    <p>Ta strona jest dostępna tylko dla administratora sklepu.</p>
    <p style="margin-top:1rem">${sesja?`<a href="#/">← Wróć do sklepu</a>`:`<a class="btn" href="#/logowanie">Zaloguj się</a>`}</p>
  </div></div>`;
}
let filtrLogowDiag="wszystkie", szukajLogowDiag="", ostatniAutotest=[], diagSearchT;
let systemDiagTylkoProblemy=true;
let systemWersjaStan={sprawdzono:false,ladowanie:false,wdrazanie:false,release:null,backendOnline:false,error:""};
function systemWersjaPrzegladarki(){return document.querySelector('meta[name="artway-version"]')?.content||"nieznana";}
function systemDataCzas(value){const ts=Date.parse(value||"");return Number.isFinite(ts)?new Date(ts).toLocaleString("pl-PL"):"—";}
async function systemSprawdzWersje(cicho=false){
  if(systemWersjaStan.ladowanie)return;
  systemWersjaStan={...systemWersjaStan,ladowanie:true,error:""};if(!cicho&&trasa().startsWith("/admin/system"))renderuj();
  try{
    const [releaseResult,healthResult]=await Promise.allSettled([
      fetch(`/release.json?ts=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}}),
      fetch(`/healthz?ts=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}})
    ]);
    if(releaseResult.status!=="fulfilled"||!releaseResult.value.ok)throw new Error("Serwer nie udostępnił informacji o aktualnym wydaniu");
    const release=await releaseResult.value.json();
    systemWersjaStan={sprawdzono:true,ladowanie:false,wdrazanie:false,release:{releaseId:String(release.releaseId||release.version||""),version:String(release.version||""),commit:String(release.commit||""),createdAt:String(release.createdAt||"")},backendOnline:healthResult.status==="fulfilled"&&healthResult.value.ok,error:""};
    if(!cicho)toast(systemWersjaStan.release.releaseId===systemWersjaPrzegladarki()?"Ta przeglądarka ma najnowszą wersję ✅":"Dostępna jest nowsza wersja strony");
  }catch(error){systemWersjaStan={...systemWersjaStan,sprawdzono:true,ladowanie:false,backendOnline:false,error:error.message};if(!cicho)toast("Nie udało się sprawdzić wersji");}
  if(trasa().startsWith("/admin/system"))renderuj();
}
async function systemPobierzNajnowszaWersje(){
  if(systemWersjaStan.wdrazanie)return;
  if(!systemWersjaStan.release)await systemSprawdzWersje(true);
  if(!systemWersjaStan.release){toast("Najpierw serwer musi potwierdzić aktualne wydanie");return;}
  systemWersjaStan={...systemWersjaStan,wdrazanie:true,error:""};renderuj();
  try{
    if("serviceWorker" in navigator){
      const registration=await navigator.serviceWorker.getRegistration("/");
      await registration?.update();
      registration?.waiting?.postMessage({type:"SKIP_WAITING"});
      registration?.active?.postMessage({type:"CLEAR_APP_CACHE"});
    }
    if("caches" in window){const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith("artway-")).map(key=>caches.delete(key)));}
    sessionStorage.setItem("artway_oczekiwane_wydanie",systemWersjaStan.release.releaseId);
    loguj("info",`Pobrano wydanie ${systemWersjaStan.release.releaseId} do przeglądarki`);
    toast("Aktualizacja pobrana — przeładowuję panel ✅");
    setTimeout(()=>location.reload(),350);
  }catch(error){systemWersjaStan={...systemWersjaStan,wdrazanie:false,error:error.message};loguj("blad","Aktualizacja przeglądarki: "+error.message);toast("Nie udało się pobrać aktualizacji");renderuj();}
}
function rozmiarDanychLokalnych(){
  let n=0;
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=(k?.length||0)+(localStorage.getItem(k)?.length||0);}}catch(e){}
  return n*2;
}
function testyDiagnostyczne(){
  const t=[], dodaj=(grupa,nazwa,status,szczegoly)=>t.push({grupa,nazwa,status,szczegoly});
  const zamowieniaDiag=pobierzZamowienia();
  const kontaDiag=pobierzUzytkownikow(), administratorzyDiag=kontaDiag.filter(u=>kontoMaRoleAdmin(u.email));
  const ids=produkty.map(p=>p.id), unikalne=new Set(ids), wszystkieAdmin=produktyDoAdministracji(), adminIds=new Set(wszystkieAdmin.map(p=>p.id));
  const mapa=ustawienia.mapaProduktow||{}, osieroconeMap=Object.keys(mapa).filter(id=>!adminIds.has(+id));
  const osieroconyKoszyk=koszyk.filter(x=>!ids.includes(x.id)), osieroconeUlub=ulubione.filter(id=>!ids.includes(id));
  const bezZdjec=produkty.filter(p=>!p.zdjecie).length, bledneProdukty=produkty.filter(p=>!p.nazwa||!p.kategoria||!(p.cena>0));
  const idsKosza=[...koszDodanych.map(p=>p.id),...bazoweProduktyWKoszu().map(p=>p.id)];
  const brakMetaKosza=idsKosza.filter(id=>!koszMeta[id]), wygasleKosza=idsKosza.filter(id=>Date.now()-Number(koszMeta[id]?.usunietoAt||Date.now())>=OKRES_KOSZA_MS);
  const pamiec=rozmiarDanychLokalnych(),publikacjaKatalogu=stanPublikacjiKatalogu();
  dodaj("Produkty","Produkty są wczytane",produkty.length?"ok":"bad",`${produkty.length} widocznych produktów`);
  dodaj("Produkty","Unikalne identyfikatory produktów",unikalne.size===ids.length?"ok":"bad",unikalne.size===ids.length?"Brak duplikatów ID":`${ids.length-unikalne.size} zduplikowanych ID`);
  dodaj("Produkty","Poprawne dane i ceny",bledneProdukty.length?"bad":"ok",bledneProdukty.length?`${bledneProdukty.length} produktów wymaga poprawy`:"Nazwy, katalogi i ceny są poprawne");
  dodaj("Produkty","Zdjęcia produktów",bezZdjec?"warn":"ok",bezZdjec?`${bezZdjec} produktów korzysta z ikon zamiast zdjęć`:"Wszystkie produkty mają zdjęcia");
  dodaj("Produkty","Kosz produktów na 30 dni",brakMetaKosza.length||wygasleKosza.length?"warn":"ok",brakMetaKosza.length?`${brakMetaKosza.length} pozycji nie ma daty usunięcia`:wygasleKosza.length?`${wygasleKosza.length} pozycji czeka na automatyczne czyszczenie`:`${idsKosza.length} pozycji w koszu; metadane retencji są spójne`);
  dodaj("Produkty","Stronicowanie dużego katalogu",[12,24,48,96].includes(produktyNaStronie)&&[25,50,100,200].includes(produktyNaStronieAdmin)?"ok":"warn",`Sklep: ${produktyNaStronie} / strona • panel: ${produktyNaStronieAdmin} / strona`);
  dodaj("Produkty","Schemat importu i eksportu",POLA_CSV_PRODUKTU.length>=16?"ok":"warn",`${POLA_CSV_PRODUKTU.length} obsługiwanych kolumn • JSON i CSV • kopia przed importem`);
  dodaj("Dane","Spójność koszyka",osieroconyKoszyk.length?"warn":"ok",osieroconyKoszyk.length?`${osieroconyKoszyk.length} nieistniejących pozycji`:"Brak osieroconych pozycji");
  dodaj("Dane","Spójność ulubionych",osieroconeUlub.length?"warn":"ok",osieroconeUlub.length?`${osieroconeUlub.length} nieistniejących produktów`:"Lista jest spójna");
  dodaj("Dane","Spójność mapowania",osieroconeMap.length?"warn":"ok",osieroconeMap.length?`${osieroconeMap.length} osieroconych mapowań`:"Wszystkie mapowania wskazują produkty");
  dodaj("Konfiguracja","Metoda dostawy",KONFIG.dostawy.length?"ok":"bad",`${KONFIG.dostawy.length} dostępnych metod`);
  dodaj("Konfiguracja","Metoda płatności",dostepnePlatnosci().length?"ok":"bad",`${dostepnePlatnosci().length} aktywnych metod`);
  const niepelneDaneWysylki=zamowieniaDiag.filter(z=>!z.klient?.telefon||!z.adresDostawy?.kod).length;
  const bezNumeru=zamowieniaDiag.filter(z=>!["anulowane","zakończone","dostarczone"].includes(z.status)&&!z.wysylka?.numer).length;
  const wyjatkiWysylki=zamowieniaDiag.filter(z=>etapWysylki(z)==="problem").length, uwDiag=ustawieniaWysylki();
  dodaj("Wysyłki","Dane odbiorców",niepelneDaneWysylki?"warn":"ok",niepelneDaneWysylki?`${niepelneDaneWysylki} starszych zamówień nie ma pełnego telefonu lub adresu`:"Dane nowych zamówień są gotowe do API InPost");
  dodaj("Wysyłki","Numery nadania",bezNumeru?"warn":"ok",bezNumeru?`${bezNumeru} aktywnych zamówień czeka na numer nadania`:"Wszystkie aktywne przesyłki mają numer");
  dodaj("Wysyłki","Kolejka wyjątków",wyjatkiWysylki?"bad":"ok",wyjatkiWysylki?`${wyjatkiWysylki} przesyłek wymaga reakcji operatora`:"Brak nierozwiązanych wyjątków");
  dodaj("Wysyłki","Reguły automatycznego wyboru",uwDiag.regulaPaczkomat==="inpost"?"ok":"bad",`Aktywne metody: InPost Paczkomat i Kurier InPost`);
  const poprawnyEndpoint=String(uwDiag.apiEndpoint||"").startsWith("/")||String(uwDiag.apiEndpoint||"").startsWith("https://")||String(uwDiag.apiEndpoint||"").startsWith("http://");
  dodaj("Integracje","Uniwersalna bramka",stanBramki.online?"ok":poprawnyEndpoint?"warn":"bad",stanBramki.online?`Backend VPS dostępny • tryb wysyłek ${uwDiag.tryb}`:`Endpoint awaryjny ${uwDiag.apiEndpoint} • sprawdź usługę serwera`);
  dodaj("Integracje","Centralna baza zamówień",stanBazyCentralnej.online?"ok":stanBazyCentralnej.sprawdzono?"bad":"warn",stanBazyCentralnej.online
    ?`${stanBazyCentralnej.orders} zamówień • ${stanBazyCentralnej.users} klientów • wspólne dla wszystkich urządzeń`
    :stanBazyCentralnej.error||"Połącz backend, aby sprawdzić i zsynchronizować wspólną bazę");
  const ipDiag=stanBramki.inpost||{};
  const avDiag=ipDiag.serviceAvailability||{};
  dodaj("Integracje","InPost ShipX API",ipDiag.configured?((avDiag.locker===false||avDiag.courier===false)?"warn":"ok"):"warn",ipDiag.configured
    ?`Token i Organization ID są ustawione${ipDiag.geowidgetConfigured?" • Geowidget aktywny":" • brakuje tylko Geowidget"}${ipDiag.webhookConfigured?" • webhook aktywny":" • webhook do konfiguracji"}${avDiag.locker===false?" • brak usługi paczkomatowej":""}${avDiag.courier===false?" • kurier InPost nieaktywny":""}`
    :`Brakuje: ${((ipDiag.missingEnv&&ipDiag.missingEnv.length?ipDiag.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", "))}`);
  const emailDiag=!!stanBramki.email?.authenticated;
  dodaj("Integracje","Automatyczne e-maile",emailDiag?"ok":"warn",emailDiag
    ?`${stanBramki.email.provider||"SMTP"} — autoryzacja serwerowa potwierdzona, połączenie trwałe`
    :stanBramki.email?.lastError||"Poczta wymaga kontroli trwałego połączenia serwerowego");
  dodaj("Konfiguracja","Telefon sklepu",KONFIG.telefon.includes("000 000 000")?"warn":"ok",KONFIG.telefon);
  dodaj("Konfiguracja","Dane prawne",danePrawneFirmyKompletne()?"ok":"bad",danePrawneFirmyKompletne()?"Brak pól przykładowych":"Uzupełnij dane firmy w treściach prawnych");
  dodaj("Bezpieczeństwo","Hasło administratora",domyslneHasloAdmina?"bad":"ok",domyslneHasloAdmina?"Nadal ustawione jest hasło admin":"Hasło zostało zmienione");
  dodaj("Bezpieczeństwo","Role kont administracyjnych",administratorzyDiag.length?"ok":"bad",`${administratorzyDiag.length} kont z rolą administratora • ${kontaDiag.length-administratorzyDiag.length} kont klientów`);
  dodaj("Publikacja","Źródło produktów",zrodloProduktow==="json"?"ok":"warn",zrodloProduktow==="json"?"products.json dostępny":"Używana jest lista zapasowa");
  dodaj("Publikacja","Kopia katalogu products.json",publikacjaKatalogu.gotowy?"ok":"warn",publikacjaKatalogu.gotowy?`Zabezpiecza wszystkie ${publikacjaKatalogu.razem} kart produktów`:`Brakujące ${publikacjaKatalogu.brakujace.length} • zmienione ${publikacjaKatalogu.nieaktualne.length} • odśwież products.json`);
  dodaj("Publikacja","Atomowe wydanie strony",!systemWersjaStan.sprawdzono?"warn":systemWersjaStan.release&&systemWersjaStan.backendOnline?"ok":"bad",!systemWersjaStan.sprawdzono?"Sprawdź wersję w Centrum systemu":systemWersjaStan.release&&systemWersjaStan.backendOnline?`Aktywne wydanie ${systemWersjaStan.release.releaseId}`:systemWersjaStan.error||"Nie udało się potwierdzić aktywnego wydania");
  dodaj("Pamięć","Wykorzystanie pamięci",pamiec>4_000_000?"bad":pamiec>2_500_000?"warn":"ok",`${(pamiec/1024).toFixed(1)} KB zapisanych danych • ciężkie cache Allegro nie są już dublowane lokalnie`);
  const zleBannery=pobierzBannery().filter(b=>!b.tytul||bezpiecznyLink(b.link)==="#/"&&b.link!=="#/");
  dodaj("Wygląd","Konfiguracja banerów",zleBannery.length?"warn":"ok",zleBannery.length?`${zleBannery.length} banerów wymaga sprawdzenia`:`${pobierzBannery().length} poprawnych banerów`);
  return [...t,...ostatniAutotest];
}
function wynikKondycji(testy=testyDiagnostyczne()){
  const bad=testy.filter(x=>x.status==="bad").length, warn=testy.filter(x=>x.status==="warn").length;
  return Math.max(0,Math.min(100,100-bad*12-warn*4));
}
function generujSugestie(){
  const problemy=testyDiagnostyczne().filter(x=>x.status!=="ok");
  if(!problemy.length)return [{ico:"✅",tekst:"Wszystkie kontrole zakończone poprawnie."}];
  return problemy.slice(0,8).map(x=>({ico:x.status==="bad"?"❌":"⚠️",tekst:`${x.nazwa}: ${x.szczegoly}`}));
}
function widokDiagnostyka(){
  const wszystkieLogi=pobierzLogi(), testy=testyDiagnostyczne(), wynik=wynikKondycji(testy), pamiec=rozmiarDanychLokalnych();
  let logi=wszystkieLogi;
  if(filtrLogowDiag!=="wszystkie")logi=logi.filter(l=>l.poziom===filtrLogowDiag);
  if(szukajLogowDiag)logi=logi.filter(l=>(l.tresc+" "+l.zrodlo).toLowerCase().includes(szukajLogowDiag));
  const nazwaPoziomu={blad:"BŁĄD",ostrzezenie:"UWAGA",info:"INFO"};
  const grupy=[...new Set(testy.map(x=>x.grupa))];
  return `
  <div class="page page-wide">
    <div class="panel" style="margin-bottom:1rem">
      <h1>🛠️ Centrum diagnostyczne</h1>
      <div class="health-card">
        <div class="health-score">${wynik}%</div>
        <div><h2 style="margin:0">Kondycja sklepu: ${wynik>=90?"bardzo dobra":wynik>=70?"dobra":wynik>=50?"wymaga uwagi":"wymaga naprawy"}</h2>
          <p>${testy.filter(x=>x.status==="ok").length} testów poprawnych • ${testy.filter(x=>x.status==="warn").length} ostrzeżeń • ${testy.filter(x=>x.status==="bad").length} błędów</p>
          <div class="health-bar"><span style="width:${wynik}%"></span></div>
        </div>
      </div>
      <div class="diag-grid">
        <div class="diag-card"><b>${produkty.length}</b><small>produktów • ${zrodloProduktow}</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().length}</b><small>zamówień</small></div>
        <div class="diag-card"><b>${pobierzUzytkownikow().filter(u=>!kontoMaRoleAdmin(u.email)).length}</b><small>kont klientów</small></div>
        <div class="diag-card"><b>${pobierzUzytkownikow().filter(u=>kontoMaRoleAdmin(u.email)).length}</b><small>administratorów</small></div>
        <div class="diag-card"><b>${(pamiec/1024).toFixed(1)} KB</b><small>pamięci lokalnej</small><div class="storage-bar"><span style="width:${Math.min(100,pamiec/50000)}%"></span></div></div>
        <div class="diag-card"><b>${wszystkieLogi.filter(l=>l.poziom==="blad").length}</b><small>błędów w dzienniku</small></div>
        <div class="diag-card"><b>${pobierzBannery().filter(b=>b.aktywny!==false).length}</b><small>aktywnych banerów</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().filter(z=>z.wysylka?.numer).length}</b><small>przesyłek z numerem nadania</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().filter(z=>!["anulowane","zakończone","dostarczone"].includes(z.status)&&!z.wysylka?.numer).length}</b><small>przesyłek do przygotowania</small></div>
      </div>
      <div class="diag-actions">
        <button class="btn" onclick="uruchomAutotest()">🧪 Pełny autotest</button>
        <button class="btn ghost" onclick="kopiujRaport()">📋 Kopiuj raport</button>
        <button class="btn ghost" onclick="pobierzRaportJSON()">⬇️ Raport JSON</button>
        <button class="btn ghost" onclick="eksportujKopieDanych()">💾 Kopia danych</button>
        <label class="btn ghost" style="cursor:pointer">📥 Przywróć kopię<input type="file" accept="application/json" onchange="importujKopieDanych(event)" style="display:none"></label>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">✅ Testy integralności i konfiguracji</h2>
      ${grupy.map(g=>`<h3 class="f-sekcja">${esc(g)}</h3><div class="test-list">${testy.filter(x=>x.grupa===g).map(x=>`
        <div class="test-row"><span>${x.status==="ok"?"✅":x.status==="warn"?"⚠️":"❌"}</span><span><b>${esc(x.nazwa)}</b><small>${esc(x.szczegoly)}</small></span><span class="test-status ${x.status}">${x.status==="ok"?"OK":x.status==="warn"?"UWAGA":"BŁĄD"}</span></div>`).join("")}</div>`).join("")}
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">🔧 Narzędzia naprawcze</h2>
      <p style="font-size:.86rem;color:var(--muted2)">Naprawa usuwa wyłącznie odwołania do nieistniejących produktów, duplikaty i osierocone mapowania. Nie usuwa prawidłowych produktów ani zamówień.</p>
      <div class="diag-actions">
        <button class="btn" onclick="naprawDaneSklepu()">🧹 Napraw spójność danych</button>
        <a class="btn ghost" href="#/admin/system">🛠️ Wersja i aktualizacja</a>
        <a class="btn ghost" href="#/admin/wyglad">🎨 Ustawienia układu</a>
        <a class="btn ghost" href="#/admin/podstrony">🧱 Ustawienia podstron</a>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">🖥️ Środowisko</h2>
      <div class="info-grid">
        <div class="info-card"><b>Adres</b><p>${esc(location.href)}</p></div>
        <div class="info-card"><b>Widok</b><p>${window.innerWidth||"—"} × ${window.innerHeight||"—"} px</p></div>
        <div class="info-card"><b>Połączenie</b><p>${navigator.onLine===false?"offline":"online"} • ${location.protocol==="https:"?"HTTPS":location.hostname==="localhost"||location.hostname==="127.0.0.1"?"lokalnie":"HTTP"}</p></div>
        <div class="info-card"><b>Przeglądarka</b><p>${esc((navigator.userAgent||"").slice(0,100))}</p></div>
      </div>
    </div>
    <div class="panel">
      <div class="admin-banner-head"><h2 style="margin:0">📋 Dziennik zdarzeń (${logi.length}/${wszystkieLogi.length})</h2>
        <div><button class="btn ghost" onclick="pobierzPlikLogu()">⬇️ TXT</button><button class="btn danger" onclick="wyczyscLogi()">🗑️ Wyczyść</button></div></div>
      <div class="diag-toolbar">
        <select onchange="filtrLogowDiag=this.value;renderuj()"><option value="wszystkie">Wszystkie poziomy</option><option value="blad" ${filtrLogowDiag==="blad"?"selected":""}>Błędy</option><option value="ostrzezenie" ${filtrLogowDiag==="ostrzezenie"?"selected":""}>Ostrzeżenia</option><option value="info" ${filtrLogowDiag==="info"?"selected":""}>Informacje</option></select>
        <input placeholder="Szukaj w dzienniku…" value="${esc(szukajLogowDiag)}" oninput="szukajLogowDiag=this.value.toLowerCase();clearTimeout(diagSearchT);diagSearchT=setTimeout(renderuj,350)">
      </div>
      ${logi.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>Czas</th><th>Poziom</th><th>Zdarzenie</th><th>Źródło</th></tr>
        ${logi.slice(0,100).map(l=>`<tr><td style="white-space:nowrap">${esc(l.czas)}</td><td><span class="lvl lvl-${l.poziom}">${nazwaPoziomu[l.poziom]||l.poziom}</span></td><td>${esc(l.tresc)}</td><td>${esc(l.zrodlo)}</td></tr>`).join("")}</table></div>`
      :`<p style="color:var(--muted2)">Brak zdarzeń pasujących do filtra.</p>`}
    </div>
  </div>`;
}
function systemStatusHTML(){
  const s=systemWersjaStan,browser=systemWersjaPrzegladarki(),server=s.release?.releaseId||"—",aktualna=!!s.release&&browser===server;
  return `<section class="system-release-hero">
    <div><span class="order-pro-label">Aktywne wydanie produkcyjne</span><h1>🛠️ System i aktualizacje</h1><p>Jedno miejsce do sprawdzania wersji, pobierania aktualizacji do tej przeglądarki i kontroli kondycji sklepu.</p></div>
    <span class="system-release-state lvl ${aktualna?"lvl-ok":s.error?"lvl-blad":"lvl-ostrzezenie"}">${aktualna?"✅ Wersja aktualna":s.error?"❌ Brak potwierdzenia":"⬆️ Aktualizacja dostępna"}</span>
  </section>
  <section class="panel system-release-panel">
    <div class="system-release-grid info-grid">
      <article class="info-card"><small>Wersja w tej przeglądarce</small><b>${esc(browser)}</b><span>${aktualna?"zgodna z serwerem":"wymaga odświeżenia"}</span></article>
      <article class="info-card"><small>Wydanie na serwerze</small><b>${esc(server)}</b><span>${s.release?systemDataCzas(s.release.createdAt):"jeszcze niesprawdzone"}</span></article>
      <article class="info-card"><small>Backend</small><b>${s.backendOnline?"Online":"Niepotwierdzony"}</b><span>${s.backendOnline?"Nginx i API odpowiadają":"uruchom sprawdzenie"}</span></article>
      <article class="info-card"><small>Commit</small><b>${esc((s.release?.commit||"—").slice(0,12))}</b><span>wersja źródłowa wdrożenia</span></article>
    </div>
    ${s.error?`<div class="system-inline-alert backend-note"><b>Nie udało się potwierdzić wydania:</b> ${esc(s.error)}</div>`:""}
    <div class="system-primary-action sug"><div><b>Pobierz najnowszą wersję do tej przeglądarki</b><small>Bezpiecznie czyści wyłącznie pamięć plików aplikacji. Produkty, zamówienia, konta i ustawienia nie są usuwane.</small></div><div><button class="btn ghost" onclick="systemSprawdzWersje()" ${s.ladowanie||s.wdrazanie?"disabled":""}>${s.ladowanie?"⏳ Sprawdzam…":"🔄 Sprawdź wersję"}</button><button class="btn" onclick="systemPobierzNajnowszaWersje()" ${s.wdrazanie?"disabled":""}>${s.wdrazanie?"⏳ Pobieram…":"⬇️ Pobierz i uruchom aktualizację"}</button></div></div>
  </section>
  <section class="panel system-deployment-note"><span>🛡️</span><div><b>Publikacja jest atomowa i zabezpieczona</b><p>Nowa wersja trafia na serwer jako komplet plików, przechodzi test zdrowia i dopiero wtedy jest przełączana. W razie błędu serwer automatycznie wraca do poprzedniego wydania.</p></div><a class="btn ghost" href="#/admin/system/diagnostyka">Uruchom diagnostykę</a></section>`;
}
function systemDiagnostykaHTML(){
  const wszystkie=testyDiagnostyczne(),testy=systemDiagTylkoProblemy?wszystkie.filter(x=>x.status!=="ok"):wszystkie,wynik=wynikKondycji(wszystkie),bad=wszystkie.filter(x=>x.status==="bad").length,warn=wszystkie.filter(x=>x.status==="warn").length;
  return `<section class="system-summary-grid info-grid"><article class="info-card"><small>Kondycja</small><b>${wynik}%</b><span>${wynik>=90?"bardzo dobra":wynik>=70?"dobra":"wymaga działania"}</span></article><article class="info-card"><small>Błędy</small><b>${bad}</b><span>wymagają naprawy</span></article><article class="info-card"><small>Ostrzeżenia</small><b>${warn}</b><span>do sprawdzenia</span></article><article class="info-card"><small>Kontrole</small><b>${wszystkie.length}</b><span>pełny zakres systemu</span></article></section>
  <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Integralność i integracje</span><h1>🩺 Diagnostyka systemu</h1><p>Najpierw pokazujemy tylko problemy, aby nie zasłaniać czynności wymagających uwagi.</p></div><div><button class="btn ghost" onclick="systemDiagTylkoProblemy=!systemDiagTylkoProblemy;renderuj()">${systemDiagTylkoProblemy?"Pokaż wszystkie kontrole":"Pokaż tylko problemy"}</button><button class="btn" onclick="uruchomAutotest()">🧪 Pełny autotest</button></div></div>
    ${testy.length?`<div class="system-check-list test-list">${testy.map(x=>`<article class="test-row ${x.status}"><span>${x.status==="ok"?"✅":x.status==="warn"?"⚠️":"❌"}</span><div><small>${esc(x.grupa)}</small><b>${esc(x.nazwa)}</b><p>${esc(x.szczegoly)}</p></div><em class="test-status ${x.status}">${x.status==="ok"?"OK":x.status==="warn"?"UWAGA":"BŁĄD"}</em></article>`).join("")}</div>`:`<div class="system-empty order-empty"><span>✅</span><b>Brak problemów wymagających działania</b><p>Wszystkie kontrole zakończyły się poprawnie.</p></div>`}
  </section>
  <section class="panel system-repair sug"><span>🧹</span><div><b>Bezpieczna naprawa spójności</b><small>Usuwa wyłącznie osierocone odwołania i duplikaty techniczne. Nie usuwa prawidłowych produktów ani zamówień.</small></div><button class="btn ghost" onclick="naprawDaneSklepu()">Sprawdź i napraw dane</button></section>`;
}
function systemLogiHTML(){
  const wszystkie=pobierzLogi();let logi=wszystkie;if(filtrLogowDiag!=="wszystkie")logi=logi.filter(l=>l.poziom===filtrLogowDiag);if(szukajLogowDiag)logi=logi.filter(l=>(`${l.tresc} ${l.zrodlo}`).toLowerCase().includes(szukajLogowDiag));
  const poziom={blad:"BŁĄD",ostrzezenie:"UWAGA",info:"INFO"};
  return `<section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Historia techniczna</span><h1>📋 Dziennik zdarzeń</h1><p>${logi.length} z ${wszystkie.length} wpisów pasuje do bieżącego filtra.</p></div><div><button class="btn ghost" onclick="pobierzPlikLogu()">⬇️ Pobierz TXT</button><button class="btn danger" onclick="wyczyscLogi()">🗑️ Wyczyść</button></div></div>
  ${adminWyszukiwaniePanelHTML({id:"system-logi",title:"Filtry dziennika",description:"Znajdź błąd, ostrzeżenie albo zdarzenie z konkretnego modułu.",results:logi.length,active:filtrLogowDiag!=="wszystkie"||!!szukajLogowDiag,fields:`<div class="admin-filter-grid"><label><span>Szukaj</span><input placeholder="Treść lub źródło…" value="${esc(szukajLogowDiag)}" oninput="szukajLogowDiag=this.value.toLowerCase();clearTimeout(diagSearchT);diagSearchT=setTimeout(renderuj,300)"></label><label><span>Poziom</span><select onchange="filtrLogowDiag=this.value;renderuj()"><option value="wszystkie">Wszystkie</option><option value="blad" ${filtrLogowDiag==="blad"?"selected":""}>Błędy</option><option value="ostrzezenie" ${filtrLogowDiag==="ostrzezenie"?"selected":""}>Ostrzeżenia</option><option value="info" ${filtrLogowDiag==="info"?"selected":""}>Informacje</option></select></label></div>`})}
  ${logi.length?`<div class="system-log-table log-table-wrap"><table class="log-table"><thead><tr><th>Czas</th><th>Poziom</th><th>Zdarzenie</th><th>Źródło</th></tr></thead><tbody>${logi.slice(0,200).map(l=>`<tr><td>${esc(l.czas)}</td><td><span class="lvl lvl-${l.poziom}">${poziom[l.poziom]||esc(l.poziom)}</span></td><td>${esc(l.tresc)}</td><td>${esc(l.zrodlo)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="system-empty order-empty"><span>📭</span><b>Brak zdarzeń</b><p>Zmień filtry lub wróć tu po wykonaniu kontroli.</p></div>`}</section>`;
}
function systemKopieHTML(){
  const pamiec=rozmiarDanychLokalnych();
  return `<section class="system-summary-grid info-grid"><article class="info-card"><small>Dane lokalne</small><b>${(pamiec/1024).toFixed(1)} KB</b><span>w tej przeglądarce</span></article><article class="info-card"><small>Kopie serwera</small><b>Codziennie</b><span>automatyczny harmonogram</span></article><article class="info-card"><small>Zakres kopii JSON</small><b>Panel</b><span>ustawienia i dane podręczne</span></article></section>
  <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Ochrona danych</span><h1>💾 Kopie i przywracanie</h1><p>Kopia przeglądarkowa uzupełnia codzienne kopie serwera. Nie zastępuje wersjonowanych wydań kodu.</p></div></div><div class="system-backup-actions info-grid"><article class="info-card"><span>⬇️</span><div><b>Pobierz kopię panelu</b><small>Zapisuje do pliku JSON ustawienia i dane lokalne tej przeglądarki.</small></div><button class="btn" onclick="eksportujKopieDanych()">Pobierz kopię</button></article><article class="info-card"><span>⬆️</span><div><b>Przywróć kopię panelu</b><small>Plik jest sprawdzany przed zapisem; operacja wymaga osobnego potwierdzenia.</small></div><label class="btn ghost">Wybierz plik<input type="file" accept="application/json" onchange="importujKopieDanych(event)" hidden></label></article><article class="info-card"><span>📊</span><div><b>Raport diagnostyczny</b><small>Pełny wynik kontroli i dziennik przydatny podczas naprawy.</small></div><button class="btn ghost" onclick="pobierzRaportJSON()">Pobierz raport</button></article></div></section>`;
}
function widokAdminSystem(sekcja="status"){
  const aktywna=["status","diagnostyka","logi","kopie"].includes(String(sekcja||""))?String(sekcja||""):"status";
  const tresc=aktywna==="diagnostyka"?systemDiagnostykaHTML():aktywna==="logi"?systemLogiHTML():aktywna==="kopie"?systemKopieHTML():systemStatusHTML();
  return adminSzkielet("/admin/system",`<div class="module-page-stack system-center">${systemSubnavHTML(aktywna)}${tresc}</div>`);
}
function wyczyscLogi(){ localStorage.removeItem("artway_logi"); toast("Dziennik wyczyszczony"); renderuj(); }
async function kopiujRaport(){
  const testy=testyDiagnostyczne(), raport=[
    "RAPORT DIAGNOSTYCZNY Artway-TM — "+new Date().toLocaleString("pl-PL"),
    `Kondycja: ${wynikKondycji(testy)}% | Produkty: ${produkty.length} (${zrodloProduktow}) | Konta: ${pobierzUzytkownikow().length} | Zamówienia: ${pobierzZamowienia().length}`,
    "","TESTY:",...testy.map(x=>`- [${x.status.toUpperCase()}] ${x.grupa} / ${x.nazwa}: ${x.szczegoly}`),
    "","OSTATNIE ZDARZENIA:",...pobierzLogi().slice(0,30).map(l=>`[${l.czas}] ${l.poziom.toUpperCase()}: ${l.tresc}${l.zrodlo?" ("+l.zrodlo+")":""}`)
  ].join("\n");
  try{await navigator.clipboard.writeText(raport);toast("Raport skopiowany 📋");}
  catch(e){pobierzPlik("raport-diagnostyczny.txt",raport,"text/plain");}
}
function pobierzRaportJSON(){
  const testy=testyDiagnostyczne();
  pobierzPlik("artway-diagnostyka-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({
    data:new Date().toISOString(),wynik:wynikKondycji(testy),testy,logi:pobierzLogi(),produkty:produkty.length,zamowienia:pobierzZamowienia().length
  },null,2),"application/json");
}
function pobierzPlikLogu(){
  const tekst=pobierzLogi().map(l=>`[${l.czas}] ${l.poziom.toUpperCase()}: ${l.tresc}${l.zrodlo?" ("+l.zrodlo+")":""}`).join("\n")||"Dziennik pusty.";
  pobierzPlik("artway-log-"+new Date().toISOString().slice(0,10)+".txt",tekst,"text/plain");
}
function eksportujKopieDanych(){
  const dane={wersja:1,data:new Date().toISOString(),localStorage:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith("artway_"))dane.localStorage[k]=localStorage.getItem(k);}
  pobierzPlik("artway-kopia-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(dane,null,2),"application/json");
  loguj("info","Utworzono kopię danych lokalnych");
}
function importujKopieDanych(e){
  const plik=e.target.files?.[0];if(!plik)return;
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.localStorage||typeof d.localStorage!=="object")throw new Error("Niepoprawny format");
    if(!confirm("Przywrócić kopię? Obecne dane lokalne zostaną zastąpione."))return;
    Object.entries(d.localStorage).forEach(([k,v])=>{if(k.startsWith("artway_"))localStorage.setItem(k,String(v));});
    location.reload();
  }catch(bl){toast("⚠️ Nie udało się wczytać kopii: "+bl.message);}};
  r.readAsText(plik);
}
function naprawDaneSklepu(){
  naprawKolizjeIdProduktow();
  zbudujProdukty();
  const widoczne=new Set(produkty.map(p=>p.id)), wszystkie=new Set(produktyDoAdministracji().map(p=>p.id));
  koszyk=koszyk.filter((x,i,a)=>widoczne.has(x.id)&&x.ile>0&&a.findIndex(y=>y.id===x.id)===i);
  ulubione=[...new Set(ulubione.filter(id=>widoczne.has(id)))];
  produktyUkryte=[...new Set(produktyUkryte.filter(id=>produktyBazoweWspolne().some(p=>p.id===id)))];
  const mapa={...(ustawienia.mapaProduktow||{})};Object.keys(mapa).forEach(id=>{if(!wszystkie.has(+id))delete mapa[id];});
  const kat=new Set(wszystkieKategorie());
  const menuKategorii=grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(k=>kat.has(k))})).filter(g=>g.nazwa);
  const uzytkownicy=pobierzUzytkownikow().filter((u,i,a)=>u.email&&a.findIndex(x=>x.email===u.email)===i);
  zapiszLS("artway_koszyk",koszyk);zapiszLS("artway_ulubione",ulubione);zapiszLS("artway_produkty_ukryte",produktyUkryte);
  zapiszLS("artway_uzytkownicy",uzytkownicy);ustawienia={...ustawienia,mapaProduktow:mapa,menuKategorii};zapiszLS("artway_ustawienia",ustawienia);
  zbudujProdukty();odswiezKoszyk();odswiezUlubioneLicznik();loguj("info","Wykonano naprawę spójności danych");toast("Dane zostały sprawdzone i naprawione ✅");renderuj();
}
async function uruchomAutotest(){
  ostatniAutotest=[];const dodaj=(nazwa,status,szczegoly)=>ostatniAutotest.push({grupa:"Autotest techniczny",nazwa,status,szczegoly});
  try{localStorage.setItem("artway_test","1");const ok=localStorage.getItem("artway_test")==="1";localStorage.removeItem("artway_test");dodaj("Zapis i odczyt pamięci",ok?"ok":"bad",ok?"Pamięć działa":"Brak możliwości zapisu");}catch(e){dodaj("Zapis i odczyt pamięci","bad",e.message);}
  try{const h=await hashuj("test");dodaj("Szyfrowanie haseł",h.length===64?"ok":"warn",h.length===64?"SHA-256 dostępne":"Użyto mechanizmu zapasowego");}catch(e){dodaj("Szyfrowanie haseł","bad",e.message);}
  try{const r=await fetch("/products.json",{cache:"no-store"}),j=r.ok?await r.json():null;dodaj("Dostęp do products.json",r.ok&&Array.isArray(j)?"ok":"bad",r.ok?`${j.length} rekordów`:`HTTP ${r.status}`);}catch(e){dodaj("Dostęp do products.json","bad",e.message);}
  try{const widoki=[widokSklep(),widokKontakt(),widokFAQ(),widokDostawa(),widokAdminProdukty()];dodaj("Renderowanie głównych widoków",widoki.every(x=>typeof x==="string"&&x.length>100)?"ok":"bad","Sprawdzono 5 kluczowych ekranów");}catch(e){dodaj("Renderowanie głównych widoków","bad",e.message);}
  loguj("info","Wykonano pełny autotest: "+ostatniAutotest.map(x=>x.status).join(","));
  renderuj();
}

/* ═══════════ GŁÓWNY PULPIT ADMINISTRATORA ═══════════
   Jedno centrum operacyjne dla sklepu, Allegro, wysyłek, magazynu,
   komunikacji, finansów i kondycji integracji. */
let pulpitFiltrAlertow="wszystkie";
let pulpitSzukajAlertow="";
let pulpitSzukajTimer=null;
const ADMIN_PULPIT_SNAPSHOT_KEY="artway_admin_pulpit_snapshot_v1";
const ADMIN_PULPIT_SNAPSHOT_DNI=45;
let adminPulpitSnapshot=(()=>{try{const value=JSON.parse(localStorage.getItem(ADMIN_PULPIT_SNAPSHOT_KEY)||"null");return value&&value.schema===1?value:{schema:1,sklep:{},allegro:{},recentAllegro:[],savedAt:0};}catch(e){return {schema:1,sklep:{},allegro:{},recentAllegro:[],savedAt:0};}})();
let adminPulpitOdswiezaniePromise=null;

function pulpitStatusSklepuAktywny(z={}){return !["anulowane","dostarczone","zakończone","zwrot","zwrot pieniędzy"].includes(String(z.status||"").toLowerCase());}
function pulpitDataMs(z={}){if(typeof dataZamowieniaMs==="function")return dataZamowieniaMs(z);const raw=z.ts??z.createdAt??z.data??"",n=Number(raw);return Number.isFinite(n)&&n>1e9?(n<1e11?n*1000:n):(Date.parse(raw)||0);}
function pulpitKwotaAllegro(z={}){return kwotaNum(z.total?.amount??z.total??z.summary?.totalToPay?.amount??z.payment?.paidAmount?.amount??0);}
function pulpitZamowieniaOkres(lista,dni=7){const od=Date.now()-dni*86400000;return lista.filter(z=>pulpitDataMs(z)>=od);}
function pulpitZmianaProcent(teraz,poprzednio){if(!poprzednio)return teraz?100:0;return Math.round((teraz-poprzednio)/poprzednio*100);}
function pulpitKluczDnia(value){const date=new Date(Number(value)||0);if(!Number.isFinite(date.getTime())||date.getTime()<=0)return "";return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function pulpitAgregujDni(lista=[],kwota=()=>0){const wynik={};for(const item of lista||[]){const key=pulpitKluczDnia(pulpitDataMs(item));if(!key)continue;const row=wynik[key]||{value:0,count:0};row.value=kwotaNum(row.value+kwotaNum(kwota(item)));row.count++;wynik[key]=row;}return wynik;}
function pulpitOgraniczDni(rows={}){const od=Date.now()-ADMIN_PULPIT_SNAPSHOT_DNI*86400000;return Object.fromEntries(Object.entries(rows||{}).filter(([key])=>Date.parse(`${key}T00:00:00`)>=od));}
function pulpitBezpieczneZamowienieAllegro(z={}){return {id:String(z.id||z.nr||""),nr:String(z.nr||""),createdAt:z.createdAt||z.firstFetchedAt||z.ts||"",firstFetchedAt:z.firstFetchedAt||"",status:z.status||"",fulfillmentStatus:z.fulfillmentStatus||z.fulfillment?.status||z.allegroStatus||"",warehouseStage:z.warehouseStage||"",agentStage:z.agentStage||"",localStage:z.localStage||"",magazynStatus:z.magazynStatus||"",localStatus:z.localStatus||"",agentHandled:z.agentHandled===true,localCompleted:z.localCompleted===true,total:pulpitKwotaAllegro(z)};}
function adminPulpitZapiszSnapshot(sklep=[],allegro=[],allegroPelne=false){
  const next={schema:1,sklep:{},allegro:adminPulpitSnapshot.allegro||{},recentAllegro:adminPulpitSnapshot.recentAllegro||[]};
  next.sklep=pulpitOgraniczDni(pulpitAgregujDni((sklep||[]).filter(z=>String(z.status||"").toLowerCase()!=="anulowane"),z=>z.razem));
  const dzienneSerwera=allegroPodsumowanie?.salesDaily&&typeof allegroPodsumowanie.salesDaily==="object"?allegroPodsumowanie.salesDaily:null;
  if(allegroPelne)next.allegro=pulpitOgraniczDni(pulpitAgregujDni((allegro||[]).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))),pulpitKwotaAllegro));
  else if(dzienneSerwera)next.allegro=pulpitOgraniczDni(dzienneSerwera);
  if(allegroPelne||(allegro||[]).length)next.recentAllegro=(allegro||[]).slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,30).map(pulpitBezpieczneZamowienieAllegro);
  const before=JSON.stringify({schema:adminPulpitSnapshot.schema,sklep:adminPulpitSnapshot.sklep,allegro:adminPulpitSnapshot.allegro,recentAllegro:adminPulpitSnapshot.recentAllegro});
  if(before===JSON.stringify(next))return false;
  adminPulpitSnapshot={...next,savedAt:Date.now()};
  try{localStorage.setItem(ADMIN_PULPIT_SNAPSHOT_KEY,JSON.stringify(adminPulpitSnapshot));}catch(e){}
  return true;
}
function pulpitSumaSnapshot(kanal="allegro",dni=7){const od=Date.now()-dni*86400000;return Object.entries(adminPulpitSnapshot?.[kanal]||{}).reduce((sum,[key,row])=>Date.parse(`${key}T23:59:59`)>=od?sum+kwotaNum(row?.value):sum,0);}
function pulpitSnapshotMaDane(kanal="allegro",dni=14){const od=Date.now()-dni*86400000;return Object.keys(adminPulpitSnapshot?.[kanal]||{}).some(key=>Date.parse(`${key}T23:59:59`)>=od);}
function adminPulpitStatusDanych(){
  if(adminPulpitOdswiezaniePromise)return {className:"syncing",label:"Aktualizuję w tle — poprzednie dane pozostają widoczne"};
  const at=Number(adminPulpitSnapshot.savedAt)||Number(allegroDaneOdczytAt?.summary)||0;
  return {className:"",label:at?`Dane zapisane ${new Date(at).toLocaleString("pl-PL",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}`:"Dane wspólne aktywne"};
}
function adminPulpitAktualizujStatusDOM(){const status=adminPulpitStatusDanych(),node=document.querySelector("[data-dashboard-data-status]"),button=document.querySelector("[data-dashboard-refresh]");if(node){node.classList.toggle("syncing",status.className==="syncing");const text=node.querySelector("span");if(text)text.textContent=status.label;}if(button){button.disabled=!!adminPulpitOdswiezaniePromise;button.textContent=adminPulpitOdswiezaniePromise?"↻ Aktualizuję w tle…":"↻ Odśwież dane";}}

function pulpitSystemy(){
  const cloudChecked=!!chmuraStan.sprawdzono,healthChecked=!!stanBramki.sprawdzono,allegroChecked=!!allegroStan.sprawdzono,infaktChecked=!!infaktStan.sprawdzono;
  return [
    {id:"cloud",ico:"☁️",nazwa:"Wspólna baza",status:cloudChecked?(chmuraStan.dostepna?"ok":"blad"):"info",opis:cloudChecked?(chmuraStan.dostepna?`Połączona • rev ${chmuraStan.rev||0}`:chmuraStan.error||"Brak połączenia"):"Oczekuje na pierwszą kontrolę",href:"#/admin/system"},
    {id:"email",ico:"✉️",nazwa:"E-mail automatyczny",status:healthChecked?(stanBramki.email?.configured?"ok":"blad"):"info",opis:healthChecked?(stanBramki.email?.configured?`${stanBramki.email.provider||"SMTP"} gotowy`:"Wymaga konfiguracji serwera"):"Oczekuje na kontrolę",href:"#/admin/system/diagnostyka"},
    {id:"inpost",ico:"🚚",nazwa:"InPost",status:healthChecked?(stanBramki.inpost?.configured?"ok":"blad"):"info",opis:healthChecked?(stanBramki.inpost?.configured?"API etykiet i śledzenia gotowe":"Wymaga konfiguracji API"):"Oczekuje na kontrolę",href:"#/admin/wysylki"},
    {id:"allegro",ico:"🟠",nazwa:"Allegro",status:allegroChecked?(allegroStan.connected&&!allegroStan.requiresReauth?"ok":"blad"):"info",opis:allegroChecked?(allegroStan.connected&&!allegroStan.requiresReauth?"OAuth i synchronizacja aktywne":allegroStan.requiresReauth?"Wymaga ponownej autoryzacji":"Brak połączenia"):"Oczekuje na kontrolę",href:"#/admin/allegro/ustawienia"},
    {id:"infakt",ico:"🧾",nazwa:"inFakt",status:infaktChecked?(infaktStan.connected?"ok":infaktStan.configured?"blad":"info"):"info",opis:infaktChecked?(infaktStan.connected?"API faktur połączone":infaktStan.configured?infaktStan.error||"Błąd połączenia":"Klucz nie został skonfigurowany"):"Oczekuje na kontrolę",href:"#/admin/infakt/ustawienia"}
  ];
}

function adminPulpitDane(){
  const sklep=pobierzZamowienia(),sklepAktywne=sklep.filter(pulpitStatusSklepuAktywny),allegroPelne=!!allegroDaneZaladowane.orders,allegroPodreczne=Array.isArray(allegroPodsumowanie.recentOrders)&&allegroPodsumowanie.recentOrders.length?allegroPodsumowanie.recentOrders:(adminPulpitSnapshot.recentAllegro||[]),allegro=allegroPelne?(Array.isArray(allegroZamowienia)?allegroZamowienia:[]):allegroPodreczne,allegroAktywneRzeczywiste=allegro.filter(allegroZamowienieAktywneLokalnie),allegroAktywne=allegroPelne?allegroAktywneRzeczywiste:Array.from({length:Number(allegroPodsumowanie.orders?.active||0)},()=>({summaryOnly:true})),komunikacja=allegroKomunikacjaStaty(),plan=potrzebyZatowarowania();
  const wysylkiBezNumeru=sklepAktywne.filter(z=>!daneWysylki(z).numer).length,firmoweBezFaktury=sklepAktywne.filter(z=>(z.klient?.nip||z.klient?.firma)&&!infaktStan.links?.[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length;
  const teraz=Date.now(),siedem=7*86400000,sklep7=sklep.filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&pulpitDataMs(z)>=teraz-siedem),sklepPoprzednie7=sklep.filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&pulpitDataMs(z)>=teraz-2*siedem&&pulpitDataMs(z)<teraz-siedem),allegro7=allegro.filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))&&pulpitDataMs(z)>=teraz-siedem);
  adminPulpitZapiszSnapshot(sklep,allegro,allegroPelne);
  const sprzedazSklep7=sklep7.reduce((s,z)=>s+kwotaNum(z.razem),0),sprzedazAllegro7=allegroPelne?allegro7.reduce((s,z)=>s+pulpitKwotaAllegro(z),0):(pulpitSnapshotMaDane("allegro",7)?pulpitSumaSnapshot("allegro",7):allegro7.reduce((s,z)=>s+pulpitKwotaAllegro(z),0)),sprzedazPoprzednie7=sklepPoprzednie7.reduce((s,z)=>s+kwotaNum(z.razem),0);
  const seoKrytyczne=seoKolejkaProduktow().filter(x=>x.score<60).length,agentAktywne=typeof agentAIAnalizaAktywna==="function"?agentAIAnalizaAktywna(agentAIAnaliza()).length:0,systemy=pulpitSystemy(),systemBledy=systemy.filter(x=>x.status==="blad").length;
  return {sklep,sklepAktywne,noweSklep:sklepAktywne.filter(z=>z.status==="nowe").length,allegro,allegroPelne,allegroAktywne,komunikacja,plan,wysylkiBezNumeru,firmoweBezFaktury,sklep7,allegro7,sprzedazSklep7,sprzedazAllegro7,sprzedaz7:sprzedazSklep7+sprzedazAllegro7,sprzedazPoprzednie7,trend:pulpitZmianaProcent(sprzedazSklep7,sprzedazPoprzednie7),seoKrytyczne,agentAktywne,systemy,systemBledy,klienci:pobierzUzytkownikow().filter(u=>!kontoMaRoleAdmin(u.email)).length};
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
  const status=adminPulpitStatusDanych();
  return `<section class="panel dashboard-hero"><div><span class="order-pro-label">${cfg[0]}</span><h1>${cfg[1]}</h1><p>${cfg[2]}</p></div><div class="dashboard-hero-actions"><span class="dashboard-live ${status.className}" data-dashboard-data-status><i></i><span>${esc(status.label)}</span></span><button class="btn ghost" data-dashboard-refresh onclick="adminPulpitOdswiez()" ${adminPulpitOdswiezaniePromise?"disabled":""}>${adminPulpitOdswiezaniePromise?"↻ Aktualizuję w tle…":"↻ Odśwież dane"}</button><button class="btn" onclick="adminPulpitEksportujRaport()">📤 Raport CSV</button></div></section>`;
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

function adminPulpitDni(d={},dni=14){
  const out=[];for(let i=dni-1;i>=0;i--){const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-i);out.push({key:pulpitKluczDnia(date.getTime()),start:date.getTime(),end:date.getTime()+86400000,label:date.toLocaleDateString("pl-PL",{day:"2-digit",month:"2-digit"}),weekday:date.toLocaleDateString("pl-PL",{weekday:"short"}),sklep:0,allegro:0,count:0});}
  (d.sklep||pobierzZamowienia()).filter(z=>String(z.status||"").toLowerCase()!=="anulowane").forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.sklep+=kwotaNum(z.razem);day.count++;}});
  if(d.allegroPelne)(d.allegro||[]).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))).forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.allegro+=pulpitKwotaAllegro(z);day.count++;}});
  else if(pulpitSnapshotMaDane("allegro",dni))out.forEach(day=>{const saved=adminPulpitSnapshot.allegro?.[day.key];if(saved){day.allegro=kwotaNum(saved.value);day.count+=Number(saved.count)||0;}});
  else (d.allegro||[]).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))).forEach(z=>{const t=pulpitDataMs(z),day=out.find(x=>t>=x.start&&t<x.end);if(day){day.allegro+=pulpitKwotaAllegro(z);day.count++;}});
  return out;
}

function adminPulpitWykresHTML(d,dni=14){
  const rows=adminPulpitDni(d,dni),max=Math.max(1,...rows.map(x=>x.sklep+x.allegro)),total=rows.reduce((s,x)=>s+x.sklep+x.allegro,0),pamiec=!d.allegroPelne&&pulpitSnapshotMaDane("allegro",dni);
  return `<section class="panel dashboard-chart-panel"><div class="order-section-head"><div><span class="order-pro-label">Dwa kanały sprzedaży</span><h2>Sprzedaż — ostatnie ${dni} dni</h2><p class="order-detail-lead">Sklep i Allegro są pokazane oddzielnie; wartości anulowane i zwrócone nie podbijają wykresu.${pamiec?" Ostatni poprawny wynik pozostaje widoczny podczas cichej aktualizacji.":""}</p></div><div class="dashboard-chart-total"><b>${zl(total)}</b><small>${pamiec?"z pamięci • aktualizacja w tle":"łącznie w okresie"}</small></div></div><div class="dashboard-chart-legend"><span><i class="store"></i> Sklep</span><span><i class="allegro"></i> Allegro</span></div><div class="dashboard-chart" style="--days:${rows.length}">${rows.map(x=>{const sh=Math.max(x.sklep?3:0,Math.round(x.sklep/max*100)),ah=Math.max(x.allegro?3:0,Math.round(x.allegro/max*100));return `<div class="dashboard-chart-day" title="${x.label}: sklep ${zl(x.sklep)}, Allegro ${zl(x.allegro)}"><div class="dashboard-bars"><i class="store" style="height:${sh}%"></i><i class="allegro" style="height:${ah}%"></i></div><b>${x.weekday}</b><small>${x.label}</small></div>`;}).join("")}</div></section>`;
}

function adminPulpitAlertCardHTML(a){return `<article class="dashboard-alert ${a.level}"><span>${a.ico}</span><div><small>${a.level==="krytyczny"?"Pilne":a.level==="ostrzezenie"?"Wymaga uwagi":"Kontrola jakości"}</small><h3>${esc(a.title)}</h3><p>${esc(a.description)}</p></div><b>${esc(a.count)}</b><a class="btn ${a.level==="krytyczny"?"":"ghost"}" href="${a.href}">Przejdź →</a></article>`;}
function adminPulpitAlertyPasujace(d){const q=normalizujSzukanyTekst(pulpitSzukajAlertow);return adminPulpitAlerty(d).filter(a=>(pulpitFiltrAlertow==="wszystkie"||a.level===pulpitFiltrAlertow||a.group===pulpitFiltrAlertow)&&(!q||normalizujSzukanyTekst(`${a.title} ${a.description} ${a.group}`).includes(q)));}
function adminPulpitSzukajAlerty(input){pulpitSzukajAlertow=String(input?.value||"");clearTimeout(pulpitSzukajTimer);pulpitSzukajTimer=setTimeout(()=>renderuj(),220);}

function adminPulpitOstatnieHTML(d,limit=8){
  const sklep=d.sklep.slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,limit),allegro=d.allegro.slice().sort((a,b)=>pulpitDataMs(b)-pulpitDataMs(a)).slice(0,limit);
  return `<section class="dashboard-columns"><div class="panel"><div class="order-section-head"><div><h2>📦 Ostatnie zamówienia sklepu</h2><p class="order-detail-lead">Najnowsze transakcje i bieżący status realizacji.</p></div><a class="btn ghost" href="#/admin/zamowienia">Pełna lista</a></div><div class="table-scroll"><table class="mini-tab"><tr><th>Numer</th><th>Data</th><th>Status</th><th>Wartość</th></tr>${sklep.map(z=>`<tr><td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a></td><td>${esc(z.data||(pulpitDataMs(z)?new Date(pulpitDataMs(z)).toLocaleString("pl-PL"):"—"))}</td><td><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||"var(--bg)"}">${esc(z.status||"—")}</span></td><td><b>${zl(z.razem)}</b></td></tr>`).join("")||`<tr><td colspan="4">Brak zamówień.</td></tr>`}</table></div></div><div class="panel"><div class="order-section-head"><div><h2>🟠 Ostatnie zlecenia Allegro</h2><p class="order-detail-lead">Oficjalny status Allegro oraz lokalny etap obsługi.</p></div><a class="btn ghost" href="#/admin/allegro/zamowienia">Pełna lista</a></div><div class="table-scroll"><table class="mini-tab"><tr><th>Zlecenie</th><th>Data</th><th>Allegro</th><th>Magazyn</th></tr>${allegro.map(z=>`<tr><td><b>${esc(z.id||z.nr||"—")}</b></td><td>${esc(allegroDataTxt(z.createdAt||z.firstFetchedAt))}</td><td><span class="lvl ${allegroStatusKolejkiMeta(z).klasa}">${esc(allegroStatusKolejkiMeta(z).label)}</span></td><td><span class="lvl ${allegroEtapMagazynuMeta(z).klasa}">${esc(allegroEtapMagazynuMeta(z).label)}</span></td></tr>`).join("")||`<tr><td colspan="4">Brak zleceń Allegro.</td></tr>`}</table></div></div></section>`;
}

function adminPulpitSystemHTML(d){return `<div class="dashboard-system-grid">${d.systemy.map(s=>`<a href="${s.href}" class="dashboard-system-card ${s.status}"><span>${s.ico}</span><div><b>${esc(s.nazwa)}</b><small>${esc(s.opis)}</small></div><em>${s.status==="ok"?"działa":s.status==="blad"?"uwaga":"kontrola"}</em></a>`).join("")}</div>`;}

function adminPulpitPrzegladHTML(d){const alerty=adminPulpitAlerty(d),pilne=alerty.slice(0,6);return `${adminPulpitKpiHTML(d)}<section class="dashboard-main-grid"><div class="panel dashboard-priority"><div class="order-section-head"><div><span class="order-pro-label">Kolejka priorytetowa</span><h2>Co wymaga działania</h2><p class="order-detail-lead">Najpierw klient i sprzedaż, potem wysyłka, magazyn, dokumenty i jakość katalogu.</p></div><a class="btn ghost" href="#/admin/pulpit/alerty">Wszystkie alerty</a></div><div class="dashboard-alert-list">${pilne.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Brak pilnych zadań</b><small>Wszystkie aktywne kolejki są obecnie puste.</small></div></div>`}</div></div><div class="panel dashboard-quick"><div class="order-section-head"><div><span class="order-pro-label">Szybkie działania</span><h2>Najczęstsze operacje</h2></div></div><div class="dashboard-quick-grid">${[["➕","Dodaj produkt","Ręcznie lub z linku","#/admin/produkty/dodaj"],["🚚","Nadaj przesyłkę","Etykieta i tracking InPost","#/admin/wysylki"],["🟠","Sprawdź Allegro","Zamówienia i komunikacja","#/admin/allegro"],["🧾","Wystaw fakturę","Zamówienia firmowe","#/admin/infakt/zamowienia"],["🤖","Polecenie dla Agenta","Kontekst całego sklepu","#/admin/agent-ai/komendy"],["🎨","Zmień wygląd","Strona i podstrony","#/admin/personalizacja"]].map(([i,t,o,h])=>`<a href="${h}"><span>${i}</span><b>${t}</b><small>${o}</small></a>`).join("")}</div></div></section>${adminPulpitWykresHTML(d,7)}<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kondycja techniczna</span><h2>Integracje i automatyzacje</h2></div><a class="btn ghost" href="#/admin/pulpit/system">Pełny stan systemu</a></div>${adminPulpitSystemHTML(d)}</section>${adminPulpitOstatnieHTML(d,5)}`;}

function adminPulpitOperacjeHTML(d){
  const alerty=adminPulpitAlerty(d).filter(a=>a.group!=="system"),grupy=[{id:"sprzedaz",title:"Sprzedaż i klient",items:alerty.filter(x=>["operacje","komunikacja"].includes(x.group))},{id:"realizacja",title:"Realizacja i magazyn",items:alerty.filter(x=>["magazyn"].includes(x.group)||x.title.includes("Przesyłki"))},{id:"zaplecze",title:"Dokumenty, Agent i katalog",items:alerty.filter(x=>["finanse","agent","katalog"].includes(x.group))}];
  return `<section class="dashboard-operations-head">${[["📥",d.noweSklep,"nowych w sklepie"],["🟠",d.allegroAktywne.length,"Allegro do obsługi"],["🚚",d.wysylkiBezNumeru,"bez nadania"],["📦",d.plan.length,"braków do zleceń"]].map(([i,n,l])=>`<div><span>${i}</span><b>${n}</b><small>${l}</small></div>`).join("")}</section><div class="dashboard-operation-groups">${grupy.map(g=>`<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Etap operacyjny</span><h2>${g.title}</h2></div><span class="lvl ${g.items.length?"lvl-ostrzezenie":"lvl-ok"}">${g.items.length?`${g.items.reduce((s,x)=>s+x.count,0)} zadań`:`gotowe`}</span></div><div class="dashboard-alert-list">${g.items.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Etap bez zaległości</b><small>Nie ma obecnie aktywnych spraw w tej części procesu.</small></div></div>`}</div></section>`).join("")}</div>${adminPulpitOstatnieHTML(d,6)}`;
}

function adminPulpitSprzedazHTML(d){
  const statuses=STATUSY.map(s=>({status:s,count:d.sklep.filter(z=>z.status===s).length,value:d.sklep.filter(z=>z.status===s).reduce((n,z)=>n+kwotaNum(z.razem),0)})).filter(x=>x.count),allegro30=pulpitZamowieniaOkres(d.allegro,30).filter(z=>!["CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))),sklep30=pulpitZamowieniaOkres(d.sklep,30).filter(z=>z.status!=="anulowane");
  const allegro30Wartosc=d.allegroPelne?allegro30.reduce((s,z)=>s+pulpitKwotaAllegro(z),0):(pulpitSnapshotMaDane("allegro",30)?pulpitSumaSnapshot("allegro",30):allegro30.reduce((s,z)=>s+pulpitKwotaAllegro(z),0));
  return `${adminPulpitKpiHTML(d)}${adminPulpitWykresHTML(d,14)}<section class="dashboard-columns"><div class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kanały</span><h2>Porównanie 30 dni</h2></div></div><div class="dashboard-channel-grid"><a href="#/admin/zamowienia"><span>🏪</span><b>${sklep30.length}</b><strong>Sklep</strong><small>${zl(sklep30.reduce((s,z)=>s+kwotaNum(z.razem),0))}</small></a><a href="#/admin/allegro/zamowienia"><span>🟠</span><b>${d.allegroPelne?allegro30.length:Number(allegroPodsumowanie.orders?.live||allegro30.length)}</b><strong>Allegro</strong><small>${zl(allegro30Wartosc)}</small></a></div></div><div class="panel"><div class="order-section-head"><div><span class="order-pro-label">Realizacja sklepu</span><h2>Statusy zamówień</h2></div></div><div class="dashboard-status-list">${statuses.map(x=>`<a href="#/admin/zamowienia" onclick="filtrZamowien=${jsArg(x.status)}"><span style="background:${KOLOR_STATUSU[x.status]||"var(--bg)"}"></span><b>${esc(x.status)}</b><strong>${x.count}</strong><small>${zl(x.value)}</small></a>`).join("")||`<div class="dashboard-all-clear">Brak danych sprzedażowych.</div>`}</div></div></section>${adminPulpitOstatnieHTML(d,10)}`;
}

function adminPulpitAlertyHTML(d){
  const all=adminPulpitAlerty(d),items=adminPulpitAlertyPasujace(d),critical=all.filter(x=>x.level==="krytyczny").length,warnings=all.filter(x=>x.level==="ostrzezenie").length,systems=all.filter(x=>x.group==="system").length;
  return `<section class="panel dashboard-alert-workspace"><div class="order-section-head"><div><span class="order-pro-label">Aktywna kolejka wyjątków</span><h2>Alerty wymagające decyzji</h2><p class="order-detail-lead">Lista nie zawiera zamkniętych zamówień ani produktów z zerowym stanem, jeżeli niczego nie brakuje do aktywnej realizacji.</p></div><button class="btn ghost" onclick="adminPulpitEksportujRaport('alerty')">📤 Eksport alertów</button></div><div class="dashboard-alert-filters"><input placeholder="Szukaj alertu, modułu lub opisu…" value="${esc(pulpitSzukajAlertow)}" oninput="adminPulpitSzukajAlerty(this)">${[["wszystkie",`Wszystkie ${all.length}`],["krytyczny",`Pilne ${critical}`],["ostrzezenie",`Ostrzeżenia ${warnings}`],["system",`System ${systems}`],["katalog","Katalog"]].map(([v,l])=>`<button class="${pulpitFiltrAlertow===v?"active":""}" onclick="pulpitFiltrAlertow=${jsArg(v)};renderuj()">${l}</button>`).join("")}</div><div class="dashboard-alert-list expanded">${items.map(adminPulpitAlertCardHTML).join("")||`<div class="dashboard-all-clear"><span>✅</span><div><b>Brak alertów dla wybranego filtra</b><small>Nie ma obecnie spraw wymagających działania.</small></div></div>`}</div></section>`;
}

function adminPulpitStanSystemuHTML(d){
  return `<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Kontrola połączeń</span><h2>Integracje produkcyjne</h2><p class="order-detail-lead">Każda karta prowadzi bezpośrednio do ustawień albo modułu naprawczego.</p></div><button class="btn" onclick="adminPulpitOdswiez(true)">🩺 Uruchom kontrolę</button></div>${adminPulpitSystemHTML(d)}</section><section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Harmonogram automatyczny</span><h2>Zdarzenia i ograniczona kolejka zadań</h2></div><a class="btn ghost" href="#/admin/allegro/ustawienia">Ustawienia Allegro</a></div><div class="dashboard-schedule">${[["☁️","Wspólna baza","co 60 sekund na aktywnym urządzeniu","ustawienia, produkty i zamówienia"],["📦","Zamówienia Allegro","detektor co 15 minut","tylko nowe lub zmienione zlecenia"],["💬","Wiadomości i dyskusje","detektor co 15 minut","tylko nowe kontakty i przypomnienia"],["🏷️","Lista ofert Allegro","najwyżej raz na godzinę","lekka kontrola wykonywana z kolejki"],["🧩","Pełny katalog Allegro","najwyżej raz na dobę","ograniczona porcja szczegółów, opisów i kategorii"],["🤖","Ciężkie zadania Agenta","maks. 2 na przebieg","pozostałe zadania czekają bez blokowania panelu"],["🏭","Dostępność producentów","partie priorytetowe","najpierw bestsellery i aktywne zamówienia"],["📣","SEO produktów","limit dzienny","bezpłatna kontrola małych partii"]].map(([i,t,c,o])=>`<article><span>${i}</span><div><b>${t}</b><small>${o}</small></div><em>${c}</em></article>`).join("")}</div></section><section class="panel dashboard-system-actions"><div><span>🛠️</span><b>Centrum systemu</b><small>Wersja, aktualizacja przeglądarki, diagnostyka, logi i kopie.</small><a class="btn" href="#/admin/system">Otwórz centrum</a></div><div><span>🩺</span><b>Diagnostyka</b><small>Sprawdź błędy JavaScript, serwer, SMTP, InPost i bazę.</small><a class="btn ghost" href="#/admin/system/diagnostyka">Uruchom kontrolę</a></div><div><span>🤖</span><b>Agent AI</b><small>Przegląd aktywnych zadań i planu operacyjnego.</small><a class="btn ghost" href="#/admin/agent-ai">Otwórz Agenta</a></div></section>`;
}

async function adminPulpitOdswiez(pelnaKontrola=false,cicho=false,tylkoSprzedaz=false){
  if(adminPulpitOdswiezaniePromise)return adminPulpitOdswiezaniePromise;
  adminPulpitOdswiezaniePromise=(async()=>{
    adminPulpitAktualizujStatusDOM();
    const zadania=[allegroWczytajDane(true,false,tylkoSprzedaz?"summary":"orders")];
    if(!tylkoSprzedaz)zadania.push(chmuraWczytajStan(),pelnaKontrola?sprawdzBramke(true):Promise.resolve(true));
    const wyniki=await Promise.allSettled(zadania);
    if(!tylkoSprzedaz&&chmuraOstatniPullZmienilDane){zastosujUstawienia();zbudujProdukty();}
    adminPulpitZapiszSnapshot(pobierzZamowienia(),Array.isArray(allegroZamowienia)?allegroZamowienia:[],!!allegroDaneZaladowane.orders);
    odswiezMenu();
    return wyniki.some(result=>result.status==="fulfilled"&&result.value!==false);
  })();
  try{const ok=await adminPulpitOdswiezaniePromise;if(trasa()==="/admin"||trasa().startsWith("/admin/pulpit"))renderuj();if(!cicho)toast(ok?"Pulpit odświeżony ✅":"⚠️ Nie udało się odświeżyć wszystkich danych");return ok;}
  finally{adminPulpitOdswiezaniePromise=null;adminPulpitAktualizujStatusDOM();}
}
function adminPulpitZaplanujOdswiezenieWTle(){
  if(adminPulpitOdswiezaniePromise)return;
  const ostatni=Number(allegroDaneOdczytAt?.summary)||0;if(allegroDaneZaladowane.summary&&Date.now()-ostatni<ALLEGRO_DANE_TTL_MS)return;
  setTimeout(()=>{if((trasa()==="/admin"||trasa().startsWith("/admin/pulpit"))&&!adminPulpitOdswiezaniePromise)void adminPulpitOdswiez(false,true,true);},0);
}
function adminPulpitEksportujRaport(zakres="calosc"){
  const d=adminPulpitDane(),alerty=adminPulpitAlerty(d),rows=alerty.map(a=>[new Date().toISOString(),a.level,a.group,a.title,a.count,a.description,a.href]);
  if(zakres!=="alerty")rows.push([new Date().toISOString(),"podsumowanie","sprzedaz","Sprzedaż 7 dni",d.sprzedaz7,`Sklep ${zl(d.sprzedazSklep7)} | Allegro ${zl(d.sprzedazAllegro7)}`,"#/admin/pulpit/sprzedaz"]);
  adminEksportujCSV(zakres==="alerty"?"pulpit-alerty.csv":"pulpit-operacyjny.csv",["czas","poziom","obszar","pozycja","liczba","opis","trasa"],rows);
}

function widokAdmin(sekcja="pulpit"){
  setTimeout(()=>adminPulpitZaplanujOdswiezenieWTle(),0);
  if(!stanBramki.sprawdzono)setTimeout(()=>sprawdzBramke(true),0);
  const aktywna=["pulpit","operacje","sprzedaz","alerty","system"].includes(String(sekcja||""))?String(sekcja):"pulpit",d=adminPulpitDane();
  const body=aktywna==="operacje"?adminPulpitOperacjeHTML(d):aktywna==="sprzedaz"?adminPulpitSprzedazHTML(d):aktywna==="alerty"?adminPulpitAlertyHTML(d):aktywna==="system"?adminPulpitStanSystemuHTML(d):adminPulpitPrzegladHTML(d);
  return adminSzkielet("/admin",`${adminPulpitSubnavHTML(aktywna,d)}${adminPulpitHeroHTML(aktywna,d)}<div class="dashboard-workspace">${body}</div>${domyslneHasloAdmina?`<div class="panel dashboard-security-warning"><span>🔑</span><div><b>Administrator używa domyślnego hasła</b><small>Zmień je przed dalszą publikacją strony.</small></div><a class="btn" href="#/konto">Zmień hasło</a></div>`:""}`);
}
