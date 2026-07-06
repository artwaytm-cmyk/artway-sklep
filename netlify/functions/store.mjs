// Artway-TM — wspólna baza sklepu na Netlify Blobs
// Funkcja serwerowa: ustawienia, zamówienia, klienci — widoczne na każdym urządzeniu.
// Endpoint: /.netlify/functions/store  (alias /api/store)
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'artway-sklep';

const KLUCZE_WSPOLNE = [
'artway_ustawienia',
'artway_produkty_dodane',
'artway_produkty_edytowane',
'artway_produkty_ukryte',
'artway_produkty_definitywne',
'artway_stany',
'artway_opinie',
'artway_kosz_dodane',
'artway_kosz_meta',
];

const LIMIT_USTAWIEN = 4 * 1024 * 1024;
const LIMIT_ZAMOWIEN = 20000;
const LIMIT_KLIENTOW = 20000;

function baza() {
return getStore({ name: STORE_NAME, consistency: 'strong' });
}
async function czytaj(klucz, domyslne) {
try {
const v = await baza().get(klucz, { type: 'json' });
return (v === null || v === undefined) ? domyslne : v;
} catch (e) {
return domyslne;
}
}
async function zapisz(klucz, wartosc) {
await baza().setJSON(klucz, wartosc);
}

function odpowiedz(body, status = 200) {
return new Response(JSON.stringify(body), {
status,
headers: {
'content-type': 'application/json; charset=utf-8',
'cache-control': 'no-store',
'access-control-allow-origin': '*',
'access-control-allow-headers': 'content-type, x-admin-token',
'access-control-allow-methods': 'GET, POST, OPTIONS',
},
});
}

function bezpiecznePorownanie(a, b) {
if (typeof a !== 'string' || typeof b !== 'string') return false;
if (a.length !== b.length) return false;
let r = 0;
for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
return r === 0;
}
function tokenZadania(req, url) {
return req.headers.get('x-admin-token') || url.searchParams.get('token') || '';
}
function czyAdmin(req, url) {
const env = process.env.ARTWAY_ADMIN_TOKEN || '';
if (!env) return false;
return bezpiecznePorownanie(tokenZadania(req, url), env);
}

function tekst(v, max = 200) {
return String(v == null ? '' : v).slice(0, max);
}

function oczyscUstawienia(obj) {
const wynik = {};
if (!obj || typeof obj !== 'object') return wynik;
for (const k of KLUCZE_WSPOLNE) {
if (k in obj && obj[k] !== undefined) wynik[k] = obj[k];
}
return wynik;
}

function normalizujZamowienie(z) {
if (!z || typeof z !== 'object') return null;
const nr = tekst(z.nr, 80).trim();
if (!nr) return null;
z.nr = nr;
z.ts = Number(z.ts) || Date.now();
z.email = tekst(z.email, 200).trim().toLowerCase();
return z;
}
function normalizujKlienta(u) {
if (!u || typeof u !== 'object') return null;
const email = tekst(u.email, 200).trim().toLowerCase();
if (!email) return null;
u.email = email;
return u;
}

async function odejmijStany(zamowienie) {
try {
const pozycje = Array.isArray(zamowienie?.pozycjeDane) ? zamowienie.pozycjeDane : [];
if (!pozycje.length) return;
const ust = await czytaj('settings', { data: {}, rev: 0 });
const dane = ust.data || {};
const stany = (dane.artway_stany && typeof dane.artway_stany === 'object') ? { ...dane.artway_stany } : {};
let zmiana = false;
for (const p of pozycje) {
const id = p && (p.id != null ? String(p.id) : '');
const ile = Number(p && p.ilosc) || 0;
if (!id || ile <= 0) continue;
if (id in stany && stany[id] !== '' && stany[id] != null && !Number.isNaN(Number(stany[id]))) {
stany[id] = Math.max(0, Number(stany[id]) - ile);
zmiana = true;
}
}
if (zmiana) {
dane.artway_stany = stany;
await zapisz('settings', { ...ust, data: dane, updated_at: new Date().toISOString() });
}
} catch (e) {}
}

