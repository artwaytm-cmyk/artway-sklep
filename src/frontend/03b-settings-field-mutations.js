/* ═══════════ ATOMOWE MUTACJE PÓL USTAWIEŃ ═══════════
   Każda drobna zmiana formularza trafia do trwałej kolejki, jest nakładana na
   najnowszy rekord serwera i znika z kolejki dopiero po odczycie potwierdzenia. */
const CHMURA_MUTACJE_POL_USTAWIEN_KEY = "artway_oczekujace_mutacje_ustawien";
let chmuraMutacjePolUstawien = (()=>{const value=wczytajLS(CHMURA_MUTACJE_POL_USTAWIEN_KEY,[]);return Array.isArray(value)?value.slice(0,250):[];})();
let chmuraMutacjePolUstawienWToku = null;
let chmuraMutacjePolUstawienTimer = null;

function chmuraMutacjePolUstawienZapiszKolejke(){
  try{localStorage.setItem(CHMURA_MUTACJE_POL_USTAWIEN_KEY,JSON.stringify(chmuraMutacjePolUstawien.slice(0,250)));return true;}
  catch(e){return false;}
}
function chmuraMutacjaOdcisk(value){
  try{return JSON.stringify(value);}
  catch(e){return String(value);}
}
function chmuraMutacjePolUstawienZaplanuj(ms=12000){
  clearTimeout(chmuraMutacjePolUstawienTimer);
  if(!chmuraMutacjePolUstawien.length)return;
  chmuraMutacjePolUstawienTimer=setTimeout(()=>chmuraWyslijMutacjePolUstawien().catch(()=>false),ms);
}
async function chmuraWyslijMutacjePolUstawien(){
  if(chmuraMutacjePolUstawienWToku)return chmuraMutacjePolUstawienWToku;
  if(!chmuraMutacjePolUstawien.length)return true;
  if(!maUprawnieniaZapisuChmury()){chmuraMutacjePolUstawienZaplanuj(15000);return false;}
  chmuraMutacjePolUstawienWToku=(async()=>{
    while(chmuraMutacjePolUstawien.length){
      const mutation=chmuraMutacjePolUstawien[0];
      try{
        const d=await chmura("settings-field-mutation",{method:"POST",body:{mutationId:mutation.id,changes:mutation.changes||{},removeKeys:mutation.removeKeys||[],expectedRev:Number(chmuraStan.rev||wczytajLS("artway_chmura_rev",0))||0},timeout:30000});
        const authoritative=d.authoritative||{},values=authoritative.values||{},deleted=new Set(authoritative.deletedKeys||[]);
        for(const [key,value] of Object.entries(mutation.changes||{})){
          if(chmuraMutacjaOdcisk(ustawienia?.[key])===chmuraMutacjaOdcisk(value)&&Object.prototype.hasOwnProperty.call(values,key))ustawienia[key]=values[key];
        }
        for(const key of mutation.removeKeys||[]){
          if(!Object.prototype.hasOwnProperty.call(ustawienia||{},key)&&deleted.has(key))delete ustawienia[key];
        }
        zapiszLS("artway_ustawienia",ustawienia,{synchronizuj:false});
        chmuraStan={...chmuraStan,dostepna:true,admin:true,rev:d.rev||chmuraStan.rev,updated_at:d.updated_at||null,error:"",ostatniZapis:Date.now()};
        localStorage.setItem("artway_chmura_rev",JSON.stringify(d.rev||chmuraStan.rev));
        chmuraMutacjePolUstawien.shift();
        chmuraMutacjePolUstawienZapiszKolejke();
      }catch(error){
        chmuraStan={...chmuraStan,error:error.message||String(error)};
        chmuraMutacjePolUstawienZaplanuj(error?.code==="auth"?30000:5000);
        return false;
      }
    }
    return true;
  })();
  try{return await chmuraMutacjePolUstawienWToku;}
  finally{
    chmuraMutacjePolUstawienWToku=null;
    if(chmuraMutacjePolUstawien.length)chmuraMutacjePolUstawienZaplanuj();
  }
}
function chmuraDodajMutacjePolUstawien(changes={},removeKeys=[]){
  const cleanChanges={},cleanRemove=[...new Set((Array.isArray(removeKeys)?removeKeys:[]).map(String).filter(Boolean))];
  for(const [key,value] of Object.entries(changes||{})){
    if(value===undefined){if(!cleanRemove.includes(key))cleanRemove.push(key);}
    else cleanChanges[key]=JSON.parse(JSON.stringify(value));
  }
  if(!Object.keys(cleanChanges).length&&!cleanRemove.length)return Promise.resolve(true);
  const mutation={id:`setting-${Date.now().toString(36)}-${(++chmuraNumerMutacji).toString(36)}-${Math.random().toString(36).slice(2,8)}`,at:new Date().toISOString(),changes:cleanChanges,removeKeys:cleanRemove};
  chmuraMutacjePolUstawien.push(mutation);
  if(!chmuraMutacjePolUstawienZapiszKolejke()){
    chmuraStan={...chmuraStan,error:"Nie udało się zabezpieczyć kolejki zmian ustawień w pamięci przeglądarki."};
    return Promise.resolve(false);
  }
  return chmuraWyslijMutacjePolUstawien();
}
