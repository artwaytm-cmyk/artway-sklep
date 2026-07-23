const ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI=3;
function kodKanonicznyProduktu(p={}){return String(p.kodProducenta||p.numerReferencyjny||p.mpn||p.externalId||p.sku||"").trim();}
function domyslneUstawieniaRentownosci(){
  const raw=ustawienia.domyslneKosztyRentownosci&&typeof ustawienia.domyslneKosztyRentownosci==="object"?ustawienia.domyslneKosztyRentownosci:{};
  const money=(v,fallback=0)=>Math.max(0,Math.min(100000,kwotaNum(v??fallback))),percent=(v,fallback=0)=>Math.max(0,Math.min(100,Number(v??fallback)||0));
  return {kosztPakowania:money(raw.kosztPakowania),sklepAdditionalCost:money(raw.sklepAdditionalCost),sklepPaymentPercent:percent(raw.sklepPaymentPercent),allegroAdditionalCost:money(raw.allegroAdditionalCost),allegroShippingSubsidy:money(raw.allegroShippingSubsidy,ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI),allegroAdsPercent:percent(raw.allegroAdsPercent),vatRate:percent(raw.vatRate,23)};
}
function wartoscKosztuProduktu(p={},pole){const v=p?.[pole];return v!==undefined&&v!==null&&String(v).trim()!==""?Math.max(0,Number(v)||0):domyslneUstawieniaRentownosci()[pole];}
function domyslneKosztyDoProduktu(p={},wymus=false){const d=domyslneUstawieniaRentownosci(),next={...p};for(const [pole,value] of Object.entries(d))if(wymus||next[pole]===undefined||next[pole]===null||String(next[pole]).trim()==="")next[pole]=value;return next;}
function zastosujDomyslneKosztyProduktow(wymus=false){
  const defaults=domyslneUstawieniaRentownosci(),lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));let changed=0;
  for(const p of lista){const patch={};for(const [pole,value] of Object.entries(defaults))if(wymus||p[pole]===undefined||p[pole]===null||String(p[pole]).trim()==="")patch[pole]=value;if(!Object.keys(patch).length)continue;const key=String(p.id),idx=produktyDodane.findIndex(x=>String(x.id)===key);if(idx>=0)produktyDodane[idx]={...produktyDodane[idx],...patch};else produktyEdytowane={...produktyEdytowane,[key]:{...(produktyEdytowane[key]||{}),...patch}};changed++;}
  if(changed){zapiszLS("artway_produkty_dodane",produktyDodane);zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();zaplanujZapisUstawien();}
  return changed;
}
function zapiszDomyslneUstawieniaRentownosci(event){
  event.preventDefault();const form=event.currentTarget,mode=String(event.submitter?.value||"defaults");if(mode==="all"&&!confirm("Nadpisać koszty operacyjne we wszystkich aktywnych produktach aktualnymi wartościami domyślnymi? Ceny zakupu i prowizje z API nie zostaną zmienione."))return;
  const n=name=>Math.max(0,Number(String(form.elements[name]?.value||"0").replace(",","."))||0),pct=name=>Math.min(100,n(name));
  const defaults={kosztPakowania:n("kosztPakowania"),sklepAdditionalCost:n("sklepAdditionalCost"),sklepPaymentPercent:pct("sklepPaymentPercent"),allegroAdditionalCost:n("allegroAdditionalCost"),allegroShippingSubsidy:n("allegroShippingSubsidy"),allegroAdsPercent:pct("allegroAdsPercent"),vatRate:pct("vatRate")};
  sklepDocelowaMarza=Math.max(1,Math.min(60,n("celMarzySklep")||20));allegroDocelowaMarza=Math.max(1,Math.min(60,n("celMarzyAllegro")||20));vonHalskyDocelowaMarza=Math.max(1,Math.min(60,n("celMarzyVonHalsky")||allegroDocelowaMarza));allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Math.floor(n("allegroJednostkiOplatCyklicznych")||10)));
  ustawienia={...ustawienia,celMarzySklep:sklepDocelowaMarza,celMarzyAllegro:allegroDocelowaMarza,celMarzyVonHalsky:vonHalskyDocelowaMarza,allegroJednostkiOplatCyklicznych,domyslneKosztyRentownosci:defaults};zapiszLS("artway_ustawienia",ustawienia);zapiszLS("artway_cel_marzy_sklep",sklepDocelowaMarza);zapiszLS("artway_cel_marzy_allegro",allegroDocelowaMarza);
  const applyAll=mode==="all",applyMissing=applyAll||!!form.elements.applyMissing?.checked,changed=applyMissing?zastosujDomyslneKosztyProduktow(applyAll):0;zaplanujZapisUstawien();toast(`✅ Zapisano domyślne koszty i cele${applyMissing?` • zaktualizowano ${changed} produktów`:""}`);renderuj();
}
function domyslneUstawieniaRentownosciHTML(){const d=domyslneUstawieniaRentownosci();return `<details class="profit-defaults-panel" open><summary>⚙️ Domyślne koszty i cele</summary><form onsubmit="zapiszDomyslneUstawieniaRentownosci(event)"><p class="order-detail-lead">Te wartości są używane przy nowych produktach i wszędzie tam, gdzie kartoteka nie ma własnego kosztu. Wartość wpisana bezpośrednio w produkcie ma pierwszeństwo.</p><div class="profit-default-grid"><label>🏪 Cel marży sklepu (%)<input name="celMarzySklep" type="number" min="1" max="60" step="0.1" value="${esc(sklepDocelowaMarza)}"></label><label>🟠 Cel marży Allegro (%)<input name="celMarzyAllegro" type="number" min="1" max="60" step="0.1" value="${esc(allegroDocelowaMarza)}"></label><label>🐕 Cel marży Von Halsky (%)<input name="celMarzyVonHalsky" type="number" min="1" max="60" step="0.1" value="${esc(vonHalskyDocelowaMarza)}"></label><label>📦 Pakowanie / szt. (zł)<input name="kosztPakowania" inputmode="decimal" value="${esc(d.kosztPakowania)}"></label><label>🏪 Inne koszty sklepu / szt. (zł)<input name="sklepAdditionalCost" inputmode="decimal" value="${esc(d.sklepAdditionalCost)}"></label><label>💳 Płatność sklepu (% ceny)<input name="sklepPaymentPercent" inputmode="decimal" value="${esc(d.sklepPaymentPercent)}"></label><label>🟠 Inne koszty Allegro / szt. (zł)<input name="allegroAdditionalCost" inputmode="decimal" value="${esc(d.allegroAdditionalCost)}"></label><label>🚚 Dopłata do wysyłki Allegro (zł)<input name="allegroShippingSubsidy" inputmode="decimal" value="${esc(d.allegroShippingSubsidy)}"></label><label>📣 Reklama Allegro (% ceny)<input name="allegroAdsPercent" inputmode="decimal" value="${esc(d.allegroAdsPercent)}"></label><label>🧾 Domyślny VAT (%)<input name="vatRate" inputmode="decimal" value="${esc(d.vatRate)}"></label><label>🔁 Opłatę cykliczną podziel na (szt.)<input name="allegroJednostkiOplatCyklicznych" type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}"></label></div><label class="profit-default-check"><input type="checkbox" name="applyMissing" checked> Uzupełnij teraz tylko puste pola kosztowe w istniejących produktach</label><div class="diag-actions"><button class="btn" type="submit" value="defaults">💾 Zapisz ustawienia</button><button class="btn danger" type="submit" value="all">Zapisz i nadpisz koszty wszystkich produktów</button></div></form></details>`;}
function allegroRentownoscProduktu(p={},priceOverride=null,targetMargin=allegroDocelowaMarza){
  const price=kwotaNum(priceOverride??p.cenaAllegro??p.cena),purchase=kwotaNum(p.cenaZakupu),feePrice=kwotaNum(p.allegroFeePrice),savedCommission=kwotaNum(p.allegroCommissionAmount),savedRate=Math.max(0,Number(p.allegroCommissionRate)||0),commission=price>0?(feePrice&&Math.abs(feePrice-price)<.01?savedCommission:price*savedRate/100):0,recurringTotal=kwotaNum(p.allegroRecurringFees),recurringPerUnit=recurringTotal/Math.max(1,Number(allegroJednostkiOplatCyklicznych)||1),packing=wartoscKosztuProduktu(p,"kosztPakowania"),other=wartoscKosztuProduktu(p,"allegroAdditionalCost"),shipping=wartoscKosztuProduktu(p,"allegroShippingSubsidy"),adsRate=Math.max(0,wartoscKosztuProduktu(p,"allegroAdsPercent")),ads=price*adsRate/100,fixed=purchase+packing+other+shipping+recurringPerUnit,variableRate=savedRate/100+adsRate/100,profit=price-purchase-commission-recurringPerUnit-packing-other-shipping-ads,margin=price>0?profit/price*100:0,markup=purchase>0?profit/purchase*100:0,breakEven=1-variableRate>0?fixed/(1-variableRate):0,target=Math.max(0,Math.min(80,Number(targetMargin)||0))/100,recommended=1-variableRate-target>0?fixed/(1-variableRate-target):0;
  const dataComplete=purchase>0&&price>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))&&!!p.allegroFeeCalculatedAt;
  return {price,purchase,commission,commissionRate:savedRate,recurringTotal,recurringPerUnit,packing,other,shipping,ads,adsRate,profit:+profit.toFixed(2),margin:+margin.toFixed(2),markup:+markup.toFixed(2),breakEven:+breakEven.toFixed(2),recommended:+recommended.toFixed(2),dataComplete,feeCurrent:!!feePrice&&Math.abs(feePrice-price)<.01,positive:profit>0};
}
function sklepRentownoscProduktu(p={},priceOverride=null,targetMargin=sklepDocelowaMarza){
  const price=kwotaNum(priceOverride??p.cena),purchase=kwotaNum(p.cenaZakupu),packing=wartoscKosztuProduktu(p,"kosztPakowania"),other=wartoscKosztuProduktu(p,"sklepAdditionalCost"),paymentRate=Math.max(0,wartoscKosztuProduktu(p,"sklepPaymentPercent")),payment=price*paymentRate/100,fixed=purchase+packing+other,variableRate=paymentRate/100,profit=price-fixed-payment,margin=price>0?profit/price*100:0,markup=purchase>0?profit/purchase*100:0,breakEven=1-variableRate>0?fixed/(1-variableRate):0,target=Math.max(0,Math.min(80,Number(targetMargin)||0))/100,recommended=1-variableRate-target>0?fixed/(1-variableRate-target):0;
  return {price,purchase,packing,other,payment,paymentRate,profit:+profit.toFixed(2),margin:+margin.toFixed(2),markup:+markup.toFixed(2),breakEven:+breakEven.toFixed(2),recommended:+recommended.toFixed(2),dataComplete:purchase>0&&price>0};
}
function vonHalskyRentownoscProduktu(p={},priceOverride=null,targetMargin=vonHalskyDocelowaMarza){const price=kwotaNum(priceOverride)||kwotaNum(p.cenaVonHalsky)||kwotaNum(p.cenaAllegro)||kwotaNum(p.cena);return allegroRentownoscProduktu({...p,cenaAllegro:price},price,targetMargin);}
function ustawCelMarzy(kanal,value){const v=Math.max(1,Math.min(60,Number(value)||20));if(kanal==="sklep"){sklepDocelowaMarza=v;ustawienia={...ustawienia,celMarzySklep:v};zapiszLS("artway_cel_marzy_sklep",v);}else if(kanal==="vonHalsky"){vonHalskyDocelowaMarza=v;ustawienia={...ustawienia,celMarzyVonHalsky:v};}else{allegroDocelowaMarza=v;ustawienia={...ustawienia,celMarzyAllegro:v};zapiszLS("artway_cel_marzy_allegro",v);}zapiszLS("artway_ustawienia",ustawienia);zaplanujZapisUstawien();renderuj();}
function allegroZapiszProwizjeLokalnie(productId,summary={}){
  const patch={allegroCommissionAmount:kwotaNum(summary.commissionAmount),allegroCommissionRate:Number(summary.commissionRate)||0,allegroRecurringFees:kwotaNum(summary.recurringFees),allegroFeeTotal:kwotaNum(summary.totalPreviewFees),allegroFeePrice:kwotaNum(summary.salePrice),allegroFeeCurrency:summary.currency||"PLN",allegroFeeDetails:{commissions:summary.commissions||[],quotes:summary.quotes||[]},allegroFeeCalculatedAt:summary.calculatedAt||new Date().toISOString(),allegroFeeSource:summary.source||"allegro-offer-fee-preview"};
  zapiszPolaProduktuLokalnie(productId,patch,false);zaplanujZapisUstawien();return patch;
}
async function allegroPobierzProwizjeProduktu(productId,button=null,options={}){
  const form=button?.closest?.("form"),base=pobierzProduktAdmin(productId)||produkty.find(p=>String(p.id)===String(productId))||{},product=form?produktRoboczyAllegroZFormularza(form,productId,base):base,offer=allegroOfertaDlaProduktuSklepu(product),offerId=String(product.allegroOfferId||offer?.id||"").trim(),price=kwotaNum(form?.elements?.cenaAllegro?.value)||kwotaNum(product.cenaAllegro||product.cena);
  if(!price){toast("Uzupełnij cenę Allegro");return null;}if(button)button.disabled=true;
  try{if(!options.silent)toast("🟠 Pobieram aktualne prowizje i opłaty z Allegro…");const d=await chmura("allegro-fee-preview",{method:"POST",body:{productId:String(productId),product,offerId,price,save:true},timeout:90000});const patch=allegroZapiszProwizjeLokalnie(productId,d.summary||{});if(form){for(const [name,value] of Object.entries({allegroCommissionAmount:patch.allegroCommissionAmount,allegroCommissionRate:patch.allegroCommissionRate,allegroRecurringFees:patch.allegroRecurringFees,allegroFeePrice:patch.allegroFeePrice,allegroFeeCalculatedAt:patch.allegroFeeCalculatedAt}))if(form.elements[name])form.elements[name].value=value;aktualizujKalkulatorCenProduktu(form);}if(!options.silent)toast(`✅ Prowizja ${zl(patch.allegroCommissionAmount)} (${Number(patch.allegroCommissionRate).toFixed(2)}%) • opłaty cykliczne ${zl(patch.allegroRecurringFees)}`);if(!form&&!options.silent)renderuj();return d;}catch(e){if(!options.silent)toast("⚠️ Kalkulator opłat Allegro: "+(e.message||e));return null;}finally{if(button)button.disabled=false;}
}
async function allegroPobierzProwizjeMasowo(){
  const complete=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))).slice(0,25);if(!complete.length){toast("Brak produktów z pełnymi danymi do kalkulacji");return;}
  toast(`Pobieram prowizje dla ${complete.length} kompletnych produktów…`);let ok=0,fail=0;for(const p of complete){const r=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});r?ok++:fail++;}toast(`Kalkulacja prowizji zakończona: ${ok} poprawnie, ${fail} błędów`);renderuj();
}
async function ustawRekomendowanaCeneProduktu(productId,kanal,price,targetMargin=null){
  const value=kwotaNum(price);if(!value)return;const p=pobierzProduktAdmin(productId);if(!p)return;
  const appliedMargin=Number.isFinite(Number(targetMargin))?+Number(targetMargin).toFixed(2):null;
  if(kanal==="sklep"){zapiszPolaProduktuLokalnie(productId,{cena:value,sklepPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{sklepPriceTargetMargin:appliedMargin})},false);zaplanujZapisUstawien();toast(`✅ Cena w sklepie została ustawiona na ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`}`);renderuj();return;}
  if(kanal==="vonHalsky"){zapiszPolaProduktuLokalnie(productId,{cenaVonHalsky:value,vonHalskyPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{vonHalskyPriceTargetMargin:appliedMargin})},false);zaplanujZapisUstawien();const ok=await chmuraZapiszUstawienia();toast(ok?`🐕 Cena Von Halsky została ustawiona na ${zl(value)}`:"⚠️ Cena została zachowana lokalnie i oczekuje na ponowienie zapisu");renderuj();return;}
  zapiszPolaProduktuLokalnie(productId,{cenaAllegro:value,allegroPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{allegroPriceTargetMargin:appliedMargin}),allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},false);zaplanujZapisUstawien();toast(`🟠 Ustawiono ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`} i aktualizuję ofertę Allegro…`);
  const next={...p,cenaAllegro:value,allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI};await allegroSynchronizujPowiazanyProduktPoZapisie(next,{forceFees:true});renderuj();
}
function allegroUstawRekomendowanaCene(productId,price){return ustawRekomendowanaCeneProduktu(productId,"allegro",price);}
function aktualizujKalkulatorCenProduktu(form){
  if(!form)return;
  const sklep=kwotaNum(form.elements.cena?.value),allegro=kwotaNum(form.elements.cenaAllegro?.value)||sklep,zakup=kwotaNum(form.elements.cenaZakupu?.value);
  const el=form.querySelector("[data-product-margin]");if(!el)return;
  const product={cena:sklep,cenaAllegro:allegro,cenaZakupu:zakup,allegroCommissionAmount:form.elements.allegroCommissionAmount?.value,allegroCommissionRate:form.elements.allegroCommissionRate?.value,allegroRecurringFees:form.elements.allegroRecurringFees?.value,allegroFeePrice:form.elements.allegroFeePrice?.value||allegro,kosztPakowania:form.elements.kosztPakowania?.value,sklepAdditionalCost:form.elements.sklepAdditionalCost?.value,sklepPaymentPercent:form.elements.sklepPaymentPercent?.value,allegroAdditionalCost:form.elements.allegroAdditionalCost?.value,allegroShippingSubsidy:form.elements.allegroShippingSubsidy?.value||ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI,allegroAdsPercent:form.elements.allegroAdsPercent?.value,allegroFeeCalculatedAt:form.elements.allegroFeeCalculatedAt?.value},r=allegroRentownoscProduktu(product,allegro),s=sklepRentownoscProduktu(product,sklep);
  el.innerHTML=`<span><small>Sklep • cena</small><b>${sklep?zl(sklep):"—"}</b></span><span class="${s.profit<0?"is-negative":""}"><small>Sklep • zysk/marża</small><b>${zakup?`${zl(s.profit)} • ${s.margin.toFixed(1)}%`:"—"}</b></span><span><small>Sklep • cel ${sklepDocelowaMarza}%</small><b>${zakup?zl(s.recommended):"—"}</b></span><span><small>Allegro • cena</small><b>${allegro?zl(allegro):"—"}</b></span><span><small>Allegro • prowizja</small><b>${r.commission?`${zl(r.commission)} • ${r.commissionRate.toFixed(2)}%`:"—"}</b></span><span class="${r.profit<0?"is-negative":""}"><small>Allegro • zysk/marża</small><b>${zakup?`${zl(r.profit)} • ${r.margin.toFixed(1)}%`:"—"}</b></span><span><small>Allegro • cel ${allegroDocelowaMarza}%</small><b>${zakup?zl(r.recommended):"—"}</b></span>`;
}
function agentAIStanWdrozeniaProduktu(p={}){
  const checks=[
    {id:"identity",label:"EAN lub kod",ok:!!(p.gtin||p.ean||p.mpn||p.kodProducenta)},
    {id:"content",label:"Opis krótki i pełny",ok:!!(p.opisKrotki&&p.opis)},
    {id:"images",label:"Zdjęcie",ok:!!p.zdjecie},
    {id:"producer",label:"Producent",ok:poprawnaNazwaProducenta(p.producent||p.marka)},
    {id:"store",label:"Cena i kategoria sklepu",ok:!!(kwotaNum(p.cena)>0&&p.kategoria)},
    {id:"allegro",label:"Kategoria/katalog Allegro",ok:!!(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean))}
  ];
  return {checks,done:checks.filter(x=>x.ok).length,total:checks.length,ready:checks.every(x=>x.ok)};
}
function agentAIWdrozenieProduktuHTML(p={},edycja=false){
  const state=agentAIStanWdrozeniaProduktu(p),specialists=typeof agentAISpecjalisci!=="undefined"?(agentAISpecjalisci.data||{}):{},history=Array.isArray(specialists.history)?specialists.history:[],pending=null,latest=history.find(x=>x.target?.type==="product"&&String(x.target?.productId)===String(p.id)),learning=specialists.learning?.productContent||{},status=p.agentOnboardingStatus||(!p.id?"new":"not_started"),busy=status==="processing",editorial=p.contentEditorial||{};
  const activity=pending?`Starszy wyjątek jest automatycznie przenoszony do ponownej redakcji — niczego nie musisz zatwierdzać.`:editorial.status==="retry_pending"?`Agent odrzucił niepoprawny wynik i sam ponowi redakcję ${editorial.retryAt?agentAIRuntimeCzas(editorial.retryAt):"w następnym cyklu"}.`:editorial.status==="ready"?`Redakcja została automatycznie zapisana ${editorial.preparedAt?agentAIRuntimeCzas(editorial.preparedAt):"wcześniej"}${p.allegroEditorialSyncState==="synced"?" i zsynchronizowana z Allegro":p.allegroEditorialSyncPending?"; aktualizacja istniejącej oferty Allegro czeka w kolejce":""}.`:(specialists.updatedAt?"Agent kontroluje katalog co 15 minut i sam zapisuje kompletne, bezpieczne opisy.":"Łączę kartę produktu z rejestrem pracy Agenta…");
  return `<section class="product-agent-onboarding ${pending?"needs-decision":state.ready?"is-ready":busy?"is-busy":"needs-work"}" data-product-agent-card="${esc(p.id||"")}"><header><div><span class="order-pro-label">Najwyższy priorytet przy dodawaniu • Agent redakcji • cykl 15 min</span><h3>${pending?"✨ Agent pyta o Twoją decyzję":"🤖 Agent wdrożenia produktu"}</h3><p>${esc(activity)}</p></div><strong>${pending?"?":`${state.done}/${state.total}`}</strong></header><div class="product-agent-checks">${state.checks.map(x=>`<span class="${x.ok?"done":"wait"}">${x.ok?"✓":"○"} ${esc(x.label)}</span>`).join("")}</div><div class="product-agent-learning"><span>🧠</span><div><b>Automatyczna redakcja jest aktywna</b><small>Nie wymaga zatwierdzeń; Twoje późniejsze korekty uczą Agenta wyłącznie preferowanego stylu.</small></div><a href="#/admin/agent-ai/specjalisci">Pełna pamięć i historia →</a></div>${pending?`<div class="product-agent-pending">${agentAISpecjalistaDecyzjaHTML(pending)}</div>`:""}<footer><small>${pending?"Starszy wyjątek zostanie zamknięty automatycznie.":state.ready?"Kompletność podstawowa jest prawidłowa; Agent nadal ocenia jakość tekstu.":"Brakujące pola pozostają widoczne, a redakcja działa w tle."}</small>${edycja&&!pending?`<button class="btn" type="button" onclick="agentAIUruchomWdrozenieProduktu(${jsArg(p.id)},this)" ${busy?"disabled":""}>${busy?"⏳ Przygotowuję…":"✨ Przygotuj teraz"}</button>`:""}</footer></section>`;
}
async function agentAIUruchomWdrozenieProduktu(id,button=null){
  const product=pobierzProduktAdmin(id);if(!product)return null;
  if(button)button.disabled=true;agentAISpecjalisci={...agentAISpecjalisci,running:true};renderuj();
  try{const textRun=await agentAISpecjalistaProduktWdrozenie(product);await chmuraWczytajStan().catch(()=>{});const status=textRun?.approvalStatus==="auto_applied"?"saved":"automatic_retry";toast(status==="saved"?"✅ Agent poprawił i zapisał treści produktu":"↻ Wynik nie przeszedł kontroli — Agent ponowi zadanie automatycznie");return {status,textRun};}
  catch(error){toast("⚠️ Agent redakcji: "+(error?.message||error));return {status:"error",error};}
  finally{agentAISpecjalisci={...agentAISpecjalisci,running:false};if(button)button.disabled=false;renderuj();}
}
function formularzProduktu(p, tryb){
  p=domyslneKosztyDoProduktu(p||{},false);
  const wszystkie = produktyDoAdministracji();
  const edycja = tryb==="edycja";
  if(edycja&&typeof agentAISpecjalisci!=="undefined"&&!agentAISpecjalisci.loaded&&!agentAISpecjalisci.loading)setTimeout(()=>agentAISpecjalisciPobierz(true),0);
  if(edycja&&typeof agentAISpecjalisciPolling==="function")setTimeout(()=>agentAISpecjalisciPolling(),0);
  const kontrolaDodawania=edycja?null:produktDodawanieStanKontroli(p,{});
  const maTozsamoscProduktu=!!(p.allegroOfferId||p.allegroProductId||p.gtin||p.ean||p.externalId||p.sku||p.nazwa);
  const ofertaAllegro=maTozsamoscProduktu?allegroOfertaDlaProduktuSklepu(p):null,ofertaAllegroId=String(p.allegroOfferId||ofertaAllegro?.id||"").trim(),ofertaAllegroStatus=String(ofertaAllegro?.status||ofertaAllegro?.publication?.status||"").toUpperCase(),domyslnaPublikacjaAllegro=ofertaAllegroStatus==="ACTIVE"?"keep":"activate",rentownosc=allegroRentownoscProduktu(p),rentownoscSklep=sklepRentownoscProduktu(p),seoDanePodgladu=seoEfektywneDaneProduktu(p);
  return `
    <form class="product-editor-form" data-product-id="${esc(p.id||0)}" ${!edycja?`data-product-add-form data-product-duplicate-fingerprint="${esc(kontrolaDodawania.fingerprint)}" oninput="produktDodawanieZmienione(event,this)" onchange="produktDodawanieZmienione(event,this)"`:""} onsubmit="${edycja?`zapiszProduktAdmin(event,${jsArg(p.id)})`:"dodajProdukt(event)"}">
      ${productEditorNaglowekHTML(p,edycja)}
      ${agentAIWdrozenieProduktuHTML(p,edycja)}
      ${!edycja?`<section class="product-add-control" data-product-add-control>${produktDodawanieKontrolaHTML(p,{})}</section>`:""}
      ${!edycja?`<section class="product-link-one-workspace product-link-inline-workspace"><div class="order-section-head"><div><span class="order-pro-label">Opcjonalne automatyczne uzupełnienie</span><h3>🔗 Pobierz dane z linku produktu</h3><p class="order-detail-lead">Wklej adres konkretnego produktu albo od razu wypełnij formularz ręcznie. Agent jedynie uzupełni pola — nic nie zostanie dodane bez Twojego zatwierdzenia na dole formularza.</p></div><span class="lvl lvl-ok">bez automatycznego zapisu</span></div><label for="oneProductUrl">Adres konkretnego produktu</label><div class="product-link-one-input"><input id="oneProductUrl" data-one-link-url name="producentUrl" type="url" value="${esc(p.producentUrl||p.sourceUrl||"")}" placeholder="https://strona-producenta.pl/konkretny-produkt"><button class="btn" type="button" onclick="pobierzDaneProduktuZUrl(this)">🤖 Pobierz i uzupełnij formularz</button></div><label class="check product-link-overwrite"><input type="checkbox" name="nadpiszImportUrl"> Nadpisz również pola wpisane przeze mnie</label><small>Po pobraniu sprawdź nazwę, cenę, opis, zdjęcia i kody. Dopiero przycisk „Zatwierdź i dodaj produkt” zapisze kartotekę.</small><div data-product-link-agent-result></div></section>`:""}
      <section class="product-editor-section product-editor-basics" id="product-editor-basics"><header class="product-editor-section-head"><div><span>Tożsamość produktu</span><h2>Podstawowe informacje</h2><p>Nazwa i kategoria są wspólnym punktem odniesienia dla sklepu, wyszukiwania, magazynu i integracji.</p></div></header><div class="f-row">
        <div class="f-group"><label>Nazwa *</label><input required name="nazwa" value="${esc(p.nazwa||"")}"></div>
        <div class="f-group"><label>Kategoria *</label><input required name="kategoria" list="katLista" placeholder="np. Elektronika" value="${esc(p.kategoria||kategoriaNowegoProduktu)}">
          <datalist id="katLista">${[...new Set([...wszystkieKategorie(), ...wszystkie.map(x=>x.kategoria)])].map(k=>`<option value="${esc(k)}">`).join("")}</datalist></div>
      </div></section>
      ${productEditorTrescHTML(p)}
      ${productEditorVonHalskyTrescHTML(p)}
      <section class="product-editor-section product-editor-pricing" id="product-editor-prices"><header class="product-editor-section-head"><div><span>Sprzedaż i rentowność</span><h2>Ceny oraz koszty kanałów</h2><p>Ceny sklepu i Allegro są rozdzielone, natomiast prywatne koszty zakupu pozostają widoczne wyłącznie dla administratora.</p></div></header>
      <div class="product-price-grid">
        <div class="f-group"><label>Cena w sklepie (zł) *</label><input required name="cena" inputmode="decimal" value="${p.cena??""}" placeholder="99.99" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div>
        <div class="f-group"><label>Cena na Allegro (zł)</label><input name="cenaAllegro" inputmode="decimal" value="${p.cenaAllegro??""}" placeholder="pusta = cena sklepu" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Ta cena jest wysyłana do oferty Allegro.</small></div>
        <div class="f-group"><label>Cena Von Halsky (zł)</label><input name="cenaVonHalsky" inputmode="decimal" value="${p.cenaVonHalsky??""}" placeholder="pusta = cena Allegro" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Domyślnie kanał dziedziczy cenę Allegro.</small></div>
        <div class="f-group"><label>🔒 Cena zakupu brutto (zł) — tylko administrator</label><input name="cenaZakupu" inputmode="decimal" value="${p.cenaZakupu??""}" placeholder="wewnętrzna" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Dane prywatne: niewidoczne dla klientów i Allegro, usuwane z publicznego API, products.json, Google/SEO i publikacji sklepu.${p.cenaZakupuNetto!=null?`<br>Netto z faktury: ${zl(p.cenaZakupuNetto)} • VAT: ${zl(p.cenaZakupuVat||0)}`:""}${p.cenaZakupuZrodlo?`<br>Źródło: ${esc(p.cenaZakupuZrodlo)} • ${esc(p.cenaZakupuDokument||"")} • ${esc(p.cenaZakupuDostawca||"")} • ${esc(p.cenaZakupuDataDokumentu||"")} • ${esc(p.cenaZakupuDopasowanie||"")}`:""}</small></div>
        <div class="f-group"><label>Stara cena (promocja)</label><input name="staraCena" inputmode="decimal" value="${p.staraCena??""}"></div>
      </div>
      <div class="product-margin-preview" data-product-margin><span><small>Sklep • cena</small><b>${p.cena?zl(p.cena):"—"}</b></span><span class="${rentownoscSklep.profit<0?"is-negative":""}"><small>Sklep • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownoscSklep.profit)} • ${rentownoscSklep.margin.toFixed(1)}%`:"—"}</b></span><span><small>Sklep • cel ${sklepDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownoscSklep.recommended):"—"}</b></span><span><small>Allegro • cena</small><b>${rentownosc.price?zl(rentownosc.price):"—"}</b></span><span><small>Allegro • prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(rentownosc.commission)} • ${rentownosc.commissionRate.toFixed(2)}%`:"—"}</b></span><span class="${rentownosc.profit<0?"is-negative":""}"><small>Allegro • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownosc.profit)} • ${rentownosc.margin.toFixed(1)}%`:"—"}</b></span><span><small>Allegro • cel ${allegroDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownosc.recommended):"—"}</b></span></div>
      <section class="product-profit-editor"><div class="order-section-head"><div><span class="order-pro-label">Dane wewnętrzne</span><h3>📈 Koszty sklepu i Allegro</h3><p class="order-detail-lead">Kanały są liczone oddzielnie. Prowizja jest pobierana z oficjalnego kalkulatora Allegro, a sklep ma własne koszty płatności i obsługi.</p></div><div class="diag-actions">${edycja?`<button class="btn" type="button" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">🟠 Pobierz prowizję</button>`:""}${ofertaAllegroId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(ofertaAllegroId)}" target="_blank" rel="noopener">↗ Otwórz ofertę</a>`:""}<a class="btn ghost" href="#/admin/allegro/rentownosc">Kalkulator marży</a></div></div><input type="hidden" name="allegroFeePrice" value="${esc(p.allegroFeePrice??p.cenaAllegro??p.cena??"")}"><div class="product-profit-fields"><div class="f-group"><label>Prowizja Allegro (zł)</label><input name="allegroCommissionAmount" inputmode="decimal" value="${esc(p.allegroCommissionAmount??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Kwota dla ceny ${p.allegroFeePrice?zl(p.allegroFeePrice):"—"}.</small></div><div class="f-group"><label>Prowizja Allegro (%)</label><input name="allegroCommissionRate" inputmode="decimal" value="${esc(p.allegroCommissionRate??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Opłaty Allegro cykliczne (zł)</label><input name="allegroRecurringFees" inputmode="decimal" value="${esc(p.allegroRecurringFees??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt pakowania / szt. (oba kanały)</label><input name="kosztPakowania" inputmode="decimal" value="${esc(p.kosztPakowania??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Inne koszty sklepu / szt.</label><input name="sklepAdditionalCost" inputmode="decimal" value="${esc(p.sklepAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt płatności sklepu (% ceny)</label><input name="sklepPaymentPercent" inputmode="decimal" value="${esc(p.sklepPaymentPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Inne koszty Allegro / szt.</label><input name="allegroAdditionalCost" inputmode="decimal" value="${esc(p.allegroAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Dopłata do wysyłki Allegro / szt.</label><input name="allegroShippingSubsidy" inputmode="decimal" value="${esc(p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI)}" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Domyślnie zawsze 3,00 zł.</small></div><div class="f-group"><label>Reklama Allegro (% ceny)</label><input name="allegroAdsPercent" inputmode="decimal" value="${esc(p.allegroAdsPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>VAT sprzedaży (%)</label><input name="vatRate" inputmode="decimal" value="${esc(p.vatRate??23)}"></div><div class="f-group"><label>Ostatnie wyliczenie API</label><input name="allegroFeeCalculatedAt" value="${esc(p.allegroFeeCalculatedAt||"")}" readonly><small>${p.allegroFeeCalculatedAt?esc(allegroDataTxt(p.allegroFeeCalculatedAt)):"jeszcze nie pobrano"}</small></div></div><div class="profit-channel-grid"><article><small>Sklep • zysk / marża</small><b>${p.cenaZakupu?`${zl(rentownoscSklep.profit)} • ${rentownoscSklep.margin.toFixed(2)}%`:"—"}</b><span>Cel ${sklepDocelowaMarza}%: ${p.cenaZakupu?zl(rentownoscSklep.recommended):"—"}</span></article><article><small>Allegro • zysk / marża</small><b>${p.cenaZakupu?`${zl(rentownosc.profit)} • ${rentownosc.margin.toFixed(2)}%`:"—"}</b><span>Cel ${allegroDocelowaMarza}%: ${p.cenaZakupu?zl(rentownosc.recommended):"—"}</span></article></div></section></section>
      <section class="product-editor-section product-editor-media" id="product-editor-media"><header class="product-editor-section-head"><div><span>Prezentacja</span><h2>Media, etykieta i warianty</h2><p>Zdjęcie główne jest używane na listach, a galeria na karcie produktu i w ofercie Allegro.</p></div></header><div class="f-row">
        <div class="f-group"><label>Etykieta</label><select name="badge"><option value="">— brak —</option><option ${p.badge==="Nowość"?"selected":""}>Nowość</option><option ${p.badge==="Promocja"?"selected":""}>Promocja</option></select></div>
        <div class="f-group"><label>Ikona (emoji)</label>${emojiPoleHTML("ikona",p.ikona||"","📦")}</div>
        <div class="f-group"><label>Zdjęcie — link lub wgraj z dysku</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie" value="${esc(p.zdjecie||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML("wgrajZdjecieProduktu(this)", "Z dysku")}
          </div>
        </div>
      </div>
      <div id="podgladZdjecia">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="Podgląd ${esc(p.nazwa||'produktu')}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:.6rem">`:""}</div>
      <details ${p.zdjecia?.length?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🖼️ Galeria — ręczna edycja do 16 zdjęć</summary>
        ${Array.from({length:15},(_,i)=>i+2).map(n=>`
        <div class="f-group" style="margin-top:.6rem"><label>Zdjęcie ${n}</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie${n}" value="${esc((p.zdjecia||[])[n-2]||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML(`wgrajZdjecieDoPola(this,'zdjecie${n}')`, "Z dysku")}
          </div>
        </div>`).join("")}
      </details>
      <div class="f-group"><label>Warianty <small style="font-weight:400;color:var(--muted2)">po przecinku, np. S, M, L, XL</small></label><input name="warianty" value="${esc((p.warianty||[]).join(", "))}" placeholder="np. S, M, L, XL albo Czarny, Biały"></div></section>
      <details id="product-editor-source" class="product-editor-section" ${(p.gtin||p.externalId||p.mpn||p.producent||p.marka||p.kolorProduktu||p.rozmiar||p.material)?"open":""}>
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🏷️ Dane z hurtowni / OVF</summary>
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>GTIN / EAN</label><input name="gtin" value="${esc(p.gtin||p.ean||"")}" placeholder="np. 5901234567891"></div>
          <div class="f-group"><label>Kod produktu / producenta</label><input name="kodProducenta" value="${esc(kodKanonicznyProduktu(p))}" placeholder="np. 0006 lub kod katalogowy" maxlength="160"><small>Jedno pole kanoniczne. System przekazuje tę samą wartość jako SKU, EXTERNAL_ID i MPN do starszych importów oraz Allegro.</small></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Producent *</label><input required name="producent" list="allegroProducerList" value="${esc(normalizujNazweProducenta(allegroProducentKanoniczny(p)||p.producent||p.marka||""))}" placeholder="np. Alexander" oninput="walidujPoleProducenta(this)" pattern=".*[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż].*" title="Podaj nazwę zawierającą co najmniej jedną literę"><datalist id="allegroProducerList">${allegroListaProducentow().filter(poprawnaNazwaProducenta).map(name=>`<option value="${esc(name)}">`).join("")}</datalist><small>Wpisz rzeczywistą nazwę, np. Alexander. Numer referencyjny należy do pola kodu produktu.</small></div>
          <div class="f-group"><label>Marka / BRAND</label><input name="marka" value="${esc(normalizujNazweProducenta(p.marka||""))}" oninput="walidujPoleProducenta(this)" pattern=".*[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż].*" title="Marka musi zawierać co najmniej jedną literę"></div>
          <div class="f-group"><label>Kolor produktu / COLOR</label><input name="kolorProduktu" value="${esc(p.kolorProduktu||"")}" placeholder="np. Czarny matowy"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Rozmiar / SIZE</label><input name="rozmiar" value="${esc(p.rozmiar||"")}" placeholder="np. XL lub 85x60x60 cm"></div>
          <div class="f-group"><label>Materiał / MATERIAL</label><input name="material" value="${esc(p.material||"")}" placeholder="np. bawełna, karton, stal"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Dostępność u producenta</label><input name="dostepnoscProducenta" value="${esc(p.dostepnoscProducenta||"")}" placeholder="dostępny / niedostępny / do sprawdzenia"></div>
          <div class="f-group"><label>Zweryfikowane źródło produktu</label>${edycja?`${p.sourceUrl||p.producentUrl?`<input name="sourceUrl" value="${esc(p.sourceUrl||p.producentUrl||"")}" readonly>`:`<input type="hidden" name="sourceUrl" value="">`}<input type="hidden" name="producentUrl" value="${esc(p.producentUrl||p.sourceUrl||"")}"><small>Adres pochodzi z kartoteki produktu.</small>`:`<input type="hidden" name="sourceUrl" value="${esc(p.sourceUrl||p.producentUrl||"")}"><small>Źródło uzupełnia się z pola na górze formularza.</small>`}</div>
        </div>
        <input type="hidden" name="stanProducenta" value="${esc(p.stanProducenta??"")}"><input type="hidden" name="stanProducentaDokladny" value="${p.stanProducentaDokladny?"1":""}"><input type="hidden" name="stanProducentaZrodlo" value="${esc(p.stanProducentaZrodlo||"")}"><input type="hidden" name="producentStatus" value="${esc(p.producentStatus||"")}"><input type="hidden" name="producentSprawdzonoAt" value="${esc(p.producentSprawdzonoAt||"")}">
        <div class="supplier-editor-status">${producentDostepnoscBadgeHTML(p)}${edycja&&/^https?:\/\//i.test(String(p.producentUrl||p.sourceUrl||""))?`<button class="btn ghost" type="button" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź stan u producenta</button>`:""}</div>
        ${p.sourceEvidence?.canonicalUrl||p.sourceEvidence?.url?`<div class="product-source-evidence"><div><span>🔎 Zweryfikowane źródło danych</span><b>${esc(p.sourceEvidence.host||(()=>{try{return new URL(p.sourceEvidence.canonicalUrl||p.sourceEvidence.url).hostname;}catch(e){return "strona produktu";}})())}</b><small>Odczyt: ${esc(p.sourceEvidence.fetchedAt?new Date(p.sourceEvidence.fetchedAt).toLocaleString("pl-PL"):"brak daty")} • pewność Agenta ${esc(p.agentImportConfidence||0)}%</small></div><a class="btn ghost" href="${esc(p.sourceEvidence.canonicalUrl||p.sourceEvidence.url)}" target="_blank" rel="noopener">Otwórz źródło ↗</a><details><summary>Pobrane informacje (${esc((p.sourceEvidence.fields||[]).length)})</summary><p>${esc((p.sourceEvidence.fields||[]).join(" • ")||"nazwa • cena • opis • zdjęcia • parametry • dostępność")}</p></details></div>`:""}
        ${Object.keys(p.parametryZrodla||p.parametryProducenta||{}).length?`<details class="product-source-parameters"><summary>📋 Wszystkie parametry ze źródła</summary><dl>${Object.entries(p.parametryZrodla||p.parametryProducenta||{}).filter(([,value])=>String(value??"").trim()).map(([label,value])=>`<div><dt>${esc(String(label).replace(/_/g," "))}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></details>`:""}
      </details>
      <details id="product-editor-allegro" class="product-editor-section" ${(p.allegroCategoryId||p.allegroProductId||p.allegroOfferId)?"open":""}>
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🟠 Allegro — dane do wystawienia</summary>
        ${allegroOstatniWynikWystawienia?.produktId===String(p.id)?allegroWynikOperacjiHTML():""}
        <div class="backend-note" style="margin-top:.7rem"><b>Status produktu:</b> ${allegroStatusProduktuHTML(p)}<br>${typeof asortymentStatusPrzygotowaniaHTML==="function"?asortymentStatusPrzygotowaniaHTML(p):""}<small>Agent zapisuje w kartotece poprawione opisy, identyfikatory, kategorię, katalog, parametry, zdjęcia i wynik walidacji. Istniejąca oferta zostanie zaktualizowana, a nie powielona.</small></div>
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>ID kategorii Allegro *</label><input name="allegroCategoryId" value="${esc(p.allegroCategoryId||"")}" placeholder="wymagane do wystawienia"></div>
          <div class="f-group"><label>ID produktu Allegro</label><input name="allegroProductId" value="${esc(p.allegroProductId||"")}" placeholder="opcjonalnie, jeśli znany"></div>
          <div class="f-group"><label>ID oferty Allegro</label><input name="allegroOfferId" value="${esc(p.allegroOfferId||"")}" placeholder="uzupełni się po wystawieniu"></div>
        </div>
        <div class="f-group"><label>Tytuł oferty Allegro <small>12–75 znaków, minimum 3 słowa</small></label><input name="allegroTitle" maxlength="75" value="${esc(p.allegroTitle||"")}" placeholder="Agent utworzy zgodny tytuł z nazwy, producenta i kategorii"><small>Jeśli pole pozostanie puste, Agent zapisze bezpieczny tytuł przed wystawieniem. Możesz go później zmienić ręcznie.</small></div>
        <div class="f-row">
          <div class="f-group"><label>Szukaj w katalogu Allegro</label><input name="allegroCategoryPhrase" value="${esc(p.allegroCategoryPhrase||"")}" placeholder="np. gry planszowe, zabawki kreatywne albo nazwa produktu"></div>
          <div class="f-group"><label>Dobieranie kategorii</label><button class="btn ghost" type="button" onclick="allegroDobierzKategorieProduktu(${edycja?jsArg(p.id):"0"},this)">🔎 Dobierz kategorię Allegro</button></div>
        </div>
        <div id="allegroCategoryPreview"></div>
        <div class="f-row">
          <div class="f-group"><label>Stan oferty Allegro <small style="font-weight:400;color:var(--muted2)">(ustawienie globalne; nie zmienia magazynu)</small></label><input name="allegroStock" type="number" value="${allegroStanOfertyProduktu()}" readonly><small>Każda oferta otrzymuje ${allegroStanOfertyProduktu()} szt. i automatyczne wznawianie. Zmienisz to w Ustawieniach Allegro.</small></div>
          <div class="f-group"><label>Co zrobić na Allegro</label><select id="allegroPublicationAction"><option value="activate" ${domyslnaPublikacjaAllegro==="activate"?"selected":""}>Zapisz i aktywuj sprzedaż</option><option value="keep" ${domyslnaPublikacjaAllegro==="keep"?"selected":""}>Tylko zaktualizuj — zachowaj obecny status</option><option value="deactivate">Zapisz i wyłącz sprzedaż</option></select><small>${ofertaAllegroId?`Obecny status Allegro: <b>${esc(ofertaAllegroStatus||"nieznany")}</b>.`:"Produkt nie ma jeszcze oferty — domyślnie zostanie wystawiony aktywnie."} Wynik zostanie ponownie odczytany bezpośrednio z Allegro.</small></div>
        </div>
        <div class="diag-actions">
          ${edycja?`<button class="btn ghost" type="button" onclick="allegroPrzygotujSzkicProduktu(${jsArg(p.id)})">🤖 Przygotuj i zapisz dane do Allegro</button>
          <button class="btn" type="button" onclick="allegroWystawProdukt(${jsArg(p.id)})">${ofertaAllegroStatus==="ACTIVE"?"🟠 Zapisz i zaktualizuj aktywną ofertę":ofertaAllegroId?"🚀 Zapisz i aktywuj ofertę":"🚀 Przygotuj i wystaw produkt"}</button>${ofertaAllegroId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(ofertaAllegroId)}" target="_blank" rel="noopener">↗ Otwórz istniejącą ofertę</a>`:""}`:`<span style="color:var(--muted2);font-size:.85rem">Najpierw zapisz produkt, potem Agent przygotuje i trwale zapisze komplet danych Allegro.</span>`}
        </div>
        <div id="allegroDraftPreview"></div>
        <div id="allegroDescriptionPreview"></div>
      </details>
      <details id="product-editor-seo" ${(p.seoTitle||p.seoDescription)?"open":""} class="product-seo-editor product-editor-section">
        <summary>📣 Pozycjonowanie produktu</summary>
        <p class="order-detail-lead">Produkt automatycznie otrzymuje komplet metadanych do sklepu, Google, Open Graph, danych Product/Offer, mapy strony i feedu produktowego. Wybierz tryb ręczny tylko wtedy, gdy chcesz chronić własną treść przed regeneracją.</p>
        <div class="f-group"><label>Tryb pozycjonowania</label><select name="seoMode"><option value="auto" ${seoDanePodgladu.seoMode!=="manual"?"selected":""}>⚙️ Automatyczny — aktualizuj razem z produktem</option><option value="manual" ${seoDanePodgladu.seoMode==="manual"?"selected":""}>✍️ Ręczny — zachowaj treść administratora</option></select></div>
        <div class="f-group"><label>Tytuł SEO <small>najlepiej 30–60 znaków</small></label><input name="seoTitle" maxlength="70" value="${esc(seoDanePodgladu.seoTitle)}" placeholder="Nazwa produktu – producent"></div>
        <div class="f-group"><label>Opis SEO <small>najlepiej 80–160 znaków</small></label><textarea name="seoDescription" rows="3" maxlength="180" placeholder="Konkretny opis korzyści i zawartości produktu.">${esc(seoDanePodgladu.seoDescription)}</textarea></div>
        <div class="f-group"><label>Frazy pomocnicze</label><input name="seoKeywords" maxlength="500" value="${esc(seoDanePodgladu.seoKeywords)}" placeholder="nazwa, kategoria, producent, kod"></div>
        <div class="backend-note"><b>Automatyczne pokrycie:</b> sklep • Google • Open Graph • schema Product/Offer • sitemap • feed produktowy.<br><b>Wynik bieżącej kartoteki:</b> ${seoScoreBadge(seoOcenaProduktu(seoDanePodgladu).score)} • ostatnia kontrola: ${p.seoReviewedAt?esc(allegroDataTxt(p.seoReviewedAt)):"automatycznie przy zapisie"}</div>
      </details>
      <section class="product-editor-section product-editor-stock" id="product-editor-stock"><div class="f-group"><label>Stan magazynowy <small style="font-weight:400;color:var(--muted2)">(nowy produkt = 0 szt.)</small></label><input name="stan" inputmode="numeric" min="0" placeholder="0" value="${p.id!==undefined && stanyProduktow[p.id]!==undefined ? stanyProduktow[p.id] : 0}"></div><div class="product-editor-stock-note"><b>Magazyn jest niezależny od dostępności sprzedaży.</b><br>Zmiana stanu zapisuje korektę magazynową. Dostępność u producenta i aktywność kanałów pozostają kontrolowane przez właściwe moduły.</div></section>
      <div class="diag-actions product-editor-actions">
        <button class="btn" type="submit" data-product-final-approval ${!edycja&&!kontrolaDodawania.canSubmit?`disabled title="Najpierw uzupełnij dane i zakończ kontrolę duplikatów"`:""}>${edycja?"💾 Zapisz zmiany":"✅ Zatwierdź i dodaj produkt"}</button>
        <a class="btn ghost" href="#/admin/produkty">Anuluj</a>
        ${edycja?`<button class="btn ghost" type="button" onclick="duplikujProdukt(${jsArg(p.id)})">📄 Duplikuj</button>`:""}
        ${edycja?`<button class="btn danger" type="button" onclick="if(confirm('Przenieść ten produkt do kosza na 30 dni?')){usunProduktAdmin(${jsArg(p.id)});location.hash='#/admin/produkty'}">🗑️ Przenieś do kosza</button>`:""}
        ${edycja && produktyEdytowane[p.id]?`<button class="btn danger" type="button" onclick="resetujEdycjeProduktu(${jsArg(p.id)})">↩️ Przywróć dane z products.json</button>`:""}
      </div>
    </form>`;
}
function widokAdminProduktyDodaj(){
  const params=parametryTrasy(),agentPrepared=params.get("agent")==="1";let prefill={};
  if(agentPrepared){try{prefill=JSON.parse(sessionStorage.getItem("artway_prefill_product")||"{}")||{};}catch(e){prefill={};}}
  else try{sessionStorage.removeItem("artway_prefill_product");}catch(e){}
  agentAIImportUrlStan={busy:false,data:null,selected:-1,error:""};
  const category=String(params.get("kategoria")||"").trim(),sourceUrl=String(params.get("url")||prefill._agentLinkUrl||prefill.producentUrl||prefill.sourceUrl||"").trim();
  if(/^https?:\/\//i.test(sourceUrl)){prefill.producentUrl=sourceUrl;prefill.sourceUrl=prefill.sourceUrl||sourceUrl;}
  if(category&&!prefill.kategoria)prefill.kategoria=category;
  kategoriaNowegoProduktu=category;
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Dodaj</div>
      <h1>➕ Dodaj produkt</h1>
      <div class="backend-note"><b>Jedna strona dodawania.</b> Możesz pobrać dane z linku albo wypełnić tę samą kartotekę ręcznie. Agent nie zapisuje produktu automatycznie — ostatnia decyzja zawsze należy do administratora.</div>
      ${formularzProduktu(prefill, "dodawanie")}
      <p style="font-size:.8rem;color:var(--muted2);margin-top:.7rem">Produkt trafi do wspólnej bazy dopiero po kliknięciu „Zatwierdź i dodaj produkt”. Stan magazynowy nowego produktu pozostaje równy 0, dopóki go nie zmienisz.</p>
    </div>`);
}
function widokAdminProduktyZLinku(){
  return widokAdminProduktyDodaj();
}
function widokAdminProduktEdytuj(id){
  const p = pobierzProduktAdmin(id);
  if(!p) return asortymentSzkielet("produkty", `<div class="panel"><h1>Nie znaleziono produktu</h1><p><a href="#/admin/produkty">← Wróć do produktów</a></p></div>`);
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Edycja › ${esc(p.nazwa)}</div>
      <h1>✏️ Edytuj produkt #${p.id}</h1>
      ${formularzProduktu(p, "edycja")}
    </div>`);
}
function daneProduktuZFormularza(f, id, poprzedni={}){
  const cena = parseFloat(String(f.get("cena")).replace(",","."));
  if(!(cena>0)) return null;
  const p = {
    ...poprzedni,
    id,
    nazwa:String(f.get("nazwa")).trim(),
    kategoria:String(f.get("kategoria")).trim()||"Inne",
    cena:+cena.toFixed(2),
    opisKrotki:String(f.get("opisKrotki")||"").trim(),
    opis:String(f.get("opis")||"").trim(),
    ikona:String(f.get("ikona")||"").trim()||"📦",
    kolor:poprzedni.kolor||"#dbeafe"
  };
  const vonHalskyContentMode=String(f.get("vonHalskyContentMode")||"store")==="custom"?"custom":"store";
  p.vonHalskyContentMode=vonHalskyContentMode;
  if(vonHalskyContentMode==="custom"){
    for(const pole of ["vonHalskyTitle","vonHalskyShortDescription","vonHalskyDescription"]){
      const value=String(f.get(pole)||"").trim();
      if(value)p[pole]=value;else delete p[pole];
    }
    p.vonHalskyContentUpdatedAt=new Date().toISOString();
    p.vonHalskyContentSource="administrator-channel-override";
  }else{
    for(const pole of ["vonHalskyTitle","vonHalskyShortDescription","vonHalskyDescription","vonHalskyContentUpdatedAt"])delete p[pole];
    p.vonHalskyContentSource="store-canonical-content";
  }
  const producerName=normalizujNazweProducenta(f.get("producent")||f.get("marka"));
  if(!producerName)return null;
  if(poprzedni.kategoria&&p.kategoria!==poprzedni.kategoria){
    delete p.sciezkaKategorii;delete p.grupaKategorii;delete p.kategoriaPelna;
  }
  const sc = parseFloat(String(f.get("staraCena")||"").replace(",","."));
  if(sc>cena) p.staraCena = +sc.toFixed(2); else delete p.staraCena;
  const cenaAllegro=parseFloat(String(f.get("cenaAllegro")||"").replace(",","."));
  if(cenaAllegro>0)p.cenaAllegro=+cenaAllegro.toFixed(2);else delete p.cenaAllegro;
  const cenaVonHalsky=parseFloat(String(f.get("cenaVonHalsky")||"").replace(",","."));
  if(cenaVonHalsky>0)p.cenaVonHalsky=+cenaVonHalsky.toFixed(2);else delete p.cenaVonHalsky;
  const cenaZakupu=parseFloat(String(f.get("cenaZakupu")||"").replace(",","."));
  if(cenaZakupu>=0&&String(f.get("cenaZakupu")||"").trim()!==""){p.cenaZakupu=+cenaZakupu.toFixed(2);p.cenaZakupuPrywatna=true;}else{for(const pole of ["cenaZakupu","cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuPrywatna","cenaZakupuZrodlo","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt"])delete p[pole];}
  if(Number.isFinite(cenaZakupu)&&Number(cenaZakupu.toFixed(2))!==Number(poprzedni.cenaZakupu)){p.cenaZakupuZrodlo="ręczna edycja administratora";p.cenaZakupuZaktualizowanoAt=new Date().toISOString();p.cenaZakupuDopasowanie="ręcznie";for(const pole of ["cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu"])delete p[pole];}
  for(const pole of ["allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){let raw=String(f.get(pole)||"").trim();if(pole==="allegroShippingSubsidy"&&raw==="")raw=String(ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI);const n=Number(raw.replace(",","."));if(raw!==""&&Number.isFinite(n)&&n>=0)p[pole]=+n.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);else if(!["vatRate"].includes(pole))delete p[pole];}
  const feeAt=String(f.get("allegroFeeCalculatedAt")||"").trim();if(feeAt)p.allegroFeeCalculatedAt=feeAt;
  const zdjecie = String(f.get("zdjecie")||"").trim();
  if(zdjecie) p.zdjecie = zdjecie; else delete p.zdjecie;
  if(f.get("badge")) p.badge = String(f.get("badge")); else delete p.badge;
  for(const [pole,nazwa] of [
    ["gtin","gtin"],["kolorProduktu","kolorProduktu"],["rozmiar","rozmiar"],["material","material"],
    ["dostepnoscProducenta","dostepnoscProducenta"],["producentUrl","producentUrl"],["sourceUrl","sourceUrl"],
    ["allegroCategoryId","allegroCategoryId"],["allegroProductId","allegroProductId"],["allegroOfferId","allegroOfferId"],["allegroCategoryPhrase","allegroCategoryPhrase"],["allegroTitle","allegroTitle"],
    ["seoTitle","seoTitle"],["seoDescription","seoDescription"],["seoKeywords","seoKeywords"],["seoMode","seoMode"]
  ]){
    const v=String(f.get(nazwa)||"").trim();
    if(v)p[pole]=v;else delete p[pole];
  }
  p.producent=producerName;
  p.marka=normalizujNazweProducenta(f.get("marka"))||producerName;
  const canonicalCode=String(f.get("kodProducenta")||"").trim();
  for(const pole of ["kodProducenta","numerReferencyjny","mpn","externalId","sku"]){if(canonicalCode)p[pole]=canonicalCode;else delete p[pole];}
  if(p.producentUrl)p.sourceUrl=p.producentUrl;
  const stanProd=String(f.get("stanProducenta")??"").trim();if(stanProd!=="")p.stanProducenta=Math.max(0,Math.floor(Number(stanProd)||0));else delete p.stanProducenta;
  p.stanProducentaDokladny=String(f.get("stanProducentaDokladny")||"")==="1";
  for(const pole of ["stanProducentaZrodlo","producentStatus","producentSprawdzonoAt"]){const v=String(f.get(pole)||"").trim();if(v)p[pole]=v;else delete p[pole];}
  if(p.gtin) p.ean=p.gtin; else delete p.ean;
  const canonicalProducer=allegroProducentKanoniczny(p);
  if(canonicalProducer){p.producent=canonicalProducer;if(!p.marka)p.marka=canonicalProducer;}
  const warianty = String(f.get("warianty")||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
  if(warianty.length) p.warianty = warianty; else delete p.warianty;
  const zdjecia = Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(n=>String(f.get(n)||"").trim()).filter(Boolean);
  if(zdjecia.length) p.zdjecia = zdjecia; else delete p.zdjecia;
  const allegroParameters=[];
  for(const [key,value] of f.entries()) if(String(key).startsWith("allegroParam_")&&String(value||"").trim()){
    const pid=String(key).slice("allegroParam_".length), el=document.querySelector(`[name="${key}"]`), val=String(value).trim();
    allegroParameters.push(el?.dataset?.paramType==="dictionary"?{id:pid,valuesIds:[val]}:{id:pid,values:[val]});
  }
  if(allegroParameters.length)p.allegroParameters=allegroParameters;
  productEditorZastosujWspolnaTresc(p,poprzedni);
  return seoAutomatyzujDaneProduktu(p,p.seoMode==="manual"?"ręczne SEO administratora":"automatycznie po zapisie produktu",{force:p.seoMode!=="manual"});
}
function wgrajZdjecieDoPola(input, pole){
  wgrajObrazek(input, 900, url => {
    const form = input.closest ? input.closest("form") : input.form;
    if(form && form[pole]) form[pole].value = url;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj ✅");
  });
}
function wgrajZdjecieProduktu(input){
  wgrajObrazek(input,900,url=>{
    const form=input.closest?input.closest("form"):input.form,pole=form&&form.zdjecie;
    if(pole)pole.value=url;
    const podglad=$("podgladZdjecia");
    if(podglad)podglad.innerHTML=`<img src="${url}" alt="Podgląd zdjęcia produktu" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">`;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj, aby zachować ✅");
  });
}
async function dodajProdukt(e){
  e.preventDefault();
  const producerInput=e.target.elements.producent;if(!walidujPoleProducenta(producerInput)||!String(producerInput?.value||"").trim()){producerInput?.reportValidity();toast("⚠️ Podaj rzeczywistą nazwę producenta — numer wpisz w polu kodu produktu");return;}
  const submit=e.submitter;if(submit)submit.disabled=true;
  const f = new FormData(e.target);
  let prefillMeta={};
  try{ prefillMeta=JSON.parse(sessionStorage.getItem("artway_prefill_product")||"{}")||{}; }catch(err){ prefillMeta={}; }
  const maxId = najwyzszeIdProduktu();
  const KOLORY = ["#dbeafe","#e0e7ff","#fef3c7","#dcfce7","#fee2e2","#f3e8ff","#fce7f3","#ffedd5"];
  const agentMeta=agentAIImportUrlStan?.data?.product||{},p = daneProduktuZFormularza(f, maxId+1, {...prefillMeta,...agentMeta,kolor:KOLORY[(maxId+1)%KOLORY.length]});
  if(!p){ if(submit)submit.disabled=false;toast("⚠️ Podaj poprawną cenę i nazwę producenta"); return; }
  for(const key of Object.keys(p))if(key.startsWith("_agent"))delete p[key];
  const kontrola=produktDodawanieAktualizuj(e.target);
  if(!kontrola?.canSubmit){
    if(submit)submit.disabled=false;
    e.target.querySelector("[data-product-add-control]")?.scrollIntoView({behavior:"smooth",block:"start"});
    toast(kontrola?.blocking?`Produkt już istnieje (#${kontrola.blocking.product.id})`:kontrola?.potential&&!kontrola.acknowledged?"Najpierw zdecyduj, czy podobna pozycja jest innym produktem":"Najpierw uzupełnij dane i zakończ kontrolę duplikatów");
    return;
  }
  const duplicates=agentAIDuplikatyProduktu(p),blockingDuplicate=duplicates.find(x=>x.blocking);
  if(blockingDuplicate){
    if(submit)submit.disabled=false;
    const box=e.target.querySelector("[data-product-link-agent-result]");
    if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>🛡️ Ochrona katalogu</span><h3>Nie utworzono duplikatu</h3><small>${esc(blockingDuplicate.reasons.join(" • "))}</small></div><span class="lvl lvl-ostrzezenie">produkt #${esc(blockingDuplicate.product.id)}</span></header><div class="diag-actions"><button class="btn" type="button" onclick="location.hash='#/admin/produkty/edytuj/${encodeURIComponent(String(blockingDuplicate.product.id))}'">Otwórz istniejący produkt</button><button class="btn ghost" type="button" onclick="agentAIAktualizujIstniejacyZAnalizy(${jsArg(blockingDuplicate.product.id)},this)">Uzupełnij go danymi Agenta</button></div></div>`;
    toast(`Duplikat zablokowany — istnieje już produkt #${blockingDuplicate.product.id}`);return;
  }
  if(e.target.dataset.agentAdd==="1"||e.target.dataset.agentLinkSource){p.agentImportAt=new Date().toISOString();p.agentImportConfidence=Number(e.target.dataset.agentLinkConfidence||0)||0;p.agentImportSource=agentAIImportUrlStan.data?.fromCache?"pamięć Agenta":"link producenta";p.agentImportUrl=e.target.dataset.agentLinkSource||p.sourceUrl||p.producentUrl||"";}
  p.createdAt=p.createdAt||new Date().toISOString();p.createdBy=sesja?.email||"administrator";p.agentOnboardingStatus="processing";p.agentOnboardingStartedAt=new Date().toISOString();
  produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszStanZFormularza(f, p.id);
  agentAIZakonczLinkProducenta(prefillMeta._agentLinkId||prefillMeta._agentLinkUrl||p.sourceUrl||p.producentUrl,p);
  zapiszHistorieAgenta("opisy-produktow",`Agent AI sprawdził opisy po dodaniu produktu: ${p.nazwa}`,{produktId:p.id,opisKrotki:!!p.opisKrotki,opis:!!p.opis,importConfidence:p.agentImportConfidence||0,zrodlo:p.agentImportSource||"ręczne"});
  try{ sessionStorage.removeItem("artway_prefill_product"); }catch(e){}
  zbudujProdukty();
  kategoriaNowegoProduktu = "";
  loguj("info","Dodano produkt: "+p.nazwa+" ("+zl(p.cena)+")");
  toast("Produkt dodany ✅");
  toast("Produkt zapisany. Automat dobiera dane, kategorię, opisy i opłaty…");
  const onboardingResult=await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true}),onboardingProduct=pobierzProduktAdmin(p.id)||p,onboardingState=agentAIStanWdrozeniaProduktu(onboardingProduct),onboardingStatus=onboardingResult?.ok&&onboardingState.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(p.id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie nowego produktu: ${p.nazwa}`,{produktId:p.id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  if(submit)submit.disabled=false;
  if(["/admin/produkty/dodaj","/admin/produkty/z-linku"].includes(trasa())) location.hash="#/admin/produkty"; else renderuj();
}
function zapiszStanZFormularza(f, id){
  ustawStanMagazynowy(id, String(f.get("stan")??"").trim()===""?0:f.get("stan"), {typ:"korekta",powod:"Formularz produktu"});
}
async function automatyczniePobierzDaneZrodlaProduktu(p={}){
  const url=String(p.producentUrl||p.sourceUrl||"").trim();if(!/^https?:\/\//i.test(url))return p;
  try{
    const d=await chmura("product-url-inspect",{method:"POST",body:{url},timeout:30000}),s=d.product||{},canonical=allegroProducentKanoniczny({...p,...s,sourceUrl:url,producentUrl:url});
    const sourceCode=String(s.kodProducenta||s.numerReferencyjny||s.mpn||s.externalId||s.sku||"").trim();
    const missing={gtin:s.gtin||s.ean,ean:s.ean||s.gtin,kodProducenta:sourceCode,numerReferencyjny:sourceCode,externalId:sourceCode,sku:sourceCode,mpn:sourceCode,producent:canonical||s.producent||s.marka,marka:s.marka||canonical||s.producent,parametryProducenta:s.parametryProducenta,parametryZrodla:s.parametryZrodla,sourceMaterial:{...(p.sourceMaterial||{}),sourceUrl:s.sourceUrl||s.producentUrl||url,fetchedAt:s.sourceEvidence?.fetchedAt||s.producentSprawdzonoAt||new Date().toISOString(),title:s.nazwa||"",shortDescription:s.opisKrotki||"",longDescription:s.opis||"",producer:s.producent||s.marka||"",brand:s.marka||s.producent||"",category:s.kategoria||"",ean:s.gtin||s.ean||"",producerCode:sourceCode,parameters:s.parametryProducenta||s.parametryZrodla||{}},contentEditorial:{...(p.contentEditorial||{}),status:"queued",queuedReason:"source_updated",queuedAt:new Date().toISOString()}};
    zapiszPolaProduktuLokalnie(p.id,missing,true);
    const current=pobierzProduktAdmin(p.id)||p,canonicalUrl=s.sourceUrl||s.producentUrl||url,sourceImages=Number(s.sourceEvidence?.imagePolicyVersion)>=2?[s.zdjecie,...(Array.isArray(s.zdjecia)?s.zdjecia:[])].filter(Boolean):[],force={producentUrl:canonicalUrl,sourceUrl:canonicalUrl,sourceEvidence:s.sourceEvidence||current.sourceEvidence||null,...(sourceImages.length?{zdjecie:sourceImages[0],zdjecia:sourceImages.slice(1,16)}:{}),dostepnoscProducenta:s.dostepnoscProducenta||current.dostepnoscProducenta||"",stanProducenta:s.stanProducenta??current.stanProducenta??"",stanProducentaDokladny:s.stanProducentaDokladny===true,stanProducentaZrodlo:s.stanProducentaZrodlo||current.stanProducentaZrodlo||"",producentStatus:s.producentStatus||current.producentStatus||"",producentSprawdzonoAt:s.producentSprawdzonoAt||current.producentSprawdzonoAt||new Date().toISOString()};
    zapiszPolaProduktuLokalnie(p.id,force,false);agentAIZakonczLinkProducenta(url,pobierzProduktAdmin(p.id)||p);return pobierzProduktAdmin(p.id)||{...p,...missing,...force};
  }catch(e){agentAIZapiszLinkProducenta(url,"oczekuje","Automatyczne odświeżenie przy zapisie: "+(e.message||e));return p;}
}
async function allegroSynchronizujPowiazanyProduktPoZapisie(p,options={}){
  if(!p)return;
  try{
    const preparation=await asortymentPrzygotujProduktDoAllegro(p,{refreshSource:!options.skipSource}),draft=preparation.draft;
    let prepared=preparation.product;
    const existing=allegroOfertaDlaProduktuSklepu(prepared)||draft.existingOffer?.offer||null;
    let updated=false;
    if(existing||draft.operation==="update"){
      const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:prepared,options:{stock:allegroStanOfertyProduktu(prepared),publicationAction:"keep"}},timeout:120000});
      allegroZapiszAutoUzupelnienia(prepared,d);allegroZastosujWynikWystawienia(prepared,d);allegroZapiszWynikOperacji(prepared,d);updated=true;
      prepared=pobierzProduktAdmin(p.id)||prepared;
    }
    const feeReady=kwotaNum(prepared.cenaAllegro||prepared.cena)>0&&!!(prepared.allegroOfferId||existing?.id||(prepared.allegroCategoryId&&(prepared.allegroProductId||prepared.gtin||prepared.ean)));
    let feesUpdated=false;if(options.forceFees!==false&&feeReady)feesUpdated=!!(await allegroPobierzProwizjeProduktu(prepared.id,null,{silent:true}).catch(()=>null));
    await chmuraZapiszUstawienia().catch(()=>false);
    toast(updated?`✅ Produkt i oferta Allegro zaktualizowane${feesUpdated?" • prowizja odświeżona":" • prowizja wymaga ponownej próby"}`:preparation.ready?`✅ Produkt przygotowany i zapisany: opisy, kategoria i dane Allegro${feesUpdated?" • prowizja pobrana":""}`:`⚠️ Agent zapisał poprawki; pozostały braki: ${preparation.missing.join(", ")}`);
    return {ok:true,updated,feesUpdated,draft,preparation};
  }catch(e){allegroOstatniBladWystawienia=e;if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Automatyka produktu przekazała brak do Agenta AI: "+(e.message||e));return {ok:false,error:e};}
}
async function zapiszProduktAdmin(e,id){
  e.preventDefault();
  const producerInput=e.target.elements.producent;if(!walidujPoleProducenta(producerInput)||!String(producerInput?.value||"").trim()){producerInput?.reportValidity();toast("⚠️ Podaj rzeczywistą nazwę producenta — numer wpisz w polu kodu produktu");return;}
  const submit=e.submitter;if(submit)submit.disabled=true;
  const f = new FormData(e.target);
  const poprzedni = pobierzProduktAdmin(id);
  const p = daneProduktuZFormularza(f, id, poprzedni||{});
  if(!p){ if(submit)submit.disabled=false;toast("⚠️ Podaj poprawną cenę i nazwę producenta"); return; }
  zapiszStanZFormularza(f, id);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i] = p;
    zapiszLS("artway_produkty_dodane", produktyDodane);
  }else{
    produktyEdytowane = {...produktyEdytowane, [id]:p};
    zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  }
  zbudujProdukty(); odswiezMenu();
  zapiszHistorieAgenta("opisy-produktow",`Agent AI sprawdził opisy po edycji produktu: ${p.nazwa}`,{produktId:p.id,opisKrotki:!!p.opisKrotki,opis:!!p.opis});
  loguj("info","Zapisano zmiany produktu id="+id);
  toast("Zmiany zapisane. Automat aktualizuje dane, opis, prowizję i ofertę…");
  await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true});
  if(submit)submit.disabled=false;
  location.hash="#/admin/produkty";
}
function duplikujProdukt(id){
  const p = pobierzProduktAdmin(id); if(!p) return;
  const maxId = najwyzszeIdProduktu();
  const kopia = seoAutomatyzujDaneProduktu({...p,id:maxId+1,nazwa:p.nazwa+" — kopia",seoMode:"auto",seoTitle:"",seoDescription:"",seoKeywords:"",createdAt:new Date().toISOString(),createdBy:sesja?.email||"administrator",agentOnboardingStatus:"needs_attention",agentOnboardingStartedAt:new Date().toISOString(),agentOnboardingMissing:["identity"]},"automatycznie po utworzeniu kopii",{force:true});
  produktyDodane.push(kopia);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zbudujProdukty();zapiszHistorieAgenta("wdrozenie-produktu",`Nowa kopia produktu wymaga kontroli Agenta: ${kopia.nazwa}`,{produktId:kopia.id,status:"needs_attention",sourceProductId:id});zaplanujZapisUstawien();loguj("info",`Zduplikowano produkt ${id} jako ${kopia.id}`);
  toast("Utworzono kopię produktu 📄");
  location.hash="#/admin/produkty/edytuj/"+kopia.id;
}
function usunProdukt(id){
  const p = produktyDodane.find(x=>x.id===id);
  if(p){
    if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
    oznaczProduktWKoszu(id,"wlasny");
    zapiszLS("artway_kosz_dodane", koszDodanych);
  }
  produktyDodane = produktyDodane.filter(p=>p.id!==id);
  zapiszLS("artway_produkty_dodane", produktyDodane); zbudujProdukty();
  loguj("info","Przeniesiono produkt do kosza na 30 dni: id="+id); toast("Produkt w koszu przez 30 dni 🗑️"); renderuj();
}
function przywrocZKosza(id){
  const p = koszDodanych.find(x=>x.id===id);
  if(p&&!produktyDodane.some(x=>x.id===id)){ produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane); }
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony z kosza ↩️"); renderuj();
}
function usunDefinitywnie(id){
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  loguj("info","Usunięto definitywnie produkt id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function usunDefinitywnieBazowy(id){
  if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  usunMetaKosza(id);
  delete produktyEdytowane[id];
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zaznaczoneProdukty.delete(id);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Usunięto definitywnie produkt bazowy id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function wyczyscCalKosz(){
  const bazowe=bazoweProduktyWKoszu().map(p=>p.id);
  const ile=koszDodanych.length+bazowe.length;
  if(!ile||!confirm(`Definitywnie usunąć ${ile} produktów z kosza? Tej operacji nie można cofnąć.`)) return;
  koszDodanych.forEach(p=>{delete koszMeta[p.id];delete stanyProduktow[p.id];delete dostepnoscProduktow[String(p.id)];});
  bazowe.forEach(id=>{
    if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
    delete koszMeta[id]; delete produktyEdytowane[id]; delete stanyProduktow[id]; delete dostepnoscProduktow[String(id)];
  });
  koszDodanych=[];
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zbudujProdukty(); odswiezMenu();
  loguj("info",`Opróżniono kosz: ${ile} produktów`);
  toast("Kosz opróżniony"); renderuj();
}
