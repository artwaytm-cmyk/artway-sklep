/* ═══════════ ZAMÓWIENIE — system dostawy i płatności ═══════════
   Dostawy i płatności konfigurujesz w KONFIG (góra pliku).
   „Za pobraniem” działa od razu — bez umów z bramkami płatności.
   Koszty przeliczają się na żywo przy zmianie opcji.             */
function kosztDostawyDlaKwoty(idDostawy, kwotaProdukow=sumaPoRabacie()){
  const d = dostepneDostawy().find(x=>x.id===idDostawy) || dostepneDostawy()[0];
  const wynik=wynikRegulyRabatowej(aktywnaRegulaRabatowa());
  if(wynik.ok&&wynik.darmowaDostawa)return 0;
  if(d.koszt>0 && kwotaNum(kwotaProdukow)>=KONFIG.darmowaDostawaOd) return 0;
  return kwotaNum(d.koszt);
}
function kosztDostawy(idDostawy){
  return kosztDostawyDlaKwoty(idDostawy, sumaPoRabacie());
}
function oplataPlatnosci(idPlat){
  const p = KONFIG.platnosci.find(x=>x.id===idPlat);
  return p ? kwotaNum(p.oplata) : 0;
}
function kosztyZamowienia(z){
  const k=z?.koszty||{}, ma=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key)&&obj[key]!=null;
  const pozycje=Array.isArray(z?.pozycjeDane)?z.pozycjeDane:[];
  const produktyZPozycji=pozycje.reduce((s,p)=>s+kwotaNum(p.wartosc || (kwotaNum(p.cena)*(Number(p.ilosc)||1))),0);
  const metoda=z?.dostawaId || (czyZamowieniePaczkomat(z)?"paczkomat":"kurier_inpost");
  const weekendAktywny=!!(z?.paczkaWeekend || z?.wysylka?.paczkaWeekend);
  const weekend=kwotaNum(ma(z,"oplataPaczkaWeekend")?z.oplataPaczkaWeekend:(ma(k,"paczkaWeekend")?k.paczkaWeekend:oplataPaczkaWeekend(weekendAktywny)));
  const platnosc=kwotaNum(ma(z,"oplataPlatnosci")?z.oplataPlatnosci:(ma(k,"platnosc")?k.platnosc:oplataPlatnosci(z?.platnoscId)));
  const dostawaZapisana=ma(z,"dostawaKoszt")||ma(k,"dostawa");
  const dostawa=dostawaZapisana ? kwotaNum(ma(z,"dostawaKoszt")?z.dostawaKoszt:k.dostawa) : kosztDostawyDlaKwoty(metoda, ma(k,"poRabacie")?k.poRabacie:produktyZPozycji);
  const razemZapisane=kwotaNum(z?.razem);
  let poRabacie=ma(k,"poRabacie") ? kwotaNum(k.poRabacie) : 0;
  if(!poRabacie && razemZapisane) poRabacie=Math.max(0, kwotaNum(razemZapisane-dostawa-weekend-platnosc));
  const produkty=ma(k,"produkty") ? kwotaNum(k.produkty) : (produktyZPozycji || poRabacie);
  const rabat=ma(k,"rabat") ? kwotaNum(k.rabat) : Math.max(0, kwotaNum(produkty-poRabacie));
  if(!poRabacie) poRabacie=Math.max(0, kwotaNum(produkty-rabat));
  const razem=razemZapisane || kwotaNum(poRabacie+dostawa+weekend+platnosc);
  return {produkty,rabat,poRabacie,dostawa,paczkaWeekend:weekend,platnosc,razem,metoda,weekendAktywny:weekend>0||weekendAktywny};
}
function zapiszKosztyZamowienia(z, zmiany={}){
  const c=kosztyZamowienia(z);
  const metoda=zmiany.dostawaId || z?.dostawaId || c.metoda || "paczkomat";
  const weekendAktywny=Object.prototype.hasOwnProperty.call(zmiany,"paczkaWeekend") ? !!zmiany.paczkaWeekend : c.weekendAktywny;
  const dostawa=kosztDostawyDlaKwoty(metoda, c.poRabacie);
  const weekend=oplataPaczkaWeekend(weekendAktywny);
  const razem=kwotaNum(c.poRabacie+dostawa+weekend+c.platnosc);
  z.dostawaKoszt=dostawa;
  z.oplataPaczkaWeekend=weekend;
  z.oplataPlatnosci=c.platnosc;
  z.paczkaWeekend=weekendAktywny;
  z.koszty={...(z.koszty||{}),produkty:c.produkty,rabat:c.rabat,poRabacie:c.poRabacie,dostawa,paczkaWeekend:weekend,platnosc:c.platnosc,razem};
  z.razem=razem;
  return z.koszty;
}
function podsumowanieKosztowHTML(z, podpisRazem="Razem"){
  const c=kosztyZamowienia(z);
  return `${c.produkty?`<div><span>Produkty</span><span>${zl(c.produkty)}</span></div>`:""}
    ${c.rabat?`<div><span>Rabat</span><span>−${zl(c.rabat)}</span></div><div><span>Po rabacie</span><span>${zl(c.poRabacie)}</span></div>`:""}
    <div><span>Dostawa</span><span>${c.dostawa?zl(c.dostawa):"GRATIS"}</span></div>
    ${c.paczkaWeekend?`<div><span>Paczka w Weekend</span><span>${zl(c.paczkaWeekend)}</span></div>`:""}
    ${c.platnosc?`<div><span>Opłata płatności / pobrania</span><span>${zl(c.platnosc)}</span></div>`:""}
    <div class="sum-total"><span>${esc(podpisRazem)}</span><span>${zl(c.razem)}</span></div>`;
}
function podsumowanieKosztowTekst(z){
  const c=kosztyZamowienia(z);
  return [
    `Produkty: ${zl(c.produkty || c.poRabacie)}`,
    c.rabat ? `Rabat: -${zl(c.rabat)}` : "",
    `Dostawa: ${c.dostawa?zl(c.dostawa):"GRATIS"} (${z?.dostawa||"—"})`,
    c.paczkaWeekend ? `Paczka w Weekend: ${zl(c.paczkaWeekend)}` : "",
    c.platnosc ? `Opłata płatności / pobrania: ${zl(c.platnosc)}` : "",
    `Razem do zapłaty: ${zl(c.razem)}`
  ].filter(Boolean).join("\n");
}
function dostepnePlatnosci(){
  KONFIG.platnosci = normalizujPlatnosci(KONFIG.platnosci);
  return KONFIG.platnosci.filter(p => !p.wylaczona && (p.id!=="paynow"||czyPaynowDostepnyPublicznie()));
}
function formatujKod(el){
  const c = el.value.replace(/[^0-9]/g,"").slice(0,5);
  el.value = c.length>2 ? c.slice(0,2)+"-"+c.slice(2) : c;
}
function walidujNip(nip){
  const c = String(nip||"").replace(/[^0-9]/g,"");
  if(c.length!==10) return false;
  const wagi = [6,5,7,2,3,4,5,6,7];
  const suma = wagi.reduce((s,w,i)=>s+w*+c[i],0);
  return suma%11!==10 && suma%11===+c[9];
}
function przelaczFirme(chk){
  const b = $("firmaBox"); if(b) b.style.display = chk.checked ? "" : "none";
  chk.form.firma.required = chk.form.nip.required = chk.checked;
}
function przelaczKonto(chk){
  const b = $("kontoBox"); if(b) b.style.display = chk.checked ? "" : "none";
  chk.form.haslo.required = chk.checked;
  chk.form.haslo2.required = chk.checked;
}
/* Pobieranie danych firmy z NIP — oficjalny, darmowy rejestr VAT
   Ministerstwa Finansów (wl-api.mf.gov.pl). Wymaga internetu;
   gdy się nie uda, klient uzupełnia dane ręcznie.               */
