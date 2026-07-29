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
  const agentHasIssue=agentEntries.some(([field,value])=>/error|missing/i.test(field)&&((Array.isArray(value)&&value.length)||(typeof value==="string"&&value.trim())||(value&&typeof value==="object"&&Object.keys(value).length)));
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
    <details class="product-record-agent-fields" ${agentHasIssue?"open":""}><summary>Dane i wyniki zapisane przez Agentów (${agentEntries.length})</summary><div>${agentEntries.map(([field,value])=>`<article><b>${esc(field)}</b><span>${esc(productEditorWartoscKartoteki(value))}</span></article>`).join("")||"<p>Agent nie zapisał jeszcze dodatkowych danych.</p>"}</div></details>
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
function productEditorHostZrodla(url=""){try{return new URL(String(url)).hostname.replace(/^www\./,"");}catch(error){return "źródło pomocnicze";}}
function productEditorZrodlaPomocnicze(p={}){
  const primary=String(p.sourceUrl||p.producentUrl||"").trim(),items=[],add=(entry,origin="agent")=>{const source=typeof entry==="string"?{url:entry}:entry||{},url=String(source.url||source.sourceUrl||"").trim();if(!/^https?:\/\//i.test(url)||url===primary||items.some(item=>item.url===url))return;items.push({url,label:String(source.label||productEditorHostZrodla(url)).trim().slice(0,160),origin:String(source.origin||origin).trim().slice(0,80),verifiedAt:String(source.verifiedAt||source.fetchedAt||"").trim().slice(0,80)});};
  (Array.isArray(p.auxiliarySources)?p.auxiliarySources:[]).forEach(item=>add(item));
  add({url:p.contentSourceUrl,label:"Źródło treści",origin:"agent",verifiedAt:p.contentVerifiedAt});
  add({url:p.agentImportUrl,label:"Źródło importu",origin:"import",verifiedAt:p.agentImportAt});
  add({url:p.sourceEvidence?.requestedUrl,label:"Adres przekazany do analizy",origin:"weryfikacja",verifiedAt:p.sourceEvidence?.fetchedAt});
  add({url:p.sourceEvidence?.resolvedUrl,label:"Adres po przekierowaniu",origin:"weryfikacja",verifiedAt:p.sourceEvidence?.fetchedAt});
  add({url:p.manufacturerProfile?.sourceUrl,label:"Oficjalny profil producenta",origin:"rejestr producentów",verifiedAt:p.manufacturerProfileResolvedAt});
  return items.slice(0,12);
}
function productEditorZrodloPomocniczeWierszHTML(source={}){
  return `<article class="product-aux-source-row"><span>⌁</span><div><label>Adres pomocniczy<input name="auxiliarySourceUrl" type="url" value="${esc(source.url||"")}" placeholder="https://…"></label><label>Opis źródła<input name="auxiliarySourceLabel" value="${esc(source.label||"")}" placeholder="np. karta produktu hurtowni"></label><input type="hidden" name="auxiliarySourceOrigin" value="${esc(source.origin||"administrator")}"><input type="hidden" name="auxiliarySourceVerifiedAt" value="${esc(source.verifiedAt||"")}"></div>${source.url?`<a class="btn ghost" href="${esc(source.url)}" target="_blank" rel="noopener">Otwórz ↗</a>`:""}<button class="product-aux-source-remove" type="button" title="Usuń źródło pomocnicze" onclick="this.closest('.product-aux-source-row').remove()">×</button></article>`;
}
function productEditorZrodlaPomocniczeHTML(p={}){
  const items=productEditorZrodlaPomocnicze(p);
  return `<section class="product-source-library"><header><div><small>BIBLIOTEKA ŹRÓDEŁ</small><h3>Źródła pomocnicze Agenta</h3><p>Materiały znalezione dodatkowo podczas analizy produktu. Nie zastępują zweryfikowanego źródła głównego.</p></div><button class="btn ghost" type="button" onclick="productEditorDodajZrodloPomocnicze(this)">＋ Dodaj źródło</button></header><div class="product-aux-source-list" data-product-aux-sources>${items.length?items.map(productEditorZrodloPomocniczeWierszHTML).join(""):`<div class="product-aux-source-empty">Agent nie znalazł jeszcze drugiego wiarygodnego źródła. Pojawi się tutaj automatycznie po weryfikacji.</div>`}</div></section>`;
}
function productEditorDodajZrodloPomocnicze(button){
  const list=button?.closest?.(".product-source-library")?.querySelector?.("[data-product-aux-sources]");if(!list)return;
  list.querySelector(".product-aux-source-empty")?.remove();list.insertAdjacentHTML("beforeend",productEditorZrodloPomocniczeWierszHTML({origin:"administrator"}));list.lastElementChild?.querySelector("input")?.focus();
}
function productEditorZrodlaPomocniczeZFormularza(formData,primaryUrl=""){
  const urls=formData?.getAll?.("auxiliarySourceUrl")||[],labels=formData?.getAll?.("auxiliarySourceLabel")||[],origins=formData?.getAll?.("auxiliarySourceOrigin")||[],dates=formData?.getAll?.("auxiliarySourceVerifiedAt")||[],primary=String(primaryUrl||"").trim(),seen=new Set();
  return urls.map((raw,index)=>{const url=String(raw||"").trim();if(!/^https?:\/\//i.test(url)||url===primary||seen.has(url))return null;seen.add(url);return {url,label:String(labels[index]||productEditorHostZrodla(url)).trim().slice(0,160),origin:String(origins[index]||"administrator").trim().slice(0,80),verifiedAt:String(dates[index]||new Date().toISOString()).trim().slice(0,80)};}).filter(Boolean).slice(0,12);
}
function productEditorKanalyPulpitHTML(p={}){
  const channels=[["store","🏪","Sklep"],["allegro","🟠","Allegro"],["vonHalsky","🐕","Von Halsky"]];
  return `<section class="product-editor-section product-channel-dashboard" id="product-editor-channels"><header class="product-editor-section-head"><div><span>Pełna kontrola sprzedaży</span><h2>Prezentacja w kanałach</h2><p>Wybierz kanał, nad którym pracujesz. Na ekranie pozostaje tylko jego formularz, kontrola kompletności i rzeczywisty podgląd klienta.</p></div><span class="product-channel-dashboard-hint">1 aktywny widok • 3 kanały</span></header>${productEditorDaneWspolnePanelHTML(p)}<div class="product-channel-dashboard-grid" role="tablist" aria-label="Kanał produktu">${channels.map(([key,icon,label])=>{const d=productEditorKanalDefinicja(p,key);return `<button type="button" role="tab" data-product-channel-tab="${key}" onclick="productEditorAktywujKanal('${key}',this)" class="${d.percent===100?"is-ready":"needs-work"}"><span>${icon}</span><div><small>${label}</small><b>${d.percent}% kompletności</b><em>${d.missing.length?`${d.missing.length} elementów do uzupełnienia`:"gotowe do kontroli kanału"}</em></div><strong>${d.done}/${d.required}</strong></button>`;}).join("")}</div></section>`;
}
function productEditorTekstOpisu(value=""){
  return String(value||"")
    .replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|div|li|h[1-6]|ul|ol|section)>/gi,"\n")
    .replace(/<li[^>]*>/gi,"• ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\r/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function productEditorAkapityZJednejSciany(text=""){
  if(text.includes("\n")||text.length<420)return [text];
  const sentences=text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map(item=>item.trim()).filter(Boolean)||[text];
  if(sentences.length<4)return [text];
  const chunks=[],size=Math.max(2,Math.ceil(sentences.length/3));
  for(let index=0;index<sentences.length;index+=size)chunks.push(sentences.slice(index,index+size).join(" "));
  return chunks;
}
function productEditorPodgladOpisHTML(value,empty="Opis pojawi się po uzupełnieniu treści."){
  const text=productEditorTekstOpisu(value);
  if(!text)return `<p class="is-empty">${esc(empty)}</p>`;
  const lines=(text.includes("\n")?text.split("\n"):productEditorAkapityZJednejSciany(text)).map(line=>line.trim()),blocks=[];
  let paragraph=[],list=[],listType="",specs=[];
  const flushParagraph=()=>{if(paragraph.length){blocks.push(`<p>${esc(paragraph.join(" "))}</p>`);paragraph=[];}};
  const flushList=()=>{if(list.length){blocks.push(`<${listType||"ul"}>${list.map(item=>`<li>${esc(item)}</li>`).join("")}</${listType||"ul"}>`);list=[];listType="";}};
  const flushSpecs=()=>{if(specs.length){blocks.push(`<dl class="product-preview-specs">${specs.map(([label,item])=>`<div><dt>${esc(label)}</dt><dd>${esc(item)}</dd></div>`).join("")}</dl>`);specs=[];}};
  const flushAll=()=>{flushParagraph();flushList();flushSpecs();};
  for(const line of lines.slice(0,80)){
    if(!line){flushAll();continue;}
    const bullet=line.match(/^(?:[-*•–]\s+)(.+)$/),numbered=line.match(/^\d+[.)]\s+(.+)$/),heading=line.match(/^#{1,3}\s+(.+)$/);
    const specification=!heading&&!bullet&&!numbered&&line.match(/^([^:]{2,42}):\s+(.+)$/);
    if(heading||(line.endsWith(":")&&line.length<=82)){flushAll();blocks.push(`<h4>${esc((heading?.[1]||line.slice(0,-1)).trim())}</h4>`);continue;}
    if(bullet||numbered){
      flushParagraph();flushSpecs();const type=numbered?"ol":"ul";
      if(list.length&&listType!==type)flushList();listType=type;list.push((bullet?.[1]||numbered?.[1]||"").trim());continue;
    }
    if(specification){flushParagraph();flushList();specs.push([specification[1].trim(),specification[2].trim()]);continue;}
    flushList();flushSpecs();paragraph.push(line);
  }
  flushAll();
  return `<div class="product-preview-copy">${blocks.slice(0,28).join("")}</div>`;
}
function productEditorPodgladParametryHTML(p={}){
  const raw=p.parametryZrodla||p.parametryProducenta||p.parametry||p.parameters||{},entries=[];
  const add=(label,value)=>{const key=String(label||"").replace(/[_-]+/g," ").trim(),text=Array.isArray(value)?value.join(", "):String(value??"").trim();if(!key||!text||entries.some(([existing])=>existing.toLowerCase()===key.toLowerCase()))return;entries.push([key,text]);};
  if(Array.isArray(raw))raw.forEach(item=>{if(item&&typeof item==="object")add(item.name||item.label||item.key,item.value||item.values);});
  else if(raw&&typeof raw==="object")Object.entries(raw).forEach(([key,value])=>add(key,value));
  [["Wiek",p.wiek||p.minimalnyWiek],["Liczba graczy",p.liczbaGraczy],["Materiał",p.material],["Rozmiar",p.rozmiar]].forEach(([key,value])=>add(key,value));
  if(!entries.length)return "";
  return `<section class="product-preview-parameters"><h4>Informacje techniczne</h4><dl>${entries.slice(0,8).map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></section>`;
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
  const parameters=productEditorPodgladParametryHTML(p);
  if(channel==="allegro")return `<div class="product-preview-allegro"><div class="product-preview-marketbar"><b>allegro</b><span>Podgląd oferty</span></div><div class="product-preview-commerce"><div class="product-preview-gallery">${imageHTML}<small>Zdjęcia z kartoteki wspólnej</small></div><div class="product-preview-buy"><small>Nowy</small><h2>${esc(title)}</h2>${producer?`<p>Marka: <b>${esc(producer)}</b></p>`:""}<strong>${esc(priceHTML)}</strong><div class="product-preview-delivery">🚚 Dostawa według cennika <b>${esc(p.allegroShippingRateName||"artway2")}</b></div><button type="button" disabled>kup i zapłać</button></div></div><div class="product-preview-description"><h3>Opis</h3>${short?`<p class="lead">${esc(productEditorTekstOpisu(short))}</p>`:""}${productEditorPodgladOpisHTML(full)}${parameters}</div><div class="product-preview-conditions"><span>↩ ${esc(p.allegroReturnPolicyName||"warunki zwrotu z Allegro")}</span><span>🛡 ${esc(p.allegroImpliedWarrantyName||"warunki reklamacji z Allegro")}</span></div></div>`;
  if(channel==="vonHalsky")return `<div class="product-preview-vh"><div class="product-preview-marketbar"><b>InPost</b><span>Von Halsky • karta produktu</span></div><div class="product-preview-commerce"><div class="product-preview-gallery">${imageHTML}<small>Galeria produktu</small></div><div class="product-preview-buy"><small>${esc(p.vonHalskyCategoryPath||p.kategoria||"Produkt")}</small><h2>${esc(title)}</h2>${producer?`<p>Producent: <b>${esc(producer)}</b></p>`:""}<p class="product-preview-short">${esc(productEditorTekstOpisu(short))}</p><strong>${esc(priceHTML)}</strong><button type="button" disabled>dodaj do koszyka</button></div></div><div class="product-preview-description"><h3>Informacje o produkcie</h3>${productEditorPodgladOpisHTML(full)}${parameters}</div></div>`;
  return `<div class="product-preview-store"><div class="product-preview-storebar"><b>Artway-TM</b><span>${esc(p.kategoria||"Oferta sklepu")}</span></div><div class="product-preview-commerce"><div class="product-preview-gallery">${imageHTML}<small>Galeria produktu</small></div><div class="product-preview-buy"><small>${esc(p.kategoria||"Produkt")}</small><h2>${esc(title)}</h2>${producer?`<p>Producent: <b>${esc(producer)}</b></p>`:""}<p class="product-preview-short">${esc(productEditorTekstOpisu(short))}</p><strong>${esc(priceHTML)}</strong>${Number(p.staraCena)>Number(price||0)?`<del>${esc(zl(p.staraCena))}</del>`:""}<div class="product-preview-cart"><input value="1" aria-label="Ilość" readonly><button type="button" disabled>Dodaj do koszyka</button></div></div></div><div class="product-preview-description"><h3>Opis produktu</h3>${productEditorPodgladOpisHTML(full)}${parameters}</div></div>`;
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
  document.querySelectorAll("form.product-editor-form").forEach(form=>{if(form.dataset.previewBound)return;form.dataset.previewBound="1";form.addEventListener("input",()=>productEditorZaplanujPodglad(form),{passive:true});form.addEventListener("change",()=>productEditorZaplanujPodglad(form),{passive:true});productEditorAktywujSekcje(form.dataset.editorSection||"summary",null,{scroll:false});productEditorOdswiezJakoscOpisow(form);});
}
function productEditorPoczatkowyKanal(){
  try{const value=sessionStorage.getItem("artway_product_editor_channel");return ["store","allegro","vonHalsky"].includes(value)?value:"store";}catch(error){return "store";}
}
function productEditorPoczatkowaSekcja(){
  try{const value=sessionStorage.getItem("artway_product_editor_section");return ["summary","basics","source","media","store","allegro","vonHalsky","costs","seo","stock"].includes(value)?value:"summary";}catch(error){return "summary";}
}
function productEditorPrzejdzDoSekcji(section,button){
  return productEditorAktywujSekcje(section,button);
}
function productEditorAktywujSekcje(section,button=null,{scroll=true}={}){
  const allowed=["summary","basics","source","media","store","allegro","vonHalsky","costs","seo","stock"],form=button?.closest?.("form")||document.querySelector("form.product-editor-form");
  if(!form||!allowed.includes(section))return false;
  form.dataset.editorSection=section;
  try{sessionStorage.setItem("artway_product_editor_section",section);}catch(error){}
  form.querySelectorAll("[data-product-section-nav]").forEach(item=>item.classList.toggle("active",item.dataset.productSectionNav===section));
  form.querySelectorAll("[data-product-channel-nav],[data-product-channel-tab]").forEach(item=>{
    const itemChannel=item.dataset.productChannelNav||item.dataset.productChannelTab,active=itemChannel===section;
    item.classList.toggle("active",active);if(item.hasAttribute("role"))item.setAttribute("aria-selected",String(active));
  });
  if(["store","allegro","vonHalsky"].includes(section)){
    form.dataset.activeChannel=section;
    try{sessionStorage.setItem("artway_product_editor_channel",section);}catch(error){}
  }
  const targets={summary:"#product-editor-record",basics:"#product-editor-basics",source:"#product-editor-source",media:"#product-editor-media",store:"#product-editor-store",allegro:"#product-editor-allegro",vonHalsky:"#product-editor-von-halsky",costs:"#product-editor-costs",seo:"#product-editor-seo",stock:"#product-editor-stock"};
  const target=form.querySelector(targets[section]);if(target?.tagName==="DETAILS")target.open=true;
  if(scroll&&target)requestAnimationFrame(()=>target.scrollIntoView({behavior:"smooth",block:"start"}));
  return false;
}
function productEditorAktywujKanal(channel,button=null,{scroll=true}={}){
  return productEditorAktywujSekcje(channel,button,{scroll});
}
function productEditorNaglowekHTML(p={},edycja=false){
  const state=productEditorTrescStan(p),identity=[p.gtin||p.ean,kodKanonicznyProduktu(p)].filter(Boolean).join(" • "),store=productEditorStatusKanalu(state.store.status),vh=productEditorStatusKanalu(state.vonHalsky.status),allegro=productEditorStatusKanalu(state.allegroContent.status),image=p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`;
  const sectionButton=(key,icon,label)=>`<button type="button" data-product-section-nav="${key}" onclick="productEditorPrzejdzDoSekcji('${key}',this)"><i>${icon}</i><span>${label}</span></button>`;
  return `<aside class="product-editor-commandbar" aria-label="Nawigacja edytora produktu"><header><div class="product-editor-sidebar-image">${image}</div><div class="product-editor-identity"><span>${edycja?`PRODUKT #${esc(p.id)}`:"NOWA KARTOTEKA"}</span><b>${esc(p.nazwa||"Uzupełnij nazwę produktu")}</b><small>${esc(identity||"EAN i kod do uzupełnienia")}</small></div></header><div class="product-editor-sidebar-save"><span><i></i><b>Rekord serwerowy</b><small>Zapis obejmuje wszystkie sekcje produktu</small></span><button type="button" onclick="this.closest('form').requestSubmit()">💾 Zapisz produkt</button></div><nav><small>PRODUKT</small>${sectionButton("summary","▦","Podsumowanie")}${sectionButton("basics","✎","Dane podstawowe")}${sectionButton("source","⌁","Producent i kody")}${sectionButton("media","▧","Zdjęcia i warianty")}<small>KANAŁY SPRZEDAŻY</small><button type="button" data-product-section-nav="store" data-product-channel-nav="store" onclick="productEditorAktywujKanal('store',this)"><i>🏪</i><span>Sklep</span><em class="${store[0]}">${store[1]}</em></button><button type="button" data-product-section-nav="allegro" data-product-channel-nav="allegro" onclick="productEditorAktywujKanal('allegro',this)"><i>🟠</i><span>Allegro</span><em class="${allegro[0]}">${allegro[1]}</em></button><button type="button" data-product-section-nav="vonHalsky" data-product-channel-nav="vonHalsky" onclick="productEditorAktywujKanal('vonHalsky',this)"><i>🐕</i><span>Von Halsky</span><em class="${vh[0]}">${vh[1]}</em></button><small>OPERACJE</small>${sectionButton("costs","◒","Koszty i marża")}${sectionButton("seo","↗","SEO")}${sectionButton("stock","▤","Magazyn")}</nav><footer><a href="#/admin/asortyment/produkty">← Wróć do katalogu</a></footer></aside>`;
}
function productEditorAutomatyzacjaHTML(p={},edycja=false){
  const state=agentAIStanWdrozeniaProduktu(p),status=String(p.agentOnboardingStatus||""),open=!edycja||status==="processing";
  return `<details class="product-editor-automation" ${open?"open":""}><summary><span>🤖</span><div><small>AUTOMATYCZNA KONTROLA KARTOTEKI</small><b>Agent produktu</b><em>${state.done}/${state.total} podstawowych kontroli gotowych</em></div><strong>${open?"Zwiń":"Pokaż szczegóły"}</strong></summary>${agentAIWdrozenieProduktuHTML(p,edycja)}</details>`;
}
function productEditorOcenaOpisu(value=""){
  const text=productEditorTekstOpisu(value),lines=text.split("\n").map(line=>line.trim()).filter(Boolean);
  const headings=lines.filter(line=>/^#{1,3}\s+/.test(line)||(line.endsWith(":")&&line.length<=82)).length;
  const lists=lines.filter(line=>/^(?:[-*•–]\s+|\d+[.)]\s+)/.test(line)).length;
  const specs=lines.filter(line=>/^[^:]{2,42}:\s+\S+/.test(line)).length;
  const paragraphs=text.split(/\n{2,}/).filter(part=>part.trim()).length;
  let score=0;if(text.length>=120)score+=22;else if(text.length>=60)score+=10;if(text.length>=350)score+=18;else if(text.length>=220)score+=10;
  score+=Math.min(18,paragraphs*6);if(headings)score+=18;if(lists>=2||specs>=2)score+=16;if(text.length<=6000)score+=8;
  const missing=[];if(text.length<120)missing.push("rozwiń opis");if(paragraphs<2&&text.length>220)missing.push("podziel na akapity");if(!headings&&text.length>260)missing.push("dodaj śródtytuły");if(!lists&&!specs&&text.length>320)missing.push("wyróżnij cechy lub parametry");
  score=Math.min(100,score);return {score,missing,label:score>=85?"bardzo dobry":score>=65?"dobry":score>=40?"do uporządkowania":"wymaga rozbudowy"};
}
function productEditorOpisNarzedziaHTML(fieldName,channel,value=""){
  const quality=productEditorOcenaOpisu(value);
  return `<div class="product-description-studio" data-description-quality="${fieldName}"><div class="product-description-toolbar" role="toolbar" aria-label="Narzędzia układu opisu"><button type="button" onclick="productEditorWstawFormatOpisu(this,'${fieldName}','heading')">H2 Nagłówek</button><button type="button" onclick="productEditorWstawFormatOpisu(this,'${fieldName}','paragraph')">¶ Akapit</button><button type="button" onclick="productEditorWstawFormatOpisu(this,'${fieldName}','list')">• Lista</button><button type="button" onclick="productEditorWstawFormatOpisu(this,'${fieldName}','spec')">≡ Parametr</button></div><div class="product-description-quality ${quality.score>=85?"is-strong":quality.score>=60?"is-good":"needs-work"}"><span><i style="width:${quality.score}%"></i></span><b>${quality.score}% • ${esc(quality.label)}</b><small>${esc(quality.missing.join(" • ")||`struktura gotowa dla kanału ${channel}`)}</small></div></div>`;
}
function productEditorWstawFormatOpisu(button,fieldName,type){
  const form=button?.closest?.("form"),textarea=form?.elements?.[fieldName];if(!textarea)return;
  const start=textarea.selectionStart??0,end=textarea.selectionEnd??start,selected=textarea.value.slice(start,end);
  if(!selected.trim()){toast(type==="spec"?"Zaznacz nazwę parametru, który chcesz uzupełnić.":"Najpierw zaznacz fragment opisu, który chcesz sformatować.");textarea.focus();return;}
  let replacement=selected.trim();
  if(type==="heading")replacement=`## ${replacement.replace(/^#{1,3}\s+/,"")}`;
  else if(type==="paragraph")replacement=`\n\n${replacement}\n\n`;
  else if(type==="list")replacement=replacement.split(/\n+/).map(line=>`• ${line.replace(/^(?:[-*•–]\s+|\d+[.)]\s+)/,"").trim()}`).join("\n");
  else if(type==="spec")replacement=`${replacement.replace(/:\s*$/,"")}: `;
  textarea.setRangeText(replacement,start,end,"end");textarea.dispatchEvent(new Event("input",{bubbles:true}));textarea.focus();
}
function productEditorOdswiezJakoscOpisow(form){
  if(!form)return;
  form.querySelectorAll("[data-description-quality]").forEach(container=>{
    const field=form.elements?.[container.dataset.descriptionQuality];if(!field)return;
    const quality=productEditorOcenaOpisu(field.value),status=container.querySelector(".product-description-quality");if(!status)return;
    status.className=`product-description-quality ${quality.score>=85?"is-strong":quality.score>=60?"is-good":"needs-work"}`;
    const bar=status.querySelector("i"),label=status.querySelector("b"),tip=status.querySelector("small");if(bar)bar.style.width=`${quality.score}%`;if(label)label.textContent=`${quality.score}% • ${quality.label}`;if(tip)tip.textContent=quality.missing.join(" • ")||"czytelna struktura opisu";
  });
}
function productEditorTrescHTML(p={}){
  const state=productEditorTrescStan(p);
  return `<section class="product-editor-section product-content-workspace product-channel-section store" id="product-editor-store"><header class="product-editor-section-head"><div><span>Kanał sprzedaży 01</span><h2>🏪 Sklep Artway-TM</h2><p>Treść, cena i układ własnego sklepu. Producent, EAN, GPSR i zdjęcia są pobierane z jednego bloku danych wspólnych.</p></div><div class="product-content-status ${productEditorStatusKanalu(state.store.status)[0]}"><b>${productEditorStatusKanalu(state.store.status)[1]}</b><small>Osobny zapis i kontrola sklepu.</small></div></header><div class="product-channel-overview">${productEditorKanalKontrolaHTML(p,"store")}${productEditorKanalPodgladHTML(p,"store")}</div><div class="product-channel-own-fields"><div class="product-channel-block"><h3>Sprzedaż w sklepie</h3><div class="product-price-grid"><div class="f-group"><label>Cena w sklepie (zł) *</label><input required name="cena" inputmode="decimal" value="${p.cena??""}" placeholder="99.99" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Stara cena / promocja</label><input name="staraCena" inputmode="decimal" value="${p.staraCena??""}"></div><div class="f-group"><label>Inne koszty sklepu / szt.</label><input name="sklepAdditionalCost" inputmode="decimal" value="${esc(p.sklepAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt płatności sklepu (% ceny)</label><input name="sklepPaymentPercent" inputmode="decimal" value="${esc(p.sklepPaymentPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div></div></div><div class="product-channel-block"><div class="product-channel-block-head"><div><small>STUDIO TREŚCI</small><h3>Profesjonalna karta produktu</h3></div><span class="product-description-agent-badge">Agent porządkuje automatycznie</span></div><p class="muted">Krótki opis wprowadza klienta, a opis długi używa śródtytułów, krótkich akapitów, list i potwierdzonych parametrów.</p><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki sklepu</b><small>2–3 konkretne zdania pod tytułem produktu</small></span><textarea name="opisKrotki" rows="5" maxlength="500" placeholder="Czym jest produkt, dla kogo i co go wyróżnia — wyłącznie na podstawie faktów." oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.short)}</textarea><em><span data-product-short-count>${state.store.short.length}</span>/500 znaków</em></label><div class="product-content-long"><span><b>Opis długi sklepu</b><small>Pełna, uporządkowana karta produktu w Artway-TM</small></span>${productEditorOpisNarzedziaHTML("opis","sklep",state.store.full)}<textarea name="opis" rows="16" maxlength="20000" placeholder="Wprowadzenie&#10;&#10;## Najważniejsze cechy&#10;• potwierdzona cecha produktu&#10;&#10;## Informacje techniczne&#10;Wiek: potwierdzona wartość" oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.full)}</textarea><em><span data-product-full-count>${state.store.full.length}</span>/20 000 znaków</em></div></div></div><div class="product-content-live-note" data-product-content-note><b>✓ Zapis tej sekcji nie zmienia tekstów Allegro ani Von Halsky.</b></div></div></section>`;
}
function productEditorAllegroTrescHTML(p={}){
  const state=productEditorTrescStan(p),al=state.allegroContent,status=productEditorStatusKanalu(al.status);
  return `<div class="product-channel-block product-allegro-content"><div class="product-channel-block-head"><div><small>STUDIO TREŚCI ALLEGRO</small><h3>Profesjonalny opis zgodny z regulaminem</h3></div><span class="product-content-status ${status[0]}"><b>${status[1]}</b></span></div><p class="muted">Tylko fakty o produkcie. Agent usuwa kontakt, linki, sprzedaż poza Allegro, dostawę, płatności i inne treści transakcyjne.</p><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki Allegro</b><small>2 konkretne zdania bez haseł i logistyki</small></span><textarea name="allegroShortDescription" rows="5" maxlength="2000" oninput="productEditorKanalPoleWpisane(this,'allegro')">${esc(al.short)}</textarea></label><div class="product-content-long"><span><b>Opis pełny Allegro</b><small>Hierarchia publikowana w ofercie: sekcje, akapity i listy</small></span>${productEditorOpisNarzedziaHTML("allegroDescription","Allegro",al.full)}<textarea name="allegroDescription" rows="16" maxlength="20000" oninput="productEditorKanalPoleWpisane(this,'allegro')">${esc(al.full)}</textarea></div></div></div>`;
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
  return `<section class="product-editor-section product-von-halsky-content product-channel-section von-halsky" id="product-editor-von-halsky"><header class="product-editor-section-head"><div><span>Kanał sprzedaży 03</span><h2>🐕 InPost Von Halsky</h2><p>Cena, klasyfikacja i prezentacja Von Halsky. Dane producenta i bezpieczeństwa są odczytywane z kartoteki wspólnej, bez powielania formularzy.</p></div><div class="product-content-status ${vhStatus[0]}"><b>${vhStatus[1]}</b><small>Ostatni potwierdzony zapis serwera.</small></div></header>${productEditorVonHalskyAuditHTML(p)}<div class="product-channel-overview">${productEditorKanalKontrolaHTML(p,"vonHalsky")}${productEditorKanalPodgladHTML(p,"vonHalsky")}</div><input type="hidden" name="vonHalskyContentMode" value="custom"><div class="product-channel-own-fields"><div class="product-channel-block"><h3>Sprzedaż i klasyfikacja</h3><div class="product-price-grid"><div class="f-group"><label>Cena Von Halsky (zł)</label><input name="cenaVonHalsky" inputmode="decimal" value="${p.cenaVonHalsky??""}" placeholder="pusta = cena Allegro" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Jeśli pole jest puste, kanał użyje ceny Allegro, a następnie ceny sklepu.</small></div><div class="f-group"><label>ID kategorii Von Halsky</label><input name="vonHalskyCategoryId" value="${esc(p.vonHalskyCategoryId||"")}" placeholder="uzupełnia Agent kanału"></div><div class="f-group"><label>Ścieżka kategorii</label><input value="${esc(p.vonHalskyCategoryPath||"")}" readonly placeholder="oczekuje na dopasowanie"></div><div class="f-group"><label>ID oferty Von Halsky</label><input value="${esc(p.vonHalskyOfferId||p.inpostVonHalskyOfferId||"")}" readonly placeholder="uzupełni API po publikacji"></div></div></div><div class="product-channel-block"><div class="product-channel-block-head"><div><small>STUDIO TREŚCI VON HALSKY</small><h3>Karta zgodna z wymaganiami kanału</h3></div><span class="product-description-agent-badge">Niezależna kontrola Agenta</span></div><p class="muted">Nazwa 7–150 znaków, opis min. 100 znaków, bez linków, kontaktu, dostawy, płatności i zdjęć osadzonych w treści. Kontakt ustawia się w profilu sklepu, nie w ofercie.</p><div class="product-content-grid"><label class="product-content-short"><span><b>Nazwa i opis krótki</b><small>Naturalna nazwa oraz 2 rzeczowe zdania</small></span><input name="vonHalskyTitle" maxlength="150" value="${esc(vh.title)}" oninput="productEditorKanalPoleWpisane(this,'vonHalsky')"><textarea name="vonHalskyShortDescription" rows="5" maxlength="2000" oninput="productEditorKanalPoleWpisane(this,'vonHalsky')">${esc(vh.short)}</textarea></label><div class="product-content-long"><span><b>Opis pełny Von Halsky</b><small>Uporządkowane sekcje przekazywane do API kanału</small></span>${productEditorOpisNarzedziaHTML("vonHalskyDescription","Von Halsky",vh.full)}<textarea name="vonHalskyDescription" rows="16" maxlength="20000" oninput="productEditorKanalPoleWpisane(this,'vonHalsky')">${esc(vh.full)}</textarea></div></div></div></div></section>`;
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
  productEditorOdswiezJakoscOpisow(form);
  form.dataset[`productContentChanged${channel}`]="1";
}
