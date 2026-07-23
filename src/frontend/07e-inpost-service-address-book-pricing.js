let inpostServiceWycenaTimer=0;

function inpostServiceAdresKsiazki(contact={}){
  const a=contact.address||{};
  return [a.street,[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/"),a.postCode||a.post_code,a.city].filter(Boolean).join(" ");
}
function inpostServiceNazwaKontaktu(contact={}){
  return contact.label||contact.companyName||`${contact.firstName||""} ${contact.lastName||""}`.trim()||contact.email||contact.phone||"Zapisany adres";
}
function inpostServiceAdresy(){
  const saved=(inpostServiceStan.addressBook||[]).map(contact=>({...contact,key:contact.id,stored:true}));
  const known=inpostServiceKlienci().map(contact=>({...contact,key:`client:${contact.key}`,stored:false,roles:["receiver"]}));
  const map=new Map();
  [...saved,...known].forEach(contact=>{
    const fingerprint=[contact.taxCode,contact.email,contact.phone,inpostServiceAdresKsiazki(contact)].map(value=>String(value||"").trim().toLowerCase()).join("|");
    if(!fingerprint.replace(/\|/g,""))return;
    const existing=map.get(fingerprint);
    if(!existing||contact.stored)map.set(fingerprint,contact);
  });
  return [...map.values()].sort((a,b)=>Number(b.stored)-Number(a.stored)||inpostServiceNazwaKontaktu(a).localeCompare(inpostServiceNazwaKontaktu(b),"pl"));
}
function inpostServiceOpcjeAdresow(selected="",role="receiver"){
  const options=inpostServiceAdresy().map(contact=>{
    const roleLabel=(contact.roles||[]).includes("sender")&&(contact.roles||[]).includes("receiver")?"nadawca i odbiorca":(contact.roles||[]).includes("sender")?"nadawca":"odbiorca";
    const label=`${inpostServiceNazwaKontaktu(contact)} • ${inpostServiceAdresKsiazki(contact)||contact.email||contact.phone} • ${roleLabel}`;
    return `<option value="${esc(contact.key)}" ${String(selected)===String(contact.key)?"selected":""}>${esc(label)}</option>`;
  }).join("");
  return `<option value="">— Nowy adres ${role==="sender"?"nadawcy":"odbiorcy"} —</option>${options}`;
}
function inpostServiceUstawPolaOsoby(form,prefix,contact={}){
  const address=contact.address||{},fields={
    [`${prefix}Company`]:contact.companyName,[`${prefix}TaxCode`]:contact.taxCode,
    [`${prefix}FirstName`]:contact.firstName,[`${prefix}LastName`]:contact.lastName,
    [`${prefix}Email`]:contact.email,[`${prefix}Phone`]:contact.phone,
    [`${prefix}Street`]:address.street,[`${prefix}Building`]:address.buildingNumber||address.building_number,
    [`${prefix}Flat`]:address.flatNumber||address.flat_number,
    [`${prefix}PostCode`]:address.postCode||address.post_code,[`${prefix}City`]:address.city,
  };
  Object.entries(fields).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value||"";});
}
function inpostServiceWybierzAdres(select,prefix){
  const form=select?.form,contact=inpostServiceAdresy().find(item=>String(item.key)===String(select.value));
  if(!form)return;
  const hidden=form.elements[`${prefix}ContactId`];
  if(hidden)hidden.value=contact?.stored?contact.id:"";
  if(contact){
    inpostServiceUstawPolaOsoby(form,prefix,contact);
    toast(`Uzupełniono zapisany adres ${prefix==="sender"?"nadawcy":"odbiorcy"} ✅`);
  }else{
    inpostServiceUstawPolaOsoby(form,prefix,{});
  }
  inpostServiceZaplanujWycene(form);
}
function inpostServiceOdswiezSelektory(form,selectedId=""){
  ["sender","receiver"].forEach(prefix=>{
    const select=form?.elements[`${prefix}AddressChoice`];
    if(!select)return;
    const current=prefix===form.dataset.lastSavedRole&&selectedId?selectedId:select.value;
    select.innerHTML=inpostServiceOpcjeAdresow(current,prefix);
    if([...select.options].some(option=>option.value===current))select.value=current;
  });
}
async function inpostServiceZapiszKontakt(prefix,button=null){
  const form=button?.closest("form")||document.getElementById("inpostServiceForm");if(!form)return;
  const contact=inpostServiceStronaOsoby(form,prefix),id=form.elements[`${prefix}ContactId`]?.value||"";
  contact.id=id;contact.label=contact.companyName||`${contact.firstName} ${contact.lastName}`.trim()||contact.email;
  try{
    const d=await chmura("inpost-service-contact-save",{method:"POST",body:{role:prefix,contact},timeout:20000});
    inpostServiceStan.addressBook=Array.isArray(d.addressBook)?d.addressBook:inpostServiceStan.addressBook;
    form.dataset.lastSavedRole=prefix;
    if(form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value=d.contact?.id||id;
    inpostServiceOdswiezSelektory(form,d.contact?.id||id);
    toast(id?"Zaktualizowano adres w książce ✅":"Adres zapisany w książce ✅");
  }catch(e){toast("Książka adresowa: "+(e.message||e));}
}
async function inpostServiceUsunKontakt(prefix,button=null){
  const form=button?.closest("form")||document.getElementById("inpostServiceForm"),id=form?.elements[`${prefix}ContactId`]?.value||"";
  if(!id)return toast("Ten adres nie jest jeszcze zapisany w książce");
  if(!confirm("Usunąć wybrany adres z książki? Historia przesyłek pozostanie bez zmian."))return;
  try{
    const d=await chmura("inpost-service-contact-delete",{method:"POST",body:{id},timeout:20000});
    inpostServiceStan.addressBook=Array.isArray(d.addressBook)?d.addressBook:[];
    form.elements[`${prefix}ContactId`].value="";
    form.elements[`${prefix}AddressChoice`].value="";
    inpostServiceOdswiezSelektory(form);
    toast("Adres usunięty z książki");
  }catch(e){toast("Nie usunięto adresu: "+(e.message||e));}
}
function inpostServiceMozeWycenic(payload){
  const people=[payload.sender,payload.receiver];
  if(people.some(person=>!person?.email||String(person.phone||"").replace(/\D/g,"").length<9))return false;
  const senderAddress=payload.sender?.address||{};
  if(!senderAddress.street||!senderAddress.buildingNumber||!senderAddress.postCode||!senderAddress.city)return false;
  if(payload.deliveryType==="locker"&&!payload.targetPoint)return false;
  if(payload.deliveryType==="courier"){
    const address=payload.receiver?.address||{};
    if(!address.street||!address.buildingNumber||!address.postCode||!address.city)return false;
  }
  return true;
}
function inpostServiceWycenaKwota(pricing={}){
  return Number.isFinite(Number(pricing.totalGross))?Number(pricing.totalGross):null;
}
function inpostServiceAktualizujWyceneUI(form,pricing=inpostServiceStan.pricing){
  const box=form?.querySelector("[data-inpost-pricing]");if(!box)return;
  if(!pricing){
    box.innerHTML='<div class="inpost-price-empty"><b>Uzupełnij dane paczki i adresy</b><small>Koszt zostanie sprawdzony automatycznie w InPost.</small></div>';
    return;
  }
  if(pricing.loading){
    box.innerHTML='<div class="inpost-price-empty"><b>Sprawdzam koszt w ShipX…</b><small>Wycena nie tworzy przesyłki.</small></div>';
    return;
  }
  const total=inpostServiceWycenaKwota(pricing),fee=Math.max(0,Number(form?.commissionGross?.value||pricing.commissionGross||0)||0);
  if(total==null){
    box.innerHTML=`<div class="inpost-price-empty warning"><b>InPost nie zwrócił ceny dla tej umowy</b><small>${esc(pricing.message||"Dla części kont abonamentowych ShipX zwraca cenę dopiero w rozliczeniu. Możesz podać koszt ręczny poniżej.")}</small></div>`;
    return;
  }
  const customer=Math.round((total+fee)*100)/100,b=pricing.breakdown||{},source=pricing.source==="manual"?"koszt wpisany ręcznie":"wycena z umowy InPost";
  const parts=[["Podstawa",b.baseGross],["Paliwo",b.fuelGross],["Pobranie",b.codGross],["Ochrona",b.insuranceGross],["Powiadomienia",b.notificationGross]].filter(([,value])=>Number.isFinite(Number(value))&&Number(value)>0);
  box.innerHTML=`<div class="inpost-price-main"><span><small>Koszt przesyłki</small><strong>${zl(total)}</strong></span><span><small>Prowizja</small><strong>${zl(fee)}</strong></span><span class="total"><small>Koszt + prowizja</small><strong>${zl(customer)}</strong></span></div><div class="inpost-price-meta"><span class="lvl ${pricing.source==="manual"?"lvl-ostrzezenie":"lvl-ok"}">${esc(source)}</span>${parts.map(([name,value])=>`<small>${esc(name)}: ${zl(value)}</small>`).join("")}</div>`;
}
function inpostServicePrzelicz(form){
  const manual=Math.max(0,Number(String(form?.carrierCostOverride?.value||"").replace(",","."))||0),fee=Math.max(0,Number(String(form?.commissionGross?.value||0).replace(",","."))||0);
  if(manual>0)inpostServiceStan.pricing={totalGross:manual,commissionGross:fee,customerTotalGross:Math.round((manual+fee)*100)/100,currency:"PLN",source:"manual",estimated:true,available:true,breakdown:{}};
  else if(inpostServiceStan.pricing?.source==="manual")inpostServiceStan.pricing=null;
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceZaplanujWycene(form){
  clearTimeout(inpostServiceWycenaTimer);
  inpostServicePrzelicz(form);
  inpostServiceWycenaTimer=setTimeout(()=>inpostServiceWycena(form,false),650);
}
async function inpostServiceWycena(form=document.getElementById("inpostServiceForm"),force=true){
  if(!form)return;
  const payload=inpostServicePayload(form);
  if(!inpostServiceMozeWycenic(payload)){
    if(force)toast("Uzupełnij adresy, kontakt i sposób dostawy, aby sprawdzić koszt");
    inpostServiceStan.pricing=null;inpostServiceAktualizujWyceneUI(form);return;
  }
  inpostServiceStan.pricing={loading:true};inpostServiceAktualizujWyceneUI(form);
  try{
    const d=await chmura("inpost-service-quote",{method:"POST",body:payload,timeout:30000});
    inpostServiceStan.pricing=d.pricing||null;
  }catch(e){
    if(e.code==="inpost_quote_validation")inpostServiceStan.pricing=null;
    else inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||String(e),source:"unavailable"};
  }
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceUstawTyp(form){
  const type=String(form?.deliveryType?.value||"locker");
  form?.querySelectorAll("[data-inpost-only]").forEach(el=>el.hidden=!String(el.dataset.inpostOnly||"").split(",").includes(type));
  if(type==="locker"&&form?.sendingMethod?.value==="dispatch_order")form.sendingMethod.value="parcel_locker";
  form?.querySelectorAll('[data-receiver-address]').forEach(input=>input.required=type==="courier");
  inpostServiceZaplanujWycene(form);
}
function inpostServiceOsobaFields(prefix,title,person={}){
  const a=person.address||{},selected=person.id||"";
  return `<fieldset class="inpost-party-card">
    <legend>${prefix==="sender"?"📤":"📥"} ${esc(title)}</legend>
    <div class="inpost-address-picker">
      <label>Wybierz z książki adresowej
        <select name="${prefix}AddressChoice" onchange="inpostServiceWybierzAdres(this,${jsArg(prefix)})">${inpostServiceOpcjeAdresow(selected,prefix)}</select>
      </label>
      <input type="hidden" name="${prefix}ContactId" value="${esc(selected)}">
      <div class="inpost-address-actions">
        <button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt(${jsArg(prefix)},this)">💾 Zapisz adres</button>
        <button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt(${jsArg(prefix)},this)">Usuń zapis</button>
      </div>
    </div>
    <div class="inpost-form-grid">
      <label>Firma<input name="${prefix}Company" value="${esc(person.companyName||"")}"></label>
      <label>NIP<input name="${prefix}TaxCode" inputmode="numeric" maxlength="10" value="${esc(person.taxCode||"")}"></label>
      <label>Imię<input name="${prefix}FirstName" value="${esc(person.firstName||"")}"></label>
      <label>Nazwisko<input name="${prefix}LastName" value="${esc(person.lastName||"")}"></label>
      <label>E-mail *<input name="${prefix}Email" type="email" required value="${esc(person.email||"")}"></label>
      <label>Telefon *<input name="${prefix}Phone" inputmode="tel" required value="${esc(person.phone||"")}"></label>
      <label class="wide">Ulica ${prefix==="sender"?"*":""}<input name="${prefix}Street" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.street||"")}"></label>
      <label>Nr budynku ${prefix==="sender"?"*":""}<input name="${prefix}Building" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.buildingNumber||a.building_number||"")}"></label>
      <label>Nr lokalu<input name="${prefix}Flat" value="${esc(a.flatNumber||a.flat_number||"")}"></label>
      <label>Kod pocztowy ${prefix==="sender"?"*":""}<input name="${prefix}PostCode" ${prefix==="sender"?"required":"data-receiver-address"} pattern="\\d{2}-?\\d{3}" value="${esc(a.postCode||a.post_code||"")}"></label>
      <label>Miasto ${prefix==="sender"?"*":""}<input name="${prefix}City" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.city||"")}"></label>
      <label class="check wide"><input type="checkbox" name="save${prefix==="sender"?"Sender":"Receiver"}" checked> Zapamiętaj lub zaktualizuj ten adres po utworzeniu przesyłki</label>
    </div>
  </fieldset>`;
}
function inpostServiceFormHTML(){
  const sender=inpostServiceNadawca(),fee=Number(inpostServiceStan.settings?.commissionGross??4),month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability;
  return `<section class="panel inpost-service-create">
    <div class="order-section-head"><div><span class="order-pro-label">Umowa InPost • ShipX</span><h2>Nadaj przesyłkę</h2><p class="order-detail-lead">Wybierz zapisane adresy, sprawdź koszt z umowy i dopiero potem utwórz przesyłkę.</p></div><div class="diag-actions"><span class="lvl ${available?.locker?"lvl-ok":"lvl-ostrzezenie"}">Paczkomat ${available?.locker?"aktywny":"do sprawdzenia"}</span><span class="lvl ${available?.courier?"lvl-ok":"lvl-ostrzezenie"}">Kurier ${available?.courier?"aktywny":"do sprawdzenia"}</span></div></div>
    <form id="inpostServiceForm" onsubmit="inpostServiceUtworz(event)" oninput="inpostServiceZaplanujWycene(this)" onchange="inpostServiceZaplanujWycene(this)">
      <input type="hidden" name="requestId" value="${esc(inpostServiceStan.requestId||inpostServiceNowyRequestId())}">
      <div class="inpost-form-top"><label>Referencja / numer klienta<input name="reference" required value="USL-${Date.now().toString(36).toUpperCase()}"></label><div class="inpost-address-summary"><b>📒 Książka adresowa</b><span>${inpostServiceStan.addressBook?.length||0} zapisanych adresów</span><small>Każdy adres może służyć jako nadawca lub odbiorca.</small></div></div>
      <div class="inpost-parties-grid">${inpostServiceOsobaFields("sender","Nadawca",sender)}${inpostServiceOsobaFields("receiver","Odbiorca",{})}</div>
      <div class="inpost-options-layout">
        <fieldset><legend>🚚 Usługa i nadanie</legend><div class="inpost-form-grid">
          <label>Rodzaj dostawy<select name="deliveryType" onchange="inpostServiceUstawTyp(this.form)"><option value="locker">Paczkomat / PaczkoPunkt</option><option value="courier">Kurier InPost</option></select></label>
          <label>Sposób nadania<select name="sendingMethod" onchange="inpostServiceUstawTyp(this.form)"><option value="parcel_locker">Paczkomat</option><option value="any_point">Dowolny punkt InPost</option><option value="pok">Punkt Obsługi Klienta</option><option value="pop">Punkt Obsługi Przesyłek</option><option value="branch">Oddział InPost</option><option value="dispatch_order">Odbiór przez kuriera</option></select></label>
          <div class="wide" data-inpost-only="locker"><label>Paczkomat / punkt odbiorcy *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" placeholder="np. BOJ01N"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape()">Mapa</button></div><small id="inpostServiceTargetPointLabel">Wybierz punkt na mapie albo wyszukaj poniżej.</small></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod pocztowy lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow()">Szukaj</button></div><div id="inpostServicePointResults"></div></div>
          <label>Punkt nadania (opcjonalnie)<input name="dropoffPoint" placeholder="kod punktu"></label>
          <label class="check" data-inpost-only="courier"><input type="checkbox" name="pickupRequested"> Zleć odbiór przez kuriera</label>
        </div></fieldset>
        <fieldset><legend>📦 Paczka i opcje</legend><div class="inpost-form-grid">
          <label>Gabaryt<select name="template"><option value="small">A / small</option><option value="medium">B / medium</option><option value="large">C / large</option><option value="">Wymiary własne</option></select></label>
          <label>Waga (kg)<input name="weight" type="number" min=".01" max="50" step=".01" value="1"></label>
          <label>Długość (cm)<input name="length" type="number" min="1" step=".1" value="30"></label><label>Szerokość (cm)<input name="width" type="number" min="1" step=".1" value="20"></label><label>Wysokość (cm)<input name="height" type="number" min="1" step=".1" value="15"></label>
          <label class="check"><input type="checkbox" name="nonStandard"> Niestandardowa</label>
          <label class="check wide"><input type="checkbox" name="codEnabled"> Pobranie <input name="codAmount" type="number" min="0" step=".01" placeholder="kwota PLN"></label>
          <label class="check wide"><input type="checkbox" name="insuranceEnabled"> Dodatkowa ochrona <input name="insuranceAmount" type="number" min="0" step=".01" placeholder="wartość PLN"></label>
          <label class="check" data-inpost-only="locker"><input type="checkbox" name="weekend"> Paczka w Weekend</label><label class="check" data-inpost-only="locker"><input type="checkbox" name="additionalServices" value="labelless"> Bez etykiety</label>
          <label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="sms"> SMS</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="email"> E-mail</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="saturday"> Sobota</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="dor1720"> 17:00–20:00</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label>
          <label class="wide">Uwagi<input name="comments" maxlength="100"></label>
        </div></fieldset>
        <fieldset class="inpost-billing-card"><legend>💰 Koszt i rozliczenie</legend>
          <div class="inpost-pricing-layout"><div data-inpost-pricing></div><div class="inpost-pricing-controls"><label>Koszt ręczny — tylko gdy ShipX nie zwróci ceny<input name="carrierCostOverride" type="number" min="0" step=".01" placeholder="opcjonalnie"></label><button class="btn ghost" type="button" onclick="inpostServiceWycena(this.form,true)">↻ Sprawdź koszt teraz</button></div></div>
          <div class="inpost-form-grid"><label>Sposób rozliczenia<select name="billingMode"><option value="none">Bez faktury</option><option value="single">FV od razu</option><option value="monthly">FV miesięczna</option></select></label><label>Miesiąc<input name="billingMonth" type="month" value="${esc(month)}"></label><label>Prowizja brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(fee)}"></label></div>
          <div class="backend-note"><b>Wycena nie tworzy przesyłki.</b> Kwota pochodzi z endpointu ShipX dla Twojej umowy. Jeśli konto abonamentowe nie udostępnia ceny, panel jasno to pokaże i pozwoli wpisać koszt ręczny.</div>
        </fieldset>
      </div>
      <div class="inpost-create-footer"><button class="btn" type="submit">🟡 Utwórz przesyłkę InPost</button><small>Adresy, wycena, numer nadania, tracking i etykieta pozostają w jednym rejestrze.</small></div>
    </form>
  </section>`;
}
function inpostServiceKosztHTML(item={}){
  const pricing=item.pricing||{},amount=inpostServiceWycenaKwota(pricing);
  if(amount==null)return '<span class="lvl lvl-ostrzezenie">cena niedostępna</span>';
  return `<b>${zl(amount)}</b><br><small>${pricing.source==="manual"?"ręcznie":"InPost"} • z prowizją ${zl(pricing.customerTotalGross??amount+(item.billing?.commissionGross||0))}</small>`;
}
function inpostServiceHistoriaHTML(){
  const rows=inpostServiceLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(inpostServiceSzukaj)}" placeholder="Numer nadania, klient, NIP, e-mail, punkt lub referencja…" oninput="inpostServiceSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="inpostServiceFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie statusy</option>${[["label_ready","Etykieta gotowa"],["created","Utworzone"],["error","Błędy"],["cancelled","Anulowane"]].map(([v,l])=>`<option value="${v}" ${inpostServiceFiltr===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Rozliczenie<select onchange="inpostServiceBillingFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie</option><option value="oczekuje" ${inpostServiceBillingFiltr==="oczekuje"?"selected":""}>Do FV miesięcznej</option><option value="rozliczone" ${inpostServiceBillingFiltr==="rozliczone"?"selected":""}>W inFakt</option><option value="bez" ${inpostServiceBillingFiltr==="bez"?"selected":""}>Bez faktury</option></select></label>`;
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr operacyjny</span><h2>Nadania, koszty i rozliczenia</h2><p class="order-detail-lead">Pełny ślad: strony przesyłki, koszt, tracking, etykieta, odbiór i faktura.</p></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Filtry obejmują wszystkie dane nadania.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table"><thead><tr><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Koszt</th><th>Status</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(item=>`<tr data-stable-key="${esc(item.id)}"><td><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td><td><b>${esc(inpostServiceNazwaKontaktu(item.receiver))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.receiver))}</small><br><small>${esc(item.receiver?.email||"")}</small></td><td>${item.deliveryType==="locker"?"📮 Paczkomat":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td><td>${inpostServiceKosztHTML(item)}</td><td>${inpostServiceStatusLabel(item)}<br><small>${esc(item.inpostStatus||"")}</small></td><td>${inpostServiceBillingLabel(item)}<br><small>prowizja ${zl(item.billing?.commissionGross||0)}</small></td><td><div class="inpost-row-actions"><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.pickupRequested&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">Odbiór</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="7">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function panelWysylkiUslugowejInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram książkę adresową, konfigurację i rejestr nadań…</div></div>';
  setTimeout(()=>{const form=document.getElementById("inpostServiceForm");inpostServiceUstawTyp(form);inpostServiceAktualizujWyceneUI(form);},0);
  const billing=inpostServiceStan.billing||{},priced=(inpostServiceStan.items||[]).filter(item=>inpostServiceWycenaKwota(item.pricing)!=null);
  return `<div class="inpost-service-workspace"><section class="inpost-service-stats"><article><span>📦</span><b>${inpostServiceStan.items.length}</b><small>nadań</small></article><article><span>📒</span><b>${inpostServiceStan.addressBook?.length||0}</b><small>zapisanych adresów</small></article><article><span>💰</span><b>${priced.length}</b><small>nadań z kosztem</small></article><article><span>🧾</span><b>${billing.pendingMonthly||0}</b><small>do FV miesięcznej</small></article></section>${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceFormHTML()}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}<details class="panel inpost-service-settings"><summary>⚙️ Domyślny nadawca i prowizja</summary><form onsubmit="inpostServiceZapiszUstawienia(event)">${inpostServiceOsobaFields("sender","Stałe dane nadawcy",inpostServiceNadawca())}<div class="inpost-settings-footer"><label>Domyślna prowizja brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(inpostServiceStan.settings?.commissionGross??4)}"></label><button class="btn" type="submit">Zapisz ustawienia</button><a class="btn ghost" href="#/admin/infakt/wysylki">Rozliczenia inFakt</a></div></form></details></div>`;
}
