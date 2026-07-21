function widokUlubione(){
  if(jestAdmin()) return `<div class="page"><div class="panel auth-box"><h1>🛡️ Konto administratora</h1><p>Lista ulubionych jest przeznaczona dla kont klientów.</p><p style="margin-top:1rem"><a class="btn" href="#/admin">Otwórz panel administratora</a></p></div></div>`;
  if(ustawieniaPodstrony("ulubione").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("ulubione");
  const lista = produkty.filter(p=>ulubione.includes(p.id));
  return `
  <div class="${klasaPodstrony("ulubione")}">
    ${ikonaPodstronyHTML("ulubione")}<h1 style="margin-bottom:.25rem">${esc(us.tytul)}</h1>
    <p style="color:var(--muted2);margin-bottom:.8rem">${esc(us.opis||"")}</p>
    ${lista.length ? `<div class="grid" style="padding:0">${lista.map(kartaProduktu).join("")}</div>`
      : `<div class="panel"><p>Nie masz jeszcze ulubionych. Kliknij 🤍 na produkcie, żeby go tu dodać.</p><p style="margin-top:.6rem"><a href="#/">← Wróć do sklepu</a></p></div>`}
  </div>`;
}
function przelaczUlubione(id){
  if(jestAdmin()){ toast("Ulubione są dostępne tylko dla kont klientów"); return; }
  ulubione = ulubione.includes(id) ? ulubione.filter(x=>x!==id) : [...ulubione, id];
  zapiszLS("artway_ulubione", ulubione);
  odswiezUlubioneLicznik();
  toast(ulubione.includes(id) ? "Dodano do ulubionych ❤️" : "Usunięto z ulubionych");
  if(trasa()==="/"||trasa()==="") rysuj(); else if(trasa()==="/ulubione") renderuj();
}

/* ═══════════ WIDOK: KONTAKT + STRONY INFORMACYJNE ═══════════ */
function widokKontakt(){
  if(ustawieniaPodstrony("kontakt").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("kontakt");
  return `
  <div class="${klasaPodstrony("kontakt")}">
    <div class="crumb"><a href="#/">Sklep</a> › Kontakt</div>
    <div class="contact-layout">
      <div class="panel">
        ${ikonaPodstronyHTML("kontakt")}<h1>${esc(us.tytul)}</h1>
        <p>${esc(us.opis||"")}</p>
        <form style="margin-top:1rem" onsubmit="wyslijKontakt(event)">
          <div class="f-row">
            <div class="f-group"><label>Twój e-mail</label><input required name="email" type="email" autocomplete="email"></div>
            <div class="f-group"><label>Temat</label><input required name="temat" placeholder="Np. pytanie o produkt"></div>
          </div>
          <div class="f-group"><label>Numer zamówienia (opcjonalnie)</label><input name="numer" placeholder="Np. ATM-123456"></div>
          <div class="f-group"><label>Wiadomość</label><textarea required name="tresc" rows="7" placeholder="W czym możemy pomóc?"></textarea></div>
          <button class="btn" type="submit">📧 Wyślij wiadomość</button>
          <p class="pay-note" style="text-align:left">Formularz otworzy Twój program pocztowy z gotową wiadomością.</p>
        </form>
      </div>
      <aside class="contact-side">
        <div class="info-card"><span style="font-size:1.5rem">🏢</span><b>Dane sprzedawcy</b><p>${daneFirmyHTML()}</p></div>
        <div class="info-card"><span style="font-size:1.5rem">✉️</span><b>E-mail</b><p><a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a><br>Najlepsza forma kontaktu w sprawie zamówień.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">📞</span><b>Telefon</b><p>${esc(KONFIG.telefon)}<br>Obsługa w dni robocze.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">🕘</span><b>Godziny odpowiedzi</b><p>Poniedziałek–piątek, 9:00–17:00. Zwykle odpowiadamy w ciągu jednego dnia roboczego.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">📦</span><b>Sprawdź najpierw</b><p><a href="#/faq">Najczęstsze pytania</a><br><a href="#/dostawa">Dostawa i płatności</a><br><a href="#/zwroty">Zwroty i reklamacje</a></p></div>
      </aside>
    </div>
  </div>`;
}
function wyslijKontakt(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const numer = String(f.get("numer")||"").trim();
  const body = `${f.get("tresc")}${numer?"\n\nNumer zamówienia: "+numer:""}\n\nOd: ${f.get("email")}`;
  location.href = `mailto:${KONFIG.emailSklepu}?subject=${encodeURIComponent("[Kontakt] "+f.get("temat"))}&body=${encodeURIComponent(body)}`;
  toast("Otwieram program pocztowy… 📧");
}
function widokONas(){
  if(ustawieniaPodstrony("onas").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("onas");
  return `
  <div class="${klasaPodstrony("onas")}">
    <div class="crumb"><a href="#/">Sklep</a> › O Artway-TM</div>
    <div class="panel">
      ${ikonaPodstronyHTML("onas")}<h1>${esc(us.tytul)}</h1>
      <p style="color:var(--muted2);margin-bottom:.8rem">${esc(us.opis||"")}</p>
      <p>Artway-TM to sklep wielobranżowy stworzony z myślą o wygodnych zakupach w jednym miejscu. Oferta obejmuje elektronikę, wyposażenie domu i ogrodu, narzędzia, odzież oraz produkty sportowe.</p>
      <div class="info-grid">
        <div class="info-card"><span style="font-size:1.5rem">🗂️</span><b>Różne kategorie</b><p>Praktyczne produkty do domu, pracy, warsztatu i aktywnego wypoczynku.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">🔎</span><b>Czytelna oferta</b><p>Wyszukiwarka, katalogi, sortowanie i ulubione ułatwiają porównanie produktów.</p></div>
        <div class="info-card"><span style="font-size:1.5rem">💬</span><b>Kontakt z obsługą</b><p>Pomagamy w pytaniach dotyczących produktów, dostawy oraz zamówień.</p></div>
      </div>
      <h2>Nasze podejście</h2>
      <p>Chcemy, aby klient przed złożeniem zamówienia znał cenę, dostępne sposoby dostawy i płatności oraz zasady zwrotu. Dlatego najważniejsze informacje są dostępne bezpośrednio w sklepie i w podsumowaniu koszyka.</p>
      <h2>Masz pytanie?</h2>
      <p>Napisz na <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a> albo przejdź do <a href="#/kontakt">formularza kontaktowego</a>.</p>
    </div>
  </div>`;
}
function widokFAQ(){
  if(ustawieniaPodstrony("faq").widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const us=ustawieniaPodstrony("faq");
  return `
  <div class="${klasaPodstrony("faq")}">
    <div class="crumb"><a href="#/">Sklep</a> › Najczęstsze pytania</div>
    <div class="panel">
      ${ikonaPodstronyHTML("faq")}<h1>${esc(us.tytul)}</h1>
      <p style="margin-bottom:1rem">${esc(us.opis||"")}</p>
      <div class="faq-list">
        <details open><summary>Jak znaleźć odpowiedni produkt?</summary><p>Użyj wyszukiwarki w nagłówku, wybierz katalog albo skorzystaj z sortowania cenowego. Produkty możesz zapisywać na liście ulubionych.</p></details>
        <details><summary>Czy muszę zakładać konto?</summary><p>Nie. Zamówienie możesz złożyć bez rejestracji. Konto ułatwia dostęp do historii zakupów i ulubionych produktów na tym urządzeniu.</p></details>
        <details><summary>Jakie są metody dostawy?</summary><p>Sklep realizuje wysyłkę wyłącznie przez InPost: do paczkomatu/punktu odbioru albo Kurierem InPost pod adres. Przy paczkomacie punkt wybierasz w koszyku na mapie albo przez wyszukiwarkę.</p></details>
        <details><summary>Kiedy dostawa jest bezpłatna?</summary><p>Dostawa InPost jest bezpłatna od ${KONFIG.darmowaDostawaOd} zł wartości produktów po uwzględnieniu rabatu.</p></details>
        <details><summary>Jak mogę zapłacić?</summary><p>Aktualne opcje płatności to: ${esc(platnosciOpis())}. Przy przelewie na telefon wpisz w tytule numer zamówienia.</p></details>
        <details><summary>Jak użyć kodu rabatowego?</summary><p>Wpisz kod w koszyku i kliknij „Zastosuj”. Wartość rabatu od razu pojawi się w podsumowaniu.</p></details>
        <details><summary>Jak zwrócić produkt?</summary><p>Na odstąpienie od umowy masz 14 dni od odbioru. Napisz na ${esc(KONFIG.emailSklepu)}, podając numer zamówienia i produkty, które chcesz zwrócić.</p></details>
        <details><summary>Jak zgłosić reklamację?</summary><p>Wyślij opis problemu, numer zamówienia i — jeśli to pomocne — zdjęcia na ${esc(KONFIG.emailSklepu)}. Otrzymasz dalsze instrukcje.</p></details>
        <details><summary>Gdzie sprawdzić status zamówienia?</summary><p>Jeśli zamówienie było przypisane do konta, znajdziesz je w sekcji „Moje zamówienia”. Możesz też skontaktować się z obsługą i podać numer zamówienia.</p></details>
      </div>
      <div class="contact-strip" style="margin-top:1.2rem">
        <div><h2>Nie ma tu odpowiedzi?</h2><p>Napisz do obsługi Artway-TM.</p></div>
        <a class="btn" href="#/kontakt">Przejdź do kontaktu</a>
      </div>
    </div>
  </div>`;
}
function widokRegulamin(){
  if(KONFIG.tresci?.regulamin) return stronaInfo("📜 Regulamin sklepu", KONFIG.tresci.regulamin,"regulamin");
  return stronaInfo("📜 Regulamin sklepu", `
    <p><b>Obowiązuje od 21 lipca 2026 r.</b> Regulamin określa zasady sprzedaży towarów w sklepie internetowym Artway‑TM, zawierania umów na odległość oraz obsługi płatności, dostaw, odstąpień i reklamacji.</p>
    <h2>§1 Sprzedawca i kontakt</h2><p>Sprzedawcą i usługodawcą prowadzącym sklep jest:<br>${daneFirmyHTML()}<br>E-mail obsługi kupujących: <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a><br>Telefon: ${esc(KONFIG.telefon)}.</p>
    <h2>§2 Definicje i zakres usług</h2><p><b>Sklep</b> — serwis internetowy Artway‑TM; <b>Sprzedawca</b> — podmiot wskazany w §1; <b>Klient</b> — osoba składająca zamówienie; <b>Konsument</b> — osoba fizyczna dokonująca zakupu niezwiązanego bezpośrednio z działalnością gospodarczą; <b>Produkt</b> — rzecz ruchoma opisana w ofercie; <b>Zamówienie</b> — oświadczenie Klienta zmierzające do zawarcia umowy sprzedaży.</p><p>Sklep sprzedaje fizyczne produkty: gry, zabawki oraz artykuły imprezowe. Nie sprzedaje usług ani treści cyfrowych wymagających aktywacji; zasady aktywowania zakupionych usług nie mają więc zastosowania. Do korzystania ze sklepu wystarcza aktualna przeglądarka internetowa, połączenie z Internetem i aktywny adres e-mail. Konto klienta jest dobrowolne.</p>
    <h2>§3 Składanie zamówienia i zawarcie umowy</h2><p>Zamówienia można składać przez całą dobę. Klient wybiera produkt i ilość, dodaje je do koszyka, wskazuje sposób dostawy i płatności, podaje wymagane dane, zapoznaje się z regulaminem i naciska przycisk „Zamówienie z obowiązkiem zapłaty”. Przed złożeniem zamówienia można poprawić dane i zawartość koszyka. Złożenie zamówienia oznacza ofertę zawarcia umowy. Umowa sprzedaży zostaje zawarta po przesłaniu przez Sprzedawcę potwierdzenia przyjęcia zamówienia na podany e-mail. Sprzedawca może odmówić przyjęcia zamówienia, gdy produktu obiektywnie nie można dostarczyć, płatność nie została wykonana albo dane uniemożliwiają realizację; Klient otrzyma informację i pełny zwrot pobranych środków.</p>
    <h2>§4 Ceny, dokument sprzedaży i płatności</h2><p>Wszystkie ceny są podawane w złotych polskich (<b>PLN</b>) i są cenami brutto, obejmującymi należne podatki. Przed złożeniem zamówienia Klient widzi cenę produktów, rabat, koszt dostawy, koszt usług dodatkowych, ewentualną opłatę za wybraną płatność i całkowitą kwotę do zapłaty. Dokument zakupu jest przekazywany zgodnie z obowiązującymi przepisami; na żądanie i po podaniu prawidłowych danych wystawiana jest faktura.</p><p>Aktualnie udostępnione metody płatności są widoczne w checkout: ${esc(platnosciOpis())}. <b>Podmiotem świadczącym obsługę płatności online jest mElements S.A.</b> w ramach bramki Paynow. W Paynow mogą być dostępne m.in. BLIK, szybki przelew oraz karty Visa, Visa Electron, Mastercard, MasterCard Electronic i Maestro — ostateczny zestaw metod pokazuje bramka. Czas realizacji zamówienia opłacanego online liczy się od pozytywnej autoryzacji płatności. Przy zwrocie płatności online środki są zwracane tą samą metodą, którą wykonano płatność, chyba że Klient wyraźnie zgodzi się na inny bezkosztowy sposób.</p>
    <h2>§5 Dostawa i realizacja</h2><p>Dostawa jest realizowana wyłącznie na terytorium Polski przez InPost: do Paczkomatu/PaczkoPunktu albo Kurierem InPost pod wskazany adres. Deklarowany czas przygotowania i nadania wynosi ${esc(tekstWysylki())} w dni robocze; przewidywany czas przewozu InPost wynosi zwykle 1–2 dni robocze od nadania. Dokładna metoda i koszt są zawsze pokazane przed złożeniem zamówienia. Darmowa dostawa obowiązuje od ${KONFIG.darmowaDostawaOd} zł, jeśli koszyk spełnia aktualne warunki promocji. Ryzyko przypadkowej utraty lub uszkodzenia towaru przechodzi na Konsumenta dopiero z chwilą jego wydania.</p>
    <h2>§6 Odstąpienie od umowy</h2><p>Konsument może odstąpić od umowy zawartej na odległość bez podania przyczyny w ciągu 14 dni od objęcia towaru w posiadanie. Wystarczy wysłać jednoznaczne oświadczenie przed upływem terminu, np. na adres e-mail Sprzedawcy. Towar należy odesłać na adres siedziby Sprzedawcy nie później niż 14 dni od złożenia oświadczenia. Bezpośredni koszt zwykłego odesłania ponosi Konsument. Konsument odpowiada tylko za zmniejszenie wartości wynikające z korzystania z towaru w sposób wykraczający poza konieczny do ustalenia jego charakteru, cech i działania.</p><p>Sprzedawca zwraca wszystkie otrzymane płatności, w tym koszt najtańszego zwykłego sposobu dostawy oferowanego dla zamówienia, nie później niż w ciągu 14 dni od otrzymania oświadczenia. Zwrot może zostać wstrzymany do otrzymania towaru albo dowodu jego odesłania. Ustawowe wyjątki od prawa odstąpienia stosuje się wyłącznie w przypadkach wskazanych w art. 38 ustawy o prawach konsumenta, np. dla rzeczy wykonanych według specyfikacji Konsumenta lub zapieczętowanych towarów, których po otwarciu nie można zwrócić ze względów higienicznych.</p>
    <h2>§7 Reklamacje</h2><p>Sprzedawca odpowiada wobec Konsumenta za brak zgodności towaru z umową istniejący w chwili dostarczenia i ujawniony w ciągu dwóch lat od tej chwili. Reklamację można wysłać na <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a> albo adres siedziby. Zgłoszenie powinno zawierać dane Klienta, numer zamówienia, nazwę produktu, opis niezgodności, datę jej stwierdzenia oraz żądanie; zdjęcia są pomocne, ale nie są obowiązkowe. Sprzedawca odpowiada na reklamację Konsumenta w ciągu 14 dni. Naprawa lub wymiana odbywa się w rozsądnym czasie i bez nadmiernych niedogodności, a uzasadnione koszty reklamacji ponosi Sprzedawca. Uprawnienia do obniżenia ceny lub odstąpienia od umowy stosuje się zgodnie z ustawą o prawach konsumenta.</p>
    <h2>§8 Dane osobowe, spory i postanowienia końcowe</h2><p>Zasady przetwarzania danych opisuje <a href="#/prywatnosc">Polityka prywatności</a>. Umowy zawierane są w języku polskim. Konsument może skorzystać z bezpłatnej pomocy miejskiego lub powiatowego rzecznika konsumentów oraz właściwego wojewódzkiego inspektoratu Inspekcji Handlowej; skorzystanie z pozasądowego sposobu rozwiązania sporu jest dobrowolne. W sprawach nieuregulowanych stosuje się prawo polskie, w szczególności Kodeks cywilny i ustawę o prawach konsumenta.</p><p>Regulamin jest dostępny bezpłatnie w sposób umożliwiający zapisanie i odtworzenie. Zmiany regulaminu nie naruszają praw nabytych ani warunków zamówień złożonych przed wejściem zmian w życie. O istotnych zmianach dotyczących konta klienta Sprzedawca poinformuje z odpowiednim wyprzedzeniem.</p>`,"regulamin");
}
function widokPrywatnosc(){
  if(KONFIG.tresci?.prywatnosc) return stronaInfo("🔒 Polityka prywatności (RODO)", KONFIG.tresci.prywatnosc,"prywatnosc");
  return stronaInfo("🔒 Polityka prywatności (RODO)", `
    <h2>1. Administrator danych</h2><p>Administratorem danych osobowych jest ${daneFirmyHTML()}. W sprawach dotyczących danych można skontaktować się przez <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a> lub ${esc(KONFIG.telefon)}.</p>
    <h2>2. Zakres, cele i podstawy przetwarzania</h2><p>Przetwarzamy dane podane przy zamówieniu: imię i nazwisko, adres, e-mail, telefon, dane dostawy, a przy zakupie firmowym także nazwę firmy i NIP. Dane są potrzebne do zawarcia i wykonania umowy, obsługi płatności, dostawy, kontaktu oraz reklamacji (art. 6 ust. 1 lit. b RODO). Dane wymagane przepisami rachunkowymi i podatkowymi przetwarzamy w celu wykonania obowiązku prawnego (art. 6 ust. 1 lit. c RODO). Dane techniczne, historia obsługi i niezbędne logi mogą być przetwarzane dla bezpieczeństwa, zapobiegania nadużyciom i ochrony roszczeń (art. 6 ust. 1 lit. f RODO).</p>
    <h2>3. Konto klienta</h2><p>Utworzenie konta jest dobrowolne. Hasło jest przechowywane wyłącznie jako odporny kryptograficznie skrót z indywidualną solą; sklep nie przechowuje jego jawnej treści. Sesja konta jest podpisywana przez serwer i ma ograniczony czas ważności.</p>
    <h2>4. Odbiorcy danych</h2><p>Dane otrzymują wyłącznie podmioty niezbędne do realizacji określonego zadania: dostawca hostingu i infrastruktury OVHcloud, operator poczty Google/Gmail, InPost w zakresie dostawy, mElements S.A. (Paynow) w zakresie płatności online oraz inFakt w zakresie faktury, jeśli jest wystawiana. Mogą je otrzymać także uprawnione organy, gdy obowiązek wynika z prawa. Każdy odbiorca otrzymuje tylko niezbędny zakres, np. InPost — dane odbiorcy i adres/punkt dostawy, a operator płatności — identyfikator i kwotę transakcji.</p>
    <h2>5. Okres przechowywania</h2><p>Dane zamówień przechowujemy przez okres realizacji umowy, obsługi reklamacji i możliwych roszczeń, a dokumentację wymaganą prawem — przez okres wynikający z przepisów podatkowych i rachunkowych. Dane konta przechowujemy do jego usunięcia, z wyjątkiem danych, które nadal muszą być przechowywane na innej podstawie prawnej. Logi bezpieczeństwa są przechowywane tylko przez czas potrzebny do wykrywania i wyjaśniania zdarzeń.</p>
    <h2>6. Prawa użytkownika</h2><p>Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia oraz wnieść sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie. Masz też prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych. Żądania można wysyłać na ${esc(KONFIG.emailSklepu)}.</p>
    <h2>7. Cookies, pamięć przeglądarki i bezpieczeństwo</h2><p>Cookies to niewielkie informacje zapisywane w urządzeniu użytkownika. Sklep wykorzystuje wyłącznie cookies lub równoważną pamięć przeglądarki konieczną do zapewnienia koszyka, sesji logowania, bezpieczeństwa, ulubionych i ustawień interfejsu. Dane konta, profilu i zamówień są synchronizowane z zabezpieczonym serwerem. Użytkownik może ograniczyć lub usunąć cookies w ustawieniach przeglądarki; zablokowanie mechanizmów niezbędnych może uniemożliwić logowanie albo zachowanie koszyka. Obecnie sklep nie uruchamia cookies reklamowych. Jeśli zostaną włączone narzędzia analityczne lub marketingowe wymagające zgody, przed ich uruchomieniem pojawi się osobny wybór zgód wraz z listą dostawców i możliwością wycofania zgody.</p>
    <h2>8. Przekazywanie poza EOG i automatyzacja</h2><p>Niektórzy dostawcy technologiczni mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym wyłącznie przy zastosowaniu wymaganych zabezpieczeń, np. decyzji stwierdzającej odpowiedni stopień ochrony lub standardowych klauzul umownych. Narzędzia automatyczne i Agent AI mogą przygotowywać administratorowi propozycje operacyjne, ale nie podejmują wobec klienta decyzji wywołujących skutki prawne wyłącznie w sposób zautomatyzowany.</p>
    <h2>9. Zmiany polityki</h2><p>Polityka obowiązuje od 21 lipca 2026 r. Jej aktualna wersja jest zawsze dostępna w sklepie. Istotne zmiany dotyczące konta klienta zostaną zakomunikowane w odpowiedni sposób.</p>`,"prywatnosc");
}
function widokDostawa(){
  const publiczneKody=regulyRabatowe().filter(r=>r.publiczny&&regulaRabatowaStatus(r).aktywna);
  return stronaInfo("🚚 Dostawa i płatności", `
    <p><b>Waluta rozliczeń: PLN.</b> Wszystkie ceny i koszty w sklepie są cenami brutto.</p>
    <h2>Formy, koszty i obszar dostawy</h2>
    <ul>${dostepneDostawy().map(d=>`<li>${d.nazwa} — ${d.koszt?d.koszt+" zł":"gratis"} (${d.opis})</li>`).join("")}<li><b>Darmowa dostawa InPost</b> przy zamówieniach od ${KONFIG.darmowaDostawaOd} zł</li></ul>
    <p>Dostawa jest realizowana wyłącznie na terytorium Polski. Przy zamówieniu wybierasz Paczkomat/PaczkoPunkt InPost na mapie albo dostawę Kurierem InPost pod adres.</p>
    <p><b>Deklarowany czas przygotowania i nadania:</b> ${esc(czasWysylki())} w dni robocze. Przewidywany przewóz InPost trwa zwykle 1–2 dni robocze od nadania. Informację o nadaniu i numer śledzenia wysyłamy e-mailem.</p>
    <h2>Formy płatności</h2>
    <ul>${dostepnePlatnosci().map(p=>`<li>${p.nazwa}${p.oplata?" (+"+p.oplata+" zł)":""}${p.id==="telefon"?` — w tytule wpisz numer zamówienia; numer: ${formatTelefonPlatnosci()}`:""}${p.id==="paynow"?` — bramka mBank Paynow`:""}</li>`).join("")}</ul>
    <p>Płatności online przez Paynow obsługuje mElements S.A. Metoda pojawi się w checkout dopiero po zakończeniu konfiguracji i pozytywnym połączeniu bramki. Dla płatności online realizację rozpoczynamy po pozytywnej autoryzacji.</p>
    <h2>Kody rabatowe</h2>
    <p>${publiczneKody.length?`Aktualne kody: ${publiczneKody.map(r=>`<b>${esc(r.kod)}</b> (${r.typ==="darmowa_dostawa"?"darmowa dostawa":r.typ==="kwota"?`−${zl(r.wartosc)}`:`−${Number(r.wartosc)||0}%`})`).join(", ")}. Kod wpisz w koszyku.`:"Aktualne promocje i warunki są zawsze widoczne w koszyku oraz na stronie głównej."}</p>`,"dostawa");
}
function widokZwroty(){
  if(KONFIG.tresci?.zwroty) return stronaInfo("↩️ Zwroty i reklamacje", KONFIG.tresci.zwroty,"zwroty");
  return stronaInfo("↩️ Zwroty i reklamacje", `
    <h2>Zwrot w 14 dni</h2><p>Jeżeli jesteś Konsumentem, możesz odstąpić od umowy w ciągu 14 dni od otrzymania przesyłki bez podania przyczyny. Wyślij jednoznaczne oświadczenie na <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a> albo adres siedziby: ${esc(pelnyAdresFirmy())}. Następnie odeślij produkt nie później niż 14 dni od wysłania oświadczenia. Bezpośredni koszt zwykłego odesłania ponosi klient. Nie dołączamy gotowej etykiety zwrotnej.</p>
    <h2>Zwrot pieniędzy</h2><p>Zwrot środków wykonujemy nie później niż w ciągu 14 dni od otrzymania oświadczenia, łącznie z kosztem najtańszej zwykłej dostawy oferowanej dla zamówienia. Możemy wstrzymać zwrot do chwili otrzymania produktu albo przedstawienia potwierdzenia jego odesłania. Płatność online zwracamy tą samą metodą, chyba że zgodzisz się na inny bezkosztowy sposób.</p>
    <h2>Wymiana</h2><p>Nie prowadzimy osobnej procedury wymiany. Możesz zwrócić produkt zgodnie z powyższymi zasadami i złożyć nowe zamówienie.</p>
    <h2>Reklamacje</h2><p>Jeśli produkt jest niezgodny z umową, wyślij dane kupującego, numer zamówienia, nazwę produktu, opis problemu, datę jego stwierdzenia i swoje żądanie. Zdjęcia pomagają w ocenie, ale nie są obowiązkowe. Odpowiemy w ciągu 14 dni. Uzasadnione koszty odesłania reklamowanego produktu ponosi Sprzedawca.</p>
    <h2>Wzór oświadczenia o odstąpieniu</h2><div class="backend-note" style="white-space:pre-line"><b>Adresat:</b> ${esc(daneFirmy().nazwa)}, ${esc(pelnyAdresFirmy())}, ${esc(KONFIG.emailSklepu)}
Niniejszym informuję o odstąpieniu od umowy sprzedaży następujących produktów: …
Numer zamówienia i data zawarcia umowy: …
Data odbioru: …
Imię i nazwisko Konsumenta: …
Adres Konsumenta: …
Data i podpis (podpis tylko dla wersji papierowej): …</div><button class="btn ghost" type="button" onclick="pobierzFormularzOdstapienia()">⬇️ Pobierz wzór odstąpienia TXT</button>`,"zwroty");
}
function pobierzFormularzOdstapienia(){
  const d=daneFirmy(),tekst=`WZÓR OŚWIADCZENIA O ODSTĄPIENIU OD UMOWY\n\nAdresat: ${d.nazwa}\n${pelnyAdresFirmy(d)}\nE-mail: ${KONFIG.emailSklepu}\n\nNiniejszym informuję o odstąpieniu od umowy sprzedaży następujących produktów:\n........................................................................\nNumer zamówienia i data zawarcia umowy:\n........................................................................\nData odbioru:\n........................................................................\nImię i nazwisko Konsumenta:\n........................................................................\nAdres Konsumenta:\n........................................................................\nData i podpis (podpis tylko dla wersji papierowej):\n........................................................................\n`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([tekst],{type:"text/plain;charset=utf-8"}));a.download="formularz-odstapienia-Artway-TM.txt";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function widokWylaczonejStrony(){
  return `<div class="page page-compact"><div class="panel" style="text-align:center"><h1>Ta strona jest chwilowo wyłączona</h1><p>Wróć na stronę główną lub skontaktuj się ze sklepem.</p><p style="margin-top:1rem"><a class="btn" href="#/">← Strona główna</a></p></div></div>`;
}
function stronaInfo(tytul, tresc,id){
  const us=id?ustawieniaPodstrony(id):null;
  if(us?.widoczna===false&&!jestAdmin()) return widokWylaczonejStrony();
  const pageId=id||"info";
  const bloki={
    naglowek:`${us?ikonaPodstronyHTML(pageId):""}<h1>${us?esc(us.tytul):tytul}</h1>`,
    opis:us?.opis?`<p style="margin-bottom:1rem">${esc(us.opis)}</p>`:"",
    tresc,
    powrot:`<p style="margin-top:1.2rem"><a href="#/">← Wróć do sklepu</a></p>`
  };
  const html=kolejnoscSekcjiPodstrony(pageId).filter(s=>sekcjaPodstronyWidoczna(pageId,s)).map(s=>bloki[s]||"").join("");
  return `<div class="${id?klasaPodstrony(id):"page"}"><div class="panel">${html}</div></div>`;
}
