/* ═══════════ PUBLIKACJE Z LINKÓW PROMOCYJNYCH ═══════════
   Okno powitalne nigdy nie uruchamia się jako przypadkowy popup sklepu.
   Serwer pokazuje je wyłącznie po zweryfikowaniu podpisanego parametru awref. */
let publikacjaKlientaAktywna=null,publikacjaKlientaToken="",publikacjaKlientaPoprzedniFocus=null;
let publikacjaKlientaStylPromise=null;

function publikacjaKlientaZaladujStyl(){
  if(document.getElementById("customerPublicationStyles")?.sheet)return Promise.resolve(true);
  if(publikacjaKlientaStylPromise)return publikacjaKlientaStylPromise;
  publikacjaKlientaStylPromise=new Promise((resolve,reject)=>{const link=document.createElement("link"),version=document.querySelector('meta[name="artway-version"]')?.content||"dev";link.id="customerPublicationStyles";link.rel="stylesheet";link.href=`/assets/customer-publications.css?v=${encodeURIComponent(version)}`;link.onload=()=>resolve(true);link.onerror=()=>{link.remove();publikacjaKlientaStylPromise=null;reject(new Error("Nie udało się wczytać stylu publikacji"));};document.head.appendChild(link);});
  return publikacjaKlientaStylPromise;
}

