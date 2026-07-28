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
let filtrStatusuCentralnegoDiag="otwarte",systemCentralDiagPollT=0,systemCentralDiagPollProby=0;
let systemDiagTylkoProblemy=true;
let systemWersjaStan={sprawdzono:false,ladowanie:false,wdrazanie:false,release:null,backendOnline:false,error:""};
let systemDiagStan={ladowanie:false,sprawdzono:false,sprawdzonoAt:"",error:"",zwolniono:0};
let systemCentralDiag={loaded:false,loading:false,items:[],summary:{total:0,open:0,errors:0,warnings:0,occurrences:0},agent:{configured:false},updatedAt:"",fetchedAt:"",error:""};
function systemDokumentTymczasowyHTML(html=""){
  const template=document.createElement("template");
  template.innerHTML=String(html||"").trim();
  return template.content;
}
async function systemPobierzCentralneBledy(force=false){
  if(systemCentralDiag.loading||(!force&&systemCentralDiag.loaded&&Date.now()-Date.parse(systemCentralDiag.fetchedAt||0)<60000))return systemCentralDiag;
  if(!maUprawnieniaZapisuChmury())return systemCentralDiag;
  systemCentralDiag={...systemCentralDiag,loading:true,error:""};
  try{
    const data=await chmura("diagnostics-central",{params:{status:"all",limit:500},timeout:15000});
    systemCentralDiag={loaded:true,loading:false,items:Array.isArray(data.items)?data.items:[],summary:data.summary||{total:0,open:0,errors:0,warnings:0,occurrences:0},agent:data.agent||{configured:false},updatedAt:data.updatedAt||"",fetchedAt:new Date().toISOString(),error:""};
  }catch(error){systemCentralDiag={...systemCentralDiag,loaded:true,loading:false,fetchedAt:new Date().toISOString(),error:error.message||String(error)};}
  return systemCentralDiag;
}
function systemOdswiezCentralnyWidok(){
  if(trasa()!=="/admin/system/logi")return;
  const current=document.querySelector("[data-system-central-workspace]");
  const next=systemDokumentTymczasowyHTML(systemCentralnyRejestrHTML()).querySelector("[data-system-central-workspace]");
  if(!current||!next)return;
  aktualizujWezelStabilnie(current,next,document.activeElement);
}
async function systemOdswiezCentralneBledy(force=true){
  const pobieranie=systemPobierzCentralneBledy(force);
  systemOdswiezCentralnyWidok();
  await pobieranie;
  systemOdswiezCentralnyWidok();
  return systemCentralDiag;
}
function systemUstawFiltrCentralny(status){
  filtrStatusuCentralnegoDiag=["otwarte","zakonczone","wszystkie"].includes(status)?status:"otwarte";
  systemOdswiezCentralnyWidok();
}
function systemZaplanowKontroleAnalizy(){
  clearTimeout(systemCentralDiagPollT);
  if(systemCentralDiagPollProby>=12)return;
  systemCentralDiagPollT=setTimeout(async()=>{
    if(trasa()!=="/admin/system/logi")return;
    systemCentralDiagPollProby+=1;
    await systemOdswiezCentralneBledy(true);
    if((systemCentralDiag.items||[]).some(item=>["queued","running"].includes(item.analysis?.status)))systemZaplanowKontroleAnalizy();
    else systemCentralDiagPollProby=0;
  },5000);
}
async function systemAnalizujBledy(ids=[]){
  const wybrane=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean))];
  if(!wybrane.length)return toast("Brak otwartych błędów do analizy");
  try{
    const data=await chmura("diagnostics-central-analyze",{method:"POST",body:{ids:wybrane},timeout:15000});
    toast(`Agent rozpoczął analizę ${data.queued||wybrane.length} problemów`);
    await systemOdswiezCentralneBledy(true);
    systemCentralDiagPollProby=0;
    systemZaplanowKontroleAnalizy();
  }catch(error){toast("Nie udało się uruchomić analizy: "+error.message);}
}
async function systemUstawStatusBledu(id,status){
  try{
    await chmura("diagnostics-central-update",{method:"POST",body:{ids:[id],status,resolution:status==="resolved"?"Sprawdzone i rozwiązane przez administratora":status==="ignored"?"Świadomie pominięte przez administratora":""},timeout:15000});
    await systemOdswiezCentralneBledy(true);
    toast(status==="resolved"?"Problem oznaczony jako rozwiązany ✅":status==="ignored"?"Wpis pominięty":"Problem ponownie otwarty");
  }catch(error){toast("Nie udało się zmienić statusu: "+error.message);}
}
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
function systemPamiecSzczegoly(){
  let razem=0,serwerowe=0,przestarzale=0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)||"",raw=localStorage.getItem(key)||"",bytes=chmuraRozmiarBajtow(key)+chmuraRozmiarBajtow(raw);
      razem+=bytes;
      if(typeof CHMURA_LS_OMIJANE_KLUCZE!=="undefined"&&CHMURA_LS_OMIJANE_KLUCZE.has(key))serwerowe+=bytes;
      if(typeof KLUCZE_PRZESTARZALYCH_CACHE!=="undefined"&&KLUCZE_PRZESTARZALYCH_CACHE.includes(key))przestarzale+=bytes;
    }
  }catch(e){}
  return {razem,serwerowe,przestarzale,operacyjne:Math.max(0,razem-serwerowe-przestarzale)};
}
async function systemOdswiezDiagnostyke(cicho=false){
  if(systemDiagStan.ladowanie)return false;
  systemDiagStan={...systemDiagStan,ladowanie:true,error:""};
  if(!cicho&&trasa().startsWith("/admin/system/diagnostyka"))renderuj();
  try{
    await diagnostykaWyslijKolejke();
    await Promise.allSettled([sprawdzBramke(true),systemSprawdzWersje(true)]);
    if(maUprawnieniaZapisuChmury()){
      await sprawdzPolaczeniaSerwerowe(true);
      await chmuraZapiszUstawienia({flush:true}).catch(()=>false);
    }
    const przed=rozmiarDanychLokalnych();
    const stare=zwolnijPamiecPodreczna({wymus:true});
    const serwerowe=chmuraCzyscSerweroweKopieLS();
    const po=rozmiarDanychLokalnych();
    await diagnostykaWyslijKolejke();
    systemDiagStan={ladowanie:false,sprawdzono:true,sprawdzonoAt:new Date().toISOString(),error:"",zwolniono:Math.max(0,przed-po)};
    const bezpieczneProblemy=testyDiagnostyczne().filter(item=>["Spójność koszyka","Spójność ulubionych","Spójność mapowania"].includes(item.nazwa)&&["bad","warn"].includes(item.status));
    if(bezpieczneProblemy.length)await naprawDaneSklepu({cicho:true,renderujPo:false});
    await diagnostykaSynchronizujProblemy(testyDiagnostyczne());
    if((stare.usunieto.length||serwerowe.length)&&!cicho)toast(`Odciążono pamięć przeglądarki o ${Math.round((przed-po)/1024)} KB ✅`);
    return true;
  }catch(error){
    systemDiagStan={...systemDiagStan,ladowanie:false,sprawdzono:true,sprawdzonoAt:new Date().toISOString(),error:error.message};
    if(!cicho)toast("Diagnostyka: "+error.message);
    return false;
  }finally{
    if(trasa().startsWith("/admin/system/diagnostyka"))renderuj();
  }
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
  const pamiec=rozmiarDanychLokalnych(),pamiecStan=systemPamiecSzczegoly(),publikacjaKatalogu=stanPublikacjiKatalogu();
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
  const integracjeSprawdzone=stanBramki.sprawdzono&&!systemDiagStan.ladowanie;
  dodaj("Integracje","Backend i uniwersalne API",!integracjeSprawdzone?"pending":stanBramki.online?"ok":poprawnyEndpoint?"warn":"bad",!integracjeSprawdzone?"Trwa automatyczna kontrola backendu VPS":stanBramki.online?`Backend VPS dostępny • ${uwDiag.apiEndpoint} • tryb ${uwDiag.tryb}`:`Backend VPS nie odpowiedział • ${uwDiag.apiEndpoint}`);
  dodaj("Integracje","Centralna baza zamówień",!integracjeSprawdzone?"pending":stanBazyCentralnej.online?"ok":stanBazyCentralnej.sprawdzono?"bad":"warn",!integracjeSprawdzone?"Trwa kontrola PostgreSQL":stanBazyCentralnej.online
    ?`${stanBazyCentralnej.orders} zamówień • ${stanBazyCentralnej.users} klientów • wspólne dla wszystkich urządzeń`
    :stanBazyCentralnej.error||"Połącz backend, aby sprawdzić i zsynchronizować wspólną bazę");
  const ipDiag=stanBramki.inpost||{};
  const avDiag=ipDiag.serviceAvailability||{};
  dodaj("Integracje","InPost ShipX API",!integracjeSprawdzone?"pending":ipDiag.configured&&ipDiag.authenticated?((avDiag.locker===false||avDiag.courier===false)?"warn":"ok"):"warn",!integracjeSprawdzone?"Trwa kontrola tokenu, organizacji i usług":ipDiag.configured
    ?`Token i Organization ID są ustawione${ipDiag.geowidgetConfigured?" • Geowidget aktywny":" • brakuje tylko Geowidget"}${ipDiag.webhookConfigured?" • webhook aktywny":" • webhook do konfiguracji"}${avDiag.locker===false?" • brak usługi paczkomatowej":""}${avDiag.courier===false?" • kurier InPost nieaktywny":""}`
    :`Brakuje: ${((ipDiag.missingEnv&&ipDiag.missingEnv.length?ipDiag.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", "))}`);
  const emailDiag=!!stanBramki.email?.authenticated;
  dodaj("Integracje","Automatyczne e-maile",!integracjeSprawdzone?"pending":emailDiag?"ok":"warn",!integracjeSprawdzone?"Trwa kontrola trwałego połączenia SMTP":emailDiag
    ?`${stanBramki.email.provider||"SMTP"} — autoryzacja serwerowa potwierdzona, połączenie trwałe`
    :stanBramki.email?.lastError||"Poczta wymaga kontroli trwałego połączenia serwerowego");
  const centralDiag=systemCentralDiag.summary||{},centralDiagChecked=systemCentralDiag.loaded&&!systemCentralDiag.loading;
  dodaj("Diagnostyka","Centralny rejestr błędów",!centralDiagChecked?"pending":systemCentralDiag.error?"bad":centralDiag.errors?"bad":centralDiag.warnings?"warn":"ok",!centralDiagChecked?"Pobieram wspólny rejestr z VPS":systemCentralDiag.error||`${centralDiag.open||0} otwartych grup • ${centralDiag.errors||0} błędów • ${centralDiag.warnings||0} ostrzeżeń • Agent widzi tę samą kolejkę`);
  dodaj("Konfiguracja","Telefon sklepu",KONFIG.telefon.includes("000 000 000")?"warn":"ok",KONFIG.telefon);
  dodaj("Konfiguracja","Dane prawne",danePrawneFirmyKompletne()?"ok":"bad",danePrawneFirmyKompletne()?"Brak pól przykładowych":"Uzupełnij dane firmy w treściach prawnych");
  dodaj("Bezpieczeństwo","Hasło administratora",domyslneHasloAdmina?"bad":"ok",domyslneHasloAdmina?"Nadal ustawione jest hasło admin":"Hasło zostało zmienione");
  dodaj("Bezpieczeństwo","Role kont administracyjnych",administratorzyDiag.length?"ok":"bad",`${administratorzyDiag.length} kont z rolą administratora • ${kontaDiag.length-administratorzyDiag.length} kont klientów`);
  dodaj("Publikacja","Źródło produktów",zrodloProduktow==="json"?"ok":"warn",zrodloProduktow==="json"?"products.json dostępny":"Używana jest lista zapasowa");
  const centralnyKatalog=stanBramki.store?.storage?.migrated===true&&String(stanBramki.store?.storage?.engine||"").startsWith("postgres-");
  dodaj("Publikacja","Centralny katalog produktów",!integracjeSprawdzone?"pending":centralnyKatalog?"ok":publikacjaKatalogu.gotowy?"ok":"warn",!integracjeSprawdzone?"Trwa kontrola źródła katalogu":centralnyKatalog?`PostgreSQL jest źródłem prawdy • ${stanBramki.store.storage.records||publikacjaKatalogu.razem} rekordów domenowych • products.json pełni wyłącznie rolę startowej kopii awaryjnej`:publikacjaKatalogu.gotowy?`Awaryjny products.json zabezpiecza ${publikacjaKatalogu.razem} kart`:`Brakujące ${publikacjaKatalogu.brakujace.length} • zmienione ${publikacjaKatalogu.nieaktualne.length}`);
  dodaj("Publikacja","Atomowe wydanie strony",!systemWersjaStan.sprawdzono||systemWersjaStan.ladowanie?"pending":systemWersjaStan.release&&systemWersjaStan.backendOnline?"ok":"bad",!systemWersjaStan.sprawdzono||systemWersjaStan.ladowanie?"Trwa automatyczna kontrola wydania":systemWersjaStan.release&&systemWersjaStan.backendOnline?`Aktywne wydanie ${systemWersjaStan.release.releaseId}`:systemWersjaStan.error||"Nie udało się potwierdzić aktywnego wydania");
  const pamiecStatus=pamiecStan.przestarzale>0||pamiecStan.serwerowe>CHMURA_LS_OMIJANE_PRAG_BYTES?"warn":pamiec>7_500_000?"bad":pamiec>5_000_000?"warn":"ok";
  dodaj("Pamięć","Pamięć operacyjna przeglądarki",pamiecStatus,`${(pamiec/1024).toFixed(1)} KB łącznie • ${(pamiecStan.operacyjne/1024).toFixed(1)} KB operacyjnych • ${(pamiecStan.serwerowe/1024).toFixed(1)} KB kopii danych serwerowych${systemDiagStan.zwolniono?` • ostatnio zwolniono ${(systemDiagStan.zwolniono/1024).toFixed(1)} KB`:""}`);
  const zleBannery=pobierzBannery().filter(b=>!b.tytul||bezpiecznyLink(b.link)==="#/"&&b.link!=="#/");
  dodaj("Wygląd","Konfiguracja banerów",zleBannery.length?"warn":"ok",zleBannery.length?`${zleBannery.length} banerów wymaga sprawdzenia`:`${pobierzBannery().length} poprawnych banerów`);
  return [...t,...ostatniAutotest];
}
function diagnostykaProblemyDoAgenta(testy=testyDiagnostyczne()){
  return testy
    .filter(item=>["bad","warn"].includes(item.status)&&item.nazwa!=="Centralny rejestr błędów")
    .map(item=>({
      level:item.status==="bad"?"blad":"ostrzezenie",
      message:`${item.nazwa}: ${item.szczegoly}`,
      source:`autotest:${item.grupa}`,
      route:`${location.pathname}${location.hash||""}`,
      release:diagnostykaWersja(),
      kind:"autotest",
      at:new Date().toISOString()
    }));
}
async function diagnostykaSynchronizujProblemy(testy=testyDiagnostyczne()){
  if(!maUprawnieniaZapisuChmury())return false;
  const checks=diagnostykaProblemyDoAgenta(testy);
  const checkedAt=new Date().toISOString(),release=diagnostykaWersja();
  const passedChecks=testy
    .filter(item=>item.status==="ok"&&item.nazwa!=="Centralny rejestr błędów")
    .map(item=>({name:item.nazwa,group:item.grupa,details:item.szczegoly,release,checkedAt}));
  try{
    await chmura("diagnostics-checks-sync",{method:"POST",body:{checks,passedChecks},timeout:20000});
    await systemPobierzCentralneBledy(true);
    return true;
  }catch(error){
    loguj("ostrzezenie","Nie udało się zsynchronizować wyników autotestu z Agentem: "+error.message,"pełny autotest");
    return false;
  }
}
function diagnostykaStanAgentaDlaKontroli(item={}){
  const source=`autotest:${item.grupa}`,message=`${item.nazwa}: ${item.szczegoly}`;
  const problem=(systemCentralDiag.items||[]).find(entry=>entry.source===source&&entry.message===message&&["open","investigating"].includes(entry.status));
  if(!problem)return"";
  const status=problem.analysis?.status||"idle";
  if(status==="completed")return`<span class="diagnostic-agent-state ready">🧠 Analiza gotowa</span>`;
  if(status==="failed")return`<span class="diagnostic-agent-state failed">⚠️ Agent ponowi analizę</span>`;
  if(status==="running")return`<span class="diagnostic-agent-state">🧠 Agent analizuje</span>`;
  return`<span class="diagnostic-agent-state">🧠 W kolejce Agenta</span>`;
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
  const wszystkie=testyDiagnostyczne(),testy=systemDiagTylkoProblemy?wszystkie.filter(x=>x.status==="bad"||x.status==="warn"):wszystkie,wynik=wynikKondycji(wszystkie),bad=wszystkie.filter(x=>x.status==="bad").length,warn=wszystkie.filter(x=>x.status==="warn").length;
  return `<section class="system-summary-grid info-grid"><article class="info-card"><small>Kondycja</small><b>${wynik}%</b><span>${wynik>=90?"bardzo dobra":wynik>=70?"dobra":"wymaga działania"}</span></article><article class="info-card"><small>Błędy</small><b>${bad}</b><span>wymagają naprawy</span></article><article class="info-card"><small>Ostrzeżenia</small><b>${warn}</b><span>do sprawdzenia</span></article><article class="info-card"><small>Kontrole</small><b>${wszystkie.length}</b><span>pełny zakres systemu</span></article></section>
  <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Integralność i integracje</span><h1>🩺 Diagnostyka systemu</h1><p>Najpierw pokazujemy tylko problemy, aby nie zasłaniać czynności wymagających uwagi.</p></div><div><button class="btn ghost" onclick="systemDiagTylkoProblemy=!systemDiagTylkoProblemy;renderuj()">${systemDiagTylkoProblemy?"Pokaż wszystkie kontrole":"Pokaż tylko problemy"}</button><button class="btn" onclick="uruchomAutotest()" ${systemDiagStan.ladowanie?"disabled":""}>${systemDiagStan.ladowanie?"⏳ Sprawdzam…":"🧪 Pełny autotest"}</button></div></div>
    ${systemDiagStan.ladowanie?`<div class="backend-note"><b>Trwa kontrola na żywo:</b> backend, PostgreSQL, InPost, Gmail, wydanie atomowe i pamięć przeglądarki.</div>`:""}
    ${testy.length?`<div class="system-check-list test-list">${testy.map(x=>`<article class="test-row ${x.status}"><span>${x.status==="ok"?"✅":x.status==="warn"?"⚠️":x.status==="pending"?"⏳":"❌"}</span><div><small>${esc(x.grupa)}</small><b>${esc(x.nazwa)}</b><p>${esc(x.szczegoly)}</p>${diagnostykaStanAgentaDlaKontroli(x)}</div><em class="test-status ${x.status}">${x.status==="ok"?"OK":x.status==="warn"?"UWAGA":x.status==="pending"?"SPRAWDZAM":"BŁĄD"}</em></article>`).join("")}</div>`:systemDiagStan.ladowanie?`<div class="system-empty order-empty"><span>⏳</span><b>Sprawdzam stan na serwerze</b><p>Wynik pojawi się po zakończeniu kontroli usług.</p></div>`:`<div class="system-empty order-empty"><span>✅</span><b>Brak problemów wymagających działania</b><p>Wszystkie kontrole zakończyły się poprawnie.</p></div>`}
  </section>
  <section class="panel system-repair sug"><span>🧹</span><div><b>Bezpieczna naprawa spójności</b><small>Usuwa wyłącznie osierocone odwołania i duplikaty techniczne. Nie usuwa prawidłowych produktów ani zamówień.</small></div><button class="btn ghost" onclick="naprawDaneSklepu()">Sprawdź i napraw dane</button></section>`;
}
function systemCentralnyRejestrHTML(){
  const poziom={blad:"BŁĄD",ostrzezenie:"UWAGA"},wszystkie=systemCentralDiag.items||[],statusPasuje=item=>filtrStatusuCentralnegoDiag==="wszystkie"||(filtrStatusuCentralnegoDiag==="otwarte"?["open","investigating"].includes(item.status):["resolved","ignored"].includes(item.status));
  const centralne=wszystkie.filter(statusPasuje).filter(item=>filtrLogowDiag==="wszystkie"||item.level===filtrLogowDiag).filter(item=>!szukajLogowDiag||(`${item.message} ${item.source} ${item.route}`).toLowerCase().includes(szukajLogowDiag)),summary=systemCentralDiag.summary||{},agent=systemCentralDiag.agent||{},otwarteProblemy=wszystkie.filter(item=>["open","investigating"].includes(item.status)).map(item=>item.id),archiwum=Math.max(0,Number(summary.total||wszystkie.length)-Number(summary.open||0));
  const analizaHTML=item=>{const a=item.analysis||{},status=a.status||"idle";if(status==="idle")return"";if(["queued","running"].includes(status))return`<div class="backend-note"><b>Najmocniejszy agent:</b> ${status==="queued"?"oczekuje w kolejce":"analizuje dowody"} • ${esc(a.model||agent.model||"OpenAI")}</div>`;if(status==="failed")return`<div class="backend-note warn"><b>Analiza nieudana:</b> ${esc(a.error||"brak wyniku")}</div>`;return`<details class="backend-note"><summary><b>Analiza AI:</b> ${esc(a.summary||a.classification||"gotowa")} • pewność ${Math.round(Number(a.confidence||0)*100)}%</summary><p><b>Przyczyna:</b> ${esc(a.rootCause||"—")}</p>${a.evidence?.length?`<p><b>Dowody:</b> ${a.evidence.map(esc).join(" • ")}</p>`:""}${a.recommendedActions?.length?`<p><b>Zalecane działania:</b> ${a.recommendedActions.map(x=>esc(x.action)).join(" • ")}</p>`:""}${a.validationPlan?.length?`<p><b>Weryfikacja:</b> ${a.validationPlan.map(esc).join(" • ")}</p>`:""}<small>${esc(a.model||"")} • reasoning ${esc(a.reasoning||"")} • ${esc(systemDataCzas(a.analyzedAt))}</small></details>`};
  return `<div class="system-central-workspace" data-system-central-workspace><section class="system-summary-grid info-grid"><article class="info-card"><small>Aktywne problemy</small><b>${summary.open||0}</b><span>${summary.open?"wymagają działania":"system nie zgłasza problemów"}</span></article><article class="info-card"><small>Błędy</small><b>${summary.errors||0}</b><span>otwarte ze wszystkich urządzeń</span></article><article class="info-card"><small>Ostrzeżenia</small><b>${summary.warnings||0}</b><span>otwarte i zgrupowane</span></article><article class="info-card"><small>Archiwum</small><b>${archiwum}</b><span>rozwiązanych lub pominiętych</span></article></section>
  <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Monitoring VPS + OpenAI Agents SDK</span><h1>🛰️ Centralny rejestr problemów</h1><p>Błędy i ostrzeżenia z pełnego autotestu są grupowane według przyczyny, automatycznie analizowane i zamykane dopiero po poprawnym ponownym teście.</p></div><div><button class="btn" onclick='systemAnalizujBledy(${JSON.stringify(otwarteProblemy)})' ${!agent.configured||!otwarteProblemy.length?"disabled":""}>🧠 Ponów analizę problemów</button><button class="btn ghost" onclick="systemOdswiezCentralneBledy(true)" ${systemCentralDiag.loading?"disabled":""}>${systemCentralDiag.loading?"⏳ Pobieram…":"↻ Odśwież"}</button></div></div>
  <nav class="system-central-tabs" aria-label="Status problemów"><button class="${filtrStatusuCentralnegoDiag==="otwarte"?"active":""}" onclick="systemUstawFiltrCentralny('otwarte')">Aktywne <b>${summary.open||0}</b></button><button class="${filtrStatusuCentralnegoDiag==="zakonczone"?"active":""}" onclick="systemUstawFiltrCentralny('zakonczone')">Archiwum <b>${archiwum}</b></button><button class="${filtrStatusuCentralnegoDiag==="wszystkie"?"active":""}" onclick="systemUstawFiltrCentralny('wszystkie')">Wszystkie <b>${summary.total||wszystkie.length}</b></button><span>${systemCentralDiag.fetchedAt?`Sprawdzono ${esc(systemDataCzas(systemCentralDiag.fetchedAt))}`:"Jeszcze nie sprawdzono"}</span></nav>
  ${centralne.length?`<div class="system-log-table log-table-wrap"><table class="log-table"><thead><tr><th>Ostatnio</th><th>Poziom</th><th>Problem i analiza</th><th>Wystąpienia</th><th>Status</th><th>Działanie</th></tr></thead><tbody>${centralne.map(item=>`<tr><td>${esc(systemDataCzas(item.lastSeenAt))}<small>${esc(item.release||"wydanie nieznane")}</small></td><td><span class="lvl lvl-${item.level}">${poziom[item.level]||esc(item.level)}</span></td><td><b>${esc(item.message)}</b><small>${esc([item.source,item.route].filter(Boolean).join(" • "))}</small>${analizaHTML(item)}</td><td>${esc(item.count||1)}</td><td>${esc(item.status==="open"?"otwarty":item.status==="investigating"?"w analizie":item.status==="resolved"?"rozwiązany":"pominięty")}</td><td>${["resolved","ignored"].includes(item.status)?`<button class="btn ghost" onclick="systemUstawStatusBledu('${esc(item.id)}','open')">Otwórz ponownie</button>`:`<button class="btn ghost" onclick="systemAnalizujBledy('${esc(item.id)}')" ${!agent.configured?"disabled":""}>Analizuj</button><button class="btn" onclick="systemUstawStatusBledu('${esc(item.id)}','resolved')">Rozwiązane</button><button class="btn ghost" onclick="systemUstawStatusBledu('${esc(item.id)}','ignored')">Pomiń</button>`}</td></tr>`).join("")}</tbody></table></div>`:`<div class="system-empty order-empty"><span>${systemCentralDiag.loading?"⏳":"✅"}</span><b>${systemCentralDiag.loading?"Pobieram wspólny rejestr":filtrStatusuCentralnegoDiag==="otwarte"?"Brak aktywnych problemów":filtrStatusuCentralnegoDiag==="zakonczone"?"Archiwum jest puste":"Brak centralnie zarejestrowanych problemów"}</b><p>${systemCentralDiag.error?esc(systemCentralDiag.error):filtrStatusuCentralnegoDiag==="otwarte"?"Rozwiązane zdarzenia są dostępne w archiwum.":"Nowe błędy pojawią się tu automatycznie, niezależnie od urządzenia."}</p></div>`}</section></div>`;
}
function systemLogiHTML(){
  const wszystkie=pobierzLogi();let logi=wszystkie;if(filtrLogowDiag!=="wszystkie")logi=logi.filter(l=>l.poziom===filtrLogowDiag);if(szukajLogowDiag)logi=logi.filter(l=>(`${l.tresc} ${l.zrodlo}`).toLowerCase().includes(szukajLogowDiag));
  const poziom={blad:"BŁĄD",ostrzezenie:"UWAGA",info:"INFO"};
  return `${systemCentralnyRejestrHTML()}
  <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Ta przeglądarka</span><h1>📋 Lokalny dziennik zdarzeń</h1><p>${logi.length} z ${wszystkie.length} wpisów pasuje do bieżącego filtra.</p></div><div><button class="btn ghost" onclick="pobierzPlikLogu()">⬇️ Pobierz TXT</button><button class="btn danger" onclick="wyczyscLogi()">🗑️ Wyczyść lokalny</button></div></div>
  ${adminWyszukiwaniePanelHTML({id:"system-logi",title:"Filtry dziennika",description:"Znajdź błąd, ostrzeżenie albo zdarzenie z konkretnego modułu.",results:logi.length,active:filtrLogowDiag!=="wszystkie"||!!szukajLogowDiag,fields:`<div class="admin-filter-grid"><label><span>Szukaj</span><input placeholder="Treść lub źródło…" value="${esc(szukajLogowDiag)}" oninput="szukajLogowDiag=this.value.toLowerCase();clearTimeout(diagSearchT);diagSearchT=setTimeout(renderuj,300)"></label><label><span>Poziom</span><select onchange="filtrLogowDiag=this.value;renderuj()"><option value="wszystkie">Wszystkie</option><option value="blad" ${filtrLogowDiag==="blad"?"selected":""}>Błędy</option><option value="ostrzezenie" ${filtrLogowDiag==="ostrzezenie"?"selected":""}>Ostrzeżenia</option><option value="info" ${filtrLogowDiag==="info"?"selected":""}>Informacje</option></select></label></div>`})}
  ${logi.length?`<div class="system-log-table log-table-wrap"><table class="log-table"><thead><tr><th>Czas</th><th>Poziom</th><th>Zdarzenie</th><th>Źródło</th></tr></thead><tbody>${logi.slice(0,200).map(l=>`<tr><td>${esc(l.czas)}</td><td><span class="lvl lvl-${l.poziom}">${poziom[l.poziom]||esc(l.poziom)}</span></td><td>${esc(l.tresc)}${Number(l.powtorzenia||1)>1?` <small>× ${esc(l.powtorzenia)}</small>`:""}</td><td>${esc(l.zrodlo)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="system-empty order-empty"><span>📭</span><b>Brak zdarzeń</b><p>Zmień filtry lub wróć tu po wykonaniu kontroli.</p></div>`}</section>`;
}
function systemKopieHTML(){
  const pamiec=rozmiarDanychLokalnych();
  return `<section class="system-summary-grid info-grid"><article class="info-card"><small>Dane lokalne</small><b>${(pamiec/1024).toFixed(1)} KB</b><span>w tej przeglądarce</span></article><article class="info-card"><small>Kopie serwera</small><b>Codziennie</b><span>automatyczny harmonogram</span></article><article class="info-card"><small>Zakres kopii JSON</small><b>Panel</b><span>ustawienia i dane podręczne</span></article></section>
  <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Ochrona danych</span><h1>💾 Kopie i przywracanie</h1><p>Kopia przeglądarkowa uzupełnia codzienne kopie serwera. Nie zastępuje wersjonowanych wydań kodu.</p></div></div><div class="system-backup-actions info-grid"><article class="info-card"><span>⬇️</span><div><b>Pobierz kopię panelu</b><small>Zapisuje do pliku JSON ustawienia i dane lokalne tej przeglądarki.</small></div><button class="btn" onclick="eksportujKopieDanych()">Pobierz kopię</button></article><article class="info-card"><span>⬆️</span><div><b>Przywróć kopię panelu</b><small>Plik jest sprawdzany przed zapisem; operacja wymaga osobnego potwierdzenia.</small></div><label class="btn ghost">Wybierz plik<input type="file" accept="application/json" onchange="importujKopieDanych(event)" hidden></label></article><article class="info-card"><span>📊</span><div><b>Raport diagnostyczny</b><small>Pełny wynik kontroli i dziennik przydatny podczas naprawy.</small></div><button class="btn ghost" onclick="pobierzRaportJSON()">Pobierz raport</button></article></div></section>`;
}
function widokAdminSystem(sekcja="status"){
  const aktywna=["status","serwer","diagnostyka","logi","kopie"].includes(String(sekcja||""))?String(sekcja||""):"status";
  const tresc=aktywna==="serwer"?systemSerwerHTML():aktywna==="diagnostyka"?systemDiagnostykaHTML():aktywna==="logi"?systemLogiHTML():aktywna==="kopie"?systemKopieHTML():systemStatusHTML();
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
    data:new Date().toISOString(),wynik:wynikKondycji(testy),testy,logi:pobierzLogi(),centralnaDiagnostyka:systemCentralDiag,produkty:produkty.length,zamowienia:pobierzZamowienia().length
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
    Object.entries(d.localStorage).forEach(([k,v])=>{
      if(k.startsWith("artway_")&&!(typeof CENTRAL_PRODUCT_LS_KEYS!=="undefined"&&CENTRAL_PRODUCT_LS_KEYS.has(k)))localStorage.setItem(k,String(v));
    });
    location.reload();
  }catch(bl){toast("⚠️ Nie udało się wczytać kopii: "+bl.message);}};
  r.readAsText(plik);
}
async function naprawDaneSklepu({cicho=false,renderujPo=true}={}){
  naprawKolizjeIdProduktow();
  zbudujProdukty();
  const widoczne=new Set(produkty.map(p=>p.id)), wszystkie=new Set(produktyDoAdministracji().map(p=>p.id));
  koszyk=koszyk.filter((x,i,a)=>widoczne.has(x.id)&&x.ile>0&&a.findIndex(y=>y.id===x.id)===i);
  ulubione=[...new Set(ulubione.filter(id=>widoczne.has(id)))];
  const mapa={...(ustawienia.mapaProduktow||{})};Object.keys(mapa).forEach(id=>{if(!wszystkie.has(+id))delete mapa[id];});
  const kat=new Set(wszystkieKategorie());
  const menuKategorii=grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(k=>kat.has(k))})).filter(g=>g.nazwa);
  const uzytkownicy=pobierzUzytkownikow().filter((u,i,a)=>u.email&&a.findIndex(x=>x.email===u.email)===i);
  zapiszLS("artway_koszyk",koszyk);zapiszLS("artway_ulubione",ulubione);
  zapiszLS("artway_uzytkownicy",uzytkownicy);ustawienia={...ustawienia,mapaProduktow:mapa,menuKategorii};zapiszLS("artway_ustawienia",ustawienia,{synchronizuj:false});
  await chmuraDodajMutacjePolUstawien({mapaProduktow:mapa,menuKategorii}).catch(error=>loguj("ostrzezenie","Naprawiono dane lokalne, ale zapis serwerowy wymaga ponowienia: "+error.message,"naprawa spójności"));
  zbudujProdukty();odswiezKoszyk();odswiezUlubioneLicznik();loguj("info","Wykonano naprawę spójności danych");
  if(!cicho)toast("Dane zostały sprawdzone i naprawione ✅");
  if(renderujPo)renderuj();
}
async function uruchomAutotest(){
  if(systemDiagStan.ladowanie)return;
  systemDiagStan={...systemDiagStan,ladowanie:true,error:""};
  if(trasa().startsWith("/admin/system"))renderuj();
  try{
  ostatniAutotest=[];const dodaj=(nazwa,status,szczegoly)=>ostatniAutotest.push({grupa:"Autotest techniczny",nazwa,status,szczegoly});
  try{localStorage.setItem("artway_test","1");const ok=localStorage.getItem("artway_test")==="1";localStorage.removeItem("artway_test");dodaj("Zapis i odczyt pamięci",ok?"ok":"bad",ok?"Pamięć działa":"Brak możliwości zapisu");}catch(e){dodaj("Zapis i odczyt pamięci","bad",e.message);}
  try{const h=await hashuj("test");dodaj("Szyfrowanie haseł",h.length===64?"ok":"warn",h.length===64?"SHA-256 dostępne":"Użyto mechanizmu zapasowego");}catch(e){dodaj("Szyfrowanie haseł","bad",e.message);}
  try{const r=await fetch("/products.json",{cache:"no-store"}),j=r.ok?await r.json():null;dodaj("Dostęp do products.json",r.ok&&Array.isArray(j)?"ok":"bad",r.ok?`${j.length} rekordów`:`HTTP ${r.status}`);}catch(e){dodaj("Dostęp do products.json","bad",e.message);}
  try{
    const version=document.querySelector('meta[name="artway-version"]')?.content||"dev";
    await zaladujSklepModul("content",version);
  }catch(error){
    dodaj("Moduł podstron sklepu","bad",error.message||String(error));
  }
  const widoki=[["Sklep",()=>widokSklep()],["Kontakt",()=>widokKontakt()],["FAQ",()=>widokFAQ()],["Dostawa",()=>widokDostawa()],["Katalog administratora",()=>widokAdminProdukty()],["Zamówienia administratora",()=>widokAdminZamowienia()]],bledyWidokow=[];
  for(const [nazwa,fn] of widoki){try{const html=fn();if(typeof html!=="string"||html.length<=100)bledyWidokow.push(`${nazwa}: niepełny wynik`);}catch(error){bledyWidokow.push(`${nazwa}: ${error.message||error}`);}}
  dodaj("Renderowanie głównych widoków",bledyWidokow.length?"bad":"ok",bledyWidokow.length?bledyWidokow.join(" • "):"Sprawdzono 6 kluczowych ekranów");
  const bezpieczneProblemy=testyDiagnostyczne().filter(item=>["Spójność koszyka","Spójność ulubionych","Spójność mapowania"].includes(item.nazwa)&&["bad","warn"].includes(item.status));
  if(bezpieczneProblemy.length)await naprawDaneSklepu({cicho:true,renderujPo:false});
  const problemy=ostatniAutotest.filter(item=>["bad","warn"].includes(item.status));
  if(problemy.length)problemy.forEach(item=>loguj(item.status==="bad"?"blad":"ostrzezenie",`${item.nazwa}: ${item.szczegoly}`,"pełny autotest"));
  else loguj("info","Pełny autotest zakończony: wszystkie 4 obszary działają poprawnie","pełny autotest");
  await diagnostykaWyslijKolejke();
  await diagnostykaSynchronizujProblemy(testyDiagnostyczne());
  await systemPobierzCentralneBledy(true);
  systemDiagStan={...systemDiagStan,ladowanie:false,sprawdzono:true,sprawdzonoAt:new Date().toISOString(),error:""};
  }catch(error){
    systemDiagStan={...systemDiagStan,ladowanie:false,sprawdzono:true,sprawdzonoAt:new Date().toISOString(),error:error.message||String(error)};
    loguj("blad","Pełny autotest nie został dokończony: "+systemDiagStan.error,"pełny autotest");
    toast("Autotest wymaga ponowienia: "+systemDiagStan.error);
  }finally{
    systemDiagStan={...systemDiagStan,ladowanie:false};
    renderuj();
  }
}
