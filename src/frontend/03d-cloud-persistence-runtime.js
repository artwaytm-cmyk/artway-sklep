// Trwałe pobieranie i zapis domen ustawień. Ładowane bezpośrednio po rdzeniu synchronizacji.
function chmuraPominBrudneDaneSerwera(dane={}){
  if(!maUprawnieniaZapisuChmury()||!chmuraBrudneKlucze.size)return dane;
  return Object.fromEntries(Object.entries(dane||{}).filter(([klucz])=>!chmuraBrudneKlucze.has(klucz)));
}
async function chmuraWczytajStan(){
  chmuraOstatniPullZmienilDane=false;
  try{
    const lokalnaRewizja=Math.max(0,Number(wczytajLS("artway_chmura_rev",0))||0);
    const trybAdmina=maUprawnieniaZapisuChmury(),wersjeDomen=trybAdmina?chmuraWersjeDomenAdmina:chmuraWersjeDomenPubliczne;
    const d = await chmura("pull",{params:{catalogRev:chmuraKatalogImportowanyRev,settingsDomains:JSON.stringify(wersjeDomen||{}),catalogMode:"central",adminData:0,...(lokalnaRewizja?{settingsRev:lokalnaRewizja}:{})}});
    chmuraOstatniPullZmienilDane=(await chmuraPobierzKatalogImportowany(d))||chmuraOstatniPullZmienilDane;
    chmuraStan = {...chmuraStan, dostepna:true, sprawdzono:true, admin:d.admin===true||chmuraStan.admin, rev:d.rev||0, updated_at:d.updated_at||null, error:""};
    const revLok = lokalnaRewizja;
    const serwerNowszy = (d.rev||0) > revLok;
    const zmienioneDomeny = Array.isArray(d.settings_changed_keys) && d.settings_changed_keys.length>0;
    // Klient (bez tokenu): serwer jest źródłem prawdy → zawsze nakładaj.
    // Admin: nakładaj nowszy rekord bazowy ALBO jawnie zmienione domeny.
    // Domeny mają własne rewizje, więc ich świeżego zapisu nie wolno pominąć
    // tylko dlatego, że globalna rewizja ustawień pozostała bez zmian.
    if(d.settings && Object.keys(d.settings).length && (!maUprawnieniaZapisuChmury() || serwerNowszy || zmienioneDomeny)){
      chmuraOstatniPullZmienilDane=nalozWspolneUstawienia(chmuraPominBrudneDaneSerwera(d.settings))||chmuraOstatniPullZmienilDane;
      zapiszLS("artway_chmura_rev", d.rev||0);
    }
    if(d.settings_domain_versions&&typeof d.settings_domain_versions==="object"){
      const merged={...(wersjeDomen||{}),...d.settings_domain_versions};
      if(trybAdmina){chmuraWersjeDomenAdmina=merged;zapiszLS("artway_chmura_domain_versions_admin",merged);}
      else{chmuraWersjeDomenPubliczne=merged;zapiszLS("artway_chmura_domain_versions_public",merged);}
    }
    if(Array.isArray(d.deleted_orders)) scalUsunieteZamowienia(d.deleted_orders);
    if(Array.isArray(d.orders)){ chmuraOstatniPullZmienilDane=zapiszLS("artway_zamowienia", filtrujAktywneZamowienia(d.orders))||chmuraOstatniPullZmienilDane; chmuraStan.admin=true; }
    if(Array.isArray(d.users)){ chmuraOstatniPullZmienilDane=zapiszLS("artway_uzytkownicy", polaczUzytkownikowCentralnych(d.users))||chmuraOstatniPullZmienilDane; chmuraStan.admin=true; }
    if(chmuraMutacjePolUstawien.length)chmuraMutacjePolUstawienZaplanuj(0);
    return true;
  }catch(e){ chmuraStan = {...chmuraStan, dostepna:false, sprawdzono:true, error:e.message}; return false; }
}
function zaplanujZapisUstawien(){
  if(!maUprawnieniaZapisuChmury()) return;
  clearTimeout(chmuraTimerZapisu);
  chmuraTimerZapisu = setTimeout(()=>chmuraZapiszUstawienia({flush:false}), 1200);
}
function chmuraDomenaGotowaDoZapisu(key,now=Date.now()){
  const retryAt=Number(chmuraWstrzymaneDomeny.get(key)||0);
  if(!retryAt)return true;
  if(retryAt<=now){chmuraWstrzymaneDomeny.delete(key);return true;}
  return false;
}
function chmuraZaplanujKolejnyZapis(){
  clearTimeout(chmuraTimerZapisu);
  const now=Date.now(),gotowy=[...chmuraBrudneKlucze].some(key=>chmuraDomenaGotowaDoZapisu(key,now));
  if(gotowy||chmuraZapisPonowPoZakonczeniu){
    chmuraZapisPonowPoZakonczeniu=false;
    chmuraTimerZapisu=setTimeout(()=>chmuraZapiszUstawienia({flush:false}),1200);
    return;
  }
  const terminy=[...chmuraBrudneKlucze].map(key=>Number(chmuraWstrzymaneDomeny.get(key)||0)).filter(value=>value>now);
  if(terminy.length)chmuraTimerZapisu=setTimeout(()=>chmuraZapiszUstawienia({flush:false}),Math.max(1200,Math.min(...terminy)-now));
}
async function chmuraZapiszUstawienia(opcje={}){
  if(!maUprawnieniaZapisuChmury()) return false;
  if(opcje.flush===true){
    let all=opcje.all===true;
    for(let attempt=0;attempt<8;attempt++){
      clearTimeout(chmuraTimerZapisu);
      if(chmuraZapisWToku){
        const pending=await chmuraZapisWToku.catch(()=>false);
        if(!pending)return false;
      }
      clearTimeout(chmuraTimerZapisu);
      const ok=await chmuraZapiszUstawienia({...opcje,flush:false,all});
      all=false;
      if(!ok)return false;
      if(!chmuraZapisWToku&&!chmuraBrudneKlucze.size&&!chmuraZapisPonowPoZakonczeniu){
        clearTimeout(chmuraTimerZapisu);
        return true;
      }
    }
    chmuraStan={...chmuraStan,error:"Serwer nie potwierdził jeszcze całej kolejki zmian."};
    return false;
  }
  if(chmuraZapisWToku){chmuraZapisPonowPoZakonczeniu=true;return chmuraZapisWToku;}
  chmuraZapisWToku=(async()=>{
    const trybAdmina = maUprawnieniaZapisuChmury();
    const wersjeDomen = trybAdmina ? chmuraWersjeDomenAdmina : chmuraWersjeDomenPubliczne;
    const snapshot=zbierzWspolneUstawienia(), wszystkie= (opcje.all===true?KLUCZE_WSPOLNE:[...chmuraBrudneKlucze]).filter(k=>Object.prototype.hasOwnProperty.call(snapshot,k)&&chmuraDomenaGotowaDoZapisu(k));
    if(!wszystkie.length) return true;
    const domainKeys=wszystkie.filter(k=>CHMURA_DOMENOWE_KLUCZE.has(k)), patchKeys=wszystkie.filter(k=>!CHMURA_DOMENOWE_KLUCZE.has(k));
    const odciski=Object.fromEntries(wszystkie.map(k=>[k,JSON.stringify(snapshot[k])]));
    let expectedRev=Number(chmuraStan.rev||wczytajLS("artway_chmura_rev",0))||0,mutationId=`web-${Date.now().toString(36)}-${(++chmuraNumerMutacji).toString(36)}`;
    let ok = true;
    if(domainKeys.length){
      for(const key of domainKeys){
        try{
          const expectedRevision = wersjeDomen && Object.prototype.hasOwnProperty.call(wersjeDomen, key) ? Number(wersjeDomen[key]) : null;
          const body = {mode:"domain",key,value:snapshot[key]};
          if(Number.isFinite(expectedRevision) && expectedRevision>0) body.expectedRevision = expectedRevision;
          const d=await chmura("settings",{method:"POST",body,timeout:30000});
          chmuraWstrzymaneDomeny.delete(key);
          if(Number.isFinite(d.version)) {
            if(trybAdmina) chmuraWersjeDomenAdmina={...(chmuraWersjeDomenAdmina||{}),[key]:Number(d.version)};
            else chmuraWersjeDomenPubliczne={...(chmuraWersjeDomenPubliczne||{}),[key]:Number(d.version)};
          }
          if(d.merged===true) loguj("info",`Scalono równoległe zmiany domeny ${key}; żadnego zadania nie utracono.`);
          chmuraStan={...chmuraStan,dostepna:true,admin:true,error:"",updated_at:d.updated_at||chmuraStan.updated_at,ostatniZapis:Date.now()};
          if(Number.isFinite(d.rev)){ chmuraStan.rev=Number(d.rev); expectedRev=chmuraStan.rev; localStorage.setItem("artway_chmura_rev",JSON.stringify(chmuraStan.rev)); }
          const teraz=zbierzWspolneUstawienia();
          if(JSON.stringify(teraz[key])===odciski[key]) chmuraBrudneKlucze.delete(key);
        }catch(e){
          ok=false;
          if(e.code==="settings_write_conflict"){
            const currentVersion=Number(e?.payload?.currentVersion||e?.currentVersion||0);
            if(Number.isFinite(currentVersion)&&currentVersion>0){
              if(trybAdmina) chmuraWersjeDomenAdmina={...(chmuraWersjeDomenAdmina||{}),[key]:currentVersion};
              else chmuraWersjeDomenPubliczne={...(chmuraWersjeDomenPubliczne||{}),[key]:currentVersion};
            }
            loguj("ostrzezenie",`${key}: wykryto równoległą zmianę; zapis pozostaje w kolejce i zostanie bezpiecznie ponowiony.`);
          }else if(e.code==="auth")toast("⚠️ Hasło bazy nieprawidłowe — ustawienia nie zapisały się w chmurze");
          else if(Number(e.status)===422&&/domena ustawien|domena ustawień/i.test(String(e.message||""))){
            chmuraWstrzymaneDomeny.set(key,Date.now()+CHMURA_ODRZUCONA_DOMENA_RETRY_MS);
            loguj("blad","Kontrakt zapisu domeny "+key+" jest niespójny z serwerem. Dane lokalne zachowano; kolejna próba nastąpi za 15 minut.");
          }
          else if(/Brak połączenia z serwerem|Serwer nie odpowiedział|Serwer nie zwrócił prawidłowych danych/i.test(String(e.message||""))){
            // Krótkie przeładowanie backendu nie jest uszkodzeniem danych.
            // Klucz pozostaje w kolejce i następny cykl ponawia dokładnie ten
            // sam zapis, dlatego nie zanieczyszczamy centralnej diagnostyki
            // fałszywym błędem wymagającym interwencji.
            loguj("info","Chwilowa przerwa serwera podczas zapisu "+key+" — zmiana pozostaje w kolejce do automatycznego ponowienia.");
          }
          else loguj("blad","Zapis ustawienia domeny "+key+" w chmurze: "+e.message);
          break;
        }
      }
    }
    if(!ok){ chmuraStan={...chmuraStan,error:`Nie udało się zapisać części ustawień domenowych.`}; return false; }
    if(trybAdmina) zapiszLS("artway_chmura_domain_versions_admin",chmuraWersjeDomenAdmina||{});
    else zapiszLS("artway_chmura_domain_versions_public",chmuraWersjeDomenPubliczne||{});
    if(patchKeys.length){
      const CHMURA_PATCH_MAX_BYTES = 9_600_000;
      const sizeUtf8 = (value) => {
        try {
          return new Blob([JSON.stringify(value)]).size;
        } catch (e) {
          return String(JSON.stringify(value)).length;
        }
      };
      const bladZapisuZaDuzy = (error, fallbackMessage) => {
        const msg = String(fallbackMessage || error?.message || "").toLowerCase();
        const is413 = Number(error?.status || 0) === 413;
        const containsText = /ustawienia\s*sa\s*zbyt\s+duze|ustawienia\s+są\s+zbyt\s+duże|zbyt\s+duże|request\s+entity\s+too\s+large|żądanie\s+jest\s+zbyt\s+duże|payload.*too\s+large|limit.*rozmiar/i;
        return is413 || containsText.test(msg);
      };
      const podzielKluczePoRozmiarze = (keys, limit) => {
        if(!keys.length) return [];
        const chunks = [];
        let current = [];
        let currentBytes = 2; // {}
        for (const key of keys) {
          const item = { [key]: snapshot[key] };
          const itemBytes = sizeUtf8(item) + 6; // {"a":}+kolejny separator
          if (current.length && currentBytes + itemBytes > limit) {
            chunks.push(current);
            current = [];
            currentBytes = 2;
          }
          if (itemBytes > limit) {
            chunks.push([key]);
            currentBytes = 2;
            current = [];
            continue;
          }
          current.push(key);
          currentBytes += itemBytes;
        }
        if (current.length) chunks.push(current);
        return chunks;
      };
      const zapiszJakoDomena = async (key, currentExpected) => {
        const expectedRevision = wersjeDomen && Object.prototype.hasOwnProperty.call(wersjeDomen, key) ? Number(wersjeDomen[key]) : null;
        const body = {mode:"domain",key,value:snapshot[key]};
        if (Number.isFinite(expectedRevision) && expectedRevision > 0) body.expectedRevision = expectedRevision;
        const d = await chmura("settings",{method:"POST",body,timeout:30000});
        if (Number.isFinite(d.version)) {
          if (trybAdmina) chmuraWersjeDomenAdmina = {...(chmuraWersjeDomenAdmina || {}), [key]: Number(d.version)};
          else chmuraWersjeDomenPubliczne = {...(chmuraWersjeDomenPubliczne || {}), [key]: Number(d.version)};
        }
        if (Number.isFinite(d.rev)) {
          chmuraStan = { ...chmuraStan, rev: Number(d.rev) };
          currentExpected = chmuraStan.rev;
          localStorage.setItem("artway_chmura_rev", JSON.stringify(chmuraStan.rev));
        }
        return {ok:true,rev:Number(d.rev || currentExpected),errorMessage:"",updatedAt:d.updated_at||chmuraStan.updated_at};
      };
      const zapiszPatch = async (keys, expected) => {
        if(!keys.length) return {ok:true,rev:expected};
        const patch = Object.fromEntries(keys.map((k)=>[k,snapshot[k]]));
        const expectedRev = expected;
        const request = async () => {
          const d = await chmura("settings",{method:"POST",body:{mode:"patch",patch,expectedRev,mutationId},timeout:30000});
          return {ok:true,rev:Number(d.rev||expected),errorMessage:"",updatedAt:d.updated_at||chmuraStan.updated_at};
        };
        try {
          return await request();
        } catch (e) {
          const tooLarge = bladZapisuZaDuzy(e, e?.message || "");
          const shouldSplit = (keys.length > 1) && tooLarge;
          if (shouldSplit) {
            const chunks = podzielKluczePoRozmiarze(keys, Math.max(150000, Math.floor(CHMURA_PATCH_MAX_BYTES / Math.max(2, keys.length))));
            if (chunks.length > 1) {
              let rev = expected;
              for (const chunk of chunks) {
                const res = await zapiszPatch(chunk, rev);
                if (!res.ok) return res;
                rev = Number(res.rev || rev);
              }
              return {ok:true,rev,updatedAt:chmuraStan.updated_at,errorMessage:""};
            }
          }
          if (tooLarge && keys.length === 1) {
            try {
              return await zapiszJakoDomena(keys[0], expected);
            } catch (e2) {
              return {ok:false,errorMessage:e2.message,code:e2.code||e.code||""};
            }
          }
          return {ok:false,errorMessage:e.message,code:e.code||""};
        }
      };
      try{
        const patchResult = await zapiszPatch(patchKeys,expectedRev);
        if(!patchResult.ok){
          ok=false;
          if(patchResult.code==="auth")toast("⚠️ Hasło bazy nieprawidłowe — ustawienia nie zapisały się w chmurze");
          else if(patchResult.code==="settings_write_conflict")toast("⚠️ Serwer jest zajęty inną zmianą — dane lokalne zostały zachowane i zapis zostanie ponowiony.");
          else loguj("blad","Zapis ustawień w chmurze: "+(patchResult.errorMessage||"Nieznany błąd zapisu."));
          chmuraStan={...chmuraStan,error:patchResult.errorMessage||"Nieznany błąd zapisu ustawień."};
        } else {
          chmuraStan={...chmuraStan,dostepna:true,admin:true,rev:patchResult.rev||chmuraStan.rev,updated_at:patchResult.updatedAt||null,error:"",ostatniZapis:Date.now()};
          localStorage.setItem("artway_chmura_rev",JSON.stringify(chmuraStan.rev));
          for(const k of patchKeys)if(JSON.stringify(snapshot[k])===odciski[k])chmuraBrudneKlucze.delete(k);
        }
      }catch(e){
        ok=false;
        chmuraStan={...chmuraStan,error:e.message};
        if(e.code==="auth")toast("⚠️ Hasło bazy nieprawidłowe — ustawienia nie zapisały się w chmurze");
        else if(e.code==="settings_write_conflict")toast("⚠️ Serwer jest zajęty inną zmianą — dane lokalne zostały zachowane i zapis zostanie ponowiony.");
        loguj("blad","Zapis ustawień w chmurze: "+e.message);
      }
    }
    if(ok && patchKeys.length){
      for(const k of patchKeys) if(JSON.stringify(snapshot[k])===odciski[k]) chmuraBrudneKlucze.delete(k);
    }
    return ok;
  })();
  try{return await chmuraZapisWToku;}finally{
    chmuraZapisWToku=null;
    if(chmuraBrudneKlucze.size||chmuraZapisPonowPoZakonczeniu)chmuraZaplanujKolejnyZapis();
  }
}
// Ręczne WYSŁANIE całego sklepu z tego urządzenia na serwer (dla wszystkich).
async function chmuraWyslijWszystko(){
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
  toast("Wysyłanie na serwer…");
  const okU = await chmuraZapiszUstawienia({all:true,flush:true});
  await synchronizujBazeCentralna(true).catch(()=>{});
  if(okU) toast("📤 Cały sklep wysłany na serwer — widoczny na każdym urządzeniu ✅");
  else toast("⚠️ Nie udało się wysłać — sprawdź hasło bazy");
  renderuj();
}
// Ręczne POBRANIE sklepu z serwera i nałożenie na to urządzenie.
async function chmuraPobierzWszystko(){
  try{
    const d = await chmura("pull",{params:{catalogRev:"",settingsDomains:"{}",adminData:1}});
    await chmuraPobierzKatalogImportowany(d,true);
    chmuraBrudneKlucze.clear();
    if(d.settings && Object.keys(d.settings).length){ nalozWspolneUstawienia(d.settings); zapiszLS("artway_chmura_rev", d.rev||0); }
    if(d.settings_domain_versions&&typeof d.settings_domain_versions==="object"){
      if(maUprawnieniaZapisuChmury()){chmuraWersjeDomenAdmina=d.settings_domain_versions;zapiszLS("artway_chmura_domain_versions_admin",d.settings_domain_versions);}
      else{chmuraWersjeDomenPubliczne=d.settings_domain_versions;zapiszLS("artway_chmura_domain_versions_public",d.settings_domain_versions);}
    }
    chmuraStan = {...chmuraStan, dostepna:true, rev:d.rev||0, updated_at:d.updated_at||null, error:""};
    if(chmuraToken) await synchronizujBazeCentralna(true).catch(()=>{});
    zastosujUstawienia(); zbudujProdukty();
    odswiezMenu(); odswiezKoszyk();
    toast("📥 Pobrano sklep z serwera ✅"); renderuj();
  }catch(e){ toast("Błąd pobierania: "+e.message); }
}
function chmuraUstawToken(){
  if(maUprawnieniaZapisuChmury()){
    toast("Trwała sesja administratora jest aktywna ✅");
    return;
  }
  toast("Zaloguj się jako administrator — połączenie z serwerem odnowi się automatycznie.");
  location.hash="#/logowanie";
}
function chmuraWyczyscToken(){ chmuraToken=""; try{sessionStorage.removeItem("artway_chmura_token");localStorage.removeItem("artway_chmura_token");}catch(e){} chmuraStan={...chmuraStan,admin:false}; toast("Odłączono hasło bazy"); renderuj(); }
