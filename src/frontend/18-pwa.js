/* Instalowalny panel administratora (PWA). Aplikacja używa dokładnie tego
   samego panelu i API co strona, dlatego nie tworzy drugiej kopii danych. */
let pwaOdroczoneZaproszenie=null;
let pwaSprawdzanieWydania=false;
let pwaWykryteWydanie="";
let pwaAutomatycznePrzeladowanie=0;
let pwaPrzeladowanieWTrakcie=false;
const PWA_CACHE_KEY_VERSION="artway-active-release-v1";
const PWA_CACHE_KEY_TS="artway-last-release-check";

function pwaNazwaWersji(){return document.querySelector('meta[name="artway-version"]')?.content||"dev";}
function pwaZapiszWersjeWPodsumowaniu(releaseId){
  try{
    localStorage.setItem(PWA_CACHE_KEY_VERSION,String(releaseId||""));
    localStorage.setItem(PWA_CACHE_KEY_TS,String(Date.now()));
  }catch(error){}
}

async function pwaOczyscCacheKompletny(){
  const usuniecia=[];
  if("caches" in window){
    try{
      const cacheKeys = await caches.keys();
      for(const key of cacheKeys.filter((key)=>key.startsWith("artway-"))){
        usuniecia.push(caches.delete(key));
      }
      await Promise.all(usuniecia);
    }catch(error){}
  }
}

function pwaBezpiecznyReloadPoAktualizacji(){
  if(pwaPrzeladowanieWTrakcie)return;
  pwaPrzeladowanieWTrakcie=true;
  setTimeout(()=>{location.reload();},250);
}

