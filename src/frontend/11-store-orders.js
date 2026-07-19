function decyzjaDostepnosciZamowieniaInfo(z={}){
  const d=z.decyzjaDostepnosci&&typeof z.decyzjaDostepnosci==="object"?z.decyzjaDostepnosci:{},expiresMs=Date.parse(d.expiresAt||""),expired=String(d.code||"").startsWith("wait_")&&Number.isFinite(expiresMs)&&expiresMs<=Date.now();
  const labels={confirmed:"✅ dostępność potwierdzona",wait_1:"⏳ oczekiwanie 1 dzień",wait_2:"⏳ oczekiwanie 2 dni",contact_client:"📞 skontaktować się z klientem",unavailable:"⛔ brak — decyzja o realizacji",reset:"🔎 wymaga ponownej kontroli"};
  return {...d,expired,label:expired?"⏰ minął termin decyzji":labels[d.code]||"brak zapisanej decyzji"};
}
async function ustawDecyzjeDostepnosciZamowienia(nr,code){
  const lista=pobierzZamowienia(),z=lista.find(x=>String(x.nr)===String(nr));if(!z)return;
  const now=new Date(),days=code==="wait_1"?1:code==="wait_2"?2:0,previous=decyzjaDostepnosciZamowieniaInfo(z),labels={confirmed:"Dostępność potwierdzona",wait_1:"Oczekiwanie na potwierdzenie — 1 dzień",wait_2:"Oczekiwanie na potwierdzenie — 2 dni",contact_client:"Brak pewności — skontaktować się z klientem",unavailable:"Brak dostępności potwierdzony",reset:"Ponowna kontrola dostępności"};
  z.decyzjaDostepnosci={code,label:labels[code]||code,at:now.toISOString(),expiresAt:days?new Date(now.getTime()+days*86400000).toISOString():null,operator:sesja?.email||"administrator",history:[{code,at:now.toISOString(),operator:sesja?.email||"administrator"},...(previous.history||[])].slice(0,20)};
  z.wymagaPotwierdzeniaDostepnosci=["wait_1","wait_2","reset"].includes(code);
  zapiszLS("artway_zamowienia",lista);zapiszHistorieAgenta("decyzja-zamowienia",`Zamówienie ${nr}: ${labels[code]||code}`,{nr,code,expiresAt:z.decyzjaDostepnosci.expiresAt});renderuj();
  try{await zapiszZamowienieCentralnie(z,false);toast(`✅ Zapisano decyzję dla zamówienia ${nr}`);}catch(e){toast(`⚠️ Decyzja lokalna zapisana, synchronizacja: ${e.message||e}`);}renderuj();
}
function zastosujWyborDecyzjiZamowienia(nr){const el=document.querySelector(`[data-order-availability-decision="${CSS.escape(String(nr))}"]`);if(el)void ustawDecyzjeDostepnosciZamowienia(nr,el.value);}
function alertDostepnosciZamowieniaHTML(z){
  const lista=Array.isArray(z?.dostepnoscDoPotwierdzenia)?z.dostepnoscDoPotwierdzenia:[];
  const decision=decyzjaDostepnosciZamowieniaInfo(z);
  if(!z?.wymagaPotwierdzeniaDostepnosci&&!lista.length&&!decision.code)return "";
  const txt=lista.length?lista.map(x=>`${esc(x.nazwa||"Produkt")} × ${esc(x.ilosc||"")}`).join(", "):"większa ilość produktów";
  return `<div class="order-availability-decision ${decision.expired?"is-overdue":""}"><div><b>${z.wymagaPotwierdzeniaDostepnosci?"⚠️ Potwierdzić dostępność przed realizacją":"🧭 Decyzja dostępności"}</b><p>${txt}</p><small>${esc(decision.label)}${decision.expiresAt?` • termin ${esc(new Date(decision.expiresAt).toLocaleString("pl-PL"))}`:""}${decision.operator?` • ${esc(decision.operator)}`:""}</small></div><div><select data-order-availability-decision="${esc(z.nr)}"><option value="confirmed">✅ Potwierdź pełną dostępność</option><option value="wait_1">⏳ Poczekaj na producenta 1 dzień</option><option value="wait_2">⏳ Poczekaj na producenta 2 dni</option><option value="contact_client">📞 Brak pewności — kontakt z klientem</option><option value="unavailable">⛔ Potwierdzony brak produktu</option><option value="reset">🔎 Wróć do kontroli</option></select><button class="btn" type="button" onclick="zastosujWyborDecyzjiZamowienia(${jsArg(z.nr)})">Zapisz decyzję</button></div></div>`;
}
function adminZaopatrzenieZamowieniaDane(z={}){
  const nr=String(z.nr||""),rezerwacje=typeof rezerwacjeMagazynowe==="function"?rezerwacjeMagazynowe():{},plan=typeof planZatowarowania==="function"?planZatowarowania():[];
  const planMap=new Map(plan.map(x=>[String(x?.produkt?.id??""),x]));
  const dokumenty=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(agentAIPlanDokumentAktywny);
  return (Array.isArray(z.pozycjeDane)?z.pozycjeDane:[]).map(item=>{
    const rozpoznany=adminProduktDlaPozycjiZamowienia(item),id=String(rozpoznany?.id??item?.id??item?.produktId??item?.productId??""),produkt=rozpoznany||(typeof produktMagazynowy==="function"?produktMagazynowy(id):null),stan=typeof stanMagazynuId==="function"?stanMagazynuId(id):null,sugestia=planMap.get(id)||{};
    let dokument=null,pozycja=null;
    for(const doc of dokumenty){
      const hit=(Array.isArray(doc.pozycje)?doc.pozycje:[]).find(p=>String(p?.produktId??p?.id??"")===id&&(Array.isArray(p?.zamowienia)?p.zamowienia.map(String).includes(nr):false));
      if(hit){dokument=doc;pozycja=hit;break;}
    }
    const brak=Math.max(0,Number(pozycja?.iloscPotrzebna??sugestia?.ilosc)||0),qty=Math.max(1,Number(item?.ilosc)||1),lokalizacja=magazynMetaProduktu(id)?.lokalizacja||pozycja?.lokalizacja||"";
    return {id,nazwa:item?.nazwa||produkt?.nazwa||`Produkt ${id}`,kod:pozycja?.kod||produkt?.kodProducenta||produkt?.mpn||produkt?.externalId||produkt?.sku||"—",qty,stan,rezerwacje:Math.max(0,Number(rezerwacje[id])||0),brak,lokalizacja,dokument,pozycja};
  });
}
function adminZaopatrzenieZamowieniaHTML(z={}){
  const rows=adminZaopatrzenieZamowieniaDane(z),braki=rows.filter(x=>x.brak>0),docs=[...new Map(rows.filter(x=>x.dokument).map(x=>[String(x.dokument.id),x.dokument])).values()];
  const statusDoc=docs.length?docs.map(d=>`${d.numer||d.id}: ${d.status||"szkic"}`).join(" • "):braki.length?"Szkic tworzy się automatycznie po synchronizacji":"Nie jest potrzebne zamówienie u producenta";
  return `<section class="order-detail-card order-procurement-card">
    <div class="order-section-head"><div><span class="order-pro-label">Magazyn → producent</span><h2>🏭 Kontrola realizacji produktów</h2><p class="order-detail-lead">Stan jest sprawdzany dla całej aktywnej kolejki. Zamawiamy wyłącznie rzeczywisty brak, a wysyłka do producenta czeka na zatwierdzenie aktualnej wersji.</p></div><a class="btn ${braki.length?"":"ghost"}" href="#/admin/magazyn/plan">${braki.length?"Otwórz szkic w Planie":"Plan zatowarowania"}</a></div>
    <div class="procurement-flow" aria-label="Etapy zaopatrzenia"><span class="done"><b>1</b> Stan sprawdzony</span><span class="${braki.length?"active":"done"}"><b>2</b> ${braki.length?`Brak ${braki.reduce((s,x)=>s+x.brak,0)} szt.`:"Pokrycie kompletne"}</span><span class="${docs.length?"active":""}"><b>3</b> ${docs.length?"Szkic producenta":"Bez szkicu"}</span><span class="${docs.some(d=>String(d.status||"").toLowerCase().includes("wysłane do"))?"done":""}"><b>4</b> Zatwierdź i wyślij</span></div>
    <div class="procurement-order-table"><table><thead><tr><th>Kod</th><th>Produkt</th><th>Zamówiono</th><th>Stan fizyczny</th><th>Rezerwacje</th><th>Brak łączny</th><th>Lokalizacja / dokument</th></tr></thead><tbody>${rows.map(x=>`<tr class="${x.brak>0?"needs-order":"stock-covered"}"><td><b>${esc(x.kod)}</b></td><td>${esc(x.nazwa)}</td><td>${x.qty} szt.</td><td>${x.stan===null?"niemonitorowany":`${x.stan} szt.`}</td><td>${x.rezerwacje} szt.</td><td>${x.brak>0?`<span class="lvl lvl-ostrzezenie">${x.brak} szt.</span>`:`<span class="lvl lvl-ok">0</span>`}</td><td>${x.lokalizacja?`<span class="warehouse-order-location is-set"><b>📍 ${esc(sciezkaNazwLokalizacjiMagazynu(x.lokalizacja)||nazwaLokalizacjiMagazynu(x.lokalizacja))}</b><small>${esc(x.lokalizacja)}</small></span>`:`<span class="warehouse-order-location is-missing"><b>📍 Brak lokalizacji</b><small>Informacja dla magazynu</small></span>`}<small>${x.dokument?`${esc(x.dokument.numer||x.dokument.id)} • ${esc(x.dokument.status||"szkic")}`:(x.brak?"oczekuje na szkic":"zapas wystarcza")}</small></td></tr>`).join("")||`<tr><td colspan="7">Brak pozycji magazynowych w zamówieniu.</td></tr>`}</tbody></table></div>
    <div class="backend-note ${braki.length?"":"is-ok"}"><b>${braki.length?"Dalszy etap:":"Wynik kontroli:"}</b> ${esc(statusDoc)}. ${braki.length?"Najpierw sprawdź tabelę i zatwierdź dokładną rewizję; dopiero potem system pozwoli wysłać e-mail do właściwego producenta.":"Produkty można przekazać do kompletacji bez tworzenia zlecenia zakupowego."}</div>
  </section>`;
}
function kartaAdminZamowieniaHTML(z){
  const k=kosztyZamowienia(z), w=daneWysylki(z), klient=klientZamowieniaLabel(z);
  const zaznaczone=zaznaczoneZamowieniaSklepu.has(String(z.nr));
  const pozycje=Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
    ? z.pozycjeDane.map(p=>`${p.ilosc||1} × ${p.nazwa||p.produkt||p.id||"produkt"}${p.wariant?` (${p.wariant})`:""} — ${zl(p.wartosc||kwotaNum(p.cena)*(Number(p.ilosc)||1))}`)
    : (Array.isArray(z.pozycje)?z.pozycje:["brak pozycji"]);
  const tracking=w.numer?`${nazwaPrzewoznika(w.przewoznik||"inpost")}: ${w.numer}`:(w.inpostId?`InPost ID ${w.inpostId} — ${w.inpostStatus||"czeka na numer"}`:"bez numeru nadania");
  const platnosc=z.platnosc||dostepnePlatnosci().find(p=>p.id===z.platnoscId)?.nazwa||"—";
  return `<article class="order-pro-card ${zaznaczone?"is-selected":""}">
    <div class="order-pro-top">
      <div class="order-pro-title-row">
        <label class="order-bulk-check" title="Zaznacz całe zamówienie"><input type="checkbox" ${zaznaczone?"checked":""} onchange="adminPrzelaczZaznaczenieZamowienia(${jsArg(z.nr)},this.checked)"></label>
        <div><a class="order-pro-number" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">${esc(z.nr)}</a>
        <div class="order-pro-muted">${esc(z.data||"")} • ${esc(klient)} ${z.wymagaPotwierdzeniaDostepnosci?'<span class="lvl lvl-ostrzezenie">sprawdź dostępność</span>':""}</div></div>
      </div>
      <div class="order-pro-right">
        <select onchange="zmienStatus(${jsArg(z.nr)}, this.value)" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">
          ${STATUSY.map(s=>`<option value="${esc(s)}" ${s===z.status?"selected":""}>${esc(s)}</option>`).join("")}
        </select>
        <b>${zl(k.razem)}</b>
      </div>
    </div>
    <div class="order-pro-grid">
      <div class="order-pro-section">
        <span class="order-pro-label">Produkty</span>
        <p>${pozycje.slice(0,3).map(p=>esc(p)).join("<br>")}${pozycje.length>3?`<br><span style="color:var(--muted2)">+ ${pozycje.length-3} kolejnych pozycji</span>`:""}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Klient</span>
        <p>${z.email?`✉️ ${esc(z.email)}`:"👤 gość"}${z.klient?.telefon?`<br>📞 ${esc(z.klient.telefon)}`:""}${z.klient?.firma?`<br>🏢 ${esc(z.klient.firma)}`:""}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Dostawa</span>
        <p>🚚 ${esc(z.dostawa||uslugaInpostZamowienia(z))}<br>💰 ${k.dostawa?zl(k.dostawa):"GRATIS"}${k.paczkaWeekend?` + Weekend ${zl(k.paczkaWeekend)}`:""}<br>🏷️ ${esc(tracking)}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Płatność i adres</span>
        <p>💳 ${esc(platnosc)}${k.platnosc?` + ${zl(k.platnosc)}`:""}<br>📍 ${esc(z.adres||"brak adresu")}</p>
      </div>
    </div>
    ${alertDostepnosciZamowieniaHTML(z)}
    <div class="order-pro-bottom">
      <div class="order-pro-costs">
        <span>Produkty <b>${zl(k.poRabacie||k.produkty)}</b></span>
        <span>Dostawa <b>${k.dostawa?zl(k.dostawa):"GRATIS"}</b></span>
        ${k.paczkaWeekend?`<span>Weekend <b>${zl(k.paczkaWeekend)}</b></span>`:""}
        ${k.platnosc?`<span>Płatność <b>${zl(k.platnosc)}</b></span>`:""}
      </div>
      <div class="diag-actions">
        <a class="btn" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Obsłuż</a>
        <a class="btn ghost" href="#/admin/wysylki">Centrum wysyłek</a>
        <button class="btn ghost" onclick="drukujZamowienie(${jsArg(z.nr)})">🖨️ Druk</button>
        <button class="ci-remove" onclick="if(confirm('Usunąć zamówienie ${esc(z.nr)}?')) usunZamowienie(${jsArg(z.nr)})" title="Usuń zamówienie">🗑️</button>
      </div>
    </div>
  </article>`;
}
function adminPozycjeZamowieniaHTML(z){
  const dane=Array.isArray(z?.pozycjeDane)?z.pozycjeDane:[];
  if(dane.length){
    return `<div class="order-items-pro">${dane.map(p=>{
      const nazwa=p.nazwa||p.produkt||p.id||"produkt", il=Number(p.ilosc)||1, cena=kwotaNum(p.cena), wartosc=kwotaNum(p.wartosc||(cena*il));
      return `<div class="order-item-pro">
        <div><b>${esc(nazwa)}</b>${p.wariant?`<small>Wariant: ${esc(p.wariant)}</small>`:""}${p.sku?`<small>SKU: ${esc(p.sku)}</small>`:""}${adminLokalizacjaPozycjiZamowieniaHTML(p)}</div>
        <span>${il} × ${cena?zl(cena):"—"}</span>
        <strong>${zl(wartosc)}</strong>
      </div>`;
    }).join("")}</div>`;
  }
  const tekstowe=Array.isArray(z?.pozycje)?z.pozycje:[];
  return `<div class="order-items-pro">${tekstowe.length?tekstowe.map(p=>`<div class="order-item-pro"><div><b>${esc(p)}</b>${adminLokalizacjaPozycjiZamowieniaHTML({nazwa:p})}</div></div>`).join(""):`<div class="order-item-pro"><div><b>Brak pozycji w zamówieniu</b></div></div>`}</div>`;
}
function adminZamowienieSnapshotHTML(z){
  const w=daneWysylki(z), k=kosztyZamowienia(z), klient=z?.klient||{}, pay=paynowDane(z);
  const osoba=[klient.imie,klient.nazwisko].filter(Boolean).join(" ")||z.email||"gość";
  const platnosc=z.platnosc||dostepnePlatnosci().find(p=>p.id===z.platnoscId)?.nazwa||"—";
  const platStatus=z.platnoscStatus||(z.platnoscId==="paynow"?paynowStatusTekst(pay.status):"—");
  const tracking=w.numer?`${w.numer}`:(w.inpostId?`${w.inpostId} • ${w.inpostStatus||"czeka"}`:"brak numeru");
  const etap=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi;
  const inpostOpcje=[
    pobranieAktywneZamowienia(z,w)?`COD ${zl(kwotaPobraniaZamowienia(z,w))}`:"COD NIE",
    (w.paczkaWeekend||z.paczkaWeekend)?`Weekend ${zl(OPLATA_PACZKA_WEEKEND)}`:"Weekend NIE",
    w.ochrona?`Ochrona ${zl(w.ochrona)}`:"Ochrona NIE",
    inpostSposobNadaniaLabel(inpostSposobNadania(z,w))
  ].join(" • ");
  return `<div class="order-detail-grid">
    <div class="order-detail-tile"><span>👤 Klient</span><b>${esc(osoba)}</b><small>${z.email?`✉️ ${esc(z.email)}`:"bez konta"}${klient.telefon?` • 📞 ${esc(klient.telefon)}`:""}</small></div>
    <div class="order-detail-tile"><span>💳 Płatność</span><b>${esc(platnosc)}</b><small>Status: ${esc(platStatus)}${k.platnosc?` • opłata ${zl(k.platnosc)}`:""}</small></div>
    <div class="order-detail-tile"><span>🚚 Dostawa</span><b>${esc(z.dostawa||uslugaInpostZamowienia(z))}</b><small>${k.dostawa?zl(k.dostawa):"GRATIS"}${k.paczkaWeekend?` • Weekend ${zl(k.paczkaWeekend)}`:""} • ${esc(etap.nazwa||"")}</small></div>
    <div class="order-detail-tile"><span>🏷️ Nadanie</span><b>${esc(tracking)}</b><small>${w.etykietaGotowa?"Etykieta gotowa":w.inpostId?"Czeka na potwierdzenie InPost":"Nieutworzona przesyłka"} • ${esc(inpostOpcje)}</small></div>
  </div>`;
}
function adminZamowienieStatusPanelHTML(z){
  return `<div class="order-status-flow">
    ${STATUSY.map(s=>`<button class="${s===z.status?"active":""}" onclick="zmienStatus(${jsArg(z.nr)},${jsArg(s)})"><span>${s===z.status?"●":"○"}</span>${esc(s)}</button>`).join("")}
  </div>`;
}
function adminZamowieniaSubnavHTML(aktywny="lista"){
  const sklep=pobierzZamowienia(),allegroAktywne=(allegroZamowienia||[]).filter(allegroZamowienieAktywneLokalnie).length;
  const doWysylki=sklep.filter(z=>!["anulowane","dostarczone","zakończone"].includes(String(z.status||"").toLowerCase())&&!daneWysylki(z).numer).length;
  return adminSubnavHTML([
    {id:"lista",href:"#/admin/zamowienia",label:"📦 Lista sklepu",badge:sklep.length||""},
    {id:"allegro",href:"#/admin/allegro/zamowienia",label:"🟠 Zamówienia Allegro",badge:allegroAktywne||""},
    {id:"tabela",href:"#/admin/magazyn/plan",label:"📦 Plan zatowarowania"},
    {id:"wysylki",href:"#/admin/wysylki",label:"🚚 Wysyłki i etykiety",badge:doWysylki||""}
  ],aktywny);
}
function widokAdminZamowienia(){
  const wszystkie = pobierzZamowienia();
  const zam = adminPasujaceZamowieniaSklepu();
  const istniejace=new Set(wszystkie.map(z=>String(z.nr))),zaznaczone=[...zaznaczoneZamowieniaSklepu].filter(id=>istniejace.has(id));
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("lista")}
  <div class="panel orders-page">
    <div class="orders-hero">
      <div>
        <span class="order-pro-label">Centrum zamówień</span>
        <h1>📦 Zamówienia</h1>
        <p>Pełna obsługa sprzedaży: statusy, płatności, koszty InPost, etykiety, e-maile i szybkie przejście do wysyłki.</p>
      </div>
      <div class="diag-actions">
        <button class="btn ghost" onclick="synchronizujBazeCentralna(true)">🔄 Synchronizuj</button>
        <button class="btn ghost" onclick="eksportujZamowienia()">📤 CSV</button>
        <a class="btn ghost" href="#/admin/allegro">🟠 Allegro</a>
        <a class="btn" href="#/admin/wysylki">🚚 Centrum wysyłek</a>
      </div>
    </div>
    ${adminZamowieniaStatyHTML(wszystkie,zam)}
    ${adminWyszukiwaniePanelHTML({id:"store-orders",description:"Numer zamówienia, klient, dane kontaktowe, adres, numer nadania i status.",results:zam.length,active:!!(szukajZamowien||filtrZamowien!=="wszystkie"),open:true,fields:`<div class="orders-toolbar admin-search-full">
      <input placeholder="Szukaj: nr, klient, e-mail, telefon, adres, tracking…" value="${esc(szukajZamowien)}" oninput="szukajZamowien=this.value.toLowerCase();zaplanujRenderPoWpisaniu()">
      <select onchange="filtrZamowien=this.value;renderuj()">
        <option value="wszystkie" ${filtrZamowien==="wszystkie"?"selected":""}>Wszystkie statusy</option>
        ${STATUSY.map(s=>`<option value="${esc(s)}" ${s===filtrZamowien?"selected":""}>${esc(s)}</option>`).join("")}
      </select>
      ${szukajZamowien||filtrZamowien!=="wszystkie"?`<button class="btn ghost" onclick="szukajZamowien='';filtrZamowien='wszystkie';renderuj()">Wyczyść filtry</button>`:""}
    </div>`,actions:adminOperacjeWynikowHTML({id:"store-orders",selected:zaznaczone.length,pageCount:zam.length,resultCount:zam.length,selectPage:"adminZaznaczWidoczneZamowienia(true)",selectAll:"adminZaznaczWidoczneZamowienia(true)",clear:"adminWyczyscZaznaczenieZamowien()",exportSelected:"adminEksportujZamowieniaZakres('zaznaczone')",exportAll:"adminEksportujZamowieniaZakres('filtr')"})})}
    ${adminStatusyZamowienHTML(wszystkie)}
    <div class="order-bulk-toolbar">
      <div class="order-bulk-summary"><b>Operacje na zamówieniach</b><small>${zaznaczone.length} zaznaczonych • ${zam.length} w aktualnym widoku</small></div>
      <div class="order-bulk-status">
        <label for="bulkOrderStatus">Nowy status</label>
        <select id="bulkOrderStatus"><option value="">— wybierz status —</option>${STATUSY.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
        <button class="btn" onclick="adminMasowoZmienStatusZamowien()" ${zaznaczone.length?"":"disabled"}>Zastosuj do ${zaznaczone.length}</button>
      </div>
    </div>
    <div class="orders-list">
      ${zam.length ? zam.map(kartaAdminZamowieniaHTML).join("") : `<div class="order-empty"><b>Brak zamówień dla tego widoku.</b><br>Zmień filtr albo wyczyść wyszukiwarkę.</div>`}
    </div>
  </div>`);
}
function widokAdminZamowienie(nr){
  const z = pobierzZamowienia().find(x=>x.nr===nr);
  if(!z) return adminSzkielet("/admin/zamowienia", `<div class="panel"><h1>Nie znaleziono zamówienia ${esc(nr)}</h1><p><a href="#/admin/zamowienia">← Wróć do listy</a></p></div>`);
  const w=daneWysylki(z), uw=ustawieniaWysylki(), klient=z.klient||{}, adres=z.adresDostawy||{};
  const emailGotowy=!!stanBramki.email?.configured, emailPolaczony=!!stanBramki.email?.authenticated&&maUprawnieniaZapisuChmury();
  const przewoznik="inpost";
  const uslugi=PRZEWOZNICY[przewoznik]?.uslugi||[];
  const paczkomatZam = czyZamowieniePaczkomat(z);
  const uslugaDomyslna = w.usluga || uslugaInpostZamowienia(z);
  const paynow=paynowDane(z);
  const koszty=kosztyZamowienia(z), etapInfo=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi, sla=slaWysylki(z);
  const pobranieAktywne=pobranieAktywneZamowienia(z,w);
  const pobranieKwota=kwotaPobraniaZamowienia(z,w);
  const paczkaWeekendAktywna=!!(w.paczkaWeekend||z.paczkaWeekend);
  const sposobNadania=inpostSposobNadania(z,w);
  const punktNadania=String(w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
  const ochronaKwota=String(w.ochrona||"").trim();
  const ochronaPreset=inpostOchronaPreset(ochronaKwota);
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("lista")}
  <div class="panel order-detail-page">
    <div class="crumb"><a href="#/admin/zamowienia">Zamówienia</a> › ${esc(z.nr)}</div>
    <div class="order-detail-hero">
      <div>
        <span class="order-pro-label">Obsługa zamówienia</span>
        <h1>📦 ${esc(z.nr)} <span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'};font-size:.85rem;vertical-align:middle">${esc(z.status)}</span></h1>
        <p>${esc(z.data||"")} • <span class="${sla.klasa}">⏱ ${esc(sla.tekst)}</span> • etap: <b>${esc(etapInfo.nazwa||nazwaEtapu(z))}</b></p>
      </div>
      <div class="order-detail-total">
        <small>Do zapłaty</small>
        <b>${zl(koszty.razem)}</b>
        <span>produkty ${zl(koszty.poRabacie||koszty.produkty)} • dostawa ${koszty.dostawa?zl(koszty.dostawa):"gratis"}</span>
      </div>
    </div>
    ${adminZamowienieSnapshotHTML(z)}
    ${alertDostepnosciZamowieniaHTML(z)}
    ${adminZaopatrzenieZamowieniaHTML(z)}
    <div class="order-detail-columns">
      <div class="order-detail-card">
        <div class="order-section-head"><div><span class="order-pro-label">Produkty</span><h2>🧾 Pozycje zamówienia</h2></div><b>${zl(koszty.produkty)}</b></div>
        ${adminPozycjeZamowieniaHTML(z)}
      </div>
      <div class="order-detail-card">
        <div class="order-section-head"><div><span class="order-pro-label">Finanse</span><h2>💰 Podsumowanie</h2></div></div>
        <div class="summary" style="margin:.55rem 0">${podsumowanieKosztowHTML(z,"Razem")}</div>
        ${z.uwagi?`<div class="backend-note"><b>Uwagi klienta:</b> ${esc(z.uwagi)}</div>`:""}
      </div>
    </div>
    <div class="order-detail-card" style="margin-top:1rem">
      <div class="order-section-head"><div><span class="order-pro-label">Status</span><h2>Zmiana statusu zamówienia</h2></div><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">${esc(z.status)}</span></div>
      ${adminZamowienieStatusPanelHTML(z)}
    </div>
  </div>
  <div class="panel order-fulfillment-panel">
    <div class="order-section-head">
      <div><span class="order-pro-label">InPost / realizacja</span><h2>🚚 Nadanie i dane odbiorcy</h2></div>
      <div class="order-pro-costs"><span style="background:${etapInfo.kolor||'var(--bg)'};color:var(--ink)">${esc(nazwaEtapu(z))}</span>${w.numer?`<span>Numer <b>${esc(w.numer)}</b></span>`:""}${w.inpostId?`<span>InPost <b>${esc(w.inpostId)}</b></span>`:""}</div>
    </div>
    <p class="order-detail-lead">${w.inpostStatus?`Status InPost: ${esc(w.inpostStatus)}. `:""}${urlSledzenia(z)?`<a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Otwórz śledzenie przesyłki</a>`:"Najpierw zapisz dane, potem utwórz przesyłkę i etykietę."}</p>
    <div class="backend-note">Pola z <b>*</b> są wymagane przed utworzeniem przesyłki InPost.</div>
    <form class="order-form-pro shipment-manager-form inpost-like-form" onsubmit="zapiszNadanie(event,'${esc(z.nr)}')">
      <div class="shipment-manager-box inpost-like-box">
        <h3 class="inpost-like-title">Nadanie przesyłki</h3>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Dane odbiorcy</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Imię</label><div><input name="imie" value="${esc(klient.imie||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nazwisko</label><div><input name="nazwisko" value="${esc(klient.nazwisko||"")}"></div></div>
            <div class="shipment-manager-field"><label>E-mail *</label><div><input name="email" type="email" value="${esc(z.email||"")}"></div></div>
            <div class="shipment-manager-field"><label>Telefon *</label><div><input name="telefon" value="${esc(klient.telefon||"")}" placeholder="9 cyfr"></div></div>
            <div class="shipment-manager-field"><label>Firma</label><div><input name="firma" value="${esc(klient.firma||"")}" placeholder="opcjonalnie"></div></div>
            <div class="shipment-manager-field"><label>NIP</label><div><input name="nip" value="${esc(klient.nip||"")}" placeholder="opcjonalnie"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Dostawa i gabaryt</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Sposób dostawy</label><div><select name="dostawaTyp" onchange="przelaczDostawaAdmin(this)">
              <option value="paczkomat" ${paczkomatZam?"selected":""}>Paczkomat / punkt InPost</option>
              <option value="kurier_inpost" ${!paczkomatZam?"selected":""}>Kurier InPost</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Gabaryt paczki</label><div><select name="gabaryt">
              <option value="small" ${(w.gabaryt||"small")==="small"?"selected":""}>Gabaryt A — mały (8 × 38 × 64 cm)</option>
              <option value="medium" ${w.gabaryt==="medium"?"selected":""}>Gabaryt B — średni (19 × 38 × 64 cm)</option>
              <option value="large" ${w.gabaryt==="large"?"selected":""}>Gabaryt C — duży (41 × 38 × 64 cm)</option>
            </select></div></div>
            <div class="shipment-manager-field span-2" id="admPaczkomatRow" style="${paczkomatZam?"":"display:none"}"><label>Paczkomat / punkt InPost *</label><div class="shipment-inline-control"><input name="paczkomat" id="admPaczkomat" value="${esc(z.paczkomat||w.punktKod||"")}" placeholder="np. WAW01M" style="text-transform:uppercase"><button type="button" class="btn" onclick="otworzGeowidgetAdmin()">🗺️ Wybierz na mapie</button></div></div>
            <input type="hidden" name="paczkomatAdres" id="admPaczkomatAdresVal" value="${esc(z.paczkomatAdres||"")}">
            <div class="shipment-manager-note span-2" id="admPaczkomatAdres">${(z.paczkomatAdres||"").trim()?`📮 ${esc(czyscAdresPaczkomatu(z.paczkomatAdres))}`:""}</div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Adres odbiorcy${paczkomatZam?" / awaryjny":" *"}</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Ulica${paczkomatZam?"":" *"}</label><div><input name="ulica" value="${esc(adres.ulica||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nr domu${paczkomatZam?"":" *"}</label><div><input name="nrDomu" value="${esc(adres.nrDomu||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nr lokalu</label><div><input name="nrLokalu" value="${esc(adres.nrLokalu||"")}"></div></div>
            <div class="shipment-manager-field"><label>Kod pocztowy${paczkomatZam?"":" *"}</label><div><input name="kod" value="${esc(adres.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div></div>
            <div class="shipment-manager-field"><label>Miejscowość${paczkomatZam?"":" *"}</label><div><input name="miasto" value="${esc(adres.miasto||"")}"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Usługi InPost</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Zlecenie za pobraniem</label><div><select name="pobranieAktywne" onchange="if(this.value==='tak'&&!this.form.pobranie.value)this.form.pobranie.value='${esc(kwotaNum(z.razem).toFixed(2))}'">
              <option value="" ${!pobranieAktywne?"selected":""}>NIE — jak w InPost</option>
              <option value="tak" ${pobranieAktywne?"selected":""}>TAK — pobranie od klienta</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Wartość pobrania</label><div><input name="pobranie" inputmode="decimal" value="${esc(pobranieKwota)}" placeholder="np. ${esc(kwotaNum(z.razem).toFixed(2))}"></div></div>
            <div class="shipment-manager-field"><label>Paczka w Weekend</label><div><select name="paczkaWeekend">
              <option value="" ${!paczkaWeekendAktywna?"selected":""}>NIE — jak w InPost</option>
              <option value="tak" ${paczkaWeekendAktywna?"selected":""}>TAK (+${zl(OPLATA_PACZKA_WEEKEND)})</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Sposób nadania</label><div><select name="sposobNadania">
              ${Object.entries(INPOST_SP_NADANIA).map(([id,nazwa])=>`<option value="${esc(id)}" ${sposobNadania===id?"selected":""}>${esc(nazwa)}</option>`).join("")}
            </select></div></div>
            <div class="shipment-manager-field"><label>Punkt nadania</label><div><input name="punktNadania" value="${esc(punktNadania)}" placeholder="${esc(INPOST_DOMYSLNY_PUNKT_NADANIA)}" style="text-transform:uppercase"></div></div>
            <div class="shipment-manager-field"><label>Dodatkowa ochrona</label><div><select name="ochronaPreset" onchange="if(this.value!=='custom')this.form.ochrona.value=this.value">
              ${INPOST_OCHRONA_PRESETY.map(p=>`<option value="${esc(p.wartosc)}" ${ochronaPreset===p.wartosc?"selected":""}>${esc(p.etykieta)}</option>`).join("")}
              <option value="custom" ${ochronaPreset==="custom"?"selected":""}>Własna kwota</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Kwota ochrony</label><div><input name="ochrona" inputmode="decimal" value="${esc(ochronaKwota)}" placeholder="puste = brak"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <details class="shipment-advanced"><summary>Wymiary, waga i ręczny numer nadania</summary>
            <div class="shipment-manager-grid">
              <div class="shipment-manager-field"><label>Waga (kg)</label><div><input name="waga" type="number" step=".01" min=".01" value="${esc(w.waga||uw.waga)}"></div></div>
              <div class="shipment-manager-field"><label>Długość (cm)</label><div><input name="dlugosc" type="number" min="1" value="${esc(w.dlugosc||uw.dlugosc)}"></div></div>
              <div class="shipment-manager-field"><label>Szerokość (cm)</label><div><input name="szerokosc" type="number" min="1" value="${esc(w.szerokosc||uw.szerokosc)}"></div></div>
              <div class="shipment-manager-field"><label>Wysokość (cm)</label><div><input name="wysokosc" type="number" min="1" value="${esc(w.wysokosc||uw.wysokosc)}"></div></div>
              <div class="shipment-manager-field"><label>Numer nadania</label><div><input name="numer" value="${esc(w.numer)}" placeholder="Zwykle uzupełni się automatycznie"></div></div>
              <div class="shipment-manager-field"><label>Własny link śledzenia</label><div><input name="trackingUrl" type="url" value="${esc(w.trackingUrl)}" placeholder="https://…"></div></div>
            </div>
          </details>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Etykieta i zapis</h4>
          <div class="shipment-manager-field full"><label>Uwagi do zamówienia</label><div><textarea name="uwagi" rows="2">${esc(z.uwagi||"")}</textarea></div></div>
          ${panelEtykietInpostHTML(z)}
        </section>
      </div>
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz dane</button>
      </div>
      <p style="font-size:.8rem;color:var(--muted2);margin:.4rem 0 0">Najpierw „Zapisz dane”, potem użyj panelu etykiet. Numer nadania i status pojawią się automatycznie u góry tej sekcji.</p>
    </form>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">💳 Płatność</h2>
      <div class="summary" style="margin:.4rem 0 ${z.platnoscId==="paynow"?".8rem":"0"}">
        <div><span>Metoda</span><span><b>${esc(z.platnosc||"—")}</b></span></div>
        <div><span>Status płatności</span><span>${esc(z.platnoscStatus||(z.platnoscId==="paynow"?paynowStatusTekst(paynow.status):"—"))}</span></div>
      ${podsumowanieKosztowHTML(z,"Kwota")}
    </div>
    ${z.platnoscId==="paynow"?`<div class="diag-actions"><button class="btn ghost" type="button" onclick="odswiezStatusPaynow(${jsArg(z.nr)},${jsArg(paynow.paymentId||"")})">🔄 Odśwież Paynow</button>${paynow.redirectUrl?`<a class="btn" href="${esc(paynow.redirectUrl)}" target="_blank" rel="noopener">Otwórz link płatności</a>`:""}${String(paynow.status||"").toUpperCase()==="CONFIRMED"?`<button class="btn" type="button" style="background:#0ea5e9;color:#fff" onclick="zwrotPieniedzyPaynow(${jsArg(z.nr)})">💸 Zwrot pieniędzy przez Paynow</button>`:""}</div>`:""}
    ${Array.isArray(paynow.refunds)&&paynow.refunds.length?`<div class="backend-note" style="border-color:#7dd3fc;background:#f0f9ff;color:#075985"><b>Zwroty Paynow:</b><br>${paynow.refunds.map(r=>`${zl((Number(r.amount)||0)/100)} • <code>${esc(r.refundId||"—")}</code> • ${esc(r.status||"—")}${r.ts?` • ${esc(new Date(r.ts).toLocaleString("pl-PL"))}`:""}`).join("<br>")}</div>`:""}
  </div>
  <div class="panel">
    <h2 style="margin-top:0">📍 Historia śledzenia</h2>
    ${(w.historia||[]).length?`<div class="ship-timeline">${[...(w.historia||[])].reverse().map(h=>`<div class="ship-event"><b>${esc(h.status)}</b>${h.opis?` — ${esc(h.opis)}`:""}<small>${esc(h.czas)}</small></div>`).join("")}</div>`:`<p style="color:var(--muted2)">Brak zdarzeń. Po podłączeniu webhooków historia będzie aktualizowana automatycznie.</p>`}
    <form onsubmit="dodajZdarzenieWysylki(event,'${esc(z.nr)}')">
      <div class="f-row"><div class="f-group"><label>Status zdarzenia</label><select name="status"><option>Przyjęta przez InPost</option><option>Przekazana do InPost</option><option>W sortowni</option><option>W drodze</option><option>W doręczeniu</option><option>Dostarczona</option><option>Zwrot do nadawcy</option><option>Problem z doręczeniem</option><option>Opóźnienie InPost</option><option>Nieudana próba doręczenia</option></select></div><div class="f-group"><label>Opis / lokalizacja</label><input name="opis" placeholder="Np. sortownia Warszawa"></div></div>
      <button class="btn ghost" type="submit">➕ Dodaj zdarzenie ręcznie</button>
    </form>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">✉️ Powiadomienia klienta</h2>
    <div class="backend-note" style="${emailPolaczony?"border-color:#86efac;background:#f0fdf4;color:#166534":emailGotowy?"":"border-color:#f59e0b"}">
      <b>${emailPolaczony?"Automatyczna wysyłka SMTP jest gotowa":emailGotowy?"SMTP zapisany, ale jeszcze niepotwierdzony":"Poczta wymaga naprawy trwałego połączenia serwerowego"}.</b>
      ${emailPolaczony?` Wiadomości wysyła ${esc(stanBramki.email.provider||"SMTP")}; wynik i identyfikator trafiają do historii.`:` <a href="#/admin/wysylki/ustawienia">Sprawdź integrację →</a>`}
    </div>
    <div class="diag-actions">
      ${Object.entries(NAZWY_EMAILI).map(([id,n])=>emailPolaczony
        ?`<button class="btn" onclick="wyslijEmailWysylki('${esc(z.nr)}','${id}')" ${z.email?"":"disabled"}>📧 Wyślij: ${esc(n)}</button>`
        :`<button class="btn ghost" onclick="otworzEmailWysylki('${esc(z.nr)}','${id}')" ${z.email?"":"disabled"}>✉️ Szkic: ${esc(n)}</button>`
      ).join("")}
    </div>
    ${(w.powiadomienia||[]).length?`<div class="ship-timeline">${[...(w.powiadomienia||[])].reverse().map(p=>`<div class="ship-event"><b>${esc(NAZWY_EMAILI[p.typ]||p.typ)}</b> — ${esc(p.status)}${p.automatyczne?" • automatycznie":""}${p.provider?` • ${esc(p.provider)}`:""}${p.id?`<br><code>${esc(p.id)}</code>`:""}${p.blad?`<br><span style="color:var(--danger)">${esc(p.blad)}</span>`:""}<small>${esc(p.czas)}</small></div>`).join("")}</div>`:`<p style="color:var(--muted2)">Brak wysłanych wiadomości dla tego zamówienia.</p>`}
    <div class="diag-actions" style="margin-top:.7rem">
      <button class="btn ghost" onclick="drukujZamowienie('${esc(z.nr)}')">🖨️ Drukuj zamówienie</button>
      <button class="btn danger" onclick="if(confirm('Usunąć zamówienie ${esc(z.nr)}?')) usunZamowienie('${esc(z.nr)}')">🗑️ Usuń zamówienie</button>
    </div>
  </div>`);
}
function zapiszDaneOdbiorcy(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), g=k=>String(f.get(k)||"").trim();
  aktualizujZamowienie(nr, z=>{
    z.klient=z.klient||{};
    z.klient.imie=g("imie"); z.klient.nazwisko=g("nazwisko"); z.klient.telefon=g("telefon");
    z.klient.firma=g("firma"); z.klient.nip=g("nip").replace(/[^0-9]/g,"");
    const em=g("email").toLowerCase(); if(em) z.email=em;
    z.adresDostawy=z.adresDostawy||{};
    z.adresDostawy.ulica=g("ulica"); z.adresDostawy.nrDomu=g("nrDomu"); z.adresDostawy.nrLokalu=g("nrLokalu");
    z.adresDostawy.kod=g("kod"); z.adresDostawy.miasto=g("miasto");
    if(f.has("paczkomat")){ const kod=g("paczkomat").toUpperCase(); z.paczkomat=kod; z.paczkomatAdres=g("paczkomatAdres"); const w=daneWysylki(z); w.punktKod=kod; z.wysylka=w; }
    z.uwagi=g("uwagi");
    const a=z.adresDostawy;
    z.adres=`${a.ulica} ${a.nrDomu}${a.nrLokalu?"/"+a.nrLokalu:""}, ${a.kod} ${a.miasto}`.replace(/\s+/g," ").replace(/^[,\s]+|[,\s]+$/g,"").trim();
  });
  loguj("info",`Zaktualizowano dane odbiorcy zamówienia ${nr}`);
  toast("Dane odbiorcy zapisane ✅");
  renderuj();
}
function przelaczDostawaAdmin(sel){
  const row=$("admPaczkomatRow"); if(row) row.style.display = sel.value==="paczkomat" ? "" : "none";
}
function zapiszNadanie(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), g=k=>String(f.get(k)||"").trim();
  aktualizujZamowienie(nr, z=>{
    const stareRazem=kwotaNum(z.razem);
    z.klient=z.klient||{};
    z.klient.imie=g("imie"); z.klient.nazwisko=g("nazwisko"); z.klient.telefon=g("telefon");
    z.klient.firma=g("firma"); z.klient.nip=g("nip").replace(/[^0-9]/g,"");
    const em=g("email").toLowerCase(); if(em) z.email=em;
    z.adresDostawy=z.adresDostawy||{};
    z.adresDostawy.ulica=g("ulica"); z.adresDostawy.nrDomu=g("nrDomu"); z.adresDostawy.nrLokalu=g("nrLokalu");
    z.adresDostawy.kod=g("kod"); z.adresDostawy.miasto=g("miasto");
    const typ = g("dostawaTyp")==="kurier_inpost" ? "kurier_inpost" : "paczkomat";
    z.dostawaId=typ;
    z.dostawa = typ==="paczkomat" ? "Paczkomat InPost 24/7" : "Kurier InPost";
    const w=daneWysylki(z);
    if(typ==="paczkomat"){ const kod=g("paczkomat").toUpperCase(); z.paczkomat=kod; w.punktKod=kod; z.paczkomatAdres=g("paczkomatAdres"); }
    else { z.paczkomat=""; z.paczkomatAdres=""; w.punktKod=""; }
    const gab=g("gabaryt"); if(["small","medium","large"].includes(gab)) w.gabaryt=gab;
    if(g("waga")) w.waga=g("waga"); if(g("dlugosc")) w.dlugosc=g("dlugosc"); if(g("szerokosc")) w.szerokosc=g("szerokosc"); if(g("wysokosc")) w.wysokosc=g("wysokosc");
    const pobranieAktywneForm=g("pobranieAktywne")==="tak";
    const pobranieForm=pobranieAktywneForm ? g("pobranie") : "";
    const sposobNadania=g("sposobNadania");
    w.ochrona=g("ochrona");
    w.pobranieAktywne=pobranieAktywneForm;
    w.pobranie=pobranieForm;
    w.paczkaWeekend=g("paczkaWeekend")==="tak";
    w.sposobNadania=INPOST_SP_NADANIA[sposobNadania]?sposobNadania:INPOST_DOMYSLNY_SP_NADANIA;
    w.punktNadania=g("punktNadania").toUpperCase()||INPOST_DOMYSLNY_PUNKT_NADANIA;
    w.formatEtykiety=g("formatEtykiety").toUpperCase()==="A4"?"A4":"A6";
    if(f.has("numer")) w.numer=g("numer");
    if(f.has("trackingUrl")) w.trackingUrl=g("trackingUrl");
    w.przewoznik="inpost"; w.usluga = typ==="paczkomat" ? "Paczkomat 24/7" : "Kurier InPost";
    z.wysylka=w;
    zapiszKosztyZamowienia(z,{dostawaId:typ,paczkaWeekend:w.paczkaWeekend});
    if(pobranieAktywneForm && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) w.pobranie=kwotaNum(z.razem).toFixed(2);
    z.uwagi=g("uwagi");
    const a=z.adresDostawy;
    z.adres=`${a.ulica} ${a.nrDomu}${a.nrLokalu?"/"+a.nrLokalu:""}, ${a.kod} ${a.miasto}`.replace(/\s+/g," ").replace(/^[,\s]+|[,\s]+$/g,"").trim();
  });
  loguj("info",`Zapisano dane nadania zamówienia ${nr}`);
  toast("Zapisano dane nadania ✅");
  renderuj();
}
async function otworzGeowidgetAdmin(){
  const cfg=await pobierzInpostConfig();
  if(!cfg||!cfg.geowidgetToken){ toast("Mapa paczkomatów niedostępna — wpisz kod ręcznie"); const h=$("admPaczkomat"); if(h) h.focus(); return; }
  try{ await ladujGeowidgetSDK(); }catch(e){ toast(e.message||"Błąd mapy InPost"); return; }
  window.__geoTarget="admin";
  let ov=$("geoOverlay");
  if(!ov){ ov=document.createElement("div"); ov.id="geoOverlay"; ov.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:2vmin"; document.body.appendChild(ov); }
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;width:min(980px,96vw);height:min(88vh,780px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;background:#111;color:#fff"><b>Wybierz paczkomat InPost</b><button type="button" onclick="zamknijGeowidget()" style="background:#ffcc00;color:#111;border:0;border-radius:8px;padding:.4rem .8rem;font-weight:800;cursor:pointer">Zamknij ✕</button></div>
    <div style="flex:1;min-height:0"><inpost-geowidget onpoint="artwayPunktWybrany" token="${esc(cfg.geowidgetToken)}" language="pl" config="parcelCollect" style="width:100%;height:100%;display:block"></inpost-geowidget></div>
  </div>`;
  ov.style.display="flex";
}
function zmienStatus(nr, status){
  const t = pobierzZamowienia();
  const z = t.find(x=>x.nr===nr);
  if(z){
    const zmiana=zastosujStatusZamowieniaLokalnie(z,status);
    if(!zmiana){renderuj();return;}
    zapiszLS("artway_zamowienia", t);
    loguj("info",`Zmieniono status zamówienia ${nr} → ${status}`);
    toast(`${nr}: ${status} ✅`);
    // Serwer sam wyśle e-mail statusowy przy zapisie; awaryjnie (brak połączenia z bazą) próbujemy z panelu
    zapiszZamowienieCentralnie(z,false).then(d=>{ if(!d) void obsluzAutomatycznyEmail(nr,status); });
  }
  renderuj();
}
async function usunZamowienie(nr){
  const numer=nrZamowienia(nr), z=pobierzZamowienia().find(x=>x.nr===numer);
  oznaczZamowienieUsuniete(numer,{by:"admin",email:z?.email||""});
  zapiszLS("artway_zamowienia", pobierzZamowienia().filter(x=>x.nr!==numer));
  if(maUprawnieniaZapisuChmury()){
    try{
      await chmura("store-order-delete",{method:"POST",body:{number:numer}});
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    }catch(bl){
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
      toast("Usunięto lokalnie, ale nie zapisano na serwerze: "+bl.message);
    }
  }else{
    toast("Usunięto lokalnie. Zaloguj administratora, aby utrwalić usunięcie na serwerze.");
  }
  loguj("info","Usunięto zamówienie "+nr);
  toast("Zamówienie usunięte — nie wróci do obsługi");
  if(trasa().startsWith("/admin/zamowienie/")) location.hash="#/admin/zamowienia"; else renderuj();
}
let szukajKlientow = "",klienciWynikiEmails=[];
function klienciUstawZaznaczenie(zakres,zaznacz=true){
  const emails=zakres==="filtr"||zakres==="strona"?klienciWynikiEmails:Array.isArray(zakres)?zakres:[];
  emails.forEach(email=>zaznacz?zaznaczeniKlienci.add(String(email).toLowerCase()):zaznaczeniKlienci.delete(String(email).toLowerCase()));renderuj();
}
function klienciWyczyscZaznaczenie(){zaznaczeniKlienci.clear();renderuj();}
function klienciEksportujZakres(zakres="filtr"){
  const ids=zakres==="zaznaczone"?new Set([...zaznaczeniKlienci]):new Set(klienciWynikiEmails);
  const lista=pobierzUzytkownikow().filter(k=>ids.has(String(k.email||"").toLowerCase()));
  eksportujKlientow(lista,zakres==="zaznaczone"?"klienci-zaznaczeni.csv":"klienci-filtrowani.csv");
}
function zmienRoleUzytkownika(email){
  if(!jestAdmin()){ toast("Brak uprawnień"); return; }
  const e=String(email||"").toLowerCase(),u=pobierzUzytkownikow(),k=u.find(x=>x.email===e);
  if(!k){ toast("Nie znaleziono użytkownika"); return; }
  if(jestGlownymAdminem(e)){ toast("Nie można zmienić roli głównego administratora"); return; }
  const maRole=k.rola==="admin";
  if(maRole&&sesja?.email===e){ toast("Nie możesz odebrać uprawnień aktualnie używanemu kontu"); return; }
  k.rola=maRole?"klient":"admin";
  if(maRole){ k.telegramAccess=false;k.telegramApprover=false; }
  zapiszLS("artway_uzytkownicy",u);
  void zapiszUzytkownikaCentralnie(k);
  loguj("info",`${maRole?"Odebrano":"Nadano"} rolę administratora: ${e}`);
  toast(maRole?"Odebrano uprawnienia administratora":"Nadano uprawnienia administratora 🛡️");
  renderuj();
}
function widokAdminKlienci(sekcja="lista"){
  const aktywna=["lista","dodaj","uprawnienia","zamowienia"].includes(String(sekcja||""))?String(sekcja||""):"lista";
  let kl = pobierzUzytkownikow();
  if(szukajKlientow) kl = kl.filter(k=>(k.imie+" "+k.email).toLowerCase().includes(szukajKlientow));
  if(aktywna==="uprawnienia") kl=kl.slice().sort((a,b)=>Number(kontoMaRoleAdmin(b.email))-Number(kontoMaRoleAdmin(a.email))||String(a.email).localeCompare(String(b.email),"pl"));
  klienciWynikiEmails=kl.map(k=>String(k.email||"").toLowerCase()).filter(Boolean);
  const zam = pobierzZamowienia();
  const klienciZZamowieniami=kl.map(k=>{
    const z=zam.filter(x=>x.email===k.email);
    return {k,z,ile:z.length,suma:z.filter(x=>x.status!=="anulowane").reduce((s,x)=>s+kwotaNum(x.razem),0),ostatnie:z.slice().sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0))[0]};
  }).filter(x=>x.ile).sort((a,b)=>b.suma-a.suma);
  return adminSzkielet("/admin/klienci", `
  ${klienciSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="dodaj"?"":"display:none"}">
    <h1>➕ Dodaj klienta (pełna kartoteka)</h1>
    <form onsubmit="dodajKlientaAdmin(event)">
      ${polaKartotekiHTML({})}
      <button class="btn" type="submit">➕ Utwórz konto klienta</button>
    </form>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">Konto trafia do wspólnej bazy serwerowej. Klient może zalogować się na dowolnym urządzeniu.</p>
  </div>
  <div class="panel" style="${["lista","uprawnienia"].includes(aktywna)?"":"display:none"}">
    <h1>${aktywna==="uprawnienia"?"🛡️ Uprawnienia użytkowników":"👥 Użytkownicy"} (${kl.length}) <button class="btn ghost" style="float:right" onclick="eksportujKlientow()">📤 CSV</button></h1>
    ${aktywna==="uprawnienia"?`<div class="backend-note" style="margin-bottom:.8rem">Tutaj szybko nadajesz lub odbierasz rolę administratora. Konto głównego właściciela i aktualnie używane konto są chronione przed przypadkową zmianą.</div>`:""}
    ${adminWyszukiwaniePanelHTML({id:"customers",description:"Imię, nazwisko albo adres e-mail użytkownika.",results:kl.length,active:!!szukajKlientow,open:true,fields:`<label class="search-wide">Klient<input placeholder="Imię, nazwisko lub e-mail…" value="${esc(szukajKlientow)}" oninput="szukajKlientow=this.value.toLowerCase();zaplanujRenderPoWpisaniu()"></label>${szukajKlientow?`<button class="btn ghost" onclick="szukajKlientow='';renderuj()">Wyczyść filtry</button>`:""}`,actions:adminOperacjeWynikowHTML({id:"customers",selected:zaznaczeniKlienci.size,pageCount:kl.length,resultCount:kl.length,selectPage:"klienciUstawZaznaczenie('strona')",selectAll:"klienciUstawZaznaczenie('filtr')",clear:"klienciWyczyscZaznaczenie()",exportSelected:"klienciEksportujZakres('zaznaczone')",exportAll:"klienciEksportujZakres('filtr')"})})}
    <div class="table-scroll"><table class="log-table">
      <tr><th>Wybór</th><th>Imię i nazwisko</th><th>E-mail</th><th>Rola</th><th>Telegram</th><th>Rejestracja</th><th>Zamówień</th><th>Akcje</th></tr>
      ${kl.map(k=>{
        const admin = kontoMaRoleAdmin(k.email), glowny=jestGlownymAdminem(k.email);
        const nZam = zam.filter(z=>z.email===k.email).length;
        return `<tr>
        <td><input type="checkbox" aria-label="Zaznacz ${esc(k.email)}" ${zaznaczeniKlienci.has(String(k.email||"").toLowerCase())?"checked":""} onchange="klienciUstawZaznaczenie([${jsArg(k.email)}],this.checked)"></td>
        <td><a href="#/admin/klient/${encodeURIComponent(k.email)}"><b>${esc(k.imie)}</b></a>${admin?' <span class="lvl lvl-info">ADMIN</span>':""}${k.nip?' <span class="lvl lvl-info">firma</span>':""}</td>
        <td>${esc(k.email)}${k.telefon?`<br><small style="color:var(--muted2)">📞 ${esc(k.telefon)}</small>`:""}</td>
        <td><span class="lvl ${admin?"lvl-info":""}">${admin?"administrator":"klient"}</span>${glowny?"<br><small>właściciel</small>":""}</td>
        <td>${telegramDostepKontaHTML(k,admin)}</td>
        <td>${new Date(k.data).toLocaleDateString("pl-PL")}</td>
        <td>${nZam ? `<a href="#/admin/zamowienia" onclick="szukajZamowien='${esc(k.email)}';filtrZamowien='wszystkie'" title="Zamówienia klienta">${nZam} →</a>` : "0"}</td>
        <td style="white-space:nowrap">
          <a class="btn ghost" href="#/admin/klient/${encodeURIComponent(k.email)}" style="padding:.3rem .55rem" title="Kartoteka klienta">📇</a>
          ${glowny||sesja?.email===k.email?"":`<button class="btn ghost" onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')" style="padding:.3rem .55rem" title="${admin?"Odbierz rolę administratora":"Nadaj rolę administratora"}">${admin?"🔒":"🛡️"}</button>`}
          ${admin?"":`<button class="ci-remove" onclick="if(confirm('Usunąć konto ${esc(k.email)}?')) usunKlienta('${esc(k.email)}')" title="Usuń konto">🗑️</button>`}
        </td>
      </tr>`;}).join("")}
    </table></div>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">📇 otwiera pełną kartotekę klienta. ID Telegram użytkownik otrzyma po wysłaniu <b>/start</b> do bota. Zapisanie opcji „wspólny czat” nadaje dostęp natychmiast — bez restartu serwera. „Zatwierdzanie” jest osobnym, wyższym uprawnieniem.</p>
  </div>
  <div class="panel" style="${aktywna==="zamowienia"?"":"display:none"}">
    <div class="order-section-head">
      <div><h1 style="margin:0">📦 Zamówienia klientów</h1><p class="order-detail-lead">Szybki widok klientów według liczby i wartości zamówień.</p></div>
      <a class="btn ghost" href="#/admin/zamowienia">Pełna lista zamówień</a>
    </div>
    <div class="table-scroll"><table class="log-table">
      <tr><th>Klient</th><th>E-mail</th><th>Zamówień</th><th>Wartość</th><th>Ostatnie</th><th>Akcje</th></tr>
      ${klienciZZamowieniami.map(x=>`<tr>
        <td><a href="#/admin/klient/${encodeURIComponent(x.k.email)}"><b>${esc(x.k.imie||"Klient")}</b></a></td>
        <td>${esc(x.k.email)}</td>
        <td><b>${x.ile}</b></td>
        <td>${zl(x.suma)}</td>
        <td>${x.ostatnie?`<a href="#/admin/zamowienie/${encodeURIComponent(x.ostatnie.nr)}">${esc(x.ostatnie.nr)}</a><br><small>${esc(x.ostatnie.data||"")}</small>`:"—"}</td>
        <td><a class="btn ghost" href="#/admin/zamowienia" onclick="szukajZamowien=${jsArg(x.k.email)};filtrZamowien='wszystkie'">Pokaż zamówienia</a></td>
      </tr>`).join("") || `<tr><td colspan="6">Brak klientów z zamówieniami.</td></tr>`}
    </table></div>
  </div>`);
}