function publikacjaKlientaVisitorId(){
  const key="artway_publication_visitor_v1";let value="";
  try{value=localStorage.getItem(key)||"";}catch(e){}
  if(value.length>=12)return value;
  value=(globalThis.crypto?.randomUUID?.()||`visit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).slice(0,120);
  try{localStorage.setItem(key,value);}catch(e){}
  return value;
}
function publikacjaKlientaTokenZAdresu(){try{return new URL(location.href).searchParams.get("awref")||"";}catch(e){return "";}}
function publikacjaKlientaUsunTokenZAdresu(){
  try{const url=new URL(location.href);if(!url.searchParams.has("awref"))return;url.searchParams.delete("awref");const query=url.searchParams.toString();history.replaceState(history.state,"",`${url.pathname}${query?`?${query}`:""}${url.hash}`);}catch(e){}
}
function publikacjaKlientaPotwierdzona(entryId){try{return localStorage.getItem(`artway_publication_confirmed_${entryId}`)==="1";}catch(e){return false;}}
function publikacjaKlientaZapamietaj(entryId){try{localStorage.setItem(`artway_publication_confirmed_${entryId}`,"1");}catch(e){}}
function publikacjaKlientaAkcjaHTML(action,index){
  const style=["primary","secondary","soft"].includes(action?.style)?action.style:"soft";
  return `<button class="customer-publication-action is-${style}" type="button" onclick="publikacjaKlientaOdpowiedz(${jsArg(action?.id||`akcja-${index+1}`)},${jsArg(action?.target||"")})"><span>${esc(action?.label||"Przejdź dalej")}</span><i aria-hidden="true">${action?.target?"→":"✓"}</i></button>`;
}
function publikacjaKlientaDialogHTML(publication,{preview=false}={}){
  const actions=(Array.isArray(publication?.actions)?publication.actions:[]).slice(0,6);
  return `<section class="customer-publication-card ${preview?"is-preview":""}" role="dialog" aria-modal="${preview?"false":"true"}" aria-labelledby="customerPublicationTitle">
    <div class="customer-publication-accent" aria-hidden="true"></div>
    ${preview?`<span class="customer-publication-preview-label">Podgląd klienta</span>`:`<button class="customer-publication-close" type="button" aria-label="Zamknij i potwierdź wejście z polecenia" onclick="publikacjaKlientaOdpowiedz('zamkniecie','')">×</button>`}
    <div class="customer-publication-mark" aria-hidden="true">👋</div>
    <div class="customer-publication-copy"><small>${esc(publication?.eyebrow||"Witamy w Artway-TM")}</small><h2 id="customerPublicationTitle">${esc(publication?.title||"Dzień dobry!")}</h2><p>${esc(publication?.message||"")}</p></div>
    <div class="customer-publication-actions">${actions.map(publikacjaKlientaAkcjaHTML).join("")}</div>
    <footer><span>🔒 Potwierdzenie bez podawania danych osobowych</span><a href="#/prywatnosc">Prywatność</a></footer>
  </section>`;
}
function publikacjaKlientaPokaz(publication,entryId,token){
  if(document.getElementById("customerPublicationLayer"))return;
  publikacjaKlientaAktywna={...publication,entryId};publikacjaKlientaToken=token;publikacjaKlientaPoprzedniFocus=document.activeElement;
  const layer=document.createElement("div");layer.id="customerPublicationLayer";layer.className="customer-publication-layer";layer.innerHTML=publikacjaKlientaDialogHTML(publication);
  layer.addEventListener("click",event=>{if(event.target===layer)publikacjaKlientaOdpowiedz("zamkniecie","");});
  document.body.appendChild(layer);document.body.classList.add("has-customer-publication");
  requestAnimationFrame(()=>{layer.classList.add("is-open");layer.querySelector(".customer-publication-action,.customer-publication-close")?.focus();});
}
function publikacjaKlientaZamknij(){
  const layer=document.getElementById("customerPublicationLayer");if(!layer)return;
  layer.classList.remove("is-open");document.body.classList.remove("has-customer-publication");
  const focus=publikacjaKlientaPoprzedniFocus;setTimeout(()=>{layer.remove();focus?.isConnected&&focus.focus?.({preventScroll:true});},180);
  publikacjaKlientaAktywna=null;publikacjaKlientaToken="";
}
function publikacjaKlientaPrzejdz(target){
  const destination=String(target||"").trim();if(!destination)return;
  if(destination.startsWith("#/")){location.hash=destination;return;}
  if(destination.startsWith("/")||/^https:\/\/(?:www\.)?(?:artwaytm\.pl|allsklep\.pl)(?:[/:?#]|$)/i.test(destination))location.assign(destination);
}
async function publikacjaKlientaOdpowiedz(responseId,target=""){
  const current=publikacjaKlientaAktywna,token=publikacjaKlientaToken;if(!current||!token)return;
  publikacjaKlientaZapamietaj(current.entryId);publikacjaKlientaZamknij();
  try{await chmura("customer-publication-event",{method:"POST",body:{token,event:"confirmed",responseId,visitorId:publikacjaKlientaVisitorId()},timeout:4500});}
  catch(error){loguj("ostrzezenie",`Potwierdzenie wejścia z linku zostanie pominięte: ${error.message}`,"publikacja-promocyjna");}
  publikacjaKlientaPrzejdz(target);
}
async function publikacjeKlientaUruchomPoWejsciu(){
  const token=publikacjaKlientaTokenZAdresu();if(!token||jestAdmin())return false;
  try{
    const result=await chmura("customer-publication-entry",{params:{token},timeout:7000});
    publikacjaKlientaUsunTokenZAdresu();
    if(!result?.publication||!result?.entryId||publikacjaKlientaPotwierdzona(result.entryId))return false;
    await publikacjaKlientaZaladujStyl();
    void chmura("customer-publication-event",{method:"POST",body:{token,event:"landing",visitorId:publikacjaKlientaVisitorId()},timeout:4500}).catch(()=>false);
    setTimeout(()=>publikacjaKlientaPokaz(result.publication,result.entryId,token),260);return true;
  }catch(error){publikacjaKlientaUsunTokenZAdresu();loguj("ostrzezenie",`Nie udało się otworzyć publikacji promocyjnej: ${error.message}`,"publikacja-promocyjna");return false;}
}
document.addEventListener("keydown",event=>{
  const layer=document.getElementById("customerPublicationLayer");if(!layer)return;
  if(event.key==="Escape"){event.preventDefault();publikacjaKlientaOdpowiedz("zamkniecie","");return;}
  if(event.key!=="Tab")return;const focusable=elementyFokusu(layer);if(!focusable.length)return;
  const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
