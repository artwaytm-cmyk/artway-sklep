let systemSerwerStan={loaded:false,loading:false,status:null,plan:null,error:"",cleaning:false};
function systemBajty(value){
  const n=Math.max(0,Number(value)||0),units=["B","KB","MB","GB","TB"];let current=n,index=0;
  while(current>=1024&&index<units.length-1){current/=1024;index++;}
  return `${current.toLocaleString("pl-PL",{maximumFractionDigits:index>1?1:0})} ${units[index]}`;
}
function systemCzasDzialania(seconds){
  const total=Math.max(0,Math.floor(Number(seconds)||0)),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60);
  return [days?`${days} d`:"",hours?`${hours} godz.`:"",`${minutes} min`].filter(Boolean).join(" ");
}
function systemPoziom(value,warn,bad=101){return Number(value)>=bad?"bad":Number(value)>=warn?"warn":"ok";}
async function systemPobierzSerwer(force=false){
  if(systemSerwerStan.loading||(!force&&systemSerwerStan.loaded&&systemSerwerStan.status))return systemSerwerStan;
  systemSerwerStan={...systemSerwerStan,loading:true,error:""};
  if(trasa()==="/admin/system/serwer")renderuj();
  try{
    const data=await chmura("server-status",{timeout:30000,params:force?{refresh:Date.now()}:{}});
    systemSerwerStan={...systemSerwerStan,loaded:true,loading:false,status:data.status||null,error:""};
  }catch(error){systemSerwerStan={...systemSerwerStan,loaded:true,loading:false,error:error.message||String(error)};}
  if(trasa()==="/admin/system/serwer")renderuj();
  return systemSerwerStan;
}
async function systemPodgladCzyszczenia(){
  if(systemSerwerStan.cleaning)return;
  systemSerwerStan={...systemSerwerStan,cleaning:true,error:""};renderuj();
  try{
    const data=await chmura("server-cleanup-preview",{timeout:60000,params:{refresh:Date.now()}});
    systemSerwerStan={...systemSerwerStan,cleaning:false,plan:data.plan||null,error:""};
    toast(data.plan?.totalItems?`Znaleziono ${data.plan.totalItems} bezpiecznych plików technicznych`:"Serwer nie wymaga czyszczenia ✅");
  }catch(error){systemSerwerStan={...systemSerwerStan,cleaning:false,error:error.message||String(error)};toast("Nie udało się przygotować podglądu");}
  renderuj();
}
async function systemWykonajCzyszczenie(){
  if(systemSerwerStan.cleaning||!systemSerwerStan.plan)return;
  systemSerwerStan={...systemSerwerStan,cleaning:true,error:""};renderuj();
  try{
    const data=await chmura("server-cleanup-run",{method:"POST",body:{confirm:"safe-server-cleanup"},timeout:120000});
    systemSerwerStan={...systemSerwerStan,cleaning:false,plan:null,error:"",loaded:false};
    toast(`Zwolniono ${systemBajty(data.result?.freedBytes||0)} • usunięto ${data.result?.removedItems||0} plików technicznych ✅`);
    await systemPobierzSerwer(true);
  }catch(error){systemSerwerStan={...systemSerwerStan,cleaning:false,error:error.message||String(error)};toast("Czyszczenie nie powiodło się");renderuj();}
}
function systemSerwerPasek(label,value,warning,critical){
  const percent=Math.max(0,Math.min(100,Number(value)||0)),level=systemPoziom(percent,warning,critical);
  return `<div class="server-meter ${level}"><div><b>${esc(label)}</b><strong>${esc(percent.toFixed(1))}%</strong></div><span><i style="width:${percent}%"></i></span></div>`;
}
function systemBackupStatusHTML(label,item){
  const ok=item?.ok&&!item?.stale;
  return `<article class="server-service ${ok?"ok":"warn"}"><span>${ok?"✓":"!"}</span><div><b>${esc(label)}</b><small>${item?.checkedAt?`Ostatnio: ${esc(systemDataCzas(item.checkedAt))}`:"Brak potwierdzonego uruchomienia"}${item?.ageHours!==null&&item?.ageHours!==undefined?` • ${esc(item.ageHours)} godz. temu`:""}</small></div><em>${ok?"AKTUALNA":"SPRAWDŹ"}</em></article>`;
}
function systemSerwerHTML(){
  const s=systemSerwerStan.status;
  if(systemSerwerStan.loading&&!s)return `<section class="panel server-loading"><span>⏳</span><h1>Pobieram stan serwera</h1><p>Sprawdzam dysk, pamięć, wydanie i kopie danych.</p></section>`;
  if(!s)return `<section class="panel server-loading bad"><span>⚠️</span><h1>Nie udało się odczytać serwera</h1><p>${esc(systemSerwerStan.error||"Uruchom kontrolę ponownie.")}</p><button class="btn" onclick="systemPobierzSerwer(true)">Spróbuj ponownie</button></section>`;
  const diskLevel=systemPoziom(s.disk?.usedPercent,75,90),memoryLevel=systemPoziom(s.memory?.usedPercent,85,95),loadLevel=systemPoziom(s.host?.loadPercent,80,120),plan=systemSerwerStan.plan,last=s.maintenance?.lastCleanup;
  return `<section class="server-hero panel"><div><span class="order-pro-label">OVH • ${esc(s.host?.hostname||"serwer")}</span><h1>🖥️ Stan i utrzymanie serwera</h1><p>Jedno miejsce do kontroli zasobów, aktywnego wydania, kopii oraz bezpiecznego usuwania wyłącznie zbędnych plików technicznych.</p></div><div class="server-hero-actions"><span class="server-live"><i></i> Backend działa</span><button class="btn ghost" onclick="systemPobierzSerwer(true)" ${systemSerwerStan.loading?"disabled":""}>${systemSerwerStan.loading?"⏳ Odświeżam":"↻ Odśwież dane"}</button></div></section>
  <section class="server-kpi-grid">
    <article class="server-kpi ${diskLevel}"><small>Dysk</small><b>${esc(s.disk?.usedPercent||0)}%</b><span>${systemBajty(s.disk?.availableBytes)} wolne z ${systemBajty(s.disk?.totalBytes)}</span></article>
    <article class="server-kpi ${memoryLevel}"><small>Pamięć RAM</small><b>${esc(s.memory?.usedPercent||0)}%</b><span>${systemBajty(s.memory?.availableBytes)} dostępne</span></article>
    <article class="server-kpi ${loadLevel}"><small>Obciążenie CPU</small><b>${esc(s.host?.loadPercent||0)}%</b><span>${esc(s.host?.cpuCount||0)} rdzeni • load ${esc(s.host?.load?.[0]||0)}</span></article>
    <article class="server-kpi ok"><small>Czas działania</small><b>${esc(systemCzasDzialania(s.host?.uptimeSeconds))}</b><span>backend: ${esc(systemCzasDzialania(s.process?.uptimeSeconds))}</span></article>
  </section>
  <section class="server-workspace">
    <div class="server-main-column">
      <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Zasoby na żywo</span><h2>Wykorzystanie serwera</h2></div><small>Sprawdzono ${esc(systemDataCzas(s.checkedAt))}</small></div>
        <div class="server-meters">${systemSerwerPasek("Dysk",s.disk?.usedPercent||0,75,90)}${systemSerwerPasek("Pamięć RAM",s.memory?.usedPercent||0,85,95)}${systemSerwerPasek("Obciążenie CPU",s.host?.loadPercent||0,80,120)}</div>
        <div class="server-storage-grid"><article><span>📦</span><div><b>Kopie danych</b><small>${esc(s.storage?.backups?.files||0)} plików</small></div><strong>${systemBajty(s.storage?.backups?.bytes)}</strong></article><article><span>🚀</span><div><b>Wydania strony</b><small>${esc(s.storage?.releases?.count||0)} katalogów • ${esc(s.storage?.releases?.managed||0)} zarządzanych</small></div><strong>${systemBajty(s.storage?.releases?.bytes)}</strong></article><article><span>🧩</span><div><b>Projekt roboczy</b><small>${esc(s.storage?.project?.files||0)} plików</small></div><strong>${systemBajty(s.storage?.project?.bytes)}</strong></article></div>
      </section>
      <section class="panel"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Kopie i odtwarzanie</span><h2>Ochrona danych</h2></div><a class="btn ghost" href="#/admin/system/kopie">Kopie danych</a></div><div class="server-services">${systemBackupStatusHTML("Kopia lokalna",s.backups?.local)}${systemBackupStatusHTML("Kopia zewnętrzna",s.backups?.offsite)}${systemBackupStatusHTML("Test odtworzenia",s.backups?.restoreTest)}</div></section>
    </div>
    <aside class="server-side-column">
      <section class="panel server-release-card"><span class="order-pro-label">Aktywne wydanie</span><b>${esc(s.release?.active||"niepotwierdzone")}</b><small>${esc(s.release?.managedCount||0)} wydań pod kontrolą automatu • ${esc(s.release?.unmanagedCount||0)} starszych katalogów zachowanych do ręcznej decyzji</small><a href="#/admin/system">Sprawdź aktualizację →</a></section>
      <section class="panel server-cleanup-card"><div class="system-section-head"><div><span class="order-pro-label">Bezpieczne utrzymanie</span><h2>Oczyszczanie</h2></div><span>🧹</span></div><p>Automat chroni aktywne wydanie, kompletne kopie oraz wszystkie dane sklepu. Czyści tylko stare pliki techniczne utworzone przez Artway.</p>
        <dl><div><dt>Harmonogram</dt><dd>${esc(s.maintenance?.schedule||"codziennie")}</dd></div><div><dt>Ostatnie czyszczenie</dt><dd>${last?.finishedAt?esc(systemDataCzas(last.finishedAt)):"jeszcze nie wykonano"}</dd></div><div><dt>Ostatnio zwolniono</dt><dd>${systemBajty(last?.freedBytes||0)}</dd></div></dl>
        <button class="btn ghost" onclick="systemPodgladCzyszczenia()" ${systemSerwerStan.cleaning?"disabled":""}>${systemSerwerStan.cleaning?"⏳ Sprawdzam":"🔎 Pokaż pliki do usunięcia"}</button>
      </section>
    </aside>
  </section>
  ${plan?`<section class="panel server-cleanup-preview"><div class="system-section-head order-section-head"><div><span class="order-pro-label">Podgląd przed operacją</span><h2>${plan.totalItems?`${esc(plan.totalItems)} plików technicznych • ${systemBajty(plan.totalBytes)}`:"Serwer jest uporządkowany"}</h2><p>${plan.totalItems?"Poniżej znajduje się pełny zakres operacji. Dane sklepu i kopie nie są na tej liście.":"Nie znaleziono żadnych plików spełniających bezpieczne reguły usuwania."}</p></div>${plan.totalItems?`<button class="btn" onclick="systemWykonajCzyszczenie()" ${systemSerwerStan.cleaning?"disabled":""}>${systemSerwerStan.cleaning?"⏳ Czyszczę":"🧹 Wyczyść bezpiecznie"}</button>`:""}</div>
    ${plan.totalItems?`<div class="server-cleanup-list">${plan.candidates.map(item=>`<article><span>${item.type==="temporary-artifact"?"🧪":item.type==="managed-release"?"🚀":"🧹"}</span><div><b>${esc(item.name)}</b><small>${esc(item.reason)}</small></div><strong>${systemBajty(item.bytes)}</strong></article>`).join("")}</div>`:""}
    <div class="server-protection-note"><b>Chronione zawsze:</b> aktywne wydanie ${esc(plan.protected?.activeRelease||"—")}, kompletne kopie, produkty, zamówienia, zdjęcia, konta i baza PostgreSQL.</div>
  </section>`:""}
  ${systemSerwerStan.error?`<div class="backend-note bad">${esc(systemSerwerStan.error)}</div>`:""}`;
}
