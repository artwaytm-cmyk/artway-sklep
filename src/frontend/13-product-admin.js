/* ── Edycja ceny bezpośrednio w tabeli ── */
let katalogJakoscStan={loading:false,error:"",report:null,filter:"all",query:"",lastAction:null};
function katalogJakoscStatusLabel(status){return status==="critical"?"Wymaga naprawy":status==="warning"?"Do uzupełnienia":"Gotowy";}
function katalogJakoscStatusIcon(status){return status==="critical"?"⛔":status==="warning"?"⚠️":"✅";}
function katalogJakoscPasuje(row){
  if(katalogJakoscStan.filter!=="all"&&row.severity!==katalogJakoscStan.filter)return false;
  const q=normalizujSzukanyTekst(katalogJakoscStan.query||"");if(!q)return true;
  return normalizujSzukanyTekst([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" ")).includes(q);
}
function katalogJakoscUstawFiltr(filter){katalogJakoscStan.filter=filter||"all";renderuj();}
function katalogJakoscSzukaj(input){
  katalogJakoscStan.query=input?.value||"";
  const q=normalizujSzukanyTekst(katalogJakoscStan.query),filter=katalogJakoscStan.filter;
  document.querySelectorAll("[data-quality-row]").forEach(row=>{const matches=(!q||normalizujSzukanyTekst(row.dataset.search||"").includes(q))&&(filter==="all"||row.dataset.status===filter);row.hidden=!matches;});
  const visible=[...document.querySelectorAll("[data-quality-row]")].filter(row=>!row.hidden).length;
  const counter=document.querySelector("[data-quality-visible]");if(counter)counter.textContent=String(visible);
}
async function katalogJakoscPobierz(fixSafe=false){
  if(katalogJakoscStan.loading)return;
  katalogJakoscStan.loading=true;katalogJakoscStan.error="";renderuj();
  try{
    const result=await chmura("catalog-quality-audit",{method:"POST",body:{fixSafe,quarantineOrphans:fixSafe,source:fixSafe?"manual-safe-fix":"manual-audit"},timeout:120000});
    katalogJakoscStan.report=result.report||null;
    katalogJakoscStan.lastAction={fixed:!!fixSafe,changes:(result.changes||[]).length,quarantined:(result.quarantined||[]).length,at:result.updated_at};
    if(fixSafe&&result.saved){
      const pull=await chmura("pull",{timeout:30000});
      if(pull.settings){nalozWspolneUstawienia(pull.settings);zapiszLS("artway_chmura_rev",pull.rev||0);zbudujProdukty();odswiezMenu();}
      toast(`✅ Poprawiono ${result.changes?.length||0} kart; uporządkowano ${result.quarantined?.length||0} osieroconych zapisów`);
    }else toast("Audyt jakości katalogu zakończony ✅");
  }catch(error){katalogJakoscStan.error=error.message||String(error);loguj("blad","Audyt jakości katalogu: "+katalogJakoscStan.error);}
  finally{katalogJakoscStan.loading=false;renderuj();}
}
function katalogJakoscEksportCSV(){
  const report=katalogJakoscStan.report;if(!report?.rows?.length){toast("Najpierw uruchom audyt");return;}
  const rows=[["ID","Nazwa","Ocena","Status","Problemy","EAN","Kod","Producent","Kategoria","Źródło"],...report.rows.map(row=>[row.id,row.name,row.score,katalogJakoscStatusLabel(row.severity),(row.issues||[]).map(x=>x.label).join(" | "),row.ean,row.externalId,row.manufacturer,row.category,row.sourceUrl])];
  pobierzPlik(`audyt-katalogu-${new Date().toISOString().slice(0,10)}.csv`,"\uFEFF"+rows.map(row=>row.map(csvPole).join(";")).join("\n"),"text/csv");
}
function widokAdminJakoscKatalogu(){
  const report=katalogJakoscStan.report,summary=report?.summary||{total:0,ready:0,warning:0,critical:0,averageScore:0,duplicateGroups:0,orphanEdits:0,safeFixes:0};
  if(!report&&!katalogJakoscStan.loading&&!katalogJakoscStan.error)setTimeout(()=>katalogJakoscPobierz(false),0);
  const rows=(report?.rows||[]).filter(katalogJakoscPasuje),action=katalogJakoscStan.lastAction;
  return asortymentSzkielet("jakosc",`<div class="panel catalog-quality-page">
    <header class="catalog-quality-hero"><div><span class="order-pro-label">Stała kontrola danych sprzedażowych</span><h1>🧪 Jakość katalogu</h1><p>Jedna kontrola dla sklepu, Allegro, Google, SEO i Agenta AI. System wykrywa braki, nieprawidłowe identyfikatory, duplikaty, powtarzające się opisy oraz osierocone dane synchronizacji.</p><small>Automatyczny audyt działa codziennie. Bezpieczna korekta porządkuje wyłącznie dane wynikające z istniejących pól — nigdy nie wymyśla ceny, EAN-u ani informacji o produkcie.</small></div><div class="catalog-quality-actions"><button class="btn ghost" onclick="katalogJakoscPobierz(false)" ${katalogJakoscStan.loading?"disabled":""}>↻ Uruchom audyt</button><button class="btn" onclick="katalogJakoscPobierz(true)" ${katalogJakoscStan.loading||!report?"disabled":""}>✨ Zastosuj bezpieczne poprawki</button><button class="btn ghost" onclick="katalogJakoscEksportCSV()" ${report?"":"disabled"}>⇩ Raport CSV</button></div></header>
    ${katalogJakoscStan.loading?`<div class="catalog-quality-progress" role="status"><span class="spinner"></span><div><b>${report?"Aktualizuję kontrolę katalogu…":"Analizuję wszystkie aktywne produkty…"}</b><small>Sprawdzam dane identyfikacyjne, opisy, zdjęcia, źródła, SEO i powiązania.</small></div></div>`:""}
    ${katalogJakoscStan.error?`<div class="form-err" role="alert"><b>Audyt nie został wykonany.</b><br>${esc(katalogJakoscStan.error)} <button class="btn ghost" onclick="katalogJakoscPobierz(false)">Spróbuj ponownie</button></div>`:""}
    ${action?`<div class="catalog-quality-last ${action.fixed?"fixed":""}"><b>${action.fixed?"✅ Zakończono bezpieczne porządkowanie":"✅ Audyt zakończony"}</b><span>${action.fixed?`Zmieniono ${action.changes} kart i odseparowano ${action.quarantined} osieroconych zapisów.`:`Wynik zapisano ${new Date(action.at||Date.now()).toLocaleString("pl-PL")}.`}</span></div>`:""}
    <div class="orders-stat-grid catalog-quality-stats">
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="all"?"active":""}" onclick="katalogJakoscUstawFiltr('all')"><span>📚</span><b>${summary.total}</b><small>aktywnych produktów</small></button>
      <button class="order-stat-card stat-filter ${summary.critical?"hot":""} ${katalogJakoscStan.filter==="critical"?"active":""}" onclick="katalogJakoscUstawFiltr('critical')"><span>⛔</span><b>${summary.critical}</b><small>wymaga naprawy</small></button>
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="warning"?"active":""}" onclick="katalogJakoscUstawFiltr('warning')"><span>⚠️</span><b>${summary.warning}</b><small>do uzupełnienia</small></button>
      <button class="order-stat-card stat-filter money ${katalogJakoscStan.filter==="ready"?"active":""}" onclick="katalogJakoscUstawFiltr('ready')"><span>✅</span><b>${summary.ready}</b><small>gotowych kart</small></button>
      <div class="order-stat-card"><span>🎯</span><b>${summary.averageScore}%</b><small>średnia jakość</small></div>
    </div>
    ${summary.orphanEdits?`<div class="catalog-quality-warning"><div><b>🧹 ${summary.orphanEdits} osierocone ${summary.orphanEdits===1?"dane edycji":"zapisy edycji"}</b><span>Nie są produktami i nie trafią już do sitemap, Google, SEO, monitoringu ani zadań Agenta. „Bezpieczne poprawki” przeniosą ich kopię do prywatnego archiwum audytu i usuną z katalogu roboczego.</span></div></div>`:""}
    ${summary.duplicateGroups?`<div class="catalog-quality-warning"><div><b>🧬 ${summary.duplicateGroups} grup potencjalnych duplikatów</b><span>System niczego nie usuwa automatycznie. Otwórz kartę produktu i zdecyduj, która pozycja ma pozostać.</span></div><a class="btn ghost" href="#/admin/asortyment/produkty" onclick="filtrStatusuProduktow='duplikaty'">Sprawdź duplikaty</a></div>`:""}
    ${report?`<section class="catalog-quality-toolbar"><label><span>Szukaj w raporcie</span><input placeholder="Nazwa, ID, EAN, kod, producent, kategoria lub problem…" value="${esc(katalogJakoscStan.query)}" oninput="katalogJakoscSzukaj(this)" autocomplete="off"></label><span>Widoczne: <b data-quality-visible>${rows.length}</b> z ${summary.total}</span><span>Możliwe bezpieczne poprawki: <b>${summary.safeFixes}</b></span></section>
    <div class="catalog-quality-table-wrap"><table class="log-table catalog-quality-table"><thead><tr><th>Produkt</th><th>Identyfikatory</th><th>Jakość</th><th>Wykryte problemy</th><th>Źródło</th><th>Akcje</th></tr></thead><tbody>${rows.map(row=>`<tr data-quality-row data-status="${esc(row.severity)}" data-search="${esc([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" "))}"><td><div class="catalog-quality-product">${row.image?`<img src="${esc(row.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'📦'}))">`:`<span>📦</span>`}<div><b>${esc(row.name)}</b><small>ID ${esc(row.id)} • ${esc(row.category||"bez kategorii")}</small><em>${esc(row.manufacturer||"producent nieuzupełniony")}</em></div></div></td><td><small>EAN/GTIN</small><b>${esc(row.ean||"—")}</b><small>Kod / EXTERNAL_ID</small><b>${esc(row.externalId||"—")}</b></td><td><div class="catalog-quality-score ${esc(row.severity)}"><b>${row.score}%</b><span>${katalogJakoscStatusIcon(row.severity)} ${katalogJakoscStatusLabel(row.severity)}</span></div></td><td><div class="catalog-quality-issues">${(row.issues||[]).map(issue=>`<span class="${esc(issue.severity)}">${esc(issue.label)}</span>`).join("")||`<span class="ready">Komplet podstawowych danych</span>`}${Object.keys(row.safePatch||{}).length?`<small>✨ Bezpieczna korekta: ${Object.keys(row.safePatch).map(field=>esc(field)).join(", ")}</small>`:""}</div></td><td>${row.sourceUrl?`<a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">Otwórz źródło ↗</a>`:"<span class='muted'>Brak linku</span>"}${row.allegroOfferId?`<a href="https://allegro.pl/oferta/${encodeURIComponent(row.allegroOfferId)}" target="_blank" rel="noopener">Oferta Allegro ↗</a>`:""}</td><td><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(row.id)}">✏️ Uzupełnij</a></td></tr>`).join("")||`<tr><td colspan="6">Brak produktów w wybranym filtrze.</td></tr>`}</tbody></table></div>`:`<div class="backend-note">Raport pojawi się po zakończeniu analizy.</div>`}
    <div class="catalog-quality-rules"><h2>Co system poprawia sam, a czego nie zgaduje</h2><div><article><b>✅ Automatycznie i bezpiecznie</b><p>Porządkuje spacje i linki, uzupełnia zgodne pola EAN/GTIN, usuwa identyczne powtórzenia akapitów, tworzy krótki opis z istniejącego opisu, uzupełnia SEO oraz producenta tylko z jednoznacznego źródła.</p></article><article><b>🔒 Zawsze wymaga faktów</b><p>Cena, kod EAN, zdjęcia, kategoria, parametry, dostępność i brakujący pełny opis nie są wymyślane. Trafiają do raportu oraz zadań Agenta do sprawdzenia w źródle producenta.</p></article></div></div>
  </div>`);
}

function asortymentStanZapisuCeny(input,status="",tekst=""){
  const pole=input?.closest?.(".catalog-product-edit-value");if(!pole)return;
  pole.classList.remove("is-saving","is-saved","has-error");
  if(status)pole.classList.add(status);
  input.setAttribute("aria-busy",status==="is-saving"?"true":"false");
  input.setAttribute("aria-invalid",status==="has-error"?"true":"false");
  const info=pole.querySelector("[data-inline-price-status]");if(info)info.textContent=tekst;
  clearTimeout(input._artwayPriceStateTimer);
  if(status==="is-saved")input._artwayPriceStateTimer=setTimeout(()=>{pole.classList.remove("is-saved");if(info)info.textContent="";},1800);
}
function asortymentPodmienCeneBezRenderu(id,patch={},usun=[]){
  const key=String(id),baza=pobierzProduktAdmin(id)||{},idx=produktyDodane.findIndex(x=>String(x.id)===key);
  const signature=typeof asortymentCentralnySygnatura==="function"?asortymentCentralnySygnatura():"";
  const centralData=asortymentCentralnyStan?.status==="ready"&&asortymentCentralnyStan.signature===signature?asortymentCentralnyStan.data:asortymentCentralnyCache?.get?.(signature)?.data;
  if(idx>=0){
    const next={...produktyDodane[idx],...patch};for(const pole of usun)delete next[pole];
    produktyDodane=[...produktyDodane.slice(0,idx),next,...produktyDodane.slice(idx+1)];
    zapiszLS("artway_produkty_dodane",produktyDodane);
  }else{
    const next={...(produktyEdytowane[key]||{}),...patch};for(const pole of usun)next[pole]=null;
    produktyEdytowane={...produktyEdytowane,[key]:next};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  }
  if(Array.isArray(produkty)){
    const produktIdx=produkty.findIndex(x=>String(x.id)===key);
    if(produktIdx>=0){const next={...produkty[produktIdx],...patch};for(const pole of usun)delete next[pole];produkty[produktIdx]=next;}
  }
  if(typeof uniewaznijProduktyAdminCache==="function")uniewaznijProduktyAdminCache();
  if(centralData&&signature){
    const data={...centralData,items:(centralData.items||[]).map(item=>String(item.id)===key?{...item,...patch,...Object.fromEntries(usun.map(pole=>[pole,null]))}:item)};
    asortymentCentralnyCache.set(signature,{at:Date.now(),data});
    asortymentCentralnyStan={status:"ready",signature,data,error:"",request:null};
  }
  return baza;
}
function ustawCene(id, wartosc, input=null){
  const poprzedni=pobierzProduktAdmin(id)||{},cena=parseFloat(String(wartosc).trim().replace(/\s/g,"").replace(",","."));
  if(!(cena>0)){
    if(input)input.value=String(kwotaNum(poprzedni.cena).toFixed(2)).replace(".",",");
    asortymentStanZapisuCeny(input,"has-error","Podaj cenę większą od 0");toast("⚠️ Nieprawidłowa cena sprzedaży");return false;
  }
  asortymentStanZapisuCeny(input,"is-saving","Zapisuję…");
  const nowa=+cena.toFixed(2),usun=Number(poprzedni.staraCena)>0&&Number(poprzedni.staraCena)<=nowa?["staraCena"]:[];
  asortymentPodmienCeneBezRenderu(id,{cena:nowa},usun);
  if(input)input.value=String(nowa.toFixed(2)).replace(".",",");
  loguj("info",`Zmieniono cenę sprzedaży produktu ${id} → ${zl(nowa)}`);
  asortymentStanZapisuCeny(input,"is-saved","Zapisano");return true;
}
function ustawCeneZakupu(id, wartosc, input=null){
  const poprzedni=pobierzProduktAdmin(id)||{},raw=String(wartosc).trim(),cena=parseFloat(raw.replace(/\s/g,"").replace(",","."));
  const polaFaktury=["cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu"];
  if(raw===""){
    asortymentStanZapisuCeny(input,"is-saving","Usuwam…");
    asortymentPodmienCeneBezRenderu(id,{},["cenaZakupu","cenaZakupuPrywatna","cenaZakupuZrodlo","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt",...polaFaktury]);
    loguj("info",`Usunięto ręczną cenę zakupu produktu ${id}`);asortymentStanZapisuCeny(input,"is-saved","Usunięto");return true;
  }
  if(!Number.isFinite(cena)||cena<0){
    if(input)input.value=poprzedni.cenaZakupu==null?"":String(kwotaNum(poprzedni.cenaZakupu).toFixed(2)).replace(".",",");
    asortymentStanZapisuCeny(input,"has-error","Podaj 0 lub więcej");toast("⚠️ Nieprawidłowa cena zakupu");return false;
  }
  asortymentStanZapisuCeny(input,"is-saving","Zapisuję…");
  const nowa=+cena.toFixed(2);
  asortymentPodmienCeneBezRenderu(id,{cenaZakupu:nowa,cenaZakupuPrywatna:true,cenaZakupuZrodlo:"ręczna edycja administratora",cenaZakupuDopasowanie:"ręcznie",cenaZakupuZaktualizowanoAt:new Date().toISOString()},polaFaktury);
  if(input)input.value=String(nowa.toFixed(2)).replace(".",",");
  loguj("info",`Zmieniono prywatną cenę zakupu produktu ${id} → ${zl(nowa)}`);
  asortymentStanZapisuCeny(input,"is-saved","Zapisano");return true;
}
/* ── Akcje masowe na produktach ── */
let zaznaczoneProdukty = new Set();
let asortymentWynikiIds=[],asortymentStronaIds=[];
function przelaczZaznProd(id){ zaznaczoneProdukty.has(id) ? zaznaczoneProdukty.delete(id) : zaznaczoneProdukty.add(id); asortymentOdswiezStanZaznaczenia(); }
function zaznaczWidoczneProd(chk, ids){
  ids.forEach(id => chk.checked ? zaznaczoneProdukty.add(id) : zaznaczoneProdukty.delete(id));
  asortymentOdswiezStanZaznaczenia();
}
function ustawZaznaczenieProduktow(ids,zaznacz=true){
  for(const raw of Array.isArray(ids)?ids:[]){const id=Number(raw);if(!Number.isFinite(id))continue;zaznacz?zaznaczoneProdukty.add(id):zaznaczoneProdukty.delete(id);}
  asortymentOdswiezStanZaznaczenia();
}
function wyczyscZaznaczenieProduktow(){zaznaczoneProdukty.clear();asortymentOdswiezStanZaznaczenia();}
function asortymentZaznaczZakres(zakres){ustawZaznaczenieProduktow(zakres==="strona"?asortymentStronaIds:asortymentWynikiIds,true);}
function asortymentEksportuj(zakres){
  if(zakres==="zaznaczone")return eksportujProduktyPoIdCSV([...zaznaczoneProdukty],"produkty-zaznaczone.csv");
  eksportujProduktyPoIdCSV(asortymentWynikiIds,"produkty-filtrowane.csv");
}
function usunZaznaczoneProd(){
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!confirm(`Usunąć ${zaznaczoneProdukty.size} zaznaczonych produktów?`)) return;
  for(const id of [...zaznaczoneProdukty]){
    const p = produktyDodane.find(x=>x.id===id);
    if(p){
      if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
      produktyDodane = produktyDodane.filter(x=>x.id!==id);
      oznaczProduktWKoszu(id,"wlasny");
    }else if(!produktyDefinitywne.includes(id)){
      if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
      oznaczProduktWKoszu(id,"bazowy");
    }
  }
  zapiszLS("artway_kosz_dodane", koszDodanych);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  loguj("info",`Masowo usunięto ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); odswiezMenu(); toast("Usunięto zaznaczone 🗑️"); renderuj();
}
function zmienCenyZaznaczonych(){
  const wartosc = parseFloat(String($("procentCen")?.value||"").replace(",","."));
  const tryb=String($("trybCenProduktow")?.value||"percent");
  const kanal=String($("kanalCenProduktow")?.value||"sklep");
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!Number.isFinite(wartosc)||wartosc===0){ toast("⚠️ Podaj wartość zmiany, np. 10 lub -5"); return; }
  if(tryb==="percent"&&wartosc<=-100){ toast("⚠️ Obniżka procentowa musi być większa niż -100%"); return; }
  if(tryb==="fixed"&&wartosc<=0){ toast("⚠️ Cena docelowa musi być większa od zera"); return; }
  for(const id of [...zaznaczoneProdukty]){
    const p = pobierzProduktAdmin(id); if(!p) continue;
    const wylicz=base=>Math.max(0.01, +(tryb==="percent"?kwotaNum(base)*(1+wartosc/100):tryb==="amount"?kwotaNum(base)+wartosc:wartosc).toFixed(2)),patch={};
    if(kanal==="sklep"||kanal==="oba")patch.cena=wylicz(p.cena);
    if(kanal==="allegro"||kanal==="oba")patch.cenaAllegro=wylicz(p.cenaAllegro||p.cena);
    const i = produktyDodane.findIndex(x=>x.id===id);
    if(i>=0){ Object.assign(produktyDodane[i],patch);if(patch.cena&&produktyDodane[i].staraCena&&produktyDodane[i].staraCena<=patch.cena)delete produktyDodane[i].staraCena; }
    else produktyEdytowane = {...produktyEdytowane, [id]:{...(produktyEdytowane[id]||{}),...patch}};
  }
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  const opis=tryb==="percent"?`${wartosc>0?"+":""}${wartosc}%`:tryb==="amount"?`${wartosc>0?"+":""}${zl(wartosc)}`:`na ${zl(wartosc)}`;
  const kanalLabel=kanal==="oba"?"sklepu i Allegro":kanal==="allegro"?"Allegro":"sklepu";
  loguj("info",`Masowa zmiana cen ${kanalLabel} ${opis} dla ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); toast(`Ceny ${kanalLabel} zmienione ${opis} ✅`); renderuj();
}
function usunProduktAdmin(id){
  if(produktyDodane.some(p=>p.id===id)){
    usunProdukt(id);
    return;
  }
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  oznaczProduktWKoszu(id,"bazowy");
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Przeniesiono do kosza na 30 dni produkt bazowy id="+id);
  toast("Produkt w koszu przez 30 dni 🗑️");
  renderuj();
}
function przywrocProdukt(id){
  if(produktyDefinitywne.includes(id)){ toast("Ten produkt został już usunięty definitywnie"); return; }
  produktyUkryte = produktyUkryte.filter(x=>x!==id);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony ↩️"); renderuj();
}
function resetujEdycjeProduktu(id){
  delete produktyEdytowane[id];
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  zbudujProdukty(); odswiezMenu();
  toast("Przywrócono dane z products.json");
  location.hash="#/admin/produkty";
}
function przelaczWidocznosc(id){
  produktyUkryte = produktyUkryte.includes(id) ? produktyUkryte.filter(x=>x!==id) : [...produktyUkryte, id];
  zapiszLS("artway_produkty_ukryte", produktyUkryte); zbudujProdukty();
  toast(produktyUkryte.includes(id)?"Produkt ukryty 🙈":"Produkt widoczny 👁️"); renderuj();
}

/* ── Eksporty (CSV dla Excela, JSON dla hostingu) ── */
function pobierzPlik(nazwa, tresc, typ){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([tresc], {type:(typ||"text/plain")+";charset=utf-8"}));
  a.download = nazwa; a.click(); URL.revokeObjectURL(a.href);
}
function osadzUstawieniaWIndexie(html){
  const bezpieczne=JSON.stringify(ustawienia,null,2).replace(/</g,"\\u003c");
  const blok=`/* PUBLIC_SETTINGS_START */\nconst USTAWIENIA_PUBLICZNE = ${bezpieczne};\n/* PUBLIC_SETTINGS_END */`;
  const wzor=/\/\* PUBLIC_SETTINGS_START \*\/[\s\S]*?\/\* PUBLIC_SETTINGS_END \*\//;
  if(!wzor.test(html))throw new Error("Nie znaleziono znacznika ustawień w index.html");
  return html.replace(wzor,blok);
}
async function eksportujIndexHTML(){
  try{
    const r=await fetch("/index.html",{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);
    const html=osadzUstawieniaWIndexie(await r.text());
    pobierzPlik("index.html",html,"text/html");
    localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    loguj("info","Wyeksportowano index.html z publicznymi ustawieniami panelu");
    toast("Pobrano index.html — wgraj go na hosting ✅");
  }catch(e){loguj("blad","Eksport index.html: "+e.message);toast("⚠️ Nie udało się przygotować index.html");}
}
const csvPole = v => '"' + String(v??"").replace(/"/g,'""') + '"';
function eksportujZamowienia(wybrane=null,nazwa="zamowienia.csv"){
  const z = Array.isArray(wybrane)?wybrane:pobierzZamowienia();
  const csv = [["nr","data","status","klient","produkty_zl","rabat_zl","dostawa_zl","paczka_weekend_zl","platnosc_oplata_zl","razem_zl","dostawa","platnosc","adres","pozycje"].join(";"),
    ...z.map(x=>{const k=kosztyZamowienia(x); return [x.nr,x.data,x.status,x.email||"gość",k.produkty,k.rabat,k.dostawa,k.paczkaWeekend,k.platnosc,k.razem,x.dostawa||"",x.platnosc||"",x.adres||"",(x.pozycje||[]).join(" | ")].map(v=>typeof v==="number"?String(v.toFixed(2)).replace(".",","):v).map(csvPole).join(";");})].join("\n");
  pobierzPlik(nazwa,"﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano zamówienia ("+z.length+")");
}
function eksportujKlientow(wybrani=null,nazwa="klienci.csv"){
  const k = Array.isArray(wybrani)?wybrani:pobierzUzytkownikow();
  const csv = [["imie_nazwisko","email","rola","data_rejestracji"].join(";"),
    ...k.map(x=>[x.imie,x.email,kontoMaRoleAdmin(x.email)?"administrator":"klient",new Date(x.data).toLocaleDateString("pl-PL")].map(csvPole).join(";"))].join("\n");
  pobierzPlik(nazwa,"﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano klientów ("+k.length+")");
}
// InPost „nadanie z pliku": eksport zamówień do CSV/TXT do wgrania w InPost Managerze
// (manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU). Działa dla paczkomatu i kuriera —
// obejście/awaryjne nadawanie do czasu umowy kurierskiej. Format zgodny ze wzorem InPost.
let zaznaczoneNadania = new Set();
function przelaczZaznaczenieNadania(nr){ nr=String(nr); if(zaznaczoneNadania.has(nr)) zaznaczoneNadania.delete(nr); else zaznaczoneNadania.add(nr); renderuj(); }
function zaznaczWszystkieNadania(zazn){ listaWysylekPoFiltrze().forEach(z=>zazn?zaznaczoneNadania.add(String(z.nr)):zaznaczoneNadania.delete(String(z.nr))); renderuj(); }
// czy zamówienie idzie do paczkomatu (InPost)
function paczkomatoweInpost(z){ const id=String(z?.dostawaId||"").toLowerCase(); if(id==="kurier"||id==="kurier_inpost") return false; if(id==="paczkomat") return true; return !!(z?.paczkomat||z?.wysylka?.punktKod); }
// czy zlecenie ma komplet danych do nadania w InPost (żeby import z pliku nie odrzucił)
function gotoweDoNadaniaInpost(z){
  const k=z.klient||{}, a=z.adresDostawy||{};
  if(String(z?.dostawaId||"").toLowerCase()==="odbior") return {ok:false, powod:"odbiór osobisty"};
  const tel=String(k.telefon||z.telefon||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"");
  if(!/@/.test(String(z.email||k.email||""))) return {ok:false, powod:"brak e-mail"};
  if(tel.length<9) return {ok:false, powod:"brak/zły telefon"};
  if(paczkomatoweInpost(z)){ if(!(z.paczkomat||z.wysylka?.punktKod)) return {ok:false, powod:"brak paczkomatu"}; }
  else { if(!a.ulica||!a.nrDomu) return {ok:false, powod:"brak adresu"}; if(!/^\d{2}-\d{3}$/.test(String(a.kod||""))) return {ok:false, powod:"zły kod pocztowy"}; if(!a.miasto) return {ok:false, powod:"brak miasta"}; }
  return {ok:true, paczk:paczkomatoweInpost(z)};
}
function zaznaczGotoweNadania(){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(gotoweDoNadaniaInpost(z).ok){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(n?`Zaznaczono ${n} gotowych do nadania`:"Brak gotowych zleceń w tym filtrze"); renderuj(); }
function zaznaczTypNadania(typ){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(String(z?.dostawaId||"").toLowerCase()==="odbior") return; const p=paczkomatoweInpost(z); if((typ==="paczkomat"&&p)||(typ==="kurier"&&!p)){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(`Zaznaczono ${n} (${typ})`); renderuj(); }
// nry (opcjonalnie) = tablica numerów zamówień do eksportu (pojedyncze zlecenie / zaznaczone). Bez nry: zaznaczone albo cały filtr.
function eksportNadaniaInpostCSV(nry, format="txt"){
  const tryb=String(format||"txt").toLowerCase();
  const rozszerzony=tryb==="extended"||tryb==="rozszerzony";
  const kolumnowy=tryb==="csv"||tryb==="kolumny"||tryb==="columns";
  const tabulator=tryb==="tab"||tryb==="tsv"||tryb==="inpost";
  const sep=tabulator ? "\t" : (kolumnowy ? "," : ";");
  const ext=kolumnowy||rozszerzony ? "csv" : "txt";
  const mime=ext==="csv" ? "text/csv" : "text/plain";
  const czysc = v => String(v==null?"":v).replace(/[\t;\r\n]+/g," ").replace(/\s+/g," ").trim();
  const telCyfry = t => String(t||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"").slice(-9);
  const telInpost = t => { const d=telCyfry(t); return d.length===9 ? "+48"+d : ""; };
  const kwota = v => { const n=Number(String(v??"").replace(",",".").replace(/[^0-9.]/g,"")); return Number.isFinite(n)&&n>0 ? n.toFixed(2) : ""; };
  const rozmiarInpost = z => { const g=String(z?.wysylka?.gabaryt||"").toLowerCase(); return g==="large"?"C":g==="medium"?"B":"A"; };
  const pole = v => {
    const s=czysc(v);
    return kolumnowy ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const jawne = Array.isArray(nry) && nry.length;
  let bazaZ;
  if(jawne){ const zb=new Set(nry.map(String)); bazaZ = pobierzZamowienia().filter(z=>zb.has(String(z.nr))); }
  else if(zaznaczoneNadania.size){ bazaZ = pobierzZamowienia().filter(z=>zaznaczoneNadania.has(String(z.nr))); }
  else { bazaZ = listaWysylekPoFiltrze(); }
  const lista = bazaZ.filter(z=>{
    if(String(z?.dostawaId||"").toLowerCase()==="odbior") return false;
    if(!jawne && ["dostarczona","anulowana","zwrot"].includes(etapWysylki(z))) return false;
    return true;
  }).slice(0,100);
  if(!lista.length){ toast("Brak zamówień do nadania (sprawdź zaznaczenie lub filtr)"); return; }
  const polaPodstawowe=["e-mail","telefon","rozmiar","paczkomat","numer_referencyjny","dodatkowa_ochrona","za_pobraniem","imie_i_nazwisko","nazwa_firmy","ulica","kod_pocztowy","miasto","typ_przesylki","sposob_nadania","punkt_nadania","paczka_w_weekend"];
  const polaRozszerzone=["uwagi","produkty","kwota_zamowienia","metoda_platnosci","sposob_dostawy","gabaryt_sklepu","waga_kg","dlugosc_cm","szerokosc_cm","wysokosc_cm","telefon_9_cyfr"];
  const pola=rozszerzony?[...polaPodstawowe,...polaRozszerzone]:polaPodstawowe;
  const wiersze=lista.map(z=>{
    const k=z.klient||{}, a=z.adresDostawy||{}, w=z.wysylka||{};
    const paczk=paczkomatoweInpost(z);
    const ulica = czysc(`${a.ulica||""} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`.trim());
    const pobranie = kwota(kwotaPobraniaZamowienia(z,w));
    const ochrona = kwota(w.ochrona || "");
    const sposob=inpostSposobNadania(z,w);
    const punktNadania=String(w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
    const produktyTxt = Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
      ? z.pozycjeDane.map(p=>`${p.nazwa||""}${p.sku?` SKU:${p.sku}`:""} x${p.ilosc||1}`).join(" | ")
      : (Array.isArray(z.pozycje)?z.pozycje.join(" | "):"");
    const podstawowe=[
      z.email||k.email,
      telInpost(k.telefon||z.telefon),
      rozmiarInpost(z),
      paczk ? String(z.paczkomat||w.punktKod||"").toUpperCase() : "",
      z.nr,
      ochrona,
      pobranie,
      [k.imie,k.nazwisko].filter(Boolean).join(" "),
      k.firma,
      ulica,
      a.kod,
      a.miasto,
      paczk ? "paczkomat" : "kurier",
      inpostSposobNadaniaLabel(sposob),
      punktNadania,
      (w.paczkaWeekend || z.paczkaWeekend) ? "TAK" : "NIE"
    ];
    const extra=[
      z.uwagi,
      produktyTxt,
      kwota(z.razem),
      z.platnosc,
      z.dostawa,
      w.gabaryt||"small",
      w.waga,
      w.dlugosc,
      w.szerokosc,
      w.wysokosc,
      telCyfry(k.telefon||z.telefon)
    ];
    return (rozszerzony?[...podstawowe,...extra]:podstawowe).map(pole).join(sep);
  });
  const tresc=[pola.map(pole).join(sep),...wiersze].join("\r\n");
  const nazwaTrybu=rozszerzony?"rozszerzony":(tabulator?"naglowki-tabulator":(kolumnowy?"naglowki":tryb));
  pobierzPlik(`inpost-nadania-${nazwaTrybu}-${new Date().toISOString().slice(0,10)}.${ext}`, tresc, mime);
  const npaczk=lista.filter(z=>paczkomatoweInpost(z)).length, nbrak=lista.filter(z=>!gotoweDoNadaniaInpost(z).ok).length;
  loguj("info",`Eksport nadań InPost ${nazwaTrybu}: ${lista.length} przesyłek (${npaczk} paczkomat, ${lista.length-npaczk} kurier)`);
  toast(tabulator
    ? `📄 TXT InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK, separator Tabulator${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
    : (kolumnowy
      ? `📄 CSV InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK i separator przecinek${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
      : `📄 Plik InPost ${nazwaTrybu.toUpperCase()}: ${lista.length} przesyłek — dla TXT ustaw w InPost separator średnik${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`));
}
let podgladImportuProduktow=null, ostatniRaportImportu=null;
const POLA_CSV_PRODUKTU=["id","nazwa","kategoria","cena","cena_allegro","cena_zakupu","prowizja_allegro","prowizja_allegro_procent","oplaty_allegro_cykliczne","koszt_pakowania","koszt_dodatkowy_sklepu","platnosc_sklepu_procent","koszt_dodatkowy_allegro","doplata_wysylki_allegro","reklama_allegro_procent","vat","stara_cena","stan","sku","gtin","external_id","mpn","marka","producent","opis_krotki","opis","badge","ikona","zdjecie","zdjecie2","zdjecie3","zdjecie4","zdjecie5","zdjecie6","zdjecie7","zdjecie8","zdjecie9","zdjecie10","zdjecie11","zdjecie12","zdjecie13","zdjecie14","zdjecie15","zdjecie16","warianty","kolor","kolor_produktu","rozmiar","material"];
const POLA_OVF_PRODUKTU=["GTIN","EXTERNAL_ID","NAME","STOCK","PRICE","MPN","DESCRIPTION","IMAGE1","IMAGE2","IMAGE3","IMAGE4","IMAGE5","IMAGE6","IMAGE7","IMAGE8","IMAGE9","IMAGE10","IMAGE11","IMAGE12","IMAGE13","IMAGE14","IMAGE15","IMAGE16","CATEGORY","BRAND","MANUFACTURER","COLOR","SIZE","MATERIAL"];
function normalizujNaglowekCSV(v){
  return normalizujSzukanyTekst(v).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
function kanonicznePoleProduktu(naglowek){
  const h=normalizujNaglowekCSV(naglowek);
  const aliasy={
    id:["id","product_id","produkt_id","item_id","id_produktu"],
    nazwa:["nazwa","name","product_name","nazwa_produktu","tytul","title","product_title"],
    kategoria:["kategoria","category","katalog","catalog","category_path","categorypath","breadcrumb","category_tree","category_name","categories","sciezka_kategorii"],
    cena:["cena","price","cena_zl","sale_price","gross_price","net_price","price_gross","price_net","retail_price"],
    cenaAllegro:["cena_allegro","allegro_price","price_allegro"],
    cenaZakupu:["cena_zakupu","purchase_price","cost_price","buy_price"],
    allegroCommissionAmount:["prowizja_allegro","allegro_commission","commission_amount"],
    allegroCommissionRate:["prowizja_allegro_procent","allegro_commission_rate","commission_rate"],
    allegroRecurringFees:["oplaty_allegro_cykliczne","allegro_recurring_fees","listing_fees"],
    kosztPakowania:["koszt_pakowania","packaging_cost"],
    sklepAdditionalCost:["koszt_dodatkowy_sklepu","store_additional_cost"],
    sklepPaymentPercent:["platnosc_sklepu_procent","store_payment_percent"],
    allegroAdditionalCost:["koszt_dodatkowy_allegro","allegro_additional_cost"],
    allegroShippingSubsidy:["doplata_wysylki_allegro","allegro_shipping_subsidy"],
    allegroAdsPercent:["reklama_allegro_procent","allegro_ads_percent"],
    vatRate:["vat","vat_rate","stawka_vat"],
    staraCena:["stara_cena","old_price","regular_price","cena_regularna","oldprice","rrp","msrp"],
    stan:["stan","stock","quantity","ilosc","stan_magazynowy","available","availability","qty"],
    sku:["sku","kod","kod_produktu","symbol","seller_sku","item_sku","offer_sku","symbol_produktu"],
    gtin:["gtin","ean","ean13","barcode","kod_ean"],
    externalId:["external_id","externalid","kod_zewnetrzny","supplier_id","vendor_id","ext_id","supplier_sku"],
    mpn:["mpn","manufacturer_part_number","kod_producenta"],
    marka:["brand","marka","brand_name"],
    producent:["producent","manufacturer","manufacturer_name","producer","producer_name"],
    opisKrotki:["opis_krotki","krotki_opis","krótki_opis","short_description","short_desc","description_short","summary","lead"],
    opis:["opis","description","desc","long_description","description_html","full_description"],
    badge:["badge","etykieta","label"],
    ikona:["ikona","icon","emoji"],
    zdjecie:["zdjecie","image","image1","image_1","image_url","url_zdjecia","main_image","image_url_1","photo","photo1","picture","picture1"],
    warianty:["warianty","variants","options"],
    kolor:["kolor","kolor_tla","background","background_color","card_color"],
    kolorProduktu:["color","kolor_produktu","product_color","barwa"],
    rozmiar:["size","rozmiar","wymiar","wymiary","dimensions"],
    material:["material","material_produktu","tworzywo"]
  };
  for(let i=2;i<=16;i++) aliasy["zdjecie"+i]=["zdjecie"+i,"image"+i,"image_"+i,"image"+String(i).padStart(2,"0"),String("image_"+String(i).padStart(2,"0")),"image_url_"+i,"photo"+i,"picture"+i,"url_zdjecia"+i];
  return Object.keys(aliasy).find(k=>aliasy[k].includes(h))||null;
}
function liczbaImportu(v){
  let s=String(v??"").trim().replace(/\s/g,"").replace(/[^\d,.\-]/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else s=s.replace(",",".");
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function wykryjSeparatorCSV(tekst){
  const probka=String(tekst||"").split(/\r?\n/).slice(0,5).join("\n");
  const liczniki={";":0,",":0,"\t":0};let cytat=false;
  for(let i=0;i<probka.length;i++){
    if(probka[i]==='"'&&probka[i+1]==='"'){i++;continue;}
    if(probka[i]==='"'){cytat=!cytat;continue;}
    if(!cytat&&Object.prototype.hasOwnProperty.call(liczniki,probka[i]))liczniki[probka[i]]++;
  }
  return Object.entries(liczniki).sort((a,b)=>b[1]-a[1])[0][0];
}
function parsujCSVProduktow(tekst){
  tekst=String(tekst||"").replace(/^\uFEFF/,"");
  const sep=wykryjSeparatorCSV(tekst),wiersze=[];let wiersz=[],pole="",cytat=false;
  for(let i=0;i<tekst.length;i++){
    const c=tekst[i];
    if(c==='"'&&cytat&&tekst[i+1]==='"'){pole+='"';i++;continue;}
    if(c==='"'){cytat=!cytat;continue;}
    if(c===sep&&!cytat){wiersz.push(pole);pole="";continue;}
    if((c==="\n"||c==="\r")&&!cytat){
      if(c==="\r"&&tekst[i+1]==="\n")i++;
      wiersz.push(pole);pole="";
      if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
      wiersz=[];continue;
    }
    pole+=c;
  }
  wiersz.push(pole);if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
  if(wiersze.length<2)throw new Error("CSV nie zawiera wierszy produktów");
  const naglowki=wiersze.shift().map(kanonicznePoleProduktu);
  if(!naglowki.includes("nazwa")||!naglowki.includes("cena"))throw new Error("CSV musi zawierać co najmniej kolumny: nazwa i cena");
  return wiersze.map(r=>{const o={};naglowki.forEach((k,i)=>{if(k)o[k]=r[i]??"";});return o;});
}
function tablicaWartosci(v){
  if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);
  return String(v||"").split(/\s*[|,]\s*/).map(x=>x.trim()).filter(Boolean);
}
function czyKolorKarty(v){
  const s=String(v||"").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)||/^rgba?\(/i.test(s)||/^hsla?\(/i.test(s);
}
function rozbijSciezkeKategoriiImportu(v){
  const tekst=String(v||"").trim();
  if(!tekst)return {pelna:"",grupa:"",kategoria:"",poziomy:[]};
  const czesci=tekst.split(/\s*(?:\/|\\|>|»|›|\||::)\s*/).map(x=>x.trim()).filter(Boolean);
  if(czesci.length<=1)return {pelna:tekst,grupa:"",kategoria:tekst,poziomy:[tekst]};
  return {pelna:tekst,grupa:czesci.slice(0,-1).join(" / "),kategoria:czesci.at(-1),poziomy:czesci};
}
function normalizujProduktImportu(r,nr){
  const pobierz=(...nazwy)=>{for(const n of nazwy)if(r?.[n]!==undefined&&r[n]!==null)return r[n];return "";};
  const bledy=[],ostrzezenia=[];
  const nazwa=String(pobierz("nazwa","name","product_name")).trim();
  const kategoriaInfo=rozbijSciezkeKategoriiImportu(pobierz("kategoria","category","katalog"));
  const kategoria=kategoriaInfo.kategoria;
  const cena=liczbaImportu(pobierz("cena","price","sale_price"));
  const idRaw=pobierz("id","product_id"),id=idRaw===""||idRaw===null?null:Number(idRaw);
  if(!nazwa)bledy.push("brak nazwy");
  if(!kategoria)bledy.push("brak kategorii");
  if(cena===null||cena<0)bledy.push("cena musi być liczbą 0 lub większą");
  if(cena===0)ostrzezenia.push("cena 0,00 — produkt zostanie zaimportowany, ale będzie zablokowany do sprzedaży do czasu uzupełnienia ceny");
  if(id!==null&&(!Number.isInteger(id)||id<=0))bledy.push("ID musi być dodatnią liczbą całkowitą");
  const stanRaw=pobierz("stan","stock","quantity","ilosc"),stan=stanRaw===""||stanRaw===null?null:liczbaImportu(stanRaw);
  if(stan!==null&&(!Number.isInteger(stan)||stan<0))bledy.push("stan musi być liczbą całkowitą 0 lub większą");
  const stara=liczbaImportu(pobierz("staraCena","stara_cena","old_price","regular_price"));
  if(stara!==null&&cena!==null&&stara<=cena)ostrzezenia.push("stara cena pominięta, bo nie jest wyższa od ceny");
  const galeria=Array.isArray(r?.zdjecia)?r.zdjecia:Array.isArray(r?.images)?r.images:null;
  const zdjecia=galeria?galeria.map(String).filter(Boolean):Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(k=>String(pobierz(k)).trim()).filter(Boolean);
  const p={id,nazwa,kategoria,cena:cena===null?0:+cena.toFixed(2)};
  for(const pole of ["cenaAllegro","cenaZakupu","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){const value=liczbaImportu(pobierz(pole));if(value!==null&&value>=0)p[pole]=+value.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);}
  if(p.cenaZakupu!==undefined)p.cenaZakupuPrywatna=true;
  if(p.allegroShippingSubsidy===undefined)p.allegroShippingSubsidy=ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI;
  if(kategoriaInfo.poziomy.length>1){
    p.sciezkaKategorii=kategoriaInfo.poziomy;
    p.grupaKategorii=kategoriaInfo.grupa;
    p.kategoriaPelna=kategoriaInfo.pelna;
  }
  if(cena===0)p.wymagaCeny=true;else delete p.wymagaCeny;
  const opisKrotki=String(pobierz("opisKrotki","opis_krotki","short_description","summary")).trim();if(opisKrotki)p.opisKrotki=opisKrotki;
  const opis=String(pobierz("opis","description")).trim();if(opis)p.opis=opis;
  const ikona=String(pobierz("ikona","icon","emoji")).trim();if(ikona)p.ikona=ikona;
  const kolor=String(pobierz("kolor")).trim();if(kolor&&czyKolorKarty(kolor))p.kolor=kolor;
  const kolorProduktu=String(pobierz("kolorProduktu")).trim();if(kolorProduktu)p.kolorProduktu=kolorProduktu;
  if(stara!==null&&stara>cena)p.staraCena=+stara.toFixed(2);
  if(stan!==null)p.stan=stan;
  const gtin=String(pobierz("gtin")).trim();if(gtin)p.gtin=gtin;
  const externalId=String(pobierz("externalId")).trim();if(externalId)p.externalId=externalId;
  const mpn=String(pobierz("mpn")).trim();if(mpn)p.mpn=mpn;
  const marka=String(pobierz("marka")).trim();if(marka)p.marka=marka;
  const producent=String(pobierz("producent")).trim()||marka;if(producent)p.producent=producent;
  const rozmiar=String(pobierz("rozmiar")).trim();if(rozmiar)p.rozmiar=rozmiar;
  const material=String(pobierz("material")).trim();if(material)p.material=material;
  const sku=String(pobierz("sku","kod","kod_produktu")).trim()||externalId||mpn||gtin;if(sku)p.sku=sku;
  const badge=String(pobierz("badge","etykieta","label")).trim();if(badge)p.badge=badge;
  const zdjecie=String(pobierz("zdjecie","image","image_url")).trim();if(zdjecie)p.zdjecie=zdjecie;
  if(zdjecia.length)p.zdjecia=zdjecia.slice(0,15);
  const warianty=tablicaWartosci(pobierz("warianty","variants","options"));if(warianty.length)p.warianty=warianty.slice(0,30);
  return {nr,produkt:agentAIPoprawOpisyDanychProduktu(p),bledy,ostrzezenia};
}
function analizujTekstImportu(tekst,nazwa="wklejone dane"){
  try{
    const t=String(tekst||"").trim();if(!t)throw new Error("Brak danych do analizy");
    let surowe,format;
    if(t.startsWith("[")||t.startsWith("{")){
      const j=JSON.parse(t);surowe=Array.isArray(j)?j:(Array.isArray(j.products)?j.products:Array.isArray(j.produkty)?j.produkty:null);format="JSON";
      if(!surowe)throw new Error('JSON musi być tablicą produktów albo obiektem z polem "products"');
    }else{surowe=parsujCSVProduktow(t);format="CSV";}
    if(!surowe.length)throw new Error("Plik nie zawiera produktów");
    if(surowe.length>100000)throw new Error("Jednorazowo można zaimportować maksymalnie 100 000 produktów");
    const wyniki=surowe.map((r,i)=>normalizujProduktImportu(r,i+2));
    const idy=new Map(),sku=new Map(),external=new Map();
    for(const w of wyniki){
      const p=w.produkt;
      if(p.id!==null){if(idy.has(p.id))w.bledy.push(`powtórzone ID ${p.id} (także w wierszu ${idy.get(p.id)})`);else idy.set(p.id,w.nr);}
      if(p.sku){const s=p.sku.toLowerCase();if(sku.has(s))w.bledy.push(`powtórzone SKU ${p.sku} (także w wierszu ${sku.get(s)})`);else sku.set(s,w.nr);}
      if(p.externalId){const s=p.externalId.toLowerCase();if(external.has(s))w.bledy.push(`powtórzone EXTERNAL_ID ${p.externalId} (także w wierszu ${external.get(s)})`);else external.set(s,w.nr);}
    }
    podgladImportuProduktow={
      nazwa,format,wszystkich:wyniki.length,
      produkty:wyniki.filter(w=>!w.bledy.length).map(w=>w.produkt),
      bledy:wyniki.filter(w=>w.bledy.length).map(w=>`Wiersz ${w.nr}: ${w.bledy.join(", ")}`),
      ostrzezenia:wyniki.filter(w=>w.ostrzezenia.length).map(w=>`Wiersz ${w.nr}: ${w.ostrzezenia.join(", ")}`)
    };
    ostatniRaportImportu=null;renderuj();
  }catch(e){
    podgladImportuProduktow={nazwa,format:"—",wszystkich:0,produkty:[],bledy:[e.message],ostrzezenia:[]};
    renderuj();
  }
}
function analizujWklejonyImport(){
  analizujTekstImportu($("importTekstProduktow")?.value||"","wklejone dane");
}
function wczytajPlikImportuProduktow(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>20*1024*1024){toast("⚠️ Maksymalny rozmiar pliku to 20 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>analizujTekstImportu(r.result,plik.name);
  r.onerror=()=>toast("⚠️ Nie udało się odczytać pliku");
  r.readAsText(plik,"UTF-8");
}
function zapiszStanProduktowPoOperacji(){
  zapiszLS("artway_produkty_dodane",produktyDodane);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zapiszLS("artway_ustawienia",ustawienia);
}
function dodajSciezkiKategoriiZImportuDoMenu(lista){
  const importowane=(Array.isArray(lista)?lista:[]).filter(p=>p?.grupaKategorii&&p?.kategoria);
  if(!importowane.length)return 0;
  const grupy=grupyMenuKategorii();let dodane=0;
  const klucz=v=>normalizujSzukanyTekst(v);
  for(const p of importowane){
    const nazwa=String(p.grupaKategorii||"").trim(),kat=String(p.kategoria||"").trim();
    if(!nazwa||!kat)continue;
    let g=grupy.find(x=>klucz(x.nazwa)===klucz(nazwa));
    if(!g){
      g={id:"menu_import_"+prostyHash(nazwa),nazwa,ikona:ikonaKategorii(nazwa),aktywna:true,kategorie:[]};
      grupy.push(g);
    }
    if(!g.kategorie.some(x=>klucz(x)===klucz(kat))){g.kategorie.push(kat);dodane++;}
  }
  if(dodane){
    ustawienia.menuKategorii=grupy.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,ikonaObraz:g.ikonaObraz||"",ikonaAssetId:g.ikonaAssetId||"",aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
    ustawienia.menuPokazNieprzypisane=true;
  }
  return dodane;
}
function wykonajImportProduktow(){
  const d=podgladImportuProduktow;if(!d?.produkty?.length){toast("Najpierw przeanalizuj poprawne dane");return;}
  const tryb=$("trybImportuProduktow")?.value||"scal";
  if(tryb==="zastap"&&!confirm(`Zastąpić obecny katalog ${d.produkty.length} produktami? Przed zmianą zostanie utworzona kopia do cofnięcia.`))return;
  const kopia={data:new Date().toISOString(),produktyDodane,produktyUkryte,produktyEdytowane,produktyDefinitywne,koszDodanych,koszMeta,stanyProduktow,dostepnoscProduktow,ustawienia};
  try{localStorage.setItem("artway_ostatnia_kopia_importu",JSON.stringify(kopia));}catch(e){toast("⚠️ Nie udało się utworzyć kopii przed importem");return;}
  let dodane=0,zaktualizowane=0;const wejscie=d.produkty.map(p=>JSON.parse(JSON.stringify(p)));
  if(tryb==="zastap"){
    const zajete=new Set();let nastepne=Math.max(0,...wejscie.map(p=>Number(p.id)||0),...prodBazowe.map(p=>Number(p.id)||0))+1;
    for(const p of wejscie){if(!p.id||zajete.has(p.id)){while(zajete.has(nastepne))nastepne++;p.id=nastepne++;}zajete.add(p.id);if(!p.ikona)p.ikona="📦";if(!p.kolor)p.kolor="#dbeafe";if(p.opis===undefined)p.opis="";}
    produktyDodane=wejscie;
    produktyUkryte=[...new Set(prodBazowe.map(p=>p.id))];
    produktyEdytowane={};produktyDefinitywne=[...produktyUkryte];koszDodanych=[];koszMeta={};stanyProduktow={};
    wejscie.forEach(p=>{if(Number.isInteger(p.stan)&&p.stan>=0)stanyProduktow[p.id]=p.stan;});
    ustawienia={...ustawienia,mapaProduktow:{}};
    dodane=wejscie.length;
  }else{
    const kluczKodu=v=>String(v||"").trim().toLowerCase();
    const aktywne=produktyDoAdministracji(),poSku=new Map(aktywne.filter(p=>p.sku).map(p=>[kluczKodu(p.sku),p])),poExternal=new Map(aktywne.filter(p=>p.externalId).map(p=>[kluczKodu(p.externalId),p]));
    const zajete=new Set([...aktywne.map(p=>Number(p.id)),...koszDodanych.map(p=>Number(p.id))].filter(id=>Number.isInteger(id)&&id>0));let nastepne=Math.max(0,...prodBazowe.map(p=>Number(p.id)||0),...zajete,...wejscie.map(p=>Number(p.id)||0))+1;
    for(const p0 of wejscie){
      const poExternalId=p0.externalId?poExternal.get(kluczKodu(p0.externalId)):null,poKodzie=p0.sku?poSku.get(kluczKodu(p0.sku)):null,poId=(!p0.externalId&&!p0.sku&&p0.id)?aktywne.find(x=>x.id===p0.id):null,istniejacy=poExternalId||poKodzie||poId;
      if(istniejacy){
        const p={...istniejacy,...p0,id:istniejacy.id};
        const i=produktyDodane.findIndex(x=>x.id===p.id);
        if(i>=0)produktyDodane[i]=p;else produktyEdytowane={...produktyEdytowane,[p.id]:p};
        produktyUkryte=produktyUkryte.filter(id=>id!==p.id);produktyDefinitywne=produktyDefinitywne.filter(id=>id!==p.id);
        koszDodanych=koszDodanych.filter(x=>x.id!==p.id);delete koszMeta[p.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p.id]=p0.stan;
        if(p.sku)poSku.set(kluczKodu(p.sku),p);
        if(p.externalId)poExternal.set(kluczKodu(p.externalId),p);
        zaktualizowane++;
      }else{
        if(!p0.id||zajete.has(p0.id)){while(zajete.has(nastepne))nastepne++;p0.id=nastepne++;}
        if(!p0.ikona)p0.ikona="📦";if(!p0.kolor)p0.kolor="#dbeafe";if(p0.opis===undefined)p0.opis="";
        zajete.add(p0.id);produktyDodane.push(p0);
        koszDodanych=koszDodanych.filter(x=>x.id!==p0.id);delete koszMeta[p0.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p0.id]=p0.stan;
        if(p0.sku)poSku.set(kluczKodu(p0.sku),p0);
        if(p0.externalId)poExternal.set(kluczKodu(p0.externalId),p0);
        aktywne.push(p0);dodane++;
      }
    }
  }
  const menuZImportu=dodajSciezkiKategoriiZImportuDoMenu(wejscie);
  zaznaczoneProdukty.clear();zapiszStanProduktowPoOperacji();zbudujProdukty();odswiezMenu();
  ostatniRaportImportu={dodane,zaktualizowane,pominiete:d.bledy.length,tryb,plik:d.nazwa,menuZImportu};
  podgladImportuProduktow=null;
  loguj("info",`Import produktów: ${dodane} dodanych, ${zaktualizowane} zaktualizowanych, ${d.bledy.length} pominiętych, ${menuZImportu} dopisań do menu`);
  toast(`Import zakończony: +${dodane}, aktualizacje ${zaktualizowane}${menuZImportu?`, menu +${menuZImportu}`:""} ✅`);renderuj();
}
function cofnijOstatniImportProduktow(){
  const k=wczytajLS("artway_ostatnia_kopia_importu",null);
  if(!k){toast("Brak kopii ostatniego importu");return;}
  if(!confirm(`Cofnąć import i przywrócić stan z ${new Date(k.data).toLocaleString("pl-PL")}?`))return;
  produktyDodane=k.produktyDodane||[];produktyUkryte=k.produktyUkryte||[];produktyEdytowane=k.produktyEdytowane||{};
  produktyDefinitywne=k.produktyDefinitywne||[];koszDodanych=k.koszDodanych||[];koszMeta=k.koszMeta||{};stanyProduktow=k.stanyProduktow||{};dostepnoscProduktow=k.dostepnoscProduktow||{};ustawienia=k.ustawienia||ustawienia;
  zapiszStanProduktowPoOperacji();localStorage.removeItem("artway_ostatnia_kopia_importu");
  podgladImportuProduktow=null;ostatniRaportImportu=null;zbudujProdukty();odswiezMenu();
  loguj("info","Cofnięto ostatni import produktów");toast("Przywrócono stan sprzed importu ↩️");renderuj();
}
function produktDoEksportu(p,administracyjny=false){
  const o={id:p.id,nazwa:p.nazwa,kategoria:p.kategoria,cena:+Number(p.cena).toFixed(2)};
  if(p.staraCena>p.cena)o.staraCena=+Number(p.staraCena).toFixed(2);
  const stan=stanProduktu(p);if(stan!==null)o.stan=stan;
  const polaPubliczne=["cenaAllegro","vatRate","sku","gtin","externalId","mpn","marka","producent","opisKrotki","opis","badge","ikona","kolor","kolorProduktu","rozmiar","material","zdjecie"];
  const polaPrywatne=["cenaZakupu","cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuZrodlo","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt","cenaZakupuHistoria","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","allegroFeeCalculatedAt","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent"];
  for(const k of administracyjny?[...polaPubliczne,...polaPrywatne]:polaPubliczne)if(p[k]!==undefined&&p[k]!=="")o[k]=p[k];
  if(p.wymagaCeny)o.wymagaCeny=true;
  if(Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length)o.sciezkaKategorii=p.sciezkaKategorii;
  if(p.grupaKategorii)o.grupaKategorii=p.grupaKategorii;
  if(p.kategoriaPelna)o.kategoriaPelna=p.kategoriaPelna;
  if(p.zdjecia?.length)o.zdjecia=p.zdjecia.slice(0,15);
  if(p.warianty?.length)o.warianty=p.warianty;
  return o;
}
function zakresEksportuProduktow(zakres,administracyjny=false){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  let lista=[...produkty];
  if(zakres==="zaznaczone")lista=lista.filter(p=>zaznaczoneProdukty.has(p.id));
  if(zakres==="kategoria"){const k=$("kategoriaEksportuProduktow")?.value||"";lista=lista.filter(p=>p.kategoria===k);}
  return lista.map(p=>produktDoEksportu(p,administracyjny));
}
function nazwaZakresuEksportu(zakres){
  if(zakres==="zaznaczone")return "zaznaczone";
  if(zakres==="kategoria")return normalizujNaglowekCSV($("kategoriaEksportuProduktow")?.value||"kategoria");
  return "widoczne";
}
function eksportujProduktyJSON(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const nazwa=zakres==="widoczne"?"products.json":`products-${nazwaZakresuEksportu(zakres)}.json`;
  pobierzPlik(nazwa,JSON.stringify(lista,null,2),"application/json");
  if(zakres==="widoczne")localStorage.setItem("artway_produkty_export_hash",prostyHash(JSON.stringify(lista)));
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(zakres==="widoczne"?"Pobrano products.json — wgraj go na hosting ✅":`Wyeksportowano ${lista.length} produktów`);
}
function eksportujProduktyCSV(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres,true);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty.csv":`produkty-${nazwaZakresuEksportu(zakres)}.csv`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);toast(`Wyeksportowano ${lista.length} produktów do CSV`);
}
function eksportujProduktyPoIdCSV(ids,nazwa="produkty-filtrowane.csv"){
  const wybrane=new Set((Array.isArray(ids)?ids:[]).map(String));
  const lista=produktyDoAdministracji().filter(p=>wybrane.has(String(p.id))).map(p=>produktDoEksportu(p,true));
  if(!lista.length){toast("Brak produktów do eksportu");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${lista.length} produktów z aktualnego wyboru`);toast(`Wyeksportowano ${lista.length} produktów ✅`);
}
function wartoscPolaCSVProduktu(p,pole){
  if(pole==="stara_cena")return p.staraCena?String(p.staraCena.toFixed(2)).replace(".",","):"";
  if(pole==="cena")return String(Number(p.cena||0).toFixed(2)).replace(".",",");
  if(pole==="external_id")return p.externalId||"";
  const financial={cena_allegro:"cenaAllegro",cena_zakupu:"cenaZakupu",prowizja_allegro:"allegroCommissionAmount",prowizja_allegro_procent:"allegroCommissionRate",oplaty_allegro_cykliczne:"allegroRecurringFees",koszt_pakowania:"kosztPakowania",koszt_dodatkowy_sklepu:"sklepAdditionalCost",platnosc_sklepu_procent:"sklepPaymentPercent",koszt_dodatkowy_allegro:"allegroAdditionalCost",doplata_wysylki_allegro:"allegroShippingSubsidy",reklama_allegro_procent:"allegroAdsPercent",vat:"vatRate"};
  if(financial[pole])return p[financial[pole]]??"";
  if(pole==="opis_krotki")return p.opisKrotki||opisKrotkiProduktu(p)||"";
  if(pole==="kolor_produktu")return p.kolorProduktu||"";
  if(pole==="warianty")return (p.warianty||[]).join(" | ");
  if(pole==="stan")return p.stan??"";
  if(pole==="zdjecie")return p.zdjecie||"";
  const m=String(pole).match(/^zdjecie(\d+)$/);
  if(m)return (p.zdjecia||[])[Number(m[1])-2]||"";
  return p[pole]??"";
}
function wartoscPolaOVF(p,pole){
  const zdj=[p.zdjecie||"",...(p.zdjecia||[])];
  const kategoriaPelna=Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length?p.sciezkaKategorii.join("/"):p.kategoriaPelna||p.kategoria||"";
  const mapa={
    GTIN:p.gtin||"",
    EXTERNAL_ID:p.externalId||p.sku||String(p.id||""),
    NAME:p.nazwa||"",
    STOCK:p.stan??"",
    PRICE:p.cena!==undefined?String(Number(p.cena||0).toFixed(2)).replace(".",","):"",
    MPN:p.mpn||p.sku||"",
    DESCRIPTION:p.opis||"",
    CATEGORY:kategoriaPelna,
    BRAND:p.marka||"",
    MANUFACTURER:p.producent||p.marka||"",
    COLOR:p.kolorProduktu||"",
    SIZE:p.rozmiar||(p.warianty||[]).join(" | "),
    MATERIAL:p.material||""
  };
  const img=String(pole).match(/^IMAGE(\d+)$/);
  return img ? (zdj[Number(img[1])-1]||"") : (mapa[pole]??"");
}
function eksportujProduktyOVF(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_OVF_PRODUKTU.join(","),...lista.map(p=>POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(","))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty-ovf.xls":`produkty-ovf-${nazwaZakresuEksportu(zakres)}.xls`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(`Wyeksportowano ${lista.length} produktów w formacie OVF`);
}
function pobierzSzablonProduktowCSV(){
  const p={id:1,nazwa:"Przykładowa gra",kategoria:"Gry edukacyjne",cena:99.90,cenaAllegro:109.90,cenaZakupu:55,allegroCommissionAmount:11,allegroCommissionRate:10,allegroRecurringFees:0,kosztPakowania:1.5,sklepAdditionalCost:0,sklepPaymentPercent:1.5,allegroAdditionalCost:0,allegroShippingSubsidy:3,allegroAdsPercent:0,vatRate:23,staraCena:129.90,stan:25,sku:"SKU-001",gtin:"5901234567891",externalId:"EXT-001",mpn:"MPN-001",marka:"Marka",producent:"Producent",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis produktu z najważniejszymi cechami.",badge:"Nowość",ikona:"🎲",zdjecie:"https://adres.pl/zdjecie.jpg",warianty:["S","M","L"],kolor:"#dbeafe",kolorProduktu:"Kolorowy",rozmiar:"XL",material:"Karton"};
  pobierzPlik("szablon-importu-produktow.csv","\uFEFF"+POLA_CSV_PRODUKTU.join(";")+"\n"+POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"),"text/csv");
}
function pobierzSzablonProduktowOVF(){
  const p={id:1,nazwa:"Przykładowa gra edukacyjna",kategoria:"Gry edukacyjne",cena:99.90,stan:25,sku:"GRA-001",externalId:"GRA-001",gtin:"5901234567891",mpn:"GRA-001",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis będzie widoczny na stronie produktu, a na listach pojawi się skrót.",zdjecie:"https://adres.pl/zdjecie1.jpg",zdjecia:["https://adres.pl/zdjecie2.jpg"],marka:"Artway",producent:"Artway",kolorProduktu:"Kolorowy",rozmiar:"30x20x5 cm",material:"Karton"};
  const csv=POLA_OVF_PRODUKTU.join(",")+"\n"+POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(",");
  pobierzPlik("ovf-template-dla-rozszerzonego-pliku-csv-dane.xls","\uFEFF"+csv,"text/csv");
}
