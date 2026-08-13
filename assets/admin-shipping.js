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
    apiEndpoint:"/api/store",tryb:"production",autoStatus:true,autoEmail:true,autoTracking:true,
    alarmSla:true,powiadomieniaWyjatki:true,
    ...(ustawienia.wysylka||{})
  };
  const endpoint=/^(?:\.\/)?api\/index\.php(?:$|\?)/i.test(String(u.apiEndpoint||"").trim())
    ?"/api/store"
    :(String(u.apiEndpoint||"").trim()||"/api/store");
  return {...u, apiEndpoint:endpoint, przewoznik:"inpost", regulaPaczkomat:"inpost", regulaKurier:"inpost"};
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
              <div style="font-size:15px;line-height:1.6">Konfiguracja Gmail SMTP i serwera działa poprawnie. Wiadomości są czytelne, estetyczne i zachęcają klienta do dalszych zakupów.</div>
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
    {id:"inpost",href:"#/admin/wysylki/inpost",label:"📮 Nadaj przesyłkę"},
    {id:"inpost-rejestr",href:"#/admin/wysylki/inpost-rejestr",label:"📚 Rejestr nadań"},
    {id:"inpost-ustawienia",href:"#/admin/wysylki/inpost-ustawienia",label:"⚙️ Ustawienia InPost"},
    {id:"odbior-kuriera",href:"#/admin/wysylki/odbior-kuriera",label:"🚚 Odbiór kuriera"},
    {id:"tracking",href:"#/admin/wysylki/tracking",label:"📡 Monitoring i tracking",badge:problemy||""},
    {id:"automatyzacje",href:"#/admin/wysylki/automatyzacje",label:"⚡ Automatyzacje"},
    {id:"ustawienia",href:"#/admin/wysylki/ustawienia",label:"🔌 Bramka API"}
  ],aktywna);
}
function wysylkiKontekstPodstronyHTML(aktywna="zlecenia"){
  const orders=pobierzZamowienia(),isActive=z=>!["dostarczona","anulowana","zwrot"].includes(etapWysylki(z)),active=orders.filter(isActive).length,labels=orders.filter(z=>isActive(z)&&czyEtykietaInpostGotowa(z)).length,transport=orders.filter(z=>etapWysylki(z)==="transport").length,problems=orders.filter(z=>etapWysylki(z)==="problem").length;
  const cfg={
    zlecenia:{icon:"📋",eyebrow:"Realizacja zamówień",title:"Obsługa zleceń InPost",description:"Dane odbiorcy, sposób nadania, etykieta i przekazanie przesyłki w jednym procesie."},
    inpost:{icon:"📮",eyebrow:"Nadania klientów",title:"Wysyłka z InPost",description:"Nadanie, etykieta, tracking i faktura."},
    "inpost-rejestr":{icon:"📚",eyebrow:"Historia nadań",title:"Rejestr nadań InPost",description:"Tracking, etykiety, potwierdzenia, statusy i rozliczenia utworzonych przesyłek."},
    "inpost-ustawienia":{icon:"⚙️",eyebrow:"Konfiguracja nadań",title:"Ustawienia InPost",description:"Domyślny sposób nadania, automat, prowizje, cennik i adres nadawcy."},
    "odbior-kuriera":{icon:"🚚",eyebrow:"Odbiór paczek",title:"Zamów kuriera InPost",description:"Osobna kolejka paczek gotowych do odbioru przez kuriera InPost."},
    tracking:{icon:"📡",eyebrow:"Monitoring przesyłek",title:"Tracking i wyjątki",description:"Numery nadania, zdarzenia InPost, SLA oraz przesyłki wymagające reakcji operatora."},
    automatyzacje:{icon:"⚡",eyebrow:"Reguły operacyjne",title:"Automatyzacje wysyłek",description:"Automatyczne statusy, tracking, e-maile i alarmy czasu nadania."},
    ustawienia:{icon:"⚙️",eyebrow:"Integracja przewoźnika",title:"Bramka InPost i nadawca",description:"Stan API, usługi, dane nadawcy oraz bezpieczna konfiguracja integracji serwerowej."}
  }[aktywna];
  return `<header class="shipping-page-context"><div><span>${esc(cfg.icon)}</span><div><small>${esc(cfg.eyebrow)}</small><h1>${esc(cfg.title)}</h1><p>${esc(cfg.description)}</p></div></div><a class="btn ghost" href="#/admin/zamowienia">📦 Zamówienia sklepu</a></header><nav class="shipping-page-kpis" aria-label="Stan operacyjny wysyłek"><a href="#/admin/wysylki"><span>📋</span><b>${active}</b><small>aktywnych</small></a><a href="#/admin/wysylki"><span>🏷️</span><b>${labels}</b><small>etykiet</small></a><a href="#/admin/wysylki/tracking"><span>🚚</span><b>${transport}</b><small>w drodze</small></a><a href="#/admin/wysylki/tracking" class="${problems?"has-alert":""}"><span>⚠️</span><b>${problems}</b><small>wyjątków</small></a></nav>`;
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
    <div class="order-section-head"><div><span class="order-pro-label">Kolejka operacyjna</span><h1>🚚 Centrum obsługi InPost</h1></div><a class="btn ghost" href="#/admin/wysylki/inpost">＋ Nadaj przesyłkę klienta</a></div>
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
      <details class="shipping-import-help"><summary>Instrukcja importu awaryjnego</summary><p>W InPost wybierz <b>Wyślij przesyłki → Import z pliku</b>, separator <b>Tabulator</b> i opcję <b>Nagłówki: Tak</b>.</p></details>
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
  const aktywna=["zlecenia","inpost","inpost-rejestr","inpost-ustawienia","odbior-kuriera","tracking","automatyzacje","ustawienia"].includes(String(sekcja||""))?String(sekcja):"zlecenia";tabWysylek=aktywna;
  const widok=aktywna==="inpost"?panelWysylkiUslugowejInpost():aktywna==="inpost-rejestr"?panelRejestruWysylekInpost():aktywna==="inpost-ustawienia"?panelUstawienWysylkiInpost():aktywna==="odbior-kuriera"?panelOdbioruKurieraInpost():aktywna==="tracking"?panelTrackinguWysylek():aktywna==="automatyzacje"?panelAutomatyzacjiWysylek():aktywna==="ustawienia"?panelUstawienBramki():panelZlecenWysylkowych();
  return adminSzkielet("/admin/wysylki",`<div class="module-page-stack shipping-module-page shipping-section-${esc(aktywna)}">${nawigacjaWysylek(aktywna)}${wysylkiKontekstPodstronyHTML(aktywna)}<div class="shipping-workspace section-${esc(aktywna)}">${widok}</div></div>`);
}

