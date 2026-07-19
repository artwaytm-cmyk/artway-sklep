function czyEAN(v){
  const c=tylkoCyfry(v);
  return [8,12,13,14].includes(c.length);
}
function kodOperacyjnyProduktu(p, meta={}){
  return String(p?.kodProducenta || p?.mpn || p?.externalId || p?.sku || meta.kod || "").trim();
}
function eanOperacyjnyProduktu(p, meta={}){
  const kandydaci=[meta.ean,meta.ean13,meta.kodEan,p?.ean,p?.gtin,p?.kodEan,meta.kod,p?.kod].filter(Boolean);
  const e=kandydaci.find(czyEAN) || kandydaci[0] || "";
  return String(e||"").trim();
}
function mapaZamowienDlaProduktow(){
  const mapa={};
  pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).forEach(z=>{
    pozycjeZamowieniaMagazyn(z).forEach(p=>{
      const k=String(p.id);
      const rec=mapa[k]||(mapa[k]={ilosc:0,zamowienia:{},numery:[]});
      rec.ilosc+=Number(p.ilosc)||0;
      rec.zamowienia[z.nr]=(rec.zamowienia[z.nr]||0)+(Number(p.ilosc)||0);
    });
  });
  aktywneZamowieniaAllegro().forEach(z=>{
    pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{
      const k=String(p.id), numer=`Allegro ${z.id||z.nr}`;
      const rec=mapa[k]||(mapa[k]={ilosc:0,zamowienia:{},numery:[]});
      rec.ilosc+=Number(p.ilosc)||0;
      rec.zamowienia[numer]=(rec.zamowienia[numer]||0)+(Number(p.ilosc)||0);
    });
  });
  Object.values(mapa).forEach(rec=>{rec.numery=Object.entries(rec.zamowienia).map(([nr,ilosc])=>`${nr} × ${ilosc}`).slice(0,12);});
  return mapa;
}
function agentAIPozycjeZleceniaProducenta(tryb="braki",limit=500){
  const mode=String(tryb||"braki").toLowerCase(), zamMap=mapaZamowienDlaProduktow(), rez=rezerwacjeMagazynowe();
  let wiersze=[];
  if(mode==="niskie"){
    wiersze=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>{
      const stan=stanMagazynuId(p.id);
      if(stan===null) return null;
      const r=Number(rez[p.id]||0), dost=stan-r, min=progNiskiProduktu(p), target=targetStockProduktu(p,0), meta=magazynMetaProduktu(p.id);
      if(stan>min && dost>=min) return null;
      return {produkt:p,ilosc:Math.max(1,target-Math.max(0,dost)),stan,rezerwacje:r,dostepne:dost,meta,powod:`stan ${stan}, dostępne po rezerwacjach ${dost}, próg ${min}`,zamowienia:zamMap[String(p.id)]?.numery||[]};
    }).filter(Boolean);
  }else{
    wiersze=potrzebyZatowarowania().map(x=>({produkt:x.produkt,ilosc:x.ilosc,stan:x.stan,rezerwacje:x.rezerwacje,dostepne:x.dostepne,meta:x.meta,powod:x.powod,zamowienia:zamMap[String(x.produkt.id)]?.numery||[]}));
  }
  return wiersze.slice(0,limit).map(x=>{
    const p=x.produkt, meta=x.meta||{}, kod=kodOperacyjnyProduktu(p,meta), ean=eanOperacyjnyProduktu(p,meta), dostawca=agentAIDostawcaProduktu(p,meta);
    return {
      produktId:String(p.id),
      kod,
      kodProducenta:String(p.kodProducenta||p.mpn||"").trim(),
      externalId:String(p.externalId||"").trim(),
      sku:String(p.sku||"").trim(),
      ean,
      nazwa:p.nazwa||"Produkt",
      kategoria:p.kategoria||"",
      ilosc:Number(x.ilosc)||0,
      stan:x.stan===null?null:Number(x.stan||0),
      rezerwacje:Number(x.rezerwacje||0),
      dostepne:x.dostepne===null?null:Number(x.dostepne||0),
      iloscPotrzebna:Number(x.ilosc)||0,
      przyjeto:0,
      nadwyzka:0,
      lokalizacja:meta.lokalizacja||"",
      dostawca,
      powod:x.powod||"",
      zamowienia:Array.isArray(x.zamowienia)?x.zamowienia:[]
    };
  });
}
function agentAIDostawcaProduktu(p={},meta={}){
  const kartoteka=String(meta.dostawca||"").trim();
  if(kartoteka)return kartoteka;
  const producent=String(p.producent||p.marka||"").trim();
  if(producent){
    const key=producent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-");
    if(key.includes("alexander"))return typeof producentPoNazwie==="function"?(producentPoNazwie("Alexander")?.name||"Alexander"):"Alexander";
    if(key.includes("multigra"))return typeof producentPoNazwie==="function"?(producentPoNazwie("Multigra")?.name||"Multigra"):"Multigra";
    return producent;
  }
  const url=String(p.producentUrl||p.sourceUrl||p.agentImportUrl||"").toLowerCase();
  if(url.includes("alexander"))return "Alexander";
  if(url.includes("multigra"))return "Multigra";
  return "";
}
function agentAIAktywneIlosciUProducentow(){
  const mapa={};
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[])
    .filter(agentAIPlanDokumentAktywny)
    .forEach(z=>(Array.isArray(z.pozycje)?z.pozycje:[]).forEach(p=>{
      const id=String(p.produktId||"");
      if(!id)return;
      const pozostalo=Math.max(0,(Number(p.ilosc)||0)-(Number(p.przyjeto)||0));
      mapa[id]=(mapa[id]||0)+pozostalo;
    }));
  return mapa;
}
function agentAIBrakiOperacyjne(){
  const aktywne=agentAIAktywneIlosciUProducentow();
  return agentAIPozycjeZleceniaProducenta("braki",1000).map(p=>{
    const brak=Math.max(0,Number(p.ilosc)||0), wZleceniach=Math.max(0,Number(aktywne[String(p.produktId)]||0));
    return {...p,brakCalkowity:brak,wZleceniach,pozostaloDoZamowienia:Math.max(0,brak-wZleceniach)};
  });
}
function agentAIGrupujPoDostawcy(pozycje=[]){
  const grupy={};
  (Array.isArray(pozycje)?pozycje:[]).forEach(p=>{const d=String(p.dostawca||"Bez przypisanego dostawcy").trim()||"Bez przypisanego dostawcy";(grupy[d]||(grupy[d]=[])).push(p);});
  return Object.entries(grupy).sort(([a],[b])=>a.localeCompare(b,"pl"));
}
function agentAIFormatZleceniaProducenta(zlecenie){
  if(!zlecenie||!Array.isArray(zlecenie.pozycje)||!zlecenie.pozycje.length) return "Nie ma pozycji do zlecenia.";
  const grupy={};
  zlecenie.pozycje.forEach(x=>{const d=x.dostawca||"Bez przypisanego dostawcy";(grupy[d]||(grupy[d]=[])).push(x);});
  return [
    `🧾 ${zlecenie.numer||zlecenie.id} — ${zlecenie.tryb==="niskie"?"zlecenie uzupełniające":"zlecenie pod aktywne zamówienia"}`,
    `Status: ${zlecenie.status||"szkic"} • pozycji: ${zlecenie.pozycje.length} • sztuk: ${zlecenie.pozycje.reduce((s,x)=>s+Number(x.ilosc||0),0)}`,
    "",
    ...Object.entries(grupy).map(([d,items])=>[
      `Dostawca: ${d}`,
      ...items.map((x,i)=>`${i+1}. ${x.nazwa} — ${x.ilosc} szt. — kod: ${agentAIKodPozycjiProducenta(x)||"BRAK — uzupełnij kartotekę"} • lok.: ${x.lokalizacja||"—"}${x.zamowienia?.length?` • zam.: ${x.zamowienia.join(", ")}`:""}`),
      ""
    ].join("\n")),
    "Zlecenie zapisano w tabeli operacyjnej agenta. Nie zostało wysłane automatycznie do dostawcy."
  ].join("\n").trim();
}
function agentAIStatusRoboczyProducenta(status="szkic"){
  return ["szkic","do sprawdzenia","zaakceptowane","wysłane na telegram"].includes(String(status||"szkic").toLowerCase());
}
function agentAIDostawcaZlecenia(z={}){
  return String(z.supplier||z.dostawcy?.[0]||z.pozycje?.[0]?.dostawca||"Bez przypisanego dostawcy").trim()||"Bez przypisanego dostawcy";
}
function producentKlucz(v=""){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function producentPoNazwie(name=""){
  const key=producentKlucz(name);return (producenciKartoteka||[]).find(p=>producentKlucz(p.name||p.nazwa)===key)||null;
}
function producentDaneZFormularza(form,base={}){
  const f=new FormData(form),name=String(f.get("name")||"").trim();if(!name)return null;
  const {emailSubject:_staryTemat,emailIntro:_staryWstep,...safeBase}=base;
  return {...safeBase,id:base.id||`producer-${producentKlucz(name)||Date.now().toString(36)}`,name,legalName:String(f.get("legalName")||"").trim(),orderEmail:String(f.get("orderEmail")||"").trim().toLowerCase(),contactPerson:String(f.get("contactPerson")||"").trim(),phone:String(f.get("phone")||"").trim(),website:String(f.get("website")||"").trim(),address:String(f.get("address")||"").trim(),nip:String(f.get("nip")||"").trim(),leadTimeDays:Math.max(0,Number(f.get("leadTimeDays"))||0),minimumOrder:String(f.get("minimumOrder")||"").trim(),paymentTerms:String(f.get("paymentTerms")||"").trim(),notes:String(f.get("notes")||"").trim(),active:f.get("active")==="on",updatedAt:new Date().toISOString()};
}
function producentDodaj(e){
  e.preventDefault();const p=producentDaneZFormularza(e.target,{});if(!p){toast("Podaj nazwę producenta");return;}
  if(producentPoNazwie(p.name)){toast("Producent o tej nazwie już istnieje");return;}
  producenciKartoteka=[p,...(producenciKartoteka||[])];zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Dodano producenta ${p.name}`,{producentId:p.id});toast("Producent dodany ✅");renderuj();
}
function producentZapisz(e,id){
  e.preventDefault();const old=(producenciKartoteka||[]).find(p=>String(p.id)===String(id));if(!old)return;
  const p=producentDaneZFormularza(e.target,old);if(!p)return;
  producenciKartoteka=(producenciKartoteka||[]).map(x=>String(x.id)===String(id)?p:x);zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Zaktualizowano kartotekę ${p.name}`,{producentId:p.id,email:!!p.orderEmail});toast("Kartoteka producenta zapisana ✅");renderuj();
}
function producentUsun(id){
  const p=(producenciKartoteka||[]).find(x=>String(x.id)===String(id));if(!p)return;
  const powiazane=(agentAIZlecenia||[]).filter(z=>producentKlucz(agentAIDostawcaZlecenia(z))===producentKlucz(p.name));
  const aktywne=powiazane.filter(agentAIPlanDokumentAktywny);
  if(aktywne.length){
    producenciKartoteka=(producenciKartoteka||[]).map(x=>String(x.id)===String(id)?{...x,active:false,archivedAt:new Date().toISOString()}:x);
    zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Dezaktywowano kartotekę ${p.name} — istnieją aktywne dokumenty`,{producentId:p.id,aktywne:aktywne.length});toast(`Kartoteka ma ${aktywne.length} aktywne zamówienie(a) — została bezpiecznie dezaktywowana`);renderuj();return;
  }
  producenciKartoteka=(producenciKartoteka||[]).filter(x=>String(x.id)!==String(id));zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Usunięto kartotekę ${p.name}`,{producentId:p.id});toast("Kartoteka producenta usunięta");renderuj();
}
function producentFormHTML(p={}){
  const edit=!!p.id;return `<form class="producer-record-card" onsubmit="${edit?`producentZapisz(event,${jsArg(p.id)})`:`producentDodaj(event)`}"><div class="producer-record-head"><div><span class="supplier-chip">🏭 ${esc(p.name||"Nowy producent")}</span><h3>${edit?"Dane i kontakt":"Dodaj producenta"}</h3></div>${edit?`<span class="lvl ${p.orderEmail?"lvl-ok":"lvl-ostrzezenie"}">${p.orderEmail?"e-mail gotowy":"brak e-maila zamówień"}</span>`:""}</div><div class="producer-form-grid"><div class="f-group"><label>Nazwa producenta *</label><input name="name" required value="${esc(p.name||"")}" placeholder="np. Alexander"></div><div class="f-group"><label>Pełna nazwa firmy</label><input name="legalName" value="${esc(p.legalName||"")}"></div><div class="f-group"><label>E-mail do zamówień *</label><input name="orderEmail" type="email" value="${esc(p.orderEmail||"")}" placeholder="zamowienia@producent.pl"></div><div class="f-group"><label>Osoba kontaktowa</label><input name="contactPerson" value="${esc(p.contactPerson||"")}"></div><div class="f-group"><label>Telefon</label><input name="phone" value="${esc(p.phone||"")}"></div><div class="f-group"><label>Strona internetowa</label><input name="website" type="url" value="${esc(p.website||"")}" placeholder="https://..."></div><div class="f-group"><label>NIP</label><input name="nip" value="${esc(p.nip||"")}"></div><div class="f-group"><label>Adres</label><input name="address" value="${esc(p.address||"")}"></div><div class="f-group"><label>Standardowy czas realizacji (dni)</label><input name="leadTimeDays" type="number" min="0" value="${esc(p.leadTimeDays??3)}"></div><div class="f-group"><label>Minimum zamówienia</label><input name="minimumOrder" value="${esc(p.minimumOrder||"")}" placeholder="np. 500 zł"></div><div class="f-group"><label>Warunki płatności</label><input name="paymentTerms" value="${esc(p.paymentTerms||"")}" placeholder="np. przelew 7 dni"></div><label class="check"><input name="active" type="checkbox" ${p.active!==false?"checked":""}> Aktywny producent</label></div><details ${edit?"":"open"}><summary>Wysyłka i notatki</summary><div class="backend-note"><b>Stały bezpieczny szablon e-maila</b><p>Temat i treść powstają na serwerze z zatwierdzonej rewizji. Wiadomość zawiera wyłącznie kod, nazwę i zamawianą ilość — bez cen i wartości. Pełny podgląd zobaczysz w Planie zatowarowania przed wysłaniem.</p></div><div class="f-group"><label>Notatki wewnętrzne</label><textarea name="notes" rows="3">${esc(p.notes||"")}</textarea></div></details><div class="producer-record-actions"><button class="btn" type="submit">${edit?"💾 Zapisz kartotekę":"➕ Dodaj producenta"}</button>${edit&&p.website?`<a class="btn ghost" href="${esc(p.website)}" target="_blank" rel="noopener">🌐 Otwórz stronę</a>`:""}${edit?`<button class="btn danger" type="button" onclick="if(confirm('Usunąć tę kartotekę producenta?'))producentUsun(${jsArg(p.id)})">Usuń</button>`:""}</div></form>`;
}
function producenciKartotekaPanelHTML(){
  const list=(producenciKartoteka||[]).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pl")),ready=list.filter(p=>p.orderEmail&&p.active!==false).length;
  const summary=list.map(p=>{const docs=(agentAIZlecenia||[]).filter(z=>agentAIDostawcaZlecenia(z)===p.name),open=docs.filter(agentAIPlanDokumentAktywny).length,last=docs.slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")))[0];return `<div class="producer-summary-card"><div><span class="supplier-chip">🏭 ${esc(p.name)}</span><b>${esc(p.contactPerson||p.legalName||"Kontakt nieuzupełniony")}</b><small>${p.orderEmail?`✉️ ${esc(p.orderEmail)}`:"brak e-maila zamówień"}${p.phone?` • 📞 ${esc(p.phone)}`:""}</small></div><div><strong>${docs.length}</strong><small>zamówień • ${open} bieżących</small>${last?`<small>ostatnie: ${esc(last.numer||last.id)}</small>`:""}</div></div>`;}).join("");
  return `<div class="panel producer-directory"><div class="order-section-head"><div><span class="order-pro-label">Kartoteka zakupowa</span><h2 style="margin-top:.25rem">🏭 Producenci i kontakty</h2><p class="order-detail-lead">Adres e-mail z tej kartoteki jest jedynym adresem używanym do wysyłki zatwierdzonego zamówienia. Dane i kontakty synchronizują się ze wspólną bazą, a bezcenowy szablon wiadomości jest stały i chroniony po stronie serwera.</p></div><span class="lvl ${ready===list.length&&list.length?"lvl-ok":"lvl-ostrzezenie"}">${ready}/${list.length} gotowych do e-maila</span></div><div class="producer-directory-summary">${summary||`<div class="backend-note">Brak producentów w kartotece.</div>`}</div><div class="producer-directory-list">${list.map(producentFormHTML).join("")}${producentFormHTML({})}</div></div>`;
}
let agentAIPlanUzgadnianie=false;
async function agentAIUzgodnijPlanZSerwerem(opcje={}){
  if(agentAIPlanUzgadnianie)return Array.isArray(agentAIZlecenia)?agentAIZlecenia:[];
  if(!maUprawnieniaZapisuChmury()){if(!opcje.silent)toast("Połącz panel administratora ze wspólną bazą, aby uzgodnić Plan zatowarowania");return [];}
  agentAIPlanUzgadnianie=true;
  try{
    const d=await chmura("supplier-order-reconcile",{method:"POST",body:{source:String(opcje.source||"admin-restock-plan")},timeout:60000});
    if(d.settings&&Object.keys(d.settings).length)nalozWspolneUstawienia(d.settings);
    agentAIPlanZapiszOdpowiedzSerwera(d);
    if(d.rev!==undefined)zapiszLS("artway_chmura_rev",d.rev||0);
    chmuraStan={...chmuraStan,dostepna:true,admin:true,rev:d.rev||chmuraStan.rev||0,updated_at:d.updated_at||null,error:""};
    zastosujUstawienia();zbudujProdukty();odswiezMenu();odswiezKoszyk();agentAIPlanOdswiezWidok();
    const dokumenty=Array.isArray(agentAIZlecenia)?agentAIZlecenia:[];
    if(!opcje.silent)toast(`✅ Plan uzgodniony na serwerze • ${dokumenty.filter(agentAIPlanDokumentAktywny).length} aktywnych dokumentów`);
    return dokumenty;
  }catch(e){if(!opcje.silent)toast(`⚠️ Nie udało się uzgodnić Planu: ${e.message||e}`);throw e;}
  finally{agentAIPlanUzgadnianie=false;}
}
async function agentAIZatwierdzZlecenie(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono szkicu producenta");return;}
  try{const d=await chmura("supplier-order-approve",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1)},timeout:45000});await agentAIPlanOdswiezPoOperacji(d,`✅ Zatwierdzono wersję ${Math.max(1,Number(d.draft?.revision||z.revision)||1)}`);}catch(e){await agentAIPlanBladOperacji(e,"Nie zatwierdzono wersji");}
}
async function agentAIUsunZlecenie(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono szkicu producenta");return;}
  if(!confirm(`Anulować szkic ${z.numer||z.id}? Dokument pozostanie w historii i nie zostanie wysłany.`))return;
  try{const d=await chmura("supplier-order-cancel",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1)},timeout:45000});await agentAIPlanOdswiezPoOperacji(d,"✅ Szkic anulowany i przeniesiony do historii");}catch(e){await agentAIPlanBladOperacji(e,"Nie anulowano szkicu");}
}
async function agentAIPrzygotujKorekteZlecenia(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const reason=prompt("Dlaczego przygotowujesz korektę? Poprzedniego dostarczonego e-maila nie da się usunąć — pozostanie w historii audytowej.","Korekta ilości lub pozycji zamówienia");
  if(reason===null)return;if(String(reason).trim().length<3){toast("Podaj krótki powód korekty");return;}
  if(!confirm(`Utworzyć nową wersję korekty dokumentu ${z.numer||z.id}?\n\nPoprzednia wysyłka pozostanie w historii. Bieżący status wróci do kontroli, a po zmianach trzeba będzie ponownie zatwierdzić i wysłać dokument.`))return;
  try{const d=await chmura("supplier-order-correction",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1),reason:String(reason).trim()},timeout:45000});await agentAIPlanOdswiezPoOperacji(d,`✅ Utworzono korektę — wersja ${Math.max(1,Number(d.draft?.revision)||1)} czeka na kontrolę`);}catch(e){await agentAIPlanBladOperacji(e,"Nie utworzono korekty");}
}
async function agentAIPonowEmailProducenta(id){
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id));if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const reason=prompt("Podaj powód ponownej wysyłki identycznego dokumentu:","Producent prosi o ponowne przesłanie wiadomości");
  if(reason===null)return;if(String(reason).trim().length<3){toast("Podaj krótki powód ponownej wysyłki");return;}
  return agentAIWyslijZlecenieEmail(id,{forceResend:true,resendReason:String(reason).trim()});
}
function agentAIPobierzZlecenieCSV(id){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zlecenia producenta");return;}
  const pozycje=(z.pozycje||[]).map(p=>({...p,kodEksportowy:agentAIKodPozycjiProducenta(p)})),braki=pozycje.filter(p=>!p.kodEksportowy).map(p=>({nazwa:p.nazwa||"Produkt"}));
  if(agentAIEksportZablokowanyPrzezBrakKodow(braki,"Eksport tabeli zamówienia"))return false;
  const nag=["kod","nazwa","zamawiana_ilosc"];
  const csv=[nag.join(";"),...pozycje.map(p=>[p.kodEksportowy,p.nazwa,p.ilosc].map(csvPole).join(";"))].join("\n");
  pobierzPlik(`zlecenie-producenta-${String(z.numer||z.id).replace(/[^a-z0-9_-]+/gi,"-")}.csv`,"\uFEFF"+csv,"text/csv");
  return true;
}
function agentAIEanPoprawny(v){
  const kod=tylkoCyfry(v);if(![8,12,13,14].includes(kod.length))return false;
  const cyfry=[...kod].map(Number),kontrolna=cyfry.pop(),suma=cyfry.slice().reverse().reduce((s,n,i)=>s+n*(i%2===0?3:1),0);
  return (10-(suma%10))%10===kontrolna;
}
function agentAIBiznesowyIdentyfikator(v){
  const wartosc=String(v||"").trim();
  if(!wartosc||wartosc.length>80||/^(?:-|—|brak|n\/a|null|undefined)$/i.test(wartosc)||/\b(?:lub|albo|or)\b/i.test(wartosc))return "";
  return /^[\p{L}\p{N}][\p{L}\p{N}._\/-]{0,79}$/u.test(wartosc)?wartosc:"";
}
function agentAIStabilnyIdentyfikatorPozycji(p={},produktWejscie=null){
  const produkt=produktWejscie&&typeof produktWejscie==="object"?produktWejscie:(typeof produktMagazynowy==="function"?(produktMagazynowy(p.produktId)||{}):{}),meta=typeof magazynMetaProduktu==="function"?(magazynMetaProduktu(p.produktId)||{}):{};
  const lokalneId=new Set([p.id,p.produktId,produkt.id].map(v=>String(v||"").trim().toUpperCase()).filter(Boolean));
  const jawny=v=>agentAIBiznesowyIdentyfikator(v),ogolny=v=>{const wartosc=jawny(v);return wartosc&&!lokalneId.has(wartosc.toUpperCase())?wartosc:"";};
  const grupy=[
    ["EXTERNAL_ID",[p.externalId,produkt.externalId]],
    ["SKU",[p.sku,produkt.sku]],
    ["kod producenta",[p.kodProducenta,p.mpn,produkt.kodProducenta,produkt.mpn]]
  ];
  for(const [typ,wartosci] of grupy){const wartosc=wartosci.map(jawny).find(Boolean);if(wartosc)return {wartosc,typ};}
  const kodyOgolne=[
    ["kod dostawcy",[p.kodDostawcy,p.supplierCode,p.vendorCode,produkt.kodDostawcy,produkt.supplierCode,produkt.vendorCode,meta.kodDostawcy]],
    ["kod katalogowy",[p.kodKatalogowy,p.catalogCode,produkt.kodKatalogowy,produkt.catalogCode,meta.kodKatalogowy]],
    ["kod",[p.kod,produkt.kod,meta.kod]]
  ];
  for(const [typ,wartosci] of kodyOgolne){const wartosc=wartosci.map(ogolny).find(Boolean);if(wartosc)return {wartosc,typ};}
  const ean=[p.ean,p.gtin,produkt.gtin,produkt.ean].map(tylkoCyfry).find(agentAIEanPoprawny);
  if(ean)return {wartosc:ean,typ:"EAN"};
  return {wartosc:"",typ:""};
}
function agentAIKodPozycjiProducenta(p={},produkt=null){return agentAIStabilnyIdentyfikatorPozycji(p,produkt).wartosc;}
function agentAIIdentyfikatorOptimaPozycji(p={},produkt={}){
  const meta=typeof magazynMetaProduktu==="function"?(magazynMetaProduktu(p.produktId)||{}):{},jawny=v=>agentAIBiznesowyIdentyfikator(v);
  const grupy=[
    ["kod Comarch Optima",[p.optimaCode,p.supplierOptimaCode,p.kodOptima,produkt.optimaCode,produkt.supplierOptimaCode,produkt.kodOptima,meta.optimaCode,meta.supplierOptimaCode,meta.kodOptima]],
    ["kod dostawcy",[p.kodDostawcy,p.supplierCode,p.vendorCode,produkt.kodDostawcy,produkt.supplierCode,produkt.vendorCode,meta.kodDostawcy,meta.supplierCode,meta.vendorCode]],
    ["kod producenta",[p.kodProducenta,p.mpn,produkt.kodProducenta,produkt.mpn]]
  ];
  for(const [typ,wartosci] of grupy){const wartosc=wartosci.map(jawny).find(Boolean);if(wartosc)return {wartosc,typ};}
  const ean=[p.ean,p.gtin,produkt.gtin,produkt.ean].map(tylkoCyfry).find(agentAIEanPoprawny);
  return ean?{wartosc:ean,typ:"EAN"}:{wartosc:"",typ:""};
}
function agentAIPrzygotujOptimaZlecenie(pozycje=[],productFinder){
  const znajdz=typeof productFinder==="function"?productFinder:(id=>typeof produktMagazynowy==="function"?(produktMagazynowy(id)||{}):{}),wiersze=[],braki=[];
  (Array.isArray(pozycje)?pozycje:[]).forEach(p=>{
    const produkt=znajdz(p.produktId)||{},identyfikator=agentAIIdentyfikatorOptimaPozycji(p,produkt),ilosc=Math.max(0,Number(p.ilosc)||0);
    if(!identyfikator.wartosc){braki.push({produktId:String(p.produktId||""),nazwa:String(p.nazwa||produkt.nazwa||"Produkt bez nazwy")});return;}
    if(!ilosc)return;
    wiersze.push({towar:identyfikator.wartosc,ilosc,typ:identyfikator.typ,nazwa:String(p.nazwa||produkt.nazwa||"Produkt")});
  });
  return {wiersze,braki,tresc:wiersze.map(x=>`${String(x.towar).replace(/[;\r\n]/g,"")};${x.ilosc};`).join("\r\n")};
}
function agentAIEksportZablokowanyPrzezBrakKodow(braki=[],tytul="Eksport Planu"){
  const lista=(Array.isArray(braki)?braki:[]).filter(Boolean);if(!lista.length)return false;
  agentAIOtworzModal(`${tytul} wymaga uzupełnienia kodów`,`<div class="backend-note warn"><b>Plik nie został utworzony.</b><p>${lista.length} pozycji nie ma jednoznacznego EXTERNAL_ID, SKU, kodu producenta, innego jawnego kodu ani poprawnego EAN. Uzupełnij kartoteki — wewnętrzne ID sklepu nigdy nie jest automatycznym kodem eksportowym.</p></div><ul class="supplier-optima-missing">${lista.map(x=>`<li>${esc(x.nazwa||x.name||"Produkt")}</li>`).join("")}</ul>`,"Po poprawie kartotek uruchom eksport ponownie.");
  toast(`Uzupełnij stabilny kod w ${lista.length} pozycjach — plik nie został utworzony`);return true;
}
let agentAIModalPoprzedniFocus=null;
function agentAIZamknijModal(){
  const modal=document.getElementById("agentSupplierPreviewModal");
  if(modal)modal.remove();
  document.removeEventListener("keydown",agentAIModalKlawisz);
  if(agentAIModalPoprzedniFocus&&typeof agentAIModalPoprzedniFocus.focus==="function")agentAIModalPoprzedniFocus.focus();
  agentAIModalPoprzedniFocus=null;
}
function agentAIModalKlawisz(e){if(e.key==="Escape"){e.preventDefault();agentAIZamknijModal();}}
function agentAIOtworzModal(tytul,trescHTML,opis=""){
  agentAIZamknijModal();
  agentAIModalPoprzedniFocus=document.activeElement;
  const modal=document.createElement("div");
  modal.id="agentSupplierPreviewModal";modal.className="supplier-preview-overlay";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","agentSupplierPreviewTitle");modal.tabIndex=-1;
  modal.innerHTML=`<section class="supplier-preview-modal"><header><div><span class="order-pro-label">Bezpieczny podgląd — nic nie zostanie wysłane</span><h2 id="agentSupplierPreviewTitle">${esc(tytul)}</h2>${opis?`<p>${esc(opis)}</p>`:""}</div><button type="button" class="btn ghost supplier-preview-close" aria-label="Zamknij podgląd" onclick="agentAIZamknijModal()">✕</button></header><div class="supplier-preview-body">${trescHTML}</div><footer><button type="button" class="btn" onclick="agentAIZamknijModal()">Zamknij podgląd</button></footer></section>`;
  modal.addEventListener("click",e=>{if(e.target===modal)agentAIZamknijModal();});
  document.body.appendChild(modal);document.addEventListener("keydown",agentAIModalKlawisz);
  modal.querySelector(".supplier-preview-close")?.focus();
}
function agentAIEmailProducentaHTML(z,dostawca,pozycje){
  const przygotowane=(Array.isArray(pozycje)?pozycje:[]).map(p=>({...p,kodEksportowy:agentAIKodPozycjiProducenta(p)})),braki=przygotowane.filter(p=>!p.kodEksportowy),sztuk=przygotowane.reduce((s,p)=>s+Math.max(0,Number(p.ilosc)||0),0),rows=przygotowane.map(p=>`<tr><td><b>${esc(p.kodEksportowy||"BRAK KODU")}</b></td><td>${esc(p.nazwa||"Produkt")}</td><td><b>${esc(Number(p.ilosc)||0)}</b></td></tr>`).join("");
  const key=producentKlucz(dostawca),optima=key.includes("alexander")||key.includes("multigra");
  return `<div class="supplier-email-sheet"><div class="supplier-email-meta"><span>Do: <b>${esc(producentPoNazwie(dostawca)?.orderEmail||"adres nieuzupełniony")}</b></span><span>Temat: <b>${esc(`Zamówienie ${z.numer||z.id} — Artway-TM`)}</b></span></div>${braki.length?`<div class="backend-note warn"><b>Wysyłka zablokowana:</b> ${braki.length} pozycji wymaga uzupełnienia kodu w kartotece.</div>`:""}<div class="supplier-email-message"><header class="supplier-email-brand"><div><span>Artway-TM • zamówienie</span><h3>${esc(z.numer||z.id)}</h3></div><small>${esc(dostawca)}<br>${przygotowane.length} pozycji • ${sztuk} szt.</small></header><div class="supplier-email-content"><p>Cześć,<br>poniżej dzisiejsze zamówienie.</p><div class="supplier-email-order-table"><table><thead><tr><th>Kod produktu</th><th>Nazwa</th><th>Zamawiana ilość</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">Razem</td><td><b>${sztuk} szt.</b></td></tr></tfoot></table></div><p>Pozdrowienia dla całej ekipy!<br><b>Artway-TM</b></p>${optima?`<small class="supplier-optima-note"><b>Załącznik Comarch ERP Optima:</b> Ogólne → Kolektor danych → Importuj pozycje → wskaż TXT → zaznacz „Pobieraj ceny z programu”. Plik bez nagłówka; ceny są celowo puste.</small>`:""}</div></div></div>`;
}
function agentAIPodgladEmailaProducenta(id,dostawca){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const pozycje=(z.pozycje||[]).filter(p=>String(p.dostawca||agentAIDostawcaZlecenia(z))===String(dostawca));
  if(!pozycje.length){toast("Brak pozycji tego producenta");return;}
  agentAIOtworzModal(`E-mail do: ${dostawca}`,agentAIEmailProducentaHTML(z,dostawca,pozycje),`${pozycje.length} pozycji • wersja ${Math.max(1,Number(z.revision)||1)}`);
}
function agentAIPobierzOptimaTXT(id,dostawca){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const pozycje=(z.pozycje||[]).filter(p=>String(p.dostawca||agentAIDostawcaZlecenia(z))===String(dostawca)),dane=agentAIPrzygotujOptimaZlecenie(pozycje);
  if(agentAIEksportZablokowanyPrzezBrakKodow(dane.braki,"Eksport Comarch ERP Optima"))return false;
  if(dane.wiersze.length){
    const producent=String(dostawca||"producent").replace(/[^a-z0-9_-]+/gi,"-"),numer=String(z.numer||z.id).replace(/[^a-z0-9_-]+/gi,"-");
    const key=producentKlucz(dostawca),optima=key.includes("alexander")||key.includes("multigra");
    pobierzPlik(`${producent}-${optima?"Optima":"zamowienie"}-${numer}.txt`,dane.tresc,"text/plain");
    toast(`${optima?"Comarch Optima":"Plik bezcenowy"}: pobrano ${dane.wiersze.length} pozycji`);return true;
  }
  toast("Brak pozycji możliwych do eksportu do Comarch Optima");return false;
}
function agentAIPlanZapiszOdpowiedzSerwera(d={}){
  const lista=Array.isArray(d.supplierOrders)?d.supplierOrders:null;
  if(lista)agentAIZlecenia=lista;
  else if(d.draft&&d.draft.id){
    const istnieje=(agentAIZlecenia||[]).some(x=>String(x.id)===String(d.draft.id));
    agentAIZlecenia=istnieje?(agentAIZlecenia||[]).map(x=>String(x.id)===String(d.draft.id)?d.draft:x):[d.draft,...(agentAIZlecenia||[])];
  }
  const poprzedni=chmuraWczytywanie;chmuraWczytywanie=true;
  try{zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);}finally{chmuraWczytywanie=poprzedni;}
}
async function agentAIPlanOdswiezPoOperacji(d={},komunikat="Zapisano zmianę"){
  agentAIPlanZapiszOdpowiedzSerwera(d);
  const pobrano=await chmuraWczytajStan().catch(()=>false);
  if(!pobrano&&d.rev!==undefined){
    chmuraStan={...chmuraStan,rev:Number(d.rev)||chmuraStan.rev,updated_at:d.updated_at||chmuraStan.updated_at};
    const poprzedni=chmuraWczytywanie;chmuraWczytywanie=true;try{zapiszLS("artway_chmura_rev",Number(d.rev)||0);}finally{chmuraWczytywanie=poprzedni;}
  }
  toast(komunikat);if(typeof odswiezPlanZatowarowaniaWidoku!=="function"||!odswiezPlanZatowarowaniaWidoku())renderuj();return d;
}
async function agentAIPlanBladOperacji(e,prefix="Nie zapisano zmiany"){
  if(Number(e?.status)===409||String(e?.code||"").includes("conflict")){
    toast("⚠️ Szkic zmienił się na innym urządzeniu. Pobieram aktualną wersję…");
    await chmuraPobierzWszystko().catch(()=>{});return;
  }
  toast(`⚠️ ${prefix}: ${e?.message||e}`);
}
function agentAIPlanProduktPoReferencji(value=""){
  const raw=String(value||"").trim(),id=raw.split(/\s*[•|]\s*/)[0].trim(),key=normalizujSzukanyTekst(raw).replace(/\s+/g,"");
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  return produkty.find(p=>String(p.id)===id)||produkty.find(p=>[p.externalId,p.sku,p.kodProducenta,p.mpn,p.gtin,p.ean].some(v=>normalizujSzukanyTekst(v).replace(/\s+/g,"")===key))||produkty.find(p=>normalizujSzukanyTekst(p.nazwa)===normalizujSzukanyTekst(raw));
}
function agentAIPlanDostawcy(){
  const zProduktow=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>agentAIDostawcaProduktu(p,magazynMetaProduktu(p.id))).filter(Boolean);
  return [...new Set([...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>p.name||p.nazwa),...(agentAIZlecenia||[]).map(agentAIDostawcaZlecenia),...zProduktow].map(x=>String(x||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
}
async function agentAIPlanDodajPozycje(event){
  event.preventDefault();const form=event.currentTarget,f=new FormData(form),supplier=String(f.get("supplier")||"").trim(),produkt=agentAIPlanProduktPoReferencji(f.get("product")||""),quantity=Math.max(1,parseInt(String(f.get("quantity")||1).replace(/[^\d-]/g,""),10)||1);
  if(!supplier){toast("Wybierz producenta");return false;}if(!produkt){toast("Wybierz istniejący produkt po ID, EXTERNAL_ID, SKU, EAN lub nazwie");return false;}
  const draft=(agentAIZlecenia||[]).find(z=>agentAIPlanDokumentAktywny(z)&&agentAIStatusRoboczyProducenta(z.status)&&producentKlucz(agentAIDostawcaZlecenia(z))===producentKlucz(supplier));
  const line=(draft?.pozycje||[]).find(p=>String(p.produktId)===String(produkt.id)),minimum=Number(line?.iloscPotrzebna||0),finalQuantity=Math.max(minimum,quantity),button=form.querySelector('button[type="submit"]');
  if(button)button.disabled=true;
  try{
    const body={supplier,productId:String(produkt.id),quantity:finalQuantity,product:{externalId:String(produkt.externalId||""),sku:String(produkt.sku||""),kodProducenta:String(produkt.kodProducenta||produkt.mpn||""),ean:String(produkt.gtin||produkt.ean||""),nazwa:String(produkt.nazwa||"Produkt")}};
    if(draft){body.draftId=draft.id;body.expectedRevision=Math.max(1,Number(draft.revision)||1);}
    const d=await chmura("supplier-order-line-upsert",{method:"POST",body,timeout:45000});
    form.reset();await agentAIPlanOdswiezPoOperacji(d,`✅ ${produkt.nazwa}: ${finalQuantity} szt. w szkicu ${supplier}`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie dodano pozycji");}finally{if(button?.isConnected)button.disabled=false;}
  return false;
}
function agentAIPlanReczneDodanieHTML(){
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).slice().sort((a,b)=>String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl")),dostawcy=agentAIPlanDostawcy();
  return `<details class="supplier-manual-add"><summary>➕ Dodaj ręcznie pozycję do szkicu</summary><form onsubmit="return agentAIPlanDodajPozycje(event)"><label>Producent<select name="supplier" required><option value="">Wybierz producenta…</option>${dostawcy.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select></label><label class="supplier-manual-product">Produkt<input name="product" list="supplierRestockProducts" required autocomplete="off" placeholder="ID, EXTERNAL_ID, SKU, EAN lub dokładna nazwa"><datalist id="supplierRestockProducts">${produkty.slice(0,3000).map(p=>`<option value="${esc(`${p.id} • ${p.externalId||p.sku||p.kodProducenta||p.gtin||p.ean||"bez kodu"} • ${p.nazwa||"Produkt"}`)}"></option>`).join("")}</datalist></label><label>Łączna ilość w szkicu<input name="quantity" type="number" min="1" step="1" value="1" required></label><button class="btn" type="submit">Dodaj do właściwego szkicu</button></form><small>Zmiana aktualizuje właściwy szkic i tworzy nową rewizję. Nic nie jest wysyłane automatycznie.</small></details>`;
}
function agentAIZlecenieTabelaDostawcyHTML(z,dostawca,pozycje){
  const suma=pozycje.reduce((s,p)=>s+Number(p.ilosc||0),0),producer=producentPoNazwie(dostawca),editable=agentAIStatusRoboczyProducenta(z.status),key=producentKlucz(dostawca),optima=key.includes("alexander")||key.includes("multigra"),optimaDane=optima?agentAIPrzygotujOptimaZlecenie(pozycje):null;
  return `<section class="supplier-split-card"><header><div><span class="supplier-chip">🏭 ${esc(dostawca)}</span><h4>Zamówienie: ${pozycje.length} pozycji / ${suma} szt.</h4><small>${producer?.orderEmail?`✉️ ${esc(producer.orderEmail)}`:"uzupełnij e-mail w kartotece producenta"}</small></div><div class="diag-actions"><button class="btn" type="button" onclick="agentAIPodgladEmailaProducenta(${jsArg(z.id)},${jsArg(dostawca)})">👁️ E-mail i tabela</button><button class="btn ghost" type="button" onclick="agentAIPobierzOptimaTXT(${jsArg(z.id)},${jsArg(dostawca)})">📥 ${optima?"Comarch Optima TXT":"TXT bez cen"}</button><a class="btn ghost" href="#/admin/agent-ai/producenci">Kontakt</a></div></header>
  <div class="warehouse-worktable-wrap"><table class="log-table supplier-order-products"><thead><tr><th>Produkt i kod</th><th>Potrzeba</th><th>Zamawiam</th><th>Stan magazynu</th><th>Stan przyjęcia</th><th>Akcje</th></tr></thead><tbody>${pozycje.map(p=>{const produkt=produktMagazynowy(p.produktId)||p.product||{},identyfikator=agentAIStabilnyIdentyfikatorPozycji(p,produkt),potrzebna=Number(p.iloscPotrzebna??p.ilosc)||0,ilosc=Number(p.ilosc)||0,przyjeto=Math.max(0,Number(p.przyjeto)||0),pozostalo=Math.max(0,ilosc-przyjeto),nadwyzka=Math.max(0,ilosc-potrzebna),lineKey=p.stableKey||p.lineKey||p.id||"",wirtualny=String(p.produktId||"").startsWith("allegro-offer:");return `<tr><td><div class="supplier-product-cell"><span class="admin-product-thumb">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="" loading="lazy">`:`<span class="admin-product-thumb-fallback">${esc(produkt.ikona||"🎲")}</span>`}</span><div><b>${esc(p.nazwa||produkt.nazwa||"Produkt")}</b><strong>${esc(identyfikator.wartosc||"uzupełnij kod")}</strong><small>${esc(identyfikator.typ||"brak stabilnego identyfikatora")}${p.ean||produkt.ean?` • EAN ${esc(p.ean||produkt.ean)}`:""}</small></div></div></td><td><b>${potrzebna} szt.</b><small>${esc((p.zamowienia||[]).join(", ")||"pozycja ręczna")}</small></td><td>${editable?`<div class="supplier-qty-control"><button type="button" aria-label="Zmniejsz" onclick="agentAIPrzesunIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},-1,${jsArg(lineKey)})">−</button><input aria-label="Ilość zamawiana" inputmode="numeric" value="${ilosc}" onchange="agentAIUstawIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},this.value,${jsArg(lineKey)})"><button type="button" aria-label="Zwiększ" onclick="agentAIPrzesunIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},1,${jsArg(lineKey)})">+</button></div>`:`<b>${ilosc} szt.</b>`}<small>${nadwyzka?`nadwyżka +${nadwyzka} szt.`:"bez nadwyżki"}</small></td><td><b>${p.stan===null?"bez limitu":`${esc(p.stan||0)} szt.`}</b><small>rezerwacje ${esc(p.rezerwacje||0)} • ${esc(p.lokalizacja||"bez lokalizacji")}</small></td><td><div class="supplier-receive-summary"><span><b>${przyjeto}</b><small>przyjęto</small></span><span class="${pozostalo?"pending":"done"}"><b>${pozostalo}</b><small>pozostało</small></span></div><small>${pozostalo?"Korekta w przyjęciu dokumentu":"Pozycja rozliczona"}</small></td><td><div class="warehouse-worktable-actions">${editable?`<button class="btn ghost" onclick="agentAIPowiekszPozycjeZlecenia(${jsArg(z.id)},${jsArg(p.produktId)},${jsArg(lineKey)})">➕ Ilość</button>`:""}${wirtualny?`<a class="btn ghost" href="#/admin/allegro/oferty">🟠 Oferta</a>`:`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.produktId)}">✏️ Produkt</a>`}</div></td></tr>`;}).join("")}</tbody></table></div>
  <small class="supplier-optima-strip ${optima?(optimaDane.braki.length?"has-error":"is-ready"):"is-generic"}">${optima?`<b>Import Optimy:</b> ${optimaDane.braki.length?`brak kodu TOWAR w ${optimaDane.braki.length} pozycjach`:`TXT gotowy (${optimaDane.wiersze.length}/${pozycje.length})`}. Dokument → Ogólne → Kolektor danych → Importuj pozycje; następnie „Pobieraj ceny z programu”.`:`Plik TXT zawiera wyłącznie kod produktu i ilość — bez cen.`}</small></section>`;
}
function agentAIPrzyjecieDokumentuHTML(z={}){
  const pozycje=Array.isArray(z.pozycje)?z.pozycje:[],status=String(z.status||"").toLowerCase(),wyslane=!!z.emailSentAt||status.includes("wysłane do")||status.includes("częściowo zrealizowane")||status==="zrealizowane",zamowiono=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.ilosc)||0),0),przyjeto=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.przyjeto)||0),0),pozostalo=Math.max(0,zamowiono-przyjeto),pelne=!!zamowiono&&!pozostalo,partie=Array.isArray(z.receiptBatches)?z.receiptBatches:[];
  if(!wyslane)return `<section class="supplier-document-receipt is-locked"><div><span class="order-pro-label">Przyjęcie dostawy</span><b>Dostępne po wysłaniu zamówienia</b><small>Stan magazynu nie zostanie zmieniony przed wysłaniem dokumentu do producenta.</small></div></section>`;
  if(pelne)return `<section class="supplier-document-receipt is-complete"><div><span class="order-pro-label">Dokument przyjęty</span><b>✅ ${esc(przyjeto)} / ${esc(zamowiono)} szt. rozliczono</b><small>Powiązane zamówienia Allegro są teraz w etapie „Oczekuje na wysyłkę” i nie zasilają kolejnego zakupu.</small></div><span class="lvl lvl-ok">partie przyjęcia: ${partie.length||1}</span></section>`;
  const korekty=pozycje.map((p,index)=>{const zam=Math.max(0,Number(p.ilosc)||0),prz=Math.max(0,Number(p.przyjeto)||0),left=Math.max(0,zam-prz),lineKey=p.stableKey||p.lineKey||p.id||`line:${index}`;return `<label class="supplier-receipt-line"><span><b>${esc(p.nazwa||"Produkt")}</b><small>${esc(p.externalId||p.sku||p.kodProducenta||p.ean||p.produktId||"bez kodu")} • zamówiono ${zam} • dotąd przyjęto ${prz}</small></span><input type="number" min="0" step="1" value="${left}" data-line-key="${esc(lineKey)}" data-product-id="${esc(p.produktId||"")}" aria-label="Dostarczono teraz: ${esc(p.nazwa||"produkt")}"><em>${left} pozostało</em></label>`;}).join("");
  return `<section class="supplier-document-receipt"><div class="supplier-document-receipt-head"><div><span class="order-pro-label">Przyjęcie całego dokumentu</span><b>${pozostalo} szt. w ${pozycje.filter(p=>Number(p.przyjeto||0)<Number(p.ilosc||0)).length} pozycjach czeka na przyjęcie</b><small>Jedna operacja zwiększy stany, przypisze ilości do zamówień Allegro i przeniesie kompletne zlecenia do wysyłki.</small></div><button class="btn" type="button" onclick="agentAIPrzyjmijDokumentZlecenia(${jsArg(z.id)})">📥 Przyjmij dokument (${pozostalo} szt.)</button></div><details class="supplier-receipt-correction"><summary>✏️ Dostawa różni się od zamówienia — wprowadź korektę</summary><form onsubmit="return agentAIPrzyjmijDokumentZlecenia(${jsArg(z.id)},this,event)"><p>Wpisz faktyczną liczbę sztuk dostarczonych teraz. Wartość 0 oznacza brak pozycji; mniejsza ilość pozostawi ją do późniejszego przyjęcia, a większa zapisze nadwyżkę na magazynie.</p><div class="supplier-receipt-lines">${korekty}</div><button class="btn" type="submit">Przyjmij dokument z korektą</button></form></details></section>`;
}
function agentAIEtapyZleceniaProducenta(z={}){
  const revision=Math.max(1,Number(z.revision)||1),pozycje=Array.isArray(z.pozycje)?z.pozycje:[],stanSprawdzony=!!z.stockCheckedAt||!!pozycje.length&&pozycje.every(p=>Object.prototype.hasOwnProperty.call(p,"stan")&&p.iloscPotrzebna!==undefined),zatwierdzone=!!z.approvedAt&&Number(z.approvalRevision||0)===revision,wyslane=!!z.emailSentAt||String(z.status||"").toLowerCase().includes("wysłane do"),przyjeto=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.przyjeto)||0),0),zamowiono=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.ilosc)||0),0),przyjeteWszystko=!!zamowiono&&przyjeto>=zamowiono;
  return [
    {label:"Stan magazynowy",opis:stanSprawdzony?"brak policzony":"oczekuje na kontrolę",done:stanSprawdzony,current:!stanSprawdzony},
    {label:"Szkic producenta",opis:`wersja ${revision}`,done:true,current:false},
    {label:"Zatwierdzenie",opis:zatwierdzone?"potwierdzone przez administratora":"wymaga decyzji",done:zatwierdzone,current:stanSprawdzony&&!zatwierdzone},
    {label:"Zamówienie wysłane",opis:wyslane?"etap zakupowy zakończony":"nic nie wysłano",done:wyslane,current:zatwierdzone&&!wyslane},
    {label:"Dostawa",opis:przyjeteWszystko?"towar przyjęty":przyjeto?`${przyjeto}/${zamowiono} szt.`:"oczekuje na dostawę",done:przyjeteWszystko,current:wyslane&&!przyjeteWszystko},
    {label:"Oczekuje na wysyłkę",opis:przyjeteWszystko?"zamówienia gotowe do obsługi":"po pełnym przyjęciu",done:przyjeteWszystko,current:false}
  ];
}
function agentAIEtapyZleceniaHTML(z){return `<div class="supplier-workflow">${agentAIEtapyZleceniaProducenta(z).map((x,i)=>`<span class="${x.done?"done":x.current?"current":"waiting"}"><b>${i+1}. ${esc(x.label)}</b><small>${esc(x.opis)}</small></span>`).join("")}</div>`;}
let agentAIPlanSzukaj="",agentAIPlanFiltrProducenta="wszyscy",agentAIPlanFiltrStatusu="aktywne";
function agentAIPlanOdswiezWidok(){if(typeof odswiezPlanZatowarowaniaWidoku==="function"&&odswiezPlanZatowarowaniaWidoku())return true;renderuj();return false;}
function agentAIPlanDokumentAktywny(z={}){
  const status=String(z.status||"").trim().toLowerCase();
  if(["zrealizowane","anulowane","zastąpione","zastapione","superseded","wyczyszczone","cleared"].includes(status))return false;
  return (Array.isArray(z.pozycje)?z.pozycje:[]).some(p=>{
    const zamowiono=Math.max(0,Number(p.ilosc??p.quantity)||0),potrzeba=Math.max(0,Number(p.iloscPotrzebna??p.baseRequired)||0),nadwyzka=Math.max(0,Number(p.manualExtra??p.nadwyzka)||0),przyjeto=Math.max(0,Number(p.przyjeto??p.received)||0);
    return zamowiono>0||potrzeba>0||nadwyzka>0||przyjeto>0;
  });
}
function agentAIPlanDokumentPasuje(z={}){
  const status=String(z.status||"szkic").toLowerCase(),aktywny=agentAIPlanDokumentAktywny(z),revision=Math.max(1,Number(z.revision)||1),approved=!!z.approvedAt&&Number(z.approvalRevision||0)===revision,sent=!!z.emailSentAt||status.includes("wysłane do"),received=(z.pozycje||[]).some(p=>Number(p.przyjeto)>0);
  if(agentAIPlanFiltrProducenta!=="wszyscy"&&producentKlucz(agentAIDostawcaZlecenia(z))!==producentKlucz(agentAIPlanFiltrProducenta))return false;
  if(agentAIPlanFiltrStatusu==="aktywne"&&!aktywny)return false;if(agentAIPlanFiltrStatusu==="szkice"&&!agentAIStatusRoboczyProducenta(status))return false;if(agentAIPlanFiltrStatusu==="zatwierdzone"&&!approved)return false;if(agentAIPlanFiltrStatusu==="wyslane"&&!sent)return false;if(agentAIPlanFiltrStatusu==="przyjecie"&&(!sent||(z.pozycje||[]).every(p=>Number(p.przyjeto||0)>=Number(p.ilosc||0))))return false;if(agentAIPlanFiltrStatusu==="zamkniete"&&aktywny)return false;
  const q=normalizujSzukanyTekst(agentAIPlanSzukaj);if(!q)return true;
  return normalizujSzukanyTekst([z.id,z.numer,z.status,agentAIDostawcaZlecenia(z),...(z.pozycje||[]).flatMap(p=>[p.nazwa,p.externalId,p.sku,p.kodProducenta,p.mpn,p.ean,p.gtin])].join(" ")).includes(q);
}
function agentAIPlanSzukajDokumenty(input){agentAIPlanSzukaj=String(input?.value||"");clearTimeout(window.__supplierPlanSearch);window.__supplierPlanSearch=setTimeout(()=>odswiezPlanZatowarowaniaWidoku(),180);}
function agentAIPlanWyczyscFiltry(){agentAIPlanSzukaj="";agentAIPlanFiltrProducenta="wszyscy";agentAIPlanFiltrStatusu="aktywne";odswiezPlanZatowarowaniaWidoku();}
function agentAIHistoriaEmailiProducentaHTML(z={}){
  const proby=Array.isArray(z.emailSendHistory)?z.emailSendHistory:[],korekty=Array.isArray(z.supersededSends)?z.supersededSends:[];
  if(!proby.length&&!korekty.length&&!z.emailSentAt)return "";
  const wiersze=[...proby.map(x=>({at:x.at,typ:x.mode==="resend"?"Ponowna wysyłka":"Wysyłka",opis:`dostarczono ${Number(x.delivered)||0} • pominięto duplikaty ${Number(x.skippedDuplicates)||0} • błędy ${Number(x.failed)||0}${x.reason?` • ${x.reason}`:""}`,operator:x.operator})),...korekty.map(x=>({at:x.supersededAt,typ:`Korekta wersji ${x.revision||"—"}`,opis:x.reason||"Poprzednia wysyłka oznaczona jako zastąpiona",operator:x.supersededBy}))].sort((a,b)=>String(b.at||"").localeCompare(String(a.at||""))).slice(0,20);
  return `<details class="supplier-email-audit"><summary>🕓 Historia wysyłek i korekt (${Math.max(1,proby.length+korekty.length)})</summary><div>${wiersze.map(x=>`<article><b>${esc(x.typ)}</b><span>${esc(allegroDataTxt(x.at))}</span><p>${esc(x.opis)}</p><small>${esc(x.operator||"administrator")}</small></article>`).join("")||`<article><b>Ostatnia wysyłka</b><span>${esc(allegroDataTxt(z.emailSentAt))}</span></article>`}</div></details>`;
}
function agentAIPlanKartaDokumentuHTML(z){
  const status=String(z.status||"szkic").toLowerCase(),zamkniete=!agentAIPlanDokumentAktywny(z),robocze=!zamkniete&&agentAIStatusRoboczyProducenta(status),grupy=agentAIGrupujPoDostawcy(z.pozycje||[]),revision=Math.max(1,Number(z.revision)||1),approvedCurrent=!!z.approvedAt&&Number(z.approvalRevision||0)===revision,missingEmail=grupy.some(([d])=>!producentPoNazwie(d)?.orderEmail),zamowiono=(z.pozycje||[]).reduce((s,p)=>s+Number(p.ilosc||0),0),przyjeto=(z.pozycje||[]).reduce((s,p)=>s+Number(p.przyjeto||0),0),wyslane=!!z.emailSentAt||status.includes("wysłane do")||status.includes("częściowo zrealizowane")||status==="zrealizowane",czesciowe=status==="częściowo wysłane e-mailem",pelnaWysylka=wyslane&&!czesciowe,liczbaWysylek=Math.max(Number(z.emailSendCount)||0,(Array.isArray(z.emailSendHistory)?z.emailSendHistory.filter(x=>Number(x.delivered)>0).length:0),z.emailSentAt?1:0);
  return `<article class="supplier-order-card ${zamkniete?"is-closed":""}"><header class="supplier-order-head"><div><span class="order-pro-label">${esc(z.tryb==="niskie"?"Uzupełnienie magazynu":"Braki i pozycje ręczne")} • wersja ${revision}</span><h3>${esc(z.numer||z.id)}</h3><small>${esc(z.dataTxt||allegroDataTxt(z.data))} • ${grupy.length} producentów • ${(z.pozycje||[]).length} pozycji • ${esc(z.sztuk||zamowiono)} szt. • przyjęto ${przyjeto}</small></div><div class="supplier-order-status"><span class="lvl ${status.includes("wysłane")||status==="zrealizowane"?"lvl-ok":"lvl-info"}">${esc(z.status||"szkic")}</span><small>${z.emailSentAt?`Ostatni e-mail: ${esc(allegroDataTxt(z.emailSentAt))} • wysyłek ${liczbaWysylek}`:z.lastEmailSentAt?`Poprzednia wysyłka: ${esc(allegroDataTxt(z.lastEmailSentAt))} • trwa korekta`:z.telegramSentAt?`Telegram (podgląd): ${esc(allegroDataTxt(z.telegramSentAt))}`:zamkniete?"Dokument historyczny — nie wymaga działania":"Dokument otwarty — oczekuje na kontrolę"}</small></div></header>${agentAIEtapyZleceniaHTML(z)}${agentAIPrzyjecieDokumentuHTML(z)}${approvedCurrent&&robocze?`<div class="backend-note"><b>Wersja ${revision} zatwierdzona.</b> Każda zmiana ilości lub nowy brak cofnie dokument do ponownej kontroli.</div>`:""}${z.correctionOpenedAt&&!wyslane?`<div class="backend-note warn"><b>Trwa korekta poprzedniej wysyłki.</b> ${esc(z.correctionReason||"")} Po zmianach zatwierdź aktualną wersję i wyślij ją ponownie.</div>`:""}<div class="supplier-split-list">${grupy.map(([d,items])=>agentAIZlecenieTabelaDostawcyHTML(z,d,items)).join("")}</div><footer class="supplier-order-actions">${zamkniete?"":`<button class="btn telegram-btn" onclick="agentAIWyslijZlecenieTelegram(${jsArg(z.id)})">✈️ Wyślij podgląd na Telegram</button>`}${robocze&&!approvedCurrent?`<button class="btn ghost" onclick="agentAIZatwierdzZlecenie(${jsArg(z.id)})">✅ Zatwierdź wersję ${revision}</button>`:""}${!pelnaWysylka?`<button class="btn" onclick="agentAIWyslijZlecenieEmail(${jsArg(z.id)})" ${((!approvedCurrent&&!czesciowe)||missingEmail||zamkniete)?"disabled":""}>✉️ ${czesciowe?"Ponów brakujące e-maile":"Wyślij e-mailem do producenta"}</button>`:""}${pelnaWysylka?`<button class="btn" onclick="agentAIPonowEmailProducenta(${jsArg(z.id)})" ${missingEmail?"disabled":""}>🔁 Wyślij ponownie</button>`:""}${wyslane&&!przyjeto?`<button class="btn ghost" onclick="agentAIPrzygotujKorekteZlecenia(${jsArg(z.id)})">✏️ Utwórz korektę</button>`:""}<button class="btn ghost" onclick="agentAIPobierzZlecenieCSV(${jsArg(z.id)})">📤 Tabela bez cen CSV</button>${robocze?`<button class="btn danger" onclick="agentAIUsunZlecenie(${jsArg(z.id)})">🗑️ Anuluj szkic</button>`:""}</footer>${wyslane?`<div class="supplier-recovery-note"><b>Bezpieczne działania po wysyłce</b><span>„Wyślij ponownie” przekazuje identyczną zatwierdzoną wersję i wymaga podania powodu. „Utwórz korektę” nie usuwa dostarczonego e-maila — zachowuje go w audycie i otwiera nową wersję do edycji.</span></div>`:""}${agentAIHistoriaEmailiProducentaHTML(z)}${missingEmail&&!zamkniete?`<div class="backend-note" style="border-color:#fed7aa;background:#fff7ed"><b>Brak e-maila producenta.</b> Uzupełnij kartotekę przed zatwierdzoną wysyłką.</div>`:""}</article>`;
}
function agentAIZleceniaPanelHTML(){
  const wszystkie=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))),lista=wszystkie.filter(agentAIPlanDokumentPasuje),aktywne=lista.filter(agentAIPlanDokumentAktywny),historia=lista.filter(z=>!agentAIPlanDokumentAktywny(z)),otwarteWszystkie=wszystkie.filter(agentAIPlanDokumentAktywny),approved=otwarteWszystkie.filter(z=>z.approvedAt&&Number(z.approvalRevision||0)===Math.max(1,Number(z.revision)||1)).length,sent=otwarteWszystkie.filter(z=>z.emailSentAt||String(z.status||"").toLowerCase().includes("wysłane do")).length,doPrzyjecia=otwarteWszystkie.filter(z=>(z.emailSentAt||String(z.status||"").toLowerCase().includes("wysłane do"))&&(z.pozycje||[]).some(p=>Number(p.przyjeto||0)<Number(p.ilosc||0))).length,dostawcy=agentAIPlanDostawcy();
  return `<div class="panel agent-orders-panel supplier-restock-plan"><div class="order-section-head"><div><span class="order-pro-label">Dokumenty producentów</span><h2 style="margin-top:.25rem">🧾 Zamówienia i przyjęcia</h2><p class="order-detail-lead">Kontrola tabeli, zatwierdzenie, wysyłka i przyjęcie dostawy — w jednym przebiegu.</p></div><div class="diag-actions"><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()">↻ Przelicz aktualne braki</button><a class="btn ghost" href="#/admin/agent-ai/producenci">🏭 Producenci</a></div></div>
  <nav class="supplier-plan-statusbar" aria-label="Filtry dokumentów producentów"><button class="${agentAIPlanFiltrStatusu==="aktywne"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="aktywne"}" onclick="agentAIPlanFiltrStatusu='aktywne';odswiezPlanZatowarowaniaWidoku()"><b>${otwarteWszystkie.length}</b><small>aktywne dokumenty</small></button><button class="${agentAIPlanFiltrStatusu==="zatwierdzone"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="zatwierdzone"}" onclick="agentAIPlanFiltrStatusu='zatwierdzone';odswiezPlanZatowarowaniaWidoku()"><b>${approved}</b><small>zatwierdzone</small></button><button class="${agentAIPlanFiltrStatusu==="wyslane"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="wyslane"}" onclick="agentAIPlanFiltrStatusu='wyslane';odswiezPlanZatowarowaniaWidoku()"><b>${sent}</b><small>wysłane / w dostawie</small></button><button class="${agentAIPlanFiltrStatusu==="przyjecie"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="przyjecie"}" onclick="agentAIPlanFiltrStatusu='przyjecie';odswiezPlanZatowarowaniaWidoku()"><b>${doPrzyjecia}</b><small>do przyjęcia</small></button><button class="${agentAIPlanFiltrStatusu==="zamkniete"?"active":""}" aria-pressed="${agentAIPlanFiltrStatusu==="zamkniete"}" onclick="agentAIPlanFiltrStatusu='zamkniete';odswiezPlanZatowarowaniaWidoku()"><b>${wszystkie.length-otwarteWszystkie.length}</b><small>historia</small></button></nav>
  <div class="supplier-plan-filters"><label class="supplier-plan-search">Wyszukaj<input id="supplierPlanSearch" value="${esc(agentAIPlanSzukaj)}" placeholder="Nazwa, EXTERNAL_ID, SKU, kod producenta, EAN lub numer szkicu…" oninput="agentAIPlanSzukajDokumenty(this)" autocomplete="off"></label><label>Producent<select id="supplierPlanSupplierFilter" onchange="agentAIPlanFiltrProducenta=this.value;odswiezPlanZatowarowaniaWidoku()"><option value="wszyscy">Wszyscy producenci</option>${dostawcy.map(x=>`<option value="${esc(x)}" ${agentAIPlanFiltrProducenta===x?"selected":""}>${esc(x)}</option>`).join("")}</select></label><label>Status<select id="supplierPlanStatusFilter" onchange="agentAIPlanFiltrStatusu=this.value;odswiezPlanZatowarowaniaWidoku()">${[["aktywne","Aktywne — domyślnie"],["szkice","Szkice do kontroli"],["zatwierdzone","Zatwierdzone wersje"],["wyslane","Wysłane / w dostawie"],["przyjecie","Z rozpoczętym przyjęciem"],["zamkniete","Historia: zakończone, anulowane i zastąpione"],["wszystkie","Wszystkie"]].map(([v,l])=>`<option value="${v}" ${agentAIPlanFiltrStatusu===v?"selected":""}>${l}</option>`).join("")}</select></label><button class="btn ghost" onclick="agentAIPlanWyczyscFiltry()">Wyczyść filtry</button></div>
  ${agentAIPlanReczneDodanieHTML()}<div class="admin-search-results-line"><span>Znaleziono <b>${lista.length}</b> dokumentów • aktywne ${aktywne.length}</span><span>Domyślnie historia jest zwinięta</span></div>
  <div class="supplier-order-list">${aktywne.map(agentAIPlanKartaDokumentuHTML).join("")||`<div class="backend-note">Nie ma aktywnych szkiców pasujących do filtrów. Uzgodnij braki albo dodaj pozycję ręcznie powyżej.</div>`}</div>
  <details class="supplier-order-history" ${agentAIPlanFiltrStatusu==="zamkniete"?"open":""}><summary>🕓 Historia zakończonych, anulowanych i zastąpionych (${historia.length})</summary><div class="supplier-order-list">${historia.map(agentAIPlanKartaDokumentuHTML).join("")||`<div class="backend-note">Brak zamkniętych dokumentów pasujących do filtrów.</div>`}</div></details></div>`;
}
function agentAIPowiekszPozycjeZlecenia(id, produktId, lineKey=""){
  const raw=prompt("O ile sztuk powiększyć tę pozycję? Nadwyżka zostanie oznaczona do przyjęcia na magazyn po dostawie.","1");
  if(raw===null) return;
  const delta=Math.max(0,parseInt(String(raw).replace(",",".").replace(/[^\d.-]/g,""),10)||0);
  if(!delta){ toast("Podaj dodatnią liczbę sztuk"); return; }
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id)),p=(z?.pozycje||[]).find(x=>(lineKey&&String(x.stableKey||x.lineKey||x.id||"")===String(lineKey))||String(x.produktId)===String(produktId));
  if(!z||!p){toast("Nie znaleziono pozycji");return;}
  agentAIUstawIloscPozycji(id,produktId,(Number(p.ilosc)||0)+delta,lineKey);
}
async function agentAIUstawIloscPozycji(id,produktId,wartosc,lineKey=""){
  const wpisana=Math.max(0,parseInt(String(wartosc??0).replace(/[^\d-]/g,""),10)||0);
  const z=(agentAIZlecenia||[]).find(x=>String(x.id)===String(id)),p=(z?.pozycje||[]).find(x=>(lineKey&&String(x.stableKey||x.lineKey||x.id||"")===String(lineKey))||String(x.produktId)===String(produktId));
  if(!z||!p){toast("Nie znaleziono pozycji");return;}
  const potrzebna=Math.max(0,Number(p.iloscPotrzebna)||0),ilosc=Math.max(potrzebna,wpisana);
  try{
    const body={draftId:z.id,supplier:String(p.dostawca||agentAIDostawcaZlecenia(z)),productId:String(produktId||p.produktId||""),lineKey:String(lineKey||p.stableKey||p.lineKey||p.id||""),quantity:ilosc,expectedRevision:Math.max(1,Number(z.revision)||1)};
    const d=await chmura("supplier-order-line-upsert",{method:"POST",body,timeout:45000});
    await agentAIPlanOdswiezPoOperacji(d,`✅ Ilość w szkicu: ${ilosc} szt.`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie zmieniono ilości");}
}
function agentAIPrzesunIloscPozycji(id,produktId,delta,lineKey=""){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  const p=(z?.pozycje||[]).find(x=>(lineKey&&String(x.stableKey||x.lineKey||x.id||"")===String(lineKey))||String(x.produktId)===String(produktId));
  if(!p){toast("Nie znaleziono pozycji");return;}
  agentAIUstawIloscPozycji(id,produktId,Math.max(0,(Number(p.ilosc)||0)+Number(delta||0)),lineKey);
}
async function agentAIWyslijZlecenieTelegram(id,dostawca=""){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zlecenia producenta");return;}
  try{
    toast("Przygotowuję tabelę i wysyłam na Telegram…");
    const d=await chmura("telegram-send-supplier-order",{method:"POST",body:{draftId:z.id,expectedRevision:Math.max(1,Number(z.revision)||1),supplier:dostawca||""},timeout:30000});
    zapiszHistorieAgenta("telegram",`Wysłano tabelę ${z.numer||z.id} na Telegram`,{zlecenieId:id,dostawcy:d.suppliers||[],wiadomosci:(d.messageIds||[]).length});
    toast(`Telegram: wysłano ${d.tables||0} tabel ✅`);
  }catch(e){toast("⚠️ Telegram: "+(e.message||e));}
}
function agentAIDaneProducentaDoEmaila(p={}){return {name:p.name||p.nazwa||""};}
async function agentAIWyslijZlecenieEmail(id,opcje={}){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const revision=Math.max(1,Number(z.revision)||1),forceResend=opcje.forceResend===true,resendReason=String(opcje.resendReason||"").trim(),status=String(z.status||"").toLowerCase();
  const zwyklaWysylka=["zaakceptowane","częściowo wysłane e-mailem"].includes(status),ponowienie=forceResend&&!!z.emailSentAt&&["wysłane do producenta","wysłane do dostawcy","częściowo wysłane e-mailem","częściowo zrealizowane","zrealizowane"].includes(status);
  const approvalOk=forceResend?ponowienie:(!!z.approvedAt&&Number(z.approvalRevision||0)===revision);
  if((!zwyklaWysylka&&!ponowienie)||!approvalOk){toast(forceResend?"⚠️ Ten dokument nie ma potwierdzonej wcześniejszej wysyłki":"⚠️ Najpierw zatwierdź dokładnie tę wersję zamówienia");return;}
  if(forceResend&&resendReason.length<3){toast("Podaj powód ponownej wysyłki");return;}
  const names=[...new Set((z.pozycje||[]).map(p=>String(p.dostawca||agentAIDostawcaZlecenia(z)).trim()).filter(Boolean))];
  const suppliers=names.map(producentPoNazwie).filter(Boolean);
  const missing=names.filter(name=>!producentPoNazwie(name)?.orderEmail);
  if(missing.length){toast(`⚠️ Uzupełnij e-mail zamówień w kartotece: ${missing.join(", ")}`);location.hash="#/admin/agent-ai/producenci";return;}
  const adresaci=suppliers.map(p=>`${p.name||p.nazwa} <${p.orderEmail}>`).join("\n"),sztuk=(z.pozycje||[]).reduce((s,p)=>s+Number(p.ilosc||0),0);
  if(!confirm(`${forceResend?"OSTATECZNE POTWIERDZENIE PONOWNEJ WYSYŁKI":"OSTATECZNE POTWIERDZENIE WYSYŁKI"}\n\nDokument: ${z.numer||z.id} • wersja ${revision}\nPozycji: ${(z.pozycje||[]).length} • sztuk: ${sztuk}${forceResend?`\nPowód: ${resendReason}`:""}\n\nAdresaci:\n${adresaci}\n\nKliknięcie OK naprawdę wyśle e-mail do producenta. Czy potwierdzasz?`)){toast("Wysyłka anulowana — żaden e-mail nie został wysłany");return;}
  try{
    toast("Wysyłam zatwierdzone zamówienie e-mailem do producenta…");
    const d=await chmura("email-send-supplier-order",{method:"POST",body:{order:{id:z.id,revision},suppliers:suppliers.map(agentAIDaneProducentaDoEmaila),forceResend,resendReason},timeout:90000});
    const sent=(d.results||[]).filter(x=>x.sent),failed=(d.results||[]).filter(x=>!x.sent);
    if(Array.isArray(d.supplierOrders)||d.draft){
      zapiszHistorieAgenta("email-producent",d.allSent?`Wysłano ${z.numer||z.id} e-mailem do producenta`:`Częściowa wysyłka ${z.numer||z.id}`,{zlecenieId:id,revision,wyslane:sent.map(x=>x.supplier),bledy:failed.map(x=>({supplier:x.supplier,error:x.error}))});
      await agentAIPlanOdswiezPoOperacji(d,d.allSent?(forceResend?"✅ Ponownie wysłano e-mail. Próba została zapisana w historii.":"✅ Zamówienie wysłane e-mailem. Przyjęcie dostawy jest teraz dostępne."):`⚠️ Wysłano ${sent.length}, nie wysłano ${failed.length}. Ponów brakujące wiadomości.`);return;
    }
    zapiszHistorieAgenta("email-producent",d.allSent?`Wysłano ${z.numer||z.id} e-mailem do producenta`:`Częściowa wysyłka ${z.numer||z.id}`,{zlecenieId:id,revision,wyslane:sent.map(x=>x.supplier),bledy:failed.map(x=>({supplier:x.supplier,error:x.error}))});
    await agentAIUzgodnijPlanZSerwerem({silent:true});
    toast(d.allSent?"✅ Zamówienie wysłane e-mailem. Plan pobrano ponownie z serwera.":`⚠️ Wysłano ${sent.length}, nie wysłano ${failed.length}. Ponów przyciskiem — wysłane wiadomości nie zdublują się.`);
  }catch(e){toast("⚠️ E-mail do producenta: "+(e.message||e));}
}
async function agentAIPrzyjmijPozycjeZlecenia(id, produktId, wartosc="", lineKey=""){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  const poz=(Array.isArray(z?.pozycje)?z.pozycje:[]).find(p=>(lineKey&&String(p.stableKey||p.lineKey||p.id||"")===String(lineKey))||String(p.produktId)===String(produktId));
  if(!z||!poz){ toast("Nie znaleziono pozycji do przyjęcia"); return; }
  const pozostalo=Math.max(0,(Number(poz.ilosc)||0)-(Number(poz.przyjeto)||0));
  const raw=String(wartosc||"").trim()||prompt(`Ile sztuk faktycznie dostarczono dla: ${poz.nazwa}?`,String(Math.max(1,pozostalo)));
  if(raw===null||raw==="") return;
  const ilosc=Math.max(0,parseInt(String(raw).replace(",",".").replace(/[^\d.-]/g,""),10)||0);
  if(!ilosc){ toast("Podaj dodatnią liczbę sztuk"); return; }
  const nadwyzka=Math.max(0,ilosc-pozostalo),stanPrzed=stanMagazynuId(produktId);
  if(!confirm(`${nadwyzka?`Dostawa jest większa od pozostałej ilości o ${nadwyzka} szt. Nadwyżka zwiększy stan magazynowy.\n\n`:""}Przyjąć faktycznie dostarczone ${ilosc} szt. produktu „${poz.nazwa}”?\nStan przed operacją: ${stanPrzed===null?"niemonitorowany":stanPrzed+" szt."}.`)){toast("Przyjęcie anulowane — stan nie został zmieniony");return;}
  const button=document.activeElement instanceof HTMLButtonElement?document.activeElement:null;if(button)button.disabled=true;
  try{
    const requestId=`receive-${String(id)}-${String(lineKey||produktId)}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const d=await chmura("supplier-order-receive",{method:"POST",body:{draftId:z.id,productId:String(produktId||poz.produktId||""),lineKey:String(lineKey||poz.stableKey||poz.lineKey||poz.id||""),quantity:ilosc,requestId,expectedReceiptRevision:Math.max(0,Number(z.receiptRevision)||0)},timeout:60000});
    await agentAIPlanOdswiezPoOperacji(d,`✅ Przyjęto ${ilosc} szt.${nadwyzka?` • nadwyżka ${nadwyzka} szt. zwiększyła stan`:""}`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie przyjęto dostawy");}finally{if(button?.isConnected)button.disabled=false;}
}
async function agentAIPrzyjmijDokumentZlecenia(id,form=null,event=null){
  if(event)event.preventDefault();
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono dokumentu do przyjęcia");return false;}
  const pozycje=Array.isArray(z.pozycje)?z.pozycje:[],pozostalo=pozycje.reduce((s,p)=>s+Math.max(0,Number(p.ilosc||0)-Number(p.przyjeto||0)),0);
  if(!pozostalo){toast("Dokument jest już w całości przyjęty");return false;}
  let receipts=null,units=pozostalo,roznice=0;
  if(form){
    receipts=[...form.querySelectorAll("[data-line-key]")].map(input=>({lineKey:String(input.dataset.lineKey||""),productId:String(input.dataset.productId||""),quantity:Math.max(0,parseInt(String(input.value||0).replace(/[^\d-]/g,""),10)||0)}));
    units=receipts.reduce((s,x)=>s+x.quantity,0);
    roznice=receipts.filter((x,index)=>x.quantity!==Math.max(0,Number(pozycje[index]?.ilosc||0)-Number(pozycje[index]?.przyjeto||0))).length;
  }
  const komunikat=form
    ? `Przyjąć dokument z korektą?\n\nDostarczono teraz: ${units} szt.\nPozycji ze zmienioną ilością: ${roznice}.\nBraki pozostaną otwarte, a nadwyżki zwiększą stan.`
    : `Przyjąć cały dokument producenta?\n\nNa magazyn trafi ${units} szt. Jedna operacja rozdzieli ilości na właściwe zamówienia Allegro i przeniesie kompletne zlecenia do „Oczekuje na wysyłkę”.`;
  if(!confirm(komunikat)){toast("Przyjęcie anulowane — żaden stan nie został zmieniony");return false;}
  const button=form?.querySelector('button[type="submit"]')||(document.activeElement instanceof HTMLButtonElement?document.activeElement:null);if(button)button.disabled=true;
  try{
    const requestId=`receive-document-${String(id)}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const body={draftId:z.id,requestId,expectedReceiptRevision:Math.max(0,Number(z.receiptRevision)||0)};
    if(receipts)body.receipts=receipts;
    const d=await chmura("supplier-order-document-receive",{method:"POST",body,timeout:90000});
    const batch=d.receiptBatch||{},workflow=Number(d.procurementWorkflow?.changed)||0;
    await agentAIPlanOdswiezPoOperacji(d,`✅ Przyjęto dokument: ${batch.receivedUnits??units} szt.${batch.missingLines?` • ${batch.missingLines} pozycji czeka na uzupełnienie`:" • kompletne zamówienia oczekują na wysyłkę"}${workflow?` • zaktualizowano ${workflow} zleceń Allegro`:""}`);
  }catch(e){await agentAIPlanBladOperacji(e,"Nie przyjęto dokumentu");}finally{if(button?.isConnected)button.disabled=false;}
  return false;
}
function agentAINadwyzkiDoPrzyjecia(){
  const out=[];
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(agentAIPlanDokumentAktywny).forEach(z=>{
    (Array.isArray(z.pozycje)?z.pozycje:[]).forEach(p=>{
      const ilosc=Number(p.ilosc)||0, potrzebna=Number(p.iloscPotrzebna ?? ilosc)||0, przyjeto=Number(p.przyjeto)||0;
      const nadwyzka=Math.max(0,ilosc-potrzebna);
      const przyjetaNadwyzka=Math.max(0,przyjeto-potrzebna);
      const doPrzyjecia=Math.max(0,nadwyzka-przyjetaNadwyzka);
      if(doPrzyjecia>0) out.push({zlecenie:z,pozycja:p,nadwyzka,doPrzyjecia,przyjeto});
    });
  });
  return out;
}
function agentAIPlanWierszeEksportu(dokumenty=agentAIZlecenia,braki=agentAIBrakiOperacyjne(),productFinder=produktMagazynowy){
  const rows=[],znajdz=typeof productFinder==="function"?productFinder:(()=>({}));
  const dodaj=(pozycja,ilosc,zrodlo)=>{
    const qty=Math.max(0,Number(ilosc)||0);if(!qty)return;
    const produkt=znajdz(pozycja.produktId)||{},identyfikator=agentAIStabilnyIdentyfikatorPozycji(pozycja,produkt);
    rows.push({kod:identyfikator.wartosc||"",nazwa:String(pozycja.nazwa||produkt.nazwa||"Produkt").trim()||"Produkt",ilosc:qty,brakKodu:!identyfikator.wartosc,zrodlo});
  };
  (Array.isArray(dokumenty)?dokumenty:[]).filter(agentAIPlanDokumentAktywny).forEach(z=>(Array.isArray(z.pozycje)?z.pozycje:[]).forEach(p=>{
    const wymagane=Math.max(0,Number(p.iloscPotrzebna??p.baseRequired)||0),nadwyzka=Math.max(0,Number(p.manualExtra??p.nadwyzka)||0),zamowiono=Math.max(0,Number(p.ilosc??p.quantity)||0);
    dodaj(p,Math.max(zamowiono,wymagane+nadwyzka),"szkic");
  }));
  (Array.isArray(braki)?braki:[]).forEach(x=>dodaj(x,Math.max(0,Number(x.pozostaloDoZamowienia)||0),"brak"));
  return rows;
}
function eksportujTabeleOperacyjnaMagazynuCSV(){
  const rows=agentAIPlanWierszeEksportu();
  if(!rows.length){toast("Brak aktywnych pozycji Planu do eksportu");return;}
  const bezKodu=rows.filter(x=>x.brakKodu);
  if(agentAIEksportZablokowanyPrzezBrakKodow(bezKodu,"Eksport Planu"))return false;
  const csv=[["kod","nazwa","ilosc"],...rows.map(x=>[x.kod,x.nazwa,x.ilosc])].map(r=>r.map(csvPole).join(";")).join("\n");
  pobierzPlik("plan-zatowarowania-bez-cen.csv","\uFEFF"+csv,"text/csv");
  zapiszHistorieAgenta("eksport","Wyeksportowano bezcenowy Plan zatowarowania",{wiersze:rows.length,bezKodu:0});
  toast(`Wyeksportowano ${rows.length} pozycji bez cen ✅`);return true;
}
function magazynBrakiDostawcyHTML(dostawca,rows){
  const pozostalo=rows.reduce((s,x)=>s+Number(x.pozostaloDoZamowienia||0),0), pokryte=rows.reduce((s,x)=>s+Number(x.wZleceniach||0),0);
  return `<section class="ops-supplier-card"><header><div><span class="supplier-chip">🏭 ${esc(dostawca)}</span><h3>Braki do aktywnych zamówień</h3><small>${rows.length} produktów • do zamówienia ${pozostalo} szt. • pokryte w szkicach ${pokryte} szt.</small></div><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()" ${pozostalo?"":"disabled"}>Utwórz / uzupełnij szkic</button></header><div class="warehouse-worktable-wrap"><table class="log-table ops-shortage-table"><thead><tr><th>Produkt i kod</th><th>Brak</th><th>W szkicach</th><th>Do zamówienia</th><th>Stan i zamówienia</th><th>Akcja</th></tr></thead><tbody>${rows.map(x=>{const produkt=produktMagazynowy(x.produktId)||x.product||{},identyfikator=agentAIStabilnyIdentyfikatorPozycji(x,produktMagazynowy(x.produktId)||x.product||{}),wirtualny=String(x.produktId||"").startsWith("allegro-offer:");return `<tr class="${x.pozostaloDoZamowienia>0?"row-alert":"row-covered"}"><td><div class="supplier-product-cell"><span class="admin-product-thumb">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="" loading="lazy">`:`<span class="admin-product-thumb-fallback">${esc(produkt.ikona||"🎲")}</span>`}</span><div><b>${esc(x.nazwa)}</b><strong>${esc(identyfikator.wartosc||"uzupełnij kod")}</strong><small>${esc(identyfikator.typ||"brak stabilnego identyfikatora")}${x.ean?` • EAN ${esc(x.ean)}`:""}</small></div></div></td><td><b>${esc(x.brakCalkowity)} szt.</b></td><td><b>${esc(x.wZleceniach)} szt.</b></td><td><span class="lvl ${x.pozostaloDoZamowienia>0?"lvl-ostrzezenie":"lvl-ok"}"><b>${esc(x.pozostaloDoZamowienia)} szt.</b></span></td><td><b>${x.stan===null?"bez limitu":`${esc(x.stan)} szt.`}</b><small>rezerwacje ${esc(x.rezerwacje||0)} • ${esc((x.zamowienia||[]).join(", ")||"brak powiązania")}</small></td><td>${wirtualny?`<a class="btn ghost" href="#/admin/allegro/oferty">🟠 Oferta Allegro</a>`:`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(x.produktId)}">✏️ Produkt</a>`}</td></tr>`;}).join("")}</tbody></table></div></section>`;
}
function magazynTabelaOperacyjnaHTML(){
  const braki=agentAIBrakiOperacyjne(),grupy=agentAIGrupujPoDostawcy(braki),pozostalo=braki.reduce((s,x)=>s+Number(x.pozostaloDoZamowienia||0),0),wZleceniach=braki.reduce((s,x)=>s+Number(x.wZleceniach||0),0);
  const aktywne=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(agentAIPlanDokumentAktywny);
  return `<div class="panel warehouse-worktable-panel ops-control-center"><div class="order-section-head"><div><span class="order-pro-label">Aktualne zapotrzebowanie</span><h2 style="margin-top:.25rem">📑 Braki do zamówień</h2><p class="order-detail-lead">Każda pozycja z aktywnego zamówienia sklepu lub Allegro trafia tutaj. Towar już ujęty w szkicu nie jest liczony drugi raz.</p></div><div class="diag-actions" style="margin-top:0"><button class="btn" onclick="agentAIUzgodnijPlanZSerwerem()" ${braki.length?"":"disabled"}>↻ Przelicz i uzgodnij</button><button class="btn ghost" onclick="eksportujTabeleOperacyjnaMagazynuCSV()">📤 CSV bez cen</button></div></div><nav class="supplier-plan-statusbar" aria-label="Podsumowanie braków"><span><b>${braki.length}</b><small>produkty z brakiem</small></span><span><b>${pozostalo}</b><small>szt. do dodania</small></span><span><b>${wZleceniach}</b><small>szt. w szkicach</small></span><span><b>${grupy.length}</b><small>producenci</small></span><span><b>${aktywne.length}</b><small>aktywne dokumenty</small></span></nav><div class="ops-supplier-list">${grupy.map(([d,rows])=>magazynBrakiDostawcyHTML(d,rows)).join("")||`<div class="backend-note">✅ Brak realnych braków do aktywnych zamówień.</div>`}</div></div>${agentAIZleceniaPanelHTML()}`;
}
