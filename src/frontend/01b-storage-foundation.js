/* ═══════════ FUNDAMENT PAMIĘCI PRZEGLĄDARKI ═══════════
   Ten moduł musi zostać uruchomiony przed inicjalizacją stanu sklepu.
   Odczyt danych nie może zależeć od później inicjalizowanej synchronizacji. */
const CHMURA_LS_OMIJANE_KLUCZE = new Set(["artway_ustawienia","artway_produkty_dodane","artway_produkty_edytowane","artway_produkty_katalog","artway_agent_ai_linki_producentow","artway_agent_ai_zlecenia","artway_agent_ai_historia","artway_agent_ai_pamiec","artway_magazyn_produkty","artway_magazyn_ustawienia","artway_faktury_szkice","artway_dostepnosc","artway_stany","artway_seo_ustawienia"]);
const CENTRAL_PRODUCT_LS_KEYS = new Set(["artway_produkty_dodane","artway_produkty_edytowane","artway_produkty_katalog","artway_produkty_ukryte","artway_produkty_definitywne","artway_kosz_dodane","artway_kosz_meta","artway_ostatnia_kopia_importu"]);
const CHMURA_LS_OMIJANE_PRAG = 320_000;
const CHMURA_LS_OMIJANE_PRAG_BYTES = 400_000;
const CHMURA_LS_OMIJANE_SAFE_BYTES = 7_500_000;
const CHMURA_LS_OMIJANE_PERSISTENT_KEY = "artway_cloud_ls_omit_v1";
const CHMURA_LS_OMIJANE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHMURA_LS_CHUNK_PREFIX = "artway_ls_chunk__";
const CHMURA_LS_CHUNK_MAX_CHAR = 300_000;

function chmuraRozmiarBajtow(tekst="") {
  try {
    if (typeof Blob !== "undefined") return new Blob([String(tekst)]).size;
    return String(tekst).length * 2;
  } catch (e) {
    return String(tekst).length;
  }
}

