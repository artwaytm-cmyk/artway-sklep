function orderIsActive(order = {}) {
  return !['anulowane', 'dostarczone', 'zakończone', 'zwrot', 'zwrot pieniędzy']
    .includes(String(order.status || '').toLowerCase());
}

export function supplierOrderHasActiveContent(draft = {}) {
  const status = String(draft?.status || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
  if (['zrealizowane', 'anulowane', 'wyczyszczone', 'zastapione', 'zamkniete'].includes(status)) return false;
  return (Array.isArray(draft?.pozycje) ? draft.pozycje : [])
    .some((line) => Math.max(0, Number(line?.ilosc) || 0) > 0);
}

function executionPolicy(priority = {}, text = (value) => String(value || '')) {
  const area = text(priority.area, 80);
  const title = text(priority.title, 260).toLowerCase();
  const definitions = {
    orders_start: { actionId: 'orders_start', execution: 'approval', requiresApproval: true, deadlineMinutes: 30, owner: 'obsługa zamówień', doneWhen: 'Każde nowe zamówienie ma rozpoczętą obsługę i sprawdzoną dostępność.' },
    allegro_reply: { actionId: 'allegro_reply', execution: 'approval', requiresApproval: true, deadlineMinutes: 60, owner: 'obsługa klienta', doneWhen: 'Klient otrzymał zatwierdzoną odpowiedź albo sprawa została zamknięta wewnętrznie.' },
    supplier_availability: { actionId: 'supplier_availability', execution: 'approval', requiresApproval: true, deadlineMinutes: 120, owner: 'administrator / Agent AI', doneWhen: 'Każdy brak ma decyzję: termin dalszej sprzedaży, ukrycie albo automatyczne wznowienie.' },
    inpost_prepare: { actionId: 'inpost_prepare', execution: 'approval', requiresApproval: true, deadlineMinutes: 120, owner: 'centrum wysyłek', doneWhen: 'Przesyłka ma etykietę, numer nadania i zapisany status InPost.' },
    allegro_warehouse: { actionId: 'allegro_warehouse', execution: 'draft', requiresApproval: false, deadlineMinutes: 60, owner: 'Agent AI', doneWhen: 'Pozycje zlecenia są sprawdzone, a realne braki dopisane do szkicu producenta.' },
    warehouse_location: { actionId: 'warehouse_location', execution: 'draft', requiresApproval: false, deadlineMinutes: 240, owner: 'magazyn', doneWhen: 'Towar pozostaje zarezerwowany do zamówienia, a magazyn przypisał mu fizyczną lokalizację.' },
    allegro_offer_fix: { actionId: 'allegro_offer_fix', execution: 'approval', requiresApproval: true, deadlineMinutes: 240, owner: 'katalog Allegro', doneWhen: 'Oferta ma komplet danych i ostatnia operacja API zakończyła się sukcesem.' },
    supplier_order_draft: { actionId: 'supplier_order_draft', execution: 'draft', requiresApproval: false, deadlineMinutes: 240, owner: 'Agent AI', doneWhen: 'Bieżący dokument producenta zawiera wszystkie niepokryte braki i czeka na zatwierdzenie.' },
    invoice_draft: { actionId: 'invoice_draft', execution: 'draft', requiresApproval: false, deadlineMinutes: 240, owner: 'Agent AI / inFakt', doneWhen: 'Zamówienie firmowe ma szkic lub powiązaną fakturę inFakt.' },
    producer_link_check: { actionId: 'producer_link_check', execution: 'safe_check', requiresApproval: false, deadlineMinutes: 360, owner: 'Agent AI', doneWhen: 'Link został sprawdzony, a wynik i brakujące pola zapisane przy produkcie.' },
    site_function_check: { actionId: 'site_function_check', execution: 'safe_check', requiresApproval: false, deadlineMinutes: 15, owner: 'Agent AI', doneWhen: 'Baza oraz wszystkie wymagane integracje odpowiadają poprawnie.' },
    data_sync: { actionId: 'data_sync', execution: 'safe_check', requiresApproval: false, deadlineMinutes: 15, owner: 'Agent AI', doneWhen: 'Dane sklepu, Allegro, InPost i inFakt mają świeży znacznik synchronizacji.' },
  };
  let key = 'orders_start';
  if (area === 'system') key = 'site_function_check';
  else if (area === 'synchronizacja') key = 'data_sync';
  else if (title.includes('wiadomości') || title.includes('dyskusje')) key = 'allegro_reply';
  else if (title.includes('niedostępne u producenta') || title.includes('niski stan') || title.includes('dostępność producent')) key = 'supplier_availability';
  else if (area === 'wysylki') key = 'inpost_prepare';
  else if (area === 'magazyn') key = 'warehouse_location';
  else if (title.includes('zamówienia allegro')) key = 'allegro_warehouse';
  else if (title.includes('oferty allegro') || title.includes('operacja oferty')) key = 'allegro_offer_fix';
  else if (area === 'producenci') key = 'supplier_order_draft';
  else if (area === 'faktury') key = 'invoice_draft';
  else if (title.includes('linki producentów')) key = 'producer_link_check';
  return definitions[key];
}

export function createAgentOperationalCenter(deps = {}) {
  const {
    read,
    text,
    allegroOrderIsActive,
    communicationNeedsReply,
    mergeProducts,
    orderNumber,
    integrationStatus,
  } = deps;
  return async function agentOperationalCenter() {
    const [settingsRec, ordersRec, allegroOrdersRec, communicationRec, offerErrorRec, infaktLinksRec, catalogQualityRec, diagnosticsRec] = await Promise.all([
      read('settings', { data: {}, updated_at: null }),
      read('orders', { items: [] }),
      read('allegro_orders', { items: [] }),
      read('allegro_communications', { threads: [], issues: [], updated_at: null }),
      read('allegro_offer_last_error', null),
      read('infakt_invoice_links', { items: {} }),
      read('catalog_quality_audit', { report: null, updated_at: null }),
      read('system_diagnostics', { items: [], updatedAt: null }),
    ]);
    const data = settingsRec.data && typeof settingsRec.data === 'object' ? settingsRec.data : {};
    const orders = Array.isArray(ordersRec.items) ? ordersRec.items : [];
    const activeOrders = orders.filter(orderIsActive);
    const newOrders = activeOrders.filter((order) => String(order.status || '').toLowerCase() === 'nowe');
    const shipmentsWithoutTracking = activeOrders.filter((order) => !text(order?.wysylka?.numer || order?.trackingNumber || '', 100).trim());
    const allegroOrders = Array.isArray(allegroOrdersRec.items) ? allegroOrdersRec.items : [];
    const activeAllegro = allegroOrders.filter(allegroOrderIsActive);
    const stock = data.artway_stany && typeof data.artway_stany === 'object' ? data.artway_stany : {};
    const warehouseCards = data.artway_magazyn_produkty && typeof data.artway_magazyn_produkty === 'object' ? data.artway_magazyn_produkty : {};
    const activeDemand = new Map();
    const demandReferences = new Map();
    const addDemand = (productId, amount, reference) => {
      const id = text(productId, 120).trim();
      const quantity = Math.max(0, Number(amount) || 0);
      if (!id || !quantity) return;
      activeDemand.set(id, (activeDemand.get(id) || 0) + quantity);
      if (!demandReferences.has(id)) demandReferences.set(id, new Set());
      demandReferences.get(id).add(text(reference, 160));
    };
    for (const order of activeOrders) {
      for (const line of Array.isArray(order.pozycjeDane) ? order.pozycjeDane : []) addDemand(line?.id, line?.ilosc, order.nr);
    }
    for (const order of activeAllegro) {
      for (const line of Array.isArray(order.agentAnalysis?.positions) ? order.agentAnalysis.positions : []) {
        addDemand(line?.productId, line?.ilosc || line?.quantity, order.id || order.nr);
      }
    }
    const warehouseLocationTasks = [...activeDemand.entries()].filter(([productId, demand]) => {
      const known = Object.prototype.hasOwnProperty.call(stock, productId) && stock[productId] !== ''
        && stock[productId] != null && Number.isFinite(Number(stock[productId]));
      return known && Number(stock[productId]) >= demand
        && !text(warehouseCards[productId]?.lokalizacja || warehouseCards[productId]?.location, 120).trim();
    }).map(([productId, demand]) => ({
      productId,
      demand,
      orders: [...(demandReferences.get(productId) || [])].filter(Boolean),
    }));
    const communications = [
      ...(Array.isArray(communicationRec.threads) ? communicationRec.threads.map((item) => ({ ...item, type: 'thread' })) : []),
      ...(Array.isArray(communicationRec.issues) ? communicationRec.issues.map((item) => ({ ...item, type: 'issue' })) : []),
    ];
    const communicationWaiting = communications.filter(communicationNeedsReply);
    const products = mergeProducts(data).products;
    const supplierUnavailable = products.filter((product) => String(product.producentStatus || '').toLowerCase() === 'brak');
    const supplierLow = products.filter((product) => String(product.producentStatus || '').toLowerCase() === 'niski');
    const availabilityDecisions = data.artway_dostepnosc && typeof data.artway_dostepnosc === 'object' ? data.artway_dostepnosc : {};
    const supplierNeedsDecision = [...supplierUnavailable, ...supplierLow].filter((product) => {
      const decision = availabilityDecisions[String(product.id)] || {};
      const code = String(decision.decision || decision.decyzja || '');
      const expires = Date.parse(decision.expiresAt || decision.waznaDo || '');
      return !code || (code === 'grace' && Number.isFinite(expires) && expires <= Date.now());
    });
    const producerLinks = (Array.isArray(data.artway_agent_ai_linki_producentow) ? data.artway_agent_ai_linki_producentow : [])
      .filter((item) => !['pobrano', 'zamkniete', 'zamknięte', 'usunieto', 'usunięto'].includes(String(item?.status || '').toLowerCase()));
    const offerTasks = (Array.isArray(data.artway_agent_ai_allegro_zadania) ? data.artway_agent_ai_allegro_zadania : [])
      .filter((item) => !['zrealizowane', 'zamkniete', 'zamknięte', 'anulowane'].includes(String(item?.status || '').toLowerCase()));
    const supplierOrders = (Array.isArray(data.artway_agent_ai_zlecenia) ? data.artway_agent_ai_zlecenia : [])
      .filter((item) => supplierOrderHasActiveContent(item)
        && !['wysłane do producenta', 'wysłane do dostawcy'].includes(String(item?.status || '').toLowerCase()));
    const invoiceLinks = infaktLinksRec?.items && typeof infaktLinksRec.items === 'object' ? infaktLinksRec.items : {};
    const invoiceDrafts = Array.isArray(data.artway_faktury_szkice) ? data.artway_faktury_szkice : [];
    const companyOrdersWithoutInvoice = activeOrders.filter((order) => (order?.klient?.nip || order?.klient?.firma)
      && !invoiceLinks[orderNumber(order.nr)]
      && !invoiceDrafts.some((draft) => orderNumber(draft?.nrZamowienia) === orderNumber(order.nr)));
    const integrations = integrationStatus();
    const missingIntegrations = Object.entries(integrations).filter(([, ready]) => !ready).map(([name]) => name);
    const ageMinutes = (value) => {
      const parsed = Date.parse(value || '');
      return Number.isFinite(parsed) ? Math.max(0, Math.round((Date.now() - parsed) / 60000)) : null;
    };
    const freshness = {
      settings: ageMinutes(settingsRec.updated_at),
      orders: ageMinutes(ordersRec.updated_at),
      allegroOrders: ageMinutes(allegroOrdersRec.updated_at),
      communications: ageMinutes(communicationRec.updated_at),
    };
    const staleSources = Object.entries(freshness).filter(([, age]) => age !== null && age > 180)
      .map(([name, age]) => `${name}: ${age} min`);
    const priorities = [];
    const addPriority = (severity, area, count, title, href, action) => {
      if (Number(count) > 0) priorities.push({
        id: `${area}-${priorities.length + 1}`,
        severity,
        area,
        count: Number(count),
        title,
        href,
        action,
      });
    };
    addPriority('critical', 'system', missingIntegrations.length, 'Funkcje krytyczne strony wymagają kontroli', '#/diagnostyka', `Sprawdź brakujące integracje: ${missingIntegrations.join(', ')}.`);
    addPriority('critical', 'synchronizacja', staleSources.length, 'Dane operacyjne są nieaktualne', '#/admin/agent-ai/plan', `Uruchom bezpieczne odświeżenie: ${staleSources.join(' • ')}.`);
    addPriority('critical', 'zamowienia', newOrders.length, 'Nowe zamówienia czekają na rozpoczęcie obsługi', '#/admin/zamowienia', 'Otwórz zamówienia i rozpocznij realizację.');
    addPriority('critical', 'allegro', communicationWaiting.length, 'Nowe wiadomości lub dyskusje Allegro wymagają odpowiedzi', '#/admin/allegro/wiadomosci', 'Przygotuj odpowiedź i oznacz sprawę wewnętrznie po zakończeniu.');
    addPriority('critical', 'producent', supplierNeedsDecision.length, 'Dostępność producentów wymaga decyzji sprzedażowej', '#/admin/magazyn/dostawcy', 'Wybierz: pozostaw 1–7 dni, ukryj, wznów po powrocie albo pozostaw ręcznie aktywny.');
    addPriority('warning', 'wysylki', shipmentsWithoutTracking.length, 'Aktywne zamówienia bez numeru nadania', '#/admin/wysylki', 'Uzupełnij dane InPost i wygeneruj etykiety.');
    addPriority('warning', 'allegro', activeAllegro.length, 'Aktywne zamówienia Allegro do kontroli magazynowej', '#/admin/allegro/zamowienia', 'Sprawdź rozpoznanie pozycji i realne braki. Lokalizacje obsługuje osobna kolejka magazynu.');
    addPriority('warning', 'magazyn', warehouseLocationTasks.length, 'Towar w aktywnych zamówieniach bez lokalizacji', '#/admin/magazyn/stany', 'Ustal fizyczne miejsce produktu. Towar pozostaje zarezerwowany i nie blokuje realizacji zamówienia.');
    addPriority('warning', 'producent', supplierLow.length, 'Niski stan produktów u producentów', '#/admin/magazyn/dostawcy', 'Kontroluj najpierw najlepiej sprzedające się produkty.');
    addPriority('warning', 'produkty', offerTasks.length, 'Otwarte zadania wystawiania produktów na Allegro', '#/admin/allegro/oferty', 'Uzupełnij wymagane dane i ponów wystawienie.');
    addPriority('warning', 'producenci', supplierOrders.length, 'Otwarte dokumenty zamówień do producentów', '#/admin/magazyn/plan', 'Sprawdź aktualną rewizję przed zatwierdzeniem i wysyłką.');
    addPriority('warning', 'faktury', companyOrdersWithoutInvoice.length, 'Zamówienia firmowe nie mają jeszcze szkicu ani faktury', '#/admin/infakt/zamowienia', 'Sprawdź dane nabywcy i utwórz dokument w inFakt.');
    addPriority('info', 'produkty', producerLinks.length, 'Linki producentów czekają na pobranie danych', '#/admin/agent-ai/plan', 'Ponów analizę linków i uzupełnij kartoteki.');
    const qualitySummary = catalogQualityRec?.report?.summary || {};
    addPriority('warning', 'produkty', Number(qualitySummary.critical || 0) + Number(qualitySummary.orphanEdits || 0), 'Katalog produktów wymaga kontroli jakości', '#/admin/asortyment/jakosc', 'Uruchom audyt katalogu, zastosuj bezpieczne poprawki i uzupełnij wyłącznie brakujące fakty.');
    if (offerErrorRec?.message || offerErrorRec?.error) addPriority('warning', 'allegro', 1, 'Ostatnia operacja oferty Allegro zakończyła się błędem', '#/admin/allegro/oferty', 'Otwórz diagnostykę oferty i przekaż braki Agentowi.');
    const openDiagnostics = (Array.isArray(diagnosticsRec?.items) ? diagnosticsRec.items : [])
      .filter((item) => ['open', 'investigating'].includes(String(item?.status || 'open')));
    const diagnosticErrors = openDiagnostics.filter((item) => item?.level === 'blad').length;
    const diagnosticWarnings = openDiagnostics.filter((item) => item?.level === 'ostrzezenie').length;
    addPriority('critical', 'system', diagnosticErrors, 'Centralna diagnostyka wykryła błędy działania strony', '#/admin/system/logi', 'Otwórz wspólny rejestr, sprawdź źródło i wydanie, a po naprawie oznacz wpis jako rozwiązany.');
    addPriority('warning', 'system', diagnosticWarnings, 'Centralna diagnostyka ma nowe ostrzeżenia', '#/admin/system/logi', 'Przejrzyj zgrupowane ostrzeżenia i usuń ich przyczynę, zanim zaczną blokować pracę.');
    const severityRank = { critical: 0, warning: 1, info: 2 };
    priorities.forEach((priority) => Object.assign(priority, executionPolicy(priority, text)));
    priorities.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
      || b.count - a.count || a.title.localeCompare(b.title, 'pl'));
    const critical = priorities.filter((item) => item.severity === 'critical').length;
    const warnings = priorities.filter((item) => item.severity === 'warning').length;
    const score = Math.max(0, Math.min(100, 100 - critical * 14 - warnings * 5));
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      score,
      priorities,
      summary: {
        orders: orders.length,
        activeOrders: activeOrders.length,
        newOrders: newOrders.length,
        shipmentsWithoutTracking: shipmentsWithoutTracking.length,
        allegroOrders: allegroOrders.length,
        activeAllegro: activeAllegro.length,
        warehouseLocationTasks: warehouseLocationTasks.length,
        communicationWaiting: communicationWaiting.length,
        supplierUnavailable: supplierUnavailable.length,
        supplierLow: supplierLow.length,
        supplierNeedsDecision: supplierNeedsDecision.length,
        producerLinks: producerLinks.length,
        offerTasks: offerTasks.length,
        supplierOrders: supplierOrders.length,
        companyOrdersWithoutInvoice: companyOrdersWithoutInvoice.length,
        diagnosticErrors,
        diagnosticWarnings,
      },
      integrations,
      freshness,
      links: {
        agent: 'https://artwaytm.pl/#/admin/agent-ai',
        orders: 'https://artwaytm.pl/#/admin/zamowienia',
        warehouse: 'https://artwaytm.pl/#/admin/magazyn/stany',
        allegro: 'https://artwaytm.pl/#/admin/allegro',
        shipping: 'https://artwaytm.pl/#/admin/wysylki',
        invoices: 'https://artwaytm.pl/#/admin/infakt',
      },
    };
  };
}
