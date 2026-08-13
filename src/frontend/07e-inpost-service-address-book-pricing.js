let inpostServiceWycenaTimer=0,inpostServiceWycenaToken=0;
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
  const known=inpostServiceKlienci().map(contact=>({...contact,key:`client:${contact.key}`,stored:false,roles:["sender","receiver"]}));
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
  if(sender&&receiver)return '<span class="inpost-role both">Klient zlecający i odbiorca</span>';
  if(sender)return '<span class="inpost-role sender">Klient zlecający</span>';
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
  layer.innerHTML=`<button class="inpost-book-backdrop" type="button" onclick="inpostServiceZamknijKsiazke()" aria-label="Zamknij książkę adresową"></button><section class="inpost-book-dialog" role="dialog" aria-modal="true" aria-labelledby="inpostBookTitle"><header><div><span class="order-pro-label">Książka adresowa InPost</span><h2 id="inpostBookTitle">Wybierz ${prefix==="sender"?"klienta zlecającego":"odbiorcę"}</h2></div><div class="diag-actions"><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres(${jsArg(prefix)},this)">＋ Nowy adres</button><button class="inpost-book-close" type="button" onclick="inpostServiceZamknijKsiazke()" aria-label="Zamknij">✕</button></div></header><div class="inpost-book-toolbar"><div class="inpost-address-tabs"><button type="button" data-inpost-book-role="sender" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'sender',this)">Klienci zlecający</button><button type="button" data-inpost-book-role="receiver" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'receiver',this)">Odbiorcy</button><button type="button" data-inpost-book-role="all" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'all',this)">Wszyscy</button></div><label class="inpost-address-main-search"><span>🔎</span><input type="search" value="${esc(state.q)}" placeholder="Firma, osoba, NIP, telefon, e-mail lub adres…" oninput="inpostServiceKsiazkaSzukaj(this,${jsArg(prefix)})"></label><div class="inpost-address-search-fields"><label>Kod pocztowy<input list="inpostBook${prefix}PostCodeHints" value="${esc(state.postCode)}" placeholder="00-000" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'postCode')"><datalist id="inpostBook${prefix}PostCodeHints"></datalist></label><label>Miejscowość<input list="inpostBook${prefix}CityHints" value="${esc(state.city)}" placeholder="Wpisz miejscowość" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'city')"><datalist id="inpostBook${prefix}CityHints"></datalist></label><label>Ulica<input list="inpostBook${prefix}StreetHints" value="${esc(state.street)}" placeholder="Wpisz ulicę" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'street')"><datalist id="inpostBook${prefix}StreetHints"></datalist></label></div></div><div class="inpost-book-content"><div class="inpost-book-list-panel"><div class="inpost-address-match-head"><b data-inpost-book-count></b><small>Kliknij kontakt, aby zobaczyć szczegóły</small></div><div class="inpost-book-results" data-inpost-book-results></div><div class="inpost-book-pager" data-inpost-book-pager></div></div><aside class="inpost-book-preview" data-inpost-book-preview></aside></div><footer><button class="btn ghost" type="button" onclick="inpostServiceZamknijKsiazke()">Anuluj</button><button class="btn" type="button" data-inpost-book-use onclick="inpostServiceKsiazkaZatwierdz(${jsArg(prefix)})">Użyj wybranego adresu</button></footer></section>`;
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
  toast(`Nowy adres ${prefix==="sender"?"klienta zlecającego":"odbiorcy"}`);
}
function inpostServiceWybierzAdresWynik(prefix,key,targetFormId=""){
  const form=document.getElementById(targetFormId)||inpostServiceKsiazkaForm(prefix),contact=inpostServiceAdresy().find(item=>String(item.key)===String(key));if(!form||!contact)return;
  const hidden=form.elements[`${prefix}ContactId`];
  if(hidden)hidden.value=contact.stored?contact.id:"";
  inpostServiceUstawPolaOsoby(form,prefix,contact);
  inpostServiceAdresPodpowiedzi(form,prefix);
  inpostServiceZaplanujWycene(form);
  toast(`Wybrano adres ${prefix==="sender"?"klienta zlecającego":"odbiorcy"} ✅`);
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
  if(prefix==="sender")inpostServiceReferencja(form);
}
function inpostServiceWybranyKontaktHTML(contact={},prefix="receiver"){
  const hasData=!!(contact.id||contact.companyName||contact.firstName||contact.lastName||contact.email||contact.phone||inpostServiceAdresKsiazki(contact));
  if(!hasData)return `<span class="inpost-selected-icon">＋</span><span><b>Nie wybrano ${prefix==="sender"?"klienta zlecającego":"odbiorcy"}</b><small>Wybierz zapisany kontakt albo wpisz nowy adres.</small></span>`;
  return `<span class="inpost-selected-icon">${prefix==="sender"?"📤":"📥"}</span><span><b>${esc(inpostServiceNazwaKontaktu(contact))}</b><small>${esc(inpostServiceAdresKsiazki(contact)||[contact.email,contact.phone].filter(Boolean).join(" • ")||"Adres do uzupełnienia")}</small></span>${inpostServiceRolaEtykieta(contact)}`;
}
function inpostServicePunktOpis(point={}){
  const distance=Number(point.distance);
  return [opisPunktuInpost(point),Number.isFinite(distance)?`${distance<1000?Math.round(distance)+" m":(distance/1000).toFixed(1).replace(".",",")+" km"}`:"",point.location247?"czynny 24/7":point.openingHours].filter(Boolean).join(" • ");
}
function inpostServicePunktElementy(purpose="target"){
  if(purpose==="default-dropoff")return {search:"inpostServiceDefaultDropoffSearch",results:"inpostServiceDefaultDropoffResults"};
  if(purpose==="dropoff")return {search:"inpostServiceDropoffSearch",results:"inpostServiceDropoffResults"};
  return {search:"inpostServicePointSearch",results:"inpostServicePointResults"};
}
async function inpostServicePobierzPunkty(params={},caption="",purpose="target"){
  const ids=inpostServicePunktElementy(purpose),box=document.getElementById(ids.results);if(box)box.innerHTML="<small>Szukam najbliższych punktów InPost…</small>";
  try{
    const d=await chmura("inpost-points",{params:{limit:15,...params},timeout:15000}),points=d.points||[];
    if(box)box.innerHTML=`${caption?`<div class="inpost-point-caption">${esc(caption)}</div>`:""}${points.map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))},${jsArg(purpose)})"><b>${esc(point.name)}</b><span>${esc(inpostServicePunktOpis(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów dla tego adresu.</small>"}`;
  }catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
async function inpostServiceSzukajPunktow(purpose="target"){
  const ids=inpostServicePunktElementy(purpose),query=String(document.getElementById(ids.search)?.value||"").trim();
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  return inpostServicePobierzPunkty(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query},`Wyniki dla: ${query}`,purpose);
}
async function inpostServiceSzukajPunktowPrzyAdresie(prefix="receiver",purpose="target"){
  const form=document.getElementById("inpostServiceForm");if(!form)return;
  const postCode=String(form.elements[`${prefix}PostCode`]?.value||"").trim(),city=String(form.elements[`${prefix}City`]?.value||"").trim(),street=String(form.elements[`${prefix}Street`]?.value||"").trim();
  if(!postCode&&!city)return toast("Najpierw wpisz kod pocztowy albo miejscowość odbiorcy");
  const query=[street,postCode,city].filter(Boolean).join(", "),input=document.getElementById(purpose==="dropoff"?"inpostServiceDropoffSearch":"inpostServicePointSearch");if(input)input.value=query;
  return inpostServicePobierzPunkty(postCode?{post_code:postCode,city}:{city},`Najbliższe punkty względem adresu: ${query}`,purpose);
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
  if(!contact.roles.length)return toast("Zaznacz rolę: klient zlecający, odbiorca albo obie");
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
  const receiver=payload.receiver||{};
  if(!receiver.email||String(receiver.phone||"").replace(/\D/g,"").length<9)return false;
  if(payload.deliveryType==="locker"&&!payload.targetPoint)return false;
  if(payload.deliveryType==="courier"){
    if(!receiver.companyName&&!receiver.firstName)return false;
    const address=receiver.address||{};
    if(!address.street||!address.buildingNumber||!address.postCode||!address.city)return false;
  }
  if(inpostServiceMetodyWymagajacePunktu.has(String(payload.sendingMethod||""))&&!String(payload.dropoffPoint||"").trim())return false;
  return true;
}
function inpostServiceWycenaKwota(pricing={}){
  const value=pricing.totalGross;
  if(value==null||String(value).trim()==="")return null;
  return Number.isFinite(Number(value))?Number(value):null;
}
function inpostServiceProgiProwizji(){
  const defaults=[{upToGross:20,commissionGross:4},{upToGross:30,commissionGross:6},{upToGross:40,commissionGross:8},{upToGross:50,commissionGross:10}],saved=inpostServiceStan.settings?.commissionTiers;
  if(!Array.isArray(saved)||saved.length<4)return defaults;
  const tiers=saved.map(tier=>({upToGross:Number(tier.upToGross),commissionGross:Number(tier.commissionGross)})).filter(tier=>tier.upToGross>0&&tier.commissionGross>0).sort((a,b)=>a.upToGross-b.upToGross);
  return tiers.length>=4?tiers:defaults;
}
function inpostServiceProwizjaDlaKosztu(total){
  const tiers=inpostServiceProgiProwizji(),index=tiers.findIndex(tier=>Number(total)<=tier.upToGross),selectedIndex=index<0?tiers.length-1:index;
  return {...tiers[selectedIndex],index:selectedIndex,overflow:index<0};
}
function inpostServiceAktualizujWyceneUI(form,pricing=inpostServiceStan.pricing){
  const box=form?.querySelector("[data-inpost-pricing]");if(!box)return;
  if(!pricing){
    box.innerHTML='<div class="inpost-price-empty"><b>Uzupełnij odbiorcę i paczkę</b><small>Klient zlecający jest opcjonalny. Test kosztu nie tworzy przesyłki.</small></div>';
    return;
  }
  if(pricing.loading){
    box.innerHTML='<div class="inpost-price-empty inpost-live-price"><b><span class="inpost-live-dot"></span> Sprawdzam usługę w InPost…</b><small>Dla konta umownego koszt rozliczeniowy pochodzi z zapisanego cennika; odpowiedź ShipX służy kontroli technicznej. Ta operacja nie tworzy przesyłki.</small></div>';
    return;
  }
  const total=inpostServiceWycenaKwota(pricing);
  const contract=pricing.contractComparison||{},api=pricing.apiComparison||{},contractTotal=inpostServiceWycenaKwota({totalGross:contract.totalGross}),apiTotal=inpostServiceWycenaKwota({totalGross:api.totalGross}),difference=Number.isFinite(Number(contract.differenceGross))?Number(contract.differenceGross):null;
  if(total==null){
    box.innerHTML=`<div class="inpost-price-empty warning"><b>Brak bezpiecznej pełnej wyceny</b><small>${esc(pricing.apiWarning||pricing.message||"Uzupełnij brakujące stawki w cenniku umownym albo wybierz właściwy tryb rozliczenia.")}</small></div>${contractTotal==null?"":`<div class="inpost-contract-check"><span><b>Cennik umowny</b><small>${esc(contract.rateLabel||"stawka umowna")}${contract.complete===false?` • brak dopłat: ${esc((contract.unpricedOptions||[]).join(", ")||"uzupełnij cennik")}`:""}</small></span><strong>${zl(contractTotal)}</strong><em>${contract.complete===false?"niepełny":"gotowy"}</em></div>`}`;
    return;
  }
  const tier=pricing.commissionTier||inpostServiceProwizjaDlaKosztu(total),fee=Math.max(0,Number(pricing.commissionGross??tier.commissionGross)||0),customer=Math.round((total+fee)*100)/100,b=pricing.breakdown||{},source=pricing.source==="manual"?"koszt awaryjny wpisany ręcznie":pricing.source==="contract_postpaid"?"cennik umowny InPost • postpaid":"bieżąca cena InPost / ShipX • prepaid";
  if(form?.commissionGross)form.commissionGross.value=fee;
  box.innerHTML=`<div class="inpost-price-main"><span><small>Koszt nadania</small><strong>${zl(total)}</strong></span><span><small>Prowizja Artway-TM</small><strong>${zl(fee)}</strong></span><span class="total"><small>Kwota na FV klienta</small><strong>${zl(customer)}</strong></span></div>
    <div class="inpost-price-meta"><span class="lvl ${pricing.source==="manual"?"lvl-ostrzezenie":"lvl-ok"}">${esc(source)}</span><span class="lvl lvl-info inpost-tier-badge">Próg: ${tier.overflow?`powyżej ${zl(tier.upToGross)}`:`do ${zl(tier.upToGross)}`} → ${zl(fee)}</span>${b.fuelGross!=null?`<small>Paliwo: ${zl(b.fuelGross)}</small>`:""}${b.codGross!=null?`<small>Pobranie: ${zl(b.codGross)}</small>`:""}</div>
    ${pricing.apiWarning?`<div class="inpost-price-warning"><b>Ostatnia próba połączenia z ShipX:</b> ${esc(pricing.apiWarning)}.</div>`:""}
    ${api.trusted===false&&apiTotal!=null?`<div class="inpost-price-warning"><b>Wynik techniczny ShipX ${zl(apiTotal)} został pominięty.</b> ${esc(api.message||"Dla konta postpaid nie jest to cena umowna i nie może trafić na fakturę.")}</div>`:""}
    <div class="inpost-contract-check"><span><b>${pricing.source==="contract_postpaid"?"Zastosowana stawka umowna":"Cennik umowny — kontrola"}</b><small>${esc(contract.rateLabel||"brak stawki umownej")}${contract.complete===false&&contractTotal!=null?` • brak dopłat: ${esc((contract.unpricedOptions||[]).join(", ")||"uzupełnij cennik")}`:""}</small></span><strong>${contractTotal==null?"—":zl(contractTotal)}</strong><em>${difference==null?"potwierdzenie":`ShipX ${difference>0?"+":""}${zl(difference)}`}</em></div>`;
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
  if(Number(form?.codAmount?.value)>0)selected.push(["Pobranie","codGross"]);
  if(Number(form?.insuranceAmount?.value)>0)selected.push(["Dodatkowa ochrona","insuranceGross"]);
  if(String(form?.elements?.weekend?.value||"")==="true")selected.push(["Paczka w Weekend","weekendGross"]);
  if(form?.elements?.pickupRequested?.checked)selected.push(["Odbiór przez kuriera","pickupGross"]);
  if(form?.nonStandard?.checked)selected.push(["Element niestandardowy","nonStandardGross"]);
  form?.querySelectorAll('[name="additionalServices"]:checked').forEach(input=>{const labels={sms:["Powiadomienie SMS","smsGross"],email:["Powiadomienie e-mail","emailGross"],saturday:["Doręczenie w sobotę","saturdayGross"],dor1720:["Doręczenie 17:00–20:00","dor1720Gross"],rod:["Zwrot dokumentów","rodGross"]};if(labels[input.value])selected.push(labels[input.value]);});
  const unpricedOptions=selected.filter(([,key])=>extras[key]==null||extras[key]==="").map(([label])=>label),extrasGross=selected.reduce((sum,[,key])=>sum+(extras[key]==null||extras[key]===""?0:Number(extras[key])||0),0);
  const totalGross=rate?Math.round((Number(rate.gross||0)+extrasGross)*100)/100:null,contractComplete=totalGross!=null&&unpricedOptions.length===0,pricingMode=inpostServiceStan.settings?.pricingMode==="prepaid"?"prepaid":"contract_postpaid",useContract=pricingMode==="contract_postpaid"&&contractComplete,tier=totalGross==null?null:inpostServiceProwizjaDlaKosztu(totalGross),fee=tier?.commissionGross||inpostServiceProgiProwizji()[0].commissionGross;
  return {totalGross:useContract?totalGross:null,currency:"PLN",source:useContract?"contract_postpaid":"awaiting_shipx",pricingMode,available:useContract,complete:useContract,billingSafe:useContract,estimated:useContract,commissionGross:fee,commissionTier:tier,customerTotalGross:useContract?Math.round((totalGross+fee)*100)/100:null,breakdown:useContract?{baseGross:rate?.gross??null,extrasGross:Math.round(extrasGross*100)/100}:{},apiComparison:{totalGross:null,trusted:false,usedForBilling:false},contractComparison:{totalGross,baseGross:rate?.gross??null,extrasGross:Math.round(extrasGross*100)/100,rateKey,rateLabel:rate?.label||"",complete:contractComplete,unpricedOptions,fuelIncluded:true},message:useContract?"Koszt z zapisanego cennika umownego InPost.":pricingMode==="prepaid"?"Oczekuję na cenę ShipX dla konta prepaid.":"Uzupełnij brakujące stawki cennika umownego.",checkedAt:new Date().toISOString()};
}
function inpostServicePrzelicz(form){
  const manual=Math.max(0,Number(String(form?.carrierCostOverride?.value||"").replace(",","."))||0),tier=manual>0?inpostServiceProwizjaDlaKosztu(manual):null,fee=tier?.commissionGross||inpostServiceProgiProwizji()[0].commissionGross;
  if(manual>0){const local=inpostServiceLokalnaWycena(form);inpostServiceStan.pricing={totalGross:manual,commissionGross:fee,commissionTier:tier,customerTotalGross:Math.round((manual+fee)*100)/100,currency:"PLN",source:"manual",estimated:false,available:true,complete:true,breakdown:{},unpricedOptions:[],apiComparison:{totalGross:null},contractComparison:local.contractComparison};}
  else inpostServiceStan.pricing=inpostServiceLokalnaWycena(form);
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceZaplanujWycene(form){
  clearTimeout(inpostServiceWycenaTimer);
  inpostServiceWycenaToken+=1;
  inpostServicePrzelicz(form);
  inpostServiceWycenaTimer=setTimeout(()=>inpostServiceWycena(form,false),650);
}
async function inpostServiceWycena(form=document.getElementById("inpostServiceForm"),force=true){
  if(!form)return null;
  const payload=inpostServicePayload(form);
  if(!inpostServiceMozeWycenic(payload)){
    if(force)toast("Uzupełnij dane odbiorcy, paczki i sposób dostawy, aby wykonać test");
    inpostServicePrzelicz(form);return inpostServiceStan.pricing;
  }
  const token=++inpostServiceWycenaToken,local=inpostServiceLokalnaWycena(form);
  inpostServiceStan.pricing={loading:true,contractComparison:local.contractComparison};inpostServiceAktualizujWyceneUI(form);
  try{
    const d=await chmura("inpost-service-quote",{method:"POST",body:payload,timeout:30000});
    if(token!==inpostServiceWycenaToken)return inpostServiceStan.pricing;
    inpostServiceStan.pricing=d.pricing||null;
  }catch(e){
    if(token!==inpostServiceWycenaToken)return inpostServiceStan.pricing;
    if(e.code==="inpost_quote_validation"){inpostServiceBladPol(e.details,form,false);inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||"Uzupełnij dane nadania.",source:"validation"};}
    else inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||String(e),source:"unavailable"};
  }
  inpostServiceAktualizujWyceneUI(form);
  return inpostServiceStan.pricing;
}
async function inpostServiceTestuj(form=document.getElementById("inpostServiceForm"),button=null){
  const result=form?.querySelector("[data-inpost-test-result]");
  if(button){button.disabled=true;button.textContent="⏳ Testuję bez tworzenia…";}
  try{
    const pricing=await inpostServiceWycena(form,true);
    const apiPrice=pricing.apiComparison?.totalGross,apiNoPrice=apiPrice==null,message=pricing.apiWarning?`ShipX zgłosił: ${pricing.apiWarning}`:pricing.source==="contract_postpaid"?`Test zakończony. Koszt ${zl(pricing.totalGross)} pochodzi z cennika umownego; techniczny wynik ShipX${apiNoPrice?" nie zawierał ceny":` ${zl(apiPrice)} nie został użyty do rozliczenia`}.`:apiNoPrice?"ShipX przyjął dane, ale nie zwrócił ceny prepaid.":"Test ShipX zakończony poprawnie. Cena prepaid pochodzi z InPost; nie utworzono przesyłki, etykiety ani numeru nadania.";
    if(result)result.innerHTML=`<b>${pricing.apiWarning||apiNoPrice?"⚠️":"✅"} ${esc(message)}</b><br><small>Możesz poprawiać dane i powtarzać test dowolną liczbę razy.</small>`;
    toast(message);
  }finally{if(button){button.disabled=false;button.textContent="🧪 Test bez tworzenia";}}
}
function inpostServiceUstawTyp(form){
  inpostServiceZastosujZgodnoscTypu(form);
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
      <div class="inpost-contact-roles wide"><b>Używaj tego adresu jako</b><label><input type="checkbox" name="${prefix}RoleSender" ${prefix==="sender"?"checked":""}> Klient zlecający</label><label><input type="checkbox" name="${prefix}RoleReceiver" ${prefix==="receiver"?"checked":""}> Odbiorca</label></div>
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
function inpostServiceProgProwizjiHTML(tier={upToGross:20,commissionGross:4},allowRemove=true){
  return `<div class="inpost-commission-tier inpost-form-grid" data-inpost-commission-tier><label>Koszt wysyłki do (zł)<input data-tier-max type="number" min="0.01" step=".01" value="${esc(tier.upToGross)}"></label><label>Moja prowizja (zł)<input data-tier-fee type="number" min="0.01" step=".01" value="${esc(tier.commissionGross)}"></label>${allowRemove?'<button type="button" class="btn ghost inpost-tier-remove" onclick="inpostServiceUsunProgProwizji(this)">Usuń próg</button>':""}</div>`;
}
function inpostServiceProgiProwizjiHTML(){
  const tiers=inpostServiceProgiProwizji(),allowRemove=tiers.length>4;
  return `<section class="backend-note inpost-commission-settings inpost-service-workspace"><div class="order-section-head"><div><span class="order-pro-label">Automatyczne rozliczenie</span><h3>Progi mojej prowizji</h3></div><span class="lvl lvl-ok">minimum 4</span></div><div class="inpost-commission-tier-list inpost-form-grid" data-inpost-commission-tiers>${tiers.map(tier=>inpostServiceProgProwizjiHTML(tier,allowRemove)).join("")}</div><button class="btn ghost" type="button" onclick="inpostServiceDodajProgProwizji(this)">＋ Dodaj kolejny próg</button><small>Powyżej ostatniego progu obowiązuje ostatnia prowizja.</small></section>`;
}
function inpostServiceDodajProgProwizji(button){
  const list=button?.closest(".inpost-commission-settings")?.querySelector("[data-inpost-commission-tiers]"),rows=list?.querySelectorAll("[data-inpost-commission-tier]")||[];if(!list)return;
  if(rows.length>=10)return toast("Możesz ustawić maksymalnie 10 progów prowizji");
  const last=rows[rows.length-1],upTo=(Number(last?.querySelector("[data-tier-max]")?.value)||0)+10,fee=(Number(last?.querySelector("[data-tier-fee]")?.value)||0)+2;
  list.insertAdjacentHTML("beforeend",inpostServiceProgProwizjiHTML({upToGross:upTo,commissionGross:fee}));
}
function inpostServiceUsunProgProwizji(button){
  const list=button?.closest("[data-inpost-commission-tiers]");if(!list)return;
  if(list.querySelectorAll("[data-inpost-commission-tier]").length<=4)return toast("Muszą pozostać co najmniej 4 progi prowizji");
  button.closest("[data-inpost-commission-tier]")?.remove();
}
function inpostServiceProgiZForm(form){
  return [...form.querySelectorAll("[data-inpost-commission-tier]")].map(row=>({upToGross:Number(String(row.querySelector("[data-tier-max]")?.value||"").replace(",",".")),commissionGross:Number(String(row.querySelector("[data-tier-fee]")?.value||"").replace(",","."))})).filter(tier=>tier.upToGross>0&&tier.commissionGross>0).sort((a,b)=>a.upToGross-b.upToGross);
}
function inpostServiceOtworzUstawienia(){
  location.hash="#/admin/wysylki/inpost-ustawienia";
}
function inpostServiceUstawDomyslneNadanie(form){
  const method=String(form?.defaultSendingMethod?.value||"parcel_locker"),panel=form?.querySelector("[data-inpost-default-dropoff]");
  if(panel)panel.hidden=method!=="parcel_locker";
}
async function inpostServiceZapiszUstawienia(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),commissionTiers=inpostServiceProgiZForm(form);
  if(commissionTiers.length<4)return toast("Ustaw co najmniej 4 poprawne progi prowizji");
  const body={commissionGross:commissionTiers[0].commissionGross,commissionTiers,pricingMode:form.pricingMode?.value||"contract_postpaid",defaultDeliveryType:form.defaultDeliveryType?.value||"locker",defaultSendingMethod:form.defaultSendingMethod?.value||"parcel_locker",defaultDropoffPoint:form.defaultDropoffPoint?.value||"",defaultParcelTemplate:form.defaultParcelTemplate?.value||"small",defaultParcelWeight:form.defaultParcelWeight?.value||1,defaultBillingMode:form.defaultBillingMode?.value||"none",defaultWeekend:form.defaultWeekend?.checked===true,labelDefaultFormat:form.labelDefaultFormat?.value||"A6",labelOpenMode:form.labelOpenMode?.value||"preview",labelAutoPrint:form.labelAutoPrint?.checked===true,sender:inpostServiceStronaOsoby(form,"sender"),priceList:inpostServiceCennikZForm(form)};
  if(button){button.disabled=true;button.textContent="Zapisuję cennik…";}
  try{const d=await chmura("inpost-service-settings",{method:"POST",body,timeout:30000});inpostServiceStan.settings=d.settings||inpostServiceStan.settings;inpostServiceStan.pricing=null;toast("Ustawienia wysyłek zapisane ✅");renderuj();}catch(e){toast("Nie zapisano ustawień: "+(e.message||e));}
  finally{if(button){button.disabled=false;button.textContent="Zapisz cennik i ustawienia";}}
}
function inpostServiceFormHTML(){
  const settings=inpostServiceStan.settings||{},customer={},fee=inpostServiceProgiProwizji()[0].commissionGross,month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability,requestId=inpostServiceStan.requestId||inpostServiceNowyRequestId(),reference=`USL-${String(requestId).replace(/[^a-z0-9]/gi,"").slice(-10).toUpperCase()}`,defaultDelivery=settings.defaultDeliveryType==="courier"?"courier":"locker",defaultMethod=["parcel_locker","dispatch_order","pop"].includes(settings.defaultSendingMethod)?settings.defaultSendingMethod:"parcel_locker",defaultDropoff=String(settings.defaultDropoffPoint||"").toUpperCase(),savedTemplate=["small","medium","large","xlarge"].includes(settings.defaultParcelTemplate)?settings.defaultParcelTemplate:"small",defaultTemplate=defaultDelivery==="locker"&&savedTemplate==="xlarge"?"small":savedTemplate,defaultWeight=Math.max(.01,Math.min(30,Number(settings.defaultParcelWeight)||1)),defaultBilling=["none","single","monthly"].includes(settings.defaultBillingMode)?settings.defaultBillingMode:"none",defaultWeekend=settings.defaultWeekend===true;
  return `<section class="panel inpost-service-create">
    <div class="order-section-head"><div><span class="order-pro-label">Wyślij przesyłkę</span><h2>Przesyłka InPost</h2><p class="order-detail-lead">Ten sam układ co w Managerze InPost: doręczenie, rozmiar, odbiorca, usługi i zawsze trzy sposoby nadania.</p></div><div class="inpost-main-actions"><span class="lvl ${available?.locker&&available?.courier?"lvl-ok":"lvl-ostrzezenie"}">${available?.locker&&available?.courier?"● ShipX połączony":"● Sprawdź usługi"}</span><a class="btn ghost" href="#/admin/wysylki/inpost-rejestr">📚 Rejestr nadań</a><a class="btn ghost" href="#/admin/wysylki/inpost-ustawienia">⚙️ Ustawienia</a></div></div>
    <form id="inpostServiceForm" class="inpost-simple-form" onsubmit="inpostServiceUtworz(event)" oninput="inpostServiceReferencja(this);inpostServiceZaplanujWycene(this)" onchange="inpostServiceReferencja(this);inpostServiceZaplanujWycene(this)">
      <input type="hidden" name="requestId" value="${esc(requestId)}">
      <div class="inpost-shipment-builder">
        <fieldset id="inpost-delivery" class="inpost-flow-delivery"><legend>Sposób doręczenia</legend>
          <div class="inpost-delivery-choice">
            <label class="inpost-choice-card"><input type="radio" name="deliveryType" value="locker" ${defaultDelivery==="locker"?"checked":""} onchange="inpostServiceUstawTyp(this.form)"><span><b>Paczkomat® 24/7</b><small>Doręczenie do automatu lub PaczkoPunktu</small></span></label>
            <label class="inpost-choice-card"><input type="radio" name="deliveryType" value="courier" ${defaultDelivery==="courier"?"checked":""} onchange="inpostServiceUstawTyp(this.form)"><span><b>InPost Kurier</b><small>Doręczenie bezpośrednio pod adres</small></span></label>
          </div>
          <div class="inpost-reference-row"><label>Numer referencyjny<input name="reference" required readonly maxlength="30" value="${esc(reference)}"><small>Krótki numer zlecenia do wyszukania przesyłki. Dane nadawcy są automatycznie przenoszone do pola „Uwagi”.</small></label></div>
        </fieldset>

        <fieldset id="inpost-party-customer" class="inpost-sender-context inpost-flow-customer"><legend>Klient zlecający — opcjonalnie</legend>
          <input type="hidden" name="senderContactId" value="${esc(customer.id||"")}">
          <input type="checkbox" name="senderRoleSender" checked hidden>
          <div class="inpost-contact-selector"><div class="inpost-selected-contact" data-inpost-selected-contact="sender">${inpostServiceWybranyKontaktHTML(customer,"sender")}</div><div class="inpost-contact-selector-actions"><button class="btn" type="button" onclick="inpostServiceOtworzKsiazke('sender',this)">📒 Wybierz klienta</button><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres('sender',this)">＋ Nowy klient</button></div></div>
          <details><summary>Opcjonalne dane do uwag ShipX, książki adresowej lub faktury — rozwiń</summary><div class="inpost-form-grid">
            <label>Firma<input name="senderCompany" value="${esc(customer.companyName||"")}"></label><label>NIP<input name="senderTaxCode" inputmode="numeric" maxlength="10" value="${esc(customer.taxCode||"")}"></label><label>Imię<input name="senderFirstName" value="${esc(customer.firstName||"")}"></label><label>Nazwisko<input name="senderLastName" value="${esc(customer.lastName||"")}"></label><label>E-mail<input name="senderEmail" type="email" value="${esc(customer.email||"")}"></label><label>Telefon<input name="senderPhone" inputmode="tel" value="${esc(customer.phone||"")}"></label>
            <label class="wide">Ulica<input name="senderStreet" value="${esc(customer.address?.street||"")}"></label><label>Nr budynku<input name="senderBuilding" value="${esc(customer.address?.buildingNumber||customer.address?.building_number||"")}"></label><label>Nr lokalu<input name="senderFlat" value="${esc(customer.address?.flatNumber||customer.address?.flat_number||"")}"></label><label>Kod pocztowy<input name="senderPostCode" pattern="\\d{2}-?\\d{3}" value="${esc(customer.address?.postCode||customer.address?.post_code||"")}"></label><label>Miasto<input name="senderCity" value="${esc(customer.address?.city||"")}"></label>
            <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt('sender',this)">💾 Zapisz klienta w książce</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt('sender',this)">Usuń zapis</button></div><label class="check wide"><input type="checkbox" name="saveSender"> Zapamiętaj lub zaktualizuj klienta zlecającego</label>
          </div></details>
        </fieldset>

        <fieldset id="inpost-party-receiver" class="inpost-flow-receiver"><legend>Dane odbiorcy</legend>
          <input type="hidden" name="receiverContactId">
          <input type="checkbox" name="receiverRoleReceiver" checked hidden>
          <div class="inpost-contact-selector"><div class="inpost-selected-contact" data-inpost-selected-contact="receiver">${inpostServiceWybranyKontaktHTML({},"receiver")}</div><div class="inpost-contact-selector-actions"><button class="btn" type="button" onclick="inpostServiceOtworzKsiazke('receiver',this)">📒 Wybierz z książki</button><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres('receiver',this)">＋ Nowy adres</button></div></div>
          <div class="inpost-form-grid">
            <label>E-mail *<input name="receiverEmail" type="email" required placeholder="Adres e-mail odbiorcy"></label><label>Telefon *<input name="receiverPhone" inputmode="tel" required placeholder="9 cyfr"></label>
            <div class="wide" data-inpost-only="locker"><label>Punkt odbioru *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" required placeholder="Nazwa lub lokalizacja punktu"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape('target')">Mapa</button></div></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow('target')">Szukaj</button><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktowPrzyAdresie('receiver','target')">Przy adresie</button></div><div id="inpostServicePointResults"></div></div>
            <div class="wide inpost-courier-address" data-inpost-only="courier"><div class="inpost-form-grid"><label>Imię i nazwisko<input name="receiverFirstName" placeholder="Imię"><input name="receiverLastName" placeholder="Nazwisko"></label><label>Nazwa firmy<input name="receiverCompany"></label><label>NIP<input name="receiverTaxCode" inputmode="numeric" maxlength="10"></label><label>Kod pocztowy *<input name="receiverPostCode" data-receiver-address pattern="\\d{2}-?\\d{3}"></label><label>Miasto *<input name="receiverCity" data-receiver-address></label><label class="wide">Ulica *<input name="receiverStreet" data-receiver-address></label><label>Nr budynku *<input name="receiverBuilding" data-receiver-address></label><label>Nr lokalu<input name="receiverFlat"></label></div></div>
            <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt('receiver',this)">💾 Dodaj odbiorcę do książki</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt('receiver',this)">Usuń zapis</button></div><label class="check wide"><input type="checkbox" name="saveReceiver" checked> Zapamiętaj lub zaktualizuj odbiorcę</label>
          </div>
        </fieldset>

        <fieldset id="inpost-shipment-options" class="inpost-flow-size"><legend>Rozmiar paczki</legend>
          <div class="inpost-size-choice">
            ${[["small","A","maks. 8 × 38 × 64 cm"],["medium","B","maks. 19 × 38 × 64 cm"],["large","C","maks. 41 × 38 × 64 cm"],["xlarge","D","maks. 80 × 50 × 50 cm"]].map(([value,label,description])=>`<label class="inpost-choice-card" ${value==="xlarge"?'data-inpost-size="xlarge" data-inpost-only="courier"':""}><input type="radio" name="template" value="${value}" ${value===defaultTemplate?"checked":""} onchange="inpostServiceUstawGabaryt(this.form,'${value}')"><span><b>${label}</b><small>${description}</small></span></label>`).join("")}
          </div>
          <input type="hidden" name="length" value="64"><input type="hidden" name="width" value="38"><input type="hidden" name="height" value="8">
          <div class="inpost-form-grid inpost-parcel-details"><label>Waga (kg)<input name="weight" type="number" min=".01" max="30" step=".01" value="${esc(defaultWeight)}"></label><label class="check" data-inpost-only="courier"><input type="checkbox" name="nonStandard"> Element niestandardowy</label><label class="wide">Uwagi dla InPost — nadawca klienta<textarea name="comments" rows="2" maxlength="100" readonly placeholder="Uzupełnią się po podaniu klienta zlecającego"></textarea><small>Automatycznie: nazwa nadawcy i pełny adres. ShipX dopuszcza tutaj maksymalnie 100 znaków.</small></label></div>
        </fieldset>

        <fieldset class="inpost-flow-extras"><legend>Dodatkowe usługi</legend>
          <div class="inpost-extra-services">
            <label>Wartość pobrania<input name="codAmount" type="number" min="0" step=".01" placeholder="Wpisz kwotę, aby nadać za pobraniem"></label>
            <div><span>Dodatkowa ochrona</span><div class="inpost-protection-choice">${[[0,"Brak"],[5000,"Do 5 000 zł"],[10000,"Do 10 000 zł"],[20000,"Do 20 000 zł"]].map(([value,label],index)=>`<label class="inpost-choice-card compact"><input type="radio" name="insuranceAmount" value="${value}" ${index===0?"checked":""}><span><b>${label}</b></span></label>`).join("")}</div></div>
            <div data-inpost-only="locker"><span>Paczka w Weekend</span><div class="inpost-weekend-choice"><label class="inpost-choice-card compact"><input type="radio" name="weekend" value="false" ${defaultWeekend?"":"checked"}><span><b>Nie</b></span></label><label class="inpost-choice-card compact"><input type="radio" name="weekend" value="true" ${defaultWeekend?"checked":""}><span><b>Tak</b></span></label></div></div>
            <div class="inpost-courier-extras" data-inpost-only="courier"><label class="check"><input type="checkbox" name="additionalServices" value="sms"> SMS</label><label class="check"><input type="checkbox" name="additionalServices" value="email"> E-mail</label><label class="check"><input type="checkbox" name="additionalServices" value="saturday"> Sobota</label><label class="check"><input type="checkbox" name="additionalServices" value="dor1720"> 17:00–20:00</label><label class="check"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label></div>
          </div>
        </fieldset>

        <fieldset class="inpost-flow-method"><legend>Sposób nadania</legend>
          <div class="inpost-method-choice">${inpostServiceMetodyNadania.locker.map(([value,label])=>`<label class="inpost-method-card" data-inpost-method-card><input type="radio" name="sendingMethod" value="${value}" ${value===defaultMethod?"checked":""} onchange="inpostServiceUstawTyp(this.form)"><span><b>${esc(label)}</b><small>${value==="parcel_locker"?"Wybierz automat nadawczy":value==="dispatch_order"?"Odbiór ze stałego adresu Artway‑TM":"Nadaj w obsługiwanym punkcie"}</small></span></label>`).join("")}</div>
          <div class="inpost-dropoff-panel" data-inpost-dropoff-panel hidden><label><span data-inpost-dropoff-label>Automat nadawczy *</span><div class="inpost-inline"><input id="inpostServiceDropoffPoint" name="dropoffPoint" value="${esc(defaultDropoff)}" placeholder="Wybierz automat nadawczy"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape('dropoff')">Mapa</button></div><small data-inpost-dropoff-hint></small></label><div class="inpost-point-search"><input id="inpostServiceDropoffSearch" placeholder="Miasto, kod, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow('dropoff')">Szukaj</button></div><div id="inpostServiceDropoffResults"></div></div>
          <div class="backend-note"><b>Odbiór przez kuriera zamawiasz osobno.</b> Po utworzeniu przesyłki przejdź do podstrony <a href="#/admin/wysylki/odbior-kuriera">Odbiór kuriera</a>.</div>
        </fieldset>

        <div class="inpost-options-layout inpost-flow-settlement">
        <fieldset class="inpost-billing-card" id="inpost-settlement"><legend>💰 Koszt i faktura Artway‑TM</legend>
          <div class="inpost-pricing-layout"><div data-inpost-pricing></div><div class="inpost-pricing-controls"><label>Koszt ręczny — tylko awaryjnie<input name="carrierCostOverride" type="number" min="0" step=".01" placeholder="gdy brak pełnej stawki"></label><button class="btn ghost" type="button" onclick="inpostServiceWycena(this.form,true)">↻ Sprawdź wycenę InPost</button><a class="btn ghost" href="#/admin/wysylki/inpost-ustawienia">⚙️ Źródło cen i cennik</a></div></div>
          <div class="inpost-settlement-grid">
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="none" ${defaultBilling==="none"?"checked":""}><span><b>Bez faktury</b><small>Tylko nadanie i rejestr kosztu</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="single" ${defaultBilling==="single"?"checked":""}><span><b>FV od razu</b><small>Artway‑TM wystawia koszt nadania + prowizję</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="monthly" ${defaultBilling==="monthly"?"checked":""}><span><b>FV miesięczna</b><small>Dopisz całe nadanie do rozliczenia klienta</small></span></label>
          </div>
          <input name="commissionGross" type="hidden" value="${esc(fee)}"><div class="inpost-form-grid"><label>Miesiąc rozliczenia<input name="billingMonth" type="month" value="${esc(month)}"></label><div class="backend-note inpost-auto-fee"><small>Prowizja</small><b>Dobierana automatycznie do kosztu wysyłki</b></div></div>
          <div class="backend-note"><b>FV: Artway‑TM → klient zlecający.</b> Firma i NIP są wymagane tylko dla faktury miesięcznej.</div>
        </fieldset>
      </div>
      </div>
      <div class="inpost-form-errors" data-inpost-form-errors hidden></div>
      <div class="backend-note inpost-test-note" data-inpost-test-result><b>Test niczego nie tworzy.</b> Sprawdza dane i wycenę przed prawdziwym nadaniem.</div>
      <div class="inpost-create-footer"><button class="btn" type="button" data-inpost-test onclick="inpostServiceTestuj(this.form,this)">🧪 Test bez tworzenia</button><button class="btn danger" type="submit">🔴 Utwórz prawdziwą przesyłkę</button><small>Utworzenie wymaga jeszcze potwierdzenia w osobnym oknie.</small></div>
    </form>
  </section>`;
}
function inpostServiceKosztHTML(item={}){
  const pricing=item.pricing||{},amount=inpostServiceWycenaKwota(pricing);
  if(amount==null)return '<span class="lvl lvl-ostrzezenie">cena niedostępna</span>';
  const source=pricing.source==="manual"?"koszt awaryjny":pricing.source==="contract_postpaid"?"cennik umowny • postpaid":"InPost / ShipX • prepaid";
  return `<b>${zl(amount)}</b><br><small>${source} • na FV ${zl(pricing.customerTotalGross??amount+(item.billing?.commissionGross||0))}</small>${pricing.apiComparison?.trusted===false&&pricing.apiComparison?.totalGross!=null?`<br><small>ShipX ${zl(pricing.apiComparison.totalGross)} pominięte jako techniczne</small>`:""}`;
}
function inpostServiceHistoriaHTML(){
  const rows=inpostServiceLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(inpostServiceSzukaj)}" placeholder="Numer nadania, klient, NIP, e-mail, punkt lub referencja…" oninput="inpostServiceSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="inpostServiceFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie statusy</option>${[["label_ready","Etykieta gotowa"],["created","Utworzone"],["error","Błędy"],["cancelled","Anulowane"]].map(([v,l])=>`<option value="${v}" ${inpostServiceFiltr===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Rozliczenie<select onchange="inpostServiceBillingFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie</option><option value="oczekuje" ${inpostServiceBillingFiltr==="oczekuje"?"selected":""}>Do FV miesięcznej</option><option value="rozliczone" ${inpostServiceBillingFiltr==="rozliczone"?"selected":""}>W inFakt</option><option value="bez" ${inpostServiceBillingFiltr==="bez"?"selected":""}>Bez faktury</option></select></label>`;
  const row=item=>{
    const events=Array.isArray(item.trackingHistory)?item.trackingHistory:[];
    const label=item.labelReady?`${inpostServiceStatusLabel(item)}<br><small>${esc(inpostServiceStatusNazwa(item.inpostStatus))}</small>`:inpostServiceStatusLabel(item);
    const customer=item.customer||item.sender||{};
    return `<tr data-stable-key="${esc(item.id)}">
      <td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td>
      <td data-label="Klient zlecający"><b>${esc(inpostServiceNazwaKontaktu(customer))}</b><br><small>${esc(inpostServiceAdresKsiazki(customer))}</small><br><small>${esc(customer.email||"")}</small></td>
      <td data-label="Odbiorca"><b>${esc(inpostServiceNazwaKontaktu(item.receiver))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.receiver))}</small><br><small>${esc(item.receiver?.email||"")}</small></td>
      <td data-label="Usługa">${item.deliveryType==="locker"?"📮 Paczkomat":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td>
      <td data-label="Koszt">${inpostServiceKosztHTML(item)}</td>
      <td data-label="Status">${label}<br><small>${events.length} zdarzeń • aktualizacja ${esc(inpostServiceDataPotwierdzenia(item.trackingUpdatedAt||item.updatedAt))}</small></td>
      <td data-label="Rozliczenie">${inpostServiceBillingLabel(item)}<br><small>FV klienta: ${item.billing?.mode==="none"?"—":zl(item.pricing?.customerTotalGross||0)}</small></td>
      <td data-label="Akcje"><div class="inpost-row-actions"><button class="btn receipt" onclick="inpostServicePotwierdzenie(${jsArg(item.id)})">🖨️ Potwierdzenie</button><button class="btn ghost" onclick="inpostServiceHistoriaPrzesylki(${jsArg(item.id)})">📍 Historia paczki</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" ${item.pricing?.complete===true?"":"disabled title='Uzupełnij koszt przesyłki'"} onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td>
    </tr>`;
  };
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr</span><h2>Nadania i tracking</h2></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Numer, klient, tracking lub rozliczenie.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Klient zlecający</th><th>Odbiorca</th><th>Usługa</th><th>Koszt</th><th>Status i historia</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(row).join("")||'<tr><td colspan="8">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function inpostServiceMiesieczneHTML(){
  const groups=inpostServiceStan.billing?.groups||[];if(!groups.length)return "";
  return `<section class="panel inpost-monthly-billing"><div class="order-section-head"><div><span class="order-pro-label">Faktury Artway‑TM</span><h2>Rozliczenia miesięczne</h2></div><a class="btn ghost" href="#/admin/infakt/wysylki">Otwórz w inFakt</a></div><div class="inpost-monthly-grid">${groups.map(group=>`<article><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small><small>Koszt nadań ${zl(group.carrierGross||0)} + prowizja ${zl(group.commissionGross||0)}</small>${group.incompletePrices?`<span class="lvl lvl-ostrzezenie">${group.incompletePrices} niepełnych wycen</span>`:""}</div><strong>${zl(group.customerTotalGross||0)}</strong><button class="btn" ${group.incompletePrices?"disabled title='Najpierw uzupełnij koszty'":""} onclick="inpostServiceFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz FV Artway‑TM</button></article>`).join("")}</div></section>`;
}
function inpostServiceUstawieniaHTML(){
  const settings=inpostServiceStan.settings||{},defaultMethod=["parcel_locker","dispatch_order","pop"].includes(settings.defaultSendingMethod)?settings.defaultSendingMethod:"parcel_locker";
  return `<section class="panel inpost-service-settings"><div class="order-section-head"><div><span class="order-pro-label">Konfiguracja usługi</span><h2>Ustawienia nadań InPost</h2><p class="order-detail-lead">Domyślne wartości formularza, druk, prowizje i cennik kontrolny w jednym miejscu.</p></div><div class="inpost-main-actions"><a class="btn ghost" href="#/admin/wysylki/inpost-rejestr">📚 Rejestr nadań</a><a class="btn ghost" href="#/admin/wysylki/inpost">← Wróć do nadania</a></div></div><form id="inpostServiceSettingsForm" onsubmit="inpostServiceZapiszUstawienia(event)">
    <details class="backend-note inpost-settings-group" open><summary><span>💰 Źródło kosztu InPost</span><small>Chroni faktury przed techniczną ceną domyślną ShipX</small></summary><div class="inpost-form-grid"><label class="wide">Rodzaj rozliczenia konta<select name="pricingMode"><option value="contract_postpaid" ${settings.pricingMode!=="prepaid"?"selected":""}>Umowa / postpaid — zalecane dla Artway‑TM</option><option value="prepaid" ${settings.pricingMode==="prepaid"?"selected":""}>Prepaid — cena bezpośrednio z ShipX</option></select><small>Na koncie postpaid endpoint kalkulacji może zwrócić brak ceny albo wartość domyślną. Wtedy podstawą jest pełny zapisany cennik umowny, a wynik ShipX pozostaje kontrolą techniczną.</small></label></div><div class="backend-note inpost-control-price-note"><b>Aktualnie: ${settings.pricingMode==="prepaid"?"prepaid — ShipX jest podstawą":"postpaid — cennik umowny jest podstawą"}.</b><span>Ręczna kwota jest jawnym trybem awaryjnym. Niepełna stawka lub brak dopłaty blokuje automatyczne rozliczenie zamiast zaniżać koszt.</span></div></details>
    <details class="backend-note inpost-settings-group" open><summary><span>📮 Domyślne nadanie</span><small>Automatycznie uzupełnia każdy nowy formularz</small></summary><div class="inpost-form-grid">
      <label>Domyślne doręczenie<select name="defaultDeliveryType"><option value="locker" ${settings.defaultDeliveryType!=="courier"?"selected":""}>Paczkomat® 24/7</option><option value="courier" ${settings.defaultDeliveryType==="courier"?"selected":""}>InPost Kurier</option></select></label>
      <label>Domyślny sposób nadania<select name="defaultSendingMethod" onchange="inpostServiceUstawDomyslneNadanie(this.form)">${inpostServiceMetodyNadania.locker.map(([value,label])=>`<option value="${value}" ${value===defaultMethod?"selected":""}>${esc(label)}</option>`).join("")}</select></label>
      <label>Domyślny gabaryt<select name="defaultParcelTemplate">${[["small","A — 8 × 38 × 64 cm"],["medium","B — 19 × 38 × 64 cm"],["large","C — 41 × 38 × 64 cm"],["xlarge","D — 80 × 50 × 50 cm"]].map(([value,label])=>`<option value="${value}" ${settings.defaultParcelTemplate===value?"selected":""}>${label}</option>`).join("")}</select></label>
      <label>Domyślna waga (kg)<input name="defaultParcelWeight" type="number" min=".01" max="30" step=".01" value="${esc(settings.defaultParcelWeight||1)}"></label>
      <label>Domyślne rozliczenie<select name="defaultBillingMode"><option value="none" ${settings.defaultBillingMode!=="single"&&settings.defaultBillingMode!=="monthly"?"selected":""}>Bez faktury</option><option value="single" ${settings.defaultBillingMode==="single"?"selected":""}>FV od razu</option><option value="monthly" ${settings.defaultBillingMode==="monthly"?"selected":""}>FV miesięczna</option></select></label>
      <label class="check"><input type="checkbox" name="defaultWeekend" ${settings.defaultWeekend?"checked":""}><span><b>Domyślnie Paczka w Weekend</b><small>Tylko dla doręczenia Paczkomat®.</small></span></label>
      <div class="wide" data-inpost-default-dropoff ${defaultMethod==="parcel_locker"?"":"hidden"}><label>Domyślny automat nadawczy<div class="inpost-inline"><input id="inpostServiceDefaultDropoffPoint" name="defaultDropoffPoint" value="${esc(settings.defaultDropoffPoint||"")}" placeholder="np. BOJ01N"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape('default-dropoff')">Mapa</button></div><small id="inpostServiceDefaultDropoffPointLabel">Ten punkt będzie wpisywany automatycznie w każdym nowym nadaniu do automatu.</small></label><div class="inpost-point-search"><input id="inpostServiceDefaultDropoffSearch" placeholder="Miasto, kod, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow('default-dropoff')">Szukaj</button></div><div id="inpostServiceDefaultDropoffResults"></div></div>
    </div></details>
    <details class="backend-note inpost-settings-group inpost-label-settings" open><summary><span>🏷️ Podgląd i druk etykiet</span><small>Jedne ustawienia dla sklepu, nadań InPost i Von Halsky</small></summary><div class="inpost-form-grid"><label>Domyślny format<select name="labelDefaultFormat"><option value="A6" ${settings.labelDefaultFormat!=="A4"?"selected":""}>A6 — drukarka etykiet</option><option value="A4" ${settings.labelDefaultFormat==="A4"?"selected":""}>A4 — zwykła drukarka</option></select><small>Używany przez główny przycisk etykiety na każdej podstronie.</small></label><label>Po kliknięciu etykiety<select name="labelOpenMode"><option value="preview" ${settings.labelOpenMode!=="browser"?"selected":""}>Podgląd w panelu — zalecane</option><option value="browser" ${settings.labelOpenMode==="browser"?"selected":""}>PDF w nowej karcie</option></select><small>Podgląd daje osobne przyciski drukowania i pobrania.</small></label><label class="check wide"><input type="checkbox" name="labelAutoPrint" ${settings.labelAutoPrint?"checked":""}><span><b>Automatycznie otwieraj okno drukowania</b><small>W zwykłym Chrome nadal zatwierdzasz druk. Cichy wydruk działa dopiero po włączeniu polityki Chrome dla stanowiska.</small></span></label></div><div class="inpost-printer-policy"><span>🖨️</span><div><b>Drukarka domyślna: Chrome / system operacyjny</b><small>Strona internetowa nie może samodzielnie przełączyć fizycznej drukarki. Na stanowisku pakowania wybiera ją ustawienie Chrome <code>DefaultPrinterSelection</code>; bez niego używana jest ostatnia lub systemowa drukarka.</small></div><em>${settings.labelAutoPrint?"automatyczny dialog włączony":"podgląd przed drukiem"}</em></div></details>
    ${inpostServiceProgiProwizjiHTML()}
    <details class="backend-note inpost-settings-group" ${settings.pricingMode!=="prepaid"?"open":""}><summary><span>🚚 Cennik umowny InPost</span><small>${settings.pricingMode==="prepaid"?"Kontrola ceny ShipX":"Podstawa rozliczenia konta postpaid"}</small></summary><div class="backend-note inpost-control-price-note"><b>${settings.pricingMode==="prepaid"?"W trybie prepaid cena podstawowa pochodzi z ShipX.":"W trybie postpaid pełna stawka umowna jest ceną podstawową."}</b><span>Każda wybrana dopłata musi mieć wpisaną stawkę. Brak stawki zatrzyma rozliczenie i pokaże konkretny problem.</span></div>${inpostServiceCennikHTML()}</details>
    <details class="backend-note inpost-settings-group"><summary><span>🏢 Dane Artway‑TM</span><small>Adres odbioru przesyłek przez kuriera</small></summary><div class="backend-note"><b>Przy tworzeniu paczki nie wysyłamy pola nadawcy.</b> ShipX pobiera nadawcę z organizacji Artway‑TM. Te dane służą do zamawiania odbioru przez kuriera.</div>${inpostServiceOsobaFields("sender","Adres odbioru przez kuriera",inpostServiceNadawca())}</details>
    <div class="inpost-settings-footer"><button class="btn" type="submit">💾 Zapisz ustawienia wysyłek</button><a class="btn ghost" href="#/admin/infakt/wysylki">Rozliczenia inFakt</a></div>
  </form></section>`;
}
function panelUstawienWysylkiInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram ustawienia InPost…</div></div>';
  return `<div class="inpost-service-workspace">${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceUstawieniaHTML()}</div>`;
}
function panelRejestruWysylekInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram rejestr nadań InPost…</div></div>';
  const items=inpostServiceStan.items||[],active=items.filter(item=>!["cancelled","delivered","returned_to_sender"].includes(String(item.inpostStatus||item.status))),labels=items.filter(item=>item.labelReady),errors=items.filter(item=>item.status==="error"||item.error),monthly=Number(inpostServiceStan.billing?.pendingMonthly||0);
  return `<div class="inpost-service-workspace"><section class="inpost-service-stats"><article><span>📦</span><b>${items.length}</b><small>wszystkich nadań</small></article><article><span>🚚</span><b>${active.length}</b><small>aktywnych przesyłek</small></article><article><span>🏷️</span><b>${labels.length}</b><small>gotowych etykiet</small></article><article><span>⚠️</span><b>${errors.length}</b><small>wymaga uwagi</small></article></section><section class="panel inpost-register-intro"><div class="order-section-head"><div><span class="order-pro-label">Osobna podstrona operacyjna</span><h2>Rejestr nadań InPost</h2><p class="order-detail-lead">Tracking, etykiety, potwierdzenia i rozliczenia bez mieszania z formularzem nowej przesyłki.</p></div><div class="inpost-main-actions">${monthly?`<span class="lvl lvl-ostrzezenie">${monthly} do FV miesięcznej</span>`:""}<a class="btn" href="#/admin/wysylki/inpost">＋ Nowa przesyłka</a><button class="btn ghost" type="button" onclick="inpostServiceLaduj(true,false)">↻ Synchronizuj</button></div></div></section>${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}</div>`;
}
function panelOdbioruKurieraInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram przesyłki do odbioru…</div></div>';
  const rows=(inpostServiceStan.items||[]).filter(item=>item.sendingMethod==="dispatch_order"),ordered=rows.filter(item=>item.pickup?.id),ready=rows.filter(item=>!item.pickup?.id&&item.inpostId&&!['cancelled','error'].includes(item.status)),waiting=rows.filter(item=>!item.pickup?.id&&!ready.includes(item));
  const row=item=>`<tr data-stable-key="${esc(item.id)}"><td data-label="Przesyłka"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small></td><td data-label="Odbiorca"><b>${esc(item.receiver?.companyName||`${item.receiver?.firstName||""} ${item.receiver?.lastName||""}`.trim()||"Klient")}</b><br><small>${esc(item.receiver?.city||item.receiver?.address?.city||"")}</small></td><td data-label="Stan">${inpostServiceStatusLabel(item)}${item.pickup?.id?`<br><span class="lvl lvl-ok">kurier zamówiony</span>`:""}</td><td data-label="Akcja"><div class="inpost-row-actions">${item.pickup?.id?`<span class="lvl lvl-ok">Odbiór ${esc(item.pickup.id)}</span>`:item.inpostId&&!['cancelled','error'].includes(item.status)?`<button class="btn" type="button" onclick="inpostServiceOdbior(${jsArg(item.id)})">🚚 Zamów kuriera</button><button class="btn ghost" type="button" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Sprawdź gotowość</button>`:'<button class="btn" type="button" disabled>Najpierw utwórz przesyłkę</button>'}</div></td></tr>`;
  return `<div class="inpost-service-workspace"><section class="inpost-service-stats"><article><span>🚚</span><b>${ready.length}</b><small>możliwych do zlecenia</small></article><article><span>✅</span><b>${ordered.length}</b><small>odbiorów zamówionych</small></article><article><span>⏳</span><b>${waiting.length}</b><small>oczekuje na przesyłkę</small></article><article><span>📦</span><b>${rows.length}</b><small>paczek kurierskich</small></article></section><section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Odbiór ze stałego adresu Artway‑TM</span><h2>Odbiór kuriera InPost</h2><p class="order-detail-lead">Tutaj zamawiasz kuriera tylko do paczek oznaczonych „Przesyłkę odbierze kurier InPost”.</p></div><div class="diag-actions"><a class="btn ghost" href="#/admin/wysylki/inpost">＋ Nowe nadanie</a><button class="btn ghost" type="button" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div></div><div class="backend-note"><b>Bezpieczne potwierdzenie:</b> kliknięcie „Zamów kuriera” zawsze pokaże dodatkowe pytanie przed wysłaniem prawdziwego zlecenia do InPost.</div><div class="warehouse-worktable-wrap"><table class="log-table admin-responsive-table"><thead><tr><th>Przesyłka</th><th>Odbiorca</th><th>Stan</th><th>Akcja</th></tr></thead><tbody>${rows.map(row).join("")||'<tr><td colspan="4">Brak paczek z wybranym odbiorem przez kuriera.</td></tr>'}</tbody></table></div></section></div>`;
}
function panelWysylkiUslugowejInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram książkę adresową, konfigurację i rejestr nadań…</div></div>';
  setTimeout(()=>{const form=document.getElementById("inpostServiceForm");inpostServiceReferencja(form);inpostServiceUstawGabaryt(form,form?.elements?.template?.value||"small",false);inpostServiceUstawTyp(form);inpostServiceAktualizujWyceneUI(form);inpostServiceAdresPodpowiedzi(form,"sender");inpostServiceAdresPodpowiedzi(form,"receiver");},0);
  return `<div class="inpost-service-workspace">${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceFormHTML()}</div>`;
}
