const asText = (value = '', limit = 20_000) => String(value ?? '').slice(0, limit).trim();

export function classifyAllegroMessageAuthor(message = {}) {
  const explicit = String(message.authorType || '').toLowerCase();
  const role = String(message.role || message.author?.role || message.author?.type || '').trim().toUpperCase();
  const login = String(message.authorLogin || message.author?.login || message.author?.id || '').trim().toLowerCase();
  const hasInterlocutorFlag = typeof message.author?.isInterlocutor === 'boolean' || typeof message.isInterlocutor === 'boolean';
  const isInterlocutor = typeof message.author?.isInterlocutor === 'boolean'
    ? message.author.isInterlocutor
    : message.isInterlocutor;

  // Pola źródłowe API mają pierwszeństwo przed zapisanym wcześniej authorType.
  // Dzięki temu stary, błędnie sklasyfikowany cache naprawia się przy kolejnym scaleniu.
  if (role === 'BUYER') return 'buyer';
  if (role === 'SELLER') return 'seller';
  if (['ADMIN', 'ALLEGRO', 'SYSTEM', 'MODERATOR', 'FULFILLMENT'].includes(role)) return 'allegro';
  // Centrum Wiadomości nie zwraca roli, lecz author.isInterlocutor.
  if (hasInterlocutorFlag) return isInterlocutor ? 'buyer' : 'seller';
  if (message.system === true) return 'allegro';
  if (explicit === 'buyer' || explicit === 'seller') return explicit;
  if (message.incoming === true) return 'buyer';
  if (message.seller === true || message.incoming === false) return 'seller';
  if (explicit === 'allegro') return 'allegro';
  if (/^(administrator|admin|system|moderator|fulfillment)([-_. ]|$)/i.test(login)) return 'allegro';
  return 'allegro';
}

export function allegroMessagePlainText(value = '') {
  return asText(value)
    .replace(/<\s*br\s*\/?\s*>/giu, '\n')
    .replace(/<\s*\/\s*(?:p|div|li)\s*>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó')
    .replace(/&aogon;/g, 'ą').replace(/&Aogon;/g, 'Ą')
    .replace(/&cacute;/g, 'ć').replace(/&Cacute;/g, 'Ć')
    .replace(/&eogon;/g, 'ę').replace(/&Eogon;/g, 'Ę')
    .replace(/&lstrok;/g, 'ł').replace(/&Lstrok;/g, 'Ł')
    .replace(/&nacute;/g, 'ń').replace(/&Nacute;/g, 'Ń')
    .replace(/&sacute;/g, 'ś').replace(/&Sacute;/g, 'Ś')
    .replace(/&zacute;/g, 'ź').replace(/&Zacute;/g, 'Ź')
    .replace(/&zdot;/g, 'ż').replace(/&Zdot;/g, 'Ż')
    .replace(/&ndash;/giu, '–').replace(/&mdash;/giu, '—')
    .replace(/&#(\d{1,7});/gu, (_, number) => {
      const code = Number(number);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]{1,6});/giu, (_, number) => {
      const code = Number.parseInt(number, 16);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/[ \t]+/gu, ' ')
    .replace(/[ \t]*\n[ \t]*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function uniqueMessages(item = {}) {
  const source = Array.isArray(item.messages) && item.messages.length
    ? item.messages
    : [item.lastMessage, item.latestNewIncoming].filter(Boolean);
  const seen = new Set();
  return source.filter((message) => {
    const key = asText(message?.id || `${message?.createdAt || ''}:${message?.authorLogin || ''}:${message?.text || ''}`, 5_000);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')));
}

export function allegroReplyMessageKey(message = {}) {
  return asText(message?.id || `${message?.createdAt || message?.created_at || ''}:${classifyAllegroMessageAuthor(message)}:${message?.authorLogin || ''}:${message?.text || message?.body || ''}`, 5_000);
}

export function mergeAllegroReplyHistory(...sources) {
  const byKey = new Map();
  for (const source of sources) {
    for (const raw of (Array.isArray(source) ? source : [])) {
      if (!raw || typeof raw !== 'object') continue;
      const message = { ...raw, text: allegroMessagePlainText(raw.text || raw.body || '').slice(0, 3_000), authorType: classifyAllegroMessageAuthor(raw) };
      const key = allegroReplyMessageKey(message);
      if (!key) continue;
      byKey.set(key, byKey.has(key) ? { ...byKey.get(key), ...message } : message);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const ta = new Date(a.createdAt || a.created_at || 0).getTime() || 0;
    const tb = new Date(b.createdAt || b.created_at || 0).getTime() || 0;
    return ta === tb ? allegroReplyMessageKey(a).localeCompare(allegroReplyMessageKey(b), 'pl') : ta - tb;
  });
}

function replyHistoryPage(raw = {}) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.messages)) return raw.messages;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.chat)) return raw.chat;
  if (Array.isArray(raw.chat?.messages)) return raw.chat.messages;
  return [];
}

