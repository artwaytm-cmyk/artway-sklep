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

function descriptionStats(sections = []) {
  const items = sections.flatMap((section) => Array.isArray(section?.items) ? section.items : []);
  return {
    sections: sections.length,
    textItems: items.filter((item) => item?.type === 'TEXT').length,
    images: items.filter((item) => item?.type === 'IMAGE' && item.url).length,
  };
}

function sanitizeUnsafeTextBlock(tag, content = '') {
  const sanitized = allegroSanitizePlainText(content);
  if (!sanitized.text) return { html: '', ...sanitized, changedBlocks: 1 };
  return {
    html: `<${tag}>${escapeHtml(sanitized.text.replace(/\s*\n\s*/g, ' '))}</${tag}>`,
    ...sanitized,
    changedBlocks: 1,
  };
}

function sanitizeListBlock(tag, content = '') {
  const items = [];
  const removed = [];
  let changedBlocks = 0;
  const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li\s*>/giu;
  let match;
  while ((match = liPattern.exec(String(content)))) {
    const fullItem = match[0];
    const check = allegroCheckText(fullItem);
    if (check.ok) {
      // Bezpieczny punkt pozostaje dokładnie taki, jak w opisie z Allegro.
      items.push(fullItem);
      continue;
    }
    const sanitized = allegroSanitizePlainText(fullItem);
    removed.push(...sanitized.removed);
    changedBlocks += 1;
    if (sanitized.text) items.push(`<li>${escapeHtml(sanitized.text.replace(/\s*\n\s*/g, ' '))}</li>`);
  }
  // Opis bez znaczników LI traktujemy jako pojedynczy punkt, zamiast gubić treść.
  if (!items.length && !removed.length && plainText(content)) {
    const sanitized = allegroSanitizePlainText(content);
    removed.push(...sanitized.removed);
    changedBlocks += sanitized.removedCount ? 1 : 0;
    if (sanitized.text) items.push(`<li>${escapeHtml(sanitized.text.replace(/\s*\n\s*/g, ' '))}</li>`);
  }
  return {
    html: items.length ? `<${tag}>${items.join('')}</${tag}>` : '',
    removed,
    removedCount: removed.length,
    changedBlocks,
  };
}

