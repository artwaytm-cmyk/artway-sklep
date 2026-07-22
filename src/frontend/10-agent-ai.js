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
