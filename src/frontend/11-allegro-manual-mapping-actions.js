async function allegroMapujOferte(offerId,productId,options={}){
  try{
    const id=String(productId||"").trim(),manualDecision=id&&options.manualDecision!==false;
    const d=await chmura(id?"allegro-map-offer":"allegro-unmap-offer",{method:"POST",body:{offerId,productId:id,manualDecision,force:manualDecision||options.force===true},timeout:45000});
    allegroMapowania=d.mappings&&typeof d.mappings==="object"?d.mappings:allegroMapowania;
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;rezerwacjeMagazynowe._cache=null;
    let synchronizacja=null,bladSynchronizacji=null;
    if(id&&d.syncRequired!==false&&options.syncOffer!==false){
      const produkt=produktyDoAdministracji().find(p=>String(p.id)===id)||pobierzProduktAdmin(Number(id));
      if(produkt)try{
        synchronizacja=await chmura("allegro-create-product-offer",{method:"POST",body:{product:{...produkt,allegroOfferId:String(offerId)},mappedOfferId:String(offerId),options:{publicationAction:"keep",preserveStock:true,syncReason:"manual-mapping"}},timeout:120000});
        allegroZapiszAutoUzupelnienia(produkt,synchronizacja);allegroZastosujWynikWystawienia(produkt,synchronizacja);
      }catch(e){bladSynchronizacji=e;}
    }
    if(id)await chmuraWczytajStan().catch(()=>{});allegroZapiszCache();
    toast(!id?"Powiązanie produktu zostało usunięte":bladSynchronizacji?`✅ Trwałe połączenie zapisane • ⚠️ Agent ponowi aktualizację Allegro: ${bladSynchronizacji.message||bladSynchronizacji}`:d.idempotent&&d.syncRequired===false?"✅ To powiązanie jest już zapisane i aktualne — niczego nie połączono ponownie":`✅ Ustawiono trwałe powiązanie • sklep jest źródłem danych${d.duplicateOfferIds?.length?` • ${d.duplicateOfferIds.length} pozostałych ofert oznaczono do decyzji`:""}`);
    renderuj();return {ok:true,data:d,synchronizacja,syncOk:!bladSynchronizacji,syncError:bladSynchronizacji};
  }catch(e){allegroMapowaniePozycjiCel={...allegroMapowaniePozycjiCel,error:e};toast("⚠️ Mapowanie Allegro: "+(e.message||e));return {ok:false,error:e};}
}
