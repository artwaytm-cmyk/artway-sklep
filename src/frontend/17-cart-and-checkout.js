/* ═══════════ KOSZYK ═══════════ */
function tenSamProdukt(a,b){return String(a??"")===String(b??"");}
function ileWKoszyku(id){ return koszyk.filter(x=>tenSamProdukt(x.id,id)).reduce((s,x)=>s+x.ile,0); }
function kontrolowanyStanDlaZakupu(id){
  if(!Object.prototype.hasOwnProperty.call(stanyProduktow||{},id)||stanyProduktow[id]===null||stanyProduktow[id]==="")return null;
  const n=Number(stanyProduktow[id]);return Number.isFinite(n)?Math.max(0,Math.floor(n)):null;
}
function wymagaPotwierdzeniaIlosci(id,ilosc){
  const qty=Math.max(0,Number(ilosc)||0),stan=kontrolowanyStanDlaZakupu(id);
  return qty>LIMIT_POTWIERDZENIA_DOSTEPNOSCI&&(stan===null||qty>stan);
}
function pozycjeDoPotwierdzeniaDostepnosci(){
  const mapa=new Map();
  for(const x of koszyk){
    const key=String(x.id);
    const rec=mapa.get(key)||{id:x.id,ilosc:0,warianty:[]};
    rec.ilosc+=Number(x.ile)||0;
    if(x.wariant)rec.warianty.push(`${x.wariant} × ${x.ile}`);
    mapa.set(key,rec);
  }
  return [...mapa.values()].filter(x=>wymagaPotwierdzeniaIlosci(x.id,x.ilosc)).map(x=>{
    const p=produkty.find(p=>String(p.id)===String(x.id));
    return {...x,nazwa:p?.nazwa||"Produkt",sku:p?.sku||"",stanMagazynowy:kontrolowanyStanDlaZakupu(x.id)};
  });
}
function potwierdzProgDostepnosci(id, nastepnaIlosc){
  if(!wymagaPotwierdzeniaIlosci(id,nastepnaIlosc)) return true;
  const obecnie=ileWKoszyku(id);
  if(wymagaPotwierdzeniaIlosci(id,obecnie)) return true;
  const stan=kontrolowanyStanDlaZakupu(id),opis=stan===null?`więcej niż ${LIMIT_POTWIERDZENIA_DOSTEPNOSCI} sztuk`:`${nastepnaIlosc} szt., przy aktualnym stanie ${stan} szt.`;
  return confirm(`Wybrano ${opis}. Sklep potwierdzi brakującą ilość przed realizacją. Kontynuować?`);
}
function alertDostepnosciKoszykaHTML(){
  const lista=pozycjeDoPotwierdzeniaDostepnosci();
  if(!lista.length)return "";
  return `<div class="backend-note" style="margin-top:.7rem;border-color:#fed7aa;background:#fff7ed;color:#9a3412"><b>Potwierdzenie dostępności:</b> dla ${lista.map(x=>`${esc(x.nazwa)} × ${x.ilosc}`).join(", ")} obsługa sklepu potwierdzi aktualną dostępność przed wysyłką.</div>`;
}
function normalizujIloscZakupu(value){return Math.max(1,Math.min(99,Math.floor(Number(value)||1)));}
function ustawIloscKarty(input,delta=0){if(!input)return 1;const value=normalizujIloscZakupu(Number(input.value||1)+Number(delta||0));input.value=value;return value;}
function dodajZKarty(id,btn){const box=btn?.closest?.(".card-purchase"),input=box?.querySelector?.("[data-card-quantity]");return dodajWIlosci(id,normalizujIloscZakupu(input?.value||1),btn,null);}
function dodajWIlosci(id,ilosc=1,btn=null,wariant=null){
  const ile=normalizujIloscZakupu(ilosc);
  wariant = wariant || null;
  const p = produkty.find(x=>tenSamProdukt(x.id,id));
  if(p&&!produktMaCeneSprzedazy(p)){ toast("⚠️ Ten produkt wymaga uzupełnienia ceny przez administratora"); return; }
  if(p&&produktOznaczonyNiedostepny(p)){ toast("⚠️ Produkt jest chwilowo niedostępny"); return; }
  if(p?.warianty?.length && !wariant){ location.hash="#/produkt/"+id; toast("Wybierz wariant produktu"); return; }
  if(!potwierdzProgDostepnosci(id, ileWKoszyku(id)+ile)) return;
  const productId=p?.id??id,poz = koszyk.find(x=>tenSamProdukt(x.id,productId) && (x.wariant||null)===wariant);
  poz ? poz.ile+=ile : koszyk.push({id:productId, ile, ...(wariant?{wariant}:{})});
  zapiszLS("artway_koszyk", koszyk); odswiezKoszyk();
  if(btn){const label=btn.dataset.originalLabel||btn.textContent;btn.dataset.originalLabel=label;btn.textContent=`✓ Dodano ${ile} szt.`;btn.classList.add("added");
    setTimeout(()=>{if(btn.isConnected){btn.textContent=label;btn.classList.remove("added");}},1100); }
  toast(`Dodano ${ile} ${ile===1?"sztukę":"szt."} do koszyka 🛒${wariant?" ("+wariant+")":""}`);
  if(typeof seoSledzKoszyk==="function")seoSledzKoszyk(id);
  return true;
}
function dodaj(id,btn,wariant){return dodajWIlosci(id,1,btn,wariant);}
function zmienIloscIdx(i, d){
  const poz = koszyk[i]; if(!poz) return;
  if(d>0){
    const p = produkty.find(x=>tenSamProdukt(x.id,poz.id));
    if(p&&produktOznaczonyNiedostepny(p)){ toast("⚠️ Produkt jest chwilowo niedostępny"); return; }
    if(!potwierdzProgDostepnosci(poz.id, ileWKoszyku(poz.id)+1)) return;
  }
  poz.ile += d;
  if(poz.ile<=0) koszyk.splice(i,1);
  zapiszLS("artway_koszyk", koszyk); odswiezKoszyk();
}
function usunIdx(i){ koszyk.splice(i,1); zapiszLS("artway_koszyk", koszyk); odswiezKoszyk(); }
function zmienIlosc(id, d){ const i = koszyk.findIndex(x=>tenSamProdukt(x.id,id)); if(i>=0) zmienIloscIdx(i, d); }
function usun(id){ koszyk = koszyk.filter(x=>!tenSamProdukt(x.id,id)); zapiszLS("artway_koszyk", koszyk); odswiezKoszyk(); }
function sumaKoszyka(){
  return koszyk.reduce((s,x)=>{ const p=produkty.find(p=>tenSamProdukt(p.id,x.id)); return s+(p?p.cena*x.ile:0); },0);
}
function produktObjetyRegulaRabatowa(p,regula){
  if(!p||!regula)return false;
  if(regula.zakres==="kategorie")return (regula.kategorie||[]).includes(p.kategoria);
  if(regula.zakres==="produkty")return (regula.produkty||[]).map(String).includes(String(p.id));
  return true;
}
function wynikRegulyRabatowej(regula){
  if(!regula)return {ok:false,powod:"Nieznany kod rabatowy",kwota:0,darmowaDostawa:false};
  const status=regulaRabatowaStatus(regula);if(!status.aktywna)return {ok:false,powod:status.powod,kwota:0,darmowaDostawa:false};
  const suma=sumaKoszyka(),minimum=Math.max(0,Number(regula.minKoszyk)||0);
  if(suma<minimum)return {ok:false,powod:`Minimalna wartość koszyka dla tego kodu to ${zl(minimum)}`,kwota:0,darmowaDostawa:false};
  const podstawa=koszyk.reduce((sum,x)=>{const p=produkty.find(p=>String(p.id)===String(x.id));return sum+(produktObjetyRegulaRabatowa(p,regula)?Number(p.cena||0)*Number(x.ile||0):0);},0);
  if(!podstawa&&regula.typ!=="darmowa_dostawa")return {ok:false,powod:"Kod nie obejmuje produktów znajdujących się w koszyku",kwota:0,darmowaDostawa:false};
  let kwota=regula.typ==="kwota"?Math.min(podstawa,Math.max(0,Number(regula.wartosc)||0)):regula.typ==="procent"?podstawa*Math.max(0,Math.min(100,Number(regula.wartosc)||0))/100:0;
  const limit=Math.max(0,Number(regula.maxRabat)||0);if(limit)kwota=Math.min(kwota,limit);
  return {ok:true,powod:"",kwota:+Math.max(0,kwota).toFixed(2),darmowaDostawa:regula.typ==="darmowa_dostawa",podstawa};
}
function aktywnaRegulaRabatowa(){return rabat?znajdzReguleRabatowa(rabat.kod):null;}
function kwotaRabatu(){ const wynik=wynikRegulyRabatowej(aktywnaRegulaRabatowa());return wynik.ok?wynik.kwota:0; }
function sumaPoRabacie(){ return Math.max(0, sumaKoszyka()-kwotaRabatu()); }
function zastosujKod(){
  const kod = ($("promoInput")?.value||"").trim().toUpperCase();
  const regula=znajdzReguleRabatowa(kod),wynik=wynikRegulyRabatowej(regula);
  if(wynik.ok){rabat={kod:regula.kod,typ:regula.typ,wartosc:Number(regula.wartosc)||0};zapiszLS("artway_rabat",rabat);toast(regula.typ==="darmowa_dostawa"?`Kod ${kod} aktywny: darmowa dostawa 🎉`:`Kod ${kod} aktywny: −${zl(wynik.kwota)} 🎉`);}
  else { toast(`${wynik.powod||"Nieznany kod rabatowy"} 😕`); loguj("info","Nieudana próba użycia kodu "+kod+": "+(wynik.powod||"nieznany")); }
  odswiezKoszyk();
}
function usunRabat(){ rabat=null; zapiszLS("artway_rabat", null); odswiezKoszyk(); }
function odswiezKoszyk(){
  const n = koszyk.reduce((s,x)=>s+x.ile,0);
  $("cartCount").textContent = n;
  const suma = sumaPoRabacie();
  $("cartTotal").textContent = zl(suma);
  $("checkoutBtn").disabled = !n;
  const regulaRabatu=aktywnaRegulaRabatowa(),wynikRabatu=wynikRegulyRabatowej(regulaRabatu);
  if(rabat&&!wynikRabatu.ok){rabat=null;zapiszLS("artway_rabat",null);}
  $("rabatBox").innerHTML = rabat ? `<div class="rabat-info"><span>🎁 Kod ${esc(rabat.kod)}: ${wynikRabatu.darmowaDostawa?"darmowa dostawa":"−"+zl(wynikRabatu.kwota)}</span><button onclick="usunRabat()">usuń</button></div>` : "";
  $("freeShip").textContent = suma>=KONFIG.darmowaDostawaOd ? "🎉 Masz darmową dostawę!"
    : suma>0 ? `Do darmowej dostawy brakuje ${zl(KONFIG.darmowaDostawaOd-suma)}` : "";
  $("cartItems").innerHTML = n ? koszyk.map((x,i)=>{
    const p = produkty.find(p=>tenSamProdukt(p.id,x.id)); if(!p) return "";
    return `<div class="cart-item">
      <div class="ci-thumb" style="background:${p.kolor||'#eef2f7'}">${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:(p.ikona||"📦")}</div>
      <div class="ci-info"><b>${esc(p.nazwa)}</b>${x.wariant?`<small style="display:block;color:var(--brand);font-weight:700">${esc(x.wariant)}</small>`:""}<small>${zl(p.cena)} / szt.</small></div>
      <div class="qty">
        <button onclick="zmienIloscIdx(${i},-1)">−</button><span>${x.ile}</span>
        <button onclick="zmienIloscIdx(${i},1)">+</button>
      </div>
      <button class="ci-remove" onclick="usunIdx(${i})" aria-label="Usuń">🗑️</button>
    </div>`;}).join("") + alertDostepnosciKoszykaHTML()
    : `<div class="cart-empty">Koszyk jest pusty.<br>Dodaj coś fajnego! 😊</div>`;
}
