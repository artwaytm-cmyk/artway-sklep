function agentAINormalizuj(s=""){
  const mapa={"ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z"};
  return String(s||"").toLowerCase()
    .replace(/[ąćęłńóśźż]/g,m=>mapa[m]||m)
    .replace(/[@#]/g," ")
    .replace(/[^\p{L}\p{N}/._-]+/gu," ")
    .replace(/\s+/g," ")
    .trim();
}
function agentAIMa(n,arr){ return arr.some(x=>x instanceof RegExp?x.test(n):n.includes(x)); }
function agentAIWytnijProdukt(n){
  let q=` ${n} `;
  ["ile mamy","ile jest","jaki stan","stan produktu","sprawdz produkt","sprawdz","znajdz","pokaz","czy mamy","gdzie lezy","gdzie jest","lokalizacja","produkt","towar","sku","kod","na magazynie","w magazynie","w sklepie","mi","prosze"].forEach(f=>{q=q.replaceAll(` ${f} `," ");});
  return q.replace(/\s+/g," ").trim();
}
function agentAIWytnijProduktAllegro(n=""){
  return String(n||"")
    .replace(/\b(?:wystaw|dodaj|utworz|stworz|zrob|aktualizuj|odswiez|polacz|podepnij|aktywuj|dezaktywuj)\b/g," ")
    .replace(/\b(?:oferte|oferta|produkt|na|do|w|przez|allegro|agent|prosze)\b/g," ")
    .replace(/\s+/g," ").trim();
}
function agentAIZapiszPamiec(tresc="", meta={}){
  const czysta=String(tresc||"").trim();
  if(!czysta) return null;
  let wyzwalacz=String(meta.wyzwalacz||"").trim(), akcja=String(meta.akcja||czysta).trim();
  const m=czysta.match(/^(?:gdy|kiedy)\s+(?:napisze|napiszę|powiem|wpisze|wpiszę)\s+["„]?(.+?)["”]?\s*(?:to|->|=>|:)\s*(.+)$/i) || czysta.match(/^(.+?)\s*(?:->|=>)\s*(.+)$/);
  if(m){ wyzwalacz=m[1].trim(); akcja=m[2].trim(); }
  const rec={id:"MEM-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),tresc:czysta,wyzwalacz,akcja,typ:meta.typ||"procedura",tagi:Array.isArray(meta.tagi)?meta.tagi:[],data:new Date().toISOString(),dataTxt:new Date().toLocaleString("pl-PL"),operator:sesja?.email||"administrator"};
  agentAIPamiec=[rec,...(Array.isArray(agentAIPamiec)?agentAIPamiec:[])].slice(0,500);
  zapiszLS("artway_agent_ai_pamiec",agentAIPamiec);
  zapiszHistorieAgenta("pamięć",`Agent zapamiętał: ${skrocTekst(czysta,120)}`,{pamiec:rec});
  return rec;
}
function agentAIWytnijPamiec(raw=""){
  return String(raw||"").replace(/^\s*(zapamietaj|zapamiętaj|naucz sie|naucz się|dodaj do pamieci|dodaj do pamięci|procedura)\s*[:,-]?\s*/i,"").trim();
}
function agentAIUsunPamiec(id){
  const przed=(agentAIPamiec||[]).length;
  agentAIPamiec=(agentAIPamiec||[]).filter(x=>x.id!==id);
  zapiszLS("artway_agent_ai_pamiec",agentAIPamiec);
  if(agentAIPamiec.length!==przed){ zapiszHistorieAgenta("pamięć","Usunięto wpis pamięci agenta",{id}); toast("Usunięto wpis pamięci"); renderuj(); }
}
function agentAIPamiecTekst(limit=12){
  const lista=(agentAIPamiec||[]).slice(0,limit);
  if(!lista.length) return "Pamięć agenta jest pusta. Napisz np. „zapamiętaj: przy niskim stanie najpierw sprawdzamy dostawcę Pinkfrog”.";
  return ["🧠 Pamięć/procedury agenta:",...lista.map((x,i)=>`• ${i+1}. ${x.wyzwalacz?`Gdy: ${x.wyzwalacz} → `:""}${x.akcja||x.tresc} (${x.dataTxt||""})`)].join("\n");
}
function agentAIZnajdzPamiecDlaPolecenia(tekst=""){
  const n=agentAINormalizuj(tekst), slowa=n.split(" ").filter(w=>w.length>2);
  return (agentAIPamiec||[]).filter(x=>{
    const wyz=agentAINormalizuj(x.wyzwalacz||"");
    const hay=agentAINormalizuj([x.wyzwalacz,x.akcja,x.tresc].filter(Boolean).join(" "));
    if(wyz && (n.includes(wyz)||wyz.includes(n))) return true;
    const trafienia=slowa.filter(w=>hay.includes(w)).length;
    return slowa.length>=2 && trafienia>=Math.min(3,slowa.length);
  }).slice(0,5);
}
function agentAILokalizacjeTekst(){
  const stat=statystykiLokalizacji(), aktywne=magazynLokalizacjeAktywne();
  if(!aktywne.length) return "Nie ma jeszcze utworzonych lokalizacji magazynowych. Utwórz je w Magazyn → Lokalizacje albo napisz: „utwórz lokalizację R1-P1”.";
  return ["🗺️ Lokalizacje magazynu:",...aktywne.map(l=>{
    const s=stat[l.kod]||{produkty:0,sztuki:0,rezerwacje:0,wartosc:0};
    return `• ${l.kod}${l.nazwa?` — ${l.nazwa}`:""}; typ: ${l.typ||"—"}; strefa: ${l.strefa||"—"}; produkty: ${s.produkty}; sztuki: ${s.sztuki}; rezerwacje: ${s.rezerwacje}; wartość: ${zl(s.wartosc)}`;
  })].join("\n");
}
function agentAIProduktyZProblememOpisu(limit=500){
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>{
    const braki=[];
    if(!String(p.opisKrotki||"").trim()) braki.push("brak krótkiego opisu");
    if(!String(p.opis||"").trim()) braki.push("brak pełnego opisu");
    if(String(p.opis||"").replace(/\s+/g," ").trim().length>450 && !/\n/.test(String(p.opis||""))) braki.push("pełny opis wymaga formatowania");
    if(String(p.opisKrotki||"").length>360) braki.push("krótki opis jest za długi");
    return braki.length?{produkt:p,braki}:null;
  }).filter(Boolean).slice(0,limit);
}
function agentAIOpisyTekst(limit=12){
  const lista=agentAIProduktyZProblememOpisu(limit);
  if(!lista.length) return "Opisy produktów wyglądają poprawnie: krótkie opisy są uzupełnione, a pełne opisy nie wymagają pilnej korekty.";
  return ["📝 Produkty do poprawy opisów:",...lista.map((x,i)=>`• ${i+1}. ${x.produkt.nazwa} — ${x.braki.join(", ")}`),"Napisz „popraw opisy produktów”, żeby agent uzupełnił krótkie opisy i uporządkował pełne opisy."].join("\n");
}
function agentAIPoprawOpisyProduktow(limit=40){
  const lista=agentAIProduktyZProblememOpisu(limit);
  let zmienione=0;
  for(const x of lista){
    const p=x.produkt, poprawiony=agentAIPoprawOpisyDanychProduktu(p);
    if(JSON.stringify({a:p.opisKrotki||"",b:p.opis||""})===JSON.stringify({a:poprawiony.opisKrotki||"",b:poprawiony.opis||""})) continue;
    const idx=produktyDodane.findIndex(d=>Number(d.id)===Number(p.id));
    if(idx>=0) produktyDodane[idx]={...produktyDodane[idx],...poprawiony,id:p.id};
    else produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),opisKrotki:poprawiony.opisKrotki,opis:poprawiony.opis};
    zmienione++;
  }
  if(zmienione){
    zapiszStanProduktowPoOperacji();
    zbudujProdukty();
    zapiszHistorieAgenta("opisy-produktow",`Agent AI poprawił opisy produktów: ${zmienione}`,{limit,zmienione});
    if(chmuraToken) void chmuraZapiszUstawienia();
  }
  return `Agent sprawdził opisy. Poprawiono: ${zmienione}. Do kontroli po akcji: ${agentAIProduktyZProblememOpisu(500).length}.`;
}
function agentAIRozpoznajPolecenie(tekst=""){
  const raw=String(tekst||"").trim(), n=agentAINormalizuj(raw);
  if(!n) return {typ:"pomoc",raw,confidence:1};
  const urlMatch=raw.match(/https?:\/\/\S+/i);
  if(urlMatch&&agentAIMa(n,["sprawdz link","sprawdź link","pobierz z link","znajdz przez link","znajdź przez link","przeanalizuj link","uzupelnij z link","uzupełnij z link","dodaj produkt z link","dodaj z link","przygotuj produkt z link"]))return {typ:"link-producenta-analiza",url:urlMatch[0],addProduct:agentAIMa(n,["dodaj produkt","dodaj z link","przygotuj produkt"]),raw,confidence:.99};
  const slash=n.split(/\s+/)[0].split("@")[0];
  if(slash.startsWith("/")){
    if(["/start","/pomoc","/help"].includes(slash)) return {typ:"pomoc",raw,confidence:1};
    if(slash==="/status") return {typ:"status",raw,confidence:1};
    if(slash==="/magazyn") return {typ:"magazyn",raw,confidence:1};
    if(slash==="/braki") return {typ:"braki",raw,confidence:1};
    if(["/opisy","/opis"].includes(slash)) return {typ:n.includes("popraw")?"opisy-popraw":"opisy",raw,confidence:1};
    if(slash==="/zamowienia") return {typ:"zamowienia",raw,confidence:1};
    if(["/centrum","/priorytety","/dzis"].includes(slash)) return {typ:"centrum",raw,confidence:1};
    if(["/wiadomosci","/dyskusje"].includes(slash)) return {typ:"komunikacja",raw,confidence:1};
    if(["/wysylki","/inpost"].includes(slash)) return {typ:"wysylki",raw,confidence:1};
    if(slash==="/produkty") return {typ:"produkty-audyt",raw,confidence:1};
    if(["/producenci","/dostawcy"].includes(slash)) return {typ:"producenci",raw,confidence:1};
    if(["/diagnostyka","/integracje"].includes(slash)) return {typ:"diagnostyka",raw,confidence:1};
    if(["/zlecenie","/zamow"].includes(slash)) return {typ:"zlecenie",tryb:n.includes("nisk")?"niskie":"braki",raw,confidence:1};
    if(["/sprawdz","/check"].includes(slash)) return {typ:"sprawdz",raw,confidence:1};
    if(slash==="/wykonaj") return {typ:n.includes("blad")||n.includes("błąd")?"plan-retry":n.includes("dane")||n.includes("pobier")?"plan-data":n.includes("funkcj")||n.includes("stron")?"plan-health":"plan-wykonaj",raw,confidence:1};
  }
  if(agentAIMa(n,["pomoc","co potrafisz","jakie polecenia","co mozesz","instrukcja"])) return {typ:"pomoc",raw,confidence:.95};
  if(agentAIMa(n,["ponow bledy","ponów błędy","ponow nieudane kroki","ponów nieudane kroki","sprobuj jeszcze raz bledne","spróbuj jeszcze raz błędne"])) return {typ:"plan-retry",raw,confidence:.99};
  if(agentAIMa(n,["pobierz swieze dane","pobierz świeże dane","odswiez wszystkie dane","odśwież wszystkie dane","wykonaj samo pobieranie","sprawdz zrodla danych","sprawdź źródła danych"])) return {typ:"plan-data",raw,confidence:.99};
  if(agentAIMa(n,["sprawdz sama strone","sprawdź samą stronę","kontrola funkcjonalnosci","kontrola funkcjonalności","sprawdz funkcjonalnosc strony","sprawdź funkcjonalność strony"])) return {typ:"plan-health",raw,confidence:.99};
  if(agentAIMa(n,["wykonaj bezpieczny plan","wykonaj plan agenta","wykonaj konkretne dzialania","wykonaj konkretne działania","zrob bezpieczne dzialania","zrób bezpieczne działania","sprawdz funkcjonalnosc i pobierz dane","sprawdź funkcjonalność i pobierz dane"])) return {typ:"plan-wykonaj",raw,confidence:.99};
  if(agentAIMa(n,["wyslij raport na telegram","wyślij raport na telegram","raport telegram","telegram raport","podsumowanie na telegram"])) return {typ:"raport-telegram",raw,confidence:.98};
  if(agentAIMa(n,["centrum operacyjne","plan dnia","co mam zrobic","co mam zrobić","co mam dzisiaj zrobic","co mam dzisiaj zrobić","najwazniejsze zadania","najważniejsze zadania","pokaz priorytety","pokaż priorytety","co jest pilne","co wymaga decyzji","pokaż decyzje","pokaz decyzje","raport calej strony","raport całej strony"])) return {typ:"centrum",raw,confidence:.96};
  if(agentAIMa(n,["wiadomosci allegro","wiadomości allegro","dyskusje allegro","komunikacja z klientami","pokaz komunikacje","pokaż komunikację","komunikacja allegro","komu odpisac","komu odpisać","sprawy do odpowiedzi"])) return {typ:"komunikacja",raw,confidence:.95};
  if(agentAIMa(n,["wysylki","wysyłki","etykiety inpost","przesylki bez numeru","przesyłki bez numeru","status inpost","co wyslac","co wysłać"])) return {typ:"wysylki",raw,confidence:.93};
  if(agentAIMa(n,["audyt produktow","audyt produktów","stan katalogu","braki danych produktow","braki danych produktów","produkty do poprawy","jak wyglada katalog","jak wygląda katalog"])) return {typ:"produkty-audyt",raw,confidence:.92};
  if(agentAIMa(n,["status producentow","status producentów","dostawcy i producenci","zamowienia producentow","zamówienia producentów","otwarte dokumenty producentow","otwarte dokumenty producentów"])) return {typ:"producenci",raw,confidence:.92};
  if(agentAIMa(n,["diagnostyka integracji","status integracji","sprawdz integracje","sprawdź integracje","email inpost paynow","czy integracje dzialaja","czy integracje działają"])) return {typ:"diagnostyka",raw,confidence:.94};
  if(agentAIMa(n,["zapamietaj","zapamiętaj","naucz sie","naucz się","dodaj do pamieci","dodaj do pamięci","procedura:"])) return {typ:"pamiec-zapis",tresc:agentAIWytnijPamiec(raw),raw,confidence:.95};
  if(agentAIMa(n,["pokaz pamiec","pokaż pamięć","co pamietasz","co pamiętasz","lista procedur","pokaz procedury","pokaż procedury"])) return {typ:"pamiec-lista",raw,confidence:.95};
  if(agentAIMa(n,["pokaz lokalizacje","pokaż lokalizacje","lista lokalizacji","lokalizacje magazynu","mapa magazynu"])) return {typ:"lokalizacje",raw,confidence:.9};
  if(agentAIMa(n,["popraw opisy","popraw opisy produktow","popraw opisy produktów","uporzadkuj opisy","uporządkuj opisy","wygeneruj krotkie opisy","wygeneruj krótkie opisy"])) return {typ:"opisy-popraw",raw,confidence:.94};
  if(agentAIMa(n,["sprawdz opisy","sprawdź opisy","audyt opisow","audyt opisów","lista opisow","lista opisów","czy opisy sa dobre","czy opisy są dobre"])) return {typ:"opisy",raw,confidence:.92};
  if(agentAIMa(n,["sprawdz dostepnosc u producentow","sprawdź dostępność u producentów","sprawdz stany producentow","sprawdź stany producentów","monitoring producentow","monitoring producentów","niski stan u producenta","braki u producentow","braki u producentów"])) return {typ:"dostepnosc-producentow-sprawdz",raw,confidence:.97};
  if(agentAIMa(n,["sprawdz linki producentow","sprawdź linki producentów","pobierz linki producentow","pobierz linki producentów","pobierz produkty z linkow","pobierz produkty z linków","ponow pobieranie linkow","ponów pobieranie linków"])) return {typ:"linki-producentow-sprawdz",raw,confidence:.93};
  if(agentAIMa(n,["pokaz linki producentow","pokaż linki producentów","linki producentow","linki producentów","kolejka linkow","kolejka linków","url producenta"])) return {typ:"linki-producentow",raw,confidence:.92};
  if(agentAIMa(n,["utworz lokalizacje","utwórz lokalizację","dodaj lokalizacje","dodaj lokalizację"])){
    const kod=kodLokalizacjiMagazynu(n.replace(/.*(?:utworz|utworzz|utwórz|dodaj)\s+lokalizacj[eaęi]\s*/,"").split(" ")[0]||"");
    return {typ:"lokalizacja-dodaj",kod,raw,confidence:.82};
  }
  if(agentAIMa(n,["synchronizuj","synchronizacja","odswiez baze","odswiez dane","polacz baze","zapisz na serwerze"])) return {typ:"sync",raw,confidence:.95};
  if(agentAIMa(n,["utworz szkice fv","stworz szkice fv","brakujace szkice","faktury","infakt"])) return {typ:"faktury",raw,confidence:.9};
  if(agentAIMa(n,["eksport magazynu","pobierz magazyn","csv magazynu"])) return {typ:"export-magazyn",raw,confidence:.9};
  if(agentAIMa(n,["audyt magazynu","sprawdz kartoteke","audyt kartoteki"])) return {typ:"audyt-magazynu",raw,confidence:.9};
  if(agentAIMa(n,["uzupelnij kartoteke","domyslna kartoteka","wypelnij lokalizacje","wypelnij dostawcow"])) return {typ:"kartoteka-domyslna",raw,confidence:.9};
  if(agentAIMa(n,[
    "przygotuj zamowienie","przygotuj zlecenie","napisz zamowienie","napisz zlecenie","zrob zamowienie","zrob zlecenie",
    "zamowienie do producenta","zlecenie do producenta","zamowienie do dostawcy","zlecenie do dostawcy","co zamowic u producenta","co zamowic u dostawcy"
  ])){
    const niskie=agentAIMa(n,["nisk","niski stan","niskie stany","brak na stanie","zerowy stan","uzupelniajace","uzupelnij"]);
    const braki=agentAIMa(n,["pod zamowienia","pod zlecenia","aktywne zamowienia","aktywne zlecenia","braki do zamowien"]);
    return {typ:"zlecenie",tryb:niskie&&!braki?"niskie":"braki",raw,confidence:.95};
  }
  if(n.includes("allegro")&&/(?:wystaw|dodaj|utworz|stworz|aktualizuj|podepnij|aktywuj|dezaktywuj)/.test(n)){
    return {typ:"allegro-oferta",query:agentAIWytnijProduktAllegro(n),publicationAction:n.includes("dezaktywuj")?"deactivate":n.includes("aktywuj")||n.includes("wystaw")?"activate":"keep",raw,confidence:.98};
  }
  if(agentAIMa(n,["sprawdz allegro","sprawdź allegro","zlecenia allegro","zamowienia allegro","zamówienia allegro","pakowanie allegro","braki allegro"])) return {typ:"allegro-zlecenia",raw,confidence:.98};
  if(agentAIMa(n,["sprawdz teraz","sprawdz czy","sprawdz zlecenia","sprawdz zamowienia","czy wplynelo","czy wpadlo","czy jest nowe","czy sa nowe","nowe zlecenie","nowe zamowienie","jakies zlecenie wplynelo","jakies zamowienie wplynelo"])) return {typ:"sprawdz",raw,confidence:.95};
  if(agentAIMa(n,["czego brakuje","co brakuje","braki","brakuje do zamowien","brakuje do zlecen","co trzeba domowic","co trzeba zamowic","nadrezerwacje","braki magazynowe","plan zatowarowania","plan zakupow"])) return {typ:"braki",raw,confidence:.9};
  if(agentAIMa(n,["lista zamowien","pokaz zamowienia","pokaz zlecenia","ostatnie zamowienia","ostatnie zlecenia","ile zamowien","ile zlecen","zamowienia","zlecenia"])) return {typ:"zamowienia",raw,confidence:.86};
  if(agentAIMa(n,["status sklepu","status strony","status agenta","czy sklep dziala","czy strona dziala","kondycja","stan systemu","backend","baza dziala","raport agenta"])) return {typ:"status",raw,confidence:.92};
  if(agentAIMa(n,["stan magazynu","podsumowanie magazynu","raport magazynu","magazyn","ile produktow","produkty bez kartoteki","bez dostawcy","bez lokalizacji","niskie stany","brak na stanie"])) return {typ:"magazyn",raw,confidence:.85};
  if(agentAIMa(n,["ile mamy","ile jest","jaki stan","stan produktu","sprawdz produkt","znajdz","czy mamy","gdzie lezy","gdzie jest"]) || /^sku\s+/.test(n) || /^kod\s+/.test(n)){
    const query=agentAIWytnijProdukt(n);
    if(query.length>=2) return {typ:"produkt",query,raw,confidence:.82};
  }
  if(n==="status") return {typ:"status",raw,confidence:.9};
  if(n==="magazyn") return {typ:"magazyn",raw,confidence:.9};
  if(n==="braki") return {typ:"braki",raw,confidence:.9};
  if(["zamowienia","zlecenia"].includes(n)) return {typ:"zamowienia",raw,confidence:.9};
  if(n==="zlecenie") return {typ:"zlecenie",tryb:"braki",raw,confidence:.9};
  return {typ:"nieznane",raw,confidence:.2};
}
function agentAIProduktTekst(fraza=""){
  const q=agentAINormalizuj(fraza);
  if(!q) return "Podaj nazwę, SKU albo fragment produktu, np. „ile mamy szachy”.";
  const slowa=q.split(" ").filter(Boolean);
  const rez=rezerwacjeMagazynowe();
  const lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).filter(p=>{
    const hay=agentAINormalizuj([p.nazwa,p.sku,p.kategoria,p.podkategoria,p.id].filter(Boolean).join(" "));
    return hay.includes(q) || slowa.every(w=>hay.includes(w));
  }).slice(0,8);
  if(!lista.length) return `Nie znalazłem produktu dla: „${fraza}”. Spróbuj krótszej nazwy albo SKU.`;
  return ["🔎 Produkty znalezione:",...lista.map(p=>{
    const stan=stanMagazynuId(p.id), r=Number(rez[p.id]||0), dost=stan===null?null:stan-r, meta=magazynMetaProduktu(p.id);
    const dostepnosc=produktOznaczonyNiedostepny(p)?"wyłączony ze sprzedaży":"dostępny w sklepie";
    return `• ${p.nazwa} (${p.sku||"ID "+p.id}) — stan: ${stan===null?"bez limitu":stan+" szt."}, rezerwacje: ${r}, dostępne po rezerwacjach: ${dost===null?"bez limitu":dost+" szt."}, sprzedaż: ${dostepnosc}, cena: ${zl(p.cena)}, lokalizacja: ${meta.lokalizacja?nazwaLokalizacjiMagazynu(meta.lokalizacja):"—"}, dostawca: ${meta.dostawca||"—"}`;
  })].join("\n");
}
function agentAIBrakiTekst(limit=12){
  const plan=potrzebyZatowarowania().slice(0,limit);
  if(!plan.length) return "📦 Braki do aktywnych zamówień: brak. Aktualne rezerwacje mieszczą się w stanie magazynowym.";
  return ["📦 Braki do aktywnych zamówień:",...plan.map(x=>`• ${x.produkt.nazwa} (${x.produkt.sku||"ID "+x.produkt.id}) — zamówić ${x.ilosc} szt.; dostępne: ${x.dostepne}; rezerwacje: ${x.rezerwacje}; dostawca: ${x.meta.dostawca||"—"}`)].join("\n");
}
function agentAIZamowieniaTekst(limit=8){
  const zam=pobierzZamowienia().slice().sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  const aktywne=zam.filter(statusZamowieniaRezerwujeMagazyn);
  const nowe=zam.filter(z=>String(z.status||"").toLowerCase()==="nowe");
  const potw=zam.filter(z=>z.wymagaPotwierdzeniaDostepnosci);
  const bezNumeru=aktywne.filter(z=>!daneWysylki(z).numer);
  const ostatnie=zam.slice(0,limit).map(z=>`• ${z.nr} — ${klientZamowieniaLabel(z)} — ${z.status||"nowe"} — ${zl(kosztyZamowienia(z).razem||z.razem)}`).join("\n");
  return [`📋 Zamówienia: ${zam.length} wszystkich, ${nowe.length} nowych, ${aktywne.length} aktywnych, ${potw.length} do potwierdzenia dostępności, ${bezNumeru.length} bez numeru nadania.`,ostatnie?`\nOstatnie:\n${ostatnie}`:""].join("");
}
function agentAIAllegroZleceniaTekst(limit=12){
  const aktywne=aktywneZamowieniaAllegro();
  const analizy=aktywne.map(z=>({z,a:allegroAnalizaMagazynowaZamowienia(z)}));
  const braki=analizy.filter(x=>x.a.braki>0), nierozpoznane=analizy.filter(x=>x.a.nierozpoznane>0), bezStanu=analizy.filter(x=>x.a.bezStanu>0), bezLokalizacji=analizy.filter(x=>x.a.bezLokalizacji>0), gotowe=analizy.filter(x=>x.a.gotowe);
  const rows=analizy.slice(0,limit).map(x=>{const lok=x.a.pozycje.filter(p=>p.decyzja==="kompletuj").map(p=>p.lokalizacja?nazwaLokalizacjiMagazynu(p.lokalizacja):"").filter(Boolean);return `• ${x.z.id} • Allegro: ${allegroStatusKolejkiMeta(x.z).label} • magazyn: ${allegroEtapMagazynuMeta(x.z).label} • ${x.a.gotowe?`pobierz z: ${[...new Set(lok)].join(", ")||"lokalizacja do uzupełnienia"}`:`braki ${x.a.braki} szt., nierozpoznane ${x.a.nierozpoznane}, bez stanu ${x.a.bezStanu}, bez lokalizacji ${x.a.bezLokalizacji}`}`;});
  return [`📦 Kontrola zleceń Allegro: ${aktywne.length} aktywnych, ${gotowe.length} gotowych do kompletacji, ${braki.length} z brakami, ${nierozpoznane.length} nierozpoznanych, ${bezStanu.length} bez stanu i ${bezLokalizacji.length} bez lokalizacji.`,...rows,braki.length?"Agent dopisuje braki z nowych zleceń do właściwego szkicu producenta; stare zlecenia nie tworzą automatycznie zakupów.":"Nie ma braków wymagających zamówienia u producenta."].join("\n");
}
function agentAIStatusTekst(){
  const analiza=agentAIAnaliza();
  const problemy=analiza.filter(x=>x.poziom!=="ok");
  const score=Math.max(0,Math.round(100-(analiza.filter(x=>x.poziom==="bad").length*18)-(analiza.filter(x=>x.poziom==="warn").length*8)));
  return [`🤖 Status agenta/sklepu: ${score}%`,`${problemy.length} tematów wymaga kontroli.`,`Baza: ${chmuraStan.admin?"połączona":"wymaga hasła/połączenia"} • e-mail: ${stanBramki.email?.configured?"OK":"sprawdź"} • InPost: ${stanBramki.inpost?.configured?"OK":"sprawdź"} • pamięć: ${(agentAIPamiec||[]).length} • lokalizacje: ${magazynLokalizacjeAktywne().length}`,problemy.length?`\nNajważniejsze:\n${problemy.slice(0,8).map(x=>`• ${x.tytul}: ${x.opis}`).join("\n")}`:"\nBrak pilnych problemów z listy kontroli."].join("\n");
}
function agentAICentrumTekst(limit=10){
  const analiza=agentAIAnaliza(),zadania=analiza.filter(x=>x.poziom!=="ok").sort((a,b)=>agentAIPriorytet(a)-agentAIPriorytet(b)).slice(0,limit),bad=analiza.filter(x=>x.poziom==="bad").length,warn=analiza.filter(x=>x.poziom==="warn").length,score=Math.max(0,Math.round(100-bad*18-warn*8));
  return [`🤖 Centrum operacyjne Artway-TM — ${score}%`,`Pilne: ${bad} • wymagające uwagi: ${warn} • kontrole OK: ${analiza.length-bad-warn}.`,zadania.length?`\nKolejność pracy:\n${zadania.map((x,i)=>`${i+1}. ${x.poziom==="bad"?"🔴":"🟡"} ${x.tytul}\n   ${x.opis}\n   Następny krok: ${agentAIOpisKroku(x)}`).join("\n")}`:"\n✅ Brak aktywnych tematów wymagających reakcji.","\nPolecenia szczegółowe: „pokaż komunikację”, „sprawdź wysyłki”, „audyt produktów”, „status producentów” albo „wyślij raport na Telegram”."].join("\n");
}
function agentAIKomunikacjaTekst(){
  const st=allegroKomunikacjaStaty(),threads=st.threads||[],issues=st.issues||[],threadNeed=threads.filter(allegroKomunikacjaWymagaOdpowiedzi).length,issueNeed=issues.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  return [`💬 Komunikacja z klientami`,`Allegro: ${threadNeed} wiadomości i ${issueNeed} dyskusji/reklamacji wymaga odpowiedzi.`,`Załatwione wewnętrznie: ${[...threads,...issues].filter(allegroKomunikacjaZalatwiona).length}.`,`Automatyczna odpowiedź jest wysyłana tylko przy pierwszej nowej wiadomości; dalsze odpowiedzi pozostają do zatwierdzenia administratora.`,threadNeed+issueNeed?"Otwórz Allegro → Wiadomości lub Dyskusje, sprawdź propozycję Agenta i odpowiedz klientowi.":"✅ Brak nowych spraw wymagających odpowiedzi."].join("\n");
}
function agentAIWysylkiTekst(){
  const aktywne=pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn),bezNumeru=aktywne.filter(z=>!daneWysylki(z).numer),problemy=aktywne.filter(z=>daneWysylki(z).etap==="problem"||daneWysylki(z).status==="problem");
  return [`🚚 Centrum wysyłek`,`Aktywne zamówienia: ${aktywne.length}. Bez numeru nadania: ${bezNumeru.length}. Wyjątki/problem: ${problemy.length}.`,`InPost: ${stanBramki.inpost?.configured?"połączony":"wymaga sprawdzenia konfiguracji"}.`,bezNumeru.length?`Do obsługi: ${bezNumeru.slice(0,10).map(z=>z.nr).join(", ")}.\nNastępny krok: uzupełnij odbiorcę, wybierz usługę, wygeneruj etykietę i pobierz numer nadania.`:"✅ Aktywne przesyłki mają numery nadania."].join("\n");
}
function agentAIProduktyAudytTekst(){
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),bezCeny=produkty.filter(p=>!produktMaCeneSprzedazy(p)),bezZdjec=produkty.filter(p=>!p.zdjecie),opisy=agentAIProduktyZProblememOpisu(1000),oferty=produkty.filter(p=>p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id),zadania=allegroAktywneZadaniaAgentaOfert();
  return [`🏷️ Audyt produktów i katalogu`,`Aktywne produkty: ${produkty.length}. Na Allegro: ${oferty.length}.`,`Bez ceny: ${bezCeny.length} • bez zdjęcia: ${bezZdjec.length} • opis do poprawy: ${opisy.length} • zadania wystawiania: ${zadania.length}.`,zadania.length?"Najpierw uzupełnij dane wymagane przez Allegro, następnie ponów wystawianie z Agenta ofert.":opisy.length?"Możesz użyć polecenia „popraw opisy produktów”.":"✅ Brak pilnych problemów katalogu."].join("\n");
}
function agentAIProducenciTekst(){
  const stats=statystykiDostepnosciProducentow(),docs=(agentAIZlecenia||[]).filter(z=>!agentAIStatusZamknietyDlaNowejWersji(z.status)),producenci=(producenciKartoteka||[]).filter(p=>p.active!==false);
  return [`🏭 Producenci i zakupy`,`Kartoteki producentów: ${producenci.length}. Otwarte dokumenty zakupowe: ${docs.length}.`,`Dostępność: ${stats.braki.length} braków • ${stats.niskie.length} niskich stanów • ${stats.nieznane.length} niepotwierdzonych.`,`Linki oczekujące na pobranie: ${agentAILinkiOczekujace().length}.`,docs.length?"Sprawdź bieżące rewizje dokumentów. Telegram jest podglądem; e-mail do producenta wymaga zatwierdzenia aktualnej wersji.":"✅ Brak otwartych dokumentów producentów."].join("\n");
}
function agentAIDiagnostykaTekst(){
  return [`🛠️ Diagnostyka całej strony`,`Wspólna baza: ${chmuraStan.admin?"OK":"wymaga połączenia"}.`,`E-mail: ${stanBramki.email?.configured?"OK":"sprawdź"} • InPost: ${stanBramki.inpost?.configured?"OK":"sprawdź"} • Allegro: ${allegroStan.connected?"OK":"sprawdź połączenie"}.`,`Paynow: ${stanBramki.paynow?.configured?"OK":"sprawdź konfigurację"} • Telegram: raport serwerowy dostępny po poprawnej konfiguracji bota.`,`Następny krok: otwórz Diagnostykę, jeżeli którakolwiek integracja nie ma statusu OK.`].join("\n");
}
async function agentAIWyslijRaportTelegram(){
  toast("Agent przygotowuje raport całej strony dla Telegramu…");
  try{const d=await chmura("telegram-send-agent-report",{method:"POST",body:{source:"admin-panel"},timeout:30000});zapiszHistorieAgenta("telegram","Wysłano raport centrum operacyjnego na Telegram",{messageId:d.messageId||"",score:d.center?.score||0,summary:d.center?.summary||{}});toast(`✅ Raport Agenta wysłany na Telegram • kondycja ${d.center?.score??"—"}%`);renderuj();return d;}catch(e){toast("⚠️ Telegram: "+(e.message||e));return null;}
}
function agentAIMagazynTekst(){
  const produktyAdmin=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const monitorowane=produktyAdmin.filter(p=>stanMagazynuId(p.id)!==null);
  const bezMonitoringu=produktyAdmin.length-monitorowane.length;
  const niskie=monitorowane.filter(p=>stanMagazynuId(p.id)<=progNiskiProduktu(p));
  const niedostepne=produktyAdmin.filter(produktOznaczonyNiedostepny);
  const braki=potrzebyZatowarowania();
  const bezKartoteki=produktyAdmin.filter(p=>!magazynMetaProduktu(p.id).lokalizacja||!magazynMetaProduktu(p.id).dostawca);
  return [`🏬 Magazyn: ${produktyAdmin.length} produktów aktywnych w administracji.`,`Monitorowane stany: ${monitorowane.length}; bez monitoringu: ${bezMonitoringu}.`,`Niskie/brak stanu: ${niskie.length}; braki do aktywnych zamówień: ${braki.length}; wyłączone ze sprzedaży: ${niedostepne.length}; bez pełnej kartoteki: ${bezKartoteki.length}.`,niskie.length?`\nPierwsze niskie stany:\n${niskie.slice(0,8).map(p=>`• ${p.nazwa} — stan ${stanMagazynuId(p.id)} szt., próg ${progNiskiProduktu(p)}`).join("\n")}`:""].join("\n");
}
function czyEAN(v){
  const c=tylkoCyfry(v);
  return [8,12,13,14].includes(c.length);
}
function kodOperacyjnyProduktu(p, meta={}){
  return String(p?.sku || p?.kod || p?.id || meta.kod || "").trim();
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
    const p=x.produkt, meta=x.meta||{}, kod=kodOperacyjnyProduktu(p,meta), ean=eanOperacyjnyProduktu(p,meta);
    return {
      produktId:String(p.id),
      kod,
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
      dostawca:meta.dostawca||"",
      powod:x.powod||"",
      zamowienia:Array.isArray(x.zamowienia)?x.zamowienia:[],
      cenaBrutto:kwotaNum(p.cenaZakupu||p.cena),
      wartoscSzacowana:kwotaNum((Number(x.ilosc)||0)*kwotaNum(p.cena))
    };
  });
}
function agentAIAktywneIlosciUProducentow(){
  const mapa={};
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[])
    .filter(z=>!["zrealizowane","anulowane"].includes(String(z.status||"").toLowerCase()))
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
    `Status: ${zlecenie.status||"szkic"} • pozycji: ${zlecenie.pozycje.length} • sztuk: ${zlecenie.pozycje.reduce((s,x)=>s+Number(x.ilosc||0),0)} • wartość szac.: ${zl(zlecenie.pozycje.reduce((s,x)=>s+kwotaNum(x.wartoscSzacowana),0))}`,
    "",
    ...Object.entries(grupy).map(([d,items])=>[
      `Dostawca: ${d}`,
      ...items.map((x,i)=>`${i+1}. ${x.nazwa} — ${x.ilosc} szt. — kod: ${x.kod||"—"} • EAN: ${x.ean||"—"} • lok.: ${x.lokalizacja||"—"}${x.zamowienia?.length?` • zam.: ${x.zamowienia.join(", ")}`:""}`),
      ""
    ].join("\n")),
    "Zlecenie zapisano w tabeli operacyjnej agenta. Nie zostało wysłane automatycznie do dostawcy."
  ].join("\n").trim();
}
function agentAIStatusRoboczyProducenta(status="szkic"){
  return ["szkic","do sprawdzenia","zaakceptowane","wysłane na telegram"].includes(String(status||"szkic").toLowerCase());
}
function agentAIStatusZamknietyDlaNowejWersji(status=""){
  return ["wysłane do producenta","wysłane do dostawcy","częściowo zrealizowane","zrealizowane","anulowane"].includes(String(status||"").toLowerCase());
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
  return {...base,id:base.id||`producer-${producentKlucz(name)||Date.now().toString(36)}`,name,legalName:String(f.get("legalName")||"").trim(),orderEmail:String(f.get("orderEmail")||"").trim().toLowerCase(),contactPerson:String(f.get("contactPerson")||"").trim(),phone:String(f.get("phone")||"").trim(),website:String(f.get("website")||"").trim(),address:String(f.get("address")||"").trim(),nip:String(f.get("nip")||"").trim(),leadTimeDays:Math.max(0,Number(f.get("leadTimeDays"))||0),minimumOrder:String(f.get("minimumOrder")||"").trim(),paymentTerms:String(f.get("paymentTerms")||"").trim(),emailSubject:String(f.get("emailSubject")||"").trim()||"Zamówienie {numer} — Artway-TM",emailIntro:String(f.get("emailIntro")||"").trim(),notes:String(f.get("notes")||"").trim(),active:f.get("active")==="on",updatedAt:new Date().toISOString()};
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
  const aktywne=powiazane.filter(z=>!agentAIStatusZamknietyDlaNowejWersji(z.status));
  if(aktywne.length){
    producenciKartoteka=(producenciKartoteka||[]).map(x=>String(x.id)===String(id)?{...x,active:false,archivedAt:new Date().toISOString()}:x);
    zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Dezaktywowano kartotekę ${p.name} — istnieją aktywne dokumenty`,{producentId:p.id,aktywne:aktywne.length});toast(`Kartoteka ma ${aktywne.length} aktywne zamówienie(a) — została bezpiecznie dezaktywowana`);renderuj();return;
  }
  producenciKartoteka=(producenciKartoteka||[]).filter(x=>String(x.id)!==String(id));zapiszLS("artway_producenci",producenciKartoteka);zapiszHistorieAgenta("producent",`Usunięto kartotekę ${p.name}`,{producentId:p.id});toast("Kartoteka producenta usunięta");renderuj();
}
function producentFormHTML(p={}){
  const edit=!!p.id;return `<form class="producer-record-card" onsubmit="${edit?`producentZapisz(event,${jsArg(p.id)})`:`producentDodaj(event)`}"><div class="producer-record-head"><div><span class="supplier-chip">🏭 ${esc(p.name||"Nowy producent")}</span><h3>${edit?"Dane i kontakt":"Dodaj producenta"}</h3></div>${edit?`<span class="lvl ${p.orderEmail?"lvl-ok":"lvl-ostrzezenie"}">${p.orderEmail?"e-mail gotowy":"brak e-maila zamówień"}</span>`:""}</div><div class="producer-form-grid"><div class="f-group"><label>Nazwa producenta *</label><input name="name" required value="${esc(p.name||"")}" placeholder="np. Alexander"></div><div class="f-group"><label>Pełna nazwa firmy</label><input name="legalName" value="${esc(p.legalName||"")}"></div><div class="f-group"><label>E-mail do zamówień *</label><input name="orderEmail" type="email" value="${esc(p.orderEmail||"")}" placeholder="zamowienia@producent.pl"></div><div class="f-group"><label>Osoba kontaktowa</label><input name="contactPerson" value="${esc(p.contactPerson||"")}"></div><div class="f-group"><label>Telefon</label><input name="phone" value="${esc(p.phone||"")}"></div><div class="f-group"><label>Strona internetowa</label><input name="website" type="url" value="${esc(p.website||"")}" placeholder="https://..."></div><div class="f-group"><label>NIP</label><input name="nip" value="${esc(p.nip||"")}"></div><div class="f-group"><label>Adres</label><input name="address" value="${esc(p.address||"")}"></div><div class="f-group"><label>Standardowy czas realizacji (dni)</label><input name="leadTimeDays" type="number" min="0" value="${esc(p.leadTimeDays??3)}"></div><div class="f-group"><label>Minimum zamówienia</label><input name="minimumOrder" value="${esc(p.minimumOrder||"")}" placeholder="np. 500 zł"></div><div class="f-group"><label>Warunki płatności</label><input name="paymentTerms" value="${esc(p.paymentTerms||"")}" placeholder="np. przelew 7 dni"></div><label class="check"><input name="active" type="checkbox" ${p.active!==false?"checked":""}> Aktywny producent</label></div><details ${edit?"":"open"}><summary>Szablon e-maila i notatki</summary><div class="f-group"><label>Temat wiadomości</label><input name="emailSubject" value="${esc(p.emailSubject||"Zamówienie {numer} — Artway-TM")}"><small>Dostępne pola: {numer}, {producent}</small></div><div class="f-group"><label>Wstęp wiadomości</label><textarea name="emailIntro" rows="4">${esc(p.emailIntro||"Dzień dobry,\nprzesyłamy zatwierdzone zamówienie {numer}. Prosimy o potwierdzenie dostępności i terminu realizacji.")}</textarea></div><div class="f-group"><label>Notatki wewnętrzne</label><textarea name="notes" rows="3">${esc(p.notes||"")}</textarea></div></details><div class="producer-record-actions"><button class="btn" type="submit">${edit?"💾 Zapisz kartotekę":"➕ Dodaj producenta"}</button>${edit&&p.website?`<a class="btn ghost" href="${esc(p.website)}" target="_blank" rel="noopener">🌐 Otwórz stronę</a>`:""}${edit?`<button class="btn danger" type="button" onclick="if(confirm('Usunąć tę kartotekę producenta?'))producentUsun(${jsArg(p.id)})">Usuń</button>`:""}</div></form>`;
}
function producenciKartotekaPanelHTML(){
  const list=(producenciKartoteka||[]).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"pl")),ready=list.filter(p=>p.orderEmail&&p.active!==false).length;
  const summary=list.map(p=>{const docs=(agentAIZlecenia||[]).filter(z=>agentAIDostawcaZlecenia(z)===p.name),open=docs.filter(z=>agentAIStatusRoboczyProducenta(z.status)).length,last=docs.slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")))[0];return `<div class="producer-summary-card"><div><span class="supplier-chip">🏭 ${esc(p.name)}</span><b>${esc(p.contactPerson||p.legalName||"Kontakt nieuzupełniony")}</b><small>${p.orderEmail?`✉️ ${esc(p.orderEmail)}`:"brak e-maila zamówień"}${p.phone?` • 📞 ${esc(p.phone)}`:""}</small></div><div><strong>${docs.length}</strong><small>zamówień • ${open} bieżących</small>${last?`<small>ostatnie: ${esc(last.numer||last.id)}</small>`:""}</div></div>`;}).join("");
  return `<div class="panel producer-directory"><div class="order-section-head"><div><span class="order-pro-label">Kartoteka zakupowa</span><h2 style="margin-top:.25rem">🏭 Producenci i kontakty</h2><p class="order-detail-lead">Adres e-mail z tej kartoteki jest jedynym adresem używanym do wysyłki zatwierdzonego zamówienia. Dane, kontakty i szablony synchronizują się ze wspólną bazą.</p></div><span class="lvl ${ready===list.length&&list.length?"lvl-ok":"lvl-ostrzezenie"}">${ready}/${list.length} gotowych do e-maila</span></div><div class="producer-directory-summary">${summary||`<div class="backend-note">Brak producentów w kartotece.</div>`}</div><div class="producer-directory-list">${list.map(producentFormHTML).join("")}${producentFormHTML({})}</div></div>`;
}
function agentAIUtworzZlecenieProducenta(tryb="braki", opcje={}){
  let pozycje=agentAIPozycjeZleceniaProducenta(tryb, opcje.limit||500);
  if(String(tryb||"braki").toLowerCase()==="braki"){
    const aktywne=agentAIAktywneIlosciUProducentow();
    pozycje=pozycje.map(p=>{
      const brak=Math.max(0,Number(p.ilosc)||0), juz=Math.max(0,Number(aktywne[String(p.produktId)]||0)), pozostalo=Math.max(0,brak-juz);
      return {...p,ilosc:pozostalo,iloscPotrzebna:pozostalo,brakCalkowity:brak,juzZamowiono:juz,powod:[p.powod||"",juz?`w aktywnych zleceniach: ${juz} szt.`:""].filter(Boolean).join(" • ")};
    }).filter(p=>Number(p.ilosc)>0);
  }
  if(opcje.dostawca!==undefined)pozycje=pozycje.filter(p=>String(p.dostawca||"Bez przypisanego dostawcy")===String(opcje.dostawca));
  if(!pozycje.length) return null;
  const supplier=String(opcje.dostawca??pozycje[0]?.dostawca??"Bez przypisanego dostawcy").trim()||"Bez przypisanego dostawcy";
  const partial=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(z=>String(z.status||"").toLowerCase()==="częściowo wysłane e-mailem"&&agentAIDostawcaZlecenia(z)===supplier);
  if(partial)return null;
  const open=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(z=>agentAIStatusRoboczyProducenta(z.status)&&agentAIDostawcaZlecenia(z)===supplier);
  if(open){
    const now=new Date(),previousStatus=String(open.status||"szkic").toLowerCase(),previousTelegramAt=open.telegramSentAt||null;
    const map=new Map((open.pozycje||[]).map(p=>[String(p.produktId),{...p}]));
    for(const item of pozycje){
      const id=String(item.produktId),old=map.get(id);
      if(old)map.set(id,{...old,ilosc:(Number(old.ilosc)||0)+(Number(item.ilosc)||0),iloscPotrzebna:(Number(old.iloscPotrzebna??old.ilosc)||0)+(Number(item.iloscPotrzebna??item.ilosc)||0),brakCalkowity:Math.max(Number(old.brakCalkowity||0),Number(item.brakCalkowity||0)),zamowienia:[...new Set([...(old.zamowienia||[]),...(item.zamowienia||[])])],powod:[old.powod,item.powod].filter(Boolean).join(" • ")});
      else map.set(id,{...item});
    }
    Object.assign(open,agentAIPodsumujZlecenie({...open,pozycje:[...map.values()],supplier,dostawcy:[supplier],revision:Math.max(1,Number(open.revision)||1)+1,lastAutoUpdateAt:now.toISOString(),updateSource:opcje.automatic?"agent-live":"administrator",historia:[...(open.historia||[]),{at:now.toISOString(),type:"live-update",text:`Dopisano ${pozycje.length} pozycji / zmian z aktualnych braków.`}].slice(-100)}));
    if(previousTelegramAt){open.telegramLastSentAt=previousTelegramAt;delete open.telegramSentAt;}
    if(["zaakceptowane","wysłane na telegram"].includes(previousStatus)){open.status="do sprawdzenia";delete open.approvedAt;delete open.approvedBy;delete open.approvalRevision;}
    agentAIZlecenia=(agentAIZlecenia||[]).map(z=>String(z.id)===String(open.id)?open:z);
    zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
    zapiszHistorieAgenta("zlecenie",`Zaktualizowano bieżące ${open.numer}: +${pozycje.reduce((s,p)=>s+Number(p.ilosc||0),0)} szt.`,{zlecenieId:open.id,numer:open.numer,dostawca:supplier,revision:open.revision,automatic:!!opcje.automatic});
    return {...open,_merged:true};
  }
  const teraz=new Date(), numer=`AZ/${teraz.getFullYear()}/${String(teraz.getMonth()+1).padStart(2,"0")}/${String((Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).length+1).padStart(4,"0")}`;
  const rec={
    id:"AZ-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),
    numer,
    typ:"zlecenie-producent",
    tryb:String(tryb||"braki").toLowerCase()==="niskie"?"niskie":"braki",
    status:"szkic",
    data:teraz.toISOString(),
    dataTxt:teraz.toLocaleString("pl-PL"),
    operator:sesja?.email||"administrator",
    supplier,
    revision:1,
    pozycje,
    sztuk:pozycje.reduce((s,x)=>s+Number(x.ilosc||0),0),
    wartoscSzacowana:pozycje.reduce((s,x)=>s+kwotaNum(x.wartoscSzacowana),0),
    dostawcy:[...new Set(pozycje.map(x=>x.dostawca||"Bez przypisanego dostawcy"))],
    uwagi:opcje.uwagi||"Bieżący dokument roboczy. Agent dopisuje kolejne braki aż do zatwierdzenia i skutecznej wysyłki e-mailem do producenta.",
    historia:[{at:teraz.toISOString(),type:"created",text:"Utworzono bieżący dokument roboczy producenta."}]
  };
  agentAIZlecenia=[rec,...(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[])].slice(0,1000);
  zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
  zapiszHistorieAgenta("zlecenie",`Utworzono ${rec.numer}: ${rec.pozycje.length} pozycji / ${rec.sztuk} szt.`,{zlecenieId:rec.id,numer:rec.numer,tryb:rec.tryb,pozycje:rec.pozycje.length,sztuk:rec.sztuk});
  return rec;
}
function agentAIUtworzZleceniaWedlugDostawcow(dostawca="",opcje={}){
  const tryb=String(opcje.tryb||"braki").toLowerCase()==="niskie"?"niskie":"braki";
  const kandydaci=tryb==="niskie"?agentAIPozycjeZleceniaProducenta("niskie",1000):agentAIBrakiOperacyjne().filter(p=>Number(p.pozostaloDoZamowienia)>0);
  const dostawcy=dostawca?[String(dostawca)]:agentAIGrupujPoDostawcy(kandydaci).map(([d])=>d);
  const utworzone=[];
  dostawcy.forEach(d=>{const z=agentAIUtworzZlecenieProducenta(tryb,{dostawca:d,automatic:!!opcje.automatic,uwagi:`Bieżący dokument roboczy dla producenta: ${d}.`});if(z)utworzone.push(z);});
  if(!opcje.silent){if(utworzone.length){const merged=utworzone.filter(z=>z._merged).length;toast(merged?`Zaktualizowano ${merged} bieżących dokumentów producentów`:`Utworzono ${utworzone.length} dokumentów producentów`);renderuj();}else toast("Brak nowych niepokrytych pozycji albo oczekuje częściowa wysyłka e-mail");}
  return utworzone;
}
function agentAIZmienStatusZlecenia(id,status){
  const dozwolone=["szkic","do sprawdzenia","zaakceptowane","częściowo zrealizowane","zrealizowane","anulowane"];
  const s=dozwolone.includes(status)?status:"szkic";
  let znaleziono=false;
  agentAIZlecenia=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).map(z=>{
    if(z.id!==id) return z;
    znaleziono=true;
    const now=new Date();
    const next={...z,status:s,aktualizacja:now.toISOString(),aktualizacjaTxt:now.toLocaleString("pl-PL"),historia:[...(z.historia||[]),{at:now.toISOString(),type:"status",text:`Status: ${z.status||"szkic"} → ${s}`}].slice(-100)};
    if(s==="zaakceptowane"){next.approvedAt=now.toISOString();next.approvedBy=sesja?.email||"administrator";next.approvalRevision=Math.max(1,Number(next.revision)||1);}
    else if(!agentAIStatusZamknietyDlaNowejWersji(s)){delete next.approvedAt;delete next.approvedBy;delete next.approvalRevision;}
    return next;
  });
  if(!znaleziono){ toast("Nie znaleziono zlecenia agenta"); return; }
  zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
  zapiszHistorieAgenta("zlecenie",`Zmieniono status zlecenia ${id} → ${s}`,{zlecenieId:id,status:s});
  toast("Status zlecenia agenta zapisany ✅");
  renderuj();
}
function agentAIZatwierdzZlecenie(id){agentAIZmienStatusZlecenia(id,"zaakceptowane");}
function agentAIUsunZlecenie(id){
  let found=false;const now=new Date().toISOString();
  agentAIZlecenia=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).map(z=>{if(String(z.id)!==String(id))return z;found=true;return {...z,status:"anulowane",cancelledAt:now,cancelledBy:sesja?.email||"administrator",historia:[...(z.historia||[]),{at:now,type:"cancelled",text:"Dokument anulowany przez administratora."}].slice(-100)};});
  if(!found){ toast("Nie znaleziono zlecenia agenta"); return; }
  zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
  zapiszHistorieAgenta("zlecenie","Anulowano dokument producenta",{zlecenieId:id});
  toast("Dokument anulowany i zachowany w historii");
  renderuj();
}
function agentAIPodsumujZlecenie(z){
  const pozycje=Array.isArray(z.pozycje)?z.pozycje:[];
  z.sztuk=pozycje.reduce((s,p)=>s+Number(p.ilosc||0),0);
  z.wartoscSzacowana=pozycje.reduce((s,p)=>s+kwotaNum((Number(p.ilosc)||0)*kwotaNum(p.cenaBrutto)),0);
  z.dostawcy=[...new Set(pozycje.map(p=>p.dostawca||"Bez przypisanego dostawcy"))];
  z.aktualizacja=new Date().toISOString();
  z.aktualizacjaTxt=new Date().toLocaleString("pl-PL");
  return z;
}
function agentAIPobierzZlecenieCSV(id){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zlecenia producenta");return;}
  const nag=["kod","ean","nazwa","ilosc","ilosc_potrzebna","nadwyzka","dostawca","lokalizacja","cena_brutto","wartosc_szacowana","powiazane_zamowienia"];
  const csv=[nag.join(";"),...(z.pozycje||[]).map(p=>[p.kod,p.ean,p.nazwa,p.ilosc,p.iloscPotrzebna,p.nadwyzka,p.dostawca,p.lokalizacja,p.cenaBrutto,p.wartoscSzacowana,(p.zamowienia||[]).join(" | ")].map(csvPole).join(";"))].join("\n");
  pobierzPlik(`zlecenie-producenta-${String(z.numer||z.id).replace(/[^a-z0-9_-]+/gi,"-")}.csv`,"\uFEFF"+csv,"text/csv");
}
function agentAIZlecenieTabelaDostawcyHTML(z,dostawca,pozycje){
  const suma=pozycje.reduce((s,p)=>s+Number(p.ilosc||0),0), wartosc=pozycje.reduce((s,p)=>s+Number(p.ilosc||0)*kwotaNum(p.cenaBrutto),0),producer=producentPoNazwie(dostawca),editable=agentAIStatusRoboczyProducenta(z.status);
  return `<section class="supplier-split-card"><header><div><span class="supplier-chip">🏭 ${esc(dostawca)}</span><h4>Tabela zamówienia</h4><small>${pozycje.length} pozycji • ${suma} szt. • ${zl(wartosc)} • ${producer?.orderEmail?`✉️ ${esc(producer.orderEmail)}`:"brak e-maila w kartotece"}</small></div><div class="diag-actions"><a class="btn ghost" href="#/admin/agent-ai/producenci">Kontakt</a><button class="btn telegram-btn" onclick="agentAIWyslijZlecenieTelegram(${jsArg(z.id)},${jsArg(dostawca)})">✈️ Podgląd Telegram</button></div></header>
  <div class="warehouse-worktable-wrap"><table class="log-table supplier-order-products"><tr><th>Zdjęcie</th><th>Kod</th><th>EAN</th><th>Nazwa produktu</th><th>Potrzeba</th><th>Zamawiamy</th><th>Nadwyżka</th><th>Powiązane zamówienia</th><th>Akcje</th></tr>${pozycje.map(p=>{const produkt=produktMagazynowy(p.produktId)||{};const potrzebna=Number(p.iloscPotrzebna??p.ilosc)||0, ilosc=Number(p.ilosc)||0;return `<tr><td><span class="admin-product-thumb">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="" loading="lazy">`:`<span class="admin-product-thumb-fallback">${esc(produkt.ikona||"🎲")}</span>`}</span></td><td><b>${esc(p.kod||"—")}</b><br><small>ID ${esc(p.produktId||"—")}</small></td><td>${esc(p.ean||"—")}</td><td><b>${esc(p.nazwa||"Produkt")}</b><br><small>${p.stan===null?"stan bez limitu":`stan ${esc(p.stan||0)} • rez. ${esc(p.rezerwacje||0)}`} • ${esc(p.lokalizacja||"bez lokalizacji")}</small></td><td><b>${potrzebna}</b> szt.</td><td>${editable?`<div class="supplier-qty-control"><button type="button" onclick="agentAIPrzesunIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},-1)">−</button><input aria-label="Ilość zamawiana" inputmode="numeric" value="${ilosc}" onchange="agentAIUstawIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},this.value)"><button type="button" onclick="agentAIPrzesunIloscPozycji(${jsArg(z.id)},${jsArg(p.produktId)},1)">+</button></div>`:`<b>${ilosc}</b> szt.<br><small>wersja zamknięta</small>`}</td><td><span class="lvl ${ilosc>potrzebna?"lvl-ostrzezenie":"lvl-ok"}">${Math.max(0,ilosc-potrzebna)} szt.</span></td><td><small>${esc((p.zamowienia||[]).join(", ")||"—")}</small></td><td><div class="warehouse-worktable-actions">${editable?`<button class="btn ghost" onclick="agentAIPowiekszPozycjeZlecenia(${jsArg(z.id)},${jsArg(p.produktId)})">➕ Powiększ</button>`:""}<button class="btn ghost" onclick="agentAIPrzyjmijPozycjeZlecenia(${jsArg(z.id)},${jsArg(p.produktId)})">📥 Przyjmij</button></div></td></tr>`;}).join("")}</table></div></section>`;
}
function agentAIZleceniaPanelHTML(){
  const lista=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
  const statusy=["szkic","do sprawdzenia","zaakceptowane","częściowo zrealizowane","zrealizowane","anulowane"],open=lista.filter(z=>agentAIStatusRoboczyProducenta(z.status)).length,approved=lista.filter(z=>z.approvedAt&&agentAIStatusRoboczyProducenta(z.status)).length,sent=lista.filter(z=>["wysłane do producenta","wysłane do dostawcy"].includes(String(z.status||"").toLowerCase())).length;
  return `<div class="panel agent-orders-panel"><div class="order-section-head"><div><span class="order-pro-label">Dokumenty zakupowe</span><h2 style="margin-top:.25rem">🧾 Zamówienia do producentów</h2><p class="order-detail-lead">Dla każdego producenta istnieje jeden bieżący dokument roboczy. Agent dopisuje do niego kolejne braki — także po podglądzie na Telegramie. Nowa wersja powstaje dopiero po zatwierdzeniu i skutecznej wysyłce e-mailem.</p></div><div class="diag-actions"><button class="btn" onclick="agentAIUtworzZleceniaWedlugDostawcow()">🤖 Aktualizuj bieżące dokumenty</button><a class="btn ghost" href="#/admin/agent-ai/producenci">🏭 Producenci</a></div></div>
  <div class="orders-stat-grid"><div class="order-stat-card hot"><span>📝</span><b>${open}</b><small>bieżących roboczych</small></div><div class="order-stat-card"><span>✅</span><b>${approved}</b><small>zatwierdzonych wersji</small></div><div class="order-stat-card money"><span>✉️</span><b>${sent}</b><small>wysłanych e-mailem</small></div><div class="order-stat-card"><span>🏭</span><b>${new Set(lista.flatMap(z=>z.dostawcy||[])).size}</b><small>producentów</small></div><div class="order-stat-card"><span>🔢</span><b>${lista.reduce((s,z)=>s+Number(z.sztuk||0),0)}</b><small>sztuk łącznie</small></div></div>
  <div class="supplier-order-list">${lista.map(z=>{const status=String(z.status||"szkic").toLowerCase(),zamkniete=agentAIStatusZamknietyDlaNowejWersji(status),robocze=agentAIStatusRoboczyProducenta(status),grupy=agentAIGrupujPoDostawcy(z.pozycje||[]),revision=Math.max(1,Number(z.revision)||1),approvedCurrent=!!z.approvedAt&&Number(z.approvalRevision||0)===revision,missingEmail=grupy.some(([d])=>!producentPoNazwie(d)?.orderEmail);return `<article class="supplier-order-card ${zamkniete?"is-closed":""}"><header class="supplier-order-head"><div><span class="order-pro-label">${esc(z.tryb==="niskie"?"Uzupełnienie magazynu":"Braki do zamówień")} • wersja ${revision}</span><h3>${esc(z.numer||z.id)}</h3><small>${esc(z.dataTxt||allegroDataTxt(z.data))} • ${grupy.length} producentów • ${(z.pozycje||[]).length} pozycji • ${esc(z.sztuk||0)} szt. • ${zl(z.wartoscSzacowana||0)}</small></div><div class="supplier-order-status">${robocze?`<select onchange="agentAIZmienStatusZlecenia(${jsArg(z.id)},this.value)">${statusy.slice(0,3).map(s=>`<option value="${s}" ${status===s?"selected":""}>${s}</option>`).join("")}</select>`:`<span class="lvl ${status.includes("wysłane")?"lvl-ok":"lvl-info"}">${esc(z.status||"—")}</span>`}<small>${z.emailSentAt?`E-mail: ${esc(allegroDataTxt(z.emailSentAt))}`:z.telegramSentAt?`Telegram (podgląd): ${esc(allegroDataTxt(z.telegramSentAt))}`:"Dokument otwarty — oczekuje na kontrolę"}</small></div></header><div class="supplier-workflow"><span class="done">1. Bieżące braki</span><span class="${z.telegramSentAt?"done":""}">2. Podgląd Telegram</span><span class="${approvedCurrent?"done":""}">3. Zatwierdzenie wersji ${revision}</span><span class="${z.emailSentAt?"done":""}">4. E-mail do producenta</span><span class="${zamkniete?"done":""}">5. Nowa wersja dozwolona</span></div>${approvedCurrent&&robocze?`<div class="backend-note"><b>Wersja ${revision} zatwierdzona.</b> Każde automatyczne lub ręczne dopisanie pozycji cofnie dokument do ponownej kontroli.</div>`:""}<div class="supplier-split-list">${grupy.map(([d,items])=>agentAIZlecenieTabelaDostawcyHTML(z,d,items)).join("")}</div><footer class="supplier-order-actions"><button class="btn telegram-btn" onclick="agentAIWyslijZlecenieTelegram(${jsArg(z.id)})">✈️ Wyślij podgląd na Telegram</button>${robocze?`<button class="btn ghost" onclick="agentAIZatwierdzZlecenie(${jsArg(z.id)})">✅ Zatwierdź wersję ${revision}</button>`:""}<button class="btn" onclick="agentAIWyslijZlecenieEmail(${jsArg(z.id)})" ${((!approvedCurrent&&status!=="częściowo wysłane e-mailem")||missingEmail||zamkniete)?"disabled":""}>✉️ ${status==="częściowo wysłane e-mailem"?"Ponów brakujące e-maile":"Wyślij e-mailem do producenta"}</button><button class="btn ghost" onclick="agentAIPobierzZlecenieCSV(${jsArg(z.id)})">📤 CSV</button>${robocze?`<button class="btn danger" onclick="agentAIUsunZlecenie(${jsArg(z.id)})">🗑️ Usuń szkic</button>`:""}</footer>${missingEmail?`<div class="backend-note" style="border-color:#fed7aa;background:#fff7ed"><b>Brak e-maila producenta.</b> Uzupełnij kartotekę przed zatwierdzoną wysyłką.</div>`:""}</article>`;}).join("")||`<div class="backend-note">Nie ma jeszcze zamówień producenta. Agent utworzy bieżące dokumenty z aktualnych braków.</div>`}</div></div>`;
}
function agentAIZmienPozycjeZlecenia(id, produktId, fn){
  let znaleziono=false;
  agentAIZlecenia=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).map(z=>{
    if(String(z.id)!==String(id)) return z;
    const pozycje=(Array.isArray(z.pozycje)?z.pozycje:[]).map(p=>{
      if(String(p.produktId)!==String(produktId)) return p;
      znaleziono=true;
      return fn({...p})||p;
    });
    const now=new Date(),next=agentAIPodsumujZlecenie({...z,pozycje,revision:Math.max(1,Number(z.revision)||1)+1,historia:[...(z.historia||[]),{at:now.toISOString(),type:"manual-update",text:"Zmieniono ilość pozycji — wymagane ponowne zatwierdzenie."}].slice(-100)});
    if(next.telegramSentAt){next.telegramLastSentAt=next.telegramSentAt;delete next.telegramSentAt;}
    if(["zaakceptowane","wysłane na Telegram"].includes(String(z.status||""))){next.status="do sprawdzenia";delete next.approvedAt;delete next.approvedBy;delete next.approvalRevision;}
    return next;
  });
  if(!znaleziono){ toast("Nie znaleziono pozycji w zleceniu agenta"); return false; }
  zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
  return true;
}
function agentAIPowiekszPozycjeZlecenia(id, produktId){
  const raw=prompt("O ile sztuk powiększyć tę pozycję? Nadwyżka zostanie oznaczona do przyjęcia na magazyn po dostawie.","1");
  if(raw===null) return;
  const delta=Math.max(0,parseInt(String(raw).replace(",",".").replace(/[^\d.-]/g,""),10)||0);
  if(!delta){ toast("Podaj dodatnią liczbę sztuk"); return; }
  const ok=agentAIZmienPozycjeZlecenia(id,produktId,p=>{
    const potrzebna=Number(p.iloscPotrzebna ?? p.ilosc ?? 0)||0;
    const nowa=(Number(p.ilosc)||0)+delta;
    return {...p,ilosc:nowa,iloscPotrzebna:potrzebna,nadwyzka:Math.max(0,nowa-potrzebna),powod:[p.powod||"",`ręcznie powiększono o ${delta} szt.`].filter(Boolean).join(" • ")};
  });
  if(ok){
    zapiszHistorieAgenta("zlecenie",`Powiększono pozycję zlecenia o ${delta} szt.`,{zlecenieId:id,produktId,delta});
    toast("Pozycja zlecenia powiększona. Nadwyżka będzie widoczna do przyjęcia.");
    renderuj();
  }
}
function agentAIUstawIloscPozycji(id,produktId,wartosc){
  const ilosc=Math.max(0,parseInt(String(wartosc??0).replace(/[^\d-]/g,""),10)||0);
  const ok=agentAIZmienPozycjeZlecenia(id,produktId,p=>{
    const potrzebna=Number(p.iloscPotrzebna??p.ilosc??0)||0;
    return {...p,ilosc,nadwyzka:Math.max(0,ilosc-potrzebna),powod:[String(p.powod||"").replace(/ • ilość ręczna: \d+ szt\.$/,""),`ilość ręczna: ${ilosc} szt.`].filter(Boolean).join(" • ")};
  });
  if(ok){zapiszHistorieAgenta("zlecenie",`Ustawiono ilość pozycji na ${ilosc} szt.`,{zlecenieId:id,produktId,ilosc});toast("Ilość w zamówieniu zaktualizowana");renderuj();}
}
function agentAIPrzesunIloscPozycji(id,produktId,delta){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  const p=(z?.pozycje||[]).find(x=>String(x.produktId)===String(produktId));
  if(!p){toast("Nie znaleziono pozycji");return;}
  agentAIUstawIloscPozycji(id,produktId,Math.max(0,(Number(p.ilosc)||0)+Number(delta||0)));
}
async function agentAIWyslijZlecenieTelegram(id,dostawca=""){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zlecenia producenta");return;}
  try{
    toast("Przygotowuję tabelę i wysyłam na Telegram…");
    const d=await chmura("telegram-send-supplier-order",{method:"POST",body:{order:z,supplier:dostawca||""},timeout:30000});
    const teraz=d.sentAt||new Date().toISOString();
    agentAIZlecenia=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).map(item=>String(item.id)!==String(id)?item:agentAIPodsumujZlecenie({...item,telegramSentAt:teraz,telegramSuppliers:[...new Set([...(item.telegramSuppliers||[]),...(d.suppliers||[])])],telegramMessages:[...(item.telegramMessages||[]),...(d.messageIds||[])],historia:[...(item.historia||[]),{at:teraz,type:"telegram-preview",text:`Wysłano podgląd na Telegram (${(d.suppliers||[]).join(", ")}). Dokument nadal pozostaje otwarty.`}].slice(-100)}));
    zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
    zapiszHistorieAgenta("telegram",`Wysłano tabelę ${z.numer||z.id} na Telegram`,{zlecenieId:id,dostawcy:d.suppliers||[],wiadomosci:(d.messageIds||[]).length});
    toast(`Telegram: wysłano ${d.tables||0} tabel ✅`);renderuj();
  }catch(e){toast("⚠️ Telegram: "+(e.message||e));}
}
async function agentAIWyslijZlecenieEmail(id){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  if(!z){toast("Nie znaleziono zamówienia producenta");return;}
  const revision=Math.max(1,Number(z.revision)||1);
  if(!["zaakceptowane","częściowo wysłane e-mailem"].includes(String(z.status||"").toLowerCase())||!z.approvedAt||Number(z.approvalRevision||0)!==revision){toast("⚠️ Najpierw zatwierdź dokładnie tę wersję zamówienia");return;}
  const names=[...new Set((z.pozycje||[]).map(p=>String(p.dostawca||agentAIDostawcaZlecenia(z)).trim()).filter(Boolean))];
  const suppliers=names.map(producentPoNazwie).filter(Boolean);
  const missing=names.filter(name=>!producentPoNazwie(name)?.orderEmail);
  if(missing.length){toast(`⚠️ Uzupełnij e-mail zamówień w kartotece: ${missing.join(", ")}`);location.hash="#/admin/agent-ai/producenci";return;}
  try{
    toast("Wysyłam zatwierdzone zamówienie e-mailem do producenta…");
    const d=await chmura("email-send-supplier-order",{method:"POST",body:{order:z,suppliers},timeout:90000});
    const sent=(d.results||[]).filter(x=>x.sent),failed=(d.results||[]).filter(x=>!x.sent),now=d.sentAt||new Date().toISOString();
    agentAIZlecenia=(agentAIZlecenia||[]).map(item=>{
      if(String(item.id)!==String(id))return item;
      const allSent=!!d.allSent;
      return agentAIPodsumujZlecenie({...item,status:allSent?"wysłane do producenta":"częściowo wysłane e-mailem",emailSentAt:allSent?now:item.emailSentAt,emailSuppliers:[...new Set([...(item.emailSuppliers||[]),...sent.map(x=>x.supplier)])],emailMessages:[...(item.emailMessages||[]),...sent.map(x=>({supplier:x.supplier,to:x.to,messageId:x.messageId||"",sentAt:x.sentAt||now,revision,skippedDuplicate:!!x.skippedDuplicate}))].slice(-100),historia:[...(item.historia||[]),{at:now,type:allSent?"email-final":"email-partial",text:allSent?`Zatwierdzona wersja ${revision} została wysłana e-mailem do: ${sent.map(x=>x.supplier).join(", ")}.`:`Wysłano częściowo; do ponowienia: ${failed.map(x=>x.supplier).join(", ")}.`}].slice(-100),closedForUpdatesAt:allSent?now:null});
    });
    zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
    zapiszHistorieAgenta("email-producent",d.allSent?`Wysłano ${z.numer||z.id} e-mailem do producenta`:`Częściowa wysyłka ${z.numer||z.id}`,{zlecenieId:id,revision,wyslane:sent.map(x=>x.supplier),bledy:failed.map(x=>({supplier:x.supplier,error:x.error}))});
    if(d.allSent){toast("✅ Zamówienie wysłane e-mailem. Następne braki utworzą nową wersję dokumentu.");agentAIUtworzZleceniaWedlugDostawcow("",{silent:true,automatic:true});}
    else toast(`⚠️ Wysłano ${sent.length}, nie wysłano ${failed.length}. Ponów przyciskiem — wysłane wiadomości nie zdublują się.`);
    renderuj();
  }catch(e){toast("⚠️ E-mail do producenta: "+(e.message||e));}
}
function agentAIPrzyjmijPozycjeZlecenia(id, produktId){
  const z=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).find(x=>String(x.id)===String(id));
  const poz=(Array.isArray(z?.pozycje)?z.pozycje:[]).find(p=>String(p.produktId)===String(produktId));
  if(!z||!poz){ toast("Nie znaleziono pozycji do przyjęcia"); return; }
  const pozostalo=Math.max(0,(Number(poz.ilosc)||0)-(Number(poz.przyjeto)||0));
  if(!pozostalo){ toast("Ta pozycja jest już przyjęta"); return; }
  const raw=prompt(`Ile sztuk przyjąć na magazyn dla: ${poz.nazwa}?`,String(pozostalo));
  if(raw===null) return;
  const ilosc=Math.max(0,parseInt(String(raw).replace(",",".").replace(/[^\d.-]/g,""),10)||0);
  if(!ilosc){ toast("Podaj dodatnią liczbę sztuk"); return; }
  if(ilosc>pozostalo && !confirm(`Wpisano ${ilosc} szt., a w zleceniu pozostało ${pozostalo}. Przyjąć mimo to?`)) return;
  const przed=stanMagazynuId(produktId);
  const baza=przed===null?0:Number(przed)||0;
  ustawStanMagazynowy(produktId,baza+ilosc,{typ:"przyjęcie",powod:`Przyjęcie ze zlecenia agenta ${z.numer||z.id}`,dokument:z.numer||z.id});
  const ok=agentAIZmienPozycjeZlecenia(id,produktId,p=>({...p,przyjeto:(Number(p.przyjeto)||0)+ilosc,ostatniePrzyjecie:new Date().toISOString(),statusPrzyjecia:(Number(p.przyjeto||0)+ilosc)>=(Number(p.ilosc)||0)?"przyjęte":"częściowo przyjęte"}));
  if(ok){
    agentAIZlecenia=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).map(item=>{
      if(String(item.id)!==String(id)) return item;
      const pozycje=Array.isArray(item.pozycje)?item.pozycje:[];
      const wszystkie=pozycje.length&&pozycje.every(p=>(Number(p.przyjeto)||0)>=(Number(p.ilosc)||0));
      const jakies=pozycje.some(p=>(Number(p.przyjeto)||0)>0);
      return agentAIPodsumujZlecenie({...item,status:wszystkie?"zrealizowane":jakies?"częściowo zrealizowane":item.status});
    });
    zapiszLS("artway_agent_ai_zlecenia",agentAIZlecenia);
    zapiszHistorieAgenta("magazyn",`Przyjęto ${ilosc} szt. z ${z.numer||z.id} do magazynu`,{zlecenieId:id,produktId,ilosc,stanPrzed:przed});
    toast("Przyjęto towar na magazyn ✅");
    renderuj();
  }
}
function agentAINadwyzkiDoPrzyjecia(){
  const out=[];
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(z=>!["zrealizowane","anulowane"].includes(String(z.status||"").toLowerCase())).forEach(z=>{
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
function statusOperacyjnyZamowienia(z){
  const s=String(z?.status||"nowe").toLowerCase();
  if(["anulowane","zwrot","zwrot pieniędzy"].includes(s)) return {priorytet:9,klasa:"lvl-blad",tekst:z.status||"anulowane"};
  if(["zakończone","dostarczone"].includes(s)) return {priorytet:8,klasa:"lvl-ok",tekst:z.status||"zakończone"};
  if(z?.wymagaPotwierdzeniaDostepnosci) return {priorytet:1,klasa:"lvl-ostrzezenie",tekst:"potwierdzić dostępność"};
  if(["nowe","potwierdzone"].includes(s)) return {priorytet:2,klasa:"lvl-info",tekst:z.status||"nowe"};
  return {priorytet:3,klasa:"lvl-info",tekst:z.status||"w realizacji"};
}
function wierszeOperacyjneMagazynu(){
  const rez=rezerwacjeMagazynowe(), rows=[];
  pobierzZamowienia().slice().sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0)).forEach(z=>{
    const st=statusOperacyjnyZamowienia(z);
    pozycjeZamowieniaMagazyn(z).forEach(poz=>{
      const p=produktMagazynowy(poz.id)||poz, meta=magazynMetaProduktu(p.id), stan=stanMagazynuId(p.id), dost=stan===null?null:stan-Number(rez[p.id]||0);
      rows.push({
        zrodlo:"zamówienie klienta",
        typ:"zamowienie",
        data:z.ts||0,
        priorytet:st.priorytet,
        status:st.tekst,
        statusKlasa:st.klasa,
        numer:z.nr,
        klient:klientZamowieniaLabel(z),
        produktId:String(p.id),
        kod:kodOperacyjnyProduktu(p,meta),
        ean:eanOperacyjnyProduktu(p,meta),
        nazwa:poz.nazwa||p.nazwa||"Produkt",
        ilosc:Number(poz.ilosc)||1,
        stan,
        rezerwacje:Number(rez[p.id]||0),
        dostepne:dost,
        lokalizacja:meta.lokalizacja||"",
        dostawca:meta.dostawca||"",
        powod:z.wymagaPotwierdzeniaDostepnosci?"Zamówienie wymaga potwierdzenia dostępności.":"Pozycja z zamówienia klienta.",
        akcja:`#/admin/zamowienie/${encodeURIComponent(z.nr)}`
      });
    });
  });
  aktywneZamowieniaAllegro().forEach(z=>{
    const statusMeta=allegroStatusKolejkiMeta(z), status=statusMeta.label;
    pozycjeAllegroMagazyn(z).forEach(poz=>{
      rows.push({
        zrodlo:"zamówienie Allegro",
        typ:"allegro",
        data:new Date(z.createdAt||z.updatedAt||0).getTime()||0,
        priorytet:1,
        status,
        statusKlasa:statusMeta.klasa,
        numer:z.id||z.nr||"Allegro",
        allegroOrderId:z.id||z.nr||"",
        klient:z.buyerName||z.buyerLogin||z.email||"Allegro",
        produktId:"",
        kod:poz.externalId||poz.offerId||"",
        ean:poz.ean||"",
        nazwa:poz.nazwa||"Produkt Allegro",
        ilosc:Number(poz.ilosc)||1,
        stan:null,
        rezerwacje:0,
        dostepne:null,
        lokalizacja:"",
        dostawca:"",
        powod:"Niezależna pozycja zamówienia Allegro. Po pobraniu potrzebnych produktów oznacz całe zamówienie jako sprawdzone.",
        akcja:"#/admin/allegro/zamowienia",
        zamowienia:[`Allegro ${z.id||z.nr||""} × ${Number(poz.ilosc)||1}`]
      });
    });
  });
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).forEach(z=>{
    (Array.isArray(z.pozycje)?z.pozycje:[]).forEach(p=>{
      const ilosc=Number(p.ilosc)||0, potrzebna=Number(p.iloscPotrzebna ?? ilosc)||0, przyjeto=Number(p.przyjeto)||0;
      rows.push({
        zrodlo:"zlecenie agenta",
        typ:"agent",
        data:new Date(z.data||0).getTime()||0,
        priorytet:z.status==="szkic"?2:z.status==="zaakceptowane"?3:z.status==="zrealizowane"?8:4,
        status:z.status||"szkic",
        statusKlasa:z.status==="zrealizowane"?"lvl-ok":z.status==="anulowane"?"lvl-blad":"lvl-info",
        numer:z.numer||z.id,
        zlecenieId:z.id,
        klient:(z.dostawcy||[]).join(", ")||"dostawca",
        produktId:String(p.produktId||""),
        kod:p.kod||"",
        ean:p.ean||"",
        nazwa:p.nazwa||"Produkt",
        ilosc,
        iloscPotrzebna:potrzebna,
        przyjeto,
        nadwyzka:Math.max(0,ilosc-potrzebna),
        stan:p.stan===null?null:Number(p.stan||0),
        rezerwacje:Number(p.rezerwacje||0),
        dostepne:p.dostepne===null?null:Number(p.dostepne||0),
        lokalizacja:p.lokalizacja||"",
        dostawca:p.dostawca||"",
        powod:p.powod||z.uwagi||"Pozycja ze szkicu zlecenia agenta.",
        zamowienia:p.zamowienia||[]
      });
    });
  });
  return rows.sort((a,b)=>a.priorytet-b.priorytet || (b.data||0)-(a.data||0) || String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl"));
}
function akcjaWierszaOperacyjnegoHTML(x){
  if(x.typ==="zamowienie") return `<a class="btn ghost" href="${esc(x.akcja)}">Otwórz</a>`;
  if(x.typ==="allegro") return `<div class="warehouse-worktable-actions"><a class="btn ghost" href="${esc(x.akcja||"#/admin/allegro/zamowienia")}">Otwórz Allegro</a><button class="btn" onclick="allegroOznaczZamowienieSprawdzone(${jsArg(x.allegroOrderId)},true)">✅ Produkty pobrane</button></div>`;
  const doc=(agentAIZlecenia||[]).find(z=>String(z.id)===String(x.zlecenieId)),robocze=agentAIStatusRoboczyProducenta(doc?.status);
  return `<div class="warehouse-worktable-actions">
    ${robocze?`<select onchange="agentAIZmienStatusZlecenia(${jsArg(x.zlecenieId)},this.value)">${["szkic","do sprawdzenia","zaakceptowane"].map(s=>`<option value="${s}" ${x.status===s?"selected":""}>${s}</option>`).join("")}</select><button class="btn ghost" onclick="agentAIPowiekszPozycjeZlecenia(${jsArg(x.zlecenieId)},${jsArg(x.produktId)})">➕ Powiększ</button>`:`<span class="lvl lvl-info">${esc(doc?.status||x.status||"zamknięte")}</span>`}
    <button class="btn ghost" onclick="agentAIPrzyjmijPozycjeZlecenia(${jsArg(x.zlecenieId)},${jsArg(x.produktId)})">📥 Przyjmij</button>
    ${robocze?`<button class="btn danger" onclick="if(confirm('Anulować dokument producenta?'))agentAIUsunZlecenie(${jsArg(x.zlecenieId)})">Anuluj</button>`:""}
  </div>`;
}
function eksportujTabeleOperacyjnaMagazynuCSV(){
  const braki=agentAIBrakiOperacyjne(), rows=[];
  braki.forEach(x=>rows.push(["brak",x.dostawca,"",x.kod,x.ean,x.nazwa,x.brakCalkowity,x.wZleceniach,x.pozostaloDoZamowienia,x.stan===null?"bez limitu":x.stan,x.rezerwacje,x.lokalizacja,(x.zamowienia||[]).join(" | "),x.powod]));
  (Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).forEach(z=>(z.pozycje||[]).forEach(p=>rows.push(["zlecenie producenta",p.dostawca,z.numer||z.id,p.kod,p.ean,p.nazwa,p.iloscPotrzebna??p.ilosc,p.ilosc,Math.max(0,Number(p.ilosc||0)-Number(p.iloscPotrzebna??p.ilosc??0)),p.stan===null?"bez limitu":p.stan,p.rezerwacje,p.lokalizacja,(p.zamowienia||[]).join(" | "),z.status||"szkic"])));
  const nag=["sekcja","dostawca","numer_zlecenia","kod","ean","nazwa","potrzeba","zamowiono_lub_w_zleceniach","pozostalo_lub_nadwyzka","stan","rezerwacje","lokalizacja","zamowienia_powiazane","status_lub_powod"];
  const csv=[nag.join(";"),...rows.map(r=>r.map(csvPole).join(";"))].join("\n");
  pobierzPlik("braki-i-zamowienia-do-producentow.csv","\uFEFF"+csv,"text/csv");
  zapiszHistorieAgenta("eksport","Wyeksportowano tabelę operacyjną magazynu",{wiersze:rows.length});
}
function magazynBrakiDostawcyHTML(dostawca,rows){
  const pozostalo=rows.reduce((s,x)=>s+Number(x.pozostaloDoZamowienia||0),0), pokryte=rows.reduce((s,x)=>s+Number(x.wZleceniach||0),0);
  return `<section class="ops-supplier-card"><header><div><span class="supplier-chip">🏭 ${esc(dostawca)}</span><h3>Braki do aktywnych zamówień</h3><small>${rows.length} produktów • pozostało ${pozostalo} szt. • w zleceniach ${pokryte} szt.</small></div><button class="btn" onclick="agentAIUtworzZleceniaWedlugDostawcow(${jsArg(dostawca)})" ${pozostalo?"":"disabled"}>🧾 Utwórz zlecenie dla dostawcy</button></header><div class="warehouse-worktable-wrap"><table class="log-table ops-shortage-table"><tr><th>Kod</th><th>EAN</th><th>Nazwa produktu</th><th>Brakuje</th><th>Już w zleceniach</th><th>Pozostało zamówić</th><th>Stan / rezerwacje</th><th>Powiązane zamówienia</th><th>Akcja</th></tr>${rows.map(x=>`<tr class="${x.pozostaloDoZamowienia>0?"row-alert":"row-covered"}"><td><b>${esc(x.kod||x.produktId||"—")}</b><br><small>ID ${esc(x.produktId||"—")}</small></td><td>${esc(x.ean||"—")}</td><td><b>${esc(x.nazwa)}</b><br><small>${esc(x.lokalizacja?nazwaLokalizacjiMagazynu(x.lokalizacja):"bez lokalizacji")}</small></td><td><b>${esc(x.brakCalkowity)}</b> szt.</td><td>${esc(x.wZleceniach)} szt.</td><td><span class="lvl ${x.pozostaloDoZamowienia>0?"lvl-ostrzezenie":"lvl-ok"}"><b>${esc(x.pozostaloDoZamowienia)}</b> szt.</span></td><td>${x.stan===null?"bez limitu":`${esc(x.stan)} szt.`}<br><small>rezerwacje ${esc(x.rezerwacje||0)} • po rez. ${x.dostepne===null?"∞":esc(x.dostepne)}</small></td><td><small>${esc((x.zamowienia||[]).join(", ")||"—")}</small></td><td><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(x.produktId)}">✏️ Produkt</a></td></tr>`).join("")}</table></div></section>`;
}
function magazynTabelaOperacyjnaHTML(){
  const braki=agentAIBrakiOperacyjne(),grupy=agentAIGrupujPoDostawcy(braki),pozostalo=braki.reduce((s,x)=>s+Number(x.pozostaloDoZamowienia||0),0),wZleceniach=braki.reduce((s,x)=>s+Number(x.wZleceniach||0),0);
  const aktywne=(Array.isArray(agentAIZlecenia)?agentAIZlecenia:[]).filter(z=>!["zrealizowane","anulowane"].includes(String(z.status||"").toLowerCase()));
  return `<div class="panel warehouse-worktable-panel ops-control-center"><div class="order-section-head"><div><span class="order-pro-label">Centrum zakupów</span><h2 style="margin-top:.25rem">📑 Braki i zamówienia do producentów</h2><p class="order-detail-lead">Tabela pokazuje wyłącznie realne braki do aktywnych zamówień sklepu i Allegro. Pozycje już pokryte aktywnym zleceniem nie są zamawiane drugi raz.</p></div><div class="diag-actions" style="margin-top:0"><button class="btn" onclick="agentAIUtworzZleceniaWedlugDostawcow()" ${pozostalo?"":"disabled"}>🤖 Utwórz osobne zlecenia</button><button class="btn ghost" onclick="eksportujTabeleOperacyjnaMagazynuCSV()">📤 CSV</button></div></div><div class="orders-stat-grid"><div class="order-stat-card ${braki.length?"hot":""}"><span>⚠️</span><b>${braki.length}</b><small>produktów z brakiem</small></div><div class="order-stat-card"><span>🔢</span><b>${pozostalo}</b><small>sztuk do zamówienia</small></div><div class="order-stat-card money"><span>✅</span><b>${wZleceniach}</b><small>sztuk już w zleceniach</small></div><div class="order-stat-card"><span>🏭</span><b>${grupy.length}</b><small>dostawców</small></div><div class="order-stat-card"><span>🧾</span><b>${aktywne.length}</b><small>aktywnych zleceń</small></div></div><div class="ops-supplier-list">${grupy.map(([d,rows])=>magazynBrakiDostawcyHTML(d,rows)).join("")||`<div class="backend-note">✅ Brak realnych braków do aktywnych zamówień.</div>`}</div></div>${agentAIZleceniaPanelHTML()}`;
}
function agentAIZlecenieProducentaTekst(tryb="braki",limit=80){
  const docs=agentAIUtworzZleceniaWedlugDostawcow("",{tryb,limit,silent:true});
  if(!docs.length) return tryb==="niskie"?"Nie ma obecnie produktów pod zamówienie uzupełniające z niskich stanów.":"Nie ma nowych braków; bieżące dokumenty producentów pozostają aktualne.";
  return docs.map(agentAIFormatZleceniaProducenta).join("\n\n");
}
function agentAIProduktyDlaOfertyAllegro(fraza=""){
  const q=agentAINormalizuj(fraza),slowa=q.split(" ").filter(Boolean);
  if(!q)return [];
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>{
    const nazwa=agentAINormalizuj(p.nazwa||""),hay=agentAINormalizuj([p.nazwa,p.sku,p.externalId,p.gtin,p.ean,p.kodProducenta,p.mpn,p.id].filter(Boolean).join(" "));
    let score=nazwa===q?100:nazwa.includes(q)?95:hay.includes(q)?92:slowa.every(w=>hay.includes(w))?80:0;
    return score?{p,score}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.p.nazwa).localeCompare(String(b.p.nazwa),"pl"));
}
async function agentAIWykonajOferteAllegro(fraza="",publicationAction="keep"){
  if(!allegroStan.sprawdzono)await allegroWczytajDane(true);
  const trafienia=agentAIProduktyDlaOfertyAllegro(fraza);
  if(!trafienia.length)return `Nie znalazłem produktu „${fraza}”. Podaj dokładniejszą nazwę, SKU albo EAN.`;
  const best=trafienia[0],remis=trafienia.filter(x=>x.score===best.score);
  if(remis.length>1)return [`Znalazłem kilka produktów. Doprecyzuj nazwę, SKU albo EAN:`,...remis.slice(0,8).map(x=>`• ${x.p.nazwa} — ID ${x.p.id}, SKU ${x.p.sku||x.p.externalId||"—"}, EAN ${x.p.gtin||x.p.ean||"—"}`)].join("\n");
  const p=best.p,baseStock=allegroStanOfertyProduktu(p),stock=publicationAction==="activate"?Math.max(1,baseStock):baseStock;
  const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock,publicationAction,publishNow:publicationAction==="activate"}},timeout:120000});
  allegroOstatniBladWystawienia=null;
  allegroZapiszWynikOperacji(p,d);allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);
  if(d.offer?.id){
    const categoryId=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||p.allegroCategoryId||"";
    const productId=d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"";
    produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroOfferId:String(d.offer.id),...(categoryId?{allegroCategoryId:String(categoryId)}:{}),...(productId?{allegroProductId:String(productId)}:{})};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  }
  await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});zbudujProdukty();
  const updated=d.mode==="updated";
  const finalStatus=d.offer?.publication?.status||d.offer?.status||(publicationAction==="activate"?"ACTIVE":"INACTIVE");
  return [`✅ ${updated?"Znalazłem istniejącą ofertę i ją zaktualizowałem":finalStatus==="ACTIVE"?"Utworzyłem i aktywowałem nową ofertę":"Utworzyłem nowy szkic oferty"}: ${p.nazwa}.`,`Oferta: ${d.offer?.id||"—"}; status: ${finalStatus}; stan oferty Allegro: ${stock} szt. • stan magazynu pozostał bez zmian.`,`${d.duplicatePrevented?`Duplikat zablokowany — rozpoznano po ${d.match?.reason||"danych produktu"}.`:"Zapisano nowe potrójne powiązanie."}`,`Katalog: ${d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||"—"}; kategoria: ${d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||"—"}.`].join("\n");
}
async function agentAIWykonajPolecenie(tekst=""){
  const intent=agentAIRozpoznajPolecenie(tekst);
  let odpowiedz="";
  try{
    if(intent.typ==="pomoc"){
      odpowiedz=["Możesz pisać normalnie, np.:","• sprawdź link https://... i znajdź dane produktu","• wykonaj bezpieczny plan agenta","• sprawdź samą funkcjonalność strony","• pobierz świeże dane ze wszystkich źródeł","• ponów błędne kroki","• pokaż centrum operacyjne / co mam dziś zrobić?","• wyślij raport na Telegram","• pokaż komunikację z klientami","• sprawdź wysyłki i etykiety InPost","• audyt produktów i katalogu","• status producentów i otwartych zamówień","• diagnostyka integracji","• wystaw Origami Kot na Allegro","• sprawdź zlecenia Allegro i braki do pakowania","• przygotuj zamówienie do producenta","• czego brakuje do zamówień?","• pokaż stan magazynu","• sprawdź dostępność u producentów","• popraw opisy produktów","• ile mamy szachy?","• zapamiętaj: przy brakach najpierw sprawdź dostawcę","• synchronizuj bazę"].join("\n");
    }else if(intent.typ==="plan-wykonaj"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("full");
    }else if(intent.typ==="plan-data"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("data");
    }else if(intent.typ==="plan-health"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("health");
    }else if(intent.typ==="plan-retry"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("retry");
    }else if(intent.typ==="link-producenta-analiza"){
      const wynik=await agentAISprawdzLinkProducenta(intent.url,true);
      if(wynik?.blad)odpowiedz=`Nie udało się teraz odczytać linku. Zaplanowałem kolejną próbę: ${wynik.rec?.nextRetryAt?new Date(wynik.rec.nextRetryAt).toLocaleString("pl-PL"):"później"}. Powód: ${wynik.blad.message||wynik.blad}`;
      else{const d=wynik?.dane||{},alts=d.alternatives||[],audit=agentAIOcenaDodaniaProduktu(d.product||{},d);odpowiedz=[d.needsChoice?`Znalazłem ${alts.length} możliwe produkty — nie zgaduję, wybierz wariant w sekcji Linki producentów.`:`Znalazłem produkt: ${d.product?.nazwa||"bez nazwy"}.`,`Kompletność danych: ${d.confidence||0}%. Gotowość do dodania: ${audit.score}%. Braki: ${(wynik.braki||[]).join(", ")||"brak"}.`,`EAN: ${d.product?.ean||d.product?.gtin||"—"} • kod producenta: ${d.product?.kodProducenta||d.product?.mpn||"—"}.`,`Opis: ${String(d.product?.opis||"").length} znaków • zdjęcia: ${[d.product?.zdjecie,...(d.product?.zdjecia||[])].filter(Boolean).length}.`,audit.blockingDuplicate?`Zablokowałem duplikat: istnieje produkt #${audit.blockingDuplicate.product.id} ${audit.blockingDuplicate.product.nazwa}.`:intent.addProduct&&!d.needsChoice?"Przygotowuję bezpieczny formularz dodania produktu — przed zapisem zobaczysz kontrolę duplikatów i kompletności.":"",d.fromCache?`Użyłem pamięci Agenta z ${d.cacheSavedAt?new Date(d.cacheSavedAt).toLocaleString("pl-PL"):"poprzedniej kontroli"}.`:"",d.repaired?`Naprawiony adres: ${d.resolvedUrl||d.canonicalUrl}`:"",...alts.slice(0,5).map((x,i)=>`${i+1}. ${x.product?.nazwa||"Produkt"} • ${x.confidence||0}% • ${x.url}`)].filter(Boolean).join("\n");if(intent.addProduct&&!d.needsChoice&&!audit.blockingDuplicate&&wynik.rec?.id)setTimeout(()=>agentAIWypelnijNowyProduktZLinku(wynik.rec.id),700);}
    }else if(intent.typ==="centrum"){
      odpowiedz=agentAICentrumTekst();
    }else if(intent.typ==="komunikacja"){
      odpowiedz=agentAIKomunikacjaTekst();
    }else if(intent.typ==="wysylki"){
      odpowiedz=agentAIWysylkiTekst();
    }else if(intent.typ==="produkty-audyt"){
      odpowiedz=agentAIProduktyAudytTekst();
    }else if(intent.typ==="producenci"){
      odpowiedz=agentAIProducenciTekst();
    }else if(intent.typ==="diagnostyka"){
      odpowiedz=agentAIDiagnostykaTekst();
    }else if(intent.typ==="raport-telegram"){
      const d=await agentAIWyslijRaportTelegram();odpowiedz=d?`Raport centrum operacyjnego został wysłany na Telegram. Kondycja strony: ${d.center?.score??"—"}%. Wiadomość zawiera przyciski do Agenta, zamówień, magazynu, Allegro i wysyłek.`:"Nie udało się wysłać raportu na Telegram.";
    }else if(intent.typ==="pamiec-zapis"){
      const rec=agentAIZapiszPamiec(intent.tresc||"");
      odpowiedz=rec?`Zapamiętałem na przyszłość: ${rec.wyzwalacz?`gdy „${rec.wyzwalacz}” → `:""}${rec.akcja}`:"Nie podałeś treści do zapamiętania. Napisz np. „zapamiętaj: przy brakach najpierw sprawdź dostawcę”.";
    }else if(intent.typ==="pamiec-lista"){
      odpowiedz=agentAIPamiecTekst();
    }else if(intent.typ==="lokalizacje"){
      odpowiedz=agentAILokalizacjeTekst();
    }else if(intent.typ==="opisy"){
      odpowiedz=agentAIOpisyTekst();
    }else if(intent.typ==="opisy-popraw"){
      odpowiedz=agentAIPoprawOpisyProduktow(40);
      renderuj();
    }else if(intent.typ==="linki-producentow"){
      odpowiedz=agentAILinkiProducentowTekst();
    }else if(intent.typ==="linki-producentow-sprawdz"){
      odpowiedz=await agentAISprawdzLinkiProducentow(5);
    }else if(intent.typ==="dostepnosc-producentow-sprawdz"){
      const d=await agentAISprawdzDostepnoscProducentow();const s=d?.summary||{};
      odpowiedz=d?`Wyrywkowo sprawdziłem ${s.checked||0} produktów u producentów. Dostępne: ${s.available||0}, niski stan: ${s.low||0}, brak: ${s.unavailable||0}, niepotwierdzone: ${s.unknown||0}. Próg ostrzeżenia: ${s.threshold||50} szt.`:"Nie udało się zakończyć monitoringu producentów.";
    }else if(intent.typ==="lokalizacja-dodaj"){
      if(!intent.kod){
        odpowiedz="Podaj kod lokalizacji, np. „utwórz lokalizację R1-P1”.";
      }else if(magazynLokalizacjaPoKodzie(intent.kod)){
        odpowiedz=`Lokalizacja ${intent.kod} już istnieje. Możesz ją edytować w Magazyn → Lokalizacje.`;
      }else{
        magazynLokalizacje=[{id:"LOC-"+Date.now().toString(36),kod:intent.kod,nazwa:"",typ:"regał",strefa:"",pojemnosc:0,priorytet:999,uwagi:"Utworzone przez Agenta AI",aktywna:true,utworzono:new Date().toISOString(),aktualizacja:new Date().toISOString(),operator:sesja?.email||"administrator"},...(Array.isArray(magazynLokalizacje)?magazynLokalizacje:[])].slice(0,1000);
        zapiszLS("artway_magazyn_lokalizacje",magazynLokalizacje);
        odpowiedz=`Utworzyłem lokalizację ${intent.kod}. Uzupełnij nazwę/strefę/pojemność w Magazyn → Lokalizacje.`;
      }
    }else if(intent.typ==="sync"){
      await synchronizujBazeCentralna(true);
      odpowiedz="Synchronizacja bazy została uruchomiona. Dane z panelu powinny być zapisane i odświeżone na serwerze.";
    }else if(intent.typ==="faktury"){
      const przed=szkiceFaktur.length;
      utworzSzkiceFakturMasowo();
      odpowiedz=`Sprawdziłem szkice FV. Przed akcją było ich ${przed}, teraz jest ${szkiceFaktur.length}.`;
    }else if(intent.typ==="export-magazyn"){
      eksportujMagazynCSV();
      odpowiedz="Eksport magazynu CSV został przygotowany do pobrania.";
    }else if(intent.typ==="audyt-magazynu"){
      audytMagazynuAI();
      odpowiedz="Audyt magazynu JSON został przygotowany do pobrania.";
    }else if(intent.typ==="kartoteka-domyslna"){
      wypelnijDomyslnaKartotekeMagazynu();
      odpowiedz="Uzupełniłem domyślne pola kartoteki tam, gdzie było to bezpieczne.";
    }else if(intent.typ==="allegro-oferta"){
      odpowiedz=await agentAIWykonajOferteAllegro(intent.query,intent.publicationAction||"keep");
    }else if(intent.typ==="allegro-zlecenia"){
      odpowiedz=agentAIAllegroZleceniaTekst();
    }else if(intent.typ==="sprawdz"||intent.typ==="zamowienia"){
      odpowiedz=agentAIZamowieniaTekst();
    }else if(intent.typ==="zlecenie"){
      odpowiedz=agentAIZlecenieProducentaTekst(intent.tryb||"braki");
    }else if(intent.typ==="braki"){
      odpowiedz=agentAIBrakiTekst();
    }else if(intent.typ==="status"){
      odpowiedz=agentAIStatusTekst();
    }else if(intent.typ==="magazyn"){
      odpowiedz=agentAIMagazynTekst();
    }else if(intent.typ==="produkt"){
      odpowiedz=agentAIProduktTekst(intent.query);
    }else{
      const pamiec=agentAIZnajdzPamiecDlaPolecenia(tekst);
      odpowiedz=pamiec.length
        ? ["Znalazłem pasujące zapamiętane procedury:",...pamiec.map(x=>`• ${x.wyzwalacz?`Gdy: ${x.wyzwalacz} → `:""}${x.akcja||x.tresc}`)].join("\n")
        : "Nie rozpoznałem polecenia. Napisz np. „sprawdź zamówienia”, „przygotuj zamówienie do producenta”, „pokaż braki”, „sprawdź linki producentów”, „ile mamy [produkt]”, „zapamiętaj: …” albo „synchronizuj bazę”.";
    }
    zapiszHistorieAgenta("komenda",`Polecenie z panelu: ${tekst}`,{polecenie:tekst,intencja:intent.typ,tryb:intent.tryb||"",odpowiedz});
    loguj("info",`Agent AI/panel: ${intent.typ} — ${tekst}`);
    return {intent,odpowiedz};
  }catch(err){
    odpowiedz=`Nie udało się wykonać polecenia: ${err?.message||err}`;
    zapiszHistorieAgenta("komenda",`Błąd polecenia z panelu: ${tekst}`,{polecenie:tekst,intencja:intent.typ,tryb:intent.tryb||"",odpowiedz,blad:String(err?.message||err)});
    loguj("error",`Agent AI/panel błąd: ${err?.message||err}`);
    return {intent,odpowiedz,blad:err};
  }
}
async function agentAIPrzyjmijKomende(e){
  if(e) e.preventDefault();
  const input=$("agentAICommandInput"), tekst=String(input?.value||"").trim();
  if(!tekst){ toast("Wpisz polecenie dla agenta"); return false; }
  const btn=e?.submitter;
  if(btn) btn.disabled=true;
  const wynik=await agentAIWykonajPolecenie(tekst);
  toast(wynik.blad?"Agent zapisał błąd polecenia":"Agent AI wykonał polecenie ✅");
  if(input) input.value="";
  renderuj();
  setTimeout(()=>{$("agentAICommandInput")?.focus();},30);
  return false;
}
function agentAIWstawKomende(tekst){
  const input=$("agentAICommandInput");
  if(!input) return;
  input.value=tekst;
  input.focus();
}
function agentAIHashTekstu(value=""){
  let hash=2166136261;
  for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function agentAIOdciskZadania(task={}){
  const id=String(task.id||"zadanie"),poziom=String(task.poziom||"ok");
  const opis=id==="synchronizacja-danych"?poziom:String(task.opis||"").replace(/\s+/g," ").trim().toLowerCase();
  return `${id}:${agentAIHashTekstu(`${poziom}|${opis}`)}`;
}
function agentAIProduktyWdrozenie(){
  const addedIds=new Set((produktyDodane||[]).map(p=>String(p.id)));
  return produktyDoAdministracji().filter(p=>addedIds.has(String(p.id))&&p.agentOnboardingStatus&&p.agentOnboardingStatus!=="completed");
}
function agentAISynchronizujCyklZadan(analiza=[]){
  const now=new Date().toISOString(),next={...(agentAIPlanCykl&&typeof agentAIPlanCykl==="object"?agentAIPlanCykl:{})};let changed=false;
  for(const task of analiza){
    const id=String(task.id||"");if(!id)continue;
    const fingerprint=agentAIOdciskZadania(task),current=next[id];
    if(task.poziom==="ok"){
      if(current&&current.state!=="resolved"){
        next[id]={...current,state:"resolved",resolvedAt:now,lastStatus:"ok",updatedAt:now};changed=true;
      }
      continue;
    }
    if(!current||current.state==="resolved"||current.fingerprint!==fingerprint){
      next[id]={id,fingerprint,state:"open",title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",firstSeenAt:now,updatedAt:now};changed=true;
    }else if(current.title!==task.tytul||current.description!==task.opis||current.severity!==task.poziom){
      next[id]={...current,title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",updatedAt:now};changed=true;
    }
  }
  if(changed){agentAIPlanCykl=next;zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);zaplanujZapisUstawien();}
  return next;
}
function agentAIAnalizaAktywna(analiza=agentAIAnaliza()){
  const cycle=agentAISynchronizujCyklZadan(analiza);
  return analiza.filter(task=>task.poziom!=="ok"&&!(cycle[task.id]?.state==="done"&&cycle[task.id]?.fingerprint===agentAIOdciskZadania(task)));
}
function agentAIOznaczZadanieWykonane(id,source="administrator"){
  const analiza=agentAIAnaliza(),task=analiza.find(x=>String(x.id)===String(id));if(!task)return;
  agentAISynchronizujCyklZadan(analiza);
  const now=new Date().toISOString(),fingerprint=agentAIOdciskZadania(task),current=agentAIPlanCykl[id]||{};
  agentAIPlanCykl={...agentAIPlanCykl,[id]:{...current,id:String(id),fingerprint,state:"done",title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",completedAt:now,completedBy:sesja?.email||"administrator",completionSource:source,updatedAt:now}};
  zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);
  zapiszHistorieAgenta("zadanie-wykonane",`Zakończono zadanie planu: ${task.tytul}`,{taskId:id,fingerprint,source,opis:task.opis||""});
  zaplanujZapisUstawien();toast("✅ Zadanie przeniesiono do historii. Wróci tylko, gdy pojawi się nowy problem.");renderuj();
}
function agentAIPrzywrocZadanie(id){
  const current=agentAIPlanCykl?.[id];if(!current)return;
  agentAIPlanCykl={...agentAIPlanCykl,[id]:{...current,state:"open",reopenedAt:new Date().toISOString(),reopenedBy:sesja?.email||"administrator",updatedAt:new Date().toISOString()}};
  zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);zapiszHistorieAgenta("zadanie-przywrocone",`Przywrócono zadanie planu: ${current.title||id}`,{taskId:id});zaplanujZapisUstawien();renderuj();
}
function agentAIAnaliza(){
  const zam=pobierzZamowienia(), produktyAdmin=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const aktywne=zam.filter(z=>!["anulowane","zakończone","dostarczone"].includes(String(z.status||"").toLowerCase()));
  const firmoweBezSzkicu=zam.filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  const doPotwierdzenia=zam.filter(z=>z.wymagaPotwierdzeniaDostepnosci);
  const bezNumeru=aktywne.filter(z=>!daneWysylki(z).numer);
  const bezCeny=produktyAdmin.filter(p=>!produktMaCeneSprzedazy(p));
  const niedostepne=produktyAdmin.filter(produktOznaczonyNiedostepny);
  const bezZdjec=produktyAdmin.filter(p=>!p.zdjecie);
  const prog=Number(ustawieniaMagazynuPelne().progNiski)||5, rez=rezerwacjeMagazynowe();
  const niskiStan=produktyAdmin.filter(p=>{const s=stanMagazynuId(p.id);return s!==null&&s<=progNiskiProduktu(p);});
  const plan=potrzebyZatowarowania();
  const nadrezerwacje=produktyAdmin.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;});
  const brakKartoteki=produktyAdmin.filter(p=>!magazynMetaProduktu(p.id).lokalizacja||!magazynMetaProduktu(p.id).dostawca);
  const bezMonitoringu=produktyAdmin.filter(p=>stanMagazynuId(p.id)===null);
  const stareInwentaryzacje=produktyAdmin.filter(p=>{
    const s=stanMagazynuId(p.id), d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja;
    if(s===null) return false;
    if(!d) return true;
    return (Date.now()-new Date(d).getTime())>90*86400000;
  });
  const lokAktywne=magazynLokalizacjeAktywne(), statLok=statystykiLokalizacji(produktyAdmin), lokPozaSlownikiem=Object.keys(statLok).filter(k=>k!=="BRAK"&&!magazynLokalizacjaPoKodzie(k));
  const nadwyzki=agentAINadwyzkiDoPrzyjecia();
  const linkiProd=agentAILinkiOczekujace(),linkiDoWyboru=linkiProd.filter(x=>String(x.status||"").toLowerCase()==="wymaga wyboru"),linkiDoPonowienia=agentAILinkiGotoweDoPonowienia();
  const monitoringProducentow=statystykiDostepnosciProducentow(), alertyProducentow=[...monitoringProducentow.braki,...monitoringProducentow.niskie];
  const opisyDoPoprawy=agentAIProduktyZProblememOpisu(500);
  const produktyWdrozenie=agentAIProduktyWdrozenie();
  const allegroKontrola=aktywneZamowieniaAllegro().map(z=>({z,a:allegroAnalizaMagazynowaZamowienia(z)}));
  const allegroBraki=allegroKontrola.filter(x=>x.a.braki>0||x.a.nierozpoznane>0);
  const allegroOfertaTasks=allegroAktywneZadaniaAgentaOfert();
  const allegroDefaultsIssues=Object.values(allegroStan.offerDefaultsAudit?.items||{}).filter(x=>!x.stockUpdated||!x.republishUpdated);
  const problemyFunkcji=[!chmuraStan.dostepna?"wspólna baza":null,stanBramki.sprawdzono&&stanBramki.email?.configured===false?"e-mail":null,stanBramki.sprawdzono&&stanBramki.inpost?.configured===false?"InPost":null,allegroStan.sprawdzono&&!allegroStan.connected?"Allegro":null,infaktStan.sprawdzono&&!infaktStan.connected?"inFakt":null].filter(Boolean);
  const syncTime=Date.parse(chmuraStan.updated_at||""),syncAge=Number.isFinite(syncTime)?Math.max(0,Math.round((Date.now()-syncTime)/60000)):null,syncStale=syncAge!==null&&syncAge>5;
  const pozycje=[
    {id:"funkcjonalnosc-strony",poziom:problemyFunkcji.length?"bad":"ok",ikona:"🩺",tytul:"Funkcjonalność strony — priorytet 1",opis:problemyFunkcji.length?`Kontroli wymagają: ${problemyFunkcji.join(", ")}.`:`Baza i sprawdzone integracje krytyczne odpowiadają poprawnie.`,akcja:problemyFunkcji.length?"#/diagnostyka":"plan-bezpieczny"},
    {id:"synchronizacja-danych",poziom:!chmuraStan.admin?"bad":syncStale?"warn":"ok",ikona:"🔄",tytul:"Pobieranie i świeżość danych — priorytet 2",opis:!chmuraStan.admin?"Agent nie ma aktywnego dostępu do wspólnej bazy.":syncAge===null?"Brak potwierdzonego czasu ostatniej synchronizacji.":`Ostatnia synchronizacja wspólnej bazy: ${syncAge} min temu.`,akcja:"plan-bezpieczny"},
    {id:"wdrozenie-produktow",poziom:produktyWdrozenie.some(p=>p.agentOnboardingStatus==="needs_attention")?"bad":produktyWdrozenie.length?"warn":"ok",ikona:"✨",tytul:"Nowe produkty administratora — wdrożenie Agenta",opis:produktyWdrozenie.length?`${produktyWdrozenie.length} nowych produktów wymaga dokończenia kontroli danych, duplikatów, opisów, zdjęć, producenta, kategorii sklepu lub przygotowania Allegro.`:"Każdy nowy produkt administratora przeszedł pełną kontrolę Agenta.",akcja:"#/admin/agent-ai/produkty"},
    {id:"allegro-magazyn",poziom:allegroBraki.length?"bad":"ok",ikona:"🟠",tytul:"Zlecenia Allegro — braki i pakowanie",opis:allegroBraki.length?`${allegroBraki.length} aktywnych zleceń Allegro wymaga zamówienia brakujących sztuk albo poprawy EAN/SKU.`:`${allegroKontrola.length} aktywnych zleceń Allegro sprawdzono; stany pozwalają na kompletację.`,akcja:"#/admin/allegro/zamowienia"},
    {id:"allegro-oferty-agent",poziom:allegroOfertaTasks.length?"warn":"ok",ikona:"🏷️",tytul:"Agent ofert Allegro",opis:allegroOfertaTasks.length?`${allegroOfertaTasks.length} produktów ma zapisane braki danych albo błąd API wystawiania.`:"Brak otwartych zadań dotyczących ofert Allegro.",akcja:"#/admin/allegro/wystawianie"},
    {id:"allegro-ustawienia-ofert",poziom:allegroDefaultsIssues.length?"warn":"ok",ikona:"♻️",tytul:"Oferty Allegro — stan i wznawianie",opis:allegroDefaultsIssues.length?`${allegroDefaultsIssues.length} starszych ofert wymaga uzupełnienia danych wymaganych przez Allegro, aby włączyć automatyczne wznawianie. Domyślny stan sprzedażowy ${allegroStanOfertyProduktu()} jest niezależny od magazynu.`:`Oferty mają ustawiony domyślny stan ${allegroStanOfertyProduktu()} szt. i automatyczne wznawianie.`,akcja:"#/admin/allegro/ustawienia"},
    {id:"dostepnosc",poziom:doPotwierdzenia.length?"warn":"ok",ikona:"🔎",tytul:"Zamówienia do potwierdzenia dostępności",opis:doPotwierdzenia.length?`${doPotwierdzenia.length} zamówień ma pozycje powyżej ${LIMIT_POTWIERDZENIA_DOSTEPNOSCI} szt.`:"Brak zamówień wymagających potwierdzenia ilości.",akcja:"#/admin/zamowienia"},
    {id:"wysylki",poziom:bezNumeru.length?"warn":"ok",ikona:"🚚",tytul:"Przesyłki bez numeru nadania",opis:bezNumeru.length?`${bezNumeru.length} aktywnych zleceń czeka na numer/etykietę InPost.`:"Aktywne przesyłki mają komplet podstawowych danych.",akcja:"#/admin/wysylki"},
    {id:"faktury",poziom:firmoweBezSzkicu.length?"warn":"ok",ikona:"🧾",tytul:"Szkice FV / inFakt",opis:firmoweBezSzkicu.length?`${firmoweBezSzkicu.length} zamówień firmowych nie ma jeszcze szkicu FV.`:"Szkice FV są przygotowane dla zamówień firmowych.",akcja:"masowe-fv"},
    {id:"ceny",poziom:bezCeny.length?"bad":"ok",ikona:"💰",tytul:"Produkty bez ceny",opis:bezCeny.length?`${bezCeny.length} produktów wymaga uzupełnienia ceny przed sprzedażą.`:"Ceny produktów są poprawne.",akcja:"#/admin/produkty"},
    {id:"sprzedaz",poziom:niedostepne.length?"warn":"ok",ikona:"🛒",tytul:"Produkty wyłączone ze sprzedaży",opis:niedostepne.length?`${niedostepne.length} produktów jest oznaczonych jako chwilowo niedostępne.`:"Wszystkie aktywne produkty są dostępne w sprzedaży.",akcja:"#/admin/magazyn"},
    {id:"dostepnosc-producentow",poziom:monitoringProducentow.wymagajaDecyzji.length||monitoringProducentow.braki.length?"bad":monitoringProducentow.niskie.length||monitoringProducentow.nieznane.length?"warn":"ok",ikona:"🏭",tytul:"Dostępność u producentów",opis:monitoringProducentow.wymagajaDecyzji.length?`${monitoringProducentow.wymagajaDecyzji.length} produktów wymaga decyzji: pozostawić sprzedaż na określony czas, ukryć lub włączyć automatyczne wznowienie.`:alertyProducentow.length?`${monitoringProducentow.braki.length} braków i ${monitoringProducentow.niskie.length} niskich stanów u producentów ma zapisaną decyzję. Próg: ${ustawieniaMagazynuPelne().progNiskiProducenta} szt.`:`Monitorowanych linków: ${monitoringProducentow.products.length}; do odświeżenia lub bez potwierdzenia: ${monitoringProducentow.nieznane.length}.`,akcja:"#/admin/magazyn/dostawcy"},
    {id:"magazyn",poziom:"ok",ikona:"🏬",tytul:"Stan lokalnego magazynu — pomocniczo",opis:niskiStan.length?`${niskiStan.length} produktów ma niski stan lokalny. Nie jest to samodzielny powód wyłączenia sprzedaży; ważniejszy jest producent i aktywne zamówienia.`:"Lokalne stany są informacją pomocniczą.",akcja:"#/admin/magazyn/stany"},
    {id:"zatowarowanie",poziom:plan.length?"warn":"ok",ikona:"📦",tytul:"Plan zatowarowania — braki do zamówień",opis:plan.length?`${plan.length} produktów brakuje do aktywnych zamówień. Szacowana wartość braków: ${zl(plan.reduce((s,x)=>s+kwotaNum(x.ilosc*kwotaNum(x.produkt.cena)),0))}.`:"Brak produktów, których brakuje do aktywnych zamówień.",akcja:"utworz-zlecenie-braki"},
    {id:"przyjecia-nadwyzek",poziom:nadwyzki.length?"warn":"ok",ikona:"📥",tytul:"Dzienne przyjęcie nadwyżek",opis:nadwyzki.length?`${nadwyzki.length} pozycji ze zleceń agenta ma nadwyżkę do decyzji/przyjęcia na magazyn.`:"Brak nadwyżek oczekujących na przyjęcie.",akcja:"#/admin/zamowienia/tabela"},
    {id:"nadrezerwacje",poziom:nadrezerwacje.length?"bad":"ok",ikona:"🚨",tytul:"Rezerwacje większe niż stan",opis:nadrezerwacje.length?`${nadrezerwacje.length} produktów ma więcej sztuk w aktywnych zamówieniach niż fizycznie w magazynie.`:"Nie ma nadrezerwacji magazynowych.",akcja:"#/admin/magazyn"},
    {id:"kartoteka",poziom:brakKartoteki.length?"warn":"ok",ikona:"🗂️",tytul:"Kartoteka magazynowa",opis:brakKartoteki.length?`${brakKartoteki.length} produktów nie ma lokalizacji albo dostawcy.`:"Kartoteka magazynowa jest uzupełniona.",akcja:"kartoteka-domyslna"},
    {id:"lokalizacje",poziom:(!lokAktywne.length||lokPozaSlownikiem.length)?"warn":"ok",ikona:"🗺️",tytul:"Słownik lokalizacji magazynu",opis:!lokAktywne.length?"Brak utworzonych lokalizacji magazynu.":lokPozaSlownikiem.length?`${lokPozaSlownikiem.length} lokalizacji przy produktach nie ma w słowniku.`:`Aktywne lokalizacje: ${lokAktywne.length}.`,akcja:"#/admin/magazyn"},
    {id:"pamiec",poziom:(agentAIPamiec||[]).length?"ok":"warn",ikona:"🧠",tytul:"Pamięć i procedury agenta",opis:(agentAIPamiec||[]).length?`Agent ma ${(agentAIPamiec||[]).length} zapamiętanych procedur/notatek.`:"Agent nie ma jeszcze własnych procedur. Naucz go poleceniem „zapamiętaj: …”.",akcja:"#/admin/agent-ai"},
    {id:"linki-producentow",poziom:linkiDoWyboru.length?"bad":linkiProd.length?"warn":"ok",ikona:"🔗",tytul:"Linki producentów do pobrania",opis:linkiProd.length?`${linkiProd.length} zadań linków: ${linkiDoWyboru.length} wymaga wyboru właściwego produktu, ${linkiDoPonowienia.length} jest gotowych do ponownego pobrania.`:"Brak zaległych linków producentów.",akcja:"sprawdz-linki-producentow"},
    {id:"opisy-produktow",poziom:opisyDoPoprawy.length?"warn":"ok",ikona:"📝",tytul:"Opisy produktów",opis:opisyDoPoprawy.length?`${opisyDoPoprawy.length} produktów wymaga krótkiego opisu albo uporządkowania pełnego opisu.`:"Krótkie i pełne opisy produktów są uporządkowane.",akcja:"popraw-opisy"},
    {id:"monitoring",poziom:bezMonitoringu.length?"warn":"ok",ikona:"📍",tytul:"Produkty bez monitorowanego stanu",opis:bezMonitoringu.length?`${bezMonitoringu.length} produktów działa bez limitu magazynowego — poprawne, jeśli to świadoma decyzja.`:"Wszystkie produkty mają monitorowany stan.",akcja:"#/admin/magazyn"},
    {id:"inwentaryzacja",poziom:stareInwentaryzacje.length?"warn":"ok",ikona:"✅",tytul:"Inwentaryzacja",opis:stareInwentaryzacje.length?`${stareInwentaryzacje.length} monitorowanych produktów nie ma świeżej daty inwentaryzacji.`:"Inwentaryzacja monitorowanych produktów jest aktualna.",akcja:"audyt-magazynu"},
    {id:"zdjecia",poziom:bezZdjec.length?"warn":"ok",ikona:"🖼️",tytul:"Zdjęcia produktów",opis:bezZdjec.length?`${bezZdjec.length} produktów używa ikony zamiast zdjęcia.`:"Produkty mają zdjęcia.",akcja:"#/admin/produkty"},
    {id:"integracje",poziom:(stanBramki.email?.configured&&stanBramki.inpost?.configured)!==false?"ok":"warn",ikona:"🔌",tytul:"Integracje",opis:`E-mail: ${stanBramki.email?.configured?"OK":"sprawdź"} • InPost: ${stanBramki.inpost?.configured?"OK":"sprawdź"} • baza: ${chmuraStan.admin?"połączona":"wpisz hasło bazy"}`,akcja:"#/admin/personalizacja"}
  ];
  return pozycje;
}
function utworzSzkiceFakturMasowo(){
  const zam=pobierzZamowienia().filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  if(!zam.length){ toast("Brak nowych zamówień firmowych do szkiców FV"); return; }
  const nowe=zam.map(z=>daneSzkicuFakturyZamowienia(z.nr)).filter(Boolean);
  szkiceFaktur=[...nowe,...szkiceFaktur].slice(0,2000);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  loguj("info",`Agent AI: utworzono ${nowe.length} szkiców FV`);
  toast(`Utworzono ${nowe.length} szkiców FV ✅`);
  renderuj();
}
function agentAIKonkretneDzialanie(x={}){
  if(x.id==="linki-producentow"&&x.poziom==="bad")return {action:"",href:"#/admin/agent-ai/plan",label:"Wybierz właściwe produkty",done:"Każdy niejednoznaczny link ma ręcznie wybrany wariant; Agent nie zgaduje produktu.",eta:"do 30 min",mode:"approval",owner:"Administrator",requiresApproval:true};
  const automatic={
    "funkcjonalnosc-strony":{action:"plan-bezpieczny",label:"Sprawdź funkcje",done:"Baza i integracje krytyczne odpowiadają poprawnie.",eta:"1–3 min"},
    "synchronizacja-danych":{action:"plan-bezpieczny",label:"Pobierz świeże dane",done:"Sklep, Allegro, InPost i inFakt mają aktualne dane.",eta:"1–3 min"},
    faktury:{action:"masowe-fv",label:"Przygotuj szkice FV",done:"Każde zamówienie firmowe ma szkic dokumentu.",eta:"< 1 min"},
    zatowarowanie:{action:"utworz-zlecenie-braki",label:"Aktualizuj szkice producentów",done:"Każdy realny brak jest w jednym bieżącym dokumencie producenta.",eta:"< 1 min"},
    "linki-producentow":{action:"sprawdz-linki-producentow",label:"Sprawdź linki",done:"Każdy link ma zapisany wynik i listę brakujących danych.",eta:"1–5 min"},
    "opisy-produktow":{action:"popraw-opisy",label:"Popraw opisy",done:"Krótki i pełny opis mają uporządkowaną strukturę.",eta:"< 2 min"},
    kartoteka:{action:"kartoteka-domyslna",label:"Uzupełnij bezpieczne pola",done:"Produkty mają podstawową kartotekę do dalszej kontroli.",eta:"< 1 min"},
    inwentaryzacja:{action:"audyt-magazynu",label:"Wykonaj audyt",done:"Powstał raport produktów wymagających inwentaryzacji.",eta:"< 1 min"}
  };
  if(automatic[x.id])return {...automatic[x.id],mode:"automatic",owner:"Agent AI",requiresApproval:false};
  const approval={
    "wdrozenie-produktow":{href:"#/admin/agent-ai/produkty",label:"Dokończ nowe produkty",done:"Każdy nowy produkt ma kompletną tożsamość, opis, zdjęcia, producenta, kategorię sklepu i gotowy szkic Allegro."},
    "dostepnosc-producentow":{href:"#/admin/magazyn/dostawcy",label:"Wybierz termin lub ukrycie",done:"Każdy brak i niski stan ma decyzję: automat, termin 1–7 dni, ukrycie lub ręczne pozostawienie sprzedaży."},
    dostepnosc:{href:"#/admin/zamowienia",label:"Potwierdź lub ustaw oczekiwanie",done:"Każde zamówienie ma decyzję: potwierdzone, oczekiwanie 1–2 dni, kontakt z klientem albo brak."},
    sprzedaz:{href:"#/admin/magazyn/dostawcy",label:"Sprawdź powód i wybierz tryb",done:"Każdy wyłączony produkt ma termin albo jasną zasadę automatycznego wznowienia."},
    "allegro-oferty-agent":{href:"#/admin/allegro/wystawianie",label:"Uzupełnij, ponów lub zamknij",done:"Każde zadanie oferty zostało uzupełnione, ponowione albo świadomie zamknięte."},
    "przyjecia-nadwyzek":{href:"#/admin/zamowienia/tabela",label:"Przyjmij lub pozostaw",done:"Każda nadwyżka ma zapisaną decyzję i ewentualny ruch magazynowy."}
  };
  if(approval[x.id])return {...approval[x.id],action:"",eta:x.poziom==="bad"?"do 30 min":"dzisiaj",mode:"approval",owner:"Administrator",requiresApproval:true};
  return {action:"",href:String(x.akcja||"").startsWith("#")?x.akcja:"#/admin/agent-ai/plan",label:"Otwórz i zdecyduj",done:agentAIOpisKroku(x),eta:x.poziom==="bad"?"do 30 min":"dzisiaj",mode:"approval",owner:"Administrator",requiresApproval:true};
}
function agentAIProfilePlanow(){
  return {
    full:{id:"full",icon:"🧭",label:"Pełny plan",description:"Funkcjonalność, pobieranie danych i bezpieczne przygotowanie pracy.",areas:["site-health","allegro-orders","inpost","infakt"],local:["database","suppliers","invoices","links"]},
    data:{id:"data",icon:"🔄",label:"Pobieranie danych",description:"Odświeża źródła i bazę bez tworzenia dokumentów roboczych.",areas:["allegro-orders","inpost","infakt"],local:["database","links"]},
    health:{id:"health",icon:"🩺",label:"Funkcjonalność",description:"Sprawdza stronę, integracje i wspólną bazę bez operacji biznesowych.",areas:["site-health"],local:["database"]}
  };
}
function agentAIUstawProfil(profil="full"){
  if(agentAIPlanStan.busy||!agentAIProfilePlanow()[profil])return;
  agentAIPlanProfil=profil;zapiszLS("artway_agent_plan_profil",profil);agentAIPlanStan={...agentAIPlanStan,profile:profil};renderuj();
}
async function agentAIPobierzHistorieWykonan(cicho=false){
  if(agentAIPlanStan.historyLoading||!chmuraToken)return [];
  agentAIPlanStan={...agentAIPlanStan,historyLoading:true};
  try{
    const d=await chmura("agent-action-runs",{timeout:20000});
    const history=Array.isArray(d.items)?d.items:[];agentAIPlanStan={...agentAIPlanStan,history,historyLoading:false};
    if(!cicho)toast(`Pobrano ${history.length} wykonań Agenta`);renderuj();return history;
  }catch(e){agentAIPlanStan={...agentAIPlanStan,historyLoading:false};if(!cicho)toast(`Historia Agenta: ${e.message||e}`);return [];}
}
function agentAIBledneObszary(){
  const current=(agentAIPlanStan.results||[]).filter(x=>x.status==="error"&&x.area).map(x=>x.area);
  if(current.length)return [...new Set(current)];
  const last=(agentAIPlanStan.history||[]).find(x=>(x.results||[]).some(r=>r.status==="error"));
  return [...new Set((last?.results||[]).filter(x=>x.status==="error"&&x.area).map(x=>x.area))];
}
async function agentAIWykonajPlanBezpieczny(profile=agentAIPlanProfil,overrideAreas=null){
  if(agentAIPlanStan.busy)return "Plan Agenta jest już wykonywany.";
  const profiles=agentAIProfilePlanow(),retry=profile==="retry",definition=retry?{id:"retry",label:"Ponowienie błędów",areas:agentAIBledneObszary(),local:[]}:profiles[profile]||profiles.full;
  const areas=Array.isArray(overrideAreas)?overrideAreas:definition.areas;
  if(retry&&!areas.length){toast("Nie ma błędnych kroków do ponowienia");return "Nie ma błędnych kroków do ponowienia.";}
  const startedAt=new Date().toISOString(),results=[],runStarted=Date.now();
  agentAIPlanStan={...agentAIPlanStan,busy:true,current:"Uruchamianie planu",startedAt,completedAt:null,results:[],error:"",profile:definition.id,runId:""};renderuj();
  const add=(entry={})=>{const result={area:entry.area||"",name:entry.name||entry.label||"Działanie",status:entry.status||"completed",detail:String(entry.detail||entry.error||""),durationMs:Number(entry.durationMs)||0,at:new Date().toISOString()};results.push(result);agentAIPlanStan={...agentAIPlanStan,current:result.name,results:[...results]};renderuj();return result;};
  const timed=async(area,name,fn)=>{const t=Date.now();try{return add({area,name,status:"completed",detail:await fn(),durationMs:Date.now()-t});}catch(e){return add({area,name,status:"error",error:e.message||e,durationMs:Date.now()-t});}};
  try{
    if(areas.length){
      try{
        const d=await chmura("agent-run-safe-checks",{method:"POST",body:{source:"admin-agent-ai",profile:definition.id,areas},timeout:180000});
        agentAIPlanStan={...agentAIPlanStan,runId:d.run?.id||""};
        (d.run?.results||[]).forEach(x=>{const detail=x.area==="allegro-orders"?`aktywne: ${x.active||0} • nowe: ${x.newItems||0} • odświeżone: ${x.refreshed||0} • przeskanowane: ${x.scanned||0}`:x.area==="site-health"?String(x.detail||"Strona i integracje odpowiadają"):`sprawdzono: ${x.count||0}`;add({area:x.area,name:x.label,status:x.status,detail:x.status==="completed"?detail:x.error,durationMs:x.durationMs});});
      }catch(e){add({area:"server-checks",name:"Kontrole serwerowe",status:"error",error:e.message||e});}
    }
    if(definition.local.includes("database"))await timed("central-database","Wspólna baza sklepu",async()=>{const ok=await synchronizujBazeCentralna(true);if(!ok)throw new Error("Nie udało się potwierdzić synchronizacji");return "pobrano i zapisano najnowszy stan";});
    if(definition.local.includes("suppliers")){
      const t=Date.now(),shortages=potrzebyZatowarowania();
      if(shortages.length){const docs=agentAIUtworzZleceniaWedlugDostawcow("",{tryb:"braki",silent:true});add({area:"supplier-drafts",name:"Szkice zamówień do producentów",status:"completed",detail:`${docs.length} dokumentów • bez wysyłania e-maili`,durationMs:Date.now()-t});}
      else add({area:"supplier-drafts",name:"Szkice zamówień do producentów",status:"skipped",detail:"brak realnych braków do aktywnych zamówień",durationMs:Date.now()-t});
    }
    if(definition.local.includes("invoices")){
      const t=Date.now(),before=szkiceFaktur.length,missing=pobierzZamowienia().filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length;
      if(missing){utworzSzkiceFakturMasowo();add({area:"invoice-drafts",name:"Szkice FV",status:"completed",detail:`utworzono ${Math.max(0,szkiceFaktur.length-before)} szkiców • bez wystawiania faktur`,durationMs:Date.now()-t});}
      else add({area:"invoice-drafts",name:"Szkice FV",status:"skipped",detail:"brak nowych zamówień firmowych",durationMs:Date.now()-t});
    }
    if(definition.local.includes("links")){
      if(agentAILinkiOczekujace().length)await timed("supplier-links","Linki producentów",()=>agentAISprawdzLinkiProducentow(profile==="data"?5:3));
      else add({area:"supplier-links",name:"Linki producentów",status:"skipped",detail:"kolejka jest pusta"});
    }
    const completedAt=new Date().toISOString(),errors=results.filter(x=>x.status==="error").length;
    agentAIPlanStan={...agentAIPlanStan,busy:false,current:"",startedAt,completedAt,results,error:errors?`${errors} kroków wymaga ponowienia`:""};
    zapiszHistorieAgenta("plan-operacyjny",`${definition.label}: ${results.length-errors}/${results.length} kroków bez błędu`,{profile:definition.id,startedAt,completedAt,durationMs:Date.now()-runStarted,results});zaplanujZapisUstawien();
    toast(errors?`⚠️ Plan zakończony • błędy: ${errors}`:`✅ ${definition.label}: wszystkie kroki zakończone`);renderuj();void agentAIPobierzHistorieWykonan(true);
    return [`${errors?"⚠️":"✅"} ${definition.label} zakończony.`,...results.map(x=>`• ${x.status==="completed"?"✅":x.status==="skipped"?"➖":"⚠️"} ${x.name}: ${x.detail}`),"Nie wysłano e-maili, wiadomości do klientów, ofert, etykiet ani faktur bez zatwierdzenia."].join("\n");
  }catch(e){agentAIPlanStan={...agentAIPlanStan,busy:false,current:"",completedAt:new Date().toISOString(),results,error:String(e.message||e)};zapiszHistorieAgenta("plan-operacyjny","Błąd planu Agenta",{profile:definition.id,results,error:String(e.message||e)});renderuj();throw e;}
}
async function agentAIWykonaj(akcja){
  if(akcja==="plan-bezpieczny") return agentAIWykonajPlanBezpieczny(agentAIPlanProfil);
  if(akcja==="plan-full") return agentAIWykonajPlanBezpieczny("full");
  if(akcja==="plan-data") return agentAIWykonajPlanBezpieczny("data");
  if(akcja==="plan-health") return agentAIWykonajPlanBezpieczny("health");
  if(akcja==="plan-retry") return agentAIWykonajPlanBezpieczny("retry");
  if(akcja==="masowe-fv") return utworzSzkiceFakturMasowo();
  if(akcja==="sync") return synchronizujBazeCentralna(true);
  if(akcja==="export-magazyn") return eksportujMagazynCSV();
  if(akcja==="export-zakupy") return eksportujZatowarowanieCSV();
  if(akcja==="utworz-zlecenie-braki"){
    const docs=agentAIUtworzZleceniaWedlugDostawcow("",{tryb:"braki",silent:true});
    if(docs.length){ toast(`Zaktualizowano ${docs.length} dokumentów producentów ✅`); renderuj(); }
    else toast("Brak pozycji do zlecenia agenta pod aktywne zamówienia");
    return docs;
  }
  if(akcja==="utworz-zlecenie-niskie"){
    const docs=agentAIUtworzZleceniaWedlugDostawcow("",{tryb:"niskie",silent:true});
    if(docs.length){ toast(`Zaktualizowano ${docs.length} dokumentów uzupełniających ✅`); renderuj(); }
    else toast("Brak produktów do zlecenia uzupełniającego");
    return docs;
  }
  if(akcja==="sprawdz-linki-producentow") return agentAISprawdzLinkiProducentow().then(t=>toast(t));
  if(akcja==="sprawdz-dostepnosc-producentow") return agentAISprawdzDostepnoscProducentow();
  if(akcja==="popraw-opisy"){ const t=agentAIPoprawOpisyProduktow(40); toast(t); renderuj(); return t; }
  if(akcja==="kartoteka-domyslna") return wypelnijDomyslnaKartotekeMagazynu();
  if(akcja==="audyt-magazynu") return audytMagazynuAI();
  if(akcja==="raport-telegram") return agentAIWyslijRaportTelegram();
}
async function agentAIWykonajZadaniePlanu(id,akcja){
  try{
    await agentAIWykonaj(akcja);
    if(String(akcja).startsWith("plan-")&&agentAIPlanStan.error)throw new Error(agentAIPlanStan.error);
    agentAIOznaczZadanieWykonane(id,"agent-action");
  }catch(e){toast(`⚠️ Zadanie nie zostało zamknięte: ${e.message||e}`);}
}
function agentAIPriorytet(x){
  if(x.id==="funkcjonalnosc-strony") return 0;
  if(x.id==="synchronizacja-danych") return .5;
  if(x.id==="wdrozenie-produktow") return .75;
  if(x.poziom==="bad") return 1;
  if(["wysylki","zatowarowanie","nadrezerwacje","dostepnosc","dostepnosc-producentow"].includes(x.id)) return 2;
  if(x.poziom==="warn") return 3;
  return 9;
}
function agentAIOpisKroku(x){
  const mapa={
    dostepnosc:"Zweryfikuj dostępność pozycji powyżej limitu i wpisz decyzję przy zamówieniu.",
    wysylki:"Uzupełnij dane InPost, wygeneruj etykietę i zapisz numer nadania.",
    faktury:"Utwórz lub odśwież szkice FV dla zamówień firmowych.",
    "opisy-produktow":"Uruchom agenta opisów: uzupełni krótki opis i uporządkuje pełny opis bez zmiany danych technicznych.",
    "wdrozenie-produktow":"Dokończ wdrożenie produktu dodanego przez administratora: tożsamość, duplikaty, opisy, zdjęcia, producent, kategorie sklepu i Allegro.",
    ceny:"Uzupełnij cenę przed sprzedażą, żeby klient nie złożył błędnego zamówienia.",
    magazyn:"Sprawdź produkty z niskim stanem i zdecyduj, czy zamówić uzupełnienie.",
    zatowarowanie:"Przygotuj zamówienie do producenta tylko pod realne braki aktywnych zamówień.",
    nadrezerwacje:"Najpierw obsłuż nadrezerwacje — blokują kompletację zamówień.",
    kartoteka:"Uzupełnij lokalizację, dostawcę, EAN i progi magazynowe.",
    lokalizacje:"Utwórz brakujące lokalizacje w słowniku i przypisz je do produktów.",
    pamiec:"Dodaj procedury, których agent ma pilnować przy kolejnych poleceniach.",
    "linki-producentow":"Ponów pobranie URL-i producentów i sprawdź, które dane trzeba jeszcze uzupełnić w karcie produktu.",
    "allegro-oferty-agent":"Uzupełnij automatyczne sugestie producenta, kategorii i produktu katalogowego; pozostałe braki otwórz w edytorze produktu.",
    monitoring:"Zdecyduj, które produkty mają mieć kontrolowany stan, a które bez limitu.",
    inwentaryzacja:"Potwierdź stan produktów bez świeżej inwentaryzacji.",
    zdjecia:"Dodaj zdjęcia do produktów, które nadal używają samej ikony.",
    integracje:"Sprawdź konfigurację bramki, poczty i wspólnej bazy."
  };
  return mapa[x.id]||"Otwórz wskazany moduł i wykonaj kontrolę.";
}
function agentAICentrumDecyzjiHTML(){
  const supplier=statystykiDostepnosciProducentow(),orders=pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci),communication=allegroKomunikacjaStaty(),messages=[...(communication.threads||[]),...(communication.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi),offers=allegroAktywneZadaniaAgentaOfert(),surplus=agentAINadwyzkiDoPrzyjecia(),supplierDocs=(agentAIZlecenia||[]).filter(z=>!agentAIStatusZamknietyDlaNowejWersji(z.status));
  const areas=[
    {icon:"🏭",title:"Dostępność producenta",count:supplier.wymagajaDecyzji.length,href:"#/admin/magazyn/dostawcy",choices:["automat","zostaw 1–7 dni","ukryj","wznów po powrocie","aktywny bez terminu"]},
    {icon:"🔎",title:"Dostępność w zamówieniu",count:orders.length,href:"#/admin/zamowienia",choices:["potwierdź","poczekaj 1–2 dni","kontakt z klientem","potwierdź brak"]},
    {icon:"🏷️",title:"Zadania ofert Allegro",count:offers.length,href:"#/admin/allegro/wystawianie",choices:["uzupełnij","ponów","otwórz produkt","zamknij zadanie"]},
    {icon:"💬",title:"Wiadomości i dyskusje",count:messages.length,href:"#/admin/allegro/wiadomosci",choices:["odpowiedz","użyj propozycji Agenta","załatwione wewnętrznie"]},
    {icon:"📥",title:"Nadwyżki magazynowe",count:surplus.length,href:"#/admin/zamowienia/tabela",choices:["przyjmij","pozostaw","skoryguj ilość"]},
    {icon:"🧾",title:"Zamówienia producentów",count:supplierDocs.length,href:"#/admin/agent-ai/zlecenia",choices:["zatwierdź wersję","wyślij Telegram","wyślij e-mail","usuń szkic"]}
  ];
  return `<div class="panel agent-decision-center"><div class="order-section-head"><div><span class="order-pro-label">Kontrola człowieka</span><h2>🧭 Centrum decyzji administratora</h2><p class="order-detail-lead">Agent przygotowuje dane i bezpieczne propozycje, ale w miejscach wpływających na klienta, sprzedaż lub wysyłkę zawsze pokazuje konkretne warianty wyboru.</p></div><span class="lvl ${areas.some(x=>x.count)?"lvl-ostrzezenie":"lvl-ok"}">${areas.reduce((s,x)=>s+x.count,0)} otwartych decyzji</span></div><div class="agent-decision-grid">${areas.map(x=>`<article class="${x.count?"has-items":""}"><header><span>${x.icon}</span><div><b>${esc(x.title)}</b><small>${x.count?`${x.count} wymaga wyboru`:"brak otwartych decyzji"}</small></div><strong>${x.count}</strong></header><div>${x.choices.map(c=>`<span>${esc(c)}</span>`).join("")}</div><a class="btn ghost" href="${x.href}">${x.count?"Podejmij decyzje":"Otwórz moduł"}</a></article>`).join("")}</div></div>`;
}
function agentAIPlanOperacyjnyHTML(analiza){
  const zadania=agentAIAnalizaAktywna(analiza).sort((a,b)=>agentAIPriorytet(a)-agentAIPriorytet(b)).slice(0,12);
  const gotowe=analiza.filter(x=>x.poziom==="ok").length;
  const profiles=agentAIProfilePlanow(),selected=profiles[agentAIPlanProfil]||profiles.full,runResults=agentAIPlanStan.results||[],runDone=runResults.filter(x=>x.status==="completed"||x.status==="skipped").length,runErrors=runResults.filter(x=>x.status==="error").length;
  const expected=Math.max(runResults.length,selected.areas.length+selected.local.length),progress=agentAIPlanStan.busy?Math.min(95,Math.round((runDone+runErrors)/Math.max(1,expected)*100)):runResults.length?100:0;
  const runDuration=agentAIPlanStan.startedAt?Math.max(0,Math.round(((agentAIPlanStan.completedAt?Date.parse(agentAIPlanStan.completedAt):Date.now())-Date.parse(agentAIPlanStan.startedAt))/1000)):0;
  const history=(agentAIPlanStan.history||[]).slice(0,5),retryCount=agentAIBledneObszary().length,archive=Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).sort((a,b)=>String(b.completedAt||b.resolvedAt||"").localeCompare(String(a.completedAt||a.resolvedAt||""))).slice(0,12);
  return `<div class="panel agent-ops-panel">
    <div class="order-section-head">
      <div><span class="order-pro-label">Centrum wykonawcze</span><h2 style="margin-top:.2rem">🧭 Wykonywalny plan operacyjny</h2><p class="order-detail-lead">Najpierw funkcjonalność strony i świeże dane, następnie zamówienia, wysyłki, magazyn oraz katalog. Każdy krok ma właściciela, czas, wynik i jednoznaczny warunek zakończenia.</p></div>
      <div class="diag-actions"><span class="lvl ${zadania.length?"lvl-ostrzezenie":"lvl-ok"}">${zadania.length?`${zadania.length} aktywnych zadań`:"wszystko pod kontrolą"}</span></div>
    </div>
    <div class="agent-run-profiles">${Object.values(profiles).map(p=>`<button type="button" class="${agentAIPlanProfil===p.id?"active":""}" onclick="agentAIUstawProfil(${jsArg(p.id)})" ${agentAIPlanStan.busy?"disabled":""}><span>${p.icon}</span><b>${esc(p.label)}</b><small>${esc(p.description)}</small></button>`).join("")}</div>
    <div class="agent-run-toolbar"><div><b>Wybrany zakres: ${selected.icon} ${esc(selected.label)}</b><small>${selected.areas.length} kontroli serwerowych • ${selected.local.length} kroków lokalnych • operacje zewnętrzne zablokowane</small></div><div class="diag-actions"><button class="btn" onclick="agentAIWykonaj(${jsArg(`plan-${selected.id}`)})" ${agentAIPlanStan.busy?"disabled":""}>${agentAIPlanStan.busy?"⏳ Wykonuję…":"▶ Wykonaj bezpieczne działania"}</button><button class="btn ghost" onclick="agentAIWykonaj('plan-retry')" ${agentAIPlanStan.busy||!retryCount?"disabled":""}>↻ Ponów błędy${retryCount?` (${retryCount})`:""}</button></div></div>
    ${agentAIPlanStan.busy||runResults.length?`<div class="agent-execution-status ${agentAIPlanStan.error?"has-error":""}"><div><div><b>${agentAIPlanStan.busy?`Agent wykonuje: ${esc(agentAIPlanStan.current||"kontrola")}`:"Ostatnie wykonanie planu"}</b><small>${agentAIPlanStan.runId?`ID audytu ${esc(agentAIPlanStan.runId.slice(0,8))} • `:""}${runDuration}s • ${runDone} zakończonych • ${runErrors} błędów</small></div><small>${agentAIPlanStan.completedAt?esc(new Date(agentAIPlanStan.completedAt).toLocaleString("pl-PL")):"operacja w toku"}</small></div><div class="agent-run-progress"><i style="width:${progress}%"></i></div><div class="agent-execution-results">${runResults.map(r=>`<span class="${esc(r.status)}"><b>${r.status==="completed"?"✅":r.status==="skipped"?"➖":"⚠️"} ${esc(r.name)}</b><small>${esc(r.detail)}</small><em>${r.durationMs?`${Math.max(1,Math.round(r.durationMs/1000))} s`:"—"}</em></span>`).join("")}</div>${agentAIPlanStan.error?`<p>${esc(agentAIPlanStan.error)}</p>`:""}</div>`:""}
    <div class="agent-run-history"><div class="order-section-head"><div><b>Ostatnie wykonania na serwerze</b><small>Trwały audyt jest wspólny dla wszystkich urządzeń administratora.</small></div><button class="btn ghost" onclick="agentAIPobierzHistorieWykonan()" ${agentAIPlanStan.historyLoading?"disabled":""}>${agentAIPlanStan.historyLoading?"⏳":"↻"} Odśwież</button></div>${history.length?`<div class="agent-run-history-list">${history.map(h=>{const errors=(h.results||[]).filter(x=>x.status==="error").length;return `<article><span class="${errors?"error":"ok"}">${errors?"⚠️":"✅"}</span><div><b>${esc(agentAIProfilePlanow()[h.profile]?.label||h.profile||"Kontrola")}</b><small>${esc(new Date(h.completedAt||h.startedAt).toLocaleString("pl-PL"))} • ${Math.max(1,Math.round(Number(h.durationMs||0)/1000))} s • wynik ${esc(h.scoreAfter??"—")}%</small></div><code>${esc(String(h.id||"").slice(0,8))}</code></article>`;}).join("")}</div>`:`<p class="order-detail-lead">${agentAIPlanStan.historyLoading?"Pobieram historię wykonań…":"Historia pojawi się po pierwszej kontroli serwerowej."}</p>`}</div>
    <div class="agent-ops-grid">
      ${zadania.length?zadania.map((x,i)=>{const step=agentAIKonkretneDzialanie(x);return `<div class="agent-ops-step ${x.poziom} ${step.mode}">
        <div class="agent-ops-no">${i+1}</div>
        <div><div class="agent-step-heading"><b>${x.ikona} ${esc(x.tytul)}</b><span class="lvl ${step.requiresApproval?"lvl-ostrzezenie":"lvl-ok"}">${step.requiresApproval?"🔐 decyzja":"⚙️ Agent"}</span></div><p>${esc(x.opis)}</p><div class="agent-step-definition"><span><small>KONKRETNE DZIAŁANIE</small><b>${esc(step.label)}</b></span><span><small>WŁAŚCICIEL / CZAS</small><b>${esc(step.owner)} • ${esc(step.eta)}</b></span><span><small>GOTOWE, GDY</small><b>${esc(step.done)}</b></span></div></div>
        <div class="agent-task-actions">${step.action?`<button class="btn ${step.requiresApproval?"ghost":""}" onclick="agentAIWykonajZadaniePlanu(${jsArg(x.id)},${jsArg(step.action)})">${esc(step.label)}</button>`:`<a class="btn ghost" href="${esc(step.href)}">${esc(step.label)}</a>`}<button class="btn task-complete" type="button" onclick="agentAIOznaczZadanieWykonane(${jsArg(x.id)})">✓ Wykonane</button></div>
      </div>`;}).join(""):`<div class="agent-ops-empty">✅ Brak pilnych tematów. ${gotowe} kontroli ma status OK.</div>`}
    </div>
    <details class="agent-task-archive" ${zadania.length?"":"open"}><summary>✅ Zakończone zadania (${archive.length})</summary>${archive.length?`<div class="agent-task-archive-list">${archive.map(x=>`<article><span>✓</span><div><b>${esc(x.title||x.id)}</b><small>${esc(x.completedAt?new Date(x.completedAt).toLocaleString("pl-PL"):"rozwiązane automatycznie")} • ${esc(x.completedBy||"Agent")}</small></div>${x.state==="done"?`<button class="btn ghost" onclick="agentAIPrzywrocZadanie(${jsArg(x.id)})">Przywróć</button>`:`<em>problem rozwiązany</em>`}</article>`).join("")}</div>`:`<p class="order-detail-lead">Archiwum wypełni się po oznaczeniu pierwszego zadania jako wykonane.</p>`}</details>
  </div>`;
}
function agentAIPodstronaNaglowekHTML(aktywna="pulpit",activeCount=0){
  if(aktywna==="pulpit")return "";
  const pages={
    komendy:["💬","Komendy i odpowiedzi","Wydawaj polecenia zwykłym językiem. Odpowiedzi, wynik działania i audyt pozostają w jednym miejscu."],
    plan:["🧭","Plan operacyjny","Widzisz wyłącznie aktywne problemy. Wykonane zadania trafiają do historii i wracają tylko po nowym zdarzeniu."],
    produkty:["✨","Wdrożenie nowych produktów","Agent koncentruje się na produktach dodawanych przez administratora i prowadzi je od kartoteki do gotowości sklepu oraz Allegro."],
    zlecenia:["📑","Zlecenia i tabele producentów","Bieżące dokumenty robocze, ilości, zatwierdzenia i wysyłka do producentów bez mieszania z archiwum."],
    producenci:["🏭","Producenci i kontakt","Kartoteki dostawców, adresy zamówień, warunki współpracy i szablony korespondencji."],
    pamiec:["🧠","Pamięć i procedury","Reguły zapisane dla Agenta. Możesz je przeglądać, usuwać i dodawać nowe przez Komendy."],
    historia:["🕓","Historia i audyt","Zakończone zadania, wykonania planów oraz pełny rejestr działań administratora i Agenta."]
  },page=pages[aktywna]||pages.plan;
  return `<section class="panel agent-page-header"><div><span>${page[0]}</span><div><span class="order-pro-label">Agent AI</span><h1>${esc(page[1])}</h1><p>${esc(page[2])}</p></div></div><div><b>${activeCount}</b><small>aktywnych zadań</small></div></section>`;
}
function ustawFiltrAgentAIProduktow(filtr="wszystkie"){filtrAgentAIProdukty=filtr;renderuj();}
function agentAIProduktyWdrozeniePanelHTML(){
  const addedIds=new Set((produktyDodane||[]).map(p=>String(p.id))),items=produktyDoAdministracji().filter(p=>addedIds.has(String(p.id))).sort((a,b)=>String(b.createdAt||b.agentImportAt||b.id||"").localeCompare(String(a.createdAt||a.agentImportAt||a.id||""))).slice(0,500);
  const allRows=items.map(p=>({p,state:agentAIStanWdrozeniaProduktu(p),status:p.agentOnboardingStatus||"not_started"})),processing=allRows.filter(x=>x.status==="processing").length,completed=allRows.filter(x=>x.state.ready&&x.status!=="processing").length,attention=allRows.filter(x=>!x.state.ready&&x.status!=="processing").length;
  const rows=allRows.filter(x=>filtrAgentAIProdukty==="uwaga"?!x.state.ready&&x.status!=="processing":filtrAgentAIProdukty==="przetwarzanie"?x.status==="processing":filtrAgentAIProdukty==="gotowe"?x.state.ready&&x.status!=="processing":true);
  const cards=[["uwaga","⚠️",attention,"wymaga uzupełnienia",attention?"hot":""],["przetwarzanie","⏳",processing,"w trakcie kontroli",""],["gotowe","✅",completed,"gotowych produktów","money"],["wszystkie","📦",allRows.length,"produktów administratora",""]];
  return `<section class="panel agent-product-onboarding-page"><div class="order-section-head"><div><span class="order-pro-label">Priorytet administratora</span><h2>✨ Wdrożenie nowych produktów</h2><p class="order-detail-lead">Każdy produkt przechodzi sześć kontroli. Kliknij kartę licznika, aby natychmiast wyświetlić odpowiadające jej produkty.</p></div><div class="diag-actions"><a class="btn" href="#/admin/produkty/dodaj">＋ Dodaj ręcznie lub z linku</a></div></div><div class="orders-stat-grid">${cards.map(([id,icon,count,label,cls])=>`<button type="button" class="order-stat-card stat-filter ${cls} ${filtrAgentAIProdukty===id?"active":""}" onclick="ustawFiltrAgentAIProduktow(${jsArg(id)})"><span>${icon}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div><div class="agent-onboarding-filter-state"><span>Aktywny filtr: <b>${esc(cards.find(x=>x[0]===filtrAgentAIProdukty)?.[3]||"wszystkie")}</b></span><small>${rows.length} z ${allRows.length} produktów</small>${filtrAgentAIProdukty!=="wszystkie"?`<button class="btn ghost" onclick="ustawFiltrAgentAIProduktow('wszystkie')">Wyczyść filtr</button>`:""}</div><div class="agent-product-onboarding-list">${rows.map(({p,state,status})=>`<article class="${state.ready?"ready":"attention"}"><div class="agent-product-onboarding-main">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa||"Produkt bez nazwy")}</b><small>ID ${esc(p.id)} • EAN ${esc(p.gtin||p.ean||"—")} • ${esc(p.producent||p.marka||"producent —")}</small><em>${status==="processing"?"Agent pracuje":state.ready?"gotowy":"wymaga uzupełnienia"} • ${state.done}/${state.total} kontroli</em></div></div><div class="product-agent-checks">${state.checks.map(x=>`<span class="${x.ok?"done":"wait"}">${x.ok?"✓":"○"} ${esc(x.label)}</span>`).join("")}</div><div class="warehouse-worktable-actions"><button class="btn" onclick="agentAIUruchomWdrozenieProduktu(${jsArg(p.id)},this)" ${status==="processing"?"disabled":""}>🤖 ${status==="processing"?"Kontrola…":"Sprawdź i uzupełnij"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj</a></div></article>`).join("")||`<div class="agent-ops-empty">Brak produktów dla wybranego filtra.</div>`}</div></section>`;
}
function agentAIPamiecPanelHTML(){
  const memory=(agentAIPamiec||[]).slice(0,100);
  return `<section class="panel agent-memory-page"><div class="order-section-head"><div><span class="order-pro-label">Procedury trwałe</span><h2>🧠 Pamięć Agenta</h2><p class="order-detail-lead">Każda reguła synchronizuje się między urządzeniami. Agent stosuje ją jako podpowiedź, ale działania zewnętrzne nadal wymagają zatwierdzenia.</p></div><a class="btn" href="#/admin/agent-ai/komendy" onclick="setTimeout(()=>agentAIWstawKomende('zapamiętaj: '),80)">＋ Naucz Agenta</a></div><div class="orders-stat-grid"><div class="order-stat-card"><span>🧠</span><b>${memory.length}</b><small>zapisanych procedur</small></div><div class="order-stat-card money"><span>☁️</span><b>${chmuraStan.admin?"TAK":"NIE"}</b><small>synchronizacja wspólna</small></div></div>${memory.length?`<div class="agent-memory-list">${memory.map(x=>`<article class="agent-memory-item"><div><b>${esc(x.wyzwalacz||"Procedura")}</b><p>${esc(x.akcja||x.tresc)}</p><small>${esc(x.dataTxt||"")} • ${esc(x.operator||"")}</small></div><button class="btn danger" type="button" onclick="agentAIUsunPamiec(${jsArg(x.id)})">Usuń</button></article>`).join("")}</div>`:`<div class="agent-ops-empty">Nie ma jeszcze zapisanych procedur. Przejdź do Komend i wpisz „zapamiętaj: …”.</div>`}</section>`;
}
function agentAIHistoriaPanelHTML(){
  const archive=Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).sort((a,b)=>String(b.completedAt||b.resolvedAt||"").localeCompare(String(a.completedAt||a.resolvedAt||""))).slice(0,100),history=(agentAIHistoria||[]).slice(0,100),runs=(agentAIPlanStan.history||[]).slice(0,20);
  return `<section class="panel agent-history-page"><div class="order-section-head"><div><span class="order-pro-label">Pełna rozliczalność</span><h2>🕓 Historia Agenta</h2><p class="order-detail-lead">Aktywne zadania nie mieszają się z wykonanymi. Każde zakończenie zawiera operatora i moment wykonania.</p></div><button class="btn ghost" onclick="agentAIPobierzHistorieWykonan()">↻ Odśwież audyt serwera</button></div><div class="orders-stat-grid"><div class="order-stat-card money"><span>✅</span><b>${archive.length}</b><small>zakończonych zadań</small></div><div class="order-stat-card"><span>🧭</span><b>${runs.length}</b><small>wykonań planu</small></div><div class="order-stat-card"><span>🧾</span><b>${history.length}</b><small>operacji w rejestrze</small></div></div><details class="agent-history-section" open><summary>Zakończone zadania (${archive.length})</summary>${archive.length?`<div class="agent-task-archive-list">${archive.map(x=>`<article><span>✓</span><div><b>${esc(x.title||x.id)}</b><small>${esc(new Date(x.completedAt||x.resolvedAt).toLocaleString("pl-PL"))} • ${esc(x.completedBy||"Agent")}</small><p>${esc(x.description||"")}</p></div>${x.state==="done"?`<button class="btn ghost" onclick="agentAIPrzywrocZadanie(${jsArg(x.id)})">Przywróć</button>`:`<em>rozwiązane</em>`}</article>`).join("")}</div>`:`<div class="agent-ops-empty">Brak zakończonych zadań.</div>`}</details><details class="agent-history-section"><summary>Rejestr działań (${history.length})</summary><div class="warehouse-worktable-wrap"><table class="log-table"><tr><th>Data</th><th>Typ</th><th>Opis</th><th>Operator</th></tr>${history.map(h=>`<tr><td>${esc(h.dataTxt||"")}</td><td><span class="lvl lvl-info">${esc(h.typ||"akcja")}</span></td><td>${esc(h.opis||"")}</td><td>${esc(h.operator||"")}</td></tr>`).join("")||`<tr><td colspan="4">Brak działań.</td></tr>`}</table></div></details></section>`;
}
function widokAdminAgentAI(sekcja="pulpit"){
  const analiza=agentAIAnaliza();
  const aktywna=["pulpit","komendy","plan","produkty","zlecenia","producenci","pamiec","historia"].includes(String(sekcja||""))?String(sekcja||""):"pulpit";
  const aktywneZadania=agentAIAnalizaAktywna(analiza),problemy=aktywneZadania.length;
  const score=Math.max(0,Math.round(100-(aktywneZadania.filter(x=>x.poziom==="bad").length*18)-(aktywneZadania.filter(x=>x.poziom==="warn").length*8)));
  const plan=potrzebyZatowarowania().slice(0,8);
  const odpowiedziAgenta=(agentAIHistoria||[]).filter(h=>h.typ==="komenda"&&h.dane&&h.dane.odpowiedz).slice(0,5);
  const linkiProducentow=agentAILinkiOczekujace();
  const komunikacja=allegroKomunikacjaStaty(),komunikacjaDoOdpowiedzi=[...(komunikacja.threads||[]),...(komunikacja.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  const aktywneWysylki=pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn),wysylkiBezNumeru=aktywneWysylki.filter(z=>!daneWysylki(z).numer).length;
  const dokumentyProducentow=(agentAIZlecenia||[]).filter(z=>!agentAIStatusZamknietyDlaNowejWersji(z.status)).length;
  return adminSzkielet("/admin/agent-ai", `
  ${agentAISubnavHTML(aktywna)}
  ${agentAIPodstronaNaglowekHTML(aktywna,problemy)}
  <div class="panel ai-agent-panel" style="${aktywna==="pulpit"?"":"display:none"}">
    <div class="ai-agent-hero">
      <div>
        <span class="cat-label">Automatyczny kontroler administratora</span>
        <h1>🤖 Agent AI</h1>
        <p>Agent najpierw pilnuje funkcjonalności strony i świeżości pobranych danych, a następnie realizuje konkretne działania dla zamówień, Allegro, InPost, magazynu, producentów i faktur. Działania zewnętrzne nadal wymagają decyzji administratora.</p>
      </div>
      <div><div class="health-score">${score}%</div><button class="btn agent-report-btn" onclick="agentAIWykonaj('plan-bezpieczny')" ${agentAIPlanStan.busy?"disabled":""}>${agentAIPlanStan.busy?"⏳ Sprawdzam…":"▶ Sprawdź funkcje i pobierz dane"}</button><button class="btn telegram-btn agent-report-btn" onclick="agentAIWykonaj('raport-telegram')">✈️ Raport na Telegram</button></div>
    </div>
    <div class="orders-stat-grid">
      <div class="order-stat-card ${problemy?"hot":""}"><span>⚠️</span><b>${problemy}</b><small>zadań do sprawdzenia</small></div>
      <div class="order-stat-card"><span>📦</span><b>${pobierzZamowienia().filter(z=>z.status==="nowe").length}</b><small>nowych zamówień</small></div>
      <div class="order-stat-card"><span>🔎</span><b>${pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci).length}</b><small>potwierdzeń dostępności</small></div>
      <div class="order-stat-card"><span>🧾</span><b>${szkiceFaktur.length}</b><small>szkiców FV</small></div>
      <div class="order-stat-card"><span>📦</span><b>${potrzebyZatowarowania().length}</b><small>braki do zamówień</small></div>
      <div class="order-stat-card"><span>🟠</span><b>${aktywneZamowieniaAllegro().filter(z=>{const a=allegroAnalizaMagazynowaZamowienia(z);return a.braki>0||a.nierozpoznane>0;}).length}</b><small>zleceń Allegro z problemem</small></div>
      <div class="order-stat-card ${komunikacjaDoOdpowiedzi?"hot":""}"><span>💬</span><b>${komunikacjaDoOdpowiedzi}</b><small>spraw do odpowiedzi</small></div>
      <div class="order-stat-card ${wysylkiBezNumeru?"hot":""}"><span>🚚</span><b>${wysylkiBezNumeru}</b><small>wysyłek bez numeru</small></div>
      <div class="order-stat-card"><span>🏭</span><b>${dokumentyProducentow}</b><small>otwartych dokumentów producentów</small></div>
      <div class="order-stat-card ${linkiProducentow.length?"hot":""}"><span>🔗</span><b>${linkiProducentow.length}</b><small>linków producentów</small></div>
    </div>
    <div class="diag-actions agent-command-grid">
      <button class="btn telegram-btn" onclick="agentAIWykonaj('raport-telegram')">✈️ Wyślij pełny raport na Telegram</button>
      <button class="btn" onclick="agentAIWykonaj('plan-bezpieczny')" ${agentAIPlanStan.busy?"disabled":""}>▶ Wykonaj bezpieczny plan</button>
      <button class="btn" onclick="agentAIWykonaj('sync')">🔄 Synchronizuj bazę</button>
      <button class="btn ghost" onclick="agentAIWykonaj('utworz-zlecenie-braki')">🧠 Utwórz zlecenie agenta</button>
      <button class="btn ghost" onclick="agentAIWykonaj('masowe-fv')">🧾 Utwórz brakujące szkice FV</button>
      <button class="btn ghost" onclick="agentAIWykonaj('export-magazyn')">📊 Eksport magazynu</button>
      <button class="btn ghost" onclick="agentAIWykonaj('export-zakupy')">📦 Plan zatowarowania CSV</button>
      <button class="btn ghost" onclick="agentAIWykonaj('sprawdz-linki-producentow')">🔗 Sprawdź linki producentów</button>
      <button class="btn ghost" onclick="agentAIWykonaj('sprawdz-dostepnosc-producentow')">🏭 Wyrywkowo sprawdź stany producentów</button>
      <button class="btn ghost" onclick="agentAIWykonaj('audyt-magazynu')">✅ Audyt magazynu JSON</button>
      <a class="btn ghost" href="#/diagnostyka">🛠️ Diagnostyka</a>
    </div>
  </div>
  <div class="panel agent-site-map" style="${aktywna==="pulpit"?"":"display:none"}"><div class="order-section-head"><div><span class="order-pro-label">Kontekst całej strony</span><h2>🧩 Obszary pracy Agenta</h2><p class="order-detail-lead">Każdy raport i polecenie korzysta z tych samych danych oraz kieruje do właściwej podstrony.</p></div></div><div class="agent-site-grid">${[["📦","Zamówienia",pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).length,"#/admin/zamowienia","pokaż zamówienia"],["💬","Komunikacja",komunikacjaDoOdpowiedzi,"#/admin/allegro/wiadomosci","pokaż komunikację z klientami"],["🚚","InPost",wysylkiBezNumeru,"#/admin/wysylki","sprawdź wysyłki"],["🟠","Allegro",aktywneZamowieniaAllegro().length,"#/admin/allegro","sprawdź Allegro"],["🏬","Magazyn",potrzebyZatowarowania().length,"#/admin/magazyn/stany","pokaż stan magazynu"],["🏷️","Produkty",allegroAktywneZadaniaAgentaOfert().length,"#/admin/asortyment/produkty","audyt produktów"],["🏭","Producenci",dokumentyProducentow,"#/admin/agent-ai/producenci","status producentów"],["🛠️","Integracje",stanBramki.email?.configured&&stanBramki.inpost?.configured?0:1,"#/diagnostyka","diagnostyka integracji"]].map(([ico,name,count,href,command])=>`<article><span>${ico}</span><div><b>${name}</b><small>${count?`${count} tematów aktywnych`:"bez pilnych tematów"}</small></div><a class="btn ghost" href="${href}">Otwórz</a><button class="btn ghost" onclick="location.hash='#/admin/agent-ai/komendy';setTimeout(()=>agentAIWstawKomende(${jsArg(command)}),60)">Zapytaj</button></article>`).join("")}</div></div>
  <div class="panel agent-command-panel" style="${aktywna==="komendy"?"":"display:none"}">
    <div class="order-section-head">
      <div>
        <h2 style="margin-top:0">💬 Polecenie dla agenta</h2>
        <p class="order-detail-lead">Pisz normalnie po polsku. Agent działa na danych widocznych w panelu i wykonuje tylko bezpieczne akcje administratora.</p>
      </div>
      <span class="lvl lvl-info">bez tokenów w przeglądarce</span>
    </div>
    <form class="agent-command-form" onsubmit="return agentAIPrzyjmijKomende(event)">
      <textarea id="agentAICommandInput" rows="3" placeholder="Np. sprawdź czy wpadło nowe zlecenie, przygotuj zamówienie do producenta, ile mamy szachy..."></textarea>
      <div class="agent-command-actions">
        <button class="btn" type="submit">🤖 Wykonaj polecenie</button>
        <button class="btn" type="button" onclick="agentAIWstawKomende('wykonaj bezpieczny plan agenta')">Wykonaj plan</button>
        <button class="btn telegram-btn" type="button" onclick="agentAIWstawKomende('wyślij raport na Telegram')">Raport Telegram</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż centrum operacyjne')">Centrum operacyjne</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż komunikację z klientami')">Komunikacja</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('sprawdź wysyłki i InPost')">Wysyłki</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('audyt produktów i katalogu')">Produkty</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('status producentów')">Producenci</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('diagnostyka integracji')">Integracje</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('sprawdź czy wpadło nowe zlecenie')">Nowe zlecenia</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('przygotuj zamówienie do producenta')">Zamówienie do producenta</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('czego brakuje do zamówień')">Braki</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż stan magazynu')">Magazyn</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('zapamiętaj: ')">Naucz agenta</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż pamięć')">Pamięć</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż lokalizacje')">Lokalizacje</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('sprawdź linki producentów')">Linki producentów</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('popraw opisy produktów')">Opisy produktów</button>
        <button class="btn ghost" type="button" onclick="agentAIWstawKomende('synchronizuj bazę')">Synchronizacja</button>
      </div>
    </form>
    <div class="agent-command-hints">Agent rozumie kontekst całej strony: zamówienia, komunikację klientów, wysyłki InPost, Allegro, magazyn, produkty, producentów, faktury, płatności, integracje, pamięć procedur i raporty Telegram.</div>
    ${odpowiedziAgenta.length?`<div class="agent-response-list">
      ${odpowiedziAgenta.map(h=>`<div class="agent-response-card">
        <div class="agent-response-head"><b>${esc(h.dane.polecenie||"Polecenie")}</b><small>${esc(h.dataTxt||"")}</small></div>
        <pre class="agent-answer-pre">${esc(h.dane.odpowiedz||"")}</pre>
      </div>`).join("")}
    </div>`:`<p class="order-detail-lead" style="margin-bottom:0">Brak zapisanych poleceń z panelu. Wpisz pierwsze polecenie powyżej.</p>`}
  </div>
  <div style="${aktywna==="pamiec"?"":"display:none"}">${agentAIPamiecPanelHTML()}</div>
  <div style="${aktywna==="produkty"?"":"display:none"}">${agentAIProduktyWdrozeniePanelHTML()}</div>
  <div style="${["komendy","plan"].includes(aktywna)?"":"display:none"}">${agentAILinkiProducentowPanelHTML()}</div>
  <div style="${aktywna==="plan"?"":"display:none"}">${agentAIPlanOperacyjnyHTML(analiza)}${agentAICentrumDecyzjiHTML()}
  ${plan.length?`<div class="panel">
    <div class="order-section-head"><div><h2 style="margin-top:0">📦 Braki do aktywnych zamówień</h2><p class="order-detail-lead">Agent pokazuje tylko produkty, których rezerwacje z aktywnych zamówień są większe niż fizyczny stan magazynowy.</p></div><button class="btn" onclick="agentAIWykonaj('export-zakupy')">Pobierz pełny plan</button></div>
    <div class="ai-restock-grid">${plan.map(x=>`<div class="ai-restock-card ${x.poziom}">
      <b>${esc(x.produkt.nazwa)}</b>
      <small>${esc(x.produkt.sku||"ID "+x.produkt.id)} • ${esc(x.meta.dostawca||"brak dostawcy")}</small>
      <div class="ai-restock-line"><span>Dostępne</span><b>${x.dostepne===null?"∞":esc(x.dostepne)}</b></div>
      <div class="ai-restock-line"><span>Sprzedaż 30 dni</span><b>${esc(x.sprzedaz30)}</b></div>
      <div class="ai-restock-line"><span>Zamówić</span><b>${esc(x.ilosc)} szt.</b></div>
      <p>${esc(x.powod)}</p>
    </div>`).join("")}</div>
  </div>`:""}</div>
  <div style="${aktywna==="zlecenia"?"":"display:none"}">${agentAIZleceniaPanelHTML()}</div>
  <div style="${aktywna==="producenci"?"":"display:none"}">${producenciKartotekaPanelHTML()}</div>
  <div style="${aktywna==="historia"?"":"display:none"}">${agentAIHistoriaPanelHTML()}</div>`);
}
let filtrZamowien = "wszystkie", szukajZamowien = "";
