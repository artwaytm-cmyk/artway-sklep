const asText = (value = '', limit = 20_000) => String(value ?? '').slice(0, limit).trim();

function authorType(message = {}) {
  const explicit = String(message.authorType || '').toLowerCase();
  const role = String(message.role || '').toUpperCase();
  const login = String(message.authorLogin || '').toLowerCase();
  if (['buyer', 'seller', 'allegro'].includes(explicit)) return explicit;
  if (message.system === true || ['ADMIN', 'ALLEGRO', 'SYSTEM', 'MODERATOR'].includes(role) || /^(allegro|administrator|admin|system|moderator)([-_. ]|$)/i.test(login)) return 'allegro';
  if (role === 'BUYER' || message.incoming === true) return 'buyer';
  if (role === 'SELLER' || message.seller === true || message.incoming === false) return 'seller';
  return 'allegro';
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
  return asText(message?.id || `${message?.createdAt || message?.created_at || ''}:${authorType(message)}:${message?.authorLogin || ''}:${message?.text || message?.body || ''}`, 5_000);
}

export function mergeAllegroReplyHistory(...sources) {
  const byKey = new Map();
  for (const source of sources) {
    for (const raw of (Array.isArray(source) ? source : [])) {
      if (!raw || typeof raw !== 'object') continue;
      const message = { ...raw, text: asText(raw.text || raw.body || '', 3_000), authorType: authorType(raw) };
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
  const buyer = messages.filter((message) => authorType(message) === 'buyer');
  const seller = messages.filter((message) => authorType(message) === 'seller');
  const system = messages.filter((message) => authorType(message) === 'allegro');
  const lastSellerIndex = messages.reduce((last, message, index) => authorType(message) === 'seller' ? index : last, -1);
  const unansweredBuyer = messages.slice(lastSellerIndex + 1).filter((message) => authorType(message) === 'buyer');
  const relevantBuyer = unansweredBuyer.length ? unansweredBuyer : buyer.slice(-1);
  const buyerText = relevantBuyer.map((message) => asText(message.text, 8_000)).join('\n').toLowerCase();
  const sellerText = seller.map((message) => asText(message.text, 8_000)).join('\n').toLowerCase();
  const latestBuyer = buyer.at(-1) || item.latestNewIncoming || item.lastMessage || {};
  const latestBuyerText = asText(latestBuyer.text || item.subject, 8_000).toLowerCase();
  const wantsRefund = /(?:prosz|chc|oczek|żąda|zwrot).{0,45}(?:zwrot|pieni|środk)|zwrot.{0,45}(?:pieni|środk)/i.test(buyerText);
  const rejectsReshipment = /(?:nie chc|proszę nie|bez).{0,45}(?:ponown|kolejn|żadn).{0,30}(?:wysył|przesył|pacz)|nie chc.{0,45}(?:wysył|przesył|pacz)/i.test(buyerText);
  const reportsMissingParcel = /(?:nie (?:dosta|otrzyma|widz)|brak).{0,45}(?:pacz|przesył)|pacz.{0,45}(?:nie dotar|nie było|brak)/i.test(buyerText);
  const reportsReturnedParcel = /(?:cofni|zwrócon|wraca|odesłan).{0,45}(?:nadawc|sprzedawc)|(?:inpost|kurier).{0,70}(?:cofni|zwrócon)/i.test(buyerText);
  const sellerOfferedReshipment = /(?:wyślemy|wyśle|wysłać|nadamy|wysyłamy).{0,45}(?:ponown|jeszcze raz|nową|pacz)|(?:ponown|jeszcze raz).{0,45}(?:wysył|wyśl|pacz)/i.test(sellerText);
  const relatedConversations = (Array.isArray(relatedItems) ? relatedItems : [])
    .filter((related) => related && String(related.id || '') !== String(item.id || ''))
    .map((related) => {
      const relatedMessages = uniqueMessages(related), relatedBuyer = relatedMessages.filter((message) => authorType(message) === 'buyer');
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

export function improvePolishReplyStyle(draft = '') {
  let value = asText(draft);
  if (!value) return '';
  const corrections = [
    [/\bprzepraszamy\s+za\s+zaistniało\b/giu, 'przepraszamy za zaistniałą'],
    [/\bzaistniałą\s+sytuacje\b/giu, 'zaistniałą sytuację'],
    [/\bnie\s+mamy\s+wpływ\s+za\s+dostawę\b/giu, 'nie mamy wpływu na przebieg dostawy'],
    [/\bnie\s+mamy\s+wpływ\b/giu, 'nie mamy wpływu'],
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
  value = value.replace(/(^|\n)(Pozdrawiamy serdecznie)(?![,.!])/giu, '$1$2,');
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

export function buildContextualAllegroReply({ type = 'thread', item = {}, context = {}, draft = '', relatedItems = [] } = {}) {
  const conversation = analyzeAllegroConversation(item, relatedItems, context.orderId);
  const intents = conversation.intents;
  const styledDraft = improvePolishReplyStyle(draft);
  const draftLower = styledDraft.toLowerCase();
  const buyer = asText(item.buyerLogin || 'Kliencie', 120);
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
    suggestion: `Dzień dobry ${buyer},\n\n${body}\n\nPozdrawiamy serdecznie,\nArtway-TM`.slice(0, 20_000),
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
    },
  };
}
