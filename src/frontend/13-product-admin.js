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
