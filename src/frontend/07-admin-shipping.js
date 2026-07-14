/* ═══════════ PANEL ADMINA (tylko administrator) ═══════════
   Podstrony: #/admin (pulpit), #/admin/zamowienia (zmiana statusów),
   #/admin/klienci, #/admin/produkty. Klienci ich nie widzą.        */
const STATUSY = ["nowe","potwierdzone","w realizacji","gotowe do wysyłki","nadane","wysłane","w doręczeniu","dostarczone","zakończone","zwrot","zwrot pieniędzy","anulowane"];
const KOLOR_STATUSU = {
  "nowe":"#dbeafe","potwierdzone":"#e0f2fe","w realizacji":"#fef3c7","gotowe do wysyłki":"#ffedd5",
  "nadane":"#e0e7ff","wysłane":"#e0e7ff","w doręczeniu":"#ede9fe","dostarczone":"#dcfce7",
  "zakończone":"#dcfce7","zwrot":"#fce7f3","zwrot pieniędzy":"#cffafe","anulowane":"#fee2e2"
};
const PRZEWOZNICY = {
  inpost:{nazwa:"InPost",uslugi:["Paczkomat 24/7","Kurier InPost"],url:n=>`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(n)}`},
  dpd:{nazwa:"DPD",uslugi:["DPD Classic","DPD Pickup","DPD pobranie"],url:n=>`https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(n)}`},
  dhl:{nazwa:"DHL",uslugi:["DHL Parcel","DHL POP","DHL Express"],url:n=>`https://www.dhl.com/pl-pl/home/tracking.html?tracking-id=${encodeURIComponent(n)}`},
  orlen:{nazwa:"ORLEN Paczka",uslugi:["Automat paczkowy","Punkt odbioru","Kurier"],url:()=>`https://www.orlenpaczka.pl/sledz-paczke/`},
  gls:{nazwa:"GLS",uslugi:["BusinessParcel","ParcelShop","Pobranie"],url:n=>`https://gls-group.com/PL/pl/sledzenie-paczek/?match=${encodeURIComponent(n)}`},
  ups:{nazwa:"UPS",uslugi:["UPS Standard","UPS Access Point","UPS Express"],url:n=>`https://www.ups.com/track?loc=pl_PL&tracknum=${encodeURIComponent(n)}`},
  pocztex:{nazwa:"Pocztex",uslugi:["Kurier","PUNKT","Automat"],url:()=>`https://emonitoring.poczta-polska.pl/`},
  inny:{nazwa:"Inny / własny",uslugi:["Przesyłka standardowa"],url:()=>""}
};
const PRZEWOZNICY_AKTYWNI = ["inpost"];
function przewoznicyAktywni(){
  return Object.fromEntries(PRZEWOZNICY_AKTYWNI.map(id=>[id,PRZEWOZNICY[id]]).filter(([,p])=>p));
}
const ETAPY_WYSYLKI = {
  do_obslugi:{nazwa:"Do obsługi",ikona:"📥",kolor:"#dbeafe"},
  przygotowanie:{nazwa:"Przygotowanie",ikona:"📦",kolor:"#fef3c7"},
  etykieta:{nazwa:"Etykieta gotowa",ikona:"🏷️",kolor:"#ffedd5"},
  przekazana:{nazwa:"Przekazana",ikona:"🤝",kolor:"#e0e7ff"},
  transport:{nazwa:"W transporcie",ikona:"🚚",kolor:"#ede9fe"},
  doreczenie:{nazwa:"W doręczeniu",ikona:"📍",kolor:"#fce7f3"},
  dostarczona:{nazwa:"Dostarczona",ikona:"✅",kolor:"#dcfce7"},
  problem:{nazwa:"Wymaga reakcji",ikona:"⚠️",kolor:"#fee2e2"},
  zwrot:{nazwa:"Zwrot",ikona:"↩️",kolor:"#fce7f3"},
  anulowana:{nazwa:"Anulowana",ikona:"⛔",kolor:"#e2e8f0"}
};
const MENU_ADMINA = [
  ["/admin","📊 Pulpit"], ["/admin/zamowienia","📦 Zamówienia"],
  ["/admin/allegro","🟠 Allegro"],
  ["/admin/wysylki","🚚 Centrum wysyłek"],
  ["/admin/magazyn","🏬 Magazyn"],
  ["/admin/infakt","🧾 inFakt i faktury"],
  ["/admin/agent-ai","🤖 Agent AI"],
  ["/admin/seo","📣 Pozycjonowanie"],
  ["/admin/asortyment","🏷️ Asortyment"],
  ["/admin/klienci","👥 Klienci"],
  ["/admin/personalizacja","🎨 Personalizacja i ustawienia"],
  ["/admin/eksport","⇄ Import / eksport"], ["/admin/aktualizacja","⬆️ Aktualizacja strony"],
  ["/admin/publikacja","🌍 Publikacja"], ["/diagnostyka","🛠️ Diagnostyka"]
];
function adminSzkielet(aktywna, tresc){
  const powiadomienia = {
    "/admin/zamowienia": pobierzZamowienia().filter(z=>z.status==="nowe").length,
    "/admin/allegro": (Array.isArray(allegroZamowienia) ? allegroZamowienia.filter(statusAllegroRezerwujeMagazyn).length : 0) + (allegroKomunikacjaStaty?.().totalNeed||0),
    "/admin/wysylki": pobierzZamowienia().filter(z=>!["anulowane","dostarczone","zakończone"].includes(z.status)&&!z.wysylka?.numer).length,
    "/admin/magazyn": potrzebyZatowarowania().length,
    "/admin/infakt": pobierzZamowienia().filter(z=>String(z.status||"")!=="anulowane"&&(z.klient?.nip||z.klient?.firma)&&!infaktStan.links?.[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length,
    "/admin/agent-ai": agentAIAnalizaAktywna(agentAIAnaliza()).length,
    "/admin/asortyment": opinie.filter(o=>o.status==="oczekuje").length,
    "/admin/seo": seoKolejkaProduktow().filter(x=>x.score<85).length
  };
  return `
  <div class="admin-page">
    <aside class="admin-nav">${MENU_ADMINA.map(([h,t])=>{
      const n = powiadomienia[h]||0;
      return `<a href="#${h}" class="${aktywna===h?'active':''}">${t}${n?` <span class="nav-badge">${n}</span>`:""}</a>`;
    }).join("")}</aside>
    <div class="admin-tresc">${tresc}</div>
  </div>`;
}
/* Wykres sprzedaży z ostatnich 7 dni (bez bibliotek — słupki CSS) */
function sprzedaz7dni(){
  const dni = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    dni.push({ start:d.getTime(), koniec:d.getTime()+86400000,
      etykieta:d.toLocaleDateString("pl-PL",{weekday:"short"}), suma:0, ile:0 });
  }
  for(const z of pobierzZamowienia()){
    if(z.status==="anulowane") continue;
    let ts = z.ts;
    if(!ts && z.data){ const m = String(z.data).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); if(m) ts = new Date(+m[3], +m[2]-1, +m[1]).getTime(); }
    if(!ts) continue;
    const dzien = dni.find(d=>ts>=d.start && ts<d.koniec);
    if(dzien){ dzien.suma += z.razem; dzien.ile++; }
  }
  return dni;
}
function wykresSprzedazyHTML(){
  const dni = sprzedaz7dni();
  const max = Math.max(1, ...dni.map(d=>d.suma));
  const razem = dni.reduce((s,d)=>s+d.suma,0);
  return `
  <div class="panel">
    <h2 style="margin-top:0">📈 Sprzedaż — ostatnie 7 dni <small style="font-size:.8rem;color:var(--muted2)">razem: ${zl(razem)}</small></h2>
    <div class="wykres">
      ${dni.map(d=>`
        <div class="wykres-kol" title="${d.etykieta}: ${zl(d.suma)} (${d.ile} zam.)">
          <span class="wykres-kwota">${d.suma?zl(d.suma).replace(",00",""):""}</span>
          <div class="wykres-slupek" style="height:${Math.max(4, Math.round(d.suma/max*110))}px;${d.suma?'':'background:var(--line)'}"></div>
          <span class="wykres-dzien">${d.etykieta}</span>
        </div>`).join("")}
    </div>
  </div>`;
}
/* Wydruk zamówienia (potwierdzenie dla klienta / do paczki) */
function drukujZamowienie(nr){
  const z = pobierzZamowienia().find(x=>x.nr===nr);
  if(!z){ toast("Nie znaleziono zamówienia"); return; }
  const obszar = $("obszarWydruku");
  obszar.innerHTML = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px">
        <div><h1 style="margin:0;font-size:22px">${esc(KONFIG.nazwaSklepu)}</h1>
        <small>${esc(KONFIG.emailSklepu)} • ${esc(KONFIG.telefon)}</small></div>
        <div style="text-align:right"><b>ZAMÓWIENIE ${esc(z.nr)}</b><br><small>${esc(z.data)}</small><br><small>Status: ${esc(z.status)}</small></div>
      </div>
      <p><b>Klient:</b> ${z.email?esc(z.email):"gość (bez konta)"}<br><b>Adres:</b> ${esc(z.adres||"—")}<br><b>Dostawa:</b> ${esc(z.dostawa||"—")} • <b>Płatność:</b> ${esc(z.platnosc||"—")}</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0">
        <tr style="border-bottom:1px solid #999"><th style="text-align:left;padding:6px 0">Pozycja</th></tr>
        ${z.pozycje.map(p=>`<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 0">${esc(p)}</td></tr>`).join("")}
      </table>
      <div class="summary" style="margin:12px 0">${podsumowanieKosztowHTML(z,"RAZEM")}</div>
      <p style="font-size:11px;color:#666">Dokument wygenerowany ${new Date().toLocaleString("pl-PL")}. Nie stanowi faktury VAT.</p>
    </div>`;
  document.body.classList.add("drukowanie");
  loguj("info","Wydrukowano zamówienie "+nr);
  window.print();
  setTimeout(()=>{ document.body.classList.remove("drukowanie"); obszar.innerHTML=""; }, 400);
}
/* Centrum wysyłek. Dane i etykieta robocza działają lokalnie.
   Oficjalne etykiety, webhooki i automatyczna poczta wymagają backendu. */
function nazwaPrzewoznika(id){ return PRZEWOZNICY[id]?.nazwa || (id?String(id):"nie wybrano"); }
function daneWysylki(z){
  return {
    przewoznik:"", usluga:"", numer:"", trackingUrl:"", status:"nieprzygotowana",
    etap:"", priorytet:"normalny", operator:"", terminNadania:"", przewidywaneDoreczenie:"",
    ostatniaSynchronizacja:"", bladIntegracji:"", waga:"", dlugosc:"", szerokosc:"", wysokosc:"",
    historia:[], powiadomienia:[], zadania:{dane:false,kompletacja:false,etykieta:false,przekazanie:false},
    ...(z?.wysylka||{})
  };
}
function etapWysylki(z){
  const w=daneWysylki(z);
  if(w.etap&&ETAPY_WYSYLKI[w.etap]) return w.etap;
  if(z.status==="anulowane") return "anulowana";
  if(z.status==="zwrot"||z.status==="zwrot pieniędzy") return "zwrot";
  if(z.status==="dostarczone"||z.status==="zakończone") return "dostarczona";
  if(z.status==="w doręczeniu") return "doreczenie";
  if(w.bladIntegracji) return "problem";
  if(z.status==="nadane"||z.status==="wysłane") return w.numer?"transport":"przygotowanie";
  if(w.numer) return "etykieta";
  if(z.status==="w realizacji"||z.status==="gotowe do wysyłki") return "przygotowanie";
  return "do_obslugi";
}
function nazwaEtapu(z){ const e=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi; return `${e.ikona} ${e.nazwa}`; }
function godzinyOd(ts){ return ts?Math.max(0,(Date.now()-Number(ts))/3600000):0; }
function slaWysylki(z){
  const uw=ustawieniaWysylki(), etap=etapWysylki(z);
  if(["dostarczona","anulowana","zwrot"].includes(etap)) return {klasa:"sla-ok",tekst:"zamknięte"};
  if(etap==="problem") return {klasa:"sla-bad",tekst:"wymaga reakcji"};
  const limit=Number(uw.slaNadanie||24), h=godzinyOd(z.ts);
  if(!daneWysylki(z).numer&&h>limit) return {klasa:"sla-bad",tekst:`SLA +${Math.round(h-limit)} h`};
  if(!daneWysylki(z).numer&&h>limit*.75) return {klasa:"sla-warn",tekst:`pozostało ${Math.max(0,Math.round(limit-h))} h`};
  return {klasa:"sla-ok",tekst:daneWysylki(z).numer?"monitorowana":`${Math.max(0,Math.round(limit-h))} h do nadania`};
}
function przewoznikDlaZamowienia(z){
  if(z?.wysylka?.przewoznik) return z.wysylka.przewoznik;
  return "inpost";
}
function czyZamowieniePaczkomat(z){
  return czyDostawaPaczkomat(z?.dostawaId) || !!(z?.paczkomat || z?.wysylka?.punktKod);
}
function uslugaInpostZamowienia(z){
  return uslugaInpostDlaDostawy(czyZamowieniePaczkomat(z) ? "paczkomat" : "kurier_inpost");
}
function normalizujEtapZdarzenia(status){
  const s=String(status||"").toLowerCase();
  if(s.includes("problem")||s.includes("nieud")||s.includes("opóź")) return "problem";
  if(s.includes("zwrot")) return "zwrot";
  if(s.includes("dostarcz")) return "dostarczona";
  if(s.includes("doręcz")) return "doreczenie";
  if(s.includes("drodze")||s.includes("sortown")||s.includes("transport")) return "transport";
  if(s.includes("przyję")||s.includes("przekazan")) return "przekazana";
  return "";
}
function urlSledzenia(z){
  const w=daneWysylki(z), wlasny=String(w.trackingUrl||"").trim();
  if(/^https?:\/\//i.test(wlasny)) return wlasny;
  if(!w.numer) return "";
  return PRZEWOZNICY[w.przewoznik]?.url?.(w.numer)||"";
}
function ustawieniaWysylki(){
  const u = {
    przewoznik:"inpost",waga:"1",dlugosc:"30",szerokosc:"20",wysokosc:"15",
    nadawca:"Artway-TM",ulica:"",kod:"",miasto:"",telefon:KONFIG.telefon,email:KONFIG.emailSklepu,
    regulaPaczkomat:"inpost",regulaKurier:"inpost",slaNadanie:"24",slaDoreczenie:"72",
    apiEndpoint:"api/index.php",tryb:"sandbox",autoStatus:true,autoEmail:true,autoTracking:true,
    alarmSla:true,powiadomieniaWyjatki:true,
    ...(ustawienia.wysylka||{})
  };
  return {...u, przewoznik:"inpost", regulaPaczkomat:"inpost", regulaKurier:"inpost"};
}
function aktualizujZamowienie(nr, zmiana){
  const lista=pobierzZamowienia(), z=lista.find(x=>x.nr===nr);
  if(!z) return null;
  zmiana(z);
  zapiszLS("artway_zamowienia",lista);
  void zapiszZamowienieCentralnie(z,false);
  return z;
}
function zapiszWysylke(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), teraz=new Date().toLocaleString("pl-PL");
  const przewoznik="inpost", numer=String(f.get("numer")||"").trim();
  const punktKod=String(f.get("punktKod")||"").trim().toUpperCase();
  const przed=pobierzZamowienia().find(x=>x.nr===nr), staryNumer=przed?daneWysylki(przed).numer:"";
  const z=aktualizujZamowienie(nr, zam=>{
    const stara=daneWysylki(zam);
    const paczkomat = czyZamowieniePaczkomat(zam);
    const usluga = String(f.get("usluga")||stara.usluga||uslugaInpostZamowienia(zam)).trim() || uslugaInpostZamowienia(zam);
    const zmieniono=stara.numer!==numer||stara.przewoznik!==przewoznik||stara.usluga!==usluga||stara.punktKod!==(paczkomat?punktKod:"");
    if(paczkomat && punktKod) zam.paczkomat=punktKod;
    if(!paczkomat){ zam.paczkomat=""; zam.paczkomatAdres=""; }
    zam.wysylka={...stara,
      przewoznik, usluga, numer, punktKod:paczkomat?(punktKod||stara.punktKod||zam.paczkomat||""):"",
      trackingUrl:String(f.get("trackingUrl")||"").trim(),
      priorytet:String(f.get("priorytet")||stara.priorytet||"normalny"),
      operator:String(f.get("operator")||"").trim(),
      terminNadania:String(f.get("terminNadania")||"").trim(),
      przewidywaneDoreczenie:String(f.get("przewidywaneDoreczenie")||"").trim(),
      waga:String(f.get("waga")||"").trim(), dlugosc:String(f.get("dlugosc")||"").trim(),
      szerokosc:String(f.get("szerokosc")||"").trim(), wysokosc:String(f.get("wysokosc")||"").trim(),
      status:numer?"nadana":"przygotowywana", etap:numer?(stara.etap&&stara.etap!=="do_obslugi"?stara.etap:"etykieta"):"przygotowanie",
      zaktualizowano:new Date().toISOString(),
      zadania:{...(stara.zadania||{}),dane:true,etykieta:!!numer},
      historia:zmieniono?[...(stara.historia||[]),{czas:teraz,status:numer?"Numer nadania zapisany":"Konfiguracja przesyłki",opis:`${nazwaPrzewoznika(przewoznik)}${numer?" • "+numer:""}`}]:stara.historia
    };
    if(numer&&["nowe","potwierdzone","w realizacji"].includes(zam.status)) zam.status="gotowe do wysyłki";
    else if(!numer&&["nowe","potwierdzone","w realizacji"].includes(zam.status)) zam.status="gotowe do wysyłki";
  });
  if(!z) return toast("Nie znaleziono zamówienia");
  loguj("info",`Zapisano przesyłkę ${nr}: ${nazwaPrzewoznika(przewoznik)}${numer?" "+numer:""}`);
  toast("Dane przesyłki zapisane ✅"); renderuj();
  // E-mail „nadanie" wysyła się automatycznie z serwera po zapisaniu numeru nadania (awaryjnie z panelu, gdy baza offline)
  if(numer&&numer!==staryNumer&&!chmuraToken) void obsluzAutomatycznyEmail(nr,z.status,"nadanie");
}
function uzupelnijUslugi(select){
  const form=select.form, uslugi=PRZEWOZNICY[select.value]?.uslugi||[];
  form.usluga.innerHTML=uslugi.map(x=>`<option>${esc(x)}</option>`).join("");
}
function dodajZdarzenieWysylki(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), status=String(f.get("status")||""), opis=String(f.get("opis")||"").trim();
  let statusZamowienia="", typEmaila="";
  aktualizujZamowienie(nr,z=>{
    const w=daneWysylki(z);
    w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status,opis}];
    w.status=status.toLowerCase(); w.etap=normalizujEtapZdarzenia(status)||w.etap;
    w.bladIntegracji=w.etap==="problem"?(opis||status):"";
    w.ostatniaSynchronizacja=new Date().toISOString(); w.zaktualizowano=new Date().toISOString(); z.wysylka=w;
    const mapa={"Przekazana do InPost":"nadane","Przyjęta przez InPost":"nadane","W sortowni":"nadane","W drodze":"nadane","W doręczeniu":"w doręczeniu","Dostarczona":"dostarczone","Zwrot do nadawcy":"zwrot"};
    if(mapa[status]){z.status=mapa[status];statusZamowienia=mapa[status];}
    if(w.etap==="problem") typEmaila="problem";
  });
  loguj("info",`Dodano zdarzenie przesyłki ${nr}: ${status}`);
  toast("Zdarzenie dodane"); renderuj();
  // E-mail (nadanie/dostarczenie/zwrot/problem) wysyła się automatycznie z serwera po zapisaniu zdarzenia; awaryjnie z panelu przy braku bazy
  if((statusZamowienia||typEmaila)&&!chmuraToken) void obsluzAutomatycznyEmail(nr,statusZamowienia,typEmaila);
}
function trescPowiadomienia(z,typ){
  const w=daneWysylki(z), klient=z.klient||{}, imie=klient.imie||"";
  const powitanie=`Dzień dobry${imie?", "+imie:""},`;
  const sledzenie=urlSledzenia(z);
  const pozycje=Array.isArray(z.pozycje)&&z.pozycje.length?`\n\nZamówione produkty:\n${z.pozycje.map(p=>`• ${p}`).join("\n")}`:"";
  const podsumowanie=`\n\n${podsumowanieKosztowTekst(z)}\nPłatność: ${z.platnosc||"—"}`;
  const stopka=`\n\nPozdrawiamy\n${KONFIG.nazwaSklepu}\n${KONFIG.emailSklepu}`;
  const warianty={
    potwierdzenie:{temat:`Potwierdzenie zamówienia ${z.nr}`,body:`${powitanie}\n\npotwierdzamy przyjęcie zamówienia ${z.nr}.${pozycje}${podsumowanie}`},
    przygotowanie:{temat:`Zamówienie ${z.nr} jest przygotowywane`,body:`${powitanie}\n\nTwoje zamówienie ${z.nr} jest obecnie przygotowywane do wysyłki.${podsumowanie}`},
    nadanie:{temat:`Zamówienie ${z.nr} zostało nadane`,body:`${powitanie}\n\nprzesyłka dla zamówienia ${z.nr} została nadana przez ${nazwaPrzewoznika(w.przewoznik)}.${w.numer?`\nNumer przesyłki: ${w.numer}`:""}${sledzenie?`\nŚledzenie: ${sledzenie}`:""}`},
    dostarczenie:{temat:`Zamówienie ${z.nr} zostało dostarczone`,body:`${powitanie}\n\nprzesyłka dla zamówienia ${z.nr} została oznaczona jako dostarczona. Dziękujemy za zakupy.`},
    anulowanie:{temat:`Aktualizacja zamówienia ${z.nr}`,body:`${powitanie}\n\nzamówienie ${z.nr} zostało anulowane. W razie pytań odpowiedz na tę wiadomość.`},
    zwrot:{temat:`Zwrot przesyłki dla zamówienia ${z.nr}`,body:`${powitanie}\n\nprzesyłka dla zamówienia ${z.nr} została oznaczona jako zwrot do nadawcy. Skontaktujemy się w sprawie dalszych kroków.`},
    zwrot_pieniedzy:{temat:`Zwrot pieniędzy za zamówienie ${z.nr}`,body:`${powitanie}\n\nzwróciliśmy pieniądze za zamówienie ${z.nr}.\nKwota zwrotu: ${zl(z.razem)}\nŚrodki wrócą na Twoje konto w ciągu kilku dni roboczych, zależnie od banku.`},
    problem:{temat:`Ważna informacja o przesyłce ${z.nr}`,body:`${powitanie}\n\nprzewoźnik zgłosił problem dotyczący przesyłki dla zamówienia ${z.nr}. Monitorujemy sytuację i przekażemy kolejną informację po jej wyjaśnieniu.${w.numer?`\nNumer przesyłki: ${w.numer}`:""}${sledzenie?`\nŚledzenie: ${sledzenie}`:""}`}
  };
  const p=warianty[typ]||warianty.potwierdzenie;
  const body=p.body+stopka;
  return {temat:p.temat,body,html:htmlPowiadomieniaKlienta(z,typ,p.temat,body)};
}
function produktyEmailHtmlKlient(z){
  const dane=Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
    ? z.pozycjeDane.map(p=>({nazwa:p.nazwa||"Produkt",ilosc:Number(p.ilosc)||1,wartosc:Number(p.wartosc)||((Number(p.cena)||0)*(Number(p.ilosc)||1)),sku:p.sku||""}))
    : (Array.isArray(z.pozycje)?z.pozycje.map(p=>({nazwa:p,ilosc:1,wartosc:0,sku:""})):[]);
  if(!dane.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff">
    <thead><tr style="background:#f8fafc;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">
      <th align="left" style="padding:10px">Produkt</th><th align="center" style="padding:10px;width:70px">Ilość</th><th align="right" style="padding:10px;width:120px">Wartość</th>
    </tr></thead>
    <tbody>${dane.map(p=>`<tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb"><b>${esc(p.nazwa)}</b>${p.sku?`<br><span style="font-size:12px;color:#6b7280">SKU: ${esc(p.sku)}</span>`:""}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${p.ilosc}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800">${p.wartosc?zl(p.wartosc):"—"}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}
function htmlPowiadomieniaKlienta(z,typ,temat,body){
  const w=daneWysylki(z), klient=z.klient||{}, imie=klient.imie||"";
  const sledzenie=urlSledzenia(z);
  const statusy={
    potwierdzenie:["Dziękujemy za zakupy","Przyjęliśmy zamówienie i mamy wszystkie najważniejsze dane. Będziemy informować o kolejnych etapach realizacji.","#2563eb"],
    przygotowanie:["Zamówienie jest przygotowywane","Kompletujemy produkty i przygotowujemy paczkę do wysyłki.","#7c3aed"],
    nadanie:["Paczka została nadana","Przesyłka jest już w InPost. Możesz śledzić jej drogę do Ciebie.","#059669"],
    dostarczenie:["Dziękujemy — przesyłka dostarczona","Mamy nadzieję, że zakupy sprawią dużo satysfakcji. Zapraszamy ponownie do Artway-TM.","#16a34a"],
    anulowanie:["Aktualizacja zamówienia","Zamówienie zostało anulowane. Jeśli to pomyłka lub masz pytania, odpowiedz na tę wiadomość.","#dc2626"],
    zwrot:["Informacja o zwrocie","Przesyłka została oznaczona jako zwrot. Skontaktujemy się w sprawie dalszych kroków.","#ea580c"],
    zwrot_pieniedzy:["Zwróciliśmy Ci pieniądze","Zwrot środków został zainicjowany. Pieniądze wrócą na Twoje konto w ciągu kilku dni roboczych.","#0ea5e9"],
    problem:["Ważna informacja o przesyłce","Przewoźnik zgłosił problem. Monitorujemy sytuację i przekażemy kolejną informację po wyjaśnieniu.","#dc2626"]
  };
  const [naglowek,opis,kolor]=statusy[typ]||statusy.potwierdzenie;
  const sklepUrl=location.origin+"/#/";
  const zamUrl=location.origin+"/#/zamowienia";
  const karta=(tytul,tresc,accent="#2563eb")=>`<div style="border:1px solid #e5e7eb;border-left:5px solid ${accent};border-radius:16px;background:#ffffff;padding:16px;margin:14px 0">
    <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:6px">${esc(tytul)}</div>
    <div style="color:#111827;font-size:15px;line-height:1.6">${tresc}</div>
  </div>`;
  const przycisk=(label,url,bg="#2563eb")=>`<a href="${esc(url)}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 20px;margin:4px 8px 4px 0">${esc(label)}</a>`;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(temat)}</title></head>
  <body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opis)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:26px 10px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(37,99,235,.14)">
        <tr><td style="background:linear-gradient(135deg,#2563eb,#6d28d9);padding:28px;color:#fff">
          <div style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">Artway-TM</div>
          <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.18">${esc(naglowek)}</h1>
          <p style="margin:0;font-size:16px;line-height:1.55;opacity:.96">Dzień dobry${imie?", "+esc(imie):""}. ${esc(opis)}</p>
        </td></tr>
        <tr><td style="padding:26px 28px">
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:18px;padding:14px 16px;margin-bottom:16px;color:#78350f">
            <b>Zamówienie:</b> ${esc(z.nr)} &nbsp; • &nbsp; <b>Kwota:</b> ${zl(z.razem)}
          </div>
          ${karta("Status", esc(body).replace(/\n/g,"<br>"), kolor)}
          ${karta("Podsumowanie kosztów", podsumowanieKosztowTekst(z).split("\n").map(esc).join("<br>"), "#f59e0b")}
          ${w.numer||sledzenie?karta("Śledzenie", `${w.numer?`Numer przesyłki: <b>${esc(w.numer)}</b><br>`:""}${sledzenie?`Link śledzenia: <a href="${esc(sledzenie)}" style="color:#2563eb;font-weight:800">${esc(sledzenie)}</a>`:""}`,"#059669"):""}
          ${produktyEmailHtmlKlient(z)?`<h2 style="font-size:18px;margin:22px 0 10px;color:#111827">Produkty</h2>${produktyEmailHtmlKlient(z)}`:""}
          <div style="margin:22px 0 8px">${przycisk("Moje zamówienia",zamUrl)}${przycisk("Wróć do sklepu",sklepUrl,"#111827")}</div>
          <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:18px 0 0">Dziękujemy za zaufanie. Zapraszamy ponownie — w sklepie czekają kolejne produkty i okazje.</p>
        </td></tr>
        <tr><td style="background:#111827;color:#d1d5db;padding:20px 28px;font-size:13px;line-height:1.55"><b style="color:#fff">${esc(KONFIG.nazwaSklepu)}</b><br>${esc(KONFIG.emailSklepu)}<br>Wiadomość wysłana automatycznie.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}
