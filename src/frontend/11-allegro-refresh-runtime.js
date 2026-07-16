/* Lekkie odświeżanie wyników synchronizacji Allegro bez przebudowy widoku,
   jeśli serwer nie zwrócił żadnej rzeczywistej zmiany. */
const ALLEGRO_ODSWIEZANIE_PANELU_MS=15*60*1000;
let allegroAutoOdswiezanie={busy:false,lastChecked:0,lastChanged:0,orders:0,threads:0,issues:0,offers:0,error:""};

function allegroAktywneIdDoOdswiezenia(){return new Set((allegroZamowienia||[]).filter(allegroZamowienieAktywneLokalnie).map(z=>String(z.id||z.nr||"")).filter(Boolean));}
function allegroOfertaIdDoOdswiezenia(){return new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean));}
function allegroKomunikacjaKluczeDoOdswiezenia(type="thread"){const list=type==="issue"?(allegroKomunikacja?.issues||[]):(allegroKomunikacja?.threads||[]);return new Set(list.filter(allegroKomunikacjaWymagaOdpowiedzi).map(x=>{const id=String(x.id||""),last=x.latestNewIncoming||x.lastMessage||{},marker=String(x.latestNewIncomingKey||last.id||last.createdAt||x.newIncomingCount||"");return id?`${id}:${marker}`:"";}).filter(Boolean));}
function allegroNoweIdPoOdswiezeniu(przed,po){let n=0;for(const id of po)if(!przed.has(id))n++;return n;}
function allegroWersjaDanychDoOdswiezenia(){
  // Wersja opiera się na lekkich metadanych serwera. Nie sklejamy już ID i
  // treści dziesiątek tysięcy ofert przy każdym cyklu odświeżania.
  return typeof allegroWersjaSerwerowaZakresu==="function"?allegroWersjaSerwerowaZakresu("summary"):`${allegroPodsumowanie?.orders?.updated_at||""}|${allegroPodsumowanie?.offers?.updated_at||""}|${allegroKomunikacja?.updated_at||""}`;
}
async function allegroOdswiezDaneZSerweraJesliCzas(powod="timer"){
  if(allegroAutoOdswiezanie.busy||typeof jestAdmin!=="function"||!jestAdmin())return false;
  if(typeof document!=="undefined"&&document.hidden&&powod==="timer")return false;
  const teraz=Date.now(),minimalnyOdstep=ALLEGRO_ODSWIEZANIE_PANELU_MS;
  if(teraz-Number(allegroAutoOdswiezanie.lastChecked||0)<minimalnyOdstep)return false;
  const mialDane=!!allegroStan.sprawdzono,przedWersja=allegroWersjaDanychDoOdswiezenia(),przedOrders=allegroAktywneIdDoOdswiezenia(),przedThreads=allegroKomunikacjaKluczeDoOdswiezenia("thread"),przedIssues=allegroKomunikacjaKluczeDoOdswiezenia("issue"),przedOfferCount=Number(allegroPodsumowanie?.offers?.count||allegroOferty?.length||0),przedOrderVersion=allegroWersjaSerwerowaZakresu("orders"),przedOfferVersion=allegroWersjaSerwerowaZakresu("offers");
  allegroAutoOdswiezanie={...allegroAutoOdswiezanie,busy:true,error:""};
  // Najpierw pobieramy małe podsumowanie. Pełną listę zamówień/ofert
  // ściągamy tylko wtedy, gdy jej wersja na serwerze rzeczywiście się zmieniła.
  const wyniki=[await allegroWczytajDane(true,false,"summary")];
  const orderChanged=przedOrderVersion!==allegroWersjaSerwerowaZakresu("orders"),offerChanged=przedOfferVersion!==allegroWersjaSerwerowaZakresu("offers");
  if(allegroDaneZaladowane.orders&&orderChanged)wyniki.push(await allegroWczytajDane(true,false,"orders"));
  if(allegroDaneZaladowane.offers&&offerChanged)wyniki.push(await allegroWczytajDane(true,false,"offers"));
  const ok=wyniki.every(Boolean);
  const orders=ok?allegroNoweIdPoOdswiezeniu(przedOrders,allegroAktywneIdDoOdswiezenia()):0,offers=ok?Math.max(0,Number(allegroPodsumowanie?.offers?.count||allegroOferty?.length||0)-przedOfferCount):0,threads=ok?allegroNoweIdPoOdswiezeniu(przedThreads,allegroKomunikacjaKluczeDoOdswiezenia("thread")):0,issues=ok?allegroNoweIdPoOdswiezeniu(przedIssues,allegroKomunikacjaKluczeDoOdswiezenia("issue")):0,changed=orders+offers+threads+issues,daneZmienione=ok&&przedWersja!==allegroWersjaDanychDoOdswiezenia();
  allegroAutoOdswiezanie={busy:false,lastChecked:Date.now(),lastChanged:changed?Date.now():allegroAutoOdswiezanie.lastChanged,orders,threads,issues,offers,error:ok?"":allegroStan.error||"Nie udało się odświeżyć danych"};
  if(ok&&mialDane&&changed)toast(`🟠 Allegro: zlecenia ${orders} • wiadomości ${threads} • dyskusje ${issues} • oferty ${offers}`);
  return !!daneZmienione;
}
