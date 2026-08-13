import { createStoreRepository } from '../core/store-repository.mjs';

export const STORE_SHIPPING_DEFAULTS = Object.freeze({
  lockerPrice: 16,
  courierPrice: 20,
  freeFrom: 150,
  weekendPrice: 5,
  cashOnDeliveryPrice: 8,
  dispatchTime: '48 h',
});

const money = (value, fallback) => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const number = Number(raw.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : fallback;
};

const text = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const html = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

function dispatchTime(value) {
  const normalized = text(value, 80) || STORE_SHIPPING_DEFAULTS.dispatchTime;
  return normalized.replace(/^(\d+)\s*h$/i, '$1 h');
}

function settingsObject(settingsData = {}) {
  if (settingsData?.artway_ustawienia && typeof settingsData.artway_ustawienia === 'object') return settingsData.artway_ustawienia;
  return settingsData && typeof settingsData === 'object' ? settingsData : {};
}

function configuredMethod(config, ids, namePart) {
  const methods = Array.isArray(config.dostawy) ? config.dostawy : [];
  return methods.find((method) => ids.includes(String(method?.id || '').toLowerCase()))
    || methods.find((method) => String(method?.nazwa || '').toLowerCase().includes(namePart))
    || {};
}

export function storeShippingConfig(settingsData = {}, { updatedAt = null } = {}) {
  const settings = settingsObject(settingsData);
  const locker = configuredMethod(settings, ['paczkomat'], 'paczkomat');
  const courier = configuredMethod(settings, ['kurier_inpost', 'kurier'], 'kurier');
  const lockerPrice = money(locker.koszt ?? settings.kosztPaczkomat, STORE_SHIPPING_DEFAULTS.lockerPrice);
  const courierPrice = money(courier.koszt ?? settings.kosztKurierInpost ?? settings.kosztKurier, STORE_SHIPPING_DEFAULTS.courierPrice);
  const freeFrom = money(settings.darmowaDostawaOd, STORE_SHIPPING_DEFAULTS.freeFrom);
  const weekendPrice = money(settings.oplataPaczkaWeekend, STORE_SHIPPING_DEFAULTS.weekendPrice);
  const cashOnDelivery = (Array.isArray(settings.platnosci) ? settings.platnosci : []).find((payment) => payment?.id === 'pobranie') || {};
  const cashOnDeliveryPrice = money(cashOnDelivery.oplata ?? settings.oplataPobranie, STORE_SHIPPING_DEFAULTS.cashOnDeliveryPrice);
  const dispatch = dispatchTime(settings.czasWysylki);
  const methods = [
    {
      id: 'paczkomat',
      name: text(locker.nazwa, 100) || 'Paczkomat® / PaczkoPunkt InPost',
      description: text(locker.opis, 300) || 'odbiór w wybranym automacie lub punkcie InPost',
      price: lockerPrice,
    },
    {
      id: 'kurier_inpost',
      name: text(courier.nazwa, 100) || 'Kurier InPost',
      description: text(courier.opis, 300) || 'dostawa kurierem InPost pod wskazany adres',
      price: courierPrice,
    },
  ];
  const version = encodeURIComponent([lockerPrice, courierPrice, freeFrom, weekendPrice, cashOnDeliveryPrice, dispatch, updatedAt || ''].join('|')).slice(0, 240);
  return Object.freeze({
    settings,
    methods,
    locker: methods[0],
    courier: methods[1],
    freeFrom,
    weekendPrice,
    cashOnDeliveryPrice,
    dispatchTime: dispatch,
    updatedAt,
    version,
  });
}

let repository;

function storeRepository() {
  if (!repository) repository = createStoreRepository({ name: 'artway-sklep' });
  return repository;
}

export async function loadStoreShippingConfig() {
  const record = await storeRepository().read('settings', { data: {}, updated_at: null });
  return storeShippingConfig(record?.data || {}, { updatedAt: record?.updated_at || null });
}

export function shippingMethod(config, id) {
  const normalized = String(id || '').toLowerCase();
  return config.methods.find((method) => method.id === normalized)
    || (normalized === 'kurier' ? config.courier : null);
}

export function shippingTopbarHtml(config) {
  return `🚚 Darmowa dostawa od ${config.freeFrom.toFixed(2).replace(/\.00$/, '')} zł &nbsp;•&nbsp; 📦 Wysyłka w ${html(text(config.dispatchTime, 80))} &nbsp;•&nbsp; ↩️ 14 dni na zwrot`;
}
