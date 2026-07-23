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
    {id:"inpost",href:"#/admin/wysylki/inpost",label:"📮 Wysyłka z InPost"},
    {id:"tracking",href:"#/admin/wysylki/tracking",label:"📡 Monitoring i tracking",badge:problemy||""},
    {id:"automatyzacje",href:"#/admin/wysylki/automatyzacje",label:"⚡ Automatyzacje"},
    {id:"ustawienia",href:"#/admin/wysylki/ustawienia",label:"⚙️ Bramka i ustawienia"}
  ],aktywna);
}
function wysylkiKontekstPodstronyHTML(aktywna="zlecenia"){
  const cfg={
    zlecenia:{icon:"📋",eyebrow:"Realizacja zamówień",title:"Obsługa zleceń InPost",description:"Dane odbiorcy, sposób nadania, etykieta i przekazanie przesyłki w jednym procesie."},
    inpost:{icon:"📮",eyebrow:"Nadania umowne",title:"Wysyłka z InPost",description:"Ręczne nadania dla klientów, wszystkie aktywne usługi umowy InPost oraz rozliczenie własnej prowizji."},
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
  const aktywna=["zlecenia","inpost","tracking","automatyzacje","ustawienia"].includes(String(sekcja||""))?String(sekcja):"zlecenia";tabWysylek=aktywna;
  const widok=aktywna==="inpost"?panelWysylkiUslugowejInpost():aktywna==="tracking"?panelTrackinguWysylek():aktywna==="automatyzacje"?panelAutomatyzacjiWysylek():aktywna==="ustawienia"?panelUstawienBramki():panelZlecenWysylkowych();
  return adminSzkielet("/admin/wysylki",`<div class="module-page-stack shipping-module-page">${nawigacjaWysylek(aktywna)}${wysylkiKontekstPodstronyHTML(aktywna)}<div class="shipping-workspace section-${esc(aktywna)}">${widok}</div></div>`);
}

let inpostServiceStan={loaded:false,loading:false,saving:false,error:"",items:[],addressBook:[],settings:{commissionGross:4,sender:{}},billing:{groups:[]},serviceAvailability:null,requestId:"",pricing:null};
let inpostServiceSzukaj="",inpostServiceFiltr="wszystkie",inpostServiceBillingFiltr="wszystkie";

function inpostServiceNowyRequestId(){
  inpostServiceStan.requestId=(globalThis.crypto?.randomUUID?.()||`inpost-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return inpostServiceStan.requestId;
}
function inpostServiceAdresFirmy(){
  const d=daneFirmy(),raw=String(d.adres||"").trim(),match=raw.match(/^(.+?)\s+([0-9][0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż/.-]*)$/);
  return {companyName:d.nazwa||"",taxCode:d.nip||"",firstName:"Artway",lastName:"TM",email:KONFIG.emailSklepu||"",phone:String(KONFIG.telefon||"").replace(/\D/g,"").slice(-9),address:{street:match?match[1]:raw,buildingNumber:match?match[2]:"",flatNumber:"",postCode:d.kodPocztowy||"",city:d.miasto||""}};
}
function inpostServiceNadawca(){
  const fallback=inpostServiceAdresFirmy(),saved=inpostServiceStan.settings?.sender||{};
  return {...fallback,...saved,address:{...(fallback.address||{}),...(saved.address||{})}};
}
function inpostServiceKlienci(){
  const users=typeof pobierzUzytkownikow==="function"?pobierzUzytkownikow():[];
  const shipmentClients=(inpostServiceStan.items||[]).map(item=>item.receiver).filter(Boolean);
  const map=new Map();
  [...users,...shipmentClients].forEach(raw=>{
    const company=raw.daneFirmy||{},email=String(raw.email||company.email||"").trim().toLowerCase(),nip=String(raw.nip||company.nip||raw.taxCode||"").replace(/\D/g,""),key=nip||email;
    if(!key)return;
    const address=raw.address||raw.adresDostawy||company.address||company.adres||{};
    map.set(key,{key,companyName:raw.companyName||raw.firma||company.nazwa||"",taxCode:nip,firstName:raw.firstName||raw.imie||"",lastName:raw.lastName||raw.nazwisko||"",email,phone:raw.phone||raw.telefon||"",address:{street:address.street||address.ulica||raw.ulica||"",buildingNumber:address.buildingNumber||address.nrDomu||raw.nrDomu||"",flatNumber:address.flatNumber||address.nrLokalu||raw.nrLokalu||"",postCode:address.postCode||address.kod||address.kodPocztowy||raw.kod||"",city:address.city||address.miasto||raw.miasto||""}});
  });
  return [...map.values()].slice(0,1000);
}
async function inpostServiceLaduj(force=false,cicho=true){
  if(inpostServiceStan.loading||(!force&&inpostServiceStan.loaded))return;
  inpostServiceStan={...inpostServiceStan,loading:true,error:""};
  try{
    const d=await chmura("inpost-service-shipments",{params:{limit:300},timeout:30000});
    inpostServiceStan={...inpostServiceStan,loaded:true,loading:false,items:Array.isArray(d.items)?d.items:[],addressBook:Array.isArray(d.addressBook)?d.addressBook:[],settings:d.settings||{commissionGross:4,sender:{}},billing:d.billing||{groups:[]},serviceAvailability:d.serviceAvailability||null,error:""};
    if(!inpostServiceStan.requestId)inpostServiceNowyRequestId();
  }catch(e){inpostServiceStan={...inpostServiceStan,loaded:true,loading:false,error:e.message||String(e)};if(!cicho)toast("InPost: "+inpostServiceStan.error);}
  if(trasa()==="/admin/wysylki/inpost")renderuj();
}
function inpostServiceUstawTyp(form){
  const type=String(form?.deliveryType?.value||"locker");
  form?.querySelectorAll("[data-inpost-only]").forEach(el=>el.hidden=!String(el.dataset.inpostOnly||"").split(",").includes(type));
  if(type==="locker"&&form?.sendingMethod?.value==="dispatch_order")form.sendingMethod.value="parcel_locker";
  inpostServicePrzelicz(form);
}
function inpostServicePrzelicz(form){
  const fee=Math.max(0,Number(String(form?.commissionGross?.value||0).replace(",","."))||0),out=form?.querySelector("[data-inpost-commission-total]");
  if(out)out.textContent=fee.toLocaleString("pl-PL",{style:"currency",currency:"PLN"});
}
function inpostServiceWypelnijKlienta(input){
  const form=input?.form,key=String(input?.value||"").trim().toLowerCase(),client=inpostServiceKlienci().find(item=>item.key.toLowerCase()===key||item.email===key||item.taxCode===key);
  if(!form||!client)return;
  const fields={receiverCompany:client.companyName,receiverTaxCode:client.taxCode,receiverFirstName:client.firstName,receiverLastName:client.lastName,receiverEmail:client.email,receiverPhone:client.phone,receiverStreet:client.address?.street,receiverBuilding:client.address?.buildingNumber,receiverFlat:client.address?.flatNumber,receiverPostCode:client.address?.postCode,receiverCity:client.address?.city};
  Object.entries(fields).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value||"";});
  toast("Dane stałego klienta uzupełnione ✅");
}
function inpostServiceStronaOsoby(form,prefix){
  return {companyName:form.elements[`${prefix}Company`]?.value||"",taxCode:form.elements[`${prefix}TaxCode`]?.value||"",firstName:form.elements[`${prefix}FirstName`]?.value||"",lastName:form.elements[`${prefix}LastName`]?.value||"",email:form.elements[`${prefix}Email`]?.value||"",phone:form.elements[`${prefix}Phone`]?.value||"",address:{street:form.elements[`${prefix}Street`]?.value||"",buildingNumber:form.elements[`${prefix}Building`]?.value||"",flatNumber:form.elements[`${prefix}Flat`]?.value||"",postCode:form.elements[`${prefix}PostCode`]?.value||"",city:form.elements[`${prefix}City`]?.value||""}};
}
function inpostServicePayload(form){
  const data=new FormData(form),additionalServices=[...form.querySelectorAll('[name="additionalServices"]:checked')].map(input=>input.value);
  return {requestId:inpostServiceStan.requestId||inpostServiceNowyRequestId(),reference:String(data.get("reference")||"").trim(),comments:String(data.get("comments")||"").trim(),sender:inpostServiceStronaOsoby(form,"sender"),receiver:inpostServiceStronaOsoby(form,"receiver"),saveSender:data.get("saveSender")==="on",saveReceiver:data.get("saveReceiver")==="on",deliveryType:data.get("deliveryType"),sendingMethod:data.get("sendingMethod"),targetPoint:data.get("targetPoint"),dropoffPoint:data.get("dropoffPoint"),parcel:{template:data.get("template"),length:data.get("length"),width:data.get("width"),height:data.get("height"),weight:data.get("weight"),nonStandard:data.get("nonStandard")==="on"},cod:{enabled:data.get("codEnabled")==="on",amount:data.get("codAmount")},insurance:{enabled:data.get("insuranceEnabled")==="on",amount:data.get("insuranceAmount")},weekend:data.get("weekend")==="on",additionalServices,pickupRequested:data.get("pickupRequested")==="on",billingMode:data.get("billingMode"),billingMonth:data.get("billingMonth"),commissionGross:data.get("commissionGross"),carrierCostOverride:data.get("carrierCostOverride")};
}
function inpostServiceBladPol(fields=[]){
  const first=Array.isArray(fields)?fields[0]:null;
  if(first?.message)toast(first.message);
}
async function inpostServiceUtworz(event){
  event.preventDefault();if(inpostServiceStan.saving)return;
  const form=event.currentTarget,payload=inpostServicePayload(form),button=form.querySelector('[type="submit"]');
  inpostServiceStan={...inpostServiceStan,saving:true};if(button){button.disabled=true;button.textContent="⏳ Tworzę przesyłkę…";}
  try{
    const d=await chmura("inpost-service-create",{method:"POST",body:payload,timeout:90000});
    if(d.item)inpostServiceStan.items=[d.item,...inpostServiceStan.items.filter(item=>item.id!==d.item.id)];
    inpostServiceNowyRequestId();await inpostServiceLaduj(true,true);
    toast(d.invoice?.error?`Przesyłka utworzona ✅ Faktura wymaga uwagi: ${d.invoice.error}`:`Przesyłka InPost utworzona ✅ ${d.item?.trackingNumber||"oczekuje na numer"}`);
    renderuj();
  }catch(e){if(e.code==="previous_attempt_failed")inpostServiceNowyRequestId();inpostServiceBladPol(e.details);toast("Nie utworzono przesyłki: "+(e.message||e));}
  finally{inpostServiceStan={...inpostServiceStan,saving:false};if(button){button.disabled=false;button.textContent="🟡 Utwórz przesyłkę InPost";}}
}
async function inpostServiceZapiszUstawienia(event){
  event.preventDefault();const form=event.currentTarget,body={commissionGross:form.commissionGross.value,sender:inpostServiceStronaOsoby(form,"sender")};
  try{const d=await chmura("inpost-service-settings",{method:"POST",body,timeout:20000});inpostServiceStan.settings=d.settings||inpostServiceStan.settings;toast("Domyślny nadawca i prowizja zapisane ✅");renderuj();}catch(e){toast("Nie zapisano ustawień: "+(e.message||e));}
}
async function inpostServicePobierzStatus(id){
  const current=inpostServiceStan.items.find(item=>item.id===id);if(!current)throw new Error("Nie znaleziono nadania");
  if(!current.inpostId)return current;
  const d=await chmura("inpost-service-status",{params:{id},timeout:30000});
  if(d.item)inpostServiceStan.items=inpostServiceStan.items.map(item=>item.id===id?d.item:item);
  return d.item||current;
}
async function inpostServiceStatus(id){
  try{await inpostServicePobierzStatus(id);toast("Status i historia InPost odświeżone ✅");renderuj();}catch(e){toast("Status InPost: "+(e.message||e));}
}
function inpostServiceStatusNazwa(status){
  const labels={created:"Przesyłka utworzona",confirmed:"Przesyłka potwierdzona",dispatched_by_sender:"Przekazana przez nadawcę",collected_from_sender:"Odebrana od nadawcy",taken_by_courier:"Odebrana przez kuriera",adopted_at_source_branch:"Przyjęta w oddziale nadawczym",sent_from_source_branch:"Wysłana z oddziału nadawczego",adopted_at_sorting_center:"Przyjęta w sortowni",sent_from_sorting_center:"Wysłana z sortowni",adopted_at_target_branch:"Przyjęta w oddziale docelowym",out_for_delivery:"Wydana do doręczenia",ready_to_pickup:"Gotowa do odbioru",pickup_reminder_sent:"Wysłano przypomnienie o odbiorze",delivered:"Doręczona",avizo:"Nieudana próba doręczenia",undelivered:"Nie doręczono",missing:"Przesyłka poszukiwana",returned_to_sender:"Zwrócona do nadawcy",cancelled:"Przesyłka anulowana"};
  const key=String(status||"").trim().toLowerCase();return labels[key]||key.replaceAll("_"," ")||"Oczekuje na pierwszy status";
}
function inpostServiceDataPotwierdzenia(value){
  if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleString("pl-PL",{dateStyle:"medium",timeStyle:"short"});
}
function inpostServiceAdresPotwierdzenia(person={}){
  const a=person.address||{},name=person.companyName||`${person.firstName||""} ${person.lastName||""}`.trim()||"—";
  const street=[a.street,[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/")].filter(Boolean).join(" ");
  return `<b>${esc(name)}</b>${street?`<span>${esc(street)}</span>`:""}<span>${esc([a.postCode||a.post_code,a.city].filter(Boolean).join(" "))}</span>${person.email?`<span>${esc(person.email)}</span>`:""}${person.phone?`<span>${esc(person.phone)}</span>`:""}`;
}
function inpostServicePotwierdzenieHTML(item={},warning=""){
  const company=typeof daneFirmy==="function"?daneFirmy():{},events=Array.isArray(item.trackingHistory)?item.trackingHistory:[],currentStatus=item.inpostStatus||item.status;
  const currentEvent=events[0],updated=item.trackingUpdatedAt||currentEvent?.occurredAt||item.updatedAt||item.createdAt;
  const trackingUrl=item.trackingNumber?`https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(item.trackingNumber)}`:"";
  const service=item.deliveryType==="locker"?`Paczkomat / PaczkoPunkt${item.targetPoint?` • ${item.targetPoint}`:""}`:"Kurier InPost";
  const parcel=item.parcel||{},size=parcel.template?String(parcel.template).toUpperCase():[parcel.length,parcel.width,parcel.height].filter(Boolean).join(" × ");
  const billing={none:"Bez faktury",single:"Faktura wystawiana od razu",monthly:"Rozliczenie na fakturze miesięcznej"}[item.billing?.mode]||"—";
  const timeline=events.length?events:(currentStatus||item.createdAt?[{status:currentStatus||"created",label:inpostServiceStatusNazwa(currentStatus||"created"),occurredAt:updated}]:[]);
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Potwierdzenie ${esc(item.reference||item.id||"nadania")}</title><style>
  :root{font-family:Inter,Arial,sans-serif;color:#172033;background:#eef2f7}*{box-sizing:border-box}body{margin:0;padding:28px}.sheet{max-width:900px;margin:auto;background:#fff;border:1px solid #dbe3ee;border-radius:22px;box-shadow:0 18px 55px #17203318;overflow:hidden}.head{display:flex;justify-content:space-between;gap:24px;padding:30px 34px;background:linear-gradient(135deg,#111827,#312e81);color:#fff}.brand{font-size:24px;font-weight:900}.head h1{margin:5px 0 0;font-size:26px}.head small{color:#dbeafe}.status{padding:22px 34px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.status b{display:block;font-size:24px;color:#166534}.status span{display:block;margin-top:5px;color:#64748b}.content{padding:28px 34px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}.meta div,.party,.parcel{padding:14px;border:1px solid #e2e8f0;border-radius:14px}.meta small,.party small,.parcel small{display:block;margin-bottom:6px;color:#64748b;font-weight:700}.meta b{font-size:15px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:14px}.party{display:grid;gap:3px}.party span{font-size:13px;color:#475569}.parcel{margin-top:14px}.timeline{margin:24px 0 0;padding:0;list-style:none}.timeline li{position:relative;margin-left:12px;padding:0 0 20px 28px;border-left:2px solid #cbd5e1}.timeline li:last-child{padding-bottom:0}.timeline li:before{content:"";position:absolute;left:-7px;top:2px;width:12px;height:12px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 4px #dbeafe}.timeline li:first-child:before{background:#16a34a;box-shadow:0 0 0 4px #dcfce7}.timeline b{display:block}.timeline span,.timeline small{display:block;margin-top:3px;color:#64748b}.track-link{display:inline-block;margin-top:16px;color:#1d4ed8;font-weight:800}.warning{margin:0 34px 20px;padding:12px 14px;border:1px solid #f59e0b;border-radius:12px;background:#fffbeb;color:#92400e}.foot{display:flex;justify-content:space-between;gap:20px;padding:20px 34px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}.actions{display:flex;justify-content:center;gap:10px;padding:20px}.actions button{padding:11px 18px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.actions button:last-child{background:#e2e8f0;color:#172033}@media(max-width:650px){body{padding:0}.sheet{border:0;border-radius:0}.head,.status,.content,.foot{padding-left:18px;padding-right:18px}.head,.foot{display:block}.meta,.parties{grid-template-columns:1fr}.foot span{display:block;margin-top:6px}}@media print{body{padding:0;background:#fff}.sheet{max-width:none;border:0;border-radius:0;box-shadow:none}.actions{display:none}.head{-webkit-print-color-adjust:exact;print-color-adjust:exact}.timeline li{break-inside:avoid}.warning{margin-left:34px;margin-right:34px}}</style></head><body><main class="sheet">
    <header class="head"><div><div class="brand">${esc(company.nazwa||"Artway‑TM")}</div><h1>Potwierdzenie nadania przesyłki</h1><small>Dokument informacyjny dla klienta</small></div><div><b>${esc(item.reference||item.id||"—")}</b><small>Wydruk: ${esc(inpostServiceDataPotwierdzenia(new Date().toISOString()))}</small></div></header>
    <section class="status"><b>${esc(currentEvent?.label||inpostServiceStatusNazwa(currentStatus))}</b><span>Stan potwierdzony na: ${esc(inpostServiceDataPotwierdzenia(updated))}</span></section>
    ${warning?`<div class="warning"><b>Nie udało się pobrać świeżego statusu.</b> Wydruk pokazuje ostatnie dane zapisane w systemie: ${esc(warning)}</div>`:""}
    <div class="content"><div class="meta"><div><small>Numer nadania</small><b>${esc(item.trackingNumber||"Oczekuje na nadanie numeru")}</b></div><div><small>Usługa</small><b>${esc(service)}</b></div><div><small>Rozliczenie</small><b>${esc(billing)}</b></div></div>
      <div class="parties"><section class="party"><small>Nadawca</small>${inpostServiceAdresPotwierdzenia(item.sender)}</section><section class="party"><small>Odbiorca</small>${inpostServiceAdresPotwierdzenia(item.receiver)}</section></div>
      <section class="parcel"><small>Dane przesyłki</small><b>${esc(size?`Gabaryt / wymiary: ${size}`:"Przesyłka InPost")}${parcel.weight?` • ${esc(parcel.weight)} kg`:""}</b>${item.cod?.enabled?`<span>Pobranie: ${esc(zl(item.cod.amount))}</span>`:""}${item.weekend?'<span>Paczka w Weekend</span>':""}</section>
      ${trackingUrl?`<a class="track-link" href="${trackingUrl}" target="_blank" rel="noopener">Sprawdź przesyłkę online w InPost →</a>`:""}
      <h2>Historia transportu</h2><ol class="timeline">${timeline.map(event=>`<li><b>${esc(event.label||inpostServiceStatusNazwa(event.status))}</b><span>${esc(inpostServiceDataPotwierdzenia(event.occurredAt))}${event.location?` • ${esc(event.location)}`:""}</span>${event.description?`<small>${esc(event.description)}</small>`:""}</li>`).join("")||"<li><b>Oczekuje na pierwsze zdarzenie przewoźnika</b></li>"}</ol>
    </div><footer class="foot"><span>${esc([company.nazwa,pelnyAdresFirmy?.(company)].filter(Boolean).join(" • "))}</span><span>Dokument nie jest fakturą ani paragonem.</span></footer>
  </main><div class="actions"><button onclick="window.print()">Drukuj / zapisz PDF</button><button onclick="window.close()">Zamknij</button></div></body></html>`;
}
async function inpostServicePotwierdzenie(id){
  const popup=window.open("","_blank","width=980,height=900");if(!popup)return toast("Przeglądarka zablokowała okno wydruku");
  popup.document.write('<!doctype html><html lang="pl"><meta charset="utf-8"><title>Przygotowanie potwierdzenia</title><body style="font-family:Arial;padding:40px"><h2>Odświeżam tracking InPost…</h2><p>Dokument otworzy się za chwilę.</p></body></html>');popup.document.close();
  let item=inpostServiceStan.items.find(row=>row.id===id),warning="";
  try{item=await inpostServicePobierzStatus(id);}catch(e){warning=e.message||String(e);}
  if(!item){popup.close();return toast("Nie znaleziono nadania");}
  popup.document.open();popup.document.write(inpostServicePotwierdzenieHTML(item,warning));popup.document.close();
  renderuj();
}
async function inpostServiceEtykieta(id,format="A6"){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item?.inpostId)return toast("Przesyłka nie ma jeszcze ID InPost");
  try{const d=await chmura("inpost-label",{params:{id:item.inpostId,type:format},timeout:30000}),url=URL.createObjectURL(b64toBlob(d.base64,"application/pdf"));window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){toast("Etykieta: "+(e.message||e));}
}
async function inpostServiceOdbior(id){
  try{const d=await chmura("inpost-service-pickup",{method:"POST",body:{id},timeout:45000});if(d.item)inpostServiceStan.items=inpostServiceStan.items.map(item=>item.id===id?d.item:item);toast(d.duplicatePrevented?"Odbiór kuriera jest już zlecony":"Odbiór kuriera zlecony ✅");renderuj();}catch(e){toast("Odbiór kuriera: "+(e.message||e));}
}
async function inpostServiceAnuluj(id){
  if(!confirm("Anulować tę przesyłkę w InPost? Operacja jest możliwa tylko przed jej potwierdzeniem."))return;
  try{const d=await chmura("inpost-service-cancel",{method:"POST",body:{id},timeout:30000});if(d.item)inpostServiceStan.items=inpostServiceStan.items.map(item=>item.id===id?d.item:item);toast("Przesyłka anulowana w InPost");renderuj();}catch(e){toast("Nie anulowano: "+(e.message||e));}
}
async function inpostServiceFaktura(id){
  try{const d=await chmura("inpost-service-bill",{method:"POST",body:{id},timeout:60000});toast(d.invoice?.duplicatePrevented?"Dokument inFakt już istnieje":"Szkic FV przekazany do inFakt ✅");await inpostServiceLaduj(true,true);renderuj();}catch(e){toast("Faktura inFakt: "+(e.message||e));}
}
async function inpostServiceFakturaMiesieczna(month,clientKey){
  try{const d=await chmura("inpost-service-bill",{method:"POST",body:{month,clientKey},timeout:60000});toast(d.invoice?.duplicatePrevented?"Miesięczny dokument już istnieje":`Przekazano ${d.count||0} nadań do jednej FV inFakt ✅`);await inpostServiceLaduj(true,true);renderuj();}catch(e){toast("Faktura miesięczna: "+(e.message||e));}
}
function inpostServiceOtworzMape(){
  window.__geoTarget="inpost-service";otworzGeowidget();
}
async function inpostServiceSzukajPunktow(){
  const query=String(document.getElementById("inpostServicePointSearch")?.value||"").trim(),box=document.getElementById("inpostServicePointResults");
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  if(box)box.innerHTML="<small>Szukam punktów InPost…</small>";
  try{const params={limit:10,...(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query})},d=await chmura("inpost-points",{params,timeout:15000});if(box)box.innerHTML=(d.points||[]).map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))})"><b>${esc(point.name)}</b><span>${esc(opisPunktuInpost(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów.</small>";}catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
