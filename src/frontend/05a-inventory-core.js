function stanProduktu(p){ return (typeof p.stan==="number" && p.stan>=0) ? p.stan : null; }   // null = bez limitu
function produktMaCeneSprzedazy(p){ return Number(p?.cena)>0; }
function wpisDostepnosciProduktu(id){
  return (dostepnoscProduktow||{})[String(id)] || (dostepnoscProduktow||{})[id] || null;
}
function decyzjaProducentaInfo(p={}){
  const d=wpisDostepnosciProduktu(p?.id)||{},code=String(d.decision||d.decyzja||"").toLowerCase(),expiresAt=d.expiresAt||d.waznaDo||"",expiresMs=Date.parse(expiresAt||""),expired=code==="grace"&&Number.isFinite(expiresMs)&&expiresMs<=Date.now(),remainingHours=Number.isFinite(expiresMs)?Math.max(0,Math.ceil((expiresMs-Date.now())/3600000)):null;
  const meta={
    grace:{label:expired?"termin minął — sprzedaż wstrzymana":`sprzedaż pozostaje aktywna${remainingHours!==null?` • ${remainingHours} h`:""}`,cls:expired?"bad":"warn",ico:expired?"⛔":"⏳"},
    wait_available:{label:"ukryty do powrotu u producenta",cls:"info",ico:"🔄"},
    hide_manual:{label:"ukryty do ręcznego wznowienia",cls:"bad",ico:"⏸️"},
    manual_available:{label:"ręcznie pozostawiony w sprzedaży",cls:"warn",ico:"🟠"},
    auto:{label:"decyzję prowadzi automat producenta",cls:"info",ico:"🤖"}
  }[code]||null;
  return {record:d,code,expiresAt,expiresMs,expired,remainingHours,label:meta?.label||"brak decyzji administratora",cls:meta?.cls||"unknown",ico:meta?.ico||"❔",operator:d.operator||"",reason:d.reason||d.powod||"",history:Array.isArray(d.history)?d.history:[]};
}
function produktOznaczonyNiedostepny(p){
  const d=wpisDostepnosciProduktu(p?.id);
  const decision=decyzjaProducentaInfo(p);
  if(decision.code==="manual_available")return false;
  if(decision.code==="grace")return decision.expired;
  return !!d && String(d.status||"").toLowerCase()==="niedostepny";
}
function produktAutomatycznieNiedostepny(p){const d=wpisDostepnosciProduktu(p?.id);return produktOznaczonyNiedostepny(p)&&(d?.automatic===true||d?.source==="producent-agent");}
function powodNiedostepnosci(p){
  const d=wpisDostepnosciProduktu(p?.id);
  return String(d?.powod||"").trim();
}
function produktDostepnyWSprzedazy(p){
  return !!p && produktMaCeneSprzedazy(p) && !produktOznaczonyNiedostepny(p);
}
function produktWidocznyWPublicznymKatalogu(p){
  if(!produktDostepnyWSprzedazy(p))return false;
  if(p.aktywny===false||p.ukryty===true||p.sprzedazAktywna===false||p.saleAvailable===false)return false;
  return !["trash","removed","deleted"].includes(String(p.recordStatus||p.record_status||"").toLowerCase());
}
function odswiezDostepnoscProducentowWidoku(){
  if(typeof odswiezMonitoringProducentow==="function"&&odswiezMonitoringProducentow())return;
  renderuj();
}
async function ustawDostepnoscProduktu(id, status="dostepny", powod=""){
  const key=String(id);
  const s=String(status||"dostepny").toLowerCase();
  if(chmuraToken&&maUprawnieniaZapisuChmury()){
    toast(s==="niedostepny"?"⏳ Wstrzymuję sprzedaż w sklepie i na Allegro…":"⏳ Wznawiam sprzedaż w sklepie i na Allegro…");
    try{
      const d=await chmura("product-sale-availability",{method:"POST",body:{productId:id,available:s!=="niedostepny",reason:String(powod||"").trim()},timeout:120000});
      await chmuraWczytajStan();if(typeof allegroWczytajDane==="function")await allegroWczytajDane(true,false,"offers");zbudujProdukty();
      loguj("info",`Dostępność produktu ${id} zmieniona jako jedna operacja sklep + Allegro`);
      toast(s==="niedostepny"?`✅ Sprzedaż wstrzymana • sklep + Allegro (${d.saleAutomation?.allegroHidden||0} ofert)`:`✅ Sprzedaż wznowiona • sklep + Allegro (${d.saleAutomation?.allegroRestored||0} ofert)`);
    }catch(e){loguj("blad",`Spójna zmiana sprzedaży produktu ${id}: ${e.message||e}`);toast(`⛔ Niczego nie zmieniono — sklep i Allegro muszą potwierdzić operację razem: ${e.message||e}`);}
    odswiezDostepnoscProducentowWidoku();return;
  }
  if(s==="niedostepny")dostepnoscProduktow={...(dostepnoscProduktow||{}),[key]:{status:"niedostepny",powod:String(powod||"").trim(),data:new Date().toISOString(),operator:sesja?.email||"administrator",source:"manual",automatic:false}};
  else{dostepnoscProduktow={...(dostepnoscProduktow||{})};delete dostepnoscProduktow[key];delete dostepnoscProduktow[id];}
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zbudujProdukty();
  loguj("info",`Dostępność sprzedażowa: produkt ${id} → ${s}`);
  toast(s==="niedostepny"?"Produkt ukryty lokalnie — połącz wspólną bazę, aby wstrzymać również Allegro":"Produkt dostępny lokalnie — połącz wspólną bazę, aby wznowić również Allegro");
  odswiezDostepnoscProducentowWidoku();
}
function przelaczDostepnoscProduktu(id){
  const p=produktMagazynowy(id);
  if(!p)return;
  if(produktOznaczonyNiedostepny(p)){
    if(produktAutomatycznieNiedostepny(p)){
      toast("Status ustala kontrola producenta — sprawdzam dostępność ponownie");
      agentAISprawdzDostepnoscProducentow(1,[id]);
      return;
    }
    void ustawDostepnoscProduktu(id,"dostepny");
  }
  else {
    const powod=prompt("Powód niedostępności widoczny tylko w panelu (opcjonalnie):","chwilowo niedostępny");
    if(powod===null)return;
    void ustawDostepnoscProduktu(id,"niedostepny",powod);
  }
}
function dostepnoscBadgeAdmin(p){
  const automat=produktAutomatycznieNiedostepny(p);
  const decision=decyzjaProducentaInfo(p);
  return produktOznaczonyNiedostepny(p)
    ? `<span class="lvl lvl-blad">sprzedaż wstrzymana • sklep + Allegro${automat?" • automatycznie":""}</span>${powodNiedostepnosci(p)?`<br><small>${esc(powodNiedostepnosci(p))}</small>`:""}${decision.code?`<br><small>${decision.ico} ${esc(decision.label)}</small>`:""}`
    : `<span class="lvl lvl-ok">sprzedaż aktywna • oba kanały</span>${decision.code?`<br><small>${decision.ico} ${esc(decision.label)}</small>`:""}`;
}
function decyzjaProducentaDane(id,value="auto"){
  const p=produktMagazynowy(id),i=producentDostepnoscInfo(p||{}),current=decyzjaProducentaInfo(p||{}),now=new Date(),parts=String(value||"auto").split(":"),code=parts[0],days=Math.max(0,Math.min(30,Number(parts[1])||0)),history=[{at:now.toISOString(),decision:code,days,operator:sesja?.email||"administrator"},...current.history].slice(0,20),base={data:now.toISOString(),operator:sesja?.email||"administrator",source:"supplier-decision",automatic:false,producerStatus:i.status,producerCheckedAt:i.checked,history};
  if(code==="grace")return {...base,status:"dostepny",decision:"grace",expiresAt:new Date(now.getTime()+days*86400000).toISOString(),powod:`Decyzja administratora: pozostaw sprzedaż przez ${days} ${days===1?"dzień":"dni"}`,reason:`Pozostaw sprzedaż przez ${days} dni`};
  if(code==="wait_available")return {...base,status:"niedostepny",decision:code,autoRestore:true,powod:"Ukryty do ponownej dostępności u producenta",reason:"Automatycznie wznów po powrocie"};
  if(code==="hide_manual")return {...base,status:"niedostepny",decision:code,autoRestore:false,powod:"Ręcznie ukryty bez automatycznego wznowienia",reason:"Wznowienie wyłącznie decyzją administratora"};
  if(code==="manual_available")return {...base,status:"dostepny",decision:code,autoRestore:false,powod:"Ręcznie pozostawiony w sprzedaży mimo sygnału producenta",reason:"Ręczne utrzymanie sprzedaży"};
  if(i.status==="brak")return {...base,status:"niedostepny",decision:"auto",automatic:true,source:"producent-agent",autoRestore:true,powod:"Automatycznie: produkt niedostępny u producenta",reason:"Automatyczna decyzja wg producenta"};
  return null;
}
const DECYZJE_PRODUCENTA_OPCJE=[
  ["auto","🤖 Automat według producenta"],["grace:1","⏳ Zostaw sprzedaż jeszcze 1 dzień"],["grace:2","⏳ Zostaw sprzedaż jeszcze 2 dni"],["grace:3","⏳ Zostaw sprzedaż jeszcze 3 dni"],["grace:7","⏳ Zostaw sprzedaż jeszcze 7 dni"],["wait_available","🔄 Ukryj i wznów po powrocie"],["hide_manual","⏸️ Ukryj do mojej decyzji"],["manual_available","🟠 Pozostaw aktywny bez terminu"]
];
function decyzjaProducentaOpcjeHTML(selected="auto"){return DECYZJE_PRODUCENTA_OPCJE.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?"selected":""}>${esc(label)}</option>`).join("");}
function decyzjaProducentaEtykieta(value="auto"){return DECYZJE_PRODUCENTA_OPCJE.find(([key])=>key===value)?.[1]||"Wybrana decyzja";}
function zapiszDecyzjeProducentowLokalnie(ids=[],value="auto",historia=true){
  const unique=[...new Set((Array.isArray(ids)?ids:[]).map(String))].map(produktMagazynowy).filter(Boolean);if(!unique.length)return 0;
  dostepnoscProduktow={...(dostepnoscProduktow||{})};
  for(const p of unique){const next=decyzjaProducentaDane(p.id,value),key=String(p.id),i=producentDostepnoscInfo(p);if(next)dostepnoscProduktow[key]=next;else{delete dostepnoscProduktow[key];delete dostepnoscProduktow[p.id];}if(historia)zapiszHistorieAgenta("decyzja-producenta",`Decyzja sprzedażowa dla ${p.nazwa}: ${next?.reason||"automat — produkt dostępny"}`,{productId:p.id,decision:value,producerStatus:i.status,expiresAt:next?.expiresAt||null});}
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);zbudujProdukty();return unique.length;
}
async function ustawDecyzjeProducenta(id,value="auto"){
  const p=produktMagazynowy(id);if(!p)return;
  const next=decyzjaProducentaDane(id,value),key=String(id),i=producentDostepnoscInfo(p);
  if(maUprawnieniaZapisuChmury()){
    toast("⏳ Zapisuję jedną decyzję dla sklepu i Allegro…");
    try{const d=await chmura("product-sale-decision",{method:"POST",body:{productId:id,decision:String(value).split(":")[0],days:Number(String(value).split(":")[1])||0,producerStatus:i.status,producerQuantity:i.quantity,reason:next?.reason||"Automatyczna decyzja"},timeout:120000});await chmuraWczytajStan();if(typeof allegroWczytajDane==="function")await allegroWczytajDane(true,false,"offers");zbudujProdukty();toast(`✅ Jedna decyzja zapisana • sklep: ${d.available?"aktywny":"wstrzymany"} • Allegro: wstrzymano ${d.saleAutomation?.allegroHidden||0}, wznowiono ${d.saleAutomation?.allegroRestored||0}`);}
    catch(e){toast(`⛔ Niczego nie zmieniono — operacja sklep + Allegro nie została potwierdzona: ${e.message||e}`);}
  }else{
    dostepnoscProduktow={...(dostepnoscProduktow||{})};if(next)dostepnoscProduktow[key]=next;else{delete dostepnoscProduktow[key];delete dostepnoscProduktow[id];}
    zapiszLS("artway_dostepnosc",dostepnoscProduktow);zbudujProdukty();zapiszHistorieAgenta("decyzja-producenta",`Decyzja sprzedażowa dla ${p.nazwa}: ${next?.reason||"automat — produkt dostępny"}`,{productId:id,decision:value,producerStatus:i.status,expiresAt:next?.expiresAt||null});toast("Decyzja zapisana lokalnie — połącz wspólną bazę, aby zmienić oba kanały");
  }
  odswiezDostepnoscProducentowWidoku();
}
function zastosujWyborDecyzjiProducenta(id){const el=document.querySelector(`[data-supplier-decision="${CSS.escape(String(id))}"]`);if(el)void ustawDecyzjeProducenta(id,el.value);}
function ustawZaznaczenieDostepnosciProducentow(zakres,zaznacz=true){
  const ids=zakres==="strona"?dostepnoscProducentowStronaIds:zakres==="filtr"?dostepnoscProducentowWynikiIds:Array.isArray(zakres)?zakres:[];
  ids.slice(0,500).forEach(id=>zaznacz?zaznaczoneDostepnoscProducentow.add(String(id)):zaznaczoneDostepnoscProducentow.delete(String(id)));if(ids.length>500)toast("Zaznaczono bezpieczną partię 500 produktów");odswiezDostepnoscProducentowWidoku();
}
function wyczyscZaznaczenieDostepnosciProducentow(){zaznaczoneDostepnoscProducentow.clear();odswiezDostepnoscProducentowWidoku();}
async function zastosujGrupowaDecyzjeProducenta(){
  const select=document.querySelector("[data-supplier-bulk-decision]"),button=document.querySelector("[data-supplier-bulk-apply]"),value=String(select?.value||"auto"),ids=[...zaznaczoneDostepnoscProducentow].filter(id=>produktMagazynowy(id)).slice(0,500);
  if(!ids.length){toast("Zaznacz co najmniej jeden produkt");return;}if(!confirm(`${decyzjaProducentaEtykieta(value)} — zastosować do ${ids.length} zaznaczonych produktów?`))return;
  const parts=value.split(":"),items=ids.map(id=>{const p=produktMagazynowy(id),i=producentDostepnoscInfo(p);return{productId:id,decision:parts[0],days:Number(parts[1])||0,producerStatus:i.status,producerQuantity:i.quantity};});if(button){button.disabled=true;button.textContent=`⏳ Zapisuję ${ids.length}…`;}
  try{
    if(maUprawnieniaZapisuChmury()){const d=await chmura("product-sale-decision",{method:"POST",body:{items},timeout:180000});await chmuraWczytajStan();if(typeof allegroWczytajDane==="function")await allegroWczytajDane(true,false,"offers");zbudujProdukty();toast(`✅ Zapisano ${d.changed||ids.length} spójnych decyzji • Allegro: wstrzymano ${d.saleAutomation?.allegroHidden||0}, wznowiono ${d.saleAutomation?.allegroRestored||0}`);}else{zapiszDecyzjeProducentowLokalnie(ids,value,true);toast(`Zapisano lokalnie ${ids.length} decyzji — połącz wspólną bazę, aby zmienić oba kanały`);}
    ids.forEach(id=>zaznaczoneDostepnoscProducentow.delete(String(id)));
  }catch(e){toast(`⛔ Niczego nie zmieniono — operacja sklep + Allegro nie została potwierdzona: ${e.message||e}`);}
  odswiezDostepnoscProducentowWidoku();
}
function grupowaDecyzjaProducentaHTML(){const n=zaznaczoneDostepnoscProducentow.size;return `<div class="supplier-bulk-decision"><label><span>Decyzja dla zaznaczonych</span><select data-supplier-bulk-decision>${decyzjaProducentaOpcjeHTML("auto")}</select></label><button class="btn" type="button" data-supplier-bulk-apply onclick="zastosujGrupowaDecyzjeProducenta()" ${n?"":"disabled"}>Zastosuj do ${n}</button><small>Jedno potwierdzenie i jeden spójny zapis dla całej grupy. Sklep i powiązane oferty Allegro zmienią się dopiero po zatwierdzeniu.</small></div>`;}
function decyzjaProducentaPanelHTML(p={},i=producentDostepnoscInfo(p)){
  const d=decyzjaProducentaInfo(p),requires=["brak","niski"].includes(i.status)&&(!d.code||d.expired);
  const selected=zaznaczoneDostepnoscProducentow.has(String(p.id));
  return `<div class="supplier-sale-decision ${d.cls} ${requires?"requires":""} ${selected?"is-selected":""}"><label class="supplier-decision-select"><input type="checkbox" aria-label="Zaznacz ${esc(p.nazwa||"produkt")}" ${selected?"checked":""} onchange="ustawZaznaczenieDostepnosciProducentow([${jsArg(p.id)}],this.checked)"><span>${selected?"Zaznaczony do operacji grupowej":"Zaznacz produkt"}</span></label><div><b>${d.ico} ${esc(d.label)}</b><small>${d.expiresAt?`Do ${esc(new Date(d.expiresAt).toLocaleString("pl-PL"))}`:d.reason?esc(d.reason):requires?"Wybierz dalsze działanie sprzedażowe.":"Brak aktywnego wyjątku."}</small></div><select data-supplier-decision="${esc(p.id)}">${decyzjaProducentaOpcjeHTML("auto")}</select><button class="btn ${requires?"":"ghost"}" type="button" onclick="zastosujWyborDecyzjiProducenta(${jsArg(p.id)})">Zastosuj decyzję</button></div>`;
}
function stanMagazynuId(id){
  if(stanyProduktow[id]===undefined || stanyProduktow[id]===null || stanyProduktow[id]==="") return null;
  const n=Number(stanyProduktow[id]);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}
function produktMagazynowy(id){ return produktyDoAdministracji().find(p=>String(p.id)===String(id)) || produkty.find(p=>String(p.id)===String(id)) || null; }
function ustawieniaMagazynuPelne(){
  return {
    nazwa:"Magazyn główny",
    progNiski:5,
    lokalizacja:"",
    domyslnyOperator:sesja?.email||"administrator",
    domyslnyDostawca:"",
    domyslnyLeadTime:7,
    domyslnyZapasDni:21,
    progNiskiProducenta:50,
    producentProbka:8,
    producentMaxWiekGodz:48,
    ...(ustawieniaMagazynu||{})
  };
}
function intNieujemny(v, dom=0){
  const n=parseInt(String(v??"").replace(/[^0-9-]/g,""),10);
  return Number.isFinite(n) ? Math.max(0,n) : dom;
}
function magazynMetaProduktu(id){
  const raw=(magazynProdukty||{})[String(id)] || (magazynProdukty||{})[id] || {};
  return raw && typeof raw==="object" ? raw : {};
}
function zapiszMagazynMeta(id, meta){
  const key=String(id);
  const czysty={
    lokalizacja:String(meta.lokalizacja||"").trim(),
    dostawca:String(meta.dostawca||"").trim(),
    kod:String(meta.kod||"").trim(),
    minStock:meta.minStock===""||meta.minStock===null||meta.minStock===undefined?"":intNieujemny(meta.minStock,0),
    targetStock:meta.targetStock===""||meta.targetStock===null||meta.targetStock===undefined?"":intNieujemny(meta.targetStock,0),
    leadTime:meta.leadTime===""||meta.leadTime===null||meta.leadTime===undefined?"":intNieujemny(meta.leadTime,0),
    minZakup:meta.minZakup===""||meta.minZakup===null||meta.minZakup===undefined?"":intNieujemny(meta.minZakup,0),
    uwagi:String(meta.uwagi||"").trim(),
    ostatniaInwentaryzacja:String(meta.ostatniaInwentaryzacja||"").trim(),
    aktualizacja:new Date().toISOString(),
    operator:sesja?.email||"administrator"
  };
  const maDane=Object.entries(czysty).some(([k,v])=>!["aktualizacja","operator"].includes(k)&&String(v||"").trim()!=="");
  magazynProdukty={...(magazynProdukty||{})};
  if(maDane) magazynProdukty[key]=czysty;
  else delete magazynProdukty[key];
  zapiszLS("artway_magazyn_produkty",magazynProdukty);
  return czysty;
}
function kodLokalizacjiMagazynu(v=""){
  const mapa={"ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z"};
  return String(v||"").trim().toLowerCase()
    .replace(/[ąćęłńóśźż]/g,m=>mapa[m]||m)
    .toUpperCase()
    .replace(/[^A-Z0-9._/-]+/g,"-")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"")
    .slice(0,40);
}
let magazynLokalizacjeIndexCache={source:null,lista:[],aktywne:[],poKodzie:new Map(),sciezki:new Map(),sciezkiNazw:new Map(),poziomy:new Map(),opcjeHTML:""};
function magazynLokalizacjeIndex(){
  const source=Array.isArray(magazynLokalizacje)?magazynLokalizacje:[];
  if(magazynLokalizacjeIndexCache.source===source)return magazynLokalizacjeIndexCache;
  const lista=source.filter(Boolean),poKodzie=new Map();
  lista.forEach(l=>{const kod=kodLokalizacjiMagazynu(l.kod);if(kod&&!poKodzie.has(kod))poKodzie.set(kod,l);});
  const sciezki=new Map(),sciezkiNazw=new Map(),poziomy=new Map();
  const policz=(rawKod)=>{
    const kod=kodLokalizacjiMagazynu(rawKod);if(sciezki.has(kod))return;
    const kody=[],nazwy=[],seen=new Set();let current=poKodzie.get(kod)||null,guard=0;
    while(current&&guard++<20){
      const currentKod=kodLokalizacjiMagazynu(current.kod);if(!currentKod||seen.has(currentKod))break;
      seen.add(currentKod);kody.unshift(String(current.kod||currentKod));nazwy.unshift(String(current.nazwa||current.kod||currentKod));
      current=current.parentKod?poKodzie.get(kodLokalizacjiMagazynu(current.parentKod))||null:null;
    }
    sciezki.set(kod,kody.join(" / ")||String(rawKod||""));sciezkiNazw.set(kod,nazwy.join(" → ")||String(rawKod||""));poziomy.set(kod,Math.max(0,kody.length-1));
  };
  lista.forEach(l=>policz(l.kod));
  // Starsze rekordy typu „miejsce” pozostają w indeksie tylko po to, aby
  // historyczne dokumenty i etykiety nadal dawały się odczytać. W bieżącej
  // pracy magazynu ostatnim poziomem jest półka.
  const aktywne=lista.filter(l=>l.aktywna!==false&&l.typ!=="miejsce").sort((a,b)=>{
    const ka=kodLokalizacjiMagazynu(a.kod),kb=kodLokalizacjiMagazynu(b.kod);
    return String(sciezki.get(ka)||ka).localeCompare(String(sciezki.get(kb)||kb),"pl",{numeric:true})||(Number(a.priorytet)||9999)-(Number(b.priorytet)||9999);
  });
  const opcjeHTML=aktywne.map(l=>{const kod=kodLokalizacjiMagazynu(l.kod),opis=`${"\u00b7 ".repeat(poziomy.get(kod)||0)}${l.kod}${l.nazwa?` — ${l.nazwa}`:""} [${l.typ||"miejsce"}]`;return `<option value="${esc(l.kod)}">${esc(opis)}</option>`;}).join("");
  magazynLokalizacjeIndexCache={source,lista,aktywne,poKodzie,sciezki,sciezkiNazw,poziomy,opcjeHTML};return magazynLokalizacjeIndexCache;
}
function magazynLokalizacjeAktywne(){return magazynLokalizacjeIndex().aktywne;}
function magazynLokalizacjaPoKodzie(kod){return magazynLokalizacjeIndex().poKodzie.get(kodLokalizacjiMagazynu(kod))||null;}
function magazynPolkaPoKodzie(kod){
  let location=magazynLokalizacjaPoKodzie(kod),guard=0;
  while(location&&location.typ!=="półka"&&guard++<12)location=location.parentKod?magazynLokalizacjaPoKodzie(location.parentKod):null;
  return location?.typ==="półka"?location:null;
}
function nazwaLokalizacjiMagazynu(kod){
  const l=magazynLokalizacjaPoKodzie(kod);
  return l?`${l.kod}${l.nazwa?` — ${l.nazwa}`:""}`:String(kod||"");
}
function sciezkaLokalizacjiMagazynu(kod){const key=kodLokalizacjiMagazynu(kod);return magazynLokalizacjeIndex().sciezki.get(key)||String(kod||"");}
function poziomLokalizacjiMagazynu(kod){return magazynLokalizacjeIndex().poziomy.get(kodLokalizacjiMagazynu(kod))||0;}
function sciezkaNazwLokalizacjiMagazynu(kod){const key=kodLokalizacjiMagazynu(kod);return magazynLokalizacjeIndex().sciezkiNazw.get(key)||String(kod||"");}
function czyLokalizacjaBezLimitu(location){return !location||location.bezLimitu===true||!(Number(location.pojemnosc)>0);}
function magazynLiteraRegalu(index=1){let n=Math.max(1,Math.trunc(Number(index)||1)),out="";while(n>0){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}return out;}
function magazynIndeksRegalu(value="A"){
  const text=String(value||"A").trim().toUpperCase();if(/^\d+$/.test(text))return Math.max(1,Number(text)||1);
  return Math.max(1,[...text.replace(/[^A-Z]/g,"")].reduce((sum,char)=>sum*26+char.charCodeAt(0)-64,0)||1);
}
function zapiszLokalizacjeMagazynuWspolnie(opis="Zapisano lokalizacje"){
  zapiszLS("artway_magazyn_lokalizacje",magazynLokalizacje);
  zapiszHistorieAgenta("lokalizacja",opis,{liczba:magazynLokalizacjeAktywne().length});
  if(chmuraToken)void chmuraZapiszUstawienia();
}
function selectLokalizacjiMagazynu(value=""){
  const raw=String(value||"").trim(),v=magazynPolkaPoKodzie(raw)?.kod||raw, aktywne=magazynLokalizacjeAktywne();
  return `<select name="lokalizacja">
    <option value="" ${!v?"selected":""}>— brak lokalizacji —</option>
    ${aktywne.map(l=>`<option value="${esc(l.kod)}" ${v===l.kod?"selected":""}>${"· ".repeat(poziomLokalizacjiMagazynu(l.kod))}${esc(l.kod)}${l.nazwa?` — ${esc(l.nazwa)}`:""} [${esc(l.typ||"miejsce")}]</option>`).join("")}
    ${v&&!aktywne.some(l=>l.kod===v)?`<option value="${esc(v)}" selected>${esc(v)} — spoza słownika</option>`:""}
  </select>`;
}
function poleLokalizacjiMagazynu(value="",listId="warehouseLocationOptions"){
  const raw=String(value||"").trim(),normalized=magazynPolkaPoKodzie(raw)?.kod||raw;return `<input name="lokalizacja" list="${esc(listId)}" value="${esc(normalized)}" placeholder="Wpisz lub wybierz kod półki" autocomplete="off">`;
}
function magazynLokalizacjeDatalistHTML(id="warehouseLocationOptions"){
  return `<datalist id="${esc(id)}">${magazynLokalizacjeIndex().opcjeHTML}</datalist>`;
}
function statystykiLokalizacji(produktyLista=produktyDoAdministracji()){
  // Podstrona lokalizacji działa bez ciężkiego modułu operacji magazynowych.
  // Po jego doładowaniu statystyki automatycznie uwzględniają rezerwacje.
  const rez=typeof rezerwacjeMagazynowe==="function"?rezerwacjeMagazynowe():{}, mapa={};
  produktyLista.filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    const meta=magazynMetaProduktu(p.id), rawKod=String(meta.lokalizacja||"").trim(),kod=magazynPolkaPoKodzie(rawKod)?.kod||rawKod||"BRAK";
    const stan=stanMagazynuId(p.id), rezerwacje=Number(rez[p.id]||0);
    const rec=mapa[kod]||(mapa[kod]={kod,produkty:0,sztuki:0,rezerwacje:0,wartosc:0,brakiKartoteki:0});
    rec.produkty++;
    if(stan!==null){ rec.sztuki+=stan; rec.wartosc+=stan*kwotaNum(p.cena); }
    rec.rezerwacje+=rezerwacje;
    if(!meta.dostawca||!meta.lokalizacja) rec.brakiKartoteki++;
  });
  const direct=Object.entries(mapa).filter(([kod])=>kod!=="BRAK").map(([kod,rec])=>[kod,{...rec}]);
  for(const [kod,rec] of direct){let parent=magazynLokalizacjaPoKodzie(kod)?.parentKod||"",guard=0,seen=new Set([kod]);while(parent&&guard++<10&&!seen.has(parent)){seen.add(parent);const sum=mapa[parent]||(mapa[parent]={kod:parent,produkty:0,sztuki:0,rezerwacje:0,wartosc:0,brakiKartoteki:0});sum.produkty+=rec.produkty;sum.sztuki+=rec.sztuki;sum.rezerwacje+=rec.rezerwacje;sum.wartosc+=rec.wartosc;sum.brakiKartoteki+=rec.brakiKartoteki;parent=magazynLokalizacjaPoKodzie(parent)?.parentKod||"";}}
  return mapa;
}
function zapiszLokalizacjeMagazynu(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const kod=kodLokalizacjiMagazynu(f.get("kod"));
  if(!kod){ toast("Podaj kod lokalizacji, np. R1-P2"); return false; }
  const originalKod=kodLokalizacjiMagazynu(f.get("originalKod")),teraz=new Date().toISOString(), istnieje=magazynLokalizacjaPoKodzie(originalKod||kod),limit=Number(String(f.get("pojemnosc")||"0").replace(",","."))||0,bezLimitu=f.get("bezLimitu")==="on"||limit<=0;
  if(originalKod&&originalKod!==kod){toast("Kod zapisanej lokalizacji jest stały. Utwórz nową półkę, aby użyć innego kodu.");return false;}
  const rec={
    id:istnieje?.id||("LOC-"+Date.now().toString(36)),
    kod,
    nazwa:String(f.get("nazwa")||"").trim(),
    typ:String(f.get("typ")||"regał").trim(),
    strefa:String(f.get("strefa")||"").trim(),
    parentKod:kodLokalizacjiMagazynu(f.get("parentKod")),
    kodKreskowy:String(f.get("kodKreskowy")||"").trim(),
    szerokosc:intNieujemny(f.get("szerokosc"),0),
    glebokosc:intNieujemny(f.get("glebokosc"),0),
    wysokosc:intNieujemny(f.get("wysokosc"),0),
    maxWaga:Math.max(0,Number(String(f.get("maxWaga")||"0").replace(",","."))||0),
    pojemnosc:0,
    bezLimitu:true,
    priorytet:intNieujemny(f.get("priorytet"),999),
    uwagi:String(f.get("uwagi")||"").trim(),
    aktywna:true,
    utworzono:istnieje?.utworzono||teraz,
    aktualizacja:teraz,
    operator:sesja?.email||"administrator"
  };
  if(rec.typ==="miejsce"){toast("Miejsca nie są już osobnym poziomem. Wybierz lub utwórz półkę.");return false;}
  const bez=(Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).filter(l=>kodLokalizacjiMagazynu(l.kod)!==kod);
  if(rec.parentKod===kod){toast("Lokalizacja nie może być swoim rodzicem");return false;}
  if(rec.parentKod&&!magazynLokalizacjaPoKodzie(rec.parentKod)){toast("Najpierw utwórz wskazaną lokalizację nadrzędną");return false;}
  if(rec.parentKod&&sciezkaLokalizacjiMagazynu(rec.parentKod).split(" / ").includes(kod)){toast("Nie można utworzyć pętli w hierarchii lokalizacji");return false;}
  magazynLokalizacje=[rec,...bez].slice(0,5000);
  zapiszLokalizacjeMagazynuWspolnie(`${istnieje?"Zaktualizowano":"Utworzono"} lokalizację magazynową ${kod}`);
  toast(`${istnieje?"Zaktualizowano":"Utworzono"} lokalizację ${kod} ✅`);
  if(typeof nowaLokalizacjaMagazynu==="function")nowaLokalizacjaMagazynu();else e.target.reset();
  renderuj();
  return false;
}
function edytujLokalizacjeMagazynu(kod){
  const l=magazynLokalizacjaPoKodzie(kod);
  if(!l){ toast("Nie znaleziono lokalizacji"); return; }
  if(typeof magazynOtworzKreatorLokalizacji==="function"){magazynOtworzKreatorLokalizacji(l.typ,l.parentKod,l.kod);return;}
  const form=$("warehouseLocationForm");
  if(!form) return;
  ["kod","nazwa","typ","strefa","parentKod","kodKreskowy","szerokosc","glebokosc","wysokosc","maxWaga","pojemnosc","priorytet","uwagi"].forEach(k=>{ if(form.elements[k]) form.elements[k].value=l[k]??""; });
  if(form.elements.originalKod)form.elements.originalKod.value=l.kod;
  if(form.elements.kod)form.elements.kod.readOnly=true;
  if(form.elements.bezLimitu){form.elements.bezLimitu.checked=czyLokalizacjaBezLimitu(l);if(form.elements.pojemnosc)form.elements.pojemnosc.disabled=form.elements.bezLimitu.checked;}
  form.querySelector("[data-location-form-title]")?.replaceChildren(document.createTextNode(`✏️ Edycja: ${sciezkaNazwLokalizacjiMagazynu(l.kod)}`));
  form.scrollIntoView({behavior:"smooth",block:"center"});
  form.elements.kod?.focus();
}
function usunLokalizacjeMagazynu(kod){
  const k=kodLokalizacjiMagazynu(kod), stat=statystykiLokalizacji()[k];
  const msg=stat&&stat.produkty?`Lokalizacja ${k} ma przypisane ${stat.produkty} produktów. Ukryć ją w słowniku? Przypisania przy produktach zostaną jako tekst.`:`Ukryć lokalizację ${k}?`;
  if(!confirm(msg)) return;
  magazynLokalizacje=(Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).map(l=>kodLokalizacjiMagazynu(l.kod)===k?{...l,aktywna:false,aktualizacja:new Date().toISOString()}:l);
  zapiszLokalizacjeMagazynuWspolnie(`Ukryto lokalizację magazynową ${k}`);
  toast(`Ukryto lokalizację ${k}`);
  renderuj();
}
function generujRegalyIPolkiMagazynu(e){
  // Kanoniczna hierarchia fizyczna: obszar → regał → półka. Półka nie ma limitu sztuk.
  e.preventDefault();const f=new FormData(e.target),zone=kodLokalizacjiMagazynu(f.get("strefaKod")||"PAK"),zoneName=String(f.get("strefaNazwa")||"Pakownia").trim()||"Pakownia",rackMode=String(f.get("trybRegalow")||"litery"),rackCount=Math.max(1,Math.min(100,intNieujemny(f.get("regaly"),1))),shelfCount=Math.max(1,Math.min(200,intNieujemny(f.get("polki"),5))),startRack=magazynIndeksRegalu(f.get("startRegal")||"A"),startShelf=Math.max(1,intNieujemny(f.get("startPolka"),1)),now=new Date().toISOString();
  if(!zone){toast("Podaj kod obszaru, np. PAK");return false;}
  const requested=1+rackCount+rackCount*shelfCount;if(requested>5000){toast(`Wybrana struktura ma ${requested} elementów. Podziel tworzenie na mniejsze obszary (maks. 5000 elementów jednorazowo).`);return false;}
  const existing=new Map((Array.isArray(magazynLokalizacje)?magazynLokalizacje:[]).map(l=>[kodLokalizacjiMagazynu(l.kod),l])),created=[];let overflow=false;
  const put=(rec)=>{const old=existing.get(rec.kod);if(old&&old.aktywna!==false)return;if(!old&&existing.size>=5000){overflow=true;return;}const next={...old,id:old?.id||`LOC-${Date.now().toString(36)}-${created.length}`,aktywna:true,utworzono:old?.utworzono||now,aktualizacja:now,operator:sesja?.email||"administrator",...rec};existing.set(rec.kod,next);created.push(next);};
  put({kod:zone,nazwa:zoneName,typ:"strefa",parentKod:"",strefa:zone,priorytet:1,pojemnosc:0,bezLimitu:true,uwagi:"Obszar wygenerowany w kreatorze struktury"});
  for(let r=0;r<rackCount;r++){
    const rackLabel=rackMode==="numery"?String(startRack+r):magazynLiteraRegalu(startRack+r),rack=`${zone}-R${rackLabel}`;put({kod:rack,nazwa:`Regał ${rackLabel}`,typ:"regał",parentKod:zone,strefa:zone,priorytet:10+r,pojemnosc:0,bezLimitu:true,uwagi:""});
    for(let s=0;s<shelfCount;s++){
      const shelfNo=startShelf+s,shelf=`${rack}-P${String(shelfNo).padStart(2,"0")}`;put({kod:shelf,nazwa:`Półka ${shelfNo}`,typ:"półka",parentKod:rack,strefa:zone,priorytet:100+r*100+s,pojemnosc:0,bezLimitu:true,uwagi:""});
    }
  }
  if(overflow){toast("Struktura przekracza limit 5000 aktywnych elementów. Zmniejsz liczbę regałów lub półek.");return false;}
  magazynLokalizacje=[...existing.values()].slice(0,5000);zapiszLokalizacjeMagazynuWspolnie(`Generator utworzył ${created.length} elementów struktury magazynu`);toast(created.length?`✅ Utworzono ${created.length} nowych elementów: obszar, regały i półki`:"Wszystkie wskazane lokalizacje już istnieją");renderuj();return false;
}
function ustawLokalizacjeProduktu(id,kod){
  const meta=magazynMetaProduktu(id);
  zapiszMagazynMeta(id,{...meta,lokalizacja:String(kod||"").trim()});
  toast("Lokalizacja produktu zapisana ✅");
  renderuj();
}
function zapiszKartotekeMagazynu(e,id){
  e.preventDefault();
  const f=new FormData(e.target);
  zapiszMagazynMeta(id,{
    lokalizacja:f.get("lokalizacja"),
    dostawca:f.get("dostawca"),
    kod:f.get("kod"),
    optimaCode:f.get("optimaCode"),
    kodDostawcy:f.get("kodDostawcy"),
    minStock:f.get("minStock"),
    targetStock:f.get("targetStock"),
    leadTime:f.get("leadTime"),
    minZakup:f.get("minZakup"),
    uwagi:f.get("uwagi"),
    ostatniaInwentaryzacja:magazynMetaProduktu(id).ostatniaInwentaryzacja||""
  });
  loguj("info","Zapisano kartotekę magazynową produktu "+id);
  toast("Kartoteka magazynowa zapisana ✅");
  renderuj();
}
function oznaczInwentaryzacjeProduktu(id){
  const meta=magazynMetaProduktu(id);
  zapiszMagazynMeta(id,{...meta,ostatniaInwentaryzacja:new Date().toISOString().slice(0,10)});
  zapiszRuchMagazynowy({produktId:id,typ:"inwentaryzacja",ilosc:0,stanPrzed:stanMagazynuId(id),stanPo:stanMagazynuId(id),powod:"Potwierdzono stan w panelu magazynu"});
  toast("Inwentaryzacja produktu oznaczona ✅");
  renderuj();
}
function potwierdzWidoczneStanyMagazynu(ids=[]){
  const data=new Date().toISOString().slice(0,10);let ile=0;
  ids.forEach(id=>{const meta=magazynMetaProduktu(id);zapiszMagazynMeta(id,{...meta,ostatniaInwentaryzacja:data});ile++;});
  zapiszHistorieAgenta("inwentaryzacja",`Potwierdzono widoczne stany magazynowe: ${ile}`,{ids:ids.slice(0,500)});
  toast(`Potwierdzono inwentaryzację ${ile} produktów ✅`);renderuj();
}
function progNiskiProduktu(p){
  const u=ustawieniaMagazynuPelne(), meta=magazynMetaProduktu(p?.id);
  return meta.minStock!=="" && meta.minStock!==undefined ? intNieujemny(meta.minStock,Number(u.progNiski)||5) : Math.max(0,Number(u.progNiski)||5);
}
function targetStockProduktu(p, sprzedaz30=0){
  const u=ustawieniaMagazynuPelne(), meta=magazynMetaProduktu(p?.id), min=progNiskiProduktu(p), lead=leadTimeProduktu(p);
  if(meta.targetStock!=="" && meta.targetStock!==undefined) return Math.max(min,intNieujemny(meta.targetStock,min));
  const srednioDziennie=Math.max(0,Number(sprzedaz30||0)/30);
  const zapasDni=Math.max(7,Number(u.domyslnyZapasDni)||21);
  return Math.max(min+Math.max(3,min), Math.ceil(srednioDziennie*(lead+zapasDni)), min);
}
function leadTimeProduktu(p){
  const u=ustawieniaMagazynuPelne(), meta=magazynMetaProduktu(p?.id);
  return meta.leadTime!=="" && meta.leadTime!==undefined ? intNieujemny(meta.leadTime,Number(u.domyslnyLeadTime)||7) : Math.max(0,Number(u.domyslnyLeadTime)||7);
}
function dostepneSztukiMagazynu(p, rez={}){
  const stan=stanMagazynuId(p?.id);
  return stan===null ? null : stan-Number(rez[p.id]||0);
}
function sugestiaZatowarowania(p, rez={}, sprzedaz={}){
  const stan=stanMagazynuId(p.id), r=Number(rez[p.id]||0), sp=Number(sprzedaz[p.id]||0);
  const dost=stan===null?null:stan-r, min=progNiskiProduktu(p), lead=leadTimeProduktu(p), target=targetStockProduktu(p,sp);
  const avg=Math.max(0,sp/30), dniPokrycia=(dost===null||avg<=0)?null:Math.floor(Math.max(0,dost)/avg);
  const meta=magazynMetaProduktu(p.id);
  let ilosc=0, poziom="ok", powod="Brak braków do aktywnych zamówień.";
  if(stan!==null){
    if(dost<0){
      ilosc=Math.abs(dost);
      poziom="bad";
      powod=dost<0?`Rezerwacje przekraczają stan o ${Math.abs(dost)} szt.`:(stan===0?"Brak stanu magazynowego.":`Dostępne ${dost} szt., próg ${min}.`);
    }else if(r>0){
      powod=`Stan wystarcza na aktywne zamówienia. Po rezerwacjach zostaje ${dost} szt.`;
    }
  }else{
    powod="Produkt bez monitorowanego stanu — nie trafia do planu braków zamówień.";
  }
  return {produkt:p,stan,rezerwacje:r,dostepne:dost,sprzedaz30:sp,min,lead,target,dniPokrycia,ilosc,poziom,powod,meta};
}
function planZatowarowania(){
  const revision=Number(typeof adminRewizjaDanych!=="undefined"?adminRewizjaDanych:0)||0,produktyLista=produktyDoAdministracji(),cached=planZatowarowania._cache;
  if(cached&&cached.revision===revision&&cached.produkty===produktyLista)return cached.value;
  const rez=rezerwacjeMagazynowe(), spr=sprzedazMagazynowa(30);
  const value=produktyLista.filter(p=>!czyProduktAdminWKoszu(p)).map(p=>sugestiaZatowarowania(p,rez,spr)).sort((a,b)=>{
    const pa=a.poziom==="bad"?0:a.poziom==="warn"?1:2, pb=b.poziom==="bad"?0:b.poziom==="warn"?1:2;
    return pa-pb || Number(b.ilosc||0)-Number(a.ilosc||0) || String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl");
  });
  planZatowarowania._cache={revision,produkty:produktyLista,value};return value;
}
function potrzebyZatowarowania(){ return planZatowarowania().filter(x=>Number(x.ilosc)>0); }
