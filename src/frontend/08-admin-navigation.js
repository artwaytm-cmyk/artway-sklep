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
