/* Lekkie, miesięczne archiwum zamówień Allegro — ładowane wyłącznie na żądanie. */
function allegroZrodloZamowien(){return filtrAllegroZamowien==="archiwum"?(allegroArchiwum.items||[]):(allegroZamowienia||[]);}
async function allegroWczytajArchiwum(reset=true){
  if(allegroArchiwum.busy)return;const offset=reset?0:Number(allegroArchiwum.offset||0);allegroArchiwum={...allegroArchiwum,busy:true,error:""};renderuj();
  try{const d=await chmura("allegro-orders-archive",{params:{month:allegroArchiwum.month||"",offset,limit:100},timeout:30000}),incoming=Array.isArray(d.items)?d.items:[];allegroArchiwum={...allegroArchiwum,busy:false,loaded:true,items:reset?incoming:[...(allegroArchiwum.items||[]),...incoming],summary:d.summary||allegroArchiwum.summary,offset:offset+incoming.length,hasMore:!!d.hasMore,error:""};}
  catch(e){allegroArchiwum={...allegroArchiwum,busy:false,error:e.message||String(e)};toast("⚠️ Archiwum Allegro: "+(e.message||e));}
  renderuj();
}
function allegroUstawFiltrZamowien(id){filtrAllegroZamowien=id;if(id==="archiwum"){filtrEtapuAllegroZamowien="wszystkie";zaznaczoneAllegroZamowienia.clear();if(!allegroArchiwum.loaded)setTimeout(()=>allegroWczytajArchiwum(true),0);}renderuj();}
