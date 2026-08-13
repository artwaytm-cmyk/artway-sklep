/* GENERATED ADMIN UI — shared responsive tables and filters */
(function uruchomResponsywnyPanelAdmina(){
  let zaplanowane=false;
  const zakresy=new Set();
  const bezpiecznyTekst=(value)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,120);
  const selektorTabel='.admin-tresc table,.modal table,.drawer table';
  const selektorFiltrow=[
    '.orders-toolbar','.allegro-communication-toolbar','.profitability-controls',
    '.supplier-monitor-toolbar','.supplier-plan-filters','.warehouse-stock-toolbar',
    '.warehouse-document-filters','.warehouse-movement-toolbar','.warehouse-tree-filters',
    '.warehouse-qr-toolbar','.catalog-quality-toolbar','.product-link-import-filters',
    '.dashboard-alert-filters',
    '.seo-advanced-toolbar','.profitability-review-toolbar','.diag-toolbar',
  ].map((item)=>`.admin-tresc ${item}`).join(',');
  const selektorHero=[
    '.allegro-listing-hero','.assortment-catalog-hero','.warehouse-page-context',
    '.orders-command-hero','.orders-hero','.shipping-page-context','.ai-agent-hero','.home-editor-head',
    '.banner-workspace-head','.discount-workspace-head','.catalog-quality-hero',
    '.dashboard-hero','.agent-command-hero','.agent-command-center','.warehouse-qr-hero',
    '.product-link-import-hero','.product-editor-hero','.seo-control-hero',
    '.system-release-hero','.von-halsky-workspace-head',
  ].join(',');
  const selektorMetryk=[
    '.allegro-listing-metrics','.orders-stat-grid','.stat-grid','.info-grid',
    '.supplier-monitor-stats','.product-link-import-stats',
    '.agent-command-metrics','.warehouse-stock-summary','.home-editor-stats',
    '.dashboard-kpi-grid','.profitability-review-metrics',
    '.system-release-grid','.system-summary-grid',
  ].join(',');
  const selektorPaskow=[
    '.diag-actions','.admin-results-operations','.admin-results-selection','.results-bar',
    '.assortment-results-toolbar','.assortment-bulk-editor','.allegro-listing-selection',
    '.warehouse-worktable-actions','.allegro-toolbar','.toolbar','.order-bulk-toolbar',
    '.warehouse-page-tools','.agent-command-actions','.catalog-quality-actions',
  ].join(',');
  function elementy(zakres,selektor){
    const result=[];
    if(zakres?.nodeType===1&&zakres.matches?.(selektor))result.push(zakres);
    zakres?.querySelectorAll?.(selektor).forEach((element)=>result.push(element));
    return result;
  }
  function naglowkiTabeli(table){
    const row=table.tHead?.rows?.[0]||[...table.rows].find((item)=>item.querySelector('th'));
    if(!row)return [];
    const result=[];
    [...row.cells].forEach((cell)=>{
      const label=bezpiecznyTekst(cell.textContent);
      for(let i=0;i<Math.max(1,Number(cell.colSpan)||1);i++)result.push(label);
    });
    return result;
  }
  function opiszTabele(table){
    const headers=naglowkiTabeli(table);
    if(!headers.length)return;
    table.classList.add('admin-responsive-table','admin-standard-table');
    if(table.parentElement?.matches?.('.table-scroll,.assortment-table-wrap,.warehouse-worktable-wrap,.catalog-quality-table-wrap,.product-link-import-table-wrap,.seo-table-wrap,.log-table-wrap,.catalog-table-wrap,.mapping-table-wrap'))table.parentElement.classList.add('admin-standard-table-wrap');
    [...table.tBodies].flatMap((body)=>[...body.rows]).forEach((row)=>{
      let column=0;
      [...row.cells].forEach((cell)=>{
        if(cell.tagName!=='TD')return;
        const label=headers[column]||'';
        if(cell.dataset.label!==label)cell.dataset.label=label;
        column+=Math.max(1,Number(cell.colSpan)||1);
      });
    });
  }
  function opiszFiltry(zakres){
    const paski=new Set(elementy(zakres,selektorFiltrow));
    const nadrzedny=zakres?.nodeType===1?zakres.closest?.(selektorFiltrow):null;
    if(nadrzedny)paski.add(nadrzedny);
    paski.forEach((pasek)=>{
      const maWyszukiwanie=!!pasek.querySelector('input[type="search"],input[placeholder*="Szuk" i],input[placeholder*="nazwa" i]');
      const maFiltry=pasek.querySelectorAll('select').length>1;
      if(!maWyszukiwanie&&!maFiltry)return;
      pasek.classList.add('admin-standard-filterbar');
      if(!pasek.dataset.filterTitle)pasek.dataset.filterTitle='Wyszukiwanie i filtry';
    });
  }
  function oznaczElementy(zakres,selektor,klasa){
    elementy(zakres,selektor).forEach((element)=>element.classList.add(klasa));
  }
  function opiszStruktureWidoku(zakres){
    const content=zakres?.nodeType===1
      ?(zakres.matches?.('.admin-workspace-content')?zakres:(zakres.closest?.('.admin-workspace-content')||zakres.querySelector?.('.admin-workspace-content')))
      :document.querySelector('.admin-workspace-content');
    if(!content)return;
    const route=String(location.hash||'').replace(/^#/u,'').split('?')[0]||'/admin';
    content.classList.add('admin-unified-view');
    content.dataset.adminLayout='unified-v2';
    content.dataset.adminRoute=route;
    content.querySelectorAll(':scope>.module-page-stack,:scope>.warehouse-workspace,:scope>.shipping-workspace').forEach((element)=>element.classList.add('admin-unified-module'));
    content.querySelectorAll('.module-tabs-panel').forEach((element)=>element.classList.add('admin-unified-tabs'));
    content.querySelectorAll('.warehouse-module-nav,.agent-module-nav,.personalization-commandbar').forEach((element)=>element.classList.add('admin-unified-modulebar'));
    oznaczElementy(content,selektorHero,'admin-unified-hero');
    const infaktHero=content.querySelector('.infakt-hero>.order-section-head');
    if(infaktHero)infaktHero.classList.add('admin-unified-hero');
    if(!content.querySelector('.admin-unified-hero')){
      const title=[...content.querySelectorAll('h1,h2')].find((element)=>!element.closest('nav,.admin-workspace-header,.admin-unified-modulebar'));
      const semanticContainer=title?.closest?.('.order-section-head,.section-head,header');
      const compactPanel=title?.parentElement?.matches?.('.panel')
        &&title.parentElement.children.length<=3
        &&!title.parentElement.querySelector('form,table,.admin-search-standard')
        ?title.parentElement:null;
      const container=semanticContainer||compactPanel;
      if(container)container.classList.add('admin-unified-hero');
    }
    oznaczElementy(content,selektorMetryk,'admin-unified-metrics');
    oznaczElementy(content,selektorPaskow,'admin-unified-toolbar');
    content.querySelectorAll('.panel:not(.module-tabs-panel),form.panel').forEach((element)=>element.classList.add('admin-unified-panel'));
    content.querySelectorAll('.panel>.order-section-head:first-child,.panel>.section-head:first-child').forEach((element)=>{
      if(!element.classList.contains('admin-unified-hero'))element.classList.add('admin-unified-section-head');
    });
    content.querySelectorAll('.admin-search-standard').forEach((element)=>element.classList.add('admin-unified-search'));
    content.querySelectorAll('.order-empty,.catalog-empty,.assortment-empty,.agent-ops-empty,.warehouse-document-empty,.ai-library-empty,.system-empty').forEach((element)=>element.classList.add('admin-unified-empty'));
  }
  window.adminUjednolicWidok=opiszStruktureWidoku;
  function opiszZakres(zakres){
    if(!zakres)return;
    opiszStruktureWidoku(zakres);
    const tabele=new Set(elementy(zakres,selektorTabel));
    const tabelaNadrzedna=zakres?.nodeType===1?zakres.closest?.('table'):null;
    if(tabelaNadrzedna&&tabelaNadrzedna.closest('.admin-tresc,.modal,.drawer'))tabele.add(tabelaNadrzedna);
    tabele.forEach(opiszTabele);
    opiszFiltry(zakres);
  }
  function wykonaj(){
    zaplanowane=false;
    if(!document.body.classList.contains('admin-mode'))return;
    const panel=document.getElementById('widok')||document;
    opiszStruktureWidoku(panel);
    // Katalog produktów używa własnych, responsywnych kart i nie zawiera tabel.
    // Pomijamy dla niego ogólny analizator DOM, aby setki kontrolek nie były
    // ponownie przetwarzane po każdym wejściu na podstronę.
    if(panel.querySelector('.assortment-catalog-workspace')){zakresy.clear();return;}
    const biezace=zakresy.size?[...zakresy]:[document];
    zakresy.clear();
    biezace.forEach(opiszZakres);
  }
  function zaplanuj(zakres=document){
    if(zakresy.size>24){zakresy.clear();zakresy.add(document);}else zakresy.add(zakres||document);
    if(zaplanowane)return;
    zaplanowane=true;
    const run=()=>wykonaj();
    if('requestIdleCallback'in window)window.requestIdleCallback(run,{timeout:180});
    else window.requestAnimationFrame(run);
  }
  const observer=new MutationObserver((entries)=>{
    entries.forEach((entry)=>{if(entry.addedNodes.length)zaplanuj(entry.target);});
  });
  function start(){
    observer.observe(document.getElementById('widok')||document.body,{childList:true,subtree:true});
    zaplanuj(document);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('resize',()=>zaplanuj(document),{passive:true});
})();

/* Wspólny szkielet kanału sprzedaży. Allegro i Von Halsky przekazują tylko
   własne dane oraz akcję filtra; układ, dostępność i klasy pozostają identyczne. */
function adminKanalStanApiHTML({
  channel="Kanał sprzedaży",
  accent="neutral",
  connected=true,
  consistent=true,
  verifiedAt="",
  metrics=[],
  ariaLabel="Stan kanału potwierdzony przez API",
  dataAttribute="",
}={}){
  const safeAccent=["allegro","von-halsky","neutral"].includes(accent)?accent:"neutral";
  const attr=/^data-[a-z0-9-]+$/i.test(String(dataAttribute||""))?` ${dataAttribute}`:"";
  return `<section class="admin-channel-truth is-${safeAccent} ${consistent?"is-consistent":"is-warning"}"${attr} aria-label="${esc(ariaLabel)}">
    <div class="admin-channel-truth-head"><div><span>Stan potwierdzony bezpośrednio przez API</span><h3>${esc(channel)} — faktyczny stan kanału</h3></div><div><span class="lvl ${connected?"lvl-ok":"lvl-ostrzezenie"}">${connected?"połączono":"wymaga połączenia"}</span><small>Odczyt: ${esc(verifiedAt||"jeszcze nie wykonano")}</small></div></div>
    <div class="admin-channel-truth-grid">${metrics.map(metric=>`<article class="${esc(metric.tone||"")}"><small>${esc(metric.label||"")}</small><b>${esc(metric.value??0)}</b><span>${esc(metric.detail||"")}</span></article>`).join("")}</div>
  </section>`;
}
function adminKanalEtapyHTML({
  id="adminChannelStages",
  accent="neutral",
  title="Etap obsługi ofert",
  description="Stan sprzedaży potwierdza osobny pasek API powyżej.",
  active="",
  items=[],
  onSelect="",
  dataAttribute="",
  ariaLabel="Filtry etapów kanału sprzedaży",
}={}){
  const safeId=String(id||"adminChannelStages").replace(/[^A-Za-z0-9_-]/g,""),safeAccent=["allegro","von-halsky","neutral"].includes(accent)?accent:"neutral";
  const handler=/^[A-Za-z_$][\w$]*$/.test(String(onSelect||""))?String(onSelect):"";
  const attr=/^data-[a-z0-9-]+$/i.test(String(dataAttribute||""))?` ${dataAttribute}`:"";
  return `<section class="admin-channel-stage is-${safeAccent}"${attr} aria-labelledby="${safeId}"><header><div><small>Wewnętrzna kolejka Artway-TM</small><h3 id="${safeId}">${esc(title)}</h3></div><span>${esc(description)}</span></header><div class="admin-channel-stage-filters" role="toolbar" aria-label="${esc(ariaLabel)}">${items.map(item=>{const value=String(item.value??""),selected=value===String(active);return `<button class="${selected?"active":""}" type="button" aria-pressed="${selected?"true":"false"}" ${handler?`onclick="${handler}(${jsArg(value)})"`:"disabled"}><span aria-hidden="true">${esc(item.icon||"•")}</span><b>${esc(item.count??0)}</b><small>${esc(item.label||value)}</small></button>`;}).join("")}</div></section>`;
}

const adminWstepneLadowanieTras=new Set();
let adminWstepneLadowaniePodlaczone=false,adminWstepneLadowanieTimer=0;
function adminTrasaZOdnosnika(link){
  const href=String(link?.getAttribute?.("href")||"");
  if(!href.startsWith("#/admin"))return "";
  return href.slice(1).split("?")[0];
}
function adminWstepnieZaladujTrase(route,version){
  const key=String(route||"");if(!key||adminWstepneLadowanieTras.has(key))return;
  adminWstepneLadowanieTras.add(key);
  const missing=adminModulyDlaTrasy(key).filter(modul=>modul!=="core"&&!adminZaladowaneModuly.has(modul));
  if(!missing.length)return;
  Promise.all(missing.map(modul=>zaladujAdminModul(modul,version))).catch(()=>adminWstepneLadowanieTras.delete(key));
}
const ADMIN_TOP_TRASY_KLUCZ="artway_admin_top_trasy_v1";
let adminTopTrasyRozgrzane=false,adminTopTrasaStartowaZapisana=false;
function adminTrasaDoPamieciBezpieczna(route=""){
  const value=String(route||"").split("?")[0];
  return value.startsWith("/admin")&&!value.startsWith("/admin/zamowienie/")&&!value.startsWith("/admin/produkty/edytuj/")&&!value.startsWith("/admin/produkty/dodaj")&&!value.startsWith("/admin/produkty/z-linku");
}
function adminTopTrasyOdczytaj(){
  try{const rows=JSON.parse(localStorage.getItem(ADMIN_TOP_TRASY_KLUCZ)||"[]");return (Array.isArray(rows)?rows:[]).filter(row=>adminTrasaDoPamieciBezpieczna(row?.route)).map(row=>({route:String(row.route),visits:Math.max(1,Math.min(100,Number(row.visits)||1)),last:Number(row.last)||0})).slice(0,16);}catch(error){return [];}
}
function adminZapiszPopularnoscTrasy(route=""){
  const value=String(route||"").split("?")[0];if(!adminTrasaDoPamieciBezpieczna(value))return;
  const rows=adminTopTrasyOdczytaj(),now=Date.now(),found=rows.find(row=>row.route===value);
  if(found){found.visits=Math.min(100,found.visits+1);found.last=now;}else rows.push({route:value,visits:1,last:now});
  rows.sort((a,b)=>b.visits-a.visits||b.last-a.last);
  try{localStorage.setItem(ADMIN_TOP_TRASY_KLUCZ,JSON.stringify(rows.slice(0,16)));}catch(error){}
}
const ADMIN_PWA_ROZGRZEWANE_TRASY=8;
function adminRozgrzejNajczestszePodstronyPanelu(version){
  const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true;
  if(!standalone||adminTopTrasyRozgrzane)return;adminTopTrasyRozgrzane=true;
  const routes=adminTopTrasyOdczytaj().sort((a,b)=>b.visits-a.visits||b.last-a.last).slice(0,ADMIN_PWA_ROZGRZEWANE_TRASY).map(row=>row.route),assets=new Set();
  routes.forEach(route=>adminModulyDlaTrasy(route).forEach(modul=>{const script=ADMIN_MODULY_RUNTIME[modul],style=ADMIN_STYLE_RUNTIME[modul];if(script)assets.add(`/assets/${script}.js?v=${encodeURIComponent(version)}`);if(style)assets.add(`/assets/${style}.css?v=${encodeURIComponent(version)}`);}));
  const warm=()=>Promise.allSettled([...assets].map(url=>fetch(url,{credentials:"same-origin",cache:"force-cache"}))).catch(()=>{});
  if(typeof requestIdleCallback==="function")requestIdleCallback(()=>void warm(),{timeout:2500});else setTimeout(()=>void warm(),500);
}
function adminPodlaczLadowaniePoZamiarze(version){
  if(adminWstepneLadowaniePodlaczone)return;adminWstepneLadowaniePodlaczone=true;
  const wskaz=(event)=>{
    const link=event.target?.closest?.('a[href^="#/admin"]'),route=adminTrasaZOdnosnika(link);if(!route)return;
    clearTimeout(adminWstepneLadowanieTimer);const delay=event.type==="pointerdown"?0:70;adminWstepneLadowanieTimer=setTimeout(()=>adminWstepnieZaladujTrase(route,version),delay);
  };
  const anuluj=()=>{clearTimeout(adminWstepneLadowanieTimer);adminWstepneLadowanieTimer=0;};
  document.addEventListener("pointerover",wskaz,{passive:true});document.addEventListener("pointerdown",wskaz,{passive:true});document.addEventListener("focusin",wskaz);document.addEventListener("pointerout",anuluj,{passive:true});
}
function zaplanujWstepneLadowaniePanelu(version){
  if(typeof jestAdmin!=="function"||!jestAdmin())return;
  void adminZapewnijTrwalaPamiec();
  if(!adminTopTrasaStartowaZapisana){adminTopTrasaStartowaZapisana=true;adminZapiszPopularnoscTrasy(trasa());}
  adminRozgrzejNajczestszePodstronyPanelu(version);
  adminPodlaczLadowaniePoZamiarze(version);
}
const ADMIN_HISTORIA_KLUCZ="artway_admin_historia_tras_v1";
let adminHistoriaTras=(()=>{try{const value=JSON.parse(sessionStorage.getItem(ADMIN_HISTORIA_KLUCZ)||"[]");return Array.isArray(value)?value.filter(x=>String(x).startsWith("/admin")).slice(-30):[];}catch(e){return [];}})(),adminOstatniaTrasa=trasa(),adminNawigacjaCofania=false;
function adminZapiszHistorieTras(){try{sessionStorage.setItem(ADMIN_HISTORIA_KLUCZ,JSON.stringify(adminHistoriaTras.slice(-30)));}catch(e){}}
function adminZarejestrujTrase(next=trasa()){const current=String(next||""),previous=String(adminOstatniaTrasa||"");adminZapiszPopularnoscTrasy(current);if(adminNawigacjaCofania){adminNawigacjaCofania=false;adminOstatniaTrasa=current;adminZapiszHistorieTras();return;}if(previous.startsWith("/admin")&&current!==previous){if(adminHistoriaTras.at(-1)!==previous)adminHistoriaTras.push(previous);adminHistoriaTras=adminHistoriaTras.filter((value,index,array)=>index===array.length-1||value!==array[index+1]).slice(-30);adminZapiszHistorieTras();}adminOstatniaTrasa=current;}
function adminPoprzedniaTrasa(){const current=trasa();return [...adminHistoriaTras].reverse().find(path=>String(path).startsWith("/admin")&&path!==current)||"";}
function adminWrocDoPoprzedniejStrony(){const current=trasa();let target="";while(adminHistoriaTras.length&&!target){const candidate=String(adminHistoriaTras.pop()||"");if(candidate.startsWith("/admin")&&candidate!==current)target=candidate;}adminZapiszHistorieTras();if(!target){toast("Nie ma wcześniejszej strony panelu w tej sesji");return false;}adminNawigacjaCofania=true;location.hash="#"+target;return false;}
function adminAktualizujPrzyciskHistorii(root=document){const button=root?.querySelector?.(".admin-history-back");if(!button)return;const previous=adminPoprzedniaTrasa();button.disabled=!previous;button.title=previous?`Wróć do: ${previous}`:"Brak wcześniejszej strony panelu";}
/* Budżet pamięci widoków panelu jest większy na mocnych urządzeniach, ale na
   telefonie nadal ma bezpieczny limit. Rewizje domen nie kasują niezwiązanych kart. */
const ADMIN_PAMIEC_URZADZENIA_GB=Math.max(2,Number(navigator.deviceMemory)||4);
const ADMIN_PWA_STANDALONE=window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator.standalone===true;
const ADMIN_CACHE_PODSTRON_LIMIT=ADMIN_PWA_STANDALONE?(ADMIN_PAMIEC_URZADZENIA_GB>=8?48:32):(ADMIN_PAMIEC_URZADZENIA_GB>=8?16:12);
const ADMIN_CACHE_PODSTRON_MAX_WEZLOW=ADMIN_PWA_STANDALONE?(ADMIN_PAMIEC_URZADZENIA_GB>=8?30000:22000):(ADMIN_PAMIEC_URZADZENIA_GB>=8?18000:14000);
const ADMIN_CACHE_PODSTRON_MAX_LACZNIE=ADMIN_PWA_STANDALONE?(ADMIN_PAMIEC_URZADZENIA_GB>=8?240000:160000):(ADMIN_PAMIEC_URZADZENIA_GB>=8?64000:42000);
const ADMIN_PWA_CACHE_BUDGET_MAX_BYTES=1024*1024*1024,ADMIN_PWA_CACHE_QUOTA_SHARE=.8;
let adminPamiecTrwalaPromise=null,adminPamiecTrwalaStan={sprawdzono:false,trwala:false,quota:0,usage:0,available:0,budget:0};
function adminZapewnijTrwalaPamiec(){
  if(adminPamiecTrwalaPromise)return adminPamiecTrwalaPromise;
  adminPamiecTrwalaPromise=(async()=>{if(!navigator.storage)return adminPamiecTrwalaStan;try{let trwala=typeof navigator.storage.persisted==="function"?await navigator.storage.persisted():false;if(!trwala&&typeof navigator.storage.persist==="function")trwala=await navigator.storage.persist();const estimate=typeof navigator.storage.estimate==="function"?await navigator.storage.estimate():{},quota=Number(estimate.quota)||0,usage=Number(estimate.usage)||0;adminPamiecTrwalaStan={sprawdzono:true,trwala:!!trwala,quota,usage,available:Math.max(0,quota-usage),budget:Math.max(0,Math.min(ADMIN_PWA_CACHE_BUDGET_MAX_BYTES,Math.floor(quota*ADMIN_PWA_CACHE_QUOTA_SHARE)))};}catch(error){adminPamiecTrwalaStan={...adminPamiecTrwalaStan,sprawdzono:true};}return adminPamiecTrwalaStan;})();return adminPamiecTrwalaPromise;
}
function adminDomenyCacheDlaTrasy(route=""){
  const value=String(route||"");
  if(value.startsWith("/admin/allegro"))return ["allegro","catalog","warehouse"];
  if(value.startsWith("/admin/magazyn"))return ["warehouse","catalog","orders","allegro","agent"];
  if(value.startsWith("/admin/asortyment")||value.startsWith("/admin/produkty")||value.startsWith("/admin/kategorie")||value.startsWith("/admin/mapowanie"))return ["catalog","warehouse","allegro"];
  if(value.startsWith("/admin/zamowien")||value.startsWith("/admin/wysylki")||value.startsWith("/admin/klient"))return ["orders","warehouse","catalog"];
  if(value.startsWith("/admin/agent-ai"))return ["agent","catalog","warehouse","allegro","orders"];
  if(value.startsWith("/admin/infakt"))return ["infakt","catalog","orders"];
  if(value.startsWith("/admin/seo"))return ["seo","catalog"];
  if(value.startsWith("/admin/personalizacja"))return ["settings","catalog"];
  return Object.keys(typeof adminRewizjeDomenCache==="object"?adminRewizjeDomenCache:{});
}
function adminSygnaturaCacheTrasy(route=""){return adminDomenyCacheDlaTrasy(route).map(domain=>`${domain}:${Number(adminRewizjeDomenCache?.[domain])||0}`).join("|");}
