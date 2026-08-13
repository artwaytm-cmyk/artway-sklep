/* Podgląd pełnej wersji strony. Token daje wyłącznie odczyt szkicu i nie
   pozwala wykonać żadnej operacji administracyjnej ani złożyć zamówienia. */
const siteReleasePreviewTokenValue=(()=>{try{return new URLSearchParams(location.search).get("site_preview")||"";}catch(error){return "";}})();
const siteReleaseEditorRequested=(()=>{try{return new URLSearchParams(location.search).get("site_editor")==="1";}catch(error){return false;}})();
const siteReleaseEmbedRequested=(()=>{try{return new URLSearchParams(location.search).get("site_embed")==="1";}catch(error){return false;}})();
let siteReleasePreviewState={active:!!siteReleasePreviewTokenValue,loading:!!siteReleasePreviewTokenValue,valid:false,error:"",draft:null,release:null};
let siteReleasePreviewStylesPromise=null;
function siteReleasePreviewEnsureStyles(){
  if(!siteReleasePreviewTokenValue)return Promise.resolve();
  if(document.getElementById("siteReleasePreviewStyles")?.sheet)return Promise.resolve();
  if(siteReleasePreviewStylesPromise)return siteReleasePreviewStylesPromise;
  siteReleasePreviewStylesPromise=new Promise((resolve,reject)=>{const link=document.createElement("link"),version=document.querySelector('meta[name="artway-version"]')?.content||"dev";link.id="siteReleasePreviewStyles";link.rel="stylesheet";link.href=`/assets/site-release-preview.css?v=${encodeURIComponent(version)}`;link.onload=resolve;link.onerror=()=>{link.remove();siteReleasePreviewStylesPromise=null;reject(new Error("Nie udało się wczytać wyglądu edytora wersji."));};document.head.append(link);});return siteReleasePreviewStylesPromise;
}
function siteReleasePreviewActive(){return siteReleasePreviewState.active;}
function siteReleasePreviewToken(){return siteReleasePreviewTokenValue;}
function siteReleaseVisualEditorActive(){return siteReleaseEditorRequested&&siteReleasePreviewState.valid;}
async function siteReleasePreviewLoad(){
  if(!siteReleasePreviewTokenValue)return null;
  try{
    await siteReleasePreviewEnsureStyles();
    const url=new URL("/api/store",location.origin);url.searchParams.set("action","site-release-preview");url.searchParams.set("token",siteReleasePreviewTokenValue);
    if(siteReleaseEditorRequested)url.searchParams.set("editor","1");
    const response=await fetch(url,{headers:{Accept:"application/json"},credentials:"same-origin",cache:"no-store"}),data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok===false)throw new Error(data.error||"Nie udało się otworzyć wersji roboczej.");
    siteReleasePreviewState={active:true,loading:false,valid:true,error:"",draft:data.draft||null,release:data.active||null};return data.draft||null;
  }catch(error){siteReleasePreviewState={active:true,loading:false,valid:false,error:String(error?.message||error),draft:null,release:null};return null;}
}
function siteReleasePreviewApplySettings(){
  const draft=siteReleasePreviewState.draft;if(!draft?.settingsPatch)return false;
  ustawienia={...ustawienia,...draft.settingsPatch};for(const key of draft.settingsRemove||[])delete ustawienia[key];return true;
}
function siteReleasePreviewProduct(product){
  if(!product||!siteReleasePreviewState.valid)return product;
  const entry=siteReleasePreviewState.draft?.productPatches?.[String(product.id)];if(!entry)return product;
  const next={...product,...(entry.fields||{})};for(const key of entry.remove||[])delete next[key];return next;
}
function siteReleasePreviewProducts(items=[]){return (Array.isArray(items)?items:[]).map(siteReleasePreviewProduct);}
function siteReleasePreviewDecorate(){
  document.getElementById("siteReleasePreviewBar")?.remove();if(!siteReleasePreviewState.active)return;
  document.body.classList.add("site-release-preview-mode");
  const bar=document.createElement("aside");bar.id="siteReleasePreviewBar";bar.className=`site-release-preview-bar ${siteReleasePreviewState.valid?"is-valid":"is-error"}`;
  if(siteReleaseVisualEditorActive())bar.classList.add("is-editor");
  if(siteReleaseEmbedRequested)bar.classList.add("is-embed");
  bar.innerHTML=siteReleasePreviewState.valid
    ? siteReleaseVisualEditorActive()?siteReleaseVisualToolbarHTML():siteReleaseEmbedRequested?`<div><b>👁️ PODGLĄD WERSJI ROBOCZEJ</b><span>${esc(siteReleasePreviewState.draft?.name||"Szkic strony")}</span></div>`:`<div><b>👁️ WERSJA ROBOCZA — KLIENCI TEGO JESZCZE NIE WIDZĄ</b><span>${esc(siteReleasePreviewState.draft?.name||"Podgląd strony")} • układ, treści i przygotowane ceny</span></div><div><a href="/#/admin/personalizacja/wersje">Wróć do centrum wersji</a><button type="button" onclick="window.close()">Zamknij podgląd</button></div>`
    : `<div><b>⚠️ Podgląd nie jest już aktualny</b><span>${esc(siteReleasePreviewState.error||"Token podglądu wygasł.")}</span></div><a href="/#/admin/personalizacja/wersje">Wróć do panelu</a>`;
  document.body.prepend(bar);
  if(siteReleaseVisualEditorActive())siteReleaseVisualEditorDecorate();
  const checkout=document.getElementById("checkoutBtn");if(checkout){checkout.disabled=true;checkout.title="Zakupy są wyłączone w podglądzie wersji roboczej";checkout.textContent="Podgląd — bez zamówienia";}
  document.querySelectorAll(".checkout-btn").forEach(button=>{button.disabled=true;button.title="Zakupy są wyłączone w podglądzie wersji roboczej";button.textContent="Podgląd wersji — zamówienie wyłączone";});
}