/* Wspólne pobieranie danych firmy z rejestru VAT (checkout, kartoteka klienta, konto) */
async function pobierzDaneFirmy(nip){
  nip = String(nip||"").replace(/[^0-9]/g,"");
  if(!walidujNip(nip)) return {blad:"Wpisz poprawny NIP (10 cyfr)"};
  try{
    const dzis = new Date().toISOString().slice(0,10);
    const r = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${dzis}`);
    if(!r.ok) throw new Error("HTTP "+r.status);
    const s = (await r.json())?.result?.subject;
    if(!s) throw new Error("nie znaleziono firmy w rejestrze VAT");
    const adr = s.workingAddress || s.residenceAddress || "";
    const m = adr.match(/^(.*?),\s*(\d{2}-\d{3})\s+(.*)$/);
    let ulica="", nrDomu="", kod="", miasto="";
    if(m){
      const ul = m[1].replace(/^UL\.\s*/i,"");
      const um = ul.match(/^(.*?)\s+([\d\/A-Za-z]+)$/);
      ulica = um ? um[1] : ul; nrDomu = um ? um[2] : "";
      kod = m[2]; miasto = m[3];
    }
    loguj("info","Pobrano dane firmy z NIP "+nip+": "+(s.name||"").slice(0,60));
    return { nazwa:s.name||"", nip, ulica, nrDomu, kod, miasto };
  }catch(e){
    loguj("ostrzezenie","Pobieranie danych z NIP nie powiodło się: "+e.message);
    return {blad:"Nie udało się pobrać danych z rejestru — uzupełnij ręcznie"};
  }
}
/* wypełnia pola formularza (po atrybucie name) danymi z rejestru */
async function nipDoFormularza(form, przycisk){
  if(!form) return;
  if(przycisk){ przycisk.disabled=true; przycisk.textContent="⏳ Pobieram…"; }
  const d = await pobierzDaneFirmy(form.nip.value);
  if(przycisk){ przycisk.disabled=false; przycisk.textContent="⬇️ Pobierz dane z NIP"; }
  if(d.blad){ toast("⚠️ "+d.blad); return; }
  if(form.firma) form.firma.value = d.nazwa;
  if(form.ulica && !form.ulica.value){ form.ulica.value=d.ulica; if(form.nrDomu) form.nrDomu.value=d.nrDomu;
    if(form.kod) form.kod.value=d.kod; if(form.miasto) form.miasto.value=d.miasto; }
  toast("✅ Pobrano: "+d.nazwa.slice(0,40));
}
async function pobierzDaneZNip(){
  await nipDoFormularza($("orderForm"), $("nipBtn"));
}
function otworzModal(){
  const brakujace=koszyk.filter(x=>!produkty.some(p=>String(p.id)===String(x.id)));
  if(brakujace.length){
    koszyk=koszyk.filter(x=>produkty.some(p=>String(p.id)===String(x.id)));
    zapiszLS("artway_koszyk",koszyk);odswiezKoszyk();
    loguj("ostrzezenie",`Usunięto z koszyka ${brakujace.length} nieaktualnych pozycji przed otwarciem zamówienia`);
    toast(brakujace.length===1?"Usunięto z koszyka produkt, który nie jest już dostępny":"Usunięto z koszyka nieaktualne produkty");
  }
  if(!koszyk.length){zamknijKoszyk();return;}
  zamknijKoszyk();
  window.__paczkomatAdres="";
  const profil = sesja ? (pobierzProfil(sesja.email)||{}) : {};
  const czesci = (sesja?.imie||"").split(" ");
  const imieS = czesci[0]||"", nazwiskoS = czesci.slice(1).join(" ");
  const maFirme = !!(profil.nip && profil.firma);
  $("modalBox").innerHTML = `
    <button type="button" class="modal-close" onclick="zamknijModalCheckout()" aria-label="Zamknij formularz zamówienia">✕</button>
    <h2 id="checkoutTitle">Dane do zamówienia</h2>
    <p class="sub">Pola z * są wymagane. Koszty przeliczają się automatycznie.${sesja&&(profil.ulica||profil.telefon)?" Dane wstawiono z Twojego profilu.":""}</p>
    <form id="orderForm" onsubmit="zlozZamowienie(event)">
      <h3 class="f-sekcja">👤 Dane kontaktowe</h3>
      <div class="f-row">
        <div class="f-group"><label>Imię *</label><input required name="imie" autocomplete="given-name" value="${esc(imieS)}"></div>
        <div class="f-group"><label>Nazwisko *</label><input required name="nazwisko" autocomplete="family-name" value="${esc(nazwiskoS)}"></div>
      </div>
      <div class="f-row">
        <div class="f-group"><label>Telefon *</label><input required name="phone" type="tel" pattern="[0-9+\\- ]{9,15}" placeholder="np. 600 100 200" autocomplete="tel" value="${esc(profil.telefon||"")}"></div>
        <div class="f-group"><label>E-mail *</label><input required name="email" type="email" autocomplete="email" value="${sesja?esc(sesja.email):""}"></div>
      </div>
      <h3 class="f-sekcja">📍 Adres dostawy</h3>
      <div class="f-row" style="grid-template-columns:2fr 1fr 1fr">
        <div class="f-group"><label>Ulica *</label><input required name="ulica" autocomplete="address-line1" value="${esc(profil.ulica||"")}"></div>
        <div class="f-group"><label>Nr domu *</label><input required name="nrDomu" value="${esc(profil.nrDomu||"")}"></div>
        <div class="f-group"><label>Nr lokalu</label><input name="nrLokalu" value="${esc(profil.nrLokalu||"")}"></div>
      </div>
      <div class="f-row" style="grid-template-columns:1fr 2fr">
        <div class="f-group"><label>Kod pocztowy *</label><input required name="kod" placeholder="00-000" maxlength="6" pattern="\\d{2}-\\d{3}" oninput="formatujKod(this)" autocomplete="postal-code" value="${esc(profil.kod||"")}"></div>
        <div class="f-group"><label>Miejscowość *</label><input required name="miasto" autocomplete="address-level2" value="${esc(profil.miasto||"")}"></div>
      </div>
      <label class="chk-row"><input type="checkbox" name="firmaChk" onchange="przelaczFirme(this)" ${maFirme?"checked":""}> 🧾 Kupuję jako firma (faktura VAT)</label>
      <div id="firmaBox" style="display:${maFirme?"block":"none"}">
        <div class="f-row" style="grid-template-columns:1fr auto;align-items:end">
          <div class="f-group"><label>NIP *</label><input name="nip" placeholder="10 cyfr" maxlength="13" inputmode="numeric" ${maFirme?"required":""} value="${esc(profil.nip||"")}"></div>
          <div class="f-group"><button type="button" class="btn ghost" id="nipBtn" onclick="pobierzDaneZNip()">⬇️ Pobierz dane z NIP</button></div>
        </div>
        <div class="f-group"><label>Nazwa firmy *</label><input name="firma" autocomplete="organization" ${maFirme?"required":""} value="${esc(profil.firma||"")}"></div>
      </div>
      ${sesja ? `
      <label class="chk-row"><input type="checkbox" name="zapamietaj" checked> 💾 Zapamiętaj te dane w moim profilu (następne zamówienia wypełnią się same)</label>` : `
      <label class="chk-row"><input type="checkbox" name="kontoChk" onchange="przelaczKonto(this)"> ✨ Załóż mi od razu konto (historia zamówień i szybsze zakupy)</label>
      <div id="kontoBox" style="display:none">
        <div class="f-group"><label>Hasło do konta * (min. 6 znaków)</label><input name="haslo" type="password" minlength="6" autocomplete="new-password"></div>
        <div class="f-group"><label>Powtórz hasło do konta *</label><input name="haslo2" type="password" minlength="6" autocomplete="new-password"></div>
      </div>`}
      <h3 class="f-sekcja">🚚 Dostawa i płatność</h3>
      <div class="f-row">
        <div class="f-group"><label>Dostawa</label>
          <select name="delivery" onchange="przeliczZamowienie()">
            ${dostepneDostawy().map(d=>`<option value="${d.id}">${esc(d.nazwa)} — ${d.koszt?zl(d.koszt):"gratis"} (${esc(d.opis)})</option>`).join("")}
          </select>
          <small style="color:var(--muted2)">Dostawa wyłącznie przez InPost: Paczkomat/Punkt InPost albo Kurier InPost.</small>
        </div>
        <div class="f-group"><label>Płatność</label>
          <select name="payment" onchange="przeliczZamowienie()">
            ${dostepnePlatnosci().map(p=>`<option value="${p.id}">${esc(p.nazwa)}${p.oplata?" (+"+zl(p.oplata)+")":""}</option>`).join("")}
          </select>
        </div>
      </div>
      <label class="chk-row"><input type="checkbox" name="paczkaWeekend" onchange="przeliczZamowienie()"> 🟡 Paczka w Weekend (+${zl(OPLATA_PACZKA_WEEKEND)}) <small style="color:var(--muted2);font-weight:600">opcjonalna usługa InPost doliczana do zamówienia</small></label>
      <div class="f-group" id="paczkomatBox" style="display:block">
        <label>Paczkomat InPost *</label>
        <input type="hidden" name="paczkomat" id="paczkomatKod">
        <div class="f-row" style="grid-template-columns:1fr auto;align-items:end;margin:.25rem 0">
          <div class="f-group" style="margin:0"><input id="paczkomatSzukaj" placeholder="Wpisz kod pocztowy, miasto albo kod paczkomatu, np. WAW01M" onkeydown="if(event.key==='Enter'){event.preventDefault();szukajPaczkomatow()}"></div>
          <div class="f-group" style="margin:0"><button type="button" class="btn ghost" onclick="szukajPaczkomatow()">🔎 Szukaj</button></div>
        </div>
        <div class="diag-actions" style="margin:.35rem 0">
          <button type="button" class="btn" style="background:#ffcc00;color:#111;font-weight:800" onclick="otworzGeowidget()">🗺️ Mapa InPost</button>
          <button type="button" class="btn ghost" onclick="szukajPaczkomatow('geo')">📍 Najbliższe</button>
          <button type="button" class="btn ghost" onclick="const f=document.getElementById('orderForm'); const q=document.getElementById('paczkomatSzukaj'); if(q&&f){q.value=f.kod.value||f.miasto.value||'';} szukajPaczkomatow()">🏠 Szukaj przy adresie</button>
        </div>
        <div id="paczkomatWybrany" style="font-size:.9rem;color:var(--muted2)">Wybierz punkt z listy, mapy albo wpisz kod ręcznie.</div>
        <div id="paczkomatWyniki"></div>
        <input id="paczkomatReczny" placeholder="Awaryjnie: wpisz kod ręcznie, np. WAW01M" style="margin-top:.55rem;text-transform:uppercase" oninput="ustawPaczkomatReczny(this.value)">
      </div>
      <div class="f-group"><label>Uwagi do zamówienia</label><textarea name="notes" rows="2"></textarea></div>
      <div id="availabilityConfirmBox"></div>
      <div class="summary" id="orderSummary"></div>
      <label class="chk-row checkout-legal-confirm"><input type="checkbox" name="regulaminAkceptacja" required> <span>Akceptuję <a href="#/regulamin" onclick="zamknijModalCheckout({restoreFocus:false})">regulamin sklepu</a> i potwierdzam obowiązek zapłaty całkowitej kwoty pokazanej powyżej.</span></label>
      <button type="submit" class="checkout-btn">Zamówienie z obowiązkiem zapłaty</button>
      <p class="pay-note">Dane przetwarzamy w celu realizacji zamówienia. Szczegóły znajdziesz w <a href="#/prywatnosc" onclick="zamknijModalCheckout({restoreFocus:false})">Polityce prywatności</a>.</p>
    </form>`;
  przeliczZamowienie();
  aktywujModalCheckout();
}
function przeliczZamowienie(){
  const form = $("orderForm"); if(!form) return;
  const idD = form.delivery?.value || "paczkomat", idP = form.payment.value;
  const pBox = $("paczkomatBox");
  if(pBox){ pBox.style.display = czyDostawaPaczkomat(idD) ? "" : "none"; }
  const suma = sumaPoRabacie(), dostawa = kosztDostawy(idD), oplata = oplataPlatnosci(idP), weekend = oplataPaczkaWeekend(!!form.paczkaWeekend?.checked);
  const box=$("availabilityConfirmBox"), potwierdzenia=pozycjeDoPotwierdzeniaDostepnosci();
  if(box) box.innerHTML = potwierdzenia.length ? `<div class="backend-note" style="margin:.8rem 0;border-color:#fed7aa;background:#fff7ed;color:#9a3412">
    <b>Sprawdzenie dostępności przy większej ilości</b><br>
    Dla ${potwierdzenia.map(x=>`${esc(x.nazwa)} × ${x.ilosc}`).join(", ")} obsługa potwierdzi aktualną dostępność przed realizacją.
    <label class="chk-row" style="margin-top:.45rem"><input type="checkbox" name="potwierdzenieDostepnosci" required> Rozumiem, że dostępność tej ilości zostanie potwierdzona przez sklep.</label>
  </div>` : "";
  $("orderSummary").innerHTML =
    koszyk.map(x=>{const p=produkty.find(p=>String(p.id)===String(x.id));
      return p?`<div><span>${esc(p.nazwa)}${x.wariant?` (${esc(x.wariant)})`:""} × ${x.ile}</span><span>${zl(p.cena*x.ile)}</span></div>`:"";}).join("")
    + (rabat?`<div><span>Kod (${esc(rabat.kod)})</span><span>${wynikRegulyRabatowej(aktywnaRegulaRabatowa()).darmowaDostawa?"Darmowa dostawa":"−"+zl(kwotaRabatu())}</span></div>`:"")
    + `<div><span>Dostawa</span><span>${dostawa?zl(dostawa):"GRATIS"}</span></div>`
    + (weekend?`<div><span>Paczka w Weekend</span><span>${zl(weekend)}</span></div>`:"")
    + (oplata?`<div><span>Opłata za pobranie</span><span>${zl(oplata)}</span></div>`:"")
    + `<div class="sum-total"><span>Do zapłaty (PLN)</span><span>${zl(suma+dostawa+oplata+weekend)}</span></div>`;
}
// ─── InPost Geowidget (wybór paczkomatu na mapie) ───
let INPOST_PUBLIC=null, geowidgetSDK=null;
async function pobierzInpostConfig(force=false){
  if(INPOST_PUBLIC&&!force) return INPOST_PUBLIC;
  try{ const d=await chmura("inpost-config",{timeout:9000}); INPOST_PUBLIC=d.inpost||null; }catch(e){ INPOST_PUBLIC=null; }
  return INPOST_PUBLIC;
}
function ladujGeowidgetSDK(){
  if(geowidgetSDK) return geowidgetSDK;
  geowidgetSDK=new Promise((res,rej)=>{
    if(!document.getElementById("inpost-geo-css")){ const l=document.createElement("link"); l.id="inpost-geo-css"; l.rel="stylesheet"; l.href="https://geowidget.inpost.pl/inpost-geowidget.css"; document.head.appendChild(l); }
    if(window.customElements&&window.customElements.get("inpost-geowidget")){ res(true); return; }
    const s=document.createElement("script"); s.src="https://geowidget.inpost.pl/inpost-geowidget.js"; s.defer=true;
    s.onload=()=>res(true); s.onerror=()=>rej(new Error("Nie udało się załadować mapy InPost")); document.head.appendChild(s);
  });
  return geowidgetSDK;
}
function ustawPaczkomatReczny(v){
  const kod=String(v||"").trim().toUpperCase();
  const h=$("paczkomatKod"); if(h) h.value=kod;
  window.__paczkomatAdres="";
  const d=$("paczkomatWybrany"); if(d) d.innerHTML = kod?`📮 Wybrany paczkomat: <b>${esc(kod)}</b>`:"Wybierz punkt z listy, mapy albo wpisz kod ręcznie.";
}
function czyscAdresPaczkomatu(str){
  const parts=String(str||"").split("•").map(s=>s.trim()).filter(Boolean);
  const keep=[];
  for(const p of parts){
    const lp=p.toLowerCase();
    if(keep.some(k=>k.toLowerCase().includes(lp))) continue;         // pomiń, jeśli już zawarte w innej części
    for(let i=keep.length-1;i>=0;i--){ if(lp.includes(keep[i].toLowerCase())) keep.splice(i,1); } // usuń krótsze duplikaty
    keep.push(p);
  }
  return keep.join(" • ");
}
function opisPunktuInpost(p){
  return czyscAdresPaczkomatu([p.address,[p.postCode,p.city].filter(Boolean).join(" "),p.description].filter(Boolean).join(" • "));
}
function wybierzPaczkomatZListy(kod, adres){
  kod=String(kod||"").trim().toUpperCase();
  if(!kod) return;
  const h=$("paczkomatKod"); if(h) h.value=kod;
  const r=$("paczkomatReczny"); if(r) r.value=kod;
  window.__paczkomatAdres=String(adres||"").trim();
  const d=$("paczkomatWybrany"); if(d) d.innerHTML=`📮 Wybrany paczkomat: <b>${esc(kod)}</b>${adres?`<br><small>${esc(adres)}</small>`:""}`;
  toast("Wybrano paczkomat "+kod);
}
function pokazListePaczkomatow(punkty){
  const box=$("paczkomatWyniki"); if(!box) return;
  if(!punkty.length){ box.innerHTML=`<div class="backend-note" style="margin-top:.5rem">Nie znaleziono punktów. Spróbuj wpisać kod pocztowy, nazwę miasta albo kod paczkomatu, np. WAW01M.</div>`; return; }
  box.innerHTML=`<div style="display:grid;gap:.45rem;margin-top:.55rem">${punkty.map(p=>{
    const adres=opisPunktuInpost(p);
    const dyst=Number.isFinite(Number(p.distance))?` • ${(Number(p.distance)/1000).toFixed(Number(p.distance)>=1000?1:2).replace(".",",")} km`:"";
    return `<button type="button" class="btn ghost" style="text-align:left;display:block;width:100%;padding:.65rem .75rem" onclick="wybierzPaczkomatZListy(${jsArg(p.name)},${jsArg(adres)})">
      <b>📮 ${esc(p.name)}</b>${p.location247?" <span class=\"lvl lvl-info\">24/7</span>":""}${p.easyAccessZone?" <span class=\"lvl lvl-info\">łatwy dostęp</span>":""}${dyst}<br>
      <small style="color:var(--muted2)">${esc(adres||"brak adresu")}${p.openingHours?` • ${esc(p.openingHours)}`:""}</small>
    </button>`;
  }).join("")}</div>`;
}
async function szukajPaczkomatow(tryb="tekst"){
  const box=$("paczkomatWyniki"); if(box) box.innerHTML=`<p class="pay-note" style="text-align:left">Szukam punktów InPost…</p>`;
  const form=$("orderForm"), input=$("paczkomatSzukaj");
  const q=String(input?.value||"").trim();
  const params={limit:12};
  try{
    if(tryb==="geo"){
      if(!navigator.geolocation){ toast("Przeglądarka nie udostępnia lokalizacji"); return; }
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:false,timeout:8000,maximumAge:300000}));
      params.lat=pos.coords.latitude; params.lng=pos.coords.longitude;
    }else{
      const kod=String(form?.kod?.value||"").trim();
      const miasto=String(form?.miasto?.value||"").trim();
      const zapytanie=q || kod || miasto;
      if(!zapytanie){ toast("Wpisz miasto, kod pocztowy albo nazwę paczkomatu"); input?.focus(); return; }
      if(/^\d{2}-?\d{3}$/.test(zapytanie)) params.post_code=zapytanie;
      else params.q=zapytanie;
    }
    const d=await chmura("inpost-points",{params,timeout:12000});
    pokazListePaczkomatow(d.points||[]);
  }catch(e){
    if(box) box.innerHTML=`<div class="backend-note" style="border-color:var(--danger);background:#fff1f2;color:#991b1b;margin-top:.5rem"><b>Nie udało się pobrać punktów:</b> ${esc(e.message||"błąd")}. Możesz użyć mapy InPost albo wpisać kod ręcznie.</div>`;
    loguj("blad","Wyszukiwarka paczkomatów: "+(e.message||e));
  }
}
window.artwayPunktWybrany=function(point){
  try{
    const kod=(point&&(point.name||point.id))||"";
    const adr=czyscAdresPaczkomatu(point&&point.address?[point.address.line1,point.address.line2].filter(Boolean).join(" • "):((point&&point.location_description)||""));
    if(window.__geoTarget==="inpost-service"){
      if(typeof inpostServiceWybierzPunkt==="function")inpostServiceWybierzPunkt(kod,adr);
      window.__geoTarget="";
      zamknijGeowidget();
      return;
    }
    if(window.__geoTarget==="admin"){
      const ah=$("admPaczkomat"); if(ah) ah.value=kod;
      const av=$("admPaczkomatAdresVal"); if(av) av.value=adr;
      const ad=$("admPaczkomatAdres"); if(ad) ad.innerHTML=kod?`📮 ${esc(adr||kod)}`:"";
      window.__geoTarget="";
      zamknijGeowidget();
      toast("Wybrano paczkomat "+kod);
      return;
    }
    const h=$("paczkomatKod"); if(h) h.value=kod;
    const r=$("paczkomatReczny"); if(r) r.value=kod;
    window.__paczkomatAdres=adr;
    const d=$("paczkomatWybrany"); if(d) d.innerHTML=kod?`📮 Wybrany paczkomat: <b>${esc(kod)}</b>${adr?`<br><small>${esc(adr)}</small>`:""}`:"Wybierz punkt z listy, mapy albo wpisz kod ręcznie.";
    zamknijGeowidget();
    toast("Wybrano paczkomat "+kod);
  }catch(e){ loguj("blad","Geowidget punkt: "+(e&&e.message||e)); }
};
async function otworzGeowidget(){
  const cfg=await pobierzInpostConfig();
  if(!cfg||!cfg.geowidgetToken){ toast("Mapa paczkomatów nie jest jeszcze skonfigurowana — wpisz kod paczkomatu ręcznie w polu poniżej"); const r=$("paczkomatReczny"); if(r) r.focus(); return; }
  try{ await ladujGeowidgetSDK(); }catch(e){ toast(e.message||"Błąd mapy InPost"); return; }
  const form=$("orderForm"); const cod = !!(form&&form.payment&&form.payment.value==="pobranie");
  const config = cod ? "parcelCollectPayment" : "parcelCollect";
  let ov=$("geoOverlay");
  if(!ov){ ov=document.createElement("div"); ov.id="geoOverlay"; ov.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:2vmin"; document.body.appendChild(ov); }
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;width:min(980px,96vw);height:min(88vh,780px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;background:#111;color:#fff">
      <b>Wybierz paczkomat InPost</b><button type="button" onclick="zamknijGeowidget()" style="background:#ffcc00;color:#111;border:0;border-radius:8px;padding:.4rem .8rem;font-weight:800;cursor:pointer">Zamknij ✕</button></div>
    <div style="flex:1;min-height:0"><inpost-geowidget onpoint="artwayPunktWybrany" token="${esc(cfg.geowidgetToken)}" language="pl" config="${config}" style="width:100%;height:100%;display:block"></inpost-geowidget></div>
  </div>`;
  ov.style.display="flex";
}
function zamknijGeowidget(){ const ov=$("geoOverlay"); if(ov){ ov.style.display="none"; ov.innerHTML=""; } }
async function zlozZamowienie(e){
  e.preventDefault();
  try{
    const f = new FormData(e.target);
    const niedostepneWKoszyku=koszyk.map(x=>produkty.find(p=>tenSamProdukt(p.id,x.id))).filter(p=>!p||!produktDostepnyWSprzedazy(p));
    if(niedostepneWKoszyku.length){
      toast("⚠️ Usuń z koszyka produkty chwilowo niedostępne lub bez ceny");
      return;
    }
    const potwierdzeniaDostepnosci = pozycjeDoPotwierdzeniaDostepnosci();
    if(potwierdzeniaDostepnosci.length && !f.get("potwierdzenieDostepnosci")){
      toast("⚠️ Potwierdź informację o sprawdzeniu dostępności większej ilości");
      return;
    }
    // walidacja NIP przy fakturze
    if(f.get("firmaChk") && !walidujNip(f.get("nip"))){
      toast("⚠️ Nieprawidłowy NIP — sprawdź numer");
      loguj("info","Odrzucono zamówienie: błędny NIP");
      return;
    }
    // opcjonalna rejestracja konta przy zamówieniu
    if(!sesja && f.get("kontoChk")){
      if(String(f.get("haslo")||"")!==String(f.get("haslo2")||"")){ toast("⚠️ Wpisane hasła do konta nie są takie same"); return; }
      const w = await zarejestrujUzytkownika(f.get("imie")+" "+f.get("nazwisko"), f.get("email"), f.get("haslo")||"");
      if(w.ok){ ustawSesje(w.uzytkownik); toast("Konto założone! 🎉"); }
      else { loguj("ostrzezenie","Konto przy zamówieniu nieutworzone: "+w.blad); }
    }
    const idD = String(f.get("delivery")||"paczkomat"), idP = f.get("payment");
    if(czyDostawaPaczkomat(idD) && !String(f.get("paczkomat")||"").trim()){
      toast("⚠️ Wybierz paczkomat na mapie lub wpisz jego kod");
      const r=$("paczkomatReczny"); if(r) r.focus();
      return;
    }
    const dost = dostepneDostawy().find(x=>x.id===idD) || DOMYSLNA_DOSTAWA_INPOST;
    const plat = KONFIG.platnosci.find(x=>x.id===idP);
    const paczkaWeekend = !!f.get("paczkaWeekend");
    const suma = sumaPoRabacie(), dostawa = kosztDostawy(idD), oplata = oplataPlatnosci(idP), oplataWeekend = oplataPaczkaWeekend(paczkaWeekend);
    const razem = kwotaNum(suma+dostawa+oplata+oplataWeekend);
    const nr = "ATM-" + Date.now().toString().slice(-6);
    const paczkomat = czyDostawaPaczkomat(idD) ? " • Paczkomat: "+f.get("paczkomat") : "";
    const adres = `${f.get("ulica")} ${f.get("nrDomu")}${f.get("nrLokalu")?"/"+f.get("nrLokalu"):""}, ${f.get("kod")} ${f.get("miasto")}`;
    const firma = f.get("firmaChk") ? `\nFirma: ${f.get("firma")} • NIP: ${String(f.get("nip")).replace(/[^0-9]/g,"")}` : "";
    const pozycjeDane = koszyk.map(x=>{const p=produkty.find(p=>String(p.id)===String(x.id));
      return p?{id:p.id,nazwa:p.nazwa,sku:p.sku||"",wariant:x.wariant||"",ilosc:x.ile,cena:p.cena,wartosc:p.cena*x.ile}:null;}).filter(Boolean);
    if(!pozycjeDane.length)throw new Error("Koszyk nie zawiera aktualnie dostępnych produktów");
    const pozycje = pozycjeDane.map(p=>{
      return `${p.nazwa}${p.wariant?` (${p.wariant})`:""}${p.sku?` [${p.sku}]`:""} × ${p.ilosc} = ${zl(p.wartosc)}`;});
    const tresc =
`NOWE ZAMÓWIENIE ${nr}
================================
${pozycje.map(p=>"- "+p).join("\n")}
${rabat?`Kod ${rabat.kod}: ${wynikRegulyRabatowej(aktywnaRegulaRabatowa()).darmowaDostawa?"darmowa dostawa":"-"+zl(kwotaRabatu())}\n`:""}Dostawa: ${dost.nazwa}${paczkomat} — ${dostawa?zl(dostawa):"gratis"}
${paczkaWeekend?`Paczka w Weekend: ${zl(oplataWeekend)}\n`:""}
${oplata?`Opłata za pobranie: ${zl(oplata)}\n`:""}RAZEM: ${zl(razem)}
${potwierdzeniaDostepnosci.length?`UWAGA: potwierdzić dostępność większej ilości: ${potwierdzeniaDostepnosci.map(x=>`${x.nazwa} × ${x.ilosc}`).join(", ")}\n`:""}
Płatność: ${plat.nazwa}
${instrukcjaPlatnosciTekst(idP,nr,razem)}
--------------------------------
Klient: ${f.get("imie")} ${f.get("nazwisko")}${firma}
Tel: ${f.get("phone")}
E-mail: ${f.get("email")}
Adres: ${adres}
Uwagi: ${f.get("notes")||"brak"}`;

    // zapamiętaj dane w profilu zalogowanego klienta
    if(sesja && f.get("zapamietaj")){
      const u = pobierzUzytkownikow();
      const k = u.find(x=>x.email===sesja.email);
      if(k){
        Object.assign(k, {
          telefon:String(f.get("phone")||"").trim(), ulica:String(f.get("ulica")||"").trim(),
          nrDomu:String(f.get("nrDomu")||"").trim(), nrLokalu:String(f.get("nrLokalu")||"").trim(),
          kod:String(f.get("kod")||"").trim(), miasto:String(f.get("miasto")||"").trim()
        });
        if(f.get("firmaChk")){ k.nip = String(f.get("nip")||"").replace(/[^0-9]/g,""); k.firma = String(f.get("firma")||"").trim(); }
        zapiszLS("artway_uzytkownicy", u);
        void zapiszUzytkownikaCentralnie(k);
      }
    }
    zmniejszStany(koszyk, nr);   // magazyn: odejmij sprzedane sztuki
    const emailKlienta=String(f.get("email")||"").trim().toLowerCase();
    const noweZamowienie={
      nr, data:new Date().toLocaleString("pl-PL"), ts:Date.now(), email:emailKlienta,rabatKod:rabat?.kod||"",
      klient:{imie:String(f.get("imie")||"").trim(),nazwisko:String(f.get("nazwisko")||"").trim(),telefon:String(f.get("phone")||"").trim(),
        firma:f.get("firmaChk")?String(f.get("firma")||"").trim():"",nip:f.get("firmaChk")?String(f.get("nip")||"").replace(/[^0-9]/g,""):""},
      adresDostawy:{ulica:String(f.get("ulica")||"").trim(),nrDomu:String(f.get("nrDomu")||"").trim(),nrLokalu:String(f.get("nrLokalu")||"").trim(),kod:String(f.get("kod")||"").trim(),miasto:String(f.get("miasto")||"").trim()},
      pozycje,pozycjeDane,razem,status:"nowe",dostawa:dost.nazwa,dostawaId:idD,dostawaKoszt:dostawa,paczkaWeekend,oplataPaczkaWeekend:oplataWeekend,
      wymagaPotwierdzeniaDostepnosci:potwierdzeniaDostepnosci.length>0,dostepnoscDoPotwierdzenia:potwierdzeniaDostepnosci,
      oplataPlatnosci:oplata,koszty:{produkty:sumaKoszyka(),rabat:kwotaRabatu(),poRabacie:suma,dostawa,paczkaWeekend:oplataWeekend,platnosc:oplata,razem},
      platnosc:plat.nazwa,platnoscId:idP,platnoscInstrukcja:instrukcjaPlatnosciTekst(idP,nr,razem),adres,
      paczkomat:czyDostawaPaczkomat(idD)?String(f.get("paczkomat")||"").trim():"",paczkomatAdres:czyDostawaPaczkomat(idD)?String(window.__paczkomatAdres||"").trim():"",uwagi:String(f.get("notes")||"").trim(),
      wysylka:{przewoznik:"inpost",usluga:uslugaInpostDlaDostawy(idD),punktKod:czyDostawaPaczkomat(idD)?String(f.get("paczkomat")||"").trim():"",status:"nieprzygotowana",etap:"do_obslugi",priorytet:"normalny",zadania:{dane:true,kompletacja:false,etykieta:false,przekazanie:false},
        paczkaWeekend,oplataWeekend,dodatkoweUslugi:paczkaWeekend?[{id:"paczka_weekend",nazwa:"Paczka w Weekend",koszt:oplataWeekend}]:[],
        historia:[{czas:new Date().toLocaleString("pl-PL"),status:"Zamówienie utworzone",opis:"Oczekuje na potwierdzenie i przygotowanie"}],powiadomienia:[]}
    };
    zapiszZamowienie(noweZamowienie);
    const zapisanoCentralnie=await zapiszZamowienieCentralnie(noweZamowienie,true);
    if(zapisanoCentralnie?.orderAccessToken){
      noweZamowienie.orderAccessToken=zapisanoCentralnie.orderAccessToken;
      zapiszZamowienie(noweZamowienie);
      const dostepy=wczytajLS("artway_dostep_zamowien",{});
      dostepy[nr]=zapisanoCentralnie.orderAccessToken;
      zapiszLS("artway_dostep_zamowien",dostepy);
    }
    let paynowWynik=null;
    if(idP==="paynow"){
      paynowWynik = await utworzPlatnoscPaynow(noweZamowienie);
    }
    if(zapisanoCentralnie&&sesja) await pobierzMojeZamowieniaCentralne(true);
    if(!zapisanoCentralnie){
      toast("⚠️ Zamówienie zapisano lokalnie, ale serwer jest niedostępny");
      loguj("blad",`Zamówienie ${nr} oczekuje na synchronizację ze wspólną bazą`);
    }
    if(!sesja){
      const numery=wczytajLS("artway_zamowienia_goscia",[]);
      zapiszLS("artway_zamowienia_goscia",[nr,...numery.filter(x=>x!==nr)].slice(0,20));
    }
    loguj("info",`Złożono zamówienie ${nr} na ${zl(razem)} (${dost.nazwa}, ${plat.nazwa})`);
    if(typeof seoSledzZamowienie==="function")seoSledzZamowienie(razem,nr,pozycjeDane);

	    const infoPlatnosci = instrukcjaPlatnosciHTML(idP,nr,razem,noweZamowienie);
	    const bladPaynow = idP==="paynow" && paynowWynik && paynowWynik.ok===false && !paynowWynik.skipped
	      ? `<p class="pay-note" style="color:var(--danger);text-align:left">Paynow nie utworzył linku automatycznie: ${esc(paynowWynik.error||"brak konfiguracji")}. Zamówienie zostało zapisane — po uzupełnieniu konfiguracji można odświeżyć płatność w panelu.</p>` : "";
	    const urlDziekujemy = `#/dziekujemy/${encodeURIComponent(nr)}`;
	    const linkPaynow = noweZamowienie.paynow?.redirectUrl || (idP==="paynow" && KONFIG.linkPlatnosci ? KONFIG.linkPlatnosci : "");
	    $("modalBox").innerHTML = `<div class="success">
	      <div class="big">✅</div>
	      <h2 id="checkoutTitle">${linkPaynow?"Przekierowujemy do płatności…":"Dziękujemy za zamówienie!"}</h2>
	      <p class="sub">Numer zamówienia: <b>${nr}</b> • Kwota: <b>${zl(razem)}</b><br>${esc(dost.nazwa)} • ${esc(plat.nazwa)}</p>
	      <p class="pay-note" style="${zapisanoCentralnie?"color:var(--ok)":"color:var(--danger)"}">${zapisanoCentralnie?"☁️ Zamówienie zapisano we wspólnej bazie sklepu.":"⚠️ Brak połączenia z serwerem — zamówienie czeka na synchronizację."}</p>
	      <p class="pay-note" style="text-align:left">📧 Potwierdzenie zamówienia jest wysyłane automatycznie na e-mail klienta, jeśli bramka e-mail jest skonfigurowana.</p>
	      ${bladPaynow}
	      ${infoPlatnosci}
	      <p class="pay-note" style="margin-top:1rem"><a href="${linkPaynow?esc(linkPaynow):urlDziekujemy}" onclick="zamknijModalCheckout({restoreFocus:false})" style="color:var(--brand)">${linkPaynow?"Przejdź do płatności teraz →":"Przejdź do podziękowania →"}</a></p>
	    </div>`;
	    koszyk=[]; rabat=null; zapiszLS("artway_koszyk",koszyk); zapiszLS("artway_rabat",null); odswiezKoszyk();
	    setTimeout(()=>{
	      zamknijModalCheckout({restoreFocus:false});
	      if(linkPaynow) location.href=linkPaynow;
	      else location.hash=urlDziekujemy;
	    }, linkPaynow?900:650);
  }catch(bl){
    loguj("blad","Błąd składania zamówienia: "+bl.message);
    toast("⚠️ Wystąpił błąd — zapisano w diagnostyce");
  }
}
