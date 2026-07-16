/* ═══════════ IMPORT PRODUKTÓW Z PLIKU LINKÓW ═══════════
   Ekran administracyjny steruje trwałym zadaniem serwerowym. Każde wywołanie
   process-next pobiera, kontroluje i zapisuje dokładnie jeden produkt. */
const PRODUCT_LINK_IMPORT_STORAGE_KEY="artway_product_link_import_job";
const PRODUCT_LINK_IMPORT_PAGE_SIZES=[25,50,100];
const PRODUCT_LINK_IMPORT_TERMINAL_STATES=new Set(["completed","cancelled"]);
let productLinkImportStan={
  initialized:false,jobId:"",job:null,summary:null,items:[],analysisItems:[],parsedRows:[],fileName:"",
  parsing:false,creating:false,statusLoading:false,loopActive:false,pauseRequested:false,cancelRequested:false,
  filter:"all",query:"",page:1,pageSize:50,error:"",notice:"",startedLocallyAt:0,lastStepAt:0,statusLoadedFor:"",
  reviewSelected:new Set(),reviewBusy:false
};

function productLinkImportWczytajPamiec(){
  if(productLinkImportStan.initialized)return;
  productLinkImportStan.initialized=true;
  try{
    const saved=JSON.parse(localStorage.getItem(PRODUCT_LINK_IMPORT_STORAGE_KEY)||"null");
    if(saved?.jobId){productLinkImportStan.jobId=String(saved.jobId);productLinkImportStan.fileName=String(saved.fileName||"");}
  }catch(_error){}
}
function productLinkImportZapiszPamiec(){
  try{
    if(!productLinkImportStan.jobId)localStorage.removeItem(PRODUCT_LINK_IMPORT_STORAGE_KEY);
    else localStorage.setItem(PRODUCT_LINK_IMPORT_STORAGE_KEY,JSON.stringify({jobId:productLinkImportStan.jobId,fileName:productLinkImportStan.fileName,savedAt:new Date().toISOString()}));
  }catch(_error){}
}
function productLinkImportBrakZadania(error){return Number(error?.status)===404||String(error?.code||"")==="product_link_import_not_found";}
function productLinkImportWyczyscStareZadanie(error){
  if(!productLinkImportBrakZadania(error))return false;
  productLinkImportStan.jobId="";productLinkImportStan.job=null;productLinkImportStan.summary=null;productLinkImportStan.items=[];productLinkImportStan.analysisItems=[];productLinkImportStan.parsedRows=[];productLinkImportStan.fileName="";productLinkImportStan.statusLoadedFor="";productLinkImportStan.pauseRequested=false;productLinkImportStan.cancelRequested=false;productLinkImportStan.reviewSelected.clear();productLinkImportStan.reviewBusy=false;productLinkImportStan.error="";productLinkImportStan.notice="Poprzednie zadanie nie jest już dostępne. Możesz wybrać nowy plik i rozpocząć nowy import.";
  productLinkImportZapiszPamiec();return true;
}
function productLinkImportCzekaj(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));}
function productLinkImportLiczba(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function productLinkImportStatus(status){
  const value=String(status||"queued").toLowerCase().replace(/[ -]+/g,"_");
  const aliases={pending:"queued",waiting:"queued",in_progress:"processing",running:"processing",success:"added",saved:"added",duplicate:"skipped_existing",skipped:"skipped_existing",review:"needs_review",error:"failed",canceled:"cancelled"};
  return aliases[value]||value;
}
function productLinkImportStanZadania(state){
  const value=String(state||"running").toLowerCase().replace(/[ -]+/g,"_");
  const aliases={queued:"running",ready:"running",processing:"running",done:"completed",finished:"completed",canceled:"cancelled"};
  return aliases[value]||value;
}
function productLinkImportKluczElementu(item){return String(item?.id||item?.itemId||item?.rowNumber||item?.url||"");}
function productLinkImportNormalizujElement(raw,index=0){
  const item=raw||{};
  return {
    ...item,
    id:String(item.id||item.itemId||`row-${productLinkImportLiczba(item.rowNumber,index+1)}`),
    rowNumber:productLinkImportLiczba(item.rowNumber||item.row||item.line,index+1),
    name:String(item.name||item.productName||item.nazwa||""),
    url:String(item.url||item.link||item.sourceUrl||""),
    status:productLinkImportStatus(item.status),
    attempts:productLinkImportLiczba(item.attempts||item.proby,0),
    productId:item.productId??item.addedProductId??null,
    duplicateProductId:item.duplicateProductId??item.existingProductId??null,
    reason:String(item.reason||item.message||""),error:String(item.error||"")
  };
}
function productLinkImportScalElementy(incoming,replace=false){
  const list=Array.isArray(incoming)?incoming:[];
  if(replace){productLinkImportStan.items=list.map(productLinkImportNormalizujElement);return;}
  const merged=new Map(productLinkImportStan.items.map((item,index)=>[productLinkImportKluczElementu(item)||`old-${index}`,item]));
  list.forEach((raw,index)=>{const item=productLinkImportNormalizujElement(raw,index),key=productLinkImportKluczElementu(item)||`new-${index}`;merged.set(key,{...(merged.get(key)||{}),...item});});
  productLinkImportStan.items=[...merged.values()].sort((a,b)=>a.rowNumber-b.rowNumber);
}
function productLinkImportScalOdpowiedz(data={}){
  const job=data.job||data.importJob||{},id=job.id||job.jobId||data.jobId||productLinkImportStan.jobId;
  if(id){productLinkImportStan.jobId=String(id);productLinkImportStan.statusLoadedFor=String(id);}
  productLinkImportStan.job={...(productLinkImportStan.job||{}),...job,id:String(id||""),state:productLinkImportStanZadania(job.state||job.status||data.state||productLinkImportStan.job?.state)};
  productLinkImportStan.fileName=String(job.fileName||data.fileName||productLinkImportStan.fileName||"");
  if(Array.isArray(data.items))productLinkImportScalElementy(data.items,true);
  else if(Array.isArray(job.items))productLinkImportScalElementy(job.items,true);
  if(data.processedItem)productLinkImportScalElementy([data.processedItem]);
  productLinkImportStan.summary={...(productLinkImportStan.summary||{}),...(job.summary||{}),...(data.summary||{})};
  if(data.processedItem)productLinkImportStan.lastStepAt=Date.now();
  for(const id of [...productLinkImportStan.reviewSelected]){const current=productLinkImportStan.items.find(item=>String(item.id)===String(id));if(!current||productLinkImportStatus(current.status)!=="needs_review")productLinkImportStan.reviewSelected.delete(id);}
  productLinkImportStan.error="";productLinkImportZapiszPamiec();
  return productLinkImportStan.job;
}
function productLinkImportPodsumowanie(){
  const source=productLinkImportStan.summary||{},items=productLinkImportStan.items;
  const count=status=>items.filter(item=>productLinkImportStatus(item.status)===status).length;
  const total=productLinkImportLiczba(source.total,productLinkImportLiczba(productLinkImportStan.job?.total,items.length||productLinkImportStan.parsedRows.length));
  const invalid=productLinkImportStan.analysisItems.filter(item=>item.status==="invalid_file").length,duplicates=productLinkImportStan.analysisItems.filter(item=>item.status==="duplicate_file").length,result={
    total,queued:productLinkImportLiczba(source.queued,count("queued")),processing:productLinkImportLiczba(source.processing,count("processing")),
    added:productLinkImportLiczba(source.added,count("added")),skipped_existing:productLinkImportLiczba(source.skipped_existing,count("skipped_existing")),
    needs_review:productLinkImportLiczba(source.needs_review,count("needs_review")),failed:productLinkImportLiczba(source.failed,count("failed")),
    cancelled:productLinkImportLiczba(source.cancelled,count("cancelled")),invalid_file:invalid,duplicate_file:duplicates
  };
  result.processed=productLinkImportLiczba(source.processed,result.added+result.skipped_existing+result.needs_review+result.failed+result.cancelled);
  result.percent=Math.max(0,Math.min(100,productLinkImportLiczba(source.percent,total?Math.round(result.processed/total*100):0)));
  result.fileTotal=total+invalid+duplicates;result.fileRejected=invalid+duplicates;
  return result;
}
function productLinkImportAktywne(){return !!productLinkImportStan.jobId&&!PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||"");}
function productLinkImportEtykietaStatusu(status){
  return ({queued:"Oczekuje",processing:"Pobieranie",added:"Dodano",skipped_existing:"Pominięto — istnieje",needs_review:"Do decyzji",failed:"Błąd",cancelled:"Anulowano",invalid_file:"Błędny wiersz pliku",duplicate_file:"Duplikat w pliku"})[productLinkImportStatus(status)]||String(status||"Oczekuje");
}
function productLinkImportIkonaStatusu(status){return ({queued:"○",processing:"↻",added:"✓",skipped_existing:"↪",needs_review:"!",failed:"×",cancelled:"−",invalid_file:"×",duplicate_file:"↪"})[productLinkImportStatus(status)]||"○";}
function productLinkImportRozpoznajWiersze(parsed){
  const source=Array.isArray(parsed)?parsed:(parsed?.rows||parsed?.links||parsed?.items||[]);
  return source.map((raw,index)=>{
    if(typeof raw==="string")return {rowNumber:index+1,name:"",url:raw.trim()};
    return {rowNumber:productLinkImportLiczba(raw?.rowNumber||raw?.row||raw?.line,index+1),name:String(raw?.name||raw?.nazwa||raw?.productName||"").trim(),url:String(raw?.url||raw?.link||raw?.sourceUrl||"").trim()};
  }).filter(row=>/^https?:\/\//i.test(row.url));
}
function productLinkImportRozpoznajOdrzucone(parsed){
  const invalid=(Array.isArray(parsed?.invalid)?parsed.invalid:[]).map((raw,index)=>productLinkImportNormalizujElement({id:`analysis-invalid-${raw?.rowNumber||index+1}-${index}`,rowNumber:raw?.rowNumber||index+1,name:raw?.name||"",url:raw?.value||raw?.url||"",status:"invalid_file",reason:raw?.reason||raw?.code||"Nieprawidłowy link — nie wysłano do kolejki."},index));
  const duplicates=(Array.isArray(parsed?.duplicates)?parsed.duplicates:[]).map((raw,index)=>productLinkImportNormalizujElement({id:`analysis-duplicate-${raw?.rowNumber||index+1}-${index}`,rowNumber:raw?.rowNumber||index+1,name:raw?.name||"",url:raw?.url||raw?.value||"",status:"duplicate_file",reason:raw?.duplicateOfRow?`Ten sam link występuje już w wierszu ${raw.duplicateOfRow} — nie wysłano ponownie.`:"Powtórzony link w pliku — nie wysłano ponownie."},index));
  return [...invalid,...duplicates].sort((a,b)=>a.rowNumber-b.rowNumber);
}
function productLinkImportWszystkieElementy(){return [...productLinkImportStan.items,...productLinkImportStan.analysisItems].sort((a,b)=>a.rowNumber-b.rowNumber);}

async function productLinkImportWczytajPlik(file){
  if(!file||productLinkImportAktywne())return;
  productLinkImportStan.parsing=true;productLinkImportStan.error="";productLinkImportStan.notice="Analizuję kolumny i linki…";productLinkImportStan.fileName=String(file.name||"plik-linkow");
  productLinkImportOdswiezDOM();
  try{
    const parsed=await parseProductLinksFile(file,{fileName:productLinkImportStan.fileName}),rows=productLinkImportRozpoznajWiersze(parsed),analysisItems=productLinkImportRozpoznajOdrzucone(parsed);
    if(!rows.length&&!analysisItems.length)throw new Error("Nie znaleziono adresów produktów w pliku.");
    productLinkImportStan.jobId="";productLinkImportStan.job=null;productLinkImportStan.summary=null;productLinkImportStan.parsedRows=rows;
    productLinkImportStan.items=rows.map((row,index)=>productLinkImportNormalizujElement({...row,id:`preview-${index+1}`,status:"queued"},index));
    productLinkImportStan.analysisItems=analysisItems;productLinkImportStan.page=1;productLinkImportStan.notice=rows.length?`Gotowe: ${rows.length} ${rows.length===1?"poprawny link":"poprawnych linków"}${analysisItems.length?` • ${analysisItems.length} pozycji odrzuconych pokazano w raporcie`:""}. Import zapisze każdy produkt bezpośrednio po jego sprawdzeniu.`:`Nie znaleziono poprawnych linków. ${analysisItems.length} odrzuconych pozycji pokazano poniżej — popraw plik przed uruchomieniem importu.`;
    productLinkImportZapiszPamiec();
  }catch(error){productLinkImportStan.error=error?.message||String(error);productLinkImportStan.notice="";productLinkImportStan.parsedRows=[];productLinkImportStan.items=[];productLinkImportStan.analysisItems=[];}
  finally{productLinkImportStan.parsing=false;productLinkImportOdswiezDOM();}
}
function productLinkImportWybranoPlik(input){const file=input?.files?.[0];if(file)void productLinkImportWczytajPlik(file);}
function productLinkImportPrzeciagnij(event){event.preventDefault();event.currentTarget?.classList.add("is-dragging");}
function productLinkImportOpusc(event){event.preventDefault();event.currentTarget?.classList.remove("is-dragging");}
function productLinkImportUpusc(event){event.preventDefault();event.currentTarget?.classList.remove("is-dragging");const file=event.dataTransfer?.files?.[0];if(file)void productLinkImportWczytajPlik(file);}

async function productLinkImportUtworz(){
  if(productLinkImportStan.creating||productLinkImportStan.loopActive||!productLinkImportStan.parsedRows.length)return;
  productLinkImportStan.creating=true;productLinkImportStan.error="";productLinkImportStan.notice="Tworzę bezpieczną kolejkę na serwerze…";productLinkImportOdswiezDOM();
  try{
    const response=await chmura("product-link-import-create",{method:"POST",body:{fileName:productLinkImportStan.fileName,rows:productLinkImportStan.parsedRows},timeout:60000});
    productLinkImportScalOdpowiedz(response);productLinkImportStan.startedLocallyAt=Date.now();productLinkImportStan.notice="Kolejka uruchomiona. Produkty są dodawane pojedynczo i od razu zapisywane.";
    void productLinkImportPetla();
  }catch(error){productLinkImportStan.error=error?.message||String(error);productLinkImportStan.notice="Nie uruchomiono importu — żaden produkt nie został zmieniony.";}
  finally{productLinkImportStan.creating=false;productLinkImportOdswiezDOM();}
}
async function productLinkImportPetla(){
  if(productLinkImportStan.loopActive||!productLinkImportStan.jobId)return;
  productLinkImportStan.loopActive=true;productLinkImportStan.pauseRequested=false;productLinkImportStan.cancelRequested=false;productLinkImportOdswiezDOM();
  let busyDelay=1200;
  try{
    while(productLinkImportStan.loopActive&&!productLinkImportStan.pauseRequested&&!productLinkImportStan.cancelRequested){
      if(PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||""))break;
      const response=await chmura("product-link-import-process-next",{method:"POST",body:{jobId:productLinkImportStan.jobId},timeout:120000});
      productLinkImportScalOdpowiedz(response);productLinkImportOdswiezDOM();
      if(response.done||PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||""))break;
      if(response.busy){productLinkImportStan.notice="Bieżący link jest jeszcze kończony przez serwer. Kolejka wznowi się automatycznie.";productLinkImportOdswiezDOM();await productLinkImportCzekaj(busyDelay);busyDelay=Math.min(5000,Math.round(busyDelay*1.6));continue;}
      busyDelay=1200;if(!response.processedItem)break;
    }
  }catch(error){if(!productLinkImportWyczyscStareZadanie(error)){productLinkImportStan.error=error?.message||String(error);productLinkImportStan.notice="Import zatrzymano bez cofania zapisanych produktów. Możesz bezpiecznie wznowić kolejkę.";}}
  finally{
    productLinkImportStan.loopActive=false;productLinkImportOdswiezDOM();
    if(PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||"")){
      await chmuraWczytajStan().catch(()=>false);
      zbudujProdukty();
    }
    if(!PRODUCT_LINK_IMPORT_TERMINAL_STATES.has(productLinkImportStan.job?.state||"")){
      if(productLinkImportStan.cancelRequested)void productLinkImportSteruj("cancel");
      else if(productLinkImportStan.pauseRequested)void productLinkImportSteruj("pause");
    }
  }
}
async function productLinkImportSteruj(command){
  if(!productLinkImportStan.jobId)return;
  if(command==="pause"){productLinkImportStan.pauseRequested=true;productLinkImportStan.notice="Pauza nastąpi po zakończeniu obecnie przetwarzanego linku.";}
  if(command==="cancel"){productLinkImportStan.cancelRequested=true;productLinkImportStan.notice="Anulowanie nastąpi po zakończeniu obecnego linku. Dodane produkty pozostaną zapisane.";}
  productLinkImportOdswiezDOM();
  try{
    const response=await chmura("product-link-import-control",{method:"POST",body:{jobId:productLinkImportStan.jobId,command},timeout:30000});
    productLinkImportScalOdpowiedz(response);
    if(command==="resume"){productLinkImportStan.pauseRequested=false;productLinkImportStan.cancelRequested=false;productLinkImportStan.notice="Wznowiono od pierwszego nieprzetworzonego linku.";void productLinkImportPetla();}
    else if(command==="retry_failures"){productLinkImportStan.notice="Błędne pozycje wróciły do kolejki.";void productLinkImportPetla();}
  }catch(error){if(!productLinkImportWyczyscStareZadanie(error))productLinkImportStan.error=error?.message||String(error);if(command==="pause")productLinkImportStan.pauseRequested=false;if(command==="cancel")productLinkImportStan.cancelRequested=false;}
  finally{productLinkImportOdswiezDOM();}
}
function productLinkImportPauza(){
  productLinkImportStan.pauseRequested=true;productLinkImportStan.notice="Pauza nastąpi po zakończeniu obecnie przetwarzanego linku.";productLinkImportOdswiezDOM();
  if(!productLinkImportStan.loopActive)void productLinkImportSteruj("pause");
}
function productLinkImportWznow(){void productLinkImportSteruj("resume");}
function productLinkImportAnuluj(){
  productLinkImportStan.cancelRequested=true;productLinkImportStan.notice="Anulowanie nastąpi po zakończeniu obecnego linku. Dodane produkty pozostaną zapisane.";productLinkImportOdswiezDOM();
  if(!productLinkImportStan.loopActive)void productLinkImportSteruj("cancel");
}
function productLinkImportPonowBledy(){void productLinkImportSteruj("retry_failures");}
async function productLinkImportPobierzStatus(autoResume=false){
  if(!productLinkImportStan.jobId||productLinkImportStan.statusLoading)return;
  productLinkImportStan.statusLoading=true;productLinkImportOdswiezDOM();
  try{
    const response=await chmura("product-link-import-status",{params:{jobId:productLinkImportStan.jobId},timeout:30000});
    productLinkImportScalOdpowiedz(response);
    if(autoResume&&productLinkImportStan.job?.state==="running")void productLinkImportPetla();
  }catch(error){if(!productLinkImportWyczyscStareZadanie(error))productLinkImportStan.error=error?.message||String(error);}
  finally{productLinkImportStan.statusLoading=false;productLinkImportOdswiezDOM();}
}