/** Pobiera wyłącznie historię (GET). Nigdy nie wysyła odpowiedzi do Allegro. */
export async function fetchAllegroReplyHistory({ call, type = 'thread', id = '', maxMessages = 200, issueAccept = '' } = {}) {
  if (typeof call !== 'function') throw new TypeError('Brakuje adaptera pobierania rozmowy Allegro.');
  const safeId = asText(id, 120);
  if (!safeId) throw new TypeError('Brakuje identyfikatora rozmowy Allegro.');
  const issue = type === 'issue', pageSize = issue ? 100 : 20;
  const safeMax = Math.max(1, Math.min(500, Number(maxMessages) || 200));
  const path = issue ? `/sale/issues/${encodeURIComponent(safeId)}/chat` : `/messaging/threads/${encodeURIComponent(safeId)}/messages`;
  const pages = [];
  for (let offset = 0; offset < safeMax; offset += pageSize) {
    const limit = Math.min(pageSize, safeMax - offset);
    const raw = await call(path, { method: 'GET', parameters: { limit, offset }, ...(issueAccept ? { accept: issueAccept } : {}) });
    const page = replyHistoryPage(raw).slice(0, limit);
    pages.push(page);
    if (page.length < limit) break;
  }
  return { messages: mergeAllegroReplyHistory(...pages).slice(-safeMax), pages: pages.length, truncated: pages.flat().length >= safeMax };
}

export function analyzeAllegroConversation(item = {}, relatedItems = [], currentOrderId = '') {
  const messages = uniqueMessages(item);
  const buyer = messages.filter((message) => classifyAllegroMessageAuthor(message) === 'buyer');
  const seller = messages.filter((message) => classifyAllegroMessageAuthor(message) === 'seller');
  const system = messages.filter((message) => classifyAllegroMessageAuthor(message) === 'allegro');
  const lastSellerIndex = messages.reduce((last, message, index) => classifyAllegroMessageAuthor(message) === 'seller' ? index : last, -1);
  const unansweredBuyer = messages.slice(lastSellerIndex + 1).filter((message) => classifyAllegroMessageAuthor(message) === 'buyer');
  const relevantBuyer = unansweredBuyer.length ? unansweredBuyer : buyer.slice(-1);
  const buyerText = relevantBuyer.map((message) => asText(message.text, 8_000)).join('\n').toLowerCase();
  const sellerText = seller.map((message) => asText(message.text, 8_000)).join('\n').toLowerCase();
  const cachedIncoming = classifyAllegroMessageAuthor(item.latestNewIncoming || {}) === 'buyer' ? item.latestNewIncoming : null;
  const latestBuyer = buyer.at(-1) || cachedIncoming || {};
  const latestBuyerText = asText(latestBuyer.text || '', 8_000).toLowerCase();
  const wantsRefund = /(?:prosz|chc|oczek|żąda|zwrot).{0,45}(?:zwrot|pieni|środk)|zwrot.{0,45}(?:pieni|środk)/i.test(buyerText);
  const rejectsReshipment = /(?:nie chc|proszę nie|bez).{0,45}(?:ponown|kolejn|żadn).{0,30}(?:wysył|przesył|pacz)|nie chc.{0,45}(?:wysył|przesył|pacz)/i.test(buyerText);
  const reportsMissingParcel = /(?:nie (?:dosta|otrzyma|widz)|brak).{0,45}(?:pacz|przesył)|pacz.{0,45}(?:nie dotar|nie było|brak)/i.test(buyerText);
  const reportsReturnedParcel = /(?:cofni|zwrócon|wraca|odesłan).{0,45}(?:nadawc|sprzedawc)|(?:inpost|kurier).{0,70}(?:cofni|zwrócon)/i.test(buyerText);
  const sellerOfferedReshipment = /(?:wyślemy|wyśle|wysłać|nadamy|wysyłamy).{0,45}(?:ponown|jeszcze raz|nową|pacz)|(?:ponown|jeszcze raz).{0,45}(?:wysył|wyśl|pacz)/i.test(sellerText);
  const relatedConversations = (Array.isArray(relatedItems) ? relatedItems : [])
    .filter((related) => related && String(related.id || '') !== String(item.id || ''))
    .map((related) => {
      const relatedMessages = uniqueMessages(related), relatedBuyer = relatedMessages.filter((message) => classifyAllegroMessageAuthor(message) === 'buyer');
      const orderId = asText(related.orderId || related.lastMessage?.orderId || relatedMessages.find((message) => message?.orderId)?.orderId || '', 120);
      return {
        type: related.communicationType === 'issue' || related.type === 'issue' ? 'issue' : 'thread',
        id: asText(related.id, 120), orderId,
        sameOrder: !!currentOrderId && !!orderId && String(orderId) === String(currentOrderId),
        messageCount: relatedMessages.length,
        latestAt: relatedMessages.at(-1)?.createdAt || related.lastMessageDateTime || related.openedDate || null,
        latestBuyerText: asText(relatedBuyer.at(-1)?.text || related.subject || '', 500),
      };
    })
    .sort((a, b) => String(b.latestAt || '').localeCompare(String(a.latestAt || '')))
    .slice(0, 25);
  return {
    messages,
    messageCount: messages.length,
    buyerMessageCount: buyer.length,
    hasBuyerMessage: buyer.length > 0 || !!cachedIncoming,
    sellerMessageCount: seller.length,
    systemMessageCount: system.length,
    unansweredBuyerCount: unansweredBuyer.length,
    latestBuyerText,
    latestIncomingAt: latestBuyer.createdAt || null,
    intents: { wantsRefund, rejectsReshipment, reportsMissingParcel, reportsReturnedParcel, sellerOfferedReshipment },
    relatedConversationCount: relatedConversations.length,
    sameOrderRelatedCount: relatedConversations.filter((entry) => entry.sameOrder).length,
    relatedConversations,
  };
}

