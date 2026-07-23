/* GENERATED ADMIN COMMERCE — loaded on demand */
// Zamówienia Allegro → jeden kanoniczny Plan zatowarowania producentów.
async function allegroUtworzZamowienieProducenta(orderIds){
  const ids=[...new Set((Array.isArray(orderIds)?orderIds:[orderIds]).map(String).filter(Boolean))];
  if(!ids.length){toast("Zaznacz co najmniej jedno zamówienie Allegro");return;}
  try{
    toast(`Sprawdzam stan i aktualizuję Plan producentów dla ${ids.length} zamówień…`);
    const d=await chmura("supplier-order-from-allegro",{method:"POST",body:{orderIds:ids},timeout:90000});
    if(Array.isArray(d.orders))allegroZamowienia=d.orders;
    if(Array.isArray(d.supplierOrders)){
      agentAIZlecenia=d.supplierOrders;
      const previousLoading=chmuraWczytywanie;chmuraWczytywanie=true;try{zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);}finally{chmuraWczytywanie=previousLoading;}
    }
    allegroZapiszCache();
    const documents=Array.isArray(d.relatedDrafts)?d.relatedDrafts:[];
    const message=documents.length?`✅ Plan producentów gotowy • ${documents.length} dokumentów • ${d.withShortages||0} zamówień z brakami`:(d.unresolved?`⚠️ ${d.unresolved} zamówień wymaga uzupełnienia mapowania lub stanu`:`✅ Zapas pokrywa wskazane zamówienia — nie utworzono zbędnego dokumentu`);
    toast(message);renderuj();
  }catch(e){toast("⚠️ Plan producenta: "+(e.message||e));}
}

async function allegroUstawEtapMagazynu(orderId,stage){
  try{const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderId,stage},timeout:18000});allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;allegroZapiszCache();toast("Etap magazynu zapisany — status Allegro pozostał bez zmian");renderuj();}catch(e){toast("⚠️ Etap magazynu: "+(e.message||e));}
}

async function allegroUstawEtapZaznaczonychZamowien(){
  const stage=String(document.getElementById("bulkAllegroWarehouseStage")?.value||"");
  const ids=[...zaznaczoneAllegroZamowienia];
  if(!ids.length){toast("Zaznacz co najmniej jedno zlecenie Allegro");return;}
  if(!["do_sprawdzenia","braki","oczekuje_na_dostawe","kompletacja","spakowane","zrealizowane"].includes(stage)){toast("Wybierz etap magazynowy");return;}
  try{
    toast(`Zmieniam etap ${ids.length} zleceń Allegro…`);
    const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderIds:ids,stage},timeout:45000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;zaznaczoneAllegroZamowienia.clear();allegroZapiszCache();
    toast(`✅ Zmieniono etap ${d.changed||0} zleceń${d.skipped?.length?` • pominięto zamknięte: ${d.skipped.length}`:""}. Statusy Allegro pozostały bez zmian.`);renderuj();
  }catch(e){toast("⚠️ Masowy etap Allegro: "+(e.message||e));}
}

/* Lekkie odświeżanie wyników synchronizacji Allegro bez przebudowy widoku,
   jeśli serwer nie zwrócił żadnej rzeczywistej zmiany. */
const ALLEGRO_ODSWIEZANIE_PANELU_MS=15*60*1000;
let allegroAutoOdswiezanie={busy:false,lastChecked:0,lastChanged:0,orders:0,threads:0,issues:0,offers:0,error:""};

function allegroAktywneIdDoOdswiezenia(){return new Set((allegroZamowienia||[]).filter(allegroZamowienieAktywneLokalnie).map(z=>String(z.id||z.nr||"")).filter(Boolean));}
function allegroOfertaIdDoOdswiezenia(){return new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean));}
function allegroKomunikacjaKluczeDoOdswiezenia(type="thread"){const list=type==="issue"?(allegroKomunikacja?.issues||[]):(allegroKomunikacja?.threads||[]);return new Set(list.filter(allegroKomunikacjaWymagaOdpowiedzi).map(x=>{const id=String(x.id||""),last=x.latestNewIncoming||x.lastMessage||{},marker=String(x.latestNewIncomingKey||last.id||last.createdAt||x.newIncomingCount||"");return id?`${id}:${marker}`:"";}).filter(Boolean));}
function allegroNoweIdPoOdswiezeniu(przed,po){let n=0;for(const id of po)if(!przed.has(id))n++;return n;}
function allegroWersjaDanychDoOdswiezenia(){
  // Wersja opiera się na lekkich metadanych serwera. Nie sklejamy już ID i
  // treści dziesiątek tysięcy ofert przy każdym cyklu odświeżania.
  return typeof allegroWersjaSerwerowaZakresu==="function"?allegroWersjaSerwerowaZakresu("summary"):`${allegroPodsumowanie?.orders?.updated_at||""}|${allegroPodsumowanie?.offers?.updated_at||""}|${allegroKomunikacja?.updated_at||""}`;
}
async function allegroOdswiezDaneZSerweraJesliCzas(powod="timer"){
  if(allegroAutoOdswiezanie.busy||typeof jestAdmin!=="function"||!jestAdmin())return false;
  if(typeof document!=="undefined"&&document.hidden&&powod==="timer")return false;
  const teraz=Date.now(),minimalnyOdstep=ALLEGRO_ODSWIEZANIE_PANELU_MS;
  if(teraz-Number(allegroAutoOdswiezanie.lastChecked||0)<minimalnyOdstep)return false;
  const mialDane=!!allegroStan.sprawdzono,przedWersja=allegroWersjaDanychDoOdswiezenia(),przedOrders=allegroAktywneIdDoOdswiezenia(),przedThreads=allegroKomunikacjaKluczeDoOdswiezenia("thread"),przedIssues=allegroKomunikacjaKluczeDoOdswiezenia("issue"),przedOfferCount=Number(allegroPodsumowanie?.offers?.count||allegroOferty?.length||0),przedOrderVersion=allegroWersjaSerwerowaZakresu("orders"),przedOfferVersion=allegroWersjaSerwerowaZakresu("offers");
  allegroAutoOdswiezanie={...allegroAutoOdswiezanie,busy:true,error:""};
  // Najpierw pobieramy małe podsumowanie. Pełną listę zamówień/ofert
  // ściągamy tylko wtedy, gdy jej wersja na serwerze rzeczywiście się zmieniła.
  const wyniki=[await allegroWczytajDane(true,false,"summary")];
  const orderChanged=przedOrderVersion!==allegroWersjaSerwerowaZakresu("orders"),offerChanged=przedOfferVersion!==allegroWersjaSerwerowaZakresu("offers");
  if(allegroDaneZaladowane.orders&&orderChanged)wyniki.push(await allegroWczytajDane(true,false,"orders"));
  if(allegroDaneZaladowane.offers&&offerChanged)wyniki.push(await allegroWczytajDane(true,false,"offers"));
  const ok=wyniki.every(Boolean);
  const orders=ok?allegroNoweIdPoOdswiezeniu(przedOrders,allegroAktywneIdDoOdswiezenia()):0,offers=ok?Math.max(0,Number(allegroPodsumowanie?.offers?.count||allegroOferty?.length||0)-przedOfferCount):0,threads=ok?allegroNoweIdPoOdswiezeniu(przedThreads,allegroKomunikacjaKluczeDoOdswiezenia("thread")):0,issues=ok?allegroNoweIdPoOdswiezeniu(przedIssues,allegroKomunikacjaKluczeDoOdswiezenia("issue")):0,changed=orders+offers+threads+issues,daneZmienione=ok&&przedWersja!==allegroWersjaDanychDoOdswiezenia();
  allegroAutoOdswiezanie={busy:false,lastChecked:Date.now(),lastChanged:changed?Date.now():allegroAutoOdswiezanie.lastChanged,orders,threads,issues,offers,error:ok?"":allegroStan.error||"Nie udało się odświeżyć danych"};
  if(ok&&mialDane&&changed)toast(`🟠 Allegro: zlecenia ${orders} • wiadomości ${threads} • dyskusje ${issues} • oferty ${offers}`);
  return !!daneZmienione;
}

