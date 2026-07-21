/* ═══════════ UI ═══════════ */
let dialogPoprzedniFocus=null;
function elementyFokusu(root){return [...(root?.querySelectorAll?.('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')||[])].filter(el=>!el.hidden&&el.getAttribute("aria-hidden")!=="true"&&el.offsetParent!==null);}
function ustawBlokadeDialogu(){document.body.classList.toggle("has-dialog",$("drawer")?.classList.contains("open")||$("modal")?.classList.contains("open"));}
function otworzKoszyk(){dialogPoprzedniFocus=document.activeElement;const drawer=$("drawer"),overlay=$("overlay");drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");overlay.classList.add("open");overlay.setAttribute("aria-hidden","false");ustawBlokadeDialogu();requestAnimationFrame(()=>$("closeCart")?.focus());}
function zamknijKoszyk({restoreFocus=true}={}){const drawer=$("drawer"),overlay=$("overlay");drawer.classList.remove("open");overlay.classList.remove("open");const target=restoreFocus&&dialogPoprzedniFocus?.isConnected?dialogPoprzedniFocus:$("widok");target?.focus?.({preventScroll:true});drawer.setAttribute("aria-hidden","true");overlay.setAttribute("aria-hidden","true");ustawBlokadeDialogu();}
function aktywujModalCheckout(){dialogPoprzedniFocus=document.activeElement;const modal=$("modal");modal.classList.add("open");modal.setAttribute("aria-hidden","false");ustawBlokadeDialogu();requestAnimationFrame(()=>modal.querySelector("input,select,button,a[href]")?.focus()||$("modalBox")?.focus());}
function zamknijModalCheckout({restoreFocus=true}={}){const modal=$("modal");modal.classList.remove("open");const target=restoreFocus&&dialogPoprzedniFocus?.isConnected?dialogPoprzedniFocus:$("widok");target?.focus?.({preventScroll:true});modal.setAttribute("aria-hidden","true");ustawBlokadeDialogu();}
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1800); }

$("cartBtn").onclick = otworzKoszyk;
$("closeCart").onclick = zamknijKoszyk;
$("overlay").onclick = zamknijKoszyk;
$("checkoutBtn").onclick = otworzModal;
$("modal").onclick = e=>{ if(e.target.id==="modal") zamknijModalCheckout(); };
document.addEventListener("keydown",event=>{
  const modal=$("modal"),drawer=$("drawer");
  const root=modal?.classList.contains("open")?modal:drawer?.classList.contains("open")?drawer:null;
  if(!root)return;
  if(event.key==="Escape"){event.preventDefault();root===modal?zamknijModalCheckout():zamknijKoszyk();return;}
  if(event.key!=="Tab")return;
  const focusable=elementyFokusu(root);if(!focusable.length){event.preventDefault();root.focus?.();return;}
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
$("searchInput").oninput = e=>{
  fraza = e.target.value.toLowerCase();
  stronaProduktow = 1;
  if(trasa()!=="/" && trasa()!=="") location.hash="#/";
  else if(typeof sklepKatalogCentralnyZaplanuj==="function"&&chmuraKatalogCentralnyPubliczny)sklepKatalogCentralnyZaplanuj();else rysuj();
};

/* ═══════════ START ═══════════ */
(async ()=>{
  const porzadkowaniePamieci=zwolnijPamiecPodreczna();
  if(porzadkowaniePamieci.usunieto.length)loguj("info",`Odciążono pamięć podręczną: ${(porzadkowaniePamieci.przed/1024).toFixed(0)} KB → ${(porzadkowaniePamieci.po/1024).toFixed(0)} KB`);
  const ladowanieProduktow=pobierzBazoweProdukty();
  await Promise.all([chmuraWczytajStan(),ladowanieProduktow,pobierzPaynowKonfiguracjePubliczna()]); // ustawienia, katalog i bezpieczny status płatności pobieramy równolegle
  zastosujUstawienia();
  await zainicjujAdmina();
  await odtworzSesjeCentralna();
  odswiezUzytkownika();
  odswiezUlubioneLicznik();
  odswiezZnacznikDiag();
  finalizujWczytanieProduktow();
  const porzadkowanieReferencji=porzadkujBezpieczneReferencje();
  if(porzadkowanieReferencji.koszyk||porzadkowanieReferencji.mapowania){odswiezKoszyk();zbudujProdukty();}
  uruchomAutoSynchronizacjeChmury();
})();
