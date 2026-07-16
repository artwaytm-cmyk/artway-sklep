/* Mobilne QR magazynu. Biblioteki są ładowane dopiero przy uruchomieniu aparatu
   lub podglądu etykiet, aby nie obciążać zwykłej pracy panelu. */
let magazynQRTryb="lokalizacje",magazynQRFraza="",magazynQRTyp="wszystkie",magazynQRFormat="62x38";
let magazynQRZaznaczone=new Set(),magazynQRSkrypty={},magazynQRWynikiBiezace=[];

function magazynQRZaladujSkrypt(src,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  if(magazynQRSkrypty[src])return magazynQRSkrypty[src];
  magazynQRSkrypty[src]=new Promise((resolve,reject)=>{
    const old=document.querySelector(`script[data-warehouse-vendor="${CSS.escape(src)}"]`);
    if(old){old.addEventListener("load",()=>resolve(window[globalName]),{once:true});old.addEventListener("error",reject,{once:true});return;}
    const script=document.createElement("script");script.src=src;script.defer=true;script.dataset.warehouseVendor=src;
    script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error(`Nie uruchomiono ${globalName}`));
    script.onerror=()=>reject(new Error(`Nie udało się pobrać ${src}`));document.head.appendChild(script);
  });
  return magazynQRSkrypty[src];
}
function magazynQRLadujCzytnik(){return magazynQRZaladujSkrypt("/assets/vendor/jsQR.js","jsQR");}
function magazynQRLadujGenerator(){return magazynQRZaladujSkrypt("/assets/vendor/qrcode-generator.js","qrcode");}
function magazynQREncode(value=""){return encodeURIComponent(String(value||"").trim());}
function magazynQRDecode(value=""){try{return decodeURIComponent(String(value||""));}catch{return String(value||"");}}
function magazynQRPayloadLokalizacji(kod){return `ATW:1:L:${magazynQREncode(kodLokalizacjiMagazynu(kod))}`;}
function magazynQRPayloadProduktu(id){return `ATW:1:P:${magazynQREncode(id)}`;}
function magazynQRParsujOdczyt(raw=""){
  const value=String(raw||"").trim();
  let match=value.match(/^ATW:1:L:(.+)$/i);if(match){const code=kodLokalizacjiMagazynu(magazynQRDecode(match[1]));return {type:"location",code,raw:value,explicit:true};}
  match=value.match(/^ATW:1:P:(.+)$/i);if(match)return {type:"product",productId:magazynQRDecode(match[1]),raw:value,explicit:true};
  const location=(typeof magazynLokalizacjaPoKodzie==="function"?magazynLokalizacjaPoKodzie(value):null)||(typeof magazynLokalizacjeAktywne==="function"?magazynLokalizacjeAktywne().find(item=>String(item.kodKreskowy||"").trim()===value):null);
  return location?{type:"location",code:location.kod,raw:value,explicit:false}:{type:"code",scanCode:value,raw:value};
}
function magazynQROdczytajZVideo(video,state={}){
  if(typeof window.jsQR!=="function"||!video?.videoWidth||!video?.videoHeight)return "";
  const maxWidth=720,ratio=Math.min(1,maxWidth/video.videoWidth),width=Math.max(1,Math.round(video.videoWidth*ratio)),height=Math.max(1,Math.round(video.videoHeight*ratio));
  const canvas=state.canvas||(state.canvas=document.createElement("canvas")),ctx=state.context||(state.context=canvas.getContext("2d",{willReadFrequently:true}));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  ctx.drawImage(video,0,0,width,height);const image=ctx.getImageData(0,0,width,height),result=window.jsQR(image.data,width,height,{inversionAttempts:"dontInvert"});return String(result?.data||"").trim();
}
function magazynQRKlucz(type,id){return `${type}:${String(id)}`;}
function magazynQRProduktPoId(id){return (typeof produktyDoAdministracji==="function"?produktyDoAdministracji():[]).find(p=>String(p.id)===String(id))||null;}
function magazynQRWszystkieProdukty(){return (typeof produktyDoAdministracji==="function"?produktyDoAdministracji():[]).filter(p=>typeof czyProduktAdminWKoszu!=="function"||!czyProduktAdminWKoszu(p));}
function magazynQRPozycje(){
  const query=String(magazynQRFraza||"").trim().toLowerCase();
  if(magazynQRTryb==="lokalizacje")return (typeof magazynLokalizacjeAktywne==="function"?magazynLokalizacjeAktywne():[]).filter(l=>(magazynQRTyp==="wszystkie"||l.typ===magazynQRTyp)&&(!query||`${l.kod} ${l.nazwa||""} ${l.typ||""} ${l.strefa||""} ${l.kodKreskowy||""}`.toLowerCase().includes(query))).slice(0,120).map(l=>({type:"L",id:l.kod,title:l.nazwa||l.kod,subtitle:sciezkaNazwLokalizacjiMagazynu(l.kod),meta:`Kod: ${l.kod}`}));
  if(query.length<2)return [];
  return magazynQRWszystkieProdukty().filter(p=>`${p.nazwa||""} ${p.id||""} ${p.externalId||""} ${p.sku||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""}`.toLowerCase().includes(query)).slice(0,120).map(p=>({type:"P",id:p.id,title:p.nazwa||`Produkt ${p.id}`,subtitle:`${p.externalId||p.sku||`ID ${p.id}`} • EAN ${p.gtin||p.ean||"—"}`,meta:nazwaLokalizacjiMagazynu(magazynMetaProduktu(p.id).lokalizacja)||"Brak lokalizacji",image:p.zdjecie||""}));
}
function magazynQROdswiezCentrum(){const root=document.getElementById("warehouseQrWorkspace");if(root)root.innerHTML=magazynQRGeneratorWnetrzeHTML();}
function magazynQRUstawTryb(type){magazynQRTryb=type==="produkty"?"produkty":"lokalizacje";magazynQRFraza="";magazynQRWynikiBiezace=[];magazynQROdswiezCentrum();}
function magazynQRSzukaj(input){magazynQRFraza=String(input?.value||"");clearTimeout(window.__warehouseQrSearch);window.__warehouseQrSearch=setTimeout(magazynQROdswiezCentrum,220);}
function magazynQRUstawTyp(value){magazynQRTyp=String(value||"wszystkie");magazynQROdswiezCentrum();}
function magazynQRPrzelacz(type,id,checked){const key=magazynQRKlucz(type,id);if(checked)magazynQRZaznaczone.add(key);else magazynQRZaznaczone.delete(key);magazynQRAktualizujLicznik();}
function magazynQRAktualizujLicznik(){document.querySelectorAll("[data-warehouse-qr-selected]").forEach(el=>el.textContent=String(magazynQRZaznaczone.size));document.querySelectorAll("[data-warehouse-qr-required]").forEach(el=>el.disabled=!magazynQRZaznaczone.size);}
function magazynQRZaznaczWidoczne(checked=true){magazynQRWynikiBiezace.forEach(item=>{const key=magazynQRKlucz(item.type,item.id);if(checked)magazynQRZaznaczone.add(key);else magazynQRZaznaczone.delete(key);});magazynQROdswiezCentrum();}
function magazynQRWyczysc(){magazynQRZaznaczone.clear();magazynQROdswiezCentrum();}
function magazynQRGeneratorWnetrzeHTML(){
  const locations=typeof magazynLokalizacjeAktywne==="function"?magazynLokalizacjeAktywne():[],items=magazynQRPozycje();magazynQRWynikiBiezace=items;
  const types=[...new Set(locations.map(x=>x.typ).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
  return `<div class="warehouse-qr-tabs"><button class="${magazynQRTryb==="lokalizacje"?"active":""}" type="button" onclick="magazynQRUstawTryb('lokalizacje')">🗺️ Regały i półki</button><button class="${magazynQRTryb==="produkty"?"active":""}" type="button" onclick="magazynQRUstawTryb('produkty')">📦 Produkty</button></div><div class="warehouse-qr-toolbar"><label><span>Wyszukaj</span><input value="${esc(magazynQRFraza)}" placeholder="${magazynQRTryb==="lokalizacje"?"Kod, nazwa, strefa lub typ…":"Nazwa, EAN, EXTERNAL_ID, SKU…"}" oninput="magazynQRSzukaj(this)" autocomplete="off"></label>${magazynQRTryb==="lokalizacje"?`<label><span>Typ miejsca</span><select onchange="magazynQRUstawTyp(this.value)"><option value="wszystkie">Wszystkie poziomy</option>${types.map(type=>`<option value="${esc(type)}" ${magazynQRTyp===type?"selected":""}>${esc(type)}</option>`).join("")}</select></label>`:""}<label><span>Format wydruku</span><select onchange="magazynQRFormat=this.value"><option value="62x38" ${magazynQRFormat==="62x38"?"selected":""}>Etykieta 62 × 38 mm</option><option value="70x50" ${magazynQRFormat==="70x50"?"selected":""}>Etykieta 70 × 50 mm</option><option value="a4" ${magazynQRFormat==="a4"?"selected":""}>Arkusz A4</option></select></label></div><div class="warehouse-qr-bulk"><label><input type="checkbox" onchange="magazynQRZaznaczWidoczne(this.checked)"> Zaznacz/odznacz widoczne (${items.length})</label><span>Wybrano <b data-warehouse-qr-selected>${magazynQRZaznaczone.size}</b></span><button class="btn ghost" type="button" onclick="magazynQRWyczysc()" ${magazynQRZaznaczone.size?"":"disabled"}>Wyczyść</button><button class="btn" type="button" data-warehouse-qr-required onclick="magazynQROtworzPodglad()" ${magazynQRZaznaczone.size?"":"disabled"}>🖨️ Podgląd i druk</button></div><div class="warehouse-qr-results">${items.map(item=>{const selected=magazynQRZaznaczone.has(magazynQRKlucz(item.type,item.id));return `<label class="warehouse-qr-result ${selected?"selected":""}"><input type="checkbox" ${selected?"checked":""} onchange="magazynQRPrzelacz(${jsArg(item.type)},${jsArg(item.id)},this.checked)">${item.image?`<img src="${esc(item.image)}" alt="">`:`<span class="warehouse-qr-result-icon">${item.type==="L"?"🗺️":"📦"}</span>`}<span><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small><em>${esc(item.meta)}</em></span><button type="button" onclick="event.preventDefault();event.stopPropagation();magazynQROtworzJedna(${jsArg(item.type)},${jsArg(item.id)})">QR</button></label>`;}).join("")||`<div class="warehouse-qr-empty"><b>${magazynQRTryb==="produkty"&&String(magazynQRFraza).trim().length<2?"Wpisz co najmniej 2 znaki":"Brak wyników"}</b><span>${magazynQRTryb==="produkty"?"Wyszukiwanie działa po nazwie i wszystkich identyfikatorach produktu.":"Zmień filtr albo utwórz strukturę magazynu."}</span></div>`}</div>${items.length>=120?`<p class="warehouse-qr-limit">Pokazano pierwsze 120 wyników. Doprecyzuj wyszukiwanie przed wydrukiem.</p>`:""}`;
}
function magazynQRCentrumHTML(){
  const locations=typeof magazynLokalizacjeAktywne==="function"?magazynLokalizacjeAktywne():[];
  return `<section class="panel warehouse-qr-center warehouse-qr-page"><div class="order-section-head"><div><span class="order-pro-label">Osobne centrum oznaczeń magazynowych</span><h1>🏷️ Etykiety i kody QR</h1><p class="order-detail-lead">Twórz, zaznaczaj i drukuj etykiety dla obszarów, regałów, półek, miejsc oraz produktów. Generator nie zmienia stanów ani kartotek — przygotowuje wyłącznie bezpieczne oznaczenia do skanowania.</p></div><div class="warehouse-qr-page-actions"><span class="warehouse-qr-ready">${locations.length?"✅":"⚠️"} ${locations.length} lokalizacji gotowych</span><a class="btn ghost" href="#/admin/magazyn/lokalizacje">🗺️ Zarządzaj lokalizacjami</a><a class="btn ghost" href="#/admin/magazyn/plan">📦 Przejdź do PZ/WZ</a></div></div><div class="warehouse-qr-flow"><span><b>1</b><strong>Wybierz zakres</strong><small>lokalizacje albo produkty</small></span><span><b>2</b><strong>Zaznacz pozycje</strong><small>pojedynczo lub grupowo</small></span><span><b>3</b><strong>Wybierz format</strong><small>62×38, 70×50 lub A4</small></span><span><b>4</b><strong>Drukuj lub zapisz PDF</strong><small>gotowe do użycia telefonem</small></span></div><section class="warehouse-qr-generator"><header class="warehouse-qr-generator-head"><span><b>🏷️ Generator etykiet QR</b><small>Druk dla regałów, półek, miejsc i konkretnych produktów.</small></span><strong>Dane pozostają w sklepie</strong></header><div id="warehouseQrWorkspace">${magazynQRGeneratorWnetrzeHTML()}</div></section><div class="warehouse-qr-page-note"><b>📱 Jak używać po wydruku?</b><span>W Planie zatowarowania otwórz PZ albo WZ, uruchom aparat telefonu, zeskanuj najpierw lokalizację, a następnie produkty.</span></div></section>`;
}
function magazynQREtykietaDane(type,id){
  if(type==="L"){const l=magazynLokalizacjaPoKodzie(id);if(!l)return null;return {type:"location",payload:magazynQRPayloadLokalizacji(l.kod),title:l.nazwa||l.kod,subtitle:sciezkaNazwLokalizacjiMagazynu(l.kod),meta:`Kod: ${l.kod}`};}
  const p=magazynQRProduktPoId(id);if(!p)return null;const meta=magazynMetaProduktu(p.id);return {type:"product",payload:magazynQRPayloadProduktu(p.id),title:p.nazwa||`Produkt ${p.id}`,subtitle:p.externalId||p.sku||`ID ${p.id}`,meta:`EAN ${p.gtin||p.ean||"—"}${meta.lokalizacja?` • ${meta.lokalizacja}`:""}`};
}
function magazynQRSvg(payload){const qr=window.qrcode(0,"M");qr.addData(String(payload),"Byte");qr.make();return qr.createSvgTag({cellSize:4,margin:2,scalable:true});}
function magazynQREtykietyHTML(items){return items.map(item=>`<article class="warehouse-qr-label label-${item.type}"><div class="warehouse-qr-code" aria-label="Kod QR: ${esc(item.title)}">${magazynQRSvg(item.payload)}</div><div><span>${item.type==="location"?"LOKALIZACJA":"PRODUKT"}</span><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small><em>${esc(item.meta)}</em></div></article>`).join("");}
async function magazynQROtworzPodglad(keys=[...magazynQRZaznaczone]){
  if(!keys.length){toast("Zaznacz co najmniej jedną etykietę");return;}
  try{await magazynQRLadujGenerator();const items=keys.map(key=>{const pos=String(key).indexOf(":");return magazynQREtykietaDane(String(key).slice(0,pos),String(key).slice(pos+1));}).filter(Boolean).slice(0,500);if(!items.length){toast("Nie znaleziono danych etykiet");return;}
    document.getElementById("warehouseQrPreview")?.remove();const modal=document.createElement("div");modal.id="warehouseQrPreview";modal.className="warehouse-qr-preview";modal.innerHTML=`<div class="warehouse-qr-preview-card"><header><div><b>🏷️ Podgląd etykiet</b><small>${items.length} etykiet • kody działają bez połączenia z zewnętrznym serwisem</small></div><div><select onchange="magazynQRZmienFormat(this.value)"><option value="62x38" ${magazynQRFormat==="62x38"?"selected":""}>62 × 38 mm</option><option value="70x50" ${magazynQRFormat==="70x50"?"selected":""}>70 × 50 mm</option><option value="a4" ${magazynQRFormat==="a4"?"selected":""}>Arkusz A4</option></select><button class="btn" type="button" onclick="magazynQRDrukuj()">🖨️ Drukuj / zapisz PDF</button><button class="btn ghost" type="button" onclick="magazynQRZamknijPodglad()">Zamknij</button></div></header><div id="warehouseQrPrintArea" class="warehouse-qr-sheet format-${esc(magazynQRFormat)}">${magazynQREtykietyHTML(items)}</div></div>`;document.body.appendChild(modal);
  }catch(error){toast(`Nie udało się przygotować QR: ${error.message||error}`);}
}
function magazynQROtworzJedna(type,id){return magazynQROtworzPodglad([magazynQRKlucz(type,id)]);}
function magazynQROtworzLokalizacje(kod){return magazynQROtworzJedna("L",kod);}
function magazynQROtworzProdukt(id){return magazynQROtworzJedna("P",id);}
function magazynQRZmienFormat(value){magazynQRFormat=["62x38","70x50","a4"].includes(value)?value:"62x38";const sheet=document.getElementById("warehouseQrPrintArea");if(sheet)sheet.className=`warehouse-qr-sheet format-${magazynQRFormat}`;}
function magazynQRDrukuj(){document.body.classList.add("warehouse-qr-printing");const done=()=>document.body.classList.remove("warehouse-qr-printing");window.addEventListener("afterprint",done,{once:true});window.print();setTimeout(done,1500);}
function magazynQRZamknijPodglad(){document.body.classList.remove("warehouse-qr-printing");document.getElementById("warehouseQrPreview")?.remove();}
