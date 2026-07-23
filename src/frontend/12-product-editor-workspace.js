function productEditorCzyAllegroWybrane(p={}){
  let linked=false;
  try{linked=!!allegroOfertaDlaProduktuSklepu(p);}catch(error){linked=false;}
  return !!(linked||p.allegroOfferId||p.allegroProductId||p.allegroCategoryId||p.allegroPublicationIntent===true||["queued","preparing","ready","published"].includes(String(p.allegroPreparationStatus||"").toLowerCase()));
}
function productEditorZastosujWspolnaTresc(p={},poprzedni={}){
  const now=new Date().toISOString(),allegroSelected=productEditorCzyAllegroWybrane(p),changed=["nazwa","opisKrotki","opis"].some(key=>String(p[key]||"")!==String(poprzedni[key]||"")),diverged=String(p.allegroDescription||"")!==String(p.opis||"");
  delete p.allegroShortDescription;
  const editorial={...(p.contentEditorial||{}),channels:allegroSelected?"shared_store_and_allegro":"store_only",targets:{store:true,allegro:allegroSelected},canonicalFields:{title:"nazwa",shortDescription:"opisKrotki",fullDescription:"opis"},layoutPolicy:"allegro_sections",source:"product-editor-canonical-content",updatedAt:now};
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
  const allegro=productEditorCzyAllegroWybrane(p),short=String(p.opisKrotki||p.krotkiOpis||""),full=String(p.opis||""),same=!allegro||String(p.allegroDescription||full)===full,pending=allegro&&(p.allegroEditorialSyncPending===true||p.contentEditorial?.status==="needs_layout_refresh");
  return {allegro,short,full,same,pending,complete:!!(short&&full)};
}
function productEditorVonHalskyTrescStan(p={}){
  const custom=String(p.vonHalskyContentMode||"").toLowerCase()==="custom";
  return {
    custom,
    title:String(custom?p.vonHalskyTitle||p.nazwa||"":p.nazwa||""),
    short:String(custom?p.vonHalskyShortDescription||p.opisKrotki||"":p.opisKrotki||""),
    full:String(custom?p.vonHalskyDescription||p.opis||"":p.opis||""),
  };
}
function productEditorNaglowekHTML(p={},edycja=false){
  const state=productEditorTrescStan(p),vonHalsky=productEditorVonHalskyTrescStan(p),identity=[p.gtin||p.ean,kodKanonicznyProduktu(p),p.producent||p.marka].filter(Boolean).join(" • ");
  return `<section class="product-editor-commandbar" aria-label="Nawigacja edytora produktu"><div class="product-editor-identity"><span>${edycja?`Produkt #${esc(p.id)}`:"Nowa kartoteka"}</span><b>${esc(p.nazwa||"Uzupełnij nazwę produktu")}</b><small>${esc(identity||"EAN, kod i producent nie są jeszcze kompletne")}</small></div><nav><a href="#product-editor-basics">Podstawowe</a><a href="#product-editor-content">Treść</a><a href="#product-editor-von-halsky">Von Halsky</a><a href="#product-editor-prices">Ceny</a><a href="#product-editor-media">Media</a><a href="#product-editor-source">Źródło</a><a href="#product-editor-allegro">Allegro</a><a href="#product-editor-seo">SEO</a><a href="#product-editor-stock">Magazyn</a></nav><div class="product-editor-channel-state"><span class="${state.complete?"is-ready":"needs-work"}">${state.complete?"✓ Treść kompletna":"! Uzupełnij treść"}</span><span class="${state.allegro?(state.pending?"is-pending":"is-ready"):"is-neutral"}">${state.allegro?(state.pending?"↻ Allegro w kolejce":"✓ Sklep + Allegro"):"Sklep"}</span><span class="${vonHalsky.custom?"is-ready":"is-neutral"}">${vonHalsky.custom?"✓ Von Halsky dopasowany":"Von Halsky ← sklep"}</span></div></section>`;
}
function productEditorTrescHTML(p={}){
  const state=productEditorTrescStan(p),status=state.allegro?(state.pending?"Po zapisie Agent przebuduje układ i zaktualizuje powiązaną ofertę.":state.same?"Oba kanały korzystają z tej samej zapisanej treści.":"Wykryto starszą rozbieżną treść. Zapis automatycznie ją wyrówna."):"Treść jest gotowa dla sklepu; po wybraniu Allegro zostanie użyta także w ofercie.";
  return `<section class="product-editor-section product-content-workspace" id="product-editor-content"><header class="product-editor-section-head"><div><span>Treść sprzedażowa</span><h2>Opis wspólny dla sklepu i Allegro</h2><p>To są jedyne pola opisów produktu. Link źródłowy dostarcza fakty, a po poprawie Agent i administrator zapisują tutaj finalną treść używaną w obu kanałach.</p></div><div class="product-content-status ${state.pending?"is-pending":state.same?"is-ready":"needs-work"}"><b>${state.pending?"Synchronizacja oczekuje":state.same?"Jedno źródło treści":"Treść do wyrównania"}</b><small>${esc(status)}</small></div></header><div class="product-content-grid"><label class="product-content-short"><span><b>Opis krótki</b><small>Karty produktu, wyniki wyszukiwania i wprowadzenie pod tytułem</small></span><textarea name="opisKrotki" rows="4" maxlength="500" placeholder="Krótki, konkretny opis w 1–3 zdaniach." oninput="productEditorTrescZmieniona(this.form)">${esc(state.short)}</textarea><em><span data-product-short-count>${state.short.length}</span>/500 znaków</em></label><label class="product-content-long"><span><b>Opis długi</b><small>Pełna karta produktu oraz treść sekcji oferty Allegro</small></span><textarea name="opis" rows="13" maxlength="20000" placeholder="Pełny opis korzyści, zastosowania, zawartości i najważniejszych cech produktu." oninput="productEditorTrescZmieniona(this.form)">${esc(state.full)}</textarea><em><span data-product-full-count>${state.full.length}</span>/20 000 znaków</em></label></div><div class="product-content-channel-map"><article><span>🏪</span><div><b>Sklep</b><small>Opis krótki na listach i pod tytułem; opis długi w pełnej karcie produktu.</small></div></article><article><span>🟠</span><div><b>Allegro</b><small>Ta sama treść; automat zmienia wyłącznie techniczny układ na dozwolone sekcje Allegro.</small></div></article><article><span>🤖</span><div><b>Agent redakcji</b><small>Poprawia styl i zgodność, zapisując wynik z powrotem w tych samych dwóch polach.</small></div></article></div><div class="product-content-live-note" data-product-content-note><b>${state.pending?"↻":"✓"} ${esc(status)}</b></div></section>`;
}
function productEditorVonHalskyTrescHTML(p={}){
  const state=productEditorVonHalskyTrescStan(p);
  return `<section class="product-editor-section product-von-halsky-content" id="product-editor-von-halsky"><header class="product-editor-section-head"><div><span>Prezentacja kanałowa</span><h2>🐕 Karta produktu Von Halsky</h2><p>Domyślnie kanał korzysta z finalnej oferty sklepowej. Własne dopasowanie włącz tylko wtedy, gdy tytuł lub opis powinien wyglądać inaczej w tym kanale.</p></div><div class="product-content-status ${state.custom?"is-ready":"is-neutral"}"><b>${state.custom?"Osobne dopasowanie":"Połączona ze sklepem"}</b><small>${state.custom?"Puste pola nadal bezpiecznie dziedziczą dane sklepu.":"Każda poprawa treści sklepowej automatycznie trafia do projekcji Von Halsky."}</small></div></header><div class="product-von-halsky-mode"><label><input type="radio" name="vonHalskyContentMode" value="store" ${state.custom?"":"checked"} onchange="productEditorVonHalskyTrybZmieniony(this.form)"> <span><b>Używaj treści sklepowej</b><small>Zalecane — jedno aktualne źródło nazwy i opisów.</small></span></label><label><input type="radio" name="vonHalskyContentMode" value="custom" ${state.custom?"checked":""} onchange="productEditorVonHalskyTrybZmieniony(this.form)"> <span><b>Dopasuj tylko dla Von Halsky</b><small>Osobna prezentacja bez zmiany sklepu i Allegro.</small></span></label></div><div class="product-von-halsky-fields ${state.custom?"":"is-inherited"}" data-von-halsky-fields><label><span><b>Tytuł Von Halsky</b><small>Pusty = nazwa sklepu</small></span><input name="vonHalskyTitle" maxlength="150" value="${esc(p.vonHalskyTitle||"")}" placeholder="${esc(p.nazwa||"Nazwa produktu ze sklepu")}"></label><label><span><b>Opis krótki Von Halsky</b><small>Pusty = opis krótki sklepu</small></span><textarea name="vonHalskyShortDescription" rows="4" maxlength="1000" placeholder="Dziedziczony z oferty sklepowej">${esc(p.vonHalskyShortDescription||"")}</textarea></label><label class="product-von-halsky-long"><span><b>Opis długi Von Halsky</b><small>Pusty = opis długi sklepu</small></span><textarea name="vonHalskyDescription" rows="11" maxlength="20000" placeholder="Dziedziczony z oferty sklepowej">${esc(p.vonHalskyDescription||"")}</textarea></label></div><div class="product-content-channel-map product-von-halsky-flow"><article><span>🏪</span><div><b>Oferta sklepowa</b><small>Główne źródło nazwy, treści, galerii i parametrów.</small></div></article><article><span>🐕</span><div><b>Projekcja Von Halsky</b><small>Usuwa niedozwolone znaczniki, zachowuje akapity i układa osobno galerię oraz parametry.</small></div></article><article><span>👁️</span><div><b>Podgląd przed wysłaniem</b><small>Dostępny przy każdym produkcie w katalogu ofert Von Halsky.</small></div></article></div></section>`;
}
function productEditorVonHalskyTrybZmieniony(form){
  if(!form)return;const custom=String(new FormData(form).get("vonHalskyContentMode")||"store")==="custom",fields=form.querySelector("[data-von-halsky-fields]");
  fields?.classList.toggle("is-inherited",!custom);
  fields?.querySelectorAll("input,textarea").forEach(input=>input.disabled=!custom);
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