function allegroStatusOfertyMeta(o={}){
  const status=String(o.status||o.publication?.status||"INACTIVE").toUpperCase();
  if(status==="ACTIVE")return {status,label:"Aktywna sprzedaż",ico:"●",cls:"active",group:"sprzedaz",withdrawable:true};
  if(status==="ENDED")return {status,label:"Zakończona",ico:"■",cls:"ended",group:"zakonczone",withdrawable:false};
  if(status==="ARCHIVED")return {status,label:"Archiwalna",ico:"□",cls:"archived",group:"zakonczone",withdrawable:false};
  return {status,label:status==="INACTIVE"?"Szkic / nieaktywna":status,ico:"○",cls:"inactive",group:"szkice",withdrawable:true};
}
function allegroOferteMoznaWycofac(o={}){return allegroStatusOfertyMeta(o).withdrawable;}
function allegroPrzygotujWycofanieOfert(ids=[]){
  const unique=[...new Set(ids.map(String))].filter(id=>allegroOferteMoznaWycofac(allegroOfertaPoId(id))).slice(0,50);
  if(!unique.length){toast("Zaznaczone oferty są już zakończone albo archiwalne");return;}
  allegroWycofywanieOfert={busy:false,step:"confirm",ids:unique,reason:"admin_decision",error:"",results:[]};renderuj();
  setTimeout(()=>document.querySelector(".allegro-withdraw-confirm")?.scrollIntoView({behavior:"smooth",block:"center"}),0);
}
function allegroAnulujWycofanieOfert(){allegroWycofywanieOfert={busy:false,step:"idle",ids:[],reason:"admin_decision",error:"",results:[]};renderuj();}
async function allegroPotwierdzWycofanieOfert(){
  if(allegroWycofywanieOfert.busy||!allegroWycofywanieOfert.ids.length)return;
  allegroWycofywanieOfert={...allegroWycofywanieOfert,busy:true,error:""};renderuj();
  try{
    const d=await chmura("allegro-withdraw-offers",{method:"POST",body:{offerIds:allegroWycofywanieOfert.ids,reason:allegroWycofywanieOfert.reason},timeout:120000});
    allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;allegroMapowania=d.mappings||allegroMapowania;
    allegroWycofywanieOfert={busy:false,step:"done",ids:[],reason:allegroWycofywanieOfert.reason,error:"",results:d.results||[]};zaznaczoneMapowaniaAllegro.clear();
    await chmuraWczytajStan().catch(()=>{});allegroZapiszCache();toast(d.partial?`⚠️ Zakończono ${d.ended} ofert • błędy ${d.failed}`:`✅ Zakończono ${d.ended} ofert i wyłączono ich odnawianie`);renderuj();
  }catch(e){allegroWycofywanieOfert={...allegroWycofywanieOfert,busy:false,error:e.message||String(e)};toast("⚠️ Zakończenie ofert: "+(e.message||e));renderuj();}
}
function allegroWycofaniePanelHTML(){
  const state=allegroWycofywanieOfert;if(state.step==="idle")return "";
  if(state.step==="done"){const ok=state.results.filter(x=>x.ended).length,failed=state.results.filter(x=>!x.ended).length;return `<section class="allegro-withdraw-result ${failed?"partial":"ok"}"><span>${failed?"⚠️":"✅"}</span><div><b>Zakończenie ofert zapisane</b><small>Zakończono ${ok}${failed?` • niepowodzenia ${failed}`:""}. Produkty sklepu i historia zamówień pozostały bez zmian.</small></div><button class="btn ghost" onclick="allegroAnulujWycofanieOfert()">Zamknij podsumowanie</button></section>`;}
  const offers=state.ids.map(allegroOfertaPoId).filter(Boolean),reasonLabels={admin_decision:"Decyzja administratora",duplicate:"Duplikat oferty",unavailable:"Produkt niedostępny",catalog_cleanup:"Porządkowanie katalogu",other:"Inny powód"};
  return `<section class="allegro-withdraw-confirm"><header><span>⚠️</span><div><small>Operacja zewnętrzna przez API Allegro</small><h3>Zakończyć ${offers.length} ${offers.length===1?"ofertę":"ofert"}?</h3><p>Oferty zostaną zakończone i nie będą automatycznie odnawiane. Nie usuwamy produktów sklepu, istniejących zamówień ani historii sprzedaży Allegro.</p></div></header><div class="allegro-withdraw-preview">${offers.slice(0,8).map(o=>`<span><b>${esc(o.name||"Oferta Allegro")}</b><small>ID ${esc(o.id)} • ${esc(allegroStatusOfertyMeta(o).label)}</small></span>`).join("")}${offers.length>8?`<em>+ ${offers.length-8} kolejnych ofert</em>`:""}</div><label>Powód wewnętrzny <select onchange="allegroWycofywanieOfert.reason=this.value">${Object.entries(reasonLabels).map(([v,l])=>`<option value="${v}" ${state.reason===v?"selected":""}>${l}</option>`).join("")}</select></label>${state.error?`<div class="backend-note allegro-mapping-error">${esc(state.error)}</div>`:""}<footer><button class="btn ghost" onclick="allegroAnulujWycofanieOfert()" ${state.busy?"disabled":""}>Anuluj</button><button class="btn danger" onclick="allegroPotwierdzWycofanieOfert()" ${state.busy?"disabled":""}>${state.busy?"⏳ Kończę oferty…":`Potwierdzam — zakończ ${offers.length}`}</button></footer></section>`;
}
function allegroOfertaMapowanieCardHTML(a){
  const o=a.oferta,m=a.mapped,e=a.current,s=a.correction||(!m?(a.suggestion||a.occupiedMatch):null),rec=a.rec||{},meta=allegroStatusMapowaniaMeta(a.status),publication=allegroStatusOfertyMeta(o),checked=zaznaczoneMapowaniaAllegro.has(String(o.id)),identity=e||s,canonical=rec.canonical===true||rec.mappingRole==="primary",duplicate=rec.mappingRole==="duplicate",syncing=rec.syncState==="pending";
  const linkSummary=m?(canonical?"Trwałe powiązanie główne":duplicate?`Druga oferta tego produktu • główna ${rec.duplicateOf||"do ustalenia"}`:"Powiązanie zapisane"):"Brak powiązania";
  const verification=identity?`${esc(identity.reason||"zweryfikowane identyfikatory")} • wynik pomocniczy ${esc(identity.score)}%`:"brak wspólnych identyfikatorów";
  return `<article class="allegro-offer-map-card ${meta.cls} publication-${publication.cls} ${checked?"is-selected":""}"><header><label class="allegro-map-checkbox" title="Zaznacz do operacji grupowych"><input type="checkbox" ${checked?"checked":""} onchange="allegroPrzelaczOferteDoCeny(${jsArg(o.id)},this.checked)"><span></span></label><div class="allegro-offer-title-cell">${o.mainImage?`<img src="${esc(o.mainImage)}" alt="" loading="lazy">`:`<span>🏷️</span>`}<div><small>OFERTA ALLEGRO • ID ${esc(o.id)}</small><b>${esc(o.name||"—")}</b><p>${esc(o.priceText||"cena —")} • stan ${esc(o.stockAvailable??"—")} • kategoria ${esc(o.categoryId||"—")}</p></div></div><div class="allegro-offer-status-stack"><span class="allegro-publication-status ${publication.cls}">${publication.ico} ${esc(publication.label)}</span><span class="allegro-map-status ${meta.cls}">${meta.icon} ${meta.label}</span></div></header>${m?`<div class="allegro-canonical-flow ${duplicate?"is-duplicate":syncing?"is-syncing":""}"><span>${canonical?"🔒":duplicate?"⧉":"↔"}</span><div><b>${esc(linkSummary)}</b><small>Sklep jest źródłem nazwy, ceny, opisów, zdjęć i parametrów. ${syncing?"Agent ma zapisaną aktualizację Allegro do wykonania.":rec.lastSyncedAt||rec.synced_at?`Ostatnia synchronizacja: ${esc(allegroDataTxt(rec.lastSyncedAt||rec.synced_at))}.`:"Agent zweryfikuje dane w cyklu 15-minutowym."}</small></div><em>${esc(verification)}</em></div>`:""}<div class="allegro-map-compare"><section>${allegroDaneKodyHTML("Dane Allegro",o,"offer")}</section><div class="allegro-map-link-state"><b>${m?(canonical?"🔒":"↔"):"○"}</b><small>${m?"zapis trwały":"brak połączenia"}</small><em>${esc(identity?.reason||"wybierz produkt")}</em><span>Allegro ↔ sklep</span></div><section>${m?`${allegroProduktMapowanieMiniHTML(m,e,publication.withdrawable?"Produkt źródłowy sklepu":"Historycznie podpięty produkt")}${allegroDaneKodyHTML("Dane sklepu",m,"product")}`:`<div class="allegro-map-empty-product"><span>○</span><b>Brak aktywnego powiązania</b><small>${a.occupiedMatch?"Agent rozpoznał ten sam towar w innej bieżącej ofercie — wybierz ofertę główną.":publication.withdrawable?"Wybierz sugestię albo wyszukaj produkt ręcznie.":"Oferta zakończona — historia nie wymaga nowego mapowania."}</small></div>`}</section></div>${publication.withdrawable&&a.conflict?`<div class="allegro-map-conflict-note"><b>Agent wykrył sprzeczne połączenie.</b><span>${esc(e?.conflicts?.join(" • ")||"Aktualny produkt nie zgadza się z ofertą")}</span></div>`:""}${publication.withdrawable&&s&&String(s.produkt.id)!==String(m?.id)?`<div class="allegro-map-suggestion">${allegroProduktMapowanieMiniHTML(s.produkt,s,a.occupiedMatch===s?"Ten sam towar — możliwa druga oferta":"Najlepsza sugestia Agenta")}<div><b>${esc(s.reason||"zgodne identyfikatory")}</b><small>Wynik pomocniczy ${esc(s.score)}%${s.occupied.length?` • istniejąca oferta ${esc(s.occupied.join(", "))}`:""}</small><button class="btn ${s.occupied.length?"ghost":""}" onclick="allegroOtworzMapowaniePozycji(${jsArg(o.id)},${jsArg(o.name)})">${s.occupied.length?"Wybierz ofertę główną":"Sprawdź i połącz"}</button></div></div>`:""}<footer>${publication.withdrawable?`<button class="btn ${a.conflict||!m?"":"ghost"}" onclick="allegroOtworzMapowaniePozycji(${jsArg(o.id)},${jsArg(o.name)})">${m?canonical?"Zmień trwałe powiązanie":"Ustaw jako ofertę główną":"🧩 Połącz z produktem sklepu"}</button>${m?`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(m.id)}">Otwórz produkt</a><button class="btn ghost" onclick="allegroMapujOferte(${jsArg(o.id)},'')">Odłącz</button>`:!s?`<button class="btn ghost" onclick="allegroDodajProduktZOferty(${jsArg(o.id)})">➕ Utwórz nowy produkt</button>`:""}`:m?`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(m.id)}">Otwórz produkt sklepu</a>`:""}<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(o.id)}" target="_blank" rel="noopener">Otwórz Allegro ↗</a>${publication.withdrawable?`<button class="btn danger" onclick='allegroPrzygotujWycofanieOfert([${jsArg(String(o.id))}])'>Zakończ ofertę</button>`:`<span class="allegro-ended-note">Historia zachowana • odnawianie wyłączone</span>`}</footer></article>`;
}

// Czytelny, lokalny przebieg zakupu dla zamówienia Allegro.
// Nie wykonuje żadnej operacji w API Allegro i wyłącznie prezentuje stan sklepu.
function allegroPrzeplywZakupowyHTML(z={}){
  const procurement=z.supplierProcurement||{},stage=allegroEtapMagazynu(z),ordered=Math.max(0,Number(procurement.orderedQuantity)||0),received=Math.max(0,Number(procurement.receivedQuantity)||0),sent=["oczekuje_na_dostawe","kompletacja","spakowane","zrealizowane"].includes(stage)||["oczekuje_na_dostawe","czesciowo_przyjete","dostawa_przyjeta"].includes(procurement.status),delivered=procurement.status==="dostawa_przyjeta"||stage==="kompletacja"||stage==="spakowane",shipping=["kompletacja","spakowane","zrealizowane"].includes(stage);
  const steps=[
    {label:"Zlecenie Allegro",opis:allegroStatusKolejkiMeta(z).label,done:true,current:false},
    {label:"Zakup u producenta",opis:sent?`${ordered} szt. zamówiono`:"kontrola braków",done:sent,current:!sent},
    {label:"Przyjęcie dokumentu",opis:ordered?`${received}/${ordered} szt.`:"nie wymaga zakupu",done:delivered,current:sent&&!delivered},
    {label:"Oczekuje na wysyłkę",opis:shipping?"towar przydzielony":"po pełnej dostawie",done:shipping,current:delivered}
  ];
  return `<div class="allegro-procurement-flow">${steps.map((step,index)=>`<span class="${step.done?"done":step.current?"current":"waiting"}"><em>${step.done?"✓":index+1}</em><b>${esc(step.label)}</b><small>${esc(step.opis)}</small></span>`).join("")}</div>`;
}

/* Lekkie, miesięczne archiwum zamówień Allegro — ładowane wyłącznie na żądanie. */
function allegroZrodloZamowien(){return filtrAllegroZamowien==="archiwum"?(allegroArchiwum.items||[]):(allegroZamowienia||[]);}
async function allegroWczytajArchiwum(reset=true){
  if(allegroArchiwum.busy)return;const offset=reset?0:Number(allegroArchiwum.offset||0);allegroArchiwum={...allegroArchiwum,busy:true,error:""};renderuj();
  try{const d=await chmura("allegro-orders-archive",{params:{month:allegroArchiwum.month||"",offset,limit:100},timeout:30000}),incoming=Array.isArray(d.items)?d.items:[];allegroArchiwum={...allegroArchiwum,busy:false,loaded:true,items:reset?incoming:[...(allegroArchiwum.items||[]),...incoming],summary:d.summary||allegroArchiwum.summary,offset:offset+incoming.length,hasMore:!!d.hasMore,error:""};}
  catch(e){allegroArchiwum={...allegroArchiwum,busy:false,error:e.message||String(e)};toast("⚠️ Archiwum Allegro: "+(e.message||e));}
  renderuj();
}
function allegroUstawFiltrZamowien(id){filtrAllegroZamowien=id;if(id==="archiwum"){filtrEtapuAllegroZamowien="wszystkie";zaznaczoneAllegroZamowienia.clear();if(!allegroArchiwum.loaded)setTimeout(()=>allegroWczytajArchiwum(true),0);}renderuj();}

/* Indeks kandydatów mapowania Allegro. Przy dużym katalogu nie porównujemy
   każdej oferty z każdą kartoteką; najpierw zawężamy pulę po identyfikatorach
   oraz istotnych tokenach nazwy. */
let allegroIndeksKandydatowCache={source:null,byId:new Map(),ean:new Map(),external:new Map(),code:new Map(),catalog:new Map(),token:new Map()};
function allegroIndeksKandydatowKlucz(value=""){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g," ").trim();}
function allegroIndeksKanonicznyGtin(value=""){const code=String(value??"").replace(/\D+/g,"");if(![8,12,13,14].includes(code.length))return"";let sum=0,weight=3;for(let i=code.length-2;i>=0;i--,weight=weight===3?1:3)sum+=Number(code[i])*weight;return(10-sum%10)%10===Number(code.at(-1))?code.padStart(14,"0"):"";}
function allegroIndeksGtins(value={}){const direct=[value?.canonicalGtins,value?.gtins,value?.canonicalGtin,value?.gtin,value?.ean,value?.GTIN,value?.EAN,value?.kodKreskowy,value?.barcode,value?.parametryProducenta?.ean,value?.parametryProducenta?.gtin,value?.parametryProducenta?.kodKreskowy,value?.parametryProducenta?.kodProducenta,value?.parametryZrodla?.ean,value?.parametryZrodla?.gtin,value?.parametryZrodla?.["kod kreskowy"],value?.parametryZrodla?.["kod producenta"]].flat(Infinity),read=params=>{for(const p of Array.isArray(params)?params:[]){const name=String(p?.name||p?.label||p?.key||"").toLowerCase(),id=String(p?.id||"");if(p?.options?.isGTIN===true||["225693","245669","245673"].includes(id)||/ean|gtin|isbn|issn|kod kreskowy/.test(name))direct.push(p?.values,p?.valuesLabels,p?.value);}};read(value?.parameters);read(value?.product?.parameters);for(const item of Array.isArray(value?.productSet)?value.productSet:[])read(item?.product?.parameters);return[...new Set(direct.flat(Infinity).map(allegroIndeksKanonicznyGtin).filter(Boolean))];}
function allegroIndeksGtin(value={}){return allegroIndeksGtins(value)[0]||"";}
const ALLEGRO_INDEKS_STOP=new Set(["gra","gry","zabawka","zabawki","zestaw","dla","oraz","maly","mala","duzy","duza","szt","elementow","alexander","multigra","godan"]);
function allegroIndeksKandydatowTokeny(value=""){return [...new Set(allegroIndeksKandydatowKlucz(value).split(/\s+/).filter(token=>token.length>2&&!ALLEGRO_INDEKS_STOP.has(token)))];}
function allegroIndeksKandydatowDodaj(map,key,product){if(!key)return;const list=map.get(key)||[];list.push(product);map.set(key,list);}
function allegroIndeksKandydatow(products=[]){
  if(allegroIndeksKandydatowCache.source===products)return allegroIndeksKandydatowCache;
  const next={source:products,byId:new Map(),ean:new Map(),external:new Map(),code:new Map(),catalog:new Map(),token:new Map()};
  for(const product of products){
    const id=String(product?.id??"");if(!id)continue;next.byId.set(id,product);
    allegroIndeksGtins(product).forEach(gtin=>allegroIndeksKandydatowDodaj(next.ean,gtin,product));
    allegroIndeksKandydatowDodaj(next.external,allegroIndeksKandydatowKlucz(product.externalId||product.sku),product);
    allegroIndeksKandydatowDodaj(next.code,allegroIndeksKandydatowKlucz(product.kodProducenta||product.mpn),product);
    allegroIndeksKandydatowDodaj(next.catalog,String(product.allegroProductId||""),product);
    const tokens=allegroIndeksKandydatowTokeny(product.nazwa||product.name);
    tokens.forEach(token=>allegroIndeksKandydatowDodaj(next.token,token,product));
  }
  allegroIndeksKandydatowCache=next;return next;
}
function allegroPulaProduktowMapowania(offer={},products=[]){
  const index=allegroIndeksKandydatow(products),scores=new Map(),add=(list,points)=>{for(const product of list||[]){const id=String(product.id);scores.set(id,{product,score:(scores.get(id)?.score||0)+points});}};
  allegroIndeksGtins(offer).forEach(gtin=>add(index.ean.get(gtin),1000));
  add(index.external.get(allegroIndeksKandydatowKlucz(offer.externalId)),800);
  add(index.code.get(allegroIndeksKandydatowKlucz(offer.manufacturerCode||offer.producerCode)),700);
  add(index.catalog.get(String(offer.productId||"")),900);
  allegroIndeksKandydatowTokeny(offer.name).sort((a,b)=>(index.token.get(a)?.length||0)-(index.token.get(b)?.length||0)).slice(0,4).forEach(token=>add((index.token.get(token)||[]).slice(0,2000),10));
  const mappedId=String((allegroMapowania||{})[String(offer.id||"")]?.productId??"");if(mappedId&&index.byId.has(mappedId))add([index.byId.get(mappedId)],2000);
  return [...scores.values()].sort((a,b)=>b.score-a.score||String(a.product.id).localeCompare(String(b.product.id))).slice(0,800).map(entry=>entry.product);
}

/* Odwrotny indeks ofert dla kartoteki produktu. Bez niego audyt duplikatow,
   rentownosc i lista produktow wykonywaly kosztowne O(produkty * oferty).
   Indeks jest przebudowywany tylko po podmianie odpowiedzi z API. */
let allegroIndeksOfertCache={offersSource:null,mappingsSource:null,byId:new Map(),byProduct:new Map(),byCatalog:new Map(),byExternal:new Map(),byEan:new Map(),byCode:new Map(),byName:new Map()};
function allegroIndeksOfertDodaj(map,key,value){if(!key)return;const list=map.get(key)||[];list.push(value);map.set(key,list);}
function allegroIndeksOfert(offers=allegroOferty,mappings=allegroMapowania){
  const lista=Array.isArray(offers)?offers:[],mapa=mappings&&typeof mappings==="object"?mappings:{};
  if(allegroIndeksOfertCache.offersSource===lista&&allegroIndeksOfertCache.mappingsSource===mapa)return allegroIndeksOfertCache;
  const next={offersSource:lista,mappingsSource:mapa,byId:new Map(),byProduct:new Map(),byCatalog:new Map(),byExternal:new Map(),byEan:new Map(),byCode:new Map(),byName:new Map()};
  for(const offer of lista){
    const id=String(offer?.id||"").trim();if(!id)continue;next.byId.set(id,offer);
    allegroIndeksOfertDodaj(next.byCatalog,String(offer?.productId||"").trim(),offer);
    allegroIndeksOfertDodaj(next.byExternal,allegroIndeksKandydatowKlucz(offer?.externalId||offer?.sku),offer);
    allegroIndeksGtins(offer).forEach(gtin=>allegroIndeksOfertDodaj(next.byEan,gtin,offer));
    allegroIndeksOfertDodaj(next.byCode,allegroIndeksKandydatowKlucz(offer?.manufacturerCode||offer?.producerCode),offer);
    allegroIndeksOfertDodaj(next.byName,allegroIndeksKandydatowKlucz(offer?.name),offer);
  }
  for(const [key,record] of Object.entries(mapa)){
    const productId=String(record?.productId??"").trim(),offerId=String(record?.offerId||key||"").trim(),offer=next.byId.get(offerId);
    if(productId&&offer)allegroIndeksOfertDodaj(next.byProduct,productId,offer);
  }
  allegroIndeksOfertCache=next;return next;
}
function allegroIndeksOfertKandydaci(product={}){
  const index=allegroIndeksOfert(),wyniki=new Map(),add=(items,score,reason)=>{for(const offer of items||[]){const id=String(offer?.id||"");if(!id)continue;const previous=wyniki.get(id);if(!previous||score>previous.score)wyniki.set(id,{offer,score,reason});}};
  const direct=String(product?.allegroOfferId||"").trim();if(direct)add([index.byId.get(direct)].filter(Boolean),100,"ID oferty");
  add(index.byProduct.get(String(product?.id??"").trim()),99,"mapowanie");
  add(index.byCatalog.get(String(product?.allegroProductId||"").trim()),97,"ID produktu Allegro");
  add(index.byExternal.get(allegroIndeksKandydatowKlucz(product?.externalId||product?.sku||product?.kodProducenta||product?.mpn)),95,"SKU / external.id");
  allegroIndeksGtins(product).forEach(gtin=>add(index.byEan.get(gtin),93,"EAN/GTIN"));
  add(index.byCode.get(allegroIndeksKandydatowKlucz(product?.kodProducenta||product?.mpn)),90,"kod producenta");
  add(index.byName.get(allegroIndeksKandydatowKlucz(product?.nazwa||product?.name)),86,"identyczna nazwa");
  return [...wyniki.values()].sort((a,b)=>b.score-a.score||String(a.offer.id).localeCompare(String(b.offer.id)));
}
function allegroKluczPorownania(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();}
function allegroKanonicznyGtin(v=""){const code=String(v??"").replace(/\D+/g,"");if(![8,12,13,14].includes(code.length))return"";let sum=0,weight=3;for(let i=code.length-2;i>=0;i--,weight=weight===3?1:3)sum+=Number(code[i])*weight;if((10-sum%10)%10!==Number(code.at(-1)))return"";return code.padStart(14,"0");}
function allegroKluczGtin(v=""){return allegroKanonicznyGtin(v);}
function allegroMapowanieDostawcyZweryfikowane(rec={}){return rec?.verifiedForSupplier===true||rec?.supplierOrderEligible===true||/^(admin-(?:validated|force|safe-batch|duplicate-keep)|auto-order:)/i.test(String(rec?.operator||"").trim());}
function allegroProduktWirtualnyZMapowania(rec={},mappedId="",oferta={}){const snapshot=rec?.productSnapshot&&typeof rec.productSnapshot==="object"?rec.productSnapshot:{};return{...snapshot,id:mappedId,productId:mappedId,nazwa:snapshot.nazwa||snapshot.name||rec.productName||oferta.name||`Produkt ${mappedId}`,externalId:snapshot.externalId||snapshot.sku||oferta.externalId||"",ean:snapshot.ean||snapshot.gtin||oferta.ean||oferta.gtin||"",gtin:snapshot.gtin||snapshot.ean||oferta.gtin||oferta.ean||"",kodProducenta:snapshot.kodProducenta||snapshot.mpn||oferta.manufacturerCode||oferta.producerCode||"",producent:snapshot.producent||snapshot.manufacturer||snapshot.marka||snapshot.brand||oferta.brand||"",archiwalneMapowanie:true};}
function allegroOfertyPasujaceDoProduktu(p={}){return allegroIndeksOfertKandydaci(p);}
let allegroAudytDuplikatowCache={products:null,hidden:null,added:null,offers:null,mappings:null,result:null};
function allegroAudytDuplikatow(){
  const products=produktyDoAdministracji();
  if(allegroAudytDuplikatowCache.products===products&&allegroAudytDuplikatowCache.hidden===produktyUkryte&&allegroAudytDuplikatowCache.added===produktyDodane&&allegroAudytDuplikatowCache.offers===allegroOferty&&allegroAudytDuplikatowCache.mappings===allegroMapowania&&allegroAudytDuplikatowCache.result)return allegroAudytDuplikatowCache.result;
  const grupy=[];
  for(const produkt of products){
    if(czyProduktAdminWKoszu(produkt))continue;
    const dopasowania=allegroOfertyPasujaceDoProduktu(produkt).filter(allegroDopasowanieDuplikatuAktywne);
    if(dopasowania.length>1)grupy.push({produkt,dopasowania});
  }
  const offerIds=new Set(grupy.flatMap(x=>x.dopasowania.map(d=>String(d.offer.id)))),result={grupy,offerIds,produkty:grupy.length,oferty:offerIds.size};
  allegroAudytDuplikatowCache={products,hidden:produktyUkryte,added:produktyDodane,offers:allegroOferty,mappings:allegroMapowania,result};return result;
}
function allegroKluczeKodu(v){const raw=String(v||"").trim().toLowerCase();if(!raw)return[];const bezSpacji=raw.replace(/\s+/g,""),bezUniw=bezSpacji.replace(/[-_ ]?uniw$/,""),bezPrefixu=bezUniw.replace(/^(sku|kod|ean|gtin)[:#-]?/,""),cyfry=(bezPrefixu.match(/\d{3,}/)||[])[0]||"";return [...new Set([raw,bezSpacji,bezUniw,bezPrefixu,cyfry].filter(Boolean))];}
function allegroIndeksProduktowPoKodzie(){const indeks=new Map(),konflikty=new Set(),dodajKlucz=(k,p)=>{if(!k)return;const poprzedni=indeks.get(k);if(poprzedni&&String(poprzedni.id)!==String(p.id)){konflikty.add(k);return;}indeks.set(k,p);},dodaj=(kod,p)=>allegroKluczeKodu(kod).forEach(k=>dodajKlucz(k,p)),dodajGtin=(kod,p)=>{const k=allegroIndeksKanonicznyGtin(kod);if(k)dodajKlucz(`gtin:${k}`,p);};produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{[p.sku,p.kod,p.externalId,p.producentKod,p.kodProducenta].forEach(k=>dodaj(k,p));[p.gtin,p.ean,p.GTIN,p.EAN,p.kodKreskowy].forEach(k=>dodajGtin(k,p));});konflikty.forEach(k=>indeks.delete(k));return indeks;}
function allegroNormalizujNazwe(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," i ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function allegroTokenyNazwy(v){const stop=new Set(["gra","gry","planszowa","planszowe","edukacyjna","edukacyjne","zabawka","zestaw","alexander","dla","oraz","plus","wersja","mini","duza","duzy","mala","maly","od","do","na","w","i","z"]);return allegroNormalizujNazwe(v).split(" ").filter(t=>t.length>=3&&!stop.has(t));}
function allegroDopasujProduktPoNazwie(nazwa,produktyLista){const norm=allegroNormalizujNazwe(nazwa),tokeny=allegroTokenyNazwy(nazwa);if(!norm||!tokeny.length)return null;let najlepszy=null,drugi=0;for(const p of produktyLista){const pn=allegroNormalizujNazwe(p.nazwa),pt=allegroTokenyNazwy(p.nazwa);if(!pn||!pt.length)continue;let score=0;if(pn===norm)score=1;else if(pt.length>=2&&pt.every(t=>tokeny.includes(t)))score=Math.min(.94,.62+(pt.length/Math.max(tokeny.length,pt.length))*.34);else if(tokeny.length>=2&&tokeny.every(t=>pt.includes(t)))score=Math.min(.9,.58+(tokeny.length/Math.max(tokeny.length,pt.length))*.32);if(score>0){if(!najlepszy||score>najlepszy.score){drugi=najlepszy?.score||0;najlepszy={produkt:p,score};}else if(score>drugi)drugi=score;}}return najlepszy&&najlepszy.score>=.82&&(najlepszy.score-drugi)>=.08?najlepszy.produkt:null;}
function allegroKodyZamowienDlaOferty(){const mapa=new Map();(Array.isArray(allegroZamowienia)?allegroZamowienia:[]).forEach(z=>(Array.isArray(z.lineItems)?z.lineItems:[]).forEach(it=>{const oid=String(it.offerId||"").trim();if(!oid)return;if(!mapa.has(oid))mapa.set(oid,new Set());[it.externalId,it.offerName].filter(Boolean).forEach(k=>mapa.get(oid).add(k));}));return mapa;}
function allegroSugestieAutomapowania(){const indeks=allegroIndeksProduktowPoKodzie(),produktyLista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),zZamowien=allegroKodyZamowienDlaOferty(),wyniki=[];(Array.isArray(allegroOferty)?allegroOferty:[]).forEach(o=>{if(allegroProduktDlaOferty(o.id))return;let produkt=null,kod="";const gtin=allegroIndeksGtin(o);if(gtin){produkt=indeks.get(`gtin:${gtin}`)||null;if(produkt)kod=`gtin:${gtin}`;}const kody=[o.externalId,o.sku,o.id],dodatkowe=zZamowien.get(String(o.id||""));if(dodatkowe)kody.push(...dodatkowe);for(const k of kody){if(produkt)break;for(const klucz of allegroKluczeKodu(k)){const p=indeks.get(klucz);if(p){produkt=p;kod=klucz;break;}}}if(!produkt){const nazwy=[o.name];if(dodatkowe)nazwy.push(...[...dodatkowe].filter(x=>!allegroKluczeKodu(x).length||String(x).length>18));for(const n of nazwy){produkt=allegroDopasujProduktPoNazwie(n,produktyLista);if(produkt){kod="nazwa";break;}}}if(produkt)wyniki.push({offerId:String(o.id),productId:String(produkt.id),produkt,oferta:o,kod});});return wyniki;}

function allegroTokenyIstotneMapowania(v=""){const stop=new Set(["gra","gry","zabawka","zabawki","zestaw","alexander","multigra","godan","origami","konstruktor","junior","maly","mala","duzy","duza","dla","oraz","wersja","szt","elementow"]);return new Set(allegroNormalizujNazwe(v).split(/\s+/).filter(x=>x.length>2&&!stop.has(x)));}
function allegroPodobienstwoIstotneMapowania(a="",b=""){const aa=allegroTokenyIstotneMapowania(a),bb=allegroTokenyIstotneMapowania(b);if(!aa.size||!bb.size)return 0;let common=0;aa.forEach(x=>{if(bb.has(x))common++;});return common/Math.max(aa.size,bb.size);}
let allegroIndeksMapowanZrodlo=null,allegroIndeksMapowanProduktu=new Map();
function allegroIndeksOfertWedlugProduktu(){if(allegroIndeksMapowanZrodlo===allegroMapowania)return allegroIndeksMapowanProduktu;const index=new Map();Object.values(allegroMapowania||{}).forEach(m=>{const productId=String(m?.productId??m?.produktId??""),offerId=String(m?.offerId||"");if(!productId||!offerId||m?.blocked===true||m?.lifecycle==="historical")return;const offer=allegroIndeksOfert().byId.get(offerId),status=String(offer?.status||offer?.publication?.status||"").toUpperCase();if(!offer||["ENDED","ARCHIVED"].includes(status))return;const list=index.get(productId)||[];list.push(offerId);index.set(productId,list.filter(Boolean));});allegroIndeksMapowanZrodlo=allegroMapowania;allegroIndeksMapowanProduktu=index;return index;}
function allegroInneOfertyProduktu(productId,excludeOfferId=""){return (allegroIndeksOfertWedlugProduktu().get(String(productId))||[]).filter(id=>id!==String(excludeOfferId));}
function allegroOcenaMapowaniaKandydata(oferta={},produkt={}){
  const norm=allegroKluczPorownania,p={eans:allegroIndeksGtins(produkt),external:norm(produkt.externalId||produkt.sku),code:norm(produkt.kodProducenta||produkt.mpn),catalog:String(produkt.allegroProductId||""),offerId:String(produkt.allegroOfferId||""),name:String(produkt.nazwa||"")},o={eans:allegroIndeksGtins(oferta),external:norm(oferta.externalId),code:norm(oferta.manufacturerCode||oferta.producerCode),catalog:String(oferta.productId||""),id:String(oferta.id||""),name:String(oferta.name||"")};
  const evidence=[],conflicts=[],warnings=[];let score=0,reason="";const hit=(value,label)=>{if(value>score){score=value;reason=label;}evidence.push(label);};
  const eanMatch=p.eans.length&&o.eans.length&&p.eans.some(ean=>o.eans.includes(ean)),eanMismatch=p.eans.length&&o.eans.length&&!eanMatch,catalogMatch=!!(p.catalog&&o.catalog&&p.catalog===o.catalog),catalogMismatch=!!(p.catalog&&o.catalog&&!catalogMatch),externalMatch=!!(p.external&&o.external&&p.external===o.external),codeMatch=!!(p.code&&o.code&&p.code===o.code);
  if(eanMatch)hit(100,"identyczny EAN/GTIN");if(catalogMatch)hit(99,"identyczny produkt katalogowy Allegro");if(externalMatch)hit(97,"identyczny EXTERNAL_ID/SKU");if(codeMatch)hit(95,"identyczny kod producenta");
  const exact=p.name&&o.name&&allegroNormalizujNazwe(p.name)===allegroNormalizujNazwe(o.name),similarity=p.name&&o.name?allegroPodobienstwoIstotneMapowania(p.name,o.name):0;if(exact)hit(92,"identyczna nazwa");else if(similarity>=.72)hit(Math.round(72+similarity*18),"bardzo podobna nazwa");else if(similarity>=.45)hit(Math.round(52+similarity*20),"częściowo podobna nazwa");
  const savedOfferMatch=!!(p.offerId&&o.id&&p.offerId===o.id);if(savedOfferMatch)hit(Math.max(score,98),"zapisane ID oferty");const independentIdentity=catalogMatch||savedOfferMatch||(codeMatch&&(exact||similarity>=.72))||(externalMatch&&exact);
  if(eanMismatch)(independentIdentity?warnings:conflicts).push(independentIdentity?"EAN w kartotece różni się — tożsamość potwierdzają silniejsze dowody":"różny EAN/GTIN");if(catalogMismatch)(eanMatch||savedOfferMatch||(codeMatch&&exact)?warnings:conflicts).push(eanMatch||savedOfferMatch||(codeMatch&&exact)?"różne ID produktu katalogowego — sprawdź aktualność UUID":"różne ID produktu katalogowego");if(p.code&&o.code&&!codeMatch&&(eanMatch||catalogMatch||savedOfferMatch))warnings.push("kod producenta różni się — sprawdź kartotekę");
  const strongConflict=conflicts.includes("różny EAN/GTIN")||conflicts.includes("różne ID produktu katalogowego");if(strongConflict)score=Math.min(score,35);const occupied=allegroInneOfertyProduktu(produkt.id,oferta.id);return {produkt,score,reason:reason||"brak wspólnych identyfikatorów",evidence,conflicts,warnings,similarity:Math.round(similarity*100),strongConflict,occupied,valid:score>=65&&!strongConflict,identity:score>=95?"pewna":score>=88?"wysoka":score>=65?"do potwierdzenia":"brak pewności"};
}
let allegroProduktyMapowaniaCache={source:null,hidden:null,added:null,items:[]};
function allegroProduktyMapowaniaAktywne(){
  const source=produktyDoAdministracji();
  if(allegroProduktyMapowaniaCache.source===source&&allegroProduktyMapowaniaCache.hidden===produktyUkryte&&allegroProduktyMapowaniaCache.added===produktyDodane)return allegroProduktyMapowaniaCache.items;
  const items=source.filter(p=>!czyProduktAdminWKoszu(p));allegroProduktyMapowaniaCache={source,hidden:produktyUkryte,added:produktyDodane,items};return items;
}
function allegroKandydaciMapowaniaOferty(oferta={}){const produkty=allegroProduktyMapowaniaAktywne();return allegroPulaProduktowMapowania(oferta,produkty).map(p=>allegroOcenaMapowaniaKandydata(oferta,p)).filter(x=>x.score>0||String(x.produkt.id)===String(allegroProduktIdDlaOferty(oferta.id))).sort((a,b)=>b.score-a.score||Number(a.occupied.length)-Number(b.occupied.length)||String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl")).slice(0,30);}
function allegroAnalizaMapowaniaOferty(oferta={}){const mappedId=String(allegroProduktIdDlaOferty(oferta.id)||""),rec=(allegroMapowania||{})[String(oferta.id)],mapped=mappedId?(produktyDoAdministracji().find(p=>String(p.id)===mappedId)||(allegroMapowanieDostawcyZweryfikowane(rec)?allegroProduktWirtualnyZMapowania(rec,mappedId,oferta):null)):null,candidates=allegroKandydaciMapowaniaOferty(oferta),current=mapped?candidates.find(x=>String(x.produkt.id)===mappedId)||allegroOcenaMapowaniaKandydata(oferta,mapped):null,occupiedMatch=!mapped&&candidates.find(x=>x.valid&&x.score>=88&&x.occupied.length)||null,available=candidates.filter(x=>!x.occupied.length||String(x.produkt.id)===mappedId),best=available[0]||null,second=available[1]||null;const suggestion=best&&best.valid&&best.score>=88&&(!second||best.score-second.score>=6)?best:null,different=suggestion&&mapped&&String(suggestion.produkt.id)!==mappedId,locked=rec?.locked===true||rec?.canonicalLocked===true,conflict=!!mapped&&!locked&&(!!current?.strongConflict||Number(current?.score||0)<65||(different&&suggestion.score-Number(current?.score||0)>=12));const status=conflict?"konflikt":mapped?(rec?.mappingRole==="duplicate"?"duplikat":rec?.syncState==="pending"?"synchronizacja":rec?.canonical===true||rec?.mappingRole==="primary"?"kanoniczne":Number(current?.score||0)>=85?"poprawne":"sprawdz"):suggestion?"sugestia":occupiedMatch?"sprawdz":"niepodpiete";return {oferta,mapped,mappedId,rec,current,candidates,best,suggestion,occupiedMatch,second,conflict,locked,status,canAuto:!mapped&&!!suggestion&&!suggestion.occupied.length,correction:conflict&&different?suggestion:null};}
function allegroDopasowaniePozycjiDoProduktu(it={}){const offerId=String(it.offerId||it.offer?.id||"").trim(),oferta=allegroOfertaPoId(offerId)||{},d=allegroDanePozycjiZamowienia({...it,offerId});const rec=(allegroMapowania||{})[offerId],blocked=rec?.blocked===true,mappedId=String(rec?.productId??rec?.produktId??rec?.id??rec??"").trim();const virtualOffer={...oferta,id:offerId,name:d.nazwa||oferta.name,externalId:it.externalId||oferta.externalId||d.kod,ean:oferta.ean||oferta.gtin||d.ean},candidates=allegroKandydaciMapowaniaOferty(virtualOffer).slice(0,8),current=mappedId?candidates.find(x=>String(x.produkt.id)===mappedId):null;if(mappedId&&!current&&allegroMapowanieDostawcyZweryfikowane(rec)){const produkt=allegroProduktWirtualnyZMapowania(rec,mappedId,virtualOffer);return{produkt,match:"zatwierdzone powiązanie — produkt poza aktywnym katalogiem",confidence:Number(rec?.confidence||100),candidates,virtualProduct:true};}if(mappedId&&current?.valid&&!current.strongConflict)return{produkt:current.produkt,match:String(rec?.operator||"").startsWith("auto-order:")?String(rec.operator).replace("auto-order:",""):current.reason||"zweryfikowane mapowanie",confidence:Number(current.score||rec?.confidence||0),candidates};const available=candidates.filter(x=>!x.occupied.length),best=available[0],second=available[1],pewne=!blocked&&best&&best.valid&&best.score>=88&&(!second||best.score-second.score>=6);return {produkt:pewne?best.produkt:null,match:blocked?"automatyczne dopasowanie wyłączone ręcznie":mappedId?"obecne mapowanie jest sprzeczne z identyfikatorami":pewne?best.reason:"brak pewnego dopasowania",confidence:pewne?best.score:0,candidates,mappingConflict:!!mappedId&&!current?.valid};}

/* Kontrolowane decyzje dla grup zduplikowanych ofert Allegro. Moduł jest
   współdzielony przez katalog produktów i rejestr ofert. */
function allegroDopasowanieDuplikatuAktywne(d={}){const id=String(d.offer?.id||""),status=String(d.offer?.status||d.offer?.publication?.status||"").toUpperCase();return !["ENDED","ARCHIVED"].includes(status)&&allegroMapowania?.[id]?.blocked!==true;}
function allegroDuplikatOdswiezDecyzje(form){
  const choices=[...form.querySelectorAll('select[name="offerDecision"]')],keep=choices.filter(x=>x.value==="keep"),withdraw=choices.filter(x=>x.value==="withdraw"),extra=choices.filter(x=>x.value==="keep_extra"),review=choices.filter(x=>x.value==="review");
  choices.forEach(select=>{const card=select.closest(".allegro-duplicate-option");if(card){card.dataset.decision=select.value;card.classList.toggle("is-keep",select.value==="keep");card.classList.toggle("is-withdraw",select.value==="withdraw");}});
  const summary=form.querySelector("[data-duplicate-decision-summary]");if(summary)summary.innerHTML=`<b>Plan decyzji:</b> 1 główna • ${withdraw.length} do wycofania • ${extra.length} pozostaw dodatkowo • ${review.length} odłóż`;
  const button=form.querySelector('button[type="submit"]');if(button)button.disabled=keep.length!==1||withdraw.length===0;
}
function allegroDuplikatUstawDecyzje(select){
  const form=select?.form;if(!form)return;
  const choices=[...form.querySelectorAll('select[name="offerDecision"]')];
  if(select.value==="keep")choices.forEach(other=>{if(other!==select&&other.value==="keep")other.value="withdraw";});
  else if(!choices.some(other=>other.value==="keep")){select.value="keep";toast("W każdej grupie jedna oferta musi pozostać ofertą główną");}
  allegroDuplikatOdswiezDecyzje(form);
}
async function allegroRozstrzygnijDuplikaty(event,productId){
  event.preventDefault();const form=event.currentTarget,choices=[...form.querySelectorAll('select[name="offerDecision"]')],keepOfferId=String(choices.find(x=>x.value==="keep")?.dataset.offerId||""),withdrawOfferIds=choices.filter(x=>x.value==="withdraw").map(x=>String(x.dataset.offerId||"")).filter(id=>id&&id!==keepOfferId);
  if(!keepOfferId||!withdrawOfferIds.length){toast("Wskaż jedną ofertę pozostawianą i co najmniej jedną do wycofania");return;}
  const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{
    toast(`Wycofuję ${withdrawOfferIds.length} duplikat(y) i zachowuję ofertę ${keepOfferId}…`);
    const d=await chmura("allegro-resolve-duplicate",{method:"POST",body:{productId:String(productId),keepOfferId,withdrawOfferIds},timeout:120000});
    allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;allegroMapowania=d.mappings||allegroMapowania;
    produktyEdytowane[productId]={...(produktyEdytowane[productId]||{}),allegroOfferId:keepOfferId,allegroDuplicateResolvedAt:d.updated_at||new Date().toISOString()};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();allegroZapiszCache();toast(`✅ Pozostawiono ${keepOfferId}; wycofano ${withdrawOfferIds.length} ofert bez usuwania ich historii`);renderuj();
  }catch(e){toast("⚠️ Rozstrzyganie duplikatów: "+(e.message||e));if(button)button.disabled=false;}
}
function allegroCentrumDuplikatowHTML(audyt=allegroAudytDuplikatow(),options={}){
  if(!audyt.grupy.length)return `<div class="duplicate-audit-ok"><b>✅ Centrum duplikatów:</b> nie ma grup wymagających decyzji administratora.</div>`;
  const limit=Math.max(1,Number(options.maxGroups)||audyt.grupy.length),groups=audyt.grupy.slice(0,limit),remaining=Math.max(0,audyt.grupy.length-groups.length);
  return `<section class="allegro-duplicate-center ${options.compact?"is-catalog-context":""}"><div class="order-section-head"><div><span class="order-pro-label">Kontrolowane rozstrzygnięcie • decyzja dla każdej oferty</span><h3>🧭 Centrum duplikatów Allegro (${audyt.produkty})</h3><p class="order-detail-lead">Wskaż jedną ofertę główną. Każdą pozostałą możesz wycofać, pozostawić dodatkowo albo odłożyć do osobnego sprawdzenia. Zakończone zostaną wyłącznie pozycje oznaczone „Wycofaj”.</p></div>${options.compact?`<a class="btn ghost" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='duplikaty'">Pełny rejestr ofert</a>`:""}</div><div class="duplicate-decision-legend"><span class="keep">★ Oferta główna</span><span class="withdraw">■ Wycofaj duplikat</span><span>＋ Pozostaw dodatkowo</span><span>⏳ Odłóż decyzję</span></div><div class="allegro-duplicate-groups">${groups.map(({produkt,dopasowania})=>`<form class="allegro-duplicate-group" onsubmit="allegroRozstrzygnijDuplikaty(event,${jsArg(produkt.id)})"><header><div class="allegro-duplicate-product">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="">`:`<span>🎲</span>`}<div><b>${esc(produkt.nazwa||"Produkt")}</b><small>ID ${esc(produkt.id)} • EXTERNAL_ID ${esc(produkt.externalId||"—")} • SKU ${esc(produkt.sku||"—")} • EAN ${esc(produkt.gtin||produkt.ean||"—")}</small></div></div><span class="lvl lvl-blad">${dopasowania.length} aktywne oferty</span></header><div class="allegro-duplicate-options">${dopasowania.map((d,index)=>{const o=d.offer,id=String(o.id),status=String(o.status||o.publication?.status||"—").toUpperCase();return `<article class="allegro-duplicate-option ${index===0?"is-keep":""}" data-decision="${index===0?"keep":"withdraw"}"><div class="allegro-duplicate-offer">${o.mainImage?`<img src="${esc(o.mainImage)}" alt="" loading="lazy">`:`<span>🏷️</span>`}<div><b>${esc(o.name||"Oferta Allegro")}</b><small>ID ${esc(id)} • ${esc(o.priceText||"cena —")} • stan ${esc(o.stockAvailable??"—")} • sprzedano ${esc(o.stockSold??"—")} • ${esc(status)}</small><em>${index===0?"🤖 Rekomendacja Agenta • ":""}${esc(d.reason)} • pewność ${esc(d.score)}%</em></div></div><div class="allegro-duplicate-choice"><label><span>Decyzja dla tej oferty</span><select name="offerDecision" data-offer-id="${esc(id)}" onchange="allegroDuplikatUstawDecyzje(this)"><option value="keep" ${index===0?"selected":""}>★ Pozostaw jako główną</option><option value="withdraw" ${index===0?"":"selected"}>■ Wycofaj jako duplikat</option><option value="keep_extra">＋ Pozostaw dodatkowo aktywną</option><option value="review">⏳ Nie rozstrzygaj teraz</option></select></label><a href="https://allegro.pl/oferta/${encodeURIComponent(id)}" target="_blank" rel="noopener">Porównaj na Allegro ↗</a></div></article>`;}).join("")}</div><footer><span data-duplicate-decision-summary><b>Plan decyzji:</b> 1 główna • ${Math.max(0,dopasowania.length-1)} do wycofania • 0 pozostaw dodatkowo • 0 odłóż</span><button class="btn danger" type="submit">Zatwierdź i wycofaj wybrane</button></footer></form>`).join("")}</div>${remaining?`<div class="backend-note"><b>Pozostało ${remaining} grup.</b> Otwórz pełny rejestr ofert, aby rozstrzygnąć wszystkie.</div>`:""}</section>`;
}

/* Informacyjna lokalizacja pozycji zamówień sklepu i Allegro. Brak lokalizacji nigdy nie blokuje realizacji. */
function magazynLokalizacjaStatusHTML(kod="",brakOpis="Informacja dla magazynu — nie blokuje obsługi"){
  const value=String(kod||"").trim();
  return value?`<span class="warehouse-order-location is-set"><b>📍 ${esc(sciezkaNazwLokalizacjiMagazynu(value)||nazwaLokalizacjiMagazynu(value))}</b><small>${esc(value)}</small></span>`:`<span class="warehouse-order-location is-missing"><b>📍 Brak lokalizacji</b><small>${esc(brakOpis)}</small></span>`;
}
function allegroLokalizacjaPozycjiHTML(p={}){
  const kod=String(p.lokalizacja||p.produkt&&magazynMetaProduktu(p.produkt.id).lokalizacja||"").trim();
  return magazynLokalizacjaStatusHTML(kod);
}
function adminKluczPozycjiMagazynowej(value=""){
  const raw=String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  return /^\d+$/.test(raw)?raw.replace(/^0+(?=\d)/,""):raw;
}
function adminProduktDlaPozycjiZamowienia(item={}){
  const katalog=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),direct=[item.produktId,item.productId,item.id].map(v=>v===null||v===undefined?"":String(v)).filter(Boolean);
  let hit=katalog.find(p=>direct.includes(String(p.id)));if(hit)return hit;
  const codes=[item.ean,item.gtin,item.sku,item.externalId,item.kodProducenta,item.mpn,item.kod].map(adminKluczPozycjiMagazynowej).filter(Boolean);
  if(codes.length){hit=katalog.find(p=>[p.gtin,p.ean,p.sku,p.externalId,p.kodProducenta,p.mpn,p.kod].map(adminKluczPozycjiMagazynowej).some(code=>code&&codes.includes(code)));if(hit)return hit;}
  const name=String(item.nazwa||item.produkt||"").trim().toLowerCase().replace(/\s+/g," ");if(!name)return null;
  const matches=katalog.filter(p=>String(p.nazwa||"").trim().toLowerCase().replace(/\s+/g," ")===name);return matches.length===1?matches[0]:null;
}
function adminLokalizacjaPozycjiZamowieniaHTML(item={}){
  const produkt=adminProduktDlaPozycjiZamowienia(item),kod=produkt?String(magazynMetaProduktu(produkt.id).lokalizacja||"").trim():"";
  return magazynLokalizacjaStatusHTML(kod,produkt?"Informacja dla magazynu — nie blokuje obsługi":"Nie rozpoznano kartoteki produktu");
}

async function allegroMapujOferte(offerId,productId,options={}){
  try{
    const id=String(productId||"").trim(),manualDecision=id&&options.manualDecision!==false;
    const d=await chmura(id?"allegro-map-offer":"allegro-unmap-offer",{method:"POST",body:{offerId,productId:id,manualDecision,force:manualDecision||options.force===true},timeout:45000});
    allegroMapowania=d.mappings&&typeof d.mappings==="object"?d.mappings:allegroMapowania;
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;rezerwacjeMagazynowe._cache=null;
    let synchronizacja=null,bladSynchronizacji=null;
    if(id&&d.syncRequired!==false&&options.syncOffer!==false){
      const produkt=pobierzProduktAdmin(id)||produktyDoAdministracji().find(p=>String(p.id)===id);
      if(produkt)try{
        synchronizacja=await chmura("allegro-create-product-offer",{method:"POST",body:{product:{...produkt,allegroOfferId:String(offerId)},mappedOfferId:String(offerId),options:{publicationAction:"keep",preserveStock:true,syncReason:"manual-mapping"}},timeout:120000});
        allegroZapiszAutoUzupelnienia(produkt,synchronizacja);allegroZastosujWynikWystawienia(produkt,synchronizacja);
      }catch(e){bladSynchronizacji=e;}
    }
    if(id)await chmuraWczytajStan().catch(()=>{});allegroZapiszCache();
    toast(!id?"Powiązanie produktu zostało usunięte":bladSynchronizacji?`✅ Trwałe połączenie zapisane • ⚠️ Agent ponowi aktualizację Allegro: ${bladSynchronizacji.message||bladSynchronizacji}`:d.idempotent&&d.syncRequired===false?"✅ To powiązanie jest już zapisane i aktualne — niczego nie połączono ponownie":`✅ Ustawiono trwałe powiązanie • sklep jest źródłem danych${d.duplicateOfferIds?.length?` • ${d.duplicateOfferIds.length} pozostałych ofert oznaczono do decyzji`:""}`);
    renderuj();return {ok:true,data:d,synchronizacja,syncOk:!bladSynchronizacji,syncError:bladSynchronizacji};
  }catch(e){allegroMapowaniePozycjiCel={...allegroMapowaniePozycjiCel,error:e};toast("⚠️ Mapowanie Allegro: "+(e.message||e));return {ok:false,error:e};}
}

async function zapiszTelegramDostepKonta(email,button){
  if(!jestAdmin())return toast("Brak uprawnień");
  const e=String(email||"").trim().toLowerCase(),u=pobierzUzytkownikow(),k=u.find(x=>String(x.email||"").toLowerCase()===e),row=button?.closest("tr");
  if(!k||!row)return toast("Nie znaleziono konta");
  if(!kontoMaRoleAdmin(k.email))return toast("Dostęp do czatu można przypisać tylko kontu administratora");
  const id=String(row.querySelector("[data-telegram-user-id]")?.value||"").trim();
  const access=!!row.querySelector("[data-telegram-access]")?.checked;
  const approver=!!row.querySelector("[data-telegram-approver]")?.checked;
  if(id&&!/^[1-9]\d*$/.test(id))return toast("ID użytkownika Telegram musi składać się wyłącznie z cyfr i nie może zaczynać się od zera");
  if((access||approver)&&!id)return toast("Najpierw wpisz ID użytkownika Telegram");
  const previous={telegramUserId:k.telegramUserId||"",telegramAccess:k.telegramAccess===true,telegramApprover:k.telegramApprover===true};
  k.telegramUserId=id;k.telegramAccess=access&&!!id;k.telegramApprover=approver&&k.telegramAccess;
  zapiszLS("artway_uzytkownicy",u);button.disabled=true;
  const saved=await zapiszUzytkownikaCentralnie(k);
  if(!saved){Object.assign(k,previous);zapiszLS("artway_uzytkownicy",u);toast("Nie udało się zapisać dostępu Telegram na serwerze");renderuj();return;}
  loguj("info",`${k.telegramAccess?"Nadano":"Odebrano"} dostęp do wspólnego czatu: ${e}`);
  toast(k.telegramAccess?"Dostęp do wspólnego czatu został przypisany automatycznie":"Dostęp do wspólnego czatu został odebrany");
  renderuj();
}

