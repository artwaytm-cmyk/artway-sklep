// Czytelny, lokalny przebieg zakupu dla zamówienia Allegro.
// Nie wykonuje żadnej operacji w API Allegro i wyłącznie prezentuje stan sklepu.
function allegroPrzeplywZakupowyHTML(z={}){
  const procurement=z.supplierProcurement||{},stage=allegroEtapMagazynu(z),ordered=Math.max(0,Number(procurement.orderedQuantity)||0),received=Math.max(0,Number(procurement.receivedQuantity)||0),sent=["oczekuje_na_dostawe","kompletacja","spakowane","zrealizowane"].includes(stage)||["oczekuje_na_dostawe","czesciowo_przyjete","dostawa_przyjeta"].includes(procurement.status),delivered=procurement.status==="dostawa_przyjeta"||stage==="kompletacja"||stage==="spakowane",shipping=["kompletacja","spakowane","zrealizowane"].includes(stage);
  const steps=[
    {label:"Zlecenie Allegro",opis:allegroStatusKolejkiMeta(z).label,done:true,current:false},
    {label:"Zakup u producenta",opis:sent?`${ordered} szt. zamówiono`:"kontrola braków",done:sent,current:!sent},
    {label:"Przyjęcie dokumentu",opis:ordered?`${received}/${ordered} szt.`:"nie wymaga zakupu",done:delivered,current:sent&&!delivered},
    {label:"Oczekuje na wysyłkę",opis:shipping?"towar przydzielony":"po pełnej dostawie",done:shipping,current:delivered}
  ];
  return `<div class="allegro-procurement-flow">${steps.map((step,index)=>`<span class="${step.done?"done":step.current?"current":"waiting"}"><em>${step.done?"✓":index+1}</em><b>${esc(step.label)}</b><small>${esc(step.opis)}</small></span>`).join("")}</div>`;
}
