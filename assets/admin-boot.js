/* GENERATED ADMIN DIRECT-ENTRY BOOT — edit src/frontend/00-admin-direct-entry-boot.js */
(()=>{
  if(!/^#\/(?:admin(?:\/|$)|diagnostyka(?:\/|$))/.test(location.hash))return;
  document.documentElement.classList.add("artway-admin-boot");
  const version=document.querySelector('meta[name="artway-version"]')?.content||"dev",root=document.getElementById("widok");
  if(!root){
    if(!document.getElementById("artwayAdminStyles"))document.write(`<link id="artwayAdminStyles" rel="stylesheet" href="/assets/admin.css?v=${encodeURIComponent(version)}" fetchpriority="high">`);
    return;
  }
  document.body.classList.add("admin-mode");
  root.innerHTML=`<div class="admin-page admin-boot-shell" data-admin-boot><aside class="admin-nav" aria-hidden="true"><div class="admin-nav-heading"><span class="admin-nav-brand-mark">A</span><span class="admin-nav-brand-copy"><b>Artway-TM</b><small>Panel administracyjny</small></span></div><div class="admin-boot-lines"><i></i><i></i><i></i><i></i><i></i><i></i></div></aside><div class="admin-tresc"><section class="admin-workspace-header"><div class="admin-workspace-context"><span>⚙️</span><div><small>PANEL ADMINISTRACYJNY</small><b>Przygotowuję przestrzeń roboczą</b><em>Układ pozostaje stabilny podczas wczytywania danych.</em></div></div></section><div class="admin-workspace-content"><div class="panel admin-loading" role="status" aria-live="polite"><h1>Ładowanie panelu…</h1><p>Wczytuję potrzebne funkcje i aktualny stan serwera.</p></div></div></div></div>`;
})();
