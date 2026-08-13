import assert from 'node:assert/strict';
import test from 'node:test';

import { vonHalskyDefaultSettings } from '../src/backend/lib/domain/von-halsky-catalog.mjs';
import {
  renderVonHalskyOrderMessage,
  validateVonHalskyOrderMessage,
  vonHalskyOrderCommunicationHistory,
  vonHalskyOrderCommunicationView,
  vonHalskyOrderContact,
} from '../src/backend/lib/domain/von-halsky-order-communication.mjs';
import { createVonHalskyRoute } from '../src/backend/lib/von-halsky-route.mjs';

const order = {
  id: 'C09Q3VF',
  status: 'ACCEPTED',
  customer: {
    firstName: 'Jan',
    lastName: 'Testowy',
    email: 'stary-adres@example.test',
  },
  delivery: {
    email: 'adres-z-zamowienia@example.test',
    parcels: [{ trackingNumber: 'TRACK-1' }],
  },
  orderLines: [{ quantity: 2, offer: { product: { name: 'Produkt testowy' } } }],
};

test('komunikacja używa odbiorcy zapisanego w zamówieniu i tworzy bezpieczny e-mail transakcyjny', () => {
  assert.deepEqual(vonHalskyOrderContact(order), {
    email: 'adres-z-zamowienia@example.test',
    name: 'Jan Testowy',
  });
  assert.equal(validateVonHalskyOrderMessage({ order, subject: '  Status   zamówienia  ', message: 'Dzień dobry. Zamówienie jest w realizacji.' }).ok, true);
  const rendered = renderVonHalskyOrderMessage({
    order,
    subject: 'Status zamówienia',
    message: 'Dzień dobry.\nPrzesyłka jest przygotowywana.',
  });
  assert.equal(rendered.to, 'adres-z-zamowienia@example.test');
  assert.match(rendered.text, /Zamówienie: C09Q3VF/);
  assert.match(rendered.text, /Numer przesyłki: TRACK-1/);
  assert.match(rendered.html, /ARTWAY-TM/);
  assert.match(rendered.html, /TRACK-1/);
  assert.doesNotMatch(rendered.html, /<script/i);
});

test('historia komunikacji jest ograniczona, uporządkowana i prezentuje stan poczty', () => {
  const withHistory = {
    ...order,
    _artwayCommunication: {
      history: [
        { id: '1', status: 'sent', sentAt: '2026-08-07T08:00:00.000Z' },
        { id: '2', status: 'failed', createdAt: '2026-08-08T08:00:00.000Z' },
      ],
    },
  };
  assert.deepEqual(vonHalskyOrderCommunicationHistory(withHistory).map((item) => item.id), ['2', '1']);
  const view = vonHalskyOrderCommunicationView(withHistory, { configured: true, provider: 'smtp', from: 'sklep@example.test' });
  assert.equal(view.configured, true);
  assert.equal(view.sentCount, 1);
  assert.equal(view.lastSentAt, '2026-08-07T08:00:00.000Z');
  assert.equal(view.platformMessaging, false);
});

