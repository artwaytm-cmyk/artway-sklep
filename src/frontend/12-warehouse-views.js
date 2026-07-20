const ASORTYMENT_PARTIA_KART=10;
let asortymentKartyOczekujace=[],asortymentKartyObserwator=null,asortymentKartyGeneracja=0;
function asortymentRenderujElementKarty(item){return item?.produkt?asortymentKartaProduktuHTML(item.produkt,item.ukrytaKopia===true):String(item||"");}
function asortymentPrzygotujKartyProgresywnie(lista=[]){
  asortymentKartyObserwator?.disconnect();asortymentKartyObserwator=null;
  const generation=++asortymentKartyGeneracja,items=Array.isArray(lista)?lista:[];
  asortymentKartyOczekujace=items.slice(ASORTYMENT_PARTIA_KART);
  const first=items.slice(0,ASORTYMENT_PARTIA_KART).map(asortymentRenderujElementKarty).join("");
  if(!asortymentKartyOczekujace.length)return first;
  setTimeout(()=>asortymentUruchomDoloadowywanieKart(generation),0);
  return `${first}<div class="assortment-progressive-loader" data-assortment-card-loader data-generation="${generation}"><span><b>Załadowano ${Math.min(ASORTYMENT_PARTIA_KART,items.length)} z ${items.length}</b><small>Kolejne produkty pojawią się automatycznie podczas przewijania.</small></span><button class="btn ghost" type="button" onclick="asortymentDoloadujKarty(${generation})">Pokaż kolejne</button></div>`;
}
function asortymentDoloadujKarty(generation=asortymentKartyGeneracja){
  const loader=document.querySelector(`[data-assortment-card-loader][data-generation="${Number(generation)}"]`);
  if(!loader||Number(generation)!==asortymentKartyGeneracja)return false;
  const batch=asortymentKartyOczekujace.splice(0,ASORTYMENT_PARTIA_KART);
  if(batch.length)loader.insertAdjacentHTML("beforebegin",batch.map(asortymentRenderujElementKarty).join(""));
  if(!asortymentKartyOczekujace.length){asortymentKartyObserwator?.disconnect();asortymentKartyObserwator=null;loader.remove();return true;}
  const loaded=document.querySelectorAll(".catalog-product-list .catalog-product-card").length,total=loaded+asortymentKartyOczekujace.length;
  const label=loader.querySelector("b");if(label)label.textContent=`Załadowano ${loaded} z ${total}`;
  return true;
}
function asortymentUruchomDoloadowywanieKart(generation=asortymentKartyGeneracja){
  const loader=document.querySelector(`[data-assortment-card-loader][data-generation="${Number(generation)}"]`);if(!loader)return;
  if(typeof IntersectionObserver!=="function")return;
  asortymentKartyObserwator?.disconnect();
  asortymentKartyObserwator=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))asortymentDoloadujKarty(generation);},{rootMargin:"500px 0px"});
  asortymentKartyObserwator.observe(loader);
}
function magazynKontekstPodstronyHTML(aktywna="pulpit",u={}){
  const pages={
    pulpit:{icon:"📊",eyebrow:"Centrum operacyjne magazynu",title:u.nazwa||"Magazyn główny",description:"Priorytety na dziś, braki do aktywnych zamówień, dostępność producentów i trasa kompletacji w jednym miejscu."},
    dostawcy:{icon:"🏭",eyebrow:"Kontrola zaopatrzenia",title:"Dostępność u producentów",description:"Najpierw bestsellery i produkty z aktywnych zamówień. Każdy alarm prowadzi do jawnej decyzji sprzedażowej."},
    stany:{icon:"📦",eyebrow:"Kontrola kartoteki",title:"Stany produktów",description:"Fizyczny zapas, rezerwacje, sprzedaż, lokalizacja i potrzeba domówienia bez mieszania odpowiedzialności działów."},
    lokalizacje:{icon:"🗺️",eyebrow:"Struktura fizyczna",title:"Lokalizacje magazynowe",description:"Czytelna mapa obszarów, regałów i półek z prostymi nazwami oraz stałymi kodami systemowymi w tle."},
    "etykiety-qr":{icon:"🏷️",eyebrow:"Oznaczenia i skanowanie",title:"Etykiety i kody QR",description:"Wybór, podgląd i druk oznaczeń lokalizacji oraz produktów przygotowanych do pracy telefonem lub czytnikiem."},
    plan:{icon:"📥",eyebrow:"Zakupy i dokumenty",title:"Zatowarowanie oraz PZ/WZ",description:"Braki, zamówienia producentów, przyjęcia i rozchody prowadzone jako jeden kontrolowany proces z historią."},
    ruchy:{icon:"🧾",eyebrow:"Audyt i konfiguracja",title:"Ruchy i ustawienia",description:"Historia zmian stanów, dokumenty źródłowe oraz bezpieczne wartości domyślne całego magazynu."}
  },page=pages[aktywna]||pages.pulpit;
  const actions=aktywna==="pulpit"?`<button class="btn" onclick="eksportujMagazynCSV()">📊 Eksport CSV</button><button class="btn ghost" onclick="agentAISprawdzDostepnoscProducentow()">🏭 Sprawdź producentów</button><a class="btn ghost" href="#/admin/agent-ai">🤖 Agent AI</a>`:aktywna==="dostawcy"?`<button class="btn" onclick="agentAISprawdzDostepnoscProducentow()">🤖 Uruchom kontrolę</button>`:aktywna==="stany"?`<button class="btn ghost" onclick="eksportujMagazynCSV()">📤 Eksport stanów</button>`:aktywna==="lokalizacje"?`<button class="btn" onclick="magazynOtworzKreatorLokalizacji('strefa')">＋ Nowy obszar</button>`:aktywna==="etykiety-qr"?`<a class="btn ghost" href="#/admin/magazyn/lokalizacje">🗺️ Mapa lokalizacji</a>`:aktywna==="plan"?`<button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()">↻ Uzgodnij plan</button>`:`<a class="btn ghost" href="#/admin/magazyn/plan">📥 Otwórz PZ/WZ</a>`;
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
function magazynPlanZatowarowaniaHTML(){
  const intro=`<section class="panel restock-plan-intro"><div class="order-section-head"><div><span class="order-pro-label">Zakupy producentów + dokumenty magazynowe</span><h2>📦 Plan zatowarowania</h2><p class="order-detail-lead">Braki, zamówienia producentów, przyjęcia oraz rozchody tworzą jeden kontrolowany proces. Edycja przygotowuje dokument, a stan zmienia dopiero jego końcowe zatwierdzenie.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/magazyn/etykiety-qr">🏷️ Etykiety QR</a><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()">↻ Uzgodnij szkice z brakami</button></div></div><nav class="restock-workflow-nav" aria-label="Etapy planu zatowarowania"><button type="button" onclick="magazynPlanPrzewinDo('.ops-control-center')"><span>1</span><div><b>Braki i zakupy</b><small>sprawdź potrzeby zamówień</small></div></button><button type="button" onclick="magazynPlanPrzewinDo('.supplier-restock-plan')"><span>2</span><div><b>Dokumenty producentów</b><small>zatwierdź, wyślij i przyjmij</small></div></button><button type="button" onclick="magazynPlanPrzewinDo('#warehouseDocumentsCenter')"><span>3</span><div><b>Operacje PZ / WZ</b><small>skanuj, koryguj i zaksięguj</small></div></button></nav></section>`;
  return magazynPlanUstandaryzujTabeleHTML(`${intro}${magazynTabelaOperacyjnaHTML()}${magazynDokumentyPanelHTML()}`);
}
function odswiezPlanZatowarowaniaWidoku(){
  const root=document.getElementById("warehouseRestockWorkspace");if(!root||typeof magazynTabelaOperacyjnaHTML!=="function")return false;
  const aktywny=document.activeElement,focusId=aktywny&&root.contains(aktywny)?String(aktywny.id||""):"",start=typeof aktywny?.selectionStart==="number"?aktywny.selectionStart:null,end=typeof aktywny?.selectionEnd==="number"?aktywny.selectionEnd:null;
  root.innerHTML=magazynPlanZatowarowaniaHTML();magazynPlanUstandaryzujTabeleDOM(root);
  if(focusId){const nastepny=document.getElementById(focusId);if(nastepny){nastepny.focus({preventScroll:true});if(start!==null&&typeof nastepny.setSelectionRange==="function")nastepny.setSelectionRange(start,end??start);}}
  return true;
}
function magazynDostawcaWierszHTML({p={},i={},priority={},rank=0}={}){
  const historia=Array.isArray(p.producentStanHistoria)?p.producentStanHistoria:[];
  return `<tr data-product-row="${esc(p.id)}" class="supplier-row ${esc(i.cls||"")}">
    <td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||"—")}</small></div></div></td>
    <td><div class="supplier-priority ${esc(priority?.level||"niski")}"><b>${priority?.score?`🏆 #${esc(rank||"—")} • ${esc(priority.level)}`:"— brak sprzedaży"}</b><small>Sklep ${esc(priority?.sklep||0)} • Allegro ${esc(priority?.allegro||0)} • aktywne ${esc(priority?.active||0)}</small><em>Główny kanał: ${esc(priority?.channel||"—")}</em></div></td>
    <td><div class="supplier-source-state"><b>${esc(p.producent||p.marka||"Nieprzypisany")}</b>${producentDostepnoscBadgeHTML(p)}<small>Próg ostrzeżenia: ${esc(i.prog)} szt.</small><small class="supplier-source-url">${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">Otwórz źródło ↗</a><span>${esc(i.url)}</span>`:"Brak linku źródłowego"}</small></div></td>
    <td>${decyzjaProducentaPanelHTML(p,i)}</td>
    <td><div class="supplier-check-cell"><b>${i.checked?esc(allegroDataTxt(i.checked)):"Nigdy nie sprawdzano"}</b><div>${i.stale?`<span class="lvl lvl-ostrzezenie">wynik nieaktualny</span>`:`<span class="lvl lvl-ok">aktualny</span>`}${i.error?`<span class="lvl lvl-blad">${esc(skrocTekst(i.error,80))}</span>`:""}</div><details><summary>Historia kontroli (${historia.length})</summary><div class="supplier-history">${historia.map(h=>`<span class="${esc(h.status||"nieznany")}"><b>${h.quantity===null||h.quantity===undefined?"—":esc(h.quantity)+" szt."}</b><small>${esc(allegroDataTxt(h.at))}</small></span>`).join("")||`<small>Brak historii</small>`}</div></details></div></td>
    <td><div class="warehouse-worktable-actions">${i.url?`<button class="btn" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź teraz</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj produkt</a></div></td>
  </tr>`;
}
const MAGAZYN_STANY_PARTIA_KART=10;
let magazynStanyKartyOczekujace=[],magazynStanyKartyKontekst=null,magazynStanyKartyObserwator=null,magazynStanyKartyGeneracja=0;
function magazynStanKartaHTML(p={},kontekst={}){
  const rez=kontekst.rez||{},spr=kontekst.spr||{},kanalySpr=kontekst.kanalySpr||{sklep:{},allegro:{}},prog=Number(kontekst.prog)||0;
  const stan=stanMagazynuId(p.id),r=Number(rez[p.id]||0),sp=Number(spr[p.id]||0),plan=sugestiaZatowarowania(p,rez,spr),meta=plan.meta,wart=stan===null?0:stan*kwotaNum(p.cena),pi=producentDostepnoscInfo(p),priority=priorytetDostepnosciProduktu(p,kanalySpr,rez),sklep30=Number(kanalySpr.sklep[p.id]||0),allegro30=Number(kanalySpr.allegro[p.id]||0),invTime=meta.ostatniaInwentaryzacja?Date.parse(meta.ostatniaInwentaryzacja):0,invOld=!invTime||Date.now()-invTime>90*86400000;
  const risk=pi.status==="brak"||plan.dostepne!==null&&plan.dostepne<0?"critical":pi.status==="niski"||plan.ilosc>0?"warning":pi.stale||["nieznany","blad"].includes(pi.status)?"info":"ok";
  const riskLabel=risk==="critical"?"Pilna reakcja":risk==="warning"?"Wymaga uwagi":risk==="info"?"Do weryfikacji":"Bez alarmu";
  return `<article class="warehouse-stock-card stock-${risk} ${zaznaczoneMagazynProdukty.has(String(p.id))?"is-selected":""}" data-product-row="${esc(p.id)}">
    <header class="warehouse-stock-card-head">
      <div class="warehouse-stock-product"><label class="warehouse-stock-select" title="Zaznacz produkt"><input type="checkbox" ${zaznaczoneMagazynProdukty.has(String(p.id))?"checked":""} onchange="magazynUstawZaznaczenie([${jsArg(p.id)}],this.checked)"></label>${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><h3>${esc(p.nazwa)}</h3><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||meta.kod||"—")} • ID ${esc(p.id)}</small><small>${esc(p.kategoria||"Bez kategorii")} • ${esc(p.producent||meta.dostawca||"Producent nieprzypisany")}</small></div></div>
      <div class="warehouse-stock-priority ${esc(priority.level)}"><b>${priority.score?`🏆 ${priority.score} pkt`:`${risk==="ok"?"✓":"!"} ${riskLabel}`}</b><small>Sklep ${sklep30} • Allegro ${allegro30} • aktywne ${priority.active}</small></div>
      <div class="warehouse-stock-state"><span class="stock-state-dot ${risk}"></span><div><b>${riskLabel}</b><small>${dostepnoscBadgeAdmin(p)}</small></div></div>
    </header>
    <div class="warehouse-stock-card-grid">
      <section><label>Stan fizyczny</label><div class="warehouse-stock-balance"><span><b>${stan===null?"∞":stan}</b><small>na stanie</small></span><span><b>${r}</b><small>rezerwacje</small></span><span class="${plan.dostepne!==null&&plan.dostepne<0?"negative":""}"><b>${plan.dostepne===null?"∞":plan.dostepne}</b><small>dostępne</small></span></div><small>Wartość: ${stan===null?"—":zl(wart)} • ${stanBadgeMagazynu(stan,progNiskiProduktu(p)||prog)}</small></section>
      <section><label>Producent i źródło</label>${producentDostepnoscBadgeHTML(p,true)}<small>${pi.checked?`Kontrola: ${esc(allegroDataTxt(pi.checked))}`:"Nigdy nie sprawdzano"}${pi.stale?" • wynik nieaktualny":""}</small></section>
      <section><label>Sprzedaż i pokrycie</label><b>${sp} szt. / 30 dni</b><small>Sklep ${sklep30} • Allegro ${allegro30} • średnio ${(sp/30).toFixed(2).replace(".",",")} dziennie</small><small>Pokrycie ${plan.dniPokrycia===null?"—":plan.dniPokrycia+" dni"} • cel ${plan.target} • dostawa ${plan.lead} dni</small></section>
      <section class="warehouse-stock-decision ${plan.poziom}"><label>Decyzja magazynowa</label><b>${plan.ilosc?`Domówić ${esc(plan.ilosc)} szt.`:"Nie trzeba domawiać"}</b><small>${esc(plan.powod)}</small><small>Minimum ${esc(plan.min)} • cel ${esc(plan.target)} • min. zakup ${esc(plan.minZakup||0)}</small></section>
    </div>
    <div class="warehouse-stock-location"><span>🗺️ <b>${esc(meta.lokalizacja?nazwaLokalizacjiMagazynu(meta.lokalizacja):"Brak lokalizacji")}</b></span><span>🏭 ${esc(meta.dostawca||"Brak dostawcy")}</span><span class="${invOld?"old":""}">📅 ${meta.ostatniaInwentaryzacja?`Inwentaryzacja ${esc(allegroDataTxt(meta.ostatniaInwentaryzacja))}`:"Stan nigdy niepotwierdzony"}</span></div>
    <div class="warehouse-stock-actions">
      <div class="warehouse-stock-stepper"><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},-10)" ${stan===null?"disabled":""}>−10</button><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},-1)" ${stan===null?"disabled":""}>−1</button><strong>${stan===null?"∞":stan}</strong><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},1)" ${stan===null?"disabled":""}>+1</button><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},10)" ${stan===null?"disabled":""}>+10</button></div>
      <form class="warehouse-stock-set" onsubmit="korygujStanMagazynu(event,${jsArg(p.id)})"><input name="stan" value="${stan===null?"":stan}" placeholder="Nowy stan / puste = ∞" inputmode="numeric"><input name="powod" placeholder="Powód korekty" maxlength="80"><button class="btn" type="submit">Zapisz stan</button></form>
      <div class="warehouse-stock-links"><button class="btn ghost" type="button" onclick="przelaczDostepnoscProduktu(${jsArg(p.id)})">${produktAutomatycznieNiedostepny(p)?"🔄 Sprawdź i przywróć":produktOznaczonyNiedostepny(p)?"▶️ Włącz sprzedaż":"⏸️ Wyłącz sprzedaż"}</button>${pi.url?`<button class="btn ghost" type="button" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź producenta</button><a class="btn ghost" href="${esc(pi.url)}" target="_blank" rel="noopener">Źródło ↗</a>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Produkt</a></div>
    </div>
    <details class="warehouse-stock-details"><summary>⚙️ Kartoteka, lokalizacja i parametry zatowarowania</summary><form class="warehouse-stock-meta-form" onsubmit="zapiszKartotekeMagazynu(event,${jsArg(p.id)})"><label>Lokalizacja ${poleLokalizacjiMagazynu(meta.lokalizacja||"","warehouseStockLocationOptions")}</label><label>Dostawca<input name="dostawca" value="${esc(meta.dostawca||"")}" placeholder="np. Alexander"></label><label>EAN / kod<input name="kod" value="${esc(meta.kod||p.gtin||p.ean||"")}"></label><label>Kod w Comarch Optima dostawcy<input name="optimaCode" value="${esc(meta.optimaCode||p.optimaCode||"")}" placeholder="Dokładny kod pola TOWAR"></label><label>Kod dostawcy<input name="kodDostawcy" value="${esc(meta.kodDostawcy||p.kodDostawcy||p.supplierCode||"")}" placeholder="Opcjonalny kod katalogowy"></label><label>Stan minimalny<input name="minStock" value="${esc(meta.minStock??"")}" inputmode="numeric"></label><label>Stan docelowy<input name="targetStock" value="${esc(meta.targetStock??"")}" inputmode="numeric"></label><label>Czas dostawy (dni)<input name="leadTime" value="${esc(meta.leadTime??"")}" inputmode="numeric"></label><label>Minimalny zakup<input name="minZakup" value="${esc(meta.minZakup??"")}" inputmode="numeric"></label><label>Uwagi<input name="uwagi" value="${esc(meta.uwagi||"")}"></label><div class="warehouse-stock-meta-buttons"><button class="btn ghost" type="button" onclick="oznaczInwentaryzacjeProduktu(${jsArg(p.id)})">✅ Potwierdź stan</button><button class="btn" type="submit">💾 Zapisz kartotekę</button></div></form></details>
  </article>`;
}
function magazynStanyPrzygotujKartyProgresywnie(lista=[],kontekst={}){
  magazynStanyKartyObserwator?.disconnect();magazynStanyKartyObserwator=null;
  const items=Array.isArray(lista)?lista:[],generation=++magazynStanyKartyGeneracja;
  magazynStanyKartyKontekst=kontekst;magazynStanyKartyOczekujace=items.slice(MAGAZYN_STANY_PARTIA_KART);
  const first=items.slice(0,MAGAZYN_STANY_PARTIA_KART).map(p=>magazynStanKartaHTML(p,kontekst)).join("");
  if(!magazynStanyKartyOczekujace.length)return first;
  setTimeout(()=>magazynStanyUruchomDoloadowywanie(generation),0);
  return `${first}<div class="warehouse-stock-progressive-loader" data-warehouse-stock-loader data-generation="${generation}"><span><b>Załadowano ${Math.min(MAGAZYN_STANY_PARTIA_KART,items.length)} z ${items.length}</b><small>Kolejne kartoteki pojawią się podczas przewijania.</small></span><button class="btn ghost" type="button" onclick="magazynStanyDoloadujKarty(${generation})">Pokaż kolejne</button></div>`;
}
function magazynStanyDoloadujKarty(generation=magazynStanyKartyGeneracja){
  const loader=document.querySelector(`[data-warehouse-stock-loader][data-generation="${Number(generation)}"]`);if(!loader||Number(generation)!==magazynStanyKartyGeneracja)return false;
  const batch=magazynStanyKartyOczekujace.splice(0,MAGAZYN_STANY_PARTIA_KART);if(batch.length)loader.insertAdjacentHTML("beforebegin",batch.map(p=>magazynStanKartaHTML(p,magazynStanyKartyKontekst||{})).join(""));
  if(!magazynStanyKartyOczekujace.length){magazynStanyKartyObserwator?.disconnect();magazynStanyKartyObserwator=null;loader.remove();return true;}
  const loaded=document.querySelectorAll(".warehouse-stock-list .warehouse-stock-card").length,total=loaded+magazynStanyKartyOczekujace.length,label=loader.querySelector("b");if(label)label.textContent=`Załadowano ${loaded} z ${total}`;return true;
}
function magazynStanyUruchomDoloadowywanie(generation=magazynStanyKartyGeneracja){
  const loader=document.querySelector(`[data-warehouse-stock-loader][data-generation="${Number(generation)}"]`);if(!loader||typeof IntersectionObserver!=="function")return;
  magazynStanyKartyObserwator?.disconnect();magazynStanyKartyObserwator=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))magazynStanyDoloadujKarty(generation);},{rootMargin:"700px 0px"});magazynStanyKartyObserwator.observe(loader);
}
function widokAdminMagazyn(sekcja="pulpit"){
  allegroLadujJesliTrzeba(["pulpit","stany","plan"].includes(sekcja)?"orders":"summary");
  const aktywna=["pulpit","dostawcy","stany","lokalizacje","etykiety-qr","plan","ruchy"].includes(String(sekcja||""))?String(sekcja||""):"pulpit";
  if(aktywna!=="stany"){magazynStanyKartyObserwator?.disconnect();magazynStanyKartyObserwator=null;magazynStanyKartyOczekujace=[];}
  const u=ustawieniaMagazynuPelne();
  if(aktywna==="etykiety-qr")return adminSzkielet("/admin/magazyn",`${magazynSubnavHTML(aktywna)}<div class="warehouse-workspace">${magazynKontekstPodstronyHTML(aktywna,u)}${magazynQRCentrumHTML()}</div>`);
  if(aktywna==="plan")return adminSzkielet("/admin/magazyn",`
    ${magazynSubnavHTML(aktywna)}
    <div class="warehouse-workspace">${magazynKontekstPodstronyHTML(aktywna,u)}<div id="warehouseRestockWorkspace" class="warehouse-restock-workspace">${magazynPlanZatowarowaniaHTML()}</div></div>
  `);
  const wymagaStanow=aktywna==="pulpit"||aktywna==="stany",rez=wymagaStanow?rezerwacjeMagazynowe():{},kanalySpr=wymagaStanow?sprzedazKanalyMagazynowe(30):{razem:{},sklep:{},allegro:{}},spr=kanalySpr.razem,prog=Math.max(0,Number(u.progNiski)||5);
  const wszystkie=aktywna==="ruchy"?[]:produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const supplierStats=aktywna==="pulpit"||aktywna==="dostawcy"?statystykiDostepnosciProducentow():{rows:[],bezLinku:[],dostepne:[],niskie:[],braki:[],nieznane:[],wymagajaDecyzji:[],aktywneDecyzje:[],wygasleDecyzje:[]},supplierQuery=String(szukajProducentowMagazynu||"").toLowerCase().trim();
  let supplierRows=[];
  if(aktywna==="dostawcy"){
    supplierRows=(filtrProducentowMagazynu==="bez_linku"?supplierStats.bezLinku.map(p=>({p,i:producentDostepnoscInfo(p),priority:priorytetDostepnosciProduktu(p),rank:0})):supplierStats.rows).filter(({p,i,priority})=>{const decision=decyzjaProducentaInfo(p);if(supplierQuery&&!`${p.nazwa||""} ${p.sku||""} ${p.gtin||p.ean||""} ${p.producent||""} ${i.url}`.toLowerCase().includes(supplierQuery))return false;if(filtrProducentowMagazynu==="alerty"&&!i.alert)return false;if(filtrProducentowMagazynu==="bestsellery"&&!priority?.score)return false;if(filtrProducentowMagazynu==="niski"&&i.status!=="niski")return false;if(filtrProducentowMagazynu==="brak"&&i.status!=="brak")return false;if(filtrProducentowMagazynu==="decyzje"&&(!["brak","niski"].includes(i.status)||(decision.code&&!decision.expired)))return false;if(filtrProducentowMagazynu==="wygasle"&&!decision.expired)return false;if(filtrProducentowMagazynu==="aktywne_decyzje"&&(!decision.code||decision.expired))return false;if(filtrProducentowMagazynu==="nieznane"&&i.url&&!i.stale&&!["nieznany","blad"].includes(i.status))return false;if(filtrProducentowMagazynu==="dostepne"&&!["dostepny","dostepny_nieznany"].includes(i.status))return false;return true;});
    const supplierRank={brak:0,niski:1,blad:2,nieznany:2,dostepny_nieznany:3,dostepny:4};supplierRows.sort((a,b)=>Number(b.priority?.score||0)-Number(a.priority?.score||0)||(supplierRank[a.i.status]??5)-(supplierRank[b.i.status]??5)||(a.i.quantity??Number.MAX_SAFE_INTEGER)-(b.i.quantity??Number.MAX_SAFE_INTEGER)||String(a.p.nazwa||"").localeCompare(String(b.p.nazwa||""),"pl"));
    dostepnoscProducentowWynikiIds=supplierRows.map(({p})=>p.id);dostepnoscProducentowStronaIds=supplierRows.slice(0,500).map(({p})=>p.id);
  }
  const bestselleryProducentow=aktywna==="dostawcy"?supplierStats.rows.filter(x=>Number(x.priority?.score||0)>0):[],bestselleryNieaktualne=bestselleryProducentow.filter(x=>x.i.stale||["nieznany","blad"].includes(x.i.status));
  const monitorowane=aktywna==="pulpit"?wszystkie.filter(p=>stanMagazynuId(p.id)!==null):[];
  const zarezerwowane=aktywna==="pulpit"?Object.values(rez).reduce((s,n)=>s+Number(n||0),0):0;
  const wartosc=aktywna==="pulpit"?monitorowane.reduce((s,p)=>s+(stanMagazynuId(p.id)||0)*kwotaNum(p.cena),0):0;
  const planZakupu=wymagaStanow?potrzebyZatowarowania():[];
  const planProdukty=planZakupu.map(x=>x.produkt),planIds=new Set(planProdukty.map(p=>String(p.id)));
  const wartoscPlanu=planZakupu.reduce((s,x)=>s+kwotaNum(x.ilosc*kwotaNum(x.produkt.cena)),0);
  const nadrezerwacje=wymagaStanow?wszystkie.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;}):[];
  const brakiDostawcyPlanu=planProdukty.filter(p=>!magazynMetaProduktu(p.id).dostawca);
  const bestselleryMagazynu=aktywna==="stany"?wszystkie.filter(p=>priorytetDostepnosciProduktu(p,kanalySpr,rez).score>0):[];
  const stareInwentaryzacje=aktywna==="stany"?planProdukty.filter(p=>{const d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja,t=d?Date.parse(d):0;return !t||Date.now()-t>90*86400000;}):[];
  const alertyStanow=planProdukty;
  const wymagaLokalizacji=aktywna==="pulpit"||aktywna==="stany"||aktywna==="lokalizacje",lokalizacje=wymagaLokalizacji?magazynLokalizacjeAktywne():[],statLok=wymagaLokalizacji?statystykiLokalizacji(wszystkie):{};
  const dostawcyMag=aktywna==="stany"?[...new Set(wszystkie.map(p=>magazynMetaProduktu(p.id).dostawca).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl")):[];
  const pozaSlownikiem=Object.keys(statLok).filter(k=>k!=="BRAK" && !magazynLokalizacjaPoKodzie(k));
  const pozycjeAktywnychZamowien=wymagaStanow?[...pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).flatMap(pozycjeZamowieniaMagazyn),...aktywneZamowieniaAllegro().flatMap(pozycjeAllegroMagazyn).filter(p=>p.id!=="")]:[];
  const aktywneIds=[...new Set(pozycjeAktywnychZamowien.map(p=>String(p.id)).filter(Boolean))],produktyAktywne=aktywneIds.map(produktMagazynowy).filter(Boolean);
  const lokalizacjeDoUstalenia=wymagaStanow?produktyAktywne.filter(p=>{const stan=stanMagazynuId(p.id);return stan!==null&&stan>=Number(rez[p.id]||0)&&!magazynMetaProduktu(p.id).lokalizacja;}):[];
  if(wymagaStanow)magazynLokalizacjeZamowienIds=new Set(lokalizacjeDoUstalenia.map(p=>String(p.id)));
  const lokDoKompletacji=aktywna==="pulpit"?[...new Set(produktyAktywne.map(p=>magazynMetaProduktu(p.id).lokalizacja).filter(Boolean))]:[];
  const pracaMagazynu=aktywna==="pulpit"?[
    ...supplierStats.braki.filter(({p})=>planIds.has(String(p.id))).slice(0,4).map(({p})=>({lvl:"bad",ico:"🔴",tytul:p.nazwa,opis:"Producent zgłasza brak produktu potrzebnego do aktywnego zamówienia.",href:"#/admin/magazyn/dostawcy"})),
    ...supplierStats.niskie.filter(({p})=>planIds.has(String(p.id))).slice(0,4).map(({p,i})=>({lvl:"warn",ico:"🟡",tytul:p.nazwa,opis:`Produkt potrzebny do zamówienia • u producenta ${i.quantity} szt. • próg ${i.prog}.`,href:"#/admin/magazyn/dostawcy"})),
    ...nadrezerwacje.slice(0,4).map(p=>({lvl:"bad",ico:"🚨",tytul:p.nazwa,opis:`Nadrezerwacja: dostępne ${dostepneSztukiMagazynu(p,rez)} szt., rezerwacje ${rez[p.id]||0}.`,akcja:"dozamowienia"})),
    ...planZakupu.slice(0,4).map(x=>({lvl:"warn",ico:"📦",tytul:x.produkt.nazwa,opis:`Do zamówienia: ${x.ilosc} szt. • dostawca: ${x.meta.dostawca||"do przypisania"}.`,akcja:"dozamowienia"})),
    ...lokalizacjeDoUstalenia.slice(0,4).map(p=>({lvl:"info",ico:"📍",tytul:p.nazwa,opis:`Stan pokrywa aktywne zamówienia. Towar jest zarezerwowany; ustal wyłącznie jego fizyczną lokalizację.`,akcja:"lokalizacje-zamowien"})),
    ...brakiDostawcyPlanu.slice(0,4).map(p=>({lvl:"info",ico:"🏭",tytul:p.nazwa,opis:"Realny brak do zamówienia nie ma przypisanego dostawcy.",akcja:"bezdostawcy"}))
  ].slice(0,8):[];
  let lista=[],liczbaStron=1,fragment=[];
  if(aktywna==="stany"){
    lista=filtrujProduktyMagazynu(wszystkie,rez,spr);
    liczbaStron=Math.max(1,Math.ceil(lista.length/magazynNaStronie));
    stronaMagazynu=Math.min(Math.max(1,stronaMagazynu),liczbaStron);
    fragment=lista.slice((stronaMagazynu-1)*magazynNaStronie,stronaMagazynu*magazynNaStronie);
    magazynWynikiIds=lista.map(p=>p.id);magazynStronaIds=fragment.map(p=>p.id);
  }
  const ruchyWszystkie=aktywna==="ruchy"?[...(ruchyMagazynowe||[])]:[],ruchyPoTypie=aktywna==="ruchy"?ruchyWszystkie.filter(ruchMagazynuPasujeDoTypu).slice(0,limitRuchowMagazynu):[],ruchyFiltrowane=aktywna==="ruchy"?ruchyPoTypie.filter(ruchMagazynuPasujeDoFiltra):[];
  const ruchyPrzyjecia=aktywna==="ruchy"?ruchyWszystkie.filter(r=>Number(r.ilosc||0)>0).reduce((s,r)=>s+Number(r.ilosc||0),0):0,ruchyRozchody=aktywna==="ruchy"?Math.abs(ruchyWszystkie.filter(r=>Number(r.ilosc||0)<0).reduce((s,r)=>s+Number(r.ilosc||0),0)):0,ruchyDokumenty=aktywna==="ruchy"?new Set(ruchyWszystkie.map(r=>String(r.dokument||"").trim()).filter(Boolean)).size:0;
  return adminSzkielet("/admin/magazyn", `
  ${magazynSubnavHTML(aktywna)}
  <div class="warehouse-workspace">
  ${magazynKontekstPodstronyHTML(aktywna,u)}
  ${aktywna==="pulpit"?`<section class="panel warehouse-dashboard-metrics"><div class="warehouse-section-title"><div><small>Sytuacja operacyjna</small><h2>Najważniejsze wskaźniki</h2></div><div class="diag-actions"><button class="btn ghost" onclick="eksportujZatowarowanieCSV()">📊 Prognoza wartościowa</button><a class="btn ghost" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a></div></div><nav class="warehouse-dashboard-flow" aria-label="Główny proces magazynowy"><a href="#/admin/magazyn/dostawcy"><span>1</span><div><b>Sprawdź dostawców</b><small>${supplierStats.braki.length+supplierStats.niskie.length} alarmów dostępności</small></div></a><a href="#/admin/magazyn/stany"><span>2</span><div><b>Zweryfikuj pokrycie</b><small>${nadrezerwacje.length} nadrezerwacji • ${zarezerwowane} szt. zarezerwowanych</small></div></a><a href="#/admin/magazyn/plan"><span>3</span><div><b>Zamów lub przyjmij</b><small>${planZakupu.length} pozycji do Planu</small></div></a><a href="#/admin/magazyn/lokalizacje"><span>4</span><div><b>Rozmieść i kompletuj</b><small>${lokalizacjeDoUstalenia.length} lokalizacji do ustalenia</small></div></a></nav><div class="orders-stat-grid">
      <button class="order-stat-card stat-filter money" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='dostepne'"><span>🏭</span><b>${supplierStats.dostepne.length}</b><small>dostępne u producentów</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.niskie.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='niski'"><span>🟡</span><b>${supplierStats.niskie.length}</b><small>niski stan u producenta ≤ ${esc(u.progNiskiProducenta)}</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.braki.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='brak'"><span>🔴</span><b>${supplierStats.braki.length}</b><small>brak u producenta</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.nieznane.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='nieznane'"><span>⚪</span><b>${supplierStats.nieznane.length}</b><small>niepotwierdzone / nieaktualne</small></button>
      <button class="order-stat-card stat-filter ${filtrMagazynu==="rezerwacje"?"active":""}" type="button" onclick="ustawFiltrMagazynu('rezerwacje','rezerwacje')"><span>🧾</span><b>${zarezerwowane}</b><small>szt. w aktywnych zamówieniach</small></button>
      <button class="order-stat-card stat-filter money ${filtrMagazynu==="wszystkie"&&sortowanieMagazynu==="wartosc"?"active":""}" type="button" onclick="ustawFiltrMagazynu('wszystkie','wartosc')"><span>💰</span><b>${zl(wartosc)}</b><small>wartość stanów</small></button>
      <button class="order-stat-card stat-filter ${planZakupu.length?"hot":""} ${filtrMagazynu==="dozamowienia"?"active":""}" type="button" onclick="ustawFiltrMagazynu('dozamowienia','zakup')"><span>📦</span><b>${planZakupu.length}</b><small>braki do zamówień (${zl(wartoscPlanu)})</small></button>
      <button class="order-stat-card stat-filter ${nadrezerwacje.length?"hot":""} ${filtrMagazynu==="nadrezerwacja"?"active":""}" type="button" onclick="ustawFiltrMagazynu('nadrezerwacja','dostepne')"><span>🚨</span><b>${nadrezerwacje.length}</b><small>nadrezerwacje</small></button>
      <button class="order-stat-card stat-filter ${lokalizacjeDoUstalenia.length?"hot":""} ${filtrMagazynu==="lokalizacje-zamowien"?"active":""}" type="button" onclick="ustawFiltrMagazynu('lokalizacje-zamowien','priorytet')"><span>📍</span><b>${lokalizacjeDoUstalenia.length}</b><small>lokalizacje do ustalenia • nie blokują realizacji</small></button>
      <button class="order-stat-card stat-filter ${brakiDostawcyPlanu.length?"hot":""} ${filtrMagazynu==="bezdostawcy"?"active":""}" type="button" onclick="ustawFiltrMagazynu('bezdostawcy','zakup')"><span>🏭</span><b>${brakiDostawcyPlanu.length}</b><small>brak dostawcy w Planie</small></button>
      <button class="order-stat-card stat-filter ${pozaSlownikiem.length?"hot":""}" type="button" onclick="document.getElementById('warehouseLocationForm')?.scrollIntoView({behavior:'smooth',block:'center'})"><span>🗺️</span><b>${lokalizacje.length}</b><small>lokalizacji w słowniku</small></button>
    </div></section>`:""}
  ${aktywna==="dostawcy"?`<div class="panel supplier-monitor-panel" data-stable-key="supplier-availability">
    <div class="order-section-head">
      <div><span class="order-pro-label">Priorytet bestsellerów</span><h2 style="margin-top:.25rem">🏭 Dostępność u producentów</h2><p class="order-detail-lead">Agent co 6 godzin zawsze zaczyna od najlepiej sprzedających się produktów w Allegro i sklepie oraz pozycji z aktywnych zamówień. Zajmują one do 75% każdej próbki; pozostałe miejsca są losowane spośród najdłużej niesprawdzanych produktów.</p></div>
      <div class="diag-actions"><button class="btn" onclick="agentAISprawdzDostepnoscProducentow()">🤖 Sprawdź bestsellery + próbkę (${esc(u.producentProbka)})</button><button class="btn ghost" onclick="agentAISprawdzDostepnoscProducentow(25)">Pełna partia priorytetowa (25)</button></div>
    </div>
    <div class="orders-stat-grid supplier-monitor-stats"><button class="order-stat-card ${supplierStats.wymagajaDecyzji.length?"hot":""}" onclick="filtrProducentowMagazynu='decyzje';odswiezMonitoringProducentow()"><span>🧭</span><b>${supplierStats.wymagajaDecyzji.length}</b><small>wymaga decyzji sprzedażowej</small></button><button class="order-stat-card money" onclick="filtrProducentowMagazynu='aktywne_decyzje';odswiezMonitoringProducentow()"><span>✅</span><b>${supplierStats.aktywneDecyzje.length}</b><small>aktywnych decyzji</small></button><button class="order-stat-card ${supplierStats.wygasleDecyzje.length?"hot":""}" onclick="filtrProducentowMagazynu='wygasle';odswiezMonitoringProducentow()"><span>⏰</span><b>${supplierStats.wygasleDecyzje.length}</b><small>wygasłych terminów</small></button><div class="order-stat-card money"><span>🏆</span><b>${bestselleryProducentow.length}</b><small>bestsellerów z linkiem</small></div><div class="order-stat-card ${bestselleryNieaktualne.length?"hot":""}"><span>⏱️</span><b>${bestselleryNieaktualne.length}</b><small>priorytetowych do kontroli</small></div><div class="order-stat-card ${supplierStats.niskie.length?"hot":""}"><span>🟡</span><b>${supplierStats.niskie.length}</b><small>niski stan ≤ ${esc(u.progNiskiProducenta)} szt.</small></div><div class="order-stat-card ${supplierStats.braki.length?"hot":""}"><span>🔴</span><b>${supplierStats.braki.length}</b><small>brak u producenta</small></div><div class="order-stat-card ${supplierStats.nieznane.length?"hot":""}"><span>⚪</span><b>${supplierStats.nieznane.length}</b><small>nieznane / starsze niż ${esc(u.producentMaxWiekGodz)} h</small></div><div class="order-stat-card"><span>🔗</span><b>${supplierStats.bezLinku.length}</b><small>bez linku źródłowego</small></div></div>
    ${adminWyszukiwaniePanelHTML({id:"supplier-availability",description:"Nazwa, SKU, EAN, producent, adres źródłowy i status decyzji sprzedażowej.",results:supplierRows.length,active:!!(supplierQuery||filtrProducentowMagazynu!=="decyzje"),open:true,fields:`<div class="supplier-monitor-toolbar"><input placeholder="Szukaj: nazwa, SKU, EAN, producent lub URL…" value="${esc(szukajProducentowMagazynu)}" oninput="szukajProducentowMagazynu=this.value;clearTimeout(window.__supplierSearch);window.__supplierSearch=setTimeout(()=>odswiezMonitoringProducentow(),180)"><select onchange="filtrProducentowMagazynu=this.value;odswiezMonitoringProducentow()">${[["decyzje","Wymagają decyzji"],["wygasle","Wygasłe decyzje"],["aktywne_decyzje","Aktywne decyzje"],["alerty","Wszystkie ostrzeżenia"],["bestsellery","Bestsellery sklepu i Allegro"],["wszystkie","Wszystkie z linkiem"],["niski","Niski stan"],["brak","Brak u producenta"],["nieznane","Niepotwierdzone / nieaktualne"],["dostepne","Dostępne"],["bez_linku","Bez linku źródłowego"]].map(([v,l])=>`<option value="${v}" ${filtrProducentowMagazynu===v?"selected":""}>${l}</option>`).join("")}</select><span><b>${supplierRows.length}</b> wyników</span></div>`,actions:adminOperacjeWynikowHTML({id:"supplier-availability",selected:zaznaczoneDostepnoscProducentow.size,pageCount:dostepnoscProducentowStronaIds.length,resultCount:supplierRows.length,selectPage:"ustawZaznaczenieDostepnosciProducentow('strona')",selectAll:supplierRows.length<=500?"ustawZaznaczenieDostepnosciProducentow('filtr')":"",clear:"wyczyscZaznaczenieDostepnosciProducentow()",extra:grupowaDecyzjaProducentaHTML()})})}
    <div class="warehouse-worktable-wrap"><table class="log-table supplier-monitor-table"><tr><th>Produkt i identyfikatory</th><th>Priorytet sprzedaży</th><th>Źródło i dostępność</th><th>Decyzja sprzedażowa</th><th>Kontrola i historia</th><th>Akcje</th></tr>${supplierRows.slice(0,500).map(magazynDostawcaWierszHTML).join("")||`<tr><td colspan="6">Brak produktów pasujących do filtra.</td></tr>`}</table></div>
    <div class="backend-note allegro-info-bottom"><b>Zasada decyzji:</b> brak lokalnego stanu nie wyłącza produktu ze sprzedaży. Alarm powstaje przede wszystkim wtedy, gdy producent zgłasza brak albo ujawniony stan spada do ${esc(u.progNiskiProducenta)} szt. lub mniej. Błąd pobrania nie jest traktowany jako brak — zostaje oznaczony do ponownej kontroli.</div>
  </div>`:""}
  ${aktywna==="pulpit"?`<div class="panel warehouse-ops-panel">
    <div class="order-section-head">
      <div>
        <h2 style="margin-top:0">🧭 Operacje magazynu dzisiaj</h2>
        <p class="order-detail-lead">Kolejka pracy pod aktywne zamówienia: najpierw nadrezerwacje, potem braki i kartoteka.</p>
      </div>
      <div class="diag-actions" style="margin-top:0"><button class="btn ghost" onclick="agentAIWstawKomende('przygotuj zamówienie do producenta');location.hash='#/admin/agent-ai'">Zapytaj agenta</button></div>
    </div>
    <div class="warehouse-ops-grid">
      <div class="warehouse-ops-summary">
        <span><b>${lokDoKompletacji.length}</b><small>lokalizacji do przejścia</small></span>
        <span><b>${planZakupu.length}</b><small>pozycji brakujących do zamówień</small></span>
        <span><b>${lokalizacjeDoUstalenia.length}</b><small>lokalizacji do ustalenia przez magazyn</small></span>
        <span><b>${brakiDostawcyPlanu.length}</b><small>braków dostawcy w Planie</small></span>
        <span><b>${nadrezerwacje.length}</b><small>nadrezerwacji</small></span>
      </div>
      <div class="warehouse-pick-route">
        <b>Trasa kompletacji</b>
        <p>${lokDoKompletacji.length?lokDoKompletacji.map(k=>`<span>${esc(nazwaLokalizacjiMagazynu(k))}</span>`).join(""):lokalizacjeDoUstalenia.length?`<span>Towar jest zarezerwowany — lokalizacje są w osobnej kolejce magazynu</span>`:`<span>Brak aktywnej trasy kompletacji</span>`}</p>
      </div>
    </div>
    <div class="warehouse-work-list">
      ${pracaMagazynu.length?pracaMagazynu.map(x=>`<button class="warehouse-work-item ${x.lvl}" onclick="${x.href?`location.hash=${jsArg(x.href)}`:`ustawFiltrMagazynu(${jsArg(x.akcja||"wszystkie")},'ryzyko')`}">
        <span>${x.ico}</span><b>${esc(x.tytul)}</b><small>${esc(x.opis)}</small>
      </button>`).join(""):`<div class="warehouse-work-empty">✅ Brak pilnych prac magazynowych wynikających z aktywnych zamówień.</div>`}
    </div>
  </div>`:""}
  ${aktywna==="lokalizacje"?magazynLokalizacjePanelHTML(lokalizacje,statLok,pozaSlownikiem):""}
  ${aktywna==="plan"?`<div id="warehouseRestockWorkspace" class="warehouse-restock-workspace">${magazynPlanZatowarowaniaHTML()}</div>`:""}
  ${aktywna==="stany"?`<div class="panel warehouse-stock-page">
    <div class="order-section-head warehouse-stock-head">
      <div><span class="order-pro-label">Centrum kontroli zapasu</span><h2>📋 Stany produktów</h2><p class="order-detail-lead">Jeden czytelny widok łączy dostępność producenta, sprzedaż Allegro i sklepu, rezerwacje, fizyczny zapas, lokalizację oraz decyzję o domówieniu.</p></div>
      <div class="diag-actions"><button class="btn" data-stock-confirm-visible onclick='potwierdzWidoczneStanyMagazynu(${JSON.stringify(fragment.map(p=>p.id))})'>✅ Potwierdź ${fragment.length} widocznych</button><button class="btn ghost" onclick="eksportujMagazynCSV()">📤 Eksport CSV</button><button class="btn ghost" onclick="wyczyscFiltryStanowMagazynu()">Wyczyść filtry</button></div>
    </div>
    <div class="warehouse-stock-summary">
      <button class="stock-summary-card ${filtrMagazynu==="bestsellery"?"active":""}" onclick="ustawFiltrMagazynu('bestsellery','priorytet')"><span>🏆</span><b>${bestselleryMagazynu.length}</b><small>bestsellerów i aktywnych</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="alerty"?"active":""} ${alertyStanow.length?"alert":""}" onclick="ustawFiltrMagazynu('alerty','ryzyko')"><span>🚨</span><b>${alertyStanow.length}</b><small>alertów operacyjnych</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="dozamowienia"?"active":""}" onclick="ustawFiltrMagazynu('dozamowienia','zakup')"><span>📦</span><b>${planZakupu.length}</b><small>produktów do zamówienia</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="nadrezerwacja"?"active":""}" onclick="ustawFiltrMagazynu('nadrezerwacja','dostepne')"><span>🧾</span><b>${nadrezerwacje.length}</b><small>nadrezerwacji</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="lokalizacje-zamowien"?"active":""}" onclick="ustawFiltrMagazynu('lokalizacje-zamowien','priorytet')"><span>🗺️</span><b>${lokalizacjeDoUstalenia.length}</b><small>lokalizacje aktywnych zamówień</small></button>
      <button class="stock-summary-card ${filtrInwentaryzacjiMagazynu==="stara"?"active":""}" onclick="filtrInwentaryzacjiMagazynu='stara';stronaMagazynu=1;renderuj()"><span>📅</span><b>${stareInwentaryzacje.length}</b><small>stanów do potwierdzenia</small></button>
    </div>
    <div class="warehouse-stock-quickfilters" aria-label="Szybkie filtry">
      ${[["wszystkie","Wszystkie"],["bestsellery","🏆 Bestsellery"],["producent-brak","🔴 Brak u producenta"],["producent-niski","🟡 Niski u producenta"],["dozamowienia","📦 Do zamówienia"],["rezerwacje","🧾 Z rezerwacją"],["lokalizacje-zamowien","📍 Lokalizacja do zamówień"],["bezlokalizacji","🗺️ Wszystkie bez lokalizacji"],["bezdostawcy","🏭 Bez dostawcy"]].map(([v,t])=>`<button type="button" class="${filtrMagazynu===v?"active":""}" onclick="ustawFiltrMagazynu(${jsArg(v)},${jsArg(v==="bestsellery"?"priorytet":v==="dozamowienia"?"zakup":"ryzyko")})">${t}</button>`).join("")}
    </div>
    ${adminWyszukiwaniePanelHTML({id:"warehouse-stock",description:"Nazwa i identyfikatory produktu, status, dostawca, lokalizacja, inwentaryzacja oraz sortowanie.",results:lista.length,active:!!(frazaMagazynu||filtrMagazynu!=="wszystkie"||filtrDostawcyMagazynu!=="wszyscy"||filtrLokalizacjiMagazynu!=="wszystkie"||filtrInwentaryzacjiMagazynu!=="wszystkie"),open:true,fields:`<div class="warehouse-stock-toolbar admin-search-full">
      <label class="warehouse-stock-search"><span>Wyszukaj produkt</span><input data-warehouse-stock-search placeholder="Nazwa, SKU, EAN, ID, kategoria, lokalizacja lub dostawca…" value="${esc(frazaMagazynu)}" oninput="magazynSzukajProdukty(this)" autocomplete="off"></label>
      <label><span>Status</span><select onchange="filtrMagazynu=this.value;stronaMagazynu=1;renderuj()">${[["wszystkie","Wszystkie produkty"],["alerty","Wszystkie alerty"],["bestsellery","Bestsellery / aktywne"],["producent-niski","Producent: niski stan"],["producent-brak","Producent: brak"],["producent-nieznany","Producent: niepotwierdzone"],["dozamowienia","Braki do zamówień"],["nadrezerwacja","Nadrezerwacje"],["monitorowane","Monitorowane lokalnie"],["bezlimitu","Lokalnie bez limitu"],["niskie","Lokalny niski stan"],["brak","Lokalny stan zerowy"],["rezerwacje","Z rezerwacją"],["sprzedaz","Sprzedane 30 dni"],["lokalizacje-zamowien","Lokalizacja do aktywnych zamówień"],["bezlokalizacji","Wszystkie bez lokalizacji"],["bezdostawcy","Bez dostawcy"]].map(([v,t])=>`<option value="${v}" ${filtrMagazynu===v?"selected":""}>${t}</option>`).join("")}</select></label>
      <label><span>Sortowanie</span><select onchange="sortowanieMagazynu=this.value;stronaMagazynu=1;renderuj()">${[["ryzyko","Priorytet operacyjny"],["priorytet","Bestsellery najpierw"],["producent","Stan u producenta"],["zakup","Największe braki"],["dostepne","Dostępne po rezerwacji"],["stan","Stan lokalny rosnąco"],["nazwa","Nazwa A–Z"],["rezerwacje","Rezerwacje"],["sprzedaz","Sprzedaż 30 dni"],["wartosc","Wartość stanu"]].map(([v,t])=>`<option value="${v}" ${sortowanieMagazynu===v?"selected":""}>${t}</option>`).join("")}</select></label>
      <label><span>Dostawca</span><select onchange="filtrDostawcyMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszyscy">Każdy dostawca</option>${dostawcyMag.map(d=>`<option value="${esc(d)}" ${filtrDostawcyMagazynu===d?"selected":""}>${esc(d)}</option>`).join("")}</select></label>
      <label><span>Lokalizacja</span><select onchange="filtrLokalizacjiMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszystkie">Każda lokalizacja</option><option value="BRAK" ${filtrLokalizacjiMagazynu==="BRAK"?"selected":""}>Bez lokalizacji</option>${lokalizacje.map(l=>`<option value="${esc(l.kod)}" ${filtrLokalizacjiMagazynu===l.kod?"selected":""}>${esc(l.kod)} — ${esc(l.nazwa||l.typ)}</option>`).join("")}</select></label>
      <label><span>Inwentaryzacja</span><select onchange="filtrInwentaryzacjiMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszystkie">Każda data</option><option value="aktualna" ${filtrInwentaryzacjiMagazynu==="aktualna"?"selected":""}>Aktualna ≤ 90 dni</option><option value="stara" ${filtrInwentaryzacjiMagazynu==="stara"?"selected":""}>Brak / starsza niż 90 dni</option></select></label>
      <label><span>Na stronie</span><select onchange="ustawMagazynNaStronie(this.value)">${[25,50,100,200,500].map(n=>`<option value="${n}" ${magazynNaStronie===n?"selected":""}>${n} produktów</option>`).join("")}</select></label>
    </div>`,actions:adminOperacjeWynikowHTML({id:"warehouse-stock",selected:zaznaczoneMagazynProdukty.size,pageCount:fragment.length,resultCount:lista.length,selectPage:"magazynUstawZaznaczenie('strona')",selectAll:"magazynUstawZaznaczenie('filtr')",clear:"magazynWyczyscZaznaczenie()",exportSelected:"magazynEksportuj('zaznaczone')",exportAll:"magazynEksportuj('filtr')"})})}
    <div class="warehouse-stock-results"><span>Pokazano <b>${fragment.length}</b> z <b>${lista.length}</b> produktów</span><span>Strona ${stronaMagazynu} z ${liczbaStron}</span></div>
    <div class="pagination">${paginacjaHTML(stronaMagazynu,liczbaStron,"ustawStroneMagazynu")}</div>
    ${magazynLokalizacjeDatalistHTML("warehouseStockLocationOptions")}
    <div class="warehouse-stock-list">
      ${fragment.length?magazynStanyPrzygotujKartyProgresywnie(fragment,{rez,spr,kanalySpr,prog}):`<div class="warehouse-stock-empty"><b>Brak produktów pasujących do filtrów</b><p>Wyczyść filtry albo zmień kryteria wyszukiwania.</p><button class="btn" onclick="wyczyscFiltryStanowMagazynu()">Pokaż wszystkie</button></div>`}
    </div>
    <div class="pagination">${paginacjaHTML(stronaMagazynu,liczbaStron,"ustawStroneMagazynu")}</div>
  </div>`:""}
  ${aktywna==="ruchy"?`<section class="warehouse-movements-overview" aria-label="Podsumowanie ruchów"><div class="warehouse-movement-stat"><span>📥</span><b>+${esc(ruchyPrzyjecia)}</b><small>szt. przyjętych w historii</small></div><div class="warehouse-movement-stat"><span>📤</span><b>−${esc(ruchyRozchody)}</b><small>szt. wydanych w historii</small></div><div class="warehouse-movement-stat"><span>📄</span><b>${esc(ruchyDokumenty)}</b><small>dokumentów źródłowych</small></div><div class="warehouse-movement-stat"><span>🔎</span><b data-warehouse-movement-count>${esc(ruchyFiltrowane.length)}</b><small>ruchów w bieżącym widoku</small></div></section><div class="warehouse-columns">
    <section class="panel">
      <div class="warehouse-section-title"><div><small>Pełny ślad audytowy</small><h2>Historia ruchów</h2></div><a class="btn ghost" href="#/admin/magazyn/plan">📄 Dokumenty PZ/WZ</a></div>
      <p>Przyjęcia, rozchody i korekty są wyszukiwane bez przeładowywania danych produktowych. Filtr nie zmienia stanów.</p>
      <div class="warehouse-movement-toolbar"><input placeholder="Produkt, SKU, ID, dokument lub powód…" value="${esc(szukajRuchowMagazynu)}" oninput="magazynSzukajRuchy(this)"><select onchange="filtrRuchowMagazynu=this.value;renderuj()">${[["wszystkie","Wszystkie ruchy"],["przyjecia","Tylko przyjęcia"],["rozchody","Tylko rozchody"],["korekty","Tylko korekty"],["dokumenty","Z dokumentem"]].map(([v,l])=>`<option value="${v}" ${filtrRuchowMagazynu===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="limitRuchowMagazynu=Number(this.value)||100;renderuj()">${[50,100,250,500].map(n=>`<option value="${n}" ${limitRuchowMagazynu===n?"selected":""}>Pokaż ${n}</option>`).join("")}</select><button class="btn ghost" onclick="magazynEksportujRuchyCSV()">📤 Eksport CSV</button></div>
      <div style="overflow-x:auto"><table class="log-table"><tr><th>Data</th><th>Operacja</th><th>Produkt i przyczyna</th><th>Ilość</th><th>Zmiana stanu</th><th>Dokument</th></tr>${ruchyPoTypie.map(r=>`<tr data-warehouse-movement data-search="${esc(ruchMagazynuTekst(r))}" ${ruchMagazynuPasujeDoFiltra(r)?"":"hidden"}><td>${esc(r.dataTxt||new Date(r.data).toLocaleString("pl-PL"))}</td><td><span class="lvl lvl-info">${esc(r.typ||"ruch")}</span></td><td><b>${esc(r.produktNazwa||"Produkt")}</b><br><small>${esc(r.sku||r.produktId||"")}${r.powod?` • ${esc(r.powod)}`:""}</small></td><td><b class="warehouse-movement-qty ${Number(r.ilosc)>0?"is-in":"is-out"}">${Number(r.ilosc)>0?"+":""}${esc(r.ilosc)}</b></td><td>${r.stanPrzed===null?"∞":esc(r.stanPrzed)} → ${r.stanPo===null?"∞":esc(r.stanPo)}</td><td>${esc(r.dokument||"—")}</td></tr>`).join("")||`<tr><td colspan="6">Brak ruchów pasujących do filtrów.</td></tr>`}</table></div>
    </section>
    <aside class="panel">
      <div class="warehouse-section-title"><div><small>Konfiguracja globalna</small><h2>Ustawienia magazynu</h2></div></div>
      <div class="warehouse-settings-note"><b>Zakres tej karty:</b> wartości domyślne dla nowych kartotek i monitoringu. Zmiana nie nadpisuje automatycznie istniejących produktów.</div>
      <form onsubmit="zapiszUstawieniaMagazynu(event)">
        <div class="f-group"><label>Nazwa magazynu</label><input name="nazwa" value="${esc(u.nazwa)}"></div>
        <div class="f-row"><div class="f-group"><label>Próg niskiego stanu</label><input name="progNiski" inputmode="numeric" value="${esc(prog)}"></div><div class="f-group"><label>Operator domyślny</label><input name="operator" value="${esc(u.domyslnyOperator)}"></div></div>
        <div class="f-group"><label>Lokalizacja / uwagi</label><input name="lokalizacja" value="${esc(u.lokalizacja)}" placeholder="np. regał, pomieszczenie, adres"></div>
        <div class="f-row"><div class="f-group"><label>Domyślny dostawca</label><input name="domyslnyDostawca" value="${esc(u.domyslnyDostawca)}" placeholder="np. Pinkfrog / hurtownia"></div><div class="f-group"><label>Domyślny czas dostawy (dni)</label><input name="domyslnyLeadTime" inputmode="numeric" value="${esc(u.domyslnyLeadTime)}"></div></div>
        <div class="f-row"><div class="f-group"><label>Zapas docelowy (dni)</label><input name="domyslnyZapasDni" inputmode="numeric" value="${esc(u.domyslnyZapasDni)}"></div><div class="f-group"><label>Akcja kartoteki</label><button class="btn ghost" type="button" onclick="wypelnijDomyslnaKartotekeMagazynu()">Uzupełnij braki domyślnymi danymi</button></div></div>
        <h2>🏭 Monitoring producentów</h2>
        <p class="order-detail-lead">Automatyczny Agent AI co 6 godzin losuje spośród najdłużej niesprawdzanych linków. Telegram jest wysyłany tylko po pojawieniu się nowego niskiego stanu albo braku.</p>
        <div class="f-row"><div class="f-group"><label>Próg ostrzeżenia u producenta (szt.)</label><input name="progNiskiProducenta" type="number" min="1" value="${esc(u.progNiskiProducenta)}"></div><div class="f-group"><label>Wielkość wyrywkowej próbki</label><input name="producentProbka" type="number" min="1" max="25" value="${esc(u.producentProbka)}"></div></div>
        <div class="f-group"><label>Po ilu godzinach wynik uznać za nieaktualny</label><input name="producentMaxWiekGodz" type="number" min="1" value="${esc(u.producentMaxWiekGodz)}"></div>
        <button class="btn" type="submit">💾 Zapisz ustawienia</button>
      </form>
    </aside>
  </div>`:""}
  </div>
  `);
}
function asortymentKartaProduktuHTML(p={},ukrytaKopia=false){
  const dodany=jestProduktemDodanym(p.id),ukryty=czyProduktAdminWKoszu(p),edytowany=!!produktyEdytowane[p.id],selected=zaznaczoneProdukty.has(p.id)||zaznaczoneProdukty.has(String(p.id));
  const braki=asortymentBrakiDanych(p),sourceUrl=String(p.sourceUrl||p.producentUrl||p.urlProducenta||"").trim(),image=p.zdjecie||(Array.isArray(p.zdjecia)?p.zdjecia[0]:"")||"";
  const cena=kwotaNum(p.cena),cenaAllegro=kwotaNum(p.cenaAllegro||p.cena),promocja=Number(p.staraCena)>cena?Math.max(0,Math.round((1-cena/Number(p.staraCena))*100)):0,stan=stanyProduktow[p.id];
  const availabilityLabel=produktAutomatycznieNiedostepny(p)?"Sprawdź oba kanały":produktOznaczonyNiedostepny(p)?"Wznów sklep + Allegro":"Wstrzymaj sklep + Allegro";
  return `<article class="allegro-publication-card catalog-product-card ${selected?"selected is-selected":""} ${ukryty?"deleted":""}" data-assortment-product-card data-assortment-product-key="${esc(p.id)}">
    <label class="allegro-publication-check"><input class="assortment-check" type="checkbox" aria-label="Zaznacz ${esc(p.nazwa||"produkt")}" data-assortment-product-id="${esc(p.id)}" ${selected?"checked":""} onchange="przelaczZaznProd(${jsArg(p.id)})"><span>Zaznacz produkt</span></label>
    <div class="allegro-publication-product catalog-product-identity">${image?`<img src="${esc(image)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="empty-image" style="display:none">${esc(p.ikona||"📦")}</span>`:`<span class="empty-image">${esc(p.ikona||"📦")}</span>`}<div><small class="catalog-column-label">Produkt</small><h3>${esc(p.nazwa||"Produkt bez nazwy")}</h3><p>ID ${esc(p.id)}${dodany?" • dodany":""}${edytowany?" • edytowany":""}${ukryty?" • w koszu":""}${promocja?` • promocja −${promocja}%`:""}</p><div class="allegro-publication-codes"><code>EXTERNAL_ID ${esc(p.externalId||"—")}</code><code>SKU ${esc(p.sku||"—")}</code><code>EAN ${esc(p.gtin||p.ean||"—")}</code></div>${braki.length?`<span class="catalog-product-data-note missing">⚠️ Braki: ${esc(braki.slice(0,3).join(", "))}${braki.length>3?` +${braki.length-3}`:""}</span>`:`<span class="catalog-product-data-note complete">✓ Dane kompletne</span>`}</div></div>
    <div class="catalog-product-classification"><small class="catalog-column-label">Klasyfikacja i źródło</small><b>${esc(p.producent||p.marka||"Bez producenta")}</b><span>${esc(p.kategoria||"Bez kategorii")}</span>${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">Źródło produktu ↗</a>`:`<small>Brak linku źródłowego</small>`}${ukrytaKopia?`<em>Ukryta kopia katalogowa</em>`:""}</div>
    <div class="catalog-product-operational-data"><small class="catalog-column-label">Ceny i magazyn</small><div class="catalog-product-values"><span class="catalog-product-edit-value"><small>Cena sklepu</small><label><input value="${String(cena.toFixed(2)).replace(".",",")}" inputmode="decimal" aria-label="Cena sklepu: ${esc(p.nazwa||"produkt")}" onchange="ustawCene(${jsArg(p.id)},this.value)"><em>zł</em></label></span><span><small>Cena Allegro</small><b>${cenaAllegro>0?zl(cenaAllegro):"—"}</b></span><span><small>Zakup — administrator</small><b>${Number(p.cenaZakupu)>0?zl(p.cenaZakupu):"brak"}</b></span><span class="catalog-product-edit-value"><small>Stan magazynowy</small><label><input value="${stan??""}" placeholder="∞" inputmode="numeric" aria-label="Stan magazynowy: ${esc(p.nazwa||"produkt")}" onchange="ustawStan(${jsArg(p.id)},this.value)" class="${Number(stan)===0?"empty":""}"><em>${stan===undefined||stan===""?"bez limitu":"szt."}</em></label></span></div></div>
    <div class="catalog-product-actions"><small class="catalog-column-label">Sprzedaż, Allegro i akcje</small><div class="catalog-product-channel-summary">${allegroStatusProduktuHTML(p)}</div><div class="catalog-product-sale-status">${dostepnoscBadgeAdmin(p)}</div><button class="btn ghost catalog-product-availability-action" onclick="przelaczDostepnoscProduktu(${jsArg(p.id)})">${availabilityLabel}</button><div class="catalog-product-buttons"><a class="btn" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}" title="Edytuj produkt">✏️ Edytuj</a>${asortymentMenuDzialanProduktuHTML(p)}<button class="btn ghost" onclick="duplikujProdukt(${jsArg(p.id)})" title="Duplikuj produkt">📄 Kopia</button>${ukryty?`<button class="btn ghost" onclick="przywrocProdukt(${jsArg(p.id)})" title="Przywróć">↩️ Przywróć</button>`:`<button class="btn danger" onclick="if(confirm('Przenieść produkt do kosza?')) usunProduktAdmin(${jsArg(p.id)})" title="Przenieś do kosza">🗑️ Kosz</button>`}</div></div>
  </article>`;
}

function widokAdminProdukty(){
  allegroLadujJesliTrzeba("offers");
  const index=asortymentIndeksDanych(),audytAllegro=index.audytAllegro,audytSklep=index.audytSklep,katalogWszystkie=index.source,wyniki=asortymentFiltrowaneProdukty(index),wszystkie=wyniki.items;
  const liczbaWynikow=wszystkie.length;
  const liczbaStron=Math.max(1,Math.ceil(liczbaWynikow/produktyNaStronieAdmin));
  stronaAdminProduktow=Math.min(Math.max(1,stronaAdminProduktow),liczbaStron);
  const fragment=wszystkie.slice((stronaAdminProduktow-1)*produktyNaStronieAdmin,stronaAdminProduktow*produktyNaStronieAdmin);
  asortymentWynikiIds=wyniki.ids;asortymentStronaIds=fragment.map(p=>p.id);
  const katOpcje=index.categories,producenciOpcje=index.producers;
  const bazoweWKoszu=bazoweProduktyWKoszu();
  const liczbaWKoszu=koszDodanych.length+bazoweWKoszu.length;
  const aktywneKarty=index.active,polaczoneAllegro=index.counts.connected,zBrakami=index.counts.missing,gotoweDoSprzedazy=index.counts.ready,ukryteSprzedazowo=index.counts.hidden;
  const zakresOd=liczbaWynikow?(stronaAdminProduktow-1)*produktyNaStronieAdmin+1:0,zakresDo=liczbaWynikow?zakresOd+fragment.length-1:0;
  const aktywneFiltry=[];
  if(szukajProduktow)aktywneFiltry.push(["szukaj",`Fraza: ${szukajProduktow}`]);
  if(filtrProduktow!=="Wszystkie")aktywneFiltry.push(["kategoria",`Kategoria: ${filtrProduktow}`]);
  if(filtrProducentaProduktow!=="wszyscy")aktywneFiltry.push(["producent",`Producent: ${filtrProducentaProduktow}`]);
  if(filtrStatusuProduktow!=="aktywne")aktywneFiltry.push(["status",`Kartoteka: ${filtrStatusuProduktow}`]);
  if(filtrSprzedazyProduktow!=="wszystkie")aktywneFiltry.push(["sprzedaz",`Sprzedaż: ${filtrSprzedazyProduktow}`]);
  if(filtrZrodlaProduktow!=="wszystkie")aktywneFiltry.push(["zrodlo",`Źródło: ${filtrZrodlaProduktow}`]);
  if(filtrDanychProduktow!=="wszystkie")aktywneFiltry.push(["dane",`Dane: ${filtrDanychProduktow}`]);
  if(filtrStanuProduktow!=="wszystkie")aktywneFiltry.push(["stan",`Magazyn: ${filtrStanuProduktow}`]);
  if(filtrAllegroProduktow!=="wszystkie")aktywneFiltry.push(["allegro",`Allegro: ${filtrAllegroProduktow}`]);
  if(filtrPromocjiProduktow!=="wszystkie")aktywneFiltry.push(["promocja",`Oferta: ${filtrPromocjiProduktow}`]);
  if(filtrLinkuProduktow!=="wszystkie")aktywneFiltry.push(["link",`Link producenta: ${filtrLinkuProduktow}`]);
  if(cenaOdAdminProduktow||cenaDoAdminProduktow)aktywneFiltry.push(["cena",`Cena: ${cenaOdAdminProduktow||"0"}–${cenaDoAdminProduktow||"∞"} zł`]);
  if(cenaAllegroOdAdminProduktow||cenaAllegroDoAdminProduktow)aktywneFiltry.push(["cenaAllegro",`Cena Allegro: ${cenaAllegroOdAdminProduktow||"0"}–${cenaAllegroDoAdminProduktow||"∞"} zł`]);
  const aktywnyWidok=filtrStatusuProduktow==="kosz"?"kosz":filtrDanychProduktow==="gotowe"&&filtrSprzedazyProduktow==="dostepne"?"gotowe":filtrDanychProduktow==="braki"?"braki":filtrAllegroProduktow==="brak"?"bez-allegro":filtrSprzedazyProduktow==="niedostepne"?"ukryte":filtrPromocjiProduktow==="promocje"?"promocje":aktywneFiltry.length===0?"aktywne":"";
  const opcje=(lista,wartosc)=>lista.map(([v,l])=>`<option value="${esc(v)}" ${String(wartosc)===String(v)?"selected":""}>${esc(l)}</option>`).join("");
  const kartyProduktowHTML=fragment.length?asortymentPrzygotujKartyProgresywnie(fragment.map(produkt=>({produkt,ukrytaKopia:audytSklep.hiddenIds.has(String(produkt.id))}))):`<div class="allegro-listing-empty assortment-empty"><span>⌕</span><b>Brak produktów pasujących do filtrów</b><small>Usuń wybrane kryteria albo wróć do widoku aktywnych produktów.</small><button class="btn ghost" onclick="asortymentResetujFiltry()">Pokaż aktywne produkty</button></div>`;
  return asortymentSzkielet("produkty", `
    <div class="assortment-catalog-workspace">
      <header class="panel assortment-catalog-hero">
        <div><span class="order-pro-label">Centralna kartoteka sprzedaży</span><h1>🏷️ Katalog produktów</h1><p>Jeden operacyjny widok produktów sklepu, magazynu i Allegro. Wyszukuj po wielu polach, łącz filtry i wykonuj operacje na całym wyniku bez utraty kontekstu.</p><small>${produkty.length} widocznych w sklepie • ${katalogWszystkie.length} wszystkich kart • ${producenciOpcje.length} producentów • wspólna baza danych</small></div>
        <div class="assortment-catalog-actions"><a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a><a class="btn ghost" href="#/admin/produkty/z-pliku">📄 Import linków</a><a class="btn ghost" href="#/admin/mapowanie">🧩 Mapowanie</a><a class="btn ghost" href="#/admin/eksport">⇄ Import / eksport</a><details><summary>Więcej operacji</summary><button class="btn ghost" onclick="eksportujProduktyJSON()">📤 Eksport JSON</button><button class="btn ghost" onclick="eksportujProduktyCSV()">📤 Eksport CSV</button></details></div>
      </header>
      <nav class="assortment-saved-views" aria-label="Szybkie widoki katalogu">
        ${[["aktywne","🏷️ Aktywne",aktywneKarty.length],["gotowe","✅ Gotowe do sprzedaży",gotoweDoSprzedazy],["braki","⚠️ Braki danych",zBrakami],["bez-allegro","🟠 Bez Allegro",aktywneKarty.length-polaczoneAllegro],["ukryte","⏸️ Ukryte sprzedażowo",ukryteSprzedazowo],["promocje","🔥 Promocje",index.counts.promotions],["kosz","🗑️ Kosz",liczbaWKoszu]].map(([v,l,n])=>`<button type="button" class="${aktywnyWidok===v?"active":""}" onclick="asortymentUstawWidok(${jsArg(v)})"><span>${l}</span><b>${n}</b></button>`).join("")}
      </nav>
      <div class="orders-stat-grid assortment-audit-grid admin-pattern-metrics">
        <button class="order-stat-card stat-filter ${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('aktywne')" aria-pressed="${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"}"><span>🏷️</span><b>${aktywneKarty.length}</b><small>aktywne karty produktów</small></button>
        <button class="order-stat-card stat-filter money ${filtrAllegroProduktow==="polaczone"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_polaczone')" aria-pressed="${filtrAllegroProduktow==="polaczone"}"><span>🟠</span><b>${polaczoneAllegro}</b><small>połączone z Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytAllegro.produkty?"hot":"money"} ${filtrAllegroProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_duplikaty')" aria-pressed="${filtrAllegroProduktow==="duplikaty"}"><span>${audytAllegro.produkty?"⚠️":"✅"}</span><b>${audytAllegro.produkty}</b><small>podejrzenie duplikatu Allegro</small></button>
        <button class="order-stat-card stat-filter ${filtrAllegroProduktow==="brak"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_brak')" aria-pressed="${filtrAllegroProduktow==="brak"}"><span>➕</span><b>${aktywneKarty.length-polaczoneAllegro}</b><small>bez oferty Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytSklep.produkty?"hot":"money"} ${filtrStatusuProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('duplikaty_sklepu')" aria-pressed="${filtrStatusuProduktow==="duplikaty"}"><span>${audytSklep.produkty?"🧬":"✅"}</span><b>${audytSklep.produkty}</b><small>karty w grupach duplikatów sklepu</small></button>
      </div>
      <section class="panel assortment-catalog-page admin-pattern-surface allegro-listing-catalog catalog-product-card-center">
      <details class="assortment-maintenance" ${filtrStatusuProduktow==="duplikaty"||filtrAllegroProduktow==="duplikaty"?"open":""}><summary><span><b>🧬 Kontrola duplikatów i porządkowanie</b><small>Rozwiń tylko wtedy, gdy chcesz porównać lub uporządkować powtarzające się karty.</small></span><span><strong>Sklep: ${audytSklep.produkty}</strong><strong>Allegro: ${audytAllegro.produkty}</strong></span></summary><div class="assortment-maintenance-body">
        ${audytSklep.grupy.length?`<section class="allegro-duplicate-center store-duplicate-center"><div class="order-section-head"><div><span class="order-pro-label">Porządkowanie katalogu sklepu</span><h3>Powtarzające się produkty (${audytSklep.grupy.length} grup)</h3><p class="order-detail-lead">Wybierz kartę główną dopiero po porównaniu identyfikatorów i danych.</p></div><button class="btn ghost" onclick="asortymentUstawFiltr('status','duplikaty')">Pokaż wszystkie kopie</button></div><div class="allegro-duplicate-groups">${audytSklep.grupy.slice(0,12).map(g=>`<article class="allegro-duplicate-group"><header><div><b>${esc(g.canonical.nazwa||"Produkt")}</b><small>Wspólny klucz: ${esc(g.keys.join(" • "))}</small></div><span class="lvl lvl-ostrzezenie">${g.produkty.length} kart</span></header><div class="allegro-duplicate-options">${g.produkty.map(p=>`<button type="button" class="allegro-duplicate-option ${String(p.id)===String(g.canonical.id)?"is-canonical":""}" onclick="ustawProduktGlownyDuplikatu(${jsArg(g.groupKey)},${jsArg(p.id)})"><div class="allegro-duplicate-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa)}</b><small>ID ${esc(p.id)} • EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||"—")}</small><em>${String(p.id)===String(g.canonical.id)?"✅ karta główna":"kopia do decyzji"}</em></div></div></button>`).join("")}</div><div class="diag-actions"><button class="btn danger" onclick="usunKopieGrupyProduktuTrwale(${jsArg(g.groupKey)})">🗑️ Pozostaw 1 i usuń trwale ${g.hidden.length} kopii</button></div></article>`).join("")}</div></section>`:`<div class="duplicate-audit-ok"><b>✅ Katalog sklepu:</b> brak powtarzających się produktów.</div>`}
        ${audytAllegro.produkty?allegroCentrumDuplikatowHTML(audytAllegro,{compact:true,maxGroups:12}):`<div class="duplicate-audit-ok"><b>✅ Allegro:</b> brak produktów połączonych z więcej niż jedną ofertą.</div>`}
      </div></details>
      <details class="assortment-filter-panel admin-search-standard" open><summary><span><b>🔎 Wyszukiwanie zaawansowane</b><small>Ten sam standard co w centrum wystawiania: łącz identyfikatory, producenta, kategorię, dostępność, magazyn, Allegro, źródło i ceny obu kanałów.</small></span><span class="admin-search-summary-meta" data-assortment-filter-summary>${aktywneFiltry.length?`<em>${aktywneFiltry.length} aktywnych</em>`:""}<strong>${liczbaWynikow} wyników</strong><i aria-hidden="true"></i></span></summary><div class="admin-search-standard-body assortment-advanced-grid allegro-listing-advanced-grid">
        <label class="allegro-listing-search-wide"><span>Produkt lub identyfikator</span><input data-assortment-search placeholder="Nazwa, EXTERNAL_ID, SKU, EAN, kod producenta, ID produktu lub oferty…" value="${esc(szukajProduktow)}" oninput="asortymentSzukajProdukty(this)" autocomplete="off"></label>
        <label><span>Kategoria</span><select onchange="asortymentUstawFiltr('kategoria',this.value)"><option value="Wszystkie">Wszystkie kategorie</option>${katOpcje.map(k=>`<option value="${esc(k)}" ${k===filtrProduktow?"selected":""}>${esc(k)}</option>`).join("")}</select></label>
        <label><span>Producent</span><select onchange="asortymentUstawFiltr('producent',this.value)"><option value="wszyscy">Wszyscy producenci</option>${producenciOpcje.map(p=>`<option value="${esc(p)}" ${p===filtrProducentaProduktow?"selected":""}>${esc(p)}</option>`).join("")}</select></label>
        <label><span>Status kartoteki</span><select onchange="asortymentUstawFiltr('status',this.value)">${opcje([["aktywne","Tylko aktywne"],["wszystkie","Aktywne i kosz"],["kosz",`Tylko w koszu (${liczbaWKoszu})`],["duplikaty",`Powtarzające się (${audytSklep.produkty})`]],filtrStatusuProduktow)}</select></label>
        <label><span>Dostępność sprzedażowa</span><select onchange="asortymentUstawFiltr('sprzedaz',this.value)">${opcje([["wszystkie","Każda dostępność"],["dostepne","Widoczne w sprzedaży"],["niedostepne","Ukryte w sprzedaży"],["reczne","Wyłączone ręcznie"],["automat","Wyłączone automatycznie"]],filtrSprzedazyProduktow)}</select></label>
        <label><span>Źródło kartoteki</span><select onchange="asortymentUstawFiltr('zrodlo',this.value)">${opcje([["wszystkie","Każde źródło"],["bazowe","Katalog bazowy"],["wlasne","Dodane / importowane"]],filtrZrodlaProduktow)}</select></label>
        <label><span>Kompletność danych</span><select onchange="asortymentUstawFiltr('dane',this.value)">${opcje([["wszystkie","Każdy stan danych"],["gotowe","Kompletne kartoteki"],["braki","Dowolny brak danych"],["ean","Brak EAN"],["zdjecie","Brak zdjęcia"],["opis","Brak opisu krótkiego lub pełnego"],["producent","Brak producenta"],["kategoria","Brak kategorii"],["zrodlo","Brak linku źródłowego"],["koszt","Brak ceny zakupu (admin)"]],filtrDanychProduktow)}</select></label>
        <label><span>Stan magazynowy</span><select onchange="asortymentUstawFiltr('stan',this.value)">${opcje([["wszystkie","Każdy stan"],["dostepne","Powyżej 0 / bez limitu"],["niskie","Niski stan (1–5)"],["brak","Brak lokalnego stanu"]],filtrStanuProduktow)}</select></label>
        <label><span>Status Allegro</span><select onchange="asortymentUstawFiltr('allegro',this.value)">${opcje([["wszystkie","Wszystkie produkty"],["polaczone","Połączone z ofertą"],["aktywne","Aktywne oferty"],["szkice","Szkice / nieaktywne"],["brak","Bez oferty Allegro"],["duplikaty",`Podejrzane duplikaty (${audytAllegro.produkty})`]],filtrAllegroProduktow)}</select></label>
        <label><span>Oferta i promocja</span><select onchange="asortymentUstawFiltr('promocja',this.value)">${opcje([["wszystkie","Wszystkie ceny"],["promocje","Tylko promocje"],["regularne","Bez promocji"],["nowosci","Oznaczone jako nowość"]],filtrPromocjiProduktow)}</select></label>
        <label><span>Link producenta</span><select onchange="asortymentUstawFiltr('link',this.value)">${opcje([["wszystkie","Każde źródło produktu"],["z_linkiem","Ma link producenta"],["bez_linku","Brak linku producenta"]],filtrLinkuProduktow)}</select></label>
        <label><span>Cena sklepu od</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaOdAdminProduktow)}" placeholder="0,00 zł" onchange="asortymentUstawFiltr('cenaOd',this.value)"></label>
        <label><span>Cena sklepu do</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaDoAdminProduktow)}" placeholder="bez limitu" onchange="asortymentUstawFiltr('cenaDo',this.value)"></label>
        <label><span>Cena Allegro od</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaAllegroOdAdminProduktow)}" placeholder="0,00 zł" onchange="asortymentUstawFiltr('cenaAllegroOd',this.value)"></label>
        <label><span>Cena Allegro do</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cenaAllegroDoAdminProduktow)}" placeholder="bez limitu" onchange="asortymentUstawFiltr('cenaAllegroDo',this.value)"></label>
        <label><span>Sortowanie</span><select onchange="ustawSortowanieAdminProduktow(this.value)">${opcje([["external","EXTERNAL_ID / SKU (domyślnie)"],["id","ID produktu"],["nazwa","Nazwa A–Z"],["producent","Producent A–Z"],["kategoria","Kategoria A–Z"],["cena-rosnaco","Cena rosnąco"],["cena-malejaco","Cena malejąco"],["stan","Najniższy stan"],["braki-danych","Najwięcej braków danych"],["najnowsze","Najnowsze kartoteki"]],sortowanieAdminProduktow)}</select></label>
        <label><span>Na stronie</span><select onchange="ustawProduktyNaStronieAdmin(this.value)">${[25,50,100,200,500,1000].map(n=>`<option value="${n}" ${produktyNaStronieAdmin===n?"selected":""}>${n}</option>`).join("")}</select></label>
        <button class="btn ghost" type="button" onclick="asortymentResetujFiltry()">Wyczyść wszystkie filtry</button>
        <div class="assortment-filter-state admin-search-full" data-assortment-active-filters>${aktywneFiltry.length?`<b>Aktywne filtry:</b>${aktywneFiltry.map(([k,l])=>`<button type="button" onclick="asortymentWyczyscFiltr(${jsArg(k)})">${esc(l)} <span>×</span></button>`).join("")}<button class="clear-all" type="button" onclick="asortymentResetujFiltry()">Wyczyść wszystko</button>`:`<span>Brak dodatkowych filtrów — pokazujesz aktywne kartoteki.</span>`}</div>
        <div class="admin-search-standard-actions" data-assortment-operations>${adminOperacjeWynikowHTML({id:"assortment-products",selected:zaznaczoneProdukty.size,pageCount:fragment.length,resultCount:liczbaWynikow,selectPage:"asortymentZaznaczZakres('strona')",selectAll:"asortymentZaznaczZakres('filtr')",clear:"wyczyscZaznaczenieProduktow()",exportSelected:"asortymentEksportuj('zaznaczone')",exportAll:"asortymentEksportuj('filtr')"})}</div>
      </div></details>
      <div data-assortment-results>
      <div class="assortment-results-toolbar allegro-listing-results-head"><div><b>${liczbaWynikow} produktów</b><span>Pokazano ${zakresOd}–${zakresDo} • strona ${stronaAdminProduktow} z ${liczbaStron}</span></div><span><b data-product-selection-count>${zaznaczoneProdukty.size}</b> zaznaczonych</span><label>Gęstość widoku<select onchange="ustawGestoscAdminProduktow(this.value)"><option value="zwarta" ${gestoscAdminProduktow==="zwarta"?"selected":""}>Zwarta</option><option value="wygodna" ${gestoscAdminProduktow==="wygodna"?"selected":""}>Wygodna</option></select></label></div>
      <div class="assortment-bulk-editor allegro-listing-selection"><div><b>Operacje dla zaznaczonych: <span data-product-selection-count>${zaznaczoneProdukty.size}</span></b><small>Zarządzaj ceną sklepu i Allegro oddzielnie; publikacja nowych ofert pozostaje w sekcji Wystawianie.</small></div><label>Kanał ceny<select id="kanalCenProduktow"><option value="sklep">Tylko sklep</option><option value="allegro">Tylko Allegro</option><option value="oba">Sklep i Allegro</option></select></label><label>Zmiana cen<select id="trybCenProduktow"><option value="percent">O procent (+/−)</option><option value="amount">O kwotę (+/−)</option><option value="fixed">Ustaw cenę</option></select></label><input id="procentCen" placeholder="np. 10 lub -5" inputmode="decimal"><button class="btn" data-product-selection-required onclick="zmienCenyZaznaczonych()" ${zaznaczoneProdukty.size?"":"disabled"}>💰 Zmień ceny</button><button class="btn danger" data-product-selection-required onclick="usunZaznaczoneProd()" ${zaznaczoneProdukty.size?"":"disabled"}>🗑️ Przenieś do kosza</button></div>
      <div data-product-agent-center>${asortymentCentrumDzialanHTML()}</div>
      <div class="allegro-publication-list catalog-product-list density-${gestoscAdminProduktow}">${kartyProduktowHTML}</div>
      <div class="pagination allegro-listing-pagination">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div></div>
      <p class="assortment-sync-note"><b>☁️ Wspólna baza:</b> zmiany kartotek, cen, stanów i dostępności zapisują się centralnie i są widoczne na pozostałych urządzeniach po synchronizacji. Eksport pozostaje kopią roboczą lub narzędziem do operacji hurtowych.</p>
      </section>
    ${liczbaWKoszu ? `
    <div class="panel assortment-trash-panel">
      <div class="results-bar"><h2 style="margin:0">🗑️ Kosz (${liczbaWKoszu})</h2><button class="btn danger" onclick="wyczyscCalKosz()">Opróżnij kosz</button></div>
      <p style="font-size:.82rem;color:var(--muted2);margin-bottom:.6rem">Produkty pozostają w koszu przez 30 dni. W tym czasie możesz je przywrócić; później są automatycznie usuwane definitywnie.</p>
      <div class="assortment-table-wrap"><table class="log-table">
        <tr><th>Produkt</th><th>Typ</th><th>Usunięto</th><th>Wygasa</th><th>Akcje</th></tr>
        ${koszDodanych.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-info">własny</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocZKosza(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnie(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
        ${bazoweWKoszu.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-ostrzezenie">z products.json</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocProdukt(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnieBazowy(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
      </table></div>
    </div>`:""}
    </div>`);
}
