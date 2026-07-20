/* ═══════════ KATALOG ADMINA — INDEKS I CACHE DLA DUŻEGO ASORTYMENTU ═══════════ */
let asortymentIndeksCache={revision:-1,source:null,offers:null,mappings:null,states:null,availability:null,hidden:null,added:null,imported:null,value:null};
let asortymentWynikiCache={index:null,signature:"",value:null};

function asortymentSzybkieOfertyProduktu(p={},index=allegroIndeksOfert()){
  const wynik=new Map(),dodaj=lista=>{for(const oferta of lista||[]){const id=String(oferta?.id||"");if(id)wynik.set(id,oferta);}};
  const direct=String(p.allegroOfferId||"").trim();if(direct&&index.byId.has(direct))dodaj([index.byId.get(direct)]);
  dodaj(index.byProduct.get(String(p.id??"")));
  if(p.allegroProductId)dodaj(index.byCatalog.get(String(p.allegroProductId)));
  const external=allegroIndeksKandydatowKlucz(p.externalId||p.sku||p.kodProducenta||p.mpn);if(external)dodaj(index.byExternal.get(external));
  const gtin=allegroIndeksKanonicznyGtin(p.gtin||p.ean);if(gtin)dodaj(index.byEan.get(gtin));
  const code=allegroIndeksKandydatowKlucz(p.kodProducenta||p.mpn);if(code)dodaj(index.byCode.get(code));
  if(!wynik.size){const name=allegroIndeksKandydatowKlucz(p.nazwa||p.name);if(name)dodaj(index.byName.get(name));}
  return [...wynik.values()];
}
function asortymentTekstWyszukiwania(p={},offer=null){
  return normalizujSzukanyTekst([p.nazwa,p.opisKrotki,p.opis,p.kategoria,p.sku,p.gtin,p.ean,p.externalId,p.mpn,p.kodProducenta,p.allegroOfferId,offer?.id,p.producent,p.marka,p.kolorProduktu,p.rozmiar,p.material,(p.warianty||[]).join(" "),p.id].join(" "));
}

function asortymentIndeksDanych(){
  const source=produktyDoAdministracji(),revision=Number(adminRewizjaDanych)||0;
  const same=asortymentIndeksCache.revision===revision&&asortymentIndeksCache.source===source&&asortymentIndeksCache.offers===allegroOferty&&asortymentIndeksCache.mappings===allegroMapowania&&asortymentIndeksCache.states===stanyProduktow&&asortymentIndeksCache.availability===dostepnoscProduktow&&asortymentIndeksCache.hidden===produktyUkryte&&asortymentIndeksCache.added===produktyDodane&&asortymentIndeksCache.imported===produktyImportowane;
  if(same&&asortymentIndeksCache.value)return asortymentIndeksCache.value;
  const audytSklep=audytDuplikatowSklepu(),allegroIndex=allegroIndeksOfert(),allegroDuplicateGroups=[],allegroDuplicateOfferIds=new Set(),offerById=new Map(),metaById=new Map(),categories=new Set(),producers=new Set(),active=[],addedIds=new Set((produktyDodane||[]).map(p=>String(p.id))),importedIds=new Set((produktyImportowane||[]).map(p=>String(p.id)));
  const counts={connected:0,missing:0,ready:0,hidden:0,promotions:0,trash:0};
  for(const p of source){
    const id=String(p.id),offers=asortymentSzybkieOfertyProduktu(p,allegroIndex),activeOffers=offers.filter(o=>allegroDopasowanieDuplikatuAktywne({offer:o})),offer=activeOffers[0]||offers[0]||null,missing=asortymentBrakiDanych(p),trash=czyProduktAdminWKoszu(p),available=produktDostepnyWSprzedazy(p),manualUnavailable=produktOznaczonyNiedostepny(p),autoUnavailable=produktAutomatycznieNiedostepny(p);
    if(activeOffers.length>1){const dopasowania=activeOffers.map(offer=>({offer,score:100,reason:"powiązanie indeksu ofert"}));allegroDuplicateGroups.push({produkt:p,dopasowania});activeOffers.forEach(o=>allegroDuplicateOfferIds.add(String(o.id)));}
    if(offer)offerById.set(id,offer);if(p.kategoria)categories.add(String(p.kategoria).trim());const producer=String(p.producent||p.marka||"").trim();if(producer)producers.add(producer);
    metaById.set(id,{offer,missing,trash,available,manualUnavailable,autoUnavailable,search:null});
    if(trash){counts.trash++;continue;}active.push(p);if(offer)counts.connected++;if(missing.length)counts.missing++;else if(available)counts.ready++;if(!available)counts.hidden++;if(Number(p.staraCena)>Number(p.cena))counts.promotions++;
  }
  const audytAllegro={grupy:allegroDuplicateGroups,offerIds:allegroDuplicateOfferIds,produkty:allegroDuplicateGroups.length,oferty:allegroDuplicateOfferIds.size};
  const value={revision,source,audytSklep,audytAllegro,offerById,metaById,active,addedIds,importedIds,categories:[...categories].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pl")),producers:[...producers].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pl")),counts};
  asortymentIndeksCache={revision,source,offers:allegroOferty,mappings:allegroMapowania,states:stanyProduktow,availability:dostepnoscProduktow,hidden:produktyUkryte,added:produktyDodane,imported:produktyImportowane,value};asortymentWynikiCache={index:null,signature:"",value:null};return value;
}