test('wysyłka wymaga potwierdzenia, nie przyjmuje odbiorcy z formularza i jest idempotentna', async () => {
  let state = {
    settings: vonHalskyDefaultSettings(),
    sync: {}, diagnostics: [], categories: [], offers: [], orders: [structuredClone(order)],
    returns: [], claims: [], events: [], commands: [], publicationQueue: {},
  };
  let revision = 0;
  const sent = [];
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision }),
    writeIfVersion: async (_key, value) => {
      state = structuredClone(value);
      revision += 1;
      return { modified: true };
    },
    api: {},
    sendEmail: async (payload) => {
      sent.push(payload);
      return { provider: 'smtp', message_id: 'SMTP-1', accepted: [payload.to] };
    },
    emailPublicConfig: () => ({ configured: true, provider: 'smtp', from: 'sklep@example.test' }),
    sessionOf: () => ({ email: 'administrator@example.test' }),
  });
  const call = async (body) => {
    const request = new Request('https://artwaytm.pl/api?action=von-halsky-order-message-send', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return route(request, new URL(request.url), 'von-halsky-order-message-send');
  };
  const requestBody = {
    orderId: 'C09Q3VF',
    requestId: 'vhmsg-test-12345678',
    confirmed: true,
    template: 'status',
    subject: 'Status zamówienia C09Q3VF',
    message: 'Dzień dobry. Zamówienie jest już przygotowywane.',
    to: 'atakujacy@example.test',
  };

  const unconfirmed = await call({ ...requestBody, confirmed: false, requestId: 'vhmsg-test-unconfirmed' });
  assert.equal(unconfirmed.status, 422);
  assert.equal(sent.length, 0);

  const first = await call(requestBody);
  assert.equal(first.status, 200);
  assert.equal(first.body.sent, true);
  assert.equal(first.body.idempotent, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'adres-z-zamowienia@example.test');
  assert.equal(state.orders[0]._artwayCommunication.history.length, 1);
  assert.equal(state.orders[0]._artwayCommunication.history[0].sentBy, 'administrator@example.test');
  assert.equal(state.orders[0]._artwayCommunication.history[0].deliveryStatus, 'accepted_by_server');
  assert.equal(state.orders[0]._artwayCommunication.history[0].deliveryConfirmed, false);

  const repeated = await call(requestBody);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.idempotent, true);
  assert.equal(sent.length, 1, 'ponowienie tego samego żądania nie może wysłać drugiej wiadomości');
});

test('wiadomość nie jest oznaczana jako wysłana, gdy serwer nie przyjął odbiorcy', async () => {
  let state = {
    settings: vonHalskyDefaultSettings(), sync: {}, diagnostics: [], categories: [], offers: [], orders: [structuredClone(order)],
    returns: [], claims: [], events: [], commands: [], publicationQueue: {},
  };
  let revision = 0;
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision }),
    writeIfVersion: async (_key, value) => { state = structuredClone(value); revision += 1; return { modified: true }; },
    api: {},
    sendEmail: async () => ({ provider: 'smtp', message_id: 'SMTP-REJECTED', accepted: [], rejected: ['adres-z-zamowienia@example.test'] }),
    emailPublicConfig: () => ({ configured: true, provider: 'smtp', from: 'sklep@example.test' }),
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-order-message-send', {
    method: 'POST',
    body: JSON.stringify({
      orderId: 'C09Q3VF', requestId: 'vhmsg-rejected-12345678', confirmed: true,
      subject: 'Status zamówienia', message: 'Dzień dobry. Przekazujemy aktualny status.',
    }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-order-message-send');
  assert.equal(response.status, 502);
  assert.equal(response.body.code, 'email_recipient_not_accepted');
  assert.equal(state.orders[0]._artwayCommunication.history.at(-1).status, 'failed');
  assert.equal(state.orders[0]._artwayCommunication.history.some((item) => item.status === 'sent'), false);
});

test('błąd zwrotów nie blokuje zapisania pobranych reklamacji', async () => {
  let state = {
    settings: vonHalskyDefaultSettings(), sync: {}, diagnostics: [], categories: [], offers: [], orders: [],
    returns: [{ id: 'RETURN-OLD', createdAt: '2026-08-01T00:00:00.000Z' }], claims: [], events: [], commands: [], publicationQueue: {},
  };
  let revision = 0;
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision }),
    writeIfVersion: async (_key, value) => { state = structuredClone(value); revision += 1; return { modified: true }; },
    api: {
      fetchReturns: async () => { throw Object.assign(new Error('RequestedResolution.REPAIR'), { code: 'von_halsky_upstream_error', status: 502 }); },
      fetchClaims: async () => ({ requestId: 'REQ-CLAIMS', payload: { items: [{ claimId: 'CLAIM-1', state: 'RESOLUTION_IN_PROGRESS', updatedAt: '2026-08-08T10:00:00.000Z' }] } }),
    },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-post-sales-sync', {
    method: 'POST', body: JSON.stringify({ limit: 250 }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-post-sales-sync');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.partial, true);
  assert.equal(response.body.claims[0].claimId, 'CLAIM-1');
  assert.equal(response.body.returns[0].id, 'RETURN-OLD', 'awaria jednego źródła nie może usuwać wcześniejszych danych');
  assert.match(response.body.warnings[0], /Nie pobrano zwrotów/);
});

