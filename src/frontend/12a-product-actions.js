/* ═══════════ KATALOG PRODUKTÓW — AGENT I DECYZJE MASOWE ALLEGRO ═══════════ */
let asortymentAgentKolejka={busy:false,operation:"pelna",ids:[],done:0,total:0,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:"",finishedAt:""};
let asortymentAllegroDecyzja={step:"idle",busy:false,operation:"update",ids:[],skipped:0,done:0,total:0,ok:0,failed:0,error:"",results:[]};

function asortymentProduktPoId(rawId){return produktyDoAdministracji().find(p=>String(p.id)===String(rawId))||pobierzProduktAdmin(Number(rawId))||null;}
function asortymentOfertaProduktu(p={}){return allegroOfertaDlaProduktuSklepu(p)||(p.allegroOfferId?allegroOfertaPoId(String(p.allegroOfferId)):null);}
function asortymentProduktyZId(ids=[]){return [...new Set(ids.map(String))].map(asortymentProduktPoId).filter(p=>p&&!czyProduktAdminWKoszu(p));}
function asortymentOdswiezCentrumDzialan(){const el=document.querySelector("[data-product-agent-center]");if(el)el.innerHTML=asortymentCentrumDzialanHTML();}
function asortymentOdswiezStanZaznaczenia(){
  document.querySelectorAll("[data-assortment-product-id]").forEach(input=>{const checked=zaznaczoneProdukty.has(Number(input.dataset.assortmentProductId))||zaznaczoneProdukty.has(input.dataset.assortmentProductId);input.checked=checked;input.closest("tr")?.classList.toggle("is-selected",checked);});
  document.querySelectorAll("[data-product-selection-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  document.querySelectorAll("[data-product-selection-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  const operations=document.querySelector('[data-admin-results-operations="assortment-products"]');
  operations?.querySelectorAll("[data-admin-selected-count]").forEach(el=>{el.textContent=String(zaznaczoneProdukty.size);});
  operations?.querySelectorAll("[data-admin-selected-required]").forEach(el=>{el.disabled=!zaznaczoneProdukty.size;});
  asortymentOdswiezCentrumDzialan();
}
function asortymentUstawOperacjeAgenta(value){asortymentAgentKolejka.operation=String(value||"pelna");}
function asortymentUstawOperacjeZewnetrzna(value){asortymentAllegroDecyzja.operation=String(value||"update");}

function asortymentSeoAgenta(p={}){
  if(typeof seoAutomatyzujDaneProduktu!=="function")return false;
  const next=seoAutomatyzujDaneProduktu({...p},"agent-katalogu",{force:false}),patch={};
  for(const key of ["seoTitle","seoDescription","seoKeywords","seoScore","seoReviewedAt","seoSource","seoMode"])if(next[key]!==undefined&&String(next[key])!==String(p[key]??""))patch[key]=next[key];
  return Object.keys(patch).length?zapiszPolaProduktuLokalnie(p.id,patch,false):false;
}
async function asortymentAgentPrzetworzProdukt(base,operation){
  let p=asortymentProduktPoId(base.id)||base;const warnings=[];
  if(["pelna","zrodlo"].includes(operation)){
    if(p.sourceUrl||p.producentUrl)p=await automatyczniePobierzDaneZrodlaProduktu(p);
    else warnings.push("brak linku producenta");
  }
  if(["pelna","seo"].includes(operation))asortymentSeoAgenta(p);
  if(["pelna","szkic","dane"].includes(operation)){
    const draft=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:90000});
    allegroZapiszAutoUzupelnienia(p,draft);
    if((draft.missing||[]).length)warnings.push(`zadanie Agenta: ${(draft.missing||[]).join(", ")}`);
    p=asortymentProduktPoId(p.id)||p;
  }
  if(["pelna","prowizja"].includes(operation)){
    const price=kwotaNum(p.cenaAllegro||p.cena),feeReady=price>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)));
    if(feeReady){const fee=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});if(!fee)warnings.push("nie pobrano prowizji");}
    else warnings.push("brak danych do wyliczenia prowizji");
  }
  return {id:String(p.id),name:p.nazwa||"Produkt",warnings};
}
async function asortymentUruchomAgenta(ids,operation){
  if(asortymentAgentKolejka.busy){toast("Agent ma już aktywną kolejkę produktów");return;}
  const products=asortymentProduktyZId(ids).slice(0,250);if(!products.length){toast("Zaznacz co najmniej jeden aktywny produkt");return;}
  asortymentAgentKolejka={busy:true,operation,ids:products.map(p=>String(p.id)),done:0,total:products.length,ok:0,warnings:0,failed:0,cancel:false,current:"",results:[],startedAt:new Date().toISOString(),finishedAt:""};asortymentOdswiezCentrumDzialan();
  let cursor=0;const worker=async()=>{while(cursor<products.length&&!asortymentAgentKolejka.cancel){const p=products[cursor++];asortymentAgentKolejka.current=p.nazwa||`Produkt ${p.id}`;asortymentOdswiezCentrumDzialan();try{const result=await asortymentAgentPrzetworzProdukt(p,operation);asortymentAgentKolejka.ok++;if(result.warnings.length)asortymentAgentKolejka.warnings++;asortymentAgentKolejka.results.push({...result,ok:true});}catch(error){asortymentAgentKolejka.failed++;asortymentAgentKolejka.results.push({id:String(p.id),name:p.nazwa||"Produkt",ok:false,error:error.message||String(error)});}finally{asortymentAgentKolejka.done++;asortymentOdswiezCentrumDzialan();}}};
  await Promise.all(Array.from({length:Math.min(2,products.length)},worker));
  asortymentAgentKolejka={...asortymentAgentKolejka,busy:false,current:"",finishedAt:new Date().toISOString()};
  zapiszHistorieAgenta("katalog-allegro",`Agent zakończył kolejkę katalogu: ${asortymentAgentKolejka.ok} poprawnie, ${asortymentAgentKolejka.failed} błędów`,{operation,products:asortymentAgentKolejka.ids,warningCount:asortymentAgentKolejka.warnings});
  await chmuraZapiszUstawienia().catch(()=>false);zbudujProdukty();asortymentOdswiezCentrumDzialan();toast(`🤖 Kolejka zakończona: ${asortymentAgentKolejka.ok} poprawnie${asortymentAgentKolejka.failed?` • ${asortymentAgentKolejka.failed} błędów`:""}`);
}
function asortymentUruchomAgentaDlaZaznaczonych(){return asortymentUruchomAgenta([...zaznaczoneProdukty],String(document.querySelector("[data-agent-product-operation]")?.value||asortymentAgentKolejka.operation||"pelna"));}
function asortymentUruchomAgentaDlaProduktu(id,operation="pelna"){return asortymentUruchomAgenta([id],operation);}
function asortymentAnulujAgenta(){if(asortymentAgentKolejka.busy){asortymentAgentKolejka.cancel=true;asortymentOdswiezCentrumDzialan();}}

