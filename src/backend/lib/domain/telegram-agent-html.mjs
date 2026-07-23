export function telegramSafeAgentHtml(value = '', limit = 3900) {
  const source = String(value ?? ''), maxLength = Math.max(64, Math.min(4000, Number(limit) || 3900));
  const allowed = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'code', 'pre']), stack = [];
  let output = '', cursor = 0, truncated = false;
  const closingLength = () => stack.reduce((sum, tag) => sum + tag.length + 3, 0);
  const appendText = (textValue = '') => {
    for (const character of String(textValue)) {
      const escaped = character === '&' ? '&amp;' : character === '<' ? '&lt;' : character === '>' ? '&gt;' : character;
      if (output.length + escaped.length + closingLength() + 1 > maxLength) { truncated = true; return false; }
      output += escaped;
    }
    return true;
  };
  const tagPattern = /<[^>]*>/g;
  let match;
  while (!truncated && (match = tagPattern.exec(source))) {
    if (!appendText(source.slice(cursor, match.index))) break;
    const raw = match[0], parsed = raw.match(/^<(\/)?(b|strong|i|em|u|s|code|pre)>$/i);
    if (!parsed || !allowed.has(parsed[2].toLowerCase())) {
      if (!appendText(raw)) break;
    } else {
      const tag = parsed[2].toLowerCase();
      if (parsed[1]) {
        if (stack.at(-1) === tag) { output += `</${tag}>`; stack.pop(); }
        else if (!appendText(raw)) break;
      } else {
        const opening = `<${tag}>`, closing = `</${tag}>`;
        if (output.length + opening.length + closingLength() + closing.length + 1 > maxLength) { truncated = true; break; }
        output += opening;
        stack.push(tag);
      }
    }
    cursor = tagPattern.lastIndex;
  }
  if (!truncated) appendText(source.slice(cursor));
  if (truncated && output.length + closingLength() + 1 <= maxLength) output += '…';
  while (stack.length) output += `</${stack.pop()}>`;
  return output;
}

/** Formatuje wyłącznie przekazaną treść, bez dopisywania faktów. */
export function telegramProfessionalAgentHtml(value = '', limit = 3900) {
  const source = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!source) return '';
  if (/<\/?(?:b|strong|i|em|u|s|code|pre)>/i.test(source)) return telegramSafeAgentHtml(source.replace(/\n{3,}/g, '\n\n'), limit);
  const inline = (line = '') => String(line)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n]+)__/g, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
  const lines = source.replace(/\r\n?/g, '\n').split('\n'), output = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trimEnd(), table = [];
    if (line.includes('|')) {
      let cursor = index;
      while (cursor < lines.length && lines[cursor].includes('|')) table.push(lines[cursor++].trim());
      if (table.length >= 2) { output.push(`<pre>${table.join('\n')}</pre>`); index = cursor; continue; }
    }
    const trimmed = line.trim();
    if (!trimmed) { if (output.length && output.at(-1) !== '') output.push(''); index += 1; continue; }
    const bullet = trimmed.match(/^(?:[-*•·▪◦]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      const field = bullet[1].match(/^([^:\n]{1,48}):\s*(.+)$/);
      output.push(field ? `• <b>${field[1]}:</b> ${inline(field[2])}` : `• ${inline(bullet[1])}`);
    } else {
      const field = trimmed.match(/^([^:\n]{1,48}):\s*(.+)$/);
      if (field && !/^https?$/i.test(field[1])) output.push(`<b>${field[1]}:</b> ${inline(field[2])}`);
      else if (trimmed.endsWith(':') && trimmed.length <= 90) output.push(`<b>${inline(trimmed.slice(0, -1))}</b>`);
      else output.push(inline(trimmed));
    }
    index += 1;
  }
  return telegramSafeAgentHtml(output.join('\n').replace(/\n{3,}/g, '\n\n'), limit);
}

