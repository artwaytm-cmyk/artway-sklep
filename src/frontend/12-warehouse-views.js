function magazynSubnavHTML(aktywny="pulpit"){
  // Lokalizacje i generator QR są lekkimi podstronami. Nie uruchamiamy dla
  // nich kalkulacji planu, dopóki moduł rezerwacji magazynowych nie jest
  // faktycznie załadowany.
  const maDanePlanu=typeof potrzebyZatowarowania==="function"&&typeof rezerwacjeMagazynowe==="function";
  const plan=maDanePlanu?potrzebyZatowarowania():[],braki=plan.length;
  const bezLok=typeof magazynLokalizacjeZamowienIds!=="undefined"?magazynLokalizacjeZamowienIds.size:0;
  const dokumenty=typeof agentAIZlecenia!=="undefined"&&typeof agentAIPlanDokumentAktywny==="function"?(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length:0,planAkcje=braki+dokumenty;
  const items=[
    {id:"pulpit",href:"#/admin/magazyn",icon:"📊",label:"Pulpit",description:"Priorytety"},
    {id:"dostawcy",href:"#/admin/magazyn/dostawcy",icon:"🏭",label:"Dostępność",description:"Producent • sprzedaż • pokrycie",badge:braki||""},
    {id:"stany",href:"#/admin/magazyn/stany",icon:"📦",label:"Stany",description:"Fizyczny towar teraz"},
    {id:"plan",href:"#/admin/magazyn/plan",icon:"📥",label:"Plan i dokumenty",description:"Zatowarowanie • PZ/WZ",badge:planAkcje||""},
    {id:"lokalizacje",href:"#/admin/magazyn/lokalizacje",icon:"🗺️",label:"Lokalizacje",description:"Obszary • regały • półki",badge:bezLok||""},
    {id:"etykiety-qr",href:"#/admin/magazyn/etykiety-qr",icon:"🏷️",label:"Etykiety QR",description:"Druk i skanowanie"},
    {id:"ruchy",href:"#/admin/magazyn/ruchy",icon:"🧾",label:"Ruchy i ustawienia",description:"Audyt magazynu"}
  ];
  return `<nav class="panel warehouse-module-nav" aria-label="Podstrony magazynu"><div class="warehouse-module-brand"><span>🏬</span><div><small>Centrum operacyjne</small><b>Magazyn</b></div></div><div class="warehouse-module-links">${items.map(item=>`<a class="${item.id===aktywny?"active":""}" href="${esc(item.href)}" ${item.id===aktywny?'aria-current="page"':""} title="${esc(`${item.label} — ${item.description}`)}"><span class="warehouse-nav-icon">${esc(item.icon)}</span><span class="warehouse-nav-copy"><b>${esc(item.label)}</b><small>${esc(item.description)}</small></span>${item.badge?`<span class="nav-badge">${esc(item.badge)}</span>`:""}</a>`).join("")}</div></nav>`;
}
function magazynKontekstPodstronyHTML(aktywna="pulpit",u={}){
  const pages={
    pulpit:{icon:"📊",eyebrow:"Centrum operacyjne magazynu",title:u.nazwa||"Magazyn główny",description:"Priorytety na dziś, braki do aktywnych zamówień, dostępność producentów i trasa kompletacji w jednym miejscu."},
    dostawcy:{icon:"🏭",eyebrow:"Dostępność i decyzje sprzedażowe",title:"Dostępność produktów",description:"Producent, sprzedaż sklepu i Allegro, lokalne pokrycie oraz decyzje o dostępności w jednym kontrolowanym miejscu."},
    stany:{icon:"📦",eyebrow:"Fizyczny magazyn teraz",title:"Aktualne stany magazynowe",description:"Wyłącznie towar znajdujący się fizycznie w magazynie: ilość, rezerwacje, wolny zapas, lokalizacja i ostatnie potwierdzenie."},
    lokalizacje:{icon:"🗺️",eyebrow:"Struktura fizyczna",title:"Lokalizacje magazynowe",description:"Czytelna mapa obszarów, regałów i półek z prostymi nazwami oraz stałymi kodami systemowymi w tle."},
    "etykiety-qr":{icon:"🏷️",eyebrow:"Oznaczenia i skanowanie",title:"Etykiety i kody QR",description:"Wybór, podgląd i druk oznaczeń lokalizacji oraz produktów przygotowanych do pracy telefonem lub czytnikiem."},
    plan:{icon:"📥",eyebrow:"Zakupy i dokumenty",title:"Zatowarowanie oraz PZ/WZ",description:"Braki, zamówienia producentów, przyjęcia i rozchody prowadzone jako jeden kontrolowany proces z historią."},
    ruchy:{icon:"🧾",eyebrow:"Audyt i konfiguracja",title:"Ruchy i ustawienia",description:"Historia zmian stanów, dokumenty źródłowe oraz bezpieczne wartości domyślne całego magazynu."}
  },page=pages[aktywna]||pages.pulpit;
  const actions=aktywna==="pulpit"?`<button class="btn" onclick="eksportujMagazynCSV()">📊 Eksport CSV</button><button class="btn ghost" onclick="agentAISprawdzDostepnoscProducentow()">🏭 Sprawdź producentów</button><a class="btn ghost" href="#/admin/agent-ai">🤖 Agent AI</a>`:aktywna==="dostawcy"?`<button class="btn" onclick="agentAISprawdzDostepnoscProducentow()">🤖 Uruchom kontrolę</button>`:aktywna==="stany"?`<button class="btn ghost" onclick="eksportujFizyczneStanyMagazynu()">📤 Eksport stanów</button>`:aktywna==="lokalizacje"?`<button class="btn" onclick="magazynOtworzKreatorLokalizacji('strefa')">＋ Nowy obszar</button>`:aktywna==="etykiety-qr"?`<a class="btn ghost" href="#/admin/magazyn/lokalizacje">🗺️ Mapa lokalizacji</a>`:aktywna==="plan"?`<button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()">↻ Uzgodnij plan</button>`:`<a class="btn ghost" href="#/admin/magazyn/plan">📥 Otwórz PZ/WZ</a>`;
  return `<header class="warehouse-page-context section-${esc(aktywna)}"><div class="warehouse-page-identity"><div class="warehouse-page-kicker"><span>${esc(page.icon)}</span><small>${esc(page.eyebrow)}</small></div><h1>${esc(page.title)}</h1><p>${esc(page.description)}</p></div><div class="warehouse-page-tools"><div class="warehouse-live-state"><i></i><span><b>Wspólna baza aktywna</b><small>Zapis na serwerze</small></span></div><div class="diag-actions">${actions}<button class="btn ghost" type="button" onclick="magazynGlobalnySkanerOtworz()">📷 Skaner</button></div></div></header>`;
}
function magazynPlanEtykietaKolumny(value=""){return String(value||"").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();}
function magazynPlanUstandaryzujTabeleHTML(html=""){
  return String(html||"").replace(/<table class="([^"]*)">([\s\S]*?)<\/table>/g,(table,classes,content)=>{
    if(!/(?:^|\s)log-table(?:\s|$)/.test(classes))return table;
    const labels=[...content.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(x=>magazynPlanEtykietaKolumny(x[1]));
    const body=content.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/g,(row,rowAttrs,cells)=>{
      let column=-1;
      const marked=cells.replace(/<td([^>]*)>/g,(cell,attrs)=>{
        column+=1;if(/\bdata-label\s*=/.test(attrs))return cell;
        const label=/\bcolspan\s*=/.test(attrs)?"":(labels[column]||(column===labels.length-1?"Akcje":""));
        return `<td data-label="${esc(label)}"${attrs}>`;
      });
      return `<tr${rowAttrs}>${marked}</tr>`;
    });
    const className=[...new Set(`${classes} admin-responsive-table admin-standard-table`.split(/\s+/).filter(Boolean))].join(" ");
    return `<table class="${className}">${body}</table>`;
  });
}
function magazynPlanUstandaryzujTabeleDOM(root=document){
  root?.querySelectorAll?.("table.log-table").forEach(table=>{
    table.classList.add("admin-responsive-table","admin-standard-table");
    const labels=[...(table.tHead?.rows?.[0]?.cells||[])].map(cell=>magazynPlanEtykietaKolumny(cell.textContent));
    table.querySelectorAll("tbody tr, tfoot tr").forEach(row=>[...row.cells].forEach((cell,index)=>{
      if(!cell.hasAttribute("data-label"))cell.dataset.label=cell.colSpan>1?"":(labels[index]||(index===labels.length-1?"Akcje":""));
    }));
  });
  return root;
}
function magazynPlanPrzewinDo(selector){const target=document.querySelector(selector);if(!target)return false;target.scrollIntoView({behavior:"smooth",block:"start"});return true;}
function magazynPlanCentrumStatusuHTML(){
  const shortageResult=typeof agentAIBrakiOperacyjne==="function"?agentAIBrakiOperacyjne():[],shortages=Array.isArray(shortageResult)?shortageResult:[],orders=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]),activeOrders=orders.filter(order=>typeof agentAIPlanDokumentAktywny==="function"&&agentAIPlanDokumentAktywny(order)),supplierReady=activeOrders.filter(order=>order.approvedAt&&Number(order.approvalRevision||0)===Math.max(1,Number(order.revision)||1)&&!order.emailSentAt),awaitingDelivery=activeOrders.filter(order=>(order.emailSentAt||String(order.status||"").toLowerCase().includes("wysłane"))&&(order.pozycje||[]).some(line=>Number(line.przyjeto||0)<Number(line.ilosc||0))),docs=magazynDokumentyStan.items||[],draftDocs=docs.filter(doc=>doc.status==="draft"),readyDocs=draftDocs.filter(doc=>magazynDokumentWalidacja(doc).ready);
  return `<div class="restock-command-status"><button type="button" onclick="magazynPlanPrzewinDo('.ops-control-center')"><span>⚠️</span><div><b>${shortages.length}</b><small>realnych braków</small><em>do pokrycia zamówieniem</em></div></button><button type="button" onclick="magazynPlanPrzewinDo('.supplier-restock-plan')"><span>✅</span><div><b>${supplierReady.length}</b><small>gotowych do wysłania</small><em>${activeOrders.length} aktywnych dokumentów</em></div></button><button type="button" onclick="magazynPlanPrzewinDo('.supplier-restock-plan')"><span>🚚</span><div><b>${awaitingDelivery.length}</b><small>dostaw do przyjęcia</small><em>po wysłaniu do producenta</em></div></button><button type="button" onclick="magazynPlanPrzewinDo('#warehouseDocumentsCenter')"><span>📑</span><div><b>${readyDocs.length}/${draftDocs.length}</b><small>gotowych PZ/WZ</small><em>kontrola przed księgowaniem</em></div></button></div>`;
}
function magazynPlanZatowarowaniaHTML(){
  const intro=`<section class="panel restock-plan-intro"><div class="order-section-head"><div><span class="order-pro-label">Zakupy producentów + dokumenty magazynowe</span><h2>📦 Plan zatowarowania</h2><p class="order-detail-lead">Braki, zamówienia producentów, przyjęcia oraz rozchody tworzą jeden kontrolowany proces. Edycja przygotowuje dokument, a stan zmienia dopiero jego końcowe zatwierdzenie.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/magazyn/etykiety-qr">🏷️ Etykiety QR</a><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()">↻ Uzgodnij szkice z brakami</button></div></div>${magazynPlanCentrumStatusuHTML()}<nav class="restock-workflow-nav" aria-label="Etapy planu zatowarowania"><button type="button" onclick="magazynPlanPrzewinDo('.ops-control-center')"><span>1</span><div><b>Braki i zakupy</b><small>sprawdź potrzeby zamówień</small></div></button><button type="button" onclick="magazynPlanPrzewinDo('.supplier-restock-plan')"><span>2</span><div><b>Dokumenty producentów</b><small>zatwierdź, wyślij i przyjmij</small></div></button><button type="button" onclick="magazynPlanPrzewinDo('#warehouseDocumentsCenter')"><span>3</span><div><b>Operacje PZ / WZ</b><small>skanuj, koryguj i zaksięguj</small></div></button></nav></section>`;
  return magazynPlanUstandaryzujTabeleHTML(`${intro}${magazynTabelaOperacyjnaHTML()}${magazynDokumentyPanelHTML()}`);
}
function odswiezPlanZatowarowaniaWidoku(){
  const root=document.getElementById("warehouseRestockWorkspace");if(!root||typeof magazynTabelaOperacyjnaHTML!=="function")return false;
  const aktywny=document.activeElement,focusId=aktywny&&root.contains(aktywny)?String(aktywny.id||""):"",start=typeof aktywny?.selectionStart==="number"?aktywny.selectionStart:null,end=typeof aktywny?.selectionEnd==="number"?aktywny.selectionEnd:null;
  root.innerHTML=magazynPlanZatowarowaniaHTML();magazynPlanUstandaryzujTabeleDOM(root);
  if(focusId){const nastepny=document.getElementById(focusId);if(nastepny){nastepny.focus({preventScroll:true});if(start!==null&&typeof nastepny.setSelectionRange==="function")nastepny.setSelectionRange(start,end??start);}}
  return true;
}
function magazynDostawcaWierszHTML({p={},i={},priority={},rank=0,rez={},spr={},kanalySpr={sklep:{},allegro:{}}}={}){
  const historia=Array.isArray(p.producentStanHistoria)?p.producentStanHistoria:[],id=String(p.id),stan=stanMagazynuId(p.id),r=Number(rez[id]||0),plan=sugestiaZatowarowania(p,rez,spr),meta=plan.meta,sklep30=Number(kanalySpr.sklep?.[id]||0),allegro30=Number(kanalySpr.allegro?.[id]||0),wolne=plan.dostepne;
  return `<tr data-product-row="${esc(p.id)}" class="supplier-row ${esc(i.cls||"")}">
    <td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||meta.kod||"—")} • ID ${esc(p.id)}</small><small>${esc(p.kategoria||"Bez kategorii")}</small></div></div></td>
    <td><div class="supplier-local-coverage"><div class="warehouse-stock-balance"><span><b>${stan===null?"—":stan}</b><small>fizycznie</small></span><span><b>${r}</b><small>rezerwacje</small></span><span class="${wolne!==null&&wolne<0?"negative":""}"><b>${wolne===null?"—":wolne}</b><small>wolne</small></span></div><small>📍 ${esc(meta.lokalizacja?nazwaLokalizacjiMagazynu(meta.lokalizacja):"brak lokalizacji")}</small><div class="supplier-priority ${esc(priority?.level||"niski")}"><b>${priority?.score?`🏆 #${esc(rank||"—")} • ${esc(priority.level)}`:"Brak sprzedaży w 30 dni"}</b><small>Sklep ${sklep30} • Allegro ${allegro30} • w zamówieniach ${esc(priority?.active||0)}</small></div></div></td>
    <td><div class="supplier-source-state"><b>${esc(p.producent||p.marka||"Nieprzypisany")}</b>${producentDostepnoscBadgeHTML(p)}<small>Próg ostrzeżenia: ${esc(i.prog)} szt.</small><small class="supplier-source-url">${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">Otwórz źródło ↗</a><span>${esc(i.url)}</span>`:"Brak linku źródłowego"}</small></div></td>
    <td>${decyzjaProducentaPanelHTML(p,i)}</td>
    <td><div class="supplier-plan-control"><b>${plan.ilosc?`Do zamówienia: ${esc(plan.ilosc)} szt.`:"Pokrycie bez zamówienia"}</b><small>${esc(plan.powod)}</small><small>Pokrycie ${plan.dniPokrycia===null?"—":plan.dniPokrycia+" dni"} • cel ${esc(plan.target)} • dostawa ${esc(plan.lead)} dni</small><div class="supplier-check-cell"><b>${i.checked?esc(allegroDataTxt(i.checked)):"Nigdy nie sprawdzano"}</b><div>${i.stale?`<span class="lvl lvl-ostrzezenie">wynik nieaktualny</span>`:`<span class="lvl lvl-ok">aktualny</span>`}${i.error?`<span class="lvl lvl-blad">${esc(skrocTekst(i.error,80))}</span>`:""}</div><details><summary>Historia kontroli (${historia.length})</summary><div class="supplier-history">${historia.map(h=>`<span class="${esc(h.status||"nieznany")}"><b>${h.quantity===null||h.quantity===undefined?"—":esc(h.quantity)+" szt."}</b><small>${esc(allegroDataTxt(h.at))}</small></span>`).join("")||`<small>Brak historii</small>`}</div></details></div></div></td>
    <td><div class="warehouse-worktable-actions">${i.url?`<button class="btn" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź teraz</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj produkt</a></div></td>
  </tr>`;
}
const MAGAZYN_STANY_PARTIA_KART=10;
let magazynStanyKartyOczekujace=[],magazynStanyKartyKontekst=null,magazynStanyKartyObserwator=null,magazynStanyKartyGeneracja=0;
function magazynStanWierszHTML(p={},kontekst={}){
  const rez=kontekst.rez||{},prog=Number(kontekst.prog)||0,stan=stanMagazynuId(p.id),r=Number(rez[p.id]||0),wolne=stan===null?null:stan-r,meta=magazynMetaProduktu(p.id),wart=stan===null?0:stan*kwotaNum(p.cena),selected=zaznaczoneMagazynProdukty.has(String(p.id)),invTime=meta.ostatniaInwentaryzacja?Date.parse(meta.ostatniaInwentaryzacja):0,invOld=!invTime||Date.now()-invTime>90*86400000;
  return `<tr data-warehouse-stock-row data-product-row="${esc(p.id)}" class="${selected?"is-selected":""}">
    <td><label class="warehouse-stock-row-product"><input type="checkbox" aria-label="Zaznacz ${esc(p.nazwa||"produkt")}" ${selected?"checked":""} onchange="magazynUstawZaznaczenie([${jsArg(p.id)}],this.checked)">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<span><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||meta.kod||"—")} • ID ${esc(p.id)}</small><small>${esc(p.kategoria||"Bez kategorii")}</small></span></label></td>
    <td><div class="warehouse-stock-location-cell"><b>${esc(meta.lokalizacja?nazwaLokalizacjiMagazynu(meta.lokalizacja):"Brak lokalizacji")}</b><small>${esc(meta.lokalizacja||"Ustal miejsce składowania")}</small></div></td>
    <td><div class="warehouse-stock-current"><b>${stan===null?"—":stan} szt.</b>${stanBadgeMagazynu(stan,progNiskiProduktu(p)||prog)}<small>Wartość ${stan===null?"—":zl(wart)}</small></div></td>
    <td><b>${r} szt.</b><small class="warehouse-stock-cell-note">aktywne zamówienia</small></td>
    <td><div class="warehouse-stock-current ${wolne!==null&&wolne<0?"negative":""}"><b>${wolne===null?"—":wolne} szt.</b><small>po rezerwacjach</small></div></td>
    <td><div class="warehouse-stock-inventory ${invOld?"old":""}"><b>${meta.ostatniaInwentaryzacja?esc(allegroDataTxt(meta.ostatniaInwentaryzacja)):"Niepotwierdzony"}</b><button class="btn ghost" type="button" onclick="oznaczInwentaryzacjeProduktu(${jsArg(p.id)})">✅ Potwierdź</button></div></td>
    <td><div class="warehouse-stock-row-actions"><div class="warehouse-stock-stepper"><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},-1)" ${stan===null?"disabled":""}>−1</button><strong>${stan===null?"—":stan}</strong><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},1)" ${stan===null?"disabled":""}>+1</button></div><form class="warehouse-stock-set" onsubmit="korygujStanMagazynu(event,${jsArg(p.id)})"><input name="stan" value="${stan===null?"":stan}" placeholder="Stan" inputmode="numeric"><input name="powod" placeholder="Powód korekty" maxlength="80"><button class="btn" type="submit">Zapisz</button></form><details><summary>Kartoteka</summary><form class="warehouse-stock-meta-form" onsubmit="zapiszKartotekeMagazynu(event,${jsArg(p.id)})"><label>Lokalizacja ${poleLokalizacjiMagazynu(meta.lokalizacja||"","warehouseStockLocationOptions")}</label><label>Dostawca<input name="dostawca" value="${esc(meta.dostawca||"")}"></label><label>EAN / kod<input name="kod" value="${esc(meta.kod||p.gtin||p.ean||"")}"></label><label>Kod Optimy<input name="optimaCode" value="${esc(meta.optimaCode||p.optimaCode||"")}"></label><label>Kod dostawcy<input name="kodDostawcy" value="${esc(meta.kodDostawcy||p.kodDostawcy||p.supplierCode||"")}"></label><label>Stan minimalny<input name="minStock" value="${esc(meta.minStock??"")}" inputmode="numeric"></label><label>Stan docelowy<input name="targetStock" value="${esc(meta.targetStock??"")}" inputmode="numeric"></label><label>Czas dostawy<input name="leadTime" value="${esc(meta.leadTime??"")}" inputmode="numeric"></label><label>Minimalny zakup<input name="minZakup" value="${esc(meta.minZakup??"")}" inputmode="numeric"></label><label>Uwagi<input name="uwagi" value="${esc(meta.uwagi||"")}"></label><div class="warehouse-stock-meta-buttons"><button class="btn" type="submit">💾 Zapisz kartotekę</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Produkt</a></div></form></details></div></td>
  </tr>`;
}
function magazynStanyPrzygotujKartyProgresywnie(lista=[],kontekst={}){
  magazynStanyKartyObserwator?.disconnect();magazynStanyKartyObserwator=null;
  const items=Array.isArray(lista)?lista:[],generation=++magazynStanyKartyGeneracja;
  magazynStanyKartyKontekst=kontekst;magazynStanyKartyOczekujace=items.slice(MAGAZYN_STANY_PARTIA_KART);
  const first=items.slice(0,MAGAZYN_STANY_PARTIA_KART).map(p=>magazynStanWierszHTML(p,kontekst)).join("");
  if(!magazynStanyKartyOczekujace.length)return first;
  setTimeout(()=>magazynStanyUruchomDoloadowywanie(generation),0);
  return `${first}<tr data-warehouse-stock-loader data-generation="${generation}"><td colspan="7" data-label=""><div class="warehouse-stock-progressive-loader"><span><b>Załadowano ${Math.min(MAGAZYN_STANY_PARTIA_KART,items.length)} z ${items.length}</b><small>Kolejne pozycje pojawią się podczas przewijania.</small></span><button class="btn ghost" type="button" onclick="magazynStanyDoloadujKarty(${generation})">Pokaż kolejne</button></div></td></tr>`;
}
function magazynStanyDoloadujKarty(generation=magazynStanyKartyGeneracja){
  const loader=document.querySelector(`[data-warehouse-stock-loader][data-generation="${Number(generation)}"]`);if(!loader||Number(generation)!==magazynStanyKartyGeneracja)return false;
  const batch=magazynStanyKartyOczekujace.splice(0,MAGAZYN_STANY_PARTIA_KART);if(batch.length){loader.insertAdjacentHTML("beforebegin",batch.map(p=>magazynStanWierszHTML(p,magazynStanyKartyKontekst||{})).join(""));magazynPlanUstandaryzujTabeleDOM(loader.closest(".warehouse-stock-list")||document);}
  if(!magazynStanyKartyOczekujace.length){magazynStanyKartyObserwator?.disconnect();magazynStanyKartyObserwator=null;loader.remove();return true;}
  const loaded=document.querySelectorAll(".warehouse-stock-list [data-warehouse-stock-row]").length,total=loaded+magazynStanyKartyOczekujace.length,label=loader.querySelector("b");if(label)label.textContent=`Załadowano ${loaded} z ${total}`;return true;
}
function magazynStanyUruchomDoloadowywanie(generation=magazynStanyKartyGeneracja){
  const loader=document.querySelector(`[data-warehouse-stock-loader][data-generation="${Number(generation)}"]`);if(!loader||typeof IntersectionObserver!=="function")return;
  magazynStanyKartyObserwator?.disconnect();magazynStanyKartyObserwator=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))magazynStanyDoloadujKarty(generation);},{rootMargin:"700px 0px"});magazynStanyKartyObserwator.observe(loader);
}
