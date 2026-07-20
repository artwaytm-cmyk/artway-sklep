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
    '.telegram-conversation-filters','.telegram-incident-toolbar','.dashboard-alert-filters',
    '.seo-advanced-toolbar','.profitability-review-toolbar','.diag-toolbar',
  ].map((item)=>`.admin-tresc ${item}`).join(',');
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
  function opiszZakres(zakres){
    if(!zakres)return;
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
  adminPodlaczLadowaniePoZamiarze(version);
}
const ADMIN_HISTORIA_KLUCZ="artway_admin_historia_tras_v1";
let adminHistoriaTras=(()=>{try{const value=JSON.parse(sessionStorage.getItem(ADMIN_HISTORIA_KLUCZ)||"[]");return Array.isArray(value)?value.filter(x=>String(x).startsWith("/admin")).slice(-30):[];}catch(e){return [];}})(),adminOstatniaTrasa=trasa(),adminNawigacjaCofania=false;
function adminZapiszHistorieTras(){try{sessionStorage.setItem(ADMIN_HISTORIA_KLUCZ,JSON.stringify(adminHistoriaTras.slice(-30)));}catch(e){}}
function adminZarejestrujTrase(next=trasa()){const current=String(next||""),previous=String(adminOstatniaTrasa||"");if(adminNawigacjaCofania){adminNawigacjaCofania=false;adminOstatniaTrasa=current;adminZapiszHistorieTras();return;}if(previous.startsWith("/admin")&&current!==previous){if(adminHistoriaTras.at(-1)!==previous)adminHistoriaTras.push(previous);adminHistoriaTras=adminHistoriaTras.filter((value,index,array)=>index===array.length-1||value!==array[index+1]).slice(-30);adminZapiszHistorieTras();}adminOstatniaTrasa=current;}
function adminPoprzedniaTrasa(){const current=trasa();return [...adminHistoriaTras].reverse().find(path=>String(path).startsWith("/admin")&&path!==current)||"";}
function adminWrocDoPoprzedniejStrony(){const current=trasa();let target="";while(adminHistoriaTras.length&&!target){const candidate=String(adminHistoriaTras.pop()||"");if(candidate.startsWith("/admin")&&candidate!==current)target=candidate;}adminZapiszHistorieTras();if(!target){toast("Nie ma wcześniejszej strony panelu w tej sesji");return false;}adminNawigacjaCofania=true;location.hash="#"+target;return false;}
function adminAktualizujPrzyciskHistorii(root=document){const button=root?.querySelector?.(".admin-history-back");if(!button)return;const previous=adminPoprzedniaTrasa();button.disabled=!previous;button.title=previous?`Wróć do: ${previous}`:"Brak wcześniejszej strony panelu";}
