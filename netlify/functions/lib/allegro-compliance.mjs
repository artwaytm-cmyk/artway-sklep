// Kontrola opisów ofert Allegro przed publikacją i podczas audytu istniejących ofert.
// Reguły są celowo zachowawcze: opis oferty nie jest miejscem na dane kontaktowe,
// zaproszenie do kontaktu ani sugestię sprzedaży poza Allegro.

export const ALLEGRO_COMPLIANCE_POLICY = Object.freeze({
  id: 'allegro-offsite-sales-2026-07-13',
  name: 'Sprzedaż wyłącznie przez Allegro',
  source: 'https://help.allegro.com/pl/sell/a/sprzedaz-poza-allegro-i-omijanie-oplat-aMloER9LrH8',
  descriptionSource: 'https://help.allegro.com/pl/sell/c/jak-wystawiac-oferty',
});

const RULES = Object.freeze([
  {
    id: 'contact_invitation',
    label: 'zachęta do kontaktu',
    pattern: /\b(?:skontaktuj(?:cie)?\s+się|prosimy\s+o\s+kontakt|zapraszamy\s+do\s+kontaktu|napisz(?:cie)?\s+(?:do\s+)?(?:nas|mnie)|zadzwoń(?:cie)?|dzwoń(?:cie)?|kontakt\s+(?:z\s+nami|ze\s+sprzedawcą)|w\s+razie\s+pytań)\b/giu,
  },
  {
    id: 'before_purchase_contact',
    label: 'kontakt lub sprawdzanie przed zakupem',
    pattern: /\b(?:przed\s+(?:zakupem|kupnem|licytacją|zamówieniem)|zanim\s+(?:kupisz|zakupisz|zalicytujesz|zamówisz)|zapytaj\s+o\s+dostępność|sprawdź\s+dostępność|dostępność\s+(?:po|przez)\s+kontakcie)\b/giu,
  },
  {
    id: 'outside_allegro',
    label: 'sugestia sprzedaży poza Allegro',
    pattern: /\b(?:poza\s+allegro|nasz(?:ego|ym)?\s+sklep(?:u|ie)?|sklep(?:ie)?\s+internetow(?:y|ym)|zamów\s+bezpośrednio|kup\s+bezpośrednio|u\s+nas\s+taniej|sprzedaż\s+bezpośrednia)\b/giu,
  },
  {
    id: 'price_negotiation',
    label: 'ustalanie ceny poza mechanizmem oferty',
    pattern: /\b(?:cena\s+do\s+negocjacji|negocjuj(?:emy)?|zapytaj\s+o\s+cenę|ustalimy\s+cenę|dogadamy\s+(?:cenę|się)|rabat\s+po\s+kontakcie)\b/giu,
  },
  {
    id: 'other_unlisted_items',
    label: 'propozycja wystawienia innych przedmiotów po kontakcie',
    pattern: /\b(?:mogę\s+wystawić|możemy\s+wystawić|wystawię\s+na\s+życzenie|inne\s+produkty\s+po\s+kontakcie|szukasz\s+czegoś\s+innego)\b/giu,
  },
  {
    id: 'external_url',
    label: 'zewnętrzny adres internetowy',
    pattern: /(?:https?:\/\/|www\.)[^\s<]+|\b(?:[a-z0-9-]+\.)+(?:pl|com|eu|net|org)\b/giu,
  },
  {
    id: 'email_address',
    label: 'adres e-mail w opisie',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  },
  {
    id: 'phone_number',
    label: 'numer telefonu w opisie',
    pattern: /(?:\+?48[\s.-]*)?(?<!\d)(?:\d[\s.-]*){9}(?!\d)/gu,
  },
]);

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code) || 32));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function plainText(value = '') {
  return decodeHtml(String(value)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|h[1-6]|li|ul|ol)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\t\u00a0 ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function allegroCheckText(value = '') {
  const text = plainText(value);
  const violations = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    const matches = unique([...text.matchAll(rule.pattern)].map((match) => String(match[0] || '').trim())).slice(0, 5);
    if (matches.length) violations.push({ id: rule.id, label: rule.label, matches });
  }
  return {
    ok: violations.length === 0,
    violations,
    policyId: ALLEGRO_COMPLIANCE_POLICY.id,
  };
}
function sentenceParts(block = '') {
  const parts = String(block).match(/[^.!?]+(?:[.!?]+|$)/g) || [String(block)];
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function allegroSanitizePlainText(value = '') {
  const text = plainText(value);
  const kept = [];
  const removed = [];
  for (const block of text.split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
    const blockCheck = allegroCheckText(block);
    if (blockCheck.ok) {
      kept.push(block);
      continue;
    }
    const sentences = sentenceParts(block);
    const safeSentences = [];
    let caughtInSentences = false;
    for (const sentence of sentences) {
      const check = allegroCheckText(sentence);
      if (check.ok) safeSentences.push(sentence);
      else {
        caughtInSentences = true;
        removed.push({ text: sentence, violations: check.violations });
      }
    }
    // Przy adresie URL lub e-mailu podział na zdania może rozdzielić domenę.
    // Wtedy bezpieczniej usunąć cały logiczny blok.
    if (!caughtInSentences || allegroCheckText(safeSentences.join(' ')).ok === false) {
      removed.push({ text: block, violations: blockCheck.violations });
      continue;
    }
    if (safeSentences.length) kept.push(safeSentences.join(' '));
  }
  const safeText = kept.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return {
    text: safeText,
    removed,
    removedCount: removed.length,
    check: allegroCheckText(safeText),
  };
}

export function allegroSanitizeDescription(description = {}) {
  const sourceSections = Array.isArray(description?.sections) ? description.sections : [];
  const sections = [];
  const removed = [];
  for (const sourceSection of sourceSections) {
    const items = [];
    for (const sourceItem of (Array.isArray(sourceSection?.items) ? sourceSection.items : [])) {
      if (sourceItem?.type === 'IMAGE' && sourceItem.url) {
        items.push({ type: 'IMAGE', url: String(sourceItem.url) });
        continue;
      }
      if (sourceItem?.type !== 'TEXT') continue;
      const sanitized = allegroSanitizePlainText(sourceItem.content || '');
      removed.push(...sanitized.removed);
      if (sanitized.text) {
        const paragraphs = sanitized.text.split(/\n{2,}|\n/).map((part) => part.trim()).filter(Boolean);
        items.push({ type: 'TEXT', content: paragraphs.map((part) => `<p>${escapeHtml(part)}</p>`).join('') });
      }
    }
    if (items.length) sections.push({ items });
  }
  const result = { sections };
  const finalText = sections.flatMap((section) => section.items || []).filter((item) => item.type === 'TEXT').map((item) => item.content || '').join('\n');
  return {
    description: result,
    removed,
    removedCount: removed.length,
    check: allegroCheckText(finalText),
  };
}

export function allegroEnforceDraft(draft = {}) {
  const sanitized = allegroSanitizeDescription(draft.description || {});
  let description = sanitized.description;
  if (!description.sections.some((section) => (section.items || []).some((item) => item.type === 'TEXT'))) {
    const safeName = allegroSanitizePlainText(draft.name || 'Produkt').text || 'Produkt';
    description = { sections: [{ items: [{ type: 'TEXT', content: `<p>${escapeHtml(safeName)}</p>` }] }] };
  }
  const finalText = description.sections.flatMap((section) => section.items || []).filter((item) => item.type === 'TEXT').map((item) => item.content || '').join('\n');
  const finalCheck = allegroCheckText(finalText);
  return {
    draft: { ...draft, description },
    compliance: {
      ok: finalCheck.ok,
      violations: finalCheck.violations,
      removed: sanitized.removed,
      removedCount: sanitized.removedCount,
      policyId: ALLEGRO_COMPLIANCE_POLICY.id,
      checkedAt: new Date().toISOString(),
    },
  };
}