function asortymentPrzygotujOperacjeZewnetrzna(operation=null,singleId=null){
  const op=String(operation||document.querySelector("[data-external-product-operation]")?.value||asortymentAllegroDecyzja.operation||"update"),source=singleId===null?[...zaznaczoneProdukty]:[singleId],all=asortymentProduktyZId(source);
  const eligible=all.filter(p=>op==="update"||op==="withdraw"?!!asortymentOfertaProduktu(p):true).slice(0,50);
  if(!eligible.length){toast(op==="update"||op==="withdraw"?"Zaznaczone produkty nie mają powiązanych ofert Allegro":"Zaznacz produkty");return;}
  asortymentAllegroDecyzja={step:"confirm",busy:false,operation:op,ids:eligible.map(p=>String(p.id)),skipped:Math.max(0,all.length-eligible.length),done:0,total:eligible.length,ok:0,failed:0,error:"",results:[]};asortymentOdswiezCentrumDzialan();setTimeout(()=>document.querySelector(".product-external-confirm")?.scrollIntoView({behavior:"smooth",block:"center"}),0);
}
function asortymentAnulujOperacjeZewnetrzna(){asortymentAllegroDecyzja={step:"idle",busy:false,operation:"update",ids:[],skipped:0,done:0,total:0,ok:0,failed:0,error:"",results:[]};asortymentOdswiezCentrumDzialan();}
async function asortymentPotwierdzOperacjeZewnetrzna(){
  const state=asortymentAllegroDecyzja;if(state.busy||state.step!=="confirm")return;
  if(!document.querySelector("[data-external-product-confirm]")?.checked){toast("Zaznacz potwierdzenie świadomej operacji przez API Allegro");return;}
  asortymentAllegroDecyzja={...state,busy:true,error:""};asortymentOdswiezCentrumDzialan();
  try{
    const products=asortymentProduktyZId(state.ids);
    if(state.operation==="withdraw"){
      const offerIds=[...new Set(products.map(p=>String(asortymentOfertaProduktu(p)?.id||p.allegroOfferId||"")).filter(Boolean))];
      const d=await chmura("allegro-withdraw-offers",{method:"POST",body:{offerIds,reason:"admin_decision"},timeout:120000});allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;allegroMapowania=d.mappings||allegroMapowania;
      asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,step:"done",done:offerIds.length,total:offerIds.length,ok:Number(d.ended)||0,failed:Number(d.failed)||0,results:d.results||[]};
    }else{
      for(const p of products){
        try{const existing=asortymentOfertaProduktu(p),publicationAction=state.operation==="activate"?"activate":state.operation==="draft"&&!existing?"deactivate":"keep";const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publicationAction,publishNow:publicationAction==="activate"}},timeout:120000});allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);allegroZapiszWynikOperacji(p,d);asortymentAllegroDecyzja.ok++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:true,offerId:d.offer?.id||existing?.id||""});}catch(error){asortymentAllegroDecyzja.failed++;asortymentAllegroDecyzja.results.push({id:String(p.id),name:p.nazwa,ok:false,error:error.message||String(error)});}finally{asortymentAllegroDecyzja.done++;asortymentOdswiezCentrumDzialan();}
      }
      asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,step:"done"};
    }
    await chmuraZapiszUstawienia().catch(()=>false);await allegroWczytajDane(true).catch(()=>{});allegroZapiszCache();asortymentOdswiezCentrumDzialan();toast(`🟠 Operacja Allegro zakończona: ${asortymentAllegroDecyzja.ok} poprawnie${asortymentAllegroDecyzja.failed?` • ${asortymentAllegroDecyzja.failed} błędów`:""}`);
  }catch(error){asortymentAllegroDecyzja={...asortymentAllegroDecyzja,busy:false,error:error.message||String(error)};asortymentOdswiezCentrumDzialan();toast("⚠️ Operacja Allegro: "+(error.message||error));}
}