let inpostServiceStan={loaded:false,loading:false,saving:false,error:"",items:[],addressBook:[],settings:{commissionGross:4,sender:{}},billing:{groups:[]},serviceAvailability:null,requestId:"",pricing:null};
let inpostServiceSzukaj="",inpostServiceFiltr="wszystkie",inpostServiceBillingFiltr="wszystkie";
let inpostServicePotwierdzenieWybrane=new Set();

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
function inpostServicePustyNadawcaKlienta(){
  return {companyName:"",taxCode:"",firstName:"",lastName:"",email:"",phone:"",address:{street:"",buildingNumber:"",flatNumber:"",postCode:"",city:""}};
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
  if(trasa().startsWith("/admin/wysylki/inpost")||trasa()==="/admin/wysylki/odbior-kuriera")renderuj();
}
const inpostServiceMetodyNadania={
  locker:[
    ["parcel_locker","Nadam w automacie Paczkomat"],
    ["dispatch_order","Przesyłkę odbierze kurier InPost"],
    ["pop","Nadam w PaczkoPunkcie"]
  ],
  courier:[
    ["parcel_locker","Nadam w automacie Paczkomat"],
    ["dispatch_order","Przesyłkę odbierze kurier InPost"],
    ["pop","Nadam w PaczkoPunkcie"]
  ]
};
const inpostServiceMetodyWymagajacePunktu=new Set(["parcel_locker","pok","courier_pok"]);
function inpostServiceCourierC2CAktywny(){return (inpostServiceStan.serviceAvailability?.services||[]).includes("inpost_courier_c2c");}
function inpostServiceMetodyNadaniaOpcjeHTML(type="locker",selected=""){
  return (inpostServiceMetodyNadania[type]||inpostServiceMetodyNadania.locker).map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(selected)?"selected":""}>${esc(label)}</option>`).join("");
}
function inpostServiceZastosujZgodnoscTypu(form,preferDefault=false){
  const type=String(form?.deliveryType?.value||"locker");
  form?.querySelectorAll("[data-inpost-only]").forEach(el=>el.hidden=!String(el.dataset.inpostOnly||"").split(",").includes(type));
  const allowed=(inpostServiceMetodyNadania[type]||[]).filter(([value])=>type!=="courier"||value!=="parcel_locker"||inpostServiceCourierC2CAktywny()),allowedValues=new Set(allowed.map(([value])=>value)),methodInputs=[...(form?.querySelectorAll?.('[name="sendingMethod"]')||[])];
  methodInputs.forEach(input=>{const enabled=allowedValues.has(input.value),card=input.closest("[data-inpost-method-card]");input.disabled=!enabled;if(card){card.hidden=!enabled;if(enabled)card.style.removeProperty("display");else card.style.setProperty("display","none","important");}});
  let method=String(form?.elements?.sendingMethod?.value||"");
  if(preferDefault){
    const preferred=methodInputs.find(input=>input.value==="parcel_locker"&&!input.disabled);
    methodInputs.forEach(input=>{input.checked=Boolean(preferred&&input===preferred);});
    method=preferred?.value||"";
  }
  if(!allowedValues.has(method)){
    methodInputs.forEach(input=>{input.checked=false;});method="";
    if(type==="locker"){const preferred=methodInputs.find(input=>input.value==="parcel_locker"&&!input.disabled);if(preferred){preferred.checked=true;method=preferred.value;}}
  }
  const requiresPoint=inpostServiceMetodyWymagajacePunktu.has(method),dropoff=form?.elements?.dropoffPoint;
  if(dropoff){
    dropoff.required=requiresPoint;
    dropoff.setAttribute("aria-required",requiresPoint?"true":"false");
    if(!requiresPoint)dropoff.value="";
    dropoff.placeholder=requiresPoint?"Wybierz automat nadawczy":"";
  }
  const dropoffPanel=form?.querySelector("[data-inpost-dropoff-panel]");if(dropoffPanel)dropoffPanel.hidden=!requiresPoint;
  const compatibility=form?.querySelector("[data-inpost-method-compatibility]");if(compatibility){compatibility.hidden=type!=="courier";compatibility.innerHTML=inpostServiceCourierC2CAktywny()?"<b>Domyślny Paczkomat jest dostępny.</b> Formularz użyje usługi Kurier C2C z tej samej organizacji InPost. Możesz też świadomie wybrać PaczkoPunkt albo odbiór przez kuriera.":"<b>Domyślny Paczkomat nie jest dostępny dla Kuriera Standard.</b> Wybierz PaczkoPunkt/POP albo odbiór przez kuriera — formularz nie przełączy metody automatycznie.";}
  const label=form?.querySelector("[data-inpost-dropoff-label]"),hint=form?.querySelector("[data-inpost-dropoff-hint]");
  if(label)label.textContent=requiresPoint?"Automat nadawczy *":"";
  if(hint)hint.textContent=requiresPoint?"ShipX wymaga kodu automatu dla tego sposobu nadania.":"";
  form?.querySelectorAll('[data-receiver-address]').forEach(input=>input.required=type==="courier");
  const target=form?.elements?.targetPoint;if(target)target.required=type==="locker";
  const xlarge=form?.querySelector('[data-inpost-size="xlarge"]');if(xlarge)xlarge.hidden=type!=="courier";
  if(type!=="courier"&&form?.elements?.template?.value==="xlarge"){const small=form.querySelector('[name="template"][value="small"]');if(small){small.checked=true;inpostServiceUstawGabaryt(form,"small",false);}}
  return {type,method,requiresPoint};
}
function inpostServiceUstawGabaryt(form,size="",recalculate=true){
  const dimensions={small:[64,38,8],medium:[64,38,19],large:[64,38,41],xlarge:[80,50,50]}[String(size||form?.elements?.template?.value||"small")]||[64,38,8];
  ["length","width","height"].forEach((name,index)=>{if(form?.elements?.[name])form.elements[name].value=dimensions[index];});
  if(recalculate)inpostServiceZaplanujWycene(form);
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
function inpostServiceTekstPorownawczy(value){return String(value||"").trim().toLocaleLowerCase("pl-PL");}
function inpostServiceAdresKlucz(person={}){const a=person.address||{};return [a.street,a.buildingNumber||a.building_number,a.flatNumber||a.flat_number,a.postCode||a.post_code,a.city].map(inpostServiceTekstPorownawczy).filter(Boolean).join("|");}
function inpostServiceNormalizujNadawceKlienta(form){
  if(!form)return;
  const current=inpostServiceStronaOsoby(form,"sender"),technical=inpostServiceNadawca();
  const personalChanged=!!(current.firstName||current.lastName)&&[current.firstName,current.lastName].map(inpostServiceTekstPorownawczy).join("|")!==[technical.firstName,technical.lastName].map(inpostServiceTekstPorownawczy).join("|");
  const currentAddress=inpostServiceAdresKlucz(current),technicalAddress=inpostServiceAdresKlucz(technical),addressChanged=!!currentAddress&&currentAddress!==technicalAddress;
  if(!personalChanged&&!addressChanged)return;
  const company=form.elements.senderCompany,taxCode=form.elements.senderTaxCode;
  if(company&&technical.companyName&&inpostServiceTekstPorownawczy(company.value)===inpostServiceTekstPorownawczy(technical.companyName))company.value="";
  if(taxCode&&technical.taxCode&&String(taxCode.value||"").replace(/\D/g,"")===String(technical.taxCode||"").replace(/\D/g,""))taxCode.value="";
}
function inpostServiceAdresZwrotuNotatka(person={}){
  const a=person.address||{},name=person.companyName||`${person.firstName||""} ${person.lastName||""}`.trim(),building=[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/"),street=[a.street,building].filter(Boolean).join(" "),city=[a.postCode||a.post_code,a.city].filter(Boolean).join(" "),destination=[name,street,city].filter(Boolean).join(", ");
  return destination?`Zwroty kierować pod adres nadawcy: ${destination}.`.replace(/\s+/g," ").trim().slice(0,100):"";
}
function inpostServiceUwagiZeZwrotem(value,sender){
  const note=inpostServiceAdresZwrotuNotatka(sender),custom=String(value||"").replace(/(?:^|\s)Zwroty\s+kierować(?:\s+pod|\s+na)?\s+adres(?:\s+nadawcy)?\s*:?.*$/iu,"").replace(/\s+/g," ").trim();
  if(!custom)return note;
  const prefix=custom.slice(0,Math.max(0,100-note.length-1)).replace(/[\s,;:-]+$/u,"");
  return [prefix,note].filter(Boolean).join(" ").slice(0,100);
}
function inpostServiceAktualizujAdresZwrotu(form){
  const target=form?.querySelector?.("[data-inpost-return-address]");if(!target)return;
  target.textContent=inpostServiceAdresZwrotuNotatka(inpostServiceStronaOsoby(form,"sender"))||"Uzupełnij adres nadawcy.";
}
function inpostServiceUzupelnijKontaktTechniczny(form){
  const technical=inpostServiceNadawca(),fallback=inpostServiceAdresFirmy(),email=technical.email||fallback.email||"",phone=technical.phone||fallback.phone||"";
  ["sender","receiver"].forEach(prefix=>{
    const emailInput=form?.elements?.[`${prefix}Email`],phoneInput=form?.elements?.[`${prefix}Phone`];
    if(emailInput&&!String(emailInput.value||"").trim()&&email){emailInput.value=email;emailInput.dataset.inpostTechnicalContact="true";}
    if(phoneInput&&!String(phoneInput.value||"").trim()&&phone){phoneInput.value=phone;phoneInput.dataset.inpostTechnicalContact="true";}
  });
}
function inpostServicePayload(form){
  inpostServiceNormalizujNadawceKlienta(form);
  inpostServiceUzupelnijKontaktTechniczny(form);
  const data=new FormData(form),additionalServices=[...form.querySelectorAll('[name="additionalServices"]:checked')].map(input=>input.value);
  const codAmount=Math.max(0,Number(String(data.get("codAmount")||"0").replace(",","."))||0),insuranceAmount=Math.max(0,Number(String(data.get("insuranceAmount")||"0").replace(",","."))||0),sendingMethod=String(data.get("sendingMethod")||"");
  const sender=inpostServiceStronaOsoby(form,"sender");
  return {requestId:inpostServiceStan.requestId||inpostServiceNowyRequestId(),reference:String(data.get("reference")||"").trim(),comments:inpostServiceUwagiZeZwrotem(data.get("comments"),sender),returnAddress:sender.address,principal:sender,sender,receiver:inpostServiceStronaOsoby(form,"receiver"),saveSender:data.get("saveSender")==="on",saveReceiver:data.get("saveReceiver")==="on",deliveryType:data.get("deliveryType"),sendingMethod,targetPoint:data.get("targetPoint"),dropoffPoint:data.get("dropoffPoint"),parcel:{template:data.get("template"),length:data.get("length"),width:data.get("width"),height:data.get("height"),weight:data.get("weight"),nonStandard:data.get("nonStandard")==="on"},cod:{enabled:codAmount>0||data.get("codEnabled")==="on",amount:codAmount},insurance:{enabled:insuranceAmount>0||data.get("insuranceEnabled")==="on",amount:insuranceAmount},weekend:["on","true","1"].includes(String(data.get("weekend")||"")),additionalServices,pickupRequested:sendingMethod==="dispatch_order"||data.get("pickupRequested")==="on",billingMode:data.get("billingMode"),billingMonth:data.get("billingMonth"),commissionGross:data.get("commissionGross"),carrierCostOverride:data.get("carrierCostOverride")};
}
function inpostServiceSzczegolyBledu(fields,prefix=""){
  const out=[];
  const visit=(value,path)=>{
    if(value==null)return;
    if(typeof value==="string"||typeof value==="number"||typeof value==="boolean"){out.push({field:path,message:String(value)});return;}
    if(Array.isArray(value)){value.forEach((item,index)=>visit(item,path));return;}
    if(typeof value==="object"){
      if(typeof value.message==="string"){out.push({field:String(value.field||path),message:value.message});return;}
      Object.entries(value).forEach(([key,item])=>visit(item,path?`${path}.${key}`:key));
    }
  };
  visit(fields,prefix);return out;
}
function inpostServiceNazwaPola(path=""){
  const map={"sender.firstName":"senderFirstName","sender.email":"senderEmail","sender.phone":"senderPhone","sender.address.street":"senderStreet","sender.address.buildingNumber":"senderBuilding","sender.address.postCode":"senderPostCode","sender.address.city":"senderCity","receiver.firstName":"receiverFirstName","receiver.email":"receiverEmail","receiver.phone":"receiverPhone","receiver.address.street":"receiverStreet","receiver.address.buildingNumber":"receiverBuilding","receiver.address.postCode":"receiverPostCode","receiver.address.city":"receiverCity","targetPoint":"targetPoint","dropoffPoint":"dropoffPoint","sending_method":"sendingMethod","custom_attributes.target_point":"targetPoint","custom_attributes.dropoff_point":"dropoffPoint","custom_attributes.sending_method":"sendingMethod","cod.amount":"codAmount","insurance.amount":"insuranceAmount","parcel.weight":"weight","commissionGross":"commissionGross"};
  return map[path]||path.split(".").at(-1)||"";
}
function inpostServicePrzyjaznyBlad(detail={},form=null){
  const field=String(detail.field||""),message=String(detail.message||"").trim(),type=String(form?.elements?.deliveryType?.value||"");
  if(/sending_method/.test(field)||/sending[_ ]method/i.test(message))return type==="courier"?"Dla przesyłki kurierskiej wybierz nadanie w PaczkoPunkcie albo odbiór przez kuriera.":"Wybierz sposób nadania zgodny z wybraną usługą InPost.";
  if(/dropoff_point/.test(field))return "Wybierz punkt nadania dla wskazanego sposobu przekazania paczki.";
  if(/target_point/.test(field))return "Wybierz Paczkomat lub PaczkoPunkt odbiorcy.";
  if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(message)||/custom_attributes|uuid|request[_ ]?id/i.test(message))return "InPost odrzucił jedną z opcji. Sprawdź sposób nadania i dane przesyłki.";
  return message||"Sprawdź wskazane pole.";
}
function inpostServiceWyczyscBledyFormularza(form){
  form?.querySelectorAll(".inpost-field-error").forEach(element=>element.classList.remove("inpost-field-error"));
  const box=form?.querySelector("[data-inpost-form-errors]");if(box){box.hidden=true;box.innerHTML="";}
}
function inpostServiceBladPol(fields=[],form=document.getElementById("inpostServiceForm"),notify=true){
  const details=inpostServiceSzczegolyBledu(fields).map(detail=>({...detail,message:inpostServicePrzyjaznyBlad(detail,form)}));
  inpostServiceWyczyscBledyFormularza(form);
  details.forEach(detail=>{const input=form?.elements?.[inpostServiceNazwaPola(detail.field)];input?.classList?.add("inpost-field-error");});
  const messages=[...new Set(details.map(item=>item.message).filter(Boolean))],box=form?.querySelector("[data-inpost-form-errors]");
  if(box&&messages.length){box.hidden=false;box.innerHTML=`<b>Popraw dane przed nadaniem:</b><ul>${messages.map(message=>`<li>${esc(message)}</li>`).join("")}</ul>`;}
  const firstField=details.map(detail=>form?.elements?.[inpostServiceNazwaPola(detail.field)]).find(Boolean);firstField?.focus?.();
  if(notify&&messages[0])toast(messages[0]);
  return details;
}
async function inpostServiceUtworz(event){
  event.preventDefault();if(inpostServiceStan.saving)return;
  const form=event.currentTarget,payload=inpostServicePayload(form),button=form.querySelector('[type="submit"]');
  inpostServiceWyczyscBledyFormularza(form);
  if(!payload.sender.companyName&&!payload.sender.firstName){
    inpostServiceBladPol([{field:"sender.firstName",message:"Wybierz z książki albo wpisz rzeczywistego nadawcę przesyłki. Dane Artway-TM są wyłącznie kontaktem technicznym."}],form);
    return;
  }
  inpostServiceStan={...inpostServiceStan,saving:true};if(button){button.disabled=true;button.textContent="⏳ Tworzę przesyłkę…";}
  try{
    const d=await chmura("inpost-service-create",{method:"POST",body:payload,timeout:90000});
    if(d.item)inpostServiceStan.items=[d.item,...inpostServiceStan.items.filter(item=>item.id!==d.item.id)];
    inpostServiceNowyRequestId();await inpostServiceLaduj(true,true);
    if(d.item){inpostServiceSzukaj=String(d.item.trackingNumber||d.item.reference||d.item.id||"");inpostServiceFiltr="wszystkie";inpostServiceBillingFiltr="wszystkie";}
    toast(d.invoice?.error?`Przesyłka utworzona ✅ Faktura wymaga uwagi: ${d.invoice.error}`:`Przesyłka InPost utworzona ✅ ${d.item?.trackingNumber||"oczekuje na numer"}`);
    renderuj();
  }catch(e){if(e.code==="previous_attempt_failed"){inpostServiceNowyRequestId();if(form.elements.requestId)form.elements.requestId.value=inpostServiceStan.requestId;}const details=inpostServiceBladPol(e.details,form,false),message=details[0]?.message||"Nie udało się utworzyć przesyłki. Sprawdź dane i spróbuj ponownie.";toast("Nie utworzono przesyłki: "+message);}
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
  const labels={created:"Przesyłka utworzona",confirmed:"Etykieta utworzona — paczka czeka na nadanie",dispatched_by_sender:"Przekazana przez nadawcę",collected_from_sender:"Odebrana od nadawcy",taken_by_courier:"Odebrana przez kuriera",adopted_at_source_branch:"Przyjęta w oddziale nadawczym",sent_from_source_branch:"Wysłana z oddziału nadawczego",adopted_at_sorting_center:"Przyjęta w sortowni",sent_from_sorting_center:"Wysłana z sortowni",adopted_at_target_branch:"Przyjęta w oddziale docelowym",out_for_delivery:"Wydana do doręczenia",ready_to_pickup:"Gotowa do odbioru",pickup_reminder_sent:"Wysłano przypomnienie o odbiorze",delivered:"Doręczona",avizo:"Nieudana próba doręczenia",undelivered:"Nie doręczono",missing:"Przesyłka poszukiwana",returned_to_sender:"Zwrócona do nadawcy",cancelled:"Przesyłka anulowana"};
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
function inpostServiceZleceniodawca(item={}){return item.principal||item.requester||item.customer||item.sender||{};}
function inpostServiceKluczZleceniodawcy(item={}){
  const person=inpostServiceZleceniodawca(item),a=person.address||{};
  return [person.taxCode,person.email,person.companyName,person.firstName,person.lastName,a.street,a.buildingNumber||a.building_number,a.postCode||a.post_code,a.city].map(value=>normalizujSzukanyTekst(String(value||""))).join("|");
}
function inpostServiceCenaKoncowa(item={}){
  const stored=item.pricing?.customerTotalGross;
  if(stored!==null&&stored!==undefined&&String(stored).trim()!==""&&Number.isFinite(Number(stored)))return Number(stored);
  const carrier=item.pricing?.totalGross,commission=item.billing?.commissionGross??item.pricing?.commissionGross;
  return carrier!==null&&carrier!==undefined&&String(carrier).trim()!==""&&Number.isFinite(Number(carrier))?Number(carrier)+(Number.isFinite(Number(commission))?Number(commission):0):NaN;
}
function inpostServiceNazwaPotwierdzenia(person={}){return person.companyName||`${person.firstName||""} ${person.lastName||""}`.trim()||"—";}
function inpostServiceAdresTekstPotwierdzenia(person={}){
  const a=person.address||{},street=[a.street,[a.buildingNumber||a.building_number,a.flatNumber||a.flat_number].filter(Boolean).join("/")].filter(Boolean).join(" ");
  return [street,[a.postCode||a.post_code,a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")||"—";
}
function inpostServicePotwierdzenieHTML(input={},warning=""){
  const items=(Array.isArray(input)?input:[input]).filter(Boolean),first=items[0]||{},company=typeof daneFirmy==="function"?daneFirmy():{},multi=items.length>1;
  const principal=inpostServiceZleceniodawca(first),keys=new Set(items.map(inpostServiceKluczZleceniodawcy)),samePrincipal=keys.size<=1;
  if(!samePrincipal)throw new Error("Jedno potwierdzenie może obejmować tylko przesyłki tego samego zleceniodawcy.");
  const eventLabel=event=>String(event?.status||"").toLowerCase()==="confirmed"?inpostServiceStatusNazwa("confirmed"):(event?.label||inpostServiceStatusNazwa(event?.status));
  const latestAt=items.map(item=>item.trackingUpdatedAt||item.updatedAt||item.createdAt).filter(Boolean).sort().at(-1)||"";
  const prices=items.map(inpostServiceCenaKoncowa),finalTotal=prices.every(Number.isFinite)?prices.reduce((sum,value)=>sum+value,0):NaN;
  const billingLabels=[...new Set(items.map(item=>({none:"Bez faktury",single:"Faktura wystawiana od razu",monthly:"Rozliczenie na fakturze miesięcznej"}[item.billing?.mode]||"—")))];
  const documentNumber=multi?`ZBIORCZE-${items.length}-${first.reference||first.id||"NADANIE"}`:(first.reference||first.id||"—");
  const title=multi?"Potwierdzenie nadania przesyłek":"Potwierdzenie nadania przesyłki";
  const itemRows=items.map((item,index)=>{
    const parcel=item.parcel||{},size=parcel.template?String(parcel.template).toUpperCase():[parcel.length,parcel.width,parcel.height].filter(Boolean).join(" × "),service=item.deliveryType==="locker"?`Paczkomat / PaczkoPunkt${item.targetPoint?` • ${item.targetPoint}`:""}`:"Kurier InPost",status=eventLabel((item.trackingHistory||[])[0]||{status:item.inpostStatus||item.status});
    return `<tr><td>${index+1}</td><td><b>${esc(item.trackingNumber||"Oczekuje na numer")}</b><small>${esc(item.reference||item.id||"")}</small></td><td><b>${esc(inpostServiceNazwaPotwierdzenia(item.receiver))}</b><small>${esc(inpostServiceAdresTekstPotwierdzenia(item.receiver))}</small></td><td><b>${esc(service)}</b><small>${esc(size?`Gabaryt / wymiary: ${size}`:"Przesyłka")}${parcel.weight?` • ${esc(parcel.weight)} kg`:""}</small></td><td><b>${esc(status)}</b><small>${esc(inpostServiceDataPotwierdzenia(item.trackingUpdatedAt||item.updatedAt||item.createdAt))}</small></td></tr>`;
  }).join("");
  const history=items.flatMap(item=>{
    const events=Array.isArray(item.trackingHistory)&&item.trackingHistory.length?item.trackingHistory:[{status:item.inpostStatus||item.status||"created",occurredAt:item.trackingUpdatedAt||item.updatedAt||item.createdAt}];
    return events.slice(0,multi?1:8).map(event=>({...event,shipment:item.trackingNumber||item.reference||item.id}));
  });
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Potwierdzenie ${esc(documentNumber)}</title></head><body><main class="sheet">
    <header class="head"><div><div class="brand">${esc(company.nazwa||"Artway‑TM")}</div><h1>${title}</h1><small>Dokument potwierdzający przyjęcie i realizację usługi przewozu</small></div><div class="head-meta"><b>Nr dokumentu: ${esc(documentNumber)}</b><small>Data wystawienia: ${esc(inpostServiceDataPotwierdzenia(new Date().toISOString()))}</small></div></header>
    <section class="status"><b>${multi?`${items.length} przesyłek na jednym potwierdzeniu`:esc(eventLabel((first.trackingHistory||[])[0]||{status:first.inpostStatus||first.status}))}</b><span>Stan danych na: ${esc(inpostServiceDataPotwierdzenia(latestAt))}</span></section>
    ${warning?`<div class="warning"><b>Uwaga:</b> ${esc(warning)} Dokument pokazuje ostatnie dane zapisane w systemie.</div>`:""}
    <div class="content"><div class="meta"><div><small>Liczba przesyłek</small><b>${items.length}</b></div><div><small>Rozliczenie</small><b>${esc(billingLabels.join(" / "))}</b></div><div><small>Format dokumentu</small><b>A4 • czarno-biały</b></div></div>
      <div class="parties principal-only"><section class="party"><small>Zleceniodawca</small>${inpostServiceAdresPotwierdzenia(principal)}</section><section class="party issuer"><small>Wystawca dokumentu</small><b>${esc(company.nazwa||"Artway‑TM")}</b><span>${esc(pelnyAdresFirmy?.(company)||"")}</span></section></div>
      <h2 class="section-title">Przesyłki objęte potwierdzeniem</h2><table class="shipments"><thead><tr><th>Lp.</th><th>Numer przesyłki</th><th>Odbiorca</th><th>Usługa i paczka</th><th>Status</th></tr></thead><tbody>${itemRows}</tbody></table>
      <section class="final-price"><small>Cena końcowa usługi${multi?" — łącznie":""}</small><b>${esc(Number.isFinite(finalTotal)?zl(finalTotal):"—")}</b><span>Kwota należna od zleceniodawcy. Dokument nie ujawnia kosztów wewnętrznych ani sposobu kalkulacji ceny.</span></section>
      <h2 class="section-title">Aktualny przebieg transportu</h2><ol class="timeline">${history.map(event=>`<li><b>${esc(eventLabel(event))}</b><span>${esc(inpostServiceDataPotwierdzenia(event.occurredAt))}${event.location?` • ${esc(event.location)}`:""}</span><small>Przesyłka: ${esc(event.shipment)}${event.description?` • ${esc(event.description)}`:""}</small></li>`).join("")||"<li><b>Oczekuje na pierwsze zdarzenie przewoźnika</b></li>"}</ol>
      <div class="signatures"><div class="signature-box">Podpis osoby wystawiającej</div><div class="stamp-box">Pieczęć firmowa Artway-TM</div></div>
      <p class="formal-note">Dokument potwierdza utworzenie wskazanych przesyłek i zapisanie ich danych w systemie. Status „Etykieta utworzona — paczka czeka na nadanie” nie oznacza fizycznego przekazania paczki przewoźnikowi.</p>
    </div><footer class="foot"><span>${esc([company.nazwa,pelnyAdresFirmy?.(company)].filter(Boolean).join(" • "))}</span><span>Drukarka docelowa: Brother DCP‑T525W • A4</span><span>Dokument nie jest fakturą ani paragonem.</span></footer>
  </main><div class="actions"><div><b>Brother DCP‑T525W</b><small>A4 • pionowo • czarno-biały</small></div><button onclick="window.print()">Drukuj na Brother A4</button><button onclick="window.close()">Zamknij</button></div></body></html>`;
}
function inpostServiceCzekajNaOknoPotwierdzenia(popup,timeout=7000){
  return new Promise((resolve,reject)=>{const started=Date.now(),check=()=>{
    if(!popup||popup.closed)return reject(new Error("Okno potwierdzenia zostało zamknięte"));
    try{if(popup.location.pathname==="/assets/inpost-confirmation.html"&&popup.document.readyState==="complete")return resolve();}catch{}
    if(Date.now()-started>=timeout)return reject(new Error("Nie udało się przygotować okna potwierdzenia"));
    setTimeout(check,50);
  };check();});
}
async function inpostServicePrzygotujPotwierdzenie(ids=[]){
  const unique=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean))],popup=window.open("/assets/inpost-confirmation.html","_blank","width=1100,height=920");if(!popup)return toast("Przeglądarka zablokowała okno wydruku");
  let items=[],failures=0;
  for(const id of unique){const current=inpostServiceStan.items.find(row=>row.id===id);if(!current)continue;try{items.push(await inpostServicePobierzStatus(id));}catch{items.push(current);failures+=1;}}
  if(!items.length){popup.close();return toast("Nie znaleziono nadań do potwierdzenia");}
  const keys=new Set(items.map(inpostServiceKluczZleceniodawcy));if(keys.size>1){popup.close();return toast("Wybierz przesyłki tylko jednego zleceniodawcy");}
  try{
    await inpostServiceCzekajNaOknoPotwierdzenia(popup);
    const warning=failures?`Nie udało się odświeżyć statusu ${failures} ${failures===1?"przesyłki":"przesyłek"}.`:"",documentHtml=new DOMParser().parseFromString(inpostServicePotwierdzenieHTML(items,warning),"text/html");
    popup.document.title=documentHtml.title;popup.document.body.innerHTML=documentHtml.body.innerHTML;
  }catch(e){popup.close();return toast(e.message||String(e));}
  renderuj();
}
async function inpostServicePotwierdzenie(id){return inpostServicePrzygotujPotwierdzenie([id]);}
async function inpostServicePotwierdzenieZbiorcze(){
  const ids=[...inpostServicePotwierdzenieWybrane];if(!ids.length)return toast("Zaznacz co najmniej jedną przesyłkę");return inpostServicePrzygotujPotwierdzenie(ids);
}
function inpostServiceOdswiezWyborPotwierdzenia(){
  const count=inpostServicePotwierdzenieWybrane.size;document.querySelectorAll("[data-inpost-confirm-count]").forEach(el=>el.textContent=String(count));document.querySelectorAll("[data-inpost-confirm-selected]").forEach(el=>{el.disabled=count===0;});document.querySelectorAll("[data-inpost-confirm-clear]").forEach(el=>{el.disabled=count===0;});
}
function inpostServiceZaznaczPotwierdzenie(id,checked,input=null){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item)return;
  if(checked&&inpostServicePotwierdzenieWybrane.size){const firstId=[...inpostServicePotwierdzenieWybrane][0],first=inpostServiceStan.items.find(row=>row.id===firstId);if(first&&inpostServiceKluczZleceniodawcy(first)!==inpostServiceKluczZleceniodawcy(item)){if(input)input.checked=false;return toast("Do jednego potwierdzenia wybierz paczki tego samego zleceniodawcy");}}
  if(checked)inpostServicePotwierdzenieWybrane.add(id);else inpostServicePotwierdzenieWybrane.delete(id);inpostServiceOdswiezWyborPotwierdzenia();
}
function inpostServiceWyczyscWyborPotwierdzenia(){inpostServicePotwierdzenieWybrane.clear();document.querySelectorAll("[data-inpost-confirm-checkbox]").forEach(input=>{input.checked=false;});inpostServiceOdswiezWyborPotwierdzenia();}
async function inpostServiceEtykieta(id,format="A6"){
  const item=inpostServiceStan.items.find(row=>row.id===id);if(!item?.inpostId)return toast("Przesyłka nie ma jeszcze ID InPost");
  try{const d=await chmura("inpost-label",{params:{id:item.inpostId,type:format},timeout:30000}),url=URL.createObjectURL(b64toBlob(d.base64,"application/pdf"));window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){toast("Etykieta: "+(e.message||e));}
}
async function inpostServiceOdbior(id){
  const item=inpostServiceStan.items.find(record=>record.id===id),sender=item?.sender||{},address=sender.address||{},senderName=sender.companyName||`${sender.firstName||""} ${sender.lastName||""}`.trim()||"nadawca",addressText=[address.street,[address.buildingNumber||address.building_number,address.flatNumber||address.flat_number].filter(Boolean).join("/"),address.postCode||address.post_code,address.city].filter(Boolean).join(" ");
  if(!confirm(`Zamówić kuriera InPost po paczkę od: ${senderName}, ${addressText}? InPost może naliczyć opłatę za odbiór. Paczka i koszt pozostaną w organizacji firmowej InPost.`))return;
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
function inpostServiceOtworzMape(purpose="target"){
  window.__inpostPointPurpose=purpose==="dropoff"?"dropoff":"target";window.__geoTarget="inpost-service";otworzGeowidget();
}
async function inpostServiceSzukajPunktow(){
  const query=String(document.getElementById("inpostServicePointSearch")?.value||"").trim(),box=document.getElementById("inpostServicePointResults");
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  if(box)box.innerHTML="<small>Szukam punktów InPost…</small>";
  try{const params={limit:10,...(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query})},d=await chmura("inpost-points",{params,timeout:15000});if(box)box.innerHTML=(d.points||[]).map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))})"><b>${esc(point.name)}</b><span>${esc(opisPunktuInpost(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów.</small>";}catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
