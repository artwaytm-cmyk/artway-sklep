function ikonaKategorii(nazwa){
  const mapa = {"Elektronika":"🎧","Dom i ogród":"🏡","Narzędzia":"🧰","Odzież":"🧥","Sport":"🏋️"};
  return mapa[nazwa] || "📦";
}
function ikonaKategoriiHTML(nazwa){const item=(ustawienia.ikonyKategorii||{})[nazwa];return item?.url?`<img src="${esc(item.url)}" alt="" loading="lazy">`:esc(ikonaKategorii(nazwa));}
function opisKategorii(nazwa){
  const mapa = {
    "Elektronika":"Sprzęt i akcesoria do pracy, domu oraz podróży.",
    "Dom i ogród":"Praktyczne wyposażenie do codziennych zastosowań.",
    "Narzędzia":"Rozwiązania do warsztatu, garażu i drobnych napraw.",
    "Odzież":"Wygodne produkty na co dzień i aktywny wypoczynek.",
    "Sport":"Akcesoria do treningu, rekreacji i ruchu na świeżym powietrzu."
  };
  return mapa[nazwa] || "Zobacz wszystkie produkty dostępne w tym katalogu.";
}
function bannerUkrytyPrzezKlienta(id){try{return sessionStorage.getItem(`artway_banner_hidden_${id}`)==="1";}catch(e){return false;}}
function zamknijBannerSklepu(event,id){event.preventDefault();event.stopPropagation();try{sessionStorage.setItem(`artway_banner_hidden_${id}`,"1");}catch(e){}event.currentTarget.closest(".managed-banner-shell")?.remove();}
function bannerSklepuHTML(b){
  const n=normalizujBaner(b),type=esc(n.typ),width=esc(n.szerokosc),height=esc(n.wysokosc),mobile=esc(n.mobileMode);
  const shade=Math.max(0,Math.min(90,Number(n.przyciemnienie)||68))/100,fx=Number(n.focalX),fy=Number(n.focalY),x=Number.isFinite(fx)?Math.max(0,Math.min(100,fx)):50,y=Number.isFinite(fy)?Math.max(0,Math.min(100,fy)):50,position=`${x}% ${y}%`,direction=n.kierunekNakladki==="prawo"?"270deg":n.kierunekNakladki==="dookola"?"135deg":"90deg";
  const content=Math.max(30,Math.min(100,Number(n.szerokoscTresci)||62)),padding=Math.max(8,Math.min(48,Number(n.odstep)||18)),radius=Math.max(0,Math.min(40,Number(n.promien)||14));
  return `<article class="managed-banner-shell banner-type-${type} banner-width-${width} banner-height-${height} banner-mobile-${mobile} ${n.przyklejony?"is-sticky":""}">
    <a class="managed-banner ${n.obraz?'ma-obraz':''} banner-${esc(n.styl||"karta")} align-${esc(n.wyrownanie||"lewo")} audience-${esc(n.odbiorcy||"wszyscy")} anim-${esc(n.animacja||"brak")}" href="${esc(bezpiecznyLink(n.link))}" ${n.obraz?`aria-label="${esc(n.obrazAlt||n.tytul||"Banner")}" style="background-image:linear-gradient(${direction},rgba(15,18,25,${shade}),rgba(15,18,25,${Math.max(.08,shade-.42)})),url('${esc(n.obraz)}');background-position:${position};--banner-content:${content}%;--banner-padding:${padding}px;--banner-radius:${radius}px"`:`style="--banner-content:${content}%;--banner-padding:${padding}px;--banner-radius:${radius}px"`}>
      ${n.obraz?"":`<span class="banner-icon">${esc(n.ikona||"📣")}</span>`}
      <span class="managed-banner-content">${n.etykieta?`<em class="managed-banner-badge">${esc(n.etykieta)}</em>`:""}<h3>${esc(n.tytul||"")}</h3><p>${esc(n.opis||"")}</p>${n.kodRabatowy?`<strong class="managed-banner-code">Kod: ${esc(n.kodRabatowy)}</strong>`:""}<small class="managed-banner-cta cta-${esc(n.stylPrzycisku||"pelny")}">${esc(n.przycisk||"Dowiedz się więcej")} →</small></span>
    </a>${n.zamykany?`<button class="managed-banner-close" type="button" aria-label="Zamknij banner" onclick="zamknijBannerSklepu(event,${jsArg(n.id)})">×</button>`:""}
  </article>`;
}
function banneryHome(miejsce="sekcja-banery"){
  const teraz=Date.now();
  const lista=pobierzBannery().filter(b=>{
    if(b.aktywny===false)return false;
    const start=b.start?Date.parse(b.start):NaN,koniec=b.koniec?Date.parse(b.koniec):NaN;
    return b.umiejscowienie===miejsce&&!bannerUkrytyPrzezKlienta(b.id)&&(!Number.isFinite(start)||teraz>=start)&&(!Number.isFinite(koniec)||teraz<=koniec);
  });
  if(!lista.length) return "";
  return `<section class="managed-banners banner-placement-${esc(miejsce)}" aria-label="Bannery promocyjne">${lista.map(bannerSklepuHTML).join("")}</section>`;
}
/* ── Sekcje strony głównej: kolejność i widoczność ustawiane wizualnie
      w Panel admina → Personalizacja → 🧭 Rozmieszczenie ── */
