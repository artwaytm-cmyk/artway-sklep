/* ═══════════ UI ═══════════ */
function otworzKoszyk(){ $("drawer").classList.add("open"); $("overlay").classList.add("open"); }
function zamknijKoszyk(){ $("drawer").classList.remove("open"); $("overlay").classList.remove("open"); }
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1800); }

$("cartBtn").onclick = otworzKoszyk;
$("closeCart").onclick = zamknijKoszyk;
$("overlay").onclick = zamknijKoszyk;
$("checkoutBtn").onclick = otworzModal;
$("modal").onclick = e=>{ if(e.target.id==="modal") $("modal").classList.remove("open"); };
$("searchInput").oninput = e=>{
  fraza = e.target.value.toLowerCase();
  stronaProduktow = 1;
  if(trasa()!=="/" && trasa()!=="") location.hash="#/";
  else rysuj();
};

/* ═══════════ START ═══════════ */
(async ()=>{
  const ladowanieProduktow=pobierzBazoweProdukty();
  await Promise.all([chmuraWczytajStan(),ladowanieProduktow]); // ustawienia i katalog pobieramy równolegle
  zastosujUstawienia();
  await zainicjujAdmina();
  await odtworzSesjeCentralna();
  odswiezUzytkownika();
  odswiezUlubioneLicznik();
  odswiezZnacznikDiag();
  finalizujWczytanieProduktow();
  uruchomAutoSynchronizacjeChmury();
})();
