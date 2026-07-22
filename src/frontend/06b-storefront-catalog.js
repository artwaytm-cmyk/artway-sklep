let sklepKatalogCentralnyCache=new Map(),sklepKatalogCentralnyStan={signature:"",loading:false,data:null,error:""},sklepKatalogCentralnyFacety={categories:[],producers:[]},sklepKatalogCentralnyPodsumowanie={},sklepKatalogCentralnyTimer=null,sklepProduktCentralnyWToku=new Map(),sklepProduktCentralnyBledy=new Map();
function sklepKatalogCentralnySort(value="default"){return ({"price-asc":"cena-rosnaco","price-desc":"cena-malejaco",name:"nazwa",rating:"ocena",newest:"najnowsze"})[value]||"external";}
function sklepKatalogCentralnyOfertaParams(){
  const oferta=ustawieniaOfertyGlownej(),params={};
  if(oferta.zakres==="promocje")params.promotion="promocje";else if(oferta.zakres==="nowosci")params.special="nowosci";else if(oferta.zakres==="kategoria"&&oferta.kategoria)params.categories=[...kategorieGaleziMenu(oferta.kategoria)].join(",");else if(oferta.zakres==="wybrane"&&oferta.produkty.length)params.ids=oferta.produkty.join(",");
  return params;
}
function sklepKatalogCentralnyParametryGlowne(){
  const params={audience:"public",q:fraza,priceMin:cenaOd,priceMax:cenaDo,minRating:Number(filtrOceny)||"",promotion:filtrOferty==="promocje"?"promocje":"",special:filtrOferty==="nowosci"?"nowosci":"",sort:sklepKatalogCentralnySort(sortowanie==="default"?(ustawieniaOfertyGlownej().sortowanie||"default"):sortowanie),page:stronaProduktow,limit:produktyNaStronie,...sklepKatalogCentralnyOfertaParams()};
  if(aktywnaKategoria!=="Wszystkie")params.categories=[...kategorieGaleziMenu(aktywnaKategoria)].join(",");
  return params;
}
function sklepKatalogCentralnySygnatura(params){return JSON.stringify(Object.fromEntries(Object.entries(params||{}).filter(([,value])=>value!==""&&value!==null&&value!==undefined)));}
async function sklepKatalogCentralnyPobierz(params,force=false){
  if(!chmuraKatalogCentralnyPubliczny)return null;const signature=sklepKatalogCentralnySygnatura(params),cached=!force?sklepKatalogCentralnyCache.get(signature):null;
  if(cached&&Date.now()-cached.at<5*60*1000)return cached.data;
  if(sklepKatalogCentralnyStan.loading&&sklepKatalogCentralnyStan.signature===signature)return null;
  sklepKatalogCentralnyStan={signature,loading:true,data:null,error:""};
  try{const data=await chmura("product-catalog-query",{params,timeout:30000});sklepKatalogCentralnyCache.set(signature,{at:Date.now(),data});while(sklepKatalogCentralnyCache.size>24)sklepKatalogCentralnyCache.delete(sklepKatalogCentralnyCache.keys().next().value);sklepKatalogCentralnyFacety=data.facets||sklepKatalogCentralnyFacety;sklepKatalogCentralnyPodsumowanie=data.summary||sklepKatalogCentralnyPodsumowanie;zapamietajProduktyCentralne(data.items||[]);zbudujProdukty();sklepKatalogCentralnyStan={signature,loading:false,data,error:""};return data;}
  catch(error){sklepKatalogCentralnyStan={signature,loading:false,data:null,error:String(error?.message||error)};return null;}
}
function sklepKatalogCentralnyWidok(params){
  const signature=sklepKatalogCentralnySygnatura(params),cached=sklepKatalogCentralnyCache.get(signature);if(cached&&Date.now()-cached.at<5*60*1000)return {ready:true,data:cached.data};
  if(sklepKatalogCentralnyStan.error&&sklepKatalogCentralnyStan.signature===signature)return {error:sklepKatalogCentralnyStan.error};
  if(!sklepKatalogCentralnyStan.loading||sklepKatalogCentralnyStan.signature!==signature)setTimeout(()=>sklepKatalogCentralnyPobierz(params).then(()=>{if(chmuraKatalogCentralnyPubliczny)renderuj();}),0);
  return {loading:true};
}
function sklepKatalogCentralnyZaplanuj(){clearTimeout(sklepKatalogCentralnyTimer);sklepKatalogCentralnyTimer=setTimeout(()=>rysuj(),220);}
async function sklepPobierzProduktCentralny(id,force=false){const key=String(id);if(force)sklepProduktCentralnyBledy.delete(key);if(sklepProduktCentralnyBledy.has(key))return null;if(sklepProduktCentralnyWToku.has(key))return sklepProduktCentralnyWToku.get(key);const request=chmura("product-catalog-item",{params:{id:key,audience:"public"},timeout:20000}).then(data=>{if(data.product){sklepProduktCentralnyBledy.delete(key);zapamietajProduktyCentralne([data.product]);zbudujProdukty();return data.product;}sklepProduktCentralnyBledy.set(key,"Nie znaleziono produktu.");return null;}).catch(error=>{sklepProduktCentralnyBledy.set(key,String(error?.message||error));return null;}).finally(()=>sklepProduktCentralnyWToku.delete(key));sklepProduktCentralnyWToku.set(key,request);return request;}
function sklepKatalogCentralnyLiczbaKategorii(galaz){const zestaw=galaz instanceof Set?galaz:new Set(galaz||[]);return (sklepKatalogCentralnyFacety.categories||[]).reduce((s,item)=>s+(zestaw.has(item.value)?Number(item.count)||0:0),0);}
function rysujChipy(){
  const c = $("chips"); if(!c) return;
  const kats = ["Wszystkie", ...wszystkieKategorie()];
  c.innerHTML = kats.map(k =>
    `<button class="chip ${k===aktywnaKategoria?'active':''}" onclick="ustawKategorie('${esc(k)}')">${esc(k)}</button>`).join("");
}
function ustawKategorie(k){ aktywnaKategoria=k;stronaProduktow=1;rysujChipy();rysuj(); }
function normalizujSzukanyTekst(s){
  return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
}
function produktPasujeFrazie(p,szukane=fraza){
  const zapytanie=normalizujSzukanyTekst(szukane);
  if(!zapytanie)return true;
  const tekst=normalizujSzukanyTekst([p.nazwa,p.opisKrotki,p.opis,p.kategoria,p.sku,p.gtin,p.ean,p.externalId,p.mpn,p.kodProducenta,p.allegroOfferId,p.producent,p.marka,p.kolorProduktu,p.rozmiar,p.material,(p.warianty||[]).join(" "),p.id].join(" "));
  return zapytanie.split(" ").filter(Boolean).every(slowo=>tekst.includes(slowo));
}
function sortujListeProduktow(lista,sort=sortowanie){
  if(sort==="price-asc") lista.sort((a,b)=>a.cena-b.cena);
  else if(sort==="price-desc") lista.sort((a,b)=>b.cena-a.cena);
  else if(sort==="name") lista.sort((a,b)=>a.nazwa.localeCompare(b.nazwa,"pl"));
  else if(sort==="rating") lista.sort((a,b)=>(sredniaOcen(b.id)?.srednia||0)-(sredniaOcen(a.id)?.srednia||0));
  else if(sort==="newest") lista.sort((a,b)=>(b.badge==="Nowość")-(a.badge==="Nowość")||b.id-a.id);
  return lista;
}
function listaProduktowPoFiltrach(){
  const od=cenaOd===""?null:Number(cenaOd),doC=cenaDo===""?null:Number(cenaDo),minOcena=Number(filtrOceny||0),oferta=ustawieniaOfertyGlownej();
  const lista=produkty.filter(p=>{
    if(!produktWidocznyWPublicznymKatalogu(p))return false;
    const ocena=sredniaOcen(p.id)?.srednia||0, niedostepny=produktOznaczonyNiedostepny(p);
    const zakres=oferta.zakres==="promocje"?!!p.staraCena:oferta.zakres==="nowosci"?p.badge==="Nowość":oferta.zakres==="kategoria"?produktNalezyDoGaleziKategorii(p,oferta.kategoria):oferta.zakres==="wybrane"?oferta.produkty.includes(String(p.id)):true;
    return zakres&&produktNalezyDoGaleziKategorii(p,aktywnaKategoria)
      && produktPasujeFrazie(p)
      && (od===null||p.cena>=od)&&(doC===null||p.cena<=doC)
      && (filtrDostepnosci==="wszystkie"||(filtrDostepnosci==="dostepne"&&!niedostepny)||(filtrDostepnosci==="brak"&&niedostepny))
      && (filtrOferty==="wszystkie"||(filtrOferty==="promocje"&&!!p.staraCena)||(filtrOferty==="nowosci"&&p.badge==="Nowość"))
      && ocena>=minOcena;
  });
  return sortujListeProduktow(lista,sortowanie==="default"?(oferta.sortowanie||"default"):sortowanie);
}
function paginacjaHTML(strona,liczbaStron,fn){
  if(liczbaStron<=1)return "";
  const numery=new Set([1,liczbaStron,strona-2,strona-1,strona,strona+1,strona+2].filter(n=>n>=1&&n<=liczbaStron));
  const uporzadkowane=[...numery].sort((a,b)=>a-b);let poprzednia=0,html="";
  for(const n of uporzadkowane){if(poprzednia&&n-poprzednia>1)html+=`<span style="padding:.3rem">…</span>`;html+=`<button class="page-btn ${n===strona?"active":""}" onclick="${fn}(${n})">${n}</button>`;poprzednia=n;}
  return `<button class="page-btn" ${strona<=1?"disabled":""} onclick="${fn}(${strona-1})">←</button>${html}<button class="page-btn" ${strona>=liczbaStron?"disabled":""} onclick="${fn}(${strona+1})">→</button>`;
}
function ustawStroneProduktow(n){
  stronaProduktow=Math.max(1,Number(n)||1);rysuj();
  document.querySelector(".catalog-head")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function ustawProduktyNaStronie(n){
  produktyNaStronie=[12,24,48,96].includes(Number(n))?Number(n):24;stronaProduktow=1;
  zapiszLS("artway_produkty_na_stronie",produktyNaStronie);rysuj();
}
function wyczyscFiltryProduktow(){
  cenaOd="";cenaDo="";filtrDostepnosci="wszystkie";filtrOferty="wszystkie";filtrOceny="0";fraza="";stronaProduktow=1;
  if($("searchInput"))$("searchInput").value="";renderuj();
}
function kartaProduktu(p,index=0){
  const ulub = ulubione.includes(p.id);
  const oceny = sredniaOcen(p.id);
  const brakCeny = !produktMaCeneSprzedazy(p);
  const niedostepny = produktOznaczonyNiedostepny(p);
  return `
  <article class="card" onclick="przejdzDoSklepu('/produkt/${encodeURIComponent(p.id)}')">
    <div class="thumb" style="background:${p.kolor||'#eef2f7'}">
      ${niedostepny?`<span class="badge" style="background:#64748b">Chwilowo niedostępne</span>`:(brakCeny?`<span class="badge" style="background:#f97316">Do wyceny</span>`:(p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:""))}
      ${jestAdmin()?"":`<button class="fav-btn" onclick="event.stopPropagation();przelaczUlubione(${jsArg(p.id)})" aria-label="Ulubione">${ulub?"❤️":"🤍"}</button>`}
      ${p.zdjecie?`<img src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}" loading="${index<4?'eager':'lazy'}" decoding="async" ${index<4?'fetchpriority="high"':''} style="width:100%;height:100%;object-fit:cover;${niedostepny?'filter:grayscale(1);opacity:.6':''}" onerror="this.remove();loguj('ostrzezenie','Nie wczytano zdjęcia produktu: ${esc(p.nazwa)}')">`:(p.ikona||"📦")}
    </div>
    <div class="card-body">
      <span class="cat-label">${esc(p.kategoria)}${oceny?` <span style="color:var(--accent);text-transform:none;letter-spacing:0">★ ${oceny.srednia.toFixed(1)} (${oceny.n})</span>`:""}</span>
      <h3><a href="/produkt/${encodeURIComponent(p.id)}" onclick="event.stopPropagation();return nawigujSklep(event,this.getAttribute('href'))">${esc(p.nazwa)}</a></h3>
      <p class="desc">${esc(skrocTekst(opisKrotkiProduktu(p),190))}</p>
      <div class="price-row">
        <span class="price">${brakCeny?"Cena do uzupełnienia":zl(p.cena)}</span>
        ${p.staraCena?`<span class="old-price">${zl(p.staraCena)}</span>`:""}
      </div>
      ${brakCeny?`<p style="font-size:.76rem;color:#c2410c;font-weight:700;margin-bottom:.4rem">Produkt zaimportowany z ceną 0,00 — popraw cenę w panelu</p>`:""}
      ${niedostepny?`<p style="font-size:.76rem;color:var(--danger);font-weight:700;margin-bottom:.4rem">Chwilowo niedostępne w sprzedaży</p>`:""}
      ${niedostepny||brakCeny
        ? `<button class="add-btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
        : p.warianty?.length
          ? `<button class="add-btn" onclick="event.stopPropagation();przejdzDoSklepu('/produkt/${encodeURIComponent(p.id)}')" style="background:var(--brand2)">Wybierz wariant →</button>`
          : `<div class="card-purchase" onclick="event.stopPropagation()"><div class="card-quantity" aria-label="Liczba sztuk"><button type="button" onclick="ustawIloscKarty(this.nextElementSibling,-1)" aria-label="Zmniejsz liczbę sztuk">−</button><input data-card-quantity type="number" min="1" max="99" step="1" value="1" inputmode="numeric" aria-label="Liczba sztuk produktu ${esc(p.nazwa)}" onchange="ustawIloscKarty(this)"><button type="button" onclick="ustawIloscKarty(this.previousElementSibling,1)" aria-label="Zwiększ liczbę sztuk">+</button></div><button class="add-btn" onclick="dodajZKarty(${jsArg(p.id)},this)">Do koszyka</button></div>`}
    </div>
  </article>`;
}
function rysuj(){
  const g = $("grid"); if(!g) return;
  if(chmuraKatalogCentralnyPubliczny){
    if(filtrDostepnosci==="brak"){
      g.innerHTML=`<div class="empty">W sklepie nie pokazujemy produktów chwilowo niedostępnych.</div>`;const licznik=$("wynikowProdukty");if(licznik)licznik.innerHTML="Nie znaleziono produktów";if($("paginacjaGora"))$("paginacjaGora").innerHTML="";if($("paginacjaDol"))$("paginacjaDol").innerHTML="";return;
    }
    const view=sklepKatalogCentralnyWidok(sklepKatalogCentralnyParametryGlowne());
    if(!view.ready){g.innerHTML=view.error?`<div class="empty">⚠️ ${esc(view.error)} <button class="btn ghost" onclick="sklepKatalogCentralnyPobierz(sklepKatalogCentralnyParametryGlowne(),true).then(()=>renderuj())">Spróbuj ponownie</button></div>`:`<div class="empty" role="status">Ładowanie aktualnej oferty…</div>`;return;}
    const data=view.data,fragment=Array.isArray(data.items)?data.items:[],liczbaStron=Math.max(1,Math.ceil((Number(data.total)||0)/produktyNaStronie));stronaProduktow=Math.min(Math.max(1,stronaProduktow),liczbaStron);const start=(stronaProduktow-1)*produktyNaStronie;
    g.innerHTML=fragment.length?fragment.map(kartaProduktu).join(""):`<div class="empty">😕 Brak produktów spełniających kryteria.</div>`;const licznik=$("wynikowProdukty");if(licznik)licznik.innerHTML=data.total?`Znaleziono <b>${data.total}</b> produktów • pokazano ${start+1}–${Math.min(start+fragment.length,data.total)}`:"Nie znaleziono produktów";const pag=paginacjaHTML(stronaProduktow,liczbaStron,"ustawStroneProduktow");if($("paginacjaGora"))$("paginacjaGora").innerHTML=pag;if($("paginacjaDol"))$("paginacjaDol").innerHTML=pag;return;
  }
  const lista=listaProduktowPoFiltrach(),liczbaStron=Math.max(1,Math.ceil(lista.length/produktyNaStronie));
  stronaProduktow=Math.min(Math.max(1,stronaProduktow),liczbaStron);
  const start=(stronaProduktow-1)*produktyNaStronie,fragment=lista.slice(start,start+produktyNaStronie);
  g.innerHTML = fragment.length ? fragment.map(kartaProduktu).join("")
    : `<div class="empty">😕 Brak produktów spełniających kryteria.</div>`;
  const licznik=$("wynikowProdukty");if(licznik)licznik.innerHTML=lista.length?`Znaleziono <b>${lista.length}</b> ${lista.length===1?"produkt":"produktów"} • pokazano ${start+1}–${Math.min(start+produktyNaStronie,lista.length)}`:"Nie znaleziono produktów";
  const pag=paginacjaHTML(stronaProduktow,liczbaStron,"ustawStroneProduktow");
  if($("paginacjaGora"))$("paginacjaGora").innerHTML=pag;
  if($("paginacjaDol"))$("paginacjaDol").innerHTML=pag;
}

/* ═══════════ WIDOKI: KATALOG / PROMOCJE / NOWOŚCI ═══════════ */
function ustawStroneListyProduktow(n){stronaListyProduktow=Math.max(1,Number(n)||1);renderuj();}
function ustawLiczbeListyProduktow(n){
  produktyNaLiscie=[12,24,48,96].includes(Number(n))?Number(n):24;stronaListyProduktow=1;
  zapiszLS("artway_produkty_na_liscie",produktyNaLiscie);renderuj();
}
function listaPodstronyHTML(lista,pusty){
  let filtrowana=lista.filter(p=>produktPasujeFrazie(p,frazaListyProduktow));
  filtrowana=sortujListeProduktow(filtrowana,sortowanieListyProduktow);
  const stron=Math.max(1,Math.ceil(filtrowana.length/produktyNaLiscie));
  stronaListyProduktow=Math.min(Math.max(1,stronaListyProduktow),stron);
  const start=(stronaListyProduktow-1)*produktyNaLiscie,fragment=filtrowana.slice(start,start+produktyNaLiscie);
  return `
    <div class="toolbar" style="padding:0;margin:.6rem 0">
      <input placeholder="Szukaj w tej liście…" value="${esc(frazaListyProduktow)}" oninput="frazaListyProduktow=this.value;stronaListyProduktow=1;zaplanujRenderPoWpisaniu()" style="flex:1;min-width:200px;padding:.45rem .7rem;border:1.5px solid var(--line);border-radius:10px">
      <select onchange="sortowanieListyProduktow=this.value;stronaListyProduktow=1;renderuj()"><option value="default">Domyślne</option><option value="price-asc" ${sortowanieListyProduktow==="price-asc"?"selected":""}>Cena rosnąco</option><option value="price-desc" ${sortowanieListyProduktow==="price-desc"?"selected":""}>Cena malejąco</option><option value="name" ${sortowanieListyProduktow==="name"?"selected":""}>Nazwa A–Z</option><option value="rating" ${sortowanieListyProduktow==="rating"?"selected":""}>Najlepiej oceniane</option></select>
    </div>
    <div class="results-bar" style="padding:0;margin:.5rem 0"><span>${filtrowana.length?`Znaleziono <b>${filtrowana.length}</b> • pokazano ${start+1}–${Math.min(start+produktyNaLiscie,filtrowana.length)}`:"Brak wyników"}</span><label>Na stronie: <select onchange="ustawLiczbeListyProduktow(this.value)">${[12,24,48,96].map(n=>`<option value="${n}" ${produktyNaLiscie===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
    ${fragment.length?`<div class="grid" style="padding:0;margin:.7rem 0">${fragment.map(kartaProduktu).join("")}</div>`:`<div class="panel"><p>${pusty}</p></div>`}
    <div class="pagination">${paginacjaHTML(stronaListyProduktow,stron,"ustawStroneListyProduktow")}</div>`;
}
function listaPodstronyCentralnaHTML(params,pusty){
  const query={audience:"public",q:frazaListyProduktow,sort:sklepKatalogCentralnySort(sortowanieListyProduktow),page:stronaListyProduktow,limit:produktyNaLiscie,...params},view=sklepKatalogCentralnyWidok(query);
  if(!view.ready)return `<div class="panel"><p>${view.error?`⚠️ ${esc(view.error)}`:"Ładowanie aktualnej listy produktów…"}</p></div>`;
  const data=view.data,stron=Math.max(1,Math.ceil((Number(data.total)||0)/produktyNaLiscie));if(stronaListyProduktow>stron){stronaListyProduktow=stron;setTimeout(()=>renderuj(),0);return `<div class="panel"><p>Ładowanie właściwej strony wyników…</p></div>`;}const start=(stronaListyProduktow-1)*produktyNaLiscie,fragment=data.items||[];
  return `<div class="toolbar" style="padding:0;margin:.6rem 0"><input placeholder="Szukaj w tej liście…" value="${esc(frazaListyProduktow)}" oninput="frazaListyProduktow=this.value;stronaListyProduktow=1;zaplanujRenderPoWpisaniu()" style="flex:1;min-width:200px;padding:.45rem .7rem;border:1.5px solid var(--line);border-radius:10px"><select onchange="sortowanieListyProduktow=this.value;stronaListyProduktow=1;renderuj()"><option value="default">Domyślne</option><option value="price-asc" ${sortowanieListyProduktow==="price-asc"?"selected":""}>Cena rosnąco</option><option value="price-desc" ${sortowanieListyProduktow==="price-desc"?"selected":""}>Cena malejąco</option><option value="name" ${sortowanieListyProduktow==="name"?"selected":""}>Nazwa A–Z</option><option value="rating" ${sortowanieListyProduktow==="rating"?"selected":""}>Najlepiej oceniane</option></select></div><div class="results-bar" style="padding:0;margin:.5rem 0"><span>${data.total?`Znaleziono <b>${data.total}</b> • pokazano ${start+1}–${Math.min(start+fragment.length,data.total)}`:"Brak wyników"}</span><label>Na stronie: <select onchange="ustawLiczbeListyProduktow(this.value)">${[12,24,48,96].map(n=>`<option value="${n}" ${produktyNaLiscie===n?"selected":""}>${n}</option>`).join("")}</select></label></div>${fragment.length?`<div class="grid" style="padding:0;margin:.7rem 0">${fragment.map(kartaProduktu).join("")}</div>`:`<div class="panel"><p>${pusty}</p></div>`}<div class="pagination">${paginacjaHTML(stronaListyProduktow,stron,"ustawStroneListyProduktow")}</div>`;
}
function widokKategoria(nazwa){
  nazwa=wszystkieKategorie().find(k=>k===nazwa||seoSlugKategorii(k)===seoSlugKategorii(nazwa))||nazwa;
  if(!wszystkieKategorie().includes(nazwa))
    return `<div class="page"><div class="panel"><h1>Nie ma takiego katalogu 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`;
  const kategorie=wszystkieKategorie(),tree=indeksDrzewaKategoriiMenu(kategorie),galaz=kategorieGaleziMenu(nazwa,kategorie),lista=produkty.filter(p=>produktWidocznyWPublicznymKatalogu(p)&&galaz.has(p.kategoria)),liczba=chmuraKatalogCentralnyPubliczny?sklepKatalogCentralnyLiczbaKategorii(galaz):lista.length,dzieci=tree.children.get(nazwa)||[],sciezka=tree.paths[nazwa]||[nazwa];
  return `
  <div class="page" style="max-width:1200px">
    <div class="crumb"><a href="/" onclick="return nawigujSklep(event,'/')">Sklep</a> › ${sciezka.map((k,i)=>i===sciezka.length-1?esc(k):`<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">${esc(k)}</a>`).join(" › ")}</div>
    <h1 style="margin-bottom:.8rem">🗂️ ${esc(nazwa)} <small style="color:var(--muted2);font-size:.9rem">(${liczba})</small></h1>
    ${dzieci.length?`<section class="category-branch-grid" aria-label="Podkatalogi ${esc(nazwa)}">${dzieci.map(k=>{const podgalaz=kategorieGaleziMenu(k,kategorie),ile=chmuraKatalogCentralnyPubliczny?sklepKatalogCentralnyLiczbaKategorii(podgalaz):(tree.branchCounts[k]||0);return `<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))"><span>${ikonaKategoriiHTML(k)}</span><div><b>${esc(k)}</b><small>${ile} produktów${(tree.children.get(k)||[]).length?` • ${(tree.children.get(k)||[]).length} kolejnych gałęzi`:""}</small></div><i>›</i></a>`;}).join("")}</section>`:""}
    ${chmuraKatalogCentralnyPubliczny?listaPodstronyCentralnaHTML({categories:[...galaz].join(",")},"Ten katalog jest jeszcze pusty albo żaden produkt nie pasuje do wyszukiwania."):listaPodstronyHTML(lista,"Ten katalog jest jeszcze pusty albo żaden produkt nie pasuje do wyszukiwania.")}
  </div>`;
}
function widokListaSpecjalna(tytul, filtr, pusty){
  const lista = produkty.filter(p=>produktWidocznyWPublicznymKatalogu(p)&&filtr(p));
  const params=String(tytul).includes("Promocje")?{promotion:"promocje"}:{special:"nowosci"};
  return `
  <div class="page" style="max-width:1200px">
    <h1 style="margin-bottom:.8rem">${tytul} <small style="color:var(--muted2);font-size:.9rem">(${lista.length})</small></h1>
    ${chmuraKatalogCentralnyPubliczny?listaPodstronyCentralnaHTML(params,pusty):listaPodstronyHTML(lista,pusty)}
  </div>`;
}

/* ═══════════ WIDOK: PRODUKT ═══════════ */
let iloscProduktu = 1,ostatniProduktIlosci=null;
function specyfikacjaProduktuHTML(p){
  const wiersze=[
    ["Marka",p.marka],
    ["GTIN / EAN",p.gtin],
    ["EXTERNAL_ID",p.externalId],
    ["MPN",p.mpn],
    ["Kolor",p.kolorProduktu],
    ["Rozmiar / wymiary",p.rozmiar],
    ["Materiał",p.material]
  ].filter(([,v])=>String(v||"").trim());
  if(!wiersze.length)return "";
  return `<details open style="margin:.85rem 0">
    <summary style="cursor:pointer;font-weight:800">Specyfikacja produktu</summary>
    <table class="log-table" style="margin-top:.55rem">
      ${wiersze.map(([k,v])=>`<tr><th style="width:170px">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
    </table>
  </details>`;
}
function widokProdukt(id){
  const p = produktSklepuPoId(id);
  if(!p&&chmuraKatalogCentralnyPubliczny){const blad=sklepProduktCentralnyBledy.get(String(id));if(blad)return `<div class="page"><div class="panel"><h1>Nie znaleziono produktu 😕</h1><p>${esc(blad)}</p><button class="btn ghost" onclick="sklepPobierzProduktCentralny('${esc(id)}',true).then(()=>renderuj())">Spróbuj ponownie</button> <a class="btn ghost" href="/" onclick="return nawigujSklep(event,'/')">Wróć do sklepu</a></div></div>`;setTimeout(()=>sklepPobierzProduktCentralny(id).then(()=>renderuj()),0);return `<div class="page"><div class="panel"><h1>Ładowanie produktu…</h1><p>Pobieram aktualne dane z katalogu.</p></div></div>`;}
  if(!p){ loguj("ostrzezenie","Otwarto nieistniejący produkt: id="+id); return `<div class="page"><div class="panel"><h1>Nie znaleziono produktu 😕</h1><p><a href="#/">← Wróć do sklepu</a></p></div></div>`; }
  if(String(ostatniProduktIlosci)!==String(id)){iloscProduktu=1;ostatniProduktIlosci=id;}
  const powiazane = produkty.filter(x=>produktWidocznyWPublicznymKatalogu(x)&&x.kategoria===p.kategoria && x.id!==p.id).slice(0,4);
  const brakCeny = !produktMaCeneSprzedazy(p);
  const niedostepny = produktOznaczonyNiedostepny(p);
  const sciezkaKategorii=sciezkaKategoriiMenu(p.kategoria);
  return `
  <div class="page">
    <div class="crumb"><a href="/" onclick="return nawigujSklep(event,'/')">Sklep</a> › ${sciezkaKategorii.map(k=>`<a href="/kategoria/${seoSlugKategorii(k)}" onclick="return nawigujSklep(event,this.getAttribute('href'))">${esc(k)}</a>`).join(" › ")} › ${esc(p.nazwa)}</div>
    <div class="panel">
      <div class="prod-detail">
        <div>
          <div class="prod-thumb" style="background:${p.kolor||'#eef2f7'}">
            ${niedostepny?`<span class="badge" style="background:#64748b">Chwilowo niedostępne</span>`:(p.badge?`<span class="badge ${p.badge==='Nowość'?'new':''}">${esc(p.badge)}</span>`:"")}
            ${p.zdjecie?`<img id="glowneZdjecie" src="${esc(p.zdjecie)}" alt="${esc(p.nazwa)}">`:(p.ikona||"📦")}
          </div>
          ${(p.zdjecie && p.zdjecia?.length)?`
          <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
            ${[p.zdjecie,...p.zdjecia].map((z,i)=>`<img src="${esc(z)}" alt="Miniatura ${esc(p.nazwa)} — zdjęcie ${i+1}" onclick="pokazZdjecie('${esc(z)}')" style="width:62px;height:62px;object-fit:cover;border-radius:9px;border:2px solid ${i===0?'var(--brand)':'var(--line)'};cursor:pointer" onmouseover="this.style.borderColor='var(--brand)'" onmouseout="this.style.borderColor='var(--line)'">`).join("")}
          </div>`:""}
        </div>
        <div>
          <span class="cat-label">${esc(p.kategoria)}</span>
          <h1 style="margin:.2rem 0 .6rem">${esc(p.nazwa)}</h1>
          ${p.sku?`<p style="font-size:.76rem;color:var(--muted2);margin:-.3rem 0 .4rem">Kod produktu: ${esc(p.sku)}</p>`:""}
          <div class="price-row">
            <span class="price" style="font-size:1.7rem">${brakCeny?"Cena do uzupełnienia":zl(p.cena)}</span>
            ${p.staraCena?`<span class="old-price">${zl(p.staraCena)}</span>`:""}
          </div>
          ${brakCeny?`<p class="backend-note" style="text-align:left;margin:.4rem 0">Produkt został zaimportowany z ceną 0,00. Administrator musi uzupełnić cenę przed sprzedażą.</p>`:""}
          <p style="color:var(--muted2);font-size:1.02rem;line-height:1.55">${esc(opisKrotkiProduktu(p))}</p>
          ${specyfikacjaProduktuHTML(p)}
          ${p.warianty?.length?`
          <div class="f-group" style="max-width:260px;margin:.6rem 0 0"><label>Wybierz wariant *</label>
            <select id="wariantSel">${p.warianty.map(w=>`<option>${esc(w)}</option>`).join("")}</select>
          </div>`:""}
          <label class="product-detail-quantity">Ilość sztuk</label>
          <div class="qty-big" aria-label="Wybierz liczbę sztuk">
            <button type="button" onclick="zmienIloscProd(-1)" aria-label="Zmniejsz liczbę sztuk">−</button>
            <input id="prodQty" type="number" min="1" max="99" step="1" value="${esc(iloscProduktu)}" inputmode="numeric" aria-label="Liczba sztuk" oninput="ustawIloscProduktu(this.value)" onchange="ustawIloscProduktu(this.value)">
            <button type="button" onclick="zmienIloscProd(1)" aria-label="Zwiększ liczbę sztuk">+</button>
          </div>
          <div style="display:flex;gap:.7rem;flex-wrap:wrap">
            ${niedostepny||brakCeny
              ? `<button class="btn" disabled style="background:#94a3b8;cursor:not-allowed">${brakCeny?"Cena do uzupełnienia":"Chwilowo niedostępny"}</button>`
              : `<button class="btn" onclick="dodajIlosc(${jsArg(p.id)})">🛒 Do koszyka</button>`}
            ${jestAdmin()?"":`<button class="btn ghost" onclick="przelaczUlubione(${jsArg(p.id)});renderuj()">${ulubione.includes(p.id)?"❤️ W ulubionych":"🤍 Dodaj do ulubionych"}</button>`}
          </div>
          ${niedostepny
            ? `<p style="font-size:.83rem;color:var(--danger);margin-top:1rem;font-weight:600">✖ Chwilowo niedostępny — sprawdź później albo skontaktuj się ze sklepem</p>`
            : `<p style="font-size:.83rem;color:var(--ok);margin-top:1rem;font-weight:600">✔ Dostępny w sprzedaży • ${esc(tekstWysylki().toLowerCase())}</p>`}
          ${(()=>{ const o=sredniaOcen(p.id); return o?`<p style="font-size:.95rem;color:var(--accent);font-weight:700;margin-top:.3rem">${gwiazdki(o.srednia)} ${o.srednia.toFixed(1)} <small style="color:var(--muted2)">(${o.n} opinii)</small></p>`:""; })()}
        </div>
      </div>
    </div>
    <div class="prod-extra">
      <div class="info-card">
        <span style="font-size:1.5rem">🚚</span>
        <b>Dostawa InPost</b>
        <p>W koszyku wybierzesz paczkomat/punkt InPost albo Kuriera InPost. Darmowa dostawa od ${KONFIG.darmowaDostawaOd} zł.</p>
      </div>
      <div class="info-card">
        <span style="font-size:1.5rem">↩️</span>
        <b>14 dni na zwrot</b>
        <p>Po odebraniu produktu możesz odstąpić od umowy zgodnie z zasadami opisanymi na stronie zwrotów.</p>
      </div>
      <div class="info-card">
        <span style="font-size:1.5rem">🔒</span>
        <b>Jasne podsumowanie</b>
        <p>Przed zatwierdzeniem zobaczysz cenę produktów, koszt dostawy, rabat i ewentualną opłatę za płatność.</p>
      </div>
      <div class="info-card">
        <span style="font-size:1.5rem">💬</span>
        <b>Pytanie o ten produkt?</b>
        <p>Napisz na <a href="mailto:${esc(KONFIG.emailSklepu)}?subject=${encodeURIComponent("Pytanie o: "+p.nazwa)}">${esc(KONFIG.emailSklepu)}</a> i podaj nazwę produktu.</p>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <h2 style="margin-top:0">Informacje o produkcie</h2>
      <div class="faq-list">
        <details open><summary>Opis</summary>${opisProduktuHTML(p)}</details>
        <details><summary>Dostawa i płatność</summary><p>Dostępne metody oraz aktualne koszty sprawdzisz w koszyku. Aktualne płatności: ${esc(platnosciOpis())}. Wszystkie ceny są cenami brutto w PLN.</p></details>
        <details><summary>Zwrot i reklamacja</summary><p>Masz 14 dni na odstąpienie od umowy. W przypadku problemu z produktem skontaktuj się z nami przez stronę kontaktową.</p></details>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <h2 style="margin-top:0">⭐ Opinie klientów ${opinieProduktu(p.id).length?`(${opinieProduktu(p.id).length})`:""}</h2>
      ${opinieProduktu(p.id).length
        ? opinieProduktu(p.id).map(o=>`<div class="order-box"><div class="order-head"><b>${esc(o.autor)}</b><span style="color:var(--accent);font-weight:700">${gwiazdki(o.ocena)}</span><span>${esc(o.data)}</span></div><div class="order-lines">${esc(o.tekst)}</div></div>`).join("")
        : `<p style="color:var(--muted2);font-size:.9rem">Ten produkt nie ma jeszcze opinii — bądź pierwszy!</p>`}
      <h3 class="f-sekcja">✍️ Dodaj opinię</h3>
      <form onsubmit="dodajOpinie(event, ${jsArg(p.id)})" style="max-width:520px">
        <div class="f-row">
          <div class="f-group"><label>Twoje imię *</label><input required name="autor" maxlength="40"></div>
          <div class="f-group"><label>Ocena *</label><select name="ocena">
            <option value="5">★★★★★ — świetny</option><option value="4">★★★★☆ — dobry</option>
            <option value="3">★★★☆☆ — w porządku</option><option value="2">★★☆☆☆ — słaby</option>
            <option value="1">★☆☆☆☆ — zły</option></select></div>
        </div>
        <div class="f-group"><label>Twoja opinia *</label><textarea required name="tekst" rows="3" maxlength="600" placeholder="Jak sprawdza się produkt?"></textarea></div>
        <button class="btn" type="submit">Wyślij opinię</button>
        <p class="pay-note" style="text-align:left;margin-top:.5rem">Opinia pojawi się po akceptacji przez sklep.</p>
      </form>
    </div>
    ${powiazane.length?`<h2 class="related-h" style="padding:0;margin:1.6rem 0 .2rem">Podobne produkty</h2><div class="grid" style="padding:0;margin:.6rem 0 0">${powiazane.map(kartaProduktu).join("")}</div>`:""}
  </div>`;
}
function ustawIloscProduktu(value){iloscProduktu=Math.max(1,Math.min(99,Math.floor(Number(value)||1)));const e=$("prodQty");if(e)e.value=iloscProduktu;}
function zmienIloscProd(d){ustawIloscProduktu(iloscProduktu+Number(d||0));}
function dodajIlosc(id){
  const wariant = $("wariantSel")?.value || null;
  dodajWIlosci(id,iloscProduktu,null,wariant);
}
function pokazZdjecie(src){ const g=$("glowneZdjecie"); if(g) g.src=src; }

/* ═══════════ WIDOK: LOGOWANIE / REJESTRACJA ═══════════ */
