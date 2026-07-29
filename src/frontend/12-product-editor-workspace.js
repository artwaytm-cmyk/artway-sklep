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
function productEditorNaglowekHTML(p={},edycja=false){
  const state=productEditorTrescStan(p),identity=[p.gtin||p.ean,kodKanonicznyProduktu(p),p.producent||p.marka].filter(Boolean).join(" • "),store=productEditorStatusKanalu(state.store.status),vh=productEditorStatusKanalu(state.vonHalsky.status),allegro=productEditorStatusKanalu(state.allegroContent.status);
  return `<section class="product-editor-commandbar" aria-label="Nawigacja edytora produktu"><div class="product-editor-identity"><span>${edycja?`Produkt #${esc(p.id)}`:"Nowa kartoteka"}</span><b>${esc(p.nazwa||"Uzupełnij nazwę produktu")}</b><small>${esc(identity||"EAN, kod i producent nie są jeszcze kompletne")}</small></div><nav><a href="#product-editor-record">Kartoteka</a><a href="#product-editor-basics">Podstawowe</a><a href="#product-editor-content">Treść sklepu</a><a href="#product-editor-von-halsky">Treści kanałów</a><a href="#product-editor-prices">Ceny</a><a href="#product-editor-media">Media</a><a href="#product-editor-source">Źródło</a><a href="#product-editor-allegro">Allegro</a><a href="#product-editor-seo">SEO</a><a href="#product-editor-stock">Magazyn</a></nav><div class="product-editor-channel-state"><span class="${store[0]}">🏪 ${store[1]}</span><span class="${vh[0]}">🐕 ${vh[1]}</span>${state.allegro?`<span class="${allegro[0]}">🟠 ${allegro[1]}</span>`:""}</div></section>`;
}
function productEditorTrescHTML(p={}){
  const state=productEditorTrescStan(p);
  return `<section class="product-editor-section product-content-workspace" id="product-editor-content"><header class="product-editor-section-head"><div><span>Treść własnego sklepu</span><h2>🏪 Nazwa i opisy sklepu</h2><p>Źródło dostarcza fakty. Ta wersja zapisuje się niezależnie i błąd Allegro lub Von Halsky nigdy jej nie cofa.</p></div><div class="product-content-status ${productEditorStatusKanalu(state.store.status)[0]}"><b>${productEditorStatusKanalu(state.store.status)[1]}</b><small>Agent sklepu kontroluje wyłącznie te pola.</small></div></header><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki sklepu</b><small>Karty produktu i wprowadzenie pod tytułem</small></span><textarea name="opisKrotki" rows="4" maxlength="500" placeholder="Krótki, konkretny opis w 1–3 zdaniach." oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.short)}</textarea><em><span data-product-short-count>${state.store.short.length}</span>/500 znaków</em></label><label class="product-content-long"><span><b>Opis długi sklepu</b><small>Pełna karta produktu w Artway-TM</small></span><textarea name="opis" rows="13" maxlength="20000" placeholder="Pełny opis produktu." oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.full)}</textarea><em><span data-product-full-count>${state.store.full.length}</span>/20 000 znaków</em></label></div><div class="product-content-live-note" data-product-content-note><b>✓ Każdy kanał ma osobny zapis, walidację i kolejkę publikacji.</b></div></section>`;
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
  const state=productEditorTrescStan(p),vh=state.vonHalsky,al=state.allegroContent,vhStatus=productEditorStatusKanalu(vh.status);
  return `<section class="product-editor-section product-von-halsky-content" id="product-editor-von-halsky"><header class="product-editor-section-head"><div><span>Niezależne wersje kanałów</span><h2>🐕 Von Halsky i 🟠 Allegro</h2><p>Każda zmiana Agenta trafia do tej samej centralnej kartoteki. Poniżej widać treść, wynik kontroli, braki i pola potwierdzone po zapisie.</p></div><div class="product-content-status ${vhStatus[0]}"><b>${vhStatus[1]}</b><small>Stan pochodzi z ostatniego potwierdzonego zapisu serwera.</small></div></header>${productEditorVonHalskyAuditHTML(p)}<input type="hidden" name="vonHalskyContentMode" value="custom"><div class="product-channel-editor-grid"><article><h3>🐕 InPost Von Halsky</h3><p class="muted">Oficjalnie: nazwa 7–150 znaków, opis min. 100 znaków, bez linków i zdjęć w treści. Kontakt ustawia się w profilu sklepu, nie w ofercie.</p><label class="f-group"><span>Nazwa Von Halsky</span><input name="vonHalskyTitle" maxlength="150" value="${esc(vh.title)}" oninput="productEditorTrescZmieniona(this.form,'vonHalsky')"></label><label class="f-group"><span>Opis krótki Von Halsky</span><textarea name="vonHalskyShortDescription" rows="4" maxlength="2000" oninput="productEditorTrescZmieniona(this.form,'vonHalsky')">${esc(vh.short)}</textarea></label><label class="f-group"><span>Opis pełny Von Halsky</span><textarea name="vonHalskyDescription" rows="11" maxlength="20000" oninput="productEditorTrescZmieniona(this.form,'vonHalsky')">${esc(vh.full)}</textarea></label></article><article><h3>🟠 Allegro</h3><p class="muted">Opis wyłącznie o produkcie: bez kontaktu, linków, sprzedaży poza Allegro oraz informacji o dostawie i płatności.</p><label class="f-group"><span>Opis krótki Allegro</span><textarea name="allegroShortDescription" rows="4" maxlength="2000" oninput="productEditorTrescZmieniona(this.form,'allegro')">${esc(al.short)}</textarea></label><label class="f-group"><span>Opis pełny Allegro</span><textarea name="allegroDescription" rows="11" maxlength="20000" oninput="productEditorTrescZmieniona(this.form,'allegro')">${esc(al.full)}</textarea></label></article></div></section>`;
}
function productEditorTrescZmieniona(form,channel="store"){
  if(!form)return;
  if(channel==="store"){
    const short=String(form.elements.opisKrotki?.value||""),full=String(form.elements.opis?.value||""),shortCount=form.querySelector("[data-product-short-count]"),fullCount=form.querySelector("[data-product-full-count]");
    if(shortCount)shortCount.textContent=String(short.length);if(fullCount)fullCount.textContent=String(full.length);
  }
  const note=form.querySelector("[data-product-content-note]");if(note)note.innerHTML=`<b>↻ Zmiana kanału ${esc(channel)} zostanie zapisana niezależnie i sprawdzona przez jego Agenta.</b>`;
  form.dataset[`productContentChanged${channel}`]="1";
}