export default async (req) => {
const url = new URL(req.url);
const action = url.searchParams.get('action') || 'health';

if (req.method === 'OPTIONS') return odpowiedz({ ok: true });

try {
if (action === 'health') {
const s = await czytaj('settings', { updated_at: null });
const o = await czytaj('orders', { items: [] });
const u = await czytaj('users', { items: [] });
return odpowiedz({
ok: true,
configured: !!process.env.ARTWAY_ADMIN_TOKEN,
admin: czyAdmin(req, url),
store: {
orders: (o.items || []).length,
users: (u.items || []).length,
settings_updated_at: s.updated_at || null,
},
});
}

if (action === 'pull' || action === 'store-data') {
const s = await czytaj('settings', { data: {}, rev: 0, updated_at: null });
const res = { ok: true, settings: s.data || {}, rev: s.rev || 0, updated_at: s.updated_at || null };
if (czyAdmin(req, url)) {
const o = await czytaj('orders', { items: [] });
const u = await czytaj('users', { items: [] });
res.orders = o.items || [];
res.users = u.items || [];
}
return odpowiedz(res);
}

if (action === 'settings') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnien administratora', code: 'auth' }, 401);
const body = await req.json().catch(() => ({}));
const dane = oczyscUstawienia(body.settings);
const rozmiar = JSON.stringify(dane).length;
if (rozmiar > LIMIT_USTAWIEN) return odpowiedz({ ok: false, error: 'Ustawienia sa zbyt duze' }, 413);
const prev = await czytaj('settings', { rev: 0 });
const rec = { data: dane, rev: (prev.rev || 0) + 1, updated_at: new Date().toISOString() };
await zapisz('settings', rec);
return odpowiedz({ ok: true, rev: rec.rev, updated_at: rec.updated_at });
}

if (action === 'store-order-create') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
const body = await req.json().catch(() => ({}));
const zam = normalizujZamowienie(body.order);
if (!zam) return odpowiedz({ ok: false, error: 'Brak danych zamowienia' }, 422);
const rec = await czytaj('orders', { items: [] });
const items = Array.isArray(rec.items) ? rec.items : [];
if (!items.some((x) => x.nr === zam.nr)) {
items.unshift(zam);
while (items.length > LIMIT_ZAMOWIEN) items.pop();
await zapisz('orders', { items, updated_at: new Date().toISOString() });
await odejmijStany(zam);
}
return odpowiedz({ ok: true, stored: true, number: zam.nr });
}

if (action === 'store-review-add') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
const body = await req.json().catch(() => ({}));
const op = body.review;
if (!op || typeof op !== 'object') return odpowiedz({ ok: false, error: 'Brak danych opinii' }, 422);
const rec = await czytaj('settings', { data: {}, rev: 0 });
const dane = rec.data || {};
const lista = Array.isArray(dane.artway_opinie) ? dane.artway_opinie : [];
op.status = 'oczekuje';
op.serwer = true;
lista.unshift(op);
while (lista.length > 5000) lista.pop();
dane.artway_opinie = lista;
await zapisz('settings', { ...rec, data: dane, updated_at: new Date().toISOString() });
return odpowiedz({ ok: true, stored: true });
}

if (action === 'store-orders-mine') {
const email = tekst(url.searchParams.get('email'), 200).trim().toLowerCase();
if (!email) return odpowiedz({ ok: true, orders: [] });
const rec = await czytaj('orders', { items: [] });
const moje = (rec.items || []).filter((z) => (z.email || '').toLowerCase() === email);
return odpowiedz({ ok: true, orders: moje });
}

