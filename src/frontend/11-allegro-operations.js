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
function allegroEtapRealizacjiZamowienia(z={}){
  const status=allegroStatusKolejki(z),etap=allegroEtapMagazynu(z),tracking=String(z.trackingNumber||z.shipment?.trackingNumber||z.delivery?.trackingNumber||"").trim();
  if(["CANCELLED","RETURNED"].includes(status))return "anulowane";
  if(status==="PICKED_UP"||allegroZamowienieZrealizowaneLokalnie(z))return "zrealizowane";
  if(status==="SENT")return "w_transporcie";
  if(tracking)return "nadane";
  if(status==="NEW")return "nowe";
  if(status==="READY_FOR_SHIPMENT"||etap==="spakowane"||etap==="kompletacja")return "do_nadania";
  if(etap==="do_sprawdzenia")return "do_decyzji";
  return "do_obslugi";
}
function allegroTimestampZamowienia(z={}){const raw=z.createdAt||z.firstFetchedAt||z.ts||z.checkoutForm?.createdAt||"",numeric=Number(raw);return Number.isFinite(numeric)&&numeric>1e9?(numeric<1e11?numeric*1000:numeric):(Date.parse(raw)||0);}
function allegroDostawaZamowienia(z={}){const text=`${z.deliveryMethod||""} ${z.deliveryPoint||""} ${z.delivery?.method?.name||""}`.toLowerCase();if(text.includes("paczkomat"))return "paczkomat";if(text.includes("punkt")||text.includes("odbior"))return "punkt";return "kurier";}
function allegroWartoscZamowienia(z={}){return kwotaNum(z.total?.amount??z.total??z.summary?.totalToPay?.amount??0);}
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
  const kategoria=allegroKategoriaKolejki(z),realizacja=allegroEtapRealizacjiZamowienia(z),status=allegroStatusKolejki(z);
  const statusOk=["wszystkie","archiwum"].includes(filtrAllegroZamowien)||(filtrAllegroZamowien==="do_obslugi"?allegroZamowienieAktywneLokalnie(z):realizacja===filtrAllegroZamowien||kategoria===filtrAllegroZamowien);
  const kanalOk=filtrStatusuKanaluAllegroZamowien==="wszystkie"||status===filtrStatusuKanaluAllegroZamowien;
  const etapOk=filtrEtapuAllegroZamowien==="wszystkie"||allegroEtapMagazynu(z)===filtrEtapuAllegroZamowien;
  const okresDni=filtrOkresuAllegroZamowien==="dzisiaj"?1:Number(filtrOkresuAllegroZamowien)||0,okresOk=filtrOkresuAllegroZamowien==="wszystkie"||allegroTimestampZamowienia(z)>=Date.now()-okresDni*86400000;
  const dostawaOk=filtrDostawyAllegroZamowien==="wszystkie"||allegroDostawaZamowienia(z)===filtrDostawyAllegroZamowien;
  return statusOk&&kanalOk&&etapOk&&okresOk&&dostawaOk;
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
  return wszystkie.filter(allegroZamowieniePasujeDoFiltra).filter(z=>!pasujaceIds||pasujaceIds.has(String(z.id))).sort((a,b)=>sortAllegroZamowien==="najstarsze"?allegroTimestampZamowienia(a)-allegroTimestampZamowienia(b):sortAllegroZamowien==="wartosc_desc"?allegroWartoscZamowienia(b)-allegroWartoscZamowienia(a):sortAllegroZamowien==="wartosc_asc"?allegroWartoscZamowienia(a)-allegroWartoscZamowienia(b):allegroTimestampZamowienia(b)-allegroTimestampZamowienia(a));
}
function allegroWyczyscFiltryZamowien(){szukajAllegroZamowien="";filtrAllegroZamowien="wszystkie";filtrEtapuAllegroZamowien="wszystkie";filtrStatusuKanaluAllegroZamowien="wszystkie";filtrOkresuAllegroZamowien="wszystkie";filtrDostawyAllegroZamowien="wszystkie";sortAllegroZamowien="najnowsze";renderuj();}
function allegroZaznaczWidoczneZamowienia(checked=true){
  allegroPasujaceZamowienia().slice(0,allegroLimitWidokuZamowien).forEach(z=>checked?zaznaczoneAllegroZamowienia.add(String(z.id)):zaznaczoneAllegroZamowienia.delete(String(z.id)));
  renderuj();
}
function allegroZaznaczWszystkiePasujaceZamowienia(checked=true){
  allegroPasujaceZamowienia().forEach(z=>checked?zaznaczoneAllegroZamowienia.add(String(z.id)):zaznaczoneAllegroZamowienia.delete(String(z.id)));
  renderuj();
}
function allegroZamowieniaTabelaHTML(){
  const wszystkie=Array.isArray(allegroZamowienia)?allegroZamowienia:[];
  const czyArchiwum=filtrAllegroZamowien==="archiwum";
  const pasujaceZamowienia=allegroPasujaceZamowienia();
  const widoczneZamowienia=pasujaceZamowienia.slice(0,allegroLimitWidokuZamowien);
  const zaznaczone=[...zaznaczoneAllegroZamowienia].filter(id=>wszystkie.some(z=>String(z.id)===id));
  const counts={wszystkie:wszystkie.length,nowe:0,do_obslugi:0,do_decyzji:0,do_nadania:0,nadane:0,w_transporcie:0,zrealizowane:0,anulowane:0};
  wszystkie.forEach(z=>{const realizacja=allegroEtapRealizacjiZamowienia(z);counts[realizacja]=(counts[realizacja]||0)+1;if(allegroZamowienieAktywneLokalnie(z)&&realizacja!=="do_obslugi")counts.do_obslugi++;});
  counts.archiwum=Number(allegroArchiwum.summary?.total||allegroPodsumowanie.orders?.archived||0);
  const stages=[["wszystkie","▦","Wszystkie","pełny rejestr"],["nowe","✦","Nowe","czekają na przyjęcie"],["do_obslugi","!","Do obsługi","wymagają działania"],["do_decyzji","?","Do decyzji","sprawdź kartotekę"],["do_nadania","＋","Do nadania","bez przesyłki"],["nadane","🏷","Nadane","etykieta utworzona"],["w_transporcie","→","W transporcie","śledzenie przesyłki"],["zrealizowane","✓","Zrealizowane","dostarczone"],["anulowane","×","Anulowane","zwroty i odrzucenia"]];
  const statusyKanalu=[...new Set(wszystkie.map(allegroStatusKolejki).filter(Boolean))].sort(),aktywneFiltry=[szukajAllegroZamowien,filtrAllegroZamowien!=="wszystkie",filtrEtapuAllegroZamowien!=="wszystkie",filtrStatusuKanaluAllegroZamowien!=="wszystkie",filtrOkresuAllegroZamowien!=="wszystkie",filtrDostawyAllegroZamowien!=="wszystkie",sortAllegroZamowien!=="najnowsze"].filter(Boolean).length;
  return `<div class="allegro-orders-workspace channel-orders-page channel-orders-allegro">
    ${typeof adminKanalyZamowienHTML==="function"?adminKanalyZamowienHTML("allegro"):""}
    ${adminCentrumZamowienHTML({kanal:"allegro",ikona:"🟠",etykieta:"Centrum realizacji • Allegro",tytul:"Zamówienia i kontakt z klientem",opis:"Jedno miejsce: decyzja, kompletacja, przesyłka, etykieta i wiadomości. Status Allegro pozostaje tylko do odczytu.",className:"panel allegro-orders-command",metricsClass:"allegro-orders-pulse",metryki:[{icon:"!",value:counts.do_obslugi,label:"Wymaga działania",note:"sprawdź teraz",tone:counts.do_obslugi?"danger":"ready",onclick:"allegroUstawFiltrZamowien('do_obslugi')"},{icon:"🏷",value:counts.do_nadania,label:"Do nadania",note:"bez etykiety",tone:counts.do_nadania?"attention":"ready",onclick:"allegroUstawFiltrZamowien('do_nadania')"},{icon:"🚚",value:counts.w_transporcie,label:"W drodze",note:"tracking InPost",tone:"transit",onclick:"allegroUstawFiltrZamowien('w_transporcie')"},{icon:"✓",value:counts.zrealizowane,label:"Zakończone",note:"dostarczone",tone:"done",onclick:"allegroUstawFiltrZamowien('zrealizowane')"}],akcje:adminAkcjeCentrumZamowienHTML({source:"allegro-orders-manual",syncAction:"allegroSynchronizujZamowienia()",syncBusy:allegroStan.ladowanie})})}
    <section class="panel allegro-orders-register channel-orders-register">
      ${adminEtapyRealizacjiZamowienHTML({active:filtrAllegroZamowien,items:stages.map(([id,icon,label,note])=>({id,icon,label,note,count:counts[id],onclick:`allegroUstawFiltrZamowien(${jsArg(id)})`}))})}
    ${czyArchiwum?`<div class="archive-toolbar"><div><b>🗄️ Archiwum miesięczne</b><small>Ładowane dopiero po otwarciu — nie obciąża codziennej pracy.</small></div><label>Miesiąc <select onchange="allegroArchiwum.month=this.value;allegroWczytajArchiwum(true)"><option value="">Wszystkie miesiące</option>${(allegroArchiwum.summary?.months||[]).map(x=>`<option value="${esc(x.month)}" ${allegroArchiwum.month===x.month?"selected":""}>${esc(x.month)} (${esc(x.count)})</option>`).join("")}</select></label><button class="btn ghost" onclick="allegroWczytajArchiwum(true)" ${allegroArchiwum.busy?"disabled":""}>${allegroArchiwum.busy?"⏳ Ładuję…":"↻ Odśwież archiwum"}</button></div>${allegroArchiwum.error?`<div class="backend-note">${esc(allegroArchiwum.error)}</div>`:""}`:""}
    ${adminWyszukiwaniePanelHTML({id:"allegro-orders",title:"Wyszukiwanie i filtry",description:"ID, klient, dane kontaktowe, produkt, tracking, etap i okres.",results:pasujaceZamowienia.length,active:!!aktywneFiltry,open:true,fields:`<div class="von-halsky-order-filters channel-orders-filter-fields admin-search-full">
      <label class="von-halsky-order-search"><span>Szukaj zamówienia</span><input placeholder="ID, klient, e-mail, telefon, produkt lub tracking…" value="${esc(szukajAllegroZamowien)}" oninput="szukajAllegroZamowien=this.value.toLowerCase();zaplanujRenderPoWpisaniu()"></label>
      <label><span>Etap realizacji</span><select onchange="allegroUstawFiltrZamowien(this.value)">${[["wszystkie","Wszystkie etapy"],["nowe","Nowe"],["do_obslugi","Do obsługi"],["do_decyzji","Do decyzji"],["do_nadania","Do nadania"],["nadane","Nadane"],["w_transporcie","W transporcie"],["zrealizowane","Zrealizowane"],["anulowane","Anulowane / zwrócone"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <label><span>Status kanału</span><select onchange="filtrStatusuKanaluAllegroZamowien=this.value;renderuj()"><option value="wszystkie" ${filtrStatusuKanaluAllegroZamowien==="wszystkie"?"selected":""}>Wszystkie statusy</option>${statusyKanalu.map(status=>`<option value="${esc(status)}" ${filtrStatusuKanaluAllegroZamowien===status?"selected":""}>${esc(allegroStatusKolejkiMeta({fulfillmentStatus:status}).label)} (${esc(status)})</option>`).join("")}</select></label>
      <label><span>Okres</span><select onchange="filtrOkresuAllegroZamowien=this.value;renderuj()">${[["wszystkie","Cały okres"],["dzisiaj","Dzisiaj"],["7","Ostatnie 7 dni"],["30","Ostatnie 30 dni"],["90","Ostatnie 90 dni"]].map(([v,l])=>`<option value="${v}" ${filtrOkresuAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <label><span>Sposób doręczenia</span><select onchange="filtrDostawyAllegroZamowien=this.value;renderuj()">${[["wszystkie","Każda dostawa"],["paczkomat","Paczkomat"],["kurier","Kurier"],["punkt","Punkt odbioru"]].map(([v,l])=>`<option value="${v}" ${filtrDostawyAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <label><span>Sortowanie</span><select onchange="sortAllegroZamowien=this.value;renderuj()">${[["najnowsze","Najnowsza aktualizacja"],["najstarsze","Najstarsze najpierw"],["wartosc_desc","Najwyższa wartość"],["wartosc_asc","Najniższa wartość"]].map(([v,l])=>`<option value="${v}" ${sortAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <label><span>Etap magazynu</span><select onchange="filtrEtapuAllegroZamowien=this.value;renderuj()">${[["wszystkie","Wszystkie etapy magazynu"],["do_sprawdzenia","Do sprawdzenia"],["braki","Braki"],["oczekuje_na_dostawe","Oczekuje na dostawę"],["kompletacja","Oczekuje na wysyłkę"],["spakowane","Spakowane"],["zrealizowane","Zrealizowane lokalnie"]].map(([v,l])=>`<option value="${v}" ${filtrEtapuAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <button class="btn ghost" type="button" ${aktywneFiltry?"":"disabled"} onclick="allegroWyczyscFiltryZamowien()">Wyczyść filtry (${aktywneFiltry})</button><button class="btn ghost" type="button" onclick="allegroUstawFiltrZamowien('archiwum')">Archiwum (${counts.archiwum})</button>
    </div>`})}
    ${adminNaglowekListyZamowienHTML({id:"allegro-orders",title:"zamówień",total:pasujaceZamowienia.length,from:pasujaceZamowienia.length?1:0,to:widoczneZamowienia.length,selected:zaznaczone.length,selectPage:"allegroZaznaczWidoczneZamowienia(true)",clear:"allegroWyczyscZaznaczenieZamowien()",exportAll:"allegroEksportujZamowienia('filtr')",limit:allegroLimitWidokuZamowien,limits:[10,25,50,100],onLimit:"allegroLimitWidokuZamowien=Number(this.value)||25;renderuj()"})}
    ${czyArchiwum?`<div class="backend-note"><b>Tryb tylko do odczytu.</b> Archiwalne zlecenia nie są ponownie synchronizowane, rezerwowane ani dodawane do planu producenta.</div>`:`<div class="allegro-bulk-toolbar allegro-orders-bulk">
      <div><b>${zaznaczone.length?`${zaznaczone.length} zaznaczonych zleceń`:"Operacje grupowe"}</b><small>Zaznaczenie nie zmienia oficjalnego statusu w Allegro.</small></div>
      <div class="allegro-bulk-stage"><button class="btn" onclick='allegroUtworzZamowienieProducenta(${JSON.stringify(zaznaczone)})' ${zaznaczone.length?"":"disabled"}>🧾 Utwórz/aktualizuj plany producentów (${zaznaczone.length})</button><label for="bulkAllegroWarehouseStage">Etap magazynu</label><select id="bulkAllegroWarehouseStage"><option value="">— wybierz etap —</option><option value="do_sprawdzenia">Do sprawdzenia</option><option value="braki">Braki — zamówić</option><option value="oczekuje_na_dostawe">Zamówione — oczekuje</option><option value="kompletacja">Oczekuje na wysyłkę</option><option value="spakowane">Spakowane</option><option value="zrealizowane">✅ Zrealizowane lokalnie</option></select><button class="btn" onclick="allegroUstawEtapZaznaczonychZamowien()" ${zaznaczone.length?"":"disabled"}>Zastosuj do ${zaznaczone.length}</button></div>
    </div>`}
    <div class="allegro-order-list">${widoczneZamowienia.map(allegroZlecenieHTML).join("") || `<div class="backend-note">Brak zamówień w tym filtrze. Synchronizacja pobiera wyłącznie nowe i gotowe do wysłania.</div>`}</div>
    ${czyArchiwum&&allegroArchiwum.hasMore?`<button class="btn ghost archive-load-more" onclick="allegroWczytajArchiwum(false)" ${allegroArchiwum.busy?"disabled":""}>${allegroArchiwum.busy?"Ładuję…":"Pokaż kolejne 100"}</button>`:""}
    ${widoczneZamowienia.length>=allegroLimitWidokuZamowien?`<p class="order-detail-lead">Pokazano pierwsze ${allegroLimitWidokuZamowien} zleceń. Zwiększ limit widoku powyżej, aby zobaczyć więcej.</p>`:""}
    <details class="allegro-orders-rules"><summary>Zasady automatycznej obsługi i mapowania</summary><div><p><b>Agent:</b> rozpoznaje po ręcznym powiązaniu, EAN, SKU, kodzie producenta i jednoznacznej nazwie. Niepewnych wyników nie zapisuje sam.</p><p><b>Status:</b> jest odczytywany z Allegro co 15 minut i nigdy nie jest zmieniany przez lokalny etap magazynowy.</p><p><b>Zakup:</b> po przyjęciu pełnego dokumentu producenta zlecenie przechodzi do kompletacji i nie zasila kolejnego zamówienia.</p></div></details>
    </section>
  </div>`;
}
function allegroStanPozycjiHTML(p={}){
  if(!p.produkt)return `<span class="lvl lvl-blad">nierozpoznany produkt</span><br><small>Wymagany EAN, SKU albo mapowanie oferty.</small>`;
  if(p.stan===null)return `<span class="lvl lvl-ostrzezenie">brak kontrolowanego stanu</span><br><small>Uzupełnij stan produktu ID ${esc(p.produkt.id)} w Magazynie.</small>`;
  return `stan: <b>${esc(p.stan)}</b> szt.<br><small>dla tego zlecenia: ${esc(p.przydzielone??0)}/${esc(p.ilosc||1)} szt.${Number(p.brak)>0?` • brak ${esc(p.brak)}`:""}<br>łączne rezerwacje: ${esc(p.laczneRezerwacje)} • po rezerwacji: ${esc(p.dostepne)}</small>`;
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
function allegroKompletacjaSzybkaHTML(analiza={}){
  const rows=Array.isArray(analiza.pozycje)?analiza.pozycje:[];
  if(!rows.length)return "";
  return `<div class="order-picking-strip allegro-picking-strip"><b>📦 Kompletacja</b><div>${rows.map(p=>`<span class="${p.decyzja==="kompletuj"?"is-ready":"needs-check"}"><strong>${esc(p.externalId||p.produkt?.externalId||p.produkt?.kodProducenta||"—")}</strong> ${esc(p.nazwa||"Produkt")} × ${esc(p.ilosc||1)}${p.lokalizacja?` <em>📍 ${esc(sciezkaNazwLokalizacjiMagazynu(p.lokalizacja)||nazwaLokalizacjiMagazynu(p.lokalizacja))} · ${esc(p.lokalizacja)}</em>`:` <em>${p.decyzja==="kompletuj"?"📍 brak lokalizacji":Number(p.brak)>0?"⛔ brak sztuki do pobrania":"⚠️ wymaga kontroli stanu"}</em>`}</span>`).join("")}</div></div>`;
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
    ${allegroKompletacjaSzybkaHTML(analiza)}
    <details class="allegro-order-products" ${analiza.braki>0||analiza.nierozpoznane>0||analiza.bezStanu>0?"open":""}>
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
  return `<div class="panel allegro-section-panel allegro-mapping-workspace"><div class="order-section-head allegro-offers-head"><div><span class="order-pro-label">Kanoniczne powiązania ofert</span><h2 style="margin-top:.15rem">🏷️ Oferty Allegro ↔ produkty sklepu</h2><p class="order-detail-lead">Jedna oferta główna jest trwale przypisana do produktu. Detektor API pobiera wyłącznie nowe lub zmienione dane; dopiero taki sygnał uruchamia właściwy moduł Agenta bez ponownego ręcznego łączenia.</p></div><div class="diag-actions"><button class="btn" onclick="allegroUruchomAutomatyczneMapowanie(false)" ${allegroAutoMapowanieSerwera.busy?"disabled":""}>${allegroAutoMapowanieSerwera.busy?"⏳ Kontroluję…":"🤖 Sprawdź nowe oferty"}</button><a class="btn ghost" href="#/admin/allegro/oferty">🟠 Wystaw produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia</a></div></div><div class="allegro-offer-inventory-strip">${[["aktywne","🏷️","Aktywne i szkice",counts.aktywne],["sprzedaz","●","W sprzedaży",counts.sprzedaz],["szkice","○","Szkice / nieaktywne",counts.szkice],["zakonczone","■","Zakończone",counts.zakonczone],["wszystkie","≡","Cały rejestr",counts.wszystkie]].map(([id,ico,label,n])=>`<button class="${filtrStatusuAllegroOfert===id?"active":""}" onclick="filtrStatusuAllegroOfert=${jsArg(id)};renderuj()"><span>${ico}</span><b>${n}</b><small>${label}</small></button>`).join("")}</div><div class="allegro-map-stats">${[["🔒","Oferty główne",counts.kanoniczne,"kanoniczne"],["↻","Agent aktualizuje",counts.synchronizacja,"synchronizacja"],["⧉","Drugie oferty",counts.duplikat,"duplikat"],["⚠️","Konflikty",counts.konflikt,"konflikt"],["✨","Pewne sugestie",counts.sugestia,"sugestia"],["○","Niepodpięte",counts.niepodpiete,"niepodpiete"]].map(([ico,label,count,id])=>`<button class="${filtrAllegroOfert===id?"active":""}" onclick="filtrAllegroOfert=${jsArg(id)};renderuj()"><span>${ico}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div><div class="orders-toolbar allegro-toolbar allegro-offers-toolbar"><input placeholder="Szukaj: oferta, produkt, ID, EAN, SKU, EXTERNAL_ID, kod producenta…" value="${esc(szukajAllegroOfert)}" oninput="szukajAllegroOfert=this.value.toLowerCase();zaplanujRenderPoWpisaniu()"><select aria-label="Status publikacji" onchange="filtrStatusuAllegroOfert=this.value;renderuj()">${[["aktywne",`Aktywne i szkice (${counts.aktywne})`],["sprzedaz",`W sprzedaży (${counts.sprzedaz})`],["szkice",`Szkice / nieaktywne (${counts.szkice})`],["zakonczone",`Zakończone (${counts.zakonczone})`],["wszystkie",`Cały rejestr (${counts.wszystkie})`]].map(([id,label])=>`<option value="${id}" ${filtrStatusuAllegroOfert===id?"selected":""}>${label}</option>`).join("")}</select><select aria-label="Stan powiązania" onchange="filtrAllegroOfert=this.value;renderuj()">${[["problemy",`Wymagające pracy (${counts.problemy})`],["wszystkie","Każdy stan powiązania"],["kanoniczne",`Oferty główne (${counts.kanoniczne})`],["synchronizacja",`Agent aktualizuje (${counts.synchronizacja})`],["duplikat",`Drugie oferty (${counts.duplikat})`],["konflikt",`Konflikty (${counts.konflikt})`],["sugestia",`Pewne sugestie (${counts.sugestia})`],["niepodpiete",`Niepodpięte (${counts.niepodpiete})`],["sprawdz",`Do sprawdzenia (${counts.sprawdz})`],["poprawne",`Starsze poprawne (${counts.poprawne})`],["duplikaty",`Centrum duplikatów (${counts.duplikaty})`]].map(([id,label])=>`<option value="${id}" ${filtrAllegroOfert===id?"selected":""}>${label}</option>`).join("")}</select><select aria-label="Sortowanie ofert" onchange="sortAllegroOfert=this.value;renderuj()"><option value="priorytet" ${sortAllegroOfert==="priorytet"?"selected":""}>Najpierw decyzje</option><option value="nazwa" ${sortAllegroOfert==="nazwa"?"selected":""}>Nazwa A–Z</option><option value="status" ${sortAllegroOfert==="status"?"selected":""}>Status Allegro</option></select><label class="allegro-view-limit">Pokaż <select onchange="allegroLimitWidokuOfert=Number(this.value)||100;renderuj()">${[50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWidokuOfert===n?"selected":""}>${n}</option>`).join("")}</select></label></div><div class="allegro-map-bulk allegro-offer-bulk"><div><b>Operacje na ofertach</b><small>${selected.length} zaznaczonych • ${withdrawSelected.length} można zakończyć • ${safeSelected.length} nowych, pewnych sugestii</small></div><button class="btn ghost" onclick='allegroZaznaczOfertyMapowania(${JSON.stringify(visible.map(a=>String(a.oferta.id)))},true)'>☑️ Zaznacz widoczne (${visible.length})</button>${selected.length?`<button class="btn ghost" onclick="zaznaczoneMapowaniaAllegro.clear();renderuj()">Odznacz wszystko</button>`:""}<button class="btn ghost" ${allegroMapowanieMasowe.busy||!(selected.length?safeSelected.length:safeVisible.length)?"disabled":""} onclick='allegroZastosujPewneSugestieMapowania(${selected.length?JSON.stringify(selected):JSON.stringify(safeVisible.map(a=>String(a.oferta.id)))})'>${allegroMapowanieMasowe.busy?"⏳ Zapisuję…":`Połącz nowe ${selected.length?"zaznaczone":"z widoku"}`}</button><button class="btn danger" ${withdrawSelected.length&&!allegroWycofywanieOfert.busy?"":"disabled"} onclick='allegroPrzygotujWycofanieOfert(${JSON.stringify(withdrawSelected)})'>Zakończ zaznaczone (${withdrawSelected.length})</button></div>${allegroWycofaniePanelHTML()}${allegroAutoMapowanieSerwera.error?`<div class="backend-note allegro-mapping-error"><b>Błąd automatu:</b> ${esc(allegroAutoMapowanieSerwera.error)}</div>`:""}${allegroMapowanieMasowe.error?`<div class="backend-note allegro-mapping-error"><b>Błąd operacji:</b> ${esc(allegroMapowanieMasowe.error)}</div>`:""}${audyt.produkty&&filtrAllegroOfert==="duplikaty"?allegroCentrumDuplikatowHTML(audyt):""}<div class="allegro-results-summary"><b>Znaleziono ${rows.length}</b><span>Pokazano ${Math.min(visible.length,rows.length)} • filtr publikacji: ${esc(filtrStatusuAllegroOfert)} • powiązanie: ${esc(filtrAllegroOfert)}</span></div><div class="allegro-offer-map-list">${visible.map(allegroOfertaMapowanieCardHTML).join("")||`<div class="backend-note">Brak ofert pasujących do aktywnych filtrów.</div>`}</div>${rows.length>visible.length?`<div class="backend-note">Pokazano ${visible.length} z ${rows.length}. Zwiększ limit albo zawęź wyszukiwanie.</div>`:""}</div>`;
}
function allegroPoprawnyGtin(value){
  const digits=String(value||"").replace(/\D/g,"");
  if(![8,12,13,14].includes(digits.length))return false;
  const body=digits.slice(0,-1),check=Number(digits.at(-1));let sum=0;
  for(let i=body.length-1,pos=0;i>=0;i--,pos++)sum+=Number(body[i])*(pos%2===0?3:1);
  return (10-(sum%10))%10===check;
}
function allegroBrakiProduktuDoWystawienia(p){
  const braki=[];
  if(!p.nazwa) braki.push("nazwa");
  if(!Number(p.cena)) braki.push("cena");
  if((p.gtin||p.ean)&&!allegroPoprawnyGtin(p.gtin||p.ean)) braki.push("poprawny EAN/GTIN");
  if(!(p.kodProducenta||p.mpn||p.externalId||p.sku)) braki.push("kod producenta/SKU");
  if(!poprawnaNazwaProducenta(p.producent||p.marka)) braki.push("prawidłowa nazwa producenta");
  if(!(p.zdjecie||(p.zdjecia||[]).length)) braki.push("zdjęcie");
  if(!p.allegroCategoryId) braki.push("ID kategorii Allegro");
  const agentStatus=String(p.allegroAgentPreparationStatus||"").toLowerCase();
  const agentMissing=Array.isArray(p.allegroAgentPreparationMissing)?p.allegroAgentPreparationMissing.map(String).filter(Boolean):[];
  const hasOffer=!!String(p.allegroOfferId||"").trim()||(typeof allegroOfertaDlaProduktuSklepu==="function"&&!!allegroOfertaDlaProduktuSklepu(p));
  if(!hasOffer){
    const currentFingerprint=typeof asortymentSygnaturaPrzygotowania==="function"?asortymentSygnaturaPrzygotowania(p):"";
    const serverConfirmed=p.allegroAgentPreparationCurrent;
    const confirmedPreparation=["ready","published"].includes(agentStatus)
      &&(serverConfirmed===true||(serverConfirmed===undefined
        &&Number(p.allegroAgentPreparationVersion)>=4
        &&!!String(p.allegroAgentPreparationFingerprint||"")
        &&String(p.allegroAgentPreparationFingerprint)===currentFingerprint))
      &&agentMissing.length===0;
    if(agentMissing.length)braki.push(...agentMissing);
    if(!confirmedPreparation)braki.push(agentStatus==="failed"?"ponowne przygotowanie po błędzie":"aktualne przygotowanie Agenta Allegro");
  }
  return [...new Set(braki)];
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
function allegroStanKolejkiPrzygotowania(){
  const direct=typeof asortymentSerwerowaKolejka!=="undefined"?asortymentSerwerowaKolejka.state:null;
  const runtime=typeof agentAIRuntime!=="undefined"?agentAIRuntime.preparationQueue:null;
  return direct||runtime||null;
}
function allegroAktywneZadaniaAgentaOfert(){
  const queue=allegroStanKolejkiPrzygotowania(),current=Array.isArray(queue?.current)?queue.current:[];
  const active=new Set(["pending","running","attention","waiting_provider","decision_required","failed"]);
  return current.filter(task=>active.has(String(task?.status||"").toLowerCase()));
}
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
  const task=allegroAktywneZadaniaAgentaOfert().find(x=>String(x.id)===String(taskId));
  if(!task){toast("To zadanie zostało już zakończone albo zastąpione nowszym wynikiem");return;}
  const p=pobierzProduktAdmin(task.productId);if(!p){toast("Produkt z zadania nie istnieje");return;}
  toast(`Agent ponownie analizuje i zapisuje kartotekę: ${p.nazwa||p.id}`);
  await asortymentUruchomAgenta([p.id],"product-full-review");
}
function allegroAgentStatusZadania(task={}){
  const status=String(task.status||"").toLowerCase();
  if(status==="running")return {label:"Agent pracuje",className:"working",icon:"⋯"};
  if(status==="pending"||status==="attention")return {label:"Automatyczna korekta",className:"queued",icon:"↻"};
  if(status==="waiting_provider")return {label:"Oczekuje na dostęp AI",className:"waiting",icon:"◷"};
  if(status==="decision_required")return {label:"Brakuje pewnego faktu",className:"decision",icon:"!"};
  return {label:"Ponowna naprawa",className:"failed",icon:"×"};
}
function allegroZadaniaAgentaOfertHTML(){return "";}
function allegroZadaniaAgentaOfertLegacyHTML(){
  const queue=allegroStanKolejkiPrzygotowania(),tasks=allegroAktywneZadaniaAgentaOfert();
  if(!queue){return `<section class="allegro-agent-tasks is-loading" data-allegro-agent-queue><div><b>Łączę z kolejką Agenta…</b><small>Pobieram wyłącznie aktualny stan zapisany w PostgreSQL.</small></div></section>`;}
  if(!tasks.length)return `<section class="allegro-agent-tasks is-empty" data-allegro-agent-queue><div><b>✓ Brak otwartych napraw Allegro</b><small>Wykonane zadania nie wracają do tego widoku. Nowy wpis pojawi się dopiero po rzeczywistym błędzie lub zmianie produktu.</small></div><a class="btn ghost" href="#/admin/agent-ai/praca">Historia pracy</a></section>`;
  const rows=tasks.slice(0,10),counts=tasks.reduce((acc,task)=>{const key=String(task.status||"");acc[key]=(acc[key]||0)+1;return acc;},{});
  return `<section class="allegro-agent-tasks" data-allegro-agent-queue><div class="order-section-head"><div><span class="order-pro-label">JEDNA KOLEJKA • POSTGRESQL</span><h3>Naprawy ofert wykonywane przez Agenta</h3><small>Każdy produkt występuje raz. Wykonany zapis znika po kontrolnym odczycie kartoteki.</small></div><div class="allegro-agent-task-summary"><span><b>${tasks.length}</b><small>otwarte</small></span><span><b>${Number(counts.running||0)+Number(counts.pending||0)+Number(counts.attention||0)}</b><small>w pracy</small></span><span><b>${Number(counts.decision_required||0)+Number(counts.failed||0)}</b><small>konkretne braki</small></span><a class="btn ghost" href="#/admin/agent-ai/praca">Pełna praca Agenta</a></div></div><div class="allegro-agent-task-table-wrap"><table class="allegro-agent-task-table"><thead><tr><th>Produkt</th><th>Stan</th><th>Co pozostało</th><th>Ostatni wynik</th><th>Akcje</th></tr></thead><tbody>${rows.map(t=>{const meta=allegroAgentStatusZadania(t),missing=[...(t.missing||[]),...(t.errors||[]).map(e=>e.message||e.code)].filter(Boolean),working=["running","pending","attention"].includes(String(t.status||"").toLowerCase());return `<tr><td><b>${esc(t.name||t.productName||`Produkt ${t.productId}`)}</b><small>ID ${esc(t.productId)}</small></td><td><span class="allegro-agent-task-status ${meta.className}"><i>${meta.icon}</i>${esc(meta.label)}</span></td><td><p>${missing.slice(0,3).map(esc).join(" • ")||"Kontrola pełnej kartoteki"}${missing.length>3?` <b>+${missing.length-3}</b>`:""}</p></td><td><small>${t.completedAt?new Date(t.completedAt).toLocaleString("pl-PL"):t.requestedAt?new Date(t.requestedAt).toLocaleString("pl-PL"):"w kolejce"}</small></td><td><div class="warehouse-worktable-actions"><button class="btn" onclick="allegroAgentUzupelnijZadanieOferty(${jsArg(t.id)})" ${working?"disabled":""}>${working?"Agent pracuje":"Ponów naprawę"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(t.productId)}">Edytuj</a></div></td></tr>`;}).join("")}</tbody></table></div>${tasks.length>rows.length?`<div class="allegro-agent-task-footer"><span>Pokazano ${rows.length} z ${tasks.length} aktualnych spraw.</span><a class="btn ghost" href="#/admin/agent-ai/praca">Otwórz wszystkie</a></div>`:""}</section>`;
}
async function allegroPrzygotujSzkicProduktZListy(id){
  const p=pobierzProduktAdmin(id);
  if(!p){ toast("Nie znaleziono produktu"); return; }
  try{
    const d=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:60000});
    await allegroZapiszAutoUzupelnienia(p,d);
    const cat=d.categorySuggestion?.selected;
    const saved=cat?.id?await allegroZapiszKategorieProduktu(p.id,cat.id):false;
    toast(d.ready?`🟠 Szkic Allegro gotowy technicznie${cat?` — kategoria: ${cat.name}`:""}`:`🟠 Braki: ${((d.missing||[]).join(", ")||"brak")}${cat?` • dobrano kategorię: ${cat.name}`:""}`);
    if(saved) renderuj();
  }catch(e){ await allegroZapiszAutoUzupelnienia(p,e).catch(()=>false);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProduktZListy(id){
  const p=pobierzProduktAdmin(id);
  if(!p){ toast("Nie znaleziono produktu"); return; }
  if(!produktDostepnyWSprzedazy(p)){toast("⛔ Produkt jest ukryty lub niedostępny — nie można go wystawić na Allegro");return;}
  try{
    const publicationAction=allegroTrybPublikacji();
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(p,d);
    await allegroZapiszAutoUzupelnienia(p,d);
    toast(d.operation?.completed===false?`🟠 Oferta ${d.offer?.id||""} jest jeszcze przetwarzana przez Allegro`:d.mode==="updated"?`🟠 Zaktualizowano ofertę ${d.offer?.id||""} bez tworzenia duplikatu`:`🟠 Utworzono nową ofertę ${d.offer?.id||""}`);
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||"";
      await chmuraZapiszProduktyCentralnie([{productId:p.id,fields:{allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})}}],"allegro-publication");
      allegroZastosujWynikWystawienia(p,d);
      await chmuraWczytajStan().catch(()=>{});
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      renderuj();
    }
  }catch(e){ allegroOstatniBladWystawienia=e;await allegroZapiszAutoUzupelnienia(p,e).catch(()=>false);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Wystawianie Allegro: "+(e.message||e)+" • zadanie przekazano Agentowi AI");renderuj(); }
}
async function allegroAktywujProduktZListy(id){
  const p=pobierzProduktAdmin(id);if(!p){toast("Nie znaleziono produktu");return;}
  if(!produktDostepnyWSprzedazy(p)){toast("⛔ Produkt jest ukryty lub niedostępny — najpierw wznów sprzedaż");return;}
  const qty=allegroStanOfertyProduktu(p);
  try{
    toast(`Aktywuję ofertę ${p.nazwa} ze stanem Allegro ${qty} szt.…`);
    const product={...p,allegroStock:qty};
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product,options:{stock:qty,publicationAction:"activate",publishNow:true}},timeout:120000});
    allegroOstatniBladWystawienia=null;allegroZapiszWynikOperacji(product,d);await allegroZapiszAutoUzupelnienia(product,d);allegroZastosujWynikWystawienia(product,d);
    const categoryId=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||p.allegroCategoryId||"";
    const productId=d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"";
    await chmuraZapiszProduktyCentralnie([{productId:p.id,fields:{allegroStock:qty,allegroOfferId:String(d.offer?.id||p.allegroOfferId||""),...(categoryId?{allegroCategoryId:String(categoryId)}:{}),...(productId?{allegroProductId:String(productId)}:{})}}],"allegro-activation");
    await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});zbudujProdukty();
    toast(`✅ Oferta ${d.offer?.id||""} aktywna • stan Allegro ${qty} szt. • magazyn bez zmian`);renderuj();
  }catch(e){allegroOstatniBladWystawienia=e;await allegroZapiszAutoUzupelnienia(p,e).catch(()=>false);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Aktywacja Allegro: "+(e.message||e));renderuj();}
}
async function allegroAktualizujZaznaczoneOfertyDanymiSklepu(){
  const ids=[...zaznaczoneAllegroOferty].slice(0,100),produkty=[...new Map(ids.map(id=>allegroProduktDlaOferty(id)).filter(Boolean).map(p=>[String(p.id),p])).values()];
  if(!produkty.length){toast("Zaznacz powiązane oferty, które mają zostać zaktualizowane danymi sklepu");return;}
  let ok=0,bledy=0;toast(`Aktualizuję ${produkty.length} ofert nowszymi danymi sklepu…`);
  for(const p of produkty){try{const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publicationAction:"keep"}},timeout:120000});await allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);ok++;}catch(e){bledy++;allegroOstatniBladWystawienia=e;}}
  zaznaczoneAllegroOferty.clear();await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});
  toast(`Synchronizacja ofert: zaktualizowano ${ok}${bledy?` • do Agenta AI / błędy: ${bledy}`:""}`);renderuj();
}
function allegroPrzelaczOferteDoCeny(id,checked){const set=location.hash.startsWith("#/admin/allegro/oferty")?zaznaczoneMapowaniaAllegro:zaznaczoneAllegroOferty;checked?set.add(String(id)):set.delete(String(id));renderuj();}
let allegroWystawianieWynikiIds=[],allegroWystawianieStronaIds=[];
function allegroZaznaczOfertyProduktow(ids=[],checked=true){
  ids.forEach(raw=>{const id=String(raw),p=pobierzProduktAdmin(raw),o=p?allegroOfertaDlaProduktuSklepu(p):null;checked?zaznaczoneAllegroProduktyKatalogu.add(id):zaznaczoneAllegroProduktyKatalogu.delete(id);if(o)checked?zaznaczoneAllegroOferty.add(String(o.id)):zaznaczoneAllegroOferty.delete(String(o.id));});renderuj();
}
function allegroPrzelaczProduktKatalogu(id,checked){allegroZaznaczOfertyProduktow([id],checked);}
function allegroZaznaczZakresWystawiania(zakres,checked=true){allegroPublikacjaZaznaczIds(zakres==="strona"?allegroWystawianieStronaIds:allegroWystawianieWynikiIds,checked);}
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
  return `<section class="panel allegro-current-workspace-loading" data-allegro-current-workspace-loading aria-live="polite"><span>⟳</span><div><b>Pobieram aktualne centrum Allegro…</b><small>Ładuję jeden bieżący widok z PostgreSQL i API. Dawny ekran ofert został usunięty.</small></div></section>`;
}
