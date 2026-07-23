const ICONS = Object.freeze({ critical: '🔴', warning: '🟠', info: '🔵' });

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function compact(value = '', limit = 220) {
  const clean = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, Math.max(1, limit - 1)).trimEnd()}…` : clean;
}

function form(value, one, few, many) {
  const count = Math.abs(Number(value) || 0), last = count % 10, lastTwo = count % 100;
  if (count === 1) return one;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

function dayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function deadlineLabel(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('pl-PL', {
    timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit',
  });
  if (dayKey(date) === dayKey(now)) return `dzisiaj do ${time}`;
  if (dayKey(date) === dayKey(new Date(now.getTime() + 86400000))) return `jutro do ${time}`;
  return `do ${date.toLocaleDateString('pl-PL', {
    timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit',
  })}, ${time}`;
}

function descriptionLabel(record = {}) {
  if (record.category === 'customer' || /wiadomość|dyskusj|reklamacj/i.test(String(record.title || ''))) return 'Wiadomość klienta';
  if (record.category === 'supplier' && Array.isArray(record.items) && record.items.length) return 'Wynik kontroli';
  return 'Działanie';
}

export function renderTelegramIncident(record = {}, options = {}) {
  const overdue = options.overdue === true;
  const icon = overdue ? '⏱' : (ICONS[record.severity] || '🟠');
  const count = Math.max(1, Number(record.count) || 1);
  const lines = [
    `<b>${icon} ${escapeHtml(compact(record.title || 'Sprawa', 120))}</b>${count > 1 ? ` · ${count}` : ''}`,
  ];
  const facts = (Array.isArray(record.facts) ? record.facts : [])
    .map((item) => compact(item, 100)).filter(Boolean).slice(0, 4);
  if (facts.length) lines.push(`<b>Dane:</b> ${facts.map(escapeHtml).join(' · ')}`);
  const description = compact(record.description || '', 260);
  if (description) lines.push('', `<b>${descriptionLabel(record)}:</b>`, `<blockquote>${escapeHtml(description)}</blockquote>`);
  const items = (Array.isArray(record.items) ? record.items : [])
    .map((item) => compact(item, 140)).filter(Boolean).slice(0, 8);
  if (items.length) lines.push('', '<b>Szczegóły:</b>', ...items.map((item) => `• ${escapeHtml(item)}`));
  const doneWhen = compact(record.doneWhen || '', 220);
  if (doneWhen) lines.push('', `<b>Oczekiwany wynik:</b> ${escapeHtml(doneWhen)}`);
  if (record.dueAt) lines.push(`<b>Termin:</b> ${overdue ? 'po terminie' : escapeHtml(deadlineLabel(record.dueAt))}`);
  return lines.filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== '')).join('\n').trim();
}

export function renderTelegramDigest(events = [], heading = '🔔 Ważne sprawy Artway-TM') {
  const source = Array.isArray(events) ? events : [];
  if (!source.length) return `<b>${escapeHtml(heading)}</b>\n✅ Brak nowych spraw.`;
  const rows = source.slice(0, 8).map((event, index) => {
    const count = Math.max(1, Number(event.count) || 1);
    const description = compact(event.description || '', 150);
    const doneWhen = compact(event.doneWhen || '', 140);
    const facts = (Array.isArray(event.facts) ? event.facts : [])
      .map((item) => compact(item, 80)).filter(Boolean).slice(0, 2);
    return [
      `<b>${index + 1}. ${ICONS[event.severity] || '•'} ${escapeHtml(compact(event.title || 'Sprawa', 100))}</b>${count > 1 ? ` · ${count}` : ''}`,
      facts.length ? `<b>Dane:</b> ${facts.map(escapeHtml).join(' · ')}` : '',
      description ? `<b>${descriptionLabel(event)}:</b> ${escapeHtml(description)}` : '',
      doneWhen ? `<b>Oczekiwany wynik:</b> ${escapeHtml(doneWhen)}` : '',
    ].filter(Boolean).join('\n');
  });
  const hidden = source.length > 8 ? `\n\nPozostałe sprawy: ${source.length - 8}.` : '';
  return `<b>${escapeHtml(heading)}</b>\n${source.length} ${form(source.length, 'nowa sprawa', 'nowe sprawy', 'nowych spraw')}\n\n${rows.join('\n\n')}${hidden}`;
}

export function renderTelegramMetricCard({ title, empty, metrics = [], action = '' } = {}) {
  const active = metrics.filter((item) => Number(item?.value) > 0);
  if (!active.length) return `<b>${escapeHtml(title || 'Stan bieżący')}</b>\n✅ ${escapeHtml(empty || 'Brak spraw wymagających reakcji.')}`;
  const rows = active.map((item) => `• <b>${Number(item.value)}</b> ${escapeHtml(item.label || '')}`);
  return [
    `<b>${escapeHtml(title || 'Stan bieżący')}</b>`,
    ...rows,
    action ? `\n<b>Do wykonania:</b> ${escapeHtml(action)}` : '',
  ].filter(Boolean).join('\n');
}

export function renderTelegramEscalation(record = {}, minutes = 0) {
  const count = Math.max(1, Number(record.count) || 1);
  return [
    `<b>⏱ Sprawa po terminie · ${Math.max(1, Number(minutes) || 1)} min</b>`,
    `<b>${escapeHtml(compact(record.title || 'Pilna sprawa', 120))}</b>${count > 1 ? ` · ${count}` : ''}`,
    record.description ? `<b>Działanie:</b> ${escapeHtml(compact(record.description, 180))}` : '',
    record.owner?.name ? `<b>Osoba odpowiedzialna:</b> ${escapeHtml(compact(record.owner.name, 100))}` : '<b>Osoba odpowiedzialna:</b> nieprzypisana',
  ].filter(Boolean).join('\n');
}
