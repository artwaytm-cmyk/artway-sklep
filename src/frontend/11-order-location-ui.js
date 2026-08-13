/* Informacyjna lokalizacja pozycji zamówień sklepu i Allegro. Brak lokalizacji nigdy nie blokuje realizacji. */
function magazynLokalizacjaStatusHTML(kod="",brakOpis="Informacja dla magazynu — nie blokuje obsługi",status=""){
  if(status==="unavailable")return `<span class="warehouse-order-location is-unavailable"><b>⛔ Brak sztuki do pobrania</b><small>${esc(brakOpis||"Oczekuje na dostawę — przypisana półka nie jest trasą kompletacji.")}</small></span>`;
  const value=String(kod||"").trim();
  return value?`<span class="warehouse-order-location is-set"><b>📍 ${esc(sciezkaNazwLokalizacjiMagazynu(value)||nazwaLokalizacjiMagazynu(value))}</b><small>${esc(value)}</small></span>`:`<span class="warehouse-order-location is-missing"><b>📍 Brak lokalizacji</b><small>${esc(brakOpis)}</small></span>`;
}
function allegroLokalizacjaPozycjiHTML(p={}){
  if(p.decyzja==="zamow_u_producenta"||Number(p.brak||0)>0||p.stan===0)return magazynLokalizacjaStatusHTML("","Oczekuje na dostawę — półka kartoteki nie jest miejscem pobrania.","unavailable");
  const produkt=p.produkt||p.product||{},catalog=produkt?._catalog?.inventory||{};
  const kod=String(p.lokalizacja||p.location||catalog.lokalizacja||catalog.location||produkt&&magazynMetaProduktu(produkt.id).lokalizacja||"").trim();
  return magazynLokalizacjaStatusHTML(kod);
}
function adminKluczPozycjiMagazynowej(value=""){
  const raw=String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  return /^\d+$/.test(raw)?raw.replace(/^0+(?=\d)/,""):raw;
}
function adminProduktDlaPozycjiZamowienia(item={}){
  const katalog=(typeof produktyMagazynuPelne==="function"?produktyMagazynuPelne():produktyDoAdministracji()).filter(p=>!czyProduktAdminWKoszu(p)||Number(stanMagazynuId(p.id)||0)>0),direct=[item.produktId,item.productId,item.id].map(v=>v===null||v===undefined?"":String(v)).filter(Boolean);
  let hit=katalog.find(p=>direct.includes(String(p.id)));if(hit)return hit;
  const codes=[item.ean,item.gtin,item.sku,item.externalId,item.kodProducenta,item.mpn,item.kod].map(adminKluczPozycjiMagazynowej).filter(Boolean);
  if(codes.length){hit=katalog.find(p=>[p.gtin,p.ean,p.sku,p.externalId,p.kodProducenta,p.mpn,p.kod].map(adminKluczPozycjiMagazynowej).some(code=>code&&codes.includes(code)));if(hit)return hit;}
  const name=String(item.nazwa||item.produkt||"").trim().toLowerCase().replace(/\s+/g," ");if(!name)return null;
  const matches=katalog.filter(p=>String(p.nazwa||"").trim().toLowerCase().replace(/\s+/g," ")===name);return matches.length===1?matches[0]:null;
}
function adminLokalizacjaPozycjiZamowieniaHTML(item={},zamowienie={}){
  const produkt=adminProduktDlaPozycjiZamowienia(item),catalog=produkt?._catalog?.inventory||{},kod=produkt?String(catalog.lokalizacja||catalog.location||magazynMetaProduktu(produkt.id).lokalizacja||"").trim():"";
  if(produkt){
    const nr=String(zamowienie?.nr||""),przydzial=nr&&typeof przydzialyMagazynoweAktywnychZamowien==="function"?przydzialyMagazynoweAktywnychZamowien().get(`sklep:${nr}:${produkt.id}`):null,stan=stanMagazynuId(produkt.id),rezerwacje=typeof rezerwacjeMagazynowe==="function"?Number(rezerwacjeMagazynowe()[produkt.id]||0):0;
    if(Number(przydzial?.shortage||0)>0||stan!==null&&(stan<=0||!nr&&rezerwacje>stan))return magazynLokalizacjaStatusHTML("","Oczekuje na dostawę — półka kartoteki nie jest miejscem pobrania.","unavailable");
  }
  return magazynLokalizacjaStatusHTML(kod,produkt?"Informacja dla magazynu — nie blokuje obsługi":"Nie rozpoznano kartoteki produktu");
}
