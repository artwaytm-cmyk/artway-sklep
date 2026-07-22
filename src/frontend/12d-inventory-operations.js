/* Rezerwacje, stany i operacje magazynowe */
function statusZamowieniaRezerwujeMagazyn(z){
  const s=String(z?.status||"").toLowerCase();
  return !!z && !["anulowane","cancelled","wysłane","wyslane","sent","zrealizowane","completed","dostarczone","zakończone","zwrot","zwrot pieniędzy"].includes(s);
}
function pozycjeZamowieniaMagazyn(z){
  if(Array.isArray(z?.pozycjeDane)&&z.pozycjeDane.length) return z.pozycjeDane.map(p=>({
    id:p.id, nazwa:p.nazwa||p.produkt||"Produkt", sku:p.sku||"", ilosc:Number(p.ilosc)||1, cena:kwotaNum(p.cena), wartosc:kwotaNum(p.wartosc||kwotaNum(p.cena)*(Number(p.ilosc)||1))
  })).filter(p=>p.id!==undefined&&p.id!==null&&p.id!=="");
  return [];
}
function rezerwacjeSklepuZamowienie(z, ruchy=[]){
  const poProduktach={};
  pozycjeZamowieniaMagazyn(z).forEach(p=>{
    const id=String(p.id??"").trim(),ilosc=Math.max(0,Number(p.ilosc)||0);
    if(id&&ilosc>0) poProduktach[id]=(poProduktach[id]||0)+ilosc;
  });
  const nr=String(z?.nr||"").trim(),requestId=nr?`order-stock:${nr}`:"";
  if(!requestId||String(z?.inventoryMode||z?.inventory_mode||"").toLowerCase()==="reserved_until_shipment") return poProduktach;
  const legacyPoProduktach={};
  (Array.isArray(ruchy)?ruchy:[]).forEach(r=>{
    if(String(r?.sourceRequestId||"").trim()!==requestId) return;
    const id=String(r?.produktId??r?.productId??"").trim(),stanPrzed=Number(r?.stanPrzed);
    if(!id||!Object.prototype.hasOwnProperty.call(poProduktach,id)||r?.stanPrzed===null||r?.stanPrzed===""||!Number.isFinite(stanPrzed)) return;
    const poprzedni=legacyPoProduktach[id];
    legacyPoProduktach[id]=poprzedni===undefined?Math.max(0,stanPrzed):Math.max(poprzedni,stanPrzed);
  });
  Object.entries(legacyPoProduktach).forEach(([id,stanPrzed])=>{
    poProduktach[id]=Math.max(0,Number(poProduktach[id]||0)-stanPrzed);
  });
  return poProduktach;
}
function statusAllegroRezerwujeMagazyn(z){
  return !!z && allegroZamowienieAktywneLokalnie(z);
}
function aktywneZamowieniaAllegro(){
  return (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).filter(statusAllegroRezerwujeMagazyn);
}
function pozycjeAllegroMagazyn(z){
  const items=Array.isArray(z?.lineItems)?z.lineItems:[];
  return items.map(it=>{
    const offerId=String(it.offerId||it.offer?.id||it.id||"").trim();
    const dane=allegroDanePozycjiZamowienia({...it,offerId});
    const ilosc=Math.max(1,Number(it.quantity??it.qty??it.quantityOrdered)||1);
    const dopasowanie=allegroDopasowaniePozycjiDoProduktu({...it,offerId}),mapped=dopasowanie.produkt||null;
    return {
      id:mapped?.id??"",
      offerId,
      externalId:dane.kod,
      ean:dane.ean,
      nazwa:dane.nazwa,
      sku:dane.kod,
      ilosc,
      cena:kwotaNum(it.price?.amount ?? it.price ?? it.unitPrice),
      wartosc:kwotaNum(it.value ?? (kwotaNum(it.price?.amount ?? it.price ?? it.unitPrice)*ilosc)),
      produkt:mapped,
      match:dopasowanie.match,
      confidence:dopasowanie.confidence,
      candidates:dopasowanie.candidates||[]
    };
  });
}
function rezerwacjeMagazynowe(){
  if(rezerwacjeMagazynowe._cache&&Date.now()-rezerwacjeMagazynowe._cache.at<1500)return rezerwacjeMagazynowe._cache.value;
  const mapa={};
  pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).forEach(z=>{
    Object.entries(rezerwacjeSklepuZamowienie(z,ruchyMagazynowe)).forEach(([id,ilosc])=>{mapa[id]=(mapa[id]||0)+Number(ilosc||0);});
  });
  aktywneZamowieniaAllegro().forEach(z=>pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{mapa[p.id]=(mapa[p.id]||0)+p.ilosc;}));
  rezerwacjeMagazynowe._cache={at:Date.now(),value:mapa};
  return mapa;
}
function klasyfikujPozycjeDoKompletacji({produkt=null,stan=null,brak=0,lokalizacja=""}={}){
  if(!produkt)return {decyzja:"nierozpoznany",gotowe:false,brakLokalizacji:false};
  if(stan===null)return {decyzja:"sprawdz_stan",gotowe:false,brakLokalizacji:false};
  if(Number(brak)>0)return {decyzja:"zamow_u_producenta",gotowe:false,brakLokalizacji:false};
  return {decyzja:"kompletuj",gotowe:true,brakLokalizacji:!String(lokalizacja||"").trim()};
}
function allegroAnalizaMagazynowaZamowienia(z){
  const rez=rezerwacjeMagazynowe();
  const pozycje=pozycjeAllegroMagazyn(z).map(p=>{
    const stan=p.produkt?stanMagazynuId(p.produkt.id):null,meta=p.produkt?magazynMetaProduktu(p.produkt.id):{};
    const laczne=p.produkt?Number(rez[p.produkt.id]||0):0,dostepne=stan===null?null:stan-laczne;
    const brak=!p.produkt||stan===null?null:Math.max(0,-dostepne),lokalizacja=String(meta.lokalizacja||"").trim(),dostawca=String(meta.dostawca||"").trim();
    const dokumenty=p.produkt?(agentAIZlecenia||[]).filter(doc=>agentAIPlanDokumentAktywny(doc)&&(doc.pozycje||[]).some(x=>String(x.produktId)===String(p.produkt.id))).map(doc=>({id:doc.id,numer:doc.numer||doc.id,status:doc.status||"szkic"})):[];
    const klasyfikacja=klasyfikujPozycjeDoKompletacji({produkt:p.produkt,stan,brak,lokalizacja});
    return {...p,stan,laczneRezerwacje:laczne,dostepne,brak,lokalizacja,dostawca,dokumentyProducenta:dokumenty,...klasyfikacja};
  });
  const nierozpoznane=pozycje.filter(p=>!p.produkt).length,bezStanu=pozycje.filter(p=>p.produkt&&p.stan===null).length,bezLokalizacji=pozycje.filter(p=>p.brakLokalizacji).length,braki=pozycje.reduce((s,p)=>s+Number(p.brak||0),0);
  return {pozycje,nierozpoznane,bezStanu,bezLokalizacji,braki,locationTasks:bezLokalizacji,gotowe:nierozpoznane===0&&bezStanu===0&&braki===0,fulfillmentReady:nierozpoznane===0&&bezStanu===0&&braki===0};
}
function dataZamowieniaMs(z={}){const raw=z.ts??z.createdAt??z.firstFetchedAt??z.data??z.date??"",n=Number(raw);return Number.isFinite(n)&&n>1e9?(n<1e11?n*1000:n):(Date.parse(raw)||0);}
function sprzedazKanalyMagazynowe(dni=30){
  const key=String(dni),cached=sprzedazKanalyMagazynowe._cache?.[key];if(cached&&Date.now()-cached.at<5000)return cached.value;
  const sklep={},allegro={},razem={},od=Date.now()-dni*86400000;
  pobierzZamowienia().filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&dataZamowieniaMs(z)>=od).forEach(z=>pozycjeZamowieniaMagazyn(z).forEach(p=>{sklep[p.id]=(sklep[p.id]||0)+p.ilosc;}));
  (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).filter(z=>String(z.status||"").toUpperCase()!=="CANCELLED"&&dataZamowieniaMs(z)>=od).forEach(z=>pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{allegro[p.id]=(allegro[p.id]||0)+p.ilosc;}));
  new Set([...Object.keys(sklep),...Object.keys(allegro)]).forEach(id=>{razem[id]=Number(sklep[id]||0)+Number(allegro[id]||0);});
  const value={sklep,allegro,razem,dni};sprzedazKanalyMagazynowe._cache={...(sprzedazKanalyMagazynowe._cache||{}),[key]:{at:Date.now(),value}};return value;
}
function sprzedazMagazynowa(dni=30){return sprzedazKanalyMagazynowe(dni).razem;}
function priorytetDostepnosciProduktu(p={},kanaly=sprzedazKanalyMagazynowe(30),rez=rezerwacjeMagazynowe()){
  const id=String(p.id),sklep=Number(kanaly.sklep[id]||p.sprzedazSklep30||0),allegro=Number(kanaly.allegro[id]||p.sprzedazAllegro30||0),active=Number(rez[id]||p.aktywneZapotrzebowanie||0),score=sklep*4+allegro*5+active*8;
  return {sklep,allegro,razem:sklep+allegro,active,score,channel:allegro>sklep?"Allegro":sklep>allegro?"Sklep":allegro||sklep?"Oba kanały":"Brak sprzedaży",level:score>=40?"krytyczny":score>=15?"wysoki":score>0?"standard":"niski"};
}
function rankingDostepnosciProducentow(lista=produktyMonitorowaneUProducentow()){
  const kanaly=sprzedazKanalyMagazynowe(30),rez=rezerwacjeMagazynowe();return lista.map(p=>({p,priority:priorytetDostepnosciProduktu(p,kanaly,rez),availability:producentDostepnoscInfo(p)})).sort((a,b)=>b.priority.score-a.priority.score||b.availability.ageHours-a.availability.ageHours||String(a.p.nazwa||"").localeCompare(String(b.p.nazwa||""),"pl")).map((x,index)=>({...x,rank:index+1}));
}
function filtrujProduktyMagazynu(lista, rez, sprzedaz){
  const u=ustawieniaMagazynuPelne(), prog=Math.max(0,Number(u.progNiski)||5);
  let out=lista.filter(p=>!czyProduktAdminWKoszu(p));
  if(frazaMagazynu) out=out.filter(p=>{
    const meta=magazynMetaProduktu(p.id);
    const kartoteka=[meta.lokalizacja,nazwaLokalizacjiMagazynu(meta.lokalizacja),meta.dostawca,meta.kod,meta.uwagi].filter(Boolean).join(" ");
    return produktPasujeFrazie(p,frazaMagazynu)||String(p.sku||"").toLowerCase().includes(frazaMagazynu.toLowerCase())||kartoteka.toLowerCase().includes(frazaMagazynu.toLowerCase());
  });
  if(filtrMagazynu==="na-stanie") out=out.filter(p=>Number(stanMagazynuId(p.id)||0)>0);
  if(filtrMagazynu==="monitorowane") out=out.filter(p=>stanMagazynuId(p.id)!==null);
  if(filtrMagazynu==="bezlimitu") out=out.filter(p=>stanMagazynuId(p.id)===null);
  if(filtrMagazynu==="niskie") out=out.filter(p=>{const s=stanMagazynuId(p.id), pr=progNiskiProduktu(p);return s!==null&&s>0&&s<=pr;});
  if(filtrMagazynu==="brak") out=out.filter(p=>stanMagazynuId(p.id)===0);
  if(filtrMagazynu==="rezerwacje") out=out.filter(p=>Number(rez[p.id]||0)>0);
  if(filtrMagazynu==="sprzedaz") out=out.filter(p=>Number(sprzedaz[p.id]||0)>0);
  if(filtrMagazynu==="bestsellery") out=out.filter(p=>priorytetDostepnosciProduktu(p).score>0);
  if(filtrMagazynu==="alerty") out=out.filter(p=>{const i=producentDostepnoscInfo(p),d=dostepneSztukiMagazynu(p,rez),plan=sugestiaZatowarowania(p,rez,sprzedaz);return i.alert||d!==null&&d<0||Number(plan.ilosc||0)>0;});
  if(filtrMagazynu==="dozamowienia") out=out.filter(p=>Number(sugestiaZatowarowania(p,rez,sprzedaz).ilosc)>0);
  if(filtrMagazynu==="nadrezerwacja") out=out.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;});
  if(filtrMagazynu==="producent-niski") out=out.filter(p=>producentDostepnoscInfo(p).status==="niski");
  if(filtrMagazynu==="producent-brak") out=out.filter(p=>producentDostepnoscInfo(p).status==="brak");
  if(filtrMagazynu==="producent-nieznany") out=out.filter(p=>{const i=producentDostepnoscInfo(p);return !i.url||i.stale||["nieznany","blad"].includes(i.status);});
  if(filtrMagazynu==="bezlokalizacji") out=out.filter(p=>!magazynMetaProduktu(p.id).lokalizacja);
  if(filtrMagazynu==="lokalizacje-zamowien") out=out.filter(p=>magazynLokalizacjeZamowienIds.has(String(p.id)));
  if(filtrMagazynu==="bezdostawcy") out=out.filter(p=>!magazynMetaProduktu(p.id).dostawca);
  if(filtrDostawcyMagazynu!=="wszyscy") out=out.filter(p=>String(magazynMetaProduktu(p.id).dostawca||"")===filtrDostawcyMagazynu);
  if(filtrLokalizacjiMagazynu!=="wszystkie") out=out.filter(p=>String(magazynMetaProduktu(p.id).lokalizacja||"BRAK")===filtrLokalizacjiMagazynu);
  if(filtrInwentaryzacjiMagazynu!=="wszystkie") out=out.filter(p=>{const d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja,t=d?Date.parse(d):0,stara=!t||(Date.now()-t)>90*86400000;return filtrInwentaryzacjiMagazynu==="aktualna"?!stara:stara;});
  return sortujProduktyMagazynu(out, rez, sprzedaz, prog);
}
function sortujProduktyMagazynu(lista, rez={}, sprzedaz={}, prog=5){
  const planCache=new Map();
  const plan=p=>{
    const key=String(p.id);
    if(!planCache.has(key)) planCache.set(key,sugestiaZatowarowania(p,rez,sprzedaz));
    return planCache.get(key);
  };
  return [...lista].sort((a,b)=>{
    const sa=stanMagazynuId(a.id), sb=stanMagazynuId(b.id);
    if(sortowanieMagazynu==="nazwa") return String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="stan-malejaco") return (sb===null?-1:sb)-(sa===null?-1:sa)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="lokalizacja") return String(magazynMetaProduktu(a.id).lokalizacja||"ZZZ").localeCompare(String(magazynMetaProduktu(b.id).lokalizacja||"ZZZ"),"pl",{numeric:true,sensitivity:"base"})||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="inwentaryzacja") return (Date.parse(magazynMetaProduktu(a.id).ostatniaInwentaryzacja||0)||0)-(Date.parse(magazynMetaProduktu(b.id).ostatniaInwentaryzacja||0)||0);
    if(sortowanieMagazynu==="stan") return (sa===null?Number.MAX_SAFE_INTEGER:sa)-(sb===null?Number.MAX_SAFE_INTEGER:sb);
    if(sortowanieMagazynu==="rezerwacje") return Number(rez[b.id]||0)-Number(rez[a.id]||0);
    if(sortowanieMagazynu==="sprzedaz") return Number(sprzedaz[b.id]||0)-Number(sprzedaz[a.id]||0);
    if(sortowanieMagazynu==="priorytet") return priorytetDostepnosciProduktu(b).score-priorytetDostepnosciProduktu(a).score||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="wartosc") return ((sb||0)*kwotaNum(b.cena))-((sa||0)*kwotaNum(a.cena));
    if(sortowanieMagazynu==="dostepne") return (dostepneSztukiMagazynu(a,rez)??Number.MAX_SAFE_INTEGER)-(dostepneSztukiMagazynu(b,rez)??Number.MAX_SAFE_INTEGER);
    if(sortowanieMagazynu==="zakup") return Number(plan(b).ilosc||0)-Number(plan(a).ilosc||0);
    if(sortowanieMagazynu==="producent"){const rank={brak:0,niski:1,nieznany:2,blad:2,dostepny_nieznany:3,dostepny:4},ia=producentDostepnoscInfo(a),ib=producentDostepnoscInfo(b);return (rank[ia.status]??5)-(rank[ib.status]??5)||(ia.quantity??Number.MAX_SAFE_INTEGER)-(ib.quantity??Number.MAX_SAFE_INTEGER)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");}
    const supplierRank={brak:0,niski:1,nieznany:2,blad:2,dostepny_nieznany:3,dostepny:4},ia=producentDostepnoscInfo(a),ib=producentDostepnoscInfo(b),supplierDiff=(supplierRank[ia.status]??5)-(supplierRank[ib.status]??5);
    if(supplierDiff)return supplierDiff;
    const planDiff=Number(plan(b).ilosc||0)-Number(plan(a).ilosc||0);if(planDiff)return planDiff;
    const priorityDiff=priorytetDostepnosciProduktu(b).score-priorytetDostepnosciProduktu(a).score;if(priorityDiff)return priorityDiff;
    const ra=sa===null?999999:(sa===0?0:(sa<=prog?sa:100000+sa));
    const rb=sb===null?999999:(sb===0?0:(sb<=prog?sb:100000+sb));
    return ra-rb || String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
  });
}
function stanBadgeMagazynu(stan, prog){
  if(stan===null) return `<span class="lvl lvl-info">bez limitu</span>`;
  if(stan===0) return `<span class="lvl lvl-blad">brak</span>`;
  if(stan<=prog) return `<span class="lvl lvl-ostrzezenie">niski</span>`;
  return `<span class="lvl lvl-ok">OK</span>`;
}
function ustawFiltrMagazynu(filtr, sort="stan-malejaco"){
  frazaMagazynu="";
  filtrMagazynu=filtr||"wszystkie";
  sortowanieMagazynu=sort||"stan-malejaco";
  stronaMagazynu=1;
  renderuj();
}
function wyczyscFiltryStanowMagazynu(){
  frazaMagazynu="";filtrMagazynu="na-stanie";filtrDostawcyMagazynu="wszyscy";filtrLokalizacjiMagazynu="wszystkie";filtrInwentaryzacjiMagazynu="wszystkie";sortowanieMagazynu="stan-malejaco";stronaMagazynu=1;renderuj();
}
function ustawStroneMagazynu(n){ stronaMagazynu=Math.max(1,Number(n)||1); renderuj(); }
function ustawMagazynNaStronie(n){
  magazynNaStronie=[25,50,100,200,500].includes(Number(n))?Number(n):50;
  stronaMagazynu=1; zapiszLS("artway_magazyn_na_stronie",magazynNaStronie); renderuj();
}
function korygujStanMagazynu(e,id){
  e.preventDefault();
  const f=new FormData(e.target), stan=String(f.get("stan")??"").trim(), powod=String(f.get("powod")||"").trim()||"Korekta z panelu magazynu";
  const wynik=ustawStanMagazynowy(id, stan, {typ:"korekta",powod});
  loguj("info",`Magazyn: korekta ${id}, ${wynik.przed===null?"∞":wynik.przed} → ${wynik.po===null?"∞":wynik.po}`);
  toast("Korekta magazynu zapisana ✅"); renderuj();
}
function szybkaKorektaMagazynu(id, delta){
  const przed=stanMagazynuId(id);
  if(przed===null){ toast("Najpierw wpisz konkretny stan — produkt jest bez limitu"); return; }
  ustawStanMagazynowy(id, Math.max(0,przed+Number(delta||0)), {typ:Number(delta)>0?"przyjęcie":"korekta",powod:Number(delta)>0?"Szybkie przyjęcie":"Szybkie zmniejszenie"});
  toast(`Stan zmieniony: ${przed} → ${Math.max(0,przed+Number(delta||0))}`);renderuj();
}
function zapiszUstawieniaMagazynu(e){
  e.preventDefault();
  const f=new FormData(e.target);
  ustawieniaMagazynu={
    ...ustawieniaMagazynu,
    nazwa:String(f.get("nazwa")||"Magazyn główny").trim()||"Magazyn główny",
    progNiski:Math.max(0,parseInt(f.get("progNiski"),10)||5),
    lokalizacja:String(f.get("lokalizacja")||"").trim(),
    domyslnyOperator:String(f.get("operator")||sesja?.email||"administrator").trim(),
    domyslnyDostawca:String(f.get("domyslnyDostawca")||"").trim(),
    domyslnyLeadTime:Math.max(0,parseInt(f.get("domyslnyLeadTime"),10)||7),
    domyslnyZapasDni:Math.max(7,parseInt(f.get("domyslnyZapasDni"),10)||21),
    progNiskiProducenta:Math.max(1,parseInt(f.get("progNiskiProducenta"),10)||50),
    producentProbka:Math.max(1,Math.min(25,parseInt(f.get("producentProbka"),10)||8)),
    producentMaxWiekGodz:Math.max(1,parseInt(f.get("producentMaxWiekGodz"),10)||48)
  };
  zapiszLS("artway_magazyn_ustawienia",ustawieniaMagazynu);
  if(chmuraToken)void chmuraZapiszUstawienia();
  loguj("info","Zapisano ustawienia magazynu");
  toast("Ustawienia magazynu zapisane ✅"); renderuj();
}
function magazynUstawZaznaczenie(zakres,zaznacz=true){
  const ids=zakres==="strona"?magazynStronaIds:zakres==="filtr"?magazynWynikiIds:Array.isArray(zakres)?zakres:[];
  ids.forEach(id=>zaznacz?zaznaczoneMagazynProdukty.add(String(id)):zaznaczoneMagazynProdukty.delete(String(id)));renderuj();
}
function magazynWyczyscZaznaczenie(){zaznaczoneMagazynProdukty.clear();renderuj();}
function eksportujMagazynCSV(ids=null,nazwa="magazyn-artway.csv"){
  const rez=rezerwacjeMagazynowe(), spr=sprzedazMagazynowa(30);
  const wybrane=Array.isArray(ids)?new Set(ids.map(String)):null;
  const rows=[["id","sku","nazwa","kategoria","producent","url_zrodlowy","status_u_producenta","stan_u_producenta","stan_producenta_dokladny","sprawdzono_u_producenta","stan_lokalny","bez_limitu","dostepne_po_rezerwacjach","zarezerwowane","sprzedaz_30_dni","min_stock","target_stock","lead_time_dni","lokalizacja","dostawca","kod","sugerowany_zakup","cena_brutto","wartosc_stanu"].join(";")];
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&(!wybrane||wybrane.has(String(p.id)))).forEach(p=>{
    const stan=stanMagazynuId(p.id), plan=sugestiaZatowarowania(p,rez,spr), meta=magazynMetaProduktu(p.id), wart=stan===null?"":kwotaNum(stan*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    const prod=producentDostepnoscInfo(p);rows.push([p.id,p.sku||"",p.nazwa,p.kategoria,p.producent||p.marka||"",prod.url,prod.status,prod.quantity??"",prod.exact?"tak":"nie",prod.checked,stan===null?"":stan,stan===null?"tak":"nie",plan.dostepne===null?"":plan.dostepne,rez[p.id]||0,spr[p.id]||0,plan.min,plan.target,plan.lead,meta.lokalizacja||"",meta.dostawca||"",meta.kod||"",plan.ilosc||0,kwotaNum(p.cena).toFixed(2).replace(".",","),wart].map(csvPole).join(";"));
  });
  if(rows.length===1){toast("Brak produktów do eksportu");return;}
  pobierzPlik(nazwa,"\uFEFF"+rows.join("\n"),"text/csv");
  loguj("info",`Wyeksportowano magazyn CSV (${rows.length-1} produktów)`);toast(`Wyeksportowano ${rows.length-1} produktów magazynowych ✅`);
}
function eksportujFizyczneStanyMagazynu(ids=null,nazwa="fizyczne-stany-magazynowe.csv"){
  const rez=rezerwacjeMagazynowe(),wybrane=Array.isArray(ids)?new Set(ids.map(String)):null;
  const rows=[["id","sku","ean","produkt","kategoria","lokalizacja","stan_fizyczny","zarezerwowane","wolne","cena_brutto","wartosc_stanu","ostatnia_inwentaryzacja","ostatnia_korekta"].join(";")];
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&(!wybrane||wybrane.has(String(p.id)))).forEach(p=>{
    const stan=stanMagazynuId(p.id);if(stan===null)return;
    const meta=magazynMetaProduktu(p.id),r=Number(rez[String(p.id)]||0),wolne=stan-r,wartosc=kwotaNum(stan*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    rows.push([p.id,p.sku||"",p.gtin||p.ean||meta.kod||"",p.nazwa||"",p.kategoria||"",meta.lokalizacja||"",stan,r,wolne,kwotaNum(p.cena).toFixed(2).replace(".",","),wartosc,meta.ostatniaInwentaryzacja||"",meta.ostatniaKorekta||""].map(csvPole).join(";"));
  });
  if(rows.length===1){toast("Brak fizycznych stanów do eksportu");return;}
  pobierzPlik(nazwa,"\uFEFF"+rows.join("\n"),"text/csv");
  loguj("info",`Wyeksportowano fizyczne stany CSV (${rows.length-1} produktów)`);toast(`Wyeksportowano ${rows.length-1} fizycznych stanów ✅`);
}
function magazynEksportuj(zakres){
  const ids=zakres==="zaznaczone"?[...zaznaczoneMagazynProdukty]:magazynWynikiIds;
  eksportujFizyczneStanyMagazynu(ids,zakres==="zaznaczone"?"stany-fizyczne-zaznaczone.csv":"stany-fizyczne-filtrowane.csv");
}
function ruchMagazynuPasujeDoTypu(r={}){
  const qty=Number(r.ilosc||0),typ=String(r.typ||"").toLowerCase();
  if(filtrRuchowMagazynu==="przyjecia"&&qty<=0)return false;
  if(filtrRuchowMagazynu==="rozchody"&&qty>=0)return false;
  if(filtrRuchowMagazynu==="korekty"&&!typ.includes("korekt"))return false;
  if(filtrRuchowMagazynu==="dokumenty"&&!String(r.dokument||"").trim())return false;
  return true;
}
function ruchMagazynuTekst(r={}){return `${r.produktNazwa||""} ${r.sku||""} ${r.produktId||""} ${r.typ||""} ${r.powod||""} ${r.dokument||""}`.toLowerCase();}
function ruchMagazynuPasujeDoFiltra(r={}){
  if(!ruchMagazynuPasujeDoTypu(r))return false;
  const q=String(szukajRuchowMagazynu||"").trim().toLowerCase();
  return !q||ruchMagazynuTekst(r).includes(q);
}
function magazynSzukajRuchy(input){
  szukajRuchowMagazynu=String(input?.value||"");const q=szukajRuchowMagazynu.trim().toLowerCase();let widoczne=0;
  document.querySelectorAll("[data-warehouse-movement]").forEach(row=>{const show=!q||String(row.dataset.search||"").includes(q);row.hidden=!show;if(show)widoczne++;});
  const count=document.querySelector("[data-warehouse-movement-count]");if(count)count.textContent=String(widoczne);
}
function magazynEksportujRuchyCSV(){
  const rows=(ruchyMagazynowe||[]).filter(ruchMagazynuPasujeDoFiltra),header=["data","typ","produkt","sku_lub_id","ilosc","stan_przed","stan_po","dokument","powod"];
  adminEksportujCSV(`ruchy-magazynowe-${new Date().toISOString().slice(0,10)}.csv`,header,rows.map(r=>[r.dataTxt||r.data||"",r.typ||"",r.produktNazwa||"",r.sku||r.produktId||"",r.ilosc??"",r.stanPrzed??"",r.stanPo??"",r.dokument||"",r.powod||""]));
}
function eksportujZatowarowanieCSV(){
  const plan=potrzebyZatowarowania();
  const rows=[["id","sku","nazwa","kategoria","dostawca","lokalizacja","stan","dostepne_po_rezerwacjach","sprzedaz_30_dni","min_stock","target_stock","lead_time_dni","sugerowana_ilosc","cena_brutto","szacowana_wartosc"].join(";")];
  plan.forEach(x=>{
    const p=x.produkt, meta=x.meta, wart=kwotaNum((x.ilosc||0)*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    rows.push([p.id,p.sku||"",p.nazwa,p.kategoria,meta.dostawca||"",meta.lokalizacja||"",x.stan===null?"":x.stan,x.dostepne===null?"":x.dostepne,x.sprzedaz30,x.min,x.target,x.lead,x.ilosc,kwotaNum(p.cena).toFixed(2).replace(".",","),wart].map(csvPole).join(";"));
  });
  pobierzPlik("zatowarowanie-artway.csv","\uFEFF"+rows.join("\n"),"text/csv");
  zapiszHistorieAgenta("zatowarowanie","Wyeksportowano plan zatowarowania",{pozycji:plan.length});
  loguj("info","Wyeksportowano plan zatowarowania CSV");
}
function wypelnijDomyslnaKartotekeMagazynu(){
  const u=ustawieniaMagazynuPelne();
  if(!u.domyslnyDostawca&&!u.lokalizacja){ toast("Najpierw wpisz domyślnego dostawcę lub lokalizację w ustawieniach magazynu"); return; }
  if(!confirm("Uzupełnić brakujące pola kartoteki domyślnym dostawcą/lokalizacją? Istniejących wartości nie nadpiszę.")) return;
  let ile=0;
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    const m=magazynMetaProduktu(p.id);
    if((u.domyslnyDostawca&&!m.dostawca)||(u.lokalizacja&&!m.lokalizacja)){
      zapiszMagazynMeta(p.id,{...m,dostawca:m.dostawca||u.domyslnyDostawca,lokalizacja:m.lokalizacja||u.lokalizacja});
      ile++;
    }
  });
  zapiszHistorieAgenta("kartoteka",`Uzupełniono domyślne dane kartoteki dla ${ile} produktów`,{produkty:ile});
  toast(`Uzupełniono kartotekę: ${ile} produktów ✅`);
  renderuj();
}
function audytMagazynuAI(){
  const plan=potrzebyZatowarowania(), rez=rezerwacjeMagazynowe(), wszystkie=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const brakLok=wszystkie.filter(p=>!magazynMetaProduktu(p.id).lokalizacja).length;
  const brakDos=wszystkie.filter(p=>!magazynMetaProduktu(p.id).dostawca).length;
  const nad=wszystkie.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;}).length;
  const rec=zapiszHistorieAgenta("audyt","Utworzono audyt magazynu",{produkty:wszystkie.length,doZamowienia:plan.length,brakLokalizacji:brakLok,brakDostawcy:brakDos,nadrezerwacje:nad});
  pobierzPlik("audyt-magazynu-agent-ai.json",JSON.stringify(rec,null,2),"application/json");
  toast("Audyt magazynu zapisany i pobrany ✅");
  renderuj();
}
