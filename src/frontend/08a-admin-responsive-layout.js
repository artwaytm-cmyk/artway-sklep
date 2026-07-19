(function uruchomResponsywnyPanelAdmina(){
  const media=window.matchMedia('(max-width:1280px)');
  let zaplanowane=false;
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
    table.classList.add('admin-responsive-table');
    [...table.tBodies].flatMap((body)=>[...body.rows]).forEach((row)=>{
      let column=0;
      [...row.cells].forEach((cell)=>{
        if(cell.tagName!=='TD')return;
        cell.dataset.label=headers[column]||'';
        column+=Math.max(1,Number(cell.colSpan)||1);
      });
    });
  }
  function opiszKontrolki(){
    document.querySelectorAll(selektorKontrolek).forEach((control)=>{
      const label=bezpiecznyTekst(control.getAttribute('aria-label')||control.textContent);
      if(!label)return;
      if(!control.hasAttribute('aria-label'))control.setAttribute('aria-label',label);
      if(control.scrollWidth>control.clientWidth+1&&!control.hasAttribute('title'))control.setAttribute('title',label);
    });
  }
  function wykonaj(){
    zaplanowane=false;
    if(!document.body.classList.contains('admin-mode'))return;
    opiszKontrolki();
    if(media.matches)document.querySelectorAll('.admin-tresc table,.modal table,.drawer table').forEach(opiszTabele);
  }
  function zaplanuj(){
    if(zaplanowane)return;
    zaplanowane=true;
    const run=()=>wykonaj();
    if('requestIdleCallback'in window)window.requestIdleCallback(run,{timeout:180});
    else window.requestAnimationFrame(run);
  }
  const observer=new MutationObserver((entries)=>{
    if(entries.some((entry)=>entry.addedNodes.length||entry.removedNodes.length))zaplanuj();
  });
  function start(){
    observer.observe(document.getElementById('widok')||document.body,{childList:true,subtree:true});
    zaplanuj();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  media.addEventListener?.('change',zaplanuj);
  window.addEventListener('resize',zaplanuj,{passive:true});
})();