function inpostServiceWybierzPunkt(code,address=""){
  const input=document.getElementById("inpostServiceTargetPoint"),label=document.getElementById("inpostServiceTargetPointLabel");if(input)input.value=String(code||"").toUpperCase();if(label)label.textContent=address||code;toast("Wybrano "+code);
}
function inpostServiceLista(){
  const q=normalizujSzukanyTekst(inpostServiceSzukaj),terms=q.split(" ").filter(Boolean);
  return (inpostServiceStan.items||[]).filter(item=>{
    const text=normalizujSzukanyTekst([item.id,item.reference,item.trackingNumber,item.inpostStatus,item.receiver?.companyName,item.receiver?.firstName,item.receiver?.lastName,item.receiver?.email,item.receiver?.taxCode,item.targetPoint].join(" "));
    if(terms.some(term=>!text.includes(term)))return false;
    if(inpostServiceFiltr!=="wszystkie"&&String(item.status)!==inpostServiceFiltr)return false;
    if(inpostServiceBillingFiltr==="oczekuje"&&item.billing?.status!=="pending")return false;
    if(inpostServiceBillingFiltr==="rozliczone"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status)))return false;
    if(inpostServiceBillingFiltr==="bez"&&item.billing?.mode!=="none")return false;
    return true;
  });
}
function inpostServiceStatusLabel(item){
  if(item.status==="cancelled")return '<span class="lvl lvl-blad">anulowana</span>';
  if(item.status==="error")return '<span class="lvl lvl-blad">błąd</span>';
  if(item.labelReady)return '<span class="lvl lvl-ok">etykieta gotowa</span>';
  return `<span class="lvl lvl-info">${esc(item.inpostStatus||item.status||"utworzona")}</span>`;
}
function inpostServiceBillingLabel(item){
  const link=item.billing?.link,status=link?.status||item.billing?.status;
  if(item.billing?.mode==="none")return '<span class="lvl">bez faktury</span>';
  if(status==="created")return `<span class="lvl lvl-ok">FV ${esc(link?.invoiceNumber||"wystawiona")}</span>`;
  if(status==="processing")return '<span class="lvl lvl-info">inFakt przetwarza</span>';
  if(status==="pending")return '<span class="lvl lvl-ostrzezenie">do FV miesięcznej</span>';
  if(status==="error")return '<span class="lvl lvl-blad">błąd inFakt</span>';
  return '<span class="lvl lvl-ostrzezenie">do rozliczenia</span>';
}
function inpostServiceHistoriaHTML(){
  const rows=inpostServiceLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(inpostServiceSzukaj)}" placeholder="Numer nadania, klient, NIP, e-mail, punkt lub referencja…" oninput="inpostServiceSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="inpostServiceFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie statusy</option>${[["label_ready","Etykieta gotowa"],["created","Utworzone"],["error","Błędy"],["cancelled","Anulowane"]].map(([v,l])=>`<option value="${v}" ${inpostServiceFiltr===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Rozliczenie<select onchange="inpostServiceBillingFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie rozliczenia</option><option value="oczekuje" ${inpostServiceBillingFiltr==="oczekuje"?"selected":""}>Do FV miesięcznej</option><option value="rozliczone" ${inpostServiceBillingFiltr==="rozliczone"?"selected":""}>Przekazane do inFakt</option><option value="bez" ${inpostServiceBillingFiltr==="bez"?"selected":""}>Bez faktury</option></select></label><button class="btn ghost" onclick="inpostServiceSzukaj='';inpostServiceFiltr='wszystkie';inpostServiceBillingFiltr='wszystkie';renderuj()">Wyczyść</button>`;
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr operacyjny</span><h2>Nadania i rozliczenia</h2><p class="order-detail-lead">Tracking, etykieta, zlecenie odbioru i faktura tworzą jeden ślad operacyjny. Koszt umowny przewoźnika nie jest wyświetlany.</p></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Filtry działają po danych nadania i rozliczenia klienta.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table"><thead><tr><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Status</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(item=>`<tr data-stable-key="${esc(item.id)}"><td><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td><td><b>${esc(item.receiver?.companyName||`${item.receiver?.firstName||""} ${item.receiver?.lastName||""}`.trim()||"Klient")}</b><br><small>${esc(item.receiver?.email||"")}${item.receiver?.taxCode?` • NIP ${esc(item.receiver.taxCode)}`:""}</small></td><td>${item.deliveryType==="locker"?"📮 Paczkomat / punkt":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Paczka w Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td><td>${inpostServiceStatusLabel(item)}<br><small>${esc(item.inpostStatus||"")}</small>${item.pickup?.id?`<br><span class="lvl lvl-ok">odbiór kuriera ${esc(item.pickup.status||"")}</span>`:""}</td><td>${inpostServiceBillingLabel(item)}<br><small>prowizja ${zl(item.billing?.commissionGross||0)}</small>${item.billing?.error?`<br><small class="error">${esc(item.billing.error)}</small>`:""}</td><td><div class="inpost-row-actions"><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.pickupRequested&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">Odbiór kuriera</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="6">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function inpostServiceMiesieczneHTML(){
  const groups=inpostServiceStan.billing?.groups||[];if(!groups.length)return "";
  return `<section class="panel inpost-monthly-billing"><div class="order-section-head"><div><span class="order-pro-label">Stałe firmy</span><h2>FV miesięczne do przygotowania</h2><p class="order-detail-lead">Jedna faktura grupuje prowizję za wszystkie nierozliczone nadania firmy w danym miesiącu.</p></div><a class="btn ghost" href="#/admin/infakt/wysylki">Otwórz w inFakt</a></div><div class="inpost-monthly-grid">${groups.map(group=>`<article><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small></div><strong>${zl(group.commissionGross)}</strong><button class="btn" onclick="inpostServiceFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz jedną FV</button></article>`).join("")}</div></section>`;
}
function inpostServiceOsobaFields(prefix,title,person={},withNip=false){
  const a=person.address||{};
  return `<fieldset class="inpost-party-card"><legend>${esc(title)}</legend><div class="inpost-form-grid"><label>Firma${withNip?" / stały klient":""}<input name="${prefix}Company" value="${esc(person.companyName||"")}"></label>${withNip?`<label>NIP<input name="${prefix}TaxCode" inputmode="numeric" maxlength="10" value="${esc(person.taxCode||"")}"></label>`:""}<label>Imię<input name="${prefix}FirstName" value="${esc(person.firstName||"")}"></label><label>Nazwisko<input name="${prefix}LastName" value="${esc(person.lastName||"")}"></label><label>E-mail *<input name="${prefix}Email" type="email" required value="${esc(person.email||"")}"></label><label>Telefon *<input name="${prefix}Phone" inputmode="tel" required value="${esc(person.phone||"")}"></label><label class="wide">Ulica *<input name="${prefix}Street" required value="${esc(a.street||"")}"></label><label>Nr budynku *<input name="${prefix}Building" required value="${esc(a.buildingNumber||a.building_number||"")}"></label><label>Nr lokalu<input name="${prefix}Flat" value="${esc(a.flatNumber||a.flat_number||"")}"></label><label>Kod pocztowy *<input name="${prefix}PostCode" required pattern="\\d{2}-?\\d{3}" value="${esc(a.postCode||a.post_code||"")}"></label><label>Miasto *<input name="${prefix}City" required value="${esc(a.city||"")}"></label></div></fieldset>`;
}
function inpostServiceFormHTML(){
  const sender=inpostServiceNadawca(),clients=inpostServiceKlienci(),fee=Number(inpostServiceStan.settings?.commissionGross??4),month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability;
  return `<section class="panel inpost-service-create"><div class="order-section-head"><div><span class="order-pro-label">Umowa InPost • ShipX</span><h2>Utwórz przesyłkę</h2><p class="order-detail-lead">Wpisz nadawcę i odbiorcę, wybierz usługę oraz opcje dodatkowe. System zapisze numer, etykietę, tracking i rozliczenie prowizji.</p></div><div class="diag-actions"><span class="lvl ${available?.locker?"lvl-ok":"lvl-ostrzezenie"}">Paczkomat ${available?.locker?"aktywny":"do sprawdzenia"}</span><span class="lvl ${available?.courier?"lvl-ok":"lvl-ostrzezenie"}">Kurier ${available?.courier?"aktywny":"do sprawdzenia"}</span></div></div><form id="inpostServiceForm" onsubmit="inpostServiceUtworz(event)"><input type="hidden" name="requestId" value="${esc(inpostServiceStan.requestId||inpostServiceNowyRequestId())}"><div class="inpost-form-top"><label>Referencja / numer klienta<input name="reference" required value="USL-${Date.now().toString(36).toUpperCase()}"></label><label>Stały klient / firma<input list="inpostServiceClients" placeholder="Wpisz e-mail lub NIP i wybierz" onchange="inpostServiceWypelnijKlienta(this)"><datalist id="inpostServiceClients">${clients.map(client=>`<option value="${esc(client.key)}">${esc(client.companyName||`${client.firstName} ${client.lastName}`.trim()||client.email)} • ${esc(client.email||client.taxCode)}</option>`).join("")}</datalist></label></div><div class="inpost-parties-grid">${inpostServiceOsobaFields("sender","Nadawca",sender,false)}${inpostServiceOsobaFields("receiver","Odbiorca",{},true)}</div><div class="inpost-options-layout"><fieldset><legend>Usługa i nadanie</legend><div class="inpost-form-grid"><label>Rodzaj dostawy<select name="deliveryType" onchange="inpostServiceUstawTyp(this.form)"><option value="locker">Paczkomat / PaczkoPunkt InPost</option><option value="courier">Kurier InPost</option></select></label><label>Sposób nadania<select name="sendingMethod" onchange="inpostServiceUstawTyp(this.form)"><option value="parcel_locker">Nadanie w Paczkomacie</option><option value="any_point">Dowolny punkt InPost</option><option value="pok">Punkt Obsługi Klienta</option><option value="pop">Punkt Obsługi Przesyłek</option><option value="branch">Oddział InPost</option><option value="dispatch_order">Odbiór przez kuriera</option></select></label><div class="wide" data-inpost-only="locker"><label>Paczkomat / punkt odbiorcy *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" placeholder="np. BOJ01N"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape()">Mapa</button></div><small id="inpostServiceTargetPointLabel">Wybierz punkt na mapie, z wyszukiwarki albo wpisz kod.</small></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod pocztowy lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow()">Szukaj</button></div><div id="inpostServicePointResults"></div></div><label>Punkt nadania (opcjonalnie)<input name="dropoffPoint" placeholder="kod punktu, jeśli wybrano konkretny"></label><label class="check" data-inpost-only="courier"><input type="checkbox" name="pickupRequested"> Zleć odbiór przez kuriera po potwierdzeniu</label></div></fieldset><fieldset><legend>Paczka i usługi dodatkowe</legend><div class="inpost-form-grid"><label>Gabaryt<select name="template"><option value="small">A / small</option><option value="medium">B / medium</option><option value="large">C / large</option><option value="">Wymiary własne</option></select></label><label>Waga (kg)<input name="weight" type="number" min=".01" max="50" step=".01" value="1"></label><label>Długość (cm)<input name="length" type="number" min="1" step=".1" value="30"></label><label>Szerokość (cm)<input name="width" type="number" min="1" step=".1" value="20"></label><label>Wysokość (cm)<input name="height" type="number" min="1" step=".1" value="15"></label><label class="check"><input type="checkbox" name="nonStandard"> Element niestandardowy</label><label class="check wide"><input type="checkbox" name="codEnabled"> Pobranie <input name="codAmount" type="number" min="0" step=".01" placeholder="kwota PLN"></label><label class="check wide"><input type="checkbox" name="insuranceEnabled"> Dodatkowa ochrona <input name="insuranceAmount" type="number" min="0" step=".01" placeholder="wartość PLN"></label><label class="check" data-inpost-only="locker"><input type="checkbox" name="weekend"> Paczka w Weekend</label><label class="check" data-inpost-only="locker"><input type="checkbox" name="additionalServices" value="labelless"> Nadanie bez etykiety</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="sms"> Powiadomienie SMS</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="email"> Powiadomienie e-mail</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="saturday"> Doręczenie w sobotę</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="dor1720"> Doręczenie 17:00–20:00</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label><label class="wide">Uwagi do przesyłki<input name="comments" maxlength="100"></label></div></fieldset><fieldset class="inpost-billing-card"><legend>Rozliczenie klienta</legend><div class="inpost-form-grid"><label>Sposób rozliczenia<select name="billingMode"><option value="none">Bez faktury</option><option value="single">FV od razu po nadaniu</option><option value="monthly">Dopisz do FV miesięcznej</option></select></label><label>Miesiąc rozliczenia<input name="billingMonth" type="month" value="${esc(month)}"></label><label>Prowizja za nadanie<input name="commissionGross" type="number" min="0" step=".01" value="${esc(fee)}" oninput="inpostServicePrzelicz(this.form)"></label><div class="inpost-fee-summary"><small>Do rozliczenia za tę usługę</small><strong data-inpost-commission-total>${zl(fee)}</strong></div></div><div class="backend-note"><b>Koszt umowny InPost jest ukryty.</b> Panel i odpowiedź API pokazują wyłącznie prowizję Artway-TM. Dla FV miesięcznej każda przesyłka trafia do jednej paczki rozliczeniowej klienta.</div></fieldset></div><div class="inpost-create-footer"><button class="btn" type="submit">🟡 Utwórz przesyłkę InPost</button><small>Jedno kliknięcie rezerwuje operację — ponowne kliknięcie nie utworzy duplikatu.</small></div></form></section>`;
}
function panelWysylkiUslugowejInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram konfigurację InPost i rejestr nadań…</div></div>';
  setTimeout(()=>inpostServiceUstawTyp(document.getElementById("inpostServiceForm")),0);
  const billing=inpostServiceStan.billing||{};
  return `<div class="inpost-service-workspace"><section class="inpost-service-stats"><article><span>📦</span><b>${inpostServiceStan.items.length}</b><small>nadań usługowych</small></article><article><span>🧾</span><b>${billing.pendingMonthly||0}</b><small>do FV miesięcznej</small></article><article><span>💰</span><b>${zl(billing.commissionPendingGross||0)}</b><small>prowizji oczekującej</small></article><article><span>🔐</span><b>ukryty</b><small>koszt umowny InPost</small></article></section>${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceFormHTML()}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}<details class="panel inpost-service-settings"><summary>⚙️ Domyślny nadawca i prowizja</summary><form onsubmit="inpostServiceZapiszUstawienia(event)">${inpostServiceOsobaFields("sender","Stałe dane nadawcy",inpostServiceNadawca(),false)}<div class="inpost-settings-footer"><label>Domyślna prowizja brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(inpostServiceStan.settings?.commissionGross??4)}"></label><button class="btn" type="submit">Zapisz ustawienia</button><a class="btn ghost" href="#/admin/infakt/wysylki">Rozliczenia inFakt</a></div></form></details></div>`;
}

