import { createEmailTransportService } from './email-transport-service.mjs';
import { tekst } from './core/http.mjs';
import { MAPA_STATUS_EMAIL, STATUS_EMAIL_CODALEJ, STATUS_EMAIL_META } from './domain/order-email-content.mjs';

export function createEmailService({ read, write }) {
  const czytaj = read;
  const zapisz = write;
  const { emailKonfiguracja, emailPublicConfig, sprawdzEmailSMTP, wyslijEmailSMTP } = createEmailTransportService();
  const OPLATA_PACZKA_WEEKEND = 5;
  function kwotaSerwer(v) {
    const n = Number(String(v ?? 0).replace(',', '.').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? +n.toFixed(2) : 0;
  }
  function zlSerwer(v) {
    return `${kwotaSerwer(v).toFixed(2).replace('.', ',')} zł`;
  }
  function htmlEscape(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function linkSklepuEmail(path = '/') {
    const base = tekst(process.env.EMAIL_SITE_URL || 'https://artwaytm.pl', 400).trim().replace(/\/+$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }
  function nazwaKlientaEmail(z) {
    const k = z?.klient || {};
    return [k.imie, k.nazwisko].map((x) => tekst(x, 80).trim()).filter(Boolean).join(' ') || tekst(z?.email, 160).trim() || 'Klient';
  }
  function adresDostawyEmail(z) {
    const a = z?.adresDostawy || {};
    if (a && (a.ulica || a.kod || a.miasto)) {
      const ulica = [a.ulica, a.nrDomu].map((x) => tekst(x, 120).trim()).filter(Boolean).join(' ');
      const lokal = a.nrLokalu ? `/${tekst(a.nrLokalu, 30).trim()}` : '';
      const miasto = [a.kod, a.miasto].map((x) => tekst(x, 120).trim()).filter(Boolean).join(' ');
      return [ulica ? `${ulica}${lokal}` : '', miasto].filter(Boolean).join(', ') || '—';
    }
    return tekst(z?.adres || '—', 500).trim() || '—';
  }
  function produktWariantEmail(p) {
    const wariant = p?.wariant;
    if (!wariant) return '';
    if (typeof wariant === 'string') return tekst(wariant, 120).trim();
    if (typeof wariant === 'object') return [wariant.nazwa, wariant.wartosc, wariant.label].map((x) => tekst(x, 80).trim()).filter(Boolean).join(': ');
    return '';
  }
  function produktyEmail(z) {
    if (Array.isArray(z?.pozycjeDane) && z.pozycjeDane.length) {
      return z.pozycjeDane.map((p) => {
        const ilosc = Number(p.ilosc) || 1;
        const cena = Number(p.cena) || 0;
        const wartosc = Number(p.wartosc) || (cena * ilosc);
        return {
          nazwa: tekst(p.nazwa || p.name || 'Produkt', 240).trim(),
          ilosc,
          cena,
          wartosc,
          sku: tekst(p.sku || p.SKU || '', 120).trim(),
          wariant: produktWariantEmail(p),
        };
      });
    }
    if (Array.isArray(z?.pozycje) && z.pozycje.length) {
      return z.pozycje.map((p) => ({ nazwa: tekst(p, 500).trim(), ilosc: 1, cena: 0, wartosc: 0, sku: '', wariant: '' }));
    }
    return [{ nazwa: 'Pozycje zamówienia zapisane w panelu sklepu', ilosc: 1, cena: 0, wartosc: 0, sku: '', wariant: '' }];
  }
  function linieProduktow(z) {
    return produktyEmail(z).map((p) => {
      const meta = [p.sku ? `SKU: ${p.sku}` : '', p.wariant].filter(Boolean).join(', ');
      const kwota = p.wartosc ? ` — ${zlSerwer(p.wartosc)}` : '';
      return `• ${p.nazwa}${meta ? ` (${meta})` : ''} × ${p.ilosc}${kwota}`;
    }).join('\n');
  }
  function htmlProduktyEmail(z) {
    const rows = produktyEmail(z).map((p) => {
      const meta = [p.sku ? `SKU: ${p.sku}` : '', p.wariant].filter(Boolean).join(' • ');
      return `<tr>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb">
          <div style="font-weight:800;color:#111827">${htmlEscape(p.nazwa)}</div>
          ${meta ? `<div style="font-size:12px;color:#6b7280;margin-top:3px">${htmlEscape(meta)}</div>` : ''}
        </td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151">${htmlEscape(p.ilosc)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800;color:#111827">${p.wartosc ? htmlEscape(zlSerwer(p.wartosc)) : '—'}</td>
      </tr>`;
    }).join('');
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff">
      <thead>
        <tr style="background:#f8fafc;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">
          <th align="left" style="padding:10px">Produkt</th>
          <th align="center" style="padding:10px;width:70px">Ilość</th>
          <th align="right" style="padding:10px;width:120px">Wartość</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
  function kosztyEmail(z) {
    const k = z?.koszty || {};
    const ma = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key) && obj[key] != null;
    const produktyZPozycji = produktyEmail(z).reduce((s, p) => s + kwotaSerwer(p.wartosc), 0);
    const weekendAktywny = !!(z?.paczkaWeekend || z?.wysylka?.paczkaWeekend);
    const weekend = kwotaSerwer(ma(z, 'oplataPaczkaWeekend') ? z.oplataPaczkaWeekend : (ma(k, 'paczkaWeekend') ? k.paczkaWeekend : (weekendAktywny ? OPLATA_PACZKA_WEEKEND : 0)));
    const platnosc = kwotaSerwer(ma(z, 'oplataPlatnosci') ? z.oplataPlatnosci : (ma(k, 'platnosc') ? k.platnosc : (z?.platnoscId === 'pobranie' ? 5 : 0)));
    const metoda = tekst(z?.dostawaId || '', 40).trim().toLowerCase();
    const poRabacieZapisane = ma(k, 'poRabacie') ? kwotaSerwer(k.poRabacie) : 0;
    const kosztDomyslny = metoda === 'kurier' || metoda === 'kurier_inpost' ? 20 : 12;
    const dostawa = ma(z, 'dostawaKoszt') || ma(k, 'dostawa')
      ? kwotaSerwer(ma(z, 'dostawaKoszt') ? z.dostawaKoszt : k.dostawa)
      : ((poRabacieZapisane || produktyZPozycji) >= 200 ? 0 : kosztDomyslny);
    const razemZapisane = kwotaSerwer(z?.razem);
    let poRabacie = poRabacieZapisane || (razemZapisane ? Math.max(0, kwotaSerwer(razemZapisane - dostawa - weekend - platnosc)) : 0);
    const produkty = ma(k, 'produkty') ? kwotaSerwer(k.produkty) : (produktyZPozycji || poRabacie);
    const rabat = ma(k, 'rabat') ? kwotaSerwer(k.rabat) : Math.max(0, kwotaSerwer(produkty - poRabacie));
    if (!poRabacie) poRabacie = Math.max(0, kwotaSerwer(produkty - rabat));
    const razem = razemZapisane || kwotaSerwer(poRabacie + dostawa + weekend + platnosc);
    return { produkty, rabat, poRabacie, dostawa, paczkaWeekend: weekend, platnosc, razem };
  }
  function podsumowanieKosztowEmailText(z) {
    const c = kosztyEmail(z);
    return [
      `Produkty: ${zlSerwer(c.produkty || c.poRabacie)}`,
      z?.rabatKod ? `Kod promocyjny: ${tekst(z.rabatKod, 30)}${z?.rabatTyp === 'darmowa_dostawa' ? ' — darmowa dostawa' : ''}` : '',
      c.rabat ? `Rabat: -${zlSerwer(c.rabat)}` : '',
      `Dostawa: ${c.dostawa ? zlSerwer(c.dostawa) : 'GRATIS'} (${z?.dostawa || '—'})`,
      c.paczkaWeekend ? `Paczka w Weekend: ${zlSerwer(c.paczkaWeekend)}` : '',
      c.platnosc ? `Opłata płatności / pobrania: ${zlSerwer(c.platnosc)}` : '',
      `Razem do zapłaty: ${zlSerwer(c.razem)}`,
    ].filter(Boolean).join('\n');
  }
  function podsumowanieKosztowEmailHtml(z) {
    const c = kosztyEmail(z);
    const row = (a, b, strong = false) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid #eef2f7${strong ? ';font-weight:900;font-size:17px;color:#111827' : ''}"><span>${htmlEscape(a)}</span><span>${htmlEscape(b)}</span></div>`;
    return [
      c.produkty ? row('Produkty', zlSerwer(c.produkty)) : '',
      z?.rabatKod ? row('Kod promocyjny', `${tekst(z.rabatKod, 30)}${z?.rabatTyp === 'darmowa_dostawa' ? ' — darmowa dostawa' : ''}`) : '',
      c.rabat ? row('Rabat', `-${zlSerwer(c.rabat)}`) : '',
      c.rabat ? row('Po rabacie', zlSerwer(c.poRabacie)) : '',
      row('Dostawa', c.dostawa ? zlSerwer(c.dostawa) : 'GRATIS'),
      c.paczkaWeekend ? row('Paczka w Weekend', zlSerwer(c.paczkaWeekend)) : '',
      c.platnosc ? row('Opłata płatności / pobrania', zlSerwer(c.platnosc)) : '',
      row('Razem do zapłaty', zlSerwer(c.razem), true),
    ].filter(Boolean).join('');
  }
  function instrukcjaPlatnosciEmail(z) {
    const metoda = tekst(z?.platnosc || '—', 180).trim();
    const kwota = zlSerwer(z?.razem);
    if (z?.platnoscId === 'paynow') {
      const url = tekst(z?.paynow?.redirectUrl || '', 1000).trim();
      return {
        tytul: 'Dokończ bezpieczną płatność online',
        opis: url
          ? `Kliknij przycisk i opłać zamówienie przez mBank Paynow. Po potwierdzeniu płatności od razu przejdziemy do realizacji.`
          : `Wybrano mBank Paynow. Jeśli link płatności nie jest jeszcze widoczny, status sprawdzisz w sekcji „Moje zamówienia”.`,
        akcja: url ? 'Zapłać przez mBank Paynow' : 'Sprawdź zamówienie',
        url: url || linkSklepuEmail('/#/zamowienia'),
        meta: `Kwota do zapłaty: ${kwota}`,
      };
    }
    if (z?.platnoscId === 'telefon') {
      return {
        tytul: 'Przelew na telefon',
        opis: z?.platnoscInstrukcja || `Wyślij ${kwota} na numer 530 038 914. W tytule lub wiadomości wpisz: Zamówienie ${z.nr}.`,
        akcja: 'Zobacz szczegóły zamówienia',
        url: linkSklepuEmail('/#/zamowienia'),
        meta: `Kwota do zapłaty: ${kwota}`,
      };
    }
    if (z?.platnoscId === 'pobranie') {
      return {
        tytul: 'Płatność przy odbiorze',
        opis: 'Zapłacisz przy odbiorze przesyłki InPost. Przygotujemy paczkę i wyślemy kolejne informacje po nadaniu przesyłki.',
        akcja: 'Zobacz szczegóły zamówienia',
        url: linkSklepuEmail('/#/zamowienia'),
        meta: `Kwota do zapłaty: ${kwota}`,
      };
    }
    return {
      tytul: 'Płatność',
      opis: z?.platnoscInstrukcja || `Wybrana metoda płatności: ${metoda}.`,
      akcja: 'Zobacz szczegóły zamówienia',
      url: linkSklepuEmail('/#/zamowienia'),
      meta: `Kwota do zapłaty: ${kwota}`,
    };
  }
  function emailButton(label, url, kolor = '#2563eb') {
    return `<a href="${htmlEscape(url)}" style="display:inline-block;background:${kolor};color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 20px;margin:4px 8px 4px 0">${htmlEscape(label)}</a>`;
  }
  function htmlKartaEmail(tytul, body, accent = '#2563eb') {
    return `<div style="border:1px solid #e5e7eb;border-left:5px solid ${accent};border-radius:16px;background:#ffffff;padding:16px;margin:14px 0">
      <div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:800;margin-bottom:6px">${htmlEscape(tytul)}</div>
      <div style="color:#111827;font-size:15px">${body}</div>
    </div>`;
  }
  function htmlLayoutEmail({ preheader, badge, title, intro, z, mainCta, extraCta = [], admin = false, topCard = '', platnoscKartaHtml = '', coDalejTytul = '', coDalejTekst = '', stopkaTekst = '' }) {
    const payment = instrukcjaPlatnosciEmail(z);
    const sklepUrl = linkSklepuEmail('/#/');
    const kontoUrl = linkSklepuEmail('/#/zamowienia');
    const adminUrl = linkSklepuEmail(`/#/admin/zamowienie/${encodeURIComponent(z?.nr || '')}`);
    const k = z?.klient || {};
    const telefon = tekst(k.telefon || '', 80).trim();
    const email = tekst(z?.email || '', 200).trim();
    const koszty = kosztyEmail(z);
    const shippingBody = `${htmlEscape(z?.dostawa || '—')}<br><span style="color:#6b7280">${htmlEscape(adresDostawyEmail(z))}</span>${z?.paczkomat ? `<br><span style="color:#6b7280">Punkt odbioru: ${htmlEscape(z.paczkomat)}</span>` : ''}<br><span style="display:inline-block;margin-top:8px;font-weight:800">Koszt dostawy: ${htmlEscape(koszty.dostawa ? zlSerwer(koszty.dostawa) : 'GRATIS')}</span>${koszty.paczkaWeekend ? `<br><span style="color:#92400e;font-weight:800">Paczka w Weekend: +${htmlEscape(zlSerwer(koszty.paczkaWeekend))}</span>` : ''}`;
    const paymentBody = platnoscKartaHtml || `<b>${htmlEscape(payment.tytul)}</b><br><span style="color:#374151">${htmlEscape(payment.opis)}</span><br><span style="display:inline-block;margin-top:8px;color:#111827;font-weight:800">${htmlEscape(payment.meta)}</span>`;
    const cta = mainCta || { label: payment.akcja, url: payment.url };
    const ctaHtml = [cta, ...extraCta].filter(Boolean).map((x, i) => emailButton(x.label, x.url, i === 0 ? '#2563eb' : '#111827')).join('');
    return `<!doctype html>
    <html lang="pl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${htmlEscape(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#111827">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${htmlEscape(preheader || title)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:26px 10px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 55px rgba(37,99,235,.14)">
              <tr>
                <td style="background:linear-gradient(135deg,#2563eb,#6d28d9);padding:28px 28px 24px;color:#ffffff">
                  <div style="font-size:13px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;opacity:.9">${htmlEscape(badge || 'Artway-TM')}</div>
                  <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.18">${htmlEscape(title)}</h1>
                  <p style="margin:0;font-size:16px;line-height:1.55;opacity:.96">${htmlEscape(intro)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:26px 28px">
                  <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:18px;padding:14px 16px;margin-bottom:16px;color:#78350f">
                    <b>Numer zamówienia:</b> ${htmlEscape(z?.nr || '—')} &nbsp; • &nbsp; <b>Razem:</b> ${htmlEscape(zlSerwer(z?.razem))}
                  </div>
                  ${topCard}
                  ${admin ? htmlKartaEmail('Klient', `<b>${htmlEscape(nazwaKlientaEmail(z))}</b>${email ? `<br>${htmlEscape(email)}` : ''}${telefon ? `<br>${htmlEscape(telefon)}` : ''}`, '#7c3aed') : ''}
                  ${htmlKartaEmail('Płatność', paymentBody, '#f59e0b')}
                  ${htmlKartaEmail('Dostawa', shippingBody, '#10b981')}
                  <h2 style="font-size:18px;margin:22px 0 10px;color:#111827">Produkty w zamówieniu</h2>
                  ${htmlProduktyEmail(z)}
                  ${htmlKartaEmail('Podsumowanie kosztów', podsumowanieKosztowEmailHtml(z), '#2563eb')}
                  <div style="text-align:right;margin:14px 0 22px;font-size:20px;font-weight:900;color:#111827">Do zapłaty: ${htmlEscape(zlSerwer(koszty.razem))}</div>
                  ${z?.uwagi ? htmlKartaEmail('Uwagi do zamówienia', htmlEscape(z.uwagi), '#64748b') : ''}
                  <div style="background:#f8fafc;border-radius:18px;padding:18px;margin:20px 0">
                    <h3 style="margin:0 0 8px;font-size:17px;color:#111827">${htmlEscape(coDalejTytul || (admin ? 'Co dalej w obsłudze?' : 'Co dalej?'))}</h3>
                    <p style="margin:0;color:#374151;line-height:1.6">${coDalejTekst ? htmlEscape(coDalejTekst) : (admin
                      ? 'Sprawdź płatność, przygotuj paczkę, wygeneruj etykietę i aktualizuj status zamówienia. Klient dostanie kolejne informacje automatycznie.'
                      : 'Przyjęliśmy zamówienie. Będziemy informować o kolejnych etapach realizacji. Szczegóły są zawsze dostępne w sekcji „Moje zamówienia”.')}</p>
                  </div>
                  <div style="margin:22px 0 8px">${ctaHtml}${admin ? emailButton('Otwórz zamówienie w panelu', adminUrl, '#111827') : emailButton('Wróć do sklepu', sklepUrl, '#111827')}</div>
                  ${!admin ? `<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:18px 0 0">${htmlEscape(stopkaTekst || 'Dziękujemy za zaufanie. Życzymy dobrego dnia i udanych zakupów w Artway-TM.')}</p>` : ''}
                </td>
              </tr>
              <tr>
                <td style="background:#111827;color:#d1d5db;padding:20px 28px;font-size:13px;line-height:1.55">
                  <b style="color:#ffffff">Artway-TM</b><br>
                  Sklep internetowy • ${htmlEscape(linkSklepuEmail('/#/'))}<br>
                  ${admin ? 'To powiadomienie dla administratora sklepu.' : `Status zamówienia: ${htmlEscape(kontoUrl)}`}<br>
                  Wiadomość wysłana automatycznie — odpowiedź trafi do obsługi sklepu.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
  }
  function wiadomoscKlientaZamowienie(z) {
    const imie = tekst(z?.klient?.imie, 80).trim();
    const paynow = z?.paynow?.redirectUrl ? `\n\nLink do płatności Paynow:\n${z.paynow.redirectUrl}` : '';
    const telefon = z?.platnoscId === 'telefon' ? '\n\nPrzy przelewie na telefon wpisz w tytule/wiadomości numer zamówienia.' : '';
    const body = `Dzień dobry${imie ? `, ${imie}` : ''},
  
  dziękujemy za złożenie zamówienia ${z.nr}.
  
  Produkty:
  ${linieProduktow(z)}
  
  ${podsumowanieKosztowEmailText(z)}
  Płatność: ${z.platnosc || '—'}${paynow}${telefon}
  
  Status i szczegóły zamówienia sprawdzisz na stronie sklepu w sekcji „Moje zamówienia”.
  Pozdrawiamy
  Artway-TM`;
    return {
      subject: `Dziękujemy za zamówienie ${z.nr} — Artway-TM`,
      text: body,
      html: htmlLayoutEmail({
        preheader: `Przyjęliśmy zamówienie ${z.nr}. Sprawdź podsumowanie, płatność i dostawę.`,
        badge: 'Dziękujemy za zakupy',
        title: `Zamówienie ${z.nr} przyjęte`,
        intro: `Dziękujemy${imie ? `, ${imie}` : ''}! Twoje zamówienie jest już zapisane. Poniżej znajdziesz najważniejsze informacje i następny krok.`,
        z,
        extraCta: [{ label: 'Moje zamówienia', url: linkSklepuEmail('/#/zamowienia') }],
      }),
    };
  }
  function wiadomoscAdminZamowienie(z) {
    const k = z?.klient || {};
    const body = `Nowe zamówienie ${z.nr}
  
  Klient: ${[k.imie, k.nazwisko].filter(Boolean).join(' ') || z.email || 'gość'}
  E-mail: ${z.email || 'brak'}
  Telefon: ${k.telefon || 'brak'}
  Adres: ${z.adres || '—'}
  
  Produkty:
  ${linieProduktow(z)}
  
  ${podsumowanieKosztowEmailText(z)}
  Płatność: ${z.platnosc || '—'}
  Status płatności: ${z.platnoscStatus || z?.paynow?.status || '—'}
  
  Uwagi: ${z.uwagi || 'brak'}`;
    return {
      subject: `Nowe zamówienie ${z.nr} — ${zlSerwer(z.razem)}`,
      text: body,
      html: htmlLayoutEmail({
        preheader: `Nowe zamówienie ${z.nr} na kwotę ${zlSerwer(z.razem)} czeka na obsługę.`,
        badge: 'Panel administratora',
        title: `Nowe zamówienie ${z.nr}`,
        intro: `W sklepie pojawiło się nowe zamówienie. Sprawdź płatność, przygotuj wysyłkę i prowadź klienta przez kolejne etapy.`,
        z,
        admin: true,
        mainCta: { label: 'Otwórz panel zamówień', url: linkSklepuEmail('/#/admin/zamowienia') },
      }),
    };
  }
  async function dopiszHistorieEmaila(nr, wpis) {
    const rec = await czytaj('orders', { items: [] });
    const items = Array.isArray(rec.items) ? rec.items : [];
    const i = items.findIndex((z) => z.nr === nr);
    if (i < 0) return;
    const z = { ...items[i] };
    const w = z.wysylka || {};
    w.powiadomienia = [...(Array.isArray(w.powiadomienia) ? w.powiadomienia : []), {
      czas: new Date().toLocaleString('pl-PL'),
      ...wpis,
    }];
    z.wysylka = w;
    items[i] = z;
    await zapisz('orders', { items, updated_at: new Date().toISOString() });
  }
  function emailJuzWyslany(z, typ) {
    const historia = Array.isArray(z?.wysylka?.powiadomienia) ? z.wysylka.powiadomienia : [];
    return historia.some((p) => p && p.typ === typ && p.status === 'wysłano');
  }
  async function wyslijEmaileNowegoZamowienia(z, { includeAdmin = true } = {}) {
    const c = emailKonfiguracja();
    if (!c.configured) return { configured: false, sent: false, error: 'email_not_configured' };
    const wyniki = [], errors = [];
    if (z.email && !emailJuzWyslany(z, 'potwierdzenie')) {
      const msg = wiadomoscKlientaZamowienie(z);
      try {
        const r = await wyslijEmailSMTP({ to: z.email, ...msg });
        wyniki.push({ to: 'customer', ...r });
        await dopiszHistorieEmaila(z.nr, { typ: 'potwierdzenie', status: 'wysłano', provider: r.provider, id: r.message_id, automatyczne: true });
      } catch (e) {
        errors.push({ to: 'customer', error: e.message });
        await dopiszHistorieEmaila(z.nr, { typ: 'potwierdzenie', status: 'błąd wysyłki', blad: e.message, automatyczne: true });
      }
    }
    if (includeAdmin && c.adminTo && !emailJuzWyslany(z, 'admin_nowe')) {
      const msg = wiadomoscAdminZamowienie(z);
      try {
        const r = await wyslijEmailSMTP({ to: c.adminTo, ...msg });
        wyniki.push({ to: 'admin', ...r });
        await dopiszHistorieEmaila(z.nr, { typ: 'admin_nowe', status: 'wysłano', provider: r.provider, id: r.message_id, automatyczne: true });
      } catch (e) {
        errors.push({ to: 'admin', error: e.message });
        await dopiszHistorieEmaila(z.nr, { typ: 'admin_nowe', status: 'błąd wysyłki', blad: e.message, automatyczne: true });
      }
    }
    return { configured: true, sent: wyniki.length > 0, results: wyniki, errors };
  }
  
  function nazwaPrzewoznikaEmail(id) {
    return ({ inpost: 'InPost', dpd: 'DPD', dhl: 'DHL', orlen: 'ORLEN Paczka', gls: 'GLS', ups: 'UPS', pocztex: 'Pocztex', inny: 'przewoźnika' })[id] || 'przewoźnika';
  }
  function linkSledzeniaEmail(z) {
    const w = z?.wysylka || {};
    const wlasny = String(w.trackingUrl || '').trim();
    if (/^https?:\/\//i.test(wlasny)) return wlasny;
    const numer = String(w.numer || '').trim();
    if (!numer) return '';
    const mapa = {
      inpost: `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(numer)}`,
      dpd: `https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(numer)}`,
      dhl: `https://www.dhl.com/pl-pl/home/tracking.html?tracking-id=${encodeURIComponent(numer)}`,
      gls: `https://gls-group.com/PL/pl/sledzenie-paczek/?match=${encodeURIComponent(numer)}`,
      ups: `https://www.ups.com/track?loc=pl_PL&tracknum=${encodeURIComponent(numer)}`,
    };
    return mapa[w.przewoznik] || '';
  }
  function htmlStatusEmail(z, typ, opcje = {}) {
    const meta = STATUS_EMAIL_META[typ] || STATUS_EMAIL_META.przygotowanie;
    const imie = tekst(z?.klient?.imie, 80).trim();
    const w = z?.wysylka || {};
    const numer = tekst(w.numer, 120).trim();
    const sledzenie = linkSledzeniaEmail(z);
    const zamUrl = linkSklepuEmail('/#/zamowienia');
    const platnoscStatus = tekst(z?.platnoscStatus, 80).trim();
    // Karta statusu (kolor zależny od etapu) — na górze, tuż pod numerem zamówienia
    const statusCard = htmlKartaEmail(meta.badge, `<b>${htmlEscape(meta.title)}</b><br><span style="color:#374151">${htmlEscape(meta.opis)}</span>`, meta.accent);
    const kartaZwrot = typ === 'zwrot_pieniedzy'
      ? htmlKartaEmail('Zwrot środków', `Kwota zwrotu: <b>${htmlEscape(opcje.kwota != null ? zlSerwer(opcje.kwota) : zlSerwer(z?.razem))}</b><br><span style="color:#374151">Zwrot realizujemy tą samą metodą, którą opłacono zamówienie.</span>`, '#0ea5e9')
      : '';
    const kartaTracking = (typ === 'nadanie' || typ === 'problem') && (numer || sledzenie)
      ? htmlKartaEmail('Śledzenie przesyłki', `${w.przewoznik ? `Przewoźnik: <b>${htmlEscape(nazwaPrzewoznikaEmail(w.przewoznik))}</b><br>` : ''}${numer ? `Numer przesyłki: <b>${htmlEscape(numer)}</b><br>` : ''}${sledzenie ? `Link: <a href="${htmlEscape(sledzenie)}" style="color:#2563eb;font-weight:800">${htmlEscape(sledzenie)}</a>` : ''}`, '#059669')
      : '';
    const topCard = `${statusCard}${kartaZwrot}${kartaTracking}`;
    // Neutralna karta płatności (bez „dokończ płatność”) — metoda, status i kwota
    const platnoscKartaHtml = `<b>${htmlEscape(z?.platnosc || '—')}</b>${platnoscStatus ? `<br><span style="color:#374151">Status płatności: ${htmlEscape(platnoscStatus)}</span>` : ''}<br><span style="display:inline-block;margin-top:8px;color:#111827;font-weight:800">Kwota: ${htmlEscape(zlSerwer(kosztyEmail(z).razem))}</span>`;
    const mainCta = typ === 'nadanie' && sledzenie ? { label: 'Śledź przesyłkę', url: sledzenie } : { label: 'Moje zamówienia', url: zamUrl };
    const extraCta = typ === 'nadanie' && sledzenie ? [{ label: 'Moje zamówienia', url: zamUrl }] : [];
    const [cdT, cdX] = STATUS_EMAIL_CODALEJ[typ] || STATUS_EMAIL_CODALEJ.przygotowanie;
    return htmlLayoutEmail({
      preheader: meta.opis,
      badge: meta.badge,
      title: meta.title,
      intro: `Dzień dobry${imie ? `, ${imie}` : ''}! Poniżej najważniejsze informacje o Twoim zamówieniu ${z?.nr || ''}.`,
      z,
      mainCta,
      extraCta,
      topCard,
      platnoscKartaHtml,
      coDalejTytul: cdT,
      coDalejTekst: cdX,
      stopkaTekst: 'Dziękujemy za zaufanie. Ta wiadomość dotyczy wyłącznie realizacji Twojego zamówienia.',
    });
  }
  function wiadomoscStatusowa(z, typ, opcje = {}) {
    const meta = STATUS_EMAIL_META[typ] || STATUS_EMAIL_META.przygotowanie;
    const imie = tekst(z?.klient?.imie, 80).trim();
    const w = z?.wysylka || {};
    const numer = tekst(w.numer, 120).trim();
    const sledzenie = linkSledzeniaEmail(z);
    const powitanie = `Dzień dobry${imie ? `, ${imie}` : ''},`;
    let tresc = '';
    if (typ === 'nadanie') tresc = `przesyłka dla zamówienia ${z.nr} została nadana przez ${nazwaPrzewoznikaEmail(w.przewoznik)}.${numer ? `\nNumer przesyłki: ${numer}` : ''}${sledzenie ? `\nŚledzenie: ${sledzenie}` : ''}`;
    else if (typ === 'przygotowanie') tresc = `Twoje zamówienie ${z.nr} jest obecnie przygotowywane do wysyłki. Damy znać, gdy paczka trafi do przewoźnika.`;
    else if (typ === 'dostarczenie') tresc = `przesyłka dla zamówienia ${z.nr} została oznaczona jako dostarczona. Dziękujemy za zakupy!`;
    else if (typ === 'anulowanie') tresc = `zamówienie ${z.nr} zostało anulowane. Jeśli to pomyłka lub masz pytania, odpowiedz na tę wiadomość.`;
    else if (typ === 'zwrot') tresc = `przesyłka dla zamówienia ${z.nr} została oznaczona jako zwrot do nadawcy. Skontaktujemy się w sprawie dalszych kroków.`;
    else if (typ === 'zwrot_pieniedzy') tresc = `zwróciliśmy pieniądze za zamówienie ${z.nr}.\nKwota zwrotu: ${opcje.kwota != null ? zlSerwer(opcje.kwota) : zlSerwer(z.razem)}\nŚrodki wrócą na Twoje konto w ciągu kilku dni roboczych, zależnie od banku.`;
    else if (typ === 'problem') tresc = `przewoźnik zgłosił problem dotyczący przesyłki dla zamówienia ${z.nr}. Monitorujemy sytuację i przekażemy kolejną informację po jej wyjaśnieniu.${numer ? `\nNumer przesyłki: ${numer}` : ''}${sledzenie ? `\nŚledzenie: ${sledzenie}` : ''}`;
    else if (typ === 'dostepnosc_potwierdzona') tresc = `potwierdziliśmy dostępność wszystkich sztuk w zamówieniu ${z.nr}. Zamówienie może przejść do przygotowania i wysyłki.`;
    const body = `${powitanie}\n\n${tresc}\n\n${podsumowanieKosztowEmailText(z)}\n\nSzczegóły sprawdzisz w sekcji „Moje zamówienia”.\n\nPozdrawiamy\nArtway-TM\n${linkSklepuEmail('/#/')}`;
    return { subject: meta.subject(z.nr), text: body, html: htmlStatusEmail(z, typ, opcje) };
  }
  async function wyslijEmailStatusowy(z, typ, opcje = {}) {
    const c = emailKonfiguracja();
    if (!c.configured) return { configured: false, sent: false, error: 'email_not_configured' };
    if (!z?.email) return { configured: true, sent: false, error: 'no_email' };
    const msg = wiadomoscStatusowa(z, typ, opcje);
    try {
      const r = await wyslijEmailSMTP({ to: z.email, ...msg });
      await dopiszHistorieEmaila(z.nr, { typ, status: 'wysłano', provider: r.provider, id: r.message_id, automatyczne: true });
      return { configured: true, sent: true, provider: r.provider, id: r.message_id };
    } catch (e) {
      await dopiszHistorieEmaila(z.nr, { typ, status: 'błąd wysyłki', blad: e.message, automatyczne: true });
      return { configured: true, sent: false, error: e.message };
    }
  }
  function polaczPowiadomienia(serwerowe, przychodzace) {
    const a = Array.isArray(serwerowe) ? serwerowe : [];
    const b = Array.isArray(przychodzace) ? przychodzace : [];
    const klucz = (p) => `${p?.typ || ''}|${p?.status || ''}|${p?.czas || ''}|${p?.id || ''}`;
    const widziane = new Set(b.map(klucz));
    const dodatkowe = a.filter((p) => !widziane.has(klucz(p)));
    return [...b, ...dodatkowe];
  }
  async function obsluzEmailePrzejsciaStatusu(stary, nowy) {
    if (!nowy?.nr) return { sent: false };
    const typy = [];
    const numerNowy = tekst(nowy?.wysylka?.numer, 120).trim();
    const numerStary = tekst(stary?.wysylka?.numer, 120).trim();
    if (numerNowy && numerNowy !== numerStary) typy.push('nadanie');
    const bladNowy = tekst(nowy?.wysylka?.bladIntegracji, 300).trim();
    const bladStary = tekst(stary?.wysylka?.bladIntegracji, 300).trim();
    if (bladNowy && bladNowy !== bladStary) typy.push('problem');
    const decyzjaDostepnosciNowa = tekst(nowy?.decyzjaDostepnosci?.code, 80).trim().toLowerCase();
    if (stary?.wymagaPotwierdzeniaDostepnosci === true && nowy?.wymagaPotwierdzeniaDostepnosci !== true && decyzjaDostepnosciNowa === 'confirmed') typy.push('dostepnosc_potwierdzona');
    if ((stary?.status || '') !== (nowy?.status || '')) {
      const t = MAPA_STATUS_EMAIL[nowy.status];
      if (t && !typy.includes(t) && !(t === 'przygotowanie' && typy.includes('nadanie'))) typy.push(t);
    }
    if (!typy.length) return { sent: false };
    const c = emailKonfiguracja();
    if (!c.configured) return { sent: false, configured: false, typy };
    // aktualny stan zamówienia z bazy (autorytatywna historia do deduplikacji)
    const rec = await czytaj('orders', { items: [] });
    let zapisany = (rec.items || []).find((x) => x.nr === nowy.nr) || nowy;
    const wyniki = [];
    for (const typ of typy) {
      if (emailJuzWyslany(zapisany, typ)) continue;
      const r = await wyslijEmailStatusowy(zapisany, typ);
      wyniki.push({ typ, ...r });
      const rec2 = await czytaj('orders', { items: [] });
      zapisany = (rec2.items || []).find((x) => x.nr === nowy.nr) || zapisany;
    }
    return { sent: wyniki.some((x) => x.sent), configured: true, wyniki, powiadomienia: zapisany?.wysylka?.powiadomienia || [] };
  }
  

  return {
    emailKonfiguracja,
    emailPublicConfig,
    sprawdzEmailSMTP,
    wyslijEmailSMTP,
    kwotaSerwer,
    zlSerwer,
    htmlEscape,
    wiadomoscKlientaZamowienie,
    dopiszHistorieEmaila,
    wyslijEmaileNowegoZamowienia,
    wyslijEmailStatusowy,
    polaczPowiadomienia,
    obsluzEmailePrzejsciaStatusu,
  };
}
