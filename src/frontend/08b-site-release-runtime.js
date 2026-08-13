/* Centralna wersja robocza strony. Wszystkie publiczne zmiany przechodzą przez
   ten moduł niezależnie od podstrony panelu, na której zostały wykonane. */
const SITE_RELEASE_PUBLIC_SETTINGS=new Set([
  "nazwaSklepu","pasekInfo","pasekInfoKonfiguracja","czasWysylki","telefon","opisSklepu","emailSklepu","daneFirmy",
  "darmowaDostawaOd","kosztPaczkomat","kosztKurierInpost","kurierInpostAktywny","dostawy","platnosci",
  "oplataPobranie","pobranieWl","paynowWl","telefonWl","numerPrzelewuTelefon","linkPlatnosci","kody",
  "kodyRabatoweZaawansowane","promocjaGlowna","heroTytul","heroOpis","hero","pasekOkazji","tresci","uklad",
  "logoObraz","faviconObraz","tekstSzukaj","bannery","ofertaGlowna","kolejnoscSekcji","sekcjeUkryte","podstrony",
  "wlasneKategorie","rodziceKategorii","menuKategorii","kategorie","mapaProduktow","ukryteKategorie","ikonyKategorii","kanoniczneDuplikatySklepu",
  "menuPokazNieprzypisane","stopkaCopy"
]);
const SITE_RELEASE_PUBLIC_PRODUCT_FIELDS=new Set([
  "nazwa","name","opisKrotki","krotkiOpis","opis","kategoria","category","cena","staraCena","badge","zdjecie","zdjecia","warianty","ikona","kolor",
  "aktywny","ukryty","sprzedazAktywna","saleAvailable","seoTitle","seoDescription","seoKeywords"
]);
let siteReleaseAdminState=null,siteReleaseAdminLoading=null,siteReleaseLiveSettings=null,siteReleaseApplying=false;
let siteReleaseEditorPreviewPath="",siteReleaseEditorPreviewLoading=null;
function siteReleaseSettingsEmbedRequested(){try{return window.parent!==window&&new URLSearchParams(location.search).get("site_editor_settings")==="1";}catch(error){return false;}}
function siteReleaseNotifyEditorParent(state){if(!siteReleaseSettingsEmbedRequested())return;const section=String(location.hash||"").split("/personalizacja/")[1]?.split(/[?&]/)[0]||"wyglad";window.parent.postMessage({type:"artway-site-editor-settings-saved",section,state},location.origin);}
function siteReleaseSummary(){return siteReleaseAdminState?.draft?.summary||{settings:0,products:0,productFields:0};}
function siteReleaseStagingEnabled(){return !!(siteReleaseAdminState?.draft?.id&&siteReleaseAdminState.draft.mode!=="paused"&&!["publishing"].includes(siteReleaseAdminState.draft.status));}
function siteReleaseDraftHasChanges(){const s=siteReleaseSummary();return Number(s.settings)>0||Number(s.products)>0;}
function siteReleaseReapplyDraftSettings(){
  const draft=siteReleaseAdminState?.draft;if(!draft||!siteReleaseStagingEnabled()||siteReleaseApplying)return false;
  if(!siteReleaseLiveSettings)siteReleaseLiveSettings={...ustawienia};
  siteReleaseApplying=true;try{
    ustawienia={...siteReleaseLiveSettings,...(draft.settingsPatch||{})};for(const key of draft.settingsRemove||[])delete ustawienia[key];
    zastosujUstawienia();zbudujProdukty();odswiezMenu();odswiezKoszyk();return true;
  }finally{siteReleaseApplying=false;}
}
function siteReleaseSetState(state,{apply=true}={}){
  const previousDraftVersion=siteReleaseAdminState?.draft?.updatedAt||"";
  siteReleaseAdminState=state||null;
  if(previousDraftVersion&&previousDraftVersion!==siteReleaseAdminState?.draft?.updatedAt)siteReleaseEditorPreviewPath="";
  if(apply&&siteReleaseAdminState?.draft){
    if(!siteReleaseLiveSettings)siteReleaseLiveSettings={...ustawienia};
    siteReleaseReapplyDraftSettings();
  }
  uniewaznijCachePodstronAdmina("artway_ustawienia");return siteReleaseAdminState;
}
async function siteReleaseEnsureState(force=false){
  if(siteReleaseAdminState&&!force)return siteReleaseAdminState;if(siteReleaseAdminLoading)return siteReleaseAdminLoading;
  siteReleaseAdminLoading=chmura("site-release-state",{timeout:20000}).then(data=>siteReleaseSetState(data.state)).finally(()=>{siteReleaseAdminLoading=null;});
  return siteReleaseAdminLoading;
}
async function siteReleaseHandleSettingsSave(obj={}){
  if(!siteReleaseStagingEnabled())return {handled:false};
  const staged={},live={},stagedRemove=[],liveRemove=[];
  for(const [key,value] of Object.entries(obj||{})){
    const publicField=SITE_RELEASE_PUBLIC_SETTINGS.has(key),target=publicField?staged:live,removed=publicField?stagedRemove:liveRemove;
    if(value===undefined)removed.push(key);else target[key]=value;
  }
  if(!Object.keys(staged).length&&!stagedRemove.length)return {handled:false};
  const next={...ustawienia};for(const [key,value] of Object.entries(obj||{})){if(value===undefined)delete next[key];else next[key]=value;}
  ustawienia=next;zastosujUstawienia();zbudujProdukty();odswiezMenu();odswiezKoszyk();renderuj();
  toast("Zapisuję zmianę w wersji roboczej…");
  try{
    const tasks=[chmura("site-release-draft-settings",{method:"POST",body:{changes:staged,remove:stagedRemove},timeout:30000})];
    if(Object.keys(live).length||liveRemove.length)tasks.push(chmuraDodajMutacjePolUstawien(live,liveRemove,{skipSiteRelease:true}));
    const [release]=await Promise.all(tasks);if(release?.state)siteReleaseSetState(release.state,{apply:false});
    if(siteReleaseLiveSettings){for(const [key,value] of Object.entries(live))siteReleaseLiveSettings[key]=value;for(const key of liveRemove)delete siteReleaseLiveSettings[key];}
    loguj("info",`Zapisano ${Object.keys(staged).length+stagedRemove.length} publicznych pól w wersji roboczej`);
    toast("Zapisane w wersji roboczej — klienci jeszcze nie widzą tej zmiany ✅");siteReleaseNotifyEditorParent(release?.state);renderuj();return {handled:true,ok:true,state:release?.state};
  }catch(error){loguj("blad","Wersja robocza: "+(error.message||error));toast("Nie zapisano wersji roboczej: "+(error.message||error));return {handled:true,ok:false,error};}
}
async function siteReleaseStageSettingsMutation(changes={},remove=[]){
  if(!siteReleaseStagingEnabled())return {handled:false,liveChanges:changes,liveRemove:remove};
  const staged={},liveChanges={},stagedRemove=[],liveRemove=[];
  for(const [key,value] of Object.entries(changes||{}))(SITE_RELEASE_PUBLIC_SETTINGS.has(key)?staged:liveChanges)[key]=value;
  for(const key of remove||[])(SITE_RELEASE_PUBLIC_SETTINGS.has(key)?stagedRemove:liveRemove).push(key);
  if(!Object.keys(staged).length&&!stagedRemove.length)return {handled:false,liveChanges:changes,liveRemove:remove};
  const data=await chmura("site-release-draft-settings",{method:"POST",body:{changes:staged,remove:stagedRemove},timeout:30000});
  if(data?.state)siteReleaseSetState(data.state,{apply:false});
  return {handled:true,ok:true,liveChanges,liveRemove,staged:Object.keys(staged).length+stagedRemove.length,state:data?.state};
}
async function siteReleaseStageProductOperations(operations=[]){
  if(!siteReleaseStagingEnabled())return {handled:false,liveOperations:operations};
  const staged=[],liveOperations=[];
  for(const operation of operations||[]){
    const fields={},liveFields={};for(const [key,value] of Object.entries(operation.fields||{}))(SITE_RELEASE_PUBLIC_PRODUCT_FIELDS.has(key)?fields:liveFields)[key]=value;
    const remove=[],liveRemove=[];for(const key of operation.remove||[])(SITE_RELEASE_PUBLIC_PRODUCT_FIELDS.has(key)?remove:liveRemove).push(key);
    if(Object.keys(fields).length||remove.length)staged.push({productId:String(operation.productId||operation.id||""),fields,remove});
    if(Object.keys(liveFields).length||liveRemove.length)liveOperations.push({...operation,fields:liveFields,remove:liveRemove});
  }
  if(!staged.length)return {handled:false,liveOperations:operations};
  const data=await chmura("site-release-draft-products",{method:"POST",body:{operations:staged},timeout:60000});if(data?.state)siteReleaseSetState(data.state,{apply:false});
  for(const operation of staged){
    if(typeof podmienProduktAdminBezRenderu==="function")podmienProduktAdminBezRenderu(operation.productId,operation.fields,operation.remove);
  }
  toast(`${staged.length} ${staged.length===1?"produkt zapisany":"produktów zapisanych"} w wersji roboczej — publikacja później ✅`);
  return {handled:true,liveOperations,staged:staged.length,state:data?.state};
}
async function siteReleaseSetMode(active){
  const data=await chmura("site-release-draft-mode",{method:"POST",body:{active:active!==false},timeout:20000});siteReleaseSetState(data.state,{apply:active!==false});
  if(active===false&&siteReleaseLiveSettings){ustawienia={...siteReleaseLiveSettings};zapiszLS("artway_ustawienia",ustawienia,{synchronizuj:false});zastosujUstawienia();zbudujProdukty();}
  renderuj();return data.state;
}
function siteReleaseAdminBannerHTML(){
  const draft=siteReleaseAdminState?.draft;if(!draft)return "";const summary=siteReleaseSummary(),active=siteReleaseStagingEnabled(),changed=siteReleaseDraftHasChanges();
  return `<aside class="site-release-admin-banner ${active?"is-active":"is-paused"}"><div><span>${active?"●":"Ⅱ"}</span><div><b>${active?"Wersja robocza aktywna":"Bezpośredni zapis publiczny"}</b><small>${changed?`${summary.settings} zmian strony • ${summary.products} produktów • klienci widzą poprzednią wersję`:`${esc(draft.name||"Wersja robocza")} • nowe zmiany publiczne będą zbierane do publikacji`}</small></div></div><div><a class="btn ghost" href="#/admin/personalizacja/wersje">Centrum wersji${changed?` (${summary.settings+summary.products})`:""}</a>${changed?`<button class="btn" type="button" onclick="siteReleaseOpenPreview()">👁️ Podgląd</button>`:""}</div></aside>`;
}
async function siteReleaseOpenPreview(){
  try{const path=await siteReleaseCreatePreviewPath();const tab=window.open(path,"_blank","noopener");if(!tab)location.href=path;}catch(error){toast("Nie otwarto podglądu: "+(error.message||error));}
}
function siteReleasePreviewPath(path="",{editor=false,embed=false}={}){
  const url=new URL(path||"/#/",location.origin);if(editor)url.searchParams.set("site_editor","1");else url.searchParams.delete("site_editor");if(embed)url.searchParams.set("site_embed","1");else url.searchParams.delete("site_embed");return `${url.pathname}${url.search}${url.hash||"#/"}`;
}
async function siteReleaseCreatePreviewPath(options={}){
  const data=await chmura("site-release-preview-token",{method:"POST",body:{},timeout:20000});return siteReleasePreviewPath(data.path||`/?site_preview=${encodeURIComponent(data.token)}#/`,options);
}
async function siteReleaseOpenVisualEditor({sameTab=true}={}){
  if(window.__artwaySiteEditorOpening)return;
  window.__artwaySiteEditorOpening=true;
  const pending=!sameTab?window.open("about:blank","_blank"):null;
  try{toast("Otwieram pełny sklep w trybie edycji…");const path=await siteReleaseCreatePreviewPath({editor:true});if(sameTab){location.href=path;return;}if(pending){pending.opener=null;pending.location.replace(path);}else location.href=path;}
  catch(error){if(pending&&!pending.closed)pending.close();toast("Nie otwarto edytora strony: "+(error.message||error));}
  finally{setTimeout(()=>{window.__artwaySiteEditorOpening=false;},1200);}
}
async function siteReleaseEnsureEmbeddedPreview(force=false){
  if(siteReleaseEditorPreviewPath&&!force)return siteReleaseEditorPreviewPath;if(siteReleaseEditorPreviewLoading)return siteReleaseEditorPreviewLoading;
  siteReleaseEditorPreviewLoading=siteReleaseCreatePreviewPath({embed:true}).then(path=>{siteReleaseEditorPreviewPath=path;return path;}).finally(()=>{siteReleaseEditorPreviewLoading=null;});return siteReleaseEditorPreviewLoading;
}
if(!window.__artwaySiteEditorClickBound){
  window.__artwaySiteEditorClickBound=true;
  document.addEventListener("click",event=>{
    if(event.__artwaySiteEditorHandled)return;
    const editorLink=event.target?.closest?.("[data-site-editor-launch]");if(editorLink&&document.body.classList.contains("admin-mode")&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button<=0){event.__artwaySiteEditorHandled=true;event.preventDefault();siteReleaseOpenVisualEditor({sameTab:false});return;}
    const link=event.target?.closest?.('a[href="#/"]');if(!link||!document.body.classList.contains("admin-mode")||link.hasAttribute("data-site-live-link")||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button>0)return;
    event.__artwaySiteEditorHandled=true;
    if(siteReleaseSettingsEmbedRequested()){event.preventDefault();window.parent.postMessage({type:"artway-site-editor-close-settings"},location.origin);return;}
    event.preventDefault();siteReleaseOpenVisualEditor({sameTab:true});
  });
}
