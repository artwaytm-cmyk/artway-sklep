import { tekst } from '../core/http.mjs';

export function numerZamowienia(value) {
  return tekst(value, 80).trim();
}

export function normalizujZamowienie(order, now = Date.now()) {
  if (!order || typeof order !== 'object') return null;
  const number = numerZamowienia(order.nr);
  if (!number) return null;
  order.nr = number;
  order.ts = Number(order.ts) || now;
  order.email = tekst(order.email, 200).trim().toLowerCase();
  return order;
}

export function normalizujKlienta(customer) {
  if (!customer || typeof customer !== 'object') return null;
  const email = tekst(customer.email, 200).trim().toLowerCase();
  if (!email) return null;
  customer.email = email;
  return customer;
}

export function normalizujUsunieteZamowienie(raw, now = new Date().toISOString()) {
  const number = numerZamowienia(raw?.nr || raw?.number || raw);
  if (!number) return null;
  return {
    nr: number,
    email: tekst(raw?.email, 200).trim().toLowerCase(),
    by: tekst(raw?.by || raw?.kto || 'unknown', 40),
    deleted_at: tekst(raw?.deleted_at || raw?.usunietoAt || now, 80),
  };
}

export function mapaUsunietych(lista = []) {
  const map = new Map();
  for (const raw of Array.isArray(lista) ? lista : []) {
    const record = normalizujUsunieteZamowienie(raw);
    if (record) map.set(record.nr, { ...map.get(record.nr), ...record });
  }
  return map;
}

export function filtrujNieusunieteZamowienia(items, deleted) {
  const map = deleted instanceof Map ? deleted : mapaUsunietych(deleted);
  return (Array.isArray(items) ? items : []).filter((order) => order && order.nr && !map.has(order.nr));
}
