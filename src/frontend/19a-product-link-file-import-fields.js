/* Rozpoznawanie kolumn produktowych dla importu XLSX/CSV.
 * Ten moduł jest celowo oddzielony od parsera archiwum, aby mapowanie pól
 * można było rozwijać bez tworzenia jednego nadmiernie dużego pliku.
 */
;(function productLinkFileImportFieldsModule(global){
  "use strict";

  const PRODUCT_DATA_FIELDS = Object.freeze([
    {key:"producent", label:"producent", score(header){
      if(["producent", "manufacturer", "nazwa producenta"].includes(header)) return 100;
      return header.includes("producent") && !header.includes("kod") ? 85 : 0;
    }},
    {key:"marka", label:"marka", score(header){
      if(["marka", "brand", "nazwa marki"].includes(header)) return 100;
      return header.includes("marka") ? 80 : 0;
    }},
    {key:"cena", label:"cena sprzedaży", score(header){
      if(!header || /(?:zakup|hurt|koszt|netto dostaw)/.test(header)) return 0;
      if(["cena regularna", "cena sprzedazy", "cena detaliczna", "cena brutto", "regular price", "sale price"].includes(header)) return 100;
      if(["cena", "price"].includes(header)) return 85;
      return header.includes("cena") && /(?:regular|sprzedaz|detal|brutto)/.test(header) ? 95 : 0;
    }},
    {key:"cenaZakupu", label:"koszt zakupu", score(header){
      if(["cena zakupu", "koszt zakupu", "cena hurtowa", "cena dostawcy", "purchase price", "wholesale price"].includes(header)) return 100;
      return /(?:cena|koszt)/.test(header) && /(?:zakup|hurt|dostawc)/.test(header) ? 92 : 0;
    }},
    {key:"cenaAllegro", label:"cena Allegro", score(header){return /^(?:cena )?allegro$/.test(header) ? 100 : 0;}},
    {key:"cenaVonHalsky", label:"cena Von Halsky", score(header){return /(?:von halsky|inpost)/.test(header)&&header.includes("cena") ? 100 : 0;}},
    {key:"kategoria", label:"kategoria", score(header){
      if(["kategoria", "kategoria produktu", "category", "product category"].includes(header)) return 100;
      return header.includes("kategori") ? 80 : 0;
    }},
    {key:"ean", label:"EAN / GTIN", score(header){
      if(["ean", "gtin", "ean gtin", "kod ean", "barcode", "kod kreskowy"].includes(header)) return 100;
      return /(?:^| )(?:ean|gtin)(?: |$)/.test(header) ? 90 : 0;
    }},
    {key:"kodProducenta", label:"kod producenta", score(header){
      if(["kod producenta", "mpn", "manufacturer code", "symbol producenta"].includes(header)) return 100;
      return header.includes("producent") && /(?:kod|symbol|numer)/.test(header) ? 90 : 0;
    }},
    {key:"sku", label:"SKU / indeks", score(header){
      if(["sku", "indeks", "index", "kod produktu", "numer katalogowy"].includes(header)) return 100;
      return /(?:^| )sku(?: |$)/.test(header) ? 90 : 0;
    }},
    {key:"opisKrotki", label:"krótki opis", score(header){
      return ["opis krotki", "krotki opis", "short description"].includes(header) ? 100 : 0;
    }},
    {key:"opis", label:"opis", score(header){
      return ["opis", "opis produktu", "description", "product description"].includes(header) ? 90 : 0;
    }},
    {key:"zdjecie", label:"główne zdjęcie", score(header){
      if(["zdjecie", "zdjecie glowne", "link do zdjecia", "url zdjecia", "image", "image url", "photo url"].includes(header)) return 100;
      return /(?:zdjec|image|photo)/.test(header) && /(?:url|link|glown)/.test(header) ? 90 : 0;
    }},
    {key:"minimalnyWiek", label:"minimalny wiek dziecka", score(header){
      if(["minimalny wiek dziecka", "wiek minimalny", "wiek od", "zalecany wiek", "minimum age"].includes(header)) return 100;
      return header.includes("wiek")&&/(?:min|dzieck|od)/.test(header) ? 90 : 0;
    }},
    {key:"liczbaElementow", label:"liczba elementów", score(header){return /^(?:liczba |ilosc )?(?:elementow|czesci|puzzli)$/.test(header) ? 100 : 0;}},
    {key:"material", label:"materiał", score(header){return ["material", "material wykonania", "tworzywo"].includes(header) ? 100 : 0;}},
    {key:"kolorProduktu", label:"kolor", score(header){return ["kolor", "kolor produktu", "color"].includes(header) ? 100 : 0;}},
    {key:"waga", label:"waga", score(header){return ["waga", "waga produktu", "waga brutto", "weight"].includes(header) ? 100 : 0;}},
    {key:"dlugosc", label:"długość", score(header){return ["dlugosc", "dlugosc produktu", "length"].includes(header) ? 100 : 0;}},
    {key:"szerokosc", label:"szerokość", score(header){return ["szerokosc", "szerokosc produktu", "width"].includes(header) ? 100 : 0;}},
    {key:"wysokosc", label:"wysokość", score(header){return ["wysokosc", "wysokosc produktu", "height"].includes(header) ? 100 : 0;}},
    {key:"vonHalskyCategoryId", label:"ID kategorii Von Halsky", score(header){return /^(?:id )?kategorii? (?:von halsky|inpost)$/.test(header) ? 100 : 0;}},
    {key:"vonHalskySafetyInformation", label:"bezpieczeństwo GPSR", score(header){return /(?:gpsr|bezpieczen|ostrzezen)/.test(header) ? 95 : 0;}},
    {key:"gpsrNazwa", label:"GPSR — nazwa producenta", score(header){return /gpsr/.test(header)&&/(?:nazwa|producent)/.test(header) ? 100 : 0;}},
    {key:"gpsrAdres", label:"GPSR — adres", score(header){return /gpsr/.test(header)&&header.includes("adres")&&!header.includes("email") ? 100 : 0;}},
    {key:"gpsrEmail", label:"GPSR — e-mail", score(header){return /gpsr/.test(header)&&/(?:email|e mail)/.test(header) ? 100 : 0;}},
    {key:"gpsrTelefon", label:"GPSR — telefon", score(header){return /gpsr/.test(header)&&/(?:telefon|phone)/.test(header) ? 100 : 0;}},
  ]);

  function parsePolishMoney(value){
    if(typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
    let raw = String(value ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(/[^0-9,.-]/g, "");
    if(!raw || !/\d/.test(raw)) return null;
    const comma = raw.lastIndexOf(","), dot = raw.lastIndexOf(".");
    if(comma >= 0 && dot >= 0){
      const decimal = comma > dot ? "," : ".", thousands = decimal === "," ? /\./g : /,/g;
      raw = raw.replace(thousands, "").replace(decimal, ".");
    }else if(comma >= 0) raw = raw.replace(/\./g, "").replace(",", ".");
    else if((raw.match(/\./g) || []).length > 1) raw = raw.replace(/\.(?=.*\.)/g, "");
    const number = Number(raw);
    return Number.isFinite(number) && number > 0 && number <= 1_000_000 ? Math.round(number * 100) / 100 : null;
  }

  function normalizedProductDataValue(field, value){
    const raw = String(value ?? "").replace(/\u0000/g, "").trim();
    if(!raw) return null;
    if(["cena", "cenaZakupu", "cenaAllegro", "cenaVonHalsky"].includes(field)) return parsePolishMoney(value);
    if(field === "ean") return raw.replace(/\D/g, "").slice(0, 40) || null;
    const limits = {opis:6000, opisKrotki:500, zdjecie:3000, producent:240, marka:240, kategoria:180, kodProducenta:160, sku:160, vonHalskySafetyInformation:100000, gpsrNazwa:300, gpsrAdres:500, gpsrEmail:320, gpsrTelefon:80, vonHalskyCategoryId:100};
    return raw.slice(0, limits[field] || 500);
  }

  global.productLinkFileImportFields = Object.freeze({PRODUCT_DATA_FIELDS, parsePolishMoney, normalizedProductDataValue});
})(typeof window !== "undefined" ? window : globalThis);