function telegramDostepKontaHTML(k,admin){
  if(!admin)return `<small>Najpierw nadaj rolę administratora</small>`;
  return `<div class="account-telegram-access"><input data-telegram-user-id inputmode="numeric" autocomplete="off" placeholder="ID użytkownika" aria-label="ID użytkownika Telegram" value="${esc(k.telegramUserId||"")}"><label><input data-telegram-access type="checkbox" ${k.telegramAccess===true?"checked":""}> wspólny czat</label><label><input data-telegram-approver type="checkbox" ${k.telegramApprover===true?"checked":""}> zatwierdzanie</label><button class="btn ghost" type="button" onclick="zapiszTelegramDostepKonta(${jsArg(k.email)},this)">Zapisz</button></div>`;
}

function panelUstawienBramki(){
  const u=ustawieniaWysylki(),ip=stanBramki.inpost||{},ipGotowy=!!ip.configured,ipPolaczony=!!ip.authenticated,ipMapa=!!ip.geowidgetConfigured,ipWebhook=!!ip.webhookConfigured,av=ip.serviceAvailability||{};
  const braki=Array.isArray(ip.missingEnv)&&ip.missingEnv.length?ip.missingEnv:[...(ipGotowy?[]:["INPOST_TOKEN","INPOST_ORG_ID"])],orgInfo=ip.organization?.id?`Organizacja: <b>${esc(ip.organization.id)}</b>${ip.organization.name?` • ${esc(ip.organization.name)}`:""}`:"Organizacja pojawi się po teście API.";
  const uslugiInfo=av.services?.length?`<br>Paczkomat <code>${esc(av.lockerService||"inpost_locker_standard")}</code>: <b>${av.locker?"aktywny ✅":"nieaktywny"}</b> • Kurier <code>${esc(av.courierService||"inpost_courier_standard")}</code>: <b>${av.courier?"aktywny ✅":"nieaktywny"}</b>`:"";
  return `<div class="panel"><h1>⚙️ Trwałe integracje wysyłki i poczty</h1>
    <div class="integration-hub" style="border:2px solid ${ipPolaczony?'#86efac':'#fcd34d'};background:${ipPolaczony?'#f0fdf4':'#fffbeb'}"><div class="integration-hub-status"><span><b>🟡 InPost ShipX — serwer sklepu</b><br><small>Połączenie serwerowe bez tokenów w przeglądarce.</small></span><span class="integration-state">${ipPolaczony?`połączony • ${esc(ip.env||'production')}`:ipGotowy?"zapisany • sprawdź połączenie":`brakuje: ${esc(braki.join(", "))}`}</span></div>
      <p class="ship-meta">ShipX: <b>${ipPolaczony?"połączony ✅":"sprawdź"}</b> • Mapa: <b>${ipMapa?"aktywna ✅":"nieaktywna"}</b> • Webhook: <b>${ipWebhook?"aktywny ✅":"nieaktywny"}</b>${ip.lastCheckedAt?` • Test: <b>${esc(new Date(ip.lastCheckedAt).toLocaleString("pl-PL"))}</b>`:""}<br>${orgInfo}${uslugiInfo}</p>
      <div class="diag-actions"><button class="btn ghost" onclick="sprawdzBramke()">🔎 Stan serwera</button><button class="btn" style="background:#ffcc00;color:#111" onclick="testujInPost()">🟡 Sprawdź InPost</button><button class="btn" onclick="sprawdzPolaczeniaSerwerowe()">🩺 Sprawdź oba</button></div>
      ${stanBramki.error?`<div class="backend-note" style="color:#991b1b"><b>Błąd:</b> ${esc(stanBramki.error)}</div>`:""}<div class="backend-note"><b>Bezpiecznie:</b> sekrety pozostają na VPS i działają po restarcie. Panel widzi tylko stan połączenia.</div></div>
    <div class="integration-card" style="margin-top:1rem"><b>📧 Automatyczne e-maile</b><span class="integration-state">${stanBramki.email?.authenticated?`${esc(stanBramki.email.provider||"SMTP")} połączony ✅`:stanBramki.email?.credentialIssue==="masked_placeholder"?"Zapisano maskę zamiast hasła":stanBramki.email?.configured?"Zapisany — wymaga testu":"Brak prawidłowego poświadczenia"}</span><p class="ship-meta">Trwałe połączenie VPS, bez tokenu w panelu.${stanBramki.email?.lastCheckedAt?` Test: <b>${esc(new Date(stanBramki.email.lastCheckedAt).toLocaleString("pl-PL"))}</b>.`:""}${stanBramki.email?.lastError?`<br><span style="color:var(--danger)">${esc(stanBramki.email.lastError)}</span>`:""}</p><button class="btn ghost" type="button" onclick="testujEmailPolaczenie()">📧 Sprawdź SMTP</button></div>
    <form onsubmit="zapiszUstawieniaWysylki(event)" style="margin-top:1rem"><div class="f-row"><div class="f-group"><label>Adres bramki</label><input name="apiEndpoint" value="${esc(u.apiEndpoint)}"></div><div class="f-group"><label>Tryb</label><select name="tryb"><option value="sandbox" ${u.tryb==="sandbox"?"selected":""}>Testowy</option><option value="production" ${u.tryb==="production"?"selected":""}>Produkcyjny</option></select></div></div><h2>InPost</h2><div class="integration-grid">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<div class="integration-card"><b>${esc(p.nazwa)}</b><span class="integration-state">${ipGotowy?"ShipX gotowy":"wymaga konfiguracji"}</span><p class="ship-meta">Paczkomat + Kurier • etykiety A6/A4 • tracking • webhook</p></div>`).join("")}</div>
      <h2>Dane nadawcy i paczki</h2><div class="f-row"><div class="f-group"><label>Przewoźnik</label><select name="przewoznik">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<option value="${id}" selected>${esc(p.nazwa)}</option>`).join("")}</select></div><div class="f-group"><label>Nadawca</label><input name="nadawca" value="${esc(u.nadawca)}"></div></div><div class="f-row"><div class="f-group"><label>Ulica i numer</label><input name="ulica" value="${esc(u.ulica)}"></div><div class="f-group"><label>Kod pocztowy</label><input name="kod" value="${esc(u.kod)}"></div><div class="f-group"><label>Miasto</label><input name="miasto" value="${esc(u.miasto)}"></div></div><div class="f-row"><div class="f-group"><label>Telefon</label><input name="telefon" value="${esc(u.telefon)}"></div><div class="f-group"><label>E-mail</label><input type="email" name="email" value="${esc(u.email)}"></div></div><div class="f-row"><div class="f-group"><label>Waga (kg)</label><input type="number" step=".01" min=".01" name="waga" value="${esc(u.waga)}"></div><div class="f-group"><label>Długość (cm)</label><input type="number" min="1" name="dlugosc" value="${esc(u.dlugosc)}"></div><div class="f-group"><label>Szerokość (cm)</label><input type="number" min="1" name="szerokosc" value="${esc(u.szerokosc)}"></div><div class="f-group"><label>Wysokość (cm)</label><input type="number" min="1" name="wysokosc" value="${esc(u.wysokosc)}"></div></div><button class="btn" type="submit">💾 Zapisz dane nadawcy</button></form></div>`;
}

