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
function adminWyszukiwaniePanelHTML({id="filtry",title="Wyszukiwanie zaawansowane",description="Wyszukuj i zawężaj wyniki bez opuszczania podstrony.",fields="",results="",active=false,open=true}={}){
  return `<details class="admin-search-standard" data-admin-search-panel="${esc(id)}" ${(open||active)?"open":""}><summary><span><b>🔎 ${esc(title)}</b><small>${esc(description)}</small></span><span class="admin-search-summary-meta">${active?`<em>Aktywne filtry</em>`:""}${results!==""?`<strong>${esc(results)} wyników</strong>`:""}<i aria-hidden="true"></i></span></summary><div class="admin-search-standard-body">${fields}</div></details>`;
}
