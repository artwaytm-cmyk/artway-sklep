function allegroProduktSelectHTML(offerId){
  const pid=String(allegroProduktIdDlaOferty(offerId)||"");
  const lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).sort((a,b)=>String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl")).slice(0,1000);
  return `<select class="allegro-map-select" onchange="allegroMapujOferte(${jsArg(offerId)},this.value)">
    <option value="">Nie podpięto</option>
    ${lista.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===pid?"selected":""}>${esc(allegroKodProduktu(p)||"ID "+p.id)} — ${esc(skrocTekst(p.nazwa,70))}</option>`).join("")}
  </select>`;
}
function allegroStatusKolejki(z){
  const status=String(z?.status||"").toUpperCase(), fulfillment=String(z?.fulfillmentStatus||z?.fulfillment?.status||z?.allegroStatus||"").toUpperCase();
  if(status==="CANCELLED"||fulfillment==="CANCELLED") return "CANCELLED";
  return fulfillment||"NEW";
}
function allegroAktualizujPodsumowanieZamowien(updatedAt=null,archive=null){
  const lista=Array.isArray(allegroZamowienia)?allegroZamowienia:[],statusCounts={};
  for(const order of lista){const status=allegroStatusKolejki(order);statusCounts[status]=(statusCounts[status]||0)+1;}
  allegroPodsumowanie.orders={...(allegroPodsumowanie.orders||{}),live:lista.length,active:lista.filter(allegroZamowienieAktywneLokalnie).length,statusCounts,archived:Number(archive?.total??allegroPodsumowanie.orders?.archived)||0,retentionDays:30,updated_at:updatedAt||allegroPodsumowanie.orders?.updated_at||new Date().toISOString()};
}
function allegroStatusKolejkiMeta(z){
  const s=allegroStatusKolejki(z);
  return ({
    NEW:{label:"Nowe",klasa:"lvl-ostrzezenie"},PROCESSING:{label:"W realizacji",klasa:"lvl-info"},READY_FOR_SHIPMENT:{label:"Gotowe do wysłania",klasa:"lvl-info"},READY_FOR_PICKUP:{label:"Gotowe do odbioru",klasa:"lvl-info"},SENT:{label:"Wysłane",klasa:"lvl-ok"},PICKED_UP:{label:"Odebrane",klasa:"lvl-ok"},CANCELLED:{label:"Anulowane",klasa:"lvl-blad"},SUSPENDED:{label:"Wstrzymane",klasa:"lvl-blad"},RETURNED:{label:"Zwrócone",klasa:"lvl-blad"}
  })[s]||{label:s||"NEW",klasa:"lvl-info"};
}
function allegroLokalnyStatus(z={}){return [z.warehouseStage,z.agentStage,z.localStage,z.magazynStatus,z.localStatus].map(v=>String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l"));}
function allegroZamowienieZrealizowaneLokalnie(z={}){return allegroLokalnyStatus(z).some(s=>["zrealizowane","zamkniete","wyslane","anulowane"].includes(s))||z.agentHandled===true||z.localCompleted===true;}
const ALLEGRO_STATUSY_ZAMKNIETE=new Set(["SENT","PICKED_UP","CANCELLED","RETURNED"]);
function allegroZamowienieZamknieteWAllegro(z={}){return ALLEGRO_STATUSY_ZAMKNIETE.has(allegroStatusKolejki(z));}
function allegroKategoriaKolejki(z={}){const status=allegroStatusKolejki(z);if(ALLEGRO_STATUSY_ZAMKNIETE.has(status))return status;return allegroZamowienieZrealizowaneLokalnie(z)?"zrealizowane":status;}
function allegroZamowienieAktywneLokalnie(z={}){return !allegroZamowienieZamknieteWAllegro(z)&&!allegroZamowienieZrealizowaneLokalnie(z);}
function allegroEtapMagazynu(z={}){if(allegroZamowienieZamknieteWAllegro(z))return "zamkniete";if(allegroZamowienieZrealizowaneLokalnie(z))return "zrealizowane";const s=String(z.warehouseStage||"").toLowerCase();return ["do_sprawdzenia","braki","oczekuje_na_dostawe","kompletacja","spakowane"].includes(s)?s:"do_sprawdzenia";}
function allegroEtapMagazynuMeta(z={}){return ({do_sprawdzenia:{label:"Do sprawdzenia",klasa:"lvl-ostrzezenie"},braki:{label:"Braki — zamówić",klasa:"lvl-blad"},oczekuje_na_dostawe:{label:"Zamówione • oczekuje na dostawę",klasa:"lvl-info"},kompletacja:{label:"Oczekuje na wysyłkę",klasa:"lvl-info"},spakowane:{label:"Spakowane",klasa:"lvl-ok"},zrealizowane:{label:"Zrealizowane lokalnie",klasa:"lvl-ok"},zamkniete:{label:"Zamknięte przez Allegro",klasa:"lvl-ok"}})[allegroEtapMagazynu(z)];}
function allegroOfertaPoId(offerId){
  return allegroIndeksOfert().byId.get(String(offerId))||null;
}
function allegroOfertaDlaProduktuSklepu(p={}){
  const matches=allegroOfertyPasujaceDoProduktu(p);return matches.find(allegroDopasowanieDuplikatuAktywne)?.offer||matches[0]?.offer||null;
}
function allegroStatusProduktuHTML(p={}){
  const wszystkie=allegroOfertyPasujaceDoProduktu(p),dopasowania=wszystkie.filter(allegroDopasowanieDuplikatuAktywne),o=dopasowania[0]?.offer||wszystkie[0]?.offer;
  if(!o)return `<span class="lvl lvl-ostrzezenie">brak na Allegro</span>`;
  const active=String(o.status||"").toUpperCase()==="ACTIVE";
  const duplikaty=dopasowania.slice(1);
  return `<span class="lvl ${active?"lvl-ok":"lvl-info"}">${active?"aktywna":"na Allegro: "+(o.status||"szkic")}</span>${duplikaty.length?` <span class="lvl lvl-blad" title="${esc(dopasowania.map(x=>`${x.offer.id}: ${x.reason}`).join(" • "))}">⚠️ ${dopasowania.length} ofert</span>`:""}<br><small>ID ${esc(o.id)}${duplikaty.length?` • sprawdź duplikaty`:""}</small>`;
}
function allegroDanePozycjiZamowienia(it={}){
  const oferta=allegroOfertaPoId(it.offerId);
  return {
    kod:String(it.externalId||oferta?.externalId||it.offerId||"").trim(),
    ean:String(oferta?.ean||oferta?.gtin||oferta?.manufacturerCode||oferta?.producerCode||"").trim(),
    nazwa:String(it.offerName||oferta?.name||"Produkt Allegro").trim(),
    ilosc:Math.max(1,Number(it.quantity)||1),
    zdjecie:String(oferta?.mainImage||(oferta?.images||[])[0]||it.image||"").trim()
  };
}
function allegroPodobienstwoNazwProduktow(a,b){
  const aa=new Set(allegroTokenyNazwy(a)),bb=new Set(allegroTokenyNazwy(b));if(!aa.size||!bb.size)return 0;
  let wspolne=0;aa.forEach(x=>{if(bb.has(x))wspolne++;});return wspolne/Math.max(aa.size,bb.size);
}
let allegroMapowaniePozycjiCel={offerId:"",offerName:"",error:null};
function allegroZamknijMapowaniePozycji(){document.getElementById("allegroMappingModal")?.remove();allegroMapowaniePozycjiCel={offerId:"",offerName:"",error:null};}
function allegroOtworzMapowaniePozycji(offerId,offerName=""){
  allegroMapowaniePozycjiCel={offerId:String(offerId||""),offerName:String(offerName||""),error:null};document.getElementById("allegroMappingModal")?.remove();
  const modal=document.createElement("div");modal.id="allegroMappingModal";modal.className="emoji-picker-overlay";modal.onclick=allegroZamknijMapowaniePozycji;
  modal.innerHTML=`<div class="emoji-picker-modal allegro-mapping-modal" onclick="event.stopPropagation()"><div class="emoji-picker-head"><div><span class="order-pro-label">Trwałe powiązanie kanoniczne</span><h2>🧩 Wybierz produkt sklepu</h2><p>Wybór zapisuje jedną ofertę główną. Sklep staje się źródłem nazwy, ceny, opisów, zdjęć i parametrów, a Agent później kontroluje oraz aktualizuje Allegro bez ponownego łączenia.</p></div><button class="btn ghost" type="button" onclick="allegroZamknijMapowaniePozycji()">✕ Zamknij</button></div><input class="emoji-picker-search" id="allegroMappingSearch" placeholder="Szukaj po nazwie, ID produktu, EAN, SKU, EXTERNAL_ID lub kodzie producenta…" oninput="allegroRenderujKandydatowMapowania(this.value)"><div id="allegroMappingCandidates"></div></div>`;
  document.body.appendChild(modal);allegroRenderujKandydatowMapowania("");modal.querySelector("#allegroMappingSearch")?.focus();
}
function allegroRenderujKandydatowMapowania(q=""){
  const box=document.getElementById("allegroMappingCandidates");if(!box)return;
  const offerId=allegroMapowaniePozycjiCel.offerId,oferta=allegroOfertaPoId(offerId)||{},query=String(q||"").trim().toLowerCase(),currentId=String(allegroProduktIdDlaOferty(offerId)||""),all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  let lista=query?all.filter(p=>`${p.id} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||p.marka||""}`.toLowerCase().includes(query)).map(p=>allegroOcenaMapowaniaKandydata(oferta,p)):allegroKandydaciMapowaniaOferty(oferta).slice(0,12);
  lista.sort((a,b)=>b.score-a.score||Number(a.occupied.length)-Number(b.occupied.length)||String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl"));lista=lista.slice(0,50);
  const err=allegroMapowaniePozycjiCel.error,errValidation=err?.validation||{};
  box.innerHTML=`<div class="allegro-mapping-source-card">${oferta.mainImage?`<img src="${esc(oferta.mainImage)}" alt="">`:`<span>🏷️</span>`}<div><small>OFERTA ALLEGRO</small><b>${esc(oferta.name||allegroMapowaniePozycjiCel.offerName||"—")}</b><p>ID ${esc(offerId)} • EAN ${esc(oferta.ean||oferta.gtin||"—")} • EXTERNAL_ID ${esc(oferta.externalId||"—")} • kod ${esc(oferta.manufacturerCode||oferta.producerCode||"—")}</p></div></div>${err?`<div class="backend-note allegro-mapping-error"><b>Nie zapisano połączenia:</b> ${esc(err.message||err)}${errValidation.conflicts?.length?`<br><small>${esc(errValidation.conflicts.join(" • "))}</small>`:""}</div>`:""}<div class="backend-note"><b>Jak czytać wynik:</b> procent oznacza pewność, że jest to ten sam towar. Brakujące pola nie obniżają wyniku; ostrzeżenie o danych jest pokazywane osobno.</div><div class="allegro-mapping-results pro">${lista.map(x=>{const p=x.produkt,isCurrent=String(p.id)===currentId,cls=x.strongConflict?"conflict":x.score>=88?"strong":x.score>=65?"review":"weak",occupied=x.occupied.length>0&&!isCurrent;return `<article class="allegro-mapping-candidate ${cls} ${isCurrent?"is-current":""}"><div class="allegro-mapping-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • EAN ${esc(p.gtin||p.ean||"—")} • SKU/EXTERNAL_ID ${esc(p.sku||p.externalId||"—")} • kod ${esc(p.kodProducenta||p.mpn||"—")}</small><div class="allegro-evidence-chips">${(x.evidence||[]).map(v=>`<span class="ok">✓ ${esc(v)}</span>`).join("")}${(x.warnings||[]).map(v=>`<span class="warn">i ${esc(v)}</span>`).join("")}${(x.conflicts||[]).map(v=>`<span class="bad">! ${esc(v)}</span>`).join("")||(!x.evidence.length?`<span>brak wspólnych kodów</span>`:"")}</div></div></div><div class="allegro-mapping-confidence"><b>${esc(x.score)}%</b><small>pewność tożsamości • ${esc(x.reason)}</small>${occupied?`<em>Ten sam produkt jest już podpięty do oferty ${esc(x.occupied.join(", "))}</em>`:""}</div><div class="allegro-mapping-choice">${isCurrent?`<span class="lvl ${x.valid?"lvl-ok":"lvl-blad"}">${x.valid?"obecne, zweryfikowane":"obecne, błędne"}</span>`:x.strongConflict?`<button class="btn danger" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)},true,${occupied})">Połącz mimo konfliktu</button>`:occupied?`<button class="btn ghost" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)},false,true)">Przenieś powiązanie tutaj</button>`:`<button class="btn" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)})">Połącz ten produkt</button>`}<a href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Otwórz kartę produktu</a></div></article>`;}).join("")||`<div class="backend-note">Brak wyników. Wpisz nazwę, ID produktu, EAN, SKU, EXTERNAL_ID albo kod producenta.</div>`}</div>${currentId?`<button class="btn danger" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},'')">Usuń obecne powiązanie</button>`:""}`;
  const note=[...box.querySelectorAll(".backend-note")].find(el=>!el.classList.contains("allegro-mapping-error"));
  if(note)note.innerHTML="<b>Decyzja trwała:</b> dowody pomagają rozpoznać towar, ale zatwierdzone połączenie nie będzie później zrywane przez różnicę nazwy. Inne bieżące oferty tego produktu zostaną pokazane jako duplikaty do decyzji, a historia zamówień pozostanie zachowana.";
  box.querySelectorAll(".allegro-mapping-choice button").forEach(button=>{button.textContent="Ustaw jako ofertę główną";button.classList.remove("ghost");});
  box.querySelectorAll(".allegro-mapping-candidate.is-current .allegro-mapping-choice .lvl").forEach(status=>{status.className="lvl lvl-ok";status.textContent="trwałe powiązanie";});
}
async function allegroWybierzMapowaniePozycji(offerId,productId){const result=await allegroMapujOferte(offerId,productId,{manualDecision:true,syncOffer:true});if(result?.ok)allegroZamknijMapowaniePozycji();else allegroRenderujKandydatowMapowania(document.getElementById("allegroMappingSearch")?.value||"");}
function allegroZamowieniePasujeDoFiltra(z){
  const kategoria=allegroKategoriaKolejki(z);
  const statusOk=["wszystkie","archiwum"].includes(filtrAllegroZamowien)||(filtrAllegroZamowien==="do_obslugi"?allegroZamowienieAktywneLokalnie(z):kategoria===filtrAllegroZamowien);
  const etapOk=filtrEtapuAllegroZamowien==="wszystkie"||allegroEtapMagazynu(z)===filtrEtapuAllegroZamowien;
  return statusOk&&etapOk;
}
function allegroWierszeZamowien(source=allegroZrodloZamowien()){
  const rows=[];
  for(const z of Array.isArray(source)?source:[]){
    const items=Array.isArray(z.lineItems)&&z.lineItems.length?z.lineItems:[{offerId:"",offerName:"Brak pozycji",quantity:0}];
    for(const it of items){
      const dane=allegroDanePozycjiZamowienia(it);
      rows.push({z,it,dane,tekst:`${z.id||""} ${z.nr||""} ${z.email||""} ${z.buyerLogin||""} ${z.buyerName||""} ${z.phone||""} ${it.offerId||""} ${dane.kod} ${dane.ean} ${dane.nazwa} ${allegroStatusKolejki(z)}`.toLowerCase()});
    }
  }
  return rows;
}
function allegroPasujaceZamowienia(){
  const q=String(szukajAllegroZamowien||"").toLowerCase().trim();
  const wszystkie=allegroZrodloZamowien();
  const pasujaceIds=q?new Set(allegroWierszeZamowien(wszystkie).filter(r=>r.tekst.includes(q)).map(r=>String(r.z.id))):null;
  return wszystkie.filter(allegroZamowieniePasujeDoFiltra).filter(z=>!pasujaceIds||pasujaceIds.has(String(z.id)));
}
function allegroZaznaczWidoczneZamowienia(checked=true){
  allegroPasujaceZamowienia().slice(0,allegroLimitWidokuZamowien).forEach(z=>checked?zaznaczoneAllegroZamowienia.add(String(z.id)):zaznaczoneAllegroZamowienia.delete(String(z.id)));
  renderuj();
}
function allegroZaznaczWszystkiePasujaceZamowienia(){
  allegroPasujaceZamowienia().forEach(z=>zaznaczoneAllegroZamowienia.add(String(z.id)));
  renderuj();
}
function allegroZamowieniaTabelaHTML(){
  const wszystkie=Array.isArray(allegroZamowienia)?allegroZamowienia:[];
  const czyArchiwum=filtrAllegroZamowien==="archiwum";
  const aktywne=wszystkie.filter(statusAllegroRezerwujeMagazyn);
  const analizy=aktywne.map(z=>allegroAnalizaMagazynowaZamowienia(z));
  const wszystkiePozycje=analizy.flatMap(a=>a.pozycje||[]);
  const agentStat={
    gotowe:analizy.filter(a=>a.gotowe).length,
    zBrakami:analizy.filter(a=>a.braki>0).length,
    doWyjasnienia:analizy.filter(a=>a.nierozpoznane>0||a.bezStanu>0).length,
    lokalizacje:analizy.reduce((s,a)=>s+Number(a.bezLokalizacji||0),0),
    brakiSzt:analizy.reduce((s,a)=>s+Number(a.braki||0),0),
    dokumenty:(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length,
    pozycje:wszystkiePozycje.length,
    rozpoznane:wszystkiePozycje.filter(p=>p.produkt).length,
    reczne:wszystkiePozycje.filter(p=>String(p.match||"").includes("ręczne")).length
  };
  const pasujaceZamowienia=allegroPasujaceZamowienia();
  const widoczneZamowienia=pasujaceZamowienia.slice(0,allegroLimitWidokuZamowien);
  const zaznaczone=[...zaznaczoneAllegroZamowienia].filter(id=>wszystkie.some(z=>String(z.id)===id));
  const wszystkieWidoczneZaznaczone=!!widoczneZamowienia.length&&widoczneZamowienia.every(z=>zaznaczoneAllegroZamowienia.has(String(z.id)));
  const counts={do_obslugi:0,zrealizowane:0,wszystkie:wszystkie.length};
  wszystkie.forEach(z=>{const kategoria=allegroKategoriaKolejki(z);counts[kategoria]=(counts[kategoria]||0)+1;if(allegroZamowienieAktywneLokalnie(z))counts.do_obslugi++;});
  counts.archiwum=Number(allegroArchiwum.summary?.total||allegroPodsumowanie.orders?.archived||0);
  const filtry=[["do_obslugi","📋","Do obsługi","aktywne lokalnie"],["NEW","🆕","Nowe","status z Allegro"],["PROCESSING","⚙️","W realizacji","status z Allegro"],["READY_FOR_SHIPMENT","🚚","Do wysłania","status z Allegro"],["zrealizowane","✅","Zrealizowane lokalnie","obsłużone w sklepie"],["SENT","📤","Wysłane","status z Allegro"],["CANCELLED","⛔","Anulowane","status z Allegro"],["RETURNED","↩️","Zwrócone","status z Allegro"],["wszystkie","📦","Ostatnie 30 dni","rejestr operacyjny"],["archiwum","🗄️","Archiwum","> 30 dni, na żądanie"]];
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">📦 Zamówienia Allegro</h2><p class="order-detail-lead">Agent rozpoznaje pozycje po identyfikatorach, rezerwuje towar, pokazuje dokładną lokalizację albo dopisuje realny brak do właściwego szkicu zamówienia producenta. Oficjalny status zawsze pochodzi z Allegro.</p></div>
    </div>
    <div class="orders-status-strip allegro-order-filter-cards" aria-label="Filtry statusu zamówień">${filtry.map(([id,icon,label,description])=>`<button class="${filtrAllegroZamowien===id?"active":""}" onclick="allegroUstawFiltrZamowien(${jsArg(id)})" aria-pressed="${filtrAllegroZamowien===id}"><span>${icon}</span><b>${counts[id]||0}</b><strong>${label}</strong><small>${description}</small></button>`).join("")}</div>
    ${czyArchiwum?`<div class="archive-toolbar"><div><b>🗄️ Archiwum miesięczne</b><small>Ładowane dopiero po otwarciu — nie obciąża codziennej pracy.</small></div><label>Miesiąc <select onchange="allegroArchiwum.month=this.value;allegroWczytajArchiwum(true)"><option value="">Wszystkie miesiące</option>${(allegroArchiwum.summary?.months||[]).map(x=>`<option value="${esc(x.month)}" ${allegroArchiwum.month===x.month?"selected":""}>${esc(x.month)} (${esc(x.count)})</option>`).join("")}</select></label><button class="btn ghost" onclick="allegroWczytajArchiwum(true)" ${allegroArchiwum.busy?"disabled":""}>${allegroArchiwum.busy?"⏳ Ładuję…":"↻ Odśwież archiwum"}</button></div>${allegroArchiwum.error?`<div class="backend-note">${esc(allegroArchiwum.error)}</div>`:""}`:""}
    ${adminWyszukiwaniePanelHTML({id:"allegro-orders",description:"Zlecenie, klient, telefon, kod produktu, EAN, nazwa i etap magazynowy.",results:pasujaceZamowienia.length,active:!!(szukajAllegroZamowien||filtrAllegroZamowien!=="do_obslugi"||filtrEtapuAllegroZamowien!=="wszystkie"),open:true,fields:`<div class="orders-toolbar allegro-toolbar admin-search-full">
      <input placeholder="Szukaj: zamówienie, klient, telefon, kod, EAN, nazwa produktu…" value="${esc(szukajAllegroZamowien)}" oninput="szukajAllegroZamowien=this.value.toLowerCase();zaplanujRenderPoWpisaniu()">
      <label>Etap magazynu <select onchange="filtrEtapuAllegroZamowien=this.value;renderuj()">${[["wszystkie","Wszystkie etapy"],["do_sprawdzenia","Do sprawdzenia"],["braki","Braki"],["oczekuje_na_dostawe","Oczekuje na dostawę"],["kompletacja","Oczekuje na wysyłkę"],["spakowane","Spakowane"],["zrealizowane","Zrealizowane lokalnie"]].map(([v,l])=>`<option value="${v}" ${filtrEtapuAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <label class="allegro-view-limit">Pokaż zleceń <select onchange="allegroLimitWidokuZamowien=Number(this.value)||100;renderuj()">${[25,50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWidokuZamowien===n?"selected":""}>${n}</option>`).join("")}</select></label>
      ${szukajAllegroZamowien?`<button class="btn ghost" onclick="szukajAllegroZamowien='';renderuj()">Wyczyść</button>`:""}
    </div>`,actions:czyArchiwum?"":adminOperacjeWynikowHTML({id:"allegro-orders",selected:zaznaczone.length,pageCount:widoczneZamowienia.length,resultCount:pasujaceZamowienia.length,selectPage:"allegroZaznaczWidoczneZamowienia(true)",selectAll:"allegroZaznaczWszystkiePasujaceZamowienia()",clear:"allegroWyczyscZaznaczenieZamowien()",exportSelected:"allegroEksportujZamowienia('zaznaczone')",exportAll:"allegroEksportujZamowienia('filtr')"})})}
    ${czyArchiwum?`<div class="backend-note"><b>Tryb tylko do odczytu.</b> Archiwalne zlecenia nie są ponownie synchronizowane, rezerwowane ani dodawane do planu producenta.</div>`:`<div class="allegro-bulk-toolbar">
      <div><b>Operacje na zleceniach</b><small>${zaznaczone.length} zaznaczonych • checkbox służy tylko do operacji grupowych</small></div>
      <div class="allegro-bulk-stage"><button class="btn" onclick='allegroUtworzZamowienieProducenta(${JSON.stringify(zaznaczone)})' ${zaznaczone.length?"":"disabled"}>🧾 Utwórz/aktualizuj plany producentów (${zaznaczone.length})</button><label for="bulkAllegroWarehouseStage">Etap magazynu</label><select id="bulkAllegroWarehouseStage"><option value="">— wybierz etap —</option><option value="do_sprawdzenia">Do sprawdzenia</option><option value="braki">Braki — zamówić</option><option value="oczekuje_na_dostawe">Zamówione — oczekuje</option><option value="kompletacja">Oczekuje na wysyłkę</option><option value="spakowane">Spakowane</option><option value="zrealizowane">✅ Zrealizowane lokalnie</option></select><button class="btn" onclick="allegroUstawEtapZaznaczonychZamowien()" ${zaznaczone.length?"":"disabled"}>Zastosuj do ${zaznaczone.length}</button></div>
    </div>`}
    <div class="allegro-order-list">${widoczneZamowienia.map(allegroZlecenieHTML).join("") || `<div class="backend-note">Brak zamówień w tym filtrze. Synchronizacja pobiera wyłącznie nowe i gotowe do wysłania.</div>`}</div>
    ${czyArchiwum&&allegroArchiwum.hasMore?`<button class="btn ghost archive-load-more" onclick="allegroWczytajArchiwum(false)" ${allegroArchiwum.busy?"disabled":""}>${allegroArchiwum.busy?"Ładuję…":"Pokaż kolejne 100"}</button>`:""}
    ${widoczneZamowienia.length>=allegroLimitWidokuZamowien?`<p class="order-detail-lead">Pokazano pierwsze ${allegroLimitWidokuZamowien} zleceń. Zwiększ limit widoku powyżej, aby zobaczyć więcej.</p>`:""}
    <section class="allegro-stock-agent allegro-info-bottom"><div class="allegro-stock-agent-head"><div><b>🤖 Agent magazynowy i mapowanie produktów</b><small>Nowe zlecenia są sprawdzane co 15 minut. Agent łączy pozycje kolejno po ręcznym powiązaniu, EAN, SKU, kodzie producenta i jednoznacznej nazwie. Niepewne dopasowania zostawia do decyzji administratora.</small></div><a class="btn ghost" href="#/admin/magazyn/plan">📦 Plan zatowarowania</a></div><div class="allegro-stock-agent-stats allegro-mapping-stats"><span><b>${agentStat.rozpoznane}/${agentStat.pozycje}</b><small>pozycji połączonych</small></span><span><b>${agentStat.reczne}</b><small>powiązań ręcznych</small></span><span><b>${agentStat.gotowe}</b><small>zleceń gotowych</small></span><span class="${agentStat.zBrakami?"alert":""}"><b>${agentStat.zBrakami}</b><small>z brakami (${agentStat.brakiSzt} szt.)</small></span><span class="${agentStat.doWyjasnienia?"warn":""}"><b>${agentStat.doWyjasnienia}</b><small>do wyjaśnienia</small></span><span class="${agentStat.lokalizacje?"warn":""}"><b>${agentStat.lokalizacje}</b><small>lokalizacji do ustalenia przez magazyn</small></span></div></section>
    <div class="backend-note allegro-info-bottom"><b>Status Allegro działa tylko w jedną stronę.</b> Sklep odczytuje jego zmianę automatycznie co 15 minut. Lokalne etapy magazynowe służą wyłącznie organizacji pracy i nigdy nie zmieniają statusu w Allegro. Po przyjęciu pełnego dokumentu producenta zlecenie przechodzi do „Oczekuje na wysyłkę” i nie zasila kolejnego zamówienia zakupowego.</div>
  </div>`;
}
function allegroStanPozycjiHTML(p={}){
  if(!p.produkt)return `<span class="lvl lvl-blad">nierozpoznany produkt</span><br><small>Wymagany EAN, SKU albo mapowanie oferty.</small>`;
  if(p.stan===null)return `<span class="lvl lvl-ostrzezenie">brak kontrolowanego stanu</span><br><small>Uzupełnij stan produktu ID ${esc(p.produkt.id)} w Magazynie.</small>`;
  return `stan: <b>${esc(p.stan)}</b> szt.<br><small>łączne rezerwacje: ${esc(p.laczneRezerwacje)} • po rezerwacji: ${esc(p.dostepne)}</small>`;
}
function allegroDecyzjaAgentaHTML(p={},z={}){
  if(p.decyzja==="nierozpoznany")return `<span class="lvl lvl-blad">sprawdź EAN/SKU</span><br><small>Agent nie połączył pozycji z kartoteką.</small>`;
  if(p.decyzja==="sprawdz_stan")return `<span class="lvl lvl-ostrzezenie">ustal stan magazynowy</span><br><a href="#/admin/magazyn/stany">Otwórz stany produktów</a>`;
  if(p.decyzja==="uzupelnij_lokalizacje")return `<span class="lvl lvl-ok">pobierz ze stanu</span><br><small class="warehouse-location-missing">📍 Lokalizację ustala magazyn — nie blokuje realizacji.</small>`;
  if(p.decyzja==="zamow_u_producenta")return `<span class="lvl lvl-blad">zamówić ${esc(p.brak)} szt.</span><br><small>Dostawca: ${esc(p.dostawca||"nieprzypisany")}</small>${p.dokumentyProducenta?.length?`<br><a href="#/admin/magazyn/plan">🧾 ${esc(p.dokumentyProducenta.map(x=>x.numer).join(", "))}</a>`:`<br><button class="btn ghost allegro-line-procurement" type="button" onclick="allegroUtworzZamowienieProducenta(${jsArg(z.id||z.nr)})">🧾 Dodaj brak do Planu</button>`}`;
  return `<span class="lvl lvl-ok">pobierz ze stanu</span>${p.lokalizacja?`<br><b>📍 ${esc(nazwaLokalizacjiMagazynu(p.lokalizacja))}</b>`:`<br><small class="warehouse-location-missing">📍 Towar jest zarezerwowany. Magazyn ustali lokalizację.</small><br><a href="#/admin/magazyn/stany">Zadanie magazynu</a>`}`;
}
function allegroMapowaniePozycjiHTML(p={}){
  const suggestion=(p.candidates||[])[0];
  return `<div class="allegro-line-mapping ${p.produkt?"is-linked":"needs-link"}">${p.produkt?`<span class="lvl lvl-ok">połączono • ${esc(p.confidence||100)}%</span><b>${esc(p.produkt.nazwa||`Produkt ${p.produkt.id}`)}</b><small>ID ${esc(p.produkt.id)} • ${esc(p.match||"mapowanie")}</small>`:`<span class="lvl lvl-blad">brak powiązania</span>${suggestion?`<small>Najlepsza sugestia: <b>${esc(suggestion.produkt.nazwa)}</b> (${esc(suggestion.score)}%)</small>`:`<small>Brak jednoznacznej sugestii po identyfikatorach.</small>`}`}<button class="btn ${p.produkt?"ghost":""}" type="button" onclick="allegroOtworzMapowaniePozycji(${jsArg(p.offerId)},${jsArg(p.nazwa)})">${p.produkt?"Zmień powiązanie":"🧩 Połącz produkt"}</button></div>`;
}
function allegroZlecenieHTML(z){
  const meta=allegroStatusKolejkiMeta(z), s=allegroStatusKolejki(z);
  const archiwalne=!!z.archivedAt;
  const etap=allegroEtapMagazynuMeta(z), analiza=allegroAnalizaMagazynowaZamowienia(z);
  const items=Array.isArray(z.lineItems)&&z.lineItems.length?z.lineItems:[];
  const sztuk=items.reduce((sum,it)=>sum+Math.max(1,Number(it.quantity)||1),0);
  const idEtap=`allegro-etap-${z.id}`;
  const zaznaczone=zaznaczoneAllegroZamowienia.has(String(z.id));
  const lokalnieDone=allegroZamowienieZrealizowaneLokalnie(z);
  return `<article class="allegro-order-card ${zaznaczone?"is-selected ":""}${allegroZamowienieAktywneLokalnie(z)?"is-active":"is-closed"}">
    <header class="allegro-order-head">
      <div class="allegro-order-title">${archiwalne?`<span class="allegro-order-select" title="Archiwum tylko do odczytu">🗄️</span>`:`<label class="allegro-order-select" title="Zaznaczenie tylko do operacji grupowych"><input type="checkbox" ${zaznaczone?"checked":""} onchange="allegroPrzelaczZaznaczenieZamowienia(${jsArg(z.id)},this.checked)"></label>`}<span class="allegro-order-ico">📦</span><div><b>Zlecenie ${esc(z.id||z.nr||"—")}</b><small>${esc(allegroDataTxt(z.createdAt||z.firstFetchedAt))} • ${items.length} pozycji / ${sztuk} szt. • ${esc(z.total||"—")}</small></div></div>
      <div class="allegro-order-state"><span class="lvl ${meta.klasa}">Allegro: ${esc(meta.label)}</span><span class="lvl ${etap.klasa}">Magazyn: ${esc(etap.label)}</span>${archiwalne?`<span class="lvl lvl-info">Archiwum ${esc(z.archiveMonth||"")}</span>`:""}<small>Ostatnia synchronizacja: ${esc(allegroDataTxt(z.rawUpdatedAt||z.lastSeenAt))}</small></div>
    </header>
    <div class="allegro-order-info">
      <div><b>👤 ${esc(z.buyerName||z.buyerLogin||z.email||"Klient Allegro")}</b><small>${esc(z.email||"—")} ${z.phone?`• ${esc(z.phone)}`:""}</small></div>
      <div><b>🚚 ${esc(z.deliveryMethod||"Dostawa")}</b><small>${esc(z.deliveryPoint||z.deliveryAddress||"—")}</small></div>
      <div><b>💳 ${esc(z.paymentStatus||"Płatność")}</b><small>${esc(z.total||"—")}</small></div>
    </div>
    ${allegroPrzeplywZakupowyHTML(z)}
    <details class="allegro-order-products" open>
      <summary>Produkty w zleceniu (${items.length})</summary>
      <div class="warehouse-worktable-wrap"><table class="log-table allegro-order-products-table"><tr><th>Zdjęcie</th><th>Pozycja z Allegro</th><th>Produkt sklepu i dopasowanie</th><th>Ilość</th><th>Stan i rezerwacje</th><th>Lokalizacja magazynowa</th><th>Decyzja agenta</th></tr>
        ${analiza.pozycje.map(p=>{const d=allegroDanePozycjiZamowienia({offerId:p.offerId,offerName:p.nazwa,quantity:p.ilosc});return `<tr class="${p.decyzja!=="kompletuj"?"row-alert":""}"><td>${d.zdjecie?`<img class="allegro-order-thumb" src="${esc(d.zdjecie)}" alt="" loading="lazy">`:`<span class="allegro-order-thumb fallback">🎲</span>`}</td><td><b>${esc(p.nazwa||"—")}</b><small>Oferta: ${esc(p.offerId||"—")} • kod: ${esc(p.externalId||"—")} • EAN: ${esc(p.ean||"—")}</small></td><td>${allegroMapowaniePozycjiHTML(p)}</td><td><b>${esc(p.ilosc)}</b> szt.</td><td>${allegroStanPozycjiHTML(p)}</td><td>${allegroLokalizacjaPozycjiHTML(p)}</td><td>${allegroDecyzjaAgentaHTML(p,z)}</td></tr>`;}).join("")||`<tr><td colspan="7">Brak pozycji w zleceniu.</td></tr>`}
      </table></div>
    </details>
    <footer class="allegro-order-actions">
      ${archiwalne?`<span class="lvl lvl-info">🗄️ Zapis historyczny — bez operacji magazynowych</span>`:!allegroZamowienieZamknieteWAllegro(z)?`<span class="${z.supplierProcurement?.status==="dostawa_przyjeta"||analiza.gotowe?"lvl lvl-ok":"lvl lvl-blad"}">${z.supplierProcurement?.status==="dostawa_przyjeta"?`✅ Dostawa przyjęta • ${esc(z.supplierProcurement.receivedQuantity||0)}/${esc(z.supplierProcurement.orderedQuantity||0)} szt. • oczekuje na wysyłkę`:analiza.gotowe?"✅ Stan pokrywa zamówienie — można kompletować":`⚠️ Braki ${analiza.braki} szt. • nierozpoznane ${analiza.nierozpoznane} • bez stanu ${analiza.bezStanu}`}</span>${analiza.bezLokalizacji?`<span class="lvl lvl-info">📍 Magazyn ma ustalić ${esc(analiza.bezLokalizacji)} ${analiza.bezLokalizacji===1?"lokalizację":"lokalizacje"}; realizacja pozostaje aktywna.</span>`:""}${z.supplierProcurement?`<span class="lvl ${z.supplierProcurement.taskStatus==="zrealizowane"?"lvl-ok":"lvl-info"}">Dokument producenta: ${esc(z.supplierProcurement.status||"do realizacji")} • ${esc(z.supplierProcurement.receivedQuantity||0)}/${esc(z.supplierProcurement.orderedQuantity||0)} szt.</span>`:""}${analiza.braki>0&&z.supplierProcurement?.status!=="dostawa_przyjeta"?`<button class="btn" onclick="allegroUtworzZamowienieProducenta(${jsArg(z.id)})">🧾 ${z.supplierProcurement?"Aktualizuj":"Utwórz"} zamówienie producenta</button>`:""}<a class="btn ghost" href="#/admin/magazyn/plan">Plan producentów</a><select id="${esc(idEtap)}" aria-label="Etap magazynu">${[["do_sprawdzenia","Do sprawdzenia"],["braki","Braki — zamówić"],["oczekuje_na_dostawe","Zamówione — oczekuje na dostawę"],["kompletacja","Oczekuje na wysyłkę"],["spakowane","Spakowane"],["zrealizowane","✅ Zrealizowane lokalnie"]].map(([id,label])=>`<option value="${id}" ${allegroEtapMagazynu(z)===id?"selected":""}>${label}</option>`).join("")}</select><button class="btn ghost" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},document.getElementById(${jsArg(idEtap)}).value)">Zapisz etap</button>${!lokalnieDone?`<button class="btn" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},'zrealizowane')">✅ Oznacz jako zrealizowane</button>`:`<button class="btn ghost" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},'do_sprawdzenia')">↩️ Przywróć do obsługi</button>`}`:""}
    </footer>
  </article>`;
}
function allegroZaznaczOfertyMapowania(ids=[],checked=true){ids.forEach(id=>checked?zaznaczoneMapowaniaAllegro.add(String(id)):zaznaczoneMapowaniaAllegro.delete(String(id)));renderuj();}
async function allegroZastosujPewneSugestieMapowania(ids=null){
  if(allegroMapowanieMasowe.busy)return;const set=ids?new Set(ids.map(String)):null,analizy=(allegroOferty||[]).filter(o=>!set||set.has(String(o.id))).map(allegroAnalizaMapowaniaOferty),items=analizy.map(a=>({a,target:a.correction||(!a.mapped?a.suggestion:null)})).filter(x=>x.target?.valid&&!x.target.occupied.length).map(x=>({offerId:String(x.a.oferta.id),productId:String(x.target.produkt.id)}));
  if(!items.length){toast("Brak jednoznacznych, bezkolizyjnych sugestii do zapisania");return;}
  allegroMapowanieMasowe={busy:true,total:items.length,mapped:0,skipped:0,error:""};renderuj();
  try{const d=await chmura("allegro-map-offers-batch",{method:"POST",body:{items},timeout:120000});allegroMapowania=d.mappings||allegroMapowania;allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;allegroMapowanieMasowe={busy:false,total:items.length,mapped:d.mapped||0,skipped:d.skipped||0,error:""};zaznaczoneMapowaniaAllegro.clear();await chmuraWczytajStan().catch(()=>{});allegroZapiszCache();toast(`✅ Bezpieczne mapowanie: połączono ${d.mapped||0}${d.skipped?` • pominięto ${d.skipped}`:""}`);renderuj();}catch(e){allegroMapowanieMasowe={...allegroMapowanieMasowe,busy:false,error:e.message||String(e)};toast("⚠️ Mapowanie grupowe: "+(e.message||e));renderuj();}
}
async function allegroAutomapujOferty(){return allegroZastosujPewneSugestieMapowania();}
function allegroStatusMapowaniaMeta(status){return ({konflikt:{label:"Błędne połączenie",cls:"bad",icon:"⚠️"},sugestia:{label:"Pewna sugestia",cls:"suggest",icon:"✨"},niepodpiete:{label:"Niepodpięta",cls:"empty",icon:"○"},sprawdz:{label:"Do sprawdzenia",cls:"review",icon:"?"},poprawne:{label:"Połączenie poprawne",cls:"ok",icon:"✓"},kanoniczne:{label:"Oferta główna",cls:"canonical",icon:"🔒"},duplikat:{label:"Druga oferta",cls:"duplicate",icon:"⧉"},synchronizacja:{label:"Agent aktualizuje",cls:"syncing",icon:"↻"}})[status]||{label:status,cls:"review",icon:"?"};}
function allegroDaneKodyHTML(label,obj={},type="offer"){
  const ean=type==="offer"?(obj.ean||obj.gtin):(obj.gtin||obj.ean),external=type==="offer"?obj.externalId:(obj.externalId||obj.sku),code=type==="offer"?(obj.manufacturerCode||obj.producerCode):(obj.kodProducenta||obj.mpn);
  return `<div class="allegro-map-identifiers"><small>${esc(label)}</small><span><em>EAN</em><b>${esc(ean||"—")}</b></span><span><em>EXTERNAL_ID / SKU</em><b>${esc(external||"—")}</b></span><span><em>Kod producenta</em><b>${esc(code||"—")}</b></span></div>`;
}
function allegroProduktMapowanieMiniHTML(p={},evaluation=null,title="Produkt sklepu"){
  return `<div class="allegro-map-product-mini">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><small>${esc(title)}</small><b>${esc(p.nazwa||"Produkt")}</b><p>ID ${esc(p.id)} • ${esc(p.kategoria||"bez kategorii")}</p>${evaluation?`<div class="allegro-evidence-chips">${(evaluation.evidence||[]).map(x=>`<span class="ok">✓ ${esc(x)}</span>`).join("")}${(evaluation.warnings||[]).map(x=>`<span class="warn">i ${esc(x)}</span>`).join("")}${(evaluation.conflicts||[]).map(x=>`<span class="bad">! ${esc(x)}</span>`).join("")}</div>`:""}</div></div>`;
}
function allegroOfertyTabelaHTML(){
  const q=String(szukajAllegroOfert||"").toLowerCase().trim(),audyt=allegroAudytDuplikatow(),all=(Array.isArray(allegroOferty)?allegroOferty:[]).map(allegroAnalizaMapowaniaOferty),operational=all.filter(a=>allegroOferteMoznaWycofac(a.oferta)),counts={wszystkie:all.length,aktywne:operational.length,sprzedaz:0,szkice:0,zakonczone:0,poprawne:0,kanoniczne:0,duplikat:0,synchronizacja:0,konflikt:0,sugestia:0,niepodpiete:0,sprawdz:0,problemy:0,duplikaty:audyt.oferty};
  all.forEach(a=>{const pub=allegroStatusOfertyMeta(a.oferta);counts[pub.group]=(counts[pub.group]||0)+1;if(pub.withdrawable){counts[a.status]=(counts[a.status]||0)+1;if(!["poprawne","kanoniczne","synchronizacja"].includes(a.status))counts.problemy++;}});
  let rows=all.filter(a=>{const pub=allegroStatusOfertyMeta(a.oferta);if(filtrStatusuAllegroOfert==="aktywne"&&!pub.withdrawable)return false;if(!["wszystkie","aktywne"].includes(filtrStatusuAllegroOfert)&&pub.group!==filtrStatusuAllegroOfert)return false;if(filtrAllegroOfert==="problemy"&&(["poprawne","kanoniczne","synchronizacja"].includes(a.status)||!pub.withdrawable))return false;if(filtrAllegroOfert==="duplikaty"&&!audyt.offerIds.has(String(a.oferta.id)))return false;if(!["wszystkie","problemy","duplikaty"].includes(filtrAllegroOfert)&&a.status!==filtrAllegroOfert)return false;const o=a.oferta,p=a.mapped,s=a.suggestion?.produkt,txt=`${o.id} ${o.name||""} ${o.externalId||""} ${o.ean||o.gtin||""} ${o.manufacturerCode||o.producerCode||""} ${p?.id||""} ${p?.nazwa||""} ${p?.sku||p?.externalId||""} ${s?.nazwa||""}`.toLowerCase();return !q||txt.includes(q);});
  const priority={konflikt:0,duplikat:1,sugestia:2,niepodpiete:3,sprawdz:4,synchronizacja:5,kanoniczne:6,poprawne:7};rows.sort((a,b)=>sortAllegroOfert==="nazwa"?String(a.oferta.name||"").localeCompare(String(b.oferta.name||""),"pl"):sortAllegroOfert==="status"?String(a.oferta.status||"").localeCompare(String(b.oferta.status||"")):(priority[a.status]??9)-(priority[b.status]??9)||Number(b.suggestion?.score||b.current?.score||0)-Number(a.suggestion?.score||a.current?.score||0));const visible=rows.slice(0,allegroLimitWidokuOfert),selected=[...zaznaczoneMapowaniaAllegro],withdrawSelected=selected.filter(id=>allegroOferteMoznaWycofac(allegroOfertaPoId(id))),safeVisible=visible.filter(a=>(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length&&allegroOferteMoznaWycofac(a.oferta)),safeSelected=all.filter(a=>zaznaczoneMapowaniaAllegro.has(String(a.oferta.id))&&(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length&&allegroOferteMoznaWycofac(a.oferta));
  return `<div class="panel allegro-section-panel allegro-mapping-workspace"><div class="order-section-head allegro-offers-head"><div><span class="order-pro-label">Kanoniczne powiązania ofert</span><h2 style="margin-top:.15rem">🏷️ Oferty Allegro ↔ produkty sklepu</h2><p class="order-detail-lead">Jedna oferta główna jest trwale przypisana do produktu. Sklep jest źródłem aktualnej nazwy, ceny, opisów, zdjęć i parametrów; Agent kontroluje oraz synchronizuje Allegro co 15 minut bez ponownego ręcznego łączenia.</p></div><div class="diag-actions"><button class="btn" onclick="allegroUruchomAutomatyczneMapowanie(false)" ${allegroAutoMapowanieSerwera.busy?"disabled":""}>${allegroAutoMapowanieSerwera.busy?"⏳ Kontroluję…":"🤖 Sprawdź nowe oferty"}</button><a class="btn ghost" href="#/admin/allegro/wystawianie">🟠 Wystaw produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia</a></div></div><div class="allegro-offer-inventory-strip">${[["aktywne","🏷️","Aktywne i szkice",counts.aktywne],["sprzedaz","●","W sprzedaży",counts.sprzedaz],["szkice","○","Szkice / nieaktywne",counts.szkice],["zakonczone","■","Zakończone",counts.zakonczone],["wszystkie","≡","Cały rejestr",counts.wszystkie]].map(([id,ico,label,n])=>`<button class="${filtrStatusuAllegroOfert===id?"active":""}" onclick="filtrStatusuAllegroOfert=${jsArg(id)};renderuj()"><span>${ico}</span><b>${n}</b><small>${label}</small></button>`).join("")}</div><div class="allegro-map-stats">${[["🔒","Oferty główne",counts.kanoniczne,"kanoniczne"],["↻","Agent aktualizuje",counts.synchronizacja,"synchronizacja"],["⧉","Drugie oferty",counts.duplikat,"duplikat"],["⚠️","Konflikty",counts.konflikt,"konflikt"],["✨","Pewne sugestie",counts.sugestia,"sugestia"],["○","Niepodpięte",counts.niepodpiete,"niepodpiete"]].map(([ico,label,count,id])=>`<button class="${filtrAllegroOfert===id?"active":""}" onclick="filtrAllegroOfert=${jsArg(id)};renderuj()"><span>${ico}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div><div class="orders-toolbar allegro-toolbar allegro-offers-toolbar"><input placeholder="Szukaj: oferta, produkt, ID, EAN, SKU, EXTERNAL_ID, kod producenta…" value="${esc(szukajAllegroOfert)}" oninput="szukajAllegroOfert=this.value.toLowerCase();zaplanujRenderPoWpisaniu()"><select aria-label="Status publikacji" onchange="filtrStatusuAllegroOfert=this.value;renderuj()">${[["aktywne",`Aktywne i szkice (${counts.aktywne})`],["sprzedaz",`W sprzedaży (${counts.sprzedaz})`],["szkice",`Szkice / nieaktywne (${counts.szkice})`],["zakonczone",`Zakończone (${counts.zakonczone})`],["wszystkie",`Cały rejestr (${counts.wszystkie})`]].map(([id,label])=>`<option value="${id}" ${filtrStatusuAllegroOfert===id?"selected":""}>${label}</option>`).join("")}</select><select aria-label="Stan powiązania" onchange="filtrAllegroOfert=this.value;renderuj()">${[["problemy",`Wymagające pracy (${counts.problemy})`],["wszystkie","Każdy stan powiązania"],["kanoniczne",`Oferty główne (${counts.kanoniczne})`],["synchronizacja",`Agent aktualizuje (${counts.synchronizacja})`],["duplikat",`Drugie oferty (${counts.duplikat})`],["konflikt",`Konflikty (${counts.konflikt})`],["sugestia",`Pewne sugestie (${counts.sugestia})`],["niepodpiete",`Niepodpięte (${counts.niepodpiete})`],["sprawdz",`Do sprawdzenia (${counts.sprawdz})`],["poprawne",`Starsze poprawne (${counts.poprawne})`],["duplikaty",`Centrum duplikatów (${counts.duplikaty})`]].map(([id,label])=>`<option value="${id}" ${filtrAllegroOfert===id?"selected":""}>${label}</option>`).join("")}</select><select aria-label="Sortowanie ofert" onchange="sortAllegroOfert=this.value;renderuj()"><option value="priorytet" ${sortAllegroOfert==="priorytet"?"selected":""}>Najpierw decyzje</option><option value="nazwa" ${sortAllegroOfert==="nazwa"?"selected":""}>Nazwa A–Z</option><option value="status" ${sortAllegroOfert==="status"?"selected":""}>Status Allegro</option></select><label class="allegro-view-limit">Pokaż <select onchange="allegroLimitWidokuOfert=Number(this.value)||100;renderuj()">${[50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWidokuOfert===n?"selected":""}>${n}</option>`).join("")}</select></label></div><div class="allegro-map-bulk allegro-offer-bulk"><div><b>Operacje na ofertach</b><small>${selected.length} zaznaczonych • ${withdrawSelected.length} można zakończyć • ${safeSelected.length} nowych, pewnych sugestii</small></div><button class="btn ghost" onclick='allegroZaznaczOfertyMapowania(${JSON.stringify(visible.map(a=>String(a.oferta.id)))},true)'>☑️ Zaznacz widoczne (${visible.length})</button>${selected.length?`<button class="btn ghost" onclick="zaznaczoneMapowaniaAllegro.clear();renderuj()">Odznacz wszystko</button>`:""}<button class="btn ghost" ${allegroMapowanieMasowe.busy||!(selected.length?safeSelected.length:safeVisible.length)?"disabled":""} onclick='allegroZastosujPewneSugestieMapowania(${selected.length?JSON.stringify(selected):JSON.stringify(safeVisible.map(a=>String(a.oferta.id)))})'>${allegroMapowanieMasowe.busy?"⏳ Zapisuję…":`Połącz nowe ${selected.length?"zaznaczone":"z widoku"}`}</button><button class="btn danger" ${withdrawSelected.length&&!allegroWycofywanieOfert.busy?"":"disabled"} onclick='allegroPrzygotujWycofanieOfert(${JSON.stringify(withdrawSelected)})'>Zakończ zaznaczone (${withdrawSelected.length})</button></div>${allegroWycofaniePanelHTML()}${allegroAutoMapowanieSerwera.error?`<div class="backend-note allegro-mapping-error"><b>Błąd automatu:</b> ${esc(allegroAutoMapowanieSerwera.error)}</div>`:""}${allegroMapowanieMasowe.error?`<div class="backend-note allegro-mapping-error"><b>Błąd operacji:</b> ${esc(allegroMapowanieMasowe.error)}</div>`:""}${audyt.produkty&&filtrAllegroOfert==="duplikaty"?allegroCentrumDuplikatowHTML(audyt):""}<div class="allegro-results-summary"><b>Znaleziono ${rows.length}</b><span>Pokazano ${Math.min(visible.length,rows.length)} • filtr publikacji: ${esc(filtrStatusuAllegroOfert)} • powiązanie: ${esc(filtrAllegroOfert)}</span></div><div class="allegro-offer-map-list">${visible.map(allegroOfertaMapowanieCardHTML).join("")||`<div class="backend-note">Brak ofert pasujących do aktywnych filtrów.</div>`}</div>${rows.length>visible.length?`<div class="backend-note">Pokazano ${visible.length} z ${rows.length}. Zwiększ limit albo zawęź wyszukiwanie.</div>`:""}</div>`;
}
function allegroBrakiProduktuDoWystawienia(p){
  const braki=[];
  if(!p.nazwa) braki.push("nazwa");
  if(!Number(p.cena)) braki.push("cena");
  if(!(p.gtin||p.ean)) braki.push("EAN");
  if(!(p.kodProducenta||p.mpn||p.externalId||p.sku)) braki.push("kod producenta/SKU");
  if(!(p.producent||p.marka)) braki.push("producent");
  if(!(p.zdjecie||(p.zdjecia||[]).length)) braki.push("zdjęcie");
  if(!p.allegroCategoryId) braki.push("ID kategorii Allegro");
  return braki;
}
function allegroStanOfertyProduktu(){
  const n=Number(allegroStan.offerSettings?.defaultStock??5);
  return Number.isInteger(n)&&n>0?Math.min(99999,n):5;
}
function allegroRozniceOfertyProduktu(p={},o=null){
  if(!o)return ["brak oferty"];
  const roznice=[];
  if(allegroKluczPorownania(p.nazwa)!==allegroKluczPorownania(o.name))roznice.push("nazwa");
  if(Math.abs(kwotaNum(p.cenaAllegro||p.cena)-kwotaNum(o.price))>.009)roznice.push("cena Allegro");
  const stan=allegroStanOfertyProduktu(p);if(Number(o.stockAvailable)!==Number(stan))roznice.push("stan Allegro");
  if((p.zdjecie||(p.zdjecia||[]).length)&&!(o.mainImage||(o.images||[]).length))roznice.push("zdjęcia");
  if((p.opis||p.opisKrotki)&&!o.descriptionText)roznice.push("opis");
  if((p.producent||p.marka)&&allegroKluczPorownania(p.producent||p.marka)!==allegroKluczPorownania(o.brand||""))roznice.push("producent");
  if(p.allegroProductId&&String(o.productId||"")!==String(p.allegroProductId))roznice.push("produkt katalogowy");
  return [...new Set(roznice)];
}
function allegroAktywneZadaniaAgentaOfert(){return (agentAIAllegroZadania||[]).filter(x=>!["wykonane","anulowane"].includes(String(x.status||"").toLowerCase()));}
const ALLEGRO_PROCEDURA_AGENTA_OFERT=[
  "Sprawdź ID oferty i zapisane mapowanie, następnie UUID katalogu, external.id/SKU, EAN, kod producenta i identyczną nazwę.",
  "Jeżeli oferta istnieje — połącz ją z produktem i aktualizuj; nigdy nie twórz duplikatu.",
  "Dobierz produkt katalogowy najpierw po EAN, potem po MPN; nazwę wykorzystuj tylko przy wysokiej zgodności.",
  "Uzupełnij producenta, markę, EAN, MPN, kategorię, UUID, parametry oraz zdjęcia z Katalogu Allegro, jeśli źródło sklepu nie działa.",
  "Nową ofertę zapisuj jako nieaktywną ze stanem magazynowym produktu; brak stanu oznacza 0.",
  "Po sukcesie zapisz potrójne powiązanie produkt sklepu ↔ produkt katalogowy ↔ oferta, odśwież dane i zamknij zadanie Agenta.",
  "Gdy nadal brakuje danych, nie zgaduj — zapisz konkretne braki i błąd API jako jedno zadanie do ponowienia."
];
function allegroProceduraAgentaOfertHTML(){
  return `<details class="backend-note allegro-info-bottom"><summary><b>🤖 Stała procedura Agenta przy dodawaniu oferty</b></summary><ol>${ALLEGRO_PROCEDURA_AGENTA_OFERT.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></details>`;
}
async function allegroAgentUzupelnijZadanieOferty(taskId){
  const task=(agentAIAllegroZadania||[]).find(x=>String(x.id)===String(taskId));if(!task){toast("Nie znaleziono zadania Agenta AI");return;}
  const p=pobierzProduktAdmin(task.productId);if(!p){toast("Produkt z zadania nie istnieje");return;}
  const s=task.suggestions||{},next={...(produktyEdytowane[p.id]||{})};
  for(const key of ["producent","marka","gtin","ean","kodProducenta","mpn","zdjecie","allegroCategoryId","allegroProductId"]){
    if(s[key]&&!p[key])next[key]=String(s[key]);
  }
  if(Array.isArray(s.zdjecia)&&s.zdjecia.length&&!(p.zdjecia||[]).length)next.zdjecia=s.zdjecia.slice(0,15);
  if(Array.isArray(s.allegroParameters)&&s.allegroParameters.length&&!Array.isArray(p.allegroParameters))next.allegroParameters=s.allegroParameters;
  produktyEdytowane[p.id]=next;zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();
  toast("Agent uzupełnił dostępne dane i ponownie sprawdza szkic…");
  await allegroPrzygotujSzkicProduktZListy(p.id);
}
function allegroZadaniaAgentaOfertHTML(){
  const tasks=allegroAktywneZadaniaAgentaOfert();if(!tasks.length)return `<div class="duplicate-audit-ok"><b>✅ Agent AI:</b> brak otwartych zadań dotyczących ofert Allegro.</div>`;
  return `<section class="allegro-agent-tasks"><div class="order-section-head"><div><b>🤖 Zadania przekazane Agentowi AI</b><small>Agent najpierw szuka istniejącej oferty, blokuje duplikat, uzupełnia dane katalogowe i ponawia operację. Zgadywanie brakujących danych jest zabronione.</small></div><a class="btn ghost" href="#/admin/agent-ai">Otwórz Agenta AI</a></div><div class="allegro-agent-task-list">${tasks.slice(0,30).map(t=>`<article><div><b>${esc(t.productName||"Produkt")}</b><small>ID ${esc(t.productId)} • ${esc(t.status||"oczekuje")} • próby: ${esc(t.attempts||1)}</small><p>${[...(t.missing||[]),...(t.errors||[]).map(e=>e.message||e.code)].map(esc).join(" • ")||"Weryfikacja danych"}</p></div><div class="warehouse-worktable-actions"><button class="btn" onclick="allegroAgentUzupelnijZadanieOferty(${jsArg(t.id)})">🤖 Uzupełnij i sprawdź</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(t.productId)}">✏️ Edytuj produkt</a></div></article>`).join("")}</div></section>`;
}
async function allegroPrzygotujSzkicProduktZListy(id){
  const p=pobierzProduktAdmin(id);
  if(!p){ toast("Nie znaleziono produktu"); return; }
  try{
    const d=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:60000});
    allegroZapiszAutoUzupelnienia(p,d);
    const cat=d.categorySuggestion?.selected;
    const saved=cat?.id?allegroZapiszKategorieProduktu(p.id,cat.id):false;
    toast(d.ready?`🟠 Szkic Allegro gotowy technicznie${cat?` — kategoria: ${cat.name}`:""}`:`🟠 Braki: ${((d.missing||[]).join(", ")||"brak")}${cat?` • dobrano kategorię: ${cat.name}`:""}`);
    if(saved) renderuj();
  }catch(e){ allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProduktZListy(id){
  const p=pobierzProduktAdmin(id);
  if(!p){ toast("Nie znaleziono produktu"); return; }
  try{
    const publicationAction=allegroTrybPublikacji();
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(p,d);
    allegroZapiszAutoUzupelnienia(p,d);
    toast(d.operation?.completed===false?`🟠 Oferta ${d.offer?.id||""} jest jeszcze przetwarzana przez Allegro`:d.mode==="updated"?`🟠 Zaktualizowano ofertę ${d.offer?.id||""} bez tworzenia duplikatu`:`🟠 Utworzono nową ofertę ${d.offer?.id||""}`);
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||"";
      produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})};
      zapiszLS("artway_produkty_edytowane",produktyEdytowane);
      allegroZastosujWynikWystawienia(p,d);
      await chmuraWczytajStan().catch(()=>{});
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      renderuj();
    }
  }catch(e){ allegroOstatniBladWystawienia=e;allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Wystawianie Allegro: "+(e.message||e)+" • zadanie przekazano Agentowi AI");renderuj(); }
}
async function allegroAktywujProduktZListy(id){
  const p=pobierzProduktAdmin(id);if(!p){toast("Nie znaleziono produktu");return;}
  const qty=allegroStanOfertyProduktu(p);
  try{
    toast(`Aktywuję ofertę ${p.nazwa} ze stanem Allegro ${qty} szt.…`);
    const product={...p,allegroStock:qty};
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product,options:{stock:qty,publicationAction:"activate",publishNow:true}},timeout:120000});
    allegroOstatniBladWystawienia=null;allegroZapiszWynikOperacji(product,d);allegroZapiszAutoUzupelnienia(product,d);allegroZastosujWynikWystawienia(product,d);
    const categoryId=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||p.allegroCategoryId||"";
    const productId=d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"";
    produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroStock:qty,allegroOfferId:String(d.offer?.id||p.allegroOfferId||""),...(categoryId?{allegroCategoryId:String(categoryId)}:{}),...(productId?{allegroProductId:String(productId)}:{})};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
    await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});zbudujProdukty();
    toast(`✅ Oferta ${d.offer?.id||""} aktywna • stan Allegro ${qty} szt. • magazyn bez zmian`);renderuj();
  }catch(e){allegroOstatniBladWystawienia=e;allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Aktywacja Allegro: "+(e.message||e));renderuj();}
}
async function allegroAktualizujZaznaczoneOfertyDanymiSklepu(){
  const ids=[...zaznaczoneAllegroOferty].slice(0,100),produkty=[...new Map(ids.map(id=>allegroProduktDlaOferty(id)).filter(Boolean).map(p=>[String(p.id),p])).values()];
  if(!produkty.length){toast("Zaznacz powiązane oferty, które mają zostać zaktualizowane danymi sklepu");return;}
  let ok=0,bledy=0;toast(`Aktualizuję ${produkty.length} ofert nowszymi danymi sklepu…`);
  for(const p of produkty){try{const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publicationAction:"keep"}},timeout:120000});allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);ok++;}catch(e){bledy++;allegroOstatniBladWystawienia=e;}}
  zaznaczoneAllegroOferty.clear();await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});
  toast(`Synchronizacja ofert: zaktualizowano ${ok}${bledy?` • do Agenta AI / błędy: ${bledy}`:""}`);renderuj();
}
function allegroPrzelaczOferteDoCeny(id,checked){const set=location.hash.startsWith("#/admin/allegro/oferty")?zaznaczoneMapowaniaAllegro:zaznaczoneAllegroOferty;checked?set.add(String(id)):set.delete(String(id));renderuj();}
let allegroWystawianieWynikiIds=[],allegroWystawianieStronaIds=[];
function allegroZaznaczOfertyProduktow(ids=[],checked=true){
  ids.forEach(raw=>{const id=String(raw),p=pobierzProduktAdmin(raw),o=p?allegroOfertaDlaProduktuSklepu(p):null;checked?zaznaczoneAllegroProduktyKatalogu.add(id):zaznaczoneAllegroProduktyKatalogu.delete(id);if(o)checked?zaznaczoneAllegroOferty.add(String(o.id)):zaznaczoneAllegroOferty.delete(String(o.id));});renderuj();
}
function allegroPrzelaczProduktKatalogu(id,checked){allegroZaznaczOfertyProduktow([id],checked);}
function allegroZaznaczZakresWystawiania(zakres){allegroZaznaczOfertyProduktow(zakres==="strona"?allegroWystawianieStronaIds:allegroWystawianieWynikiIds,true);}
function allegroWyczyscZaznaczenieOfert(){zaznaczoneAllegroProduktyKatalogu.clear();zaznaczoneAllegroOferty.clear();renderuj();}
function allegroEksportujProduktyWystawiania(zakres="filtr"){
  let ids=allegroWystawianieWynikiIds;
  if(zakres==="zaznaczone")ids=[...zaznaczoneAllegroProduktyKatalogu];
  eksportujProduktyPoIdCSV(ids,zakres==="zaznaczone"?"allegro-produkty-zaznaczone.csv":"allegro-produkty-filtrowane.csv");
}
async function allegroZmienCenyZaznaczonychOfert(){
  const mode=String(document.getElementById("allegroPriceMode")?.value||"percent");
  const value=Number(String(document.getElementById("allegroPriceValue")?.value||"").replace(",","."));
  const ids=[...zaznaczoneAllegroOferty];
  if(!ids.length){ toast("Zaznacz oferty Allegro"); return; }
  if(!Number.isFinite(value)||value===0){ toast("Podaj prawidłową wartość zmiany ceny"); return; }
  try{
    const d=await chmura("allegro-offer-price-change",{method:"POST",body:{offerIds:ids,mode,value},timeout:30000});
    toast(`🟠 Zlecono zmianę cen ${d.offerCount||ids.length} ofert • komenda ${d.commandId}`);
    zaznaczoneAllegroOferty.clear();
    setTimeout(()=>allegroSynchronizujOferty(),2200);
  }catch(e){ toast("⚠️ Zmiana cen Allegro: "+(e.message||e)); }
}
function allegroWystawianiePanelHTML(){
  const q=String(szukajAllegroWystawiania||"").toLowerCase().trim();
  const wszystkie=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const counts={wszystkie:wszystkie.length,aktywne:0,szkice:0,brak:0,gotowe:0,braki:0,do_aktualizacji:0};
  wszystkie.forEach(p=>{const o=allegroOfertaDlaProduktuSklepu(p), br=allegroBrakiProduktuDoWystawienia(p);if(!o)counts.brak++;else if(String(o.status||"").toUpperCase()==="ACTIVE")counts.aktywne++;else counts.szkice++;if(br.length)counts.braki++;else counts.gotowe++;if(o&&allegroRozniceOfertyProduktu(p,o).length)counts.do_aktualizacji++;});
  const pasujace=wszystkie.filter(p=>{
    const o=allegroOfertaDlaProduktuSklepu(p), br=allegroBrakiProduktuDoWystawienia(p);
    if(filtrAllegroWystawiania==="aktywne"&&String(o?.status||"").toUpperCase()!=="ACTIVE")return false;
    if(filtrAllegroWystawiania==="szkice"&&(!o||String(o.status||"").toUpperCase()==="ACTIVE"))return false;
    if(filtrAllegroWystawiania==="brak"&&o)return false;
    if(filtrAllegroWystawiania==="gotowe"&&br.length)return false;
    if(filtrAllegroWystawiania==="braki"&&!br.length)return false;
    if(filtrAllegroWystawiania==="do_aktualizacji"&&(!o||!allegroRozniceOfertyProduktu(p,o).length))return false;
    const txt=`${p.id||""} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||""} ${p.ean||""} ${p.kodProducenta||""} ${p.mpn||""} ${p.producent||""} ${p.marka||""} ${p.allegroOfferId||""}`.toLowerCase();
    return !q||txt.includes(q);
  });
  const rows=pasujace.slice(0,allegroLimitWystawiania);
  allegroWystawianieWynikiIds=pasujace.map(p=>p.id);allegroWystawianieStronaIds=rows.map(p=>p.id);
  const selectedCount=[...zaznaczoneAllegroProduktyKatalogu].filter(id=>wszystkie.some(p=>String(p.id)===id)).length;
  const defaultsAudit=allegroStan.offerDefaultsAudit||{items:{},updated_at:null};
  const defaultsIssues=Object.values(defaultsAudit.items||{}).filter(x=>!x.stockUpdated||!x.republishUpdated);
  const defaultsErrors=[...new Set(defaultsIssues.map(x=>String(x.error||"").trim()).filter(Boolean))].slice(0,3);
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">🟠 Wystawianie produktów na Allegro</h2><p class="order-detail-lead">Tu przygotujesz szkic oferty Allegro z produktu sklepu. Najbezpieczniej twórz ofertę jako nieaktywną, sprawdź parametry w Allegro i dopiero ją aktywuj.</p></div>
      <a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a>
    </div>
    <div class="orders-status-strip">${[["wszystkie","Wszystkie"],["aktywne","Aktywne"],["szkice","Szkice / nieaktywne"],["brak","Brak na Allegro"],["do_aktualizacji","Do aktualizacji"],["gotowe","Gotowe"],["braki","Do uzupełnienia"]].map(([id,label])=>`<button class="${filtrAllegroWystawiania===id?"active":""}" onclick="filtrAllegroWystawiania=${jsArg(id)};renderuj()">${label} <b>${counts[id]||0}</b></button>`).join("")}</div>
    ${adminWyszukiwaniePanelHTML({id:"allegro-products",description:"Produkt sklepu, SKU, EAN, kod producenta, oferta Allegro i stan przygotowania.",results:pasujace.length,active:!!(szukajAllegroWystawiania||filtrAllegroWystawiania!=="wszystkie"),open:true,fields:`<div class="orders-toolbar allegro-toolbar admin-search-full">
      <input placeholder="Szukaj: produkt, SKU, EAN, kod producenta, oferta Allegro…" value="${esc(szukajAllegroWystawiania)}" oninput="szukajAllegroWystawiania=this.value.toLowerCase();zaplanujRenderPoWpisaniu()">
      <label>Pokaż <select onchange="allegroLimitWystawiania=Number(this.value)||250;renderuj()">${[50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWystawiania===n?"selected":""}>${n}</option>`).join("")}</select></label>
      <label>Po zapisie <select id="allegroPublicationAction"><option value="keep">nowa: szkic / istniejąca: bez zmiany statusu</option><option value="activate">aktywuj</option><option value="deactivate">dezaktywuj</option></select></label>
      ${szukajAllegroWystawiania?`<button class="btn ghost" onclick="szukajAllegroWystawiania='';renderuj()">Wyczyść</button>`:""}
    </div>`,actions:adminOperacjeWynikowHTML({id:"allegro-products",selected:selectedCount,pageCount:rows.length,resultCount:pasujace.length,selectPage:"allegroZaznaczZakresWystawiania('strona')",selectAll:"allegroZaznaczZakresWystawiania('filtr')",clear:"allegroWyczyscZaznaczenieOfert()",exportSelected:"allegroEksportujProduktyWystawiania('zaznaczone')",exportAll:"allegroEksportujProduktyWystawiania('filtr')"})})}
    ${allegroWynikOperacjiHTML()}
    <div class="allegro-bulk-toolbar"><div><b>Operacje na ofertach Allegro</b><small>${selectedCount} zaznaczonych • pełne dane synchronizują się automatycznie</small></div><select id="allegroPriceMode"><option value="percent">O procent (+/−)</option><option value="amount">O kwotę (+/−)</option><option value="fixed">Ustaw cenę docelową</option></select><input id="allegroPriceValue" inputmode="decimal" placeholder="np. 10 lub -5" style="max-width:150px"><button class="btn ghost" onclick="allegroZmienCenyZaznaczonychOfert()">💰 Zmień ceny</button></div>
    <div class="warehouse-worktable-wrap"><table class="log-table warehouse-worktable">
      <tr><th>Wybór</th><th>Produkt</th><th>Producent</th><th>EAN / kod prod.</th><th>Oferta Allegro</th><th>Zdjęcia</th><th>Stan synchronizacji</th><th>Akcje</th></tr>
      ${rows.map(p=>{
        const braki=allegroBrakiProduktuDoWystawienia(p);
        const oferta=allegroOfertaDlaProduktuSklepu(p);
        const roznice=oferta?allegroRozniceOfertyProduktu(p,oferta):[];
        return `<tr class="${braki.length||roznice.length?"row-alert":""}">
          <td><input type="checkbox" ${zaznaczoneAllegroProduktyKatalogu.has(String(p.id))?"checked":""} onchange="allegroPrzelaczProduktKatalogu(${jsArg(p.id)},this.checked)"></td>
          <td><b>${esc(p.nazwa)}</b><br><small>ID: ${esc(p.id)}${p.sku?` • SKU: ${esc(p.sku)}`:""}</small></td>
          <td><b>${esc(p.producent||p.marka||"—")}</b><br><small>${p.marka&&p.producent!==p.marka?`marka: ${esc(p.marka)}`:""}</small></td>
          <td><b>${esc(p.gtin||p.ean||"—")}</b><br><small>${esc(p.kodProducenta||p.mpn||p.externalId||"—")}</small></td>
          <td>${allegroStatusProduktuHTML(p)}<br><small>${oferta?`${esc(oferta.priceText||"—")} • stan ${esc(oferta.stockAvailable??"—")}`:`Kategoria: ${esc(p.allegroCategoryId||"—")}`}</small></td>
          <td>${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:"—"}<br><small>${(p.zdjecia||[]).length+(p.zdjecie?1:0)} zdj.</small></td>
          <td>${braki.length?braki.map(b=>`<span class="lvl lvl-ostrzezenie">${esc(b)}</span>`).join(" "):roznice.length?`<span class="lvl lvl-info">nowsze w sklepie: ${esc(roznice.join(", "))}</span>`:`<span class="lvl lvl-ok">zsynchronizowane</span>`}</td>
          <td><div class="warehouse-worktable-actions">
            <a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj dane</a>
            <button class="btn ghost" onclick="allegroPrzygotujSzkicProduktZListy(${jsArg(p.id)})">🧾 Sprawdź szkic</button>
            <button class="btn" onclick="allegroWystawProduktZListy(${jsArg(p.id)})">${oferta?"🤖 Agent: aktualizuj ofertę":"🤖 Agent: dodaj szkic"}</button>
            ${oferta&&String(oferta.status||"").toUpperCase()!=="ACTIVE"?`<div class="allegro-activate-control"><b>${allegroStanOfertyProduktu()} szt.</b><button class="btn" onclick="allegroAktywujProduktZListy(${jsArg(p.id)})">🚀 Aktywuj</button><small>Domyślny stan oferty Allegro: ${allegroStanOfertyProduktu()} szt. • automatyczne wznawianie włączone • magazyn pozostaje ${esc(stanMagazynuId(p.id))} szt.</small></div>`:""}
          </div></td>
        </tr>`;
      }).join("") || `<tr><td colspan="8">Brak produktów w tym filtrze.</td></tr>`}
    </table></div>
    ${pasujace.length>rows.length?`<p class="order-detail-lead">Pokazano ${rows.length} z ${pasujace.length} produktów. Zwiększ limit widoku.</p>`:""}
    ${allegroOstatniBladWystawienia?`<div class="allegro-permission-alert allegro-info-bottom"><div><b>⚠️ Ostatnia próba wystawienia nie powiodła się</b><p>${esc(allegroOstatniBladWystawienia.message||"Błąd Allegro")}</p>${(allegroOstatniBladWystawienia.allegroError?.errors||allegroOstatniBladWystawienia.errors||[]).map(x=>`<small>• ${esc(x.userMessage||x.message||x.code||"błąd")}${x.path?` (${esc(x.path)})`:""}</small>`).join("<br>")}</div><button class="btn ghost" onclick="allegroOstatniBladWystawienia=null;renderuj()">Zamknij</button></div>`:""}
    <div class="backend-note allegro-info-bottom"><b>Reguła wszystkich ofert:</b> domyślny stan sprzedażowy Allegro = <b>${allegroStanOfertyProduktu()} szt.</b>, niezależnie od stanu fizycznego magazynu; wartość możesz zmienić w <a href="#/admin/allegro/ustawienia">Ustawieniach Allegro</a>. Automatyczne wznawianie jest włączane przy każdym utworzeniu i zapisie oferty.${defaultsIssues.length?`<br><span class="lvl lvl-ostrzezenie">${defaultsIssues.length} starszych ofert do uzupełnienia</span> Allegro blokuje w nich wznawianie do czasu uzupełnienia aktualnie wymaganych parametrów. Agent AI ma zapisany audyt i będzie pokazywał je jako zadania.${defaultsErrors.length?`<br><small>${defaultsErrors.map(x=>`• ${esc(skrocTekst(x,220))}`).join("<br>")}</small>`:""}`:` <span class="lvl lvl-ok">Audyt bez wyjątków</span>`}</div>
    <div class="allegro-info-bottom">${allegroZadaniaAgentaOfertHTML()}</div>
    ${allegroProceduraAgentaOfertHTML()}
    <div class="backend-note allegro-info-bottom"><b>Sklep jest źródłem najnowszych danych.</b> Powiązanie zapisuje jednocześnie produkt sklepu, produkt katalogowy Allegro i ofertę. Nazwa, cena, stan, zdjęcia, opis oraz producent są aktualizowane automatycznie z kartoteki sklepu bez tworzenia duplikatu i bez zmiany statusu publikacji.</div>
  </div>`;
}