function pwaPoczekajNaStanWorkera(worker,oczekiwane=[],timeout=8000){
  if(!worker||oczekiwane.includes(worker.state))return Promise.resolve(worker?.state||"");
  return new Promise(resolve=>{
    let zakonczone=false,timer=0;
    const koniec=()=>{if(zakonczone)return;zakonczone=true;clearTimeout(timer);worker.removeEventListener("statechange",zmiana);resolve(worker.state||"");};
    const zmiana=()=>{if(oczekiwane.includes(worker.state))koniec();};
    timer=setTimeout(koniec,timeout);worker.addEventListener("statechange",zmiana);
  });
}
function pwaPoczekajNaKontroler(timeout=8000){
  return new Promise(resolve=>{
    let zakonczone=false,timer=0;
    const koniec=()=>{if(zakonczone)return;zakonczone=true;clearTimeout(timer);navigator.serviceWorker?.removeEventListener("controllerchange",zmiana);resolve(navigator.serviceWorker?.controller||null);};
    const zmiana=()=>koniec();
    timer=setTimeout(koniec,timeout);navigator.serviceWorker?.addEventListener("controllerchange",zmiana,{once:true});
  });
}
async function pwaPrzygotujWorkerWydania(releaseId){
  if(!("serviceWorker" in navigator)||!window.isSecureContext)return null;
  const version=String(releaseId||pwaBiezaceWydanie()||Date.now());
  const targetUrl=new URL(`/sw.js?v=${encodeURIComponent(version)}`,location.origin).href;
  const controllerBefore=navigator.serviceWorker.controller?.scriptURL||"";
  const controllerChange=controllerBefore===targetUrl?null:pwaPoczekajNaKontroler();
  const registration=await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`,{scope:"/",updateViaCache:"none"});
  await registration.update();
  let worker=registration.waiting||registration.installing;
  if(worker?.state==="installing")await pwaPoczekajNaStanWorkera(worker,["installed","activated","redundant"]);
  worker=registration.waiting||registration.installing||worker;
  if(worker&&worker.state!=="activated"&&worker.state!=="redundant"){
    worker.postMessage({type:"SKIP_WAITING"});
  }
  if(controllerChange&&navigator.serviceWorker.controller?.scriptURL!==targetUrl)await controllerChange;
  return registration;
}
async function pwaUruchomDokladneWydanie(releaseId){
  if(pwaPrzeladowanieWTrakcie)return;
  pwaPrzeladowanieWTrakcie=true;
  const version=String(releaseId||pwaBiezaceWydanie()||Date.now());
  try{
    await pwaOczyscCacheKompletny();
    await pwaPrzygotujWorkerWydania(version);
    sessionStorage.setItem("artway_oczekiwane_wydanie",version);
    const url=new URL(location.href);
    url.searchParams.set("artway_release",version);
    location.replace(`${url.pathname}${url.search}${url.hash}`);
  }catch(error){
    pwaPrzeladowanieWTrakcie=false;
    throw error;
  }
}

function pwaSprawdzOczekiwaneWydanie(){
  let expected="",attempts=0;
  try{
    expected=String(sessionStorage.getItem("artway_oczekiwane_wydanie")||"");
    attempts=Number(sessionStorage.getItem("artway_proby_wydania")||0);
  }catch(error){}
  if(!expected)return true;
  if(expected===pwaBiezaceWydanie()){
    try{
      sessionStorage.removeItem("artway_oczekiwane_wydanie");
      sessionStorage.removeItem("artway_proby_wydania");
    }catch(error){}
    const url=new URL(location.href);
    if(url.searchParams.has("artway_release")){
      url.searchParams.delete("artway_release");
      history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
    }
    return true;
  }
  if(attempts>=2){
    try{sessionStorage.removeItem("artway_proby_wydania");}catch(error){}
    pwaPokazNoweWydanie(expected);
    return true;
  }
  try{sessionStorage.setItem("artway_proby_wydania",String(attempts+1));}catch(error){}
  const url=new URL(location.href);
  url.searchParams.set("artway_release",expected);
  url.searchParams.set("artway_retry",String(attempts+1));
  location.replace(`${url.pathname}${url.search}${url.hash}`);
  return false;
}

function pwaBiezaceWydanie(){return pwaNazwaWersji();}
function pwaMoznaBezpieczniePrzeladowac(){
  const active=document.activeElement;
  return document.visibilityState==="visible"
    && !document.querySelector("dialog[open],.modal.show,[aria-modal='true']")
    && !(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
}
async function pwaAktywujNajnowszeWydanie(releaseId=pwaWykryteWydanie){
  clearTimeout(pwaAutomatycznePrzeladowanie);
  try{
    await pwaUruchomDokladneWydanie(releaseId||pwaBiezaceWydanie());
  }catch(error){console.warn("Nie udało się wyczyścić starej powłoki aplikacji",error);}
}

async function pwaResetCache(){
  await pwaUruchomDokladneWydanie(pwaBiezaceWydanie());
}
function pwaPokazNoweWydanie(releaseId){
  pwaWykryteWydanie=releaseId;
  let bar=document.getElementById("artwayReleaseUpdate");
  if(!bar){
    bar=document.createElement("aside");bar.id="artwayReleaseUpdate";bar.className="artway-release-update";bar.setAttribute("role","status");
    bar.innerHTML=`<span>✨</span><div><b>Nowa wersja panelu jest gotowa</b><small>Serwer opublikował kompletne wydanie. Odświeżenie nie usuwa danych.</small></div><button class="btn" type="button">Uruchom aktualizację</button>`;
    bar.querySelector("button").addEventListener("click",()=>void pwaAktywujNajnowszeWydanie());
    document.body.appendChild(bar);
  }
  clearTimeout(pwaAutomatycznePrzeladowanie);
  pwaAutomatycznePrzeladowanie=setTimeout(()=>{if(pwaWykryteWydanie===releaseId&&pwaMoznaBezpieczniePrzeladowac())void pwaAktywujNajnowszeWydanie();},12000);
}
async function pwaSprawdzNajnowszeWydanie(){
  if(pwaSprawdzanieWydania||document.visibilityState==="hidden")return;
  pwaSprawdzanieWydania=true;
  try{
    const response=await fetch(`/release.json?check=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
    if(!response.ok)return;
    const contentType=String(response.headers.get("content-type")||"").toLowerCase();
    let data=null;
    if(contentType.includes("application/json")||contentType.includes("text/json")){
      data=await response.json();
    }else{
      const raw=await response.text();
      const match=String(raw).match(/"releaseId"\s*:\s*"([^"]+)"/i);
      if(match?.[1]) data={ releaseId: match[1] };
    }
    if(!data)return;
    const releaseId=String(data.releaseId||data.version||"");
    if(releaseId&&releaseId!==pwaBiezaceWydanie())pwaPokazNoweWydanie(releaseId);
    pwaZapiszWersjeWPodsumowaniu(pwaBiezaceWydanie());
  }catch(error){}finally{pwaSprawdzanieWydania=false;}
}

