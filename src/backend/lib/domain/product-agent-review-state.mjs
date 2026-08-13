const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, limit = 80) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, limit);

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function productAgentReviewCurrent(product = {}, now = new Date()) {
  const review = asObject(product?._agentReview);
  if (text(review.status, 40).toLowerCase() !== 'confirmed') return false;
  const dueAt = timestamp(review.verificationDueAt);
  const current = now instanceof Date ? now.getTime() : timestamp(now) || Date.now();
  return Boolean(dueAt && dueAt > current);
}

export function agentReviewJsonSql(namespaceExpression, productIdExpression) {
  return `COALESCE((
    SELECT jsonb_build_object('_agentReview',jsonb_build_object(
      'status',review.review_status,'version',review.review_version,
      'inputFingerprint',review.input_fingerprint,'confirmedAt',review.confirmed_at,
      'verificationDueAt',review.verification_due_at,'lastRunId',review.last_run_id,
      'savedFields',review.saved_fields,'channels',review.channel_summary,
      'reason',review.reason,'updatedAt',review.updated_at
    ))
    FROM artway_product_agent_state review
    WHERE review.namespace=${namespaceExpression} AND review.product_id=${productIdExpression}
  ),'{}'::jsonb)`;
}
