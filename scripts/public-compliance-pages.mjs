import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STORE_LEGAL = Object.freeze({
  name: 'ARTWAY-TM SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  shortName: 'Artway-TM',
  nip: '5882468333',
  regon: '388782967',
  street: 'Gryfa Pomorskiego 1/A',
  postalCode: '84-207',
  city: 'Bojano',
  email: 'artwaytm@gmail.com',
  phone: '+48 530 038 914',
});

const seller = `<address><strong>${STORE_LEGAL.name}</strong><br>${STORE_LEGAL.street}, ${STORE_LEGAL.postalCode} ${STORE_LEGAL.city}<br>NIP: ${STORE_LEGAL.nip} • REGON: ${STORE_LEGAL.regon}<br><a href="mailto:${STORE_LEGAL.email}">${STORE_LEGAL.email}</a> • <a href="tel:+48530038914">${STORE_LEGAL.phone}</a></address>`;
const nav = `<nav class="seo-legal-nav" aria-label="Informacje dla kupujących"><a href="/kontakt/">Dane firmy i kontakt</a><a href="/regulamin/">Regulamin</a><a href="/prywatnosc/">Prywatność</a><a href="/dostawa/">Dostawa i płatności</a><a href="/zwroty/">Zwroty i reklamacje</a></nav>`;

