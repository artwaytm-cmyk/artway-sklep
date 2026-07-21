/* Dane firmy, płatności oraz utrzymanie identyfikatorów produktu */
function daneFirmy(){
  const d = {...DANE_FIRMY_DOMYSLNE, ...(KONFIG.daneFirmy||{})};
  const ident = tylkoCyfry(d.identyfikator || d.nip || d.pesel || DANE_FIRMY_DOMYSLNE.identyfikator);
  d.identyfikator = ident;
  d.nip = tylkoCyfry(d.nip || ident);
  d.regon = tylkoCyfry(d.regon || DANE_FIRMY_DOMYSLNE.regon);
  if(d.nip===DANE_FIRMY_DOMYSLNE.nip){
    if(!String(d.nazwa||"").trim()||/^artway-?tm$/i.test(String(d.nazwa||"").trim()))d.nazwa=DANE_FIRMY_DOMYSLNE.nazwa;
    if(!String(d.adres||"").trim()||String(d.adres).includes("84-207"))d.adres=DANE_FIRMY_DOMYSLNE.adres;
    d.kodPocztowy=String(d.kodPocztowy||DANE_FIRMY_DOMYSLNE.kodPocztowy).trim();
    d.miasto=String(d.miasto||DANE_FIRMY_DOMYSLNE.miasto).trim();
  }
  delete d.pesel;
  return d;
}
function pelnyAdresFirmy(d=daneFirmy()){
  return [String(d.adres||"").trim(),[String(d.kodPocztowy||"").trim(),String(d.miasto||"").trim()].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
function daneFirmyTekst(){
  const d = daneFirmy();
  return `${d.nazwa}${pelnyAdresFirmy(d)?`, ${pelnyAdresFirmy(d)}`:""}, NIP: ${d.nip}, REGON: ${d.regon}`;
}
function daneFirmyHTML(){
  const d = daneFirmy();
  return `<strong>${esc(d.nazwa)}</strong><br>${esc(pelnyAdresFirmy(d))}<br><b>NIP:</b> ${esc(d.nip)} • <b>REGON:</b> ${esc(d.regon)}`;
}
function danePrawneFirmyKompletne(){
  const d=daneFirmy(),wartosci=[d.nazwa,d.nip,d.regon,d.adres,d.kodPocztowy,d.miasto];
  return wartosci.every(value=>{const tekst=String(value||"").trim().toLowerCase();return tekst&&!tekst.includes("[nazwa firmy")&&!tekst.includes("uzupełnij")&&!tekst.includes("000 000");})
    && walidujNip(d.nip) && /^\d{9}(?:\d{5})?$/.test(d.regon);
}
function normalizujPlatnosci(lista){
  const bazowe = DOMYSLNE_PLATNOSCI.map(p=>({...p}));
  const domyslne = Object.fromEntries(bazowe.map(p=>[p.id,p]));
  const wynik = [], widziane = new Set();
  const zrodlo = Array.isArray(lista) ? lista : [];
  for(const raw of zrodlo){
    if(!raw || typeof raw!=="object") continue;
    let id = String(raw.id||"").trim();
    if(id==="przelew") continue;          // usuwamy starą metodę bankową ze starych ustawień
    if(id==="online") id = "paynow";      // stara płatność online staje się Paynow
    const podstawa = domyslne[id] || null;
    const p = {...(podstawa||{}), ...raw, id};
    delete p.wymagaLink;
    if(id==="paynow"){
      p.nazwa = "mBank Paynow — BLIK, karta lub szybki przelew";
      p.bramka = "paynow";
    }
    if(id==="telefon"){
      p.nazwa = `Przelew na telefon ${formatTelefonPlatnosci()}`;
      p.typ = "telefon";
      p.oplata = Number(p.oplata||0);
    }
    if(!id || widziane.has(id)) continue;
    widziane.add(id); wynik.push(p);
  }
  for(const p of bazowe){
    if(!widziane.has(p.id)){
      wynik.push(p.id==="telefon" ? {...p,nazwa:`Przelew na telefon ${formatTelefonPlatnosci()}`} : p);
      widziane.add(p.id);
    }
  }
  return wynik;
}
function migrujTresciPrawne(tresci){
  if(!tresci || typeof tresci!=="object") return tresci || null;
  const zamien = v => String(v||"")
    .replace(/\[nazwa firmy,\s*NIP,\s*adres\]/gi, daneFirmyTekst())
    .replace(/\[nazwa firmy,\s*adres\]/gi, daneFirmyTekst())
    .replace(new RegExp(LEGACY_PRZELEW_TEKST, "gi"), "przelew na telefon")
    .replace(/Przelewy24\s*\/\s*PayU\s*\/\s*Stripe/gi, "mBank Paynow")
    .replace(/<p><i>Szablon (regulaminu|polityki prywatności)[^<]*<\/i><\/p>/gi, "")
    .replace(/dane te nie opuszczają Twojego urządzenia/gi, "część danych pozostaje lokalnie, a dane konta i zamówień są synchronizowane z zabezpieczonym serwerem sklepu");
  return Object.fromEntries(Object.entries(tresci).map(([k,v])=>[k,zamien(v)]));
}
function platnosciOpis(){
  return dostepnePlatnosci().map(p=>p.nazwa).join(", ") || "brak aktywnych metod płatności";
}
let paynowPubliczne={sprawdzono:false,configured:false,env:"",error:""};
async function pobierzPaynowKonfiguracjePubliczna(){
  try{
    const d=await chmura("paynow-config",{timeout:9000});
    paynowPubliczne={sprawdzono:true,configured:!!d.configured,env:String(d.env||""),error:""};
  }catch(e){paynowPubliczne={sprawdzono:true,configured:false,env:"",error:String(e?.message||e)};}
  return paynowPubliczne;
}
function czyPaynowDostepnyPublicznie(){return !!paynowPubliczne.configured;}
function instrukcjaPlatnosciTekst(id, nr, kwota){
  const kw = typeof kwota==="number" ? zl(kwota) : String(kwota||"");
  if(id==="pobranie") return `Płatność przy odbiorze: do zapłaty ${kw}.`;
  if(id==="telefon") return `Przelew na telefon: ${formatTelefonPlatnosci()}. W tytule/wiadomości wpisz: Zamówienie ${nr}. Kwota: ${kw}.`;
  if(id==="paynow") return KONFIG.linkPlatnosci
    ? `mBank Paynow: opłać zamówienie tutaj: ${KONFIG.linkPlatnosci}. Numer zamówienia: ${nr}. Kwota: ${kw}.`
    : `mBank Paynow: po złożeniu zamówienia sklep utworzy płatność i pokaże przycisk zapłaty. Numer zamówienia: ${nr}. Kwota: ${kw}.`;
  return `Płatność: ${kw}. Numer zamówienia: ${nr}.`;
}
function paynowDane(z){ return (z && typeof z==="object" && (z.paynow || z.platnoscPaynow)) || {}; }
function paynowStatusTekst(status){
  switch(String(status||"").toUpperCase()){
    case "CONFIRMED": return "opłacone";
    case "PENDING": return "oczekuje na potwierdzenie";
    case "NEW": return "rozpoczęte";
    case "EXPIRED": return "wygasła";
    case "REJECTED": return "odrzucona";
    case "ABANDONED": return "porzucona";
    case "ERROR": return "błąd płatności";
    default: return status ? String(status) : "brak statusu";
  }
}
function paynowKolorStatusu(status){
  status=String(status||"").toUpperCase();
  if(status==="CONFIRMED") return "var(--ok)";
  if(status==="ERROR"||status==="REJECTED"||status==="EXPIRED"||status==="ABANDONED") return "var(--danger)";
  return "var(--warn)";
}
const paynowStatusAutosprawdzone = new Set();
function instrukcjaPaynowHTML(nr, kwota, zam=null){
  const kw = typeof kwota==="number" ? zl(kwota) : esc(kwota||"");
  const p = paynowDane(zam);
  const link = p.redirectUrl || p.redirect_url || KONFIG.linkPlatnosci || "";
  const status = p.status || "";
  const paymentId = p.paymentId || "";
  const statusHtml = status ? `<p class="pay-note" style="text-align:left;margin-top:.5rem;border-left-color:${paynowKolorStatusu(status)}">Status Paynow: <b>${esc(paynowStatusTekst(status))}</b>${paymentId?` • ID: <code>${esc(paymentId)}</code>`:""}</p>` : "";
  if(link){
    return `<div>
      <a href="${esc(link)}" target="_blank" rel="noopener" class="checkout-btn" style="display:block;text-decoration:none;text-align:center;background:var(--ok)">💳 Zapłać przez mBank Paynow ${kw}</a>
      ${statusHtml || `<p class="pay-note">Płatność Paynow utworzona dla zamówienia <b>${esc(nr)}</b>.</p>`}
      ${paymentId?`<div class="diag-actions" style="margin-top:.45rem"><button class="btn ghost" type="button" onclick="odswiezStatusPaynow(${jsArg(nr)},${jsArg(paymentId)})">🔄 Sprawdź status Paynow</button></div>`:""}
    </div>`;
  }
  return `<div class="pay-note" style="font-size:.95rem;text-align:left">💳 <b>mBank Paynow</b><br>Brama jest wybrana, ale link płatności nie został jeszcze utworzony. Jeżeli zamówienie już istnieje, odśwież status albo sprawdź konfigurację Paynow w panelu admina.<br><b>Numer zamówienia:</b> ${esc(nr)} • <b>Kwota:</b> ${kw}</div>`;
}
async function utworzPlatnoscPaynow(zamowienie){
  if(!zamowienie || zamowienie.platnoscId!=="paynow") return {ok:false, skipped:true};
  try{
    toast("Tworzę płatność Paynow…");
    const d = await chmura("paynow-create",{method:"POST",body:{order:zamowienie},timeout:18000});
    zamowienie.paynow = {...paynowDane(zamowienie), ...(d.paynow||{}), paymentId:d.paymentId||d.paynow?.paymentId||paynowDane(zamowienie).paymentId||"", status:d.status||d.paynow?.status||"", redirectUrl:d.redirectUrl||d.paynow?.redirectUrl||""};
    zamowienie.platnoscStatus = d.paymentStatus || paynowStatusTekst(zamowienie.paynow.status);
    zapiszZamowienie(zamowienie);
    loguj("info",`Paynow: utworzono płatność ${zamowienie.paynow.paymentId||""} dla ${zamowienie.nr}`);
    return d;
  }catch(e){
    loguj("blad",`Paynow: nie udało się utworzyć płatności dla ${zamowienie.nr}: ${e.message}`);
    return {ok:false,error:e.message,code:e.code||""};
  }
}
async function odswiezStatusPaynow(nr,paymentId=""){
  try{
    toast("Sprawdzam status Paynow…");
    const d = await chmura("paynow-status",{params:{nr,paymentId},timeout:15000});
    const lista=pobierzZamowienia(), i=lista.findIndex(z=>z.nr===nr);
    if(i>=0 && d.order){
      lista[i]={...lista[i],...d.order,paynow:{...paynowDane(lista[i]),...(d.order.paynow||{})},platnoscStatus:d.paymentStatus||d.order.platnoscStatus||lista[i].platnoscStatus};
      zapiszLS("artway_zamowienia",lista);
    }
    toast("Paynow: "+paynowStatusTekst(d.status));
    renderuj();
  }catch(e){
    toast("Paynow: "+e.message);
    loguj("blad","Paynow status: "+e.message);
  }
}
async function zwrotPieniedzyPaynow(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z){ toast("Nie znaleziono zamówienia"); return; }
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora, aby zlecić zwrot"); chmuraUstawToken(); return; }
  const pelna=Number(z.razem)||0;
  const juz=(Array.isArray(z?.paynow?.refunds)?z.paynow.refunds:[]).reduce((s,r)=>s+(Number(r.amount)||0),0)/100;
  const pozostalo=Math.max(0,pelna-juz);
  const wpis=prompt(`Kwota zwrotu w zł dla ${nr} (pozostało do zwrotu: ${zl(pozostalo)}).\nZostaw domyślną wartość, aby zwrócić całą pozostałą kwotę:`, pozostalo.toFixed(2));
  if(wpis===null) return;
  const kwota=Number(String(wpis).replace(",",".").replace(/[^0-9.]/g,""))||0;
  if(kwota<=0){ toast("Podaj poprawną kwotę zwrotu"); return; }
  if(kwota>pozostalo+0.001){ toast(`Kwota przekracza pozostałe ${zl(pozostalo)}`); return; }
  if(!confirm(`Zwrócić ${zl(kwota)} klientowi przez Paynow?\nKlient dostanie automatyczny e-mail o zwrocie pieniędzy.`)) return;
  toast("Wysyłam zlecenie zwrotu do Paynow…");
  try{
    const d=await chmura("paynow-refund",{method:"POST",body:{nr,amount:kwota},timeout:25000});
    aktualizujZamowienie(nr,zam=>{
      zam.status="zwrot pieniędzy";
      if(d.order?.paynow) zam.paynow={...paynowDane(zam),...d.order.paynow};
      if(d.order?.platnoscStatus) zam.platnoscStatus=d.order.platnoscStatus;
      if(Array.isArray(d.powiadomienia)){ zam.wysylka=zam.wysylka||{}; zam.wysylka.powiadomienia=d.powiadomienia; }
    });
    loguj("info",`Zwrot Paynow ${nr}: ${d.refundId||""} (${d.status||""})`);
    toast(`Zwrot zlecony ✅ ${d.email?.sent?"E-mail wysłany":""}`);
    renderuj();
  }catch(e){
    loguj("blad",`Zwrot Paynow ${nr}: ${e.message}`);
    toast("Nie udało się zlecić zwrotu: "+e.message);
  }
}
function instrukcjaPlatnosciHTML(id, nr, kwota, zam=null){
  const kw = typeof kwota==="number" ? zl(kwota) : esc(kwota||"");
  if(id==="pobranie") return `<div class="pay-note" style="font-size:.95rem">💵 <b>Zapłacisz ${kw} przy odbiorze przesyłki InPost</b>. Nic więcej nie musisz robić.</div>`;
  if(id==="telefon"){
    const numer = formatTelefonPlatnosci(), tytul = `Zamówienie ${nr}`;
    return `<div class="pay-note" style="font-size:.95rem">
      📱 <b>Przelew na telefon</b><br>
      Numer: <code>${esc(numer)}</code> &nbsp; Tytuł/wiadomość: <code>${esc(tytul)}</code><br>
      Kwota: <b>${kw}</b>. Wyślij przelew na telefon i koniecznie wpisz numer zamówienia.
      <div class="diag-actions" style="margin-top:.55rem">
        <button class="btn ghost" type="button" onclick="navigator.clipboard?.writeText(${jsArg(tylkoCyfry(numer))});toast('Skopiowano numer telefonu')">Kopiuj numer</button>
        <button class="btn ghost" type="button" onclick="navigator.clipboard?.writeText(${jsArg(tytul)});toast('Skopiowano tytuł płatności')">Kopiuj tytuł</button>
      </div>
    </div>`;
  }
  if(id==="paynow"){
    return instrukcjaPaynowHTML(nr, kwota, zam);
  }
  return `<p class="pay-note">Płatność: <b>${kw}</b>. Numer zamówienia: <b>${esc(nr)}</b>.</p>`;
}
const bezpiecznyLink = s => /^(#\/|https?:\/\/|mailto:)/i.test(String(s||"")) ? String(s) : "#/";
const OKRES_KOSZA_MS = 30*24*60*60*1000;
function oznaczProduktWKoszu(id,typ){
  koszMeta={...koszMeta,[id]:{usunietoAt:Date.now(),typ}};
  zapiszLS("artway_kosz_meta",koszMeta);
}
function usunMetaKosza(id){
  delete koszMeta[id]; zapiszLS("artway_kosz_meta",koszMeta);
}
function dniDoUsuniecia(id){
  const ts=Number(koszMeta[id]?.usunietoAt||Date.now());
  return Math.max(0,Math.ceil((ts+OKRES_KOSZA_MS-Date.now())/86400000));
}
function wyczyscPrzeterminowanyKosz(){
  let zmiana=false;
  for(const p of koszDodanych) if(!koszMeta[p.id]){koszMeta[p.id]={usunietoAt:Date.now(),typ:"wlasny"};zmiana=true;}
  for(const id of produktyUkryte) if(!produktyDefinitywne.includes(id)&&!koszMeta[id]){koszMeta[id]={usunietoAt:Date.now(),typ:"bazowy"};zmiana=true;}
  const wygasle=Object.entries(koszMeta).filter(([,m])=>Date.now()-Number(m.usunietoAt||0)>=OKRES_KOSZA_MS);
  for(const [idTekst,m] of wygasle){
    const id=Number(idTekst);
    if(m.typ==="wlasny"){
      koszDodanych=koszDodanych.filter(p=>p.id!==id);
    }else{
      if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
      if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
      delete produktyEdytowane[id];
    }
    delete stanyProduktow[id];
    delete koszMeta[idTekst]; zmiana=true;
    loguj("info",`Kosz: automatycznie usunięto definitywnie produkt ${id} po 30 dniach`);
  }
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  if(zmiana){
    zapiszLS("artway_kosz_dodane",koszDodanych);
    zapiszLS("artway_kosz_meta",koszMeta);
    zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
    zapiszLS("artway_produkty_ukryte",produktyUkryte);
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
    zapiszLS("artway_stany",stanyProduktow);
  }
}
function najwyzszeIdProduktu(){
  const liczby=[
    ...prodBazowe.map(p=>Number(p.id)||0),
    ...produktyDodane.map(p=>Number(p.id)||0),
    ...koszDodanych.map(p=>Number(p.id)||0),
    ...produktyUkryte.map(id=>Number(id)||0),
    ...produktyDefinitywne.map(id=>Number(id)||0),
    ...Object.keys(produktyEdytowane||{}).map(id=>Number(id)||0),
    ...Object.keys(stanyProduktow||{}).map(id=>Number(id)||0),
    ...Object.keys(ustawienia.mapaProduktow||{}).map(id=>Number(id)||0)
  ].filter(id=>Number(id)>0&&Number(id)<PRODUCT_LINK_IMPORT_FIRST_ID);
  return Math.max(0,...liczby);
}
let produktyDodaneAudytId={source:null,length:-1,first:"",last:""};
function naprawKolizjeIdProduktow(){
  if(!produktyDodane.length){produktyDodaneAudytId={source:produktyDodane,length:0,first:"",last:""};return false;}
  const first=String(produktyDodane[0]?.id??""),last=String(produktyDodane.at(-1)?.id??"");
  if(produktyDodaneAudytId.source===produktyDodane&&produktyDodaneAudytId.length===produktyDodane.length&&produktyDodaneAudytId.first===first&&produktyDodaneAudytId.last===last)return false;
  const zajete=new Set();
  let nastepne=najwyzszeIdProduktu()+1, zmiana=false;
  const wezNoweId=()=>{while(zajete.has(nastepne))nastepne++;const id=nastepne;zajete.add(id);nastepne++;return id;};
  const poprawione=produktyDodane.map(p=>{
    const id=Number(p.id);
    if(!Number.isInteger(id)||id<=0||zajete.has(id)){
      const nowe=wezNoweId();
      zmiana=true;
      return {...p,id:nowe};
    }
    zajete.add(id);
    if(p.id!==id){ zmiana=true; return {...p,id}; }
    return p;
  });
  if(!zmiana){produktyDodaneAudytId={source:produktyDodane,length:produktyDodane.length,first,last};return false;}
  produktyDodane=poprawione;
  produktyDodaneAudytId={source:produktyDodane,length:produktyDodane.length,first:String(produktyDodane[0]?.id??""),last:String(produktyDodane.at(-1)?.id??"")};
  zapiszLS("artway_produkty_dodane",produktyDodane);
  loguj("ostrzezenie","Naprawiono wyłącznie nieprawidłowe lub powtórzone ID w produktach dodanych. ID usuniętego produktu bazowego może być ponownie użyte przez nowy produkt.");
  return true;
}
