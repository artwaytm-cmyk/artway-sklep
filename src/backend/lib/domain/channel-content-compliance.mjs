import { allegroCheckText, ALLEGRO_COMPLIANCE_POLICY } from '../allegro-compliance.mjs';
import { vonHalskyCheckEditorial, VON_HALSKY_CONTENT_POLICY } from './von-halsky-compliance.mjs';

function words(value = '') {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean);
}

function allegroTitleCheck(title = '') {
  const value = String(title ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const violations = [];
  if (value.length < 12 || value.length > 75) violations.push({ id: 'title_length', label: 'tytuł Allegro musi mieć 12–75 znaków' });
  if (words(value).length < 3) violations.push({ id: 'title_words', label: 'tytuł Allegro musi zawierać co najmniej 3 słowa' });
  if (/[|]{2,}|[!?]{2,}|[★✓❤🔥]/u.test(value)) violations.push({ id: 'title_symbols', label: 'zbędne znaki reklamowe w tytule' });
  return { ok: violations.length === 0, violations };
}

export function channelContentCompliance(patch = {}) {
  const title = patch.allegroTitle || patch.nazwa || patch.title || '';
  const body = [patch.nazwa, patch.opisKrotki, patch.opis, patch.allegroTitle, patch.allegroDescription].filter(Boolean).join('\n');
  const allegroText = allegroCheckText(body);
  const allegroTitle = allegroTitleCheck(title);
  const allegro = {
    ok: allegroText.ok && allegroTitle.ok,
    policyId: ALLEGRO_COMPLIANCE_POLICY.id,
    violations: [...allegroTitle.violations, ...allegroText.violations],
  };
  const vonHalsky = vonHalskyCheckEditorial(patch);
  return {
    ok: allegro.ok && vonHalsky.ok,
    reason: !allegro.ok ? 'allegro_compliance' : !vonHalsky.ok ? 'von_halsky_compliance' : 'safe_channel_content',
    violations: !allegro.ok ? allegro.violations : !vonHalsky.ok ? vonHalsky.violations : [],
    channels: {
      allegro: { status: allegro.ok ? 'passed' : 'blocked', policyId: allegro.policyId, violations: allegro.violations },
      vonHalsky: { status: vonHalsky.ok ? 'passed' : 'blocked', policyId: vonHalsky.policyId, violations: vonHalsky.violations },
    },
    policyIds: [ALLEGRO_COMPLIANCE_POLICY.id, VON_HALSKY_CONTENT_POLICY.id],
  };
}