function pwaDzialaJakoAplikacja(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true;
}
function pwaUstawTrybWyswietlania(){const standalone=pwaDzialaJakoAplikacja();document.documentElement.classList.toggle("artway-pwa-standalone",standalone);document.body?.classList.toggle("artway-pwa-standalone",standalone);if(!standalone&&typeof pwaZamknijMenuAdmina==="function")pwaZamknijMenuAdmina();return standalone;}
function pwaIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent||"");}
function pwaPrzyciskInstalacjiHTML(){
  return `<button class="btn ghost admin-pwa-install" type="button" onclick="pwaZainstalujPanelAdmina()" ${pwaDzialaJakoAplikacja()?"hidden":""}>📲 Zainstaluj</button>`;
}
function pwaOdswiezPrzyciski(){
  document.querySelectorAll(".admin-pwa-install").forEach(button=>{button.hidden=pwaDzialaJakoAplikacja();button.classList.toggle("is-ready",!!pwaOdroczoneZaproszenie);});
}
function pwaZamknijInstrukcje(){document.getElementById("adminPwaHelp")?.remove();}
function pwaPokazInstrukcje(){
  pwaZamknijInstrukcje();
  const ios=pwaIOS(),dialog=document.createElement("div");dialog.id="adminPwaHelp";dialog.className="admin-pwa-help";
  dialog.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="adminPwaHelpTitle"><button class="admin-pwa-help-close" type="button" onclick="pwaZamknijInstrukcje()" aria-label="Zamknij">✕</button><span class="admin-pwa-help-icon">📲</span><h2 id="adminPwaHelpTitle">Zainstaluj panel Artway-TM</h2><p>${ios?"W Safari wybierz przycisk <b>Udostępnij</b>, a następnie <b>Do ekranu początkowego</b> i potwierdź <b>Dodaj</b>.":"Otwórz menu przeglądarki i wybierz <b>Zainstaluj aplikację</b> albo <b>Dodaj do ekranu głównego</b>."}</p><small>Po instalacji panel otworzy się jak aplikacja: z własną ikoną, bez paska adresu i ze skrótami do najważniejszych modułów.</small><button class="btn" type="button" onclick="pwaZamknijInstrukcje()">Rozumiem</button></section>`;
  dialog.addEventListener("click",event=>{if(event.target===dialog)pwaZamknijInstrukcje();});document.body.appendChild(dialog);dialog.querySelector("button")?.focus();
}
async function pwaZainstalujPanelAdmina(){
  if(pwaDzialaJakoAplikacja()){toast("Panel jest już uruchomiony jako aplikacja");return;}
  if(!pwaOdroczoneZaproszenie){pwaPokazInstrukcje();return;}
  const prompt=pwaOdroczoneZaproszenie;pwaOdroczoneZaproszenie=null;await prompt.prompt();
  const result=await prompt.userChoice.catch(()=>({outcome:"dismissed"}));
  if(result.outcome==="accepted")toast("✅ Panel Artway-TM został dodany do telefonu");
  pwaOdswiezPrzyciski();
}
async function pwaZarejestrujAplikacje(){
  if(!("serviceWorker" in navigator)||!window.isSecureContext)return;
  try{
    const releaseId=pwaBiezaceWydanie();
    const swUrl=releaseId?`?v=${encodeURIComponent(releaseId)}`:"";
    const registration=await navigator.serviceWorker.register("/sw.js"+swUrl,{scope:"/",updateViaCache:"none"});
    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller) pwaPokazNoweWydanie(pwaBiezaceWydanie());});
    });
    if(registration.waiting)pwaPokazNoweWydanie(pwaBiezaceWydanie());
    navigator.serviceWorker.addEventListener("controllerchange",()=>{pwaBezpiecznyReloadPoAktualizacji();});
  }
  catch(error){console.warn("Nie udało się zarejestrować aplikacji PWA",error);}
}

async function pwaWeryfikujWersjeServiceWorker(releaseId){
  if(!("serviceWorker" in navigator))return;
  const registration=await navigator.serviceWorker.ready;
  const scriptUrl=registration?.active?.scriptURL||registration?.waiting?.scriptURL||registration?.installing?.scriptURL;
  if(!scriptUrl)return;
  const params=new URL(scriptUrl,location.href).searchParams;
  const workerVer=params.get("v")||"";
  if(workerVer&&releaseId&&workerVer!==releaseId){
    pwaZapiszWersjeWPodsumowaniu(releaseId);
    await pwaAktywujNajnowszeWydanie(releaseId);
  }
  pwaZapiszWersjeWPodsumowaniu(releaseId);
}
function pwaUruchomSkrotSkanera(){
  const params=new URLSearchParams(location.search);if(params.get("scanner")!=="1")return;
  let attempts=0;const timer=setInterval(()=>{attempts++;if(typeof magazynGlobalnySkanerOtworz==="function"){clearInterval(timer);params.delete("scanner");const query=params.toString();history.replaceState(null,"",`${location.pathname}${query?`?${query}`:""}${location.hash}`);void magazynGlobalnySkanerOtworz();}else if(attempts>30)clearInterval(timer);},250);
}
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();pwaOdroczoneZaproszenie=event;pwaOdswiezPrzyciski();});
window.addEventListener("appinstalled",()=>{pwaOdroczoneZaproszenie=null;pwaUstawTrybWyswietlania();pwaOdswiezPrzyciski();});
window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change",()=>{pwaUstawTrybWyswietlania();pwaOdswiezPrzyciski();});
window.addEventListener("DOMContentLoaded",()=>{
  if(!pwaSprawdzOczekiwaneWydanie())return;
  pwaUstawTrybWyswietlania();void pwaZarejestrujAplikacje();pwaUruchomSkrotSkanera();
  void pwaWeryfikujWersjeServiceWorker(pwaBiezaceWydanie());
  pwaZapiszWersjeWPodsumowaniu(pwaBiezaceWydanie());
  window.artwayPurgeCache=()=>void pwaResetCache();
  setTimeout(()=>void pwaSprawdzNajnowszeWydanie(),800);
  setInterval(()=>void pwaSprawdzNajnowszeWydanie(),2*60*1000);
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")setTimeout(()=>void pwaSprawdzNajnowszeWydanie(),800);});
window.addEventListener("online",()=>void pwaSprawdzNajnowszeWydanie());
