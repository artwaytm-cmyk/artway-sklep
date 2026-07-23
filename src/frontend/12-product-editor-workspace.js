function productEditorCzyAllegroWybrane(p={}){
  let linked=false;
  try{linked=!!allegroOfertaDlaProduktuSklepu(p);}catch(error){linked=false;}
  return !!(linked||p.allegroOfferId||p.allegroProductId||p.allegroCategoryId||p.allegroPublicationIntent===true||["queued","preparing","ready","published"].includes(String(p.allegroPreparationStatus||"").toLowerCase()));
}
function productEditorZastosujWspolnaTresc(p={},poprzedni={}){
  const now=new Date().toISOString(),allegroSelected=productEditorCzyAllegroWybrane(p),changed=["nazwa","opisKrotki","opis"].some(key=>String(p[key]||"")!==String(poprzedni[key]||"")),diverged=String(p.allegroDescription||"")!==String(p.opis||"");
  delete p.allegroShortDescription;
  p.vonHalskyContentMode="store";
  p.vonHalskyContentSource="store-canonical-content";
  p.vonHalskyContentUpdatedAt=now;
  for(const key of ["vonHalskyTitle","vonHalskyShortDescription","vonHalskyDescription"])delete p[key];
  const editorial={...(p.contentEditorial||{}),channels:allegroSelected?"shared_store_allegro_von_halsky":"shared_store_von_halsky",targets:{store:true,vonHalsky:true,allegro:allegroSelected},canonicalFields:{title:"nazwa",shortDescription:"opisKrotki",fullDescription:"opis"},layoutPolicy:"allegro_sections",source:"product-editor-canonical-content",updatedAt:now};
  if(allegroSelected){
    p.allegroDescription=String(p.opis||"");
    if(changed||diverged){
      delete p.allegroDescriptionSections;
      editorial.status="needs_layout_refresh";
      editorial.queuedReason=changed?"administrator_content_changed":"legacy_content_aligned";
      editorial.queuedAt=now;
      p.allegroEditorialSyncPending=true;
      p.allegroEditorialSyncPendingAt=now;
      p.allegroEditorialSyncState="queued";
      p.allegroEditorialSyncError="";
    }
  }else if(changed){
    editorial.status="ready";
    editorial.preparedAt=now;
  }
  p.contentEditorial=editorial;
  return p;
}
function productEditorTrescStan(p={}){
  const allegro=productEditorCzyAllegroWybrane(p),legacyVonHalsky=String(p.vonHalskyContentMode||"").toLowerCase()==="custom",short=String(legacyVonHalsky?p.vonHalskyShortDescription||p.opisKrotki||p.krotkiOpis||"":p.opisKrotki||p.krotkiOpis||""),full=String(legacyVonHalsky?p.vonHalskyDescription||p.opis||"":p.opis||""),same=!allegro||String(p.allegroDescription||full)===full,pending=allegro&&(p.allegroEditorialSyncPending===true||p.contentEditorial?.status==="needs_layout_refresh");
  return {allegro,legacyVonHalsky,short,full,same,pending,complete:!!(short&&full)};
}
function productEditorVonHalskyTrescStan(p={}){
  const content=productEditorTrescStan(p);
  return {
    custom:false,
    migrating:content.legacyVonHalsky,
    title:String(p.nazwa||""),
    short:content.short,
    full:content.full,
  };
}
function productEditorNaglowekHTML(p={},edycja=false){
  const state=productEditorTrescStan(p),vonHalsky=productEditorVonHalskyTrescStan(p),identity=[p.gtin||p.ean,kodKanonicznyProduktu(p),p.producent||p.marka].filter(Boolean).join(" • ");
  return `<section class="product-editor-commandbar" aria-label="Nawigacja edytora produktu"><div class="product-editor-identity"><span>${edycja?`Produkt #${esc(p.id)}`:"Nowa kartoteka"}</span><b>${esc(p.nazwa||"Uzupełnij nazwę produktu")}</b><small>${esc(identity||"EAN, kod i producent nie są jeszcze kompletne")}</small></div><nav><a href="#product-editor-basics">Podstawowe</a><a href="#product-editor-content">Treść</a><a href="#product-editor-von-halsky">Kanały</a><a href="#product-editor-prices">Ceny</a><a href="#product-editor-media">Media</a><a href="#product-editor-source">Źródło</a><a href="#product-editor-allegro">Allegro</a><a href="#product-editor-seo">SEO</a><a href="#product-editor-stock">Magazyn</a></nav><div class="product-editor-channel-state"><span class="${state.complete?"is-ready":"needs-work"}">${state.complete?"✓ Treść kompletna":"! Uzupełnij treść"}</span><span class="${state.allegro?(state.pending?"is-pending":"is-ready"):"is-neutral"}">${state.allegro?(state.pending?"↻ Allegro w kolejce":"✓ Sklep + Allegro"):"Sklep"}</span><span class="${vonHalsky.migrating?"is-pending":"is-ready"}">${vonHalsky.migrating?"↻ Scalanie Von Halsky":"✓ Sklep + Von Halsky"}</span></div></section>`;
}
function productEditorTrescHTML(p={}){
  const state=productEditorTrescStan(p),status=state.legacyVonHalsky?"Starsza prezentacja Von Halsky została pokazana w polach głównych. Zapis scali ją z kartoteką sklepu, a Agent uporządkuje ją w swojej kolejce.":state.allegro?(state.pending?"Po zapisie Agent przebuduje układ i zaktualizuje powiązaną ofertę.":state.same?"Sklep, Von Halsky i Allegro korzystają z tej samej zapisanej treści.":"Wykryto starszą rozbieżną treść. Zapis automatycznie ją wyrówna."):"Sklep i Von Halsky korzystają z jednego opisu; Agent sukcesywnie poprawia katalog.";
  return `<section class="product-editor-section product-content-workspace" id="product-editor-content"><header class="product-editor-section-head"><div><span>Treść sprzedażowa</span><h2>Jeden opis dla sklepu, Von Halsky i Allegro</h2><p>To są jedyne pola opisów produktu. Link źródłowy dostarcza fakty, a Agent zapisuje tutaj finalną treść używaną we wszystkich aktywnych kanałach.</p></div><div class="product-content-status ${state.pending||state.legacyVonHalsky?"is-pending":state.same?"is-ready":"needs-work"}"><b>${state.pending||state.legacyVonHalsky?"Synchronizacja oczekuje":state.same?"Jedno źródło treści":"Treść do wyrównania"}</b><small>${esc(status)}</small></div></header><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki</b><small>Karty produktu, wyniki wyszukiwania i wprowadzenie pod tytułem</small></span><textarea name="opisKrotki" rows="4" maxlength="500" placeholder="Krótki, konkretny opis w 1–3 zdaniach." oninput="productEditorTrescZmieniona(this.form)">${esc(state.short)}</textarea><em><span data-product-short-count>${state.short.length}</span>/500 znaków</em></label><label class="product-content-long"><span><b>Opis długi</b><small>Pełna karta sklepu, prezentacja Von Halsky i sekcje oferty Allegro</small></span><textarea name="opis" rows="13" maxlength="20000" placeholder="Pełny opis korzyści, zastosowania, zawartości i najważniejszych cech produktu." oninput="productEditorTrescZmieniona(this.form)">${esc(state.full)}</textarea><em><span data-product-full-count>${state.full.length}</span>/20 000 znaków</em></label></div><div class="product-content-channel-map"><article><span>🏪</span><div><b>Sklep</b><small>Opis krótki na listach i pod tytułem; opis długi w pełnej karcie produktu.</small></div></article><article><span>🐕</span><div><b>Von Halsky</b><small>Dokładnie ta sama treść i ta sama kolejność informacji co w sklepie.</small></div></article><article><span>🟠</span><div><b>Allegro</b><small>Ta sama treść; automat zmienia wyłącznie techniczny układ na dozwolone sekcje.</small></div></article><article><span>🤖</span><div><b>Agent redakcji</b><small>Idzie kolejno po katalogu, zapisuje wynik i nie wraca bez zmiany faktów źródłowych.</small></div></article></div><div class="product-content-live-note" data-product-content-note><b>${state.pending||state.legacyVonHalsky?"↻":"✓"} ${esc(status)}</b></div></section>`;
}
function productEditorVonHalskyTrescHTML(p={}){
  const state=productEditorVonHalskyTrescStan(p);
  return `<section class="product-editor-section product-von-halsky-content" id="product-editor-von-halsky"><header class="product-editor-section-head"><div><span>Wspólna prezentacja kanałów</span><h2>🏪 Sklep = 🐕 Von Halsky</h2><p>Von Halsky nie ma już osobnego pola opisu. Korzysta bezpośrednio z nazwy, opisu krótkiego i opisu pełnego zapisanych w głównej kartotece.</p></div><div class="product-content-status ${state.migrating?"is-pending":"is-ready"}"><b>${state.migrating?"Migracja w kolejce":"Treść połączona"}</b><small>${state.migrating?"Agent scali starsze dopasowanie z opisem sklepu i zapisze jeden wynik.":"Każda zmiana opisu sklepu automatycznie obowiązuje także w Von Halsky."}</small></div></header><div class="product-content-channel-map product-von-halsky-flow"><article><span>✍️</span><div><b>Jedna edycja</b><small>Zmieniasz opis tylko w sekcji „Treść sprzedażowa”.</small></div></article><article><span>🏪</span><div><b>Sklep</b><small>Wyświetla zapisany opis i wspólny układ sekcji.</small></div></article><article><span>🐕</span><div><b>Von Halsky</b><small>Otrzymuje ten sam opis bez ręcznego kopiowania.</small></div></article><article><span>🤖</span><div><b>Agent</b><small>Sukcesywnie poprawia kolejne kartoteki i zapisuje postęp.</small></div></article></div></section>`;
}
function productEditorTrescZmieniona(form){
  if(!form)return;
  const short=String(form.elements.opisKrotki?.value||""),full=String(form.elements.opis?.value||"");
  const shortCount=form.querySelector("[data-product-short-count]"),fullCount=form.querySelector("[data-product-full-count]"),note=form.querySelector("[data-product-content-note]");
  if(shortCount)shortCount.textContent=String(short.length);
  if(fullCount)fullCount.textContent=String(full.length);
  if(note)note.innerHTML=short&&full?"<b>↻ Zmieniona treść zostanie zapisana w sklepie i przekazana do aktualizacji Allegro.</b>":"<b>! Uzupełnij oba opisy, aby karta produktu była kompletna.</b>";
  form.dataset.productContentChanged="1";
}