const NAZWY_EMAILI={potwierdzenie:"Potwierdzenie",przygotowanie:"Przygotowanie",nadanie:"Nadanie",dostarczenie:"Dostarczenie",anulowanie:"Anulowanie",zwrot:"Zwrot",zwrot_pieniedzy:"Zwrot pieniędzy",problem:"Problem z przesyłką"};
function zapiszHistorieEmaila(nr,wpis){
  aktualizujZamowienie(nr,zam=>{
    const w=daneWysylki(zam);
    w.powiadomienia=[...(w.powiadomienia||[]),{czas:new Date().toLocaleString("pl-PL"),...wpis}];
    zam.wysylka=w;
  });
}
function otworzEmailWysylki(nr,typ){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.email){ toast("Brak adresu e-mail klienta"); return; }
  const p=trescPowiadomienia(z,typ);
  zapiszHistorieEmaila(nr,{typ,status:"otwarto szkic"});
  loguj("info",`Otwarto szkic e-maila ${typ} dla ${nr}`);
  location.href=`mailto:${z.email}?subject=${encodeURIComponent(p.temat)}&body=${encodeURIComponent(p.body)}`;
}
async function wyslijEmailWysylki(nr,typ,automatycznie=false){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.email){toast("Brak adresu e-mail klienta");return false;}
  if(!stanBramki.email?.configured){
    if(!automatycznie) toast("Najpierw skonfiguruj SMTP/Gmail w zmiennych Netlify");
    return false;
  }
  if(!chmuraToken){
    if(!automatycznie) chmuraUstawToken();
    return false;
  }
  if(!automatycznie&&!confirm(`Wysłać „${NAZWY_EMAILI[typ]||typ}” na ${z.email} przez API?`)) return false;
  try{
    // Ten sam, jednolity szablon co potwierdzenie zakupu — budowany po stronie serwera
    const d=await chmura("send-status-email",{method:"POST",body:{nr,typ},timeout:18000});
    if(Array.isArray(d.powiadomienia)){ aktualizujZamowienie(nr,zam=>{ zam.wysylka=zam.wysylka||{}; zam.wysylka.powiadomienia=d.powiadomienia; }); }
    else { zapiszHistorieEmaila(nr,{typ,status:"wysłano",provider:d.provider||stanBramki.email.provider||"",id:d.message_id||"",automatyczne:automatycznie}); }
    loguj("info",`${automatycznie?"Automatycznie wysłano":"Wysłano"} e-mail ${typ} dla ${nr} przez ${d.provider||"API"}`);
    toast(`${automatycznie?"Automatyczny e-mail":"E-mail"} wysłany ✅`);
    renderuj();
    return true;
  }catch(bl){
    zapiszHistorieEmaila(nr,{typ,status:"błąd wysyłki",blad:bl.message,automatyczne:automatycznie});
    loguj("error",`Błąd e-maila ${typ} dla ${nr}: ${bl.message}`);
    toast("Nie wysłano e-maila: "+bl.message);
    renderuj();
    return false;
  }
}
function typEmailaDlaStatusu(status){
  return {
    "potwierdzone":"potwierdzenie","w realizacji":"przygotowanie","gotowe do wysyłki":"przygotowanie",
    "nadane":"nadanie","wysłane":"nadanie","dostarczone":"dostarczenie","zakończone":"dostarczenie",
    "zwrot":"zwrot","zwrot pieniędzy":"zwrot_pieniedzy","anulowane":"anulowanie"
  }[status]||"";
}
async function obsluzAutomatycznyEmail(nr,status,typWymuszony=""){
  if(!ustawieniaWysylki().autoEmail) return;
  const typ=typWymuszony||typEmailaDlaStatusu(status);
  if(!typ) return;
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.email) return;
  const historia=daneWysylki(z).powiadomienia||[];
  if(historia.some(p=>p.typ===typ&&p.status==="wysłano")) return;
  if(!stanBramki.email?.configured||!chmuraToken){
    const istnieje=historia.some(p=>p.typ===typ&&String(p.status).startsWith("oczekuje"));
    if(!istnieje) zapiszHistorieEmaila(nr,{typ,status:"oczekuje — skonfiguruj SMTP / połącz bazę",automatyczne:true});
    renderuj();
    return;
  }
  await wyslijEmailWysylki(nr,typ,true);
}
async function wyslijTestEmail(e){
  e.preventDefault();
  const email=String(new FormData(e.target).get("email")||"").trim();
  if(!stanBramki.email?.configured) return toast("Skonfiguruj SMTP/Gmail w Netlify");
  if(!chmuraToken){ chmuraUstawToken(); return; }
  if(!confirm(`Wysłać testową wiadomość na ${email}?`)) return;
  try{
    const html=`<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test e-mail Artway-TM</title></head>
      <body style="margin:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#111827">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:26px 10px"><tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(37,99,235,.14)">
          <tr><td style="background:linear-gradient(135deg,#2563eb,#6d28d9);padding:28px;color:#fff">
            <div style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">${esc(KONFIG.nazwaSklepu)}</div>
            <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.18">Test automatycznych wiadomości działa</h1>
            <p style="margin:0;font-size:16px;line-height:1.55;opacity:.96">Tak będą wyglądać eleganckie wiadomości wysyłane klientom po zakupie i podczas obsługi zamówienia.</p>
          </td></tr>
          <tr><td style="padding:26px 28px">
            <div style="border:1px solid #e5e7eb;border-left:5px solid #10b981;border-radius:16px;background:#fff;padding:16px;margin:14px 0">
              <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:6px">Status</div>
              <div style="font-size:15px;line-height:1.6">Konfiguracja Gmail SMTP i Netlify działa poprawnie. Wiadomości są teraz czytelne, estetyczne i zachęcają klienta do dalszych zakupów.</div>
            </div>
            <a href="${location.origin}/#/" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 20px;margin-top:10px">Wróć do sklepu</a>
            <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:18px 0 0">To jest test z panelu administracyjnego ${esc(KONFIG.nazwaSklepu)}.</p>
          </td></tr>
          <tr><td style="background:#111827;color:#d1d5db;padding:20px 28px;font-size:13px;line-height:1.55"><b style="color:#fff">${esc(KONFIG.nazwaSklepu)}</b><br>${esc(KONFIG.emailSklepu)}</td></tr>
        </table>
      </td></tr></table></body></html>`;
    const d=await chmura("send-email",{method:"POST",body:{to:email,subject:`Test automatycznych e-maili — ${KONFIG.nazwaSklepu}`,text:`To jest test poprawnej konfiguracji automatycznych wiadomości API sklepu ${KONFIG.nazwaSklepu}. Wiadomości mają teraz elegancki wygląd HTML.`,html},timeout:18000});
    loguj("info",`Wysłano test e-mail przez ${d.provider||"API"}`);
    toast("Testowy e-mail wysłany ✅");
  }catch(bl){loguj("error","Test e-mail: "+bl.message);toast("Test e-mail nieudany: "+bl.message);}
}
function drukujEtykieteRobocza(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z) return toast("Nie znaleziono zamówienia");
  const w=daneWysylki(z), k=z.klient||{}, adres=z.adresDostawy||{};
  const adresPelny=adres.ulica?`${adres.ulica} ${adres.nrDomu||""}${adres.nrLokalu?"/"+adres.nrLokalu:""}, ${adres.kod||""} ${adres.miasto||""}`:(z.adres||"—");
  const obszar=$("obszarWydruku");
  obszar.innerHTML=`
    <div style="font-family:Arial,sans-serif;width:100mm;min-height:145mm;margin:0 auto;padding:8mm;border:2px solid #111;color:#111;box-sizing:border-box">
      <div style="font-size:10px;font-weight:800;border:2px solid #111;padding:4px;text-align:center">ETYKIETA ROBOCZA — NIE ZASTĘPUJE OFICJALNEJ ETYKIETY PRZEWOŹNIKA</div>
      <div style="display:flex;justify-content:space-between;margin:10px 0;border-bottom:1px solid #111;padding-bottom:8px">
        <b>${esc(nazwaPrzewoznika(w.przewoznik))}</b><b>${esc(z.nr)}</b>
      </div>
      <small>ODBIORCA</small>
      <div style="font-size:19px;font-weight:800;margin:5px 0">${esc([k.imie,k.nazwisko].filter(Boolean).join(" ")||z.email||"Klient")}</div>
      <div style="font-size:16px;line-height:1.45">${esc(adresPelny)}</div>
      ${k.telefon?`<div style="margin-top:5px">Tel. ${esc(k.telefon)}</div>`:""}
      ${z.paczkomat?`<div style="font-size:20px;font-weight:800;margin-top:12px;border:2px solid #111;padding:6px">PUNKT: ${esc(z.paczkomat)}</div>`:""}
      <div style="margin-top:16px;border-top:1px solid #111;padding-top:8px"><small>NUMER PRZESYŁKI</small>
        <div style="font-size:22px;letter-spacing:1px;font-weight:800;word-break:break-all">${esc(w.numer||"BRAK — UZUPEŁNIJ W PANELU")}</div>
      </div>
      <div style="margin-top:14px;font-size:12px">Usługa: ${esc(w.usluga||"—")}<br>Paczka: ${esc(w.waga||"—")} kg • ${esc(w.dlugosc||"—")} × ${esc(w.szerokosc||"—")} × ${esc(w.wysokosc||"—")} cm</div>
      <div style="margin-top:15px;font-size:11px;color:#555">Nadawca: ${esc(ustawieniaWysylki().nadawca)} • ${esc(ustawieniaWysylki().email)}</div>
    </div>`;
  document.body.classList.add("drukowanie");
  loguj("info","Wydrukowano etykietę roboczą "+nr);
  window.print();
  setTimeout(()=>{document.body.classList.remove("drukowanie");obszar.innerHTML="";},400);
}
function zapiszUstawieniaWysylki(e){
  e.preventDefault();
  const f=new FormData(e.target), obj={};
  for(const [k,v] of f.entries()) obj[k]=String(v).trim();
  for(const k of String(e.target.dataset.flagi||"").split(",").filter(Boolean)) obj[k]=f.has(k);
  obj.przewoznik="inpost";
  obj.regulaPaczkomat="inpost";
  obj.regulaKurier="inpost";
  zapiszCzescUstawien({wysylka:{...ustawieniaWysylki(),...obj}});
}
let stanBramki={sprawdzono:false,online:false,configured:false,ready:false,authenticated:false,error:"",organizations:[],email:{configured:false,provider:null},store:{configured:false,writable:false,orders:0,users:0},inpost:{configured:false,geowidgetConfigured:false,env:"production"}};
function urlBramki(action,parametry={}){
  const baza=String(ustawieniaWysylki().apiEndpoint||"api/index.php").trim();
  const url=new URL(baza,location.href);
  if(url.origin!==location.origin) throw new Error("Bramka musi działać w tej samej domenie co sklep.");
  url.searchParams.set("action",action);
  for(const [k,v] of Object.entries(parametry)) if(v!==undefined&&v!==null&&v!=="") url.searchParams.set(k,String(v));
  return url.toString();
}
async function wywolajBramke(action,{method="GET",body=null,parametry={}}={}){
  const opcje={method,credentials:"same-origin",headers:{"Accept":"application/json"}};
  if(body!==null){opcje.headers["Content-Type"]="application/json";opcje.body=JSON.stringify(body);}
  const r=await fetch(urlBramki(action,parametry),opcje);
  const tekst=await r.text(); let dane;
  try{dane=JSON.parse(tekst);}catch(e){throw new Error(r.ok?"Serwer nie uruchomił PHP dla katalogu api.":"Bramka zwróciła nieprawidłową odpowiedź.");}
  if(!r.ok||dane.ok===false){const blad=new Error(dane.error||`Błąd bramki HTTP ${r.status}`);blad.code=dane.code||"";blad.status=r.status;throw blad;}
  return dane;
}
function polaczUzytkownikowCentralnych(serwerowi){
  const lokalni=pobierzUzytkownikow(), mapa=new Map(lokalni.map(u=>[u.email,u]));
  const wynik=(serwerowi||[]).map(u=>({...mapa.get(u.email),...u}));
  for(const u of lokalni) if(!wynik.some(x=>x.email===u.email)) wynik.push(u);
  return wynik;
}
async function synchronizujBazeCentralna(cicho=false){
  if(stanBazyCentralnej.synchronizacja) return false;
  if(!chmuraToken){ if(!cicho) chmuraUstawToken(); return false; }
  stanBazyCentralnej={...stanBazyCentralnej,synchronizacja:true};
  try{
    const d=await chmura("store-sync",{method:"POST",body:{orders:pobierzZamowienia(),users:pobierzUzytkownikow(),deleted_orders:zamowieniaUsuniete}});
    if(Array.isArray(d.deleted_orders)) scalUsunieteZamowienia(d.deleted_orders);
    zapiszLS("artway_zamowienia",Array.isArray(d.orders)?filtrujAktywneZamowienia(d.orders):[]);
    zapiszLS("artway_uzytkownicy",polaczUzytkownikowCentralnych(d.users));
    stanBazyCentralnej={sprawdzono:true,online:true,synchronizacja:false,orders:d.orders?.length||0,users:d.users?.length||0,updatedAt:d.updated_at||null,error:""};
    chmuraStan={...chmuraStan,dostepna:true,admin:true,updated_at:d.updated_at||chmuraStan.updated_at};
    if(!cicho) toast(`Wspólna baza zsynchronizowana ✅ (${stanBazyCentralnej.orders} zamówień)`);
    if(!cicho) renderuj();
    return true;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,synchronizacja:false,error:bl.message};
    if(bl.code==="auth"){ chmuraStan={...chmuraStan,admin:false}; if(!cicho) toast("Hasło bazy nieprawidłowe — wpisz je ponownie"); }
    else if(!cicho) toast("Błąd wspólnej bazy: "+bl.message);
    return false;
  }
}
async function pobierzMojeZamowieniaCentralne(cicho=false){
  if(!sesja||jestAdmin()) return false;
  try{
    const d=await chmura("store-orders-mine",{params:{email:sesja.email}});
    const pozostale=pobierzZamowienia().filter(z=>z.email!==sesja.email);
    zapiszLS("artway_zamowienia",[...filtrujAktywneZamowienia(d.orders||[]),...pozostale]);
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    if(!cicho){toast("Pobrano zamówienia ze wspólnej bazy ✅");renderuj();}
    return true;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
    return false;
  }
}
async function zapiszZamowienieCentralnie(z,publiczne=false){
  if(czyZamowienieUsuniete(z?.nr)) return false;
  try{
    const action=publiczne?"store-order-create":"store-order-save";
    if(!publiczne&&!chmuraToken) return false;
    const d=await chmura(action,{method:"POST",body:{order:z}});
    if(d?.deleted){ oznaczZamowienieUsuniete(z.nr,{by:"server"}); zapiszLS("artway_zamowienia",pobierzZamowienia()); return false; }
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    chmuraStan={...chmuraStan,dostepna:true};
    // serwer wysyła automatyczne e-maile statusowe — wczytaj świeżą historię powiadomień
    if(!publiczne && d && Array.isArray(d.powiadomienia)){
      const lista=pobierzZamowienia(), lokalny=lista.find(x=>x.nr===z.nr);
      if(lokalny){ lokalny.wysylka=lokalny.wysylka||{}; lokalny.wysylka.powiadomienia=d.powiadomienia; zapiszLS("artway_zamowienia",lista); if(typeof renderuj==="function") renderuj(); }
    }
    return d;
  }catch(bl){
    stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
    loguj("blad",`Wspólna baza — zamówienie ${z?.nr||""}: ${bl.message}`);
    return false;
  }
}
async function zapiszUzytkownikaCentralnie(u){
  try{
    const action=chmuraToken?"store-user-save":"account-profile-save";
    await chmura(action,{method:"POST",body:{user:u}});
    return true;
  }catch(bl){ return false; }
}
async function odtworzSesjeCentralna(){
  try{
    if(chmuraToken){ await synchronizujBazeCentralna(true); }
    else if(sesja && !jestAdmin()){ await pobierzMojeZamowieniaCentralne(true); }
  }catch(e){}
}
function odswiezPoCichejSynchronizacji(){
  if(typeof document!=="undefined" && document.hidden) return;
  const aktywny=document.activeElement, tag=aktywneTag => aktywneTag && ["INPUT","TEXTAREA","SELECT"].includes(aktywneTag.tagName);
  if(tag(aktywny)) return;
  const t=trasa();
  const odswiezane=["/admin","/admin/pulpit","/admin/zamowienia","/admin/wysylki","/admin/agent-ai","/admin/magazyn","/admin/allegro","/zamowienia"];
  if(!odswiezane.some(x=>t===x || (["/admin/pulpit","/admin/agent-ai","/admin/magazyn","/admin/allegro"].includes(x)&&t.startsWith(x+"/")) || (x==="/admin/wysylki"&&t.startsWith("/admin/zamowienie/")))) return;
  const y=window.scrollY||0;
  renderuj();
  setTimeout(()=>window.scrollTo({top:y}),0);
}
async function automatycznaSynchronizacjaChmury(powod="timer"){
  if(chmuraAutoSyncBusy) return false;
  if(typeof document!=="undefined" && document.hidden && powod==="timer") return false;
  chmuraAutoSyncBusy=true;
  try{
    let ok=false;
    if(chmuraToken){
      ok = await synchronizujBazeCentralna(true);
      await chmuraWczytajStan();
    }else{
      ok = await chmuraWczytajStan();
      if(sesja && !jestAdmin()) ok = (await pobierzMojeZamowieniaCentralne(true)) || ok;
    }
    const allegroOk=typeof allegroOdswiezDaneZSerweraJesliCzas==="function"?await allegroOdswiezDaneZSerweraJesliCzas(powod):false;
    if(ok){
      zastosujUstawienia(); zbudujProdukty();
      if(chmuraToken)agentAIUtworzZleceniaWedlugDostawcow("",{silent:true,automatic:true});
      odswiezMenu(); odswiezKoszyk();
      odswiezPoCichejSynchronizacji();
    }else if(allegroOk){
      odswiezMenu();odswiezPoCichejSynchronizacji();
    }
    return ok||allegroOk;
  }catch(e){ return false; }
  finally{ chmuraAutoSyncBusy=false; }
}
function uruchomAutoSynchronizacjeChmury(){
  if(chmuraTimerAutoSync) clearInterval(chmuraTimerAutoSync);
  chmuraTimerAutoSync=setInterval(()=>automatycznaSynchronizacjaChmury("timer"),CHMURA_AUTO_SYNC_MS);
  window.addEventListener("focus",()=>automatycznaSynchronizacjaChmury("focus"));
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) automatycznaSynchronizacjaChmury("visible"); });
}
async function sprawdzBramke(cicho=false){
  try{
    const cloud=await chmura("health",{timeout:9000});
    stanBramki={...stanBramki,sprawdzono:true,online:true,email:cloud.email||stanBramki.email,store:cloud.store||stanBramki.store,inpost:cloud.inpost||stanBramki.inpost,error:""};
    if(cloud.inpost) INPOST_PUBLIC=cloud.inpost;
    if(cloud.store) stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,orders:cloud.store.orders||0,users:cloud.store.users||0,updatedAt:cloud.store.settings_updated_at||cloud.store.updated_at||null,error:""};
    if(!cicho){
      const ip=cloud.inpost||{};
      const czesci=[];
      czesci.push("Netlify Functions działa ✅");
      czesci.push(cloud.email?.configured?`SMTP ${cloud.email.provider||""} gotowy`:"SMTP do konfiguracji");
      czesci.push(ip.configured?`InPost ShipX gotowy (${ip.env||"production"})`:`InPost: brakuje ${(ip.missingEnv&&ip.missingEnv.length?ip.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")}`);
      if(!ip.geowidgetConfigured) czesci.push("mapa paczkomatów: brak INPOST_GEOWIDGET_TOKEN");
      toast(czesci.join(" • "));
    }
    if(trasa()==="/admin/wysylki"||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy"||trasa().startsWith("/admin/agent-ai")) renderuj();
    return;
  }catch(e){ /* Netlify może być chwilowo niedostępne — niżej próbujemy awaryjny backend PHP */ }
  try{
    const d=await wywolajBramke("health");
    stanBramki={...stanBramki,...d,email:d.email||stanBramki.email,store:d.store||stanBramki.store,sprawdzono:true,online:true,error:""};
    if(!cicho) toast(d.ready?"Awaryjna bramka PHP gotowa ✅":d.configured?"Awaryjna bramka PHP skonfigurowana":"Bramka InPost wymaga konfiguracji");
  }catch(e){
    stanBramki={...stanBramki,sprawdzono:true,online:false,error:e.message};
    if(!cicho) toast("Bramka niedostępna — sprawdź Netlify Functions");
  }
  if(trasa()==="/admin/wysylki"||trasa().startsWith("/admin/zamowienie/")||trasa()==="/admin/dostawy"||trasa().startsWith("/admin/agent-ai")) renderuj();
}
async function polaczBramke(e){
  e.preventDefault();
  const f=new FormData(e.target), haslo=String(f.get("apiPassword")||"");
  try{
    await wywolajBramke("login",{method:"POST",body:{password:haslo}});
    e.target.reset(); await sprawdzBramke(true);
    await synchronizujBazeCentralna(true);
    toast("Sesja integracji połączona ✅");
  }catch(bl){stanBramki={...stanBramki,error:bl.message};toast("Nie udało się połączyć: "+bl.message);renderuj();}
}
async function rozlaczBramke(){
  try{await wywolajBramke("logout",{method:"POST",body:{}});}catch(e){}
  stanBramki={sprawdzono:true,online:true,configured:stanBramki.configured,ready:stanBramki.ready,authenticated:false,error:"",organizations:[],email:stanBramki.email||{configured:false,provider:null}};
  toast("Rozłączono sesję integracji");renderuj();
}
async function testujInPost(){
  try{
    const cfg=await pobierzInpostConfig(true);
    stanBramki={...stanBramki,inpost:cfg||stanBramki.inpost};
    if(!chmuraToken){ toast("Wpisz hasło bazy administratora, aby wykonać realny test tokenu InPost"); chmuraUstawToken(); return; }
    const d=await chmura("inpost-test",{timeout:15000});
    const ip=d.inpost||cfg||{};
    stanBramki={...stanBramki,inpost:ip,error:""};
    const org=ip.organization?.id?` • organizacja ${ip.organization.id}`:"";
    const uslugi=ip.organization?.services?.length?` • usługi: ${ip.organization.services.slice(0,3).join(", ")}`:"";
    const av=ip.serviceAvailability||{};
    const uwagaPaczkomat=av.locker===false?` • paczkomat ${av.lockerService||"inpost_locker_standard"} wymaga włączenia`:"";
    const uwagaKurier=av.courier===false?` • kurier ${av.courierService||"inpost_courier_standard"} wymaga włączenia`:"";
    toast(`InPost ShipX połączony ✅ (${ip.env||"production"})${org}${ip.geowidgetConfigured?" • mapa aktywna":" • brak tokenu Geowidget"}${uslugi}${uwagaPaczkomat}${uwagaKurier}`);
    renderuj();
  }catch(bl){
    const ip=bl.inpost||stanBramki.inpost||{};
    stanBramki={...stanBramki,inpost:ip,error:bl.message};
    if(bl.code==="inpost_not_configured") toast("InPost niegotowy — brakuje: "+((bl.missingEnv&&bl.missingEnv.length?bl.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", ")));
    else toast("Test InPost: "+bl.message);
    renderuj();
  }
}
function b64toBlob(b64,typ="application/pdf"){
  const bin=atob(String(b64||"")); const len=bin.length; const arr=new Uint8Array(len);
  for(let i=0;i<len;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:typ});
}
async function zapiszFormularzWysylkiPrzedAPI(nr){
  const form=[...document.forms].find(f=>(String(f.getAttribute("onsubmit")||"").includes(nr) && (f.querySelector('[name="usluga"]')||f.querySelector('[name="dostawaTyp"]')) && f.querySelector('[name="waga"]')));
  if(!form) return null;
  const f=new FormData(form);
  const zapisane=aktualizujZamowienie(nr,zam=>{
    const stareRazem=kwotaNum(zam.razem);
    const w=daneWysylki(zam);
    const typ=String(f.get("dostawaTyp")||zam.dostawaId||"").trim();
    const paczkomat=typ ? typ!=="kurier_inpost" : czyZamowieniePaczkomat(zam);
    const punktKod=String(f.get("punktKod")||f.get("paczkomat")||"").trim().toUpperCase();
    if(typ==="paczkomat"||typ==="kurier_inpost"){ zam.dostawaId=typ; zam.dostawa=typ==="paczkomat"?"Paczkomat InPost 24/7":"Kurier InPost"; }
    if(paczkomat&&punktKod) zam.paczkomat=punktKod;
    if(!paczkomat){ zam.paczkomat=""; zam.paczkomatAdres=""; }
    const uslugaZTypu=typ==="kurier_inpost"?"Kurier InPost":uslugaInpostZamowienia(zam);
    const pobranieAktywneForm=f.has("pobranieAktywne")
      ? String(f.get("pobranieAktywne")||"").trim()==="tak"
      : pobranieAktywneZamowienia(zam,w);
    const pobranieForm=pobranieAktywneForm ? String(f.get("pobranie")||w.pobranie||kwotaNum(zam.razem).toFixed(2)).trim() : "";
    const paczkaWeekendForm=f.has("paczkaWeekend") ? String(f.get("paczkaWeekend")||"").trim()==="tak" : !!(w.paczkaWeekend||zam.paczkaWeekend);
    const sposobNadania=String(f.get("sposobNadania")||w.sposobNadania||INPOST_DOMYSLNY_SP_NADANIA).trim();
    const punktNadania=String(f.get("punktNadania")||w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
    zam.wysylka={...w,
      przewoznik:"inpost",
      usluga:String(f.get("usluga")||w.usluga||uslugaZTypu).trim()||uslugaZTypu,
      punktKod:paczkomat?(punktKod||w.punktKod||zam.paczkomat||""):"",
      numer:String(f.get("numer")||w.numer||"").trim(),
      trackingUrl:String(f.get("trackingUrl")||w.trackingUrl||"").trim(),
      priorytet:String(f.get("priorytet")||w.priorytet||"normalny"),
      operator:String(f.get("operator")||w.operator||"").trim(),
      terminNadania:String(f.get("terminNadania")||w.terminNadania||"").trim(),
      przewidywaneDoreczenie:String(f.get("przewidywaneDoreczenie")||w.przewidywaneDoreczenie||"").trim(),
      waga:String(f.get("waga")||w.waga||"").trim(),
      dlugosc:String(f.get("dlugosc")||w.dlugosc||"").trim(),
      szerokosc:String(f.get("szerokosc")||w.szerokosc||"").trim(),
      wysokosc:String(f.get("wysokosc")||w.wysokosc||"").trim(),
      ochrona:String(f.get("ochrona")||w.ochrona||"").trim(),
      pobranieAktywne:pobranieAktywneForm,
      pobranie:pobranieForm,
      paczkaWeekend:paczkaWeekendForm,
      sposobNadania:INPOST_SP_NADANIA[sposobNadania]?sposobNadania:INPOST_DOMYSLNY_SP_NADANIA,
      punktNadania,
      formatEtykiety:String(f.get("formatEtykiety")||w.formatEtykiety||"A6").trim().toUpperCase()==="A4"?"A4":"A6",
      zadania:{...(w.zadania||{}),dane:true},
      zaktualizowano:new Date().toISOString()
    };
    zapiszKosztyZamowienia(zam,{dostawaId:zam.dostawaId,paczkaWeekend:zam.wysylka.paczkaWeekend});
    if(pobranieAktywneForm && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) zam.wysylka.pobranie=kwotaNum(zam.razem).toFixed(2);
  });
  if(zapisane) await zapiszZamowienieCentralnie(zapisane,false);
  return zapisane;
}
async function utworzPrzesylkeAPI(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z)return toast("Nie znaleziono zamówienia");
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora"); chmuraUstawToken(); return; }
  if(!confirm(`Utworzyć prawdziwą przesyłkę InPost dla ${nr}? W trybie produkcyjnym operacja może naliczyć opłatę zgodnie z umową.`))return;
  try{
    await zapiszFormularzWysylkiPrzedAPI(nr);
    toast("Tworzę przesyłkę InPost…");
    const d=await chmura("inpost-create",{method:"POST",body:{nr},timeout:25000});
    const labelReady=!!(d.labelReady||d.trackingNumber);
    aktualizujZamowienie(nr,zam=>{
      const w=daneWysylki(zam);
      zam.wysylka=d.order?.wysylka?{...w,...d.order.wysylka}:{...w,przewoznik:"inpost",usluga:uslugaInpostZamowienia(zam),inpostId:d.inpostId||w.inpostId,numer:d.trackingNumber||w.numer,inpostStatus:d.status||w.inpostStatus,etykietaGotowa:labelReady,etap:labelReady?"etykieta":(w.etap&&w.etap!=="problem"?w.etap:"przygotowanie"),zadania:{...(w.zadania||{}),dane:true,etykieta:labelReady}};
      if(d.order?.status) zam.status=d.order.status;
      else if(labelReady&&["nowe","potwierdzone","w realizacji"].includes(zam.status))zam.status="gotowe do wysyłki";
    });
    loguj("info",`InPost utworzył przesyłkę ${d.inpostId||""} (${d.trackingNumber||"bez numeru"}) dla ${nr}`);
    toast(labelReady?`Przesyłka InPost utworzona ✅ ${d.trackingNumber||"etykieta gotowa"}`:"Przesyłka utworzona, ale InPost jeszcze potwierdza etykietę — użyj „Sprawdź status InPost” za chwilę.");
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Najpierw skonfiguruj InPost w Netlify (INPOST_TOKEN, INPOST_ORG_ID)"); location.hash="#/admin/dostawy"; return; }
    if(bl.code==="no_point"){ toast("Brak punktu InPost — otwórz zlecenie i wpisz paczkomat przed etykietą"); return; }
    if(bl.code==="exists"){ toast("Przesyłka InPost już istnieje dla tego zamówienia"); return; }
    if(bl.code==="inpost_validation"){ toast("Uzupełnij dane do InPost: "+((bl.details||[]).map(x=>x.message||x).join(" • ")||bl.message)); return; }
    if(bl.code==="inpost_service_unavailable"){ toast(bl.message||"Ta usługa InPost nie jest aktywna na koncie"); return; }
    aktualizujZamowienie(nr,zam=>{const w=daneWysylki(zam);w.bladIntegracji=bl.message;w.etap="problem";zam.wysylka=w;});
    loguj("blad",`InPost create ${nr}: ${bl.message}`);toast("InPost: "+bl.message);renderuj();
  }
}
async function pobierzEtykieteAPI(nr,format="A6"){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.wysylka?.inpostId)return toast("Najpierw utwórz przesyłkę InPost");
  if(!chmuraToken){ chmuraUstawToken(); return; }
  try{
    toast("Pobieram etykietę InPost…");
    const d=await chmura("inpost-label",{params:{nr,type:format},timeout:25000});
    const url=URL.createObjectURL(b64toBlob(d.base64,"application/pdf"));
    window.open(url,"_blank","noopener");
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    aktualizujZamowienie(nr,zam=>{
      const w=daneWysylki(zam);
      if(d.status)w.inpostStatus=d.status;
      if(d.trackingNumber)w.numer=d.trackingNumber;
      w.etykietaGotowa=true;
      w.zadania={...(w.zadania||{}),dane:true,etykieta:true};
      if(!w.etap||w.etap==="przygotowanie"||w.etap==="problem")w.etap="etykieta";
      zam.wysylka=w;
    });
    loguj("info",`Pobrano etykietę InPost ${format} dla ${nr}`);
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Skonfiguruj InPost w Netlify"); return; }
    if(bl.code==="no_shipment"){ toast("Najpierw utwórz przesyłkę InPost"); return; }
    if(bl.code==="label_not_ready"){
      aktualizujZamowienie(nr,zam=>{ const w=daneWysylki(zam); if(bl.status)w.inpostStatus=bl.status; if(bl.trackingNumber)w.numer=bl.trackingNumber; w.etykietaGotowa=false; w.zadania={...(w.zadania||{}),dane:true,etykieta:false}; zam.wysylka=w; });
      toast(bl.message||"InPost jeszcze nie potwierdził etykiety — sprawdź status za chwilę");
      renderuj();
      return;
    }
    toast("Etykieta: "+bl.message); loguj("blad",`InPost label ${nr}: ${bl.message}`);
  }
}
function idEtykietyInpost(nr){ return "etykietaFormat_"+String(nr||"").replace(/[^a-z0-9_-]/gi,"_"); }
function wybranyFormatEtykietyInpost(nr, fallback="A6"){
  const v=String($(idEtykietyInpost(nr))?.value||fallback||"A6").toUpperCase();
  return v==="A4"?"A4":"A6";
}
const INPOST_STATUSY_ETYKIETA_GOTOWA = ["confirmed","dispatched_by_sender","collected_from_sender","taken_by_courier","adopted_at_source_branch","sent_from_source_branch","ready_to_pickup","out_for_delivery","delivered","returned_to_sender","return_redirected_to_sender"];
function czyEtykietaInpostGotowa(z){
  const w=daneWysylki(z);
  if(w.etykietaGotowa||w.numer)return true;
  const s=String(w.inpostStatus||"").trim().toLowerCase();
  if(!s)return false;
  if(INPOST_STATUSY_ETYKIETA_GOTOWA.includes(s)||s.includes("confirmed"))return true;
  if(s.includes("created")||s.includes("offer")||s.includes("prepared")||s.includes("cancel"))return false;
  return ["transport","doreczenie","dostarczona","zwrot"].includes(String(w.etap||"").toLowerCase());
}
function opisGotowosciEtykietyInpost(z){
  const w=daneWysylki(z), status=String(w.inpostStatus||"").trim();
  if(czyEtykietaInpostGotowa(z))return `Etykieta gotowa${w.numer?` • numer ${w.numer}`:""}${status?` • ${status}`:""}`;
  if(w.inpostId)return `Przesyłka ma ID ${w.inpostId}, ale InPost jeszcze nie potwierdził/opłacił etykiety${status?` • status: ${status}`:""}.`;
  return "Najpierw utwórz przesyłkę InPost.";
}
function pobierzWybranaEtykieteAPI(nr){ return pobierzEtykieteAPI(nr, wybranyFormatEtykietyInpost(nr)); }
function panelEtykietInpostHTML(z){
  const w=daneWysylki(z), nr=z?.nr||"", id=idEtykietyInpost(nr), fmt=String(w.formatEtykiety||"A6").toUpperCase()==="A4"?"A4":"A6";
  const ma=!!w.inpostId, gotowa=czyEtykietaInpostGotowa(z);
  return `<div style="border:2px solid #ffcc00;background:linear-gradient(180deg,#fff7cc,#fff);border-radius:14px;padding:.85rem 1rem;margin:.7rem 0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.7rem;flex-wrap:wrap">
      <div><b>🏷️ Etykiety i import InPost</b><br><small style="color:var(--muted2)">Wybierz format etykiety, pobierz PDF albo przygotuj plik importu do InPost Managera.</small></div>
      <label style="display:flex;align-items:center;gap:.4rem;font-size:.85rem;font-weight:800">Format PDF:
        <select id="${esc(id)}" name="formatEtykiety" style="padding:.38rem .6rem;border:1.5px solid var(--line);border-radius:10px">
          <option value="A6" ${fmt==="A6"?"selected":""}>A6 — mała etykieta</option>
          <option value="A4" ${fmt==="A4"?"selected":""}>A4 — kartka</option>
        </select>
      </label>
    </div>
    <div class="diag-actions" style="margin-top:.7rem">
      ${ma&&gotowa?`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="pobierzWybranaEtykieteAPI(${jsArg(nr)})">🏷️ Pobierz wybraną etykietę</button>
      <button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(nr)},'A6')">A6</button>
      <button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(nr)},'A4')">A4</button>`:ma?`<button class="btn ghost" type="button" disabled title="InPost musi potwierdzić/opłacić przesyłkę przed pobraniem PDF">🏷️ PDF po potwierdzeniu</button>
      <button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="synchronizujTrackingAPI(${jsArg(nr)})">🔄 Sprawdź status InPost</button>`:`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="utworzPrzesylkeAPI(${jsArg(nr)})">🟡 Utwórz przesyłkę i numer</button>
      <button class="btn ghost" type="button" disabled title="Najpierw utwórz przesyłkę InPost">PDF po nadaniu</button>`}
      <button class="btn ghost" type="button" onclick="drukujEtykieteRobocza(${jsArg(nr)})">🏷️ Robocza A6</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'tab')">📄 TXT z nagłówkami InPost</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'csv')">CSV przecinek</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'txt')">📄 TXT średnik</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(nr)}],'extended')">📋 CSV rozszerzony</button>
      ${ma&&gotowa?`<button class="btn ghost" type="button" onclick="synchronizujTrackingAPI(${jsArg(nr)})">🔄 Status InPost</button>`:""}
    </div>
    <p style="font-size:.78rem;color:${ma&&!gotowa?"#92400e":"var(--muted2)"};margin:.55rem 0 0"><b>Status etykiety:</b> ${esc(opisGotowosciEtykietyInpost(z))}</p>
    <p style="font-size:.78rem;color:var(--muted2);margin:.35rem 0 0"><b>TXT z nagłówkami InPost</b> działa z ustawieniem InPost „Separator kolumn: Tabulator”. W InPost zmień tylko <b>„Czy ma nagłówki?” na TAK</b>, wtedy dopasowujesz nazwa do nazwy: e-mail → E-mail, telefon → Telefon, miasto → Miasto.</p>
  </div>`;
}
async function synchronizujTrackingAPI(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr);
  if(!z?.wysylka?.inpostId)return toast("To zamówienie nie ma przesyłki InPost");
  if(!chmuraToken){ chmuraUstawToken(); return; }
  try{
    toast("Pobieram status z InPost…");
    const d=await chmura("inpost-status",{params:{nr},timeout:20000});
    aktualizujZamowienie(nr,zam=>{ if(d.order?.wysylka) zam.wysylka={...daneWysylki(zam),...d.order.wysylka}; });
    loguj("info",`InPost status ${nr}: ${d.status||""} ${d.trackingNumber||""}`);
    toast((d.labelReady||d.trackingNumber)?"Status InPost zaktualizowany ✅ — etykieta gotowa":"Status InPost zaktualizowany — etykieta jeszcze czeka na potwierdzenie");
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured"){ toast("Skonfiguruj InPost w Netlify"); return; }
    if(bl.code==="no_shipment"){ toast("To zamówienie nie ma przesyłki InPost"); return; }
    aktualizujZamowienie(nr,zam=>{const w=daneWysylki(zam);w.bladIntegracji=bl.message;zam.wysylka=w;});
    loguj("blad",`InPost status ${nr}: ${bl.message}`);toast("Status: "+bl.message);renderuj();
  }
}
// Ręczne sprawdzenie statusów WSZYSTKICH przesyłek InPost (to samo robi harmonogram co 6h)
async function synchronizujWszystkieStatusyAPI(){
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora"); chmuraUstawToken(); return; }
  try{
    toast("Sprawdzam statusy wszystkich przesyłek InPost…");
    const d=await chmura("inpost-sync-all",{method:"POST",body:{},timeout:60000});
    await synchronizujBazeCentralna(true).catch(()=>{});
    loguj("info",`InPost sync: sprawdzone ${d.sprawdzone||0}, zmienione ${d.zmienione||0}, e-maile ${d.maile||0}, błędy ${d.bledy||0}`);
    toast(`✅ Sprawdzono ${d.sprawdzone||0} przesyłek — ${d.zmienione||0} zmian statusu, ${d.maile||0} e-maili`);
    renderuj();
  }catch(bl){
    if(bl.code==="inpost_not_configured") toast("InPost nie jest skonfigurowany w Netlify");
    else toast("Błąd sprawdzania statusów: "+bl.message);
  }
}
// Hurtowe tworzenie etykiet InPost (API) dla zaznaczonych zleceń
async function utworzEtykietyZaznaczoneAPI(){
  const nry=[...zaznaczoneNadania];
  if(!nry.length){ toast("Zaznacz zlecenia (☑ na karcie)"); return; }
  if(!chmuraToken){ toast("Wpisz hasło bazy administratora"); chmuraUstawToken(); return; }
  if(!confirm(`Utworzyć przesyłki InPost (API) dla ${nry.length} zaznaczonych zleceń? W trybie produkcyjnym mogą naliczyć się opłaty zgodnie z umową.`)) return;
  let ok=0,bl=0,pom=0;
  toast(`Tworzę przesyłki InPost dla ${nry.length} zleceń…`);
  for(const nr of nry){
    const z=pobierzZamowienia().find(x=>x.nr===nr);
    if(z?.wysylka?.inpostId){ pom++; continue; }
    try{ await chmura("inpost-create",{method:"POST",body:{nr},timeout:25000}); ok++; }
    catch(e){ bl++; loguj("blad",`InPost etykieta ${nr}: ${e.message}`); }
  }
  await synchronizujBazeCentralna(true).catch(()=>{});
  toast(`🟡 InPost: ${ok} przesyłek zleconych${pom?`, ${pom} już było`:""}${bl?`, ${bl} błędów`:""} — PDF odblokuje się po potwierdzeniu`);
  renderuj();
}
function przelaczZadanieWysylki(nr,klucz){
  aktualizujZamowienie(nr,z=>{const w=daneWysylki(z);w.zadania={...(w.zadania||{}),[klucz]:!w.zadania?.[klucz]};z.wysylka=w;});
  renderuj();
}
function zastosujRegulyWysylek(){
  const lista=pobierzZamowienia(); let ile=0;
  for(const z of lista){
    if(["anulowane","zakończone","dostarczone"].includes(z.status)||z.wysylka?.przewoznik) continue;
    const w=daneWysylki(z); w.przewoznik=przewoznikDlaZamowienia(z); w.etap="przygotowanie";
    w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status:"Reguła automatyczna",opis:`Przypisano ${nazwaPrzewoznika(w.przewoznik)}`}];
    z.wysylka=w; if(z.status==="nowe") z.status="w realizacji"; ile++;
  }
  zapiszLS("artway_zamowienia",lista); loguj("info",`Reguły wysyłkowe przypisały ${ile} zleceń`);
  toast(ile?`Przypisano ${ile} zleceń ✅`:"Brak zleceń do przypisania"); renderuj();
}
let tabWysylek="zlecenia", filtrWysylek="aktywne", szukajWysylek="";
function nawigacjaWysylek(){
  const taby=[["zlecenia","📋 Obsługa zleceń"],["tracking","📡 Monitoring i tracking"],["automatyzacje","⚡ Automatyzacje"],["ustawienia","⚙️ Bramka i ustawienia"]];
  return `<div class="panel" style="padding:.65rem .8rem"><div class="shipping-tabs">${taby.map(([id,n])=>`<button class="${tabWysylek===id?"active":""}" onclick="tabWysylek='${id}';renderuj()">${n}</button>`).join("")}</div></div>`;
}
function listaWysylekPoFiltrze(){
  let lista=pobierzZamowienia();
  if(filtrWysylek==="aktywne") lista=lista.filter(z=>!["dostarczona","anulowana","zwrot"].includes(etapWysylki(z)));
  else if(filtrWysylek!=="wszystkie") lista=lista.filter(z=>etapWysylki(z)===filtrWysylek);
  if(szukajWysylek) lista=lista.filter(z=>(`${z.nr} ${z.email||""} ${z.wysylka?.numer||""} ${z.adres||""} ${z.wysylka?.operator||""}`).toLowerCase().includes(szukajWysylek));
  return lista;
}
function wysylkiWyczyscZaznaczenie(){zaznaczoneNadania.clear();renderuj();}
function wysylkiEksportujZakres(zakres="filtr",format="tab"){
  const nry=zakres==="zaznaczone"?[...zaznaczoneNadania]:listaWysylekPoFiltrze().map(z=>String(z.nr));
  eksportNadaniaInpostCSV(nry,format);
}
function kartaZleceniaWysylki(z){
  const w=daneWysylki(z), etap=ETAPY_WYSYLKI[etapWysylki(z)], sla=slaWysylki(z);
  const koszty=kosztyZamowienia(z);
  const zad=w.zadania||{}, wykonane=["dane","kompletacja","etykieta","przekazanie"].filter(k=>zad[k]).length;
  const etykietaGotowa=czyEtykietaInpostGotowa(z);
  const zazn=zaznaczoneNadania.has(String(z.nr)), got=gotoweDoNadaniaInpost(z), odbior=String(z?.dostawaId||"").toLowerCase()==="odbior";
  const znacznik = odbior?"":(got.ok?`<span class="lvl" style="background:#dcfce7;color:#166534" title="Dane kompletne — gotowe do nadania">✅ gotowe</span>`:`<span class="lvl" style="background:#fef3c7;color:#92400e" title="Uzupełnij dane odbiorcy przed nadaniem">⚠️ ${esc(got.powod)}</span>`);
  return `<div class="ship-card ${etapWysylki(z)==="problem"?"problem":""}" style="${zazn?"border:2px solid #ffcc00;background:#fffdf3;":""}">
    <div class="ship-card-head">
      <span><label style="margin-right:.5rem;cursor:pointer" title="Zaznacz do nadania z pliku"><input type="checkbox" style="transform:scale(1.25)" ${zazn?"checked":""} onchange="przelaczZaznaczenieNadania(${jsArg(z.nr)})"></label><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a> • ${esc([z.klient?.imie,z.klient?.nazwisko].filter(Boolean).join(" ")||z.email||"gość")}</span>
      <span>${znacznik} <span class="shipment-priority priority-${esc(w.priorytet||"normalny")}">${esc(w.priorytet||"normalny")}</span> <span class="lvl" style="background:${etap.kolor}">${etap.ikona} ${etap.nazwa}</span></span>
    </div>
	    <div class="ship-meta">🚚 ${esc(nazwaPrzewoznika(w.przewoznik||przewoznikDlaZamowienia(z)))} • ${esc(w.usluga||uslugaInpostZamowienia(z))} • 🔢 ${w.numer?esc(w.numer):"<b>oczekuje na etykietę</b>"}<br>
	      📍 ${esc(z.adres||"brak adresu")} • 👤 ${esc(w.operator||"nieprzypisane")} • <span class="${sla.klasa}">⏱ ${esc(sla.tekst)}</span><br>
	      💰 Dostawa: ${koszty.dostawa?zl(koszty.dostawa):"GRATIS"}${koszty.paczkaWeekend?` • Paczka w Weekend: ${zl(koszty.paczkaWeekend)}`:""} • Razem: <b>${zl(koszty.razem)}</b>
	    </div>
    <div style="margin:.5rem 0;font-size:.75rem;color:var(--muted2)">Postęp ${wykonane}/4:
      ${[["dane","dane"],["kompletacja","kompletacja"],["etykieta","etykieta"],["przekazanie","przekazanie"]].map(([k,n])=>`<label style="margin-right:.5rem;white-space:nowrap"><input type="checkbox" ${zad[k]?"checked":""} onchange="przelaczZadanieWysylki('${esc(z.nr)}','${k}')"> ${n}</label>`).join("")}
    </div>
    ${w.bladIntegracji?`<div class="backend-note" style="border-color:var(--danger);background:#fff1f2;color:#991b1b"><b>Wyjątek:</b> ${esc(w.bladIntegracji)}</div>`:""}
    <div class="diag-actions">
      <a class="btn" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Obsłuż zlecenie</a>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'tab')">📄 TXT z nagłówkami InPost</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'csv')">CSV przecinek</button>
      <button class="btn ghost" type="button" onclick="eksportNadaniaInpostCSV([${jsArg(z.nr)}],'txt')">TXT średnik</button>
      ${!w.inpostId?`<button class="btn" type="button" style="background:#ffcc00;color:#111" onclick="utworzPrzesylkeAPI(${jsArg(z.nr)})">🟡 Generuj etykietę InPost</button>`:etykietaGotowa?`<button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(z.nr)},'A6')">🏷️ A6</button><button class="btn ghost" type="button" onclick="pobierzEtykieteAPI(${jsArg(z.nr)},'A4')">🏷️ A4</button>`:`<button class="btn ghost" type="button" disabled title="${esc(opisGotowosciEtykietyInpost(z))}">🏷️ PDF po potwierdzeniu</button>`}
      ${w.inpostId?`<button class="btn ghost" type="button" onclick="synchronizujTrackingAPI(${jsArg(z.nr)})">🔄 Status InPost</button>`:""}
      ${urlSledzenia(z)?`<a class="btn ghost" href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Śledź</a>`:""}
    </div>
  </div>`;
}
function panelZlecenWysylkowych(){
  const wszystkie=pobierzZamowienia(), lista=listaWysylekPoFiltrze();
  const doN = lista.filter(z=>String(z?.dostawaId||"").toLowerCase()!=="odbior" && !["dostarczona","anulowana","zwrot"].includes(etapWysylki(z)));
  const gotoweN = lista.filter(z=>gotoweDoNadaniaInpost(z).ok).length;
  const paczkDoN = doN.filter(z=>paczkomatoweInpost(z)).length, kurierDoN = doN.length - paczkDoN;
  const etapy=["do_obslugi","przygotowanie","etykieta","transport","doreczenie","problem"];
  return `<div class="panel">
    <h1>🚚 Centrum obsługi InPost</h1>
    <p style="color:var(--muted2)">Jeden proces dla zamówień InPost: wybór paczkomatu, etykieta, przekazanie, tracking, doręczenie albo wyjątek.</p>
    <div class="pipeline">${etapy.map(id=>`<div class="pipeline-step ${id==="problem"?"problem":""}"><b>${wszystkie.filter(z=>etapWysylki(z)===id).length}</b><small>${ETAPY_WYSYLKI[id].ikona} ${ETAPY_WYSYLKI[id].nazwa}</small></div>`).join("")}</div>
    ${adminWyszukiwaniePanelHTML({id:"shipping-orders",description:"Zlecenie, klient, numer nadania, operator oraz etap procesu InPost.",results:lista.length,active:!!(szukajWysylek||filtrWysylek!=="aktywne"),open:true,fields:`<div class="orders-toolbar admin-search-full">
      <select onchange="filtrWysylek=this.value;renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option value="aktywne" ${filtrWysylek==="aktywne"?"selected":""}>Wszystkie aktywne</option>
        <option value="wszystkie" ${filtrWysylek==="wszystkie"?"selected":""}>Cała historia</option>
        ${Object.entries(ETAPY_WYSYLKI).map(([id,e])=>`<option value="${id}" ${filtrWysylek===id?"selected":""}>${e.ikona} ${e.nazwa}</option>`).join("")}
      </select>
      <input placeholder="Szukaj: zlecenie, klient, tracking, operator…" value="${esc(szukajWysylek)}" oninput="szukajWysylek=this.value.toLowerCase();renderuj()" style="flex:1;min-width:210px;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
      <button class="btn ghost" onclick="zastosujRegulyWysylek()">⚡ Zastosuj reguły</button>
    </div>`,actions:adminOperacjeWynikowHTML({id:"shipping-orders",selected:zaznaczoneNadania.size,pageCount:lista.length,resultCount:lista.length,selectPage:"zaznaczWszystkieNadania(true)",selectAll:"zaznaczWszystkieNadania(true)",clear:"wysylkiWyczyscZaznaczenie()",exportSelected:"wysylkiEksportujZakres('zaznaczone','tab')",exportAll:"wysylkiEksportujZakres('filtr','tab')",exportLabel:"TXT InPost"})})}
    <div style="border:2px solid #ffcc00;background:linear-gradient(180deg,#fffbeb,#fff);border-radius:14px;padding:.85rem 1rem;margin:.2rem 0 .9rem">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:space-between">
        <div style="font-size:1rem"><b>📄 Nadanie z pliku (InPost)</b> <span style="color:var(--muted2);font-size:.82rem">— hurtowe / awaryjne, bez umowy kurierskiej</span></div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn" style="background:#ffcc00;color:#111;font-weight:800;box-shadow:0 2px 8px rgba(255,204,0,.45)" onclick="eksportNadaniaInpostCSV(null,'tab')">⬇️ TXT z nagłówkami InPost${zaznaczoneNadania.size?` — ${zaznaczoneNadania.size} zazn.`:` — wszystkie (${doN.length})`}</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'csv')">CSV przecinek</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'txt')">TXT średnik</button>
          <button class="btn ghost" onclick="eksportNadaniaInpostCSV(null,'extended')">📋 CSV rozszerzony</button>
        </div>
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center;margin-top:.65rem">
        <span style="font-size:.8rem;color:var(--muted2);font-weight:700">Zaznacz:</span>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczWszystkieNadania(true)">☑️ Wszystkie (${lista.length})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczGotoweNadania()">✅ Gotowe (${gotoweN})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczTypNadania('paczkomat')">📦 Paczkomat (${paczkDoN})</button>
        <button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem" onclick="zaznaczTypNadania('kurier')">🚚 Kurier (${kurierDoN})</button>
        ${zaznaczoneNadania.size?`<button class="btn ghost" style="padding:.32rem .7rem;font-size:.83rem;color:#b91c1c" onclick="zaznaczoneNadania.clear();renderuj()">✖ Odznacz (${zaznaczoneNadania.size})</button>
        <button class="btn" style="padding:.32rem .7rem;font-size:.83rem;background:#ffcc00;color:#111;margin-left:auto" title="Utwórz przesyłki i etykiety InPost przez API dla zaznaczonych zleceń" onclick="utworzEtykietyZaznaczoneAPI()">🟡 Etykiety API (${zaznaczoneNadania.size})</button>`:""}
      </div>
      <p style="font-size:.77rem;color:var(--muted2);margin:.55rem 0 0">Plik wgraj w InPost: <b>manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU</b> (max 100). Użyj głównego <b>TXT z nagłówkami InPost</b>: zostaw <b>Separator kolumn: Tabulator</b>, ustaw <b>Czy ma nagłówki: Tak</b>, a potem dopasowuj nazwa do nazwy, np. <b>e-mail → E-mail</b>, <b>telefon → Telefon</b>, <b>miasto → Miasto</b>, <b>typ_przesylki → Typ przesyłki</b>. Błąd „nie znaleziono adresu e-mail w pierwszej linii” oznacza, że nagłówki nadal są ustawione na „Nie”.</p>
    </div>
    ${lista.length?lista.map(kartaZleceniaWysylki).join(""):"<p>Brak zleceń dla wybranego filtra.</p>"}
  </div>`;
}
function panelTrackinguWysylek(){
  const lista=pobierzZamowienia().filter(z=>daneWysylki(z).numer||["problem","transport","doreczenie"].includes(etapWysylki(z)));
  return `<div class="panel">
    <h1>📡 Monitoring i tracking</h1>
    <p style="color:var(--muted2)">Monitoring numerów InPost, ostatnich zdarzeń, SLA i wyjątków z automatycznego webhooka oraz ręcznego odświeżenia statusu.</p>
    <div style="border:1.5px solid #86efac;background:#f0fdf4;border-radius:12px;padding:.7rem .9rem;margin:.2rem 0 .9rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;justify-content:space-between">
      <div style="font-size:.88rem;color:#166534"><b>🤖 Automatyczne sprawdzanie statusów</b><br><span style="color:var(--muted2)">Wszystkie przesyłki są sprawdzane <b>samoczynnie co 6 godzin</b> (harmonogram) + na bieżąco przez webhook InPost. Statusy i e-maile aktualizują się same.</span></div>
      <button class="btn" style="background:#166534;color:#fff;white-space:nowrap" onclick="synchronizujWszystkieStatusyAPI()">🔄 Sprawdź teraz wszystkie</button>
    </div>
    <div class="ship-grid">
      <div class="ship-stat"><b>${lista.length}</b><small>monitorowanych</small></div>
      <div class="ship-stat"><b>${lista.filter(z=>etapWysylki(z)==="transport").length}</b><small>w transporcie</small></div>
      <div class="ship-stat"><b>${lista.filter(z=>etapWysylki(z)==="doreczenie").length}</b><small>w doręczeniu</small></div>
      <div class="ship-stat" style="background:#fff1f2"><b>${lista.filter(z=>etapWysylki(z)==="problem").length}</b><small>wymaga reakcji</small></div>
    </div>
    ${lista.length?`<table class="tracking-table"><tr><th>Zlecenie</th><th>Przewoźnik / numer</th><th>Etap wspólny</th><th>Ostatnie zdarzenie</th><th>SLA</th><th>Akcja</th></tr>
      ${lista.map(z=>{const w=daneWysylki(z),h=[...(w.historia||[])].pop(),e=ETAPY_WYSYLKI[etapWysylki(z)],sla=slaWysylki(z);return`<tr>
        <td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a><br><small>${esc(z.email||"")}</small></td>
        <td>${esc(nazwaPrzewoznika(w.przewoznik))}<br><b>${esc(w.numer||"brak")}</b></td>
        <td><span class="lvl" style="background:${e.kolor}">${e.ikona} ${e.nazwa}</span></td>
        <td>${h?`<b>${esc(h.status)}</b><br><small>${esc(h.czas)}</small>`:"brak zdarzeń"}</td>
        <td class="${sla.klasa}">${esc(sla.tekst)}${w.ostatniaSynchronizacja?`<br><small>synch. ${esc(new Date(w.ostatniaSynchronizacja).toLocaleString("pl-PL"))}</small>`:""}</td>
        <td>${urlSledzenia(z)?`<a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Śledź →</a>`:`<a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Uzupełnij →</a>`}</td>
      </tr>`}).join("")}</table>`:"<p>Brak przesyłek objętych monitoringiem.</p>"}
    <div class="backend-note"><b>Automatyzacja:</b> webhook InPost aktualizuje tę tabelę po zmianie statusu przesyłki. Jeśli etykieta jest tworzona ręcznie w InPost Managerze, w polu referencji/opisu wpisz numer zamówienia ze sklepu, np. <code>ATM-123456</code>.</div>
  </div>`;
}
function panelAutomatyzacjiWysylek(){
  const u=ustawieniaWysylki();
  const emailGotowy=!!stanBramki.email?.configured, emailPolaczony=emailGotowy&&!!chmuraToken;
  return `<div class="panel">
    <h1>⚡ Automatyzacje wysyłek</h1>
    <p style="color:var(--muted2)">Reguły obowiązują wszystkie zlecenia. Aktywny jest jeden przewoźnik: InPost, z usługami Paczkomat i Kurier.</p>
    <form data-flagi="autoStatus,autoEmail,autoTracking,alarmSla,powiadomieniaWyjatki" onsubmit="zapiszUstawieniaWysylki(event)">
      <h2>Reguły przypisania</h2>
      <div class="automation-row"><span><b>InPost</b><small style="display:block;color:var(--muted2)">Paczkomat wymaga punktu, Kurier używa adresu dostawy</small></span><select name="regulaPaczkomat">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<option value="${id}" selected>${esc(p.nazwa)}</option>`).join("")}</select><span>→ zawsze</span></div>
      <input type="hidden" name="regulaKurier" value="inpost">
      <h2>Synchronizacja i reakcje</h2>
      <label class="chk-row"><input type="checkbox" name="autoTracking" ${u.autoTracking?"checked":""}> Automatycznie pobieraj zdarzenia i normalizuj statusy</label>
      <label class="chk-row"><input type="checkbox" name="autoStatus" ${u.autoStatus?"checked":""}> Aktualizuj status zamówienia na podstawie trackingu</label>
      <label class="chk-row"><input type="checkbox" name="autoEmail" ${u.autoEmail?"checked":""}> Automatycznie wysyłaj e-mail przez API po zmianie statusu, nadaniu, doręczeniu, zwrocie lub problemie</label>
      <label class="chk-row"><input type="checkbox" name="alarmSla" ${u.alarmSla?"checked":""}> Alarmuj o przekroczeniu czasu na nadanie</label>
      <label class="chk-row"><input type="checkbox" name="powiadomieniaWyjatki" ${u.powiadomieniaWyjatki?"checked":""}> Wyróżniaj wyjątki wymagające działania operatora</label>
      <div class="f-row" style="margin-top:.8rem"><div class="f-group"><label>SLA nadania (godziny)</label><input type="number" min="1" name="slaNadanie" value="${esc(u.slaNadanie)}"></div><div class="f-group"><label>Planowany czas doręczenia (godziny)</label><input type="number" min="1" name="slaDoreczenie" value="${esc(u.slaDoreczenie)}"></div></div>
      <button class="btn" type="submit">💾 Zapisz automatyzacje</button>
    </form>
    <div class="backend-note" style="${emailPolaczony?"border-color:#86efac;background:#f0fdf4;color:#166534":emailGotowy?"":"border-color:#f59e0b"}">
      <b>E-mail SMTP:</b> ${emailPolaczony?`skonfigurowano ${esc(stanBramki.email.provider||"SMTP")} i panel ma hasło bazy — automatyczne wiadomości są gotowe`:emailGotowy?`SMTP jest skonfigurowany, wpisz hasło bazy administratora, aby wysyłać testy i ręczne wiadomości`:"brak konfiguracji — ustaw SMTP/Gmail w zmiennych Netlify"}.
      ${!emailPolaczony?` <a href="#/admin/dostawy">Konfiguracja e-mail →</a>`:""}
    </div>
    <form onsubmit="wyslijTestEmail(event)" style="margin-top:1rem">
      <h2>Test wiadomości API</h2>
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>Adres odbiorcy testu</label><input type="email" name="email" value="${esc(KONFIG.emailSklepu)}" required></div>
        <div class="f-group"><button class="btn ghost" type="submit" ${emailPolaczony?"":"disabled"}>📧 Wyślij test</button></div>
      </div>
    </form>
    <div class="backend-note"><b>Sposób działania:</b> e-mail jest wysyłany natychmiast przez serwerowe API, gdy administrator zmienia status zamówienia lub zapisuje nowy numer nadania. Historia i identyfikator wiadomości są zapisywane przy zamówieniu.</div>
  </div>`;
}
function panelUstawienBramki(){
  const u=ustawieniaWysylki();
  const ip=stanBramki.inpost||{};
  const ipGotowy=!!ip.configured, ipMapa=!!ip.geowidgetConfigured, ipWebhook=!!ip.webhookConfigured;
  const av=ip.serviceAvailability||{};
  const braki=Array.isArray(ip.missingEnv)&&ip.missingEnv.length?ip.missingEnv:[...(ipGotowy?[]:["INPOST_TOKEN","INPOST_ORG_ID"])];
  const orgInfo=ip.organization?.id?`Organizacja: <b>${esc(ip.organization.id)}</b>${ip.organization.name?` • ${esc(ip.organization.name)}`:""}`:"Organizacja zostanie pokazana po realnym teście API.";
  const uslugiInfo=av.services?.length?`<br>Usługa paczkomatowa <code>${esc(av.lockerService||"inpost_locker_standard")}</code>: <b>${av.locker?"aktywna ✅":"brak — włącz usługę paczkomatową w InPost"}</b> • Kurier InPost <code>${esc(av.courierService||"inpost_courier_standard")}</code>: <b>${av.courier?"aktywny ✅":"brak — włącz usługę kurierską w InPost"}</b>`:"";
  return `<div class="panel">
    <h1>⚙️ Bramka InPost</h1>
    <div class="integration-hub" style="border:2px solid ${ipGotowy?'#86efac':'#fcd34d'};background:${ipGotowy?'#f0fdf4':'#fffbeb'}">
      <div class="integration-hub-status"><span><b>🟡 InPost (ShipX) — Netlify</b><br><small style="color:var(--muted2)">Prawdziwe przesyłki, etykiety i mapa paczkomatów — tokeny w zmiennych Netlify</small></span>
        <span class="integration-state" style="background:${ipGotowy?'#dcfce7':'#fef3c7'};color:${ipGotowy?'#166534':'#854d0e'}">${ipGotowy?`tokeny obecne • ${esc(ip.env||'production')}`:`brakuje: ${esc(braki.join(", "))}`}</span></div>
      <p class="ship-meta">Przesyłki ShipX: <b>${ipGotowy?"aktywne po pozytywnym teście ✅":"uzupełnij brakujące zmienne Netlify"}</b> &nbsp;•&nbsp; Mapa paczkomatów: <b>${ipMapa?"aktywna ✅":"ustaw INPOST_GEOWIDGET_TOKEN"}</b> &nbsp;•&nbsp; Webhook statusów: <b>${ipWebhook?"aktywny ✅":"ustaw INPOST_WEBHOOK_SECRET i dodaj URL w InPost"}</b><br>${orgInfo}${uslugiInfo}</p>
      <div class="diag-actions">
        <button class="btn ghost" onclick="sprawdzBramke()">🔎 Sprawdź Netlify</button>
        <button class="btn" style="background:#ffcc00;color:#111" onclick="testujInPost()">🟡 Test API InPost</button>
      </div>
      ${stanBramki.error?`<div class="backend-note" style="border-color:var(--danger);background:#fff1f2;color:#991b1b"><b>Błąd połączenia:</b> ${esc(stanBramki.error)}</div>`:""}
      <div class="backend-note" style="margin-top:.6rem"><b>Wymagane dla etykiet:</b> <code>INPOST_TOKEN</code> i <code>INPOST_ORG_ID</code>. <b>Dla mapy:</b> <code>INPOST_GEOWIDGET_TOKEN</code>. <b>Dla automatycznego śledzenia z Managera:</b> <code>INPOST_WEBHOOK_SECRET</code> oraz adres webhooka wpisany w InPost API. Opcjonalnie: <code>INPOST_ENV</code>, <code>INPOST_SENDING_METHOD</code>, <code>INPOST_LOCKER_SERVICE</code>, <code>INPOST_COURIER_SERVICE</code>. Przy ręcznie tworzonych etykietach wpisuj w InPost numer zamówienia w referencji, np. <code>ATM-123456</code>.</div>
      <details style="margin-top:.6rem"><summary style="cursor:pointer;font-weight:700">Awaryjny/stary backend PHP na hostingu</summary>
        <p class="ship-meta">Główna integracja działa przez Netlify Functions. Ten adres zostaje tylko jako informacja dla pierwszej instalacji na nazwa.pl albo awaryjnego hostingu bez Netlify: <code>${esc(u.apiEndpoint)}</code>.</p>
      </details>
    </div>
    <div class="integration-card" style="margin-top:1rem">
      <b>📧 Automatyczne e-maile</b>
      <span class="integration-state">${stanBramki.email?.configured?`${esc(stanBramki.email.provider||"SMTP")} skonfigurowany${chmuraToken?" i gotowy":" — wpisz hasło bazy do testów"}`:"ustaw SMTP/Gmail w Netlify"}</span>
      <p class="ship-meta">Hasło SMTP pozostaje wyłącznie w zmiennych Netlify. Wysyłkę testową i reguły statusów znajdziesz w zakładce Automatyzacje.</p>
    </div>
    <form onsubmit="zapiszUstawieniaWysylki(event)" style="margin-top:1rem">
      <div class="f-row"><div class="f-group"><label>Adres bramki backendowej</label><input name="apiEndpoint" value="${esc(u.apiEndpoint)}" placeholder="/api/shipping"></div><div class="f-group"><label>Tryb</label><select name="tryb"><option value="sandbox" ${u.tryb==="sandbox"?"selected":""}>Sandbox / testowy</option><option value="production" ${u.tryb==="production"?"selected":""}>Produkcyjny</option></select></div></div>
      <div class="backend-note"><b>Bez sekretów:</b> w tym miejscu zapisuje się tylko adres wspólnej bramki. Tokeny InPost pozostają na serwerze, poza publicznym katalogiem strony.</div>
      <h2>Aktywny adapter</h2>
      <div class="integration-grid">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<div class="integration-card"><b>${esc(p.nazwa)}</b><span class="integration-state">${ipGotowy?"adapter Netlify gotowy — przesyłki, etykiety, mapa":"ustaw tokeny InPost w Netlify"}</span><p class="ship-meta">ShipX (Netlify) • Paczkomat + Kurier InPost • numer nadania • PDF A6/A4 • status • Geowidget • webhook</p></div>`).join("")}</div>
      <h2>Dane nadawcy i paczki</h2>
      <div class="f-row"><div class="f-group"><label>Domyślny przewoźnik</label><select name="przewoznik">${Object.entries(przewoznicyAktywni()).map(([id,p])=>`<option value="${id}" selected>${esc(p.nazwa)}</option>`).join("")}</select></div><div class="f-group"><label>Nazwa nadawcy</label><input name="nadawca" value="${esc(u.nadawca)}"></div></div>
      <div class="f-row"><div class="f-group"><label>Ulica i numer</label><input name="ulica" value="${esc(u.ulica)}"></div><div class="f-group"><label>Kod pocztowy</label><input name="kod" value="${esc(u.kod)}"></div><div class="f-group"><label>Miasto</label><input name="miasto" value="${esc(u.miasto)}"></div></div>
      <div class="f-row"><div class="f-group"><label>Telefon</label><input name="telefon" value="${esc(u.telefon)}"></div><div class="f-group"><label>E-mail nadawcy</label><input type="email" name="email" value="${esc(u.email)}"></div></div>
      <div class="f-row"><div class="f-group"><label>Waga (kg)</label><input type="number" step=".01" min=".01" name="waga" value="${esc(u.waga)}"></div><div class="f-group"><label>Długość (cm)</label><input type="number" min="1" name="dlugosc" value="${esc(u.dlugosc)}"></div><div class="f-group"><label>Szerokość (cm)</label><input type="number" min="1" name="szerokosc" value="${esc(u.szerokosc)}"></div><div class="f-group"><label>Wysokość (cm)</label><input type="number" min="1" name="wysokosc" value="${esc(u.wysokosc)}"></div></div>
      <button class="btn" type="submit">💾 Zapisz bramkę i dane nadawcy</button>
    </form>
  </div>`;
}
function widokAdminWysylki(){
  const widok=tabWysylek==="tracking"?panelTrackinguWysylek():tabWysylek==="automatyzacje"?panelAutomatyzacjiWysylek():tabWysylek==="ustawienia"?panelUstawienBramki():panelZlecenWysylkowych();
  return adminSzkielet("/admin/wysylki",nawigacjaWysylek()+widok);
}