function productLinkImportElementyPoFiltrze(){
  const q=String(productLinkImportStan.query||"").trim().toLowerCase(),filter=productLinkImportStan.filter;
  return productLinkImportWszystkieElementy().filter(item=>{const status=productLinkImportStatus(item.status),statusMatch=filter==="all"||status===filter||(filter==="file_rejected"&&["invalid_file","duplicate_file"].includes(status));return statusMatch&&(!q||[item.rowNumber,item.name,item.url,item.productId,item.duplicateProductId,item.reason,item.error].join(" ").toLowerCase().includes(q));});
}
function productLinkImportUstawFiltr(value){productLinkImportStan.filter=String(value||"all");productLinkImportStan.page=1;productLinkImportOdswiezDOM();}
function productLinkImportSzukaj(input){productLinkImportStan.query=String(input?.value||"");productLinkImportStan.page=1;productLinkImportOdswiezTabele();}
function productLinkImportUstawStrone(page){productLinkImportStan.page=Math.max(1,Number(page)||1);productLinkImportOdswiezTabele();document.querySelector("[data-product-link-results]")?.scrollIntoView({behavior:"smooth",block:"start"});}
function productLinkImportUstawRozmiar(value){const size=Number(value);productLinkImportStan.pageSize=PRODUCT_LINK_IMPORT_PAGE_SIZES.includes(size)?size:50;productLinkImportStan.page=1;productLinkImportOdswiezTabele();}
function productLinkImportCSVBezpieczne(value){const text=String(value??"");return /^[\s]*[=+\-@]/.test(text)?`'${text}`:text;}
function productLinkImportEksportujRaport(){
  const rows=productLinkImportWszystkieElementy().map(item=>[item.rowNumber,item.name,item.url,productLinkImportEtykietaStatusu(item.status),item.productId||item.duplicateProductId||"",item.attempts,item.error||item.reason||""].map(productLinkImportCSVBezpieczne));
  if(typeof adminEksportujCSV==="function")adminEksportujCSV(`import-linkow-${new Date().toISOString().slice(0,10)}.csv`,["Wiersz","Nazwa","Link","Status","ID produktu","Próby","Informacja"],rows);
}
function productLinkImportCzasPozostaly(summary){
  const completed=summary.processed,remaining=Math.max(0,summary.total-completed),elapsed=(Date.now()-(productLinkImportStan.startedLocallyAt||Date.now()))/1000;
  if(!completed||elapsed<1||!remaining)return remaining?"czas pojawi się po pierwszych produktach":"zakończono";
  const seconds=Math.round(elapsed/completed*remaining);if(seconds<60)return `około ${seconds} s`;if(seconds<3600)return `około ${Math.ceil(seconds/60)} min`;return `około ${Math.ceil(seconds/3600)} godz.`;
}
function productLinkImportReviewDraft(item={}){
  const draft=item.reviewDraft&&typeof item.reviewDraft==="object"?item.reviewDraft:{};
  const rawName=String(draft.nazwa||item.name||"").trim(),placeholderName=/^\(?\s*brak nazwy\s*\)?$/i.test(rawName)?"":rawName;
  return {...draft,nazwa:placeholderName,sourceUrl:draft.sourceUrl||item.url||"",producentUrl:draft.producentUrl||item.url||""};
}
function productLinkImportReviewBraki(item={}){
  const stored=Array.isArray(item.missingFields)?item.missingFields.filter(Boolean):[];
  if(stored.length)return stored;
  const d=productLinkImportReviewDraft(item),reason=String(item.reason||item.error||"").toLowerCase(),out=[];
  if(!String(d.nazwa||"").trim()||/nazw/.test(reason))out.push("nazwa");
  if(!(Number(d.cena)>0)||/cen/.test(reason))out.push("cena sprzedaży");
  if(/producent|mark/.test(reason))out.push("producent lub marka");
  if(/kategori/.test(reason))out.push("kategoria sklepu");
  if(!reason){if(!String(d.producent||d.marka||"").trim())out.push("producent lub marka");if(!String(d.kategoria||"").trim())out.push("kategoria sklepu");}
  return [...new Set(out)];
}
function productLinkImportReviewFormHTML(item={}){
  const d=productLinkImportReviewDraft(item),missing=productLinkImportReviewBraki(item),brak=field=>missing.some(value=>String(value).toLowerCase().includes(field)),wymagane=field=>brak(field)?" required":"",gwiazdka=field=>brak(field)?" *":"";
  return `<details class="product-link-review-editor"><summary><span>✏️ Uzupełnij dane produktu</span><em>${missing.length?`Brakuje: ${esc(missing.join(", "))}`:"Szkic gotowy do zatwierdzenia"}</em></summary><form onsubmit="return productLinkImportZapiszDecyzje(event,${jsArg(item.id)})"><div class="product-link-review-primary"><label class="${brak("cena")?"is-required":""}"><span>Cena sprzedaży brutto${gwiazdka("cena")}</span><input name="cena" inputmode="decimal" value="${esc(Number(d.cena)>0?d.cena:"")}" placeholder="np. 29,90"${wymagane("cena")}></label><label class="${brak("nazwa")?"is-required":""}"><span>Nazwa produktu${gwiazdka("nazwa")}</span><input name="nazwa" value="${esc(d.nazwa||"")}"${wymagane("nazwa")}></label><label class="${brak("producent")?"is-required":""}"><span>Producent / marka${gwiazdka("producent")}</span><input name="producent" value="${esc(d.producent||d.marka||"")}"${wymagane("producent")}></label><label class="${brak("kategoria")?"is-required":""}"><span>Kategoria sklepu${gwiazdka("kategoria")}</span><input name="kategoria" value="${esc(d.kategoria||"")}"${wymagane("kategoria")}></label></div><details class="product-link-review-more"><summary>Więcej danych do poprawy</summary><div><label><span>EAN / GTIN</span><input name="ean" value="${esc(d.ean||d.gtin||"")}"></label><label><span>EXTERNAL_ID / SKU</span><input name="externalId" value="${esc(d.externalId||d.sku||"")}"></label><label><span>Kod producenta</span><input name="kodProducenta" value="${esc(d.kodProducenta||d.mpn||"")}"></label><label><span>Główne zdjęcie</span><input name="zdjecie" value="${esc(d.zdjecie||"")}" placeholder="https://…"></label><label><span>Emoji</span><input name="ikona" value="${esc(d.ikona||"🎲")}" maxlength="20"></label><label><span>Kolor karty</span><input name="kolor" type="color" value="${/^#[0-9a-f]{6}$/i.test(String(d.kolor||""))?esc(d.kolor):"#dbeafe"}"></label><label class="wide"><span>Krótki opis</span><textarea name="opisKrotki" rows="2">${esc(d.opisKrotki||"")}</textarea></label><label class="wide"><span>Pełny opis</span><textarea name="opis" rows="5">${esc(d.opis||"")}</textarea></label></div></details><footer><small>System ponownie sprawdzi link, połączy pobrane dane z Twoimi zmianami i doda produkt tylko wtedy, gdy wszystkie wymagane pola będą kompletne.</small><button class="btn" type="submit" ${productLinkImportStan.reviewBusy?"disabled":""}>✅ Zapisz decyzję i dodaj produkt</button></footer></form></details>`;
}
function productLinkImportPatchZFormularza(form){
  const data=new FormData(form),patch={};for(const field of ["cena","nazwa","producent","marka","kategoria","ean","externalId","kodProducenta","zdjecie","ikona","kolor","opisKrotki","opis"]){const value=String(data.get(field)||"").trim();if(data.has(field)&&value)patch[field]=value;}return patch;
}
async function productLinkImportRozstrzygnij(items,commonPatch={},message="Zapisuję decyzję…"){
  if(productLinkImportStan.reviewBusy||!productLinkImportStan.jobId||!items.length)return false;
  productLinkImportStan.reviewBusy=true;productLinkImportStan.error="";productLinkImportStan.notice=message;productLinkImportOdswiezDOM();
  let completed=0,resolved=0,stillNeedsReview=0;
  try{
    const chunks=[];for(let index=0;index<items.length;index+=10)chunks.push(items.slice(index,index+10));
    for(const chunk of chunks){productLinkImportStan.notice=`${message} ${completed}/${items.length}`;productLinkImportOdswiezDOM();const response=await chmura("product-link-import-review-resolve",{method:"POST",body:{jobId:productLinkImportStan.jobId,items:chunk,commonPatch},timeout:180000});productLinkImportScalOdpowiedz(response);completed+=chunk.length;resolved+=Number(response.resolved)||0;stillNeedsReview+=Number(response.stillNeedsReview)||0;}
    await chmuraWczytajStan().catch(()=>false);zbudujProdukty();
    productLinkImportStan.notice=`Decyzje zapisane: dodano lub połączono ${resolved}${stillNeedsReview?` • nadal wymaga danych ${stillNeedsReview}`:""}.`;
    toast(`✅ Uzupełniono ${resolved} produktów${stillNeedsReview?` • ${stillNeedsReview} nadal do decyzji`:""}`);return true;
  }catch(error){await productLinkImportPobierzStatus(false).catch(()=>false);productLinkImportStan.error=completed?`Zapisano ${completed} z ${items.length} pozycji. Pozostałe nie zostały zmienione: ${error?.message||String(error)}`:error?.message||String(error);productLinkImportStan.notice=completed?"Operację można bezpiecznie ponowić dla pozostałych zaznaczonych produktów.":"Nie zapisano decyzji.";return false;}
  finally{productLinkImportStan.reviewBusy=false;productLinkImportOdswiezDOM();}
}
function productLinkImportZapiszDecyzje(event,itemId){event.preventDefault();const form=event.currentTarget,patch=productLinkImportPatchZFormularza(form);void productLinkImportRozstrzygnij([{itemId:String(itemId),patch}],{},"Sprawdzam link i zapisuję decyzję dla produktu…");return false;}
function productLinkImportZaznaczReview(itemId,checked){const id=String(itemId);if(checked)productLinkImportStan.reviewSelected.add(id);else productLinkImportStan.reviewSelected.delete(id);productLinkImportOdswiezReviewToolbar();}
function productLinkImportWidoczneReview(){return productLinkImportElementyPoFiltrze().filter(item=>productLinkImportStatus(item.status)==="needs_review");}
function productLinkImportZaznaczWidoczneReview(checked=true){const review=productLinkImportWidoczneReview();if(checked&&review.length>200)toast("Zaznaczono pierwsze 200 produktów — to bezpieczny limit jednej operacji");review.slice(0,200).forEach(item=>checked?productLinkImportStan.reviewSelected.add(String(item.id)):productLinkImportStan.reviewSelected.delete(String(item.id)));if(!checked)review.forEach(item=>productLinkImportStan.reviewSelected.delete(String(item.id)));productLinkImportOdswiezTabele();productLinkImportOdswiezReviewToolbar();}
function productLinkImportOdswiezReviewToolbar(){const root=document.querySelector("[data-product-link-review-bulk]");if(!root)return;const count=[...productLinkImportStan.reviewSelected].filter(id=>productLinkImportStan.items.some(item=>String(item.id)===id&&productLinkImportStatus(item.status)==="needs_review")).length;root.querySelector("[data-review-selected]")?.replaceChildren(document.createTextNode(String(count)));const submit=root.querySelector('button[type="submit"]');if(submit)submit.disabled=!count||productLinkImportStan.reviewBusy;}
function productLinkImportMasowaDecyzja(event){event.preventDefault();const form=event.currentTarget,patch=productLinkImportPatchZFormularza(form),hasValue=Object.entries(patch).some(([field,value])=>field==="cena"?Number(String(value).replace(",","."))>0:String(value).trim());if(!hasValue){toast("Wpisz co najmniej jedną wspólną wartość");return false;}const items=[...productLinkImportStan.reviewSelected].map(itemId=>({itemId,patch:{}}));void productLinkImportRozstrzygnij(items,patch,"Stosuję wspólne dane i sprawdzam zaznaczone produkty…");return false;}
function productLinkImportMasowaDecyzjaHTML(summary){
  const selected=productLinkImportStan.reviewSelected.size;
  return `<section class="product-link-review-bulk" data-product-link-review-bulk ${summary.needs_review?"":"hidden"}><header><div><span class="order-pro-label">Operacja masowa</span><h3>🧩 Uzupełnij zaznaczone produkty</h3><small>Wypełnij tylko pola, które mają otrzymać wspólną wartość. Pozostałe dane każdego produktu zostaną zachowane. Jedna operacja obsługuje do 200 pozycji.</small></div><div><button class="btn ghost" type="button" onclick="productLinkImportZaznaczWidoczneReview(true)">Zaznacz wszystkie w filtrze</button><button class="btn ghost" type="button" onclick="productLinkImportZaznaczWidoczneReview(false)">Odznacz</button><b><span data-review-selected>${selected}</span> zaznaczonych</b></div></header><form onsubmit="return productLinkImportMasowaDecyzja(event)"><label><span>Wspólna cena brutto</span><input name="cena" inputmode="decimal" placeholder="np. 29,90"></label><label><span>Wspólny producent</span><input name="producent" placeholder="np. Alexander"></label><label><span>Wspólna kategoria</span><input name="kategoria" placeholder="np. Gry edukacyjne"></label><label><span>Wspólne emoji</span><input name="ikona" placeholder="🎈"></label><label><span>Wspólny kolor</span><input name="kolor" placeholder="#dbeafe"></label><button class="btn" type="submit" ${!selected||productLinkImportStan.reviewBusy?"disabled":""}>Zastosuj i dodaj gotowe</button></form></section>`;
}
function productLinkImportWierszeHTML(){
  const filtered=productLinkImportElementyPoFiltrze(),pages=Math.max(1,Math.ceil(filtered.length/productLinkImportStan.pageSize));
  productLinkImportStan.page=Math.min(productLinkImportStan.page,pages);const start=(productLinkImportStan.page-1)*productLinkImportStan.pageSize,rows=filtered.slice(start,start+productLinkImportStan.pageSize);
  return `${rows.map(item=>{const status=productLinkImportStatus(item.status),productId=item.productId||item.duplicateProductId,link=/^https?:\/\//i.test(item.url)?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a>`:`<span class="product-link-import-raw-value">${esc(item.url||"brak adresu")}</span>`,review=status==="needs_review";return `<tr data-import-row="${esc(item.id)}" class="status-${esc(status)}"><td>${review?`<label class="product-link-review-check"><input type="checkbox" ${productLinkImportStan.reviewSelected.has(String(item.id))?"checked":""} onchange="productLinkImportZaznaczReview(${jsArg(item.id)},this.checked)"><span>${esc(item.rowNumber)}</span></label>`:`<b>${esc(item.rowNumber)}</b>`}</td><td><div class="product-link-import-name"><b>${esc(productLinkImportReviewDraft(item).nazwa||"Nazwa zostanie pobrana ze źródła")}</b>${link}</div></td><td><span class="product-link-import-status ${esc(status)}">${productLinkImportIkonaStatusu(status)} ${esc(productLinkImportEtykietaStatusu(status))}</span>${item.attempts?`<small>${esc(item.attempts)} ${item.attempts===1?"próba":"próby"}</small>`:""}</td><td>${productId?`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(productId)}">Produkt #${esc(productId)}</a>`:review?`<span class="lvl lvl-ostrzezenie">czeka na dane</span>`:"—"}</td><td><small>${esc(item.error||item.reason||"")}</small></td></tr>${review?`<tr class="product-link-review-row"><td colspan="5">${productLinkImportReviewFormHTML(item)}</td></tr>`:""}`;}).join("")||`<tr><td colspan="5"><div class="product-link-import-empty">Brak pozycji w wybranym filtrze.</div></td></tr>`}<tr class="product-link-import-pagination-row"><td colspan="5"><div class="product-link-import-pagination"><span>Wyniki ${filtered.length?start+1:0}–${Math.min(start+productLinkImportStan.pageSize,filtered.length)} z ${filtered.length}</span><div><button class="btn ghost" type="button" onclick="productLinkImportUstawStrone(${productLinkImportStan.page-1})" ${productLinkImportStan.page<=1?"disabled":""}>←</button><b>Strona ${productLinkImportStan.page} / ${pages}</b><button class="btn ghost" type="button" onclick="productLinkImportUstawStrone(${productLinkImportStan.page+1})" ${productLinkImportStan.page>=pages?"disabled":""}>→</button></div></div></td></tr>`;
}
function productLinkImportOdswiezTabele(){
  const body=document.querySelector("[data-product-link-table-body]");if(body)body.innerHTML=productLinkImportWierszeHTML();
  const count=document.querySelector("[data-product-link-visible]");if(count)count.textContent=String(productLinkImportElementyPoFiltrze().length);
  productLinkImportOdswiezReviewToolbar();
}
function productLinkImportOdswiezDOM(){
  const root=document.querySelector("[data-product-link-import-page]");if(!root)return;
  const summary=productLinkImportPodsumowanie(),jobState=productLinkImportStan.job?.state||"",active=productLinkImportAktywne(),paused=jobState==="paused"||productLinkImportStan.pauseRequested,done=jobState==="completed",cancelled=jobState==="cancelled";
  [["total",summary.fileTotal],["added",summary.added],["skipped",summary.skipped_existing],["review",summary.needs_review],["failed",summary.failed],["rejected",summary.fileRejected]].forEach(([key,value])=>{const el=root.querySelector(`[data-import-count="${key}"]`);if(el)el.textContent=String(value);});
  const bar=root.querySelector("[data-product-link-progress-bar]");if(bar){bar.style.width=`${summary.percent}%`;bar.parentElement?.setAttribute("aria-valuenow",String(summary.percent));}
  const progress=root.querySelector("[data-product-link-progress-text]");if(progress)progress.textContent=`${summary.processed} z ${summary.total} • ${summary.percent}%`;
  const eta=root.querySelector("[data-product-link-eta]");if(eta)eta.textContent=productLinkImportCzasPozostaly(summary);
  const current=productLinkImportStan.items.find(item=>item.status==="processing")||productLinkImportStan.items.find(item=>item.id===productLinkImportStan.job?.currentItemId);
  const currentBox=root.querySelector("[data-product-link-current]");if(currentBox)currentBox.innerHTML=current?`<span>Teraz przetwarzam wiersz ${esc(current.rowNumber)}</span><b>${esc(current.name||"Produkt ze wskazanego linku")}</b><small>${esc(current.url)}</small>`:`<span>${done?"Import zakończony":cancelled?"Import anulowany":paused?"Kolejka wstrzymana":"Gotowy do pracy"}</span><b>${done?`${summary.added} produktów dodano i zapisano`:cancelled?"Dodane wcześniej produkty pozostały w katalogu":paused?"Wznów, aby przejść do kolejnego linku":"Każdy produkt zapisuję od razu po sprawdzeniu"}</b>`;
  const notice=root.querySelector("[data-product-link-notice]");if(notice){notice.hidden=!(productLinkImportStan.notice||productLinkImportStan.error);notice.classList.toggle("is-error",!!productLinkImportStan.error);notice.setAttribute("role",productLinkImportStan.error?"alert":"status");notice.setAttribute("aria-live",productLinkImportStan.error?"assertive":"polite");notice.innerHTML=productLinkImportStan.error?`<b>Nie udało się wykonać operacji</b><span>${esc(productLinkImportStan.error)}</span>`:`<b>${done?"Import zakończony":"Stan kolejki"}</b><span>${esc(productLinkImportStan.notice)}</span>`;}
  const upload=root.querySelector("[data-product-link-dropzone]");if(upload)upload.classList.toggle("is-disabled",active||productLinkImportStan.parsing);
  const fileInput=root.querySelector("[data-product-link-file]");if(fileInput)fileInput.disabled=active||productLinkImportStan.parsing;
  const start=root.querySelector("[data-product-link-start]");if(start){start.disabled=!productLinkImportStan.parsedRows.length||!!productLinkImportStan.jobId||active||productLinkImportStan.creating;start.textContent=productLinkImportStan.creating?"Tworzę kolejkę…":done?"✓ Import zakończony":cancelled?"Import anulowany":"▶ Rozpocznij import";}
  const pause=root.querySelector("[data-product-link-pause]");if(pause){pause.hidden=!active||paused;pause.disabled=productLinkImportStan.pauseRequested;}
  const resume=root.querySelector("[data-product-link-resume]");if(resume){const canContinue=active&&!productLinkImportStan.loopActive&&!productLinkImportStan.statusLoading;resume.hidden=!(paused||canContinue);resume.textContent=paused?"▶ Wznów":"▶ Kontynuuj";}
  const cancel=root.querySelector("[data-product-link-cancel]");if(cancel){cancel.hidden=!active;cancel.disabled=productLinkImportStan.cancelRequested;}
  const retry=root.querySelector("[data-product-link-retry]");if(retry){retry.hidden=!summary.failed||active;retry.disabled=active;}
  const report=root.querySelector("[data-product-link-report]");if(report)report.disabled=!productLinkImportWszystkieElementy().length;
  const reviewBulk=root.querySelector("[data-product-link-review-bulk]");if(reviewBulk)reviewBulk.hidden=!summary.needs_review;
  root.querySelectorAll("[data-import-filter]").forEach(button=>{const activeFilter=button.dataset.importFilter===productLinkImportStan.filter;button.classList.toggle("active",activeFilter);button.setAttribute("aria-pressed",String(activeFilter));});
  const statusFilter=root.querySelector("[data-product-link-status-filter]");if(statusFilter)statusFilter.value=productLinkImportStan.filter;
  const fileMeta=root.querySelector("[data-product-link-file-meta]");if(fileMeta)fileMeta.innerHTML=productLinkImportStan.fileName?`<b>${esc(productLinkImportStan.fileName)}</b><span>${esc(summary.fileTotal||productLinkImportStan.parsedRows.length)} przeanalizowanych wierszy • ${esc(summary.total)} poprawnych do kolejki${summary.fileRejected?` • ${esc(summary.fileRejected)} odrzuconych`:""}</span>`:`<b>Wybierz arkusz lub plik tekstowy</b><span>Obsługiwane: XLSX, CSV i TXT</span>`;
  productLinkImportOdswiezTabele();
}
function productLinkImportPoRenderze(){
  productLinkImportOdswiezDOM();
  if(productLinkImportStan.jobId&&productLinkImportStan.statusLoadedFor!==productLinkImportStan.jobId)void productLinkImportPobierzStatus(true);
}

