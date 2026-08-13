const text = (value, max = 5000) => String(value ?? '')
  .replace(/\u0000/g, '')
  .replace(/\r\n?/g, '\n')
  .trim()
  .slice(0, max);

const html = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const array = (value) => Array.isArray(value) ? value : [];

export function vonHalskyOrderContact(order = {}) {
  const customer = order?.customer && typeof order.customer === 'object' ? order.customer : {};
  const delivery = order?.delivery && typeof order.delivery === 'object' ? order.delivery : {};
  const email = text(delivery.email || customer.email, 200).toLowerCase();
  const name = [customer.firstName, customer.lastName]
    .map((value) => text(value, 80)).filter(Boolean).join(' ')
    || text(delivery.name, 160)
    || 'Klient';
  return { email, name };
}

export function vonHalskyOrderCommunicationHistory(order = {}) {
  return array(order?._artwayCommunication?.history)
    .filter((item) => item && typeof item === 'object')
    .slice(-100)
    .sort((left, right) => Date.parse(right.sentAt || right.createdAt || 0) - Date.parse(left.sentAt || left.createdAt || 0));
}

export function vonHalskyOrderCommunicationView(order = {}, emailConfig = {}) {
  const contact = vonHalskyOrderContact(order);
  const history = vonHalskyOrderCommunicationHistory(order);
  return {
    channel: 'email',
    configured: emailConfig?.configured === true,
    provider: text(emailConfig?.provider || 'smtp', 40),
    from: text(emailConfig?.from, 200),
    recipient: contact,
    history,
    sentCount: history.filter((item) => item.status === 'sent').length,
    lastSentAt: history.find((item) => item.status === 'sent')?.sentAt || null,
    platformMessaging: false,
  };
}

export function validateVonHalskyOrderMessage({ order = {}, subject, message } = {}) {
  const contact = vonHalskyOrderContact(order);
  const normalizedSubject = text(subject, 180).replace(/\s+/g, ' ');
  const normalizedMessage = text(message, 5000);
  const errors = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(contact.email)) errors.push({ field: 'recipient', message: 'Zamówienie nie zawiera prawidłowego adresu e-mail klienta.' });
  if (normalizedSubject.length < 3) errors.push({ field: 'subject', message: 'Temat wiadomości jest za krótki.' });
  if (normalizedMessage.length < 5) errors.push({ field: 'message', message: 'Treść wiadomości jest za krótka.' });
  return { ok: errors.length === 0, errors, contact, subject: normalizedSubject, message: normalizedMessage };
}

export function renderVonHalskyOrderMessage({ order = {}, subject = '', message = '' } = {}) {
  const validation = validateVonHalskyOrderMessage({ order, subject, message });
  if (!validation.ok) {
    const error = new Error(validation.errors.map((item) => item.message).join(' '));
    error.code = 'von_halsky_message_validation';
    error.status = 422;
    error.details = validation.errors;
    throw error;
  }
  const orderId = text(order.id, 180);
  const status = text(order.status || 'w realizacji', 80);
  const tracking = text(order?._artwayShipment?.trackingNumber || order?.delivery?.parcels?.[0]?.trackingNumber, 180);
  const lines = array(order.orderLines);
  const quantity = lines.reduce((sum, line) => sum + Math.max(1, Number(line?.quantity) || 1), 0);
  const plainFooter = [
    '',
    `Zamówienie: ${orderId}`,
    tracking ? `Numer przesyłki: ${tracking}` : '',
    'Artway-TM',
  ].filter(Boolean).join('\n');
  const bodyHtml = html(validation.message).replace(/\n/g, '<br>');
  const htmlMessage = `<!doctype html><html lang="pl"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:680px;margin:0 auto;padding:24px 14px">
      <div style="overflow:hidden;border:1px solid #dbe3ee;border-radius:18px;background:#fff;box-shadow:0 16px 40px rgba(15,23,42,.08)">
        <div style="padding:20px 24px;background:linear-gradient(120deg,#172554,#1d4ed8);color:#fff">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#fde68a">ARTWAY-TM • OBSŁUGA ZAMÓWIENIA</div>
          <div style="margin-top:6px;font-size:22px;font-weight:900">Zamówienie ${html(orderId)}</div>
        </div>
        <div style="padding:24px;font-size:15px;line-height:1.65">${bodyHtml}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 24px 22px">
          <div style="padding:10px;border-radius:10px;background:#f8fafc"><small style="color:#64748b">STATUS</small><br><b>${html(status)}</b></div>
          <div style="padding:10px;border-radius:10px;background:#f8fafc"><small style="color:#64748b">PRODUKTY</small><br><b>${quantity} szt.</b></div>
          <div style="padding:10px;border-radius:10px;background:#f8fafc"><small style="color:#64748b">PRZESYŁKA</small><br><b>${html(tracking || 'oczekuje')}</b></div>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:12px">Artway-TM • wiadomość dotycząca zamówienia ${html(orderId)}</div>
      </div>
    </div>
  </body></html>`;
  return {
    to: validation.contact.email,
    subject: validation.subject,
    text: `${validation.message}${plainFooter}`,
    html: htmlMessage,
    message: validation.message,
    contact: validation.contact,
  };
}