function capitalizeSentences(value = '') {
  return value.replace(/(^|[.!?]\s+|\n\s*)([a-ząćęłńóśźż])/gu, (_, lead, letter) => `${lead}${letter.toLocaleUpperCase('pl-PL')}`);
}

function mostCommon(values = [], fallback = '') {
  const count = new Map();
  for (const value of values.filter(Boolean)) count.set(value, (count.get(value) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
}

export function buildAllegroReplyStyleProfile(examples = []) {
  const clean = (Array.isArray(examples) ? examples : [])
    .map((value) => allegroMessagePlainText(value))
    .filter((value) => value.length >= 18 && !/zgłoszenie trafiło do obsługi Artway-TM[\s\S]*odpowiemy możliwie jak najszybciej/iu.test(value))
    .slice(-30);
  const greetings = clean.map((value) => value.match(/^\s*(Dzień dobry|Szanowni Państwo|Witam)[^\n,.!?]*[,.!]?/iu)?.[1]).filter(Boolean);
  const closings = clean.map((value) => {
    if (/Pozdrawiamy serdecznie/iu.test(value)) return 'Pozdrawiamy serdecznie,';
    if (/Z poważaniem/iu.test(value)) return 'Z poważaniem,';
    if (/Pozdrawiamy/iu.test(value)) return 'Pozdrawiamy,';
    if (/Pozdrawiam/iu.test(value)) return 'Pozdrawiamy,';
    return '';
  }).filter(Boolean);
  return {
    exampleCount: clean.length,
    greeting: mostCommon(greetings, 'Dzień dobry'),
    closing: mostCommon(closings, 'Pozdrawiamy serdecznie,'),
    formalAddress: clean.some((value) => /Państw(?:a|u|em|o)/u.test(value)),
    averageLength: clean.length ? Math.round(clean.reduce((sum, value) => sum + value.length, 0) / clean.length) : 0,
    learnedFrom: clean.length ? 'manual-seller-replies' : 'professional-default',
  };
}

function splitProfessionalParagraphs(value = '') {
  const rawParagraphs = value.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  const output = [];
  for (const paragraph of rawParagraphs) {
    if (/^(?:Dzień dobry|Szanowni Państwo|Witam)[^\n]*[,.!]?$/iu.test(paragraph) || /^(?:Pozdrawiam|Pozdrawiamy|Z poważaniem)/iu.test(paragraph)) {
      output.push(paragraph);
      continue;
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u).filter(Boolean);
    if (paragraph.length < 260 || sentences.length < 3) output.push(paragraph);
    else for (let index = 0; index < sentences.length; index += 2) output.push(sentences.slice(index, index + 2).join(' '));
  }
  return output.join('\n\n');
}

export function improvePolishReplyStyle(draft = '', options = {}) {
  let value = asText(draft);
  if (!value) return '';
  const profile = options?.styleProfile && typeof options.styleProfile === 'object' ? options.styleProfile : {};
  const corrections = [
    [/\bprzepraszamy\s+za\s+zaistniało\b/giu, 'przepraszamy za zaistniałą'],
    [/\bzaistniałą\s+sytuacje\b/giu, 'zaistniałą sytuację'],
    [/\bza\s+tak[aą]\s+sytuacj[aeę]\b/giu, 'za tę sytuację'],
    [/\bnie\s+mamy\s+wpływ(?:u)?\s+za\s+dostawę/giu, 'nie mamy bezpośredniego wpływu na przebieg doręczenia'],
    [/\bprzesyłka\s+została\s+od\s+nas\s+wysłana\b/giu, 'przesyłka została przez nas nadana'],
    [/\bnapewno\b/giu, 'na pewno'],
    [/\bjuz\b/giu, 'już'],
    [/\btalko\b/giu, 'tylko'],
    [/\bpowina\b/giu, 'powinna'],
    [/\bzostala\b/giu, 'została'],
    [/\bzostal\b/giu, 'został'],
    [/\bpaństwa\s+decyzje\b/giu, 'Państwa decyzję'],
    [/\bczekamy\s+(?:tylko\s+)?na\s+Państwa\s+decyzję\b/giu, 'prosimy o informację, które rozwiązanie Państwo wybierają'],
    [/\brekpesat[ayę]\b/giu, 'rekompensaty'],
    [/\brekompesat[ayę]\b/giu, 'rekompensaty'],
    [/\bmały\s+gratis\b/giu, 'drobny upominek'],
    [/\bzwrot\s+pieniędzy\s+został\s+zlecony\b/giu, 'zwrot środków został zlecony'],
    [/\bpaństwa\b/gu, 'Państwa'],
    [/\bartway[- ]tm\b/giu, 'Artway-TM'],
  ];
  for (const [pattern, replacement] of corrections) value = value.replace(pattern, replacement);
  value = value
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[^\s\n\d])/g, '$1 ')
    .replace(/\s*,\s*/g, (match, offset, whole) => {
      const before = whole[offset - 1] || '', after = whole[offset + match.length] || '';
      return /\d/.test(before) && /\d/.test(after) ? ',' : ', ';
    })
    .replace(/([.!?])\s*,+/g, '$1 ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  value = capitalizeSentences(value);
  value = value
    .replace(/(?:Jeszcze\s+raz\s+)?bardzo\s+przepraszamy\s+za\s+(?:zaistniałą|tę)\s+sytuację\s*,?\s*(?:ale|jednak)\s+/giu, 'Bardzo przepraszamy za zaistniałą sytuację. ')
    .replace(/\bprzesyłka została przez nas nadana\s+(?:a|ale)\s+nie mamy bezpośredniego wpływu/giu, 'Przesyłka została przez nas nadana, jednak nie mamy bezpośredniego wpływu')
    .replace(/(^|[.!?]\s+)Ale\s+(?=w ramach|prosimy|dziękujemy)/gu, '$1')
    .replace(/,\s*(?=(?:zwrot|reklamacja|zamówienie|przesyłka)\b)/giu, '. ')
    .replace(/\b(Bardzo\s+)?przepraszamy\s+za\s+(?:tę|zaistniałą)\s+sytuację(?:\s+oraz\s+wszelkie\s+niedogodności)?\.?\s+(?:Bardzo\s+)?przepraszamy[^.!?]*[.!?]?/giu, 'Bardzo przepraszamy za tę sytuację i związane z nią niedogodności.')
    .replace(/(^|\n)(Pozdrawiamy serdecznie|Pozdrawiamy|Z poważaniem)(?![,.!])/giu, '$1$2,');
  value = capitalizeSentences(value);
  value = splitProfessionalParagraphs(value);
  value = value.split(/\n{2,}/u).map((paragraph) => {
    const trimmed = paragraph.trim();
    if (!trimmed || /^(?:Dzień dobry|Szanowni Państwo|Witam)[,.!]?$/iu.test(trimmed) || /^(?:Pozdrawiam|Pozdrawiamy|Z poważaniem|Artway-TM)/iu.test(trimmed)) return trimmed;
    return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
  }).filter(Boolean).join('\n\n');
  if (options?.ensureReplyFrame) {
    const greeting = String(profile.greeting || 'Dzień dobry').replace(/[,.!]+$/u, '');
    const closing = String(profile.closing || 'Pozdrawiamy serdecznie,').replace(/[.!]+$/u, ',');
    if (!/^(?:Dzień dobry|Szanowni Państwo|Witam)\b/iu.test(value)) value = `${greeting},\n\n${value}`;
    if (!/(?:Pozdrawiam|Z poważaniem)[\s\S]{0,80}(?:Artway-TM)?\s*$/iu.test(value)) value = `${value}\n\n${closing}\nArtway-TM`;
    else if (!/Artway-TM\s*$/iu.test(value)) value = `${value}\nArtway-TM`;
  }
  return value.slice(0, 20_000);
}

function baseVerifiedAnswer(context = {}, latestIncoming = '') {
  const incoming = String(latestIncoming || '').toLowerCase();
  const shippingQuestion = /kiedy|wysył|pacz|dostaw|status|gdzie|kurier|inpost/.test(incoming);
  const stockQuestion = /dostępn|stan|iloś|sztuk/.test(incoming);
  const paymentQuestion = /płat|zapł|przelew|zwrot.*pieni|zwrot.*środk/.test(incoming);
  if (!context.orderFound) {
    return context.candidateOrderIds?.length > 1
      ? 'Znaleźliśmy kilka zamówień powiązanych z kontem. Prosimy o podanie numeru zamówienia, abyśmy mogli sprawdzić właściwą sprawę bez ryzyka pomyłki.'
      : 'Nie udało się jednoznacznie dopasować zamówienia do rozmowy. Prosimy o podanie numeru zamówienia, abyśmy mogli sprawdzić właściwą sprawę.';
  }
  if (context.status === 'CANCELLED') return `Zamówienie ${context.orderId} ma w Allegro status anulowanego.`;
  if (context.status === 'RETURNED') return `Zamówienie ${context.orderId} ma w Allegro status zwróconego.`;
  if (shippingQuestion) {
    if (context.shipment?.delivered) return `Zamówienie ${context.orderId} ma status odebranego${context.shipment.tracking ? `, a numer nadania to ${context.shipment.tracking}` : ''}.`;
    if (context.shipment?.sent) return `Potwierdzamy nadanie zamówienia ${context.orderId}${context.shipment.carrier ? ` przez ${context.shipment.carrier}` : ''}${context.shipment.tracking ? `. Numer przesyłki: ${context.shipment.tracking}` : ''}.`;
    if (context.shipment?.tracking) return `Dla zamówienia ${context.orderId} nadano numer przesyłki ${context.shipment.tracking}, jednak jego aktualny status w Allegro to „${context.statusLabel || context.status}”.`;
    if (context.shipment?.labelCreated) return `Dla zamówienia ${context.orderId} utworzono etykietę, ale przesyłka nie jest jeszcze potwierdzona jako nadana.`;
    return `Zamówienie ${context.orderId} ma obecnie status „${context.statusLabel || context.status}” i nie ma jeszcze potwierdzonego numeru nadania.`;
  }
  if (stockQuestion && Number(context.shortages) > 0) return `W zamówieniu ${context.orderId} brakuje obecnie ${context.shortages} szt. produktów; oczekuje ono na uzupełnienie lub potwierdzenie dostępności.`;
  if (stockQuestion && context.ready) return `Wszystkie pozycje zamówienia ${context.orderId} są gotowe do skompletowania.`;
  if (paymentQuestion) return `Zamówienie ${context.orderId} ma status „${context.statusLabel || context.status}”${context.paymentStatus ? `, a zapis płatności to „${context.paymentStatus}”` : ''}.`;
  if (Number(context.shortages) > 0) return `Zamówienie ${context.orderId} ma status „${context.statusLabel || context.status}”, a kontrola magazynowa wykazała brak ${context.shortages} szt. produktów.`;
  if (context.ready) return `Zamówienie ${context.orderId} ma status „${context.statusLabel || context.status}”, a wszystkie pozycje są gotowe do skompletowania.`;
  return `Zamówienie ${context.orderId} ma obecnie w Allegro status „${context.statusLabel || context.status}”.`;
}

export function buildContextualAllegroReply({ type = 'thread', item = {}, context = {}, draft = '', relatedItems = [], styleProfile = {} } = {}) {
  const conversation = analyzeAllegroConversation(item, relatedItems, context.orderId);
  const intents = conversation.intents;
  const styledDraft = improvePolishReplyStyle(draft);
  const draftLower = styledDraft.toLowerCase();
  const paragraphs = [];
  const sensitive = intents.wantsRefund || intents.rejectsReshipment || intents.reportsMissingParcel || intents.reportsReturnedParcel;
  if (sensitive) paragraphs.push('Bardzo przepraszamy za zaistniałą sytuację i związane z nią niedogodności.');
  if (intents.wantsRefund && intents.rejectsReshipment) paragraphs.push('Rozumiemy, że oczekiwanym rozwiązaniem jest zwrot środków, bez ponownej wysyłki.');
  else if (intents.wantsRefund) paragraphs.push('Rozumiemy, że oczekiwanym rozwiązaniem jest zwrot środków.');
  else if (intents.rejectsReshipment) paragraphs.push('Przyjęliśmy informację, że nie należy organizować ponownej wysyłki.');

  const verified = baseVerifiedAnswer(context, conversation.latestBuyerText);
  if (verified) paragraphs.push(verified);
  if (intents.reportsReturnedParcel && context.status !== 'RETURNED') paragraphs.push('Z przekazanej przez Państwa informacji wynika, że przewoźnik cofnął przesyłkę do nadawcy; uwzględniamy to w dalszej obsłudze sprawy.');

  const refundClaimInDraft = /(?:zwrot|środk|pieni).{0,60}(?:zlecon|wykonan|uruchomion)/i.test(draftLower);
  const trustedRefundStatus = String(context.paymentStatus || '').trim();
  const refundConfirmed = /(?:REFUNDED|REFUND[_ -]?COMPLETED|ZWROT.{0,25}(?:WYKON|ZAKOŃCZ|ZAKONCZ|ZREALIZ)|ŚRODKI.{0,20}ZWRÓCON|SRODKI.{0,20}ZWROCON)/i.test(trustedRefundStatus);
  if (intents.wantsRefund && refundConfirmed) paragraphs.push('Zwrot środków został potwierdzony w danych płatności zamówienia.');

  const customSentences = styledDraft
    .replace(/^(dzień dobry[^\n]*|witam[^\n]*)[,.!]?\s*/iu, '')
    .replace(/\n*(pozdrawiamy[\s\S]*|z poważaniem[\s\S]*)$/iu, '')
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !/przeprasz|status|numer (?:nadania|przesyłki)|zwrot|pieni|środk|wysłan|nadani|pacz|przesył|gratis|upominek|rekompens/i.test(sentence));
  paragraphs.push(...customSentences.slice(0, 3));
  if (type === 'issue') paragraphs.push('Dalszą obsługę będziemy prowadzić w tej dyskusji, aby cała historia sprawy pozostała w jednym miejscu.');
  const body = [...new Set(paragraphs.map((paragraph) => improvePolishReplyStyle(paragraph)).filter(Boolean))].join('\n\n');
  return {
    suggestion: improvePolishReplyStyle(`Dzień dobry,\n\n${body}\n\n${styleProfile.closing || 'Pozdrawiamy serdecznie,'}\nArtway-TM`, { styleProfile }).slice(0, 20_000),
    conversation: {
      messageCount: conversation.messageCount,
      buyerMessageCount: conversation.buyerMessageCount,
      sellerMessageCount: conversation.sellerMessageCount,
      systemMessageCount: conversation.systemMessageCount,
      latestIncomingAt: conversation.latestIncomingAt,
      intents,
      relatedConversationCount: conversation.relatedConversationCount,
      sameOrderRelatedCount: conversation.sameOrderRelatedCount,
      relatedConversations: conversation.relatedConversations,
      warnings: refundClaimInDraft && !refundConfirmed ? ['Szkic zawierał niepotwierdzoną informację o wykonaniu lub zleceniu zwrotu. Agent usunął ją z odpowiedzi; status zwrotu musi pochodzić z danych płatności.'] : [],
      unverifiedRefundClaimRemoved: refundClaimInDraft && !refundConfirmed,
      contradictoryReshipmentRemoved: intents.rejectsReshipment && (intents.sellerOfferedReshipment || /gratis|upominek|ponown.{0,20}wysył|wyślemy.{0,20}pacz/i.test(draftLower)),
      styleProfile: { exampleCount: Number(styleProfile.exampleCount || 0), learnedFrom: styleProfile.learnedFrom || 'professional-default', averageLength: Number(styleProfile.averageLength || 0) },
    },
  };
}
