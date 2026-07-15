// Zamówienia Allegro → jeden kanoniczny Plan zatowarowania producentów.
async function allegroUtworzZamowienieProducenta(orderIds){
  const ids=[...new Set((Array.isArray(orderIds)?orderIds:[orderIds]).map(String).filter(Boolean))];
  if(!ids.length){toast("Zaznacz co najmniej jedno zamówienie Allegro");return;}
  try{
    toast(`Sprawdzam stan i aktualizuję Plan producentów dla ${ids.length} zamówień…`);
    const d=await chmura("supplier-order-from-allegro",{method:"POST",body:{orderIds:ids},timeout:90000});
    if(Array.isArray(d.orders))allegroZamowienia=d.orders;
    if(Array.isArray(d.supplierOrders)){
      agentAIZlecenia=d.supplierOrders;
      const previousLoading=chmuraWczytywanie;chmuraWczytywanie=true;try{zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);}finally{chmuraWczytywanie=previousLoading;}
    }
    allegroZapiszCache();
    const documents=Array.isArray(d.relatedDrafts)?d.relatedDrafts:[];
    const message=documents.length?`✅ Plan producentów gotowy • ${documents.length} dokumentów • ${d.withShortages||0} zamówień z brakami`:(d.unresolved?`⚠️ ${d.unresolved} zamówień wymaga uzupełnienia mapowania lub stanu`:`✅ Zapas pokrywa wskazane zamówienia — nie utworzono zbędnego dokumentu`);
    toast(message);renderuj();
  }catch(e){toast("⚠️ Plan producenta: "+(e.message||e));}
}

async function allegroUstawEtapMagazynu(orderId,stage){
  try{const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderId,stage},timeout:18000});allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;allegroZapiszCache();toast("Etap magazynu zapisany — status Allegro pozostał bez zmian");renderuj();}catch(e){toast("⚠️ Etap magazynu: "+(e.message||e));}
}

async function allegroUstawEtapZaznaczonychZamowien(){
  const stage=String(document.getElementById("bulkAllegroWarehouseStage")?.value||"");
  const ids=[...zaznaczoneAllegroZamowienia];
  if(!ids.length){toast("Zaznacz co najmniej jedno zlecenie Allegro");return;}
  if(!["do_sprawdzenia","braki","oczekuje_na_dostawe","kompletacja","spakowane","zrealizowane"].includes(stage)){toast("Wybierz etap magazynowy");return;}
  try{
    toast(`Zmieniam etap ${ids.length} zleceń Allegro…`);
    const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderIds:ids,stage},timeout:45000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;zaznaczoneAllegroZamowienia.clear();allegroZapiszCache();
    toast(`✅ Zmieniono etap ${d.changed||0} zleceń${d.skipped?.length?` • pominięto zamknięte: ${d.skipped.length}`:""}. Statusy Allegro pozostały bez zmian.`);renderuj();
  }catch(e){toast("⚠️ Masowy etap Allegro: "+(e.message||e));}
}
