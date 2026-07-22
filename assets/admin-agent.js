/* GENERATED ADMIN AGENT — loaded on demand */
function agentAINormalizuj(s=""){
  const mapa={"ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z"};
  return String(s||"").toLowerCase()
    .replace(/[ąćęłńóśźż]/g,m=>mapa[m]||m)
    .replace(/[@#]/g," ")
    .replace(/[^\p{L}\p{N}/._-]+/gu," ")
    .replace(/\s+/g," ")
    .trim();
}
let agentAIDecyzjeMagazynowe={loaded:false,loading:false,items:[],locationsByProduct:{},error:"",updatedAt:""};
const agentAIDecyzjeMagazynoweBusy=new Set();
const AGENT_AI_CONFIRMATION_WORD=/\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b/;
const AGENT_AI_QUOTED_TEXT=[/„[^”\n]*”/g,/“[^”\n]*”/g,/«[^»\n]*»/g,/‹[^›\n]*›/g,/‘[^’\n]*’/g,/"[^"\n]*"/g,/'[^'\n]*'/g,/`[^`\n]*`/g];
function agentAIKontekstPotwierdzenia(raw="",n=agentAINormalizuj(raw)){
  const quoted=[];let outside=String(raw||"");
  AGENT_AI_QUOTED_TEXT.forEach(pattern=>{outside=outside.replace(pattern,match=>{quoted.push(agentAINormalizuj(match.slice(1,-1)));return " ";});});
  const outsideNormalized=agentAINormalizuj(outside),confirmationOutsideQuotes=AGENT_AI_CONFIRMATION_WORD.test(outsideNormalized);
  const unclosedQuote=/["'„”“«»‹›‘’`]/u.test(outside),questionOrReference=/[?？]/u.test(String(raw))||/\b(?:czy|co\s+(?:oznacza|znaczy)|napisz|powiedz|odpowiedz|slowo)\b/.test(n);
  const quotedConfirmation=quoted.some(segment=>AGENT_AI_CONFIRMATION_WORD.test(segment));
  const quotedInventoryCommand=quoted.some(segment=>/\b\d{1,7}\s*(?:szt|sztuk|sztuki|sztuka|sztuke)\b/.test(segment)&&(/\b(?:mam|mamy)\b[\s\S]*\bna stanie\b/.test(segment)||/\b(?:ustaw|ustawiam|skoryguj|zmien|przyjmij|przyjeto|dodaj|dopisz|zwieksz|powieksz)\b/.test(segment)));
  const negatedBefore=/\b(?:nie|bez)\b(?:\s+\w+){0,18}\s+\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b/.test(n);
  const revokedAfter=/\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b(?:\s+\w+){0,18}\s+\b(?:ale|lecz|jednak)\b(?:\s+\w+){0,8}\s+\bnie\b/.test(n)||/\b(?:zatwierdz\w*|potwierdz\w*|zapis\w*|akcept\w*|zaakcept\w*)\b(?:\s+\w+){0,20}\s+\b(?:anuluj\w*|cofnij\w*|odwol\w*|rezygn\w*|nie\s+(?:rob\w*|wykonuj\w*|zapisuj\w*|zmieniaj\w*|ustawiaj\w*|dodawaj\w*|zatwierdzaj\w*|potwierdzaj\w*|akceptuj\w*))\b/.test(n);
  const cancelled=/\b(?:anuluj\w*|cofnij\w*|odwol\w*|rezygn\w*)\b/.test(n);
  const deferred=/\b(?:jutro|pojutrze|pozniej|nastepnie|dopiero|wieczorem|rano|za\s+(?:chwile|moment|\d+\s*(?:minut|godzin|dni|tygodni))|po\s+(?:weekendzie|urlopie|swietach)|w\s+(?:weekend|poniedzialek|wtorek|srode|czwartek|piatek|sobote|niedziele))\b/.test(n)||/\b(?:gdy|kiedy|jak)\b(?:\s+\w+){0,8}\s+\b(?:bedzie|bede|wroce|dostane|przyjdzie)\b/.test(n)||/\b(?:po|o)\s+\d{1,2}(?::|\.)\d{2}\b/i.test(String(raw))||/\bpo\s+godzinie\s+\d{1,2}\b/.test(n);
  return {confirmed:confirmationOutsideQuotes&&!negatedBefore&&!revokedAfter&&!cancelled&&!deferred&&!questionOrReference&&!unclosedQuote&&!quotedInventoryCommand&&!(quotedConfirmation&&!confirmationOutsideQuotes)};
}
function agentAIMa(n,arr){ return arr.some(x=>x instanceof RegExp?x.test(n):n.includes(x)); }
function agentAIWytnijProdukt(n){
  let q=` ${n} `;
  ["ile mamy","ile jest","jaki stan","stan produktu","sprawdz produkt","sprawdz","znajdz","pokaz","czy mamy","gdzie lezy","gdzie jest","lokalizacja","produkt","towar","sku","kod","na magazynie","w magazynie","w sklepie","mi","prosze"].forEach(f=>{q=q.replaceAll(` ${f} `," ");});
  return q.replace(/\s+/g," ").trim();
}
function agentAIParsujZmianeStanu(tekst=""){
  const raw=String(tekst||"").trim(),n=agentAINormalizuj(raw);
  const ilosci=[...n.matchAll(/\b(\d{1,7})\s*(?:szt|sztuk|sztuki|sztuka|sztuke)\b/g)];
  const iloscMatch=ilosci.at(-1);
  if(!iloscMatch||!/(?:\b(?:stan|magazyn|mam|mamy|przyjmij|przyjeto|dodaj|dopisz|zwieksz|powieksz)\b|na stanie)/.test(n))return null;
  const increment=/\b(?:przyjmij|przyjeto|dodaj|dopisz|zwieksz|powieksz)\b(?:\s+\w+){0,5}\s+\d{1,7}\s*(?:szt|sztuk|sztuki|sztuka|sztuke)\b/.test(n);
  const absolute=/\b(?:mam|mamy)\b[\s\S]*\bna stanie\b/.test(n)||/\b(?:ustaw|ustawiam|skoryguj|zmien)\b[\s\S]*\b(?:stan|stanie|magazyn|magazynie)\b/.test(n)||/\b(?:stan|stanie)\b[\s\S]*\b(?:wynosi|jest)\b/.test(n);
  if(!increment&&!absolute)return null;
  const quotedOrExplanatory=/\b(?:klient\s+napisal|wiadomosc\s+klienta|w\s+instrukcji|przyklad|cytat|zacytowal|wyjasnij|co\s+mam\s+odpowiedziec)\b/.test(n);
  if(quotedOrExplanatory)return null;
  const conflict=(increment&&absolute)||ilosci.length>1;
  const confirmed=!conflict&&agentAIKontekstPotwierdzenia(raw,n).confirmed;
  const query=n
    .replace(/\b\d{1,7}\s*(?:szt|sztuk|sztuki|sztuka|sztuke)\b/g," ")
    .replace(/\b(?:mam|mamy|obecnie|teraz|aktualnie|na|stanie|stan|magazynie|magazynu|produkt|produktu|towar|towaru|sprawdz|sprawdzam|zweryfikuj|i|oraz|prosze|zatwierdz|potwierdz|zapisz|ustaw|przyjmij|przyjeto|dodaj|dopisz|zwieksz|powieksz|do)\b/g," ")
    .replace(/\s+/g," ").trim();
  return {typ:"magazyn-stan-zmiana",mode:increment&&!absolute?"increment":"set",quantity:Number(iloscMatch[1]),confirmed,conflict,query,raw,confidence:.99};
}
function agentAIParsujDecyzjeMagazynowa(tekst=""){
  const raw=String(tekst||"").trim();
  let match=raw.match(/^(?:lokalizacja|lokacja|miejsce)\s+(IV[a-f0-9]{14})\s+([A-Za-z0-9._/-]{1,40})\s*[.!]?$/i);
  if(match)return {typ:"magazyn-decyzja",action:"location",id:match[1],location:match[2],raw,confidence:1};
  match=raw.match(/^(?:nie\s+potwierdzam|odrzucam|anuluj(?:ę|e)|rezygnuj(?:ę|e))\s+(IV[a-f0-9]{14})\s*[.!]?$/i);
  if(match)return {typ:"magazyn-decyzja",action:"reject",id:match[1],raw,confidence:1};
  match=raw.match(/^(?:potwierdzam|zatwierdzam|akceptuj(?:ę|e))\s+(IV[a-f0-9]{14})\s*[.!]?$/i);
  if(match)return {typ:"magazyn-decyzja",action:"confirm",id:match[1],raw,confidence:1};
  return null;
}
function agentAIKluczIdentyfikatora(v=""){return agentAINormalizuj(v).replace(/[^a-z0-9]/g,"");}
function agentAIStemNazwy(v=""){
  const k=agentAIKluczIdentyfikatora(v);
  return k.length>=6?k.slice(0,6):k;
}
function agentAIZnajdzProduktDoZmianyStanu(intent={}){
  const q=agentAINormalizuj(intent.query||""),tokens=q.split(/\s+/).map(agentAIKluczIdentyfikatora).filter(Boolean),tokenSet=new Set(tokens);
  const nameTokens=tokens.filter(x=>!/^\d+$/.test(x)&&x.length>=3),products=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const ranked=products.map(p=>{
    const ids=[
      ["EAN",p.gtin||p.ean,520],["EXTERNAL_ID",p.externalId,500],["SKU",p.sku,495],
      ["kod producenta",p.kodProducenta||p.mpn,490],["ID",p.id,460]
    ];
    const identityHits=ids.map(([label,value,weight])=>({label,value:String(value??"").trim(),key:agentAIKluczIdentyfikatora(value),weight})).filter(x=>x.key&&tokenSet.has(x.key));
    const productName=agentAINormalizuj(p.nazwa||p.name||""),productNameTokens=productName.split(/\s+/).filter(Boolean);
    const matchedNames=nameTokens.filter(word=>productNameTokens.some(candidate=>candidate===word||agentAIStemNazwy(candidate)===agentAIStemNazwy(word)));
    const nameRatio=nameTokens.length?matchedNames.length/nameTokens.length:0;
    const exactName=!!q&&!!productName&&(q===productName||q.includes(productName)||productName.includes(q));
    const identityScore=identityHits.reduce((max,x)=>Math.max(max,x.weight),0),nameScore=(exactName?160:0)+Math.round(nameRatio*120);
    return {product:p,identityHits,matchedNames,nameRatio,exactName,score:identityScore+nameScore};
  }).filter(x=>x.identityHits.length||x.nameRatio>=.5||x.exactName).sort((a,b)=>b.score-a.score||b.identityHits.length-a.identityHits.length||String(a.product.nazwa||"").localeCompare(String(b.product.nazwa||""),"pl"));
  if(!ranked.length)return {status:"none",candidates:[]};
  const best=ranked[0],second=ranked[1];
  const strong=best.identityHits.length>0||best.exactName||best.nameRatio>=.75;
  if(!strong||(second&&second.score===best.score))return {status:"ambiguous",candidates:ranked.slice(0,8)};
  return {status:"one",product:best.product,evidence:best,candidates:ranked.slice(0,8)};
}
function agentAIProduktIdentyfikacjaTekst(p={}){
  return `ID ${p.id||"—"} • EXTERNAL_ID ${p.externalId||"—"} • SKU ${p.sku||"—"} • EAN ${p.gtin||p.ean||"—"} • kod producenta ${p.kodProducenta||p.mpn||"—"}`;
}
function agentAIRequestIdKorekty(intent={},p={}){
  const storageKey="artway_agent_inventory_request_ids",now=Date.now(),ttl=30*60*1000;
  let entries={};
  try{entries=JSON.parse(sessionStorage.getItem(storageKey)||"{}")||{};}catch(e){entries={};}
  for(const [key,value] of Object.entries(entries))if(!value||now-Number(value.createdAt||0)>ttl)delete entries[key];
  const fingerprint=[String(p.id||""),String(intent.mode||""),String(intent.quantity??""),agentAINormalizuj(intent.raw||intent.query||"")].join("|");
  let item=entries[fingerprint];
  if(!item?.id){
    item={id:`panel-stock-${globalThis.crypto?.randomUUID?.()||`${now.toString(36)}-${Math.random().toString(36).slice(2)}`}`,createdAt:now};
    entries[fingerprint]=item;
  }
  try{sessionStorage.setItem(storageKey,JSON.stringify(entries));}catch(e){}
  return {id:item.id,fingerprint,storageKey};
}
function agentAIUsunRequestIdKorekty(request={}){
  if(!request.fingerprint||!request.storageKey)return;
  try{
    const entries=JSON.parse(sessionStorage.getItem(request.storageKey)||"{}")||{};
    delete entries[request.fingerprint];
    sessionStorage.setItem(request.storageKey,JSON.stringify(entries));
  }catch(e){}
}
async function agentAIWykonajZmianeStanu(intent={}){
  if(intent.conflict)return "Polecenie jest niejednoznaczne: widzę jednocześnie stan bezwzględny i przyjęcie. Napisz osobno „ustaw stan …” albo „przyjmij … szt.”. Nic nie zostało zapisane.";
  const match=agentAIZnajdzProduktDoZmianyStanu(intent);
  if(match.status==="none")return `Nie znalazłem produktu jednoznacznie dla „${intent.query||intent.raw}”. Podaj nazwę wraz z ID, EXTERNAL_ID, SKU, EAN albo kodem producenta. Nie zmieniłem stanu.`;
  if(match.status!=="one")return ["Znalazłem kilka możliwych produktów — nie zmieniam stanu bez jednoznacznego dopasowania:",...match.candidates.map(x=>`• ${x.product.nazwa} — ${agentAIProduktIdentyfikacjaTekst(x.product)}`),"Dopisz dokładny EAN, EXTERNAL_ID, SKU albo kod producenta."].join("\n");
  const p=match.product,before=stanMagazynuId(p.id),after=intent.mode==="increment"?(before===null?null:before+intent.quantity):intent.quantity;
  const evidence=match.evidence.identityHits.map(x=>`${x.label} ${x.value}`).join(", ")||(match.evidence.exactName?"dokładna nazwa":"zgodność nazwy");
  if(intent.mode==="increment"&&before===null)return `Produkt został dopasowany jednoznacznie: ${p.nazwa} (${agentAIProduktIdentyfikacjaTekst(p)}), ale ma stan „bez limitu”. Najpierw ustaw konkretny stan; nie można bezpiecznie dodać ${intent.quantity} szt.`;
  const requestId=`panel-stock-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const result=await chmura("inventory-decision-create",{method:"POST",body:{
    productId:String(p.id),mode:intent.mode,quantity:intent.quantity,query:intent.query,requestId,
    source:"admin-agent-panel",channel:"panel",reason:`Polecenie administratora: ${intent.raw}`
  },timeout:30000});
  await agentAIDecyzjeMagazynowePobierz(true);
  const decision=result.decision||{},serverBefore=Object.prototype.hasOwnProperty.call(decision,"expectedStock")?decision.expectedStock:before,serverAfter=Object.prototype.hasOwnProperty.call(decision,"after")?decision.after:after;
  const summary=[`📍 Dopasowanie: ${p.nazwa}`,agentAIProduktIdentyfikacjaTekst(p),`Podstawa dopasowania: ${evidence}.`,`Plan: ${serverBefore===null?"bez limitu":serverBefore} → ${serverAfter} szt. (${intent.mode==="increment"?`przyjęcie +${intent.quantity}`:"ustawienie stanu absolutnego"}).`,`Decyzja: ${decision.id||"zapisana"}.`];
  return [...summary,"Najpierw wybierz lokalizację produktu w karcie poniżej. Potem osobno kliknij „Potwierdzam zmianę” albo „Nie potwierdzam”.","Nic nie zostało jeszcze zmienione. Jeśli decyzja zostanie na później, Agent przypomni o niej około 16:00."].join("\n");
}
async function agentAIDecyzjeMagazynowePobierz(silent=false){
  if(agentAIDecyzjeMagazynowe.loading)return agentAIDecyzjeMagazynowe;
  agentAIDecyzjeMagazynowe.loading=true;
  try{
    const data=await chmura("inventory-decisions-list",{method:"POST",body:{statuses:["awaiting_location","pending_confirmation","confirming"]},timeout:20000});
    agentAIDecyzjeMagazynowe={loaded:true,loading:false,items:Array.isArray(data.items)?data.items:[],locationsByProduct:data.locationsByProduct||{},error:"",updatedAt:new Date().toISOString()};
  }catch(error){
    agentAIDecyzjeMagazynowe={...agentAIDecyzjeMagazynowe,loaded:true,loading:false,error:String(error?.message||error)};
    if(!silent)toast(`Nie udało się pobrać decyzji: ${error?.message||error}`);
  }
  agentAIDecyzjeMagazynoweOdswiezPanel();
  return agentAIDecyzjeMagazynowe;
}
function agentAIDecyzjeMagazynoweOdswiezPanel(){
  const box=$("agentInventoryDecisionPanel");
  if(box)box.innerHTML=agentAIDecyzjeMagazynowePanelHTML();
}
function agentAIDecyzjaStanTekst(status=""){
  return status==="awaiting_location"?"Wymaga lokalizacji":status==="pending_confirmation"?"Czeka na Twoją decyzję":status==="confirming"?"Trwa bezpieczny zapis":"Zamknięta";
}
function agentAIDecyzjeMagazynowePanelHTML(){
  const state=agentAIDecyzjeMagazynowe,items=Array.isArray(state.items)?state.items:[];
  if(state.loading&&!state.loaded)return `<section class="agent-inventory-decisions" aria-live="polite"><div class="agent-ops-empty">⏳ Pobieram decyzje magazynowe…</div></section>`;
  if(state.error)return `<section class="agent-inventory-decisions" aria-live="polite"><div class="backend-note warn">⚠️ ${esc(state.error)} <button class="btn ghost" onclick="agentAIDecyzjeMagazynowePobierz()">Ponów</button></div></section>`;
  if(!items.length)return `<section class="agent-inventory-decisions" aria-live="polite"><div class="order-section-head"><div><span class="order-pro-label">Bezpieczne korekty</span><h3>Decyzje magazynowe</h3></div><span class="lvl lvl-ok">brak oczekujących</span></div><div class="agent-ops-empty">✅ Nie ma zmian oczekujących na lokalizację ani potwierdzenie.</div></section>`;
  return `<section class="agent-inventory-decisions" aria-live="polite"><div class="order-section-head"><div><span class="order-pro-label">Bezpieczne korekty</span><h3>Decyzje magazynowe (${items.length})</h3><p class="order-detail-lead">Najpierw lokalizacja, potem osobna decyzja. Brak kliknięcia oznacza brak zmiany; oczekujące pozycje wrócą w przypomnieniu około 16:00.</p></div><button class="btn ghost" onclick="agentAIDecyzjeMagazynowePobierz()">↻ Odśwież</button></div><div class="agent-inventory-decision-list">${items.map(item=>{
    const productId=String(item.productId||item.product?.id||""),locations=state.locationsByProduct?.[productId]||[],shownLocations=locations.slice(0,200),suggested=String(item.suggestedLocation||""),before=item.expectedStock===null?"niemonitorowany":`${item.expectedStock} szt.`,after=item.after===null?"—":`${item.after} szt.`,busy=agentAIDecyzjeMagazynoweBusy.has(String(item.id)),disabled=busy?"disabled":"";
    const options=[`<option value="">— wybierz lokalizację —</option>`,...shownLocations.map(loc=>`<option value="${esc(loc.code)}" ${suggested===loc.code?"selected":""}>${loc.current?"📍 ":""}${esc(loc.code)}${loc.name?` — ${esc(loc.name)}`:""}</option>`)].join("");
    return `<article class="agent-inventory-decision ${esc(item.status)} ${busy?"is-busy":""}" data-inventory-decision-id="${esc(item.id)}" aria-busy="${busy?"true":"false"}"><header><div><b>${esc(item.product?.name||`Produkt ${productId}`)}</b><small>${esc(item.id)} • ID ${esc(productId)}${item.product?.externalId?` • EXTERNAL_ID ${esc(item.product.externalId)}`:""}</small></div><span class="lvl ${item.status==="pending_confirmation"?"lvl-ostrzezenie":"lvl-info"}">${busy?"Zapisuję bezpiecznie…":esc(agentAIDecyzjaStanTekst(item.status))}</span></header><div class="agent-inventory-decision-facts"><span><small>Stan przed</small><b>${esc(before)}</b></span><span><small>Stan po</small><b>${esc(after)}</b></span><span><small>Lokalizacja</small><b>${esc(item.location||suggested||"do wskazania")}</b></span></div>${item.status==="awaiting_location"?`<div class="agent-inventory-location-step"><label><span>Lokalizacja produktu</span><select id="inventoryDecisionLocation-${esc(item.id)}" ${disabled}>${options}</select>${locations.length>shownLocations.length?`<small>Pokazano pierwsze ${shownLocations.length} lokalizacji. Uporządkuj nieaktywne lokalizacje w magazynie.</small>`:""}</label>${locations.length?`<button class="btn" ${disabled} onclick="agentAIDecyzjaUstawLokalizacje(${jsArg(item.id)},this)">📍 Zapisz lokalizację i pokaż podsumowanie</button>`:busy?`<span class="btn disabled">＋ Utwórz lokalizację</span>`:`<a class="btn" href="#/admin/magazyn/lokalizacje">＋ Utwórz lokalizację</a>`}<button class="btn ghost" ${disabled} onclick="agentAIDecyzjaWykonaj(${jsArg(item.id)},'reject',this)">Nie potwierdzam</button></div>`:item.status==="pending_confirmation"?`<div class="agent-inventory-final-step"><div><b>🔐 Ostatni krok</b><small>Sprawdź stan i lokalizację. Każdy przycisk dotyczy tylko tej jednej decyzji.</small></div><button class="btn" ${disabled} onclick="agentAIDecyzjaWykonaj(${jsArg(item.id)},'confirm',this)">✅ Potwierdzam zmianę</button><button class="btn ghost" ${disabled} onclick="agentAIDecyzjaWykonaj(${jsArg(item.id)},'reject',this)">❌ Nie potwierdzam</button></div>`:`<div class="agent-inventory-final-step"><div><b>⏳ Sprawdzam zapis</b><small>Jeśli poprzednie połączenie zostało przerwane, dokończenie rozpozna istniejący ruch i nie zapisze go drugi raz.</small></div><button class="btn ghost" ${disabled} onclick="agentAIDecyzjaWykonaj(${jsArg(item.id)},'confirm',this)">↻ Sprawdź i dokończ</button></div>`}${item.lastError?`<div class="backend-note warn">${esc(item.lastError)}</div>`:""}</article>`;
  }).join("")}</div></section>`;
}
function agentAIDecyzjaUstawBusy(id,busy){
  const key=String(id||"");
  if(busy)agentAIDecyzjeMagazynoweBusy.add(key);else agentAIDecyzjeMagazynoweBusy.delete(key);
  agentAIDecyzjeMagazynoweOdswiezPanel();
}
async function agentAIDecyzjaUstawLokalizacje(id,button){
  if(agentAIDecyzjeMagazynoweBusy.has(String(id)))return;
  const select=$(`inventoryDecisionLocation-${id}`),location=String(select?.value||"").trim();
  if(!location){toast("Wybierz lokalizację produktu");select?.focus();return;}
  agentAIDecyzjaUstawBusy(id,true);let success=false;
  try{
    const data=await chmura("inventory-decision-location",{method:"POST",body:{id,location},timeout:20000});
    toast("Lokalizacja zapisana. Teraz osobno potwierdź albo odrzuć zmianę.");
    await agentAIDecyzjeMagazynowePobierz(true);
    agentAIPokazTekstDecyzji(data.text||"Lokalizacja zapisana — oczekuje na potwierdzenie.");
    success=true;
  }catch(error){toast(error?.message||String(error));await agentAIDecyzjeMagazynowePobierz(true);}finally{agentAIDecyzjaUstawBusy(id,false);if(success)setTimeout(()=>document.querySelector(`[data-inventory-decision-id="${String(id)}"] .agent-inventory-final-step .btn`)?.focus(),0);}
}
async function agentAIDecyzjaWykonaj(id,action,button){
  if(!["confirm","reject"].includes(action)||agentAIDecyzjeMagazynoweBusy.has(String(id)))return;
  agentAIDecyzjaUstawBusy(id,true);
  try{
    const endpoint=action==="confirm"?"inventory-decision-confirm":"inventory-decision-reject";
    const data=await chmura(endpoint,{method:"POST",body:{id},timeout:30000});
    if(action==="confirm"){
      const refreshed=await chmuraWczytajStan().catch(()=>false);
      if(refreshed)zbudujProdukty();
      toast(refreshed?"Zmiana magazynowa została zapisana i zweryfikowana ✅":"Zmiana została zapisana na serwerze, ale panel nie potwierdził odświeżenia — odśwież dane");
    }else toast("Decyzja odrzucona — stan pozostał bez zmian");
    await agentAIDecyzjeMagazynowePobierz(true);
    agentAIPokazTekstDecyzji(data.text||"");
  }catch(error){toast(error?.message||String(error));await agentAIDecyzjeMagazynowePobierz(true);}finally{agentAIDecyzjaUstawBusy(id,false);}
}
function agentAICzystyTekstDecyzji(text=""){
  return String(text||"").replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|div)>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,"&").replace(/\n{3,}/g,"\n\n").trim();
}
function agentAIPokazTekstDecyzji(text=""){
  const box=$("agentAICommandLiveResult");
  if(!box)return;
  box.hidden=false;box.className="agent-response-card agent-command-live-result";
  box.innerHTML=`<div class="agent-response-head"><b>🔐 Decyzja magazynowa</b><small>${esc(new Date().toLocaleString("pl-PL"))}</small></div><pre class="agent-answer-pre">${esc(agentAICzystyTekstDecyzji(text))}</pre>`;
}
async function agentAIWykonajDecyzjeMagazynowa(intent={}){
  if(agentAIDecyzjeMagazynoweBusy.has(String(intent.id)))return "Ta decyzja jest właśnie bezpiecznie przetwarzana. Zaczekaj na wynik.";
  agentAIDecyzjaUstawBusy(intent.id,true);
  try{
  const endpoint=intent.action==="location"?"inventory-decision-location":intent.action==="confirm"?"inventory-decision-confirm":"inventory-decision-reject";
  const data=await chmura(endpoint,{method:"POST",body:{id:intent.id,...(intent.location?{location:intent.location}:{})},timeout:30000});
  let refreshed=true;
  if(intent.action==="confirm"){refreshed=await chmuraWczytajStan().catch(()=>false);if(refreshed)zbudujProdukty();}
  await agentAIDecyzjeMagazynowePobierz(true);
  return `${agentAICzystyTekstDecyzji(data.text||"Decyzja została obsłużona.")}${intent.action==="confirm"&&!refreshed?"\n\nZmiana jest zapisana na serwerze, ale panel nie potwierdził odświeżenia danych.":""}`;
  }finally{agentAIDecyzjaUstawBusy(intent.id,false);}
}
function agentAIWytnijProduktAllegro(n=""){
  return String(n||"")
    .replace(/\b(?:wystaw|dodaj|utworz|stworz|zrob|aktualizuj|odswiez|polacz|podepnij|aktywuj|dezaktywuj)\b/g," ")
    .replace(/\b(?:oferte|oferta|produkt|na|do|w|przez|allegro|agent|prosze)\b/g," ")
    .replace(/\s+/g," ").trim();
}
function agentAIZapiszPamiec(tresc="", meta={}){
  const czysta=String(tresc||"").trim();
  if(!czysta) return null;
  let wyzwalacz=String(meta.wyzwalacz||"").trim(), akcja=String(meta.akcja||czysta).trim();
  const m=czysta.match(/^(?:gdy|kiedy)\s+(?:napisze|napiszę|powiem|wpisze|wpiszę)\s+["„]?(.+?)["”]?\s*(?:to|->|=>|:)\s*(.+)$/i) || czysta.match(/^(.+?)\s*(?:->|=>)\s*(.+)$/);
  if(m){ wyzwalacz=m[1].trim(); akcja=m[2].trim(); }
  const rec={id:"MEM-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),tresc:czysta,wyzwalacz,akcja,typ:meta.typ||"procedura",tagi:Array.isArray(meta.tagi)?meta.tagi:[],data:new Date().toISOString(),dataTxt:new Date().toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
  agentAIPamiec=[rec,...(Array.isArray(agentAIPamiec)?agentAIPamiec:[])].slice(0,500);
  zapiszLS("artway_agent_ai_pamiec",agentAIPamiec);
  zapiszHistorieAgenta("pamięć",`Agent zapamiętał: ${skrocTekst(czysta,120)}`,{pamiec:rec});
  return rec;
}
function agentAIWytnijPamiec(raw=""){
  return String(raw||"").replace(/^\s*(zapamietaj|zapamiętaj|naucz sie|naucz się|dodaj do pamieci|dodaj do pamięci|procedura)\s*[:,-]?\s*/i,"").trim();
}
function agentAIUsunPamiec(id){
  const przed=(agentAIPamiec||[]).length;
  agentAIPamiec=(agentAIPamiec||[]).filter(x=>x.id!==id);
  zapiszLS("artway_agent_ai_pamiec",agentAIPamiec);
  if(agentAIPamiec.length!==przed){ zapiszHistorieAgenta("pamięć","Usunięto wpis pamięci agenta",{id}); toast("Usunięto wpis pamięci"); renderuj(); }
}
function agentAIPamiecTekst(limit=12){
  const lista=(agentAIPamiec||[]).slice(0,limit);
  if(!lista.length) return "Pamięć agenta jest pusta. Napisz np. „zapamiętaj: przy niskim stanie najpierw sprawdzamy dostawcę Pinkfrog”.";
  return ["🧠 Pamięć/procedury agenta:",...lista.map((x,i)=>`• ${i+1}. ${x.wyzwalacz?`Gdy: ${x.wyzwalacz} → `:""}${x.akcja||x.tresc} (${x.dataTxt||""})`)].join("\n");
}
function agentAIZnajdzPamiecDlaPolecenia(tekst=""){
  const n=agentAINormalizuj(tekst), slowa=n.split(" ").filter(w=>w.length>2);
  return (agentAIPamiec||[]).filter(x=>{
    const wyz=agentAINormalizuj(x.wyzwalacz||"");
    const hay=agentAINormalizuj([x.wyzwalacz,x.akcja,x.tresc].filter(Boolean).join(" "));
    if(wyz && (n.includes(wyz)||wyz.includes(n))) return true;
    const trafienia=slowa.filter(w=>hay.includes(w)).length;
    return slowa.length>=2 && trafienia>=Math.min(3,slowa.length);
  }).slice(0,5);
}
function agentAILokalizacjeTekst(){
  const stat=statystykiLokalizacji(), aktywne=magazynLokalizacjeAktywne();
  if(!aktywne.length) return "Nie ma jeszcze utworzonych lokalizacji magazynowych. Utwórz je w Magazyn → Lokalizacje albo napisz: „utwórz lokalizację R1-P1”.";
  return ["🗺️ Lokalizacje magazynu:",...aktywne.map(l=>{
    const s=stat[l.kod]||{produkty:0,sztuki:0,rezerwacje:0,wartosc:0};
    return `• ${l.kod}${l.nazwa?` — ${l.nazwa}`:""}; typ: ${l.typ||"—"}; strefa: ${l.strefa||"—"}; produkty: ${s.produkty}; sztuki: ${s.sztuki}; rezerwacje: ${s.rezerwacje}; wartość: ${zl(s.wartosc)}`;
  })].join("\n");
}
function agentAIProduktyZProblememOpisu(limit=500){
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>{
    const braki=[];
    if(!String(p.opisKrotki||"").trim()) braki.push("brak krótkiego opisu");
    if(!String(p.opis||"").trim()) braki.push("brak pełnego opisu");
    if(String(p.opis||"").replace(/\s+/g," ").trim().length>450 && !/\n/.test(String(p.opis||""))) braki.push("pełny opis wymaga formatowania");
    if(String(p.opisKrotki||"").length>360) braki.push("krótki opis jest za długi");
    return braki.length?{produkt:p,braki}:null;
  }).filter(Boolean).slice(0,limit);
}
function agentAIOpisyTekst(limit=12){
  const lista=agentAIProduktyZProblememOpisu(limit);
  if(!lista.length) return "Opisy produktów wyglądają poprawnie: krótkie opisy są uzupełnione, a pełne opisy nie wymagają pilnej korekty.";
  return ["📝 Produkty do poprawy opisów:",...lista.map((x,i)=>`• ${i+1}. ${x.produkt.nazwa} — ${x.braki.join(", ")}`),"Napisz „popraw opisy produktów”, żeby agent uzupełnił krótkie opisy i uporządkował pełne opisy."].join("\n");
}
function agentAIPoprawOpisyProduktow(limit=40){
  const lista=agentAIProduktyZProblememOpisu(limit);
  let zmienione=0;
  for(const x of lista){
    const p=x.produkt, poprawiony=agentAIPoprawOpisyDanychProduktu(p);
    if(JSON.stringify({a:p.opisKrotki||"",b:p.opis||""})===JSON.stringify({a:poprawiony.opisKrotki||"",b:poprawiony.opis||""})) continue;
    const idx=produktyDodane.findIndex(d=>Number(d.id)===Number(p.id));
    if(idx>=0) produktyDodane[idx]={...produktyDodane[idx],...poprawiony,id:p.id};
    else produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),opisKrotki:poprawiony.opisKrotki,opis:poprawiony.opis};
    zmienione++;
  }
  if(zmienione){
    zapiszStanProduktowPoOperacji();
    zbudujProdukty();
    zapiszHistorieAgenta("opisy-produktow",`Agent AI poprawił opisy produktów: ${zmienione}`,{limit,zmienione});
    if(chmuraToken) void chmuraZapiszUstawienia();
  }
  return `Agent sprawdził opisy. Poprawiono: ${zmienione}. Do kontroli po akcji: ${agentAIProduktyZProblememOpisu(500).length}.`;
}
function agentAIRozpoznajPolecenie(tekst=""){
  const raw=String(tekst||"").trim(), n=agentAINormalizuj(raw);
  if(!n) return {typ:"pomoc",raw,confidence:1};
  const decisionIntent=agentAIParsujDecyzjeMagazynowa(raw);
  if(decisionIntent)return decisionIntent;
  const urlMatch=raw.match(/https?:\/\/\S+/i);
  if(urlMatch&&agentAIMa(n,["sprawdz link","sprawdź link","pobierz z link","znajdz przez link","znajdź przez link","przeanalizuj link","uzupelnij z link","uzupełnij z link","dodaj produkt z link","dodaj z link","przygotuj produkt z link"]))return {typ:"link-producenta-analiza",url:urlMatch[0],addProduct:agentAIMa(n,["dodaj produkt","dodaj z link","przygotuj produkt"]),raw,confidence:.99};
  const stockIntent=agentAIParsujZmianeStanu(raw);
  if(stockIntent)return stockIntent;
  const slash=n.split(/\s+/)[0].split("@")[0];
  if(slash.startsWith("/")){
    if(["/start","/pomoc","/help"].includes(slash)) return {typ:"pomoc",raw,confidence:1};
    if(slash==="/status") return {typ:"status",raw,confidence:1};
    if(slash==="/magazyn") return {typ:"magazyn",raw,confidence:1};
    if(slash==="/braki") return {typ:"braki",raw,confidence:1};
    if(["/opisy","/opis"].includes(slash)) return {typ:n.includes("popraw")?"opisy-popraw":"opisy",raw,confidence:1};
    if(slash==="/zamowienia") return {typ:"zamowienia",raw,confidence:1};
    if(["/centrum","/priorytety","/dzis"].includes(slash)) return {typ:"centrum",raw,confidence:1};
    if(["/wiadomosci","/dyskusje"].includes(slash)) return {typ:"komunikacja",raw,confidence:1};
    if(["/wysylki","/inpost"].includes(slash)) return {typ:"wysylki",raw,confidence:1};
    if(slash==="/produkty") return {typ:"produkty-audyt",raw,confidence:1};
    if(["/producenci","/dostawcy"].includes(slash)) return {typ:"producenci",raw,confidence:1};
    if(["/diagnostyka","/integracje"].includes(slash)) return {typ:"diagnostyka",raw,confidence:1};
    if(["/zlecenie","/zamow"].includes(slash)) return {typ:"zlecenie",tryb:n.includes("nisk")?"niskie":"braki",raw,confidence:1};
    if(["/sprawdz","/check"].includes(slash)) return {typ:"sprawdz",raw,confidence:1};
    if(slash==="/wykonaj") return {typ:n.includes("blad")||n.includes("błąd")?"plan-retry":n.includes("dane")||n.includes("pobier")?"plan-data":n.includes("funkcj")||n.includes("stron")?"plan-health":"plan-wykonaj",raw,confidence:1};
  }
  if(agentAIMa(n,["pomoc","co potrafisz","jakie polecenia","co mozesz","instrukcja"])) return {typ:"pomoc",raw,confidence:.95};
  if(agentAIMa(n,["ponow bledy","ponów błędy","ponow nieudane kroki","ponów nieudane kroki","sprobuj jeszcze raz bledne","spróbuj jeszcze raz błędne"])) return {typ:"plan-retry",raw,confidence:.99};
  if(agentAIMa(n,["pobierz swieze dane","pobierz świeże dane","odswiez wszystkie dane","odśwież wszystkie dane","wykonaj samo pobieranie","sprawdz zrodla danych","sprawdź źródła danych"])) return {typ:"plan-data",raw,confidence:.99};
  if(agentAIMa(n,["sprawdz sama strone","sprawdź samą stronę","kontrola funkcjonalnosci","kontrola funkcjonalności","sprawdz funkcjonalnosc strony","sprawdź funkcjonalność strony"])) return {typ:"plan-health",raw,confidence:.99};
  if(agentAIMa(n,["wykonaj bezpieczny plan","wykonaj plan agenta","wykonaj konkretne dzialania","wykonaj konkretne działania","zrob bezpieczne dzialania","zrób bezpieczne działania","sprawdz funkcjonalnosc i pobierz dane","sprawdź funkcjonalność i pobierz dane"])) return {typ:"plan-wykonaj",raw,confidence:.99};
  if(agentAIMa(n,["wyslij raport na telegram","wyślij raport na telegram","raport telegram","telegram raport","podsumowanie na telegram"])) return {typ:"raport-telegram",raw,confidence:.98};
  if(agentAIMa(n,["centrum operacyjne","plan dnia","co mam zrobic","co mam zrobić","co mam dzisiaj zrobic","co mam dzisiaj zrobić","najwazniejsze zadania","najważniejsze zadania","pokaz priorytety","pokaż priorytety","co jest pilne","co wymaga decyzji","pokaż decyzje","pokaz decyzje","raport calej strony","raport całej strony"])) return {typ:"centrum",raw,confidence:.96};
  if(agentAIMa(n,["wiadomosci allegro","wiadomości allegro","dyskusje allegro","komunikacja z klientami","pokaz komunikacje","pokaż komunikację","komunikacja allegro","komu odpisac","komu odpisać","sprawy do odpowiedzi"])) return {typ:"komunikacja",raw,confidence:.95};
  if(agentAIMa(n,["wysylki","wysyłki","etykiety inpost","przesylki bez numeru","przesyłki bez numeru","status inpost","co wyslac","co wysłać"])) return {typ:"wysylki",raw,confidence:.93};
  if(agentAIMa(n,["audyt produktow","audyt produktów","stan katalogu","braki danych produktow","braki danych produktów","produkty do poprawy","jak wyglada katalog","jak wygląda katalog"])) return {typ:"produkty-audyt",raw,confidence:.92};
  if(agentAIMa(n,["status producentow","status producentów","dostawcy i producenci","zamowienia producentow","zamówienia producentów","otwarte dokumenty producentow","otwarte dokumenty producentów"])) return {typ:"producenci",raw,confidence:.92};
  if(agentAIMa(n,["diagnostyka integracji","status integracji","sprawdz integracje","sprawdź integracje","email inpost paynow","czy integracje dzialaja","czy integracje działają"])) return {typ:"diagnostyka",raw,confidence:.94};
  if(agentAIMa(n,["zapamietaj","zapamiętaj","naucz sie","naucz się","dodaj do pamieci","dodaj do pamięci","procedura:"])) return {typ:"pamiec-zapis",tresc:agentAIWytnijPamiec(raw),raw,confidence:.95};
  if(agentAIMa(n,["pokaz pamiec","pokaż pamięć","co pamietasz","co pamiętasz","lista procedur","pokaz procedury","pokaż procedury"])) return {typ:"pamiec-lista",raw,confidence:.95};
  if(agentAIMa(n,["pokaz lokalizacje","pokaż lokalizacje","lista lokalizacji","lokalizacje magazynu","mapa magazynu"])) return {typ:"lokalizacje",raw,confidence:.9};
  if(agentAIMa(n,["popraw opisy","popraw opisy produktow","popraw opisy produktów","uporzadkuj opisy","uporządkuj opisy","wygeneruj krotkie opisy","wygeneruj krótkie opisy"])) return {typ:"opisy-popraw",raw,confidence:.94};
  if(agentAIMa(n,["sprawdz opisy","sprawdź opisy","audyt opisow","audyt opisów","lista opisow","lista opisów","czy opisy sa dobre","czy opisy są dobre"])) return {typ:"opisy",raw,confidence:.92};
  if(agentAIMa(n,["sprawdz dostepnosc u producentow","sprawdź dostępność u producentów","sprawdz stany producentow","sprawdź stany producentów","monitoring producentow","monitoring producentów","niski stan u producenta","braki u producentow","braki u producentów"])) return {typ:"dostepnosc-producentow-sprawdz",raw,confidence:.97};
  if(agentAIMa(n,["sprawdz linki producentow","sprawdź linki producentów","pobierz linki producentow","pobierz linki producentów","pobierz produkty z linkow","pobierz produkty z linków","ponow pobieranie linkow","ponów pobieranie linków"])) return {typ:"linki-producentow-sprawdz",raw,confidence:.93};
  if(agentAIMa(n,["pokaz linki producentow","pokaż linki producentów","linki producentow","linki producentów","kolejka linkow","kolejka linków","url producenta"])) return {typ:"linki-producentow",raw,confidence:.92};
  if(agentAIMa(n,["utworz lokalizacje","utwórz lokalizację","dodaj lokalizacje","dodaj lokalizację"])){
    const kod=kodLokalizacjiMagazynu(n.replace(/.*(?:utworz|utworzz|utwórz|dodaj)\s+lokalizacj[eaęi]\s*/,"").split(" ")[0]||"");
    return {typ:"lokalizacja-dodaj",kod,raw,confidence:.82};
  }
  if(agentAIMa(n,["synchronizuj","synchronizacja","odswiez baze","odswiez dane","polacz baze","zapisz na serwerze"])) return {typ:"sync",raw,confidence:.95};
  if(agentAIMa(n,["utworz szkice fv","stworz szkice fv","brakujace szkice","faktury","infakt"])) return {typ:"faktury",raw,confidence:.9};
  if(agentAIMa(n,["eksport magazynu","pobierz magazyn","csv magazynu"])) return {typ:"export-magazyn",raw,confidence:.9};
  if(agentAIMa(n,["audyt magazynu","sprawdz kartoteke","audyt kartoteki"])) return {typ:"audyt-magazynu",raw,confidence:.9};
  if(agentAIMa(n,["uzupelnij kartoteke","domyslna kartoteka","wypelnij lokalizacje","wypelnij dostawcow"])) return {typ:"kartoteka-domyslna",raw,confidence:.9};
  if(agentAIMa(n,[
    "przygotuj zamowienie","przygotuj zlecenie","napisz zamowienie","napisz zlecenie","zrob zamowienie","zrob zlecenie",
    "zamowienie do producenta","zlecenie do producenta","zamowienie do dostawcy","zlecenie do dostawcy","co zamowic u producenta","co zamowic u dostawcy"
  ])){
    const niskie=agentAIMa(n,["nisk","niski stan","niskie stany","brak na stanie","zerowy stan","uzupelniajace","uzupelnij"]);
    const braki=agentAIMa(n,["pod zamowienia","pod zlecenia","aktywne zamowienia","aktywne zlecenia","braki do zamowien"]);
    return {typ:"zlecenie",tryb:niskie&&!braki?"niskie":"braki",raw,confidence:.95};
  }
  if(n.includes("allegro")&&/(?:wystaw|dodaj|utworz|stworz|aktualizuj|podepnij|aktywuj|dezaktywuj)/.test(n)){
    return {typ:"allegro-oferta",query:agentAIWytnijProduktAllegro(n),publicationAction:n.includes("dezaktywuj")?"deactivate":n.includes("aktywuj")||n.includes("wystaw")?"activate":"keep",raw,confidence:.98};
  }
  if(agentAIMa(n,["sprawdz allegro","sprawdź allegro","zlecenia allegro","zamowienia allegro","zamówienia allegro","pakowanie allegro","braki allegro"])) return {typ:"allegro-zlecenia",raw,confidence:.98};
  if(agentAIMa(n,["sprawdz teraz","sprawdz czy","sprawdz zlecenia","sprawdz zamowienia","czy wplynelo","czy wpadlo","czy jest nowe","czy sa nowe","nowe zlecenie","nowe zamowienie","jakies zlecenie wplynelo","jakies zamowienie wplynelo"])) return {typ:"sprawdz",raw,confidence:.95};
  if(agentAIMa(n,["czego brakuje","co brakuje","braki","brakuje do zamowien","brakuje do zlecen","co trzeba domowic","co trzeba zamowic","nadrezerwacje","braki magazynowe","plan zatowarowania","plan zakupow"])) return {typ:"braki",raw,confidence:.9};
  if(agentAIMa(n,["lista zamowien","pokaz zamowienia","pokaz zlecenia","ostatnie zamowienia","ostatnie zlecenia","ile zamowien","ile zlecen","zamowienia","zlecenia"])) return {typ:"zamowienia",raw,confidence:.86};
  if(agentAIMa(n,["status sklepu","status strony","status agenta","czy sklep dziala","czy strona dziala","kondycja","stan systemu","backend","baza dziala","raport agenta"])) return {typ:"status",raw,confidence:.92};
  if(agentAIMa(n,["stan magazynu","podsumowanie magazynu","raport magazynu","magazyn","ile produktow","produkty bez kartoteki","bez dostawcy","bez lokalizacji","niskie stany","brak na stanie"])) return {typ:"magazyn",raw,confidence:.85};
  if(agentAIMa(n,["ile mamy","ile jest","jaki stan","stan produktu","sprawdz produkt","znajdz","czy mamy","gdzie lezy","gdzie jest"]) || /^sku\s+/.test(n) || /^kod\s+/.test(n)){
    const query=agentAIWytnijProdukt(n);
    if(query.length>=2) return {typ:"produkt",query,raw,confidence:.82};
  }
  if(n==="status") return {typ:"status",raw,confidence:.9};
  if(n==="magazyn") return {typ:"magazyn",raw,confidence:.9};
  if(n==="braki") return {typ:"braki",raw,confidence:.9};
  if(["zamowienia","zlecenia"].includes(n)) return {typ:"zamowienia",raw,confidence:.9};
  if(n==="zlecenie") return {typ:"zlecenie",tryb:"braki",raw,confidence:.9};
  return {typ:"nieznane",raw,confidence:.2};
}
function agentAIProduktTekst(fraza=""){
  const q=agentAINormalizuj(fraza);
  if(!q) return "Podaj nazwę, SKU albo fragment produktu, np. „ile mamy szachy”.";
  const slowa=q.split(" ").filter(Boolean);
  const rez=rezerwacjeMagazynowe();
  const lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).filter(p=>{
    const hay=agentAINormalizuj([p.nazwa,p.sku,p.kategoria,p.podkategoria,p.id].filter(Boolean).join(" "));
    return hay.includes(q) || slowa.every(w=>hay.includes(w));
  }).slice(0,8);
  if(!lista.length) return `Nie znalazłem produktu dla: „${fraza}”. Spróbuj krótszej nazwy albo SKU.`;
  return ["🔎 Produkty znalezione:",...lista.map(p=>{
    const stan=stanMagazynuId(p.id), r=Number(rez[p.id]||0), dost=stan===null?null:stan-r, meta=magazynMetaProduktu(p.id);
    const dostepnosc=produktOznaczonyNiedostepny(p)?"wyłączony ze sprzedaży":"dostępny w sklepie";
    return `• ${p.nazwa} (${p.sku||"ID "+p.id}) — stan: ${stan===null?"bez limitu":stan+" szt."}, rezerwacje: ${r}, dostępne po rezerwacjach: ${dost===null?"bez limitu":dost+" szt."}, sprzedaż: ${dostepnosc}, cena: ${zl(p.cena)}, lokalizacja: ${meta.lokalizacja?nazwaLokalizacjiMagazynu(meta.lokalizacja):"—"}, dostawca: ${meta.dostawca||"—"}`;
  })].join("\n");
}
function agentAIBrakiTekst(limit=12){
  const plan=potrzebyZatowarowania().slice(0,limit);
  if(!plan.length) return "📦 Braki do aktywnych zamówień: brak. Aktualne rezerwacje mieszczą się w stanie magazynowym.";
  return ["📦 Braki do aktywnych zamówień:",...plan.map(x=>`• ${x.produkt.nazwa} (${x.produkt.sku||"ID "+x.produkt.id}) — zamówić ${x.ilosc} szt.; dostępne: ${x.dostepne}; rezerwacje: ${x.rezerwacje}; dostawca: ${x.meta.dostawca||"—"}`)].join("\n");
}
function agentAIZamowieniaTekst(limit=8){
  const zam=pobierzZamowienia().slice().sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  const aktywne=zam.filter(statusZamowieniaRezerwujeMagazyn);
  const nowe=zam.filter(z=>String(z.status||"").toLowerCase()==="nowe");
  const potw=zam.filter(z=>z.wymagaPotwierdzeniaDostepnosci);
  const bezNumeru=aktywne.filter(z=>!daneWysylki(z).numer);
  const ostatnie=zam.slice(0,limit).map(z=>`• ${z.nr} — ${klientZamowieniaLabel(z)} — ${z.status||"nowe"} — ${zl(kosztyZamowienia(z).razem||z.razem)}`).join("\n");
  return [`📋 Zamówienia: ${zam.length} wszystkich, ${nowe.length} nowych, ${aktywne.length} aktywnych, ${potw.length} do potwierdzenia dostępności, ${bezNumeru.length} bez numeru nadania.`,ostatnie?`\nOstatnie:\n${ostatnie}`:""].join("");
}
function agentAIAllegroZleceniaTekst(limit=12){
  const aktywne=aktywneZamowieniaAllegro();
  const analizy=aktywne.map(z=>({z,a:allegroAnalizaMagazynowaZamowienia(z)}));
  const braki=analizy.filter(x=>x.a.braki>0), nierozpoznane=analizy.filter(x=>x.a.nierozpoznane>0), bezStanu=analizy.filter(x=>x.a.bezStanu>0), bezLokalizacji=analizy.filter(x=>x.a.bezLokalizacji>0), gotowe=analizy.filter(x=>x.a.gotowe);
  const rows=analizy.slice(0,limit).map(x=>{const lok=x.a.pozycje.filter(p=>p.decyzja==="kompletuj").map(p=>p.lokalizacja?nazwaLokalizacjiMagazynu(p.lokalizacja):"").filter(Boolean);return `• ${x.z.id} • Allegro: ${allegroStatusKolejkiMeta(x.z).label} • magazyn: ${allegroEtapMagazynuMeta(x.z).label} • ${x.a.gotowe?(x.a.bezLokalizacji?"towar zarezerwowany, lokalizację ustala magazyn":`pobierz z: ${[...new Set(lok)].join(", ")}`):`braki ${x.a.braki} szt., nierozpoznane ${x.a.nierozpoznane}, bez stanu ${x.a.bezStanu}`}`;});
  return [`📦 Kontrola zleceń Allegro: ${aktywne.length} aktywnych, ${gotowe.length} gotowych do kompletacji, ${braki.length} z brakami, ${nierozpoznane.length} nierozpoznanych i ${bezStanu.length} bez stanu.`,`📍 Osobna kolejka magazynu: ${bezLokalizacji.length} zleceń ma towar bez ustalonej lokalizacji; nie blokuje to rezerwacji ani realizacji.`,...rows,braki.length?"Agent dopisuje wyłącznie realne braki z nowych zleceń do właściwego szkicu producenta; lokalizacja nigdy nie tworzy zakupu.":"Nie ma braków wymagających zamówienia u producenta."].join("\n");
}
function agentAIStatusTekst(){
  const analiza=agentAIAnaliza();
  const problemy=analiza.filter(x=>x.poziom!=="ok");
  const score=Math.max(0,Math.round(100-(analiza.filter(x=>x.poziom==="bad").length*18)-(analiza.filter(x=>x.poziom==="warn").length*8)));
  return [`🤖 Status agenta/sklepu: ${score}%`,`${problemy.length} tematów wymaga kontroli.`,`Baza: ${chmuraStan.admin?"połączona":"wymaga hasła/połączenia"} • e-mail: ${stanBramki.email?.configured?"OK":"sprawdź"} • InPost: ${stanBramki.inpost?.configured?"OK":"sprawdź"} • pamięć: ${(agentAIPamiec||[]).length} • lokalizacje: ${magazynLokalizacjeAktywne().length}`,problemy.length?`\nNajważniejsze:\n${problemy.slice(0,8).map(x=>`• ${x.tytul}: ${x.opis}`).join("\n")}`:"\nBrak pilnych problemów z listy kontroli."].join("\n");
}
function agentAICentrumTekst(limit=10){
  const analiza=agentAIAnaliza(),zadania=analiza.filter(x=>x.poziom!=="ok").sort((a,b)=>agentAIPriorytet(a)-agentAIPriorytet(b)).slice(0,limit),bad=analiza.filter(x=>x.poziom==="bad").length,warn=analiza.filter(x=>x.poziom==="warn").length,score=Math.max(0,Math.round(100-bad*18-warn*8));
  return [`🤖 Centrum operacyjne Artway-TM — ${score}%`,`Pilne: ${bad} • wymagające uwagi: ${warn} • kontrole OK: ${analiza.length-bad-warn}.`,zadania.length?`\nKolejność pracy:\n${zadania.map((x,i)=>`${i+1}. ${x.poziom==="bad"?"🔴":"🟡"} ${x.tytul}\n   ${x.opis}\n   Następny krok: ${agentAIOpisKroku(x)}`).join("\n")}`:"\n✅ Brak aktywnych tematów wymagających reakcji.","\nPolecenia szczegółowe: „pokaż komunikację”, „sprawdź wysyłki”, „audyt produktów”, „status producentów” albo „wyślij raport na Telegram”."].join("\n");
}
function agentAIKomunikacjaTekst(){
  const st=allegroKomunikacjaStaty(),threads=st.threads||[],issues=st.issues||[],threadNeed=threads.filter(allegroKomunikacjaWymagaOdpowiedzi).length,issueNeed=issues.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  return [`💬 Komunikacja z klientami`,`Allegro: ${threadNeed} wiadomości i ${issueNeed} dyskusji/reklamacji wymaga odpowiedzi.`,`Załatwione wewnętrznie: ${[...threads,...issues].filter(allegroKomunikacjaZalatwiona).length}.`,`Automatyczna odpowiedź jest wysyłana tylko przy pierwszej nowej wiadomości; dalsze odpowiedzi pozostają do zatwierdzenia administratora.`,threadNeed+issueNeed?"Otwórz Allegro → Wiadomości lub Dyskusje, sprawdź propozycję Agenta i odpowiedz klientowi.":"✅ Brak nowych spraw wymagających odpowiedzi."].join("\n");
}
function agentAIWysylkiTekst(){
  const aktywne=pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn),bezNumeru=aktywne.filter(z=>!daneWysylki(z).numer),problemy=aktywne.filter(z=>daneWysylki(z).etap==="problem"||daneWysylki(z).status==="problem");
  return [`🚚 Centrum wysyłek`,`Aktywne zamówienia: ${aktywne.length}. Bez numeru nadania: ${bezNumeru.length}. Wyjątki/problem: ${problemy.length}.`,`InPost: ${stanBramki.inpost?.configured?"połączony":"wymaga sprawdzenia konfiguracji"}.`,bezNumeru.length?`Do obsługi: ${bezNumeru.slice(0,10).map(z=>z.nr).join(", ")}.\nNastępny krok: uzupełnij odbiorcę, wybierz usługę, wygeneruj etykietę i pobierz numer nadania.`:"✅ Aktywne przesyłki mają numery nadania."].join("\n");
}
function agentAIProduktyAudytTekst(){
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),bezCeny=produkty.filter(p=>!produktMaCeneSprzedazy(p)),bezZdjec=produkty.filter(p=>!p.zdjecie),opisy=agentAIProduktyZProblememOpisu(1000),oferty=produkty.filter(p=>p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id),zadania=allegroAktywneZadaniaAgentaOfert();
  return [`🏷️ Audyt produktów i katalogu`,`Aktywne produkty: ${produkty.length}. Na Allegro: ${oferty.length}.`,`Bez ceny: ${bezCeny.length} • bez zdjęcia: ${bezZdjec.length} • opis do poprawy: ${opisy.length} • zadania wystawiania: ${zadania.length}.`,zadania.length?"Najpierw uzupełnij dane wymagane przez Allegro, następnie ponów wystawianie z Agenta ofert.":opisy.length?"Możesz użyć polecenia „popraw opisy produktów”.":"✅ Brak pilnych problemów katalogu."].join("\n");
}
function agentAIProducenciTekst(){
  const stats=statystykiDostepnosciProducentow(),docs=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny),producenci=(producenciKartoteka||[]).filter(p=>p.active!==false);
  return [`🏭 Producenci i zakupy`,`Kartoteki producentów: ${producenci.length}. Otwarte dokumenty zakupowe: ${docs.length}.`,`Dostępność: ${stats.braki.length} braków • ${stats.niskie.length} niskich stanów • ${stats.nieznane.length} niepotwierdzonych.`,`Linki oczekujące na pobranie: ${agentAILinkiOczekujace().length}.`,docs.length?"Sprawdź bieżące rewizje dokumentów. Telegram jest podglądem; e-mail do producenta wymaga zatwierdzenia aktualnej wersji.":"✅ Brak otwartych dokumentów producentów."].join("\n");
}
function agentAIDiagnostykaTekst(){
  return [`🛠️ Diagnostyka całej strony`,`Wspólna baza: ${chmuraStan.admin?"OK":"wymaga połączenia"}.`,`E-mail: ${stanBramki.email?.configured?"OK":"sprawdź"} • InPost: ${stanBramki.inpost?.configured?"OK":"sprawdź"} • Allegro: ${allegroStan.connected?"OK":"sprawdź połączenie"}.`,`Paynow: ${stanBramki.paynow?.configured?"OK":"sprawdź konfigurację"} • Telegram: raport serwerowy dostępny po poprawnej konfiguracji bota.`,`Następny krok: otwórz Diagnostykę, jeżeli którakolwiek integracja nie ma statusu OK.`].join("\n");
}
async function agentAIWyslijRaportTelegram(){
  toast("Agent przygotowuje raport całej strony dla Telegramu…");
  try{const d=await chmura("telegram-send-agent-report",{method:"POST",body:{source:"admin-panel"},timeout:30000});zapiszHistorieAgenta("telegram","Wysłano raport centrum operacyjnego na Telegram",{messageId:d.messageId||"",score:d.center?.score||0,summary:d.center?.summary||{}});toast(`✅ Raport Agenta wysłany na Telegram • kondycja ${d.center?.score??"—"}%`);renderuj();return d;}catch(e){toast("⚠️ Telegram: "+(e.message||e));return null;}
}
function agentAIMagazynTekst(){
  const produktyAdmin=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const monitorowane=produktyAdmin.filter(p=>stanMagazynuId(p.id)!==null);
  const bezMonitoringu=produktyAdmin.length-monitorowane.length;
  const niskie=monitorowane.filter(p=>stanMagazynuId(p.id)<=progNiskiProduktu(p));
  const niedostepne=produktyAdmin.filter(produktOznaczonyNiedostepny);
  const braki=potrzebyZatowarowania();
  const bezLokalizacji=produktyAdmin.filter(p=>!magazynMetaProduktu(p.id).lokalizacja),bezDostawcy=braki.filter(x=>!x.meta?.dostawca);
  return [`🏬 Magazyn: ${produktyAdmin.length} produktów aktywnych w administracji.`,`Monitorowane stany: ${monitorowane.length}; bez monitoringu: ${bezMonitoringu}.`,`Realne braki do aktywnych zamówień: ${braki.length}; bez dostawcy w Planie: ${bezDostawcy.length}; lokalizacje do utrzymania przez magazyn: ${bezLokalizacji.length}; wyłączone ze sprzedaży: ${niedostepne.length}.`,niskie.length?`\nPierwsze niskie stany:\n${niskie.slice(0,8).map(p=>`• ${p.nazwa} — stan ${stanMagazynuId(p.id)} szt., próg ${progNiskiProduktu(p)}`).join("\n")}`:""].join("\n");
}

function czyEAN(v){
  const c=tylkoCyfry(v);
  return [8,12,13,14].includes(c.length);
}
function kodOperacyjnyProduktu(p, meta={}){
  return String(p?.kodProducenta || p?.mpn || p?.externalId || p?.sku || meta.kod || "").trim();
}
function eanOperacyjnyProduktu(p, meta={}){
  const kandydaci=[meta.ean,meta.ean13,meta.kodEan,p?.ean,p?.gtin,p?.kodEan,meta.kod,p?.kod].filter(Boolean);
  const e=kandydaci.find(czyEAN) || kandydaci[0] || "";
  return String(e||"").trim();
}
function mapaZamowienDlaProduktow(){
  const mapa={};
  pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).forEach(z=>{
    pozycjeZamowieniaMagazyn(z).forEach(p=>{
      const k=String(p.id);
      const rec=mapa[k]||(mapa[k]={ilosc:0,zamowienia:{},numery:[]});
      rec.ilosc+=Number(p.ilosc)||0;
      rec.zamowienia[z.nr]=(rec.zamowienia[z.nr]||0)+(Number(p.ilosc)||0);
    });
  });
  aktywneZamowieniaAllegro().forEach(z=>{
    pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{
      const k=String(p.id), numer=`Allegro ${z.id||z.nr}`;
      const rec=mapa[k]||(mapa[k]={ilosc:0,zamowienia:{},numery:[]});
      rec.ilosc+=Number(p.ilosc)||0;
      rec.zamowienia[numer]=(rec.zamowienia[numer]||0)+(Number(p.ilosc)||0);
    });
  });
  Object.values(mapa).forEach(rec=>{rec.numery=Object.entries(rec.zamowienia).map(([nr,ilosc])=>`${nr} × ${ilosc}`).slice(0,12);});
  return mapa;
}
function agentAIPozycjeZleceniaProducenta(tryb="braki",limit=500){
  const mode=String(tryb||"braki").toLowerCase(), zamMap=mapaZamowienDlaProduktow(), rez=rezerwacjeMagazynowe();
  let wiersze=[];
  if(mode==="niskie"){
    wiersze=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>{
      const stan=stanMagazynuId(p.id);
      if(stan===null) return null;
      const r=Number(rez[p.id]||0), dost=stan-r, min=progNiskiProduktu(p), target=targetStockProduktu(p,0), meta=magazynMetaProduktu(p.id);
      if(stan>min && dost>=min) return null;
      return {produkt:p,ilosc:Math.max(1,target-Math.max(0,dost)),stan,rezerwacje:r,dostepne:dost,meta,powod:`stan ${stan}, dostępne po rezerwacjach ${dost}, próg ${min}`,zamowienia:zamMap[String(p.id)]?.numery||[]};
    }).filter(Boolean);
  }else{
    wiersze=potrzebyZatowarowania().map(x=>({produkt:x.produkt,ilosc:x.ilosc,stan:x.stan,rezerwacje:x.rezerwacje,dostepne:x.dostepne,meta:x.meta,powod:x.powod,zamowienia:zamMap[String(x.produkt.id)]?.numery||[]}));
  }
  return wiersze.slice(0,limit).map(x=>{
    const p=x.produkt, meta=x.meta||{}, kod=kodOperacyjnyProduktu(p,meta), ean=eanOperacyjnyProduktu(p,meta), dostawca=agentAIDostawcaProduktu(p,meta);
    return {
      produktId:String(p.id),
      kod,
      kodProducenta:String(p.kodProducenta||p.mpn||"").trim(),
      externalId:String(p.externalId||"").trim(),
      sku:String(p.sku||"").trim(),
      ean,
      nazwa:p.nazwa||"Produkt",
      kategoria:p.kategoria||"",
      ilosc:Number(x.ilosc)||0,
      stan:x.stan===null?null:Number(x.stan||0),
      rezerwacje:Number(x.rezerwacje||0),
      dostepne:x.dostepne===null?null:Number(x.dostepne||0),
      iloscPotrzebna:Number(x.ilosc)||0,
      przyjeto:0,
      nadwyzka:0,
      lokalizacja:meta.lokalizacja||"",
      dostawca,
      powod:x.powod||"",
      zamowienia:Array.isArray(x.zamowienia)?x.zamowienia:[]
    };
  });
}
function agentAIDostawcaProduktu(p={},meta={}){
  const kartoteka=String(meta.dostawca||"").trim();
  if(kartoteka)return kartoteka;
  const producent=String(p.producent||p.marka||"").trim();
  if(producent){
    const key=producent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-");
    if(key.includes("alexander"))return typeof producentPoNazwie==="function"?(producentPoNazwie("Alexander")?.name||"Alexander"):"Alexander";
    if(key.includes("multigra"))return typeof producentPoNazwie==="function"?(producentPoNazwie("Multigra")?.name||"Multigra"):"Multigra";
    return producent;
  }
  const url=String(p.producentUrl||p.sourceUrl||p.agentImportUrl||"").toLowerCase();
  if(url.includes("alexander"))return "Alexander";
  if(url.includes("multigra"))return "Multigra";
  return "";
}
function agentAIAktywneIlosciUProducentow(){
  const mapa={};
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[])
    .filter(agentAIPlanDokumentAktywny)
    .forEach(z=>(Array.isArray(z.pozycje)?z.pozycje:[]).forEach(p=>{
      const id=String(p.produktId||"");
      if(!id)return;
      const pozostalo=Math.max(0,(Number(p.ilosc)||0)-(Number(p.przyjeto)||0));
      mapa[id]=(mapa[id]||0)+pozostalo;
    }));
  return mapa;
}
function agentAIBrakiOperacyjne(){
  const aktywne=agentAIAktywneIlosciUProducentow();
  return agentAIPozycjeZleceniaProducenta("braki",1000).map(p=>{
    const brak=Math.max(0,Number(p.ilosc)||0), wZleceniach=Math.max(0,Number(aktywne[String(p.produktId)]||0));
    return {...p,brakCalkowity:brak,wZleceniach,pozostaloDoZamowienia:Math.max(0,brak-wZleceniach)};
  });
}
function agentAIGrupujPoDostawcy(pozycje=[]){
  const grupy={};
  (Array.isArray(pozycje)?pozycje:[]).forEach(p=>{const d=String(p.dostawca||"Bez przypisanego dostawcy").trim()||"Bez przypisanego dostawcy";(grupy[d]||(grupy[d]=[])).push(p);});
  return Object.entries(grupy).sort(([a],[b])=>a.localeCompare(b,"pl"));
}
function agentAIFormatZleceniaProducenta(zlecenie){
  if(!zlecenie||!Array.isArray(zlecenie.pozycje)||!zlecenie.pozycje.length) return "Nie ma pozycji do zlecenia.";
  const grupy={};
  zlecenie.pozycje.forEach(x=>{const d=x.dostawca||"Bez przypisanego dostawcy";(grupy[d]||(grupy[d]=[])).push(x);});
  return [
    `🧾 ${zlecenie.numer||zlecenie.id} — ${zlecenie.tryb==="niskie"?"zlecenie uzupełniające":"zlecenie pod aktywne zamówienia"}`,
    `Status: ${zlecenie.status||"szkic"} • pozycji: ${zlecenie.pozycje.length} • sztuk: ${zlecenie.pozycje.reduce((s,x)=>s+Number(x.ilosc||0),0)}`,
    "",
    ...Object.entries(grupy).map(([d,items])=>[
      `Dostawca: ${d}`,
      ...items.map((x,i)=>`${i+1}. ${x.nazwa} — ${x.ilosc} szt. — kod: ${agentAIKodPozycjiProducenta(x)||"BRAK — uzupełnij kartotekę"} • lok.: ${x.lokalizacja||"—"}${x.zamowienia?.length?` • zam.: ${x.zamowienia.join(", ")}`:""}`),
      ""
    ].join("\n")),
    "Zlecenie zapisano w tabeli operacyjnej agenta. Nie zostało wysłane automatycznie do dostawcy."
  ].join("\n").trim();
}
function agentAIStatusRoboczyProducenta(status="szkic"){
  return ["szkic","do sprawdzenia","zaakceptowane","wysłane na telegram"].includes(String(status||"szkic").toLowerCase());
}
function agentAIDostawcaZlecenia(z={}){
  return String(z.supplier||z.dostawcy?.[0]||z.pozycje?.[0]?.dostawca||"Bez przypisanego dostawcy").trim()||"Bez przypisanego dostawcy";
}
function producentKlucz(v=""){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function producentPoNazwie(name=""){
  const key=producentKlucz(name);return (producenciKartoteka||[]).find(p=>producentKlucz(p.name||p.nazwa)===key)||null;
}
function producentDaneZFormularza(form,base={}){
  const f=new FormData(form),name=String(f.get("name")||"").trim();if(!name)return null;
  const {emailSubject:_staryTemat,emailIntro:_staryWstep,...safeBase}=base;
  return {...safeBase,id:base.id||`producer-${producentKlucz(name)||Date.now().toString(36)}`,name,legalName:String(f.get("legalName")||"").trim(),orderEmail:String(f.get("orderEmail")||"").trim().toLowerCase(),contactPerson:String(f.get("contactPerson")||"").trim(),phone:String(f.get("phone")||"").trim(),website:String(f.get("website")||"").trim(),address:String(f.get("address")||"").trim(),nip:String(f.get("nip")||"").trim(),leadTimeDays:Math.max(0,Number(f.get("leadTimeDays"))||0),minimumOrder:String(f.get("minimumOrder")||"").trim(),paymentTerms:String(f.get("paymentTerms")||"").trim(),notes:String(f.get("notes")||"").trim(),active:f.get("active")==="on",updatedAt:new Date().toISOString()};
}
function producentDodaj(e){
  e.preventDefault();const p=producentDaneZFormularza(e.target,{});if(!p){toast("Podaj nazwę producenta");return;}
  if(producentPoNazwie(p.name)){toast("Producent o tej nazwie już istnieje");return;}
  producenciKartoteka=[p,...(producenciKartoteka||[])];zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Dodano producenta ${p.name}`,{producentId:p.id});toast("Producent dodany ✅");renderuj();
}
function producentZapisz(e,id){
  e.preventDefault();const old=(producenciKartoteka||[]).find(p=>String(p.id)===String(id));if(!old)return;
  const p=producentDaneZFormularza(e.target,old);if(!p)return;
  producenciKartoteka=(producenciKartoteka||[]).map(x=>String(x.id)===String(id)?p:x);zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Zaktualizowano kartotekę ${p.name}`,{producentId:p.id,email:!!p.orderEmail});toast("Kartoteka producenta zapisana ✅");renderuj();
}
function producentUsun(id){
  const p=(producenciKartoteka||[]).find(x=>String(x.id)===String(id));if(!p)return;
  const powiazane=(agentAIZlecenia||[]).filter(z=>producentKlucz(agentAIDostawcaZlecenia(z))===producentKlucz(p.name));
  const aktywne=powiazane.filter(agentAIPlanDokumentAktywny);
  if(aktywne.length){
    producenciKartoteka=(producenciKartoteka||[]).map(x=>String(x.id)===String(id)?{...x,active:false,archivedAt:new Date().toISOString()}:x);
    zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Dezaktywowano kartotekę ${p.name} — istnieją aktywne dokumenty`,{producentId:p.id,aktywne:aktywne.length});toast(`Kartoteka ma ${aktywne.length} aktywne zamówienie(a) — została bezpiecznie dezaktywowana`);renderuj();return;
  }
  producenciKartoteka=(producenciKartoteka||[]).filter(x=>String(x.id)!==String(id));zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Usunięto kartotekę ${p.name}`,{producentId:p.id});toast("Kartoteka producenta usunięta");renderuj();
}
function producentFormHTML(p={}){
  const edit=!!p.id;return `<form class="producer-record-card" onsubmit="${edit?`producentZapisz(event,${jsArg(p.id)})`:`producentDodaj(event)`}"><div class="producer-record-head"><div><span class="supplier-chip">🏭 ${esc(p.name||"Nowy producent")}</span><h3>${edit?"Dane i kontakt":"Dodaj producenta"}</h3></div>${edit?`<span class="lvl ${p.orderEmail?"lvl-ok":"lvl-ostrzezenie"}">${p.orderEmail?"e-mail gotowy":"brak e-maila zamówień"}</span>`:""}</div><div class="producer-form-grid"><div class="f-group"><label>Nazwa producenta *</label><input name="name" required value="${esc(p.name||"")}" placeholder="np. Alexander"></div><div class="f-group"><label>Pełna nazwa firmy</label><input name="legalName" value="${esc(p.legalName||"")}"></div><div class="f-group"><label>E-mail do zamówień *</label><input name="orderEmail" type="email" value="${esc(p.orderEmail||"")}" placeholder="zamowienia@producent.pl"></div><div class="f-group"><label>Osoba kontaktowa</label><input name="contactPerson" value="${esc(p.contactPerson||"")}"></div><div class="f-group"><label>Telefon</label><input name="phone" value="${esc(p.phone||"")}"></div><div class="f-group"><label>Strona internetowa</label><input name="website" type="url" value="${esc(p.website||"")}" placeholder="https://..."></div><div class="f-group"><label>NIP</label><input name="nip" value="${esc(p.nip||"")}"></div><div class="f-group"><label>Adres</label><input name="address" value="${esc(p.address||"")}"></div><div class="f-group"><label>Standardowy czas realizacji (dni)</label><input name="leadTimeDays" type="number" min="0" value="${esc(p.leadTimeDays??3)}"></div><div class="f-group"><label>Minimum zamówienia</label><input name="minimumOrder" value="${esc(p.minimumOrder||"")}" placeholder="np. 500 zł"></div><div class="f-group"><label>Warunki płatności</label><input name="paymentTerms" value="${esc(p.paymentTerms||"")}" placeholder="np. przelew 7 dni"></div><label class="check"><input name="active" type="checkbox" ${p.active!==false?"checked":""}> Aktywny producent</label></div><details ${edit?"":"open"}><summary>Wysyłka i notatki</summary><div class="backend-note"><b>Stały bezpieczny szablon e-maila</b><p>Temat i treść powstają na serwerze z zatwierdzonej rewizji. Wiadomość zawiera wyłącznie kod, nazwę i zamawianą ilość — bez cen i wartości. Pełny podgląd zobaczysz w Planie zatowarowania przed wysłaniem.</p></div><div class="f-group"><label>Notatki wewnętrzne</label><textarea name="notes" rows="3">${esc(p.notes||"")}</textarea></div></details><div class="producer-record-actions"><button class="btn" type="submit">${edit?"💾 Zapisz kartotekę":"➕ Dodaj producenta"}</button>${edit&&p.website?`<a class="btn ghost" href="${esc(p.website)}" target="_blank" rel="noopener">🌐 Otwórz stronę</a>`:""}${edit?`<button class="btn danger" type="button" onclick="if(confirm('Usunąć tę kartotekę producenta?'))producentUsun(${jsArg(p.id)})">Usuń</button>`:""}</div></form>`;
}
function producenciKartotekaPanelHTML(){
  const list=(producenciKartoteka||[]).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pl")),ready=list.filter(p=>p.orderEmail&&p.active!==false).length;
  const summary=list.map(p=>{const docs=(agentAIZlecenia||[]).filter(z=>agentAIDostawcaZlecenia(z)===p.name),open=docs.filter(agentAIPlanDokumentAktywny).length,last=docs.slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")))[0];return `<div class="producer-summary-card"><div><span class="supplier-chip">🏭 ${esc(p.name)}</span><b>${esc(p.contactPerson||p.legalName||"Kontakt nieuzupełniony")}</b><small>${p.orderEmail?`✉️ ${esc(p.orderEmail)}`:"brak e-maila zamówień"}${p.phone?` • 📞 ${esc(p.phone)}`:""}</small></div><div><strong>${docs.length}</strong><small>zamówień • ${open} bieżących</small>${last?`<small>ostatnie: ${esc(last.numer||last.id)}</small>`:""}</div></div>`;}).join("");
  return `<div class="panel producer-directory"><div class="order-section-head"><div><span class="order-pro-label">Kartoteka zakupowa</span><h2 style="margin-top:.25rem">🏭 Producenci i kontakty</h2><p class="order-detail-lead">Adres e-mail z tej kartoteki jest jedynym adresem używanym do wysyłki zatwierdzonego zamówienia. Dane i kontakty synchronizują się ze wspólną bazą, a bezcenowy szablon wiadomości jest stały i chroniony po stronie serwera.</p></div><span class="lvl ${ready===list.length&&list.length?"lvl-ok":"lvl-ostrzezenie"}">${ready}/${list.length} gotowych do e-maila</span></div><div class="producer-directory-summary">${summary||`<div class="backend-note">Brak producentów w kartotece.</div>`}</div><div class="producer-directory-list">${list.map(producentFormHTML).join("")}${producentFormHTML({})}</div></div>`;
}
let agentAIPlanUzgadnianie=false;
async function agentAIUzgodnijPlanZSerwerem(opcje={}){
  if(agentAIPlanUzgadnianie)return Array.isArray(agentAIZlecenia)?agentAIZlecenia:[];
  if(!maUprawnieniaZapisuChmury()){if(!opcje.silent)toast("Połącz panel administratora ze wspólną bazą, aby uzgodnić Plan zatowarowania");return [];}
  agentAIPlanUzgadnianie=true;
  try{
    const d=await chmura("supplier-order-reconcile",{method:"POST",body:{source:String(opcje.source||"admin-restock-plan")},timeout:60000});
    if(d.settings&&Object.keys(d.settings).length)nalozWspolneUstawienia(d.settings);
    agentAIPlanZapiszOdpowiedzSerwera(d);
    if(d.rev!==undefined)zapiszLS("artway_chmura_rev",d.rev||0);
    chmuraStan={...chmuraStan,dostepna:true,admin:true,rev:d.rev||chmuraStan.rev||0,updated_at:d.updated_at||null,error:""};
    zastosujUstawienia();zbudujProdukty();odswiezMenu();odswiezKoszyk();agentAIPlanOdswiezWidok();
    const dokumenty=Array.isArray(agentAIZlecenia)?agentAIZlecenia:[];
    if(!opcje.silent)toast(`✅ Plan uzgodniony na serwerze • ${dokumenty.filter(agentAIPlanDokumentAktywny).length} aktywnych dokumentów`);
    return dokumenty;
  }catch(e){if(!opcje.silent)toast(`⚠️ Nie udało się uzgodnić Planu: ${e.message||e}`);throw e;}
  finally{agentAIPlanUzgadnianie=false;}
}
async function agentAIZatwierdzZlecenie(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono szkicu producenta");return;}
  try{const d=await chmura("supplier-order-approve",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1)},timeout:45000});await agentAIPlanOdswiezPoOperacji(d,`✅ Zatwierdzono wersję ${Math.max(1,Number(d.draft?.revision||z.revision)||1)}`);}catch(e){await agentAIPlanBladOperacji(e,"Nie zatwierdzono wersji");}
}
async function agentAIUsunZlecenie(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono szkicu producenta");return;}
  if(!confirm(`Anulować szkic ${z.numer||z.id}? Dokument pozostanie w historii i nie zostanie wysłany.`))return;
  try{const d=await chmura("supplier-order-cancel",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1)},timeout:45000});await agentAIPlanOdswiezPoOperacji(d,"✅ Szkic anulowany i przeniesiony do historii");}catch(e){await agentAIPlanBladOperacji(e,"Nie anulowano szkicu");}
}
async function agentAIPrzygotujKorekteZlecenia(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const reason=prompt("Dlaczego przygotowujesz korektę? Poprzedniego dostarczonego e-maila nie da się usunąć — pozostanie w historii audytowej.","Korekta ilości lub pozycji zamówienia");
  if(reason===null)return;if(String(reason).trim().length<3){toast("Podaj krótki powód korekty");return;}
  if(!confirm(`Utworzyć nową wersję korekty dokumentu ${z.numer||z.id}?\n\nPoprzednia wysyłka pozostanie w historii. Bieżący status wróci do kontroli, a po zmianach trzeba będzie ponownie zatwierdzić i wysłać dokument.`))return;
  try{const d=await chmura("supplier-order-correction",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1),reason:String(reason).trim()},timeout:45000});await agentAIPlanOdswiezPoOperacji(d,`✅ Utworzono korektę — wersja ${Math.max(1,Number(d.draft?.revision)||1)} czeka na kontrolę`);}catch(e){await agentAIPlanBladOperacji(e,"Nie utworzono korekty");}
}
async function agentAIPonowEmailProducenta(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const reason=prompt("Podaj powód ponownej wysyłki identycznego dokumentu:","Producent prosi o ponowne przesłanie wiadomości");
  if(reason===null)return;if(String(reason).trim().length<3){toast("Podaj krótki powód ponownej wysyłki");return;}
  return agentAIWyslijZlecenieEmail(id,{forceResend:true,resendReason:String(reason).trim()});
}
function agentAIPobierzZlecenieCSV(id){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zlecenia producenta");return;}
  const pozycje=(z.pozycje||[]).map(p=>({...p,kodEksportowy:agentAIKodPozycjiProducenta(p)})),braki=pozycje.filter(p=>!p.kodEksportowy).map(p=>({nazwa:p.nazwa||"Produkt"}));
  if(agentAIEksportZablokowanyPrzezBrakKodow(braki,"Eksport tabeli zamówienia"))return false;
  const nag=["kod","nazwa","zamawiana_ilosc"];
  const csv=[nag.join(";"),...pozycje.map(p=>[p.kodEksportowy,p.nazwa,p.ilosc].map(csvPole).join(";"))].join("\n");
  pobierzPlik(`zlecenie-producenta-${String(z.numer||z.id).replace(/[^a-z0-9_-]+/gi,"-")}.csv`,"\uFEFF"+csv,"text/csv");
  return true;
}
function agentAIEanPoprawny(v){
  const kod=tylkoCyfry(v);if(![8,12,13,14].includes(kod.length))return false;
  const cyfry=[...kod].map(Number),kontrolna=cyfry.pop(),suma=cyfry.slice().reverse().reduce((s,n,i)=>s+n*(i%2===0?3:1),0);
  return (10-(suma%10))%10===kontrolna;
}
function agentAIBiznesowyIdentyfikator(v){
  const wartosc=String(v||"").trim();
  if(!wartosc||wartosc.length>80||/^(?:-|—|brak|n\/a|null|undefined)$/i.test(wartosc)||/\b(?:lub|albo|or)\b/i.test(wartosc))return "";
  return /^[\p{L}\p{N}][\p{L}\p{N}._\/-]{0,79}$/u.test(wartosc)?wartosc:"";
}
function agentAIStabilnyIdentyfikatorPozycji(p={},produktWejscie=null){
  const produkt=produktWejscie&&typeof produktWejscie==="object"?produktWejscie:(typeof produktMagazynowy==="function"?(produktMagazynowy(p.produktId)||{}):{}),meta=typeof magazynMetaProduktu==="function"?(magazynMetaProduktu(p.produktId)||{}):{};
  const lokalneId=new Set([p.id,p.produktId,produkt.id].map(v=>String(v||"").trim().toUpperCase()).filter(Boolean));
  const jawny=v=>agentAIBiznesowyIdentyfikator(v),ogolny=v=>{const wartosc=jawny(v);return wartosc&&!lokalneId.has(wartosc.toUpperCase())?wartosc:"";};
  const grupy=[
    ["EXTERNAL_ID",[p.externalId,produkt.externalId]],
    ["SKU",[p.sku,produkt.sku]],
    ["kod producenta",[p.kodProducenta,p.mpn,produkt.kodProducenta,produkt.mpn]]
  ];
  for(const [typ,wartosci] of grupy){const wartosc=wartosci.map(jawny).find(Boolean);if(wartosc)return {wartosc,typ};}
  const kodyOgolne=[
    ["kod dostawcy",[p.kodDostawcy,p.supplierCode,p.vendorCode,produkt.kodDostawcy,produkt.supplierCode,produkt.vendorCode,meta.kodDostawcy]],
    ["kod katalogowy",[p.kodKatalogowy,p.catalogCode,produkt.kodKatalogowy,produkt.catalogCode,meta.kodKatalogowy]],
    ["kod",[p.kod,produkt.kod,meta.kod]]
  ];
  for(const [typ,wartosci] of kodyOgolne){const wartosc=wartosci.map(ogolny).find(Boolean);if(wartosc)return {wartosc,typ};}
  const ean=[p.ean,p.gtin,produkt.gtin,produkt.ean].map(tylkoCyfry).find(agentAIEanPoprawny);
  if(ean)return {wartosc:ean,typ:"EAN"};
  return {wartosc:"",typ:""};
}
function agentAIKodPozycjiProducenta(p={},produkt=null){return agentAIStabilnyIdentyfikatorPozycji(p,produkt).wartosc;}
function agentAIIdentyfikatorOptimaPozycji(p={},produkt={}){
  const meta=typeof magazynMetaProduktu==="function"?(magazynMetaProduktu(p.produktId)||{}):{},jawny=v=>agentAIBiznesowyIdentyfikator(v);
  const grupy=[
    ["kod Comarch Optima",[p.optimaCode,p.supplierOptimaCode,p.kodOptima,produkt.optimaCode,produkt.supplierOptimaCode,produkt.kodOptima,meta.optimaCode,meta.supplierOptimaCode,meta.kodOptima]],
    ["kod dostawcy",[p.kodDostawcy,p.supplierCode,p.vendorCode,produkt.kodDostawcy,produkt.supplierCode,produkt.vendorCode,meta.kodDostawcy,meta.supplierCode,meta.vendorCode]],
    ["kod producenta",[p.kodProducenta,p.mpn,produkt.kodProducenta,produkt.mpn]]
  ];
  for(const [typ,wartosci] of grupy){const wartosc=wartosci.map(jawny).find(Boolean);if(wartosc)return {wartosc,typ};}
  const ean=[p.ean,p.gtin,produkt.gtin,produkt.ean].map(tylkoCyfry).find(agentAIEanPoprawny);
  return ean?{wartosc:ean,typ:"EAN"}:{wartosc:"",typ:""};
}
function agentAIPrzygotujOptimaZlecenie(pozycje=[],productFinder){
  const znajdz=typeof productFinder==="function"?productFinder:(id=>typeof produktMagazynowy==="function"?(produktMagazynowy(id)||{}):{}),wiersze=[],braki=[];
  (Array.isArray(pozycje)?pozycje:[]).forEach(p=>{
    const produkt=znajdz(p.produktId)||{},identyfikator=agentAIIdentyfikatorOptimaPozycji(p,produkt),ilosc=Math.max(0,Number(p.ilosc)||0);
    if(!identyfikator.wartosc){braki.push({produktId:String(p.produktId||""),nazwa:String(p.nazwa||produkt.nazwa||"Produkt bez nazwy")});return;}
    if(!ilosc)return;
    wiersze.push({towar:identyfikator.wartosc,ilosc,typ:identyfikator.typ,nazwa:String(p.nazwa||produkt.nazwa||"Produkt")});
  });
  return {wiersze,braki,tresc:wiersze.map(x=>`${String(x.towar).replace(/[;\r\n]/g,"")};${x.ilosc};`).join("\r\n")};
}
function agentAIEksportZablokowanyPrzezBrakKodow(braki=[],tytul="Eksport Planu"){
  const lista=(Array.isArray(braki)?braki:[]).filter(Boolean);if(!lista.length)return false;
  agentAIOtworzModal(`${tytul} wymaga uzupełnienia kodów`,`<div class="backend-note warn"><b>Plik nie został utworzony.</b><p>${lista.length} pozycji nie ma jednoznacznego EXTERNAL_ID, SKU, kodu producenta, innego jawnego kodu ani poprawnego EAN. Uzupełnij kartoteki — wewnętrzne ID sklepu nigdy nie jest automatycznym kodem eksportowym.</p></div><ul class="supplier-optima-missing">${lista.map(x=>`<li>${esc(x.nazwa||x.name||"Produkt")}</li>`).join("")}</ul>`,"Po poprawie kartotek uruchom eksport ponownie.");
  toast(`Uzupełnij stabilny kod w ${lista.length} pozycjach — plik nie został utworzony`);return true;
}
let agentAIModalPoprzedniFocus=null;
function agentAIZamknijModal(){
  const modal=document.getElementById("agentSupplierPreviewModal");
  if(modal)modal.remove();
  document.removeEventListener("keydown",agentAIModalKlawisz);
  if(agentAIModalPoprzedniFocus&&typeof agentAIModalPoprzedniFocus.focus==="function")agentAIModalPoprzedniFocus.focus();
  agentAIModalPoprzedniFocus=null;
}
function agentAIModalKlawisz(e){if(e.key==="Escape"){e.preventDefault();agentAIZamknijModal();}}
function agentAIOtworzModal(tytul,trescHTML,opis=""){
  agentAIZamknijModal();
  agentAIModalPoprzedniFocus=document.activeElement;
  const modal=document.createElement("div");
  modal.id="agentSupplierPreviewModal";modal.className="supplier-preview-overlay";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","agentSupplierPreviewTitle");modal.tabIndex=-1;
  modal.innerHTML=`<section class="supplier-preview-modal"><header><div><span class="order-pro-label">Bezpieczny podgląd — nic nie zostanie wysłane</span><h2 id="agentSupplierPreviewTitle">${esc(tytul)}</h2>${opis?`<p>${esc(opis)}</p>`:""}</div><button type="button" class="btn ghost supplier-preview-close" aria-label="Zamknij podgląd" onclick="agentAIZamknijModal()">✕</button></header><div class="supplier-preview-body">${trescHTML}</div><footer><button type="button" class="btn" onclick="agentAIZamknijModal()">Zamknij podgląd</button></footer></section>`;
  modal.addEventListener("click",e=>{if(e.target===modal)agentAIZamknijModal();});
  document.body.appendChild(modal);document.addEventListener("keydown",agentAIModalKlawisz);
  modal.querySelector(".supplier-preview-close")?.focus();
}
function agentAIEmailProducentaHTML(z,dostawca,pozycje){
  const przygotowane=(Array.isArray(pozycje)?pozycje:[]).map(p=>({...p,kodEksportowy:agentAIKodPozycjiProducenta(p)})),braki=przygotowane.filter(p=>!p.kodEksportowy),sztuk=przygotowane.reduce((s,p)=>s+Math.max(0,Number(p.ilosc)||0),0),rows=przygotowane.map(p=>`<tr><td><b>${esc(p.kodEksportowy||"BRAK KODU")}</b></td><td>${esc(p.nazwa||"Produkt")}</td><td><b>${esc(Number(p.ilosc)||0)}</b></td></tr>`).join("");
  const key=producentKlucz(dostawca),optima=key.includes("alexander")||key.includes("multigra");
  return `<div class="supplier-email-sheet"><div class="supplier-email-meta"><span>Do: <b>${esc(producentPoNazwie(dostawca)?.orderEmail||"adres nieuzupełniony")}</b></span><span>Temat: <b>${esc(`Zamówienie ${z.numer||z.id} — Artway-TM`)}</b></span></div>${braki.length?`<div class="backend-note warn"><b>Wysyłka zablokowana:</b> ${braki.length} pozycji wymaga uzupełnienia kodu w kartotece.</div>`:""}<div class="supplier-email-message"><header class="supplier-email-brand"><div><span>Artway-TM • zamówienie</span><h3>${esc(z.numer||z.id)}</h3></div><small>${esc(dostawca)}<br>${przygotowane.length} pozycji • ${sztuk} szt.</small></header><div class="supplier-email-content"><p>Cześć,<br>poniżej dzisiejsze zamówienie.</p><div class="supplier-email-order-table"><table><thead><tr><th>Kod produktu</th><th>Nazwa</th><th>Zamawiana ilość</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">Razem</td><td><b>${sztuk} szt.</b></td></tr></tfoot></table></div><p>Pozdrowienia dla całej ekipy!<br><b>Artway-TM</b></p>${optima?`<small class="supplier-optima-note"><b>Załącznik Comarch ERP Optima:</b> Ogólne → Kolektor danych → Importuj pozycje → wskaż TXT → zaznacz „Pobieraj ceny z programu”. Plik bez nagłówka; ceny są celowo puste.</small>`:""}</div></div></div>`;
}
function agentAIPodgladEmailaProducenta(id,dostawca){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const pozycje=(z.pozycje||[]).filter(p=>String(p.dostawca||agentAIDostawcaZlecenia(z))===String(dostawca));
  if(!pozycje.length){toast("Brak pozycji tego producenta");return;}
  agentAIOtworzModal(`E-mail do: ${dostawca}`,agentAIEmailProducentaHTML(z,dostawca,pozycje),`${pozycje.length} pozycji • wersja ${Math.max(1,Number(z.revision)||1)}`);
}
function agentAIPobierzOptimaTXT(id,dostawca){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const pozycje=(z.pozycje||[]).filter(p=>String(p.dostawca||agentAIDostawcaZlecenia(z))===String(dostawca)),dane=agentAIPrzygotujOptimaZlecenie(pozycje);
  if(agentAIEksportZablokowanyPrzezBrakKodow(dane.braki,"Eksport Comarch ERP Optima"))return false;
  if(dane.wiersze.length){
    const producent=String(dostawca||"producent").replace(/[^a-z0-9_-]+/gi,"-"),numer=String(z.numer||z.id).replace(/[^a-z0-9_-]+/gi,"-");
    const key=producentKlucz(dostawca),optima=key.includes("alexander")||key.includes("multigra");
    pobierzPlik(`${producent}-${optima?"Optima":"zamowienie"}-${numer}.txt`,dane.tresc,"text/plain");
    toast(`${optima?"Comarch Optima":"Plik bezcenowy"}: pobrano ${dane.wiersze.length} pozycji`);return true;
  }
  toast("Brak pozycji możliwych do eksportu do Comarch Optima");return false;
}
function agentAIPlanZapiszOdpowiedzSerwera(d={}){
  const lista=Array.isArray(d.supplierOrders)?d.supplierOrders:null;
  if(lista)agentAIZlecenia=lista;
  else if(d.draft&&d.draft.id){
    const istnieje=(agentAIZlecenia||[]).some(x=>String(x.id)===String(d.draft.id));
    agentAIZlecenia=istnieje?(agentAIZlecenia||[]).map(x=>String(x.id)===String(d.draft.id)?d.draft:x):[d.draft,...(agentAIZlecenia||[])];
  }
  const poprzedni=chmuraWczytywanie;chmuraWczytywanie=true;
  try{zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);}finally{chmuraWczytywanie=poprzedni;}
}
async function agentAIPlanOdswiezPoOperacji(d={},komunikat="Zapisano zmianę"){
  agentAIPlanZapiszOdpowiedzSerwera(d);
  const pobrano=await chmuraWczytajStan().catch(()=>false);
  if(!pobrano&&d.rev!==undefined){
    chmuraStan={...chmuraStan,rev:Number(d.rev)||chmuraStan.rev,updated_at:d.updated_at||chmuraStan.updated_at};
    const poprzedni=chmuraWczytywanie;chmuraWczytywanie=true;try{zapiszLS("artway_chmura_rev",Number(d.rev)||0);}finally{chmuraWczytywanie=poprzedni;}
  }
  toast(komunikat);if(typeof odswiezPlanZatowarowaniaWidoku!=="function"||!odswiezPlanZatowarowaniaWidoku())renderuj();return d;
}
async function agentAIPlanBladOperacji(e,prefix="Nie zapisano zmiany"){
  if(Number(e?.status)===409||String(e?.code||"").includes("conflict")){
    toast("⚠️ Szkic zmienił się na innym urządzeniu. Pobieram aktualną wersję…");
    await chmuraPobierzWszystko().catch(()=>{});return;
  }
  toast(`⚠️ ${prefix}: ${e?.message||e}`);
}
function agentAIPlanProduktPoReferencji(value=""){
  const raw=String(value||"").trim(),id=raw.split(/\s*[•|]\s*/)[0].trim(),key=normalizujSzukanyTekst(raw).replace(/\s+/g,"");
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  return produkty.find(p=>String(p.id)===id)||produkty.find(p=>[p.externalId,p.sku,p.kodProducenta,p.mpn,p.gtin,p.ean].some(v=>normalizujSzukanyTekst(v).replace(/\s+/g,"")===key))||produkty.find(p=>normalizujSzukanyTekst(p.nazwa)===normalizujSzukanyTekst(raw));
}
function agentAIPlanDostawcy(){
  const zProduktow=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>agentAIDostawcaProduktu(p,magazynMetaProduktu(p.id))).filter(Boolean);
  return [...new Set([...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>p.name||p.nazwa),...(agentAIZlecenia||[]).map(agentAIDostawcaZlecenia),...zProduktow].map(x=>String(x||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
}
async function agentAIPlanDodajPozycje(event){
  event.preventDefault();const form=event.currentTarget,f=new FormData(form),supplier=String(f.get("supplier")||"").trim(),produkt=agentAIPlanProduktPoReferencji(f.get("product")||""),quantity=Math.max(1,parseInt(String(f.get("quantity")||1).replace(/[^\d-]/g,""),10)||1);
  if(!supplier){toast("Wybierz producenta");return false;}if(!produkt){toast("Wybierz istniejący produkt po ID, EXTERNAL_ID, SKU, EAN lub nazwie");return false;}
  const draft=(agentAIZlecenia||[]).find(z=>agentAIPlanDokumentAktywny(z)&&agentAIStatusRoboczyProducenta(z.status)&&producentKlucz(agentAIDostawcaZlecenia(z))===producentKlucz(supplier));
  const line=(draft?.pozycje||[]).find(p=>String(p.produktId)===String(produkt.id)),minimum=Number(line?.iloscPotrzebna||0),finalQuantity=Math.max(minimum,quantity),button=form.querySelector('button[type="submit"]');
  if(button)button.disabled=true;
  try{
    const body={supplier,productId:String(produkt.id),quantity:finalQuantity,product:{externalId:String(produkt.externalId||""),sku:String(produkt.sku||""),kodProducenta:String(produkt.kodProducenta||produkt.mpn||""),ean:String(produkt.gtin||produkt.ean||""),nazwa:String(produkt.nazwa||"Produkt")}};
    if(draft){body.draftId=draft.id;body.expectedRevision=Math.max(1,Number(draft.revision)||1);}
    const d=await chmura("supplier-order-line-upsert",{method:"POST",body,timeout:45000});
    form.reset();await agentAIPlanOdswiezPoOperacji(d,`✅ ${produkt.nazwa}: ${finalQuantity} szt. w szkicu ${supplier}`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie dodano pozycji");}finally{if(button?.isConnected)button.disabled=false;}
  return false;
}
function agentAIPlanReczneDodanieHTML(){
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).slice().sort((a,b)=>String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl")),dostawcy=agentAIPlanDostawcy();
  return `<details class="supplier-manual-add"><summary>➕ Dodaj ręcznie pozycję do szkicu</summary><form onsubmit="return agentAIPlanDodajPozycje(event)"><label>Producent<select name="supplier" required><option value="">Wybierz producenta…</option>${dostawcy.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select></label><label class="supplier-manual-product">Produkt<input name="product" list="supplierRestockProducts" required autocomplete="off" placeholder="ID, EXTERNAL_ID, SKU, EAN lub dokładna nazwa"><datalist id="supplierRestockProducts">${produkty.slice(0,3000).map(p=>`<option value="${esc(`${p.id} • ${p.externalId||p.sku||p.kodProducenta||p.gtin||p.ean||"bez kodu"} • ${p.nazwa||"Produkt"}`)}"></option>`).join("")}</datalist></label><label>Łączna ilość w szkicu<input name="quantity" type="number" min="1" step="1" value="1" required></label><button class="btn" type="submit">Dodaj do właściwego szkicu</button></form><small>Zmiana aktualizuje właściwy szkic i tworzy nową rewizję. Nic nie jest wysyłane automatycznie.</small></details>`;
}
function agentAIZlecenieTabelaDostawcyHTML(z,dostawca,pozycje){
  const suma=pozycje.reduce((s,p)=>s+Number(p.ilosc||0),0),producer=producentPoNazwie(dostawca),editable=agentAIStatusRoboczyProducenta(z.status),key=producentKlucz(dostawca),optima=key.includes("alexander")||key.includes("multigra"),optimaDane=optima?agentAIPrzygotujOptimaZlecenie(pozycje):null;
  return `<section class="supplier-split-card"><header><div><span class="supplier-chip">🏭 ${esc(dostawca)}</span><h4>Zamówienie: ${pozycje.length} pozycji / ${suma} szt.</h4><small>${producer?.orderEmail?`✉️ ${esc(producer.orderEmail)}`:"uzupełnij e-mail w kartotece producenta"}</small></div><div class="diag-actions"><button class="btn" type="button" onclick="agentAIPodgladEmailaProducenta(${jsArg(z.id)},${jsArg(dostawca)})">👁️ E-mail i tabela</button><button class="btn ghost" type="button" onclick="agentAIPobierzOptimaTXT(${jsArg(z.id)},${jsArg(dostawca)})">📥 ${optima?"Comarch Optima TXT":"TXT bez cen"}</button><a class="btn ghost" href="#/admin/agent-ai/producenci">Kontakt</a></div></header>
  <div class="warehouse-worktable-wrap"><table class="log-table supplier-order-products"><thead><tr><th>Produkt i kod</th><th>Potrzeba</th><th>Zamawiam</th><th>Stan magazynu</th><th>Stan przyjęcia</th><th>Akcje</th></tr></thead><tbody>${pozycje.map(p=>{const produkt=produktMagazynowy(p.produktId)||p.product||{},identyfikator=agentAIStabilnyIdentyfikatorPozycji(p,produkt),potrzebna=Number(p.iloscPotrzebna??p.ilosc)||0,ilosc=Number(p.ilosc)||0,przyjeto=Math.max(0,Number(p.przyjeto)||0),pozostalo=Math.max(0,ilosc-przyjeto),nadwyzka=Math.max(0,ilosc-potrzebna),lineKey=p.stableKey||p.lineKey||p.id||"",wirtualny=String(p.produktId||"").startsWith("allegro-offer:");return `<tr><td><div class="supplier-product-cell"><span class="admin-product-thumb">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="" loading="lazy">`:`<span class="admin-product-thumb-fallback">${esc(produkt.ikona||"🎲")}</span>`}</span><div><b>${esc(p.nazwa||produkt.nazwa||"Produkt")}</b><strong>${esc(identyfikator.wartosc||"uzupełnij kod")}</strong><small>${esc(identyfikator.typ||"brak stabilnego identyfikatora")}${p.ean||produkt.ean?` • EAN ${esc(p.ean||produkt.ean)}`:""}</small></div></div></td><td><b>${potrzebna} szt.</b><small>${esc((p.zamowienia||[]).join(", ")||"pozycja ręczna")}</small></td><td>${editable?`<div class="supplier-qty-control"><button type="button" aria-label="Zmniejsz" onclick="agentAIPrzesunIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},-1,${jsArg(lineKey)})">−</button><input aria-label="Ilość zamawiana" inputmode="numeric" value="${ilosc}" onchange="agentAIUstawIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},this.value,${jsArg(lineKey)})"><button type="button" aria-label="Zwiększ" onclick="agentAIPrzesunIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},1,${jsArg(lineKey)})">+</button></div>`:`<b>${ilosc} szt.</b>`}<small>${nadwyzka?`nadwyżka +${nadwyzka} szt.`:"bez nadwyżki"}</small></td><td><b>${p.stan===null?"bez limitu":`${esc(p.stan||0)} szt.`}</b><small>rezerwacje ${esc(p.rezerwacje||0)} • ${esc(p.lokalizacja||"bez lokalizacji")}</small></td><td><div class="supplier-receive-summary"><span><b>${przyjeto}</b><small>przyjęto</small></span><span class="${pozostalo?"pending":"done"}"><b>${pozostalo}</b><small>pozostało</small></span></div><small>${pozostalo?"Korekta w przyjęciu dokumentu":"Pozycja rozliczona"}</small></td><td><div class="warehouse-worktable-actions">${editable?`<button class="btn ghost" onclick="agentAIPowiekszPozycjeZlecenia(${jsArg(z.id)},${jsArg(p.produktId)},${jsArg(lineKey)})">➕ Ilość</button>`:""}${wirtualny?`<a class="btn ghost" href="#/admin/allegro/oferty">🟠 Oferta</a>`:`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.produktId)}">✏️ Produkt</a>`}</div></td></tr>`;}).join("")}</tbody></table></div>
  <small class="supplier-optima-strip ${optima?(optimaDane.braki.length?"has-error":"is-ready"):"is-generic"}">${optima?`<b>Import Optimy:</b> ${optimaDane.braki.length?`brak kodu TOWAR w ${optimaDane.braki.length} pozycjach`:`TXT gotowy (${optimaDane.wiersze.length}/${pozycje.length})`}. Dokument → Ogólne → Kolektor danych → Importuj pozycje; następnie „Pobieraj ceny z programu”.`:`Plik TXT zawiera wyłącznie kod produktu i ilość — bez cen.`}</small></section>`;
}
function agentAIPrzyjecieDokumentuHTML(z={}){
  const pozycje=Array.isArray(z.pozycje)?z.pozycje:[],status=String(z.status||"").toLowerCase(),wyslane=!!z.emailSentAt||status.includes("wysłane do")||status.includes("częściowo zrealizowane")||status==="zrealizowane",zamowiono=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.ilosc)||0),0),przyjeto=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.przyjeto)||0),0),pozostalo=Math.max(0,zamowiono-przyjeto),pelne=!!zamowiono&&!pozostalo,partie=Array.isArray(z.receiptBatches)?z.receiptBatches:[];
  if(!wyslane)return `<section class="supplier-document-receipt is-locked"><div><span class="order-pro-label">Przyjęcie dostawy</span><b>Dostępne po wysłaniu zamówienia</b><small>Stan magazynu nie zostanie zmieniony przed wysłaniem dokumentu do producenta.</small></div></section>`;
  if(pelne)return `<section class="supplier-document-receipt is-complete"><div><span class="order-pro-label">Dokument przyjęty</span><b>✅ ${esc(przyjeto)} / ${esc(zamowiono)} szt. rozliczono</b><small>Powiązane zamówienia Allegro są teraz w etapie „Oczekuje na wysyłkę” i nie zasilają kolejnego zakupu.</small></div><span class="lvl lvl-ok">partie przyjęcia: ${partie.length||1}</span></section>`;
  const korekty=pozycje.map((p,index)=>{const zam=Math.max(0,Number(p.ilosc)||0),prz=Math.max(0,Number(p.przyjeto)||0),left=Math.max(0,zam-prz),lineKey=p.stableKey||p.lineKey||p.id||`line:${index}`;return `<label class="supplier-receipt-line"><span><b>${esc(p.nazwa||"Produkt")}</b><small>${esc(p.externalId||p.sku||p.kodProducenta||p.ean||p.produktId||"bez kodu")} • zamówiono ${zam} • dotąd przyjęto ${prz}</small></span><input type="number" min="0" step="1" value="${left}" data-line-key="${esc(lineKey)}" data-product-id="${esc(p.produktId||"")}" aria-label="Dostarczono teraz: ${esc(p.nazwa||"produkt")}"><em>${left} pozostało</em></label>`;}).join("");
  return `<section class="supplier-document-receipt"><div class="supplier-document-receipt-head"><div><span class="order-pro-label">Przyjęcie całego dokumentu</span><b>${pozostalo} szt. w ${pozycje.filter(p=>Number(p.przyjeto||0)<Number(p.ilosc||0)).length} pozycjach czeka na przyjęcie</b><small>Jedna operacja zwiększy stany, przypisze ilości do zamówień Allegro i przeniesie kompletne zlecenia do wysyłki.</small></div><button class="btn" type="button" onclick="agentAIPrzyjmijDokumentZlecenia(${jsArg(z.id)})">📥 Przyjmij dokument (${pozostalo} szt.)</button></div><details class="supplier-receipt-correction"><summary>✏️ Dostawa różni się od zamówienia — wprowadź korektę</summary><form onsubmit="return agentAIPrzyjmijDokumentZlecenia(${jsArg(z.id)},this,event)"><p>Wpisz faktyczną liczbę sztuk dostarczonych teraz. Wartość 0 oznacza brak pozycji; mniejsza ilość pozostawi ją do późniejszego przyjęcia, a większa zapisze nadwyżkę na magazynie.</p><div class="supplier-receipt-lines">${korekty}</div><button class="btn" type="submit">Przyjmij dokument z korektą</button></form></details></section>`;
}
function agentAIEtapyZleceniaProducenta(z={}){
  const revision=Math.max(1,Number(z.revision)||1),pozycje=Array.isArray(z.pozycje)?z.pozycje:[],stanSprawdzony=!!z.stockCheckedAt||!!pozycje.length&&pozycje.every(p=>Object.prototype.hasOwnProperty.call(p,"stan")&&p.iloscPotrzebna!==undefined),zatwierdzone=!!z.approvedAt&&Number(z.approvalRevision||0)===revision,wyslane=!!z.emailSentAt||String(z.status||"").toLowerCase().includes("wysłane do"),przyjeto=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.przyjeto)||0),0),zamowiono=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.ilosc)||0),0),przyjeteWszystko=!!zamowiono&&przyjeto>=zamowiono;
  return [
    {label:"Stan magazynowy",opis:stanSprawdzony?"brak policzony":"oczekuje na kontrolę",done:stanSprawdzony,current:!stanSprawdzony},
    {label:"Szkic producenta",opis:`wersja ${revision}`,done:true,current:false},
    {label:"Zatwierdzenie",opis:zatwierdzone?"potwierdzone przez administratora":"wymaga decyzji",done:zatwierdzone,current:stanSprawdzony&&!zatwierdzone},
    {label:"Zamówienie wysłane",opis:wyslane?"etap zakupowy zakończony":"nic nie wysłano",done:wyslane,current:zatwierdzone&&!wyslane},
    {label:"Dostawa",opis:przyjeteWszystko?"towar przyjęty":przyjeto?`${przyjeto}/${zamowiono} szt.`:"oczekuje na dostawę",done:przyjeteWszystko,current:wyslane&&!przyjeteWszystko},
    {label:"Oczekuje na wysyłkę",opis:przyjeteWszystko?"zamówienia gotowe do obsługi":"po pełnym przyjęciu",done:przyjeteWszystko,current:false}
  ];
}
function agentAIEtapyZleceniaHTML(z){return `<div class="supplier-workflow">${agentAIEtapyZleceniaProducenta(z).map((x,i)=>`<span class="${x.done?"done":x.current?"current":"waiting"}"><b>${i+1}. ${esc(x.label)}</b><small>${esc(x.opis)}</small></span>`).join("")}</div>`;}
let agentAIPlanSzukaj="",agentAIPlanFiltrProducenta="wszyscy",agentAIPlanFiltrStatusu="aktywne";
function agentAIPlanOdswiezWidok(){if(typeof odswiezPlanZatowarowaniaWidoku==="function"&&odswiezPlanZatowarowaniaWidoku())return true;renderuj();return false;}
function agentAIPlanDokumentAktywny(z={}){
  const status=String(z.status||"").trim().toLowerCase();
  if(["zrealizowane","anulowane","zastąpione","zastapione","superseded","wyczyszczone","cleared"].includes(status))return false;
  return (Array.isArray(z.pozycje)?z.pozycje:[]).some(p=>{
    const zamowiono=Math.max(0,Number(p.ilosc??p.quantity)||0),potrzeba=Math.max(0,Number(p.iloscPotrzebna??p.baseRequired)||0),nadwyzka=Math.max(0,Number(p.manualExtra??p.nadwyzka)||0),przyjeto=Math.max(0,Number(p.przyjeto??p.received)||0);
    return zamowiono>0||potrzeba>0||nadwyzka>0||przyjeto>0;
  });
}
function agentAIPlanDokumentPasuje(z={}){
  const status=String(z.status||"szkic").toLowerCase(),aktywny=agentAIPlanDokumentAktywny(z),revision=Math.max(1,Number(z.revision)||1),approved=!!z.approvedAt&&Number(z.approvalRevision||0)===revision,sent=!!z.emailSentAt||status.includes("wysłane do"),received=(z.pozycje||[]).some(p=>Number(p.przyjeto)>0);
  if(agentAIPlanFiltrProducenta!=="wszyscy"&&producentKlucz(agentAIDostawcaZlecenia(z))!==producentKlucz(agentAIPlanFiltrProducenta))return false;
  if(agentAIPlanFiltrStatusu==="aktywne"&&!aktywny)return false;if(agentAIPlanFiltrStatusu==="szkice"&&!agentAIStatusRoboczyProducenta(status))return false;if(agentAIPlanFiltrStatusu==="zatwierdzone"&&!approved)return false;if(agentAIPlanFiltrStatusu==="wyslane"&&!sent)return false;if(agentAIPlanFiltrStatusu==="przyjecie"&&(!sent||(z.pozycje||[]).every(p=>Number(p.przyjeto||0)>=Number(p.ilosc||0))))return false;if(agentAIPlanFiltrStatusu==="zamkniete"&&aktywny)return false;
  const q=normalizujSzukanyTekst(agentAIPlanSzukaj);if(!q)return true;
  return normalizujSzukanyTekst([z.id,z.numer,z.status,agentAIDostawcaZlecenia(z),...(z.pozycje||[]).flatMap(p=>[p.nazwa,p.externalId,p.sku,p.kodProducenta,p.mpn,p.ean,p.gtin])].join(" ")).includes(q);
}
function agentAIPlanSzukajDokumenty(input){agentAIPlanSzukaj=String(input?.value||"");clearTimeout(window.__supplierPlanSearch);window.__supplierPlanSearch=setTimeout(()=>odswiezPlanZatowarowaniaWidoku(),180);}
function agentAIPlanWyczyscFiltry(){agentAIPlanSzukaj="";agentAIPlanFiltrProducenta="wszyscy";agentAIPlanFiltrStatusu="aktywne";odswiezPlanZatowarowaniaWidoku();}
function agentAIHistoriaEmailiProducentaHTML(z={}){
  const proby=Array.isArray(z.emailSendHistory)?z.emailSendHistory:[],korekty=Array.isArray(z.supersededSends)?z.supersededSends:[];
  if(!proby.length&&!korekty.length&&!z.emailSentAt)return "";
  const wiersze=[...proby.map(x=>({at:x.at,typ:x.mode==="resend"?"Ponowna wysyłka":"Wysyłka",opis:`dostarczono ${Number(x.delivered)||0} • pominięto duplikaty ${Number(x.skippedDuplicates)||0} • błędy ${Number(x.failed)||0}${x.reason?` • ${x.reason}`:""}`,operator:x.operator})),...korekty.map(x=>({at:x.supersededAt,typ:`Korekta wersji ${x.revision||"—"}`,opis:x.reason||"Poprzednia wysyłka oznaczona jako zastąpiona",operator:x.supersededBy}))].sort((a,b)=>String(b.at||"").localeCompare(String(a.at||""))).slice(0,20);
  return `<details class="supplier-email-audit"><summary>🕓 Historia wysyłek i korekt (${Math.max(1,proby.length+korekty.length)})</summary><div>${wiersze.map(x=>`<article><b>${esc(x.typ)}</b><span>${esc(allegroDataTxt(x.at))}</span><p>${esc(x.opis)}</p><small>${esc(x.operator||"administrator")}</small></article>`).join("")||`<article><b>Ostatnia wysyłka</b><span>${esc(allegroDataTxt(z.emailSentAt))}</span></article>`}</div></details>`;
}
function agentAIPlanKartaDokumentuHTML(z){
  const status=String(z.status||"szkic").toLowerCase(),zamkniete=!agentAIPlanDokumentAktywny(z),robocze=!zamkniete&&agentAIStatusRoboczyProducenta(status),grupy=agentAIGrupujPoDostawcy(z.pozycje||[]),revision=Math.max(1,Number(z.revision)||1),approvedCurrent=!!z.approvedAt&&Number(z.approvalRevision||0)===revision,missingEmail=grupy.some(([d])=>!producentPoNazwie(d)?.orderEmail),zamowiono=(z.pozycje||[]).reduce((s,p)=>s+Number(p.ilosc||0),0),przyjeto=(z.pozycje||[]).reduce((s,p)=>s+Number(p.przyjeto||0),0),wyslane=!!z.emailSentAt||status.includes("wysłane do")||status.includes("częściowo zrealizowane")||status==="zrealizowane",czesciowe=status==="częściowo wysłane e-mailem",pelnaWysylka=wyslane&&!czesciowe,liczbaWysylek=Math.max(Number(z.emailSendCount)||0,(Array.isArray(z.emailSendHistory)?z.emailSendHistory.filter(x=>Number(x.delivered)>0).length:0),z.emailSentAt?1:0);
  return `<article class="supplier-order-card ${zamkniete?"is-closed":""}"><header class="supplier-order-head"><div><span class="order-pro-label">${esc(z.tryb==="niskie"?"Uzupełnienie magazynu":"Braki i pozycje ręczne")} • wersja ${revision}</span><h3>${esc(z.numer||z.id)}</h3><small>${esc(z.dataTxt||allegroDataTxt(z.data))} • ${grupy.length} producentów • ${(z.pozycje||[]).length} pozycji • ${esc(z.sztuk||zamowiono)} szt. • przyjęto ${przyjeto}</small></div><div class="supplier-order-status"><span class="lvl ${status.includes("wysłane")||status==="zrealizowane"?"lvl-ok":"lvl-info"}">${esc(z.status||"szkic")}</span><small>${z.emailSentAt?`Ostatni e-mail: ${esc(allegroDataTxt(z.emailSentAt))} • wysyłek ${liczbaWysylek}`:z.lastEmailSentAt?`Poprzednia wysyłka: ${esc(allegroDataTxt(z.lastEmailSentAt))} • trwa korekta`:z.telegramSentAt?`Telegram (podgląd): ${esc(allegroDataTxt(z.telegramSentAt))}`:zamkniete?"Dokument historyczny — nie wymaga działania":"Dokument otwarty — oczekuje na kontrolę"}</small></div></header>${agentAIEtapyZleceniaHTML(z)}${agentAIPrzyjecieDokumentuHTML(z)}${approvedCurrent&&robocze?`<div class="backend-note"><b>Wersja ${revision} zatwierdzona.</b> Każda zmiana ilości lub nowy brak cofnie dokument do ponownej kontroli.</div>`:""}${z.correctionOpenedAt&&!wyslane?`<div class="backend-note warn"><b>Trwa korekta poprzedniej wysyłki.</b> ${esc(z.correctionReason||"")} Po zmianach zatwierdź aktualną wersję i wyślij ją ponownie.</div>`:""}<div class="supplier-split-list">${grupy.map(([d,items])=>agentAIZlecenieTabelaDostawcyHTML(z,d,items)).join("")}</div><footer class="supplier-order-actions">${zamkniete?"":`<button class="btn telegram-btn" onclick="agentAIWyslijZlecenieTelegram(${jsArg(z.id)})">✈️ Wyślij podgląd na Telegram</button>`}${robocze&&!approvedCurrent?`<button class="btn ghost" onclick="agentAIZatwierdzZlecenie(${jsArg(z.id)})">✅ Zatwierdź wersję ${revision}</button>`:""}${!pelnaWysylka?`<button class="btn" onclick="agentAIWyslijZlecenieEmail(${jsArg(z.id)})" ${((!approvedCurrent&&!czesciowe)||missingEmail||zamkniete)?"disabled":""}>✉️ ${czesciowe?"Ponów brakujące e-maile":"Wyślij e-mailem do producenta"}</button>`:""}${pelnaWysylka?`<button class="btn" onclick="agentAIPonowEmailProducenta(${jsArg(z.id)})" ${missingEmail?"disabled":""}>🔁 Wyślij ponownie</button>`:""}${wyslane&&!przyjeto?`<button class="btn ghost" onclick="agentAIPrzygotujKorekteZlecenia(${jsArg(z.id)})">✏️ Utwórz korektę</button>`:""}<button class="btn ghost" onclick="agentAIPobierzZlecenieCSV(${jsArg(z.id)})">📤 Tabela bez cen CSV</button>${robocze?`<button class="btn danger" onclick="agentAIUsunZlecenie(${jsArg(z.id)})">🗑️ Anuluj szkic</button>`:""}</footer>${wyslane?`<div class="supplier-recovery-note"><b>Bezpieczne działania po wysyłce</b><span>„Wyślij ponownie” przekazuje identyczną zatwierdzoną wersję i wymaga podania powodu. „Utwórz korektę” nie usuwa dostarczonego e-maila — zachowuje go w audycie i otwiera nową wersję do edycji.</span></div>`:""}${agentAIHistoriaEmailiProducentaHTML(z)}${missingEmail&&!zamkniete?`<div class="backend-note" style="border-color:#fed7aa;background:#fff7ed"><b>Brak e-maila producenta.</b> Uzupełnij kartotekę przed zatwierdzoną wysyłką.</div>`:""}</article>`;
}
function agentAIZleceniaPanelHTML(){
  const wszystkie=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))),lista=wszystkie.filter(agentAIPlanDokumentPasuje),aktywne=lista.filter(agentAIPlanDokumentAktywny),historia=lista.filter(z=>!agentAIPlanDokumentAktywny(z)),otwarteWszystkie=wszystkie.filter(agentAIPlanDokumentAktywny),approved=otwarteWszystkie.filter(z=>z.approvedAt&&Number(z.approvalRevision||0)===Math.max(1,Number(z.revision)||1)).length,sent=otwarteWszystkie.filter(z=>z.emailSentAt||String(z.status||"").toLowerCase().includes("wysłane do")).length,doPrzyjecia=otwarteWszystkie.filter(z=>(z.emailSentAt||String(z.status||"").toLowerCase().includes("wysłane do"))&&(z.pozycje||[]).some(p=>Number(p.przyjeto||0)<Number(p.ilosc||0))).length,dostawcy=agentAIPlanDostawcy();
  return `<div class="panel agent-orders-panel supplier-restock-plan"><div class="order-section-head"><div><span class="order-pro-label">Dokumenty producentów</span><h2 style="margin-top:.25rem">🧾 Zamówienia i przyjęcia</h2><p class="order-detail-lead">Kontrola tabeli, zatwierdzenie, wysyłka i przyjęcie dostawy — w jednym przebiegu.</p></div><div class="diag-actions"><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()">↻ Przelicz aktualne braki</button><a class="btn ghost" href="#/admin/agent-ai/producenci">🏭 Producenci</a></div></div>
  <nav class="supplier-plan-statusbar" aria-label="Filtry dokumentów producentów"><button class="${agentAIPlanFiltrStatusu==="aktywne"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="aktywne"}" onclick="agentAIPlanFiltrStatusu='aktywne';odswiezPlanZatowarowaniaWidoku()"><b>${otwarteWszystkie.length}</b><small>aktywne dokumenty</small></button><button class="${agentAIPlanFiltrStatusu==="zatwierdzone"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="zatwierdzone"}" onclick="agentAIPlanFiltrStatusu='zatwierdzone';odswiezPlanZatowarowaniaWidoku()"><b>${approved}</b><small>zatwierdzone</small></button><button class="${agentAIPlanFiltrStatusu==="wyslane"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="wyslane"}" onclick="agentAIPlanFiltrStatusu='wyslane';odswiezPlanZatowarowaniaWidoku()"><b>${sent}</b><small>wysłane / w dostawie</small></button><button class="${agentAIPlanFiltrStatusu==="przyjecie"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="przyjecie"}" onclick="agentAIPlanFiltrStatusu='przyjecie';odswiezPlanZatowarowaniaWidoku()"><b>${doPrzyjecia}</b><small>do przyjęcia</small></button><button class="${agentAIPlanFiltrStatusu==="zamkniete"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="zamkniete"}" onclick="agentAIPlanFiltrStatusu='zamkniete';odswiezPlanZatowarowaniaWidoku()"><b>${wszystkie.length-otwarteWszystkie.length}</b><small>historia</small></button></nav>
  <div class="supplier-plan-filters"><label class="supplier-plan-search">Wyszukaj<input id="supplierPlanSearch" value="${esc(agentAIPlanSzukaj)}" placeholder="Nazwa, EXTERNAL_ID, SKU, kod producenta, EAN lub numer szkicu…" oninput="agentAIPlanSzukajDokumenty(this)" autocomplete="off"></label><label>Producent<select id="supplierPlanSupplierFilter" onchange="agentAIPlanFiltrProducenta=this.value;odswiezPlanZatowarowaniaWidoku()"><option value="wszyscy">Wszyscy producenci</option>${dostawcy.map(x=>`<option value="${esc(x)}" ${agentAIPlanFiltrProducenta===x?"selected":""}>${esc(x)}</option>`).join("")}</select></label><label>Status<select id="supplierPlanStatusFilter" onchange="agentAIPlanFiltrStatusu=this.value;odswiezPlanZatowarowaniaWidoku()">${[["aktywne","Aktywne — domyślnie"],["szkice","Szkice do kontroli"],["zatwierdzone","Zatwierdzone wersje"],["wyslane","Wysłane / w dostawie"],["przyjecie","Z rozpoczętym przyjęciem"],["zamkniete","Historia: zakończone, anulowane i zastąpione"],["wszystkie","Wszystkie"]].map(([v,l])=>`<option value="${v}" ${agentAIPlanFiltrStatusu===v?"selected":""}>${l}</option>`).join("")}</select></label><button class="btn ghost" onclick="agentAIPlanWyczyscFiltry()">Wyczyść filtry</button></div>
  ${agentAIPlanReczneDodanieHTML()}<div class="admin-search-results-line"><span>Znaleziono <b>${lista.length}</b> dokumentów • aktywne ${aktywne.length}</span><span>Domyślnie historia jest zwinięta</span></div>
  <div class="supplier-order-list">${aktywne.map(agentAIPlanKartaDokumentuHTML).join("")||`<div class="backend-note">Nie ma aktywnych szkiców pasujących do filtrów. Uzgodnij braki albo dodaj pozycję ręcznie powyżej.</div>`}</div>
  <details class="supplier-order-history" ${agentAIPlanFiltrStatusu==="zamkniete"?"open":""}><summary>🕓 Historia zakończonych, anulowanych i zastąpionych (${historia.length})</summary><div class="supplier-order-list">${historia.map(agentAIPlanKartaDokumentuHTML).join("")||`<div class="backend-note">Brak zamkniętych dokumentów pasujących do filtrów.</div>`}</div></details></div>`;
}
function agentAIPowiekszPozycjeZlecenia(id, produktId, lineKey=""){
  const raw=prompt("O ile sztuk powiększyć tę pozycję? Nadwyżka zostanie oznaczona do przyjęcia na magazyn po dostawie.","1");
  if(raw===null) return;
  const delta=Math.max(0,parseInt(String(raw).replace(",",".").replace(/[^\d.-]/g,""),10)||0);
  if(!delta){ toast("Podaj dodatnią liczbę sztuk"); return; }
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id)),p=(z?.pozycje||[]).find(x=>(lineKey&&String(x.stableKey||x.lineKey||x.id||"")===String(lineKey))||String(x.produktId)===String(produktId));
  if(!z||!p){toast("Nie znaleziono pozycji");return;}
  agentAIUstawIloscPozycji(id,produktId,(Number(p.ilosc)||0)+delta,lineKey);
}
async function agentAIUstawIloscPozycji(id,produktId,wartosc,lineKey=""){
  const wpisana=Math.max(0,parseInt(String(wartosc??0).replace(/[^\d-]/g,""),10)||0);
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id)),p=(z?.pozycje||[]).find(x=>(lineKey&&String(x.stableKey||x.lineKey||x.id||"")===String(lineKey))||String(x.produktId)===String(produktId));
  if(!z||!p){toast("Nie znaleziono pozycji");return;}
  const potrzebna=Math.max(0,Number(p.iloscPotrzebna)||0),ilosc=Math.max(potrzebna,wpisana);
  try{
    const body={draftId:z.id,supplier:String(p.dostawca||agentAIDostawcaZlecenia(z)),productId:String(produktId||p.produktId||""),lineKey:String(lineKey||p.stableKey||p.lineKey||p.id||""),quantity:ilosc,expectedRevision:Math.max(1,Number(z.revision)||1)};
    const d=await chmura("supplier-order-line-upsert",{method:"POST",body,timeout:45000});
    await agentAIPlanOdswiezPoOperacji(d,`✅ Ilość w szkicu: ${ilosc} szt.`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie zmieniono ilości");}
}
function agentAIPrzesunIloscPozycji(id,produktId,delta,lineKey=""){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  const p=(z?.pozycje||[]).find(x=>(lineKey&&String(x.stableKey||x.lineKey||x.id||"")===String(lineKey))||String(x.produktId)===String(produktId));
  if(!p){toast("Nie znaleziono pozycji");return;}
  agentAIUstawIloscPozycji(id,produktId,Math.max(0,(Number(p.ilosc)||0)+Number(delta||0)),lineKey);
}
async function agentAIWyslijZlecenieTelegram(id,dostawca=""){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zlecenia producenta");return;}
  try{
    toast("Przygotowuję tabelę i wysyłam na Telegram…");
    const d=await chmura("telegram-send-supplier-order",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1),supplier:dostawca||""},timeout:30000});
    zapiszHistorieAgenta("telegram",`Wysłano zamówienie ${z.numer||z.id} na Telegram`,{zlecenieId:id,dostawcy:d.suppliers||[],wiadomosci:(d.messageIds||[]).length,pliki:Number(d.documents)||0});
    toast(`Telegram: ${d.tables||0} wiadomości • ${Number(d.documents)||0} pliki do edycji ✅`);
  }catch(e){toast("⚠️ Telegram: "+(e.message||e));}
}
function agentAIDaneProducentaDoEmaila(p={}){return {name:p.name||p.nazwa||""};}
async function agentAIWyslijZlecenieEmail(id,opcje={}){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const revision=Math.max(1,Number(z.revision)||1),forceResend=opcje.forceResend===true,resendReason=String(opcje.resendReason||"").trim(),status=String(z.status||"").toLowerCase();
  const zwyklaWysylka=["zaakceptowane","częściowo wysłane e-mailem"].includes(status),ponowienie=forceResend&&!!z.emailSentAt&&["wysłane do producenta","wysłane do dostawcy","częściowo wysłane e-mailem","częściowo zrealizowane","zrealizowane"].includes(status);
  const approvalOk=forceResend?ponowienie:(!!z.approvedAt&&Number(z.approvalRevision||0)===revision);
  if((!zwyklaWysylka&&!ponowienie)||!approvalOk){toast(forceResend?"⚠️ Ten dokument nie ma potwierdzonej wcześniejszej wysyłki":"⚠️ Najpierw zatwierdź dokładnie tę wersję zamówienia");return;}
  if(forceResend&&resendReason.length<3){toast("Podaj powód ponownej wysyłki");return;}
  const names=[...new Set((z.pozycje||[]).map(p=>String(p.dostawca||agentAIDostawcaZlecenia(z)).trim()).filter(Boolean))];
  const suppliers=names.map(producentPoNazwie).filter(Boolean);
  const missing=names.filter(name=>!producentPoNazwie(name)?.orderEmail);
  if(missing.length){toast(`⚠️ Uzupełnij e-mail zamówień w kartotece: ${missing.join(", ")}`);location.hash="#/admin/agent-ai/producenci";return;}
  const adresaci=suppliers.map(p=>`${p.name||p.nazwa} <${p.orderEmail}>`).join("\n"),sztuk=(z.pozycje||[]).reduce((s,p)=>s+Number(p.ilosc||0),0);
  if(!confirm(`${forceResend?"OSTATECZNE POTWIERDZENIE PONOWNEJ WYSYŁKI":"OSTATECZNE POTWIERDZENIE WYSYŁKI"}\n\nDokument: ${z.numer||z.id} • wersja ${revision}\nPozycji: ${(z.pozycje||[]).length} • sztuk: ${sztuk}${forceResend?`\nPowód: ${resendReason}`:""}\n\nAdresaci:\n${adresaci}\n\nKliknięcie OK naprawdę wyśle e-mail do producenta. Czy potwierdzasz?`)){toast("Wysyłka anulowana — żaden e-mail nie został wysłany");return;}
  try{
    toast("Wysyłam zatwierdzone zamówienie e-mailem do producenta…");
    const d=await chmura("email-send-supplier-order",{method:"POST",body:{order:{id:z.id,revision},suppliers:suppliers.map(agentAIDaneProducentaDoEmaila),forceResend,resendReason},timeout:90000});
    const sent=(d.results||[]).filter(x=>x.sent),failed=(d.results||[]).filter(x=>!x.sent);
    if(Array.isArray(d.supplierOrders)||d.draft){
      zapiszHistorieAgenta("email-producent",d.allSent?`Wysłano ${z.numer||z.id} e-mailem do producenta`:`Częściowa wysyłka ${z.numer||z.id}`,{zlecenieId:id,revision,wyslane:sent.map(x=>x.supplier),bledy:failed.map(x=>({supplier:x.supplier,error:x.error}))});
      await agentAIPlanOdswiezPoOperacji(d,d.allSent?(forceResend?"✅ Ponownie wysłano e-mail. Próba została zapisana w historii.":"✅ Zamówienie wysłane e-mailem. Przyjęcie dostawy jest teraz dostępne."):`⚠️ Wysłano ${sent.length}, nie wysłano ${failed.length}. Ponów brakujące wiadomości.`);return;
    }
    zapiszHistorieAgenta("email-producent",d.allSent?`Wysłano ${z.numer||z.id} e-mailem do producenta`:`Częściowa wysyłka ${z.numer||z.id}`,{zlecenieId:id,revision,wyslane:sent.map(x=>x.supplier),bledy:failed.map(x=>({supplier:x.supplier,error:x.error}))});
    await agentAIUzgodnijPlanZSerwerem({silent:true});
    toast(d.allSent?"✅ Zamówienie wysłane e-mailem. Plan pobrano ponownie z serwera.":`⚠️ Wysłano ${sent.length}, nie wysłano ${failed.length}. Ponów przyciskiem — wysłane wiadomości nie zdublują się.`);
  }catch(e){toast("⚠️ E-mail do producenta: "+(e.message||e));}
}
async function agentAIPrzyjmijPozycjeZlecenia(id, produktId, wartosc="", lineKey=""){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  const poz=(Array.isArray(z?.pozycje)?z.pozycje:[]).find(p=>(lineKey&&String(p.stableKey||p.lineKey||p.id||"")===String(lineKey))||String(p.produktId)===String(produktId));
  if(!z||!poz){ toast("Nie znaleziono pozycji do przyjęcia"); return; }
  const pozostalo=Math.max(0,(Number(poz.ilosc)||0)-(Number(poz.przyjeto)||0));
  const raw=String(wartosc||"").trim()||prompt(`Ile sztuk faktycznie dostarczono dla: ${poz.nazwa}?`,String(Math.max(1,pozostalo)));
  if(raw===null||raw==="") return;
  const ilosc=Math.max(0,parseInt(String(raw).replace(",",".").replace(/[^\d.-]/g,""),10)||0);
  if(!ilosc){ toast("Podaj dodatnią liczbę sztuk"); return; }
  const nadwyzka=Math.max(0,ilosc-pozostalo),stanPrzed=stanMagazynuId(produktId);
  if(!confirm(`${nadwyzka?`Dostawa jest większa od pozostałej ilości o ${nadwyzka} szt. Nadwyżka zwiększy stan magazynowy.\n\n`:""}Przyjąć faktycznie dostarczone ${ilosc} szt. produktu „${poz.nazwa}”?\nStan przed operacją: ${stanPrzed===null?"niemonitorowany":stanPrzed+" szt."}.`)){toast("Przyjęcie anulowane — stan nie został zmieniony");return;}
  const button=document.activeElement instanceof HTMLButtonElement?document.activeElement:null;if(button)button.disabled=true;
  try{
    const requestId=`receive-${String(id)}-${String(lineKey||produktId)}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const d=await chmura("supplier-order-receive",{method:"POST",body:{draftId:z.id,productId:String(produktId||poz.produktId||""),lineKey:String(lineKey||poz.stableKey||poz.lineKey||poz.id||""),quantity:ilosc,requestId,expectedReceiptRevision:Math.max(0,Number(z.receiptRevision)||0)},timeout:60000});
    await agentAIPlanOdswiezPoOperacji(d,`✅ Przyjęto ${ilosc} szt.${nadwyzka?` • nadwyżka ${nadwyzka} szt. zwiększyła stan`:""}`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie przyjęto dostawy");}finally{if(button?.isConnected)button.disabled=false;}
}
async function agentAIPrzyjmijDokumentZlecenia(id,form=null,event=null){
  if(event)event.preventDefault();
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono dokumentu do przyjęcia");return false;}
  const pozycje=Array.isArray(z.pozycje)?z.pozycje:[],pozostalo=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.ilosc||0)-Number(p.przyjeto||0)),0);
  if(!pozostalo){toast("Dokument jest już w całości przyjęty");return false;}
  let receipts=null,units=pozostalo,roznice=0;
  if(form){
    receipts=[...form.querySelectorAll("[data-line-key]")].map(input=>({lineKey:String(input.dataset.lineKey||""),productId:String(input.dataset.productId||""),quantity:Math.max(0,parseInt(String(input.value||0).replace(/[^\d-]/g,""),10)||0)}));
    units=receipts.reduce((s,x)=>s+x.quantity,0);
    roznice=receipts.filter((x,index)=>x.quantity!==Math.max(0,Number(pozycje[index]?.ilosc||0)-Number(pozycje[index]?.przyjeto||0))).length;
  }
  const komunikat=form
    ? `Przyjąć dokument z korektą?\n\nDostarczono teraz: ${units} szt.\nPozycji ze zmienioną ilością: ${roznice}.\nBraki pozostaną otwarte, a nadwyżki zwiększą stan.`
    : `Przyjąć cały dokument producenta?\n\nNa magazyn trafi ${units} szt. Jedna operacja rozdzieli ilości na właściwe zamówienia Allegro i przeniesie kompletne zlecenia do „Oczekuje na wysyłkę”.`;
  if(!confirm(komunikat)){toast("Przyjęcie anulowane — żaden stan nie został zmieniony");return false;}
  const button=form?.querySelector('button[type="submit"]')||(document.activeElement instanceof HTMLButtonElement?document.activeElement:null);if(button)button.disabled=true;
  try{
    const requestId=`receive-document-${String(id)}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const body={draftId:z.id,requestId,expectedReceiptRevision:Math.max(0,Number(z.receiptRevision)||0)};
    if(receipts)body.receipts=receipts;
    const d=await chmura("supplier-order-document-receive",{method:"POST",body,timeout:90000});
    const batch=d.receiptBatch||{},workflow=Number(d.procurementWorkflow?.changed)||0;
    await agentAIPlanOdswiezPoOperacji(d,`✅ Przyjęto dokument: ${batch.receivedUnits??units} szt.${batch.missingLines?` • ${batch.missingLines} pozycji czeka na uzupełnienie`:" • kompletne zamówienia oczekują na wysyłkę"}${workflow?` • zaktualizowano ${workflow} zleceń Allegro`:""}`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie przyjęto dokumentu");}finally{if(button?.isConnected)button.disabled=false;}
  return false;
}
function agentAINadwyzkiDoPrzyjecia(){
  const out=[];
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(agentAIPlanDokumentAktywny).forEach(z=>{
    (Array.isArray(z.pozycje)?z.pozycje:[]).forEach(p=>{
      const ilosc=Number(p.ilosc)||0, potrzebna=Number(p.iloscPotrzebna ?? ilosc)||0, przyjeto=Number(p.przyjeto)||0;
      const nadwyzka=Math.max(0,ilosc-potrzebna);
      const przyjetaNadwyzka=Math.max(0,przyjeto-potrzebna);
      const doPrzyjecia=Math.max(0,nadwyzka-przyjetaNadwyzka);
      if(doPrzyjecia>0) out.push({zlecenie:z,pozycja:p,nadwyzka,doPrzyjecia,przyjeto});
    });
  });
  return out;
}
function agentAIPlanWierszeEksportu(dokumenty=agentAIZlecenia,braki=agentAIBrakiOperacyjne(),productFinder=produktMagazynowy){
  const rows=[],znajdz=typeof productFinder==="function"?productFinder:(()=>({}));
  const dodaj=(pozycja,ilosc,zrodlo)=>{
    const qty=Math.max(0,Number(ilosc)||0);if(!qty)return;
    const produkt=znajdz(pozycja.produktId)||{},identyfikator=agentAIStabilnyIdentyfikatorPozycji(pozycja,produkt);
    rows.push({kod:identyfikator.wartosc||"",nazwa:String(pozycja.nazwa||produkt.nazwa||"Produkt").trim()||"Produkt",ilosc:qty,brakKodu:!identyfikator.wartosc,zrodlo});
  };
  (Array.isArray(dokumenty)?dokumenty:[]).filter(agentAIPlanDokumentAktywny).forEach(z=>(Array.isArray(z.pozycje)?z.pozycje:[]).forEach(p=>{
    const wymagane=Math.max(0,Number(p.iloscPotrzebna??p.baseRequired)||0),nadwyzka=Math.max(0,Number(p.manualExtra??p.nadwyzka)||0),zamowiono=Math.max(0,Number(p.ilosc??p.quantity)||0);
    dodaj(p,Math.max(zamowiono,wymagane+nadwyzka),"szkic");
  }));
  (Array.isArray(braki)?braki:[]).forEach(x=>dodaj(x,Math.max(0,Number(x.pozostaloDoZamowienia)||0),"brak"));
  return rows;
}
function eksportujTabeleOperacyjnaMagazynuCSV(){
  const rows=agentAIPlanWierszeEksportu();
  if(!rows.length){toast("Brak aktywnych pozycji Planu do eksportu");return;}
  const bezKodu=rows.filter(x=>x.brakKodu);
  if(agentAIEksportZablokowanyPrzezBrakKodow(bezKodu,"Eksport Planu"))return false;
  const csv=[["kod","nazwa","ilosc"],...rows.map(x=>[x.kod,x.nazwa,x.ilosc])].map(r=>r.map(csvPole).join(";")).join("\n");
  pobierzPlik("plan-zatowarowania-bez-cen.csv","\uFEFF"+csv,"text/csv");
  zapiszHistorieAgenta("eksport","Wyeksportowano bezcenowy Plan zatowarowania",{wiersze:rows.length,bezKodu:0});
  toast(`Wyeksportowano ${rows.length} pozycji bez cen ✅`);return true;
}
function magazynBrakiDostawcyHTML(dostawca,rows){
  const pozostalo=rows.reduce((s,x)=>s+Number(x.pozostaloDoZamowienia||0),0), pokryte=rows.reduce((s,x)=>s+Number(x.wZleceniach||0),0);
  return `<section class="ops-supplier-card"><header><div><span class="supplier-chip">🏭 ${esc(dostawca)}</span><h3>Braki do aktywnych zamówień</h3><small>${rows.length} produktów • do zamówienia ${pozostalo} szt. • pokryte w szkicach ${pokryte} szt.</small></div><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()" ${pozostalo?"":"disabled"}>Utwórz / uzupełnij szkic</button></header><div class="warehouse-worktable-wrap"><table class="log-table ops-shortage-table"><thead><tr><th>Produkt i kod</th><th>Brak</th><th>W szkicach</th><th>Do zamówienia</th><th>Stan i zamówienia</th><th>Akcja</th></tr></thead><tbody>${rows.map(x=>{const produkt=produktMagazynowy(x.produktId)||x.product||{},identyfikator=agentAIStabilnyIdentyfikatorPozycji(x,produktMagazynowy(x.produktId)||x.product||{}),wirtualny=String(x.produktId||"").startsWith("allegro-offer:");return `<tr class="${x.pozostaloDoZamowienia>0?"row-alert":"row-covered"}"><td><div class="supplier-product-cell"><span class="admin-product-thumb">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="" loading="lazy">`:`<span class="admin-product-thumb-fallback">${esc(produkt.ikona||"🎲")}</span>`}</span><div><b>${esc(x.nazwa)}</b><strong>${esc(identyfikator.wartosc||"uzupełnij kod")}</strong><small>${esc(identyfikator.typ||"brak stabilnego identyfikatora")}${x.ean?` • EAN ${esc(x.ean)}`:""}</small></div></div></td><td><b>${esc(x.brakCalkowity)} szt.</b></td><td><b>${esc(x.wZleceniach)} szt.</b></td><td><span class="lvl ${x.pozostaloDoZamowienia>0?"lvl-ostrzezenie":"lvl-ok"}"><b>${esc(x.pozostaloDoZamowienia)} szt.</b></span></td><td><b>${x.stan===null?"bez limitu":`${esc(x.stan)} szt.`}</b><small>rezerwacje ${esc(x.rezerwacje||0)} • ${esc((x.zamowienia||[]).join(", ")||"brak powiązania")}</small></td><td>${wirtualny?`<a class="btn ghost" href="#/admin/allegro/oferty">🟠 Oferta Allegro</a>`:`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(x.produktId)}">✏️ Produkt</a>`}</td></tr>`;}).join("")}</tbody></table></div></section>`;
}
function magazynTabelaOperacyjnaHTML(){
  const braki=agentAIBrakiOperacyjne(),grupy=agentAIGrupujPoDostawcy(braki),pozostalo=braki.reduce((s,x)=>s+Number(x.pozostaloDoZamowienia||0),0),wZleceniach=braki.reduce((s,x)=>s+Number(x.wZleceniach||0),0);
  const aktywne=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(agentAIPlanDokumentAktywny);
  return `<div class="panel warehouse-worktable-panel ops-control-center"><div class="order-section-head"><div><span class="order-pro-label">Aktualne zapotrzebowanie</span><h2 style="margin-top:.25rem">📑 Braki do zamówień</h2><p class="order-detail-lead">Każda pozycja z aktywnego zamówienia sklepu lub Allegro trafia tutaj. Towar już ujęty w szkicu nie jest liczony drugi raz.</p></div><div class="diag-actions" style="margin-top:0"><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()" ${braki.length?"":"disabled"}>↻ Przelicz i uzgodnij</button><button class="btn ghost" onclick="eksportujTabeleOperacyjnaMagazynuCSV()">📤 CSV bez cen</button></div></div><nav class="supplier-plan-statusbar" aria-label="Podsumowanie braków"><span><b>${braki.length}</b><small>produkty z brakiem</small></span><span><b>${pozostalo}</b><small>szt. do dodania</small></span><span><b>${wZleceniach}</b><small>szt. w szkicach</small></span><span><b>${grupy.length}</b><small>producenci</small></span><span><b>${aktywne.length}</b><small>aktywne dokumenty</small></span></nav><div class="ops-supplier-list">${grupy.map(([d,rows])=>magazynBrakiDostawcyHTML(d,rows)).join("")||`<div class="backend-note">✅ Brak realnych braków do aktywnych zamówień.</div>`}</div></div>${agentAIZleceniaPanelHTML()}`;
}

async function agentAIZlecenieProducentaTekst(){
  const docs=(await agentAIUzgodnijPlanZSerwerem({silent:true})).filter(agentAIPlanDokumentAktywny);
  if(!docs.length)return "Nie ma nowych braków; kanoniczny Plan zatowarowania na serwerze nie zawiera aktywnych dokumentów producentów.";
  return docs.slice(0,20).map(agentAIFormatZleceniaProducenta).join("\n\n");
}
function agentAIProduktyDlaOfertyAllegro(fraza=""){
  const q=agentAINormalizuj(fraza),slowa=q.split(" ").filter(Boolean);
  if(!q)return [];
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>{
    const nazwa=agentAINormalizuj(p.nazwa||""),hay=agentAINormalizuj([p.nazwa,p.sku,p.externalId,p.gtin,p.ean,p.kodProducenta,p.mpn,p.id].filter(Boolean).join(" "));
    let score=nazwa===q?100:nazwa.includes(q)?95:hay.includes(q)?92:slowa.every(w=>hay.includes(w))?80:0;
    return score?{p,score}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.p.nazwa).localeCompare(String(b.p.nazwa),"pl"));
}
async function agentAIWykonajOferteAllegro(fraza="",publicationAction="keep"){
  if(!allegroStan.sprawdzono)await allegroWczytajDane(true);
  const trafienia=agentAIProduktyDlaOfertyAllegro(fraza);
  if(!trafienia.length)return `Nie znalazłem produktu „${fraza}”. Podaj dokładniejszą nazwę, SKU albo EAN.`;
  const best=trafienia[0],remis=trafienia.filter(x=>x.score===best.score);
  if(remis.length>1)return [`Znalazłem kilka produktów. Doprecyzuj nazwę, SKU albo EAN:`,...remis.slice(0,8).map(x=>`• ${x.p.nazwa} — ID ${x.p.id}, SKU ${x.p.sku||x.p.externalId||"—"}, EAN ${x.p.gtin||x.p.ean||"—"}`)].join("\n");
  const p=best.p,baseStock=allegroStanOfertyProduktu(p),stock=publicationAction==="activate"?Math.max(1,baseStock):baseStock;
  const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock,publicationAction,publishNow:publicationAction==="activate"}},timeout:120000});
  allegroOstatniBladWystawienia=null;
  allegroZapiszWynikOperacji(p,d);allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);
  if(d.offer?.id){
    const categoryId=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||p.allegroCategoryId||"";
    const productId=d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"";
    produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroOfferId:String(d.offer.id),...(categoryId?{allegroCategoryId:String(categoryId)}:{}),...(productId?{allegroProductId:String(productId)}:{})};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  }
  await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});zbudujProdukty();
  const updated=d.mode==="updated";
  const finalStatus=d.offer?.publication?.status||d.offer?.status||(publicationAction==="activate"?"ACTIVE":"INACTIVE");
  return [`✅ ${updated?"Znalazłem istniejącą ofertę i ją zaktualizowałem":finalStatus==="ACTIVE"?"Utworzyłem i aktywowałem nową ofertę":"Utworzyłem nowy szkic oferty"}: ${p.nazwa}.`,`Oferta: ${d.offer?.id||"—"}; status: ${finalStatus}; stan oferty Allegro: ${stock} szt. • stan magazynu pozostał bez zmian.`,`${d.duplicatePrevented?`Duplikat zablokowany — rozpoznano po ${d.match?.reason||"danych produktu"}.`:"Zapisano nowe potrójne powiązanie."}`,`Katalog: ${d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||"—"}; kategoria: ${d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||"—"}.`].join("\n");
}
async function agentAIOdpowiedzPrzezCodex(tekst=""){
  const requestId=`panel-${Date.now().toString(36)}-${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
  const queued=await chmura("codex-agent-panel-enqueue",{method:"POST",body:{requestId,text:String(tekst||"").slice(0,2000)},timeout:15000});
  if(!queued?.jobId)throw new Error("Serwer nie utworzył zadania dla Codex.");
  const box=$("agentAICommandLiveResult");
  if(box){box.hidden=false;box.className="agent-response-card agent-command-live-result";box.innerHTML=`<div class="agent-response-head"><b>🧠 Codex analizuje polecenie</b><small>bezpieczny plan i wykonanie</small></div><pre class="agent-answer-pre">Rozpoznaję zamiar i dobieram dozwoloną operację strony…</pre>`;}
  for(let attempt=0;attempt<45;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    const result=await chmura("codex-agent-result",{method:"POST",body:{id:queued.jobId},timeout:10000});
    if(result.status==="completed")return result.response||"Codex zakończył zadanie bez treści odpowiedzi.";
    if(result.status==="failed")throw new Error(result.error||"Codex nie wykonał zadania po trzech próbach.");
  }
  throw new Error("Codex nadal analizuje polecenie. Komputer z Agentem musi być włączony; spróbuj ponownie za chwilę.");
}
async function agentAIWykonajPolecenie(tekst=""){
  const intent=agentAIRozpoznajPolecenie(tekst);
  let odpowiedz="";
  try{
    if(intent.typ==="pomoc"){
      odpowiedz=["Możesz pisać normalnie, np.:","• mam obecnie na stanie Ziemniaka 1410 8 szt — Agent utworzy decyzję i zapyta o lokalizację","• przyjmij 8 szt produktu EAN 590... — po lokalizacji pojawi się osobne Potwierdzam / Nie potwierdzam","• lokalizacja IV… A-R01-P01 — przypisz miejsce do konkretnej decyzji","• potwierdzam IV… — potwierdź tylko wskazaną decyzję","• sprawdź link https://... i znajdź dane produktu","• wykonaj bezpieczny plan agenta","• sprawdź samą funkcjonalność strony","• pobierz świeże dane ze wszystkich źródeł","• ponów błędne kroki","• pokaż centrum operacyjne / co mam dziś zrobić?","• wyślij raport na Telegram","• pokaż komunikację z klientami","• sprawdź wysyłki i etykiety InPost","• audyt produktów i katalogu","• status producentów i otwartych zamówień","• diagnostyka integracji","• wystaw Origami Kot na Allegro","• sprawdź zlecenia Allegro i braki do pakowania","• przygotuj zamówienie do producenta","• czego brakuje do zamówień?","• pokaż stan magazynu","• sprawdź dostępność u producentów","• popraw opisy produktów","• ile mamy szachy?","• zapamiętaj: przy brakach najpierw sprawdź dostawcę","• synchronizuj bazę"].join("\n");
    }else if(intent.typ==="magazyn-decyzja"){
      odpowiedz=await agentAIWykonajDecyzjeMagazynowa(intent);
    }else if(intent.typ==="magazyn-stan-zmiana"){
      odpowiedz=await agentAIWykonajZmianeStanu(intent);
    }else if(intent.typ==="plan-wykonaj"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("full");
    }else if(intent.typ==="plan-data"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("data");
    }else if(intent.typ==="plan-health"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("health");
    }else if(intent.typ==="plan-retry"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("retry");
    }else if(intent.typ==="link-producenta-analiza"){
      const wynik=await agentAISprawdzLinkProducenta(intent.url,true);
      if(wynik?.blad)odpowiedz=`Nie udało się teraz odczytać linku. Zaplanowałem kolejną próbę: ${wynik.rec?.nextRetryAt?new Date(wynik.rec.nextRetryAt).toLocaleString("pl-PL"):"później"}. Powód: ${wynik.blad.message||wynik.blad}`;
      else{const d=wynik?.dane||{},alts=d.alternatives||[],audit=agentAIOcenaDodaniaProduktu(d.product||{},d);odpowiedz=[d.needsChoice?`Znalazłem ${alts.length} możliwe produkty — nie zgaduję, wybierz wariant w sekcji Linki producentów.`:`Znalazłem produkt: ${d.product?.nazwa||"bez nazwy"}.`,`Kompletność danych: ${d.confidence||0}%. Gotowość do dodania: ${audit.score}%. Braki: ${(wynik.braki||[]).join(", ")||"brak"}.`,`EAN: ${d.product?.ean||d.product?.gtin||"—"} • kod producenta: ${d.product?.kodProducenta||d.product?.mpn||"—"}.`,`Opis: ${String(d.product?.opis||"").length} znaków • zdjęcia: ${[d.product?.zdjecie,...(d.product?.zdjecia||[])].filter(Boolean).length}.`,audit.blockingDuplicate?`Zablokowałem duplikat: istnieje produkt #${audit.blockingDuplicate.product.id} ${audit.blockingDuplicate.product.nazwa}.`:intent.addProduct&&!d.needsChoice?"Przygotowuję bezpieczny formularz dodania produktu — przed zapisem zobaczysz kontrolę duplikatów i kompletności.":"",d.fromCache?`Użyłem pamięci Agenta z ${d.cacheSavedAt?new Date(d.cacheSavedAt).toLocaleString("pl-PL"):"poprzedniej kontroli"}.`:"",d.repaired?`Naprawiony adres: ${d.resolvedUrl||d.canonicalUrl}`:"",...alts.slice(0,5).map((x,i)=>`${i+1}. ${x.product?.nazwa||"Produkt"} • ${x.confidence||0}% • ${x.url}`)].filter(Boolean).join("\n");if(intent.addProduct&&!d.needsChoice&&!audit.blockingDuplicate&&wynik.rec?.id)setTimeout(()=>agentAIWypelnijNowyProduktZLinku(wynik.rec.id),700);}
    }else if(intent.typ==="centrum"){
      odpowiedz=agentAICentrumTekst();
    }else if(intent.typ==="komunikacja"){
      odpowiedz=agentAIKomunikacjaTekst();
    }else if(intent.typ==="wysylki"){
      odpowiedz=agentAIWysylkiTekst();
    }else if(intent.typ==="produkty-audyt"){
      odpowiedz=agentAIProduktyAudytTekst();
    }else if(intent.typ==="producenci"){
      odpowiedz=agentAIProducenciTekst();
    }else if(intent.typ==="diagnostyka"){
      odpowiedz=agentAIDiagnostykaTekst();
    }else if(intent.typ==="raport-telegram"){
      const d=await agentAIWyslijRaportTelegram();odpowiedz=d?`Raport centrum operacyjnego został wysłany na Telegram. Kondycja strony: ${d.center?.score??"—"}%. Wiadomość zawiera przyciski do Agenta, zamówień, magazynu, Allegro i wysyłek.`:"Nie udało się wysłać raportu na Telegram.";
    }else if(intent.typ==="pamiec-zapis"){
      const rec=agentAIZapiszPamiec(intent.tresc||"");
      odpowiedz=rec?`Zapamiętałem na przyszłość: ${rec.wyzwalacz?`gdy „${rec.wyzwalacz}” → `:""}${rec.akcja}`:"Nie podałeś treści do zapamiętania. Napisz np. „zapamiętaj: przy brakach najpierw sprawdź dostawcę”.";
    }else if(intent.typ==="pamiec-lista"){
      odpowiedz=agentAIPamiecTekst();
    }else if(intent.typ==="lokalizacje"){
      odpowiedz=agentAILokalizacjeTekst();
    }else if(intent.typ==="opisy"){
      odpowiedz=agentAIOpisyTekst();
    }else if(intent.typ==="opisy-popraw"){
      odpowiedz=agentAIPoprawOpisyProduktow(40);
      renderuj();
    }else if(intent.typ==="linki-producentow"){
      odpowiedz=agentAILinkiProducentowTekst();
    }else if(intent.typ==="linki-producentow-sprawdz"){
      odpowiedz=await agentAISprawdzLinkiProducentow(5);
    }else if(intent.typ==="dostepnosc-producentow-sprawdz"){
      const d=await agentAISprawdzDostepnoscProducentow();const s=d?.summary||{};
      odpowiedz=d?`Wyrywkowo sprawdziłem ${s.checked||0} produktów u producentów. Dostępne: ${s.available||0}, niski stan: ${s.low||0}, brak: ${s.unavailable||0}, niepotwierdzone: ${s.unknown||0}. Próg ostrzeżenia: ${s.threshold||50} szt.`:"Nie udało się zakończyć monitoringu producentów.";
    }else if(intent.typ==="lokalizacja-dodaj"){
      if(!intent.kod){
        odpowiedz="Podaj kod lokalizacji, np. „utwórz lokalizację R1-P1”.";
      }else if(magazynLokalizacjaPoKodzie(intent.kod)){
        odpowiedz=`Lokalizacja ${intent.kod} już istnieje. Możesz ją edytować w Magazyn → Lokalizacje.`;
      }else{
        magazynLokalizacje=[{id:"LOC-"+Date.now().toString(36),kod:intent.kod,nazwa:"",typ:"regał",strefa:"",pojemnosc:0,priorytet:999,uwagi:"Utworzone przez Agenta AI",aktywna:true,utworzono:new Date().toISOString(),aktualizacja:new Date().toISOString(),operator:sesja?.email||"administrator"},...(Array.isArray(magazynLokalizacje)?magazynLokalizacje:[])].slice(0,1000);
        zapiszLS("artway_magazyn_lokalizacje",magazynLokalizacje);
        odpowiedz=`Utworzyłem lokalizację ${intent.kod}. Uzupełnij nazwę/strefę/pojemność w Magazyn → Lokalizacje.`;
      }
    }else if(intent.typ==="sync"){
      await synchronizujBazeCentralna(true);
      odpowiedz="Synchronizacja bazy została uruchomiona. Dane z panelu powinny być zapisane i odświeżone na serwerze.";
    }else if(intent.typ==="faktury"){
      const przed=szkiceFaktur.length;
      utworzSzkiceFakturMasowo();
      odpowiedz=`Sprawdziłem szkice FV. Przed akcją było ich ${przed}, teraz jest ${szkiceFaktur.length}.`;
    }else if(intent.typ==="export-magazyn"){
      eksportujMagazynCSV();
      odpowiedz="Eksport magazynu CSV został przygotowany do pobrania.";
    }else if(intent.typ==="audyt-magazynu"){
      audytMagazynuAI();
      odpowiedz="Audyt magazynu JSON został przygotowany do pobrania.";
    }else if(intent.typ==="kartoteka-domyslna"){
      wypelnijDomyslnaKartotekeMagazynu();
      odpowiedz="Uzupełniłem domyślne pola kartoteki tam, gdzie było to bezpieczne.";
    }else if(intent.typ==="allegro-oferta"){
      odpowiedz=await agentAIWykonajOferteAllegro(intent.query,intent.publicationAction||"keep");
    }else if(intent.typ==="allegro-zlecenia"){
      odpowiedz=agentAIAllegroZleceniaTekst();
    }else if(intent.typ==="sprawdz"||intent.typ==="zamowienia"){
      odpowiedz=agentAIZamowieniaTekst();
    }else if(intent.typ==="zlecenie"){
      odpowiedz=await agentAIZlecenieProducentaTekst();
    }else if(intent.typ==="braki"){
      odpowiedz=agentAIBrakiTekst();
    }else if(intent.typ==="status"){
      odpowiedz=agentAIStatusTekst();
    }else if(intent.typ==="magazyn"){
      odpowiedz=agentAIMagazynTekst();
    }else if(intent.typ==="produkt"){
      odpowiedz=agentAIProduktTekst(intent.query);
    }else{
      const pamiec=agentAIZnajdzPamiecDlaPolecenia(tekst);
      odpowiedz=pamiec.length
        ? ["Znalazłem pasujące zapamiętane procedury:",...pamiec.map(x=>`• ${x.wyzwalacz?`Gdy: ${x.wyzwalacz} → `:""}${x.akcja||x.tresc}`)].join("\n")
        : await agentAIOdpowiedzPrzezCodex(tekst);
    }
    zapiszHistorieAgenta("komenda",`Polecenie z panelu: ${tekst}`,{polecenie:tekst,intencja:intent.typ,tryb:intent.tryb||"",odpowiedz});
    loguj("info",`Agent AI/panel: ${intent.typ} — ${tekst}`);
    return {intent,odpowiedz,stabilnyWidok:["magazyn-stan-zmiana","magazyn-decyzja"].includes(intent.typ)};
  }catch(err){
    odpowiedz=`Nie udało się wykonać polecenia: ${err?.message||err}`;
    zapiszHistorieAgenta("komenda",`Błąd polecenia z panelu: ${tekst}`,{polecenie:tekst,intencja:intent.typ,tryb:intent.tryb||"",odpowiedz,blad:String(err?.message||err)});
    loguj("error",`Agent AI/panel błąd: ${err?.message||err}`);
    return {intent,odpowiedz,blad:err,stabilnyWidok:["magazyn-stan-zmiana","magazyn-decyzja"].includes(intent.typ)};
  }
}
function agentAIPokazWynikKomendyStabilnie(wynik={}){
  const box=$("agentAICommandLiveResult"),cloud=$("agentAICommandCloudState");
  if(box){
    box.hidden=false;
    box.className=`agent-response-card agent-command-live-result${wynik.blad?" is-error":""}`;
    box.innerHTML=`<div class="agent-response-head"><b>${wynik.blad?"⚠️ Polecenie nie zostało zapisane":"✅ Wynik polecenia magazynowego"}</b><small>${esc(new Date().toLocaleString("pl-PL"))}</small></div><pre class="agent-answer-pre">${esc(wynik.odpowiedz||"")}</pre>`;
  }
  if(cloud){
    cloud.className=`lvl ${chmuraStan.dostepna?"lvl-ok":"lvl-blad"}`;
    cloud.textContent=chmuraStan.dostepna?`chmura • rewizja ${chmuraStan.rev||0}`:"brak połączenia z chmurą";
  }
}
async function agentAIPrzyjmijKomende(e){
  if(e) e.preventDefault();
  const input=$("agentAICommandInput"), tekst=String(input?.value||"").trim();
  if(!tekst){ toast("Wpisz polecenie dla agenta"); return false; }
  const btn=e?.submitter;
  if(btn) btn.disabled=true;
  const wynik=await agentAIWykonajPolecenie(tekst);
  toast(wynik.blad?"Agent zapisał błąd polecenia":["magazyn-stan-zmiana","magazyn-decyzja"].includes(wynik.intent?.typ)?"Agent obsłużył bezpieczny krok decyzji ✅":"Agent AI wykonał polecenie ✅");
  if(input) input.value="";
  if(btn) btn.disabled=false;
  if(wynik.stabilnyWidok)agentAIPokazWynikKomendyStabilnie(wynik);else renderuj();
  setTimeout(()=>{$("agentAICommandInput")?.focus();},30);
  return false;
}
function agentAIWstawKomende(tekst){
  const input=$("agentAICommandInput");
  if(!input) return;
  input.value=tekst;
  input.focus();
}
function agentAIHashTekstu(value=""){
  let hash=2166136261;
  for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function agentAIOdciskZadania(task={}){
  const id=String(task.id||"zadanie"),poziom=String(task.poziom||"ok");
  const opis=id==="synchronizacja-danych"?poziom:String(task.opis||"").replace(/\s+/g," ").trim().toLowerCase();
  return `${id}:${agentAIHashTekstu(`${poziom}|${opis}`)}`;
}
function agentAIProduktyWdrozenie(){
  const addedIds=new Set((produktyDodane||[]).map(p=>String(p.id)));
  return produktyDoAdministracji().filter(p=>addedIds.has(String(p.id))&&p.agentOnboardingStatus&&p.agentOnboardingStatus!=="completed");
}
function agentAISynchronizujCyklZadan(analiza=[]){
  const now=new Date().toISOString(),next={...(agentAIPlanCykl&&typeof agentAIPlanCykl==="object"?agentAIPlanCykl:{})};let changed=false;
  for(const task of analiza){
    const id=String(task.id||"");if(!id)continue;
    const fingerprint=agentAIOdciskZadania(task),current=next[id];
    if(task.poziom==="ok"){
      if(current&&current.state!=="resolved"){
        next[id]={...current,state:"resolved",resolvedAt:now,lastStatus:"ok",updatedAt:now};changed=true;
      }
      continue;
    }
    if(!current||current.state==="resolved"||current.fingerprint!==fingerprint){
      next[id]={id,fingerprint,state:"open",title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",firstSeenAt:now,updatedAt:now};changed=true;
    }else if(current.title!==task.tytul||current.description!==task.opis||current.severity!==task.poziom){
      next[id]={...current,title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",updatedAt:now};changed=true;
    }
  }
  if(changed){agentAIPlanCykl=next;zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);zaplanujZapisUstawien();}
  return next;
}
function agentAIAnalizaAktywna(analiza=agentAIAnaliza()){
  const cycle=agentAISynchronizujCyklZadan(analiza);
  return analiza.filter(task=>task.poziom!=="ok"&&!(cycle[task.id]?.state==="done"&&cycle[task.id]?.fingerprint===agentAIOdciskZadania(task)));
}
function agentAIOznaczZadanieWykonane(id,source="administrator"){
  const analiza=agentAIAnaliza(),task=analiza.find(x=>String(x.id)===String(id));if(!task)return;
  agentAISynchronizujCyklZadan(analiza);
  const now=new Date().toISOString(),fingerprint=agentAIOdciskZadania(task),current=agentAIPlanCykl[id]||{};
  agentAIPlanCykl={...agentAIPlanCykl,[id]:{...current,id:String(id),fingerprint,state:"done",title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",completedAt:now,completedBy:sesja?.email||"administrator",completionSource:source,updatedAt:now}};
  zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);
  zapiszHistorieAgenta("zadanie-wykonane",`Zakończono zadanie planu: ${task.tytul}`,{taskId:id,fingerprint,source,opis:task.opis||""});
  zaplanujZapisUstawien();toast("✅ Zadanie przeniesiono do historii. Wróci tylko, gdy pojawi się nowy problem.");renderuj();
}
function agentAIPrzywrocZadanie(id){
  const current=agentAIPlanCykl?.[id];if(!current)return;
  agentAIPlanCykl={...agentAIPlanCykl,[id]:{...current,state:"open",reopenedAt:new Date().toISOString(),reopenedBy:sesja?.email||"administrator",updatedAt:new Date().toISOString()}};
  zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);zapiszHistorieAgenta("zadanie-przywrocone",`Przywrócono zadanie planu: ${current.title||id}`,{taskId:id});zaplanujZapisUstawien();renderuj();
}
function agentAIAnaliza(){
  const zam=pobierzZamowienia(), produktyAdmin=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const aktywne=zam.filter(z=>!["anulowane","zakończone","dostarczone"].includes(String(z.status||"").toLowerCase()));
  const firmoweBezSzkicu=zam.filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  const doPotwierdzenia=zam.filter(z=>z.wymagaPotwierdzeniaDostepnosci);
  const bezNumeru=aktywne.filter(z=>!daneWysylki(z).numer);
  const bezCeny=produktyAdmin.filter(p=>!produktMaCeneSprzedazy(p));
  const niedostepne=produktyAdmin.filter(produktOznaczonyNiedostepny);
  const bezZdjec=produktyAdmin.filter(p=>!p.zdjecie);
  const prog=Number(ustawieniaMagazynuPelne().progNiski)||5, rez=rezerwacjeMagazynowe();
  const niskiStan=produktyAdmin.filter(p=>{const s=stanMagazynuId(p.id);return s!==null&&s<=progNiskiProduktu(p);});
  const plan=potrzebyZatowarowania(),planIds=new Set(plan.map(x=>String(x.produkt?.id||"")));
  const nadrezerwacje=produktyAdmin.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;});
  const brakKartoteki=produktyAdmin.filter(p=>planIds.has(String(p.id))&&!magazynMetaProduktu(p.id).dostawca);
  const bezMonitoringu=produktyAdmin.filter(p=>stanMagazynuId(p.id)===null);
  const stareInwentaryzacje=produktyAdmin.filter(p=>{
    const s=stanMagazynuId(p.id), d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja;
    if(s===null) return false;
    if(!d) return true;
    return (Date.now()-new Date(d).getTime())>90*86400000;
  });
  const lokAktywne=magazynLokalizacjeAktywne(), statLok=statystykiLokalizacji(produktyAdmin), lokPozaSlownikiem=Object.keys(statLok).filter(k=>k!=="BRAK"&&!magazynLokalizacjaPoKodzie(k));
  const nadwyzki=agentAINadwyzkiDoPrzyjecia();
  const linkiProd=agentAILinkiOczekujace(),linkiDoWyboru=linkiProd.filter(x=>String(x.status||"").toLowerCase()==="wymaga wyboru"),linkiDoPonowienia=agentAILinkiGotoweDoPonowienia();
  const monitoringProducentow=statystykiDostepnosciProducentow(), alertyProducentow=[...monitoringProducentow.braki,...monitoringProducentow.niskie];
  const opisyDoPoprawy=agentAIProduktyZProblememOpisu(500);
  const produktyWdrozenie=agentAIProduktyWdrozenie();
  const allegroKontrola=aktywneZamowieniaAllegro().map(z=>({z,a:allegroAnalizaMagazynowaZamowienia(z)}));
  const allegroBraki=allegroKontrola.filter(x=>x.a.braki>0||x.a.nierozpoznane>0);
  const lokalizacjeDoUstalenia=new Map(),dodajBrakLokalizacji=p=>{const id=String(p?.produkt?.id??p?.id??"");if(id&&!lokalizacjeDoUstalenia.has(id))lokalizacjeDoUstalenia.set(id,p.produkt||produktMagazynowy(id)||{id,nazwa:p.nazwa||`Produkt ${id}`});};
  allegroKontrola.flatMap(x=>x.a.pozycje||[]).filter(p=>p.brakLokalizacji).forEach(dodajBrakLokalizacji);
  aktywne.flatMap(z=>pozycjeZamowieniaMagazyn(z)).forEach(p=>{const stan=stanMagazynuId(p.id),meta=magazynMetaProduktu(p.id);if(stan!==null&&stan>=Number(rez[p.id]||0)&&!meta.lokalizacja)dodajBrakLokalizacji(p);});
  const allegroOfertaTasks=allegroAktywneZadaniaAgentaOfert();
  const allegroDefaultsIssues=Object.values(allegroStan.offerDefaultsAudit?.items||{}).filter(x=>!x.stockUpdated||!x.republishUpdated);
  const problemyFunkcji=[!chmuraStan.dostepna?"wspólna baza":null,stanBramki.sprawdzono&&stanBramki.email?.configured===false?"e-mail":null,stanBramki.sprawdzono&&stanBramki.inpost?.configured===false?"InPost":null,allegroStan.sprawdzono&&!allegroStan.connected?"Allegro":null,infaktStan.sprawdzono&&!infaktStan.connected?"inFakt":null].filter(Boolean);
  const syncTime=Date.parse(chmuraStan.updated_at||""),syncAge=Number.isFinite(syncTime)?Math.max(0,Math.round((Date.now()-syncTime)/60000)):null,syncStale=syncAge!==null&&syncAge>5;
  const pozycje=[
    {id:"funkcjonalnosc-strony",poziom:problemyFunkcji.length?"bad":"ok",ikona:"🩺",tytul:"Funkcjonalność strony — priorytet 1",opis:problemyFunkcji.length?`Kontroli wymagają: ${problemyFunkcji.join(", ")}.`:`Baza i sprawdzone integracje krytyczne odpowiadają poprawnie.`,akcja:problemyFunkcji.length?"#/diagnostyka":"plan-bezpieczny"},
    {id:"synchronizacja-danych",poziom:!chmuraStan.admin?"bad":syncStale?"warn":"ok",ikona:"🔄",tytul:"Pobieranie i świeżość danych — priorytet 2",opis:!chmuraStan.admin?"Agent nie ma aktywnego dostępu do wspólnej bazy.":syncAge===null?"Brak potwierdzonego czasu ostatniej synchronizacji.":`Ostatnia synchronizacja wspólnej bazy: ${syncAge} min temu.`,akcja:"plan-bezpieczny"},
    {id:"wdrozenie-produktow",poziom:produktyWdrozenie.some(p=>p.agentOnboardingStatus==="needs_attention")?"bad":produktyWdrozenie.length?"warn":"ok",ikona:"✨",tytul:"Nowe produkty administratora — wdrożenie Agenta",opis:produktyWdrozenie.length?`${produktyWdrozenie.length} nowych produktów wymaga dokończenia kontroli danych, duplikatów, opisów, zdjęć, producenta, kategorii sklepu lub przygotowania Allegro.`:"Każdy nowy produkt administratora przeszedł pełną kontrolę Agenta.",akcja:"#/admin/agent-ai/produkty"},
    {id:"allegro-magazyn",poziom:allegroBraki.length?"bad":"ok",ikona:"🟠",tytul:"Zlecenia Allegro — braki i pakowanie",opis:allegroBraki.length?`${allegroBraki.length} aktywnych zleceń Allegro wymaga zamówienia brakujących sztuk albo poprawy EAN/SKU.`:`${allegroKontrola.length} aktywnych zleceń Allegro sprawdzono; stany pozwalają na kompletację.`,akcja:"#/admin/allegro/zamowienia"},
    {id:"lokalizacje-kompletacja",poziom:lokalizacjeDoUstalenia.size?"warn":"ok",ikona:"📍",tytul:"Magazyn — lokalizacje do kompletacji",opis:lokalizacjeDoUstalenia.size?`${lokalizacjeDoUstalenia.size} produktów z aktywnych zamówień ma pokrycie w stanie, ale nie ma przypisanego miejsca. Towar pozostaje zarezerwowany; magazyn ustala lokalizację osobno.`:"Towar do aktywnych zamówień ma przypisane lokalizacje albo nie wymaga jeszcze kompletacji.",akcja:"#/admin/magazyn/stany"},
    {id:"allegro-oferty-agent",poziom:allegroOfertaTasks.length?"warn":"ok",ikona:"🏷️",tytul:"Agent ofert Allegro",opis:allegroOfertaTasks.length?`${allegroOfertaTasks.length} produktów ma zapisane braki danych albo błąd API wystawiania.`:"Brak otwartych zadań dotyczących ofert Allegro.",akcja:"#/admin/allegro/wystawianie"},
    {id:"allegro-ustawienia-ofert",poziom:allegroDefaultsIssues.length?"warn":"ok",ikona:"♻️",tytul:"Oferty Allegro — stan i wznawianie",opis:allegroDefaultsIssues.length?`${allegroDefaultsIssues.length} starszych ofert wymaga uzupełnienia danych wymaganych przez Allegro, aby włączyć automatyczne wznawianie. Domyślny stan sprzedażowy ${allegroStanOfertyProduktu()} jest niezależny od magazynu.`:`Oferty mają ustawiony domyślny stan ${allegroStanOfertyProduktu()} szt. i automatyczne wznawianie.`,akcja:"#/admin/allegro/ustawienia"},
    {id:"dostepnosc",poziom:doPotwierdzenia.length?"warn":"ok",ikona:"🔎",tytul:"Zamówienia do potwierdzenia dostępności",opis:doPotwierdzenia.length?`${doPotwierdzenia.length} zamówień ma pozycje powyżej ${LIMIT_POTWIERDZENIA_DOSTEPNOSCI} szt.`:"Brak zamówień wymagających potwierdzenia ilości.",akcja:"#/admin/zamowienia"},
    {id:"wysylki",poziom:bezNumeru.length?"warn":"ok",ikona:"🚚",tytul:"Przesyłki bez numeru nadania",opis:bezNumeru.length?`${bezNumeru.length} aktywnych zleceń czeka na numer/etykietę InPost.`:"Aktywne przesyłki mają komplet podstawowych danych.",akcja:"#/admin/wysylki"},
    {id:"faktury",poziom:firmoweBezSzkicu.length?"warn":"ok",ikona:"🧾",tytul:"Szkice FV / inFakt",opis:firmoweBezSzkicu.length?`${firmoweBezSzkicu.length} zamówień firmowych nie ma jeszcze szkicu FV.`:"Szkice FV są przygotowane dla zamówień firmowych.",akcja:"masowe-fv"},
    {id:"ceny",poziom:bezCeny.length?"bad":"ok",ikona:"💰",tytul:"Produkty bez ceny",opis:bezCeny.length?`${bezCeny.length} produktów wymaga uzupełnienia ceny przed sprzedażą.`:"Ceny produktów są poprawne.",akcja:"#/admin/produkty"},
    {id:"sprzedaz",poziom:niedostepne.length?"warn":"ok",ikona:"🛒",tytul:"Produkty wyłączone ze sprzedaży",opis:niedostepne.length?`${niedostepne.length} produktów jest oznaczonych jako chwilowo niedostępne.`:"Wszystkie aktywne produkty są dostępne w sprzedaży.",akcja:"#/admin/magazyn"},
    {id:"dostepnosc-producentow",poziom:monitoringProducentow.wymagajaDecyzji.length||monitoringProducentow.braki.length?"bad":monitoringProducentow.niskie.length||monitoringProducentow.nieznane.length?"warn":"ok",ikona:"🏭",tytul:"Dostępność u producentów",opis:monitoringProducentow.wymagajaDecyzji.length?`${monitoringProducentow.wymagajaDecyzji.length} produktów wymaga decyzji: pozostawić sprzedaż na określony czas, ukryć lub włączyć automatyczne wznowienie.`:alertyProducentow.length?`${monitoringProducentow.braki.length} braków i ${monitoringProducentow.niskie.length} niskich stanów u producentów ma zapisaną decyzję. Próg: ${ustawieniaMagazynuPelne().progNiskiProducenta} szt.`:`Monitorowanych linków: ${monitoringProducentow.products.length}; do odświeżenia lub bez potwierdzenia: ${monitoringProducentow.nieznane.length}.`,akcja:"#/admin/magazyn/dostawcy"},
    {id:"magazyn",poziom:"ok",ikona:"🏬",tytul:"Stan lokalnego magazynu — pomocniczo",opis:niskiStan.length?`${niskiStan.length} produktów ma niski stan lokalny. Nie jest to samodzielny powód wyłączenia sprzedaży; ważniejszy jest producent i aktywne zamówienia.`:"Lokalne stany są informacją pomocniczą.",akcja:"#/admin/magazyn/stany"},
    {id:"zatowarowanie",poziom:plan.length?"warn":"ok",ikona:"📦",tytul:"Plan zatowarowania — braki do zamówień",opis:plan.length?`${plan.length} produktów brakuje do aktywnych zamówień. Szacowana wartość braków: ${zl(plan.reduce((s,x)=>s+kwotaNum(x.ilosc*kwotaNum(x.produkt.cena)),0))}.`:"Brak produktów, których brakuje do aktywnych zamówień.",akcja:"utworz-zlecenie-braki"},
    {id:"przyjecia-nadwyzek",poziom:nadwyzki.length?"warn":"ok",ikona:"📥",tytul:"Dzienne przyjęcie nadwyżek",opis:nadwyzki.length?`${nadwyzki.length} pozycji ze zleceń agenta ma nadwyżkę do decyzji/przyjęcia na magazyn.`:"Brak nadwyżek oczekujących na przyjęcie.",akcja:"#/admin/magazyn/plan"},
    {id:"nadrezerwacje",poziom:nadrezerwacje.length?"bad":"ok",ikona:"🚨",tytul:"Rezerwacje większe niż stan",opis:nadrezerwacje.length?`${nadrezerwacje.length} produktów ma więcej sztuk w aktywnych zamówieniach niż fizycznie w magazynie.`:"Nie ma nadrezerwacji magazynowych.",akcja:"#/admin/magazyn"},
    {id:"kartoteka",poziom:brakKartoteki.length?"warn":"ok",ikona:"🗂️",tytul:"Kartoteka zakupowa",opis:brakKartoteki.length?`${brakKartoteki.length} produktów z realnym brakiem nie ma przypisanego dostawcy.`:"Każdy realny brak ma dane potrzebne do Planu zatowarowania.",akcja:"#/admin/magazyn/stany"},
    {id:"lokalizacje",poziom:(!lokAktywne.length||lokPozaSlownikiem.length)?"warn":"ok",ikona:"🗺️",tytul:"Słownik lokalizacji magazynu",opis:!lokAktywne.length?"Brak utworzonych lokalizacji magazynu.":lokPozaSlownikiem.length?`${lokPozaSlownikiem.length} lokalizacji przy produktach nie ma w słowniku.`:`Aktywne lokalizacje: ${lokAktywne.length}.`,akcja:"#/admin/magazyn"},
    {id:"pamiec",poziom:(agentAIPamiec||[]).length?"ok":"warn",ikona:"🧠",tytul:"Pamięć i procedury agenta",opis:(agentAIPamiec||[]).length?`Agent ma ${(agentAIPamiec||[]).length} zapamiętanych procedur/notatek.`:"Agent nie ma jeszcze własnych procedur. Naucz go poleceniem „zapamiętaj: …”.",akcja:"#/admin/agent-ai"},
    {id:"linki-producentow",poziom:linkiDoWyboru.length?"bad":linkiProd.length?"warn":"ok",ikona:"🔗",tytul:"Linki producentów do pobrania",opis:linkiProd.length?`${linkiProd.length} zadań linków: ${linkiDoWyboru.length} wymaga wyboru właściwego produktu, ${linkiDoPonowienia.length} jest gotowych do ponownego pobrania.`:"Brak zaległych linków producentów.",akcja:"sprawdz-linki-producentow"},
    {id:"opisy-produktow",poziom:opisyDoPoprawy.length?"warn":"ok",ikona:"📝",tytul:"Opisy produktów",opis:opisyDoPoprawy.length?`${opisyDoPoprawy.length} produktów wymaga krótkiego opisu albo uporządkowania pełnego opisu.`:"Krótkie i pełne opisy produktów są uporządkowane.",akcja:"popraw-opisy"},
    {id:"monitoring",poziom:bezMonitoringu.length?"warn":"ok",ikona:"📍",tytul:"Produkty bez monitorowanego stanu",opis:bezMonitoringu.length?`${bezMonitoringu.length} produktów działa bez limitu magazynowego — poprawne, jeśli to świadoma decyzja.`:"Wszystkie produkty mają monitorowany stan.",akcja:"#/admin/magazyn"},
    {id:"inwentaryzacja",poziom:stareInwentaryzacje.length?"warn":"ok",ikona:"✅",tytul:"Inwentaryzacja",opis:stareInwentaryzacje.length?`${stareInwentaryzacje.length} monitorowanych produktów nie ma świeżej daty inwentaryzacji.`:"Inwentaryzacja monitorowanych produktów jest aktualna.",akcja:"audyt-magazynu"},
    {id:"zdjecia",poziom:bezZdjec.length?"warn":"ok",ikona:"🖼️",tytul:"Zdjęcia produktów",opis:bezZdjec.length?`${bezZdjec.length} produktów używa ikony zamiast zdjęcia.`:"Produkty mają zdjęcia.",akcja:"#/admin/produkty"},
    {id:"integracje",poziom:(stanBramki.email?.configured&&stanBramki.inpost?.configured)!==false?"ok":"warn",ikona:"🔌",tytul:"Integracje",opis:`E-mail: ${stanBramki.email?.configured?"OK":"sprawdź"} • InPost: ${stanBramki.inpost?.configured?"OK":"sprawdź"} • baza: ${chmuraStan.admin?"połączona":"wpisz hasło bazy"}`,akcja:"#/admin/personalizacja"}
  ];
  return pozycje;
}
function utworzSzkiceFakturMasowo(){
  const zam=pobierzZamowienia().filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  if(!zam.length){ toast("Brak nowych zamówień firmowych do szkiców FV"); return; }
  const nowe=zam.map(z=>daneSzkicuFakturyZamowienia(z.nr)).filter(Boolean);
  szkiceFaktur=[...nowe,...szkiceFaktur].slice(0,2000);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  loguj("info",`Agent AI: utworzono ${nowe.length} szkiców FV`);
  toast(`Utworzono ${nowe.length} szkiców FV ✅`);
  renderuj();
}
function agentAIKonkretneDzialanie(x={}){
  if(x.id==="linki-producentow"&&x.poziom==="bad")return {action:"",href:"#/admin/agent-ai/plan",label:"Wybierz właściwe produkty",done:"Każdy niejednoznaczny link ma ręcznie wybrany wariant; Agent nie zgaduje produktu.",eta:"do 30 min",mode:"approval",owner:"Administrator",requiresApproval:true};
  const automatic={
    "funkcjonalnosc-strony":{action:"plan-bezpieczny",label:"Sprawdź funkcje",done:"Baza i integracje krytyczne odpowiadają poprawnie.",eta:"1–3 min"},
    "synchronizacja-danych":{action:"plan-bezpieczny",label:"Pobierz świeże dane",done:"Sklep, Allegro, InPost i inFakt mają aktualne dane.",eta:"1–3 min"},
    faktury:{action:"masowe-fv",label:"Przygotuj szkice FV",done:"Każde zamówienie firmowe ma szkic dokumentu.",eta:"< 1 min"},
    zatowarowanie:{action:"utworz-zlecenie-braki",label:"Aktualizuj szkice producentów",done:"Każdy realny brak jest w jednym bieżącym dokumencie producenta.",eta:"< 1 min"},
    "linki-producentow":{action:"sprawdz-linki-producentow",label:"Sprawdź linki",done:"Każdy link ma zapisany wynik i listę brakujących danych.",eta:"1–5 min"},
    "opisy-produktow":{action:"popraw-opisy",label:"Popraw opisy",done:"Krótki i pełny opis mają uporządkowaną strukturę.",eta:"< 2 min"},
    kartoteka:{action:"kartoteka-domyslna",label:"Uzupełnij bezpieczne pola",done:"Produkty mają podstawową kartotekę do dalszej kontroli.",eta:"< 1 min"},
    inwentaryzacja:{action:"audyt-magazynu",label:"Wykonaj audyt",done:"Powstał raport produktów wymagających inwentaryzacji.",eta:"< 1 min"}
  };
  if(automatic[x.id])return {...automatic[x.id],mode:"automatic",owner:"Agent AI",requiresApproval:false};
  const approval={
    "wdrozenie-produktow":{href:"#/admin/agent-ai/produkty",label:"Dokończ nowe produkty",done:"Każdy nowy produkt ma kompletną tożsamość, opis, zdjęcia, producenta, kategorię sklepu i gotowy szkic Allegro."},
    "dostepnosc-producentow":{href:"#/admin/magazyn/dostawcy",label:"Wybierz termin lub ukrycie",done:"Każdy brak i niski stan ma decyzję: automat, termin 1–7 dni, ukrycie lub ręczne pozostawienie sprzedaży."},
    dostepnosc:{href:"#/admin/zamowienia",label:"Potwierdź lub ustaw oczekiwanie",done:"Każde zamówienie ma decyzję: potwierdzone, oczekiwanie 1–2 dni, kontakt z klientem albo brak."},
    sprzedaz:{href:"#/admin/magazyn/dostawcy",label:"Sprawdź powód i wybierz tryb",done:"Każdy wyłączony produkt ma termin albo jasną zasadę automatycznego wznowienia."},
    "allegro-oferty-agent":{href:"#/admin/allegro/wystawianie",label:"Uzupełnij, ponów lub zamknij",done:"Każde zadanie oferty zostało uzupełnione, ponowione albo świadomie zamknięte."},
    "przyjecia-nadwyzek":{href:"#/admin/magazyn/plan",label:"Przyjmij lub pozostaw",done:"Każda nadwyżka ma zapisaną decyzję i ewentualny ruch magazynowy."}
  };
  if(approval[x.id])return {...approval[x.id],action:"",eta:x.poziom==="bad"?"do 30 min":"dzisiaj",mode:"approval",owner:"Administrator",requiresApproval:true};
  return {action:"",href:String(x.akcja||"").startsWith("#")?x.akcja:"#/admin/agent-ai/plan",label:"Otwórz i zdecyduj",done:agentAIOpisKroku(x),eta:x.poziom==="bad"?"do 30 min":"dzisiaj",mode:"approval",owner:"Administrator",requiresApproval:true};
}
function agentAIProfilePlanow(){
  return {
    full:{id:"full",icon:"🧭",label:"Pełny plan",description:"Funkcjonalność, pobieranie danych i bezpieczne przygotowanie pracy.",areas:["site-health","allegro-orders","inpost","infakt"],local:["database","suppliers","invoices","links"]},
    data:{id:"data",icon:"🔄",label:"Pobieranie danych",description:"Odświeża źródła i bazę bez tworzenia dokumentów roboczych.",areas:["allegro-orders","inpost","infakt"],local:["database","links"]},
    health:{id:"health",icon:"🩺",label:"Funkcjonalność",description:"Sprawdza stronę, integracje i wspólną bazę bez operacji biznesowych.",areas:["site-health"],local:["database"]}
  };
}
function agentAIUstawProfil(profil="full"){
  if(agentAIPlanStan.busy||!agentAIProfilePlanow()[profil])return;
  agentAIPlanProfil=profil;zapiszLS("artway_agent_plan_profil",profil);agentAIPlanStan={...agentAIPlanStan,profile:profil};renderuj();
}
async function agentAIPobierzHistorieWykonan(cicho=false){
  if(agentAIPlanStan.historyLoading||!chmuraToken)return [];
  agentAIPlanStan={...agentAIPlanStan,historyLoading:true};
  try{
    const d=await chmura("agent-action-runs",{timeout:20000});
    const history=Array.isArray(d.items)?d.items:[];agentAIPlanStan={...agentAIPlanStan,history,historyLoading:false};
    if(!cicho)toast(`Pobrano ${history.length} wykonań Agenta`);renderuj();return history;
  }catch(e){agentAIPlanStan={...agentAIPlanStan,historyLoading:false};if(!cicho)toast(`Historia Agenta: ${e.message||e}`);return [];}
}
function agentAIBledneObszary(){
  const current=(agentAIPlanStan.results||[]).filter(x=>x.status==="error"&&x.area).map(x=>x.area);
  if(current.length)return [...new Set(current)];
  const last=(agentAIPlanStan.history||[]).find(x=>(x.results||[]).some(r=>r.status==="error"));
  return [...new Set((last?.results||[]).filter(x=>x.status==="error"&&x.area).map(x=>x.area))];
}
async function agentAIWykonajPlanBezpieczny(profile=agentAIPlanProfil,overrideAreas=null){
  if(agentAIPlanStan.busy)return "Plan Agenta jest już wykonywany.";
  const profiles=agentAIProfilePlanow(),retry=profile==="retry",definition=retry?{id:"retry",label:"Ponowienie błędów",areas:agentAIBledneObszary(),local:[]}:profiles[profile]||profiles.full;
  const areas=Array.isArray(overrideAreas)?overrideAreas:definition.areas;
  if(retry&&!areas.length){toast("Nie ma błędnych kroków do ponowienia");return "Nie ma błędnych kroków do ponowienia.";}
  const startedAt=new Date().toISOString(),results=[],runStarted=Date.now();
  agentAIPlanStan={...agentAIPlanStan,busy:true,current:"Uruchamianie planu",startedAt,completedAt:null,results:[],error:"",profile:definition.id,runId:""};renderuj();
  const add=(entry={})=>{const result={area:entry.area||"",name:entry.name||entry.label||"Działanie",status:entry.status||"completed",detail:String(entry.detail||entry.error||""),durationMs:Number(entry.durationMs)||0,at:new Date().toISOString()};results.push(result);agentAIPlanStan={...agentAIPlanStan,current:result.name,results:[...results]};renderuj();return result;};
  const timed=async(area,name,fn)=>{const t=Date.now();try{return add({area,name,status:"completed",detail:await fn(),durationMs:Date.now()-t});}catch(e){return add({area,name,status:"error",error:e.message||e,durationMs:Date.now()-t});}};
  try{
    if(areas.length){
      try{
        const d=await chmura("agent-run-safe-checks",{method:"POST",body:{source:"admin-agent-ai",profile:definition.id,areas},timeout:180000});
        agentAIPlanStan={...agentAIPlanStan,runId:d.run?.id||""};
        (d.run?.results||[]).forEach(x=>{const detail=x.area==="allegro-orders"?`aktywne: ${x.active||0} • nowe: ${x.newItems||0} • odświeżone: ${x.refreshed||0} • przeskanowane: ${x.scanned||0}`:x.area==="site-health"?String(x.detail||"Strona i integracje odpowiadają"):`sprawdzono: ${x.count||0}`;add({area:x.area,name:x.label,status:x.status,detail:x.status==="completed"?detail:x.error,durationMs:x.durationMs});});
      }catch(e){add({area:"server-checks",name:"Kontrole serwerowe",status:"error",error:e.message||e});}
    }
    if(definition.local.includes("database"))await timed("central-database","Wspólna baza sklepu",async()=>{const ok=await synchronizujBazeCentralna(true);if(!ok)throw new Error("Nie udało się potwierdzić synchronizacji");return "pobrano i zapisano najnowszy stan";});
    if(definition.local.includes("suppliers")){
      const t=Date.now(),docs=(await agentAIUzgodnijPlanZSerwerem({silent:true})).filter(agentAIPlanDokumentAktywny);
      add({area:"supplier-drafts",name:"Plan zatowarowania producentów",status:docs.length?"completed":"skipped",detail:docs.length?`${docs.length} aktywnych dokumentów z kanonicznego serwera • bez wysyłania e-maili`:"brak realnych braków do aktywnych zamówień",durationMs:Date.now()-t});
    }
    if(definition.local.includes("invoices")){
      const t=Date.now(),before=szkiceFaktur.length,missing=pobierzZamowienia().filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length;
      if(missing){utworzSzkiceFakturMasowo();add({area:"invoice-drafts",name:"Szkice FV",status:"completed",detail:`utworzono ${Math.max(0,szkiceFaktur.length-before)} szkiców • bez wystawiania faktur`,durationMs:Date.now()-t});}
      else add({area:"invoice-drafts",name:"Szkice FV",status:"skipped",detail:"brak nowych zamówień firmowych",durationMs:Date.now()-t});
    }
    if(definition.local.includes("links")){
      if(agentAILinkiOczekujace().length)await timed("supplier-links","Linki producentów",()=>agentAISprawdzLinkiProducentow(profile==="data"?5:3));
      else add({area:"supplier-links",name:"Linki producentów",status:"skipped",detail:"kolejka jest pusta"});
    }
    const completedAt=new Date().toISOString(),errors=results.filter(x=>x.status==="error").length;
    agentAIPlanStan={...agentAIPlanStan,busy:false,current:"",startedAt,completedAt,results,error:errors?`${errors} kroków wymaga ponowienia`:""};
    zapiszHistorieAgenta("plan-operacyjny",`${definition.label}: ${results.length-errors}/${results.length} kroków bez błędu`,{profile:definition.id,startedAt,completedAt,durationMs:Date.now()-runStarted,results});zaplanujZapisUstawien();
    toast(errors?`⚠️ Plan zakończony • błędy: ${errors}`:`✅ ${definition.label}: wszystkie kroki zakończone`);renderuj();void agentAIPobierzHistorieWykonan(true);
    return [`${errors?"⚠️":"✅"} ${definition.label} zakończony.`,...results.map(x=>`• ${x.status==="completed"?"✅":x.status==="skipped"?"➖":"⚠️"} ${x.name}: ${x.detail}`),"Nie wysłano e-maili, wiadomości do klientów, ofert, etykiet ani faktur bez zatwierdzenia."].join("\n");
  }catch(e){agentAIPlanStan={...agentAIPlanStan,busy:false,current:"",completedAt:new Date().toISOString(),results,error:String(e.message||e)};zapiszHistorieAgenta("plan-operacyjny","Błąd planu Agenta",{profile:definition.id,results,error:String(e.message||e)});renderuj();throw e;}
}
async function agentAIWykonaj(akcja){
  if(akcja==="plan-bezpieczny") return agentAIWykonajPlanBezpieczny(agentAIPlanProfil);
  if(akcja==="plan-full") return agentAIWykonajPlanBezpieczny("full");
  if(akcja==="plan-data") return agentAIWykonajPlanBezpieczny("data");
  if(akcja==="plan-health") return agentAIWykonajPlanBezpieczny("health");
  if(akcja==="plan-retry") return agentAIWykonajPlanBezpieczny("retry");
  if(akcja==="masowe-fv") return utworzSzkiceFakturMasowo();
  if(akcja==="sync") return synchronizujBazeCentralna(true);
  if(akcja==="export-magazyn") return eksportujMagazynCSV();
  if(akcja==="export-zakupy") return eksportujTabeleOperacyjnaMagazynuCSV();
  if(akcja==="utworz-zlecenie-braki"||akcja==="utworz-zlecenie-niskie")return agentAIUzgodnijPlanZSerwerem();
  if(akcja==="sprawdz-linki-producentow") return agentAISprawdzLinkiProducentow().then(t=>toast(t));
  if(akcja==="sprawdz-dostepnosc-producentow") return agentAISprawdzDostepnoscProducentow();
  if(akcja==="popraw-opisy"){ const t=agentAIPoprawOpisyProduktow(40); toast(t); renderuj(); return t; }
  if(akcja==="kartoteka-domyslna") return wypelnijDomyslnaKartotekeMagazynu();
  if(akcja==="audyt-magazynu") return audytMagazynuAI();
  if(akcja==="raport-telegram") return agentAIWyslijRaportTelegram();
}
async function agentAIWykonajZadaniePlanu(id,akcja){
  try{
    await agentAIWykonaj(akcja);
    if(String(akcja).startsWith("plan-")&&agentAIPlanStan.error)throw new Error(agentAIPlanStan.error);
    agentAIOznaczZadanieWykonane(id,"agent-action");
  }catch(e){toast(`⚠️ Zadanie nie zostało zamknięte: ${e.message||e}`);}
}
function agentAIPriorytet(x){
  if(x.id==="funkcjonalnosc-strony") return 0;
  if(x.id==="synchronizacja-danych") return .5;
  if(x.id==="wdrozenie-produktow") return .75;
  if(x.poziom==="bad") return 1;
  if(["wysylki","zatowarowanie","nadrezerwacje","dostepnosc","dostepnosc-producentow"].includes(x.id)) return 2;
  if(x.poziom==="warn") return 3;
  return 9;
}
function agentAIOpisKroku(x){
  const mapa={
    dostepnosc:"Zweryfikuj dostępność pozycji powyżej limitu i wpisz decyzję przy zamówieniu.",
    wysylki:"Uzupełnij dane InPost, wygeneruj etykietę i zapisz numer nadania.",
    faktury:"Utwórz lub odśwież szkice FV dla zamówień firmowych.",
    "opisy-produktow":"Uruchom agenta opisów: uzupełni krótki opis i uporządkuje pełny opis bez zmiany danych technicznych.",
    "wdrozenie-produktow":"Dokończ wdrożenie produktu dodanego przez administratora: tożsamość, duplikaty, opisy, zdjęcia, producent, kategorie sklepu i Allegro.",
    ceny:"Uzupełnij cenę przed sprzedażą, żeby klient nie złożył błędnego zamówienia.",
    magazyn:"Sprawdź produkty z niskim stanem i zdecyduj, czy zamówić uzupełnienie.",
    zatowarowanie:"Przygotuj zamówienie do producenta tylko pod realne braki aktywnych zamówień.",
    nadrezerwacje:"Najpierw obsłuż nadrezerwacje — blokują kompletację zamówień.",
    kartoteka:"Uzupełnij dostawcę wyłącznie dla realnych braków obecnych w Planie zatowarowania.",
    "lokalizacje-kompletacja":"Magazyn przypisuje miejsce towarom z aktywnych zamówień; rezerwacja i kompletacja pozostają aktywne.",
    lokalizacje:"Utwórz brakujące lokalizacje w słowniku i przypisz je do produktów jako osobne zadanie magazynu.",
    pamiec:"Dodaj procedury, których agent ma pilnować przy kolejnych poleceniach.",
    "linki-producentow":"Ponów pobranie URL-i producentów i sprawdź, które dane trzeba jeszcze uzupełnić w karcie produktu.",
    "allegro-oferty-agent":"Uzupełnij automatyczne sugestie producenta, kategorii i produktu katalogowego; pozostałe braki otwórz w edytorze produktu.",
    monitoring:"Zdecyduj, które produkty mają mieć kontrolowany stan, a które bez limitu.",
    inwentaryzacja:"Potwierdź stan produktów bez świeżej inwentaryzacji.",
    zdjecia:"Dodaj zdjęcia do produktów, które nadal używają samej ikony.",
    integracje:"Sprawdź konfigurację bramki, poczty i wspólnej bazy."
  };
  return mapa[x.id]||"Otwórz wskazany moduł i wykonaj kontrolę.";
}
function agentAICentrumDecyzjiHTML(){
  const supplier=statystykiDostepnosciProducentow(),orders=pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci),communication=allegroKomunikacjaStaty(),messages=[...(communication.threads||[]),...(communication.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi),offers=allegroAktywneZadaniaAgentaOfert(),surplus=agentAINadwyzkiDoPrzyjecia(),supplierDocs=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny);
  const areas=[
    {icon:"🏭",title:"Dostępność producenta",count:supplier.wymagajaDecyzji.length,href:"#/admin/magazyn/dostawcy",choices:["automat","zostaw 1–7 dni","ukryj","wznów po powrocie","aktywny bez terminu"]},
    {icon:"🔎",title:"Dostępność w zamówieniu",count:orders.length,href:"#/admin/zamowienia",choices:["potwierdź","poczekaj 1–2 dni","kontakt z klientem","potwierdź brak"]},
    {icon:"🏷️",title:"Zadania ofert Allegro",count:offers.length,href:"#/admin/allegro/wystawianie",choices:["uzupełnij","ponów","otwórz produkt","zamknij zadanie"]},
    {icon:"💬",title:"Wiadomości i dyskusje",count:messages.length,href:"#/admin/allegro/wiadomosci",choices:["odpowiedz","użyj propozycji Agenta","załatwione wewnętrznie"]},
    {icon:"📥",title:"Nadwyżki magazynowe",count:surplus.length,href:"#/admin/magazyn/plan",choices:["przyjmij","pozostaw","skoryguj ilość"]},
    {icon:"🧾",title:"Plan zatowarowania",count:supplierDocs.length,href:"#/admin/magazyn/plan",choices:["sprawdź szkic","zatwierdź wersję","wyślij e-mail","przyjmij dostawę"]}
  ];
  return `<div class="panel agent-decision-center"><div class="order-section-head"><div><span class="order-pro-label">Kontrola człowieka</span><h2>🧭 Centrum decyzji administratora</h2><p class="order-detail-lead">Agent przygotowuje dane i bezpieczne propozycje, ale w miejscach wpływających na klienta, sprzedaż lub wysyłkę zawsze pokazuje konkretne warianty wyboru.</p></div><span class="lvl ${areas.some(x=>x.count)?"lvl-ostrzezenie":"lvl-ok"}">${areas.reduce((s,x)=>s+x.count,0)} otwartych decyzji</span></div><div class="agent-decision-grid">${areas.map(x=>`<article class="${x.count?"has-items":""}"><header><span>${x.icon}</span><div><b>${esc(x.title)}</b><small>${x.count?`${x.count} wymaga wyboru`:"brak otwartych decyzji"}</small></div><strong>${x.count}</strong></header><div>${x.choices.map(c=>`<span>${esc(c)}</span>`).join("")}</div><a class="btn ghost" href="${x.href}">${x.count?"Podejmij decyzje":"Otwórz moduł"}</a></article>`).join("")}</div></div>`;
}
function agentAIPlanOperacyjnyHTML(analiza){
  const zadania=agentAIAnalizaAktywna(analiza).sort((a,b)=>agentAIPriorytet(a)-agentAIPriorytet(b)).slice(0,12);
  const gotowe=analiza.filter(x=>x.poziom==="ok").length;
  const profiles=agentAIProfilePlanow(),selected=profiles[agentAIPlanProfil]||profiles.full,runResults=agentAIPlanStan.results||[],runDone=runResults.filter(x=>x.status==="completed"||x.status==="skipped").length,runErrors=runResults.filter(x=>x.status==="error").length;
  const expected=Math.max(runResults.length,selected.areas.length+selected.local.length),progress=agentAIPlanStan.busy?Math.min(95,Math.round((runDone+runErrors)/Math.max(1,expected)*100)):runResults.length?100:0;
  const runDuration=agentAIPlanStan.startedAt?Math.max(0,Math.round(((agentAIPlanStan.completedAt?Date.parse(agentAIPlanStan.completedAt):Date.now())-Date.parse(agentAIPlanStan.startedAt))/1000)):0;
  const history=(agentAIPlanStan.history||[]).slice(0,5),retryCount=agentAIBledneObszary().length,archive=Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).sort((a,b)=>String(b.completedAt||b.resolvedAt||"").localeCompare(String(a.completedAt||a.resolvedAt||""))).slice(0,12);
  return `<div class="panel agent-ops-panel">
    <div class="order-section-head">
      <div><span class="order-pro-label">Centrum wykonawcze</span><h2 style="margin-top:.2rem">🧭 Wykonywalny plan operacyjny</h2><p class="order-detail-lead">Najpierw funkcjonalność strony i świeże dane, następnie zamówienia, wysyłki, magazyn oraz katalog. Każdy krok ma właściciela, czas, wynik i jednoznaczny warunek zakończenia.</p></div>
      <div class="diag-actions"><span class="lvl ${zadania.length?"lvl-ostrzezenie":"lvl-ok"}">${zadania.length?`${zadania.length} aktywnych zadań`:"wszystko pod kontrolą"}</span></div>
    </div>
    <div class="agent-run-profiles">${Object.values(profiles).map(p=>`<button type="button" class="${agentAIPlanProfil===p.id?"active":""}" onclick="agentAIUstawProfil(${jsArg(p.id)})" ${agentAIPlanStan.busy?"disabled":""}><span>${p.icon}</span><b>${esc(p.label)}</b><small>${esc(p.description)}</small></button>`).join("")}</div>
    <div class="agent-run-toolbar"><div><b>Wybrany zakres: ${selected.icon} ${esc(selected.label)}</b><small>${selected.areas.length} kontroli serwerowych • ${selected.local.length} kroków lokalnych • operacje zewnętrzne zablokowane</small></div><div class="diag-actions"><button class="btn" onclick="agentAIWykonaj(${jsArg(`plan-${selected.id}`)})" ${agentAIPlanStan.busy?"disabled":""}>${agentAIPlanStan.busy?"⏳ Wykonuję…":"▶ Wykonaj bezpieczne działania"}</button><button class="btn ghost" onclick="agentAIWykonaj('plan-retry')" ${agentAIPlanStan.busy||!retryCount?"disabled":""}>↻ Ponów błędy${retryCount?` (${retryCount})`:""}</button></div></div>
    ${agentAIPlanStan.busy||runResults.length?`<div class="agent-execution-status ${agentAIPlanStan.error?"has-error":""}"><div><div><b>${agentAIPlanStan.busy?`Agent wykonuje: ${esc(agentAIPlanStan.current||"kontrola")}`:"Ostatnie wykonanie planu"}</b><small>${agentAIPlanStan.runId?`ID audytu ${esc(agentAIPlanStan.runId.slice(0,8))} • `:""}${runDuration}s • ${runDone} zakończonych • ${runErrors} błędów</small></div><small>${agentAIPlanStan.completedAt?esc(new Date(agentAIPlanStan.completedAt).toLocaleString("pl-PL")):"operacja w toku"}</small></div><div class="agent-run-progress"><i style="width:${progress}%"></i></div><div class="agent-execution-results">${runResults.map(r=>`<span class="${esc(r.status)}"><b>${r.status==="completed"?"✅":r.status==="skipped"?"➖":"⚠️"} ${esc(r.name)}</b><small>${esc(r.detail)}</small><em>${r.durationMs?`${Math.max(1,Math.round(r.durationMs/1000))} s`:"—"}</em></span>`).join("")}</div>${agentAIPlanStan.error?`<p>${esc(agentAIPlanStan.error)}</p>`:""}</div>`:""}
    <div class="agent-run-history"><div class="order-section-head"><div><b>Ostatnie wykonania na serwerze</b><small>Trwały audyt jest wspólny dla wszystkich urządzeń administratora.</small></div><button class="btn ghost" onclick="agentAIPobierzHistorieWykonan()" ${agentAIPlanStan.historyLoading?"disabled":""}>${agentAIPlanStan.historyLoading?"⏳":"↻"} Odśwież</button></div>${history.length?`<div class="agent-run-history-list">${history.map(h=>{const errors=(h.results||[]).filter(x=>x.status==="error").length;return `<article><span class="${errors?"error":"ok"}">${errors?"⚠️":"✅"}</span><div><b>${esc(agentAIProfilePlanow()[h.profile]?.label||h.profile||"Kontrola")}</b><small>${esc(new Date(h.completedAt||h.startedAt).toLocaleString("pl-PL"))} • ${Math.max(1,Math.round(Number(h.durationMs||0)/1000))} s • wynik ${esc(h.scoreAfter??"—")}%</small></div><code>${esc(String(h.id||"").slice(0,8))}</code></article>`;}).join("")}</div>`:`<p class="order-detail-lead">${agentAIPlanStan.historyLoading?"Pobieram historię wykonań…":"Historia pojawi się po pierwszej kontroli serwerowej."}</p>`}</div>
    <div class="agent-ops-grid">
      ${zadania.length?zadania.map((x,i)=>{const step=agentAIKonkretneDzialanie(x);return `<div class="agent-ops-step ${x.poziom} ${step.mode}">
        <div class="agent-ops-no">${i+1}</div>
        <div><div class="agent-step-heading"><b>${x.ikona} ${esc(x.tytul)}</b><span class="lvl ${step.requiresApproval?"lvl-ostrzezenie":"lvl-ok"}">${step.requiresApproval?"🔐 decyzja":"⚙️ Agent"}</span></div><p>${esc(x.opis)}</p><div class="agent-step-definition"><span><small>KONKRETNE DZIAŁANIE</small><b>${esc(step.label)}</b></span><span><small>WŁAŚCICIEL / CZAS</small><b>${esc(step.owner)} • ${esc(step.eta)}</b></span><span><small>GOTOWE, GDY</small><b>${esc(step.done)}</b></span></div></div>
        <div class="agent-task-actions">${step.action?`<button class="btn ${step.requiresApproval?"ghost":""}" onclick="agentAIWykonajZadaniePlanu(${jsArg(x.id)},${jsArg(step.action)})">${esc(step.label)}</button>`:`<a class="btn ghost" href="${esc(step.href)}">${esc(step.label)}</a>`}<button class="btn task-complete" type="button" onclick="agentAIOznaczZadanieWykonane(${jsArg(x.id)})">✓ Wykonane</button></div>
      </div>`;}).join(""):`<div class="agent-ops-empty">✅ Brak pilnych tematów. ${gotowe} kontroli ma status OK.</div>`}
    </div>
    <details class="agent-task-archive" ${zadania.length?"":"open"}><summary>✅ Zakończone zadania (${archive.length})</summary>${archive.length?`<div class="agent-task-archive-list">${archive.map(x=>`<article><span>✓</span><div><b>${esc(x.title||x.id)}</b><small>${esc(x.completedAt?new Date(x.completedAt).toLocaleString("pl-PL"):"rozwiązane automatycznie")} • ${esc(x.completedBy||"Agent")}</small></div>${x.state==="done"?`<button class="btn ghost" onclick="agentAIPrzywrocZadanie(${jsArg(x.id)})">Przywróć</button>`:`<em>problem rozwiązany</em>`}</article>`).join("")}</div>`:`<p class="order-detail-lead">Archiwum wypełni się po oznaczeniu pierwszego zadania jako wykonane.</p>`}</details>
  </div>`;
}

function agentAIPodstronaNaglowekHTML(aktywna="pulpit",activeCount=0){
  if(aktywna==="pulpit")return "";
  const pages={
    komendy:["💬","Komendy i odpowiedzi","Wydawaj polecenia zwykłym językiem. Odpowiedzi, wynik działania i audyt pozostają w jednym miejscu."],
    specjalisci:["✦","Specjaliści GPT-5 nano","Konkretne role do opisów, odpowiedzi, SEO, promocji, bannerów, Allegro i kontroli jakości z historią oraz kontrolą kosztów."],
    uprawnienia:["🛡️","Uprawnienia i granice autonomii","Jedna centralna lista pokazuje, co Agent wykonuje sam, co zawsze wymaga zatwierdzenia i kiedy operacja zostaje zatrzymana."],
    plan:["🧭","Plan operacyjny","Widzisz wyłącznie aktywne problemy. Wykonane zadania trafiają do historii i wracają tylko po nowym zdarzeniu."],
    produkty:["✨","Wdrożenie nowych produktów","Agent koncentruje się na produktach dodawanych przez administratora i prowadzi je od kartoteki do gotowości sklepu oraz Allegro."],
    zlecenia:["📑","Zlecenia i tabele producentów","Bieżące dokumenty robocze, ilości, zatwierdzenia i wysyłka do producentów bez mieszania z archiwum."],
    producenci:["🏭","Producenci i kontakt","Kartoteki dostawców, adresy zamówień, warunki współpracy i szablony korespondencji."],
    telegram:["✈️","Komunikacja Telegram","Jedna polityka alertów, raportów zbiorczych, ciszy nocnej, zwykłych pytań do bota i pełnego audytu dostarczeń."],
    pamiec:["🧠","Pamięć i procedury","Reguły zapisane dla Agenta. Możesz je przeglądać, usuwać i dodawać nowe przez Komendy."],
    historia:["🕓","Historia i audyt","Zakończone zadania, wykonania planów oraz pełny rejestr działań administratora i Agenta."]
  },page=pages[aktywna]||pages.plan;
  return `<section class="panel agent-page-header"><div><span>${page[0]}</span><div><span class="order-pro-label">Agent AI</span><h1>${esc(page[1])}</h1><p>${esc(page[2])}</p></div></div><div><b>${activeCount}</b><small>aktywnych zadań</small></div></section>`;
}
function ustawFiltrAgentAIProduktow(filtr="wszystkie"){filtrAgentAIProdukty=filtr;renderuj();}
function agentAIProduktyWdrozeniePanelHTML(){
  const addedIds=new Set((produktyDodane||[]).map(p=>String(p.id))),items=produktyDoAdministracji().filter(p=>addedIds.has(String(p.id))).sort((a,b)=>String(b.createdAt||b.agentImportAt||b.id||"").localeCompare(String(a.createdAt||a.agentImportAt||a.id||""))).slice(0,500);
  const allRows=items.map(p=>({p,state:agentAIStanWdrozeniaProduktu(p),status:p.agentOnboardingStatus||"not_started"})),processing=allRows.filter(x=>x.status==="processing").length,completed=allRows.filter(x=>x.state.ready&&x.status!=="processing").length,attention=allRows.filter(x=>!x.state.ready&&x.status!=="processing").length;
  const rows=allRows.filter(x=>filtrAgentAIProdukty==="uwaga"?!x.state.ready&&x.status!=="processing":filtrAgentAIProdukty==="przetwarzanie"?x.status==="processing":filtrAgentAIProdukty==="gotowe"?x.state.ready&&x.status!=="processing":true);
  const cards=[["uwaga","⚠️",attention,"wymaga uzupełnienia",attention?"hot":""],["przetwarzanie","⏳",processing,"w trakcie kontroli",""],["gotowe","✅",completed,"gotowych produktów","money"],["wszystkie","📦",allRows.length,"produktów administratora",""]];
  return `<section class="panel agent-product-onboarding-page"><div class="order-section-head"><div><span class="order-pro-label">Priorytet administratora</span><h2>✨ Wdrożenie nowych produktów</h2><p class="order-detail-lead">Każdy produkt przechodzi sześć kontroli. Kliknij kartę licznika, aby natychmiast wyświetlić odpowiadające jej produkty.</p></div><div class="diag-actions"><a class="btn" href="#/admin/produkty/dodaj">＋ Dodaj ręcznie lub z linku</a></div></div><div class="orders-stat-grid">${cards.map(([id,icon,count,label,cls])=>`<button type="button" class="order-stat-card stat-filter ${cls} ${filtrAgentAIProdukty===id?"active":""}" onclick="ustawFiltrAgentAIProduktow(${jsArg(id)})"><span>${icon}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div><div class="agent-onboarding-filter-state"><span>Aktywny filtr: <b>${esc(cards.find(x=>x[0]===filtrAgentAIProdukty)?.[3]||"wszystkie")}</b></span><small>${rows.length} z ${allRows.length} produktów</small>${filtrAgentAIProdukty!=="wszystkie"?`<button class="btn ghost" onclick="ustawFiltrAgentAIProduktow('wszystkie')">Wyczyść filtr</button>`:""}</div><div class="agent-product-onboarding-list">${rows.map(({p,state,status})=>`<article class="${state.ready?"ready":"attention"}"><div class="agent-product-onboarding-main">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa||"Produkt bez nazwy")}</b><small>ID ${esc(p.id)} • EAN ${esc(p.gtin||p.ean||"—")} • ${esc(p.producent||p.marka||"producent —")}</small><em>${status==="processing"?"Agent pracuje":state.ready?"gotowy":"wymaga uzupełnienia"} • ${state.done}/${state.total} kontroli</em></div></div><div class="product-agent-checks">${state.checks.map(x=>`<span class="${x.ok?"done":"wait"}">${x.ok?"✓":"○"} ${esc(x.label)}</span>`).join("")}</div><div class="warehouse-worktable-actions"><button class="btn" onclick="agentAIUruchomWdrozenieProduktu(${jsArg(p.id)},this)" ${status==="processing"?"disabled":""}>🤖 ${status==="processing"?"Kontrola…":"Sprawdź i uzupełnij"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj</a></div></article>`).join("")||`<div class="agent-ops-empty">Brak produktów dla wybranego filtra.</div>`}</div></section>`;
}
function agentAIPamiecPanelHTML(){
  const memory=(agentAIPamiec||[]).slice(0,100);
  return `<section class="panel agent-memory-page"><div class="order-section-head"><div><span class="order-pro-label">Procedury trwałe</span><h2>🧠 Pamięć Agenta</h2><p class="order-detail-lead">Każda reguła synchronizuje się między urządzeniami. Agent stosuje ją jako podpowiedź, ale działania zewnętrzne nadal wymagają zatwierdzenia.</p></div><a class="btn" href="#/admin/agent-ai/komendy" onclick="setTimeout(()=>agentAIWstawKomende('zapamiętaj: '),80)">＋ Naucz Agenta</a></div><div class="orders-stat-grid"><div class="order-stat-card"><span>🧠</span><b>${memory.length}</b><small>zapisanych procedur</small></div><div class="order-stat-card money"><span>☁️</span><b>${chmuraStan.admin?"TAK":"NIE"}</b><small>synchronizacja wspólna</small></div></div>${memory.length?`<div class="agent-memory-list">${memory.map(x=>`<article class="agent-memory-item"><div><b>${esc(x.wyzwalacz||"Procedura")}</b><p>${esc(x.akcja||x.tresc)}</p><small>${esc(x.dataTxt||"")} • ${esc(x.operator||"")}</small></div><button class="btn danger" type="button" onclick="agentAIUsunPamiec(${jsArg(x.id)})">Usuń</button></article>`).join("")}</div>`:`<div class="agent-ops-empty">Nie ma jeszcze zapisanych procedur. Przejdź do Komend i wpisz „zapamiętaj: …”.</div>`}</section>`;
}
async function agentAIRuntimePobierz(silent=true){
  if(agentAIRuntime.loading)return agentAIRuntime.runtime;
  agentAIRuntime={...agentAIRuntime,loading:true,error:""};
  if(!silent){const box=$("agentAIRuntimePanel");if(box)box.innerHTML=agentAIRuntimePanelHTML();}
  try{
    const data=await chmura("agent-runtime-status",{timeout:20000});
    agentAIRuntime={...agentAIRuntime,loading:false,loaded:true,error:"",runtime:data.runtime||null,updatedAt:Date.now()};
  }catch(error){
    agentAIRuntime={...agentAIRuntime,loading:false,loaded:true,error:String(error?.message||error),updatedAt:Date.now()};
  }
  const box=$("agentAIRuntimePanel");
  if(box)box.innerHTML=agentAIRuntimePanelHTML();
  return agentAIRuntime.runtime;
}
function agentAIRuntimePolling(){
  if(agentAIRuntime.pollTimer)clearTimeout(agentAIRuntime.pollTimer);
  if(!String(location.hash||"").startsWith("#/admin/agent-ai")){agentAIRuntime.pollTimer=null;return;}
  agentAIRuntime.pollTimer=setTimeout(async()=>{await agentAIRuntimePobierz(true);agentAIRuntimePolling();},15000);
}
function agentAIRuntimeCzas(value=""){
  const time=Date.parse(value||"");
  if(!Number.isFinite(time))return "brak danych";
  const diff=Math.max(0,Date.now()-time),seconds=Math.round(diff/1000);
  if(seconds<60)return `${Math.max(1,seconds)} s temu`;
  if(seconds<3600)return `${Math.round(seconds/60)} min temu`;
  if(seconds<86400)return `${Math.round(seconds/3600)} godz. temu`;
  return new Date(time).toLocaleString("pl-PL");
}
function agentAIRuntimePanelHTML(){
  const state=agentAIRuntime,r=state.runtime||{},worker=r.worker||{},providers=r.providers||{},queue=r.queue||{},counts=queue.counts||{},current=r.currentRun,last=r.lastRun,activity=Array.isArray(r.activity)?r.activity:[],rawWarnings=Array.isArray(r.integrationWarnings)?r.integrationWarnings:[];
  const warnings=[...new Map(rawWarnings.map(item=>[`${item.kind||"system"}:${item.error||item.label}`,item])).values()],aiWarnings=warnings.filter(item=>item.kind==="ai"),externalWarnings=warnings.filter(item=>item.kind!=="ai");
  if(state.loading&&!state.loaded)return `<section class="panel agent-runtime-shell"><div class="agent-runtime-loading"><i></i><div><b>Łączę pulpit z procesem wykonawczym…</b><small>Pobieram kolejkę, ostatni cykl i stan dostawców AI.</small></div></div></section>`;
  if(state.error&&!state.runtime)return `<section class="panel agent-runtime-shell"><div class="backend-note warn"><b>Nie udało się pobrać telemetrii Agenta.</b><p>${esc(state.error)}</p><button class="btn ghost" onclick="agentAIRuntimePobierz(false)">Ponów kontrolę</button></div></section>`;
  const stateMeta={online:["🟢","Agent działa","Wszystkie podstawowe procesy odpowiadają."],working:["⚙️","Agent właśnie pracuje",current?.summary||"Trwa automatyczny cykl."],degraded:["🟠",aiWarnings.length?"Agent AI wymaga kontroli":"Agent AI działa prawidłowo",aiWarnings.length?"Dostawca AI zgłosił błąd podczas ostatniego zadania.":"Ostrzeżenie dotyczy wyłącznie zewnętrznej integracji sprzedażowej."],stale:["🟡","Agent czeka na następny cykl","Brakuje świeżego zakończonego cyklu; proces wykonawczy pozostaje połączony."],offline:["🔴","Agent wykonawczy offline","Proces nie wysłał aktualnego sygnału pracy."]}[r.state]||["⚪","Sprawdzam Agenta","Oczekiwanie na pierwszy sygnał procesu."];
  const providerCards=[
    ["codex","⌘","Codex planner","Rozumienie niejednoznacznych poleceń i bezpieczny plan JSON"],
    ["openai","✦","OpenAI Responses API","Role: operacje, katalog, magazyn, komunikacja i zgodność"],
    ["anthropic","◇","Claude","Drugi dostawca pracujący rotacyjnie i jako automatyczny fallback"],
    ["xai","𝕏","Grok — xAI","Trzeci dostawca rotacyjny z osobnym limitem dziennym"]
  ].map(([id,icon,label,detail])=>{const p=providers[id]||{},ready=p.connected===true,configured=p.configured===true,status=ready?"potwierdzony działającym zadaniem":configured?"skonfigurowany — czeka na kontrolę":"brak konfiguracji";return `<article class="${ready?"ready":configured?"configured":"attention"}"><span>${icon}</span><div><b>${label}</b><small>${esc(detail)}</small><em>${esc(p.model||"model automatyczny")} • ${status}${p.lastSuccessAt?` • ostatni sukces ${esc(agentAIRuntimeCzas(p.lastSuccessAt))}`:p.lastCheckedAt?` • kontrola ${esc(agentAIRuntimeCzas(p.lastCheckedAt))}`:""}</em>${p.error?`<p>${esc(p.error)}</p>`:""}</div><i></i></article>`;}).join("");
  const steps=(current?.steps||last?.steps||[]),run=current||last,done=steps.filter(x=>["completed","skipped"].includes(x.status)).length,progress=steps.length?Math.round(done/steps.length*100):0;
  return `<section class="agent-runtime-dashboard">
    <div class="panel agent-runtime-status ${esc(r.state||"unknown")}"><div class="agent-runtime-state"><span>${stateMeta[0]}</span><div><small>RZECZYWISTY STAN PROCESU</small><h2>${stateMeta[1]}</h2><p>${esc(stateMeta[2])}</p></div></div><div class="agent-runtime-now"><span><small>Ostatni kontakt</small><b>${esc(agentAIRuntimeCzas(worker.lastSeenAt))}</b></span><span><small>Następny detektor zmian</small><b>${r.schedule?.nextAt?esc(new Date(r.schedule.nextAt).toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit"})):"co 15 min"}</b></span><button class="btn ghost" onclick="agentAIRuntimePobierz(false)">${state.loading?"⏳":"↻"} Odśwież</button></div></div>
    ${warnings.length?`<div class="panel agent-runtime-warning ${aiWarnings.length?"is-ai-warning":"is-external-warning"}"><span>${aiWarnings.length?"⚠️":"🔌"}</span><div><b>${aiWarnings.length?`${warnings.length} obszarów wymaga kontroli Agenta`:`Agent AI działa • ${externalWarnings.length} połączenie zewnętrzne wymaga naprawy`}</b><p>${externalWarnings.length?`Allegro: ${esc(externalWarnings[0].error||externalWarnings[0].label)}${aiWarnings.length?" • ":""}`:""}${aiWarnings.map(x=>`${esc(x.label)}: ${esc(x.error)}`).join(" • ")}</p>${!aiWarnings.length?`<small>GPT‑5 nano i proces wykonawczy są aktywne. Do czasu naprawy nie są wykonywane wyłącznie operacje wymagające API Allegro.</small>`:""}</div><a class="btn" href="${aiWarnings.length?"#/admin/agent-ai/specjalisci":"#/admin/allegro/ustawienia"}">${aiWarnings.length?"Sprawdź AI":"Napraw Allegro"}</a></div>`:""}
    <div class="agent-runtime-grid"><section class="panel agent-runtime-run"><div class="order-section-head"><div><span class="order-pro-label">${current?"Na żywo":"Ostatni cykl"}</span><h2>${current?"⚙️ Co Agent robi teraz":"✅ Ostatnie wykonanie automatyczne"}</h2><p class="order-detail-lead">${run?`${esc(run.summary||"")} • ${esc(agentAIRuntimeCzas(run.completedAt||run.startedAt))}`:"Historia pojawi się po pierwszym cyklu serwera."}</p></div><span class="lvl ${current?"lvl-info":warnings.length?"lvl-ostrzezenie":"lvl-ok"}">${current?"w toku":last?.status||"oczekuje"}</span></div>${run?`<div class="agent-runtime-progress"><div><b>${done} / ${steps.length} etapów</b><small>${progress}%</small></div><i><span style="width:${progress}%"></span></i></div><div class="agent-runtime-steps">${steps.map(step=>`<article class="${esc(step.status)}"><span>${step.status==="running"?"⏳":step.status==="completed"?"✓":step.status==="skipped"?"—":step.status==="warning"?"!":"×"}</span><div><b>${esc(step.label||step.id)}</b><small>${esc(step.error||step.detail||"Oczekuje na wykonanie")}</small></div><em>${step.durationMs?`${Math.max(1,Math.round(step.durationMs/1000))} s`:""}</em></article>`).join("")}</div>`:`<div class="agent-ops-empty">Agent czeka na pierwszy cykl zapisany w nowym rejestrze.</div>`}</section>
      <aside class="panel agent-runtime-queue"><div class="order-section-head"><div><span class="order-pro-label">Kolejka poleceń</span><h2>🧠 Codex + GPT Agent</h2></div><strong>${esc(queue.active||0)}</strong></div><div class="agent-runtime-queue-stats"><span><b>${esc(counts.queued||0)}</b><small>oczekuje</small></span><span><b>${esc((counts.processing||0)+(counts.delivering||0))}</b><small>wykonywane</small></span><span><b>${esc(counts.completed||0)}</b><small>wykonane</small></span><span><b>${esc(counts.failed||0)}</b><small>błędy</small></span></div><div class="agent-runtime-worker"><span>${worker.currentTask?"⚙️":"✓"}</span><div><b>${esc(worker.currentTask||"Gotowy na polecenie")}</b><small>${worker.currentTaskStartedAt?`od ${esc(agentAIRuntimeCzas(worker.currentTaskStartedAt))}`:`${esc(worker.completedJobs||0)} wykonanych • ${esc(worker.failedJobs||0)} nieudanych`}</small></div></div><a class="btn" href="#/admin/agent-ai/komendy">Wydaj polecenie</a></aside></div>
    <section class="panel agent-runtime-providers"><div class="order-section-head"><div><span class="order-pro-label">Kontrolowany routing AI</span><h2>Połączenia i role Agenta</h2><p class="order-detail-lead">Parser sklepu wykonuje pewne operacje lokalnie. Codex porządkuje niejednoznaczne polecenia, a odpowiedzi są rozdzielane rotacyjnie między OpenAI, Claude i Groka. Niedostępny dostawca jest automatycznie pomijany. Żaden model nie zapisuje danych bez warstwy reguł i wymaganego potwierdzenia.</p></div></div><div>${providerCards}</div></section>
    <section class="panel agent-runtime-activity"><div class="order-section-head"><div><span class="order-pro-label">Dziennik na żywo</span><h2>Ostatnie działania</h2><p class="order-detail-lead">Bez treści prywatnych i sekretów — wyłącznie etap, źródło, wynik i czas.</p></div><a class="btn ghost" href="#/admin/agent-ai/historia">Pełna historia</a></div><div>${activity.slice(0,12).map(item=>`<article class="${esc(item.status)}"><span>${item.status==="success"?"✓":item.status==="warning"?"!":item.status==="error"?"×":item.status==="running"?"⋯":"•"}</span><div><b>${esc(item.title||"Zdarzenie Agenta")}</b><small>${esc(item.detail||item.source||"")}</small></div><time>${esc(agentAIRuntimeCzas(item.at))}</time></article>`).join("")||`<div class="agent-ops-empty">Dziennik zapełni się podczas następnego cyklu lub polecenia.</div>`}</div></section>
  </section>`;
}
async function agentAISpecjalisciPobierz(silent=true){
  if(agentAISpecjalisci.loading)return agentAISpecjalisci.data;
  agentAISpecjalisci={...agentAISpecjalisci,loading:true,error:""};if(!silent)renderuj();
  try{const data=await chmura("agent-specialists-status",{params:{historyLimit:30},timeout:30000});agentAISpecjalisci={...agentAISpecjalisci,loading:false,loaded:true,error:"",data,fetchedAt:Date.now()};}
  catch(error){agentAISpecjalisci={...agentAISpecjalisci,loading:false,loaded:true,error:String(error?.message||error)};}
  if(!silent)renderuj();else agentAISpecjalisciAktualizujWidocznePanele();return agentAISpecjalisci.data;
}
function agentAISpecjalisciAktualizujWidocznePanele(){
  const initiative=document.querySelector(".agent-initiative-panel");if(initiative)initiative.outerHTML=agentAIInicjatywaPanelHTML();
  const permissions=document.querySelector(".agent-permission-page");if(permissions)permissions.outerHTML=agentAIUprawnieniaPanelHTML();
  const specialistsPage=document.querySelector(".agent-specialists-page");
  if(specialistsPage){specialistsPage.querySelector(".agent-coordinator-card")?.remove();specialistsPage.querySelector(".agent-specialists-hero")?.insertAdjacentHTML("afterend",agentAICodexKoordynatorHTML(agentAISpecjalisci.data?.lastCycle||{}));}
  document.querySelectorAll("[data-product-agent-card]").forEach(card=>{const id=card.dataset.productAgentCard,product=pobierzProduktAdmin(id)||produkty.find(p=>String(p.id)===String(id));if(product)card.outerHTML=agentAIWdrozenieProduktuHTML(product,true);});
  const badge=document.querySelector("[data-agent-live-decision-count]");if(badge)badge.textContent=String(agentAISpecjalisci.data?.decisionStats?.open||0);
}
function agentAISpecjalisciPolling(){
  clearTimeout(agentAISpecjalisci.pollTimer);const relevant=location.hash.includes("/admin/agent-ai")||location.hash.includes("/admin/produkty/edytuj/");if(!relevant)return;
  agentAISpecjalisci.pollTimer=setTimeout(async()=>{await agentAISpecjalisciPobierz(true);agentAISpecjalisciPolling();},60000);
}
async function agentAISpecjalistaWykonaj(specialist,context={},instruction="",target={},options={}){
  const response=await chmura("agent-specialist-run",{method:"POST",body:{specialist,context,instruction,target,source:options.source||"manual"},timeout:120000});
  const run=response.run||null;agentAISpecjalisci={...agentAISpecjalisci,activeRun:run};
  if(agentAISpecjalisci.data&&run)agentAISpecjalisci.data={...agentAISpecjalisci.data,history:[run,...(agentAISpecjalisci.data.history||[]).filter(item=>item.id!==run.id)]};
  return run;
}
function agentAISpecjalistaPola(result={}){return Object.fromEntries((Array.isArray(result.fields)?result.fields:[]).map(field=>[String(field.key||""),String(field.value||"")]));}
async function agentAISpecjalistaProduktWdrozenie(product={}){
  const response=await chmura("agent-specialist-product-proposal",{method:"POST",body:{productId:String(product.id)},timeout:120000});
  if(response.run)agentAISpecjalisci={...agentAISpecjalisci,activeRun:response.run};
  await agentAISpecjalisciPobierz(true);
  return response.run||null;
}
function agentAISpecjalistaWynikHTML(run={},compact=false){
  const result=run.result||{},fields=Array.isArray(result.fields)?result.fields:[],warnings=[...(result.warnings||[]),...(result.missingFacts||[]).map(item=>`Brak faktu: ${item}`)],status=result.complianceStatus||"needs_review";
  const saved=["applied","auto_applied","not_needed"].includes(run.approvalStatus);
  return `<article class="agent-specialist-result ${esc(status)}"><header><div><span>${run.source==="automatic"?"⚙️":"✍️"}</span><div><b>${esc(result.title||run.specialistLabel||"Szkic GPT-5 nano")}</b><small>${esc(run.specialistLabel||run.specialist||"")} • ${esc(run.model||"gpt-5-nano")} • ${run.platformAgent?.id?`profil OpenAI ${esc(run.platformAgent.name||run.platformAgent.id)} • `:""}reguły ${esc(run.promptVersion||"bieżące")} • ${esc(agentAIRuntimeCzas(run.createdAt))}${run.cached?" • pamięć wyniku":""}</small></div></div><span class="lvl ${saved?"lvl-ok":status==="ready"?"lvl-ok":status==="blocked_missing_facts"?"lvl-blad":"lvl-ostrzezenie"}">${saved?(run.approvalStatus==="auto_applied"?"bezpiecznie zapisano":"zapisano"):run.target?.type==="product"?"automatyczna ponowna próba":status==="ready"?"gotowy do decyzji":status==="blocked_missing_facts"?"brak faktów":"sprawdź szkic"}</span></header>${result.summary?`<p>${esc(result.summary)}</p>`:""}${fields.length?`<div class="agent-specialist-fields">${fields.map(field=>`<section><small>${esc(field.label||field.key)}</small>${field.currentValue?`<div class="agent-field-before"><b>Było</b><span>${esc(field.currentValue)}</span></div>`:""}<pre>${esc(field.value||"")}</pre>${field.reason?`<p><b>Dlaczego:</b> ${esc(field.reason)}</p>`:""}${field.evidence?`<p><b>Podstawa:</b> ${esc(field.evidence)}</p>`:""}</section>`).join("")}</div>`:""}${!compact&&result.content?`<details><summary>Główna treść</summary><pre>${esc(result.content)}</pre></details>`:""}${warnings.length?`<div class="agent-specialist-warnings">${warnings.map(item=>`<span>⚠️ ${esc(item)}</span>`).join("")}</div>`:""}<footer><span>Pewność: <b>${Math.round(Number(result.confidence||0)*100)}%</b></span><span>Tokeny: <b>${esc(run.usage?.totalTokens||0)}</b></span>${run.target?.type==="product"&&!saved?`<span class="lvl lvl-ostrzezenie">Agent ponowi redakcję automatycznie — bez klikania</span>`:saved?`<span class="lvl lvl-ok">${run.approvalStatus==="auto_applied"?"zapisano bezpieczną pełną redakcję":"zapisano w produkcie"}</span>`:""}</footer></article>`;
}
async function agentAISpecjalistaFormularz(e){
  e?.preventDefault();const form=e.currentTarget,specialist=String(form.elements.specialist?.value||"product_content"),instruction=String(form.elements.instruction?.value||"").trim(),material=String(form.elements.material?.value||"").trim();
  if(!material){toast("Wpisz fakty lub materiał wejściowy");return false;}agentAISpecjalisci={...agentAISpecjalisci,running:true,error:""};renderuj();
  try{const run=await agentAISpecjalistaWykonaj(specialist,{material},instruction,{});toast(run.cached?"✅ Użyto aktualnego, sprawdzonego szkicu":"✅ GPT-5 nano przygotował szkic do zatwierdzenia");await agentAISpecjalisciPobierz(true);}
  catch(error){agentAISpecjalisci={...agentAISpecjalisci,error:String(error?.message||error)};toast("⚠️ GPT-5 nano: "+(error?.message||error));}
  finally{agentAISpecjalisci={...agentAISpecjalisci,running:false};renderuj();}return false;
}
async function agentAISpecjalistaZatwierdzProdukt(id,button=null){
  if(button)button.disabled=true;try{const data=await chmura("agent-specialist-apply",{method:"POST",body:{id},timeout:45000});await chmuraWczytajStan().catch(()=>{});const run=(agentAISpecjalisci.data?.history||[]).find(item=>item.id===id);if(run)run.approvalStatus="applied";toast(data.result?.duplicate?"ℹ️ Ten szkic był już zapisany":"✅ Zatwierdzone treści zapisano w produkcie");renderuj();}
  catch(error){toast("⚠️ Zatwierdzenie szkicu: "+(error?.message||error));if(button)button.disabled=false;}
}
async function agentAISpecjalisciZapiszUstawienia(e){
  e?.preventDefault();const form=e.currentTarget,f=new FormData(form),current=agentAISpecjalisci.data?.config||{},config={...current,enabled:f.get("enabled")==="on",automaticEnabled:f.get("automaticEnabled")==="on",safeAutoApply:f.get("safeAutoApply")==="on",autoApplyProductEditorial:f.has("autoApplyProductEditorial")?f.get("autoApplyProductEditorial")==="on":current.autoApplyProductEditorial!==false,autoUpdateLinkedAllegroContent:f.has("autoUpdateLinkedAllegroContent")?f.get("autoUpdateLinkedAllegroContent")==="on":current.autoUpdateLinkedAllegroContent!==false,learningEnabled:f.get("learningEnabled")==="on",approvalWarmupCount:Number(f.get("approvalWarmupCount")||0),learnedAutoApplyThreshold:Number(f.get("learnedAutoApplyThreshold")||86)/100,dailyLimit:Number(f.get("dailyLimit")||60),automaticDailyLimit:Number(f.get("automaticDailyLimit")||30),automaticBatchSize:Number(f.get("automaticBatchSize")||4),cacheHours:Number(f.get("cacheHours")||24),confidenceThreshold:Number(f.get("confidenceThreshold")||92)/100,decisionRetentionDays:Number(f.get("decisionRetentionDays")||30)};agentAISpecjalisci={...agentAISpecjalisci,saving:true};renderuj();
  try{await chmura("agent-specialists-config",{method:"POST",body:{config},timeout:30000});toast("✅ Zapisano kontrolę kosztów i automatykę GPT-5 nano");await agentAISpecjalisciPobierz(true);}catch(error){toast("⚠️ Ustawienia GPT: "+(error?.message||error));}finally{agentAISpecjalisci={...agentAISpecjalisci,saving:false};renderuj();}return false;
}
async function agentAIUprawnieniaZapisz(e){
  e?.preventDefault();const f=new FormData(e.currentTarget),current=agentAISpecjalisci.data?.config||{},automatic=agentAISpecjalisci.data?.policy?.actionPolicy?.automatic||[],config={...current,safeAutoApply:true};automatic.filter(item=>item.configKey).forEach(item=>{config[item.configKey]=f.get(item.configKey)==="on";});agentAISpecjalisci={...agentAISpecjalisci,saving:true};renderuj();
  try{await chmura("agent-specialists-config",{method:"POST",body:{config},timeout:30000});toast("✅ Polityka uprawnień Agenta została zapisana");await agentAISpecjalisciPobierz(true);}catch(error){toast("⚠️ Uprawnienia Agenta: "+(error?.message||error));}finally{agentAISpecjalisci={...agentAISpecjalisci,saving:false};renderuj();}return false;
}
async function agentAISpecjalisciCykl(){
  agentAISpecjalisci={...agentAISpecjalisci,running:true};renderuj();try{const data=await chmura("agent-specialist-auto-cycle",{method:"POST",body:{source:"admin-manual"},timeout:180000}),cycle=data.cycle||{},applied=cycle.applied?.length||0,decisions=cycle.decisions?.length||0;toast(applied||decisions?`✅ Agent: ${applied} bezpiecznych zapisów, ${decisions} nowych decyzji`:`ℹ️ ${cycle.reason==="daily_limit"?"Limit analiz wykorzystany — szczegóły są widoczne w panelu":cycle.reason==="no_candidates"?"Wszystko aktualne — brak nowych zadań":"Cykl zakończony"}`);await agentAISpecjalisciPobierz(true);}catch(error){toast("⚠️ Cykl GPT: "+(error?.message||error));}finally{agentAISpecjalisci={...agentAISpecjalisci,running:false};renderuj();}
}
async function agentAISpecjalistaDecyzja(id,decisionAction,days=1){
  if(agentAISpecjalistaDecyzjeWToku.has(String(id)))return;
  const fieldKeys=[...document.querySelectorAll("[data-agent-decision-field]")].filter(input=>input.dataset.agentDecisionField===String(id)&&input.checked).map(input=>input.value);
  const item=(agentAISpecjalisci.data?.decisions||[]).find(entry=>String(entry.id)===String(id)),product=!!(item?.target?.type==="product"&&item?.runId);
  if(decisionAction==="approve"&&product&&!fieldKeys.length){toast("Wybierz co najmniej jedną konkretną poprawkę do zapisania");return;}
  agentAISpecjalistaDecyzjeWToku.add(String(id));renderuj();
  try{const data=await chmura("agent-specialist-decision",{method:"POST",body:{id,decisionAction,days,fieldKeys},timeout:60000}),applied=Object.keys(data.decision?.executionResult?.patch||{}).length;if(decisionAction==="approve"&&product)await chmuraWczytajStan().catch(()=>{});toast(decisionAction==="approve"?(product?`✅ Zatwierdzenie wykonane — zapisano ${applied} ${applied===1?"pole":"pola"}`:"✅ Kierunek zatwierdzony — bez działania zewnętrznego"):decisionAction==="snooze"?`⏰ Decyzja odłożona na ${days} dni`:decisionAction==="dismiss"?"🗑️ Propozycja odrzucona":"✅ Sprawa zamknięta");await agentAISpecjalisciPobierz(true);}catch(error){const code=String(error?.code||"");toast(`⚠️ Zatwierdzenie nie zostało wykonane${code?` (${code})`:""}: ${error?.message||error}`);}finally{agentAISpecjalistaDecyzjeWToku.delete(String(id));renderuj();}
}
async function agentAISpecjalistaPoprawDecyzje(id){
  const input=document.querySelector(`[data-agent-feedback="${CSS.escape(String(id))}"]`),note=String(input?.value||"").trim();
  if(note.length<3){toast("Napisz krótko, co Agent ma zmienić");input?.focus();return;}
  if(agentAISpecjalistaDecyzjeWToku.has(String(id)))return;agentAISpecjalistaDecyzjeWToku.add(String(id));renderuj();
  try{await chmura("agent-specialist-decision",{method:"POST",body:{id,decisionAction:"revise",note},timeout:150000});toast("✨ Agent uwzględnił wskazówkę i przygotował nową wersję");await agentAISpecjalisciPobierz(true);}catch(error){toast("⚠️ Poprawa propozycji: "+(error?.message||error));}finally{agentAISpecjalistaDecyzjeWToku.delete(String(id));renderuj();}
}
function agentAISpecjalistaDecyzjaHTML(item={}){
  const risk={low:["Niskie ryzyko","lvl-ok"],medium:["Wymaga kontroli","lvl-ostrzezenie"],high:["Decyzja administratora","lvl-blad"]}[item.risk]||["Wymaga kontroli","lvl-ostrzezenie"],product=item.target?.type==="product"&&item.runId,busy=agentAISpecjalistaDecyzjeWToku.has(String(item.id)),run=(agentAISpecjalisci.data?.history||[]).find(entry=>String(entry.id)===String(item.runId)),fields=run?.result?.fields||[],warnings=[...(run?.result?.warnings||[]),...(run?.result?.missingFacts||[]).map(value=>`Brak faktu: ${value}`)];
  const changes=product&&fields.length?`<div class="agent-decision-changes"><b>Wybierz zatwierdzane poprawki</b>${fields.map(field=>`<label><input type="checkbox" data-agent-decision-field="${esc(item.id)}" value="${esc(field.key)}" checked><span><small>${esc(field.label||field.key)}</small>${field.currentValue?`<del>${esc(field.currentValue)}</del>`:""}<strong>${esc(field.value||"")}</strong>${field.reason?`<em>${esc(field.reason)}</em>`:""}</span></label>`).join("")}</div>`:"";
  return `<article class="agent-proposal-card risk-${esc(item.risk||"medium")} ${item.executionStatus==="failed"?"execution-failed":""}"><header><span>${esc(item.icon||"🧭")}</span><div><b>${esc(item.title||"Propozycja Agenta")}</b><small>${esc(item.specialist||"koordynator")} • ${esc(agentAIRuntimeCzas(item.createdAt))}${item.revisionCount?` • poprawiona ${esc(item.revisionCount)}×`:""}${item.operationId?` • operacja ${esc(item.operationId.slice(-8))}`:""}</small></div><em class="lvl ${item.executionStatus==="failed"?"lvl-blad":risk[1]}">${item.executionStatus==="failed"?"Nie wykonano":busy?"Wykonuję…":risk[0]}</em></header><p>${esc(item.summary||"")}</p><section><small>Rekomendacja</small><b>${esc(item.recommendation||"Sprawdź dane i wybierz dalsze działanie.")}</b></section>${changes}${warnings.length?`<div class="agent-specialist-warnings">${warnings.map(value=>`<span>⚠️ ${esc(value)}</span>`).join("")}</div>`:""}${item.lastError?`<div class="agent-decision-error"><b>Błąd ${esc(item.lastErrorCode||"")}</b><span>${esc(item.lastError)}</span><small>Nic nie wysłano na zewnątrz. Możesz poprawić dane i bezpiecznie ponowić zatwierdzenie.</small></div>`:""}${product?`<details class="agent-decision-feedback"><summary>✍️ Powiedz Agentowi, co ma poprawić</summary><textarea data-agent-feedback="${esc(item.id)}" rows="3" placeholder="Np. krótszy wstęp, więcej czytelnych akapitów, bez powtarzania nazwy…">${esc(item.feedbackNote||"")}</textarea><button class="btn" type="button" onclick="agentAISpecjalistaPoprawDecyzje(${jsArg(item.id)})" ${busy?"disabled":""}>✨ Przygotuj poprawioną wersję</button></details>`:""}${item.alternatives?.length?`<details><summary>Możliwe warianty</summary><ul>${item.alternatives.map(value=>`<li>${esc(value)}</li>`).join("")}</ul></details>`:""}<footer>${item.href?`<a class="btn" href="${esc(item.href)}">Otwórz właściwy moduł</a>`:""}<button class="btn ${product?"":"ghost"}" onclick="agentAISpecjalistaDecyzja(${jsArg(item.id)},'approve')" ${busy?"disabled":""}>${busy?"⏳ Wykonuję…":product?(item.executionStatus==="failed"?"↻ Ponów wybrane poprawki":"✅ Zatwierdź wybrane poprawki"):"✓ Akceptuj kierunek (bez wysyłki)"}</button><button class="btn ghost" onclick="agentAISpecjalistaDecyzja(${jsArg(item.id)},'snooze',1)" ${busy?"disabled":""}>⏰ Jutro</button><button class="btn ghost" onclick="agentAISpecjalistaDecyzja(${jsArg(item.id)},'dismiss')" ${busy?"disabled":""}>Odrzuć</button></footer></article>`;
}
function agentAIUprawnieniaPanelHTML(){
  const data=agentAISpecjalisci.data||{},cfg=data.config||{},policy=data.policy?.actionPolicy||{},automatic=Array.isArray(policy.automatic)?policy.automatic:[],approval=Array.isArray(policy.approvalRequired)?policy.approvalRequired:[],blocked=Array.isArray(policy.blockedOnUncertainty)?policy.blockedOnUncertainty:[];
  if(agentAISpecjalisci.loading&&!agentAISpecjalisci.loaded)return `<section class="panel agent-permission-page"><div class="agent-runtime-loading"><i></i><div><b>Pobieram centralną politykę uprawnień…</b><small>Sprawdzam rzeczywiste reguły serwera.</small></div></div></section>`;
  const isEnabled=item=>!item.configKey||cfg[item.configKey]!==false;
  const configurable=automatic.filter(item=>item.configKey),enabled=configurable.filter(isEnabled).length;
  return `<section class="agent-permission-page"><section class="panel agent-permission-hero"><div><span class="order-pro-label">Jedna polityka dla całej strony</span><h2>🛡️ Uprawnienia Agenta i zespołu</h2><p>Nadajesz Agentowi dostęp wyłącznie do bezpiecznych, odwracalnych działań. Operacje finansowe, sprzedażowe, wysyłkowe i zewnętrzna komunikacja pozostają stale zablokowane do decyzji administratora.</p></div><div class="agent-permission-summary"><span><b>${enabled}/${configurable.length}</b><small>nadanych automatyk</small></span><span><b>${approval.length}</b><small>stałych blokad</small></span></div></section><section class="panel agent-team-access"><div><span>👥</span><div><span class="order-pro-label">Dostęp konkretnych osób</span><h2>Administratorzy, Telegram i prawo zatwierdzania</h2><p>Na kontach użytkowników osobno nadajesz dostęp do panelu, rozmowy z Agentem oraz zatwierdzania chronionych decyzji.</p></div></div><a class="btn" href="#/admin/klienci/uprawnienia">Zarządzaj dostępem osób →</a></section><div class="agent-permission-columns"><form class="panel agent-permission-list automatic" onsubmit="return agentAIUprawnieniaZapisz(event)"><div class="order-section-head"><div><span class="order-pro-label">Nadawane przez administratora • pełny audyt</span><h2>⚡ Agent może wykonywać</h2><p class="order-detail-lead">Przełączniki dotyczą tylko bezpiecznej automatyki. Każdy zapis pozostaje w historii.</p></div><button class="btn" type="submit" ${agentAISpecjalisci.saving?"disabled":""}>💾 Zapisz uprawnienia</button></div><div class="agent-permission-items">${automatic.map(item=>`<article class="${isEnabled(item)?"enabled":"disabled"}"><span>${esc(item.icon||"⚡")}</span><div><b>${esc(item.label)}</b><p>${esc(item.description)}</p></div>${item.configKey?`<label class="switch-check"><input type="checkbox" name="${esc(item.configKey)}" ${isEnabled(item)?"checked":""}><span>${isEnabled(item)?"Nadane":"Wstrzymane"}</span></label>`:`<em>✓ funkcja systemowa</em>`}</article>`).join("")}</div><div class="agent-permission-guard"><b>Ochrona synchronizacji Allegro</b><span>Automatyczna aktualizacja treści nie zmienia ceny, stanu, aktywności oferty ani warunków sprzedaży.</span></div></form><section class="panel agent-permission-list approval"><div class="order-section-head"><div><span class="order-pro-label">Niezmienne • zawsze decyzja administratora</span><h2>🔐 Agent nie może wykonać sam</h2><p class="order-detail-lead">Tych blokad nie można wyłączyć przełącznikiem, poleceniem Telegram ani automatycznym cyklem.</p></div><span class="agent-policy-lock">🔒 polityka stała</span></div><div class="agent-permission-items">${approval.map(item=>`<article><span>${esc(item.icon||"🔐")}</span><div><b>${esc(item.label)}</b><p>${esc(item.description)}</p></div><em>🔐 zatwierdza administrator</em></article>`).join("")}</div></section></div><section class="panel agent-permission-blocked"><div><span>⛔</span><div><span class="order-pro-label">Automatyczny bezpiecznik</span><h2>Kiedy Agent zatrzymuje wykonanie</h2></div></div><div>${blocked.map(item=>`<span>• ${esc(item)}</span>`).join("")}</div><p>Przy niepewności Agent nie zgaduje i niczego nie wysyła. Redakcję produktu może ponowić bezpiecznie, a rzeczywista operacja sprzedażowa lub zewnętrzna zawsze trafia do administratora.</p></section></section>`;
}
function agentAICodexKoordynatorHTML(last={}){
  const plan=last?.coordinatorPlan||{},assignments=Array.isArray(plan.assignments)?plan.assignments:[];
  const labels={"catalog-editorial":"Redakcja katalogu","customer-reply-draft":"Szkice odpowiedzi","catalog-identity-control":"Kontrola tożsamości","supplier-order-draft":"Dokument producenta","seo-free-promotion":"Bezpłatne SEO"};
  return `<section class="panel agent-coordinator-card"><div class="order-section-head"><div><span class="order-pro-label">Główny koordynator • rzeczywisty Codex CLI</span><h2>⌘ Codex rozdziela pracę wyspecjalizowanym agentom GPT</h2><p class="order-detail-lead">Codex analizuje wyłącznie bezpieczne liczniki, wybiera wersjonowany scenariusz i przypisuje właściwą rolę. Specjalista wykonuje zadanie przez GPT-5 nano, a reguły sklepu kontrolują zapis i wymagane potwierdzenia.</p></div><span class="lvl ${assignments.length?"lvl-ok":"lvl-info"}">${assignments.length?`● ${assignments.length} ${assignments.length===1?"scenariusz":"scenariusze"}`:"oczekuje na cykl"}</span></div>${plan.summary?`<p class="agent-coordinator-summary">${esc(plan.summary)}</p>`:""}<div class="agent-coordinator-flow"><article><span>1</span><b>Codex</b><small>ocenia priorytety</small></article><i>→</i><article><span>2</span><b>Scenariusz</b><small>reguły i bramki jakości</small></article><i>→</i><article><span>3</span><b>GPT-5 nano</b><small>wykonuje przypisaną rolę</small></article><i>→</i><article><span>4</span><b>Sklep</b><small>waliduje, zapisuje lub pyta</small></article></div><div class="agent-coordinator-assignments">${assignments.map(item=>`<span><b>P${esc(item.priority||5)} · ${esc(labels[item.scenarioId]||item.scenarioId)}</b><small>${esc(item.specialist||"specjalista")} · v${esc(item.scenarioVersion||"—")}</small></span>`).join("")||`<small>Najbliższy automatyczny cykl zapisze tutaj faktyczny przydział Codex.</small>`}</div></section>`;
}
function agentAISpecjalisciPanelHTML(){
  const state=agentAISpecjalisci,data=state.data||{},specialists=Array.isArray(data.specialists)?data.specialists:[],history=Array.isArray(data.history)?data.history:[],decisions=Array.isArray(data.decisions)?data.decisions:[],usage=data.usage||{},stats=data.decisionStats||{},last=data.lastCycle||{},cfg=data.config||{enabled:true,automaticEnabled:true,safeAutoApply:true,autoApplyProductEditorial:true,autoUpdateLinkedAllegroContent:true,learningEnabled:true,approvalWarmupCount:3,learnedAutoApplyThreshold:.86,dailyLimit:240,automaticDailyLimit:200,automaticBatchSize:12,cacheHours:24,confidenceThreshold:.92,decisionRetentionDays:30},learning=data.learning?.productContent||{};
  if(state.loading&&!state.loaded)return `<section class="panel agent-specialists-page"><div class="agent-runtime-loading"><i></i><div><b>Uruchamiam zespół GPT-5 nano…</b><small>Pobieram role, limity i szkice.</small></div></div></section>`;
  if(state.error&&!data.specialists)return `<section class="panel"><div class="backend-note warn"><b>Nie udało się uruchomić specjalistów.</b><p>${esc(state.error)}</p><button class="btn" onclick="agentAISpecjalisciPobierz(false)">Ponów</button></div></section>`;
  const active=state.activeRun||history[0],never=(data.policy?.neverAutomatic||[]).join(", "),progress=last.editorialProgress||{},progressTotal=Number(progress.total||0),progressReady=Number(progress.ready||0),progressPercent=progressTotal?Math.round(progressReady/progressTotal*100):0;
  const autonomyHTML=`<section class="panel agent-learning-panel"><div><span>🧠</span><div><small>AUTONOMIA TREŚCI + PAMIĘĆ STYLU</small><h3>${cfg.autoApplyProductEditorial!==false?"Bezpieczne redakcje są zapisywane automatycznie":"Automatyczna redakcja jest wstrzymana"}</h3><p>Kompletne, zgodne opisy Agent zapisuje bez pytania. Twoje korekty nadal uczą go preferowanego tonu i układu; decyzja pojawia się tylko przy braku faktów, konflikcie lub ryzyku.</p></div></div><div><b>${esc(learning.approvals||0)}</b><small>zatwierdzeń</small><b>${esc(learning.corrections||0)}</b><small>korekt stylu</small><b>${esc(last.autoApplied||0)}</b><small>zapisów w cyklu</small></div></section>`;
  const progressHTML=`<section class="panel agent-proposal-board"><div class="order-section-head"><div><span class="order-pro-label">Sukcesywna redakcja katalogu</span><h2>Treści gotowe dla sklepu i Allegro</h2><p class="order-detail-lead">Co 15 minut Agent bierze kolejne pozycje. Gotowego produktu nie analizuje ponownie, dopóki nie zmienią się fakty lub wybrany kanał sprzedaży.</p></div><span class="lvl ${progressTotal&&progressReady>=progressTotal?"lvl-ok":"lvl-ostrzezenie"}">${progressTotal?`${esc(progressPercent)}% gotowe`:"oczekuje na pierwszy cykl"}</span></div><div class="orders-stat-grid"><div class="order-stat-card"><span>✅</span><b>${esc(progressReady)}</b><small>redakcja zakończona</small></div><div class="order-stat-card money"><span>⏳</span><b>${esc(progress.pending||0)}</b><small>w kolejce sukcesywnej</small></div><div class="order-stat-card"><span>👁️</span><b>${esc(progress.review||0)}</b><small>wymaga decyzji</small></div><div class="order-stat-card"><span>✦</span><b>${esc(progress.processedThisCycle||0)}</b><small>obsłużono w ostatnim cyklu</small></div></div></section>`;
  return `<section class="agent-specialists-page"><section class="panel agent-specialists-hero"><div><span class="order-pro-label">Stała gotowość • cykl co ${esc(data.policy?.cycleMinutes||15)} minut</span><h2>✦ Zespół agentów OpenAI + GPT-5 nano</h2><p>Każda rola ma opublikowany, wersjonowany profil w OpenAI Platform. Serwer wywołuje profil przez Responses API, a bezpieczny fallback uruchamia wyłącznie przy błędzie referencji platformy. Strażnik Allegro uzupełnia redaktora i przejmuje tylko treści zatrzymane przez kontrolę zgodności.</p></div><div><strong>${esc(data.model||"gpt-5-nano")} • reguły ${esc(data.promptVersion||"—")}</strong><span class="lvl ${data.configured&&data.platformAgents?.configured&&cfg.automaticEnabled!==false?"lvl-ok":"lvl-blad"}">${data.configured&&data.platformAgents?.configured&&cfg.automaticEnabled!==false?`● ${specialists.length} ról OpenAI aktywnych`:"automatyka zatrzymana"}</span><button class="btn ghost" onclick="agentAISpecjalisciCykl()" ${state.running?"disabled":""}>${state.running?"⏳ Kontroluję…":"↻ Sprawdź teraz"}</button></div></section>${autonomyHTML}<div class="orders-stat-grid"><div class="order-stat-card money"><span>🧭</span><b>${esc(stats.open||0)}</b><small>decyzji dla Ciebie</small></div><div class="order-stat-card"><span>✅</span><b>${esc(last.autoApplied||0)}</b><small>bezpiecznie zapisano w cyklu</small></div><div class="order-stat-card"><span>✦</span><b>${specialists.length}</b><small>aktywnych ról specjalistycznych</small></div><div class="order-stat-card"><span>🪙</span><b>${esc(usage.automaticToday||0)} / ${esc(cfg.automaticDailyLimit||200)}</b><small>automatycznych analiz dzisiaj</small></div></div>${progressHTML}<section class="panel agent-proposal-board"><div class="order-section-head"><div><span class="order-pro-label">Tylko sprawy wymagające człowieka</span><h2>Decyzje i propozycje Agenta</h2><p class="order-detail-lead">Opisy nie pojawiają się tutaj. Zewnętrzne działania nadal wymagają zgody: ${esc(never)}.</p></div><span class="lvl ${stats.high?"lvl-blad":decisions.length?"lvl-ostrzezenie":"lvl-ok"}">${decisions.length?`${decisions.length} otwartych`:`wszystko pod kontrolą`}</span></div><div class="agent-proposal-list">${decisions.map(agentAISpecjalistaDecyzjaHTML).join("")||`<div class="agent-ops-empty">✅ Brak trudnych decyzji. Zespół nadal kontroluje sklep automatycznie co 15 minut.</div>`}</div></section><div class="agent-specialist-grid">${specialists.map(item=>`<article><span>${esc(item.icon||"✦")}</span><div><b>${esc(item.platformName||item.label)}</b><small>${esc(item.area)} • ${esc(item.platformPrompt?.id?item.platformPrompt.id.slice(0,10)+"…":"brak promptu")} • wersja ${esc(item.platformPrompt?.version||"—")}</small><p>${esc(item.description)}</p></div><i class="agent-role-live">● ${item.platformAvailable===false?"tryb awaryjny":"połączony"}</i></article>`).join("")}</div><details class="panel agent-specialist-manual"><summary>＋ Dodatkowe ręczne zadanie dla wybranej roli</summary><div class="agent-specialist-workspace"><form class="agent-specialist-form" onsubmit="return agentAISpecjalistaFormularz(event)"><label>Specjalista<select name="specialist">${specialists.map(item=>`<option value="${esc(item.id)}">${esc(item.icon)} ${esc(item.label)} • ${esc(item.area)}</option>`).join("")}</select></label><label>Co ma przygotować?<input name="instruction" maxlength="3000" placeholder="Np. przygotuj kampanię weekendową i tekst bannera"></label><label>Potwierdzone fakty<textarea name="material" rows="7" maxlength="12000" placeholder="Produkt, grupa odbiorców, rabat, daty lub obecna treść…"></textarea></label><button class="btn" type="submit" ${state.running?"disabled":""}>✦ Przygotuj dodatkowy szkic</button></form><aside>${active?agentAISpecjalistaWynikHTML(active):`<div class="agent-specialist-empty"><span>✦</span><b>Wynik pojawi się tutaj</b></div>`}</aside></div></details><form class="panel agent-specialist-settings" onsubmit="return agentAISpecjalisciZapiszUstawienia(event)"><div class="order-section-head"><div><span class="order-pro-label">Przepustowość automatyki</span><h2>Tempo przygotowania całego katalogu</h2><p class="order-detail-lead">Treści produktów zapisują się samodzielnie. Ustawienia określają wyłącznie tempo i dzienny limit użycia modelu.</p></div><button class="btn" type="submit" ${state.saving?"disabled":""}>💾 Zapisz ustawienia</button></div><div><label><input type="checkbox" name="enabled" ${cfg.enabled!==false?"checked":""}> Role aktywne</label><label><input type="checkbox" name="automaticEnabled" ${cfg.automaticEnabled!==false?"checked":""}> Czuwanie co 15 min</label><label><input type="checkbox" name="learningEnabled" ${cfg.learningEnabled!==false?"checked":""}> Ucz się z moich korekt stylu</label><label><input type="checkbox" name="safeAutoApply" ${cfg.safeAutoApply!==false?"checked":""}> Automatycznie zapisuj redakcje</label><label>Zatwierdzeń przed autonomią<input type="number" name="approvalWarmupCount" min="0" max="20" value="${esc(cfg.approvalWarmupCount??0)}"></label><label>Min. akceptacja pól (%)<input type="number" name="learnedAutoApplyThreshold" min="60" max="100" value="${esc(Math.round(Number(cfg.learnedAutoApplyThreshold||.86)*100))}"></label><label>Próg pewności (%)<input type="number" name="confidenceThreshold" min="75" max="100" value="${esc(Math.round(Number(cfg.confidenceThreshold||.92)*100))}"></label><label>Automatyczne / dzień<input type="number" name="automaticDailyLimit" min="0" max="400" value="${esc(cfg.automaticDailyLimit??200)}"></label><label>Analiz na cykl<input type="number" name="automaticBatchSize" min="1" max="12" value="${esc(cfg.automaticBatchSize||10)}"></label><label>Wszystkie / dzień<input type="number" name="dailyLimit" min="1" max="500" value="${esc(cfg.dailyLimit||240)}"></label><label>Pamięć wyniku (godz.)<input type="number" name="cacheHours" min="1" max="168" value="${esc(cfg.cacheHours||24)}"></label><label>Historia decyzji (dni)<input type="number" name="decisionRetentionDays" min="7" max="90" value="${esc(cfg.decisionRetentionDays||30)}"></label></div></form><section class="panel agent-specialist-history"><div class="order-section-head"><div><span class="order-pro-label">Pełny audyt pracy</span><h2>Co agenci rzeczywiście wykonali</h2><p class="order-detail-lead">Każdy wynik ma prompt OpenAI, model wykonawczy, wersję reguł, pewność, użyte tokeny i stan zapisu.</p></div><button class="btn ghost" onclick="agentAISpecjalisciPobierz(false)">↻ Odśwież</button></div><div>${history.slice(0,30).map(run=>agentAISpecjalistaWynikHTML(run,true)).join("")||`<div class="agent-ops-empty">Historia pojawi się po najbliższym cyklu serwera.</div>`}</div></section></section>`;
}
function agentAIInicjatywaPanelHTML(){
  const data=agentAISpecjalisci.data||{},learning=data.learning?.productContent||{},decisions=(data.decisions||[]).filter(item=>item.kind==="product_content_review"),history=data.history||[],last=data.lastCycle||{},usage=data.usage||{},limit=usage.dailyLimitReached||usage.automaticLimitReached||last.limitReached;
  if(agentAISpecjalisci.loading&&!agentAISpecjalisci.loaded)return `<section class="panel agent-initiative-panel"><div class="agent-runtime-loading"><i></i><div><b>Sprawdzam inicjatywy redakcyjne…</b><small>Agent łączy kolejkę produktów i pamięć Twoich zatwierdzeń.</small></div></div></section>`;
  const recent=history.filter(run=>run.specialist==="product_content").slice(0,5);
  if(data.policy?.actionPolicy){const saved=recent.filter(run=>["auto_applied","applied","not_needed"].includes(run.approvalStatus));return `<section class="panel agent-initiative-panel"><div class="order-section-head"><div><span class="order-pro-label">Autonomiczna redakcja • bez czekania na komendę</span><h2>✨ Co Agent rzeczywiście wykonał</h2><p class="order-detail-lead">Co 15 minut bierze kolejne produkty, zapisuje kompletne opisy i przekazuje treść istniejących ofert Allegro do synchronizacji. Panel odświeża wynik co minutę.</p></div><div class="diag-actions"><button class="btn" onclick="agentAISpecjalisciCykl()" ${agentAISpecjalisci.running?"disabled":""}>${agentAISpecjalisci.running?"⏳ Analizuję…":"↻ Uruchom cykl teraz"}</button><a class="btn ghost" href="#/admin/agent-ai/uprawnienia">🛡️ Uprawnienia</a></div></div>${limit?`<div class="backend-note warn"><b>Limit analiz został wykorzystany.</b><p>Kolejne redakcje ruszą po północy czasu polskiego albo po zmianie limitu.</p></div>`:""}<div class="agent-initiative-stats"><span><b>${esc(last.autoApplied||0)}</b><small>automatycznie zapisano w cyklu</small></span><span><b>${esc(last.editorialProgress?.pending||0)}</b><small>produktów w kolejce</small></span><span class="${decisions.length?"learning":"ready"}"><b>${esc(decisions.length)}</b><small>wyjątków do decyzji</small></span><span class="ready"><b>AKTYWNA</b><small>autonomia opisów i SEO</small></span></div><div class="agent-initiative-list">${decisions.slice(0,4).map(item=>{const run=history.find(x=>String(x.id)===String(item.runId));return `<article><span>⚠️</span><div><b>${esc(item.target?.name||item.title||"Produkt")}</b><small>${esc(run?.result?.fields?.length||0)} pól • ${esc(item.summary||"wyjątek wymaga sprawdzenia")}</small></div><a class="btn" href="${esc(item.href||"#/admin/agent-ai/specjalisci")}">Rozwiąż wyjątek</a></article>`;}).join("")||saved.slice(0,3).map(run=>`<article class="completed"><span>✓</span><div><b>${esc(run.target?.name||run.result?.title||"Produkt")}</b><small>treści zapisano automatycznie • ${esc(agentAIRuntimeCzas(run.appliedAt||run.createdAt))}</small></div><a class="btn ghost" href="#/admin/agent-ai/specjalisci">Audyt</a></article>`).join("")||`<div class="agent-ops-empty">✅ Agent czuwa. Najbliższy cykl sam wybierze kolejny produkt.</div>`}</div></section>`;}
  return `<section class="panel agent-initiative-panel"><div class="order-section-head"><div><span class="order-pro-label">Inicjatywa Agenta • bez czekania na komendę</span><h2>✨ Co Agent proponuje w edycji produktów</h2><p class="order-detail-lead">Serwer sam bierze kolejne produkty co 15 minut. Panel pobiera nowe pytania automatycznie co minutę, bez odświeżania całej strony.</p></div><div class="diag-actions"><button class="btn" onclick="agentAISpecjalisciCykl()" ${agentAISpecjalisci.running?"disabled":""}>${agentAISpecjalisci.running?"⏳ Analizuję…":"↻ Sprawdź produkty teraz"}</button><a class="btn ghost" href="#/admin/agent-ai/specjalisci">Pełne decyzje</a></div></div>${limit?`<div class="backend-note warn"><b>Limit analiz został wykorzystany.</b><p>Agent nie ukrywa bezczynności: kolejne propozycje ruszą po północy czasu polskiego albo po świadomym zwiększeniu limitu w ustawieniach.</p></div>`:""}<div class="agent-initiative-stats"><span><b>${esc(decisions.length)}</b><small>pytań o zapis</small></span><span><b>${esc(last.editorialProgress?.pending||0)}</b><small>produktów w kolejce</small></span><span><b>${esc(learning.approvals||0)}</b><small>zatwierdzeń zapamiętanych</small></span><span class="${learning.ready?"ready":"learning"}"><b>${learning.ready?"aktywna":`${esc(learning.remainingApprovals??3)} do końca nauki`}</b><small>ograniczona autonomia</small></span></div><div class="agent-initiative-list">${decisions.slice(0,4).map(item=>{const run=history.find(x=>String(x.id)===String(item.runId));return `<article><span>✨</span><div><b>${esc(item.target?.name||item.title||"Produkt")}</b><small>${esc(run?.result?.fields?.length||0)} zmian • ${esc(run?.result?.summary||item.summary||"czeka na decyzję")}</small></div><a class="btn" href="${esc(item.href||"#/admin/agent-ai/specjalisci")}">Porównaj i zdecyduj</a></article>`;}).join("")||recent.slice(0,3).map(run=>`<article class="completed"><span>✓</span><div><b>${esc(run.target?.name||run.result?.title||"Produkt")}</b><small>${run.approvalStatus==="auto_applied"?"bezpieczna redakcja zapisana":run.approvalStatus==="applied"?"zatwierdzona przez administratora":"propozycja przygotowana"} • ${esc(agentAIRuntimeCzas(run.createdAt))}</small></div><a class="btn ghost" href="#/admin/agent-ai/specjalisci">Historia</a></article>`).join("")||`<div class="agent-ops-empty">Agent jest gotowy. Najbliższy cykl sam wybierze produkt wymagający redakcji.</div>`}</div></section>`;
}

/* Telegram, historia i widoki przestrzeni roboczej Agenta */
async function agentAITelegramPobierz(live=false,silent=false){
  if(agentAITelegram.loading)return;
  agentAITelegram={...agentAITelegram,loading:true,error:""};if(!silent)renderuj();
  try{const d=await chmura("telegram-center-status",{params:{live:live?1:0},timeout:30000});agentAITelegram={...agentAITelegram,...d,loading:false,loaded:true,error:""};}
  catch(e){agentAITelegram={...agentAITelegram,loading:false,loaded:true,error:String(e.message||e)};if(!silent)toast("⚠️ Telegram: "+(e.message||e));}
  renderuj();
}
async function agentAITelegramZapisz(e){
  e?.preventDefault();const f=new FormData(e.currentTarget),settings={
    enabled:f.get("enabled")==="on",mode:String(f.get("mode")||"important"),automaticCritical:f.get("automaticCritical")==="on",customerMessages:f.get("customerMessages")==="on",supplierAlerts:f.get("supplierAlerts")==="on",operationalAlerts:f.get("operationalAlerts")==="on",digestEnabled:f.get("digestEnabled")==="on",digestTimes:[f.get("digestTime1"),f.get("digestTime2")].filter(Boolean),quietStart:String(f.get("quietStart")||"21:00"),quietEnd:String(f.get("quietEnd")||"07:00"),criticalDuringQuiet:f.get("criticalDuringQuiet")==="on",onlyChanges:f.get("onlyChanges")==="on",repeatOpenHours:Number(f.get("repeatOpenHours")||24),cooldownMinutes:Number(f.get("cooldownMinutes")||720),maxItems:Number(f.get("maxItems")||8),incidentWorkflow:f.get("incidentWorkflow")==="on",autoResolve:f.get("autoResolve")==="on",slaEnabled:f.get("slaEnabled")==="on",criticalSlaMinutes:Number(f.get("criticalSlaMinutes")||60),warningSlaMinutes:Number(f.get("warningSlaMinutes")||240),escalationEnabled:f.get("escalationEnabled")==="on",escalationRepeatMinutes:Number(f.get("escalationRepeatMinutes")||120),maxEscalations:Number(f.get("maxEscalations")||2),topicRouting:f.get("topicRouting")==="on",topicCustomer:Number(f.get("topicCustomer")||0),topicOperations:Number(f.get("topicOperations")||0),topicSupplier:Number(f.get("topicSupplier")||0)
  };agentAITelegram={...agentAITelegram,saving:true};renderuj();
  try{const d=await chmura("telegram-settings-save",{method:"POST",body:{settings},timeout:30000});agentAITelegram={...agentAITelegram,settings:d.settings,saving:false};toast("✅ Zapisano politykę komunikacji Telegram");await agentAITelegramPobierz(false,true);}
  catch(err){agentAITelegram={...agentAITelegram,saving:false,error:String(err.message||err)};toast("⚠️ Telegram: "+(err.message||err));renderuj();}
  return false;
}
async function agentAITelegramAkcja(typ){
  const map={test:["telegram-test",{},"Wysyłam jedną cichą wiadomość testową…"],webhook:["telegram-register-webhook",{},"Podłączam interaktywne przyciski i komendy…"],digest:["telegram-dispatch",{forceDigest:true,source:"admin-manual-digest"},"Przygotowuję raport wyłącznie z nowych spraw…"],report:["telegram-send-agent-report",{source:"admin-telegram-center"},"Wysyłam pełny raport na żądanie…"],dashboard:["telegram-dashboard-refresh",{create:true,source:"admin-telegram-center"},"Tworzę albo aktualizuję jedną stałą kartę operacyjną…"]},def=map[typ];if(!def)return;
  agentAITelegram={...agentAITelegram,loading:true,error:""};renderuj();toast(def[2]);
  try{const d=await chmura(def[0],{method:"POST",body:def[1],timeout:45000});toast(typ==="webhook"?"✅ Bot odbiera pytania i interaktywne decyzje":typ==="dashboard"?"✅ Stały pulpit Telegram został zaktualizowany":typ==="digest"&&!d.dispatch?.sent?`ℹ️ ${d.dispatch?.reason||"Brak nowych spraw do wysłania"}`:"✅ Telegram: operacja zakończona");await agentAITelegramPobierz(true,true);}
  catch(e){agentAITelegram={...agentAITelegram,loading:false,error:String(e.message||e)};toast("⚠️ Telegram: "+(e.message||e));renderuj();}
}
async function agentAITelegramWyslijNotatke(e){
  e?.preventDefault();const input=$("agentTelegramNote"),text=String(input?.value||"").trim();if(text.length<3){toast("Wpisz treść notatki");return false;}
  try{await chmura("telegram-send-note",{method:"POST",body:{text,silent:$("agentTelegramNoteSilent")?.checked===true},timeout:30000});if(input)input.value="";toast("✅ Notatka wysłana do zespołu");await agentAITelegramPobierz(false,true);}catch(err){toast("⚠️ Telegram: "+(err.message||err));}return false;
}
async function agentAITelegramIncydent(id,incidentAction){
  try{await chmura("telegram-incident-action",{method:"POST",body:{id,incidentAction,source:"admin-panel"},timeout:30000});toast("✅ Zmieniono wewnętrzny stan sprawy");await agentAITelegramPobierz(false,true);}catch(err){toast("⚠️ Telegram: "+(err.message||err));}
}
async function agentAITelegramDostarczenie(id,deliveryAction){
  try{await chmura("telegram-delivery-action",{method:"POST",body:{id,deliveryAction},timeout:30000});toast(deliveryAction==="retry"?"✅ Wiadomość wróciła do kolejki ponowień":"✅ Usunięto zamknięty wpis kolejki");await agentAITelegramPobierz(false,true);}catch(err){toast("⚠️ Telegram: "+(err.message||err));}
}
function agentAITelegramFiltrujSprawy(){
  const q=String($("telegramIncidentSearch")?.value||"").toLowerCase().trim(),status=String($("telegramIncidentStatus")?.value||"active");
  document.querySelectorAll(".telegram-incident-card").forEach(el=>{const matchesText=!q||String(el.dataset.search||"").includes(q),s=String(el.dataset.status||"open"),matchesStatus=status==="all"||(status==="active"&&s!=="resolved")||s===status;el.hidden=!(matchesText&&matchesStatus);});
}
function agentAITelegramPanelHTML(){
  const t=agentAITelegram,s=t.settings||{enabled:true,mode:"important",automaticCritical:true,customerMessages:true,supplierAlerts:false,operationalAlerts:true,digestEnabled:false,digestTimes:["08:00","16:00"],quietStart:"21:00",quietEnd:"07:00",criticalDuringQuiet:false,onlyChanges:true,repeatOpenHours:24,cooldownMinutes:720,maxItems:8,incidentWorkflow:true,autoResolve:true,slaEnabled:true,criticalSlaMinutes:60,warningSlaMinutes:240,escalationEnabled:true,escalationRepeatMinutes:120,maxEscalations:2,topicRouting:false,topicCustomer:0,topicOperations:0,topicSupplier:0},status=t.status||{},worker=t.agentWorker||{},stats=t.stats||{},incidents=Array.isArray(t.incidents)?t.incidents:[],history=Array.isArray(t.history)?t.history:[],outbox=Array.isArray(t.outbox)?t.outbox:[],times=s.digestTimes||["08:00","16:00"],health=t.state?.health||{},dashboard=t.state?.dashboard||{};
  const modeLabel={important:"Pilne od razu + raport zbiorczy",digest:"Tylko raporty zbiorcze",manual:"Wyłącznie na moje żądanie"}[s.mode]||s.mode;
  const incidentLabel=x=>x.status==="resolved"?"załatwiona":x.status==="snoozed"?"odłożona":x.status==="acknowledged"?"przyjęta":"nowa",incidentClass=x=>x.status==="resolved"?"resolved":x.status==="snoozed"?"snoozed":x.status==="acknowledged"?"acknowledged":"open",isOverdue=x=>["open","acknowledged"].includes(x.status)&&x.dueAt&&Date.parse(x.dueAt)<=Date.now();
  const privacyModeBlocked=!!status.bot&&status.bot.can_read_all_group_messages===false,botUsername=status.bot?.username||"magazyn_artway_bot";
  const allowlist=status.allowlist||{chats:0,users:0},inboundLabel={accepted:"przyjęta lokalnie",deferred:"przekazana Agentowi",rejected:"odrzucona"}[health.lastInboundStatus]||"brak danych";
  return `<section class="telegram-center-page">
    <div class="panel telegram-control-hero"><div><span class="order-pro-label">Jeden bot • jeden webhook • jeden Agent</span><h2>✈️ Operacyjny Telegram Artway-TM</h2><p>Wiadomości odbiera wyłącznie webhook sklepu, a jeden Agent wykonawczy przygotowuje odpowiedzi. Wspólne centrum pilnuje statusów, SLA, eskalacji, ponowień i aktualizuje istniejące karty bez duplikatów.</p></div><div class="diag-actions"><button class="btn ghost" onclick="agentAITelegramPobierz(true)" ${t.loading?"disabled":""}>${t.loading?"⏳ Sprawdzam…":"↻ Kontrola systemu"}</button><button class="btn telegram-btn" onclick="agentAITelegramAkcja('dashboard')">📡 ${dashboard.messageId?"Aktualizuj pulpit":"Utwórz stały pulpit"}</button></div></div>
    ${privacyModeBlocked?`<div class="backend-note warn telegram-privacy-warning" role="alert"><b>⚠️ Privacy Mode blokuje zwykłe polecenia w grupie</b><p>Bot odbiera teraz głównie komendy, odpowiedzi i bezpośrednie wzmianki. Aby Agent rozumiał zwykłe wiadomości zespołu, wyłącz Privacy Mode:</p><ol><li>Otwórz <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> i wyślij <code>/setprivacy</code>.</li><li>Wybierz <code>@${esc(botUsername)}</code>, a następnie <b>Disable</b>.</li><li>Wróć tutaj i kliknij <b>Kontrola systemu</b>, aby potwierdzić zmianę.</li></ol></div>`:""}
    <div class="orders-stat-grid telegram-status-grid telegram-ops-stats"><div class="order-stat-card ${stats.new?"hot":""}"><span>🔔</span><b>${esc(stats.new||0)}</b><small>nowych spraw</small></div><div class="order-stat-card"><span>👤</span><b>${esc(stats.acknowledged||0)}</b><small>przyjętych do obsługi</small></div><div class="order-stat-card"><span>⏸</span><b>${esc(stats.snoozed||0)}</b><small>odłożonych</small></div><div class="order-stat-card ${stats.overdue?"hot":"money"}"><span>⏱️</span><b>${esc(stats.overdue||0)}</b><small>po terminie SLA</small></div><div class="order-stat-card ${Number(stats.deliveryRate)<99?"hot":"money"}"><span>📨</span><b>${esc(stats.deliveryRate??100)}%</b><small>skuteczność dostarczeń</small></div><div class="order-stat-card ${(stats.retrying||stats.deadLetters)?"hot":""}"><span>🛟</span><b>${esc((stats.retrying||0)+(stats.deadLetters||0))}</b><small>kolejka / wymaga reakcji</small></div><div class="order-stat-card ${status.webhook?.active?"money":"hot"}"><span>↔️</span><b>${status.webhook?.active?"ONLINE":"BRAK"}</b><small>interaktywny webhook</small></div></div>
    ${t.error?`<div class="backend-note telegram-error"><b>Błąd komunikacji:</b> ${esc(t.error)}</div>`:""}${status.error?`<div class="backend-note telegram-error"><b>Telegram API:</b> ${esc(status.error)}</div>`:""}
    <div class="telegram-center-layout"><form class="panel telegram-policy-form" onsubmit="return agentAITelegramZapisz(event)"><div class="order-section-head"><div><span class="order-pro-label">Polityka komunikacji, SLA i routingu</span><h2>Automatyka kontrolowana</h2><p class="order-detail-lead">Jedne ustawienia sterują Agentem, Allegro, wysyłkami, magazynem i producentami.</p></div><button class="btn" type="submit" ${t.saving?"disabled":""}>${t.saving?"⏳ Zapisuję…":"💾 Zapisz reguły"}</button></div>
      <div class="telegram-policy-grid"><label class="telegram-switch"><input type="checkbox" name="enabled" ${s.enabled?"checked":""}><span><b>System Telegram aktywny</b><small>Główny wyłącznik automatyki; wysyłka ręczna nadal pozostaje dostępna.</small></span></label><label><span>Tryb komunikacji</span><select name="mode"><option value="important" ${s.mode==="important"?"selected":""}>Pilne od razu + raporty</option><option value="digest" ${s.mode==="digest"?"selected":""}>Tylko raporty zbiorcze</option><option value="manual" ${s.mode==="manual"?"selected":""}>Tylko na żądanie</option></select></label>
      <label class="telegram-switch"><input type="checkbox" name="automaticCritical" ${s.automaticCritical?"checked":""}><span><b>Nowe krytyczne sprawy natychmiast</b><small>Tylko gdy zmieniło się realne zdarzenie, nie sam priorytet.</small></span></label><label class="telegram-switch"><input type="checkbox" name="onlyChanges" ${s.onlyChanges?"checked":""}><span><b>Wysyłaj tylko zmiany</b><small>Ten sam problem nie jest powtarzany.</small></span></label>
      <fieldset><legend>Zakres automatyczny</legend><label><input type="checkbox" name="customerMessages" ${s.customerMessages?"checked":""}> nowe wiadomości klientów</label><label><input type="checkbox" name="operationalAlerts" ${s.operationalAlerts?"checked":""}> zamówienia i wysyłki</label><label><input type="checkbox" name="supplierAlerts" ${s.supplierAlerts?"checked":""}> zmiany u producentów</label></fieldset><fieldset><legend>Podsumowania</legend><label><input type="checkbox" name="digestEnabled" ${s.digestEnabled?"checked":""}> włącz zaplanowane podsumowania</label><div class="telegram-time-row"><input type="time" name="digestTime1" value="${esc(times[0]||"08:00")}"><input type="time" name="digestTime2" value="${esc(times[1]||"16:00")}"></div></fieldset>
      <fieldset><legend>Cykl obsługi sprawy</legend><label><input type="checkbox" name="incidentWorkflow" ${s.incidentWorkflow?"checked":""}> przyjęcie, właściciel i zamknięcie</label><label><input type="checkbox" name="autoResolve" ${s.autoResolve?"checked":""}> automatycznie zamknij, gdy problem znika</label><label><input type="checkbox" name="slaEnabled" ${s.slaEnabled?"checked":""}> kontroluj terminy SLA</label></fieldset><fieldset><legend>SLA i eskalacja</legend><label>Krytyczne (min)<input type="number" name="criticalSlaMinutes" min="15" max="1440" value="${esc(s.criticalSlaMinutes)}"></label><label>Ostrzeżenia (min)<input type="number" name="warningSlaMinutes" min="30" max="10080" value="${esc(s.warningSlaMinutes)}"></label><label><input type="checkbox" name="escalationEnabled" ${s.escalationEnabled?"checked":""}> eskaluj po terminie</label><label>Powtórz po (min)<input type="number" name="escalationRepeatMinutes" min="30" max="10080" value="${esc(s.escalationRepeatMinutes)}"></label><label>Maks. eskalacji<input type="number" name="maxEscalations" min="1" max="5" value="${esc(s.maxEscalations)}"></label></fieldset>
      <fieldset><legend>Cisza nocna</legend><div class="telegram-time-row"><input type="time" name="quietStart" value="${esc(s.quietStart)}"><input type="time" name="quietEnd" value="${esc(s.quietEnd)}"></div><label><input type="checkbox" name="criticalDuringQuiet" ${s.criticalDuringQuiet?"checked":""}> przepuszczaj krytyczne także nocą</label></fieldset><fieldset><legend>Ochrona przed natłokiem</legend><label>Czas ochronny (min)<input type="number" name="cooldownMinutes" min="15" max="10080" value="${esc(s.cooldownMinutes)}"></label><label>Przypomnij otwartą sprawę po (h)<input type="number" name="repeatOpenHours" min="1" max="168" value="${esc(s.repeatOpenHours)}"></label><label>Maks. pozycji w raporcie<input type="number" name="maxItems" min="3" max="20" value="${esc(s.maxItems)}"></label></fieldset>
      <fieldset class="telegram-topic-settings"><legend>Tematy grupy Telegram (opcjonalnie)</legend><label><input type="checkbox" name="topicRouting" ${s.topicRouting?"checked":""}> kieruj obszary do osobnych tematów</label><label>Klienci<input type="number" name="topicCustomer" min="0" value="${esc(s.topicCustomer||0)}" placeholder="ID tematu"></label><label>Operacje<input type="number" name="topicOperations" min="0" value="${esc(s.topicOperations||0)}" placeholder="ID tematu"></label><label>Producenci<input type="number" name="topicSupplier" min="0" value="${esc(s.topicSupplier||0)}" placeholder="ID tematu"></label><small>Wpisz identyfikatory tylko wtedy, gdy grupa Telegram ma włączone tematy.</small></fieldset></div></form>
      <aside class="panel telegram-actions-panel"><div class="order-section-head"><div><span class="order-pro-label">Stan techniczny</span><h2>Jeden bot zespołu</h2></div></div><div class="telegram-connection-list"><div><span>🤖</span><b>${esc(status.bot?.name||"Bot Telegram")}</b><small>${status.bot?.username?`@${esc(status.bot.username)}`:"sprawdź połączenie API"} • jedyne konto systemowe</small></div><div><span>↔️</span><b>${status.webhook?.active?"Jeden webhook aktywny":"Webhook wymaga podłączenia"}</b><small>Oczekujące aktualizacje: ${esc(status.webhook?.pending||0)}${status.webhook?.lastError?` • ${esc(status.webhook.lastError)}`:""}</small></div><div><span>${status.target?.reachable?"🟢":"🔴"}</span><b>Kanał alertów ${status.target?.reachable?"dostępny":"niedostępny"}</b><small>${status.target?.reachable?`${esc(status.target.name||"Telegram")} • ${esc(status.target.type||"czat")}`:esc(status.target?.error||"Sprawdź kanał docelowy")}</small></div><div><span>${worker.workerOnline?"🟢":"🔴"}</span><b>Agent wykonawczy ${worker.workerOnline?"online":"offline"}</b><small>${worker.workerLastSeenAt?`Ostatni kontakt: ${esc(allegroDataTxt(worker.workerLastSeenAt))}`:"Brak potwierdzonego połączenia"} • aktywne zadania: ${esc(worker.active||0)}</small></div><div><span>🫀</span><b>Ostatni cykl wspólnego centrum</b><small>${health.lastCycleAt?esc(allegroDataTxt(health.lastCycleAt)):"jeszcze nie wykonano"}</small></div><div><span>👥</span><b>Lista dostępu</b><small>Właściciel: ${esc(allowlist.ownerBootstrap||0)} • jawnie dodane osoby: ${esc(allowlist.explicitUsers||0)} • jawne czaty: ${esc(allowlist.explicitChats||0)}. Łącznie ${esc(allowlist.chats||0)} czatów i ${esc(allowlist.users||0)} osób; ID są ukryte.</small></div><div><span>📥</span><b>Ostatni odbiór: ${esc(inboundLabel)}</b><small>${health.lastWebhookAt?esc(allegroDataTxt(health.lastWebhookAt)):"brak odebranych wiadomości"}${health.lastInboundKind?` • ${esc(health.lastInboundKind)}`:""}${health.lastRejectedAt?` • ostatnie odrzucenie ${esc(allegroDataTxt(health.lastRejectedAt))}`:""}${health.lastRejectedRef?` • ref ${esc(health.lastRejectedRef)}`:""}</small></div><div><span>🛡️</span><b>Bezpieczne uprawnienia</b><small>Przyciski zmieniają stan wewnętrzny. Klient, producent, faktura i etykieta nadal wymagają panelu.</small></div></div><div class="telegram-action-stack"><button class="btn" onclick="agentAITelegramAkcja('webhook')">↔️ ${status.webhook?.active?"Odśwież konfigurację jednego bota":"Podłącz interaktywny webhook"}</button><button class="btn ghost" onclick="agentAITelegramAkcja('report')">📊 Raport na żądanie</button><button class="btn ghost" onclick="agentAITelegramAkcja('digest')">📋 Wyślij wyłącznie nowe sprawy</button><button class="btn ghost" onclick="agentAITelegramAkcja('test')">✅ Cichy test dostarczenia</button></div></aside></div>
    <section class="panel telegram-incidents-panel"><div class="order-section-head"><div><span class="order-pro-label">Jedna kolejka odpowiedzialności</span><h2>Sprawy operacyjne (${incidents.filter(x=>x.status!=="resolved").length})</h2><p class="order-detail-lead">Zmiana statusu tutaj aktualizuje tę samą kartę na Telegramie. Nie wysyła wiadomości do klienta.</p></div></div><div class="telegram-incident-toolbar"><input id="telegramIncidentSearch" type="search" placeholder="Szukaj: obszar, nazwa, identyfikator…" oninput="agentAITelegramFiltrujSprawy()"><select id="telegramIncidentStatus" onchange="agentAITelegramFiltrujSprawy()"><option value="active">Aktywne</option><option value="open">Nowe</option><option value="acknowledged">Przyjęte</option><option value="snoozed">Odłożone</option><option value="resolved">Załatwione</option><option value="all">Wszystkie</option></select></div><div class="telegram-incident-list">${incidents.map(x=>`<article class="telegram-incident-card ${esc(x.severity)} ${incidentClass(x)} ${isOverdue(x)?"overdue":""}" data-status="${esc(x.status||"open")}" data-search="${esc(`${x.id} ${x.title} ${x.description} ${x.category}`.toLowerCase())}" ${x.status==="resolved"?"hidden":""}><header><span>${x.severity==="critical"?"🔴":"🟡"}</span><div><b>${esc(x.title||"Sprawa")}</b><small>#${esc(x.id)} • ${esc(x.category||"operacje")} • ${esc(x.count||0)} zdarzeń</small></div><span class="telegram-incident-state">${isOverdue(x)?"⏱ po SLA":esc(incidentLabel(x))}</span></header><p>${esc(x.description||"")}</p><div class="telegram-incident-meta"><span><b>Właściciel</b>${esc(x.owner?.name||"nieprzypisana")}</span><span><b>Termin SLA</b>${x.dueAt?esc(allegroDataTxt(x.dueAt)):"wyłączony"}</span><span><b>Eskalacja</b>${esc(x.escalationLevel||0)} / ${esc(s.maxEscalations||2)}</span><span><b>Ostatnia zmiana</b>${esc(allegroDataTxt(x.lastSeenAt))}</span></div><footer>${x.status==="resolved"?`<button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(x.id)},'reopen')">↩️ Przywróć</button>`:`<button class="btn" onclick="agentAITelegramIncydent(${jsArg(x.id)},'ack')">👤 Przyjmuję</button><button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(x.id)},'s1')">⏸ 1 godz.</button><button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(x.id)},'s24')">🌙 Do jutra</button><button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(x.id)},'resolve')">✅ Załatwione wewnętrznie</button>`}${x.href?`<a class="btn ghost" href="${esc(x.href)}">Otwórz źródło</a>`:""}</footer></article>`).join("")||`<div class="agent-ops-empty">✅ Nie ma obecnie spraw wymagających obsługi.</div>`}</div></section>
    <div class="telegram-operations-grid"><section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Niezawodność dostarczeń</span><h2>Kolejka ponowień</h2><p class="order-detail-lead">Nieudane automatyczne alerty są ponawiane z rosnącym odstępem, maksymalnie trzy razy.</p></div></div>${outbox.length?`<div class="warehouse-worktable-wrap"><table class="log-table"><tr><th>Stan</th><th>Sprawa</th><th>Próby</th><th>Następna próba</th><th>Błąd</th><th>Kontrola</th></tr>${outbox.map(x=>`<tr><td><span class="lvl ${x.status==="dead"?"lvl-blad":"lvl-info"}">${esc(x.status)}</span></td><td>#${esc(x.incidentId||"—")}</td><td>${esc(x.attempts||0)} / 3</td><td>${esc(allegroDataTxt(x.nextAttemptAt))}</td><td>${esc(x.lastError||"—")}</td><td><div class="diag-actions"><button class="btn ghost" onclick="agentAITelegramDostarczenie(${jsArg(x.id)},'retry')">Ponów</button>${x.status==="dead"?`<button class="btn danger" onclick="agentAITelegramDostarczenie(${jsArg(x.id)},'dismiss')">Usuń wpis</button>`:""}</div></td></tr>`).join("")}</table></div>`:`<div class="agent-ops-empty">✅ Brak niedostarczonych wiadomości.</div>`}</section><section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Wiadomość ręczna</span><h2>Notatka do zespołu</h2><p class="order-detail-lead">Wysyłana tylko po kliknięciu. Nie jest komunikatem do klienta.</p></div></div><form class="telegram-note-form" onsubmit="return agentAITelegramWyslijNotatke(event)"><textarea id="agentTelegramNote" maxlength="1500" placeholder="Np. Proszę dziś najpierw przygotować zamówienia ATM-…"></textarea><label><input id="agentTelegramNoteSilent" type="checkbox" checked> bez dźwięku</label><button class="btn telegram-btn" type="submit">✈️ Wyślij do zespołu</button></form></section></div>
    <section class="panel telegram-audit"><div class="order-section-head"><div><span class="order-pro-label">Dziennik dostarczeń i pominięć</span><h2>Historia komunikacji</h2><p class="order-detail-lead">Widać kto lub co uruchomiło wysyłkę. Zmiana ustawień nie generuje wiadomości w grupie.</p></div></div><div class="warehouse-worktable-wrap"><table class="log-table"><tr><th>Data</th><th>Kierunek</th><th>Rodzaj</th><th>Wynik</th><th>Informacja</th><th>Źródło</th></tr>${history.slice(0,50).map(x=>`<tr><td>${esc(allegroDataTxt(x.at))}</td><td>${x.direction==="in"?"⬅️ od bota":"➡️ do bota"}</td><td>${esc(x.kind||"—")}</td><td><span class="lvl ${x.status==="sent"||x.status==="handled"||x.status==="saved"?"lvl-ok":x.status==="error"?"lvl-blad":"lvl-info"}">${esc(x.status||"—")}</span></td><td><b>${esc(x.title||"—")}</b>${x.reason?`<br><small>${esc(x.reason)}</small>`:""}</td><td>${esc(x.source||"—")}</td></tr>`).join("")||`<tr><td colspan="6">Historia pojawi się po pierwszej operacji.</td></tr>`}</table></div></section>
  </section>`;
}
function agentAIHistoriaPanelHTML(){
  const archive=Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).sort((a,b)=>String(b.completedAt||b.resolvedAt||"").localeCompare(String(a.completedAt||a.resolvedAt||""))).slice(0,100),history=(agentAIHistoria||[]).slice(0,100),runs=(agentAIPlanStan.history||[]).slice(0,20);
  return `<section class="panel agent-history-page"><div class="order-section-head"><div><span class="order-pro-label">Pełna rozliczalność</span><h2>🕓 Historia Agenta</h2><p class="order-detail-lead">Aktywne zadania nie mieszają się z wykonanymi. Każde zakończenie zawiera operatora i moment wykonania.</p></div><button class="btn ghost" onclick="agentAIPobierzHistorieWykonan()">↻ Odśwież audyt serwera</button></div><div class="orders-stat-grid"><div class="order-stat-card money"><span>✅</span><b>${archive.length}</b><small>zakończonych zadań</small></div><div class="order-stat-card"><span>🧭</span><b>${runs.length}</b><small>wykonań planu</small></div><div class="order-stat-card"><span>🧾</span><b>${history.length}</b><small>operacji w rejestrze</small></div></div><details class="agent-history-section" open><summary>Zakończone zadania (${archive.length})</summary>${archive.length?`<div class="agent-task-archive-list">${archive.map(x=>`<article><span>✓</span><div><b>${esc(x.title||x.id)}</b><small>${esc(new Date(x.completedAt||x.resolvedAt).toLocaleString("pl-PL"))} • ${esc(x.completedBy||"Agent")}</small><p>${esc(x.description||"")}</p></div>${x.state==="done"?`<button class="btn ghost" onclick="agentAIPrzywrocZadanie(${jsArg(x.id)})">Przywróć</button>`:`<em>rozwiązane</em>`}</article>`).join("")}</div>`:`<div class="agent-ops-empty">Brak zakończonych zadań.</div>`}</details><details class="agent-history-section"><summary>Rejestr działań (${history.length})</summary><div class="warehouse-worktable-wrap"><table class="log-table"><tr><th>Data</th><th>Typ</th><th>Opis</th><th>Operator</th></tr>${history.map(h=>`<tr><td>${esc(h.dataTxt||"")}</td><td><span class="lvl lvl-info">${esc(h.typ||"akcja")}</span></td><td>${esc(h.opis||"")}</td><td>${esc(h.operator||"")}</td></tr>`).join("")||`<tr><td colspan="4">Brak działań.</td></tr>`}</table></div></details></section>`;
}
function widokAdminAgentAI(sekcja="pulpit"){
  allegroLadujJesliTrzeba("orders");
  const analiza=agentAIAnaliza();
  const aktywna=["pulpit","komendy","specjalisci","uprawnienia","plan","produkty","zlecenia","producenci","telegram","pamiec","historia"].includes(String(sekcja||""))?String(sekcja||""):"pulpit";
  const aktywneZadania=agentAIAnalizaAktywna(analiza),problemy=aktywneZadania.length;
  const score=Math.max(0,Math.round(100-(aktywneZadania.filter(x=>x.poziom==="bad").length*18)-(aktywneZadania.filter(x=>x.poziom==="warn").length*8)));
  const plan=potrzebyZatowarowania().slice(0,8);
  const odpowiedziAgenta=(agentAIHistoria||[]).filter(h=>h.typ==="komenda"&&h.dane&&h.dane.odpowiedz).slice(0,5);
  const linkiProducentow=agentAILinkiOczekujace();
  const komunikacja=allegroKomunikacjaStaty(),komunikacjaDoOdpowiedzi=[...(komunikacja.threads||[]),...(komunikacja.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  const aktywneWysylki=pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn),wysylkiBezNumeru=aktywneWysylki.filter(z=>!daneWysylki(z).numer).length;
  const dokumentyProducentow=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny).length;
  const runtimeAge=Date.now()-Number(agentAIRuntime.updatedAt||0);
  if(aktywna==="pulpit"&&(!agentAIRuntime.loaded||runtimeAge>15000)&&!agentAIRuntime.loading)setTimeout(()=>agentAIRuntimePobierz(true),0);
  if(aktywna==="pulpit")setTimeout(()=>agentAIRuntimePolling(),0);
  if(aktywna==="telegram"&&!agentAITelegram.loaded&&!agentAITelegram.loading)setTimeout(()=>agentAITelegramPobierz(true,true),0);
  if(["pulpit","specjalisci","uprawnienia"].includes(aktywna)&&!agentAISpecjalisci.loaded&&!agentAISpecjalisci.loading)setTimeout(()=>agentAISpecjalisciPobierz(false),0);
  if(["pulpit","specjalisci","uprawnienia"].includes(aktywna))setTimeout(()=>agentAISpecjalisciPolling(),0);
  const decyzjeAge=Date.now()-(Date.parse(agentAIDecyzjeMagazynowe.updatedAt)||0);
  if(aktywna==="komendy"&&(!agentAIDecyzjeMagazynowe.loaded||decyzjeAge>60_000)&&!agentAIDecyzjeMagazynowe.loading)setTimeout(()=>agentAIDecyzjeMagazynowePobierz(true),0);
  return adminSzkielet("/admin/agent-ai", `
  ${agentAISubnavHTML(aktywna)}
  ${agentAIPodstronaNaglowekHTML(aktywna,problemy)}
  <div class="panel ai-agent-panel" style="${aktywna==="pulpit"?"":"display:none"}">
    <div class="ai-agent-hero">
      <div>
        <span class="cat-label">Automatyczny kontroler administratora</span>
        <h1>🤖 Agent AI</h1>
        <p>Agent najpierw pilnuje funkcjonalności strony i świeżości pobranych danych, a następnie realizuje konkretne działania dla zamówień, Allegro, InPost, magazynu, producentów i faktur. Działania zewnętrzne nadal wymagają decyzji administratora.</p>
      </div>
      <div><div class="health-score">${score}%</div><button class="btn agent-report-btn" onclick="agentAIWykonaj('plan-bezpieczny')" ${agentAIPlanStan.busy?"disabled":""}>${agentAIPlanStan.busy?"⏳ Sprawdzam…":"▶ Sprawdź funkcje i pobierz dane"}</button><button class="btn telegram-btn agent-report-btn" onclick="agentAIWykonaj('raport-telegram')">✈️ Raport na Telegram</button></div>
    </div>
    <div class="orders-stat-grid">
      <div class="order-stat-card ${problemy?"hot":""}"><span>⚠️</span><b>${problemy}</b><small>zadań do sprawdzenia</small></div>
      <div class="order-stat-card"><span>📦</span><b>${pobierzZamowienia().filter(z=>z.status==="nowe").length}</b><small>nowych zamówień</small></div>
      <div class="order-stat-card"><span>🔎</span><b>${pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci).length}</b><small>potwierdzeń dostępności</small></div>
      <div class="order-stat-card"><span>🧾</span><b>${szkiceFaktur.length}</b><small>szkiców FV</small></div>
      <div class="order-stat-card"><span>📦</span><b>${potrzebyZatowarowania().length}</b><small>braki do zamówień</small></div>
      <div class="order-stat-card"><span>🟠</span><b>${aktywneZamowieniaAllegro().filter(z=>{const a=allegroAnalizaMagazynowaZamowienia(z);return a.braki>0||a.nierozpoznane>0;}).length}</b><small>zleceń Allegro z problemem</small></div>
      <div class="order-stat-card ${komunikacjaDoOdpowiedzi?"hot":""}"><span>💬</span><b>${komunikacjaDoOdpowiedzi}</b><small>spraw do odpowiedzi</small></div>
      <div class="order-stat-card ${wysylkiBezNumeru?"hot":""}"><span>🚚</span><b>${wysylkiBezNumeru}</b><small>wysyłek bez numeru</small></div>
      <div class="order-stat-card"><span>🏭</span><b>${dokumentyProducentow}</b><small>otwartych dokumentów producentów</small></div>
      <div class="order-stat-card ${linkiProducentow.length?"hot":""}"><span>🔗</span><b>${linkiProducentow.length}</b><small>linków producentów</small></div>
    </div>
    <div class="diag-actions agent-command-grid">
      <button class="btn telegram-btn" onclick="agentAIWykonaj('raport-telegram')">✈️ Wyślij pełny raport na Telegram</button>
      <button class="btn" onclick="agentAIWykonaj('plan-bezpieczny')" ${agentAIPlanStan.busy?"disabled":""}>▶ Wykonaj bezpieczny plan</button>
      <button class="btn" onclick="agentAIWykonaj('sync')">🔄 Synchronizuj bazę</button>
      <button class="btn ghost" onclick="agentAIWykonaj('utworz-zlecenie-braki')">📦 Uzgodnij Plan zatowarowania</button>
      <button class="btn ghost" onclick="agentAIWykonaj('masowe-fv')">🧾 Utwórz brakujące szkice FV</button>
      <button class="btn ghost" onclick="agentAIWykonaj('export-magazyn')">📊 Eksport magazynu</button>
      <button class="btn ghost" onclick="agentAIWykonaj('export-zakupy')">📦 Plan bez cen CSV</button>
      <button class="btn ghost" onclick="agentAIWykonaj('sprawdz-linki-producentow')">🔗 Sprawdź linki producentów</button>
      <button class="btn ghost" onclick="agentAIWykonaj('sprawdz-dostepnosc-producentow')">🏭 Wyrywkowo sprawdź stany producentów</button>
      <button class="btn ghost" onclick="agentAIWykonaj('audyt-magazynu')">✅ Audyt magazynu JSON</button>
      <a class="btn ghost" href="#/diagnostyka">🛠️ Diagnostyka</a>
    </div>
  </div>
  <div id="agentAIRuntimePanel" style="${aktywna==="pulpit"?"":"display:none"}">${agentAIRuntimePanelHTML()}</div>
  <div style="${aktywna==="pulpit"?"":"display:none"}">${agentAIInicjatywaPanelHTML()}</div>
  <div class="panel agent-site-map" style="${aktywna==="pulpit"?"":"display:none"}"><div class="order-section-head"><div><span class="order-pro-label">Kontekst całej strony</span><h2>🧩 Obszary pracy Agenta</h2><p class="order-detail-lead">Każdy raport i polecenie korzysta z tych samych danych oraz kieruje do właściwej podstrony.</p></div></div><div class="agent-site-grid">${[["📦","Zamówienia",pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).length,"#/admin/zamowienia","pokaż zamówienia"],["💬","Komunikacja",komunikacjaDoOdpowiedzi,"#/admin/allegro/wiadomosci","pokaż komunikację z klientami"],["🚚","InPost",wysylkiBezNumeru,"#/admin/wysylki","sprawdź wysyłki"],["🟠","Allegro",aktywneZamowieniaAllegro().length,"#/admin/allegro","sprawdź Allegro"],["🏬","Magazyn",potrzebyZatowarowania().length,"#/admin/magazyn/stany","pokaż stan magazynu"],["🏷️","Produkty",allegroAktywneZadaniaAgentaOfert().length,"#/admin/asortyment/produkty","audyt produktów"],["🏭","Producenci",dokumentyProducentow,"#/admin/agent-ai/producenci","status producentów"],["🛠️","Integracje",stanBramki.email?.configured&&stanBramki.inpost?.configured?0:1,"#/diagnostyka","diagnostyka integracji"]].map(([ico,name,count,href,command])=>`<article><span>${ico}</span><div><b>${name}</b><small>${count?`${count} tematów aktywnych`:"bez pilnych tematów"}</small></div><a class="btn ghost" href="${href}">Otwórz</a><button class="btn ghost" onclick="location.hash='#/admin/agent-ai/komendy';setTimeout(()=>agentAIWstawKomende(${jsArg(command)}),60)">Zapytaj</button></article>`).join("")}</div></div>
  <div class="panel agent-command-panel" style="${aktywna==="komendy"?"":"display:none"}">
    <div class="order-section-head">
      <div>
        <h2 style="margin-top:0">💬 Polecenie dla agenta</h2>
        <p class="order-detail-lead">Pisz normalnie po polsku. Przy zmianie stanu Agent zawsze najpierw pyta o lokalizację, a zapis wykonuje dopiero po osobnym potwierdzeniu konkretnej decyzji.</p>
      </div>
      <span id="agentAICommandCloudState" class="lvl ${chmuraStan.dostepna?"lvl-ok":"lvl-info"}">${chmuraStan.dostepna?`chmura • rewizja ${chmuraStan.rev||0}`:"łączenie z chmurą"}</span>
    </div>
    <form class="agent-command-form" onsubmit="return agentAIPrzyjmijKomende(event)">
      <textarea id="agentAICommandInput" rows="3" placeholder="Np. mam obecnie na stanie Ziemniaka 1410 8 szt…"></textarea>
      <div class="agent-command-actions">
        <button class="btn" type="submit">🤖 Wykonaj polecenie</button>
        <button class="btn" type="button" onclick="agentAIWstawKomende('wykonaj bezpieczny plan agenta')">Wykonaj plan</button>
        <button class="btn telegram-btn" type="button" onclick="agentAIWstawKomende('wyślij raport na Telegram')">Raport Telegram</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż centrum operacyjne')">Centrum operacyjne</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż komunikację z klientami')">Komunikacja</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('sprawdź wysyłki i InPost')">Wysyłki</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('audyt produktów i katalogu')">Produkty</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('status producentów')">Producenci</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('diagnostyka integracji')">Integracje</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('sprawdź czy wpadło nowe zlecenie')">Nowe zlecenia</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('przygotuj zamówienie do producenta')">Zamówienie do producenta</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('czego brakuje do zamówień')">Braki</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż stan magazynu')">Magazyn</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('zapamiętaj: ')">Naucz agenta</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż pamięć')">Pamięć</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż lokalizacje')">Lokalizacje</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('sprawdź linki producentów')">Linki producentów</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('popraw opisy produktów')">Opisy produktów</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('synchronizuj bazę')">Synchronizacja</button>
      </div>
    </form>
    <div class="agent-command-hints">„Mam na stanie 8 szt.” ustawia dokładnie 8, a „przyjmij/dodaj 8 szt.” zwiększa stan o 8. Sama wiadomość niczego nie zapisuje — najpierw wybierasz lokalizację, potem osobno potwierdzasz albo odrzucasz każdą zmianę. Niepotwierdzone decyzje są grupowane w przypomnieniu około 16:00.</div>
    <div id="agentAICommandLiveResult" class="agent-response-card agent-command-live-result" hidden></div>
    <div id="agentInventoryDecisionPanel">${agentAIDecyzjeMagazynowePanelHTML()}</div>
    ${odpowiedziAgenta.length?`<div class="agent-response-list">
      ${odpowiedziAgenta.map(h=>`<div class="agent-response-card">
        <div class="agent-response-head"><b>${esc(h.dane.polecenie||"Polecenie")}</b><small>${esc(h.dataTxt||"")}</small></div>
        <pre class="agent-answer-pre">${esc(h.dane.odpowiedz||"")}</pre>
      </div>`).join("")}
    </div>`:`<p class="order-detail-lead" style="margin-bottom:0">Brak zapisanych poleceń z panelu. Wpisz pierwsze polecenie powyżej.</p>`}
  </div>
  <div style="${aktywna==="pamiec"?"":"display:none"}">${agentAIPamiecPanelHTML()}</div>
  <div style="${aktywna==="specjalisci"?"":"display:none"}">${agentAISpecjalisciPanelHTML()}</div>
  <div style="${aktywna==="uprawnienia"?"":"display:none"}">${agentAIUprawnieniaPanelHTML()}</div>
  <div style="${aktywna==="produkty"?"":"display:none"}">${agentAIProduktyWdrozeniePanelHTML()}</div>
  <div style="${["komendy","plan"].includes(aktywna)?"":"display:none"}">${agentAILinkiProducentowPanelHTML()}</div>
  <div style="${aktywna==="plan"?"":"display:none"}">${agentAIPlanOperacyjnyHTML(analiza)}${agentAICentrumDecyzjiHTML()}
  ${plan.length?`<div class="panel">
    <div class="order-section-head"><div><h2 style="margin-top:0">📦 Braki do aktywnych zamówień</h2><p class="order-detail-lead">Agent pokazuje tylko produkty, których rezerwacje z aktywnych zamówień są większe niż fizyczny stan magazynowy.</p></div><button class="btn" onclick="agentAIWykonaj('export-zakupy')">Pobierz pełny plan</button></div>
    <div class="ai-restock-grid">${plan.map(x=>`<div class="ai-restock-card ${x.poziom}">
      <b>${esc(x.produkt.nazwa)}</b>
      <small>${esc(x.produkt.sku||"ID "+x.produkt.id)} • ${esc(x.meta.dostawca||"brak dostawcy")}</small>
      <div class="ai-restock-line"><span>Dostępne</span><b>${x.dostepne===null?"∞":esc(x.dostepne)}</b></div>
      <div class="ai-restock-line"><span>Sprzedaż 30 dni</span><b>${esc(x.sprzedaz30)}</b></div>
      <div class="ai-restock-line"><span>Zamówić</span><b>${esc(x.ilosc)} szt.</b></div>
      <p>${esc(x.powod)}</p>
    </div>`).join("")}</div>
  </div>`:""}</div>
  <div style="${aktywna==="producenci"?"":"display:none"}">${producenciKartotekaPanelHTML()}</div>
  <div style="${aktywna==="telegram"?"":"display:none"}">${agentAITelegramPanelHTML()}</div>
  <div style="${aktywna==="historia"?"":"display:none"}">${agentAIHistoriaPanelHTML()}</div>`);
}
let filtrZamowien = "wszystkie", szukajZamowien = "";

/* Centrum rozmów Telegram — warstwa prezentacji nad jednym botem i jednym rejestrem. */
function agentAITelegramUstawPolecenie(text=""){
  const input=$("telegramAgentCommand");
  if(!input)return;
  input.value=String(text||"");
  input.focus();
  input.scrollIntoView({block:"center",behavior:"smooth"});
}

async function agentAITelegramWykonajPolecenie(event){
  event?.preventDefault();
  const input=$("telegramAgentCommand"),button=$("telegramAgentCommandSubmit"),result=$("agentAICommandLiveResult");
  const command=String(input?.value||"").trim();
  if(command.length<3){toast("Wpisz polecenie dla Agenta");return false;}
  if(button){button.disabled=true;button.textContent="⏳ Agent pracuje…";}
  try{
    const response=await agentAIOdpowiedzPrzezCodex(command);
    if(result){result.hidden=false;result.className="agent-response-card agent-command-live-result success";result.innerHTML=`<div class="agent-response-head"><b>✅ Agent zakończył zadanie</b><small>wynik pozostaje w panelu</small></div><pre class="agent-answer-pre">${esc(response)}</pre><div class="telegram-command-result-actions"><button class="btn telegram-btn" type="button" onclick="agentAITelegramWyslijWynikDoGrupy()">✈️ Wyślij ten wynik do grupy</button></div>`;}
    toast("✅ Agent zakończył polecenie");
  }catch(error){
    if(result){result.hidden=false;result.className="agent-response-card agent-command-live-result error";result.innerHTML=`<div class="agent-response-head"><b>⚠️ Nie wykonano polecenia</b></div><pre class="agent-answer-pre">${esc(error?.message||error)}</pre>`;}
    toast(`⚠️ Agent: ${error?.message||error}`);
  }finally{if(button){button.disabled=false;button.textContent="Wykonaj bezpiecznie";}}
  return false;
}

async function agentAITelegramWyslijWynikDoGrupy(){
  const value=String($("agentAICommandLiveResult")?.querySelector(".agent-answer-pre")?.textContent||"").trim();
  if(!value){toast("Najpierw wykonaj polecenie");return;}
  try{
    await chmura("telegram-send-note",{method:"POST",body:{text:`Wynik Agenta:\n${value}`,silent:true},timeout:30000});
    toast("✅ Wynik wysłano do głównej grupy");
    await agentAITelegramPobierz(false,true);
  }catch(error){toast(`⚠️ Telegram: ${error?.message||error}`);}
}

function agentAITelegramFiltrujRozmowy(){
  const q=String($("telegramConversationSearch")?.value||"").toLowerCase().trim();
  const direction=String($("telegramConversationDirection")?.value||"all");
  const status=String($("telegramConversationStatus")?.value||"all");
  const kind=String($("telegramConversationKind")?.value||"all");
  let visible=0;
  document.querySelectorAll(".telegram-message-card").forEach(card=>{
    const matches=(!q||String(card.dataset.search||"").includes(q))&&(direction==="all"||card.dataset.direction===direction)&&(status==="all"||card.dataset.status===status)&&(kind==="all"||card.dataset.kind===kind);
    card.hidden=!matches;if(matches)visible+=1;
  });
  const counter=$("telegramConversationVisible");if(counter)counter.textContent=String(visible);
}

function agentAITelegramMessageHTML(item={},groupName="Główna grupa Telegram"){
  const incoming=item.direction==="in",status=String(item.status||"saved"),kind=String(item.kind||"message");
  const from=item.fromLabel||(incoming?"Zespół Telegram":"Agent Artway-TM"),to=item.toLabel||(incoming?"Agent Artway-TM":groupName);
  const body=String(item.preview||item.title||"Zdarzenie komunikacji").trim(),reason=String(item.reason||"").trim();
  const searchable=`${from} ${to} ${body} ${reason} ${kind} ${status} ${item.source||""}`.toLowerCase();
  const stateLabel={sent:"dostarczono",accepted:"przyjęto",deferred:"Agent analizuje",handled:"obsłużono",saved:"zapisano",resolved:"załatwiono",error:"błąd",rejected:"odrzucono"}[status]||status;
  return `<article class="telegram-message-card ${incoming?"incoming":"outgoing"} status-${esc(status)}" data-direction="${incoming?"in":"out"}" data-status="${esc(status)}" data-kind="${esc(kind)}" data-search="${esc(searchable)}"><div class="telegram-message-avatar">${incoming?"👤":kind==="supplier-preview"?"🏭":kind==="agent-reply"?"✦":"🤖"}</div><div class="telegram-message-bubble"><header><div><b>${esc(from)}</b><span>→ ${esc(to)}</span></div><time>${esc(allegroDataTxt(item.at))}</time></header><p>${esc(body)}</p>${reason?`<small class="telegram-message-reason">${esc(reason)}</small>`:""}<footer><span class="telegram-message-status">${status==="error"?"⚠️":status==="sent"?"✓✓":"✓"} ${esc(stateLabel)}</span><span>${esc(kind)}</span>${item.threadId?`<span>wątek ${esc(item.threadId)}</span>`:""}${item.messageId?`<span>wiadomość ${esc(item.messageId)}</span>`:""}<span>${esc(item.source||"system")}</span></footer></div></article>`;
}

function agentAITelegramSettingsHTML(s={},t={}){
  const times=s.digestTimes||["08:00","16:00"];
  return `<details class="panel telegram-settings-drawer"><summary><span>⚙️</span><div><b>Automatyzacja, SLA i dostęp</b><small>Ustawienia techniczne są na końcu i nie mieszają się z codzienną rozmową.</small></div><em>Rozwiń</em></summary><form onsubmit="return agentAITelegramZapisz(event)"><div class="telegram-settings-grid"><fieldset><legend>Główne zasady</legend><label><input type="checkbox" name="enabled" ${s.enabled!==false?"checked":""}> system aktywny</label><label>Tryb<select name="mode"><option value="important" ${s.mode==="important"?"selected":""}>Pilne + raporty</option><option value="digest" ${s.mode==="digest"?"selected":""}>Raporty zbiorcze</option><option value="manual" ${s.mode==="manual"?"selected":""}>Tylko ręcznie</option></select></label><label><input type="checkbox" name="automaticCritical" ${s.automaticCritical!==false?"checked":""}> pilne od razu</label><label><input type="checkbox" name="onlyChanges" ${s.onlyChanges!==false?"checked":""}> tylko realne zmiany</label></fieldset><fieldset><legend>Zakres</legend><label><input type="checkbox" name="customerMessages" ${s.customerMessages!==false?"checked":""}> klienci</label><label><input type="checkbox" name="operationalAlerts" ${s.operationalAlerts!==false?"checked":""}> zamówienia i wysyłki</label><label><input type="checkbox" name="supplierAlerts" ${s.supplierAlerts?"checked":""}> producenci</label><label>Maks. pozycji<input type="number" name="maxItems" min="3" max="20" value="${esc(s.maxItems||8)}"></label></fieldset><fieldset><legend>Raporty i cisza</legend><label><input type="checkbox" name="digestEnabled" ${s.digestEnabled?"checked":""}> raporty planowane</label><div class="telegram-time-row"><input type="time" name="digestTime1" value="${esc(times[0]||"08:00")}"><input type="time" name="digestTime2" value="${esc(times[1]||"16:00")}"></div><div class="telegram-time-row"><input type="time" name="quietStart" value="${esc(s.quietStart||"21:00")}"><input type="time" name="quietEnd" value="${esc(s.quietEnd||"07:00")}"></div><label><input type="checkbox" name="criticalDuringQuiet" ${s.criticalDuringQuiet?"checked":""}> pilne także w ciszy</label></fieldset><fieldset><legend>Sprawy i SLA</legend><label><input type="checkbox" name="incidentWorkflow" ${s.incidentWorkflow!==false?"checked":""}> właściciel i zamknięcie</label><label><input type="checkbox" name="autoResolve" ${s.autoResolve!==false?"checked":""}> zamykaj po usunięciu przyczyny</label><label><input type="checkbox" name="slaEnabled" ${s.slaEnabled!==false?"checked":""}> kontroluj SLA</label><label>Krytyczne (min)<input type="number" name="criticalSlaMinutes" min="15" max="1440" value="${esc(s.criticalSlaMinutes||60)}"></label><label>Ostrzeżenia (min)<input type="number" name="warningSlaMinutes" min="30" max="10080" value="${esc(s.warningSlaMinutes||240)}"></label></fieldset><fieldset><legend>Eskalacje</legend><label><input type="checkbox" name="escalationEnabled" ${s.escalationEnabled!==false?"checked":""}> eskaluj po terminie</label><label>Powtórz po (min)<input type="number" name="escalationRepeatMinutes" min="30" max="10080" value="${esc(s.escalationRepeatMinutes||120)}"></label><label>Maksymalnie<input type="number" name="maxEscalations" min="1" max="5" value="${esc(s.maxEscalations||2)}"></label><label>Ochrona (min)<input type="number" name="cooldownMinutes" min="15" max="10080" value="${esc(s.cooldownMinutes||720)}"></label><label>Przypomnij po (h)<input type="number" name="repeatOpenHours" min="1" max="168" value="${esc(s.repeatOpenHours||24)}"></label></fieldset><fieldset><legend>Tematy jednej grupy</legend><label><input type="checkbox" name="topicRouting" ${s.topicRouting?"checked":""}> używaj tematów</label><label>Klienci<input type="number" name="topicCustomer" min="0" value="${esc(s.topicCustomer||0)}"></label><label>Operacje<input type="number" name="topicOperations" min="0" value="${esc(s.topicOperations||0)}"></label><label>Producenci<input type="number" name="topicSupplier" min="0" value="${esc(s.topicSupplier||0)}"></label></fieldset></div><footer><button class="btn" type="submit" ${t.saving?"disabled":""}>${t.saving?"⏳ Zapisuję…":"💾 Zapisz ustawienia"}</button><button class="btn ghost" type="button" onclick="agentAITelegramAkcja('webhook')">↔️ Odśwież jeden webhook</button><button class="btn ghost" type="button" onclick="agentAITelegramAkcja('test')">Test dostarczenia</button></footer></form></details>`;
}

function agentAITelegramPanelHTML(){
  const t=agentAITelegram,s=t.settings||{},status=t.status||{},worker=t.agentWorker||{},stats=t.stats||{},health=t.state?.health||{},dashboard=t.state?.dashboard||{};
  const incidents=Array.isArray(t.incidents)?t.incidents:[],history=Array.isArray(t.history)?t.history:[],outbox=Array.isArray(t.outbox)?t.outbox:[];
  const groupName=status.target?.name||"Główna grupa Telegram",incoming=history.filter(x=>x.direction==="in").length,outgoing=history.filter(x=>x.direction!=="in").length,errors=history.filter(x=>x.status==="error").length;
  const kinds=[...new Set(history.map(x=>String(x.kind||"message")))].sort((a,b)=>a.localeCompare(b,"pl"));
  const privacyBlocked=!!status.bot&&status.bot.can_read_all_group_messages===false;
  const incidentLabel=x=>x.status==="resolved"?"załatwiona":x.status==="snoozed"?"odłożona":x.status==="acknowledged"?"przyjęta":"nowa";
  const isOverdue=x=>["open","acknowledged"].includes(x.status)&&x.dueAt&&Date.parse(x.dueAt)<=Date.now();
  return `<section class="telegram-center-page telegram-communications-hub"><section class="panel telegram-hub-hero"><div><span class="order-pro-label">Jedna grupa • jeden bot • jeden Agent Codex</span><h2>✈️ Centrum komunikacji zespołu</h2><p>Pełna rozmowa, polecenia, alerty, zamówienia producentów i potwierdzenia są w jednym miejscu. Nic nie jest automatycznie wysyłane do klienta ani producenta.</p><div class="telegram-hub-health"><span class="${status.webhook?.active?"ok":"bad"}">${status.webhook?.active?"● webhook online":"● webhook wymaga kontroli"}</span><span class="${worker.workerOnline?"ok":"bad"}">${worker.workerOnline?"● Agent Codex online":"● Agent Codex offline"}</span><span class="${status.target?.reachable?"ok":"bad"}">● ${esc(groupName)}</span></div></div><div class="telegram-hub-actions"><button class="btn ghost" onclick="agentAITelegramPobierz(true)">${t.loading?"⏳ Sprawdzam…":"↻ Odśwież centrum"}</button><button class="btn telegram-btn" onclick="agentAITelegramAkcja('dashboard')">📡 ${dashboard.messageId?"Aktualizuj pulpit":"Utwórz pulpit grupy"}</button></div></section>
  ${privacyBlocked?`<div class="backend-note warn"><b>⚠️ Zwykłe zdania w grupie są blokowane przez Privacy Mode.</b><p>W @BotFather wybierz /setprivacy → @${esc(status.bot?.username||"magazyn_artway_bot")} → Disable. Komendy nadal działają.</p></div>`:""}
  <div class="orders-stat-grid telegram-hub-kpis"><div class="order-stat-card"><span>💬</span><b>${history.length}</b><small>zapisów rozmowy</small></div><div class="order-stat-card"><span>⬅️</span><b>${incoming}</b><small>odebranych</small></div><div class="order-stat-card money"><span>➡️</span><b>${outgoing}</b><small>wysłanych</small></div><div class="order-stat-card ${stats.new?"hot":""}"><span>🔔</span><b>${esc(stats.new||0)}</b><small>nowych spraw</small></div><div class="order-stat-card ${errors?"hot":"money"}"><span>${errors?"⚠️":"✅"}</span><b>${errors}</b><small>błędów dostarczenia</small></div></div>
  <section class="panel telegram-agent-command"><div class="order-section-head"><div><span class="order-pro-label">Normalny język • wykonanie przez Codex</span><h2>Polecenie dla Agenta</h2><p class="order-detail-lead">Napisz dokładnie, co ma sprawdzić lub przygotować. Działania zewnętrzne nadal wymagają Twojego zatwierdzenia.</p></div><span class="lvl ${worker.workerOnline?"lvl-ok":"lvl-blad"}">${worker.workerOnline?"Agent gotowy":"Agent offline"}</span></div><div class="telegram-command-presets">${["Czy są nowe zamówienia i co wymaga obsługi?","Sprawdź braki do aktywnych zamówień","Przygotuj zamówienie do producenta","Sprawdź wiadomości klientów wymagające odpowiedzi","Pokaż wysyłki bez numeru nadania","Przygotuj krótki raport najważniejszych spraw"].map(value=>`<button type="button" onclick="agentAITelegramUstawPolecenie(${jsArg(value)})">${esc(value)}</button>`).join("")}</div><form onsubmit="return agentAITelegramWykonajPolecenie(event)"><textarea id="telegramAgentCommand" maxlength="2000" placeholder="Np. sprawdź nowe zlecenia, magazyn i przygotuj zamówienie do Alexandra…"></textarea><button id="telegramAgentCommandSubmit" class="btn" type="submit">Wykonaj bezpiecznie</button></form><div id="agentAICommandLiveResult" hidden></div></section>
  <section class="panel telegram-conversation-center"><div class="order-section-head"><div><span class="order-pro-label">Pełny rejestr od → do</span><h2>Rozmowa grupy „${esc(groupName)}”</h2><p class="order-detail-lead">Wiadomości zespołu, odpowiedzi Agenta i alerty automatyczne są uporządkowane w jednej osi czasu.</p></div><span><b id="telegramConversationVisible">${history.length}</b> widocznych</span></div><div class="telegram-conversation-filters"><input id="telegramConversationSearch" type="search" placeholder="Szukaj w treści, nadawcy, odbiorcy…" oninput="agentAITelegramFiltrujRozmowy()"><select id="telegramConversationDirection" onchange="agentAITelegramFiltrujRozmowy()"><option value="all">Wszystkie kierunki</option><option value="in">Odebrane</option><option value="out">Wysłane</option></select><select id="telegramConversationStatus" onchange="agentAITelegramFiltrujRozmowy()"><option value="all">Każdy wynik</option><option value="sent">Dostarczone</option><option value="deferred">Agent analizuje</option><option value="accepted">Przyjęte</option><option value="error">Błędy</option></select><select id="telegramConversationKind" onchange="agentAITelegramFiltrujRozmowy()"><option value="all">Każdy rodzaj</option>${kinds.map(kind=>`<option value="${esc(kind)}">${esc(kind)}</option>`).join("")}</select></div><div class="telegram-message-stream">${history.map(item=>agentAITelegramMessageHTML(item,groupName)).join("")||`<div class="agent-ops-empty">Pierwsza odebrana lub wysłana wiadomość pojawi się tutaj.</div>`}</div></section>
  <div class="telegram-hub-columns"><section class="panel telegram-incidents-panel"><div class="order-section-head"><div><span class="order-pro-label">Jedna kolejka odpowiedzialności</span><h2>Sprawy operacyjne</h2><p class="order-detail-lead">Status wewnętrzny aktualizuje tę samą kartę Telegram.</p></div><b>${incidents.filter(x=>x.status!=="resolved").length}</b></div><div class="telegram-incident-toolbar"><input id="telegramIncidentSearch" type="search" placeholder="Szukaj sprawy…" oninput="agentAITelegramFiltrujSprawy()"><select id="telegramIncidentStatus" onchange="agentAITelegramFiltrujSprawy()"><option value="active">Aktywne</option><option value="open">Nowe</option><option value="acknowledged">Przyjęte</option><option value="snoozed">Odłożone</option><option value="resolved">Załatwione</option><option value="all">Wszystkie</option></select></div><div class="telegram-incident-list">${incidents.map(x=>`<article class="telegram-incident-card ${esc(x.severity)} ${esc(x.status||"open")}" data-status="${esc(x.status||"open")}" data-search="${esc(`${x.id} ${x.title} ${x.description} ${x.category}`.toLowerCase())}" ${x.status==="resolved"?"hidden":""}><header><span>${x.severity==="critical"?"🔴":"🟡"}</span><div><b>${esc(x.title||"Sprawa")}</b><small>${esc(x.category||"operacje")} • ${esc(x.count||1)} zdarzeń</small></div><em>${isOverdue(x)?"po SLA":incidentLabel(x)}</em></header><p>${esc(x.description||"")}</p><footer>${x.status==="resolved"?`<button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(x.id)},'reopen')">Przywróć</button>`:`<button class="btn" onclick="agentAITelegramIncydent(${jsArg(x.id)},'ack')">Przyjmuję</button><button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(x.id)},'s24')">Do jutra</button><button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(x.id)},'resolve')">Załatwione</button>`}</footer></article>`).join("")||`<div class="agent-ops-empty">✅ Brak spraw wymagających obsługi.</div>`}</div></section><section class="panel telegram-team-note"><div class="order-section-head"><div><span class="order-pro-label">Wiadomość do jednej grupy</span><h2>Notatka dla zespołu</h2><p class="order-detail-lead">Wysyłana dopiero po kliknięciu.</p></div></div><form class="telegram-note-form" onsubmit="return agentAITelegramWyslijNotatke(event)"><textarea id="agentTelegramNote" maxlength="1500" placeholder="Np. proszę najpierw przygotować zamówienia ATM-…"></textarea><label><input id="agentTelegramNoteSilent" type="checkbox" checked> bez dźwięku</label><button class="btn telegram-btn" type="submit">✈️ Wyślij do ${esc(groupName)}</button></form><div class="telegram-delivery-summary"><b>Kolejka dostarczeń</b><span>${outbox.length?`${outbox.length} wpisów wymaga kontroli`:"✅ Wszystko dostarczone"}</span>${outbox.slice(0,5).map(x=>`<article><span>${esc(x.status)}</span><small>${esc(x.lastError||x.incidentId||"")}</small><button class="btn ghost" onclick="agentAITelegramDostarczenie(${jsArg(x.id)},'retry')">Ponów</button></article>`).join("")}</div><div class="telegram-quick-actions"><button class="btn ghost" onclick="agentAITelegramAkcja('report')">📊 Pełny raport</button><button class="btn ghost" onclick="agentAITelegramAkcja('digest')">📋 Tylko nowe sprawy</button></div></section></div>
  ${agentAITelegramSettingsHTML(s,t)}</section>`;
}

/* Agent AI — centrum obserwowalności, decyzji i komunikacji zespołu */
function agentAIDecyzjaRyzyko(item={}){
  return {high:["Wymaga decyzji","critical"],medium:["Sprawdź przed wykonaniem","warning"],low:["Niskie ryzyko","safe"]}[item.risk]||["Sprawdź","warning"];
}
function agentAIDecyzjaCel(item={}){
  const target=item.target||{};
  return target.name||target.communicationId||target.orderId||target.offerId||target.productId||item.specialist||"sprawa operacyjna";
}
function agentAIDecyzjaSkutek(item={},run=null){
  const product=item.target?.type==="product"&&item.runId,communication=item.kind==="customer_reply"||item.target?.type==="communication";
  if(product)return "Zapisane zostaną wyłącznie zaznaczone pola tego produktu. Zatwierdzenie nie wystawi oferty, nie zmieni ceny ani stanu i nie wyśle żadnej wiadomości.";
  if(communication)return "Zatwierdzenie zamknie wewnętrzną decyzję Agenta, ale nie wyśle wiadomości. Aby odpowiedzieć klientowi, przejdź do wskazanego modułu, sprawdź rozmowę i użyj osobnego przycisku wysyłki.";
  if(run)return "Zatwierdzenie zapisze wyłącznie wewnętrzną decyzję. Żadna operacja zewnętrzna nie zostanie wykonana.";
  return "Ta karta jest ostrzeżeniem i nie zawiera operacji do automatycznego wykonania. Akceptacja tylko zamknie ją jako przyjętą do wiadomości; poprawę wykonujesz we wskazanym module.";
}
function agentAIDecyzjaSzkicHTML(item={},run=null){
  const result=run?.result||{},fields=Array.isArray(result.fields)?result.fields:[],product=item.target?.type==="product"&&item.runId,content=String(result.content||"").trim(),facts=Array.isArray(result.factsUsed)?result.factsUsed:[],warnings=[...(result.warnings||[]),...(result.missingFacts||[]).map(value=>`Brak faktu: ${value}`)],target=item.target||{};
  const targetRows=[["Produkt",target.name],["ID produktu",target.productId],["Zamówienie",target.orderId],["Oferta Allegro",target.offerId],["Rozmowa",target.communicationId]].filter(([,value])=>value);
  const fieldHtml=fields.length?`<div class="agent-decision-draft-fields">${fields.map(field=>`<label class="agent-decision-draft-field">${product?`<input type="checkbox" data-agent-decision-field="${esc(item.id)}" value="${esc(field.key)}" checked>`:""}<span><small>${esc(field.label||field.key)}</small><div class="agent-decision-compare"><section><em>PRZED</em><pre>${esc(field.currentValue||"(pole puste)")}</pre></section><section><em>PO ZATWIERDZENIU</em><pre>${esc(field.value||"(brak propozycji)")}</pre></section></div>${field.reason?`<p><b>Dlaczego:</b> ${esc(field.reason)}</p>`:""}${field.evidence?`<p><b>Podstawa:</b> ${esc(field.evidence)}</p>`:""}</span></label>`).join("")}</div>`:"";
  const fallback=!fields.length&&content?`<div class="agent-decision-full-draft"><small>PEŁNY SZKIC</small><pre>${esc(content)}</pre></div>`:"";
  return `<section class="agent-decision-approval-scope"><header><div><small>CO DOKŁADNIE ZATWIERDZASZ</small><h4>${fields.length?`${esc(fields.length)} konkretne ${fields.length===1?"zmianę":"zmiany"}`:run?"Szkic do weryfikacji":"Brak szkicu wykonawczego"}</h4></div><span>${product?"zapis lokalny":item.kind==="customer_reply"?"bez wysyłki":"decyzja wewnętrzna"}</span></header><div class="agent-decision-impact"><b>Skutek zatwierdzenia</b><p>${esc(agentAIDecyzjaSkutek(item,run))}</p></div>${targetRows.length?`<div class="agent-decision-target">${targetRows.map(([label,value])=>`<span><small>${esc(label)}</small><b>${esc(value)}</b></span>`).join("")}</div>`:""}${fieldHtml}${fallback}${!fields.length&&!content?`<div class="agent-decision-no-draft"><b>Nie ma treści, którą można tu zatwierdzić.</b><span>Najpierw otwórz właściwy moduł i uzupełnij brakujące dane. Ta karta nie wykona żadnej zmiany w produkcie, zamówieniu ani Allegro.</span></div>`:""}${facts.length?`<details><summary>Fakty użyte przez Agenta (${facts.length})</summary><ul>${facts.map(value=>`<li>${esc(value)}</li>`).join("")}</ul></details>`:""}${warnings.length?`<div class="agent-specialist-warnings">${warnings.map(value=>`<span>⚠️ ${esc(value)}</span>`).join("")}</div>`:""}</section>`;
}
async function agentAISpecjalistaDecyzja(id,decisionAction,days=1){
  const key=String(id);if(agentAISpecjalistaDecyzjeWToku.has(key))return;
  const data=agentAISpecjalisci.data||{},before=Array.isArray(data.decisions)?data.decisions:[],item=before.find(entry=>String(entry.id)===key),fieldKeys=[...document.querySelectorAll("[data-agent-decision-field]")].filter(input=>input.dataset.agentDecisionField===key&&input.checked).map(input=>input.value),product=!!(item?.target?.type==="product"&&item?.runId);
  if(decisionAction==="approve"&&product&&!fieldKeys.length){toast("Wybierz co najmniej jedną poprawkę");return;}
  agentAISpecjalistaDecyzjeWToku.add(key);
  agentAISpecjalisci={...agentAISpecjalisci,data:{...data,decisions:before.filter(entry=>String(entry.id)!==key),decisionStats:{...(data.decisionStats||{}),open:Math.max(0,Number(data.decisionStats?.open||before.length)-1)}}};renderuj();
  try{
    const response=await chmura("agent-specialist-decision",{method:"POST",body:{id,decisionAction,days,fieldKeys},timeout:60000}),applied=Object.keys(response.decision?.executionResult?.patch||{}).length;
    if(decisionAction==="approve"&&product)await chmuraWczytajStan().catch(()=>{});
    toast(decisionAction==="approve"?(product?`✅ Wykonano i zapisano ${applied} ${applied===1?"zmianę":"zmiany"}`:"✅ Decyzja zaakceptowana"):decisionAction==="snooze"?`⏰ Odłożono na ${days} ${days===1?"dzień":"dni"}`:decisionAction==="dismiss"?"✅ Zamknięto bez wykonania":"✅ Sprawa zamknięta");
    await agentAISpecjalisciPobierz(true);
  }catch(error){
    agentAISpecjalisci={...agentAISpecjalisci,data:{...(agentAISpecjalisci.data||data),decisions:before}};
    toast(`⚠️ Decyzja nie została zapisana: ${error?.message||error}`);
  }finally{agentAISpecjalistaDecyzjeWToku.delete(key);renderuj();}
}
function agentAISpecjalistaDecyzjaHTML(item={}){
  const [riskLabel,riskClass]=agentAIDecyzjaRyzyko(item),product=item.target?.type==="product"&&item.runId,communication=item.kind==="customer_reply"||item.target?.type==="communication",busy=agentAISpecjalistaDecyzjeWToku.has(String(item.id)),run=(agentAISpecjalisci.data?.history||[]).find(entry=>String(entry.id)===String(item.runId));
  return `<article class="agent-decision-ticket ${riskClass} ${item.executionStatus==="failed"?"failed":""}">
    <header><span class="agent-decision-icon">${esc(item.icon||"◉")}</span><div><small>${esc(item.specialist||"Agent operacyjny")} • ${esc(agentAIRuntimeCzas(item.createdAt))}</small><h3>${esc(item.title||"Decyzja Agenta")}</h3><em>${esc(agentAIDecyzjaCel(item))}</em></div><span class="agent-decision-risk">${esc(riskLabel)}</span></header>
    <div class="agent-decision-body"><p>${esc(item.summary||"")}</p><section><small>REKOMENDOWANE DZIAŁANIE</small><b>${esc(item.recommendation||"Sprawdź dane i wybierz dalsze działanie.")}</b></section>${item.lastError?`<div class="agent-decision-error"><b>${esc(item.lastErrorCode||"Nie wykonano")}</b><span>${esc(item.lastError)}</span></div>`:""}</div>
    ${agentAIDecyzjaSzkicHTML(item,run)}
    ${product?`<details class="agent-decision-correction"><summary>Poproś Agenta o inną wersję</summary><div><textarea data-agent-feedback="${esc(item.id)}" rows="3" placeholder="Napisz konkretnie, co ma zmienić…">${esc(item.feedbackNote||"")}</textarea><button class="btn ghost" onclick="agentAISpecjalistaPoprawDecyzje(${jsArg(item.id)})" ${busy?"disabled":""}>Przygotuj korektę</button></div></details>`:""}
    <footer><div>${item.href?`<a class="btn ghost" href="${esc(item.href)}">${communication?"Otwórz rozmowę i wyślij":"Otwórz właściwy moduł"}</a>`:""}</div><div><button class="btn ghost" onclick="agentAISpecjalistaDecyzja(${jsArg(item.id)},'snooze',1)" ${busy?"disabled":""}>Jutro</button><button class="btn ghost" onclick="agentAISpecjalistaDecyzja(${jsArg(item.id)},'dismiss')" ${busy?"disabled":""}>Nie wykonuj</button><button class="btn" onclick="agentAISpecjalistaDecyzja(${jsArg(item.id)},'approve')" ${busy?"disabled":""}>${busy?"Zapisuję…":product?"Zapisz wybrane pola":communication?"Zaakceptuj szkic — bez wysyłki":"Przyjmij do wiadomości"}</button></div></footer>
  </article>`;
}
function agentAIAktywnyCyklHTML(last={}){
  const plan=last.coordinatorPlan||{},assignments=Array.isArray(plan.assignments)?plan.assignments:[],progress=last.editorialProgress||{};
  const communicationMode={new_event:"nowe zdarzenie przeanalizowane",safety_12h:"kontrola bezpieczeństwa po 12 h",unchanged_skipped:"bez zmian — analiza pominięta"}[last.communicationMode]||"oczekiwanie na zdarzenie";
  const stages=[
    ["1","Pobranie danych",`${last.productsChecked||0} produktów • komunikacja: ${communicationMode}`,last.completedAt?"done":"active"],
    ["2","Plan Codex",assignments.length?`${assignments.length} przydzielone scenariusze`:"ocena priorytetów",assignments.length?"done":"waiting"],
    ["3","Praca specjalistów",`${last.prepared||0} przygotowanych • ${last.autoApplied||0} zapisanych`,last.prepared||last.autoApplied?"done":"waiting"],
    ["4","Kontrola i decyzje",`${last.decisionsCreated||0} nowych decyzji`,last.decisionsCreated?"attention":"done"],
  ];
  return `<div class="agent-live-flow">${stages.map(([number,label,detail,status])=>`<article class="${status}"><span>${number}</span><div><b>${esc(label)}</b><small>${esc(detail)}</small></div><i>${status==="done"?"✓":status==="active"?"…":status==="attention"?"!":"○"}</i></article>`).join("")}</div>${progress.total?`<div class="agent-catalog-progress"><span><b>Przygotowanie katalogu</b><small>${esc(progress.ready||0)} z ${esc(progress.total)} gotowych</small></span><i><em style="width:${Math.min(100,Math.round(Number(progress.ready||0)/Math.max(1,Number(progress.total))*100))}%"></em></i></div>`:""}`;
}
function agentAIHistoriaDecyzjiHTML(items=[]){
  return `<div class="agent-decision-history">${items.slice(0,12).map(item=>`<article><span>${item.status==="dismissed"?"—":"✓"}</span><div><b>${esc(item.title||item.kind||"Rozstrzygnięta sprawa")}</b><small>${esc(item.resolvedBy||"Agent / administrator")} • ${esc(agentAIRuntimeCzas(item.resolvedAt||item.updatedAt))}</small></div><em>${item.status==="dismissed"?"zamknięto":"wykonano"}</em></article>`).join("")||`<div class="agent-ops-empty">Historia rozstrzygnięć pojawi się po pierwszej decyzji.</div>`}</div>`;
}
function agentAISpecjalisciPanelHTML(){
  const state=agentAISpecjalisci,data=state.data||{},specialists=Array.isArray(data.specialists)?data.specialists:[],history=Array.isArray(data.history)?data.history:[],decisions=Array.isArray(data.decisions)?data.decisions:[],recent=Array.isArray(data.recentDecisions)?data.recentDecisions:[],usage=data.usage||{},stats=data.decisionStats||{},last=data.lastCycle||{},cfg=data.config||{},connected=!!(data.configured&&data.platformAgents?.configured&&cfg.automaticEnabled!==false),completedToday=history.filter(run=>["auto_applied","applied","not_needed"].includes(run.approvalStatus)).length;
  if(state.loading&&!state.loaded)return `<section class="panel agent-specialists-page"><div class="agent-runtime-loading"><i></i><div><b>Łączę centrum pracy Agenta…</b><small>Pobieram bieżący cykl, decyzje i wykonania.</small></div></div></section>`;
  if(state.error&&!data.specialists)return `<section class="panel"><div class="backend-note warn"><b>Nie udało się pobrać pracy Agenta.</b><p>${esc(state.error)}</p><button class="btn" onclick="agentAISpecjalisciPobierz(false)">Ponów</button></div></section>`;
  return `<section class="agent-specialists-page agent-observability-page">
    <section class="panel agent-observer-head"><div><span class="agent-live-dot ${connected?"online":"offline"}"></span><div><small>CENTRUM PRACY AGENTA</small><h2>${connected?"Agent działa i czuwa":"Automatyka wymaga kontroli"}</h2><p>${last.completedAt?`Ostatnia porcja pracy ${esc(agentAIRuntimeCzas(last.completedAt))}. Detektor reaguje na nowe zdarzenia, a ciężka kolejka wykonuje najwyżej dwa zadania naraz. Bez zmian szerokie kontrole są pomijane.`:"Oczekiwanie na pierwsze zdarzenie lub zaplanowaną porcję pracy."}</p></div></div><button class="btn" onclick="agentAISpecjalisciCykl()" ${state.running?"disabled":""}>${state.running?"⏳ Cykl trwa":"↻ Sprawdź teraz"}</button></section>
    <section class="agent-observer-metrics"><article class="${last.status==="warning"?"warning":"active"}"><span>⚙</span><div><b>${state.running?"PRACUJE":last.status==="warning"?"UWAGA":"GOTOWY"}</b><small>stan bieżącego cyklu</small></div></article><article class="${decisions.length?"warning":"safe"}"><span>◉</span><div><b>${esc(decisions.length)}</b><small>decyzji wymagających Ciebie</small></div></article><article class="safe"><span>✓</span><div><b>${esc(completedToday)}</b><small>wykonań widocznych dziś</small></div></article></section>
    <section class="panel agent-live-work"><div class="order-section-head"><div><span class="order-pro-label">Rzeczywisty przebieg</span><h2>Co Agent zrobił w ostatnim cyklu</h2></div><span class="lvl ${last.status==="warning"?"lvl-ostrzezenie":"lvl-ok"}">${esc(last.status||"oczekuje")}</span></div>${agentAIAktywnyCyklHTML(last)}</section>
    <section class="panel agent-decision-board"><div class="order-section-head"><div><span class="order-pro-label">Tylko decyzje człowieka</span><h2>Do zatwierdzenia — z pełnym szkicem i skutkiem</h2><p class="order-detail-lead">Każda karta pokazuje dane „przed” i „po”, źródło sprawy oraz dokładny skutek przycisku. Po decyzji karta znika i pozostaje w trwałej historii.</p></div><strong>${esc(decisions.length)}</strong></div><div class="agent-decision-list">${decisions.map(agentAISpecjalistaDecyzjaHTML).join("")||`<div class="agent-decision-empty"><span>✓</span><div><b>Nie czeka żadna decyzja</b><small>Agent nadal wykonuje bezpieczne zadania w tle.</small></div></div>`}</div></section>
    <details class="panel agent-observer-history"><summary><span><b>Ostatnie rozstrzygnięcia</b><small>${recent.length} zapisanych decyzji</small></span><i>⌄</i></summary>${agentAIHistoriaDecyzjiHTML(recent)}</details>
    <details class="panel agent-observer-settings"><summary><span><b>Role, limity i ustawienia techniczne</b><small>${specialists.length} profili OpenAI • ${usage.automaticToday||0}/${cfg.automaticDailyLimit||200} analiz automatycznych</small></span><i>⌄</i></summary><div><section class="agent-role-compact">${specialists.map(item=>`<article><span>${esc(item.icon||"✦")}</span><div><b>${esc(item.platformName||item.label)}</b><small>${esc(item.area)} • v${esc(item.platformPrompt?.version||"—")}</small></div><em>${item.platformAvailable===false?"rezerwa":"online"}</em></article>`).join("")}</section><form class="agent-specialist-settings" onsubmit="return agentAISpecjalisciZapiszUstawienia(event)"><div><label><input type="checkbox" name="enabled" ${cfg.enabled!==false?"checked":""}> Role aktywne</label><label><input type="checkbox" name="automaticEnabled" ${cfg.automaticEnabled!==false?"checked":""}> Kolejka zdarzeń (detektor co 15 min)</label><label><input type="checkbox" name="learningEnabled" ${cfg.learningEnabled!==false?"checked":""}> Pamięć korekt</label><label><input type="checkbox" name="safeAutoApply" ${cfg.safeAutoApply!==false?"checked":""}> Bezpieczne zapisy automatyczne</label><label>Zatwierdzeń przed autonomią<input type="number" name="approvalWarmupCount" min="0" max="20" value="${esc(cfg.approvalWarmupCount??0)}"></label><label>Min. akceptacja (%)<input type="number" name="learnedAutoApplyThreshold" min="60" max="100" value="${esc(Math.round(Number(cfg.learnedAutoApplyThreshold||.86)*100))}"></label><label>Próg pewności (%)<input type="number" name="confidenceThreshold" min="75" max="100" value="${esc(Math.round(Number(cfg.confidenceThreshold||.92)*100))}"></label><label>Automatyczne / dzień<input type="number" name="automaticDailyLimit" min="0" max="400" value="${esc(cfg.automaticDailyLimit??200)}"></label><label>Analiz w jednej porcji<input type="number" name="automaticBatchSize" min="1" max="12" value="${esc(cfg.automaticBatchSize||10)}"></label><label>Wszystkie / dzień<input type="number" name="dailyLimit" min="1" max="500" value="${esc(cfg.dailyLimit||240)}"></label><label>Pamięć wyniku (h)<input type="number" name="cacheHours" min="1" max="168" value="${esc(cfg.cacheHours||24)}"></label><label>Historia decyzji (dni)<input type="number" name="decisionRetentionDays" min="7" max="90" value="${esc(cfg.decisionRetentionDays||30)}"></label></div><button class="btn" type="submit">💾 Zapisz ustawienia</button></form></div></details>
  </section>`;
}
function agentAIPulpitObserwowalnoscHTML(score=0){
  const m=agentAIMetrykiScalone(),[state,label,detail]=agentAIStanSystemuMeta(),runtime=agentAIRuntime.runtime||{},run=runtime.currentRun||runtime.lastRun||{},steps=Array.isArray(run.steps)?run.steps:[],activity=Array.isArray(runtime.activity)?runtime.activity:[],decisions=agentAISpecjalisci.data?.decisions||[];
  return `<section class="agent-command-center agent-command-center-v2"><div class="agent-command-center-main"><span class="order-pro-label">CENTRUM OPERACYJNE • AKTUALIZACJA NA ŻYWO</span><h1>Agent AI pod pełną kontrolą</h1><p>Widzisz tylko pracę, która właśnie trwa, sprawy wymagające decyzji i ostatnie zakończone działania. Szczegóły techniczne pozostają w Automatyzacjach i Audycie.</p><div class="agent-command-center-actions"><a class="btn" href="#/admin/agent-ai/rozmowa">💬 Wydaj polecenie</a><a class="btn ghost" href="#/admin/agent-ai/automatyzacje">◉ Decyzje i automatyzacje</a></div></div><aside><div class="health-score">${score}%</div><span class="agent-command-health ${state}"><i></i><b>${esc(label)}</b><small>${esc(detail)}</small></span></aside></section>
  <section class="agent-observer-metrics"><article class="${m.working?"active":"safe"}"><span>⚙</span><div><b>${esc(m.working)}</b><small>zadań wykonywanych teraz</small></div></article><article class="${decisions.length?"warning":"safe"}"><span>◉</span><div><b>${esc(decisions.length)}</b><small>decyzji do zatwierdzenia</small></div></article><article class="${m.bad?"warning":"safe"}"><span>!</span><div><b>${esc(m.tasks)}</b><small>aktywnych spraw operacyjnych</small></div></article></section>
  <div class="agent-observer-dashboard"><section class="panel agent-now-card"><div class="order-section-head"><div><span class="order-pro-label">${runtime.currentRun?"Agent pracuje teraz":"Ostatnie wykonanie"}</span><h2>${esc(run.summary||"Automatyczna kontrola sklepu")}</h2><p class="order-detail-lead">${esc(agentAIRuntimeCzas(run.startedAt||run.completedAt||runtime.worker?.lastSeenAt))}</p></div><button class="btn ghost" onclick="agentAIRuntimePobierz(false)">↻ Odśwież</button></div><div class="agent-now-steps">${steps.slice(0,8).map(step=>`<article class="${esc(step.status||"waiting")}"><span>${step.status==="completed"?"✓":step.status==="running"?"…":step.status==="warning"?"!":"○"}</span><div><b>${esc(step.label||step.id)}</b><small>${esc(step.error||step.detail||"Oczekuje")}</small></div><em>${step.durationMs?`${Math.max(1,Math.round(step.durationMs/1000))} s`:""}</em></article>`).join("")||`<div class="agent-ops-empty">Agent jest gotowy. Następny cykl uruchomi się zgodnie z harmonogramem.</div>`}</div></section>
  <section class="panel agent-decision-preview"><div class="order-section-head"><div><span class="order-pro-label">Twoja kolejka</span><h2>Decyzje administratora</h2></div><a class="btn ghost" href="#/admin/agent-ai/automatyzacje">Wszystkie →</a></div><div>${decisions.slice(0,3).map(item=>`<article><span>${esc(item.icon||"◉")}</span><div><b>${esc(item.title||"Decyzja")}</b><small>${esc(item.recommendation||item.summary||"")}</small></div><a class="btn" href="#/admin/agent-ai/automatyzacje">Zdecyduj</a></article>`).join("")||`<div class="agent-decision-empty"><span>✓</span><div><b>Wszystko zatwierdzone</b><small>Nie ma decyzji oczekujących na Ciebie.</small></div></div>`}</div></section></div>
  <section class="panel agent-activity-compact"><div class="order-section-head"><div><span class="order-pro-label">Ostatnie działania</span><h2>Co Agent rzeczywiście wykonał</h2></div><a class="btn ghost" href="#/admin/agent-ai/audyt">Pełny audyt →</a></div><div>${activity.slice(0,8).map(item=>`<article class="${esc(item.status||"")}"><span>${item.status==="success"?"✓":item.status==="error"?"×":item.status==="warning"?"!":"•"}</span><div><b>${esc(item.title||"Działanie Agenta")}</b><small>${esc(item.detail||item.source||"")}</small></div><time>${esc(agentAIRuntimeCzas(item.at))}</time></article>`).join("")||`<div class="agent-ops-empty">Historia pojawi się po najbliższym cyklu.</div>`}</div></section>`;
}
function agentAITelegramPanelHTML(){
  const t=agentAITelegram,s=t.settings||{},status=t.status||{},worker=t.agentWorker||{},stats=t.stats||{},incidents=Array.isArray(t.incidents)?t.incidents:[],history=Array.isArray(t.history)?t.history:[],outbox=Array.isArray(t.outbox)?t.outbox:[],health=t.state?.health||{},active=incidents.filter(item=>item.status!=="resolved"),overdue=active.filter(item=>["open","acknowledged"].includes(item.status)&&item.dueAt&&Date.parse(item.dueAt)<=Date.now()),times=s.digestTimes||["08:00","16:00"],online=!!(status.webhook?.active&&status.target?.reachable),privacyModeBlocked=!!status.bot&&status.bot.can_read_all_group_messages===false;
  const incidentState=item=>item.status==="snoozed"?"odłożona":item.status==="acknowledged"?"przyjęta":"nowa";
  return `<section class="telegram-center-page telegram-workspace-v2">
    <section class="panel telegram-inbox-head"><div><span class="telegram-avatar">✈</span><div><small>WSPÓLNY KANAŁ ZESPOŁU</small><h2>Telegram Artway‑TM</h2><p>Jeden bot, jedna rozmowa i jedna kolejka spraw. System wysyła tylko nowe, ważne informacje oraz wiadomości uruchomione przez Ciebie.</p></div></div><div><span class="telegram-connection-pill ${online?"online":"offline"}"><i></i>${online?"Połączony":"Wymaga kontroli"}</span><button class="btn ghost" onclick="agentAITelegramPobierz(true)" ${t.loading?"disabled":""}>${t.loading?"Sprawdzam…":"↻ Odśwież"}</button></div></section>
    ${privacyModeBlocked?`<div class="backend-note warn telegram-privacy-warning"><b>Bot nie widzi zwykłych wiadomości grupy.</b><p>Wyłącz Privacy Mode dla @${esc(status.bot?.username||"bota")} w @BotFather, a następnie kliknij Odśwież.</p></div>`:""}${t.error||status.error?`<div class="backend-note warn"><b>Komunikacja wymaga kontroli.</b><p>${esc(t.error||status.error)}</p></div>`:""}
    <section class="agent-observer-metrics telegram-inbox-metrics"><article class="${active.length?"warning":"safe"}"><span>●</span><div><b>${esc(active.length)}</b><small>otwartych spraw zespołu</small></div></article><article class="${overdue.length?"warning":"safe"}"><span>⏱</span><div><b>${esc(overdue.length)}</b><small>spraw po terminie SLA</small></div></article><article class="${Number(stats.deliveryRate??100)<99?"warning":"safe"}"><span>✓</span><div><b>${esc(stats.deliveryRate??100)}%</b><small>skuteczność dostarczeń</small></div></article></section>
    <div class="telegram-inbox-layout"><section class="panel telegram-inbox-queue"><div class="order-section-head"><div><span class="order-pro-label">Skrzynka operacyjna</span><h2>Sprawy do obsługi</h2><p class="order-detail-lead">Zmiana statusu jest wewnętrzna i nie wysyła niczego do klienta.</p></div><span class="lvl ${active.length?"lvl-ostrzezenie":"lvl-ok"}">${active.length} aktywnych</span></div><div class="telegram-incident-toolbar"><input id="telegramIncidentSearch" type="search" placeholder="Szukaj sprawy…" oninput="agentAITelegramFiltrujSprawy()"><select id="telegramIncidentStatus" onchange="agentAITelegramFiltrujSprawy()"><option value="active">Aktywne</option><option value="open">Nowe</option><option value="acknowledged">Przyjęte</option><option value="snoozed">Odłożone</option><option value="resolved">Załatwione</option><option value="all">Wszystkie</option></select></div><div class="telegram-incident-list">${incidents.map(item=>{const late=["open","acknowledged"].includes(item.status)&&item.dueAt&&Date.parse(item.dueAt)<=Date.now();return `<article class="telegram-incident-card ${esc(item.severity||"warning")} ${esc(item.status||"open")} ${late?"overdue":""}" data-status="${esc(item.status||"open")}" data-search="${esc(`${item.id} ${item.title} ${item.description} ${item.category}`.toLowerCase())}" ${item.status==="resolved"?"hidden":""}><header><span>${item.severity==="critical"?"!":"•"}</span><div><b>${esc(item.title||"Sprawa")}</b><small>${esc(item.category||"operacje")} • ${esc(item.count||1)} zdarzeń</small></div><em>${late?"po SLA":esc(incidentState(item))}</em></header><p>${esc(item.description||"")}</p><footer>${item.status!=="resolved"?`<button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(item.id)},'ack')">Przejmij</button><button class="btn ghost" onclick="agentAITelegramIncydent(${jsArg(item.id)},'s24')">Odłóż do jutra</button><button class="btn" onclick="agentAITelegramIncydent(${jsArg(item.id)},'resolve')">✓ Załatwione</button>`:""}${item.href?`<a class="btn ghost" href="${esc(item.href)}">Otwórz źródło</a>`:""}</footer></article>`;}).join("")||`<div class="agent-decision-empty"><span>✓</span><div><b>Brak spraw do obsługi</b><small>Nowe ważne zdarzenia pojawią się tutaj automatycznie.</small></div></div>`}</div></section>
      <aside class="telegram-inbox-side"><section class="panel telegram-team-composer"><div class="order-section-head"><div><span class="order-pro-label">Wiadomość ręczna</span><h2>Napisz do zespołu</h2><p class="order-detail-lead">Wysyłka nastąpi dopiero po kliknięciu.</p></div></div><form class="telegram-note-form" onsubmit="return agentAITelegramWyslijNotatke(event)"><textarea id="agentTelegramNote" maxlength="1500" placeholder="Krótka, konkretna wiadomość dla zespołu…"></textarea><div><label><input id="agentTelegramNoteSilent" type="checkbox" checked> bez dźwięku</label><span>do wspólnej grupy</span></div><button class="btn telegram-btn" type="submit">✈ Wyślij wiadomość</button></form></section><section class="panel telegram-quick-actions"><div class="order-section-head"><div><span class="order-pro-label">Na żądanie</span><h2>Operacje bota</h2></div></div><button class="btn" onclick="agentAITelegramAkcja('dashboard')">Aktualizuj stały pulpit</button><button class="btn ghost" onclick="agentAITelegramAkcja('digest')">Wyślij tylko nowe sprawy</button><button class="btn ghost" onclick="agentAITelegramAkcja('report')">Pełny raport teraz</button></section></aside></div>
    <section class="panel telegram-conversation-log"><div class="order-section-head"><div><span class="order-pro-label">Wspólna historia</span><h2>Ostatnia komunikacja</h2><p class="order-detail-lead">Czytelny zapis kierunku, wyniku i źródła — bez technicznego szumu.</p></div></div><div>${history.slice(0,40).map(item=>`<article class="${item.direction==="in"?"incoming":"outgoing"} ${esc(item.status||"")}"><span>${item.direction==="in"?"←":"→"}</span><div><small>${item.direction==="in"?"Z Telegram":"Do Telegram"} • ${esc(item.kind||"wiadomość")}</small><b>${esc(item.title||item.reason||"Operacja komunikacyjna")}</b>${item.reason&&item.reason!==item.title?`<p>${esc(item.reason)}</p>`:""}<em>${esc(item.source||"Agent")}</em></div><time>${esc(allegroDataTxt(item.at))}</time></article>`).join("")||`<div class="agent-ops-empty">Historia pojawi się po pierwszej wiadomości.</div>`}</div></section>
    ${outbox.length?`<details class="panel telegram-delivery-errors" open><summary><span><b>Niedostarczone wiadomości</b><small>${outbox.length} wpisów w kolejce ponowień</small></span><i>⌄</i></summary><div>${outbox.map(item=>`<article><div><b>${esc(item.incidentId||item.id)}</b><small>${esc(item.lastError||"oczekuje na ponowienie")} • próba ${esc(item.attempts||0)}/3</small></div><button class="btn ghost" onclick="agentAITelegramDostarczenie(${jsArg(item.id)},'retry')">Ponów</button>${item.status==="dead"?`<button class="btn danger" onclick="agentAITelegramDostarczenie(${jsArg(item.id)},'dismiss')">Usuń</button>`:""}</article>`).join("")}</div></details>`:""}
    <details class="panel telegram-settings-fold"><summary><span><b>Ustawienia powiadomień i stan techniczny</b><small>${online?"bot, webhook i kanał działają":"połączenie wymaga kontroli"}</small></span><i>⌄</i></summary><div><form class="telegram-policy-form" onsubmit="return agentAITelegramZapisz(event)"><div class="telegram-policy-grid"><label class="telegram-switch"><input type="checkbox" name="enabled" ${s.enabled!==false?"checked":""}><span><b>System aktywny</b><small>Główny przełącznik automatyki.</small></span></label><label>Tryb<select name="mode"><option value="important" ${s.mode==="important"?"selected":""}>Pilne + raport</option><option value="digest" ${s.mode==="digest"?"selected":""}>Tylko raporty</option><option value="manual" ${s.mode==="manual"?"selected":""}>Tylko ręcznie</option></select></label><label><input type="checkbox" name="automaticCritical" ${s.automaticCritical!==false?"checked":""}> krytyczne od razu</label><label><input type="checkbox" name="onlyChanges" ${s.onlyChanges!==false?"checked":""}> tylko nowe zmiany</label><label><input type="checkbox" name="customerMessages" ${s.customerMessages!==false?"checked":""}> wiadomości klientów</label><label><input type="checkbox" name="operationalAlerts" ${s.operationalAlerts!==false?"checked":""}> zamówienia i wysyłki</label><label><input type="checkbox" name="supplierAlerts" ${s.supplierAlerts?"checked":""}> producenci</label><label><input type="checkbox" name="digestEnabled" ${s.digestEnabled?"checked":""}> raporty planowane</label><label>Raport 1<input type="time" name="digestTime1" value="${esc(times[0]||"08:00")}"></label><label>Raport 2<input type="time" name="digestTime2" value="${esc(times[1]||"16:00")}"></label><label>Cisza od<input type="time" name="quietStart" value="${esc(s.quietStart||"21:00")}"></label><label>Cisza do<input type="time" name="quietEnd" value="${esc(s.quietEnd||"07:00")}"></label><label><input type="checkbox" name="criticalDuringQuiet" ${s.criticalDuringQuiet?"checked":""}> krytyczne w ciszy</label><label><input type="checkbox" name="incidentWorkflow" ${s.incidentWorkflow!==false?"checked":""}> cykl obsługi spraw</label><label><input type="checkbox" name="autoResolve" ${s.autoResolve!==false?"checked":""}> zamykaj po zniknięciu</label><label><input type="checkbox" name="slaEnabled" ${s.slaEnabled!==false?"checked":""}> kontroluj SLA</label><label>SLA pilne<input type="number" name="criticalSlaMinutes" min="15" value="${esc(s.criticalSlaMinutes||60)}"></label><label>SLA zwykłe<input type="number" name="warningSlaMinutes" min="30" value="${esc(s.warningSlaMinutes||240)}"></label><label><input type="checkbox" name="escalationEnabled" ${s.escalationEnabled!==false?"checked":""}> eskalacje</label><label>Powtórz po<input type="number" name="escalationRepeatMinutes" min="30" value="${esc(s.escalationRepeatMinutes||120)}"></label><label>Maks. eskalacji<input type="number" name="maxEscalations" min="1" max="5" value="${esc(s.maxEscalations||2)}"></label><label>Ochrona (min)<input type="number" name="cooldownMinutes" min="15" value="${esc(s.cooldownMinutes||720)}"></label><label>Powtórka (h)<input type="number" name="repeatOpenHours" min="1" value="${esc(s.repeatOpenHours||24)}"></label><label>Maks. pozycji<input type="number" name="maxItems" min="3" max="20" value="${esc(s.maxItems||8)}"></label><label><input type="checkbox" name="topicRouting" ${s.topicRouting?"checked":""}> osobne tematy</label><label>Klienci<input type="number" name="topicCustomer" min="0" value="${esc(s.topicCustomer||0)}"></label><label>Operacje<input type="number" name="topicOperations" min="0" value="${esc(s.topicOperations||0)}"></label><label>Producenci<input type="number" name="topicSupplier" min="0" value="${esc(s.topicSupplier||0)}"></label></div><button class="btn" type="submit">💾 Zapisz ustawienia</button></form><aside class="telegram-technical-status"><article><span>${status.webhook?.active?"✓":"!"}</span><div><b>Webhook</b><small>${status.webhook?.active?"aktywny":"nieaktywny"}</small></div></article><article><span>${status.target?.reachable?"✓":"!"}</span><div><b>Grupa zespołu</b><small>${esc(status.target?.name||status.target?.error||"brak danych")}</small></div></article><article><span>${worker.workerOnline?"✓":"!"}</span><div><b>Agent wykonawczy</b><small>${worker.workerOnline?"online":`ostatni kontakt ${agentAIRuntimeCzas(worker.workerLastSeenAt)}`}</small></div></article><article><span>•</span><div><b>Ostatni cykl</b><small>${health.lastCycleAt?esc(allegroDataTxt(health.lastCycleAt)):"brak danych"}</small></div></article><button class="btn ghost" onclick="agentAITelegramAkcja('webhook')">Odśwież webhook</button><button class="btn ghost" onclick="agentAITelegramAkcja('test')">Cichy test</button></aside></div></details>
  </section>`;
}
