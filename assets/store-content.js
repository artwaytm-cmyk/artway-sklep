/* GENERATED STORE CONTENT — loaded on demand */
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
    <p>Regulamin określa zasady sprzedaży w sklepie internetowym Artway-TM oraz prawa kupującego.</p>
    <h2>§1 Sprzedawca i kontakt</h2><p>Sprzedawcą jest:<br>${daneFirmyHTML()}<br>E-mail: <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a><br>Telefon: ${esc(KONFIG.telefon)}.</p>
    <h2>§2 Składanie zamówień</h2><p>Zamówienia można składać przez całą dobę. Klient wybiera produkt, ilość, sposób dostawy i płatności, podaje dane wymagane do realizacji oraz potwierdza zamówienie. Konto klienta jest dobrowolne. Informacja o przyjęciu zamówienia jest wysyłana na wskazany adres e-mail. Umowa sprzedaży zostaje zawarta po potwierdzeniu przyjęcia zamówienia przez sklep.</p>
    <h2>§3 Ceny i płatności</h2><p>Ceny produktów są podawane w złotych polskich i są cenami brutto. Przed złożeniem zamówienia klient widzi łączną cenę produktów, rabaty, koszt dostawy, usługi dodatkowe i opłatę właściwą dla wybranej płatności. Dostępne formy płatności: ${esc(platnosciOpis())}.</p>
    <h2>§4 Dostawa</h2><p>Dostawa jest realizowana przez InPost do wybranego paczkomatu/punktu albo kurierem pod wskazany adres. Deklarowany czas nadania: ${esc(tekstWysylki())} w dni robocze. Aktualny koszt jest zawsze pokazany przed złożeniem zamówienia; darmowa dostawa obowiązuje od ${KONFIG.darmowaDostawaOd} zł, jeśli koszyk spełnia warunki promocji.</p>
    <h2>§5 Odstąpienie od umowy</h2><p>Konsument może odstąpić od umowy zawartej na odległość bez podania przyczyny w ciągu 14 dni od otrzymania towaru. Oświadczenie można przesłać na adres e-mail sklepu. Towar należy odesłać nie później niż 14 dni od złożenia oświadczenia. Sklep zwraca otrzymane płatności, w tym koszt najtańszego zwykłego sposobu dostawy oferowanego dla zamówienia, nie później niż w ciągu 14 dni od otrzymania oświadczenia; zwrot może zostać wstrzymany do chwili otrzymania towaru lub dowodu jego odesłania. Bezpośredni koszt zwykłego zwrotu ponosi konsument. Ustawowe wyjątki od prawa odstąpienia stosuje się tylko w przypadkach przewidzianych prawem.</p>
    <h2>§6 Reklamacje</h2><p>Sprzedawca odpowiada za zgodność towaru z umową na zasadach wynikających z prawa konsumenckiego. Reklamację można przesłać na ${esc(KONFIG.emailSklepu)}, podając dane zamówienia, opis problemu i żądanie. Sklep odpowiada na reklamację konsumenta w terminie 14 dni od jej otrzymania. Koszty uzasadnionej reklamacji towaru niezgodnego z umową ponosi sprzedawca.</p>
    <h2>§7 Dane osobowe i postanowienia końcowe</h2><p>Zasady przetwarzania danych opisuje Polityka prywatności. W sprawach nieuregulowanych stosuje się obowiązujące przepisy prawa polskiego, w szczególności Kodeks cywilny i ustawę o prawach konsumenta. Regulamin jest dostępny nieodpłatnie na stronie sklepu w formie umożliwiającej zapisanie i odtworzenie.</p>`,"regulamin");
}
function widokPrywatnosc(){
  if(KONFIG.tresci?.prywatnosc) return stronaInfo("🔒 Polityka prywatności (RODO)", KONFIG.tresci.prywatnosc,"prywatnosc");
  return stronaInfo("🔒 Polityka prywatności (RODO)", `
    <h2>1. Administrator danych</h2><p>Administratorem danych osobowych jest ${daneFirmyHTML()}. W sprawach dotyczących danych można skontaktować się przez <a href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a> lub ${esc(KONFIG.telefon)}.</p>
    <h2>2. Zakres, cele i podstawy przetwarzania</h2><p>Przetwarzamy dane podane przy zamówieniu: imię i nazwisko, adres, e-mail, telefon, dane dostawy, a przy zakupie firmowym także nazwę firmy i NIP. Dane są potrzebne do zawarcia i wykonania umowy, obsługi płatności, dostawy, kontaktu oraz reklamacji (art. 6 ust. 1 lit. b RODO). Dane wymagane przepisami rachunkowymi i podatkowymi przetwarzamy w celu wykonania obowiązku prawnego (art. 6 ust. 1 lit. c RODO). Dane techniczne, historia obsługi i niezbędne logi mogą być przetwarzane dla bezpieczeństwa, zapobiegania nadużyciom i ochrony roszczeń (art. 6 ust. 1 lit. f RODO).</p>
    <h2>3. Konto klienta</h2><p>Utworzenie konta jest dobrowolne. Hasło jest przechowywane wyłącznie jako odporny kryptograficznie skrót z indywidualną solą; sklep nie przechowuje jego jawnej treści. Sesja konta jest podpisywana przez serwer i ma ograniczony czas ważności.</p>
    <h2>4. Odbiorcy danych</h2><p>Dane otrzymują tylko podmioty niezbędne do realizacji usługi: dostawca hostingu i utrzymania systemu, operator poczty elektronicznej, InPost, wybrany przez klienta operator płatności oraz — gdy jest to potrzebne — dostawca usług księgowych lub fakturowania. Każdy odbiorca otrzymuje wyłącznie zakres potrzebny do wykonania swojego zadania.</p>
    <h2>5. Okres przechowywania</h2><p>Dane zamówień przechowujemy przez okres realizacji umowy, obsługi reklamacji i możliwych roszczeń, a dokumentację wymaganą prawem — przez okres wynikający z przepisów podatkowych i rachunkowych. Dane konta przechowujemy do jego usunięcia, z wyjątkiem danych, które nadal muszą być przechowywane na innej podstawie prawnej. Logi bezpieczeństwa są przechowywane tylko przez czas potrzebny do wykrywania i wyjaśniania zdarzeń.</p>
    <h2>6. Prawa użytkownika</h2><p>Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia oraz wnieść sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie. Masz też prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych. Żądania można wysyłać na ${esc(KONFIG.emailSklepu)}.</p>
    <h2>7. Pamięć przeglądarki i bezpieczeństwo</h2><p>Sklep korzysta z pamięci przeglądarki do zachowania koszyka, ulubionych, ustawień interfejsu, ograniczonego dziennika diagnostycznego i podpisanej sesji konta. Dane konta, profilu i zamówień są synchronizowane z serwerem sklepu, dlatego nie pozostają wyłącznie na urządzeniu. Strona używa wyłącznie mechanizmów koniecznych do działania sklepu; jeśli w przyszłości zostaną włączone narzędzia analityczne lub marketingowe wymagające zgody, zostanie udostępniony osobny wybór zgód.</p>
    <h2>8. Automatyzacja</h2><p>Narzędzia automatyczne i Agent AI mogą przygotowywać administratorowi propozycje operacyjne, ale nie podejmują wobec klienta decyzji wywołujących skutki prawne wyłącznie w sposób zautomatyzowany.</p>`,"prywatnosc");
}
function widokDostawa(){
  const publiczneKody=regulyRabatowe().filter(r=>r.publiczny&&regulaRabatowaStatus(r).aktywna);
  return stronaInfo("🚚 Dostawa i płatności", `
    <h2>Formy dostawy</h2>
    <ul>${dostepneDostawy().map(d=>`<li>${d.nazwa} — ${d.koszt?d.koszt+" zł":"gratis"} (${d.opis})</li>`).join("")}<li><b>Darmowa dostawa InPost</b> przy zamówieniach od ${KONFIG.darmowaDostawaOd} zł</li></ul>
    <p>Przy zamówieniu wybierasz paczkomat/punkt InPost na mapie albo dostawę Kurierem InPost pod adres.</p>
    <p><b>Deklarowany czas nadania:</b> ${esc(czasWysylki())} w dni robocze.</p>
    <h2>Formy płatności</h2>
    <ul>${dostepnePlatnosci().map(p=>`<li>${p.nazwa}${p.oplata?" (+"+p.oplata+" zł)":""}${p.id==="telefon"?` — w tytule wpisz numer zamówienia; numer: ${formatTelefonPlatnosci()}`:""}${p.id==="paynow"?` — bramka mBank Paynow`:""}</li>`).join("")}</ul>
    <h2>Kody rabatowe</h2>
    <p>${publiczneKody.length?`Aktualne kody: ${publiczneKody.map(r=>`<b>${esc(r.kod)}</b> (${r.typ==="darmowa_dostawa"?"darmowa dostawa":r.typ==="kwota"?`−${zl(r.wartosc)}`:`−${Number(r.wartosc)||0}%`})`).join(", ")}. Kod wpisz w koszyku.`:"Aktualne promocje i warunki są zawsze widoczne w koszyku oraz na stronie głównej."}</p>`,"dostawa");
}
function widokZwroty(){
  if(KONFIG.tresci?.zwroty) return stronaInfo("↩️ Zwroty i reklamacje", KONFIG.tresci.zwroty,"zwroty");
  return stronaInfo("↩️ Zwroty i reklamacje", `
    <h2>Zwrot w 14 dni</h2><p>Możesz odstąpić od umowy w ciągu 14 dni od otrzymania przesyłki bez podania przyczyny. Napisz na ${KONFIG.emailSklepu} i odeślij produkt pocztą lub przesyłką kurierską. Przy takim zwrocie bezpośredni koszt odesłania ponosi klient. Nie dołączamy gotowej etykiety zwrotnej.</p>
    <h2>Zwrot pieniędzy</h2><p>Zwrot środków wykonujemy nie później niż w ciągu 14 dni od otrzymania oświadczenia. Możemy wstrzymać zwrot do chwili otrzymania produktu albo przedstawienia potwierdzenia jego odesłania.</p>
    <h2>Wymiana</h2><p>Nie prowadzimy osobnej procedury wymiany. Możesz zwrócić produkt zgodnie z powyższymi zasadami i złożyć nowe zamówienie.</p>
    <h2>Reklamacje</h2><p>Jeśli produkt jest niezgodny z umową, opisz problem i dołącz zdjęcia — odpowiemy w ciągu 14 dni. Uzasadnione koszty odesłania reklamowanego produktu ponosi sprzedawca.</p>`,"zwroty");
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
