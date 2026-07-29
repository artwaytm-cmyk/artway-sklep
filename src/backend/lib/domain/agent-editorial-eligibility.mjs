import { allegroContentCompliance } from './channel-content-compliance.mjs';

const clean = (value = '', limit = 1000) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, limit);

export function evaluateProductEditorialAutomaticEligibility(product = {}, editorial = {}) {
  const offerId = clean(product.allegroOfferId || product.offerId || product?._catalog?.channels?.allegro?.offerId, 120);
  const offerStatus = clean(
    product.allegroStatus || product.allegroPublicationStatus || product?._catalog?.channels?.allegro?.status,
    80,
  ).toUpperCase();
  const activeListing = Boolean(offerId) && !['ENDED', 'INACTIVE', 'ARCHIVED', 'DELETED'].includes(offerStatus);
  const explicitRequest = product.forceEditorialRefresh === true
    || product.allegroPublicationIntent === true
    || ['queued', 'preparing'].includes(clean(product.allegroAgentPreparationStatus || product.allegroPreparationStatus, 40).toLowerCase());
  const complianceRepair = Boolean(
    clean(product.allegroComplianceError || product.allegroPublicationLastErrorCode, 300)
    || (!activeListing && ['failed', 'needs_attention'].includes(clean(product.allegroAgentPreparationStatus, 40).toLowerCase())),
  );
  const receipt = product.contentEditorial && typeof product.contentEditorial === 'object' ? product.contentEditorial : {};
  const channelStates = receipt.channelStates && typeof receipt.channelStates === 'object' ? receipt.channelStates : {};
  const hasEditorialReceipt = Boolean(clean(receipt.inputFingerprint, 160)) || Object.keys(channelStates).length > 0;
  const savedSourceFingerprint = clean(receipt.sourceFingerprint, 160);
  const sourceChanged = Boolean(savedSourceFingerprint)
    && savedSourceFingerprint !== clean(editorial.sourceFingerprint, 160);
  const sourceUpdateQueued = clean(receipt.status, 60).toLowerCase() === 'queued'
    && clean(receipt.queuedReason, 100).toLowerCase() === 'source_updated';
  const hasStoredAllegroContent = Boolean(
    clean(product.allegroTitle, 300)
    && clean(product.allegroDescription, 30_000),
  );
  const unsafeExistingContent = hasStoredAllegroContent
    && !allegroContentCompliance({
      allegroTitle: product.allegroTitle,
      allegroDescription: product.allegroDescription,
    }).ok;
  if (editorial.current) return { eligible: false, reason: 'editorial_current', activeListing };
  if (!activeListing) return { eligible: true, reason: explicitRequest ? 'explicit_request' : 'not_listed_or_inactive', activeListing };
  if (explicitRequest) return { eligible: true, reason: 'explicit_request', activeListing };
  if (complianceRepair) return { eligible: true, reason: 'compliance_or_publication_repair', activeListing };
  if (unsafeExistingContent) return { eligible: true, reason: 'unsafe_existing_content', activeListing };
  if (sourceUpdateQueued || sourceChanged) return { eligible: true, reason: 'source_changed_after_editorial', activeListing };
  return {
    eligible: false,
    reason: hasEditorialReceipt ? 'active_listing_verification_only' : 'legacy_active_listing_grandfathered',
    activeListing,
  };
}
