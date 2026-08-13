let inpostServiceWycenaTimer=0;
const inpostServiceKodPocztowyTimery={sender:0,receiver:0},inpostServiceKodPocztowyCache=new Map();
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
function inpostServiceKodPocztowy(value=""){
  const digits=String(value||"").replace(/\D/g,"").slice(0,5);
  return digits.length===5?`${digits.slice(0,2)}-${digits.slice(2)}`:digits;
}
function inpostServiceUliceDlaAdresu(form,prefix){
  const code=inpostServiceKodPocztowy(form?.elements?.[`${prefix}PostCode`]?.value),city=inpostServiceAdresNormal(form?.elements?.[`${prefix}City`]?.value);
  const streets=inpostServiceAdresUnikalne(inpostServiceAdresy().filter(contact=>{
    const address=inpostServiceAdresDane(contact);
    return (!code||inpostServiceKodPocztowy(address.postCode)===code)&&(!city||inpostServiceAdresNormal(address.city)===city);
  }).map(contact=>inpostServiceAdresDane(contact).street),250);
  const list=document.getElementById(`inpostService${prefix}StreetHints`);if(list)list.innerHTML=streets.map(street=>`<option value="${esc(street)}"></option>`).join("");
  return streets;
}
function inpostServiceMiastoWpis(input,prefix){inpostServiceUliceDlaAdresu(input?.form,prefix);}
function inpostServiceKodPocztowyWpis(input,prefix){
  const code=inpostServiceKodPocztowy(input?.value),form=input?.form,hint=form?.querySelector?.(`[data-inpost-postcode-hint="${prefix}"]`);
  if(input&&input.value!==code)input.value=code;
  clearTimeout(inpostServiceKodPocztowyTimery[prefix]);
  if(!/^\d{2}-\d{3}$/.test(code)){if(hint){hint.hidden=true;hint.textContent="";}return;}
  if(hint){hint.hidden=false;hint.className="backend-note wide";hint.textContent="Sprawdzam kod pocztowy…";}
  inpostServiceKodPocztowyTimery[prefix]=setTimeout(()=>inpostServiceSprawdzKodPocztowy(form,prefix,code),350);
}
async function inpostServiceSprawdzKodPocztowy(form,prefix,code){
  if(!form||inpostServiceKodPocztowy(form.elements[`${prefix}PostCode`]?.value)!==code)return;
  const hint=form.querySelector(`[data-inpost-postcode-hint="${prefix}"]`);
  try{
    let d=inpostServiceKodPocztowyCache.get(code);
    if(!d){d=await chmura("inpost-service-postcode",{params:{code},timeout:9000});inpostServiceKodPocztowyCache.set(code,d);}
    if(inpostServiceKodPocztowy(form.elements[`${prefix}PostCode`]?.value)!==code)return;
    const localCities=inpostServiceAdresy().filter(contact=>inpostServiceKodPocztowy(inpostServiceAdresDane(contact).postCode)===code).map(contact=>inpostServiceAdresDane(contact).city);
    const cities=inpostServiceAdresUnikalne([...(d.cities||[]),...localCities],50),cityInput=form.elements[`${prefix}City`],cityList=document.getElementById(`inpostService${prefix}CityHints`);
    if(cityList)cityList.innerHTML=cities.map(city=>`<option value="${esc(city)}"></option>`).join("");
    if(cityInput&&!String(cityInput.value||"").trim()&&cities.length===1)cityInput.value=cities[0];
    const streets=inpostServiceUliceDlaAdresu(form,prefix);
    if(hint){hint.hidden=false;hint.className="backend-note wide";hint.textContent=cities.length?`Kod rozpoznany: ${cities.join(", ")}. ${streets.length?"Możesz wybrać zapisaną ulicę z podpowiedzi.":"Wpisz ulicę i numer budynku."}`:"Nie znaleziono miejscowości dla tego kodu. Sprawdź kod albo wpisz miasto ręcznie.";}
    inpostServiceZaplanujWycene(form);
  }catch(e){if(hint){hint.hidden=false;hint.className="backend-note wide";hint.textContent="Nie udało się teraz sprawdzić kodu. Miasto i ulicę możesz wpisać ręcznie.";}}
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
  const withRole={...contact,roles:Array.isArray(contact.roles)&&contact.roles.length?contact.roles:[prefix]};
  return `<span class="inpost-selected-icon">${prefix==="sender"?"📤":"📥"}</span><span><b>${esc(inpostServiceNazwaKontaktu(contact))}</b><small>${esc(inpostServiceAdresKsiazki(contact)||[contact.email,contact.phone].filter(Boolean).join(" • ")||"Adres do uzupełnienia")}</small></span>${inpostServiceRolaEtykieta(withRole)}`;
}
function inpostServicePunktOpis(point={}){
  const distance=Number(point.distance);
  return [opisPunktuInpost(point),Number.isFinite(distance)?`${distance<1000?Math.round(distance)+" m":(distance/1000).toFixed(1).replace(".",",")+" km"}`:"",point.location247?"czynny 24/7":point.openingHours].filter(Boolean).join(" • ");
}
async function inpostServicePobierzPunkty(params={},caption="",purpose="target"){
  const dropoff=purpose==="dropoff",box=document.getElementById(dropoff?"inpostServiceDropoffResults":"inpostServicePointResults");if(box)box.innerHTML="<small>Szukam najbliższych punktów InPost…</small>";
  try{
    const d=await chmura("inpost-points",{params:{limit:15,...params},timeout:15000}),points=d.points||[];
    if(box)box.innerHTML=`${caption?`<div class="inpost-point-caption">${esc(caption)}</div>`:""}${points.map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))},${jsArg(purpose)})"><b>${esc(point.name)}</b><span>${esc(inpostServicePunktOpis(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów dla tego adresu.</small>"}`;
  }catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
async function inpostServiceSzukajPunktow(purpose="target"){
  const dropoff=purpose==="dropoff",query=String(document.getElementById(dropoff?"inpostServiceDropoffSearch":"inpostServicePointSearch")?.value||"").trim();
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
  if(!String(payload.sendingMethod||"").trim())return false;
  const senderAddress=payload.sender?.address||{};
  if(!senderAddress.street||!senderAddress.buildingNumber||!senderAddress.postCode||!senderAddress.city)return false;
  if(payload.deliveryType==="locker"&&!payload.targetPoint)return false;
  if(payload.deliveryType==="courier"){
    const address=payload.receiver?.address||{};
    if(!address.street||!address.buildingNumber||!address.postCode||!address.city)return false;
  }
  if(inpostServiceMetodyWymagajacePunktu.has(String(payload.sendingMethod||""))&&!String(payload.dropoffPoint||"").trim())return false;
  return true;
}
function inpostServiceWycenaKwota(pricing={}){
  if(pricing.totalGross==null||String(pricing.totalGross).trim()==="")return null;
  return Number.isFinite(Number(pricing.totalGross))?Number(pricing.totalGross):null;
}
function inpostServicePelnaCenaKlienta(totalGross){
  const carrier=Math.round((Number(totalGross)||0)*100)/100,customer=Math.ceil((carrier+4)-1e-9),commission=Math.round((customer-carrier)*100)/100;
  return {customerTotalGross:customer,commissionGross:commission,minimumCommissionGross:4,maximumCommissionGross:5};
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
  const total=inpostServiceWycenaKwota(pricing),rounded=total==null?null:inpostServicePelnaCenaKlienta(total),fee=Number.isFinite(Number(pricing.commissionGross))?Number(pricing.commissionGross):(rounded?.commissionGross||0);
  if(total==null){
    box.innerHTML=`<div class="inpost-price-empty warning"><b>Brak pasującej stawki w cenniku umownym</b><small>${esc(pricing.message||"Uzupełnij właściwą stawkę w cenniku albo podaj pełny koszt ręcznie. ShipX pozostaje wyłącznie kontrolą porównawczą.")}</small></div>`;
    return;
  }
  const customer=Number.isFinite(Number(pricing.customerTotalGross))?Number(pricing.customerTotalGross):rounded.customerTotalGross,b=pricing.breakdown||{},source=pricing.source==="manual"?"pełny koszt wpisany ręcznie":"Twój cennik umowny";
  const api=pricing.apiComparison||{},difference=Number.isFinite(Number(api.differenceGross))?Number(api.differenceGross):null;
  box.innerHTML=`<div class="inpost-price-main"><span><small>Koszt nadania</small><strong>${zl(total)}</strong></span><span><small>Prowizja Artway-TM</small><strong>${zl(fee)}</strong></span><span class="total"><small>Kwota na FV klienta</small><strong>${zl(customer)}</strong></span></div>
    ${pricing.complete&&!pricing.apiWarning?'<div class="inpost-price-meta"><span class="lvl lvl-ok">Cena dopasowana do pełnej kwoty</span><small>Prowizja pierwszego przedziału jest automatycznie dobierana w zakresie 4–5 zł.</small></div>':""}
    <div class="inpost-price-meta"><span class="lvl ${pricing.complete?"lvl-ok":"lvl-ostrzezenie"}">${esc(source)}</span><small>${esc(pricing.rateLabel||"stawka indywidualna")}</small>${Number(b.extrasGross)>0?`<small>Dopłaty: ${zl(b.extrasGross)}</small>`:""}<small>Opłata paliwowa: w cenie</small></div>
    ${pricing.complete?"":`<div class="inpost-price-warning"><b>Niepełna wycena opcji dodatkowych:</b> ${esc((pricing.unpricedOptions||[]).join(", ")||"brak stawki")}. Uzupełnij dopłaty w cenniku albo wpisz pełny koszt ręcznie — do tego czasu FV jest zablokowana.</div>`}
    ${pricing.apiWarning?`<div class="inpost-price-warning"><b>Cennik umowny działa, ale ShipX odrzucił kontrolę:</b> ${esc(pricing.apiWarning)}. Popraw wskazane dane przed utworzeniem przesyłki.</div>`:""}
    <div class="inpost-api-comparison"><span><b>Kontrola ShipX:</b> ${pricing.apiWarning?"niepotwierdzona":api.totalGross==null?"brak ceny API":zl(api.totalGross)}</span>${difference==null?"":`<span>Różnica: ${difference>0?"+":""}${zl(difference)}</span>`}</div>`;
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
  }else if(String(form?.elements?.sendingMethod?.value||"")==="parcel_locker"){
    rate=list.courierManager?.[template]||null;rateKey=rate?`courierManager.${template}`:"";
  }else{
    rate=(list.courierStandard||[]).find(item=>weight<=Number(item.maxKg))||null;rateKey=rate?`courierStandard.${rate.maxKg}`:"";
  }
  const selected=[],extras=list.extras||{};
  if(Number(form?.codAmount?.value)>0)selected.push(["Pobranie","codGross"]);
  if(Number(form?.insuranceAmount?.value)>0)selected.push(["Dodatkowa ochrona","insuranceGross"]);
  if(String(form?.elements?.weekend?.value||"")==="true")selected.push(["Paczka w Weekend","weekendGross"]);
  if(form?.elements?.sendingMethod?.value==="dispatch_order")selected.push(["Odbiór przez kuriera","pickupGross"]);
  if(form?.nonStandard?.checked)selected.push(["Element niestandardowy","nonStandardGross"]);
  form?.querySelectorAll('[name="additionalServices"]:checked').forEach(input=>{const labels={sms:["Powiadomienie SMS","smsGross"],email:["Powiadomienie e-mail","emailGross"],saturday:["Doręczenie w sobotę","saturdayGross"],dor1720:["Doręczenie 17:00–20:00","dor1720Gross"],rod:["Zwrot dokumentów","rodGross"]};if(labels[input.value])selected.push(labels[input.value]);});
  const unpricedOptions=selected.filter(([,key])=>extras[key]==null||extras[key]==="").map(([label])=>label),extrasGross=selected.reduce((sum,[,key])=>sum+(extras[key]==null||extras[key]===""?0:Number(extras[key])||0),0);
  const totalGross=rate?Math.round((Number(rate.gross||0)+extrasGross)*100)/100:null,rounded=totalGross==null?null:inpostServicePelnaCenaKlienta(totalGross);
  return {totalGross,currency:"PLN",source:rate?"contract_price_list":"unavailable",available:totalGross!=null,complete:totalGross!=null&&unpricedOptions.length===0,rateKey,rateLabel:rate?.label||"",contractNet:rate?.net??null,commissionGross:rounded?.commissionGross||0,customerTotalGross:rounded?.customerTotalGross??null,minimumCommissionGross:4,maximumCommissionGross:5,breakdown:{baseGross:rate?.gross??null,extrasGross:Math.round(extrasGross*100)/100,fuelIncluded:true},unpricedOptions,apiComparison:inpostServiceStan.pricing?.apiComparison||{totalGross:null},checkedAt:new Date().toISOString()};
}
function inpostServicePrzelicz(form){
  const manual=Math.max(0,Number(String(form?.carrierCostOverride?.value||"").replace(",","."))||0),rounded=manual>0?inpostServicePelnaCenaKlienta(manual):null;
  if(manual>0)inpostServiceStan.pricing={totalGross:manual,commissionGross:rounded.commissionGross,customerTotalGross:rounded.customerTotalGross,minimumCommissionGross:4,maximumCommissionGross:5,currency:"PLN",source:"manual",estimated:false,available:true,complete:true,breakdown:{},unpricedOptions:[],apiComparison:{totalGross:null}};
  else inpostServiceStan.pricing=inpostServiceLokalnaWycena(form);
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceZaplanujWycene(form){
  clearTimeout(inpostServiceWycenaTimer);
  inpostServiceNormalizujNadawceKlienta(form);
  inpostServiceAktualizujKartyStron(form);
  inpostServiceAktualizujAdresZwrotu(form);
  inpostServicePrzelicz(form);
  inpostServiceWycenaTimer=setTimeout(()=>inpostServiceWycena(form,false),650);
}
function inpostServiceAktualizujKartyStron(form){
  ["sender","receiver"].forEach(prefix=>{
    const summary=form?.querySelector?.(`[data-inpost-selected-contact="${prefix}"]`);if(!summary)return;
    summary.innerHTML=inpostServiceWybranyKontaktHTML(inpostServiceStronaOsoby(form,prefix),prefix);
  });
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
    if(e.code==="inpost_quote_validation"){inpostServiceBladPol(e.details,form,false);inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||"Uzupełnij dane nadania.",source:"validation"};}
    else inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||String(e),source:"unavailable"};
  }
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceUstawTyp(form,source=null){
  inpostServiceZastosujZgodnoscTypu(form,source?.name==="deliveryType");
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
      <label>Kod pocztowy ${prefix==="sender"?"*":""}<input name="${prefix}PostCode" ${prefix==="sender"?"required":"data-receiver-address"} pattern="\\d{2}-?\\d{3}" inputmode="numeric" autocomplete="postal-code" value="${esc(a.postCode||a.post_code||"")}" oninput="inpostServiceKodPocztowyWpis(this,${jsArg(prefix)})"></label>
      <label>Miasto ${prefix==="sender"?"*":""}<input name="${prefix}City" ${prefix==="sender"?"required":"data-receiver-address"} list="inpostService${prefix}CityHints" autocomplete="address-level2" value="${esc(a.city||"")}" oninput="inpostServiceMiastoWpis(this,${jsArg(prefix)})"><datalist id="inpostService${prefix}CityHints"></datalist></label>
      <div class="backend-note wide" data-inpost-postcode-hint="${prefix}" hidden></div>
      <label class="wide">Ulica ${prefix==="sender"?"*":""}<input name="${prefix}Street" ${prefix==="sender"?"required":"data-receiver-address"} list="inpostService${prefix}StreetHints" autocomplete="address-line1" value="${esc(a.street||"")}"><datalist id="inpostService${prefix}StreetHints"></datalist></label>
      <label>Nr budynku ${prefix==="sender"?"*":""}<input name="${prefix}Building" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.buildingNumber||a.building_number||"")}"></label>
      <label>Nr lokalu<input name="${prefix}Flat" value="${esc(a.flatNumber||a.flat_number||"")}"></label>
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
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),body={commissionGross:form.commissionGross?.value||4,defaultDeliveryType:form.defaultDeliveryType?.value||"locker",defaultSendingMethod:form.defaultSendingMethod?.value||"parcel_locker",defaultDropoffPoint:form.defaultDropoffPoint?.value||"",labelDefaultFormat:form.labelDefaultFormat?.value||"A6",labelOpenMode:form.labelOpenMode?.value||"preview",labelAutoPrint:form.labelAutoPrint?.checked===true,sender:inpostServiceStronaOsoby(form,"sender"),priceList:inpostServiceCennikZForm(form)};
  if(button){button.disabled=true;button.textContent="Zapisuję cennik…";}
  try{const d=await chmura("inpost-service-settings",{method:"POST",body,timeout:30000});inpostServiceStan.settings=d.settings||inpostServiceStan.settings;inpostServiceStan.pricing=null;toast("Cennik umowny, nadawca i prowizja zapisane ✅");renderuj();}catch(e){toast("Nie zapisano ustawień: "+(e.message||e));}
  finally{if(button){button.disabled=false;button.textContent="Zapisz cennik i ustawienia";}}
}
function inpostServicePrzejdzDoEtapu(id){
  const target=document.getElementById(String(id||""));if(!target)return;
  target.scrollIntoView({behavior:"smooth",block:"start"});
  try{target.focus({preventScroll:true});}catch(e){}
}
function inpostServiceFormHTML(){
  const sender=inpostServicePustyNadawcaKlienta(),settings=inpostServiceStan.settings||{},month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability,defaultDelivery=settings.defaultDeliveryType==="courier"?"courier":"locker",defaultMethod=["parcel_locker","dispatch_order","pop"].includes(settings.defaultSendingMethod)?settings.defaultSendingMethod:"parcel_locker";
  return `<section class="panel inpost-service-create">
    <div class="order-section-head"><div><span class="order-pro-label">Nadanie klienta</span><h2>Utwórz przesyłkę InPost</h2></div><div class="diag-actions"><span class="lvl ${available?.locker?"lvl-ok":"lvl-ostrzezenie"}">Paczkomat ${available?.locker?"aktywny":"sprawdź"}</span><span class="lvl ${available?.courier?"lvl-ok":"lvl-ostrzezenie"}">Kurier ${available?.courier?"aktywny":"sprawdź"}</span></div></div>
    <form id="inpostServiceForm" onsubmit="inpostServiceUtworz(event)" oninput="inpostServiceZaplanujWycene(this)" onchange="inpostServiceZaplanujWycene(this)">
      <input type="hidden" name="requestId" value="${esc(inpostServiceStan.requestId||inpostServiceNowyRequestId())}">
      <nav class="inpost-process-steps" aria-label="Etapy nadania"><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-delivery')"><b>1</b><span>Doręczenie</span></button><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-party-receiver')"><b>2</b><span>Odbiorca</span></button><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-shipment-options')"><b>3</b><span>Paczka i nadanie</span></button><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-settlement')"><b>4</b><span>Koszt i faktura</span></button></nav>
      <div class="inpost-shipment-builder">
        <fieldset id="inpost-delivery"><legend>Sposób doręczenia</legend>
          <div class="inpost-delivery-choice">
            <label class="inpost-choice-card"><input type="radio" name="deliveryType" value="locker" ${defaultDelivery==="locker"?"checked":""} onchange="inpostServiceUstawTyp(this.form,this)"><span><b>Paczkomat® 24/7</b><small>Doręczenie do automatu lub PaczkoPunktu</small></span></label>
            <label class="inpost-choice-card"><input type="radio" name="deliveryType" value="courier" ${defaultDelivery==="courier"?"checked":""} onchange="inpostServiceUstawTyp(this.form,this)"><span><b>InPost Kurier</b><small>Doręczenie bezpośrednio pod adres</small></span></label>
          </div>
          <div class="inpost-reference-row"><label>Numer referencyjny<input name="reference" required value="USL-${Date.now().toString(36).toUpperCase()}" placeholder="Nazwij swoją przesyłkę"></label><span><b>📒 ${inpostServiceStan.addressBook?.length||0}</b><small>adresów w książce</small></span></div>
        </fieldset>

        <fieldset id="inpost-party-sender" class="inpost-sender-context"><legend>Nadawca</legend>
          <input type="hidden" name="senderContactId" value="${esc(sender.id||"")}">
          <input type="checkbox" name="senderRoleSender" checked hidden>
          <div class="inpost-contact-selector"><div class="inpost-selected-contact" data-inpost-selected-contact="sender">${inpostServiceWybranyKontaktHTML(sender,"sender")}</div><div class="inpost-contact-selector-actions"><button class="btn" type="button" onclick="inpostServiceOtworzKsiazke('sender',this)">📒 Wybierz z książki</button><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres('sender',this)">＋ Nowy adres</button></div></div>
          <details><summary>Sprawdź lub popraw dane nadawcy</summary><div class="inpost-form-grid">
            <label>Firma<input name="senderCompany" value="${esc(sender.companyName||"")}"></label><label>NIP<input name="senderTaxCode" inputmode="numeric" maxlength="10" value="${esc(sender.taxCode||"")}"></label><label>Imię<input name="senderFirstName" value="${esc(sender.firstName||"")}"></label><label>Nazwisko<input name="senderLastName" value="${esc(sender.lastName||"")}"></label><label>E-mail *<input name="senderEmail" type="email" required value="${esc(sender.email||"")}"></label><label>Telefon *<input name="senderPhone" inputmode="tel" required value="${esc(sender.phone||"")}"></label><small class="wide inpost-technical-contact-note"><b>Na etykiecie nadawcą jest wybrany klient.</b> Dane firmowe Artway-TM nie są wstawiane do pola nadawcy. Brakujący e-mail lub telefon może być uzupełniony kontaktem technicznym Artway-TM. Uwagi pozostają puste, chyba że poniżej świadomie włączysz wyjątkowy tryb Artway-TM.</small>
            <label>Kod pocztowy *<input name="senderPostCode" required pattern="\\d{2}-?\\d{3}" inputmode="numeric" autocomplete="postal-code" value="${esc(sender.address?.postCode||sender.address?.post_code||"")}" oninput="inpostServiceKodPocztowyWpis(this,'sender')"></label><label>Miasto *<input name="senderCity" required list="inpostServicesenderCityHints" autocomplete="address-level2" value="${esc(sender.address?.city||"")}" oninput="inpostServiceMiastoWpis(this,'sender')"><datalist id="inpostServicesenderCityHints"></datalist></label><div class="backend-note wide" data-inpost-postcode-hint="sender" hidden></div><label class="wide">Ulica *<input name="senderStreet" required list="inpostServicesenderStreetHints" autocomplete="address-line1" value="${esc(sender.address?.street||"")}"><datalist id="inpostServicesenderStreetHints"></datalist></label><label>Nr budynku *<input name="senderBuilding" required value="${esc(sender.address?.buildingNumber||sender.address?.building_number||"")}"></label><label>Nr lokalu<input name="senderFlat" value="${esc(sender.address?.flatNumber||sender.address?.flat_number||"")}"></label>
            <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt('sender',this)">💾 Zapisz w książce</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt('sender',this)">Usuń zapis</button></div><label class="check wide"><input type="checkbox" name="saveSender" checked> Zapamiętaj lub zaktualizuj nadawcę</label>
          </div></details>
        </fieldset>

        <fieldset id="inpost-party-receiver"><legend>Dane odbiorcy</legend>
          <input type="hidden" name="receiverContactId">
          <input type="checkbox" name="receiverRoleReceiver" checked hidden>
          <div class="inpost-contact-selector"><div class="inpost-selected-contact" data-inpost-selected-contact="receiver">${inpostServiceWybranyKontaktHTML({},"receiver")}</div><div class="inpost-contact-selector-actions"><button class="btn" type="button" onclick="inpostServiceOtworzKsiazke('receiver',this)">📒 Wybierz z książki</button><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres('receiver',this)">＋ Nowy adres</button></div></div>
          <div class="inpost-form-grid">
            <label>E-mail *<input name="receiverEmail" type="email" required placeholder="Adres e-mail odbiorcy"></label><label>Telefon *<input name="receiverPhone" inputmode="tel" required placeholder="9 cyfr"></label><small class="wide inpost-technical-contact-note">Jeśli klient nie poda tych danych, formularz użyje kontaktu Artway-TM i oznaczy go jako techniczny.</small>
            <div class="wide" data-inpost-only="locker"><label>Punkt odbioru *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" required placeholder="Nazwa lub lokalizacja punktu"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape('target')">Mapa</button></div></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow('target')">Szukaj</button><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktowPrzyAdresie('receiver','target')">Przy adresie</button></div><div id="inpostServicePointResults"></div></div>
            <div class="wide inpost-courier-address" data-inpost-only="courier"><div class="inpost-form-grid"><label>Imię i nazwisko<input name="receiverFirstName" placeholder="Imię"><input name="receiverLastName" placeholder="Nazwisko"></label><label>Nazwa firmy<input name="receiverCompany"></label><label>NIP<input name="receiverTaxCode" inputmode="numeric" maxlength="10"></label><label>Kod pocztowy *<input name="receiverPostCode" data-receiver-address pattern="\\d{2}-?\\d{3}" inputmode="numeric" autocomplete="postal-code" oninput="inpostServiceKodPocztowyWpis(this,'receiver')"></label><label>Miasto *<input name="receiverCity" data-receiver-address list="inpostServicereceiverCityHints" autocomplete="address-level2" oninput="inpostServiceMiastoWpis(this,'receiver')"><datalist id="inpostServicereceiverCityHints"></datalist></label><div class="backend-note wide" data-inpost-postcode-hint="receiver" hidden></div><label class="wide">Ulica *<input name="receiverStreet" data-receiver-address list="inpostServicereceiverStreetHints" autocomplete="address-line1"><datalist id="inpostServicereceiverStreetHints"></datalist></label><label>Nr budynku *<input name="receiverBuilding" data-receiver-address></label><label>Nr lokalu<input name="receiverFlat"></label></div></div>
            <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt('receiver',this)">💾 Dodaj odbiorcę do książki</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt('receiver',this)">Usuń zapis</button></div><label class="check wide"><input type="checkbox" name="saveReceiver" checked> Zapamiętaj lub zaktualizuj odbiorcę</label>
          </div>
        </fieldset>

        <fieldset id="inpost-shipment-options"><legend>Rozmiar paczki</legend>
          <div class="inpost-size-choice">
            ${[["small","A","maks. 8 × 38 × 64 cm"],["medium","B","maks. 19 × 38 × 64 cm"],["large","C","maks. 41 × 38 × 64 cm"],["xlarge","D","maks. 80 × 50 × 50 cm"]].map(([value,label,description],index)=>`<label class="inpost-choice-card" ${value==="xlarge"?'data-inpost-size="xlarge" data-inpost-only="courier"':""}><input type="radio" name="template" value="${value}" ${index===0?"checked":""} onchange="inpostServiceUstawGabaryt(this.form,'${value}')"><span><b>${label}</b><small>${description}</small></span></label>`).join("")}
          </div>
          <input type="hidden" name="length" value="64"><input type="hidden" name="width" value="38"><input type="hidden" name="height" value="8">
          <div class="inpost-form-grid inpost-parcel-details"><label>Waga (kg)<input name="weight" type="number" min=".01" max="30" step=".01" value="1"></label><label class="check" data-inpost-only="courier"><input type="checkbox" name="nonStandard"> Element niestandardowy</label><label class="wide">Dodatkowe uwagi (opcjonalne)<input name="comments" maxlength="100" placeholder="Domyślnie pozostają puste"></label><label class="check wide"><input type="checkbox" name="technicalSenderRequired" onchange="inpostServiceAktualizujAdresZwrotu(this.form);inpostServiceZaplanujWycene(this.form)"> Wyjątkowo: InPost wymaga danych Artway-TM jako nadawcy na etykiecie</label><small class="wide inpost-technical-contact-note">Zaznacz tylko wtedy, gdy InPost wymaga Artway-TM na etykiecie. W tym trybie dane wybranego klienta zostaną dopisane do uwag.</small><div class="backend-note wide inpost-return-address"><b>Automatyczny dopisek do uwag</b><span data-inpost-return-address>Domyślnie nic nie dopisujemy do uwag.</span></div></div>
        </fieldset>

        <fieldset><legend>Dodatkowe usługi</legend>
          <div class="inpost-extra-services">
            <label>Wartość pobrania<input name="codAmount" type="number" min="0" step=".01" placeholder="Wpisz kwotę, aby nadać za pobraniem"></label>
            <div><span>Dodatkowa ochrona</span><div class="inpost-protection-choice">${[[0,"Brak"],[5000,"Do 5 000 zł"],[10000,"Do 10 000 zł"],[20000,"Do 20 000 zł"]].map(([value,label],index)=>`<label class="inpost-choice-card compact"><input type="radio" name="insuranceAmount" value="${value}" ${index===0?"checked":""}><span><b>${label}</b></span></label>`).join("")}</div></div>
            <div data-inpost-only="locker"><span>Paczka w Weekend</span><div class="inpost-weekend-choice"><label class="inpost-choice-card compact"><input type="radio" name="weekend" value="false" checked><span><b>Nie</b></span></label><label class="inpost-choice-card compact"><input type="radio" name="weekend" value="true"><span><b>Tak</b></span></label></div></div>
            <div class="inpost-courier-extras" data-inpost-only="courier"><label class="check"><input type="checkbox" name="additionalServices" value="sms"> SMS</label><label class="check"><input type="checkbox" name="additionalServices" value="email"> E-mail</label><label class="check"><input type="checkbox" name="additionalServices" value="saturday"> Sobota</label><label class="check"><input type="checkbox" name="additionalServices" value="dor1720"> 17:00–20:00</label><label class="check"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label></div>
          </div>
        </fieldset>

        <fieldset><legend>Sposób nadania</legend>
          <div class="backend-note inpost-method-compatibility" data-inpost-method-compatibility hidden><b>Domyślny Paczkomat nie jest dostępny dla Kuriera Standard.</b> InPost dopuszcza tutaj PaczkoPunkt/POP albo odbiór przez kuriera. Wybierz świadomie jedną z tych metod — formularz nie przełączy jej automatycznie.</div>
          <div class="inpost-method-choice">${inpostServiceMetodyNadania.locker.map(([value,label])=>`<label class="inpost-method-card" data-inpost-method-card><input type="radio" name="sendingMethod" value="${value}" ${value===defaultMethod?"checked":""} onchange="inpostServiceUstawTyp(this.form)"><span><b>${esc(label)}</b><small>${value==="parcel_locker"?"Wybierz automat nadawczy":value==="dispatch_order"?"Odbiór z adresu nadawcy":"Nadaj w obsługiwanym punkcie"}</small></span></label>`).join("")}</div>
          <div class="inpost-dropoff-panel" data-inpost-dropoff-panel hidden><label><span data-inpost-dropoff-label>Automat nadawczy *</span><div class="inpost-inline"><input id="inpostServiceDropoffPoint" name="dropoffPoint" value="${esc(settings.defaultDropoffPoint||"")}" placeholder="Wybierz automat nadawczy"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape('dropoff')">Mapa</button></div><small data-inpost-dropoff-hint></small></label><div class="inpost-point-search"><input id="inpostServiceDropoffSearch" placeholder="Miasto, kod, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow('dropoff')">Szukaj</button></div><div id="inpostServiceDropoffResults"></div></div>
        </fieldset>

        <div class="inpost-options-layout">
        <fieldset class="inpost-billing-card" id="inpost-settlement"><legend>💰 Koszt i faktura Artway‑TM</legend>
          <div class="inpost-pricing-layout"><div data-inpost-pricing></div><div class="inpost-pricing-controls"><label>Pełny koszt ręczny — tylko awaryjnie<input name="carrierCostOverride" type="number" min="0" step=".01" placeholder="zastępuje cennik umowny"></label><button class="btn ghost" type="button" onclick="inpostServiceWycena(this.form,true)">↻ Przelicz według umowy</button><a class="btn ghost" href="#/admin/wysylki/inpost-ustawienia">Otwórz cennik</a></div></div>
          <div class="inpost-settlement-grid">
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="none" checked><span><b>Bez faktury</b><small>Tylko nadanie i rejestr kosztu</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="single"><span><b>FV od razu</b><small>Artway‑TM wystawia koszt nadania + prowizję</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="monthly"><span><b>FV miesięczna</b><small>Dopisz całe nadanie do rozliczenia klienta</small></span></label>
          </div>
          <div class="inpost-form-grid"><label>Miesiąc rozliczenia<input name="billingMonth" type="month" value="${esc(month)}"></label><label>Pierwszy przedział prowizji<input value="4–5 zł" readonly><input name="commissionGross" type="hidden" value="4"><small>Cena końcowa jest zawsze zaokrąglana w górę do pełnej złotówki.</small></label></div>
          <div class="backend-note"><b>FV: Artway‑TM → nadawca.</b> Odbiorca pozostaje wyłącznie stroną doręczenia.</div>
        </fieldset>
      </div>
      </div>
      <div class="inpost-form-errors" data-inpost-form-errors hidden></div>
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
      <td data-label="Wybór"><label class="inpost-confirm-checkbox"><input type="checkbox" data-inpost-confirm-checkbox ${inpostServicePotwierdzenieWybrane.has(item.id)?"checked":""} onchange="inpostServiceZaznaczPotwierdzenie(${jsArg(item.id)},this.checked,this)"><span>Do wspólnego potwierdzenia</span></label></td>
      <td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td>
      <td data-label="Odbiorca"><b>${esc(inpostServiceNazwaKontaktu(item.receiver))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.receiver))}</small><br><small>${esc(item.receiver?.email||"")}</small></td>
      <td data-label="Usługa">${item.deliveryType==="locker"?"📮 Paczkomat":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td>
      <td data-label="Koszt">${inpostServiceKosztHTML(item)}</td>
      <td data-label="Status">${label}<br><small>${events.length} zdarzeń • aktualizacja ${esc(inpostServiceDataPotwierdzenia(item.trackingUpdatedAt||item.updatedAt))}</small></td>
      <td data-label="Rozliczenie">${inpostServiceBillingLabel(item)}<br><small>FV klienta: ${item.billing?.mode==="none"?"—":zl(item.pricing?.customerTotalGross||0)}</small></td>
      <td data-label="Akcje"><div class="inpost-row-actions"><button class="btn receipt" onclick="inpostServicePotwierdzenie(${jsArg(item.id)})">🖨️ Potwierdzenie</button><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.labelReady&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">🚚 Zamów kuriera</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" ${item.pricing?.complete===true?"":"disabled title='Uzupełnij koszt przesyłki'"} onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td>
    </tr>`;
  };
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr</span><h2>Nadania i tracking</h2></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Numer, klient, tracking lub rozliczenie.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="inpost-batch-confirmation"><div><b>Jedno potwierdzenie dla wielu paczek</b><small>Zaznacz przesyłki tego samego zleceniodawcy. Wybrano: <strong data-inpost-confirm-count>${inpostServicePotwierdzenieWybrane.size}</strong></small></div><div><button class="btn receipt" data-inpost-confirm-selected ${inpostServicePotwierdzenieWybrane.size?"":"disabled"} onclick="inpostServicePotwierdzenieZbiorcze()">🖨️ Potwierdzenie zbiorcze A4</button><button class="btn ghost" data-inpost-confirm-clear ${inpostServicePotwierdzenieWybrane.size?"":"disabled"} onclick="inpostServiceWyczyscWyborPotwierdzenia()">Wyczyść wybór</button></div></div><div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table admin-responsive-table"><thead><tr><th>Wybór</th><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Koszt</th><th>Status i historia</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(row).join("")||'<tr><td colspan="8">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function inpostServiceMiesieczneHTML(){
  const groups=inpostServiceStan.billing?.groups||[];if(!groups.length)return "";
  return `<section class="panel inpost-monthly-billing"><div class="order-section-head"><div><span class="order-pro-label">Faktury Artway‑TM</span><h2>Rozliczenia miesięczne</h2></div><a class="btn ghost" href="#/admin/infakt/wysylki">Otwórz w inFakt</a></div><div class="inpost-monthly-grid">${groups.map(group=>`<article><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small><small>Koszt nadań ${zl(group.carrierGross||0)} + prowizja ${zl(group.commissionGross||0)}</small>${group.incompletePrices?`<span class="lvl lvl-ostrzezenie">${group.incompletePrices} niepełnych wycen</span>`:""}</div><strong>${zl(group.customerTotalGross||0)}</strong><button class="btn" ${group.incompletePrices?"disabled title='Najpierw uzupełnij koszty'":""} onclick="inpostServiceFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz FV Artway‑TM</button></article>`).join("")}</div></section>`;
}
function inpostServicePanelLadowania(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram konfigurację i rejestr InPost…</div></div>';
  return "";
}
function inpostServiceStatystykiHTML(){
  const billing=inpostServiceStan.billing||{};
  return `<section class="inpost-service-stats"><article><span>📦</span><b>${inpostServiceStan.items.length}</b><small>nadań</small></article><article><span>📤</span><b>${inpostServiceAdresy().filter(c=>(c.roles||[]).includes("sender")).length}</b><small>nadawców</small></article><article><span>📥</span><b>${inpostServiceAdresy().filter(c=>(c.roles||[]).includes("receiver")).length}</b><small>odbiorców</small></article><article><span>🧾</span><b>${zl(billing.customerPendingGross||0)}</b><small>do FV miesięcznych</small></article></section>`;
}
function inpostServiceBladHTML(){return inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:"";}
function panelRejestruWysylekInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  return `<div class="inpost-service-workspace">${inpostServiceStatystykiHTML()}${inpostServiceBladHTML()}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}</div>`;
}
function inpostServiceUstawieniaGlowneHTML(){
  const settings=inpostServiceStan.settings||{},delivery=settings.defaultDeliveryType==="courier"?"courier":"locker",method=["parcel_locker","dispatch_order","pop"].includes(settings.defaultSendingMethod)?settings.defaultSendingMethod:"parcel_locker";
  return `<section class="panel inpost-service-defaults"><div class="order-section-head"><div><span class="order-pro-label">Domyślne wartości</span><h2>Nadanie i etykiety</h2><p class="order-detail-lead">Te ustawienia są używane przy każdym nowym formularzu. Nadal można je zmienić dla konkretnej paczki.</p></div></div><div class="inpost-form-grid"><label>Domyślne doręczenie<select name="defaultDeliveryType"><option value="locker" ${delivery==="locker"?"selected":""}>Paczkomat / PaczkoPunkt</option><option value="courier" ${delivery==="courier"?"selected":""}>Kurier InPost</option></select></label><label>Domyślny sposób nadania<select name="defaultSendingMethod"><option value="parcel_locker" ${method==="parcel_locker"?"selected":""}>Nadanie w Paczkomacie</option><option value="dispatch_order" ${method==="dispatch_order"?"selected":""}>Odbiór przez kuriera</option><option value="pop" ${method==="pop"?"selected":""}>Nadanie w PaczkoPunkcie</option></select></label><label>Domyślny automat nadawczy<input name="defaultDropoffPoint" value="${esc(settings.defaultDropoffPoint||"")}" placeholder="np. BOJ01N"></label><label>Domyślny format etykiety<select name="labelDefaultFormat"><option value="A6" ${settings.labelDefaultFormat!=="A4"?"selected":""}>A6 — drukarka etykiet</option><option value="A4" ${settings.labelDefaultFormat==="A4"?"selected":""}>A4 — Brother</option></select></label><label>Otwieranie etykiety<select name="labelOpenMode"><option value="preview" ${settings.labelOpenMode!=="browser"?"selected":""}>Podgląd przed drukiem</option><option value="browser" ${settings.labelOpenMode==="browser"?"selected":""}>Nowa karta PDF</option></select></label><label class="check"><input name="labelAutoPrint" type="checkbox" ${settings.labelAutoPrint===true?"checked":""}> Otwieraj okno drukowania automatycznie</label></div></section>`;
}
function panelUstawienWysylkiInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  return `<div class="inpost-service-workspace">${inpostServiceBladHTML()}<form id="inpostServiceSettingsForm" class="inpost-service-settings-page" onsubmit="inpostServiceZapiszUstawienia(event)">${inpostServiceUstawieniaGlowneHTML()}<section class="panel">${inpostServiceCennikHTML()}</section><section class="panel">${inpostServiceOsobaFields("sender","Stałe dane nadawcy",inpostServiceNadawca())}</section><div class="panel inpost-settings-footer"><label>Pierwszy przedział prowizji<input value="4–5 zł" readonly><input name="commissionGross" type="hidden" value="4"><small>Cena końcowa jest zawsze zaokrąglana w górę do pełnej złotówki.</small></label><button class="btn" type="submit">💾 Zapisz ustawienia InPost</button></div></form></div>`;
}
function panelOdbioruKurieraInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  const active=(inpostServiceStan.items||[]).filter(item=>item.labelReady&&item.status!=="cancelled"),waiting=active.filter(item=>!item.pickup?.id),booked=active.filter(item=>item.pickup?.id);
  const rows=items=>items.map(item=>`<tr><td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"")}</small></td><td data-label="Nadawca"><b>${esc(inpostServiceNazwaKontaktu(item.sender))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.sender))}</small></td><td data-label="Paczka">${item.deliveryType==="courier"?"Kurier":"Paczkomat"} • ${esc(item.parcel?.template||"")} • ${esc(item.parcel?.weight||1)} kg</td><td data-label="Odbiór">${item.pickup?.id?`<span class="lvl lvl-ok">zlecony</span><br><small>${esc(item.pickup.status||item.pickup.id)}</small>`:`<button class="btn" type="button" onclick="inpostServiceOdbior(${jsArg(item.id)})">🚚 Zamów kuriera</button>`}</td></tr>`).join("");
  return `<div class="inpost-service-workspace">${inpostServiceBladHTML()}<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Gotowe etykiety</span><h2>Paczki do zgłoszenia kurierowi</h2><p class="order-detail-lead">Kliknięcie „Zamów kuriera” wysyła osobne zlecenie odbioru do InPost dopiero dla wybranej paczki.</p></div><button class="btn ghost" type="button" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div><div class="warehouse-worktable-wrap"><table class="log-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Nadawca</th><th>Paczka</th><th>Odbiór</th></tr></thead><tbody>${rows(waiting)||'<tr><td colspan="4">Brak paczek oczekujących na zlecenie odbioru.</td></tr>'}</tbody></table></div></section>${booked.length?`<section class="panel"><h2>Odbiory już zlecone</h2><div class="warehouse-worktable-wrap"><table class="log-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Nadawca</th><th>Paczka</th><th>Odbiór</th></tr></thead><tbody>${rows(booked)}</tbody></table></div></section>`:""}</div>`;
}
function panelWysylkiUslugowejInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  setTimeout(()=>{const form=document.getElementById("inpostServiceForm");inpostServiceUstawTyp(form);inpostServiceAktualizujWyceneUI(form);inpostServiceAdresPodpowiedzi(form,"sender");inpostServiceAdresPodpowiedzi(form,"receiver");},0);
  return `<div class="inpost-service-workspace">${inpostServiceStatystykiHTML()}${inpostServiceBladHTML()}${inpostServiceFormHTML()}${inpostServiceMiesieczneHTML()}</div>`;
}