function klientZamowieniaLabel(z){
  const k=z?.klient||{};
  return [k.imie,k.nazwisko].filter(Boolean).join(" ") || z?.email || "gość";
}
function adminZamowienieSearchText(z){
  const k=z?.klient||{}, w=daneWysylki(z);
  return `${z?.nr||""} ${z?.email||""} ${k.imie||""} ${k.nazwisko||""} ${k.telefon||""} ${k.firma||""} ${z?.adres||""} ${z?.dostawa||""} ${z?.platnosc||""} ${w.numer||""} ${w.inpostId||""}`.toLowerCase();
}
function adminZamowieniaStatyHTML(wszystkie,zam){
  const sumaWidocznych=zam.reduce((s,z)=>s+kwotaNum(kosztyZamowienia(z).razem||z.razem),0);
  const nowe=wszystkie.filter(z=>z.status==="nowe").length;
  const realizacja=wszystkie.filter(z=>["potwierdzone","w realizacji","gotowe do wysyłki"].includes(z.status)).length;
  const bezNumeru=wszystkie.filter(z=>!["anulowane","zakończone","dostarczone"].includes(String(z.status||"").toLowerCase())&&!daneWysylki(z).numer).length;
  const maile=wszystkie.filter(z=>(daneWysylki(z).powiadomienia||[]).length).length;
  return `<div class="orders-stat-grid">
    <div class="order-stat-card hot"><span>🆕</span><b>${nowe}</b><small>nowe zamówienia</small></div>
    <div class="order-stat-card"><span>📦</span><b>${wszystkie.length}</b><small>wszystkie aktywne</small></div>
    <div class="order-stat-card"><span>⚙️</span><b>${realizacja}</b><small>w obsłudze</small></div>
    <div class="order-stat-card"><span>🏷️</span><b>${bezNumeru}</b><small>bez numeru nadania</small></div>
    <div class="order-stat-card"><span>✉️</span><b>${maile}</b><small>z historią e-maili</small></div>
    <div class="order-stat-card money"><span>💰</span><b>${zl(sumaWidocznych)}</b><small>suma widocznych</small></div>
  </div>`;
}
function adminStatusyZamowienHTML(wszystkie){
  const ile=s=>s==="wszystkie"?wszystkie.length:wszystkie.filter(z=>z.status===s).length;
  return `<div class="orders-status-strip">
    <button class="${filtrZamowien==="wszystkie"?"active":""}" onclick="filtrZamowien='wszystkie';renderuj()">Wszystkie <b>${ile("wszystkie")}</b></button>
    ${STATUSY.map(s=>`<button class="${filtrZamowien===s?"active":""}" onclick="filtrZamowien=${jsArg(s)};renderuj()">${esc(s)} <b>${ile(s)}</b></button>`).join("")}
  </div>`;
}
function adminPasujaceZamowieniaSklepu(){
  let lista=pobierzZamowienia().slice();
  if(filtrZamowien!=="wszystkie")lista=lista.filter(z=>z.status===filtrZamowien);
  if(szukajZamowien)lista=lista.filter(z=>adminZamowienieSearchText(z).includes(szukajZamowien));
  return lista;
}
function adminPrzelaczZaznaczenieZamowienia(nr,checked){
  const id=String(nr||"");if(!id)return;
  checked?zaznaczoneZamowieniaSklepu.add(id):zaznaczoneZamowieniaSklepu.delete(id);renderuj();
}
function adminZaznaczWidoczneZamowienia(checked=true){
  adminPasujaceZamowieniaSklepu().forEach(z=>checked?zaznaczoneZamowieniaSklepu.add(String(z.nr)):zaznaczoneZamowieniaSklepu.delete(String(z.nr)));renderuj();
}
function adminWyczyscZaznaczenieZamowien(){zaznaczoneZamowieniaSklepu.clear();renderuj();}
function adminEksportujZamowieniaZakres(zakres="filtr"){
  const selected=new Set([...zaznaczoneZamowieniaSklepu].map(String));
  const lista=adminPasujaceZamowieniaSklepu().filter(z=>zakres!=="zaznaczone"||selected.has(String(z.nr)));
  eksportujZamowienia(lista,zakres==="zaznaczone"?"zamowienia-zaznaczone.csv":"zamowienia-filtrowane.csv");
}
function zastosujStatusZamowieniaLokalnie(z,status){
  if(!z||!STATUSY.includes(status)||z.status===status)return null;
  const poprzedni=z.status;z.status=status;
  const w=daneWysylki(z);
  const mapaEtapow={"nowe":"do_obslugi","potwierdzone":"do_obslugi","w realizacji":"przygotowanie","gotowe do wysyłki":"przygotowanie","nadane":"transport","wysłane":"transport","w doręczeniu":"doreczenie","dostarczone":"dostarczona","zakończone":"dostarczona","zwrot":"zwrot","zwrot pieniędzy":"zwrot","anulowane":"anulowana"};
  if(mapaEtapow[status])w.etap=mapaEtapow[status];
  w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status:"Status zamówienia",opis:`${poprzedni} → ${status}`}];
  z.wysylka=w;return {z,poprzedni,status};
}
async function adminMasowoZmienStatusZamowien(){
  const status=String(document.getElementById("bulkOrderStatus")?.value||"");
  const wybrane=new Set([...zaznaczoneZamowieniaSklepu]);
  if(!wybrane.size){toast("Zaznacz co najmniej jedno zamówienie");return;}
  if(!STATUSY.includes(status)){toast("Wybierz nowy status zamówień");return;}
  const lista=pobierzZamowienia(),zmiany=[];
  for(const z of lista)if(wybrane.has(String(z.nr))){const wynik=zastosujStatusZamowieniaLokalnie(z,status);if(wynik)zmiany.push(wynik);}
  if(!zmiany.length){toast("Wybrane zamówienia mają już ten status");return;}
  zapiszLS("artway_zamowienia",lista);zaznaczoneZamowieniaSklepu.clear();
  loguj("info",`Masowa zmiana statusu ${zmiany.length} zamówień → ${status}`);renderuj();
  toast(`Zmieniam status ${zmiany.length} zamówień → ${status}…`);
  let bledy=0;
  for(let i=0;i<zmiany.length;i+=5){
    const wyniki=await Promise.allSettled(zmiany.slice(i,i+5).map(async x=>{const d=await zapiszZamowienieCentralnie(x.z,false);if(!d)await obsluzAutomatycznyEmail(x.z.nr,status);return d;}));
    bledy+=wyniki.filter(x=>x.status==="rejected").length;
  }
  toast(`✅ Zmieniono ${zmiany.length} zamówień na „${status}”${bledy?` • błędy synchronizacji: ${bledy}`:""}`);
}
const ALLEGRO_TRWALY_CACHE_KEY="allegro-offers-and-mappings-v2";
const ALLEGRO_TRWALY_CACHE_MAX_AGE_MS=7*24*60*60*1000;
let allegroTrwalyCacheOdtworzony=false,allegroTrwalyCachePromise=null,allegroTrwalyCacheTimer=null;
function allegroZapiszCache(){
  for(const klucz of ["artway_allegro_zamowienia_cache","artway_allegro_oferty_cache","artway_allegro_mapowania_cache","artway_allegro_komunikacja_cache"]){
    try{localStorage.removeItem(klucz);}catch(e){}
  }
  if(typeof chmuraRuntimeCacheZapisz!=="function"||typeof jestAdmin!=="function"||!jestAdmin())return;
  clearTimeout(allegroTrwalyCacheTimer);allegroTrwalyCacheTimer=setTimeout(()=>{
    const safeState={configured:!!allegroStan.configured,connected:!!allegroStan.connected,env:allegroStan.env||"production",offerDefaultsAudit:allegroStan.offerDefaultsAudit||{},catalogMaintenance:allegroStan.catalogMaintenance||{},complianceAudit:allegroStan.complianceAudit||{},offerSyncState:allegroStan.offerSyncState||{},offerSettings:allegroStan.offerSettings||{}};
    void chmuraRuntimeCacheZapisz(ALLEGRO_TRWALY_CACHE_KEY,{schema:2,savedAt:Date.now(),offers:Array.isArray(allegroOferty)?allegroOferty:[],mappings:allegroMapowania&&typeof allegroMapowania==="object"?allegroMapowania:{},summary:allegroPodsumowanie||{},allegro:safeState});
  },350);
}
async function allegroOdtworzTrwalyCache(){
  if(allegroTrwalyCacheOdtworzony)return false;
  if(allegroTrwalyCachePromise)return allegroTrwalyCachePromise;
  allegroTrwalyCachePromise=(async()=>{
    try{
      if(typeof chmuraRuntimeCacheOdczytaj!=="function"||typeof jestAdmin!=="function"||!jestAdmin())return false;
      const cache=await chmuraRuntimeCacheOdczytaj(ALLEGRO_TRWALY_CACHE_KEY),savedAt=Number(cache?.savedAt)||0;
      if(!cache||cache.schema!==2||!savedAt||Date.now()-savedAt>ALLEGRO_TRWALY_CACHE_MAX_AGE_MS)return false;
      if(Array.isArray(cache.offers))allegroOferty=cache.offers;
      if(cache.mappings&&typeof cache.mappings==="object")allegroMapowania=cache.mappings;
      if(cache.summary&&typeof cache.summary==="object")allegroPodsumowanie={...allegroPodsumowanie,...cache.summary};
      if(cache.allegro&&typeof cache.allegro==="object")allegroStan={...allegroStan,...cache.allegro,sprawdzono:true,error:"",cacheSavedAt:savedAt};
      allegroDaneZaladowane={...allegroDaneZaladowane,summary:true,offers:true,config:true};
      ["summary","offers","config"].forEach(scope=>allegroDaneOdczytAt[scope]=savedAt);return true;
    }catch(error){return false;}
    finally{allegroTrwalyCacheOdtworzony=true;allegroTrwalyCachePromise=null;}
  })();
  return allegroTrwalyCachePromise;
}
function allegroProduktIdDlaOferty(offerId){
  const rec=(allegroMapowania||{})[String(offerId)];
  if(rec && typeof rec==="object") return rec.productId || (rec.withdrawnAt?rec.previousProductId:"") || rec.produktId || rec.id || "";
  return rec || "";
}
function allegroProduktDlaOferty(offerId){
  const id=allegroProduktIdDlaOferty(offerId);
  if(!id) return null;
  return pobierzProduktAdmin(id) || produktyDoAdministracji().find(p=>String(p.id)===String(id)) || null;
}
function allegroKodProduktu(p){
  return String(p?.sku||p?.kod||p?.externalId||p?.gtin||p?.id||"").trim();
}
function allegroEANProduktu(p){
  return String(p?.gtin||p?.ean||p?.kodKreskowy||"").trim();
}
function allegroKodOferty(o){
  return String(o?.externalId||o?.id||"").trim();
}
async function allegroAutomapujOfertyLegacy(){
  const sugestie=allegroSugestieAutomapowania();
  if(!sugestie.length){ toast("Brak pewnych dopasowań po kodach lub nazwach Allegro"); return; }
  if(!confirm(`Automatycznie podpiąć ${sugestie.length} ofert Allegro po pewnych kodach/nazwach do produktów sklepu?`)) return;
  let ok=0, bledy=0, ostatnie=null;
  toast(`Mapuję oferty Allegro: ${sugestie.length}…`);
  for(const s of sugestie){
    try{
      ostatnie=await chmura("allegro-map-offer",{method:"POST",body:{offerId:s.offerId,productId:s.productId},timeout:12000});
      ok++;
    }catch(e){ bledy++; }
  }
  if(ostatnie?.mappings&&typeof ostatnie.mappings==="object") allegroMapowania=ostatnie.mappings;
  await allegroWczytajDane(true);
  allegroZapiszCache();
  toast(`Automapowanie Allegro: podpięto ${ok}${bledy?`, błędy: ${bledy}`:""}`);
  renderuj();
}
function allegroStatusHTML(){
  if(!allegroStan.sprawdzono && allegroStan.ladowanie) return `<span class="lvl lvl-info">sprawdzam API</span>`;
  if(allegroStan.credentialsRedacted) return `<span class="lvl lvl-bad">zapisano maskę zamiast danych</span>`;
  if(allegroStan.credentialsInvalid) return `<span class="lvl lvl-bad">błędne dane aplikacji</span>`;
  if(allegroStan.authError) return `<span class="lvl lvl-bad">połączenie wymaga naprawy</span>`;
  if(allegroStan.connected&&allegroStan.requiresReauth) return `<span class="lvl lvl-ostrzezenie">połączone — brak części uprawnień</span>`;
  if(allegroStan.connected) return `<span class="lvl lvl-ok">połączone</span>`;
  if(allegroStan.configured) return `<span class="lvl lvl-ostrzezenie">wymaga autoryzacji</span>`;
  return `<span class="lvl lvl-bad">brak konfiguracji</span>`;
}
function allegroZakresDanych(scope="summary"){return ["summary","orders","offers","config","all"].includes(String(scope||""))?String(scope):"summary";}
const ALLEGRO_DANE_TTL_MS=15*60*1000;
function allegroZakresZaladowany(zakres="summary"){
  return zakres==="all"?!!(allegroDaneZaladowane.orders&&allegroDaneZaladowane.offers&&allegroDaneZaladowane.config):!!allegroDaneZaladowane[zakres];
}
function allegroWersjaSerwerowaZakresu(zakres="summary"){
  const orders=allegroPodsumowanie.orders||{},offers=allegroPodsumowanie.offers||{},communication=allegroKomunikacja||{},statusCounts=orders.statusCounts||{};
  const orderVersion=`${orders.updated_at||""}:${orders.live||0}:${orders.active||0}:${Object.entries(statusCounts).sort().map(([k,v])=>`${k}=${v}`).join(",")}`;
  const offerVersion=`${offers.updated_at||""}:${offers.count||0}:${offers.mapped||0}`;
  const configVersion=`${allegroStan.offerSettings?.updated_at||""}:${allegroStan.offerSyncState?.lastLightSyncAt||""}:${allegroStan.offerSyncState?.lastFullSyncAt||""}`;
  if(zakres==="orders")return orderVersion;
  if(zakres==="offers")return offerVersion;
  if(zakres==="config")return configVersion;
  return `${orderVersion}|${offerVersion}|${communication.updated_at||""}|${configVersion}`;
}
function allegroLadujJesliTrzeba(scope="summary"){
  if(!allegroTrwalyCacheOdtworzony){const requested=scope;void allegroOdtworzTrwalyCache().then(restored=>{if(restored)renderuj();allegroLadujJesliTrzeba(requested);});return;}
  const zakres=allegroZakresDanych(scope),zaladowany=allegroZakresZaladowany(zakres),ostatni=zakres==="all"?Math.min(...["orders","offers","config"].map(k=>Number(allegroDaneOdczytAt[k]||0))):Number(allegroDaneOdczytAt[zakres]||0);
  if(allegroDaneObietnice.has(zakres)||allegroDaneLadowane.has(zakres)||(zaladowany&&Date.now()-ostatni<ALLEGRO_DANE_TTL_MS))return;
  if(!zaladowany)allegroStan={...allegroStan,ladowanie:true};
  setTimeout(()=>allegroWczytajDane(true,true,zakres),0);
}
async function allegroWczytajDane(cicho=false,odswiezWidok=true,scope="all"){
  const zakres=allegroZakresDanych(scope),istniejaca=allegroDaneObietnice.get(zakres);
  if(istniejaca){const wynik=await istniejaca;if(odswiezWidok&&wynik.changed)renderuj();return wynik.ok;}
  const byloZaladowane=allegroZakresZaladowany(zakres),przed=allegroWersjaSerwerowaZakresu(zakres);
  const zadanie=(async()=>{
    allegroDaneLadowane.add(zakres);allegroStan={...allegroStan,ladowanie:true};
    try{
      const d=await chmura("allegro-data",{params:{scope:zakres},timeout:20000});
      allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,error:"",offerDefaultsAudit:d.offerDefaultsAudit||allegroStan.offerDefaultsAudit||{items:{},updated_at:null},catalogMaintenance:d.catalogMaintenance||allegroStan.catalogMaintenance||{cursor:0,lastRun:null},complianceAudit:d.complianceAudit||allegroStan.complianceAudit||{items:[],summary:{},updated_at:null},offerSyncState:d.offerSyncState||allegroStan.offerSyncState||{lastLightSyncAt:null,lastFullSyncAt:null,nextLightSyncAt:null,nextFullSyncAt:null},offerSettings:d.offerSettings||allegroStan.offerSettings||{defaultStock:5,republish:true,producers:["Alexander","Multigra","GoDan"],autoCatalog:true,syncDescriptions:true,autoUpdateOffers:true,autoFees:true,autoCorrections:true,autoMapping:true,mappingMinScore:88,lightSyncMinutes:15,fullSyncHours:6,autonomousAgent:true,autonomousAgentMinutes:15,autoResolveDuplicates:true,autoResolveDuplicateMinScore:97,updated_at:null}};
      if(Array.isArray(d.orders))allegroZamowienia=d.orders;
      if(Array.isArray(d.offers))allegroOferty=d.offers;
      if(d.mappings&&typeof d.mappings==="object")allegroMapowania=d.mappings;
      if(d.summary&&typeof d.summary==="object")allegroPodsumowanie={...allegroPodsumowanie,...d.summary};
      if(d.archive&&typeof d.archive==="object")allegroArchiwum={...allegroArchiwum,summary:{...allegroArchiwum.summary,...d.archive}};
      allegroDaneZaladowane.summary=true;
      const odczyt=Date.now();
      if(zakres==="all"){allegroDaneZaladowane={summary:true,orders:true,offers:true,config:true};["summary","orders","offers","config"].forEach(k=>allegroDaneOdczytAt[k]=odczyt);}
      else{allegroDaneZaladowane[zakres]=true;allegroDaneOdczytAt[zakres]=odczyt;allegroDaneOdczytAt.summary=odczyt;}
      if(d.offerLastError) allegroOstatniBladWystawienia={message:d.offerLastError.message,allegroError:{errors:d.offerLastError.errors||[]},...d.offerLastError};
      if(Array.isArray(d.threads)||Array.isArray(d.issues)) allegroKomunikacja={...allegroKomunikacja,threads:Array.isArray(d.threads)?d.threads:allegroKomunikacja.threads,issues:Array.isArray(d.issues)?d.issues:allegroKomunikacja.issues,settings:d.settings||allegroKomunikacja.settings,autoReplies:d.autoReplies||allegroKomunikacja.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:allegroKomunikacja.errors,requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||allegroKomunikacja.updated_at,sprawdzono:true};
      allegroZapiszCache();
      if(location.hash==="#/admin/allegro/oferty"&&allegroStan.offerSettings?.autoMapping!==false)setTimeout(()=>allegroUruchomAutomatyczneMapowanie(true),0);
      if(!cicho)toast("Dane Allegro odświeżone");
      const changed=!byloZaladowane||przed!==allegroWersjaSerwerowaZakresu(zakres);
      if(changed&&typeof uniewaznijCachePodstronAdmina==="function")uniewaznijCachePodstronAdmina("allegro");
      return {ok:true,changed};
    }catch(e){
      allegroStan={...allegroStan,sprawdzono:true,error:e.message||String(e)};
      if(!cicho)toast("⚠️ Allegro: "+allegroStan.error);
      return {ok:false,changed:false};
    }finally{
      allegroDaneLadowane.delete(zakres);allegroStan={...allegroStan,ladowanie:allegroDaneLadowane.size>0};
    }
  })();
  allegroDaneObietnice.set(zakres,zadanie);
  try{const wynik=await zadanie;if(odswiezWidok&&wynik.changed)renderuj();return wynik.ok;}
  finally{if(allegroDaneObietnice.get(zakres)===zadanie)allegroDaneObietnice.delete(zakres);}
}
async function allegroPolacz(){
  if(allegroStan.credentialsRedacted){location.hash="#/admin/allegro/ustawienia";toast("Najpierw wpisz pełny Client ID i Client Secret w bezpiecznym sejfie Allegro");return;}
  try{
    const d=await chmura("allegro-auth-url",{timeout:12000});
    if(!d.url) throw new Error("Serwer nie zwrócił linku autoryzacji Allegro");
    location.href=d.url;
  }catch(e){ toast("⚠️ Allegro: "+(e.message||e)); }
}
async function allegroSynchronizujZamowienia(){
  try{
    toast("Pobieram zamówienia Allegro i uruchamiam kontrolę magazynową agenta…");
    await chmuraZapiszUstawienia().catch(()=>false);
    const d=await chmura("allegro-sync-orders",{method:"POST",body:{limit:200},timeout:120000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    if(d.archive&&typeof d.archive==="object")allegroArchiwum={...allegroArchiwum,summary:{...allegroArchiwum.summary,...d.archive}};
    const odczyt=Date.now();allegroDaneZaladowane.orders=true;allegroDaneZaladowane.summary=true;allegroDaneOdczytAt.orders=odczyt;allegroDaneOdczytAt.summary=odczyt;allegroAktualizujPodsumowanieZamowien(d.updated_at,d.archive);
    await chmuraWczytajStan();
    allegroZapiszCache();
    toast(`Agent Allegro: nowe ${d.imported_new||0} • odświeżone ${d.refreshed||0} • do obsługi ${allegroZamowienia.filter(allegroZamowienieAktywneLokalnie).length} • archiwum ${d.archive?.total||0}`);
    renderuj();
  }catch(e){ toast("⚠️ Allegro zamówienia: "+(e.message||e)); }
}
async function allegroOznaczZamowienieSprawdzone(orderId,checked=true){
  try{
    const orderIds=Array.isArray(orderId)?orderId:[orderId];
    const d=await chmura("allegro-order-checked",{method:"POST",body:{orderIds,checked},timeout:30000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia.map(z=>String(z.id)===String(orderId)?d.order:z);
    allegroAktualizujPodsumowanieZamowien(d.updated_at);
    orderIds.forEach(id=>zaznaczoneAllegroZamowienia.delete(String(id)));
    allegroZapiszCache();
    toast(checked?`Oznaczono jako sprawdzone: ${d.changed||orderIds.length} zleceń.`:`Przywrócono do obsługi: ${d.changed||orderIds.length} zleceń.`);
    renderuj();
  }catch(e){ toast("⚠️ Status obsługi Allegro: "+(e.message||e)); }
}
function allegroPrzelaczZaznaczenieZamowienia(orderId,checked){
  const id=String(orderId||"");
  if(!id)return;
  if(checked)zaznaczoneAllegroZamowienia.add(id);else zaznaczoneAllegroZamowienia.delete(id);
  renderuj();
}
function allegroWyczyscZaznaczenieZamowien(){
  zaznaczoneAllegroZamowienia.clear();
  renderuj();
}
function allegroEksportujZamowienia(zakres="filtr"){
  const selected=new Set([...zaznaczoneAllegroZamowienia].map(String));
  const lista=allegroPasujaceZamowienia().filter(z=>zakres!=="zaznaczone"||selected.has(String(z.id)));
  const rows=lista.map(z=>[z.id||z.nr||"",allegroStatusKolejki(z),z.email||"",z.buyerLogin||"",z.buyerName||"",z.phone||"",z.createdAt||z.data||"",z.warehouseStage||"",(z.lineItems||[]).map(it=>`${it.offerId||""} | ${it.offerName||it.name||""} | ${it.quantity||0} szt.`).join(" || ")]);
  adminEksportujCSV(zakres==="zaznaczone"?"allegro-zamowienia-zaznaczone.csv":"allegro-zamowienia-filtrowane.csv",["id_zlecenia","status_allegro","email","login","klient","telefon","data","etap_magazynu","pozycje"],rows);
}
function allegroOznaczZaznaczoneSprawdzone(checked=true){
  const ids=[...zaznaczoneAllegroZamowienia];
  if(!ids.length){toast("Zaznacz co najmniej jedno zlecenie");return;}
  allegroOznaczZamowienieSprawdzone(ids,checked);
}
async function allegroZmienStatusRealizacji(orderId,status){
  try{
    const d=await chmura("allegro-order-fulfillment",{method:"POST",body:{orderId,status},timeout:18000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia.map(z=>String(z.id)===String(orderId)?d.order:z);
    allegroAktualizujPodsumowanieZamowien(d.updated_at);
    allegroZapiszCache();
    toast(`Status zamówienia zmieniony w Allegro: ${status}`);
    renderuj();
  }catch(e){ toast("⚠️ Zmiana statusu Allegro: "+(e.message||e)); }
}
async function allegroSynchronizujOferty(){
  try{
    toast("Pobieram wszystkie oferty Allegro — kolejne strony po 1000…");
    const d=await chmura("allegro-sync-offers",{method:"POST",body:{limit:10000,details:true,detailsLimit:1000},timeout:180000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    const odczyt=Date.now();allegroDaneZaladowane.offers=true;allegroDaneZaladowane.summary=true;allegroDaneOdczytAt.offers=odczyt;allegroDaneOdczytAt.summary=odczyt;allegroPodsumowanie.offers={...(allegroPodsumowanie.offers||{}),count:allegroOferty.length,mapped:Object.values(allegroMapowania||{}).filter(x=>x?.productId&&x?.blocked!==true).length,updated_at:d.updated_at||new Date().toISOString()};
    await chmuraWczytajStan().catch(()=>{});
    allegroZapiszCache();
    toast(`Pobrano oferty Allegro: ${allegroOferty.length} • szczegóły: ${d.detailedCount||0} • nowe automatyczne powiązania: ${d.autoMapped||0}`);
    renderuj();
  }catch(e){ toast("⚠️ Allegro oferty: "+(e.message||e)); }
}
function allegroUstawieniaKomunikacjiDomyslne(){
  return {
    enabled:true,
    messageCenter:true,
    issues:true,
    freshHours:48,
    template:"Dzień dobry,\n\ndziękujemy za wiadomość. Potwierdzamy, że zgłoszenie trafiło do obsługi Artway-TM. Odpowiemy możliwie jak najszybciej.\n\nPozdrawiamy\nArtway-TM"
  };
}
function allegroKomunikacjaUstawienia(){
  return {...allegroUstawieniaKomunikacjiDomyslne(), ...(allegroKomunikacja?.settings||{})};
}
async function allegroWczytajKomunikacje(cicho=false){
  try{
    const d=await chmura("allegro-communications-data",{timeout:16000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroKomunikacja={threads:Array.isArray(d.threads)?d.threads:[],issues:Array.isArray(d.issues)?d.issues:[],settings:d.settings||allegroUstawieniaKomunikacjiDomyslne(),autoReplies:d.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:[],requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||null,lastSyncSummary:d.lastSyncSummary||null,autoRepliesUpdatedAt:d.autoRepliesUpdatedAt||null,sprawdzono:true};
    allegroZapiszCache();
    if(!cicho) toast("Wczytano komunikację Allegro");
  }catch(e){ allegroStan={...allegroStan,error:e.message||String(e)};allegroKomunikacja={...allegroKomunikacja,sprawdzono:true}; if(!cicho) toast("⚠️ Komunikacja Allegro: "+(e.message||e)); }
  renderuj();
}
async function allegroSynchronizujKomunikacje(autoReply=true){
  try{
    toast(autoReply?"Synchronizuję Allegro i wysyłam brakujące pierwsze odpowiedzi…":"Synchronizuję komunikację Allegro…");
    const d=await chmura("allegro-sync-communications",{method:"POST",body:{limit:100,autoReply},timeout:120000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroKomunikacja={threads:Array.isArray(d.threads)?d.threads:[],issues:Array.isArray(d.issues)?d.issues:[],settings:d.settings||allegroKomunikacjaUstawienia(),autoReplies:d.autoReply?.items||allegroKomunikacja.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:[],requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||null,lastSyncSummary:d.syncSummary||d.lastSyncSummary||null,autoReply:d.autoReply||null,sprawdzono:true};
    allegroZapiszCache();
    const summary=d.syncSummary||{},newCount=Number(summary.newBuyerMessages||0),sent=Number(d.autoReply?.sent?.length||0);
    toast(newCount?`Allegro: ${newCount} ${newCount===1?"nowa wiadomość klienta":"nowych wiadomości klientów"} • wątki ${summary.newThreads||0} • dyskusje ${summary.newIssues||0}${sent?` • pierwsze odpowiedzi ${sent}`:""}`:`Allegro: brak nowych wiadomości klientów${sent?` • pierwsze odpowiedzi ${sent}`:""}`);
  }catch(e){ toast("⚠️ Synchronizacja komunikacji Allegro: "+(e.message||e)); }
  renderuj();
}
async function allegroSynchronizujWszystko(){
  try{
    toast("Uruchamiam pełną synchronizację Allegro…");
    await allegroSynchronizujZamowienia();
    await allegroSynchronizujOferty();
    await allegroSynchronizujKomunikacje(true);
    toast("Pełna synchronizacja Allegro zakończona ✅");
  }catch(e){toast("⚠️ Pełna synchronizacja Allegro: "+(e.message||e));}
}
async function allegroZapiszUstawieniaKomunikacji(form){
  const fd=new FormData(form);
  const settings={
    enabled:fd.get("enabled")==="on",
    messageCenter:fd.get("messageCenter")==="on",
    issues:fd.get("issues")==="on",
    telegramReminders:fd.get("telegramReminders")==="on",
    freshHours:Number(fd.get("freshHours")||48),
    template:String(fd.get("template")||"").trim()
  };
  try{
    const d=await chmura("allegro-communications-settings",{method:"POST",body:{settings},timeout:12000});
    allegroKomunikacja={...allegroKomunikacja,settings:d.settings||settings};
    allegroZapiszCache();
    toast("Zapisano ustawienia autorespondera Allegro");
    renderuj();
  }catch(e){ toast("⚠️ Ustawienia komunikacji Allegro: "+(e.message||e)); }
}
let allegroAutoMapowanieSerwera={busy:false,lastAttempt:0,lastMapped:0,error:""};
async function allegroUruchomAutomatyczneMapowanie(cicho=false){
  if(allegroAutoMapowanieSerwera.busy||allegroStan.offerSettings?.autoMapping===false)return false;
  const now=Date.now();if(cicho&&now-Number(allegroAutoMapowanieSerwera.lastAttempt||0)<5*60*1000)return false;
  allegroAutoMapowanieSerwera={...allegroAutoMapowanieSerwera,busy:true,lastAttempt:now,error:""};
  if(!cicho){toast("Agent łączy pewne, bezkolizyjne oferty z produktami sklepu…");renderuj();}
  try{
    const d=await chmura("allegro-auto-map-offers",{method:"POST",body:{source:cicho?"panel-auto":"admin"},timeout:180000});
    allegroMapowania=d.mappings&&typeof d.mappings==="object"?d.mappings:allegroMapowania;
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    allegroAutoMapowanieSerwera={busy:false,lastAttempt:now,lastMapped:Number(d.autoMapped)||0,error:""};
    allegroZapiszCache();
    if(d.autoMapped||d.quarantined||!cicho){toast(`✅ Automatyczne mapowanie: połączono ${d.autoMapped||0}${d.quarantined?` • wstrzymano błędnych ${d.quarantined}`:""}`);renderuj();}
    return true;
  }catch(e){
    allegroAutoMapowanieSerwera={busy:false,lastAttempt:now,lastMapped:0,error:e.message||String(e)};
    if(!cicho)toast("⚠️ Automatyczne mapowanie Allegro: "+(e.message||e));
    renderuj();return false;
  }
}
async function allegroDodajProduktZOferty(offerId){
  const o=allegroOferty.find(x=>String(x.id)===String(offerId));
  if(!o){ toast("Nie znaleziono oferty Allegro"); return; }
  const maxId=Math.max(0,...prodBazowe.map(p=>Number(p.id)||0),...produktyDodane.map(p=>Number(p.id)||0));
  const id=maxId+1;
  const cena=kwotaNum(o.price?.amount ?? o.price ?? 0);
  const KOLORY=["#dbeafe","#e0e7ff","#fef3c7","#dcfce7","#fee2e2","#f3e8ff","#fce7f3","#ffedd5"];
  const p={
    id,
    nazwa:o.name||`Oferta Allegro ${o.id}`,
    kategoria:"Allegro",
    cena,
    opis:`Produkt utworzony z oferty Allegro ${o.id}. Uzupełnij opis, zdjęcia i kategorię docelową w Asortymencie.`,
    ikona:"🟠",
    badge:"Allegro",
    kolor:KOLORY[id%KOLORY.length],
    sku:String(o.externalId||o.id||"").trim(),
    externalId:String(o.externalId||o.id||"").trim(),
    gtin:String(o.gtin||o.ean||"").trim(),
    ean:String(o.ean||o.gtin||"").trim(),
    mpn:String(o.manufacturerCode||o.producerCode||"").trim(),
    kodProducenta:String(o.manufacturerCode||o.producerCode||"").trim(),
    producent:String(o.brand||"").trim(),
    marka:String(o.brand||"").trim(),
    zdjecie:o.mainImage||((o.images||[])[0])||"",
    zdjecia:(o.images||[]).slice(1,16),
    allegroOfferId:String(o.id||"").trim(),
    allegroCategoryId:String(o.categoryId||"").trim(),
    allegroProductId:String(o.productId||"").trim(),
    allegroShippingSubsidy:ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI,
    createdAt:new Date().toISOString(),
    createdBy:sesja?.email||"administrator",
    agentOnboardingStatus:"processing",
    agentOnboardingStartedAt:new Date().toISOString()
  };
  if(o.descriptionText) p.opis=o.descriptionText;
  const poprawiony=agentAIPoprawOpisyDanychProduktu(p);
  produktyDodane.push(poprawiony);
  zapiszLS("artway_produkty_dodane",produktyDodane);
  zbudujProdukty();
  await allegroMapujOferte(o.id,id,{syncOffer:false});
  const onboardingProduct=pobierzProduktAdmin(id)||poprawiony,onboardingState=agentAIStanWdrozeniaProduktu(onboardingProduct),onboardingStatus=onboardingState.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie produktu utworzonego z Allegro: ${poprawiony.nazwa}`,{produktId:id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  toast("Produkt utworzony z Allegro i podpięty");
}

function produktDlaAllegroZFormularza(form,id,poprzedni={}){
  const fd=new FormData(form);
  const dane=daneProduktuZFormularza(fd,id,poprzedni);
  if(!dane){ toast("⚠️ Uzupełnij nazwę i cenę"); return null; }
  return dane;
}
function produktRoboczyAllegroZFormularza(form,id,poprzedni={}){
  const fd=new FormData(form);
  const pelny=daneProduktuZFormularza(fd,id,poprzedni);
  if(pelny) return pelny;
  const cena=parseFloat(String(fd.get("cena")||poprzedni.cena||"0").replace(",","."));
  const cenaAllegro=parseFloat(String(fd.get("cenaAllegro")||poprzedni.cenaAllegro||"0").replace(",","."));
  const cenaZakupu=parseFloat(String(fd.get("cenaZakupu")||poprzedni.cenaZakupu||"0").replace(",","."));
  const p={...poprzedni,id,nazwa:String(fd.get("nazwa")||poprzedni.nazwa||"").trim(),kategoria:String(fd.get("kategoria")||poprzedni.kategoria||"").trim(),cena:Number.isFinite(cena)?cena:0,...(cenaAllegro>0?{cenaAllegro:+cenaAllegro.toFixed(2)}:{}),...(cenaZakupu>=0&&String(fd.get("cenaZakupu")||"").trim()?{cenaZakupu:+cenaZakupu.toFixed(2)}:{}),opisKrotki:String(fd.get("opisKrotki")||poprzedni.opisKrotki||"").trim(),opis:String(fd.get("opis")||poprzedni.opis||"").trim()};
  for(const [pole,nazwa] of [["gtin","gtin"],["ean","gtin"],["externalId","externalId"],["mpn","mpn"],["producent","producent"],["marka","marka"],["kodProducenta","kodProducenta"],["allegroCategoryId","allegroCategoryId"],["allegroProductId","allegroProductId"],["allegroOfferId","allegroOfferId"],["allegroCategoryPhrase","allegroCategoryPhrase"],["sourceUrl","sourceUrl"],["producentUrl","producentUrl"]]){
    const v=String(fd.get(nazwa)||poprzedni[pole]||"").trim();
    if(v)p[pole]=v;
  }
  const zdjecie=String(fd.get("zdjecie")||poprzedni.zdjecie||"").trim();
  if(zdjecie)p.zdjecie=zdjecie;
  const zdjecia=Array.from({length:15},(_,i)=>String(fd.get("zdjecie"+(i+2))||"").trim()).filter(Boolean);
  if(zdjecia.length)p.zdjecia=zdjecia;
  return p;
}
function allegroKategorieHTML(d){
  const selected=d?.selected||null;
  const suggestions=Array.isArray(d?.suggestions)?d.suggestions:[];
  if(!selected&&!suggestions.length&&!d?.errors?.length) return "";
  const row=(c,main=false)=>`<div class="allegro-category-row ${main?"main":""}">
    <div><b>${main?"✅ Dobrana kategoria: ":""}${esc(c.name||"—")}</b><br><small>ID: ${esc(c.id||"—")}${c.pathText?` • ${esc(c.pathText)}`:""}${c.leaf===false?" • niekońcowa":""}</small></div>
    <button class="btn ghost" type="button" onclick="allegroUstawKategorieWFormularzu(${jsArg(c.id)})">Wybierz</button>
  </div>`;
  return `<div class="backend-note allegro-category-box">
    ${selected?row(selected,true):`<b>Nie udało się automatycznie dobrać kategorii.</b>`}
    ${suggestions.length>1?`<details style="margin-top:.55rem"><summary>Inne pasujące kategorie (${suggestions.length})</summary>${suggestions.slice(0,10).map(c=>row(c,false)).join("")}</details>`:""}
    ${d?.errors?.length?`<small style="color:var(--muted2)">Część zapytań Allegro nie zwróciła danych: ${esc(d.errors.map(e=>e.phrase).join(", "))}</small>`:""}
  </div>`;
}
function allegroDraftDiagnostykaHTML(d={},msg="",brak=""){
  const sc=d.salesConditions||{};
  const defs=sc.defaults||{};
  const params=Array.isArray(d.categoryParameters)?d.categoryParameters:[];
  const supportErrors=Array.isArray(d.supportErrors)?d.supportErrors:[];
  const allegroErrors=Array.isArray(d.allegroError?.errors)?d.allegroError.errors:[];
  const autoParams=Array.isArray(d.draft?.parameters)?d.draft.parameters:[];
  const required=Array.isArray(d.requiredParameters)?d.requiredParameters:[];
  const catalog=d.catalogMatch?.selected||null;
  return `<div class="backend-note">
    <b>${esc(msg||"Podgląd szkicu Allegro")}</b><br>
    Operacja: <b>${d.operation==="update"?`aktualizacja istniejącej oferty ${esc(d.existingOffer?.offer?.id||"")}`:"utworzenie nowej oferty"}</b>${d.existingOffer?.reason?` • dopasowanie: ${esc(d.existingOffer.reason)}`:""}<br>
    Krótki opis: <b>${esc(d.improvedDescriptions?.shortDescription||"przygotowany z danych produktu")}</b><br>
    Katalog Allegro: <b>${catalog?`${esc(catalog.name)} • ID ${esc(catalog.id)}`:"nie znaleziono produktu — wymagane pełne parametry"}</b><br>
    Braki bazowe: ${esc(brak||"brak")}<br>
    Warunki sprzedaży: cennik dostawy <b>${esc(defs.shippingRateId||"domyślny/brak")}</b>, zwroty <b>${esc(defs.returnPolicyId||"domyślne/brak")}</b>, reklamacje <b>${esc(defs.impliedWarrantyId||"domyślne/brak")}</b>, gwarancja <b>${esc(defs.warrantyId||"domyślna/brak")}</b><br>
    Parametry kategorii pobrane z Allegro: <b>${esc(params.length)}</b>; automatycznie dopisane do szkicu: <b>${esc(autoParams.length)}</b>.
    ${supportErrors.length?`<div style="margin-top:.5rem;color:#9a3412"><b>Uwagi API:</b><br>${supportErrors.map(e=>`• ${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}`).join("<br>")}</div>`:""}
    ${allegroErrors.length?`<div style="margin-top:.5rem;color:#991b1b"><b>Błąd Allegro:</b><br>${allegroErrors.map(e=>`• ${esc(e.userMessage||e.message||e.code||"błąd")}${e.path?` <small>(${esc(e.path)})</small>`:""}`).join("<br>")}</div>`:""}
    ${required.length?`<div class="allegro-required-params"><h4>Uzupełnij wymagane parametry Allegro</h4><p>Produkt nie został znaleziony w katalogu po EAN. Te pola są wymagane do utworzenia nowego produktu.</p>${required.map(p=>`<label><span>${esc(p.name)}${p.unit?` (${esc(p.unit)})`:""}</span>${Array.isArray(p.dictionary)&&p.dictionary.length?`<select name="allegroParam_${esc(p.id)}" data-param-type="dictionary" required><option value="">— wybierz —</option>${p.dictionary.map(v=>`<option value="${esc(v.id||v.valueId||v.value)}">${esc(v.value||v.name||v.label)}</option>`).join("")}</select>`:`<input name="allegroParam_${esc(p.id)}" placeholder="${esc(p.name)}" required>`}</label>`).join("")}</div>`:""}
    <details><summary>Podgląd JSON wysyłany do Allegro</summary><pre style="white-space:pre-wrap;font-size:.75rem">${esc(JSON.stringify(d.draft||d,null,2))}</pre></details>
  </div>`;
}
function allegroUstawKategorieWFormularzu(id){
  const form=document.querySelector("form.product-editor-form");
  if(!form?.elements?.allegroCategoryId){ toast("Nie znaleziono pola kategorii Allegro"); return; }
  form.elements.allegroCategoryId.value=String(id||"").trim();
  toast("🟠 Ustawiono kategorię Allegro: "+String(id||""));
}
function allegroPokazKategorieWFormularzu(d){
  const box=document.getElementById("allegroCategoryPreview");
  if(box) box.innerHTML=allegroKategorieHTML(d);
  const id=d?.selected?.id;
  const form=document.querySelector("form.product-editor-form");
  if(id&&form?.elements?.allegroCategoryId&&!String(form.elements.allegroCategoryId.value||"").trim()) form.elements.allegroCategoryId.value=String(id);
}
async function allegroDobierzKategorieProduktu(id=0,btn=null){
  const form=document.querySelector("form.product-editor-form");
  if(!form){ toast("Nie znaleziono formularza produktu"); return; }
  const poprzedni=id?pobierzProduktAdmin(id)||{}:{};
  const product=produktRoboczyAllegroZFormularza(form,id,poprzedni);
  const phrase=String(form.elements.allegroCategoryPhrase?.value||"").trim();
  if(!phrase&&!String(product.nazwa||"").trim()&&!String(product.kategoria||"").trim()){ toast("Podaj nazwę produktu albo frazę do katalogu Allegro"); return; }
  try{
    if(btn)btn.disabled=true;
    toast("🟠 Szukam kategorii w katalogu Allegro…");
    const d=await chmura("allegro-category-suggest",{method:"POST",body:{product,phrase,limit:10},timeout:18000});
    allegroPokazKategorieWFormularzu(d);
    toast(d.selected?.id?`🟠 Dobrano kategorię Allegro: ${d.selected.name} (${d.selected.id})`:"⚠️ Allegro nie zwróciło pasującej kategorii");
  }catch(e){ toast("⚠️ Kategorie Allegro: "+(e.message||e)); }
  finally{ if(btn)btn.disabled=false; }
}
function allegroZapiszKategorieProduktu(id,categoryId){
  if(!id||!categoryId) return false;
  const p=pobierzProduktAdmin(id);
  if(p?.allegroCategoryId) return false;
  produktyEdytowane[id]={...(produktyEdytowane[id]||{}),allegroCategoryId:String(categoryId)};
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zbudujProdukty();
  return true;
}
function allegroTrybPublikacji(){ return String(document.getElementById("allegroPublicationAction")?.value||"keep"); }
function allegroListaProducentow(){
  const ustawione=Array.isArray(allegroStan.offerSettings?.producers)&&allegroStan.offerSettings.producers.length?allegroStan.offerSettings.producers:["Alexander","Multigra","GoDan"];
  return [...new Set([...ustawione,...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>p.name||p.nazwa)].map(normalizujNazweProducenta).filter(Boolean))];
}
function allegroProducentKanoniczny(p={}){
  const list=allegroListaProducentow(),norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const text=norm([p.producent,p.marka,p.nazwa,p.name,p.sourceUrl,p.producentUrl].filter(Boolean).join(" "));
  const direct=list.find(name=>text.includes(norm(name)));if(direct)return direct;
  const find=name=>list.find(x=>norm(x)===norm(name))||"";
  if(/alexander|sklep alexander|origami 3d|maly konstruktor|constructor junior|zlotowki/.test(text))return find("Alexander");
  if(/multigra/.test(text))return find("Multigra");
  if(/go dan|godan|godanparty/.test(text))return find("GoDan");
  return "";
}
function zapiszPolaProduktuLokalnie(id,fields={},tylkoBrakujace=false){
  const key=String(id),idx=produktyDodane.findIndex(x=>String(x.id)===key),base=idx>=0?produktyDodane[idx]:(produktyEdytowane[key]||{}),effective=idx>=0?base:(pobierzProduktAdmin(id)||base),next={...base};let changed=false;
  for(const [field,value] of Object.entries(fields)){if(value===undefined||value===null||value==="")continue;if(tylkoBrakujace&&(effective[field]!==undefined&&effective[field]!==null&&String(effective[field]).trim()!==""))continue;if(JSON.stringify(next[field])!==JSON.stringify(value)){next[field]=value;changed=true;}}
  if(!changed)return false;
  if(idx>=0){produktyDodane[idx]=next;zapiszLS("artway_produkty_dodane",produktyDodane);}else{produktyEdytowane={...produktyEdytowane,[key]:next};zapiszLS("artway_produkty_edytowane",produktyEdytowane);}
  zbudujProdukty();return true;
}
function allegroZastosujWynikWystawienia(p,d={}){
  const id=String(d.offer?.id||p.allegroOfferId||"").trim();
  if(!id)return;
  const old=allegroOfertaPoId(id)||{};
  const publication=d.offer?.publication||{};
  const next={...old,...d.offer,id,name:d.offer?.name||p.nazwa||old.name,externalId:d.offer?.external?.id||p.externalId||p.sku||old.externalId||"",ean:p.gtin||p.ean||old.ean||"",gtin:p.gtin||p.ean||old.gtin||"",manufacturerCode:p.kodProducenta||p.mpn||old.manufacturerCode||"",categoryId:d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||old.categoryId||"",priceText:d.offer?.sellingMode?.price?`${String(d.offer.sellingMode.price.amount).replace(".",",")} ${d.offer.sellingMode.price.currency||"PLN"}`:old.priceText||zl(p.cena),status:publication.status||old.status||(allegroTrybPublikacji()==="activate"?"ACTIVE":"INACTIVE"),mainImage:d.offer?.images?.[0]||p.zdjecie||old.mainImage||"",images:(d.offer?.images||[p.zdjecie,...(p.zdjecia||[])]).filter(Boolean)};
  allegroOferty=[next,...allegroOferty.filter(o=>String(o.id)!==id)];
  allegroMapowania={...allegroMapowania,[id]:{offerId:id,productId:String(p.id),operator:"auto-offer-save"}};
  allegroZapiszCache();
}
function allegroZapiszWynikOperacji(p,d={}){
  const offerId=String(d.offer?.id||p.allegroOfferId||"").trim();
  allegroOstatniWynikWystawienia={
    produktId:String(p.id??""),produktNazwa:p.nazwa||p.name||"Produkt",offerId,
    mode:d.mode||"updated",status:d.offer?.publication?.status||d.offer?.status||"INACTIVE",
    duplicatePrevented:!!d.duplicatePrevented,reason:d.match?.reason||d.existingOffer?.reason||"",
    catalogId:d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"",
    categoryId:d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||"",
    at:new Date().toISOString()
  };
  return allegroOstatniWynikWystawienia;
}
function allegroWynikOperacjiHTML(){
  const w=allegroOstatniWynikWystawienia;if(!w?.offerId)return "";
  const updated=w.mode==="updated";
  return `<div class="duplicate-audit-ok allegro-operation-success"><div><b>✅ ${updated?"Oferta została znaleziona i zaktualizowana":"Oferta została utworzona"}</b><small>${esc(w.produktNazwa)} • ID oferty ${esc(w.offerId)} • status ${esc(w.status)}${w.duplicatePrevented?" • nie utworzono duplikatu":""}</small><small>Produkt katalogowy: ${esc(w.catalogId||"—")} • kategoria: ${esc(w.categoryId||"—")}${w.reason?` • rozpoznano po: ${esc(w.reason)}`:""}</small></div><div class="warehouse-worktable-actions"><button class="btn ghost" onclick="window.open('https://allegro.pl/oferta/${encodeURIComponent(w.offerId)}','_blank','noopener')">Otwórz w Allegro</button><button class="btn ghost" onclick="allegroOstatniWynikWystawienia=null;renderuj()">Zamknij</button></div></div>`;
}
function allegroTekstZBezpiecznychSekcji(sections=[]){
  const html=(Array.isArray(sections)?sections:[]).flatMap(section=>Array.isArray(section?.items)?section.items:[]).filter(item=>item?.type==="TEXT").map(item=>String(item.content||"")).join("\n");
  if(!html)return "";
  const withBreaks=html.replace(/<\/(p|h1|h2|h3|li)>/gi,"\n").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<li[^>]*>/gi,"• ");
  const el=document.createElement("textarea");el.innerHTML=withBreaks;
  return String(el.value||"").replace(/<[^>]+>/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function allegroZapiszAutoUzupelnienia(p,d={}){
  if(!p?.id)return false;
  const auto=d.autoFilled||{},catalog=d.catalogMatch?.selected||{},category=d.categorySuggestion?.selected||{};
  const canonical=allegroProducentKanoniczny({...p,producent:auto.producent||p.producent,marka:auto.marka||p.marka});
  const fields={
    allegroTitle:auto.allegroTitle||p.allegroTitle,
    producent:canonical||auto.producent||p.producent||p.marka||"",
    marka:auto.marka||p.marka||canonical||auto.producent||p.producent||"",
    gtin:auto.gtin||auto.ean||(catalog.eans||[])[0]||p.gtin||p.ean||"",
    ean:auto.ean||auto.gtin||(catalog.eans||[])[0]||p.ean||p.gtin||"",
    kodProducenta:auto.kodProducenta||auto.mpn||p.kodProducenta||p.mpn||"",
    mpn:auto.mpn||auto.kodProducenta||p.mpn||p.kodProducenta||"",
    zdjecie:auto.zdjecie||(auto.zdjecia||[])[0]||p.zdjecie||"",
    allegroProductId:auto.allegroProductId||catalog.id||p.allegroProductId||"",
    allegroCategoryId:auto.allegroCategoryId||category.id||catalog.categoryId||p.allegroCategoryId||""
  };
  const improved=d.improvedDescriptions||{},safeSections=d.draft?.description?.sections||improved.sections||[],safeFull=improved.storeFullDescription||improved.fullDescription||p.opis||"",safeShort=improved.storeShortDescription||improved.shortDescription||p.opisKrotki||(safeFull?agentAITnijDoZdania(safeFull,500):""),allegroFull=improved.allegroDescription||safeFull||allegroTekstZBezpiecznychSekcji(safeSections)||"",next={allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},force={};let changed=p.allegroShippingSubsidy===undefined;
  for(const [key,value] of Object.entries(fields))if(value&&(!p[key]||(canonical&&key==="producent"&&String(p[key])!==String(value)))){next[key]=String(value);changed=true;}
  const extraImages=(Array.isArray(auto.zdjecia)?auto.zdjecia:[]).filter(Boolean).filter(x=>x!==fields.zdjecie).slice(0,15);
  if(extraImages.length&&!(Array.isArray(p.zdjecia)&&p.zdjecia.length)){next.zdjecia=extraImages;changed=true;}
  if(Array.isArray(auto.allegroParameters)&&auto.allegroParameters.length&&!Array.isArray(p.allegroParameters)){next.allegroParameters=auto.allegroParameters;changed=true;}
  if(safeShort&&String(safeShort)!==String(p.opisKrotki||"")){force.opisKrotki=String(safeShort);changed=true;}
  if(safeFull&&String(safeFull)!==String(p.opis||"")){force.opis=String(safeFull);changed=true;}
  if(allegroFull&&String(allegroFull)!==String(p.allegroDescription||"")){force.allegroDescription=String(allegroFull);changed=true;}
  if(Array.isArray(safeSections)&&safeSections.length){force.allegroDescriptionSections=safeSections;changed=true;}
  const form=document.querySelector("form.product-editor-form");
  if(form){
    for(const [key,value] of Object.entries(fields))uzupelnijPoleFormularza(form,key,value,false);
    extraImages.forEach((url,i)=>uzupelnijPoleFormularza(form,"zdjecie"+(i+2),url,false));
    uzupelnijPoleFormularza(form,"opisKrotki",safeShort,true);
    uzupelnijPoleFormularza(form,"opis",safeFull,true);
    uzupelnijPoleFormularza(form,"allegroShippingSubsidy",next.allegroShippingSubsidy,false);
  }
  if(canonical){const producerFields={producent:canonical,...(!p.marka&&!auto.marka?{marka:canonical}:{})};if(zapiszPolaProduktuLokalnie(p.id,producerFields,false))changed=true;delete next.producent;if(p.marka||auto.marka)delete next.marka;}
  const missingSaved=Object.keys(next).length?zapiszPolaProduktuLokalnie(p.id,next,true):false;
  const forcedSaved=Object.keys(force).length?zapiszPolaProduktuLokalnie(p.id,force,false):false;
  return missingSaved||forcedSaved||changed;
}
async function allegroPrzygotujSzkicProduktu(id){
  const form=document.querySelector("form.product-editor-form");
  const produkt=id?produktDlaAllegroZFormularza(form,id,pobierzProduktAdmin(id)||{}):null;
  if(!produkt) return;
  try{
    toast("🤖 Agent przygotowuje i zapisuje komplet danych Allegro…");
    zapiszPolaProduktuLokalnie(id,produkt,false);
    const result=await asortymentPrzygotujProduktDoAllegro(pobierzProduktAdmin(id)||produkt,{refreshSource:true}),d=result.draft,cloudSaved=await chmuraZapiszUstawienia().catch(()=>false);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    const brak=result.missing.join(", ")||"brak";
    const cat=d.categorySuggestion?.selected;
    const msg=result.ready?(d.operation==="update"?`Dane zapisane. Znaleziono ofertę ${d.existingOffer?.offer?.id||""} — zostanie zaktualizowana bez duplikatu.`:"Dane zapisane. Produkt jest gotowy technicznie do wysłania do Allegro."):"Agent zapisał poprawki; nadal trzeba uzupełnić: "+brak;
    toast(`${cloudSaved?"✅":"⚠️"} ${msg}${cloudSaved?"":" • serwer ponowi synchronizację"}`);
    const box=document.getElementById("allegroDraftPreview");
    if(box) box.innerHTML=`<div class="backend-note ${result.ready?"duplicate-audit-ok":""}"><b>${result.ready?"✅ Przygotowanie zapisane":"⚠️ Poprawki zapisane — pozostały braki"}</b><br><small>${result.savedFields.length?`Zmieniono: ${esc(asortymentEtykietyPol(result.savedFields).join(", "))}`:"Kontrola nie wymagała zmiany istniejących danych."} • serwer: ${cloudSaved?"zapis potwierdzony":"ponowna próba w toku"}</small></div>${allegroKategorieHTML(d.categorySuggestion)}${cat?`<div class="backend-note">Dobrana kategoria: <b>${esc(cat.name)}</b> (${esc(cat.id)})</div>`:""}${allegroDraftDiagnostykaHTML(d,msg,brak)}`;
  }catch(e){ allegroZapiszAutoUzupelnienia(produkt,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProdukt(id){
  const form=document.querySelector("form.product-editor-form");
  const produkt=id?produktDlaAllegroZFormularza(form,id,pobierzProduktAdmin(id)||{}):null;
  if(!produkt) return;
  try{
    toast("🤖 Najpierw przygotowuję i zapisuję pełne dane produktu…");
    zapiszPolaProduktuLokalnie(id,produkt,false);
    const preparation=await asortymentPrzygotujProduktDoAllegro(pobierzProduktAdmin(id)||produkt,{refreshSource:true});
    if(!preparation.ready){
      await chmuraZapiszUstawienia().catch(()=>false);
      const box=document.getElementById("allegroDraftPreview");if(box)box.innerHTML=`<div class="backend-note allegro-mapping-error"><b>Agent zapisał poprawione dane, ale zatrzymał wystawienie.</b><br>Do uzupełnienia: ${esc(preparation.missing.join(", ")||"sprawdź kartotekę produktu")}<br><small>Zapisane pola: ${esc(asortymentEtykietyPol(preparation.savedFields).join(", ")||"kontrola bez zmian")}</small></div>`;
      toast("⚠️ Oferta nie została wysłana — uzupełnij wskazane braki");return;
    }
    const produktGotowy=preparation.product;
    const publicationAction=allegroTrybPublikacji();
    const preparedDraft=preparation.draft?.draft?{...preparation.draft.draft,publication:{...(preparation.draft.draft.publication||{}),status:publicationAction==="activate"?"ACTIVE":"INACTIVE",republish:true}}:null;
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:produktGotowy,...(preparedDraft?{draft:preparedDraft}:{}),options:{stock:allegroStanOfertyProduktu(produktGotowy),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    const remoteStatus=String(d.verification?.status||d.offer?.publication?.status||d.offer?.status||"").toUpperCase();
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(produktGotowy,d);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    allegroZapiszAutoUzupelnienia(produktGotowy,d);
    toast(remoteStatus==="ACTIVE"?"✅ Oferta zapisana i aktywna w Allegro":`🧾 Oferta zapisana • status Allegro: ${remoteStatus||"weryfikacja w toku"}`);
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||form.elements.allegroCategoryId?.value||"";
      produktyEdytowane[id]={...(produktyEdytowane[id]||{}),allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})};
      zapiszLS("artway_produkty_edytowane",produktyEdytowane);
      allegroZastosujWynikWystawienia(produktGotowy,d);
      await allegroPobierzProwizjeProduktu(id,null,{silent:true}).catch(()=>null);
      zapiszPolaProduktuLokalnie(id,{allegroAgentPreparationStatus:remoteStatus==="ACTIVE"?"published":"draft",allegroAgentPublishedAt:remoteStatus==="ACTIVE"?new Date().toISOString():"",allegroOfferId:String(d.offer.id)},false);
      const cloudSaved=await chmuraZapiszUstawienia().catch(()=>false);
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      const box=document.getElementById("allegroDraftPreview");if(box)box.innerHTML=`<div class="duplicate-audit-ok allegro-operation-success"><div><b>${remoteStatus==="ACTIVE"?"✅ Oferta aktywna":"🧾 Oferta zapisana — "+esc(remoteStatus||"weryfikacja w toku")}</b><small>ID ${esc(d.offer.id)} • opis: ${esc(d.verification?.descriptionSections||0)} sekcji • kartoteka ${cloudSaved?"zapisana na serwerze":"czeka na ponowny zapis"}</small></div><a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(d.offer.id)}" target="_blank" rel="noopener">Otwórz ofertę</a></div>`;
    }
  }catch(e){
    allegroOstatniBladWystawienia=e;
    allegroZapiszAutoUzupelnienia(produkt,e);
    if(e.agentTask)await chmuraWczytajStan().catch(()=>{});
    allegroPokazKategorieWFormularzu(e.categorySuggestion);
    const box=document.getElementById("allegroDraftPreview");
    if(box&&e.draft) box.innerHTML=`${allegroKategorieHTML(e.categorySuggestion)}${allegroDraftDiagnostykaHTML(e,"Nie utworzono oferty: "+(e.message||"błąd Allegro"),(e.missing||[]).join(", ")||"—")}`;
    toast("⚠️ Wystawianie Allegro: "+(e.message||e));
  }
}
function uzupelnijPoleFormularza(form,nazwa,wartosc,overwrite){
  if(wartosc===undefined||wartosc===null||wartosc==="") return;
  const el=form.elements[nazwa];
  if(!el) return;
  if(overwrite||!String(el.value||"").trim()) el.value=wartosc;
}
function agentAIUzupelnijFormularzZLinku(form,p={},d={},overwrite=false,url=""){
  const category=d.storeCategory?.name?d.storeCategory:agentAIDobierzKategorieProduktu(p);p={...p,kategoria:category.name||p.kategoria||""};
  uzupelnijPoleFormularza(form,"nazwa",p.nazwa,overwrite);uzupelnijPoleFormularza(form,"kategoria",p.kategoria,overwrite);uzupelnijPoleFormularza(form,"opisKrotki",p.opisKrotki||agentAIUtworzOpisKrotki(p),overwrite);uzupelnijPoleFormularza(form,"opis",p.opis,overwrite);uzupelnijPoleFormularza(form,"cena",p.cena,overwrite);uzupelnijPoleFormularza(form,"zdjecie",p.zdjecie,overwrite);(p.zdjecia||[]).slice(0,15).forEach((z,i)=>uzupelnijPoleFormularza(form,"zdjecie"+(i+2),z,overwrite));uzupelnijPoleFormularza(form,"gtin",p.gtin||p.ean,overwrite);uzupelnijPoleFormularza(form,"mpn",p.mpn||p.kodProducenta,overwrite);uzupelnijPoleFormularza(form,"kodProducenta",p.kodProducenta||p.mpn,overwrite);uzupelnijPoleFormularza(form,"externalId",p.externalId,overwrite);
  const canonicalProducer=allegroProducentKanoniczny({...p,sourceUrl:p.sourceUrl||url,producentUrl:url});uzupelnijPoleFormularza(form,"marka",p.marka||canonicalProducer||p.producent,overwrite);uzupelnijPoleFormularza(form,"producent",canonicalProducer||p.producent||p.marka,overwrite||!!canonicalProducer);uzupelnijPoleFormularza(form,"rozmiar",p.rozmiar,overwrite);uzupelnijPoleFormularza(form,"dostepnoscProducenta",p.dostepnoscProducenta,overwrite);uzupelnijPoleFormularza(form,"producentUrl",p.producentUrl||p.sourceUrl||url,overwrite);uzupelnijPoleFormularza(form,"sourceUrl",p.sourceUrl||p.producentUrl||url,overwrite);uzupelnijPoleFormularza(form,"allegroCategoryId",p.allegroCategoryId,overwrite);uzupelnijPoleFormularza(form,"allegroProductId",p.allegroProductId,overwrite);for(const field of ["stanProducenta","stanProducentaZrodlo","producentStatus","producentSprawdzonoAt"])uzupelnijPoleFormularza(form,field,p[field],true);if(form.elements.stanProducentaDokladny)form.elements.stanProducentaDokladny.value=p.stanProducentaDokladny?"1":"";
  form.dataset.agentLinkConfidence=String(d.confidence||0);form.dataset.agentLinkSource=String(d.canonicalUrl||d.resolvedUrl||url||"");form.dataset.agentCategoryConfidence=String(category.confidence||0);
  const pg=document.getElementById("podgladZdjecia");if(pg&&form.elements.zdjecie?.value)pg.innerHTML=`<img src="${esc(form.elements.zdjecie.value)}" alt="Podgląd zdjęcia produktu" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:.6rem">`;
  produktDodawanieAktualizuj(form);
  return brakiDanychProducenta(p,d);
}
function agentAIAudytDodaniaHTML(product={},d={}){
  const audit=agentAIOcenaDodaniaProduktu(product,d),dup=audit.blockingDuplicate;
  return `<section class="product-link-add-audit"><div class="product-link-add-score"><span>Gotowość danych</span><b>${esc(audit.score)}%</b><small>${audit.ready?"formularz jest gotowy do Twojego zatwierdzenia":dup?`dane ${audit.dataScore}%, znaleziono możliwy duplikat`:"najpierw wykonaj wskazane czynności"}</small></div><div class="product-link-add-steps">${[["Link",!d.needsChoice,"źródło rozpoznane"],["Tożsamość",!!(product.gtin||product.ean||product.mpn||product.kodProducenta),"EAN lub kod producenta"],["Dane sklepu",!!(product.nazwa&&Number(product.cena)>0&&audit.product.kategoria),"nazwa, cena i kategoria"],["Duplikaty",!dup,dup?`produkt #${dup.product.id}`:"brak pewnego duplikatu"],["Zatwierdzenie",false,"decyzja administratora na dole formularza"]].map(([label,ok,note])=>`<span class="${ok?"ok":"wait"}"><b>${ok?"✓":"○"} ${esc(label)}</b><small>${esc(note)}</small></span>`).join("")}</div>${audit.blockers.length?`<div class="backend-note product-link-blockers"><b>Agent wskazuje problem przed zatwierdzeniem:</b> ${esc(audit.blockers.join(" • "))}</div>`:""}${audit.warnings.length?`<div class="backend-note"><b>Do późniejszego uzupełnienia:</b> ${esc(audit.warnings.join(" • "))}</div>`:""}${audit.duplicates.length?`<div class="product-link-duplicates"><b>Możliwe istniejące produkty</b>${audit.duplicates.slice(0,4).map(x=>`<article><span><strong>#${esc(x.product.id)} ${esc(x.product.nazwa||"Produkt")}</strong><small>${esc(x.reasons.join(" • "))} • zgodność ${esc(x.score)}%</small></span><button class="btn ghost" type="button" onclick="location.hash='#/admin/produkty/edytuj/${encodeURIComponent(String(x.product.id))}'">Otwórz</button>${x.blocking?`<button class="btn" type="button" onclick="agentAIAktualizujIstniejacyZAnalizy(${jsArg(x.product.id)},this)">Uzupełnij istniejący</button>`:""}</article>`).join("")}</div>`:""}<div class="diag-actions">${audit.ready?`<button class="btn product-link-agent-add" type="button" onclick="agentAIDodajProduktZAnalizy(this)">Przejdź do zatwierdzenia ↓</button>`:`<button class="btn ghost" type="button" onclick="agentAIPokazPierwszyBrak(this)">Przejdź do brakujących danych</button>`}</div></section>`;
}
function agentAIRaportLinkuHTML(d={},selected=-1){
  const alternatives=Array.isArray(d.alternatives)?d.alternatives:[],attempts=Array.isArray(d.diagnostics?.attempts)?d.diagnostics.attempts:[],candidate=d.needsChoice&&selected>=0?alternatives[selected]:null,product=candidate?.product||d.product||{},sources=candidate?.fieldSources||d.fieldSources||{},missing=candidate?.missing||brakiDanychProducenta(product,d),confidence=candidate?.confidence||d.confidence||0,workflow=d.workflow||{},allegro=d.allegroPreparation||{},category=d.storeCategory||{};
  const preparation=!d.needsChoice?`<div class="product-link-field-grid product-link-channel-readiness"><span class="${workflow.readyForStore?"ok":"missing"}"><small>Sklep</small><b>${workflow.readyForStore?"gotowe do zapisu":"wymaga uzupełnienia"}</b><em>${esc(category.name?`${category.name} • pewność ${category.confidence||0}%`:"brak pewnej kategorii")}</em></span><span class="${workflow.readyForAllegro?"ok":"missing"}"><small>Allegro</small><b>${workflow.readyForAllegro?"szkic przygotowany":"wymaga uzupełnienia"}</b><em>${esc(product.allegroCategoryId?`kategoria ${product.allegroCategoryId}${product.allegroProductId?` • katalog ${product.allegroProductId}`:""}`:(allegro.missing||[]).join(", ")||"brak kategorii")}</em></span><span class="${d.duplicateAudit?.blocking?"missing":"ok"}"><small>Duplikaty</small><b>${d.duplicateAudit?.blocking?"zapis zablokowany":"brak pewnego duplikatu"}</b><em>${esc(d.duplicateAudit?.selected?.productName||"kontrola centralnej bazy zakończona")}</em></span></div>`:"";
  return `<div class="product-link-agent-report ${d.needsChoice&&selected<0?"needs-choice":""}"><header><div><span>🤖 Analiza linku + przygotowanie Allegro</span><h3>${d.needsChoice&&selected<0?`Znaleziono ${alternatives.length} możliwe produkty`:esc(product.nazwa||"Wynik analizy produktu")}</h3><small>Kompletność ${esc(confidence)}% • ${esc(d.fromCache?"pewny wynik z pamięci Agenta":d.diagnostics?.selectedReason||"najpełniejsze dane")}</small></div><span class="lvl ${missing.length?"lvl-ostrzezenie":"lvl-ok"}">${workflow.readyForAllegro?"sklep + Allegro gotowe":missing.length?`${missing.length} uwag`:"komplet danych"}</span></header>${d.fromCache?`<div class="backend-note product-link-cache-note"><b>🧠 Pamięć Agenta:</b> producent chwilowo nie odpowiedział, dlatego użyto ostatniego poprawnego wyniku z ${esc(d.cacheSavedAt?new Date(d.cacheSavedAt).toLocaleString("pl-PL"):"wcześniejszej kontroli")}. Agent nadal zaplanował świeżą kontrolę.</div>`:""}${d.repaired?`<div class="backend-note"><b>Naprawiono lub przekierowano adres:</b> ${esc(d.resolvedUrl||d.canonicalUrl||"")}</div>`:""}${d.needsChoice&&selected<0?`<div class="product-link-candidate-grid">${alternatives.map((c,i)=>`<article>${c.product?.zdjecie?`<img src="${esc(c.product.zdjecie)}" alt="">`:`<span>📦</span>`}<div><b>${esc(c.product?.nazwa||`Wariant ${i+1}`)}</b><small>EAN ${esc(c.product?.ean||c.product?.gtin||"—")} • kod ${esc(c.product?.kodProducenta||c.product?.mpn||"—")}</small><small>${esc(c.confidence||0)}% • braki: ${esc(c.missing?.join(", ")||"brak")}</small><small>${esc(c.url||"")}</small></div><button class="btn" type="button" onclick="agentAIWybierzKandydataZLinku(${i},this)">Wybierz i przygotuj</button></article>`).join("")}</div>`:`${preparation}<div class="product-link-field-grid">${[["Nazwa",product.nazwa,sources.nazwa],["EAN",product.ean||product.gtin,sources.ean],["Kod",product.kodProducenta||product.mpn,sources.kod],["Cena",product.cena?zl(product.cena):"",sources.cena],["Opis",product.opis?`${String(product.opis).length} znaków`:"",sources.opis],["Zdjęcia",[product.zdjecie,...(product.zdjecia||[])].filter(Boolean).length,sources.zdjecia],["Dostępność",product.dostepnoscProducenta,sources.dostepnosc]].map(([label,value,source])=>`<span class="${value!==""&&value!==0?"ok":"missing"}"><small>${label}</small><b>${esc(value||"brak")}</b><em>${esc(source||"uzupełnione przez Agenta/katalog")}</em></span>`).join("")}</div>${agentAIAudytDodaniaHTML(product,{...d,needsChoice:false})}`}<details><summary>Diagnostyka pobierania (${attempts.filter(x=>x.ok).length}/${attempts.length} wariantów poprawnych)</summary><div class="product-link-attempts">${attempts.map(a=>`<span class="${a.ok?"ok":"error"}"><b>${a.ok?"✅":"⚠️"} ${esc(a.reason||"próba")}</b><small>${esc(a.url||"")}</small><small>${a.ok?`HTTP ${esc(a.status)} • ${Math.max(1,Math.round((a.durationMs||0)/1000))} s • ${esc(a.confidence||0)}%`:`${esc(a.error||"błąd")} • ${Math.max(1,Math.round((a.durationMs||0)/1000))} s`}</small></span>`).join("")}</div></details></div>`;
}
async function agentAIWybierzKandydataZLinku(index,button){
  const form=button?.closest("form"),current=agentAIImportUrlStan.data,c=current?.alternatives?.[index];if(!form||!c?.product)return;
  const requested=current.requestedUrl||form.elements.producentUrl?.value||form.elements.sourceUrl?.value||c.url,overwrite=!!form.elements.nadpiszImportUrl?.checked;button.disabled=true;
  try{
    toast("Agent przygotowuje wybrany wariant i katalog Allegro…");
    const d=await chmura("product-url-prepare",{method:"POST",body:{url:requested,choice:index},timeout:90000}),p=d.product||c.product,url=d.canonicalUrl||c.url||requested,braki=agentAIUzupelnijFormularzZLinku(form,p,d,overwrite,url);if(form.elements.producentUrl)form.elements.producentUrl.value=url;if(form.elements.sourceUrl)form.elements.sourceUrl.value=url;agentAIImportUrlStan={busy:false,data:d,selected:index,error:""};
    const box=form.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(d,index);agentAIZapiszLinkProducenta(requested,braki.length?"do uzupełnienia":"pobrano",braki.length?`Wybrano wariant — uwagi: ${braki.join(", ")}`:"Wybrano i przygotowano właściwy wariant",{lastProductName:p.nazwa||"",lastProduct:agentAIProduktZLinkuMini(p),lastMissing:braki,lastCandidates:current.alternatives||[],linkConfidence:d.confidence||c.confidence||0,diagnostics:d.diagnostics||{},resolvedUrl:url,nextRetryAt:null});toast(`✅ Przygotowano: ${p.nazwa||"produkt"} • sklep ${d.workflow?.readyForStore?"gotowy":"do uzupełnienia"} • Allegro ${d.workflow?.readyForAllegro?"gotowe":"do uzupełnienia"}`);
  }catch(e){toast("⚠️ Przygotowanie wariantu: "+(e.message||e));button.disabled=false;}
}
function agentAIWybranyProduktImportu(d={},selected=-1){return d.needsChoice&&selected>=0?d.alternatives?.[selected]?.product||d.product||{}:d.product||{};}
function agentAIPokazPierwszyBrak(button){
  const form=button?.closest("form"),d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected),p=agentAIProduktZFormularzaDoOceny(form,source),audit=agentAIOcenaDodaniaProduktu(p,{...d,needsChoice:selected<0&&d.needsChoice});
  const text=audit.blockers[0]||audit.warnings[0]||"",name=/nazw/i.test(text)?"nazwa":/cen/i.test(text)?"cena":/kategor/i.test(text)?"kategoria":/ean/i.test(text)?"gtin":/kod/i.test(text)?"kodProducenta":/zdję/i.test(text)?"zdjecie":/krótki/i.test(text)?"opisKrotki":/opis/i.test(text)?"opis":"producentUrl",el=form?.elements?.[name];
  if(el){el.focus();el.scrollIntoView({behavior:"smooth",block:"center"});toast(`Uzupełnij: ${text}`);}else toast(text||"Wybierz najpierw właściwy wariant produktu");
}
function agentAIDodajProduktZAnalizy(button){
  const form=button?.closest("form"),d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected),p=agentAIProduktZFormularzaDoOceny(form,source),audit=agentAIOcenaDodaniaProduktu(p,{...d,needsChoice:selected<0&&d.needsChoice});
  if(!audit.ready){toast("Agent zatrzymał dodanie: "+audit.blockers.join(" • "));return;}
  const kontrola=produktDodawanieAktualizuj(form);if(!kontrola?.canSubmit){form?.querySelector("[data-product-add-control]")?.scrollIntoView({behavior:"smooth",block:"start"});toast(kontrola?.potential&&!kontrola.acknowledged?"Najpierw zdecyduj, czy podobna pozycja jest innym produktem":"Najpierw zakończ kontrolę danych i duplikatów");return;}
  form.dataset.agentAdd="1";form.dataset.agentLinkConfidence=String(selected>=0?d.alternatives?.[selected]?.confidence||d.confidence||0:d.confidence||0);const approval=form.querySelector("[data-product-final-approval]");approval?.scrollIntoView({behavior:"smooth",block:"center"});approval?.focus();toast("Dane są gotowe — sprawdź formularz i zatwierdź dodanie produktu");
}
function agentAIAktualizujIstniejacyZAnalizy(id,button){
  const d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected);if(!source?.nazwa){toast("Brak danych analizy do aktualizacji");return;}
  const category=agentAIDobierzKategorieProduktu(source),canonical=allegroProducentKanoniczny(source),fields={...source,kategoria:category.name||source.kategoria||"",producent:canonical||source.producent||source.marka||"",marka:source.marka||canonical||source.producent||"",agentImportAt:new Date().toISOString(),agentImportConfidence:selected>=0?d.alternatives?.[selected]?.confidence||d.confidence||0:d.confidence||0,agentImportSource:d.fromCache?"pamięć Agenta":"link producenta"};delete fields.id;
  zapiszPolaProduktuLokalnie(id,fields,true);const updated=pobierzProduktAdmin(id)||{id,...fields};agentAIZakonczLinkProducenta(updated.sourceUrl||updated.producentUrl,updated);zapiszHistorieAgenta("produkt-z-linku",`Agent uzupełnił istniejący produkt #${id}: ${updated.nazwa||source.nazwa}`,{produktId:id,zrodlo:fields.agentImportSource,confidence:fields.agentImportConfidence});if(chmuraToken)void chmuraZapiszUstawienia();toast("Istniejący produkt uzupełniony — nie utworzono duplikatu");location.hash=`#/admin/produkty/edytuj/${encodeURIComponent(String(id))}`;
}
function agentAIWariantyJednegoLinkuHTML(d={}){
  const alternatives=Array.isArray(d.alternatives)?d.alternatives:[];
  return `<div class="product-link-agent-report needs-choice"><header><div><span>🤖 Agent rozpoznał kilka kart</span><h3>Wybierz właściwy produkt</h3><small>Tylko w tej wyjątkowej sytuacji potrzebna jest jedna decyzja. Po wyborze Agent wykona całą resztę.</small></div><span class="lvl lvl-ostrzezenie">${alternatives.length} możliwości</span></header><div class="product-link-candidate-grid">${alternatives.map((c,i)=>`<article>${c.product?.zdjecie?`<img src="${esc(c.product.zdjecie)}" alt="">`:`<span>📦</span>`}<div><b>${esc(c.product?.nazwa||`Produkt ${i+1}`)}</b><small>EAN ${esc(c.product?.ean||c.product?.gtin||"—")} • kod ${esc(c.product?.kodProducenta||c.product?.mpn||"—")}</small><small>${esc(c.confidence||0)}% • ${esc(c.url||"")}</small></div><button class="btn" type="button" onclick="agentAIWybierzWariantJednegoLinku(${i},this)">Wybierz — Agent zrobi resztę</button></article>`).join("")}</div></div>`;
}
async function agentAIPrzygotujProduktZJednegoLinku(d={},url="",box=null){
  const product=agentAIProduktGotowyZLinku(d,url);
  agentAIImportUrlStan={busy:false,data:d,selected:Number.isInteger(d.selectedChoice)?d.selectedChoice:0,error:""};
  try{sessionStorage.setItem("artway_prefill_product",JSON.stringify({...product,_agentLinkUrl:url,_agentPrepared:true}));}catch(e){}
  if(box)box.innerHTML=`<div class="product-link-agent-report"><header><div><span>✅ Dane przygotowane</span><h3>${esc(product.nazwa||"Produkt")}</h3><small>Agent nie zapisał kartoteki. Sprawdź wspólny formularz i samodzielnie zatwierdź dodanie produktu.</small></div><span class="lvl lvl-ok">oczekuje na decyzję</span></header></div>`;
  toast("✅ Dane przygotowane — produkt czeka na Twoje zatwierdzenie");
  location.hash="#/admin/produkty/dodaj?agent=1";
  return {mode:"awaiting_approval",product};
}
async function agentAIUruchomJedenLink(url,button=null,choice=null){
  const clean=String(url||"").trim(),box=document.querySelector("[data-one-link-result]");if(!/^https?:\/\//i.test(clean)){toast("Wklej pełny adres konkretnego produktu, zaczynający się od https://");document.querySelector("[data-one-link-url]")?.focus();return;}
  if(button)button.disabled=true;if(box)box.innerHTML=`<div class="product-link-one-progress"><span>🤖</span><div><b>Agent analizuje konkretny produkt…</b><small>Pobieram dane bezpośrednio ze wskazanej strony, następnie sprawdzam duplikaty, kategorię i przygotowanie Allegro.</small></div></div>`;agentAIZapiszLinkProducenta(clean,"pobieranie","Agent rozpoczął kompletny import z jednego adresu");
  try{const body={url:clean,...(Number.isInteger(choice)?{choice}: {})},d=await chmura("product-url-prepare",{method:"POST",body,timeout:120000});agentAIImportUrlStan={busy:false,data:d,selected:d.needsChoice?-1:(Number.isInteger(choice)?choice:0),error:""};if(d.needsChoice){if(box)box.innerHTML=agentAIWariantyJednegoLinkuHTML(d);return;}await agentAIPrzygotujProduktZJednegoLinku(d,clean,box);}catch(e){const nextRetryAt=agentAINastepnaProbaLinku(1);agentAIImportUrlStan={busy:false,data:null,selected:-1,error:e.message||String(e)};agentAIZapiszLinkProducenta(clean,"oczekuje",e.message||String(e),{nextRetryAt,failureCode:e.code||"fetch_error",diagnostics:e.linkDiagnostics||{}});if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>⚠️ Nie udało się odczytać źródła</span><h3>Agent zapisał adres do ponowienia</h3><small>${esc(e.message||e)}</small></div><span class="lvl lvl-ostrzezenie">bez utraty linku</span></header><div class="backend-note">Nie utworzono pustego ani błędnego produktu. Agent ponowi próbę, a Ty możesz użyć tego samego pola ponownie.</div></div>`;toast("⚠️ Nie utworzono produktu — link zachowano dla Agenta");}finally{if(button)button.disabled=false;}
}
async function agentAIDodajProduktTylkoZLinku(event){event.preventDefault();const form=event.currentTarget,button=event.submitter||form.querySelector('button[type="submit"]');await agentAIUruchomJedenLink(form.elements.url?.value,button,null);}
async function agentAIWybierzWariantJednegoLinku(index,button){const d=agentAIImportUrlStan.data||{},url=d.requestedUrl||document.querySelector("[data-one-link-url]")?.value||d.alternatives?.[index]?.url||"";await agentAIUruchomJedenLink(url,button,index);}
async function pobierzDaneProduktuZUrl(btn){
  const form=btn.closest("form");
  const url=String(form?.elements?.producentUrl?.value||"").trim();
  if(!url){ toast("⚠️ Wklej adres strony produktu producenta"); return; }
  const overwrite=!!form?.elements?.nadpiszImportUrl?.checked;
  const progressBox=form?.querySelector("[data-product-link-agent-result]");if(progressBox)progressBox.innerHTML=`<div class="product-link-fetch-progress"><div><span>🤖</span><b>Agent przygotowuje produkt z linku</b><small>Źródło → dane i kody → duplikaty → gotowy formularz</small></div><div class="product-link-fetch-track"><span></span></div><div class="product-link-fetch-stages"><span class="active">1. Źródło</span><span>2. Dane</span><span>3. Duplikaty</span><span>4. Formularz</span></div></div>`;
  try{
    btn.disabled=true;
    toast("Pobieram dane produktu ze strony producenta…");
    agentAIImportUrlStan={busy:true,data:null,selected:0,error:""};const d=await chmura("product-url-prepare",{method:"POST",body:{url},timeout:90000});agentAIImportUrlStan={busy:false,data:d,selected:d.needsChoice?-1:0,error:""};
    const p=d.product||{};
    const braki=d.needsChoice?[]:agentAIUzupelnijFormularzZLinku(form,p,d,overwrite,d.canonicalUrl||d.resolvedUrl||url);
    const box=form.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(d,d.needsChoice?-1:0);
    agentAIZapiszLinkProducenta(url,d.needsChoice?"wymaga wyboru":braki.length?"do uzupełnienia":"pobrano",d.needsChoice?`Znaleziono ${d.alternatives?.length||2} produkty — wybierz wariant`:braki.length?`Pobrano częściowo — braki: ${braki.join(", ")}`:"Pobrano i dopasowano do formularza",{lastProductName:p.nazwa||"",lastProduct:agentAIProduktZLinkuMini(p),lastMissing:braki,lastCandidates:(d.alternatives||[]).map(x=>({...x,product:agentAIProduktZLinkuMini(x.product||{})})),lastAvailability:p.dostepnoscProducenta||d.availability?.text||"",lastPrice:p.cena||"",linkConfidence:d.confidence||0,fieldSources:d.fieldSources||{},diagnostics:d.diagnostics||{},resolvedUrl:d.resolvedUrl||d.canonicalUrl||url,nextRetryAt:null});
    toast(d.needsChoice?`Agent znalazł ${d.alternatives?.length||2} produkty — wybierz właściwy poniżej`:braki.length?`Pobrano ${d.confidence||0}% danych; braki: ${braki.join(", ")}`:`Dane pobrane i dopasowane • kompletność ${d.confidence||0}%`);
  }catch(e){
    const cached=agentAIWynikLinkuZPamieci(url);
    if(cached){
      const p=cached.product||{},braki=cached.needsChoice?[]:agentAIUzupelnijFormularzZLinku(form,p,cached,overwrite,cached.canonicalUrl||cached.resolvedUrl||url);agentAIImportUrlStan={busy:false,data:cached,selected:cached.needsChoice?-1:0,error:""};const box=form?.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(cached,cached.needsChoice?-1:0);const proby=Number((agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===normalizujUrlProducenta(url))?.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);agentAIZapiszLinkProducenta(url,cached.needsChoice?"wymaga wyboru":"oczekuje","Użyto pamięci Agenta; świeża kontrola zostanie ponowiona",{proby,nextRetryAt,lastProduct:agentAIProduktZLinkuMini(p),lastCandidates:cached.alternatives||[],linkConfidence:cached.confidence||0,resolvedUrl:cached.resolvedUrl||url});toast(cached.needsChoice?`Pamięć Agenta znalazła ${cached.alternatives.length} warianty — wybierz właściwy`:`Producent chwilowo nie odpowiedział — użyto ostatnich poprawnych danych (${cached.confidence||0}%)`);return;
    }
    const current=(agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===normalizujUrlProducenta(url)),proby=Number(current?.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);agentAIImportUrlStan={busy:false,data:null,selected:-1,error:e.message||String(e)};
    agentAIZapiszLinkProducenta(url,"oczekuje",e.message||String(e),{proby,nextRetryAt,failureCode:e.code||"fetch_error",diagnostics:e.linkDiagnostics||{},lastError:e.message||String(e)});
    const box=form?.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>⚠️ Agent linków</span><h3>Nie udało się pobrać produktu</h3><small>${esc(e.message||e)}</small></div><span class="lvl lvl-ostrzezenie">ponowienie zaplanowane</span></header><div class="backend-note">Następna automatyczna próba: <b>${esc(new Date(nextRetryAt).toLocaleString("pl-PL"))}</b>. Możesz poprawić adres albo użyć przycisku ponownie ręcznie.</div></div>`;
    toast(`⚠️ Link zapisany; następna próba ${new Date(nextRetryAt).toLocaleString("pl-PL")}`);
  }
  finally{ btn.disabled=false; }
}

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

function agentAISubnavHTML(aktywny="pulpit"){
  const analiza=agentAIAnaliza();
  const aktywneZadania=agentAIAnalizaAktywna(analiza),problemy=aktywneZadania.length;
  const plan=aktywneZadania.length;
  const produktyWdrozenie=agentAIProduktyWdrozenie().length;
  const zlecenia=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length;
  const producenciGotowi=(producenciKartoteka||[]).filter(p=>p.active!==false&&p.orderEmail).length;
  const pamiec=(agentAIPamiec||[]).length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/agent-ai",label:"🤖 Pulpit",badge:problemy||""},
    {id:"komendy",href:"#/admin/agent-ai/komendy",label:"💬 Komendy"},
    {id:"specjalisci",href:"#/admin/agent-ai/specjalisci",label:"✦ Specjaliści GPT"},
    {id:"uprawnienia",href:"#/admin/agent-ai/uprawnienia",label:"🛡️ Uprawnienia"},
    {id:"plan",href:"#/admin/agent-ai/plan",label:"🧭 Plan operacyjny",badge:plan||""},
    {id:"produkty",href:"#/admin/agent-ai/produkty",label:"✨ Nowe produkty",badge:produktyWdrozenie||""},
    {id:"zakupy",href:"#/admin/magazyn/plan",label:"📦 Plan zatowarowania",badge:zlecenia||""},
    {id:"producenci",href:"#/admin/agent-ai/producenci",label:"🏭 Producenci i kontakt",badge:producenciGotowi||""},
    {id:"telegram",href:"#/admin/agent-ai/telegram",label:"✈️ Telegram",badge:agentAITelegram.stats?.critical||""},
    {id:"pamiec",href:"#/admin/agent-ai/pamiec",label:"🧠 Pamięć",badge:pamiec||""},
    {id:"historia",href:"#/admin/agent-ai/historia",label:"🕓 Historia",badge:Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).length||""}
  ],aktywny);
}
function klienciSubnavHTML(aktywny="lista"){
  const u=pobierzUzytkownikow();
  const admini=u.filter(x=>kontoMaRoleAdmin(x.email)).length;
  return adminSubnavHTML([
    {id:"lista",href:"#/admin/klienci",label:"👥 Lista klientów",badge:u.length},
    {id:"dodaj",href:"#/admin/klienci/dodaj",label:"➕ Dodaj klienta"},
    {id:"uprawnienia",href:"#/admin/klienci/uprawnienia",label:"🛡️ Uprawnienia",badge:admini},
    {id:"zamowienia",href:"#/admin/klienci/zamowienia",label:"📦 Zamówienia klientów"}
  ],aktywny);
}
function allegroZgodnoscPozycje(){
  const items=Array.isArray(allegroStan.complianceAudit?.items)?allegroStan.complianceAudit.items:[],q=String(szukajAllegroZgodnosc||"").trim().toLowerCase();
  return items.filter(item=>{
    const text=[item.offerId,item.name,item.status,...(item.violations||[]).flatMap(v=>[v.label,...(v.matches||[])])].join(" ").toLowerCase();
    const filtrOk=filtrAllegroZgodnosc==="wszystkie"||(filtrAllegroZgodnosc==="naruszenia"&&!item.ok)||(filtrAllegroZgodnosc==="naprawione"&&item.fixed)||(filtrAllegroZgodnosc==="poprawne"&&item.ok&&!item.fixed)||(filtrAllegroZgodnosc==="bledy"&&item.error);
    return filtrOk&&(!q||text.includes(q));
  });
}
function allegroZaznaczZgodnosc(ids=[],checked=true){for(const id of ids)checked?zaznaczoneAllegroZgodnosc.add(String(id)):zaznaczoneAllegroZgodnosc.delete(String(id));renderuj();}
async function allegroAudytujZgodnosc({fix=false,offerIds=[],offerId=""}={}){
  if(allegroZgodnoscBusy)return;
  allegroZgodnoscBusy=true;renderuj();
  try{
    const body={fix,activeOnly:true,limit:50};if(offerId)body.offerId=String(offerId).trim();if(Array.isArray(offerIds)&&offerIds.length)body.offerIds=offerIds.map(String).slice(0,50);
    const d=await chmura("allegro-offer-compliance",{method:"POST",body,timeout:180000});
    allegroStan={...allegroStan,complianceAudit:{items:Array.isArray(d.items)?d.items:[],summary:d.summary||{},updated_at:d.updated_at||null,policy:d.policy||null}};
    if(fix)zaznaczoneAllegroZgodnosc.clear();
    const s=d.summary||{};toast(fix?`✅ Kontrola Allegro: naprawiono ${s.fixed||0}, pozostało ${s.remaining||0}`:`🛡️ Sprawdzono ${s.checked||0} ofert • naruszenia: ${s.violations||0}`);
  }catch(e){toast("⚠️ Kontrola zgodności: "+(e.message||e));}
  allegroZgodnoscBusy=false;renderuj();
}
function allegroSprawdzOferteZFormularza(form,fix=false){const id=String(new FormData(form).get("offerId")||"").trim();if(!id){toast("Wpisz ID oferty Allegro");return;}void allegroAudytujZgodnosc({offerId:id,fix});}
function allegroZgodnoscPanelHTML(){
  const audit=allegroStan.complianceAudit||{},all=Array.isArray(audit.items)?audit.items:[],items=allegroZgodnoscPozycje(),open=all.filter(x=>!x.ok).length,fixed=all.filter(x=>x.fixed).length,errors=all.filter(x=>x.error).length,selected=[...zaznaczoneAllegroZgodnosc].filter(id=>items.some(x=>String(x.offerId)===id));
  return `<div class="panel allegro-section-panel allegro-compliance-page">
    <div class="order-section-head"><div><span class="order-pro-label">Ochrona konta sprzedawcy</span><h2>🛡️ Zgodność ofert z zasadami Allegro</h2><p class="order-detail-lead">Każdy opis jest oczyszczany i sprawdzany przed utworzeniem albo aktualizacją oferty. Publikacja zostaje zablokowana, jeśli pozostanie zaproszenie do kontaktu, sprawdzania dostępności, negocjacji, dane kontaktowe lub odsyłacz poza Allegro.</p></div><button class="btn" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroAudytujZgodnosc({fix:true})">${allegroZgodnoscBusy?"⏳ Kontroluję…":"🛡️ Sprawdź i napraw 50 ofert"}</button></div>
    <div class="allegro-compliance-guard"><span>✅</span><div><b>Blokada przed publikacją jest zawsze włączona</b><small>Nie można jej wyłączyć ustawieniem. Korekta zachowuje układ opisu Allegro: sekcje, nagłówki, akapity, pogrubienia, listy, zdjęcia i ich kolejność. Usuwany jest wyłącznie niedozwolony fragment.</small></div></div>
    <div class="orders-stat-grid">${[["📋",all.length,"skontrolowanych"],["⚠️",open,"wymaga naprawy"],["✅",fixed,"naprawionych automatycznie"],["⛔",errors,"błędów API"]].map(([i,n,l])=>`<button class="order-stat-card stat-filter ${l.includes("wymaga")&&n?"hot":l.includes("naprawionych")?"money":""}" onclick="filtrAllegroZgodnosc=${jsArg(l.includes("wymaga")?"naruszenia":l.includes("naprawionych")?"naprawione":l.includes("błędów")?"bledy":"wszystkie")};renderuj()"><span>${i}</span><b>${n}</b><small>${l}</small></button>`).join("")}</div>
    <form class="allegro-compliance-single" onsubmit="event.preventDefault();allegroSprawdzOferteZFormularza(this,false)"><div><b>Sprawdź konkretną ofertę</b><small>Wklej ID z adresu oferty, np. 12212218115.</small></div><input name="offerId" inputmode="numeric" placeholder="ID oferty Allegro" required><button class="btn ghost" type="submit" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź</button><button class="btn" type="button" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroSprawdzOferteZFormularza(this.form,true)">Sprawdź i napraw</button></form>
    <div class="orders-toolbar allegro-toolbar"><input placeholder="Szukaj: nazwa, ID, wykryty zwrot…" value="${esc(szukajAllegroZgodnosc)}" oninput="szukajAllegroZgodnosc=this.value;clearTimeout(window.__allegroComplianceSearch);window.__allegroComplianceSearch=setTimeout(()=>renderuj(),250)"><select onchange="filtrAllegroZgodnosc=this.value;renderuj()">${[["naruszenia","Wymaga naprawy"],["wszystkie","Wszystkie wyniki"],["naprawione","Naprawione"],["poprawne","Zgodne"],["bledy","Błędy API"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroZgodnosc===v?"selected":""}>${l}</option>`).join("")}</select><button class="btn ghost" onclick="allegroAudytujZgodnosc({fix:false})" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź 50</button></div>
    <div class="allegro-compliance-bulk"><label class="check"><input type="checkbox" onchange='allegroZaznaczZgodnosc(${JSON.stringify(items.map(x=>String(x.offerId)))},this.checked)'> Zaznacz widoczne (${items.length})</label><span>${selected.length} zaznaczonych</span><button class="btn" ${!selected.length||allegroZgodnoscBusy?"disabled":""} onclick='allegroAudytujZgodnosc({fix:true,offerIds:${JSON.stringify(selected)}})'>Napraw zaznaczone</button></div>
    <div class="warehouse-worktable-wrap"><table class="log-table allegro-compliance-table"><tr><th></th><th>Oferta</th><th>Status</th><th>Wynik kontroli</th><th>Wykryte treści</th><th>Akcje</th></tr>${items.map(item=>`<tr class="${item.ok?"is-safe":"has-risk"}"><td><input type="checkbox" ${zaznaczoneAllegroZgodnosc.has(String(item.offerId))?"checked":""} onchange="allegroZaznaczZgodnosc([${jsArg(String(item.offerId))}],this.checked)"></td><td><b>${esc(item.name||"Oferta")}</b><small>ID ${esc(item.offerId||"—")} • ${esc(item.checkedAt?new Date(item.checkedAt).toLocaleString("pl-PL"):"—")}</small></td><td><span class="lvl ${item.error?"lvl-bad":item.ok?"lvl-ok":"lvl-ostrzezenie"}">${item.error?"błąd API":item.fixed?"naprawiona":item.ok?"zgodna":"blokada"}</span><small>${esc(item.status||"—")}</small></td><td><b>${item.ok?"Brak aktywnego naruszenia":"Wymaga oczyszczenia"}</b>${item.removedCount?`<small>Usunięto ${esc(item.removedCount)} fragmentów</small>`:""}${item.fixed&&item.layoutPreserved===true?`<small>✅ Układ Allegro zachowany</small>`:""}${item.error?`<small class="compliance-error">${esc(item.error)}</small>`:""}</td><td>${(item.violations||[]).map(v=>`<span class="compliance-rule"><b>${esc(v.label)}</b><small>${esc((v.matches||[]).join(" • "))}</small></span>`).join("")||"—"}</td><td><div class="warehouse-worktable-actions"><a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(item.offerId||"")}" target="_blank" rel="noopener">Oferta ↗</a>${!item.ok?`<button class="btn" onclick="allegroAudytujZgodnosc({fix:true,offerId:${jsArg(String(item.offerId))}})" ${allegroZgodnoscBusy?"disabled":""}>Napraw</button>`:""}</div></td></tr>`).join("")||`<tr><td colspan="6">Brak wyników dla wybranego filtra. Uruchom audyt aktywnych ofert.</td></tr>`}</table></div>
    <div class="allegro-compliance-rules"><div><b>Treści usuwane lub blokowane</b><span>kontakt przed zakupem • sprawdzanie dostępności • negocjacja ceny • e-mail • telefon • zewnętrzna strona • sprzedaż poza Allegro</span><small>Wygląd pozostaje w formacie edytora Allegro — korekta nie spłaszcza opisu do zwykłego tekstu.</small></div><div class="diag-actions"><a class="btn ghost" href="https://help.allegro.com/pl/sell/a/sprzedaz-poza-allegro-i-omijanie-oplat-aMloER9LrH8" target="_blank" rel="noopener">Oficjalna zasada ↗</a><a class="btn ghost" href="https://help.allegro.com/pl/sell/c/jak-wystawiac-oferty" target="_blank" rel="noopener">Zasady opisów ↗</a></div></div>
  </div>`;
}
let allegroPanelStatyCache={oferty:null,zamowienia:null,mapowania:null,produkty:null,komunikacja:null,compliance:null,zadania:null,sync:null,result:null};
function allegroPanelOperacyjnyStaty(){
  const oferty=Array.isArray(allegroOferty)?allegroOferty:[],zamowienia=Array.isArray(allegroZamowienia)?allegroZamowienia:[],produktyZrodlo=produktyDoAdministracji(),compliance=allegroStan.complianceAudit?.items||[],zadania=agentAIAllegroZadania||[];
  const cache=allegroPanelStatyCache;
  if(cache.oferty===oferty&&cache.zamowienia===zamowienia&&cache.mapowania===allegroMapowania&&cache.produkty===produktyZrodlo&&cache.komunikacja===allegroKomunikacja&&cache.compliance===compliance&&cache.zadania===zadania&&cache.sync===allegroStan.offerSyncState&&cache.result)return cache.result;
  const komunikacja=allegroKomunikacjaStaty(),produkty=produktyZrodlo.filter(p=>!czyProduktAdminWKoszu(p)),produktIds=new Set(produkty.map(p=>String(p.id)));
  let podpiete=0;
  for(const oferta of oferty){
    const id=allegroProduktIdDlaOferty(oferta.id);
    if(id&&produktIds.has(String(id)))podpiete++;
  }
  const aktywneZamowienia=zamowienia.filter(statusAllegroRezerwujeMagazyn),braki=aktywneZamowienia.filter(z=>allegroEtapMagazynu(z)==="braki");
  const liczbaOfert=allegroDaneZaladowane.offers?oferty.length:Number(allegroPodsumowanie.offers?.count||0),liczbaPodpietych=allegroDaneZaladowane.offers?podpiete:Number(allegroPodsumowanie.offers?.mapped||0),liczbaAktywnych=allegroDaneZaladowane.orders?aktywneZamowienia.length:Number(allegroPodsumowanie.orders?.active||0);
  const zadaniaWystawiania=allegroAktywneZadaniaAgentaOfert().length,naruszenia=compliance.filter(x=>!x.ok&&!x.fixed&&!x.error).length;
  const pilne=liczbaAktywnych+komunikacja.threadNeed+komunikacja.issueNeed+naruszenia;
  const result={oferty:liczbaOfert,podpiete:liczbaPodpietych,niepodpiete:Math.max(0,liczbaOfert-liczbaPodpietych),produkty:produkty.length,aktywneZamowienia:liczbaAktywnych,braki:allegroDaneZaladowane.orders?braki.length:0,zadaniaWystawiania,wiadomosci:komunikacja.threadNeed,dyskusje:komunikacja.issueNeed,naruszenia,pilne,synchronizacja:allegroStan.offerSyncState||{}};
  allegroPanelStatyCache={oferty,zamowienia,mapowania:allegroMapowania,produkty:produktyZrodlo,komunikacja:allegroKomunikacja,compliance,zadania,sync:allegroStan.offerSyncState,result};return result;
}
function allegroSubnavHTML(aktywny="start",st=allegroPanelOperacyjnyStaty()){
  const zadaniaWystawiania=st.zadaniaWystawiania;
  return adminSubnavHTML([
    {id:"start",href:"#/admin/allegro",label:"📊 Pulpit"},
    {id:"zamowienia",href:"#/admin/allegro/zamowienia",label:"📦 Zamówienia",badge:st.aktywneZamowienia||""},
    {id:"oferty",href:"#/admin/allegro/oferty",label:"🏷️ Oferty"},
    {id:"wystawianie",href:"#/admin/allegro/wystawianie",label:"🟠 Wystawianie",badge:zadaniaWystawiania||""},
    {id:"rentownosc",href:"#/admin/allegro/rentownosc",label:"📈 Opłacalność"},
    {id:"wiadomosci",href:"#/admin/allegro/wiadomosci",label:"💬 Wiadomości",badge:st.wiadomosci||""},
    {id:"dyskusje",href:"#/admin/allegro/dyskusje",label:"🛟 Dyskusje",badge:st.dyskusje||""},
    {id:"tabela",href:"#/admin/magazyn/plan",label:"📦 Plan zatowarowania"},
    {id:"zgodnosc",href:"#/admin/allegro/zgodnosc",label:"🛡️ Zgodność",badge:st.naruszenia||""},
    {id:"ustawienia",href:"#/admin/allegro/ustawienia",label:"⚙️ Ustawienia"}
  ],aktywny);
}
function allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete,st=allegroPanelOperacyjnyStaty()){
  const cfg={
    start:{ico:"🟠",kicker:"Centrum Allegro",title:"Pulpit integracji",opis:"Jedno miejsce do kontroli zamówień, katalogu ofert, wystawiania i komunikacji.",metryki:[["Połączenie",allegroStan.connected?"Aktywne":"Wymaga uwagi"],["Oferty",st.oferty],["Do obsługi",st.aktywneZamowienia]]},
    zamowienia:{ico:"📦",kicker:"Sprzedaż",title:"Kolejka zamówień Allegro",opis:"Status pochodzi z Allegro. Obsługa sprawdza rozpoznanie, stan i realny brak; fizyczne miejsce prowadzi osobno magazyn.",metryki:[["Do obsługi",st.aktywneZamowienia],["Z brakami",st.braki],["Ostatni odczyt",allegroDataTxt(allegroPodsumowanie.orders?.updated_at)||"oczekuje"]]},
    oferty:{ico:"🏷️",kicker:"Katalog Allegro",title:"Oferty i powiązania",opis:"Profesjonalny katalog ofert z miniaturą, identyfikatorami, ceną, stanem i kontrolą powiązania z produktem sklepu.",metryki:[["Wszystkie",st.oferty],["Podpięte",mapped],["Do powiązania",niepodpiete]]},
    wystawianie:{ico:"🟠",kicker:"Publikowanie",title:"Przygotowanie ofert",opis:"Kontrola kompletności danych produktu przed utworzeniem bezpiecznego szkicu oferty.",metryki:[["Produkty",st.produkty],["Zadania agenta",st.zadaniaWystawiania],["Widok","stronicowany"]]},
    rentownosc:{ico:"📈",kicker:"Finanse produktu",title:"Opłacalność sklepu i Allegro",opis:"Dwa oddzielne modele kosztów, osobne cele marży i rekomendowane ceny. Allegro korzysta z prowizji pobieranej bezpośrednio przez API.",metryki:[["Produkty",st.produkty],["Kalkulacja","na aktywnej stronie"],["Cele",`Sklep ${sklepDocelowaMarza}% • Allegro ${allegroDocelowaMarza}%`]]},
    wiadomosci:{ico:"💬",kicker:"Obsługa klienta",title:"Centrum wiadomości",opis:"Wyszukiwanie, filtry, historia korespondencji i wewnętrzne zamykanie spraw bez wysyłania wiadomości.",metryki:[["Wątki",allegroKomunikacjaStaty().threads.length],["Do odpowiedzi",allegroKomunikacjaStaty().threadNeed],["Załatwione",allegroKomunikacjaStaty().threads.filter(allegroKomunikacjaZalatwiona).length]]},
    dyskusje:{ico:"🛟",kicker:"Dyskusje i reklamacje",title:"Obsługa zgłoszeń Allegro",opis:"Oddzielny rejestr dyskusji i reklamacji z filtrami oficjalnego statusu oraz statusem wewnętrznym.",metryki:[["Zgłoszenia",allegroKomunikacjaStaty().issues.length],["Do odpowiedzi",allegroKomunikacjaStaty().issueNeed],["Załatwione",allegroKomunikacjaStaty().issues.filter(allegroKomunikacjaZalatwiona).length]]},
    zgodnosc:{ico:"🛡️",kicker:"Bezpieczeństwo opisów",title:"Ochrona ofert Allegro",opis:"Tarcza wykrywa treści naruszające zasady Allegro, blokuje ryzykowną publikację i naprawia opis bez zmiany jego układu.",metryki:[["Skontrolowane",(allegroStan.complianceAudit?.items||[]).length],["Do naprawy",(allegroStan.complianceAudit?.items||[]).filter(x=>!x.ok&&!x.fixed&&!x.error).length],["Naprawione",(allegroStan.complianceAudit?.items||[]).filter(x=>x.fixed).length]]},
    ustawienia:{ico:"⚙️",kicker:"Konfiguracja",title:"Ustawienia integracji Allegro",opis:"Połączenie OAuth, zakresy uprawnień, środowisko i kontrola synchronizacji w jednym miejscu.",metryki:[["API",allegroStan.configured?"OK":"Brak"],["OAuth",allegroStan.connected?"Połączone":"Rozłączone"],["Środowisko",allegroStan.env||"production"]]}
  }[aktywna]||{};
  return `<section class="panel allegro-workspace-section"><div class="allegro-workspace-title"><span>${cfg.ico||"🟠"}</span><div><small>${esc(cfg.kicker||"Allegro")}</small><h2>${esc(cfg.title||"Panel Allegro")}</h2><p>${esc(cfg.opis||"")}</p></div></div><div class="allegro-workspace-metrics">${(cfg.metryki||[]).map(([l,v])=>`<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join("")}</div></section>`;
}
function allegroStartPanelHTML(st=allegroPanelOperacyjnyStaty()){
  const sync=st.synchronizacja||{},ostatniaOferta=sync.lastLightSyncAt||sync.lastFullSyncAt,ostatniaKomunikacja=allegroKomunikacja?.updated_at;
  const kolejka=[
    {n:st.aktywneZamowienia,ico:"📦",tytul:"Zamówienia do obsługi",opis:st.braki?`${st.braki} ma realne braki do Planu zatowarowania`:"sprawdzenie rozpoznania, stanu i kompletacji",href:"#/admin/allegro/zamowienia",akcja:"Otwórz zlecenia"},
    {n:st.wiadomosci,ico:"💬",tytul:"Wiadomości wymagające odpowiedzi",opis:"wyłącznie nowe, niezałatwione sprawy klientów",href:"#/admin/allegro/wiadomosci",akcja:"Otwórz wiadomości"},
    {n:st.dyskusje,ico:"🛟",tytul:"Dyskusje wymagające reakcji",opis:"status wewnętrzny nie zmienia danych Allegro",href:"#/admin/allegro/dyskusje",akcja:"Otwórz dyskusje"},
    {n:st.naruszenia,ico:"🛡️",tytul:"Oferty wymagające kontroli zgodności",opis:"publikacja pozostaje chroniona blokadą treści",href:"#/admin/allegro/zgodnosc",akcja:"Otwórz kontrolę"}
  ].filter(x=>x.n>0);
  const katalogProc=st.oferty?Math.round(st.podpiete/st.oferty*100):100;
  return `<div class="allegro-command-center">
    <section class="panel allegro-command-hero">
      <div class="allegro-command-hero-copy"><span class="order-pro-label">Centrum operacyjne sprzedaży</span><h1>🟠 Panel Allegro</h1><p>Zlecenia, katalog ofert, publikowanie, opłacalność i obsługa klienta są rozdzielone na jasne etapy. Liczniki w menu pokazują wyłącznie realną pracę — nigdy rozmiar całego katalogu.</p><div class="allegro-command-health"><span class="${allegroStan.connected?"ok":"warning"}"><i></i>${allegroStan.connected?"API Allegro połączone":"Połączenie wymaga uwagi"}</span><span>↻ zamówienia i komunikacja co 15 min</span><span>🏷️ ostatni odczyt ofert: ${esc(ostatniaOferta?allegroDataTxt(ostatniaOferta):"oczekuje")}</span></div></div>
      <div class="allegro-command-hero-actions"><a class="btn" href="#/admin/allegro/zamowienia">📦 Obsłuż zamówienia${st.aktywneZamowienia?` (${st.aktywneZamowienia})`:""}</a><a class="btn ghost" href="#/admin/allegro/wystawianie">🟠 Wystaw produkt</a><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia integracji</a></div>
    </section>
    <div class="orders-stat-grid allegro-command-kpis">
      <a class="order-stat-card stat-filter ${st.aktywneZamowienia?"hot":"money"}" href="#/admin/allegro/zamowienia"><span>📦</span><b>${st.aktywneZamowienia}</b><small>zamówień do obsługi</small></a>
      <a class="order-stat-card stat-filter ${st.braki?"hot":""}" href="#/admin/magazyn/plan"><span>🧾</span><b>${st.braki}</b><small>zleceń z brakami</small></a>
      <a class="order-stat-card stat-filter ${st.wiadomosci?"hot":""}" href="#/admin/allegro/wiadomosci"><span>💬</span><b>${st.wiadomosci}</b><small>wiadomości do odpowiedzi</small></a>
      <a class="order-stat-card stat-filter ${st.dyskusje?"hot":""}" href="#/admin/allegro/dyskusje"><span>🛟</span><b>${st.dyskusje}</b><small>dyskusji do reakcji</small></a>
      <a class="order-stat-card stat-filter ${st.naruszenia?"hot":"money"}" href="#/admin/allegro/zgodnosc"><span>🛡️</span><b>${st.naruszenia}</b><small>otwartych kontroli zgodności</small></a>
    </div>
    <div class="allegro-command-layout">
      <section class="panel allegro-command-priorities"><div class="order-section-head"><div><span class="order-pro-label">Kolejka pracy</span><h2>Co wymaga działania</h2><p class="order-detail-lead">Lista zawiera tylko niezakończone sprawy. Cały katalog ofert pozostaje informacją, nie alarmem.</p></div><span class="allegro-action-total ${st.pilne?"has-work":"is-clear"}">${st.pilne?`${st.pilne} do obsługi`:"Wszystko pod kontrolą"}</span></div>${kolejka.length?`<div class="allegro-priority-list">${kolejka.map(x=>`<a href="${x.href}"><span>${x.ico}</span><div><b>${esc(x.tytul)}</b><small>${esc(x.opis)}</small></div><strong>${x.n}</strong><em>${esc(x.akcja)} →</em></a>`).join("")}</div>`:`<div class="allegro-command-empty"><span>✅</span><div><b>Brak pilnych spraw</b><small>Nowe zamówienia i wiadomości pojawią się tu po kolejnej synchronizacji.</small></div></div>`}</section>
      <section class="panel allegro-catalog-overview"><div class="order-section-head"><div><span class="order-pro-label">Katalog sprzedażowy</span><h2>Oferty i powiązania</h2><p class="order-detail-lead">Liczby katalogowe są widoczne tutaj, bez pomarańczowego alarmu w menu.</p></div><a class="btn ghost" href="#/admin/allegro/oferty">Otwórz katalog</a></div><div class="allegro-catalog-progress"><div><b>${katalogProc}%</b><small>ofert podpiętych do produktów sklepu</small></div><progress max="100" value="${katalogProc}"></progress></div><div class="allegro-catalog-numbers"><span><small>Wszystkie oferty</small><b>${st.oferty}</b></span><span class="ok"><small>Podpięte</small><b>${st.podpiete}</b></span><span class="${st.niepodpiete?"warning":"ok"}"><small>Do powiązania</small><b>${st.niepodpiete}</b></span><span><small>Produkty sklepu</small><b>${st.produkty}</b></span></div></section>
    </div>
    <section class="panel allegro-system-overview"><div class="order-section-head"><div><span class="order-pro-label">Automatyka i integracje</span><h2>Stan kanałów Allegro</h2></div><a class="btn ghost" href="#/admin/allegro/ustawienia">Pełne ustawienia</a></div><div class="allegro-system-grid"><article><span class="${allegroStan.connected?"ok":"warning"}">${allegroStan.connected?"✓":"!"}</span><div><b>Połączenie API</b><small>${allegroStan.connected?"Autoryzacja aktywna":"Wymaga ponownego połączenia"}</small></div></article><article><span class="ok">↻</span><div><b>Zamówienia</b><small>automatyczna kontrola co 15 minut</small></div></article><article><span class="ok">🏷️</span><div><b>Oferty</b><small>${esc(ostatniaOferta?`ostatnio ${allegroDataTxt(ostatniaOferta)}`:"pierwsza synchronizacja oczekuje")}</small></div></article><article><span class="${ostatniaKomunikacja?"ok":"neutral"}">💬</span><div><b>Wiadomości i dyskusje</b><small>${esc(ostatniaKomunikacja?`ostatnio ${allegroDataTxt(ostatniaKomunikacja)}`:"brak ostatniego odczytu")}</small></div></article><article><span class="ok">🛡️</span><div><b>Ochrona opisów</b><small>blokada treści niezgodnych przed publikacją</small></div></article><article><span class="neutral">📈</span><div><b>Opłacalność</b><small>ceny sklepu i Allegro liczone osobno</small></div></article></div></section>
    <section class="panel allegro-module-directory"><div class="order-section-head"><div><span class="order-pro-label">Nawigacja procesowa</span><h2>Wszystkie obszary pracy</h2></div></div><div>${[["📦","Zamówienia","Zlecenia, stan, braki i realizacja","#/admin/allegro/zamowienia"],["🏷️","Oferty","Katalog i powiązania produktów","#/admin/allegro/oferty"],["🟠","Wystawianie","Przygotowanie i publikowanie","#/admin/allegro/wystawianie"],["📈","Opłacalność","Marża, prowizje i rekomendacje","#/admin/allegro/rentownosc"],["💬","Wiadomości","Korespondencja z klientami","#/admin/allegro/wiadomosci"],["🛟","Dyskusje","Reklamacje i sprawy formalne","#/admin/allegro/dyskusje"],["🛡️","Zgodność","Kontrola opisów i bezpieczeństwo","#/admin/allegro/zgodnosc"],["⚙️","Ustawienia","OAuth, synchronizacja i automatyka","#/admin/allegro/ustawienia"]].map(([i,t,d,h])=>`<a href="${h}"><span>${i}</span><div><b>${t}</b><small>${d}</small></div><em>→</em></a>`).join("")}</div></section>
  </div>`;
}
function allegroPostepUstawienHTML(){
  const o=allegroOperacjaUstawien;
  if(!o.busy&&!o.done&&!o.error)return "";
  const pct=o.total?Math.round(o.done/o.total*100):0;
  return `<div class="allegro-settings-progress ${o.error?"has-error":""}"><div><b>${o.busy?`Aktualizuję istniejące oferty: ${o.done}/${o.total}`:o.error?"Aktualizacja przerwana":"Aktualizacja istniejących ofert zakończona"}</b><small>Stan zmieniony: ${o.stockUpdated} • błędy stanu: ${o.stockFailed} • wznawianie: ${o.republishUpdated} • starsze oferty do uzupełnienia: ${o.republishFailed}</small></div><div class="allegro-settings-progress-bar"><i style="width:${pct}%"></i></div>${o.error?`<p>${esc(o.error)}</p>`:""}</div>`;
}
async function allegroZastosujUstawieniaDoIstniejacych(){
  const ids=[...new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean))];
  allegroOperacjaUstawien={busy:true,done:0,total:ids.length,stockUpdated:0,stockFailed:0,republishUpdated:0,republishFailed:0,error:""};renderuj();
  try{
    for(let i=0;i<ids.length;i+=50){
      const batch=ids.slice(i,i+50),d=await chmura("allegro-apply-offer-defaults",{method:"POST",body:{offerIds:batch},timeout:180000});
      allegroOperacjaUstawien={...allegroOperacjaUstawien,done:i+batch.length,stockUpdated:allegroOperacjaUstawien.stockUpdated+Number(d.stockUpdated||0),stockFailed:allegroOperacjaUstawien.stockFailed+Number(d.stockFailed||0),republishUpdated:allegroOperacjaUstawien.republishUpdated+Number(d.republishUpdated||0),republishFailed:allegroOperacjaUstawien.republishFailed+Number(d.republishFailed||0)};
      renderuj();
    }
    const sync=await chmura("allegro-sync-offers",{method:"POST",body:{limit:10000,details:false},timeout:180000});
    allegroOferty=Array.isArray(sync.offers)?sync.offers:allegroOferty;allegroMapowania=sync.mappings||allegroMapowania;
    allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false};
    await allegroWczytajDane(true);allegroZapiszCache();toast(`✅ Stan ${allegroStanOfertyProduktu()} zapisany dla ${allegroOperacjaUstawien.stockUpdated} ofert`);renderuj();
  }catch(e){allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false,error:e.message||String(e)};toast("⚠️ Aktualizacja ofert: "+(e.message||e));renderuj();}
}
async function allegroZapiszUstawieniaOfert(form){
  const fd=new FormData(form),defaultStock=Number(fd.get("defaultStock")),applyExisting=fd.get("applyExisting")==="on";
  if(!Number.isInteger(defaultStock)||defaultStock<1||defaultStock>99999){toast("Podaj stan od 1 do 99999 szt.");return;}
  const producers=String(fd.get("producers")||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).slice(0,50);
  if(!producers.length){toast("Dodaj przynajmniej jednego producenta.");return;}
  try{
    const d=await chmura("allegro-offer-settings",{method:"POST",body:{
      defaultStock,producers,
      autoMapping:fd.get("autoMapping")==="on",
      mappingMinScore:Number(fd.get("mappingMinScore")||88),
      lightSyncMinutes:Number(fd.get("lightSyncMinutes")||15),
      fullSyncHours:Number(fd.get("fullSyncHours")||6),
      autoCatalog:fd.get("autoCatalog")==="on",
      syncDescriptions:fd.get("syncDescriptions")==="on",
      autoUpdateOffers:fd.get("autoUpdateOffers")==="on",
      autoFees:fd.get("autoFees")==="on",
      autoCorrections:fd.get("autoCorrections")==="on",
      autonomousAgent:fd.get("autonomousAgent")==="on",
      autonomousAgentMinutes:Number(fd.get("autonomousAgentMinutes")||15),
      autoResolveDuplicates:fd.get("autoResolveDuplicates")==="on",
      autoResolveDuplicateMinScore:Number(fd.get("autoResolveDuplicateMinScore")||97)
    },timeout:12000});
    allegroStan={...allegroStan,offerSettings:d.settings||{defaultStock,republish:true}};
    toast(`Zapisano automatykę Allegro i ${producers.length} producentów.`);renderuj();
    if(allegroStan.offerSettings.autoMapping!==false)await allegroUruchomAutomatyczneMapowanie(true);
    if(applyExisting)await allegroZastosujUstawieniaDoIstniejacych();
  }catch(e){toast("⚠️ Ustawienia ofert Allegro: "+(e.message||e));}
}
async function allegroUruchomAutomatycznaKonserwacje(){
  try{toast("🟠 Agent sprawdza katalog, opisy i producentów…");const d=await chmura("allegro-auto-maintenance",{method:"POST",body:{limit:50},timeout:180000});await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true);const r=d.maintenance||{};toast(`✅ Sprawdzono ${r.scanned||0}, poprawiono ${r.updated||0}, katalog dopasowano dla ${r.matched||0} produktów.`);}catch(e){toast("⚠️ Automatyka katalogu Allegro: "+(e.message||e));}
}
async function allegroUruchomAgentAutonomiczny(){
  try{
    toast("🤖 Agent analizuje powiązania i bezpieczne duplikaty…");
    const d=await chmura("allegro-autonomous-agent-cycle",{method:"POST",body:{source:"manual-admin",maxActions:10},timeout:180000});
    if(Array.isArray(d.offers))allegroOferty=d.offers;if(d.mappings&&typeof d.mappings==="object")allegroMapowania=d.mappings;
    allegroStan={...allegroStan,autonomousAgent:d.state||allegroStan.autonomousAgent};allegroZapiszCache();
    const s=d.state||{},m=s.mapping||{};toast(`✅ Agent: połączono ${m.autoMapped||0}, zakończono duplikatów ${s.duplicateOffersEnded||0}, do decyzji ${s.reviewCount||0}`);renderuj();
  }catch(e){toast("⚠️ Autonomiczny Agent Allegro: "+(e.message||e));}
}
function allegroProduktMaPelneDaneMarzowe(p={}){return kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))&&!!p.allegroFeeCalculatedAt;}
function rentownoscSygnaturaWeryfikacji(p={}){
  const effective=field=>typeof wartoscKosztuProduktu==="function"?wartoscKosztuProduktu(p,field):kwotaNum(p[field]);
  return JSON.stringify({
    purchase:kwotaNum(p.cenaZakupu),storePrice:kwotaNum(p.cena),allegroPrice:kwotaNum(p.cenaAllegro||p.cena),
    commission:kwotaNum(p.allegroCommissionAmount),commissionRate:Number(p.allegroCommissionRate)||0,recurring:kwotaNum(p.allegroRecurringFees),
    packing:effective("kosztPakowania"),storeOther:effective("sklepAdditionalCost"),storePayment:effective("sklepPaymentPercent"),
    allegroOther:effective("allegroAdditionalCost"),shipping:effective("allegroShippingSubsidy"),ads:effective("allegroAdsPercent"),vat:effective("vatRate"),
    storeTarget:Number(p.sklepPriceTargetMargin||sklepDocelowaMarza)||0,allegroTarget:Number(p.allegroPriceTargetMargin||allegroDocelowaMarza)||0,
    recurringUnits:Number(allegroJednostkiOplatCyklicznych)||1
  });
}
function rentownoscStatusWeryfikacji(p={}){
  if(p.profitabilityReviewed!==true)return "unreviewed";
  return String(p.profitabilityReviewSignature||"")===rentownoscSygnaturaWeryfikacji(p)?"reviewed":"outdated";
}
function rentownoscPolaWeryfikacji(p={},approved=true,at=new Date().toISOString()){
  if(!approved)return {profitabilityReviewed:false};
  const store=sklepRentownoscProduktu(p),allegro=allegroRentownoscProduktu(p);
  return {profitabilityReviewed:true,profitabilityReviewedAt:at,profitabilityReviewedBy:sesja?.email||"administrator",profitabilityReviewSignature:rentownoscSygnaturaWeryfikacji(p),profitabilityReviewSnapshot:{storePrice:store.price,allegroPrice:allegro.price,purchasePrice:kwotaNum(p.cenaZakupu),storeMargin:store.margin,allegroMargin:allegro.margin,storeTarget:Number(p.sklepPriceTargetMargin||sklepDocelowaMarza)||0,allegroTarget:Number(p.allegroPriceTargetMargin||allegroDocelowaMarza)||0},profitabilityReviewRevision:1};
}
function rentownoscZapiszWeryfikacje(ids=[],approved=true){
  const unique=[...new Set(ids.map(String))],products=new Map(produktyDoAdministracji().map(p=>[String(p.id),p])),at=new Date().toISOString();let changed=0;
  for(const id of unique){const p=products.get(id);if(!p||czyProduktAdminWKoszu(p))continue;const patch=rentownoscPolaWeryfikacji(p,approved,at),idx=produktyDodane.findIndex(x=>String(x.id)===id);if(idx>=0)produktyDodane[idx]={...produktyDodane[idx],...patch};else produktyEdytowane={...produktyEdytowane,[id]:{...(produktyEdytowane[id]||{}),...patch}};changed++;}
  if(!changed)return 0;
  zapiszLS("artway_produkty_dodane",produktyDodane);zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();zaplanujZapisUstawien();
  zapiszHistorieAgenta("kontrola-rentownosci",`${approved?"Zatwierdzono":"Cofnięto zatwierdzenie"} kalkulacji rentowności: ${changed}`,{productIds:unique.slice(0,500),approved});
  return changed;
}
function ustawFiltrAllegroRentownosc(value="wszystkie"){filtrAllegroRentownosc=value;renderuj();}
function oznaczRentownoscSprawdzona(productId,approved=true){const changed=rentownoscZapiszWeryfikacje([productId],approved);if(changed)toast(approved?"✅ Produkt oznaczony jako sprawdzony według Twojego ustawienia":"Cofnięto oznaczenie produktu jako sprawdzony");renderuj();}
function przelaczZaznaczenieRentownosci(productId,checked){const id=String(productId);checked?zaznaczoneRentownosc.add(id):zaznaczoneRentownosc.delete(id);renderuj();}
function zaznaczWidoczneRentownosc(){for(const {p} of allegroRentownoscLista().slice(0,500))zaznaczoneRentownosc.add(String(p.id));renderuj();}
function wyczyscZaznaczenieRentownosci(){zaznaczoneRentownosc.clear();renderuj();}
function oznaczZaznaczoneRentownosc(approved=true){const ids=[...zaznaczoneRentownosc];if(!ids.length){toast("Najpierw zaznacz produkty");return;}const changed=rentownoscZapiszWeryfikacje(ids,approved);zaznaczoneRentownosc.clear();toast(`${approved?"✅ Oznaczono jako sprawdzone":"Cofnięto oznaczenie"}: ${changed} produktów`);renderuj();}
function rentownoscStatusWeryfikacjiHTML(p={}){const status=rentownoscStatusWeryfikacji(p);if(status==="reviewed"){const snapshot=p.profitabilityReviewSnapshot||{};return `<span class="profit-review-status reviewed"><b>✅ Sprawdzone przeze mnie</b><small>${p.profitabilityReviewedAt?esc(new Date(p.profitabilityReviewedAt).toLocaleString("pl-PL")):"zatwierdzone"}${snapshot.storePrice||snapshot.allegroPrice?` • sklep ${snapshot.storePrice?zl(snapshot.storePrice):"—"} • Allegro ${snapshot.allegroPrice?zl(snapshot.allegroPrice):"—"}`:""}</small></span>`;}if(status==="outdated")return `<span class="profit-review-status outdated"><b>⚠️ Sprawdź ponownie</b><small>Od zatwierdzenia zmieniła się cena, koszt, prowizja lub cel marży.</small></span>`;return `<span class="profit-review-status unreviewed"><b>○ Jeszcze niesprawdzone</b><small>Oznacz po ustawieniu właściwej ceny i marży.</small></span>`;}
function allegroRentownoscLista(){
  const q=String(szukajAllegroRentownosc||"").toLowerCase().trim();let list=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>({p,r:allegroRentownoscProduktu(p)})).filter(({p,r})=>{const review=rentownoscStatusWeryfikacji(p);if(q&&!`${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||""} ${p.kategoria||""}`.toLowerCase().includes(q))return false;if(filtrAllegroRentownosc==="niesprawdzone"&&review!=="unreviewed")return false;if(filtrAllegroRentownosc==="sprawdzone"&&review!=="reviewed")return false;if(filtrAllegroRentownosc==="nieaktualne"&&review!=="outdated")return false;if(filtrAllegroRentownosc==="kompletne"&&!r.dataComplete)return false;if(filtrAllegroRentownosc==="brak_prowizji"&&p.allegroFeeCalculatedAt)return false;if(filtrAllegroRentownosc==="strata"&&r.profit>=0)return false;if(filtrAllegroRentownosc==="niska"&&(!r.dataComplete||r.margin>=allegroDocelowaMarza))return false;if(filtrAllegroRentownosc==="oplacalne"&&(!r.dataComplete||r.margin<allegroDocelowaMarza))return false;return true;});
  list.sort((a,b)=>sortAllegroRentownosc==="marza_malejaco"?b.r.margin-a.r.margin:sortAllegroRentownosc==="nazwa"?String(a.p.nazwa).localeCompare(String(b.p.nazwa),"pl"):a.r.margin-b.r.margin);return list;
}
function produktDlaWyboruMarzy(productId){return produktyDoAdministracji().find(p=>String(p.id)===String(productId))||null;}
function wyborCenyMarzowejHTML(p={},kanal="allegro"){
  const isStore=kanal==="sklep",defaultTarget=isStore?sklepDocelowaMarza:allegroDocelowaMarza,savedTarget=Number(p[isStore?"sklepPriceTargetMargin":"allegroPriceTargetMargin"]),target=Math.max(.1,Math.min(75,Number.isFinite(savedTarget)&&savedTarget>0?savedTarget:defaultTarget)),r=isStore?sklepRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target),presets=[10,15,20,25,30],preset=presets.includes(target)?String(target):"custom";
  return `<div class="profit-price-picker ${isStore?"store":"allegro"}" data-profit-choice data-product-id="${esc(p.id)}" data-channel="${kanal}"><label>Wariant marży<select data-profit-margin-preset onchange="aktualizujWyborCenyMarzowej(this,'preset')">${presets.map(v=>`<option value="${v}" ${preset===String(v)?"selected":""}>${v}% marży</option>`).join("")}<option value="custom" ${preset==="custom"?"selected":""}>Własna marża</option></select></label><div class="profit-price-fields"><label>Marża %<input data-profit-margin type="number" min="0.1" max="75" step="0.1" value="${esc(target)}" oninput="aktualizujWyborCenyMarzowej(this,'margin')"></label><label>Cena zł<input data-profit-price inputmode="decimal" value="${r.recommended?esc(r.recommended.toFixed(2)):""}" oninput="aktualizujWyborCenyMarzowej(this,'price')"></label></div><small data-profit-choice-result>${r.recommended?`Wybrana marża ${target.toFixed(1)}% → ${zl(r.recommended)}`:"Uzupełnij cenę zakupu i koszty"}</small><button class="btn ${isStore?"ghost":""}" type="button" ${r.recommended?"":"disabled"} onclick="zastosujWyborCenyMarzowej(this)">${isStore?"🏪 Zastosuj w sklepie":"🟠 Opublikuj na Allegro"}</button></div>`;
}
function aktualizujWyborCenyMarzowej(el,source="margin"){
  const box=el?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId);if(!p)return;
  const kanal=box.dataset.channel==="sklep"?"sklep":"allegro",preset=box.querySelector("[data-profit-margin-preset]"),marginInput=box.querySelector("[data-profit-margin]"),priceInput=box.querySelector("[data-profit-price]"),result=box.querySelector("[data-profit-choice-result]"),button=box.querySelector("button");
  if(source==="preset"){if(preset.value!=="custom")marginInput.value=preset.value;else marginInput.focus();}
  if(source==="margin")preset.value="custom";
  const target=Math.max(.1,Math.min(75,Number(String(marginInput.value).replace(",","."))||0));
  if(source!=="price"){const recommendation=kanal==="sklep"?sklepRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target);priceInput.value=recommendation.recommended?recommendation.recommended.toFixed(2):"";}
  const price=kwotaNum(priceInput.value),actual=kanal==="sklep"?sklepRentownoscProduktu(p,price,target):allegroRentownoscProduktu(p,price,target);
  result.textContent=price?`Cena ${zl(price)} • zysk ${zl(actual.profit)} • rzeczywista marża ${actual.margin.toFixed(2)}%`:"Wpisz marżę albo własną cenę";button.disabled=!price||kwotaNum(p.cenaZakupu)<=0;
}
async function zastosujWyborCenyMarzowej(button){
  const box=button?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId),kanal=box.dataset.channel==="sklep"?"sklep":"allegro",price=kwotaNum(box.querySelector("[data-profit-price]")?.value);if(!p||!price){toast("Uzupełnij prawidłową cenę");return;}
  const calculation=kanal==="sklep"?sklepRentownoscProduktu(p,price):allegroRentownoscProduktu(p,price);button.disabled=true;button.textContent=kanal==="sklep"?"⏳ Zapisuję…":"⏳ Publikuję…";try{await ustawRekomendowanaCeneProduktu(p.id,kanal,price,calculation.margin);}catch(e){toast("⚠️ Nie udało się zastosować ceny: "+(e.message||e));button.disabled=false;}
}
function allegroScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"allegro");}
function allegroRentownoscPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),complete=all.filter(allegroProduktMaPelneDaneMarzowe),rows=allegroRentownoscLista(),loss=complete.filter(p=>allegroRentownoscProduktu(p).profit<0).length,low=complete.filter(p=>{const r=allegroRentownoscProduktu(p);return r.profit>=0&&r.margin<allegroDocelowaMarza;}).length,good=complete.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length;
  return `<div class="panel allegro-section-panel profitability-page"><div class="order-section-head"><div><span class="order-pro-label">Decyzje cenowe</span><h2>📈 Opłacalność i wyliczenie marżowe</h2><p class="order-detail-lead">Zaawansowany przelicznik dla gier i pozostałych produktów z ceną zakupu, ceną sprzedaży oraz prowizją pobraną z Allegro. Rozdziela prowizję sprzedażową, opłaty cykliczne, reklamę, pakowanie, dopłatę do dostawy i inne koszty.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Pobierz prowizje dla kompletnych produktów</button></div><div class="orders-stat-grid"><div class="order-stat-card"><span>🧮</span><b>${complete.length}</b><small>pełnych kalkulacji</small></div><div class="order-stat-card ${loss?"hot":""}"><span>🔴</span><b>${loss}</b><small>sprzedaż ze stratą</small></div><div class="order-stat-card ${low?"hot":""}"><span>🟡</span><b>${low}</b><small>poniżej celu ${allegroDocelowaMarza}%</small></div><div class="order-stat-card money"><span>🟢</span><b>${good}</b><small>osiąga cel marży</small></div></div><div class="profitability-controls"><input placeholder="Szukaj: nazwa, SKU, EAN, producent, kategoria…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="filtrAllegroRentownosc=this.value;renderuj()">${[["kompletne","Pełne dane"],["wszystkie","Wszystkie produkty"],["brak_prowizji","Brak pobranej prowizji"],["strata","Sprzedaż ze stratą"],["niska","Marża poniżej celu"],["oplacalne","Osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>Cel marży <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="allegroDocelowaMarza=Math.max(1,Math.min(60,Number(this.value)||20));renderuj()">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div><div class="profitability-guide"><b>Jak czytać wynik?</b><span><i class="green"></i> marża osiąga cel</span><span><i class="yellow"></i> dodatni wynik poniżej celu</span><span><i class="red"></i> strata</span><small>Rekomendacja jest oparta na aktualnej procentowej prowizji. Po zmianie ceny pobierz prowizję ponownie, ponieważ Allegro może stosować progi lub stawki minimalne.</small></div><div class="warehouse-worktable-wrap"><table class="log-table profitability-table"><tr><th>Produkt</th><th>Dane wejściowe</th><th>Prowizja i koszty</th><th>Wynik</th><th>Rekomendowana cena</th><th>Akcje</th></tr>${rows.slice(0,500).map(({p,r})=>{const offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||"");const cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit";return `<tr class="${cls}"><td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small>${!r.dataComplete?`<em>Brakuje: ${[!p.cenaZakupu?"ceny zakupu":"",!p.allegroFeeCalculatedAt?"prowizji Allegro":"",!(p.allegroOfferId||p.allegroCategoryId)?"danych oferty":""].filter(Boolean).join(", ")}</em>`:""}</div></div></td><td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Cena Allegro</small><b>${r.price?zl(r.price):"—"}</b></td><td><small>Prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"}</b><br><small>Pozostałe / szt.</small><b>${zl(r.recurringPerUnit+r.packing+r.other+r.shipping+r.ads)}</b>${p.allegroFeeCalculatedAt&&!r.feeCurrent?`<br><span class="lvl lvl-ostrzezenie">przelicz dla nowej ceny</span>`:""}</td><td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"} • narzut ${r.dataComplete?r.markup.toFixed(2)+"%":"—"}</small><em>próg: ${r.breakEven?zl(r.breakEven):"—"}</em></span></td><td><b>${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></td><td><div class="warehouse-worktable-actions"><button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">🟠 Prowizja</button>${r.recommended?`<button class="btn" onclick="allegroUstawRekomendowanaCene(${jsArg(p.id)},${r.recommended})">Ustaw ${zl(r.recommended)}</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6">Brak produktów pasujących do filtrów.</td></tr>`}</table></div><div class="backend-note allegro-info-bottom"><b>Ważne:</b> kalkulator pokazuje rentowność operacyjną jednej sztuki przed podatkiem dochodowym. VAT jest zapisany w kartotece jako informacja do dalszych rozszerzeń księgowych; wynik korzysta z faktycznych kwot sprzedaży, zakupu i opłat podanych w panelu.</div></div>`;
}
function sklepScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"sklep");}
function rentownoscKanalowaPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),rows=allegroRentownoscLista();
  const sklepPelne=all.filter(p=>sklepRentownoscProduktu(p).dataComplete),allegroPelne=all.filter(allegroProduktMaPelneDaneMarzowe);
  const sklepCel=sklepPelne.filter(p=>sklepRentownoscProduktu(p).margin>=sklepDocelowaMarza).length,allegroCel=allegroPelne.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length;
  const reviewCounts=all.reduce((acc,p)=>(acc[rentownoscStatusWeryfikacji(p)]++,acc),{unreviewed:0,reviewed:0,outdated:0}),visible=rows.slice(0,500),allIds=new Set(all.map(p=>String(p.id))),selected=[...zaznaczoneRentownosc].filter(id=>allIds.has(id)).length;
  const reviewCards=[["niesprawdzone","⚠️",reviewCounts.unreviewed,"do sprawdzenia","hot"],["nieaktualne","⏳",reviewCounts.outdated,"do ponownej kontroli",reviewCounts.outdated?"hot":""],["sprawdzone","✅",reviewCounts.reviewed,"sprawdzone przeze mnie","money"],["wszystkie","📦",all.length,"wszystkie produkty",""]];
  return `<div class="panel allegro-section-panel profitability-page">
    <div class="order-section-head"><div><span class="order-pro-label">Dwa niezależne kanały</span><h2>📈 Opłacalność: sklep i Allegro</h2><p class="order-detail-lead">Cena, koszty, cel marży i rekomendacja są liczone osobno. Ustawienie ceny sklepu zmienia kartę sklepu, a ustawienie ceny Allegro zapisuje cenę i od razu aktualizuje powiązaną ofertę oraz prowizję.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Odśwież prowizje Allegro</button></div>
    <div class="profit-channel-summary"><article class="store"><span>🏪</span><div><small>Sklep internetowy</small><b>${sklepCel}/${sklepPelne.length} osiąga cel ${sklepDocelowaMarza}%</b></div></article><article class="allegro"><span>🟠</span><div><small>Allegro</small><b>${allegroCel}/${allegroPelne.length} osiąga cel ${allegroDocelowaMarza}%</b></div></article></div>
    <div class="orders-stat-grid profitability-review-stats">${reviewCards.map(([id,icon,count,label,cls])=>`<button type="button" class="order-stat-card stat-filter ${cls} ${filtrAllegroRentownosc===id?"active":""}" onclick="ustawFiltrAllegroRentownosc(${jsArg(id)})"><span>${icon}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div>
    ${domyslneUstawieniaRentownosciHTML()}
    <div class="profitability-controls"><input placeholder="Szukaj: nazwa, EXTERNAL_ID, SKU, EAN, kod producenta…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="ustawFiltrAllegroRentownosc(this.value)">${[["niesprawdzone","Do sprawdzenia"],["nieaktualne","Do ponownej kontroli"],["sprawdzone","Sprawdzone przeze mnie"],["wszystkie","Wszystkie produkty"],["kompletne","Pełne dane Allegro"],["brak_prowizji","Brak prowizji Allegro"],["strata","Strata na Allegro"],["niska","Allegro poniżej celu"],["oplacalne","Allegro osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża Allegro</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża Allegro</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>🏪 Cel sklepu <input type="number" min="1" max="60" value="${esc(sklepDocelowaMarza)}" onchange="ustawCelMarzy('sklep',this.value)">%</label><label>🟠 Cel Allegro <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="ustawCelMarzy('allegro',this.value)">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div>
    <div class="profitability-review-toolbar"><div><b>${rows.length}</b><span>wyników • <b>${selected}</b> zaznaczonych</span></div><div class="diag-actions"><button class="btn ghost" type="button" onclick="zaznaczWidoczneRentownosc()">Zaznacz widoczne (${visible.length})</button><button class="btn ghost" type="button" onclick="wyczyscZaznaczenieRentownosci()" ${selected?"":"disabled"}>Odznacz</button><button class="btn" type="button" onclick="oznaczZaznaczoneRentownosc(true)" ${selected?"":"disabled"}>✅ Oznacz sprawdzone</button><button class="btn ghost" type="button" onclick="oznaczZaznaczoneRentownosc(false)" ${selected?"":"disabled"}>Cofnij oznaczenie</button></div></div>
    <div class="warehouse-worktable-wrap"><table class="log-table profitability-table profitability-channel-table"><tr><th>Produkt i kontrola</th><th>Zakup i ceny</th><th>🏪 Sklep</th><th>🟠 Allegro</th><th>Rekomendacje kanałów</th><th>Akcje</th></tr>${visible.map(({p,r})=>{const s=sklepRentownoscProduktu(p),offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||""),cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit",review=rentownoscStatusWeryfikacji(p),checked=zaznaczoneRentownosc.has(String(p.id));return `<tr class="${cls} review-${review} ${checked?"is-selected":""}" data-product-row="${esc(p.id)}"><td><div class="profit-product-review-cell"><label class="profit-row-select" title="Zaznacz produkt"><input type="checkbox" ${checked?"checked":""} onchange="przelaczZaznaczenieRentownosci(${jsArg(p.id)},this.checked)"></label><div><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small></div></div>${rentownoscStatusWeryfikacjiHTML(p)}</div></div></td><td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Sklep</small><b>${p.cena?zl(p.cena):"—"}</b><br><small>Allegro</small><b>${r.price?zl(r.price):"—"}</b></td><td><span class="profitability-result ${s.profit<0?"loss":s.margin<sklepDocelowaMarza?"warning":"profit"}"><b>${s.dataComplete?zl(s.profit):"—"}</b><small>marża ${s.dataComplete?s.margin.toFixed(2)+"%":"—"}</small><em>próg ${s.breakEven?zl(s.breakEven):"—"}</em></span><small>Płatność ${s.paymentRate.toFixed(2)}% • inne ${zl(s.other)}</small></td><td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"}</small><em>próg ${r.breakEven?zl(r.breakEven):"—"}</em></span><small>Prowizja ${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"} • wysyłka ${zl(r.shipping)}</small></td><td><div class="profit-recommendation-channel"><b>🏪 ${s.recommended?zl(s.recommended):"—"}</b><div class="profit-scenarios">${sklepScenariuszeMarzyHTML(p)}</div></div><div class="profit-recommendation-channel allegro"><b>🟠 ${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></div></td><td><div class="warehouse-worktable-actions">${s.recommended?`<button class="btn ghost" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'sklep',${s.recommended})">Ustaw sklep ${zl(s.recommended)}</button>`:""}${r.recommended?`<button class="btn" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'allegro',${r.recommended})">Ustaw Allegro ${zl(r.recommended)}</button>`:""}<button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">Prowizja</button><button class="btn ${review==="reviewed"?"ghost":""}" onclick="oznaczRentownoscSprawdzona(${jsArg(p.id)},${review==="reviewed"?"false":"true"})">${review==="reviewed"?"Cofnij sprawdzenie":"✅ Sprawdzone — moje ustawienie"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6">Brak produktów pasujących do aktywnego filtra.</td></tr>`}</table></div>
    <div class="backend-note allegro-info-bottom"><b>Automatyka:</b> dopłata do wysyłki Allegro wynosi domyślnie 3,00 zł. Po ustawieniu ceny Allegro system aktualizuje istniejącą ofertę przez API i ponownie pobiera kalkulację opłat; cena sklepu pozostaje niezależna.</div>
  </div>`;
}
function widokAdminAllegro(sekcja="start"){
  const aktywna=["zamowienia","oferty","wystawianie","rentownosc","wiadomosci","dyskusje","zgodnosc","ustawienia"].includes(sekcja)?sekcja:"start";
  const zakres=aktywna==="zamowienia"?"orders":["oferty","wystawianie","rentownosc","zgodnosc"].includes(aktywna)?"offers":aktywna==="ustawienia"?"config":"summary";
  allegroLadujJesliTrzeba(zakres);
  if(["wiadomosci","dyskusje"].includes(sekcja)&&!allegroKomunikacja?.updated_at&&!allegroKomunikacja?.sprawdzono&&!allegroStan.ladowanie) setTimeout(()=>allegroWczytajKomunikacje(true),0);
  if(["wiadomosci","dyskusje"].includes(sekcja)) setTimeout(()=>allegroAktywujKafelkiKomunikacji(sekcja==="dyskusje"?"issue":"thread"),0);
  const staty=allegroPanelOperacyjnyStaty(),mapped=staty.podpiete,niepodpiete=staty.niepodpiete;
  return adminSzkielet("/admin/allegro", `
  <div class="module-page-stack allegro-module-page">
  ${allegroSubnavHTML(aktywna,staty)}
  ${aktywna==="zamowienia"?allegroZamowieniaTabelaHTML():aktywna==="oferty"?allegroOfertyTabelaHTML():aktywna==="wystawianie"?allegroWystawianiePanelHTML():aktywna==="rentownosc"?rentownoscKanalowaPanelHTML():aktywna==="wiadomosci"?allegroKomunikacjaPanelHTML("thread"):aktywna==="dyskusje"?allegroKomunikacjaPanelHTML("issue"):aktywna==="zgodnosc"?allegroZgodnoscPanelHTML():aktywna==="ustawienia"?allegroUstawieniaPanelHTML():allegroStartPanelHTML(staty)}
  ${allegroStan.error?`<div class="backend-note allegro-info-bottom" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Allegro:</b> ${esc(allegroStan.error)}</div>`:""}
  ${aktywna==="start"?"":allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete,staty)}
  </div>
  `);
}

const inpostWycenyZamowienCache=new Map();
function inpostWycenaZamowieniaKlucz(z={}){
  const w=z.wysylka||{};
  return [z.nr,z.dostawaId,w.gabaryt,w.waga,w.dlugosc,w.szerokosc,w.wysokosc,w.paczkaWeekend,w.pobranieAktywne,w.ochrona,w.sposobNadania].map(v=>String(v??"")).join("|");
}
function inpostWycenaZamowieniaWartosc(z={}){
  return inpostWycenyZamowienCache.get(inpostWycenaZamowieniaKlucz(z))||z?.wysylka?.kosztUmowny||null;
}
function inpostWycenaZamowieniaHTML(z={}){
  const p=inpostWycenaZamowieniaWartosc(z),amount=Number(p?.totalGross);
  if(!p)return '<span class="inpost-order-quote-loading">Sprawdzam stawkę InPost…</span>';
  if(!Number.isFinite(amount))return '<span class="lvl lvl-ostrzezenie">Brak stawki dla wybranej paczki</span>';
  return `<span><small>Koszt InPost brutto</small><b>${zl(amount)}</b></span><span><small>Stawka</small><b>${esc(p.rateLabel||"indywidualna")}</b></span>${p.complete===false?`<span class="lvl lvl-ostrzezenie">${esc((p.unpricedOptions||[]).join(", ")||"uzupełnij dopłaty")}</span>`:'<span class="lvl lvl-ok">wycena kompletna</span>'}`;
}
async function inpostWycenaZamowieniaLaduj(nr){
  const z=pobierzZamowienia().find(item=>String(item.nr)===String(nr)),box=document.querySelector(`[data-inpost-order-quote="${CSS.escape(String(nr))}"]`);
  if(!z||!box)return;
  const key=inpostWycenaZamowieniaKlucz(z);
  if(inpostWycenyZamowienCache.has(key)){box.innerHTML=inpostWycenaZamowieniaHTML(z);return;}
  try{
    const d=await chmura("inpost-order-quote",{params:{nr},timeout:15000});
    inpostWycenyZamowienCache.set(key,d.pricing||{});
    if(document.contains(box))box.innerHTML=inpostWycenaZamowieniaHTML(z);
  }catch(e){
    if(document.contains(box))box.innerHTML=`<span class="lvl lvl-ostrzezenie">${esc(e.message||"Nie pobrano stawki InPost")}</span>`;
  }
}

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
  setTimeout(()=>inpostWycenaZamowieniaLaduj(nr),0);
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
          <div class="inpost-order-contract-quote" data-inpost-order-quote="${esc(z.nr)}">${inpostWycenaZamowieniaHTML(z)}</div>
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

/* ═══════════ AGENT AI — SCALONE PROFESJONALNE CENTRUM ═══════════ */
const AGENT_AI_SEKCJE_KANONICZNE=Object.freeze({
  pulpit:"pulpit",centrum:"pulpit",
  rozmowa:"rozmowa",komendy:"rozmowa",
  zadania:"zadania",plan:"zadania",produkty:"zadania",zlecenia:"zadania",producenci:"zadania",
  automatyzacje:"automatyzacje",specjalisci:"automatyzacje",uprawnienia:"automatyzacje",pamiec:"automatyzacje",
  komunikacja:"komunikacja",telegram:"komunikacja",
  audyt:"audyt",historia:"audyt"
});
function agentAISekcjaKanoniczna(value="pulpit"){return AGENT_AI_SEKCJE_KANONICZNE[String(value||"").toLowerCase()]||"pulpit";}
function agentAIMetrykiScalone(){
  const analiza=agentAIAnaliza(),tasks=agentAIAnalizaAktywna(analiza),communication=allegroKomunikacjaStaty(),messages=[...(communication.threads||[]),...(communication.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi).length,availability=pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci).length,offers=allegroAktywneZadaniaAgentaOfert().length,surplus=agentAINadwyzkiDoPrzyjecia().length,docs=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length,onboarding=agentAIProduktyWdrozenie().length,runtime=agentAIRuntime.runtime||{},queue=runtime.queue||{},specialistDecisions=(agentAISpecjalisci.data?.decisions||[]).length;
  return {tasks:tasks.length,bad:tasks.filter(x=>x.poziom==="bad").length,warn:tasks.filter(x=>x.poziom==="warn").length,decisions:availability+messages+offers+surplus+docs,messages,onboarding,docs,queue:Number(queue.active||0),queued:Number(queue.counts?.queued||0),working:Number(queue.counts?.processing||0)+Number(queue.counts?.delivering||0),specialistDecisions,history:Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).length};
}
function agentAIStanSystemuMeta(){
  const runtime=agentAIRuntime.runtime||{},state=String(runtime.state||(!agentAIRuntime.loaded?"loading":"stale")),map={online:["online","Agent online","Automatyczne cykle odpowiadają"],working:["working","Agent pracuje",runtime.worker?.currentTask||"Trwa cykl automatyczny"],degraded:["warning","Ograniczone działanie","Jedna integracja wymaga kontroli"],stale:["waiting","Oczekiwanie na cykl","Proces pozostaje gotowy"],offline:["offline","Agent offline","Worker wymaga uruchomienia"],loading:["loading","Sprawdzam stan","Pobieranie sygnału z serwera"]};return map[state]||map.loading;
}
function agentAINawigacjaScalonaHTML(active="pulpit"){
  const m=agentAIMetrykiScalone(),groups=[
    {label:"Sterowanie",items:[{id:"pulpit",href:"#/admin/agent-ai",icon:"⌂",label:"Centrum"},{id:"rozmowa",href:"#/admin/agent-ai/rozmowa",icon:"💬",label:"Rozmowa"}]},
    {label:"Praca",items:[{id:"zadania",href:"#/admin/agent-ai/zadania",icon:"✓",label:"Zadania i decyzje",badge:m.tasks||m.decisions||""}]},
    {label:"System",items:[{id:"automatyzacje",href:"#/admin/agent-ai/automatyzacje",icon:"⚙",label:"Automatyzacje",badge:m.specialistDecisions||""}]},
    {label:"Zespół",items:[{id:"komunikacja",href:"#/admin/agent-ai/komunikacja",icon:"✈",label:"Telegram",badge:agentAITelegram.stats?.critical||""}]},
    {label:"Kontrola",items:[{id:"audyt",href:"#/admin/agent-ai/audyt",icon:"▤",label:"Audyt"}]}
  ];
  return `<nav class="panel agent-module-nav" aria-label="Podsekcje Agenta AI"><div class="agent-module-brand"><span>🤖</span><div><small>Centrum wykonawcze</small><b>Agent AI</b></div></div><div class="agent-module-groups">${groups.map(group=>`<section><small>${esc(group.label)}</small><div>${group.items.map(item=>`<a class="${item.id===active?"active":""}" href="${item.href}" ${item.id===active?'aria-current="page"':""}><span>${item.icon}</span><b>${esc(item.label)}</b>${item.badge?`<em>${esc(item.badge)}</em>`:""}</a>`).join("")}</div></section>`).join("")}</div></nav>`;
}
agentAISubnavHTML=function(active="pulpit"){return agentAINawigacjaScalonaHTML(agentAISekcjaKanoniczna(active));};

function agentAIKontekstHTML(){
  const m=agentAIMetrykiScalone(),[state,label,detail]=agentAIStanSystemuMeta(),runtime=agentAIRuntime.runtime||{},next=runtime.scheduler?.nextRunAt||runtime.nextRunAt||agentAISpecjalisci.data?.scheduler?.nextRunAt||"";
  return `<section class="agent-context-strip"><span class="agent-context-state ${state}"><i></i><b>${esc(label)}</b><small>${esc(detail)}</small></span><span><small>KOLEJKA</small><b>${m.queue} aktywnych • ${m.queued} oczekuje</b></span><span><small>AUTONOMIA</small><b>opisy i SEO • działania zewnętrzne chronione</b></span><span><small>NASTĘPNY CYKL</small><b>${next?esc(agentAIRuntimeCzas(next)):"harmonogram 15 min"}</b></span><button class="btn ghost" onclick="agentAIRuntimePobierz(false)">↻ Sprawdź stan</button></section>`;
}
function agentAIPodstronaScalonyNaglowekHTML(active="pulpit"){
  if(active==="pulpit")return "";const m=agentAIMetrykiScalone(),pages={
    rozmowa:["💬","Rozmowa z Agentem","Jedno miejsce do wydawania poleceń zwykłym językiem, sprawdzania odpowiedzi i bezpiecznego potwierdzania zmian.","Nowe polecenie"],
    zadania:["✓","Zadania i decyzje","Wspólna kolejka aktywnych problemów, decyzji administratora, nowych produktów i źródeł producentów — bez powielania tych samych braków.",`${m.tasks+m.decisions} otwartych`],
    automatyzacje:["⚙","Automatyzacje i zasady","Specjaliści GPT, granice autonomii i pamięć procedur w jednym miejscu konfiguracji.",`${m.specialistDecisions} wyjątków`],
    komunikacja:["✈","Komunikacja zespołu","Jeden bot Telegram, wspólna kolejka spraw, dostarczenia i ręczne notatki do zespołu.",`${agentAITelegram.stats?.critical||0} pilnych`],
    audyt:["▤","Audyt i historia","Rozliczalny rejestr zakończonych zadań, wykonań planów i działań administratora oraz Agenta.",`${m.history} zakończonych`]
  },p=pages[active]||pages.zadania;
  return `<section class="panel agent-workspace-header"><div><span>${p[0]}</span><div><small>AGENT AI • ${esc(p[1].toUpperCase())}</small><h1>${esc(p[1])}</h1><p>${esc(p[2])}</p></div></div><strong>${esc(p[3])}</strong></section>`;
}
agentAIPodstronaNaglowekHTML=function(active="pulpit"){return agentAIPodstronaScalonyNaglowekHTML(agentAISekcjaKanoniczna(active));};

function agentAIPulpitScalonyHTML(score=0){
  const m=agentAIMetrykiScalone(),[state,label,detail]=agentAIStanSystemuMeta();
  return `<section class="panel agent-command-center"><div class="agent-command-center-main"><span class="order-pro-label">AUTOMATYCZNY KONTROLER SKLEPU</span><h1>🤖 Centrum dowodzenia Agenta</h1><p>Agent stale kontroluje sklep, porządkuje treści i przygotowuje pracę. Tutaj widzisz wyłącznie aktualny stan, najważniejszą kolejkę i działania wymagające Twojej decyzji.</p><div class="agent-command-center-actions"><a class="btn" href="#/admin/agent-ai/rozmowa">💬 Wydaj polecenie</a><a class="btn ghost" href="#/admin/agent-ai/zadania">✓ Otwórz kolejkę</a><button class="btn ghost" onclick="agentAIWykonaj('plan-bezpieczny')" ${agentAIPlanStan.busy?"disabled":""}>${agentAIPlanStan.busy?"⏳ Kontrola trwa":"▶ Uruchom bezpieczną kontrolę"}</button></div></div><aside><div class="health-score">${score}%</div><span class="agent-command-health ${state}"><i></i><b>${esc(label)}</b><small>${esc(detail)}</small></span></aside></section><section class="agent-command-metrics">${[["⚠",m.tasks,"Aktywne zadania",m.bad?`${m.bad} pilnych`:`${m.warn} ostrzeżeń`,"#/admin/agent-ai/zadania"],["◉",m.decisions,"Decyzje administratora","sprzedaż i operacje chronione","#/admin/agent-ai/zadania"],["⚙",m.queue,"Kolejka wykonawcza",`${m.working} wykonywane • ${m.queued} oczekuje`,`#/admin/agent-ai/automatyzacje`],["✨",m.onboarding,"Nowe produkty","kontrola kartotek i Allegro","#/admin/agent-ai/zadania"]].map(([icon,value,title,note,href])=>`<a href="${href}"><span>${icon}</span><div><b>${value}</b><strong>${esc(title)}</strong><small>${esc(note)}</small></div><em>→</em></a>`).join("")}</section><div id="agentAIRuntimePanel">${agentAIRuntimePanelHTML()}</div>${agentAIInicjatywaPanelHTML()}`;
}
function agentAIRozmowaScalonaHTML(){
  const answers=(agentAIHistoria||[]).filter(h=>h.typ==="komenda"&&h.dane&&h.dane.odpowiedz).slice(0,8);
  const quick=[["📦","Sprawdź nowe zamówienia","sprawdź czy wpadło nowe zlecenie"],["🏬","Pokaż realne braki","czego brakuje do aktywnych zamówień"],["🚚","Sprawdź wysyłki","sprawdź wysyłki i InPost"],["🏷️","Audyt produktów","audyt produktów i katalogu"],["🏭","Sprawdź producentów","sprawdź dostępność u producentów"],["🔄","Synchronizuj dane","synchronizuj bazę"]];
  const more=[["Przygotuj zamówienie do producenta","przygotuj zamówienie do producenta"],["Popraw opisy produktów","popraw opisy produktów"],["Pokaż stan magazynu","pokaż stan magazynu"],["Sprawdź integracje","diagnostyka integracji"],["Pokaż pamięć","pokaż pamięć"],["Naucz Agenta","zapamiętaj: "]];
  return `<section class="panel agent-conversation"><div class="agent-conversation-head"><div><span>🤖</span><div><small>CODEX + GPT‑5 NANO + DANE SKLEPU</small><h2>Co mam zrobić?</h2><p>Pisz normalnie po polsku. Agent najpierw sprawdza dane i pokazuje plan; zmiany magazynowe oraz działania zewnętrzne wymagają osobnego potwierdzenia.</p></div></div><span id="agentAICommandCloudState" class="lvl ${chmuraStan.dostepna?"lvl-ok":"lvl-info"}">${chmuraStan.dostepna?`wspólna baza • rewizja ${chmuraStan.rev||0}`:"łączenie z bazą"}</span></div><form class="agent-conversation-form" onsubmit="return agentAIPrzyjmijKomende(event)"><textarea id="agentAICommandInput" rows="4" placeholder="Np. sprawdź nowe zamówienia i przygotuj listę brakujących produktów…"></textarea><div><button class="btn" type="submit">🤖 Przekaż Agentowi</button><button class="btn ghost" type="button" onclick="agentAIWstawKomende('wykonaj bezpieczny plan agenta')">▶ Bezpieczna kontrola</button></div></form><div class="agent-command-presets">${quick.map(([icon,label,command])=>`<button type="button" onclick="agentAIWstawKomende(${jsArg(command)})"><span>${icon}</span><b>${esc(label)}</b></button>`).join("")}</div><details class="agent-more-commands"><summary>Więcej gotowych poleceń</summary><div>${more.map(([label,command])=>`<button class="btn ghost" type="button" onclick="agentAIWstawKomende(${jsArg(command)})">${esc(label)}</button>`).join("")}</div></details><div class="agent-command-safety"><span>🛡️</span><div><b>Bezpieczna zasada wykonania</b><small>Rozmowa nie zmienia stanu sama. Agent tworzy osobną decyzję z lokalizacją, ilością i przyciskami Potwierdzam / Odrzucam.</small></div></div><div id="agentAICommandLiveResult" class="agent-response-card agent-command-live-result" hidden></div><div id="agentInventoryDecisionPanel">${agentAIDecyzjeMagazynowePanelHTML()}</div>${answers.length?`<section class="agent-conversation-history"><div><b>Ostatnie odpowiedzi</b><a href="#/admin/agent-ai/audyt">Pełny audyt →</a></div>${answers.map(h=>`<article><header><b>${esc(h.dane.polecenie||"Polecenie")}</b><small>${esc(h.dataTxt||"")}</small></header><pre>${esc(h.dane.odpowiedz||"")}</pre></article>`).join("")}</section>`:`<div class="agent-ops-empty">Nie ma jeszcze odpowiedzi z panelu. Wpisz pierwsze polecenie powyżej.</div>`}</section>`;
}
function agentAIObszarHTML(id,title,description,content,open=false,badge=""){
  return `<details class="agent-workspace-fold" id="${esc(id)}" ${open?"open":""}><summary><span><b>${esc(title)}</b><small>${esc(description)}</small></span>${badge?`<em>${esc(badge)}</em>`:""}<i>⌄</i></summary><div>${content}</div></details>`;
}
function agentAIOtworzObszar(id){
  const area=document.getElementById(String(id||""));if(!area)return;area.open=true;area.scrollIntoView({behavior:"smooth",block:"start"});
}
function agentAIZadaniaScaloneHTML(analysis,requested="zadania"){
  const m=agentAIMetrykiScalone(),openPlan=!['produkty','producenci'].includes(requested),openProducts=requested==='produkty',openSources=requested==='producenci';
  return `<section class="agent-section-directory"><button type="button" onclick="agentAIOtworzObszar('agent-work-plan')"><span>✓</span><div><b>${m.tasks}</b><small>aktywnych zadań</small></div></button><button type="button" onclick="agentAIOtworzObszar('agent-work-decisions')"><span>◉</span><div><b>${m.decisions}</b><small>decyzji administratora</small></div></button><button type="button" onclick="agentAIOtworzObszar('agent-work-products')"><span>✨</span><div><b>${m.onboarding}</b><small>nowych produktów</small></div></button><button type="button" onclick="agentAIOtworzObszar('agent-work-sources')"><span>🏭</span><div><b>${m.docs}</b><small>dokumentów producentów</small></div></button></section>${agentAIObszarHTML("agent-work-plan","Plan operacyjny","Jedna kolejka rzeczywistych problemów i bezpiecznych działań Agenta.",agentAIPlanOperacyjnyHTML(analysis),openPlan,`${m.tasks} aktywnych`)}${agentAIObszarHTML("agent-work-decisions","Decyzje administratora","Tylko operacje wymagające świadomego wyboru człowieka.",agentAICentrumDecyzjiHTML(),requested==='plan',`${m.decisions} otwartych`)}${agentAIObszarHTML("agent-work-products","Wdrożenie nowych produktów","Kontrola kartoteki, opisów, zdjęć, duplikatów i gotowości Allegro.",agentAIProduktyWdrozeniePanelHTML(),openProducts,`${m.onboarding} pozycji`)}${agentAIObszarHTML("agent-work-sources","Producenci i źródła danych","Kolejka linków oraz kartoteki kontaktowe wykorzystywane przez Agentów i Plan zatowarowania.",`${agentAILinkiProducentowPanelHTML()}${producenciKartotekaPanelHTML()}`,openSources,`${m.docs} dokumentów`)}`;
}
function agentAIAutomatyzacjeScaloneHTML(requested="automatyzacje"){
  const decisions=(agentAISpecjalisci.data?.decisions||[]).length,memory=(agentAIPamiec||[]).length;
  return `<section class="agent-automation-overview"><article><span>✦</span><div><b>Specjaliści GPT‑5 nano</b><small>Role do opisów, SEO, Allegro, komunikacji i kontroli jakości.</small></div><em>${decisions} wyjątków</em></article><article><span>🛡️</span><div><b>Granice autonomii</b><small>Wyraźny podział: wykonaj automatycznie, przygotuj albo zapytaj.</small></div><em>ochrona aktywna</em></article><article><span>🧠</span><div><b>Pamięć procedur</b><small>Reguły synchronizowane między urządzeniami administratorów.</small></div><em>${memory} reguł</em></article></section>${agentAIObszarHTML("agent-auto-specialists","Specjaliści i wykonania","Uruchamianie konkretnych ról oraz podgląd ich wyników.",agentAISpecjalisciPanelHTML(),requested!=="uprawnienia"&&requested!=="pamiec",`${decisions} wyjątków`)}${agentAIObszarHTML("agent-auto-permissions","Uprawnienia i potwierdzenia","Jedno źródło zasad określających, co Agent może zapisać sam.",agentAIUprawnieniaPanelHTML(),requested==="uprawnienia","chronione")}${agentAIObszarHTML("agent-auto-memory","Pamięć i procedury","Trwałe reguły pracy używane przy kolejnych analizach.",agentAIPamiecPanelHTML(),requested==="pamiec",`${memory} reguł`)}`;
}
function agentAIScalonaTrescSekcji(active,analysis,requested,score){
  if(active==="rozmowa")return agentAIRozmowaScalonaHTML();
  if(active==="zadania")return agentAIZadaniaScaloneHTML(analysis,requested);
  if(active==="automatyzacje")return agentAIAutomatyzacjeScaloneHTML(requested);
  if(active==="komunikacja")return agentAITelegramPanelHTML();
  if(active==="audyt")return agentAIHistoriaPanelHTML();
  return typeof agentAIPulpitObserwowalnoscHTML==="function"?agentAIPulpitObserwowalnoscHTML(score):agentAIPulpitScalonyHTML(score);
}
widokAdminAgentAI=function(section="pulpit"){
  allegroLadujJesliTrzeba("orders");const requested=String(section||"pulpit").toLowerCase(),active=agentAISekcjaKanoniczna(requested),analysis=agentAIAnaliza(),tasks=agentAIAnalizaAktywna(analysis),score=Math.max(0,Math.round(100-(tasks.filter(x=>x.poziom==="bad").length*18)-(tasks.filter(x=>x.poziom==="warn").length*8))),runtimeAge=Date.now()-Number(agentAIRuntime.updatedAt||0);
  if((!agentAIRuntime.loaded||runtimeAge>60_000)&&!agentAIRuntime.loading)setTimeout(()=>agentAIRuntimePobierz(true),0);
  if(active==="pulpit")setTimeout(()=>agentAIRuntimePolling(),0);
  if(active==="komunikacja"&&!agentAITelegram.loaded&&!agentAITelegram.loading)setTimeout(()=>agentAITelegramPobierz(true,true),0);
  if(["pulpit","automatyzacje"].includes(active)&&!agentAISpecjalisci.loaded&&!agentAISpecjalisci.loading)setTimeout(()=>agentAISpecjalisciPobierz(false),0);
  if(["pulpit","automatyzacje"].includes(active))setTimeout(()=>agentAISpecjalisciPolling(),0);
  const decisionAge=Date.now()-(Date.parse(agentAIDecyzjeMagazynowe.updatedAt)||0);if(["rozmowa","zadania"].includes(active)&&(!agentAIDecyzjeMagazynowe.loaded||decisionAge>60_000)&&!agentAIDecyzjeMagazynowe.loading)setTimeout(()=>agentAIDecyzjeMagazynowePobierz(true),0);
  return adminSzkielet("/admin/agent-ai",`${agentAINawigacjaScalonaHTML(active)}${agentAIKontekstHTML()}${agentAIPodstronaScalonyNaglowekHTML(active)}<main class="agent-workspace agent-workspace-${active}">${agentAIScalonaTrescSekcji(active,analysis,requested,score)}</main>`);
};

/* Ustawienia integracji Allegro — mapowanie, harmonogram i automatyzacje. */
async function allegroZapiszDaneAplikacji(event){
  event?.preventDefault();const form=event?.currentTarget,button=form?.querySelector("button[type=submit]");
  const clientId=String(form?.elements?.clientId?.value||"").trim(),clientSecret=String(form?.elements?.clientSecret?.value||"").trim();
  if(!clientId||!clientSecret){toast("Wpisz pełny Client ID i Client Secret");return false;}
  if(button){button.disabled=true;button.textContent="⏳ Sprawdzam w Allegro…";}
  try{
    const data=await chmura("allegro-credentials",{method:"POST",body:{clientId,clientSecret,environment:"production"},timeout:30000});
    form.reset();allegroStan={...allegroStan,...(data.allegro||{}),credentialsRedacted:false,credentialsInvalid:false,sprawdzono:true};
    toast(data.refreshed?"✅ Dane aplikacji sprawdzone — połączenie Allegro działa":"✅ Dane aplikacji sprawdzone — dokończ jednorazowe połączenie konta");
    if(data.requiresOAuth)setTimeout(()=>allegroPolacz(),300);else{await allegroWczytajDane(true,true,"config");renderuj();}
  }catch(error){toast("⚠️ Allegro: "+(error?.message||error));}
  finally{if(button){button.disabled=false;button.textContent="🔐 Sprawdź i zapisz bezpiecznie";}}
  return false;
}
function allegroNaprawaDanychAplikacjiHTML(){
  if(!allegroStan.credentialsRedacted&&!allegroStan.credentialsInvalid)return "";
  return `<section class="allegro-credential-repair"><header><span>🔐</span><div><small>Naprawa połączenia • dane tylko na serwerze</small><h3>Wpisz ponownie pełne dane aplikacji Allegro</h3><p>Wcześniej do konfiguracji trafiły zamaskowane wartości z gwiazdkami. Nie są prawdziwym Client ID ani Client Secret, dlatego Allegro zwracało <code>invalid_client</code>. Agent AI i GPT‑5 nano działają prawidłowo.</p></div></header><form autocomplete="off" onsubmit="return allegroZapiszDaneAplikacji(event)"><label>Client ID<input name="clientId" required minlength="12" autocomplete="off" spellcheck="false" placeholder="Pełna wartość z aplikacji Allegro"></label><label>Client Secret<input name="clientSecret" type="password" required minlength="12" autocomplete="new-password" spellcheck="false" placeholder="Pełna wartość — bez gwiazdek"></label><button class="btn" type="submit">🔐 Sprawdź i zapisz bezpiecznie</button></form><footer><span>✓ Dane są najpierw weryfikowane bezpośrednio w OAuth Allegro</span><span>✓ Sekret nie trafia do przeglądarki, bazy sklepu ani repozytorium</span><span>✓ Zamaskowana wartość nigdy więcej nie nadpisze sejfu</span></footer></section>`;
}
function allegroUstawieniaPanelHTML(){
  const offerStock=allegroStanOfertyProduktu(),audit=Object.values(allegroStan.offerDefaultsAudit?.items||{}),auditOpen=audit.filter(x=>!x.stockUpdated||!x.republishUpdated).length;
  const settings={autoMapping:true,mappingMinScore:88,lightSyncMinutes:15,fullSyncHours:6,autonomousAgent:true,autonomousAgentMinutes:15,autoResolveDuplicates:true,autoResolveDuplicateMinScore:97,...(allegroStan.offerSettings||{})};
  const sync=allegroStan.offerSyncState||{},maintenance=allegroStan.catalogMaintenance||{},agent=allegroStan.autonomousAgent||{};
  const dataLabel=value=>value&&Number.isFinite(Date.parse(value))?esc(new Date(value).toLocaleString("pl-PL")):"jeszcze nie wykonano";
  const option=(value,current,label)=>`<option value="${value}" ${Number(current)===Number(value)?"selected":""}>${label}</option>`;
  return `<div class="panel allegro-section-panel allegro-integration-settings">
    <div class="order-section-head">
      <div><span class="order-pro-label">Allegro API</span><h2>⚙️ Ustawienia integracji</h2><p class="order-detail-lead">Jedno miejsce do ustawienia automatycznego mapowania, rytmu synchronizacji, aktualizacji ofert i domyślnych danych.</p></div>
      <div class="diag-actions"><button class="btn" type="button" onclick="allegroPolacz()">🔐 Połącz ponownie</button><button class="btn ghost" type="button" onclick="allegroWczytajDane(true)">Sprawdź połączenie</button></div>
    </div>
    ${allegroNaprawaDanychAplikacjiHTML()}
    <div class="orders-stat-grid">
      <div class="order-stat-card ${allegroStan.configured?"money":"hot"}"><span>🔧</span><b>${allegroStan.configured?"OK":"BRAK"}</b><small>konfiguracja aplikacji</small></div>
      <div class="order-stat-card ${allegroStan.connected?"money":"hot"}"><span>🔐</span><b>${allegroStan.connected?"TAK":"NIE"}</b><small>autoryzacja OAuth</small></div>
      <div class="order-stat-card"><span>🔄</span><b>${settings.lightSyncMinutes} min</b><small>lekka synchronizacja</small></div>
      <div class="order-stat-card"><span>📚</span><b>${settings.fullSyncHours} h</b><small>pełna synchronizacja</small></div>
    </div>
    <form class="allegro-settings-layout" onsubmit="event.preventDefault();allegroZapiszUstawieniaOfert(this)">
      <section class="allegro-settings-section primary">
        <div class="allegro-settings-section-head"><div><span>🧠</span><div><h3>Autonomiczny Agent sprzedaży</h3><p>Agent pracuje na serwerze przy zamkniętym panelu: łączy pewne oferty z kartoteką, wykrywa duplikaty, wskazuje najlepszą ofertę i zapisuje pełny audyt. Zakończenie oferty wymaga decyzji.</p></div></div><label class="switch-check"><input type="checkbox" name="autonomousAgent" ${settings.autonomousAgent!==false?"checked":""}><span>Włączony</span></label></div>
        <div class="allegro-settings-grid compact"><label>Cykl pracy Agenta<select name="autonomousAgentMinutes">${option(15,settings.autonomousAgentMinutes,"co 15 minut")}${option(30,settings.autonomousAgentMinutes,"co 30 minut")}${option(60,settings.autonomousAgentMinutes,"co 1 godzinę")}${option(120,settings.autonomousAgentMinutes,"co 2 godziny")}</select></label><label>Minimalna pewność rekomendacji duplikatu<input name="autoResolveDuplicateMinScore" type="number" min="95" max="100" step="1" value="${esc(settings.autoResolveDuplicateMinScore)}"><small>Nazwa nigdy nie wystarcza. Agent wymaga EAN/GTIN, ID katalogu lub EXTERNAL_ID/SKU.</small></label></div>
        <div class="allegro-settings-checks"><label class="check"><input type="checkbox" name="autoResolveDuplicates" ${settings.autoResolveDuplicates!==false?"checked":""}> Automatycznie wykrywaj duplikaty i przygotowuj decyzję z najlepszą ofertą</label></div>
        <div class="allegro-sync-status-grid"><span><small>Ostatni cykl</small><b>${dataLabel(agent.completedAt)}</b><em>Status: ${esc(agent.status||"oczekuje")}</em></span><span><small>Ostatni rezultat</small><b>${esc(agent.duplicateOffersEnded||0)} duplikatów zakończonych</b><em>${esc(agent.mapping?.autoMapped||0)} nowych powiązań • ${esc(agent.reviewCount||0)} do decyzji</em></span><button class="btn" type="button" onclick="allegroUruchomAgentAutonomiczny()">Uruchom Agenta teraz</button></div>
      </section>
      <section class="allegro-settings-section primary">
        <div class="allegro-settings-section-head"><div><span>🤖</span><div><h3>Automatyczne mapowanie ofert</h3><p>Pewne, jednoznaczne zgodności EAN, ID produktu i kodu są łączone bez klikania. Wyjątki pozostają do ręcznej kontroli.</p></div></div><label class="switch-check"><input type="checkbox" name="autoMapping" ${settings.autoMapping!==false?"checked":""}><span>Włączone</span></label></div>
        <div class="allegro-settings-grid compact"><label>Próg pewności od 55%<input name="mappingMinScore" type="number" min="55" max="100" step="1" required value="${esc(settings.mappingMinScore)}"><small>Możesz ustawić dowolny próg od 55% do 100%. System nadal odrzuca konflikty i niejednoznaczne duplikaty.</small></label><div class="allegro-setting-action"><b>Natychmiastowa kontrola</b><small>Zapisz nowy próg i od razu połącz wszystkie pozycje, które go spełniają.</small><button class="btn" type="button" onclick="this.form.requestSubmit()">💾 Zapisz i połącz według progu</button></div></div>
      </section>
      <section class="allegro-settings-section">
        <div class="allegro-settings-section-head"><div><span>⏱️</span><div><h3>Harmonogram synchronizacji</h3><p>Ustawienia są wykonywane przez serwer również wtedy, gdy panel administratora jest zamknięty.</p></div></div></div>
        <div class="allegro-settings-grid"><label>Zamówienia, komunikacja i lista ofert<select name="lightSyncMinutes">${option(15,settings.lightSyncMinutes,"co 15 minut")}${option(30,settings.lightSyncMinutes,"co 30 minut")}${option(60,settings.lightSyncMinutes,"co 1 godzinę")}${option(120,settings.lightSyncMinutes,"co 2 godziny")}</select></label><label>Pełne dane, opisy i katalog<select name="fullSyncHours">${option(6,settings.fullSyncHours,"automatycznie co 6 godzin")}${option(12,settings.fullSyncHours,"automatycznie co 12 godzin")}${option(24,settings.fullSyncHours,"automatycznie co 24 godziny")}</select></label></div>
        <div class="allegro-sync-status-grid"><span><small>Ostatnia lekka</small><b>${dataLabel(sync.lastLightSyncAt)}</b><em>Następna: ${dataLabel(sync.nextLightSyncAt)}</em></span><span><small>Ostatnia pełna</small><b>${dataLabel(sync.lastFullSyncAt)}</b><em>Następna: ${dataLabel(sync.nextFullSyncAt)}</em></span><button class="btn ghost" type="button" onclick="allegroSynchronizujWszystko()">Synchronizuj wszystko teraz</button></div>
      </section>
      <section class="allegro-settings-section">
        <div class="allegro-settings-section-head"><div><span>🏷️</span><div><h3>Dane i konserwacja ofert</h3><p>Wybierz, które elementy system ma utrzymywać automatycznie po zapisaniu lub synchronizacji produktu.</p></div></div></div>
        <div class="allegro-settings-checks"><label class="check"><input type="checkbox" name="autoCatalog" ${settings.autoCatalog!==false?"checked":""}> Dobieraj katalog i kategorię</label><label class="check"><input type="checkbox" name="syncDescriptions" ${settings.syncDescriptions!==false?"checked":""}> Automatycznie poprawiaj krótki opis, pełny opis i układ</label><label class="check"><input type="checkbox" name="autoUpdateOffers" ${settings.autoUpdateOffers!==false?"checked":""}> Aktualizuj powiązaną ofertę</label><label class="check"><input type="checkbox" name="autoFees" ${settings.autoFees!==false?"checked":""}> Pobieraj prowizje i opłaty</label><label class="check"><input type="checkbox" name="autoCorrections" ${settings.autoCorrections!==false?"checked":""}> Kwarantanna błędnych powiązań</label></div>
      </section>
      <section class="allegro-settings-section">
        <div class="allegro-settings-section-head"><div><span>📦</span><div><h3>Domyślne dane oferty</h3><p>Stan ofertowy pozostaje niezależny od fizycznego stanu magazynu. Automatyczne wznawianie jest zawsze aktywne.</p></div></div></div>
        <div class="allegro-settings-grid"><label>Domyślny stan każdej oferty<input name="defaultStock" type="number" min="1" max="99999" step="1" required value="${offerStock}"><small>Nowe i aktualizowane oferty otrzymają tę wartość.</small></label><label>Dozwoleni producenci<textarea name="producers" rows="4" required>${esc(allegroListaProducentow().join("\n"))}</textarea><small>Po jednym producencie w wierszu.</small></label></div>
        <label class="check allegro-apply-existing"><input type="checkbox" name="applyExisting"> Zastosuj stan i wznawianie także do wszystkich ${allegroOferty.length} istniejących ofert</label>
        ${audit.length?`<small class="allegro-settings-audit">Ostatni audyt: ${audit.length-auditOpen} bez problemu • ${auditOpen} wymaga uzupełnienia.</small>`:""}
      </section>
      <div class="allegro-settings-savebar"><div><b>Wszystkie ustawienia zapisują się na serwerze</b><small>Obowiązują na każdym urządzeniu i dla zadań automatycznych.</small></div><button class="btn" type="submit" ${allegroOperacjaUstawien.busy?"disabled":""}>💾 Zapisz wszystkie ustawienia</button></div>
    </form>
    ${allegroPostepUstawienHTML()}
    <details class="allegro-manual-sync"><summary>Zaawansowane narzędzia i informacje techniczne</summary><div class="panel-subtle"><div class="diag-actions"><button class="btn ghost" type="button" onclick="allegroSynchronizujZamowienia()">Zamówienia</button><button class="btn ghost" type="button" onclick="allegroSynchronizujOferty()">Oferty</button><button class="btn ghost" type="button" onclick="allegroUruchomAutomatycznaKonserwacje()">Katalog i opisy</button><button class="btn ghost" type="button" onclick="allegroSynchronizujKomunikacje(false)">Komunikacja</button></div><p><b>Konserwacja:</b> ${maintenance.lastRun?`${dataLabel(maintenance.lastRun)} • sprawdzono ${esc(maintenance.scanned||0)} • poprawiono ${esc(maintenance.updated||0)}`:"oczekuje na pierwsze uruchomienie"}.</p><p>Środowisko: <b>${esc(allegroStan.env||"production")}</b>. Ostatni odczyt integracji: ${dataLabel(allegroStan.updated_at)}.</p></div></details>
  </div>`;
}