function siteReleaseEditorSummary(){
  const draft=siteReleasePreviewState.draft||{},summary=draft.summary||{};
  return {settings:Number(summary.settings)||Object.keys(draft.settingsPatch||{}).length+(draft.settingsRemove||[]).length,products:Number(summary.products)||Object.keys(draft.productPatches||{}).length};
}
function siteReleaseVisualToolbarHTML(){
  const summary=siteReleaseEditorSummary(),release=siteReleasePreviewState.release||{};
  return `<div class="site-release-editor-brand"><span>✦</span><div><b>EDYTOR WERSJI ROBOCZEJ</b><small>${esc(siteReleasePreviewState.draft?.name||"Wersja robocza")} • klienci nadal widzą ${esc(release.name||"wersję opublikowaną")}</small></div></div><div class="site-release-editor-state"><strong>${summary.settings+summary.products}</strong><span>nieopublikowanych zmian<small>${summary.settings} strona • ${summary.products} produkty</small></span></div><div class="site-release-editor-devices" aria-label="Rozmiar podglądu"><button type="button" data-editor-device="desktop" onclick="siteReleaseEditorSetViewport('desktop')" title="Komputer">▰</button><button type="button" data-editor-device="tablet" onclick="siteReleaseEditorSetViewport('tablet')" title="Tablet">▯</button><button type="button" data-editor-device="mobile" onclick="siteReleaseEditorSetViewport('mobile')" title="Telefon">▯</button></div><div class="site-release-editor-actions"><a href="/#/admin">Panel administratora</a><a href="/#/" target="_blank" rel="noopener">Sklep opublikowany</a><button type="button" onclick="siteReleaseEditorToggleAgent()">🤖 Agent AI</button><button type="button" onclick="siteReleaseEditorOpenDrawer('navigator')">☰ Elementy</button><button type="button" onclick="siteReleaseEditorOpenWorkspace('wersje','porownanie')">Porównaj</button><button class="primary" type="button" onclick="siteReleaseEditorOpenWorkspace('wersje','porownanie')">Sprawdź i opublikuj</button></div>`;
}
function siteReleaseVisualEditorDecorate(){
  document.body.classList.add("site-release-visual-editor");
  let canvas=document.getElementById("siteReleaseEditorCanvas");
  if(!canvas){canvas=document.createElement("div");canvas.id="siteReleaseEditorCanvas";canvas.className="site-release-editor-canvas";document.getElementById("siteReleasePreviewBar")?.after(canvas);[document.getElementById("topbar"),document.querySelector("body>header"),document.querySelector("body>main"),document.querySelector("body>footer")].filter(Boolean).forEach(element=>canvas.append(element));}
  document.querySelectorAll(".site-release-element-action").forEach(button=>button.remove());
  const actions=[[canvas.querySelector("#topbar"),"info","Pasek informacyjny"],[canvas.querySelector(":scope>header"),"header","Nagłówek i logo"],[canvas.querySelector(".hero"),"hero","Hero"],[canvas.querySelector(".catalog-head"),"offer","Oferta"],[canvas.querySelector(".home-categories"),"home","Katalogi"],[canvas.querySelector(".offer-band"),"banners","Pasek promocji","__promo"],[canvas.querySelector(".perks"),"layout","Zalety"],[canvas.querySelector(".home-steps"),"home","Jak kupić"],[canvas.querySelector(".home-about"),"pages","O sklepie"],[canvas.querySelector(".home-faq"),"pages","FAQ"],[canvas.querySelector(".home-contact"),"pages","Kontakt"],[canvas.querySelector(":scope>footer"),"footer","Stopka i kontakt"]];
  actions.forEach(([target,kind,label,id])=>siteReleaseEditorAttachAction(target,kind,label,id));
  canvas.querySelectorAll(".managed-banner-shell").forEach(target=>siteReleaseEditorAttachAction(target,"banners","Banner",target.dataset.managedBannerId||""));
  canvas.querySelectorAll(".card").forEach(target=>{const href=target.querySelector('a[href*="/produkt/"]')?.getAttribute("href")||"",id=decodeURIComponent((href.match(/\/produkt\/([^?#]+)/)||[])[1]||"");if(id)siteReleaseEditorAttachAction(target,"product","Produkt",id);});
  siteReleaseEditorSetViewport(sessionStorage.getItem("artway_site_editor_viewport")||"desktop",false);
  const editorParams=new URLSearchParams(location.search),panel=editorParams.get("site_editor_panel")||"",focus=editorParams.get("site_editor_focus")||"";if(panel){editorParams.delete("site_editor_panel");editorParams.delete("site_editor_focus");history.replaceState(null,"",`${location.pathname}?${editorParams.toString()}${location.hash||"#/"}`);setTimeout(()=>siteReleaseEditorOpenWorkspace(panel,focus),80);}
}
function siteReleaseEditorAttachAction(target,kind,label,id=""){
  if(!target)return;target.classList.add("site-release-editable-element");const button=document.createElement("button");button.type="button";button.className="site-release-element-action";button.innerHTML=`<span>✎</span>${esc(label)}`;button.onclick=event=>{event.preventDefault();event.stopPropagation();const workspace={banners:"bannery",home:"home",layout:"rozmieszczenie",pages:"podstrony"}[kind];if(workspace)siteReleaseEditorOpenWorkspace(workspace,id);else siteReleaseEditorOpenDrawer(kind,id);};target.append(button);
}
function siteReleaseEditorSetViewport(mode="desktop",remember=true){
  const safe=["desktop","tablet","mobile"].includes(mode)?mode:"desktop",canvas=document.getElementById("siteReleaseEditorCanvas");if(canvas)canvas.dataset.viewport=safe;
  document.querySelectorAll("[data-editor-device]").forEach(button=>button.classList.toggle("active",button.dataset.editorDevice===safe));if(remember)try{sessionStorage.setItem("artway_site_editor_viewport",safe);}catch(error){}
}
function siteReleaseEditorText(value=""){return esc(String(value??""));}
function siteReleaseEditorField(label,name,value,{type="text",rows=0,step="",hint=""}={}){return `<label><span>${esc(label)}</span>${rows?`<textarea name="${esc(name)}" rows="${rows}">${siteReleaseEditorText(value)}</textarea>`:`<input name="${esc(name)}" type="${esc(type)}" value="${siteReleaseEditorText(value)}" ${step?`step="${esc(step)}"`:""}>`}${hint?`<small>${esc(hint)}</small>`:""}</label>`;}
function siteReleaseEditorContextLinks(kind=""){
  const links={header:[["wyglad","🎨 Pełny wygląd"],["ikony","🧩 Logo i ikony"]],info:[["dostawy","🚚 Dostawa i płatności"],["wyglad","🎨 Widoczność i kolory"]],hero:[["bannery","🖼️ Obraz, kadr i telefon","__hero"],["rozmieszczenie","↕ Położenie sekcji"]],offer:[["home","🏷️ Pełna oferta"],["rozmieszczenie","↕ Położenie sekcji"]],footer:[["wyglad","🎨 Pełna stopka"],["strony","📄 Dane i treści"]],product:[]}[kind]||[];
  const buttons=links.map(([section,label,focus])=>`<button type="button" onclick="siteReleaseEditorOpenWorkspace('${section}','${focus||""}')">${label}</button>`).join("");const extra=kind==="info"?`<a href="/#/admin/asortyment/rabaty" target="_blank" rel="noopener">🎁 Kody rabatowe</a>`:"";
  return buttons||extra?`<nav class="site-release-editor-context-links"><b>Powiązane ustawienia</b>${buttons}${extra}</nav>`:"";
}
function siteReleaseEditorInfoContent(){
  const config={deliveryEnabled:true,shippingEnabled:true,returnsEnabled:true,promotionEnabled:true,returnDays:14,...(ustawienia.pasekInfoKonfiguracja||{})},layout=ustawienia.uklad||{},promotion=typeof glownaPromocja==="function"?glownaPromocja():null;
  return `<form data-site-release-quick-form="info" onsubmit="siteReleaseEditorSave(event)">${siteReleaseEditorContextLinks("info")}<section class="site-release-info-master"><label class="check"><input type="checkbox" name="visible" ${layout.pasekInfoWidoczny===false?"":"checked"}><span>Pokaż panel informacyjny klientom</span></label><small>Każdy komunikat ma osobną funkcję i korzysta ze wspólnych ustawień sklepu.</small></section><fieldset class="site-release-info-function"><legend>🚚 Darmowa dostawa</legend><label class="check"><input type="checkbox" name="deliveryEnabled" ${config.deliveryEnabled===false?"":"checked"}><span>Pokazuj próg darmowej dostawy</span></label>${siteReleaseEditorField("Etykieta","deliveryLabel",config.deliveryLabel||"Darmowa dostawa od")}${siteReleaseEditorField("Próg — wspólny dla koszyka i dostawy (zł)","darmowaDostawaOd",KONFIG.darmowaDostawaOd,{type:"number",step:"0.01"})}</fieldset><fieldset class="site-release-info-function"><legend>📦 Czas wysyłki</legend><label class="check"><input type="checkbox" name="shippingEnabled" ${config.shippingEnabled===false?"":"checked"}><span>Pokazuj deklarowany czas wysyłki</span></label>${siteReleaseEditorField("Etykieta","shippingLabel",config.shippingLabel||"Wysyłka w")}${siteReleaseEditorField("Czas — wspólny dla zamówień i regulaminu","czasWysylki",czasWysylki(),{hint:"Np. 48 h albo 2 dni robocze"})}</fieldset><fieldset class="site-release-info-function"><legend>↩️ Zwroty</legend><label class="check"><input type="checkbox" name="returnsEnabled" ${config.returnsEnabled===false?"":"checked"}><span>Pokazuj informację o zwrotach</span></label>${siteReleaseEditorField("Liczba dni","returnDays",config.returnDays||14,{type:"number",step:"1"})}</fieldset><fieldset class="site-release-info-function"><legend>🎁 Aktywna promocja</legend><label class="check"><input type="checkbox" name="promotionEnabled" ${config.promotionEnabled===false?"":"checked"}><span>Pokazuj aktywny kod promocyjny</span></label><div class="site-release-info-linked-value"><small>Źródło: Centrum kodów rabatowych</small><b>${promotion?`${esc(promotion.kod)} • −${Number(promotion.procent)||0}%`:"Brak aktywnego kodu"}</b></div></fieldset><fieldset class="site-release-info-function"><legend>✦ Dodatkowy komunikat</legend><label class="check"><input type="checkbox" name="customEnabled" ${config.customEnabled?"checked":""}><span>Dodaj własny komunikat</span></label>${siteReleaseEditorField("Treść","customText",config.customText||"",{hint:"Bez kodu HTML; komunikat zostanie bezpiecznie wyświetlony."})}</fieldset><button type="submit">Zapisz funkcje panelu w szkicu</button></form>`;
}
function siteReleaseEditorDrawerContent(kind,id=""){
  const h={...(ustawienia.hero||{})},offer={...(ustawienia.ofertaGlowna||{})};
  if(kind==="navigator")return `<div class="site-release-editor-navigator"><button onclick="siteReleaseEditorOpenDrawer('header')"><span>🏪</span><b>Nagłówek i logo</b><small>Nazwa, wyszukiwarka i pasek</small></button><button onclick="siteReleaseEditorOpenDrawer('hero')"><span>🖼️</span><b>Hero strony</b><small>Tytuł, opis i przyciski</small></button><button onclick="siteReleaseEditorOpenDrawer('offer')"><span>🏷️</span><b>Oferta produktów</b><small>Nagłówek, filtry i liczniki</small></button><button onclick="siteReleaseEditorOpenWorkspace('bannery')"><span>✨</span><b>Bannery i grafiki</b><small>Każdy banner, obraz, telefon i harmonogram</small></button><button onclick="siteReleaseEditorOpenWorkspace('home')"><span>🏠</span><b>Strona główna</b><small>Sekcje, katalogi i oferta</small></button><button onclick="siteReleaseEditorOpenWorkspace('rozmieszczenie')"><span>↕</span><b>Kolejność sekcji</b><small>Widoczność i położenie elementów</small></button><button onclick="siteReleaseEditorOpenWorkspace('wyglad')"><span>🎨</span><b>Wygląd globalny</b><small>Kolory, logo, teksty i stopka</small></button><button onclick="siteReleaseEditorOpenWorkspace('ikony')"><span>🧩</span><b>Ikony</b><small>Katalogi, menu i podstrony</small></button><button onclick="siteReleaseEditorOpenWorkspace('podstrony')"><span>🧱</span><b>Układ podstron</b><small>Nagłówki i widoczność</small></button><button onclick="siteReleaseEditorOpenWorkspace('strony')"><span>📄</span><b>Treści podstron</b><small>Kontakt, regulaminy i informacje</small></button><button onclick="siteReleaseEditorOpenWorkspace('dostawy')"><span>🚚</span><b>Dostawa i płatności</b><small>Progi, ceny i metody</small></button><button onclick="siteReleaseEditorOpenWorkspace('publikacje')"><span>🔗</span><b>Powitania i linki</b><small>Komunikaty wersji publicznej</small></button></div>`;
  if(["wyglad","rozmieszczenie","ikony","podstrony","strony","dostawy","publikacje","wersje"].includes(kind))return siteReleaseEditorWorkspaceHTML(kind,id);
  if(kind==="header")return `<form data-site-release-quick-form="header" onsubmit="siteReleaseEditorSave(event)">${siteReleaseEditorContextLinks("header")}${siteReleaseEditorField("Nazwa sklepu / logo","nazwaSklepu",KONFIG.nazwaSklepu)}${siteReleaseEditorField("Tekst wyszukiwarki","tekstSzukaj",ustawienia.tekstSzukaj||"Szukaj produktu…")}<button type="submit">Zapisz w wersji roboczej</button></form>`;
  if(kind==="info")return siteReleaseEditorInfoContent();
  if(kind==="hero")return `<form data-site-release-quick-form="hero" onsubmit="siteReleaseEditorSave(event)">${siteReleaseEditorContextLinks("hero")}${siteReleaseEditorField("Tytuł główny","heroTytul",KONFIG.heroTytul,{rows:2})}${siteReleaseEditorField("Opis","heroOpis",KONFIG.heroOpis,{rows:4})}${siteReleaseEditorField("Etykieta nad tytułem","etykieta",h.etykieta||"")}${siteReleaseEditorField("Pierwszy przycisk","przycisk1",h.przycisk1||"Zobacz ofertę")}${siteReleaseEditorField("Drugi przycisk","przycisk2",h.przycisk2||"Sprawdź promocje")}<button type="submit">Zapisz hero w szkicu</button></form>`;
  if(kind==="offer")return `<form data-site-release-quick-form="offer" onsubmit="siteReleaseEditorSave(event)">${siteReleaseEditorContextLinks("offer")}${siteReleaseEditorField("Tytuł oferty","tytul",offer.tytul||"Cała oferta")}${siteReleaseEditorField("Opis oferty","opis",offer.opis||"",{rows:3})}<label class="check"><input type="checkbox" name="filtryZaawansowane" ${offer.filtryZaawansowane===false?"":"checked"}><span>Pokaż zaawansowane filtry</span></label><label class="check"><input type="checkbox" name="liczniki" ${offer.liczniki===false?"":"checked"}><span>Pokaż liczniki promocji i nowości</span></label><button type="submit">Zapisz ofertę w szkicu</button></form>`;
  if(kind==="delivery")return `<form data-site-release-quick-form="delivery" onsubmit="siteReleaseEditorSave(event)">${siteReleaseEditorField("Darmowa dostawa od (zł)","darmowaDostawaOd",KONFIG.darmowaDostawaOd,{type:"number",step:"0.01"})}${siteReleaseEditorField("Paczkomat (zł)","kosztPaczkomat",KONFIG.kosztPaczkomat,{type:"number",step:"0.01"})}${siteReleaseEditorField("Kurier InPost (zł)","kosztKurierInpost",KONFIG.kosztKurierInpost,{type:"number",step:"0.01"})}<button type="submit">Zapisz ceny dostawy</button><button type="button" class="site-release-editor-secondary" onclick="siteReleaseEditorOpenWorkspace('dostawy')">Wszystkie ustawienia dostawy →</button></form>`;
  if(kind==="footer")return `<form data-site-release-quick-form="footer" onsubmit="siteReleaseEditorSave(event)">${siteReleaseEditorContextLinks("footer")}${siteReleaseEditorField("Opis sklepu","opisSklepu",KONFIG.opisSklepu,{rows:3})}${siteReleaseEditorField("E-mail","emailSklepu",KONFIG.emailSklepu,{type:"email"})}${siteReleaseEditorField("Telefon","telefon",KONFIG.telefon)}${siteReleaseEditorField("Dolny podpis","stopkaCopy",ustawienia.stopkaCopy||"")}<button type="submit">Zapisz stopkę w szkicu</button></form>`;
  if(kind==="banners")return siteReleaseEditorWorkspaceHTML("bannery",id);
  if(kind==="home")return siteReleaseEditorWorkspaceHTML("home",id);
  if(kind==="layout")return siteReleaseEditorWorkspaceHTML("rozmieszczenie",id);
  if(kind==="pages")return siteReleaseEditorWorkspaceHTML("podstrony",id);
  if(kind==="product"){
    const base=(typeof produkty!=="undefined"?produkty:[]).find(item=>String(item.id)===String(id))||{},product=siteReleasePreviewProduct(base)||base;
    return `<form data-site-release-quick-form="product" data-product-id="${esc(id)}" onsubmit="siteReleaseEditorSave(event)"><div class="site-release-editor-product-head">${product.zdjecie?`<img src="${esc(product.zdjecie)}" alt="">`:`<span>${esc(product.ikona||"📦")}</span>`}<div><b>${esc(product.nazwa||`Produkt ${id}`)}</b><small>ID ${esc(id)}</small></div></div>${siteReleaseEditorField("Nazwa produktu","nazwa",product.nazwa||"")}${siteReleaseEditorField("Cena (zł)","cena",product.cena??"",{type:"number",step:"0.01"})}${siteReleaseEditorField("Stara cena (zł)","staraCena",product.staraCena??"",{type:"number",step:"0.01",hint:"Pozostaw puste, aby usunąć przekreśloną cenę."})}${siteReleaseEditorField("Oznaczenie","badge",product.badge||"")}<button type="submit">Zapisz produkt w szkicu</button><a href="/#/admin/produkty/edytuj/${encodeURIComponent(id)}">Pełna kartoteka produktu →</a></form>`;
  }
  return `<p>Wybierz element strony do edycji.</p>`;
}
function siteReleaseEditorWorkspacePath(section="wyglad",focus=""){
  const url=new URL("/",location.origin);url.searchParams.set("site_editor_settings","1");if(focus)url.searchParams.set("site_editor_focus",focus);const route=section==="wersje"&&focus?`${section}?sekcja=${encodeURIComponent(focus)}`:section;url.hash=`#/admin/personalizacja/${route}`;return `${url.pathname}${url.search}${url.hash}`;
}
function siteReleaseEditorWorkspaceHTML(section="wyglad",focus=""){
  return `<div class="site-release-editor-workspace"><div class="site-release-editor-workspace-loading"><b>Ładuję narzędzia personalizacji…</b><small>Tylko administrator może otworzyć ten panel.</small></div><iframe title="Ustawienia elementu strony" src="${esc(siteReleaseEditorWorkspacePath(section,focus))}" loading="eager"></iframe></div>`;
}
function siteReleaseEditorOpenWorkspace(section="wyglad",focus=""){
  siteReleaseEditorOpenDrawer(section==="bannery"?"banners":section,focus);const drawer=document.getElementById("siteReleaseEditorDrawer");if(drawer){drawer.classList.add("is-workspace");drawer.dataset.editorSection=section;drawer.dataset.editorFocus=focus||"";}
}
function siteReleaseEditorAgentPanelHTML(){
  return `<section id="siteReleaseEditorAgent" class="site-release-editor-agent" hidden><header><div><small>AGENT AI • POMOC W KAŻDYM ELEMENCIE</small><b>Przygotuj bezpieczny szkic</b></div><button type="button" onclick="siteReleaseEditorToggleAgent(false)" aria-label="Zamknij pomoc">×</button></header><form onsubmit="siteReleaseEditorAgentRun(event)"><label><span>Co Agent ma przygotować lub poprawić?</span><textarea name="instruction" rows="3" required minlength="4" maxlength="800" placeholder="Np. zaproponuj czytelniejszy tytuł, opis i przycisk bez wymyślania rabatu"></textarea></label><button type="submit">✨ Przygotuj propozycję</button></form><div data-site-release-agent-result><p>Agent odczyta tylko pola aktualnie edytowanego elementu. Niczego sam nie zapisze ani nie opublikuje.</p></div></section>`;
}
function siteReleaseEditorToggleAgent(force){
  let drawer=document.getElementById("siteReleaseEditorDrawer");if(!drawer?.classList.contains("open")){siteReleaseEditorOpenDrawer("navigator");drawer=document.getElementById("siteReleaseEditorDrawer");}
  const panel=drawer?.querySelector("#siteReleaseEditorAgent");if(!panel)return;panel.hidden=force===undefined?!panel.hidden:force===false;drawer.classList.toggle("agent-open",!panel.hidden);if(!panel.hidden)setTimeout(()=>panel.querySelector("textarea")?.focus({preventScroll:true}),0);
}
function siteReleaseEditorAgentTarget(){
  const drawer=document.getElementById("siteReleaseEditorDrawer"),iframe=drawer?.querySelector("iframe"),doc=iframe?.contentDocument||document,focus=drawer?.dataset.editorFocus||drawer?.dataset.editorItemId||"";let scope=null;
  if(focus)scope=[...doc.querySelectorAll("[data-banner-editor-id]")].find(element=>element.dataset.bannerEditorId===focus)||null;
  const form=scope?.querySelector("form")||(!iframe?drawer?.querySelector("[data-site-release-quick-form]"):doc.querySelector("form"));return {drawer,doc,scope,form,focus};
}
function siteReleaseEditorAgentContext(){
  const target=siteReleaseEditorAgentTarget(),values={};if(target.form){let count=0;for(const [key,value] of new FormData(target.form)){if(count++>=32)break;const text=String(value||"").trim();if(text)values[String(key).slice(0,80)]=text.slice(0,500);}}
  return {page:"visual-site-editor",section:target.drawer?.dataset.editorSection||target.drawer?.dataset.editorKind||"strona",elementId:target.focus||"",currentFields:values,storeName:String(KONFIG.nazwaSklepu||"Artway-TM")};
}
function siteReleaseEditorAgentResultHTML(run={}){
  const result=run.result||{},fields=Array.isArray(result.fields)?result.fields:[],warnings=[...(result.warnings||[]),...(result.missingFacts||[])];return `<article><header><div><small>${esc(run.specialistLabel||run.specialist||"Agent AI")}</small><b>${esc(result.title||"Propozycja gotowa do sprawdzenia")}</b></div><span>${Math.round(Number(result.confidence||0)*100)||0}%</span></header>${result.summary?`<p>${esc(result.summary)}</p>`:""}${fields.length?`<div class="site-release-editor-agent-fields">${fields.map(field=>`<section><small>${esc(field.label||field.key||"Pole")}</small><b>${esc(field.value||"")}</b>${field.reason?`<p>${esc(field.reason)}</p>`:""}</section>`).join("")}</div>`:""}${warnings.length?`<div class="site-release-editor-agent-warnings">${warnings.map(item=>`<span>⚠️ ${esc(item)}</span>`).join("")}</div>`:""}<button type="button" onclick="siteReleaseEditorAgentApply()">Wstaw pasujące pola do formularza</button><small>Po wstawieniu nadal musisz sprawdzić formularz i osobno go zapisać.</small></article>`;
}
async function siteReleaseEditorAgentRun(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),instruction=String(new FormData(form).get("instruction")||"").trim(),drawer=document.getElementById("siteReleaseEditorDrawer"),kind=drawer?.dataset.editorKind||drawer?.dataset.editorSection||"",specialist=/banner|hero|banners/.test(kind)?"banner_copy":"campaign_copy",output=drawer?.querySelector("[data-site-release-agent-result]");button.disabled=true;button.textContent="Agent przygotowuje…";if(output)output.innerHTML="<p>Analizuję aktualny element i powiązane pola…</p>";
  try{const response=await chmura("agent-specialist-run",{method:"POST",body:{specialist,context:siteReleaseEditorAgentContext(),instruction:`${instruction}. Przygotuj wyłącznie szkic do sprawdzenia. Nie publikuj, nie zapisuj i nie wymyślaj rabatu, ceny, terminu ani cechy bez potwierdzonych danych.`,target:{type:"site-editor",section:kind,elementId:drawer?.dataset.editorFocus||drawer?.dataset.editorItemId||""},source:"manual"},timeout:120000}),run=response.run;if(!run)throw new Error("Agent nie zwrócił propozycji.");window.__siteReleaseEditorAgentResult=run;if(output)output.innerHTML=siteReleaseEditorAgentResultHTML(run);
  }catch(error){if(output)output.innerHTML=`<div class="site-release-editor-agent-error"><b>Nie przygotowano szkicu</b><p>${esc(error.message||error)}</p></div>`;}finally{button.disabled=false;button.textContent="✨ Przygotuj propozycję";}
}
function siteReleaseEditorAgentApply(){
  const run=window.__siteReleaseEditorAgentResult,target=siteReleaseEditorAgentTarget(),fields=Array.isArray(run?.result?.fields)?run.result.fields:[],map={headline:["tytul","heroTytul","nazwa"],subheadline:["opis","heroOpis","opisSklepu"],cta:["przycisk","przycisk1","tekstLinku","badge"],alt_text:["obrazAlt"],campaign_name:["etykieta"],store_announcement:["customText","stopkaCopy"],social_post:["opis"]};let changed=0;
  for(const field of fields){const candidates=map[String(field.key||"")]||[String(field.key||"")];const input=candidates.map(name=>target.form?.elements?.[name]).find(Boolean);if(!input||["checkbox","radio","file"].includes(input.type)||!String(field.value||"").trim())continue;input.value=String(field.value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));changed++;}
  if(changed){target.form?.scrollIntoView({behavior:"smooth",block:"start"});toast(`Agent wstawił ${changed} ${changed===1?"pole":"pola"} — sprawdź i zapisz formularz`);}else toast("Ta propozycja nie ma pól pasujących do otwartego formularza — skopiuj treść ręcznie.");
}
function siteReleaseEditorOpenDrawer(kind="navigator",id=""){
  let drawer=document.getElementById("siteReleaseEditorDrawer");if(!drawer){drawer=document.createElement("aside");drawer.id="siteReleaseEditorDrawer";drawer.className="site-release-editor-drawer";document.body.append(drawer);}
  drawer.classList.remove("is-workspace","agent-open");delete drawer.dataset.editorSection;delete drawer.dataset.editorFocus;drawer.dataset.editorKind=kind;drawer.dataset.editorItemId=id||"";const titles={navigator:"Elementy całej strony",header:"Nagłówek i logo",info:"Pasek informacyjny",hero:"Hero strony głównej",offer:"Oferta produktów",home:"Strona główna",layout:"Kolejność i widoczność",pages:"Podstrony",delivery:"Dostawa i ceny",footer:"Stopka i kontakt",banners:"Bannery i grafiki",wyglad:"Wygląd globalny",rozmieszczenie:"Rozmieszczenie",ikony:"Ikony",podstrony:"Układ podstron",strony:"Treści podstron",dostawy:"Dostawa i płatności",publikacje:"Powitania i linki",wersje:"Sprawdzenie i publikacja",product:"Szybka edycja produktu"};drawer.innerHTML=`<header><div><small>EDYTOR NA ŻYWO • TYLKO ADMINISTRATOR</small><h2>${esc(titles[kind]||"Element strony")}</h2></div><div class="site-release-editor-header-actions"><button type="button" onclick="siteReleaseEditorToggleAgent(true)">🤖 Agent AI</button><button type="button" onclick="siteReleaseEditorCloseDrawer()" aria-label="Zamknij">×</button></div></header>${siteReleaseEditorAgentPanelHTML()}<div>${siteReleaseEditorDrawerContent(kind,id)}</div><footer><span>🔒 Zapis trafia tylko do wersji roboczej</span><span>🤖 Agent tworzy szkic — nigdy nie publikuje sam</span></footer>`;drawer.classList.add("open");document.body.classList.add("site-release-editor-drawer-open");
}
function siteReleaseEditorCloseDrawer(){document.getElementById("siteReleaseEditorDrawer")?.classList.remove("open");document.body.classList.remove("site-release-editor-drawer-open");}
function siteReleaseEditorNumber(value,name){const parsed=Number(String(value||"").replace(",","."));if(!Number.isFinite(parsed)||parsed<0)throw new Error(`Pole „${name}” musi zawierać prawidłową kwotę.`);return Math.round(parsed*100)/100;}
async function siteReleaseEditorSave(event){
  event.preventDefault();const form=event.currentTarget,kind=form.dataset.siteReleaseQuickForm,data=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Zapisuję…";
  try{
    if(kind==="product"){
      const fields={nazwa:String(data.get("nazwa")||"").trim(),cena:siteReleaseEditorNumber(data.get("cena"),"Cena"),badge:String(data.get("badge")||"").trim()},remove=[];const old=String(data.get("staraCena")||"").trim();if(old)fields.staraCena=siteReleaseEditorNumber(old,"Stara cena");else remove.push("staraCena");
      await chmura("site-release-draft-products",{method:"POST",body:{operations:[{productId:form.dataset.productId,fields,remove}]},timeout:30000});
    }else{
      let changes={};if(kind==="header")changes={nazwaSklepu:String(data.get("nazwaSklepu")||KONFIG.nazwaSklepu).trim(),tekstSzukaj:String(data.get("tekstSzukaj")||ustawienia.tekstSzukaj||"").trim()};
      else if(kind==="info")changes={darmowaDostawaOd:siteReleaseEditorNumber(data.get("darmowaDostawaOd"),"Próg darmowej dostawy"),czasWysylki:String(data.get("czasWysylki")||"").trim()||"48 h",uklad:{...(ustawienia.uklad||{}),pasekInfoWidoczny:!!data.get("visible")},pasekInfoKonfiguracja:{deliveryEnabled:!!data.get("deliveryEnabled"),deliveryLabel:String(data.get("deliveryLabel")||"Darmowa dostawa od").trim().slice(0,60),shippingEnabled:!!data.get("shippingEnabled"),shippingLabel:String(data.get("shippingLabel")||"Wysyłka w").trim().slice(0,60),returnsEnabled:!!data.get("returnsEnabled"),returnDays:Math.max(1,Math.min(90,Math.round(siteReleaseEditorNumber(data.get("returnDays"),"Liczba dni na zwrot")))),promotionEnabled:!!data.get("promotionEnabled"),customEnabled:!!data.get("customEnabled"),customText:String(data.get("customText")||"").trim().slice(0,160)}};
      else if(kind==="hero")changes={heroTytul:String(data.get("heroTytul")||"").trim(),heroOpis:String(data.get("heroOpis")||"").trim(),hero:{...(ustawienia.hero||{}),etykieta:String(data.get("etykieta")||"").trim(),przycisk1:String(data.get("przycisk1")||"").trim(),przycisk2:String(data.get("przycisk2")||"").trim()}};
      else if(kind==="offer")changes={ofertaGlowna:{...(ustawienia.ofertaGlowna||{}),tytul:String(data.get("tytul")||"").trim(),opis:String(data.get("opis")||"").trim(),filtryZaawansowane:!!data.get("filtryZaawansowane"),liczniki:!!data.get("liczniki")}};
      else if(kind==="delivery")changes={darmowaDostawaOd:siteReleaseEditorNumber(data.get("darmowaDostawaOd"),"Darmowa dostawa"),kosztPaczkomat:siteReleaseEditorNumber(data.get("kosztPaczkomat"),"Paczkomat"),kosztKurierInpost:siteReleaseEditorNumber(data.get("kosztKurierInpost"),"Kurier InPost")};
      else if(kind==="footer")changes={opisSklepu:String(data.get("opisSklepu")||"").trim(),emailSklepu:String(data.get("emailSklepu")||"").trim(),telefon:String(data.get("telefon")||"").trim(),stopkaCopy:String(data.get("stopkaCopy")||"").trim()};
      if(!Object.keys(changes).length)throw new Error("Nie znaleziono zmian do zapisania.");await chmura("site-release-draft-settings",{method:"POST",body:{changes,remove:[]},timeout:30000});
    }
    toast("Zapisano w wersji roboczej — odnawiam podgląd ✅");const token=await chmura("site-release-preview-token",{method:"POST",body:{},timeout:20000}),url=new URL(location.href);url.searchParams.set("site_preview",token.token);url.searchParams.set("site_editor","1");url.searchParams.delete("site_embed");location.replace(`${url.pathname}${url.search}${url.hash||"#/"}`);
  }catch(error){toast("Nie zapisano zmiany: "+(error.message||error));button.disabled=false;button.textContent="Spróbuj ponownie";}
}
window.addEventListener("message",event=>{
  if(event.origin!==location.origin||!siteReleaseVisualEditorActive())return;
  if(event.data?.type==="artway-site-editor-close-settings"){siteReleaseEditorCloseDrawer();return;}
  if(event.data?.type!=="artway-site-editor-settings-saved")return;
  const drawer=document.getElementById("siteReleaseEditorDrawer"),section=drawer?.dataset.editorSection||event.data.section||"wyglad",focus=drawer?.dataset.editorFocus||"";
  clearTimeout(siteReleaseEditorRefreshTimer);siteReleaseEditorRefreshTimer=setTimeout(async()=>{try{const path=await chmura("site-release-preview-token",{method:"POST",body:{},timeout:20000}),url=new URL(siteReleasePreviewPath(path.path||`/?site_preview=${encodeURIComponent(path.token)}#/`,{editor:true}),location.origin);url.searchParams.set("site_editor_panel",section);if(focus)url.searchParams.set("site_editor_focus",focus);location.replace(`${url.pathname}${url.search}${url.hash||"#/"}`);}catch(error){toast("Zmiana została zapisana. Odśwież podgląd ręcznie.");}},500);
});
let siteReleaseEditorRefreshTimer=null;
