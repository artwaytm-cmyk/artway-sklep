/* GENERATED FILE — edit src/frontend/*.js and run npm run build */
/* Personalizacja = wszystkie ustawienia wyglądu i sklepu w JEDNYM miejscu,
   podzielone na zakładki. Stare adresy (#/admin/wyglad itd.) dalej działają
   i otwierają właściwą zakładkę.                                          */
const TABY_PERSONALIZACJI = [
  ["wyglad","🎨 Układ globalny"], ["rozmieszczenie","🧭 Rozmieszczenie"], ["bannery","🖼️ Banery"],
  ["podstrony","🧱 Układ podstron"], ["strony","📄 Treści prawne"], ["dostawy","🚚 Dostawa i płatności"]
];
function personalizacjaSzkielet(tab, tresc){
  return adminSzkielet("/admin/personalizacja", `
    ${adminSubnavHTML(TABY_PERSONALIZACJI.map(([id,label])=>({id,href:`#/admin/personalizacja/${id}`,label})),tab)}
    ${tresc}`);
}
/* Asortyment = produkty, katalogi, mapowanie i rabaty w JEDNYM dziale z zakładkami */
const TABY_ASORTYMENTU = [
  ["produkty","🏷️ Produkty"], ["jakosc","🧪 Jakość katalogu"], ["kategorie","🗂️ Katalogi"], ["mapowanie","🧩 Mapowanie"], ["rabaty","🎁 Kody rabatowe"], ["opinie","⭐ Opinie"]
];
function asortymentSzkielet(tab, tresc){
  return adminSzkielet("/admin/asortyment", `
    <div class="module-page-stack assortment-module-page">
      ${adminSubnavHTML(TABY_ASORTYMENTU.map(([id,label])=>({id,href:`#/admin/asortyment/${id}`,label})),tab)}
      ${tresc}
    </div>`);
}

/* Jeden standard wyszukiwania w całym panelu: zwijany nagłówek, opis,
   licznik wyników i responsywna siatka. Poszczególne domeny przekazują tylko pola. */
function adminWyszukiwaniePanelHTML({id="filtry",title="Wyszukiwanie zaawansowane",description="Wyszukuj i zawężaj wyniki bez opuszczania podstrony.",fields="",results="",active=false,open=true}={}){
  return `<details class="admin-search-standard" data-admin-search-panel="${esc(id)}" ${(open||active)?"open":""}><summary><span><b>🔎 ${esc(title)}</b><small>${esc(description)}</small></span><span class="admin-search-summary-meta">${active?`<em>Aktywne filtry</em>`:""}${results!==""?`<strong>${esc(results)} wyników</strong>`:""}<i aria-hidden="true"></i></span></summary><div class="admin-search-standard-body">${fields}</div></details>`;
}

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
function agentAIProduktyWdrozeniePanelHTML(){
  const addedIds=new Set((produktyDodane||[]).map(p=>String(p.id))),items=produktyDoAdministracji().filter(p=>addedIds.has(String(p.id))).sort((a,b)=>String(b.createdAt||b.agentImportAt||b.id||"").localeCompare(String(a.createdAt||a.agentImportAt||a.id||""))).slice(0,100),rows=items.map(p=>({p,state:agentAIStanWdrozeniaProduktu(p),status:p.agentOnboardingStatus||"not_started"})),completed=rows.filter(x=>x.status==="completed"&&x.state.ready).length,attention=rows.filter(x=>x.status==="needs_attention"||!x.state.ready).length,processing=rows.filter(x=>x.status==="processing").length;
  return `<section class="panel agent-product-onboarding-page"><div class="order-section-head"><div><span class="order-pro-label">Priorytet administratora</span><h2>✨ Wdrożenie nowych produktów</h2><p class="order-detail-lead">Każdy produkt przechodzi sześć kontroli. Agent nie tworzy duplikatu i nie ukrywa braków — pokazuje je przy konkretnej kartotece.</p></div><div class="diag-actions"><a class="btn" href="#/admin/produkty/dodaj">＋ Dodaj ręcznie lub z linku</a></div></div><div class="orders-stat-grid"><div class="order-stat-card ${attention?"hot":""}"><span>⚠️</span><b>${attention}</b><small>wymaga uzupełnienia</small></div><div class="order-stat-card"><span>⏳</span><b>${processing}</b><small>w trakcie kontroli</small></div><div class="order-stat-card money"><span>✅</span><b>${completed}</b><small>gotowych produktów</small></div><div class="order-stat-card"><span>📦</span><b>${rows.length}</b><small>produktów administratora</small></div></div><div class="agent-product-onboarding-list">${rows.map(({p,state,status})=>`<article class="${state.ready?"ready":"attention"}"><div class="agent-product-onboarding-main">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa||"Produkt bez nazwy")}</b><small>ID ${esc(p.id)} • EAN ${esc(p.gtin||p.ean||"—")} • ${esc(p.producent||p.marka||"producent —")}</small><em>${status==="processing"?"Agent pracuje":state.ready?"gotowy":"wymaga uzupełnienia"} • ${state.done}/${state.total} kontroli</em></div></div><div class="product-agent-checks">${state.checks.map(x=>`<span class="${x.ok?"done":"wait"}">${x.ok?"✓":"○"} ${esc(x.label)}</span>`).join("")}</div><div class="warehouse-worktable-actions"><button class="btn" onclick="agentAIUruchomWdrozenieProduktu(${jsArg(p.id)},this)" ${status==="processing"?"disabled":""}>🤖 ${status==="processing"?"Kontrola…":"Sprawdź i uzupełnij"}</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj</a></div></article>`).join("")||`<div class="agent-ops-empty">Nie dodano jeszcze własnych produktów. Otwórz jeden formularz i wybierz wypełnienie ręczne albo z linku producenta.</div>`}</div></section>`;
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

function klientZamowieniaLabel(z){
  const k=z?.klient||{};
  return [k.imie,k.nazwisko].filter(Boolean).join(" ") || z?.email || "gość";
}
function adminZamowienieSearchText(z){
  const k=z?.klient||{}, w=daneWysylki(z);
  return `${z?.nr||""} ${z?.email||""} ${k.imie||""} ${k.nazwisko||""} ${k.telefon||""} ${k.firma||""} ${z?.adres||""} ${z?.dostawa||""} ${z?.platnosc||""} ${w.numer||""} ${w.inpostId||""}`.toLowerCase();
}
function adminZamowieniaStatyHTML(wszystkie,zam){
  const sumaWidocznych=zam.reduce((s,z)=>s+kwotaNum(kosztyZamowienia(z).razem||z.razem),0);
  const nowe=wszystkie.filter(z=>z.status==="nowe").length;
  const realizacja=wszystkie.filter(z=>["potwierdzone","w realizacji","gotowe do wysyłki"].includes(z.status)).length;
  const bezNumeru=wszystkie.filter(z=>!["anulowane","zakończone","dostarczone"].includes(String(z.status||"").toLowerCase())&&!daneWysylki(z).numer).length;
  const maile=wszystkie.filter(z=>(daneWysylki(z).powiadomienia||[]).length).length;
  return `<div class="orders-stat-grid">
    <div class="order-stat-card hot"><span>🆕</span><b>${nowe}</b><small>nowe zamówienia</small></div>
    <div class="order-stat-card"><span>📦</span><b>${wszystkie.length}</b><small>wszystkie aktywne</small></div>
    <div class="order-stat-card"><span>⚙️</span><b>${realizacja}</b><small>w obsłudze</small></div>
    <div class="order-stat-card"><span>🏷️</span><b>${bezNumeru}</b><small>bez numeru nadania</small></div>
    <div class="order-stat-card"><span>✉️</span><b>${maile}</b><small>z historią e-maili</small></div>
    <div class="order-stat-card money"><span>💰</span><b>${zl(sumaWidocznych)}</b><small>suma widocznych</small></div>
  </div>`;
}
function adminStatusyZamowienHTML(wszystkie){
  const ile=s=>s==="wszystkie"?wszystkie.length:wszystkie.filter(z=>z.status===s).length;
  return `<div class="orders-status-strip">
    <button class="${filtrZamowien==="wszystkie"?"active":""}" onclick="filtrZamowien='wszystkie';renderuj()">Wszystkie <b>${ile("wszystkie")}</b></button>
    ${STATUSY.map(s=>`<button class="${filtrZamowien===s?"active":""}" onclick="filtrZamowien=${jsArg(s)};renderuj()">${esc(s)} <b>${ile(s)}</b></button>`).join("")}
  </div>`;
}
function adminPasujaceZamowieniaSklepu(){
  let lista=pobierzZamowienia().slice();
  if(filtrZamowien!=="wszystkie")lista=lista.filter(z=>z.status===filtrZamowien);
  if(szukajZamowien)lista=lista.filter(z=>adminZamowienieSearchText(z).includes(szukajZamowien));
  return lista;
}
function adminPrzelaczZaznaczenieZamowienia(nr,checked){
  const id=String(nr||"");if(!id)return;
  checked?zaznaczoneZamowieniaSklepu.add(id):zaznaczoneZamowieniaSklepu.delete(id);renderuj();
}
function adminZaznaczWidoczneZamowienia(checked=true){
  adminPasujaceZamowieniaSklepu().forEach(z=>checked?zaznaczoneZamowieniaSklepu.add(String(z.nr)):zaznaczoneZamowieniaSklepu.delete(String(z.nr)));renderuj();
}
function adminWyczyscZaznaczenieZamowien(){zaznaczoneZamowieniaSklepu.clear();renderuj();}
function zastosujStatusZamowieniaLokalnie(z,status){
  if(!z||!STATUSY.includes(status)||z.status===status)return null;
  const poprzedni=z.status;z.status=status;
  const w=daneWysylki(z);
  const mapaEtapow={"nowe":"do_obslugi","potwierdzone":"do_obslugi","w realizacji":"przygotowanie","gotowe do wysyłki":"przygotowanie","nadane":"transport","wysłane":"transport","w doręczeniu":"doreczenie","dostarczone":"dostarczona","zakończone":"dostarczona","zwrot":"zwrot","zwrot pieniędzy":"zwrot","anulowane":"anulowana"};
  if(mapaEtapow[status])w.etap=mapaEtapow[status];
  w.historia=[...(w.historia||[]),{czas:new Date().toLocaleString("pl-PL"),status:"Status zamówienia",opis:`${poprzedni} → ${status}`}];
  z.wysylka=w;return {z,poprzedni,status};
}
async function adminMasowoZmienStatusZamowien(){
  const status=String(document.getElementById("bulkOrderStatus")?.value||"");
  const wybrane=new Set([...zaznaczoneZamowieniaSklepu]);
  if(!wybrane.size){toast("Zaznacz co najmniej jedno zamówienie");return;}
  if(!STATUSY.includes(status)){toast("Wybierz nowy status zamówień");return;}
  const lista=pobierzZamowienia(),zmiany=[];
  for(const z of lista)if(wybrane.has(String(z.nr))){const wynik=zastosujStatusZamowieniaLokalnie(z,status);if(wynik)zmiany.push(wynik);}
  if(!zmiany.length){toast("Wybrane zamówienia mają już ten status");return;}
  zapiszLS("artway_zamowienia",lista);zaznaczoneZamowieniaSklepu.clear();
  loguj("info",`Masowa zmiana statusu ${zmiany.length} zamówień → ${status}`);renderuj();
  toast(`Zmieniam status ${zmiany.length} zamówień → ${status}…`);
  let bledy=0;
  for(let i=0;i<zmiany.length;i+=5){
    const wyniki=await Promise.allSettled(zmiany.slice(i,i+5).map(async x=>{const d=await zapiszZamowienieCentralnie(x.z,false);if(!d)await obsluzAutomatycznyEmail(x.z.nr,status);return d;}));
    bledy+=wyniki.filter(x=>x.status==="rejected").length;
  }
  toast(`✅ Zmieniono ${zmiany.length} zamówień na „${status}”${bledy?` • błędy synchronizacji: ${bledy}`:""}`);
}
function allegroZapiszCache(){
  zapiszLS("artway_allegro_zamowienia_cache", allegroZamowienia);
  zapiszLS("artway_allegro_oferty_cache", allegroOferty.slice(0,1500));
  zapiszLS("artway_allegro_mapowania_cache", allegroMapowania);
  zapiszLS("artway_allegro_komunikacja_cache", allegroKomunikacja);
}
function allegroProduktIdDlaOferty(offerId){
  const rec=(allegroMapowania||{})[String(offerId)];
  if(rec && typeof rec==="object") return rec.productId ?? rec.produktId ?? rec.id ?? "";
  return rec || "";
}
function allegroProduktDlaOferty(offerId){
  const id=allegroProduktIdDlaOferty(offerId);
  if(!id) return null;
  return pobierzProduktAdmin(Number(id)) || produktyDoAdministracji().find(p=>String(p.id)===String(id)) || null;
}
function allegroKodProduktu(p){
  return String(p?.sku||p?.kod||p?.externalId||p?.gtin||p?.id||"").trim();
}
function allegroEANProduktu(p){
  return String(p?.gtin||p?.ean||p?.kodKreskowy||"").trim();
}
function allegroKodOferty(o){
  return String(o?.externalId||o?.id||"").trim();
}
function allegroKluczeKodu(v){
  const raw=String(v||"").trim().toLowerCase();
  if(!raw) return [];
  const bezSpacji=raw.replace(/\s+/g,"");
  const bezUniw=bezSpacji.replace(/[-_ ]?uniw$/,"");
  const bezPrefixu=bezUniw.replace(/^(sku|kod|ean|gtin)[:#-]?/,"");
  const cyfry=(bezPrefixu.match(/\d{3,}/)||[])[0]||"";
  return [...new Set([raw,bezSpacji,bezUniw,bezPrefixu,cyfry].filter(Boolean))];
}
function allegroIndeksProduktowPoKodzie(){
  const indeks=new Map(), konflikty=new Set();
  const dodaj=(kod,p)=>{
    for(const k of allegroKluczeKodu(kod)){
      if(!k) continue;
      const poprzedni=indeks.get(k);
      if(poprzedni && String(poprzedni.id)!==String(p.id)){
        konflikty.add(k);
        continue;
      }
      indeks.set(k,p);
    }
  };
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    [p.sku,p.kod,p.externalId,p.gtin,p.ean,p.kodKreskowy,p.producentKod,p.kodProducenta].forEach(k=>dodaj(k,p));
  });
  konflikty.forEach(k=>indeks.delete(k));
  return indeks;
}
function allegroNormalizujNazwe(v){
  return String(v||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/&/g," i ")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function allegroTokenyNazwy(v){
  const stop=new Set(["gra","gry","planszowa","planszowe","edukacyjna","edukacyjne","zabawka","zestaw","alexander","dla","oraz","plus","wersja","mini","duza","duzy","mala","maly","od","do","na","w","i","z"]);
  return allegroNormalizujNazwe(v).split(" ").filter(t=>t.length>=3&&!stop.has(t));
}
function allegroDopasujProduktPoNazwie(nazwa, produktyLista){
  const norm=allegroNormalizujNazwe(nazwa);
  const tokeny=allegroTokenyNazwy(nazwa);
  if(!norm || !tokeny.length) return null;
  let najlepszy=null, drugi=0;
  for(const p of produktyLista){
    const pn=allegroNormalizujNazwe(p.nazwa);
    const pt=allegroTokenyNazwy(p.nazwa);
    if(!pn || !pt.length) continue;
    let score=0;
    if(pn===norm) score=1;
    else if(pt.length>=2 && pt.every(t=>tokeny.includes(t))) score=Math.min(0.94,0.62+(pt.length/Math.max(tokeny.length,pt.length))*0.34);
    else if(tokeny.length>=2 && tokeny.every(t=>pt.includes(t))) score=Math.min(0.9,0.58+(tokeny.length/Math.max(tokeny.length,pt.length))*0.32);
    if(score>0){
      if(!najlepszy || score>najlepszy.score){ drugi=najlepszy?.score||0; najlepszy={produkt:p,score}; }
      else if(score>drugi) drugi=score;
    }
  }
  return najlepszy && najlepszy.score>=0.82 && (najlepszy.score-drugi)>=0.08 ? najlepszy.produkt : null;
}
function allegroKodyZamowienDlaOferty(){
  const mapa=new Map();
  (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).forEach(z=>{
    (Array.isArray(z.lineItems)?z.lineItems:[]).forEach(it=>{
      const oid=String(it.offerId||"").trim();
      if(!oid) return;
      if(!mapa.has(oid)) mapa.set(oid,new Set());
      [it.externalId,it.offerName].filter(Boolean).forEach(k=>mapa.get(oid).add(k));
    });
  });
  return mapa;
}
function allegroSugestieAutomapowania(){
  const indeks=allegroIndeksProduktowPoKodzie();
  const produktyLista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const zZamowien=allegroKodyZamowienDlaOferty();
  const wyniki=[];
  (Array.isArray(allegroOferty)?allegroOferty:[]).forEach(o=>{
    if(allegroProduktDlaOferty(o.id)) return;
    const kody=[o.externalId,o.sku,o.gtin,o.ean,o.id];
    const dodatkowe=zZamowien.get(String(o.id||""));
    if(dodatkowe) kody.push(...dodatkowe);
    let produkt=null, kod="";
    for(const k of kody){
      for(const klucz of allegroKluczeKodu(k)){
        const p=indeks.get(klucz);
        if(p){ produkt=p; kod=klucz; break; }
      }
      if(produkt) break;
    }
    if(!produkt){
      const nazwy=[o.name];
      if(dodatkowe) nazwy.push(...[...dodatkowe].filter(x=>!allegroKluczeKodu(x).length || String(x).length>18));
      for(const n of nazwy){
        produkt=allegroDopasujProduktPoNazwie(n,produktyLista);
        if(produkt){ kod="nazwa"; break; }
      }
    }
    if(produkt) wyniki.push({offerId:String(o.id), productId:String(produkt.id), produkt, oferta:o, kod});
  });
  return wyniki;
}
async function allegroAutomapujOfertyLegacy(){
  const sugestie=allegroSugestieAutomapowania();
  if(!sugestie.length){ toast("Brak pewnych dopasowań po kodach lub nazwach Allegro"); return; }
  if(!confirm(`Automatycznie podpiąć ${sugestie.length} ofert Allegro po pewnych kodach/nazwach do produktów sklepu?`)) return;
  let ok=0, bledy=0, ostatnie=null;
  toast(`Mapuję oferty Allegro: ${sugestie.length}…`);
  for(const s of sugestie){
    try{
      ostatnie=await chmura("allegro-map-offer",{method:"POST",body:{offerId:s.offerId,productId:s.productId},timeout:12000});
      ok++;
    }catch(e){ bledy++; }
  }
  if(ostatnie?.mappings&&typeof ostatnie.mappings==="object") allegroMapowania=ostatnie.mappings;
  await allegroWczytajDane(true);
  allegroZapiszCache();
  toast(`Automapowanie Allegro: podpięto ${ok}${bledy?`, błędy: ${bledy}`:""}`);
  renderuj();
}
function allegroStatusHTML(){
  if(!allegroStan.sprawdzono && allegroStan.ladowanie) return `<span class="lvl lvl-info">sprawdzam API</span>`;
  if(allegroStan.connected&&allegroStan.requiresReauth) return `<span class="lvl lvl-ostrzezenie">połączone — brak części uprawnień</span>`;
  if(allegroStan.connected) return `<span class="lvl lvl-ok">połączone</span>`;
  if(allegroStan.configured) return `<span class="lvl lvl-ostrzezenie">wymaga autoryzacji</span>`;
  return `<span class="lvl lvl-bad">brak konfiguracji</span>`;
}
function allegroLadujJesliTrzeba(){
  if(allegroStan.sprawdzono || allegroStan.ladowanie) return;
  allegroStan={...allegroStan,ladowanie:true};
  setTimeout(()=>allegroWczytajDane(true),0);
}
async function allegroWczytajDane(cicho=false){
  try{
    const d=await chmura("allegro-data",{timeout:16000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:"",offerDefaultsAudit:d.offerDefaultsAudit||{items:{},updated_at:null},catalogMaintenance:d.catalogMaintenance||allegroStan.catalogMaintenance||{cursor:0,lastRun:null},complianceAudit:d.complianceAudit||allegroStan.complianceAudit||{items:[],summary:{},updated_at:null},offerSettings:d.offerSettings||allegroStan.offerSettings||{defaultStock:5,republish:true,producers:["Alexander","Multigra","GoDan"],autoCatalog:true,syncDescriptions:true,autoUpdateOffers:true,autoFees:true,autoCorrections:true,updated_at:null}};
    allegroZamowienia=Array.isArray(d.orders)?d.orders:[];
    allegroOferty=Array.isArray(d.offers)?d.offers:[];
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:{};
    if(d.offerLastError) allegroOstatniBladWystawienia={message:d.offerLastError.message,allegroError:{errors:d.offerLastError.errors||[]},...d.offerLastError};
    if(Array.isArray(d.threads)||Array.isArray(d.issues)) allegroKomunikacja={...allegroKomunikacja,threads:Array.isArray(d.threads)?d.threads:allegroKomunikacja.threads,issues:Array.isArray(d.issues)?d.issues:allegroKomunikacja.issues,settings:d.settings||allegroKomunikacja.settings,autoReplies:d.autoReplies||allegroKomunikacja.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:allegroKomunikacja.errors,requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||allegroKomunikacja.updated_at,sprawdzono:true};
    allegroZapiszCache();
    if(!cicho) toast("Dane Allegro odświeżone");
  }catch(e){
    allegroStan={...allegroStan,sprawdzono:true,ladowanie:false,error:e.message||String(e)};
    if(!cicho) toast("⚠️ Allegro: "+allegroStan.error);
  }
  renderuj();
}
async function allegroPolacz(){
  try{
    const d=await chmura("allegro-auth-url",{timeout:12000});
    if(!d.url) throw new Error("Serwer nie zwrócił linku autoryzacji Allegro");
    location.href=d.url;
  }catch(e){ toast("⚠️ Allegro: "+(e.message||e)); }
}
async function allegroSynchronizujZamowienia(){
  try{
    toast("Pobieram zamówienia Allegro i uruchamiam kontrolę magazynową agenta…");
    await chmuraZapiszUstawienia().catch(()=>false);
    const d=await chmura("allegro-sync-orders",{method:"POST",body:{limit:1000},timeout:120000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    await chmuraWczytajStan();
    allegroZapiszCache();
    toast(`Agent Allegro: nowe ${d.imported_new||0} • sprawdzone ${d.agent?.reviewed||0} • gotowe ${d.agent?.ready||0} • nowe do automatyzacji ${d.agent?.autoEligible||0} • braki dopisane ${d.agent?.shortagesAdded||0} • cały rejestr ${allegroZamowienia.length}`);
    renderuj();
  }catch(e){ toast("⚠️ Allegro zamówienia: "+(e.message||e)); }
}
async function allegroOznaczZamowienieSprawdzone(orderId,checked=true){
  try{
    const orderIds=Array.isArray(orderId)?orderId:[orderId];
    const d=await chmura("allegro-order-checked",{method:"POST",body:{orderIds,checked},timeout:30000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia.map(z=>String(z.id)===String(orderId)?d.order:z);
    orderIds.forEach(id=>zaznaczoneAllegroZamowienia.delete(String(id)));
    allegroZapiszCache();
    toast(checked?`Oznaczono jako sprawdzone: ${d.changed||orderIds.length} zleceń.`:`Przywrócono do obsługi: ${d.changed||orderIds.length} zleceń.`);
    renderuj();
  }catch(e){ toast("⚠️ Status obsługi Allegro: "+(e.message||e)); }
}
function allegroPrzelaczZaznaczenieZamowienia(orderId,checked){
  const id=String(orderId||"");
  if(!id)return;
  if(checked)zaznaczoneAllegroZamowienia.add(id);else zaznaczoneAllegroZamowienia.delete(id);
  renderuj();
}
function allegroWyczyscZaznaczenieZamowien(){
  zaznaczoneAllegroZamowienia.clear();
  renderuj();
}
function allegroOznaczZaznaczoneSprawdzone(checked=true){
  const ids=[...zaznaczoneAllegroZamowienia];
  if(!ids.length){toast("Zaznacz co najmniej jedno zlecenie");return;}
  allegroOznaczZamowienieSprawdzone(ids,checked);
}
async function allegroZmienStatusRealizacji(orderId,status){
  try{
    const d=await chmura("allegro-order-fulfillment",{method:"POST",body:{orderId,status},timeout:18000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia.map(z=>String(z.id)===String(orderId)?d.order:z);
    allegroZapiszCache();
    toast(`Status zamówienia zmieniony w Allegro: ${status}`);
    renderuj();
  }catch(e){ toast("⚠️ Zmiana statusu Allegro: "+(e.message||e)); }
}
async function allegroSynchronizujOferty(){
  try{
    toast("Pobieram wszystkie oferty Allegro — kolejne strony po 1000…");
    const d=await chmura("allegro-sync-offers",{method:"POST",body:{limit:10000,details:true,detailsLimit:1000},timeout:180000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    await chmuraWczytajStan().catch(()=>{});
    allegroZapiszCache();
    toast(`Pobrano oferty Allegro: ${allegroOferty.length} • szczegóły: ${d.detailedCount||0} • nowe automatyczne powiązania: ${d.autoMapped||0}`);
    renderuj();
  }catch(e){ toast("⚠️ Allegro oferty: "+(e.message||e)); }
}
function allegroUstawieniaKomunikacjiDomyslne(){
  return {
    enabled:true,
    messageCenter:true,
    issues:true,
    freshHours:48,
    template:"Dzień dobry,\n\ndziękujemy za wiadomość. Potwierdzamy, że zgłoszenie trafiło do obsługi Artway-TM. Odpowiemy możliwie jak najszybciej.\n\nPozdrawiamy\nArtway-TM"
  };
}
function allegroKomunikacjaUstawienia(){
  return {...allegroUstawieniaKomunikacjiDomyslne(), ...(allegroKomunikacja?.settings||{})};
}
async function allegroWczytajKomunikacje(cicho=false){
  try{
    const d=await chmura("allegro-communications-data",{timeout:16000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroKomunikacja={threads:Array.isArray(d.threads)?d.threads:[],issues:Array.isArray(d.issues)?d.issues:[],settings:d.settings||allegroUstawieniaKomunikacjiDomyslne(),autoReplies:d.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:[],requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||null,lastSyncSummary:d.lastSyncSummary||null,autoRepliesUpdatedAt:d.autoRepliesUpdatedAt||null,sprawdzono:true};
    allegroZapiszCache();
    if(!cicho) toast("Wczytano komunikację Allegro");
  }catch(e){ allegroStan={...allegroStan,error:e.message||String(e)};allegroKomunikacja={...allegroKomunikacja,sprawdzono:true}; if(!cicho) toast("⚠️ Komunikacja Allegro: "+(e.message||e)); }
  renderuj();
}
async function allegroSynchronizujKomunikacje(autoReply=true){
  try{
    toast(autoReply?"Synchronizuję Allegro i wysyłam brakujące pierwsze odpowiedzi…":"Synchronizuję komunikację Allegro…");
    const d=await chmura("allegro-sync-communications",{method:"POST",body:{limit:100,autoReply},timeout:120000});
    allegroStan={...allegroStan,...(d.allegro||{}),sprawdzono:true,ladowanie:false,error:""};
    allegroKomunikacja={threads:Array.isArray(d.threads)?d.threads:[],issues:Array.isArray(d.issues)?d.issues:[],settings:d.settings||allegroKomunikacjaUstawienia(),autoReplies:d.autoReply?.items||allegroKomunikacja.autoReplies||{},errors:Array.isArray(d.errors)?d.errors:[],requiresReauth:!!d.requiresReauth,updated_at:d.updated_at||null,lastSyncSummary:d.syncSummary||d.lastSyncSummary||null,autoReply:d.autoReply||null,sprawdzono:true};
    allegroZapiszCache();
    const summary=d.syncSummary||{},newCount=Number(summary.newBuyerMessages||0),sent=Number(d.autoReply?.sent?.length||0);
    toast(newCount?`Allegro: ${newCount} ${newCount===1?"nowa wiadomość klienta":"nowych wiadomości klientów"} • wątki ${summary.newThreads||0} • dyskusje ${summary.newIssues||0}${sent?` • pierwsze odpowiedzi ${sent}`:""}`:`Allegro: brak nowych wiadomości klientów${sent?` • pierwsze odpowiedzi ${sent}`:""}`);
  }catch(e){ toast("⚠️ Synchronizacja komunikacji Allegro: "+(e.message||e)); }
  renderuj();
}
async function allegroSynchronizujWszystko(){
  try{
    toast("Uruchamiam pełną synchronizację Allegro…");
    await allegroSynchronizujZamowienia();
    await allegroSynchronizujOferty();
    await allegroSynchronizujKomunikacje(true);
    toast("Pełna synchronizacja Allegro zakończona ✅");
  }catch(e){toast("⚠️ Pełna synchronizacja Allegro: "+(e.message||e));}
}
async function allegroZapiszUstawieniaKomunikacji(form){
  const fd=new FormData(form);
  const settings={
    enabled:fd.get("enabled")==="on",
    messageCenter:fd.get("messageCenter")==="on",
    issues:fd.get("issues")==="on",
    telegramReminders:fd.get("telegramReminders")==="on",
    freshHours:Number(fd.get("freshHours")||48),
    template:String(fd.get("template")||"").trim()
  };
  try{
    const d=await chmura("allegro-communications-settings",{method:"POST",body:{settings},timeout:12000});
    allegroKomunikacja={...allegroKomunikacja,settings:d.settings||settings};
    allegroZapiszCache();
    toast("Zapisano ustawienia autorespondera Allegro");
    renderuj();
  }catch(e){ toast("⚠️ Ustawienia komunikacji Allegro: "+(e.message||e)); }
}
async function allegroMapujOferte(offerId, productId, options={}){
  try{
    const id=String(productId||"").trim();
    const d=await chmura(id?"allegro-map-offer":"allegro-unmap-offer",{method:"POST",body:{offerId,productId:id,force:options.force===true,replaceExisting:options.replaceExisting===true},timeout:45000});
    allegroMapowania=(d.mappings&&typeof d.mappings==="object")?d.mappings:allegroMapowania;
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;
    rezerwacjeMagazynowe._cache=null;
    if(id)await chmuraWczytajStan().catch(()=>{});
    allegroZapiszCache();
    toast(id?`Połączono ofertę z produktem sklepu${d.validation?.score?` • pewność ${d.validation.score}%`:""}`:"Powiązanie produktu zostało usunięte");
    renderuj();
    return {ok:true,data:d};
  }catch(e){allegroMapowaniePozycjiCel={...allegroMapowaniePozycjiCel,error:e};toast("⚠️ Mapowanie Allegro: "+(e.message||e));return {ok:false,error:e};}
}
async function allegroDodajProduktZOferty(offerId){
  const o=allegroOferty.find(x=>String(x.id)===String(offerId));
  if(!o){ toast("Nie znaleziono oferty Allegro"); return; }
  const maxId=Math.max(0,...prodBazowe.map(p=>Number(p.id)||0),...produktyDodane.map(p=>Number(p.id)||0));
  const id=maxId+1;
  const cena=kwotaNum(o.price?.amount ?? o.price ?? 0);
  const KOLORY=["#dbeafe","#e0e7ff","#fef3c7","#dcfce7","#fee2e2","#f3e8ff","#fce7f3","#ffedd5"];
  const p={
    id,
    nazwa:o.name||`Oferta Allegro ${o.id}`,
    kategoria:"Allegro",
    cena,
    opis:`Produkt utworzony z oferty Allegro ${o.id}. Uzupełnij opis, zdjęcia i kategorię docelową w Asortymencie.`,
    ikona:"🟠",
    badge:"Allegro",
    kolor:KOLORY[id%KOLORY.length],
    sku:String(o.externalId||o.id||"").trim(),
    externalId:String(o.externalId||o.id||"").trim(),
    gtin:String(o.gtin||o.ean||"").trim(),
    ean:String(o.ean||o.gtin||"").trim(),
    mpn:String(o.manufacturerCode||o.producerCode||"").trim(),
    kodProducenta:String(o.manufacturerCode||o.producerCode||"").trim(),
    producent:String(o.brand||"").trim(),
    marka:String(o.brand||"").trim(),
    zdjecie:o.mainImage||((o.images||[])[0])||"",
    zdjecia:(o.images||[]).slice(1,16),
    allegroOfferId:String(o.id||"").trim(),
    allegroCategoryId:String(o.categoryId||"").trim(),
    allegroProductId:String(o.productId||"").trim(),
    allegroShippingSubsidy:ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI,
    createdAt:new Date().toISOString(),
    createdBy:sesja?.email||"administrator",
    agentOnboardingStatus:"processing",
    agentOnboardingStartedAt:new Date().toISOString()
  };
  if(o.descriptionText) p.opis=o.descriptionText;
  const poprawiony=agentAIPoprawOpisyDanychProduktu(p);
  produktyDodane.push(poprawiony);
  zapiszLS("artway_produkty_dodane",produktyDodane);
  zbudujProdukty();
  await allegroMapujOferte(o.id,id);
  const onboardingProduct=pobierzProduktAdmin(id)||poprawiony,onboardingState=agentAIStanWdrozeniaProduktu(onboardingProduct),onboardingStatus=onboardingState.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie produktu utworzonego z Allegro: ${poprawiony.nazwa}`,{produktId:id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  toast("Produkt utworzony z Allegro i podpięty");
}
function produktDlaAllegroZFormularza(form,id,poprzedni={}){
  const fd=new FormData(form);
  const dane=daneProduktuZFormularza(fd,id,poprzedni);
  if(!dane){ toast("⚠️ Uzupełnij poprawną nazwę i cenę produktu"); return null; }
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
  const poprzedni=id?pobierzProduktAdmin(Number(id))||{}:{};
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
  const p=pobierzProduktAdmin(Number(id));
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
  const key=String(id),idx=produktyDodane.findIndex(x=>String(x.id)===key),base=idx>=0?produktyDodane[idx]:(produktyEdytowane[key]||{}),next={...base};let changed=false;
  for(const [field,value] of Object.entries(fields)){if(value===undefined||value===null||value==="")continue;if(tylkoBrakujace&&(next[field]!==undefined&&next[field]!==null&&String(next[field]).trim()!==""))continue;if(JSON.stringify(next[field])!==JSON.stringify(value)){next[field]=value;changed=true;}}
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
function allegroZapiszAutoUzupelnienia(p,d={}){
  if(!p?.id)return false;
  const auto=d.autoFilled||{},catalog=d.catalogMatch?.selected||{},category=d.categorySuggestion?.selected||{};
  const canonical=allegroProducentKanoniczny({...p,producent:auto.producent||p.producent,marka:auto.marka||p.marka});
  const fields={
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
  const improved=d.improvedDescriptions||{},next={allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},force={};let changed=p.allegroShippingSubsidy===undefined;
  for(const [key,value] of Object.entries(fields))if(value&&(!p[key]||(canonical&&key==="producent"&&String(p[key])!==String(value)))){next[key]=String(value);changed=true;}
  const extraImages=(Array.isArray(auto.zdjecia)?auto.zdjecia:[]).filter(Boolean).filter(x=>x!==fields.zdjecie).slice(0,15);
  if(extraImages.length&&!(Array.isArray(p.zdjecia)&&p.zdjecia.length)){next.zdjecia=extraImages;changed=true;}
  if(Array.isArray(auto.allegroParameters)&&auto.allegroParameters.length&&!Array.isArray(p.allegroParameters)){next.allegroParameters=auto.allegroParameters;changed=true;}
  if(improved.shortDescription&&String(improved.shortDescription)!==String(p.opisKrotki||"")){force.opisKrotki=String(improved.shortDescription);changed=true;}
  if(improved.fullDescription&&String(improved.fullDescription)!==String(p.opis||"")){force.opis=String(improved.fullDescription);changed=true;}
  if(Array.isArray(improved.sections)&&improved.sections.length){force.allegroDescriptionSections=improved.sections;changed=true;}
  const form=document.querySelector("form.product-editor-form");
  if(form){
    for(const [key,value] of Object.entries(fields))uzupelnijPoleFormularza(form,key,value,false);
    extraImages.forEach((url,i)=>uzupelnijPoleFormularza(form,"zdjecie"+(i+2),url,false));
    uzupelnijPoleFormularza(form,"opisKrotki",improved.shortDescription,true);
    uzupelnijPoleFormularza(form,"opis",improved.fullDescription,true);
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
    const d=await chmura("allegro-offer-draft",{method:"POST",body:{product:produkt,options:{stock:allegroStanOfertyProduktu(produkt)}},timeout:60000});
    allegroZapiszAutoUzupelnienia(produkt,d);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    const brak=(d.missing||[]).join(", ")||"brak";
    const cat=d.categorySuggestion?.selected;
    const msg=d.ready?(d.operation==="update"?`Znaleziono ofertę ${d.existingOffer?.offer?.id||""} — zostanie zaktualizowana bez duplikatu.`:"Szkic jest gotowy technicznie do wysłania do Allegro."):"Szkic wymaga uzupełnienia: "+brak;
    toast("🟠 Allegro: "+msg);
    const box=document.getElementById("allegroDraftPreview");
    if(box) box.innerHTML=`${allegroKategorieHTML(d.categorySuggestion)}${cat?`<div class="backend-note">Dobrana kategoria: <b>${esc(cat.name)}</b> (${esc(cat.id)})</div>`:""}${allegroDraftDiagnostykaHTML(d,msg,brak)}`;
  }catch(e){ allegroZapiszAutoUzupelnienia(produkt,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProdukt(id){
  const form=document.querySelector("form.product-editor-form");
  const produkt=id?produktDlaAllegroZFormularza(form,id,pobierzProduktAdmin(id)||{}):null;
  if(!produkt) return;
  try{
    const publicationAction=allegroTrybPublikacji();
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:produkt,options:{stock:allegroStanOfertyProduktu(produkt),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(produkt,d);
    allegroPokazKategorieWFormularzu(d.categorySuggestion);
    allegroZapiszAutoUzupelnienia(produkt,d);
    toast(d.operation?.completed===false?"🟠 Allegro przyjęło operację — kończy przetwarzanie oferty w tle":d.mode==="updated"?`🟠 Zaktualizowano istniejącą ofertę Allegro — ${d.match?.reason||"dopasowanie"}`:"🟠 Utworzono nową ofertę Allegro");
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||form.elements.allegroCategoryId?.value||"";
      produktyEdytowane[id]={...(produktyEdytowane[id]||{}),allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})};
      zapiszLS("artway_produkty_edytowane",produktyEdytowane);
      allegroZastosujWynikWystawienia(produkt,d);
      await allegroPobierzProwizjeProduktu(id,null,{silent:true}).catch(()=>null);
      await chmuraWczytajStan().catch(()=>{});
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      renderuj();
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
  zapiszPolaProduktuLokalnie(id,fields,true);const updated=pobierzProduktAdmin(Number(id))||{id,...fields};agentAIZakonczLinkProducenta(updated.sourceUrl||updated.producentUrl,updated);zapiszHistorieAgenta("produkt-z-linku",`Agent uzupełnił istniejący produkt #${id}: ${updated.nazwa||source.nazwa}`,{produktId:id,zrodlo:fields.agentImportSource,confidence:fields.agentImportConfidence});if(chmuraToken)void chmuraZapiszUstawienia();toast("Istniejący produkt uzupełniony — nie utworzono duplikatu");location.hash=`#/admin/produkty/edytuj/${encodeURIComponent(String(id))}`;
}
function agentAIWariantyJednegoLinkuHTML(d={}){
  const alternatives=Array.isArray(d.alternatives)?d.alternatives:[];
  return `<div class="product-link-agent-report needs-choice"><header><div><span>🤖 Agent rozpoznał kilka kart</span><h3>Wybierz właściwy produkt</h3><small>Tylko w tej wyjątkowej sytuacji potrzebna jest jedna decyzja. Po wyborze Agent wykona całą resztę.</small></div><span class="lvl lvl-ostrzezenie">${alternatives.length} możliwości</span></header><div class="product-link-candidate-grid">${alternatives.map((c,i)=>`<article>${c.product?.zdjecie?`<img src="${esc(c.product.zdjecie)}" alt="">`:`<span>📦</span>`}<div><b>${esc(c.product?.nazwa||`Produkt ${i+1}`)}</b><small>EAN ${esc(c.product?.ean||c.product?.gtin||"—")} • kod ${esc(c.product?.kodProducenta||c.product?.mpn||"—")}</small><small>${esc(c.confidence||0)}% • ${esc(c.url||"")}</small></div><button class="btn" type="button" onclick="agentAIWybierzWariantJednegoLinku(${i},this)">Wybierz — Agent zrobi resztę</button></article>`).join("")}</div></div>`;
}
function agentAIProduktGotowyZLinku(d={},url=""){
  const source={...(d.product||{})},category=d.storeCategory?.name?d.storeCategory:agentAIDobierzKategorieProduktu(source),canonical=allegroProducentKanoniczny({...source,sourceUrl:source.sourceUrl||url,producentUrl:source.producentUrl||url}),canonicalUrl=String(d.canonicalUrl||d.resolvedUrl||source.sourceUrl||url).trim(),now=new Date().toISOString();
  const product={...source,kategoria:category.name||source.kategoria||"",producent:canonical||source.producent||source.marka||"",marka:source.marka||canonical||source.producent||"",sourceUrl:canonicalUrl,producentUrl:canonicalUrl,agentImportAt:now,agentImportConfidence:Number(d.confidence||source.agentImportConfidence||0),agentImportSource:d.fromCache?"pamięć Agenta + źródło produktu":"strona źródłowa produktu + Agent",agentImportUrl:canonicalUrl,sourceEvidence:{...(source.sourceEvidence||{}),requestedUrl:url,canonicalUrl,fetchedAt:source.sourceEvidence?.fetchedAt||source.producentSprawdzonoAt||now,fieldSources:d.fieldSources||source.sourceEvidence?.fieldSources||{}},ikona:source.ikona||(/\b(gra|gry|puzzle|układank|zabaw)/i.test(`${source.nazwa||""} ${category.name||""}`)?"🎲":"📦"),sku:source.sku||source.externalId||"",externalId:source.externalId||source.sku||"",cena:Number(source.cena)||0,createdAt:now,createdBy:sesja?.email||"administrator",agentOnboardingStatus:"processing",agentOnboardingStartedAt:now};
  return domyslneKosztyDoProduktu(agentAIPoprawOpisyDanychProduktu(product),false);
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
function allegroProduktSelectHTML(offerId){
  const pid=String(allegroProduktIdDlaOferty(offerId)||"");
  const lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).sort((a,b)=>String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl")).slice(0,1000);
  return `<select class="allegro-map-select" onchange="allegroMapujOferte(${jsArg(offerId)},this.value)">
    <option value="">Nie podpięto</option>
    ${lista.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===pid?"selected":""}>${esc(allegroKodProduktu(p)||"ID "+p.id)} — ${esc(skrocTekst(p.nazwa,70))}</option>`).join("")}
  </select>`;
}
function allegroStatusKolejki(z){
  const status=String(z?.status||"").toUpperCase(), fulfillment=String(z?.fulfillmentStatus||"").toUpperCase();
  if(status==="CANCELLED"||fulfillment==="CANCELLED") return "CANCELLED";
  return fulfillment||"NEW";
}
function allegroStatusKolejkiMeta(z){
  const s=allegroStatusKolejki(z);
  return ({
    NEW:{label:"Nowe",klasa:"lvl-ostrzezenie"},PROCESSING:{label:"W realizacji",klasa:"lvl-info"},READY_FOR_SHIPMENT:{label:"Gotowe do wysłania",klasa:"lvl-info"},READY_FOR_PICKUP:{label:"Gotowe do odbioru",klasa:"lvl-info"},SENT:{label:"Wysłane",klasa:"lvl-ok"},PICKED_UP:{label:"Odebrane",klasa:"lvl-ok"},CANCELLED:{label:"Anulowane",klasa:"lvl-blad"},SUSPENDED:{label:"Wstrzymane",klasa:"lvl-blad"},RETURNED:{label:"Zwrócone",klasa:"lvl-blad"}
  })[s]||{label:s||"NEW",klasa:"lvl-info"};
}
function allegroLokalnyStatus(z={}){return [z.warehouseStage,z.agentStage,z.localStage,z.magazynStatus,z.localStatus].map(v=>String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l"));}
function allegroZamowienieZrealizowaneLokalnie(z={}){return allegroLokalnyStatus(z).some(s=>["zrealizowane","zamkniete","wyslane","anulowane"].includes(s))||z.agentHandled===true||z.localCompleted===true;}
function allegroEtapMagazynu(z={}){const official=allegroStatusKolejki(z);if(["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(official))return "zamkniete";if(allegroZamowienieZrealizowaneLokalnie(z))return "zrealizowane";const s=String(z.warehouseStage||"").toLowerCase();return ["do_sprawdzenia","braki","kompletacja","spakowane"].includes(s)?s:"do_sprawdzenia";}
function allegroEtapMagazynuMeta(z={}){return ({do_sprawdzenia:{label:"Do sprawdzenia",klasa:"lvl-ostrzezenie"},braki:{label:"Braki — zamówić",klasa:"lvl-blad"},kompletacja:{label:"Kompletacja",klasa:"lvl-info"},spakowane:{label:"Spakowane",klasa:"lvl-ok"},zrealizowane:{label:"Zrealizowane lokalnie",klasa:"lvl-ok"},zamkniete:{label:"Zamknięte przez Allegro",klasa:"lvl-ok"}})[allegroEtapMagazynu(z)];}
async function allegroUstawEtapMagazynu(orderId,stage){
  try{const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderId,stage},timeout:18000});allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;allegroZapiszCache();toast("Etap magazynu zapisany — status Allegro pozostał bez zmian");renderuj();}catch(e){toast("⚠️ Etap magazynu: "+(e.message||e));}
}
async function allegroUstawEtapZaznaczonychZamowien(){
  const stage=String(document.getElementById("bulkAllegroWarehouseStage")?.value||"");
  const ids=[...zaznaczoneAllegroZamowienia];
  if(!ids.length){toast("Zaznacz co najmniej jedno zlecenie Allegro");return;}
  if(!["do_sprawdzenia","braki","kompletacja","spakowane","zrealizowane"].includes(stage)){toast("Wybierz etap magazynowy");return;}
  try{
    toast(`Zmieniam etap ${ids.length} zleceń Allegro…`);
    const d=await chmura("allegro-order-warehouse-stage",{method:"POST",body:{orderIds:ids,stage},timeout:45000});
    allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;zaznaczoneAllegroZamowienia.clear();allegroZapiszCache();
    toast(`✅ Zmieniono etap ${d.changed||0} zleceń${d.skipped?.length?` • pominięto zamknięte: ${d.skipped.length}`:""}. Statusy Allegro pozostały bez zmian.`);renderuj();
  }catch(e){toast("⚠️ Masowy etap Allegro: "+(e.message||e));}
}
function allegroOfertaPoId(offerId){
  return (Array.isArray(allegroOferty)?allegroOferty:[]).find(o=>String(o.id)===String(offerId))||null;
}
function allegroKluczPorownania(v){ return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
function allegroOfertyPasujaceDoProduktu(p={}){
  const oferty=Array.isArray(allegroOferty)?allegroOferty:[];
  const direct=String(p.allegroOfferId||"").trim();
  const pid=String(p.id??"").trim();
  const mappedIds=new Set(Object.values(allegroMapowania||{}).filter(m=>String(m?.productId??"")===pid).map(m=>String(m?.offerId||"")).filter(Boolean));
  const external=allegroKluczPorownania(p.externalId||p.sku||p.kodProducenta||p.mpn);
  const ean=allegroKluczPorownania(p.gtin||p.ean);
  const code=allegroKluczPorownania(p.kodProducenta||p.mpn);
  const catalog=String(p.allegroProductId||"").trim();
  const name=allegroKluczPorownania(p.nazwa||p.name);
  return oferty.map(o=>{
    let score=0,reason="";
    if(direct&&String(o.id)===direct){score=100;reason="ID oferty";}
    else if(mappedIds.has(String(o.id))){score=99;reason="mapowanie";}
    else if(catalog&&String(o.productId||"")===catalog){score=97;reason="ID produktu Allegro";}
    else if(external&&allegroKluczPorownania(o.externalId)===external){score=95;reason="SKU / external.id";}
    else if(ean&&allegroKluczPorownania(o.ean||o.gtin)===ean){score=93;reason="EAN/GTIN";}
    else if(code&&allegroKluczPorownania(o.manufacturerCode||o.producerCode)===code){score=90;reason="kod producenta";}
    else if(name&&allegroKluczPorownania(o.name)===name){score=86;reason="identyczna nazwa";}
    return score?{offer:o,score,reason}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.offer.id).localeCompare(String(b.offer.id)));
}
function allegroAudytDuplikatow(){
  const produkty=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const grupy=produkty.map(p=>({produkt:p,dopasowania:allegroOfertyPasujaceDoProduktu(p).filter(allegroDopasowanieDuplikatuAktywne)})).filter(x=>x.dopasowania.length>1);
  const offerIds=new Set(grupy.flatMap(x=>x.dopasowania.map(d=>String(d.offer.id))));
  return {grupy,offerIds,produkty:grupy.length,oferty:offerIds.size};
}
function allegroDopasowanieDuplikatuAktywne(d={}){const id=String(d.offer?.id||""),status=String(d.offer?.status||d.offer?.publication?.status||"").toUpperCase();return !["ENDED","ARCHIVED"].includes(status)&&allegroMapowania?.[id]?.blocked!==true;}
function allegroDuplikatWybierzPozostaw(form,offerId){
  form.querySelectorAll('input[name="withdrawOfferIds"]').forEach(input=>{input.disabled=String(input.value)===String(offerId);if(input.disabled)input.checked=false;});
}
async function allegroRozstrzygnijDuplikaty(event,productId){
  event.preventDefault();const form=event.currentTarget,fd=new FormData(form),keepOfferId=String(fd.get("keepOfferId")||""),withdrawOfferIds=fd.getAll("withdrawOfferIds").map(String).filter(id=>id&&id!==keepOfferId);
  if(!keepOfferId||!withdrawOfferIds.length){toast("Wskaż jedną ofertę pozostawianą i co najmniej jedną do wycofania");return;}
  const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{
    toast(`Wycofuję ${withdrawOfferIds.length} duplikat(y) i zachowuję ofertę ${keepOfferId}…`);
    const d=await chmura("allegro-resolve-duplicate",{method:"POST",body:{productId:String(productId),keepOfferId,withdrawOfferIds},timeout:120000});
    allegroOferty=Array.isArray(d.offers)?d.offers:allegroOferty;allegroMapowania=d.mappings||allegroMapowania;
    produktyEdytowane[productId]={...(produktyEdytowane[productId]||{}),allegroOfferId:keepOfferId,allegroDuplicateResolvedAt:d.updated_at||new Date().toISOString()};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();allegroZapiszCache();toast(`✅ Pozostawiono ${keepOfferId}; wycofano ${withdrawOfferIds.length} ofert bez usuwania ich historii`);renderuj();
  }catch(e){toast("⚠️ Rozstrzyganie duplikatów: "+(e.message||e));if(button)button.disabled=false;}
}
function allegroCentrumDuplikatowHTML(audyt=allegroAudytDuplikatow()){
  if(!audyt.grupy.length)return `<div class="duplicate-audit-ok"><b>✅ Centrum duplikatów:</b> nie ma grup wymagających decyzji administratora.</div>`;
  return `<section class="allegro-duplicate-center"><div class="order-section-head"><div><span class="order-pro-label">Kontrolowane rozstrzygnięcie</span><h3>🧭 Centrum duplikatów (${audyt.produkty})</h3><p class="order-detail-lead">Dla każdej grupy wskaż ofertę główną oraz oferty do wycofania. System zakończy tylko zaznaczone oferty w Allegro, wyłączy ich odnawianie, zachowa historię i przypnie produkt do pozostawionej pozycji.</p></div></div><div class="allegro-duplicate-groups">${audyt.grupy.map(({produkt,dopasowania})=>{const domyslna=String(dopasowania[0]?.offer?.id||"");return `<form class="allegro-duplicate-group" onsubmit="allegroRozstrzygnijDuplikaty(event,${jsArg(produkt.id)})"><header><div class="allegro-duplicate-product">${produkt.zdjecie?`<img src="${esc(produkt.zdjecie)}" alt="">`:`<span>🎲</span>`}<div><b>${esc(produkt.nazwa||"Produkt")}</b><small>ID ${esc(produkt.id)} • SKU ${esc(produkt.sku||"—")} • EAN ${esc(produkt.gtin||produkt.ean||"—")}</small></div></div><span class="lvl lvl-blad">${dopasowania.length} pasujących ofert</span></header><div class="allegro-duplicate-options">${dopasowania.map((d,index)=>{const o=d.offer,id=String(o.id);return `<article class="allegro-duplicate-option"><div class="allegro-duplicate-offer">${o.mainImage?`<img src="${esc(o.mainImage)}" alt="" loading="lazy">`:`<span>🏷️</span>`}<div><b>${esc(o.name||"Oferta Allegro")}</b><small>ID ${esc(id)} • ${esc(o.priceText||"cena —")} • stan ${esc(o.stockAvailable??"—")} • sprzedano ${esc(o.stockSold??"—")}</small><em>Dopasowanie: ${esc(d.reason)} • pewność ${esc(d.score)}%</em></div></div><div class="allegro-duplicate-choice"><label><input type="radio" name="keepOfferId" value="${esc(id)}" ${index===0?"checked":""} onchange="allegroDuplikatWybierzPozostaw(this.form,this.value)"> <b>Pozostaw tę ofertę</b></label><label><input type="checkbox" name="withdrawOfferIds" value="${esc(id)}" ${index===0?"disabled":"checked"}> Wycofaj jako duplikat</label><a href="https://allegro.pl/oferta/${encodeURIComponent(id)}" target="_blank" rel="noopener">Otwórz ofertę ↗</a></div></article>`;}).join("")}</div><footer><span>Operacja nie usuwa sprzedaży ani historii oferty.</span><button class="btn" type="submit">Zastosuj wybraną decyzję</button></footer></form>`;}).join("")}</div></section>`;
}
function allegroOfertaDlaProduktuSklepu(p={}){
  const matches=allegroOfertyPasujaceDoProduktu(p);return matches.find(allegroDopasowanieDuplikatuAktywne)?.offer||matches[0]?.offer||null;
}
function allegroStatusProduktuHTML(p={}){
  const wszystkie=allegroOfertyPasujaceDoProduktu(p),dopasowania=wszystkie.filter(allegroDopasowanieDuplikatuAktywne),o=dopasowania[0]?.offer||wszystkie[0]?.offer;
  if(!o)return `<span class="lvl lvl-ostrzezenie">brak na Allegro</span>`;
  const active=String(o.status||"").toUpperCase()==="ACTIVE";
  const duplikaty=dopasowania.slice(1);
  return `<span class="lvl ${active?"lvl-ok":"lvl-info"}">${active?"aktywna":"na Allegro: "+(o.status||"szkic")}</span>${duplikaty.length?` <span class="lvl lvl-blad" title="${esc(dopasowania.map(x=>`${x.offer.id}: ${x.reason}`).join(" • "))}">⚠️ ${dopasowania.length} ofert</span>`:""}<br><small>ID ${esc(o.id)}${duplikaty.length?` • sprawdź duplikaty`:""}</small>`;
}
function allegroDanePozycjiZamowienia(it={}){
  const oferta=allegroOfertaPoId(it.offerId);
  return {
    kod:String(it.externalId||oferta?.externalId||it.offerId||"").trim(),
    ean:String(oferta?.ean||oferta?.gtin||oferta?.manufacturerCode||oferta?.producerCode||"").trim(),
    nazwa:String(it.offerName||oferta?.name||"Produkt Allegro").trim(),
    ilosc:Math.max(1,Number(it.quantity)||1),
    zdjecie:String(oferta?.mainImage||(oferta?.images||[])[0]||it.image||"").trim()
  };
}
function allegroPodobienstwoNazwProduktow(a,b){
  const aa=new Set(allegroTokenyNazwy(a)),bb=new Set(allegroTokenyNazwy(b));if(!aa.size||!bb.size)return 0;
  let wspolne=0;aa.forEach(x=>{if(bb.has(x))wspolne++;});return wspolne/Math.max(aa.size,bb.size);
}
function allegroTokenyIstotneMapowania(v=""){
  const stop=new Set(["gra","gry","zabawka","zabawki","zestaw","alexander","multigra","godan","origami","konstruktor","junior","maly","mala","duzy","duza","dla","oraz","wersja","szt","elementow"]);
  return new Set(allegroNormalizujNazwe(v).split(/\s+/).filter(x=>x.length>2&&!stop.has(x)));
}
function allegroPodobienstwoIstotneMapowania(a="",b=""){
  const aa=allegroTokenyIstotneMapowania(a),bb=allegroTokenyIstotneMapowania(b);if(!aa.size||!bb.size)return 0;let common=0;aa.forEach(x=>{if(bb.has(x))common++;});return common/Math.max(aa.size,bb.size);
}
let allegroIndeksMapowanZrodlo=null,allegroIndeksMapowanProduktu=new Map();
function allegroIndeksOfertWedlugProduktu(){
  if(allegroIndeksMapowanZrodlo===allegroMapowania)return allegroIndeksMapowanProduktu;
  const index=new Map();
  Object.values(allegroMapowania||{}).forEach(m=>{const productId=String(m?.productId??m?.produktId??"");if(!productId||m?.blocked===true)return;const list=index.get(productId)||[];list.push(String(m?.offerId||""));index.set(productId,list.filter(Boolean));});
  allegroIndeksMapowanZrodlo=allegroMapowania;allegroIndeksMapowanProduktu=index;return index;
}
function allegroInneOfertyProduktu(productId,excludeOfferId=""){
  return (allegroIndeksOfertWedlugProduktu().get(String(productId))||[]).filter(id=>id!==String(excludeOfferId));
}
function allegroOcenaMapowaniaKandydata(oferta={},produkt={}){
  const norm=allegroKluczPorownania,p={ean:norm(produkt.gtin||produkt.ean),external:norm(produkt.externalId||produkt.sku),code:norm(produkt.kodProducenta||produkt.mpn),catalog:String(produkt.allegroProductId||""),offerId:String(produkt.allegroOfferId||""),name:String(produkt.nazwa||"")},o={ean:norm(oferta.ean||oferta.gtin),external:norm(oferta.externalId),code:norm(oferta.manufacturerCode||oferta.producerCode),catalog:String(oferta.productId||""),id:String(oferta.id||""),name:String(oferta.name||"")};
  const evidence=[],conflicts=[];let score=0,reason="";const hit=(value,label)=>{if(value>score){score=value;reason=label;}evidence.push(label);};
  if(p.ean&&o.ean)(p.ean===o.ean?hit(100,"identyczny EAN/GTIN"):conflicts.push("różny EAN/GTIN"));
  if(p.catalog&&o.catalog)(p.catalog===o.catalog?hit(99,"identyczny produkt katalogowy Allegro"):conflicts.push("różne ID produktu katalogowego"));
  if(p.external&&o.external)(p.external===o.external?hit(97,"identyczny EXTERNAL_ID/SKU"):conflicts.push("różny EXTERNAL_ID/SKU"));
  if(p.code&&o.code)(p.code===o.code?hit(95,"identyczny kod producenta"):conflicts.push("różny kod producenta"));
  const exact=p.name&&o.name&&allegroNormalizujNazwe(p.name)===allegroNormalizujNazwe(o.name),similarity=p.name&&o.name?allegroPodobienstwoIstotneMapowania(p.name,o.name):0;
  if(exact)hit(92,"identyczna nazwa");else if(similarity>=.72)hit(Math.round(72+similarity*18),"bardzo podobna nazwa");else if(similarity>=.45)hit(Math.round(52+similarity*20),"częściowo podobna nazwa");
  if(p.offerId&&o.id&&p.offerId===o.id&&!conflicts.includes("różny EAN/GTIN"))hit(Math.max(score,70),"zapisane ID oferty");
  const strongConflict=conflicts.includes("różny EAN/GTIN")||(conflicts.includes("różne ID produktu katalogowego")&&p.catalog&&o.catalog);
  if(strongConflict)score=Math.min(score,35);else if(conflicts.length&&score<95)score=Math.max(0,score-Math.min(25,conflicts.length*8));
  const occupied=allegroInneOfertyProduktu(produkt.id,oferta.id);
  return {produkt,score,reason:reason||"brak wspólnych identyfikatorów",evidence,conflicts,similarity:Math.round(similarity*100),strongConflict,occupied,valid:score>=65&&!strongConflict};
}
function allegroKandydaciMapowaniaOferty(oferta={}){
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>allegroOcenaMapowaniaKandydata(oferta,p)).filter(x=>x.score>0||String(x.produkt.id)===String(allegroProduktIdDlaOferty(oferta.id))).sort((a,b)=>b.score-a.score||Number(a.occupied.length)-Number(b.occupied.length)||String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl")).slice(0,30);
}
function allegroAnalizaMapowaniaOferty(oferta={}){
  const mappedId=String(allegroProduktIdDlaOferty(oferta.id)||""),mapped=mappedId?produktyDoAdministracji().find(p=>String(p.id)===mappedId)||null:null,candidates=allegroKandydaciMapowaniaOferty(oferta),current=mapped?candidates.find(x=>String(x.produkt.id)===mappedId)||allegroOcenaMapowaniaKandydata(oferta,mapped):null,available=candidates.filter(x=>!x.occupied.length||String(x.produkt.id)===mappedId),best=available[0]||null,second=available[1]||null;
  const suggestion=best&&best.valid&&best.score>=88&&(!second||best.score-second.score>=6)?best:null,different=suggestion&&mapped&&String(suggestion.produkt.id)!==mappedId,conflict=!!mapped&&(!!current?.strongConflict||Number(current?.score||0)<65||(different&&suggestion.score-Number(current?.score||0)>=12));
  const status=conflict?"konflikt":mapped?(Number(current?.score||0)>=85?"poprawne":"sprawdz"):suggestion?"sugestia":"niepodpiete";
  return {oferta,mapped,mappedId,current,candidates,best,suggestion,second,conflict,status,canAuto:!mapped&&!!suggestion&&!suggestion.occupied.length,correction:conflict&&different?suggestion:null};
}
function allegroDopasowaniePozycjiDoProduktu(it={}){
  const offerId=String(it.offerId||it.offer?.id||"").trim(),oferta=allegroOfertaPoId(offerId)||{},d=allegroDanePozycjiZamowienia({...it,offerId});
  const rec=(allegroMapowania||{})[offerId],blocked=rec?.blocked===true,mappedId=String(rec?.productId??rec?.produktId??rec?.id??rec??"").trim();
  const virtualOffer={...oferta,id:offerId,name:d.nazwa||oferta.name,externalId:it.externalId||oferta.externalId||d.kod,ean:oferta.ean||oferta.gtin||d.ean},candidates=allegroKandydaciMapowaniaOferty(virtualOffer).slice(0,8),current=mappedId?candidates.find(x=>String(x.produkt.id)===mappedId):null;
  if(mappedId&&current?.valid&&!current.strongConflict)return{produkt:current.produkt,match:String(rec?.operator||"").startsWith("auto-order:")?String(rec.operator).replace("auto-order:",""):current.reason||"zweryfikowane mapowanie",confidence:Number(current.score||rec?.confidence||0),candidates};
  const available=candidates.filter(x=>!x.occupied.length),best=available[0],second=available[1],pewne=!blocked&&best&&best.valid&&best.score>=88&&(!second||best.score-second.score>=6);
  return {produkt:pewne?best.produkt:null,match:blocked?"automatyczne dopasowanie wyłączone ręcznie":mappedId?"obecne mapowanie jest sprzeczne z identyfikatorami":pewne?best.reason:"brak pewnego dopasowania",confidence:pewne?best.score:0,candidates,mappingConflict:!!mappedId&&!current?.valid};
}
let allegroMapowaniePozycjiCel={offerId:"",offerName:"",error:null};
function allegroZamknijMapowaniePozycji(){document.getElementById("allegroMappingModal")?.remove();allegroMapowaniePozycjiCel={offerId:"",offerName:"",error:null};}
function allegroOtworzMapowaniePozycji(offerId,offerName=""){
  allegroMapowaniePozycjiCel={offerId:String(offerId||""),offerName:String(offerName||""),error:null};document.getElementById("allegroMappingModal")?.remove();
  const modal=document.createElement("div");modal.id="allegroMappingModal";modal.className="emoji-picker-overlay";modal.onclick=allegroZamknijMapowaniePozycji;
  modal.innerHTML=`<div class="emoji-picker-modal allegro-mapping-modal" onclick="event.stopPropagation()"><div class="emoji-picker-head"><div><span class="order-pro-label">Bezpieczne powiązanie 1:1</span><h2>🧩 Wybierz produkt sklepu</h2><p>Agent porówna identyfikatory i nie zapisze sprzecznego połączenia bez świadomego wyboru.</p></div><button class="btn ghost" type="button" onclick="allegroZamknijMapowaniePozycji()">✕ Zamknij</button></div><input class="emoji-picker-search" id="allegroMappingSearch" placeholder="Szukaj po nazwie, ID produktu, EAN, SKU, EXTERNAL_ID lub kodzie producenta…" oninput="allegroRenderujKandydatowMapowania(this.value)"><div id="allegroMappingCandidates"></div></div>`;
  document.body.appendChild(modal);allegroRenderujKandydatowMapowania("");modal.querySelector("#allegroMappingSearch")?.focus();
}
function allegroRenderujKandydatowMapowania(q=""){
  const box=document.getElementById("allegroMappingCandidates");if(!box)return;
  const offerId=allegroMapowaniePozycjiCel.offerId,oferta=allegroOfertaPoId(offerId)||{},query=String(q||"").trim().toLowerCase(),currentId=String(allegroProduktIdDlaOferty(offerId)||""),all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  let lista=query?all.filter(p=>`${p.id} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||p.ean||""} ${p.kodProducenta||p.mpn||""} ${p.producent||p.marka||""}`.toLowerCase().includes(query)).map(p=>allegroOcenaMapowaniaKandydata(oferta,p)):allegroKandydaciMapowaniaOferty(oferta).slice(0,12);
  lista.sort((a,b)=>b.score-a.score||Number(a.occupied.length)-Number(b.occupied.length)||String(a.produkt.nazwa||"").localeCompare(String(b.produkt.nazwa||""),"pl"));lista=lista.slice(0,50);
  const err=allegroMapowaniePozycjiCel.error,errValidation=err?.validation||{};
  box.innerHTML=`<div class="allegro-mapping-source-card">${oferta.mainImage?`<img src="${esc(oferta.mainImage)}" alt="">`:`<span>🏷️</span>`}<div><small>OFERTA ALLEGRO</small><b>${esc(oferta.name||allegroMapowaniePozycjiCel.offerName||"—")}</b><p>ID ${esc(offerId)} • EAN ${esc(oferta.ean||oferta.gtin||"—")} • EXTERNAL_ID ${esc(oferta.externalId||"—")} • kod ${esc(oferta.manufacturerCode||oferta.producerCode||"—")}</p></div></div>${err?`<div class="backend-note allegro-mapping-error"><b>Nie zapisano połączenia:</b> ${esc(err.message||err)}${errValidation.conflicts?.length?`<br><small>${esc(errValidation.conflicts.join(" • "))}</small>`:""}</div>`:""}<div class="allegro-mapping-results pro">${lista.map(x=>{const p=x.produkt,isCurrent=String(p.id)===currentId,cls=x.strongConflict?"conflict":x.score>=88?"strong":x.score>=65?"review":"weak",occupied=x.occupied.length>0&&!isCurrent;return `<article class="allegro-mapping-candidate ${cls} ${isCurrent?"is-current":""}"><div class="allegro-mapping-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>ID ${esc(p.id)} • EAN ${esc(p.gtin||p.ean||"—")} • SKU/EXTERNAL_ID ${esc(p.sku||p.externalId||"—")} • kod ${esc(p.kodProducenta||p.mpn||"—")}</small><div class="allegro-evidence-chips">${x.evidence.map(v=>`<span class="ok">✓ ${esc(v)}</span>`).join("")}${x.conflicts.map(v=>`<span class="bad">! ${esc(v)}</span>`).join("")||(!x.evidence.length?`<span>brak wspólnych kodów</span>`:"")}</div></div></div><div class="allegro-mapping-confidence"><b>${esc(x.score)}%</b><small>${esc(x.reason)}</small>${occupied?`<em>Połączony także z ofertą ${esc(x.occupied.join(", "))}</em>`:""}</div><div class="allegro-mapping-choice">${isCurrent?`<span class="lvl ${x.valid?"lvl-ok":"lvl-blad"}">${x.valid?"obecne, zweryfikowane":"obecne, błędne"}</span>`:x.strongConflict?`<button class="btn danger" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)},true,${occupied})">Połącz mimo konfliktu</button>`:occupied?`<button class="btn ghost" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)},false,true)">Przenieś powiązanie tutaj</button>`:`<button class="btn" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},${jsArg(p.id)})">Połącz ten produkt</button>`}<a href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Otwórz kartę produktu</a></div></article>`;}).join("")||`<div class="backend-note">Brak wyników. Wpisz nazwę, ID produktu, EAN, SKU, EXTERNAL_ID albo kod producenta.</div>`}</div>${currentId?`<button class="btn danger" type="button" onclick="allegroWybierzMapowaniePozycji(${jsArg(offerId)},'')">Usuń obecne powiązanie</button>`:""}`;
}
async function allegroWybierzMapowaniePozycji(offerId,productId,force=false,replaceExisting=false){const result=await allegroMapujOferte(offerId,productId,{force,replaceExisting});if(result?.ok)allegroZamknijMapowaniePozycji();else allegroRenderujKandydatowMapowania(document.getElementById("allegroMappingSearch")?.value||"");}
function allegroZamowieniePasujeDoFiltra(z){
  const s=allegroStatusKolejki(z);
  const terminal=["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(s);
  const lokalnieZrealizowane=!terminal&&allegroZamowienieZrealizowaneLokalnie(z);
  const statusOk=filtrAllegroZamowien==="wszystkie"||(filtrAllegroZamowien==="do_obslugi"?!terminal&&!lokalnieZrealizowane:filtrAllegroZamowien==="zrealizowane"?lokalnieZrealizowane:s===filtrAllegroZamowien);
  const etapOk=filtrEtapuAllegroZamowien==="wszystkie"||allegroEtapMagazynu(z)===filtrEtapuAllegroZamowien;
  return statusOk&&etapOk;
}
function allegroWierszeZamowien(){
  const rows=[];
  for(const z of Array.isArray(allegroZamowienia)?allegroZamowienia:[]){
    const items=Array.isArray(z.lineItems)&&z.lineItems.length?z.lineItems:[{offerId:"",offerName:"Brak pozycji",quantity:0}];
    for(const it of items){
      const dane=allegroDanePozycjiZamowienia(it);
      rows.push({z,it,dane,tekst:`${z.id||""} ${z.nr||""} ${z.email||""} ${z.buyerLogin||""} ${z.buyerName||""} ${z.phone||""} ${it.offerId||""} ${dane.kod} ${dane.ean} ${dane.nazwa} ${allegroStatusKolejki(z)}`.toLowerCase()});
    }
  }
  return rows;
}
function allegroPasujaceZamowienia(){
  const q=String(szukajAllegroZamowien||"").toLowerCase().trim();
  const wszystkie=Array.isArray(allegroZamowienia)?allegroZamowienia:[];
  const pasujaceIds=q?new Set(allegroWierszeZamowien().filter(r=>r.tekst.includes(q)).map(r=>String(r.z.id))):null;
  return wszystkie.filter(allegroZamowieniePasujeDoFiltra).filter(z=>!pasujaceIds||pasujaceIds.has(String(z.id)));
}
function allegroZaznaczWidoczneZamowienia(checked=true){
  allegroPasujaceZamowienia().slice(0,allegroLimitWidokuZamowien).forEach(z=>checked?zaznaczoneAllegroZamowienia.add(String(z.id)):zaznaczoneAllegroZamowienia.delete(String(z.id)));
  renderuj();
}
function allegroZaznaczWszystkiePasujaceZamowienia(){
  allegroPasujaceZamowienia().forEach(z=>zaznaczoneAllegroZamowienia.add(String(z.id)));
  renderuj();
}
function allegroZamowieniaTabelaHTML(){
  const wszystkie=Array.isArray(allegroZamowienia)?allegroZamowienia:[];
  const aktywne=wszystkie.filter(statusAllegroRezerwujeMagazyn);
  const analizy=aktywne.map(z=>allegroAnalizaMagazynowaZamowienia(z));
  const wszystkiePozycje=analizy.flatMap(a=>a.pozycje||[]);
  const agentStat={
    gotowe:analizy.filter(a=>a.gotowe).length,
    zBrakami:analizy.filter(a=>a.braki>0).length,
    doWyjasnienia:analizy.filter(a=>a.nierozpoznane>0||a.bezStanu>0||a.bezLokalizacji>0).length,
    brakiSzt:analizy.reduce((s,a)=>s+Number(a.braki||0),0),
    dokumenty:(agentAIZlecenia||[]).filter(z=>!["zrealizowane","anulowane"].includes(String(z.status||"").toLowerCase())).length,
    pozycje:wszystkiePozycje.length,
    rozpoznane:wszystkiePozycje.filter(p=>p.produkt).length,
    reczne:wszystkiePozycje.filter(p=>String(p.match||"").includes("ręczne")).length
  };
  const pasujaceZamowienia=allegroPasujaceZamowienia();
  const widoczneZamowienia=pasujaceZamowienia.slice(0,allegroLimitWidokuZamowien);
  const zaznaczone=[...zaznaczoneAllegroZamowienia].filter(id=>wszystkie.some(z=>String(z.id)===id));
  const wszystkieWidoczneZaznaczone=!!widoczneZamowienia.length&&widoczneZamowienia.every(z=>zaznaczoneAllegroZamowienia.has(String(z.id)));
  const counts={do_obslugi:0,zrealizowane:0,wszystkie:wszystkie.length};
  wszystkie.forEach(z=>{const s=allegroStatusKolejki(z),terminal=["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(s),done=!terminal&&allegroZamowienieZrealizowaneLokalnie(z);counts[s]=(counts[s]||0)+1;if(done)counts.zrealizowane++;if(!done&&!terminal)counts.do_obslugi++;});
  const filtry=[["do_obslugi","Do obsługi"],["NEW","Nowe"],["PROCESSING","W realizacji"],["READY_FOR_SHIPMENT","Do wysłania"],["zrealizowane","Zrealizowane lokalnie"],["SENT","Wysłane"],["CANCELLED","Anulowane"],["RETURNED","Zwrócone"],["wszystkie","Wszystkie"]];
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">📦 Zamówienia Allegro</h2><p class="order-detail-lead">Agent rozpoznaje pozycje po identyfikatorach, rezerwuje towar, pokazuje dokładną lokalizację albo dopisuje realny brak do właściwego szkicu zamówienia producenta. Oficjalny status zawsze pochodzi z Allegro.</p></div>
    </div>
    <div class="orders-status-strip">${filtry.map(([id,label])=>`<button class="${filtrAllegroZamowien===id?"active":""}" onclick="filtrAllegroZamowien=${jsArg(id)};renderuj()">${label} <b>${counts[id]||0}</b></button>`).join("")}</div>
    ${adminWyszukiwaniePanelHTML({id:"allegro-orders",description:"Zlecenie, klient, telefon, kod produktu, EAN, nazwa i etap magazynowy.",results:pasujaceZamowienia.length,active:!!(szukajAllegroZamowien||filtrAllegroZamowien!=="do_obslugi"||filtrEtapuAllegroZamowien!=="wszystkie"),open:true,fields:`<div class="orders-toolbar allegro-toolbar admin-search-full">
      <input placeholder="Szukaj: zamówienie, klient, telefon, kod, EAN, nazwa produktu…" value="${esc(szukajAllegroZamowien)}" oninput="szukajAllegroZamowien=this.value.toLowerCase();renderuj()">
      <label>Etap magazynu <select onchange="filtrEtapuAllegroZamowien=this.value;renderuj()">${[["wszystkie","Wszystkie etapy"],["do_sprawdzenia","Do sprawdzenia"],["braki","Braki"],["kompletacja","Kompletacja"],["spakowane","Spakowane"],["zrealizowane","Zrealizowane lokalnie"]].map(([v,l])=>`<option value="${v}" ${filtrEtapuAllegroZamowien===v?"selected":""}>${l}</option>`).join("")}</select></label>
      <label class="allegro-view-limit">Pokaż zleceń <select onchange="allegroLimitWidokuZamowien=Number(this.value)||100;renderuj()">${[25,50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWidokuZamowien===n?"selected":""}>${n}</option>`).join("")}</select></label>
      ${szukajAllegroZamowien?`<button class="btn ghost" onclick="szukajAllegroZamowien='';renderuj()">Wyczyść</button>`:""}
    </div>`})}
    <div class="allegro-bulk-toolbar">
      <div><b>Operacje na zleceniach</b><small>${zaznaczone.length} zaznaczonych • checkbox służy tylko do operacji grupowych</small></div>
      <label class="allegro-select-all"><input type="checkbox" ${wszystkieWidoczneZaznaczone?"checked":""} onchange="allegroZaznaczWidoczneZamowienia(this.checked)"> Zaznacz/odznacz widoczne (${widoczneZamowienia.length})</label>
      <button class="btn ghost" onclick="allegroZaznaczWszystkiePasujaceZamowienia()">Zaznacz cały filtr (${pasujaceZamowienia.length})</button>
      <button class="btn ghost" onclick="allegroWyczyscZaznaczenieZamowien()" ${zaznaczone.length?"":"disabled"}>☐ Odznacz wszystko (${zaznaczone.length})</button>
      <div class="allegro-bulk-stage"><label for="bulkAllegroWarehouseStage">Etap magazynu</label><select id="bulkAllegroWarehouseStage"><option value="">— wybierz etap —</option><option value="do_sprawdzenia">Do sprawdzenia</option><option value="braki">Braki — zamówić</option><option value="kompletacja">Kompletacja</option><option value="spakowane">Spakowane</option><option value="zrealizowane">✅ Zrealizowane lokalnie</option></select><button class="btn" onclick="allegroUstawEtapZaznaczonychZamowien()" ${zaznaczone.length?"":"disabled"}>Zastosuj do ${zaznaczone.length}</button></div>
    </div>
    <div class="allegro-order-list">${widoczneZamowienia.map(allegroZlecenieHTML).join("") || `<div class="backend-note">Brak zamówień w tym filtrze. Synchronizacja pobiera wyłącznie nowe i gotowe do wysłania.</div>`}</div>
    ${widoczneZamowienia.length>=allegroLimitWidokuZamowien?`<p class="order-detail-lead">Pokazano pierwsze ${allegroLimitWidokuZamowien} zleceń. Zwiększ limit widoku powyżej, aby zobaczyć więcej.</p>`:""}
    <section class="allegro-stock-agent allegro-info-bottom"><div class="allegro-stock-agent-head"><div><b>🤖 Agent magazynowy i mapowanie produktów</b><small>Nowe zlecenia są sprawdzane co 15 minut. Agent łączy pozycje kolejno po ręcznym powiązaniu, EAN, SKU, kodzie producenta i jednoznacznej nazwie. Niepewne dopasowania zostawia do decyzji administratora.</small></div><a class="btn ghost" href="#/admin/agent-ai/zlecenia">🧾 Zamówienia producentów</a></div><div class="allegro-stock-agent-stats allegro-mapping-stats"><span><b>${agentStat.rozpoznane}/${agentStat.pozycje}</b><small>pozycji połączonych</small></span><span><b>${agentStat.reczne}</b><small>powiązań ręcznych</small></span><span><b>${agentStat.gotowe}</b><small>zleceń gotowych</small></span><span class="${agentStat.zBrakami?"alert":""}"><b>${agentStat.zBrakami}</b><small>z brakami (${agentStat.brakiSzt} szt.)</small></span><span class="${agentStat.doWyjasnienia?"warn":""}"><b>${agentStat.doWyjasnienia}</b><small>do wyjaśnienia</small></span></div></section>
    <div class="backend-note allegro-info-bottom"><b>Status zamówienia jest wyłącznie z Allegro.</b> Lokalny etap możesz zmienić ręcznie, także na „Zrealizowane lokalnie”. Tak oznaczone zlecenie znika z kolejki „Do obsługi”, przestaje rezerwować stan i nie wraca do niej przy kolejnej synchronizacji.</div>
  </div>`;
}
function allegroStanPozycjiHTML(p={}){
  if(!p.produkt)return `<span class="lvl lvl-blad">nierozpoznany produkt</span><br><small>Wymagany EAN, SKU albo mapowanie oferty.</small>`;
  if(p.stan===null)return `<span class="lvl lvl-ostrzezenie">brak kontrolowanego stanu</span><br><small>Uzupełnij stan produktu ID ${esc(p.produkt.id)} w Magazynie.</small>`;
  return `stan: <b>${esc(p.stan)}</b> szt.<br><small>łączne rezerwacje: ${esc(p.laczneRezerwacje)} • po rezerwacji: ${esc(p.dostepne)}</small>${p.lokalizacja?`<br><span class="warehouse-location-chip">📍 ${esc(nazwaLokalizacjiMagazynu(p.lokalizacja))}</span>`:`<br><small class="warehouse-location-missing">⚠️ brak lokalizacji</small>`}`;
}
function allegroDecyzjaAgentaHTML(p={}){
  if(p.decyzja==="nierozpoznany")return `<span class="lvl lvl-blad">sprawdź EAN/SKU</span><br><small>Agent nie połączył pozycji z kartoteką.</small>`;
  if(p.decyzja==="sprawdz_stan")return `<span class="lvl lvl-ostrzezenie">ustal stan magazynowy</span><br><a href="#/admin/magazyn/stany">Otwórz stany produktów</a>`;
  if(p.decyzja==="uzupelnij_lokalizacje")return `<span class="lvl lvl-ostrzezenie">uzupełnij lokalizację</span><br><a href="#/admin/produkty/edytuj/${encodeURIComponent(p.produkt?.id||"")}">Edytuj kartotekę</a>`;
  if(p.decyzja==="zamow_u_producenta")return `<span class="lvl lvl-blad">zamówić ${esc(p.brak)} szt.</span><br><small>Dostawca: ${esc(p.dostawca||"nieprzypisany")}</small>${p.dokumentyProducenta?.length?`<br><a href="#/admin/agent-ai/zlecenia">🧾 ${esc(p.dokumentyProducenta.map(x=>x.numer).join(", "))}</a>`:`<br><small>Agent utworzy szkic producenta przy synchronizacji.</small>`}`;
  return `<span class="lvl lvl-ok">pobierz z magazynu</span><br><b>📍 ${esc(nazwaLokalizacjiMagazynu(p.lokalizacja))}</b>`;
}
function allegroMapowaniePozycjiHTML(p={}){
  const suggestion=(p.candidates||[])[0];
  return `<div class="allegro-line-mapping ${p.produkt?"is-linked":"needs-link"}">${p.produkt?`<span class="lvl lvl-ok">połączono • ${esc(p.confidence||100)}%</span><b>${esc(p.produkt.nazwa||`Produkt ${p.produkt.id}`)}</b><small>ID ${esc(p.produkt.id)} • ${esc(p.match||"mapowanie")}</small>`:`<span class="lvl lvl-blad">brak powiązania</span>${suggestion?`<small>Najlepsza sugestia: <b>${esc(suggestion.produkt.nazwa)}</b> (${esc(suggestion.score)}%)</small>`:`<small>Brak jednoznacznej sugestii po identyfikatorach.</small>`}`}<button class="btn ${p.produkt?"ghost":""}" type="button" onclick="allegroOtworzMapowaniePozycji(${jsArg(p.offerId)},${jsArg(p.nazwa)})">${p.produkt?"Zmień powiązanie":"🧩 Połącz produkt"}</button></div>`;
}
function allegroZlecenieHTML(z){
  const meta=allegroStatusKolejkiMeta(z), s=allegroStatusKolejki(z);
  const etap=allegroEtapMagazynuMeta(z), analiza=allegroAnalizaMagazynowaZamowienia(z);
  const items=Array.isArray(z.lineItems)&&z.lineItems.length?z.lineItems:[];
  const sztuk=items.reduce((sum,it)=>sum+Math.max(1,Number(it.quantity)||1),0);
  const idEtap=`allegro-etap-${z.id}`;
  const zaznaczone=zaznaczoneAllegroZamowienia.has(String(z.id));
  const lokalnieDone=allegroZamowienieZrealizowaneLokalnie(z);
  return `<article class="allegro-order-card ${zaznaczone?"is-selected ":""}${["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(s)||lokalnieDone?"is-closed":"is-active"}">
    <header class="allegro-order-head">
      <div class="allegro-order-title"><label class="allegro-order-select" title="Zaznaczenie tylko do operacji grupowych"><input type="checkbox" ${zaznaczone?"checked":""} onchange="allegroPrzelaczZaznaczenieZamowienia(${jsArg(z.id)},this.checked)"></label><span class="allegro-order-ico">📦</span><div><b>Zlecenie ${esc(z.id||z.nr||"—")}</b><small>${esc(allegroDataTxt(z.createdAt||z.firstFetchedAt))} • ${items.length} pozycji / ${sztuk} szt. • ${esc(z.total||"—")}</small></div></div>
      <div class="allegro-order-state"><span class="lvl ${meta.klasa}">Allegro: ${esc(meta.label)}</span><span class="lvl ${etap.klasa}">Magazyn: ${esc(etap.label)}</span><small>Ostatnia synchronizacja: ${esc(allegroDataTxt(z.rawUpdatedAt||z.lastSeenAt))}</small></div>
    </header>
    <div class="allegro-order-info">
      <div><b>👤 ${esc(z.buyerName||z.buyerLogin||z.email||"Klient Allegro")}</b><small>${esc(z.email||"—")} ${z.phone?`• ${esc(z.phone)}`:""}</small></div>
      <div><b>🚚 ${esc(z.deliveryMethod||"Dostawa")}</b><small>${esc(z.deliveryPoint||z.deliveryAddress||"—")}</small></div>
      <div><b>💳 ${esc(z.paymentStatus||"Płatność")}</b><small>${esc(z.total||"—")}</small></div>
    </div>
    <details class="allegro-order-products" open>
      <summary>Produkty w zleceniu (${items.length})</summary>
      <div class="warehouse-worktable-wrap"><table class="log-table allegro-order-products-table"><tr><th>Zdjęcie</th><th>Pozycja z Allegro</th><th>Produkt sklepu i dopasowanie</th><th>Ilość</th><th>Stan i rezerwacje</th><th>Decyzja agenta</th></tr>
        ${analiza.pozycje.map(p=>{const d=allegroDanePozycjiZamowienia({offerId:p.offerId,offerName:p.nazwa,quantity:p.ilosc});return `<tr class="${p.decyzja!=="kompletuj"?"row-alert":""}"><td>${d.zdjecie?`<img class="allegro-order-thumb" src="${esc(d.zdjecie)}" alt="" loading="lazy">`:`<span class="allegro-order-thumb fallback">🎲</span>`}</td><td><b>${esc(p.nazwa||"—")}</b><small>Oferta: ${esc(p.offerId||"—")} • kod: ${esc(p.externalId||"—")} • EAN: ${esc(p.ean||"—")}</small></td><td>${allegroMapowaniePozycjiHTML(p)}</td><td><b>${esc(p.ilosc)}</b> szt.</td><td>${allegroStanPozycjiHTML(p)}</td><td>${allegroDecyzjaAgentaHTML(p)}</td></tr>`;}).join("")||`<tr><td colspan="6">Brak pozycji w zleceniu.</td></tr>`}
      </table></div>
    </details>
    <footer class="allegro-order-actions">
      ${!["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(s)?`<span class="${analiza.gotowe?"lvl lvl-ok":"lvl lvl-blad"}">${analiza.gotowe?"✅ Wszystkie pozycje mają stan i lokalizację":`⚠️ Braki ${analiza.braki} szt. • nierozpoznane ${analiza.nierozpoznane} • bez stanu ${analiza.bezStanu} • bez lokalizacji ${analiza.bezLokalizacji}`}</span><select id="${esc(idEtap)}" aria-label="Etap magazynu">${[["do_sprawdzenia","Do sprawdzenia"],["braki","Braki — zamówić"],["kompletacja","Kompletacja"],["spakowane","Spakowane"],["zrealizowane","✅ Zrealizowane lokalnie"]].map(([id,label])=>`<option value="${id}" ${allegroEtapMagazynu(z)===id?"selected":""}>${label}</option>`).join("")}</select><button class="btn ghost" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},document.getElementById(${jsArg(idEtap)}).value)">Zapisz etap</button>${!lokalnieDone?`<button class="btn" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},'zrealizowane')">✅ Oznacz jako zrealizowane</button>`:`<button class="btn ghost" onclick="allegroUstawEtapMagazynu(${jsArg(z.id)},'do_sprawdzenia')">↩️ Przywróć do obsługi</button>`}`:""}
    </footer>
  </article>`;
}
function allegroZaznaczOfertyMapowania(ids=[],checked=true){ids.forEach(id=>checked?zaznaczoneMapowaniaAllegro.add(String(id)):zaznaczoneMapowaniaAllegro.delete(String(id)));renderuj();}
async function allegroZastosujPewneSugestieMapowania(ids=null){
  if(allegroMapowanieMasowe.busy)return;const set=ids?new Set(ids.map(String)):null,analizy=(allegroOferty||[]).filter(o=>!set||set.has(String(o.id))).map(allegroAnalizaMapowaniaOferty),items=analizy.map(a=>({a,target:a.correction||(!a.mapped?a.suggestion:null)})).filter(x=>x.target?.valid&&!x.target.occupied.length).map(x=>({offerId:String(x.a.oferta.id),productId:String(x.target.produkt.id)}));
  if(!items.length){toast("Brak jednoznacznych, bezkolizyjnych sugestii do zapisania");return;}
  allegroMapowanieMasowe={busy:true,total:items.length,mapped:0,skipped:0,error:""};renderuj();
  try{const d=await chmura("allegro-map-offers-batch",{method:"POST",body:{items},timeout:120000});allegroMapowania=d.mappings||allegroMapowania;allegroZamowienia=Array.isArray(d.orders)?d.orders:allegroZamowienia;allegroMapowanieMasowe={busy:false,total:items.length,mapped:d.mapped||0,skipped:d.skipped||0,error:""};zaznaczoneMapowaniaAllegro.clear();await chmuraWczytajStan().catch(()=>{});allegroZapiszCache();toast(`✅ Bezpieczne mapowanie: połączono ${d.mapped||0}${d.skipped?` • pominięto ${d.skipped}`:""}`);renderuj();}catch(e){allegroMapowanieMasowe={...allegroMapowanieMasowe,busy:false,error:e.message||String(e)};toast("⚠️ Mapowanie grupowe: "+(e.message||e));renderuj();}
}
async function allegroAutomapujOferty(){return allegroZastosujPewneSugestieMapowania();}
function allegroStatusMapowaniaMeta(status){return ({konflikt:{label:"Błędne połączenie",cls:"bad",icon:"⚠️"},sugestia:{label:"Pewna sugestia",cls:"suggest",icon:"✨"},niepodpiete:{label:"Niepodpięta",cls:"empty",icon:"○"},sprawdz:{label:"Do sprawdzenia",cls:"review",icon:"?"},poprawne:{label:"Połączenie poprawne",cls:"ok",icon:"✓"}})[status]||{label:status,cls:"review",icon:"?"};}
function allegroDaneKodyHTML(label,obj={},type="offer"){
  const ean=type==="offer"?(obj.ean||obj.gtin):(obj.gtin||obj.ean),external=type==="offer"?obj.externalId:(obj.externalId||obj.sku),code=type==="offer"?(obj.manufacturerCode||obj.producerCode):(obj.kodProducenta||obj.mpn);
  return `<div class="allegro-map-identifiers"><small>${esc(label)}</small><span><em>EAN</em><b>${esc(ean||"—")}</b></span><span><em>EXTERNAL_ID / SKU</em><b>${esc(external||"—")}</b></span><span><em>Kod producenta</em><b>${esc(code||"—")}</b></span></div>`;
}
function allegroProduktMapowanieMiniHTML(p={},evaluation=null,title="Produkt sklepu"){
  return `<div class="allegro-map-product-mini">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><small>${esc(title)}</small><b>${esc(p.nazwa||"Produkt")}</b><p>ID ${esc(p.id)} • ${esc(p.kategoria||"bez kategorii")}</p>${evaluation?`<div class="allegro-evidence-chips">${evaluation.evidence.map(x=>`<span class="ok">✓ ${esc(x)}</span>`).join("")}${evaluation.conflicts.map(x=>`<span class="bad">! ${esc(x)}</span>`).join("")}</div>`:""}</div></div>`;
}
function allegroOfertaMapowanieCardHTML(a){
  const o=a.oferta,m=a.mapped,e=a.current,s=a.correction||(!m?a.suggestion:null),meta=allegroStatusMapowaniaMeta(a.status),checked=zaznaczoneMapowaniaAllegro.has(String(o.id));
  return `<article class="allegro-offer-map-card ${meta.cls}"><header><label class="allegro-map-checkbox"><input type="checkbox" ${checked?"checked":""} onchange="allegroPrzelaczOferteDoCeny(${jsArg(o.id)},this.checked)"><span></span></label><div class="allegro-offer-title-cell">${o.mainImage?`<img src="${esc(o.mainImage)}" alt="" loading="lazy">`:`<span>🏷️</span>`}<div><small>OFERTA ALLEGRO • ID ${esc(o.id)}</small><b>${esc(o.name||"—")}</b><p>${esc(o.priceText||"cena —")} • stan ${esc(o.stockAvailable??"—")} • ${esc(o.status||"—")} • kategoria ${esc(o.categoryId||"—")}</p></div></div><span class="allegro-map-status ${meta.cls}">${meta.icon} ${meta.label}</span></header><div class="allegro-map-compare"><section>${allegroDaneKodyHTML("Dane Allegro",o,"offer")}</section><div class="allegro-map-link-state"><b>${e?`${esc(e.score)}%`:"—"}</b><small>${esc(e?.reason||"brak połączenia")}</small><span>Allegro ↔ sklep</span></div><section>${m?`${allegroProduktMapowanieMiniHTML(m,e,"Aktualnie podpięty produkt")}${allegroDaneKodyHTML("Dane sklepu",m,"product")}`:`<div class="allegro-map-empty-product"><span>○</span><b>Brak produktu sklepu</b><small>Wybierz pewną sugestię albo wyszukaj ręcznie.</small></div>`}</section></div>${a.conflict?`<div class="allegro-map-conflict-note"><b>Agent wykrył sprzeczne połączenie.</b><span>${esc(e?.conflicts?.join(" • ")||"Aktualny produkt nie zgadza się z ofertą")}</span></div>`:""}${s&&String(s.produkt.id)!==String(m?.id)?`<div class="allegro-map-suggestion">${allegroProduktMapowanieMiniHTML(s.produkt,s,"Najlepsza sugestia Agenta")}<div><b>${esc(s.score)}% zgodności</b><small>${esc(s.reason)}${s.occupied.length?` • używany przez ofertę ${esc(s.occupied.join(", "))}`:""}</small>${!s.occupied.length&&s.valid?`<button class="btn" onclick="allegroMapujOferte(${jsArg(o.id)},${jsArg(s.produkt.id)})">${a.conflict?"Napraw połączenie":"Połącz sugestię"}</button>`:`<button class="btn ghost" onclick="allegroOtworzMapowaniePozycji(${jsArg(o.id)},${jsArg(o.name)})">Rozstrzygnij ręcznie</button>`}</div></div>`:""}<footer><button class="btn ${a.conflict||!m?"":"ghost"}" onclick="allegroOtworzMapowaniePozycji(${jsArg(o.id)},${jsArg(o.name)})">${m?"Zmień produkt sklepu":"🧩 Wybierz produkt sklepu"}</button>${m?`<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(m.id)}">Otwórz produkt</a><button class="btn ghost" onclick="allegroMapujOferte(${jsArg(o.id)},'')">Odłącz</button>`:!s?`<button class="btn ghost" onclick="allegroDodajProduktZOferty(${jsArg(o.id)})">➕ Utwórz nowy produkt</button>`:""}<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(o.id)}" target="_blank" rel="noopener">Otwórz Allegro ↗</a></footer></article>`;
}
function allegroOfertyTabelaHTML(){
  const q=String(szukajAllegroOfert||"").toLowerCase().trim(),audyt=allegroAudytDuplikatow(),all=(Array.isArray(allegroOferty)?allegroOferty:[]).map(allegroAnalizaMapowaniaOferty),counts={wszystkie:all.length,poprawne:0,konflikt:0,sugestia:0,niepodpiete:0,sprawdz:0,problemy:0,duplikaty:audyt.oferty};all.forEach(a=>{counts[a.status]=(counts[a.status]||0)+1;if(a.status!=="poprawne")counts.problemy++;});
  let rows=all.filter(a=>{if(filtrAllegroOfert==="problemy"&&a.status==="poprawne")return false;if(filtrAllegroOfert==="duplikaty"&&!audyt.offerIds.has(String(a.oferta.id)))return false;if(!["wszystkie","problemy","duplikaty"].includes(filtrAllegroOfert)&&a.status!==filtrAllegroOfert)return false;const o=a.oferta,p=a.mapped,s=a.suggestion?.produkt,txt=`${o.id} ${o.name||""} ${o.externalId||""} ${o.ean||o.gtin||""} ${o.manufacturerCode||o.producerCode||""} ${p?.id||""} ${p?.nazwa||""} ${p?.sku||p?.externalId||""} ${s?.nazwa||""}`.toLowerCase();return !q||txt.includes(q);});
  const priority={konflikt:0,sugestia:1,niepodpiete:2,sprawdz:3,poprawne:4};rows.sort((a,b)=>sortAllegroOfert==="nazwa"?String(a.oferta.name||"").localeCompare(String(b.oferta.name||""),"pl"):sortAllegroOfert==="status"?String(a.oferta.status||"").localeCompare(String(b.oferta.status||"")):priority[a.status]-priority[b.status]||Number(b.suggestion?.score||b.current?.score||0)-Number(a.suggestion?.score||a.current?.score||0));const visible=rows.slice(0,allegroLimitWidokuOfert),selected=[...zaznaczoneMapowaniaAllegro],safeVisible=visible.filter(a=>(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length),safeSelected=all.filter(a=>zaznaczoneMapowaniaAllegro.has(String(a.oferta.id))&&(a.correction||(!a.mapped?a.suggestion:null))?.valid&&!(a.correction||a.suggestion)?.occupied?.length);
  return `<div class="panel allegro-section-panel allegro-mapping-workspace"><div class="order-section-head"><div><span class="order-pro-label">Powiązanie 1:1 z kartoteką sklepu</span><h2 style="margin-top:.15rem">🏷️ Oferty Allegro i produkty sklepu</h2><p class="order-detail-lead">Najpierw popraw konflikty, potem zatwierdź pewne sugestie. System porównuje EAN, produkt katalogowy, EXTERNAL_ID/SKU, kod producenta i istotne słowa nazwy. Sprzeczne połączenie jest blokowane również przez serwer.</p></div><a class="btn ghost" href="#/admin/allegro/ustawienia">⚙️ Ustawienia synchronizacji</a></div><div class="allegro-map-stats">${[["⚠️","Konflikty",counts.konflikt,"konflikt"],["✨","Pewne sugestie",counts.sugestia,"sugestia"],["○","Niepodpięte",counts.niepodpiete,"niepodpiete"],["?","Do sprawdzenia",counts.sprawdz,"sprawdz"],["✓","Poprawne",counts.poprawne,"poprawne"]].map(([ico,label,count,id])=>`<button class="${filtrAllegroOfert===id?"active":""}" onclick="filtrAllegroOfert=${jsArg(id)};renderuj()"><span>${ico}</span><b>${count}</b><small>${label}</small></button>`).join("")}</div><div class="orders-toolbar allegro-toolbar"><input placeholder="Szukaj: oferta, produkt, ID, EAN, SKU, EXTERNAL_ID, kod producenta…" value="${esc(szukajAllegroOfert)}" oninput="szukajAllegroOfert=this.value.toLowerCase();renderuj()"><select onchange="filtrAllegroOfert=this.value;renderuj()">${[["problemy",`Wymagające pracy (${counts.problemy})`],["wszystkie",`Wszystkie (${counts.wszystkie})`],["konflikt",`Konflikty (${counts.konflikt})`],["sugestia",`Pewne sugestie (${counts.sugestia})`],["niepodpiete",`Niepodpięte (${counts.niepodpiete})`],["sprawdz",`Do sprawdzenia (${counts.sprawdz})`],["poprawne",`Poprawne (${counts.poprawne})`],["duplikaty",`Duplikaty (${counts.duplikaty})`]].map(([id,label])=>`<option value="${id}" ${filtrAllegroOfert===id?"selected":""}>${label}</option>`).join("")}</select><select onchange="sortAllegroOfert=this.value;renderuj()"><option value="priorytet" ${sortAllegroOfert==="priorytet"?"selected":""}>Najpierw problemy</option><option value="nazwa" ${sortAllegroOfert==="nazwa"?"selected":""}>Nazwa A–Z</option><option value="status" ${sortAllegroOfert==="status"?"selected":""}>Status Allegro</option></select><label class="allegro-view-limit">Pokaż <select onchange="allegroLimitWidokuOfert=Number(this.value)||100;renderuj()">${[50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWidokuOfert===n?"selected":""}>${n}</option>`).join("")}</select></label></div><div class="allegro-map-bulk"><div><b>Operacje na widoku</b><small>${selected.length} zaznaczonych • ${safeVisible.length} bezpiecznych sugestii w bieżącym widoku</small></div><button class="btn ghost" onclick='allegroZaznaczOfertyMapowania(${JSON.stringify(visible.map(a=>String(a.oferta.id)))},true)'>☑️ Zaznacz widoczne</button>${selected.length?`<button class="btn ghost" onclick="zaznaczoneMapowaniaAllegro.clear();renderuj()">Odznacz</button>`:""}<button class="btn" ${allegroMapowanieMasowe.busy||!(selected.length?safeSelected.length:safeVisible.length)?"disabled":""} onclick='allegroZastosujPewneSugestieMapowania(${selected.length?JSON.stringify(selected):JSON.stringify(safeVisible.map(a=>String(a.oferta.id)))})'>${allegroMapowanieMasowe.busy?"⏳ Zapisuję…":`🤖 Zastosuj pewne sugestie${selected.length?" dla zaznaczonych":" w widoku"}`}</button></div>${allegroMapowanieMasowe.error?`<div class="backend-note allegro-mapping-error"><b>Błąd operacji:</b> ${esc(allegroMapowanieMasowe.error)}</div>`:""}${audyt.produkty&&filtrAllegroOfert==="duplikaty"?allegroCentrumDuplikatowHTML(audyt):""}<div class="allegro-offer-map-list">${visible.map(allegroOfertaMapowanieCardHTML).join("")||`<div class="backend-note">Brak ofert pasujących do filtrów.</div>`}</div>${rows.length>visible.length?`<div class="backend-note">Pokazano ${visible.length} z ${rows.length}. Zwiększ limit albo zawęź wyszukiwanie.</div>`:""}</div>`;
}
function allegroBrakiProduktuDoWystawienia(p){
  const braki=[];
  if(!p.nazwa) braki.push("nazwa");
  if(!Number(p.cena)) braki.push("cena");
  if(!(p.gtin||p.ean)) braki.push("EAN");
  if(!(p.kodProducenta||p.mpn||p.externalId||p.sku)) braki.push("kod producenta/SKU");
  if(!(p.producent||p.marka)) braki.push("producent");
  if(!(p.zdjecie||(p.zdjecia||[]).length)) braki.push("zdjęcie");
  if(!p.allegroCategoryId) braki.push("ID kategorii Allegro");
  return braki;
}
function allegroStanOfertyProduktu(){
  const n=Number(allegroStan.offerSettings?.defaultStock??5);
  return Number.isInteger(n)&&n>0?Math.min(99999,n):5;
}
function allegroRozniceOfertyProduktu(p={},o=null){
  if(!o)return ["brak oferty"];
  const roznice=[];
  if(allegroKluczPorownania(p.nazwa)!==allegroKluczPorownania(o.name))roznice.push("nazwa");
  if(Math.abs(kwotaNum(p.cenaAllegro||p.cena)-kwotaNum(o.price))>.009)roznice.push("cena Allegro");
  const stan=allegroStanOfertyProduktu(p);if(Number(o.stockAvailable)!==Number(stan))roznice.push("stan Allegro");
  if((p.zdjecie||(p.zdjecia||[]).length)&&!(o.mainImage||(o.images||[]).length))roznice.push("zdjęcia");
  if((p.opis||p.opisKrotki)&&!o.descriptionText)roznice.push("opis");
  if((p.producent||p.marka)&&allegroKluczPorownania(p.producent||p.marka)!==allegroKluczPorownania(o.brand||""))roznice.push("producent");
  if(p.allegroProductId&&String(o.productId||"")!==String(p.allegroProductId))roznice.push("produkt katalogowy");
  return [...new Set(roznice)];
}
function allegroAktywneZadaniaAgentaOfert(){return (agentAIAllegroZadania||[]).filter(x=>!["wykonane","anulowane"].includes(String(x.status||"").toLowerCase()));}
const ALLEGRO_PROCEDURA_AGENTA_OFERT=[
  "Sprawdź ID oferty i zapisane mapowanie, następnie UUID katalogu, external.id/SKU, EAN, kod producenta i identyczną nazwę.",
  "Jeżeli oferta istnieje — połącz ją z produktem i aktualizuj; nigdy nie twórz duplikatu.",
  "Dobierz produkt katalogowy najpierw po EAN, potem po MPN; nazwę wykorzystuj tylko przy wysokiej zgodności.",
  "Uzupełnij producenta, markę, EAN, MPN, kategorię, UUID, parametry oraz zdjęcia z Katalogu Allegro, jeśli źródło sklepu nie działa.",
  "Nową ofertę zapisuj jako nieaktywną ze stanem magazynowym produktu; brak stanu oznacza 0.",
  "Po sukcesie zapisz potrójne powiązanie produkt sklepu ↔ produkt katalogowy ↔ oferta, odśwież dane i zamknij zadanie Agenta.",
  "Gdy nadal brakuje danych, nie zgaduj — zapisz konkretne braki i błąd API jako jedno zadanie do ponowienia."
];
function allegroProceduraAgentaOfertHTML(){
  return `<details class="backend-note allegro-info-bottom"><summary><b>🤖 Stała procedura Agenta przy dodawaniu oferty</b></summary><ol>${ALLEGRO_PROCEDURA_AGENTA_OFERT.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></details>`;
}
async function allegroAgentUzupelnijZadanieOferty(taskId){
  const task=(agentAIAllegroZadania||[]).find(x=>String(x.id)===String(taskId));if(!task){toast("Nie znaleziono zadania Agenta AI");return;}
  const p=pobierzProduktAdmin(Number(task.productId));if(!p){toast("Produkt z zadania nie istnieje");return;}
  const s=task.suggestions||{},next={...(produktyEdytowane[p.id]||{})};
  for(const key of ["producent","marka","gtin","ean","kodProducenta","mpn","zdjecie","allegroCategoryId","allegroProductId"]){
    if(s[key]&&!p[key])next[key]=String(s[key]);
  }
  if(Array.isArray(s.zdjecia)&&s.zdjecia.length&&!(p.zdjecia||[]).length)next.zdjecia=s.zdjecia.slice(0,15);
  if(Array.isArray(s.allegroParameters)&&s.allegroParameters.length&&!Array.isArray(p.allegroParameters))next.allegroParameters=s.allegroParameters;
  produktyEdytowane[p.id]=next;zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();
  toast("Agent uzupełnił dostępne dane i ponownie sprawdza szkic…");
  await allegroPrzygotujSzkicProduktZListy(p.id);
}
function allegroZadaniaAgentaOfertHTML(){
  const tasks=allegroAktywneZadaniaAgentaOfert();if(!tasks.length)return `<div class="duplicate-audit-ok"><b>✅ Agent AI:</b> brak otwartych zadań dotyczących ofert Allegro.</div>`;
  return `<section class="allegro-agent-tasks"><div class="order-section-head"><div><b>🤖 Zadania przekazane Agentowi AI</b><small>Agent najpierw szuka istniejącej oferty, blokuje duplikat, uzupełnia dane katalogowe i ponawia operację. Zgadywanie brakujących danych jest zabronione.</small></div><a class="btn ghost" href="#/admin/agent-ai">Otwórz Agenta AI</a></div><div class="allegro-agent-task-list">${tasks.slice(0,30).map(t=>`<article><div><b>${esc(t.productName||"Produkt")}</b><small>ID ${esc(t.productId)} • ${esc(t.status||"oczekuje")} • próby: ${esc(t.attempts||1)}</small><p>${[...(t.missing||[]),...(t.errors||[]).map(e=>e.message||e.code)].map(esc).join(" • ")||"Weryfikacja danych"}</p></div><div class="warehouse-worktable-actions"><button class="btn" onclick="allegroAgentUzupelnijZadanieOferty(${jsArg(t.id)})">🤖 Uzupełnij i sprawdź</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(t.productId)}">✏️ Edytuj produkt</a></div></article>`).join("")}</div></section>`;
}
async function allegroPrzygotujSzkicProduktZListy(id){
  const p=pobierzProduktAdmin(Number(id));
  if(!p){ toast("Nie znaleziono produktu"); return; }
  try{
    const d=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:60000});
    allegroZapiszAutoUzupelnienia(p,d);
    const cat=d.categorySuggestion?.selected;
    const saved=cat?.id?allegroZapiszKategorieProduktu(p.id,cat.id):false;
    toast(d.ready?`🟠 Szkic Allegro gotowy technicznie${cat?` — kategoria: ${cat.name}`:""}`:`🟠 Braki: ${((d.missing||[]).join(", ")||"brak")}${cat?` • dobrano kategorię: ${cat.name}`:""}`);
    if(saved) renderuj();
  }catch(e){ allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Szkic Allegro: "+(e.message||e)); }
}
async function allegroWystawProduktZListy(id){
  const p=pobierzProduktAdmin(Number(id));
  if(!p){ toast("Nie znaleziono produktu"); return; }
  try{
    const publicationAction=allegroTrybPublikacji();
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publishNow:publicationAction==="activate",publicationAction}},timeout:120000});
    allegroOstatniBladWystawienia=null;
    allegroZapiszWynikOperacji(p,d);
    allegroZapiszAutoUzupelnienia(p,d);
    toast(d.operation?.completed===false?`🟠 Oferta ${d.offer?.id||""} jest jeszcze przetwarzana przez Allegro`:d.mode==="updated"?`🟠 Zaktualizowano ofertę ${d.offer?.id||""} bez tworzenia duplikatu`:`🟠 Utworzono nową ofertę ${d.offer?.id||""}`);
    if(d.offer?.id){
      const selectedCat=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||d.categorySuggestion?.selected?.id||p.allegroCategoryId||"";
      produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroOfferId:String(d.offer.id),...(selectedCat?{allegroCategoryId:String(selectedCat)}:{}),...(d.catalogMatch?.selected?.id?{allegroProductId:String(d.catalogMatch.selected.id)}:{})};
      zapiszLS("artway_produkty_edytowane",produktyEdytowane);
      allegroZastosujWynikWystawienia(p,d);
      await chmuraWczytajStan().catch(()=>{});
      await allegroWczytajDane(true).catch(()=>{});
      zbudujProdukty();
      renderuj();
    }
  }catch(e){ allegroOstatniBladWystawienia=e;allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Wystawianie Allegro: "+(e.message||e)+" • zadanie przekazano Agentowi AI");renderuj(); }
}
async function allegroAktywujProduktZListy(id){
  const p=pobierzProduktAdmin(Number(id));if(!p){toast("Nie znaleziono produktu");return;}
  const qty=allegroStanOfertyProduktu(p);
  try{
    toast(`Aktywuję ofertę ${p.nazwa} ze stanem Allegro ${qty} szt.…`);
    const product={...p,allegroStock:qty};
    const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product,options:{stock:qty,publicationAction:"activate",publishNow:true}},timeout:120000});
    allegroOstatniBladWystawienia=null;allegroZapiszWynikOperacji(product,d);allegroZapiszAutoUzupelnienia(product,d);allegroZastosujWynikWystawienia(product,d);
    const categoryId=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||p.allegroCategoryId||"";
    const productId=d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"";
    produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroStock:qty,allegroOfferId:String(d.offer?.id||p.allegroOfferId||""),...(categoryId?{allegroCategoryId:String(categoryId)}:{}),...(productId?{allegroProductId:String(productId)}:{})};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
    await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});zbudujProdukty();
    toast(`✅ Oferta ${d.offer?.id||""} aktywna • stan Allegro ${qty} szt. • magazyn bez zmian`);renderuj();
  }catch(e){allegroOstatniBladWystawienia=e;allegroZapiszAutoUzupelnienia(p,e);if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Aktywacja Allegro: "+(e.message||e));renderuj();}
}
async function allegroAktualizujZaznaczoneOfertyDanymiSklepu(){
  const ids=[...zaznaczoneAllegroOferty].slice(0,100),produkty=[...new Map(ids.map(id=>allegroProduktDlaOferty(id)).filter(Boolean).map(p=>[String(p.id),p])).values()];
  if(!produkty.length){toast("Zaznacz powiązane oferty, które mają zostać zaktualizowane danymi sklepu");return;}
  let ok=0,bledy=0;toast(`Aktualizuję ${produkty.length} ofert nowszymi danymi sklepu…`);
  for(const p of produkty){try{const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p),publicationAction:"keep"}},timeout:120000});allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);ok++;}catch(e){bledy++;allegroOstatniBladWystawienia=e;}}
  zaznaczoneAllegroOferty.clear();await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});
  toast(`Synchronizacja ofert: zaktualizowano ${ok}${bledy?` • do Agenta AI / błędy: ${bledy}`:""}`);renderuj();
}
function allegroPrzelaczOferteDoCeny(id,checked){const set=location.hash.startsWith("#/admin/allegro/oferty")?zaznaczoneMapowaniaAllegro:zaznaczoneAllegroOferty;checked?set.add(String(id)):set.delete(String(id));renderuj();}
function allegroZaznaczOfertyProduktow(ids=[],checked=true){ ids.map(id=>allegroOfertaDlaProduktuSklepu(pobierzProduktAdmin(Number(id))||{})).filter(Boolean).forEach(o=>checked?zaznaczoneAllegroOferty.add(String(o.id)):zaznaczoneAllegroOferty.delete(String(o.id))); renderuj(); }
async function allegroZmienCenyZaznaczonychOfert(){
  const mode=String(document.getElementById("allegroPriceMode")?.value||"percent");
  const value=Number(String(document.getElementById("allegroPriceValue")?.value||"").replace(",","."));
  const ids=[...zaznaczoneAllegroOferty];
  if(!ids.length){ toast("Zaznacz oferty Allegro"); return; }
  if(!Number.isFinite(value)||value===0){ toast("Podaj prawidłową wartość zmiany ceny"); return; }
  try{
    const d=await chmura("allegro-offer-price-change",{method:"POST",body:{offerIds:ids,mode,value},timeout:30000});
    toast(`🟠 Zlecono zmianę cen ${d.offerCount||ids.length} ofert • komenda ${d.commandId}`);
    zaznaczoneAllegroOferty.clear();
    setTimeout(()=>allegroSynchronizujOferty(),2200);
  }catch(e){ toast("⚠️ Zmiana cen Allegro: "+(e.message||e)); }
}
function allegroWystawianiePanelHTML(){
  const q=String(szukajAllegroWystawiania||"").toLowerCase().trim();
  const wszystkie=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const counts={wszystkie:wszystkie.length,aktywne:0,szkice:0,brak:0,gotowe:0,braki:0,do_aktualizacji:0};
  wszystkie.forEach(p=>{const o=allegroOfertaDlaProduktuSklepu(p), br=allegroBrakiProduktuDoWystawienia(p);if(!o)counts.brak++;else if(String(o.status||"").toUpperCase()==="ACTIVE")counts.aktywne++;else counts.szkice++;if(br.length)counts.braki++;else counts.gotowe++;if(o&&allegroRozniceOfertyProduktu(p,o).length)counts.do_aktualizacji++;});
  const pasujace=wszystkie.filter(p=>{
    const o=allegroOfertaDlaProduktuSklepu(p), br=allegroBrakiProduktuDoWystawienia(p);
    if(filtrAllegroWystawiania==="aktywne"&&String(o?.status||"").toUpperCase()!=="ACTIVE")return false;
    if(filtrAllegroWystawiania==="szkice"&&(!o||String(o.status||"").toUpperCase()==="ACTIVE"))return false;
    if(filtrAllegroWystawiania==="brak"&&o)return false;
    if(filtrAllegroWystawiania==="gotowe"&&br.length)return false;
    if(filtrAllegroWystawiania==="braki"&&!br.length)return false;
    if(filtrAllegroWystawiania==="do_aktualizacji"&&(!o||!allegroRozniceOfertyProduktu(p,o).length))return false;
    const txt=`${p.id||""} ${p.nazwa||""} ${p.sku||""} ${p.externalId||""} ${p.gtin||""} ${p.ean||""} ${p.kodProducenta||""} ${p.mpn||""} ${p.producent||""} ${p.marka||""} ${p.allegroOfferId||""}`.toLowerCase();
    return !q||txt.includes(q);
  });
  const rows=pasujace.slice(0,allegroLimitWystawiania);
  const selectedCount=[...zaznaczoneAllegroOferty].filter(id=>allegroOferty.some(o=>String(o.id)===id)).length;
  const defaultsAudit=allegroStan.offerDefaultsAudit||{items:{},updated_at:null};
  const defaultsIssues=Object.values(defaultsAudit.items||{}).filter(x=>!x.stockUpdated||!x.republishUpdated);
  const defaultsErrors=[...new Set(defaultsIssues.map(x=>String(x.error||"").trim()).filter(Boolean))].slice(0,3);
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">🟠 Wystawianie produktów na Allegro</h2><p class="order-detail-lead">Tu przygotujesz szkic oferty Allegro z produktu sklepu. Najbezpieczniej twórz ofertę jako nieaktywną, sprawdź parametry w Allegro i dopiero ją aktywuj.</p></div>
      <a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a>
    </div>
    <div class="orders-status-strip">${[["wszystkie","Wszystkie"],["aktywne","Aktywne"],["szkice","Szkice / nieaktywne"],["brak","Brak na Allegro"],["do_aktualizacji","Do aktualizacji"],["gotowe","Gotowe"],["braki","Do uzupełnienia"]].map(([id,label])=>`<button class="${filtrAllegroWystawiania===id?"active":""}" onclick="filtrAllegroWystawiania=${jsArg(id)};renderuj()">${label} <b>${counts[id]||0}</b></button>`).join("")}</div>
    ${adminWyszukiwaniePanelHTML({id:"allegro-products",description:"Produkt sklepu, SKU, EAN, kod producenta, oferta Allegro i stan przygotowania.",results:pasujace.length,active:!!(szukajAllegroWystawiania||filtrAllegroWystawiania!=="wszystkie"),open:true,fields:`<div class="orders-toolbar allegro-toolbar admin-search-full">
      <input placeholder="Szukaj: produkt, SKU, EAN, kod producenta, oferta Allegro…" value="${esc(szukajAllegroWystawiania)}" oninput="szukajAllegroWystawiania=this.value.toLowerCase();renderuj()">
      <label>Pokaż <select onchange="allegroLimitWystawiania=Number(this.value)||250;renderuj()">${[50,100,250,500,1000].map(n=>`<option value="${n}" ${allegroLimitWystawiania===n?"selected":""}>${n}</option>`).join("")}</select></label>
      <label>Po zapisie <select id="allegroPublicationAction"><option value="keep">nowa: szkic / istniejąca: bez zmiany statusu</option><option value="activate">aktywuj</option><option value="deactivate">dezaktywuj</option></select></label>
      ${szukajAllegroWystawiania?`<button class="btn ghost" onclick="szukajAllegroWystawiania='';renderuj()">Wyczyść</button>`:""}
    </div>`})}
    ${allegroWynikOperacjiHTML()}
    <div class="allegro-bulk-toolbar"><div><b>Operacje na ofertach Allegro</b><small>${selectedCount} zaznaczonych • pełne dane synchronizują się automatycznie</small></div><button class="btn ghost" onclick='allegroZaznaczOfertyProduktow(${JSON.stringify(rows.map(p=>p.id))},true)'>☑️ Zaznacz widoczne oferty</button><select id="allegroPriceMode"><option value="percent">O procent (+/−)</option><option value="amount">O kwotę (+/−)</option><option value="fixed">Ustaw cenę docelową</option></select><input id="allegroPriceValue" inputmode="decimal" placeholder="np. 10 lub -5" style="max-width:150px"><button class="btn ghost" onclick="allegroZmienCenyZaznaczonychOfert()">💰 Zmień ceny</button></div>
    <div class="warehouse-worktable-wrap"><table class="log-table warehouse-worktable">
      <tr><th>Wybór</th><th>Produkt</th><th>Producent</th><th>EAN / kod prod.</th><th>Oferta Allegro</th><th>Zdjęcia</th><th>Stan synchronizacji</th><th>Akcje</th></tr>
      ${rows.map(p=>{
        const braki=allegroBrakiProduktuDoWystawienia(p);
        const oferta=allegroOfertaDlaProduktuSklepu(p);
        const roznice=oferta?allegroRozniceOfertyProduktu(p,oferta):[];
        return `<tr class="${braki.length||roznice.length?"row-alert":""}">
          <td><input type="checkbox" ${oferta&&zaznaczoneAllegroOferty.has(String(oferta.id))?"checked":""} ${oferta?`onchange="allegroPrzelaczOferteDoCeny(${jsArg(oferta.id)},this.checked)"`:"disabled"}></td>
          <td><b>${esc(p.nazwa)}</b><br><small>ID: ${esc(p.id)}${p.sku?` • SKU: ${esc(p.sku)}`:""}</small></td>
          <td><b>${esc(p.producent||p.marka||"—")}</b><br><small>${p.marka&&p.producent!==p.marka?`marka: ${esc(p.marka)}`:""}</small></td>
          <td><b>${esc(p.gtin||p.ean||"—")}</b><br><small>${esc(p.kodProducenta||p.mpn||p.externalId||"—")}</small></td>
          <td>${allegroStatusProduktuHTML(p)}<br><small>${oferta?`${esc(oferta.priceText||"—")} • stan ${esc(oferta.stockAvailable??"—")}`:`Kategoria: ${esc(p.allegroCategoryId||"—")}`}</small></td>
          <td>${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:"—"}<br><small>${(p.zdjecia||[]).length+(p.zdjecie?1:0)} zdj.</small></td>
          <td>${braki.length?braki.map(b=>`<span class="lvl lvl-ostrzezenie">${esc(b)}</span>`).join(" "):roznice.length?`<span class="lvl lvl-info">nowsze w sklepie: ${esc(roznice.join(", "))}</span>`:`<span class="lvl lvl-ok">zsynchronizowane</span>`}</td>
          <td><div class="warehouse-worktable-actions">
            <a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj dane</a>
            <button class="btn ghost" onclick="allegroPrzygotujSzkicProduktZListy(${jsArg(p.id)})">🧾 Sprawdź szkic</button>
            <button class="btn" onclick="allegroWystawProduktZListy(${jsArg(p.id)})">${oferta?"🤖 Agent: aktualizuj ofertę":"🤖 Agent: dodaj szkic"}</button>
            ${oferta&&String(oferta.status||"").toUpperCase()!=="ACTIVE"?`<div class="allegro-activate-control"><b>${allegroStanOfertyProduktu()} szt.</b><button class="btn" onclick="allegroAktywujProduktZListy(${jsArg(p.id)})">🚀 Aktywuj</button><small>Domyślny stan oferty Allegro: ${allegroStanOfertyProduktu()} szt. • automatyczne wznawianie włączone • magazyn pozostaje ${esc(stanMagazynuId(p.id))} szt.</small></div>`:""}
          </div></td>
        </tr>`;
      }).join("") || `<tr><td colspan="8">Brak produktów w tym filtrze.</td></tr>`}
    </table></div>
    ${pasujace.length>rows.length?`<p class="order-detail-lead">Pokazano ${rows.length} z ${pasujace.length} produktów. Zwiększ limit widoku.</p>`:""}
    ${allegroOstatniBladWystawienia?`<div class="allegro-permission-alert allegro-info-bottom"><div><b>⚠️ Ostatnia próba wystawienia nie powiodła się</b><p>${esc(allegroOstatniBladWystawienia.message||"Błąd Allegro")}</p>${(allegroOstatniBladWystawienia.allegroError?.errors||allegroOstatniBladWystawienia.errors||[]).map(x=>`<small>• ${esc(x.userMessage||x.message||x.code||"błąd")}${x.path?` (${esc(x.path)})`:""}</small>`).join("<br>")}</div><button class="btn ghost" onclick="allegroOstatniBladWystawienia=null;renderuj()">Zamknij</button></div>`:""}
    <div class="backend-note allegro-info-bottom"><b>Reguła wszystkich ofert:</b> domyślny stan sprzedażowy Allegro = <b>${allegroStanOfertyProduktu()} szt.</b>, niezależnie od stanu fizycznego magazynu; wartość możesz zmienić w <a href="#/admin/allegro/ustawienia">Ustawieniach Allegro</a>. Automatyczne wznawianie jest włączane przy każdym utworzeniu i zapisie oferty.${defaultsIssues.length?`<br><span class="lvl lvl-ostrzezenie">${defaultsIssues.length} starszych ofert do uzupełnienia</span> Allegro blokuje w nich wznawianie do czasu uzupełnienia aktualnie wymaganych parametrów. Agent AI ma zapisany audyt i będzie pokazywał je jako zadania.${defaultsErrors.length?`<br><small>${defaultsErrors.map(x=>`• ${esc(skrocTekst(x,220))}`).join("<br>")}</small>`:""}`:` <span class="lvl lvl-ok">Audyt bez wyjątków</span>`}</div>
    <div class="allegro-info-bottom">${allegroZadaniaAgentaOfertHTML()}</div>
    ${allegroProceduraAgentaOfertHTML()}
    <div class="backend-note allegro-info-bottom"><b>Sklep jest źródłem najnowszych danych.</b> Powiązanie zapisuje jednocześnie produkt sklepu, produkt katalogowy Allegro i ofertę. Nazwa, cena, stan, zdjęcia, opis oraz producent są aktualizowane automatycznie z kartoteki sklepu bez tworzenia duplikatu i bez zmiany statusu publikacji.</div>
  </div>`;
}
function allegroDataTxt(v){
  const t=Date.parse(v||"");
  return t?new Date(t).toLocaleString("pl-PL"):"—";
}
function allegroAutoReplyKlucz(type,id,sourceId=""){
  return `${type}:${id}${sourceId?":"+sourceId:""}`;
}
function allegroAutoReplyDla(type,item={}){
  const replies=allegroKomunikacja?.autoReplies||{};
  const source=String(item.latestNewIncomingKey||item.latestNewIncoming?.id||item.latestNewIncoming?.createdAt||"");
  return replies[`${type}:${item.id}:first-contact`]||(source&&replies[allegroAutoReplyKlucz(type,item.id,source)])||replies[allegroAutoReplyKlucz(type,item.id)]||Object.values(replies).find(x=>x?.type===type&&String(x?.id)===String(item.id))||null;
}
function allegroKomunikacjaZalatwiona(item={}){
  return item?.internalResolved===true||item?.internalResolution?.resolved===true;
}
function allegroKomunikacjaWymagaOdpowiedzi(item={}){
  return !allegroKomunikacjaZalatwiona(item)&&!!(item?.humanReplyNeeded||item?.needsReply||Number(item?.newIncomingCount||0)>0);
}
function allegroKomunikacjaStaty(){
  const threads=Array.isArray(allegroKomunikacja?.threads)?allegroKomunikacja.threads:[];
  const issues=Array.isArray(allegroKomunikacja?.issues)?allegroKomunikacja.issues:[];
  const replies=allegroKomunikacja?.autoReplies||{};
  const threadNeed=threads.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  const issueNeed=issues.filter(allegroKomunikacjaWymagaOdpowiedzi).length;
  return {threads,issues,replies,threadNeed,issueNeed,totalNeed:threadNeed+issueNeed,sent:Object.keys(replies).length};
}
function allegroKomunikacjaBledyHTML(){
  const errors=Array.isArray(allegroKomunikacja?.errors)?allegroKomunikacja.errors:[];
  if(!errors.length) return "";
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth;
  const brakDostepu=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||errors.some(e=>Number(e.status)===403)));
  if(brakDostepu) return `<div class="allegro-permission-alert"><div><b>🔐 Allegro blokuje wiadomości i dyskusje — HTTP 403</b><p>Token oraz deklaracja aplikacji nie mają jeszcze aktywnych uprawnień <code>allegro:api:messaging</code> i <code>allegro:api:disputes</code>. Po rozszerzeniu uprawnień aplikacji trzeba jednorazowo połączyć konto ponownie — starego refresh tokenu nie da się rozszerzyć automatycznie.</p><small>${errors.map(e=>`${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}`).join(" • ")}</small></div><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button></div>`;
  return `<div class="backend-note" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Diagnostyka komunikacji Allegro:</b><br>${errors.map(e=>`• ${esc(e.key||"API")}: ${esc(e.message||e.code||"błąd")}${e.status?` (HTTP ${esc(e.status)})`:""}`).join("<br>")}</div>`;
}
function allegroReplyFieldId(type,id){return `allegro-reply-${String(type||"thread").replace(/[^a-z0-9_-]/gi,"-")}-${String(id||"").replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroReplyContextId(type,id){return `allegro-reply-context-${String(type||"thread").replace(/[^a-z0-9_-]/gi,"-")}-${String(id||"").replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroKontekstOdpowiedziHTML(context={}){
  const shipment=context.shipment||{},checks=context.checks||{},errors=Array.isArray(context.errors)?context.errors:[];
  const chips=[
    [context.orderFound?"ok":"warn",context.orderFound?`Zamówienie ${context.orderId}`:"Brak jednoznacznego zamówienia"],
    [checks.liveOrder?"ok":"warn",checks.liveOrder?`Status Allegro: ${context.statusLabel||context.status||"sprawdzony"}`:"Status bieżący niedostępny"],
    [checks.shipments?"ok":"warn",shipment.tracking?`Numer nadania: ${shipment.tracking}`:shipment.sent?"Wysłane — bez numeru w danych":"Brak potwierdzonego nadania"],
    [checks.warehouse?context.shortages>0?"bad":"ok":"info",checks.warehouse?(context.shortages>0?`Braki magazynowe: ${context.shortages} szt.`:"Magazyn sprawdzony"):"Brak analizy magazynowej"],
    [checks.localShipping?"ok":"info",checks.localShipping?"Sprawdzono obsługę InPost w sklepie":"Brak lokalnej przesyłki"],
  ];
  return `<div class="allegro-agent-check-head"><b>🤖 Agent sprawdził dane przed przygotowaniem odpowiedzi</b><small>${esc(allegroDataTxt(context.verifiedAt))}</small></div><div class="allegro-agent-check-chips">${chips.map(([cls,label])=>`<span class="${cls}">${esc(label)}</span>`).join("")}</div>${errors.length?`<small class="allegro-agent-check-warning">Nie wszystkie źródła odpowiedziały: ${errors.map(esc).join(" • ")}. Propozycja nie zgaduje brakujących danych.</small>`:""}`;
}
async function allegroAgentPropozycjaOdpowiedzi(type,id){
  try{
    const d=await chmura("allegro-reply-suggestion",{method:"POST",body:{type,id},timeout:30000});
    const field=document.getElementById(allegroReplyFieldId(type,id));
    if(field){field.value=d.suggestion||"";field.focus();}
    const contextBox=document.getElementById(allegroReplyContextId(type,id));if(contextBox){contextBox.innerHTML=allegroKontekstOdpowiedziHTML(d.context||{});contextBox.hidden=false;}
    toast(d.basedOn?.shipments?"🤖 Agent sprawdził zamówienie, wysyłkę i tracking":"🤖 Agent sprawdził dostępne dane i przygotował propozycję do zatwierdzenia");
  }catch(e){toast("⚠️ Propozycja Agenta AI: "+(e.message||e));}
}
async function allegroWyslijOdpowiedz(type,id){
  const field=document.getElementById(allegroReplyFieldId(type,id));
  const text=String(field?.value||"").trim();
  if(!text){toast("Wpisz odpowiedź albo użyj propozycji Agenta AI");return;}
  try{
    const d=await chmura("allegro-send-reply",{method:"POST",body:{type,id,text},timeout:30000});
    allegroKomunikacja={...allegroKomunikacja,threads:Array.isArray(d.threads)?d.threads:allegroKomunikacja.threads,issues:Array.isArray(d.issues)?d.issues:allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at,sprawdzono:true};
    allegroZapiszCache();toast("Odpowiedź została wysłana przez Allegro ✅");renderuj();
  }catch(e){toast("⚠️ Wysyłanie odpowiedzi Allegro: "+(e.message||e));}
}
function allegroTypAutoraHTML(m={}){
  const explicit=String(m.authorType||"").toLowerCase(),role=String(m.role||"").toUpperCase(),login=String(m.authorLogin||"").toLowerCase();
  if(["buyer","seller","allegro"].includes(explicit))return explicit;
  if(m.system===true||["ADMIN","ALLEGRO","SYSTEM","MODERATOR"].includes(role)||/^(allegro|administrator|admin|system|moderator)([-_. ]|$)/i.test(login))return "allegro";
  if(role==="BUYER"||m.incoming===true)return "buyer";
  if(role==="SELLER"||m.seller===true||m.incoming===false)return "seller";
  return "allegro";
}
function allegroHistoriaRozmowyHTML(messages=[]){
  const sorted=(Array.isArray(messages)?messages:[]).slice().sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||""))).slice(-20);
  return `<div class="allegro-conversation">${sorted.map(m=>{const author=allegroTypAutoraHTML(m),buyer=author==="buyer",system=author==="allegro",label=buyer?`👤 ${esc(m.authorLogin||"Klient")}`:system?"🔔 Allegro / wiadomość systemowa":"🏪 Artway-TM";return `<div class="allegro-message ${buyer?"incoming":system?"system":"seller"}"><div><b>${label}</b><small>${esc(allegroDataTxt(m.createdAt))}</small></div><p>${esc(m.text||"Wiadomość bez treści")}</p></div>`;}).join("")||`<div class="backend-note">Brak treści wiadomości w lokalnym podglądzie.</div>`}</div>`;
}
function allegroInternalNoteId(type,id){return `allegro-internal-note-${String(type)}-${String(id).replace(/[^a-z0-9_-]/gi,"-")}`;}
function allegroZaznaczeniaKomunikacji(type){return type==="issue"?zaznaczoneAllegroDyskusje:zaznaczoneAllegroWiadomosci;}
function allegroPrzelaczZaznaczenieKomunikacji(type,id,checked){const set=allegroZaznaczeniaKomunikacji(type);checked?set.add(String(id)):set.delete(String(id));renderuj();}
function allegroSzukajKomunikacje(type,value){
  if(type==="issue")szukajAllegroDyskusji=String(value||"");else szukajAllegroWiadomosci=String(value||"");
  clearTimeout(window.__allegroCommunicationSearchTimer);window.__allegroCommunicationSearchTimer=setTimeout(()=>{renderuj();setTimeout(()=>{const el=document.getElementById(type==="issue"?"allegroIssueSearch":"allegroThreadSearch");if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0);},280);
}
function allegroUstawFiltrKomunikacji(type,value){
  if(type==="issue")filtrAllegroDyskusji=String(value||"wszystkie");else filtrAllegroWiadomosci=String(value||"wszystkie");
  allegroLimitKomunikacji=Math.max(50,allegroLimitKomunikacji);renderuj();
  setTimeout(()=>document.querySelector(".allegro-communication-list")?.scrollIntoView({behavior:"smooth",block:"start"}),30);
}
function allegroAktywujKafelkiKomunikacji(type="thread"){
  const root=document.querySelector(".allegro-communication-page"),cards=[...(root?.querySelectorAll(":scope > .orders-stat-grid .order-stat-card")||[])],values=["wszystkie","wymaga","zalatwione","obsluzone"],current=type==="issue"?filtrAllegroDyskusji:filtrAllegroWiadomosci;
  cards.forEach((card,index)=>{const value=values[index];if(!value)return;card.classList.add("stat-filter");card.classList.toggle("active",current===value);card.setAttribute("role","button");card.setAttribute("tabindex","0");card.setAttribute("aria-pressed",String(current===value));card.onclick=()=>allegroUstawFiltrKomunikacji(type,value);card.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();allegroUstawFiltrKomunikacji(type,value);}};});
}
function allegroTekstKomunikacji(item={}){return `${item.id||""} ${item.buyerLogin||""} ${item.subject||""} ${item.orderId||""} ${(item.messages||[]).map(m=>`${m.authorLogin||""} ${m.text||""} ${m.orderId||""}`).join(" ")}`.toLowerCase();}
function allegroKomunikacjaPasujaca(type="thread"){
  const list=type==="issue"?(allegroKomunikacja?.issues||[]):(allegroKomunikacja?.threads||[]),q=String(type==="issue"?szukajAllegroDyskusji:szukajAllegroWiadomosci).toLowerCase().trim(),filter=type==="issue"?filtrAllegroDyskusji:filtrAllegroWiadomosci,sort=type==="issue"?sortAllegroDyskusje:sortAllegroWiadomosci;
  return list.filter(item=>{
    if(q&&!allegroTekstKomunikacji(item).includes(q))return false;
    const need=allegroKomunikacjaWymagaOdpowiedzi(item),resolved=allegroKomunikacjaZalatwiona(item),status=String(item.status||"").toUpperCase(),closed=/CLOSED|RESOLVED|CANCELLED|REJECTED/.test(status)||item.chatActive===false;
    if(filter==="wymaga"&&!need)return false;if(filter==="zalatwione"&&!resolved)return false;if(filter==="obsluzone"&&(need||resolved))return false;if(filter==="aktywne"&&closed)return false;if(filter==="zamkniete"&&!closed)return false;
    return true;
  }).sort((a,b)=>{const ad=Date.parse(a.lastMessageDateTime||a.lastMessage?.createdAt||a.openedDate||0)||0,bd=Date.parse(b.lastMessageDateTime||b.lastMessage?.createdAt||b.openedDate||0)||0;return sort==="najstarsze"?ad-bd:bd-ad;});
}
function allegroZaznaczWidocznaKomunikacje(type,checked){const set=allegroZaznaczeniaKomunikacji(type);allegroKomunikacjaPasujaca(type).slice(0,allegroLimitKomunikacji).forEach(x=>checked?set.add(String(x.id)):set.delete(String(x.id)));renderuj();}
async function allegroOznaczSpraweWewnetrznie(type,id,resolved=true){
  const note=String(document.getElementById(allegroInternalNoteId(type,id))?.value||"").trim();
  try{const d=await chmura("allegro-communication-resolve",{method:"POST",body:{type,id,resolved,note},timeout:20000});allegroKomunikacja={...allegroKomunikacja,threads:d.threads||allegroKomunikacja.threads,issues:d.issues||allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at};allegroZapiszCache();toast(resolved?"✅ Sprawa oznaczona jako załatwiona wyłącznie wewnętrznie — nic nie wysłano":"↩️ Sprawa przywrócona do obsługi wewnętrznej");renderuj();}catch(e){toast("⚠️ Status wewnętrzny: "+(e.message||e));}
}
async function allegroOznaczZaznaczoneSprawy(type,resolved=true){
  const set=allegroZaznaczeniaKomunikacji(type),items=[...set].map(id=>({type,id,resolved}));if(!items.length){toast("Zaznacz co najmniej jedną sprawę");return;}
  try{const d=await chmura("allegro-communication-resolve",{method:"POST",body:{items},timeout:30000});allegroKomunikacja={...allegroKomunikacja,threads:d.threads||allegroKomunikacja.threads,issues:d.issues||allegroKomunikacja.issues,updated_at:d.updated_at||allegroKomunikacja.updated_at};set.clear();allegroZapiszCache();toast(`✅ Zmieniono ${d.results?.filter(x=>x.ok).length||0} spraw wyłącznie wewnętrznie — bez wiadomości do klientów`);renderuj();}catch(e){toast("⚠️ Operacja grupowa: "+(e.message||e));}
}
function allegroRozmowaHTML(type,item={},label="Wiadomość"){
  const sent=allegroAutoReplyDla(type,item),last=item.lastMessage||{},resolved=allegroKomunikacjaZalatwiona(item),nowa=allegroKomunikacjaWymagaOdpowiedzi(item),fieldId=allegroReplyFieldId(type,item.id),contextId=allegroReplyContextId(type,item.id),noteId=allegroInternalNoteId(type,item.id),selected=allegroZaznaczeniaKomunikacji(type).has(String(item.id));
  const messages=Array.isArray(item.messages)&&item.messages.length?item.messages:[last].filter(Boolean);
  const orderId=item.orderId||messages.find(m=>m.orderId)?.orderId||"";
  return `<details class="allegro-conversation-card ${nowa?"needs-reply":""} ${resolved?"is-internally-resolved":""}" ${nowa?"open":""}>
    <summary><label class="allegro-communication-select" onclick="event.stopPropagation()"><input type="checkbox" ${selected?"checked":""} onchange="allegroPrzelaczZaznaczenieKomunikacji(${jsArg(type)},${jsArg(item.id)},this.checked)"></label><span class="allegro-conversation-icon">${type==="issue"?"🛟":"💬"}</span><span><b>${esc(label)} — ${esc(item.buyerLogin||"Klient Allegro")}</b><small>${esc(skrocTekst(last.text||item.subject||"Brak treści",180))}</small></span><span>${resolved?`<span class="lvl lvl-ok">✅ załatwiona wewnętrznie</span>`:nowa?`<span class="lvl lvl-ostrzezenie">wymaga odpowiedzi</span>`:sent?`<span class="lvl lvl-ok">pierwsza odpowiedź wysłana</span>`:`<span class="lvl lvl-info">obsłużona</span>`}</span></summary>
    <div class="allegro-conversation-meta"><span>ID: ${esc(item.id)}</span>${orderId?`<span>Zamówienie: ${esc(orderId)}</span>`:""}<span>Ostatnia: ${esc(allegroDataTxt(item.lastMessageDateTime||last.createdAt||item.openedDate))}</span>${item.status?`<span>Status: ${esc(item.status)}</span>`:""}</div>
    <div class="allegro-internal-resolution"><div><b>✅ Obsługa wewnętrzna</b><small>Ta operacja nie wysyła wiadomości do klienta ani nie zmienia statusu w Allegro. Agent przestanie zgłaszać sprawę do wyjaśnienia. Nowa wiadomość klienta automatycznie otworzy ją ponownie.</small>${resolved&&item.internalResolution?.resolvedAt?`<em>Załatwiono: ${esc(allegroDataTxt(item.internalResolution.resolvedAt))}${item.internalResolution.note?` • ${esc(item.internalResolution.note)}`:""}</em>`:""}</div><input id="${esc(noteId)}" maxlength="1000" value="${esc(item.internalResolution?.note||"")}" placeholder="Notatka wewnętrzna (opcjonalnie)">${resolved?`<button class="btn ghost" type="button" onclick="allegroOznaczSpraweWewnetrznie(${jsArg(type)},${jsArg(item.id)},false)">↩️ Przywróć do obsługi</button>`:`<button class="btn" type="button" onclick="allegroOznaczSpraweWewnetrznie(${jsArg(type)},${jsArg(item.id)},true)">✅ Oznacz jako załatwioną</button>`}</div>
    ${allegroHistoriaRozmowyHTML(messages)}
    <div class="allegro-reply-box"><label for="${esc(fieldId)}"><b>Odpowiedź wychodząca do klienta</b><small>Kolejne odpowiedzi nigdy nie są wysyłane automatycznie. Agent najpierw sprawdza zamówienie, status Allegro, magazyn, przesyłkę i numer nadania; dopiero przycisk „Wyślij przez Allegro” przekaże zatwierdzoną treść klientowi.</small></label><div id="${esc(contextId)}" class="allegro-agent-check" hidden></div><textarea id="${esc(fieldId)}" rows="6" maxlength="20000" placeholder="Wpisz odpowiedź dla klienta…"></textarea><div class="diag-actions"><button class="btn ghost" type="button" onclick="allegroAgentPropozycjaOdpowiedzi(${jsArg(type)},${jsArg(item.id)})">🤖 Sprawdź zamówienie i przygotuj</button><button class="btn" type="button" onclick="allegroWyslijOdpowiedz(${jsArg(type)},${jsArg(item.id)})">✉️ Wyślij przez Allegro</button></div></div>
  </details>`;
}
function allegroWatekHTML(t){
  return allegroRozmowaHTML("thread",t,"Wiadomość");
}
function allegroIssueHTML(i){
  return allegroRozmowaHTML("issue",i,i.type==="CLAIM"?"Reklamacja":"Dyskusja");
}
function allegroKomunikacjaPanelLegacyHTML(){
  const st=allegroKomunikacjaStaty();
  const s=allegroKomunikacjaUstawienia();
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth;
  const wymagaPonownegoPolaczenia=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||(allegroKomunikacja?.errors||[]).some(e=>Number(e.status)===403)));
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">💬 Wiadomości, dyskusje i autoresponder Allegro</h2><p class="order-detail-lead">Autoresponder wysyła najwyżej jedną wiadomość: wyłącznie po pierwszej wiadomości klienta w całkowicie nowej rozmowie. Każdy dalszy kontakt wymaga ręcznego zatwierdzenia odpowiedzi przygotowanej po sprawdzeniu zamówienia i wysyłki.</p></div>
      ${wymagaPonownegoPolaczenia?`<button class="btn" onclick="allegroPolacz()">🔐 Napraw połączenie Allegro</button>`:""}
    </div>
    <div class="panel-subtle">
      <div class="order-section-head"><div><h3 style="margin:0">💬 Centrum wiadomości</h3><p class="order-detail-lead">Otwórz rozmowę, zobacz historię, poproś Agenta AI o propozycję i odpowiedz klientowi bez opuszczania sklepu.</p></div></div>
      <div class="ai-task-list">${st.threads.map(allegroWatekHTML).join("") || `<p style="color:var(--muted2)">Brak pobranych wątków. Dane odświeżą się automatycznie.</p>`}</div>
    </div>
    <div class="panel-subtle" style="margin-top:1rem">
      <div class="order-section-head"><div><h3 style="margin:0">🛟 Dyskusje i reklamacje</h3><p class="order-detail-lead">Używane jest nowe API Allegro <code>/sale/issues</code>, a nie stare <code>/sale/disputes</code>.</p></div></div>
      <div class="ai-task-list">${st.issues.map(allegroIssueHTML).join("") || `<p style="color:var(--muted2)">Brak pobranych dyskusji/reklamacji. Dane odświeżą się automatycznie.</p>`}</div>
    </div>
    <div class="orders-stat-grid allegro-info-bottom">
      <div class="order-stat-card ${st.threadNeed?"hot":""}"><span>💬</span><b>${st.threads.length}</b><small>wątki wiadomości</small></div>
      <div class="order-stat-card ${st.issueNeed?"hot":""}"><span>🛟</span><b>${st.issues.length}</b><small>dyskusje/reklamacje</small></div>
      <div class="order-stat-card ${st.totalNeed?"hot":"money"}"><span>⚡</span><b>${st.totalNeed}</b><small>wymaga ręcznej odpowiedzi</small></div>
      <div class="order-stat-card money"><span>✅</span><b>${st.sent}</b><small>auto-odpowiedzi zapisane</small></div>
    </div>
    ${allegroKomunikacjaBledyHTML()}
    <form class="panel-subtle allegro-info-bottom" onsubmit="event.preventDefault();allegroZapiszUstawieniaKomunikacji(this)">
      <div class="order-section-head">
        <div><h3 style="margin:0">⚙️ Ustawienia autorespondera</h3><p class="order-detail-lead">Harmonogram sprawdza komunikację co 15 minut. Automat odpowiada tylko na pierwszą wiadomość klienta w nowym wątku lub nowej dyskusji. Druga i każda kolejna wiadomość nigdy nie uruchamia autorespondera.</p></div>
        <button class="btn" type="submit">💾 Zapisz ustawienia</button>
      </div>
      <div class="form-grid">
        <label class="check"><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Autoresponder aktywny</label>
        <label class="check"><input type="checkbox" name="messageCenter" ${s.messageCenter?"checked":""}> Centrum wiadomości</label>
        <label class="check"><input type="checkbox" name="issues" ${s.issues?"checked":""}> Dyskusje i reklamacje</label>
        <label class="check"><input type="checkbox" name="telegramReminders" ${s.telegramReminders!==false?"checked":""}> Telegram: przypominaj tylko o nowych rozmowach wymagających odpowiedzi</label>
        <div class="f-group"><label>Odpowiadaj tylko na wiadomości z ostatnich godzin</label><input name="freshHours" type="number" min="1" max="168" value="${esc(s.freshHours||48)}"></div>
      </div>
      <div class="f-group"><label>Treść automatycznej pierwszej odpowiedzi <small style="font-weight:400;color:var(--muted2)">zmienne: {login}, {typ}</small></label><textarea name="template" rows="7" maxlength="2000">${esc(s.template||"")}</textarea></div>
    </form>
  </div>`;
}
function allegroKomunikacjaUstawieniaHTML(){
  const s=allegroKomunikacjaUstawienia();return `<form class="panel-subtle allegro-info-bottom" onsubmit="event.preventDefault();allegroZapiszUstawieniaKomunikacji(this)"><div class="order-section-head"><div><h3 style="margin:0">⚙️ Ustawienia pierwszej odpowiedzi</h3><p class="order-detail-lead"><b>Twarda reguła:</b> automat odpowiada tylko raz — na pierwszy kontakt w nowej rozmowie. Kolejne wiadomości wyłącznie otwierają zadanie dla obsługi i Agenta. Wewnętrznie załatwione sprawy są pomijane przez przypomnienia Telegram.</p></div><button class="btn" type="submit">💾 Zapisz ustawienia</button></div><div class="form-grid"><label class="check"><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Pierwsza odpowiedź automatyczna aktywna</label><label class="check"><input type="checkbox" name="messageCenter" ${s.messageCenter?"checked":""}> Nowe wątki Centrum wiadomości</label><label class="check"><input type="checkbox" name="issues" ${s.issues?"checked":""}> Nowe dyskusje i reklamacje</label><label class="check"><input type="checkbox" name="telegramReminders" ${s.telegramReminders!==false?"checked":""}> Telegram tylko dla nowych spraw wymagających odpowiedzi</label><div class="f-group"><label>Okno świeżości pierwszego kontaktu (godziny)</label><input name="freshHours" type="number" min="1" max="168" value="${esc(s.freshHours||48)}"></div></div><div class="f-group"><label>Treść jednorazowej odpowiedzi powitalnej <small style="font-weight:400;color:var(--muted2)">zmienne: {login}, {typ}</small></label><textarea name="template" rows="7" maxlength="2000">${esc(s.template||"")}</textarea></div></form>`;
}
function allegroKomunikacjaPanelHTML(type="thread"){
  const isIssue=type==="issue",st=allegroKomunikacjaStaty(),all=isIssue?st.issues:st.threads,list=allegroKomunikacjaPasujaca(type),visible=list.slice(0,allegroLimitKomunikacji),set=allegroZaznaczeniaKomunikacji(type),selected=[...set].filter(id=>all.some(x=>String(x.id)===id)),allVisible=!!visible.length&&visible.every(x=>set.has(String(x.id))),need=all.filter(allegroKomunikacjaWymagaOdpowiedzi).length,resolved=all.filter(allegroKomunikacjaZalatwiona).length,handled=Math.max(0,all.length-need-resolved),query=isIssue?szukajAllegroDyskusji:szukajAllegroWiadomosci,filter=isIssue?filtrAllegroDyskusji:filtrAllegroWiadomosci,sort=isIssue?sortAllegroDyskusje:sortAllegroWiadomosci;
  const tokenAktualny=!!allegroStan.connected&&!allegroStan.requiresReauth,wymagaPonownegoPolaczenia=!!allegroStan.requiresReauth||(!tokenAktualny&&(allegroKomunikacja?.requiresReauth||(allegroKomunikacja?.errors||[]).some(e=>Number(e.status)===403)));
  const filterOptions=isIssue?[["wszystkie","Wszystkie"],["aktywne","Aktywne w Allegro"],["zamkniete","Zamknięte w Allegro"],["wymaga","Wymagają odpowiedzi"],["zalatwione","Załatwione wewnętrznie"],["obsluzone","Obsłużone"]]:[["wszystkie","Wszystkie"],["wymaga","Wymagają odpowiedzi"],["zalatwione","Załatwione wewnętrznie"],["obsluzone","Obsłużone"]];
  return `<div class="panel allegro-section-panel allegro-communication-page"><div class="order-section-head"><div><span class="order-pro-label">${isIssue?"Zgłoszenia formalne":"Obsługa korespondencji"}</span><h2>${isIssue?"🛟 Dyskusje i reklamacje Allegro":"💬 Centrum wiadomości Allegro"}</h2><p class="order-detail-lead">${isIssue?"Dyskusje i reklamacje są oddzielone od zwykłych wiadomości. Wpisy administratora lub systemu Allegro pozostają w historii, ale nie są traktowane jako wiadomości klienta.":"Przeszukuj historię po kliencie, zamówieniu, treści i identyfikatorze. Odświeżanie oznacza jako nowe wyłącznie wiadomości kupujących, których nie było podczas poprzedniej synchronizacji."}</p></div><div class="diag-actions">${wymagaPonownegoPolaczenia?`<button class="btn" onclick="allegroPolacz()">🔐 Napraw połączenie</button>`:""}<button class="btn ghost" onclick="allegroSynchronizujKomunikacje(false)">↻ Sprawdź nowe wiadomości</button></div></div><div class="orders-stat-grid"><div class="order-stat-card"><span>${isIssue?"🛟":"💬"}</span><b>${all.length}</b><small>wszystkich</small></div><div class="order-stat-card ${need?"hot":""}"><span>⚡</span><b>${need}</b><small>wymaga odpowiedzi • bez załatwionych</small></div><div class="order-stat-card money"><span>✅</span><b>${resolved}</b><small>załatwionych wewnętrznie</small></div><div class="order-stat-card"><span>📁</span><b>${handled}</b><small>obsłużonych</small></div></div><div class="allegro-communication-toolbar"><input id="${isIssue?"allegroIssueSearch":"allegroThreadSearch"}" placeholder="Szukaj: klient, numer zamówienia, ID, temat lub treść…" value="${esc(query)}" oninput="allegroSzukajKomunikacje(${jsArg(type)},this.value)"><select onchange="${isIssue?"filtrAllegroDyskusji":"filtrAllegroWiadomosci"}=this.value;renderuj()">${filterOptions.map(([v,l])=>`<option value="${v}" ${filter===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="${isIssue?"sortAllegroDyskusje":"sortAllegroWiadomosci"}=this.value;renderuj()"><option value="najnowsze" ${sort==="najnowsze"?"selected":""}>Najnowsze najpierw</option><option value="najstarsze" ${sort==="najstarsze"?"selected":""}>Najstarsze najpierw</option></select><label>Pokaż <select onchange="allegroLimitKomunikacji=Number(this.value)||50;renderuj()">${[20,50,100].map(n=>`<option value="${n}" ${allegroLimitKomunikacji===n?"selected":""}>${n}</option>`).join("")}</select></label></div><div class="allegro-communication-bulk"><label><input type="checkbox" ${allVisible?"checked":""} onchange="allegroZaznaczWidocznaKomunikacje(${jsArg(type)},this.checked)"> Zaznacz/odznacz widoczne (${visible.length})</label><span><b>${selected.length}</b> zaznaczonych</span><button class="btn" onclick="allegroOznaczZaznaczoneSprawy(${jsArg(type)},true)" ${selected.length?"":"disabled"}>✅ Załatw wewnętrznie</button><button class="btn ghost" onclick="allegroOznaczZaznaczoneSprawy(${jsArg(type)},false)" ${selected.length?"":"disabled"}>↩️ Przywróć do obsługi</button></div><div class="allegro-internal-banner"><b>🔒 Status wewnętrzny ma pierwszeństwo</b><span>Po oznaczeniu „załatwione” sprawa natychmiast znika z filtra i licznika „Wymaga odpowiedzi”. Nie wysyła to wiadomości i nie zmienia oficjalnego statusu Allegro. Dopiero rzeczywiście nowa wiadomość klienta może ponownie otworzyć sprawę.</span></div><div class="ai-task-list allegro-communication-list">${visible.map(item=>isIssue?allegroIssueHTML(item):allegroWatekHTML(item)).join("")||`<div class="backend-note">Brak spraw pasujących do wyszukiwania i filtrów.</div>`}</div>${list.length>visible.length?`<p class="order-detail-lead">Pokazano ${visible.length} z ${list.length} wyników. Zwiększ limit widoku.</p>`:""}${allegroKomunikacjaBledyHTML()}${!isIssue?allegroKomunikacjaUstawieniaHTML():`<div class="backend-note allegro-info-bottom"><b>Ustawienia autorespondera</b> znajdują się na podstronie Wiadomości. Status „załatwiona wewnętrznie” zawsze ma pierwszeństwo przed automatyką.</div>`}</div>`;
}
function adminSubnavHTML(items, aktywny){
  const safe = (items||[]).filter(x=>x&&x.id&&x.href&&x.label);
  return `<nav class="panel admin-tabs-panel module-tabs-panel" aria-label="Podsekcje panelu"><div class="shipping-tabs admin-main-tabs">${safe.map(x=>`<a class="${x.id===aktywny?"active":""}" href="${esc(x.href)}" ${x.id===aktywny?'aria-current="page"':""} title="${esc(x.label)}"><span class="tab-label">${esc(x.label)}</span>${x.badge?`<span class="nav-badge">${esc(x.badge)}</span>`:""}</a>`).join("")}</div></nav>`;
}
function magazynSubnavHTML(aktywny="pulpit"){
  const produktyAktywne=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const braki=potrzebyZatowarowania().length;
  const prod=statystykiDostepnosciProducentow(),alerty=prod.niskie.length+prod.braki.length;
  const bezLok=produktyAktywne.filter(p=>!magazynMetaProduktu(p.id).lokalizacja).length;
  const ruchy=(ruchyMagazynowe||[]).length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/magazyn",label:"📊 Pulpit"},
    {id:"dostawcy",href:"#/admin/magazyn/dostawcy",label:"🏭 Dostępność producentów",badge:alerty||""},
    {id:"stany",href:"#/admin/magazyn/stany",label:"📦 Stany produktów",badge:produktyAktywne.length},
    {id:"lokalizacje",href:"#/admin/magazyn/lokalizacje",label:"🗺️ Lokalizacje",badge:bezLok||""},
    {id:"plan",href:"#/admin/magazyn/plan",label:"📦 Plan zatowarowania",badge:braki||""},
    {id:"ruchy",href:"#/admin/magazyn/ruchy",label:"🧾 Ruchy i ustawienia",badge:ruchy||""}
  ],aktywny);
}
function infaktSubnavHTML(aktywny="pulpit"){
  return adminSubnavHTML([
    {id:"pulpit",label:"📊 Pulpit",href:"#/admin/infakt"},
    {id:"zamowienia",label:"📦 Zamówienia do faktury",href:"#/admin/infakt/zamowienia"},
    {id:"faktury",label:"🧾 Faktury inFakt",href:"#/admin/infakt/faktury"},
    {id:"dostawcy",label:"🏭 Faktury dostawców",href:"#/admin/infakt/dostawcy"},
    {id:"szkice",label:"📝 Szkice robocze",href:"#/admin/infakt/szkice"},
    {id:"ustawienia",label:"⚙️ Dostęp API",href:"#/admin/infakt/ustawienia"},
  ],aktywny);
}
function agentAISubnavHTML(aktywny="pulpit"){
  const analiza=agentAIAnaliza();
  const aktywneZadania=agentAIAnalizaAktywna(analiza),problemy=aktywneZadania.length;
  const plan=aktywneZadania.length;
  const produktyWdrozenie=agentAIProduktyWdrozenie().length;
  const zlecenia=(agentAIZlecenia||[]).filter(z=>!agentAIStatusZamknietyDlaNowejWersji(z.status)).length;
  const producenciGotowi=(producenciKartoteka||[]).filter(p=>p.active!==false&&p.orderEmail).length;
  const pamiec=(agentAIPamiec||[]).length;
  return adminSubnavHTML([
    {id:"pulpit",href:"#/admin/agent-ai",label:"🤖 Pulpit",badge:problemy||""},
    {id:"komendy",href:"#/admin/agent-ai/komendy",label:"💬 Komendy"},
    {id:"plan",href:"#/admin/agent-ai/plan",label:"🧭 Plan operacyjny",badge:plan||""},
    {id:"produkty",href:"#/admin/agent-ai/produkty",label:"✨ Nowe produkty",badge:produktyWdrozenie||""},
    {id:"zlecenia",href:"#/admin/agent-ai/zlecenia",label:"📑 Zlecenia i tabela",badge:zlecenia||""},
    {id:"producenci",href:"#/admin/agent-ai/producenci",label:"🏭 Producenci i kontakt",badge:producenciGotowi||""},
    {id:"pamiec",href:"#/admin/agent-ai/pamiec",label:"🧠 Pamięć",badge:pamiec||""},
    {id:"historia",href:"#/admin/agent-ai/historia",label:"🕓 Historia",badge:Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).length||""}
  ],aktywny);
}
function klienciSubnavHTML(aktywny="lista"){
  const u=pobierzUzytkownikow();
  const admini=u.filter(x=>kontoMaRoleAdmin(x.email)).length;
  return adminSubnavHTML([
    {id:"lista",href:"#/admin/klienci",label:"👥 Lista klientów",badge:u.length},
    {id:"dodaj",href:"#/admin/klienci/dodaj",label:"➕ Dodaj klienta"},
    {id:"uprawnienia",href:"#/admin/klienci/uprawnienia",label:"🛡️ Uprawnienia",badge:admini},
    {id:"zamowienia",href:"#/admin/klienci/zamowienia",label:"📦 Zamówienia klientów"}
  ],aktywny);
}
function eksportSubnavHTML(aktywny="import"){
  return adminSubnavHTML([
    {id:"import",href:"#/admin/eksport",label:"📥 Import produktów"},
    {id:"eksport",href:"#/admin/eksport/eksport",label:"📤 Eksport produktów"},
    {id:"kopie",href:"#/admin/eksport/kopie",label:"💾 Kopie i raporty"},
    {id:"aktualizacja",href:"#/admin/aktualizacja",label:"⬆️ Aktualizacja strony"}
  ],aktywny);
}
function aktualizacjaSubnavHTML(aktywny="status"){
  return adminSubnavHTML([
    {id:"status",href:"#/admin/aktualizacja",label:"📡 Status"},
    {id:"publikuj",href:"#/admin/aktualizacja/publikuj",label:"⬆️ Publikuj zmiany"},
    {id:"index",href:"#/admin/aktualizacja/index",label:"📄 Nowy index.html"},
    {id:"kopie",href:"#/admin/aktualizacja/kopie",label:"↩️ Kopie"}
  ],aktywny);
}
function publikacjaSubnavHTML(aktywny="kontrola"){
  return adminSubnavHTML([
    {id:"kontrola",href:"#/admin/publikacja",label:"✅ Gotowość"},
    {id:"pliki",href:"#/admin/publikacja/pliki",label:"📁 Pliki i hosting"},
    {id:"kroki",href:"#/admin/publikacja/kroki",label:"🧭 Kroki publikacji"},
    {id:"aktualizacja",href:"#/admin/aktualizacja",label:"⬆️ Aktualizacja"}
  ],aktywny);
}
function allegroZgodnoscPozycje(){
  const items=Array.isArray(allegroStan.complianceAudit?.items)?allegroStan.complianceAudit.items:[],q=String(szukajAllegroZgodnosc||"").trim().toLowerCase();
  return items.filter(item=>{
    const text=[item.offerId,item.name,item.status,...(item.violations||[]).flatMap(v=>[v.label,...(v.matches||[])])].join(" ").toLowerCase();
    const filtrOk=filtrAllegroZgodnosc==="wszystkie"||(filtrAllegroZgodnosc==="naruszenia"&&!item.ok)||(filtrAllegroZgodnosc==="naprawione"&&item.fixed)||(filtrAllegroZgodnosc==="poprawne"&&item.ok&&!item.fixed)||(filtrAllegroZgodnosc==="bledy"&&item.error);
    return filtrOk&&(!q||text.includes(q));
  });
}
function allegroZaznaczZgodnosc(ids=[],checked=true){for(const id of ids)checked?zaznaczoneAllegroZgodnosc.add(String(id)):zaznaczoneAllegroZgodnosc.delete(String(id));renderuj();}
async function allegroAudytujZgodnosc({fix=false,offerIds=[],offerId=""}={}){
  if(allegroZgodnoscBusy)return;
  allegroZgodnoscBusy=true;renderuj();
  try{
    const body={fix,activeOnly:true,limit:50};if(offerId)body.offerId=String(offerId).trim();if(Array.isArray(offerIds)&&offerIds.length)body.offerIds=offerIds.map(String).slice(0,50);
    const d=await chmura("allegro-offer-compliance",{method:"POST",body,timeout:180000});
    allegroStan={...allegroStan,complianceAudit:{items:Array.isArray(d.items)?d.items:[],summary:d.summary||{},updated_at:d.updated_at||null,policy:d.policy||null}};
    if(fix)zaznaczoneAllegroZgodnosc.clear();
    const s=d.summary||{};toast(fix?`✅ Kontrola Allegro: naprawiono ${s.fixed||0}, pozostało ${s.remaining||0}`:`🛡️ Sprawdzono ${s.checked||0} ofert • naruszenia: ${s.violations||0}`);
  }catch(e){toast("⚠️ Kontrola zgodności: "+(e.message||e));}
  allegroZgodnoscBusy=false;renderuj();
}
function allegroSprawdzOferteZFormularza(form,fix=false){const id=String(new FormData(form).get("offerId")||"").trim();if(!id){toast("Wpisz ID oferty Allegro");return;}void allegroAudytujZgodnosc({offerId:id,fix});}
function allegroZgodnoscPanelHTML(){
  const audit=allegroStan.complianceAudit||{},all=Array.isArray(audit.items)?audit.items:[],items=allegroZgodnoscPozycje(),open=all.filter(x=>!x.ok).length,fixed=all.filter(x=>x.fixed).length,errors=all.filter(x=>x.error).length,selected=[...zaznaczoneAllegroZgodnosc].filter(id=>items.some(x=>String(x.offerId)===id));
  return `<div class="panel allegro-section-panel allegro-compliance-page">
    <div class="order-section-head"><div><span class="order-pro-label">Ochrona konta sprzedawcy</span><h2>🛡️ Zgodność ofert z zasadami Allegro</h2><p class="order-detail-lead">Każdy opis jest oczyszczany i sprawdzany przed utworzeniem albo aktualizacją oferty. Publikacja zostaje zablokowana, jeśli pozostanie zaproszenie do kontaktu, sprawdzania dostępności, negocjacji, dane kontaktowe lub odsyłacz poza Allegro.</p></div><button class="btn" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroAudytujZgodnosc({fix:true})">${allegroZgodnoscBusy?"⏳ Kontroluję…":"🛡️ Sprawdź i napraw 50 ofert"}</button></div>
    <div class="allegro-compliance-guard"><span>✅</span><div><b>Blokada przed publikacją jest zawsze włączona</b><small>Nie można jej wyłączyć ustawieniem. Korekta zachowuje układ opisu Allegro: sekcje, nagłówki, akapity, pogrubienia, listy, zdjęcia i ich kolejność. Usuwany jest wyłącznie niedozwolony fragment.</small></div></div>
    <div class="orders-stat-grid">${[["📋",all.length,"skontrolowanych"],["⚠️",open,"wymaga naprawy"],["✅",fixed,"naprawionych automatycznie"],["⛔",errors,"błędów API"]].map(([i,n,l])=>`<button class="order-stat-card stat-filter ${l.includes("wymaga")&&n?"hot":l.includes("naprawionych")?"money":""}" onclick="filtrAllegroZgodnosc=${jsArg(l.includes("wymaga")?"naruszenia":l.includes("naprawionych")?"naprawione":l.includes("błędów")?"bledy":"wszystkie")};renderuj()"><span>${i}</span><b>${n}</b><small>${l}</small></button>`).join("")}</div>
    <form class="allegro-compliance-single" onsubmit="event.preventDefault();allegroSprawdzOferteZFormularza(this,false)"><div><b>Sprawdź konkretną ofertę</b><small>Wklej ID z adresu oferty, np. 12212218115.</small></div><input name="offerId" inputmode="numeric" placeholder="ID oferty Allegro" required><button class="btn ghost" type="submit" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź</button><button class="btn" type="button" ${allegroZgodnoscBusy?"disabled":""} onclick="allegroSprawdzOferteZFormularza(this.form,true)">Sprawdź i napraw</button></form>
    <div class="orders-toolbar allegro-toolbar"><input placeholder="Szukaj: nazwa, ID, wykryty zwrot…" value="${esc(szukajAllegroZgodnosc)}" oninput="szukajAllegroZgodnosc=this.value;clearTimeout(window.__allegroComplianceSearch);window.__allegroComplianceSearch=setTimeout(()=>renderuj(),250)"><select onchange="filtrAllegroZgodnosc=this.value;renderuj()">${[["naruszenia","Wymaga naprawy"],["wszystkie","Wszystkie wyniki"],["naprawione","Naprawione"],["poprawne","Zgodne"],["bledy","Błędy API"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroZgodnosc===v?"selected":""}>${l}</option>`).join("")}</select><button class="btn ghost" onclick="allegroAudytujZgodnosc({fix:false})" ${allegroZgodnoscBusy?"disabled":""}>Sprawdź 50</button></div>
    <div class="allegro-compliance-bulk"><label class="check"><input type="checkbox" onchange='allegroZaznaczZgodnosc(${JSON.stringify(items.map(x=>String(x.offerId)))},this.checked)'> Zaznacz widoczne (${items.length})</label><span>${selected.length} zaznaczonych</span><button class="btn" ${!selected.length||allegroZgodnoscBusy?"disabled":""} onclick='allegroAudytujZgodnosc({fix:true,offerIds:${JSON.stringify(selected)}})'>Napraw zaznaczone</button></div>
    <div class="warehouse-worktable-wrap"><table class="log-table allegro-compliance-table"><tr><th></th><th>Oferta</th><th>Status</th><th>Wynik kontroli</th><th>Wykryte treści</th><th>Akcje</th></tr>${items.map(item=>`<tr class="${item.ok?"is-safe":"has-risk"}"><td><input type="checkbox" ${zaznaczoneAllegroZgodnosc.has(String(item.offerId))?"checked":""} onchange="allegroZaznaczZgodnosc([${jsArg(String(item.offerId))}],this.checked)"></td><td><b>${esc(item.name||"Oferta")}</b><small>ID ${esc(item.offerId||"—")} • ${esc(item.checkedAt?new Date(item.checkedAt).toLocaleString("pl-PL"):"—")}</small></td><td><span class="lvl ${item.error?"lvl-bad":item.ok?"lvl-ok":"lvl-ostrzezenie"}">${item.error?"błąd API":item.fixed?"naprawiona":item.ok?"zgodna":"blokada"}</span><small>${esc(item.status||"—")}</small></td><td><b>${item.ok?"Brak aktywnego naruszenia":"Wymaga oczyszczenia"}</b>${item.removedCount?`<small>Usunięto ${esc(item.removedCount)} fragmentów</small>`:""}${item.fixed&&item.layoutPreserved===true?`<small>✅ Układ Allegro zachowany</small>`:""}${item.error?`<small class="compliance-error">${esc(item.error)}</small>`:""}</td><td>${(item.violations||[]).map(v=>`<span class="compliance-rule"><b>${esc(v.label)}</b><small>${esc((v.matches||[]).join(" • "))}</small></span>`).join("")||"—"}</td><td><div class="warehouse-worktable-actions"><a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(item.offerId||"")}" target="_blank" rel="noopener">Oferta ↗</a>${!item.ok?`<button class="btn" onclick="allegroAudytujZgodnosc({fix:true,offerId:${jsArg(String(item.offerId))}})" ${allegroZgodnoscBusy?"disabled":""}>Napraw</button>`:""}</div></td></tr>`).join("")||`<tr><td colspan="6">Brak wyników dla wybranego filtra. Uruchom audyt aktywnych ofert.</td></tr>`}</table></div>
    <div class="allegro-compliance-rules"><div><b>Treści usuwane lub blokowane</b><span>kontakt przed zakupem • sprawdzanie dostępności • negocjacja ceny • e-mail • telefon • zewnętrzna strona • sprzedaż poza Allegro</span><small>Wygląd pozostaje w formacie edytora Allegro — korekta nie spłaszcza opisu do zwykłego tekstu.</small></div><div class="diag-actions"><a class="btn ghost" href="https://help.allegro.com/pl/sell/a/sprzedaz-poza-allegro-i-omijanie-oplat-aMloER9LrH8" target="_blank" rel="noopener">Oficjalna zasada ↗</a><a class="btn ghost" href="https://help.allegro.com/pl/sell/c/jak-wystawiac-oferty" target="_blank" rel="noopener">Zasady opisów ↗</a></div></div>
  </div>`;
}
function allegroSubnavHTML(aktywny="start"){
  const st=allegroKomunikacjaStaty();
  const aktywneZamowienia=(allegroZamowienia||[]).filter(statusAllegroRezerwujeMagazyn).length;
  const zadaniaWystawiania=allegroAktywneZadaniaAgentaOfert().length;
  const naruszenia=(allegroStan.complianceAudit?.items||[]).filter(x=>!x.ok).length;
  return adminSubnavHTML([
    {id:"start",href:"#/admin/allegro",label:"📊 Pulpit"},
    {id:"zamowienia",href:"#/admin/allegro/zamowienia",label:"📦 Zamówienia",badge:aktywneZamowienia||""},
    {id:"oferty",href:"#/admin/allegro/oferty",label:"🏷️ Oferty",badge:(allegroOferty||[]).length||""},
    {id:"wystawianie",href:"#/admin/allegro/wystawianie",label:"🟠 Wystawianie",badge:zadaniaWystawiania||""},
    {id:"rentownosc",href:"#/admin/allegro/rentownosc",label:"📈 Opłacalność"},
    {id:"wiadomosci",href:"#/admin/allegro/wiadomosci",label:"💬 Wiadomości",badge:st.threadNeed||""},
    {id:"dyskusje",href:"#/admin/allegro/dyskusje",label:"🛟 Dyskusje",badge:st.issueNeed||""},
    {id:"tabela",href:"#/admin/zamowienia/tabela",label:"📑 Tabela operacyjna"},
    {id:"zgodnosc",href:"#/admin/allegro/zgodnosc",label:"🛡️ Zgodność",badge:naruszenia||""},
    {id:"ustawienia",href:"#/admin/allegro/ustawienia",label:"⚙️ Ustawienia"}
  ],aktywny);
}
function allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete){
  const cfg={
    start:{ico:"🟠",kicker:"Centrum Allegro",title:"Pulpit integracji",opis:"Jedno miejsce do kontroli zamówień, katalogu ofert, wystawiania i komunikacji.",metryki:[["Połączenie",allegroStan.connected?"Aktywne":"Wymaga uwagi"],["Oferty",(allegroOferty||[]).length],["Zamówienia",(allegroZamowienia||[]).length]]},
    zamowienia:{ico:"📦",kicker:"Sprzedaż",title:"Kolejka zamówień Allegro",opis:"Status zawsze pochodzi z Allegro; agent osobno prowadzi sprawdzenie stanu, lokalizacji, zamówienie u producenta i kompletację.",metryki:[["Do obsługi",(allegroZamowienia||[]).filter(statusAllegroRezerwujeMagazyn).length],["Z brakami",(allegroZamowienia||[]).filter(z=>allegroEtapMagazynu(z)==="braki").length],["Zrealizowane lokalnie",(allegroZamowienia||[]).filter(z=>allegroZamowienieZrealizowaneLokalnie(z)&&!["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))).length]]},
    oferty:{ico:"🏷️",kicker:"Katalog Allegro",title:"Oferty i powiązania",opis:"Profesjonalny katalog ofert z miniaturą, identyfikatorami, ceną, stanem i kontrolą powiązania z produktem sklepu.",metryki:[["Wszystkie",(allegroOferty||[]).length],["Podpięte",mapped],["Do powiązania",niepodpiete]]},
    wystawianie:{ico:"🟠",kicker:"Publikowanie",title:"Przygotowanie ofert",opis:"Kontrola kompletności danych produktu przed utworzeniem bezpiecznego szkicu oferty.",metryki:[["Produkty",produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).length],["Gotowe",produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&!allegroBrakiProduktuDoWystawienia(p).length).length],["Do uzupełnienia",produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&allegroBrakiProduktuDoWystawienia(p).length).length]]},
    rentownosc:{ico:"📈",kicker:"Finanse produktu",title:"Opłacalność sklepu i Allegro",opis:"Dwa oddzielne modele kosztów, osobne cele marży i rekomendowane ceny. Allegro korzysta z prowizji pobieranej bezpośrednio przez API.",metryki:[["Pełne Allegro",produktyDoAdministracji().filter(allegroProduktMaPelneDaneMarzowe).length],["Bez prowizji",produktyDoAdministracji().filter(p=>!p.allegroFeeCalculatedAt).length],["Cele",`Sklep ${sklepDocelowaMarza}% • Allegro ${allegroDocelowaMarza}%`]]},
    wiadomosci:{ico:"💬",kicker:"Obsługa klienta",title:"Centrum wiadomości",opis:"Wyszukiwanie, filtry, historia korespondencji i wewnętrzne zamykanie spraw bez wysyłania wiadomości.",metryki:[["Wątki",allegroKomunikacjaStaty().threads.length],["Do odpowiedzi",allegroKomunikacjaStaty().threadNeed],["Załatwione",allegroKomunikacjaStaty().threads.filter(allegroKomunikacjaZalatwiona).length]]},
    dyskusje:{ico:"🛟",kicker:"Dyskusje i reklamacje",title:"Obsługa zgłoszeń Allegro",opis:"Oddzielny rejestr dyskusji i reklamacji z filtrami oficjalnego statusu oraz statusem wewnętrznym.",metryki:[["Zgłoszenia",allegroKomunikacjaStaty().issues.length],["Do odpowiedzi",allegroKomunikacjaStaty().issueNeed],["Załatwione",allegroKomunikacjaStaty().issues.filter(allegroKomunikacjaZalatwiona).length]]},
    zgodnosc:{ico:"🛡️",kicker:"Bezpieczeństwo sprzedaży",title:"Kontrola zgodności ofert",opis:"Stała blokada niedozwolonych treści przed publikacją oraz audyt i bezpieczna naprawa opisów już wystawionych ofert.",metryki:[["Skontrolowane",(allegroStan.complianceAudit?.items||[]).length],["Otwarte",(allegroStan.complianceAudit?.items||[]).filter(x=>!x.ok).length],["Naprawione",(allegroStan.complianceAudit?.items||[]).filter(x=>x.fixed).length]]},
    ustawienia:{ico:"⚙️",kicker:"Konfiguracja",title:"Ustawienia integracji Allegro",opis:"Połączenie OAuth, zakresy uprawnień, środowisko i kontrola synchronizacji w jednym miejscu.",metryki:[["API",allegroStan.configured?"OK":"Brak"],["OAuth",allegroStan.connected?"Połączone":"Rozłączone"],["Środowisko",allegroStan.env||"production"]]}
  }[aktywna]||{};
  return `<section class="panel allegro-workspace-section"><div class="allegro-workspace-title"><span>${cfg.ico||"🟠"}</span><div><small>${esc(cfg.kicker||"Allegro")}</small><h2>${esc(cfg.title||"Panel Allegro")}</h2><p>${esc(cfg.opis||"")}</p></div></div><div class="allegro-workspace-metrics">${(cfg.metryki||[]).map(([l,v])=>`<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join("")}</div></section>`;
}
function allegroStartPanelHTML(mapped,niepodpiete){
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div>
        <h2 style="margin-top:0">Panel Allegro</h2>
        <p class="order-detail-lead">Zamówienia są pobierane jako całe zlecenia. Każda pozycja jest łączona z aktualnym produktem sklepu po mapowaniu, EAN, SKU, kodzie producenta lub jednoznacznej nazwie, aby poprawnie sprawdzić magazyn, lokalizację i braki do zamówienia.</p>
      </div>
      <div class="diag-actions" style="margin-top:0">
        <a class="btn" href="#/admin/allegro/zamowienia">📦 Zamówienia Allegro</a>
        <a class="btn ghost" href="#/admin/allegro/oferty">🏷️ Mapuj oferty</a>
        <a class="btn ghost" href="#/admin/allegro/wystawianie">🟠 Wystaw produkt</a>
        <a class="btn ghost" href="#/admin/allegro/rentownosc">📈 Opłacalność</a>
        <a class="btn ghost" href="#/admin/allegro/wiadomosci">💬 Wiadomości</a>
        <a class="btn ghost" href="#/admin/allegro/dyskusje">🛟 Dyskusje</a>
        <a class="btn ghost" href="#/admin/allegro/zgodnosc">🛡️ Zgodność ofert</a>
      </div>
    </div>
    <div class="orders-stat-grid allegro-dashboard-links">
      <a class="order-stat-card stat-filter hot" href="#/admin/allegro/zamowienia" onclick="filtrAllegroZamowien='do_obslugi'"><span>📦</span><b>${(allegroZamowienia||[]).filter(statusAllegroRezerwujeMagazyn).length}</b><small>zamówień do obsługi</small></a>
      <a class="order-stat-card stat-filter" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='wszystkie'"><span>🏷️</span><b>${(allegroOferty||[]).length}</b><small>wszystkich ofert</small></a>
      <a class="order-stat-card stat-filter money" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='poprawne'"><span>🔗</span><b>${mapped}</b><small>poprawnie podpiętych</small></a>
      <a class="order-stat-card stat-filter ${niepodpiete?"hot":""}" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='niepodpiete'"><span>🧩</span><b>${niepodpiete}</b><small>ofert bez produktu</small></a>
      <a class="order-stat-card stat-filter" href="#/admin/allegro/wiadomosci" onclick="filtrAllegroWiadomosci='wymaga'"><span>💬</span><b>${allegroKomunikacjaStaty().threadNeed}</b><small>wiadomości do odpowiedzi</small></a>
      <a class="order-stat-card stat-filter" href="#/admin/allegro/dyskusje" onclick="filtrAllegroDyskusji='aktywne'"><span>🛟</span><b>${allegroKomunikacjaStaty().issues.length}</b><small>dyskusji i reklamacji</small></a>
    </div>
  </div>`;
}
function allegroPostepUstawienHTML(){
  const o=allegroOperacjaUstawien;
  if(!o.busy&&!o.done&&!o.error)return "";
  const pct=o.total?Math.round(o.done/o.total*100):0;
  return `<div class="allegro-settings-progress ${o.error?"has-error":""}"><div><b>${o.busy?`Aktualizuję istniejące oferty: ${o.done}/${o.total}`:o.error?"Aktualizacja przerwana":"Aktualizacja istniejących ofert zakończona"}</b><small>Stan zmieniony: ${o.stockUpdated} • błędy stanu: ${o.stockFailed} • wznawianie: ${o.republishUpdated} • starsze oferty do uzupełnienia: ${o.republishFailed}</small></div><div class="allegro-settings-progress-bar"><i style="width:${pct}%"></i></div>${o.error?`<p>${esc(o.error)}</p>`:""}</div>`;
}
async function allegroZastosujUstawieniaDoIstniejacych(){
  const ids=[...new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean))];
  allegroOperacjaUstawien={busy:true,done:0,total:ids.length,stockUpdated:0,stockFailed:0,republishUpdated:0,republishFailed:0,error:""};renderuj();
  try{
    for(let i=0;i<ids.length;i+=50){
      const batch=ids.slice(i,i+50),d=await chmura("allegro-apply-offer-defaults",{method:"POST",body:{offerIds:batch},timeout:180000});
      allegroOperacjaUstawien={...allegroOperacjaUstawien,done:i+batch.length,stockUpdated:allegroOperacjaUstawien.stockUpdated+Number(d.stockUpdated||0),stockFailed:allegroOperacjaUstawien.stockFailed+Number(d.stockFailed||0),republishUpdated:allegroOperacjaUstawien.republishUpdated+Number(d.republishUpdated||0),republishFailed:allegroOperacjaUstawien.republishFailed+Number(d.republishFailed||0)};
      renderuj();
    }
    const sync=await chmura("allegro-sync-offers",{method:"POST",body:{limit:10000,details:false},timeout:180000});
    allegroOferty=Array.isArray(sync.offers)?sync.offers:allegroOferty;allegroMapowania=sync.mappings||allegroMapowania;
    allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false};
    await allegroWczytajDane(true);allegroZapiszCache();toast(`✅ Stan ${allegroStanOfertyProduktu()} zapisany dla ${allegroOperacjaUstawien.stockUpdated} ofert`);renderuj();
  }catch(e){allegroOperacjaUstawien={...allegroOperacjaUstawien,busy:false,error:e.message||String(e)};toast("⚠️ Aktualizacja ofert: "+(e.message||e));renderuj();}
}
async function allegroZapiszUstawieniaOfert(form){
  const fd=new FormData(form),defaultStock=Number(fd.get("defaultStock")),applyExisting=fd.get("applyExisting")==="on";
  if(!Number.isInteger(defaultStock)||defaultStock<1||defaultStock>99999){toast("Podaj stan od 1 do 99999 szt.");return;}
  const producers=String(fd.get("producers")||"").split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).slice(0,50);
  if(!producers.length){toast("Dodaj przynajmniej jednego producenta.");return;}
  try{
    const d=await chmura("allegro-offer-settings",{method:"POST",body:{defaultStock,producers,autoCatalog:fd.get("autoCatalog")==="on",syncDescriptions:fd.get("syncDescriptions")==="on",autoUpdateOffers:fd.get("autoUpdateOffers")==="on",autoFees:fd.get("autoFees")==="on",autoCorrections:fd.get("autoCorrections")==="on"},timeout:12000});
    allegroStan={...allegroStan,offerSettings:d.settings||{defaultStock,republish:true}};
    toast(`Zapisano automatykę Allegro i ${producers.length} producentów.`);renderuj();
    if(applyExisting)await allegroZastosujUstawieniaDoIstniejacych();
  }catch(e){toast("⚠️ Ustawienia ofert Allegro: "+(e.message||e));}
}
async function allegroUruchomAutomatycznaKonserwacje(){
  try{toast("🟠 Agent sprawdza katalog, opisy i producentów…");const d=await chmura("allegro-auto-maintenance",{method:"POST",body:{limit:50},timeout:180000});await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true);const r=d.maintenance||{};toast(`✅ Sprawdzono ${r.scanned||0}, poprawiono ${r.updated||0}, katalog dopasowano dla ${r.matched||0} produktów.`);}catch(e){toast("⚠️ Automatyka katalogu Allegro: "+(e.message||e));}
}
function allegroProduktMaPelneDaneMarzowe(p={}){return kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))&&!!p.allegroFeeCalculatedAt;}
function allegroRentownoscLista(){
  const q=String(szukajAllegroRentownosc||"").toLowerCase().trim();let list=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>({p,r:allegroRentownoscProduktu(p)})).filter(({p,r})=>{if(q&&!`${p.nazwa||""} ${p.sku||""} ${p.gtin||p.ean||""} ${p.producent||""} ${p.kategoria||""}`.toLowerCase().includes(q))return false;if(filtrAllegroRentownosc==="kompletne"&&!r.dataComplete)return false;if(filtrAllegroRentownosc==="brak_prowizji"&&p.allegroFeeCalculatedAt)return false;if(filtrAllegroRentownosc==="strata"&&r.profit>=0)return false;if(filtrAllegroRentownosc==="niska"&&(!r.dataComplete||r.margin>=allegroDocelowaMarza))return false;if(filtrAllegroRentownosc==="oplacalne"&&(!r.dataComplete||r.margin<allegroDocelowaMarza))return false;return true;});
  list.sort((a,b)=>sortAllegroRentownosc==="marza_malejaco"?b.r.margin-a.r.margin:sortAllegroRentownosc==="nazwa"?String(a.p.nazwa).localeCompare(String(b.p.nazwa),"pl"):a.r.margin-b.r.margin);return list;
}
function produktDlaWyboruMarzy(productId){return produktyDoAdministracji().find(p=>String(p.id)===String(productId))||null;}
function wyborCenyMarzowejHTML(p={},kanal="allegro"){
  const isStore=kanal==="sklep",defaultTarget=isStore?sklepDocelowaMarza:allegroDocelowaMarza,savedTarget=Number(p[isStore?"sklepPriceTargetMargin":"allegroPriceTargetMargin"]),target=Math.max(.1,Math.min(75,Number.isFinite(savedTarget)&&savedTarget>0?savedTarget:defaultTarget)),r=isStore?sklepRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target),presets=[10,15,20,25,30],preset=presets.includes(target)?String(target):"custom";
  return `<div class="profit-price-picker ${isStore?"store":"allegro"}" data-profit-choice data-product-id="${esc(p.id)}" data-channel="${kanal}"><label>Wariant marży<select data-profit-margin-preset onchange="aktualizujWyborCenyMarzowej(this,'preset')">${presets.map(v=>`<option value="${v}" ${preset===String(v)?"selected":""}>${v}% marży</option>`).join("")}<option value="custom" ${preset==="custom"?"selected":""}>Własna marża</option></select></label><div class="profit-price-fields"><label>Marża %<input data-profit-margin type="number" min="0.1" max="75" step="0.1" value="${esc(target)}" oninput="aktualizujWyborCenyMarzowej(this,'margin')"></label><label>Cena zł<input data-profit-price inputmode="decimal" value="${r.recommended?esc(r.recommended.toFixed(2)):""}" oninput="aktualizujWyborCenyMarzowej(this,'price')"></label></div><small data-profit-choice-result>${r.recommended?`Wybrana marża ${target.toFixed(1)}% → ${zl(r.recommended)}`:"Uzupełnij cenę zakupu i koszty"}</small><button class="btn ${isStore?"ghost":""}" type="button" ${r.recommended?"":"disabled"} onclick="zastosujWyborCenyMarzowej(this)">${isStore?"🏪 Zastosuj w sklepie":"🟠 Opublikuj na Allegro"}</button></div>`;
}
function aktualizujWyborCenyMarzowej(el,source="margin"){
  const box=el?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId);if(!p)return;
  const kanal=box.dataset.channel==="sklep"?"sklep":"allegro",preset=box.querySelector("[data-profit-margin-preset]"),marginInput=box.querySelector("[data-profit-margin]"),priceInput=box.querySelector("[data-profit-price]"),result=box.querySelector("[data-profit-choice-result]"),button=box.querySelector("button");
  if(source==="preset"){if(preset.value!=="custom")marginInput.value=preset.value;else marginInput.focus();}
  if(source==="margin")preset.value="custom";
  const target=Math.max(.1,Math.min(75,Number(String(marginInput.value).replace(",","."))||0));
  if(source!=="price"){const recommendation=kanal==="sklep"?sklepRentownoscProduktu(p,null,target):allegroRentownoscProduktu(p,null,target);priceInput.value=recommendation.recommended?recommendation.recommended.toFixed(2):"";}
  const price=kwotaNum(priceInput.value),actual=kanal==="sklep"?sklepRentownoscProduktu(p,price,target):allegroRentownoscProduktu(p,price,target);
  result.textContent=price?`Cena ${zl(price)} • zysk ${zl(actual.profit)} • rzeczywista marża ${actual.margin.toFixed(2)}%`:"Wpisz marżę albo własną cenę";button.disabled=!price||kwotaNum(p.cenaZakupu)<=0;
}
async function zastosujWyborCenyMarzowej(button){
  const box=button?.closest?.("[data-profit-choice]");if(!box)return;const p=produktDlaWyboruMarzy(box.dataset.productId),kanal=box.dataset.channel==="sklep"?"sklep":"allegro",price=kwotaNum(box.querySelector("[data-profit-price]")?.value);if(!p||!price){toast("Uzupełnij prawidłową cenę");return;}
  const calculation=kanal==="sklep"?sklepRentownoscProduktu(p,price):allegroRentownoscProduktu(p,price);button.disabled=true;button.textContent=kanal==="sklep"?"⏳ Zapisuję…":"⏳ Publikuję…";try{await ustawRekomendowanaCeneProduktu(p.id,kanal,price,calculation.margin);}catch(e){toast("⚠️ Nie udało się zastosować ceny: "+(e.message||e));button.disabled=false;}
}
function allegroScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"allegro");}
function allegroRentownoscPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),complete=all.filter(allegroProduktMaPelneDaneMarzowe),rows=allegroRentownoscLista(),loss=complete.filter(p=>allegroRentownoscProduktu(p).profit<0).length,low=complete.filter(p=>{const r=allegroRentownoscProduktu(p);return r.profit>=0&&r.margin<allegroDocelowaMarza;}).length,good=complete.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length;
  return `<div class="panel allegro-section-panel profitability-page"><div class="order-section-head"><div><span class="order-pro-label">Decyzje cenowe</span><h2>📈 Opłacalność i wyliczenie marżowe</h2><p class="order-detail-lead">Zaawansowany przelicznik dla gier i pozostałych produktów z ceną zakupu, ceną sprzedaży oraz prowizją pobraną z Allegro. Rozdziela prowizję sprzedażową, opłaty cykliczne, reklamę, pakowanie, dopłatę do dostawy i inne koszty.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Pobierz prowizje dla kompletnych produktów</button></div><div class="orders-stat-grid"><div class="order-stat-card"><span>🧮</span><b>${complete.length}</b><small>pełnych kalkulacji</small></div><div class="order-stat-card ${loss?"hot":""}"><span>🔴</span><b>${loss}</b><small>sprzedaż ze stratą</small></div><div class="order-stat-card ${low?"hot":""}"><span>🟡</span><b>${low}</b><small>poniżej celu ${allegroDocelowaMarza}%</small></div><div class="order-stat-card money"><span>🟢</span><b>${good}</b><small>osiąga cel marży</small></div></div><div class="profitability-controls"><input placeholder="Szukaj: nazwa, SKU, EAN, producent, kategoria…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="filtrAllegroRentownosc=this.value;renderuj()">${[["kompletne","Pełne dane"],["wszystkie","Wszystkie produkty"],["brak_prowizji","Brak pobranej prowizji"],["strata","Sprzedaż ze stratą"],["niska","Marża poniżej celu"],["oplacalne","Osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>Cel marży <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="allegroDocelowaMarza=Math.max(1,Math.min(60,Number(this.value)||20));renderuj()">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div><div class="profitability-guide"><b>Jak czytać wynik?</b><span><i class="green"></i> marża osiąga cel</span><span><i class="yellow"></i> dodatni wynik poniżej celu</span><span><i class="red"></i> strata</span><small>Rekomendacja jest oparta na aktualnej procentowej prowizji. Po zmianie ceny pobierz prowizję ponownie, ponieważ Allegro może stosować progi lub stawki minimalne.</small></div><div class="warehouse-worktable-wrap"><table class="log-table profitability-table"><tr><th>Produkt</th><th>Dane wejściowe</th><th>Prowizja i koszty</th><th>Wynik</th><th>Rekomendowana cena</th><th>Akcje</th></tr>${rows.slice(0,500).map(({p,r})=>{const offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||"");const cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit";return `<tr class="${cls}"><td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small>${!r.dataComplete?`<em>Brakuje: ${[!p.cenaZakupu?"ceny zakupu":"",!p.allegroFeeCalculatedAt?"prowizji Allegro":"",!(p.allegroOfferId||p.allegroCategoryId)?"danych oferty":""].filter(Boolean).join(", ")}</em>`:""}</div></div></td><td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Cena Allegro</small><b>${r.price?zl(r.price):"—"}</b></td><td><small>Prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"}</b><br><small>Pozostałe / szt.</small><b>${zl(r.recurringPerUnit+r.packing+r.other+r.shipping+r.ads)}</b>${p.allegroFeeCalculatedAt&&!r.feeCurrent?`<br><span class="lvl lvl-ostrzezenie">przelicz dla nowej ceny</span>`:""}</td><td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"} • narzut ${r.dataComplete?r.markup.toFixed(2)+"%":"—"}</small><em>próg: ${r.breakEven?zl(r.breakEven):"—"}</em></span></td><td><b>${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></td><td><div class="warehouse-worktable-actions"><button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">🟠 Prowizja</button>${r.recommended?`<button class="btn" onclick="allegroUstawRekomendowanaCene(${jsArg(p.id)},${r.recommended})">Ustaw ${zl(r.recommended)}</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6">Brak produktów pasujących do filtrów.</td></tr>`}</table></div><div class="backend-note allegro-info-bottom"><b>Ważne:</b> kalkulator pokazuje rentowność operacyjną jednej sztuki przed podatkiem dochodowym. VAT jest zapisany w kartotece jako informacja do dalszych rozszerzeń księgowych; wynik korzysta z faktycznych kwot sprzedaży, zakupu i opłat podanych w panelu.</div></div>`;
}
function sklepScenariuszeMarzyHTML(p={}){return wyborCenyMarzowejHTML(p,"sklep");}
function rentownoscKanalowaPanelHTML(){
  const all=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),rows=allegroRentownoscLista();
  const sklepPelne=all.filter(p=>sklepRentownoscProduktu(p).dataComplete),allegroPelne=all.filter(allegroProduktMaPelneDaneMarzowe);
  const sklepCel=sklepPelne.filter(p=>sklepRentownoscProduktu(p).margin>=sklepDocelowaMarza).length,allegroCel=allegroPelne.filter(p=>allegroRentownoscProduktu(p).margin>=allegroDocelowaMarza).length;
  return `<div class="panel allegro-section-panel profitability-page">
    <div class="order-section-head"><div><span class="order-pro-label">Dwa niezależne kanały</span><h2>📈 Opłacalność: sklep i Allegro</h2><p class="order-detail-lead">Cena, koszty, cel marży i rekomendacja są liczone osobno. Ustawienie ceny sklepu zmienia kartę sklepu, a ustawienie ceny Allegro zapisuje cenę i od razu aktualizuje powiązaną ofertę oraz prowizję.</p></div><button class="btn" onclick="allegroPobierzProwizjeMasowo()">🟠 Odśwież prowizje Allegro</button></div>
    <div class="profit-channel-summary"><article class="store"><span>🏪</span><div><small>Sklep internetowy</small><b>${sklepCel}/${sklepPelne.length} osiąga cel ${sklepDocelowaMarza}%</b></div></article><article class="allegro"><span>🟠</span><div><small>Allegro</small><b>${allegroCel}/${allegroPelne.length} osiąga cel ${allegroDocelowaMarza}%</b></div></article></div>
    ${domyslneUstawieniaRentownosciHTML()}
    <div class="profitability-controls"><input placeholder="Szukaj: nazwa, SKU, EAN, producent…" value="${esc(szukajAllegroRentownosc)}" oninput="szukajAllegroRentownosc=this.value;clearTimeout(window.__profitSearch);window.__profitSearch=setTimeout(()=>renderuj(),280)"><select onchange="filtrAllegroRentownosc=this.value;renderuj()">${[["kompletne","Pełne dane Allegro"],["wszystkie","Wszystkie produkty"],["brak_prowizji","Brak prowizji Allegro"],["strata","Strata na Allegro"],["niska","Allegro poniżej celu"],["oplacalne","Allegro osiąga cel"]].map(([v,l])=>`<option value="${v}" ${filtrAllegroRentownosc===v?"selected":""}>${l}</option>`).join("")}</select><select onchange="sortAllegroRentownosc=this.value;renderuj()"><option value="marza_rosnaco" ${sortAllegroRentownosc==="marza_rosnaco"?"selected":""}>Najniższa marża Allegro</option><option value="marza_malejaco" ${sortAllegroRentownosc==="marza_malejaco"?"selected":""}>Najwyższa marża Allegro</option><option value="nazwa" ${sortAllegroRentownosc==="nazwa"?"selected":""}>Nazwa A–Z</option></select><label>🏪 Cel sklepu <input type="number" min="1" max="60" value="${esc(sklepDocelowaMarza)}" onchange="ustawCelMarzy('sklep',this.value)">%</label><label>🟠 Cel Allegro <input type="number" min="1" max="60" value="${esc(allegroDocelowaMarza)}" onchange="ustawCelMarzy('allegro',this.value)">%</label><label>Opłatę cykliczną podziel na <input type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}" onchange="allegroJednostkiOplatCyklicznych=Math.max(1,Number(this.value)||10);renderuj()"> szt.</label></div>
    <div class="warehouse-worktable-wrap"><table class="log-table profitability-table profitability-channel-table"><tr><th>Produkt</th><th>Zakup i ceny</th><th>🏪 Sklep</th><th>🟠 Allegro</th><th>Rekomendacje kanałów</th><th>Akcje</th></tr>${rows.slice(0,500).map(({p,r})=>{const s=sklepRentownoscProduktu(p),offerId=String(p.allegroOfferId||allegroOfertaDlaProduktuSklepu(p)?.id||""),cls=!r.dataComplete?"incomplete":r.profit<0?"loss":r.margin<allegroDocelowaMarza?"warning":"profit";return `<tr class="${cls}"><td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • ${esc(p.producent||"producent —")}</small></div></div></td><td><small>Zakup</small><b>${p.cenaZakupu?zl(p.cenaZakupu):"—"}</b><br><small>Sklep</small><b>${p.cena?zl(p.cena):"—"}</b><br><small>Allegro</small><b>${r.price?zl(r.price):"—"}</b></td><td><span class="profitability-result ${s.profit<0?"loss":s.margin<sklepDocelowaMarza?"warning":"profit"}"><b>${s.dataComplete?zl(s.profit):"—"}</b><small>marża ${s.dataComplete?s.margin.toFixed(2)+"%":"—"}</small><em>próg ${s.breakEven?zl(s.breakEven):"—"}</em></span><small>Płatność ${s.paymentRate.toFixed(2)}% • inne ${zl(s.other)}</small></td><td><span class="profitability-result ${cls}"><b>${r.dataComplete?zl(r.profit):"—"}</b><small>marża ${r.dataComplete?r.margin.toFixed(2)+"%":"—"}</small><em>próg ${r.breakEven?zl(r.breakEven):"—"}</em></span><small>Prowizja ${p.allegroFeeCalculatedAt?`${zl(r.commission)} (${r.commissionRate.toFixed(2)}%)`:"—"} • wysyłka ${zl(r.shipping)}</small></td><td><div class="profit-recommendation-channel"><b>🏪 ${s.recommended?zl(s.recommended):"—"}</b><div class="profit-scenarios">${sklepScenariuszeMarzyHTML(p)}</div></div><div class="profit-recommendation-channel allegro"><b>🟠 ${r.recommended?zl(r.recommended):"—"}</b><div class="profit-scenarios">${allegroScenariuszeMarzyHTML(p)}</div></div></td><td><div class="warehouse-worktable-actions">${s.recommended?`<button class="btn ghost" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'sklep',${s.recommended})">Ustaw sklep ${zl(s.recommended)}</button>`:""}${r.recommended?`<button class="btn" onclick="ustawRekomendowanaCeneProduktu(${jsArg(p.id)},'allegro',${r.recommended})">Ustaw Allegro ${zl(r.recommended)}</button>`:""}<button class="btn ghost" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">Prowizja</button><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">Edytuj</a>${offerId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(offerId)}" target="_blank" rel="noopener">Oferta ↗</a>`:""}</div></td></tr>`;}).join("")||`<tr><td colspan="6">Brak produktów pasujących do filtrów.</td></tr>`}</table></div>
    <div class="backend-note allegro-info-bottom"><b>Automatyka:</b> dopłata do wysyłki Allegro wynosi domyślnie 3,00 zł. Po ustawieniu ceny Allegro system aktualizuje istniejącą ofertę przez API i ponownie pobiera kalkulację opłat; cena sklepu pozostaje niezależna.</div>
  </div>`;
}
function allegroUstawieniaPanelHTML(){
  const offerStock=allegroStanOfertyProduktu(),audit=Object.values(allegroStan.offerDefaultsAudit?.items||{}),auditOpen=audit.filter(x=>!x.stockUpdated||!x.republishUpdated).length,offerSettings=allegroStan.offerSettings||{},maintenance=allegroStan.catalogMaintenance||{};
  return `<div class="panel allegro-section-panel">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">⚙️ Ustawienia integracji Allegro</h2><p class="order-detail-lead">Konfiguracja techniczna znajduje się na końcu podkart, żeby nie przeszkadzała w codziennej obsłudze zamówień i ofert.</p></div>
      <div class="diag-actions"><button class="btn" onclick="allegroPolacz()">🔐 Połącz Allegro ponownie</button><button class="btn ghost" onclick="allegroWczytajDane()">📥 Sprawdź połączenie</button></div>
    </div>
    <div class="orders-stat-grid">
      <div class="order-stat-card ${allegroStan.configured?"money":"hot"}"><span>🔧</span><b>${allegroStan.configured?"OK":"BRAK"}</b><small>konfiguracja aplikacji</small></div>
      <div class="order-stat-card ${allegroStan.connected?"money":"hot"}"><span>🔐</span><b>${allegroStan.connected?"TAK":"NIE"}</b><small>autoryzacja OAuth</small></div>
      <div class="order-stat-card"><span>🌐</span><b>${esc(allegroStan.env||"production")}</b><small>środowisko Allegro</small></div>
      <div class="order-stat-card ${allegroStan.requiresReauth?"hot":"money"}"><span>${allegroStan.requiresReauth?"⚠️":"✅"}</span><b>${allegroStan.requiresReauth?"ODŚWIEŻ":"PEŁNE"}</b><small>zakresy uprawnień</small></div>
    </div>
    <form class="panel-subtle allegro-offer-settings-card" onsubmit="event.preventDefault();allegroZapiszUstawieniaOfert(this)">
      <div class="order-section-head"><div><h3 style="margin:0">📦 Domyślny stan i odnawianie ofert</h3><p class="order-detail-lead">Ta liczba trafia do każdej nowej i aktualizowanej oferty Allegro. Jest niezależna od fizycznego stanu magazynu.</p></div><button class="btn" type="submit" ${allegroOperacjaUstawien.busy?"disabled":""}>💾 Zapisz ustawienie</button></div>
      <div class="allegro-offer-settings-grid"><div class="f-group"><label>Domyślny stan każdej oferty Allegro</label><input name="defaultStock" type="number" min="1" max="99999" step="1" required value="${offerStock}"><small>Obecnie: ${offerStock} szt. Cena i stan magazynu pozostają niezależne.</small></div><div class="allegro-renewal-status"><span>♻️</span><div><b>Automatyczne wznawianie: zawsze włączone</b><small>Nowe i aktualizowane oferty otrzymują ustawienie ponownego wystawienia.</small></div></div></div>
      <div class="f-group" style="margin-top:.85rem"><label>Dozwoleni producenci — po jednym wierszu</label><textarea name="producers" rows="4" required>${esc(allegroListaProducentow().join("\n"))}</textarea><small>Agent przypisuje wyłącznie producentów z tej listy. Rozpoznane nazwy „Origami 3D” i produkty ze sklep.alexander.com.pl są normalizowane do Alexander.</small></div>
      <div class="diag-actions" style="align-items:flex-start"><label class="check"><input type="checkbox" name="autoCatalog" ${offerSettings.autoCatalog!==false?"checked":""}> Automatycznie dobieraj katalog i kategorię</label><label class="check"><input type="checkbox" name="syncDescriptions" ${offerSettings.syncDescriptions!==false?"checked":""}> Automatycznie poprawiaj krótki opis, pełny opis i układ</label><label class="check"><input type="checkbox" name="autoUpdateOffers" ${offerSettings.autoUpdateOffers!==false?"checked":""}> Aktualizuj powiązaną ofertę przy zapisie i konserwacji</label><label class="check"><input type="checkbox" name="autoFees" ${offerSettings.autoFees!==false?"checked":""}> Pobieraj prowizję i opłaty po aktualizacji</label><label class="check"><input type="checkbox" name="autoCorrections" ${offerSettings.autoCorrections!==false?"checked":""}> Kwarantanna błędnych powiązań</label></div>
      <label class="check allegro-apply-existing"><input type="checkbox" name="applyExisting"> Po zapisaniu ustaw również nowy stan i wznawianie we wszystkich ${allegroOferty.length} istniejących ofertach</label>
      ${audit.length?`<small>Ostatni audyt: ${audit.length-auditOpen} bez problemu • ${auditOpen} starszych ofert wymaga uzupełnienia danych przed włączeniem wznawiania.</small>`:""}
    </form>
    ${allegroPostepUstawienHTML()}
    <div class="allegro-config-note">
      <b>Zmienne serwera Netlify</b>
      <span>Wymagane: <code>ALLEGRO_CLIENT_ID</code>, <code>ALLEGRO_CLIENT_SECRET</code>. Opcjonalne: <code>ALLEGRO_REDIRECT_URI</code>, <code>ALLEGRO_ENV</code>, <code>ALLEGRO_SCOPE</code>.</span>
      <span>Tokeny i sekrety pozostają wyłącznie na serwerze. Nie są zapisywane w przeglądarce ani w publicznych plikach strony.</span>
      <span>Ostatnia synchronizacja: ${esc(allegroStan.updated_at||"—")}</span>
      ${allegroStan.requiresReauth?`<span style="color:#9a3412"><b>Brakujące zakresy:</b> ${esc((allegroStan.missingAuthorizedScopes||[]).join(", ")||"token wymaga ponownej autoryzacji")}. Kliknij „Połącz Allegro ponownie”.</span>`:""}
    </div>
    <div class="panel-subtle" style="margin-top:1rem">
      <div class="order-section-head"><div><h3 style="margin:0">🔄 Automatyczna synchronizacja danych</h3><p class="order-detail-lead">Synchronizacja działa na serwerze także wtedy, gdy panel jest zamknięty. Zamówienia i komunikacja są sprawdzane co 15 minut, a pełny katalog ofert co 6 godzin.</p></div><button class="btn" onclick="allegroSynchronizujWszystko()">Synchronizuj wszystko teraz</button></div>
      <div class="allegro-schedule-grid"><span><b>📦 Zamówienia</b><small>automatycznie co 15 minut</small></span><span><b>💬 Wiadomości</b><small>automatycznie co 15 minut</small></span><span><b>🏷️ Oferty</b><small>automatycznie co 6 godzin</small></span></div>
      <div class="backend-note allegro-info-bottom"><b>Automatyczna konserwacja katalogu:</b> ${maintenance.lastRun?`ostatnio ${esc(new Date(maintenance.lastRun).toLocaleString("pl-PL"))} • sprawdzono ${esc(maintenance.scanned||0)} • poprawiono ${esc(maintenance.updated||0)}`:"uruchomi się wraz z najbliższą synchronizacją ofert"}. Obejmuje katalog, kategorię, producenta, opis i kontrolę błędnych powiązań.</div>
      <details class="allegro-manual-sync"><summary>Zaawansowane: uruchom tylko wybraną synchronizację</summary><div class="diag-actions"><button class="btn ghost" onclick="allegroSynchronizujZamowienia()">Zamówienia</button><button class="btn ghost" onclick="allegroSynchronizujOferty()">Oferty</button><button class="btn ghost" onclick="allegroUruchomAutomatycznaKonserwacje()">Katalog, opisy i producenci</button><button class="btn ghost" onclick="allegroSynchronizujKomunikacje(false)">Komunikacja</button><button class="btn ghost" onclick="window.open('https://salescenter.allegro.com/my-sales','_blank','noopener')">Otwórz Sales Center</button></div></details>
    </div>
  </div>`;
}
function widokAdminAllegro(sekcja="start"){
  allegroLadujJesliTrzeba();
  if(["wiadomosci","dyskusje"].includes(sekcja)&&!allegroKomunikacja?.updated_at&&!allegroKomunikacja?.sprawdzono&&!allegroStan.ladowanie) setTimeout(()=>allegroWczytajKomunikacje(true),0);
  if(["wiadomosci","dyskusje"].includes(sekcja)) setTimeout(()=>allegroAktywujKafelkiKomunikacji(sekcja==="dyskusje"?"issue":"thread"),0);
  const mapped=(allegroOferty||[]).filter(o=>allegroProduktDlaOferty(o.id)).length;
  const niepodpiete=Math.max(0,(allegroOferty||[]).length-mapped);
  const aktywna=["zamowienia","oferty","wystawianie","rentownosc","wiadomosci","dyskusje","zgodnosc","ustawienia"].includes(sekcja)?sekcja:"start";
  return adminSzkielet("/admin/allegro", `
  <div class="module-page-stack allegro-module-page">
  ${allegroSubnavHTML(aktywna)}
  ${aktywna==="zamowienia"?allegroZamowieniaTabelaHTML():aktywna==="oferty"?allegroOfertyTabelaHTML():aktywna==="wystawianie"?allegroWystawianiePanelHTML():aktywna==="rentownosc"?rentownoscKanalowaPanelHTML():aktywna==="wiadomosci"?allegroKomunikacjaPanelHTML("thread"):aktywna==="dyskusje"?allegroKomunikacjaPanelHTML("issue"):aktywna==="zgodnosc"?allegroZgodnoscPanelHTML():aktywna==="ustawienia"?allegroUstawieniaPanelHTML():allegroStartPanelHTML(mapped,niepodpiete)}
  ${allegroStan.error?`<div class="backend-note allegro-info-bottom" style="border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Allegro:</b> ${esc(allegroStan.error)}</div>`:""}
  ${allegroWorkspaceSectionHTML(aktywna,mapped,niepodpiete)}
  </div>
  `);
}
function decyzjaDostepnosciZamowieniaInfo(z={}){
  const d=z.decyzjaDostepnosci&&typeof z.decyzjaDostepnosci==="object"?z.decyzjaDostepnosci:{},expiresMs=Date.parse(d.expiresAt||""),expired=String(d.code||"").startsWith("wait_")&&Number.isFinite(expiresMs)&&expiresMs<=Date.now();
  const labels={confirmed:"✅ dostępność potwierdzona",wait_1:"⏳ oczekiwanie 1 dzień",wait_2:"⏳ oczekiwanie 2 dni",contact_client:"📞 skontaktować się z klientem",unavailable:"⛔ brak — decyzja o realizacji",reset:"🔎 wymaga ponownej kontroli"};
  return {...d,expired,label:expired?"⏰ minął termin decyzji":labels[d.code]||"brak zapisanej decyzji"};
}
async function ustawDecyzjeDostepnosciZamowienia(nr,code){
  const lista=pobierzZamowienia(),z=lista.find(x=>String(x.nr)===String(nr));if(!z)return;
  const now=new Date(),days=code==="wait_1"?1:code==="wait_2"?2:0,previous=decyzjaDostepnosciZamowieniaInfo(z),labels={confirmed:"Dostępność potwierdzona",wait_1:"Oczekiwanie na potwierdzenie — 1 dzień",wait_2:"Oczekiwanie na potwierdzenie — 2 dni",contact_client:"Brak pewności — skontaktować się z klientem",unavailable:"Brak dostępności potwierdzony",reset:"Ponowna kontrola dostępności"};
  z.decyzjaDostepnosci={code,label:labels[code]||code,at:now.toISOString(),expiresAt:days?new Date(now.getTime()+days*86400000).toISOString():null,operator:sesja?.email||"administrator",history:[{code,at:now.toISOString(),operator:sesja?.email||"administrator"},...(previous.history||[])].slice(0,20)};
  z.wymagaPotwierdzeniaDostepnosci=["wait_1","wait_2","reset"].includes(code);
  zapiszLS("artway_zamowienia",lista);zapiszHistorieAgenta("decyzja-zamowienia",`Zamówienie ${nr}: ${labels[code]||code}`,{nr,code,expiresAt:z.decyzjaDostepnosci.expiresAt});renderuj();
  try{await zapiszZamowienieCentralnie(z,false);toast(`✅ Zapisano decyzję dla zamówienia ${nr}`);}catch(e){toast(`⚠️ Decyzja lokalna zapisana, synchronizacja: ${e.message||e}`);}renderuj();
}
function zastosujWyborDecyzjiZamowienia(nr){const el=document.querySelector(`[data-order-availability-decision="${CSS.escape(String(nr))}"]`);if(el)void ustawDecyzjeDostepnosciZamowienia(nr,el.value);}
function alertDostepnosciZamowieniaHTML(z){
  const lista=Array.isArray(z?.dostepnoscDoPotwierdzenia)?z.dostepnoscDoPotwierdzenia:[];
  const decision=decyzjaDostepnosciZamowieniaInfo(z);
  if(!z?.wymagaPotwierdzeniaDostepnosci&&!lista.length&&!decision.code)return "";
  const txt=lista.length?lista.map(x=>`${esc(x.nazwa||"Produkt")} × ${esc(x.ilosc||"")}`).join(", "):"większa ilość produktów";
  return `<div class="order-availability-decision ${decision.expired?"is-overdue":""}"><div><b>${z.wymagaPotwierdzeniaDostepnosci?"⚠️ Potwierdzić dostępność przed realizacją":"🧭 Decyzja dostępności"}</b><p>${txt}</p><small>${esc(decision.label)}${decision.expiresAt?` • termin ${esc(new Date(decision.expiresAt).toLocaleString("pl-PL"))}`:""}${decision.operator?` • ${esc(decision.operator)}`:""}</small></div><div><select data-order-availability-decision="${esc(z.nr)}"><option value="confirmed">✅ Potwierdź pełną dostępność</option><option value="wait_1">⏳ Poczekaj na producenta 1 dzień</option><option value="wait_2">⏳ Poczekaj na producenta 2 dni</option><option value="contact_client">📞 Brak pewności — kontakt z klientem</option><option value="unavailable">⛔ Potwierdzony brak produktu</option><option value="reset">🔎 Wróć do kontroli</option></select><button class="btn" type="button" onclick="zastosujWyborDecyzjiZamowienia(${jsArg(z.nr)})">Zapisz decyzję</button></div></div>`;
}
function kartaAdminZamowieniaHTML(z){
  const k=kosztyZamowienia(z), w=daneWysylki(z), klient=klientZamowieniaLabel(z);
  const zaznaczone=zaznaczoneZamowieniaSklepu.has(String(z.nr));
  const pozycje=Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
    ? z.pozycjeDane.map(p=>`${p.ilosc||1} × ${p.nazwa||p.produkt||p.id||"produkt"}${p.wariant?` (${p.wariant})`:""} — ${zl(p.wartosc||kwotaNum(p.cena)*(Number(p.ilosc)||1))}`)
    : (Array.isArray(z.pozycje)?z.pozycje:["brak pozycji"]);
  const tracking=w.numer?`${nazwaPrzewoznika(w.przewoznik||"inpost")}: ${w.numer}`:(w.inpostId?`InPost ID ${w.inpostId} — ${w.inpostStatus||"czeka na numer"}`:"bez numeru nadania");
  const platnosc=z.platnosc||dostepnePlatnosci().find(p=>p.id===z.platnoscId)?.nazwa||"—";
  return `<article class="order-pro-card ${zaznaczone?"is-selected":""}">
    <div class="order-pro-top">
      <div class="order-pro-title-row">
        <label class="order-bulk-check" title="Zaznacz całe zamówienie"><input type="checkbox" ${zaznaczone?"checked":""} onchange="adminPrzelaczZaznaczenieZamowienia(${jsArg(z.nr)},this.checked)"></label>
        <div><a class="order-pro-number" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">${esc(z.nr)}</a>
        <div class="order-pro-muted">${esc(z.data||"")} • ${esc(klient)} ${z.wymagaPotwierdzeniaDostepnosci?'<span class="lvl lvl-ostrzezenie">sprawdź dostępność</span>':""}</div></div>
      </div>
      <div class="order-pro-right">
        <select onchange="zmienStatus(${jsArg(z.nr)}, this.value)" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">
          ${STATUSY.map(s=>`<option value="${esc(s)}" ${s===z.status?"selected":""}>${esc(s)}</option>`).join("")}
        </select>
        <b>${zl(k.razem)}</b>
      </div>
    </div>
    <div class="order-pro-grid">
      <div class="order-pro-section">
        <span class="order-pro-label">Produkty</span>
        <p>${pozycje.slice(0,3).map(p=>esc(p)).join("<br>")}${pozycje.length>3?`<br><span style="color:var(--muted2)">+ ${pozycje.length-3} kolejnych pozycji</span>`:""}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Klient</span>
        <p>${z.email?`✉️ ${esc(z.email)}`:"👤 gość"}${z.klient?.telefon?`<br>📞 ${esc(z.klient.telefon)}`:""}${z.klient?.firma?`<br>🏢 ${esc(z.klient.firma)}`:""}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Dostawa</span>
        <p>🚚 ${esc(z.dostawa||uslugaInpostZamowienia(z))}<br>💰 ${k.dostawa?zl(k.dostawa):"GRATIS"}${k.paczkaWeekend?` + Weekend ${zl(k.paczkaWeekend)}`:""}<br>🏷️ ${esc(tracking)}</p>
      </div>
      <div class="order-pro-section">
        <span class="order-pro-label">Płatność i adres</span>
        <p>💳 ${esc(platnosc)}${k.platnosc?` + ${zl(k.platnosc)}`:""}<br>📍 ${esc(z.adres||"brak adresu")}</p>
      </div>
    </div>
    ${alertDostepnosciZamowieniaHTML(z)}
    <div class="order-pro-bottom">
      <div class="order-pro-costs">
        <span>Produkty <b>${zl(k.poRabacie||k.produkty)}</b></span>
        <span>Dostawa <b>${k.dostawa?zl(k.dostawa):"GRATIS"}</b></span>
        ${k.paczkaWeekend?`<span>Weekend <b>${zl(k.paczkaWeekend)}</b></span>`:""}
        ${k.platnosc?`<span>Płatność <b>${zl(k.platnosc)}</b></span>`:""}
      </div>
      <div class="diag-actions">
        <a class="btn" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Obsłuż</a>
        <a class="btn ghost" href="#/admin/wysylki">Centrum wysyłek</a>
        <button class="btn ghost" onclick="drukujZamowienie(${jsArg(z.nr)})">🖨️ Druk</button>
        <button class="ci-remove" onclick="if(confirm('Usunąć zamówienie ${esc(z.nr)}?')) usunZamowienie(${jsArg(z.nr)})" title="Usuń zamówienie">🗑️</button>
      </div>
    </div>
  </article>`;
}
function adminPozycjeZamowieniaHTML(z){
  const dane=Array.isArray(z?.pozycjeDane)?z.pozycjeDane:[];
  if(dane.length){
    return `<div class="order-items-pro">${dane.map(p=>{
      const nazwa=p.nazwa||p.produkt||p.id||"produkt", il=Number(p.ilosc)||1, cena=kwotaNum(p.cena), wartosc=kwotaNum(p.wartosc||(cena*il));
      return `<div class="order-item-pro">
        <div><b>${esc(nazwa)}</b>${p.wariant?`<small>Wariant: ${esc(p.wariant)}</small>`:""}${p.sku?`<small>SKU: ${esc(p.sku)}</small>`:""}</div>
        <span>${il} × ${cena?zl(cena):"—"}</span>
        <strong>${zl(wartosc)}</strong>
      </div>`;
    }).join("")}</div>`;
  }
  const tekstowe=Array.isArray(z?.pozycje)?z.pozycje:[];
  return `<div class="order-items-pro">${tekstowe.length?tekstowe.map(p=>`<div class="order-item-pro"><div><b>${esc(p)}</b></div></div>`).join(""):`<div class="order-item-pro"><div><b>Brak pozycji w zamówieniu</b></div></div>`}</div>`;
}
function adminZamowienieSnapshotHTML(z){
  const w=daneWysylki(z), k=kosztyZamowienia(z), klient=z?.klient||{}, pay=paynowDane(z);
  const osoba=[klient.imie,klient.nazwisko].filter(Boolean).join(" ")||z.email||"gość";
  const platnosc=z.platnosc||dostepnePlatnosci().find(p=>p.id===z.platnoscId)?.nazwa||"—";
  const platStatus=z.platnoscStatus||(z.platnoscId==="paynow"?paynowStatusTekst(pay.status):"—");
  const tracking=w.numer?`${w.numer}`:(w.inpostId?`${w.inpostId} • ${w.inpostStatus||"czeka"}`:"brak numeru");
  const etap=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi;
  const inpostOpcje=[
    pobranieAktywneZamowienia(z,w)?`COD ${zl(kwotaPobraniaZamowienia(z,w))}`:"COD NIE",
    (w.paczkaWeekend||z.paczkaWeekend)?`Weekend ${zl(OPLATA_PACZKA_WEEKEND)}`:"Weekend NIE",
    w.ochrona?`Ochrona ${zl(w.ochrona)}`:"Ochrona NIE",
    inpostSposobNadaniaLabel(inpostSposobNadania(z,w))
  ].join(" • ");
  return `<div class="order-detail-grid">
    <div class="order-detail-tile"><span>👤 Klient</span><b>${esc(osoba)}</b><small>${z.email?`✉️ ${esc(z.email)}`:"bez konta"}${klient.telefon?` • 📞 ${esc(klient.telefon)}`:""}</small></div>
    <div class="order-detail-tile"><span>💳 Płatność</span><b>${esc(platnosc)}</b><small>Status: ${esc(platStatus)}${k.platnosc?` • opłata ${zl(k.platnosc)}`:""}</small></div>
    <div class="order-detail-tile"><span>🚚 Dostawa</span><b>${esc(z.dostawa||uslugaInpostZamowienia(z))}</b><small>${k.dostawa?zl(k.dostawa):"GRATIS"}${k.paczkaWeekend?` • Weekend ${zl(k.paczkaWeekend)}`:""} • ${esc(etap.nazwa||"")}</small></div>
    <div class="order-detail-tile"><span>🏷️ Nadanie</span><b>${esc(tracking)}</b><small>${w.etykietaGotowa?"Etykieta gotowa":w.inpostId?"Czeka na potwierdzenie InPost":"Nieutworzona przesyłka"} • ${esc(inpostOpcje)}</small></div>
  </div>`;
}
function adminZamowienieStatusPanelHTML(z){
  return `<div class="order-status-flow">
    ${STATUSY.map(s=>`<button class="${s===z.status?"active":""}" onclick="zmienStatus(${jsArg(z.nr)},${jsArg(s)})"><span>${s===z.status?"●":"○"}</span>${esc(s)}</button>`).join("")}
  </div>`;
}
function adminZamowieniaSubnavHTML(aktywny="lista"){
  const sklep=pobierzZamowienia(),allegroAktywne=(allegroZamowienia||[]).filter(z=>!["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(allegroStatusKolejki(z))).length;
  const doWysylki=sklep.filter(z=>!["anulowane","dostarczone","zakończone"].includes(String(z.status||"").toLowerCase())&&!daneWysylki(z).numer).length;
  return adminSubnavHTML([
    {id:"lista",href:"#/admin/zamowienia",label:"📦 Lista sklepu",badge:sklep.length||""},
    {id:"allegro",href:"#/admin/allegro/zamowienia",label:"🟠 Zamówienia Allegro",badge:allegroAktywne||""},
    {id:"tabela",href:"#/admin/zamowienia/tabela",label:"📑 Tabela operacyjna"},
    {id:"wysylki",href:"#/admin/wysylki",label:"🚚 Wysyłki i etykiety",badge:doWysylki||""}
  ],aktywny);
}
function widokAdminZamowienia(){
  const wszystkie = pobierzZamowienia();
  const zam = adminPasujaceZamowieniaSklepu();
  const istniejace=new Set(wszystkie.map(z=>String(z.nr))),zaznaczone=[...zaznaczoneZamowieniaSklepu].filter(id=>istniejace.has(id));
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("lista")}
  <div class="panel orders-page">
    <div class="orders-hero">
      <div>
        <span class="order-pro-label">Centrum zamówień</span>
        <h1>📦 Zamówienia</h1>
        <p>Pełna obsługa sprzedaży: statusy, płatności, koszty InPost, etykiety, e-maile i szybkie przejście do wysyłki.</p>
      </div>
      <div class="diag-actions">
        <button class="btn ghost" onclick="synchronizujBazeCentralna(true)">🔄 Synchronizuj</button>
        <button class="btn ghost" onclick="eksportujZamowienia()">📤 CSV</button>
        <a class="btn ghost" href="#/admin/allegro">🟠 Allegro</a>
        <a class="btn" href="#/admin/wysylki">🚚 Centrum wysyłek</a>
      </div>
    </div>
    ${adminZamowieniaStatyHTML(wszystkie,zam)}
    ${adminWyszukiwaniePanelHTML({id:"store-orders",description:"Numer zamówienia, klient, dane kontaktowe, adres, numer nadania i status.",results:zam.length,active:!!(szukajZamowien||filtrZamowien!=="wszystkie"),open:true,fields:`<div class="orders-toolbar admin-search-full">
      <input placeholder="Szukaj: nr, klient, e-mail, telefon, adres, tracking…" value="${esc(szukajZamowien)}" oninput="szukajZamowien=this.value.toLowerCase();renderuj()">
      <select onchange="filtrZamowien=this.value;renderuj()">
        <option value="wszystkie" ${filtrZamowien==="wszystkie"?"selected":""}>Wszystkie statusy</option>
        ${STATUSY.map(s=>`<option value="${esc(s)}" ${s===filtrZamowien?"selected":""}>${esc(s)}</option>`).join("")}
      </select>
      ${szukajZamowien||filtrZamowien!=="wszystkie"?`<button class="btn ghost" onclick="szukajZamowien='';filtrZamowien='wszystkie';renderuj()">Wyczyść filtry</button>`:""}
    </div>`})}
    ${adminStatusyZamowienHTML(wszystkie)}
    <div class="order-bulk-toolbar">
      <div class="order-bulk-summary"><b>Operacje na zamówieniach</b><small>${zaznaczone.length} zaznaczonych • ${zam.length} w aktualnym widoku</small></div>
      <button class="btn ghost" onclick="adminZaznaczWidoczneZamowienia(true)">☑️ Zaznacz widoczne (${zam.length})</button>
      <button class="btn ghost" onclick="adminZaznaczWidoczneZamowienia(false)" ${zaznaczone.length?"":"disabled"}>☐ Odznacz widoczne</button>
      <button class="btn ghost" onclick="adminWyczyscZaznaczenieZamowien()" ${zaznaczone.length?"":"disabled"}>Wyczyść wybór</button>
      <div class="order-bulk-status">
        <label for="bulkOrderStatus">Nowy status</label>
        <select id="bulkOrderStatus"><option value="">— wybierz status —</option>${STATUSY.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
        <button class="btn" onclick="adminMasowoZmienStatusZamowien()" ${zaznaczone.length?"":"disabled"}>Zastosuj do ${zaznaczone.length}</button>
      </div>
    </div>
    <div class="orders-list">
      ${zam.length ? zam.map(kartaAdminZamowieniaHTML).join("") : `<div class="order-empty"><b>Brak zamówień dla tego widoku.</b><br>Zmień filtr albo wyczyść wyszukiwarkę.</div>`}
    </div>
  </div>`);
}
function widokAdminZamowieniaTabela(){
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("tabela")}
  ${magazynTabelaOperacyjnaHTML({limit:420})}
  <div class="panel orders-page">
    <div class="orders-hero">
      <div>
        <span class="order-pro-label">Tabela operacyjna</span>
        <h1>📑 Braki i zamówienia do producentów</h1>
        <p>Pełna tabela operacyjna pozostaje w panelu. Wiadomość wysyłana do Telegrama zawiera wyłącznie: kod, nazwę produktu i potrzebną ilość.</p>
      </div>
      <div class="diag-actions">
        <a class="btn ghost" href="#/admin/zamowienia">← Lista zamówień</a>
      </div>
    </div>
  </div>
  `);
}
function widokAdminZamowienie(nr){
  const z = pobierzZamowienia().find(x=>x.nr===nr);
  if(!z) return adminSzkielet("/admin/zamowienia", `<div class="panel"><h1>Nie znaleziono zamówienia ${esc(nr)}</h1><p><a href="#/admin/zamowienia">← Wróć do listy</a></p></div>`);
  const w=daneWysylki(z), uw=ustawieniaWysylki(), klient=z.klient||{}, adres=z.adresDostawy||{};
  const emailGotowy=!!stanBramki.email?.configured, emailPolaczony=emailGotowy&&!!chmuraToken;
  const przewoznik="inpost";
  const uslugi=PRZEWOZNICY[przewoznik]?.uslugi||[];
  const paczkomatZam = czyZamowieniePaczkomat(z);
  const uslugaDomyslna = w.usluga || uslugaInpostZamowienia(z);
  const paynow=paynowDane(z);
  const koszty=kosztyZamowienia(z), etapInfo=ETAPY_WYSYLKI[etapWysylki(z)]||ETAPY_WYSYLKI.do_obslugi, sla=slaWysylki(z);
  const pobranieAktywne=pobranieAktywneZamowienia(z,w);
  const pobranieKwota=kwotaPobraniaZamowienia(z,w);
  const paczkaWeekendAktywna=!!(w.paczkaWeekend||z.paczkaWeekend);
  const sposobNadania=inpostSposobNadania(z,w);
  const punktNadania=String(w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
  const ochronaKwota=String(w.ochrona||"").trim();
  const ochronaPreset=inpostOchronaPreset(ochronaKwota);
  return adminSzkielet("/admin/zamowienia", `
  ${adminZamowieniaSubnavHTML("lista")}
  <div class="panel order-detail-page">
    <div class="crumb"><a href="#/admin/zamowienia">Zamówienia</a> › ${esc(z.nr)}</div>
    <div class="order-detail-hero">
      <div>
        <span class="order-pro-label">Obsługa zamówienia</span>
        <h1>📦 ${esc(z.nr)} <span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'};font-size:.85rem;vertical-align:middle">${esc(z.status)}</span></h1>
        <p>${esc(z.data||"")} • <span class="${sla.klasa}">⏱ ${esc(sla.tekst)}</span> • etap: <b>${esc(etapInfo.nazwa||nazwaEtapu(z))}</b></p>
      </div>
      <div class="order-detail-total">
        <small>Do zapłaty</small>
        <b>${zl(koszty.razem)}</b>
        <span>produkty ${zl(koszty.poRabacie||koszty.produkty)} • dostawa ${koszty.dostawa?zl(koszty.dostawa):"gratis"}</span>
      </div>
    </div>
    ${adminZamowienieSnapshotHTML(z)}
    ${alertDostepnosciZamowieniaHTML(z)}
    <div class="order-detail-columns">
      <div class="order-detail-card">
        <div class="order-section-head"><div><span class="order-pro-label">Produkty</span><h2>🧾 Pozycje zamówienia</h2></div><b>${zl(koszty.produkty)}</b></div>
        ${adminPozycjeZamowieniaHTML(z)}
      </div>
      <div class="order-detail-card">
        <div class="order-section-head"><div><span class="order-pro-label">Finanse</span><h2>💰 Podsumowanie</h2></div></div>
        <div class="summary" style="margin:.55rem 0">${podsumowanieKosztowHTML(z,"Razem")}</div>
        ${z.uwagi?`<div class="backend-note"><b>Uwagi klienta:</b> ${esc(z.uwagi)}</div>`:""}
      </div>
    </div>
    <div class="order-detail-card" style="margin-top:1rem">
      <div class="order-section-head"><div><span class="order-pro-label">Status</span><h2>Zmiana statusu zamówienia</h2></div><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">${esc(z.status)}</span></div>
      ${adminZamowienieStatusPanelHTML(z)}
    </div>
  </div>
  <div class="panel order-fulfillment-panel">
    <div class="order-section-head">
      <div><span class="order-pro-label">InPost / realizacja</span><h2>🚚 Nadanie i dane odbiorcy</h2></div>
      <div class="order-pro-costs"><span style="background:${etapInfo.kolor||'var(--bg)'};color:var(--ink)">${esc(nazwaEtapu(z))}</span>${w.numer?`<span>Numer <b>${esc(w.numer)}</b></span>`:""}${w.inpostId?`<span>InPost <b>${esc(w.inpostId)}</b></span>`:""}</div>
    </div>
    <p class="order-detail-lead">${w.inpostStatus?`Status InPost: ${esc(w.inpostStatus)}. `:""}${urlSledzenia(z)?`<a href="${esc(urlSledzenia(z))}" target="_blank" rel="noopener">Otwórz śledzenie przesyłki</a>`:"Najpierw zapisz dane, potem utwórz przesyłkę i etykietę."}</p>
    <div class="backend-note">Pola z <b>*</b> są wymagane przed utworzeniem przesyłki InPost.</div>
    <form class="order-form-pro shipment-manager-form inpost-like-form" onsubmit="zapiszNadanie(event,'${esc(z.nr)}')">
      <div class="shipment-manager-box inpost-like-box">
        <h3 class="inpost-like-title">Nadanie przesyłki</h3>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Dane odbiorcy</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Imię</label><div><input name="imie" value="${esc(klient.imie||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nazwisko</label><div><input name="nazwisko" value="${esc(klient.nazwisko||"")}"></div></div>
            <div class="shipment-manager-field"><label>E-mail *</label><div><input name="email" type="email" value="${esc(z.email||"")}"></div></div>
            <div class="shipment-manager-field"><label>Telefon *</label><div><input name="telefon" value="${esc(klient.telefon||"")}" placeholder="9 cyfr"></div></div>
            <div class="shipment-manager-field"><label>Firma</label><div><input name="firma" value="${esc(klient.firma||"")}" placeholder="opcjonalnie"></div></div>
            <div class="shipment-manager-field"><label>NIP</label><div><input name="nip" value="${esc(klient.nip||"")}" placeholder="opcjonalnie"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Dostawa i gabaryt</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Sposób dostawy</label><div><select name="dostawaTyp" onchange="przelaczDostawaAdmin(this)">
              <option value="paczkomat" ${paczkomatZam?"selected":""}>Paczkomat / punkt InPost</option>
              <option value="kurier_inpost" ${!paczkomatZam?"selected":""}>Kurier InPost</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Gabaryt paczki</label><div><select name="gabaryt">
              <option value="small" ${(w.gabaryt||"small")==="small"?"selected":""}>Gabaryt A — mały (8 × 38 × 64 cm)</option>
              <option value="medium" ${w.gabaryt==="medium"?"selected":""}>Gabaryt B — średni (19 × 38 × 64 cm)</option>
              <option value="large" ${w.gabaryt==="large"?"selected":""}>Gabaryt C — duży (41 × 38 × 64 cm)</option>
            </select></div></div>
            <div class="shipment-manager-field span-2" id="admPaczkomatRow" style="${paczkomatZam?"":"display:none"}"><label>Paczkomat / punkt InPost *</label><div class="shipment-inline-control"><input name="paczkomat" id="admPaczkomat" value="${esc(z.paczkomat||w.punktKod||"")}" placeholder="np. WAW01M" style="text-transform:uppercase"><button type="button" class="btn" onclick="otworzGeowidgetAdmin()">🗺️ Wybierz na mapie</button></div></div>
            <input type="hidden" name="paczkomatAdres" id="admPaczkomatAdresVal" value="${esc(z.paczkomatAdres||"")}">
            <div class="shipment-manager-note span-2" id="admPaczkomatAdres">${(z.paczkomatAdres||"").trim()?`📮 ${esc(czyscAdresPaczkomatu(z.paczkomatAdres))}`:""}</div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Adres odbiorcy${paczkomatZam?" / awaryjny":" *"}</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Ulica${paczkomatZam?"":" *"}</label><div><input name="ulica" value="${esc(adres.ulica||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nr domu${paczkomatZam?"":" *"}</label><div><input name="nrDomu" value="${esc(adres.nrDomu||"")}"></div></div>
            <div class="shipment-manager-field"><label>Nr lokalu</label><div><input name="nrLokalu" value="${esc(adres.nrLokalu||"")}"></div></div>
            <div class="shipment-manager-field"><label>Kod pocztowy${paczkomatZam?"":" *"}</label><div><input name="kod" value="${esc(adres.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div></div>
            <div class="shipment-manager-field"><label>Miejscowość${paczkomatZam?"":" *"}</label><div><input name="miasto" value="${esc(adres.miasto||"")}"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Usługi InPost</h4>
          <div class="shipment-manager-grid">
            <div class="shipment-manager-field"><label>Zlecenie za pobraniem</label><div><select name="pobranieAktywne" onchange="if(this.value==='tak'&&!this.form.pobranie.value)this.form.pobranie.value='${esc(kwotaNum(z.razem).toFixed(2))}'">
              <option value="" ${!pobranieAktywne?"selected":""}>NIE — jak w InPost</option>
              <option value="tak" ${pobranieAktywne?"selected":""}>TAK — pobranie od klienta</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Wartość pobrania</label><div><input name="pobranie" inputmode="decimal" value="${esc(pobranieKwota)}" placeholder="np. ${esc(kwotaNum(z.razem).toFixed(2))}"></div></div>
            <div class="shipment-manager-field"><label>Paczka w Weekend</label><div><select name="paczkaWeekend">
              <option value="" ${!paczkaWeekendAktywna?"selected":""}>NIE — jak w InPost</option>
              <option value="tak" ${paczkaWeekendAktywna?"selected":""}>TAK (+${zl(OPLATA_PACZKA_WEEKEND)})</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Sposób nadania</label><div><select name="sposobNadania">
              ${Object.entries(INPOST_SP_NADANIA).map(([id,nazwa])=>`<option value="${esc(id)}" ${sposobNadania===id?"selected":""}>${esc(nazwa)}</option>`).join("")}
            </select></div></div>
            <div class="shipment-manager-field"><label>Punkt nadania</label><div><input name="punktNadania" value="${esc(punktNadania)}" placeholder="${esc(INPOST_DOMYSLNY_PUNKT_NADANIA)}" style="text-transform:uppercase"></div></div>
            <div class="shipment-manager-field"><label>Dodatkowa ochrona</label><div><select name="ochronaPreset" onchange="if(this.value!=='custom')this.form.ochrona.value=this.value">
              ${INPOST_OCHRONA_PRESETY.map(p=>`<option value="${esc(p.wartosc)}" ${ochronaPreset===p.wartosc?"selected":""}>${esc(p.etykieta)}</option>`).join("")}
              <option value="custom" ${ochronaPreset==="custom"?"selected":""}>Własna kwota</option>
            </select></div></div>
            <div class="shipment-manager-field"><label>Kwota ochrony</label><div><input name="ochrona" inputmode="decimal" value="${esc(ochronaKwota)}" placeholder="puste = brak"></div></div>
          </div>
        </section>

        <section class="shipment-manager-card">
          <details class="shipment-advanced"><summary>Wymiary, waga i ręczny numer nadania</summary>
            <div class="shipment-manager-grid">
              <div class="shipment-manager-field"><label>Waga (kg)</label><div><input name="waga" type="number" step=".01" min=".01" value="${esc(w.waga||uw.waga)}"></div></div>
              <div class="shipment-manager-field"><label>Długość (cm)</label><div><input name="dlugosc" type="number" min="1" value="${esc(w.dlugosc||uw.dlugosc)}"></div></div>
              <div class="shipment-manager-field"><label>Szerokość (cm)</label><div><input name="szerokosc" type="number" min="1" value="${esc(w.szerokosc||uw.szerokosc)}"></div></div>
              <div class="shipment-manager-field"><label>Wysokość (cm)</label><div><input name="wysokosc" type="number" min="1" value="${esc(w.wysokosc||uw.wysokosc)}"></div></div>
              <div class="shipment-manager-field"><label>Numer nadania</label><div><input name="numer" value="${esc(w.numer)}" placeholder="Zwykle uzupełni się automatycznie"></div></div>
              <div class="shipment-manager-field"><label>Własny link śledzenia</label><div><input name="trackingUrl" type="url" value="${esc(w.trackingUrl)}" placeholder="https://…"></div></div>
            </div>
          </details>
        </section>

        <section class="shipment-manager-card">
          <h4 class="inpost-like-section-title">Etykieta i zapis</h4>
          <div class="shipment-manager-field full"><label>Uwagi do zamówienia</label><div><textarea name="uwagi" rows="2">${esc(z.uwagi||"")}</textarea></div></div>
          ${panelEtykietInpostHTML(z)}
        </section>
      </div>
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz dane</button>
      </div>
      <p style="font-size:.8rem;color:var(--muted2);margin:.4rem 0 0">Najpierw „Zapisz dane”, potem użyj panelu etykiet. Numer nadania i status pojawią się automatycznie u góry tej sekcji.</p>
    </form>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">💳 Płatność</h2>
      <div class="summary" style="margin:.4rem 0 ${z.platnoscId==="paynow"?".8rem":"0"}">
        <div><span>Metoda</span><span><b>${esc(z.platnosc||"—")}</b></span></div>
        <div><span>Status płatności</span><span>${esc(z.platnoscStatus||(z.platnoscId==="paynow"?paynowStatusTekst(paynow.status):"—"))}</span></div>
      ${podsumowanieKosztowHTML(z,"Kwota")}
    </div>
    ${z.platnoscId==="paynow"?`<div class="diag-actions"><button class="btn ghost" type="button" onclick="odswiezStatusPaynow(${jsArg(z.nr)},${jsArg(paynow.paymentId||"")})">🔄 Odśwież Paynow</button>${paynow.redirectUrl?`<a class="btn" href="${esc(paynow.redirectUrl)}" target="_blank" rel="noopener">Otwórz link płatności</a>`:""}${String(paynow.status||"").toUpperCase()==="CONFIRMED"?`<button class="btn" type="button" style="background:#0ea5e9;color:#fff" onclick="zwrotPieniedzyPaynow(${jsArg(z.nr)})">💸 Zwrot pieniędzy przez Paynow</button>`:""}</div>`:""}
    ${Array.isArray(paynow.refunds)&&paynow.refunds.length?`<div class="backend-note" style="border-color:#7dd3fc;background:#f0f9ff;color:#075985"><b>Zwroty Paynow:</b><br>${paynow.refunds.map(r=>`${zl((Number(r.amount)||0)/100)} • <code>${esc(r.refundId||"—")}</code> • ${esc(r.status||"—")}${r.ts?` • ${esc(new Date(r.ts).toLocaleString("pl-PL"))}`:""}`).join("<br>")}</div>`:""}
  </div>
  <div class="panel">
    <h2 style="margin-top:0">📍 Historia śledzenia</h2>
    ${(w.historia||[]).length?`<div class="ship-timeline">${[...(w.historia||[])].reverse().map(h=>`<div class="ship-event"><b>${esc(h.status)}</b>${h.opis?` — ${esc(h.opis)}`:""}<small>${esc(h.czas)}</small></div>`).join("")}</div>`:`<p style="color:var(--muted2)">Brak zdarzeń. Po podłączeniu webhooków historia będzie aktualizowana automatycznie.</p>`}
    <form onsubmit="dodajZdarzenieWysylki(event,'${esc(z.nr)}')">
      <div class="f-row"><div class="f-group"><label>Status zdarzenia</label><select name="status"><option>Przyjęta przez InPost</option><option>Przekazana do InPost</option><option>W sortowni</option><option>W drodze</option><option>W doręczeniu</option><option>Dostarczona</option><option>Zwrot do nadawcy</option><option>Problem z doręczeniem</option><option>Opóźnienie InPost</option><option>Nieudana próba doręczenia</option></select></div><div class="f-group"><label>Opis / lokalizacja</label><input name="opis" placeholder="Np. sortownia Warszawa"></div></div>
      <button class="btn ghost" type="submit">➕ Dodaj zdarzenie ręcznie</button>
    </form>
  </div>
  <div class="panel">
    <h2 style="margin-top:0">✉️ Powiadomienia klienta</h2>
    <div class="backend-note" style="${emailPolaczony?"border-color:#86efac;background:#f0fdf4;color:#166534":emailGotowy?"":"border-color:#f59e0b"}">
      <b>${emailPolaczony?"Automatyczna wysyłka SMTP jest gotowa":emailGotowy?"SMTP jest skonfigurowany":"Automatyczna wysyłka wymaga konfiguracji SMTP/Gmail w Netlify"}.</b>
      ${emailPolaczony?` Wiadomości wysyła ${esc(stanBramki.email.provider||"SMTP")}; wynik i identyfikator trafiają do historii.`:emailGotowy?` Wpisz hasło bazy administratora, aby wysyłać ręczne wiadomości.`:` Ustaw zmienne <code>SMTP_USER</code> i <code>SMTP_PASS</code> w Netlify.`}
      ${!emailPolaczony?` <a href="#/admin/dostawy">Konfiguracja e-mail →</a>`:""}
    </div>
    <div class="diag-actions">
      ${Object.entries(NAZWY_EMAILI).map(([id,n])=>emailPolaczony
        ?`<button class="btn" onclick="wyslijEmailWysylki('${esc(z.nr)}','${id}')" ${z.email?"":"disabled"}>📧 Wyślij: ${esc(n)}</button>`
        :`<button class="btn ghost" onclick="otworzEmailWysylki('${esc(z.nr)}','${id}')" ${z.email?"":"disabled"}>✉️ Szkic: ${esc(n)}</button>`
      ).join("")}
    </div>
    ${(w.powiadomienia||[]).length?`<div class="ship-timeline">${[...(w.powiadomienia||[])].reverse().map(p=>`<div class="ship-event"><b>${esc(NAZWY_EMAILI[p.typ]||p.typ)}</b> — ${esc(p.status)}${p.automatyczne?" • automatycznie":""}${p.provider?` • ${esc(p.provider)}`:""}${p.id?`<br><code>${esc(p.id)}</code>`:""}${p.blad?`<br><span style="color:var(--danger)">${esc(p.blad)}</span>`:""}<small>${esc(p.czas)}</small></div>`).join("")}</div>`:`<p style="color:var(--muted2)">Brak wysłanych wiadomości dla tego zamówienia.</p>`}
    <div class="diag-actions" style="margin-top:.7rem">
      <button class="btn ghost" onclick="drukujZamowienie('${esc(z.nr)}')">🖨️ Drukuj zamówienie</button>
      <button class="btn danger" onclick="if(confirm('Usunąć zamówienie ${esc(z.nr)}?')) usunZamowienie('${esc(z.nr)}')">🗑️ Usuń zamówienie</button>
    </div>
  </div>`);
}
function zapiszDaneOdbiorcy(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), g=k=>String(f.get(k)||"").trim();
  aktualizujZamowienie(nr, z=>{
    z.klient=z.klient||{};
    z.klient.imie=g("imie"); z.klient.nazwisko=g("nazwisko"); z.klient.telefon=g("telefon");
    z.klient.firma=g("firma"); z.klient.nip=g("nip").replace(/[^0-9]/g,"");
    const em=g("email").toLowerCase(); if(em) z.email=em;
    z.adresDostawy=z.adresDostawy||{};
    z.adresDostawy.ulica=g("ulica"); z.adresDostawy.nrDomu=g("nrDomu"); z.adresDostawy.nrLokalu=g("nrLokalu");
    z.adresDostawy.kod=g("kod"); z.adresDostawy.miasto=g("miasto");
    if(f.has("paczkomat")){ const kod=g("paczkomat").toUpperCase(); z.paczkomat=kod; z.paczkomatAdres=g("paczkomatAdres"); const w=daneWysylki(z); w.punktKod=kod; z.wysylka=w; }
    z.uwagi=g("uwagi");
    const a=z.adresDostawy;
    z.adres=`${a.ulica} ${a.nrDomu}${a.nrLokalu?"/"+a.nrLokalu:""}, ${a.kod} ${a.miasto}`.replace(/\s+/g," ").replace(/^[,\s]+|[,\s]+$/g,"").trim();
  });
  loguj("info",`Zaktualizowano dane odbiorcy zamówienia ${nr}`);
  toast("Dane odbiorcy zapisane ✅");
  renderuj();
}
function przelaczDostawaAdmin(sel){
  const row=$("admPaczkomatRow"); if(row) row.style.display = sel.value==="paczkomat" ? "" : "none";
}
function zapiszNadanie(e,nr){
  e.preventDefault();
  const f=new FormData(e.target), g=k=>String(f.get(k)||"").trim();
  aktualizujZamowienie(nr, z=>{
    const stareRazem=kwotaNum(z.razem);
    z.klient=z.klient||{};
    z.klient.imie=g("imie"); z.klient.nazwisko=g("nazwisko"); z.klient.telefon=g("telefon");
    z.klient.firma=g("firma"); z.klient.nip=g("nip").replace(/[^0-9]/g,"");
    const em=g("email").toLowerCase(); if(em) z.email=em;
    z.adresDostawy=z.adresDostawy||{};
    z.adresDostawy.ulica=g("ulica"); z.adresDostawy.nrDomu=g("nrDomu"); z.adresDostawy.nrLokalu=g("nrLokalu");
    z.adresDostawy.kod=g("kod"); z.adresDostawy.miasto=g("miasto");
    const typ = g("dostawaTyp")==="kurier_inpost" ? "kurier_inpost" : "paczkomat";
    z.dostawaId=typ;
    z.dostawa = typ==="paczkomat" ? "Paczkomat InPost 24/7" : "Kurier InPost";
    const w=daneWysylki(z);
    if(typ==="paczkomat"){ const kod=g("paczkomat").toUpperCase(); z.paczkomat=kod; w.punktKod=kod; z.paczkomatAdres=g("paczkomatAdres"); }
    else { z.paczkomat=""; z.paczkomatAdres=""; w.punktKod=""; }
    const gab=g("gabaryt"); if(["small","medium","large"].includes(gab)) w.gabaryt=gab;
    if(g("waga")) w.waga=g("waga"); if(g("dlugosc")) w.dlugosc=g("dlugosc"); if(g("szerokosc")) w.szerokosc=g("szerokosc"); if(g("wysokosc")) w.wysokosc=g("wysokosc");
    const pobranieAktywneForm=g("pobranieAktywne")==="tak";
    const pobranieForm=pobranieAktywneForm ? g("pobranie") : "";
    const sposobNadania=g("sposobNadania");
    w.ochrona=g("ochrona");
    w.pobranieAktywne=pobranieAktywneForm;
    w.pobranie=pobranieForm;
    w.paczkaWeekend=g("paczkaWeekend")==="tak";
    w.sposobNadania=INPOST_SP_NADANIA[sposobNadania]?sposobNadania:INPOST_DOMYSLNY_SP_NADANIA;
    w.punktNadania=g("punktNadania").toUpperCase()||INPOST_DOMYSLNY_PUNKT_NADANIA;
    w.formatEtykiety=g("formatEtykiety").toUpperCase()==="A4"?"A4":"A6";
    if(f.has("numer")) w.numer=g("numer");
    if(f.has("trackingUrl")) w.trackingUrl=g("trackingUrl");
    w.przewoznik="inpost"; w.usluga = typ==="paczkomat" ? "Paczkomat 24/7" : "Kurier InPost";
    z.wysylka=w;
    zapiszKosztyZamowienia(z,{dostawaId:typ,paczkaWeekend:w.paczkaWeekend});
    if(pobranieAktywneForm && (!pobranieForm || kwotaNum(pobranieForm)===stareRazem)) w.pobranie=kwotaNum(z.razem).toFixed(2);
    z.uwagi=g("uwagi");
    const a=z.adresDostawy;
    z.adres=`${a.ulica} ${a.nrDomu}${a.nrLokalu?"/"+a.nrLokalu:""}, ${a.kod} ${a.miasto}`.replace(/\s+/g," ").replace(/^[,\s]+|[,\s]+$/g,"").trim();
  });
  loguj("info",`Zapisano dane nadania zamówienia ${nr}`);
  toast("Zapisano dane nadania ✅");
  renderuj();
}
async function otworzGeowidgetAdmin(){
  const cfg=await pobierzInpostConfig();
  if(!cfg||!cfg.geowidgetToken){ toast("Mapa paczkomatów niedostępna — wpisz kod ręcznie"); const h=$("admPaczkomat"); if(h) h.focus(); return; }
  try{ await ladujGeowidgetSDK(); }catch(e){ toast(e.message||"Błąd mapy InPost"); return; }
  window.__geoTarget="admin";
  let ov=$("geoOverlay");
  if(!ov){ ov=document.createElement("div"); ov.id="geoOverlay"; ov.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:2vmin"; document.body.appendChild(ov); }
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;width:min(980px,96vw);height:min(88vh,780px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;background:#111;color:#fff"><b>Wybierz paczkomat InPost</b><button type="button" onclick="zamknijGeowidget()" style="background:#ffcc00;color:#111;border:0;border-radius:8px;padding:.4rem .8rem;font-weight:800;cursor:pointer">Zamknij ✕</button></div>
    <div style="flex:1;min-height:0"><inpost-geowidget onpoint="artwayPunktWybrany" token="${esc(cfg.geowidgetToken)}" language="pl" config="parcelCollect" style="width:100%;height:100%;display:block"></inpost-geowidget></div>
  </div>`;
  ov.style.display="flex";
}
function zmienStatus(nr, status){
  const t = pobierzZamowienia();
  const z = t.find(x=>x.nr===nr);
  if(z){
    const zmiana=zastosujStatusZamowieniaLokalnie(z,status);
    if(!zmiana){renderuj();return;}
    zapiszLS("artway_zamowienia", t);
    loguj("info",`Zmieniono status zamówienia ${nr} → ${status}`);
    toast(`${nr}: ${status} ✅`);
    // Serwer sam wyśle e-mail statusowy przy zapisie; awaryjnie (brak połączenia z bazą) próbujemy z panelu
    zapiszZamowienieCentralnie(z,false).then(d=>{ if(!d) void obsluzAutomatycznyEmail(nr,status); });
  }
  renderuj();
}
async function usunZamowienie(nr){
  const numer=nrZamowienia(nr), z=pobierzZamowienia().find(x=>x.nr===numer);
  oznaczZamowienieUsuniete(numer,{by:"admin",email:z?.email||""});
  zapiszLS("artway_zamowienia", pobierzZamowienia().filter(x=>x.nr!==numer));
  if(chmuraToken){
    try{
      await chmura("store-order-delete",{method:"POST",body:{number:numer}});
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:true,error:""};
    }catch(bl){
      stanBazyCentralnej={...stanBazyCentralnej,sprawdzono:true,online:false,error:bl.message};
      toast("Usunięto lokalnie, ale nie zapisano na serwerze: "+bl.message);
    }
  }else{
    toast("Usunięto lokalnie. Wpisz hasło bazy, aby utrwalić usunięcie na serwerze.");
  }
  loguj("info","Usunięto zamówienie "+nr);
  toast("Zamówienie usunięte — nie wróci do obsługi");
  if(trasa().startsWith("/admin/zamowienie/")) location.hash="#/admin/zamowienia"; else renderuj();
}
let szukajKlientow = "";
function zmienRoleUzytkownika(email){
  if(!jestAdmin()){ toast("Brak uprawnień"); return; }
  const e=String(email||"").toLowerCase(),u=pobierzUzytkownikow(),k=u.find(x=>x.email===e);
  if(!k){ toast("Nie znaleziono użytkownika"); return; }
  if(jestGlownymAdminem(e)){ toast("Nie można zmienić roli głównego administratora"); return; }
  const maRole=k.rola==="admin";
  if(maRole&&sesja?.email===e){ toast("Nie możesz odebrać uprawnień aktualnie używanemu kontu"); return; }
  k.rola=maRole?"klient":"admin";
  zapiszLS("artway_uzytkownicy",u);
  void zapiszUzytkownikaCentralnie(k);
  loguj("info",`${maRole?"Odebrano":"Nadano"} rolę administratora: ${e}`);
  toast(maRole?"Odebrano uprawnienia administratora":"Nadano uprawnienia administratora 🛡️");
  renderuj();
}
function widokAdminKlienci(sekcja="lista"){
  const aktywna=["lista","dodaj","uprawnienia","zamowienia"].includes(String(sekcja||""))?String(sekcja||""):"lista";
  let kl = pobierzUzytkownikow();
  if(szukajKlientow) kl = kl.filter(k=>(k.imie+" "+k.email).toLowerCase().includes(szukajKlientow));
  if(aktywna==="uprawnienia") kl=kl.slice().sort((a,b)=>Number(kontoMaRoleAdmin(b.email))-Number(kontoMaRoleAdmin(a.email))||String(a.email).localeCompare(String(b.email),"pl"));
  const zam = pobierzZamowienia();
  const klienciZZamowieniami=kl.map(k=>{
    const z=zam.filter(x=>x.email===k.email);
    return {k,z,ile:z.length,suma:z.filter(x=>x.status!=="anulowane").reduce((s,x)=>s+kwotaNum(x.razem),0),ostatnie:z.slice().sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0))[0]};
  }).filter(x=>x.ile).sort((a,b)=>b.suma-a.suma);
  return adminSzkielet("/admin/klienci", `
  ${klienciSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="dodaj"?"":"display:none"}">
    <h1>➕ Dodaj klienta (pełna kartoteka)</h1>
    <form onsubmit="dodajKlientaAdmin(event)">
      ${polaKartotekiHTML({})}
      <button class="btn" type="submit">➕ Utwórz konto klienta</button>
    </form>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">Konto trafia do wspólnej bazy serwerowej. Klient może zalogować się na dowolnym urządzeniu.</p>
  </div>
  <div class="panel" style="${["lista","uprawnienia"].includes(aktywna)?"":"display:none"}">
    <h1>${aktywna==="uprawnienia"?"🛡️ Uprawnienia użytkowników":"👥 Użytkownicy"} (${kl.length}) <button class="btn ghost" style="float:right" onclick="eksportujKlientow()">📤 CSV</button></h1>
    ${aktywna==="uprawnienia"?`<div class="backend-note" style="margin-bottom:.8rem">Tutaj szybko nadajesz lub odbierasz rolę administratora. Konto głównego właściciela i aktualnie używane konto są chronione przed przypadkową zmianą.</div>`:""}
    ${adminWyszukiwaniePanelHTML({id:"customers",description:"Imię, nazwisko albo adres e-mail użytkownika.",results:kl.length,active:!!szukajKlientow,open:true,fields:`<label class="search-wide">Klient<input placeholder="Imię, nazwisko lub e-mail…" value="${esc(szukajKlientow)}" oninput="szukajKlientow=this.value.toLowerCase();renderuj()"></label>${szukajKlientow?`<button class="btn ghost" onclick="szukajKlientow='';renderuj()">Wyczyść filtry</button>`:""}`})}
    <div class="table-scroll"><table class="log-table">
      <tr><th>Imię i nazwisko</th><th>E-mail</th><th>Rola</th><th>Rejestracja</th><th>Zamówień</th><th>Akcje</th></tr>
      ${kl.map(k=>{
        const admin = kontoMaRoleAdmin(k.email), glowny=jestGlownymAdminem(k.email);
        const nZam = zam.filter(z=>z.email===k.email).length;
        return `<tr>
        <td><a href="#/admin/klient/${encodeURIComponent(k.email)}"><b>${esc(k.imie)}</b></a>${admin?' <span class="lvl lvl-info">ADMIN</span>':""}${k.nip?' <span class="lvl lvl-info">firma</span>':""}</td>
        <td>${esc(k.email)}${k.telefon?`<br><small style="color:var(--muted2)">📞 ${esc(k.telefon)}</small>`:""}</td>
        <td><span class="lvl ${admin?"lvl-info":""}">${admin?"administrator":"klient"}</span>${glowny?"<br><small>właściciel</small>":""}</td>
        <td>${new Date(k.data).toLocaleDateString("pl-PL")}</td>
        <td>${nZam ? `<a href="#/admin/zamowienia" onclick="szukajZamowien='${esc(k.email)}';filtrZamowien='wszystkie'" title="Zamówienia klienta">${nZam} →</a>` : "0"}</td>
        <td style="white-space:nowrap">
          <a class="btn ghost" href="#/admin/klient/${encodeURIComponent(k.email)}" style="padding:.3rem .55rem" title="Kartoteka klienta">📇</a>
          ${glowny||sesja?.email===k.email?"":`<button class="btn ghost" onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')" style="padding:.3rem .55rem" title="${admin?"Odbierz rolę administratora":"Nadaj rolę administratora"}">${admin?"🔒":"🛡️"}</button>`}
          ${admin?"":`<button class="ci-remove" onclick="if(confirm('Usunąć konto ${esc(k.email)}?')) usunKlienta('${esc(k.email)}')" title="Usuń konto">🗑️</button>`}
        </td>
      </tr>`;}).join("")}
    </table></div>
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.6rem">📇 otwiera pełną kartotekę klienta: dane kontaktowe, adres, dane firmowe, notatka, nowe hasło. Zamówienia klienta otworzysz, klikając ich liczbę.</p>
  </div>
  <div class="panel" style="${aktywna==="zamowienia"?"":"display:none"}">
    <div class="order-section-head">
      <div><h1 style="margin:0">📦 Zamówienia klientów</h1><p class="order-detail-lead">Szybki widok klientów według liczby i wartości zamówień.</p></div>
      <a class="btn ghost" href="#/admin/zamowienia">Pełna lista zamówień</a>
    </div>
    <div class="table-scroll"><table class="log-table">
      <tr><th>Klient</th><th>E-mail</th><th>Zamówień</th><th>Wartość</th><th>Ostatnie</th><th>Akcje</th></tr>
      ${klienciZZamowieniami.map(x=>`<tr>
        <td><a href="#/admin/klient/${encodeURIComponent(x.k.email)}"><b>${esc(x.k.imie||"Klient")}</b></a></td>
        <td>${esc(x.k.email)}</td>
        <td><b>${x.ile}</b></td>
        <td>${zl(x.suma)}</td>
        <td>${x.ostatnie?`<a href="#/admin/zamowienie/${encodeURIComponent(x.ostatnie.nr)}">${esc(x.ostatnie.nr)}</a><br><small>${esc(x.ostatnie.data||"")}</small>`:"—"}</td>
        <td><a class="btn ghost" href="#/admin/zamowienia" onclick="szukajZamowien=${jsArg(x.k.email)};filtrZamowien='wszystkie'">Pokaż zamówienia</a></td>
      </tr>`).join("") || `<tr><td colspan="6">Brak klientów z zamówieniami.</td></tr>`}
    </table></div>
  </div>`);
}

/* ── Pełna kartoteka klienta ── */
function pobierzProfil(email){ return pobierzUzytkownikow().find(x=>x.email===String(email||"").toLowerCase()); }
function polaKartotekiHTML(k, opcje={}){
  return `
      <h3 class="f-sekcja">👤 Dane kontaktowe</h3>
      <div class="f-row">
        <div class="f-group"><label>Imię i nazwisko *</label><input required name="imie" value="${esc(k.imie||"")}"></div>
        <div class="f-group"><label>E-mail *</label><input required name="email" type="email" value="${esc(k.email||"")}" ${opcje.blokujEmail?"readonly style='background:var(--line)'":""}></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Telefon</label><input name="telefon" type="tel" value="${esc(k.telefon||"")}" placeholder="np. 600 100 200"></div>
      </div>
      ${opcje.bezHasla?"":`<div class="f-row">
        <div class="f-group"><label>${opcje.edycja?"Nowe hasło (puste = bez zmiany)":"Hasło startowe * (min. 6 znaków)"}</label>
          <input name="haslo" type="password" minlength="6" ${opcje.edycja?"":"required"} autocomplete="new-password"></div>
        <div class="f-group"><label>${opcje.edycja?"Powtórz nowe hasło":"Powtórz hasło startowe *"}</label>
          <input name="haslo2" type="password" minlength="6" ${opcje.edycja?"":"required"} autocomplete="new-password"></div>
      </div>`}
      <h3 class="f-sekcja">📍 Adres</h3>
      <div class="f-row" style="grid-template-columns:2fr 1fr 1fr">
        <div class="f-group"><label>Ulica</label><input name="ulica" value="${esc(k.ulica||"")}"></div>
        <div class="f-group"><label>Nr domu</label><input name="nrDomu" value="${esc(k.nrDomu||"")}"></div>
        <div class="f-group"><label>Nr lokalu</label><input name="nrLokalu" value="${esc(k.nrLokalu||"")}"></div>
      </div>
      <div class="f-row" style="grid-template-columns:1fr 2fr">
        <div class="f-group"><label>Kod pocztowy</label><input name="kod" value="${esc(k.kod||"")}" placeholder="00-000" maxlength="6" oninput="formatujKod(this)"></div>
        <div class="f-group"><label>Miejscowość</label><input name="miasto" value="${esc(k.miasto||"")}"></div>
      </div>
      <h3 class="f-sekcja">🧾 Dane firmowe (jeśli klient kupuje na firmę)</h3>
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>NIP</label><input name="nip" value="${esc(k.nip||"")}" placeholder="10 cyfr" maxlength="13" inputmode="numeric"></div>
        <div class="f-group"><button type="button" class="btn ghost" onclick="nipDoFormularza(this.form, this)">⬇️ Pobierz dane z NIP</button></div>
      </div>
      <div class="f-group"><label>Nazwa firmy</label><input name="firma" value="${esc(k.firma||"")}"></div>
      ${opcje.bezNotatki?"":`<div class="f-group"><label>📝 Notatka o kliencie (widzi tylko admin)</label><textarea name="notatka" rows="2" maxlength="500">${esc(k.notatka||"")}</textarea></div>`}`;
}
function daneKartotekiZFormularza(f){
  const d = {
    imie: String(f.get("imie")||"").trim(),
    telefon: String(f.get("telefon")||"").trim(),
    ulica: String(f.get("ulica")||"").trim(),
    nrDomu: String(f.get("nrDomu")||"").trim(),
    nrLokalu: String(f.get("nrLokalu")||"").trim(),
    kod: String(f.get("kod")||"").trim(),
    miasto: String(f.get("miasto")||"").trim(),
    nip: String(f.get("nip")||"").replace(/[^0-9]/g,""),
    firma: String(f.get("firma")||"").trim()
  };
  if(f.get("notatka")!==null) d.notatka = String(f.get("notatka")||"").trim();
  if(d.nip && !walidujNip(d.nip)) return {blad:"Nieprawidłowy NIP — sprawdź numer"};
  return d;
}
function widokAdminKlient(email){
  const k = pobierzProfil(email);
  if(!k) return adminSzkielet("/admin/klienci", `<div class="panel"><h1>Nie znaleziono klienta</h1><p><a href="#/admin/klienci">← Wróć do listy</a></p></div>`);
  const zam = pobierzZamowienia().filter(z=>z.email===k.email);
  const admin = kontoMaRoleAdmin(k.email), glowny=jestGlownymAdminem(k.email);
  return adminSzkielet("/admin/klienci", `
  ${klienciSubnavHTML("lista")}
  <div class="panel">
    <div class="crumb"><a href="#/admin/klienci">Klienci</a> › ${esc(k.imie)}</div>
    <h1>📇 ${esc(k.imie)} ${admin?'<span class="lvl lvl-info">ADMIN</span>':""} ${k.nip?'<span class="lvl lvl-info">firma</span>':""}</h1>
    <div class="stat-grid">
      <div class="stat"><b>${zam.length}</b><small>zamówień</small></div>
      <div class="stat"><b>${zl(zam.filter(z=>z.status!=="anulowane").reduce((s,z)=>s+z.razem,0))}</b><small>łączna wartość</small></div>
      <div class="stat"><b>${new Date(k.data).toLocaleDateString("pl-PL")}</b><small>rejestracja</small></div>
    </div>
    <form onsubmit="zapiszKartoteke(event, '${esc(k.email)}')">
      ${polaKartotekiHTML(k, {edycja:true, blokujEmail:glowny})}
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz kartotekę</button>
        ${glowny||sesja?.email===k.email?"":`<button class="btn ghost" type="button" onclick="if(confirm('${admin?"Odebrać":"Nadać"} uprawnienia administratora dla ${esc(k.email)}?')) zmienRoleUzytkownika('${esc(k.email)}')">${admin?"🔒 Odbierz rolę administratora":"🛡️ Nadaj rolę administratora"}</button>`}
        ${zam.length?`<a class="btn ghost" href="#/admin/zamowienia" onclick="szukajZamowien='${esc(k.email)}';filtrZamowien='wszystkie'">📦 Zamówienia klienta (${zam.length})</a>`:""}
        <a class="btn ghost" href="mailto:${esc(k.email)}">✉️ Napisz e-mail</a>
        ${admin?"":`<button class="btn danger" type="button" onclick="if(confirm('Usunąć konto ${esc(k.email)}?')){usunKlienta('${esc(k.email)}');location.hash='#/admin/klienci';}">🗑️ Usuń konto</button>`}
      </div>
    </form>
  </div>
  ${zam.length?`<div class="panel">
    <h2 style="margin-top:0">🕐 Ostatnie zamówienia klienta</h2>
    <table class="mini-tab">${zam.slice(0,5).map(z=>`
      <tr><td><a href="#/admin/zamowienie/${encodeURIComponent(z.nr)}"><b>${esc(z.nr)}</b></a></td>
      <td>${esc(z.data)}</td><td><span class="lvl" style="background:${KOLOR_STATUSU[z.status]||'var(--bg)'}">${esc(z.status)}</span></td>
      <td style="text-align:right"><b>${zl(z.razem)}</b></td></tr>`).join("")}</table>
  </div>`:""}`);
}
async function zapiszKartoteke(e, staryEmail){
  e.preventDefault();
  const f = new FormData(e.target);
  const u = pobierzUzytkownikow();
  const k = u.find(x=>x.email===staryEmail);
  if(!k){ toast("Nie znaleziono klienta"); return; }
  const glownyAdmin = jestGlownymAdminem(staryEmail);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  const nowyEmail = glownyAdmin ? staryEmail : String(f.get("email")||"").trim().toLowerCase();
  const noweHaslo = String(f.get("haslo")||"");
  const powtorzoneHaslo = String(f.get("haslo2")||"");
  if(dane.imie.length<2){ toast("⚠️ Podaj imię i nazwisko"); return; }
  if(!nowyEmail.includes("@")){ toast("⚠️ Nieprawidłowy e-mail"); return; }
  if(nowyEmail!==staryEmail && u.some(x=>x.email===nowyEmail)){ toast("⚠️ Ten e-mail jest już zajęty"); return; }
  if(noweHaslo && noweHaslo.length<6){ toast("⚠️ Nowe hasło: min. 6 znaków"); return; }
  if(noweHaslo!==powtorzoneHaslo){ toast("⚠️ Wpisane nowe hasła nie są takie same"); return; }
  Object.assign(k, dane, {email: nowyEmail});
  if(noweHaslo){ k.hash = await hashuj(noweHaslo); if(glownyAdmin) domyslneHasloAdmina = noweHaslo==="admin"; }
  zapiszLS("artway_uzytkownicy", u);
  void zapiszUzytkownikaCentralnie(k);
  if(nowyEmail!==staryEmail){
    const zam = pobierzZamowienia();
    zam.forEach(z=>{ if(z.email===staryEmail) z.email=nowyEmail; });
    zapiszLS("artway_zamowienia", zam);
    if(stanBramki.authenticated){
      void wywolajBramke("store-user-delete",{method:"POST",body:{email:staryEmail}}).catch(()=>{});
      zam.filter(z=>z.email===nowyEmail).forEach(z=>void zapiszZamowienieCentralnie(z,false));
    }
    if(sesja?.email===staryEmail) ustawSesje({imie:dane.imie, email:nowyEmail, rola:k.rola||"klient"});
    location.hash = "#/admin/klient/"+encodeURIComponent(nowyEmail);
  } else if(sesja?.email===staryEmail && sesja.imie!==dane.imie){
    ustawSesje({imie:dane.imie, email:staryEmail, rola:k.rola||"klient"});
  }
  loguj("info",`Zapisano kartotekę klienta ${staryEmail}${nowyEmail!==staryEmail?" → "+nowyEmail:""}${noweHaslo?" (nowe hasło)":""}`);
  toast("Kartoteka zapisana ✅"); renderuj();
}
async function dodajKlientaAdmin(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const dane = daneKartotekiZFormularza(f);
  if(dane.blad){ toast("⚠️ "+dane.blad); return; }
  if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ toast("⚠️ Wpisane hasła nie są takie same"); return; }
  const wynik = await zarejestrujUzytkownika(String(f.get("imie")),String(f.get("email")),String(f.get("haslo")));
  if(!wynik.ok){ toast("⚠️ "+wynik.blad); return; }
  // dopisz pełną kartotekę (adres, firma, notatka)
  const u = pobierzUzytkownikow();
  const k = u.find(x=>x.email===String(f.get("email")).trim().toLowerCase());
  if(k){ Object.assign(k, dane); zapiszLS("artway_uzytkownicy", u); }
  if(k) void zapiszUzytkownikaCentralnie(k);
  loguj("info","Utworzono kartotekę klienta: "+f.get("email"));
  toast("Konto klienta z kartoteką utworzone ✅"); renderuj();
}
function usunKlienta(email){
  if(kontoMaRoleAdmin(email)){ toast("Najpierw odbierz temu kontu rolę administratora"); return; }
  zapiszLS("artway_uzytkownicy", pobierzUzytkownikow().filter(x=>x.email!==email));
  if(stanBramki.authenticated) void wywolajBramke("store-user-delete",{method:"POST",body:{email}}).catch(bl=>toast("Nie usunięto klienta z serwera: "+bl.message));
  loguj("info","Usunięto konto klienta: "+email);
  toast("Usunięto konto "+email);
  renderuj();
}
let szukajProduktow = "", filtrProduktow = "Wszystkie", kategoriaNowegoProduktu = "";
let filtrStatusuProduktow = "aktywne", filtrZrodlaProduktow = "wszystkie", filtrStanuProduktow = "wszystkie", filtrAllegroProduktow = "wszystkie";
let sortowanieAdminProduktow = ["external","id","nazwa","cena-rosnaco","cena-malejaco","stan"].includes(wczytajLS("artway_produkty_sortowanie_admin","external"))?wczytajLS("artway_produkty_sortowanie_admin","external"):"external";
let stronaAdminProduktow = 1;
let produktyNaStronieAdmin = [25,50,100,200,500,1000].includes(Number(wczytajLS("artway_produkty_na_stronie_admin",50)))?Number(wczytajLS("artway_produkty_na_stronie_admin",50)):50;
let frazaMagazynu="", filtrMagazynu="wszystkie", filtrDostawcyMagazynu="wszyscy", filtrLokalizacjiMagazynu="wszystkie", filtrInwentaryzacjiMagazynu="wszystkie", sortowanieMagazynu="ryzyko", stronaMagazynu=1, szukajProducentowMagazynu="", filtrProducentowMagazynu="decyzje";
let magazynNaStronie=[25,50,100,200,500].includes(Number(wczytajLS("artway_magazyn_na_stronie",50)))?Number(wczytajLS("artway_magazyn_na_stronie",50)):50;
function ustawKafelkowyFiltrAsortymentu(typ="aktywne"){
  szukajProduktow="";filtrProduktow="Wszystkie";filtrZrodlaProduktow="wszystkie";filtrStanuProduktow="wszystkie";filtrStatusuProduktow="aktywne";filtrAllegroProduktow="wszystkie";
  if(typ==="allegro_polaczone")filtrAllegroProduktow="polaczone";
  else if(typ==="allegro_duplikaty")filtrAllegroProduktow="duplikaty";
  else if(typ==="allegro_brak")filtrAllegroProduktow="brak";
  else if(typ==="duplikaty_sklepu")filtrStatusuProduktow="duplikaty";
  stronaAdminProduktow=1;renderuj();
  setTimeout(()=>document.querySelector("[data-assortment-results]")?.scrollIntoView({behavior:"smooth",block:"start"}),30);
}
function dokumentTymczasowyHTML(html){const tpl=document.createElement("template");tpl.innerHTML=String(html||"").trim();return tpl.content;}
function asortymentSzukajProdukty(input){
  szukajProduktow=String(input?.value||"");stronaAdminProduktow=1;clearTimeout(window.__assortmentSearch);
  window.__assortmentSearch=setTimeout(()=>{const current=document.querySelector("[data-assortment-results]"),source=dokumentTymczasowyHTML(widokAdminProdukty()).querySelector("[data-assortment-results]");if(current&&source)current.innerHTML=source.innerHTML;},140);
}
function magazynSzukajProdukty(input){
  frazaMagazynu=String(input?.value||"");stronaMagazynu=1;clearTimeout(window.__warehouseSearch);
  window.__warehouseSearch=setTimeout(()=>{
    const current=document.querySelector(".warehouse-stock-page"),source=dokumentTymczasowyHTML(widokAdminMagazyn("stany")).querySelector(".warehouse-stock-page");if(!current||!source)return;
    for(const selector of [".warehouse-stock-results",".warehouse-stock-list"]){const a=current.querySelector(selector),b=source.querySelector(selector);if(a&&b)a.innerHTML=b.innerHTML;}
    const aPages=current.querySelectorAll(":scope > .pagination"),bPages=source.querySelectorAll(":scope > .pagination");aPages.forEach((el,i)=>{if(bPages[i])el.innerHTML=bPages[i].innerHTML;});
    const aConfirm=current.querySelector("[data-stock-confirm-visible]"),bConfirm=source.querySelector("[data-stock-confirm-visible]");if(aConfirm&&bConfirm)aConfirm.replaceWith(bConfirm);
  },140);
}
function jestProduktemDodanym(id){ return produktyDodane.some(p=>Number(p.id)===Number(id)); }
function produktDodanyPoId(id){ return produktyDodane.find(p=>Number(p.id)===Number(id)); }
function czyProduktAdminWKoszu(p){
  if(!p) return false;
  if(jestProduktemDodanym(p.id)) return false;
  return produktyUkryte.includes(p.id);
}
function bazoweProduktyWKoszu(){
  const dodaneIds=new Set(produktyDodane.map(p=>Number(p.id)));
  return produktyUkryte
    .filter(id=>!dodaneIds.has(Number(id))&&koszMeta[id]&&!produktyDefinitywne.includes(id))
    .map(id=>prodBazowe.find(x=>Number(x.id)===Number(id)))
    .filter(Boolean);
}
function produktyDoAdministracji(){
  naprawKolizjeIdProduktow();
  const dodaneIds = new Set(produktyDodane.map(p=>Number(p.id)));
  return [
    ...prodBazowe.filter(p=>!dodaneIds.has(Number(p.id))&&!produktyDefinitywne.includes(p.id)).map(p=>produktyEdytowane[p.id] ? {...p, ...produktyEdytowane[p.id], id:p.id} : p),
    ...produktyDodane
  ];
}
function pobierzProduktAdmin(id){ return produktDodanyPoId(id) || produktyDoAdministracji().find(p=>p.id===id); }
function ustawStroneAdminProduktow(n){ stronaAdminProduktow=Math.max(1,Number(n)||1); renderuj(); }
function ustawProduktyNaStronieAdmin(n){
  produktyNaStronieAdmin=[25,50,100,200,500,1000].includes(Number(n))?Number(n):50;
  stronaAdminProduktow=1;
  zapiszLS("artway_produkty_na_stronie_admin",produktyNaStronieAdmin);
  renderuj();
}
function ustawSortowanieAdminProduktow(v){sortowanieAdminProduktow=String(v||"external");stronaAdminProduktow=1;zapiszLS("artway_produkty_sortowanie_admin",sortowanieAdminProduktow);renderuj();}
function sortujProduktyAdmin(lista){
  return [...lista].sort((a,b)=>{
    if(sortowanieAdminProduktow==="external"){
      const aa=String(a.externalId||a.sku||a.gtin||a.ean||"").trim(),bb=String(b.externalId||b.sku||b.gtin||b.ean||"").trim();
      if(!aa&&!bb)return Number(a.id)-Number(b.id);if(!aa)return 1;if(!bb)return -1;return aa.localeCompare(bb,"pl",{numeric:true,sensitivity:"base"})||Number(a.id)-Number(b.id);
    }
    if(sortowanieAdminProduktow==="nazwa") return a.nazwa.localeCompare(b.nazwa,"pl");
    if(sortowanieAdminProduktow==="cena-rosnaco") return a.cena-b.cena;
    if(sortowanieAdminProduktow==="cena-malejaco") return b.cena-a.cena;
    if(sortowanieAdminProduktow==="stan"){
      const sa=stanyProduktow[a.id]===undefined?Number.MAX_SAFE_INTEGER:Number(stanyProduktow[a.id]);
      const sb=stanyProduktow[b.id]===undefined?Number.MAX_SAFE_INTEGER:Number(stanyProduktow[b.id]);
      return sa-sb;
    }
    return Number(a.id)-Number(b.id);
  });
}
function statusZamowieniaRezerwujeMagazyn(z){
  const s=String(z?.status||"").toLowerCase();
  return !!z && !["anulowane","dostarczone","zakończone","zwrot","zwrot pieniędzy"].includes(s);
}
function pozycjeZamowieniaMagazyn(z){
  if(Array.isArray(z?.pozycjeDane)&&z.pozycjeDane.length) return z.pozycjeDane.map(p=>({
    id:p.id, nazwa:p.nazwa||p.produkt||"Produkt", sku:p.sku||"", ilosc:Number(p.ilosc)||1, cena:kwotaNum(p.cena), wartosc:kwotaNum(p.wartosc||kwotaNum(p.cena)*(Number(p.ilosc)||1))
  })).filter(p=>p.id!==undefined&&p.id!==null&&p.id!=="");
  return [];
}
function statusAllegroRezerwujeMagazyn(z){
  return !!z && !allegroZamowienieZrealizowaneLokalnie(z) && String(z.status||"").toUpperCase()!=="CANCELLED" && !["SENT","PICKED_UP","CANCELLED","RETURNED"].includes(allegroStatusKolejki(z));
}
function aktywneZamowieniaAllegro(){
  return (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).filter(statusAllegroRezerwujeMagazyn);
}
function pozycjeAllegroMagazyn(z){
  const items=Array.isArray(z?.lineItems)?z.lineItems:[];
  return items.map(it=>{
    const offerId=String(it.offerId||it.offer?.id||it.id||"").trim();
    const dane=allegroDanePozycjiZamowienia({...it,offerId});
    const ilosc=Math.max(1,Number(it.quantity??it.qty??it.quantityOrdered)||1);
    const dopasowanie=allegroDopasowaniePozycjiDoProduktu({...it,offerId}),mapped=dopasowanie.produkt||null;
    return {
      id:mapped?.id??"",
      offerId,
      externalId:dane.kod,
      ean:dane.ean,
      nazwa:dane.nazwa,
      sku:dane.kod,
      ilosc,
      cena:kwotaNum(it.price?.amount ?? it.price ?? it.unitPrice),
      wartosc:kwotaNum(it.value ?? (kwotaNum(it.price?.amount ?? it.price ?? it.unitPrice)*ilosc)),
      produkt:mapped,
      match:dopasowanie.match,
      confidence:dopasowanie.confidence,
      candidates:dopasowanie.candidates||[]
    };
  });
}
function rezerwacjeMagazynowe(){
  if(rezerwacjeMagazynowe._cache&&Date.now()-rezerwacjeMagazynowe._cache.at<1500)return rezerwacjeMagazynowe._cache.value;
  const mapa={};
  pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).forEach(z=>{
    pozycjeZamowieniaMagazyn(z).forEach(p=>{ mapa[p.id]=(mapa[p.id]||0)+p.ilosc; });
  });
  aktywneZamowieniaAllegro().forEach(z=>pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{mapa[p.id]=(mapa[p.id]||0)+p.ilosc;}));
  rezerwacjeMagazynowe._cache={at:Date.now(),value:mapa};
  return mapa;
}
function allegroAnalizaMagazynowaZamowienia(z){
  const rez=rezerwacjeMagazynowe();
  const pozycje=pozycjeAllegroMagazyn(z).map(p=>{
    const stan=p.produkt?stanMagazynuId(p.produkt.id):null,meta=p.produkt?magazynMetaProduktu(p.produkt.id):{};
    const laczne=p.produkt?Number(rez[p.produkt.id]||0):0,dostepne=stan===null?null:stan-laczne;
    const brak=!p.produkt||stan===null?null:Math.max(0,-dostepne),lokalizacja=String(meta.lokalizacja||"").trim(),dostawca=String(meta.dostawca||"").trim();
    const dokumenty=p.produkt?(agentAIZlecenia||[]).filter(doc=>!["zrealizowane","anulowane"].includes(String(doc.status||"").toLowerCase())&&(doc.pozycje||[]).some(x=>String(x.produktId)===String(p.produkt.id))).map(doc=>({id:doc.id,numer:doc.numer||doc.id,status:doc.status||"szkic"})):[];
    const decyzja=!p.produkt?"nierozpoznany":stan===null?"sprawdz_stan":brak>0?"zamow_u_producenta":!lokalizacja?"uzupelnij_lokalizacje":"kompletuj";
    return {...p,stan,laczneRezerwacje:laczne,dostepne,brak,lokalizacja,dostawca,dokumentyProducenta:dokumenty,decyzja};
  });
  const nierozpoznane=pozycje.filter(p=>!p.produkt).length,bezStanu=pozycje.filter(p=>p.produkt&&p.stan===null).length,bezLokalizacji=pozycje.filter(p=>p.produkt&&p.stan!==null&&!p.brak&&!p.lokalizacja).length,braki=pozycje.reduce((s,p)=>s+Number(p.brak||0),0);
  return {pozycje,nierozpoznane,bezStanu,bezLokalizacji,braki,gotowe:nierozpoznane===0&&bezStanu===0&&bezLokalizacji===0&&braki===0};
}
function dataZamowieniaMs(z={}){const raw=z.ts??z.createdAt??z.firstFetchedAt??z.data??z.date??"",n=Number(raw);return Number.isFinite(n)&&n>1e9?(n<1e11?n*1000:n):(Date.parse(raw)||0);}
function sprzedazKanalyMagazynowe(dni=30){
  const key=String(dni),cached=sprzedazKanalyMagazynowe._cache?.[key];if(cached&&Date.now()-cached.at<5000)return cached.value;
  const sklep={},allegro={},razem={},od=Date.now()-dni*86400000;
  pobierzZamowienia().filter(z=>String(z.status||"").toLowerCase()!=="anulowane"&&dataZamowieniaMs(z)>=od).forEach(z=>pozycjeZamowieniaMagazyn(z).forEach(p=>{sklep[p.id]=(sklep[p.id]||0)+p.ilosc;}));
  (Array.isArray(allegroZamowienia)?allegroZamowienia:[]).filter(z=>String(z.status||"").toUpperCase()!=="CANCELLED"&&dataZamowieniaMs(z)>=od).forEach(z=>pozycjeAllegroMagazyn(z).filter(p=>p.id!=="").forEach(p=>{allegro[p.id]=(allegro[p.id]||0)+p.ilosc;}));
  new Set([...Object.keys(sklep),...Object.keys(allegro)]).forEach(id=>{razem[id]=Number(sklep[id]||0)+Number(allegro[id]||0);});
  const value={sklep,allegro,razem,dni};sprzedazKanalyMagazynowe._cache={...(sprzedazKanalyMagazynowe._cache||{}),[key]:{at:Date.now(),value}};return value;
}
function sprzedazMagazynowa(dni=30){return sprzedazKanalyMagazynowe(dni).razem;}
function priorytetDostepnosciProduktu(p={},kanaly=sprzedazKanalyMagazynowe(30),rez=rezerwacjeMagazynowe()){
  const id=String(p.id),sklep=Number(kanaly.sklep[id]||p.sprzedazSklep30||0),allegro=Number(kanaly.allegro[id]||p.sprzedazAllegro30||0),active=Number(rez[id]||p.aktywneZapotrzebowanie||0),score=sklep*4+allegro*5+active*8;
  return {sklep,allegro,razem:sklep+allegro,active,score,channel:allegro>sklep?"Allegro":sklep>allegro?"Sklep":allegro||sklep?"Oba kanały":"Brak sprzedaży",level:score>=40?"krytyczny":score>=15?"wysoki":score>0?"standard":"niski"};
}
function rankingDostepnosciProducentow(lista=produktyMonitorowaneUProducentow()){
  const kanaly=sprzedazKanalyMagazynowe(30),rez=rezerwacjeMagazynowe();return lista.map(p=>({p,priority:priorytetDostepnosciProduktu(p,kanaly,rez),availability:producentDostepnoscInfo(p)})).sort((a,b)=>b.priority.score-a.priority.score||b.availability.ageHours-a.availability.ageHours||String(a.p.nazwa||"").localeCompare(String(b.p.nazwa||""),"pl")).map((x,index)=>({...x,rank:index+1}));
}
function filtrujProduktyMagazynu(lista, rez, sprzedaz){
  const u=ustawieniaMagazynuPelne(), prog=Math.max(0,Number(u.progNiski)||5);
  let out=lista.filter(p=>!czyProduktAdminWKoszu(p));
  if(frazaMagazynu) out=out.filter(p=>{
    const meta=magazynMetaProduktu(p.id);
    const kartoteka=[meta.lokalizacja,nazwaLokalizacjiMagazynu(meta.lokalizacja),meta.dostawca,meta.kod,meta.uwagi].filter(Boolean).join(" ");
    return produktPasujeFrazie(p,frazaMagazynu)||String(p.sku||"").toLowerCase().includes(frazaMagazynu.toLowerCase())||kartoteka.toLowerCase().includes(frazaMagazynu.toLowerCase());
  });
  if(filtrMagazynu==="monitorowane") out=out.filter(p=>stanMagazynuId(p.id)!==null);
  if(filtrMagazynu==="bezlimitu") out=out.filter(p=>stanMagazynuId(p.id)===null);
  if(filtrMagazynu==="niskie") out=out.filter(p=>{const s=stanMagazynuId(p.id), pr=progNiskiProduktu(p);return s!==null&&s>0&&s<=pr;});
  if(filtrMagazynu==="brak") out=out.filter(p=>stanMagazynuId(p.id)===0);
  if(filtrMagazynu==="rezerwacje") out=out.filter(p=>Number(rez[p.id]||0)>0);
  if(filtrMagazynu==="sprzedaz") out=out.filter(p=>Number(sprzedaz[p.id]||0)>0);
  if(filtrMagazynu==="bestsellery") out=out.filter(p=>priorytetDostepnosciProduktu(p).score>0);
  if(filtrMagazynu==="alerty") out=out.filter(p=>{const i=producentDostepnoscInfo(p),d=dostepneSztukiMagazynu(p,rez),plan=sugestiaZatowarowania(p,rez,sprzedaz);return i.alert||d!==null&&d<0||Number(plan.ilosc||0)>0;});
  if(filtrMagazynu==="dozamowienia") out=out.filter(p=>Number(sugestiaZatowarowania(p,rez,sprzedaz).ilosc)>0);
  if(filtrMagazynu==="nadrezerwacja") out=out.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;});
  if(filtrMagazynu==="producent-niski") out=out.filter(p=>producentDostepnoscInfo(p).status==="niski");
  if(filtrMagazynu==="producent-brak") out=out.filter(p=>producentDostepnoscInfo(p).status==="brak");
  if(filtrMagazynu==="producent-nieznany") out=out.filter(p=>{const i=producentDostepnoscInfo(p);return !i.url||i.stale||["nieznany","blad"].includes(i.status);});
  if(filtrMagazynu==="bezlokalizacji") out=out.filter(p=>!magazynMetaProduktu(p.id).lokalizacja);
  if(filtrMagazynu==="bezdostawcy") out=out.filter(p=>!magazynMetaProduktu(p.id).dostawca);
  if(filtrDostawcyMagazynu!=="wszyscy") out=out.filter(p=>String(magazynMetaProduktu(p.id).dostawca||"")===filtrDostawcyMagazynu);
  if(filtrLokalizacjiMagazynu!=="wszystkie") out=out.filter(p=>String(magazynMetaProduktu(p.id).lokalizacja||"BRAK")===filtrLokalizacjiMagazynu);
  if(filtrInwentaryzacjiMagazynu!=="wszystkie") out=out.filter(p=>{const d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja,t=d?Date.parse(d):0,stara=!t||(Date.now()-t)>90*86400000;return filtrInwentaryzacjiMagazynu==="aktualna"?!stara:stara;});
  return sortujProduktyMagazynu(out, rez, sprzedaz, prog);
}
function sortujProduktyMagazynu(lista, rez={}, sprzedaz={}, prog=5){
  const planCache=new Map();
  const plan=p=>{
    const key=String(p.id);
    if(!planCache.has(key)) planCache.set(key,sugestiaZatowarowania(p,rez,sprzedaz));
    return planCache.get(key);
  };
  return [...lista].sort((a,b)=>{
    const sa=stanMagazynuId(a.id), sb=stanMagazynuId(b.id);
    if(sortowanieMagazynu==="nazwa") return String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="stan") return (sa===null?Number.MAX_SAFE_INTEGER:sa)-(sb===null?Number.MAX_SAFE_INTEGER:sb);
    if(sortowanieMagazynu==="rezerwacje") return Number(rez[b.id]||0)-Number(rez[a.id]||0);
    if(sortowanieMagazynu==="sprzedaz") return Number(sprzedaz[b.id]||0)-Number(sprzedaz[a.id]||0);
    if(sortowanieMagazynu==="priorytet") return priorytetDostepnosciProduktu(b).score-priorytetDostepnosciProduktu(a).score||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
    if(sortowanieMagazynu==="wartosc") return ((sb||0)*kwotaNum(b.cena))-((sa||0)*kwotaNum(a.cena));
    if(sortowanieMagazynu==="dostepne") return (dostepneSztukiMagazynu(a,rez)??Number.MAX_SAFE_INTEGER)-(dostepneSztukiMagazynu(b,rez)??Number.MAX_SAFE_INTEGER);
    if(sortowanieMagazynu==="zakup") return Number(plan(b).ilosc||0)-Number(plan(a).ilosc||0);
    if(sortowanieMagazynu==="producent"){const rank={brak:0,niski:1,nieznany:2,blad:2,dostepny_nieznany:3,dostepny:4},ia=producentDostepnoscInfo(a),ib=producentDostepnoscInfo(b);return (rank[ia.status]??5)-(rank[ib.status]??5)||(ia.quantity??Number.MAX_SAFE_INTEGER)-(ib.quantity??Number.MAX_SAFE_INTEGER)||String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");}
    const supplierRank={brak:0,niski:1,nieznany:2,blad:2,dostepny_nieznany:3,dostepny:4},ia=producentDostepnoscInfo(a),ib=producentDostepnoscInfo(b),supplierDiff=(supplierRank[ia.status]??5)-(supplierRank[ib.status]??5);
    if(supplierDiff)return supplierDiff;
    const planDiff=Number(plan(b).ilosc||0)-Number(plan(a).ilosc||0);if(planDiff)return planDiff;
    const priorityDiff=priorytetDostepnosciProduktu(b).score-priorytetDostepnosciProduktu(a).score;if(priorityDiff)return priorityDiff;
    const ra=sa===null?999999:(sa===0?0:(sa<=prog?sa:100000+sa));
    const rb=sb===null?999999:(sb===0?0:(sb<=prog?sb:100000+sb));
    return ra-rb || String(a.nazwa||"").localeCompare(String(b.nazwa||""),"pl");
  });
}
function stanBadgeMagazynu(stan, prog){
  if(stan===null) return `<span class="lvl lvl-info">bez limitu</span>`;
  if(stan===0) return `<span class="lvl lvl-blad">brak</span>`;
  if(stan<=prog) return `<span class="lvl lvl-ostrzezenie">niski</span>`;
  return `<span class="lvl lvl-ok">OK</span>`;
}
function ustawFiltrMagazynu(filtr, sort="ryzyko"){
  frazaMagazynu="";
  filtrMagazynu=filtr||"wszystkie";
  sortowanieMagazynu=sort||"ryzyko";
  stronaMagazynu=1;
  renderuj();
}
function wyczyscFiltryStanowMagazynu(){
  frazaMagazynu="";filtrMagazynu="wszystkie";filtrDostawcyMagazynu="wszyscy";filtrLokalizacjiMagazynu="wszystkie";filtrInwentaryzacjiMagazynu="wszystkie";sortowanieMagazynu="ryzyko";stronaMagazynu=1;renderuj();
}
function ustawStroneMagazynu(n){ stronaMagazynu=Math.max(1,Number(n)||1); renderuj(); }
function ustawMagazynNaStronie(n){
  magazynNaStronie=[25,50,100,200,500].includes(Number(n))?Number(n):50;
  stronaMagazynu=1; zapiszLS("artway_magazyn_na_stronie",magazynNaStronie); renderuj();
}
function korygujStanMagazynu(e,id){
  e.preventDefault();
  const f=new FormData(e.target), stan=String(f.get("stan")??"").trim(), powod=String(f.get("powod")||"").trim()||"Korekta z panelu magazynu";
  const wynik=ustawStanMagazynowy(id, stan, {typ:"korekta",powod});
  loguj("info",`Magazyn: korekta ${id}, ${wynik.przed===null?"∞":wynik.przed} → ${wynik.po===null?"∞":wynik.po}`);
  toast("Korekta magazynu zapisana ✅"); renderuj();
}
function szybkaKorektaMagazynu(id, delta){
  const przed=stanMagazynuId(id);
  if(przed===null){ toast("Najpierw wpisz konkretny stan — produkt jest bez limitu"); return; }
  ustawStanMagazynowy(id, Math.max(0,przed+Number(delta||0)), {typ:Number(delta)>0?"przyjęcie":"korekta",powod:Number(delta)>0?"Szybkie przyjęcie":"Szybkie zmniejszenie"});
  toast(`Stan zmieniony: ${przed} → ${Math.max(0,przed+Number(delta||0))}`);renderuj();
}
function zapiszUstawieniaMagazynu(e){
  e.preventDefault();
  const f=new FormData(e.target);
  ustawieniaMagazynu={
    ...ustawieniaMagazynu,
    nazwa:String(f.get("nazwa")||"Magazyn główny").trim()||"Magazyn główny",
    progNiski:Math.max(0,parseInt(f.get("progNiski"),10)||5),
    lokalizacja:String(f.get("lokalizacja")||"").trim(),
    domyslnyOperator:String(f.get("operator")||sesja?.email||"administrator").trim(),
    domyslnyDostawca:String(f.get("domyslnyDostawca")||"").trim(),
    domyslnyLeadTime:Math.max(0,parseInt(f.get("domyslnyLeadTime"),10)||7),
    domyslnyZapasDni:Math.max(7,parseInt(f.get("domyslnyZapasDni"),10)||21),
    progNiskiProducenta:Math.max(1,parseInt(f.get("progNiskiProducenta"),10)||50),
    producentProbka:Math.max(1,Math.min(25,parseInt(f.get("producentProbka"),10)||8)),
    producentMaxWiekGodz:Math.max(1,parseInt(f.get("producentMaxWiekGodz"),10)||48)
  };
  zapiszLS("artway_magazyn_ustawienia",ustawieniaMagazynu);
  if(chmuraToken)void chmuraZapiszUstawienia();
  loguj("info","Zapisano ustawienia magazynu");
  toast("Ustawienia magazynu zapisane ✅"); renderuj();
}
function eksportujMagazynCSV(){
  const rez=rezerwacjeMagazynowe(), spr=sprzedazMagazynowa(30);
  const rows=[["id","sku","nazwa","kategoria","producent","url_zrodlowy","status_u_producenta","stan_u_producenta","stan_producenta_dokladny","sprawdzono_u_producenta","stan_lokalny","bez_limitu","dostepne_po_rezerwacjach","zarezerwowane","sprzedaz_30_dni","min_stock","target_stock","lead_time_dni","lokalizacja","dostawca","kod","sugerowany_zakup","cena_brutto","wartosc_stanu"].join(";")];
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    const stan=stanMagazynuId(p.id), plan=sugestiaZatowarowania(p,rez,spr), meta=magazynMetaProduktu(p.id), wart=stan===null?"":kwotaNum(stan*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    const prod=producentDostepnoscInfo(p);rows.push([p.id,p.sku||"",p.nazwa,p.kategoria,p.producent||p.marka||"",prod.url,prod.status,prod.quantity??"",prod.exact?"tak":"nie",prod.checked,stan===null?"":stan,stan===null?"tak":"nie",plan.dostepne===null?"":plan.dostepne,rez[p.id]||0,spr[p.id]||0,plan.min,plan.target,plan.lead,meta.lokalizacja||"",meta.dostawca||"",meta.kod||"",plan.ilosc||0,kwotaNum(p.cena).toFixed(2).replace(".",","),wart].map(csvPole).join(";"));
  });
  pobierzPlik("magazyn-artway.csv","\uFEFF"+rows.join("\n"),"text/csv");
  loguj("info","Wyeksportowano magazyn CSV");
}
function eksportujZatowarowanieCSV(){
  const plan=potrzebyZatowarowania();
  const rows=[["id","sku","nazwa","kategoria","dostawca","lokalizacja","stan","dostepne_po_rezerwacjach","sprzedaz_30_dni","min_stock","target_stock","lead_time_dni","sugerowana_ilosc","cena_brutto","szacowana_wartosc"].join(";")];
  plan.forEach(x=>{
    const p=x.produkt, meta=x.meta, wart=kwotaNum((x.ilosc||0)*kwotaNum(p.cena)).toFixed(2).replace(".",",");
    rows.push([p.id,p.sku||"",p.nazwa,p.kategoria,meta.dostawca||"",meta.lokalizacja||"",x.stan===null?"":x.stan,x.dostepne===null?"":x.dostepne,x.sprzedaz30,x.min,x.target,x.lead,x.ilosc,kwotaNum(p.cena).toFixed(2).replace(".",","),wart].map(csvPole).join(";"));
  });
  pobierzPlik("zatowarowanie-artway.csv","\uFEFF"+rows.join("\n"),"text/csv");
  zapiszHistorieAgenta("zatowarowanie","Wyeksportowano plan zatowarowania",{pozycji:plan.length});
  loguj("info","Wyeksportowano plan zatowarowania CSV");
}
function wypelnijDomyslnaKartotekeMagazynu(){
  const u=ustawieniaMagazynuPelne();
  if(!u.domyslnyDostawca&&!u.lokalizacja){ toast("Najpierw wpisz domyślnego dostawcę lub lokalizację w ustawieniach magazynu"); return; }
  if(!confirm("Uzupełnić brakujące pola kartoteki domyślnym dostawcą/lokalizacją? Istniejących wartości nie nadpiszę.")) return;
  let ile=0;
  produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{
    const m=magazynMetaProduktu(p.id);
    if((u.domyslnyDostawca&&!m.dostawca)||(u.lokalizacja&&!m.lokalizacja)){
      zapiszMagazynMeta(p.id,{...m,dostawca:m.dostawca||u.domyslnyDostawca,lokalizacja:m.lokalizacja||u.lokalizacja});
      ile++;
    }
  });
  zapiszHistorieAgenta("kartoteka",`Uzupełniono domyślne dane kartoteki dla ${ile} produktów`,{produkty:ile});
  toast(`Uzupełniono kartotekę: ${ile} produktów ✅`);
  renderuj();
}
function audytMagazynuAI(){
  const plan=potrzebyZatowarowania(), rez=rezerwacjeMagazynowe(), wszystkie=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const brakLok=wszystkie.filter(p=>!magazynMetaProduktu(p.id).lokalizacja).length;
  const brakDos=wszystkie.filter(p=>!magazynMetaProduktu(p.id).dostawca).length;
  const nad=wszystkie.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;}).length;
  const rec=zapiszHistorieAgenta("audyt","Utworzono audyt magazynu",{produkty:wszystkie.length,doZamowienia:plan.length,brakLokalizacji:brakLok,brakDostawcy:brakDos,nadrezerwacje:nad});
  pobierzPlik("audyt-magazynu-agent-ai.json",JSON.stringify(rec,null,2),"application/json");
  toast("Audyt magazynu zapisany i pobrany ✅");
  renderuj();
}
function daneSzkicuFakturyZamowienia(nr){
  const z=pobierzZamowienia().find(x=>x.nr===nr); if(!z) return null;
  const k=z.klient||{}, a=z.adresDostawy||{}, koszty=kosztyZamowienia(z);
  const kontrahent={
    nazwa:k.firma||`${k.imie||""} ${k.nazwisko||""}`.trim()||z.email||"Klient",
    nip:String(k.nip||"").replace(/[^0-9]/g,""),
    email:z.email||"",
    telefon:k.telefon||"",
    adres:[a.ulica&&`${a.ulica} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`,[a.kod,a.miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ")||z.adres||""
  };
  const pozycje=pozycjeZamowieniaMagazyn(z).map(p=>({nazwa:p.nazwa,sku:p.sku||"",ilosc:p.ilosc,cenaBrutto:kwotaNum(p.cena),wartoscBrutto:kwotaNum(p.wartosc),vat:"23%"}));
  if(koszty.dostawa||koszty.paczkaWeekend||koszty.platnosc){
    pozycje.push({nazwa:"Dostawa i usługi dodatkowe",sku:"DOSTAWA",ilosc:1,cenaBrutto:kwotaNum(koszty.dostawa+koszty.paczkaWeekend+koszty.platnosc),wartoscBrutto:kwotaNum(koszty.dostawa+koszty.paczkaWeekend+koszty.platnosc),vat:"23%"});
  }
  return {
    id:"FV-SZKIC-"+Date.now().toString(36),
    provider:"inFakt",
    status:"szkic",
    apiStatus:"nie wysłano",
    nrZamowienia:z.nr,
    data:new Date().toISOString(),
    dataTxt:new Date().toLocaleString("pl-PL"),
    sprzedawca:daneFirmy(),
    kontrahent,
    pozycje,
    sumaBrutto:kwotaNum(koszty.razem),
    waluta:"PLN",
    uwagi:"Szkic przygotowany w panelu Artway-TM. Wysyłka do inFakt będzie aktywna po podłączeniu tokenu API."
  };
}
function utworzSzkicFaktury(nr){
  const szkic=daneSzkicuFakturyZamowienia(nr);
  if(!szkic){ toast("Nie znaleziono zamówienia"); return; }
  szkiceFaktur=[szkic,...szkiceFaktur.filter(x=>x.nrZamowienia!==nr)].slice(0,2000);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  loguj("info","Utworzono szkic FV pod inFakt dla "+nr);
  toast("Szkic faktury przygotowany ✅"); renderuj();
}
function usunSzkicFaktury(id){
  szkiceFaktur=szkiceFaktur.filter(x=>x.id!==id);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  toast("Szkic FV usunięty"); renderuj();
}
function zmienStatusSzkicuFaktury(id,status){
  szkiceFaktur=szkiceFaktur.map(x=>x.id===id?{...x,status,aktualizacja:new Date().toISOString()}:x);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  toast("Status szkicu FV zapisany"); renderuj();
}
function eksportujSzkiceFakturJSON(){
  pobierzPlik("szkice-faktur-infakt.json",JSON.stringify(szkiceFaktur,null,2),"application/json");
}
async function infaktLaduj(cicho=false,pobierzFaktury=false){
  if(infaktStan.ladowanie)return;infaktStan={...infaktStan,ladowanie:true};
  try{
    const d=await chmura("infakt-status",{params:{verify:1},timeout:30000});
    infaktStan={...infaktStan,...(d.config||{}),sprawdzono:true,ladowanie:false,connected:d.connection?.ok===true,connection:d.connection||null,links:d.links||{},suppliers:d.suppliers||infaktStan.suppliers||{items:[]},purchaseSync:d.purchaseSync||infaktStan.purchaseSync||{pendingItems:[],recentMatches:[]},updated_at:d.updated_at||null,error:d.connection?.ok===false?d.connection.error||"Błąd połączenia":""};
    if(pobierzFaktury&&infaktStan.configured){const f=await chmura("infakt-invoices",{params:{limit:infaktLimit,offset:0},timeout:45000});infaktFaktury=Array.isArray(f.invoices)?f.invoices:[];infaktStan={...infaktStan,invoicesLoaded:true,metainfo:f.metainfo||{}};}
    if(!cicho)toast(infaktStan.connected?"Połączenie z inFakt działa ✅":infaktStan.configured?"⚠️ Klucz inFakt wymaga sprawdzenia":"Dodaj klucz API inFakt po stronie serwera");
  }catch(e){infaktStan={...infaktStan,sprawdzono:true,ladowanie:false,connected:false,error:e.message||String(e)};if(!cicho)toast("⚠️ inFakt: "+infaktStan.error);}
  renderuj();
}
async function infaktUtworzFakture(orderNumber){
  try{toast("Przekazuję fakturę klienta do inFakt…");const d=await chmura("infakt-create-invoice",{method:"POST",body:{orderNumber},timeout:60000});if(d.link)infaktStan.links={...(infaktStan.links||{}),[orderNumber]:d.link};toast(d.duplicatePrevented?"Faktura dla tego zamówienia już istnieje — nie utworzono duplikatu":`Zadanie inFakt przyjęte: ${d.link?.taskReference||"oczekuje"}`);renderuj();}catch(e){toast("⚠️ Wystawianie inFakt: "+(e.message||e));}
}
async function infaktLadujKoszty(cicho=false){
  if(infaktStan.costsLoading)return;infaktStan={...infaktStan,costsLoading:true};
  try{const d=await chmura("infakt-costs",{params:{limit:200},timeout:60000});infaktKoszty=Array.isArray(d.costs)?d.costs:[];infaktStan={...infaktStan,costsLoaded:true,costsLoading:false,suppliers:d.suppliers||infaktStan.suppliers,purchaseSync:d.purchaseSync||infaktStan.purchaseSync};if(!cicho)toast(`Pobrano ${infaktKoszty.length} faktur wyłącznie z białej listy dostawców`);}catch(e){infaktStan={...infaktStan,costsLoaded:true,costsLoading:false};if(!cicho)toast("⚠️ Faktury dostawców: "+(e.message||e));}renderuj();
}
async function infaktSynchronizujCenyZakupu(force=false){
  if(infaktStan.purchaseLoading)return;if(force&&!confirm("Ponownie przeanalizować faktury i nadpisać ceny danymi z najnowszych dokumentów?"))return;infaktStan={...infaktStan,purchaseLoading:true};renderuj();
  try{toast("Analizuję pozycje faktur dostawców i dopasowuję ceny zakupu…");const d=await chmura("infakt-purchase-sync",{method:"POST",body:{days:infaktOkresCenZakupu,limit:50,force},timeout:120000});infaktStan={...infaktStan,purchaseLoading:false,purchaseSync:d.purchaseSync||{pendingItems:[],recentMatches:[]}};await chmuraPobierzWszystko();const s=infaktStan.purchaseSync||{};toast(s.available===false?`⚠️ Ceny zakupu: ${s.errors?.[0]||"źródło pozycji faktur jest niedostępne"}`:`✅ Ceny zakupu: zaktualizowano ${s.priceUpdatedCount||0} • oczekuje ${s.pendingCount||0}`);}catch(e){infaktStan={...infaktStan,purchaseLoading:false};toast("⚠️ Ceny zakupu z faktur: "+(e.message||e));}renderuj();
}
function infaktProduktPoReferencji(value=""){
  const raw=String(value||"").trim(),id=raw.split(/\s*[•|]\s*/)[0].trim(),key=raw.toLowerCase().replace(/[^a-z0-9]/g,"");
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).find(p=>String(p.id)===id)||produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).find(p=>[p.gtin,p.ean,p.sku,p.externalId,p.kodProducenta,p.mpn].some(x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"")===key));
}
async function infaktPrzypiszCeneZakupu(itemKey){
  const input=document.querySelector(`[data-infakt-purchase-item="${CSS.escape(String(itemKey))}"]`),produkt=infaktProduktPoReferencji(input?.value||"");if(!produkt){toast("Wybierz produkt z listy albo wpisz dokładne ID, SKU lub EAN");return;}
  try{const d=await chmura("infakt-purchase-match",{method:"POST",body:{itemKey,productId:produkt.id},timeout:60000});infaktStan={...infaktStan,purchaseSync:d.sync||infaktStan.purchaseSync};await chmuraPobierzWszystko();toast(`✅ ${d.product?.name||produkt.nazwa}: cena zakupu ${zl(d.product?.cenaZakupu||0)}`);renderuj();}catch(e){toast("⚠️ Dopasowanie pozycji: "+(e.message||e));}
}
async function infaktCofnijDopasowanie(matchId){
  try{
    const d=await chmura("infakt-purchase-unmatch",{method:"POST",body:{matchId},timeout:60000});
    infaktStan={...infaktStan,purchaseSync:d.sync||infaktStan.purchaseSync};await chmuraPobierzWszystko();
    toast(d.restored===null?`↩️ Cofnięto dopasowanie ${d.product?.name||"produktu"} i usunięto błędną cenę`:`↩️ Cofnięto dopasowanie ${d.product?.name||"produktu"}; przywrócono ${zl(d.restored)}`);
    if(d.requiresResync)await infaktSynchronizujCenyZakupu(true);else renderuj();
  }catch(e){toast("⚠️ Nie cofnięto dopasowania: "+(e.message||e));}
}
function infaktWyczyscFiltryZakupow(){szukajInfaktZakupy="";filtrInfaktZakupy="wszystkie";limitInfaktZakupy=50;renderuj();}
function infaktWyczyscFiltryHistorii(){szukajInfaktHistoria="";filtrInfaktHistoria="aktywne";limitInfaktHistoria=50;renderuj();}
async function infaktZapiszDostawcow(){
  const rows=[...document.querySelectorAll("[data-infakt-supplier]")],items=rows.filter(r=>r.querySelector('input[type="checkbox"]')?.checked).map(r=>({id:r.dataset.id,name:r.dataset.name,sellerName:String(r.querySelector('input[type="text"]')?.value||"").trim(),active:true})).filter(x=>x.sellerName);
  try{const d=await chmura("infakt-supplier-access",{method:"POST",body:{items},timeout:20000});infaktStan={...infaktStan,suppliers:d.suppliers||{items},costsLoaded:false};infaktKoszty=[];toast(`Biała lista zapisana • ${items.length} dostawców`);renderuj();}catch(e){toast("⚠️ Biała lista inFakt: "+(e.message||e));}
}
async function infaktSynchronizuj(){
  try{toast("Sprawdzam zadania, faktury i ceny zakupu inFakt…");const d=await chmura("infakt-sync",{method:"POST",body:{},timeout:120000});infaktStan.links=d.links||infaktStan.links;if(d.purchaseSync)infaktStan.purchaseSync=d.purchaseSync;await infaktLaduj(true,true);await chmuraPobierzWszystko();toast(`inFakt zsynchronizowany • zadania ${d.results?.length||0} • nowe ceny ${d.purchaseSync?.priceUpdatedCount||0}`);}catch(e){toast("⚠️ Synchronizacja inFakt: "+(e.message||e));}
}
function infaktStatusLinkuHTML(link={}){const s=String(link.status||"brak");return s==="created"?`<span class="lvl lvl-ok">wystawiona ${esc(link.invoiceNumber||"")}</span>`:s==="processing"?`<span class="lvl lvl-info">przetwarzanie</span>`:s==="error"?`<span class="lvl lvl-blad">błąd</span>`:`<span class="lvl lvl-ostrzezenie">brak faktury</span>`;}
function infaktKwota(v){return zl((Number(v)||0)/100);}
function infaktSzukajZakupy(input,history=false){
  const value=String(input?.value||"");if(history)szukajInfaktHistoria=value;else szukajInfaktZakupy=value;
  const id=history?"infaktHistorySearch":"infaktPendingSearch";clearTimeout(window.__infaktPurchaseSearch);window.__infaktPurchaseSearch=setTimeout(()=>{renderuj();requestAnimationFrame(()=>{const el=document.getElementById(id);if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}});},180);
}
function infaktCenyZakupuPanelHTML(){
  const s=infaktStan.purchaseSync||{},pendingAll=Array.isArray(s.pendingItems)?s.pendingItems:[],matchesAll=Array.isArray(s.recentMatches)?s.recentMatches:[],products=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const q=normalizujSzukanyTekst(szukajInfaktZakupy),terms=q.split(" ").filter(Boolean);
  const pending=pendingAll.filter(item=>{
    const text=normalizujSzukanyTekst([item.invoiceNumber,item.invoiceDate,item.supplier,item.ean,item.code,item.name,item.reason,item.unitGross].join(" "));
    if(terms.some(term=>!text.includes(term)))return false;
    if(filtrInfaktZakupy==="bez_kodu"&&(item.ean||item.code))return false;
    if(filtrInfaktZakupy==="konflikty"&&!/kilku|konflikt/i.test(item.reason||""))return false;
    if(filtrInfaktZakupy==="sugestie"&&!(item.suggestions||[]).length)return false;
    return true;
  });
  const hq=normalizujSzukanyTekst(szukajInfaktHistoria),hterms=hq.split(" ").filter(Boolean);
  const matches=matchesAll.filter(item=>{
    const reverted=item.status==="reverted",manual=String(item.method||"").includes("ręczne"),text=normalizujSzukanyTekst([item.productName,item.productId,item.invoiceNumber,item.invoiceDate,item.supplier,item.method,item.price].join(" "));
    if(hterms.some(term=>!text.includes(term)))return false;
    if(filtrInfaktHistoria==="aktywne"&&reverted)return false;if(filtrInfaktHistoria==="cofniete"&&!reverted)return false;if(filtrInfaktHistoria==="reczne"&&!manual)return false;if(filtrInfaktHistoria==="automatyczne"&&(manual||reverted))return false;
    return true;
  });
  const pendingFields=`<label class="search-wide">Pozycja faktury<input id="infaktPendingSearch" value="${esc(szukajInfaktZakupy)}" placeholder="Faktura, dostawca, EAN, kod, nazwa lub cena…" oninput="infaktSzukajZakupy(this)" autocomplete="off"></label><label>Powód decyzji<select onchange="filtrInfaktZakupy=this.value;renderuj()"><option value="wszystkie" ${filtrInfaktZakupy==="wszystkie"?"selected":""}>Wszystkie oczekujące</option><option value="bez_kodu" ${filtrInfaktZakupy==="bez_kodu"?"selected":""}>Bez EAN i kodu</option><option value="konflikty" ${filtrInfaktZakupy==="konflikty"?"selected":""}>Konflikty identyfikatorów</option><option value="sugestie" ${filtrInfaktZakupy==="sugestie"?"selected":""}>Z sugestiami agenta</option></select></label><label>Na stronie<select onchange="limitInfaktZakupy=Number(this.value)||50;renderuj()">${[25,50,100,250].map(n=>`<option value="${n}" ${limitInfaktZakupy===n?"selected":""}>${n}</option>`).join("")}</select></label><button class="btn ghost" type="button" onclick="infaktWyczyscFiltryZakupow()">Wyczyść filtry</button>`;
  const historyFields=`<label class="search-wide">Historia dopasowań<input id="infaktHistorySearch" value="${esc(szukajInfaktHistoria)}" placeholder="Produkt, ID, faktura, dostawca, metoda lub cena…" oninput="infaktSzukajZakupy(this,true)" autocomplete="off"></label><label>Status<select onchange="filtrInfaktHistoria=this.value;renderuj()"><option value="aktywne" ${filtrInfaktHistoria==="aktywne"?"selected":""}>Aktywne dopasowania</option><option value="wszystkie" ${filtrInfaktHistoria==="wszystkie"?"selected":""}>Cała historia</option><option value="reczne" ${filtrInfaktHistoria==="reczne"?"selected":""}>Tylko ręczne</option><option value="automatyczne" ${filtrInfaktHistoria==="automatyczne"?"selected":""}>Tylko automatyczne</option><option value="cofniete" ${filtrInfaktHistoria==="cofniete"?"selected":""}>Cofnięte</option></select></label><label>Na stronie<select onchange="limitInfaktHistoria=Number(this.value)||50;renderuj()">${[25,50,100,250].map(n=>`<option value="${n}" ${limitInfaktHistoria===n?"selected":""}>${n}</option>`).join("")}</select></label><button class="btn ghost" type="button" onclick="infaktWyczyscFiltryHistorii()">Wyczyść filtry</button>`;
  return `<section class="infakt-purchase-sync"><div class="order-section-head"><div><span class="order-pro-label">Automatyczna kartoteka kosztowa</span><h2>💰 Ceny zakupu z faktur dostawców</h2><p class="order-detail-lead">Najpierw EAN/GTIN, potem dokładny kod producenta lub SKU, a na końcu identyczna i unikalna nazwa. Niepewne pozycje zawsze czekają na decyzję administratora.</p></div><div class="diag-actions"><label>Okres <select onchange="infaktOkresCenZakupu=Number(this.value)||180">${[[30,"30 dni"],[90,"90 dni"],[180,"180 dni"],[365,"rok"],[730,"2 lata"]].map(([v,l])=>`<option value="${v}" ${infaktOkresCenZakupu===v?"selected":""}>${l}</option>`).join("")}</select></label><button class="btn" onclick="infaktSynchronizujCenyZakupu(false)" ${infaktStan.purchaseLoading?"disabled":""}>${infaktStan.purchaseLoading?"⏳ Analizuję…":"🔄 Pobierz i dopasuj ceny"}</button></div></div>
  <div class="orders-stat-grid"><div class="order-stat-card"><span>🧾</span><b>${s.allowedDocuments||0}</b><small>faktur dostawców</small></div><div class="order-stat-card"><span>📋</span><b>${s.lineCount||0}</b><small>pozycji</small></div><div class="order-stat-card money"><span>✅</span><b>${s.matchedCount||0}</b><small>dopasowanych</small></div><div class="order-stat-card money"><span>💰</span><b>${s.priceUpdatedCount||0}</b><small>zmienionych cen</small></div><div class="order-stat-card ${pendingAll.length?"hot":""}"><span>🔎</span><b>${pendingAll.length}</b><small>do decyzji</small></div></div>
  ${s.updated_at?`<div class="backend-note"><b>Ostatnia kontrola:</b> ${esc(allegroDataTxt(s.updated_at))} • ${esc(s.source||"inFakt KSeF XML")} • starsza faktura nie nadpisuje nowszej ceny.</div>`:`<div class="backend-note">Pierwszą synchronizację uruchom przyciskiem. Kolejne kontrole wykonuje serwer.</div>`}${s.available===false||s.errors?.length?`<div class="backend-note infakt-purchase-error"><b>Wymaga uwagi:</b> ${esc((s.errors||[]).join(" • ")||"Odczyt pozycji KSeF jest niedostępny.")}</div>`:""}
  <div class="order-section-head"><div><h3>🔎 Pozycje wymagające decyzji</h3><p class="order-detail-lead">Przed zatwierdzeniem możesz przeszukać całą kartotekę. Błędne powiązanie da się później cofnąć z historii.</p></div></div>
  ${adminWyszukiwaniePanelHTML({id:"infakt-pending",description:"Faktura, identyfikatory, dostawca i powód braku automatycznego dopasowania.",fields:pendingFields,results:pending.length,active:!!(szukajInfaktZakupy||filtrInfaktZakupy!=="wszystkie"),open:true})}
  <div class="admin-search-results-line"><span>Znaleziono <b>${pending.length}</b> z ${pendingAll.length} oczekujących pozycji</span><span>Pokazano do <b>${limitInfaktZakupy}</b></span></div>
  <datalist id="infaktProductChoices">${products.map(p=>`<option value="${esc(p.id)} • ${esc(p.sku||p.externalId||p.gtin||p.ean||"bez kodu")} • ${esc(p.nazwa||"Produkt")}"></option>`).join("")}</datalist>
  <div class="warehouse-worktable-wrap"><table class="log-table infakt-purchase-table"><tr><th>Faktura / dostawca</th><th>EAN / kod</th><th>Pozycja</th><th>Ilość</th><th>Cena zakupu</th><th>Właściwy produkt</th></tr>${pending.slice(0,limitInfaktZakupy).map(item=>`<tr><td><b>${esc(item.invoiceNumber||"—")}</b><br><small>${esc(item.invoiceDate||"")} • ${esc(item.supplier||"")}</small></td><td><b>${esc(item.ean||"—")}</b><br><small>${esc(item.code||"—")}</small></td><td><b>${esc(item.name||"Pozycja")}</b><br><small>${esc(item.reason||"")}</small>${item.suggestions?.length?`<div class="infakt-suggestions">${item.suggestions.map(x=>`<button type="button" onclick="this.closest('tr').querySelector('[data-infakt-purchase-item]').value=${jsArg(`${x.id} • ${x.sku||x.ean||""} • ${x.name}`)}">${esc(x.name)} (${Math.round((x.score||0)*100)}%)</button>`).join("")}</div>`:""}</td><td>${esc(item.quantity||"—")} szt.</td><td><b>${zl(item.unitGross||0)}</b><br><small>netto ${zl(item.unitNet||0)}</small></td><td><div class="infakt-match-control"><input list="infaktProductChoices" data-infakt-purchase-item="${esc(item.itemKey)}" placeholder="ID, SKU, EAN lub nazwa"><button class="btn" onclick="infaktPrzypiszCeneZakupu(${jsArg(item.itemKey)})">Zatwierdź</button></div></td></tr>`).join("")||`<tr><td colspan="6">Brak pozycji pasujących do filtrów.</td></tr>`}</table></div>
  <details class="panel-subtle infakt-purchase-history" open><summary>🕓 Historia i korekty dopasowań (${matchesAll.length})</summary>${adminWyszukiwaniePanelHTML({id:"infakt-history",description:"Każda zmiana ma ślad audytowy. Cofnięcie przywraca poprzednią cenę i kieruje pozycję do ponownego wyboru.",fields:historyFields,results:matches.length,active:!!(szukajInfaktHistoria||filtrInfaktHistoria!=="aktywne"),open:false})}<div class="warehouse-worktable-wrap"><table class="log-table"><tr><th>Data faktury</th><th>Produkt</th><th>Cena</th><th>Dokument</th><th>Metoda / stan</th><th>Korekta</th></tr>${matches.slice(0,limitInfaktHistoria).map(x=>{const reverted=x.status==="reverted",canUndo=!reverted&&x.priceApplied!==false;return `<tr class="${reverted?"infakt-match-reverted":""}"><td>${esc(x.invoiceDate||"—")}</td><td><b>${esc(x.productName||x.productId||"Produkt")}</b><br><small>ID ${esc(x.productId||"—")}</small></td><td><b>${zl(x.price||0)}</b></td><td>${esc(x.invoiceNumber||"—")}<br><small>${esc(x.supplier||"")}</small></td><td><span class="lvl ${reverted?"lvl-ostrzezenie":"lvl-ok"}">${reverted?"cofnięte":esc(x.method||"kod")}</span>${x.revertedAt?`<br><small>${esc(allegroDataTxt(x.revertedAt))}</small>`:""}</td><td>${canUndo?`<button class="btn danger" onclick="infaktCofnijDopasowanie(${jsArg(x.matchId||x.itemKey)})">↩️ Cofnij i dopasuj ponownie</button>`:`<span class="lvl lvl-info">${reverted?"ślad zachowany":"cena bez zmiany"}</span>`}</td></tr>`;}).join("")||`<tr><td colspan="6">Brak dopasowań w tym filtrze.</td></tr>`}</table></div></details>
  <details class="panel-subtle allegro-info-bottom"><summary>⚙️ Operacja serwisowa</summary><p class="order-detail-lead">Ponowna analiza jest potrzebna po poprawieniu kodów w historycznej fakturze lub kartotece.</p><button class="btn danger" onclick="infaktSynchronizujCenyZakupu(true)">Ponownie przeanalizuj dokumenty</button></details></section>`;
}
function widokAdminInfakt(sekcja="pulpit"){
  const aktywna=["pulpit","zamowienia","faktury","dostawcy","szkice","ustawienia"].includes(sekcja)?sekcja:"pulpit";
  if((!infaktStan.sprawdzono||((aktywna==="faktury"||aktywna==="pulpit")&&infaktStan.configured&&!infaktStan.invoicesLoaded))&&!infaktStan.ladowanie)setTimeout(()=>infaktLaduj(true,aktywna==="faktury"||aktywna==="pulpit"),0);
  if(aktywna==="dostawcy"&&infaktStan.configured&&!infaktStan.costsLoaded&&!infaktStan.costsLoading&&!infaktStan.ladowanie)setTimeout(()=>infaktLadujKoszty(true),50);
  const orders=pobierzZamowienia().filter(z=>String(z.status||"")!=="anulowane").sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0));
  const linked=infaktStan.links||{},company=orders.filter(z=>z.klient?.nip||z.klient?.firma),missing=company.filter(z=>!linked[z.nr]&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  const pending=Object.values(linked).filter(x=>x.status==="processing"),created=Object.values(linked).filter(x=>x.status==="created"),errors=Object.values(linked).filter(x=>x.status==="error");
  const query=String(szukajInfakt||"").toLowerCase().trim();let invoices=infaktFaktury.filter(f=>!query||`${f.number||""} ${f.client_company_name||""} ${f.client_first_name||""} ${f.client_last_name||""} ${f.client_tax_code||""}`.toLowerCase().includes(query));if(filtrInfakt!=="wszystkie")invoices=invoices.filter(f=>String(f.status||"")===filtrInfakt);
  const connection=infaktStan.connected?`<span class="lvl lvl-ok">API połączone • ${esc(infaktStan.env)}</span>`:infaktStan.configured?`<span class="lvl lvl-blad">błąd połączenia</span>`:`<span class="lvl lvl-ostrzezenie">brak INFAKT_API_KEY</span>`;
  const hero=`${infaktSubnavHTML(aktywna)}<div class="panel infakt-hero"><div class="order-section-head"><div><span class="order-pro-label">Wąski, kontrolowany dostęp API</span><h1>🧾 inFakt — sprzedaż i wybrani dostawcy</h1><p class="order-detail-lead">Sklep może wystawiać faktury VAT klientom oraz tylko odczytywać dokumenty kosztowe i pozycje KSeF dostawców z białej listy. Nie obsługuje księgowości, zapisu kosztów, rachunków bankowych ani konfiguracji KSeF.</p></div><div class="diag-actions">${connection}<button class="btn ghost" onclick="infaktLaduj(false,true)">↻ Sprawdź API</button>${infaktStan.configured?`<button class="btn" onclick="infaktSynchronizuj()">🔄 Synchronizuj faktury i ceny</button>`:""}</div></div>${aktywna==="pulpit"?`<div class="orders-stat-grid"><div class="order-stat-card ${missing.length?"hot":"money"}"><span>📦</span><b>${missing.length}</b><small>firmowych bez dokumentu</small></div><div class="order-stat-card"><span>⏳</span><b>${pending.length}</b><small>zadań w toku</small></div><div class="order-stat-card money"><span>✅</span><b>${created.length}</b><small>wystawionych</small></div><div class="order-stat-card"><span>🏭</span><b>${infaktStan.suppliers?.items?.length||0}</b><small>dozwolonych dostawców</small></div><div class="order-stat-card"><span>📥</span><b>${infaktKoszty.length}</b><small>pobranych faktur dostawców</small></div></div>`:""}</div>`;
  const orderRows=orders.filter(z=>{const text=`${z.nr||""} ${z.email||""} ${z.klient?.firma||""} ${z.klient?.nip||""}`.toLowerCase();return !query||text.includes(query);}).slice(0,200);
  const ordersPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>📦 Zamówienia do faktury</h2><p class="order-detail-lead">Jedyna operacja zapisu: utworzenie faktury VAT klienta z autorytatywnego zamówienia. Blokada idempotencji zapobiega podwójnej fakturze.</p></div><input placeholder="Szukaj numeru, klienta lub NIP…" value="${esc(szukajInfakt)}" oninput="szukajInfakt=this.value;renderuj()"></div><div class="infakt-order-list">${orderRows.map(z=>{const link=linked[z.nr],draft=szkiceFaktur.find(f=>f.nrZamowienia===z.nr),firm=!!(z.klient?.nip||z.klient?.firma);return `<article class="infakt-order-card"><div><b>${esc(z.nr)}</b><small>${esc(z.klient?.firma||z.email||"Klient")} ${z.klient?.nip?`• NIP ${esc(z.klient.nip)}`:""}</small><small>${esc(z.data||"")} • ${zl(kosztyZamowienia(z).razem)} • ${firm?"faktura firmowa":"osoba prywatna"}</small></div><div>${infaktStatusLinkuHTML(link||{})}${draft?` <span class="lvl lvl-info">szkic lokalny</span>`:""}</div><div class="diag-actions"><a class="btn ghost" href="#/admin/zamowienie/${encodeURIComponent(z.nr)}">Zamówienie</a><button class="btn ghost" onclick="utworzSzkicFaktury(${jsArg(z.nr)})">${draft?"Odśwież szkic":"Szkic lokalny"}</button>${infaktStan.configured&&!link?`<button class="btn" onclick="infaktUtworzFakture(${jsArg(z.nr)})">Wystaw FV w inFakt</button>`:""}</div></article>`;}).join("")||`<div class="backend-note">Brak zamówień pasujących do wyszukiwania.</div>`}</div></div>`;
  const invoicesPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>🧾 Faktury sprzedaży utworzone przez sklep</h2><p class="order-detail-lead">Wyłącznie podgląd statusu dokumentów wystawionych z zamówień Artway-TM. Inne faktury z konta inFakt nie są zwracane do sklepu.</p></div><div class="diag-actions"><input placeholder="Numer, klient, NIP…" value="${esc(szukajInfakt)}" oninput="szukajInfakt=this.value;renderuj()"><select onchange="filtrInfakt=this.value;renderuj()">${[["wszystkie","Wszystkie"],["draft","Szkice"],["sent","Wysłane"],["printed","Wydrukowane"],["paid","Opłacone"]].map(([v,l])=>`<option value="${v}" ${filtrInfakt===v?"selected":""}>${l}</option>`).join("")}</select></div></div>${infaktStan.configured?`<div style="overflow:auto"><table class="log-table"><tr><th>Numer</th><th>Data</th><th>Kontrahent</th><th>Brutto</th><th>Status</th></tr>${invoices.map(f=>`<tr><td><b>${esc(f.number||"—")}</b><br><small>${esc(f.uuid||"")}</small></td><td>${esc(f.invoice_date||"—")}</td><td>${esc(f.client_company_name||`${f.client_first_name||""} ${f.client_last_name||""}`.trim()||"—")}<br><small>${esc(f.client_tax_code||"")}</small></td><td>${infaktKwota(f.gross_price)} ${esc(f.currency||"PLN")}</td><td><span class="lvl ${f.status==="paid"?"lvl-ok":"lvl-info"}">${esc(f.status||"—")}</span></td></tr>`).join("")||`<tr><td colspan="5">Brak faktur wystawionych przez sklep.</td></tr>`}</table></div>`:`<div class="backend-note">Integracja oczekuje na bezpieczny klucz serwerowy <b>INFAKT_API_KEY</b>.</div>`}</div>`;
  const draftsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>📝 Szkice robocze Artway-TM</h2><p class="order-detail-lead">Szkice można kontrolować przed wysłaniem. Usunięcie szkicu lokalnego nie usuwa dokumentu utworzonego już w inFakt.</p></div><button class="btn ghost" onclick="eksportujSzkiceFakturJSON()">Eksport JSON</button></div><div style="overflow:auto"><table class="log-table"><tr><th>Zamówienie</th><th>Kontrahent</th><th>Pozycje</th><th>Brutto</th><th>Status</th><th>Akcje</th></tr>${szkiceFaktur.map(f=>`<tr><td><b>${esc(f.nrZamowienia)}</b><br><small>${esc(f.dataTxt||"")}</small></td><td>${esc(f.kontrahent?.nazwa||"—")}<br><small>${esc(f.kontrahent?.nip||"")}</small></td><td>${esc(f.pozycje?.length||0)}</td><td>${zl(f.sumaBrutto)}</td><td>${infaktStatusLinkuHTML(linked[f.nrZamowienia]||{})}</td><td><button class="btn ghost" onclick="infaktUtworzFakture(${jsArg(f.nrZamowienia)})" ${infaktStan.configured&&!linked[f.nrZamowienia]?"":"disabled"}>Wyślij do inFakt</button><button class="btn danger" onclick="if(confirm('Usunąć tylko lokalny szkic?'))usunSzkicFaktury(${jsArg(f.id)})">Usuń szkic</button></td></tr>`).join("")||`<tr><td colspan="6">Brak szkiców.</td></tr>`}</table></div></div>`;
  const costsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>🏭 Faktury od wybranych dostawców</h2><p class="order-detail-lead">Serwer pobiera koszty wyłącznie do odczytu, a następnie ponownie filtruje je białą listą. Gdy lista jest pusta, nie ujawnia żadnego dokumentu.</p></div><button class="btn" onclick="infaktLadujKoszty()">↻ Pobierz dozwolone faktury</button></div>${infaktCenyZakupuPanelHTML()}${!(infaktStan.suppliers?.items?.length)?`<div class="backend-note"><b>Najpierw wybierz dostawców w ustawieniach.</b> Bez białej listy endpoint zwraca 0 dokumentów.</div>`:`<div style="overflow:auto"><table class="log-table"><tr><th>Data</th><th>Dostawca</th><th>Numer</th><th>Netto</th><th>VAT</th><th>Brutto</th><th>Status</th></tr>${infaktKoszty.map(k=>`<tr><td>${esc(k.issue_date||k.created_at?.slice(0,10)||"—")}</td><td><b>${esc(k.supplier?.name||k.seller_name||"—")}</b><br><small>${esc(k.seller_name||"")}</small></td><td>${esc(k.number||"—")}</td><td>${infaktKwota(k.net_price)}</td><td>${infaktKwota(k.tax_price)}</td><td><b>${infaktKwota(k.gross_price)} ${esc(k.currency||"PLN")}</b></td><td>${(k.statuses||[]).map(s=>`<span class="lvl lvl-info">${esc(s.name||s.symbol)}</span>`).join(" ")||"—"}</td></tr>`).join("")||`<tr><td colspan="7">Brak dokumentów pasujących do wybranych dostawców.</td></tr>`}</table></div>`}</div>`;
  const allowedMap=new Map((infaktStan.suppliers?.items||[]).map(x=>[String(x.id),x])),supplierRows=[...(producenciKartoteka||[]).filter(p=>p.active!==false).map(p=>({id:String(p.id),name:p.name||p.nazwa||"Dostawca",sellerName:allowedMap.get(String(p.id))?.sellerName||p.name||p.nazwa||""})),...(infaktStan.suppliers?.items||[]).filter(x=>!(producenciKartoteka||[]).some(p=>String(p.id)===String(x.id)))];
  const settingsPanel=`<div class="panel infakt-panel"><div class="order-section-head"><div><h2>⚙️ Minimalny dostęp API</h2><p class="order-detail-lead">Klucz pozostaje wyłącznie na serwerze. Aplikacja korzysta tylko z trzech zakresów. Odczyt XML KSeF służy wyłącznie dopasowaniu pozycji zakupowych; sklep nie zapisuje kosztów i nie zmienia konfiguracji KSeF.</p></div>${connection}</div><div class="info-grid"><div class="info-card"><b>Dozwolone zakresy</b><p><code>api:costs:read</code><br><code>api:invoices:read</code><br><code>api:invoices:write</code></p></div><div class="info-card"><b>Zablokowane funkcje</b><p>zapis kosztów • księgowość • rachunki bankowe • zapis i konfiguracja KSeF</p></div><div class="info-card"><b>Środowisko</b><p>${esc(infaktStan.env||"production")}</p></div><div class="info-card"><b>Sekret serwera</b><p><code>INFAKT_API_KEY</code> — nigdy w HTML</p></div></div><div class="order-section-head"><div><h2>🏭 Biała lista dostawców</h2><p class="order-detail-lead">Zaznacz tylko firmy, których faktury zakupowe wolno pobierać. Pole po prawej musi odpowiadać nazwie sprzedawcy widocznej w inFakt.</p></div><button class="btn" onclick="infaktZapiszDostawcow()">💾 Zapisz białą listę</button></div><div class="infakt-supplier-access">${supplierRows.map(p=>{const a=allowedMap.get(String(p.id));return `<label class="info-card" data-infakt-supplier data-id="${esc(p.id)}" data-name="${esc(p.name)}"><span><input type="checkbox" ${a?"checked":""}> <b>${esc(p.name)}</b></span><input type="text" value="${esc(a?.sellerName||p.sellerName)}" placeholder="Nazwa sprzedawcy w inFakt"></label>`;}).join("")||`<div class="backend-note">Dodaj najpierw dostawców w kartotece producentów.</div>`}</div>${infaktStan.error?`<div class="backend-note" style="border-color:#fecaca;color:#991b1b"><b>Błąd:</b> ${esc(infaktStan.error)}</div>`:""}</div>`;
  const content=aktywna==="zamowienia"?ordersPanel:aktywna==="faktury"?invoicesPanel:aktywna==="dostawcy"?costsPanel:aktywna==="szkice"?draftsPanel:aktywna==="ustawienia"?settingsPanel:`${missing.length?ordersPanel:""}${costsPanel}`;
  return adminSzkielet("/admin/infakt",hero+content);
}
function widokAdminMagazyn(sekcja="pulpit"){
  const rez=rezerwacjeMagazynowe(), kanalySpr=sprzedazKanalyMagazynowe(30), spr=kanalySpr.razem, u=ustawieniaMagazynuPelne(), prog=Math.max(0,Number(u.progNiski)||5);
  const aktywna=["pulpit","dostawcy","stany","lokalizacje","plan","ruchy"].includes(String(sekcja||""))?String(sekcja||""):"pulpit";
  const wszystkie=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const supplierStats=statystykiDostepnosciProducentow(),supplierQuery=String(szukajProducentowMagazynu||"").toLowerCase().trim();
  let supplierRows=(filtrProducentowMagazynu==="bez_linku"?supplierStats.bezLinku.map(p=>({p,i:producentDostepnoscInfo(p),priority:priorytetDostepnosciProduktu(p),rank:0})):supplierStats.rows).filter(({p,i,priority})=>{const decision=decyzjaProducentaInfo(p);if(supplierQuery&&!`${p.nazwa||""} ${p.sku||""} ${p.gtin||p.ean||""} ${p.producent||""} ${i.url}`.toLowerCase().includes(supplierQuery))return false;if(filtrProducentowMagazynu==="alerty"&&!i.alert)return false;if(filtrProducentowMagazynu==="bestsellery"&&!priority?.score)return false;if(filtrProducentowMagazynu==="niski"&&i.status!=="niski")return false;if(filtrProducentowMagazynu==="brak"&&i.status!=="brak")return false;if(filtrProducentowMagazynu==="decyzje"&&(!["brak","niski"].includes(i.status)||(decision.code&&!decision.expired)))return false;if(filtrProducentowMagazynu==="wygasle"&&!decision.expired)return false;if(filtrProducentowMagazynu==="aktywne_decyzje"&&(!decision.code||decision.expired))return false;if(filtrProducentowMagazynu==="nieznane"&&i.url&&!i.stale&&!["nieznany","blad"].includes(i.status))return false;if(filtrProducentowMagazynu==="dostepne"&&!["dostepny","dostepny_nieznany"].includes(i.status))return false;return true;});
  const supplierRank={brak:0,niski:1,blad:2,nieznany:2,dostepny_nieznany:3,dostepny:4};supplierRows.sort((a,b)=>Number(b.priority?.score||0)-Number(a.priority?.score||0)||(supplierRank[a.i.status]??5)-(supplierRank[b.i.status]??5)||(a.i.quantity??Number.MAX_SAFE_INTEGER)-(b.i.quantity??Number.MAX_SAFE_INTEGER)||String(a.p.nazwa||"").localeCompare(String(b.p.nazwa||""),"pl"));
  const bestselleryProducentow=supplierStats.rows.filter(x=>Number(x.priority?.score||0)>0),bestselleryNieaktualne=bestselleryProducentow.filter(x=>x.i.stale||["nieznany","blad"].includes(x.i.status));
  const monitorowane=wszystkie.filter(p=>stanMagazynuId(p.id)!==null);
  const brak=wszystkie.filter(p=>stanMagazynuId(p.id)===0);
  const niskie=wszystkie.filter(p=>{const s=stanMagazynuId(p.id);return s!==null&&s>0&&s<=progNiskiProduktu(p);});
  const zarezerwowane=Object.values(rez).reduce((s,n)=>s+Number(n||0),0);
  const wartosc=monitorowane.reduce((s,p)=>s+(stanMagazynuId(p.id)||0)*kwotaNum(p.cena),0);
  const planZakupu=potrzebyZatowarowania();
  const wartoscPlanu=planZakupu.reduce((s,x)=>s+kwotaNum(x.ilosc*kwotaNum(x.produkt.cena)),0);
  const nadrezerwacje=wszystkie.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;});
  const brakiKartoteki=wszystkie.filter(p=>!magazynMetaProduktu(p.id).lokalizacja||!magazynMetaProduktu(p.id).dostawca);
  const bestselleryMagazynu=wszystkie.filter(p=>priorytetDostepnosciProduktu(p,kanalySpr,rez).score>0);
  const stareInwentaryzacje=wszystkie.filter(p=>{const d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja,t=d?Date.parse(d):0;return !t||Date.now()-t>90*86400000;});
  const alertyStanow=wszystkie.filter(p=>{const i=producentDostepnoscInfo(p),d=dostepneSztukiMagazynu(p,rez),plan=sugestiaZatowarowania(p,rez,spr);return i.alert||d!==null&&d<0||Number(plan.ilosc||0)>0;});
  const lokalizacje=magazynLokalizacjeAktywne(), statLok=statystykiLokalizacji(wszystkie);
  const dostawcyMag=[...new Set(wszystkie.map(p=>magazynMetaProduktu(p.id).dostawca).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
  const pozaSlownikiem=Object.keys(statLok).filter(k=>k!=="BRAK" && !magazynLokalizacjaPoKodzie(k));
  const lokDoKompletacji=[...new Set(pobierzZamowienia().filter(statusZamowieniaRezerwujeMagazyn).flatMap(z=>pozycjeZamowieniaMagazyn(z).map(p=>magazynMetaProduktu(p.id).lokalizacja||"BRAK")))].filter(Boolean);
  const pracaMagazynu=[
    ...supplierStats.braki.slice(0,4).map(({p})=>({lvl:"bad",ico:"🔴",tytul:p.nazwa,opis:"Producent zgłasza brak produktu. Sprawdź źródło i bieżące zamówienia.",href:"#/admin/magazyn/dostawcy"})),
    ...supplierStats.niskie.slice(0,4).map(({p,i})=>({lvl:"warn",ico:"🟡",tytul:p.nazwa,opis:`Niski stan u producenta: ${i.quantity} szt. • próg ${i.prog}.`,href:"#/admin/magazyn/dostawcy"})),
    ...nadrezerwacje.slice(0,4).map(p=>({lvl:"bad",ico:"🚨",tytul:p.nazwa,opis:`Nadrezerwacja: dostępne ${dostepneSztukiMagazynu(p,rez)} szt., rezerwacje ${rez[p.id]||0}.`,akcja:"dozamowienia"})),
    ...planZakupu.slice(0,4).map(x=>({lvl:"warn",ico:"📦",tytul:x.produkt.nazwa,opis:`Do zamówienia: ${x.ilosc} szt. • ${x.meta.dostawca||"brak dostawcy"} • ${x.meta.lokalizacja||"brak lokalizacji"}`,akcja:"dozamowienia"})),
    ...brakiKartoteki.slice(0,4).map(p=>({lvl:"info",ico:"🗂️",tytul:p.nazwa,opis:`Uzupełnij kartotekę: ${!magazynMetaProduktu(p.id).lokalizacja?"brak lokalizacji ":""}${!magazynMetaProduktu(p.id).dostawca?"brak dostawcy":""}.`,akcja:"bezlokalizacji"}))
  ].slice(0,8);
  const lista=filtrujProduktyMagazynu(wszystkie,rez,spr);
  const liczbaStron=Math.max(1,Math.ceil(lista.length/magazynNaStronie));
  stronaMagazynu=Math.min(Math.max(1,stronaMagazynu),liczbaStron);
  const fragment=lista.slice((stronaMagazynu-1)*magazynNaStronie,stronaMagazynu*magazynNaStronie);
  return adminSzkielet("/admin/magazyn", `
  ${magazynSubnavHTML(aktywna)}
  <div class="panel warehouse-hero-panel ${aktywna!=="pulpit"?"is-compact":""}">
    <div class="warehouse-hero">
      <div>
        <span class="cat-label">Magazyn i dokumenty</span>
        <h1>🏬 ${esc(u.nazwa)}</h1>
        <p>Najpierw dostępność u producentów z linków źródłowych, potem braki do aktywnych zamówień. Stan lokalny pozostaje informacją pomocniczą.</p>
      </div>
      ${aktywna==="pulpit"?`<div class="diag-actions">
        <button class="btn" onclick="eksportujMagazynCSV()">📊 Eksport magazynu CSV</button>
        <button class="btn ghost" onclick="agentAISprawdzDostepnoscProducentow()">🏭 Sprawdź producentów</button>
        <button class="btn ghost" onclick="eksportujZatowarowanieCSV()">📦 Braki do zamówień</button>
        <a class="btn ghost" href="#/admin/agent-ai">🤖 Agent AI</a>
        <a class="btn ghost" href="#/admin/produkty/dodaj">➕ Dodaj produkt</a>
      </div>`:""}
    </div>
    <div class="orders-stat-grid" style="${aktywna==="pulpit"?"":"display:none"}">
      <button class="order-stat-card stat-filter money" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='dostepne'"><span>🏭</span><b>${supplierStats.dostepne.length}</b><small>dostępne u producentów</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.niskie.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='niski'"><span>🟡</span><b>${supplierStats.niskie.length}</b><small>niski stan u producenta ≤ ${esc(u.progNiskiProducenta)}</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.braki.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='brak'"><span>🔴</span><b>${supplierStats.braki.length}</b><small>brak u producenta</small></button>
      <button class="order-stat-card stat-filter ${supplierStats.nieznane.length?"hot":""}" type="button" onclick="location.hash='#/admin/magazyn/dostawcy';filtrProducentowMagazynu='nieznane'"><span>⚪</span><b>${supplierStats.nieznane.length}</b><small>niepotwierdzone / nieaktualne</small></button>
      <button class="order-stat-card stat-filter ${filtrMagazynu==="rezerwacje"?"active":""}" type="button" onclick="ustawFiltrMagazynu('rezerwacje','rezerwacje')"><span>🧾</span><b>${zarezerwowane}</b><small>szt. w aktywnych zamówieniach</small></button>
      <button class="order-stat-card stat-filter money ${filtrMagazynu==="wszystkie"&&sortowanieMagazynu==="wartosc"?"active":""}" type="button" onclick="ustawFiltrMagazynu('wszystkie','wartosc')"><span>💰</span><b>${zl(wartosc)}</b><small>wartość stanów</small></button>
      <button class="order-stat-card stat-filter ${planZakupu.length?"hot":""} ${filtrMagazynu==="dozamowienia"?"active":""}" type="button" onclick="ustawFiltrMagazynu('dozamowienia','zakup')"><span>📦</span><b>${planZakupu.length}</b><small>braki do zamówień (${zl(wartoscPlanu)})</small></button>
      <button class="order-stat-card stat-filter ${nadrezerwacje.length?"hot":""} ${filtrMagazynu==="nadrezerwacja"?"active":""}" type="button" onclick="ustawFiltrMagazynu('nadrezerwacja','dostepne')"><span>🚨</span><b>${nadrezerwacje.length}</b><small>nadrezerwacje</small></button>
      <button class="order-stat-card stat-filter ${brakiKartoteki.length?"hot":""} ${filtrMagazynu==="bezlokalizacji"||filtrMagazynu==="bezdostawcy"?"active":""}" type="button" onclick="ustawFiltrMagazynu('bezlokalizacji','nazwa')"><span>🗂️</span><b>${brakiKartoteki.length}</b><small>braki kartoteki</small></button>
      <button class="order-stat-card stat-filter ${pozaSlownikiem.length?"hot":""}" type="button" onclick="document.getElementById('warehouseLocationForm')?.scrollIntoView({behavior:'smooth',block:'center'})"><span>🗺️</span><b>${lokalizacje.length}</b><small>lokalizacji w słowniku</small></button>
    </div>
  </div>
  <div class="panel supplier-monitor-panel" style="${aktywna==="dostawcy"?"":"display:none"}">
    <div class="order-section-head">
      <div><span class="order-pro-label">Priorytet bestsellerów</span><h2 style="margin-top:.25rem">🏭 Dostępność u producentów</h2><p class="order-detail-lead">Agent co 6 godzin zawsze zaczyna od najlepiej sprzedających się produktów w Allegro i sklepie oraz pozycji z aktywnych zamówień. Zajmują one do 75% każdej próbki; pozostałe miejsca są losowane spośród najdłużej niesprawdzanych produktów.</p></div>
      <div class="diag-actions"><button class="btn" onclick="agentAISprawdzDostepnoscProducentow()">🤖 Sprawdź bestsellery + próbkę (${esc(u.producentProbka)})</button><button class="btn ghost" onclick="agentAISprawdzDostepnoscProducentow(25)">Pełna partia priorytetowa (25)</button></div>
    </div>
    <div class="orders-stat-grid supplier-monitor-stats"><button class="order-stat-card ${supplierStats.wymagajaDecyzji.length?"hot":""}" onclick="filtrProducentowMagazynu='decyzje';renderuj()"><span>🧭</span><b>${supplierStats.wymagajaDecyzji.length}</b><small>wymaga decyzji sprzedażowej</small></button><button class="order-stat-card money" onclick="filtrProducentowMagazynu='aktywne_decyzje';renderuj()"><span>✅</span><b>${supplierStats.aktywneDecyzje.length}</b><small>aktywnych decyzji</small></button><button class="order-stat-card ${supplierStats.wygasleDecyzje.length?"hot":""}" onclick="filtrProducentowMagazynu='wygasle';renderuj()"><span>⏰</span><b>${supplierStats.wygasleDecyzje.length}</b><small>wygasłych terminów</small></button><div class="order-stat-card money"><span>🏆</span><b>${bestselleryProducentow.length}</b><small>bestsellerów z linkiem</small></div><div class="order-stat-card ${bestselleryNieaktualne.length?"hot":""}"><span>⏱️</span><b>${bestselleryNieaktualne.length}</b><small>priorytetowych do kontroli</small></div><div class="order-stat-card ${supplierStats.niskie.length?"hot":""}"><span>🟡</span><b>${supplierStats.niskie.length}</b><small>niski stan ≤ ${esc(u.progNiskiProducenta)} szt.</small></div><div class="order-stat-card ${supplierStats.braki.length?"hot":""}"><span>🔴</span><b>${supplierStats.braki.length}</b><small>brak u producenta</small></div><div class="order-stat-card ${supplierStats.nieznane.length?"hot":""}"><span>⚪</span><b>${supplierStats.nieznane.length}</b><small>nieznane / starsze niż ${esc(u.producentMaxWiekGodz)} h</small></div><div class="order-stat-card"><span>🔗</span><b>${supplierStats.bezLinku.length}</b><small>bez linku źródłowego</small></div></div>
    <div class="supplier-monitor-toolbar"><input placeholder="Szukaj: nazwa, SKU, EAN, producent lub URL…" value="${esc(szukajProducentowMagazynu)}" oninput="szukajProducentowMagazynu=this.value;clearTimeout(window.__supplierSearch);window.__supplierSearch=setTimeout(()=>renderuj(),250)"><select onchange="filtrProducentowMagazynu=this.value;renderuj()">${[["decyzje","Wymagają decyzji"],["wygasle","Wygasłe decyzje"],["aktywne_decyzje","Aktywne decyzje"],["alerty","Wszystkie ostrzeżenia"],["bestsellery","Bestsellery sklepu i Allegro"],["wszystkie","Wszystkie z linkiem"],["niski","Niski stan"],["brak","Brak u producenta"],["nieznane","Niepotwierdzone / nieaktualne"],["dostepne","Dostępne"],["bez_linku","Bez linku źródłowego"]].map(([v,l])=>`<option value="${v}" ${filtrProducentowMagazynu===v?"selected":""}>${l}</option>`).join("")}</select><span><b>${supplierRows.length}</b> wyników</span></div>
    <div class="warehouse-worktable-wrap"><table class="log-table supplier-monitor-table"><tr><th>Produkt</th><th>Priorytet sprzedaży</th><th>Producent i link</th><th>Stan u producenta</th><th>Decyzja sprzedażowa</th><th>Ostatnia kontrola</th><th>Historia 5 kontroli</th><th>Akcje</th></tr>${supplierRows.slice(0,500).map(({p,i,priority,rank})=>`<tr class="supplier-row ${i.cls}"><td><div class="allegro-offer-title-cell">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"🎲")}</span>`}<div><b>${esc(p.nazwa||"Produkt")}</b><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||"—")}</small></div></div></td><td><div class="supplier-priority ${esc(priority?.level||"niski")}"><b>${priority?.score?`🏆 #${esc(rank||"—")} • ${esc(priority.level)}`:"— brak sprzedaży"}</b><small>Sklep: ${esc(priority?.sklep||0)} • Allegro: ${esc(priority?.allegro||0)} • aktywne: ${esc(priority?.active||0)}</small><em>Główny kanał: ${esc(priority?.channel||"—")}</em></div></td><td><b>${esc(p.producent||p.marka||"Nieprzypisany")}</b><small class="supplier-source-url">${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">Otwórz źródło ↗</a><br>${esc(i.url)}`:"Brak linku źródłowego"}</small></td><td>${producentDostepnoscBadgeHTML(p)}<small>Próg ostrzeżenia: ${esc(i.prog)} szt.</small></td><td>${decyzjaProducentaPanelHTML(p,i)}</td><td><b>${i.checked?esc(allegroDataTxt(i.checked)):"Nigdy"}</b><br><small>${i.stale?`<span class="lvl lvl-ostrzezenie">wynik nieaktualny</span>`:`<span class="lvl lvl-ok">aktualny</span>`}${i.error?`<br>${esc(skrocTekst(i.error,180))}`:""}</small></td><td><div class="supplier-history">${(Array.isArray(p.producentStanHistoria)?p.producentStanHistoria:[]).map(h=>`<span class="${esc(h.status||"nieznany")}"><b>${h.quantity===null||h.quantity===undefined?"—":esc(h.quantity)+" szt."}</b><small>${esc(allegroDataTxt(h.at))}</small></span>`).join("")||`<small>Brak historii</small>`}</div></td><td><div class="warehouse-worktable-actions">${i.url?`<button class="btn" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź teraz</button>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Edytuj produkt</a></div></td></tr>`).join("")||`<tr><td colspan="8">Brak produktów pasujących do filtra.</td></tr>`}</table></div>
    <div class="backend-note allegro-info-bottom"><b>Zasada decyzji:</b> brak lokalnego stanu nie wyłącza produktu ze sprzedaży. Alarm powstaje przede wszystkim wtedy, gdy producent zgłasza brak albo ujawniony stan spada do ${esc(u.progNiskiProducenta)} szt. lub mniej. Błąd pobrania nie jest traktowany jako brak — zostaje oznaczony do ponownej kontroli.</div>
  </div>
  <div class="panel warehouse-ops-panel" style="${aktywna==="pulpit"?"":"display:none"}">
    <div class="order-section-head">
      <div>
        <h2 style="margin-top:0">🧭 Operacje magazynu dzisiaj</h2>
        <p class="order-detail-lead">Kolejka pracy pod aktywne zamówienia: najpierw nadrezerwacje, potem braki i kartoteka.</p>
      </div>
      <div class="diag-actions" style="margin-top:0"><button class="btn ghost" onclick="agentAIWstawKomende('przygotuj zamówienie do producenta');location.hash='#/admin/agent-ai'">Zapytaj agenta</button></div>
    </div>
    <div class="warehouse-ops-grid">
      <div class="warehouse-ops-summary">
        <span><b>${lokDoKompletacji.length}</b><small>lokalizacji do przejścia</small></span>
        <span><b>${planZakupu.length}</b><small>pozycji brakujących do zamówień</small></span>
        <span><b>${brakiKartoteki.length}</b><small>braków kartoteki</small></span>
        <span><b>${nadrezerwacje.length}</b><small>nadrezerwacji</small></span>
      </div>
      <div class="warehouse-pick-route">
        <b>Trasa kompletacji</b>
        <p>${lokDoKompletacji.length?lokDoKompletacji.map(k=>`<span>${esc(nazwaLokalizacjiMagazynu(k))}</span>`).join(""):`<span>Brak aktywnych lokalizacji w zamówieniach</span>`}</p>
      </div>
    </div>
    <div class="warehouse-work-list">
      ${pracaMagazynu.length?pracaMagazynu.map(x=>`<button class="warehouse-work-item ${x.lvl}" onclick="${x.href?`location.hash=${jsArg(x.href)}`:`ustawFiltrMagazynu(${jsArg(x.akcja||"wszystkie")},'ryzyko')`}">
        <span>${x.ico}</span><b>${esc(x.tytul)}</b><small>${esc(x.opis)}</small>
      </button>`).join(""):`<div class="warehouse-work-empty">✅ Brak pilnych prac magazynowych wynikających z aktywnych zamówień.</div>`}
    </div>
  </div>
  <div class="panel warehouse-location-panel" style="${aktywna==="lokalizacje"?"":"display:none"}">
    <div class="order-section-head">
      <div>
        <span class="order-pro-label">Struktura fizyczna</span><h2 style="margin-top:.25rem">🗺️ Strefy, regały, półki i miejsca</h2>
        <p class="order-detail-lead">Hierarchia prowadzi od strefy przez regał i półkę do konkretnego miejsca. Generator tworzy całe ciągi kodów bez ręcznego wpisywania każdej półki.</p>
      </div>
      <button class="btn ghost" type="button" onclick="agentAIWstawKomende('pokaż lokalizacje');location.hash='#/admin/agent-ai'">Zapytaj agenta</button>
    </div>
    <div class="warehouse-location-overview"><span><b>${lokalizacje.filter(l=>l.typ==="strefa").length}</b><small>stref</small></span><span><b>${lokalizacje.filter(l=>l.typ==="regał").length}</b><small>regałów</small></span><span><b>${lokalizacje.filter(l=>l.typ==="półka").length}</b><small>półek</small></span><span><b>${lokalizacje.filter(l=>l.typ==="miejsce").length}</b><small>miejsc</small></span><span><b>${statLok.BRAK?.produkty||0}</b><small>produktów bez miejsca</small></span></div>
    <form class="warehouse-generator" onsubmit="return generujRegalyIPolkiMagazynu(event)">
      <div class="order-section-head"><div><h3 style="margin:0">✨ Generator struktury</h3><p class="order-detail-lead">Przykład: strefa A, 3 regały, 5 półek i 4 miejsca utworzą kody A-R01-P01-M01 itd.</p></div><button class="btn" type="submit">✨ Utwórz całą strukturę</button></div>
      <div class="warehouse-generator-grid"><label>Strefa <input name="strefaKod" value="A" maxlength="10" required></label><label>Nazwa strefy <input name="strefaNazwa" value="Strefa A"></label><label>Prefiks regału <input name="prefix" value="R" maxlength="8" required></label><label>Start regału <input name="startRegal" type="number" min="1" value="1"></label><label>Liczba regałów <input name="regaly" type="number" min="1" max="50" value="3"></label><label>Półki / regał <input name="polki" type="number" min="1" max="30" value="5"></label><label>Start półki <input name="startPolka" type="number" min="1" value="1"></label><label>Miejsca / półkę <input name="miejsca" type="number" min="0" max="30" value="0"><small>0 = produkt przypisujesz bezpośrednio do półki</small></label><label>Pojemność miejsca <input name="pojemnosc" type="number" min="0" placeholder="opcjonalnie"></label></div>
    </form>
    <div class="warehouse-location-layout">
      <form id="warehouseLocationForm" class="warehouse-location-form" onsubmit="return zapiszLokalizacjeMagazynu(event)">
        <h3 style="margin-top:0">✏️ Pojedyncza lokalizacja</h3><p class="order-detail-lead">Do nietypowego miejsca, palety, stanowiska albo ręcznej korekty struktury.</p>
        <div class="warehouse-location-form-grid">
          <div class="f-group"><label>Kod *</label><input name="kod" placeholder="np. A-R01-P02" required></div>
          <div class="f-group"><label>Nazwa</label><input name="nazwa" placeholder="Półka 2 / gry rodzinne"></div>
          <div class="f-group"><label>Typ</label><select name="typ"><option>miejsce</option><option>półka</option><option>regał</option><option>strefa</option><option>paleta</option><option>box</option><option>stanowisko pakowania</option><option>zewnętrzna</option></select></div>
          <div class="f-group"><label>Lokalizacja nadrzędna</label><select name="parentKod"><option value="">— poziom główny —</option>${lokalizacje.map(l=>`<option value="${esc(l.kod)}">${"· ".repeat(poziomLokalizacjiMagazynu(l.kod))}${esc(l.kod)} — ${esc(l.nazwa||l.typ)}</option>`).join("")}</select></div>
          <div class="f-group"><label>Strefa</label><input name="strefa" placeholder="np. A / szybka kompletacja"></div>
          <div class="f-group"><label>Kod kreskowy lokalizacji</label><input name="kodKreskowy" placeholder="zeskanuj lub wpisz"></div>
          <div class="f-group"><label>Pojemność szt.</label><input name="pojemnosc" inputmode="numeric" placeholder="opcjonalnie"></div>
          <div class="f-group"><label>Priorytet kompletacji</label><input name="priorytet" inputmode="numeric" placeholder="np. 10"></div>
          <div class="f-group"><label>Szerokość (cm)</label><input name="szerokosc" type="number" min="0"></div><div class="f-group"><label>Głębokość (cm)</label><input name="glebokosc" type="number" min="0"></div><div class="f-group"><label>Wysokość (cm)</label><input name="wysokosc" type="number" min="0"></div><div class="f-group"><label>Maks. waga (kg)</label><input name="maxWaga" inputmode="decimal"></div>
        </div>
        <div class="f-group"><label>Uwagi</label><input name="uwagi" placeholder="np. produkty najczęściej kupowane, ciężkie gry, zapas sezonowy"></div>
        <div class="diag-actions"><button class="btn" type="submit">💾 Zapisz lokalizację</button><button class="btn ghost" type="reset">Wyczyść formularz</button></div>
      </form>
      <div class="warehouse-location-list hierarchy-list">
        ${lokalizacje.map(l=>{
          const s=statLok[l.kod]||{produkty:0,sztuki:0,rezerwacje:0,wartosc:0};
          const zapelnienie=l.pojemnosc?Math.min(100,Math.round((s.sztuki/Math.max(1,l.pojemnosc))*100)):null;
          const level=poziomLokalizacjiMagazynu(l.kod),children=lokalizacje.filter(x=>x.parentKod===l.kod).length;
          return `<div class="warehouse-location-card hierarchy-level-${Math.min(3,level)}" style="--level:${level}">
            <div class="warehouse-location-head"><div><small>${esc(sciezkaLokalizacjiMagazynu(l.kod))}</small><b>${esc(l.kod)}</b></div><span class="lvl lvl-info">${esc(l.typ||"lokalizacja")}</span></div>
            <p>${esc(l.nazwa||"Bez nazwy")}${l.strefa?` • strefa: ${esc(l.strefa)}`:""}${children?` • elementów niżej: ${children}`:""}</p>
            <div class="warehouse-location-metrics">
              <span><b>${s.produkty}</b><small>produktów</small></span>
              <span><b>${s.sztuki}</b><small>sztuk</small></span>
              <span><b>${s.rezerwacje}</b><small>rezerw.</small></span>
              <span><b>${zl(s.wartosc)}</b><small>wartość</small></span>
            </div>
            ${zapelnienie!==null?`<div class="warehouse-fill"><span style="width:${zapelnienie}%"></span></div><small>Zapełnienie wg stanu: ${zapelnienie}% / ${esc(l.pojemnosc)} szt.</small>`:""}
            ${(l.szerokosc||l.glebokosc||l.wysokosc||l.maxWaga)?`<small>Wymiary: ${esc(l.szerokosc||"—")} × ${esc(l.glebokosc||"—")} × ${esc(l.wysokosc||"—")} cm • maks. ${esc(l.maxWaga||"—")} kg</small>`:""}${l.kodKreskowy?`<small>Kod kreskowy: <b>${esc(l.kodKreskowy)}</b></small>`:""}
            ${l.uwagi?`<small>${esc(l.uwagi)}</small>`:""}
            <div class="diag-actions"><button class="btn ghost" type="button" onclick="edytujLokalizacjeMagazynu(${jsArg(l.kod)})">Edytuj</button><button class="btn danger" type="button" onclick="usunLokalizacjeMagazynu(${jsArg(l.kod)})">Ukryj</button></div>
          </div>`;
        }).join("") || `<div class="warehouse-location-card"><b>Brak lokalizacji</b><p>Dodaj pierwszą lokalizację, np. R1-P1, żeby produkty można było przypisywać z listy.</p></div>`}
      </div>
    </div>
    ${statLok.BRAK?.produkty?`<div class="pay-note" style="text-align:left;margin-top:.8rem">Bez lokalizacji: <b>${statLok.BRAK.produkty}</b> produktów. Użyj filtra „Bez lokalizacji”, żeby szybko uzupełnić kartotekę.</div>`:""}
    ${pozaSlownikiem.length?`<div class="pay-note" style="text-align:left;margin-top:.6rem">Lokalizacje wpisane przy produktach, ale nieutworzone w słowniku: <b>${pozaSlownikiem.map(esc).join(", ")}</b>.</div>`:""}
  </div>
  <div class="panel" style="${aktywna==="plan"?"":"display:none"}">
    <div class="order-section-head">
      <div><h2 style="margin-top:0">📦 Plan zatowarowania</h2><p class="order-detail-lead">Plan dotyczy tylko produktów, których brakuje do aktywnych zamówień i rezerwacji. Nadwyżka po ręcznym zwiększeniu zlecenia trafia później do magazynu.</p></div>
      <div class="diag-actions"><button class="btn" onclick="eksportujZatowarowanieCSV()">📤 CSV planu</button><button class="btn ghost" onclick="agentAIWykonaj('utworz-zlecenie-braki')">🤖 Utwórz zlecenie agenta</button></div>
    </div>
    <div style="overflow-x:auto"><table class="log-table warehouse-worktable">
      <tr><th>Kod</th><th>EAN</th><th>Nazwa</th><th>Ilość potrzebna</th><th>Stan</th><th>Rezerwacje</th><th>Dostępne</th><th>Lokalizacja</th><th>Dostawca</th><th>Powód</th></tr>
      ${planZakupu.map(x=>`<tr class="${x.poziom==="bad"?"row-alert":""}">
        <td><b>${esc(kodOperacyjnyProduktu(x.produkt,x.meta))}</b></td>
        <td>${esc(eanOperacyjnyProduktu(x.produkt,x.meta)||"—")}</td>
        <td><b>${esc(x.produkt.nazwa)}</b><br><small>${esc(x.produkt.sku||"ID "+x.produkt.id)}</small></td>
        <td><b>${esc(x.ilosc)} szt.</b></td>
        <td>${x.stan===null?"∞":esc(x.stan)}</td>
        <td>${esc(x.rezerwacje)}</td>
        <td>${x.dostepne===null?"∞":esc(x.dostepne)}</td>
        <td>${esc(x.meta.lokalizacja?nazwaLokalizacjiMagazynu(x.meta.lokalizacja):"—")}</td>
        <td>${esc(x.meta.dostawca||"—")}</td>
        <td>${esc(x.powod)}</td>
      </tr>`).join("") || `<tr><td colspan="10">Brak braków do aktywnych zamówień.</td></tr>`}
    </table></div>
  </div>
  <div class="panel warehouse-stock-page" style="${aktywna==="stany"?"":"display:none"}">
    <div class="order-section-head warehouse-stock-head">
      <div><span class="order-pro-label">Centrum kontroli zapasu</span><h2>📋 Stany produktów</h2><p class="order-detail-lead">Jeden czytelny widok łączy dostępność producenta, sprzedaż Allegro i sklepu, rezerwacje, fizyczny zapas, lokalizację oraz decyzję o domówieniu.</p></div>
      <div class="diag-actions"><button class="btn" data-stock-confirm-visible onclick='potwierdzWidoczneStanyMagazynu(${JSON.stringify(fragment.map(p=>p.id))})'>✅ Potwierdź ${fragment.length} widocznych</button><button class="btn ghost" onclick="eksportujMagazynCSV()">📤 Eksport CSV</button><button class="btn ghost" onclick="wyczyscFiltryStanowMagazynu()">Wyczyść filtry</button></div>
    </div>
    <div class="warehouse-stock-summary">
      <button class="stock-summary-card ${filtrMagazynu==="bestsellery"?"active":""}" onclick="ustawFiltrMagazynu('bestsellery','priorytet')"><span>🏆</span><b>${bestselleryMagazynu.length}</b><small>bestsellerów i aktywnych</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="alerty"?"active":""} ${alertyStanow.length?"alert":""}" onclick="ustawFiltrMagazynu('alerty','ryzyko')"><span>🚨</span><b>${alertyStanow.length}</b><small>alertów operacyjnych</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="dozamowienia"?"active":""}" onclick="ustawFiltrMagazynu('dozamowienia','zakup')"><span>📦</span><b>${planZakupu.length}</b><small>produktów do zamówienia</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="nadrezerwacja"?"active":""}" onclick="ustawFiltrMagazynu('nadrezerwacja','dostepne')"><span>🧾</span><b>${nadrezerwacje.length}</b><small>nadrezerwacji</small></button>
      <button class="stock-summary-card ${filtrMagazynu==="bezlokalizacji"?"active":""}" onclick="ustawFiltrMagazynu('bezlokalizacji','priorytet')"><span>🗺️</span><b>${brakiKartoteki.length}</b><small>niepełnych kartotek</small></button>
      <button class="stock-summary-card ${filtrInwentaryzacjiMagazynu==="stara"?"active":""}" onclick="filtrInwentaryzacjiMagazynu='stara';stronaMagazynu=1;renderuj()"><span>📅</span><b>${stareInwentaryzacje.length}</b><small>stanów do potwierdzenia</small></button>
    </div>
    <div class="warehouse-stock-quickfilters" aria-label="Szybkie filtry">
      ${[["wszystkie","Wszystkie"],["bestsellery","🏆 Bestsellery"],["producent-brak","🔴 Brak u producenta"],["producent-niski","🟡 Niski u producenta"],["dozamowienia","📦 Do zamówienia"],["rezerwacje","🧾 Z rezerwacją"],["bezlokalizacji","🗺️ Bez lokalizacji"],["bezdostawcy","🏭 Bez dostawcy"]].map(([v,t])=>`<button type="button" class="${filtrMagazynu===v?"active":""}" onclick="ustawFiltrMagazynu(${jsArg(v)},${jsArg(v==="bestsellery"?"priorytet":v==="dozamowienia"?"zakup":"ryzyko")})">${t}</button>`).join("")}
    </div>
    ${adminWyszukiwaniePanelHTML({id:"warehouse-stock",description:"Nazwa i identyfikatory produktu, status, dostawca, lokalizacja, inwentaryzacja oraz sortowanie.",results:lista.length,active:!!(frazaMagazynu||filtrMagazynu!=="wszystkie"||filtrDostawcyMagazynu!=="wszyscy"||filtrLokalizacjiMagazynu!=="wszystkie"||filtrInwentaryzacjiMagazynu!=="wszystkie"),open:true,fields:`<div class="warehouse-stock-toolbar admin-search-full">
      <label class="warehouse-stock-search"><span>Wyszukaj produkt</span><input data-warehouse-stock-search placeholder="Nazwa, SKU, EAN, ID, kategoria, lokalizacja lub dostawca…" value="${esc(frazaMagazynu)}" oninput="magazynSzukajProdukty(this)" autocomplete="off"></label>
      <label><span>Status</span><select onchange="filtrMagazynu=this.value;stronaMagazynu=1;renderuj()">${[["wszystkie","Wszystkie produkty"],["alerty","Wszystkie alerty"],["bestsellery","Bestsellery / aktywne"],["producent-niski","Producent: niski stan"],["producent-brak","Producent: brak"],["producent-nieznany","Producent: niepotwierdzone"],["dozamowienia","Braki do zamówień"],["nadrezerwacja","Nadrezerwacje"],["monitorowane","Monitorowane lokalnie"],["bezlimitu","Lokalnie bez limitu"],["niskie","Lokalny niski stan"],["brak","Lokalny stan zerowy"],["rezerwacje","Z rezerwacją"],["sprzedaz","Sprzedane 30 dni"],["bezlokalizacji","Bez lokalizacji"],["bezdostawcy","Bez dostawcy"]].map(([v,t])=>`<option value="${v}" ${filtrMagazynu===v?"selected":""}>${t}</option>`).join("")}</select></label>
      <label><span>Sortowanie</span><select onchange="sortowanieMagazynu=this.value;stronaMagazynu=1;renderuj()">${[["ryzyko","Priorytet operacyjny"],["priorytet","Bestsellery najpierw"],["producent","Stan u producenta"],["zakup","Największe braki"],["dostepne","Dostępne po rezerwacji"],["stan","Stan lokalny rosnąco"],["nazwa","Nazwa A–Z"],["rezerwacje","Rezerwacje"],["sprzedaz","Sprzedaż 30 dni"],["wartosc","Wartość stanu"]].map(([v,t])=>`<option value="${v}" ${sortowanieMagazynu===v?"selected":""}>${t}</option>`).join("")}</select></label>
      <label><span>Dostawca</span><select onchange="filtrDostawcyMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszyscy">Każdy dostawca</option>${dostawcyMag.map(d=>`<option value="${esc(d)}" ${filtrDostawcyMagazynu===d?"selected":""}>${esc(d)}</option>`).join("")}</select></label>
      <label><span>Lokalizacja</span><select onchange="filtrLokalizacjiMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszystkie">Każda lokalizacja</option><option value="BRAK" ${filtrLokalizacjiMagazynu==="BRAK"?"selected":""}>Bez lokalizacji</option>${lokalizacje.map(l=>`<option value="${esc(l.kod)}" ${filtrLokalizacjiMagazynu===l.kod?"selected":""}>${esc(l.kod)} — ${esc(l.nazwa||l.typ)}</option>`).join("")}</select></label>
      <label><span>Inwentaryzacja</span><select onchange="filtrInwentaryzacjiMagazynu=this.value;stronaMagazynu=1;renderuj()"><option value="wszystkie">Każda data</option><option value="aktualna" ${filtrInwentaryzacjiMagazynu==="aktualna"?"selected":""}>Aktualna ≤ 90 dni</option><option value="stara" ${filtrInwentaryzacjiMagazynu==="stara"?"selected":""}>Brak / starsza niż 90 dni</option></select></label>
      <label><span>Na stronie</span><select onchange="ustawMagazynNaStronie(this.value)">${[25,50,100,200,500].map(n=>`<option value="${n}" ${magazynNaStronie===n?"selected":""}>${n} produktów</option>`).join("")}</select></label>
    </div>`})}
    <div class="warehouse-stock-results"><span>Pokazano <b>${fragment.length}</b> z <b>${lista.length}</b> produktów</span><span>Strona ${stronaMagazynu} z ${liczbaStron}</span></div>
    <div class="pagination">${paginacjaHTML(stronaMagazynu,liczbaStron,"ustawStroneMagazynu")}</div>
    <div class="warehouse-stock-list">
      ${fragment.map(p=>{
        const stan=stanMagazynuId(p.id),r=Number(rez[p.id]||0),sp=Number(spr[p.id]||0),plan=sugestiaZatowarowania(p,rez,spr),meta=plan.meta,wart=stan===null?0:stan*kwotaNum(p.cena),pi=producentDostepnoscInfo(p),priority=priorytetDostepnosciProduktu(p,kanalySpr,rez),sklep30=Number(kanalySpr.sklep[p.id]||0),allegro30=Number(kanalySpr.allegro[p.id]||0),invTime=meta.ostatniaInwentaryzacja?Date.parse(meta.ostatniaInwentaryzacja):0,invOld=!invTime||Date.now()-invTime>90*86400000;
        const risk=pi.status==="brak"||plan.dostepne!==null&&plan.dostepne<0?"critical":pi.status==="niski"||plan.ilosc>0?"warning":pi.stale||["nieznany","blad"].includes(pi.status)?"info":"ok";
        const riskLabel=risk==="critical"?"Pilna reakcja":risk==="warning"?"Wymaga uwagi":risk==="info"?"Do weryfikacji":"Bez alarmu";
        return `<article class="warehouse-stock-card stock-${risk}">
          <header class="warehouse-stock-card-head">
            <div class="warehouse-stock-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="" loading="lazy">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><h3>${esc(p.nazwa)}</h3><small>SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||meta.kod||"—")} • ID ${esc(p.id)}</small><small>${esc(p.kategoria||"Bez kategorii")} • ${esc(p.producent||meta.dostawca||"Producent nieprzypisany")}</small></div></div>
            <div class="warehouse-stock-priority ${esc(priority.level)}"><b>${priority.score?`🏆 ${priority.score} pkt`:`${risk==="ok"?"✓":"!"} ${riskLabel}`}</b><small>Sklep ${sklep30} • Allegro ${allegro30} • aktywne ${priority.active}</small></div>
            <div class="warehouse-stock-state"><span class="stock-state-dot ${risk}"></span><div><b>${riskLabel}</b><small>${dostepnoscBadgeAdmin(p)}</small></div></div>
          </header>
          <div class="warehouse-stock-card-grid">
            <section><label>Stan fizyczny</label><div class="warehouse-stock-balance"><span><b>${stan===null?"∞":stan}</b><small>na stanie</small></span><span><b>${r}</b><small>rezerwacje</small></span><span class="${plan.dostepne!==null&&plan.dostepne<0?"negative":""}"><b>${plan.dostepne===null?"∞":plan.dostepne}</b><small>dostępne</small></span></div><small>Wartość: ${stan===null?"—":zl(wart)} • ${stanBadgeMagazynu(stan,progNiskiProduktu(p))}</small></section>
            <section><label>Producent i źródło</label>${producentDostepnoscBadgeHTML(p,true)}<small>${pi.checked?`Kontrola: ${esc(allegroDataTxt(pi.checked))}`:"Nigdy nie sprawdzano"}${pi.stale?" • wynik nieaktualny":""}</small></section>
            <section><label>Sprzedaż i pokrycie</label><b>${sp} szt. / 30 dni</b><small>Sklep ${sklep30} • Allegro ${allegro30} • średnio ${(sp/30).toFixed(2).replace(".",",")} dziennie</small><small>Pokrycie ${plan.dniPokrycia===null?"—":plan.dniPokrycia+" dni"} • cel ${plan.target} • dostawa ${plan.lead} dni</small></section>
            <section class="warehouse-stock-decision ${plan.poziom}"><label>Decyzja magazynowa</label><b>${plan.ilosc?`Domówić ${esc(plan.ilosc)} szt.`:"Nie trzeba domawiać"}</b><small>${esc(plan.powod)}</small><small>Minimum ${esc(plan.min)} • cel ${esc(plan.target)} • min. zakup ${esc(plan.minZakup||0)}</small></section>
          </div>
          <div class="warehouse-stock-location"><span>🗺️ <b>${esc(meta.lokalizacja?nazwaLokalizacjiMagazynu(meta.lokalizacja):"Brak lokalizacji")}</b></span><span>🏭 ${esc(meta.dostawca||"Brak dostawcy")}</span><span class="${invOld?"old":""}">📅 ${meta.ostatniaInwentaryzacja?`Inwentaryzacja ${esc(allegroDataTxt(meta.ostatniaInwentaryzacja))}`:"Stan nigdy niepotwierdzony"}</span></div>
          <div class="warehouse-stock-actions">
            <div class="warehouse-stock-stepper"><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},-10)" ${stan===null?"disabled":""}>−10</button><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},-1)" ${stan===null?"disabled":""}>−1</button><strong>${stan===null?"∞":stan}</strong><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},1)" ${stan===null?"disabled":""}>+1</button><button type="button" onclick="szybkaKorektaMagazynu(${jsArg(p.id)},10)" ${stan===null?"disabled":""}>+10</button></div>
            <form class="warehouse-stock-set" onsubmit="korygujStanMagazynu(event,${jsArg(p.id)})"><input name="stan" value="${stan===null?"":stan}" placeholder="Nowy stan / puste = ∞" inputmode="numeric"><input name="powod" placeholder="Powód korekty" maxlength="80"><button class="btn" type="submit">Zapisz stan</button></form>
            <div class="warehouse-stock-links"><button class="btn ghost" type="button" onclick="przelaczDostepnoscProduktu(${jsArg(p.id)})">${produktAutomatycznieNiedostepny(p)?"🔄 Sprawdź i przywróć":produktOznaczonyNiedostepny(p)?"▶️ Włącz sprzedaż":"⏸️ Wyłącz sprzedaż"}</button>${pi.url?`<button class="btn ghost" type="button" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź producenta</button><a class="btn ghost" href="${esc(pi.url)}" target="_blank" rel="noopener">Źródło ↗</a>`:""}<a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(p.id)}">✏️ Produkt</a></div>
          </div>
          <details class="warehouse-stock-details"><summary>⚙️ Kartoteka, lokalizacja i parametry zatowarowania</summary><form class="warehouse-stock-meta-form" onsubmit="zapiszKartotekeMagazynu(event,${jsArg(p.id)})"><label>Lokalizacja ${selectLokalizacjiMagazynu(meta.lokalizacja||"")}</label><label>Dostawca<input name="dostawca" value="${esc(meta.dostawca||"")}" placeholder="np. Alexander"></label><label>EAN / kod<input name="kod" value="${esc(meta.kod||p.gtin||p.ean||"")}"></label><label>Stan minimalny<input name="minStock" value="${esc(meta.minStock??"")}" inputmode="numeric"></label><label>Stan docelowy<input name="targetStock" value="${esc(meta.targetStock??"")}" inputmode="numeric"></label><label>Czas dostawy (dni)<input name="leadTime" value="${esc(meta.leadTime??"")}" inputmode="numeric"></label><label>Minimalny zakup<input name="minZakup" value="${esc(meta.minZakup??"")}" inputmode="numeric"></label><label>Uwagi<input name="uwagi" value="${esc(meta.uwagi||"")}"></label><div class="warehouse-stock-meta-buttons"><button class="btn ghost" type="button" onclick="oznaczInwentaryzacjeProduktu(${jsArg(p.id)})">✅ Potwierdź stan</button><button class="btn" type="submit">💾 Zapisz kartotekę</button></div></form></details>
        </article>`;
      }).join("")||`<div class="warehouse-stock-empty"><b>Brak produktów pasujących do filtrów</b><p>Wyczyść filtry albo zmień kryteria wyszukiwania.</p><button class="btn" onclick="wyczyscFiltryStanowMagazynu()">Pokaż wszystkie</button></div>`}
    </div>
    <div class="pagination">${paginacjaHTML(stronaMagazynu,liczbaStron,"ustawStroneMagazynu")}</div>
  </div>
  <div class="warehouse-columns" style="${aktywna==="ruchy"?"":"display:none"}">
    <div class="panel">
      <h2 style="margin-top:0">🧾 Historia ruchów</h2>
      <p>Ostatnie korekty, przyjęcia i sprzedaże. Pełna historia synchronizuje się we wspólnej bazie.</p>
      <div style="overflow-x:auto"><table class="log-table">
        <tr><th>Data</th><th>Typ</th><th>Produkt</th><th>Ilość</th><th>Stan</th><th>Dokument</th></tr>
        ${(ruchyMagazynowe||[]).slice(0,40).map(r=>`<tr>
          <td>${esc(r.dataTxt||new Date(r.data).toLocaleString("pl-PL"))}</td>
          <td><span class="lvl lvl-info">${esc(r.typ)}</span></td>
          <td><b>${esc(r.produktNazwa)}</b><br><small>${esc(r.sku||r.produktId||"")}${r.powod?` • ${esc(r.powod)}`:""}</small></td>
          <td><b>${Number(r.ilosc)>0?"+":""}${esc(r.ilosc)}</b></td>
          <td>${r.stanPrzed===null?"∞":esc(r.stanPrzed)} → ${r.stanPo===null?"∞":esc(r.stanPo)}</td>
          <td>${esc(r.dokument||"—")}</td>
        </tr>`).join("") || `<tr><td colspan="6">Brak ruchów magazynowych.</td></tr>`}
      </table></div>
    </div>
    <div class="panel">
      <h2 style="margin-top:0">⚙️ Ustawienia magazynu</h2>
      <form onsubmit="zapiszUstawieniaMagazynu(event)">
        <div class="f-group"><label>Nazwa magazynu</label><input name="nazwa" value="${esc(u.nazwa)}"></div>
        <div class="f-row"><div class="f-group"><label>Próg niskiego stanu</label><input name="progNiski" inputmode="numeric" value="${esc(prog)}"></div><div class="f-group"><label>Operator domyślny</label><input name="operator" value="${esc(u.domyslnyOperator)}"></div></div>
        <div class="f-group"><label>Lokalizacja / uwagi</label><input name="lokalizacja" value="${esc(u.lokalizacja)}" placeholder="np. regał, pomieszczenie, adres"></div>
        <div class="f-row"><div class="f-group"><label>Domyślny dostawca</label><input name="domyslnyDostawca" value="${esc(u.domyslnyDostawca)}" placeholder="np. Pinkfrog / hurtownia"></div><div class="f-group"><label>Domyślny czas dostawy (dni)</label><input name="domyslnyLeadTime" inputmode="numeric" value="${esc(u.domyslnyLeadTime)}"></div></div>
        <div class="f-row"><div class="f-group"><label>Zapas docelowy (dni)</label><input name="domyslnyZapasDni" inputmode="numeric" value="${esc(u.domyslnyZapasDni)}"></div><div class="f-group"><label>Akcja kartoteki</label><button class="btn ghost" type="button" onclick="wypelnijDomyslnaKartotekeMagazynu()">Uzupełnij braki domyślnymi danymi</button></div></div>
        <h2>🏭 Monitoring producentów</h2>
        <p class="order-detail-lead">Automatyczny Agent AI co 6 godzin losuje spośród najdłużej niesprawdzanych linków. Telegram jest wysyłany tylko po pojawieniu się nowego niskiego stanu albo braku.</p>
        <div class="f-row"><div class="f-group"><label>Próg ostrzeżenia u producenta (szt.)</label><input name="progNiskiProducenta" type="number" min="1" value="${esc(u.progNiskiProducenta)}"></div><div class="f-group"><label>Wielkość wyrywkowej próbki</label><input name="producentProbka" type="number" min="1" max="25" value="${esc(u.producentProbka)}"></div></div>
        <div class="f-group"><label>Po ilu godzinach wynik uznać za nieaktualny</label><input name="producentMaxWiekGodz" type="number" min="1" value="${esc(u.producentMaxWiekGodz)}"></div>
        <button class="btn" type="submit">💾 Zapisz ustawienia</button>
      </form>
    </div>
  </div>
  `);
}
function widokAdminProdukty(){
  allegroLadujJesliTrzeba();
  const audytAllegro=allegroAudytDuplikatow();
  const audytSklep=audytDuplikatowSklepu();
  let wszystkie = produktyDoAdministracji();
  if(szukajProduktow) wszystkie = wszystkie.filter(p=>produktPasujeFrazie(p,szukajProduktow));
  if(filtrProduktow!=="Wszystkie") wszystkie = wszystkie.filter(p=>p.kategoria===filtrProduktow);
  if(filtrStatusuProduktow==="aktywne") wszystkie=wszystkie.filter(p=>!czyProduktAdminWKoszu(p));
  if(filtrStatusuProduktow==="kosz") wszystkie=wszystkie.filter(p=>czyProduktAdminWKoszu(p));
  if(filtrStatusuProduktow==="duplikaty") wszystkie=wszystkie.filter(p=>audytSklep.grupy.some(g=>g.produkty.some(x=>String(x.id)===String(p.id))));
  if(filtrZrodlaProduktow==="bazowe") wszystkie=wszystkie.filter(p=>!produktyDodane.some(x=>x.id===p.id));
  if(filtrZrodlaProduktow==="wlasne") wszystkie=wszystkie.filter(p=>produktyDodane.some(x=>x.id===p.id));
  if(filtrStanuProduktow==="dostepne") wszystkie=wszystkie.filter(p=>stanyProduktow[p.id]===undefined||Number(stanyProduktow[p.id])>0);
  if(filtrStanuProduktow==="niskie") wszystkie=wszystkie.filter(p=>Number(stanyProduktow[p.id])>0&&Number(stanyProduktow[p.id])<=5);
  if(filtrStanuProduktow==="brak") wszystkie=wszystkie.filter(p=>Number(stanyProduktow[p.id])===0);
  if(filtrAllegroProduktow==="aktywne") wszystkie=wszystkie.filter(p=>String(allegroOfertaDlaProduktuSklepu(p)?.status||"").toUpperCase()==="ACTIVE");
  if(filtrAllegroProduktow==="szkice") wszystkie=wszystkie.filter(p=>{const o=allegroOfertaDlaProduktuSklepu(p);return o&&String(o.status||"").toUpperCase()!=="ACTIVE";});
  if(filtrAllegroProduktow==="polaczone") wszystkie=wszystkie.filter(p=>!!allegroOfertaDlaProduktuSklepu(p));
  if(filtrAllegroProduktow==="brak") wszystkie=wszystkie.filter(p=>!allegroOfertaDlaProduktuSklepu(p));
  if(filtrAllegroProduktow==="duplikaty") wszystkie=wszystkie.filter(p=>allegroOfertyPasujaceDoProduktu(p).filter(allegroDopasowanieDuplikatuAktywne).length>1);
  wszystkie=sortujProduktyAdmin(wszystkie);
  const liczbaWynikow=wszystkie.length;
  const liczbaStron=Math.max(1,Math.ceil(liczbaWynikow/produktyNaStronieAdmin));
  stronaAdminProduktow=Math.min(Math.max(1,stronaAdminProduktow),liczbaStron);
  const fragment=wszystkie.slice((stronaAdminProduktow-1)*produktyNaStronieAdmin,stronaAdminProduktow*produktyNaStronieAdmin);
  const katOpcje = [...new Set(produktyDoAdministracji().map(p=>p.kategoria))];
  const bazoweWKoszu=bazoweProduktyWKoszu();
  const liczbaWKoszu=koszDodanych.length+bazoweWKoszu.length;
  return asortymentSzkielet("produkty", `
    <div class="panel assortment-catalog-page">
      <header class="assortment-catalog-hero">
        <div><span class="order-pro-label">Centralna kartoteka sprzedaży</span><h1>🏷️ Katalog produktów</h1><p>Produkty sklepu, magazynu i Allegro w jednej tabeli. Każdy kafelek poniżej jest aktywnym filtrem i pokazuje dokładnie odpowiadające mu pozycje.</p><small>${produkty.length} widocznych w sklepie • ${produktyDoAdministracji().length} wszystkich kart • źródło: ${zrodloProduktow==="json"?"products.json":"lista zapasowa"} + zmiany wspólne</small></div>
        <div class="assortment-catalog-actions"><a class="btn" href="#/admin/produkty/dodaj">➕ Dodaj ręcznie lub z linku</a><a class="btn ghost" href="#/admin/mapowanie">🧩 Mapowanie</a><a class="btn ghost" href="#/admin/eksport">⇄ Import / eksport</a><details><summary>Więcej operacji</summary><button class="btn ghost" onclick="eksportujProduktyJSON()">📤 products.json</button><button class="btn ghost" onclick="eksportujProduktyCSV()">📤 CSV</button></details></div>
      </header>
      <div class="assortment-search-primary">
        <label><span>Wyszukaj w całym asortymencie</span><input data-assortment-search placeholder="Nazwa, EXTERNAL_ID, SKU, EAN, ID, opis, kategoria lub producent…" value="${esc(szukajProduktow)}" oninput="asortymentSzukajProdukty(this)" autocomplete="off"></label>
        <small>Wyniki zmieniają się bez przeładowania panelu i bez utraty kursora.</small>
      </div>
      <div class="orders-stat-grid assortment-audit-grid">
        <button class="order-stat-card stat-filter ${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('aktywne')" aria-pressed="${filtrStatusuProduktow==="aktywne"&&filtrAllegroProduktow==="wszystkie"}"><span>🏷️</span><b>${produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).length}</b><small>aktywne karty produktów</small></button>
        <button class="order-stat-card stat-filter money ${filtrAllegroProduktow==="polaczone"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_polaczone')" aria-pressed="${filtrAllegroProduktow==="polaczone"}"><span>🟠</span><b>${produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&allegroOfertaDlaProduktuSklepu(p)).length}</b><small>połączone z Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytAllegro.produkty?"hot":"money"} ${filtrAllegroProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_duplikaty')" aria-pressed="${filtrAllegroProduktow==="duplikaty"}"><span>${audytAllegro.produkty?"⚠️":"✅"}</span><b>${audytAllegro.produkty}</b><small>podejrzenie duplikatu Allegro</small></button>
        <button class="order-stat-card stat-filter ${filtrAllegroProduktow==="brak"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('allegro_brak')" aria-pressed="${filtrAllegroProduktow==="brak"}"><span>➕</span><b>${produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&!allegroOfertaDlaProduktuSklepu(p)).length}</b><small>bez oferty Allegro</small></button>
        <button class="order-stat-card stat-filter ${audytSklep.produkty?"hot":"money"} ${filtrStatusuProduktow==="duplikaty"?"active":""}" type="button" onclick="ustawKafelkowyFiltrAsortymentu('duplikaty_sklepu')" aria-pressed="${filtrStatusuProduktow==="duplikaty"}"><span>${audytSklep.produkty?"🧬":"✅"}</span><b>${audytSklep.produkty}</b><small>karty w grupach duplikatów sklepu</small></button>
      </div>
      ${audytSklep.grupy.length?`<section class="allegro-duplicate-center store-duplicate-center"><div class="order-section-head"><div><span class="order-pro-label">Porządkowanie katalogu sklepu</span><h3>🧬 Powtarzające się produkty (${audytSklep.grupy.length} grup)</h3><p class="order-detail-lead">Dla każdej grupy wybierz jedną kartę do pozostawienia. Przycisk trwałego czyszczenia usuwa wszystkie pozostałe kopie z katalogu publicznego, panelu, magazynu i wspólnej bazy.</p></div><button class="btn ghost" onclick="filtrStatusuProduktow='duplikaty';stronaAdminProduktow=1;renderuj()">Pokaż wszystkie kopie</button></div><div class="allegro-duplicate-groups">${audytSklep.grupy.slice(0,12).map(g=>`<article class="allegro-duplicate-group"><header><div><b>${esc(g.canonical.nazwa||"Produkt")}</b><small>Wspólny klucz: ${esc(g.keys.join(" • "))}</small></div><span class="lvl lvl-ostrzezenie">${g.produkty.length} kart</span></header><div class="allegro-duplicate-options">${g.produkty.map(p=>`<button type="button" class="allegro-duplicate-option ${String(p.id)===String(g.canonical.id)?"is-canonical":""}" onclick="ustawProduktGlownyDuplikatu(${jsArg(g.groupKey)},${jsArg(p.id)})"><div class="allegro-duplicate-product">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="">`:`<span>${esc(p.ikona||"📦")}</span>`}<div><b>${esc(p.nazwa)}</b><small>ID ${esc(p.id)} • EXTERNAL_ID ${esc(p.externalId||"—")} • SKU ${esc(p.sku||"—")} • EAN ${esc(p.gtin||p.ean||"—")}</small><em>${String(p.id)===String(g.canonical.id)?"✅ ta karta pozostanie":"❌ ta kopia zostanie usunięta"}</em></div></div></button>`).join("")}</div><div class="diag-actions" style="justify-content:flex-end"><button class="btn danger" onclick="usunKopieGrupyProduktuTrwale(${jsArg(g.groupKey)})">🗑️ Pozostaw 1 i usuń trwale ${g.hidden.length} kopii</button></div></article>`).join("")}</div></section>`:`<div class="duplicate-audit-ok"><b>✅ Kontrola katalogu sklepu:</b> brak powtarzających się produktów po EXTERNAL_ID, SKU, EAN i kodzie producenta.</div>`}
      ${audytAllegro.produkty?`<div class="duplicate-audit-alert"><div><b>⚠️ Kontrola Asortymentu wykryła powtarzające się oferty Allegro</b><small>${audytAllegro.produkty} produktów pasuje do ${audytAllegro.oferty} ofert. Nowe wystawienie wybierze istniejącą ofertę do aktualizacji; istniejące powtórzenia możesz sprawdzić bezpośrednio w katalogu Allegro.</small></div><button class="btn ghost" onclick="filtrAllegroProduktow='duplikaty';stronaAdminProduktow=1;renderuj()">Pokaż produkty</button><a class="btn" href="#/admin/allegro/oferty" onclick="filtrAllegroOfert='duplikaty'">Otwórz oferty</a></div>`:`<div class="duplicate-audit-ok"><b>✅ Kontrola ofert Allegro:</b> aktualny asortyment nie zawiera produktów połączonych z więcej niż jedną ofertą.</div>`}
      <details class="assortment-filter-panel admin-search-standard" open><summary><span><b>🔎 Wyszukiwanie zaawansowane</b><small>Kafelki ustawiają gotowy filtr, a pola poniżej pozwalają go dodatkowo zawęzić.</small></span><span class="admin-search-summary-meta"><strong>${liczbaWynikow} wyników</strong><i aria-hidden="true"></i></span></summary><div class="filter-grid admin-search-standard-body">
        <select onchange="filtrProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option ${filtrProduktow==="Wszystkie"?"selected":""}>Wszystkie</option>
          ${katOpcje.map(k=>`<option ${k===filtrProduktow?"selected":""}>${esc(k)}</option>`).join("")}
        </select>
        <select onchange="filtrStatusuProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="wszystkie" ${filtrStatusuProduktow==="wszystkie"?"selected":""}>Wszystkie statusy</option>
          <option value="aktywne" ${filtrStatusuProduktow==="aktywne"?"selected":""}>Tylko aktywne</option>
          <option value="kosz" ${filtrStatusuProduktow==="kosz"?"selected":""}>Tylko w koszu</option>
          <option value="duplikaty" ${filtrStatusuProduktow==="duplikaty"?"selected":""}>Tylko powtarzające się (${audytSklep.produkty})</option>
        </select>
        <select onchange="filtrZrodlaProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="wszystkie" ${filtrZrodlaProduktow==="wszystkie"?"selected":""}>Każde źródło</option>
          <option value="bazowe" ${filtrZrodlaProduktow==="bazowe"?"selected":""}>products.json</option>
          <option value="wlasne" ${filtrZrodlaProduktow==="wlasne"?"selected":""}>Dodane w panelu</option>
        </select>
        <select onchange="filtrStanuProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="wszystkie" ${filtrStanuProduktow==="wszystkie"?"selected":""}>Magazyn: każdy stan</option>
          <option value="dostepne" ${filtrStanuProduktow==="dostepne"?"selected":""}>Magazyn: powyżej 0 / bez limitu</option>
          <option value="niskie" ${filtrStanuProduktow==="niskie"?"selected":""}>Magazyn: niski stan (1–5)</option>
          <option value="brak" ${filtrStanuProduktow==="brak"?"selected":""}>Magazyn: 0 szt.</option>
        </select>
        <select onchange="filtrAllegroProduktow=this.value;stronaAdminProduktow=1;renderuj()">
          <option value="wszystkie" ${filtrAllegroProduktow==="wszystkie"?"selected":""}>Allegro: wszystkie</option>
          <option value="polaczone" ${filtrAllegroProduktow==="polaczone"?"selected":""}>Allegro: wszystkie połączone</option>
          <option value="aktywne" ${filtrAllegroProduktow==="aktywne"?"selected":""}>Allegro: aktywne</option>
          <option value="szkice" ${filtrAllegroProduktow==="szkice"?"selected":""}>Allegro: szkice / nieaktywne</option>
          <option value="brak" ${filtrAllegroProduktow==="brak"?"selected":""}>Allegro: brak oferty</option>
          <option value="duplikaty" ${filtrAllegroProduktow==="duplikaty"?"selected":""}>Allegro: podejrzane duplikaty (${audytAllegro.produkty})</option>
        </select>
        <select onchange="ustawSortowanieAdminProduktow(this.value)">
          <option value="external" ${sortowanieAdminProduktow==="external"?"selected":""}>EXTERNAL_ID / SKU (domyślnie)</option>
          <option value="id" ${sortowanieAdminProduktow==="id"?"selected":""}>Sortuj: ID</option>
          <option value="nazwa" ${sortowanieAdminProduktow==="nazwa"?"selected":""}>Nazwa A–Z</option>
          <option value="cena-rosnaco" ${sortowanieAdminProduktow==="cena-rosnaco"?"selected":""}>Cena rosnąco</option>
          <option value="cena-malejaco" ${sortowanieAdminProduktow==="cena-malejaco"?"selected":""}>Cena malejąco</option>
          <option value="stan" ${sortowanieAdminProduktow==="stan"?"selected":""}>Najniższy stan</option>
        </select>
        <button class="btn ghost" type="button" onclick="szukajProduktow='';filtrProduktow='Wszystkie';filtrStatusuProduktow='aktywne';filtrZrodlaProduktow='wszystkie';filtrStanuProduktow='wszystkie';filtrAllegroProduktow='wszystkie';stronaAdminProduktow=1;renderuj()">Wyczyść wszystkie</button>
      </div></details>
      <div data-assortment-results><div class="results-bar">
        <span>Znaleziono: <b>${liczbaWynikow}</b>. Strona ${stronaAdminProduktow} z ${liczbaStron}.</span>
        <label>Na stronie:
          <select onchange="ustawProduktyNaStronieAdmin(this.value)">
            ${[25,50,100,200,500,1000].map(n=>`<option value="${n}" ${produktyNaStronieAdmin===n?"selected":""}>${n}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="pagination" style="margin:.7rem auto">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div>
      <div class="masowe-akcje">
        <b style="font-size:.85rem">Zaznaczone (${zaznaczoneProdukty.size}):</b>
        <button class="btn danger" onclick="usunZaznaczoneProd()" style="padding:.35rem .8rem">🗑️ Usuń</button>
        <span style="display:flex;gap:.4rem;align-items:center">
          <select id="trybCenProduktow" style="padding:.35rem .6rem"><option value="percent">O procent (+/−)</option><option value="amount">O kwotę (+/−)</option><option value="fixed">Ustaw cenę</option></select>
          <input id="procentCen" placeholder="np. 10 lub -5" inputmode="decimal" style="width:110px;padding:.35rem .6rem;border:1.5px solid var(--line);border-radius:9px">
          <button class="btn ghost" onclick="zmienCenyZaznaczonych()" style="padding:.35rem .8rem">💰 Zmień ceny</button>
        </span>
      </div>
      <div class="assortment-table-wrap"><table class="log-table assortment-product-table">
        <tr><th><input type="checkbox" onchange="zaznaczWidoczneProd(this, [${fragment.map(p=>p.id).join(",")}])" style="width:16px;height:16px" title="Zaznacz produkty na tej stronie"></th><th>ID</th><th>EXTERNAL_ID</th><th>Miniatura</th><th>Produkt</th><th>Producent</th><th>Kategoria</th><th>Cena (kliknij, by zmienić)</th><th>Promocja</th><th>Magazyn</th><th>Sprzedaż</th><th>Allegro</th><th>Akcje</th></tr>
        ${fragment.map(p=>{
          const dodany = jestProduktemDodanym(p.id);
          const ukryty = czyProduktAdminWKoszu(p);
          const edytowany = !!produktyEdytowane[p.id];
          return `<tr style="${ukryty?'opacity:.45':''}">
          <td><input type="checkbox" ${zaznaczoneProdukty.has(p.id)?"checked":""} onchange="przelaczZaznProd(${p.id})" style="width:16px;height:16px"></td>
          <td>${p.id}</td>
          <td><b>${esc(p.externalId||p.sku||"—")}</b>${audytSklep.hiddenIds.has(String(p.id))?`<br><span class="lvl lvl-ostrzezenie">ukryta kopia</span>`:""}</td>
          <td><span class="admin-product-thumb">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="admin-product-thumb-fallback" style="display:none">${esc(p.ikona||"📦")}</span>`:`<span class="admin-product-thumb-fallback">${esc(p.ikona||"📦")}</span>`}</span></td>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b>${dodany?' <span class="lvl lvl-info">dodany</span>':""}${edytowany?' <span class="lvl lvl-info">edytowany</span>':""}${ukryty?' <span class="lvl lvl-ostrzezenie">usunięty</span>':""}</td>
          <td><b>${esc(p.producent||p.marka||"—")}</b></td>
          <td>${esc(p.kategoria)}</td>
          <td><input value="${String(p.cena.toFixed(2)).replace(".",",")}" inputmode="decimal" onchange="ustawCene(${p.id}, this.value)" style="width:80px;padding:.25rem .4rem;border:1.5px solid var(--line);border-radius:8px;text-align:right;font-weight:700"> zł</td>
          <td>${p.staraCena?`<span class="lvl lvl-blad">−${Math.round((1-p.cena/p.staraCena)*100)}%</span>`:"—"}</td>
          <td><input value="${stanyProduktow[p.id]??""}" placeholder="∞" inputmode="numeric" onchange="ustawStan(${p.id}, this.value)" style="width:58px;padding:.25rem .4rem;border:1.5px solid var(--line);border-radius:8px;text-align:center;${stanyProduktow[p.id]===0?'background:#fee2e2':''}"><br><small style="color:var(--muted2)">tylko admin</small></td>
          <td>${dostepnoscBadgeAdmin(p)}<br><button class="btn ghost" onclick="przelaczDostepnoscProduktu(${jsArg(p.id)})" style="padding:.25rem .5rem;margin-top:.25rem">${produktAutomatycznieNiedostepny(p)?"Sprawdź i przywróć":produktOznaczonyNiedostepny(p)?"Włącz sprzedaż":"Wyłącz sprzedaż"}</button></td>
          <td>${allegroStatusProduktuHTML(p)}</td>
          <td style="white-space:nowrap">
            <a class="btn ghost" href="#/admin/produkty/edytuj/${p.id}" style="padding:.3rem .55rem" title="Edytuj">✏️</a>
            <button class="btn ghost" onclick="duplikujProdukt(${p.id})" style="padding:.3rem .55rem" title="Duplikuj">📄</button>
            ${ukryty
              ? `<button class="btn ghost" onclick="przywrocProdukt(${p.id})" style="padding:.3rem .55rem" title="Przywróć">↩️</button>`
              : `<button class="btn danger" onclick="if(confirm('Usunąć produkt z oferty?')) usunProduktAdmin(${p.id})" style="padding:.3rem .55rem" title="Usuń">🗑️</button>`}
          </td>
        </tr>`;}).join("")}
      </table></div>
      <div class="pagination" style="margin:.7rem auto">${paginacjaHTML(stronaAdminProduktow,liczbaStron,"ustawStroneAdminProduktow")}</div></div>
      <p style="font-size:.8rem;color:var(--muted2);margin-top:.8rem">Zmiany wykonane tutaj działają od razu w tej przeglądarce. Po zakończeniu pobierz nowy <b>products.json</b> i podmień go na hostingu.</p>
    </div>
    ${liczbaWKoszu ? `
    <div class="panel">
      <div class="results-bar"><h2 style="margin:0">🗑️ Kosz (${liczbaWKoszu})</h2><button class="btn danger" onclick="wyczyscCalKosz()">Opróżnij kosz</button></div>
      <p style="font-size:.82rem;color:var(--muted2);margin-bottom:.6rem">Produkty pozostają w koszu przez 30 dni. W tym czasie możesz je przywrócić; później są automatycznie usuwane definitywnie.</p>
      <table class="log-table">
        <tr><th>Produkt</th><th>Typ</th><th>Usunięto</th><th>Wygasa</th><th>Akcje</th></tr>
        ${koszDodanych.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-info">własny</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocZKosza(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnie(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
        ${bazoweWKoszu.map(p=>`<tr>
          <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b> — ${zl(p.cena)}</td>
          <td><span class="lvl lvl-ostrzezenie">z products.json</span></td>
          <td>${new Date(koszMeta[p.id]?.usunietoAt||Date.now()).toLocaleDateString("pl-PL")}</td>
          <td><span class="trash-expiry">${dniDoUsuniecia(p.id)} dni</span></td>
          <td style="white-space:nowrap">
            <button class="btn ghost" onclick="przywrocProdukt(${p.id})" style="padding:.3rem .55rem">↩️ Przywróć</button>
            <button class="btn danger" onclick="if(confirm('Usunąć DEFINITYWNIE? Tej operacji nie można cofnąć.')) usunDefinitywnieBazowy(${p.id})" style="padding:.3rem .55rem">❌ Definitywnie</button>
          </td></tr>`).join("")}
      </table>
    </div>`:""}`);
}
const EMOJI_ZESTAWY=[
  {nazwa:"🎲 Gry, zabawki i edukacja",slowa:"gry zabawki planszowe edukacja puzzle",emoji:["🎲","🧩","♟️","♞","🃏","🎯","🎮","🕹️","🪀","🪁","🧸","🤖","🧠","🔤","🔢","🧮","📚","📖","✏️","🖍️","🎨","🧪","🔬","🔭","🏆","🎳","⚽","🏀","🏓","🥏"]},
  {nazwa:"🎈 Balony, impreza i prezenty",slowa:"balony balon impreza urodziny prezent dekoracje",emoji:["🎈","🎉","🎊","🥳","🎁","🎀","🪅","🪩","🎂","🧁","🍭","🍬","✨","🌟","⭐","💫","❤️","🩷","🧡","💛","💚","🩵","💙","💜","🤍","🖤","🎵","🎶","📣","🔔"]},
  {nazwa:"🧒 Dzieci i kreatywność",slowa:"dzieci kreatywne plastyczne",emoji:["👶","🧒","👧","👦","🍼","🛝","🎠","🎡","🏰","🦄","🐸","🐻","🐼","🐰","🐣","🦋","🌈","☀️","🌙","☁️","🌸","🌻","🍀","🖌️","✂️"]},
  {nazwa:"📦 Sklep i dostawa",slowa:"sklep produkt paczka dostawa promocja",emoji:["📦","🛍️","🛒","🏷️","💰","💳","🧾","🚚","🚛","🚲","✈️","📍","🏪","🏬","✅","🆕","🔥","💥","📢","🔎"]},
  {nazwa:"🏠 Dom, ogród i pozostałe",slowa:"dom ogród narzędzia elektronika sport",emoji:["🏠","🪴","🌿","🌳","🌼","💡","🔧","🧰","🔨","📏","🔦","📱","💻","⌚","📷","🎧","🔋","⚙️","🚗","🚴","🏋️","🧘","👕","👟","🎒"]}
];
let emojiPoleDocelowe=null;
function emojiPoleHTML(nazwa="ikona",wartosc="",fallback="📦"){
  return `<div class="emoji-input-row"><input name="${esc(nazwa)}" value="${esc(wartosc||"")}" placeholder="${esc(fallback)}" maxlength="8"><button class="btn ghost" type="button" onclick="otworzWyborEmoji(this,${jsArg(nazwa)})">😀 Wybierz z dużej listy</button></div>`;
}
function otworzWyborEmoji(btn,nazwa="ikona"){
  const form=btn?.closest?.("form");
  emojiPoleDocelowe=form?.elements?.[nazwa]||null;
  if(!emojiPoleDocelowe){toast("Nie znaleziono pola ikony");return;}
  document.getElementById("emojiPickerModal")?.remove();
  const modal=document.createElement("div");
  modal.id="emojiPickerModal";modal.className="emoji-picker-overlay";
  modal.innerHTML=`<div class="emoji-picker-modal" onclick="event.stopPropagation()"><div class="emoji-picker-head"><div><h2>😀 Wybierz emoji</h2><p>Duży zestaw ikon — gry i balony są na początku.</p></div><button class="btn ghost" type="button" onclick="zamknijWyborEmoji()">✕ Zamknij</button></div><input class="emoji-picker-search" placeholder="Szukaj grupy: gry, balony, dostawa…" oninput="filtrujWyborEmoji(this.value)"><div class="emoji-picker-groups">${EMOJI_ZESTAWY.map(g=>`<section class="emoji-picker-group" data-search="${esc((g.nazwa+' '+g.slowa).toLowerCase())}"><h3>${esc(g.nazwa)}</h3><div class="emoji-picker-grid">${g.emoji.map(e=>`<button type="button" title="${esc(g.nazwa)}" onclick="wybierzEmoji(${jsArg(e)})">${esc(e)}</button>`).join("")}</div></section>`).join("")}</div></div>`;
  modal.onclick=zamknijWyborEmoji;document.body.appendChild(modal);
  modal.querySelector(".emoji-picker-search")?.focus();
}
function filtrujWyborEmoji(q){
  const s=String(q||"").trim().toLowerCase();
  document.querySelectorAll("#emojiPickerModal .emoji-picker-group").forEach(el=>{el.style.display=!s||String(el.dataset.search||"").includes(s)?"":"none";});
}
function wybierzEmoji(emoji){if(emojiPoleDocelowe){emojiPoleDocelowe.value=emoji;emojiPoleDocelowe.dispatchEvent(new Event("input",{bubbles:true}));}zamknijWyborEmoji();}
function zamknijWyborEmoji(){document.getElementById("emojiPickerModal")?.remove();emojiPoleDocelowe=null;}
const ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI=3;
function domyslneUstawieniaRentownosci(){
  const raw=ustawienia.domyslneKosztyRentownosci&&typeof ustawienia.domyslneKosztyRentownosci==="object"?ustawienia.domyslneKosztyRentownosci:{};
  const money=(v,fallback=0)=>Math.max(0,Math.min(100000,kwotaNum(v??fallback))),percent=(v,fallback=0)=>Math.max(0,Math.min(100,Number(v??fallback)||0));
  return {kosztPakowania:money(raw.kosztPakowania),sklepAdditionalCost:money(raw.sklepAdditionalCost),sklepPaymentPercent:percent(raw.sklepPaymentPercent),allegroAdditionalCost:money(raw.allegroAdditionalCost),allegroShippingSubsidy:money(raw.allegroShippingSubsidy,ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI),allegroAdsPercent:percent(raw.allegroAdsPercent),vatRate:percent(raw.vatRate,23)};
}
function wartoscKosztuProduktu(p={},pole){const v=p?.[pole];return v!==undefined&&v!==null&&String(v).trim()!==""?Math.max(0,Number(v)||0):domyslneUstawieniaRentownosci()[pole];}
function domyslneKosztyDoProduktu(p={},wymus=false){const d=domyslneUstawieniaRentownosci(),next={...p};for(const [pole,value] of Object.entries(d))if(wymus||next[pole]===undefined||next[pole]===null||String(next[pole]).trim()==="")next[pole]=value;return next;}
function zastosujDomyslneKosztyProduktow(wymus=false){
  const defaults=domyslneUstawieniaRentownosci(),lista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));let changed=0;
  for(const p of lista){const patch={};for(const [pole,value] of Object.entries(defaults))if(wymus||p[pole]===undefined||p[pole]===null||String(p[pole]).trim()==="")patch[pole]=value;if(!Object.keys(patch).length)continue;const key=String(p.id),idx=produktyDodane.findIndex(x=>String(x.id)===key);if(idx>=0)produktyDodane[idx]={...produktyDodane[idx],...patch};else produktyEdytowane={...produktyEdytowane,[key]:{...(produktyEdytowane[key]||{}),...patch}};changed++;}
  if(changed){zapiszLS("artway_produkty_dodane",produktyDodane);zapiszLS("artway_produkty_edytowane",produktyEdytowane);zbudujProdukty();zaplanujZapisUstawien();}
  return changed;
}
function zapiszDomyslneUstawieniaRentownosci(event){
  event.preventDefault();const form=event.currentTarget,mode=String(event.submitter?.value||"defaults");if(mode==="all"&&!confirm("Nadpisać koszty operacyjne we wszystkich aktywnych produktach aktualnymi wartościami domyślnymi? Ceny zakupu i prowizje z API nie zostaną zmienione."))return;
  const n=name=>Math.max(0,Number(String(form.elements[name]?.value||"0").replace(",","."))||0),pct=name=>Math.min(100,n(name));
  const defaults={kosztPakowania:n("kosztPakowania"),sklepAdditionalCost:n("sklepAdditionalCost"),sklepPaymentPercent:pct("sklepPaymentPercent"),allegroAdditionalCost:n("allegroAdditionalCost"),allegroShippingSubsidy:n("allegroShippingSubsidy"),allegroAdsPercent:pct("allegroAdsPercent"),vatRate:pct("vatRate")};
  sklepDocelowaMarza=Math.max(1,Math.min(60,n("celMarzySklep")||20));allegroDocelowaMarza=Math.max(1,Math.min(60,n("celMarzyAllegro")||20));allegroJednostkiOplatCyklicznych=Math.max(1,Math.min(1000,Math.floor(n("allegroJednostkiOplatCyklicznych")||10)));
  ustawienia={...ustawienia,celMarzySklep:sklepDocelowaMarza,celMarzyAllegro:allegroDocelowaMarza,allegroJednostkiOplatCyklicznych,domyslneKosztyRentownosci:defaults};zapiszLS("artway_ustawienia",ustawienia);zapiszLS("artway_cel_marzy_sklep",sklepDocelowaMarza);zapiszLS("artway_cel_marzy_allegro",allegroDocelowaMarza);
  const applyAll=mode==="all",applyMissing=applyAll||!!form.elements.applyMissing?.checked,changed=applyMissing?zastosujDomyslneKosztyProduktow(applyAll):0;zaplanujZapisUstawien();toast(`✅ Zapisano domyślne koszty i cele${applyMissing?` • zaktualizowano ${changed} produktów`:""}`);renderuj();
}
function domyslneUstawieniaRentownosciHTML(){const d=domyslneUstawieniaRentownosci();return `<details class="profit-defaults-panel" open><summary>⚙️ Domyślne koszty i cele</summary><form onsubmit="zapiszDomyslneUstawieniaRentownosci(event)"><p class="order-detail-lead">Te wartości są używane przy nowych produktach i wszędzie tam, gdzie kartoteka nie ma własnego kosztu. Wartość wpisana bezpośrednio w produkcie ma pierwszeństwo.</p><div class="profit-default-grid"><label>🏪 Cel marży sklepu (%)<input name="celMarzySklep" type="number" min="1" max="60" step="0.1" value="${esc(sklepDocelowaMarza)}"></label><label>🟠 Cel marży Allegro (%)<input name="celMarzyAllegro" type="number" min="1" max="60" step="0.1" value="${esc(allegroDocelowaMarza)}"></label><label>📦 Pakowanie / szt. (zł)<input name="kosztPakowania" inputmode="decimal" value="${esc(d.kosztPakowania)}"></label><label>🏪 Inne koszty sklepu / szt. (zł)<input name="sklepAdditionalCost" inputmode="decimal" value="${esc(d.sklepAdditionalCost)}"></label><label>💳 Płatność sklepu (% ceny)<input name="sklepPaymentPercent" inputmode="decimal" value="${esc(d.sklepPaymentPercent)}"></label><label>🟠 Inne koszty Allegro / szt. (zł)<input name="allegroAdditionalCost" inputmode="decimal" value="${esc(d.allegroAdditionalCost)}"></label><label>🚚 Dopłata do wysyłki Allegro (zł)<input name="allegroShippingSubsidy" inputmode="decimal" value="${esc(d.allegroShippingSubsidy)}"></label><label>📣 Reklama Allegro (% ceny)<input name="allegroAdsPercent" inputmode="decimal" value="${esc(d.allegroAdsPercent)}"></label><label>🧾 Domyślny VAT (%)<input name="vatRate" inputmode="decimal" value="${esc(d.vatRate)}"></label><label>🔁 Opłatę cykliczną podziel na (szt.)<input name="allegroJednostkiOplatCyklicznych" type="number" min="1" max="1000" value="${esc(allegroJednostkiOplatCyklicznych)}"></label></div><label class="profit-default-check"><input type="checkbox" name="applyMissing" checked> Uzupełnij teraz tylko puste pola kosztowe w istniejących produktach</label><div class="diag-actions"><button class="btn" type="submit" value="defaults">💾 Zapisz ustawienia</button><button class="btn danger" type="submit" value="all">Zapisz i nadpisz koszty wszystkich produktów</button></div></form></details>`;}
function allegroRentownoscProduktu(p={},priceOverride=null,targetMargin=allegroDocelowaMarza){
  const price=kwotaNum(priceOverride??p.cenaAllegro??p.cena),purchase=kwotaNum(p.cenaZakupu),feePrice=kwotaNum(p.allegroFeePrice),savedCommission=kwotaNum(p.allegroCommissionAmount),savedRate=Math.max(0,Number(p.allegroCommissionRate)||0),commission=price>0?(feePrice&&Math.abs(feePrice-price)<.01?savedCommission:price*savedRate/100):0,recurringTotal=kwotaNum(p.allegroRecurringFees),recurringPerUnit=recurringTotal/Math.max(1,Number(allegroJednostkiOplatCyklicznych)||1),packing=wartoscKosztuProduktu(p,"kosztPakowania"),other=wartoscKosztuProduktu(p,"allegroAdditionalCost"),shipping=wartoscKosztuProduktu(p,"allegroShippingSubsidy"),adsRate=Math.max(0,wartoscKosztuProduktu(p,"allegroAdsPercent")),ads=price*adsRate/100,fixed=purchase+packing+other+shipping+recurringPerUnit,variableRate=savedRate/100+adsRate/100,profit=price-purchase-commission-recurringPerUnit-packing-other-shipping-ads,margin=price>0?profit/price*100:0,markup=purchase>0?profit/purchase*100:0,breakEven=1-variableRate>0?fixed/(1-variableRate):0,target=Math.max(0,Math.min(80,Number(targetMargin)||0))/100,recommended=1-variableRate-target>0?fixed/(1-variableRate-target):0;
  const dataComplete=purchase>0&&price>0&&!!(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))&&!!p.allegroFeeCalculatedAt;
  return {price,purchase,commission,commissionRate:savedRate,recurringTotal,recurringPerUnit,packing,other,shipping,ads,adsRate,profit:+profit.toFixed(2),margin:+margin.toFixed(2),markup:+markup.toFixed(2),breakEven:+breakEven.toFixed(2),recommended:+recommended.toFixed(2),dataComplete,feeCurrent:!!feePrice&&Math.abs(feePrice-price)<.01,positive:profit>0};
}
function sklepRentownoscProduktu(p={},priceOverride=null,targetMargin=sklepDocelowaMarza){
  const price=kwotaNum(priceOverride??p.cena),purchase=kwotaNum(p.cenaZakupu),packing=wartoscKosztuProduktu(p,"kosztPakowania"),other=wartoscKosztuProduktu(p,"sklepAdditionalCost"),paymentRate=Math.max(0,wartoscKosztuProduktu(p,"sklepPaymentPercent")),payment=price*paymentRate/100,fixed=purchase+packing+other,variableRate=paymentRate/100,profit=price-fixed-payment,margin=price>0?profit/price*100:0,markup=purchase>0?profit/purchase*100:0,breakEven=1-variableRate>0?fixed/(1-variableRate):0,target=Math.max(0,Math.min(80,Number(targetMargin)||0))/100,recommended=1-variableRate-target>0?fixed/(1-variableRate-target):0;
  return {price,purchase,packing,other,payment,paymentRate,profit:+profit.toFixed(2),margin:+margin.toFixed(2),markup:+markup.toFixed(2),breakEven:+breakEven.toFixed(2),recommended:+recommended.toFixed(2),dataComplete:purchase>0&&price>0};
}
function ustawCelMarzy(kanal,value){const v=Math.max(1,Math.min(60,Number(value)||20));if(kanal==="sklep"){sklepDocelowaMarza=v;ustawienia={...ustawienia,celMarzySklep:v};zapiszLS("artway_cel_marzy_sklep",v);}else{allegroDocelowaMarza=v;ustawienia={...ustawienia,celMarzyAllegro:v};zapiszLS("artway_cel_marzy_allegro",v);}zapiszLS("artway_ustawienia",ustawienia);zaplanujZapisUstawien();renderuj();}
function allegroZapiszProwizjeLokalnie(productId,summary={}){
  const patch={allegroCommissionAmount:kwotaNum(summary.commissionAmount),allegroCommissionRate:Number(summary.commissionRate)||0,allegroRecurringFees:kwotaNum(summary.recurringFees),allegroFeeTotal:kwotaNum(summary.totalPreviewFees),allegroFeePrice:kwotaNum(summary.salePrice),allegroFeeCurrency:summary.currency||"PLN",allegroFeeDetails:{commissions:summary.commissions||[],quotes:summary.quotes||[]},allegroFeeCalculatedAt:summary.calculatedAt||new Date().toISOString(),allegroFeeSource:summary.source||"allegro-offer-fee-preview"};
  zapiszPolaProduktuLokalnie(productId,patch,false);zaplanujZapisUstawien();return patch;
}
async function allegroPobierzProwizjeProduktu(productId,button=null,options={}){
  const form=button?.closest?.("form"),base=pobierzProduktAdmin(Number(productId))||produkty.find(p=>String(p.id)===String(productId))||{},product=form?produktRoboczyAllegroZFormularza(form,productId,base):base,offer=allegroOfertaDlaProduktuSklepu(product),offerId=String(product.allegroOfferId||offer?.id||"").trim(),price=kwotaNum(form?.elements?.cenaAllegro?.value)||kwotaNum(product.cenaAllegro||product.cena);
  if(!price){toast("Uzupełnij cenę Allegro");return null;}if(button)button.disabled=true;
  try{if(!options.silent)toast("🟠 Pobieram aktualne prowizje i opłaty z Allegro…");const d=await chmura("allegro-fee-preview",{method:"POST",body:{productId:String(productId),product,offerId,price,save:true},timeout:90000});const patch=allegroZapiszProwizjeLokalnie(productId,d.summary||{});if(form){for(const [name,value] of Object.entries({allegroCommissionAmount:patch.allegroCommissionAmount,allegroCommissionRate:patch.allegroCommissionRate,allegroRecurringFees:patch.allegroRecurringFees,allegroFeePrice:patch.allegroFeePrice,allegroFeeCalculatedAt:patch.allegroFeeCalculatedAt}))if(form.elements[name])form.elements[name].value=value;aktualizujKalkulatorCenProduktu(form);}if(!options.silent)toast(`✅ Prowizja ${zl(patch.allegroCommissionAmount)} (${Number(patch.allegroCommissionRate).toFixed(2)}%) • opłaty cykliczne ${zl(patch.allegroRecurringFees)}`);if(!form&&!options.silent)renderuj();return d;}catch(e){if(!options.silent)toast("⚠️ Kalkulator opłat Allegro: "+(e.message||e));return null;}finally{if(button)button.disabled=false;}
}
async function allegroPobierzProwizjeMasowo(){
  const complete=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)&&kwotaNum(p.cenaZakupu)>0&&kwotaNum(p.cenaAllegro||p.cena)>0&&(p.allegroOfferId||(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean)))).slice(0,25);if(!complete.length){toast("Brak produktów z pełnymi danymi do kalkulacji");return;}
  toast(`Pobieram prowizje dla ${complete.length} kompletnych produktów…`);let ok=0,fail=0;for(const p of complete){const r=await allegroPobierzProwizjeProduktu(p.id,null,{silent:true});r?ok++:fail++;}toast(`Kalkulacja prowizji zakończona: ${ok} poprawnie, ${fail} błędów`);renderuj();
}
async function ustawRekomendowanaCeneProduktu(productId,kanal,price,targetMargin=null){
  const value=kwotaNum(price);if(!value)return;const p=pobierzProduktAdmin(Number(productId));if(!p)return;
  const appliedMargin=Number.isFinite(Number(targetMargin))?+Number(targetMargin).toFixed(2):null;
  if(kanal==="sklep"){zapiszPolaProduktuLokalnie(productId,{cena:value,sklepPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{sklepPriceTargetMargin:appliedMargin})},false);zaplanujZapisUstawien();toast(`✅ Cena w sklepie została ustawiona na ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`}`);renderuj();return;}
  zapiszPolaProduktuLokalnie(productId,{cenaAllegro:value,allegroPriceRecommendedAt:new Date().toISOString(),...(appliedMargin===null?{}:{allegroPriceTargetMargin:appliedMargin}),allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI},false);zaplanujZapisUstawien();toast(`🟠 Ustawiono ${zl(value)}${appliedMargin===null?"":` • marża ${appliedMargin.toFixed(2)}%`} i aktualizuję ofertę Allegro…`);
  const next={...p,cenaAllegro:value,allegroShippingSubsidy:p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI};await allegroSynchronizujPowiazanyProduktPoZapisie(next,{forceFees:true});renderuj();
}
function allegroUstawRekomendowanaCene(productId,price){return ustawRekomendowanaCeneProduktu(productId,"allegro",price);}
function aktualizujKalkulatorCenProduktu(form){
  if(!form)return;
  const sklep=kwotaNum(form.elements.cena?.value),allegro=kwotaNum(form.elements.cenaAllegro?.value)||sklep,zakup=kwotaNum(form.elements.cenaZakupu?.value);
  const el=form.querySelector("[data-product-margin]");if(!el)return;
  const product={cena:sklep,cenaAllegro:allegro,cenaZakupu:zakup,allegroCommissionAmount:form.elements.allegroCommissionAmount?.value,allegroCommissionRate:form.elements.allegroCommissionRate?.value,allegroRecurringFees:form.elements.allegroRecurringFees?.value,allegroFeePrice:form.elements.allegroFeePrice?.value||allegro,kosztPakowania:form.elements.kosztPakowania?.value,sklepAdditionalCost:form.elements.sklepAdditionalCost?.value,sklepPaymentPercent:form.elements.sklepPaymentPercent?.value,allegroAdditionalCost:form.elements.allegroAdditionalCost?.value,allegroShippingSubsidy:form.elements.allegroShippingSubsidy?.value||ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI,allegroAdsPercent:form.elements.allegroAdsPercent?.value,allegroFeeCalculatedAt:form.elements.allegroFeeCalculatedAt?.value},r=allegroRentownoscProduktu(product,allegro),s=sklepRentownoscProduktu(product,sklep);
  el.innerHTML=`<span><small>Sklep • cena</small><b>${sklep?zl(sklep):"—"}</b></span><span class="${s.profit<0?"is-negative":""}"><small>Sklep • zysk/marża</small><b>${zakup?`${zl(s.profit)} • ${s.margin.toFixed(1)}%`:"—"}</b></span><span><small>Sklep • cel ${sklepDocelowaMarza}%</small><b>${zakup?zl(s.recommended):"—"}</b></span><span><small>Allegro • cena</small><b>${allegro?zl(allegro):"—"}</b></span><span><small>Allegro • prowizja</small><b>${r.commission?`${zl(r.commission)} • ${r.commissionRate.toFixed(2)}%`:"—"}</b></span><span class="${r.profit<0?"is-negative":""}"><small>Allegro • zysk/marża</small><b>${zakup?`${zl(r.profit)} • ${r.margin.toFixed(1)}%`:"—"}</b></span><span><small>Allegro • cel ${allegroDocelowaMarza}%</small><b>${zakup?zl(r.recommended):"—"}</b></span>`;
}
function agentAIStanWdrozeniaProduktu(p={}){
  const checks=[
    {id:"identity",label:"EAN lub kod",ok:!!(p.gtin||p.ean||p.mpn||p.kodProducenta)},
    {id:"content",label:"Opis krótki i pełny",ok:!!(p.opisKrotki&&p.opis)},
    {id:"images",label:"Zdjęcie",ok:!!p.zdjecie},
    {id:"producer",label:"Producent",ok:!!(p.producent||p.marka)},
    {id:"store",label:"Cena i kategoria sklepu",ok:!!(kwotaNum(p.cena)>0&&p.kategoria)},
    {id:"allegro",label:"Kategoria/katalog Allegro",ok:!!(p.allegroCategoryId&&(p.allegroProductId||p.gtin||p.ean))}
  ];
  return {checks,done:checks.filter(x=>x.ok).length,total:checks.length,ready:checks.every(x=>x.ok)};
}
function agentAIWdrozenieProduktuHTML(p={},edycja=false){
  const state=agentAIStanWdrozeniaProduktu(p),status=p.agentOnboardingStatus||(!p.id?"new":"not_started"),busy=status==="processing";
  return `<section class="product-agent-onboarding ${state.ready?"is-ready":busy?"is-busy":"needs-work"}"><header><div><span class="order-pro-label">Najwyższy priorytet przy dodawaniu</span><h3>🤖 Agent wdrożenia produktu</h3><p>Agent pilnuje kompletności, duplikatów, opisów, zdjęć, producenta, kategorii sklepu i przygotowania Allegro.</p></div><strong>${state.done}/${state.total}</strong></header><div class="product-agent-checks">${state.checks.map(x=>`<span class="${x.ok?"done":"wait"}">${x.ok?"✓":"○"} ${esc(x.label)}</span>`).join("")}</div><footer><small>${state.ready?"Produkt ma komplet kluczowych danych.":busy?"Agent kończy kontrolę i uzupełnianie danych…":"Brakujące pola pozostają widoczne i trafią do planu operacyjnego Agenta."}</small>${edycja?`<button class="btn" type="button" onclick="agentAIUruchomWdrozenieProduktu(${jsArg(p.id)},this)" ${busy?"disabled":""}>${busy?"⏳ Kontrola…":"🤖 Sprawdź i uzupełnij"}</button>`:""}</footer></section>`;
}
async function agentAIUruchomWdrozenieProduktu(id,button=null){
  const product=pobierzProduktAdmin(Number(id));if(!product)return null;
  if(button)button.disabled=true;zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:"processing",agentOnboardingStartedAt:new Date().toISOString()},false);renderuj();
  const result=await allegroSynchronizujPowiazanyProduktPoZapisie(product,{forceFees:true}),updated=pobierzProduktAdmin(Number(id))||product,state=agentAIStanWdrozeniaProduktu(updated),status=result?.ok&&state.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(id,{agentOnboardingStatus:status,agentOnboardingCompletedAt:status==="completed"?new Date().toISOString():"",agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingMissing:state.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${status==="completed"?"Zakończono":"Sprawdzono"} wdrożenie produktu: ${updated.nazwa||id}`,{produktId:id,status,missing:state.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();toast(status==="completed"?"✅ Agent zakończył wdrożenie produktu":"⚠️ Agent wskazał pola wymagające uzupełnienia");renderuj();return {result,status};
}
function formularzProduktu(p, tryb){
  p=domyslneKosztyDoProduktu(p||{},false);
  const wszystkie = produktyDoAdministracji();
  const edycja = tryb==="edycja";
  const kontrolaDodawania=edycja?null:produktDodawanieStanKontroli(p,{});
  const maTozsamoscProduktu=!!(p.allegroOfferId||p.allegroProductId||p.gtin||p.ean||p.externalId||p.sku||p.nazwa);
  const ofertaAllegro=maTozsamoscProduktu?allegroOfertaDlaProduktuSklepu(p):null,ofertaAllegroId=String(p.allegroOfferId||ofertaAllegro?.id||"").trim(),rentownosc=allegroRentownoscProduktu(p),rentownoscSklep=sklepRentownoscProduktu(p),seoDanePodgladu=seoEfektywneDaneProduktu(p);
  return `
    <form class="product-editor-form" data-product-id="${esc(p.id||0)}" ${!edycja?`data-product-add-form data-product-duplicate-fingerprint="${esc(kontrolaDodawania.fingerprint)}" oninput="produktDodawanieZmienione(event,this)" onchange="produktDodawanieZmienione(event,this)"`:""} onsubmit="${edycja?`zapiszProduktAdmin(event,${p.id})`:"dodajProdukt(event)"}">
      ${agentAIWdrozenieProduktuHTML(p,edycja)}
      ${!edycja?`<section class="product-add-control" data-product-add-control>${produktDodawanieKontrolaHTML(p,{})}</section>`:""}
      ${!edycja?`<section class="product-link-one-workspace product-link-inline-workspace"><div class="order-section-head"><div><span class="order-pro-label">Opcjonalne automatyczne uzupełnienie</span><h3>🔗 Pobierz dane z linku produktu</h3><p class="order-detail-lead">Wklej adres konkretnego produktu albo od razu wypełnij formularz ręcznie. Agent jedynie uzupełni pola — nic nie zostanie dodane bez Twojego zatwierdzenia na dole formularza.</p></div><span class="lvl lvl-ok">bez automatycznego zapisu</span></div><label for="oneProductUrl">Adres konkretnego produktu</label><div class="product-link-one-input"><input id="oneProductUrl" data-one-link-url name="producentUrl" type="url" value="${esc(p.producentUrl||p.sourceUrl||"")}" placeholder="https://strona-producenta.pl/konkretny-produkt"><button class="btn" type="button" onclick="pobierzDaneProduktuZUrl(this)">🤖 Pobierz i uzupełnij formularz</button></div><label class="check product-link-overwrite"><input type="checkbox" name="nadpiszImportUrl"> Nadpisz również pola wpisane przeze mnie</label><small>Po pobraniu sprawdź nazwę, cenę, opis, zdjęcia i kody. Dopiero przycisk „Zatwierdź i dodaj produkt” zapisze kartotekę.</small><div data-product-link-agent-result></div></section>`:""}
      <div class="f-row">
        <div class="f-group"><label>Nazwa *</label><input required name="nazwa" value="${esc(p.nazwa||"")}"></div>
        <div class="f-group"><label>Kategoria *</label><input required name="kategoria" list="katLista" placeholder="np. Elektronika" value="${esc(p.kategoria||kategoriaNowegoProduktu)}">
          <datalist id="katLista">${[...new Set([...wszystkieKategorie(), ...wszystkie.map(x=>x.kategoria)])].map(k=>`<option value="${esc(k)}">`).join("")}</datalist></div>
      </div>
      <div class="product-price-grid">
        <div class="f-group"><label>Cena w sklepie (zł) *</label><input required name="cena" inputmode="decimal" value="${p.cena??""}" placeholder="99.99" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div>
        <div class="f-group"><label>Cena na Allegro (zł)</label><input name="cenaAllegro" inputmode="decimal" value="${p.cenaAllegro??""}" placeholder="pusta = cena sklepu" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Ta cena jest wysyłana do oferty Allegro.</small></div>
        <div class="f-group"><label>🔒 Cena zakupu brutto (zł) — tylko administrator</label><input name="cenaZakupu" inputmode="decimal" value="${p.cenaZakupu??""}" placeholder="wewnętrzna" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Dane prywatne: niewidoczne dla klientów i Allegro, usuwane z publicznego API, products.json, Google/SEO i publikacji sklepu.${p.cenaZakupuNetto!==undefined?`<br>Netto z faktury: ${zl(p.cenaZakupuNetto)} • VAT: ${zl(p.cenaZakupuVat||0)}`:""}${p.cenaZakupuZrodlo?`<br>Źródło: ${esc(p.cenaZakupuZrodlo)} • ${esc(p.cenaZakupuDokument||"")} • ${esc(p.cenaZakupuDostawca||"")} • ${esc(p.cenaZakupuDataDokumentu||"")} • ${esc(p.cenaZakupuDopasowanie||"")}`:""}</small></div>
        <div class="f-group"><label>Stara cena (promocja)</label><input name="staraCena" inputmode="decimal" value="${p.staraCena??""}"></div>
      </div>
      <div class="product-margin-preview" data-product-margin><span><small>Sklep • cena</small><b>${p.cena?zl(p.cena):"—"}</b></span><span class="${rentownoscSklep.profit<0?"is-negative":""}"><small>Sklep • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownoscSklep.profit)} • ${rentownoscSklep.margin.toFixed(1)}%`:"—"}</b></span><span><small>Sklep • cel ${sklepDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownoscSklep.recommended):"—"}</b></span><span><small>Allegro • cena</small><b>${rentownosc.price?zl(rentownosc.price):"—"}</b></span><span><small>Allegro • prowizja</small><b>${p.allegroFeeCalculatedAt?`${zl(rentownosc.commission)} • ${rentownosc.commissionRate.toFixed(2)}%`:"—"}</b></span><span class="${rentownosc.profit<0?"is-negative":""}"><small>Allegro • zysk/marża</small><b>${p.cenaZakupu?`${zl(rentownosc.profit)} • ${rentownosc.margin.toFixed(1)}%`:"—"}</b></span><span><small>Allegro • cel ${allegroDocelowaMarza}%</small><b>${p.cenaZakupu?zl(rentownosc.recommended):"—"}</b></span></div>
      <section class="product-profit-editor"><div class="order-section-head"><div><span class="order-pro-label">Dane wewnętrzne</span><h3>📈 Koszty sklepu i Allegro</h3><p class="order-detail-lead">Kanały są liczone oddzielnie. Prowizja jest pobierana z oficjalnego kalkulatora Allegro, a sklep ma własne koszty płatności i obsługi.</p></div><div class="diag-actions">${edycja?`<button class="btn" type="button" onclick="allegroPobierzProwizjeProduktu(${jsArg(p.id)},this)">🟠 Pobierz prowizję</button>`:""}${ofertaAllegroId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(ofertaAllegroId)}" target="_blank" rel="noopener">↗ Otwórz ofertę</a>`:""}<a class="btn ghost" href="#/admin/allegro/rentownosc">Kalkulator marży</a></div></div><input type="hidden" name="allegroFeePrice" value="${esc(p.allegroFeePrice??p.cenaAllegro??p.cena??"")}"><div class="product-profit-fields"><div class="f-group"><label>Prowizja Allegro (zł)</label><input name="allegroCommissionAmount" inputmode="decimal" value="${esc(p.allegroCommissionAmount??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Kwota dla ceny ${p.allegroFeePrice?zl(p.allegroFeePrice):"—"}.</small></div><div class="f-group"><label>Prowizja Allegro (%)</label><input name="allegroCommissionRate" inputmode="decimal" value="${esc(p.allegroCommissionRate??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Opłaty Allegro cykliczne (zł)</label><input name="allegroRecurringFees" inputmode="decimal" value="${esc(p.allegroRecurringFees??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt pakowania / szt. (oba kanały)</label><input name="kosztPakowania" inputmode="decimal" value="${esc(p.kosztPakowania??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Inne koszty sklepu / szt.</label><input name="sklepAdditionalCost" inputmode="decimal" value="${esc(p.sklepAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Koszt płatności sklepu (% ceny)</label><input name="sklepPaymentPercent" inputmode="decimal" value="${esc(p.sklepPaymentPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Inne koszty Allegro / szt.</label><input name="allegroAdditionalCost" inputmode="decimal" value="${esc(p.allegroAdditionalCost??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>Dopłata do wysyłki Allegro / szt.</label><input name="allegroShippingSubsidy" inputmode="decimal" value="${esc(p.allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI)}" oninput="aktualizujKalkulatorCenProduktu(this.form)"><small>Domyślnie zawsze 3,00 zł.</small></div><div class="f-group"><label>Reklama Allegro (% ceny)</label><input name="allegroAdsPercent" inputmode="decimal" value="${esc(p.allegroAdsPercent??"")}" oninput="aktualizujKalkulatorCenProduktu(this.form)"></div><div class="f-group"><label>VAT sprzedaży (%)</label><input name="vatRate" inputmode="decimal" value="${esc(p.vatRate??23)}"></div><div class="f-group"><label>Ostatnie wyliczenie API</label><input name="allegroFeeCalculatedAt" value="${esc(p.allegroFeeCalculatedAt||"")}" readonly><small>${p.allegroFeeCalculatedAt?esc(allegroDataTxt(p.allegroFeeCalculatedAt)):"jeszcze nie pobrano"}</small></div></div><div class="profit-channel-grid"><article><small>Sklep • zysk / marża</small><b>${p.cenaZakupu?`${zl(rentownoscSklep.profit)} • ${rentownoscSklep.margin.toFixed(2)}%`:"—"}</b><span>Cel ${sklepDocelowaMarza}%: ${p.cenaZakupu?zl(rentownoscSklep.recommended):"—"}</span></article><article><small>Allegro • zysk / marża</small><b>${p.cenaZakupu?`${zl(rentownosc.profit)} • ${rentownosc.margin.toFixed(2)}%`:"—"}</b><span>Cel ${allegroDocelowaMarza}%: ${p.cenaZakupu?zl(rentownosc.recommended):"—"}</span></article></div></section>
      <div class="f-row">
        <div class="f-group"><label>Etykieta</label><select name="badge"><option value="">— brak —</option><option ${p.badge==="Nowość"?"selected":""}>Nowość</option><option ${p.badge==="Promocja"?"selected":""}>Promocja</option></select></div>
        <div class="f-group"><label>Ikona (emoji)</label>${emojiPoleHTML("ikona",p.ikona||"","📦")}</div>
        <div class="f-group"><label>Zdjęcie — link lub wgraj z dysku</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie" value="${esc(p.zdjecie||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML("wgrajZdjecieProduktu(this)", "Z dysku")}
          </div>
        </div>
      </div>
      <div id="podgladZdjecia">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="Podgląd ${esc(p.nazwa||'produktu')}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line);margin-bottom:.6rem">`:""}</div>
      <details ${p.zdjecia?.length?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🖼️ Galeria — ręczna edycja do 16 zdjęć</summary>
        ${Array.from({length:15},(_,i)=>i+2).map(n=>`
        <div class="f-group" style="margin-top:.6rem"><label>Zdjęcie ${n}</label>
          <div style="display:flex;gap:.5rem">
            <input name="zdjecie${n}" value="${esc((p.zdjecia||[])[n-2]||"")}" placeholder="https://… lub wgraj →" style="flex:1">
            ${polePlikuHTML(`wgrajZdjecieDoPola(this,'zdjecie${n}')`, "Z dysku")}
          </div>
        </div>`).join("")}
      </details>
      <div class="f-row">
        <div class="f-group"><label>Kod produktu (SKU) <small style="font-weight:400;color:var(--muted2)">opcjonalnie</small></label><input name="sku" value="${esc(p.sku||"")}" placeholder="np. ATM-0001" maxlength="30"></div>
        <div class="f-group"><label>Warianty <small style="font-weight:400;color:var(--muted2)">po przecinku, np. S, M, L, XL</small></label><input name="warianty" value="${esc((p.warianty||[]).join(", "))}" placeholder="np. S, M, L, XL albo Czarny, Biały"></div>
      </div>
      <details ${(p.gtin||p.externalId||p.mpn||p.producent||p.marka||p.kolorProduktu||p.rozmiar||p.material)?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🏷️ Dane z hurtowni / OVF</summary>
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>GTIN / EAN</label><input name="gtin" value="${esc(p.gtin||"")}" placeholder="np. 5901234567891"></div>
          <div class="f-group"><label>EXTERNAL_ID</label><input name="externalId" value="${esc(p.externalId||"")}" placeholder="ID z hurtowni"></div>
          <div class="f-group"><label>MPN</label><input name="mpn" value="${esc(p.mpn||"")}" placeholder="Kod producenta"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Producent *</label><input name="producent" list="allegroProducerList" value="${esc(allegroProducentKanoniczny(p)||p.producent||p.marka||"")}" placeholder="np. Alexander"><datalist id="allegroProducerList">${allegroListaProducentow().map(name=>`<option value="${esc(name)}">`).join("")}</datalist><small>Lista jest zarządzana w Allegro → Ustawienia.</small></div>
          <div class="f-group"><label>Marka / BRAND</label><input name="marka" value="${esc(p.marka||"")}"></div>
          <div class="f-group"><label>Kolor produktu / COLOR</label><input name="kolorProduktu" value="${esc(p.kolorProduktu||"")}" placeholder="np. Czarny matowy"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Rozmiar / SIZE</label><input name="rozmiar" value="${esc(p.rozmiar||"")}" placeholder="np. XL lub 85x60x60 cm"></div>
          <div class="f-group"><label>Materiał / MATERIAL</label><input name="material" value="${esc(p.material||"")}" placeholder="np. bawełna, karton, stal"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Kod producenta</label><input name="kodProducenta" value="${esc(p.kodProducenta||"")}" placeholder="np. 2282 lub kod katalogowy"></div>
          <div class="f-group"><label>Dostępność u producenta</label><input name="dostepnoscProducenta" value="${esc(p.dostepnoscProducenta||"")}" placeholder="dostępny / niedostępny / do sprawdzenia"></div>
          <div class="f-group"><label>Zweryfikowane źródło produktu</label>${edycja?`${p.sourceUrl||p.producentUrl?`<input name="sourceUrl" value="${esc(p.sourceUrl||p.producentUrl||"")}" readonly>`:`<input type="hidden" name="sourceUrl" value="">`}<input type="hidden" name="producentUrl" value="${esc(p.producentUrl||p.sourceUrl||"")}"><small>Adres pochodzi z kartoteki produktu.</small>`:`<input type="hidden" name="sourceUrl" value="${esc(p.sourceUrl||p.producentUrl||"")}"><small>Źródło uzupełnia się z pola na górze formularza.</small>`}</div>
        </div>
        <input type="hidden" name="stanProducenta" value="${esc(p.stanProducenta??"")}"><input type="hidden" name="stanProducentaDokladny" value="${p.stanProducentaDokladny?"1":""}"><input type="hidden" name="stanProducentaZrodlo" value="${esc(p.stanProducentaZrodlo||"")}"><input type="hidden" name="producentStatus" value="${esc(p.producentStatus||"")}"><input type="hidden" name="producentSprawdzonoAt" value="${esc(p.producentSprawdzonoAt||"")}">
        <div class="supplier-editor-status">${producentDostepnoscBadgeHTML(p)}${edycja&&/^https?:\/\//i.test(String(p.producentUrl||p.sourceUrl||""))?`<button class="btn ghost" type="button" onclick="agentAISprawdzDostepnoscProducentow(1,[${jsArg(p.id)}])">🤖 Sprawdź stan u producenta</button>`:""}</div>
        ${p.sourceEvidence?.canonicalUrl||p.sourceEvidence?.url?`<div class="product-source-evidence"><div><span>🔎 Zweryfikowane źródło danych</span><b>${esc(p.sourceEvidence.host||(()=>{try{return new URL(p.sourceEvidence.canonicalUrl||p.sourceEvidence.url).hostname;}catch(e){return "strona produktu";}})())}</b><small>Odczyt: ${esc(p.sourceEvidence.fetchedAt?new Date(p.sourceEvidence.fetchedAt).toLocaleString("pl-PL"):"brak daty")} • pewność Agenta ${esc(p.agentImportConfidence||0)}%</small></div><a class="btn ghost" href="${esc(p.sourceEvidence.canonicalUrl||p.sourceEvidence.url)}" target="_blank" rel="noopener">Otwórz źródło ↗</a><details><summary>Pobrane informacje (${esc((p.sourceEvidence.fields||[]).length)})</summary><p>${esc((p.sourceEvidence.fields||[]).join(" • ")||"nazwa • cena • opis • zdjęcia • parametry • dostępność")}</p></details></div>`:""}
      </details>
      <details ${(p.allegroCategoryId||p.allegroProductId||p.allegroOfferId)?"open":""} style="margin-bottom:.8rem">
        <summary style="cursor:pointer;font-weight:700;font-size:.88rem">🟠 Allegro — dane do wystawienia</summary>
        ${allegroOstatniWynikWystawienia?.produktId===String(p.id)?allegroWynikOperacjiHTML():""}
        <div class="backend-note" style="margin-top:.7rem"><b>Status produktu:</b> ${allegroStatusProduktuHTML(p)}<br><small>Przy zapisie sklep sprawdza ID oferty, external.id/SKU, EAN i kod producenta. Istniejąca oferta zostanie zaktualizowana, a nie powielona.</small></div>
        <div class="f-row" style="margin-top:.7rem">
          <div class="f-group"><label>ID kategorii Allegro *</label><input name="allegroCategoryId" value="${esc(p.allegroCategoryId||"")}" placeholder="wymagane do wystawienia"></div>
          <div class="f-group"><label>ID produktu Allegro</label><input name="allegroProductId" value="${esc(p.allegroProductId||"")}" placeholder="opcjonalnie, jeśli znany"></div>
          <div class="f-group"><label>ID oferty Allegro</label><input name="allegroOfferId" value="${esc(p.allegroOfferId||"")}" placeholder="uzupełni się po wystawieniu"></div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Szukaj w katalogu Allegro</label><input name="allegroCategoryPhrase" value="${esc(p.allegroCategoryPhrase||"")}" placeholder="np. gry planszowe, zabawki kreatywne albo nazwa produktu"></div>
          <div class="f-group"><label>Dobieranie kategorii</label><button class="btn ghost" type="button" onclick="allegroDobierzKategorieProduktu(${edycja?jsArg(p.id):"0"},this)">🔎 Dobierz kategorię Allegro</button></div>
        </div>
        <div id="allegroCategoryPreview"></div>
        <div class="f-row">
          <div class="f-group"><label>Stan oferty Allegro <small style="font-weight:400;color:var(--muted2)">(ustawienie globalne; nie zmienia magazynu)</small></label><input name="allegroStock" type="number" value="${allegroStanOfertyProduktu()}" readonly><small>Każda oferta otrzymuje ${allegroStanOfertyProduktu()} szt. i automatyczne wznawianie. Zmienisz to w Ustawieniach Allegro.</small></div>
          <div class="f-group"><label>Publikacja oferty</label><select id="allegroPublicationAction"><option value="keep">Nowa: szkic / istniejąca: zachowaj status</option><option value="activate">Aktywuj po zapisie</option><option value="deactivate">Zapisz jako nieaktywną</option></select></div>
        </div>
        <div class="diag-actions">
          ${edycja?`<button class="btn ghost" type="button" onclick="allegroPrzygotujSzkicProduktu(${jsArg(p.id)})">🧾 Sprawdź szkic Allegro</button>
          <button class="btn" type="button" onclick="allegroWystawProdukt(${jsArg(p.id)})">${allegroOfertaDlaProduktuSklepu(p)?"🤖 Agent: aktualizuj ofertę Allegro":"🤖 Agent: dodaj ofertę Allegro"}</button>${ofertaAllegroId?`<a class="btn ghost" href="https://allegro.pl/oferta/${encodeURIComponent(ofertaAllegroId)}" target="_blank" rel="noopener">↗ Otwórz istniejącą ofertę</a>`:""}`:`<span style="color:var(--muted2);font-size:.85rem">Najpierw zapisz produkt, potem utworzysz z niego szkic Allegro.</span>`}
        </div>
        <div id="allegroDraftPreview"></div>
        <div id="allegroDescriptionPreview"></div>
      </details>
      <div class="f-group"><label>Opis krótki <small style="font-weight:400;color:var(--muted2)">widoczny na kartach i pod tytułem produktu</small></label><textarea name="opisKrotki" rows="3" maxlength="500" placeholder="Krótki, zachęcający opis w 1–2 zdaniach.">${esc(p.opisKrotki||p.krotkiOpis||"")}</textarea></div>
      <div class="diag-actions" style="margin-top:-.35rem">
        <button class="btn ghost" type="button" onclick="agentAIPoprawOpisyWFormularzu(this.form)">🤖 Popraw opisy stylistycznie</button>
        <button class="btn ghost" type="button" onclick="allegroPoprawOpisyWFormularzu(this)">🟠 Popraw opisy i układ Allegro</button>
      </div>
      <div class="f-group"><label>Opis pełny</label><textarea name="opis" rows="9" maxlength="20000">${esc(p.opis||"")}</textarea></div>
      <details ${(p.seoTitle||p.seoDescription)?"open":""} class="product-seo-editor">
        <summary>📣 Pozycjonowanie produktu</summary>
        <p class="order-detail-lead">Produkt automatycznie otrzymuje komplet metadanych do sklepu, Google, Open Graph, danych Product/Offer, mapy strony i feedu produktowego. Wybierz tryb ręczny tylko wtedy, gdy chcesz chronić własną treść przed regeneracją.</p>
        <div class="f-group"><label>Tryb pozycjonowania</label><select name="seoMode"><option value="auto" ${seoDanePodgladu.seoMode!=="manual"?"selected":""}>⚙️ Automatyczny — aktualizuj razem z produktem</option><option value="manual" ${seoDanePodgladu.seoMode==="manual"?"selected":""}>✍️ Ręczny — zachowaj treść administratora</option></select></div>
        <div class="f-group"><label>Tytuł SEO <small>najlepiej 30–60 znaków</small></label><input name="seoTitle" maxlength="70" value="${esc(seoDanePodgladu.seoTitle)}" placeholder="Nazwa produktu – producent"></div>
        <div class="f-group"><label>Opis SEO <small>najlepiej 80–160 znaków</small></label><textarea name="seoDescription" rows="3" maxlength="180" placeholder="Konkretny opis korzyści i zawartości produktu.">${esc(seoDanePodgladu.seoDescription)}</textarea></div>
        <div class="f-group"><label>Frazy pomocnicze</label><input name="seoKeywords" maxlength="500" value="${esc(seoDanePodgladu.seoKeywords)}" placeholder="nazwa, kategoria, producent, kod"></div>
        <div class="backend-note"><b>Automatyczne pokrycie:</b> sklep • Google • Open Graph • schema Product/Offer • sitemap • feed produktowy.<br><b>Wynik bieżącej kartoteki:</b> ${seoScoreBadge(seoOcenaProduktu(seoDanePodgladu).score)} • ostatnia kontrola: ${p.seoReviewedAt?esc(allegroDataTxt(p.seoReviewedAt)):"automatycznie przy zapisie"}</div>
      </details>
      <div class="f-group" style="max-width:240px"><label>Stan magazynowy <small style="font-weight:400;color:var(--muted2)">(nowy produkt = 0 szt.)</small></label>
        <input name="stan" inputmode="numeric" min="0" placeholder="0" value="${p.id!==undefined && stanyProduktow[p.id]!==undefined ? stanyProduktow[p.id] : 0}"></div>
      <div class="diag-actions">
        <button class="btn" type="submit" data-product-final-approval ${!edycja&&!kontrolaDodawania.canSubmit?`disabled title="Najpierw uzupełnij dane i zakończ kontrolę duplikatów"`:""}>${edycja?"💾 Zapisz zmiany":"✅ Zatwierdź i dodaj produkt"}</button>
        <a class="btn ghost" href="#/admin/produkty">Anuluj</a>
        ${edycja?`<button class="btn ghost" type="button" onclick="duplikujProdukt(${p.id})">📄 Duplikuj</button>`:""}
        ${edycja?`<button class="btn danger" type="button" onclick="if(confirm('Przenieść ten produkt do kosza na 30 dni?')){usunProduktAdmin(${p.id});location.hash='#/admin/produkty'}">🗑️ Przenieś do kosza</button>`:""}
        ${edycja && produktyEdytowane[p.id]?`<button class="btn danger" type="button" onclick="resetujEdycjeProduktu(${p.id})">↩️ Przywróć dane z products.json</button>`:""}
      </div>
    </form>`;
}
function widokAdminProduktyDodaj(){
  const params=parametryTrasy(),agentPrepared=params.get("agent")==="1";let prefill={};
  if(agentPrepared){try{prefill=JSON.parse(sessionStorage.getItem("artway_prefill_product")||"{}")||{};}catch(e){prefill={};}}
  else try{sessionStorage.removeItem("artway_prefill_product");}catch(e){}
  agentAIImportUrlStan={busy:false,data:null,selected:-1,error:""};
  const category=String(params.get("kategoria")||"").trim(),sourceUrl=String(params.get("url")||prefill._agentLinkUrl||prefill.producentUrl||prefill.sourceUrl||"").trim();
  if(/^https?:\/\//i.test(sourceUrl)){prefill.producentUrl=sourceUrl;prefill.sourceUrl=prefill.sourceUrl||sourceUrl;}
  if(category&&!prefill.kategoria)prefill.kategoria=category;
  kategoriaNowegoProduktu=category;
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Dodaj</div>
      <h1>➕ Dodaj produkt</h1>
      <div class="backend-note"><b>Jedna strona dodawania.</b> Możesz pobrać dane z linku albo wypełnić tę samą kartotekę ręcznie. Agent nie zapisuje produktu automatycznie — ostatnia decyzja zawsze należy do administratora.</div>
      ${formularzProduktu(prefill, "dodawanie")}
      <p style="font-size:.8rem;color:var(--muted2);margin-top:.7rem">Produkt trafi do wspólnej bazy dopiero po kliknięciu „Zatwierdź i dodaj produkt”. Stan magazynowy nowego produktu pozostaje równy 0, dopóki go nie zmienisz.</p>
    </div>`);
}
function widokAdminProduktyZLinku(){
  return widokAdminProduktyDodaj();
}
function widokAdminProduktEdytuj(id){
  const p = pobierzProduktAdmin(id);
  if(!p) return asortymentSzkielet("produkty", `<div class="panel"><h1>Nie znaleziono produktu</h1><p><a href="#/admin/produkty">← Wróć do produktów</a></p></div>`);
  return asortymentSzkielet("produkty", `
    <div class="panel">
      <div class="crumb"><a href="#/admin/produkty">Produkty</a> › Edycja › ${esc(p.nazwa)}</div>
      <h1>✏️ Edytuj produkt #${p.id}</h1>
      ${formularzProduktu(p, "edycja")}
    </div>`);
}
function daneProduktuZFormularza(f, id, poprzedni={}){
  const cena = parseFloat(String(f.get("cena")).replace(",","."));
  if(!(cena>0)) return null;
  const p = {
    ...poprzedni,
    id,
    nazwa:String(f.get("nazwa")).trim(),
    kategoria:String(f.get("kategoria")).trim()||"Inne",
    cena:+cena.toFixed(2),
    opisKrotki:String(f.get("opisKrotki")||"").trim(),
    opis:String(f.get("opis")||"").trim(),
    ikona:String(f.get("ikona")||"").trim()||"📦",
    kolor:poprzedni.kolor||"#dbeafe"
  };
  if(poprzedni.kategoria&&p.kategoria!==poprzedni.kategoria){
    delete p.sciezkaKategorii;delete p.grupaKategorii;delete p.kategoriaPelna;
  }
  const sc = parseFloat(String(f.get("staraCena")||"").replace(",","."));
  if(sc>cena) p.staraCena = +sc.toFixed(2); else delete p.staraCena;
  const cenaAllegro=parseFloat(String(f.get("cenaAllegro")||"").replace(",","."));
  if(cenaAllegro>0)p.cenaAllegro=+cenaAllegro.toFixed(2);else delete p.cenaAllegro;
  const cenaZakupu=parseFloat(String(f.get("cenaZakupu")||"").replace(",","."));
  if(cenaZakupu>=0&&String(f.get("cenaZakupu")||"").trim()!==""){p.cenaZakupu=+cenaZakupu.toFixed(2);p.cenaZakupuPrywatna=true;}else{for(const pole of ["cenaZakupu","cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuPrywatna","cenaZakupuZrodlo","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt"])delete p[pole];}
  if(Number.isFinite(cenaZakupu)&&Number(cenaZakupu.toFixed(2))!==Number(poprzedni.cenaZakupu)){p.cenaZakupuZrodlo="ręczna edycja administratora";p.cenaZakupuZaktualizowanoAt=new Date().toISOString();p.cenaZakupuDopasowanie="ręcznie";for(const pole of ["cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu"])delete p[pole];}
  for(const pole of ["allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){let raw=String(f.get(pole)||"").trim();if(pole==="allegroShippingSubsidy"&&raw==="")raw=String(ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI);const n=Number(raw.replace(",","."));if(raw!==""&&Number.isFinite(n)&&n>=0)p[pole]=+n.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);else if(!["vatRate"].includes(pole))delete p[pole];}
  const feeAt=String(f.get("allegroFeeCalculatedAt")||"").trim();if(feeAt)p.allegroFeeCalculatedAt=feeAt;
  const zdjecie = String(f.get("zdjecie")||"").trim();
  if(zdjecie) p.zdjecie = zdjecie; else delete p.zdjecie;
  if(f.get("badge")) p.badge = String(f.get("badge")); else delete p.badge;
  const sku = String(f.get("sku")||"").trim();
  if(sku) p.sku = sku; else delete p.sku;
  for(const [pole,nazwa] of [
    ["gtin","gtin"],["externalId","externalId"],["mpn","mpn"],["producent","producent"],["marka","marka"],["kolorProduktu","kolorProduktu"],["rozmiar","rozmiar"],["material","material"],
    ["kodProducenta","kodProducenta"],["dostepnoscProducenta","dostepnoscProducenta"],["producentUrl","producentUrl"],["sourceUrl","sourceUrl"],
    ["allegroCategoryId","allegroCategoryId"],["allegroProductId","allegroProductId"],["allegroOfferId","allegroOfferId"],["allegroCategoryPhrase","allegroCategoryPhrase"],
    ["seoTitle","seoTitle"],["seoDescription","seoDescription"],["seoKeywords","seoKeywords"],["seoMode","seoMode"]
  ]){
    const v=String(f.get(nazwa)||"").trim();
    if(v)p[pole]=v;else delete p[pole];
  }
  if(p.producentUrl)p.sourceUrl=p.producentUrl;
  const stanProd=String(f.get("stanProducenta")??"").trim();if(stanProd!=="")p.stanProducenta=Math.max(0,Math.floor(Number(stanProd)||0));else delete p.stanProducenta;
  p.stanProducentaDokladny=String(f.get("stanProducentaDokladny")||"")==="1";
  for(const pole of ["stanProducentaZrodlo","producentStatus","producentSprawdzonoAt"]){const v=String(f.get(pole)||"").trim();if(v)p[pole]=v;else delete p[pole];}
  if(p.gtin) p.ean=p.gtin; else delete p.ean;
  const canonicalProducer=allegroProducentKanoniczny(p);
  if(canonicalProducer){p.producent=canonicalProducer;if(!p.marka)p.marka=canonicalProducer;}
  const warianty = String(f.get("warianty")||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
  if(warianty.length) p.warianty = warianty; else delete p.warianty;
  const zdjecia = Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(n=>String(f.get(n)||"").trim()).filter(Boolean);
  if(zdjecia.length) p.zdjecia = zdjecia; else delete p.zdjecia;
  const allegroParameters=[];
  for(const [key,value] of f.entries()) if(String(key).startsWith("allegroParam_")&&String(value||"").trim()){
    const pid=String(key).slice("allegroParam_".length), el=document.querySelector(`[name="${key}"]`), val=String(value).trim();
    allegroParameters.push(el?.dataset?.paramType==="dictionary"?{id:pid,valuesIds:[val]}:{id:pid,values:[val]});
  }
  if(allegroParameters.length)p.allegroParameters=allegroParameters;
  const improved=agentAIPoprawOpisyDanychProduktu(p);
  return seoAutomatyzujDaneProduktu(improved,improved.seoMode==="manual"?"ręczne SEO administratora":"automatycznie po zapisie produktu",{force:improved.seoMode!=="manual"});
}
function wgrajZdjecieDoPola(input, pole){
  wgrajObrazek(input, 900, url => {
    const form = input.closest ? input.closest("form") : input.form;
    if(form && form[pole]) form[pole].value = url;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj ✅");
  });
}
async function dodajProdukt(e){
  e.preventDefault();
  const submit=e.submitter;if(submit)submit.disabled=true;
  const f = new FormData(e.target);
  let prefillMeta={};
  try{ prefillMeta=JSON.parse(sessionStorage.getItem("artway_prefill_product")||"{}")||{}; }catch(err){ prefillMeta={}; }
  const maxId = Math.max(0, ...prodBazowe.map(p=>p.id), ...produktyDodane.map(p=>p.id));
  const KOLORY = ["#dbeafe","#e0e7ff","#fef3c7","#dcfce7","#fee2e2","#f3e8ff","#fce7f3","#ffedd5"];
  const p = daneProduktuZFormularza(f, maxId+1, {kolor:KOLORY[(maxId+1)%KOLORY.length]});
  if(!p){ if(submit)submit.disabled=false;toast("⚠️ Podaj poprawną cenę"); return; }
  const kontrola=produktDodawanieAktualizuj(e.target);
  if(!kontrola?.canSubmit){
    if(submit)submit.disabled=false;
    e.target.querySelector("[data-product-add-control]")?.scrollIntoView({behavior:"smooth",block:"start"});
    toast(kontrola?.blocking?`Produkt już istnieje (#${kontrola.blocking.product.id})`:kontrola?.potential&&!kontrola.acknowledged?"Najpierw zdecyduj, czy podobna pozycja jest innym produktem":"Najpierw uzupełnij dane i zakończ kontrolę duplikatów");
    return;
  }
  const duplicates=agentAIDuplikatyProduktu(p),blockingDuplicate=duplicates.find(x=>x.blocking);
  if(blockingDuplicate){
    if(submit)submit.disabled=false;
    const box=e.target.querySelector("[data-product-link-agent-result]");
    if(box)box.innerHTML=`<div class="product-link-agent-report has-error"><header><div><span>🛡️ Ochrona katalogu</span><h3>Nie utworzono duplikatu</h3><small>${esc(blockingDuplicate.reasons.join(" • "))}</small></div><span class="lvl lvl-ostrzezenie">produkt #${esc(blockingDuplicate.product.id)}</span></header><div class="diag-actions"><button class="btn" type="button" onclick="location.hash='#/admin/produkty/edytuj/${encodeURIComponent(String(blockingDuplicate.product.id))}'">Otwórz istniejący produkt</button><button class="btn ghost" type="button" onclick="agentAIAktualizujIstniejacyZAnalizy(${jsArg(blockingDuplicate.product.id)},this)">Uzupełnij go danymi Agenta</button></div></div>`;
    toast(`Duplikat zablokowany — istnieje już produkt #${blockingDuplicate.product.id}`);return;
  }
  if(e.target.dataset.agentAdd==="1"||e.target.dataset.agentLinkSource){p.agentImportAt=new Date().toISOString();p.agentImportConfidence=Number(e.target.dataset.agentLinkConfidence||0)||0;p.agentImportSource=agentAIImportUrlStan.data?.fromCache?"pamięć Agenta":"link producenta";p.agentImportUrl=e.target.dataset.agentLinkSource||p.sourceUrl||p.producentUrl||"";}
  p.createdAt=p.createdAt||new Date().toISOString();p.createdBy=sesja?.email||"administrator";p.agentOnboardingStatus="processing";p.agentOnboardingStartedAt=new Date().toISOString();
  produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszStanZFormularza(f, p.id);
  agentAIZakonczLinkProducenta(prefillMeta._agentLinkId||prefillMeta._agentLinkUrl||p.sourceUrl||p.producentUrl,p);
  zapiszHistorieAgenta("opisy-produktow",`Agent AI sprawdził opisy po dodaniu produktu: ${p.nazwa}`,{produktId:p.id,opisKrotki:!!p.opisKrotki,opis:!!p.opis,importConfidence:p.agentImportConfidence||0,zrodlo:p.agentImportSource||"ręczne"});
  try{ sessionStorage.removeItem("artway_prefill_product"); }catch(e){}
  zbudujProdukty();
  kategoriaNowegoProduktu = "";
  loguj("info","Dodano produkt: "+p.nazwa+" ("+zl(p.cena)+")");
  toast("Produkt dodany ✅");
  toast("Produkt zapisany. Automat dobiera dane, kategorię, opisy i opłaty…");
  const onboardingResult=await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true}),onboardingProduct=pobierzProduktAdmin(Number(p.id))||p,onboardingState=agentAIStanWdrozeniaProduktu(onboardingProduct),onboardingStatus=onboardingResult?.ok&&onboardingState.ready?"completed":"needs_attention";
  zapiszPolaProduktuLokalnie(p.id,{agentOnboardingStatus:onboardingStatus,agentOnboardingCheckedAt:new Date().toISOString(),agentOnboardingCompletedAt:onboardingStatus==="completed"?new Date().toISOString():"",agentOnboardingMissing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)},false);
  zapiszHistorieAgenta("wdrozenie-produktu",`${onboardingStatus==="completed"?"Zakończono":"Rozpoczęto"} wdrożenie nowego produktu: ${p.nazwa}`,{produktId:p.id,status:onboardingStatus,missing:onboardingState.checks.filter(x=>!x.ok).map(x=>x.id)});zaplanujZapisUstawien();
  if(submit)submit.disabled=false;
  if(["/admin/produkty/dodaj","/admin/produkty/z-linku"].includes(trasa())) location.hash="#/admin/produkty"; else renderuj();
}
function zapiszStanZFormularza(f, id){
  ustawStanMagazynowy(id, String(f.get("stan")??"").trim()===""?0:f.get("stan"), {typ:"korekta",powod:"Formularz produktu"});
}
async function automatyczniePobierzDaneZrodlaProduktu(p={}){
  const url=String(p.producentUrl||p.sourceUrl||"").trim();if(!/^https?:\/\//i.test(url))return p;
  try{
    const d=await chmura("product-url-inspect",{method:"POST",body:{url},timeout:30000}),s=d.product||{},canonical=allegroProducentKanoniczny({...p,...s,sourceUrl:url,producentUrl:url});
    const missing={nazwa:s.nazwa,kategoria:s.kategoria,gtin:s.gtin||s.ean,ean:s.ean||s.gtin,externalId:s.externalId,mpn:s.mpn||s.kodProducenta,kodProducenta:s.kodProducenta||s.mpn,producent:canonical||s.producent||s.marka,marka:s.marka||canonical||s.producent,zdjecie:s.zdjecie,zdjecia:Array.isArray(s.zdjecia)?s.zdjecia.slice(0,15):[],parametryProducenta:s.parametryProducenta,parametryZrodla:s.parametryZrodla};
    zapiszPolaProduktuLokalnie(p.id,missing,true);
    const current=pobierzProduktAdmin(Number(p.id))||p,canonicalUrl=s.sourceUrl||s.producentUrl||url,force={producentUrl:canonicalUrl,sourceUrl:canonicalUrl,sourceEvidence:s.sourceEvidence||current.sourceEvidence||null,opis:s.opis||current.opis||"",opisKrotki:s.opisKrotki||current.opisKrotki||"",dostepnoscProducenta:s.dostepnoscProducenta||current.dostepnoscProducenta||"",stanProducenta:s.stanProducenta??current.stanProducenta??"",stanProducentaDokladny:s.stanProducentaDokladny===true,stanProducentaZrodlo:s.stanProducentaZrodlo||current.stanProducentaZrodlo||"",producentStatus:s.producentStatus||current.producentStatus||"",producentSprawdzonoAt:s.producentSprawdzonoAt||current.producentSprawdzonoAt||new Date().toISOString()};
    zapiszPolaProduktuLokalnie(p.id,force,false);agentAIZakonczLinkProducenta(url,pobierzProduktAdmin(Number(p.id))||p);return pobierzProduktAdmin(Number(p.id))||{...p,...missing,...force};
  }catch(e){agentAIZapiszLinkProducenta(url,"oczekuje","Automatyczne odświeżenie przy zapisie: "+(e.message||e));return p;}
}
async function allegroSynchronizujPowiazanyProduktPoZapisie(p,options={}){
  if(!p)return;
  try{
    if(!options.skipSource)p=await automatyczniePobierzDaneZrodlaProduktu(p);
    const draft=await chmura("allegro-offer-draft",{method:"POST",body:{product:p,options:{stock:allegroStanOfertyProduktu(p)}},timeout:60000});
    allegroZapiszAutoUzupelnienia(p,draft);
    let prepared={...(pobierzProduktAdmin(Number(p.id))||p),...(draft.autoFilled||{}),allegroShippingSubsidy:(pobierzProduktAdmin(Number(p.id))||p).allegroShippingSubsidy??ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI};
    const existing=allegroOfertaDlaProduktuSklepu(prepared)||draft.existingOffer?.offer||null;
    let updated=false;
    if(existing||draft.operation==="update"){
      const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:prepared,options:{stock:allegroStanOfertyProduktu(prepared),publicationAction:"keep"}},timeout:120000});
      allegroZapiszAutoUzupelnienia(prepared,d);allegroZastosujWynikWystawienia(prepared,d);allegroZapiszWynikOperacji(prepared,d);updated=true;
      prepared=pobierzProduktAdmin(Number(p.id))||prepared;
    }
    const feeReady=kwotaNum(prepared.cenaAllegro||prepared.cena)>0&&!!(prepared.allegroOfferId||existing?.id||(prepared.allegroCategoryId&&(prepared.allegroProductId||prepared.gtin||prepared.ean)));
    let feesUpdated=false;if(options.forceFees!==false&&feeReady)feesUpdated=!!(await allegroPobierzProwizjeProduktu(prepared.id,null,{silent:true}).catch(()=>null));
    await chmuraZapiszUstawienia().catch(()=>false);
    toast(updated?`✅ Produkt i oferta Allegro zaktualizowane${feesUpdated?" • prowizja odświeżona":" • prowizja wymaga ponownej próby"}`:`✅ Produkt uzupełniony: kategoria i opisy zapisane${feesUpdated?" • prowizja pobrana":""}`);
    return {ok:true,updated,feesUpdated,draft};
  }catch(e){allegroOstatniBladWystawienia=e;if(e.agentTask)await chmuraWczytajStan().catch(()=>{});toast("⚠️ Automatyka produktu przekazała brak do Agenta AI: "+(e.message||e));return {ok:false,error:e};}
}
async function zapiszProduktAdmin(e,id){
  e.preventDefault();
  const submit=e.submitter;if(submit)submit.disabled=true;
  const f = new FormData(e.target);
  const poprzedni = pobierzProduktAdmin(id);
  const p = daneProduktuZFormularza(f, id, poprzedni||{});
  if(!p){ if(submit)submit.disabled=false;toast("⚠️ Podaj poprawną cenę"); return; }
  zapiszStanZFormularza(f, id);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i] = p;
    zapiszLS("artway_produkty_dodane", produktyDodane);
  }else{
    produktyEdytowane = {...produktyEdytowane, [id]:p};
    zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  }
  zbudujProdukty(); odswiezMenu();
  zapiszHistorieAgenta("opisy-produktow",`Agent AI sprawdził opisy po edycji produktu: ${p.nazwa}`,{produktId:p.id,opisKrotki:!!p.opisKrotki,opis:!!p.opis});
  loguj("info","Zapisano zmiany produktu id="+id);
  toast("Zmiany zapisane. Automat aktualizuje dane, opis, prowizję i ofertę…");
  await allegroSynchronizujPowiazanyProduktPoZapisie(p,{forceFees:true});
  if(submit)submit.disabled=false;
  location.hash="#/admin/produkty";
}
function duplikujProdukt(id){
  const p = pobierzProduktAdmin(id); if(!p) return;
  const maxId = Math.max(0, ...prodBazowe.map(x=>x.id), ...produktyDodane.map(x=>x.id));
  const kopia = seoAutomatyzujDaneProduktu({...p,id:maxId+1,nazwa:p.nazwa+" — kopia",seoMode:"auto",seoTitle:"",seoDescription:"",seoKeywords:"",createdAt:new Date().toISOString(),createdBy:sesja?.email||"administrator",agentOnboardingStatus:"needs_attention",agentOnboardingStartedAt:new Date().toISOString(),agentOnboardingMissing:["identity"]},"automatycznie po utworzeniu kopii",{force:true});
  produktyDodane.push(kopia);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zbudujProdukty();zapiszHistorieAgenta("wdrozenie-produktu",`Nowa kopia produktu wymaga kontroli Agenta: ${kopia.nazwa}`,{produktId:kopia.id,status:"needs_attention",sourceProductId:id});zaplanujZapisUstawien();loguj("info",`Zduplikowano produkt ${id} jako ${kopia.id}`);
  toast("Utworzono kopię produktu 📄");
  location.hash="#/admin/produkty/edytuj/"+kopia.id;
}
function usunProdukt(id){
  const p = produktyDodane.find(x=>x.id===id);
  if(p){
    if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
    oznaczProduktWKoszu(id,"wlasny");
    zapiszLS("artway_kosz_dodane", koszDodanych);
  }
  produktyDodane = produktyDodane.filter(p=>p.id!==id);
  zapiszLS("artway_produkty_dodane", produktyDodane); zbudujProdukty();
  loguj("info","Przeniesiono produkt do kosza na 30 dni: id="+id); toast("Produkt w koszu przez 30 dni 🗑️"); renderuj();
}
function przywrocZKosza(id){
  const p = koszDodanych.find(x=>x.id===id);
  if(p&&!produktyDodane.some(x=>x.id===id)){ produktyDodane.push(p); zapiszLS("artway_produkty_dodane", produktyDodane); }
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony z kosza ↩️"); renderuj();
}
function usunDefinitywnie(id){
  koszDodanych = koszDodanych.filter(x=>x.id!==id);
  zapiszLS("artway_kosz_dodane", koszDodanych);
  usunMetaKosza(id);
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  loguj("info","Usunięto definitywnie produkt id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function usunDefinitywnieBazowy(id){
  if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  usunMetaKosza(id);
  delete produktyEdytowane[id];
  delete stanyProduktow[id];
  delete dostepnoscProduktow[String(id)];
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zaznaczoneProdukty.delete(id);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Usunięto definitywnie produkt bazowy id="+id);
  toast("Produkt usunięty definitywnie"); renderuj();
}
function wyczyscCalKosz(){
  const bazowe=bazoweProduktyWKoszu().map(p=>p.id);
  const ile=koszDodanych.length+bazowe.length;
  if(!ile||!confirm(`Definitywnie usunąć ${ile} produktów z kosza? Tej operacji nie można cofnąć.`)) return;
  koszDodanych.forEach(p=>{delete koszMeta[p.id];delete stanyProduktow[p.id];delete dostepnoscProduktow[String(p.id)];});
  bazowe.forEach(id=>{
    if(!produktyDefinitywne.includes(id)) produktyDefinitywne.push(id);
    delete koszMeta[id]; delete produktyEdytowane[id]; delete stanyProduktow[id]; delete dostepnoscProduktow[String(id)];
  });
  koszDodanych=[];
  produktyDefinitywne=[...new Set(produktyDefinitywne)];
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zbudujProdukty(); odswiezMenu();
  loguj("info",`Opróżniono kosz: ${ile} produktów`);
  toast("Kosz opróżniony"); renderuj();
}

/* ── Edycja ceny bezpośrednio w tabeli ── */
let katalogJakoscStan={loading:false,error:"",report:null,filter:"all",query:"",lastAction:null};
function katalogJakoscStatusLabel(status){return status==="critical"?"Wymaga naprawy":status==="warning"?"Do uzupełnienia":"Gotowy";}
function katalogJakoscStatusIcon(status){return status==="critical"?"⛔":status==="warning"?"⚠️":"✅";}
function katalogJakoscPasuje(row){
  if(katalogJakoscStan.filter!=="all"&&row.severity!==katalogJakoscStan.filter)return false;
  const q=normalizujSzukanyTekst(katalogJakoscStan.query||"");if(!q)return true;
  return normalizujSzukanyTekst([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" ")).includes(q);
}
function katalogJakoscUstawFiltr(filter){katalogJakoscStan.filter=filter||"all";renderuj();}
function katalogJakoscSzukaj(input){
  katalogJakoscStan.query=input?.value||"";
  const q=normalizujSzukanyTekst(katalogJakoscStan.query),filter=katalogJakoscStan.filter;
  document.querySelectorAll("[data-quality-row]").forEach(row=>{const matches=(!q||normalizujSzukanyTekst(row.dataset.search||"").includes(q))&&(filter==="all"||row.dataset.status===filter);row.hidden=!matches;});
  const visible=[...document.querySelectorAll("[data-quality-row]")].filter(row=>!row.hidden).length;
  const counter=document.querySelector("[data-quality-visible]");if(counter)counter.textContent=String(visible);
}
async function katalogJakoscPobierz(fixSafe=false){
  if(katalogJakoscStan.loading)return;
  katalogJakoscStan.loading=true;katalogJakoscStan.error="";renderuj();
  try{
    const result=await chmura("catalog-quality-audit",{method:"POST",body:{fixSafe,quarantineOrphans:fixSafe,source:fixSafe?"manual-safe-fix":"manual-audit"},timeout:120000});
    katalogJakoscStan.report=result.report||null;
    katalogJakoscStan.lastAction={fixed:!!fixSafe,changes:(result.changes||[]).length,quarantined:(result.quarantined||[]).length,at:result.updated_at};
    if(fixSafe&&result.saved){
      const pull=await chmura("pull",{timeout:30000});
      if(pull.settings){nalozWspolneUstawienia(pull.settings);zapiszLS("artway_chmura_rev",pull.rev||0);zbudujProdukty();odswiezMenu();}
      toast(`✅ Poprawiono ${result.changes?.length||0} kart; uporządkowano ${result.quarantined?.length||0} osieroconych zapisów`);
    }else toast("Audyt jakości katalogu zakończony ✅");
  }catch(error){katalogJakoscStan.error=error.message||String(error);loguj("blad","Audyt jakości katalogu: "+katalogJakoscStan.error);}
  finally{katalogJakoscStan.loading=false;renderuj();}
}
function katalogJakoscEksportCSV(){
  const report=katalogJakoscStan.report;if(!report?.rows?.length){toast("Najpierw uruchom audyt");return;}
  const rows=[["ID","Nazwa","Ocena","Status","Problemy","EAN","Kod","Producent","Kategoria","Źródło"],...report.rows.map(row=>[row.id,row.name,row.score,katalogJakoscStatusLabel(row.severity),(row.issues||[]).map(x=>x.label).join(" | "),row.ean,row.externalId,row.manufacturer,row.category,row.sourceUrl])];
  pobierzPlik(`audyt-katalogu-${new Date().toISOString().slice(0,10)}.csv`,"\uFEFF"+rows.map(row=>row.map(csvPole).join(";")).join("\n"),"text/csv");
}
function widokAdminJakoscKatalogu(){
  const report=katalogJakoscStan.report,summary=report?.summary||{total:0,ready:0,warning:0,critical:0,averageScore:0,duplicateGroups:0,orphanEdits:0,safeFixes:0};
  if(!report&&!katalogJakoscStan.loading&&!katalogJakoscStan.error)setTimeout(()=>katalogJakoscPobierz(false),0);
  const rows=(report?.rows||[]).filter(katalogJakoscPasuje),action=katalogJakoscStan.lastAction;
  return asortymentSzkielet("jakosc",`<div class="panel catalog-quality-page">
    <header class="catalog-quality-hero"><div><span class="order-pro-label">Stała kontrola danych sprzedażowych</span><h1>🧪 Jakość katalogu</h1><p>Jedna kontrola dla sklepu, Allegro, Google, SEO i Agenta AI. System wykrywa braki, nieprawidłowe identyfikatory, duplikaty, powtarzające się opisy oraz osierocone dane synchronizacji.</p><small>Automatyczny audyt działa codziennie. Bezpieczna korekta porządkuje wyłącznie dane wynikające z istniejących pól — nigdy nie wymyśla ceny, EAN-u ani informacji o produkcie.</small></div><div class="catalog-quality-actions"><button class="btn ghost" onclick="katalogJakoscPobierz(false)" ${katalogJakoscStan.loading?"disabled":""}>↻ Uruchom audyt</button><button class="btn" onclick="katalogJakoscPobierz(true)" ${katalogJakoscStan.loading||!report?"disabled":""}>✨ Zastosuj bezpieczne poprawki</button><button class="btn ghost" onclick="katalogJakoscEksportCSV()" ${report?"":"disabled"}>⇩ Raport CSV</button></div></header>
    ${katalogJakoscStan.loading?`<div class="catalog-quality-progress" role="status"><span class="spinner"></span><div><b>${report?"Aktualizuję kontrolę katalogu…":"Analizuję wszystkie aktywne produkty…"}</b><small>Sprawdzam dane identyfikacyjne, opisy, zdjęcia, źródła, SEO i powiązania.</small></div></div>`:""}
    ${katalogJakoscStan.error?`<div class="form-err" role="alert"><b>Audyt nie został wykonany.</b><br>${esc(katalogJakoscStan.error)} <button class="btn ghost" onclick="katalogJakoscPobierz(false)">Spróbuj ponownie</button></div>`:""}
    ${action?`<div class="catalog-quality-last ${action.fixed?"fixed":""}"><b>${action.fixed?"✅ Zakończono bezpieczne porządkowanie":"✅ Audyt zakończony"}</b><span>${action.fixed?`Zmieniono ${action.changes} kart i odseparowano ${action.quarantined} osieroconych zapisów.`:`Wynik zapisano ${new Date(action.at||Date.now()).toLocaleString("pl-PL")}.`}</span></div>`:""}
    <div class="orders-stat-grid catalog-quality-stats">
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="all"?"active":""}" onclick="katalogJakoscUstawFiltr('all')"><span>📚</span><b>${summary.total}</b><small>aktywnych produktów</small></button>
      <button class="order-stat-card stat-filter ${summary.critical?"hot":""} ${katalogJakoscStan.filter==="critical"?"active":""}" onclick="katalogJakoscUstawFiltr('critical')"><span>⛔</span><b>${summary.critical}</b><small>wymaga naprawy</small></button>
      <button class="order-stat-card stat-filter ${katalogJakoscStan.filter==="warning"?"active":""}" onclick="katalogJakoscUstawFiltr('warning')"><span>⚠️</span><b>${summary.warning}</b><small>do uzupełnienia</small></button>
      <button class="order-stat-card stat-filter money ${katalogJakoscStan.filter==="ready"?"active":""}" onclick="katalogJakoscUstawFiltr('ready')"><span>✅</span><b>${summary.ready}</b><small>gotowych kart</small></button>
      <div class="order-stat-card"><span>🎯</span><b>${summary.averageScore}%</b><small>średnia jakość</small></div>
    </div>
    ${summary.orphanEdits?`<div class="catalog-quality-warning"><div><b>🧹 ${summary.orphanEdits} osierocone ${summary.orphanEdits===1?"dane edycji":"zapisy edycji"}</b><span>Nie są produktami i nie trafią już do sitemap, Google, SEO, monitoringu ani zadań Agenta. „Bezpieczne poprawki” przeniosą ich kopię do prywatnego archiwum audytu i usuną z katalogu roboczego.</span></div></div>`:""}
    ${summary.duplicateGroups?`<div class="catalog-quality-warning"><div><b>🧬 ${summary.duplicateGroups} grup potencjalnych duplikatów</b><span>System niczego nie usuwa automatycznie. Otwórz kartę produktu i zdecyduj, która pozycja ma pozostać.</span></div><a class="btn ghost" href="#/admin/asortyment/produkty" onclick="filtrStatusuProduktow='duplikaty'">Sprawdź duplikaty</a></div>`:""}
    ${report?`<section class="catalog-quality-toolbar"><label><span>Szukaj w raporcie</span><input placeholder="Nazwa, ID, EAN, kod, producent, kategoria lub problem…" value="${esc(katalogJakoscStan.query)}" oninput="katalogJakoscSzukaj(this)" autocomplete="off"></label><span>Widoczne: <b data-quality-visible>${rows.length}</b> z ${summary.total}</span><span>Możliwe bezpieczne poprawki: <b>${summary.safeFixes}</b></span></section>
    <div class="catalog-quality-table-wrap"><table class="log-table catalog-quality-table"><thead><tr><th>Produkt</th><th>Identyfikatory</th><th>Jakość</th><th>Wykryte problemy</th><th>Źródło</th><th>Akcje</th></tr></thead><tbody>${rows.map(row=>`<tr data-quality-row data-status="${esc(row.severity)}" data-search="${esc([row.id,row.name,row.externalId,row.ean,row.manufacturer,row.category,...(row.issues||[]).map(x=>x.label)].join(" "))}"><td><div class="catalog-quality-product">${row.image?`<img src="${esc(row.image)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'📦'}))">`:`<span>📦</span>`}<div><b>${esc(row.name)}</b><small>ID ${esc(row.id)} • ${esc(row.category||"bez kategorii")}</small><em>${esc(row.manufacturer||"producent nieuzupełniony")}</em></div></div></td><td><small>EAN/GTIN</small><b>${esc(row.ean||"—")}</b><small>Kod / EXTERNAL_ID</small><b>${esc(row.externalId||"—")}</b></td><td><div class="catalog-quality-score ${esc(row.severity)}"><b>${row.score}%</b><span>${katalogJakoscStatusIcon(row.severity)} ${katalogJakoscStatusLabel(row.severity)}</span></div></td><td><div class="catalog-quality-issues">${(row.issues||[]).map(issue=>`<span class="${esc(issue.severity)}">${esc(issue.label)}</span>`).join("")||`<span class="ready">Komplet podstawowych danych</span>`}${Object.keys(row.safePatch||{}).length?`<small>✨ Bezpieczna korekta: ${Object.keys(row.safePatch).map(field=>esc(field)).join(", ")}</small>`:""}</div></td><td>${row.sourceUrl?`<a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">Otwórz źródło ↗</a>`:"<span class='muted'>Brak linku</span>"}${row.allegroOfferId?`<a href="https://allegro.pl/oferta/${encodeURIComponent(row.allegroOfferId)}" target="_blank" rel="noopener">Oferta Allegro ↗</a>`:""}</td><td><a class="btn ghost" href="#/admin/produkty/edytuj/${encodeURIComponent(row.id)}">✏️ Uzupełnij</a></td></tr>`).join("")||`<tr><td colspan="6">Brak produktów w wybranym filtrze.</td></tr>`}</tbody></table></div>`:`<div class="backend-note">Raport pojawi się po zakończeniu analizy.</div>`}
    <div class="catalog-quality-rules"><h2>Co system poprawia sam, a czego nie zgaduje</h2><div><article><b>✅ Automatycznie i bezpiecznie</b><p>Porządkuje spacje i linki, uzupełnia zgodne pola EAN/GTIN, usuwa identyczne powtórzenia akapitów, tworzy krótki opis z istniejącego opisu, uzupełnia SEO oraz producenta tylko z jednoznacznego źródła.</p></article><article><b>🔒 Zawsze wymaga faktów</b><p>Cena, kod EAN, zdjęcia, kategoria, parametry, dostępność i brakujący pełny opis nie są wymyślane. Trafiają do raportu oraz zadań Agenta do sprawdzenia w źródle producenta.</p></article></div></div>
  </div>`);
}

function ustawCene(id, wartosc){
  const cena = parseFloat(String(wartosc).replace(",","."));
  if(!(cena>0)){ toast("⚠️ Nieprawidłowa cena"); renderuj(); return; }
  const nowa = +cena.toFixed(2);
  const i = produktyDodane.findIndex(x=>x.id===id);
  if(i>=0){
    produktyDodane[i].cena = nowa;
    if(produktyDodane[i].staraCena && produktyDodane[i].staraCena<=nowa) delete produktyDodane[i].staraCena;
    zapiszLS("artway_produkty_dodane", produktyDodane);
  }else{
    const baza = pobierzProduktAdmin(id) || {};
    const edycja = {...(produktyEdytowane[id]||{}), cena:nowa};
    if(baza.staraCena && baza.staraCena<=nowa) edycja.staraCena = undefined;
    produktyEdytowane = {...produktyEdytowane, [id]:edycja};
    zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  }
  zbudujProdukty();
  loguj("info",`Zmieniono cenę produktu ${id} → ${zl(nowa)}`);
  toast("Cena zapisana ✅"); renderuj();
}
/* ── Akcje masowe na produktach ── */
let zaznaczoneProdukty = new Set();
function przelaczZaznProd(id){ zaznaczoneProdukty.has(id) ? zaznaczoneProdukty.delete(id) : zaznaczoneProdukty.add(id); }
function zaznaczWidoczneProd(chk, ids){
  ids.forEach(id => chk.checked ? zaznaczoneProdukty.add(id) : zaznaczoneProdukty.delete(id));
  renderuj();
}
function usunZaznaczoneProd(){
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!confirm(`Usunąć ${zaznaczoneProdukty.size} zaznaczonych produktów?`)) return;
  for(const id of [...zaznaczoneProdukty]){
    const p = produktyDodane.find(x=>x.id===id);
    if(p){
      if(!koszDodanych.some(x=>x.id===id)) koszDodanych.push(p);
      produktyDodane = produktyDodane.filter(x=>x.id!==id);
      oznaczProduktWKoszu(id,"wlasny");
    }else if(!produktyDefinitywne.includes(id)){
      if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
      oznaczProduktWKoszu(id,"bazowy");
    }
  }
  zapiszLS("artway_kosz_dodane", koszDodanych);
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  loguj("info",`Masowo usunięto ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); odswiezMenu(); toast("Usunięto zaznaczone 🗑️"); renderuj();
}
function zmienCenyZaznaczonych(){
  const wartosc = parseFloat(String($("procentCen")?.value||"").replace(",","."));
  const tryb=String($("trybCenProduktow")?.value||"percent");
  if(!zaznaczoneProdukty.size){ toast("Zaznacz produkty"); return; }
  if(!Number.isFinite(wartosc)||wartosc===0){ toast("⚠️ Podaj wartość zmiany, np. 10 lub -5"); return; }
  if(tryb==="percent"&&wartosc<=-100){ toast("⚠️ Obniżka procentowa musi być większa niż -100%"); return; }
  if(tryb==="fixed"&&wartosc<=0){ toast("⚠️ Cena docelowa musi być większa od zera"); return; }
  for(const id of [...zaznaczoneProdukty]){
    const p = pobierzProduktAdmin(id); if(!p) continue;
    const nowa = Math.max(0.01, +(tryb==="percent"?p.cena*(1+wartosc/100):tryb==="amount"?p.cena+wartosc:wartosc).toFixed(2));
    const i = produktyDodane.findIndex(x=>x.id===id);
    if(i>=0){ produktyDodane[i].cena = nowa; if(produktyDodane[i].staraCena && produktyDodane[i].staraCena<=nowa) delete produktyDodane[i].staraCena; }
    else produktyEdytowane = {...produktyEdytowane, [id]:{...(produktyEdytowane[id]||{}), cena:nowa}};
  }
  zapiszLS("artway_produkty_dodane", produktyDodane);
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  const opis=tryb==="percent"?`${wartosc>0?"+":""}${wartosc}%`:tryb==="amount"?`${wartosc>0?"+":""}${zl(wartosc)}`:`na ${zl(wartosc)}`;
  loguj("info",`Masowa zmiana cen ${opis} dla ${zaznaczoneProdukty.size} produktów`);
  zaznaczoneProdukty.clear();
  zbudujProdukty(); toast(`Ceny zmienione ${opis} ✅`); renderuj();
}
function usunProduktAdmin(id){
  if(produktyDodane.some(p=>p.id===id)){
    usunProdukt(id);
    return;
  }
  if(!produktyUkryte.includes(id)) produktyUkryte.push(id);
  oznaczProduktWKoszu(id,"bazowy");
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  zbudujProdukty(); odswiezMenu();
  loguj("info","Przeniesiono do kosza na 30 dni produkt bazowy id="+id);
  toast("Produkt w koszu przez 30 dni 🗑️");
  renderuj();
}
function przywrocProdukt(id){
  if(produktyDefinitywne.includes(id)){ toast("Ten produkt został już usunięty definitywnie"); return; }
  produktyUkryte = produktyUkryte.filter(x=>x!==id);
  zapiszLS("artway_produkty_ukryte", produktyUkryte);
  usunMetaKosza(id);
  zbudujProdukty(); odswiezMenu();
  toast("Produkt przywrócony ↩️"); renderuj();
}
function resetujEdycjeProduktu(id){
  delete produktyEdytowane[id];
  zapiszLS("artway_produkty_edytowane", produktyEdytowane);
  zbudujProdukty(); odswiezMenu();
  toast("Przywrócono dane z products.json");
  location.hash="#/admin/produkty";
}
function przelaczWidocznosc(id){
  produktyUkryte = produktyUkryte.includes(id) ? produktyUkryte.filter(x=>x!==id) : [...produktyUkryte, id];
  zapiszLS("artway_produkty_ukryte", produktyUkryte); zbudujProdukty();
  toast(produktyUkryte.includes(id)?"Produkt ukryty 🙈":"Produkt widoczny 👁️"); renderuj();
}

/* ── Eksporty (CSV dla Excela, JSON dla hostingu) ── */
function pobierzPlik(nazwa, tresc, typ){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([tresc], {type:(typ||"text/plain")+";charset=utf-8"}));
  a.download = nazwa; a.click(); URL.revokeObjectURL(a.href);
}
function osadzUstawieniaWIndexie(html){
  const bezpieczne=JSON.stringify(ustawienia,null,2).replace(/</g,"\\u003c");
  const blok=`/* PUBLIC_SETTINGS_START */\nconst USTAWIENIA_PUBLICZNE = ${bezpieczne};\n/* PUBLIC_SETTINGS_END */`;
  const wzor=/\/\* PUBLIC_SETTINGS_START \*\/[\s\S]*?\/\* PUBLIC_SETTINGS_END \*\//;
  if(!wzor.test(html))throw new Error("Nie znaleziono znacznika ustawień w index.html");
  return html.replace(wzor,blok);
}
async function eksportujIndexHTML(){
  try{
    const r=await fetch("/index.html",{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);
    const html=osadzUstawieniaWIndexie(await r.text());
    pobierzPlik("index.html",html,"text/html");
    localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    loguj("info","Wyeksportowano index.html z publicznymi ustawieniami panelu");
    toast("Pobrano index.html — wgraj go na hosting ✅");
  }catch(e){loguj("blad","Eksport index.html: "+e.message);toast("⚠️ Nie udało się przygotować index.html");}
}
const csvPole = v => '"' + String(v??"").replace(/"/g,'""') + '"';
function eksportujZamowienia(){
  const z = pobierzZamowienia();
  const csv = [["nr","data","status","klient","produkty_zl","rabat_zl","dostawa_zl","paczka_weekend_zl","platnosc_oplata_zl","razem_zl","dostawa","platnosc","adres","pozycje"].join(";"),
    ...z.map(x=>{const k=kosztyZamowienia(x); return [x.nr,x.data,x.status,x.email||"gość",k.produkty,k.rabat,k.dostawa,k.paczkaWeekend,k.platnosc,k.razem,x.dostawa||"",x.platnosc||"",x.adres||"",(x.pozycje||[]).join(" | ")].map(v=>typeof v==="number"?String(v.toFixed(2)).replace(".",","):v).map(csvPole).join(";");})].join("\n");
  pobierzPlik("zamowienia.csv","﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano zamówienia ("+z.length+")");
}
function eksportujKlientow(){
  const k = pobierzUzytkownikow();
  const csv = [["imie_nazwisko","email","rola","data_rejestracji"].join(";"),
    ...k.map(x=>[x.imie,x.email,kontoMaRoleAdmin(x.email)?"administrator":"klient",new Date(x.data).toLocaleDateString("pl-PL")].map(csvPole).join(";"))].join("\n");
  pobierzPlik("klienci.csv","﻿"+csv,"text/csv");
  loguj("info","Wyeksportowano klientów ("+k.length+")");
}
// InPost „nadanie z pliku": eksport zamówień do CSV/TXT do wgrania w InPost Managerze
// (manager.paczkomaty.pl → Wyślij przesyłki → IMPORT Z PLIKU). Działa dla paczkomatu i kuriera —
// obejście/awaryjne nadawanie do czasu umowy kurierskiej. Format zgodny ze wzorem InPost.
let zaznaczoneNadania = new Set();
function przelaczZaznaczenieNadania(nr){ nr=String(nr); if(zaznaczoneNadania.has(nr)) zaznaczoneNadania.delete(nr); else zaznaczoneNadania.add(nr); renderuj(); }
function zaznaczWszystkieNadania(zazn){ listaWysylekPoFiltrze().forEach(z=>zazn?zaznaczoneNadania.add(String(z.nr)):zaznaczoneNadania.delete(String(z.nr))); renderuj(); }
// czy zamówienie idzie do paczkomatu (InPost)
function paczkomatoweInpost(z){ const id=String(z?.dostawaId||"").toLowerCase(); if(id==="kurier"||id==="kurier_inpost") return false; if(id==="paczkomat") return true; return !!(z?.paczkomat||z?.wysylka?.punktKod); }
// czy zlecenie ma komplet danych do nadania w InPost (żeby import z pliku nie odrzucił)
function gotoweDoNadaniaInpost(z){
  const k=z.klient||{}, a=z.adresDostawy||{};
  if(String(z?.dostawaId||"").toLowerCase()==="odbior") return {ok:false, powod:"odbiór osobisty"};
  const tel=String(k.telefon||z.telefon||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"");
  if(!/@/.test(String(z.email||k.email||""))) return {ok:false, powod:"brak e-mail"};
  if(tel.length<9) return {ok:false, powod:"brak/zły telefon"};
  if(paczkomatoweInpost(z)){ if(!(z.paczkomat||z.wysylka?.punktKod)) return {ok:false, powod:"brak paczkomatu"}; }
  else { if(!a.ulica||!a.nrDomu) return {ok:false, powod:"brak adresu"}; if(!/^\d{2}-\d{3}$/.test(String(a.kod||""))) return {ok:false, powod:"zły kod pocztowy"}; if(!a.miasto) return {ok:false, powod:"brak miasta"}; }
  return {ok:true, paczk:paczkomatoweInpost(z)};
}
function zaznaczGotoweNadania(){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(gotoweDoNadaniaInpost(z).ok){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(n?`Zaznaczono ${n} gotowych do nadania`:"Brak gotowych zleceń w tym filtrze"); renderuj(); }
function zaznaczTypNadania(typ){ let n=0; listaWysylekPoFiltrze().forEach(z=>{ if(String(z?.dostawaId||"").toLowerCase()==="odbior") return; const p=paczkomatoweInpost(z); if((typ==="paczkomat"&&p)||(typ==="kurier"&&!p)){ zaznaczoneNadania.add(String(z.nr)); n++; } }); toast(`Zaznaczono ${n} (${typ})`); renderuj(); }
// nry (opcjonalnie) = tablica numerów zamówień do eksportu (pojedyncze zlecenie / zaznaczone). Bez nry: zaznaczone albo cały filtr.
function eksportNadaniaInpostCSV(nry, format="txt"){
  const tryb=String(format||"txt").toLowerCase();
  const rozszerzony=tryb==="extended"||tryb==="rozszerzony";
  const kolumnowy=tryb==="csv"||tryb==="kolumny"||tryb==="columns";
  const tabulator=tryb==="tab"||tryb==="tsv"||tryb==="inpost";
  const sep=tabulator ? "\t" : (kolumnowy ? "," : ";");
  const ext=kolumnowy||rozszerzony ? "csv" : "txt";
  const mime=ext==="csv" ? "text/csv" : "text/plain";
  const czysc = v => String(v==null?"":v).replace(/[\t;\r\n]+/g," ").replace(/\s+/g," ").trim();
  const telCyfry = t => String(t||"").replace(/\D/g,"").replace(/^0+/,"").replace(/^48/,"").slice(-9);
  const telInpost = t => { const d=telCyfry(t); return d.length===9 ? "+48"+d : ""; };
  const kwota = v => { const n=Number(String(v??"").replace(",",".").replace(/[^0-9.]/g,"")); return Number.isFinite(n)&&n>0 ? n.toFixed(2) : ""; };
  const rozmiarInpost = z => { const g=String(z?.wysylka?.gabaryt||"").toLowerCase(); return g==="large"?"C":g==="medium"?"B":"A"; };
  const pole = v => {
    const s=czysc(v);
    return kolumnowy ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const jawne = Array.isArray(nry) && nry.length;
  let bazaZ;
  if(jawne){ const zb=new Set(nry.map(String)); bazaZ = pobierzZamowienia().filter(z=>zb.has(String(z.nr))); }
  else if(zaznaczoneNadania.size){ bazaZ = pobierzZamowienia().filter(z=>zaznaczoneNadania.has(String(z.nr))); }
  else { bazaZ = listaWysylekPoFiltrze(); }
  const lista = bazaZ.filter(z=>{
    if(String(z?.dostawaId||"").toLowerCase()==="odbior") return false;
    if(!jawne && ["dostarczona","anulowana","zwrot"].includes(etapWysylki(z))) return false;
    return true;
  }).slice(0,100);
  if(!lista.length){ toast("Brak zamówień do nadania (sprawdź zaznaczenie lub filtr)"); return; }
  const polaPodstawowe=["e-mail","telefon","rozmiar","paczkomat","numer_referencyjny","dodatkowa_ochrona","za_pobraniem","imie_i_nazwisko","nazwa_firmy","ulica","kod_pocztowy","miasto","typ_przesylki","sposob_nadania","punkt_nadania","paczka_w_weekend"];
  const polaRozszerzone=["uwagi","produkty","kwota_zamowienia","metoda_platnosci","sposob_dostawy","gabaryt_sklepu","waga_kg","dlugosc_cm","szerokosc_cm","wysokosc_cm","telefon_9_cyfr"];
  const pola=rozszerzony?[...polaPodstawowe,...polaRozszerzone]:polaPodstawowe;
  const wiersze=lista.map(z=>{
    const k=z.klient||{}, a=z.adresDostawy||{}, w=z.wysylka||{};
    const paczk=paczkomatoweInpost(z);
    const ulica = czysc(`${a.ulica||""} ${a.nrDomu||""}${a.nrLokalu?"/"+a.nrLokalu:""}`.trim());
    const pobranie = kwota(kwotaPobraniaZamowienia(z,w));
    const ochrona = kwota(w.ochrona || "");
    const sposob=inpostSposobNadania(z,w);
    const punktNadania=String(w.punktNadania||INPOST_DOMYSLNY_PUNKT_NADANIA).trim().toUpperCase();
    const produktyTxt = Array.isArray(z.pozycjeDane)&&z.pozycjeDane.length
      ? z.pozycjeDane.map(p=>`${p.nazwa||""}${p.sku?` SKU:${p.sku}`:""} x${p.ilosc||1}`).join(" | ")
      : (Array.isArray(z.pozycje)?z.pozycje.join(" | "):"");
    const podstawowe=[
      z.email||k.email,
      telInpost(k.telefon||z.telefon),
      rozmiarInpost(z),
      paczk ? String(z.paczkomat||w.punktKod||"").toUpperCase() : "",
      z.nr,
      ochrona,
      pobranie,
      [k.imie,k.nazwisko].filter(Boolean).join(" "),
      k.firma,
      ulica,
      a.kod,
      a.miasto,
      paczk ? "paczkomat" : "kurier",
      inpostSposobNadaniaLabel(sposob),
      punktNadania,
      (w.paczkaWeekend || z.paczkaWeekend) ? "TAK" : "NIE"
    ];
    const extra=[
      z.uwagi,
      produktyTxt,
      kwota(z.razem),
      z.platnosc,
      z.dostawa,
      w.gabaryt||"small",
      w.waga,
      w.dlugosc,
      w.szerokosc,
      w.wysokosc,
      telCyfry(k.telefon||z.telefon)
    ];
    return (rozszerzony?[...podstawowe,...extra]:podstawowe).map(pole).join(sep);
  });
  const tresc=[pola.map(pole).join(sep),...wiersze].join("\r\n");
  const nazwaTrybu=rozszerzony?"rozszerzony":(tabulator?"naglowki-tabulator":(kolumnowy?"naglowki":tryb));
  pobierzPlik(`inpost-nadania-${nazwaTrybu}-${new Date().toISOString().slice(0,10)}.${ext}`, tresc, mime);
  const npaczk=lista.filter(z=>paczkomatoweInpost(z)).length, nbrak=lista.filter(z=>!gotoweDoNadaniaInpost(z).ok).length;
  loguj("info",`Eksport nadań InPost ${nazwaTrybu}: ${lista.length} przesyłek (${npaczk} paczkomat, ${lista.length-npaczk} kurier)`);
  toast(tabulator
    ? `📄 TXT InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK, separator Tabulator${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
    : (kolumnowy
      ? `📄 CSV InPost: ${lista.length} przesyłek — w InPost ustaw nagłówki TAK i separator przecinek${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`
      : `📄 Plik InPost ${nazwaTrybu.toUpperCase()}: ${lista.length} przesyłek — dla TXT ustaw w InPost separator średnik${nbrak?` • ⚠️ ${nbrak} z brakami danych`:""}`));
}
let podgladImportuProduktow=null, ostatniRaportImportu=null;
const POLA_CSV_PRODUKTU=["id","nazwa","kategoria","cena","cena_allegro","cena_zakupu","prowizja_allegro","prowizja_allegro_procent","oplaty_allegro_cykliczne","koszt_pakowania","koszt_dodatkowy_sklepu","platnosc_sklepu_procent","koszt_dodatkowy_allegro","doplata_wysylki_allegro","reklama_allegro_procent","vat","stara_cena","stan","sku","gtin","external_id","mpn","marka","producent","opis_krotki","opis","badge","ikona","zdjecie","zdjecie2","zdjecie3","zdjecie4","zdjecie5","zdjecie6","zdjecie7","zdjecie8","zdjecie9","zdjecie10","zdjecie11","zdjecie12","zdjecie13","zdjecie14","zdjecie15","zdjecie16","warianty","kolor","kolor_produktu","rozmiar","material"];
const POLA_OVF_PRODUKTU=["GTIN","EXTERNAL_ID","NAME","STOCK","PRICE","MPN","DESCRIPTION","IMAGE1","IMAGE2","IMAGE3","IMAGE4","IMAGE5","IMAGE6","IMAGE7","IMAGE8","IMAGE9","IMAGE10","IMAGE11","IMAGE12","IMAGE13","IMAGE14","IMAGE15","IMAGE16","CATEGORY","BRAND","MANUFACTURER","COLOR","SIZE","MATERIAL"];
function normalizujNaglowekCSV(v){
  return normalizujSzukanyTekst(v).replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}
function kanonicznePoleProduktu(naglowek){
  const h=normalizujNaglowekCSV(naglowek);
  const aliasy={
    id:["id","product_id","produkt_id","item_id","id_produktu"],
    nazwa:["nazwa","name","product_name","nazwa_produktu","tytul","title","product_title"],
    kategoria:["kategoria","category","katalog","catalog","category_path","categorypath","breadcrumb","category_tree","category_name","categories","sciezka_kategorii"],
    cena:["cena","price","cena_zl","sale_price","gross_price","net_price","price_gross","price_net","retail_price"],
    cenaAllegro:["cena_allegro","allegro_price","price_allegro"],
    cenaZakupu:["cena_zakupu","purchase_price","cost_price","buy_price"],
    allegroCommissionAmount:["prowizja_allegro","allegro_commission","commission_amount"],
    allegroCommissionRate:["prowizja_allegro_procent","allegro_commission_rate","commission_rate"],
    allegroRecurringFees:["oplaty_allegro_cykliczne","allegro_recurring_fees","listing_fees"],
    kosztPakowania:["koszt_pakowania","packaging_cost"],
    sklepAdditionalCost:["koszt_dodatkowy_sklepu","store_additional_cost"],
    sklepPaymentPercent:["platnosc_sklepu_procent","store_payment_percent"],
    allegroAdditionalCost:["koszt_dodatkowy_allegro","allegro_additional_cost"],
    allegroShippingSubsidy:["doplata_wysylki_allegro","allegro_shipping_subsidy"],
    allegroAdsPercent:["reklama_allegro_procent","allegro_ads_percent"],
    vatRate:["vat","vat_rate","stawka_vat"],
    staraCena:["stara_cena","old_price","regular_price","cena_regularna","oldprice","rrp","msrp"],
    stan:["stan","stock","quantity","ilosc","stan_magazynowy","available","availability","qty"],
    sku:["sku","kod","kod_produktu","symbol","seller_sku","item_sku","offer_sku","symbol_produktu"],
    gtin:["gtin","ean","ean13","barcode","kod_ean"],
    externalId:["external_id","externalid","kod_zewnetrzny","supplier_id","vendor_id","ext_id","supplier_sku"],
    mpn:["mpn","manufacturer_part_number","kod_producenta"],
    marka:["brand","marka","brand_name"],
    producent:["producent","manufacturer","manufacturer_name","producer","producer_name"],
    opisKrotki:["opis_krotki","krotki_opis","krótki_opis","short_description","short_desc","description_short","summary","lead"],
    opis:["opis","description","desc","long_description","description_html","full_description"],
    badge:["badge","etykieta","label"],
    ikona:["ikona","icon","emoji"],
    zdjecie:["zdjecie","image","image1","image_1","image_url","url_zdjecia","main_image","image_url_1","photo","photo1","picture","picture1"],
    warianty:["warianty","variants","options"],
    kolor:["kolor","kolor_tla","background","background_color","card_color"],
    kolorProduktu:["color","kolor_produktu","product_color","barwa"],
    rozmiar:["size","rozmiar","wymiar","wymiary","dimensions"],
    material:["material","material_produktu","tworzywo"]
  };
  for(let i=2;i<=16;i++) aliasy["zdjecie"+i]=["zdjecie"+i,"image"+i,"image_"+i,"image"+String(i).padStart(2,"0"),String("image_"+String(i).padStart(2,"0")),"image_url_"+i,"photo"+i,"picture"+i,"url_zdjecia"+i];
  return Object.keys(aliasy).find(k=>aliasy[k].includes(h))||null;
}
function liczbaImportu(v){
  let s=String(v??"").trim().replace(/\s/g,"").replace(/[^\d,.\-]/g,"");
  if(!s)return null;
  if(s.includes(",")&&s.includes(".")){
    if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
    else s=s.replace(/,/g,"");
  }else s=s.replace(",",".");
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function wykryjSeparatorCSV(tekst){
  const probka=String(tekst||"").split(/\r?\n/).slice(0,5).join("\n");
  const liczniki={";":0,",":0,"\t":0};let cytat=false;
  for(let i=0;i<probka.length;i++){
    if(probka[i]==='"'&&probka[i+1]==='"'){i++;continue;}
    if(probka[i]==='"'){cytat=!cytat;continue;}
    if(!cytat&&Object.prototype.hasOwnProperty.call(liczniki,probka[i]))liczniki[probka[i]]++;
  }
  return Object.entries(liczniki).sort((a,b)=>b[1]-a[1])[0][0];
}
function parsujCSVProduktow(tekst){
  tekst=String(tekst||"").replace(/^\uFEFF/,"");
  const sep=wykryjSeparatorCSV(tekst),wiersze=[];let wiersz=[],pole="",cytat=false;
  for(let i=0;i<tekst.length;i++){
    const c=tekst[i];
    if(c==='"'&&cytat&&tekst[i+1]==='"'){pole+='"';i++;continue;}
    if(c==='"'){cytat=!cytat;continue;}
    if(c===sep&&!cytat){wiersz.push(pole);pole="";continue;}
    if((c==="\n"||c==="\r")&&!cytat){
      if(c==="\r"&&tekst[i+1]==="\n")i++;
      wiersz.push(pole);pole="";
      if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
      wiersz=[];continue;
    }
    pole+=c;
  }
  wiersz.push(pole);if(wiersz.some(x=>String(x).trim()!==""))wiersze.push(wiersz);
  if(wiersze.length<2)throw new Error("CSV nie zawiera wierszy produktów");
  const naglowki=wiersze.shift().map(kanonicznePoleProduktu);
  if(!naglowki.includes("nazwa")||!naglowki.includes("cena"))throw new Error("CSV musi zawierać co najmniej kolumny: nazwa i cena");
  return wiersze.map(r=>{const o={};naglowki.forEach((k,i)=>{if(k)o[k]=r[i]??"";});return o;});
}
function tablicaWartosci(v){
  if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);
  return String(v||"").split(/\s*[|,]\s*/).map(x=>x.trim()).filter(Boolean);
}
function czyKolorKarty(v){
  const s=String(v||"").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)||/^rgba?\(/i.test(s)||/^hsla?\(/i.test(s);
}
function rozbijSciezkeKategoriiImportu(v){
  const tekst=String(v||"").trim();
  if(!tekst)return {pelna:"",grupa:"",kategoria:"",poziomy:[]};
  const czesci=tekst.split(/\s*(?:\/|\\|>|»|›|\||::)\s*/).map(x=>x.trim()).filter(Boolean);
  if(czesci.length<=1)return {pelna:tekst,grupa:"",kategoria:tekst,poziomy:[tekst]};
  return {pelna:tekst,grupa:czesci.slice(0,-1).join(" / "),kategoria:czesci.at(-1),poziomy:czesci};
}
function normalizujProduktImportu(r,nr){
  const pobierz=(...nazwy)=>{for(const n of nazwy)if(r?.[n]!==undefined&&r[n]!==null)return r[n];return "";};
  const bledy=[],ostrzezenia=[];
  const nazwa=String(pobierz("nazwa","name","product_name")).trim();
  const kategoriaInfo=rozbijSciezkeKategoriiImportu(pobierz("kategoria","category","katalog"));
  const kategoria=kategoriaInfo.kategoria;
  const cena=liczbaImportu(pobierz("cena","price","sale_price"));
  const idRaw=pobierz("id","product_id"),id=idRaw===""||idRaw===null?null:Number(idRaw);
  if(!nazwa)bledy.push("brak nazwy");
  if(!kategoria)bledy.push("brak kategorii");
  if(cena===null||cena<0)bledy.push("cena musi być liczbą 0 lub większą");
  if(cena===0)ostrzezenia.push("cena 0,00 — produkt zostanie zaimportowany, ale będzie zablokowany do sprzedaży do czasu uzupełnienia ceny");
  if(id!==null&&(!Number.isInteger(id)||id<=0))bledy.push("ID musi być dodatnią liczbą całkowitą");
  const stanRaw=pobierz("stan","stock","quantity","ilosc"),stan=stanRaw===""||stanRaw===null?null:liczbaImportu(stanRaw);
  if(stan!==null&&(!Number.isInteger(stan)||stan<0))bledy.push("stan musi być liczbą całkowitą 0 lub większą");
  const stara=liczbaImportu(pobierz("staraCena","stara_cena","old_price","regular_price"));
  if(stara!==null&&cena!==null&&stara<=cena)ostrzezenia.push("stara cena pominięta, bo nie jest wyższa od ceny");
  const galeria=Array.isArray(r?.zdjecia)?r.zdjecia:Array.isArray(r?.images)?r.images:null;
  const zdjecia=galeria?galeria.map(String).filter(Boolean):Array.from({length:15},(_,i)=>"zdjecie"+(i+2)).map(k=>String(pobierz(k)).trim()).filter(Boolean);
  const p={id,nazwa,kategoria,cena:cena===null?0:+cena.toFixed(2)};
  for(const pole of ["cenaAllegro","cenaZakupu","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent","vatRate"]){const value=liczbaImportu(pobierz(pole));if(value!==null&&value>=0)p[pole]=+value.toFixed(pole.includes("Rate")||pole.includes("Percent")?4:2);}
  if(p.cenaZakupu!==undefined)p.cenaZakupuPrywatna=true;
  if(p.allegroShippingSubsidy===undefined)p.allegroShippingSubsidy=ALLEGRO_DOMYSLNA_DOPLATA_WYSYLKI;
  if(kategoriaInfo.poziomy.length>1){
    p.sciezkaKategorii=kategoriaInfo.poziomy;
    p.grupaKategorii=kategoriaInfo.grupa;
    p.kategoriaPelna=kategoriaInfo.pelna;
  }
  if(cena===0)p.wymagaCeny=true;else delete p.wymagaCeny;
  const opisKrotki=String(pobierz("opisKrotki","opis_krotki","short_description","summary")).trim();if(opisKrotki)p.opisKrotki=opisKrotki;
  const opis=String(pobierz("opis","description")).trim();if(opis)p.opis=opis;
  const ikona=String(pobierz("ikona","icon","emoji")).trim();if(ikona)p.ikona=ikona;
  const kolor=String(pobierz("kolor")).trim();if(kolor&&czyKolorKarty(kolor))p.kolor=kolor;
  const kolorProduktu=String(pobierz("kolorProduktu")).trim();if(kolorProduktu)p.kolorProduktu=kolorProduktu;
  if(stara!==null&&stara>cena)p.staraCena=+stara.toFixed(2);
  if(stan!==null)p.stan=stan;
  const gtin=String(pobierz("gtin")).trim();if(gtin)p.gtin=gtin;
  const externalId=String(pobierz("externalId")).trim();if(externalId)p.externalId=externalId;
  const mpn=String(pobierz("mpn")).trim();if(mpn)p.mpn=mpn;
  const marka=String(pobierz("marka")).trim();if(marka)p.marka=marka;
  const producent=String(pobierz("producent")).trim()||marka;if(producent)p.producent=producent;
  const rozmiar=String(pobierz("rozmiar")).trim();if(rozmiar)p.rozmiar=rozmiar;
  const material=String(pobierz("material")).trim();if(material)p.material=material;
  const sku=String(pobierz("sku","kod","kod_produktu")).trim()||externalId||mpn||gtin;if(sku)p.sku=sku;
  const badge=String(pobierz("badge","etykieta","label")).trim();if(badge)p.badge=badge;
  const zdjecie=String(pobierz("zdjecie","image","image_url")).trim();if(zdjecie)p.zdjecie=zdjecie;
  if(zdjecia.length)p.zdjecia=zdjecia.slice(0,15);
  const warianty=tablicaWartosci(pobierz("warianty","variants","options"));if(warianty.length)p.warianty=warianty.slice(0,30);
  return {nr,produkt:agentAIPoprawOpisyDanychProduktu(p),bledy,ostrzezenia};
}
function analizujTekstImportu(tekst,nazwa="wklejone dane"){
  try{
    const t=String(tekst||"").trim();if(!t)throw new Error("Brak danych do analizy");
    let surowe,format;
    if(t.startsWith("[")||t.startsWith("{")){
      const j=JSON.parse(t);surowe=Array.isArray(j)?j:(Array.isArray(j.products)?j.products:Array.isArray(j.produkty)?j.produkty:null);format="JSON";
      if(!surowe)throw new Error('JSON musi być tablicą produktów albo obiektem z polem "products"');
    }else{surowe=parsujCSVProduktow(t);format="CSV";}
    if(!surowe.length)throw new Error("Plik nie zawiera produktów");
    if(surowe.length>100000)throw new Error("Jednorazowo można zaimportować maksymalnie 100 000 produktów");
    const wyniki=surowe.map((r,i)=>normalizujProduktImportu(r,i+2));
    const idy=new Map(),sku=new Map(),external=new Map();
    for(const w of wyniki){
      const p=w.produkt;
      if(p.id!==null){if(idy.has(p.id))w.bledy.push(`powtórzone ID ${p.id} (także w wierszu ${idy.get(p.id)})`);else idy.set(p.id,w.nr);}
      if(p.sku){const s=p.sku.toLowerCase();if(sku.has(s))w.bledy.push(`powtórzone SKU ${p.sku} (także w wierszu ${sku.get(s)})`);else sku.set(s,w.nr);}
      if(p.externalId){const s=p.externalId.toLowerCase();if(external.has(s))w.bledy.push(`powtórzone EXTERNAL_ID ${p.externalId} (także w wierszu ${external.get(s)})`);else external.set(s,w.nr);}
    }
    podgladImportuProduktow={
      nazwa,format,wszystkich:wyniki.length,
      produkty:wyniki.filter(w=>!w.bledy.length).map(w=>w.produkt),
      bledy:wyniki.filter(w=>w.bledy.length).map(w=>`Wiersz ${w.nr}: ${w.bledy.join(", ")}`),
      ostrzezenia:wyniki.filter(w=>w.ostrzezenia.length).map(w=>`Wiersz ${w.nr}: ${w.ostrzezenia.join(", ")}`)
    };
    ostatniRaportImportu=null;renderuj();
  }catch(e){
    podgladImportuProduktow={nazwa,format:"—",wszystkich:0,produkty:[],bledy:[e.message],ostrzezenia:[]};
    renderuj();
  }
}
function analizujWklejonyImport(){
  analizujTekstImportu($("importTekstProduktow")?.value||"","wklejone dane");
}
function wczytajPlikImportuProduktow(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>20*1024*1024){toast("⚠️ Maksymalny rozmiar pliku to 20 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>analizujTekstImportu(r.result,plik.name);
  r.onerror=()=>toast("⚠️ Nie udało się odczytać pliku");
  r.readAsText(plik,"UTF-8");
}
function zapiszStanProduktowPoOperacji(){
  zapiszLS("artway_produkty_dodane",produktyDodane);
  zapiszLS("artway_produkty_ukryte",produktyUkryte);
  zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  zapiszLS("artway_produkty_definitywne",produktyDefinitywne);
  zapiszLS("artway_kosz_dodane",koszDodanych);
  zapiszLS("artway_kosz_meta",koszMeta);
  zapiszLS("artway_stany",stanyProduktow);
  zapiszLS("artway_dostepnosc",dostepnoscProduktow);
  zapiszLS("artway_ustawienia",ustawienia);
}
function dodajSciezkiKategoriiZImportuDoMenu(lista){
  const importowane=(Array.isArray(lista)?lista:[]).filter(p=>p?.grupaKategorii&&p?.kategoria);
  if(!importowane.length)return 0;
  const grupy=grupyMenuKategorii();let dodane=0;
  const klucz=v=>normalizujSzukanyTekst(v);
  for(const p of importowane){
    const nazwa=String(p.grupaKategorii||"").trim(),kat=String(p.kategoria||"").trim();
    if(!nazwa||!kat)continue;
    let g=grupy.find(x=>klucz(x.nazwa)===klucz(nazwa));
    if(!g){
      g={id:"menu_import_"+prostyHash(nazwa),nazwa,ikona:ikonaKategorii(nazwa),aktywna:true,kategorie:[]};
      grupy.push(g);
    }
    if(!g.kategorie.some(x=>klucz(x)===klucz(kat))){g.kategorie.push(kat);dodane++;}
  }
  if(dodane){
    ustawienia.menuKategorii=grupy.map(g=>({id:g.id,nazwa:g.nazwa,ikona:g.ikona,aktywna:g.aktywna!==false,kategorie:g.kategorie||[]}));
    ustawienia.menuPokazNieprzypisane=true;
  }
  return dodane;
}
function wykonajImportProduktow(){
  const d=podgladImportuProduktow;if(!d?.produkty?.length){toast("Najpierw przeanalizuj poprawne dane");return;}
  const tryb=$("trybImportuProduktow")?.value||"scal";
  if(tryb==="zastap"&&!confirm(`Zastąpić obecny katalog ${d.produkty.length} produktami? Przed zmianą zostanie utworzona kopia do cofnięcia.`))return;
  const kopia={data:new Date().toISOString(),produktyDodane,produktyUkryte,produktyEdytowane,produktyDefinitywne,koszDodanych,koszMeta,stanyProduktow,dostepnoscProduktow,ustawienia};
  try{localStorage.setItem("artway_ostatnia_kopia_importu",JSON.stringify(kopia));}catch(e){toast("⚠️ Nie udało się utworzyć kopii przed importem");return;}
  let dodane=0,zaktualizowane=0;const wejscie=d.produkty.map(p=>JSON.parse(JSON.stringify(p)));
  if(tryb==="zastap"){
    const zajete=new Set();let nastepne=Math.max(0,...wejscie.map(p=>Number(p.id)||0),...prodBazowe.map(p=>Number(p.id)||0))+1;
    for(const p of wejscie){if(!p.id||zajete.has(p.id)){while(zajete.has(nastepne))nastepne++;p.id=nastepne++;}zajete.add(p.id);if(!p.ikona)p.ikona="📦";if(!p.kolor)p.kolor="#dbeafe";if(p.opis===undefined)p.opis="";}
    produktyDodane=wejscie;
    produktyUkryte=[...new Set(prodBazowe.map(p=>p.id))];
    produktyEdytowane={};produktyDefinitywne=[...produktyUkryte];koszDodanych=[];koszMeta={};stanyProduktow={};
    wejscie.forEach(p=>{if(Number.isInteger(p.stan)&&p.stan>=0)stanyProduktow[p.id]=p.stan;});
    ustawienia={...ustawienia,mapaProduktow:{}};
    dodane=wejscie.length;
  }else{
    const kluczKodu=v=>String(v||"").trim().toLowerCase();
    const aktywne=produktyDoAdministracji(),poSku=new Map(aktywne.filter(p=>p.sku).map(p=>[kluczKodu(p.sku),p])),poExternal=new Map(aktywne.filter(p=>p.externalId).map(p=>[kluczKodu(p.externalId),p]));
    const zajete=new Set([...aktywne.map(p=>Number(p.id)),...koszDodanych.map(p=>Number(p.id))].filter(id=>Number.isInteger(id)&&id>0));let nastepne=Math.max(0,...prodBazowe.map(p=>Number(p.id)||0),...zajete,...wejscie.map(p=>Number(p.id)||0))+1;
    for(const p0 of wejscie){
      const poExternalId=p0.externalId?poExternal.get(kluczKodu(p0.externalId)):null,poKodzie=p0.sku?poSku.get(kluczKodu(p0.sku)):null,poId=(!p0.externalId&&!p0.sku&&p0.id)?aktywne.find(x=>x.id===p0.id):null,istniejacy=poExternalId||poKodzie||poId;
      if(istniejacy){
        const p={...istniejacy,...p0,id:istniejacy.id};
        const i=produktyDodane.findIndex(x=>x.id===p.id);
        if(i>=0)produktyDodane[i]=p;else produktyEdytowane={...produktyEdytowane,[p.id]:p};
        produktyUkryte=produktyUkryte.filter(id=>id!==p.id);produktyDefinitywne=produktyDefinitywne.filter(id=>id!==p.id);
        koszDodanych=koszDodanych.filter(x=>x.id!==p.id);delete koszMeta[p.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p.id]=p0.stan;
        if(p.sku)poSku.set(kluczKodu(p.sku),p);
        if(p.externalId)poExternal.set(kluczKodu(p.externalId),p);
        zaktualizowane++;
      }else{
        if(!p0.id||zajete.has(p0.id)){while(zajete.has(nastepne))nastepne++;p0.id=nastepne++;}
        if(!p0.ikona)p0.ikona="📦";if(!p0.kolor)p0.kolor="#dbeafe";if(p0.opis===undefined)p0.opis="";
        zajete.add(p0.id);produktyDodane.push(p0);
        koszDodanych=koszDodanych.filter(x=>x.id!==p0.id);delete koszMeta[p0.id];
        if(Number.isInteger(p0.stan)&&p0.stan>=0)stanyProduktow[p0.id]=p0.stan;
        if(p0.sku)poSku.set(kluczKodu(p0.sku),p0);
        if(p0.externalId)poExternal.set(kluczKodu(p0.externalId),p0);
        aktywne.push(p0);dodane++;
      }
    }
  }
  const menuZImportu=dodajSciezkiKategoriiZImportuDoMenu(wejscie);
  zaznaczoneProdukty.clear();zapiszStanProduktowPoOperacji();zbudujProdukty();odswiezMenu();
  ostatniRaportImportu={dodane,zaktualizowane,pominiete:d.bledy.length,tryb,plik:d.nazwa,menuZImportu};
  podgladImportuProduktow=null;
  loguj("info",`Import produktów: ${dodane} dodanych, ${zaktualizowane} zaktualizowanych, ${d.bledy.length} pominiętych, ${menuZImportu} dopisań do menu`);
  toast(`Import zakończony: +${dodane}, aktualizacje ${zaktualizowane}${menuZImportu?`, menu +${menuZImportu}`:""} ✅`);renderuj();
}
function cofnijOstatniImportProduktow(){
  const k=wczytajLS("artway_ostatnia_kopia_importu",null);
  if(!k){toast("Brak kopii ostatniego importu");return;}
  if(!confirm(`Cofnąć import i przywrócić stan z ${new Date(k.data).toLocaleString("pl-PL")}?`))return;
  produktyDodane=k.produktyDodane||[];produktyUkryte=k.produktyUkryte||[];produktyEdytowane=k.produktyEdytowane||{};
  produktyDefinitywne=k.produktyDefinitywne||[];koszDodanych=k.koszDodanych||[];koszMeta=k.koszMeta||{};stanyProduktow=k.stanyProduktow||{};dostepnoscProduktow=k.dostepnoscProduktow||{};ustawienia=k.ustawienia||ustawienia;
  zapiszStanProduktowPoOperacji();localStorage.removeItem("artway_ostatnia_kopia_importu");
  podgladImportuProduktow=null;ostatniRaportImportu=null;zbudujProdukty();odswiezMenu();
  loguj("info","Cofnięto ostatni import produktów");toast("Przywrócono stan sprzed importu ↩️");renderuj();
}
function produktDoEksportu(p,administracyjny=false){
  const o={id:p.id,nazwa:p.nazwa,kategoria:p.kategoria,cena:+Number(p.cena).toFixed(2)};
  if(p.staraCena>p.cena)o.staraCena=+Number(p.staraCena).toFixed(2);
  const stan=stanProduktu(p);if(stan!==null)o.stan=stan;
  const polaPubliczne=["cenaAllegro","vatRate","sku","gtin","externalId","mpn","marka","producent","opisKrotki","opis","badge","ikona","kolor","kolorProduktu","rozmiar","material","zdjecie"];
  const polaPrywatne=["cenaZakupu","cenaZakupuNetto","cenaZakupuVat","cenaZakupuWaluta","cenaZakupuZrodlo","cenaZakupuDokument","cenaZakupuKsef","cenaZakupuDostawca","cenaZakupuDataDokumentu","cenaZakupuDopasowanie","cenaZakupuZaktualizowanoAt","cenaZakupuHistoria","allegroCommissionAmount","allegroCommissionRate","allegroRecurringFees","allegroFeePrice","allegroFeeCalculatedAt","kosztPakowania","sklepAdditionalCost","sklepPaymentPercent","allegroAdditionalCost","allegroShippingSubsidy","allegroAdsPercent"];
  for(const k of administracyjny?[...polaPubliczne,...polaPrywatne]:polaPubliczne)if(p[k]!==undefined&&p[k]!=="")o[k]=p[k];
  if(p.wymagaCeny)o.wymagaCeny=true;
  if(Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length)o.sciezkaKategorii=p.sciezkaKategorii;
  if(p.grupaKategorii)o.grupaKategorii=p.grupaKategorii;
  if(p.kategoriaPelna)o.kategoriaPelna=p.kategoriaPelna;
  if(p.zdjecia?.length)o.zdjecia=p.zdjecia.slice(0,15);
  if(p.warianty?.length)o.warianty=p.warianty;
  return o;
}
function zakresEksportuProduktow(zakres,administracyjny=false){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  let lista=[...produkty];
  if(zakres==="zaznaczone")lista=lista.filter(p=>zaznaczoneProdukty.has(p.id));
  if(zakres==="kategoria"){const k=$("kategoriaEksportuProduktow")?.value||"";lista=lista.filter(p=>p.kategoria===k);}
  return lista.map(p=>produktDoEksportu(p,administracyjny));
}
function nazwaZakresuEksportu(zakres){
  if(zakres==="zaznaczone")return "zaznaczone";
  if(zakres==="kategoria")return normalizujNaglowekCSV($("kategoriaEksportuProduktow")?.value||"kategoria");
  return "widoczne";
}
function eksportujProduktyJSON(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const nazwa=zakres==="widoczne"?"products.json":`products-${nazwaZakresuEksportu(zakres)}.json`;
  pobierzPlik(nazwa,JSON.stringify(lista,null,2),"application/json");
  if(zakres==="widoczne")localStorage.setItem("artway_produkty_export_hash",prostyHash(JSON.stringify(lista)));
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(zakres==="widoczne"?"Pobrano products.json — wgraj go na hosting ✅":`Wyeksportowano ${lista.length} produktów`);
}
function eksportujProduktyCSV(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres,true);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_CSV_PRODUKTU.join(";"),...lista.map(p=>POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty.csv":`produkty-${nazwaZakresuEksportu(zakres)}.csv`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);toast(`Wyeksportowano ${lista.length} produktów do CSV`);
}
function wartoscPolaCSVProduktu(p,pole){
  if(pole==="stara_cena")return p.staraCena?String(p.staraCena.toFixed(2)).replace(".",","):"";
  if(pole==="cena")return String(Number(p.cena||0).toFixed(2)).replace(".",",");
  if(pole==="external_id")return p.externalId||"";
  const financial={cena_allegro:"cenaAllegro",cena_zakupu:"cenaZakupu",prowizja_allegro:"allegroCommissionAmount",prowizja_allegro_procent:"allegroCommissionRate",oplaty_allegro_cykliczne:"allegroRecurringFees",koszt_pakowania:"kosztPakowania",koszt_dodatkowy_sklepu:"sklepAdditionalCost",platnosc_sklepu_procent:"sklepPaymentPercent",koszt_dodatkowy_allegro:"allegroAdditionalCost",doplata_wysylki_allegro:"allegroShippingSubsidy",reklama_allegro_procent:"allegroAdsPercent",vat:"vatRate"};
  if(financial[pole])return p[financial[pole]]??"";
  if(pole==="opis_krotki")return p.opisKrotki||opisKrotkiProduktu(p)||"";
  if(pole==="kolor_produktu")return p.kolorProduktu||"";
  if(pole==="warianty")return (p.warianty||[]).join(" | ");
  if(pole==="stan")return p.stan??"";
  if(pole==="zdjecie")return p.zdjecie||"";
  const m=String(pole).match(/^zdjecie(\d+)$/);
  if(m)return (p.zdjecia||[])[Number(m[1])-2]||"";
  return p[pole]??"";
}
function wartoscPolaOVF(p,pole){
  const zdj=[p.zdjecie||"",...(p.zdjecia||[])];
  const kategoriaPelna=Array.isArray(p.sciezkaKategorii)&&p.sciezkaKategorii.length?p.sciezkaKategorii.join("/"):p.kategoriaPelna||p.kategoria||"";
  const mapa={
    GTIN:p.gtin||"",
    EXTERNAL_ID:p.externalId||p.sku||String(p.id||""),
    NAME:p.nazwa||"",
    STOCK:p.stan??"",
    PRICE:p.cena!==undefined?String(Number(p.cena||0).toFixed(2)).replace(".",","):"",
    MPN:p.mpn||p.sku||"",
    DESCRIPTION:p.opis||"",
    CATEGORY:kategoriaPelna,
    BRAND:p.marka||"",
    MANUFACTURER:p.producent||p.marka||"",
    COLOR:p.kolorProduktu||"",
    SIZE:p.rozmiar||(p.warianty||[]).join(" | "),
    MATERIAL:p.material||""
  };
  const img=String(pole).match(/^IMAGE(\d+)$/);
  return img ? (zdj[Number(img[1])-1]||"") : (mapa[pole]??"");
}
function eksportujProduktyOVF(zakres){
  zakres=zakres||$("zakresEksportuProduktow")?.value||"widoczne";
  const lista=zakresEksportuProduktow(zakres);if(!lista.length){toast("Brak produktów w wybranym zakresie");return;}
  const csv=[POLA_OVF_PRODUKTU.join(","),...lista.map(p=>POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(","))].join("\n");
  const nazwa=zakres==="widoczne"?"produkty-ovf.xls":`produkty-ovf-${nazwaZakresuEksportu(zakres)}.xls`;
  pobierzPlik(nazwa,"\uFEFF"+csv,"text/csv");
  loguj("info",`Wyeksportowano ${nazwa} (${lista.length} produktów)`);
  toast(`Wyeksportowano ${lista.length} produktów w formacie OVF`);
}
function pobierzSzablonProduktowCSV(){
  const p={id:1,nazwa:"Przykładowa gra",kategoria:"Gry edukacyjne",cena:99.90,cenaAllegro:109.90,cenaZakupu:55,allegroCommissionAmount:11,allegroCommissionRate:10,allegroRecurringFees:0,kosztPakowania:1.5,sklepAdditionalCost:0,sklepPaymentPercent:1.5,allegroAdditionalCost:0,allegroShippingSubsidy:3,allegroAdsPercent:0,vatRate:23,staraCena:129.90,stan:25,sku:"SKU-001",gtin:"5901234567891",externalId:"EXT-001",mpn:"MPN-001",marka:"Marka",producent:"Producent",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis produktu z najważniejszymi cechami.",badge:"Nowość",ikona:"🎲",zdjecie:"https://adres.pl/zdjecie.jpg",warianty:["S","M","L"],kolor:"#dbeafe",kolorProduktu:"Kolorowy",rozmiar:"XL",material:"Karton"};
  pobierzPlik("szablon-importu-produktow.csv","\uFEFF"+POLA_CSV_PRODUKTU.join(";")+"\n"+POLA_CSV_PRODUKTU.map(pole=>wartoscPolaCSVProduktu(p,pole)).map(csvPole).join(";"),"text/csv");
}
function pobierzSzablonProduktowOVF(){
  const p={id:1,nazwa:"Przykładowa gra edukacyjna",kategoria:"Gry edukacyjne",cena:99.90,stan:25,sku:"GRA-001",externalId:"GRA-001",gtin:"5901234567891",mpn:"GRA-001",opisKrotki:"Krótki opis produktu do karty sklepu.",opis:"Pełny opis będzie widoczny na stronie produktu, a na listach pojawi się skrót.",zdjecie:"https://adres.pl/zdjecie1.jpg",zdjecia:["https://adres.pl/zdjecie2.jpg"],marka:"Artway",producent:"Artway",kolorProduktu:"Kolorowy",rozmiar:"30x20x5 cm",material:"Karton"};
  const csv=POLA_OVF_PRODUKTU.join(",")+"\n"+POLA_OVF_PRODUKTU.map(pole=>wartoscPolaOVF(p,pole)).map(csvPole).join(",");
  pobierzPlik("ovf-template-dla-rozszerzonego-pliku-csv-dane.xls","\uFEFF"+csv,"text/csv");
}

/* ── Katalogi produktów (kategorie) ── */
function widokAdminKategorie(){
  const wszystkie = produktyDoAdministracji();
  const zmiany = ustawienia.kategorie || {};
  const mapa = ustawienia.mapaProduktow || {};
  const zProduktow = [...new Set(wszystkie.map(p=>{ let k=mapa[p.id]||p.kategoria; for(let i=0;i<3&&zmiany[k];i++) k=zmiany[k]; return k; }))];
  const wlasne = ustawienia.wlasneKategorie || [];
  const nazwy = [...new Set([...zProduktow, ...wlasne])];
  const ukryte = ustawienia.ukryteKategorie || [];
  const grupy = grupyMenuKategorii();
  const pokazNieprzypisane = ustawienia.menuPokazNieprzypisane!==false;
  const przypisane = new Set(grupy.flatMap(g=>g.kategorie).filter(k=>nazwy.includes(k)));
  const bezGrup = nazwy.filter(k=>!przypisane.has(k));
  return asortymentSzkielet("kategorie", `
  <div class="panel">
    <h1>➕ Utwórz nowy katalog</h1>
    <form onsubmit="dodajKatalog(event)" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin:.6rem 0">
      <div class="f-group" style="margin:0;flex:1;min-width:200px"><label>Nazwa katalogu</label><input required name="nazwa" placeholder="np. Zabawki, AGD, Ogród…" maxlength="40"></div>
      <button class="btn" type="submit">➕ Utwórz</button>
    </form>
    <p style="font-size:.8rem;color:var(--muted2)">Nowy katalog od razu pojawi się w górnym menu sklepu i na stronie głównej. Produkty przypiszesz do niego w <a href="#/admin/mapowanie">🧩 Mapowaniu produktów</a> lub przy dodawaniu produktu.</p>
  </div>
  <div class="panel">
    <div class="results-bar" style="padding:0;margin:0 0 .8rem">
      <div><h1 style="margin:0">🧭 Wyższy poziom kategorii w menu</h1><p style="font-size:.85rem;color:var(--muted2);margin:.25rem 0 0">Poziom 1: grupa w górnym menu • Poziom 2: wybrane katalogi • Poziom 3: produkty. To porządkuje sklep przy dużej liczbie produktów.</p></div>
      <label style="font-size:.82rem;font-weight:700;color:var(--muted2)"><input type="checkbox" ${pokazNieprzypisane?"checked":""} onchange="przelaczNieprzypisaneMenu(this.checked)"> Pokaż katalogi bez grupy w menu</label>
    </div>
    <form onsubmit="dodajGrupeMenuKategorii(event)" class="f-row" style="grid-template-columns:1fr 130px auto;align-items:end;margin-bottom:1rem">
      <div class="f-group"><label>Nazwa grupy nadrzędnej</label><input required name="nazwa" placeholder="np. Gry i zabawki, Edukacja, Ogród…"></div>
      <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona","🗂️","🗂️")}</div>
      <div class="f-group"><button class="btn" type="submit">➕ Dodaj grupę</button></div>
    </form>
    ${grupy.length?grupy.map((g,i)=>{
      const dzieci=g.kategorie.filter(k=>nazwy.includes(k));
      const martwe=g.kategorie.filter(k=>!nazwy.includes(k));
      return `<div class="menu-group-box" style="${g.aktywna?"":"opacity:.6"}">
        <form onsubmit="zapiszGrupeMenuKategorii(event,${jsArg(g.id)})">
          <div class="f-row" style="grid-template-columns:minmax(210px,280px) 1fr auto auto auto;align-items:end">
            <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona",g.ikona||"🗂️","🗂️")}</div>
            <div class="f-group"><label>Nazwa grupy</label><input name="nazwa" value="${esc(g.nazwa)}" required></div>
            <label class="chk-row" style="margin:.2rem 0 .55rem"><input type="checkbox" name="aktywna" ${g.aktywna?"checked":""}> <span>Widoczna</span></label>
            <div class="diag-actions" style="margin:0">
              <button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},-1)" ${i===0?"disabled":""}>↑</button>
              <button class="btn ghost" type="button" onclick="przesunGrupeMenuKategorii(${jsArg(g.id)},1)" ${i===grupy.length-1?"disabled":""}>↓</button>
            </div>
            <div class="diag-actions" style="margin:0"><button class="btn" type="submit">💾 Zapisz</button><button class="btn danger" type="button" onclick="if(confirm('Usunąć grupę menu? Produkty i katalogi zostaną.')) usunGrupeMenuKategorii(${jsArg(g.id)})">🗑️</button></div>
          </div>
        </form>
        <p style="font-size:.82rem;color:var(--muted2);margin:.35rem 0">W grupie: <b>${dzieci.length}</b> katalogów${martwe.length?` • ${martwe.length} nieistniejących odwołań do wyczyszczenia przy zapisie`:""}</p>
        <div class="diag-actions" style="margin:.4rem 0"><button class="btn ghost" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'wszystkie')">☑ Zaznacz wszystkie</button><button class="btn ghost" onclick="ustawKategorieWGrupie(${jsArg(g.id)},'puste')">☐ Wyczyść grupę</button></div>
        <div class="menu-cat-grid">
          ${nazwy.map(k=>`<label><input type="checkbox" ${g.kategorie.includes(k)?"checked":""} onchange="przelaczKategorieWGrupie(${jsArg(g.id)},${jsArg(k)},this.checked)"> <span><b>${esc(k)}</b><br><small>${liczbaProduktowWKategorii(k)} produktów${przypisane.has(k)&&!g.kategorie.includes(k)?" • w innej grupie":""}</small></span></label>`).join("")}
        </div>
      </div>`;
    }).join(""):`<div class="backend-note">Nie ma jeszcze grup nadrzędnych. Dodaj np. „Gry i zabawki”, a potem zaznacz katalogi, które mają się pod nią pojawić w górnym menu.</div>`}
    ${bezGrup.length?`<p style="font-size:.82rem;color:var(--muted2);margin-top:.75rem">Katalogi bez grupy: ${bezGrup.map(esc).join(", ")}</p>`:""}
  </div>
  <div class="panel">
    <h1>🗂️ Katalogi (${nazwy.length})</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin-bottom:.8rem">Zmiana nazwy przenosi wszystkie produkty do nowej nazwy. Ukrycie chowa katalog i jego produkty w sklepie (nic nie jest kasowane). Każdy katalog ma własną podstronę w menu sklepu.</p>
    <table class="log-table">
      <tr><th>Katalog</th><th>Produktów</th><th>Nowa nazwa</th><th>Akcje</th></tr>
      ${nazwy.map(k=>{
        const n = wszystkie.filter(p=>{let x=(ustawienia.mapaProduktow||{})[p.id]||p.kategoria;for(let i=0;i<3&&zmiany[x];i++)x=zmiany[x];return x===k;}).length;
        const uk = ukryte.includes(k);
        const wlasny = wlasne.includes(k);
        const idKat = btoa(encodeURIComponent(k)).replace(/[^a-zA-Z0-9]/g,"");
        return `<tr style="${uk?'opacity:.5':''}">
        <td><b>${esc(k)}</b>${uk?' <span class="lvl lvl-ostrzezenie">ukryty</span>':""}${wlasny&&!n?' <span class="lvl lvl-info">nowy</span>':""}</td>
        <td>${n} ${n?`— <a href="#/kategoria/${encodeURIComponent(k)}">podgląd</a>`:""}</td>
        <td><div style="display:flex;gap:.4rem"><input value="${esc(k)}" id="kat_${idKat}" style="padding:.3rem .6rem;border:1.5px solid var(--line);border-radius:8px;max-width:170px">
          <button class="btn ghost" style="padding:.3rem .7rem" onclick="zmienKategorie('${esc(k)}', document.getElementById('kat_${idKat}').value)">Zmień</button></div></td>
        <td style="white-space:nowrap">
          <button class="btn ghost" style="padding:.3rem .55rem" onclick="otworzDodawanieProduktu(${jsArg(k)})" title="Dodaj produkt do katalogu">➕</button>
          <a class="btn ghost" style="padding:.3rem .55rem" href="#/admin/mapowanie" onclick="filtrMapowania=${jsArg(k)}" title="Mapuj produkty">🧩</a>
          <button class="ci-remove" style="color:var(--muted2)" onclick="przelaczKategorie(${jsArg(k)})" title="${uk?'Pokaż':'Ukryj'}">${uk?"👁️":"🙈"}</button>
          ${wlasny&&!n?`<button class="ci-remove" onclick="usunKatalog('${esc(k)}')" title="Usuń pusty katalog">🗑️</button>`:""}</td>
      </tr>`;}).join("")}
    </table>
  </div>`);
}
function dodajKatalog(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const k = String(f.get("nazwa")).trim();
  if(k.length<2){ toast("⚠️ Nazwa musi mieć min. 2 znaki"); return; }
  if(wszystkieKategorie().includes(k) || (ustawienia.wlasneKategorie||[]).includes(k)){ toast("Taki katalog już istnieje"); return; }
  ustawienia.wlasneKategorie = [...(ustawienia.wlasneKategorie||[]), k];
  loguj("info","Utworzono katalog: "+k);
  zapiszCzescUstawien({wlasneKategorie: ustawienia.wlasneKategorie});
}
function usunKatalog(k){
  ustawienia.wlasneKategorie = (ustawienia.wlasneKategorie||[]).filter(x=>x!==k);
  ustawienia.menuKategorii = grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(x=>x!==k)}));
  loguj("info","Usunięto pusty katalog: "+k);
  zapiszCzescUstawien({wlasneKategorie: ustawienia.wlasneKategorie, menuKategorii: ustawienia.menuKategorii});
}
function dodajGrupeMenuKategorii(e){
  e.preventDefault();
  const f=new FormData(e.target), nazwa=String(f.get("nazwa")||"").trim(), ikona=String(f.get("ikona")||"🗂️").trim()||"🗂️";
  if(nazwa.length<2){ toast("Podaj nazwę grupy"); return; }
  const grupy=grupyMenuKategorii();
  if(grupy.some(g=>g.nazwa.toLowerCase()===nazwa.toLowerCase())){ toast("Taka grupa już istnieje"); return; }
  grupy.push({id:"grp_"+Date.now().toString(36),nazwa,ikona,aktywna:true,kategorie:[]});
  loguj("info","Dodano grupę menu kategorii: "+nazwa);
  zapiszGrupyMenuKategorii(grupy);
}
function zapiszGrupeMenuKategorii(e,id){
  e.preventDefault();
  const f=new FormData(e.target), grupy=grupyMenuKategorii(), dozwolone=new Set(wszystkieKategorie());
  const i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i]={...grupy[i],nazwa:String(f.get("nazwa")||"").trim()||grupy[i].nazwa,ikona:String(f.get("ikona")||"🗂️").trim()||"🗂️",aktywna:!!f.get("aktywna"),kategorie:grupy[i].kategorie.filter(k=>dozwolone.has(k))};
  loguj("info","Zapisano grupę menu kategorii: "+grupy[i].nazwa);
  zapiszGrupyMenuKategorii(grupy);
}
function przelaczKategorieWGrupie(id,kat,wl){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i].kategorie = wl ? [...new Set([...grupy[i].kategorie,kat])] : grupy[i].kategorie.filter(k=>k!==kat);
  zapiszGrupyMenuKategorii(grupy);
}
function ustawKategorieWGrupie(id,tryb){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id); if(i<0) return;
  grupy[i].kategorie = tryb==="wszystkie" ? wszystkieKategorie() : [];
  zapiszGrupyMenuKategorii(grupy);
}
function przesunGrupeMenuKategorii(id,kierunek){
  const grupy=grupyMenuKategorii(), i=grupy.findIndex(g=>g.id===id), j=i+kierunek;
  if(i<0||j<0||j>=grupy.length) return;
  [grupy[i],grupy[j]]=[grupy[j],grupy[i]];
  zapiszGrupyMenuKategorii(grupy);
}
function usunGrupeMenuKategorii(id){
  zapiszGrupyMenuKategorii(grupyMenuKategorii().filter(g=>g.id!==id));
}
function przelaczNieprzypisaneMenu(wl){
  ustawienia.menuPokazNieprzypisane=!!wl;
  zapiszCzescUstawien({menuPokazNieprzypisane:ustawienia.menuPokazNieprzypisane});
}
function otworzDodawanieProduktu(kategoria){
  const category=String(kategoria||"").trim();
  location.hash=category?`#/admin/produkty/dodaj?kategoria=${encodeURIComponent(category)}`:"#/admin/produkty/dodaj";
}

/* ── Zaawansowane mapowanie produktów (produkt → katalog) ── */
let zaznaczoneMap = new Set(), filtrMapowania = "Wszystkie";
function widokAdminMapowanie(){
  const zmiany = ustawienia.kategorie || {};
  const mapa = ustawienia.mapaProduktow || {};
  const wszystkie = produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p))
    .map(p=>{ let k=mapa[p.id]||p.kategoria; for(let i=0;i<3&&zmiany[k];i++) k=zmiany[k]; return {...p, kategoria:k}; });
  const katalogi = wszystkieKategorie();
  const lista = filtrMapowania==="Wszystkie" ? wszystkie : wszystkie.filter(p=>p.kategoria===filtrMapowania);
  const opcje = katalogi.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join("");
  return asortymentSzkielet("mapowanie", `
  <div class="panel">
    <h1>🧩 Mapowanie produktów (${lista.length})</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin:.4rem 0 .8rem">Przypisuj produkty do katalogów: pojedynczo (lista w wierszu) albo masowo — zaznacz produkty, wybierz katalog docelowy i kliknij „Przenieś”. Działa też na produkty z products.json.</p>
    <div class="diag-actions" style="margin-bottom:.8rem">
      <button class="btn" onclick="otworzDodawanieProduktu(filtrMapowania==='Wszystkie'?'':filtrMapowania)">➕ Dodaj produkt</button>
      <form onsubmit="dodajKatalogZMapowania(event)" style="display:flex;gap:.5rem;flex:1;min-width:260px">
        <input required name="nazwa" placeholder="Nazwa nowego katalogu…" maxlength="40" style="flex:1;padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <button class="btn ghost" type="submit">➕ Katalog</button>
      </form>
    </div>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem;background:var(--bg);border-radius:12px;padding:.7rem">
      <select onchange="filtrMapowania=this.value;zaznaczoneMap.clear();renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option ${filtrMapowania==="Wszystkie"?"selected":""}>Wszystkie</option>
        ${katalogi.map(k=>`<option ${k===filtrMapowania?"selected":""}>${esc(k)}</option>`).join("")}
      </select>
      <span style="font-size:.85rem;font-weight:700">Zaznaczone przenieś do:</span>
      <select id="mapCel" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">${opcje}</select>
      <button class="btn" onclick="przeniesZaznaczone()">🧩 Przenieś</button>
      <button class="btn ghost" onclick="zaznaczWszystkieMapowania()">☑ Zaznacz widoczne</button>
      <button class="btn ghost" onclick="usunMapowanieZaznaczonych()">↩️ Usuń wybrane mapowania</button>
      <button class="btn ghost" onclick="wyczyscMapowanie()">↩️ Wyczyść całe mapowanie</button>
    </div>
    <div style="overflow-x:auto"><table class="log-table">
      <tr><th></th><th>Produkt</th><th>Katalog</th><th>Przenieś do</th><th>Akcje</th></tr>
      ${lista.map(p=>`<tr>
        <td><input type="checkbox" ${zaznaczoneMap.has(p.id)?"checked":""} onchange="przelaczZaznaczenieMap(${p.id})" style="width:17px;height:17px;accent-color:var(--brand)"></td>
        <td>${p.ikona||"📦"} <b>${esc(p.nazwa)}</b>${mapa[p.id]?' <span class="lvl lvl-info">zmapowany</span>':""}</td>
        <td>${esc(p.kategoria)}</td>
        <td><select onchange="mapujProdukt(${p.id}, this.value)" style="padding:.3rem .5rem;border-radius:8px;border:1.5px solid var(--line)">
          ${katalogi.map(k=>`<option ${k===p.kategoria?"selected":""}>${esc(k)}</option>`).join("")}
        </select></td>
        <td style="white-space:nowrap">
          <a class="btn ghost" href="#/admin/produkty/edytuj/${p.id}" style="padding:.3rem .55rem" title="Edytuj produkt">✏️</a>
          ${mapa[p.id]?`<button class="btn ghost" onclick="usunMapowanieProduktu(${p.id})" style="padding:.3rem .55rem" title="Usuń mapowanie">↩️</button>`:""}
        </td>
      </tr>`).join("")}
    </table></div>
  </div>`);
}
function przelaczZaznaczenieMap(id){ zaznaczoneMap.has(id) ? zaznaczoneMap.delete(id) : zaznaczoneMap.add(id); }
function zaznaczWszystkieMapowania(){
  const zmiany = ustawienia.kategorie || {}, mapa = ustawienia.mapaProduktow || {};
  let lista = produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p))
    .map(p=>{let k=mapa[p.id]||p.kategoria;for(let i=0;i<3&&zmiany[k];i++)k=zmiany[k];return {...p,kategoria:k};});
  if(filtrMapowania!=="Wszystkie") lista=lista.filter(p=>p.kategoria===filtrMapowania);
  lista.forEach(p=>zaznaczoneMap.add(p.id));
  renderuj();
}
function mapujProdukt(id, kat){
  ustawienia.mapaProduktow = {...(ustawienia.mapaProduktow||{}), [id]: kat};
  loguj("info",`Przemapowano produkt ${id} → ${kat}`);
  zapiszCzescUstawien({mapaProduktow: ustawienia.mapaProduktow});
}
function usunMapowanieProduktu(id){
  const mapa = {...(ustawienia.mapaProduktow||{})};
  delete mapa[id];
  loguj("info","Usunięto mapowanie produktu "+id);
  zapiszCzescUstawien({mapaProduktow:mapa});
}
function usunMapowanieZaznaczonych(){
  if(!zaznaczoneMap.size){ toast("Zaznacz produkty"); return; }
  const mapa = {...(ustawienia.mapaProduktow||{})};
  zaznaczoneMap.forEach(id=>delete mapa[id]);
  loguj("info",`Usunięto mapowanie ${zaznaczoneMap.size} produktów`);
  zaznaczoneMap.clear();
  zapiszCzescUstawien({mapaProduktow:mapa});
}
function przeniesZaznaczone(){
  const cel = $("mapCel")?.value;
  if(!cel || !zaznaczoneMap.size){ toast("Zaznacz produkty i wybierz katalog docelowy"); return; }
  const mapa = {...(ustawienia.mapaProduktow||{})};
  zaznaczoneMap.forEach(id=>mapa[id]=cel);
  loguj("info",`Przemapowano ${zaznaczoneMap.size} produktów → ${cel}`);
  zaznaczoneMap.clear();
  zapiszCzescUstawien({mapaProduktow: mapa});
}
function wyczyscMapowanie(){
  zaznaczoneMap.clear();
  loguj("info","Wyczyszczono mapowanie produktów");
  zapiszCzescUstawien({mapaProduktow: {}});
}
function dodajKatalogZMapowania(e){
  e.preventDefault();
  const nazwa = String(new FormData(e.target).get("nazwa")||"").trim();
  if(nazwa.length<2){ toast("Nazwa katalogu musi mieć minimum 2 znaki"); return; }
  if(wszystkieKategorie().includes(nazwa)){ toast("Taki katalog już istnieje"); return; }
  const wlasne = [...(ustawienia.wlasneKategorie||[]), nazwa];
  filtrMapowania = nazwa;
  zapiszCzescUstawien({wlasneKategorie:wlasne});
  loguj("info","Dodano katalog z mapowania: "+nazwa);
}
function zmienKategorie(stara, nowa){
  nowa = String(nowa||"").trim();
  if(!nowa || nowa===stara){ toast("Wpisz inną nazwę"); return; }
  ustawienia.kategorie = {...(ustawienia.kategorie||{}), [stara]: nowa};
  ustawienia.menuKategorii = grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.map(k=>k===stara?nowa:k)}));
  if(aktywnaKategoria===stara) aktywnaKategoria = nowa;
  zapiszCzescUstawien({kategorie: ustawienia.kategorie, menuKategorii: ustawienia.menuKategorii});
  loguj("info",`Zmieniono kategorię: ${stara} → ${nowa}`);
}
function przelaczKategorie(kat){
  const u = ustawienia.ukryteKategorie || [];
  ustawienia.ukryteKategorie = u.includes(kat) ? u.filter(x=>x!==kat) : [...u, kat];
  if(aktywnaKategoria===kat) aktywnaKategoria = "Wszystkie";
  zapiszCzescUstawien({ukryteKategorie: ustawienia.ukryteKategorie});
}

/* ── ⭐ Moderacja opinii ── */
let filtrOpinii = "oczekuje";
function widokAdminOpinie(){
  const oczekujace = opinie.filter(o=>o.status==="oczekuje").length;
  const lista = filtrOpinii==="wszystkie" ? opinie : opinie.filter(o=>o.status===filtrOpinii);
  return asortymentSzkielet("opinie", `
  <div class="panel">
    <h1>⭐ Opinie klientów (${opinie.length}) ${oczekujace?`<span class="lvl lvl-ostrzezenie">${oczekujace} do akceptacji</span>`:""}</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin:.4rem 0 .8rem">Opinie pojawiają się na stronie produktu dopiero po Twojej akceptacji. Klient wystawia je na dole strony produktu.</p>
    <div style="display:flex;gap:.6rem;margin-bottom:1rem">
      <select onchange="filtrOpinii=this.value;renderuj()" style="padding:.45rem .8rem;border-radius:10px;border:1.5px solid var(--line)">
        <option value="oczekuje" ${filtrOpinii==="oczekuje"?"selected":""}>Oczekujące (${opinie.filter(o=>o.status==="oczekuje").length})</option>
        <option value="zatwierdzona" ${filtrOpinii==="zatwierdzona"?"selected":""}>Opublikowane (${opinie.filter(o=>o.status==="zatwierdzona").length})</option>
        <option value="wszystkie" ${filtrOpinii==="wszystkie"?"selected":""}>Wszystkie</option>
      </select>
    </div>
    ${lista.length ? lista.map(o=>{
      const p = produkty.find(x=>x.id===o.produktId) || [...prodBazowe,...produktyDodane].find(x=>x.id===o.produktId);
      return `<div class="order-box">
        <div class="order-head">
          <b>${esc(o.autor)}</b>
          <span style="color:var(--accent);font-weight:700">${gwiazdki(o.ocena)}</span>
          <span>${esc(o.data)}</span>
          <span class="lvl ${o.status==="zatwierdzona"?"lvl-info":"lvl-ostrzezenie"}">${o.status==="zatwierdzona"?"opublikowana":"oczekuje"}</span>
        </div>
        <div class="order-lines">
          ${p?`🏷️ <a href="#/produkt/${o.produktId}">${esc(p.nazwa)}</a><br>`:""}
          ${esc(o.tekst)}
        </div>
        <div class="diag-actions" style="margin-top:.6rem">
          ${o.status!=="zatwierdzona"?`<button class="btn" onclick="moderujOpinie('${o.id}','zatwierdz')">✅ Opublikuj</button>`:""}
          <button class="btn danger" onclick="if(confirm('Usunąć opinię?')) moderujOpinie('${o.id}','usun')">🗑️ Usuń</button>
        </div>
      </div>`;}).join("")
    : `<p style="color:var(--muted2)">Brak opinii w tym widoku.</p>`}
  </div>`);
}

/* ── 🧭 Rozmieszczenie sekcji strony głównej (wizualnie) ── */
function widokAdminRozmieszczenie(){
  const kolej = kolejnoscSekcji();
  return personalizacjaSzkielet("rozmieszczenie", `
  <div class="panel">
    <h1>🧭 Rozmieszczenie sekcji strony głównej</h1>
    <p style="font-size:.86rem;color:var(--muted2);margin:.4rem 0 1rem">Ułóż stronę dokładnie tak, jak chcesz: strzałki <b>↑ ↓</b> zmieniają kolejność, oko włącza/wyłącza sekcję. Po prawej widzisz schemat strony — klienci zobaczą ją dokładnie w tej kolejności. Zmiany zapisują się od razu.</p>
    <div class="rozm-grid">
      <div>
        ${kolej.map((id,i)=>{ const s=SEKCJE_GLOWNEJ[id]; const wid=sekcjaWidoczna(id); return `
        <div class="uklad-box ${wid?'':'wylaczona'}">
          <span class="uklad-nr">${i+1}</span>
          <span style="font-size:1.15rem">${s.ikona}</span>
          <b style="flex:1;font-size:.9rem">${s.nazwa}${wid?"":" <span class='lvl lvl-ostrzezenie'>ukryta</span>"}</b>
          <button class="btn ghost uklad-btn" ${i===0?"disabled":""} onclick="przesunSekcjeGlownej('${id}',-1)" title="Wyżej">↑</button>
          <button class="btn ghost uklad-btn" ${i===kolej.length-1?"disabled":""} onclick="przesunSekcjeGlownej('${id}',1)" title="Niżej">↓</button>
          <button class="btn ghost uklad-btn" onclick="przelaczSekcjeGlownej('${id}')" title="${wid?'Ukryj sekcję':'Pokaż sekcję'}">${wid?"👁️":"🙈"}</button>
        </div>`;}).join("")}
        <div class="diag-actions" style="margin-top:1rem">
          <a class="btn" href="#/">👁️ Zobacz stronę na żywo</a>
          <button class="btn danger" onclick="resetujRozmieszczenie()">↩️ Przywróć domyślne</button>
        </div>
      </div>
      <div class="mini-strona">
        <div class="mini-pasek">pasek info + nagłówek + menu</div>
        ${kolej.map(id=>{ const s=SEKCJE_GLOWNEJ[id]; const wid=sekcjaWidoczna(id);
          const h = id==="hero" ? 54 : id==="produkty" ? 66 : id==="kategorie" ? 44 : 28;
          return `<div class="mini-blok ${wid?'':'mini-ukryty'}" style="min-height:${h}px">${s.ikona} ${s.nazwa}</div>`;}).join("")}
        <div class="mini-pasek">stopka</div>
      </div>
    </div>
  </div>`);
}
function przesunSekcjeGlownej(id, dir){
  const k = kolejnoscSekcji();
  const i = k.indexOf(id), j = i+dir;
  if(i<0 || j<0 || j>=k.length) return;
  [k[i], k[j]] = [k[j], k[i]];
  loguj("info","Rozmieszczenie: przesunięto sekcję "+id);
  zapiszCzescUstawien({kolejnoscSekcji: k});
}
function przelaczSekcjeGlownej(id){
  const u = new Set(ustawienia.sekcjeUkryte||[]);
  u.has(id) ? u.delete(id) : u.add(id);
  loguj("info","Rozmieszczenie: przełączono widoczność sekcji "+id);
  zapiszCzescUstawien({sekcjeUkryte: [...u]});
}
function resetujRozmieszczenie(){
  loguj("info","Rozmieszczenie: przywrócono domyślne");
  zapiszCzescUstawien({kolejnoscSekcji: null, sekcjeUkryte: []});
}

/* ── Kody rabatowe ── */
function widokAdminRabaty(){
  const kody = Object.entries(KONFIG.kodyRabatowe);
  return asortymentSzkielet("rabaty", `
  <div class="panel">
    <h1>🎁 Kody rabatowe (${kody.length})</h1>
    <form onsubmit="dodajKod(event)" style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:end;margin:.8rem 0 1rem">
      <div class="f-group" style="margin:0"><label>Kod</label><input required name="kod" placeholder="np. WIOSNA10" maxlength="20" style="text-transform:uppercase"></div>
      <div class="f-group" style="margin:0;max-width:120px"><label>Rabat %</label><input required name="procent" type="number" min="1" max="90"></div>
      <button class="btn" type="submit">➕ Dodaj</button>
    </form>
    ${kody.length?`<table class="log-table"><tr><th>Kod</th><th>Rabat</th><th>Akcje</th></tr>
      ${kody.map(([k,v])=>`<tr><td><b>${esc(k)}</b></td><td><input id="kod_${esc(k)}" type="number" min="1" max="90" value="${v}" style="width:80px;padding:.3rem .5rem;border:1.5px solid var(--line);border-radius:8px"> %</td>
        <td><button class="btn ghost" style="padding:.3rem .55rem" onclick="zmienKod('${esc(k)}',document.getElementById('kod_${esc(k)}').value)">💾</button>
        <button class="ci-remove" onclick="usunKod('${esc(k)}')">🗑️</button></td></tr>`).join("")}</table>`
    : `<p style="color:var(--muted2)">Brak kodów — klienci nie mają teraz żadnych rabatów.</p>`}
    <p style="font-size:.8rem;color:var(--muted2);margin-top:.8rem">Kody możesz ogłosić w pasku na górze strony (🎨 Wygląd i treści).</p>
  </div>`);
}
function dodajKod(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const kod = String(f.get("kod")).trim().toUpperCase();
  const proc = +f.get("procent");
  if(!/^[A-Z0-9]{2,20}$/.test(kod) || !(proc>=1 && proc<=90)){ toast("⚠️ Kod: 2–20 znaków (litery/cyfry), rabat 1–90%"); return; }
  KONFIG.kodyRabatowe[kod] = proc;
  zapiszCzescUstawien({kody: {...KONFIG.kodyRabatowe}});
  loguj("info",`Dodano kod rabatowy ${kod} (−${proc}%)`);
}
function usunKod(kod){
  delete KONFIG.kodyRabatowe[kod];
  if(rabat?.kod===kod) usunRabat();
  zapiszCzescUstawien({kody: {...KONFIG.kodyRabatowe}});
  loguj("info","Usunięto kod rabatowy "+kod);
}
function zmienKod(kod, procent){
  procent = +procent;
  if(!(procent>=1&&procent<=90)){ toast("Rabat musi wynosić 1–90%"); return; }
  KONFIG.kodyRabatowe[kod] = procent;
  zapiszCzescUstawien({kody:{...KONFIG.kodyRabatowe}});
  loguj("info",`Zmieniono kod ${kod} na −${procent}%`);
}

/* ── Dostawa i płatności ── */
let stanPaynowAdmin={sprawdzono:false,configured:false,env:"production",continueUrl:"",notificationUrl:"",apiBaseUrl:"",error:""};
function domyslneUrlePaynow(){
  return {notificationUrl:`${location.origin}/api/store?action=paynow-notification`, continueUrl:`${location.origin}/#/zamowienia`};
}
function paynowStatusAdminHTML(){
  const s=stanPaynowAdmin;
  if(!s.sprawdzono) return `<div class="pay-note" style="text-align:left">Kliknij „Sprawdź konfigurację Paynow”, aby zobaczyć czy Netlify ma ustawione klucze API.</div>`;
  if(s.error) return `<div class="pay-note" style="text-align:left;color:var(--danger)">Błąd sprawdzania Paynow: ${esc(s.error)}</div>`;
  return `<div class="backend-note" style="${s.configured?"border-color:#86efac;background:#f0fdf4;color:#166534":"border-color:#f59e0b;background:#fffbeb;color:#92400e"}">
    <b>${s.configured?"Paynow API skonfigurowane ✅":"Paynow API nie ma jeszcze kluczy na serwerze"}</b><br>
    Środowisko: <code>${esc(s.env||"production")}</code>${s.apiBaseUrl?` • API: <code>${esc(s.apiBaseUrl)}</code>`:""}<br>
    ${s.configured?"Klient po wybraniu Paynow dostanie automatyczny link płatności, a webhook zaktualizuje status zamówienia.":"Ustaw w Netlify zmienne PAYNOW_API_KEY i PAYNOW_SIGNATURE_KEY, potem zrób redeploy."}
  </div>`;
}
function paynowPanelAdminHTML(){
  const urls=domyslneUrlePaynow();
  return `<div class="panel">
    <h2 style="margin-top:0">💳 mBank Paynow API</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">To jest prawdziwa integracja API. Sekrety muszą być w Netlify Environment Variables, nie w HTML ani localStorage.</p>
    ${paynowStatusAdminHTML()}
    <div class="f-row" style="grid-template-columns:1fr 1fr;margin-top:1rem">
      <div class="f-group"><label>URL powiadomień / webhook Paynow</label><input readonly value="${esc(stanPaynowAdmin.notificationUrl||urls.notificationUrl)}" onclick="this.select()"></div>
      <div class="f-group"><label>URL powrotu klienta po płatności</label><input readonly value="${esc(stanPaynowAdmin.continueUrl||urls.continueUrl)}" onclick="this.select()"></div>
    </div>
    <table class="log-table" style="margin-top:.7rem">
      <tr><th>Zmienna Netlify</th><th>Co wpisać</th></tr>
      <tr><td><code>PAYNOW_API_KEY</code></td><td>Api-Key z panelu Paynow: Settings → Shops and poses → Authentication</td></tr>
      <tr><td><code>PAYNOW_SIGNATURE_KEY</code></td><td>Signature-Key z tego samego miejsca</td></tr>
      <tr><td><code>PAYNOW_ENV</code></td><td><code>production</code> dla prawdziwej sprzedaży albo <code>sandbox</code> do testów</td></tr>
      <tr><td><code>PAYNOW_CONTINUE_URL</code></td><td>Opcjonalnie: własny URL powrotu; domyślnie <code>${esc(urls.continueUrl)}</code></td></tr>
      <tr><td><code>PAYNOW_NOTIFICATION_URL</code></td><td>Opcjonalnie: własny webhook; domyślnie <code>${esc(urls.notificationUrl)}</code></td></tr>
    </table>
    <div class="diag-actions" style="margin-top:.9rem">
      <button class="btn" type="button" onclick="sprawdzPaynowKonfiguracje()">🔎 Sprawdź konfigurację Paynow</button>
      <button class="btn ghost" type="button" onclick="ustawUrlePaynow()">🔗 Ustaw URL-e w Paynow przez API</button>
      <a class="btn ghost" href="https://docs.paynow.pl/docs/v3/integration" target="_blank" rel="noopener">Dokumentacja Paynow</a>
    </div>
    <p class="pay-note" style="text-align:left;margin-top:.8rem">Po ustawieniu zmiennych w Netlify wykonaj redeploy. Dopiero wtedy przycisk „Sprawdź konfigurację” pokaże zielony status.</p>
  </div>`;
}
async function sprawdzPaynowKonfiguracje(){
  try{
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:""};
    const d=await chmura("paynow-config",{timeout:10000});
    stanPaynowAdmin={sprawdzono:true,configured:!!d.configured,env:d.env||"",continueUrl:d.continueUrl||"",notificationUrl:d.notificationUrl||"",apiBaseUrl:d.apiBaseUrl||"",error:""};
    toast(d.configured?"Paynow API skonfigurowane ✅":"Brak kluczy Paynow w Netlify");
  }catch(e){
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:e.message};
    toast("Paynow: "+e.message);
  }
  renderuj();
}
async function ustawUrlePaynow(){
  if(!chmuraToken){ chmuraUstawToken(); return; }
  try{
    toast("Ustawiam URL-e Paynow…");
    const d=await chmura("paynow-configure-urls",{method:"POST",body:domyslneUrlePaynow(),timeout:18000});
    stanPaynowAdmin={sprawdzono:true,configured:true,env:d.env||stanPaynowAdmin.env,continueUrl:d.continueUrl||"",notificationUrl:d.notificationUrl||"",apiBaseUrl:stanPaynowAdmin.apiBaseUrl,error:""};
    toast("URL-e Paynow ustawione ✅");
  }catch(e){
    stanPaynowAdmin={...stanPaynowAdmin,sprawdzono:true,error:e.message};
    toast("Nie ustawiono URL-i Paynow: "+e.message);
    loguj("blad","Paynow configure urls: "+e.message);
  }
  renderuj();
}
function emailPanelAdminHTML(){
  const e=stanBramki.email||{};
  const gotowy=!!e.configured, polaczony=gotowy&&!!chmuraToken;
  return `<div class="panel">
    <h2 style="margin-top:0">📧 Bramka e-mail SMTP / Gmail</h2>
    <p style="font-size:.9rem;color:var(--muted2);margin-bottom:.8rem">Automatyczne wiadomości wychodzą z serwera Netlify. Logowanie w Chrome do Gmaila nie wystarcza dla backendu — potrzebne jest hasło aplikacji Google albo dane SMTP zapisane jako sekrety Netlify.</p>
    <div class="backend-note" style="${gotowy?"border-color:#86efac;background:#f0fdf4;color:#166534":"border-color:#f59e0b;background:#fffbeb;color:#92400e"}">
      <b>${gotowy?"SMTP skonfigurowany ✅":"SMTP/Gmail nie jest jeszcze skonfigurowany"}</b><br>
      Nadawca: <code>${esc(e.from||"sklepartway@gmail.com")}</code> • Provider: <code>${esc(e.provider||"gmail-smtp")}</code><br>
      ${polaczony?"Panel ma hasło bazy — test i ręczne wiadomości mogą być wysyłane.":gotowy?"Wpisz hasło bazy administratora, aby wysyłać testy z panelu.":"Ustaw zmienne poniżej w Netlify i zrób redeploy."}
    </div>
    <table class="log-table" style="margin-top:.7rem">
      <tr><th>Zmienna Netlify</th><th>Wartość dla Gmail</th></tr>
      <tr><td><code>EMAIL_PROVIDER</code></td><td><code>gmail</code></td></tr>
      <tr><td><code>EMAIL_FROM</code></td><td><code>sklepartway@gmail.com</code></td></tr>
      <tr><td><code>EMAIL_FROM_NAME</code></td><td><code>Artway-TM</code></td></tr>
      <tr><td><code>SMTP_HOST</code></td><td><code>smtp.gmail.com</code></td></tr>
      <tr><td><code>SMTP_PORT</code></td><td><code>465</code></td></tr>
      <tr><td><code>SMTP_SECURE</code></td><td><code>true</code></td></tr>
      <tr><td><code>SMTP_USER</code></td><td><code>sklepartway@gmail.com</code></td></tr>
      <tr><td><code>SMTP_PASS</code></td><td>hasło aplikacji Google — nie zwykłe hasło do Gmaila</td></tr>
      <tr><td><code>EMAIL_ADMIN_TO</code></td><td>adres, na który sklep wyśle powiadomienie o nowym zamówieniu</td></tr>
    </table>
    <form onsubmit="wyslijTestEmail(event)" style="margin-top:1rem">
      <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
        <div class="f-group"><label>Wyślij test na adres</label><input type="email" name="email" value="${esc(KONFIG.emailSklepu)}" required></div>
        <div class="f-group"><button class="btn" type="submit" ${gotowy?"":"disabled"}>📧 Wyślij test</button></div>
      </div>
    </form>
    <div class="diag-actions" style="margin-top:.8rem">
      <button class="btn ghost" type="button" onclick="sprawdzBramke()">🔎 Sprawdź e-mail / Netlify</button>
      ${chmuraToken?"":`<button class="btn ghost" type="button" onclick="chmuraUstawToken()">🔑 Wpisz hasło bazy</button>`}
    </div>
  </div>`;
}
function widokAdminDostawy(){
  KONFIG.dostawy = normalizujDostawyInPost(KONFIG.dostawy);
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  const pobranie = KONFIG.platnosci.find(p=>p.id==="pobranie"), paynow = KONFIG.platnosci.find(p=>p.id==="paynow"), telefon = KONFIG.platnosci.find(p=>p.id==="telefon");
  const paczkomat = KONFIG.dostawy.find(d=>d.id==="paczkomat") || DOMYSLNA_DOSTAWA_INPOST;
  const kurierInpost = KONFIG.dostawy.find(d=>d.id==="kurier_inpost") || DOMYSLNA_DOSTAWA_INPOST_KURIER;
  return personalizacjaSzkielet("dostawy", `
  <div class="panel">
    <h1>🚚 Dostawa i płatności</h1>
    <form onsubmit="zapiszDostawy(event)">
      <h3 class="f-sekcja">🚚 Dostawy InPost</h3>
      <div class="backend-note" style="border-color:#facc15;background:#fffbeb;color:#713f12"><b>Aktywne są tylko metody InPost:</b> Paczkomat/Punkt InPost oraz Kurier InPost. Inni przewoźnicy i odbiór osobisty pozostają wyłączone.</div>
      <div class="f-row" style="grid-template-columns:1fr 1fr 1fr">
        <div class="f-group"><label>Paczkomat InPost (zł)</label><input name="kosztPaczkomat" inputmode="decimal" value="${paczkomat.koszt}"></div>
        <div class="f-group"><label>Kurier InPost (zł)</label><input name="kosztKurierInpost" inputmode="decimal" value="${kurierInpost.koszt}"><small style="color:var(--muted2)">Cena widoczna w koszyku, zamówieniach, e-mailach i eksportach.</small></div>
        <div class="f-group"><label>Darmowa dostawa od (zł)</label><input name="darmowaDostawaOd" inputmode="decimal" value="${KONFIG.darmowaDostawaOd}"></div>
      </div>
      <div class="backend-note"><b>Dla klienta dostępne są zawsze dokładnie dwie metody:</b> Paczkomat/Punkt InPost oraz Kurier InPost. Ceny ustawiasz powyżej, bez edycji kodu strony.</div>
      <div class="f-group" style="max-width:320px"><label>Deklarowany czas wysyłki — zmienia się wszędzie</label><input name="czasWysylki" value="${esc(czasWysylki())}" placeholder="np. 24 h, 48 h, 2 dni robocze"></div>
      <h3 class="f-sekcja">💳 Płatności i bramka</h3>
      <div class="f-group"><label>Awaryjny ręczny link mBank Paynow (opcjonalnie — gdy API nie jest jeszcze skonfigurowane)</label>
        <input name="linkPlatnosci" placeholder="https://paynow.pl/… albo link płatności z panelu" value="${esc(KONFIG.linkPlatnosci)}"></div>
      <div class="f-group" style="max-width:260px"><label>Numer do przelewu na telefon</label>
        <input name="numerPrzelewuTelefon" inputmode="tel" value="${esc(formatTelefonPlatnosci())}"></div>
      <div class="f-row">
        <label class="chk-row"><input type="checkbox" name="pobranieWl" ${pobranie.wylaczona?"":"checked"}> 💵 Za pobraniem włączone</label>
        <label class="chk-row"><input type="checkbox" name="paynowWl" ${paynow.wylaczona?"":"checked"}> 💳 mBank Paynow włączony</label>
        <label class="chk-row"><input type="checkbox" name="telefonWl" ${telefon.wylaczona?"":"checked"}> 📱 Przelew na telefon włączony</label>
      </div>
      <div class="f-group" style="max-width:220px"><label>Opłata za pobranie (zł)</label><input name="oplataPobranie" inputmode="decimal" value="${pobranie.oplata}"></div>
      <div class="diag-actions">
        <button class="btn" type="submit">💾 Zapisz</button>
        <button class="btn danger" type="button" onclick="resetujUstawienia()">↩️ Przywróć wszystkie domyślne</button>
      </div>
	    </form>
	  </div>
	  ${paynowPanelAdminHTML()}
	  ${emailPanelAdminHTML()}
  <div class="panel">
    <h2 style="margin-top:0">➕ Dodatkowa metoda płatności</h2>
    <form onsubmit="dodajMetodePlatnosci(event)">
      <div class="f-row admin-three">
        <div class="f-group"><label>Nazwa</label><input required name="nazwa" placeholder="np. Płatność przy odbiorze osobistym"></div>
        <div class="f-group"><label>Opłata (zł)</label><input required name="oplata" inputmode="decimal" value="0"></div>
        <div class="f-group"><button class="btn" type="submit">➕ Dodaj</button></div>
      </div>
    </form>
    ${KONFIG.platnosci.filter(p=>!["pobranie","paynow","telefon","przelew","online"].includes(p.id)).length?`
      <table class="log-table"><tr><th>Metoda</th><th>Opłata</th><th></th></tr>
      ${KONFIG.platnosci.filter(p=>!["pobranie","paynow","telefon","przelew","online"].includes(p.id)).map(p=>`<tr><td><b>${esc(p.nazwa)}</b></td><td>${p.oplata?zl(p.oplata):"bez opłaty"}</td><td><button class="ci-remove" onclick="usunMetodePlatnosci('${p.id}')">🗑️</button></td></tr>`).join("")}</table>`:""}
  </div>`);
}
function zapiszDostawy(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const numer = tylkoCyfry(f.get("numerPrzelewuTelefon") || NUMER_PRZELEWU_TELEFON_DOMYSLNY);
  const platnosci = normalizujPlatnosci(KONFIG.platnosci).map(p=>({...p}));
  platnosci.forEach(p=>{
    if(p.id==="pobranie"){ p.oplata = +(parseFloat(String(f.get("oplataPobranie")).replace(",","."))||0).toFixed(2); p.wylaczona = !f.get("pobranieWl"); }
    if(p.id==="paynow") p.wylaczona = !f.get("paynowWl");
    if(p.id==="telefon"){ p.wylaczona = !f.get("telefonWl"); p.nazwa = `Przelew na telefon ${formatTelefonPlatnosci(numer)}`; }
  });
  zapiszCzescUstawien({
    linkPlatnosci: String(f.get("linkPlatnosci")).trim(),
    numerPrzelewuTelefon: numer,
    czasWysylki: String(f.get("czasWysylki")||"").trim(),
    darmowaDostawaOd: f.get("darmowaDostawaOd"),
    kurierInpostAktywny: true,
    kosztPaczkomat: f.get("kosztPaczkomat"),
    kosztKurierInpost: f.get("kosztKurierInpost"),
    dostawy: normalizujDostawyInPost([
      {...DOMYSLNA_DOSTAWA_INPOST,koszt:(()=>{const n=Number(String(f.get("kosztPaczkomat")).replace(",","."));return Number.isFinite(n)?n:DOMYSLNA_DOSTAWA_INPOST.koszt;})()},
      {...DOMYSLNA_DOSTAWA_INPOST_KURIER,koszt:(()=>{const n=Number(String(f.get("kosztKurierInpost")).replace(",","."));return Number.isFinite(n)?n:DOMYSLNA_DOSTAWA_INPOST_KURIER.koszt;})()}
    ]),
    oplataPobranie: f.get("oplataPobranie"),
    pobranieWl: !!f.get("pobranieWl"),
    paynowWl: !!f.get("paynowWl"),
    telefonWl: !!f.get("telefonWl"),
    platnosci
  });
}
function dodajMetodeDostawy(e){
  e.preventDefault();
  KONFIG.dostawy=normalizujDostawyInPost(KONFIG.dostawy);
  zapiszCzescUstawien({dostawy:KONFIG.dostawy.map(x=>({...x}))});
  toast("Dodatkowe metody dostawy są wyłączone — sklep wysyła tylko przez InPost");
  loguj("info","Zablokowano dodanie dodatkowej metody dostawy — aktywny tylko InPost");
}
function usunMetodeDostawy(id){
  KONFIG.dostawy=normalizujDostawyInPost(KONFIG.dostawy);
  zapiszCzescUstawien({dostawy:KONFIG.dostawy.map(x=>({...x}))});
  loguj("info","Znormalizowano metody dostawy do InPost");
}
function dodajMetodePlatnosci(e){
  e.preventDefault();
  const f = new FormData(e.target), oplata=parseFloat(String(f.get("oplata")).replace(",","."));
  if(!(oplata>=0)){ toast("Podaj poprawną opłatę"); return; }
  const p={id:"wlasna_p_"+Date.now(),nazwa:String(f.get("nazwa")).trim(),oplata:+oplata.toFixed(2)};
  KONFIG.platnosci=[...KONFIG.platnosci,p];
  zapiszCzescUstawien({platnosci:KONFIG.platnosci.map(x=>({...x}))});
  loguj("info","Dodano metodę płatności: "+p.nazwa);
}
function usunMetodePlatnosci(id){
  KONFIG.platnosci=KONFIG.platnosci.filter(p=>p.id!==id);
  zapiszCzescUstawien({platnosci:KONFIG.platnosci.map(x=>({...x}))});
  loguj("info","Usunięto dodatkową metodę płatności");
}

/* ── Wygląd i treści ── */
function widokAdminWyglad(){
  const u=ustawienia.uklad||{}, h=ustawienia.hero||{};
  const df=daneFirmy();
  return personalizacjaSzkielet("wyglad", `
  <div class="panel">
    <h1>🎨 Zaawansowany układ globalny</h1>
    <p style="font-size:.86rem;color:var(--muted2);margin-bottom:1rem">Ustawienia działają na całym sklepie. Kolorystyka pozostaje bez zmian.</p>
    <form onsubmit="zapiszWyglad(event)">
      <h3 class="f-sekcja">🏪 Sklep</h3>
      <div class="f-row">
        <div class="f-group"><label>Nazwa sklepu (logo)</label><input name="nazwaSklepu" value="${esc(KONFIG.nazwaSklepu)}"></div>
        <div class="f-group"><label>Telefon (stopka i kontakt)</label><input name="telefon" value="${esc(KONFIG.telefon)}"></div>
      </div>
      <div class="f-group"><label>E-mail sklepu (zamówienia i kontakt)</label><input name="emailSklepu" type="email" value="${esc(KONFIG.emailSklepu)}"></div>
      <h3 class="f-sekcja">🏢 Dane firmy do regulaminu i polityki prywatności</h3>
      <div class="f-row">
        <div class="f-group"><label>Nazwa firmy / sklepu</label><input name="firmaNazwa" value="${esc(df.nazwa)}"></div>
        <div class="f-group"><label>NIP firmy</label><input name="firmaId" inputmode="numeric" maxlength="10" value="${esc(df.nip||df.identyfikator)}"></div>
      </div>
      <div class="f-group"><label>Adres firmy (opcjonalnie)</label><input name="firmaAdres" value="${esc(df.adres||"")}" placeholder="Ulica, kod pocztowy, miejscowość"></div>
      <div class="f-group"><label>Logo graficzne (zamiast nazwy tekstowej)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          ${ustawienia.logoObraz?`<img src="${ustawienia.logoObraz}" alt="Podgląd logo sklepu" style="height:36px;max-width:190px;object-fit:contain;border-radius:6px;background:var(--bg);padding:2px 6px">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — wyświetlana jest nazwa tekstowa</span>`}
          ${polePlikuHTML("wgrajLogo(this)", "Wgraj logo")}
          ${ustawienia.logoObraz?`<button class="btn danger" type="button" onclick="usunLogo()">🗑️ Usuń logo</button>`:""}
        </div>
      </div>
      <div class="f-group"><label>Miniaturka w zakładce przeglądarki (favicon)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          <img src="${esc(ustawienia.faviconObraz||domyslnyFavicon())}" alt="Podgląd ikony karty przeglądarki" style="width:34px;height:34px;object-fit:cover;border-radius:8px;border:1px solid var(--line);background:var(--bg);padding:2px">
          ${polePlikuHTML("wgrajFavicon(this)", "Wgraj miniaturkę")}
          ${ustawienia.faviconObraz?`<button class="btn danger" type="button" onclick="usunFavicon()">🗑️ Usuń miniaturkę</button>`:""}
          <small style="color:var(--muted2)">Najlepiej kwadrat PNG/JPG. Zmieni ikonę w karcie przeglądarki.</small>
        </div>
      </div>
      <div class="f-group"><label>Pasek na górze strony (może zawierać HTML, np. &lt;b&gt;)</label><input name="pasekInfo" value="${esc(pasekInfoHTML())}"></div>
      <div class="f-group" style="max-width:320px"><label>Czas wysyłki używany na całej stronie</label><input name="czasWysylki" value="${esc(czasWysylki())}" placeholder="np. 24 h, 48 h, 2 dni robocze"></div>
      <div class="f-group"><label>Tekst w wyszukiwarce</label><input name="tekstSzukaj" value="${esc(ustawienia.tekstSzukaj||"Szukaj produktu…")}"></div>
      <h3 class="f-sekcja">🖼️ Baner na stronie głównej</h3>
      <div class="f-group"><label>Mała etykieta nad tytułem</label><input name="heroEtykieta" value="${esc(h.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}"></div>
      <div class="f-group"><label>Tytuł banera</label><input name="heroTytul" value="${esc(KONFIG.heroTytul)}"></div>
      <div class="f-group"><label>Opis banera</label><textarea name="heroOpis" rows="2">${esc(KONFIG.heroOpis)}</textarea></div>
      <div class="f-row">
        <div class="f-group"><label>Tekst pierwszego przycisku</label><input name="heroPrzycisk1" value="${esc(h.przycisk1||"Zobacz ofertę")}"></div>
        <div class="f-group"><label>Tekst drugiego przycisku</label><input name="heroPrzycisk2" value="${esc(h.przycisk2||"Sprawdź promocje")}"></div>
      </div>
      <div class="f-group"><label>Link drugiego przycisku</label><input name="heroLink2" value="${esc(h.link2||"#/promocje")}" placeholder="#/promocje lub https://…"></div>
      <div class="f-group"><label>Zdjęcie tła baneru (opcjonalnie — z przyciemnieniem, tekst zostaje czytelny)</label>
        <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
          ${h.obraz?`<img src="${h.obraz}" alt="Podgląd tła banera głównego" style="width:150px;height:60px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — kolorowy gradient</span>`}
          ${polePlikuHTML("wgrajTloHero(this)", "Wgraj tło")}
          ${h.obraz?`<button class="btn danger" type="button" onclick="usunTloHero()">🗑️ Usuń tło</button>`:""}
        </div>
      </div>
      <h3 class="f-sekcja">🎁 Pasek okazji (sekcja strony głównej)</h3>
      <div class="f-row">
        <div class="f-group"><label>Tytuł</label><input name="okazjaTytul" value="${esc(ustawienia.pasekOkazji?.tytul||"Dobry moment na zakupy")}"></div>
        <div class="f-group"><label>Tekst przycisku</label><input name="okazjaTekstLinku" value="${esc(ustawienia.pasekOkazji?.tekstLinku||"Zobacz okazje")}"></div>
      </div>
      <div class="f-group"><label>Opis (np. z aktualnym kodem rabatowym)</label><input name="okazjaOpis" value="${esc(ustawienia.pasekOkazji?.opis||"")}" placeholder="Użyj kodu START10 w koszyku i odbierz 10% rabatu na zamówienie."></div>
      <div class="f-group"><label>Link przycisku</label><input name="okazjaLink" value="${esc(ustawienia.pasekOkazji?.link||"#/promocje")}"></div>
      <p style="font-size:.82rem;margin:-.3rem 0 1rem"><a href="#/admin/bannery">Zarządzaj dodatkowymi banerami →</a> • <a href="#/admin/rozmieszczenie">Zmień kolejność sekcji →</a></p>
      <h3 class="f-sekcja">📐 Szerokość i gęstość</h3>
      <div class="settings-grid">
        <div class="setting-box"><h3>Szerokość strony</h3><select name="szerokosc" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="1100px" ${u.szerokosc==="1100px"?"selected":""}>Kompaktowa — 1100 px</option>
          <option value="1200px" ${!u.szerokosc||u.szerokosc==="1200px"?"selected":""}>Standardowa — 1200 px</option>
          <option value="1400px" ${u.szerokosc==="1400px"?"selected":""}>Szeroka — 1400 px</option>
        </select></div>
        <div class="setting-box"><h3>Karty produktów</h3><select name="kartaMin" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="200px" ${u.kartaMin==="200px"?"selected":""}>Więcej kart w rzędzie</option>
          <option value="240px" ${!u.kartaMin||u.kartaMin==="240px"?"selected":""}>Standardowe</option>
          <option value="280px" ${u.kartaMin==="280px"?"selected":""}>Duże karty</option>
        </select></div>
        <div class="setting-box"><h3>Odstępy</h3><select name="gestosc" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="compact" ${u.gestosc==="compact"?"selected":""}>Kompaktowe</option>
          <option value="standard" ${!u.gestosc||u.gestosc==="standard"?"selected":""}>Standardowe</option>
          <option value="comfortable" ${u.gestosc==="comfortable"?"selected":""}>Przestronne</option>
        </select></div>
        <div class="setting-box"><h3>Zaokrąglenia</h3><select name="promien" style="width:100%;padding:.5rem;border:1.5px solid var(--line);border-radius:9px">
          <option value="10px" ${u.promien==="10px"?"selected":""}>Małe</option>
          <option value="16px" ${!u.promien||u.promien==="16px"?"selected":""}>Standardowe</option>
          <option value="22px" ${u.promien==="22px"?"selected":""}>Duże</option>
        </select></div>
      </div>
      <h3 class="f-sekcja">🧩 Widoczność sekcji strony głównej</h3>
      <div class="settings-grid">
        <label class="chk-row"><input type="checkbox" name="sekcjaKategorie" ${u.sekcjaKategorie===false?"":"checked"}> Katalogi produktów</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaKroki" ${u.sekcjaKroki===false?"":"checked"}> Jak kupić — 4 kroki</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaOnas" ${u.sekcjaOnas===false?"":"checked"}> Sekcja o sklepie</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaFaq" ${u.sekcjaFaq===false?"":"checked"}> FAQ na stronie głównej</label>
        <label class="chk-row"><input type="checkbox" name="sekcjaKontakt" ${u.sekcjaKontakt===false?"":"checked"}> Końcowa sekcja kontaktu</label>
        <label class="chk-row"><input type="checkbox" name="pasekInfoWidoczny" ${u.pasekInfoWidoczny===false?"":"checked"}> Pasek informacyjny u góry</label>
        <label class="chk-row"><input type="checkbox" name="statycznyNaglowek" ${u.statycznyNaglowek?"checked":""}> Nagłówek niesticky</label>
      </div>
      <h3 class="f-sekcja">📃 Stopka</h3>
      <div class="f-group"><label>Opis sklepu w stopce</label><textarea name="opisSklepu" rows="2">${esc(KONFIG.opisSklepu)}</textarea></div>
      <div class="f-group"><label>Dolny tekst stopki</label><input name="stopkaCopy" value="${esc(ustawienia.stopkaCopy||`© ${new Date().getFullYear()} ${KONFIG.nazwaSklepu}. Wszystkie prawa zastrzeżone.`)}"></div>
      <h3 class="f-sekcja">🔎 SEO i tytuł przeglądarki</h3>
      <div class="f-group"><label>Tytuł strony w Google i karcie przeglądarki</label><input name="seoTytul" value="${esc(ustawienia.seo?.tytul||KONFIG.nazwaSklepu+" — Sklep internetowy")}"></div>
      <div class="f-group"><label>Opis strony dla wyszukiwarek</label><textarea name="seoOpis" rows="2">${esc(ustawienia.seo?.opis||"Sklep wielobranżowy Artway-TM. Elektronika, dom i ogród, narzędzia, odzież i sport.")}</textarea></div>
      <div class="diag-actions"><button class="btn" type="submit">💾 Zapisz cały układ</button><button class="btn ghost" type="button" onclick="eksportujIndexHTML()">⬇️ Pobierz publiczny index.html</button><a class="btn ghost" href="#/">👁️ Podgląd sklepu</a></div>
    </form>
  </div>`);
}
function zapiszWyglad(e){
  e.preventDefault();
  const f = new FormData(e.target);
  zapiszCzescUstawien({
    nazwaSklepu: String(f.get("nazwaSklepu")).trim(),
    telefon: String(f.get("telefon")).trim(),
    emailSklepu: String(f.get("emailSklepu")).trim(),
    daneFirmy:{
      nazwa:String(f.get("firmaNazwa")||"Artway-TM").trim()||"Artway-TM",
      identyfikator:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      nip:tylkoCyfry(f.get("firmaId")||DANE_FIRMY_DOMYSLNE.identyfikator),
      adres:String(f.get("firmaAdres")||"").trim()
    },
    pasekInfo: String(f.get("pasekInfo")),
    czasWysylki: String(f.get("czasWysylki")||"").trim(),
    heroTytul: String(f.get("heroTytul")).trim(),
    heroOpis: String(f.get("heroOpis")).trim(),
    opisSklepu: String(f.get("opisSklepu")).trim(),
    tekstSzukaj:String(f.get("tekstSzukaj")).trim(),
    stopkaCopy:String(f.get("stopkaCopy")).trim(),
    seo:{tytul:String(f.get("seoTytul")).trim(),opis:String(f.get("seoOpis")).trim()},
    hero:{
      ...(ustawienia.hero||{}),   // zachowaj wgrane tło (obraz)
      etykieta:String(f.get("heroEtykieta")).trim(),
      przycisk1:String(f.get("heroPrzycisk1")).trim(),
      przycisk2:String(f.get("heroPrzycisk2")).trim(),
      link2:String(f.get("heroLink2")).trim()
    },
    pasekOkazji:{
      tytul:String(f.get("okazjaTytul")||"").trim(),
      opis:String(f.get("okazjaOpis")||"").trim(),
      tekstLinku:String(f.get("okazjaTekstLinku")||"").trim(),
      link:bezpiecznyLink(String(f.get("okazjaLink")||"#/promocje").trim())
    },
    uklad:{
      szerokosc:String(f.get("szerokosc")),
      kartaMin:String(f.get("kartaMin")),
      gestosc:String(f.get("gestosc")),
      promien:String(f.get("promien")),
      sekcjaKategorie:!!f.get("sekcjaKategorie"),
      sekcjaKroki:!!f.get("sekcjaKroki"),
      sekcjaOnas:!!f.get("sekcjaOnas"),
      sekcjaFaq:!!f.get("sekcjaFaq"),
      sekcjaKontakt:!!f.get("sekcjaKontakt"),
      pasekInfoWidoczny:!!f.get("pasekInfoWidoczny"),
      statycznyNaglowek:!!f.get("statycznyNaglowek")
    }
  });
}

/* ── 📁 OBRAZKI Z DYSKU (bez hostingu zdjęć) ──
   Wgrywane pliki są zmniejszane i zapisywane w ustawieniach sklepu
   (data-URL). Trafiają też do eksportowanego index.html — więc po
   publikacji klienci widzą Twoje grafiki. Limit ~1 MB po kompresji. */
function wgrajObrazek(input, maxSzer, poWgraniu){
  const plik = input.files && input.files[0];
  if(!plik) return;
  if(!plik.type.startsWith("image/")){ toast("⚠️ Wybierz plik graficzny (JPG/PNG)"); return; }
  const czytnik = new FileReader();
  czytnik.onload = () => {
    const img = new Image();
    img.onload = () => {
      try{
        const skala = Math.min(1, maxSzer / img.width);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * skala));
        c.height = Math.max(1, Math.round(img.height * skala));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const png = plik.type === "image/png" && plik.size < 300_000;   // małe PNG (logo) bez utraty przezroczystości
        let dataUrl = png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82);
        if(dataUrl.length > 900_000) dataUrl = c.toDataURL("image/jpeg", 0.6);
        if(dataUrl.length > 1_200_000){ toast("⚠️ Obrazek za duży nawet po kompresji — wybierz mniejszy"); return; }
        poWgraniu(dataUrl);
      }catch(b){ loguj("blad","Kompresja obrazka nie powiodła się: "+b.message); toast("⚠️ Nie udało się przetworzyć obrazka"); }
    };
    img.onerror = () => { toast("⚠️ Nie udało się odczytać obrazka"); loguj("ostrzezenie","Błąd odczytu wgrywanego obrazka"); };
    img.src = czytnik.result;
  };
  czytnik.readAsDataURL(plik);
}
function polePlikuHTML(onchange, etykieta){
  return `<label class="btn ghost" style="cursor:pointer;white-space:nowrap">📁 ${etykieta||"Wgraj z dysku"}<input type="file" accept="image/*" style="display:none" onchange="${onchange}"></label>`;
}
/* banery */
function wgrajObrazBanera(input, id){
  wgrajObrazek(input, 1200, url => {
    zapiszCzescUstawien({bannery: pobierzBannery().map(x=>x.id===id?{...x, obraz:url}:x)});
    loguj("info","Wgrano obrazek banera "+id);
  });
}
function usunObrazBanera(id){
  zapiszCzescUstawien({bannery: pobierzBannery().map(x=>{ const {obraz, ...reszta}=x; return x.id===id?reszta:x; })});
}
/* logo sklepu */
function wgrajLogo(input){ wgrajObrazek(input, 420, url => zapiszCzescUstawien({logoObraz:url})); }
function usunLogo(){ zapiszCzescUstawien({logoObraz:null}); }
/* miniaturka karty przeglądarki */
function wgrajFavicon(input){ wgrajObrazek(input, 96, url => zapiszCzescUstawien({faviconObraz:url})); }
function usunFavicon(){ zapiszCzescUstawien({faviconObraz:null}); }
/* tło baneru głównego */
function wgrajTloHero(input){ wgrajObrazek(input, 1600, url => zapiszCzescUstawien({hero:{...(ustawienia.hero||{}), obraz:url}})); }
function usunTloHero(){ const {obraz, ...h}=(ustawienia.hero||{}); zapiszCzescUstawien({hero:h}); }
/* zdjęcie produktu (wpisuje się do pola formularza) */
function wgrajZdjecieProduktu(input){
  wgrajObrazek(input, 900, url => {
    const form = input.closest ? input.closest("form") : input.form;
    const pole = form && form.zdjecie;
    if(pole) pole.value = url;
    const pg = $("podgladZdjecia");
    if(pg) pg.innerHTML = `<img src="${url}" alt="Podgląd zdjęcia produktu" style="width:90px;height:90px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">`;
    toast("Zdjęcie wgrane — kliknij Zapisz/Dodaj, aby zachować ✅");
  });
}

/* ── Wiele banerów ── */
function widokAdminBannery(){
  const bannery=pobierzBannery();
  return personalizacjaSzkielet("bannery",`
  <div class="panel">
    <h1>🖼️ Zarządzanie banerami</h1>
    <p style="font-size:.86rem;color:var(--muted2)">Banery pojawiają się pod głównym banerem strony. Możesz je dodawać, edytować, wyłączać, usuwać i zmieniać kolejność.</p>
    <form onsubmit="dodajBaner(event)" class="admin-banner">
      <div class="admin-banner-head"><b>➕ Nowy baner</b><span class="lvl lvl-info">${bannery.length}/8</span></div>
      <div class="f-row">
        <div class="f-group"><label>Tytuł</label><input required name="tytul" placeholder="Np. Wakacyjna promocja"></div>
        <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona","📣","📣")}</div>
      </div>
      <div class="f-group"><label>Opis</label><input name="opis" placeholder="Krótki opis banera"></div>
      <div class="f-row">
        <div class="f-group"><label>Tekst przycisku</label><input name="przycisk" value="Dowiedz się więcej"></div>
        <div class="f-group"><label>Link</label><input name="link" value="#/promocje" placeholder="#/promocje lub https://…"></div>
      </div>
      <button class="btn" type="submit" ${bannery.length>=8?"disabled":""}>➕ Dodaj baner</button>
    </form>
  </div>
  <div class="panel">
    <div class="admin-banner-head"><h2 style="margin:0">Aktywne i zapisane banery</h2><div><button class="btn ghost" onclick="eksportujIndexHTML()">⬇️ Publiczny index.html</button><button class="btn ghost" onclick="resetujBannery()">↩️ Domyślne</button></div></div>
    ${bannery.length?bannery.map((b,i)=>`
      <form class="admin-banner" onsubmit="zapiszBaner(event,'${b.id}')">
        <div class="admin-banner-head">
          <b>${esc(b.ikona||"📣")} Baner ${i+1}</b>
          <div>
            <button class="btn ghost" type="button" onclick="przesunBaner('${b.id}',-1)" ${i===0?"disabled":""}>↑</button>
            <button class="btn ghost" type="button" onclick="przesunBaner('${b.id}',1)" ${i===bannery.length-1?"disabled":""}>↓</button>
          </div>
        </div>
        <div class="f-row">
          <div class="f-group"><label>Tytuł</label><input required name="tytul" value="${esc(b.tytul||"")}"></div>
          <div class="f-group"><label>Ikona</label>${emojiPoleHTML("ikona",b.ikona||"📣","📣")}</div>
        </div>
        <div class="f-group"><label>Opis</label><input name="opis" value="${esc(b.opis||"")}"></div>
        <div class="f-row">
          <div class="f-group"><label>Tekst przycisku</label><input name="przycisk" value="${esc(b.przycisk||"")}"></div>
          <div class="f-group"><label>Link</label><input name="link" value="${esc(b.link||"#/")}"></div>
        </div>
        <div class="f-group"><label>Obrazek banera (opcjonalnie — zastępuje ikonę, tekst zostaje)</label>
          <div style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap">
            ${b.obraz?`<img src="${b.obraz}" alt="Podgląd obrazu banera" style="width:130px;height:58px;object-fit:cover;border-radius:9px;border:1px solid var(--line)">`:`<span style="font-size:.8rem;color:var(--muted2)">brak — baner z ikoną</span>`}
            ${polePlikuHTML(`wgrajObrazBanera(this,'${b.id}')`, "Wgraj obrazek")}
            ${b.obraz?`<button class="btn danger" type="button" onclick="usunObrazBanera('${b.id}')">🗑️ Usuń obrazek</button>`:""}
          </div>
        </div>
        <div class="diag-actions">
          <label class="chk-row"><input type="checkbox" name="aktywny" ${b.aktywny===false?"":"checked"}> Widoczny na stronie</label>
          <button class="btn" type="submit">💾 Zapisz</button>
          <button class="btn danger" type="button" onclick="if(confirm('Usunąć ten baner?')) usunBaner('${b.id}')">🗑️ Usuń</button>
        </div>
      </form>`).join(""):`<p>Brak banerów. Dodaj pierwszy powyżej.</p>`}
    <p><a class="btn ghost" href="#/">👁️ Zobacz banery na stronie</a></p>
  </div>`);
}
function daneBanera(f,id){
  return {id,ikona:String(f.get("ikona")||"📣").trim()||"📣",tytul:String(f.get("tytul")||"").trim(),
    opis:String(f.get("opis")||"").trim(),przycisk:String(f.get("przycisk")||"").trim()||"Dowiedz się więcej",
    link:bezpiecznyLink(String(f.get("link")||"#/").trim()),aktywny:!!f.get("aktywny")};
}
function dodajBaner(e){
  e.preventDefault(); const lista=pobierzBannery();
  if(lista.length>=8){toast("Możesz mieć maksymalnie 8 banerów");return;}
  const f=new FormData(e.target), b=daneBanera(f,"b_"+Date.now()); b.aktywny=true;
  zapiszCzescUstawien({bannery:[...lista,b]}); loguj("info","Dodano baner: "+b.tytul);
}
function zapiszBaner(e,id){
  e.preventDefault(); const b=daneBanera(new FormData(e.target),id);
  const stary = pobierzBannery().find(x=>x.id===id);
  if(stary?.obraz) b.obraz = stary.obraz;   // zachowaj wgrany obrazek
  zapiszCzescUstawien({bannery:pobierzBannery().map(x=>x.id===id?b:x)});
  loguj("info","Zapisano baner: "+b.tytul);
}
function usunBaner(id){ zapiszCzescUstawien({bannery:pobierzBannery().filter(x=>x.id!==id)}); loguj("info","Usunięto baner "+id); }
function przesunBaner(id,kierunek){
  const lista=pobierzBannery(), i=lista.findIndex(x=>x.id===id), j=i+kierunek;
  if(i<0||j<0||j>=lista.length)return;
  [lista[i],lista[j]]=[lista[j],lista[i]];
  zapiszCzescUstawien({bannery:lista});
}
function resetujBannery(){ zapiszCzescUstawien({bannery:DOMYSLNE_BANNERY.map(x=>({...x}))}); }

/* ── Układ każdej podstrony ── */
function widokAdminPodstrony(){
  return personalizacjaSzkielet("podstrony",`
  <div class="panel">
    <div class="admin-banner-head"><div><h1>🧱 Układ i nagłówki podstron</h1><p style="font-size:.86rem;color:var(--muted2)">Każda podstrona ma osobny tytuł, opis, szerokość, styl panelu i widoczność.</p></div>
      <div><button class="btn ghost" onclick="eksportujIndexHTML()">⬇️ Publiczny index.html</button><button class="btn ghost" onclick="resetujPodstrony()">↩️ Domyślne</button></div></div>
  </div>
  ${Object.entries(DOMYSLNE_PODSTRONY).map(([id,d])=>{const u=ustawieniaPodstrony(id);return `
    <form class="panel" style="margin-bottom:1rem" onsubmit="zapiszPodstrone(event,'${id}')">
      <div class="admin-banner-head"><h2 style="margin:0">${esc(d.nazwa)}</h2><a href="#/${id==="onas"?"o-nas":id}" class="btn ghost">👁️ Podgląd</a></div>
      <div class="f-group"><label>Tytuł strony</label><input required name="tytul" value="${esc(u.tytul)}"></div>
      <div class="f-group"><label>Opis pod tytułem</label><textarea name="opis" rows="2">${esc(u.opis||"")}</textarea></div>
      <div class="f-row">
        <div class="f-group"><label>Szerokość</label><select name="szerokosc">
          <option value="compact" ${u.szerokosc==="compact"?"selected":""}>Kompaktowa</option>
          <option value="standard" ${u.szerokosc==="standard"?"selected":""}>Standardowa</option>
          <option value="wide" ${u.szerokosc==="wide"?"selected":""}>Szeroka</option>
        </select></div>
        <div class="f-group"><label>Styl zawartości</label><select name="styl">
          <option value="panel" ${u.styl==="panel"?"selected":""}>Panel z cieniem</option>
          <option value="plain" ${u.styl==="plain"?"selected":""}>Prosty panel z ramką</option>
        </select></div>
      </div>
      <h3 class="f-sekcja">🧭 Rozmieszczenie sekcji tej podstrony</h3>
      <div style="display:grid;gap:.4rem;margin-bottom:.8rem">
        ${kolejnoscSekcjiPodstrony(id).map((sid,i)=>{const s=SEKCJE_PODSTRONY[sid], wid=sekcjaPodstronyWidoczna(id,sid);return `
        <div class="uklad-box ${wid?'':'wylaczona'}" style="margin-bottom:0">
          <span class="uklad-nr">${i+1}</span>
          <span style="flex:1"><b>${s.ikona} ${esc(s.nazwa)}</b></span>
          <button class="btn ghost uklad-btn" type="button" ${i===0?"disabled":""} onclick="przesunSekcjePodstrony('${id}','${sid}',-1)">↑</button>
          <button class="btn ghost uklad-btn" type="button" ${i===kolejnoscSekcjiPodstrony(id).length-1?"disabled":""} onclick="przesunSekcjePodstrony('${id}','${sid}',1)">↓</button>
          <button class="btn ghost uklad-btn" type="button" onclick="przelaczSekcjePodstrony('${id}','${sid}')">${wid?"👁️":"🙈"}</button>
        </div>`;}).join("")}
      </div>
      <div class="diag-actions"><label class="chk-row"><input type="checkbox" name="widoczna" ${u.widoczna===false?"":"checked"} ${id==="logowanie"?"disabled":""}> ${id==="logowanie"?"Logowanie zawsze dostępne":"Widoczna dla klientów"}</label><button class="btn" type="submit">💾 Zapisz podstronę</button></div>
    </form>`;}).join("")}`);
}
function zapiszPodstrone(e,id){
  e.preventDefault(); const f=new FormData(e.target);
  const podstrony={...(ustawienia.podstrony||{})};
  const poprzednia=podstrony[id]||{};
  podstrony[id]={...poprzednia,tytul:String(f.get("tytul")).trim(),opis:String(f.get("opis")||"").trim(),
    szerokosc:String(f.get("szerokosc")),styl:String(f.get("styl")),widoczna:id==="logowanie"?true:!!f.get("widoczna")};
  zapiszCzescUstawien({podstrony}); loguj("info","Zapisano układ podstrony "+id);
}
function przesunSekcjePodstrony(id,sekcja,kierunek){
  const podstrony={...(ustawienia.podstrony||{})};
  const u={...ustawieniaPodstrony(id)};
  const k=kolejnoscSekcjiPodstrony(id);
  const i=k.indexOf(sekcja), j=i+kierunek;
  if(i<0||j<0||j>=k.length)return;
  [k[i],k[j]]=[k[j],k[i]];
  podstrony[id]={...u,sekcjeOrder:k};
  zapiszCzescUstawien({podstrony});
}
function przelaczSekcjePodstrony(id,sekcja){
  const podstrony={...(ustawienia.podstrony||{})};
  const u={...ustawieniaPodstrony(id)};
  const uk=new Set(Array.isArray(u.sekcjeUkryte)?u.sekcjeUkryte:[]);
  uk.has(sekcja)?uk.delete(sekcja):uk.add(sekcja);
  podstrony[id]={...u,sekcjeUkryte:[...uk]};
  zapiszCzescUstawien({podstrony});
}
function resetujPodstrony(){ zapiszCzescUstawien({podstrony:{}}); }

/* ── Strony informacyjne (regulamin itd.) ── */
function widokAdminStrony(){
  const t = KONFIG.tresci || {};
  return personalizacjaSzkielet("strony", `
  <div class="panel">
    <h1>📄 Treści prawne</h1>
    <p style="font-size:.85rem;color:var(--muted2);margin-bottom:.8rem">Własna treść zastępuje szablon. Możesz używać HTML (&lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;…). Puste pole = wraca szablon domyślny.</p>
    <form onsubmit="zapiszStrony(event)">
      <div class="f-group"><label>📜 Regulamin (<a href="#/regulamin" target="_self">podgląd</a>)</label><textarea name="regulamin" rows="7" placeholder="Puste = szablon domyślny">${esc(t.regulamin||"")}</textarea></div>
      <div class="f-group"><label>🔒 Polityka prywatności (<a href="#/prywatnosc">podgląd</a>)</label><textarea name="prywatnosc" rows="7" placeholder="Puste = szablon domyślny">${esc(t.prywatnosc||"")}</textarea></div>
      <div class="f-group"><label>↩️ Zwroty i reklamacje (<a href="#/zwroty">podgląd</a>)</label><textarea name="zwroty" rows="5" placeholder="Puste = szablon domyślny">${esc(t.zwroty||"")}</textarea></div>
      <button class="btn" type="submit">💾 Zapisz treści</button>
    </form>
  </div>`);
}
function zapiszStrony(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const tresci = {};
  for(const k of ["regulamin","prywatnosc","zwroty"]){
    const v = String(f.get(k)||"").trim();
    if(v) tresci[k] = v;
  }
  KONFIG.tresci = Object.keys(tresci).length ? tresci : null;
  zapiszCzescUstawien({tresci: KONFIG.tresci});
}

/* ── Eksporty ── */
function widokAdminEksport(sekcja="import"){
  const aktywna=["import","eksport","kopie","aktualizacja"].includes(String(sekcja||""))?String(sekcja||""):"import";
  const p=podgladImportuProduktow,kopia=wczytajLS("artway_ostatnia_kopia_importu",null);
  return adminSzkielet("/admin/eksport", `
  ${eksportSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="import"?"":"display:none"}">
    <h1>⇄ Import i eksport produktów</h1>
    <p style="color:var(--muted2)">Obsługa dużych katalogów JSON, CSV oraz OVF <code>.xls</code> zapisanego jako CSV. Import zawsze zaczyna się od analizy — żadne dane nie zmienią się przed kliknięciem „Wykonaj import”.</p>
    <div class="import-grid">
      <div class="import-box">
        <h2 style="margin-top:0">1. Wczytaj dane</h2>
        <label class="btn" style="cursor:pointer">📁 Wybierz JSON, CSV lub OVF .xls<input type="file" accept=".json,.csv,.xls,.txt,application/json,text/csv,application/vnd.ms-excel" onchange="wczytajPlikImportuProduktow(this)" style="display:none"></label>
        <button class="btn ghost" onclick="pobierzSzablonProduktowCSV()">⬇️ Pobierz szablon CSV</button>
        <button class="btn ghost" onclick="pobierzSzablonProduktowOVF()">⬇️ Szablon OVF .xls</button>
        <p class="pay-note" style="text-align:left">Możesz też wkleić dane z hurtowni lub arkusza:</p>
        <textarea id="importTekstProduktow" placeholder='JSON: [{"nazwa":"Produkt","kategoria":"AGD","cena":99.90}]&#10;&#10;CSV/OVF: GTIN,EXTERNAL_ID,NAME,STOCK,PRICE,MPN,DESCRIPTION,IMAGE1,CATEGORY,BRAND,COLOR,SIZE,MATERIAL'></textarea>
        <button class="btn ghost" style="margin-top:.5rem" onclick="analizujWklejonyImport()">🔎 Analizuj wklejone dane</button>
      </div>
      <div class="import-box">
        <h2 style="margin-top:0">2. Tryb importu</h2>
        <div class="f-group"><label>Sposób zapisu</label><select id="trybImportuProduktow">
          <option value="scal">Dodaj nowe i aktualizuj istniejące</option>
          <option value="zastap">Zastąp cały katalog importowanymi produktami</option>
        </select></div>
        <div class="backend-note"><b>Scalanie:</b> produkt jest rozpoznawany najpierw po EXTERNAL_ID/SKU, a dopiero potem po lokalnym ID. Istniejący zostanie zaktualizowany, a nowy dostanie wolne ID.<br><b>Zastąpienie:</b> obecny katalog zostanie ukryty i zastąpiony importem.</div>
        <p style="font-size:.82rem;color:var(--muted2)">Przed wykonaniem importu tworzona jest automatyczna kopia produktów, stanów magazynowych, kosza i mapowania.</p>
        ${kopia?`<button class="btn danger" onclick="cofnijOstatniImportProduktow()">↩️ Cofnij ostatni import (${new Date(kopia.data).toLocaleString("pl-PL")})</button>`:""}
        ${ostatniRaportImportu?`<div class="sug" style="margin-top:.7rem"><span class="s-ico">✅</span><span><b>Ostatni import zakończony</b><br>Dodano: ${ostatniRaportImportu.dodane} • zaktualizowano: ${ostatniRaportImportu.zaktualizowane} • pominięto: ${ostatniRaportImportu.pominiete}${ostatniRaportImportu.menuZImportu?` • dopisano do menu: ${ostatniRaportImportu.menuZImportu}`:""}</span></div>`:""}
      </div>
    </div>
    ${p?`
    <div class="import-box" style="margin-top:1rem">
      <h2 style="margin-top:0">3. Podgląd importu — ${esc(p.nazwa)} <span class="lvl lvl-info">${esc(p.format)}</span></h2>
      <div class="import-summary">
        <span>Wiersze: ${p.wszystkich}</span><span>Poprawne: ${p.produkty.length}</span><span>Błędy: ${p.bledy.length}</span><span>Ostrzeżenia: ${p.ostrzezenia.length}</span>
      </div>
      ${p.bledy.length?`<div class="import-errors"><b>Pozycje pominięte:</b><br>${p.bledy.slice(0,100).map(esc).join("<br>")}${p.bledy.length>100?`<br>… i ${p.bledy.length-100} kolejnych`:""}</div>`:""}
      ${p.ostrzezenia.length?`<details><summary>Ostrzeżenia (${p.ostrzezenia.length})</summary><div class="import-errors">${p.ostrzezenia.slice(0,100).map(esc).join("<br>")}</div></details>`:""}
      ${p.produkty.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>ID</th><th>Nazwa</th><th>Grupa menu</th><th>Katalog</th><th>Cena</th><th>Stan</th><th>EXTERNAL_ID / SKU</th><th>Zdjęcia</th></tr>
        ${p.produkty.slice(0,20).map(x=>`<tr><td>${x.id??"auto"}</td><td><b>${esc(x.nazwa)}</b></td><td>${esc(x.grupaKategorii||"—")}</td><td>${esc(x.kategoria)}</td><td>${zl(x.cena)}</td><td>${x.stan??"∞"}</td><td>${esc(x.externalId||x.sku||"—")}</td><td>${(x.zdjecie?1:0)+(x.zdjecia?.length||0)}</td></tr>`).join("")}
      </table></div>${p.produkty.length>20?`<p class="pay-note">Podgląd pokazuje pierwsze 20 z ${p.produkty.length} poprawnych produktów.</p>`:""}
      <button class="btn" style="margin-top:.7rem" onclick="wykonajImportProduktow()">✅ Wykonaj import ${p.produkty.length} ${p.produkty.length===1?"produktu":"produktów"}</button>`:"<p>Brak poprawnych produktów do importu.</p>"}
    </div>`:""}
  </div>
  <div class="panel" style="${aktywna==="eksport"?"":"display:none"}">
    <h1>📤 Eksport produktów</h1>
    <div class="f-row" style="align-items:end">
      <div class="f-group"><label>Zakres</label><select id="zakresEksportuProduktow" onchange="$('kategoriaEksportuBox').style.display=this.value==='kategoria'?'':'none'">
        <option value="widoczne">Cały aktywny katalog — gotowy na hosting (${produkty.length})</option>
        <option value="zaznaczone">Tylko zaznaczone produkty (${zaznaczoneProdukty.size})</option>
        <option value="kategoria">Wybrana kategoria</option>
      </select></div>
      <div class="f-group" id="kategoriaEksportuBox" style="display:none"><label>Kategoria</label><select id="kategoriaEksportuProduktow">${wszystkieKategorie().map(k=>`<option>${esc(k)}</option>`).join("")}</select></div>
    </div>
    <div class="diag-actions">
      <button class="btn" onclick="eksportujProduktyJSON()">📤 products.json na hosting</button>
      <button class="btn ghost" onclick="eksportujProduktyCSV()">📊 Pełny CSV do Excela</button>
      <button class="btn ghost" onclick="eksportujProduktyOVF()">📄 OVF .xls jak szablon</button>
      <button class="btn ghost" onclick="pobierzSzablonProduktowCSV()">📄 Szablon CSV</button>
      <button class="btn ghost" onclick="pobierzSzablonProduktowOVF()">📄 Szablon OVF .xls</button>
    </div>
    <p class="pay-note" style="text-align:left">Eksport zawiera: ID, nazwę, kategorię, ceny, stan, SKU, GTIN/EAN, EXTERNAL_ID, MPN, markę, krótki opis, pełny opis, etykietę, ikonę, zdjęcie główne, galerię do 16 zdjęć, warianty, kolor karty, kolor produktu, rozmiar i materiał. Produkty z kosza nie trafiają do pliku na hosting.</p>
  </div>
  <div class="panel" style="${aktywna==="kopie"?"":"display:none"}">
    <h1>📦 Pozostałe eksporty i kopie</h1>
    <div class="sug"><span class="s-ico">🌍</span><span><b>Publiczny index.html</b> — po rozbiciu projektu jest lekkim szkieletem strony i zawiera zapisane ustawienia publiczne. Kod działania sklepu jest w <code>assets/app.js</code>, a wygląd w <code>assets/styles.css</code>.<br>
      <button class="btn" style="margin-top:.4rem" onclick="eksportujIndexHTML()">Pobierz index.html z ustawieniami</button></span></div>
    <div class="sug"><span class="s-ico">📦</span><span><b>Zamówienia (CSV)</b> — wszystkie zamówienia do Excela: numery, statusy, kwoty, adresy.<br><button class="btn ghost" style="margin-top:.4rem" onclick="eksportujZamowienia()">Pobierz zamowienia.csv</button></span></div>
    <div class="sug"><span class="s-ico">👥</span><span><b>Klienci (CSV)</b> — lista zarejestrowanych kont.<br><button class="btn ghost" style="margin-top:.4rem" onclick="eksportujKlientow()">Pobierz klienci.csv</button></span></div>
    <div class="sug"><span class="s-ico">🛠️</span><span><b>Dziennik zdarzeń</b> — log błędów i zdarzeń; raport możesz wkleić w rozmowie z Claude.<br>
      <button class="btn ghost" style="margin-top:.4rem" onclick="pobierzPlikLogu()">Pobierz log (.txt)</button>
      <button class="btn ghost" style="margin-top:.4rem" onclick="kopiujRaport()">📋 Kopiuj raport dla Claude</button></span></div>
    <div class="sug"><span class="s-ico">💾</span><span><b>Pełna kopia panelu</b> — ustawienia, banery, układy podstron, produkty lokalne, klienci i zamówienia z tej przeglądarki.<br>
      <button class="btn ghost" style="margin-top:.4rem" onclick="eksportujKopieDanych()">Pobierz kopię JSON</button>
      <a class="btn ghost" style="margin-top:.4rem" href="#/diagnostyka">Przywracanie i kontrola →</a></span></div>
  </div>`);
}
let stanAktualizacji={sprawdzono:false,ladowanie:false,online:false,authenticated:false,enabled:false,publisher:null,error:""};
let wybranyIndexAktualizacji=null;
function formatRozmiaruPliku(n){
  n=Number(n)||0;return n>=1048576?(n/1048576).toFixed(2)+" MB":n>=1024?(n/1024).toFixed(1)+" KB":n+" B";
}
function wersjaZIndexu(html){
  return String(html||"").match(/<meta\s+name=["']artway-version["']\s+content=["']([^"']+)/i)?.[1]||"brak numeru";
}
async function sprawdzStatusAktualizacji(cicho=false){
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};if(!cicho)renderuj();
  try{
    const health=await wywolajBramke("health");
    stanAktualizacji={...stanAktualizacji,sprawdzono:true,ladowanie:false,online:true,authenticated:!!health.authenticated,enabled:!!health.publisher?.enabled,error:""};
    if(health.authenticated){
      const d=await wywolajBramke("site-status");
      stanAktualizacji={...stanAktualizacji,authenticated:true,enabled:!!d.publisher?.enabled,publisher:d.publisher||null};
    }
    if(!cicho)toast(health.authenticated?"Status aktualizacji pobrany ✅":"Backend działa — połącz bezpieczną sesję");
  }catch(e){
    stanAktualizacji={...stanAktualizacji,sprawdzono:true,ladowanie:false,online:false,error:e.message};
    if(!cicho)toast("Nie udało się sprawdzić aktualizacji");
  }
  if(trasa().startsWith("/admin/aktualizacja"))renderuj();
}
async function polaczAktualizacje(e){
  e.preventDefault();const f=new FormData(e.target);
  try{
    await wywolajBramke("login",{method:"POST",body:{password:String(f.get("apiPassword")||"")}});
    f.set("apiPassword","");await sprawdzStatusAktualizacji(true);toast("Bezpieczna sesja aktualizacji połączona ✅");
  }catch(bl){stanAktualizacji={...stanAktualizacji,error:bl.message};toast("Nie udało się połączyć");renderuj();}
}
function wczytajIndexDoAktualizacji(input){
  const plik=input.files?.[0];if(!plik)return;
  if(plik.size>6*1024*1024){toast("⚠️ index.html może mieć maksymalnie 6 MB");input.value="";return;}
  const r=new FileReader();
  r.onload=()=>{
    try{
      const html=String(r.result||"");
      if(html.length<1000||!/<html/i.test(html)||!/<script/i.test(html)||!html.includes("PUBLIC_SETTINGS_START")||!html.includes("assets/app.js")||!html.includes("assets/styles.css"))throw new Error("To nie jest poprawny plik index.html Artway-TM po rozbiciu na pliki");
      wybranyIndexAktualizacji={nazwa:plik.name,rozmiar:plik.size,wersja:wersjaZIndexu(html),html};
      toast("Nowy index.html sprawdzony ✅");renderuj();
    }catch(e){wybranyIndexAktualizacji=null;toast("⚠️ "+e.message);renderuj();}
  };
  r.onerror=()=>toast("⚠️ Nie udało się odczytać index.html");
  r.readAsText(plik,"UTF-8");
}
function usunWybranyIndexAktualizacji(){wybranyIndexAktualizacji=null;renderuj();}
async function publikujAktualizacjeStrony(e){
  e.preventDefault();const f=new FormData(e.target),index=!!f.get("index"),produktyPlik=!!f.get("produkty");
  if(!index&&!produktyPlik){toast("Wybierz co najmniej jeden plik do aktualizacji");return;}
  if(!stanAktualizacji.authenticated){toast("Najpierw połącz bezpieczną sesję");return;}
  if(!stanAktualizacji.enabled){toast("Publikator jest wyłączony w config.php");return;}
  const nazwy=[index?"index.html":null,produktyPlik?"products.json":null].filter(Boolean).join(" i ");
  if(!confirm(`Opublikować ${nazwy} na działającej stronie? Poprzednia wersja zostanie automatycznie zapisana jako kopia.`))return;
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};renderuj();
  try{
    const body={note:String(f.get("notatka")||"Aktualizacja z panelu administratora").trim()};
    if(index){
      let html=wybranyIndexAktualizacji?.html;
      if(!html){const r=await fetch("/index.html",{cache:"no-store"});if(!r.ok)throw new Error("Nie udało się pobrać bieżącego index.html");html=await r.text();}
      body.index_html=osadzUstawieniaWIndexie(html);
    }
    if(produktyPlik)body.products=zakresEksportuProduktow("widoczne");
    const d=await wywolajBramke("site-publish",{method:"POST",body});
    stanAktualizacji={...stanAktualizacji,ladowanie:false,sprawdzono:true,online:true,authenticated:true,enabled:!!d.publisher?.enabled,publisher:d.publisher||null,error:""};
    if(index)localStorage.setItem("artway_ustawienia_export_hash",prostyHash(JSON.stringify(ustawienia)));
    if(produktyPlik){
      const hash=prostyHash(JSON.stringify(body.products));
      localStorage.setItem("artway_produkty_publish_hash",hash);
      localStorage.setItem("artway_produkty_export_hash",hash);
    }
    wybranyIndexAktualizacji=null;
    loguj("info","Opublikowano bezpośrednio na hostingu: "+nazwy);
    toast("Strona została zaktualizowana ✅");renderuj();
  }catch(bl){
    stanAktualizacji={...stanAktualizacji,ladowanie:false,error:bl.message};
    loguj("blad","Aktualizacja strony: "+bl.message);toast("Aktualizacja nie powiodła się");renderuj();
  }
}
async function cofnijPublikacjeStrony(id){
  if(!confirm("Przywrócić tę kopię strony? Obecna wersja również zostanie zabezpieczona przed zmianą."))return;
  stanAktualizacji={...stanAktualizacji,ladowanie:true,error:""};renderuj();
  try{
    const d=await wywolajBramke("site-rollback",{method:"POST",body:{backup_id:id}});
    stanAktualizacji={...stanAktualizacji,ladowanie:false,publisher:d.publisher||null,error:""};
    loguj("info","Przywrócono kopię strony "+id);toast("Poprzednia wersja została przywrócona ↩️");renderuj();
  }catch(bl){stanAktualizacji={...stanAktualizacji,ladowanie:false,error:bl.message};toast("Nie udało się przywrócić kopii");renderuj();}
}
async function kopiujKonfiguracjePublikatora(){
  const tekst=`'publisher' => [\n    'enabled' => true,\n    'root' => dirname(__DIR__),\n    'max_backups' => 10,\n],`;
  try{await navigator.clipboard.writeText(tekst);toast("Konfiguracja skopiowana 📋");}
  catch(e){toast("Skopiuj konfigurację z instrukcji api/config.example.php");}
}
function statusPlikuPublikacji(nazwa,dane){
  if(!dane)return `<div class="info-card"><b>${nazwa}</b><p>brak danych</p></div>`;
  return `<div class="info-card"><b>${nazwa}</b><p>${dane.exists?"✅ istnieje":"❌ brak"} • ${dane.writable?"zapis możliwy":"brak zapisu"}<br>${dane.exists?`${formatRozmiaruPliku(dane.size)} • ${new Date(dane.modified).toLocaleString("pl-PL")}<br><code>${esc(dane.sha256||"")}</code>`:""}</p></div>`;
}
function widokAdminAktualizacja(sekcja="status"){
  const aktywna=["status","publikuj","index","kopie"].includes(String(sekcja||""))?String(sekcja||""):"status";
  const s=stanAktualizacji,p=s.publisher||{},last=p.last_publication,backups=p.backups||[];
  return adminSzkielet("/admin/aktualizacja",`
  ${aktualizacjaSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="status"?"":"display:none"}">
    <div class="admin-banner-head"><div><h1 style="margin:0">⬆️ Aktualizacja strony</h1><p style="color:var(--muted2);margin-top:.35rem">Wersja panelu: <b>${esc(document.querySelector('meta[name="artway-version"]')?.content||"—")}</b> • publikuj ustawienia i produkty; pełne aktualizacje kodu idą przez GitHub/Netlify razem z <code>assets/app.js</code> i <code>assets/styles.css</code>.</p></div>
      <button class="btn ghost" onclick="sprawdzStatusAktualizacji()" ${s.ladowanie?"disabled":""}>${s.ladowanie?"⏳ Sprawdzam…":"🔄 Odśwież status"}</button></div>
    <div class="import-summary">
      <span>${s.online?"✅ Backend online":"⚠️ Backend niesprawdzony"}</span>
      <span>${s.authenticated?"🔐 Sesja połączona":"🔒 Wymaga połączenia"}</span>
      <span>${s.enabled?"✅ Publikator włączony":"⚠️ Publikator wyłączony"}</span>
    </div>
    ${s.error?`<div class="backend-note" style="border-color:var(--danger)"><b>Błąd:</b> ${esc(s.error)}</div>`:""}
    ${s.online&&!s.authenticated?`<form onsubmit="polaczAktualizacje(event)" style="max-width:620px"><div class="f-row" style="grid-template-columns:1fr auto;align-items:end"><div class="f-group"><label>Hasło integracji z api/config.php</label><input type="password" name="apiPassword" required autocomplete="current-password"></div><div class="f-group"><button class="btn" type="submit">🔐 Połącz sesję</button></div></div></form>`:""}
    ${s.sprawdzono&&!s.enabled?`<div class="backend-note"><b>Jednorazowa konfiguracja:</b> dodaj sekcję <code>publisher</code> z pliku <code>api/config.example.php</code> do chronionego <code>api/config.php</code>. Pierwsze wgranie tej wersji API nadal wykonujesz przez SFTP; następne aktualizacje zrobisz tutaj.<br><button class="btn ghost" style="margin-top:.5rem" onclick="kopiujKonfiguracjePublikatora()">📋 Kopiuj sekcję konfiguracji</button></div>`:""}
    ${p.files?`<div class="info-grid">${statusPlikuPublikacji("index.html",p.files["index.html"])}${statusPlikuPublikacji("products.json",p.files["products.json"])}</div>`:""}
    ${last?`<div class="sug" style="margin-top:.8rem"><span class="s-ico">✅</span><span><b>Ostatnia aktualizacja: ${new Date(last.published_at).toLocaleString("pl-PL")}</b><br>Pliki: ${(last.files||[]).map(esc).join(", ")}${last.note?` • ${esc(last.note)}`:""}${last.restored_from?` • przywrócono z ${esc(last.restored_from)}`:""}</span></div>`:""}
  </div>
  <div class="panel" style="${aktywna==="publikuj"?"":"display:none"}">
    <h2 style="margin-top:0">Publikuj bieżące zmiany</h2>
    <form onsubmit="publikujAktualizacjeStrony(event)">
      <label class="chk-row"><input type="checkbox" name="index" checked> <span><b>index.html</b> — lekki szkielet strony i publiczne ustawienia panelu</span></label>
      <label class="chk-row"><input type="checkbox" name="produkty" checked> <span><b>products.json</b> — ${produkty.length} aktywnych produktów, ceny, stany, zdjęcia i warianty</span></label>
      <div class="f-group" style="margin-top:.7rem"><label>Notatka do aktualizacji</label><input name="notatka" maxlength="200" value="Aktualizacja z panelu administratora"></div>
      <div class="diag-actions"><button class="btn" type="submit" ${!s.authenticated||!s.enabled||s.ladowanie?"disabled":""}>${s.ladowanie?"⏳ Aktualizacja…":"⬆️ Publikuj na stronie"}</button></div>
    </form>
    <div class="backend-note" style="margin-top:1rem"><b>Co zostanie opublikowane?</b> Jeśli nie wybierzesz nowego pliku poniżej, panel użyje bieżącego index.html i automatycznie osadzi w nim aktualne ustawienia. Po rozbiciu kodu techniczne zmiany w JavaScript/CSS wdrażamy przez GitHub/Netlify, żeby nie pominąć żadnego pliku. Zawsze powstaje kopia poprzedniej wersji.</div>
  </div>
  <div class="panel" style="${aktywna==="index"?"":"display:none"}">
    <h2 style="margin-top:0">Wgraj nową wersję index.html</h2>
    <p style="color:var(--muted2)">Ten plik jest teraz szkieletem strony. Pełna aktualizacja techniczna wymaga też plików <code>assets/app.js</code> i <code>assets/styles.css</code>, dlatego standardowo wdrażamy ją przez GitHub/Netlify.</p>
    <label class="btn ghost" style="cursor:pointer">📁 Wybierz nowy index.html<input type="file" accept=".html,text/html" onchange="wczytajIndexDoAktualizacji(this)" style="display:none"></label>
    ${wybranyIndexAktualizacji?`<div class="sug" style="margin-top:.7rem"><span class="s-ico">📄</span><span><b>${esc(wybranyIndexAktualizacji.nazwa)}</b><br>Wersja ${esc(wybranyIndexAktualizacji.wersja)} • ${formatRozmiaruPliku(wybranyIndexAktualizacji.rozmiar)} <button class="btn danger" style="margin-left:.5rem" onclick="usunWybranyIndexAktualizacji()">Usuń wybór</button></span></div>`:""}
  </div>
  <div class="panel" style="${aktywna==="kopie"?"":"display:none"}">
    <h2 style="margin-top:0">Kopie i przywracanie</h2>
    ${backups.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>Data</th><th>Powód</th><th>Pliki</th><th>Akcja</th></tr>${backups.slice(0,10).map(b=>`<tr><td>${b.created?new Date(b.created).toLocaleString("pl-PL"):esc(b.id)}</td><td>${b.reason==="before-rollback"?"Przed przywróceniem":"Przed publikacją"}</td><td>${(b.files||[]).map(esc).join(", ")}</td><td><button class="btn ghost" onclick="cofnijPublikacjeStrony('${esc(b.id)}')" ${s.ladowanie?"disabled":""}>↩️ Przywróć</button></td></tr>`).join("")}</table></div>`:`<p style="color:var(--muted2)">Kopie pojawią się automatycznie po pierwszej publikacji.</p>`}
  </div>`);
}
function resetujUstawienia(){
  localStorage.removeItem("artway_ustawienia");
  loguj("info","Przywrócono domyślne ustawienia");
  location.reload();
}

/* ── Publikacja strony ── */
function kontrolePublikacji(){
  const k = [];
  k.push({ok:!domyslneHasloAdmina, tekst:"Hasło administratora zmienione z domyślnego (admin)", link:"#/konto", akcja:"Zmień hasło"});
  k.push({ok:!KONFIG.telefon.includes("000 000 000"), tekst:"Prawdziwy numer telefonu w stopce i kontakcie", link:"#/admin/wyglad", akcja:"Ustaw telefon"});
  k.push({ok:!widokRegulamin().includes("[nazwa firmy"), tekst:"Regulamin i polityka prywatności z danymi firmy", link:"#/admin/strony", akcja:"Uzupełnij"});
  k.push({ok:dostepnePlatnosci().length>0, tekst:"Co najmniej jedna forma płatności włączona ("+dostepnePlatnosci().map(p=>p.id).join(", ")+")", link:"#/admin/dostawy", akcja:"Ustaw płatności"});
  k.push({ok:produkty.length>0, tekst:"Produkty w sklepie ("+produkty.length+")", link:"#/admin/produkty", akcja:"Dodaj produkty"});
  const lokalneUstawienia=wczytajLS("artway_ustawienia",{}), kluczeUstawien=Object.keys(lokalneUstawienia).filter(x=>x!=="krokiPublikacji");
  const ustawieniaWyeksportowane=!kluczeUstawien.length||localStorage.getItem("artway_ustawienia_export_hash")===prostyHash(JSON.stringify(ustawienia));
  k.push({ok:ustawieniaWyeksportowane,tekst:ustawieniaWyeksportowane
    ?"Układ i ustawienia są przygotowane do publikacji"
    :`Masz zmiany panelu (${kluczeUstawien.length} sekcji) — opublikuj index.html bezpośrednio z panelu`,link:"#/admin/aktualizacja",akcja:"Aktualizuj stronę"});
  const zmianyLokalne = produktyDodane.length + produktyUkryte.length + Object.keys(produktyEdytowane).length
    + Object.keys(ustawienia.mapaProduktow||{}).length + Object.keys(ustawienia.kategorie||{}).length
    + (ustawienia.menuKategorii||[]).length + (ustawienia.menuPokazNieprzypisane===false?1:0);
  const aktualnyHashProduktow=prostyHash(JSON.stringify(zakresEksportuProduktow("widoczne")));
  const produktyPrzygotowane=!zmianyLokalne||localStorage.getItem("artway_produkty_export_hash")===aktualnyHashProduktow;
  k.push({ok:produktyPrzygotowane, tekst: produktyPrzygotowane
    ? "Produkty są przygotowane do publikacji"
    : "Masz lokalne zmiany produktów/katalogów ("+zmianyLokalne+") — opublikuj products.json bezpośrednio z panelu",
    link:"#/admin/aktualizacja", akcja:"Aktualizuj stronę"});
  return k;
}
const KROKI_PUBLIKACJI = [
  "Zalogowałem się do CloudHosting Panel nazwa.pl",
  "Wgrałem index.html, products.json i cały katalog api przez SFTP",
  "Ustawiłem zmienne Netlify dla SMTP, Paynow i InPost ShipX",
  "Skierowałem domenę na katalog z plikami strony",
  "Otworzyłem stronę pod własną domeną i wszystko działa",
  "Sprawdziłem stronę na telefonie",
  "Złożyłem testowe zamówienie i wysłałem jego potwierdzenie"
];
function przelaczKrok(i){
  const kroki = {...(ustawienia.krokiPublikacji||{})};
  kroki[i] = !kroki[i];
  zapiszCzescUstawien({krokiPublikacji: kroki});
}
function widokAdminPublikacja(sekcja="kontrola"){
  const aktywna=["kontrola","pliki","kroki","aktualizacja"].includes(String(sekcja||""))?String(sekcja||""):"kontrola";
  const kontrole = kontrolePublikacji();
  const gotowe = kontrole.filter(x=>x.ok).length;
  const kroki = ustawienia.krokiPublikacji || {};
  return adminSzkielet("/admin/publikacja", `
  ${publikacjaSubnavHTML(aktywna)}
  <div class="panel" style="${aktywna==="kontrola"?"":"display:none"}">
    <h1>🌍 Publikacja strony</h1>
    <h2>Gotowość do startu: ${gotowe}/${kontrole.length} ${gotowe===kontrole.length?"— można publikować! 🎉":""}</h2>
    ${kontrole.map(x=>`<div class="sug" style="${x.ok?'':'background:#fef3c7'}">
      <span class="s-ico">${x.ok?"✅":"⚠️"}</span>
      <span>${x.tekst}${x.ok?"":` — <a href="${x.link}">${x.akcja} →</a>`}</span></div>`).join("")}
  </div>
  <div class="panel" style="${["pliki","kroki"].includes(aktywna)?"":"display:none"}">
    <div style="${aktywna==="pliki"?"":"display:none"}"><h2 style="margin-top:0">📁 Co wgrywasz na serwer</h2>
    <p style="font-size:.9rem;color:var(--muted2)">Przy pierwszym uruchomieniu na hostingu statycznym wgraj <b>index.html</b>, <b>products.json</b> oraz katalog <b>api</b>, jeżeli korzystasz z awaryjnego PHP. Aktualna, profesjonalna wersja sklepu używa jednak <b>Netlify Functions</b> do wspólnej bazy, e-maili, Paynow i InPost.</p>
    <div class="backend-note"><b>Ważne:</b> GitHub/Netlify są obecnie główną ścieżką publikacji. SFTP/nazwa.pl traktuj jako hosting plików lub plan awaryjny; sekrety InPost i płatności pozostają w zmiennych Netlify, nie w public_html.</div>
    <h2>Publikacja na nazwa.pl</h2>
    <details open style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">1. Połącz się bezpiecznie przez SFTP</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>Zaloguj się na <b>admin.nazwa.pl</b> identyfikatorem serwera (np. server123456)</li>
        <li>W CloudHosting Panel wybierz <b>WWW I FTP → Wykaz kont FTP</b></li>
        <li>Do połączenia SFTP użyj hosta <b>identyfikatorserwera.nazwa.pl</b> i portu <b>22</b></li>
        <li>Login i hasło są takie jak do CloudHosting Panel albo jak w utworzonym dodatkowym koncie FTP</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">2. Wgraj gotową paczkę</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>Otwórz katalog docelowy domeny. Jeśli domena wskazuje na <b>public_html</b>, wejdź do public_html</li>
        <li>Jeżeli public_html nie istnieje, wybierz katalog wskazany dla domeny w CloudHosting Panel</li>
        <li>Wgraj tam całą zawartość folderu <b>artway-tm-nazwa-pl</b>: index.html, products.json i katalog api</li>
        <li>Nazwy plików pozostaw bez zmian; nie umieszczaj ich w dodatkowym zagnieżdżonym folderze</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">3. Skonfiguruj adapter InPost</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>W Parcel Manager InPost wygeneruj token API ShipX oraz publiczny token Geowidget</li>
        <li>W Netlify ustaw: <b>INPOST_TOKEN</b>, <b>INPOST_ORG_ID</b>, opcjonalnie <b>INPOST_GEOWIDGET_TOKEN</b></li>
        <li>Dla testów ustaw <b>INPOST_ENV=sandbox</b>; po testach zmień na <b>production</b></li>
        <li>W panelu sklepu otwórz Centrum wysyłek → Bramka i ustawienia → Test API InPost</li>
      </ol></details>
    <details style="margin:.5rem 0"><summary style="cursor:pointer;font-weight:700">4. Skieruj domenę na katalog strony</summary>
      <ol style="font-size:.9rem;color:var(--muted2);padding-left:1.3rem;margin:.5rem 0">
        <li>W Panelu Klienta nazwa.pl przejdź do <b>Usługi → Domeny → konfiguruj</b></li>
        <li>Przekieruj domenę na zakupiony CloudHosting</li>
        <li>W CloudHosting Panel wskaż katalog, do którego zostały wgrane pliki</li>
        <li>Po propagacji domeny otwórz stronę i wykonaj test na komputerze oraz telefonie</li>
      </ol></details>
    </div><div style="${aktywna==="kroki"?"":"display:none"}"><h2 style="margin-top:0">✅ Lista startowa</h2>
    ${KROKI_PUBLIKACJI.map((k,i)=>`<label class="chk-row"><input type="checkbox" ${kroki[i]?"checked":""} onchange="przelaczKrok(${i})"> ${k}</label>`).join("")}
    <p class="pay-note" style="text-align:left;margin-top:.8rem">Pamiętaj: zamówienia, klienci i ustawienia synchronizują się przez wspólną bazę Netlify. Gdy Netlify jest niedostępne, sklep zachowuje lokalną kopię i ponowi synchronizację po odzyskaniu połączenia.</p></div>
  </div>`);
}

/* ═══════════ WIDOK: DIAGNOSTYKA (tylko administrator) ═══════════
   Dostęp mają konta z rolą administratora. Zwykli klienci nie
   widzą linku w stopce ani samej strony.                         */
function widokBrakDostepu(){
  return `<div class="page"><div class="panel auth-box" style="text-align:center">
    <h1>🔒 Strefa właściciela</h1>
    <p>Ta strona jest dostępna tylko dla administratora sklepu.</p>
    <p style="margin-top:1rem">${sesja?`<a href="#/">← Wróć do sklepu</a>`:`<a class="btn" href="#/logowanie">Zaloguj się</a>`}</p>
  </div></div>`;
}
let filtrLogowDiag="wszystkie", szukajLogowDiag="", ostatniAutotest=[], diagSearchT;
function rozmiarDanychLokalnych(){
  let n=0;
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=(k?.length||0)+(localStorage.getItem(k)?.length||0);}}catch(e){}
  return n*2;
}
function testyDiagnostyczne(){
  const t=[], dodaj=(grupa,nazwa,status,szczegoly)=>t.push({grupa,nazwa,status,szczegoly});
  const zamowieniaDiag=pobierzZamowienia();
  const kontaDiag=pobierzUzytkownikow(), administratorzyDiag=kontaDiag.filter(u=>kontoMaRoleAdmin(u.email));
  const ids=produkty.map(p=>p.id), unikalne=new Set(ids), wszystkieAdmin=produktyDoAdministracji(), adminIds=new Set(wszystkieAdmin.map(p=>p.id));
  const mapa=ustawienia.mapaProduktow||{}, osieroconeMap=Object.keys(mapa).filter(id=>!adminIds.has(+id));
  const osieroconyKoszyk=koszyk.filter(x=>!ids.includes(x.id)), osieroconeUlub=ulubione.filter(id=>!ids.includes(id));
  const bezZdjec=produkty.filter(p=>!p.zdjecie).length, bledneProdukty=produkty.filter(p=>!p.nazwa||!p.kategoria||!(p.cena>0));
  const idsKosza=[...koszDodanych.map(p=>p.id),...bazoweProduktyWKoszu().map(p=>p.id)];
  const brakMetaKosza=idsKosza.filter(id=>!koszMeta[id]), wygasleKosza=idsKosza.filter(id=>Date.now()-Number(koszMeta[id]?.usunietoAt||Date.now())>=OKRES_KOSZA_MS);
  const pamiec=rozmiarDanychLokalnych(), zmiany=produktyDodane.length+produktyUkryte.length+produktyDefinitywne.length+Object.keys(produktyEdytowane).length+Object.keys(mapa).length;
  dodaj("Produkty","Produkty są wczytane",produkty.length?"ok":"bad",`${produkty.length} widocznych produktów`);
  dodaj("Produkty","Unikalne identyfikatory produktów",unikalne.size===ids.length?"ok":"bad",unikalne.size===ids.length?"Brak duplikatów ID":`${ids.length-unikalne.size} zduplikowanych ID`);
  dodaj("Produkty","Poprawne dane i ceny",bledneProdukty.length?"bad":"ok",bledneProdukty.length?`${bledneProdukty.length} produktów wymaga poprawy`:"Nazwy, katalogi i ceny są poprawne");
  dodaj("Produkty","Zdjęcia produktów",bezZdjec?"warn":"ok",bezZdjec?`${bezZdjec} produktów korzysta z ikon zamiast zdjęć`:"Wszystkie produkty mają zdjęcia");
  dodaj("Produkty","Kosz produktów na 30 dni",brakMetaKosza.length||wygasleKosza.length?"warn":"ok",brakMetaKosza.length?`${brakMetaKosza.length} pozycji nie ma daty usunięcia`:wygasleKosza.length?`${wygasleKosza.length} pozycji czeka na automatyczne czyszczenie`:`${idsKosza.length} pozycji w koszu; metadane retencji są spójne`);
  dodaj("Produkty","Stronicowanie dużego katalogu",[12,24,48,96].includes(produktyNaStronie)&&[25,50,100,200].includes(produktyNaStronieAdmin)?"ok":"warn",`Sklep: ${produktyNaStronie} / strona • panel: ${produktyNaStronieAdmin} / strona`);
  dodaj("Produkty","Schemat importu i eksportu",POLA_CSV_PRODUKTU.length>=16?"ok":"warn",`${POLA_CSV_PRODUKTU.length} obsługiwanych kolumn • JSON i CSV • kopia przed importem`);
  dodaj("Dane","Spójność koszyka",osieroconyKoszyk.length?"warn":"ok",osieroconyKoszyk.length?`${osieroconyKoszyk.length} nieistniejących pozycji`:"Brak osieroconych pozycji");
  dodaj("Dane","Spójność ulubionych",osieroconeUlub.length?"warn":"ok",osieroconeUlub.length?`${osieroconeUlub.length} nieistniejących produktów`:"Lista jest spójna");
  dodaj("Dane","Spójność mapowania",osieroconeMap.length?"warn":"ok",osieroconeMap.length?`${osieroconeMap.length} osieroconych mapowań`:"Wszystkie mapowania wskazują produkty");
  dodaj("Konfiguracja","Metoda dostawy",KONFIG.dostawy.length?"ok":"bad",`${KONFIG.dostawy.length} dostępnych metod`);
  dodaj("Konfiguracja","Metoda płatności",dostepnePlatnosci().length?"ok":"bad",`${dostepnePlatnosci().length} aktywnych metod`);
  const niepelneDaneWysylki=zamowieniaDiag.filter(z=>!z.klient?.telefon||!z.adresDostawy?.kod).length;
  const bezNumeru=zamowieniaDiag.filter(z=>!["anulowane","zakończone","dostarczone"].includes(z.status)&&!z.wysylka?.numer).length;
  const wyjatkiWysylki=zamowieniaDiag.filter(z=>etapWysylki(z)==="problem").length, uwDiag=ustawieniaWysylki();
  dodaj("Wysyłki","Dane odbiorców",niepelneDaneWysylki?"warn":"ok",niepelneDaneWysylki?`${niepelneDaneWysylki} starszych zamówień nie ma pełnego telefonu lub adresu`:"Dane nowych zamówień są gotowe do API InPost");
  dodaj("Wysyłki","Numery nadania",bezNumeru?"warn":"ok",bezNumeru?`${bezNumeru} aktywnych zamówień czeka na numer nadania`:"Wszystkie aktywne przesyłki mają numer");
  dodaj("Wysyłki","Kolejka wyjątków",wyjatkiWysylki?"bad":"ok",wyjatkiWysylki?`${wyjatkiWysylki} przesyłek wymaga reakcji operatora`:"Brak nierozwiązanych wyjątków");
  dodaj("Wysyłki","Reguły automatycznego wyboru",uwDiag.regulaPaczkomat==="inpost"?"ok":"bad",`Aktywne metody: InPost Paczkomat i Kurier InPost`);
  const poprawnyEndpoint=String(uwDiag.apiEndpoint||"").startsWith("/")||String(uwDiag.apiEndpoint||"").startsWith("https://")||String(uwDiag.apiEndpoint||"").startsWith("http://");
  dodaj("Integracje","Uniwersalna bramka",stanBramki.online?"ok":poprawnyEndpoint?"warn":"bad",stanBramki.online?`Netlify Functions dostępne • tryb wysyłek ${uwDiag.tryb}`:`Endpoint awaryjny ${uwDiag.apiEndpoint} • sprawdź Netlify Functions`);
  dodaj("Integracje","Centralna baza zamówień",stanBazyCentralnej.online?"ok":stanBazyCentralnej.sprawdzono?"bad":"warn",stanBazyCentralnej.online
    ?`${stanBazyCentralnej.orders} zamówień • ${stanBazyCentralnej.users} klientów • wspólne dla wszystkich urządzeń`
    :stanBazyCentralnej.error||"Połącz backend, aby sprawdzić i zsynchronizować wspólną bazę");
  const ipDiag=stanBramki.inpost||{};
  const avDiag=ipDiag.serviceAvailability||{};
  dodaj("Integracje","InPost ShipX API",ipDiag.configured?((avDiag.locker===false||avDiag.courier===false)?"warn":"ok"):"warn",ipDiag.configured
    ?`Token i Organization ID są ustawione${ipDiag.geowidgetConfigured?" • Geowidget aktywny":" • brakuje tylko Geowidget"}${ipDiag.webhookConfigured?" • webhook aktywny":" • webhook do konfiguracji"}${avDiag.locker===false?" • brak usługi paczkomatowej":""}${avDiag.courier===false?" • kurier InPost nieaktywny":""}`
    :`Brakuje: ${((ipDiag.missingEnv&&ipDiag.missingEnv.length?ipDiag.missingEnv:["INPOST_TOKEN","INPOST_ORG_ID"]).join(", "))}`);
  const emailDiag=!!stanBramki.email?.configured;
  dodaj("Integracje","Automatyczne e-maile",emailDiag&&chmuraToken?"ok":"warn",emailDiag
    ?`${stanBramki.email.provider||"SMTP"} skonfigurowany${chmuraToken?" — wysyłka automatyczna aktywna":" — wpisz hasło bazy do testów i ręcznej wysyłki"}`
    :"Skonfiguruj SMTP/Gmail w zmiennych Netlify");
  dodaj("Konfiguracja","Telefon sklepu",KONFIG.telefon.includes("000 000 000")?"warn":"ok",KONFIG.telefon);
  dodaj("Konfiguracja","Dane prawne",widokRegulamin().includes("[nazwa firmy")?"bad":"ok",widokRegulamin().includes("[nazwa firmy")?"Uzupełnij dane firmy w treściach prawnych":"Brak pól przykładowych");
  dodaj("Bezpieczeństwo","Hasło administratora",domyslneHasloAdmina?"bad":"ok",domyslneHasloAdmina?"Nadal ustawione jest hasło admin":"Hasło zostało zmienione");
  dodaj("Bezpieczeństwo","Role kont administracyjnych",administratorzyDiag.length?"ok":"bad",`${administratorzyDiag.length} kont z rolą administratora • ${kontaDiag.length-administratorzyDiag.length} kont klientów`);
  dodaj("Publikacja","Źródło produktów",zrodloProduktow==="json"?"ok":"warn",zrodloProduktow==="json"?"products.json dostępny":"Używana jest lista zapasowa");
  const hashProduktowDiag=prostyHash(JSON.stringify(zakresEksportuProduktow("widoczne"))),produktyGotoweDiag=!zmiany||localStorage.getItem("artway_produkty_export_hash")===hashProduktowDiag;
  dodaj("Publikacja","Zmiany lokalne",produktyGotoweDiag?"ok":"warn",produktyGotoweDiag?"Produkty są przygotowane do publikacji":`${zmiany} zmian wymaga publikacji products.json`);
  dodaj("Publikacja","Aktualizacja strony bez FTP",!stanAktualizacji.sprawdzono?"warn":stanAktualizacji.online&&stanAktualizacji.enabled?"ok":stanAktualizacji.online?"warn":"bad",!stanAktualizacji.sprawdzono?"Sprawdź status w panelu Aktualizacja strony":stanAktualizacji.online&&stanAktualizacji.enabled?"Publikator backendowy jest dostępny":stanAktualizacji.online?"Backend działa, ale publisher.enabled nie jest włączony":"Backend aktualizacji jest niedostępny");
  dodaj("Pamięć","Wykorzystanie pamięci",pamiec>4_000_000?"bad":pamiec>2_500_000?"warn":"ok",`${(pamiec/1024).toFixed(1)} KB zapisanych danych`);
  const zleBannery=pobierzBannery().filter(b=>!b.tytul||bezpiecznyLink(b.link)==="#/"&&b.link!=="#/");
  dodaj("Wygląd","Konfiguracja banerów",zleBannery.length?"warn":"ok",zleBannery.length?`${zleBannery.length} banerów wymaga sprawdzenia`:`${pobierzBannery().length} poprawnych banerów`);
  return [...t,...ostatniAutotest];
}
function wynikKondycji(testy=testyDiagnostyczne()){
  const bad=testy.filter(x=>x.status==="bad").length, warn=testy.filter(x=>x.status==="warn").length;
  return Math.max(0,Math.min(100,100-bad*12-warn*4));
}
function generujSugestie(){
  const problemy=testyDiagnostyczne().filter(x=>x.status!=="ok");
  if(!problemy.length)return [{ico:"✅",tekst:"Wszystkie kontrole zakończone poprawnie."}];
  return problemy.slice(0,8).map(x=>({ico:x.status==="bad"?"❌":"⚠️",tekst:`${x.nazwa}: ${x.szczegoly}`}));
}
function widokDiagnostyka(){
  const wszystkieLogi=pobierzLogi(), testy=testyDiagnostyczne(), wynik=wynikKondycji(testy), pamiec=rozmiarDanychLokalnych();
  let logi=wszystkieLogi;
  if(filtrLogowDiag!=="wszystkie")logi=logi.filter(l=>l.poziom===filtrLogowDiag);
  if(szukajLogowDiag)logi=logi.filter(l=>(l.tresc+" "+l.zrodlo).toLowerCase().includes(szukajLogowDiag));
  const nazwaPoziomu={blad:"BŁĄD",ostrzezenie:"UWAGA",info:"INFO"};
  const grupy=[...new Set(testy.map(x=>x.grupa))];
  return `
  <div class="page page-wide">
    <div class="panel" style="margin-bottom:1rem">
      <h1>🛠️ Centrum diagnostyczne</h1>
      <div class="health-card">
        <div class="health-score">${wynik}%</div>
        <div><h2 style="margin:0">Kondycja sklepu: ${wynik>=90?"bardzo dobra":wynik>=70?"dobra":wynik>=50?"wymaga uwagi":"wymaga naprawy"}</h2>
          <p>${testy.filter(x=>x.status==="ok").length} testów poprawnych • ${testy.filter(x=>x.status==="warn").length} ostrzeżeń • ${testy.filter(x=>x.status==="bad").length} błędów</p>
          <div class="health-bar"><span style="width:${wynik}%"></span></div>
        </div>
      </div>
      <div class="diag-grid">
        <div class="diag-card"><b>${produkty.length}</b><small>produktów • ${zrodloProduktow}</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().length}</b><small>zamówień</small></div>
        <div class="diag-card"><b>${pobierzUzytkownikow().filter(u=>!kontoMaRoleAdmin(u.email)).length}</b><small>kont klientów</small></div>
        <div class="diag-card"><b>${pobierzUzytkownikow().filter(u=>kontoMaRoleAdmin(u.email)).length}</b><small>administratorów</small></div>
        <div class="diag-card"><b>${(pamiec/1024).toFixed(1)} KB</b><small>pamięci lokalnej</small><div class="storage-bar"><span style="width:${Math.min(100,pamiec/50000)}%"></span></div></div>
        <div class="diag-card"><b>${wszystkieLogi.filter(l=>l.poziom==="blad").length}</b><small>błędów w dzienniku</small></div>
        <div class="diag-card"><b>${pobierzBannery().filter(b=>b.aktywny!==false).length}</b><small>aktywnych banerów</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().filter(z=>z.wysylka?.numer).length}</b><small>przesyłek z numerem nadania</small></div>
        <div class="diag-card"><b>${pobierzZamowienia().filter(z=>!["anulowane","zakończone","dostarczone"].includes(z.status)&&!z.wysylka?.numer).length}</b><small>przesyłek do przygotowania</small></div>
      </div>
      <div class="diag-actions">
        <button class="btn" onclick="uruchomAutotest()">🧪 Pełny autotest</button>
        <button class="btn ghost" onclick="kopiujRaport()">📋 Kopiuj raport</button>
        <button class="btn ghost" onclick="pobierzRaportJSON()">⬇️ Raport JSON</button>
        <button class="btn ghost" onclick="eksportujKopieDanych()">💾 Kopia danych</button>
        <label class="btn ghost" style="cursor:pointer">📥 Przywróć kopię<input type="file" accept="application/json" onchange="importujKopieDanych(event)" style="display:none"></label>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">✅ Testy integralności i konfiguracji</h2>
      ${grupy.map(g=>`<h3 class="f-sekcja">${esc(g)}</h3><div class="test-list">${testy.filter(x=>x.grupa===g).map(x=>`
        <div class="test-row"><span>${x.status==="ok"?"✅":x.status==="warn"?"⚠️":"❌"}</span><span><b>${esc(x.nazwa)}</b><small>${esc(x.szczegoly)}</small></span><span class="test-status ${x.status}">${x.status==="ok"?"OK":x.status==="warn"?"UWAGA":"BŁĄD"}</span></div>`).join("")}</div>`).join("")}
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">🔧 Narzędzia naprawcze</h2>
      <p style="font-size:.86rem;color:var(--muted2)">Naprawa usuwa wyłącznie odwołania do nieistniejących produktów, duplikaty i osierocone mapowania. Nie usuwa prawidłowych produktów ani zamówień.</p>
      <div class="diag-actions">
        <button class="btn" onclick="naprawDaneSklepu()">🧹 Napraw spójność danych</button>
        <a class="btn ghost" href="#/admin/publikacja">🌍 Kontrola publikacji</a>
        <a class="btn ghost" href="#/admin/wyglad">🎨 Ustawienia układu</a>
        <a class="btn ghost" href="#/admin/podstrony">🧱 Ustawienia podstron</a>
      </div>
    </div>
    <div class="panel" style="margin-bottom:1rem">
      <h2 style="margin-top:0">🖥️ Środowisko</h2>
      <div class="info-grid">
        <div class="info-card"><b>Adres</b><p>${esc(location.href)}</p></div>
        <div class="info-card"><b>Widok</b><p>${window.innerWidth||"—"} × ${window.innerHeight||"—"} px</p></div>
        <div class="info-card"><b>Połączenie</b><p>${navigator.onLine===false?"offline":"online"} • ${location.protocol==="https:"?"HTTPS":location.hostname==="localhost"||location.hostname==="127.0.0.1"?"lokalnie":"HTTP"}</p></div>
        <div class="info-card"><b>Przeglądarka</b><p>${esc((navigator.userAgent||"").slice(0,100))}</p></div>
      </div>
    </div>
    <div class="panel">
      <div class="admin-banner-head"><h2 style="margin:0">📋 Dziennik zdarzeń (${logi.length}/${wszystkieLogi.length})</h2>
        <div><button class="btn ghost" onclick="pobierzPlikLogu()">⬇️ TXT</button><button class="btn danger" onclick="wyczyscLogi()">🗑️ Wyczyść</button></div></div>
      <div class="diag-toolbar">
        <select onchange="filtrLogowDiag=this.value;renderuj()"><option value="wszystkie">Wszystkie poziomy</option><option value="blad" ${filtrLogowDiag==="blad"?"selected":""}>Błędy</option><option value="ostrzezenie" ${filtrLogowDiag==="ostrzezenie"?"selected":""}>Ostrzeżenia</option><option value="info" ${filtrLogowDiag==="info"?"selected":""}>Informacje</option></select>
        <input placeholder="Szukaj w dzienniku…" value="${esc(szukajLogowDiag)}" oninput="szukajLogowDiag=this.value.toLowerCase();clearTimeout(diagSearchT);diagSearchT=setTimeout(renderuj,350)">
      </div>
      ${logi.length?`<div style="overflow-x:auto"><table class="log-table"><tr><th>Czas</th><th>Poziom</th><th>Zdarzenie</th><th>Źródło</th></tr>
        ${logi.slice(0,100).map(l=>`<tr><td style="white-space:nowrap">${esc(l.czas)}</td><td><span class="lvl lvl-${l.poziom}">${nazwaPoziomu[l.poziom]||l.poziom}</span></td><td>${esc(l.tresc)}</td><td>${esc(l.zrodlo)}</td></tr>`).join("")}</table></div>`
      :`<p style="color:var(--muted2)">Brak zdarzeń pasujących do filtra.</p>`}
    </div>
  </div>`;
}
function wyczyscLogi(){ localStorage.removeItem("artway_logi"); toast("Dziennik wyczyszczony"); renderuj(); }
async function kopiujRaport(){
  const testy=testyDiagnostyczne(), raport=[
    "RAPORT DIAGNOSTYCZNY Artway-TM — "+new Date().toLocaleString("pl-PL"),
    `Kondycja: ${wynikKondycji(testy)}% | Produkty: ${produkty.length} (${zrodloProduktow}) | Konta: ${pobierzUzytkownikow().length} | Zamówienia: ${pobierzZamowienia().length}`,
    "","TESTY:",...testy.map(x=>`- [${x.status.toUpperCase()}] ${x.grupa} / ${x.nazwa}: ${x.szczegoly}`),
    "","OSTATNIE ZDARZENIA:",...pobierzLogi().slice(0,30).map(l=>`[${l.czas}] ${l.poziom.toUpperCase()}: ${l.tresc}${l.zrodlo?" ("+l.zrodlo+")":""}`)
  ].join("\n");
  try{await navigator.clipboard.writeText(raport);toast("Raport skopiowany 📋");}
  catch(e){pobierzPlik("raport-diagnostyczny.txt",raport,"text/plain");}
}
function pobierzRaportJSON(){
  const testy=testyDiagnostyczne();
  pobierzPlik("artway-diagnostyka-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({
    data:new Date().toISOString(),wynik:wynikKondycji(testy),testy,logi:pobierzLogi(),produkty:produkty.length,zamowienia:pobierzZamowienia().length
  },null,2),"application/json");
}
function pobierzPlikLogu(){
  const tekst=pobierzLogi().map(l=>`[${l.czas}] ${l.poziom.toUpperCase()}: ${l.tresc}${l.zrodlo?" ("+l.zrodlo+")":""}`).join("\n")||"Dziennik pusty.";
  pobierzPlik("artway-log-"+new Date().toISOString().slice(0,10)+".txt",tekst,"text/plain");
}
function eksportujKopieDanych(){
  const dane={wersja:1,data:new Date().toISOString(),localStorage:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith("artway_"))dane.localStorage[k]=localStorage.getItem(k);}
  pobierzPlik("artway-kopia-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(dane,null,2),"application/json");
  loguj("info","Utworzono kopię danych lokalnych");
}
function importujKopieDanych(e){
  const plik=e.target.files?.[0];if(!plik)return;
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.localStorage||typeof d.localStorage!=="object")throw new Error("Niepoprawny format");
    if(!confirm("Przywrócić kopię? Obecne dane lokalne zostaną zastąpione."))return;
    Object.entries(d.localStorage).forEach(([k,v])=>{if(k.startsWith("artway_"))localStorage.setItem(k,String(v));});
    location.reload();
  }catch(bl){toast("⚠️ Nie udało się wczytać kopii: "+bl.message);}};
  r.readAsText(plik);
}
function naprawDaneSklepu(){
  naprawKolizjeIdProduktow();
  zbudujProdukty();
  const widoczne=new Set(produkty.map(p=>p.id)), wszystkie=new Set(produktyDoAdministracji().map(p=>p.id));
  koszyk=koszyk.filter((x,i,a)=>widoczne.has(x.id)&&x.ile>0&&a.findIndex(y=>y.id===x.id)===i);
  ulubione=[...new Set(ulubione.filter(id=>widoczne.has(id)))];
  produktyUkryte=[...new Set(produktyUkryte.filter(id=>prodBazowe.some(p=>p.id===id)))];
  const mapa={...(ustawienia.mapaProduktow||{})};Object.keys(mapa).forEach(id=>{if(!wszystkie.has(+id))delete mapa[id];});
  const kat=new Set(wszystkieKategorie());
  const menuKategorii=grupyMenuKategorii().map(g=>({...g,kategorie:g.kategorie.filter(k=>kat.has(k))})).filter(g=>g.nazwa);
  const uzytkownicy=pobierzUzytkownikow().filter((u,i,a)=>u.email&&a.findIndex(x=>x.email===u.email)===i);
  zapiszLS("artway_koszyk",koszyk);zapiszLS("artway_ulubione",ulubione);zapiszLS("artway_produkty_ukryte",produktyUkryte);
  zapiszLS("artway_uzytkownicy",uzytkownicy);ustawienia={...ustawienia,mapaProduktow:mapa,menuKategorii};zapiszLS("artway_ustawienia",ustawienia);
  zbudujProdukty();odswiezKoszyk();odswiezUlubioneLicznik();loguj("info","Wykonano naprawę spójności danych");toast("Dane zostały sprawdzone i naprawione ✅");renderuj();
}
async function uruchomAutotest(){
  ostatniAutotest=[];const dodaj=(nazwa,status,szczegoly)=>ostatniAutotest.push({grupa:"Autotest techniczny",nazwa,status,szczegoly});
  try{localStorage.setItem("artway_test","1");const ok=localStorage.getItem("artway_test")==="1";localStorage.removeItem("artway_test");dodaj("Zapis i odczyt pamięci",ok?"ok":"bad",ok?"Pamięć działa":"Brak możliwości zapisu");}catch(e){dodaj("Zapis i odczyt pamięci","bad",e.message);}
  try{const h=await hashuj("test");dodaj("Szyfrowanie haseł",h.length===64?"ok":"warn",h.length===64?"SHA-256 dostępne":"Użyto mechanizmu zapasowego");}catch(e){dodaj("Szyfrowanie haseł","bad",e.message);}
  try{const r=await fetch("/products.json",{cache:"no-store"}),j=r.ok?await r.json():null;dodaj("Dostęp do products.json",r.ok&&Array.isArray(j)?"ok":"bad",r.ok?`${j.length} rekordów`:`HTTP ${r.status}`);}catch(e){dodaj("Dostęp do products.json","bad",e.message);}
  try{const widoki=[widokSklep(),widokKontakt(),widokFAQ(),widokDostawa(),widokAdminProdukty()];dodaj("Renderowanie głównych widoków",widoki.every(x=>typeof x==="string"&&x.length>100)?"ok":"bad","Sprawdzono 5 kluczowych ekranów");}catch(e){dodaj("Renderowanie głównych widoków","bad",e.message);}
  loguj("info","Wykonano pełny autotest: "+ostatniAutotest.map(x=>x.status).join(","));
  renderuj();
}
