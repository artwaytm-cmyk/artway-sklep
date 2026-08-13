const inpostWycenyZamowienCache=new Map();
function inpostWycenaZamowieniaKlucz(z={}){
  const w=z.wysylka||{};
  return [z.nr,z.dostawaId,w.gabaryt,w.waga,w.dlugosc,w.szerokosc,w.wysokosc,w.paczkaWeekend,w.pobranieAktywne,w.ochrona,w.sposobNadania].map(v=>String(v??"")).join("|");
}
function inpostWycenaZamowieniaWartosc(z={}){
  return inpostWycenyZamowienCache.get(inpostWycenaZamowieniaKlucz(z))||z?.wysylka?.kosztUmowny||null;
}
function inpostWycenaZamowieniaHTML(z={}){
  const p=inpostWycenaZamowieniaWartosc(z),amount=Number(p?.totalGross);
  if(!p)return '<span class="inpost-order-quote-loading"><span class="inpost-live-dot"></span> Sprawdzam bezpieczną wycenę InPost…</span>';
  if(!Number.isFinite(amount))return `<span class="lvl lvl-ostrzezenie">${esc(p.apiWarning||p.message||"Brak pełnej, bezpiecznej wyceny InPost")}</span>`;
  const api=Number(p.apiComparison?.totalGross),source=p.source==="manual"?"ręcznie — awaryjnie":p.source==="contract_postpaid"?"cennik umowny • postpaid":"InPost / ShipX • prepaid";
  return `<span><small>Koszt InPost brutto</small><b>${zl(amount)}</b></span><span><small>Źródło</small><b>${source}</b></span>${p.apiComparison?.trusted===false&&Number.isFinite(api)?`<span><small>Wynik techniczny ShipX</small><b>${zl(api)} — pominięty</b></span>`:""}<span class="lvl ${p.source==="manual"?"lvl-ostrzezenie":"lvl-ok"}">${p.source==="manual"?"tryb awaryjny":p.source==="contract_postpaid"?"stawka umowna":"cena prepaid"}</span>`;
}
async function inpostWycenaZamowieniaLaduj(nr){
  const z=pobierzZamowienia().find(item=>String(item.nr)===String(nr)),box=document.querySelector(`[data-inpost-order-quote="${CSS.escape(String(nr))}"]`);
  if(!z||!box)return;
  const key=inpostWycenaZamowieniaKlucz(z);
  if(inpostWycenyZamowienCache.has(key)){box.innerHTML=inpostWycenaZamowieniaHTML(z);return;}
  try{
    const d=await chmura("inpost-order-quote",{params:{nr},timeout:15000});
    inpostWycenyZamowienCache.set(key,d.pricing||{});
    if(document.contains(box))box.innerHTML=inpostWycenaZamowieniaHTML(z);
  }catch(e){
    if(document.contains(box))box.innerHTML=`<span class="lvl lvl-ostrzezenie">${esc(e.message||"Nie pobrano stawki InPost")}</span>`;
  }
}