function asortymentOperacjaZewnetrznaOpis(op){return ({update:["Aktualizacja istniejących ofert","Zmieni dane ofert po stronie Allegro, bez tworzenia brakujących ofert."],draft:["Szkice / oferty nieaktywne","Brakujące oferty zostaną utworzone jako nieaktywne; istniejące tylko zaktualizowane."],activate:["Publikacja i aktywacja","Utworzy lub zaktualizuje oferty i włączy sprzedaż na Allegro."],withdraw:["Zakończenie ofert","Zakończy powiązane oferty i wyłączy ich odnawianie."]})[op]||["Operacja Allegro",""];}
function asortymentDecyzjaZewnetrznaHTML(){
  const s=asortymentAllegroDecyzja;if(s.step==="idle")return "";const [title,description]=asortymentOperacjaZewnetrznaOpis(s.operation),products=asortymentProduktyZId(s.ids);
  if(s.step==="done")return `<section class="product-external-result ${s.failed?"partial":"ok"}"><div><b>${s.failed?"⚠️ Operacja zakończona częściowo":"✅ Operacja zakończona"}</b><small>${esc(title)} • poprawnie ${s.ok} • błędy ${s.failed}</small></div><button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()">Zamknij</button></section>`;
  return `<section class="product-external-confirm"><header><span>⚠️</span><div><small>Świadoma decyzja administratora • API Allegro</small><h3>${esc(title)} — ${products.length} produktów</h3><p>${esc(description)} Agent nie wykona tej operacji samodzielnie.</p></div></header><div class="product-external-preview">${products.slice(0,8).map(p=>`<span><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • oferta ${esc(asortymentOfertaProduktu(p)?.id||p.allegroOfferId||"nowa")}</small></span>`).join("")}${products.length>8?`<em>+ ${products.length-8} kolejnych</em>`:""}</div><label class="product-external-check"><input type="checkbox" data-external-product-confirm> Potwierdzam wykonanie tej operacji na Allegro${s.skipped?` • pominięto ${s.skipped} niepasujących produktów`:""}</label>${s.busy?`<div class="product-agent-progress"><progress max="${s.total}" value="${s.done}"></progress><span>${s.done}/${s.total}</span></div>`:""}${s.error?`<div class="backend-note allegro-mapping-error">${esc(s.error)}</div>`:""}<footer><button class="btn ghost" onclick="asortymentAnulujOperacjeZewnetrzna()" ${s.busy?"disabled":""}>Anuluj</button><button class="btn danger" onclick="asortymentPotwierdzOperacjeZewnetrzna()" ${s.busy?"disabled":""}>${s.busy?"⏳ Wykonuję…":"Potwierdzam operację"}</button></footer></section>`;
}
function asortymentCentrumDzialanHTML(){
  const q=asortymentAgentKolejka,selected=zaznaczoneProdukty.size,dirty=typeof chmuraBrudneKlucze!=="undefined"?chmuraBrudneKlucze.size:0;
  return `<section class="product-action-center"><header><div><span class="order-pro-label">Automatyzacje katalogu i Allegro</span><h3>⚡ Centrum działań produktów</h3><p>Agent wykonuje kontrole i uzupełnienia w tle. Publikacja lub zmiana oferty wymaga osobnej decyzji administratora.</p></div><span class="product-save-state ${dirty?"pending":"saved"}">${dirty?`☁️ ${dirty} zmian czeka na bezpieczny zapis`:"☁️ Dane zsynchronizowane"}</span></header><div class="product-action-columns"><article><small>BEZPIECZNA KOLEJKA AGENTA</small><b>${selected} zaznaczonych produktów</b><select data-agent-product-operation onchange="asortymentUstawOperacjeAgenta(this.value)" ${q.busy?"disabled":""}><option value="pelna" ${q.operation==="pelna"?"selected":""}>Pełna kontrola i uzupełnienie</option><option value="zrodlo" ${q.operation==="zrodlo"?"selected":""}>Odśwież dane producenta</option><option value="dane" ${q.operation==="dane"?"selected":""}>Kompletność i kategoria Allegro</option><option value="szkic" ${q.operation==="szkic"?"selected":""}>Przygotuj / sprawdź szkic</option><option value="prowizja" ${q.operation==="prowizja"?"selected":""}>Pobierz prowizje i opłaty</option><option value="seo" ${q.operation==="seo"?"selected":""}>Popraw SEO produktu</option></select><button class="btn" onclick="asortymentUruchomAgentaDlaZaznaczonych()" ${!selected||q.busy?"disabled":""}>🤖 Przekaż Agentowi w tle</button><small>Bez publikowania, wysyłania wiadomości i kończenia ofert.</small></article><article><small>OPERACJE ZEWNĘTRZNE</small><b>Decyzja masowa Allegro</b><select data-external-product-operation onchange="asortymentUstawOperacjeZewnetrzna(this.value)" ${q.busy?"disabled":""}><option value="update">Aktualizuj istniejące oferty</option><option value="draft">Utwórz brakujące jako nieaktywne</option><option value="activate">Opublikuj / aktywuj sprzedaż</option><option value="withdraw">Zakończ powiązane oferty</option></select><button class="btn ghost" onclick="asortymentPrzygotujOperacjeZewnetrzna()" ${!selected||q.busy?"disabled":""}>Przygotuj decyzję</button><small>Najpierw zobaczysz zakres i osobne potwierdzenie.</small></article></div>${q.busy||q.finishedAt?`<div class="product-agent-progress" aria-live="polite"><progress max="${q.total||1}" value="${q.done}"></progress><div><b>${q.busy?`Agent: ${esc(q.current||"uruchamianie kolejki")}`:"Kolejka Agenta zakończona"}</b><small>${q.done}/${q.total} • poprawnie ${q.ok} • uwagi ${q.warnings} • błędy ${q.failed}${q.cancel?" • zatrzymywanie":""}</small></div>${q.busy?`<button class="btn ghost" onclick="asortymentAnulujAgenta()">Zatrzymaj po bieżącym</button>`:""}</div>`:""}${q.results.some(x=>!x.ok)?`<details class="product-agent-errors"><summary>Błędy kolejki (${q.failed})</summary>${q.results.filter(x=>!x.ok).slice(-10).map(x=>`<p><b>${esc(x.name)}</b> — ${esc(x.error)}</p>`).join("")}</details>`:""}${asortymentDecyzjaZewnetrznaHTML()}</section>`;
}
function asortymentMenuDzialanProduktuHTML(p={}){
  const offer=asortymentOfertaProduktu(p);return `<details class="product-row-action-menu"><summary class="btn ghost">⚡ Działania</summary><div><button onclick="asortymentUruchomAgentaDlaProduktu(${jsArg(p.id)},'pelna')">🤖 Pełna kontrola Agenta</button><button onclick="asortymentUruchomAgentaDlaProduktu(${jsArg(p.id)},'szkic')">📝 Przygotuj szkic Allegro</button><button onclick="asortymentUruchomAgentaDlaProduktu(${jsArg(p.id)},'prowizja')">📊 Pobierz prowizję</button>${offer?`<a href="https://allegro.pl/oferta/${encodeURIComponent(offer.id)}" target="_blank" rel="noopener">↗ Otwórz ofertę Allegro</a><button onclick="asortymentPrzygotujOperacjeZewnetrzna('update',${jsArg(p.id)})">🟠 Przygotuj aktualizację</button><button class="danger" onclick="asortymentPrzygotujOperacjeZewnetrzna('withdraw',${jsArg(p.id)})">⏹ Przygotuj zakończenie</button>`:`<button onclick="asortymentPrzygotujOperacjeZewnetrzna('draft',${jsArg(p.id)})">➕ Przygotuj ofertę nieaktywną</button>`}</div></details>`;
}
