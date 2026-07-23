let inpostServiceWycenaTimer=0;
const inpostServiceKsiazkaStan={
  sender:{role:"sender",q:"",postCode:"",city:"",street:"",page:1,selectedKey:"",targetFormId:""},
  receiver:{role:"receiver",q:"",postCode:"",city:"",street:"",page:1,selectedKey:"",targetFormId:""},
};

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
function inpostServiceAdresNormal(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
}
function inpostServiceAdresUnikalne(values,limit=150){
  const map=new Map();
  values.forEach(value=>{const clean=String(value||"").trim(),key=inpostServiceAdresNormal(clean);if(clean&&key&&!map.has(key))map.set(key,clean);});
  return [...map.values()].sort((a,b)=>a.localeCompare(b,"pl")).slice(0,limit);
}
function inpostServiceAdresDane(contact={}){
  const address=contact.address||{};
  return {
    postCode:String(address.postCode||address.post_code||"").trim(),
    city:String(address.city||"").trim(),
    street:String(address.street||"").trim(),
  };
}
function inpostServiceRoleKontaktu(contact={},role="all"){
  return role==="all"||(contact.roles||[]).includes(role);
}
function inpostServiceAdresTekst(contact={}){
  return inpostServiceAdresNormal([
    inpostServiceNazwaKontaktu(contact),contact.companyName,contact.taxCode,contact.email,contact.phone,
    inpostServiceAdresKsiazki(contact),...(contact.roles||[]),
  ].filter(Boolean).join(" "));
}
function inpostServiceAdresWyniki(prefix){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  const q=inpostServiceAdresNormal(state.q),code=inpostServiceAdresNormal(state.postCode),city=inpostServiceAdresNormal(state.city),street=inpostServiceAdresNormal(state.street);
  return inpostServiceAdresy().filter(contact=>{
    const address=inpostServiceAdresDane(contact);
    return inpostServiceRoleKontaktu(contact,state.role)
      &&(!q||inpostServiceAdresTekst(contact).includes(q))
      &&(!code||inpostServiceAdresNormal(address.postCode).includes(code))
      &&(!city||inpostServiceAdresNormal(address.city).includes(city))
      &&(!street||inpostServiceAdresNormal(address.street).includes(street));
  });
}
function inpostServiceAdresPodpowiedzi(source,prefix){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  const codeN=inpostServiceAdresNormal(state.postCode),cityN=inpostServiceAdresNormal(state.city);
  const all=inpostServiceAdresy().filter(contact=>inpostServiceRoleKontaktu(contact,state.role)),byCode=all.filter(contact=>!codeN||inpostServiceAdresNormal(inpostServiceAdresDane(contact).postCode).includes(codeN));
  const byCity=byCode.filter(contact=>!cityN||inpostServiceAdresNormal(inpostServiceAdresDane(contact).city).includes(cityN));
  const options={
    PostCode:inpostServiceAdresUnikalne(all.map(contact=>inpostServiceAdresDane(contact).postCode),250),
    City:inpostServiceAdresUnikalne(byCode.map(contact=>inpostServiceAdresDane(contact).city)),
    Street:inpostServiceAdresUnikalne(byCity.map(contact=>inpostServiceAdresDane(contact).street),250),
  };
  Object.entries(options).forEach(([kind,values])=>{
    const list=document.getElementById(`inpostBook${prefix}${kind}Hints`);
    if(list)list.innerHTML=values.map(value=>`<option value="${esc(value)}"></option>`).join("");
  });
  inpostServiceRenderujKsiazke(prefix);
}
function inpostServiceRolaEtykieta(contact={}){
  const sender=(contact.roles||[]).includes("sender"),receiver=(contact.roles||[]).includes("receiver");
  if(sender&&receiver)return '<span class="inpost-role both">Nadawca i odbiorca</span>';
  if(sender)return '<span class="inpost-role sender">Nadawca</span>';
  return '<span class="inpost-role receiver">Odbiorca</span>';
}
function inpostServiceRenderujKsiazke(prefix){
  const layer=document.getElementById("inpostAddressBookModal");if(!layer||layer.dataset.prefix!==prefix)return;
  const state=inpostServiceKsiazkaStan[prefix],matches=inpostServiceAdresWyniki(prefix),pageSize=20,pages=Math.max(1,Math.ceil(matches.length/pageSize));
  state.page=Math.min(Math.max(1,Number(state.page)||1),pages);
  const page=matches.slice((state.page-1)*pageSize,state.page*pageSize),selected=inpostServiceAdresy().find(item=>String(item.key)===String(state.selectedKey));
  layer.querySelectorAll("[data-inpost-book-role]").forEach(button=>button.classList.toggle("active",button.dataset.inpostBookRole===state.role));
  const count=layer.querySelector("[data-inpost-book-count]");if(count)count.textContent=`${matches.length} ${matches.length===1?"adres":matches.length<5?"adresy":"adresów"}`;
  const list=layer.querySelector("[data-inpost-book-results]");
  if(list)list.innerHTML=page.map(contact=>`<button class="inpost-book-contact ${String(contact.key)===String(state.selectedKey)?"selected":""}" type="button" onclick="inpostServiceKsiazkaZaznacz(${jsArg(prefix)},${jsArg(contact.key)})"><span class="inpost-book-avatar">${esc((inpostServiceNazwaKontaktu(contact).match(/[A-Za-zĄĆĘŁŃÓŚŹŻ]/i)?.[0]||"A").toUpperCase())}</span><span class="inpost-book-contact-main"><span class="inpost-contact-card-head"><b>${esc(inpostServiceNazwaKontaktu(contact))}</b>${inpostServiceRolaEtykieta(contact)}</span><span>${esc(inpostServiceAdresKsiazki(contact)||"Brak pełnego adresu")}</span><small>${esc([contact.taxCode?`NIP ${contact.taxCode}`:"",contact.phone,contact.email].filter(Boolean).join(" • "))}</small></span><span class="inpost-book-check">✓</span></button>`).join("")||'<div class="inpost-address-empty"><b>Brak pasujących adresów</b><small>Zmień filtry albo dodaj nowy adres.</small></div>';
  const preview=layer.querySelector("[data-inpost-book-preview]");
  if(preview)preview.innerHTML=selected?`<span class="order-pro-label">Wybrany kontakt</span><h3>${esc(inpostServiceNazwaKontaktu(selected))}</h3>${inpostServiceRolaEtykieta(selected)}<dl><div><dt>Adres</dt><dd>${esc(inpostServiceAdresKsiazki(selected)||"brak")}</dd></div><div><dt>Telefon</dt><dd>${esc(selected.phone||"—")}</dd></div><div><dt>E-mail</dt><dd>${esc(selected.email||"—")}</dd></div>${selected.taxCode?`<div><dt>NIP</dt><dd>${esc(selected.taxCode)}</dd></div>`:""}</dl>`:'<div class="inpost-book-preview-empty"><span>📒</span><b>Wybierz kontakt</b><small>Tutaj zobaczysz komplet danych przed użyciem adresu.</small></div>';
  const pager=layer.querySelector("[data-inpost-book-pager]");
  if(pager)pager.innerHTML=`<button class="btn ghost" type="button" onclick="inpostServiceKsiazkaStrona(${jsArg(prefix)},-1)" ${state.page<=1?"disabled":""}>← Poprzednia</button><span>Strona <b>${state.page}</b> z ${pages}</span><button class="btn ghost" type="button" onclick="inpostServiceKsiazkaStrona(${jsArg(prefix)},1)" ${state.page>=pages?"disabled":""}>Następna →</button>`;
  const use=layer.querySelector("[data-inpost-book-use]");if(use)use.disabled=!selected;
}
function inpostServiceKsiazkaFiltr(prefix,role,button){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  state.role=["sender","receiver","all"].includes(role)?role:prefix;state.page=1;
  const selected=inpostServiceAdresy().find(item=>String(item.key)===String(state.selectedKey));
  if(selected&&!inpostServiceRoleKontaktu(selected,state.role))state.selectedKey="";
  inpostServiceAdresPodpowiedzi(null,prefix);
}
function inpostServiceKsiazkaSzukaj(input,prefix){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  state.q=String(input?.value||"");state.page=1;
  inpostServiceRenderujKsiazke(prefix);
}
function inpostServiceKsiazkaPole(input,prefix,key){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  if(["postCode","city","street"].includes(key))state[key]=String(input?.value||"");
  state.page=1;inpostServiceAdresPodpowiedzi(null,prefix);
}
function inpostServiceKsiazkaStrona(prefix,change){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;state.page=Math.max(1,(Number(state.page)||1)+Number(change||0));inpostServiceRenderujKsiazke(prefix);
}
function inpostServiceKsiazkaZaznacz(prefix,key){const state=inpostServiceKsiazkaStan[prefix];state.selectedKey=String(key||"");inpostServiceRenderujKsiazke(prefix);}
function inpostServiceKsiazkaForm(prefix){
  const state=inpostServiceKsiazkaStan[prefix]||{};return document.getElementById(state.targetFormId)||document.getElementById("inpostServiceForm");
}
function inpostServiceZamknijKsiazke(){document.getElementById("inpostAddressBookModal")?.remove();document.body.classList.remove("has-dialog");}
function inpostServiceOtworzKsiazke(prefix,source=null){
  const form=source?.closest?.("form")||document.getElementById("inpostServiceForm");if(!form)return;
  if(!form.id)form.id=`inpostServiceForm${Date.now()}`;
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  state.targetFormId=form.id;state.role=prefix;state.page=1;state.selectedKey=String(form.elements[`${prefix}ContactId`]?.value||"");
  document.getElementById("inpostAddressBookModal")?.remove();
  const layer=document.createElement("div");layer.id="inpostAddressBookModal";layer.className="inpost-book-modal-layer";layer.dataset.prefix=prefix;
  layer.innerHTML=`<button class="inpost-book-backdrop" type="button" onclick="inpostServiceZamknijKsiazke()" aria-label="Zamknij książkę adresową"></button><section class="inpost-book-dialog" role="dialog" aria-modal="true" aria-labelledby="inpostBookTitle"><header><div><span class="order-pro-label">Książka adresowa InPost</span><h2 id="inpostBookTitle">Wybierz ${prefix==="sender"?"nadawcę":"odbiorcę"}</h2></div><div class="diag-actions"><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres(${jsArg(prefix)},this)">＋ Nowy adres</button><button class="inpost-book-close" type="button" onclick="inpostServiceZamknijKsiazke()" aria-label="Zamknij">✕</button></div></header><div class="inpost-book-toolbar"><div class="inpost-address-tabs"><button type="button" data-inpost-book-role="sender" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'sender',this)">Nadawcy</button><button type="button" data-inpost-book-role="receiver" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'receiver',this)">Odbiorcy</button><button type="button" data-inpost-book-role="all" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'all',this)">Wszyscy</button></div><label class="inpost-address-main-search"><span>🔎</span><input type="search" value="${esc(state.q)}" placeholder="Firma, osoba, NIP, telefon, e-mail lub adres…" oninput="inpostServiceKsiazkaSzukaj(this,${jsArg(prefix)})"></label><div class="inpost-address-search-fields"><label>Kod pocztowy<input list="inpostBook${prefix}PostCodeHints" value="${esc(state.postCode)}" placeholder="00-000" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'postCode')"><datalist id="inpostBook${prefix}PostCodeHints"></datalist></label><label>Miejscowość<input list="inpostBook${prefix}CityHints" value="${esc(state.city)}" placeholder="Wpisz miejscowość" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'city')"><datalist id="inpostBook${prefix}CityHints"></datalist></label><label>Ulica<input list="inpostBook${prefix}StreetHints" value="${esc(state.street)}" placeholder="Wpisz ulicę" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'street')"><datalist id="inpostBook${prefix}StreetHints"></datalist></label></div></div><div class="inpost-book-content"><div class="inpost-book-list-panel"><div class="inpost-address-match-head"><b data-inpost-book-count></b><small>Kliknij kontakt, aby zobaczyć szczegóły</small></div><div class="inpost-book-results" data-inpost-book-results></div><div class="inpost-book-pager" data-inpost-book-pager></div></div><aside class="inpost-book-preview" data-inpost-book-preview></aside></div><footer><button class="btn ghost" type="button" onclick="inpostServiceZamknijKsiazke()">Anuluj</button><button class="btn" type="button" data-inpost-book-use onclick="inpostServiceKsiazkaZatwierdz(${jsArg(prefix)})">Użyj wybranego adresu</button></footer></section>`;
  layer.addEventListener("keydown",event=>{if(event.key==="Escape")inpostServiceZamknijKsiazke();});
  document.body.appendChild(layer);document.body.classList.add("has-dialog");inpostServiceAdresPodpowiedzi(null,prefix);requestAnimationFrame(()=>layer.querySelector('input[type="search"]')?.focus());
}
function inpostServiceKsiazkaZatwierdz(prefix){
  const state=inpostServiceKsiazkaStan[prefix];if(!state?.selectedKey)return;
  inpostServiceWybierzAdresWynik(prefix,state.selectedKey,state.targetFormId);inpostServiceZamknijKsiazke();
}
function inpostServiceNowyAdres(prefix,source=null){
  const form=source?.closest?.("form")||inpostServiceKsiazkaForm(prefix);if(!form)return;
  inpostServiceZamknijKsiazke();
  if(form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value="";
  inpostServiceUstawPolaOsoby(form,prefix,{roles:[prefix]});
  toast(`Nowy adres ${prefix==="sender"?"nadawcy":"odbiorcy"}`);
}
function inpostServiceWybierzAdresWynik(prefix,key,targetFormId=""){
  const form=document.getElementById(targetFormId)||inpostServiceKsiazkaForm(prefix),contact=inpostServiceAdresy().find(item=>String(item.key)===String(key));if(!form||!contact)return;
  const hidden=form.elements[`${prefix}ContactId`];
  if(hidden)hidden.value=contact.stored?contact.id:"";
  inpostServiceUstawPolaOsoby(form,prefix,contact);
  inpostServiceAdresPodpowiedzi(form,prefix);
  inpostServiceZaplanujWycene(form);
  toast(`Wybrano adres ${prefix==="sender"?"nadawcy":"odbiorcy"} ✅`);
}
function inpostServiceUstawPolaOsoby(form,prefix,contact={}){
  const address=contact.address||{},roles=Array.isArray(contact.roles)?contact.roles:[prefix],fields={
    [`${prefix}Company`]:contact.companyName,[`${prefix}TaxCode`]:contact.taxCode,
    [`${prefix}FirstName`]:contact.firstName,[`${prefix}LastName`]:contact.lastName,
    [`${prefix}Email`]:contact.email,[`${prefix}Phone`]:contact.phone,
    [`${prefix}Street`]:address.street,[`${prefix}Building`]:address.buildingNumber||address.building_number,
    [`${prefix}Flat`]:address.flatNumber||address.flat_number,
    [`${prefix}PostCode`]:address.postCode||address.post_code,[`${prefix}City`]:address.city,
  };
  Object.entries(fields).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value||"";});
  if(form.elements[`${prefix}RoleSender`])form.elements[`${prefix}RoleSender`].checked=roles.includes("sender");
  if(form.elements[`${prefix}RoleReceiver`])form.elements[`${prefix}RoleReceiver`].checked=roles.includes("receiver");
  const summary=form.querySelector(`[data-inpost-selected-contact="${prefix}"]`);
  if(summary)summary.innerHTML=inpostServiceWybranyKontaktHTML(contact,prefix);
  inpostServiceAdresPodpowiedzi(form,prefix);
}
function inpostServiceWybranyKontaktHTML(contact={},prefix="receiver"){
  const hasData=!!(contact.id||contact.companyName||contact.firstName||contact.lastName||contact.email||contact.phone||inpostServiceAdresKsiazki(contact));
  if(!hasData)return `<span class="inpost-selected-icon">＋</span><span><b>Nie wybrano ${prefix==="sender"?"nadawcy":"odbiorcy"}</b><small>Wybierz zapisany kontakt albo wpisz nowy adres.</small></span>`;
  return `<span class="inpost-selected-icon">${prefix==="sender"?"📤":"📥"}</span><span><b>${esc(inpostServiceNazwaKontaktu(contact))}</b><small>${esc(inpostServiceAdresKsiazki(contact)||[contact.email,contact.phone].filter(Boolean).join(" • ")||"Adres do uzupełnienia")}</small></span>${inpostServiceRolaEtykieta(contact)}`;
}
function inpostServicePunktOpis(point={}){
  const distance=Number(point.distance);
  return [opisPunktuInpost(point),Number.isFinite(distance)?`${distance<1000?Math.round(distance)+" m":(distance/1000).toFixed(1).replace(".",",")+" km"}`:"",point.location247?"czynny 24/7":point.openingHours].filter(Boolean).join(" • ");
}
async function inpostServicePobierzPunkty(params={},caption=""){
  const box=document.getElementById("inpostServicePointResults");if(box)box.innerHTML="<small>Szukam najbliższych punktów InPost…</small>";
  try{
    const d=await chmura("inpost-points",{params:{limit:15,...params},timeout:15000}),points=d.points||[];
    if(box)box.innerHTML=`${caption?`<div class="inpost-point-caption">${esc(caption)}</div>`:""}${points.map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))})"><b>${esc(point.name)}</b><span>${esc(inpostServicePunktOpis(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów dla tego adresu.</small>"}`;
  }catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
async function inpostServiceSzukajPunktow(){
  const query=String(document.getElementById("inpostServicePointSearch")?.value||"").trim();
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  return inpostServicePobierzPunkty(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query},`Wyniki dla: ${query}`);
}
async function inpostServiceSzukajPunktowPrzyAdresie(prefix="receiver"){
  const form=document.getElementById("inpostServiceForm");if(!form)return;
  const postCode=String(form.elements[`${prefix}PostCode`]?.value||"").trim(),city=String(form.elements[`${prefix}City`]?.value||"").trim(),street=String(form.elements[`${prefix}Street`]?.value||"").trim();
  if(!postCode&&!city)return toast("Najpierw wpisz kod pocztowy albo miejscowość odbiorcy");
  const query=[street,postCode,city].filter(Boolean).join(", "),input=document.getElementById("inpostServicePointSearch");if(input)input.value=query;
  return inpostServicePobierzPunkty(postCode?{post_code:postCode,city}:{city},`Najbliższe punkty względem adresu: ${query}`);
}
function inpostServiceOdswiezSelektory(form,selectedId=""){
  ["sender","receiver"].forEach(prefix=>{
    if(prefix===form?.dataset.lastSavedRole&&selectedId&&form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value=selectedId;
    inpostServiceAdresPodpowiedzi(form,prefix);
  });
}
async function inpostServiceZapiszKontakt(prefix,button=null){
  const form=button?.closest("form")||document.getElementById("inpostServiceForm");if(!form)return;
  const contact=inpostServiceStronaOsoby(form,prefix),id=form.elements[`${prefix}ContactId`]?.value||"";
  contact.roles=[form.elements[`${prefix}RoleSender`]?.checked?"sender":"",form.elements[`${prefix}RoleReceiver`]?.checked?"receiver":""].filter(Boolean);
  if(!contact.roles.length)return toast("Zaznacz rolę: nadawca, odbiorca albo obie");
  contact.id=id;contact.label=contact.companyName||`${contact.firstName} ${contact.lastName}`.trim()||contact.email;
  try{
    const d=await chmura("inpost-service-contact-save",{method:"POST",body:{role:prefix,contact},timeout:20000});
    inpostServiceStan.addressBook=Array.isArray(d.addressBook)?d.addressBook:inpostServiceStan.addressBook;
    form.dataset.lastSavedRole=prefix;
    if(form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value=d.contact?.id||id;
    if(d.contact)inpostServiceUstawPolaOsoby(form,prefix,d.contact);
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
    inpostServiceUstawPolaOsoby(form,prefix,{roles:[prefix]});
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
    box.innerHTML=`<div class="inpost-price-empty warning"><b>Brak pasującej stawki w cenniku umownym</b><small>${esc(pricing.message||"Uzupełnij właściwą stawkę w cenniku albo podaj pełny koszt ręcznie. ShipX pozostaje wyłącznie kontrolą porównawczą.")}</small></div>`;
    return;
  }
  const customer=Math.round((total+fee)*100)/100,b=pricing.breakdown||{},source=pricing.source==="manual"?"pełny koszt wpisany ręcznie":"Twój cennik umowny";
  const api=pricing.apiComparison||{},difference=Number.isFinite(Number(api.differenceGross))?Number(api.differenceGross):null;
  box.innerHTML=`<div class="inpost-price-main"><span><small>Koszt nadania</small><strong>${zl(total)}</strong></span><span><small>Prowizja Artway-TM</small><strong>${zl(fee)}</strong></span><span class="total"><small>Kwota na FV klienta</small><strong>${zl(customer)}</strong></span></div>
    <div class="inpost-price-meta"><span class="lvl ${pricing.complete?"lvl-ok":"lvl-ostrzezenie"}">${esc(source)}</span><small>${esc(pricing.rateLabel||"stawka indywidualna")}</small>${Number(b.extrasGross)>0?`<small>Dopłaty: ${zl(b.extrasGross)}</small>`:""}<small>Opłata paliwowa: w cenie</small></div>
    ${pricing.complete?"":`<div class="inpost-price-warning"><b>Niepełna wycena opcji dodatkowych:</b> ${esc((pricing.unpricedOptions||[]).join(", ")||"brak stawki")}. Uzupełnij dopłaty w cenniku albo wpisz pełny koszt ręcznie — do tego czasu FV jest zablokowana.</div>`}
    <div class="inpost-api-comparison"><span><b>Kontrola ShipX:</b> ${api.totalGross==null?"brak ceny API":zl(api.totalGross)}</span>${difference==null?"":`<span>Różnica: ${difference>0?"+":""}${zl(difference)}</span>`}</div>`;
}
function inpostServiceLokalnaWycena(form){
  const list=inpostServiceStan.settings?.priceList||{},type=String(form?.deliveryType?.value||"locker"),weight=Number(form?.weight?.value)||0,template=String(form?.template?.value||"");
  let rate=null,rateKey="";
  if(type==="locker"){
    let size=template;
    if(!size){
      const dimensions=[form?.length?.value,form?.width?.value,form?.height?.value].map(Number).sort((a,b)=>b-a);
      if(dimensions[0]<=64&&dimensions[1]<=38){if(dimensions[2]<=8)size="small";else if(dimensions[2]<=19)size="medium";else if(dimensions[2]<=41)size="large";}
    }
    rate=list.locker?.[size]||null;rateKey=size?`locker.${size}`:"";
  }else{
    rate=(list.courierStandard||[]).find(item=>weight<=Number(item.maxKg))||null;rateKey=rate?`courierStandard.${rate.maxKg}`:"";
  }
  const selected=[],extras=list.extras||{};
  if(form?.codEnabled?.checked)selected.push(["Pobranie","codGross"]);
  if(form?.insuranceEnabled?.checked)selected.push(["Dodatkowa ochrona","insuranceGross"]);
  if(form?.weekend?.checked)selected.push(["Paczka w Weekend","weekendGross"]);
  if(form?.pickupRequested?.checked||form?.sendingMethod?.value==="dispatch_order")selected.push(["Odbiór przez kuriera","pickupGross"]);
  if(form?.nonStandard?.checked)selected.push(["Element niestandardowy","nonStandardGross"]);
  form?.querySelectorAll('[name="additionalServices"]:checked').forEach(input=>{const labels={sms:["Powiadomienie SMS","smsGross"],email:["Powiadomienie e-mail","emailGross"],saturday:["Doręczenie w sobotę","saturdayGross"],dor1720:["Doręczenie 17:00–20:00","dor1720Gross"],rod:["Zwrot dokumentów","rodGross"]};if(labels[input.value])selected.push(labels[input.value]);});
  const unpricedOptions=selected.filter(([,key])=>extras[key]==null||extras[key]==="").map(([label])=>label),extrasGross=selected.reduce((sum,[,key])=>sum+(extras[key]==null||extras[key]===""?0:Number(extras[key])||0),0);
  const totalGross=rate?Math.round((Number(rate.gross||0)+extrasGross)*100)/100:null,fee=Math.max(0,Number(String(form?.commissionGross?.value||0).replace(",","."))||0);
  return {totalGross,currency:"PLN",source:rate?"contract_price_list":"unavailable",available:totalGross!=null,complete:totalGross!=null&&unpricedOptions.length===0,rateKey,rateLabel:rate?.label||"",contractNet:rate?.net??null,commissionGross:fee,customerTotalGross:totalGross==null?null:Math.round((totalGross+fee)*100)/100,breakdown:{baseGross:rate?.gross??null,extrasGross:Math.round(extrasGross*100)/100,fuelIncluded:true},unpricedOptions,apiComparison:inpostServiceStan.pricing?.apiComparison||{totalGross:null},checkedAt:new Date().toISOString()};
}
function inpostServicePrzelicz(form){
  const manual=Math.max(0,Number(String(form?.carrierCostOverride?.value||"").replace(",","."))||0),fee=Math.max(0,Number(String(form?.commissionGross?.value||0).replace(",","."))||0);
  if(manual>0)inpostServiceStan.pricing={totalGross:manual,commissionGross:fee,customerTotalGross:Math.round((manual+fee)*100)/100,currency:"PLN",source:"manual",estimated:false,available:true,complete:true,breakdown:{},unpricedOptions:[],apiComparison:{totalGross:null}};
  else inpostServiceStan.pricing=inpostServiceLokalnaWycena(form);
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
    inpostServicePrzelicz(form);return;
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
    <input type="hidden" name="${prefix}ContactId" value="${esc(selected)}">
    <div class="inpost-contact-selector">
      <div class="inpost-selected-contact" data-inpost-selected-contact="${prefix}">${inpostServiceWybranyKontaktHTML(person,prefix)}</div>
      <div class="inpost-contact-selector-actions">
        <button class="btn" type="button" onclick="inpostServiceOtworzKsiazke(${jsArg(prefix)},this)">📒 Wybierz z książki</button>
        <button class="btn ghost" type="button" onclick="inpostServiceNowyAdres(${jsArg(prefix)},this)">＋ Nowy adres</button>
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
      ${prefix==="receiver"?'<button class="btn ghost wide" type="button" onclick="inpostServiceSzukajPunktowPrzyAdresie(\'receiver\')">📍 Znajdź Paczkomaty przy tym adresie</button>':""}
      <div class="inpost-contact-roles wide"><b>Używaj tego adresu jako</b><label><input type="checkbox" name="${prefix}RoleSender" ${prefix==="sender"?"checked":""}> Nadawca</label><label><input type="checkbox" name="${prefix}RoleReceiver" ${prefix==="receiver"?"checked":""}> Odbiorca</label></div>
      <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt(${jsArg(prefix)},this)">💾 Zapisz w książce</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt(${jsArg(prefix)},this)">Usuń zapis</button></div>
      <label class="check wide"><input type="checkbox" name="save${prefix==="sender"?"Sender":"Receiver"}" checked> Zapamiętaj lub zaktualizuj ten adres po utworzeniu przesyłki</label>
    </div>
  </fieldset>`;
}
function inpostServiceCennikWiersze(title,prefix,rates={}){
  return `<tr class="inpost-rate-section"><th colspan="3">${esc(title)}</th></tr>${Object.entries(rates).map(([key,rate])=>`<tr><td>${esc(rate.label||key)}</td><td><label><span class="sr-only">Netto ${esc(rate.label||key)}</span><input name="price_${prefix}_${key}_net" type="number" min="0" step=".01" value="${esc(rate.net??0)}"></label></td><td><label><span class="sr-only">Brutto ${esc(rate.label||key)}</span><input name="price_${prefix}_${key}_gross" type="number" min="0" step=".01" value="${esc(rate.gross??0)}"></label></td></tr>`).join("")}`;
}
function inpostServiceCennikHTML(){
  const list=inpostServiceStan.settings?.priceList||{},courier=Array.isArray(list.courierStandard)?list.courierStandard:[];
  const extras=[["codGross","Pobranie"],["insuranceGross","Dodatkowa ochrona"],["weekendGross","Paczka w Weekend"],["pickupGross","Odbiór przez kuriera"],["smsGross","SMS"],["emailGross","E-mail"],["saturdayGross","Doręczenie w sobotę"],["dor1720Gross","Doręczenie 17:00–20:00"],["rodGross","Zwrot dokumentów"],["nonStandardGross","Element niestandardowy"]];
  return `<section class="inpost-contract-editor">
    <div class="order-section-head"><div><span class="order-pro-label">Koszty operacyjne</span><h3>Stawki InPost</h3></div><span class="lvl lvl-ok">aktywne</span></div>
    <div class="warehouse-worktable-wrap"><table class="log-table inpost-contract-table"><thead><tr><th>Usługa / przedział</th><th>Netto z paliwem</th><th>Brutto</th></tr></thead><tbody>
      ${inpostServiceCennikWiersze("Paczkomat® 24/7","locker",list.locker||{})}
      <tr class="inpost-rate-section"><th colspan="3">Kurier Standard</th></tr>
      ${courier.map((rate,index)=>`<tr><td>${esc(rate.label||`do ${rate.maxKg} kg`)}</td><td><input name="price_courier_${index}_net" type="number" min="0" step=".01" value="${esc(rate.net??0)}"></td><td><input name="price_courier_${index}_gross" type="number" min="0" step=".01" value="${esc(rate.gross??0)}"></td></tr>`).join("")}
      ${inpostServiceCennikWiersze("Kurier Manager Paczek","courierManager",list.courierManager||{})}
      ${inpostServiceCennikWiersze("Podaj dalej","handoff",list.handoff||{})}
      ${inpostServiceCennikWiersze("Szybkie zwroty","quickReturns",list.quickReturns||{})}
    </tbody></table></div>
    <details class="inpost-extra-rates"><summary>Dopłaty do usług dodatkowych</summary><div class="inpost-extra-grid">${extras.map(([key,label])=>`<label>${esc(label)}<input name="extra_${key}" type="number" min="0" step=".01" value="${list.extras?.[key]??""}" placeholder="stawka brutto"></label>`).join("")}</div></details>
  </section>`;
}
function inpostServiceCennikZForm(form){
  const current=inpostServiceStan.settings?.priceList||{},read=(name,fallback=null)=>{const raw=form.elements[name]?.value;if(raw==null||String(raw).trim()==="")return fallback;const value=Number(String(raw).replace(",","."));return Number.isFinite(value)?value:fallback;};
  const readGroup=(prefix,source={})=>Object.fromEntries(Object.entries(source).map(([key,rate])=>[key,{...rate,net:read(`price_${prefix}_${key}_net`,rate.net),gross:read(`price_${prefix}_${key}_gross`,rate.gross)}]));
  const extras={};["codGross","insuranceGross","weekendGross","pickupGross","smsGross","emailGross","saturdayGross","dor1720Gross","rodGross","nonStandardGross"].forEach(key=>{extras[key]=read(`extra_${key}`,null);});
  return {...current,locker:readGroup("locker",current.locker),courierStandard:(current.courierStandard||[]).map((rate,index)=>({...rate,net:read(`price_courier_${index}_net`,rate.net),gross:read(`price_courier_${index}_gross`,rate.gross)})),courierManager:readGroup("courierManager",current.courierManager),handoff:readGroup("handoff",current.handoff),quickReturns:readGroup("quickReturns",current.quickReturns),extras};
}
async function inpostServiceZapiszUstawienia(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),body={commissionGross:form.commissionGross.value,sender:inpostServiceStronaOsoby(form,"sender"),priceList:inpostServiceCennikZForm(form)};
  if(button){button.disabled=true;button.textContent="Zapisuję cennik…";}
  try{const d=await chmura("inpost-service-settings",{method:"POST",body,timeout:30000});inpostServiceStan.settings=d.settings||inpostServiceStan.settings;inpostServiceStan.pricing=null;toast("Cennik umowny, nadawca i prowizja zapisane ✅");renderuj();}catch(e){toast("Nie zapisano ustawień: "+(e.message||e));}
  finally{if(button){button.disabled=false;button.textContent="Zapisz cennik i ustawienia";}}
}
function inpostServiceFormHTML(){
  const sender=inpostServiceNadawca(),fee=Number(inpostServiceStan.settings?.commissionGross??4),month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability;
  return `<section class="panel inpost-service-create">
    <div class="order-section-head"><div><span class="order-pro-label">Nadanie klienta</span><h2>Utwórz przesyłkę InPost</h2></div><div class="diag-actions"><span class="lvl ${available?.locker?"lvl-ok":"lvl-ostrzezenie"}">Paczkomat ${available?.locker?"aktywny":"sprawdź"}</span><span class="lvl ${available?.courier?"lvl-ok":"lvl-ostrzezenie"}">Kurier ${available?.courier?"aktywny":"sprawdź"}</span></div></div>
    <form id="inpostServiceForm" onsubmit="inpostServiceUtworz(event)" oninput="inpostServiceZaplanujWycene(this)" onchange="inpostServiceZaplanujWycene(this)">
      <input type="hidden" name="requestId" value="${esc(inpostServiceStan.requestId||inpostServiceNowyRequestId())}">
      <nav class="inpost-process-steps" aria-label="Etapy nadania"><a href="#inpost-party-sender"><b>1</b><span>Nadawca</span></a><a href="#inpost-party-receiver"><b>2</b><span>Odbiorca</span></a><a href="#inpost-shipment-options"><b>3</b><span>Usługa i paczka</span></a><a href="#inpost-settlement"><b>4</b><span>Koszt i faktura</span></a></nav>
      <div class="inpost-form-top"><label>Referencja<input name="reference" required value="USL-${Date.now().toString(36).toUpperCase()}"></label><div class="inpost-address-summary"><b>📒 Książka adresowa</b><span>${inpostServiceStan.addressBook?.length||0} adresów</span></div></div>
      <div class="inpost-parties-grid"><div id="inpost-party-sender">${inpostServiceOsobaFields("sender","Nadawca",sender)}</div><div id="inpost-party-receiver">${inpostServiceOsobaFields("receiver","Odbiorca",{})}</div></div>
      <div class="inpost-options-layout" id="inpost-shipment-options">
        <fieldset><legend>🚚 Usługa i nadanie</legend><div class="inpost-form-grid">
          <label>Rodzaj dostawy<select name="deliveryType" onchange="inpostServiceUstawTyp(this.form)"><option value="locker">Paczkomat / PaczkoPunkt</option><option value="courier">Kurier InPost</option></select></label>
          <label>Sposób nadania<select name="sendingMethod" onchange="inpostServiceUstawTyp(this.form)"><option value="parcel_locker">Paczkomat</option><option value="any_point">Dowolny punkt InPost</option><option value="pok">Punkt Obsługi Klienta</option><option value="pop">Punkt Obsługi Przesyłek</option><option value="branch">Oddział InPost</option><option value="dispatch_order">Odbiór przez kuriera</option></select></label>
          <div class="wide" data-inpost-only="locker"><label>Paczkomat / punkt odbiorcy *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" placeholder="np. BOJ01N"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape()">Mapa</button></div><small id="inpostServiceTargetPointLabel">Wybierz punkt na mapie albo wyszukaj poniżej.</small></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod pocztowy, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow()">Szukaj</button><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktowPrzyAdresie('receiver')">Przy adresie odbiorcy</button></div><div id="inpostServicePointResults"></div></div>
          <label>Punkt nadania (opcjonalnie)<input name="dropoffPoint" placeholder="kod punktu"></label>
          <label class="check" data-inpost-only="courier"><input type="checkbox" name="pickupRequested"> Zleć odbiór przez kuriera</label>
        </div></fieldset>
        <fieldset><legend>📦 Paczka i opcje</legend><div class="inpost-form-grid">
          <label>Gabaryt<select name="template"><option value="small">A / small</option><option value="medium">B / medium</option><option value="large">C / large</option><option value="">Wymiary własne</option></select></label>
          <label>Waga (kg)<input name="weight" type="number" min=".01" max="30" step=".01" value="1"><small>Kurier Standard: stawki do 30 kg</small></label>
          <label>Długość (cm)<input name="length" type="number" min="1" step=".1" value="30"></label><label>Szerokość (cm)<input name="width" type="number" min="1" step=".1" value="20"></label><label>Wysokość (cm)<input name="height" type="number" min="1" step=".1" value="15"></label>
          <label class="check"><input type="checkbox" name="nonStandard"> Niestandardowa</label>
          <label class="check wide"><input type="checkbox" name="codEnabled"> Pobranie <input name="codAmount" type="number" min="0" step=".01" placeholder="kwota PLN"></label>
          <label class="check wide"><input type="checkbox" name="insuranceEnabled"> Dodatkowa ochrona <input name="insuranceAmount" type="number" min="0" step=".01" placeholder="wartość PLN"></label>
          <label class="check" data-inpost-only="locker"><input type="checkbox" name="weekend"> Paczka w Weekend</label><label class="check" data-inpost-only="locker"><input type="checkbox" name="additionalServices" value="labelless"> Bez etykiety</label>
          <label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="sms"> SMS</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="email"> E-mail</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="saturday"> Sobota</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="dor1720"> 17:00–20:00</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label>
          <label class="wide">Uwagi<input name="comments" maxlength="100"></label>
        </div></fieldset>
        <fieldset class="inpost-billing-card" id="inpost-settlement"><legend>💰 Koszt i faktura Artway‑TM</legend>
          <div class="inpost-pricing-layout"><div data-inpost-pricing></div><div class="inpost-pricing-controls"><label>Pełny koszt ręczny — tylko awaryjnie<input name="carrierCostOverride" type="number" min="0" step=".01" placeholder="zastępuje cennik umowny"></label><button class="btn ghost" type="button" onclick="inpostServiceWycena(this.form,true)">↻ Przelicz według umowy</button><button class="btn ghost" type="button" onclick="document.querySelector('.inpost-service-settings')?.setAttribute('open','');document.querySelector('.inpost-service-settings')?.scrollIntoView({behavior:'smooth'})">Otwórz cennik</button></div></div>
          <div class="inpost-settlement-grid">
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="none" checked><span><b>Bez faktury</b><small>Tylko nadanie i rejestr kosztu</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="single"><span><b>FV od razu</b><small>Artway‑TM wystawia koszt nadania + prowizję</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="monthly"><span><b>FV miesięczna</b><small>Dopisz całe nadanie do rozliczenia klienta</small></span></label>
          </div>
          <div class="inpost-form-grid"><label>Miesiąc rozliczenia<input name="billingMonth" type="month" value="${esc(month)}"></label><label>Prowizja Artway‑TM brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(fee)}"></label></div>
          <div class="backend-note"><b>FV: Artway‑TM → nadawca.</b> Odbiorca pozostaje wyłącznie stroną doręczenia.</div>
        </fieldset>
      </div>
      <div class="inpost-create-footer"><button class="btn" type="submit">🟡 Utwórz przesyłkę InPost</button></div>
    </form>
  </section>`;
}
function inpostServiceKosztHTML(item={}){
  const pricing=item.pricing||{},amount=inpostServiceWycenaKwota(pricing);
  if(amount==null)return '<span class="lvl lvl-ostrzezenie">cena niedostępna</span>';
  return `<b>${zl(amount)}</b><br><small>${pricing.source==="manual"?"koszt ręczny":"cennik umowny"} • na FV ${zl(pricing.customerTotalGross??amount+(item.billing?.commissionGross||0))}</small>${pricing.complete===false?'<br><span class="lvl lvl-ostrzezenie">uzupełnij dopłaty</span>':""}`;
}
function inpostServiceHistoriaHTML(){
  const rows=inpostServiceLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(inpostServiceSzukaj)}" placeholder="Numer nadania, klient, NIP, e-mail, punkt lub referencja…" oninput="inpostServiceSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="inpostServiceFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie statusy</option>${[["label_ready","Etykieta gotowa"],["created","Utworzone"],["error","Błędy"],["cancelled","Anulowane"]].map(([v,l])=>`<option value="${v}" ${inpostServiceFiltr===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Rozliczenie<select onchange="inpostServiceBillingFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie</option><option value="oczekuje" ${inpostServiceBillingFiltr==="oczekuje"?"selected":""}>Do FV miesięcznej</option><option value="rozliczone" ${inpostServiceBillingFiltr==="rozliczone"?"selected":""}>W inFakt</option><option value="bez" ${inpostServiceBillingFiltr==="bez"?"selected":""}>Bez faktury</option></select></label>`;
  const row=item=>{
    const events=Array.isArray(item.trackingHistory)?item.trackingHistory:[];
    const label=item.labelReady?`${inpostServiceStatusLabel(item)}<br><small>${esc(inpostServiceStatusNazwa(item.inpostStatus))}</small>`:inpostServiceStatusLabel(item);
    return `<tr data-stable-key="${esc(item.id)}">
      <td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td>
      <td data-label="Odbiorca"><b>${esc(inpostServiceNazwaKontaktu(item.receiver))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.receiver))}</small><br><small>${esc(item.receiver?.email||"")}</small></td>
      <td data-label="Usługa">${item.deliveryType==="locker"?"📮 Paczkomat":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td>
      <td data-label="Koszt">${inpostServiceKosztHTML(item)}</td>
      <td data-label="Status">${label}<br><small>${events.length} zdarzeń • aktualizacja ${esc(inpostServiceDataPotwierdzenia(item.trackingUpdatedAt||item.updatedAt))}</small></td>
      <td data-label="Rozliczenie">${inpostServiceBillingLabel(item)}<br><small>FV klienta: ${item.billing?.mode==="none"?"—":zl(item.pricing?.customerTotalGross||0)}</small></td>
      <td data-label="Akcje"><div class="inpost-row-actions"><button class="btn receipt" onclick="inpostServicePotwierdzenie(${jsArg(item.id)})">🖨️ Potwierdzenie</button><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.pickupRequested&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">Odbiór</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" ${item.pricing?.complete===true?"":"disabled title='Uzupełnij koszt przesyłki'"} onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td>
    </tr>`;
  };
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr</span><h2>Nadania i tracking</h2></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Numer, klient, tracking lub rozliczenie.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Koszt</th><th>Status i historia</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(row).join("")||'<tr><td colspan="7">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function inpostServiceMiesieczneHTML(){
  const groups=inpostServiceStan.billing?.groups||[];if(!groups.length)return "";
  return `<section class="panel inpost-monthly-billing"><div class="order-section-head"><div><span class="order-pro-label">Faktury Artway‑TM</span><h2>Rozliczenia miesięczne</h2></div><a class="btn ghost" href="#/admin/infakt/wysylki">Otwórz w inFakt</a></div><div class="inpost-monthly-grid">${groups.map(group=>`<article><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small><small>Koszt nadań ${zl(group.carrierGross||0)} + prowizja ${zl(group.commissionGross||0)}</small>${group.incompletePrices?`<span class="lvl lvl-ostrzezenie">${group.incompletePrices} niepełnych wycen</span>`:""}</div><strong>${zl(group.customerTotalGross||0)}</strong><button class="btn" ${group.incompletePrices?"disabled title='Najpierw uzupełnij koszty'":""} onclick="inpostServiceFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz FV Artway‑TM</button></article>`).join("")}</div></section>`;
}
function panelWysylkiUslugowejInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram książkę adresową, konfigurację i rejestr nadań…</div></div>';
  setTimeout(()=>{const form=document.getElementById("inpostServiceForm");inpostServiceUstawTyp(form);inpostServiceAktualizujWyceneUI(form);inpostServiceAdresPodpowiedzi(form,"sender");inpostServiceAdresPodpowiedzi(form,"receiver");},0);
  const billing=inpostServiceStan.billing||{};
  return `<div class="inpost-service-workspace"><section class="inpost-service-stats"><article><span>📦</span><b>${inpostServiceStan.items.length}</b><small>nadań</small></article><article><span>📤</span><b>${inpostServiceAdresy().filter(c=>(c.roles||[]).includes("sender")).length}</b><small>nadawców</small></article><article><span>📥</span><b>${inpostServiceAdresy().filter(c=>(c.roles||[]).includes("receiver")).length}</b><small>odbiorców</small></article><article><span>🧾</span><b>${zl(billing.customerPendingGross||0)}</b><small>do FV miesięcznych</small></article></section>${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceFormHTML()}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}<details class="panel inpost-service-settings"><summary>⚙️ Stawki, domyślny nadawca i prowizja</summary><form id="inpostServiceSettingsForm" onsubmit="inpostServiceZapiszUstawienia(event)">${inpostServiceCennikHTML()}${inpostServiceOsobaFields("sender","Stałe dane nadawcy",inpostServiceNadawca())}<div class="inpost-settings-footer"><label>Domyślna prowizja Artway‑TM brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(inpostServiceStan.settings?.commissionGross??4)}"></label><button class="btn" type="submit">Zapisz ustawienia</button><a class="btn ghost" href="#/admin/infakt/wysylki">Rozliczenia inFakt</a></div></form></details></div>`;
}
