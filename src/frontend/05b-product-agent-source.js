function zapiszHistorieAgenta(typ, opis, dane={}){
  const rec={id:"AI-"+Date.now().toString(36),typ,opis,data:new Date().toISOString(),dataTxt:new Date().toLocaleString("pl-PL"),operator:sesja?.email||"administrator",dane};
  agentAIHistoria=[rec,...(Array.isArray(agentAIHistoria)?agentAIHistoria:[])].slice(0,500);
  zapiszLS("artway_agent_ai_historia",agentAIHistoria);
  return rec;
}
function normalizujUrlProducenta(url=""){
  try{
    const raw=String(url||"").trim().replace(/https\/\//gi,"https://").replace(/http\/\//gi,"http://");
    const starts=[...raw.matchAll(/https?:\/\//gi)].map(m=>m.index),candidate=starts.length>1?raw.slice(starts[starts.length-1]):raw;
    const u=new URL(candidate);
    ["query_id","utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach(k=>u.searchParams.delete(k));
    u.hash="";
    return u.toString();
  }catch(e){ return String(url||"").trim(); }
}
function brakiDanychProducenta(p={}, dane={}){
  const b=[];
  if(!p.nazwa)b.push("nazwa");
  if(!p.cena)b.push("cena");
  if(!(p.gtin||p.ean))b.push("EAN");
  if(!(p.mpn||p.kodProducenta||p.externalId))b.push("kod producenta/MPN");
  if(!poprawnaNazwaProducenta(p.producent||p.marka))b.push("producent");
  if(!p.zdjecie)b.push("zdjęcie");
  if(!p.opisKrotki)b.push("krótki opis");
  if(!p.opis)b.push("opis");
  if(!p.dostepnoscProducenta||p.dostepnoscProducenta==="do sprawdzenia")b.push("dostępność");
  (Array.isArray(dane.missing)?dane.missing:[]).forEach(x=>{if(x&&!b.includes(x))b.push(x);});
  return b;
}
function agentAIKluczProduktu(v=""){
  return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function agentAITokenyProduktu(v=""){
  return new Set(agentAIKluczProduktu(v).split(/\s+/).filter(x=>x.length>2&&!['oraz','dla','zestaw','produkt','sztuki','sztuka'].includes(x)));
}
function agentAIPodobienstwoProduktu(a="",b=""){
  const aa=agentAITokenyProduktu(a),bb=agentAITokenyProduktu(b);if(!aa.size||!bb.size)return 0;
  const wsp=[...aa].filter(x=>bb.has(x)).length,union=new Set([...aa,...bb]).size;
  return union?wsp/union:0;
}
function agentAIDuplikatyProduktu(p={}){
  const kod=(v)=>agentAIKluczProduktu(v),ean=kod(p.gtin||p.ean),external=kod(p.externalId||p.sku),mpn=kod(p.mpn||p.kodProducenta),url=normalizujUrlProducenta(p.sourceUrl||p.producentUrl||""),name=kod(p.nazwa||p.name);
  return produktyDoAdministracji().filter(x=>!czyProduktAdminWKoszu(x)&&String(x.id)!==String(p.id??"")).map(x=>{
    const reasons=[];let score=0,blocking=false;
    const xEan=kod(x.gtin||x.ean),xExternal=kod(x.externalId||x.sku),xMpn=kod(x.mpn||x.kodProducenta),xUrl=normalizujUrlProducenta(x.sourceUrl||x.producentUrl||""),xName=kod(x.nazwa||x.name);
    if(ean&&xEan===ean){reasons.push("ten sam EAN");score=100;blocking=true;}
    if(url&&xUrl&&xUrl===url){reasons.push("ten sam link producenta");score=Math.max(score,100);blocking=true;}
    if(external&&external.length>=3&&xExternal===external){reasons.push("ten sam EXTERNAL_ID/SKU");score=Math.max(score,98);blocking=true;}
    if(mpn&&mpn.length>=3&&xMpn===mpn){reasons.push("ten sam kod producenta");score=Math.max(score,96);blocking=true;}
    const similarity=agentAIPodobienstwoProduktu(name,xName);
    if(name&&xName===name){reasons.push("identyczna nazwa");score=Math.max(score,90);}
    else if(similarity>=.72){reasons.push(`bardzo podobna nazwa ${Math.round(similarity*100)}%`);score=Math.max(score,Math.round(70+similarity*20));}
    return reasons.length?{product:x,score,reasons,blocking,similarity}:null;
  }).filter(Boolean).sort((a,b)=>Number(b.blocking)-Number(a.blocking)||b.score-a.score).slice(0,8);
}
function agentAIDobierzKategorieProduktu(p={}){
  const categories=wszystkieKategorie().filter(Boolean),raw=String(p.kategoria||"").trim(),rawKey=agentAIKluczProduktu(raw);
  const exact=categories.find(x=>agentAIKluczProduktu(x)===rawKey);
  if(exact)return {name:exact,confidence:100,reason:"kategoria producenta istnieje w sklepie"};
  const near=rawKey&&categories.find(x=>agentAIKluczProduktu(x).includes(rawKey)||rawKey.includes(agentAIKluczProduktu(x)));
  if(near)return {name:near,confidence:90,reason:"dopasowano kategorię producenta do katalogu"};
  const name=String(p.nazwa||p.name||""),producer=agentAIKluczProduktu(p.producent||p.marka),scores=new Map();
  for(const x of produktyDoAdministracji().filter(x=>!czyProduktAdminWKoszu(x)&&x.kategoria)){
    let score=agentAIPodobienstwoProduktu(name,x.nazwa||x.name||"");
    if(producer&&producer===agentAIKluczProduktu(x.producent||x.marka))score+=.08;
    if(score<.22)continue;
    const current=scores.get(x.kategoria)||{name:x.kategoria,score:0,count:0,example:x.nazwa||""};current.score=Math.max(current.score,score);current.count++;scores.set(x.kategoria,current);
  }
  const best=[...scores.values()].sort((a,b)=>(b.score+Math.min(.12,b.count*.02))-(a.score+Math.min(.12,a.count*.02)))[0];
  if(best&&(best.score+Math.min(.12,best.count*.02))>=.38)return {name:best.name,confidence:Math.min(89,Math.round((best.score+Math.min(.12,best.count*.02))*100)),reason:`podobny produkt: ${best.example}`};
  return {name:raw||"",confidence:raw?55:0,reason:raw?"kategoria ze strony wymaga sprawdzenia":"brak pewnego dopasowania kategorii"};
}
function agentAIOcenaDodaniaProduktu(p={},d={}){
  const category=agentAIDobierzKategorieProduktu(p),product={...p,kategoria:category.name||p.kategoria||""},duplicates=agentAIDuplikatyProduktu(product),blockingDuplicate=duplicates.find(x=>x.blocking),blockers=[],warnings=[];
  if(!String(product.nazwa||"").trim())blockers.push("brak nazwy");
  if(!(Number(product.cena)>0))blockers.push("brak poprawnej ceny");
  if(!String(product.kategoria||"").trim())blockers.push("brak kategorii sklepu");
  if(d.needsChoice)blockers.push("najpierw wybierz właściwy produkt");
  if(blockingDuplicate)blockers.push(`duplikat produktu #${blockingDuplicate.product.id}`);
  if(!(product.gtin||product.ean))warnings.push("brak EAN");
  if(!(product.mpn||product.kodProducenta||product.externalId))warnings.push("brak kodu producenta");
  if(!poprawnaNazwaProducenta(product.producent||product.marka))blockers.push("brak prawidłowej nazwy producenta");
  if(!product.zdjecie)warnings.push("brak zdjęcia głównego");
  if(String(product.opisKrotki||"").length<40)warnings.push("krótki opis wymaga rozwinięcia");
  if(String(product.opis||"").length<150)warnings.push("pełny opis jest zbyt krótki");
  const dataScore=Math.max(0,Math.min(100,Math.round((product.nazwa?15:0)+(Number(product.cena)>0?15:0)+(product.kategoria?10:0)+((product.gtin||product.ean)?15:0)+((product.mpn||product.kodProducenta||product.externalId)?10:0)+(product.zdjecie?10:0)+(String(product.opisKrotki||"").length>=40?10:0)+(String(product.opis||"").length>=150?10:0)+(poprawnaNazwaProducenta(product.producent||product.marka)?5:0))));
  const score=d.needsChoice?Math.min(dataScore,45):blockingDuplicate?Math.min(dataScore,75):blockers.length?Math.min(dataScore,65):dataScore;
  return {product,category,duplicates,blockingDuplicate,blockers,warnings,dataScore,score,ready:!blockers.length};
}
function agentAIProduktZFormularzaDoOceny(form,fallback={}){
  if(!form)return fallback;const v=(name)=>String(form.elements[name]?.value||"").trim(),n=(name)=>Number(v(name).replace(",","."))||0;
  return {...fallback,nazwa:v("nazwa")||fallback.nazwa,kategoria:v("kategoria")||fallback.kategoria,cena:n("cena")||fallback.cena,gtin:v("gtin")||fallback.gtin||fallback.ean,ean:v("gtin")||fallback.ean||fallback.gtin,externalId:v("externalId")||fallback.externalId,sku:v("sku")||fallback.sku,mpn:v("mpn")||fallback.mpn||fallback.kodProducenta,kodProducenta:v("kodProducenta")||fallback.kodProducenta||fallback.mpn,producent:v("producent")||fallback.producent,marka:v("marka")||fallback.marka,zdjecie:v("zdjecie")||fallback.zdjecie,opisKrotki:v("opisKrotki")||fallback.opisKrotki,opis:v("opis")||fallback.opis,sourceUrl:v("producentUrl")||v("sourceUrl")||fallback.sourceUrl,producentUrl:v("producentUrl")||fallback.producentUrl};
}
function produktDodawanieOdciskKontroli(p={}){
  const key=v=>agentAIKluczProduktu(v),url=normalizujUrlProducenta(p.sourceUrl||p.producentUrl||"");
  return [key(p.nazwa),key(p.gtin||p.ean),key(p.externalId),key(p.sku),key(p.mpn),key(p.kodProducenta),key(p.producent||p.marka),url].join("|");
}
function produktDodawanieStanKontroli(p={},options={}){
  const nazwa=String(p.nazwa||"").trim(),category=String(p.kategoria||"").trim(),price=Number(p.cena)||0,url=normalizujUrlProducenta(p.sourceUrl||p.producentUrl||"");
  const preciseIdentity=!!(p.gtin||p.ean||p.externalId||p.sku||p.mpn||p.kodProducenta||(/^https?:\/\//i.test(url)&&url.length>12));
  const hasBasis=preciseIdentity||nazwa.length>=3,fingerprint=produktDodawanieOdciskKontroli(p),duplicates=hasBasis?agentAIDuplikatyProduktu({...p,id:""}):[];
  const blocking=duplicates.find(x=>x.blocking)||null,potential=duplicates.find(x=>!x.blocking&&(x.score>=84||x.reasons.includes("identyczna nazwa")))||null;
  const acknowledged=!potential||String(options.ackFingerprint||"")===fingerprint,dataReady=!!(nazwa&&category&&price>0),duplicateChecked=hasBasis;
  const duplicateReady=duplicateChecked&&!blocking&&acknowledged,canSubmit=dataReady&&duplicateReady;
  let progress=10;if(nazwa)progress=25;if(dataReady)progress=50;if(duplicateChecked)progress=65;if(duplicateReady)progress=82;if(canSubmit)progress=92;
  return {p,nazwa,category,price,url,preciseIdentity,hasBasis,fingerprint,duplicates,blocking,potential,acknowledged,dataReady,duplicateChecked,duplicateReady,canSubmit,progress};
}
function produktDodawanieDuplikatKartaHTML(x={}){
  const p=x.product||{};
  return `<article class="product-add-duplicate-card ${x.blocking?"blocking":"review"}">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span class="product-add-duplicate-fallback">${esc(p.ikona||"📦")}</span>`}<div><strong>#${esc(p.id)} ${esc(p.nazwa||"Produkt")}</strong><small>EAN ${esc(p.gtin||p.ean||"—")} • SKU/EXTERNAL_ID ${esc(p.sku||p.externalId||"—")} • kod ${esc(p.kodProducenta||p.mpn||"—")}</small><em>${esc((x.reasons||[]).join(" • "))} • zgodność ${esc(x.score||0)}%</em></div><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Otwórz produkt</a></article>`;
}
function produktDodawanieKontrolaHTML(p={},options={}){
  const s=produktDodawanieStanKontroli(p,options),duplicateClass=s.blocking?"blocked":s.potential&&!s.acknowledged?"review":s.duplicateChecked?"clear":"waiting";
  const duplicateTitle=s.blocking?`Produkt już istnieje — znaleziono pewne dopasowanie #${s.blocking.product.id}`:s.potential&&!s.acknowledged?"Znaleziono bardzo podobny produkt — potrzebna Twoja decyzja":s.duplicateChecked?"Nie znaleziono pewnego duplikatu":"Kontrola duplikatów czeka na dane produktu";
  const duplicateNote=s.blocking?"Dodanie nowej kartoteki jest zablokowane. Otwórz i edytuj istniejący produkt.":s.potential&&!s.acknowledged?"Porównaj rekord poniżej. Kontynuuj tylko wtedy, gdy to faktycznie inny produkt lub wariant.":s.duplicateChecked?`Sprawdzono ${produktyDoAdministracji().filter(x=>!czyProduktAdminWKoszu(x)).length} aktywnych kart po ${s.preciseIdentity?"EAN, kodach, SKU, linku i nazwie":"znormalizowanej nazwie"}.`:"Wpisz nazwę, EAN, SKU, kod producenta albo link źródłowy.";
  const steps=[
    ["1","Dane podstawowe",s.dataReady,"nazwa, kategoria i cena"],
    ["2","Tożsamość",s.hasBasis,s.preciseIdentity?"kody lub link źródłowy":"nazwa produktu"],
    ["3","Duplikaty",s.duplicateReady,s.blocking?`istnieje #${s.blocking.product.id}`:s.potential&&!s.acknowledged?"wymaga decyzji":s.duplicateChecked?"kontrola zakończona":"oczekuje"],
    ["4","Zatwierdzenie",false,s.canSubmit?"przycisk jest odblokowany":"najpierw zakończ kontrolę"]
  ];
  return `<div class="product-add-progress-head"><div><span>Postęp dodawania produktu</span><b>${esc(s.progress)}% gotowości</b><small>${s.canSubmit?"Możesz sprawdzić formularz i zatwierdzić dodanie.":"System nie zapisze produktu, dopóki kontrola nie zostanie zakończona."}</small></div><button class="btn ghost" type="button" onclick="produktDodawanieSprawdzTeraz(this)">🔎 Sprawdź teraz</button></div><div class="product-add-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${esc(s.progress)}"><span style="width:${esc(s.progress)}%"></span></div><div class="product-add-progress-steps">${steps.map(([nr,label,ok,note],i)=>`<span class="${ok?"done":i===3&&s.canSubmit?"active":"wait"}"><b>${ok?"✓":nr}</b><span><strong>${esc(label)}</strong><small>${esc(note)}</small></span></span>`).join("")}</div><section class="product-add-duplicate-check ${duplicateClass}"><header><span>${s.blocking?"⛔":s.potential&&!s.acknowledged?"⚠️":s.duplicateChecked?"✅":"🔎"}</span><div><b>${esc(duplicateTitle)}</b><small>${esc(duplicateNote)}</small></div></header>${s.duplicates.length?`<div class="product-add-duplicate-list">${s.duplicates.slice(0,4).map(produktDodawanieDuplikatKartaHTML).join("")}</div>`:""}${s.potential&&!s.blocking&&!s.acknowledged?`<div class="product-add-duplicate-decision"><button class="btn" type="button" onclick="produktDodawaniePotwierdzNowy(this.form)">To inny produkt — zezwól na dodanie</button><small>Ta decyzja jest ważna tylko dla obecnego zestawu nazwy i kodów. Po ich zmianie kontrola wykona się ponownie.</small></div>`:""}</section>`;
}
function produktDodawanieAktualizuj(form){
  if(!form||!form.querySelector("[data-product-add-control]"))return null;
  const p=agentAIProduktZFormularzaDoOceny(form,{}),fingerprint=produktDodawanieOdciskKontroli(p),previous=String(form.dataset.productDuplicateFingerprint||"");
  if(previous&&previous!==fingerprint)form.dataset.productDuplicateAck="";
  form.dataset.productDuplicateFingerprint=fingerprint;
  const state=produktDodawanieStanKontroli(p,{ackFingerprint:form.dataset.productDuplicateAck||""}),box=form.querySelector("[data-product-add-control]");
  if(box)box.innerHTML=produktDodawanieKontrolaHTML(p,{ackFingerprint:form.dataset.productDuplicateAck||""});
  const approval=form.querySelector("[data-product-final-approval]");if(approval){approval.disabled=!state.canSubmit;approval.title=state.canSubmit?"Kontrola zakończona — możesz zatwierdzić":"Najpierw uzupełnij dane i zakończ kontrolę duplikatów";}
  form.dataset.productDuplicateVerified=state.duplicateReady?"1":"0";form.dataset.productReadyToAdd=state.canSubmit?"1":"0";
  return state;
}
function produktDodawanieZmienione(event,form){
  if(!form||event?.target?.closest?.("[data-product-add-control]"))return;
  clearTimeout(window.__productDuplicateCheck);window.__productDuplicateCheck=setTimeout(()=>produktDodawanieAktualizuj(form),220);
}
function produktDodawanieSprawdzTeraz(button){
  const state=produktDodawanieAktualizuj(button?.form||button?.closest("form"));if(!state)return;
  toast(state.blocking?`Produkt już istnieje (#${state.blocking.product.id})`:state.potential&&!state.acknowledged?"Znaleziono podobny produkt — podejmij decyzję":state.canSubmit?"Kontrola zakończona — możesz zatwierdzić dodanie":"Uzupełnij brakujące dane podstawowe");
}
function produktDodawaniePotwierdzNowy(form){
  if(!form)return;const p=agentAIProduktZFormularzaDoOceny(form,{}),state=produktDodawanieStanKontroli(p,{});if(state.blocking){toast(`Pewnego duplikatu #${state.blocking.product.id} nie można ominąć`);return;}
  form.dataset.productDuplicateAck=state.fingerprint;produktDodawanieAktualizuj(form);toast("Decyzja zapisana — nadal musisz zatwierdzić dodanie produktu na dole formularza");
}
function agentAIProduktZLinkuMini(p={}){
  if(!p||typeof p!=="object") return {};
  const mini={...p};
  mini.opisKrotki=String(mini.opisKrotki||"").slice(0,500);
  mini.opis=String(mini.opis||"").slice(0,12000);
  mini.zdjecie=String(mini.zdjecie||"").slice(0,1000);
  mini.zdjecia=(Array.isArray(mini.zdjecia)?mini.zdjecia:[]).map(x=>String(x||"").slice(0,1000)).filter(Boolean).slice(0,8);
  if(mini.parametryProducenta) mini.parametryProducenta=Object.fromEntries(Object.entries(mini.parametryProducenta).map(([k,v])=>[k,String(v||"").slice(0,500)]).slice(0,20));
  return mini;
}
function agentAIWynikLinkuZPamieci(url=""){
  const key=normalizujUrlProducenta(url),rec=(agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===key||normalizujUrlProducenta(x.resolvedUrl||"")===key||x.lastCandidates?.some(c=>normalizujUrlProducenta(c.url||"")===key));if(!rec)return null;
  const alternatives=(Array.isArray(rec.lastCandidates)?rec.lastCandidates:[]).filter(x=>x?.product?.nazwa);
  if(alternatives.length)return {ok:true,product:alternatives[0].product,alternatives,needsChoice:alternatives.length>1,confidence:Number(rec.linkConfidence||alternatives[0]?.confidence||0),missing:rec.lastMissing||[],fieldSources:rec.fieldSources||{},requestedUrl:url,resolvedUrl:rec.resolvedUrl||alternatives[0]?.url||url,canonicalUrl:alternatives[0]?.url||rec.resolvedUrl||url,fromCache:true,stale:true,cacheSavedAt:rec.ostatniaProba||rec.aktualizacja,diagnostics:{...(rec.diagnostics||{}),cacheFallback:true,retryRecommended:true,selectedReason:"ostatni poprawny wynik zapisany przez Agenta"}};
  if(rec.lastProduct?.nazwa)return {ok:true,product:rec.lastProduct,alternatives:[{id:"cached-1",url:rec.resolvedUrl||rec.url,confidence:Number(rec.linkConfidence||0),missing:rec.lastMissing||[],fieldSources:rec.fieldSources||{},product:rec.lastProduct}],needsChoice:false,confidence:Number(rec.linkConfidence||0),missing:rec.lastMissing||[],fieldSources:rec.fieldSources||{},requestedUrl:url,resolvedUrl:rec.resolvedUrl||rec.url,canonicalUrl:rec.resolvedUrl||rec.url,fromCache:true,stale:true,cacheSavedAt:rec.ostatniaProba||rec.aktualizacja,diagnostics:{...(rec.diagnostics||{}),cacheFallback:true,retryRecommended:true,selectedReason:"ostatni poprawny wynik zapisany przez Agenta"}};
  return null;
}
function agentAIZapiszLinkProducenta(url,status="oczekuje",powod="",extra={}){
  const clean=normalizujUrlProducenta(url);
  if(!/^https?:\/\//i.test(clean)) return null;
  const teraz=new Date(), poprzednie=Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[];
  const idx=poprzednie.findIndex(x=>normalizujUrlProducenta(x.url)===clean);
  const baza=idx>=0?poprzednie[idx]:{id:"PURL-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),url:clean,dodano:teraz.toISOString(),dodanoTxt:teraz.toLocaleString("pl-PL"),proby:0};
  const rec={...baza,...extra,url:clean,status,powod:String(powod||extra.powod||"").slice(0,500),aktualizacja:teraz.toISOString(),aktualizacjaTxt:teraz.toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
  const lista=idx>=0?[...poprzednie.slice(0,idx),rec,...poprzednie.slice(idx+1)]:[rec,...poprzednie];
  agentAILinkiProducentow=lista.slice(0,500);
  zapiszLS("artway_agent_ai_linki_producentow",agentAILinkiProducentow);
  if(chmuraToken&&!chmuraWczytywanie)zaplanujZapisUstawien();
  return rec;
}
function agentAIUsunLinkProducenta(ref){
  const r=String(ref||"");
  const teraz=new Date(), clean=normalizujUrlProducenta(r);
  agentAILinkiProducentow=(Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[]).map(x=>{
    if(x.id===r||normalizujUrlProducenta(x.url)===clean) return {...x,status:"usunieto",powod:"Usunięte ręcznie z kolejki agenta",usunieto:teraz.toISOString(),aktualizacja:teraz.toISOString(),aktualizacjaTxt:teraz.toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
    return x;
  }).slice(0,500);
  zapiszLS("artway_agent_ai_linki_producentow",agentAILinkiProducentow);
  if(chmuraToken) void chmuraZapiszUstawienia();
  toast("Link usunięty z kolejki agenta");
  renderuj();
}
function agentAIZakonczLinkProducenta(ref, produkt={}){
  const r=String(ref||""), clean=normalizujUrlProducenta(r), teraz=new Date();
  let zmieniono=false;
  agentAILinkiProducentow=(Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[]).map(x=>{
    const pasuje=x.id===r||normalizujUrlProducenta(x.url)===clean||normalizujUrlProducenta(x.url)===normalizujUrlProducenta(produkt.sourceUrl||produkt.producentUrl||"");
    if(!pasuje) return x;
    zmieniono=true;
    return {...x,status:"zamknięte",powod:"Produkt dodany do sklepu — zadanie wykonane",produktId:produkt.id||x.produktId||"",lastProductName:produkt.nazwa||x.lastProductName||"",zamknieto:teraz.toISOString(),aktualizacja:teraz.toISOString(),aktualizacjaTxt:teraz.toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
  });
  if(zmieniono){
    zapiszLS("artway_agent_ai_linki_producentow",agentAILinkiProducentow);
    if(chmuraToken) void chmuraZapiszUstawienia();
  }
  return zmieniono;
}
function agentAILinkiOczekujace(){
  return (Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[]).filter(x=>!["pobrano","zamkniete","zamknięte","usunieto","usunięto"].includes(String(x.status||"").toLowerCase()));
}
function agentAILinkiGotoweDoPonowienia(){const now=Date.now();return agentAILinkiOczekujace().filter(x=>["oczekuje","błąd"].includes(String(x.status||"oczekuje").toLowerCase())&&(!x.nextRetryAt||Date.parse(x.nextRetryAt)<=now));}
function agentAINastepnaProbaLinku(proby=1){const delays=[15,60,360,1440,2880],minutes=delays[Math.min(delays.length-1,Math.max(0,Number(proby||1)-1))];return new Date(Date.now()+minutes*60000).toISOString();}
async function agentAISprawdzLinkProducenta(ref,cicho=false){
  const lista=Array.isArray(agentAILinkiProducentow)?agentAILinkiProducentow:[];
  const rec=lista.find(x=>x.id===ref||normalizujUrlProducenta(x.url)===normalizujUrlProducenta(ref))||{id:"tmp",url:ref,proby:0};
  if(!rec.url) return null;
  const teraz=new Date();
  try{
    const d=await chmura("product-url-prepare",{method:"POST",body:{url:rec.url},timeout:90000});
    const p=d.product||{}, braki=brakiDanychProducenta(p,d),workflow=d.workflow||{};
    const status=d.needsChoice?"wymaga wyboru":d.duplicateAudit?.blocking?"duplikat":workflow.readyForStore?"pobrano":"do uzupełnienia";
    const reason=d.needsChoice?`Agent znalazł ${d.alternatives?.length||2} różne produkty — wybierz właściwy wariant`:d.duplicateAudit?.blocking?`Produkt istnieje już w sklepie: ${d.duplicateAudit.selected?.productName||d.duplicateAudit.selected?.productId||"duplikat"}`:workflow.readyForStore?`Kartoteka sklepu gotowa • Allegro ${workflow.readyForAllegro?"gotowe":"wymaga uzupełnienia"}`:`Braki po pobraniu: ${braki.join(", ")}`;
    const next=agentAIZapiszLinkProducenta(rec.url,status,reason,{
      proby:Number(rec.proby||0)+1,
      ostatniaProba:teraz.toISOString(),
      ostatniaProbaTxt:teraz.toLocaleString("pl-PL"),
      lastProductName:p.nazwa||"",
      lastAvailability:p.dostepnoscProducenta||d.availability?.text||"",
      lastPrice:p.cena||"",
      lastMissing:braki,
      lastProduct:agentAIProduktZLinkuMini(p),
      lastCandidates:(d.alternatives||[]).map(x=>({...x,product:agentAIProduktZLinkuMini(x.product||{})})).slice(0,5),
      linkConfidence:d.confidence||0,
      fieldSources:d.fieldSources||{},
      diagnostics:d.diagnostics||{},
      lastWorkflow:workflow,
      lastStoreCategory:d.storeCategory||null,
      lastDuplicateAudit:d.duplicateAudit||null,
      resolvedUrl:d.resolvedUrl||d.canonicalUrl||rec.url,
      nextRetryAt:null,
      lastError:""
    });
    if(!cicho) toast(status==="pobrano"?`Agent przygotował produkt ✅ • sklep gotowy • Allegro ${workflow.readyForAllegro?"gotowe":"do uzupełnienia"}`:d.needsChoice?`Agent znalazł ${d.alternatives?.length||2} produkty — wybierz właściwy`:status==="duplikat"?"Agent zablokował utworzenie duplikatu":`Agent pobrał link, ale są braki: ${braki.join(", ")}`);
    return {rec:next,dane:d,braki,status};
  }catch(e){
    const proby=Number(rec.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);
    const next=agentAIZapiszLinkProducenta(rec.url,"oczekuje",e.message||String(e),{
      proby,
      ostatniaProba:teraz.toISOString(),
      ostatniaProbaTxt:teraz.toLocaleString("pl-PL"),
      nextRetryAt,
      failureCode:e.code||"fetch_error",
      diagnostics:e.linkDiagnostics||{},
      lastError:e.message||String(e)
    });
    if(!cicho) toast(`Agent zapisał link do ponowienia ${new Date(nextRetryAt).toLocaleString("pl-PL")}: ${e.message||e}`);
    return {rec:next,blad:e};
  }
}
async function agentAISprawdzLinkiProducentow(limit=5){
  const lista=agentAILinkiGotoweDoPonowienia().slice(0,limit);
  if(!lista.length) return agentAILinkiOczekujace().length?"Linki są zaplanowane do późniejszego ponowienia — Agent nie powtarza teraz tych samych błędów.":"Nie ma linków producentów oczekujących na pobranie.";
  const wyniki=[];
  for(const rec of lista) wyniki.push(await agentAISprawdzLinkProducenta(rec.id,true));
  const wybor=wyniki.filter(x=>x?.status==="wymaga wyboru").length,ok=wyniki.filter(x=>x&&!x.blad&&x.status==="pobrano").length,braki=wyniki.filter(x=>x&&!x.blad&&x.status==="do uzupełnienia").length,blad=wyniki.filter(x=>x?.blad).length;
  zapiszHistorieAgenta("linki-producentow",`Agent sprawdził ${wyniki.length} linków producentów`,{ok,braki,wybor,blad});
  renderuj();
  return `Sprawdziłem ${wyniki.length} linków producentów. Pobrane poprawnie: ${ok}. Do uzupełnienia: ${braki}. Wymagają wyboru produktu: ${wybor}. Błędy / zaplanowane ponowienie: ${blad}.`;
}
function producentDostepnoscInfo(p={}){
  const u=ustawieniaMagazynuPelne(),prog=Math.max(1,Number(u.progNiskiProducenta)||50),maxAge=Math.max(1,Number(u.producentMaxWiekGodz)||48),url=String(p.producentUrl||p.sourceUrl||"").trim(),raw=p.stanProducenta,quantity=raw===""||raw===null||raw===undefined?null:Math.max(0,Math.floor(Number(raw)||0)),checked=p.producentSprawdzonoAt||"",age=checked?Math.max(0,(Date.now()-Date.parse(checked))/3600000):Infinity,stale=!checked||!Number.isFinite(age)||age>maxAge;
  let status=String(p.producentStatus||"").toLowerCase();
  if(quantity===0)status="brak";else if(quantity!==null&&quantity<=prog)status="niski";else if(quantity!==null)status="dostepny";else if(/niedost/i.test(p.dostepnoscProducenta||""))status="brak";else if(/dostęp|dostep/i.test(p.dostepnoscProducenta||""))status="dostepny_nieznany";else if(!status)status="nieznany";
  const meta={dostepny:{label:quantity===null?"dostępny":"dostępny "+quantity+" szt.",cls:"ok",ico:"🟢"},dostepny_nieznany:{label:"dostępny • ilość nieujawniona",cls:"info",ico:"🔵"},niski:{label:`niski stan: ${quantity??"—"} szt.`,cls:"warn",ico:"🟡"},brak:{label:"brak u producenta",cls:"bad",ico:"🔴"},nieznany:{label:"niepotwierdzona",cls:"unknown",ico:"⚪"},blad:{label:"błąd ostatniej próby",cls:"unknown",ico:"⚪"}}[status]||{label:"niepotwierdzona",cls:"unknown",ico:"⚪"};
  return {url,quantity,exact:p.stanProducentaDokladny===true,status,prog,checked,ageHours:age,stale,alert:["niski","brak"].includes(status),...meta,error:p.producentOstatniBlad||"",source:p.stanProducentaZrodlo||""};
}
function producentDostepnoscBadgeHTML(p={},compact=false){
  const i=producentDostepnoscInfo(p),date=i.checked?allegroDataTxt(i.checked):"nigdy";
  return `<div class="supplier-availability ${i.cls} ${i.stale?"stale":""}"><b>${i.ico} ${esc(i.label)}</b>${compact?"":`<small>Sprawdzono: ${esc(date)}${i.stale?" • wynik nieaktualny":""}${i.source?` • ${esc(i.source)}`:""}</small>${i.error?`<em>${esc(skrocTekst(i.error,180))}</em>`:""}`}</div>`;
}
function produktyMonitorowaneUProducentow(){return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&/^https?:\/\//i.test(String(p.producentUrl||p.sourceUrl||"")));}
function statystykiDostepnosciProducentow(){
  const products=produktyMonitorowaneUProducentow(),rows=rankingDostepnosciProducentow(products).map(x=>({p:x.p,i:x.availability,priority:x.priority,rank:x.rank}));
  const decyzje=rows.map(x=>({...x,decision:decyzjaProducentaInfo(x.p)})),wymagajaDecyzji=decyzje.filter(x=>["brak","niski"].includes(x.i.status)&&(!x.decision.code||x.decision.expired)),aktywneDecyzje=decyzje.filter(x=>x.decision.code&&!x.decision.expired),wygasleDecyzje=decyzje.filter(x=>x.decision.expired);
  return {products,rows,decyzje,wymagajaDecyzji,aktywneDecyzje,wygasleDecyzje,dostepne:rows.filter(x=>["dostepny","dostepny_nieznany"].includes(x.i.status)&&!x.i.stale),niskie:rows.filter(x=>x.i.status==="niski"),braki:rows.filter(x=>x.i.status==="brak"),nieznane:rows.filter(x=>["nieznany","blad"].includes(x.i.status)||x.i.stale),bezLinku:produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&!/^https?:\/\//i.test(String(p.producentUrl||p.sourceUrl||"")))};
}
async function agentAISprawdzDostepnoscProducentow(limit=null,productIds=[]){
  const u=ustawieniaMagazynuPelne(),sample=Math.max(1,Math.min(25,Number(limit??u.producentProbka)||8)),ids=(Array.isArray(productIds)?productIds:[]).map(String);
  try{
    toast(ids.length?"Agent sprawdza wybrany produkt u producenta…":`Agent wyrywkowo sprawdza ${sample} produktów u producentów…`);
    const d=await chmura("supplier-availability-sample",{method:"POST",body:{limit:sample,productIds:ids,threshold:Math.max(1,Number(u.progNiskiProducenta)||50),source:"admin-agent-ai"},timeout:120000});
    await chmuraWczytajStan().catch(()=>{});zbudujProdukty();
    const s=d.summary||{};toast(`✅ Sprawdzono ${s.checked||0}, w tym priorytetowych ${s.priorityChecked||0}: dostępne ${s.available||0}, niski stan ${s.low||0}, brak ${s.unavailable||0}`);odswiezDostepnoscProducentowWidoku();return d;
  }catch(e){toast("⚠️ Monitoring producentów: "+(e.message||e));return null;}
}
function agentAILinkiProducentowTekst(){
  const lista=agentAILinkiOczekujace();
  if(!lista.length) return "Nie ma obecnie linków producentów oczekujących na pobranie.";
  return ["🔗 Linki producentów do sprawdzenia przez agenta:",...lista.slice(0,15).map((x,i)=>`• ${i+1}. ${x.lastProductName?`${x.lastProductName} — `:""}${x.url} [${x.status||"oczekuje"}]${x.powod?` — ${x.powod}`:""}`)].join("\n");
}
function agentAILinkiProducentowPanelHTML(){
  const lista=agentAILinkiOczekujace().slice(0,25);
  const ocz=agentAILinkiOczekujace().length;
  return `<div class="panel agent-link-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">🔗 Linki producentów dla agenta</h2><p class="order-detail-lead">Gdy pobieranie produktu z URL się nie uda albo dane są niepełne, link trafia tutaj. Agent może później ponowić pobranie i pokazać braki.</p></div>
      <span class="lvl ${ocz?"lvl-ostrzezenie":"lvl-ok"}">${ocz?`${ocz} do sprawdzenia`:"brak zaległych linków"}</span>
    </div>
    <div class="diag-actions" style="margin-top:0">
      <button class="btn" type="button" onclick="agentAISprawdzLinkiProducentow().then(t=>toast(t))">🤖 Sprawdź oczekujące</button>
      <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż linki producentów do pobrania')">Wpisz komendę</button>
    </div>
    <div class="agent-memory-list">
      ${lista.length?lista.map(x=>`<div class="agent-memory-item agent-link-work-item">
        <div><b>${esc(x.lastProductName||x.url)}</b><p>${esc(x.url)}</p><small>Status: ${esc(x.status||"oczekuje")} • próby: ${esc(x.proby||0)}${x.linkConfidence?` • kompletność: ${esc(x.linkConfidence)}%`:""}${x.powod?` • ${esc(x.powod)}`:""}${Array.isArray(x.lastMissing)&&x.lastMissing.length?` • braki: ${esc(x.lastMissing.join(", "))}`:""}${x.nextRetryAt?` • następna próba: ${esc(new Date(x.nextRetryAt).toLocaleString("pl-PL"))}`:""}</small>${Array.isArray(x.lastCandidates)&&x.lastCandidates.length>1?`<div class="agent-link-candidates">${x.lastCandidates.map((c,i)=>`<button type="button" onclick="agentAIWypelnijNowyProduktZLinku(${jsArg(x.id)},${i})"><b>${esc(c.product?.nazwa||`Wariant ${i+1}`)}</b><small>${esc(c.confidence||0)}% • ${esc(c.url||"")}</small></button>`).join("")}</div>`:""}</div>
        <div class="warehouse-worktable-actions">
          <button class="btn ghost" type="button" onclick="agentAISprawdzLinkProducenta(${jsArg(x.id)}).then(()=>renderuj())">Sprawdź</button>
          ${x.lastProduct&&!(x.lastCandidates?.length>1)?`<button class="btn ghost" type="button" onclick="agentAIWypelnijNowyProduktZLinku(${jsArg(x.id)})">Przygotuj dodanie produktu</button>`:""}
          ${x.lastCandidates?.length>1?`<span class="lvl lvl-ostrzezenie">Najpierw wybierz wariant powyżej</span>`:""}
          <button class="btn danger" type="button" onclick="agentAIUsunLinkProducenta(${jsArg(x.id)})">Usuń</button>
        </div>
      </div>`).join(""):`<div class="agent-ops-empty">Brak zapisanych linków producentów.</div>`}
    </div>
  </div>`;
}
async function agentAIWypelnijNowyProduktZLinku(id,candidateIndex=null){
  const rec=(agentAILinkiProducentow||[]).find(x=>x.id===id);
  if(!rec?.url){toast("Nie znaleziono linku w kolejce Agenta");return;}
  try{
    toast("Agent przygotowuje kompletną kartotekę sklepu i Allegro…");
    const body={url:rec.url};if(Number.isInteger(candidateIndex))body.choice=candidateIndex;
    const d=await chmura("product-url-prepare",{method:"POST",body,timeout:90000});
    if(d.needsChoice){toast("Wybierz właściwy wariant produktu");return;}
    const product=d.product||rec.lastProduct;
    if(!product){toast("Agent nie otrzymał danych produktu");return;}
    agentAIImportUrlStan={busy:false,data:d,selected:Number.isInteger(candidateIndex)?candidateIndex:0,error:""};
    sessionStorage.setItem("artway_prefill_product",JSON.stringify({...product,_agentLinkId:rec.id,_agentLinkUrl:d.canonicalUrl||d.resolvedUrl||rec.url,_agentPrepared:true}));
    location.hash="#/admin/produkty/dodaj?agent=1";
  }catch(e){toast("⚠️ Przygotowanie produktu: "+(e.message||e));}
}
