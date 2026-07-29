/* GENERATED ADMIN PRODUCT EDITOR — loaded only for product and channel editing */
let productEditorProducentRejestr={loaded:false,loading:false,profiles:[],error:""};
async function productEditorLadujProducentow(){
  if(productEditorProducentRejestr.loaded||productEditorProducentRejestr.loading)return productEditorProducentRejestr.profiles;
  productEditorProducentRejestr.loading=true;
  try{
    const data=await chmura("catalog-manufacturer-directory",{params:{limit:100},timeout:20000});
    productEditorProducentRejestr={loaded:true,loading:false,profiles:Array.isArray(data.profiles)?data.profiles:[],error:""};
  }catch(error){productEditorProducentRejestr={loaded:false,loading:false,profiles:[],error:String(error?.message||error)};}
  return productEditorProducentRejestr.profiles;
}
function productEditorProducentProfilHTML(profile={},matching={}){
  if(!profile?.id)return `<div class="product-manufacturer-empty"><b>Profil nie jest jeszcze dopasowany</b><small>Wpisz producenta. System sprawdzi nazwę, markę, domenę źródła i EAN, a następnie zapisze jeden zweryfikowany profil w kartotece.</small></div>`;
  const confidence=Number(matching.confidence??profile.confidence);
  return `<article class="product-manufacturer-profile" data-product-manufacturer-preview>
    <header><div><span>✓ Zweryfikowana firma</span><h3>${esc(profile.displayName||profile.manufacturerName||profile.legalName)}</h3><small>${esc(profile.legalName||"")}</small></div>${Number.isFinite(confidence)?`<strong>${Math.round(confidence*100)}%</strong>`:""}</header>
    <dl><div><dt>Adres</dt><dd>${esc(profile.address||"—")}</dd></div><div><dt>E-mail</dt><dd>${profile.email?`<a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>`:"—"}</dd></div><div><dt>Telefon</dt><dd>${profile.phone?`<a href="tel:${esc(profile.phone)}">${esc(profile.phone)}</a>`:"—"}</dd></div><div><dt>Strona</dt><dd>${profile.website?`<a href="${esc(profile.website)}" target="_blank" rel="noopener">${esc(profile.website)} ↗</a>`:"—"}</dd></div></dl>
    <footer><span>Źródło oficjalne • weryfikacja ${esc(profile.verifiedAt||"—")}</span>${profile.sourceUrl?`<a href="${esc(profile.sourceUrl)}" target="_blank" rel="noopener">Sprawdź źródło ↗</a>`:""}</footer>
  </article>`;
}
function productEditorProducentPoleHTML(p={}){
  const profile=p.manufacturerProfile||{},producer=normalizujNazweProducenta(allegroProducentKanoniczny(p)||p.producent||p.marka||"");
  setTimeout(()=>void productEditorLadujProducentow(),0);
  return `<div class="f-group product-manufacturer-picker" data-product-manufacturer-picker>
    <label>Producent *</label>
    <div class="product-manufacturer-search"><span>⌕</span><input required autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" name="producent" value="${esc(producer)}" placeholder="Wpisz nazwę, markę lub firmę…" onfocus="productEditorProducentSzukaj(this)" oninput="walidujPoleProducenta(this);productEditorProducentWpisany(this)" pattern=".*[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż].*" title="Podaj nazwę zawierającą co najmniej jedną literę"><i>${profile.id?"zweryfikowany":"wyszukaj"}</i></div>
    <input type="hidden" name="manufacturerProfileId" value="${esc(p.manufacturerProfileId||profile.id||"")}">
    <div class="product-manufacturer-results" data-product-manufacturer-results hidden></div>
    <small>Jedno pole producenta dla sklepu, GPSR, Allegro i Von Halsky. Marka pozostaje osobnym polem.</small>
  </div>`;
}
function productEditorProducentWpisany(input){
  const form=input?.form,picker=input?.closest?.("[data-product-manufacturer-picker]"),profileId=form?.elements?.manufacturerProfileId;
  if(profileId)profileId.value="";
  const badge=picker?.querySelector?.(".product-manufacturer-search i");if(badge)badge.textContent="wyszukaj";
  const preview=form?.querySelector?.("[data-product-manufacturer-card]");if(preview)preview.innerHTML=productEditorProducentProfilHTML();
  void productEditorProducentSzukaj(input);
}
async function productEditorProducentSzukaj(input){
  const picker=input?.closest?.("[data-product-manufacturer-picker]"),box=picker?.querySelector?.("[data-product-manufacturer-results]");if(!box)return;
  const profiles=await productEditorLadujProducentow(),query=String(input.value||"").trim().toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const score=profile=>{
    const values=[profile.displayName,profile.manufacturerName,profile.legalName,...(profile.aliases||[]),...(profile.brandAliases||[])].map(value=>String(value||"").toLocaleLowerCase("pl-PL").normalize("NFD").replace(/[\u0300-\u036f]/g,""));
    return values.some(value=>value===query)?100:values.some(value=>value.startsWith(query))?90:values.some(value=>value.includes(query))?80:0;
  };
  const visible=profiles.map(profile=>({profile,score:query?score(profile):1})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
  box.hidden=false;input.setAttribute("aria-expanded","true");
  box.innerHTML=visible.length?visible.map(({profile})=>`<button type="button" onclick="productEditorWybierzProducent(this,${jsArg(profile.id)})"><b>${esc(profile.displayName||profile.manufacturerName)}</b><span>${esc(profile.legalName||"")}</span><small>${esc(profile.address||"")} • ${esc(profile.email||"")}</small></button>`).join(""):`<div class="product-manufacturer-no-result"><b>Brak pewnego profilu</b><small>Nie zgadujemy kontaktów. Pozostaw nazwę — Agent oznaczy firmę do późniejszej weryfikacji.</small></div>`;
}
function productEditorWybierzProducent(button,profileId){
  const profile=productEditorProducentRejestr.profiles.find(item=>String(item.id)===String(profileId)),form=button?.closest?.("form"),picker=button?.closest?.("[data-product-manufacturer-picker]");if(!profile||!form||!picker)return;
  form.elements.producent.value=profile.manufacturerName||profile.displayName||"";form.elements.manufacturerProfileId.value=profile.id;
  const brand=form.elements.marka;if(brand&&!String(brand.value||"").trim())brand.value=profile.displayName||profile.manufacturerName||"";
  const box=picker.querySelector("[data-product-manufacturer-results]");if(box)box.hidden=true;form.elements.producent.setAttribute("aria-expanded","false");
  const preview=form.querySelector("[data-product-manufacturer-card]");if(preview)preview.innerHTML=productEditorProducentProfilHTML(profile,{confidence:1});
  toast(`✓ Dopasowano oficjalny profil: ${profile.displayName||profile.manufacturerName}`);
}
function productEditorWartoscKartoteki(value){
  if(value===null||value===undefined||value==="")return "—";
  if(typeof value==="boolean")return value?"tak":"nie";
  if(Array.isArray(value))return value.length?value.map(item=>typeof item==="object"?JSON.stringify(item):String(item)).join(" • "):"—";
  if(typeof value==="object")return JSON.stringify(value);
  return String(value);
}
function productEditorPokazWszystkiePola(button){
  const form=button?.closest?.("form"),id=String(form?.dataset?.productId||""),product=pobierzProduktAdmin(id),box=button?.closest?.("[data-product-all-fields]")?.querySelector?.("[data-product-all-fields-list]");if(!product||!box)return;
  const entries=Object.entries(product).sort(([left],[right])=>left.localeCompare(right,"pl"));
  box.innerHTML=entries.map(([field,value])=>`<article><b>${esc(field)}</b><span>${esc(productEditorWartoscKartoteki(value))}</span></article>`).join("");
  box.hidden=false;button.remove();
}
function productEditorPelnaKartotekaHTML(p={}){
  const profile=p.manufacturerProfile||{},lastFields=Array.isArray(p.lastAdminMutationFields)?p.lastAdminMutationFields:[],agentEntries=Object.entries(p).filter(([field,value])=>value!==undefined&&/(agent|editorial|allegro.*(?:status|missing|error|run|prepared|checked|confirmed)|vonHalsky.*(?:status|missing|error|run|prepared|checked|confirmed)|sourceEvidence|sourceMaterial|manufacturerProfile|gpsr)/i.test(field));
  const sections=[
    {label:"Tożsamość",ok:!!(p.gtin||p.ean||p.kodProducenta||p.mpn),detail:[p.gtin||p.ean,kodKanonicznyProduktu(p)].filter(Boolean).join(" • ")||"brak kodów"},
    {label:"Producent i GPSR",ok:!!profile.id,detail:profile.displayName||profile.legalName||"profil niedopasowany"},
    {label:"Treści",ok:!!(p.nazwa&&p.opisKrotki&&p.opis),detail:`sklep ${p.opisKrotki&&p.opis?"gotowy":"niepełny"} • Allegro ${p.allegroDescription?"gotowe":"oczekuje"} • Von Halsky ${p.vonHalskyDescription?"gotowe":"oczekuje"}`},
    {label:"Media",ok:!!p.zdjecie,detail:`${p.zdjecie?"zdjęcie główne":"brak zdjęcia"} • ${(p.zdjecia||[]).length} w galerii`},
    {label:"Źródło",ok:!!(p.sourceUrl||p.producentUrl),detail:p.sourceEvidence?.host||p.sourceUrl||p.producentUrl||"brak źródła"},
    {label:"Kanały",ok:!!(p.allegroAgentPreparationStatus||p.vonHalskyAgentStatus),detail:`Allegro ${p.allegroAgentPreparationStatus||"oczekuje"} • Von Halsky ${p.vonHalskyAgentStatus||"oczekuje"}`},
  ];
  return `<section class="product-editor-section product-central-record" id="product-editor-record"><header class="product-editor-section-head"><div><span>Jedno źródło prawdy</span><h2>Pełna kartoteka produktu</h2><p>Edytor został otwarty z pełnego rekordu serwera. Wszystkie moduły i kanały korzystają z tych samych danych.</p></div><div class="product-record-revision"><b>${esc(p._catalog?.revision||p.lastAdminMutationId||"rekord centralny")}</b><small>${p.lastAdminMutationAt?`ostatnia zmiana ${esc(allegroDataTxt(p.lastAdminMutationAt))}`:"brak daty ostatniej zmiany"}</small></div></header>
    <div class="product-record-completeness">${sections.map(section=>`<article class="${section.ok?"is-ready":"needs-work"}"><span>${section.ok?"✓":"!"}</span><div><b>${esc(section.label)}</b><small>${esc(section.detail)}</small></div></article>`).join("")}</div>
    <div data-product-manufacturer-card>${productEditorProducentProfilHTML(profile,{confidence:p.manufacturerProfileConfidence})}</div>
    <details class="product-record-agent-fields" ${agentEntries.some(([field])=>/error|missing/i.test(field))?"open":""}><summary>Dane i wyniki zapisane przez Agentów (${agentEntries.length})</summary><div>${agentEntries.map(([field,value])=>`<article><b>${esc(field)}</b><span>${esc(productEditorWartoscKartoteki(value))}</span></article>`).join("")||"<p>Agent nie zapisał jeszcze dodatkowych danych.</p>"}</div></details>
    <details class="product-record-last-write"><summary>Ostatni potwierdzony zapis (${lastFields.length} pól)</summary><p>${lastFields.length?lastFields.map(field=>`<span>${esc(field)}</span>`).join(""):"Brak historii pól dla starszej kartoteki."}</p><small>Operacja: ${esc(p.lastAdminMutationArea||"—")} • wykonawca: ${esc(p.lastAdminMutationBy||"—")}</small></details>
    <details class="product-record-all-fields" data-product-all-fields><summary>Wszystkie informacje zapisane przy produkcie (${Object.keys(p).length} pól)</summary><button class="btn ghost" type="button" onclick="productEditorPokazWszystkiePola(this)">Pokaż pełny zapis techniczny</button><div class="product-record-all-fields-list" data-product-all-fields-list hidden></div></details>
  </section>`;
}
function productEditorCzyAllegroWybrane(p={}){
  let linked=false;
  try{linked=!!allegroOfertaDlaProduktuSklepu(p);}catch(error){linked=false;}
  return !!(linked||p.allegroOfferId||p.allegroProductId||p.allegroCategoryId||p.allegroPublicationIntent===true||["queued","preparing","ready","published"].includes(String(p.allegroPreparationStatus||"").toLowerCase()));
}
function productEditorZastosujWspolnaTresc(p={},poprzedni={}){
  const now=new Date().toISOString(),allegroSelected=productEditorCzyAllegroWybrane(p),states={...(p.contentEditorial?.channelStates||{})};
  const changed=(keys)=>keys.some(key=>String(p[key]||"")!==String(poprzedni[key]||""));
  const storeChanged=changed(["nazwa","opisKrotki","opis"]),allegroChanged=changed(["allegroTitle","allegroShortDescription","allegroDescription"]),vonChanged=changed(["vonHalskyTitle","vonHalskyShortDescription","vonHalskyDescription"]);
  if(storeChanged)states.store={...(states.store||{}),status:"needs_review",updatedAt:now,updatedBy:"administrator",reason:"manual_store_edit"};
  if(allegroChanged){
    states.allegro={...(states.allegro||{}),status:"needs_review",updatedAt:now,updatedBy:"administrator",reason:"manual_allegro_edit"};
    delete p.allegroDescriptionSections;
    if(allegroSelected){p.allegroEditorialSyncPending=true;p.allegroEditorialSyncPendingAt=now;p.allegroEditorialSyncState="queued";p.allegroEditorialSyncError="";}
  }
  p.vonHalskyContentMode="custom";
  if(vonChanged){
    states.vonHalsky={...(states.vonHalsky||{}),status:"needs_review",updatedAt:now,updatedBy:"administrator",reason:"manual_von_halsky_edit"};
    p.vonHalskyContentUpdatedAt=now;p.vonHalskyContentSource="administrator-independent-channel-content";
    p.vonHalskyEditorialSyncPending=true;p.vonHalskyEditorialSyncPendingAt=now;p.vonHalskyEditorialSyncState="queued";p.vonHalskyEditorialSyncError="";
  }
  const required=["store","vonHalsky",...(allegroSelected?["allegro"]:[])],ready=required.filter(key=>states[key]?.status==="ready").length;
  p.contentEditorial={...(p.contentEditorial||{}),status:ready===required.length?"ready":ready?"partial_ready":"needs_review",channels:allegroSelected?"independent_store_allegro_von_halsky":"independent_store_von_halsky",targets:{store:true,vonHalsky:true,allegro:allegroSelected},layoutPolicy:"independent_channel_versions",channelStates:states,source:"product-editor-independent-content",updatedAt:now};
  return p;
}
function productEditorTrescStan(p={}){
  const allegro=productEditorCzyAllegroWybrane(p),states=p.contentEditorial?.channelStates||{};
  const store={short:String(p.opisKrotki||p.krotkiOpis||""),full:String(p.opis||""),status:states.store?.status||"needs_review"};
  const allegroContent={short:String(p.allegroShortDescription||p.opisKrotki||p.krotkiOpis||""),full:String(p.allegroDescription||p.opis||""),status:states.allegro?.status||"needs_review"};
  const vonHalsky={title:String(p.vonHalskyTitle||p.nazwa||""),short:String(p.vonHalskyShortDescription||p.opisKrotki||p.krotkiOpis||""),full:String(p.vonHalskyDescription||p.opis||""),status:states.vonHalsky?.status||"needs_review"};
  return {allegro,store,allegroContent,vonHalsky,complete:!!(store.short&&store.full),pending:allegro&&p.allegroEditorialSyncPending===true};
}
function productEditorVonHalskyTrescStan(p={}){return productEditorTrescStan(p).vonHalsky;}
function productEditorStatusKanalu(status="needs_review"){
  return status==="ready"?["is-ready","✓ Gotowe"]:status==="retry_pending"?["is-pending","↻ Ponowna próba"]:["needs-work","! Do kontroli"];
}
function productEditorDaneWspolneDefinicja(p={}){
  const text=value=>String(value??"").trim(),count=value=>Array.isArray(value)?value.length:value&&typeof value==="object"?Object.keys(value).length:0;
  const profile=p.manufacturerProfile||{},producer=profile.displayName||profile.manufacturerName||p.producent||"",gpsr=profile.address&&(profile.email||profile.phone)?`${profile.address} • ${profile.email||profile.phone}`:"";
  return [
    {label:"GTIN / EAN",value:text(p.gtin||p.ean),required:true,source:"Tożsamość"},
    {label:"Kod producenta / SKU",value:text(kodKanonicznyProduktu(p)),required:true,source:"Tożsamość"},
    {label:"Producent",value:text(producer),required:true,source:"Kartoteka producenta"},
    {label:"Marka",value:text(p.marka||p.brand||producer),required:false,source:"Tożsamość"},
    {label:"GPSR / podmiot odpowiedzialny",value:text(gpsr),required:true,source:"Kartoteka producenta",display:gpsr?"kompletne":""},
    {label:"Zdjęcie główne",value:text(p.zdjecie),required:true,source:"Media",display:p.zdjecie?"zapisane":""},
    {label:"Galeria",value:count(p.zdjecia),required:false,source:"Media",display:`${count(p.zdjecia)} zdjęć`},
    {label:"Źródło produktu",value:text(p.sourceUrl||p.producentUrl),required:false,source:"Źródło",display:text(p.sourceUrl||p.producentUrl)?"zweryfikowane":""},
  ];
}
function productEditorKanalDefinicja(p={},channel="store"){
  const text=value=>String(value??"").trim(),count=value=>Array.isArray(value)?value.length:value&&typeof value==="object"?Object.keys(value).length:0;
  const shared=productEditorDaneWspolneDefinicja(p);
  const own=channel==="store"?[
    {label:"Nazwa w sklepie",value:text(p.nazwa),required:true,source:"Sklep"},
    {label:"Kategoria sklepu",value:text(p.kategoria),required:true,source:"Sklep"},
    {label:"Cena sklepu",value:Number(p.cena)>0?p.cena:"",required:true,source:"Sklep",display:Number(p.cena)>0?zl(p.cena):""},
    {label:"Opis krótki",value:text(p.opisKrotki||p.krotkiOpis),required:true,source:"Sklep",display:text(p.opisKrotki||p.krotkiOpis)?`${text(p.opisKrotki||p.krotkiOpis).length} znaków`:""},
    {label:"Opis pełny",value:text(p.opis),required:true,source:"Sklep",display:text(p.opis)?`${text(p.opis).length} znaków`:""},
    {label:"SEO",value:text(p.seoTitle||p.nazwa)&&text(p.seoDescription||p.opisKrotki),required:true,source:"Sklep / SEO",display:text(p.seoTitle||p.nazwa)&&text(p.seoDescription||p.opisKrotki)?"kompletne":""},
  ]:channel==="allegro"?[
    {label:"Tytuł Allegro",value:text(p.allegroTitle||p.nazwa),required:true,source:p.allegroTitle?"Allegro":"Dziedziczone z danych wspólnych"},
    {label:"Cena Allegro",value:Number(p.cenaAllegro||p.cena)>0?p.cenaAllegro||p.cena:"",required:true,source:p.cenaAllegro?"Allegro":"Dziedziczone ze Sklepu",display:Number(p.cenaAllegro||p.cena)>0?zl(p.cenaAllegro||p.cena):""},
    {label:"Kategoria Allegro",value:text(p.allegroCategoryId),required:true,source:"Allegro"},
    {label:"Produkt w katalogu Allegro",value:text(p.allegroProductId||p.gtin||p.ean),required:true,source:"Allegro"},
    {label:"Opis krótki Allegro",value:text(p.allegroShortDescription||p.opisKrotki||p.krotkiOpis),required:true,source:p.allegroShortDescription?"Allegro":"Dziedziczone ze Sklepu",display:text(p.allegroShortDescription||p.opisKrotki||p.krotkiOpis)?`${text(p.allegroShortDescription||p.opisKrotki||p.krotkiOpis).length} znaków`:""},
    {label:"Opis pełny Allegro",value:text(p.allegroDescription||p.opis),required:true,source:p.allegroDescription?"Allegro":"Dziedziczone ze Sklepu",display:text(p.allegroDescription||p.opis)?`${text(p.allegroDescription||p.opis).length} znaków`:""},
    {label:"Parametry Allegro",value:count(p.allegroParameters),required:true,source:"Allegro",display:count(p.allegroParameters)?`${count(p.allegroParameters)} parametrów`:""},
    {label:"ID oferty",value:text(p.allegroOfferId),required:false,source:"Allegro",display:text(p.allegroOfferId)||"nowa oferta"},
  ]:[
    {label:"Nazwa Von Halsky",value:text(p.vonHalskyTitle||p.nazwa),required:true,source:p.vonHalskyTitle?"Von Halsky":"Dziedziczone z danych wspólnych"},
    {label:"Cena Von Halsky",value:Number(p.cenaVonHalsky||p.cenaAllegro||p.cena)>0?p.cenaVonHalsky||p.cenaAllegro||p.cena:"",required:true,source:p.cenaVonHalsky?"Von Halsky":p.cenaAllegro?"Dziedziczone z Allegro":"Dziedziczone ze Sklepu",display:Number(p.cenaVonHalsky||p.cenaAllegro||p.cena)>0?zl(p.cenaVonHalsky||p.cenaAllegro||p.cena):""},
    {label:"Kategoria Von Halsky",value:text(p.vonHalskyCategoryId||p.vonHalskyCategoryPath),required:true,source:"Von Halsky"},
    {label:"Opis krótki Von Halsky",value:text(p.vonHalskyShortDescription||p.opisKrotki||p.krotkiOpis),required:true,source:p.vonHalskyShortDescription?"Von Halsky":"Dziedziczone ze Sklepu",display:text(p.vonHalskyShortDescription||p.opisKrotki||p.krotkiOpis)?`${text(p.vonHalskyShortDescription||p.opisKrotki||p.krotkiOpis).length} znaków`:""},
    {label:"Opis pełny Von Halsky",value:text(p.vonHalskyDescription||p.opis),required:true,source:p.vonHalskyDescription?"Von Halsky":"Dziedziczone ze Sklepu",display:text(p.vonHalskyDescription||p.opis)?`${text(p.vonHalskyDescription||p.opis).length} znaków`:""},
    {label:"Parametry Von Halsky",value:count(p.vonHalskyAttributes),required:true,source:"Von Halsky",display:count(p.vonHalskyAttributes)?`${count(p.vonHalskyAttributes)} parametrów`:""},
    {label:"ID oferty",value:text(p.vonHalskyOfferId||p.inpostVonHalskyOfferId),required:false,source:"Von Halsky",display:text(p.vonHalskyOfferId||p.inpostVonHalskyOfferId)||"nowa oferta"},
  ];
  const required=[...own,...shared].filter(item=>item.required),done=required.filter(item=>item.value!==""&&item.value!==null&&item.value!==undefined&&item.value!==false).length;
  const ownRequired=own.filter(item=>item.required),ownDone=ownRequired.filter(item=>item.value!==""&&item.value!==null&&item.value!==undefined&&item.value!==false).length;
  const sharedRequired=shared.filter(item=>item.required),sharedDone=sharedRequired.filter(item=>item.value!==""&&item.value!==null&&item.value!==undefined&&item.value!==false).length;
  return {items:own,shared,required:required.length,done,percent:required.length?Math.round(done/required.length*100):100,missing:required.filter(item=>!item.value).map(item=>item.label),ownRequired:ownRequired.length,ownDone,sharedRequired:sharedRequired.length,sharedDone};
}
function productEditorKanalKontrolaHTML(p={},channel="store"){
  const definition=productEditorKanalDefinicja(p,channel),name=channel==="store"?"Sklep":channel==="allegro"?"Allegro":"Von Halsky";
  return `<aside class="product-channel-contract ${channel}" data-product-channel-contract="${channel}"><header><div><small>Pola należące do kanału</small><h3>${esc(name)} • ${definition.ownDone}/${definition.ownRequired}</h3></div><strong>${definition.percent}%</strong></header><div class="product-channel-progress"><i style="width:${definition.percent}%"></i></div><div class="product-channel-shared-reference"><span>↗</span><div><b>Dane wspólne ${definition.sharedDone}/${definition.sharedRequired}</b><small>Producent, EAN, GPSR i media są zapisane jeden raz.</small></div><a href="#product-editor-shared-data">Zobacz</a></div><div class="product-channel-field-list">${definition.items.map(item=>`<article class="${item.value?"is-ready":item.required?"is-missing":"is-optional"}"><span>${item.value?"✓":item.required?"!":"○"}</span><div><b>${esc(item.label)}</b><small>${esc(item.display||item.value||(item.required?"brak — wymagane":"opcjonalne"))}</small></div><em>${esc(item.source)}</em></article>`).join("")}</div>${definition.missing.length?`<footer><b>Do uzupełnienia:</b> ${definition.missing.map(esc).join(" • ")}</footer>`:`<footer class="is-ready"><b>✓ Kanał ma komplet danych do kontroli.</b></footer>`}</aside>`;
}
function productEditorDaneWspolnePanelHTML(p={}){
  const items=productEditorDaneWspolneDefinicja(p),required=items.filter(item=>item.required),done=required.filter(item=>item.value).length,producer=items.find(item=>item.label==="Producent")?.value||"brak producenta";
  return `<section class="product-shared-data-panel" id="product-editor-shared-data"><header><div><small>JEDEN REKORD DLA 3 KANAŁÓW</small><h3>Dane wspólne produktu</h3><p>Producent, identyfikatory, GPSR i zdjęcia nie są kopiowane do trzech formularzy. Każdy kanał odczytuje je z tej kartoteki.</p></div><strong>${done}/${required.length}</strong></header><div class="product-shared-data-grid">${items.map(item=>`<article class="${item.value?"is-ready":item.required?"is-missing":"is-optional"}"><span>${item.value?"✓":item.required?"!":"○"}</span><div><small>${esc(item.label)}</small><b>${esc(item.display||item.value||(item.required?"brak — wymagane":"opcjonalne"))}</b></div></article>`).join("")}</div><footer><span>Producent używany we wszystkich kanałach</span><b>${esc(producer)}</b><a href="#product-editor-source">Edytuj dane wspólne →</a></footer></section>`;
}
function productEditorKanalyPulpitHTML(p={}){
  const channels=[["store","🏪","Sklep","#product-editor-store"],["allegro","🟠","Allegro","#product-editor-allegro"],["vonHalsky","🐕","Von Halsky","#product-editor-von-halsky"]];
  return `<section class="product-editor-section product-channel-dashboard" id="product-editor-channels"><header class="product-editor-section-head"><div><span>Pełna kontrola sprzedaży</span><h2>Kanały produktu</h2><p>Każdy kanał ma osobny zapis, walidację i kolejkę publikacji. Jedna kartoteka wspólna zasila trzy niezależne prezentacje, a pola i podgląd kanału są pokazane wyłącznie w jego sekcji.</p></div></header>${productEditorDaneWspolnePanelHTML(p)}<div class="product-channel-dashboard-grid">${channels.map(([key,icon,label,href])=>{const d=productEditorKanalDefinicja(p,key);return `<a href="${href}" class="${d.percent===100?"is-ready":"needs-work"}"><span>${icon}</span><div><small>${label}</small><b>${d.percent}% kompletności</b><em>${d.missing.length?`${d.missing.length} elementów do uzupełnienia`:"gotowe do kontroli kanału"}</em></div><strong>${d.done}/${d.required}</strong></a>`;}).join("")}</div></section>`;
}
function productEditorPodgladOpisHTML(value,empty="Opis pojawi się po uzupełnieniu treści."){
  const text=String(value||"").replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|div|li|h[1-6])>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/\r/g,"").trim();
  if(!text)return `<p class="is-empty">${esc(empty)}</p>`;
  return text.split(/\n{2,}|\n(?=[A-ZĄĆĘŁŃÓŚŹŻ][^.!?]{2,55}$)/).map(part=>part.trim()).filter(Boolean).slice(0,12).map(part=>`<p>${esc(part)}</p>`).join("");
}
function productEditorPodgladProducent(p={}){
  const profile=p.manufacturerProfile||{};
  return String(profile.displayName||profile.manufacturerName||p.producent||p.marka||p.brand||"").trim();
}
function productEditorPodgladWnetrzeHTML(p={},channel="store"){
  const storeTitle=String(p.nazwa||"Nazwa produktu"),producer=productEditorPodgladProducent(p),image=String(p.zdjecie||""),imageHTML=image?`<img src="${esc(image)}" alt="${esc(storeTitle)}" loading="lazy">`:`<span class="product-preview-image-empty">📦<small>zdjęcie produktu</small></span>`;
  const title=channel==="allegro"?String(p.allegroTitle||storeTitle):channel==="vonHalsky"?String(p.vonHalskyTitle||storeTitle):storeTitle;
  const short=channel==="allegro"?p.allegroShortDescription||p.opisKrotki||p.krotkiOpis:channel==="vonHalsky"?p.vonHalskyShortDescription||p.opisKrotki||p.krotkiOpis:p.opisKrotki||p.krotkiOpis;
  const full=channel==="allegro"?p.allegroDescription||p.opis:channel==="vonHalsky"?p.vonHalskyDescription||p.opis:p.opis;
  const price=channel==="allegro"?p.cenaAllegro||p.cena:channel==="vonHalsky"?p.cenaVonHalsky||p.cenaAllegro||p.cena:p.cena;
  const priceHTML=Number(String(price||"").replace(",","."))>0?zl(String(price).replace(",",".")):"—";
  if(channel==="allegro")return `<div class="product-preview-allegro"><div class="product-preview-marketbar"><b>allegro</b><span>Podgląd oferty</span></div><div class="product-preview-commerce"><div class="product-preview-gallery">${imageHTML}<small>Zdjęcia z kartoteki wspólnej</small></div><div class="product-preview-buy"><small>Nowy</small><h2>${esc(title)}</h2>${producer?`<p>Marka: <b>${esc(producer)}</b></p>`:""}<strong>${esc(priceHTML)}</strong><div class="product-preview-delivery">🚚 Dostawa według cennika <b>${esc(p.allegroShippingRateName||"artway2")}</b></div><button type="button" disabled>kup i zapłać</button></div></div><div class="product-preview-description"><h3>Opis</h3>${short?`<p class="lead">${esc(String(short).replace(/<[^>]+>/g," "))}</p>`:""}${productEditorPodgladOpisHTML(full)}</div><div class="product-preview-conditions"><span>↩ ${esc(p.allegroReturnPolicyName||"warunki zwrotu z Allegro")}</span><span>🛡 ${esc(p.allegroImpliedWarrantyName||"warunki reklamacji z Allegro")}</span></div></div>`;
  if(channel==="vonHalsky")return `<div class="product-preview-vh"><div class="product-preview-marketbar"><b>InPost</b><span>Von Halsky • karta produktu</span></div><div class="product-preview-commerce"><div class="product-preview-gallery">${imageHTML}<small>Galeria produktu</small></div><div class="product-preview-buy"><small>${esc(p.vonHalskyCategoryPath||p.kategoria||"Produkt")}</small><h2>${esc(title)}</h2>${producer?`<p>Producent: <b>${esc(producer)}</b></p>`:""}<p class="product-preview-short">${esc(String(short||"").replace(/<[^>]+>/g," "))}</p><strong>${esc(priceHTML)}</strong><button type="button" disabled>dodaj do koszyka</button></div></div><div class="product-preview-description"><h3>Informacje o produkcie</h3>${productEditorPodgladOpisHTML(full)}</div></div>`;
  return `<div class="product-preview-store"><div class="product-preview-storebar"><b>Artway-TM</b><span>${esc(p.kategoria||"Oferta sklepu")}</span></div><div class="product-preview-commerce"><div class="product-preview-gallery">${imageHTML}<small>Galeria produktu</small></div><div class="product-preview-buy"><small>${esc(p.kategoria||"Produkt")}</small><h2>${esc(title)}</h2>${producer?`<p>Producent: <b>${esc(producer)}</b></p>`:""}<p class="product-preview-short">${esc(String(short||"").replace(/<[^>]+>/g," "))}</p><strong>${esc(priceHTML)}</strong>${Number(p.staraCena)>Number(price||0)?`<del>${esc(zl(p.staraCena))}</del>`:""}<div class="product-preview-cart"><input value="1" aria-label="Ilość" readonly><button type="button" disabled>Dodaj do koszyka</button></div></div></div><div class="product-preview-description"><h3>Opis produktu</h3>${productEditorPodgladOpisHTML(full)}</div></div>`;
}
function productEditorKanalPodgladHTML(p={},channel="store"){
  const name=channel==="store"?"Sklep Artway-TM":channel==="allegro"?"Allegro":"InPost Von Halsky";
  return `<aside class="product-channel-live-preview ${channel}" data-product-channel-preview="${channel}"><header><div><small>WIDOK KLIENTA</small><h3>${esc(name)}</h3></div><span>Podgląd na żywo</span></header><div class="product-channel-preview-viewport" data-product-channel-preview-body>${productEditorPodgladWnetrzeHTML(p,channel)}</div><footer>Podgląd aktualizuje się podczas pisania i nie przeładowuje formularza.</footer></aside>`;
}
function productEditorPodgladMigawka(form){
  const id=String(form?.dataset?.productId||""),base=typeof wszystkie!=="undefined"?(wszystkie.find(item=>String(item.id)===id)||{}):{};
  const snapshot={...base},fields=["nazwa","kategoria","cena","staraCena","opisKrotki","opis","zdjecie","producent","marka","gtin","kodProducenta","cenaAllegro","allegroTitle","allegroShortDescription","allegroDescription","allegroShippingRateName","allegroReturnPolicyName","allegroImpliedWarrantyName","cenaVonHalsky","vonHalskyTitle","vonHalskyShortDescription","vonHalskyDescription","vonHalskyCategoryId"];
  fields.forEach(name=>{const field=form?.elements?.[name];if(field)snapshot[name]=field.value;});
  return snapshot;
}
function productEditorOdswiezPodglady(form){
  if(!form)return;const p=productEditorPodgladMigawka(form);
  form.querySelectorAll("[data-product-channel-preview]").forEach(preview=>{const body=preview.querySelector("[data-product-channel-preview-body]");if(body)body.innerHTML=productEditorPodgladWnetrzeHTML(p,preview.dataset.productChannelPreview);});
}
function productEditorZaplanujPodglad(form){
  if(!form||form.dataset.previewFrame)return;form.dataset.previewFrame="1";
  requestAnimationFrame(()=>{delete form.dataset.previewFrame;productEditorOdswiezPodglady(form);});
}
function productEditorPodgladyPodlacz(){
  document.querySelectorAll("form.product-editor-form").forEach(form=>{if(form.dataset.previewBound)return;form.dataset.previewBound="1";form.addEventListener("input",()=>productEditorZaplanujPodglad(form),{passive:true});form.addEventListener("change",()=>productEditorZaplanujPodglad(form),{passive:true});});
}
function productEditorNaglowekHTML(p={},edycja=false){
  const state=productEditorTrescStan(p),identity=[p.gtin||p.ean,kodKanonicznyProduktu(p),p.producent||p.marka].filter(Boolean).join(" • "),store=productEditorStatusKanalu(state.store.status),vh=productEditorStatusKanalu(state.vonHalsky.status),allegro=productEditorStatusKanalu(state.allegroContent.status);
  return `<section class="product-editor-commandbar" aria-label="Nawigacja edytora produktu"><div class="product-editor-identity"><span>${edycja?`Produkt #${esc(p.id)}`:"Nowa kartoteka"}</span><b>${esc(p.nazwa||"Uzupełnij nazwę produktu")}</b><small>${esc(identity||"EAN, kod i producent nie są jeszcze kompletne")}</small></div><nav><a href="#product-editor-record">Kartoteka</a><a href="#product-editor-basics">Dane wspólne</a><a href="#product-editor-store">Sklep</a><a href="#product-editor-allegro">Allegro</a><a href="#product-editor-von-halsky">Von Halsky</a><a href="#product-editor-media">Media</a><a href="#product-editor-source">Źródło</a><a href="#product-editor-seo">SEO</a><a href="#product-editor-stock">Magazyn</a></nav><div class="product-editor-channel-state"><span class="${store[0]}">🏪 ${store[1]}</span><span class="${allegro[0]}">🟠 ${allegro[1]}</span><span class="${vh[0]}">🐕 ${vh[1]}</span></div></section>`;
}
function productEditorTrescHTML(p={}){
  const state=productEditorTrescStan(p);
  return `<section class="product-editor-section product-content-workspace product-channel-section store" id="product-editor-store"><header class="product-editor-section-head"><div><span>Kanał sprzedaży 01</span><h2>🏪 Sklep Artway-TM</h2><p>Treść, cena i układ własnego sklepu. Producent, EAN, GPSR i zdjęcia są pobierane z jednego bloku danych wspólnych.</p></div><div class="product-content-status ${productEditorStatusKanalu(state.store.status)[0]}"><b>${productEditorStatusKanalu(state.store.status)[1]}</b><small>Osobny zapis i kontrola sklepu.</small></div></header><div class="product-channel-overview">${productEditorKanalKontrolaHTML(p,"store")}${productEditorKanalPodgladHTML(p,"store")}</div><div class="product-channel-own-fields"><div class="product-channel-block"><h3>Sprzedaż w sklepie</h3><div class="product-price-grid"><div class="f-group"><label>Cena w sklepie (zł) *</label><input required name="cena" inputmode="decimal" value="${p.cena??""}" placeholder="99.99" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Stara cena / promocja</label><input name="staraCena" inputmode="decimal" value="${p.staraCena??""}"></div><div class="f-group"><label>Inne koszty sklepu / szt.</label><input name="sklepAdditionalCost" inputmode="decimal" value="${esc(p.sklepAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt płatności sklepu (% ceny)</label><input name="sklepPaymentPercent" inputmode="decimal" value="${esc(p.sklepPaymentPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div></div></div><div class="product-channel-block"><h3>Treść karty produktu</h3><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki sklepu</b><small>Karty produktu i wprowadzenie pod tytułem</small></span><textarea name="opisKrotki" rows="4" maxlength="500" placeholder="Krótki, konkretny opis w 1–3 zdaniach." oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.short)}</textarea><em><span data-product-short-count>${state.store.short.length}</span>/500 znaków</em></label><label class="product-content-long"><span><b>Opis długi sklepu</b><small>Pełna karta produktu w Artway-TM</small></span><textarea name="opis" rows="13" maxlength="20000" placeholder="Pełny opis produktu." oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.full)}</textarea><em><span data-product-full-count>${state.store.full.length}</span>/20 000 znaków</em></label></div></div><div class="product-content-live-note" data-product-content-note><b>✓ Zapis tej sekcji nie zmienia tekstów Allegro ani Von Halsky.</b></div></div></section>`;
}
function productEditorAllegroTrescHTML(p={}){
  const state=productEditorTrescStan(p),al=state.allegroContent,status=productEditorStatusKanalu(al.status);
  return `<div class="product-channel-block product-allegro-content"><div class="product-channel-block-head"><div><small>Treść kanału</small><h3>Opis zgodny z regulaminem Allegro</h3></div><span class="product-content-status ${status[0]}"><b>${status[1]}</b></span></div><p class="muted">Opis wyłącznie o produkcie: bez kontaktu, linków, sprzedaży poza Allegro oraz informacji o dostawie i płatności.</p><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki Allegro</b><small>Osobna wersja kanałowa</small></span><textarea name="allegroShortDescription" rows="4" maxlength="2000" oninput="productEditorKanalPoleWpisane(this,'allegro')">${esc(al.short)}</textarea></label><label class="product-content-long"><span><b>Opis pełny Allegro</b><small>Struktura publikowana wyłącznie w Allegro</small></span><textarea name="allegroDescription" rows="11" maxlength="20000" oninput="productEditorKanalPoleWpisane(this,'allegro')">${esc(al.full)}</textarea></label></div></div>`;
}
function productEditorVonHalskyAuditHTML(p={}){
  const raw=String(p.vonHalskyAgentStatus||p.contentEditorial?.channelStates?.vonHalsky?.status||"oczekuje").toLowerCase();
  const ready=["ready","confirmed"].includes(raw),failed=["error","failed"].includes(raw),preparedAt=p.vonHalskyAgentConfirmedAt||p.vonHalskyAgentPreparedAt||p.contentEditorial?.channelStates?.vonHalsky?.savedAt||"";
  const issues=Array.isArray(p.vonHalskyAgentIssues)?p.vonHalskyAgentIssues:[],warnings=Array.isArray(p.vonHalskyAgentWarnings)?p.vonHalskyAgentWarnings:[],missing=Array.isArray(p.vonHalskyAgentMissingAttributes)?p.vonHalskyAgentMissingAttributes:[];
  const saved=Array.isArray(p.vonHalskyAgentSavedFields)?p.vonHalskyAgentSavedFields:[];
  const labels={vonHalskyTitle:"nazwa Von Halsky",vonHalskyShortDescription:"opis krótki",vonHalskyDescription:"opis pełny",vonHalskyCategoryId:"kategoria",vonHalskyCategoryPath:"ścieżka kategorii",vonHalskyAttributes:"parametry",vonHalskyResponsibleProducer:"dane GPSR",vonHalskyResponsibleProducerStatus:"status GPSR",zdjecie:"zdjęcie główne",zdjecia:"galeria",contentEditorial:"stan redakcji"};
  const savedLabels=[...new Set(saved.map(field=>labels[field]||String(field||"").replace(/^vonHalsky/,"")).filter(Boolean))];
  const category=p.vonHalskyCategoryPath||p.vonHalskyAgentCategorySuggestion?.path||p.vonHalskyCategoryId||"nieprzypisana";
  const gpsr=p.vonHalskyResponsibleProducer||{},gpsrReady=p.vonHalskyResponsibleProducerStatus==="ready"||Boolean(gpsr.legalName||gpsr.name);
  const coverage=p.vonHalskyAgentAttributeCoverage==null?"—":`${Math.round(Number(p.vonHalskyAgentAttributeCoverage||0)*100)}%`;
  const statusLabel=ready?"Zapis potwierdzony":failed?"Błąd przygotowania":raw==="retry"||raw==="retry_pending"?"Zaplanowano ponowienie":issues.length?"Wymaga danych":"Jeszcze nie przygotowano";
  return `<div class="product-vh-audit ${ready?"is-ready":failed?"is-error":"needs-work"}">
    <header><div><small>Ostatni proces Agenta</small><b>${esc(statusLabel)}</b><span>${preparedAt?`Ostatni zapis ${esc(allegroDataTxt(preparedAt))}`:"Automatyczne przygotowanie oczekuje w kolejce serwera."}</span></div><strong>${p.vonHalskyAgentScore!==undefined&&p.vonHalskyAgentScore!==null&&Number.isFinite(Number(p.vonHalskyAgentScore))?`${Math.round(Number(p.vonHalskyAgentScore))}%`:"—"}</strong></header>
    <div class="product-vh-audit-grid"><article><small>Kategoria kanału</small><b>${esc(category)}</b></article><article><small>GPSR</small><b>${gpsrReady?`✓ ${esc(gpsr.legalName||gpsr.name||"kompletne")}`:"wymaga uzupełnienia"}</b></article><article><small>Parametry wymagane</small><b>${esc(coverage)}${missing.length?` • brakuje ${missing.length}`:""}</b></article><article><small>Odczyt kontrolny</small><b>${p.vonHalskyAgentReadbackConfirmed===true?"✓ potwierdzony":"— oczekuje"}</b></article></div>
    ${savedLabels.length?`<div class="product-vh-saved-fields"><small>Zapisane w tej kartotece</small><div>${savedLabels.map(label=>`<span>✓ ${esc(label)}</span>`).join("")}</div></div>`:""}
    ${issues.length||warnings.length||p.vonHalskyAgentError?`<div class="product-vh-audit-notes">${issues.length?`<p><b>Do uzupełnienia:</b> ${issues.map(esc).join(" • ")}</p>`:""}${warnings.length?`<p><b>Uwagi:</b> ${warnings.map(esc).join(" • ")}</p>`:""}${p.vonHalskyAgentError?`<p><b>Błąd:</b> ${esc(p.vonHalskyAgentError)}</p>`:""}</div>`:""}
  </div>`;
}
function productEditorVonHalskyTrescHTML(p={}){
  const state=productEditorTrescStan(p),vh=state.vonHalsky,vhStatus=productEditorStatusKanalu(vh.status);
  return `<section class="product-editor-section product-von-halsky-content product-channel-section von-halsky" id="product-editor-von-halsky"><header class="product-editor-section-head"><div><span>Kanał sprzedaży 03</span><h2>🐕 InPost Von Halsky</h2><p>Cena, klasyfikacja i prezentacja Von Halsky. Dane producenta i bezpieczeństwa są odczytywane z kartoteki wspólnej, bez powielania formularzy.</p></div><div class="product-content-status ${vhStatus[0]}"><b>${vhStatus[1]}</b><small>Ostatni potwierdzony zapis serwera.</small></div></header>${productEditorVonHalskyAuditHTML(p)}<div class="product-channel-overview">${productEditorKanalKontrolaHTML(p,"vonHalsky")}${productEditorKanalPodgladHTML(p,"vonHalsky")}</div><input type="hidden" name="vonHalskyContentMode" value="custom"><div class="product-channel-own-fields"><div class="product-channel-block"><h3>Sprzedaż i klasyfikacja</h3><div class="product-price-grid"><div class="f-group"><label>Cena Von Halsky (zł)</label><input name="cenaVonHalsky" inputmode="decimal" value="${p.cenaVonHalsky??""}" placeholder="pusta = cena Allegro" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Jeśli pole jest puste, kanał użyje ceny Allegro, a następnie ceny sklepu.</small></div><div class="f-group"><label>ID kategorii Von Halsky</label><input name="vonHalskyCategoryId" value="${esc(p.vonHalskyCategoryId||"")}" placeholder="uzupełnia Agent kanału"></div><div class="f-group"><label>Ścieżka kategorii</label><input value="${esc(p.vonHalskyCategoryPath||"")}" readonly placeholder="oczekuje na dopasowanie"></div><div class="f-group"><label>ID oferty Von Halsky</label><input value="${esc(p.vonHalskyOfferId||p.inpostVonHalskyOfferId||"")}" readonly placeholder="uzupełni API po publikacji"></div></div></div><div class="product-channel-block"><h3>Treść Von Halsky</h3><p class="muted">Nazwa 7–150 znaków, opis min. 100 znaków, bez linków i zdjęć w treści. Kontakt ustawia się w profilu sklepu, nie w ofercie.</p><div class="product-content-grid"><label class="product-content-short"><span><b>Nazwa i opis krótki</b><small>Osobne pola kanału</small></span><input name="vonHalskyTitle" maxlength="150" value="${esc(vh.title)}" oninput="productEditorKanalPoleWpisane(this,'vonHalsky')"><textarea name="vonHalskyShortDescription" rows="4" maxlength="2000" oninput="productEditorKanalPoleWpisane(this,'vonHalsky')">${esc(vh.short)}</textarea></label><label class="product-content-long"><span><b>Opis pełny Von Halsky</b><small>Treść przekazywana do API kanału</small></span><textarea name="vonHalskyDescription" rows="11" maxlength="20000" oninput="productEditorKanalPoleWpisane(this,'vonHalsky')">${esc(vh.full)}</textarea></label></div></div></div></section>`;
}
function productEditorUzupelnijKanalyZDanychWspolnych(form){
  if(!form)return;
  const copy=(sourceName,targetName)=>{
    const source=form.elements?.[sourceName],target=form.elements?.[targetName];if(!source||!target)return;
    if(!String(target.value||"").trim()||target.dataset.inherited==="1"){target.value=String(source.value||"");target.dataset.inherited="1";}
  };
  copy("nazwa","allegroTitle");copy("nazwa","vonHalskyTitle");
  copy("opisKrotki","allegroShortDescription");copy("opisKrotki","vonHalskyShortDescription");
  copy("opis","allegroDescription");copy("opis","vonHalskyDescription");
}
function productEditorKanalPoleWpisane(input,channel){
  if(input?.dataset)delete input.dataset.inherited;
  productEditorTrescZmieniona(input?.form,channel);
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
  return `<section class="product-agent-onboarding ${pending?"needs-decision":state.ready?"is-ready":busy?"is-busy":"needs-work"}" data-product-agent-card="${esc(p.id||"")}"><header><div><span class="order-pro-label">Automatyczny Agent kartoteki • praca serwerowa</span><h3>${pending?"✨ Agent pyta o Twoją decyzję":"🤖 Automatyczne uzupełnianie produktu"}</h3><p>${esc(activity)}</p></div><strong>${pending?"?":`${state.done}/${state.total}`}</strong></header><div class="product-agent-checks">${state.checks.map(x=>`<span class="${x.ok?"done":"wait"}">${x.ok?"✓":"○"} ${esc(x.label)}</span>`).join("")}</div><div class="product-agent-learning"><span>🧠</span><div><b>Redakcja, producent i dane kanałów uzupełniają się automatycznie</b><small>Wynik jest zapisywany bezpośrednio do tej pełnej kartoteki. Ręczne przygotowanie nie jest wymagane.</small></div><a href="#/admin/agent-ai/specjalisci">Historia pracy →</a></div>${pending?`<div class="product-agent-pending">${agentAISpecjalistaDecyzjaHTML(pending)}</div>`:""}<footer><small>${pending?"Wyjątek wymaga decyzji administratora.":state.ready?"Kartoteka podstawowa jest kompletna; Agent wykonuje dalszą kontrolę w tle.":"Brakujące pola są widoczne poniżej i trafiły do kolejki automatycznej."}</small></footer></section>`;
}
async function agentAIUruchomWdrozenieProduktu(id,button=null){
  const product=pobierzProduktAdmin(id);if(!product)return null;
  if(button)button.disabled=true;agentAISpecjalisci={...agentAISpecjalisci,running:true};renderuj();
  try{const textRun=await agentAISpecjalistaProduktWdrozenie(product);await chmuraWczytajStan().catch(()=>{});const status=textRun?.approvalStatus==="auto_applied"?"saved":"automatic_retry";toast(status==="saved"?"✅ Agent poprawił i zapisał treści produktu":"↻ Wynik nie przeszedł kontroli — Agent ponowi zadanie automatycznie");return {status,textRun};}
  catch(error){toast("⚠️ Agent redakcji: "+(error?.message||error));return {status:"error",error};}
  finally{agentAISpecjalisci={...agentAISpecjalisci,running:false};if(button)button.disabled=false;renderuj();}
}
function productEditorTrescZmieniona(form,channel="store"){
  if(!form)return;
  if(channel==="store"){
    const short=String(form.elements.opisKrotki?.value||""),full=String(form.elements.opis?.value||""),shortCount=form.querySelector("[data-product-short-count]"),fullCount=form.querySelector("[data-product-full-count]");
    if(shortCount)shortCount.textContent=String(short.length);if(fullCount)fullCount.textContent=String(full.length);
    productEditorUzupelnijKanalyZDanychWspolnych(form);
  }
  const note=form.querySelector("[data-product-content-note]");if(note)note.innerHTML=`<b>↻ Zmiana kanału ${esc(channel)} zostanie zapisana niezależnie i sprawdzona przez jego Agenta.</b>`;
  form.dataset[`productContentChanged${channel}`]="1";
}

const ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI=3;
const productEditorPelnaKartotekaWToku=new Set(),productEditorProducentRozwiazany=new Set(),productEditorPelnaKartotekaBledy=new Map();
async function productEditorPobierzPelnaKartoteke(id,{force=false}={}){
  const key=String(id??"").trim();if(!key||productEditorPelnaKartotekaWToku.has(key))return;
  if(force)productEditorPelnaKartotekaBledy.delete(key);
  productEditorPelnaKartotekaWToku.add(key);
  try{
    const product=await asortymentPobierzPelnyProdukt(key,{force});
    productEditorPelnaKartotekaBledy.delete(key);
    if(product&&!product.manufacturerProfileId&&!productEditorProducentRozwiazany.has(key)){
      productEditorProducentRozwiazany.add(key);
      await chmura("catalog-product-manufacturer-resolve",{method:"POST",body:{productId:key},timeout:30000}).then(result=>{
        if(result?.product&&typeof podmienProduktAdminBezRenderu==="function")podmienProduktAdminBezRenderu(key,{...result.product,_catalog:{...(result.product._catalog||{}),detailLevel:"full"}});
      }).catch(()=>null);
    }
  }catch(error){productEditorPelnaKartotekaBledy.set(key,String(error?.message||error));toast("Nie udało się pobrać pełnej kartoteki produktu: "+(error.message||error));}
  finally{productEditorPelnaKartotekaWToku.delete(key);if(String(trasa())===`/admin/produkty/edytuj/${key}`)renderuj();}
}
function kodKanonicznyProduktu(p={}){return String(p.kodProducenta||p.numerReferencyjny||p.mpn||p.externalId||p.sku||"").trim();}
function domyslneUstawieniaRentownosci(){
  const raw=ustawienia.domyslneKosztyRentownosci&&typeof ustawienia.domyslneKosztyRentownosci==="object"?ustawienia.domyslneKosztyRentownosci:{};
  const money=(v,fallback=0)=>Math.max(0,Math.min(100000,kwotaNum(v??fallback))),percent=(v,fallback=0)=>Math.max(0,Math.min(100,Number(v??fallback)||0));
  return {kosztPakowania:money(raw.kosztPakowania),sklepAdditionalCost:money(raw.sklepAdditionalCost),sklepPaymentPercent:percent(raw.sklepPaymentPercent),allegroAdditionalCost:money(raw.allegroAdditionalCost),allegroShippingSubsidy:money(raw.allegroShippingSubsidy,ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI),allegroAdsPercent:percent(raw.allegroAdsPercent),vatRate:percent(raw.vatRate,23)};
}
function wartoscKosztuProduktu(p={},pole){const v=p?.[pole];return v!==undefined&&v!==null&&String(v).trim()!==""?Math.max(0,Number(v)||0):domyslneUstawieniaRentownosci()[pole];}
function domyslneKosztyDoProduktu(p={},wymus=false){const d=domyslneUstawieniaRentownosci(),next={...p};for(const [pole,value] of Object.entries(d))if(wymus||next[pole]===undefined||next[pole]===null||String(next[pole]).trim()==="")next[pole]=value;return next;}
async function zastosujDomyslneKosztyProduktow(wymus=false){
  const defaults=domyslneUstawieniaRentownosci(),lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),operations=[];
  for(const p of lista){const patch={};for(const [pole,value] of Object.entries(defaults))if(wymus||p[pole]===undefined||p[pole]===null||String(p[pole]).trim()==="")patch[pole]=value;if(Object.keys(patch).length)operations.push({productId:p.id,fields:patch});}
  if(operations.length){await chmuraZapiszProduktyCentralnie(operations,"catalog-profit-defaults");zbudujProdukty();}
  return operations.length;
}
async function zapiszDomyslneUstawieniaRentownosci(event){
  event.preventDefault();const form=event.currentTarget,mode=String(event.submitter?.value||"defaults");if(mode==="all"&&!confirm("Nadpisać koszty operacyjne we wszystkich aktywnych produktach aktualnymi wartościami domyślnymi? Ceny zakupu i prowizje z API nie zostaną zmienione."))return;
  const n=name=>Math.max(0,Number(String(form.elements[name]?.value||"0").replace(",","."))||0),pct=name=>Math.min(100,n(name));
  const defaults={kosztPakowania:n("kosztPakowania"),sklepAdditionalCost:n("sklepAdditionalCost"),sklepPaymentPercent:pct("sklepPaymentPercent"),allegroAdditionalCost:n("allegroAdditionalCost"),allegroShippingSubsidy:n("allegroShippingSubsidy"),allegroAdsPercent:pct("allegroAdsPercent"),vatRate:pct("vatRate")};
  sklepDocelowaMarza=Math.max(1,Math.min(60,n("celMarzySklep")||20));allegroDocelowaMarza=Math.max(1,Math.min(60,n("celMarzyAllegro")||20));vonHalskyDocelowaMarza=Math.max(1,Math.min(60,n("celMarzyVonHalsky")||allegroDocelowaMarza));allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Math.floor(n("allegroJednostkiOplatCyklicznych")||10)));
  void zapiszCzescUstawien({celMarzySklep:sklepDocelowaMarza,celMarzyAllegro:allegroDocelowaMarza,celMarzyVonHalsky:vonHalskyDocelowaMarza,allegroJednostkiOplatCyklicznych,domyslneKosztyRentownosci:defaults});zapiszLS("artway_cel_marzy_sklep",sklepDocelowaMarza);zapiszLS("artway_cel_marzy_allegro",allegroDocelowaMarza);
  const applyAll=mode==="all",applyMissing=applyAll||!!form.elements.applyMissing?.checked;
  let changed=0;
  try{changed=applyMissing?await zastosujDomyslneKosztyProduktow(applyAll):0;}
  catch(error){toast("⛔ Ustawienia zapisano, ale nie zaktualizowano produktów: "+(error.message||error));return;}
  zaplanujZapisUstawien();toast(`✅ Zapisano domyślne koszty i cele${applyMissing?` • zaktualizowano ${changed} produktów`:""}`);renderuj();
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
function ustawCelMarzy(kanal,value){const v=Math.max(1,Math.min(60,Number(value)||20));if(kanal==="sklep"){sklepDocelowaMarza=v;zapiszLS("artway_cel_marzy_sklep",v);void zapiszCzescUstawien({celMarzySklep:v});}else if(kanal==="vonHalsky"){vonHalskyDocelowaMarza=v;void zapiszCzescUstawien({celMarzyVonHalsky:v});}else{allegroDocelowaMarza=v;zapiszLS("artway_cel_marzy_allegro",v);void zapiszCzescUstawien({celMarzyAllegro:v});}}
async function allegroZapiszProwizjeTrwale(productId,summary={}){
  const patch={allegroCommissionAmount:kwotaNum(summary.commissionAmount),allegroCommissionRate:Number(summary.commissionRate)||0,allegroRecurringFees:kwotaNum(summary.recurringFees),allegroFeeTotal:kwotaNum(summary.totalPreviewFees),allegroFeePrice:kwotaNum(summary.salePrice),allegroFeeCurrency:summary.currency||"PLN",allegroFeeDetails:{commissions:summary.commissions||[],quotes:summary.quotes||[]},allegroFeeCalculatedAt:summary.calculatedAt||new Date().toISOString(),allegroFeeSource:summary.source||"allegro-offer-fee-preview"};
  await zapiszPolaProduktuTrwale(productId,patch,false,"allegro-fee-preview");return patch;
}
async function allegroPobierzProwizjeProduktu(productId,button=null,options={}){
  const form=button?.closest?.("form"),base=pobierzProduktAdmin(productId)||produkty.find(p=>String(p.id)===String(productId))||{},product=form?produktRoboczyAllegroZFormularza(form,productId,base):base,offer=allegroOfertaDlaProduktuSklepu(product),offerId=String(product.allegroOfferId||offer?.id||"").trim(),price=kwotaNum(form?.elements?.cenaAllegro?.value)||kwotaNum(product.cenaAllegro||product.cena);
  if(!price){toast("Uzupełnij cenę Allegro");return null;}if(button)button.disabled=true;
  try{if(!options.silent)toast("🟠 Pobieram aktualne prowizje i opłaty z Allegro…");const d=await chmura("allegro-fee-preview",{method:"POST",body:{productId:String(productId),product,offerId,price,save:true},timeout:90000});const patch=await allegroZapiszProwizjeTrwale(productId,d.summary||{});if(form){for(const [name,value] of Object.entries({allegroCommissionAmount:patch.allegroCommissionAmount,allegroCommissionRate:patch.allegroCommissionRate,allegroRecurringFees:patch.allegroRecurringFees,allegroFeePrice:patch.allegroFeePrice,allegroFeeCalculatedAt:patch.allegroFeeCalculatedAt}))if(form.elements[name])form.elements[name].value=value;aktualizujKalkulatorCenProduktu(form);}if(!options.silent)toast(`✅ Prowizja ${zl(patch.allegroCommissionAmount)} (${Number(patch.allegroCommissionRate).toFixed(2)}%) • opłaty cykliczne ${zl(patch.allegroRecurringFees)}`);if(!form&&!options.silent)renderuj();return d;}catch(e){if(!options.silent)toast("⚠️ Kalkulator opłat Allegro: "+(e.message||e));return null;}finally{if(button)button.disabled=false;}
}
async function allegroPobierzProwizjeMasowo(){
  const complete=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))).slice(0,25);if(!complete.length){toast("Brak produktów z pełnymi danymi do kalkulacji");return;}
  toast(`Pobieram prowizje dla ${complete.length} kompletnych produktów…`);let ok=0,fail=0;for(const p of complete){const r=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});r?ok++:fail++;}toast(`Kalkulacja prowizji zakończona: ${ok} poprawnie, ${fail} błędów`);renderuj();
}
async function ustawRekomendowanaCeneProduktu(productId,kanal,price,targetMargin=null){
  const value=kwotaNum(price);if(!value)return;const p=pobierzProduktAdmin(productId);if(!p)return;
  const appliedMargin=Number.isFinite(Number(targetMargin))?+Number(targetMargin).toFixed(2):null;
  if(kanal==="sklep"){await zapiszPolaProduktuTrwale(productId,{cena:value,sklepPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{sklepPriceTargetMargin:appliedMargin})},false,"store-price-update");toast(`✅ Cena w sklepie została ustawiona na ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`}`);renderuj();return;}
  if(kanal==="vonHalsky"){await zapiszPolaProduktuTrwale(productId,{cenaVonHalsky:value,vonHalskyPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{vonHalskyPriceTargetMargin:appliedMargin})},false,"von-halsky-price-update");toast(`🐕 Cena Von Halsky została ustawiona na ${zl(value)}`);renderuj();return;}
  await zapiszPolaProduktuTrwale(productId,{cenaAllegro:value,allegroPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{allegroPriceTargetMargin:appliedMargin}),allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},false,"allegro-price-update");toast(`🟠 Ustawiono ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`} i aktualizuję ofertę Allegro…`);
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
function formularzProduktu(p, tryb){
  p=domyslneKosztyDoProduktu(p||{},false);
  const wszystkie = produktyDoAdministracji();
  const edycja = tryb==="edycja";
  if(edycja&&typeof agentAISpecjalisci!=="undefined"&&!agentAISpecjalisci.loaded&&!agentAISpecjalisci.loading)setTimeout(()=>agentAISpecjalisciPobierz(true),0);
  if(edycja&&typeof agentAISpecjalisciPolling==="function")setTimeout(()=>agentAISpecjalisciPolling(),0);
  if(edycja&&typeof allegroPobierzWarunkiDoEdytora==="function")setTimeout(()=>void allegroPobierzWarunkiDoEdytora(),0);
  setTimeout(()=>productEditorPodgladyPodlacz(),0);
  const kontrolaDodawania=edycja?null:produktDodawanieStanKontroli(p,{});
  const maTozsamoscProduktu=!!(p.allegroOfferId||p.allegroProductId||p.gtin||p.ean||p.externalId||p.sku||p.nazwa);
  const ofertaAllegro=maTozsamoscProduktu?allegroOfertaDlaProduktuSklepu(p):null,ofertaAllegroId=String(p.allegroOfferId||ofertaAllegro?.id||"").trim(),ofertaAllegroStatus=String(ofertaAllegro?.status||ofertaAllegro?.publication?.status||"").toUpperCase(),domyslnaPublikacjaAllegro=ofertaAllegroStatus==="ACTIVE"?"keep":"activate",rentownosc=allegroRentownoscProduktu(p),rentownoscSklep=sklepRentownoscProduktu(p),seoDanePodgladu=seoEfektywneDaneProduktu(p);
  return `
    <form class="product-editor-form" data-product-id="${esc(p.id||0)}" ${!edycja?`data-product-add-form data-product-duplicate-fingerprint="${esc(kontrolaDodawania.fingerprint)}" oninput="produktDodawanieZmienione(event,this)" onchange="produktDodawanieZmienione(event,this)"`:""} onsubmit="${edycja?`zapiszProduktAdmin(event,${jsArg(p.id)})`:"dodajProdukt(event)"}">
      ${productEditorNaglowekHTML(p,edycja)}
      ${agentAIWdrozenieProduktuHTML(p,edycja)}
      ${productEditorPelnaKartotekaHTML(p)}
      ${productEditorKanalyPulpitHTML(p)}
      ${!edycja?`<section class="product-add-control" data-product-add-control>${produktDodawanieKontrolaHTML(p,{})}</section>`:""}
      ${!edycja?`<section class="product-link-one-workspace product-link-inline-workspace"><div class="order-section-head"><div><span class="order-pro-label">Opcjonalne automatyczne uzupełnienie</span><h3>🔗 Pobierz dane z linku produktu</h3><p class="order-detail-lead">Wklej adres konkretnego produktu albo od razu wypełnij formularz ręcznie. Agent jedynie uzupełni pola — nic nie zostanie dodane bez Twojego zatwierdzenia na dole formularza.</p></div><span class="lvl lvl-ok">bez automatycznego zapisu</span></div><label for="oneProductUrl">Adres konkretnego produktu</label><div class="product-link-one-input"><input id="oneProductUrl" data-one-link-url name="producentUrl" type="url" value="${esc(p.producentUrl||p.sourceUrl||"")}" placeholder="https://strona-producenta.pl/konkretny-produkt"><button class="btn" type="button" onclick="pobierzDaneProduktuZUrl(this)">🤖 Pobierz i uzupełnij formularz</button></div><label class="check product-link-overwrite"><input type="checkbox" name="nadpiszImportUrl"> Nadpisz również pola wpisane przeze mnie</label><small>Po pobraniu sprawdź nazwę, cenę, opis, zdjęcia i kody. Dopiero przycisk „Zatwierdź i dodaj produkt” zapisze kartotekę.</small><div data-product-link-agent-result></div></section>`:""}
      <section class="product-editor-section product-editor-basics" id="product-editor-basics"><header class="product-editor-section-head"><div><span>Tożsamość produktu</span><h2>Podstawowe informacje</h2><p>Nazwa i kategoria są wspólnym punktem odniesienia dla sklepu, wyszukiwania, magazynu i integracji.</p></div></header><div class="f-row">
        <div class="f-group"><label>Nazwa *</label><input required name="nazwa" value="${esc(p.nazwa||"")}" oninput="productEditorUzupelnijKanalyZDanychWspolnych(this.form)"></div>
        <div class="f-group"><label>Kategoria *</label><input required name="kategoria" list="katLista" placeholder="np. Elektronika" value="${esc(p.kategoria||kategoriaNowegoProduktu)}">
          <datalist id="katLista">${[...new Set([...wszystkieKategorie(), ...wszystkie.map(x=>x.kategoria)])].map(k=>`<option value="${esc(k)}">`).join("")}</datalist></div>
      </div></section>
      ${productEditorTrescHTML(p)}
      <section class="product-editor-section product-editor-pricing" id="product-editor-costs"><header class="product-editor-section-head"><div><span>Dane administracyjne wspólne</span><h2>Koszt zakupu i kalkulacja</h2><p>Te wartości są prywatne i nie trafiają do żadnego kanału. Ceny sprzedaży i koszty właściwe dla kanałów znajdują się bezpośrednio w sekcjach Sklep, Allegro i Von Halsky.</p></div></header>
      <div class="product-price-grid">
        <div class="f-group"><label>🔒 Cena zakupu brutto (zł) — tylko administrator</label><input name="cenaZakupu" inputmode="decimal" value="${p.cenaZakupu??""}" placeholder="wewnętrzna" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Dane prywatne: niewidoczne dla klientów i Allegro, usuwane z publicznego API, products.json, Google/SEO i publikacji sklepu.${p.cenaZakupuNetto!=null?`<br>Netto z faktury: ${zl(p.cenaZakupuNetto)} • VAT: ${zl(p.cenaZakupuVat||0)}`:""}${p.cenaZakupuZrodlo?`<br>Źródło: ${esc(p.cenaZakupuZrodlo)} • ${esc(p.cenaZakupuDokument||"")} • ${esc(p.cenaZakupuDostawca||"")} • ${esc(p.cenaZakupuDataDokumentu||"")} • ${esc(p.cenaZakupuDopasowanie||"")}`:""}</small></div>
        <div class="f-group"><label>Koszt pakowania / szt.</label><input name="kosztPakowania" inputmode="decimal" value="${esc(p.kosztPakowania??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div>
        <div class="f-group"><label>VAT sprzedaży (%)</label><input name="vatRate" inputmode="decimal" value="${esc(p.vatRate??23)}"></div>
      </div>
      <div class="product-margin-preview" data-product-margin><span><small>Sklep • cena</small><b>${p.cena?zl(p.cena):"—"}</b></span><span class="${rentownoscSklep.profit<0?"is-negative":""}"><small>Sklep • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownoscSklep.profit)} • ${rentownoscSklep.margin.toFixed(1)}%`:"—"}</b></span><span><small>Sklep • cel ${sklepDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownoscSklep.recommended):"—"}</b></span><span><small>Allegro • cena</small><b>${rentownosc.price?zl(rentownosc.price):"—"}</b></span><span><small>Allegro • prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(rentownosc.commission)} • ${rentownosc.commissionRate.toFixed(2)}%`:"—"}</b></span><span class="${rentownosc.profit<0?"is-negative":""}"><small>Allegro • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownosc.profit)} • ${rentownosc.margin.toFixed(1)}%`:"—"}</b></span><span><small>Allegro • cel ${allegroDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownosc.recommended):"—"}</b></span></div>
      <div class="diag-actions"><a class="btn ghost" href="#/admin/allegro/rentownosc">Otwórz pełny kalkulator marży</a></div></section>
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
          ${productEditorProducentPoleHTML(p)}
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
      <details id="product-editor-allegro" class="product-editor-section product-channel-section allegro" open>
        <summary style="cursor:pointer;font-weight:800;font-size:.92rem">🟠 Kanał sprzedaży 02 — Allegro</summary>
        <div class="product-editor-section-head product-channel-detail-head"><div><span>Kompletna oferta Allegro</span><h2>Dane do przygotowania, wystawienia i aktualizacji</h2><p>W tej sekcji znajdują się wszystkie pola właściwe dla Allegro oraz czytelny podgląd danych wspólnych przekazywanych do oferty.</p></div></div>
        ${allegroOstatniWynikWystawienia?.produktId===String(p.id)?allegroWynikOperacjiHTML():""}
        <div class="backend-note" style="margin-top:.7rem"><b>Status produktu:</b> ${allegroStatusProduktuHTML(p)}<br>${typeof asortymentStatusPrzygotowaniaHTML==="function"?asortymentStatusPrzygotowaniaHTML(p):""}<small>Agent zapisuje w kartotece poprawione opisy, identyfikatory, kategorię, katalog, parametry, zdjęcia i wynik walidacji. Istniejąca oferta zostanie zaktualizowana, a nie powielona.</small></div>
        <div class="product-channel-overview">${productEditorKanalKontrolaHTML(p,"allegro")}${productEditorKanalPodgladHTML(p,"allegro")}</div>
        <div class="product-channel-block"><h3>Cena, prowizje i koszty Allegro</h3><input type="hidden" name="allegroFeePrice" value="${esc(p.allegroFeePrice??p.cenaAllegro??p.cena??"")}"><div class="product-profit-fields"><div class="f-group"><label>Cena na Allegro (zł)</label><input name="cenaAllegro" inputmode="decimal" value="${p.cenaAllegro??""}" placeholder="pusta = cena sklepu" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Własna cena ma pierwszeństwo; puste pole dziedziczy cenę sklepu.</small></div><div class="f-group"><label>Prowizja Allegro (zł)</label><input name="allegroCommissionAmount" inputmode="decimal" value="${esc(p.allegroCommissionAmount??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Prowizja Allegro (%)</label><input name="allegroCommissionRate" inputmode="decimal" value="${esc(p.allegroCommissionRate??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Opłaty cykliczne (zł)</label><input name="allegroRecurringFees" inputmode="decimal" value="${esc(p.allegroRecurringFees??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Inne koszty Allegro / szt.</label><input name="allegroAdditionalCost" inputmode="decimal" value="${esc(p.allegroAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Dopłata do wysyłki / szt.</label><input name="allegroShippingSubsidy" inputmode="decimal" value="${esc(p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI)}" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Domyślnie zawsze 3,00 zł.</small></div><div class="f-group"><label>Reklama Allegro (% ceny)</label><input name="allegroAdsPercent" inputmode="decimal" value="${esc(p.allegroAdsPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Ostatnie wyliczenie API</label><input name="allegroFeeCalculatedAt" value="${esc(p.allegroFeeCalculatedAt||"")}" readonly><small>${p.allegroFeeCalculatedAt?esc(allegroDataTxt(p.allegroFeeCalculatedAt)):"jeszcze nie pobrano"}</small></div></div><div class="diag-actions">${edycja?`<button class="btn" type="button" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">Pobierz aktualne opłaty</button>`:""}<a class="btn ghost" href="#/admin/allegro/rentownosc">Kalkulator marży</a></div></div>
        ${productEditorAllegroTrescHTML(p)}
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>ID kategorii Allegro *</label><input name="allegroCategoryId" value="${esc(p.allegroCategoryId||"")}" placeholder="wymagane do wystawienia"></div>
          <div class="f-group"><label>ID produktu Allegro</label><input name="allegroProductId" value="${esc(p.allegroProductId||"")}" placeholder="opcjonalnie, jeśli znany"></div>
          <div class="f-group"><label>ID oferty Allegro</label><input name="allegroOfferId" value="${esc(p.allegroOfferId||"")}" placeholder="uzupełni się po wystawieniu"></div>
        </div>
        <div class="f-group"><label>Tytuł oferty Allegro <small>12–75 znaków, minimum 3 słowa</small></label><input name="allegroTitle" maxlength="75" value="${esc(p.allegroTitle||"")}" placeholder="Agent utworzy zgodny tytuł z nazwy, producenta i kategorii" oninput="productEditorKanalPoleWpisane(this,'allegro')"><small>Jeśli pole pozostanie puste, Agent zapisze bezpieczny tytuł przed wystawieniem. Możesz go później zmienić ręcznie.</small></div>
        <div class="f-row">
          <div class="f-group"><label>Szukaj w katalogu Allegro</label><input name="allegroCategoryPhrase" value="${esc(p.allegroCategoryPhrase||"")}" placeholder="np. gry planszowe, zabawki kreatywne albo nazwa produktu"></div>
          <div class="f-group"><label>Dobieranie kategorii</label><button class="btn ghost" type="button" onclick="allegroDobierzKategorieProduktu(${edycja?jsArg(p.id):"0"},this)">🔎 Dobierz kategorię Allegro</button></div>
        </div>
        <div id="allegroCategoryPreview"></div>
        <div class="product-channel-block allegro-sales-conditions" data-allegro-sales-conditions><div class="product-channel-block-head"><div><small>Warunki sprzedaży z konta Allegro</small><h3>Dostawa, zwroty, reklamacje i gwarancja</h3></div><button class="btn ghost" type="button" onclick="allegroPobierzWarunkiDoEdytora(this)">↻ Pobierz dostępne opcje</button></div><p class="muted">Wybierasz istniejące warunki z konta. System nie tworzy ani nie modyfikuje cennika; domyślnie stosuje zapisany cennik „artway2”.</p><input type="hidden" name="allegroShippingRateName" value="${esc(p.allegroShippingRateName||"artway2")}"><input type="hidden" name="allegroReturnPolicyName" value="${esc(p.allegroReturnPolicyName||"")}"><input type="hidden" name="allegroImpliedWarrantyName" value="${esc(p.allegroImpliedWarrantyName||"")}"><input type="hidden" name="allegroWarrantyName" value="${esc(p.allegroWarrantyName||"")}"><div class="product-sales-condition-grid"><label class="f-group"><span>Cennik dostawy *</span><select name="allegroShippingRateId" data-name-field="allegroShippingRateName" data-allegro-condition="shippingRates" data-current="${esc(p.allegroShippingRateId||"")}"><option value="${esc(p.allegroShippingRateId||"")}">${esc(p.allegroShippingRateName||"artway2 — domyślny")}</option></select></label><label class="f-group"><span>Warunki zwrotu *</span><select name="allegroReturnPolicyId" data-name-field="allegroReturnPolicyName" data-allegro-condition="returnPolicies" data-current="${esc(p.allegroReturnPolicyId||"")}"><option value="${esc(p.allegroReturnPolicyId||"")}">${esc(p.allegroReturnPolicyName||"domyślne z konta Allegro")}</option></select></label><label class="f-group"><span>Warunki reklamacji *</span><select name="allegroImpliedWarrantyId" data-name-field="allegroImpliedWarrantyName" data-allegro-condition="impliedWarranties" data-current="${esc(p.allegroImpliedWarrantyId||"")}"><option value="${esc(p.allegroImpliedWarrantyId||"")}">${esc(p.allegroImpliedWarrantyName||"domyślne z konta Allegro")}</option></select></label><label class="f-group"><span>Gwarancja</span><select name="allegroWarrantyId" data-name-field="allegroWarrantyName" data-allegro-condition="warranties" data-current="${esc(p.allegroWarrantyId||"")}"><option value="${esc(p.allegroWarrantyId||"")}">${esc(p.allegroWarrantyName||"brak lub domyślna")}</option></select></label></div><div data-allegro-sales-condition-status class="backend-note">Opcje zostaną pobrane bezpośrednio z Allegro i zapisane w tej kartotece produktu.</div></div>
        <div class="f-row">
          <div class="f-group"><label>Stan oferty Allegro <small style="font-weight:400;color:var(--muted2)">(ustawienie globalne; nie zmienia magazynu)</small></label><input name="allegroStock" type="number" value="${allegroStanOfertyProduktu()}" readonly><small>Każda oferta otrzymuje ${allegroStanOfertyProduktu()} szt. i automatyczne wznawianie. Zmienisz to w Ustawieniach Allegro.</small></div>
          <div class="f-group"><label>Co zrobić na Allegro</label><select id="allegroPublicationAction"><option value="activate" ${domyslnaPublikacjaAllegro==="activate"?"selected":""}>Zapisz i aktywuj sprzedaż</option><option value="keep" ${domyslnaPublikacjaAllegro==="keep"?"selected":""}>Tylko zaktualizuj — zachowaj obecny status</option><option value="deactivate">Zapisz i wyłącz sprzedaż</option></select><small>${ofertaAllegroId?`Obecny status Allegro: <b>${esc(ofertaAllegroStatus||"nieznany")}</b>.`:"Produkt nie ma jeszcze oferty — domyślnie zostanie wystawiony aktywnie."} Wynik zostanie ponownie odczytany bezpośrednio z Allegro.</small></div>
        </div>
        <div class="diag-actions">
          ${edycja?`<button class="btn" type="button" onclick="allegroWystawProdukt(${jsArg(p.id)})">${ofertaAllegroStatus==="ACTIVE"?"🟠 Zapisz i zaktualizuj aktywną ofertę":ofertaAllegroId?"🚀 Zapisz i aktywuj ofertę":"🚀 Wystaw produkt"}</button>${ofertaAllegroId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(ofertaAllegroId)}" target="_blank" rel="noopener">↗ Otwórz istniejącą ofertę</a>`:""}`:`<span style="color:var(--muted2);font-size:.85rem">Po zapisaniu produktu automatyczne przygotowanie trafi do serwerowej kolejki.</span>`}
        </div>
        <div id="allegroDraftPreview"></div>
        <div id="allegroDescriptionPreview"></div>
      </details>
      ${productEditorVonHalskyTrescHTML(p)}
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
  if(p?._catalog?.detailLevel!=="full"){
    const loadError=productEditorPelnaKartotekaBledy.get(String(id));
    if(loadError)return asortymentSzkielet("produkty", `<div class="panel product-editor-loading"><div class="crumb"><a href="#/admin/produkty">Produkty</a> › Pełna kartoteka</div><h2>Nie otwarto skróconej kopii produktu</h2><p>${esc(loadError)}</p><button class="btn" type="button" onclick="productEditorPobierzPelnaKartoteke(${jsArg(id)},{force:true})">↻ Ponów pobranie pełnej kartoteki</button></div>`);
    setTimeout(()=>void productEditorPobierzPelnaKartoteke(id),0);
    return asortymentSzkielet("produkty", `<div class="panel product-editor-loading"><div class="crumb"><a href="#/admin/produkty">Produkty</a> › Pełna kartoteka</div><div class="loading">⏳ Pobieram wszystkie dane produktu #${esc(id)} z centralnej kartoteki…</div><p>Edytor otworzy się dopiero po pobraniu opisów, źródeł, danych Agenta, producenta, GPSR i informacji kanałów. Dzięki temu zapis nie pracuje na skróconym rekordzie listy.</p></div>`);
  }
  if(!p.manufacturerProfileId&&!productEditorProducentRozwiazany.has(String(id))){
    productEditorProducentRozwiazany.add(String(id));setTimeout(()=>void chmura("catalog-product-manufacturer-resolve",{method:"POST",body:{productId:String(id)},timeout:30000}).then(async result=>{if(result?.product){if(typeof asortymentPelneProduktyCache!=="undefined")asortymentPelneProduktyCache.set(String(id),{at:Date.now(),product:{...result.product,_catalog:{...(result.product._catalog||{}),detailLevel:"full"}}});renderuj();}}).catch(()=>null),0);
  }
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
  for(const pole of ["allegroShortDescription","allegroDescription"]){
    const value=String(f.get(pole)||"").trim();
    if(value)p[pole]=value;else delete p[pole];
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
  const priceNow=new Date().toISOString();if(Number(p.cena)!==Number(poprzedni.cena)){p.cenaZaktualizowanoAt=priceNow;p.cenaManualna=true;p.cenaZrodlo="ręczna edycja administratora";}if((p.cenaAllegro??null)!==(poprzedni.cenaAllegro??null)){p.cenaAllegroZaktualizowanoAt=priceNow;p.cenaAllegroManualna=Object.hasOwn(p,"cenaAllegro");p.cenaAllegroZrodlo=p.cenaAllegroManualna?"ręczna edycja administratora":"dziedziczenie ceny sklepu";}if((p.cenaVonHalsky??null)!==(poprzedni.cenaVonHalsky??null)){p.cenaVonHalskyZaktualizowanoAt=priceNow;p.cenaVonHalskyManualna=Object.hasOwn(p,"cenaVonHalsky");p.cenaVonHalskyZrodlo=p.cenaVonHalskyManualna?"ręczna edycja administratora":"dziedziczenie ceny Allegro";}
  for(const pole of ["allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){let raw=String(f.get(pole)||"").trim();if(pole==="allegroShippingSubsidy"&&raw==="")raw=String(ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI);const n=Number(raw.replace(",","."));if(raw!==""&&Number.isFinite(n)&&n>=0)p[pole]=+n.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);else if(!["vatRate"].includes(pole))delete p[pole];}
  const feeAt=String(f.get("allegroFeeCalculatedAt")||"").trim();if(feeAt)p.allegroFeeCalculatedAt=feeAt;
  const zdjecie = String(f.get("zdjecie")||"").trim();
  if(zdjecie) p.zdjecie = zdjecie; else delete p.zdjecie;
  if(f.get("badge")) p.badge = String(f.get("badge")); else delete p.badge;
  for(const [pole,nazwa] of [
    ["gtin","gtin"],["kolorProduktu","kolorProduktu"],["rozmiar","rozmiar"],["material","material"],
    ["dostepnoscProducenta","dostepnoscProducenta"],["producentUrl","producentUrl"],["sourceUrl","sourceUrl"],
    ["allegroCategoryId","allegroCategoryId"],["allegroProductId","allegroProductId"],["allegroOfferId","allegroOfferId"],["allegroCategoryPhrase","allegroCategoryPhrase"],["allegroTitle","allegroTitle"],
    ["allegroShippingRateId","allegroShippingRateId"],["allegroShippingRateName","allegroShippingRateName"],["allegroReturnPolicyId","allegroReturnPolicyId"],["allegroReturnPolicyName","allegroReturnPolicyName"],
    ["allegroImpliedWarrantyId","allegroImpliedWarrantyId"],["allegroImpliedWarrantyName","allegroImpliedWarrantyName"],["allegroWarrantyId","allegroWarrantyId"],["allegroWarrantyName","allegroWarrantyName"],
    ["vonHalskyCategoryId","vonHalskyCategoryId"],
    ["seoTitle","seoTitle"],["seoDescription","seoDescription"],["seoKeywords","seoKeywords"],["seoMode","seoMode"]
  ]){
    const v=String(f.get(nazwa)||"").trim();
    if(v)p[pole]=v;else delete p[pole];
  }
  p.producent=producerName;
  p.marka=normalizujNazweProducenta(f.get("marka"))||producerName;
  const manufacturerProfileId=String(f.get("manufacturerProfileId")||"").trim();
  if(manufacturerProfileId)p.manufacturerProfileId=manufacturerProfileId;
  else for(const field of ["manufacturerProfileId","manufacturerProfile","manufacturerProfileResolvedAt","manufacturerProfileConfidence","manufacturerProfileMethod","manufacturerProfileEvidence"])delete p[field];
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
function produktPolaDoCentralnegoZapisu(product={}){
  return Object.fromEntries(Object.entries(product).filter(([key,value])=>
    !["id","_catalog","stan","dostepny"].includes(key)&&value!==undefined
  ));
}
function produktRoznicaCentralnegoZapisu(product={},previous={}){
  const next=produktPolaDoCentralnegoZapisu(product),before=produktPolaDoCentralnegoZapisu(previous);
  const equal=(left,right)=>{if(left===right)return true;try{return JSON.stringify(left)===JSON.stringify(right);}catch(error){return false;}};
  const fields=Object.fromEntries(Object.entries(next).filter(([key,value])=>!Object.hasOwn(before,key)||!equal(value,before[key])));
  const remove=Object.keys(before).filter(key=>!Object.hasOwn(next,key));
  return {fields,remove};
}
async function utworzProduktCentralnie(product={}){
  const result=await chmura("catalog-product-create",{method:"POST",body:{
    product,
    source:product.storageOrigin==="product-link-file-import"?"import":"dodany",
    mutationId:`product-create:${String(product.id)}:${Date.now().toString(36)}`
  },timeout:60000});
  if(!result?.ok||String(result.productId)!==String(product.id))throw new Error(result?.error||"Serwer nie potwierdził utworzenia produktu.");
  return result.product&&String(result.product.id)===String(product.id)?result.product:product;
}
async function zapiszProduktCentralnie(product={},previous={}){
  const productId=String(product.id??"").trim();
  const change=produktRoznicaCentralnegoZapisu(product,previous);
  if(!Object.keys(change.fields).length&&!change.remove.length)return product;
  const result=await chmura("catalog-product-fields-update",{method:"POST",body:{
    productId,
    fields:change.fields,
    remove:change.remove,
    mutationId:`product-editor:${productId}:${Date.now().toString(36)}`,
    area:"admin-product-editor"
  },timeout:60000});
  if(result?.confirmed!==true||String(result.productId)!==productId)throw new Error(result?.error||"Serwer nie potwierdził zapisu produktu.");
  return result.product&&String(result.product.id)===productId?result.product:product;
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
  try{
    const saved=await utworzProduktCentralnie(p);
    Object.assign(p,saved);
  }catch(error){
    if(submit)submit.disabled=false;
    toast("⛔ Produkt nie został dodany: "+(error.message||error));
    return;
  }
  produktyDodane.push(p);
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
  await zapiszPolaProduktuTrwale(p.id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false,"product-onboarding");
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie nowego produktu: ${p.nazwa}`,{produktId:p.id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  if(submit)submit.disabled=false;
  if(["/admin/produkty/dodaj","/admin/produkty/z-linku"].includes(trasa())) location.hash="#/admin/produkty"; else renderuj();
}
function zapiszStanZFormularza(f, id){
  ustawStanMagazynowy(id, String(f.get("stan")??"").trim()===""?0:f.get("stan"), {typ:"korekta",powod:"Formularz produktu"});
}
async function automatyczniePobierzDaneZrodlaProduktu(p={},options={}){
  const url=String(p.producentUrl||p.sourceUrl||"").trim();if(!/^https?:\/\//i.test(url))return p;
  try{
    const d=await chmura("product-url-inspect",{method:"POST",body:{url},timeout:30000}),s=d.product||{},canonical=allegroProducentKanoniczny({...p,...s,sourceUrl:url,producentUrl:url});
    const sourceCode=String(s.kodProducenta||s.numerReferencyjny||s.mpn||s.externalId||s.sku||"").trim();
    const missing={gtin:s.gtin||s.ean,ean:s.ean||s.gtin,kodProducenta:sourceCode,numerReferencyjny:sourceCode,externalId:sourceCode,sku:sourceCode,mpn:sourceCode,producent:canonical||s.producent||s.marka,marka:s.marka||canonical||s.producent,parametryProducenta:s.parametryProducenta,parametryZrodla:s.parametryZrodla,sourceMaterial:{...(p.sourceMaterial||{}),sourceUrl:s.sourceUrl||s.producentUrl||url,fetchedAt:s.sourceEvidence?.fetchedAt||s.producentSprawdzonoAt||new Date().toISOString(),title:s.nazwa||"",shortDescription:s.opisKrotki||"",longDescription:s.opis||"",producer:s.producent||s.marka||"",brand:s.marka||s.producent||"",category:s.kategoria||"",ean:s.gtin||s.ean||"",producerCode:sourceCode,parameters:s.parametryProducenta||s.parametryZrodla||{}},contentEditorial:{...(p.contentEditorial||{}),status:"queued",queuedReason:"source_updated",queuedAt:new Date().toISOString()}};
    const merged={...p};
    for(const [field,value] of Object.entries(missing))if(value!==undefined&&value!==null&&value!==""&&(merged[field]===undefined||merged[field]===null||String(merged[field]).trim()===""))merged[field]=value;
    const canonicalUrl=s.sourceUrl||s.producentUrl||url,sourceImages=Number(s.sourceEvidence?.imagePolicyVersion)>=2?[s.zdjecie,...(Array.isArray(s.zdjecia)?s.zdjecia:[])].filter(Boolean):[],force={producentUrl:canonicalUrl,sourceUrl:canonicalUrl,sourceEvidence:s.sourceEvidence||merged.sourceEvidence||null,...(sourceImages.length?{zdjecie:sourceImages[0],zdjecia:sourceImages.slice(1,16)}:{}),dostepnoscProducenta:s.dostepnoscProducenta||merged.dostepnoscProducenta||"",stanProducenta:s.stanProducenta??merged.stanProducenta??"",stanProducentaDokladny:s.stanProducentaDokladny===true,stanProducentaZrodlo:s.stanProducentaZrodlo||merged.stanProducentaZrodlo||"",producentStatus:s.producentStatus||merged.producentStatus||"",producentSprawdzonoAt:s.producentSprawdzonoAt||merged.producentSprawdzonoAt||new Date().toISOString()},result={...merged,...force};
    if(options.persist===false){agentAIZakonczLinkProducenta(url,result);return result;}
    await zapiszPolaProduktuTrwale(p.id,missing,true,"product-source-refresh");await zapiszPolaProduktuTrwale(p.id,force,false,"product-source-refresh");agentAIZakonczLinkProducenta(url,pobierzProduktAdmin(p.id)||result);return pobierzProduktAdmin(p.id)||result;
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
      await allegroZapiszAutoUzupelnienia(prepared,d);allegroZastosujWynikWystawienia(prepared,d);allegroZapiszWynikOperacji(prepared,d);updated=true;
      prepared=pobierzProduktAdmin(p.id)||prepared;
    }
    const feeReady=kwotaNum(prepared.cenaAllegro||prepared.cena)>0&&!!(prepared.allegroOfferId||existing?.id||(prepared.allegroCategoryId&&(prepared.allegroProductId||prepared.gtin||prepared.ean)));
    let feesUpdated=false;if(options.forceFees!==false&&feeReady)feesUpdated=!!(await allegroPobierzProwizjeProduktu(prepared.id,null,{silent:true}).catch(()=>null));
    await chmuraZapiszUstawienia({flush:true}).catch(()=>false);
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
  try{
    const saved=await zapiszProduktCentralnie(p,poprzedni);
    Object.assign(p,saved);
  }catch(error){
    if(submit)submit.disabled=false;
    toast("⛔ Zmiany nie zostały potwierdzone przez serwer: "+(error.message||error));
    return;
  }
  zapiszStanZFormularza(f, id);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i] = p;
  }else{
    produktyEdytowane = {...produktyEdytowane, [id]:p};
  }
  zbudujProdukty(); odswiezMenu();
  zapiszHistorieAgenta("opisy-produktow",`Agent AI sprawdził opisy po edycji produktu: ${p.nazwa}`,{produktId:p.id,opisKrotki:!!p.opisKrotki,opis:!!p.opis});
  loguj("info","Zapisano zmiany produktu id="+id);
  toast("Zmiany zapisane. Automat aktualizuje dane, opis, prowizję i ofertę…");
  await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true});
  if(submit)submit.disabled=false;
  location.hash="#/admin/produkty";
}
async function duplikujProdukt(id){
  const p = pobierzProduktAdmin(id); if(!p) return;
  const maxId = najwyzszeIdProduktu();
  const kopia = seoAutomatyzujDaneProduktu({...p,id:maxId+1,nazwa:p.nazwa+" — kopia",seoMode:"auto",seoTitle:"",seoDescription:"",seoKeywords:"",createdAt:new Date().toISOString(),createdBy:sesja?.email||"administrator",agentOnboardingStatus:"needs_attention",agentOnboardingStartedAt:new Date().toISOString(),agentOnboardingMissing:["identity"]},"automatycznie po utworzeniu kopii",{force:true});
  try{Object.assign(kopia,await utworzProduktCentralnie(kopia));}
  catch(error){toast("⛔ Nie utworzono kopii: "+(error.message||error));return;}
  produktyDodane.push(kopia);
  zbudujProdukty();zapiszHistorieAgenta("wdrozenie-produktu",`Nowa kopia produktu wymaga kontroli Agenta: ${kopia.nazwa}`,{produktId:kopia.id,status:"needs_attention",sourceProductId:id});zaplanujZapisUstawien();loguj("info",`Zduplikowano produkt ${id} jako ${kopia.id}`);
  toast("Utworzono kopię produktu 📄");
  location.hash="#/admin/produkty/edytuj/"+kopia.id;
}
async function usunProdukt(id){
  try{await produktCyklCentralny([id],"trash");}
  catch(error){toast("⛔ Nie przeniesiono produktu do kosza: "+(error.message||error));return;}
  const p = produktyDodane.find(x=>x.id===id);
  if(p){
    if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
    oznaczProduktWKoszu(id,"wlasny");
  }
  produktyDodane = produktyDodane.filter(p=>p.id!==id);
  zbudujProdukty();
  loguj("info","Przeniesiono produkt do kosza na 30 dni: id="+id); toast("Produkt w koszu przez 30 dni 🗑️"); renderuj();
}
async function przywrocZKosza(id){
  try{await produktCyklCentralny([id],"restore");}
  catch(error){toast("⛔ Nie przywrócono produktu: "+(error.message||error));return;}
  const p = koszDodanych.find(x=>x.id===id);
  if(p&&!produktyDodane.some(x=>x.id===id))produktyDodane.push(p);
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony z kosza ↩️"); renderuj();
}
async function usunDefinitywnie(id){
  try{await produktCyklCentralny([id],"purge");}
  catch(error){toast("⛔ Nie usunięto produktu definitywnie: "+(error.message||error));return;}
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  usunMetaKosza(id);
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  loguj("info","Usunięto definitywnie produkt id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
async function usunDefinitywnieBazowy(id){
  try{await produktCyklCentralny([id],"purge");}
  catch(error){toast("⛔ Nie usunięto produktu definitywnie: "+(error.message||error));return;}
  if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  usunMetaKosza(id);
  delete produktyEdytowane[id];
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zaznaczoneProdukty.delete(id);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Usunięto definitywnie produkt bazowy id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
async function wyczyscCalKosz(){
  const bazowe=bazoweProduktyWKoszu().map(p=>p.id);
  const ile=koszDodanych.length+bazowe.length;
  if(!ile||!confirm(`Definitywnie usunąć ${ile} produktów z kosza? Tej operacji nie można cofnąć.`)) return;
  const ids=[...new Set([...koszDodanych.map(p=>p.id),...bazowe])];
  try{await produktCyklCentralny(ids,"purge");}
  catch(error){toast("⛔ Kosz nie został opróżniony — serwer nie potwierdził usunięcia: "+(error.message||error));return;}
  koszDodanych.forEach(p=>{delete koszMeta[p.id];delete stanyProduktow[p.id];delete dostepnoscProduktow[String(p.id)];});
  bazowe.forEach(id=>{
    if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
    delete koszMeta[id]; delete produktyEdytowane[id]; delete stanyProduktow[id]; delete dostepnoscProduktow[String(id)];
  });
  koszDodanych=[];
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zbudujProdukty(); odswiezMenu();
  loguj("info",`Opróżniono kosz: ${ile} produktów`);
  toast("Kosz opróżniony"); renderuj();
}