test('błąd źródła reklamacji jest trwale zapisany i nie udaje pustej listy', async () => {
  let state = {
    settings: vonHalskyDefaultSettings(), sync: {}, diagnostics: [], categories: [], offers: [], orders: [],
    returns: [], claims: [], events: [], commands: [], publicationQueue: {},
  };
  let revision = 0;
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision }),
    writeIfVersion: async (_key, value) => { state = structuredClone(value); revision += 1; return { modified: true }; },
    api: {
      fetchReturns: async () => ({ requestId: 'REQ-RETURNS', payload: { data: [] } }),
      fetchClaims: async () => { throw Object.assign(new Error('No enum constant RequestedResolution.REPAIR'), { code: 'von_halsky_upstream_error', status: 502 }); },
    },
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-post-sales-sync', {
    method: 'POST', body: JSON.stringify({ limit: 250 }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-post-sales-sync');
  assert.equal(response.status, 200);
  assert.equal(response.body.partial, true);
  assert.equal(response.body.sourceHealth.claims.status, 'error');
  assert.equal(response.body.sourceHealth.returns.status, 'ok');
  assert.match(state.sync.postSales.claims.message, /RequestedResolution\.REPAIR/);
  assert.equal(state.sync.postSales.claims.retryable, true);
});

test('Agent tworzy wyłącznie szkic z ograniczonego kontekstu i niczego nie wysyła', async () => {
  let captured = null, sent = 0;
  const state = {
    settings: vonHalskyDefaultSettings(), sync: {}, diagnostics: [], categories: [], offers: [], orders: [structuredClone(order)],
    returns: [], claims: [], events: [], commands: [], publicationQueue: {},
  };
  const route = createVonHalskyRoute({
    respond: (body, status = 200) => ({ body, status }),
    isAdmin: () => true,
    readVersioned: async () => ({ value: structuredClone(state), revision: 1 }),
    writeIfVersion: async () => ({ modified: true }),
    api: {},
    draftMessageWithAgent: async (input) => {
      captured = input;
      return { id: 'RUN-1', model: 'gpt-test', result: { fields: [
        { key: 'subject', value: 'Status zamówienia C09Q3VF' },
        { key: 'reply', value: 'Dzień dobry, zamówienie jest w realizacji.' },
      ] } };
    },
    sendEmail: async () => { sent += 1; },
    sessionOf: () => ({ email: 'administrator@example.test' }),
  });
  const request = new Request('https://artwaytm.pl/api?action=von-halsky-order-message-draft', {
    method: 'POST', body: JSON.stringify({ orderId: 'C09Q3VF', instruction: 'Przygotuj status', tone: 'profesjonalny' }),
  });
  const response = await route(request, new URL(request.url), 'von-halsky-order-message-draft');
  assert.equal(response.status, 200);
  assert.equal(response.body.draftOnly, true);
  assert.equal(response.body.sentExternally, false);
  assert.equal(response.body.draft.subject, 'Status zamówienia C09Q3VF');
  assert.equal(sent, 0);
  assert.equal(captured.specialist, 'customer_reply');
  const safeContext = JSON.stringify(captured.context);
  assert.doesNotMatch(safeContext, /adres-z-zamowienia|stary-adres|example\.test|"customerLastName"/i);
  assert.match(safeContext, /C09Q3VF/);
});
