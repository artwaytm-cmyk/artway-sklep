/* Personalizacja = wszystkie ustawienia wyglądu i sklepu w JEDNYM miejscu,
   podzielone na zakładki. Stare adresy (#/admin/wyglad itd.) dalej działają
   i otwierają właściwą zakładkę.                                          */
const TABY_PERSONALIZACJI = [
  ["wyglad","🎨 Układ globalny"], ["rozmieszczenie","🧭 Rozmieszczenie"], ["bannery","🖼️ Banery"],
  ["podstrony","🧱 Układ podstron"], ["strony","📄 Treści prawne"], ["dostawy","🚚 Dostawa i płatności"]
];
function personalizacjaSzkielet(tab, tresc){
  return adminSzkielet("/admin/personalizacja", `
    ${adminSubnavHTML(TABY_PERSONALIZACJI.map(([id,label])=>({id,href:`#/admin/personalizacja/${id}`,label})),tab)}
    ${tresc}`);
}
/* Asortyment = produkty, katalogi, mapowanie i rabaty w JEDNYM dziale z zakładkami */
const TABY_ASORTYMENTU = [
  ["produkty","🏷️ Produkty"], ["jakosc","🧪 Jakość katalogu"], ["kategorie","🗂️ Katalogi"], ["mapowanie","🧩 Mapowanie"], ["rabaty","🎁 Kody rabatowe"], ["opinie","⭐ Opinie"]
];
function asortymentSzkielet(tab, tresc){
  return adminSzkielet("/admin/asortyment", `
    <div class="module-page-stack assortment-module-page">
      ${adminSubnavHTML(TABY_ASORTYMENTU.map(([id,label])=>({id,href:`#/admin/asortyment/${id}`,label})),tab)}
      ${tresc}
    </div>`);
}

/* Jeden standard wyszukiwania w całym panelu: zwijany nagłówek, opis,
   licznik wyników i responsywna siatka. Poszczególne domeny przekazują tylko pola. */
function adminWyszukiwaniePanelHTML({id="filtry",title="Wyszukiwanie zaawansowane",description="Wyszukuj i zawężaj wyniki bez opuszczania podstrony.",fields="",actions="",results="",active=false,open=true}={}){
  return `<details class="admin-search-standard" data-admin-search-panel="${esc(id)}" ${(open||active)?"open":""}><summary><span><b>🔎 ${esc(title)}</b><small>${esc(description)}</small></span><span class="admin-search-summary-meta">${active?`<em>Aktywne filtry</em>`:""}${results!==""?`<strong>${esc(results)} wyników</strong>`:""}<i aria-hidden="true"></i></span></summary><div class="admin-search-standard-body">${fields}${actions?`<div class="admin-search-standard-actions">${actions}</div>`:""}</div></details>`;
}
function adminOperacjeWynikowHTML({id="wyniki",selected=0,pageCount=0,resultCount=0,selectPage="",selectAll="",clear="",exportSelected="",exportAll="",exportLabel="CSV",extra=""}={}){
  const n=Math.max(0,Number(selected)||0),page=Math.max(0,Number(pageCount)||0),results=Math.max(0,Number(resultCount)||0);
  return `<div class="admin-results-operations" data-admin-results-operations="${esc(id)}"><div class="admin-results-operations-summary"><b>Operacje na wynikach</b><small>Wybrano <strong data-admin-selected-count>${n}</strong> • ${results} wyników po filtrach</small></div><div class="admin-results-selection">${selectPage?`<button class="btn ghost" type="button" onclick="${selectPage}">☑️ Zaznacz stronę (${page})</button>`:""}${selectAll?`<button class="btn ghost" type="button" onclick="${selectAll}">☑️ Zaznacz wszystkie wyniki (${results})</button>`:""}${clear?`<button class="btn ghost" data-admin-selected-required type="button" onclick="${clear}" ${n?"":"disabled"}>☐ Odznacz (<span data-admin-selected-count>${n}</span>)</button>`:""}</div>${exportSelected||exportAll?`<details class="admin-results-export"><summary>📤 Eksportuj plik</summary><div>${exportSelected?`<button class="btn ghost" data-admin-selected-required type="button" onclick="${exportSelected}" ${n?"":"disabled"}>Zaznaczone (<span data-admin-selected-count>${n}</span>) — ${esc(exportLabel)}</button>`:""}${exportAll?`<button class="btn ghost" type="button" onclick="${exportAll}" ${results?"":"disabled"}>Wszystkie wyniki (${results}) — ${esc(exportLabel)}</button>`:""}</div></details>`:""}${extra?`<div class="admin-results-extra">${extra}</div>`:""}</div>`;
}
function adminEksportujCSV(nazwa,naglowki,wiersze){
  const quote=value=>`"${String(value??"").replace(/"/g,'""')}"`,rows=Array.isArray(wiersze)?wiersze:[];
  if(!rows.length){toast("Brak danych do eksportu");return false;}
  const csv=[(naglowki||[]).map(quote).join(";"),...rows.map(row=>(Array.isArray(row)?row:[]).map(quote).join(";"))].join("\n");
  pobierzPlik(nazwa||"wyniki.csv","\uFEFF"+csv,"text/csv");toast(`Wyeksportowano ${rows.length} pozycji ✅`);return true;
}
