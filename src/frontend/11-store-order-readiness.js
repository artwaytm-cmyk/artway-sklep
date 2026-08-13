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
  const nr=String(z.nr||""),rezerwacje=typeof rezerwacjeMagazynowe==="function"?rezerwacjeMagazynowe():{},przydzialy=typeof przydzialyMagazynoweAktywnychZamowien==="function"?przydzialyMagazynoweAktywnychZamowien():new Map(),plan=typeof planZatowarowania==="function"?planZatowarowania():[];
  const planMap=new Map(plan.map(x=>[String(x?.produkt?.id??""),x]));
  const dokumenty=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(agentAIPlanDokumentAktywny);
  return (Array.isArray(z.pozycjeDane)?z.pozycjeDane:[]).map(item=>{
    const rozpoznany=adminProduktDlaPozycjiZamowienia(item),id=String(rozpoznany?.id??item?.id??item?.produktId??item?.productId??""),produkt=rozpoznany||(typeof produktMagazynowy==="function"?produktMagazynowy(id):null),stan=typeof stanMagazynuId==="function"?stanMagazynuId(id):null,sugestia=planMap.get(id)||{};
    let dokument=null,pozycja=null;
    for(const doc of dokumenty){
      const hit=(Array.isArray(doc.pozycje)?doc.pozycje:[]).find(p=>String(p?.produktId??p?.id??"")===id&&(Array.isArray(p?.zamowienia)?p.zamowienia.map(String).includes(nr):false));
      if(hit){dokument=doc;pozycja=hit;break;}
    }
    const qty=Math.max(1,Number(item?.ilosc)||1),przydzial=przydzialy.get(`sklep:${nr}:${id}`),brakPrzydzialu=przydzial?.shortage===null||przydzial?.shortage===undefined?null:Math.max(0,Number(przydzial.shortage)||0),brak=brakPrzydzialu===null?Math.max(0,Number(pozycja?.iloscPotrzebna??sugestia?.ilosc)||0):brakPrzydzialu,lokalizacjaKartoteki=magazynMetaProduktu(id)?.lokalizacja||pozycja?.lokalizacja||"",lokalizacja=brak>0?"":lokalizacjaKartoteki;
    return {id,nazwa:item?.nazwa||produkt?.nazwa||`Produkt ${id}`,kod:pozycja?.kod||produkt?.kodProducenta||produkt?.mpn||produkt?.externalId||produkt?.sku||"—",qty,stan,rezerwacje:Math.max(0,Number(rezerwacje[id])||0),przydzielone:przydzial?.allocated??null,brak,lokalizacja,lokalizacjaKartoteki,dokument,pozycja};
  });
}
function adminZaopatrzenieZamowieniaHTML(z={}){
  const rows=adminZaopatrzenieZamowieniaDane(z),braki=rows.filter(x=>x.brak>0),docs=[...new Map(rows.filter(x=>x.dokument).map(x=>[String(x.dokument.id),x.dokument])).values()];
  const statusDoc=docs.length?docs.map(d=>`${d.numer||d.id}: ${d.status||"szkic"}`).join(" • "):braki.length?"Szkic tworzy się automatycznie po synchronizacji":"Nie jest potrzebne zamówienie u producenta";
  return `<section class="order-detail-card order-procurement-card">
    <div class="order-section-head"><div><span class="order-pro-label">Magazyn → producent</span><h2>🏭 Kontrola realizacji produktów</h2><p class="order-detail-lead">Stan jest sprawdzany dla całej aktywnej kolejki. Zamawiamy wyłącznie rzeczywisty brak, a wysyłka do producenta czeka na zatwierdzenie aktualnej wersji.</p></div><a class="btn ${braki.length?"":"ghost"}" href="#/admin/magazyn/plan">${braki.length?"Otwórz szkic w Planie":"Plan zatowarowania"}</a></div>
    <div class="procurement-flow" aria-label="Etapy zaopatrzenia"><span class="done"><b>1</b> Stan sprawdzony</span><span class="${braki.length?"active":"done"}"><b>2</b> ${braki.length?`Brak ${braki.reduce((s,x)=>s+x.brak,0)} szt.`:"Pokrycie kompletne"}</span><span class="${docs.length?"active":""}"><b>3</b> ${docs.length?"Szkic producenta":"Bez szkicu"}</span><span class="${docs.some(d=>String(d.status||"").toLowerCase().includes("wysłane do"))?"done":""}"><b>4</b> Zatwierdź i wyślij</span></div>
    <div class="procurement-order-table"><table><thead><tr><th>Kod</th><th>Produkt</th><th>Zamówiono</th><th>Stan fizyczny</th><th>Rezerwacje</th><th>Brak w tym zamówieniu</th><th>Lokalizacja / dokument</th></tr></thead><tbody>${rows.map(x=>`<tr class="${x.brak>0?"needs-order":"stock-covered"}"><td><b>${esc(x.kod)}</b></td><td>${esc(x.nazwa)}</td><td>${x.qty} szt.</td><td>${x.stan===null?"niemonitorowany":`${x.stan} szt.`}</td><td>${x.rezerwacje} szt.</td><td>${x.brak>0?`<span class="lvl lvl-ostrzezenie">${x.brak} szt.</span>`:`<span class="lvl lvl-ok">0</span>`}</td><td>${x.brak>0?magazynLokalizacjaStatusHTML("","Oczekuje na dostawę — półka kartoteki nie jest miejscem pobrania.","unavailable"):magazynLokalizacjaStatusHTML(x.lokalizacja)}<small>${x.dokument?`${esc(x.dokument.numer||x.dokument.id)} • ${esc(x.dokument.status||"szkic")}`:(x.brak?"oczekuje na szkic":"zapas wystarcza")}</small></td></tr>`).join("")||`<tr><td colspan="7">Brak pozycji magazynowych w zamówieniu.</td></tr>`}</tbody></table></div>
    <div class="backend-note ${braki.length?"":"is-ok"}"><b>${braki.length?"Dalszy etap:":"Wynik kontroli:"}</b> ${esc(statusDoc)}. ${braki.length?"Najpierw sprawdź tabelę i zatwierdź dokładną rewizję; dopiero potem system pozwoli wysłać e-mail do właściwego producenta.":"Produkty można przekazać do kompletacji bez tworzenia zlecenia zakupowego."}</div>
  </section>`;
}
function adminKompletacjaZamowieniaHTML(z={}){
  const items=Array.isArray(z?.pozycjeDane)?z.pozycjeDane:[],nr=String(z?.nr||""),przydzialy=typeof przydzialyMagazynoweAktywnychZamowien==="function"?przydzialyMagazynoweAktywnychZamowien():new Map();
  const rows=items.map(item=>{
    const produkt=adminProduktDlaPozycjiZamowienia(item),id=String(produkt?.id??item?.produktId??item?.productId??item?.id??""),meta=produkt?magazynMetaProduktu(id):{},stan=produkt?stanMagazynuId(id):null,ilosc=Math.max(1,Number(item?.ilosc)||1),przydzial=przydzialy.get(`sklep:${nr}:${id}`),brak=przydzial?.shortage===null||przydzial?.shortage===undefined?stan===null?null:Math.max(0,ilosc-stan):Math.max(0,Number(przydzial.shortage)||0),gotowe=produkt&&stan!==null&&brak===0;
    return {nazwa:item?.nazwa||item?.produkt||produkt?.nazwa||"Produkt",kod:produkt?.externalId||produkt?.sku||produkt?.kodProducenta||produkt?.mpn||item?.sku||id||"—",ilosc,lokalizacja:gotowe?String(meta?.lokalizacja||meta?.location||"").trim():"",stan,brak,gotowe,produkt};
  });
  if(!rows.length)return "";
  return `<div class="order-picking-strip"><b>📦 Kompletacja</b><div>${rows.map(row=>`<span class="${row.gotowe?"is-ready":"needs-check"}"><strong>${esc(row.kod)}</strong> ${esc(row.nazwa)} × ${row.ilosc}${row.lokalizacja?` <em>📍 ${esc(sciezkaNazwLokalizacjiMagazynu(row.lokalizacja)||nazwaLokalizacjiMagazynu(row.lokalizacja))} · ${esc(row.lokalizacja)}</em>`:` <em>${Number(row.brak)>0?"⛔ brak sztuki do pobrania":"📍 brak lokalizacji"}</em>`}</span>`).join("")}</div></div>`;
}
