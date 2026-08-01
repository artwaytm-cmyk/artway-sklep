export async function persistVonHalskyReconciliationState({
  channelState,
  products = [],
  productUpdates = [],
  timestamp = new Date().toISOString(),
  source = 'background-worker',
} = {}) {
  if (!channelState?.upsertState) return { observed: 0, receipts: 0 };
  const updates = new Map((Array.isArray(productUpdates) ? productUpdates : [])
    .map((update) => [String(update?.productId || ''), update?.fields || {}])
    .filter(([productId]) => productId));
  let observed = 0;
  let receipts = 0;
  for (const stored of Array.isArray(products) ? products : []) {
    const productId = String(stored?.id ?? '').trim();
    if (!productId) continue;
    const product = { ...stored, ...(updates.get(productId) || {}) };
    const remoteStatus = String(product.vonHalskyRemoteStatus || '').trim().toUpperCase();
    const targetId = String(product.vonHalskyOfferId || product.inpostVonHalskyOfferId || '').trim();
    const receiptId = String(product.vonHalskyCommandId || '').trim();
    if (!remoteStatus && !targetId && !receiptId) continue;
    const confirmed = ['PUBLISHED', 'CLOSED', 'SOLDOUT', 'INACTIVE'].includes(remoteStatus);
    const failed = ['REJECTED', 'ERROR', 'DUPLICATE_MAPPING', 'NOT_FOUND'].includes(remoteStatus);
    const publicationStatus = confirmed
      ? (remoteStatus === 'PUBLISHED' ? 'confirmed' : 'blocked')
      : failed ? 'failed' : 'publishing';
    const errorCode = failed ? `von_halsky_${remoteStatus.toLowerCase()}` : '';
    const errorText = failed
      ? String(product.vonHalskyEditorialSyncError || 'Kanał odrzucił albo nie odnalazł oferty.').slice(0, 2000)
      : '';
    await channelState.upsertState({
      productId,
      channel: 'von_halsky',
      preparationStatus: failed ? 'needs_data' : 'ready',
      publicationStatus,
      categoryId: product.vonHalskyCategoryId || '',
      targetId,
      errorCode,
      errorText,
      providerConfirmedAt: confirmed ? timestamp : null,
      readbackConfirmedAt: confirmed ? timestamp : null,
      metadata: { remoteStatus, source },
    });
    observed += 1;
    const receiptStatus = confirmed ? 'readback_confirmed' : failed ? 'failed' : 'publishing';
    if (channelState?.reconcilePendingReceiptsForProduct) {
      receipts += await channelState.reconcilePendingReceiptsForProduct({
        productId,
        channel: 'von_halsky',
        targetId,
        status: receiptStatus,
        errorCode,
        errorText,
        responseSummary: { readbackConfirmed: confirmed, remoteStatus, source },
        confirmedAt: confirmed ? timestamp : null,
      });
    }
    if (!receiptId || !channelState?.recordReceipt) continue;
    await channelState.recordReceipt({
      productId,
      channel: 'von_halsky',
      operation: 'publish',
      idempotencyKey: receiptId,
      providerRequestId: receiptId,
      targetId,
      status: receiptStatus,
      errorCode,
      errorText,
      responseSummary: { readbackConfirmed: confirmed, remoteStatus, source },
      confirmedAt: confirmed ? timestamp : null,
    });
  }
  return { observed, receipts };
}