let inpostServiceWycenaTimer=0;

function inpostServiceAdresKsiazki(contact={}){
  const a=contact.address||{};
  return [a.street,[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/"),a.postCode||a.post_code,a.city].filter(Boolean).join(" ");
}
function inpostServiceNazwaKontaktu(contact={}){
  return contact.label||contact.companyName||`${contact.firstName||""} ${contact.lastName||""}`.trim()||contact.email||contact.phone||"Zapisany adres";
}
function inpostServiceAdresy(){
  const saved=(inpostServiceStan.addressBook||[]).map(contact=>({...contact,key:contact.id,stored:true}));
  const known=inpostServiceKlienci().map(contact=>({...contact,key:`client:${contact.key}`,stored:false,roles:["receiver"]}));
  const map=new Map();
  [...saved,...known].forEach(contact=>{
    const fingerprint=[contact.taxCode,contact.email,contact.phone,inpostServiceAdresKsiazki(contact)].map(value=>String(value||"").trim().toLowerCase()).join("|");
    if(!fingerprint.replace(/\|/g,""))return;
    const existing=map.get(fingerprint);
    if(!existing||contact.stored)map.set(fingerprint,contact);
  });
  return [...map.values()].sort((a,b)=>Number(b.stored)-Number(a.stored)||inpostServiceNazwaKontaktu(a).localeCompare(inpostServiceNazwaKontaktu(b),"pl"));
}
function inpostServiceOpcjeAdresow(selected="",role="receiver"){
  const options=inpostServiceAdresy().map(contact=>{
    const roleLabel=(contact.roles||[]).includes("sender")&&(contact.roles||[]).includes("receiver")?"nadawca i odbiorca":(contact.roles||[]).includes("sender")?"nadawca":"odbiorca";
    const label=`${inpostServiceNazwaKontaktu(contact)} • ${inpostServiceAdresKsiazki(contact)||contact.email||contact.phone} • ${roleLabel}`;
    return `<option value="${esc(contact.key)}" ${String(selected)===String(contact.key)?"selected":""}>${esc(label)}</option>`;
  }).join("");
  return `<option value="">— Nowy adres ${role==="sender"?"nadawcy":"odbiorcy"} —</option>${options}`;
}
function inpostServiceUstawPolaOsoby(form,prefix,contact={}){
  const address=contact.address||{},fields={
    [`${prefix}Company`]:contact.companyName,[`${prefix}TaxCode`]:contact.taxCode,
    [`${prefix}FirstName`]:contact.firstName,[`${prefix}LastName`]:contact.lastName,
    [`${prefix}Email`]:contact.email,[`${prefix}Phone`]:contact.phone,
    [`${prefix}Street`]:address.street,[`${prefix}Building`]:address.buildingNumber||address.building_number,
    [`${prefix}Flat`]:address.flatNumber||address.flat_number,
    [`${prefix}PostCode`]:address.postCode||address.post_code,[`${prefix}City`]:address.city,
  };
  Object.entries(fields).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value||"";});
}
function inpostServiceWybierzAdres(select,prefix){
  const form=select?.form,contact=inpostServiceAdresy().find(item=>String(item.key)===String(select.value));
  if(!form)return;
  const hidden=form.elements[`${prefix}ContactId`];
  if(hidden)hidden.value=contact?.stored?contact.id:"";
  if(contact){
    inpostServiceUstawPolaOsoby(form,prefix,contact);
    toast(`Uzupełniono zapisany adres ${prefix==="sender"?"nadawcy":"odbiorcy"} ✅`);
  }else{
    inpostServiceUstawPolaOsoby(form,prefix,{});
  }
  inpostServiceZaplanujWycene(form);
}
function inpostServiceOdswiezSelektory(form,selectedId=""){
  ["sender","receiver"].forEach(prefix=>{
    const select=form?.elements[`${prefix}AddressChoice`];
    if(!select)return;
    const current=prefix===form.dataset.lastSavedRole&&selectedId?selectedId:select.value;
    select.innerHTML=inpostServiceOpcjeAdresow(current,prefix);
    if([...select.options].some(option=>option.value===current))select.value=current;
  });
}
async function inpostServiceZapiszKontakt(prefix,button=null){
  const form=button?.closest("form")||document.getElementById("inpostServiceForm");if(!form)return;
  const contact=inpostServiceStronaOsoby(form,prefix),id=form.elements[`${prefix}ContactId`]?.value||"";
  contact.id=id;contact.label=contact.companyName||`${contact.firstName} ${contact.lastName}`.trim()||contact.email;
  try{
    const d=await chmura("inpost-service-contact-save",{method:"POST",body:{role:prefix,contact},timeout:20000});
    inpostServiceStan.addressBook=Array.isArray(d.addressBook)?d.addressBook:inpostServiceStan.addressBook;
    form.dataset.lastSavedRole=prefix;
    if(form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value=d.contact?.id||id;
    inpostServiceOdswiezSelektory(form,d.contact?.id||id);
    toast(id?"Zaktualizowano adres w książce ✅":"Adres zapisany w książce ✅");
  }catch(e){toast("Książka adresowa: "+(e.message||e));}
}
async function inpostServiceUsunKontakt(prefix,button=null){
  const form=button?.closest("form")||document.getElementById("inpostServiceForm"),id=form?.elements[`${prefix}ContactId`]?.value||"";
  if(!id)return toast("Ten adres nie jest jeszcze zapisany w książce");
  if(!confirm("Usunąć wybrany adres z książki? Historia przesyłek pozostanie bez zmian."))return;
  try{
    const d=await chmura("inpost-service-contact-delete",{method:"POST",body:{id},timeout:20000});
    inpostServiceStan.addressBook=Array.isArray(d.addressBook)?d.addressBook:[];
    form.elements[`${prefix}ContactId`].value="";
    form.elements[`${prefix}AddressChoice`].value="";
    inpostServiceOdswiezSelektory(form);
    toast("Adres usunięty z książki");
  }catch(e){toast("Nie usunięto adresu: "+(e.message||e));}
}
function inpostServiceMozeWycenic(payload){
  const people=[payload.sender,payload.receiver];
  if(people.some(person=>!person?.email||String(person.phone||"").replace(/\D/g,"").length<9))return false;
  const senderAddress=payload.sender?.address||{};
  if(!senderAddress.street||!senderAddress.buildingNumber||!senderAddress.postCode||!senderAddress.city)return false;
  if(payload.deliveryType==="locker"&&!payload.targetPoint)return false;
  if(payload.deliveryType==="courier"){
    const address=payload.receiver?.address||{};
    if(!address.street||!address.buildingNumber||!address.postCode||!address.city)return false;
  }
  return true;
}
function inpostServiceWycenaKwota(pricing={}){
  return Number.isFinite(Number(pricing.totalGross))?Number(pricing.totalGross):null;
}
function inpostServiceAktualizujWyceneUI(form,pricing=inpostServiceStan.pricing){
  const box=form?.querySelector("[data-inpost-pricing]");if(!box)return;
  if(!pricing){
    box.innerHTML='<div class="inpost-price-empty"><b>Uzupełnij dane paczki i adresy</b><small>Koszt zostanie sprawdzony automatycznie w InPost.</small></div>';
    return;
  }
  if(pricing.loading){
    box.innerHTML='<div class="inpost-price-empty"><b>Sprawdzam koszt w ShipX…</b><small>Wycena nie tworzy przesyłki.</small></div>';
    return;
  }
  const total=inpostServiceWycenaKwota(pricing),fee=Math.max(0,Number(form?.commissionGross?.value||pricing.commissionGross||0)||0);
  if(total==null){
    box.innerHTML=`<div class="inpost-price-empty warning"><b>Brak pasującej stawki w cenniku umownym</b><small>${esc(pricing.message||"Uzupełnij właściwą stawkę w cenniku albo podaj pełny koszt ręcznie. ShipX pozostaje wyłącznie kontrolą porównawczą.")}</small></div>`;
    return;
  }
  const customer=Math.round((total+fee)*100)/100,b=pricing.breakdown||{},source=pricing.source==="manual"?"pełny koszt wpisany ręcznie":"Twój cennik umowny";
  const api=pricing.apiComparison||{},difference=Number.isFinite(Number(api.differenceGross))?Number(api.differenceGross):null;
  box.innerHTML=`<div class="inpost-price-main"><span><small>Koszt nadania</small><strong>${zl(total)}</strong></span><span><small>Prowizja Artway-TM</small><strong>${zl(fee)}</strong></span><span class="total"><small>Kwota na FV klienta</small><strong>${zl(customer)}</strong></span></div>
    <div class="inpost-price-meta"><span class="lvl ${pricing.complete?"lvl-ok":"lvl-ostrzezenie"}">${esc(source)}</span><small>${esc(pricing.rateLabel||"stawka indywidualna")}</small>${Number(b.extrasGross)>0?`<small>Dopłaty: ${zl(b.extrasGross)}</small>`:""}<small>Opłata paliwowa: w cenie</small></div>
    ${pricing.complete?"":`<div class="inpost-price-warning"><b>Niepełna wycena opcji dodatkowych:</b> ${esc((pricing.unpricedOptions||[]).join(", ")||"brak stawki")}. Uzupełnij dopłaty w cenniku albo wpisz pełny koszt ręcznie — do tego czasu FV jest zablokowana.</div>`}
    <div class="inpost-api-comparison"><span><b>Kontrola ShipX API:</b> ${api.totalGross==null?"konto nie zwróciło ceny":zl(api.totalGross)}</span>${difference==null?"":`<span>Różnica względem umowy: ${difference>0?"+":""}${zl(difference)}</span>`}<small>API jest kontrolą, nie źródłem ceny na fakturze.</small></div>
    <div class="inpost-subscription-note">Abonament ${zl(pricing.subscription?.gross??369)} / miesiąc jest kosztem stałym Artway‑TM i nie jest doliczany do pojedynczego nadania klienta.</div>`;
}
function inpostServiceLokalnaWycena(form){
  const list=inpostServiceStan.settings?.priceList||{},type=String(form?.deliveryType?.value||"locker"),weight=Number(form?.weight?.value)||0,template=String(form?.template?.value||"");
  let rate=null,rateKey="";
  if(type==="locker"){
    let size=template;
    if(!size){
      const dimensions=[form?.length?.value,form?.width?.value,form?.height?.value].map(Number).sort((a,b)=>b-a);
      if(dimensions[0]<=64&&dimensions[1]<=38){if(dimensions[2]<=8)size="small";else if(dimensions[2]<=19)size="medium";else if(dimensions[2]<=41)size="large";}
    }
    rate=list.locker?.[size]||null;rateKey=size?`locker.${size}`:"";
  }else{
    rate=(list.courierStandard||[]).find(item=>weight<=Number(item.maxKg))||null;rateKey=rate?`courierStandard.${rate.maxKg}`:"";
  }
  const selected=[],extras=list.extras||{};
  if(form?.codEnabled?.checked)selected.push(["Pobranie","codGross"]);
  if(form?.insuranceEnabled?.checked)selected.push(["Dodatkowa ochrona","insuranceGross"]);
  if(form?.weekend?.checked)selected.push(["Paczka w Weekend","weekendGross"]);
  if(form?.pickupRequested?.checked||form?.sendingMethod?.value==="dispatch_order")selected.push(["Odbiór przez kuriera","pickupGross"]);
  if(form?.nonStandard?.checked)selected.push(["Element niestandardowy","nonStandardGross"]);
  form?.querySelectorAll('[name="additionalServices"]:checked').forEach(input=>{const labels={sms:["Powiadomienie SMS","smsGross"],email:["Powiadomienie e-mail","emailGross"],saturday:["Doręczenie w sobotę","saturdayGross"],dor1720:["Doręczenie 17:00–20:00","dor1720Gross"],rod:["Zwrot dokumentów","rodGross"]};if(labels[input.value])selected.push(labels[input.value]);});
  const unpricedOptions=selected.filter(([,key])=>extras[key]==null||extras[key]==="").map(([label])=>label),extrasGross=selected.reduce((sum,[,key])=>sum+(extras[key]==null||extras[key]===""?0:Number(extras[key])||0),0);
  const totalGross=rate?Math.round((Number(rate.gross||0)+extrasGross)*100)/100:null,fee=Math.max(0,Number(String(form?.commissionGross?.value||0).replace(",","."))||0);
  return {totalGross,currency:"PLN",source:rate?"contract_price_list":"unavailable",available:totalGross!=null,complete:totalGross!=null&&unpricedOptions.length===0,rateKey,rateLabel:rate?.label||"",contractNet:rate?.net??null,commissionGross:fee,customerTotalGross:totalGross==null?null:Math.round((totalGross+fee)*100)/100,breakdown:{baseGross:rate?.gross??null,extrasGross:Math.round(extrasGross*100)/100,fuelIncluded:true},unpricedOptions,apiComparison:inpostServiceStan.pricing?.apiComparison||{totalGross:null},subscription:{net:list.subscriptionNet??300,gross:list.subscriptionGross??369,settlementPeriod:"monthly",includedInShipment:false},priceListLabel:list.label||"Cennik umowny",checkedAt:new Date().toISOString()};
}
function inpostServicePrzelicz(form){
  const manual=Math.max(0,Number(String(form?.carrierCostOverride?.value||"").replace(",","."))||0),fee=Math.max(0,Number(String(form?.commissionGross?.value||0).replace(",","."))||0);
  if(manual>0)inpostServiceStan.pricing={totalGross:manual,commissionGross:fee,customerTotalGross:Math.round((manual+fee)*100)/100,currency:"PLN",source:"manual",estimated:false,available:true,complete:true,breakdown:{},unpricedOptions:[],apiComparison:{totalGross:null},subscription:{gross:inpostServiceStan.settings?.priceList?.subscriptionGross??369,includedInShipment:false}};
  else inpostServiceStan.pricing=inpostServiceLokalnaWycena(form);
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceZaplanujWycene(form){
  clearTimeout(inpostServiceWycenaTimer);
  inpostServicePrzelicz(form);
  inpostServiceWycenaTimer=setTimeout(()=>inpostServiceWycena(form,false),650);
}
async function inpostServiceWycena(form=document.getElementById("inpostServiceForm"),force=true){
  if(!form)return;
  const payload=inpostServicePayload(form);
  if(!inpostServiceMozeWycenic(payload)){
    if(force)toast("Uzupełnij adresy, kontakt i sposób dostawy, aby sprawdzić koszt");
    inpostServicePrzelicz(form);return;
  }
  inpostServiceStan.pricing={loading:true};inpostServiceAktualizujWyceneUI(form);
  try{
    const d=await chmura("inpost-service-quote",{method:"POST",body:payload,timeout:30000});
    inpostServiceStan.pricing=d.pricing||null;
  }catch(e){
    if(e.code==="inpost_quote_validation")inpostServiceStan.pricing=null;
    else inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||String(e),source:"unavailable"};
  }
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceUstawTyp(form){
  const type=String(form?.deliveryType?.value||"locker");
  form?.querySelectorAll("[data-inpost-only]").forEach(el=>el.hidden=!String(el.dataset.inpostOnly||"").split(",").includes(type));
  if(type==="locker"&&form?.sendingMethod?.value==="dispatch_order")form.sendingMethod.value="parcel_locker";
  form?.querySelectorAll('[data-receiver-address]').forEach(input=>input.required=type==="courier");
  inpostServiceZaplanujWycene(form);
}
function inpostServiceOsobaFields(prefix,title,person={}){
  const a=person.address||{},selected=person.id||"";
  return `<fieldset class="inpost-party-card">
    <legend>${prefix==="sender"?"📤":"📥"} ${esc(title)}</legend>
    <div class="inpost-address-picker">
      <label>Wybierz z książki adresowej
        <select name="${prefix}AddressChoice" onchange="inpostServiceWybierzAdres(this,${jsArg(prefix)})">${inpostServiceOpcjeAdresow(selected,prefix)}</select>
      </label>
      <input type="hidden" name="${prefix}ContactId" value="${esc(selected)}">
      <div class="inpost-address-actions">
        <button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt(${jsArg(prefix)},this)">💾 Zapisz adres</button>
        <button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt(${jsArg(prefix)},this)">Usuń zapis</button>
      </div>
    </div>
    <div class="inpost-form-grid">
      <label>Firma<input name="${prefix}Company" value="${esc(person.companyName||"")}"></label>
      <label>NIP<input name="${prefix}TaxCode" inputmode="numeric" maxlength="10" value="${esc(person.taxCode||"")}"></label>
      <label>Imię<input name="${prefix}FirstName" value="${esc(person.firstName||"")}"></label>
      <label>Nazwisko<input name="${prefix}LastName" value="${esc(person.lastName||"")}"></label>
      <label>E-mail *<input name="${prefix}Email" type="email" required value="${esc(person.email||"")}"></label>
      <label>Telefon *<input name="${prefix}Phone" inputmode="tel" required value="${esc(person.phone||"")}"></label>
      <label class="wide">Ulica ${prefix==="sender"?"*":""}<input name="${prefix}Street" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.street||"")}"></label>
      <label>Nr budynku ${prefix==="sender"?"*":""}<input name="${prefix}Building" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.buildingNumber||a.building_number||"")}"></label>
      <label>Nr lokalu<input name="${prefix}Flat" value="${esc(a.flatNumber||a.flat_number||"")}"></label>
      <label>Kod pocztowy ${prefix==="sender"?"*":""}<input name="${prefix}PostCode" ${prefix==="sender"?"required":"data-receiver-address"} pattern="\\d{2}-?\\d{3}" value="${esc(a.postCode||a.post_code||"")}"></label>
      <label>Miasto ${prefix==="sender"?"*":""}<input name="${prefix}City" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.city||"")}"></label>
      <label class="check wide"><input type="checkbox" name="save${prefix==="sender"?"Sender":"Receiver"}" checked> Zapamiętaj lub zaktualizuj ten adres po utworzeniu przesyłki</label>
    </div>
  </fieldset>`;
}
function inpostServiceCennikWiersze(title,prefix,rates={}){
  return `<tr class="inpost-rate-section"><th colspan="3">${esc(title)}</th></tr>${Object.entries(rates).map(([key,rate])=>`<tr><td>${esc(rate.label||key)}</td><td><label><span class="sr-only">Netto ${esc(rate.label||key)}</span><input name="price_${prefix}_${key}_net" type="number" min="0" step=".01" value="${esc(rate.net??0)}"></label></td><td><label><span class="sr-only">Brutto ${esc(rate.label||key)}</span><input name="price_${prefix}_${key}_gross" type="number" min="0" step=".01" value="${esc(rate.gross??0)}"></label></td></tr>`).join("")}`;
}
function inpostServiceCennikHTML(){
  const list=inpostServiceStan.settings?.priceList||{},courier=Array.isArray(list.courierStandard)?list.courierStandard:[];
  const extras=[["codGross","Pobranie"],["insuranceGross","Dodatkowa ochrona"],["weekendGross","Paczka w Weekend"],["pickupGross","Odbiór przez kuriera"],["smsGross","SMS"],["emailGross","E-mail"],["saturdayGross","Doręczenie w sobotę"],["dor1720Gross","Doręczenie 17:00–20:00"],["rodGross","Zwrot dokumentów"],["nonStandardGross","Element niestandardowy"]];
  return `<section class="inpost-contract-editor">
    <div class="order-section-head"><div><span class="order-pro-label">Źródło cen na fakturach</span><h3>Twój cennik umowny InPost</h3><p class="order-detail-lead">Stawki brutto z tej tabeli są nadrzędne. ShipX służy tylko do kontroli różnicy.</p></div><span class="lvl lvl-ok">aktywny cennik umowy</span></div>
    <div class="inpost-contract-meta"><label>Nazwa cennika<input name="priceListLabel" value="${esc(list.label||"Umowa abonamentowa InPost")}"></label><label>Abonament netto<input name="subscriptionNet" type="number" min="0" step=".01" value="${esc(list.subscriptionNet??300)}"></label><label>Abonament brutto<input name="subscriptionGross" type="number" min="0" step=".01" value="${esc(list.subscriptionGross??369)}"></label><label>Termin płatności (dni)<input name="paymentDays" type="number" min="1" max="90" value="${esc(list.paymentDays??7)}"></label></div>
    <div class="warehouse-worktable-wrap"><table class="log-table inpost-contract-table"><thead><tr><th>Usługa / przedział</th><th>Netto z paliwem</th><th>Brutto</th></tr></thead><tbody>
      ${inpostServiceCennikWiersze("Paczkomat® 24/7","locker",list.locker||{})}
      <tr class="inpost-rate-section"><th colspan="3">Kurier Standard</th></tr>
      ${courier.map((rate,index)=>`<tr><td>${esc(rate.label||`do ${rate.maxKg} kg`)}</td><td><input name="price_courier_${index}_net" type="number" min="0" step=".01" value="${esc(rate.net??0)}"></td><td><input name="price_courier_${index}_gross" type="number" min="0" step=".01" value="${esc(rate.gross??0)}"></td></tr>`).join("")}
      ${inpostServiceCennikWiersze("Kurier Manager Paczek","courierManager",list.courierManager||{})}
      ${inpostServiceCennikWiersze("Podaj dalej","handoff",list.handoff||{})}
      ${inpostServiceCennikWiersze("Szybkie zwroty","quickReturns",list.quickReturns||{})}
    </tbody></table></div>
    <details class="inpost-extra-rates"><summary>Dopłaty do usług dodatkowych</summary><p>Wpisz stawki z dalszej części umowy. Puste pole blokuje fakturę tylko wtedy, gdy dana opcja została wybrana.</p><div class="inpost-extra-grid">${extras.map(([key,label])=>`<label>${esc(label)}<input name="extra_${key}" type="number" min="0" step=".01" value="${list.extras?.[key]??""}" placeholder="uzupełnij z umowy"></label>`).join("")}</div></details>
  </section>`;
}
function inpostServiceCennikZForm(form){
  const current=inpostServiceStan.settings?.priceList||{},read=(name,fallback=null)=>{const raw=form.elements[name]?.value;if(raw==null||String(raw).trim()==="")return fallback;const value=Number(String(raw).replace(",","."));return Number.isFinite(value)?value:fallback;};
  const readGroup=(prefix,source={})=>Object.fromEntries(Object.entries(source).map(([key,rate])=>[key,{...rate,net:read(`price_${prefix}_${key}_net`,rate.net),gross:read(`price_${prefix}_${key}_gross`,rate.gross)}]));
  const extras={};["codGross","insuranceGross","weekendGross","pickupGross","smsGross","emailGross","saturdayGross","dor1720Gross","rodGross","nonStandardGross"].forEach(key=>{extras[key]=read(`extra_${key}`,null);});
  return {...current,label:form.elements.priceListLabel?.value||current.label,subscriptionNet:read("subscriptionNet",current.subscriptionNet),subscriptionGross:read("subscriptionGross",current.subscriptionGross),paymentDays:read("paymentDays",current.paymentDays),locker:readGroup("locker",current.locker),courierStandard:(current.courierStandard||[]).map((rate,index)=>({...rate,net:read(`price_courier_${index}_net`,rate.net),gross:read(`price_courier_${index}_gross`,rate.gross)})),courierManager:readGroup("courierManager",current.courierManager),handoff:readGroup("handoff",current.handoff),quickReturns:readGroup("quickReturns",current.quickReturns),extras};
}
async function inpostServiceZapiszUstawienia(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),body={commissionGross:form.commissionGross.value,sender:inpostServiceStronaOsoby(form,"sender"),priceList:inpostServiceCennikZForm(form)};
  if(button){button.disabled=true;button.textContent="Zapisuję cennik…";}
  try{const d=await chmura("inpost-service-settings",{method:"POST",body,timeout:30000});inpostServiceStan.settings=d.settings||inpostServiceStan.settings;inpostServiceStan.pricing=null;toast("Cennik umowny, nadawca i prowizja zapisane ✅");renderuj();}catch(e){toast("Nie zapisano ustawień: "+(e.message||e));}
  finally{if(button){button.disabled=false;button.textContent="Zapisz cennik i ustawienia";}}
}
function inpostServiceFormHTML(){
  const sender=inpostServiceNadawca(),fee=Number(inpostServiceStan.settings?.commissionGross??4),month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability;
  return `<section class="panel inpost-service-create">
    <div class="order-section-head"><div><span class="order-pro-label">Nadanie klienta • Artway‑TM</span><h2>Nadaj i prawidłowo rozlicz przesyłkę</h2><p class="order-detail-lead">Wybierz strony przesyłki, usługę, sprawdź koszt z własnej umowy i utwórz dokument klienta.</p></div><div class="diag-actions"><span class="lvl ${available?.locker?"lvl-ok":"lvl-ostrzezenie"}">Paczkomat ${available?.locker?"aktywny":"do sprawdzenia"}</span><span class="lvl ${available?.courier?"lvl-ok":"lvl-ostrzezenie"}">Kurier ${available?.courier?"aktywny":"do sprawdzenia"}</span></div></div>
    <form id="inpostServiceForm" onsubmit="inpostServiceUtworz(event)" oninput="inpostServiceZaplanujWycene(this)" onchange="inpostServiceZaplanujWycene(this)">
      <input type="hidden" name="requestId" value="${esc(inpostServiceStan.requestId||inpostServiceNowyRequestId())}">
      <nav class="inpost-process-steps" aria-label="Etapy nadania"><a href="#inpost-party-sender"><b>1</b><span>Nadawca</span></a><a href="#inpost-party-receiver"><b>2</b><span>Odbiorca</span></a><a href="#inpost-shipment-options"><b>3</b><span>Usługa i paczka</span></a><a href="#inpost-settlement"><b>4</b><span>Koszt i faktura</span></a></nav>
      <div class="inpost-form-top"><label>Referencja / numer klienta<input name="reference" required value="USL-${Date.now().toString(36).toUpperCase()}"></label><div class="inpost-address-summary"><b>📒 Książka adresowa</b><span>${inpostServiceStan.addressBook?.length||0} zapisanych adresów</span><small>Każdy adres może służyć jako nadawca lub odbiorca.</small></div></div>
      <div class="inpost-parties-grid"><div id="inpost-party-sender">${inpostServiceOsobaFields("sender","Nadawca",sender)}</div><div id="inpost-party-receiver">${inpostServiceOsobaFields("receiver","Odbiorca",{})}</div></div>
      <div class="inpost-options-layout" id="inpost-shipment-options">
        <fieldset><legend>🚚 Usługa i nadanie</legend><div class="inpost-form-grid">
          <label>Rodzaj dostawy<select name="deliveryType" onchange="inpostServiceUstawTyp(this.form)"><option value="locker">Paczkomat / PaczkoPunkt</option><option value="courier">Kurier InPost</option></select></label>
          <label>Sposób nadania<select name="sendingMethod" onchange="inpostServiceUstawTyp(this.form)"><option value="parcel_locker">Paczkomat</option><option value="any_point">Dowolny punkt InPost</option><option value="pok">Punkt Obsługi Klienta</option><option value="pop">Punkt Obsługi Przesyłek</option><option value="branch">Oddział InPost</option><option value="dispatch_order">Odbiór przez kuriera</option></select></label>
          <div class="wide" data-inpost-only="locker"><label>Paczkomat / punkt odbiorcy *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" placeholder="np. BOJ01N"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape()">Mapa</button></div><small id="inpostServiceTargetPointLabel">Wybierz punkt na mapie albo wyszukaj poniżej.</small></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod pocztowy lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow()">Szukaj</button></div><div id="inpostServicePointResults"></div></div>
          <label>Punkt nadania (opcjonalnie)<input name="dropoffPoint" placeholder="kod punktu"></label>
          <label class="check" data-inpost-only="courier"><input type="checkbox" name="pickupRequested"> Zleć odbiór przez kuriera</label>
        </div></fieldset>
        <fieldset><legend>📦 Paczka i opcje</legend><div class="inpost-form-grid">
          <label>Gabaryt<select name="template"><option value="small">A / small</option><option value="medium">B / medium</option><option value="large">C / large</option><option value="">Wymiary własne</option></select></label>
          <label>Waga (kg)<input name="weight" type="number" min=".01" max="30" step=".01" value="1"><small>Kurier Standard: stawki do 30 kg</small></label>
          <label>Długość (cm)<input name="length" type="number" min="1" step=".1" value="30"></label><label>Szerokość (cm)<input name="width" type="number" min="1" step=".1" value="20"></label><label>Wysokość (cm)<input name="height" type="number" min="1" step=".1" value="15"></label>
          <label class="check"><input type="checkbox" name="nonStandard"> Niestandardowa</label>
          <label class="check wide"><input type="checkbox" name="codEnabled"> Pobranie <input name="codAmount" type="number" min="0" step=".01" placeholder="kwota PLN"></label>
          <label class="check wide"><input type="checkbox" name="insuranceEnabled"> Dodatkowa ochrona <input name="insuranceAmount" type="number" min="0" step=".01" placeholder="wartość PLN"></label>
          <label class="check" data-inpost-only="locker"><input type="checkbox" name="weekend"> Paczka w Weekend</label><label class="check" data-inpost-only="locker"><input type="checkbox" name="additionalServices" value="labelless"> Bez etykiety</label>
          <label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="sms"> SMS</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="email"> E-mail</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="saturday"> Sobota</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="dor1720"> 17:00–20:00</label><label class="check" data-inpost-only="courier"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label>
          <label class="wide">Uwagi<input name="comments" maxlength="100"></label>
        </div></fieldset>
        <fieldset class="inpost-billing-card" id="inpost-settlement"><legend>💰 Koszt i faktura Artway‑TM</legend>
          <div class="inpost-pricing-layout"><div data-inpost-pricing></div><div class="inpost-pricing-controls"><label>Pełny koszt ręczny — tylko awaryjnie<input name="carrierCostOverride" type="number" min="0" step=".01" placeholder="zastępuje cennik umowny"></label><button class="btn ghost" type="button" onclick="inpostServiceWycena(this.form,true)">↻ Przelicz według umowy</button><button class="btn ghost" type="button" onclick="document.querySelector('.inpost-service-settings')?.setAttribute('open','');document.querySelector('.inpost-service-settings')?.scrollIntoView({behavior:'smooth'})">Otwórz cennik</button></div></div>
          <div class="inpost-settlement-grid">
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="none" checked><span><b>Bez faktury</b><small>Tylko nadanie i rejestr kosztu</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="single"><span><b>FV od razu</b><small>Artway‑TM wystawia koszt nadania + prowizję</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="monthly"><span><b>FV miesięczna</b><small>Dopisz całe nadanie do rozliczenia klienta</small></span></label>
          </div>
          <div class="inpost-form-grid"><label>Miesiąc rozliczenia<input name="billingMonth" type="month" value="${esc(month)}"></label><label>Prowizja Artway‑TM brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(fee)}"></label></div>
          <div class="backend-note"><b>Sprzedawcą usługi na FV jest Artway‑TM.</b> Jedna pozycja faktury obejmuje koszt przesyłki według zapisanego cennika umownego oraz ustawioną wyżej prowizję. InPost nie jest wystawcą dokumentu klienta.</div>
        </fieldset>
      </div>
      <div class="inpost-create-footer"><button class="btn" type="submit">🟡 Utwórz przesyłkę InPost</button><small>Adresy, wycena, numer nadania, tracking i etykieta pozostają w jednym rejestrze.</small></div>
    </form>
  </section>`;
}
function inpostServiceKosztHTML(item={}){
  const pricing=item.pricing||{},amount=inpostServiceWycenaKwota(pricing);
  if(amount==null)return '<span class="lvl lvl-ostrzezenie">cena niedostępna</span>';
  return `<b>${zl(amount)}</b><br><small>${pricing.source==="manual"?"koszt ręczny":"cennik umowny"} • na FV ${zl(pricing.customerTotalGross??amount+(item.billing?.commissionGross||0))}</small>${pricing.complete===false?'<br><span class="lvl lvl-ostrzezenie">uzupełnij dopłaty</span>':""}`;
}
function inpostServiceHistoriaHTML(){
  const rows=inpostServiceLista();
  const fields=`<label class="search-wide">Szukaj<input value="${esc(inpostServiceSzukaj)}" placeholder="Numer nadania, klient, NIP, e-mail, punkt lub referencja…" oninput="inpostServiceSzukaj=this.value;zaplanujRenderPoWpisaniu()"></label><label>Status<select onchange="inpostServiceFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie statusy</option>${[["label_ready","Etykieta gotowa"],["created","Utworzone"],["error","Błędy"],["cancelled","Anulowane"]].map(([v,l])=>`<option value="${v}" ${inpostServiceFiltr===v?"selected":""}>${l}</option>`).join("")}</select></label><label>Rozliczenie<select onchange="inpostServiceBillingFiltr=this.value;renderuj()"><option value="wszystkie">Wszystkie</option><option value="oczekuje" ${inpostServiceBillingFiltr==="oczekuje"?"selected":""}>Do FV miesięcznej</option><option value="rozliczone" ${inpostServiceBillingFiltr==="rozliczone"?"selected":""}>W inFakt</option><option value="bez" ${inpostServiceBillingFiltr==="bez"?"selected":""}>Bez faktury</option></select></label>`;
  const row=item=>{
    const events=Array.isArray(item.trackingHistory)?item.trackingHistory:[];
    const label=item.labelReady?`${inpostServiceStatusLabel(item)}<br><small>${esc(inpostServiceStatusNazwa(item.inpostStatus))}</small>`:inpostServiceStatusLabel(item);
    return `<tr data-stable-key="${esc(item.id)}">
      <td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td>
      <td data-label="Odbiorca"><b>${esc(inpostServiceNazwaKontaktu(item.receiver))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.receiver))}</small><br><small>${esc(item.receiver?.email||"")}</small></td>
      <td data-label="Usługa">${item.deliveryType==="locker"?"📮 Paczkomat":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td>
      <td data-label="Koszt">${inpostServiceKosztHTML(item)}</td>
      <td data-label="Status">${label}<br><small>${events.length} zdarzeń • aktualizacja ${esc(inpostServiceDataPotwierdzenia(item.trackingUpdatedAt||item.updatedAt))}</small></td>
      <td data-label="Rozliczenie">${inpostServiceBillingLabel(item)}<br><small>FV klienta: ${item.billing?.mode==="none"?"—":zl(item.pricing?.customerTotalGross||0)}</small></td>
      <td data-label="Akcje"><div class="inpost-row-actions"><button class="btn receipt" onclick="inpostServicePotwierdzenie(${jsArg(item.id)})">🖨️ Potwierdzenie</button><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.pickupRequested&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">Odbiór</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" ${item.pricing?.complete===true?"":"disabled title='Uzupełnij koszt przesyłki'"} onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td>
    </tr>`;
  };
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr operacyjny</span><h2>Nadania, tracking i dokumenty klienta</h2><p class="order-detail-lead">Przed każdym wydrukiem system pobiera aktualne zdarzenia InPost. Potwierdzenie można ponownie wydrukować w dowolnym momencie bez ujawniania kosztu umownego ani prowizji.</p></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież rejestr</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Filtry obejmują dane nadania, klienta i numer śledzenia.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Koszt</th><th>Status i historia</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(row).join("")||'<tr><td colspan="7">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function inpostServiceMiesieczneHTML(){
  const groups=inpostServiceStan.billing?.groups||[];if(!groups.length)return "";
  return `<section class="panel inpost-monthly-billing"><div class="order-section-head"><div><span class="order-pro-label">Faktury Artway‑TM</span><h2>Miesięczne rozliczenia klientów</h2><p class="order-detail-lead">Każde nadanie zachowuje własny koszt umowny i prowizję, a klient otrzymuje jeden dokument za miesiąc.</p></div><a class="btn ghost" href="#/admin/infakt/wysylki">Otwórz w inFakt</a></div><div class="inpost-monthly-grid">${groups.map(group=>`<article><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small><small>Koszt nadań ${zl(group.carrierGross||0)} + prowizja ${zl(group.commissionGross||0)}</small>${group.incompletePrices?`<span class="lvl lvl-ostrzezenie">${group.incompletePrices} niepełnych wycen</span>`:""}</div><strong>${zl(group.customerTotalGross||0)}</strong><button class="btn" ${group.incompletePrices?"disabled title='Najpierw uzupełnij koszty'":""} onclick="inpostServiceFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz FV Artway‑TM</button></article>`).join("")}</div></section>`;
}
function panelWysylkiUslugowejInpost(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram książkę adresową, konfigurację i rejestr nadań…</div></div>';
  setTimeout(()=>{const form=document.getElementById("inpostServiceForm");inpostServiceUstawTyp(form);inpostServiceAktualizujWyceneUI(form);},0);
  const billing=inpostServiceStan.billing||{},list=inpostServiceStan.settings?.priceList||{},lockerA=list.locker?.small?.gross??14.16;
  return `<div class="inpost-service-workspace"><section class="inpost-service-stats"><article><span>📦</span><b>${inpostServiceStan.items.length}</b><small>nadań</small></article><article><span>📒</span><b>${inpostServiceStan.addressBook?.length||0}</b><small>zapisanych adresów</small></article><article><span>📑</span><b>od ${zl(lockerA)}</b><small>stawki brutto z umowy</small></article><article><span>🧾</span><b>${zl(billing.customerPendingGross||0)}</b><small>do FV miesięcznych</small></article></section>${inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:""}${inpostServiceFormHTML()}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}<details class="panel inpost-service-settings"><summary>⚙️ Cennik umowny, domyślny nadawca i prowizja</summary><form onsubmit="inpostServiceZapiszUstawienia(event)">${inpostServiceCennikHTML()}${inpostServiceOsobaFields("sender","Stałe dane nadawcy",inpostServiceNadawca())}<div class="inpost-settings-footer"><label>Domyślna prowizja Artway‑TM brutto<input name="commissionGross" type="number" min="0" step=".01" value="${esc(inpostServiceStan.settings?.commissionGross??4)}"></label><button class="btn" type="submit">Zapisz cennik i ustawienia</button><a class="btn ghost" href="#/admin/infakt/wysylki">Rozliczenia inFakt</a></div></form></details></div>`;
}
