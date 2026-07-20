/* GENERATED ADMIN SHIPPING — loaded on demand */
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
  if(numer&&numer!==staryNumer&&!maUprawnieniaZapisuChmury()) void obsluzAutomatycznyEmail(nr,z.status,"nadanie");
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
  if((statusZamowienia||typEmaila)&&!maUprawnieniaZapisuChmury()) void obsluzAutomatycznyEmail(nr,statusZamowienia,typEmaila);
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
  if(!stanBramki.email?.authenticated){
    if(!automatycznie) toast("Poczta nie ma potwierdzonego trwałego połączenia z serwerem");
    return false;
  }
  if(!maUprawnieniaZapisuChmury()){
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
  if(!stanBramki.email?.authenticated||!maUprawnieniaZapisuChmury()){
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
  if(!stanBramki.email?.authenticated) return toast("Najpierw sprawdź trwałe połączenie poczty z serwerem");
  if(!maUprawnieniaZapisuChmury()){ chmuraUstawToken(); return; }
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
let ostatniTestIntegracjiSerwerowych=0, testIntegracjiWToku=false;

function nawigacjaWysylek(aktywna="zlecenia"){
  const aktywne=pobierzZamowienia().filter(z=>!["dostarczona","anulowana","zwrot"].includes(etapWysylki(z))).length,problemy=pobierzZamowienia().filter(z=>etapWysylki(z)==="problem").length;
  return adminSubnavHTML([
    {id:"zlecenia",href:"#/admin/wysylki",label:"📋 Obsługa zleceń",badge:aktywne||""},
    {id:"tracking",href:"#/admin/wysylki/tracking",label:"📡 Monitoring i tracking",badge:problemy||""},
    {id:"automatyzacje",href:"#/admin/wysylki/automatyzacje",label:"⚡ Automatyzacje"},
    {id:"ustawienia",href:"#/admin/wysylki/ustawienia",label:"⚙️ Bramka i ustawienia"}
  ],aktywna);
}
function wysylkiKontekstPodstronyHTML(aktywna="zlecenia"){
  const cfg={
    zlecenia:{icon:"📋",eyebrow:"Realizacja zamówień",title:"Obsługa zleceń InPost",description:"Dane odbiorcy, sposób nadania, etykieta i przekazanie przesyłki w jednym procesie."},
    tracking:{icon:"📡",eyebrow:"Monitoring przesyłek",title:"Tracking i wyjątki",description:"Numery nadania, zdarzenia InPost, SLA oraz przesyłki wymagające reakcji operatora."},
    automatyzacje:{icon:"⚡",eyebrow:"Reguły operacyjne",title:"Automatyzacje wysyłek",description:"Automatyczne statusy, tracking, e-maile i alarmy czasu nadania."},
    ustawienia:{icon:"⚙️",eyebrow:"Integracja przewoźnika",title:"Bramka InPost i nadawca",description:"Stan API, usługi, dane nadawcy oraz bezpieczna konfiguracja integracji serwerowej."}
  }[aktywna];
  return `<header class="shipping-page-context"><div><span>${esc(cfg.icon)}</span><div><small>${esc(cfg.eyebrow)}</small><h1>${esc(cfg.title)}</h1><p>${esc(cfg.description)}</p></div></div><a class="btn ghost" href="#/admin/zamowienia">📦 Zamówienia sklepu</a></header>`;
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
      <input placeholder="Szukaj: zlecenie, klient, tracking, operator…" value="${esc(szukajWysylek)}" oninput="szukajWysylek=this.value.toLowerCase();zaplanujRenderPoWpisaniu()" style="flex:1;min-width:210px;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
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
  const emailGotowy=!!stanBramki.email?.configured, emailPolaczony=!!stanBramki.email?.authenticated&&maUprawnieniaZapisuChmury();
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
      <b>E-mail SMTP:</b> ${emailPolaczony?`${esc(stanBramki.email.provider||"SMTP")} — autoryzacja sprawdzona, automatyczne wiadomości są gotowe`:emailGotowy?`dane są zapisane na serwerze, ale autoryzacja nie została potwierdzona`:stanBramki.email?.credentialIssue==="masked_placeholder"?"wykryto maskę zamiast prawidłowego hasła aplikacji Google":"brak prawidłowej trwałej konfiguracji serwera"}.
      ${!emailPolaczony?` <button class="btn ghost" type="button" onclick="testujEmailPolaczenie()">Sprawdź pocztę</button>`:""}
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
function widokAdminWysylki(sekcja="zlecenia"){
  const aktywna=["zlecenia","tracking","automatyzacje","ustawienia"].includes(String(sekcja||""))?String(sekcja):"zlecenia";tabWysylek=aktywna;
  const widok=aktywna==="tracking"?panelTrackinguWysylek():aktywna==="automatyzacje"?panelAutomatyzacjiWysylek():aktywna==="ustawienia"?panelUstawienBramki():panelZlecenWysylkowych();
  return adminSzkielet("/admin/wysylki",`<div class="module-page-stack shipping-module-page">${nawigacjaWysylek(aktywna)}${wysylkiKontekstPodstronyHTML(aktywna)}<div class="shipping-workspace section-${esc(aktywna)}">${widok}</div></div>`);
}
