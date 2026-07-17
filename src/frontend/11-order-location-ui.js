/* Informacyjna lokalizacja pozycji zamówień sklepu i Allegro. Brak lokalizacji nigdy nie blokuje realizacji. */
function magazynLokalizacjaStatusHTML(kod="",brakOpis="Informacja dla magazynu — nie blokuje obsługi"){
  const value=String(kod||"").trim();
  return value?`<span class="warehouse-order-location is-set"><b>📍 ${esc(sciezkaNazwLokalizacjiMagazynu(value)||nazwaLokalizacjiMagazynu(value))}</b><small>${esc(value)}</small></span>`:`<span class="warehouse-order-location is-missing"><b>📍 Brak lokalizacji</b><small>${esc(brakOpis)}</small></span>`;
}
function allegroLokalizacjaPozycjiHTML(p={}){
  const kod=String(p.lokalizacja||p.produkt&&magazynMetaProduktu(p.produkt.id).lokalizacja||"").trim();
  return magazynLokalizacjaStatusHTML(kod);
}
function adminKluczPozycjiMagazynowej(value=""){
  const raw=String(value||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
  return /^\d+$/.test(raw)?raw.replace(/^0+(?=\d)/,""):raw;
}
function adminProduktDlaPozycjiZamowienia(item={}){
  const katalog=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)),direct=[item.produktId,item.productId,item.id].map(v=>v===null||v===undefined?"":String(v)).filter(Boolean);
  let hit=katalog.find(p=>direct.includes(String(p.id)));if(hit)return hit;
  const codes=[item.ean,item.gtin,item.sku,item.externalId,item.kodProducenta,item.mpn,item.kod].map(adminKluczPozycjiMagazynowej).filter(Boolean);
  if(codes.length){hit=katalog.find(p=>[p.gtin,p.ean,p.sku,p.externalId,p.kodProducenta,p.mpn,p.kod].map(adminKluczPozycjiMagazynowej).some(code=>code&&codes.includes(code)));if(hit)return hit;}
  const name=String(item.nazwa||item.produkt||"").trim().toLowerCase().replace(/\s+/g," ");if(!name)return null;
  const matches=katalog.filter(p=>String(p.nazwa||"").trim().toLowerCase().replace(/\s+/g," ")===name);return matches.length===1?matches[0]:null;
}
function adminLokalizacjaPozycjiZamowieniaHTML(item={}){
  const produkt=adminProduktDlaPozycjiZamowienia(item),kod=produkt?String(magazynMetaProduktu(produkt.id).lokalizacja||"").trim():"";
  return magazynLokalizacjaStatusHTML(kod,produkt?"Informacja dla magazynu — nie blokuje obsługi":"Nie rozpoznano kartoteki produktu");
}