const SEKCJE_GLOWNEJ = {
  hero:       { nazwa:"Baner główny (hero)",         ikona:"🖼️" },
  banery:     { nazwa:"Banery promocyjne",           ikona:"📣" },
  kategorie:  { nazwa:"Kafelki katalogów",           ikona:"🗂️" },
  produkty:   { nazwa:"Cała oferta (lista produktów)",ikona:"🏷️" },
  pasekOferty:{ nazwa:"Pasek okazji (kod rabatowy)", ikona:"🎁" },
  zalety:     { nazwa:"Zalety sklepu",               ikona:"🚀" },
  kroki:      { nazwa:"Jak kupić — 4 kroki",         ikona:"🧭" },
  onas:       { nazwa:"O sklepie + pomoc",           ikona:"🏪" },
  faq:        { nazwa:"Najczęstsze pytania",         ikona:"❓" },
  kontakt:    { nazwa:"Końcowa sekcja kontaktu",     ikona:"💬" }
};
const DOMYSLNA_KOLEJNOSC_SEKCJI = ["hero","banery","produkty","kategorie","pasekOferty","zalety","kroki","onas","faq","kontakt"];
function kolejnoscSekcji(){
  const zap = Array.isArray(ustawienia.kolejnoscSekcji) ? ustawienia.kolejnoscSekcji.filter(id=>SEKCJE_GLOWNEJ[id]) : [];
  const wynik=[...zap, ...DOMYSLNA_KOLEJNOSC_SEKCJI.filter(id=>!zap.includes(id))],produktyIndex=wynik.indexOf("produkty"),kategorieIndex=wynik.indexOf("kategorie");
  if(produktyIndex>=0&&kategorieIndex>=0&&kategorieIndex<produktyIndex){wynik.splice(kategorieIndex,1);wynik.splice(wynik.indexOf("produkty")+1,0,"kategorie");}
  return wynik;
}
function sekcjaWidoczna(id){
  if((ustawienia.sekcjeUkryte||[]).includes(id)) return false;
  const u = ustawienia.uklad || {};
  const flagi = { kategorie:"sekcjaKategorie", kroki:"sekcjaKroki", onas:"sekcjaOnas", faq:"sekcjaFaq", kontakt:"sekcjaKontakt" };
  if(flagi[id] && u[flagi[id]]===false) return false;
  return true;
}
function widokSklep(){
  const kategorie = wszystkieKategorie();
  const drzewoKategorii=indeksDrzewaKategoriiMenu(kategorie),kategorieGlowne=drzewoKategorii.roots;
  const publiczneProdukty=produkty.filter(produktWidocznyWPublicznymKatalogu),centralSummary=(typeof sklepKatalogCentralnyPodsumowanie!=="undefined"?sklepKatalogCentralnyPodsumowanie:{});
  const liczbaPublicznych=chmuraKatalogCentralnyPubliczny&&Number.isFinite(Number(centralSummary.total))?Number(centralSummary.total):publiczneProdukty.length;
  const promki = chmuraKatalogCentralnyPubliczny?Number(centralSummary.promotions)||0:publiczneProdukty.filter(p=>p.staraCena).length;
  const nowosci = chmuraKatalogCentralnyPubliczny?Number(centralSummary.new_products)||0:publiczneProdukty.filter(p=>p.badge==="Nowość").length;
  const widoczneSekcje=kolejnoscSekcji().filter(sekcjaWidoczna);
  const heroMaNaglowekGlowny=widoczneSekcje.includes("hero");
  const ofertaMaNaglowekGlowny=!heroMaNaglowekGlowny&&widoczneSekcje.includes("produkty");
  const awaryjnyNaglowekGlowny=!heroMaNaglowekGlowny&&!ofertaMaNaglowekGlowny
    ?`<h1 class="sr-only home-canonical-title">Gry, zabawki i artykuły imprezowe — Artway-TM</h1>`
    :"";
  const hero = ustawienia.hero || {},oferta=ustawieniaOfertyGlownej(),heroFx=Number(hero.focalX),heroFy=Number(hero.focalY),heroX=Number.isFinite(heroFx)?Math.max(0,Math.min(100,heroFx)):50,heroY=Number.isFinite(heroFy)?Math.max(0,Math.min(100,heroFy)):50,heroShade=Math.max(0,Math.min(90,Number(hero.przyciemnienie)||76))/100,heroMin=hero.wysokosc==="niski"?280:hero.wysokosc==="wysoki"?460:360;
  const SEKCJE = {};
  SEKCJE.hero = () => `${banneryHome("nad-hero")}
  <section class="hero hero-mobile-${esc(hero.mobileMode||"kompaktowy")}">
    <div class="hero-in hero-align-${esc(hero.wyrownanie||"lewo")}" style="min-height:${heroMin}px;${hero.obraz?`background-image:linear-gradient(120deg,rgba(30,41,59,${heroShade}),rgba(49,46,129,${Math.max(.22,heroShade-.25)}) 60%,rgba(91,33,182,${Math.max(.15,heroShade-.35)})),url('${esc(hero.obraz)}');background-position:${heroX}% ${heroY}%;background-size:cover`:""}">
      <span class="hero-eyebrow">${esc(hero.etykieta||"ARTWAY-TM • ZAKUPY PROSTO I WYGODNIE")}</span>
      <h1>${esc(KONFIG.heroTytul)}</h1>
      <p>${esc(KONFIG.heroOpis)}</p>
      <div class="hero-actions">
        <a href="${esc(bezpiecznyLink(hero.link1||"#produkty"))}" ${String(hero.link1||"#produkty")==="#produkty"?`onclick="document.querySelector('.catalog-head')?.scrollIntoView({behavior:'smooth'});return false;"`:""}>${esc(hero.przycisk1||"Zobacz ofertę")} ↓</a>
        <a class="hero-link-alt" href="${esc(bezpiecznyLink(hero.link2||"#/promocje"))}">${esc(hero.przycisk2||"Sprawdź promocje")}</a>
      </div>
      <div class="hero-meta">
        <div><b>${liczbaPublicznych} produktów</b><small>w aktualnej ofercie</small></div>
        <div><b>${kategorie.length} katalogów</b><small>łatwe przeglądanie</small></div>
        <div><b>14 dni</b><small>na wygodny zwrot</small></div>
        <div><b>od ${KONFIG.darmowaDostawaOd} zł</b><small>darmowa dostawa</small></div>
      </div>
    </div>
  </section>${banneryHome("pod-hero")}`;
  SEKCJE.banery = () => banneryHome("sekcja-banery");
  SEKCJE.kategorie = () => `
  <section class="home-section home-categories">
    <div class="section-head">
      <div><h2>Znajdź to, czego szukasz</h2><p>Przejdź od razu do wybranego katalogu i zobacz produkty dopasowane do Twoich potrzeb.</p></div>
      <a href="#produkty" onclick="document.querySelector('.catalog-head')?.scrollIntoView({behavior:'smooth'});return false;">Cała oferta →</a>
    </div>
    <div class="category-grid">
      ${(Array.isArray(oferta.kategorie)&&oferta.kategorie.length?kategorie.filter(k=>oferta.kategorie.includes(k)):kategorieGlowne).map(k=>`
        <a class="category-tile" href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">
          <span class="category-ico">${ikonaKategoriiHTML(k)}</span>
          <b>${esc(k)}</b>
          <p>${esc(opisKategorii(k))}</p>
          <small>${drzewoKategorii.branchCounts[k]||0} produktów${(drzewoKategorii.children.get(k)||[]).length?` • ${(drzewoKategorii.children.get(k)||[]).length} gałęzi`:""} →</small>
        </a>`).join("")}
    </div>
  </section>`;
  SEKCJE.produkty = () => `${banneryHome("nad-produktami")}
  <div class="catalog-head" id="produkty">
    <div class="section-head">
      <div><${ofertaMaNaglowekGlowny?"h1":"h2"}>${esc(String(oferta.tytul||"").trim()||"Cała oferta")}</${ofertaMaNaglowekGlowny?"h1":"h2"}><p>${esc(oferta.opis||"")}</p></div>
      ${oferta.liczniki===false?"":`<span style="font-size:.85rem;color:var(--muted2)">${promki} promocji • ${nowosci} nowości</span>`}
    </div>
  </div>
  <div class="toolbar">
    ${oferta.wyborDzialu==="nad-produktami"?`<div id="chips" class="home-category-chips"></div>`:""}
    <select id="sortSelect" onchange="sortowanie=this.value;stronaProduktow=1;rysuj()" aria-label="Sortowanie">
      <option value="default" ${sortowanie==="default"?"selected":""}>Sortuj: domyślnie</option>
      <option value="price-asc" ${sortowanie==="price-asc"?"selected":""}>Cena: od najniższej</option>
      <option value="price-desc" ${sortowanie==="price-desc"?"selected":""}>Cena: od najwyższej</option>
      <option value="name" ${sortowanie==="name"?"selected":""}>Nazwa: A–Z</option>
      <option value="rating" ${sortowanie==="rating"?"selected":""}>Najlepiej oceniane</option>
      <option value="newest" ${sortowanie==="newest"?"selected":""}>Najnowsze</option>
    </select>
  </div>
  <div class="catalog-tools" ${oferta.filtryZaawansowane===false?`style="display:none"`:""}>
    <details class="advanced-search" ${(cenaOd||cenaDo||filtrDostepnosci!=="wszystkie"||filtrOferty!=="wszystkie"||filtrOceny!=="0")?"open":""}>
      <summary>🔎 Zaawansowane wyszukiwanie i filtry</summary>
      <div class="filter-grid">
        <label>Cena od (zł)<input type="number" min="0" step=".01" value="${esc(cenaOd)}" oninput="cenaOd=this.value;stronaProduktow=1;rysuj()" placeholder="0"></label>
        <label>Cena do (zł)<input type="number" min="0" step=".01" value="${esc(cenaDo)}" oninput="cenaDo=this.value;stronaProduktow=1;rysuj()" placeholder="bez limitu"></label>
        <label>Dostępność<select onchange="filtrDostepnosci=this.value;stronaProduktow=1;rysuj()"><option value="wszystkie">Wszystkie</option><option value="dostepne" ${filtrDostepnosci==="dostepne"?"selected":""}>Dostępne w sprzedaży</option><option value="brak" ${filtrDostepnosci==="brak"?"selected":""}>Chwilowo niedostępne</option></select></label>
        <label>Rodzaj oferty<select onchange="filtrOferty=this.value;stronaProduktow=1;rysuj()"><option value="wszystkie">Wszystkie</option><option value="promocje" ${filtrOferty==="promocje"?"selected":""}>Promocje</option><option value="nowosci" ${filtrOferty==="nowosci"?"selected":""}>Nowości</option></select></label>
        <label>Minimalna ocena<select onchange="filtrOceny=this.value;stronaProduktow=1;rysuj()"><option value="0">Dowolna</option><option value="3" ${filtrOceny==="3"?"selected":""}>3★ i więcej</option><option value="4" ${filtrOceny==="4"?"selected":""}>4★ i więcej</option><option value="4.5" ${filtrOceny==="4.5"?"selected":""}>4,5★ i więcej</option></select></label>
      </div>
      <button class="btn ghost" style="margin-top:.65rem" onclick="wyczyscFiltryProduktow()">Wyczyść filtry</button>
    </details>
  </div>
  <div class="results-bar"><span id="wynikowProdukty"></span><label>Na stronie: <select onchange="ustawProduktyNaStronie(this.value)">${[12,24,48,96].map(n=>`<option value="${n}" ${produktyNaStronie===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
  <div class="pagination" id="paginacjaGora"></div>
  <div class="grid" id="grid"></div>
  <div class="pagination" id="paginacjaDol"></div>
  ${oferta.wyborDzialu!=="ukryty"&&oferta.wyborDzialu!=="nad-produktami"?`<div class="home-department-picker"><span>Wybierz dział oferty</span><div id="chips" class="home-category-chips"></div></div>`:""}${banneryHome("pod-produktami")}`;
  SEKCJE.pasekOferty = () => { const o = ustawienia.pasekOkazji || {},promo=glownaPromocja(),kod=o.kodRabatowy||promo?.kod||"",fx=Number(o.focalX),fy=Number(o.focalY),x=Number.isFinite(fx)?Math.max(0,Math.min(100,fx)):50,y=Number.isFinite(fy)?Math.max(0,Math.min(100,fy)):50,shade=Math.max(0,Math.min(90,Number(o.przyciemnienie)||72))/100,min=o.wysokosc==="niski"?90:o.wysokosc==="wysoki"?190:130; return `
  <section class="offer-band offer-band-${esc(o.mobileMode||"kompaktowy")} ${o.przyklejony?"offer-band-sticky":""}">
    <div class="offer-band-in" style="min-height:${min}px;${o.obraz?`background-image:linear-gradient(90deg,rgba(30,41,59,${shade}),rgba(49,46,129,${Math.max(.18,shade-.28)})),url('${esc(o.obraz)}');background-position:${x}% ${y}%;background-size:cover`:""}">
      <span class="offer-band-icon">${esc(o.ikona||"🎁")}</span><div>${o.etykieta?`<small>${esc(o.etykieta)}</small>`:""}<h2>${esc(o.tytul||"Dobry moment na zakupy")}</h2><p>${o.opis?esc(o.opis):(kod?`Użyj kodu <b>${esc(kod)}</b>${promo?.procent?` w koszyku i odbierz ${esc(promo.procent)}% rabatu na zamówienie.`:" w koszyku."}`:"Sprawdź aktualne okazje i produkty w dobrych cenach.")}</p></div>
      <a href="${esc(bezpiecznyLink(o.link||"#/promocje"))}">${esc(o.tekstLinku||"Zobacz okazje")} →</a>
    </div>
  </section>`; };
  SEKCJE.zalety = () => `
  <section class="perks">
    <div class="perk"><span class="ico">🚀</span><div><b>Szybka wysyłka</b><small>${esc(tekstWysylki("Nadanie w"))} w dni robocze</small></div></div>
    <div class="perk"><span class="ico">🔒</span><div><b>Wygodne płatności</b><small>mBank Paynow, pobranie i przelew na telefon</small></div></div>
    <div class="perk"><span class="ico">↩️</span><div><b>Łatwe zwroty</b><small>14 dni na zwrot bez podania przyczyny</small></div></div>
    <div class="perk"><span class="ico">💬</span><div><b>Pomoc przed zakupem</b><small>${esc(KONFIG.emailSklepu)}</small></div></div>
  </section>`;
  SEKCJE.kroki = () => `
  <section class="home-section home-steps">
    <div class="section-head">
      <div><h2>Jak kupić w Artway-TM?</h2><p>Cały proces jest przejrzysty — od znalezienia produktu do odbioru przesyłki.</p></div>
    </div>
    <div class="steps">
      <div class="step"><span class="step-no">1</span><b>Wybierz produkt</b><p>Skorzystaj z katalogów, wyszukiwarki, filtrów i listy ulubionych.</p></div>
      <div class="step"><span class="step-no">2</span><b>Dodaj do koszyka</b><p>Ustaw liczbę sztuk, wpisz kod rabatowy i sprawdź podsumowanie.</p></div>
      <div class="step"><span class="step-no">3</span><b>Podaj dane</b><p>Wybierz dostawę oraz płatność. Koszt zobaczysz przed zatwierdzeniem.</p></div>
      <div class="step"><span class="step-no">4</span><b>Odbierz zamówienie</b><p>Przesyłkę wyślemy wybraną metodą na wskazany przez Ciebie adres.</p></div>
    </div>
  </section>`;
  SEKCJE.onas = () => `
  <section class="home-section home-about">
    <div class="about-grid">
      <div class="about-card">
        <h2>Zakupy bez zbędnych komplikacji</h2>
        <p>Artway-TM łączy różne kategorie w jednym miejscu. Stawiamy na czytelną ofertę, jasne koszty i łatwy kontakt na każdym etapie zamówienia.</p>
        <div class="check-list">
          <div class="check-item"><span>✓</span><div><b>Jasne ceny</b><br>Podsumowanie przed złożeniem zamówienia.</div></div>
          <div class="check-item"><span>✓</span><div><b>Dostawa InPost</b><br>Paczkomat/punkt InPost albo Kurier InPost pod wskazany adres.</div></div>
          <div class="check-item"><span>✓</span><div><b>Zakupy z kontem lub bez</b><br>Ty decydujesz, jak chcesz zamówić.</div></div>
          <div class="check-item"><span>✓</span><div><b>Pomoc po zakupie</b><br>Informacje o zwrotach i reklamacjach.</div></div>
        </div>
        <p style="margin-top:1.2rem"><a class="btn ghost" href="#/o-nas">Poznaj Artway-TM →</a></p>
      </div>
      <div class="support-card">
        <div><span style="font-size:2rem">💬</span><h2>Potrzebujesz pomocy?</h2><p>Napisz do nas, jeśli chcesz dopytać o produkt, dostawę, płatność albo swoje zamówienie.</p></div>
        <a href="#/kontakt">Przejdź do kontaktu →</a>
      </div>
    </div>
  </section>`;
  SEKCJE.faq = () => `
  <section class="home-section home-faq">
    <div class="section-head">
      <div><h2>Najczęstsze pytania</h2><p>Najważniejsze informacje zebrane w jednym miejscu.</p></div>
      <a href="#/faq">Zobacz wszystkie →</a>
    </div>
    <div class="faq-list">
      <details><summary>Ile trwa realizacja zamówienia?</summary><p>Zamówienia przygotowujemy do wysyłki w dni robocze. Standardowy deklarowany czas nadania to ${esc(czasWysylki())}.</p></details>
      <details><summary>Kiedy dostawa jest darmowa?</summary><p>Dostawa InPost jest darmowa, gdy wartość produktów po rabacie wynosi co najmniej ${KONFIG.darmowaDostawaOd} zł.</p></details>
      <details><summary>Jak zwrócić produkt?</summary><p>Na odstąpienie od umowy masz 14 dni od odbioru. Napisz na ${esc(KONFIG.emailSklepu)}, a otrzymasz dalsze instrukcje.</p></details>
    </div>
  </section>`;
  SEKCJE.kontakt = () => `${banneryHome("przed-stopka")}
  <section class="home-section home-contact">
    <div class="contact-strip">
      <div><h2>Zostało pytanie?</h2><p>Skontaktuj się z nami — odpowiadamy w dni robocze.</p></div>
      <div class="contact-strip-actions">
        <a class="btn" href="#/kontakt">Napisz wiadomość</a>
        <a class="btn ghost" href="mailto:${esc(KONFIG.emailSklepu)}">${esc(KONFIG.emailSklepu)}</a>
      </div>
    </div>
  </section>`;
  return awaryjnyNaglowekGlowny+widoczneSekcje.map(id => SEKCJE[id] ? SEKCJE[id]() : "").join("\n");
}
