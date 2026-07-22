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
  dodaj("Integracje","Uniwersalna bramka",stanBramki.online?"ok":poprawnyEndpoint?"warn":"bad",stanBramki.online?`Netlify Functions dostępne • tryb wysyłek ${uwDiag.tryb}`:`Endpoint awaryjny ${uwDiag.apiEndpoint} • sprawdź Netlify Functions`);
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
