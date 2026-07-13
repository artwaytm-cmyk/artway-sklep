import { tekst } from '../core/http.mjs';
import { numerZamowienia } from './orders.mjs';

function produktyCentralne(data = {}) {
  const map = new Map();
  const add = (product = {}) => {
    const id = tekst(product.id, 100).trim();
    if (id) map.set(id, { ...(map.get(id) || {}), ...product, id: product.id });
  };
  for (const product of Array.isArray(data.artway_produkty_katalog) ? data.artway_produkty_katalog : []) add(product);
  for (const product of Array.isArray(data.artway_produkty_dodane) ? data.artway_produkty_dodane : []) add(product);
  for (const [id, product] of Object.entries(data.artway_produkty_edytowane && typeof data.artway_produkty_edytowane === 'object' ? data.artway_produkty_edytowane : {})) add({ ...(product || {}), id });
  const hidden = new Set([...(Array.isArray(data.artway_produkty_ukryte) ? data.artway_produkty_ukryte : []), ...(Array.isArray(data.artway_produkty_definitywne) ? data.artway_produkty_definitywne : []), ...(Array.isArray(data.artway_kosz_dodane) ? data.artway_kosz_dodane.map((item) => item?.id) : [])].map(String));
  return [...map.values()].filter((product) => !hidden.has(String(product.id)));
}