function widokAdminProduktyZPliku(){
  productLinkImportWczytajPamiec();setTimeout(productLinkImportPoRenderze,0);
  const summary=productLinkImportPodsumowanie();
  return asortymentSzkielet("produkty",`<section class="product-link-file-import-page" data-product-link-import-page>
    <div class="panel product-link-import-hero">
      <div class="crumb"><a href="#/admin/asortyment/produkty">Produkty</a> › Dodawanie › Z pliku linków</div>
      <div class="product-link-import-hero-row"><div><span class="order-pro-label">Automatyczne dodawanie pojedynczo</span><h1>📄 Produkty z pliku linków</h1><p>Wczytaj jeden plik z linkami różnych producentów i dostawców. System rozpozna źródło osobno dla każdego wiersza, pobierze pełne dane, sprawdzi duplikat i natychmiast zapisze gotowy produkt przed przejściem do kolejnego.</p></div><span class="product-link-import-safety">🛡️ jeden link = jedno rozpoznane źródło</span></div>
      <nav class="product-link-import-local-nav" aria-label="Sposób dodawania produktu"><a href="#/admin/produkty/dodaj">✍️ Ręcznie lub z jednego linku</a><a class="active" href="#/admin/produkty/z-pliku" aria-current="page">📄 Z pliku linków</a></nav>
    </div>
    <div class="panel product-link-import-upload-panel">
      <div class="order-section-head"><div><span class="order-pro-label">Krok 1</span><h2>Wybierz plik z linkami</h2><p>Kolumna „Link do produktu” zostanie rozpoznana automatycznie. Pozostałe kolumny, np. nazwa i numer wiersza, posłużą do czytelnego raportu.</p></div></div>
      <label class="product-link-import-dropzone" data-product-link-dropzone ondragover="productLinkImportPrzeciagnij(event)" ondragleave="productLinkImportOpusc(event)" ondrop="productLinkImportUpusc(event)">
        <input data-product-link-file type="file" accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" aria-label="Wybierz plik XLSX, CSV lub TXT z linkami produktów" aria-describedby="productLinkImportFileMeta" onchange="productLinkImportWybranoPlik(this)">
        <span class="product-link-import-drop-icon" aria-hidden="true">⇧</span><span id="productLinkImportFileMeta" data-product-link-file-meta><b>Wybierz arkusz lub przeciągnij go tutaj</b><span>Obsługiwane: XLSX, CSV, TSV i TXT • linki mogą pochodzić z różnych źródeł</span></span><em>Wybierz plik</em>
      </label>
      <div class="product-link-import-notice" data-product-link-notice role="status" aria-live="polite" aria-atomic="true" hidden></div>
    </div>
    <div class="panel product-link-import-control-panel">
      <div class="order-section-head"><div><span class="order-pro-label">Krok 2</span><h2>Import sukcesywny</h2><p>Nie czekamy na koniec pliku. Każdy poprawny produkt jest zapisany natychmiast; pauza lub anulowanie nie cofa wcześniejszych pozycji.</p></div><div class="diag-actions"><button class="btn" data-product-link-start type="button" onclick="productLinkImportUtworz()" ${productLinkImportStan.parsedRows.length?"":"disabled"}>▶ Rozpocznij import</button><button class="btn ghost" data-product-link-pause type="button" onclick="productLinkImportPauza()" hidden>Ⅱ Pauza po bieżącym</button><button class="btn" data-product-link-resume type="button" onclick="productLinkImportWznow()" hidden>▶ Wznów</button><button class="btn danger" data-product-link-cancel type="button" onclick="productLinkImportAnuluj()" hidden>■ Anuluj po bieżącym</button></div></div>
      <div class="product-link-import-progress-layout"><div class="product-link-import-progress-card"><div><b data-product-link-progress-text>${summary.processed} z ${summary.total} • ${summary.percent}%</b><small>Szacowany pozostały czas: <span data-product-link-eta>czas pojawi się po pierwszych produktach</span></small></div><div class="product-link-import-progress" role="progressbar" aria-label="Postęp importu" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summary.percent}"><span data-product-link-progress-bar style="width:${summary.percent}%"></span></div></div><div class="product-link-import-current" data-product-link-current role="status" aria-live="polite" aria-atomic="true"><span>Gotowy do pracy</span><b>Każdy produkt zapisuję od razu po sprawdzeniu</b></div></div>
      <div class="orders-stat-grid product-link-import-stats">
        <button type="button" data-import-filter="all" aria-pressed="${productLinkImportStan.filter==="all"}" class="order-stat-card ${productLinkImportStan.filter==="all"?"active":""}" onclick="productLinkImportUstawFiltr('all')"><span>📚</span><b data-import-count="total">${summary.fileTotal}</b><small>wierszy pliku</small></button>
        <button type="button" data-import-filter="added" class="order-stat-card money ${productLinkImportStan.filter==="added"?"active":""}" onclick="productLinkImportUstawFiltr('added')"><span>✅</span><b data-import-count="added">${summary.added}</b><small>dodanych i zapisanych</small></button>
        <button type="button" data-import-filter="skipped_existing" class="order-stat-card ${productLinkImportStan.filter==="skipped_existing"?"active":""}" onclick="productLinkImportUstawFiltr('skipped_existing')"><span>↪️</span><b data-import-count="skipped">${summary.skipped_existing}</b><small>pominiętych duplikatów</small></button>
        <button type="button" data-import-filter="needs_review" class="order-stat-card ${productLinkImportStan.filter==="needs_review"?"active":""}" onclick="productLinkImportUstawFiltr('needs_review')"><span>🧐</span><b data-import-count="review">${summary.needs_review}</b><small>wymaga decyzji</small></button>
        <button type="button" data-import-filter="failed" class="order-stat-card hot ${productLinkImportStan.filter==="failed"?"active":""}" onclick="productLinkImportUstawFiltr('failed')"><span>⚠️</span><b data-import-count="failed">${summary.failed}</b><small>błędów do ponowienia</small></button>
        <button type="button" data-import-filter="file_rejected" class="order-stat-card hot ${productLinkImportStan.filter==="file_rejected"?"active":""}" onclick="productLinkImportUstawFiltr('file_rejected')"><span>🧾</span><b data-import-count="rejected">${summary.fileRejected}</b><small>odrzuconych przed kolejką</small></button>
      </div>
    </div>
    <div class="panel product-link-import-results" data-product-link-results>
      <div class="order-section-head"><div><span class="order-pro-label">Krok 3</span><h2>Wyniki i raport</h2><p>Pełna historia każdego wiersza. Duplikat nie tworzy nowej kartoteki i prowadzi bezpośrednio do istniejącego produktu.</p></div><div class="diag-actions"><button class="btn ghost" data-product-link-retry type="button" onclick="productLinkImportPonowBledy()" ${summary.failed?"":"hidden"}>↻ Ponów błędy</button><button class="btn ghost" data-product-link-report type="button" onclick="productLinkImportEksportujRaport()" ${productLinkImportWszystkieElementy().length?"":"disabled"}>⇩ Raport CSV</button></div></div>
      ${productLinkImportMasowaDecyzjaHTML(summary)}
      <div class="product-link-import-filters"><label><span>Szukaj</span><input type="search" placeholder="Nazwa, link, wiersz, ID lub błąd…" value="${esc(productLinkImportStan.query)}" oninput="productLinkImportSzukaj(this)"></label><label><span>Status</span><select data-product-link-status-filter onchange="productLinkImportUstawFiltr(this.value)">${[["all","Wszystkie statusy"],["queued","Oczekujące"],["processing","W trakcie"],["added","Dodane"],["skipped_existing","Duplikaty katalogu — pominięte"],["needs_review","Do decyzji"],["failed","Błędy pobierania"],["cancelled","Anulowane"],["file_rejected","Wszystkie odrzucone z pliku"],["invalid_file","Błędne wiersze pliku"],["duplicate_file","Duplikaty wewnątrz pliku"]].map(([value,label])=>`<option value="${value}" ${productLinkImportStan.filter===value?"selected":""}>${label}</option>`).join("")}</select></label><label><span>Na stronie</span><select onchange="productLinkImportUstawRozmiar(this.value)">${PRODUCT_LINK_IMPORT_PAGE_SIZES.map(value=>`<option value="${value}" ${productLinkImportStan.pageSize===value?"selected":""}>${value}</option>`).join("")}</select></label><div><span>Wyniki</span><b><span data-product-link-visible>${productLinkImportElementyPoFiltrze().length}</span> pozycji</b></div></div>
      <div class="product-link-import-table-wrap"><table class="log-table product-link-import-table"><thead><tr><th>Wiersz</th><th>Produkt i źródło</th><th>Status</th><th>Kartoteka</th><th>Informacja</th></tr></thead><tbody data-product-link-table-body>${productLinkImportWierszeHTML()}</tbody></table></div>
    </div>
  </section>`);
}
