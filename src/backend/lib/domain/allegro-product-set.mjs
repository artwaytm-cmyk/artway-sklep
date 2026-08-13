const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const asArray = (value) => Array.isArray(value) ? value : [];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function allegroConfiguredProductSet(product = {}) {
  const raw = asArray(product.allegroProductSet);
  if (!raw.length) return { configured: false, ready: false, items: [], missing: [] };
  const items = [], missing = [], seen = new Set();
  for (const [index, entry] of raw.entries()) {
    const productId = text(entry?.productId || entry?.allegroProductId, 120);
    const quantity = Math.max(1, Math.min(1000, Math.floor(Number(entry?.quantity) || 1)));
    if (!UUID.test(productId)) {
      missing.push(`element ${index + 1}: brak poprawnego ID produktu Katalogu Allegro`);
      continue;
    }
    if (entry?.identityVerified !== true) {
      missing.push(`element ${index + 1}: tożsamość katalogowa nie została potwierdzona`);
      continue;
    }
    if (seen.has(productId)) {
      missing.push(`element ${index + 1}: ten sam produkt występuje w zestawie drugi raz`);
      continue;
    }
    seen.add(productId);
    items.push({
      productId,
      quantity,
      storeProductId: text(entry?.storeProductId, 100),
      name: text(entry?.name, 300),
      gtin: text(entry?.gtin, 20).replace(/\D/g, ''),
      categoryId: text(entry?.categoryId, 80),
      source: text(entry?.source, 120),
      sourceUrl: text(entry?.sourceUrl, 1000),
      verifiedAt: text(entry?.verifiedAt, 50),
    });
  }
  if (!items.length) missing.push('zestaw nie zawiera żadnego potwierdzonego produktu');
  return {
    configured: true,
    ready: missing.length === 0 && items.length > 0,
    items,
    missing: [...new Set(missing)],
  };
}

export function allegroProductSetPayload(product = {}) {
  const configured = allegroConfiguredProductSet(product);
  return {
    ...configured,
    productSet: configured.ready
      ? configured.items.map((item) => ({
          product: { id: item.productId },
          quantity: { value: item.quantity },
        }))
      : [],
  };
}

export function allegroProductSetIdentityMatches(product = {}, draftSet = []) {
  const configured = allegroProductSetPayload(product);
  if (!configured.ready) return { ok: false, reason: configured.missing.join(', ') };
  const actual = asArray(draftSet).map((entry) => ({
    productId: text(entry?.product?.id, 120),
    quantity: Math.max(1, Math.floor(Number(entry?.quantity?.value) || 1)),
  }));
  const expected = configured.productSet.map((entry) => ({
    productId: entry.product.id,
    quantity: entry.quantity.value,
  }));
  const ok = actual.length === expected.length && actual.every((entry, index) => (
    entry.productId === expected[index].productId && entry.quantity === expected[index].quantity
  ));
  return { ok, reason: ok ? '' : 'Szkic nie zawiera dokładnie potwierdzonych produktów i ilości zestawu.', expected, actual };
}
