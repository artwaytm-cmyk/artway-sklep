async function allegroMapujOferte(offerId,productId,options={}){
  try{
    const id=String(productId||"").trim(),manualDecision=id&&options.manualDecision!==false;
    const d=await chmura(id?"allegro-map-offer":"allegro-unmap-offer",{method:"POST",body:{offerId,productId:id,manualDecision,force:manualDecision||options.force===true,replaceExisting:manualDecision||options.replaceExisting===true},timeout:45000});
    allegroMapowania=d.mappings&&typeof d.mappings==="object"?d.mappings:allegroMapowania;
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;rezerwacjeMagazynowe._cache=null;
    let synchronizacja=null,bladSynchronizacji=null;
    if(id&&options.syncOffer!==false){
      const produkt=produktyDoAdministracji().find(p=>String(p.id)===id)||pobierzProduktAdmin(Number(id));
      if(produkt)try{
        synchronizacja=await chmura("allegro-create-product-offer",{method:"POST",body:{product:{...produkt,allegroOfferId:String(offerId)},mappedOfferId:String(offerId),options:{publicationAction:"keep",preserveStock:true,syncReason:"manual-mapping"}},timeout:120000});
        allegroZapiszAutoUzupelnienia(produkt,synchronizacja);allegroZastosujWynikWystawienia(produkt,synchronizacja);
      }catch(e){bladSynchronizacji=e;}
    }
    if(id)await chmuraWczytajStan().catch(()=>{});allegroZapiszCache();
    toast(!id?"Powiązanie produktu zostało usunięte":bladSynchronizacji?`✅ Połączenie zapisane ręcznie • ⚠️ aktualizacja oferty wymaga ponowienia: ${bladSynchronizacji.message||bladSynchronizacji}`:`✅ Połączono ręcznie i zaktualizowano ofertę Allegro${d.replacedOfferIds?.length?" • zastąpiono poprzednie powiązanie":""}`);
    renderuj();return {ok:true,data:d,synchronizacja,syncOk:!bladSynchronizacji,syncError:bladSynchronizacji};
  }catch(e){allegroMapowaniePozycjiCel={...allegroMapowaniePozycjiCel,error:e};toast("⚠️ Mapowanie Allegro: "+(e.message||e));return {ok:false,error:e};}
}
