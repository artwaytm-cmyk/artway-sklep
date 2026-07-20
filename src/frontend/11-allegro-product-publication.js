function produktDlaAllegroZFormularza(form,id,poprzedni={}){
  const fd=new FormData(form);
  const dane=daneProduktuZFormularza(fd,id,poprzedni);
  if(!dane){ toast("⚠️ Uzupełnij nazwę i cenę"); return null; }
  return dane;
}
function produktRoboczyAllegroZFormularza(form,id,poprzedni={}){
  const fd=new FormData(form);
  const pelny=daneProduktuZFormularza(fd,id,poprzedni);
  if(pelny) return pelny;
  const cena=parseFloat(String(fd.get("cena")||poprzedni.cena||"0").replace(",","."));
  const cenaAllegro=parseFloat(String(fd.get("cenaAllegro")||poprzedni.cenaAllegro||"0").replace(",","."));
  const cenaZakupu=parseFloat(String(fd.get("cenaZakupu")||poprzedni.cenaZakupu||"0").replace(",","."));
  const p={...poprzedni,id,nazwa:String(fd.get("nazwa")||poprzedni.nazwa||"").trim(),kategoria:String(fd.get("kategoria")||poprzedni.kategoria||"").trim(),cena:Number.isFinite(cena)?cena:0,...(cenaAllegro>0?{cenaAllegro:+cenaAllegro.toFixed(2)}:{}),...(cenaZakupu>=0&&String(fd.get("cenaZakupu")||"").trim()?{cenaZakupu:+cenaZakupu.toFixed(2)}:{}),opisKrotki:String(fd.get("opisKrotki")||poprzedni.opisKrotki||"").trim(),opis:String(fd.get("opis")||poprzedni.opis||"").trim()};
  for(const [pole,nazwa] of [["gtin","gtin"],["ean","gtin"],["externalId","externalId"],["mpn","mpn"],["producent","producent"],["marka","marka"],["kodProducenta","kodProducenta"],["allegroCategoryId","allegroCategoryId"],["allegroProductId","allegroProductId"],["allegroOfferId","allegroOfferId"],["allegroCategoryPhrase","allegroCategoryPhrase"],["sourceUrl","sourceUrl"],["producentUrl","producentUrl"]]){
    const v=String(fd.get(nazwa)||poprzedni[pole]||"").trim();
    if(v)p[pole]=v;
  }
  const zdjecie=String(fd.get("zdjecie")||poprzedni.zdjecie||"").trim();
  if(zdjecie)p.zdjecie=zdjecie;
  const zdjecia=Array.from({length:15},(_,i)=>String(fd.get("zdjecie"+(i+2))||"").trim()).filter(Boolean);
  if(zdjecia.length)p.zdjecia=zdjecia;
  return p;
}
function allegroKategorieHTML(d){
  const selected=d?.selected||null;
  const suggestions=Array.isArray(d?.suggestions)?d.suggestions:[];
  if(!selected&&!suggestions.length&&!d?.errors?.length) return "";
  const row=(c,main=false)=>`<div class="allegro-category-row ${main?"main":""}">
    <div><b>${main?"✅ Dobrana kategoria: ":""}${esc(c.name||"—")}</b><br><small>ID: ${esc(c.id||"—")}${c.pathText?` • ${esc(c.pathText)}`:""}${c.leaf===false?" • niekońcowa":""}</small></div>
    <button class="btn ghost" type="button" onclick="allegroUstawKategorieWFormularzu(${jsArg(c.id)})">Wybierz</button>
  </div>`;
  return `<div class="backend-note allegro-category-box">
    ${selected?row(selected,true):`<b>Nie udało się automatycznie dobrać kategorii.</b>`}
    ${suggestions.length>1?`<details style="margin-top:.55rem"><summary>Inne pasujące kategorie (${suggestions.length})</summary>${suggestions.slice(0,10).map(c=>row(c,false)).join("")}</details>`:""}
    ${d?.errors?.length?`<small style="color:var(--muted2)">Część zapytań Allegro nie zwróciła danych: ${esc(d.errors.map(e=>e.phrase).join(", "))}</small>`:""}
  </div>`;
}
function allegroDraftDiagnostykaHTML(d={},msg="",brak=""){
  const sc=d.salesConditions||{};
  const defs=sc.defaults||{};
  const params=Array.isArray(d.categoryParameters)?d.categoryParameters:[];
  const supportErrors=Array.isArray(d.supportErrors)?d.supportErrors:[];
  const allegroErrors=Array.isArray(d.allegroError?.errors)?d.allegroError.errors:[];
  const autoParams=Array.isArray(d.draft?.parameters)?d.draft.parameters:[];
  const required=Array.isArray(d.requiredParameters)?d.requiredParameters:[];
  const catalog=d.catalogMatch?.selected||null;
  return `<div class="backend-note">
    <b>${esc(msg||"Podgląd szkicu Allegro")}</b><br>
    Operacja: <b>${d.operation==="update"?`aktualizacja istniejącej oferty ${esc(d.existingOffer?.offer?.id||"")}`:"utworzenie nowej oferty"}</b>${d.existingOffer?.reason?` • dopasowanie: ${esc(d.existingOffer.reason)}`:""}<br>
    Krótki opis: <b>${esc(d.improvedDescriptions?.shortDescription||"przygotowany z danych produktu")}</b><br>
    Katalog Allegro: <b>${catalog?`${esc(catalog.name)} • ID ${esc(catalog.id)}`:"nie znaleziono produktu — wymagane pełne parametry"}</b><br>
    Braki bazowe: ${esc(brak||"brak")}<br>
    Warunki sprzedaży: cennik dostawy <b>${esc(defs.shippingRateId||"domyślny/brak")}</b>, zwroty <b>${esc(defs.returnPolicyId||"domyślne/brak")}</b>, reklamacje <b>${esc(defs.impliedWarrantyId||"domyślne/brak")}</b>, gwarancja <b>${esc(defs.warrantyId||"domyślna/brak")}</b><br>
    Parametry kategorii pobrane z Allegro: <b>${esc(params.length)}</b>; automatycznie dopisane do szkicu: <b>${esc(autoParams.length)}</b>.
    ${supportErrors.length?`<div style="margin-top:.5rem;color:#9a3412"><b>Uwagi API:</b><br>${supportErrors.map(e=>`• ${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}`).join("<br>")}</div>`:""}
    ${allegroErrors.length?`<div style="margin-top:.5rem;color:#991b1b"><b>Błąd Allegro:</b><br>${allegroErrors.map(e=>`• ${esc(e.userMessage||e.message||e.code||"błąd")}${e.path?` <small>(${esc(e.path)})</small>`:""}`).join("<br>")}</div>`:""}
    ${required.length?`<div class="allegro-required-params"><h4>Uzupełnij wymagane parametry Allegro</h4><p>Produkt nie został znaleziony w katalogu po EAN. Te pola są wymagane do utworzenia nowego produktu.</p>${required.map(p=>`<label><span>${esc(p.name)}${p.unit?` (${esc(p.unit)})`:""}</span>${Array.isArray(p.dictionary)&&p.dictionary.length?`<select name="allegroParam_${esc(p.id)}" data-param-type="dictionary" required><option value="">— wybierz —</option>${p.dictionary.map(v=>`<option value="${esc(v.id||v.valueId||v.value)}">${esc(v.value||v.name||v.label)}</option>`).join("")}</select>`:`<input name="allegroParam_${esc(p.id)}" placeholder="${esc(p.name)}" required>`}</label>`).join("")}</div>`:""}
    <details><summary>Podgląd JSON wysyłany do Allegro</summary><pre style="white-space:pre-wrap;font-size:.75rem">${esc(JSON.stringify(d.draft||d,null,2))}</pre></details>
  </div>`;
}
function allegroUstawKategorieWFormularzu(id){
  const form=document.querySelector("form.product-editor-form");
  if(!form?.elements?.allegroCategoryId){ toast("Nie znaleziono pola kategorii Allegro"); return; }
  form.elements.allegroCategoryId.value=String(id||"").trim();
  toast("🟠 Ustawiono kategorię Allegro: "+String(id||""));
}
function allegroPokazKategorieWFormularzu(d){
  const box=document.getElementById("allegroCategoryPreview");
  if(box) box.innerHTML=allegroKategorieHTML(d);
  const id=d?.selected?.id;
  const form=document.querySelector("form.product-editor-form");
  if(id&&form?.elements?.allegroCategoryId&&!String(form.elements.allegroCategoryId.value||"").trim()) form.elements.allegroCategoryId.value=String(id);
}
async function allegroDobierzKategorieProduktu(id=0,btn=null){
  const form=document.querySelector("form.product-editor-form");
  if(!form){ toast("Nie znaleziono formularza produktu"); return; }
  const poprzedni=id?pobierzProduktAdmin(id)||{}:{};
  const product=produktRoboczyAllegroZFormularza(form,id,poprzedni);
  const phrase=String(form.elements.allegroCategoryPhrase?.value||"").trim();
  if(!phrase&&!String(product.nazwa||"").trim()&&!String(product.kategoria||"").trim()){ toast("Podaj nazwę produktu albo frazę do katalogu Allegro"); return; }
  try{
    if(btn)btn.disabled=true;
    toast("🟠 Szukam kategorii w katalogu Allegro…");
    const d=await chmura("allegro-category-suggest",{method:"POST",body:{product,phrase,limit:10},timeout:18000});
    allegroPokazKategorieWFormularzu(d);
    toast(d.selected?.id?`🟠 Dobrano kategorię Allegro: ${d.selected.name} (${d.selected.id})`:"⚠️ Allegro nie zwróciło pasującej kategorii");
  }catch(e){ toast("⚠️ Kategorie Allegro: "+(e.message||e)); }
  finally{ if(btn)btn.disabled=false; }
}
function allegroZapiszKategorieProduktu(id,categoryId){
  if(!id||!categoryId) return false;
  const p=pobierzProduktAdmin(id);
  if(p?.allegroCategoryId) return false;
  produktyEdytowane[id]={...(produktyEdytowane[id]||{}),allegroCategoryId:String(categoryId)};
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zbudujProdukty();
  return true;
}
function allegroTrybPublikacji(){ return String(document.getElementById("allegroPublicationAction")?.value||"keep"); }
function allegroListaProducentow(){
  const ustawione=Array.isArray(allegroStan.offerSettings?.producers)&&allegroStan.offerSettings.producers.length?allegroStan.offerSettings.producers:["Alexander","Multigra","GoDan"];
  return [...new Set([...ustawione,...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>p.name||p.nazwa)].map(x=>String(x||"").trim()).filter(Boolean))];
}
function allegroProducentKanoniczny(p={}){
  const list=allegroListaProducentow(),norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const text=norm([p.producent,p.marka,p.nazwa,p.name,p.sourceUrl,p.producentUrl].filter(Boolean).join(" "));
  const direct=list.find(name=>text.includes(norm(name)));if(direct)return direct;
  const find=name=>list.find(x=>norm(x)===norm(name))||"";
  if(/alexander|sklep alexander|origami 3d|maly konstruktor|constructor junior|zlotowki/.test(text))return find("Alexander");
  if(/multigra/.test(text))return find("Multigra");
  if(/go dan|godan|godanparty/.test(text))return find("GoDan");
  return "";
}
function zapiszPolaProduktuLokalnie(id,fields={},tylkoBrakujace=false){
  const key=String(id),idx=produktyDodane.findIndex(x=>String(x.id)===key),base=idx>=0?produktyDodane[idx]:(produktyEdytowane[key]||{}),effective=idx>=0?base:(pobierzProduktAdmin(id)||base),next={...base};let changed=false;
  for(const [field,value] of Object.entries(fields)){if(value===undefined||value===null||value==="")continue;if(tylkoBrakujace&&(effective[field]!==undefined&&effective[field]!==null&&String(effective[field]).trim()!==""))continue;if(JSON.stringify(next[field])!==JSON.stringify(value)){next[field]=value;changed=true;}}
  if(!changed)return false;
  if(idx>=0){produktyDodane[idx]=next;zapiszLS("artway_produkty_dodane",produktyDodane);}else{produktyEdytowane={...produktyEdytowane,[key]:next};zapiszLS("artway_produkty_edytowane",produktyEdytowane);}
  zbudujProdukty();return true;
}
function allegroZastosujWynikWystawienia(p,d={}){
  const id=String(d.offer?.id||p.allegroOfferId||"").trim();
  if(!id)return;
  const old=allegroOfertaPoId(id)||{};
  const publication=d.offer?.publication||{};
  const next={...old,...d.offer,id,name:d.offer?.name||p.nazwa||old.name,externalId:d.offer?.external?.id||p.externalId||p.sku||old.externalId||"",ean:p.gtin||p.ean||old.ean||"",gtin:p.gtin||p.ean||old.gtin||"",manufacturerCode:p.kodProducenta||p.mpn||old.manufacturerCode||"",categoryId:d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||old.categoryId||"",priceText:d.offer?.sellingMode?.price?`${String(d.offer.sellingMode.price.amount).replace(".",",")} ${d.offer.sellingMode.price.currency||"PLN"}`:old.priceText||zl(p.cena),status:publication.status||old.status||(allegroTrybPublikacji()==="activate"?"ACTIVE":"INACTIVE"),mainImage:d.offer?.images?.[0]||p.zdjecie||old.mainImage||"",images:(d.offer?.images||[p.zdjecie,...(p.zdjecia||[])]).filter(Boolean)};
  allegroOferty=[next,...allegroOferty.filter(o=>String(o.id)!==id)];
  allegroMapowania={...allegroMapowania,[id]:{offerId:id,productId:String(p.id),operator:"auto-offer-save"}};
  allegroZapiszCache();
}
function allegroZapiszWynikOperacji(p,d={}){
  const offerId=String(d.offer?.id||p.allegroOfferId||"").trim();
  allegroOstatniWynikWystawienia={
    produktId:String(p.id??""),produktNazwa:p.nazwa||p.name||"Produkt",offerId,
    mode:d.mode||"updated",status:d.offer?.publication?.status||d.offer?.status||"INACTIVE",
    duplicatePrevented:!!d.duplicatePrevented,reason:d.match?.reason||d.existingOffer?.reason||"",
    catalogId:d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"",
    categoryId:d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||"",
    at:new Date().toISOString()
  };
  return allegroOstatniWynikWystawienia;
}
function allegroWynikOperacjiHTML(){
  const w=allegroOstatniWynikWystawienia;if(!w?.offerId)return "";
  const updated=w.mode==="updated";
  return `<div class="duplicate-audit-ok allegro-operation-success"><div><b>✅ ${updated?"Oferta została znaleziona i zaktualizowana":"Oferta została utworzona"}</b><small>${esc(w.produktNazwa)} • ID oferty ${esc(w.offerId)} • status ${esc(w.status)}${w.duplicatePrevented?" • nie utworzono duplikatu":""}</small><small>Produkt katalogowy: ${esc(w.catalogId||"—")} • kategoria: ${esc(w.categoryId||"—")}${w.reason?` • rozpoznano po: ${esc(w.reason)}`:""}</small></div><div class="warehouse-worktable-actions"><button class="btn ghost" onclick="window.open('https://allegro.pl/oferta/${encodeURIComponent(w.offerId)}','_blank','noopener')">Otwórz w Allegro</button><button class="btn ghost" onclick="allegroOstatniWynikWystawienia=null;renderuj()">Zamknij</button></div></div>`;
}
function allegroTekstZBezpiecznychSekcji(sections=[]){
  const html=(Array.isArray(sections)?sections:[]).flatMap(section=>Array.isArray(section?.items)?section.items:[]).filter(item=>item?.type==="TEXT").map(item=>String(item.content||"")).join("\n");
  if(!html)return "";
  const withBreaks=html.replace(/<\/(p|h1|h2|h3|li)>/gi,"\n").replace(/<br\s*\/?\s*>/gi,"\n").replace(/<li[^>]*>/gi,"• ");
  const el=document.createElement("textarea");el.innerHTML=withBreaks;
  return String(el.value||"").replace(/<[^>]+>/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function allegroZapiszAutoUzupelnienia(p,d={}){
  if(!p?.id)return false;
  const auto=d.autoFilled||{},catalog=d.catalogMatch?.selected||{},category=d.categorySuggestion?.selected||{};
  const canonical=allegroProducentKanoniczny({...p,producent:auto.producent||p.producent,marka:auto.marka||p.marka});
  const fields={
    allegroTitle:auto.allegroTitle||p.allegroTitle,
    producent:canonical||auto.producent||p.producent||p.marka||"",
    marka:auto.marka||p.marka||canonical||auto.producent||p.producent||"",
    gtin:auto.gtin||auto.ean||(catalog.eans||[])[0]||p.gtin||p.ean||"",
    ean:auto.ean||auto.gtin||(catalog.eans||[])[0]||p.ean||p.gtin||"",
    kodProducenta:auto.kodProducenta||auto.mpn||p.kodProducenta||p.mpn||"",
    mpn:auto.mpn||auto.kodProducenta||p.mpn||p.kodProducenta||"",
    zdjecie:auto.zdjecie||(auto.zdjecia||[])[0]||p.zdjecie||"",
    allegroProductId:auto.allegroProductId||catalog.id||p.allegroProductId||"",
    allegroCategoryId:auto.allegroCategoryId||category.id||catalog.categoryId||p.allegroCategoryId||""
  };
  const improved=d.improvedDescriptions||{},safeSections=d.draft?.description?.sections||improved.sections||[],safeFull=improved.storeFullDescription||improved.fullDescription||p.opis||"",safeShort=improved.storeShortDescription||improved.shortDescription||p.opisKrotki||(safeFull?agentAITnijDoZdania(safeFull,500):""),allegroFull=improved.allegroDescription||safeFull||allegroTekstZBezpiecznychSekcji(safeSections)||"",next={allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},force={};let changed=p.allegroShippingSubsidy===undefined;
  for(const [key,value] of Object.entries(fields))if(value&&(!p[key]||(canonical&&key==="producent"&&String(p[key])!==String(value)))){next[key]=String(value);changed=true;}
  const extraImages=(Array.isArray(auto.zdjecia)?auto.zdjecia:[]).filter(Boolean).filter(x=>x!==fields.zdjecie).slice(0,15);
  if(extraImages.length&&!(Array.isArray(p.zdjecia)&&p.zdjecia.length)){next.zdjecia=extraImages;changed=true;}
  if(Array.isArray(auto.allegroParameters)&&auto.allegroParameters.length&&!Array.isArray(p.allegroParameters)){next.allegroParameters=auto.allegroParameters;changed=true;}
  if(safeShort&&String(safeShort)!==String(p.opisKrotki||"")){force.opisKrotki=String(safeShort);changed=true;}
  if(safeFull&&String(safeFull)!==String(p.opis||"")){force.opis=String(safeFull);changed=true;}
  if(allegroFull&&String(allegroFull)!==String(p.allegroDescription||"")){force.allegroDescription=String(allegroFull);changed=true;}
  if(Array.isArray(safeSections)&&safeSections.length){force.allegroDescriptionSections=safeSections;changed=true;}
  const form=document.querySelector("form.product-editor-form");
  if(form){
    for(const [key,value] of Object.entries(fields))uzupelnijPoleFormularza(form,key,value,false);
    extraImages.forEach((url,i)=>uzupelnijPoleFormularza(form,"zdjecie"+(i+2),url,false));
    uzupelnijPoleFormularza(form,"opisKrotki",safeShort,true);
    uzupelnijPoleFormularza(form,"opis",safeFull,true);
    uzupelnijPoleFormularza(form,"allegroShippingSubsidy",next.allegroShippingSubsidy,false);
  }
  if(canonical){const producerFields={producent:canonical,...(!p.marka&&!auto.marka?{marka:canonical}:{})};if(zapiszPolaProduktuLokalnie(p.id,producerFields,false))changed=true;delete next.producent;if(p.marka||auto.marka)delete next.marka;}
  const missingSaved=Object.keys(next).length?zapiszPolaProduktuLokalnie(p.id,next,true):false;
  const forcedSaved=Object.keys(force).length?zapiszPolaProduktuLokalnie(p.id,force,false):false;
  return missingSaved||forcedSaved||changed;
}
async function allegroPrzygotujSzkicProduktu(id){
  const form=document.querySelector("form.product-editor-form");
  const produkt=id?produktDlaAllegroZFormularza(form,id,pobierzProduktAdmin(id)||{}):null;
  if(!produkt) return;
  try{
    toast("🤖 Agent przygotowuje i zapisuje komplet danych Allegro…");
    zapiszPolaProduktuLokalnie(id,produkt,false);
    const result=await asortymentPrzygotujProduktDoAllegro(pobierzProduktAdmin(id)||produkt,{refreshSource:true}),d=result.draft,cloudSaved=await chmuraZapiszUstawienia().catch(()=>false);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    const brak=result.missing.join(", ")||"brak";
    const cat=d.categorySuggestion?.selected;
    const msg=result.ready?(d.operation==="update"?`Dane zapisane. Znaleziono ofertę ${d.existingOffer?.offer?.id||""} — zostanie zaktualizowana bez duplikatu.`:"Dane zapisane. Produkt jest gotowy technicznie do wysłania do Allegro."):"Agent zapisał poprawki; nadal trzeba uzupełnić: "+brak;
    toast(`${cloudSaved?"✅":"⚠️"} ${msg}${cloudSaved?"":" • serwer ponowi synchronizację"}`);
    const box=document.getElementById("allegroDraftPreview");
    if(box) box.innerHTML=`<div class="backend-note ${result.ready?"duplicate-audit-ok":""}"><b>${result.ready?"✅ Przygotowanie zapisane":"⚠️ Poprawki zapisane — pozostały braki"}</b><br><small>${result.savedFields.length?`Zmieniono: ${esc(asortymentEtykietyPol(result.savedFields).join(", "))}`:"Kontrola nie wymagała zmiany istniejących danych."} • serwer: ${cloudSaved?"zapis potwierdzony":"ponowna próba w toku"}</small></div>${allegroKategorieHTML(d.categorySuggestion)}${cat?`<div class="backend-note">Dobrana kategoria: <b>${esc(cat.name)}</b> (${esc(cat.id)})</div>`:""}${allegroDraftDiagnostykaHTML(d,msg,brak)}`;
  }catch(e){ allegroZapiszAutoUzupelnienia(produkt,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProdukt(id){
  const form=document.querySelector("form.product-editor-form");
  const produkt=id?produktDlaAllegroZFormularza(form,id,pobierzProduktAdmin(id)||{}):null;
  if(!produkt) return;
  try{
    toast("🤖 Najpierw przygotowuję i zapisuję pełne dane produktu…");
    zapiszPolaProduktuLokalnie(id,produkt,false);
    const preparation=await asortymentPrzygotujProduktDoAllegro(pobierzProduktAdmin(id)||produkt,{refreshSource:true});
    if(!preparation.ready){
      await chmuraZapiszUstawienia().catch(()=>false);
      const box=document.getElementById("allegroDraftPreview");if(box)box.innerHTML=`<div class="backend-note allegro-mapping-error"><b>Agent zapisał poprawione dane, ale zatrzymał wystawienie.</b><br>Do uzupełnienia: ${esc(preparation.missing.join(", ")||"sprawdź kartotekę produktu")}<br><small>Zapisane pola: ${esc(asortymentEtykietyPol(preparation.savedFields).join(", ")||"kontrola bez zmian")}</small></div>`;
      toast("⚠️ Oferta nie została wysłana — uzupełnij wskazane braki");return;
    }
    const produktGotowy=preparation.product;
    const publicationAction=allegroTrybPublikacji();
    const preparedDraft=preparation.draft?.draft?{...preparation.draft.draft,publication:{...(preparation.draft.draft.publication||{}),status:publicationAction==="activate"?"ACTIVE":"INACTIVE",republish:true}}:null;
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:produktGotowy,...(preparedDraft?{draft:preparedDraft}:{}),options:{stock:allegroStanOfertyProduktu(produktGotowy),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    const remoteStatus=String(d.verification?.status||d.offer?.publication?.status||d.offer?.status||"").toUpperCase();
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(produktGotowy,d);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    allegroZapiszAutoUzupelnienia(produktGotowy,d);
    toast(remoteStatus==="ACTIVE"?"✅ Oferta zapisana i aktywna w Allegro":`🧾 Oferta zapisana • status Allegro: ${remoteStatus||"weryfikacja w toku"}`);
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||form.elements.allegroCategoryId?.value||"";
      produktyEdytowane[id]={...(produktyEdytowane[id]||{}),allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})};
      zapiszLS("artway_produkty_edytowane",produktyEdytowane);
      allegroZastosujWynikWystawienia(produktGotowy,d);
      await allegroPobierzProwizjeProduktu(id,null,{silent:true}).catch(()=>null);
      zapiszPolaProduktuLokalnie(id,{allegroAgentPreparationStatus:remoteStatus==="ACTIVE"?"published":"draft",allegroAgentPublishedAt:remoteStatus==="ACTIVE"?new Date().toISOString():"",allegroOfferId:String(d.offer.id)},false);
      const cloudSaved=await chmuraZapiszUstawienia().catch(()=>false);
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      const box=document.getElementById("allegroDraftPreview");if(box)box.innerHTML=`<div class="duplicate-audit-ok allegro-operation-success"><div><b>${remoteStatus==="ACTIVE"?"✅ Oferta aktywna":"🧾 Oferta zapisana — "+esc(remoteStatus||"weryfikacja w toku")}</b><small>ID ${esc(d.offer.id)} • opis: ${esc(d.verification?.descriptionSections||0)} sekcji • kartoteka ${cloudSaved?"zapisana na serwerze":"czeka na ponowny zapis"}</small></div><a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(d.offer.id)}" target="_blank" rel="noopener">Otwórz ofertę</a></div>`;
    }
  }catch(e){
    allegroOstatniBladWystawienia=e;
    allegroZapiszAutoUzupelnienia(produkt,e);
    if(e.agentTask)await chmuraWczytajStan().catch(()=>{});
    allegroPokazKategorieWFormularzu(e.categorySuggestion);
    const box=document.getElementById("allegroDraftPreview");
    if(box&&e.draft) box.innerHTML=`${allegroKategorieHTML(e.categorySuggestion)}${allegroDraftDiagnostykaHTML(e,"Nie utworzono oferty: "+(e.message||"błąd Allegro"),(e.missing||[]).join(", ")||"—")}`;
    toast("⚠️ Wystawianie Allegro: "+(e.message||e));
  }
}
function uzupelnijPoleFormularza(form,nazwa,wartosc,overwrite){
  if(wartosc===undefined||wartosc===null||wartosc==="") return;
  const el=form.elements[nazwa];
  if(!el) return;
  if(overwrite||!String(el.value||"").trim()) el.value=wartosc;
}
function agentAIUzupelnijFormularzZLinku(form,p={},d={},overwrite=false,url=""){
  const category=d.storeCategory?.name?d.storeCategory:agentAIDobierzKategorieProduktu(p);p={...p,kategoria:category.name||p.kategoria||""};
  uzupelnijPoleFormularza(form,"nazwa",p.nazwa,overwrite);uzupelnijPoleFormularza(form,"kategoria",p.kategoria,overwrite);uzupelnijPoleFormularza(form,"opisKrotki",p.opisKrotki||agentAIUtworzOpisKrotki(p),overwrite);uzupelnijPoleFormularza(form,"opis",p.opis,overwrite);uzupelnijPoleFormularza(form,"cena",p.cena,overwrite);uzupelnijPoleFormularza(form,"zdjecie",p.zdjecie,overwrite);(p.zdjecia||[]).slice(0,15).forEach((z,i)=>uzupelnijPoleFormularza(form,"zdjecie"+(i+2),z,overwrite));uzupelnijPoleFormularza(form,"gtin",p.gtin||p.ean,overwrite);uzupelnijPoleFormularza(form,"mpn",p.mpn||p.kodProducenta,overwrite);uzupelnijPoleFormularza(form,"kodProducenta",p.kodProducenta||p.mpn,overwrite);uzupelnijPoleFormularza(form,"externalId",p.externalId,overwrite);
  const canonicalProducer=allegroProducentKanoniczny({...p,sourceUrl:p.sourceUrl||url,producentUrl:url});uzupelnijPoleFormularza(form,"marka",p.marka||canonicalProducer||p.producent,overwrite);uzupelnijPoleFormularza(form,"producent",canonicalProducer||p.producent||p.marka,overwrite||!!canonicalProducer);uzupelnijPoleFormularza(form,"rozmiar",p.rozmiar,overwrite);uzupelnijPoleFormularza(form,"dostepnoscProducenta",p.dostepnoscProducenta,overwrite);uzupelnijPoleFormularza(form,"producentUrl",p.producentUrl||p.sourceUrl||url,overwrite);uzupelnijPoleFormularza(form,"sourceUrl",p.sourceUrl||p.producentUrl||url,overwrite);uzupelnijPoleFormularza(form,"allegroCategoryId",p.allegroCategoryId,overwrite);uzupelnijPoleFormularza(form,"allegroProductId",p.allegroProductId,overwrite);for(const field of ["stanProducenta","stanProducentaZrodlo","producentStatus","producentSprawdzonoAt"])uzupelnijPoleFormularza(form,field,p[field],true);if(form.elements.stanProducentaDokladny)form.elements.stanProducentaDokladny.value=p.stanProducentaDokladny?"1":"";
  form.dataset.agentLinkConfidence=String(d.confidence||0);form.dataset.agentLinkSource=String(d.canonicalUrl||d.resolvedUrl||url||"");form.dataset.agentCategoryConfidence=String(category.confidence||0);
  const pg=document.getElementById("podgladZdjecia");if(pg&&form.elements.zdjecie?.value)pg.innerHTML=`<img src="${esc(form.elements.zdjecie.value)}" alt="Podgląd zdjęcia produktu" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:.6rem">`;
  produktDodawanieAktualizuj(form);
  return brakiDanychProducenta(p,d);
}
function agentAIAudytDodaniaHTML(product={},d={}){
  const audit=agentAIOcenaDodaniaProduktu(product,d),dup=audit.blockingDuplicate;
  return `<section class="product-link-add-audit"><div class="product-link-add-score"><span>Gotowość danych</span><b>${esc(audit.score)}%</b><small>${audit.ready?"formularz jest gotowy do Twojego zatwierdzenia":dup?`dane ${audit.dataScore}%, znaleziono możliwy duplikat`:"najpierw wykonaj wskazane czynności"}</small></div><div class="product-link-add-steps">${[["Link",!d.needsChoice,"źródło rozpoznane"],["Tożsamość",!!(product.gtin||product.ean||product.mpn||product.kodProducenta),"EAN lub kod producenta"],["Dane sklepu",!!(product.nazwa&&Number(product.cena)>0&&audit.product.kategoria),"nazwa, cena i kategoria"],["Duplikaty",!dup,dup?`produkt #${dup.product.id}`:"brak pewnego duplikatu"],["Zatwierdzenie",false,"decyzja administratora na dole formularza"]].map(([label,ok,note])=>`<span class="${ok?"ok":"wait"}"><b>${ok?"✓":"○"} ${esc(label)}</b><small>${esc(note)}</small></span>`).join("")}</div>${audit.blockers.length?`<div class="backend-note product-link-blockers"><b>Agent wskazuje problem przed zatwierdzeniem:</b> ${esc(audit.blockers.join(" • "))}</div>`:""}${audit.warnings.length?`<div class="backend-note"><b>Do późniejszego uzupełnienia:</b> ${esc(audit.warnings.join(" • "))}</div>`:""}${audit.duplicates.length?`<div class="product-link-duplicates"><b>Możliwe istniejące produkty</b>${audit.duplicates.slice(0,4).map(x=>`<article><span><strong>#${esc(x.product.id)} ${esc(x.product.nazwa||"Produkt")}</strong><small>${esc(x.reasons.join(" • "))} • zgodność ${esc(x.score)}%</small></span><button class="btn ghost" type="button" onclick="location.hash='#/admin/produkty/edytuj/${encodeURIComponent(String(x.product.id))}'">Otwórz</button>${x.blocking?`<button class="btn" type="button" onclick="agentAIAktualizujIstniejacyZAnalizy(${jsArg(x.product.id)},this)">Uzupełnij istniejący</button>`:""}</article>`).join("")}</div>`:""}<div class="diag-actions">${audit.ready?`<button class="btn product-link-agent-add" type="button" onclick="agentAIDodajProduktZAnalizy(this)">Przejdź do zatwierdzenia ↓</button>`:`<button class="btn ghost" type="button" onclick="agentAIPokazPierwszyBrak(this)">Przejdź do brakujących danych</button>`}</div></section>`;
}
function agentAIRaportLinkuHTML(d={},selected=-1){
  const alternatives=Array.isArray(d.alternatives)?d.alternatives:[],attempts=Array.isArray(d.diagnostics?.attempts)?d.diagnostics.attempts:[],candidate=d.needsChoice&&selected>=0?alternatives[selected]:null,product=candidate?.product||d.product||{},sources=candidate?.fieldSources||d.fieldSources||{},missing=candidate?.missing||brakiDanychProducenta(product,d),confidence=candidate?.confidence||d.confidence||0,workflow=d.workflow||{},allegro=d.allegroPreparation||{},category=d.storeCategory||{};
  const preparation=!d.needsChoice?`<div class="product-link-field-grid product-link-channel-readiness"><span class="${workflow.readyForStore?"ok":"missing"}"><small>Sklep</small><b>${workflow.readyForStore?"gotowe do zapisu":"wymaga uzupełnienia"}</b><em>${esc(category.name?`${category.name} • pewność ${category.confidence||0}%`:"brak pewnej kategorii")}</em></span><span class="${workflow.readyForAllegro?"ok":"missing"}"><small>Allegro</small><b>${workflow.readyForAllegro?"szkic przygotowany":"wymaga uzupełnienia"}</b><em>${esc(product.allegroCategoryId?`kategoria ${product.allegroCategoryId}${product.allegroProductId?` • katalog ${product.allegroProductId}`:""}`:(allegro.missing||[]).join(", ")||"brak kategorii")}</em></span><span class="${d.duplicateAudit?.blocking?"missing":"ok"}"><small>Duplikaty</small><b>${d.duplicateAudit?.blocking?"zapis zablokowany":"brak pewnego duplikatu"}</b><em>${esc(d.duplicateAudit?.selected?.productName||"kontrola centralnej bazy zakończona")}</em></span></div>`:"";
  return `<div class="product-link-agent-report ${d.needsChoice&&selected<0?"needs-choice":""}"><header><div><span>🤖 Analiza linku + przygotowanie Allegro</span><h3>${d.needsChoice&&selected<0?`Znaleziono ${alternatives.length} możliwe produkty`:esc(product.nazwa||"Wynik analizy produktu")}</h3><small>Kompletność ${esc(confidence)}% • ${esc(d.fromCache?"pewny wynik z pamięci Agenta":d.diagnostics?.selectedReason||"najpełniejsze dane")}</small></div><span class="lvl ${missing.length?"lvl-ostrzezenie":"lvl-ok"}">${workflow.readyForAllegro?"sklep + Allegro gotowe":missing.length?`${missing.length} uwag`:"komplet danych"}</span></header>${d.fromCache?`<div class="backend-note product-link-cache-note"><b>🧠 Pamięć Agenta:</b> producent chwilowo nie odpowiedział, dlatego użyto ostatniego poprawnego wyniku z ${esc(d.cacheSavedAt?new Date(d.cacheSavedAt).toLocaleString("pl-PL"):"wcześniejszej kontroli")}. Agent nadal zaplanował świeżą kontrolę.</div>`:""}${d.repaired?`<div class="backend-note"><b>Naprawiono lub przekierowano adres:</b> ${esc(d.resolvedUrl||d.canonicalUrl||"")}</div>`:""}${d.needsChoice&&selected<0?`<div class="product-link-candidate-grid">${alternatives.map((c,i)=>`<article>${c.product?.zdjecie?`<img src="${esc(c.product.zdjecie)}" alt="">`:`<span>📦</span>`}<div><b>${esc(c.product?.nazwa||`Wariant ${i+1}`)}</b><small>EAN ${esc(c.product?.ean||c.product?.gtin||"—")} • kod ${esc(c.product?.kodProducenta||c.product?.mpn||"—")}</small><small>${esc(c.confidence||0)}% • braki: ${esc(c.missing?.join(", ")||"brak")}</small><small>${esc(c.url||"")}</small></div><button class="btn" type="button" onclick="agentAIWybierzKandydataZLinku(${i},this)">Wybierz i przygotuj</button></article>`).join("")}</div>`:`${preparation}<div class="product-link-field-grid">${[["Nazwa",product.nazwa,sources.nazwa],["EAN",product.ean||product.gtin,sources.ean],["Kod",product.kodProducenta||product.mpn,sources.kod],["Cena",product.cena?zl(product.cena):"",sources.cena],["Opis",product.opis?`${String(product.opis).length} znaków`:"",sources.opis],["Zdjęcia",[product.zdjecie,...(product.zdjecia||[])].filter(Boolean).length,sources.zdjecia],["Dostępność",product.dostepnoscProducenta,sources.dostepnosc]].map(([label,value,source])=>`<span class="${value!==""&&value!==0?"ok":"missing"}"><small>${label}</small><b>${esc(value||"brak")}</b><em>${esc(source||"uzupełnione przez Agenta/katalog")}</em></span>`).join("")}</div>${agentAIAudytDodaniaHTML(product,{...d,needsChoice:false})}`}<details><summary>Diagnostyka pobierania (${attempts.filter(x=>x.ok).length}/${attempts.length} wariantów poprawnych)</summary><div class="product-link-attempts">${attempts.map(a=>`<span class="${a.ok?"ok":"error"}"><b>${a.ok?"✅":"⚠️"} ${esc(a.reason||"próba")}</b><small>${esc(a.url||"")}</small><small>${a.ok?`HTTP ${esc(a.status)} • ${Math.max(1,Math.round((a.durationMs||0)/1000))} s • ${esc(a.confidence||0)}%`:`${esc(a.error||"błąd")} • ${Math.max(1,Math.round((a.durationMs||0)/1000))} s`}</small></span>`).join("")}</div></details></div>`;
}
async function agentAIWybierzKandydataZLinku(index,button){
  const form=button?.closest("form"),current=agentAIImportUrlStan.data,c=current?.alternatives?.[index];if(!form||!c?.product)return;
  const requested=current.requestedUrl||form.elements.producentUrl?.value||form.elements.sourceUrl?.value||c.url,overwrite=!!form.elements.nadpiszImportUrl?.checked;button.disabled=true;
  try{
    toast("Agent przygotowuje wybrany wariant i katalog Allegro…");
    const d=await chmura("product-url-prepare",{method:"POST",body:{url:requested,choice:index},timeout:90000}),p=d.product||c.product,url=d.canonicalUrl||c.url||requested,braki=agentAIUzupelnijFormularzZLinku(form,p,d,overwrite,url);if(form.elements.producentUrl)form.elements.producentUrl.value=url;if(form.elements.sourceUrl)form.elements.sourceUrl.value=url;agentAIImportUrlStan={busy:false,data:d,selected:index,error:""};
    const box=form.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(d,index);agentAIZapiszLinkProducenta(requested,braki.length?"do uzupełnienia":"pobrano",braki.length?`Wybrano wariant — uwagi: ${braki.join(", ")}`:"Wybrano i przygotowano właściwy wariant",{lastProductName:p.nazwa||"",lastProduct:agentAIProduktZLinkuMini(p),lastMissing:braki,lastCandidates:current.alternatives||[],linkConfidence:d.confidence||c.confidence||0,diagnostics:d.diagnostics||{},resolvedUrl:url,nextRetryAt:null});toast(`✅ Przygotowano: ${p.nazwa||"produkt"} • sklep ${d.workflow?.readyForStore?"gotowy":"do uzupełnienia"} • Allegro ${d.workflow?.readyForAllegro?"gotowe":"do uzupełnienia"}`);
  }catch(e){toast("⚠️ Przygotowanie wariantu: "+(e.message||e));button.disabled=false;}
}
function agentAIWybranyProduktImportu(d={},selected=-1){return d.needsChoice&&selected>=0?d.alternatives?.[selected]?.product||d.product||{}:d.product||{};}
function agentAIPokazPierwszyBrak(button){
  const form=button?.closest("form"),d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected),p=agentAIProduktZFormularzaDoOceny(form,source),audit=agentAIOcenaDodaniaProduktu(p,{...d,needsChoice:selected<0&&d.needsChoice});
  const text=audit.blockers[0]||audit.warnings[0]||"",name=/nazw/i.test(text)?"nazwa":/cen/i.test(text)?"cena":/kategor/i.test(text)?"kategoria":/ean/i.test(text)?"gtin":/kod/i.test(text)?"kodProducenta":/zdję/i.test(text)?"zdjecie":/krótki/i.test(text)?"opisKrotki":/opis/i.test(text)?"opis":"producentUrl",el=form?.elements?.[name];
  if(el){el.focus();el.scrollIntoView({behavior:"smooth",block:"center"});toast(`Uzupełnij: ${text}`);}else toast(text||"Wybierz najpierw właściwy wariant produktu");
}
function agentAIDodajProduktZAnalizy(button){
  const form=button?.closest("form"),d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected),p=agentAIProduktZFormularzaDoOceny(form,source),audit=agentAIOcenaDodaniaProduktu(p,{...d,needsChoice:selected<0&&d.needsChoice});
  if(!audit.ready){toast("Agent zatrzymał dodanie: "+audit.blockers.join(" • "));return;}
  const kontrola=produktDodawanieAktualizuj(form);if(!kontrola?.canSubmit){form?.querySelector("[data-product-add-control]")?.scrollIntoView({behavior:"smooth",block:"start"});toast(kontrola?.potential&&!kontrola.acknowledged?"Najpierw zdecyduj, czy podobna pozycja jest innym produktem":"Najpierw zakończ kontrolę danych i duplikatów");return;}
  form.dataset.agentAdd="1";form.dataset.agentLinkConfidence=String(selected>=0?d.alternatives?.[selected]?.confidence||d.confidence||0:d.confidence||0);const approval=form.querySelector("[data-product-final-approval]");approval?.scrollIntoView({behavior:"smooth",block:"center"});approval?.focus();toast("Dane są gotowe — sprawdź formularz i zatwierdź dodanie produktu");
}
function agentAIAktualizujIstniejacyZAnalizy(id,button){
  const d=agentAIImportUrlStan.data||{},selected=agentAIImportUrlStan.selected,source=agentAIWybranyProduktImportu(d,selected);if(!source?.nazwa){toast("Brak danych analizy do aktualizacji");return;}
  const category=agentAIDobierzKategorieProduktu(source),canonical=allegroProducentKanoniczny(source),fields={...source,kategoria:category.name||source.kategoria||"",producent:canonical||source.producent||source.marka||"",marka:source.marka||canonical||source.producent||"",agentImportAt:new Date().toISOString(),agentImportConfidence:selected>=0?d.alternatives?.[selected]?.confidence||d.confidence||0:d.confidence||0,agentImportSource:d.fromCache?"pamięć Agenta":"link producenta"};delete fields.id;
  zapiszPolaProduktuLokalnie(id,fields,true);const updated=pobierzProduktAdmin(id)||{id,...fields};agentAIZakonczLinkProducenta(updated.sourceUrl||updated.producentUrl,updated);zapiszHistorieAgenta("produkt-z-linku",`Agent uzupełnił istniejący produkt #${id}: ${updated.nazwa||source.nazwa}`,{produktId:id,zrodlo:fields.agentImportSource,confidence:fields.agentImportConfidence});if(chmuraToken)void chmuraZapiszUstawienia();toast("Istniejący produkt uzupełniony — nie utworzono duplikatu");location.hash=`#/admin/produkty/edytuj/${encodeURIComponent(String(id))}`;
}
function agentAIWariantyJednegoLinkuHTML(d={}){
  const alternatives=Array.isArray(d.alternatives)?d.alternatives:[];
  return `<div class="product-link-agent-report needs-choice"><header><div><span>🤖 Agent rozpoznał kilka kart</span><h3>Wybierz właściwy produkt</h3><small>Tylko w tej wyjątkowej sytuacji potrzebna jest jedna decyzja. Po wyborze Agent wykona całą resztę.</small></div><span class="lvl lvl-ostrzezenie">${alternatives.length} możliwości</span></header><div class="product-link-candidate-grid">${alternatives.map((c,i)=>`<article>${c.product?.zdjecie?`<img src="${esc(c.product.zdjecie)}" alt="">`:`<span>📦</span>`}<div><b>${esc(c.product?.nazwa||`Produkt ${i+1}`)}</b><small>EAN ${esc(c.product?.ean||c.product?.gtin||"—")} • kod ${esc(c.product?.kodProducenta||c.product?.mpn||"—")}</small><small>${esc(c.confidence||0)}% • ${esc(c.url||"")}</small></div><button class="btn" type="button" onclick="agentAIWybierzWariantJednegoLinku(${i},this)">Wybierz — Agent zrobi resztę</button></article>`).join("")}</div></div>`;
}
async function agentAIPrzygotujProduktZJednegoLinku(d={},url="",box=null){
  const product=agentAIProduktGotowyZLinku(d,url);
  agentAIImportUrlStan={busy:false,data:d,selected:Number.isInteger(d.selectedChoice)?d.selectedChoice:0,error:""};
  try{sessionStorage.setItem("artway_prefill_product",JSON.stringify({...product,_agentLinkUrl:url,_agentPrepared:true}));}catch(e){}
  if(box)box.innerHTML=`<div class="product-link-agent-report"><header><div><span>✅ Dane przygotowane</span><h3>${esc(product.nazwa||"Produkt")}</h3><small>Agent nie zapisał kartoteki. Sprawdź wspólny formularz i samodzielnie zatwierdź dodanie produktu.</small></div><span class="lvl lvl-ok">oczekuje na decyzję</span></header></div>`;
  toast("✅ Dane przygotowane — produkt czeka na Twoje zatwierdzenie");
  location.hash="#/admin/produkty/dodaj?agent=1";
  return {mode:"awaiting_approval",product};
}
async function agentAIUruchomJedenLink(url,button=null,choice=null){
  const clean=String(url||"").trim(),box=document.querySelector("[data-one-link-result]");if(!/^https?:\/\//i.test(clean)){toast("Wklej pełny adres konkretnego produktu, zaczynający się od https://");document.querySelector("[data-one-link-url]")?.focus();return;}
  if(button)button.disabled=true;if(box)box.innerHTML=`<div class="product-link-one-progress"><span>🤖</span><div><b>Agent analizuje konkretny produkt…</b><small>Pobieram dane bezpośrednio ze wskazanej strony, następnie sprawdzam duplikaty, kategorię i przygotowanie Allegro.</small></div></div>`;agentAIZapiszLinkProducenta(clean,"pobieranie","Agent rozpoczął kompletny import z jednego adresu");
  try{const body={url:clean,...(Number.isInteger(choice)?{choice}: {})},d=await chmura("product-url-prepare",{method:"POST",body,timeout:120000});agentAIImportUrlStan={busy:false,data:d,selected:d.needsChoice?-1:(Number.isInteger(choice)?choice:0),error:""};if(d.needsChoice){if(box)box.innerHTML=agentAIWariantyJednegoLinkuHTML(d);return;}await agentAIPrzygotujProduktZJednegoLinku(d,clean,box);}catch(e){const nextRetryAt=agentAINastepnaProbaLinku(1);agentAIImportUrlStan={busy:false,data:null,selected:-1,error:e.message||String(e)};agentAIZapiszLinkProducenta(clean,"oczekuje",e.message||String(e),{nextRetryAt,failureCode:e.code||"fetch_error",diagnostics:e.linkDiagnostics||{}});if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>⚠️ Nie udało się odczytać źródła</span><h3>Agent zapisał adres do ponowienia</h3><small>${esc(e.message||e)}</small></div><span class="lvl lvl-ostrzezenie">bez utraty linku</span></header><div class="backend-note">Nie utworzono pustego ani błędnego produktu. Agent ponowi próbę, a Ty możesz użyć tego samego pola ponownie.</div></div>`;toast("⚠️ Nie utworzono produktu — link zachowano dla Agenta");}finally{if(button)button.disabled=false;}
}
async function agentAIDodajProduktTylkoZLinku(event){event.preventDefault();const form=event.currentTarget,button=event.submitter||form.querySelector('button[type="submit"]');await agentAIUruchomJedenLink(form.elements.url?.value,button,null);}
async function agentAIWybierzWariantJednegoLinku(index,button){const d=agentAIImportUrlStan.data||{},url=d.requestedUrl||document.querySelector("[data-one-link-url]")?.value||d.alternatives?.[index]?.url||"";await agentAIUruchomJedenLink(url,button,index);}
async function pobierzDaneProduktuZUrl(btn){
  const form=btn.closest("form");
  const url=String(form?.elements?.producentUrl?.value||"").trim();
  if(!url){ toast("⚠️ Wklej adres strony produktu producenta"); return; }
  const overwrite=!!form?.elements?.nadpiszImportUrl?.checked;
  const progressBox=form?.querySelector("[data-product-link-agent-result]");if(progressBox)progressBox.innerHTML=`<div class="product-link-fetch-progress"><div><span>🤖</span><b>Agent przygotowuje produkt z linku</b><small>Źródło → dane i kody → duplikaty → gotowy formularz</small></div><div class="product-link-fetch-track"><span></span></div><div class="product-link-fetch-stages"><span class="active">1. Źródło</span><span>2. Dane</span><span>3. Duplikaty</span><span>4. Formularz</span></div></div>`;
  try{
    btn.disabled=true;
    toast("Pobieram dane produktu ze strony producenta…");
    agentAIImportUrlStan={busy:true,data:null,selected:0,error:""};const d=await chmura("product-url-prepare",{method:"POST",body:{url},timeout:90000});agentAIImportUrlStan={busy:false,data:d,selected:d.needsChoice?-1:0,error:""};
    const p=d.product||{};
    const braki=d.needsChoice?[]:agentAIUzupelnijFormularzZLinku(form,p,d,overwrite,d.canonicalUrl||d.resolvedUrl||url);
    const box=form.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(d,d.needsChoice?-1:0);
    agentAIZapiszLinkProducenta(url,d.needsChoice?"wymaga wyboru":braki.length?"do uzupełnienia":"pobrano",d.needsChoice?`Znaleziono ${d.alternatives?.length||2} produkty — wybierz wariant`:braki.length?`Pobrano częściowo — braki: ${braki.join(", ")}`:"Pobrano i dopasowano do formularza",{lastProductName:p.nazwa||"",lastProduct:agentAIProduktZLinkuMini(p),lastMissing:braki,lastCandidates:(d.alternatives||[]).map(x=>({...x,product:agentAIProduktZLinkuMini(x.product||{})})),lastAvailability:p.dostepnoscProducenta||d.availability?.text||"",lastPrice:p.cena||"",linkConfidence:d.confidence||0,fieldSources:d.fieldSources||{},diagnostics:d.diagnostics||{},resolvedUrl:d.resolvedUrl||d.canonicalUrl||url,nextRetryAt:null});
    toast(d.needsChoice?`Agent znalazł ${d.alternatives?.length||2} produkty — wybierz właściwy poniżej`:braki.length?`Pobrano ${d.confidence||0}% danych; braki: ${braki.join(", ")}`:`Dane pobrane i dopasowane • kompletność ${d.confidence||0}%`);
  }catch(e){
    const cached=agentAIWynikLinkuZPamieci(url);
    if(cached){
      const p=cached.product||{},braki=cached.needsChoice?[]:agentAIUzupelnijFormularzZLinku(form,p,cached,overwrite,cached.canonicalUrl||cached.resolvedUrl||url);agentAIImportUrlStan={busy:false,data:cached,selected:cached.needsChoice?-1:0,error:""};const box=form?.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=agentAIRaportLinkuHTML(cached,cached.needsChoice?-1:0);const proby=Number((agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===normalizujUrlProducenta(url))?.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);agentAIZapiszLinkProducenta(url,cached.needsChoice?"wymaga wyboru":"oczekuje","Użyto pamięci Agenta; świeża kontrola zostanie ponowiona",{proby,nextRetryAt,lastProduct:agentAIProduktZLinkuMini(p),lastCandidates:cached.alternatives||[],linkConfidence:cached.confidence||0,resolvedUrl:cached.resolvedUrl||url});toast(cached.needsChoice?`Pamięć Agenta znalazła ${cached.alternatives.length} warianty — wybierz właściwy`:`Producent chwilowo nie odpowiedział — użyto ostatnich poprawnych danych (${cached.confidence||0}%)`);return;
    }
    const current=(agentAILinkiProducentow||[]).find(x=>normalizujUrlProducenta(x.url)===normalizujUrlProducenta(url)),proby=Number(current?.proby||0)+1,nextRetryAt=agentAINastepnaProbaLinku(proby);agentAIImportUrlStan={busy:false,data:null,selected:-1,error:e.message||String(e)};
    agentAIZapiszLinkProducenta(url,"oczekuje",e.message||String(e),{proby,nextRetryAt,failureCode:e.code||"fetch_error",diagnostics:e.linkDiagnostics||{},lastError:e.message||String(e)});
    const box=form?.querySelector("[data-product-link-agent-result]");if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>⚠️ Agent linków</span><h3>Nie udało się pobrać produktu</h3><small>${esc(e.message||e)}</small></div><span class="lvl lvl-ostrzezenie">ponowienie zaplanowane</span></header><div class="backend-note">Następna automatyczna próba: <b>${esc(new Date(nextRetryAt).toLocaleString("pl-PL"))}</b>. Możesz poprawić adres albo użyć przycisku ponownie ręcznie.</div></div>`;
    toast(`⚠️ Link zapisany; następna próba ${new Date(nextRetryAt).toLocaleString("pl-PL")}`);
  }
  finally{ btn.disabled=false; }
}
