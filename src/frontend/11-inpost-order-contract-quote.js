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
  if(!p)return '<span class="inpost-order-quote-loading">Sprawdzam stawkę InPost…</span>';
  if(!Number.isFinite(amount))return '<span class="lvl lvl-ostrzezenie">Brak stawki dla wybranej paczki</span>';
  return `<span><small>Koszt InPost brutto</small><b>${zl(amount)}</b></span><span><small>Stawka</small><b>${esc(p.rateLabel||"indywidualna")}</b></span>${p.complete===false?`<span class="lvl lvl-ostrzezenie">${esc((p.unpricedOptions||[]).join(", ")||"uzupełnij dopłaty")}</span>`:'<span class="lvl lvl-ok">wycena kompletna</span>'}`;
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