if (action === 'store-sync') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnien administratora', code: 'auth' }, 401);
const body = await req.json().catch(() => ({}));
const przychodzaceZ = Array.isArray(body.orders) ? body.orders : [];
const przychodzacyU = Array.isArray(body.users) ? body.users : [];
const recO = await czytaj('orders', { items: [] });
const orders = Array.isArray(recO.items) ? recO.items : [];
const numery = new Set(orders.map((z) => z.nr));
for (const raw of przychodzaceZ) {
const z = normalizujZamowienie(raw);
if (z && !numery.has(z.nr)) { orders.unshift(z); numery.add(z.nr); }
}
orders.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
while (orders.length > LIMIT_ZAMOWIEN) orders.pop();
await zapisz('orders', { items: orders, updated_at: new Date().toISOString() });
const recU = await czytaj('users', { items: [] });
const users = Array.isArray(recU.items) ? recU.items : [];
const maile = new Set(users.map((u) => (u.email || '').toLowerCase()));
for (const raw of przychodzacyU) {
const u = normalizujKlienta(raw);
if (u && !maile.has(u.email)) { users.push(u); maile.add(u.email); }
}
while (users.length > LIMIT_KLIENTOW) users.pop();
await zapisz('users', { items: users, updated_at: new Date().toISOString() });
return odpowiedz({ ok: true, orders, users, updated_at: new Date().toISOString() });
}

if (action === 'store-order-save') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnien administratora', code: 'auth' }, 401);
const body = await req.json().catch(() => ({}));
const zam = normalizujZamowienie(body.order);
if (!zam) return odpowiedz({ ok: false, error: 'Brak danych zamowienia' }, 422);
const rec = await czytaj('orders', { items: [] });
const items = Array.isArray(rec.items) ? rec.items : [];
const i = items.findIndex((x) => x.nr === zam.nr);
if (i >= 0) items[i] = zam; else items.unshift(zam);
await zapisz('orders', { items, updated_at: new Date().toISOString() });
return odpowiedz({ ok: true, stored: true, number: zam.nr });
}
if (action === 'store-order-delete') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnien administratora', code: 'auth' }, 401);
const body = await req.json().catch(() => ({}));
const nr = tekst(body.number, 80).trim();
const rec = await czytaj('orders', { items: [] });
const items = (rec.items || []).filter((x) => x.nr !== nr);
await zapisz('orders', { items, updated_at: new Date().toISOString() });
return odpowiedz({ ok: true, deleted: true });
}

if (action === 'store-user-save' || action === 'account-profile-save') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
const body = await req.json().catch(() => ({}));
const u = normalizujKlienta(body.user);
if (!u) return odpowiedz({ ok: false, error: 'Brak danych klienta' }, 422);
const rec = await czytaj('users', { items: [] });
const items = Array.isArray(rec.items) ? rec.items : [];
const i = items.findIndex((x) => (x.email || '').toLowerCase() === u.email);
if (i >= 0) items[i] = { ...items[i], ...u }; else items.push(u);
await zapisz('users', { items, updated_at: new Date().toISOString() });
return odpowiedz({ ok: true, stored: true, email: u.email });
}
if (action === 'store-user-delete') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
if (!czyAdmin(req, url)) return odpowiedz({ ok: false, error: 'Brak uprawnien administratora', code: 'auth' }, 401);
const body = await req.json().catch(() => ({}));
const email = tekst(body.email, 200).trim().toLowerCase();
const rec = await czytaj('users', { items: [] });
const items = (rec.items || []).filter((x) => (x.email || '').toLowerCase() !== email);
await zapisz('users', { items, updated_at: new Date().toISOString() });
return odpowiedz({ ok: true, deleted: true });
}

if (action === 'login') {
if (req.method !== 'POST') return odpowiedz({ ok: false, error: 'Metoda niedozwolona' }, 405);
const body = await req.json().catch(() => ({}));
const podane = tekst(body.password || body.token, 500);
const env = process.env.ARTWAY_ADMIN_TOKEN || '';
if (!env) return odpowiedz({ ok: false, error: 'Serwer nie ma ustawionego hasla (ARTWAY_ADMIN_TOKEN).', code: 'no_token' }, 503);
if (!bezpiecznePorownanie(podane, env)) return odpowiedz({ ok: false, error: 'Nieprawidlowe haslo administratora', code: 'auth' }, 401);
return odpowiedz({ ok: true, authenticated: true });
}

return odpowiedz({ ok: false, error: 'Nieznana akcja: ' + action }, 404);
} catch (e) {
return odpowiedz({ ok: false, error: 'Blad serwera: ' + (e && e.message ? e.message : String(e)) }, 500);
}
};
