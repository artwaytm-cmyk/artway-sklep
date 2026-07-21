function urlBramki(action,parametry={}){
  const baza=String(ustawieniaWysylki().apiEndpoint||"api/index.php").trim();
  const url=new URL(baza,location.href);
  if(url.origin!==location.origin) throw new Error("Bramka musi działać w tej samej domenie co sklep.");
  url.searchParams.set("action",action);
  for(const [k,v] of Object.entries(parametry)) if(v!==undefined&&v!==null&&v!=="") url.searchParams.set(k,String(v));
  return url.toString();
}
async function wywolajBramke(action,{method="GET",body=null,parametry={}}={}){
  const opcje={method,credentials:"same-origin",headers:{"Accept":"application/json"}};
  if(body!==null){opcje.headers["Content-Type"]="application/json";opcje.body=JSON.stringify(body);}
  const r=await fetch(urlBramki(action,parametry),opcje);
  const tekst=await r.text(); let dane;
  try{dane=JSON.parse(tekst);}catch(e){throw new Error(r.ok?"Serwer nie uruchomił PHP dla katalogu api.":"Bramka zwróciła nieprawidłową odpowiedź.");}
  if(!r.ok||dane.ok===false){const blad=new Error(dane.error||`Błąd bramki HTTP ${r.status}`);blad.code=dane.code||"";blad.status=r.status;throw blad;}
  return dane;
}
function polaczUzytkownikowCentralnych(serwerowi){
  // Serwer jest jedynym źródłem kont. localStorage przechowuje wyłącznie
  // ostatnią pobraną kopię i nie może przywrócić usuniętego użytkownika.
  return Array.isArray(serwerowi)?serwerowi:[];
}
let zamowieniaAdminOdswiezenieWToku=null,zamowieniaAdminOstatnieOdswiezenie=0,zamowieniaAdminWersja="",zamowieniaAdminUsunieteWersja="";
async function synchronizujBazeCentralna(cicho=false){
  if(stanBazyCentralnej.synchronizacja) return false;
  if(!maUprawnieniaZapisuChmury()){ if(!cicho) chmuraUstawToken(); return false; }
  chmuraOstatniaSynchronizacjaCentralnaZmienilaDane=false;
  stanBazyCentralnej={...stanBazyCentralnej,synchronizacja:true};
  try{
    const ok=await chmuraWczytajStan();
    if(!ok)throw new Error(chmuraStan.error||"Nie udało się pobrać wspólnej bazy");
    chmuraOstatniaSynchronizacjaCentralnaZmienilaDane=chmuraOstatniPullZmienilDane;
    stanBazyCentralnej={sprawdzono:true,online:true,synchronizacja:false,orders:pobierzZamowienia().length,users:pobierzUzytkownikow().length,updatedAt:chmuraStan.updated_at||null,error:""};
    chmuraStan={...chmuraStan,dostepna:true,admin:true};
    if(!cicho) toast(`Wspólna baza zsynchronizowana ✅ (${stanBazyCentralnej.orders} zamówień)`);
    if(!cicho) renderuj();
    return true;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,synchronizacja:false,error:bl.message};
    if(bl.code==="auth"){ chmuraStan={...chmuraStan,admin:false}; if(!cicho) toast("Hasło bazy nieprawidłowe — wpisz je ponownie"); }
    else if(!cicho) toast("Błąd wspólnej bazy: "+bl.message);
    return false;
  }
}
async function odswiezZamowieniaAdminaPoWejsciu(){
  if(!maUprawnieniaZapisuChmury())return false;
  if(zamowieniaAdminOdswiezenieWToku)return zamowieniaAdminOdswiezenieWToku;
  if(Date.now()-zamowieniaAdminOstatnieOdswiezenie<10000)return false;
  zamowieniaAdminOstatnieOdswiezenie=Date.now();
  zamowieniaAdminOdswiezenieWToku=(async()=>{
    const przed=localStorage.getItem("artway_zamowienia")||"";
    const d=await chmura("store-orders-admin",{params:{ordersVersion:zamowieniaAdminWersja,deletedVersion:zamowieniaAdminUsunieteWersja,count:pobierzZamowienia().length},timeout:15000});
    zamowieniaAdminWersja=String(d.ordersVersion||zamowieniaAdminWersja);
    zamowieniaAdminUsunieteWersja=String(d.deletedVersion||zamowieniaAdminUsunieteWersja);
    if(!d.unchanged){
      if(Array.isArray(d.deleted_orders))zapiszUsunieteZamowienia(d.deleted_orders);
      if(Array.isArray(d.orders))zapiszLS("artway_zamowienia",filtrujAktywneZamowienia(d.orders));
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,orders:Number(d.count)||0,updatedAt:d.updated_at||stanBazyCentralnej.updatedAt,error:""};
    }
    const zmieniono=przed!==(localStorage.getItem("artway_zamowienia")||"");
    if(zmieniono&&trasa().startsWith("/admin/zamowien")){
      odswiezMenu();
      odswiezPoCichejSynchronizacji();
    }
    return true;
  })().finally(()=>{zamowieniaAdminOdswiezenieWToku=null;});
  return zamowieniaAdminOdswiezenieWToku;
}
async function pobierzMojeZamowieniaCentralne(cicho=false){
  if(!sesja||jestAdmin()) return false;
  try{
    const d=await chmura("store-orders-mine",{params:{email:sesja.email}});
    const pozostale=pobierzZamowienia().filter(z=>z.email!==sesja.email);
    zapiszLS("artway_zamowienia",[...filtrujAktywneZamowienia(d.orders||[]),...pozostale]);
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    if(!cicho){toast("Pobrano zamówienia ze wspólnej bazy ✅");renderuj();}
    return true;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
    return false;
  }
}
async function zapiszZamowienieCentralnie(z,publiczne=false){
  if(czyZamowienieUsuniete(z?.nr)) return false;
  try{
    const action=publiczne?"store-order-create":"store-order-save";
    if(!publiczne&&!maUprawnieniaZapisuChmury()) return false;
    const d=await chmura(action,{method:"POST",body:{order:z}});
    if(d?.deleted){ oznaczZamowienieUsuniete(z.nr,{by:"server"}); zapiszLS("artway_zamowienia",pobierzZamowienia()); return false; }
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    chmuraStan={...chmuraStan,dostepna:true};
    // serwer wysyła automatyczne e-maile statusowe — wczytaj świeżą historię powiadomień
    if(!publiczne && d && Array.isArray(d.powiadomienia)){
      const lista=pobierzZamowienia(), lokalny=lista.find(x=>x.nr===z.nr);
      if(lokalny){ lokalny.wysylka=lokalny.wysylka||{}; lokalny.wysylka.powiadomienia=d.powiadomienia; zapiszLS("artway_zamowienia",lista); if(typeof renderuj==="function") renderuj(); }
    }
    return d;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
    loguj("blad",`Wspólna baza — zamówienie ${z?.nr||""}: ${bl.message}`);
    return false;
  }
}
async function zapiszUzytkownikaCentralnie(u){
  try{
    const action=maUprawnieniaZapisuChmury()?"store-user-save":"account-profile-save";
    await chmura(action,{method:"POST",body:{user:u}});
    return true;
  }catch(bl){ return false; }
}
async function odtworzSesjeCentralna(){
  try{
    if(maUprawnieniaZapisuChmury()){ await synchronizujBazeCentralna(true); }
    else if(sesja && !jestAdmin()){ await pobierzMojeZamowieniaCentralne(true); }
  }catch(e){}
}
function odswiezPoCichejSynchronizacji(){
  if(typeof document!=="undefined" && document.hidden) return;
  if(typeof agentAIDecyzjeMagazynoweBusy!=="undefined" && agentAIDecyzjeMagazynoweBusy.size) return;
  const aktywny=document.activeElement, tag=aktywneTag => aktywneTag && ["INPUT","TEXTAREA","SELECT"].includes(aktywneTag.tagName);
  if(tag(aktywny)) return;
  const t=trasa();
  const odswiezane=["/admin","/admin/pulpit","/admin/zamowienia","/admin/wysylki","/admin/agent-ai","/admin/magazyn","/admin/allegro","/zamowienia"];
  if(!odswiezane.some(x=>t===x || (["/admin/pulpit","/admin/agent-ai","/admin/magazyn","/admin/allegro"].includes(x)&&t.startsWith(x+"/")) || (x==="/admin/wysylki"&&t.startsWith("/admin/zamowienie/")))) return;
  const y=window.scrollY||0;
  renderuj();
  setTimeout(()=>window.scrollTo({top:y,behavior:"instant"}),0);
}
async function automatycznaSynchronizacjaChmury(powod="timer"){
  if(chmuraAutoSyncBusy) return false;
  if(typeof document!=="undefined" && document.hidden && powod==="timer") return false;
  const teraz=Date.now();
  if(powod!=="timer"&&teraz-chmuraAutoSyncOstatniStart<CHMURA_FOCUS_SYNC_MIN_MS)return false;
  chmuraAutoSyncOstatniStart=teraz;
  chmuraAutoSyncBusy=true;
  try{
    let ok=false,daneZmienione=false;
    if(maUprawnieniaZapisuChmury()){
      ok = await chmuraWczytajStan();
      daneZmienione=chmuraOstatniPullZmienilDane;
    }else{
      ok = await chmuraWczytajStan();
      daneZmienione=chmuraOstatniPullZmienilDane;
      if(sesja && !jestAdmin()){
        const przed=localStorage.getItem("artway_zamowienia");
        ok = (await pobierzMojeZamowieniaCentralne(true)) || ok;
        daneZmienione=przed!==localStorage.getItem("artway_zamowienia")||daneZmienione;
      }
    }
    const allegroOk=typeof allegroOdswiezDaneZSerweraJesliCzas==="function"?await allegroOdswiezDaneZSerweraJesliCzas(powod):false;
    if(daneZmienione){
      zastosujUstawienia(); zbudujProdukty();
      odswiezMenu(); odswiezKoszyk();
      odswiezPoCichejSynchronizacji();
    }else if(allegroOk){
      odswiezMenu();odswiezPoCichejSynchronizacji();
    }
    return ok||allegroOk;
  }catch(e){ return false; }
  finally{ chmuraAutoSyncBusy=false; }
}
function uruchomAutoSynchronizacjeChmury(){
  if(chmuraTimerAutoSync) clearInterval(chmuraTimerAutoSync);
  chmuraAutoSyncOstatniStart=Date.now();
  chmuraTimerAutoSync=setInterval(()=>automatycznaSynchronizacjaChmury("timer"),CHMURA_AUTO_SYNC_MS);
  setInterval(()=>{if(trasa()==="/admin/zamowienia"||trasa().startsWith("/admin/zamowienie/"))odswiezZamowieniaAdminaPoWejsciu().catch(()=>{});},60000);
  window.addEventListener("focus",()=>automatycznaSynchronizacjaChmury("focus"));
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) automatycznaSynchronizacjaChmury("visible"); });
}
async function sprawdzBramke(cicho=false){
  try{
    const cloud=await chmura("health",{timeout:9000});
    stanBramki={...stanBramki,sprawdzono:true,online:true,email:cloud.email||stanBramki.email,store:cloud.store||stanBramki.store,inpost:cloud.inpost||stanBramki.inpost,error:""};
    if(cloud.inpost) INPOST_PUBLIC=cloud.inpost;
    if(cloud.store) stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,orders:cloud.store.orders||0,users:cloud.store.users||0,updatedAt:cloud.store.settings_updated_at||cloud.store.updated_at||null,error:""};
    if(!cicho){
      const ip=cloud.inpost||{};
      const czesci=[];
      czesci.push("Netlify Functions działa ✅");
      czesci.push(cloud.email?.authenticated?`SMTP ${cloud.email.provider||""} połączony`:cloud.email?.configured?"SMTP zapisany — wymaga testu":"SMTP wymaga naprawy poświadczenia");
      czesci.push(ip.authenticated?`InPost ShipX połączony (${ip.env||"production"})`:ip.configured?`InPost ShipX zapisany (${ip.env||"production"})`:`InPost: brakuje ${(ip.missingEnv&&ip.missingEnv.length?ip.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")}`);
      if(!ip.geowidgetConfigured) czesci.push("mapa paczkomatów: brak INPOST_GEOWIDGET_TOKEN");
      toast(czesci.join(" • "));
    }
    if(maUprawnieniaZapisuChmury()&&Date.now()-ostatniTestIntegracjiSerwerowych>15*60*1000)setTimeout(()=>sprawdzPolaczeniaSerwerowe(true),0);
    if(trasa().startsWith("/admin/wysylki")||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy"||trasa().startsWith("/admin/agent-ai")) renderuj();
    return;
  }catch(e){ /* Netlify może być chwilowo niedostępne — niżej próbujemy awaryjny backend PHP */ }
  try{
    const d=await wywolajBramke("health");
    stanBramki={...stanBramki,...d,email:d.email||stanBramki.email,store:d.store||stanBramki.store,sprawdzono:true,online:true,error:""};
    if(!cicho) toast(d.ready?"Awaryjna bramka PHP gotowa ✅":d.configured?"Awaryjna bramka PHP skonfigurowana":"Bramka InPost wymaga konfiguracji");
  }catch(e){
    stanBramki={...stanBramki,sprawdzono:true,online:false,error:e.message};
    if(!cicho) toast("Bramka niedostępna — sprawdź Netlify Functions");
  }
  if(trasa().startsWith("/admin/wysylki")||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy"||trasa().startsWith("/admin/agent-ai")) renderuj();
}
async function polaczBramke(e){
  e.preventDefault();
  const f=new FormData(e.target), haslo=String(f.get("apiPassword")||"");
  try{
    await wywolajBramke("login",{method:"POST",body:{password:haslo}});
    e.target.reset(); await sprawdzBramke(true);
    await synchronizujBazeCentralna(true);
    toast("Sesja integracji połączona ✅");
  }catch(bl){stanBramki={...stanBramki,error:bl.message};toast("Nie udało się połączyć: "+bl.message);renderuj();}
}
async function rozlaczBramke(){
  try{await wywolajBramke("logout",{method:"POST",body:{}});}catch(e){}
  stanBramki={sprawdzono:true,online:true,configured:stanBramki.configured,ready:stanBramki.ready,authenticated:false,error:"",organizations:[],email:stanBramki.email||{configured:false,provider:null}};
  toast("Rozłączono sesję integracji");renderuj();
}
async function testujInPost(cicho=false){
  try{
    const cfg=await pobierzInpostConfig(true);
    stanBramki={...stanBramki,inpost:cfg||stanBramki.inpost};
    if(!maUprawnieniaZapisuChmury()){ if(!cicho)chmuraUstawToken(); return false; }
    const d=await chmura("inpost-test",{timeout:15000});
    const ip=d.inpost||cfg||{};
    stanBramki={...stanBramki,inpost:ip,error:""};
    const org=ip.organization?.id?` • organizacja ${ip.organization.id}`:"";
    const uslugi=ip.organization?.services?.length?` • usługi: ${ip.organization.services.slice(0,3).join(", ")}`:"";
    const av=ip.serviceAvailability||{};
    const uwagaPaczkomat=av.locker===false?` • paczkomat ${av.lockerService||"inpost_locker_standard"} wymaga włączenia`:"";
    const uwagaKurier=av.courier===false?` • kurier ${av.courierService||"inpost_courier_standard"} wymaga włączenia`:"";
    if(!cicho)toast(`InPost ShipX połączony trwale ✅ (${ip.env||"production"})${org}${ip.geowidgetConfigured?" • mapa aktywna":" • mapa wymaga konfiguracji"}${uslugi}${uwagaPaczkomat}${uwagaKurier}`);
    if(!cicho)renderuj();
    return true;
  }catch(bl){
    const ip=bl.inpost||stanBramki.inpost||{};
    stanBramki={...stanBramki,inpost:ip,error:bl.message};
    if(!cicho){
      if(bl.code==="inpost_not_configured") toast("InPost niegotowy — brakuje: "+((bl.missingEnv&&bl.missingEnv.length?bl.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")));
      else toast("Test InPost: "+bl.message);
      renderuj();
    }
    return false;
  }
}
function b64toBlob(b64,typ="application/pdf"){
  const bin=atob(String(b64||"")); const len=bin.length; const arr=new Uint8Array(len);
  for(let i=0;i<len;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:typ});
}
async function zapiszFormularzWysylkiPrzedAPI(nr){
  const form=[...document.forms].find(f=>(String(f.getAttribute("onsubmit")||"").includes(nr) && (f.querySelector('[name="usluga"]')||f.querySelector('[name="dostawaTyp"]')) && f.querySelector('[name="waga"]')));
  if(!form) return null;
  const f=new FormData(form);
  const zapisane=aktualizujZamowienie(nr,zam=>{
    const stareRazem=kwotaNum(zam.razem);
    const w=daneWysylki(zam);
    const typ=String(f.get("dostawaTyp")||zam.dostawaId||"").trim();
    const paczkomat=typ ? typ!=="kurier_inpost" : czyZamowieniePaczkomat(zam);
    const punktKod=String(f.get("punktKod")||f.get("paczkomat")||"").trim().toUpperCase();
    if(typ==="paczkomat"||typ==="kurier_inpost"){ zam.dostawaId=typ; zam.dostawa=typ==="paczkomat"?"Paczkomat InPost 24/7":"Kurier InPost"; }
    if(paczkomat&&punktKod) zam.paczkomat=punktKod;
    if(!paczkomat){ zam.paczkomat=""; zam.paczkomatAdres=""; }
    const uslugaZTypu=typ==="kurier_inpost"?"Kurier InPost":uslugaInpostZamowienia(zam);
    const pobranieAktywneForm=f.has("pobranieAktywne")
      ? String(f.get("pobranieAktywne")||"").trim()==="tak"
      : pobranieAktywneZamowienia(zam,w);
    const pobranieForm=pobranieAktywneForm ? String(f.get("pobranie")||w.pobranie||kwotaNum(zam.razem).toFixed(2)).trim() : "";
    const paczkaWeekendForm=f.has("paczkaWeekend") ? String(f.get("paczkaWeekend")||"").trim()==="tak" : !!(w.paczkaWeekend||zam.paczkaWeekend);
    const sposobNadania=String(f.get("sposobNadania")||w.sposobNadania||INPOST_DOMYSLNY_SP_NADANIA).trim();
    const punktNadania=String(f.get("punktNadania")||w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
    zam.wysylka={...w,
      przewoznik:"inpost",
      usluga:String(f.get("usluga")||w.usluga||uslugaZTypu).trim()||uslugaZTypu,
      punktKod:paczkomat?(punktKod||w.punktKod||zam.paczkomat||""):"",
      numer:String(f.get("numer")||w.numer||"").trim(),
      trackingUrl:String(f.get("trackingUrl")||w.trackingUrl||"").trim(),
      priorytet:String(f.get("priorytet")||w.priorytet||"normalny"),
      operator:String(f.get("operator")||w.operator||"").trim(),
      terminNadania:String(f.get("terminNadania")||w.terminNadania||"").trim(),
      przewidywaneDoreczenie:String(f.get("przewidywaneDoreczenie")||w.przewidywaneDoreczenie||"").trim(),
      waga:String(f.get("waga")||w.waga||"").trim(),
      dlugosc:String(f.get("dlugosc")||w.dlugosc||"").trim(),
      szerokosc:String(f.get("szerokosc")||w.szerokosc||"").trim(),
      wysokosc:String(f.get("wysokosc")||w.wysokosc||"").trim(),
      ochrona:String(f.get("ochrona")||w.ochrona||"").trim(),
      pobranieAktywne:pobranieAktywneForm,
      pobranie:pobranieForm,
      paczkaWeekend:paczkaWeekendForm,
      sposobNadania:INPOST_SP_NADANIA[sposobNadania]?sposobNadania:INPOST_DOMYSLNY_SP_NADANIA,
      punktNadania,
      formatEtykiety:String(f.get("formatEtykiety")||w.formatEtykiety||"A6").trim().toUpperCase()==="A4"?"A4":"A6",
      zadania:{...(w.zadania||{}),dane:true},
      zaktualizowano:new Date().toISOString()
    };
    zapiszKosztyZamowienia(zam,{dostawaId:zam.dostawaId,paczkaWeekend:zam.wysylka.paczkaWeekend});
    if(pobranieAktywneForm && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) zam.wysylka.pobranie=kwotaNum(zam.razem).toFixed(2);
  });
  if(zapisane) await zapiszZamowienieCentralnie(zapisane,false);
  return zapisane;
}
async function utworzPrzesylkeAPI(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z)return toast("Nie znaleziono zamówienia");
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
  if(!confirm(`Utworzyć prawdziwą przesyłkę InPost dla ${nr}? W trybie produkcyjnym operacja może naliczyć opłatę zgodnie z umową.`))return;
  try{
    await zapiszFormularzWysylkiPrzedAPI(nr);
    toast("Tworzę przesyłkę InPost…");
    const d=await chmura("inpost-create",{method:"POST",body:{nr},timeout:25000});
    const labelReady=!!(d.labelReady||d.trackingNumber);
    aktualizujZamowienie(nr,zam=>{
      const w=daneWysylki(zam);
      zam.wysylka=d.order?.wysylka?{...w,...d.order.wysylka}:{...w,przewoznik:"inpost",usluga:uslugaInpostZamowienia(zam),inpostId:d.inpostId||w.inpostId,numer:d.trackingNumber||w.numer,inpostStatus:d.status||w.inpostStatus,etykietaGotowa:labelReady,etap:labelReady?"etykieta":(w.etap&&w.etap!=="problem"?w.etap:"przygotowanie"),zadania:{...(w.zadania||{}),dane:true,etykieta:labelReady}};
      if(d.order?.status) zam.status=d.order.status;
      else if(labelReady&&["nowe","potwierdzone","w realizacji"].includes(zam.status))zam.status="gotowe do wysyłki";
    });
    loguj("info",`InPost utworzył przesyłkę ${d.inpostId||""} (${d.trackingNumber||"bez numeru"}) dla ${nr}`);
    toast(labelReady?`Przesyłka InPost utworzona ✅ ${d.trackingNumber||"etykieta gotowa"}`:"Przesyłka utworzona, ale InPost jeszcze potwierdza etykietę — użyj „Sprawdź status InPost” za chwilę.");
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Najpierw skonfiguruj InPost w Netlify (INPOST_TOKEN, INPOST_ORG_ID)"); location.hash="#/admin/dostawy"; return; }
    if(bl.code==="no_point"){ toast("Brak punktu InPost — otwórz zlecenie i wpisz paczkomat przed etykietą"); return; }
    if(bl.code==="exists"){ toast("Przesyłka InPost już istnieje dla tego zamówienia"); return; }
    if(bl.code==="inpost_validation"){ toast("Uzupełnij dane do InPost: "+((bl.details||[]).map(x=>x.message||x).join(" • ")||bl.message)); return; }
    if(bl.code==="inpost_service_unavailable"){ toast(bl.message||"Ta usługa InPost nie jest aktywna na koncie"); return; }
    aktualizujZamowienie(nr,zam=>{const w=daneWysylki(zam);w.bladIntegracji=bl.message;w.etap="problem";zam.wysylka=w;});
    loguj("blad",`InPost create ${nr}: ${bl.message}`);toast("InPost: "+bl.message);renderuj();
  }
}
async function pobierzEtykieteAPI(nr,format="A6"){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.wysylka?.inpostId)return toast("Najpierw utwórz przesyłkę InPost");
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
  try{
    toast("Pobieram etykietę InPost…");
    const d=await chmura("inpost-label",{params:{nr,type:format},timeout:25000});
    const url=URL.createObjectURL(b64toBlob(d.base64,"application/pdf"));
    window.open(url,"_blank","noopener");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    aktualizujZamowienie(nr,zam=>{
      const w=daneWysylki(zam);
      if(d.status)w.inpostStatus=d.status;
      if(d.trackingNumber)w.numer=d.trackingNumber;
      w.etykietaGotowa=true;
      w.zadania={...(w.zadania||{}),dane:true,etykieta:true};
      if(!w.etap||w.etap==="przygotowanie"||w.etap==="problem")w.etap="etykieta";
      zam.wysylka=w;
    });
    loguj("info",`Pobrano etykietę InPost ${format} dla ${nr}`);
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Skonfiguruj InPost w Netlify"); return; }
    if(bl.code==="no_shipment"){ toast("Najpierw utwórz przesyłkę InPost"); return; }
    if(bl.code==="label_not_ready"){
      aktualizujZamowienie(nr,zam=>{ const w=daneWysylki(zam); if(bl.status)w.inpostStatus=bl.status; if(bl.trackingNumber)w.numer=bl.trackingNumber; w.etykietaGotowa=false; w.zadania={...(w.zadania||{}),dane:true,etykieta:false}; zam.wysylka=w; });
      toast(bl.message||"InPost jeszcze nie potwierdził etykiety — sprawdź status za chwilę");
      renderuj();
      return;
    }
    toast("Etykieta: "+bl.message); loguj("blad",`InPost label ${nr}: ${bl.message}`);
  }
}
function idEtykietyInpost(nr){ return "etykietaFormat_"+String(nr||"").replace(/[^a-z0-9_-]/gi,"_"); }
function wybranyFormatEtykietyInpost(nr, fallback="A6"){
  const v=String($(idEtykietyInpost(nr))?.value||fallback||"A6").toUpperCase();
  return v==="A4"?"A4":"A6";
}
const INPOST_STATUSY_ETYKIETA_GOTOWA = ["confirmed","dispatched_by_sender","collected_from_sender","taken_by_courier","adopted_at_source_branch","sent_from_source_branch","ready_to_pickup","out_for_delivery","delivered","returned_to_sender","return_redirected_to_sender"];
function czyEtykietaInpostGotowa(z){
  const w=daneWysylki(z);
  if(w.etykietaGotowa||w.numer)return true;
  const s=String(w.inpostStatus||"").trim().toLowerCase();
  if(!s)return false;
  if(INPOST_STATUSY_ETYKIETA_GOTOWA.includes(s)||s.includes("confirmed"))return true;
  if(s.includes("created")||s.includes("offer")||s.includes("prepared")||s.includes("cancel"))return false;
  return ["transport","doreczenie","dostarczona","zwrot"].includes(String(w.etap||"").toLowerCase());
}
function opisGotowosciEtykietyInpost(z){
  const w=daneWysylki(z), status=String(w.inpostStatus||"").trim();
  if(czyEtykietaInpostGotowa(z))return `Etykieta gotowa${w.numer?` • numer ${w.numer}`:""}${status?` • ${status}`:""}`;
  if(w.inpostId)return `Przesyłka ma ID ${w.inpostId}, ale InPost jeszcze nie potwierdził/opłacił etykiety${status?` • status: ${status}`:""}.`;
  return "Najpierw utwórz przesyłkę InPost.";
}
function pobierzWybranaEtykieteAPI(nr){ return pobierzEtykieteAPI(nr, wybranyFormatEtykietyInpost(nr)); }
function panelEtykietInpostHTML(z){
  const w=daneWysylki(z), nr=z?.nr||"", id=idEtykietyInpost(nr), fmt=String(w.formatEtykiety||"A6").toUpperCase()==="A4"?"A4":"A6";
  const ma=!!w.inpostId, gotowa=czyEtykietaInpostGotowa(z);
  return `<div style="border:2px solid #ffcc00;background:linear-gradient(180deg,#fff7cc,#fff);border-radius:14px;padding:.85rem 1rem;margin:.7rem 0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.7rem;flex-wrap:wrap">
      <div><b>🏷️ Etykiety i import InPost</b><br><small style="color:var(--muted2)">Wybierz format etykiety, pobierz PDF albo przygotuj plik importu do InPost Managera.</small></div>
      <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;font-weight:800">Format PDF:
        <select id="${esc(id)}" name="formatEtykiety" style="padding:.38rem .6rem;border:1.5px solid var(--line);border-radius:10px">
          <option value="A6" ${fmt==="A6"?"selected":""}>A6 — mała etykieta</option>
          <option value="A4" ${fmt==="A4"?"selected":""}>A4 — kartka</option>
        </select>
      </label>
    </div>
    <div class="diag-actions" style="margin-top:.7rem">
      ${ma&&gotowa?`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="pobierzWybranaEtykieteAPI(${jsArg(nr)})">🏷️ Pobierz wybraną etykietę</button>
      <button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(nr)},'A6')">A6</button>
      <button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(nr)},'A4')">A4</button>`:ma?`<button class="btn ghost" type="button" disabled title="InPost musi potwierdzić/opłacić przesyłkę przed pobraniem PDF">🏷️ PDF po potwierdzeniu</button>
      <button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="synchronizujTrackingAPI(${jsArg(nr)})">🔄 Sprawdź status InPost</button>`:`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="utworzPrzesylkeAPI(${jsArg(nr)})">🟡 Utwórz przesyłkę i numer</button>
      <button class="btn ghost" type="button" disabled title="Najpierw utwórz przesyłkę InPost">PDF po nadaniu</button>`}
      <button class="btn ghost" type="button" onclick="drukujEtykieteRobocza(${jsArg(nr)})">🏷️ Robocza A6</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'tab')">📄 TXT z nagłówkami InPost</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'csv')">CSV przecinek</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'txt')">📄 TXT średnik</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'extended')">📋 CSV rozszerzony</button>
      ${ma&&gotowa?`<button class="btn ghost" type="button" onclick="synchronizujTrackingAPI(${jsArg(nr)})">🔄 Status InPost</button>`:""}
    </div>
    <p style="font-size:.78rem;color:${ma&&!gotowa?"#92400e":"var(--muted2)"};margin:.55rem 0 0"><b>Status etykiety:</b> ${esc(opisGotowosciEtykietyInpost(z))}</p>
    <p style="font-size:.78rem;color:var(--muted2);margin:.35rem 0 0"><b>TXT z nagłówkami InPost</b> działa z ustawieniem InPost „Separator kolumn: Tabulator”. W InPost zmień tylko <b>„Czy ma nagłówki?” na TAK</b>, wtedy dopasowujesz nazwa do nazwy: e-mail → E-mail, telefon → Telefon, miasto → Miasto.</p>
  </div>`;
}
async function synchronizujTrackingAPI(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.wysylka?.inpostId)return toast("To zamówienie nie ma przesyłki InPost");
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
  try{
    toast("Pobieram status z InPost…");
    const d=await chmura("inpost-status",{params:{nr},timeout:20000});
    aktualizujZamowienie(nr,zam=>{ if(d.order?.wysylka) zam.wysylka={...daneWysylki(zam),...d.order.wysylka}; });
    loguj("info",`InPost status ${nr}: ${d.status||""} ${d.trackingNumber||""}`);
    toast((d.labelReady||d.trackingNumber)?"Status InPost zaktualizowany ✅ — etykieta gotowa":"Status InPost zaktualizowany — etykieta jeszcze czeka na potwierdzenie");
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Skonfiguruj InPost w Netlify"); return; }
    if(bl.code==="no_shipment"){ toast("To zamówienie nie ma przesyłki InPost"); return; }
    aktualizujZamowienie(nr,zam=>{const w=daneWysylki(zam);w.bladIntegracji=bl.message;zam.wysylka=w;});
    loguj("blad",`InPost status ${nr}: ${bl.message}`);toast("Status: "+bl.message);renderuj();
  }
}
// Ręczne sprawdzenie statusów WSZYSTKICH przesyłek InPost (to samo robi harmonogram co 6h)
async function synchronizujWszystkieStatusyAPI(){
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
  try{
    toast("Sprawdzam statusy wszystkich przesyłek InPost…");
    const d=await chmura("inpost-sync-all",{method:"POST",body:{},timeout:60000});
    await synchronizujBazeCentralna(true).catch(()=>{});
    loguj("info",`InPost sync: sprawdzone ${d.sprawdzone||0}, zmienione ${d.zmienione||0}, e-maile ${d.maile||0}, błędy ${d.bledy||0}`);
    toast(`✅ Sprawdzono ${d.sprawdzone||0} przesyłek — ${d.zmienione||0} zmian statusu, ${d.maile||0} e-maili`);
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured") toast("InPost nie jest skonfigurowany w Netlify");
    else toast("Błąd sprawdzania statusów: "+bl.message);
  }
}
// Hurtowe tworzenie etykiet InPost (API) dla zaznaczonych zleceń
async function utworzEtykietyZaznaczoneAPI(){
  const nry=[...zaznaczoneNadania];
  if(!nry.length){ toast("Zaznacz zlecenia (☑ na karcie)"); return; }
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
  if(!confirm(`Utworzyć przesyłki InPost (API) dla ${nry.length} zaznaczonych zleceń? W trybie produkcyjnym mogą naliczyć się opłaty zgodnie z umową.`)) return;
  let ok=0,bl=0,pom=0;
  toast(`Tworzę przesyłki InPost dla ${nry.length} zleceń…`);
  for(const nr of nry){
    const z=pobierzZamowienia().find(x=>x.nr===nr);
    if(z?.wysylka?.inpostId){ pom++; continue; }
    try{ await chmura("inpost-create",{method:"POST",body:{nr},timeout:25000}); ok++; }
    catch(e){ bl++; loguj("blad",`InPost etykieta ${nr}: ${e.message}`); }
  }
  await synchronizujBazeCentralna(true).catch(()=>{});
  toast(`🟡 InPost: ${ok} przesyłek zleconych${pom?`, ${pom} już było`:""}${bl?`, ${bl} błędów`:""} — PDF odblokuje się po potwierdzeniu`);
  renderuj();
}
function przelaczZadanieWysylki(nr,klucz){
  aktualizujZamowienie(nr,z=>{const w=daneWysylki(z);w.zadania={...(w.zadania||{}),[klucz]:!w.zadania?.[klucz]};z.wysylka=w;});
  renderuj();
}
function zastosujRegulyWysylek(){
  const lista=pobierzZamowienia(); let ile=0;
  for(const z of lista){
    if(["anulowane","zakończone","dostarczone"].includes(z.status)||z.wysylka?.przewoznik) continue;
    const w=daneWysylki(z); w.przewoznik=przewoznikDlaZamowienia(z); w.etap="przygotowanie";
    w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status:"Reguła automatyczna",opis:`Przypisano ${nazwaPrzewoznika(w.przewoznik)}`}];
    z.wysylka=w; if(z.status==="nowe") z.status="w realizacji"; ile++;
  }
  zapiszLS("artway_zamowienia",lista); loguj("info",`Reguły wysyłkowe przypisały ${ile} zleceń`);
  toast(ile?`Przypisano ${ile} zleceń ✅`:"Brak zleceń do przypisania"); renderuj();
}
let tabWysylek="zlecenia", filtrWysylek="aktywne", szukajWysylek="";