function sanitizeAllegroRichText(content = '') {
  const source = String(content || '');
  if (allegroCheckText(source).ok) {
    return { html: source, removed: [], removedCount: 0, changedBlocks: 0 };
  }
  const blocks = [];
  const removed = [];
  let changedBlocks = 0;
  let cursor = 0;
  const blockPattern = /<(h1|h2|p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1\s*>/giu;
  let match;
  const appendLooseText = (value) => {
    if (!plainText(value)) return;
    const sanitized = sanitizeUnsafeTextBlock('p', value);
    removed.push(...sanitized.removed);
    changedBlocks += sanitized.changedBlocks;
    if (sanitized.html) blocks.push(sanitized.html);
  };
  while ((match = blockPattern.exec(source))) {
    appendLooseText(source.slice(cursor, match.index));
    const tag = String(match[1]).toLowerCase();
    const fullBlock = match[0];
    if (allegroCheckText(fullBlock).ok) {
      // Nagłówek, akapit albo lista bez naruszeń pozostają bajt w bajt bez zmian.
      blocks.push(fullBlock);
    } else if (tag === 'ul' || tag === 'ol') {
      const sanitized = sanitizeListBlock(tag, match[2]);
      removed.push(...sanitized.removed);
      changedBlocks += sanitized.changedBlocks;
      if (sanitized.html) blocks.push(sanitized.html);
    } else {
      const sanitized = sanitizeUnsafeTextBlock(tag, fullBlock);
      removed.push(...sanitized.removed);
      changedBlocks += sanitized.changedBlocks;
      if (sanitized.html) blocks.push(sanitized.html);
    }
    cursor = blockPattern.lastIndex;
  }
  appendLooseText(source.slice(cursor));
  return {
    html: blocks.join(''),
    removed,
    removedCount: removed.length,
    changedBlocks,
  };
}

export function allegroSanitizeDescription(description = {}) {
  const sourceSections = Array.isArray(description?.sections) ? description.sections : [];
  const before = descriptionStats(sourceSections);
  const sections = [];
  const removed = [];
  let changedBlocks = 0;
  for (const sourceSection of sourceSections) {
    const items = [];
    for (const sourceItem of (Array.isArray(sourceSection?.items) ? sourceSection.items : [])) {
      if (sourceItem?.type === 'IMAGE' && sourceItem.url) {
        items.push({ type: 'IMAGE', url: String(sourceItem.url) });
        continue;
      }
      if (sourceItem?.type !== 'TEXT') continue;
      const sanitized = sanitizeAllegroRichText(sourceItem.content || '');
      removed.push(...sanitized.removed);
      changedBlocks += sanitized.changedBlocks;
      if (sanitized.html) items.push({ type: 'TEXT', content: sanitized.html });
    }
    if (items.length) sections.push({ items });
  }
  const result = { sections };
  const after = descriptionStats(sections);
  const finalText = sections.flatMap((section) => section.items || []).filter((item) => item.type === 'TEXT').map((item) => item.content || '').join('\n');
  return {
    description: result,
    removed,
    removedCount: removed.length,
    check: allegroCheckText(finalText),
    changedBlocks,
    layoutPreserved: before.sections === after.sections && before.textItems === after.textItems && before.images === after.images,
    layout: { before, after },
  };
}

export function allegroEnforceDraft(draft = {}) {
  const sanitized = allegroSanitizeDescription(draft.description || {});
  let description = sanitized.description;
  if (!description.sections.some((section) => (section.items || []).some((item) => item.type === 'TEXT'))) {
    const safeName = allegroSanitizePlainText(draft.name || 'Produkt').text || 'Produkt';
    // Zachowaj położenie zdjęć i pierwszego pola tekstowego także wtedy, gdy cały tekst był niedozwolony.
    let fallbackInserted = false;
    const rebuiltSections = (Array.isArray(draft?.description?.sections) ? draft.description.sections : []).map((section) => ({
      items: (Array.isArray(section?.items) ? section.items : []).flatMap((item) => {
        if (item?.type === 'IMAGE' && item.url) return [{ type: 'IMAGE', url: String(item.url) }];
        if (item?.type === 'TEXT' && !fallbackInserted) {
          fallbackInserted = true;
          return [{ type: 'TEXT', content: `<p>${escapeHtml(safeName)}</p>` }];
        }
        return [];
      }),
    })).filter((section) => section.items.length);
    if (!fallbackInserted) rebuiltSections.push({ items: [{ type: 'TEXT', content: `<p>${escapeHtml(safeName)}</p>` }] });
    description = { sections: rebuiltSections };
  }
  const finalText = description.sections.flatMap((section) => section.items || []).filter((item) => item.type === 'TEXT').map((item) => item.content || '').join('\n');
  const finalCheck = allegroCheckText(finalText);
  const finalLayout = { before: sanitized.layout.before, after: descriptionStats(description.sections) };
  const layoutPreserved = finalLayout.before.sections === finalLayout.after.sections
    && finalLayout.before.textItems === finalLayout.after.textItems
    && finalLayout.before.images === finalLayout.after.images;
  return {
    draft: { ...draft, description },
    compliance: {
      ok: finalCheck.ok,
      violations: finalCheck.violations,
      removed: sanitized.removed,
      removedCount: sanitized.removedCount,
      changedBlocks: sanitized.changedBlocks,
      layoutPreserved,
      layout: finalLayout,
      policyId: ALLEGRO_COMPLIANCE_POLICY.id,
      checkedAt: new Date().toISOString(),
    },
  };
}
