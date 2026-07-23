/* Instalowalny panel administratora (PWA). Aplikacja używa dokładnie tego
   samego panelu i API co strona, dlatego nie tworzy drugiej kopii danych. */
let pwaOdroczoneZaproszenie=null;
let pwaSprawdzanieWydania=false;
let pwaWykryteWydanie="";
let pwaAutomatycznePrzeladowanie=0;

function pwaBiezaceWydanie(){return document.querySelector('meta[name="artway-version"]')?.content||"dev";}
function pwaMoznaBezpieczniePrzeladowac(){
  const active=document.activeElement;
  return document.visibilityState==="visible"
    && !document.querySelector("dialog[open],.modal.show,[aria-modal='true']")
    && !(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
}
async function pwaAktywujNajnowszeWydanie(){
  clearTimeout(pwaAutomatycznePrzeladowanie);
  try{
    if("serviceWorker" in navigator){
      const registration=await navigator.serviceWorker.getRegistration("/");
      await registration?.update();
      registration?.waiting?.postMessage({type:"SKIP_WAITING"});
      registration?.active?.postMessage({type:"CLEAR_APP_CACHE"});
    }
    if("caches" in window){const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith("artway-")).map(key=>caches.delete(key)));}
  }catch(error){console.warn("Nie udało się wyczyścić starej powłoki aplikacji",error);}
  location.reload();
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
    const data=await response.json(),releaseId=String(data.releaseId||data.version||"");
    if(releaseId&&releaseId!==pwaBiezaceWydanie())pwaPokazNoweWydanie(releaseId);
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
  try{await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});}
  catch(error){console.warn("Nie udało się zarejestrować aplikacji PWA",error);}
}
function pwaUruchomSkrotSkanera(){
  const params=new URLSearchParams(location.search);if(params.get("scanner")!=="1")return;
  let attempts=0;const timer=setInterval(()=>{attempts++;if(typeof magazynGlobalnySkanerOtworz==="function"){clearInterval(timer);params.delete("scanner");const query=params.toString();history.replaceState(null,"",`${location.pathname}${query?`?${query}`:""}${location.hash}`);void magazynGlobalnySkanerOtworz();}else if(attempts>30)clearInterval(timer);},250);
}
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();pwaOdroczoneZaproszenie=event;pwaOdswiezPrzyciski();});
window.addEventListener("appinstalled",()=>{pwaOdroczoneZaproszenie=null;pwaUstawTrybWyswietlania();pwaOdswiezPrzyciski();});
window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change",()=>{pwaUstawTrybWyswietlania();pwaOdswiezPrzyciski();});
window.addEventListener("DOMContentLoaded",()=>{
  pwaUstawTrybWyswietlania();void pwaZarejestrujAplikacje();pwaUruchomSkrotSkanera();
  setTimeout(()=>void pwaSprawdzNajnowszeWydanie(),15000);
  setInterval(()=>void pwaSprawdzNajnowszeWydanie(),2*60*1000);
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")setTimeout(()=>void pwaSprawdzNajnowszeWydanie(),800);});
window.addEventListener("online",()=>void pwaSprawdzNajnowszeWydanie());
