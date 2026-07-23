import nodemailer from 'nodemailer';
import { tekst } from './core/http.mjs';

export function createEmailTransportService() {
  let smtpTransporter = null;
  let smtpFingerprint = '';
  let smtpHealth = { authenticated: false, checkedAt: null, error: '', code: '' };
  
  function sekretEmailJestMaska(value) {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (/^(?:\*+|•+|x{6,}|<[^>]+>|\[[^\]]+\])(?:[a-z]{0,8})?$/i.test(raw)) return true;
    const special = [...raw].filter((char) => !/[a-z0-9\s]/i.test(char)).length;
    const letters = [...raw].filter((char) => /[a-z0-9]/i.test(char)).length;
    return raw.length >= 12 && special >= 10 && letters <= 6;
  }
  
  function bezpiecznyBladEmail(error) {
    const code = tekst(error?.code || 'email_connection_error', 80).trim();
    const responseCode = Number(error?.responseCode || 0) || null;
    if (code === 'EAUTH' || responseCode === 535) return { code: 'email_auth_failed', error: 'Gmail odrzucił zapisane dane logowania. Wymagane jest prawidłowe hasło aplikacji Google.' };
    if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') return { code: 'email_connection_failed', error: 'Serwer pocztowy nie odpowiedział. Połączenie zostanie sprawdzone ponownie automatycznie.' };
    return { code, error: tekst(error?.message || 'Nie udało się połączyć z serwerem pocztowym.', 400) };
  }
  
  function emailKonfiguracja() {
    const providerRaw = tekst(process.env.EMAIL_PROVIDER, 40).trim().toLowerCase();
    const host = tekst(process.env.SMTP_HOST || (providerRaw === 'gmail' ? 'smtp.gmail.com' : ''), 120).trim();
    const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
    const secureRaw = tekst(process.env.SMTP_SECURE, 20).trim().toLowerCase();
    const secure = secureRaw ? ['1', 'true', 'yes', 'tak'].includes(secureRaw) : port === 465;
    const user = tekst(process.env.SMTP_USER || process.env.GMAIL_USER || '', 200).trim();
    const pass = tekst(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '', 500).trim();
    const credentialIssue = sekretEmailJestMaska(pass) ? 'masked_placeholder' : '';
    const provider = providerRaw || (host || user || pass ? (host === 'smtp.gmail.com' || user.endsWith('@gmail.com') ? 'gmail-smtp' : 'smtp') : '');
    const from = tekst(process.env.EMAIL_FROM || user || 'sklepartway@gmail.com', 200).trim();
    const fromName = tekst(process.env.EMAIL_FROM_NAME || 'Artway-TM', 120).trim();
    const replyTo = tekst(process.env.EMAIL_REPLY_TO || from, 200).trim();
    const adminTo = tekst(process.env.EMAIL_ADMIN_TO || process.env.EMAIL_TO || from, 200).trim();
    return {
      provider,
      configured: !!(provider && host && user && pass && from && !credentialIssue),
      credentialStored: !!pass,
      credentialIssue,
      host,
      port,
      secure,
      user,
      from,
      fromName,
      replyTo,
      adminTo,
      pass,
    };
  }
  function emailPublicConfig() {
    const c = emailKonfiguracja();
    return {
      configured: c.configured,
      credentialStored: c.credentialStored,
      credentialIssue: c.credentialIssue,
      authenticated: c.configured && smtpHealth.authenticated === true,
      lastCheckedAt: smtpHealth.checkedAt,
      lastError: smtpHealth.error,
      lastErrorCode: smtpHealth.code,
      persistent: true,
      provider: c.provider || 'gmail-smtp',
      from: c.from,
      fromName: c.fromName,
      adminTo: c.adminTo,
      requiredServerConfig: ['EMAIL_FROM', 'SMTP_USER', 'SMTP_PASS'],
    };
  }
  function adresNadawcyEmail(c = emailKonfiguracja()) {
    const nazwa = String(c.fromName || '').replace(/"/g, '').trim();
    return nazwa ? `"${nazwa}" <${c.from}>` : c.from;
  }
  function transporterSMTP(c = emailKonfiguracja()) {
    const fingerprint = [c.host, c.port, c.secure, c.user, c.pass].join('|');
    if (smtpTransporter && smtpFingerprint === fingerprint) return smtpTransporter;
    if (smtpTransporter && typeof smtpTransporter.close === 'function') smtpTransporter.close();
    smtpFingerprint = fingerprint;
    smtpTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 25_000,
      host: c.host,
      port: c.port,
      secure: c.secure,
      requireTLS: !c.secure,
      tls: { minVersion: 'TLSv1.2', servername: c.host },
      auth: { user: c.user, pass: c.pass },
    });
    return smtpTransporter;
  }
  
  async function sprawdzEmailSMTP({ force = false } = {}) {
    const c = emailKonfiguracja();
    if (!c.configured) {
      const issue = c.credentialIssue === 'masked_placeholder'
        ? { code: 'email_credential_masked', error: 'Na serwerze zapisano maskę zamiast prawdziwego hasła aplikacji Google.' }
        : { code: 'email_not_configured', error: 'Brakuje trwałej konfiguracji poczty na serwerze.' };
      smtpHealth = { authenticated: false, checkedAt: new Date().toISOString(), ...issue };
      const blad = new Error(issue.error); blad.code = issue.code; throw blad;
    }
    const freshness = smtpHealth.checkedAt ? Date.now() - Date.parse(smtpHealth.checkedAt) : Infinity;
    if (!force && smtpHealth.authenticated && freshness < 10 * 60 * 1000) return { ...emailPublicConfig(), authenticated: true };
    try {
      await transporterSMTP(c).verify();
      smtpHealth = { authenticated: true, checkedAt: new Date().toISOString(), error: '', code: '' };
      return { ...emailPublicConfig(), authenticated: true };
    } catch (error) {
      const safe = bezpiecznyBladEmail(error);
      smtpHealth = { authenticated: false, checkedAt: new Date().toISOString(), ...safe };
      const blad = new Error(safe.error); blad.code = safe.code; throw blad;
    }
  }
  
  async function wyslijEmailSMTP({ to, subject, text, html, replyTo, attachments = [] }) {
    const c = emailKonfiguracja();
    if (!c.configured) {
      const masked = c.credentialIssue === 'masked_placeholder';
      const blad = new Error(masked ? 'Na serwerze zapisano maskę zamiast prawidłowego hasła aplikacji Google.' : 'E-mail nie jest trwale skonfigurowany po stronie serwera.');
      blad.code = masked ? 'email_credential_masked' : 'email_not_configured';
      throw blad;
    }
    try {
      const transporter = transporterSMTP(c);
      const info = await transporter.sendMail({
        from: adresNadawcyEmail(c),
        envelope: { from: c.user, to },
        to,
        replyTo: replyTo || c.replyTo,
        subject,
        text,
        html,
        attachments: Array.isArray(attachments) ? attachments.slice(0, 5) : [],
      });
      smtpHealth = { authenticated: true, checkedAt: new Date().toISOString(), error: '', code: '' };
      return { provider: c.provider || 'smtp', message_id: info.messageId || '', accepted: info.accepted || [] };
    } catch (error) {
      const safe = bezpiecznyBladEmail(error);
      smtpHealth = { authenticated: false, checkedAt: new Date().toISOString(), ...safe };
      const blad = new Error(safe.error); blad.code = safe.code; throw blad;
    }
  }
  
  return { emailKonfiguracja, emailPublicConfig, sprawdzEmailSMTP, wyslijEmailSMTP };
}

