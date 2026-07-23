import crypto from 'node:crypto';

function decisionText(value = '', limit = 240) {
  return String(value ?? '').trim().slice(0, limit);
}

function decisionSubjectKey(kind = '', target = {}, explicit = '') {
  const safeExplicit = decisionText(explicit);
  if (safeExplicit) return safeExplicit;
  const source = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
  const parts = [
    ['type', source.type], ['product', source.productId], ['communicationType', source.communicationType],
    ['communication', source.communicationId], ['message', source.sourceMessageId], ['order', source.orderId],
    ['offer', source.offerId], ['supplier', source.supplierId], ['thread', source.threadId], ['issue', source.issueId],
    ['document', source.documentId], ['shipment', source.shipmentId], ['invoice', source.invoiceId], ['external', source.externalId],
  ].filter(([, value]) => decisionText(value, 180)).map(([key, value]) => `${key}:${decisionText(value, 180)}`);
  const generic = crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex').slice(0, 32);
  return `${decisionText(kind, 80) || 'decision'}|${parts.length ? parts.join('|') : `generic:${generic}`}`;
}

function decisionFingerprint(kind = '', target = {}) {
  return crypto.createHash('sha256').update(decisionSubjectKey(kind, target)).digest('hex');
}

function normalizeDecisionReceipt(raw = {}, timestamp = new Date().toISOString()) {
  const target = raw.target && typeof raw.target === 'object' ? raw.target : {}, kind = decisionText(raw.kind, 80);
  return {
    subjectKey: decisionSubjectKey(kind, target, raw.subjectKey), decisionId: decisionText(raw.decisionId || raw.id, 120), kind,
    status: ['approved', 'dismissed', 'resolved'].includes(raw.status) ? raw.status : 'resolved',
    resolvedAt: decisionText(raw.resolvedAt || raw.updatedAt, 40) || timestamp, updatedAt: decisionText(raw.updatedAt, 40) || timestamp,
    resolvedBy: decisionText(raw.resolvedBy, 120), resolutionNote: decisionText(raw.resolutionNote, 500),
  };
}

export { decisionFingerprint, decisionSubjectKey, normalizeDecisionReceipt };
