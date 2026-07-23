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
  return `<section class="product-editor-commandbar" aria-label="Nawigacja edytora produktu"><div class="product-editor-identity"><span>${edycja?`Produkt #${esc(p.id)}`:"Nowa kartoteka"}</span><b>${esc(p.nazwa||"Uzupełnij nazwę produktu")}</b><small>${esc(identity||"EAN, kod i producent nie są jeszcze kompletne")}</small></div><nav><a href="#product-editor-basics">Podstawowe</a><a href="#product-editor-content">Treść sklepu</a><a href="#product-editor-von-halsky">Treści kanałów</a><a href="#product-editor-prices">Ceny</a><a href="#product-editor-media">Media</a><a href="#product-editor-source">Źródło</a><a href="#product-editor-allegro">Allegro</a><a href="#product-editor-seo">SEO</a><a href="#product-editor-stock">Magazyn</a></nav><div class="product-editor-channel-state"><span class="${store[0]}">🏪 ${store[1]}</span><span class="${vh[0]}">🐕 ${vh[1]}</span>${state.allegro?`<span class="${allegro[0]}">🟠 ${allegro[1]}</span>`:""}</div></section>`;
}
function productEditorTrescHTML(p={}){
  const state=productEditorTrescStan(p);
  return `<section class="product-editor-section product-content-workspace" id="product-editor-content"><header class="product-editor-section-head"><div><span>Treść własnego sklepu</span><h2>🏪 Nazwa i opisy sklepu</h2><p>Źródło dostarcza fakty. Ta wersja zapisuje się niezależnie i błąd Allegro lub Von Halsky nigdy jej nie cofa.</p></div><div class="product-content-status ${productEditorStatusKanalu(state.store.status)[0]}"><b>${productEditorStatusKanalu(state.store.status)[1]}</b><small>Agent sklepu kontroluje wyłącznie te pola.</small></div></header><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki sklepu</b><small>Karty produktu i wprowadzenie pod tytułem</small></span><textarea name="opisKrotki" rows="4" maxlength="500" placeholder="Krótki, konkretny opis w 1–3 zdaniach." oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.short)}</textarea><em><span data-product-short-count>${state.store.short.length}</span>/500 znaków</em></label><label class="product-content-long"><span><b>Opis długi sklepu</b><small>Pełna karta produktu w Artway-TM</small></span><textarea name="opis" rows="13" maxlength="20000" placeholder="Pełny opis produktu." oninput="productEditorTrescZmieniona(this.form,'store')">${esc(state.store.full)}</textarea><em><span data-product-full-count>${state.store.full.length}</span>/20 000 znaków</em></label></div><div class="product-content-live-note" data-product-content-note><b>✓ Każdy kanał ma osobny zapis, walidację i kolejkę publikacji.</b></div></section>`;
}
function productEditorVonHalskyTrescHTML(p={}){
  const state=productEditorTrescStan(p),vh=state.vonHalsky,al=state.allegroContent;
  return `<section class="product-editor-section product-von-halsky-content" id="product-editor-von-halsky"><header class="product-editor-section-head"><div><span>Niezależne wersje kanałów</span><h2>🐕 Von Halsky i 🟠 Allegro</h2><p>Możesz edytować każdą wersję oddzielnie. Agent zapisuje i publikuje poprawny kanał nawet wtedy, gdy drugi wymaga naprawy.</p></div><div class="product-content-status is-ready"><b>Rozdzielone bezpiecznie</b><small>Wspólne pozostają tylko fakty: EAN, kod, marka, parametry, zdjęcia i źródło.</small></div></header><input type="hidden" name="vonHalskyContentMode" value="custom"><div class="product-channel-editor-grid"><article><h3>🐕 InPost Von Halsky</h3><p class="muted">Oficjalnie: nazwa 7–150 znaków, opis min. 100 znaków, bez linków i zdjęć w treści. Kontakt ustawia się w profilu sklepu, nie w ofercie.</p><label class="f-group"><span>Nazwa Von Halsky</span><input name="vonHalskyTitle" maxlength="150" value="${esc(vh.title)}" oninput="productEditorTrescZmieniona(this.form,'vonHalsky')"></label><label class="f-group"><span>Opis krótki Von Halsky</span><textarea name="vonHalskyShortDescription" rows="4" maxlength="2000" oninput="productEditorTrescZmieniona(this.form,'vonHalsky')">${esc(vh.short)}</textarea></label><label class="f-group"><span>Opis pełny Von Halsky</span><textarea name="vonHalskyDescription" rows="11" maxlength="20000" oninput="productEditorTrescZmieniona(this.form,'vonHalsky')">${esc(vh.full)}</textarea></label></article><article><h3>🟠 Allegro</h3><p class="muted">Opis wyłącznie o produkcie: bez kontaktu, linków, sprzedaży poza Allegro oraz informacji o dostawie i płatności.</p><label class="f-group"><span>Opis krótki Allegro</span><textarea name="allegroShortDescription" rows="4" maxlength="2000" oninput="productEditorTrescZmieniona(this.form,'allegro')">${esc(al.short)}</textarea></label><label class="f-group"><span>Opis pełny Allegro</span><textarea name="allegroDescription" rows="11" maxlength="20000" oninput="productEditorTrescZmieniona(this.form,'allegro')">${esc(al.full)}</textarea></label></article></div></section>`;
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
