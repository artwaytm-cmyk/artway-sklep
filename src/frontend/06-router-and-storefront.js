/* ═══════════ ROUTER (podstrony) ═══════════ */
const ADMIN_MODULY_RUNTIME = Object.freeze({
  core:"admin-core",shell:"admin-shell",ui:"admin-ui",agent:"admin-agent",warehouse:"admin-warehouse",shipping:"admin-shipping",commerce:"admin-commerce",communications:"admin-communications",
  inventory:"admin-inventory",catalog:"admin-catalog",personalization:"admin-personalization",system:"admin-system"
});
const ADMIN_STYLE_RUNTIME = Object.freeze({agent:"admin-agent",warehouse:"admin-warehouse",commerce:"admin-commerce"});
const SKLEP_MODULY_RUNTIME = Object.freeze({account:"store-account",content:"store-content"});
const adminZaladowaneModuly = new Set();
const adminObietniceModulow = new Map();
const adminZaladowaneStyle = new Set();
const adminObietniceStyle = new Map();
const sklepZaladowaneModuly = new Set();
const sklepObietniceModulow = new Map();
let adminStylePromise = null;
function identyfikatorZTrasy(route,index){
  const raw=String(route||"").split("/")[index]||"";let decoded=raw;
  try{decoded=decodeURIComponent(raw);}catch(e){}
  return /^(0|[1-9]\d*)$/.test(decoded)?Number(decoded):decoded;
}
function adminModulyDlaTrasy(route=""){
  const t=String(route||"").split("?")[0],moduly=["core","ui"],add=(...items)=>items.forEach(item=>{if(!moduly.includes(item))moduly.push(item);});
  add("shell");
  if((t.startsWith("/admin")||t==="/diagnostyka")&&typeof jestAdmin==="function"&&!jestAdmin()){add("system");return moduly;}
  if(t==="/diagnostyka")add("agent","warehouse","shipping","commerce","communications","inventory","catalog","personalization","system");
  else if(t==="/admin"||t.startsWith("/admin/pulpit"))add("shipping","commerce","communications","inventory","system");
  else if(t.startsWith("/admin/agent-ai"))add("agent","warehouse","commerce","communications","inventory");
  else if(["/admin/magazyn/lokalizacje","/admin/magazyn/etykiety-qr"].includes(t))add("warehouse");
  else if(t==="/admin/magazyn/ruchy")add("warehouse","inventory");
  else if(t==="/admin/magazyn/stany")add("warehouse","commerce","inventory");
  else if(t.startsWith("/admin/magazyn"))add("agent","warehouse","commerce","inventory");
  else if(t.startsWith("/admin/wysylki"))add("agent","warehouse","shipping","commerce","inventory");
  else if(["/admin/allegro/komunikacja","/admin/allegro/wiadomosci","/admin/allegro/dyskusje"].includes(t))add("agent","warehouse","commerce","communications","inventory");
  else if(t.startsWith("/admin/allegro")||t.startsWith("/admin/zamowien")||t.startsWith("/admin/zamowienie/")||t.startsWith("/admin/klient"))add("agent","warehouse","commerce","communications","inventory");
  else if(t.startsWith("/admin/infakt"))add("inventory");
  else if(t==="/admin/asortyment"||t==="/admin/asortyment/produkty")add("commerce","inventory");
  else if(t.startsWith("/admin/produkty/edytuj/")||t==="/admin/produkty/dodaj"||t==="/admin/produkty/z-linku")add("agent","commerce","inventory");
  else if(t.startsWith("/admin/asortyment")||t.startsWith("/admin/produkty")||t==="/admin/kategorie"||t==="/admin/mapowanie"||t==="/admin/opinie"){
    add("commerce","inventory","catalog");
    if(t==="/admin/asortyment/rabaty")add("personalization");
  }
  else if(t.startsWith("/admin/personalizacja")||["/admin/dostawy","/admin/ustawienia","/admin/wyglad","/admin/rozmieszczenie","/admin/bannery","/admin/podstrony","/admin/strony","/admin/rabaty"].includes(t)){
    add("personalization");
    if(t==="/admin/personalizacja/rozmieszczenie"||t==="/admin/rozmieszczenie")add("catalog");
  }
  else if(t.startsWith("/admin/eksport"))add("inventory","catalog","personalization");
  else if(t.startsWith("/admin/aktualizacja"))add("personalization");
  else if(t.startsWith("/admin/publikacja"))add("inventory","personalization");
  else if(t.startsWith("/admin/seo"))add("inventory");
  else if(t.startsWith("/admin"))add("agent","warehouse","commerce","inventory","catalog","personalization","system");
  return moduly;
}
function sklepModulyDlaTrasy(route=""){
  const t=String(route||"").split("?")[0];
  if(["/logowanie","/rejestracja","/konto","/zamowienia"].includes(t)||t.startsWith("/dziekujemy/"))return ["account"];
  if(["/ulubione","/kontakt","/o-nas","/faq","/regulamin","/prywatnosc","/dostawa","/zwroty"].includes(t))return ["content"];
  return [];
}
function sklepModulyTrasyGotowe(route=""){return sklepModulyDlaTrasy(route).every(modul=>sklepZaladowaneModuly.has(modul));}
function zaladujSklepModul(modul,version){
  if(sklepZaladowaneModuly.has(modul))return Promise.resolve();
  if(sklepObietniceModulow.has(modul))return sklepObietniceModulow.get(modul);
  const asset=SKLEP_MODULY_RUNTIME[modul];if(!asset)return Promise.reject(new Error(`Nieznany moduł sklepu: ${modul}`));
  const promise=new Promise((resolve,reject)=>{const script=document.createElement("script");script.id=`artwayStoreModule-${modul}`;script.src=`/assets/${asset}.js?v=${encodeURIComponent(version)}`;script.async=false;script.onload=()=>{sklepZaladowaneModuly.add(modul);resolve();};script.onerror=()=>reject(new Error(`Nie udało się wczytać podstrony sklepu: ${modul}`));document.body.appendChild(script);}).catch(error=>{sklepObietniceModulow.delete(modul);document.getElementById(`artwayStoreModule-${modul}`)?.remove();throw error;});
  sklepObietniceModulow.set(modul,promise);return promise;
}
function adminModulyTrasyGotowe(route=""){return adminModulyDlaTrasy(route).every(modul=>adminZaladowaneModuly.has(modul));}
function zaladujAdminStyle(version){
  if(adminStylePromise)return adminStylePromise;
  adminStylePromise=new Promise((resolve,reject)=>{
    const obecny=document.getElementById("artwayAdminStyles");
    if(obecny){if(obecny.sheet)resolve();else{obecny.addEventListener("load",resolve,{once:true});obecny.addEventListener("error",()=>reject(new Error("Nie udało się wczytać stylów panelu administratora")),{once:true});}return;}
    const link=document.createElement("link");link.id="artwayAdminStyles";link.rel="stylesheet";link.href=`/assets/admin.css?v=${encodeURIComponent(version)}`;
    link.onload=()=>resolve();link.onerror=()=>reject(new Error("Nie udało się wczytać stylów panelu administratora"));document.head.appendChild(link);
  }).catch(error=>{adminStylePromise=null;throw error;});
  return adminStylePromise;
}
function zaladujAdminModul(modul,version){
  if(adminZaladowaneModuly.has(modul))return Promise.resolve();
  if(adminObietniceModulow.has(modul))return adminObietniceModulow.get(modul);
  const asset=ADMIN_MODULY_RUNTIME[modul];
  if(!asset)return Promise.reject(new Error(`Nieznany moduł panelu: ${modul}`));
  const promise=new Promise((resolve,reject)=>{
    const id=`artwayAdminModule-${modul}`,obecny=document.getElementById(id);
    if(obecny){obecny.addEventListener("load",()=>{adminZaladowaneModuly.add(modul);resolve();},{once:true});obecny.addEventListener("error",()=>reject(new Error(`Nie udało się wczytać modułu ${modul}`)),{once:true});return;}
    const script=document.createElement("script");script.id=id;script.src=`/assets/${asset}.js?v=${encodeURIComponent(version)}`;script.async=false;
    script.onload=()=>{adminZaladowaneModuly.add(modul);if(modul==="core")window.__artwayAdminReady=true;resolve();};
    script.onerror=()=>reject(new Error(`Nie udało się wczytać modułu panelu: ${modul}`));document.body.appendChild(script);
  }).catch(error=>{adminObietniceModulow.delete(modul);document.getElementById(`artwayAdminModule-${modul}`)?.remove();throw error;});
  adminObietniceModulow.set(modul,promise);return promise;
}
function zaladujAdminStyleModul(modul,version){
  const asset=ADMIN_STYLE_RUNTIME[modul];if(!asset||adminZaladowaneStyle.has(modul))return Promise.resolve();
  if(adminObietniceStyle.has(modul))return adminObietniceStyle.get(modul);
  const promise=new Promise((resolve,reject)=>{const link=document.createElement("link");link.id=`artwayAdminStyle-${modul}`;link.rel="stylesheet";link.href=`/assets/${asset}.css?v=${encodeURIComponent(version)}`;link.onload=()=>{adminZaladowaneStyle.add(modul);resolve();};link.onerror=()=>reject(new Error(`Nie udało się wczytać stylów modułu ${modul}`));document.head.appendChild(link);}).catch(error=>{adminObietniceStyle.delete(modul);document.getElementById(`artwayAdminStyle-${modul}`)?.remove();throw error;});
  adminObietniceStyle.set(modul,promise);return promise;
}
function zaladujPanelAdmina(route=trasa()){
  const version = document.querySelector('meta[name="artway-version"]')?.content || "dev";
  const modules=adminModulyDlaTrasy(route);
  const core=modules.includes("core")?zaladujAdminModul("core",version):Promise.resolve();
  const scripts=core.then(()=>Promise.all(modules.filter(module=>module!=="core").map(module=>zaladujAdminModul(module,version))));
  const styles=Promise.all(modules.map(module=>zaladujAdminStyleModul(module,version)));
  return Promise.all([zaladujAdminStyle(version),styles,scripts]).then(result=>{if(typeof zaplanujWstepneLadowaniePanelu==="function")zaplanujWstepneLadowaniePanelu(version);return result;});
}
function trasa(){
  const path=String(location.pathname||"").replace(/\/+$/,"")||"/";
  if(location.hash)return location.hash.replace(/^#/,"").split("?")[0]||"/";
  if(/^\/(?:produkt|kategoria)\/[^/]+$/i.test(path)||["/promocje","/nowosci"].includes(path))return path;
  return "/";
}
function seoSlugKategorii(value=""){return String(value||"").toLocaleLowerCase("pl-PL").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"produkty";}
function przejdzDoSklepu(path="/"){history.pushState(null,"",path);renderuj();requestAnimationFrame(()=>$("widok")?.focus({preventScroll:true}));}
function nawigujSklep(event,path="/"){if(event&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0))return true;event?.preventDefault?.();przejdzDoSklepu(path);return false;}
function parametryTrasy(){try{return new URLSearchParams(String(location.hash||"").split("?")[1]||"");}catch(e){return new URLSearchParams();}}
let ostatniaRenderowanaTrasa="";
let renderowanieWidoku=false;
let renderPonowniePoBiezacym=false;
let renderTimerWpisywania=null;
let renderFrameWpisywania=0;
function zaplanujRenderPoWpisaniu(opoznienie=180){
  clearTimeout(renderTimerWpisywania);
  if(renderFrameWpisywania)cancelAnimationFrame(renderFrameWpisywania);
  renderTimerWpisywania=setTimeout(()=>{
    renderFrameWpisywania=requestAnimationFrame(()=>{renderFrameWpisywania=0;renderuj();});
  },Math.max(80,Number(opoznienie)||180));
}
function adminTrasaCacheowalna(route=""){
  const value=String(route||"");
  return value.startsWith("/admin")&&!value.startsWith("/admin/zamowienie/")&&!value.startsWith("/admin/produkty/edytuj/")&&!value.startsWith("/admin/produkty/dodaj")&&!value.startsWith("/admin/produkty/z-linku");
}
function adminKontenerTresci(shell){return shell?.querySelector(":scope > .admin-tresc")||null;}
function adminTrescBezposrednia(shell){return adminKontenerTresci(shell)?.querySelector(":scope > .admin-workspace-content")||null;}
function adminLiczbaWezlowCache(){let total=0;for(const entry of adminCachePodstron.values())total+=Number(entry?.nodes)||0;return total;}
function adminZapiszPodstroneWCache(root,route){
  if(!adminTrasaCacheowalna(route)||!root)return false;
  const shell=root.querySelector(":scope > .admin-page"),workspace=adminTrescBezposrednia(shell);
  if(!shell||!workspace)return false;
  const nodes=workspace.getElementsByTagName("*").length;
  if(nodes>ADMIN_CACHE_PODSTRON_MAX_WEZLOW)return false;
  adminCachePodstron.delete(route);
  workspace.remove();
  const domains=adminDomenyCacheDlaTrasy(route);
  adminCachePodstron.set(route,{workspace,nodes,header:shell.querySelector(":scope > .admin-tresc > .admin-workspace-header")?.cloneNode(true)||null,mobile:shell.querySelector(":scope > .admin-tresc > .admin-mobile-menu")?.cloneNode(true)||null,domains,signature:adminSygnaturaCacheTrasy(route),scrollY:window.scrollY||0,savedAt:Date.now()});
  while(adminCachePodstron.size>ADMIN_CACHE_PODSTRON_LIMIT||adminLiczbaWezlowCache()>ADMIN_CACHE_PODSTRON_MAX_LACZNIE)adminCachePodstron.delete(adminCachePodstron.keys().next().value);
  return true;
}
function adminAktualizujAktywnaNawigacje(shell,route){
  const nav=shell?.querySelector(".admin-nav");if(!nav)return;
  shell.querySelectorAll(".admin-nav .admin-nav-link[href],.pwa-admin-bottom-nav a[href]").forEach(link=>{
    const href=String(link.getAttribute("href")||"").replace(/^#/,"");
    const active=typeof adminMenuPozycjaAktywna==="function"?adminMenuPozycjaAktywna(route,href):route===href;
    link.classList.toggle("active",active);if(active)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
  });
  const open=typeof adminMenuOtwartaGrupa==="function"?adminMenuOtwartaGrupa():"";
  nav.querySelectorAll(".admin-nav-group").forEach(group=>{
    const active=!!group.querySelector(".admin-nav-link.active"),expanded=active||String(group.dataset.adminMenuGroup||"")===String(open||"");
    group.classList.toggle("is-active",active);group.classList.toggle("collapsed",!expanded);
    group.querySelector(".admin-nav-group-toggle")?.setAttribute("aria-expanded",String(expanded));
  });
}
function adminPrzywrocPodstroneZCache(root,route){
  const entry=adminCachePodstron.get(route);if(!entry)return false;
  adminCachePodstron.delete(route);
  if(entry.signature!==adminSygnaturaCacheTrasy(route))return false;
  const shell=root?.querySelector(":scope > .admin-page");if(!shell)return false;
  const container=adminKontenerTresci(shell),current=adminTrescBezposrednia(shell);if(!container)return false;
  if(current)current.replaceWith(entry.workspace);else container.appendChild(entry.workspace);
  const currentHeader=container.querySelector(":scope > .admin-workspace-header");if(entry.header&&currentHeader)aktualizujWezelStabilnie(currentHeader,entry.header,document.activeElement);
  const currentMobile=container.querySelector(":scope > .admin-mobile-menu");if(entry.mobile&&currentMobile)aktualizujWezelStabilnie(currentMobile,entry.mobile,document.activeElement);
  adminAktualizujAktywnaNawigacje(shell,route);adminAktualizujPrzyciskHistorii(shell);
  requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,Number(entry.scrollY)||0),behavior:"instant"}));
  return true;
}
function kluczStabilnegoWezla(node){
  if(!node||node.nodeType!==1)return "";
  for(const attr of ["id","data-stable-key","data-product-row","data-product-id","data-order-id","data-order-number","data-task-id","data-item-key"]){
    const value=node.getAttribute(attr);if(value)return `${node.tagName}:${attr}:${value}`;
  }
  return "";
}
function aktualizujAtrybutyWezla(current,next,active){
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
  for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  const focused=current===active;
  if(current instanceof HTMLInputElement){
    if(["checkbox","radio"].includes(current.type)){if(!focused)current.checked=next.checked;}
    else if(!focused)current.value=next.value;
  }else if(current instanceof HTMLTextAreaElement){if(!focused)current.value=next.value;}
  else if(current instanceof HTMLSelectElement){if(!focused)current.value=next.value;}
  else if(current instanceof HTMLDetailsElement)current.open=next.open;
}
function aktualizujWezelStabilnie(current,next,active){
  if(!current||!next)return;
  if(current.nodeType!==next.nodeType||(current.nodeType===1&&current.tagName!==next.tagName)){
    current.replaceWith(next.cloneNode(true));return;
  }
  if(current.nodeType===3||current.nodeType===8){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  if(current.nodeType!==1)return;
  if(current!==active&&typeof current.isEqualNode==="function"&&current.isEqualNode(next))return;
  aktualizujAtrybutyWezla(current,next,active);
  aktualizujDzieciStabilnie(current,next,active);
}
function aktualizujDzieciStabilnie(current,next,active){
  const incoming=[...next.childNodes];
  const keyed=new Map();
  for(const node of current.childNodes){const key=kluczStabilnegoWezla(node);if(key&&!keyed.has(key))keyed.set(key,node);}
  for(let index=0;index<incoming.length;index++){
    const wanted=incoming[index],wantedKey=kluczStabilnegoWezla(wanted);let existing=current.childNodes[index];
    if(wantedKey&&kluczStabilnegoWezla(existing)!==wantedKey){
      const match=keyed.get(wantedKey);
      if(match){current.insertBefore(match,existing||null);existing=match;}
    }
    if(wantedKey)keyed.delete(wantedKey);
    if(!existing){current.appendChild(wanted.cloneNode(true));continue;}
    aktualizujWezelStabilnie(existing,wanted,active);
  }
  while(current.childNodes.length>incoming.length)current.lastChild.remove();
}
function aktualizujWidokStabilnie(root,html){
  const template=document.createElement("template");template.innerHTML=String(html||"").trim();
  const active=document.activeElement,scrollY=window.scrollY||0,selection=active&&typeof active.selectionStart==="number"?{start:active.selectionStart,end:active.selectionEnd}:null;
  aktualizujDzieciStabilnie(root,template.content,active);
  if(active?.isConnected&&selection&&typeof active.setSelectionRange==="function")try{active.setSelectionRange(selection.start,selection.end);}catch(e){}
  if(Math.abs((window.scrollY||0)-scrollY)>1)window.scrollTo({top:scrollY,behavior:"instant"});
}
function aktualizujPanelAdminaStabilnie(root,html,taSamaTrasa=false){
  const template=document.createElement("template");template.innerHTML=String(html||"").trim();
  const next=[...template.content.children].find(node=>node.classList?.contains("admin-page"))||null,current=root.querySelector(":scope > .admin-page");
  if(!next||!current)return false;
  aktualizujAtrybutyWezla(current,next,document.activeElement);
  const currentNav=current.querySelector(":scope > .admin-nav"),nextNav=next.querySelector(":scope > .admin-nav");
  if(currentNav&&nextNav)aktualizujWezelStabilnie(currentNav,nextNav,document.activeElement);
  const currentBottom=current.querySelector(":scope > .pwa-admin-bottom-nav"),nextBottom=next.querySelector(":scope > .pwa-admin-bottom-nav");
  if(currentBottom&&nextBottom)aktualizujWezelStabilnie(currentBottom,nextBottom,document.activeElement);
  const currentContainer=adminKontenerTresci(current),nextContainer=adminKontenerTresci(next);
  const currentMobile=currentContainer?.querySelector(":scope > .admin-mobile-menu"),nextMobile=nextContainer?.querySelector(":scope > .admin-mobile-menu");
  if(currentMobile&&nextMobile)aktualizujWezelStabilnie(currentMobile,nextMobile,document.activeElement);
  const currentHeader=currentContainer?.querySelector(":scope > .admin-workspace-header"),nextHeader=nextContainer?.querySelector(":scope > .admin-workspace-header");
  if(currentHeader&&nextHeader)aktualizujWezelStabilnie(currentHeader,nextHeader,document.activeElement);
  const nextWorkspace=adminTrescBezposrednia(next),currentWorkspace=adminTrescBezposrednia(current);
  if(nextWorkspace){
    if(currentWorkspace&&taSamaTrasa)aktualizujWezelStabilnie(currentWorkspace,nextWorkspace,document.activeElement);
    else if(currentWorkspace)currentWorkspace.replaceWith(nextWorkspace.cloneNode(true));
    else currentContainer?.appendChild(nextWorkspace.cloneNode(true));
  }
  return true;
}
function odbiorcaStabilnegoWidoku(root,stabilny,panelAdmin=false,taSamaTrasa=false){
  if(!stabilny&&!panelAdmin)return root;
  return {get innerHTML(){return root.innerHTML;},set innerHTML(html){
    if(panelAdmin&&aktualizujPanelAdminaStabilnie(root,html,taSamaTrasa))return;
    if(stabilny)aktualizujWidokStabilnie(root,html);else root.innerHTML=html;
  }};
}
function renderuj(){
  if(renderowanieWidoku){renderPonowniePoBiezacym=true;return;}
  renderowanieWidoku=true;
  try{
    const t = trasa();
    const root = $("widok"),poprzedniaTrasa=ostatniaRenderowanaTrasa,taSamaTrasa=ostatniaRenderowanaTrasa===t&&root.childNodes.length>0;
    const przejsciePanelu=!taSamaTrasa&&t.startsWith("/admin")&&poprzedniaTrasa.startsWith("/admin")&&root.childNodes.length>0;
    if(przejsciePanelu){
      adminZapiszPodstroneWCache(root,poprzedniaTrasa);
      if(adminPrzywrocPodstroneZCache(root,t)){
        document.body.classList.add("admin-mode");seoAktualizujMetaDlaTrasy(t);ostatniaRenderowanaTrasa=t;return;
      }
    }
    const panelAdmin=t.startsWith("/admin")&&poprzedniaTrasa.startsWith("/admin")&&root.querySelector(":scope > .admin-page");
    const wStabilny = odbiorcaStabilnegoWidoku(root,taSamaTrasa);
    const w = panelAdmin?odbiorcaStabilnegoWidoku(root,true,true,taSamaTrasa):wStabilny;
    // Moduł panelu zawiera także bezpieczny widok „Brak dostępu”. Ładujemy go
    // wyłącznie po wejściu na trasę administracyjną, również dla gościa.
    const wymagaPanelu=t.startsWith("/admin")||t==="/diagnostyka";
    document.body.classList.toggle("admin-mode",wymagaPanelu);
    if(!wymagaPanelu&&!sklepModulyTrasyGotowe(t)){
      w.innerHTML=`<div class="page"><div class="panel admin-loading" role="status" aria-live="polite"><h1>Ładowanie podstrony…</h1><p>Wczytuję tylko funkcje potrzebne w tym miejscu sklepu.</p></div></div>`;
      const trasaLadowania=t,version=document.querySelector('meta[name="artway-version"]')?.content||"dev";
      Promise.all(sklepModulyDlaTrasy(t).map(modul=>zaladujSklepModul(modul,version))).then(()=>{if(trasa()===trasaLadowania)renderuj();}).catch(error=>{loguj("blad",error.message,t);w.innerHTML=`<div class="page"><div class="panel"><h1>Nie udało się wczytać podstrony</h1><p>${esc(error.message)}</p><button class="btn" onclick="renderuj()">Spróbuj ponownie</button></div></div>`;});
      ostatniaRenderowanaTrasa=t;return;
    }
    if(wymagaPanelu&&!adminModulyTrasyGotowe(t)){
      w.innerHTML=`<div class="page"><div class="panel admin-loading" role="status" aria-live="polite"><h1>Ładowanie panelu administratora…</h1><p>Wczytuję moduły potrzebne tylko do obsługi sklepu.</p></div></div>`;
      const trasaLadowania=t;
      zaladujPanelAdmina(t).then(()=>{if(trasa()===trasaLadowania)renderuj();}).catch(error=>{
        loguj("blad",error.message,t);
        w.innerHTML=`<div class="page"><div class="panel"><h1>Nie udało się wczytać panelu</h1><p>${esc(error.message)}</p><button class="btn" onclick="renderuj()">Spróbuj ponownie</button></div></div>`;
      });
      ostatniaRenderowanaTrasa=t;return;
    }
    if(t.startsWith("/admin/zamowienie/")&&!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
    if((t==="/admin/zamowienia"||t.startsWith("/admin/zamowienie/"))&&typeof odswiezZamowieniaAdminaPoWejsciu==="function")setTimeout(()=>odswiezZamowieniaAdminaPoWejsciu(),0);
    else if(t.startsWith("/admin")&&maUprawnieniaZapisuChmury()&&!stanBazyCentralnej.sprawdzono&&!stanBazyCentralnej.synchronizacja)setTimeout(()=>automatycznaSynchronizacjaChmury("admin-route"),0);
    if(!taSamaTrasa)window.scrollTo({top:0,behavior:"instant"});
    if(t==="/" || t==="") w.innerHTML = widokSklep();
    else if(t.startsWith("/produkt/")) w.innerHTML = widokProdukt(identyfikatorZTrasy(t,2));
    else if(t.startsWith("/kategoria/")) w.innerHTML = widokKategoria(decodeURIComponent(t.split("/")[2]||""));
    else if(t==="/promocje") w.innerHTML = widokListaSpecjalna("🔥 Promocje", p=>p.staraCena, "Aktualnie nie mamy promocji — zajrzyj wkrótce!");
    else if(t==="/nowosci") w.innerHTML = widokListaSpecjalna("✨ Nowości", p=>p.badge==="Nowość", "Brak nowości w tej chwili — zajrzyj wkrótce!");
    else if(t==="/logowanie") w.innerHTML = widokLogowanie();
    else if(t==="/rejestracja") w.innerHTML = widokRejestracja();
	    else if(t==="/konto") w.innerHTML = widokKonto();
	    else if(t==="/zamowienia") w.innerHTML = widokZamowienia();
	    else if(t.startsWith("/dziekujemy/")) w.innerHTML = widokDziekujemy(decodeURIComponent(t.split("/")[2]||""));
	    else if(t==="/ulubione") w.innerHTML = widokUlubione();
    else if(t==="/kontakt") w.innerHTML = widokKontakt();
    else if(t==="/o-nas") w.innerHTML = widokONas();
    else if(t==="/faq") w.innerHTML = widokFAQ();
    else if(t==="/regulamin") w.innerHTML = widokRegulamin();
    else if(t==="/prywatnosc") w.innerHTML = widokPrywatnosc();
    else if(t==="/dostawa") w.innerHTML = widokDostawa();
    else if(t==="/zwroty") w.innerHTML = widokZwroty();
    else if(t==="/diagnostyka") w.innerHTML = jestAdmin() ? widokDiagnostyka() : widokBrakDostepu();
    else if(t.startsWith("/admin") ){
      if(!jestAdmin()) w.innerHTML = widokBrakDostepu();
      else if(t==="/admin" || t==="/admin/pulpit") w.innerHTML = widokAdmin("pulpit");
      else if(t.startsWith("/admin/pulpit/")) w.innerHTML = widokAdmin(t.split("/")[3]||"pulpit");
      else if(t==="/admin/zamowienia") w.innerHTML = widokAdminZamowienia();
      else if(t==="/admin/zamowienia/tabela"){
        history.replaceState(null,"",`${location.pathname}${location.search}#/admin/magazyn/plan`);
        w.innerHTML = widokAdminMagazyn("plan");
      }
      else if(t.startsWith("/admin/zamowienie/")) w.innerHTML = widokAdminZamowienie(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/allegro") w.innerHTML = widokAdminAllegro();
      else if(t==="/admin/allegro/zamowienia") w.innerHTML = widokAdminAllegro("zamowienia");
      else if(t==="/admin/allegro/oferty") w.innerHTML = widokAdminAllegro("oferty");
      else if(t==="/admin/allegro/wystawianie") w.innerHTML = widokAdminAllegro("wystawianie");
      else if(t==="/admin/allegro/rentownosc") w.innerHTML = widokAdminAllegro("rentownosc");
      else if(t==="/admin/allegro/komunikacja" || t==="/admin/allegro/wiadomosci") w.innerHTML = widokAdminAllegro("wiadomosci");
      else if(t==="/admin/allegro/dyskusje") w.innerHTML = widokAdminAllegro("dyskusje");
      else if(t==="/admin/allegro/zgodnosc") w.innerHTML = widokAdminAllegro("zgodnosc");
      else if(t==="/admin/allegro/ustawienia") w.innerHTML = widokAdminAllegro("ustawienia");
      else if(t==="/admin/wysylki") w.innerHTML = widokAdminWysylki("zlecenia");
      else if(t.startsWith("/admin/wysylki/")) w.innerHTML = widokAdminWysylki(t.split("/")[3]||"zlecenia");
      else if(t==="/admin/magazyn") w.innerHTML = widokAdminMagazyn("pulpit");
      else if(t.startsWith("/admin/magazyn/")) w.innerHTML = widokAdminMagazyn(t.split("/")[3]||"pulpit");
      else if(t==="/admin/infakt") w.innerHTML = widokAdminInfakt("pulpit");
      else if(t.startsWith("/admin/infakt/")) w.innerHTML = widokAdminInfakt(t.split("/")[3]||"pulpit");
      else if(t==="/admin/agent-ai/zlecenia"){
        history.replaceState(null,"",`${location.pathname}${location.search}#/admin/magazyn/plan`);
        w.innerHTML = widokAdminMagazyn("plan");
      }
      else if(t==="/admin/agent-ai"){
        w.innerHTML = widokAdminAgentAI("pulpit");
        if(!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
        if(!agentAIPlanStan.history.length&&!agentAIPlanStan.historyLoading) setTimeout(()=>agentAIPobierzHistorieWykonan(true),0);
      }
      else if(t.startsWith("/admin/agent-ai/")){
        w.innerHTML = widokAdminAgentAI(t.split("/")[3]||"pulpit");
        if(!stanBramki.sprawdzono) setTimeout(()=>sprawdzBramke(true),0);
        if(!agentAIPlanStan.history.length&&!agentAIPlanStan.historyLoading) setTimeout(()=>agentAIPobierzHistorieWykonan(true),0);
      }
      else if(t==="/admin/seo") w.innerHTML = widokAdminSEO("pulpit");
      else if(t.startsWith("/admin/seo/")) w.innerHTML = widokAdminSEO(t.split("/")[3]||"pulpit");
      else if(t.startsWith("/admin/asortyment/")){
        const s=t.split("/")[3]||"produkty";
        w.innerHTML = s==="jakosc"?widokAdminJakoscKatalogu():s==="kategorie"?widokAdminKategorie():s==="mapowanie"?widokAdminMapowanie():s==="rabaty"?widokAdminRabatyZaawansowane():s==="opinie"?widokAdminOpinie():widokAdminProdukty();
      }
      else if(t.startsWith("/admin/personalizacja/")){
        const s=t.split("/")[3]||"home";
        w.innerHTML = s==="home"?widokAdminStronaGlowna():s==="rozmieszczenie"?widokAdminRozmieszczenie():s==="bannery"?widokAdminBanneryZaawansowane():s==="ikony"?widokAdminIkonyAI():s==="podstrony"?widokAdminPodstrony():s==="strony"?widokAdminStrony():s==="dostawy"?widokAdminDostawy():widokAdminWyglad();
      }
      else if(t==="/admin/asortyment" || t==="/admin/produkty") w.innerHTML = widokAdminProdukty();
      else if(t==="/admin/produkty/dodaj") w.innerHTML = widokAdminProduktyDodaj();
      else if(t==="/admin/produkty/z-linku") w.innerHTML = widokAdminProduktyZLinku();
      else if(t==="/admin/produkty/z-pliku") w.innerHTML = widokAdminProduktyZPliku();
      else if(t.startsWith("/admin/produkty/edytuj/")) w.innerHTML = widokAdminProduktEdytuj(identyfikatorZTrasy(t,4));
      else if(t==="/admin/kategorie") w.innerHTML = widokAdminKategorie();
      else if(t==="/admin/mapowanie") w.innerHTML = widokAdminMapowanie();
      else if(t==="/admin/klienci") w.innerHTML = widokAdminKlienci("lista");
      else if(t.startsWith("/admin/klienci/")) w.innerHTML = widokAdminKlienci(t.split("/")[3]||"lista");
      else if(t.startsWith("/admin/klient/")) w.innerHTML = widokAdminKlient(decodeURIComponent(t.split("/")[3]||""));
      else if(t==="/admin/rabaty") w.innerHTML = widokAdminRabatyZaawansowane();
      else if(t==="/admin/opinie") w.innerHTML = widokAdminOpinie();
      else if(t==="/admin/dostawy" || t==="/admin/ustawienia") w.innerHTML = widokAdminDostawy();
      else if(t==="/admin/personalizacja") w.innerHTML = widokAdminStronaGlowna();
      else if(t==="/admin/wyglad") w.innerHTML = widokAdminWyglad();
      else if(t==="/admin/rozmieszczenie") w.innerHTML = widokAdminRozmieszczenie();
      else if(t==="/admin/bannery") w.innerHTML = widokAdminBanneryZaawansowane();
      else if(t==="/admin/podstrony") w.innerHTML = widokAdminPodstrony();
      else if(t==="/admin/strony") w.innerHTML = widokAdminStrony();
      else if(t==="/admin/eksport") w.innerHTML = widokAdminEksport("import");
      else if(t.startsWith("/admin/eksport/")) { const s=t.split("/")[3]||"import"; w.innerHTML = s==="aktualizacja"?widokAdminAktualizacja("status"):widokAdminEksport(s); }
      else if(t==="/admin/aktualizacja") w.innerHTML = widokAdminAktualizacja("status");
      else if(t.startsWith("/admin/aktualizacja/")) w.innerHTML = widokAdminAktualizacja(t.split("/")[3]||"status");
      else if(t==="/admin/publikacja") w.innerHTML = widokAdminPublikacja("kontrola");
      else if(t.startsWith("/admin/publikacja/")) { const s=t.split("/")[3]||"kontrola"; w.innerHTML = s==="aktualizacja"?widokAdminAktualizacja("status"):widokAdminPublikacja(s); }
      else w.innerHTML = widokAdmin();
    }
    else w.innerHTML = `<div class="page"><div class="panel"><h1>404 — nie ma takiej strony 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
    if(t==="/"||t==="") { rysujChipy(); rysuj(); }
    seoAktualizujMetaDlaTrasy(t);
    if(typeof seoSledzTrase==="function")seoSledzTrase(t);
    if(t==="/admin/aktualizacja"&&!stanAktualizacji.sprawdzono&&!stanAktualizacji.ladowanie) setTimeout(()=>sprawdzStatusAktualizacji(true),0);
    ostatniaRenderowanaTrasa=t;
  }catch(e){
    loguj("blad", "Błąd renderowania strony: "+e.message, trasa());
    $("widok").innerHTML = `<div class="page"><div class="panel"><h1>⚠️ Coś poszło nie tak</h1><p>Błąd został zapisany w <a href="#/diagnostyka">diagnostyce</a>.</p><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
  }finally{
    renderowanieWidoku=false;
    odswiezZnacznikDiag();
    if(renderPonowniePoBiezacym){renderPonowniePoBiezacym=false;requestAnimationFrame(()=>renderuj());}
  }
}
window.addEventListener("hashchange",()=>{if(typeof adminZarejestrujTrase==="function")adminZarejestrujTrase(trasa());renderuj();requestAnimationFrame(()=>$("widok")?.focus({preventScroll:true}));});
window.addEventListener("popstate",()=>{renderuj();requestAnimationFrame(()=>$("widok")?.focus({preventScroll:true}));});

/* ═══════════ WIDOK: SKLEP (strona główna) ═══════════ */