function inpostServiceWybierzPunkt(code,address="",purpose=window.__inpostPointPurpose||"target"){
  const dropoff=purpose==="dropoff",input=document.getElementById(dropoff?"inpostServiceDropoffPoint":"inpostServiceTargetPoint"),label=document.getElementById(dropoff?"inpostServiceDropoffPointLabel":"inpostServiceTargetPointLabel");
  if(input){input.value=String(code||"").toUpperCase();input.dispatchEvent(new Event("input",{bubbles:true}));}
  if(label)label.textContent=address||code;window.__inpostPointPurpose="";toast(`${dropoff?"Automat nadawczy":"Punkt odbioru"}: ${code}`);
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
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr operacyjny</span><h2>Nadania i rozliczenia</h2><p class="order-detail-lead">Tracking, etykieta, zlecenie odbioru i faktura tworzą jeden ślad operacyjny. Koszt umowny przewoźnika nie jest wyświetlany.</p></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Filtry działają po danych nadania i rozliczenia klienta.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table"><thead><tr><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Status</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(item=>`<tr data-stable-key="${esc(item.id)}"><td><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td><td><b>${esc(item.receiver?.companyName||`${item.receiver?.firstName||""} ${item.receiver?.lastName||""}`.trim()||"Klient")}</b><br><small>${esc(item.receiver?.email||"")}${item.receiver?.taxCode?` • NIP ${esc(item.receiver.taxCode)}`:""}</small></td><td>${item.deliveryType==="locker"?"📮 Paczkomat / punkt":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Paczka w Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td><td>${inpostServiceStatusLabel(item)}<br><small>${esc(item.inpostStatus||"")}</small>${item.pickup?.id?`<br><span class="lvl lvl-ok">odbiór kuriera ${esc(item.pickup.status||"")}</span>`:""}</td><td>${inpostServiceBillingLabel(item)}<br><small>prowizja ${zl(item.billing?.commissionGross||0)}</small>${item.billing?.error?`<br><small class="error">${esc(item.billing.error)}</small>`:""}</td><td><div class="inpost-row-actions"><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.labelReady&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">🚚 Zamów kuriera</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="6">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
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
  const sender=inpostServicePustyNadawcaKlienta(),clients=inpostServiceKlienci(),fee=Number(inpostServiceStan.settings?.commissionGross??4),month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability;
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
const inpostServiceKodPocztowyTimery={sender:0,receiver:0},inpostServiceKodPocztowyCache=new Map();
const inpostServiceKsiazkaStan={
  sender:{role:"sender",q:"",postCode:"",city:"",street:"",page:1,selectedKey:"",targetFormId:""},
  receiver:{role:"receiver",q:"",postCode:"",city:"",street:"",page:1,selectedKey:"",targetFormId:""},
};

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
function inpostServiceAdresNormal(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
}
function inpostServiceAdresUnikalne(values,limit=150){
  const map=new Map();
  values.forEach(value=>{const clean=String(value||"").trim(),key=inpostServiceAdresNormal(clean);if(clean&&key&&!map.has(key))map.set(key,clean);});
  return [...map.values()].sort((a,b)=>a.localeCompare(b,"pl")).slice(0,limit);
}
function inpostServiceAdresDane(contact={}){
  const address=contact.address||{};
  return {
    postCode:String(address.postCode||address.post_code||"").trim(),
    city:String(address.city||"").trim(),
    street:String(address.street||"").trim(),
  };
}
function inpostServiceKodPocztowy(value=""){
  const digits=String(value||"").replace(/\D/g,"").slice(0,5);
  return digits.length===5?`${digits.slice(0,2)}-${digits.slice(2)}`:digits;
}
function inpostServiceUliceDlaAdresu(form,prefix){
  const code=inpostServiceKodPocztowy(form?.elements?.[`${prefix}PostCode`]?.value),city=inpostServiceAdresNormal(form?.elements?.[`${prefix}City`]?.value);
  const streets=inpostServiceAdresUnikalne(inpostServiceAdresy().filter(contact=>{
    const address=inpostServiceAdresDane(contact);
    return (!code||inpostServiceKodPocztowy(address.postCode)===code)&&(!city||inpostServiceAdresNormal(address.city)===city);
  }).map(contact=>inpostServiceAdresDane(contact).street),250);
  const list=document.getElementById(`inpostService${prefix}StreetHints`);if(list)list.innerHTML=streets.map(street=>`<option value="${esc(street)}"></option>`).join("");
  return streets;
}
function inpostServiceMiastoWpis(input,prefix){inpostServiceUliceDlaAdresu(input?.form,prefix);}
function inpostServiceKodPocztowyWpis(input,prefix){
  const code=inpostServiceKodPocztowy(input?.value),form=input?.form,hint=form?.querySelector?.(`[data-inpost-postcode-hint="${prefix}"]`);
  if(input&&input.value!==code)input.value=code;
  clearTimeout(inpostServiceKodPocztowyTimery[prefix]);
  if(!/^\d{2}-\d{3}$/.test(code)){if(hint){hint.hidden=true;hint.textContent="";}return;}
  if(hint){hint.hidden=false;hint.className="backend-note wide";hint.textContent="Sprawdzam kod pocztowy…";}
  inpostServiceKodPocztowyTimery[prefix]=setTimeout(()=>inpostServiceSprawdzKodPocztowy(form,prefix,code),350);
}
async function inpostServiceSprawdzKodPocztowy(form,prefix,code){
  if(!form||inpostServiceKodPocztowy(form.elements[`${prefix}PostCode`]?.value)!==code)return;
  const hint=form.querySelector(`[data-inpost-postcode-hint="${prefix}"]`);
  try{
    let d=inpostServiceKodPocztowyCache.get(code);
    if(!d){d=await chmura("inpost-service-postcode",{params:{code},timeout:9000});inpostServiceKodPocztowyCache.set(code,d);}
    if(inpostServiceKodPocztowy(form.elements[`${prefix}PostCode`]?.value)!==code)return;
    const localCities=inpostServiceAdresy().filter(contact=>inpostServiceKodPocztowy(inpostServiceAdresDane(contact).postCode)===code).map(contact=>inpostServiceAdresDane(contact).city);
    const cities=inpostServiceAdresUnikalne([...(d.cities||[]),...localCities],50),cityInput=form.elements[`${prefix}City`],cityList=document.getElementById(`inpostService${prefix}CityHints`);
    if(cityList)cityList.innerHTML=cities.map(city=>`<option value="${esc(city)}"></option>`).join("");
    if(cityInput&&!String(cityInput.value||"").trim()&&cities.length===1)cityInput.value=cities[0];
    const streets=inpostServiceUliceDlaAdresu(form,prefix);
    if(hint){hint.hidden=false;hint.className="backend-note wide";hint.textContent=cities.length?`Kod rozpoznany: ${cities.join(", ")}. ${streets.length?"Możesz wybrać zapisaną ulicę z podpowiedzi.":"Wpisz ulicę i numer budynku."}`:"Nie znaleziono miejscowości dla tego kodu. Sprawdź kod albo wpisz miasto ręcznie.";}
    inpostServiceZaplanujWycene(form);
  }catch(e){if(hint){hint.hidden=false;hint.className="backend-note wide";hint.textContent="Nie udało się teraz sprawdzić kodu. Miasto i ulicę możesz wpisać ręcznie.";}}
}
function inpostServiceRoleKontaktu(contact={},role="all"){
  return role==="all"||(contact.roles||[]).includes(role);
}
function inpostServiceAdresTekst(contact={}){
  return inpostServiceAdresNormal([
    inpostServiceNazwaKontaktu(contact),contact.companyName,contact.taxCode,contact.email,contact.phone,
    inpostServiceAdresKsiazki(contact),...(contact.roles||[]),
  ].filter(Boolean).join(" "));
}
function inpostServiceAdresWyniki(prefix){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  const q=inpostServiceAdresNormal(state.q),code=inpostServiceAdresNormal(state.postCode),city=inpostServiceAdresNormal(state.city),street=inpostServiceAdresNormal(state.street);
  return inpostServiceAdresy().filter(contact=>{
    const address=inpostServiceAdresDane(contact);
    return inpostServiceRoleKontaktu(contact,state.role)
      &&(!q||inpostServiceAdresTekst(contact).includes(q))
      &&(!code||inpostServiceAdresNormal(address.postCode).includes(code))
      &&(!city||inpostServiceAdresNormal(address.city).includes(city))
      &&(!street||inpostServiceAdresNormal(address.street).includes(street));
  });
}
function inpostServiceAdresPodpowiedzi(source,prefix){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  const codeN=inpostServiceAdresNormal(state.postCode),cityN=inpostServiceAdresNormal(state.city);
  const all=inpostServiceAdresy().filter(contact=>inpostServiceRoleKontaktu(contact,state.role)),byCode=all.filter(contact=>!codeN||inpostServiceAdresNormal(inpostServiceAdresDane(contact).postCode).includes(codeN));
  const byCity=byCode.filter(contact=>!cityN||inpostServiceAdresNormal(inpostServiceAdresDane(contact).city).includes(cityN));
  const options={
    PostCode:inpostServiceAdresUnikalne(all.map(contact=>inpostServiceAdresDane(contact).postCode),250),
    City:inpostServiceAdresUnikalne(byCode.map(contact=>inpostServiceAdresDane(contact).city)),
    Street:inpostServiceAdresUnikalne(byCity.map(contact=>inpostServiceAdresDane(contact).street),250),
  };
  Object.entries(options).forEach(([kind,values])=>{
    const list=document.getElementById(`inpostBook${prefix}${kind}Hints`);
    if(list)list.innerHTML=values.map(value=>`<option value="${esc(value)}"></option>`).join("");
  });
  inpostServiceRenderujKsiazke(prefix);
}
function inpostServiceRolaEtykieta(contact={}){
  const sender=(contact.roles||[]).includes("sender"),receiver=(contact.roles||[]).includes("receiver");
  if(sender&&receiver)return '<span class="inpost-role both">Nadawca i odbiorca</span>';
  if(sender)return '<span class="inpost-role sender">Nadawca</span>';
  return '<span class="inpost-role receiver">Odbiorca</span>';
}
function inpostServiceRenderujKsiazke(prefix){
  const layer=document.getElementById("inpostAddressBookModal");if(!layer||layer.dataset.prefix!==prefix)return;
  const state=inpostServiceKsiazkaStan[prefix],matches=inpostServiceAdresWyniki(prefix),pageSize=20,pages=Math.max(1,Math.ceil(matches.length/pageSize));
  state.page=Math.min(Math.max(1,Number(state.page)||1),pages);
  const page=matches.slice((state.page-1)*pageSize,state.page*pageSize),selected=inpostServiceAdresy().find(item=>String(item.key)===String(state.selectedKey));
  layer.querySelectorAll("[data-inpost-book-role]").forEach(button=>button.classList.toggle("active",button.dataset.inpostBookRole===state.role));
  const count=layer.querySelector("[data-inpost-book-count]");if(count)count.textContent=`${matches.length} ${matches.length===1?"adres":matches.length<5?"adresy":"adresów"}`;
  const list=layer.querySelector("[data-inpost-book-results]");
  if(list)list.innerHTML=page.map(contact=>`<button class="inpost-book-contact ${String(contact.key)===String(state.selectedKey)?"selected":""}" type="button" onclick="inpostServiceKsiazkaZaznacz(${jsArg(prefix)},${jsArg(contact.key)})"><span class="inpost-book-avatar">${esc((inpostServiceNazwaKontaktu(contact).match(/[A-Za-zĄĆĘŁŃÓŚŹŻ]/i)?.[0]||"A").toUpperCase())}</span><span class="inpost-book-contact-main"><span class="inpost-contact-card-head"><b>${esc(inpostServiceNazwaKontaktu(contact))}</b>${inpostServiceRolaEtykieta(contact)}</span><span>${esc(inpostServiceAdresKsiazki(contact)||"Brak pełnego adresu")}</span><small>${esc([contact.taxCode?`NIP ${contact.taxCode}`:"",contact.phone,contact.email].filter(Boolean).join(" • "))}</small></span><span class="inpost-book-check">✓</span></button>`).join("")||'<div class="inpost-address-empty"><b>Brak pasujących adresów</b><small>Zmień filtry albo dodaj nowy adres.</small></div>';
  const preview=layer.querySelector("[data-inpost-book-preview]");
  if(preview)preview.innerHTML=selected?`<span class="order-pro-label">Wybrany kontakt</span><h3>${esc(inpostServiceNazwaKontaktu(selected))}</h3>${inpostServiceRolaEtykieta(selected)}<dl><div><dt>Adres</dt><dd>${esc(inpostServiceAdresKsiazki(selected)||"brak")}</dd></div><div><dt>Telefon</dt><dd>${esc(selected.phone||"—")}</dd></div><div><dt>E-mail</dt><dd>${esc(selected.email||"—")}</dd></div>${selected.taxCode?`<div><dt>NIP</dt><dd>${esc(selected.taxCode)}</dd></div>`:""}</dl>`:'<div class="inpost-book-preview-empty"><span>📒</span><b>Wybierz kontakt</b><small>Tutaj zobaczysz komplet danych przed użyciem adresu.</small></div>';
  const pager=layer.querySelector("[data-inpost-book-pager]");
  if(pager)pager.innerHTML=`<button class="btn ghost" type="button" onclick="inpostServiceKsiazkaStrona(${jsArg(prefix)},-1)" ${state.page<=1?"disabled":""}>← Poprzednia</button><span>Strona <b>${state.page}</b> z ${pages}</span><button class="btn ghost" type="button" onclick="inpostServiceKsiazkaStrona(${jsArg(prefix)},1)" ${state.page>=pages?"disabled":""}>Następna →</button>`;
  const use=layer.querySelector("[data-inpost-book-use]");if(use)use.disabled=!selected;
}
function inpostServiceKsiazkaFiltr(prefix,role,button){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  state.role=["sender","receiver","all"].includes(role)?role:prefix;state.page=1;
  const selected=inpostServiceAdresy().find(item=>String(item.key)===String(state.selectedKey));
  if(selected&&!inpostServiceRoleKontaktu(selected,state.role))state.selectedKey="";
  inpostServiceAdresPodpowiedzi(null,prefix);
}
function inpostServiceKsiazkaSzukaj(input,prefix){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  state.q=String(input?.value||"");state.page=1;
  inpostServiceRenderujKsiazke(prefix);
}
function inpostServiceKsiazkaPole(input,prefix,key){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  if(["postCode","city","street"].includes(key))state[key]=String(input?.value||"");
  state.page=1;inpostServiceAdresPodpowiedzi(null,prefix);
}
function inpostServiceKsiazkaStrona(prefix,change){
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;state.page=Math.max(1,(Number(state.page)||1)+Number(change||0));inpostServiceRenderujKsiazke(prefix);
}
function inpostServiceKsiazkaZaznacz(prefix,key){const state=inpostServiceKsiazkaStan[prefix];state.selectedKey=String(key||"");inpostServiceRenderujKsiazke(prefix);}
function inpostServiceKsiazkaForm(prefix){
  const state=inpostServiceKsiazkaStan[prefix]||{};return document.getElementById(state.targetFormId)||document.getElementById("inpostServiceForm");
}
function inpostServiceZamknijKsiazke(){document.getElementById("inpostAddressBookModal")?.remove();document.body.classList.remove("has-dialog");}
function inpostServiceOtworzKsiazke(prefix,source=null){
  const form=source?.closest?.("form")||document.getElementById("inpostServiceForm");if(!form)return;
  if(!form.id)form.id=`inpostServiceForm${Date.now()}`;
  const state=inpostServiceKsiazkaStan[prefix]||inpostServiceKsiazkaStan.receiver;
  state.targetFormId=form.id;state.role=prefix;state.page=1;state.selectedKey=String(form.elements[`${prefix}ContactId`]?.value||"");
  document.getElementById("inpostAddressBookModal")?.remove();
  const layer=document.createElement("div");layer.id="inpostAddressBookModal";layer.className="inpost-book-modal-layer";layer.dataset.prefix=prefix;
  layer.innerHTML=`<button class="inpost-book-backdrop" type="button" onclick="inpostServiceZamknijKsiazke()" aria-label="Zamknij książkę adresową"></button><section class="inpost-book-dialog" role="dialog" aria-modal="true" aria-labelledby="inpostBookTitle"><header><div><span class="order-pro-label">Książka adresowa InPost</span><h2 id="inpostBookTitle">Wybierz ${prefix==="sender"?"nadawcę":"odbiorcę"}</h2></div><div class="diag-actions"><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres(${jsArg(prefix)},this)">＋ Nowy adres</button><button class="inpost-book-close" type="button" onclick="inpostServiceZamknijKsiazke()" aria-label="Zamknij">✕</button></div></header><div class="inpost-book-toolbar"><div class="inpost-address-tabs"><button type="button" data-inpost-book-role="sender" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'sender',this)">Nadawcy</button><button type="button" data-inpost-book-role="receiver" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'receiver',this)">Odbiorcy</button><button type="button" data-inpost-book-role="all" onclick="inpostServiceKsiazkaFiltr(${jsArg(prefix)},'all',this)">Wszyscy</button></div><label class="inpost-address-main-search"><span>🔎</span><input type="search" value="${esc(state.q)}" placeholder="Firma, osoba, NIP, telefon, e-mail lub adres…" oninput="inpostServiceKsiazkaSzukaj(this,${jsArg(prefix)})"></label><div class="inpost-address-search-fields"><label>Kod pocztowy<input list="inpostBook${prefix}PostCodeHints" value="${esc(state.postCode)}" placeholder="00-000" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'postCode')"><datalist id="inpostBook${prefix}PostCodeHints"></datalist></label><label>Miejscowość<input list="inpostBook${prefix}CityHints" value="${esc(state.city)}" placeholder="Wpisz miejscowość" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'city')"><datalist id="inpostBook${prefix}CityHints"></datalist></label><label>Ulica<input list="inpostBook${prefix}StreetHints" value="${esc(state.street)}" placeholder="Wpisz ulicę" oninput="inpostServiceKsiazkaPole(this,${jsArg(prefix)},'street')"><datalist id="inpostBook${prefix}StreetHints"></datalist></label></div></div><div class="inpost-book-content"><div class="inpost-book-list-panel"><div class="inpost-address-match-head"><b data-inpost-book-count></b><small>Kliknij kontakt, aby zobaczyć szczegóły</small></div><div class="inpost-book-results" data-inpost-book-results></div><div class="inpost-book-pager" data-inpost-book-pager></div></div><aside class="inpost-book-preview" data-inpost-book-preview></aside></div><footer><button class="btn ghost" type="button" onclick="inpostServiceZamknijKsiazke()">Anuluj</button><button class="btn" type="button" data-inpost-book-use onclick="inpostServiceKsiazkaZatwierdz(${jsArg(prefix)})">Użyj wybranego adresu</button></footer></section>`;
  layer.addEventListener("keydown",event=>{if(event.key==="Escape")inpostServiceZamknijKsiazke();});
  document.body.appendChild(layer);document.body.classList.add("has-dialog");inpostServiceAdresPodpowiedzi(null,prefix);requestAnimationFrame(()=>layer.querySelector('input[type="search"]')?.focus());
}
function inpostServiceKsiazkaZatwierdz(prefix){
  const state=inpostServiceKsiazkaStan[prefix];if(!state?.selectedKey)return;
  inpostServiceWybierzAdresWynik(prefix,state.selectedKey,state.targetFormId);inpostServiceZamknijKsiazke();
}
function inpostServiceNowyAdres(prefix,source=null){
  const form=source?.closest?.("form")||inpostServiceKsiazkaForm(prefix);if(!form)return;
  inpostServiceZamknijKsiazke();
  if(form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value="";
  inpostServiceUstawPolaOsoby(form,prefix,{roles:[prefix]});
  toast(`Nowy adres ${prefix==="sender"?"nadawcy":"odbiorcy"}`);
}
function inpostServiceWybierzAdresWynik(prefix,key,targetFormId=""){
  const form=document.getElementById(targetFormId)||inpostServiceKsiazkaForm(prefix),contact=inpostServiceAdresy().find(item=>String(item.key)===String(key));if(!form||!contact)return;
  const hidden=form.elements[`${prefix}ContactId`];
  if(hidden)hidden.value=contact.stored?contact.id:"";
  inpostServiceUstawPolaOsoby(form,prefix,contact);
  inpostServiceAdresPodpowiedzi(form,prefix);
  inpostServiceZaplanujWycene(form);
  toast(`Wybrano adres ${prefix==="sender"?"nadawcy":"odbiorcy"} ✅`);
}
function inpostServiceUstawPolaOsoby(form,prefix,contact={}){
  const address=contact.address||{},roles=Array.isArray(contact.roles)?contact.roles:[prefix],fields={
    [`${prefix}Company`]:contact.companyName,[`${prefix}TaxCode`]:contact.taxCode,
    [`${prefix}FirstName`]:contact.firstName,[`${prefix}LastName`]:contact.lastName,
    [`${prefix}Email`]:contact.email,[`${prefix}Phone`]:contact.phone,
    [`${prefix}Street`]:address.street,[`${prefix}Building`]:address.buildingNumber||address.building_number,
    [`${prefix}Flat`]:address.flatNumber||address.flat_number,
    [`${prefix}PostCode`]:address.postCode||address.post_code,[`${prefix}City`]:address.city,
  };
  Object.entries(fields).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=value||"";});
  if(form.elements[`${prefix}RoleSender`])form.elements[`${prefix}RoleSender`].checked=roles.includes("sender");
  if(form.elements[`${prefix}RoleReceiver`])form.elements[`${prefix}RoleReceiver`].checked=roles.includes("receiver");
  const summary=form.querySelector(`[data-inpost-selected-contact="${prefix}"]`);
  if(summary)summary.innerHTML=inpostServiceWybranyKontaktHTML(contact,prefix);
  inpostServiceAdresPodpowiedzi(form,prefix);
}
function inpostServiceWybranyKontaktHTML(contact={},prefix="receiver"){
  const hasData=!!(contact.id||contact.companyName||contact.firstName||contact.lastName||contact.email||contact.phone||inpostServiceAdresKsiazki(contact));
  if(!hasData)return `<span class="inpost-selected-icon">＋</span><span><b>Nie wybrano ${prefix==="sender"?"nadawcy":"odbiorcy"}</b><small>Wybierz zapisany kontakt albo wpisz nowy adres.</small></span>`;
  const withRole={...contact,roles:Array.isArray(contact.roles)&&contact.roles.length?contact.roles:[prefix]};
  return `<span class="inpost-selected-icon">${prefix==="sender"?"📤":"📥"}</span><span><b>${esc(inpostServiceNazwaKontaktu(contact))}</b><small>${esc(inpostServiceAdresKsiazki(contact)||[contact.email,contact.phone].filter(Boolean).join(" • ")||"Adres do uzupełnienia")}</small></span>${inpostServiceRolaEtykieta(withRole)}`;
}
function inpostServicePunktOpis(point={}){
  const distance=Number(point.distance);
  return [opisPunktuInpost(point),Number.isFinite(distance)?`${distance<1000?Math.round(distance)+" m":(distance/1000).toFixed(1).replace(".",",")+" km"}`:"",point.location247?"czynny 24/7":point.openingHours].filter(Boolean).join(" • ");
}
async function inpostServicePobierzPunkty(params={},caption="",purpose="target"){
  const dropoff=purpose==="dropoff",box=document.getElementById(dropoff?"inpostServiceDropoffResults":"inpostServicePointResults");if(box)box.innerHTML="<small>Szukam najbliższych punktów InPost…</small>";
  try{
    const d=await chmura("inpost-points",{params:{limit:15,...params},timeout:15000}),points=d.points||[];
    if(box)box.innerHTML=`${caption?`<div class="inpost-point-caption">${esc(caption)}</div>`:""}${points.map(point=>`<button type="button" class="inpost-point-result" onclick="inpostServiceWybierzPunkt(${jsArg(point.name)},${jsArg(opisPunktuInpost(point))},${jsArg(purpose)})"><b>${esc(point.name)}</b><span>${esc(inpostServicePunktOpis(point))}</span></button>`).join("")||"<small>Nie znaleziono punktów dla tego adresu.</small>"}`;
  }catch(e){if(box)box.innerHTML=`<small class="error">${esc(e.message||e)}</small>`;}
}
async function inpostServiceSzukajPunktow(purpose="target"){
  const dropoff=purpose==="dropoff",query=String(document.getElementById(dropoff?"inpostServiceDropoffSearch":"inpostServicePointSearch")?.value||"").trim();
  if(!query)return toast("Wpisz miasto, kod pocztowy albo kod punktu");
  return inpostServicePobierzPunkty(/^\d{2}-?\d{3}$/.test(query)?{post_code:query}:{q:query},`Wyniki dla: ${query}`,purpose);
}
async function inpostServiceSzukajPunktowPrzyAdresie(prefix="receiver",purpose="target"){
  const form=document.getElementById("inpostServiceForm");if(!form)return;
  const postCode=String(form.elements[`${prefix}PostCode`]?.value||"").trim(),city=String(form.elements[`${prefix}City`]?.value||"").trim(),street=String(form.elements[`${prefix}Street`]?.value||"").trim();
  if(!postCode&&!city)return toast("Najpierw wpisz kod pocztowy albo miejscowość odbiorcy");
  const query=[street,postCode,city].filter(Boolean).join(", "),input=document.getElementById(purpose==="dropoff"?"inpostServiceDropoffSearch":"inpostServicePointSearch");if(input)input.value=query;
  return inpostServicePobierzPunkty(postCode?{post_code:postCode,city}:{city},`Najbliższe punkty względem adresu: ${query}`,purpose);
}
function inpostServiceOdswiezSelektory(form,selectedId=""){
  ["sender","receiver"].forEach(prefix=>{
    if(prefix===form?.dataset.lastSavedRole&&selectedId&&form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value=selectedId;
    inpostServiceAdresPodpowiedzi(form,prefix);
  });
}
async function inpostServiceZapiszKontakt(prefix,button=null){
  const form=button?.closest("form")||document.getElementById("inpostServiceForm");if(!form)return;
  const contact=inpostServiceStronaOsoby(form,prefix),id=form.elements[`${prefix}ContactId`]?.value||"";
  contact.roles=[form.elements[`${prefix}RoleSender`]?.checked?"sender":"",form.elements[`${prefix}RoleReceiver`]?.checked?"receiver":""].filter(Boolean);
  if(!contact.roles.length)return toast("Zaznacz rolę: nadawca, odbiorca albo obie");
  contact.id=id;contact.label=contact.companyName||`${contact.firstName} ${contact.lastName}`.trim()||contact.email;
  try{
    const d=await chmura("inpost-service-contact-save",{method:"POST",body:{role:prefix,contact},timeout:20000});
    inpostServiceStan.addressBook=Array.isArray(d.addressBook)?d.addressBook:inpostServiceStan.addressBook;
    form.dataset.lastSavedRole=prefix;
    if(form.elements[`${prefix}ContactId`])form.elements[`${prefix}ContactId`].value=d.contact?.id||id;
    if(d.contact)inpostServiceUstawPolaOsoby(form,prefix,d.contact);
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
    inpostServiceUstawPolaOsoby(form,prefix,{roles:[prefix]});
    inpostServiceOdswiezSelektory(form);
    toast("Adres usunięty z książki");
  }catch(e){toast("Nie usunięto adresu: "+(e.message||e));}
}
function inpostServiceMozeWycenic(payload){
  const people=[payload.sender,payload.receiver];
  if(people.some(person=>!person?.email||String(person.phone||"").replace(/\D/g,"").length<9))return false;
  if(!String(payload.sendingMethod||"").trim())return false;
  const senderAddress=payload.sender?.address||{};
  if(!senderAddress.street||!senderAddress.buildingNumber||!senderAddress.postCode||!senderAddress.city)return false;
  if(payload.deliveryType==="locker"&&!payload.targetPoint)return false;
  if(payload.deliveryType==="courier"){
    const address=payload.receiver?.address||{};
    if(!address.street||!address.buildingNumber||!address.postCode||!address.city)return false;
  }
  if(inpostServiceMetodyWymagajacePunktu.has(String(payload.sendingMethod||""))&&!String(payload.dropoffPoint||"").trim())return false;
  return true;
}
function inpostServiceWycenaKwota(pricing={}){
  if(pricing.totalGross==null||String(pricing.totalGross).trim()==="")return null;
  return Number.isFinite(Number(pricing.totalGross))?Number(pricing.totalGross):null;
}
function inpostServicePelnaCenaKlienta(totalGross){
  const carrier=Math.round((Number(totalGross)||0)*100)/100,customer=Math.ceil((carrier+4)-1e-9),commission=Math.round((customer-carrier)*100)/100;
  return {customerTotalGross:customer,commissionGross:commission,minimumCommissionGross:4,maximumCommissionGross:5};
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
  const total=inpostServiceWycenaKwota(pricing),rounded=total==null?null:inpostServicePelnaCenaKlienta(total),fee=Number.isFinite(Number(pricing.commissionGross))?Number(pricing.commissionGross):(rounded?.commissionGross||0);
  if(total==null){
    box.innerHTML=`<div class="inpost-price-empty warning"><b>Brak pasującej stawki w cenniku umownym</b><small>${esc(pricing.message||"Uzupełnij właściwą stawkę w cenniku albo podaj pełny koszt ręcznie. ShipX pozostaje wyłącznie kontrolą porównawczą.")}</small></div>`;
    return;
  }
  const customer=Number.isFinite(Number(pricing.customerTotalGross))?Number(pricing.customerTotalGross):rounded.customerTotalGross,b=pricing.breakdown||{},source=pricing.source==="manual"?"pełny koszt wpisany ręcznie":"Twój cennik umowny";
  const api=pricing.apiComparison||{},difference=Number.isFinite(Number(api.differenceGross))?Number(api.differenceGross):null;
  box.innerHTML=`<div class="inpost-price-main"><span><small>Koszt nadania</small><strong>${zl(total)}</strong></span><span><small>Prowizja Artway-TM</small><strong>${zl(fee)}</strong></span><span class="total"><small>Kwota na FV klienta</small><strong>${zl(customer)}</strong></span></div>
    ${pricing.complete&&!pricing.apiWarning?'<div class="inpost-price-meta"><span class="lvl lvl-ok">Cena dopasowana do pełnej kwoty</span><small>Prowizja pierwszego przedziału jest automatycznie dobierana w zakresie 4–5 zł.</small></div>':""}
    <div class="inpost-price-meta"><span class="lvl ${pricing.complete?"lvl-ok":"lvl-ostrzezenie"}">${esc(source)}</span><small>${esc(pricing.rateLabel||"stawka indywidualna")}</small>${Number(b.extrasGross)>0?`<small>Dopłaty: ${zl(b.extrasGross)}</small>`:""}<small>Opłata paliwowa: w cenie</small></div>
    ${pricing.complete?"":`<div class="inpost-price-warning"><b>Niepełna wycena opcji dodatkowych:</b> ${esc((pricing.unpricedOptions||[]).join(", ")||"brak stawki")}. Uzupełnij dopłaty w cenniku albo wpisz pełny koszt ręcznie — do tego czasu FV jest zablokowana.</div>`}
    ${pricing.apiWarning?`<div class="inpost-price-warning"><b>Cennik umowny działa, ale ShipX odrzucił kontrolę:</b> ${esc(pricing.apiWarning)}. Popraw wskazane dane przed utworzeniem przesyłki.</div>`:""}
    <div class="inpost-api-comparison"><span><b>Kontrola ShipX:</b> ${pricing.apiWarning?"niepotwierdzona":api.totalGross==null?"brak ceny API":zl(api.totalGross)}</span>${difference==null?"":`<span>Różnica: ${difference>0?"+":""}${zl(difference)}</span>`}</div>`;
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
  }else if(String(form?.elements?.sendingMethod?.value||"")==="parcel_locker"){
    rate=list.courierManager?.[template]||null;rateKey=rate?`courierManager.${template}`:"";
  }else{
    rate=(list.courierStandard||[]).find(item=>weight<=Number(item.maxKg))||null;rateKey=rate?`courierStandard.${rate.maxKg}`:"";
  }
  const selected=[],extras=list.extras||{};
  if(Number(form?.codAmount?.value)>0)selected.push(["Pobranie","codGross"]);
  if(Number(form?.insuranceAmount?.value)>0)selected.push(["Dodatkowa ochrona","insuranceGross"]);
  if(String(form?.elements?.weekend?.value||"")==="true")selected.push(["Paczka w Weekend","weekendGross"]);
  if(form?.elements?.sendingMethod?.value==="dispatch_order")selected.push(["Odbiór przez kuriera","pickupGross"]);
  if(form?.nonStandard?.checked)selected.push(["Element niestandardowy","nonStandardGross"]);
  form?.querySelectorAll('[name="additionalServices"]:checked').forEach(input=>{const labels={sms:["Powiadomienie SMS","smsGross"],email:["Powiadomienie e-mail","emailGross"],saturday:["Doręczenie w sobotę","saturdayGross"],dor1720:["Doręczenie 17:00–20:00","dor1720Gross"],rod:["Zwrot dokumentów","rodGross"]};if(labels[input.value])selected.push(labels[input.value]);});
  const unpricedOptions=selected.filter(([,key])=>extras[key]==null||extras[key]==="").map(([label])=>label),extrasGross=selected.reduce((sum,[,key])=>sum+(extras[key]==null||extras[key]===""?0:Number(extras[key])||0),0);
  const totalGross=rate?Math.round((Number(rate.gross||0)+extrasGross)*100)/100:null,rounded=totalGross==null?null:inpostServicePelnaCenaKlienta(totalGross);
  return {totalGross,currency:"PLN",source:rate?"contract_price_list":"unavailable",available:totalGross!=null,complete:totalGross!=null&&unpricedOptions.length===0,rateKey,rateLabel:rate?.label||"",contractNet:rate?.net??null,commissionGross:rounded?.commissionGross||0,customerTotalGross:rounded?.customerTotalGross??null,minimumCommissionGross:4,maximumCommissionGross:5,breakdown:{baseGross:rate?.gross??null,extrasGross:Math.round(extrasGross*100)/100,fuelIncluded:true},unpricedOptions,apiComparison:inpostServiceStan.pricing?.apiComparison||{totalGross:null},checkedAt:new Date().toISOString()};
}
function inpostServicePrzelicz(form){
  const manual=Math.max(0,Number(String(form?.carrierCostOverride?.value||"").replace(",","."))||0),rounded=manual>0?inpostServicePelnaCenaKlienta(manual):null;
  if(manual>0)inpostServiceStan.pricing={totalGross:manual,commissionGross:rounded.commissionGross,customerTotalGross:rounded.customerTotalGross,minimumCommissionGross:4,maximumCommissionGross:5,currency:"PLN",source:"manual",estimated:false,available:true,complete:true,breakdown:{},unpricedOptions:[],apiComparison:{totalGross:null}};
  else inpostServiceStan.pricing=inpostServiceLokalnaWycena(form);
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceZaplanujWycene(form){
  clearTimeout(inpostServiceWycenaTimer);
  inpostServiceNormalizujNadawceKlienta(form);
  inpostServiceAktualizujKartyStron(form);
  inpostServiceAktualizujAdresZwrotu(form);
  inpostServicePrzelicz(form);
  inpostServiceWycenaTimer=setTimeout(()=>inpostServiceWycena(form,false),650);
}
function inpostServiceAktualizujKartyStron(form){
  ["sender","receiver"].forEach(prefix=>{
    const summary=form?.querySelector?.(`[data-inpost-selected-contact="${prefix}"]`);if(!summary)return;
    summary.innerHTML=inpostServiceWybranyKontaktHTML(inpostServiceStronaOsoby(form,prefix),prefix);
  });
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
    if(e.code==="inpost_quote_validation"){inpostServiceBladPol(e.details,form,false);inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||"Uzupełnij dane nadania.",source:"validation"};}
    else inpostServiceStan.pricing={available:false,totalGross:null,message:e.message||String(e),source:"unavailable"};
  }
  inpostServiceAktualizujWyceneUI(form);
}
function inpostServiceUstawTyp(form,source=null){
  inpostServiceZastosujZgodnoscTypu(form,source?.name==="deliveryType");
  inpostServiceZaplanujWycene(form);
}
function inpostServiceOsobaFields(prefix,title,person={}){
  const a=person.address||{},selected=person.id||"";
  return `<fieldset class="inpost-party-card">
    <legend>${prefix==="sender"?"📤":"📥"} ${esc(title)}</legend>
    <input type="hidden" name="${prefix}ContactId" value="${esc(selected)}">
    <div class="inpost-contact-selector">
      <div class="inpost-selected-contact" data-inpost-selected-contact="${prefix}">${inpostServiceWybranyKontaktHTML(person,prefix)}</div>
      <div class="inpost-contact-selector-actions">
        <button class="btn" type="button" onclick="inpostServiceOtworzKsiazke(${jsArg(prefix)},this)">📒 Wybierz z książki</button>
        <button class="btn ghost" type="button" onclick="inpostServiceNowyAdres(${jsArg(prefix)},this)">＋ Nowy adres</button>
      </div>
    </div>
    <div class="inpost-form-grid">
      <label>Firma<input name="${prefix}Company" value="${esc(person.companyName||"")}"></label>
      <label>NIP<input name="${prefix}TaxCode" inputmode="numeric" maxlength="10" value="${esc(person.taxCode||"")}"></label>
      <label>Imię<input name="${prefix}FirstName" value="${esc(person.firstName||"")}"></label>
      <label>Nazwisko<input name="${prefix}LastName" value="${esc(person.lastName||"")}"></label>
      <label>E-mail *<input name="${prefix}Email" type="email" required value="${esc(person.email||"")}"></label>
      <label>Telefon *<input name="${prefix}Phone" inputmode="tel" required value="${esc(person.phone||"")}"></label>
      <label>Kod pocztowy ${prefix==="sender"?"*":""}<input name="${prefix}PostCode" ${prefix==="sender"?"required":"data-receiver-address"} pattern="\\d{2}-?\\d{3}" inputmode="numeric" autocomplete="postal-code" value="${esc(a.postCode||a.post_code||"")}" oninput="inpostServiceKodPocztowyWpis(this,${jsArg(prefix)})"></label>
      <label>Miasto ${prefix==="sender"?"*":""}<input name="${prefix}City" ${prefix==="sender"?"required":"data-receiver-address"} list="inpostService${prefix}CityHints" autocomplete="address-level2" value="${esc(a.city||"")}" oninput="inpostServiceMiastoWpis(this,${jsArg(prefix)})"><datalist id="inpostService${prefix}CityHints"></datalist></label>
      <div class="backend-note wide" data-inpost-postcode-hint="${prefix}" hidden></div>
      <label class="wide">Ulica ${prefix==="sender"?"*":""}<input name="${prefix}Street" ${prefix==="sender"?"required":"data-receiver-address"} list="inpostService${prefix}StreetHints" autocomplete="address-line1" value="${esc(a.street||"")}"><datalist id="inpostService${prefix}StreetHints"></datalist></label>
      <label>Nr budynku ${prefix==="sender"?"*":""}<input name="${prefix}Building" ${prefix==="sender"?"required":"data-receiver-address"} value="${esc(a.buildingNumber||a.building_number||"")}"></label>
      <label>Nr lokalu<input name="${prefix}Flat" value="${esc(a.flatNumber||a.flat_number||"")}"></label>
      ${prefix==="receiver"?'<button class="btn ghost wide" type="button" onclick="inpostServiceSzukajPunktowPrzyAdresie(\'receiver\')">📍 Znajdź Paczkomaty przy tym adresie</button>':""}
      <div class="inpost-contact-roles wide"><b>Używaj tego adresu jako</b><label><input type="checkbox" name="${prefix}RoleSender" ${prefix==="sender"?"checked":""}> Nadawca</label><label><input type="checkbox" name="${prefix}RoleReceiver" ${prefix==="receiver"?"checked":""}> Odbiorca</label></div>
      <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt(${jsArg(prefix)},this)">💾 Zapisz w książce</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt(${jsArg(prefix)},this)">Usuń zapis</button></div>
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
    <div class="order-section-head"><div><span class="order-pro-label">Koszty operacyjne</span><h3>Stawki InPost</h3></div><span class="lvl lvl-ok">aktywne</span></div>
    <div class="warehouse-worktable-wrap"><table class="log-table inpost-contract-table"><thead><tr><th>Usługa / przedział</th><th>Netto z paliwem</th><th>Brutto</th></tr></thead><tbody>
      ${inpostServiceCennikWiersze("Paczkomat® 24/7","locker",list.locker||{})}
      <tr class="inpost-rate-section"><th colspan="3">Kurier Standard</th></tr>
      ${courier.map((rate,index)=>`<tr><td>${esc(rate.label||`do ${rate.maxKg} kg`)}</td><td><input name="price_courier_${index}_net" type="number" min="0" step=".01" value="${esc(rate.net??0)}"></td><td><input name="price_courier_${index}_gross" type="number" min="0" step=".01" value="${esc(rate.gross??0)}"></td></tr>`).join("")}
      ${inpostServiceCennikWiersze("Kurier Manager Paczek","courierManager",list.courierManager||{})}
      ${inpostServiceCennikWiersze("Podaj dalej","handoff",list.handoff||{})}
      ${inpostServiceCennikWiersze("Szybkie zwroty","quickReturns",list.quickReturns||{})}
    </tbody></table></div>
    <details class="inpost-extra-rates"><summary>Dopłaty do usług dodatkowych</summary><div class="inpost-extra-grid">${extras.map(([key,label])=>`<label>${esc(label)}<input name="extra_${key}" type="number" min="0" step=".01" value="${list.extras?.[key]??""}" placeholder="stawka brutto"></label>`).join("")}</div></details>
  </section>`;
}
function inpostServiceCennikZForm(form){
  const current=inpostServiceStan.settings?.priceList||{},read=(name,fallback=null)=>{const raw=form.elements[name]?.value;if(raw==null||String(raw).trim()==="")return fallback;const value=Number(String(raw).replace(",","."));return Number.isFinite(value)?value:fallback;};
  const readGroup=(prefix,source={})=>Object.fromEntries(Object.entries(source).map(([key,rate])=>[key,{...rate,net:read(`price_${prefix}_${key}_net`,rate.net),gross:read(`price_${prefix}_${key}_gross`,rate.gross)}]));
  const extras={};["codGross","insuranceGross","weekendGross","pickupGross","smsGross","emailGross","saturdayGross","dor1720Gross","rodGross","nonStandardGross"].forEach(key=>{extras[key]=read(`extra_${key}`,null);});
  return {...current,locker:readGroup("locker",current.locker),courierStandard:(current.courierStandard||[]).map((rate,index)=>({...rate,net:read(`price_courier_${index}_net`,rate.net),gross:read(`price_courier_${index}_gross`,rate.gross)})),courierManager:readGroup("courierManager",current.courierManager),handoff:readGroup("handoff",current.handoff),quickReturns:readGroup("quickReturns",current.quickReturns),extras};
}
async function inpostServiceZapiszUstawienia(event){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),body={commissionGross:form.commissionGross?.value||4,defaultDeliveryType:form.defaultDeliveryType?.value||"locker",defaultSendingMethod:form.defaultSendingMethod?.value||"parcel_locker",defaultDropoffPoint:form.defaultDropoffPoint?.value||"",labelDefaultFormat:form.labelDefaultFormat?.value||"A6",labelOpenMode:form.labelOpenMode?.value||"preview",labelAutoPrint:form.labelAutoPrint?.checked===true,sender:inpostServiceStronaOsoby(form,"sender"),priceList:inpostServiceCennikZForm(form)};
  if(button){button.disabled=true;button.textContent="Zapisuję cennik…";}
  try{const d=await chmura("inpost-service-settings",{method:"POST",body,timeout:30000});inpostServiceStan.settings=d.settings||inpostServiceStan.settings;inpostServiceStan.pricing=null;toast("Cennik umowny, nadawca i prowizja zapisane ✅");renderuj();}catch(e){toast("Nie zapisano ustawień: "+(e.message||e));}
  finally{if(button){button.disabled=false;button.textContent="Zapisz cennik i ustawienia";}}
}
function inpostServicePrzejdzDoEtapu(id){
  const target=document.getElementById(String(id||""));if(!target)return;
  target.scrollIntoView({behavior:"smooth",block:"start"});
  try{target.focus({preventScroll:true});}catch(e){}
}
function inpostServiceFormHTML(){
  const sender=inpostServicePustyNadawcaKlienta(),settings=inpostServiceStan.settings||{},month=new Date().toISOString().slice(0,7),available=inpostServiceStan.serviceAvailability,defaultDelivery=settings.defaultDeliveryType==="courier"?"courier":"locker",defaultMethod=["parcel_locker","dispatch_order","pop"].includes(settings.defaultSendingMethod)?settings.defaultSendingMethod:"parcel_locker";
  return `<section class="panel inpost-service-create">
    <div class="order-section-head"><div><span class="order-pro-label">Nadanie klienta</span><h2>Utwórz przesyłkę InPost</h2></div><div class="diag-actions"><span class="lvl ${available?.locker?"lvl-ok":"lvl-ostrzezenie"}">Paczkomat ${available?.locker?"aktywny":"sprawdź"}</span><span class="lvl ${available?.courier?"lvl-ok":"lvl-ostrzezenie"}">Kurier ${available?.courier?"aktywny":"sprawdź"}</span></div></div>
    <form id="inpostServiceForm" onsubmit="inpostServiceUtworz(event)" oninput="inpostServiceZaplanujWycene(this)" onchange="inpostServiceZaplanujWycene(this)">
      <input type="hidden" name="requestId" value="${esc(inpostServiceStan.requestId||inpostServiceNowyRequestId())}">
      <nav class="inpost-process-steps" aria-label="Etapy nadania"><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-delivery')"><b>1</b><span>Doręczenie</span></button><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-party-receiver')"><b>2</b><span>Odbiorca</span></button><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-shipment-options')"><b>3</b><span>Paczka i nadanie</span></button><button type="button" onclick="inpostServicePrzejdzDoEtapu('inpost-settlement')"><b>4</b><span>Koszt i faktura</span></button></nav>
      <div class="inpost-shipment-builder">
        <fieldset id="inpost-delivery"><legend>Sposób doręczenia</legend>
          <div class="inpost-delivery-choice">
            <label class="inpost-choice-card"><input type="radio" name="deliveryType" value="locker" ${defaultDelivery==="locker"?"checked":""} onchange="inpostServiceUstawTyp(this.form,this)"><span><b>Paczkomat® 24/7</b><small>Doręczenie do automatu lub PaczkoPunktu</small></span></label>
            <label class="inpost-choice-card"><input type="radio" name="deliveryType" value="courier" ${defaultDelivery==="courier"?"checked":""} onchange="inpostServiceUstawTyp(this.form,this)"><span><b>InPost Kurier</b><small>Doręczenie bezpośrednio pod adres</small></span></label>
          </div>
          <div class="inpost-reference-row"><label>Numer referencyjny<input name="reference" required value="USL-${Date.now().toString(36).toUpperCase()}" placeholder="Nazwij swoją przesyłkę"></label><span><b>📒 ${inpostServiceStan.addressBook?.length||0}</b><small>adresów w książce</small></span></div>
        </fieldset>

        <fieldset id="inpost-party-sender" class="inpost-sender-context"><legend>Nadawca</legend>
          <input type="hidden" name="senderContactId" value="${esc(sender.id||"")}">
          <input type="checkbox" name="senderRoleSender" checked hidden>
          <div class="inpost-contact-selector"><div class="inpost-selected-contact" data-inpost-selected-contact="sender">${inpostServiceWybranyKontaktHTML(sender,"sender")}</div><div class="inpost-contact-selector-actions"><button class="btn" type="button" onclick="inpostServiceOtworzKsiazke('sender',this)">📒 Wybierz z książki</button><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres('sender',this)">＋ Nowy adres</button></div></div>
          <details><summary>Sprawdź lub popraw dane nadawcy</summary><div class="inpost-form-grid">
            <label>Firma<input name="senderCompany" value="${esc(sender.companyName||"")}"></label><label>NIP<input name="senderTaxCode" inputmode="numeric" maxlength="10" value="${esc(sender.taxCode||"")}"></label><label>Imię<input name="senderFirstName" value="${esc(sender.firstName||"")}"></label><label>Nazwisko<input name="senderLastName" value="${esc(sender.lastName||"")}"></label><label>E-mail *<input name="senderEmail" type="email" required value="${esc(sender.email||"")}"></label><label>Telefon *<input name="senderPhone" inputmode="tel" required value="${esc(sender.phone||"")}"></label><small class="wide inpost-technical-contact-note"><b>Na etykiecie nadawcą jest wybrany klient.</b> Dane firmowe Artway-TM nie są wstawiane do pola nadawcy. Brakujący e-mail lub telefon może być uzupełniony kontaktem technicznym Artway-TM, a rzeczywisty nadawca i jego adres zwrotu są zawsze dopisywane w uwagach.</small>
            <label>Kod pocztowy *<input name="senderPostCode" required pattern="\\d{2}-?\\d{3}" inputmode="numeric" autocomplete="postal-code" value="${esc(sender.address?.postCode||sender.address?.post_code||"")}" oninput="inpostServiceKodPocztowyWpis(this,'sender')"></label><label>Miasto *<input name="senderCity" required list="inpostServicesenderCityHints" autocomplete="address-level2" value="${esc(sender.address?.city||"")}" oninput="inpostServiceMiastoWpis(this,'sender')"><datalist id="inpostServicesenderCityHints"></datalist></label><div class="backend-note wide" data-inpost-postcode-hint="sender" hidden></div><label class="wide">Ulica *<input name="senderStreet" required list="inpostServicesenderStreetHints" autocomplete="address-line1" value="${esc(sender.address?.street||"")}"><datalist id="inpostServicesenderStreetHints"></datalist></label><label>Nr budynku *<input name="senderBuilding" required value="${esc(sender.address?.buildingNumber||sender.address?.building_number||"")}"></label><label>Nr lokalu<input name="senderFlat" value="${esc(sender.address?.flatNumber||sender.address?.flat_number||"")}"></label>
            <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt('sender',this)">💾 Zapisz w książce</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt('sender',this)">Usuń zapis</button></div><label class="check wide"><input type="checkbox" name="saveSender" checked> Zapamiętaj lub zaktualizuj nadawcę</label>
          </div></details>
        </fieldset>

        <fieldset id="inpost-party-receiver"><legend>Dane odbiorcy</legend>
          <input type="hidden" name="receiverContactId">
          <input type="checkbox" name="receiverRoleReceiver" checked hidden>
          <div class="inpost-contact-selector"><div class="inpost-selected-contact" data-inpost-selected-contact="receiver">${inpostServiceWybranyKontaktHTML({},"receiver")}</div><div class="inpost-contact-selector-actions"><button class="btn" type="button" onclick="inpostServiceOtworzKsiazke('receiver',this)">📒 Wybierz z książki</button><button class="btn ghost" type="button" onclick="inpostServiceNowyAdres('receiver',this)">＋ Nowy adres</button></div></div>
          <div class="inpost-form-grid">
            <label>E-mail *<input name="receiverEmail" type="email" required placeholder="Adres e-mail odbiorcy"></label><label>Telefon *<input name="receiverPhone" inputmode="tel" required placeholder="9 cyfr"></label><small class="wide inpost-technical-contact-note">Jeśli klient nie poda tych danych, formularz użyje kontaktu Artway-TM i oznaczy go jako techniczny.</small>
            <div class="wide" data-inpost-only="locker"><label>Punkt odbioru *<div class="inpost-inline"><input id="inpostServiceTargetPoint" name="targetPoint" required placeholder="Nazwa lub lokalizacja punktu"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape('target')">Mapa</button></div></label><div class="inpost-point-search"><input id="inpostServicePointSearch" placeholder="Miasto, kod, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow('target')">Szukaj</button><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktowPrzyAdresie('receiver','target')">Przy adresie</button></div><div id="inpostServicePointResults"></div></div>
            <div class="wide inpost-courier-address" data-inpost-only="courier"><div class="inpost-form-grid"><label>Imię i nazwisko<input name="receiverFirstName" placeholder="Imię"><input name="receiverLastName" placeholder="Nazwisko"></label><label>Nazwa firmy<input name="receiverCompany"></label><label>NIP<input name="receiverTaxCode" inputmode="numeric" maxlength="10"></label><label>Kod pocztowy *<input name="receiverPostCode" data-receiver-address pattern="\\d{2}-?\\d{3}" inputmode="numeric" autocomplete="postal-code" oninput="inpostServiceKodPocztowyWpis(this,'receiver')"></label><label>Miasto *<input name="receiverCity" data-receiver-address list="inpostServicereceiverCityHints" autocomplete="address-level2" oninput="inpostServiceMiastoWpis(this,'receiver')"><datalist id="inpostServicereceiverCityHints"></datalist></label><div class="backend-note wide" data-inpost-postcode-hint="receiver" hidden></div><label class="wide">Ulica *<input name="receiverStreet" data-receiver-address list="inpostServicereceiverStreetHints" autocomplete="address-line1"><datalist id="inpostServicereceiverStreetHints"></datalist></label><label>Nr budynku *<input name="receiverBuilding" data-receiver-address></label><label>Nr lokalu<input name="receiverFlat"></label></div></div>
            <div class="inpost-address-actions wide"><button class="btn ghost" type="button" onclick="inpostServiceZapiszKontakt('receiver',this)">💾 Dodaj odbiorcę do książki</button><button class="btn ghost danger" type="button" onclick="inpostServiceUsunKontakt('receiver',this)">Usuń zapis</button></div><label class="check wide"><input type="checkbox" name="saveReceiver" checked> Zapamiętaj lub zaktualizuj odbiorcę</label>
          </div>
        </fieldset>

        <fieldset id="inpost-shipment-options"><legend>Rozmiar paczki</legend>
          <div class="inpost-size-choice">
            ${[["small","A","maks. 8 × 38 × 64 cm"],["medium","B","maks. 19 × 38 × 64 cm"],["large","C","maks. 41 × 38 × 64 cm"],["xlarge","D","maks. 80 × 50 × 50 cm"]].map(([value,label,description],index)=>`<label class="inpost-choice-card" ${value==="xlarge"?'data-inpost-size="xlarge" data-inpost-only="courier"':""}><input type="radio" name="template" value="${value}" ${index===0?"checked":""} onchange="inpostServiceUstawGabaryt(this.form,'${value}')"><span><b>${label}</b><small>${description}</small></span></label>`).join("")}
          </div>
          <input type="hidden" name="length" value="64"><input type="hidden" name="width" value="38"><input type="hidden" name="height" value="8">
          <div class="inpost-form-grid inpost-parcel-details"><label>Waga (kg)<input name="weight" type="number" min=".01" max="30" step=".01" value="1"></label><label class="check" data-inpost-only="courier"><input type="checkbox" name="nonStandard"> Element niestandardowy</label><label class="wide">Dodatkowe uwagi (opcjonalne)<input name="comments" maxlength="100" placeholder="Adres zwrotny zostanie dopisany automatycznie"></label><div class="backend-note wide inpost-return-address"><b>Rzeczywisty nadawca i adres zwrotu w uwagach</b><span data-inpost-return-address>${esc(inpostServiceAdresZwrotuNotatka(sender)||"Uzupełnij adres nadawcy.")}</span></div></div>
        </fieldset>

        <fieldset><legend>Dodatkowe usługi</legend>
          <div class="inpost-extra-services">
            <label>Wartość pobrania<input name="codAmount" type="number" min="0" step=".01" placeholder="Wpisz kwotę, aby nadać za pobraniem"></label>
            <div><span>Dodatkowa ochrona</span><div class="inpost-protection-choice">${[[0,"Brak"],[5000,"Do 5 000 zł"],[10000,"Do 10 000 zł"],[20000,"Do 20 000 zł"]].map(([value,label],index)=>`<label class="inpost-choice-card compact"><input type="radio" name="insuranceAmount" value="${value}" ${index===0?"checked":""}><span><b>${label}</b></span></label>`).join("")}</div></div>
            <div data-inpost-only="locker"><span>Paczka w Weekend</span><div class="inpost-weekend-choice"><label class="inpost-choice-card compact"><input type="radio" name="weekend" value="false" checked><span><b>Nie</b></span></label><label class="inpost-choice-card compact"><input type="radio" name="weekend" value="true"><span><b>Tak</b></span></label></div></div>
            <div class="inpost-courier-extras" data-inpost-only="courier"><label class="check"><input type="checkbox" name="additionalServices" value="sms"> SMS</label><label class="check"><input type="checkbox" name="additionalServices" value="email"> E-mail</label><label class="check"><input type="checkbox" name="additionalServices" value="saturday"> Sobota</label><label class="check"><input type="checkbox" name="additionalServices" value="dor1720"> 17:00–20:00</label><label class="check"><input type="checkbox" name="additionalServices" value="rod"> Zwrot dokumentów</label></div>
          </div>
        </fieldset>

        <fieldset><legend>Sposób nadania</legend>
          <div class="backend-note inpost-method-compatibility" data-inpost-method-compatibility hidden><b>Domyślny Paczkomat nie jest dostępny dla Kuriera Standard.</b> InPost dopuszcza tutaj PaczkoPunkt/POP albo odbiór przez kuriera. Wybierz świadomie jedną z tych metod — formularz nie przełączy jej automatycznie.</div>
          <div class="inpost-method-choice">${inpostServiceMetodyNadania.locker.map(([value,label])=>`<label class="inpost-method-card" data-inpost-method-card><input type="radio" name="sendingMethod" value="${value}" ${value===defaultMethod?"checked":""} onchange="inpostServiceUstawTyp(this.form)"><span><b>${esc(label)}</b><small>${value==="parcel_locker"?"Wybierz automat nadawczy":value==="dispatch_order"?"Odbiór z adresu nadawcy":"Nadaj w obsługiwanym punkcie"}</small></span></label>`).join("")}</div>
          <div class="inpost-dropoff-panel" data-inpost-dropoff-panel hidden><label><span data-inpost-dropoff-label>Automat nadawczy *</span><div class="inpost-inline"><input id="inpostServiceDropoffPoint" name="dropoffPoint" value="${esc(settings.defaultDropoffPoint||"")}" placeholder="Wybierz automat nadawczy"><button class="btn ghost" type="button" onclick="inpostServiceOtworzMape('dropoff')">Mapa</button></div><small data-inpost-dropoff-hint></small></label><div class="inpost-point-search"><input id="inpostServiceDropoffSearch" placeholder="Miasto, kod, ulica lub kod punktu"><button class="btn ghost" type="button" onclick="inpostServiceSzukajPunktow('dropoff')">Szukaj</button></div><div id="inpostServiceDropoffResults"></div></div>
        </fieldset>

        <div class="inpost-options-layout">
        <fieldset class="inpost-billing-card" id="inpost-settlement"><legend>💰 Koszt i faktura Artway‑TM</legend>
          <div class="inpost-pricing-layout"><div data-inpost-pricing></div><div class="inpost-pricing-controls"><label>Pełny koszt ręczny — tylko awaryjnie<input name="carrierCostOverride" type="number" min="0" step=".01" placeholder="zastępuje cennik umowny"></label><button class="btn ghost" type="button" onclick="inpostServiceWycena(this.form,true)">↻ Przelicz według umowy</button><a class="btn ghost" href="#/admin/wysylki/inpost-ustawienia">Otwórz cennik</a></div></div>
          <div class="inpost-settlement-grid">
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="none" checked><span><b>Bez faktury</b><small>Tylko nadanie i rejestr kosztu</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="single"><span><b>FV od razu</b><small>Artway‑TM wystawia koszt nadania + prowizję</small></span></label>
            <label class="inpost-settlement-option"><input type="radio" name="billingMode" value="monthly"><span><b>FV miesięczna</b><small>Dopisz całe nadanie do rozliczenia klienta</small></span></label>
          </div>
          <div class="inpost-form-grid"><label>Miesiąc rozliczenia<input name="billingMonth" type="month" value="${esc(month)}"></label><label>Pierwszy przedział prowizji<input value="4–5 zł" readonly><input name="commissionGross" type="hidden" value="4"><small>Cena końcowa jest zawsze zaokrąglana w górę do pełnej złotówki.</small></label></div>
          <div class="backend-note"><b>FV: Artway‑TM → nadawca.</b> Odbiorca pozostaje wyłącznie stroną doręczenia.</div>
        </fieldset>
      </div>
      </div>
      <div class="inpost-form-errors" data-inpost-form-errors hidden></div>
      <div class="inpost-create-footer"><button class="btn" type="submit">🟡 Utwórz przesyłkę InPost</button></div>
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
      <td data-label="Wybór"><label class="inpost-confirm-checkbox"><input type="checkbox" data-inpost-confirm-checkbox ${inpostServicePotwierdzenieWybrane.has(item.id)?"checked":""} onchange="inpostServiceZaznaczPotwierdzenie(${jsArg(item.id)},this.checked,this)"><span>Do wspólnego potwierdzenia</span></label></td>
      <td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"numer oczekuje")}</small><br><small>${esc(allegroDataTxt(item.createdAt))}</small></td>
      <td data-label="Odbiorca"><b>${esc(inpostServiceNazwaKontaktu(item.receiver))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.receiver))}</small><br><small>${esc(item.receiver?.email||"")}</small></td>
      <td data-label="Usługa">${item.deliveryType==="locker"?"📮 Paczkomat":"🚚 Kurier"}${item.targetPoint?`<br><small>${esc(item.targetPoint)}</small>`:""}${item.weekend?'<br><span class="lvl lvl-info">Weekend</span>':""}${item.cod?.enabled?`<br><span class="lvl lvl-info">pobranie ${zl(item.cod.amount)}</span>`:""}</td>
      <td data-label="Koszt">${inpostServiceKosztHTML(item)}</td>
      <td data-label="Status">${label}<br><small>${events.length} zdarzeń • aktualizacja ${esc(inpostServiceDataPotwierdzenia(item.trackingUpdatedAt||item.updatedAt))}</small></td>
      <td data-label="Rozliczenie">${inpostServiceBillingLabel(item)}<br><small>FV klienta: ${item.billing?.mode==="none"?"—":zl(item.pricing?.customerTotalGross||0)}</small></td>
      <td data-label="Akcje"><div class="inpost-row-actions"><button class="btn receipt" onclick="inpostServicePotwierdzenie(${jsArg(item.id)})">🖨️ Potwierdzenie</button><button class="btn ghost" onclick="inpostServiceStatus(${jsArg(item.id)})">↻ Status</button>${item.labelReady?`<button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A6')">A6</button><button class="btn ghost" onclick="inpostServiceEtykieta(${jsArg(item.id)},'A4')">A4</button>`:""}${item.labelReady&&!item.pickup?.id?`<button class="btn ghost" onclick="inpostServiceOdbior(${jsArg(item.id)})">🚚 Zamów kuriera</button>`:""}${item.billing?.mode==="single"&&!["processing","created"].includes(String(item.billing?.link?.status||item.billing?.status))?`<button class="btn" ${item.pricing?.complete===true?"":"disabled title='Uzupełnij koszt przesyłki'"} onclick="inpostServiceFaktura(${jsArg(item.id)})">FV inFakt</button>`:""}${["creating","created"].includes(item.status)?`<button class="btn danger" onclick="inpostServiceAnuluj(${jsArg(item.id)})">Anuluj</button>`:""}</div></td>
    </tr>`;
  };
  return `<section class="panel inpost-service-history"><div class="order-section-head"><div><span class="order-pro-label">Rejestr</span><h2>Nadania i tracking</h2></div><button class="btn ghost" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div>${adminWyszukiwaniePanelHTML({id:"inpost-service-history",description:"Numer, klient, tracking lub rozliczenie.",fields,results:rows.length,active:!!(inpostServiceSzukaj||inpostServiceFiltr!=="wszystkie"||inpostServiceBillingFiltr!=="wszystkie"),open:true})}<div class="inpost-batch-confirmation"><div><b>Jedno potwierdzenie dla wielu paczek</b><small>Zaznacz przesyłki tego samego zleceniodawcy. Wybrano: <strong data-inpost-confirm-count>${inpostServicePotwierdzenieWybrane.size}</strong></small></div><div><button class="btn receipt" data-inpost-confirm-selected ${inpostServicePotwierdzenieWybrane.size?"":"disabled"} onclick="inpostServicePotwierdzenieZbiorcze()">🖨️ Potwierdzenie zbiorcze A4</button><button class="btn ghost" data-inpost-confirm-clear ${inpostServicePotwierdzenieWybrane.size?"":"disabled"} onclick="inpostServiceWyczyscWyborPotwierdzenia()">Wyczyść wybór</button></div></div><div class="warehouse-worktable-wrap"><table class="log-table inpost-service-table admin-responsive-table"><thead><tr><th>Wybór</th><th>Nadanie</th><th>Odbiorca</th><th>Usługa</th><th>Koszt</th><th>Status i historia</th><th>Rozliczenie</th><th>Akcje</th></tr></thead><tbody>${rows.map(row).join("")||'<tr><td colspan="8">Brak nadań pasujących do filtrów.</td></tr>'}</tbody></table></div></section>`;
}
function inpostServiceMiesieczneHTML(){
  const groups=inpostServiceStan.billing?.groups||[];if(!groups.length)return "";
  return `<section class="panel inpost-monthly-billing"><div class="order-section-head"><div><span class="order-pro-label">Faktury Artway‑TM</span><h2>Rozliczenia miesięczne</h2></div><a class="btn ghost" href="#/admin/infakt/wysylki">Otwórz w inFakt</a></div><div class="inpost-monthly-grid">${groups.map(group=>`<article><div><b>${esc(group.companyName||group.clientKey)}</b><small>${esc(group.month)} • ${group.count} nadań${group.taxCode?` • NIP ${esc(group.taxCode)}`:""}</small><small>Koszt nadań ${zl(group.carrierGross||0)} + prowizja ${zl(group.commissionGross||0)}</small>${group.incompletePrices?`<span class="lvl lvl-ostrzezenie">${group.incompletePrices} niepełnych wycen</span>`:""}</div><strong>${zl(group.customerTotalGross||0)}</strong><button class="btn" ${group.incompletePrices?"disabled title='Najpierw uzupełnij koszty'":""} onclick="inpostServiceFakturaMiesieczna(${jsArg(group.month)},${jsArg(group.clientKey)})">Utwórz FV Artway‑TM</button></article>`).join("")}</div></section>`;
}
function inpostServicePanelLadowania(){
  if(!inpostServiceStan.loaded&&!inpostServiceStan.loading)setTimeout(()=>inpostServiceLaduj(false,true),0);
  if(inpostServiceStan.loading&&!inpostServiceStan.loaded)return '<div class="panel"><div class="admin-loading-state">⏳ Pobieram konfigurację i rejestr InPost…</div></div>';
  return "";
}
function inpostServiceStatystykiHTML(){
  const billing=inpostServiceStan.billing||{};
  return `<section class="inpost-service-stats"><article><span>📦</span><b>${inpostServiceStan.items.length}</b><small>nadań</small></article><article><span>📤</span><b>${inpostServiceAdresy().filter(c=>(c.roles||[]).includes("sender")).length}</b><small>nadawców</small></article><article><span>📥</span><b>${inpostServiceAdresy().filter(c=>(c.roles||[]).includes("receiver")).length}</b><small>odbiorców</small></article><article><span>🧾</span><b>${zl(billing.customerPendingGross||0)}</b><small>do FV miesięcznych</small></article></section>`;
}
function inpostServiceBladHTML(){return inpostServiceStan.error?`<div class="backend-note error"><b>Błąd:</b> ${esc(inpostServiceStan.error)}</div>`:"";}
function panelRejestruWysylekInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  return `<div class="inpost-service-workspace">${inpostServiceStatystykiHTML()}${inpostServiceBladHTML()}${inpostServiceMiesieczneHTML()}${inpostServiceHistoriaHTML()}</div>`;
}
function inpostServiceUstawieniaGlowneHTML(){
  const settings=inpostServiceStan.settings||{},delivery=settings.defaultDeliveryType==="courier"?"courier":"locker",method=["parcel_locker","dispatch_order","pop"].includes(settings.defaultSendingMethod)?settings.defaultSendingMethod:"parcel_locker";
  return `<section class="panel inpost-service-defaults"><div class="order-section-head"><div><span class="order-pro-label">Domyślne wartości</span><h2>Nadanie i etykiety</h2><p class="order-detail-lead">Te ustawienia są używane przy każdym nowym formularzu. Nadal można je zmienić dla konkretnej paczki.</p></div></div><div class="inpost-form-grid"><label>Domyślne doręczenie<select name="defaultDeliveryType"><option value="locker" ${delivery==="locker"?"selected":""}>Paczkomat / PaczkoPunkt</option><option value="courier" ${delivery==="courier"?"selected":""}>Kurier InPost</option></select></label><label>Domyślny sposób nadania<select name="defaultSendingMethod"><option value="parcel_locker" ${method==="parcel_locker"?"selected":""}>Nadanie w Paczkomacie</option><option value="dispatch_order" ${method==="dispatch_order"?"selected":""}>Odbiór przez kuriera</option><option value="pop" ${method==="pop"?"selected":""}>Nadanie w PaczkoPunkcie</option></select></label><label>Domyślny automat nadawczy<input name="defaultDropoffPoint" value="${esc(settings.defaultDropoffPoint||"")}" placeholder="np. BOJ01N"></label><label>Domyślny format etykiety<select name="labelDefaultFormat"><option value="A6" ${settings.labelDefaultFormat!=="A4"?"selected":""}>A6 — drukarka etykiet</option><option value="A4" ${settings.labelDefaultFormat==="A4"?"selected":""}>A4 — Brother</option></select></label><label>Otwieranie etykiety<select name="labelOpenMode"><option value="preview" ${settings.labelOpenMode!=="browser"?"selected":""}>Podgląd przed drukiem</option><option value="browser" ${settings.labelOpenMode==="browser"?"selected":""}>Nowa karta PDF</option></select></label><label class="check"><input name="labelAutoPrint" type="checkbox" ${settings.labelAutoPrint===true?"checked":""}> Otwieraj okno drukowania automatycznie</label></div></section>`;
}
function panelUstawienWysylkiInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  return `<div class="inpost-service-workspace">${inpostServiceBladHTML()}<form id="inpostServiceSettingsForm" class="inpost-service-settings-page" onsubmit="inpostServiceZapiszUstawienia(event)">${inpostServiceUstawieniaGlowneHTML()}<section class="panel">${inpostServiceCennikHTML()}</section><section class="panel">${inpostServiceOsobaFields("sender","Stałe dane nadawcy",inpostServiceNadawca())}</section><div class="panel inpost-settings-footer"><label>Pierwszy przedział prowizji<input value="4–5 zł" readonly><input name="commissionGross" type="hidden" value="4"><small>Cena końcowa jest zawsze zaokrąglana w górę do pełnej złotówki.</small></label><button class="btn" type="submit">💾 Zapisz ustawienia InPost</button></div></form></div>`;
}
function panelOdbioruKurieraInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  const active=(inpostServiceStan.items||[]).filter(item=>item.labelReady&&item.status!=="cancelled"),waiting=active.filter(item=>!item.pickup?.id),booked=active.filter(item=>item.pickup?.id);
  const rows=items=>items.map(item=>`<tr><td data-label="Nadanie"><b>${esc(item.reference||item.id)}</b><br><small>${esc(item.trackingNumber||"")}</small></td><td data-label="Nadawca"><b>${esc(inpostServiceNazwaKontaktu(item.sender))}</b><br><small>${esc(inpostServiceAdresKsiazki(item.sender))}</small></td><td data-label="Paczka">${item.deliveryType==="courier"?"Kurier":"Paczkomat"} • ${esc(item.parcel?.template||"")} • ${esc(item.parcel?.weight||1)} kg</td><td data-label="Odbiór">${item.pickup?.id?`<span class="lvl lvl-ok">zlecony</span><br><small>${esc(item.pickup.status||item.pickup.id)}</small>`:`<button class="btn" type="button" onclick="inpostServiceOdbior(${jsArg(item.id)})">🚚 Zamów kuriera</button>`}</td></tr>`).join("");
  return `<div class="inpost-service-workspace">${inpostServiceBladHTML()}<section class="panel"><div class="order-section-head"><div><span class="order-pro-label">Gotowe etykiety</span><h2>Paczki do zgłoszenia kurierowi</h2><p class="order-detail-lead">Kliknięcie „Zamów kuriera” wysyła osobne zlecenie odbioru do InPost dopiero dla wybranej paczki.</p></div><button class="btn ghost" type="button" onclick="inpostServiceLaduj(true,false)">↻ Odśwież</button></div><div class="warehouse-worktable-wrap"><table class="log-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Nadawca</th><th>Paczka</th><th>Odbiór</th></tr></thead><tbody>${rows(waiting)||'<tr><td colspan="4">Brak paczek oczekujących na zlecenie odbioru.</td></tr>'}</tbody></table></div></section>${booked.length?`<section class="panel"><h2>Odbiory już zlecone</h2><div class="warehouse-worktable-wrap"><table class="log-table admin-responsive-table"><thead><tr><th>Nadanie</th><th>Nadawca</th><th>Paczka</th><th>Odbiór</th></tr></thead><tbody>${rows(booked)}</tbody></table></div></section>`:""}</div>`;
}
function panelWysylkiUslugowejInpost(){
  const loading=inpostServicePanelLadowania();if(loading)return loading;
  setTimeout(()=>{const form=document.getElementById("inpostServiceForm");inpostServiceUstawTyp(form);inpostServiceAktualizujWyceneUI(form);inpostServiceAdresPodpowiedzi(form,"sender");inpostServiceAdresPodpowiedzi(form,"receiver");},0);
  return `<div class="inpost-service-workspace">${inpostServiceStatystykiHTML()}${inpostServiceBladHTML()}${inpostServiceFormHTML()}${inpostServiceMiesieczneHTML()}</div>`;
}