function chmuraOdczytajPominioneZapisyLS() {
  const readFrom = (storage) => {
    if (!storage) return {};
    const raw = storage.getItem(CHMURA_LS_OMIJANE_PERSISTENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const now = Date.now();
    const out = {};
    for (const [key, rawValue] of Object.entries(parsed)) {
      const value = Number(typeof rawValue === "number" ? rawValue : (rawValue && Number(rawValue.ts)));
      if (Number.isFinite(value) && now - value < CHMURA_LS_OMIJANE_TTL_MS) out[String(key)] = Number(value);
    }
    return out;
  };
  try {
    const local = readFrom(localStorage);
    const session = readFrom(sessionStorage);
    const merged = {...session, ...local};
    if (Object.keys(merged).length) return merged;
  } catch (e) {
    return {};
  }
  return {};
}
let chmuraPominieteZapisyLS = chmuraOdczytajPominioneZapisyLS();
function chmuraZapiszMapePominietych(){
  try{ localStorage.setItem(CHMURA_LS_OMIJANE_PERSISTENT_KEY, JSON.stringify(chmuraPominieteZapisyLS));return;}
  catch(e){ try{sessionStorage.setItem(CHMURA_LS_OMIJANE_PERSISTENT_KEY, JSON.stringify(chmuraPominieteZapisyLS));}catch(e2){} }
}
function chmuraCzyPominacZapisLS(klucz) {
  const ts = Number(chmuraPominieteZapisyLS[String(klucz)]);
  return Number.isFinite(ts) && Date.now() - ts < CHMURA_LS_OMIJANE_TTL_MS;
}
function chmuraZapiszPominanyZapisLS(klucz) {
  const key = String(klucz);
  chmuraPominieteZapisyLS[key] = Date.now();
  chmuraZapiszMapePominietych();
}
function chmuraCzyZlyszyKlucz(klucz, serial=""){
  return CHMURA_LS_OMIJANE_KLUCZE.has(klucz) && chmuraRozmiarBajtow(serial) > CHMURA_LS_OMIJANE_PRAG_BYTES;
}
function chmuraCzyKluczBylZaDuzy(klucz, serial=""){
  const bytes = chmuraRozmiarBajtow(serial);
  return CHMURA_LS_OMIJANE_KLUCZE.has(klucz) && bytes > CHMURA_LS_OMIJANE_SAFE_BYTES;
}
function chmuraUsuńDuzyKluczLS(klucz){
  try{localStorage.removeItem(klucz);}catch(e){}
}
function chmuraCzyscDuzeKluczeLS() {
  const usunieto = [];
  for (const key of CHMURA_LS_OMIJANE_KLUCZE) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) continue;
      if (chmuraCzyKluczBylZaDuzy(key, raw)) {
        localStorage.removeItem(key);
        chmuraZapiszPominanyZapisLS(key);
        usunieto.push(key);
      }
    } catch (e) {}
  }
  return usunieto;
}
function chmuraCzyscSerweroweKopieLS() {
  if(typeof chmuraStan==="undefined"||!chmuraStan.dostepna||typeof maUprawnieniaZapisuChmury!=="function"||!maUprawnieniaZapisuChmury())return [];
  const usunieto=[];
  for(const key of CHMURA_LS_OMIJANE_KLUCZE){
    try{
      const raw=localStorage.getItem(key);
      if(raw===null||chmuraRozmiarBajtow(raw)<=CHMURA_LS_OMIJANE_PRAG_BYTES)continue;
      localStorage.removeItem(key);
      chmuraUsunChunksLS(key);
      chmuraZapiszPominanyZapisLS(key);
      usunieto.push(key);
    }catch(e){}
  }
  return usunieto;
}
function chmuraUsunPominanyZapisLS(klucz) {
  delete chmuraPominieteZapisyLS[String(klucz)];
  try{
    const now = Date.now();
    const cleaned = {};
    for (const [key, ts] of Object.entries(chmuraPominieteZapisyLS)) {
      if (Number.isFinite(ts) && now - ts < CHMURA_LS_OMIJANE_TTL_MS) cleaned[key] = ts;
    }
    chmuraPominieteZapisyLS = cleaned;
  } finally {
    chmuraZapiszMapePominietych();
    try{sessionStorage.removeItem(CHMURA_LS_OMIJANE_PERSISTENT_KEY);}catch(e){}
  }
}
function chmuraKluczChunkMeta(klucz){ return `${CHMURA_LS_CHUNK_PREFIX}${String(klucz)}::meta`; }
function chmuraKluczChunk(klucz, idx){ return `${CHMURA_LS_CHUNK_PREFIX}${String(klucz)}::part_${Number(idx)}`; }
function chmuraUsunChunksLS(klucz){
  const metaKey = chmuraKluczChunkMeta(klucz);
  let meta = null;
  try{
    const rawMeta = localStorage.getItem(metaKey);
    if(rawMeta) meta = JSON.parse(rawMeta);
  }catch(e){ meta = null; }
  try{ localStorage.removeItem(metaKey); }catch(e){}
  try{
    if(meta && Array.isArray(meta.keys) && meta.keys.length){
      for(const part of meta.keys) localStorage.removeItem(part);
      return;
    }
    if(meta && Number.isFinite(meta.count)){
      for(let i=0;i<Number(meta.count);i++) localStorage.removeItem(chmuraKluczChunk(klucz,i));
    }
  }catch(e){}
}
function chmuraOdczytajZChunksLS(klucz){
  const metaKey = chmuraKluczChunkMeta(klucz);
  let meta = null;
  try{
    const rawMeta = localStorage.getItem(metaKey);
    if(!rawMeta) return null;
    meta = JSON.parse(rawMeta);
  }catch(e){
    chmuraUsunChunksLS(klucz);
    return null;
  }
  if(!meta || !meta.chunked || !Number.isFinite(meta.count) || meta.count<=0) return null;
  const parts = [];
  try{
    for(let i=0;i<Number(meta.count);i++){
      const k = meta.keys && Array.isArray(meta.keys) ? meta.keys[i] : chmuraKluczChunk(klucz,i);
      const piece = localStorage.getItem(k);
      if(piece===null||piece===undefined) return null;
      parts.push(String(piece));
    }
  }catch(e){
    return null;
  }
  return parts.length ? parts.join("") : null;
}
function chmuraZapiszZChunksLS(klucz, serial){
  const count = Math.max(1, Math.ceil(serial.length / CHMURA_LS_CHUNK_MAX_CHAR));
  const keys = [];
  for(let i=0;i<count;i++) keys.push(chmuraKluczChunk(klucz,i));
  const meta = {chunked:true,count,chunkSize:CHMURA_LS_CHUNK_MAX_CHAR,size:serial.length,keys,savedAt:Date.now()};
  chmuraUsunChunksLS(klucz);
  try{
    localStorage.setItem(chmuraKluczChunkMeta(klucz), JSON.stringify(meta));
    for(let i=0;i<count;i++){
      localStorage.setItem(keys[i], serial.slice(i*CHMURA_LS_CHUNK_MAX_CHAR,(i+1)*CHMURA_LS_CHUNK_MAX_CHAR));
    }
    localStorage.removeItem(klucz);
    return true;
  }catch(e){
    chmuraUsunChunksLS(klucz);
    throw e;
  }
}
function wczytajLS(klucz, domyslne){
  try{
    const raw = localStorage.getItem(klucz);
    if(raw === null || raw === undefined){
      const chunksRaw = chmuraOdczytajZChunksLS(klucz);
      if(chunksRaw===null) return domyslne;
      return JSON.parse(chunksRaw) ?? domyslne;
    }
    if(chmuraCzyZlyszyKlucz(klucz, raw) && chmuraCzyPominacZapisLS(klucz)) {
      try{localStorage.removeItem(klucz);}catch(e){}
      return domyslne;
    }
    return JSON.parse(raw) ?? domyslne;
  }catch(e){
    try{
      const chunksRaw = chmuraOdczytajZChunksLS(klucz);
      if(chunksRaw!==null){
        try{
          return JSON.parse(chunksRaw) ?? domyslne;
        }catch(err){
          chmuraUsunChunksLS(klucz);
        }
      }
    }catch(err){
      chmuraUsunChunksLS(klucz);
    }
    if(chmuraCzyPominacZapisLS(klucz)) return domyslne;
    chmuraZapiszPominanyZapisLS(klucz);
    try{localStorage.removeItem(klucz);}catch(err){}
    return domyslne;
  }
}
