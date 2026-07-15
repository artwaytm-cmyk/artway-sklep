/* Lekkie odświeżanie wyników synchronizacji Allegro bez przebudowy widoku,
   jeśli serwer nie zwrócił żadnej rzeczywistej zmiany. */
const ALLEGRO_ODSWIEZANIE_PANELU_MS=15*60*1000;
let allegroAutoOdswiezanie={busy:false,lastChecked:0,lastChanged:0,orders:0,threads:0,issues:0,offers:0,error:""};

function allegroAktywneIdDoOdswiezenia(){return new Set((allegroZamowienia||[]).filter(allegroZamowienieAktywneLokalnie).map(z=>String(z.id||z.nr||"")).filter(Boolean));}
function allegroOfertaIdDoOdswiezenia(){return new Set((allegroOferty||[]).map(o=>String(o.id||"")).filter(Boolean));}
function allegroKomunikacjaKluczeDoOdswiezenia(type="thread"){const list=type==="issue"?(allegroKomunikacja?.issues||[]):(allegroKomunikacja?.threads||[]);return new Set(list.filter(allegroKomunikacjaWymagaOdpowiedzi).map(x=>{const id=String(x.id||""),last=x.latestNewIncoming||x.lastMessage||{},marker=String(x.latestNewIncomingKey||last.id||last.createdAt||x.newIncomingCount||"");return id?`${id}:${marker}`:"";}).filter(Boolean));}
function allegroNoweIdPoOdswiezeniu(przed,po){let n=0;for(const id of po)if(!przed.has(id))n++;return n;}
function allegroWersjaDanychDoOdswiezenia(){
  const orders=(allegroZamowienia||[]).map(z=>`${z.id||z.nr||""}:${z.status||""}:${z.fulfillment?.status||z.fulfillmentStatus||""}:${z.updatedAt||z.lastModifiedAt||z.checkoutForm?.updatedAt||""}`).join("|");
  const offers=(allegroOferty||[]).map(o=>`${o.id||""}:${o.publication?.status||o.status||""}:${o.sellingMode?.price?.amount||o.price?.amount||o.price||""}:${o.stock?.available??o.stock??""}:${o.updatedAt||o.lastModifiedAt||""}`).join("|");
  const communication=[...(allegroKomunikacja?.threads||[]),...(allegroKomunikacja?.issues||[])].map(x=>{const last=x.latestNewIncoming||x.lastMessage||{};return `${x.id||""}:${x.status||""}:${x.newIncomingCount||0}:${x.latestNewIncomingKey||last.id||last.createdAt||""}:${x.updatedAt||x.lastMessageAt||""}`;}).join("|");
  return `${orders}\n${offers}\n${communication}`;
}
async function allegroOdswiezDaneZSerweraJesliCzas(powod="timer"){
  if(allegroAutoOdswiezanie.busy||typeof jestAdmin!=="function"||!jestAdmin())return false;
  if(typeof document!=="undefined"&&document.hidden&&powod==="timer")return false;
  const teraz=Date.now(),minimalnyOdstep=ALLEGRO_ODSWIEZANIE_PANELU_MS;
  if(teraz-Number(allegroAutoOdswiezanie.lastChecked||0)<minimalnyOdstep)return false;
  const mialDane=!!allegroStan.sprawdzono,przedWersja=allegroWersjaDanychDoOdswiezenia(),przedOrders=allegroAktywneIdDoOdswiezenia(),przedOffers=allegroOfertaIdDoOdswiezenia(),przedThreads=allegroKomunikacjaKluczeDoOdswiezenia("thread"),przedIssues=allegroKomunikacjaKluczeDoOdswiezenia("issue");
  allegroAutoOdswiezanie={...allegroAutoOdswiezanie,busy:true,error:""};
  const ok=await allegroWczytajDane(true,false);
  const orders=ok?allegroNoweIdPoOdswiezeniu(przedOrders,allegroAktywneIdDoOdswiezenia()):0,offers=ok?allegroNoweIdPoOdswiezeniu(przedOffers,allegroOfertaIdDoOdswiezenia()):0,threads=ok?allegroNoweIdPoOdswiezeniu(przedThreads,allegroKomunikacjaKluczeDoOdswiezenia("thread")):0,issues=ok?allegroNoweIdPoOdswiezeniu(przedIssues,allegroKomunikacjaKluczeDoOdswiezenia("issue")):0,changed=orders+offers+threads+issues,daneZmienione=ok&&przedWersja!==allegroWersjaDanychDoOdswiezenia();
  allegroAutoOdswiezanie={busy:false,lastChecked:Date.now(),lastChanged:changed?Date.now():allegroAutoOdswiezanie.lastChanged,orders,threads,issues,offers,error:ok?"":allegroStan.error||"Nie udało się odświeżyć danych"};
  if(ok&&mialDane&&changed)toast(`🟠 Allegro: zlecenia ${orders} • wiadomości ${threads} • dyskusje ${issues} • oferty ${offers}`);
  return !!daneZmienione;
}