function asortymentSygnaturaFiltrow(){
  return JSON.stringify([szukajProduktow,filtrProduktow,filtrStatusuProduktow,filtrZrodlaProduktow,filtrStanuProduktow,filtrAllegroProduktow,filtrProducentaProduktow,filtrDanychProduktow,filtrSprzedazyProduktow,filtrPromocjiProduktow,filtrLinkuProduktow,cenaOdAdminProduktow,cenaDoAdminProduktow,cenaAllegroOdAdminProduktow,cenaAllegroDoAdminProduktow,sortowanieAdminProduktow]);
}

function asortymentFiltrowaneProdukty(index=asortymentIndeksDanych()){
  const signature=asortymentSygnaturaFiltrow();if(asortymentWynikiCache.index===index&&asortymentWynikiCache.signature===signature&&asortymentWynikiCache.value)return asortymentWynikiCache.value;
  const query=normalizujSzukanyTekst(szukajProduktow).split(" ").filter(Boolean),duplicateStore=filtrStatusuProduktow==="duplikaty"?new Set(index.audytSklep.grupy.flatMap(g=>g.produkty.map(p=>String(p.id)))):null,duplicateAllegro=filtrAllegroProduktow==="duplikaty"?new Set((index.audytAllegro.grupy||[]).map(g=>String(g?.produkt?.id??"")).filter(Boolean)):null;
  const minStore=parseFloat(String(cenaOdAdminProduktow||"").replace(",",".")),maxStore=parseFloat(String(cenaDoAdminProduktow||"").replace(",",".")),minAllegro=parseFloat(String(cenaAllegroOdAdminProduktow||"").replace(",",".")),maxAllegro=parseFloat(String(cenaAllegroDoAdminProduktow||"").replace(",","."));
  const items=index.source.filter(p=>{
    const id=String(p.id),m=index.metaById.get(id),offer=m.offer,stock=stanyProduktow[p.id],missing=m.missing,sourceUrl=String(p.sourceUrl||p.producentUrl||p.urlProducenta||"").trim();
    if(query.length){if(m.search===null)m.search=asortymentTekstWyszukiwania(p,offer);if(!query.every(word=>m.search.includes(word)))return false;}
    if(filtrProduktow!=="Wszystkie"&&p.kategoria!==filtrProduktow)return false;
    if(filtrStatusuProduktow==="aktywne"&&m.trash||filtrStatusuProduktow==="kosz"&&!m.trash||filtrStatusuProduktow==="duplikaty"&&!duplicateStore.has(id))return false;
    if(filtrZrodlaProduktow==="bazowe"&&(index.addedIds.has(id)||index.importedIds.has(id))||filtrZrodlaProduktow==="wlasne"&&!index.addedIds.has(id)&&!index.importedIds.has(id))return false;
    if(filtrStanuProduktow==="dostepne"&&stock!==undefined&&Number(stock)<=0||filtrStanuProduktow==="niskie"&&!(Number(stock)>0&&Number(stock)<=5)||filtrStanuProduktow==="brak"&&Number(stock)!==0)return false;
    const offerStatus=String(offer?.status||"").toUpperCase();if(filtrAllegroProduktow==="aktywne"&&offerStatus!=="ACTIVE"||filtrAllegroProduktow==="szkice"&&(!offer||offerStatus==="ACTIVE")||filtrAllegroProduktow==="polaczone"&&!offer||filtrAllegroProduktow==="brak"&&offer||filtrAllegroProduktow==="duplikaty"&&!duplicateAllegro.has(id))return false;
    if(filtrProducentaProduktow!=="wszyscy"&&String(p.producent||p.marka||"")!==filtrProducentaProduktow)return false;
    if(filtrDanychProduktow==="gotowe"&&missing.length||filtrDanychProduktow==="braki"&&!missing.length||filtrDanychProduktow==="ean"&&!missing.includes("EAN")||filtrDanychProduktow==="zdjecie"&&!missing.includes("zdjęcie")||filtrDanychProduktow==="opis"&&!missing.includes("opis")||filtrDanychProduktow==="zrodlo"&&!missing.includes("źródło")||filtrDanychProduktow==="producent"&&!missing.includes("producent")||filtrDanychProduktow==="kategoria"&&!missing.includes("kategoria")||filtrDanychProduktow==="koszt"&&Number(p.cenaZakupu)>0)return false;
    if(filtrSprzedazyProduktow==="dostepne"&&!m.available||filtrSprzedazyProduktow==="niedostepne"&&m.available||filtrSprzedazyProduktow==="reczne"&&!m.manualUnavailable||filtrSprzedazyProduktow==="automat"&&!m.autoUnavailable)return false;
    if(filtrPromocjiProduktow==="promocje"&&!(Number(p.staraCena)>Number(p.cena))||filtrPromocjiProduktow==="regularne"&&Number(p.staraCena)>Number(p.cena)||filtrPromocjiProduktow==="nowosci"&&!String(p.badge||"").toLowerCase().includes("nowo"))return false;
    if(filtrLinkuProduktow==="z_linkiem"&&!sourceUrl||filtrLinkuProduktow==="bez_linku"&&sourceUrl)return false;
    const storePrice=kwotaNum(p.cena),allegroPrice=kwotaNum(p.cenaAllegro||p.cena);if(Number.isFinite(minStore)&&storePrice<minStore||Number.isFinite(maxStore)&&storePrice>maxStore||Number.isFinite(minAllegro)&&allegroPrice<minAllegro||Number.isFinite(maxAllegro)&&allegroPrice>maxAllegro)return false;
    return true;
  });
  const sorted=sortujProduktyAdmin(items),value={items:sorted,ids:sorted.map(p=>p.id)};asortymentWynikiCache={index,signature,value};return value;
}
