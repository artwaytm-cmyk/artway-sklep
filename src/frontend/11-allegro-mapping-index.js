/* Indeks kandydatów mapowania Allegro. Przy dużym katalogu nie porównujemy
   każdej oferty z każdą kartoteką; najpierw zawężamy pulę po identyfikatorach
   oraz istotnych tokenach nazwy. */
let allegroIndeksKandydatowCache={source:null,byId:new Map(),ean:new Map(),external:new Map(),code:new Map(),catalog:new Map(),token:new Map()};
function allegroIndeksKandydatowKlucz(value=""){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g," ").trim();}
function allegroIndeksKanonicznyGtin(value=""){const code=String(value??"").replace(/\D+/g,"");if(![8,12,13,14].includes(code.length))return"";let sum=0,weight=3;for(let i=code.length-2;i>=0;i--,weight=weight===3?1:3)sum+=Number(code[i])*weight;return(10-sum%10)%10===Number(code.at(-1))?code.padStart(14,"0"):"";}
function allegroIndeksGtins(value={}){const direct=[value?.canonicalGtins,value?.gtins,value?.canonicalGtin,value?.gtin,value?.ean,value?.GTIN,value?.EAN,value?.kodKreskowy,value?.barcode].flat(Infinity),params=Array.isArray(value?.parameters)?value.parameters:[];for(const p of params){const name=String(p?.name||"").toLowerCase(),id=String(p?.id||"");if(["225693","245669","245673"].includes(id)||/ean|gtin|isbn|issn|kod kreskowy/.test(name))direct.push(p?.values,p?.valuesLabels,p?.value);}return[...new Set(direct.flat(Infinity).map(allegroIndeksKanonicznyGtin).filter(Boolean))];}
function allegroIndeksGtin(value={}){return allegroIndeksGtins(value)[0]||"";}
const ALLEGRO_INDEKS_STOP=new Set(["gra","gry","zabawka","zabawki","zestaw","dla","oraz","maly","mala","duzy","duza","szt","elementow","alexander","multigra","godan"]);
function allegroIndeksKandydatowTokeny(value=""){return [...new Set(allegroIndeksKandydatowKlucz(value).split(/\s+/).filter(token=>token.length>2&&!ALLEGRO_INDEKS_STOP.has(token)))];}
function allegroIndeksKandydatowDodaj(map,key,product){if(!key)return;const list=map.get(key)||[];list.push(product);map.set(key,list);}
function allegroIndeksKandydatow(products=[]){
  if(allegroIndeksKandydatowCache.source===products)return allegroIndeksKandydatowCache;
  const next={source:products,byId:new Map(),ean:new Map(),external:new Map(),code:new Map(),catalog:new Map(),token:new Map()};
  for(const product of products){
    const id=String(product?.id??"");if(!id)continue;next.byId.set(id,product);
    allegroIndeksGtins(product).forEach(gtin=>allegroIndeksKandydatowDodaj(next.ean,gtin,product));
    allegroIndeksKandydatowDodaj(next.external,allegroIndeksKandydatowKlucz(product.externalId||product.sku),product);
    allegroIndeksKandydatowDodaj(next.code,allegroIndeksKandydatowKlucz(product.kodProducenta||product.mpn),product);
    allegroIndeksKandydatowDodaj(next.catalog,String(product.allegroProductId||""),product);
    const tokens=allegroIndeksKandydatowTokeny(product.nazwa||product.name);
    tokens.forEach(token=>allegroIndeksKandydatowDodaj(next.token,token,product));
  }
  allegroIndeksKandydatowCache=next;return next;
}
function allegroPulaProduktowMapowania(offer={},products=[]){
  const index=allegroIndeksKandydatow(products),scores=new Map(),add=(list,points)=>{for(const product of list||[]){const id=String(product.id);scores.set(id,{product,score:(scores.get(id)?.score||0)+points});}};
  allegroIndeksGtins(offer).forEach(gtin=>add(index.ean.get(gtin),1000));
  add(index.external.get(allegroIndeksKandydatowKlucz(offer.externalId)),800);
  add(index.code.get(allegroIndeksKandydatowKlucz(offer.manufacturerCode||offer.producerCode)),700);
  add(index.catalog.get(String(offer.productId||"")),900);
  allegroIndeksKandydatowTokeny(offer.name).sort((a,b)=>(index.token.get(a)?.length||0)-(index.token.get(b)?.length||0)).slice(0,4).forEach(token=>add((index.token.get(token)||[]).slice(0,2000),10));
  const mappedId=String((allegroMapowania||{})[String(offer.id||"")]?.productId??"");if(mappedId&&index.byId.has(mappedId))add([index.byId.get(mappedId)],2000);
  return [...scores.values()].sort((a,b)=>b.score-a.score||String(a.product.id).localeCompare(String(b.product.id))).slice(0,800).map(entry=>entry.product);
}
function allegroKluczeKodu(v){const raw=String(v||"").trim().toLowerCase();if(!raw)return[];const bezSpacji=raw.replace(/\s+/g,""),bezUniw=bezSpacji.replace(/[-_ ]?uniw$/,""),bezPrefixu=bezUniw.replace(/^(sku|kod|ean|gtin)[:#-]?/,""),cyfry=(bezPrefixu.match(/\d{3,}/)||[])[0]||"";return [...new Set([raw,bezSpacji,bezUniw,bezPrefixu,cyfry].filter(Boolean))];}
function allegroIndeksProduktowPoKodzie(){const indeks=new Map(),konflikty=new Set(),dodajKlucz=(k,p)=>{if(!k)return;const poprzedni=indeks.get(k);if(poprzedni&&String(poprzedni.id)!==String(p.id)){konflikty.add(k);return;}indeks.set(k,p);},dodaj=(kod,p)=>allegroKluczeKodu(kod).forEach(k=>dodajKlucz(k,p)),dodajGtin=(kod,p)=>{const k=allegroIndeksKanonicznyGtin(kod);if(k)dodajKlucz(`gtin:${k}`,p);};produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).forEach(p=>{[p.sku,p.kod,p.externalId,p.producentKod,p.kodProducenta].forEach(k=>dodaj(k,p));[p.gtin,p.ean,p.GTIN,p.EAN,p.kodKreskowy].forEach(k=>dodajGtin(k,p));});konflikty.forEach(k=>indeks.delete(k));return indeks;}
function allegroNormalizujNazwe(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," i ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function allegroTokenyNazwy(v){const stop=new Set(["gra","gry","planszowa","planszowe","edukacyjna","edukacyjne","zabawka","zestaw","alexander","dla","oraz","plus","wersja","mini","duza","duzy","mala","maly","od","do","na","w","i","z"]);return allegroNormalizujNazwe(v).split(" ").filter(t=>t.length>=3&&!stop.has(t));}
function allegroDopasujProduktPoNazwie(nazwa,produktyLista){const norm=allegroNormalizujNazwe(nazwa),tokeny=allegroTokenyNazwy(nazwa);if(!norm||!tokeny.length)return null;let najlepszy=null,drugi=0;for(const p of produktyLista){const pn=allegroNormalizujNazwe(p.nazwa),pt=allegroTokenyNazwy(p.nazwa);if(!pn||!pt.length)continue;let score=0;if(pn===norm)score=1;else if(pt.length>=2&&pt.every(t=>tokeny.includes(t)))score=Math.min(.94,.62+(pt.length/Math.max(tokeny.length,pt.length))*.34);else if(tokeny.length>=2&&tokeny.every(t=>pt.includes(t)))score=Math.min(.9,.58+(tokeny.length/Math.max(tokeny.length,pt.length))*.32);if(score>0){if(!najlepszy||score>najlepszy.score){drugi=najlepszy?.score||0;najlepszy={produkt:p,score};}else if(score>drugi)drugi=score;}}return najlepszy&&najlepszy.score>=.82&&(najlepszy.score-drugi)>=.08?najlepszy.produkt:null;}
function allegroKodyZamowienDlaOferty(){const mapa=new Map();(Array.isArray(allegroZamowienia)?allegroZamowienia:[]).forEach(z=>(Array.isArray(z.lineItems)?z.lineItems:[]).forEach(it=>{const oid=String(it.offerId||"").trim();if(!oid)return;if(!mapa.has(oid))mapa.set(oid,new Set());[it.externalId,it.offerName].filter(Boolean).forEach(k=>mapa.get(oid).add(k));}));return mapa;}
function allegroSugestieAutomapowania(){const indeks=allegroIndeksProduktowPoKodzie(),produktyLista=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),zZamowien=allegroKodyZamowienDlaOferty(),wyniki=[];(Array.isArray(allegroOferty)?allegroOferty:[]).forEach(o=>{if(allegroProduktDlaOferty(o.id))return;let produkt=null,kod="";const gtin=allegroIndeksGtin(o);if(gtin){produkt=indeks.get(`gtin:${gtin}`)||null;if(produkt)kod=`gtin:${gtin}`;}const kody=[o.externalId,o.sku,o.id],dodatkowe=zZamowien.get(String(o.id||""));if(dodatkowe)kody.push(...dodatkowe);for(const k of kody){if(produkt)break;for(const klucz of allegroKluczeKodu(k)){const p=indeks.get(klucz);if(p){produkt=p;kod=klucz;break;}}}if(!produkt){const nazwy=[o.name];if(dodatkowe)nazwy.push(...[...dodatkowe].filter(x=>!allegroKluczeKodu(x).length||String(x).length>18));for(const n of nazwy){produkt=allegroDopasujProduktPoNazwie(n,produktyLista);if(produkt){kod="nazwa";break;}}}if(produkt)wyniki.push({offerId:String(o.id),productId:String(produkt.id),produkt,oferta:o,kod});});return wyniki;}