export const PUBLIC_COMPLIANCE_PAGES = Object.freeze([
  {
    route: 'kontakt',
    title: 'Dane firmy i kontakt | Artway-TM',
    description: 'Pełne dane sprzedawcy Artway-TM, adres siedziby, NIP, REGON, e-mail i telefon do obsługi kupujących.',
    heading: 'Dane sprzedawcy i kontakt',
    body: `${seller}<h2>Obsługa kupujących</h2><p>W sprawach produktów, zamówień, płatności, dostawy, zwrotów i reklamacji napisz na <a href="mailto:${STORE_LEGAL.email}">${STORE_LEGAL.email}</a> lub zadzwoń pod numer <a href="tel:+48530038914">${STORE_LEGAL.phone}</a>. Obsługa odpowiada w dni robocze, standardowo w godzinach 9:00–17:00.</p><h2>Zakupy w sklepie</h2><p>Produkty można dodać do koszyka, wybrać sposób dostawy i płatności, sprawdzić pełną kwotę w PLN oraz złożyć zamówienie przyciskiem „Zamówienie z obowiązkiem zapłaty”.</p>`,
  },
  {
    route: 'regulamin',
    title: 'Regulamin sklepu | Artway-TM',
    description: 'Regulamin sprzedaży internetowej Artway-TM: zamówienia, ceny, płatności, dostawa, odstąpienie od umowy i reklamacje.',
    heading: 'Regulamin sklepu internetowego Artway-TM',
    body: `<p><strong>Obowiązuje od 21 lipca 2026 r.</strong></p><h2>1. Sprzedawca i kontakt</h2>${seller}<p>Regulamin określa zasady sprzedaży towarów fizycznych na odległość. Sklep nie sprzedaje usług cyfrowych, licencji ani usług wymagających od kupującego osobnej aktywacji.</p><h2>2. Zamówienie i zawarcie umowy</h2><p>Kupujący wybiera produkt i ilość, dodaje je do koszyka, podaje dane, wybiera dostawę oraz płatność, zapoznaje się z regulaminem i składa zamówienie przyciskiem „Zamówienie z obowiązkiem zapłaty”. Przed wysłaniem formularza może poprawić dane i zawartość koszyka. Umowa zostaje zawarta po potwierdzeniu przyjęcia zamówienia przez Sprzedawcę na podany adres e-mail.</p><h2>3. Produkty, ceny i waluta</h2><p>Opis, zdjęcia, dostępność i cena znajdują się na karcie każdego produktu. Wszystkie ceny i koszty są podawane w złotych polskich (<strong>PLN</strong>) jako ceny brutto. Przed złożeniem zamówienia koszyk pokazuje cenę produktów, rabaty, koszt dostawy, usługi dodatkowe, opłatę za wybraną płatność oraz łączną kwotę do zapłaty. Na żądanie i po podaniu prawidłowych danych wystawiana jest faktura.</p><h2>4. Płatności</h2><p>Aktualnie dostępne metody są zawsze pokazane w formularzu zamówienia przed jego wysłaniem. Sklep może udostępniać płatność przy odbiorze, przelew na telefon oraz płatność online Paynow. Podmiotem świadczącym obsługę płatności online jest <strong>mElements S.A.</strong> W zakresie płatności kartami podmiotem świadczącym obsługę płatności online jest <strong>Autopay S.A.</strong> W bramce mogą być dostępne karty Visa, Visa Electron, Mastercard, MasterCard Electronic i Maestro, BLIK oraz szybki przelew. Czas realizacji zamówienia opłacanego online liczy się od uzyskania pozytywnej autoryzacji płatności.</p><h2>5. Dostawa i realizacja</h2><p>Sprzedaż i dostawa są realizowane na terytorium Polski. Dostawę wykonuje InPost do automatu Paczkomat®/PaczkoPunktu albo kurierem pod wskazany adres. Aktualne koszty, termin nadania i usługi dodatkowe opisuje strona <a href="/dostawa/">Dostawa i płatności</a> oraz podsumowanie koszyka.</p><h2>6. Odstąpienie i zwrot</h2><p>Konsument może odstąpić od umowy bez podania przyczyny w ciągu 14 dni od objęcia towaru w posiadanie. Wystarczy wysłać jednoznaczne oświadczenie przed upływem terminu. Towar należy odesłać nie później niż w ciągu kolejnych 14 dni. Bezpośredni koszt zwykłego odesłania ponosi Konsument. Zwrot płatności następuje nie później niż w ciągu 14 dni od otrzymania oświadczenia i może zostać wstrzymany do otrzymania towaru albo dowodu jego odesłania. Szczegółowe zasady i wzór oświadczenia znajdują się na stronie <a href="/zwroty/">Zwroty i reklamacje</a>.</p><h2>7. Reklamacje</h2><p>Sprzedawca odpowiada za brak zgodności towaru z umową na zasadach ustawy o prawach konsumenta. Reklamację można przesłać e-mailem albo pocztą na adres siedziby. Powinna wskazywać kupującego, numer zamówienia, produkt, opis niezgodności i żądanie. Zdjęcia są pomocne, lecz nieobowiązkowe. Odpowiedź zostanie udzielona w ciągu 14 dni.</p><h2>8. Dane osobowe i postanowienia końcowe</h2><p>Zasady przetwarzania danych opisuje <a href="/prywatnosc/">Polityka prywatności</a>. Umowy są zawierane w języku polskim. Konsument może skorzystać z bezpłatnej pomocy rzecznika konsumentów i Inspekcji Handlowej. W sprawach nieuregulowanych stosuje się prawo polskie.</p>`,
  },
  {
    route: 'prywatnosc',
    title: 'Polityka prywatności i cookies | Artway-TM',
    description: 'Polityka prywatności Artway-TM: administrator danych, cele, podstawy, odbiorcy, okres przechowywania, prawa i cookies.',
    heading: 'Polityka prywatności i cookies',
    body: `<h2>1. Administrator danych</h2>${seller}<p>Administratorem danych osobowych jest ${STORE_LEGAL.name}. W sprawach dotyczących prywatności można skontaktować się przez <a href="mailto:${STORE_LEGAL.email}">${STORE_LEGAL.email}</a>.</p><h2>2. Zakres, cele i podstawy</h2><p>Dane podane przy zamówieniu i koncie — w szczególności imię, nazwisko, adres, e-mail, telefon, dane dostawy oraz dane firmy — przetwarzamy w celu zawarcia i wykonania umowy, obsługi płatności, dostawy, kontaktu, zwrotu i reklamacji (art. 6 ust. 1 lit. b RODO). Dane wymagane prawem przetwarzamy na podstawie obowiązku prawnego (lit. c), a niezbędne logi bezpieczeństwa i ochronę roszczeń — na podstawie prawnie uzasadnionego interesu (lit. f).</p><h2>3. Odbiorcy danych</h2><p>Dane otrzymują tylko podmioty niezbędne do realizacji zadania: OVHcloud w zakresie hostingu, Google/Gmail w zakresie poczty, InPost w zakresie dostawy i ewentualnie InPost Pay, mElements S.A. i dostawcy metod udostępnianych przez Paynow w zakresie płatności oraz inFakt w zakresie faktur. Każdy odbiorca otrzymuje wyłącznie niezbędny zakres.</p><h2>4. Okres przechowywania</h2><p>Dane zamówienia przechowujemy przez okres wykonania umowy, obsługi reklamacji, możliwych roszczeń oraz przez okres wymagany przepisami podatkowymi i rachunkowymi. Dane konta są przechowywane do jego usunięcia, z wyjątkiem danych, które nadal musimy przechowywać na innej podstawie prawnej.</p><h2>5. Prawa osoby</h2><p>Przysługuje prawo dostępu, sprostowania, usunięcia lub ograniczenia danych, przenoszenia, sprzeciwu — gdy ma zastosowanie — oraz skargi do Prezesa Urzędu Ochrony Danych Osobowych. Podanie danych wymaganych w zamówieniu jest dobrowolne, ale konieczne do jego realizacji.</p><h2>6. Cookies</h2><p>Cookies to niewielkie informacje zapisywane w urządzeniu. Sklep używa plików niezbędnych do działania koszyka, sesji, bezpieczeństwa i zapamiętania ustawień. Analityka niewymagana do działania może być uruchamiana tylko zgodnie z dokonanym wyborem. Ustawieniami cookies można zarządzać w przeglądarce; wyłączenie niezbędnych plików może uniemożliwić korzystanie z koszyka lub logowania.</p>`,
  },
  {
    route: 'dostawa',
    title: 'Dostawa i płatności | Artway-TM',
    description: 'Metody i koszty dostawy InPost, płatności, waluta PLN oraz czas realizacji zamówień Artway-TM.',
    heading: 'Dostawa i płatności',
    body: `<p><strong>Waluta rozliczeń: PLN.</strong> Wszystkie ceny i koszty widoczne w sklepie są cenami brutto.</p><h2>Dostawa na terenie Polski</h2><ul><li><strong>Paczkomat® / PaczkoPunkt InPost:</strong> 18,00 zł; klient wybiera punkt na mapie lub liście.</li><li><strong>Kurier InPost:</strong> 24,00 zł pod wskazany adres.</li><li><strong>Paczka w Weekend:</strong> opcjonalna usługa dodatkowa +5,00 zł, gdy jest dostępna dla wybranej przesyłki.</li><li><strong>Darmowa dostawa:</strong> od 400,00 zł wartości produktów, zgodnie z informacją w koszyku.</li></ul><p>Standardowy czas przygotowania przesyłki wynosi do 48 godzin roboczych. Do tego należy doliczyć czas przewozu InPost. Przy płatności online przygotowanie rozpoczyna się po pozytywnej autoryzacji. Status i numer nadania przekazujemy e-mailem.</p><h2>Metody płatności</h2><ul><li><strong>Płatność przy odbiorze:</strong> opłata 8,00 zł, jeśli metoda jest dostępna w formularzu.</li><li><strong>Przelew na telefon:</strong> dane i numer zamówienia są pokazywane po jego złożeniu.</li><li><strong>Paynow:</strong> BLIK, szybki przelew lub karta — metoda pojawia się wyłącznie po aktywacji połączenia i jest przekierowaniem do bezpiecznej bramki.</li><li><strong>InPost Pay:</strong> po zawarciu osobnej umowy i uruchomieniu integracji może działać jako dodatkowy, ekspresowy proces zakupu łączący płatność oraz dostawę w aplikacji InPost.</li></ul><p>Ostateczny zestaw metod, wszystkie opłaty oraz całkowita kwota do zapłaty są zawsze widoczne w podsumowaniu przed przyciskiem „Zamówienie z obowiązkiem zapłaty”.</p>`,
  },
  {
    route: 'zwroty',
    title: 'Zwroty i reklamacje | Artway-TM',
    description: 'Procedura odstąpienia od umowy, zwrotu pieniędzy oraz składania i rozpatrywania reklamacji w Artway-TM.',
    heading: 'Zwroty i reklamacje',
    body: `<h2>Zwrot w ciągu 14 dni</h2><p>Konsument może odstąpić od umowy zawartej na odległość bez podania przyczyny w ciągu 14 dni od otrzymania produktu. Jednoznaczne oświadczenie należy wysłać na <a href="mailto:${STORE_LEGAL.email}">${STORE_LEGAL.email}</a> albo na adres: ${STORE_LEGAL.street}, ${STORE_LEGAL.postalCode} ${STORE_LEGAL.city}. Produkt należy odesłać nie później niż 14 dni od wysłania oświadczenia. Bezpośredni koszt zwykłego odesłania ponosi Konsument.</p><h2>Zwrot pieniędzy</h2><p>Zwracamy otrzymane płatności, w tym koszt najtańszej zwykłej dostawy oferowanej dla zamówienia, nie później niż w ciągu 14 dni od otrzymania oświadczenia. Zwrot może zostać wstrzymany do otrzymania produktu albo dowodu jego odesłania. Środki zwracamy tą samą metodą, której użyto przy płatności, chyba że Konsument zgodzi się na inny bezkosztowy sposób.</p><h2>Reklamacje</h2><p>Reklamację można złożyć e-mailem na <a href="mailto:${STORE_LEGAL.email}">${STORE_LEGAL.email}</a> albo pocztą na adres siedziby. Zgłoszenie powinno zawierać dane kupującego, numer zamówienia, nazwę produktu, opis niezgodności, datę jej stwierdzenia i żądanie. Zdjęcia mogą pomóc, ale nie są obowiązkowe. Odpowiadamy w ciągu 14 dni. Uzasadnione koszty realizacji reklamacji ponosi Sprzedawca.</p><h2>Wzór oświadczenia o odstąpieniu</h2><pre>Adresat: ${STORE_LEGAL.name}, ${STORE_LEGAL.street}, ${STORE_LEGAL.postalCode} ${STORE_LEGAL.city}, ${STORE_LEGAL.email}\nOświadczam, że odstępuję od umowy sprzedaży następujących produktów: …\nNumer zamówienia: …\nData odbioru: …\nImię i nazwisko Konsumenta: …\nAdres Konsumenta: …\nData: …</pre>`,
  },
]);

