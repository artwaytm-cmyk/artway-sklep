/* GENERATED ADMIN UI — shared responsive tables and filters */
(function uruchomResponsywnyPanelAdmina(){
  let zaplanowane=false;
  const zakresy=new Set();
  const bezpiecznyTekst=(value)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,120);
  const selektorKontrolek=[
    '.admin-tresc .btn',
    '.admin-tresc button',
    '.admin-tresc a[role="button"]',
    '.admin-tresc .admin-main-tabs>a',
    '.admin-tresc .admin-tab-bar>a',
    '.admin-tresc .shipping-tabs>a',
    '.admin-tresc .warehouse-qr-tabs>a',
    '.admin-tresc .agent-module-groups a',
  ].join(',');
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
  function opiszKontrolki(zakres){
    elementy(zakres,selektorKontrolek).forEach((control)=>{
      const label=bezpiecznyTekst(control.getAttribute('aria-label')||control.textContent);
      if(!label)return;
      if(!control.hasAttribute('aria-label'))control.setAttribute('aria-label',label);
      if(control.scrollWidth>control.clientWidth+1&&!control.hasAttribute('title'))control.setAttribute('title',label);
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
    opiszKontrolki(zakres);
    opiszFiltry(zakres);
  }
  function wykonaj(){
    zaplanowane=false;
    if(!document.body.classList.contains('admin-mode'))return;
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