function kwota(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function bezpieczneZamowienieKlienta(raw, settingsData = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const number = numerZamowienia(source.nr);
  const email = tekst(source.email, 200).trim().toLowerCase();
  if (!/^ATM-[A-Za-z0-9_-]{4,64}$/.test(number) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('Nieprawidłowy numer zamówienia albo adres e-mail.'); error.status = 422; throw error;
  }
  const products = produktyCentralne(settingsData);
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const rawLines = Array.isArray(source.pozycjeDane) ? source.pozycjeDane.slice(0, 100) : [];
  if (!rawLines.length) { const error = new Error('Koszyk jest pusty.'); error.status = 422; throw error; }
  const lines = rawLines.map((line) => {
    const id = tekst(line?.id, 100).trim();
    const product = productMap.get(id);
    const quantity = Math.max(1, Math.min(100, Math.floor(Number(line?.ilosc) || 0)));
    const price = kwota(product?.cena);
    if (!product || price <= 0) { const error = new Error(`Produkt ${id || 'bez identyfikatora'} nie jest dostępny w aktualnym katalogu.`); error.status = 409; error.code = 'product_unavailable'; throw error; }
    return {
      id: product.id,
      nazwa: tekst(product.nazwa, 300).trim(),
      sku: tekst(product.sku || product.externalId, 100).trim(),
      wariant: tekst(line?.wariant, 120).trim(),
      ilosc: quantity,
      cena: price,
      wartosc: kwota(price * quantity),
    };
  });
  const config = settingsData.artway_ustawienia && typeof settingsData.artway_ustawienia === 'object' ? settingsData.artway_ustawienia : {};
  const productsTotal = kwota(lines.reduce((sum, line) => sum + line.wartosc, 0));
  const discountCode = tekst(source.rabatKod, 40).trim().toUpperCase();
  const discounts = config.kodyRabatowe && typeof config.kodyRabatowe === 'object' ? config.kodyRabatowe : {};
  const discountPercent = Math.max(0, Math.min(100, Number(discounts[discountCode]) || 0));
  const discount = kwota(productsTotal * discountPercent / 100);
  const afterDiscount = kwota(productsTotal - discount);
  const deliveryId = ['paczkomat', 'kurier_inpost'].includes(source.dostawaId) ? source.dostawaId : '';
  if (!deliveryId) { const error = new Error('Wybierz prawidłową metodę dostawy InPost.'); error.status = 422; throw error; }
  const deliveryDefaults = { paczkomat: { nazwa: 'Paczkomat InPost 24/7', koszt: 12 }, kurier_inpost: { nazwa: 'Kurier InPost', koszt: 20 } };
  const configuredDelivery = (Array.isArray(config.dostawy) ? config.dostawy : []).find((item) => item?.id === deliveryId);
  const delivery = { ...deliveryDefaults[deliveryId], ...(configuredDelivery || {}) };
  const freeFrom = Math.max(0, Number(config.darmowaDostawaOd) || 200);
  const deliveryCost = afterDiscount >= freeFrom ? 0 : kwota(delivery.koszt);
  const weekend = source.paczkaWeekend === true;
  const weekendCost = weekend ? 5 : 0;
  const paymentId = ['pobranie', 'telefon', 'paynow'].includes(source.platnoscId) ? source.platnoscId : '';
  if (!paymentId) { const error = new Error('Wybierz prawidłową metodę płatności.'); error.status = 422; throw error; }
  const paymentDefaults = { pobranie: { nazwa: 'Za pobraniem — płatność przy odbiorze', oplata: 5 }, telefon: { nazwa: 'Przelew na telefon', oplata: 0 }, paynow: { nazwa: 'mBank Paynow', oplata: 0 } };
  const configuredPayment = (Array.isArray(config.platnosci) ? config.platnosci : []).find((item) => item?.id === paymentId);
  const payment = { ...paymentDefaults[paymentId], ...(configuredPayment || {}) };
  if (payment.wylaczona === true) { const error = new Error('Wybrana metoda płatności jest wyłączona.'); error.status = 409; throw error; }
  const paymentCost = kwota(payment.oplata);
  const total = kwota(afterDiscount + deliveryCost + weekendCost + paymentCost);
  const availabilityChecks = lines.filter((line) => line.ilosc > 5).map((line) => ({ id: line.id, nazwa: line.nazwa, ilosc: line.ilosc }));
  const customer = source.klient && typeof source.klient === 'object' ? source.klient : {};
  const address = source.adresDostawy && typeof source.adresDostawy === 'object' ? source.adresDostawy : {};
  const cleanCustomer = {
    imie: tekst(customer.imie, 100).trim(), nazwisko: tekst(customer.nazwisko, 120).trim(), telefon: tekst(customer.telefon, 40).trim(),
    firma: tekst(customer.firma, 200).trim(), nip: tekst(customer.nip, 20).replace(/\D/g, '').slice(0, 10),
  };
  const cleanAddress = {
    ulica: tekst(address.ulica, 160).trim(), nrDomu: tekst(address.nrDomu, 30).trim(), nrLokalu: tekst(address.nrLokalu, 30).trim(),
    kod: tekst(address.kod, 20).trim(), miasto: tekst(address.miasto, 120).trim(),
  };
  if (!cleanCustomer.imie || !cleanCustomer.nazwisko || !cleanCustomer.telefon || !cleanAddress.ulica || !cleanAddress.nrDomu || !cleanAddress.kod || !cleanAddress.miasto) {
    const error = new Error('Uzupełnij komplet danych klienta i adresu dostawy.'); error.status = 422; throw error;
  }
  const pointCode = deliveryId === 'paczkomat' ? tekst(source.paczkomat, 40).trim().toUpperCase() : '';
  if (deliveryId === 'paczkomat' && !pointCode) { const error = new Error('Wybierz paczkomat InPost.'); error.status = 422; throw error; }
  const addressText = `${cleanAddress.ulica} ${cleanAddress.nrDomu}${cleanAddress.nrLokalu ? `/${cleanAddress.nrLokalu}` : ''}, ${cleanAddress.kod} ${cleanAddress.miasto}`;
  return {
    nr: number,
    data: new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }),
    ts: Date.now(),
    email,
    klient: cleanCustomer,
    adresDostawy: cleanAddress,
    pozycjeDane: lines,
    pozycje: lines.map((line) => `${line.nazwa}${line.wariant ? ` (${line.wariant})` : ''}${line.sku ? ` [${line.sku}]` : ''} × ${line.ilosc}`),
    razem: total,
    status: 'nowe',
    dostawa: tekst(delivery.nazwa, 160), dostawaId: deliveryId, dostawaKoszt: deliveryCost,
    paczkaWeekend: weekend, oplataPaczkaWeekend: weekendCost,
    wymagaPotwierdzeniaDostepnosci: availabilityChecks.length > 0,
    dostepnoscDoPotwierdzenia: availabilityChecks,
    oplataPlatnosci: paymentCost,
    koszty: { produkty: productsTotal, rabat: discount, poRabacie: afterDiscount, dostawa: deliveryCost, paczkaWeekend: weekendCost, platnosc: paymentCost, razem: total },
    rabatKod: discountPercent ? discountCode : '',
    platnosc: tekst(payment.nazwa, 160), platnoscId: paymentId,
    platnoscInstrukcja: paymentId === 'telefon'
      ? `Przelew na telefon 530 038 914. W tytule lub wiadomości wpisz: Zamówienie ${number}. Kwota: ${total.toFixed(2)} zł.`
      : paymentId === 'pobranie' ? `Płatność przy odbiorze: ${total.toFixed(2)} zł.` : '',
    adres: addressText,
    paczkomat: pointCode, paczkomatAdres: deliveryId === 'paczkomat' ? tekst(source.paczkomatAdres, 300).trim() : '',
    uwagi: tekst(source.uwagi, 2000).trim(),
    wysylka: {
      przewoznik: 'inpost', usluga: deliveryId === 'paczkomat' ? 'inpost_locker_standard' : 'inpost_courier_standard', punktKod: pointCode,
      status: 'nieprzygotowana', etap: 'do_obslugi', priorytet: 'normalny', paczkaWeekend: weekend, oplataWeekend: weekendCost,
      dodatkoweUslugi: weekend ? [{ id: 'paczka_weekend', nazwa: 'Paczka w Weekend', koszt: weekendCost }] : [],
      zadania: { dane: true, kompletacja: false, etykieta: false, przekazanie: false },
      historia: [{ czas: new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }), status: 'Zamówienie utworzone', opis: 'Oczekuje na potwierdzenie i przygotowanie' }],
      powiadomienia: [],
    },
  };
}