function pageMain(page) {
  return `<main id="widok" tabindex="-1"><div class="page seo-legal-entry"><div class="crumb"><a href="/">Sklep</a> › ${page.heading}</div><article class="panel legal-content"><span class="seo-legal-kicker">ARTWAY-TM • INFORMACJE DLA KUPUJĄCYCH</span><h1>${page.heading}</h1>${nav}${page.body}<p class="seo-legal-updated">Ostatnia aktualizacja: 22 lipca 2026 r.</p></article></div></main>`;
}

export function renderPublicCompliancePage(indexHtml, page) {
  let html = String(indexHtml);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${page.title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${page.description}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${page.title}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${page.description}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="https://artwaytm.pl/${page.route}/">`);
  html = html.replace('</head>', `<link rel="canonical" href="https://artwaytm.pl/${page.route}/">\n</head>`);
  html = html.replace(/<main id="widok"[\s\S]*?<\/main>/i, pageMain(page));
  return html;
}

export async function buildPublicCompliancePages(root, { check = false } = {}) {
  const indexHtml = await readFile(path.join(root, 'index.html'), 'utf8');
  const differences = [];
  for (const page of PUBLIC_COMPLIANCE_PAGES) {
    const expected = renderPublicCompliancePage(indexHtml, page);
    const output = path.join(root, page.route, 'index.html');
    if (check) {
      const current = await readFile(output, 'utf8').catch(() => '');
      if (current !== expected) differences.push(`${page.route}/index.html`);
    } else {
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, expected, 'utf8');
    }
  }
  return differences;
}
