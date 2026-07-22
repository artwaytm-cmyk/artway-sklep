async function agentAIZlecenieProducentaTekst(){
  const docs=(await agentAIUzgodnijPlanZSerwerem({silent:true})).filter(agentAIPlanDokumentAktywny);
  if(!docs.length)return "Nie ma nowych braków; kanoniczny Plan zatowarowania na serwerze nie zawiera aktywnych dokumentów producentów.";
  return docs.slice(0,20).map(agentAIFormatZleceniaProducenta).join("\n\n");
}
function agentAIProduktyDlaOfertyAllegro(fraza=""){
  const q=agentAINormalizuj(fraza),slowa=q.split(" ").filter(Boolean);
  if(!q)return [];
  return produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p)).map(p=>{
    const nazwa=agentAINormalizuj(p.nazwa||""),hay=agentAINormalizuj([p.nazwa,p.sku,p.externalId,p.gtin,p.ean,p.kodProducenta,p.mpn,p.id].filter(Boolean).join(" "));
    let score=nazwa===q?100:nazwa.includes(q)?95:hay.includes(q)?92:slowa.every(w=>hay.includes(w))?80:0;
    return score?{p,score}:null;
  }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.p.nazwa).localeCompare(String(b.p.nazwa),"pl"));
}
async function agentAIWykonajOferteAllegro(fraza="",publicationAction="keep"){
  if(!allegroStan.sprawdzono)await allegroWczytajDane(true);
  const trafienia=agentAIProduktyDlaOfertyAllegro(fraza);
  if(!trafienia.length)return `Nie znalazłem produktu „${fraza}”. Podaj dokładniejszą nazwę, SKU albo EAN.`;
  const best=trafienia[0],remis=trafienia.filter(x=>x.score===best.score);
  if(remis.length>1)return [`Znalazłem kilka produktów. Doprecyzuj nazwę, SKU albo EAN:`,...remis.slice(0,8).map(x=>`• ${x.p.nazwa} — ID ${x.p.id}, SKU ${x.p.sku||x.p.externalId||"—"}, EAN ${x.p.gtin||x.p.ean||"—"}`)].join("\n");
  const p=best.p,baseStock=allegroStanOfertyProduktu(p),stock=publicationAction==="activate"?Math.max(1,baseStock):baseStock;
  const d=await chmura("allegro-create-product-offer",{method:"POST",body:{product:p,options:{stock,publicationAction,publishNow:publicationAction==="activate"}},timeout:120000});
  allegroOstatniBladWystawienia=null;
  allegroZapiszWynikOperacji(p,d);allegroZapiszAutoUzupelnienia(p,d);allegroZastosujWynikWystawienia(p,d);
  if(d.offer?.id){
    const categoryId=d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||p.allegroCategoryId||"";
    const productId=d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||p.allegroProductId||"";
    produktyEdytowane[p.id]={...(produktyEdytowane[p.id]||{}),allegroOfferId:String(d.offer.id),...(categoryId?{allegroCategoryId:String(categoryId)}:{}),...(productId?{allegroProductId:String(productId)}:{})};
    zapiszLS("artway_produkty_edytowane",produktyEdytowane);
  }
  await chmuraWczytajStan().catch(()=>{});await allegroWczytajDane(true).catch(()=>{});zbudujProdukty();
  const updated=d.mode==="updated";
  const finalStatus=d.offer?.publication?.status||d.offer?.status||(publicationAction==="activate"?"ACTIVE":"INACTIVE");
  return [`✅ ${updated?"Znalazłem istniejącą ofertę i ją zaktualizowałem":finalStatus==="ACTIVE"?"Utworzyłem i aktywowałem nową ofertę":"Utworzyłem nowy szkic oferty"}: ${p.nazwa}.`,`Oferta: ${d.offer?.id||"—"}; status: ${finalStatus}; stan oferty Allegro: ${stock} szt. • stan magazynu pozostał bez zmian.`,`${d.duplicatePrevented?`Duplikat zablokowany — rozpoznano po ${d.match?.reason||"danych produktu"}.`:"Zapisano nowe potrójne powiązanie."}`,`Katalog: ${d.autoFilled?.allegroProductId||d.catalogMatch?.selected?.id||"—"}; kategoria: ${d.autoFilled?.allegroCategoryId||d.catalogMatch?.selected?.categoryId||"—"}.`].join("\n");
}
async function agentAIOdpowiedzPrzezCodex(tekst=""){
  const requestId=`panel-${Date.now().toString(36)}-${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
  const queued=await chmura("codex-agent-panel-enqueue",{method:"POST",body:{requestId,text:String(tekst||"").slice(0,2000)},timeout:15000});
  if(!queued?.jobId)throw new Error("Serwer nie utworzył zadania dla Codex.");
  const box=$("agentAICommandLiveResult");
  if(box){box.hidden=false;box.className="agent-response-card agent-command-live-result";box.innerHTML=`<div class="agent-response-head"><b>🧠 Codex analizuje polecenie</b><small>bezpieczny plan i wykonanie</small></div><pre class="agent-answer-pre">Rozpoznaję zamiar i dobieram dozwoloną operację strony…</pre>`;}
  for(let attempt=0;attempt<45;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    const result=await chmura("codex-agent-result",{method:"POST",body:{id:queued.jobId},timeout:10000});
    if(result.status==="completed")return result.response||"Codex zakończył zadanie bez treści odpowiedzi.";
    if(result.status==="failed")throw new Error(result.error||"Codex nie wykonał zadania po trzech próbach.");
  }
  throw new Error("Codex nadal analizuje polecenie. Komputer z Agentem musi być włączony; spróbuj ponownie za chwilę.");
}
async function agentAIWykonajPolecenie(tekst=""){
  const intent=agentAIRozpoznajPolecenie(tekst);
  let odpowiedz="";
  try{
    if(intent.typ==="pomoc"){
      odpowiedz=["Możesz pisać normalnie, np.:","• mam obecnie na stanie Ziemniaka 1410 8 szt — Agent utworzy decyzję i zapyta o lokalizację","• przyjmij 8 szt produktu EAN 590... — po lokalizacji pojawi się osobne Potwierdzam / Nie potwierdzam","• lokalizacja IV… A-R01-P01 — przypisz miejsce do konkretnej decyzji","• potwierdzam IV… — potwierdź tylko wskazaną decyzję","• sprawdź link https://... i znajdź dane produktu","• wykonaj bezpieczny plan agenta","• sprawdź samą funkcjonalność strony","• pobierz świeże dane ze wszystkich źródeł","• ponów błędne kroki","• pokaż centrum operacyjne / co mam dziś zrobić?","• wyślij raport na Telegram","• pokaż komunikację z klientami","• sprawdź wysyłki i etykiety InPost","• audyt produktów i katalogu","• status producentów i otwartych zamówień","• diagnostyka integracji","• wystaw Origami Kot na Allegro","• sprawdź zlecenia Allegro i braki do pakowania","• przygotuj zamówienie do producenta","• czego brakuje do zamówień?","• pokaż stan magazynu","• sprawdź dostępność u producentów","• popraw opisy produktów","• ile mamy szachy?","• zapamiętaj: przy brakach najpierw sprawdź dostawcę","• synchronizuj bazę"].join("\n");
    }else if(intent.typ==="magazyn-decyzja"){
      odpowiedz=await agentAIWykonajDecyzjeMagazynowa(intent);
    }else if(intent.typ==="magazyn-stan-zmiana"){
      odpowiedz=await agentAIWykonajZmianeStanu(intent);
    }else if(intent.typ==="plan-wykonaj"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("full");
    }else if(intent.typ==="plan-data"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("data");
    }else if(intent.typ==="plan-health"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("health");
    }else if(intent.typ==="plan-retry"){
      odpowiedz=await agentAIWykonajPlanBezpieczny("retry");
    }else if(intent.typ==="link-producenta-analiza"){
      const wynik=await agentAISprawdzLinkProducenta(intent.url,true);
      if(wynik?.blad)odpowiedz=`Nie udało się teraz odczytać linku. Zaplanowałem kolejną próbę: ${wynik.rec?.nextRetryAt?new Date(wynik.rec.nextRetryAt).toLocaleString("pl-PL"):"później"}. Powód: ${wynik.blad.message||wynik.blad}`;
      else{const d=wynik?.dane||{},alts=d.alternatives||[],audit=agentAIOcenaDodaniaProduktu(d.product||{},d);odpowiedz=[d.needsChoice?`Znalazłem ${alts.length} możliwe produkty — nie zgaduję, wybierz wariant w sekcji Linki producentów.`:`Znalazłem produkt: ${d.product?.nazwa||"bez nazwy"}.`,`Kompletność danych: ${d.confidence||0}%. Gotowość do dodania: ${audit.score}%. Braki: ${(wynik.braki||[]).join(", ")||"brak"}.`,`EAN: ${d.product?.ean||d.product?.gtin||"—"} • kod producenta: ${d.product?.kodProducenta||d.product?.mpn||"—"}.`,`Opis: ${String(d.product?.opis||"").length} znaków • zdjęcia: ${[d.product?.zdjecie,...(d.product?.zdjecia||[])].filter(Boolean).length}.`,audit.blockingDuplicate?`Zablokowałem duplikat: istnieje produkt #${audit.blockingDuplicate.product.id} ${audit.blockingDuplicate.product.nazwa}.`:intent.addProduct&&!d.needsChoice?"Przygotowuję bezpieczny formularz dodania produktu — przed zapisem zobaczysz kontrolę duplikatów i kompletności.":"",d.fromCache?`Użyłem pamięci Agenta z ${d.cacheSavedAt?new Date(d.cacheSavedAt).toLocaleString("pl-PL"):"poprzedniej kontroli"}.`:"",d.repaired?`Naprawiony adres: ${d.resolvedUrl||d.canonicalUrl}`:"",...alts.slice(0,5).map((x,i)=>`${i+1}. ${x.product?.nazwa||"Produkt"} • ${x.confidence||0}% • ${x.url}`)].filter(Boolean).join("\n");if(intent.addProduct&&!d.needsChoice&&!audit.blockingDuplicate&&wynik.rec?.id)setTimeout(()=>agentAIWypelnijNowyProduktZLinku(wynik.rec.id),700);}
    }else if(intent.typ==="centrum"){
      odpowiedz=agentAICentrumTekst();
    }else if(intent.typ==="komunikacja"){
      odpowiedz=agentAIKomunikacjaTekst();
    }else if(intent.typ==="wysylki"){
      odpowiedz=agentAIWysylkiTekst();
    }else if(intent.typ==="produkty-audyt"){
      odpowiedz=agentAIProduktyAudytTekst();
    }else if(intent.typ==="producenci"){
      odpowiedz=agentAIProducenciTekst();
    }else if(intent.typ==="diagnostyka"){
      odpowiedz=agentAIDiagnostykaTekst();
    }else if(intent.typ==="raport-telegram"){
      const d=await agentAIWyslijRaportTelegram();odpowiedz=d?`Raport centrum operacyjnego został wysłany na Telegram. Kondycja strony: ${d.center?.score??"—"}%. Wiadomość zawiera przyciski do Agenta, zamówień, magazynu, Allegro i wysyłek.`:"Nie udało się wysłać raportu na Telegram.";
    }else if(intent.typ==="pamiec-zapis"){
      const rec=agentAIZapiszPamiec(intent.tresc||"");
      odpowiedz=rec?`Zapamiętałem na przyszłość: ${rec.wyzwalacz?`gdy „${rec.wyzwalacz}” → `:""}${rec.akcja}`:"Nie podałeś treści do zapamiętania. Napisz np. „zapamiętaj: przy brakach najpierw sprawdź dostawcę”.";
    }else if(intent.typ==="pamiec-lista"){
      odpowiedz=agentAIPamiecTekst();
    }else if(intent.typ==="lokalizacje"){
      odpowiedz=agentAILokalizacjeTekst();
    }else if(intent.typ==="opisy"){
      odpowiedz=agentAIOpisyTekst();
    }else if(intent.typ==="opisy-popraw"){
      odpowiedz=agentAIPoprawOpisyProduktow(40);
      renderuj();
    }else if(intent.typ==="linki-producentow"){
      odpowiedz=agentAILinkiProducentowTekst();
    }else if(intent.typ==="linki-producentow-sprawdz"){
      odpowiedz=await agentAISprawdzLinkiProducentow(5);
    }else if(intent.typ==="dostepnosc-producentow-sprawdz"){
      const d=await agentAISprawdzDostepnoscProducentow();const s=d?.summary||{};
      odpowiedz=d?`Wyrywkowo sprawdziłem ${s.checked||0} produktów u producentów. Dostępne: ${s.available||0}, niski stan: ${s.low||0}, brak: ${s.unavailable||0}, niepotwierdzone: ${s.unknown||0}. Próg ostrzeżenia: ${s.threshold||50} szt.`:"Nie udało się zakończyć monitoringu producentów.";
    }else if(intent.typ==="lokalizacja-dodaj"){
      if(!intent.kod){
        odpowiedz="Podaj kod lokalizacji, np. „utwórz lokalizację R1-P1”.";
      }else if(magazynLokalizacjaPoKodzie(intent.kod)){
        odpowiedz=`Lokalizacja ${intent.kod} już istnieje. Możesz ją edytować w Magazyn → Lokalizacje.`;
      }else{
        magazynLokalizacje=[{id:"LOC-"+Date.now().toString(36),kod:intent.kod,nazwa:"",typ:"regał",strefa:"",pojemnosc:0,priorytet:999,uwagi:"Utworzone przez Agenta AI",aktywna:true,utworzono:new Date().toISOString(),aktualizacja:new Date().toISOString(),operator:sesja?.email||"administrator"},...(Array.isArray(magazynLokalizacje)?magazynLokalizacje:[])].slice(0,1000);
        zapiszLS("artway_magazyn_lokalizacje",magazynLokalizacje);
        odpowiedz=`Utworzyłem lokalizację ${intent.kod}. Uzupełnij nazwę/strefę/pojemność w Magazyn → Lokalizacje.`;
      }
    }else if(intent.typ==="sync"){
      await synchronizujBazeCentralna(true);
      odpowiedz="Synchronizacja bazy została uruchomiona. Dane z panelu powinny być zapisane i odświeżone na serwerze.";
    }else if(intent.typ==="faktury"){
      const przed=szkiceFaktur.length;
      utworzSzkiceFakturMasowo();
      odpowiedz=`Sprawdziłem szkice FV. Przed akcją było ich ${przed}, teraz jest ${szkiceFaktur.length}.`;
    }else if(intent.typ==="export-magazyn"){
      eksportujMagazynCSV();
      odpowiedz="Eksport magazynu CSV został przygotowany do pobrania.";
    }else if(intent.typ==="audyt-magazynu"){
      audytMagazynuAI();
      odpowiedz="Audyt magazynu JSON został przygotowany do pobrania.";
    }else if(intent.typ==="kartoteka-domyslna"){
      wypelnijDomyslnaKartotekeMagazynu();
      odpowiedz="Uzupełniłem domyślne pola kartoteki tam, gdzie było to bezpieczne.";
    }else if(intent.typ==="allegro-oferta"){
      odpowiedz=await agentAIWykonajOferteAllegro(intent.query,intent.publicationAction||"keep");
    }else if(intent.typ==="allegro-zlecenia"){
      odpowiedz=agentAIAllegroZleceniaTekst();
    }else if(intent.typ==="sprawdz"||intent.typ==="zamowienia"){
      odpowiedz=agentAIZamowieniaTekst();
    }else if(intent.typ==="zlecenie"){
      odpowiedz=await agentAIZlecenieProducentaTekst();
    }else if(intent.typ==="braki"){
      odpowiedz=agentAIBrakiTekst();
    }else if(intent.typ==="status"){
      odpowiedz=agentAIStatusTekst();
    }else if(intent.typ==="magazyn"){
      odpowiedz=agentAIMagazynTekst();
    }else if(intent.typ==="produkt"){
      odpowiedz=agentAIProduktTekst(intent.query);
    }else{
      const pamiec=agentAIZnajdzPamiecDlaPolecenia(tekst);
      odpowiedz=pamiec.length
        ? ["Znalazłem pasujące zapamiętane procedury:",...pamiec.map(x=>`• ${x.wyzwalacz?`Gdy: ${x.wyzwalacz} → `:""}${x.akcja||x.tresc}`)].join("\n")
        : await agentAIOdpowiedzPrzezCodex(tekst);
    }
    zapiszHistorieAgenta("komenda",`Polecenie z panelu: ${tekst}`,{polecenie:tekst,intencja:intent.typ,tryb:intent.tryb||"",odpowiedz});
    loguj("info",`Agent AI/panel: ${intent.typ} — ${tekst}`);
    return {intent,odpowiedz,stabilnyWidok:["magazyn-stan-zmiana","magazyn-decyzja"].includes(intent.typ)};
  }catch(err){
    odpowiedz=`Nie udało się wykonać polecenia: ${err?.message||err}`;
    zapiszHistorieAgenta("komenda",`Błąd polecenia z panelu: ${tekst}`,{polecenie:tekst,intencja:intent.typ,tryb:intent.tryb||"",odpowiedz,blad:String(err?.message||err)});
    loguj("error",`Agent AI/panel błąd: ${err?.message||err}`);
    return {intent,odpowiedz,blad:err,stabilnyWidok:["magazyn-stan-zmiana","magazyn-decyzja"].includes(intent.typ)};
  }
}
function agentAIPokazWynikKomendyStabilnie(wynik={}){
  const box=$("agentAICommandLiveResult"),cloud=$("agentAICommandCloudState");
  if(box){
    box.hidden=false;
    box.className=`agent-response-card agent-command-live-result${wynik.blad?" is-error":""}`;
    box.innerHTML=`<div class="agent-response-head"><b>${wynik.blad?"⚠️ Polecenie nie zostało zapisane":"✅ Wynik polecenia magazynowego"}</b><small>${esc(new Date().toLocaleString("pl-PL"))}</small></div><pre class="agent-answer-pre">${esc(wynik.odpowiedz||"")}</pre>`;
  }
  if(cloud){
    cloud.className=`lvl ${chmuraStan.dostepna?"lvl-ok":"lvl-blad"}`;
    cloud.textContent=chmuraStan.dostepna?`chmura • rewizja ${chmuraStan.rev||0}`:"brak połączenia z chmurą";
  }
}
async function agentAIPrzyjmijKomende(e){
  if(e) e.preventDefault();
  const input=$("agentAICommandInput"), tekst=String(input?.value||"").trim();
  if(!tekst){ toast("Wpisz polecenie dla agenta"); return false; }
  const btn=e?.submitter;
  if(btn) btn.disabled=true;
  const wynik=await agentAIWykonajPolecenie(tekst);
  toast(wynik.blad?"Agent zapisał błąd polecenia":["magazyn-stan-zmiana","magazyn-decyzja"].includes(wynik.intent?.typ)?"Agent obsłużył bezpieczny krok decyzji ✅":"Agent AI wykonał polecenie ✅");
  if(input) input.value="";
  if(btn) btn.disabled=false;
  if(wynik.stabilnyWidok)agentAIPokazWynikKomendyStabilnie(wynik);else renderuj();
  setTimeout(()=>{$("agentAICommandInput")?.focus();},30);
  return false;
}
function agentAIWstawKomende(tekst){
  const input=$("agentAICommandInput");
  if(!input) return;
  input.value=tekst;
  input.focus();
}
function agentAIHashTekstu(value=""){
  let hash=2166136261;
  for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function agentAIOdciskZadania(task={}){
  const id=String(task.id||"zadanie"),poziom=String(task.poziom||"ok");
  const opis=id==="synchronizacja-danych"?poziom:String(task.opis||"").replace(/\s+/g," ").trim().toLowerCase();
  return `${id}:${agentAIHashTekstu(`${poziom}|${opis}`)}`;
}
function agentAIProduktyWdrozenie(){
  const addedIds=new Set((produktyDodane||[]).map(p=>String(p.id)));
  return produktyDoAdministracji().filter(p=>addedIds.has(String(p.id))&&p.agentOnboardingStatus&&p.agentOnboardingStatus!=="completed");
}
function agentAISynchronizujCyklZadan(analiza=[]){
  const now=new Date().toISOString(),next={...(agentAIPlanCykl&&typeof agentAIPlanCykl==="object"?agentAIPlanCykl:{})};let changed=false;
  for(const task of analiza){
    const id=String(task.id||"");if(!id)continue;
    const fingerprint=agentAIOdciskZadania(task),current=next[id];
    if(task.poziom==="ok"){
      if(current&&current.state!=="resolved"){
        next[id]={...current,state:"resolved",resolvedAt:now,lastStatus:"ok",updatedAt:now};changed=true;
      }
      continue;
    }
    if(!current||current.state==="resolved"||current.fingerprint!==fingerprint){
      next[id]={id,fingerprint,state:"open",title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",firstSeenAt:now,updatedAt:now};changed=true;
    }else if(current.title!==task.tytul||current.description!==task.opis||current.severity!==task.poziom){
      next[id]={...current,title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",updatedAt:now};changed=true;
    }
  }
  if(changed){agentAIPlanCykl=next;zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);zaplanujZapisUstawien();}
  return next;
}
function agentAIAnalizaAktywna(analiza=agentAIAnaliza()){
  const cycle=agentAISynchronizujCyklZadan(analiza);
  return analiza.filter(task=>task.poziom!=="ok"&&!(cycle[task.id]?.state==="done"&&cycle[task.id]?.fingerprint===agentAIOdciskZadania(task)));
}
function agentAIOznaczZadanieWykonane(id,source="administrator"){
  const analiza=agentAIAnaliza(),task=analiza.find(x=>String(x.id)===String(id));if(!task)return;
  agentAISynchronizujCyklZadan(analiza);
  const now=new Date().toISOString(),fingerprint=agentAIOdciskZadania(task),current=agentAIPlanCykl[id]||{};
  agentAIPlanCykl={...agentAIPlanCykl,[id]:{...current,id:String(id),fingerprint,state:"done",title:task.tytul||id,description:task.opis||"",severity:task.poziom||"warn",completedAt:now,completedBy:sesja?.email||"administrator",completionSource:source,updatedAt:now}};
  zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);
  zapiszHistorieAgenta("zadanie-wykonane",`Zakończono zadanie planu: ${task.tytul}`,{taskId:id,fingerprint,source,opis:task.opis||""});
  zaplanujZapisUstawien();toast("✅ Zadanie przeniesiono do historii. Wróci tylko, gdy pojawi się nowy problem.");renderuj();
}
function agentAIPrzywrocZadanie(id){
  const current=agentAIPlanCykl?.[id];if(!current)return;
  agentAIPlanCykl={...agentAIPlanCykl,[id]:{...current,state:"open",reopenedAt:new Date().toISOString(),reopenedBy:sesja?.email||"administrator",updatedAt:new Date().toISOString()}};
  zapiszLS("artway_agent_ai_plan_cykl",agentAIPlanCykl);zapiszHistorieAgenta("zadanie-przywrocone",`Przywrócono zadanie planu: ${current.title||id}`,{taskId:id});zaplanujZapisUstawien();renderuj();
}
function agentAIAnaliza(){
  const zam=pobierzZamowienia(), produktyAdmin=produktyDoAdministracji().filter(p=>!czyProduktAdminWKoszu(p));
  const aktywne=zam.filter(z=>!["anulowane","zakończone","dostarczone"].includes(String(z.status||"").toLowerCase()));
  const firmoweBezSzkicu=zam.filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  const doPotwierdzenia=zam.filter(z=>z.wymagaPotwierdzeniaDostepnosci);
  const bezNumeru=aktywne.filter(z=>!daneWysylki(z).numer);
  const bezCeny=produktyAdmin.filter(p=>!produktMaCeneSprzedazy(p));
  const niedostepne=produktyAdmin.filter(produktOznaczonyNiedostepny);
  const bezZdjec=produktyAdmin.filter(p=>!p.zdjecie);
  const prog=Number(ustawieniaMagazynuPelne().progNiski)||5, rez=rezerwacjeMagazynowe();
  const niskiStan=produktyAdmin.filter(p=>{const s=stanMagazynuId(p.id);return s!==null&&s<=progNiskiProduktu(p);});
  const plan=potrzebyZatowarowania(),planIds=new Set(plan.map(x=>String(x.produkt?.id||"")));
  const nadrezerwacje=produktyAdmin.filter(p=>{const d=dostepneSztukiMagazynu(p,rez);return d!==null&&d<0;});
  const brakKartoteki=produktyAdmin.filter(p=>planIds.has(String(p.id))&&!magazynMetaProduktu(p.id).dostawca);
  const bezMonitoringu=produktyAdmin.filter(p=>stanMagazynuId(p.id)===null);
  const stareInwentaryzacje=produktyAdmin.filter(p=>{
    const s=stanMagazynuId(p.id), d=magazynMetaProduktu(p.id).ostatniaInwentaryzacja;
    if(s===null) return false;
    if(!d) return true;
    return (Date.now()-new Date(d).getTime())>90*86400000;
  });
  const lokAktywne=magazynLokalizacjeAktywne(), statLok=statystykiLokalizacji(produktyAdmin), lokPozaSlownikiem=Object.keys(statLok).filter(k=>k!=="BRAK"&&!magazynLokalizacjaPoKodzie(k));
  const nadwyzki=agentAINadwyzkiDoPrzyjecia();
  const linkiProd=agentAILinkiOczekujace(),linkiDoWyboru=linkiProd.filter(x=>String(x.status||"").toLowerCase()==="wymaga wyboru"),linkiDoPonowienia=agentAILinkiGotoweDoPonowienia();
  const monitoringProducentow=statystykiDostepnosciProducentow(), alertyProducentow=[...monitoringProducentow.braki,...monitoringProducentow.niskie];
  const opisyDoPoprawy=agentAIProduktyZProblememOpisu(500);
  const produktyWdrozenie=agentAIProduktyWdrozenie();
  const allegroKontrola=aktywneZamowieniaAllegro().map(z=>({z,a:allegroAnalizaMagazynowaZamowienia(z)}));
  const allegroBraki=allegroKontrola.filter(x=>x.a.braki>0||x.a.nierozpoznane>0);
  const lokalizacjeDoUstalenia=new Map(),dodajBrakLokalizacji=p=>{const id=String(p?.produkt?.id??p?.id??"");if(id&&!lokalizacjeDoUstalenia.has(id))lokalizacjeDoUstalenia.set(id,p.produkt||produktMagazynowy(id)||{id,nazwa:p.nazwa||`Produkt ${id}`});};
  allegroKontrola.flatMap(x=>x.a.pozycje||[]).filter(p=>p.brakLokalizacji).forEach(dodajBrakLokalizacji);
  aktywne.flatMap(z=>pozycjeZamowieniaMagazyn(z)).forEach(p=>{const stan=stanMagazynuId(p.id),meta=magazynMetaProduktu(p.id);if(stan!==null&&stan>=Number(rez[p.id]||0)&&!meta.lokalizacja)dodajBrakLokalizacji(p);});
  const allegroOfertaTasks=allegroAktywneZadaniaAgentaOfert();
  const allegroDefaultsIssues=Object.values(allegroStan.offerDefaultsAudit?.items||{}).filter(x=>!x.stockUpdated||!x.republishUpdated);
  const problemyFunkcji=[!chmuraStan.dostepna?"wspólna baza":null,stanBramki.sprawdzono&&stanBramki.email?.configured===false?"e-mail":null,stanBramki.sprawdzono&&stanBramki.inpost?.configured===false?"InPost":null,allegroStan.sprawdzono&&!allegroStan.connected?"Allegro":null,infaktStan.sprawdzono&&!infaktStan.connected?"inFakt":null].filter(Boolean);
  const syncTime=Date.parse(chmuraStan.updated_at||""),syncAge=Number.isFinite(syncTime)?Math.max(0,Math.round((Date.now()-syncTime)/60000)):null,syncStale=syncAge!==null&&syncAge>5;
  const pozycje=[
    {id:"funkcjonalnosc-strony",poziom:problemyFunkcji.length?"bad":"ok",ikona:"🩺",tytul:"Funkcjonalność strony — priorytet 1",opis:problemyFunkcji.length?`Kontroli wymagają: ${problemyFunkcji.join(", ")}.`:`Baza i sprawdzone integracje krytyczne odpowiadają poprawnie.`,akcja:problemyFunkcji.length?"#/admin/system/diagnostyka":"plan-bezpieczny"},
    {id:"synchronizacja-danych",poziom:!chmuraStan.admin?"bad":syncStale?"warn":"ok",ikona:"🔄",tytul:"Pobieranie i świeżość danych — priorytet 2",opis:!chmuraStan.admin?"Agent nie ma aktywnego dostępu do wspólnej bazy.":syncAge===null?"Brak potwierdzonego czasu ostatniej synchronizacji.":`Ostatnia synchronizacja wspólnej bazy: ${syncAge} min temu.`,akcja:"plan-bezpieczny"},
    {id:"wdrozenie-produktow",poziom:produktyWdrozenie.some(p=>p.agentOnboardingStatus==="needs_attention")?"bad":produktyWdrozenie.length?"warn":"ok",ikona:"✨",tytul:"Nowe produkty administratora — wdrożenie Agenta",opis:produktyWdrozenie.length?`${produktyWdrozenie.length} nowych produktów wymaga dokończenia kontroli danych, duplikatów, opisów, zdjęć, producenta, kategorii sklepu lub przygotowania Allegro.`:"Każdy nowy produkt administratora przeszedł pełną kontrolę Agenta.",akcja:"#/admin/agent-ai/produkty"},
    {id:"allegro-magazyn",poziom:allegroBraki.length?"bad":"ok",ikona:"🟠",tytul:"Zlecenia Allegro — braki i pakowanie",opis:allegroBraki.length?`${allegroBraki.length} aktywnych zleceń Allegro wymaga zamówienia brakujących sztuk albo poprawy EAN/SKU.`:`${allegroKontrola.length} aktywnych zleceń Allegro sprawdzono; stany pozwalają na kompletację.`,akcja:"#/admin/allegro/zamowienia"},
    {id:"lokalizacje-kompletacja",poziom:lokalizacjeDoUstalenia.size?"warn":"ok",ikona:"📍",tytul:"Magazyn — lokalizacje do kompletacji",opis:lokalizacjeDoUstalenia.size?`${lokalizacjeDoUstalenia.size} produktów z aktywnych zamówień ma pokrycie w stanie, ale nie ma przypisanego miejsca. Towar pozostaje zarezerwowany; magazyn ustala lokalizację osobno.`:"Towar do aktywnych zamówień ma przypisane lokalizacje albo nie wymaga jeszcze kompletacji.",akcja:"#/admin/magazyn/stany"},
    {id:"allegro-oferty-agent",poziom:allegroOfertaTasks.length?"warn":"ok",ikona:"🏷️",tytul:"Agent ofert Allegro",opis:allegroOfertaTasks.length?`${allegroOfertaTasks.length} produktów ma zapisane braki danych albo błąd API wystawiania.`:"Brak otwartych zadań dotyczących ofert Allegro.",akcja:"#/admin/allegro/wystawianie"},
    {id:"allegro-ustawienia-ofert",poziom:allegroDefaultsIssues.length?"warn":"ok",ikona:"♻️",tytul:"Oferty Allegro — stan i wznawianie",opis:allegroDefaultsIssues.length?`${allegroDefaultsIssues.length} starszych ofert wymaga uzupełnienia danych wymaganych przez Allegro, aby włączyć automatyczne wznawianie. Domyślny stan sprzedażowy ${allegroStanOfertyProduktu()} jest niezależny od magazynu.`:`Oferty mają ustawiony domyślny stan ${allegroStanOfertyProduktu()} szt. i automatyczne wznawianie.`,akcja:"#/admin/allegro/ustawienia"},
    {id:"dostepnosc",poziom:doPotwierdzenia.length?"warn":"ok",ikona:"🔎",tytul:"Zamówienia do potwierdzenia dostępności",opis:doPotwierdzenia.length?`${doPotwierdzenia.length} zamówień ma pozycje powyżej ${LIMIT_POTWIERDZENIA_DOSTEPNOSCI} szt.`:"Brak zamówień wymagających potwierdzenia ilości.",akcja:"#/admin/zamowienia"},
    {id:"wysylki",poziom:bezNumeru.length?"warn":"ok",ikona:"🚚",tytul:"Przesyłki bez numeru nadania",opis:bezNumeru.length?`${bezNumeru.length} aktywnych zleceń czeka na numer/etykietę InPost.`:"Aktywne przesyłki mają komplet podstawowych danych.",akcja:"#/admin/wysylki"},
    {id:"faktury",poziom:firmoweBezSzkicu.length?"warn":"ok",ikona:"🧾",tytul:"Szkice FV / inFakt",opis:firmoweBezSzkicu.length?`${firmoweBezSzkicu.length} zamówień firmowych nie ma jeszcze szkicu FV.`:"Szkice FV są przygotowane dla zamówień firmowych.",akcja:"masowe-fv"},
    {id:"ceny",poziom:bezCeny.length?"bad":"ok",ikona:"💰",tytul:"Produkty bez ceny",opis:bezCeny.length?`${bezCeny.length} produktów wymaga uzupełnienia ceny przed sprzedażą.`:"Ceny produktów są poprawne.",akcja:"#/admin/produkty"},
    {id:"sprzedaz",poziom:niedostepne.length?"warn":"ok",ikona:"🛒",tytul:"Produkty wyłączone ze sprzedaży",opis:niedostepne.length?`${niedostepne.length} produktów jest oznaczonych jako chwilowo niedostępne.`:"Wszystkie aktywne produkty są dostępne w sprzedaży.",akcja:"#/admin/magazyn"},
    {id:"dostepnosc-producentow",poziom:monitoringProducentow.wymagajaDecyzji.length||monitoringProducentow.braki.length?"bad":monitoringProducentow.niskie.length||monitoringProducentow.nieznane.length?"warn":"ok",ikona:"🏭",tytul:"Dostępność u producentów",opis:monitoringProducentow.wymagajaDecyzji.length?`${monitoringProducentow.wymagajaDecyzji.length} produktów wymaga decyzji: pozostawić sprzedaż na określony czas, ukryć lub włączyć automatyczne wznowienie.`:alertyProducentow.length?`${monitoringProducentow.braki.length} braków i ${monitoringProducentow.niskie.length} niskich stanów u producentów ma zapisaną decyzję. Próg: ${ustawieniaMagazynuPelne().progNiskiProducenta} szt.`:`Monitorowanych linków: ${monitoringProducentow.products.length}; do odświeżenia lub bez potwierdzenia: ${monitoringProducentow.nieznane.length}.`,akcja:"#/admin/magazyn/dostawcy"},
    {id:"magazyn",poziom:"ok",ikona:"🏬",tytul:"Stan lokalnego magazynu — pomocniczo",opis:niskiStan.length?`${niskiStan.length} produktów ma niski stan lokalny. Nie jest to samodzielny powód wyłączenia sprzedaży; ważniejszy jest producent i aktywne zamówienia.`:"Lokalne stany są informacją pomocniczą.",akcja:"#/admin/magazyn/stany"},
    {id:"zatowarowanie",poziom:plan.length?"warn":"ok",ikona:"📦",tytul:"Plan zatowarowania — braki do zamówień",opis:plan.length?`${plan.length} produktów brakuje do aktywnych zamówień. Szacowana wartość braków: ${zl(plan.reduce((s,x)=>s+kwotaNum(x.ilosc*kwotaNum(x.produkt.cena)),0))}.`:"Brak produktów, których brakuje do aktywnych zamówień.",akcja:"utworz-zlecenie-braki"},
    {id:"przyjecia-nadwyzek",poziom:nadwyzki.length?"warn":"ok",ikona:"📥",tytul:"Dzienne przyjęcie nadwyżek",opis:nadwyzki.length?`${nadwyzki.length} pozycji ze zleceń agenta ma nadwyżkę do decyzji/przyjęcia na magazyn.`:"Brak nadwyżek oczekujących na przyjęcie.",akcja:"#/admin/magazyn/plan"},
    {id:"nadrezerwacje",poziom:nadrezerwacje.length?"bad":"ok",ikona:"🚨",tytul:"Rezerwacje większe niż stan",opis:nadrezerwacje.length?`${nadrezerwacje.length} produktów ma więcej sztuk w aktywnych zamówieniach niż fizycznie w magazynie.`:"Nie ma nadrezerwacji magazynowych.",akcja:"#/admin/magazyn"},
    {id:"kartoteka",poziom:brakKartoteki.length?"warn":"ok",ikona:"🗂️",tytul:"Kartoteka zakupowa",opis:brakKartoteki.length?`${brakKartoteki.length} produktów z realnym brakiem nie ma przypisanego dostawcy.`:"Każdy realny brak ma dane potrzebne do Planu zatowarowania.",akcja:"#/admin/magazyn/stany"},
    {id:"lokalizacje",poziom:(!lokAktywne.length||lokPozaSlownikiem.length)?"warn":"ok",ikona:"🗺️",tytul:"Słownik lokalizacji magazynu",opis:!lokAktywne.length?"Brak utworzonych lokalizacji magazynu.":lokPozaSlownikiem.length?`${lokPozaSlownikiem.length} lokalizacji przy produktach nie ma w słowniku.`:`Aktywne lokalizacje: ${lokAktywne.length}.`,akcja:"#/admin/magazyn"},
    {id:"pamiec",poziom:(agentAIPamiec||[]).length?"ok":"warn",ikona:"🧠",tytul:"Pamięć i procedury agenta",opis:(agentAIPamiec||[]).length?`Agent ma ${(agentAIPamiec||[]).length} zapamiętanych procedur/notatek.`:"Agent nie ma jeszcze własnych procedur. Naucz go poleceniem „zapamiętaj: …”.",akcja:"#/admin/agent-ai"},
    {id:"linki-producentow",poziom:linkiDoWyboru.length?"bad":linkiProd.length?"warn":"ok",ikona:"🔗",tytul:"Linki producentów do pobrania",opis:linkiProd.length?`${linkiProd.length} zadań linków: ${linkiDoWyboru.length} wymaga wyboru właściwego produktu, ${linkiDoPonowienia.length} jest gotowych do ponownego pobrania.`:"Brak zaległych linków producentów.",akcja:"sprawdz-linki-producentow"},
    {id:"opisy-produktow",poziom:opisyDoPoprawy.length?"warn":"ok",ikona:"📝",tytul:"Opisy produktów",opis:opisyDoPoprawy.length?`${opisyDoPoprawy.length} produktów wymaga krótkiego opisu albo uporządkowania pełnego opisu.`:"Krótkie i pełne opisy produktów są uporządkowane.",akcja:"popraw-opisy"},
    {id:"monitoring",poziom:bezMonitoringu.length?"warn":"ok",ikona:"📍",tytul:"Produkty bez monitorowanego stanu",opis:bezMonitoringu.length?`${bezMonitoringu.length} produktów działa bez limitu magazynowego — poprawne, jeśli to świadoma decyzja.`:"Wszystkie produkty mają monitorowany stan.",akcja:"#/admin/magazyn"},
    {id:"inwentaryzacja",poziom:stareInwentaryzacje.length?"warn":"ok",ikona:"✅",tytul:"Inwentaryzacja",opis:stareInwentaryzacje.length?`${stareInwentaryzacje.length} monitorowanych produktów nie ma świeżej daty inwentaryzacji.`:"Inwentaryzacja monitorowanych produktów jest aktualna.",akcja:"audyt-magazynu"},
    {id:"zdjecia",poziom:bezZdjec.length?"warn":"ok",ikona:"🖼️",tytul:"Zdjęcia produktów",opis:bezZdjec.length?`${bezZdjec.length} produktów używa ikony zamiast zdjęcia.`:"Produkty mają zdjęcia.",akcja:"#/admin/produkty"},
    {id:"integracje",poziom:(stanBramki.email?.configured&&stanBramki.inpost?.configured)!==false?"ok":"warn",ikona:"🔌",tytul:"Integracje",opis:`E-mail: ${stanBramki.email?.configured?"OK":"sprawdź"} • InPost: ${stanBramki.inpost?.configured?"OK":"sprawdź"} • baza: ${chmuraStan.admin?"połączona":"wpisz hasło bazy"}`,akcja:"#/admin/personalizacja"}
  ];
  return pozycje;
}
function utworzSzkiceFakturMasowo(){
  const zam=pobierzZamowienia().filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr));
  if(!zam.length){ toast("Brak nowych zamówień firmowych do szkiców FV"); return; }
  const nowe=zam.map(z=>daneSzkicuFakturyZamowienia(z.nr)).filter(Boolean);
  szkiceFaktur=[...nowe,...szkiceFaktur].slice(0,2000);
  zapiszLS("artway_faktury_szkice",szkiceFaktur);
  loguj("info",`Agent AI: utworzono ${nowe.length} szkiców FV`);
  toast(`Utworzono ${nowe.length} szkiców FV ✅`);
  renderuj();
}
function agentAIKonkretneDzialanie(x={}){
  if(x.id==="linki-producentow"&&x.poziom==="bad")return {action:"",href:"#/admin/agent-ai/plan",label:"Wybierz właściwe produkty",done:"Każdy niejednoznaczny link ma ręcznie wybrany wariant; Agent nie zgaduje produktu.",eta:"do 30 min",mode:"approval",owner:"Administrator",requiresApproval:true};
  const automatic={
    "funkcjonalnosc-strony":{action:"plan-bezpieczny",label:"Sprawdź funkcje",done:"Baza i integracje krytyczne odpowiadają poprawnie.",eta:"1–3 min"},
    "synchronizacja-danych":{action:"plan-bezpieczny",label:"Pobierz świeże dane",done:"Sklep, Allegro, InPost i inFakt mają aktualne dane.",eta:"1–3 min"},
    faktury:{action:"masowe-fv",label:"Przygotuj szkice FV",done:"Każde zamówienie firmowe ma szkic dokumentu.",eta:"< 1 min"},
    zatowarowanie:{action:"utworz-zlecenie-braki",label:"Aktualizuj szkice producentów",done:"Każdy realny brak jest w jednym bieżącym dokumencie producenta.",eta:"< 1 min"},
    "linki-producentow":{action:"sprawdz-linki-producentow",label:"Sprawdź linki",done:"Każdy link ma zapisany wynik i listę brakujących danych.",eta:"1–5 min"},
    "opisy-produktow":{action:"popraw-opisy",label:"Popraw opisy",done:"Krótki i pełny opis mają uporządkowaną strukturę.",eta:"< 2 min"},
    kartoteka:{action:"kartoteka-domyslna",label:"Uzupełnij bezpieczne pola",done:"Produkty mają podstawową kartotekę do dalszej kontroli.",eta:"< 1 min"},
    inwentaryzacja:{action:"audyt-magazynu",label:"Wykonaj audyt",done:"Powstał raport produktów wymagających inwentaryzacji.",eta:"< 1 min"}
  };
  if(automatic[x.id])return {...automatic[x.id],mode:"automatic",owner:"Agent AI",requiresApproval:false};
  const approval={
    "wdrozenie-produktow":{href:"#/admin/agent-ai/produkty",label:"Dokończ nowe produkty",done:"Każdy nowy produkt ma kompletną tożsamość, opis, zdjęcia, producenta, kategorię sklepu i gotowy szkic Allegro."},
    "dostepnosc-producentow":{href:"#/admin/magazyn/dostawcy",label:"Wybierz termin lub ukrycie",done:"Każdy brak i niski stan ma decyzję: automat, termin 1–7 dni, ukrycie lub ręczne pozostawienie sprzedaży."},
    dostepnosc:{href:"#/admin/zamowienia",label:"Potwierdź lub ustaw oczekiwanie",done:"Każde zamówienie ma decyzję: potwierdzone, oczekiwanie 1–2 dni, kontakt z klientem albo brak."},
    sprzedaz:{href:"#/admin/magazyn/dostawcy",label:"Sprawdź powód i wybierz tryb",done:"Każdy wyłączony produkt ma termin albo jasną zasadę automatycznego wznowienia."},
    "allegro-oferty-agent":{href:"#/admin/allegro/wystawianie",label:"Uzupełnij, ponów lub zamknij",done:"Każde zadanie oferty zostało uzupełnione, ponowione albo świadomie zamknięte."},
    "przyjecia-nadwyzek":{href:"#/admin/magazyn/plan",label:"Przyjmij lub pozostaw",done:"Każda nadwyżka ma zapisaną decyzję i ewentualny ruch magazynowy."}
  };
  if(approval[x.id])return {...approval[x.id],action:"",eta:x.poziom==="bad"?"do 30 min":"dzisiaj",mode:"approval",owner:"Administrator",requiresApproval:true};
  return {action:"",href:String(x.akcja||"").startsWith("#")?x.akcja:"#/admin/agent-ai/plan",label:"Otwórz i zdecyduj",done:agentAIOpisKroku(x),eta:x.poziom==="bad"?"do 30 min":"dzisiaj",mode:"approval",owner:"Administrator",requiresApproval:true};
}
function agentAIProfilePlanow(){
  return {
    full:{id:"full",icon:"🧭",label:"Pełny plan",description:"Funkcjonalność, pobieranie danych i bezpieczne przygotowanie pracy.",areas:["site-health","allegro-orders","inpost","infakt"],local:["database","suppliers","invoices","links"]},
    data:{id:"data",icon:"🔄",label:"Pobieranie danych",description:"Odświeża źródła i bazę bez tworzenia dokumentów roboczych.",areas:["allegro-orders","inpost","infakt"],local:["database","links"]},
    health:{id:"health",icon:"🩺",label:"Funkcjonalność",description:"Sprawdza stronę, integracje i wspólną bazę bez operacji biznesowych.",areas:["site-health"],local:["database"]}
  };
}
function agentAIUstawProfil(profil="full"){
  if(agentAIPlanStan.busy||!agentAIProfilePlanow()[profil])return;
  agentAIPlanProfil=profil;zapiszLS("artway_agent_plan_profil",profil);agentAIPlanStan={...agentAIPlanStan,profile:profil};renderuj();
}
async function agentAIPobierzHistorieWykonan(cicho=false){
  if(agentAIPlanStan.historyLoading||!chmuraToken)return [];
  agentAIPlanStan={...agentAIPlanStan,historyLoading:true};
  try{
    const d=await chmura("agent-action-runs",{timeout:20000});
    const history=Array.isArray(d.items)?d.items:[];agentAIPlanStan={...agentAIPlanStan,history,historyLoading:false};
    if(!cicho)toast(`Pobrano ${history.length} wykonań Agenta`);renderuj();return history;
  }catch(e){agentAIPlanStan={...agentAIPlanStan,historyLoading:false};if(!cicho)toast(`Historia Agenta: ${e.message||e}`);return [];}
}
function agentAIBledneObszary(){
  const current=(agentAIPlanStan.results||[]).filter(x=>x.status==="error"&&x.area).map(x=>x.area);
  if(current.length)return [...new Set(current)];
  const last=(agentAIPlanStan.history||[]).find(x=>(x.results||[]).some(r=>r.status==="error"));
  return [...new Set((last?.results||[]).filter(x=>x.status==="error"&&x.area).map(x=>x.area))];
}
async function agentAIWykonajPlanBezpieczny(profile=agentAIPlanProfil,overrideAreas=null){
  if(agentAIPlanStan.busy)return "Plan Agenta jest już wykonywany.";
  const profiles=agentAIProfilePlanow(),retry=profile==="retry",definition=retry?{id:"retry",label:"Ponowienie błędów",areas:agentAIBledneObszary(),local:[]}:profiles[profile]||profiles.full;
  const areas=Array.isArray(overrideAreas)?overrideAreas:definition.areas;
  if(retry&&!areas.length){toast("Nie ma błędnych kroków do ponowienia");return "Nie ma błędnych kroków do ponowienia.";}
  const startedAt=new Date().toISOString(),results=[],runStarted=Date.now();
  agentAIPlanStan={...agentAIPlanStan,busy:true,current:"Uruchamianie planu",startedAt,completedAt:null,results:[],error:"",profile:definition.id,runId:""};renderuj();
  const add=(entry={})=>{const result={area:entry.area||"",name:entry.name||entry.label||"Działanie",status:entry.status||"completed",detail:String(entry.detail||entry.error||""),durationMs:Number(entry.durationMs)||0,at:new Date().toISOString()};results.push(result);agentAIPlanStan={...agentAIPlanStan,current:result.name,results:[...results]};renderuj();return result;};
  const timed=async(area,name,fn)=>{const t=Date.now();try{return add({area,name,status:"completed",detail:await fn(),durationMs:Date.now()-t});}catch(e){return add({area,name,status:"error",error:e.message||e,durationMs:Date.now()-t});}};
  try{
    if(areas.length){
      try{
        const d=await chmura("agent-run-safe-checks",{method:"POST",body:{source:"admin-agent-ai",profile:definition.id,areas},timeout:180000});
        agentAIPlanStan={...agentAIPlanStan,runId:d.run?.id||""};
        (d.run?.results||[]).forEach(x=>{const detail=x.area==="allegro-orders"?`aktywne: ${x.active||0} • nowe: ${x.newItems||0} • odświeżone: ${x.refreshed||0} • przeskanowane: ${x.scanned||0}`:x.area==="site-health"?String(x.detail||"Strona i integracje odpowiadają"):`sprawdzono: ${x.count||0}`;add({area:x.area,name:x.label,status:x.status,detail:x.status==="completed"?detail:x.error,durationMs:x.durationMs});});
      }catch(e){add({area:"server-checks",name:"Kontrole serwerowe",status:"error",error:e.message||e});}
    }
    if(definition.local.includes("database"))await timed("central-database","Wspólna baza sklepu",async()=>{const ok=await synchronizujBazeCentralna(true);if(!ok)throw new Error("Nie udało się potwierdzić synchronizacji");return "pobrano i zapisano najnowszy stan";});
    if(definition.local.includes("suppliers")){
      const t=Date.now(),docs=(await agentAIUzgodnijPlanZSerwerem({silent:true})).filter(agentAIPlanDokumentAktywny);
      add({area:"supplier-drafts",name:"Plan zatowarowania producentów",status:docs.length?"completed":"skipped",detail:docs.length?`${docs.length} aktywnych dokumentów z kanonicznego serwera • bez wysyłania e-maili`:"brak realnych braków do aktywnych zamówień",durationMs:Date.now()-t});
    }
    if(definition.local.includes("invoices")){
      const t=Date.now(),before=szkiceFaktur.length,missing=pobierzZamowienia().filter(z=>(z.klient?.nip||z.klient?.firma)&&!szkiceFaktur.some(f=>f.nrZamowienia===z.nr)).length;
      if(missing){utworzSzkiceFakturMasowo();add({area:"invoice-drafts",name:"Szkice FV",status:"completed",detail:`utworzono ${Math.max(0,szkiceFaktur.length-before)} szkiców • bez wystawiania faktur`,durationMs:Date.now()-t});}
      else add({area:"invoice-drafts",name:"Szkice FV",status:"skipped",detail:"brak nowych zamówień firmowych",durationMs:Date.now()-t});
    }
    if(definition.local.includes("links")){
      if(agentAILinkiOczekujace().length)await timed("supplier-links","Linki producentów",()=>agentAISprawdzLinkiProducentow(profile==="data"?5:3));
      else add({area:"supplier-links",name:"Linki producentów",status:"skipped",detail:"kolejka jest pusta"});
    }
    const completedAt=new Date().toISOString(),errors=results.filter(x=>x.status==="error").length;
    agentAIPlanStan={...agentAIPlanStan,busy:false,current:"",startedAt,completedAt,results,error:errors?`${errors} kroków wymaga ponowienia`:""};
    zapiszHistorieAgenta("plan-operacyjny",`${definition.label}: ${results.length-errors}/${results.length} kroków bez błędu`,{profile:definition.id,startedAt,completedAt,durationMs:Date.now()-runStarted,results});zaplanujZapisUstawien();
    toast(errors?`⚠️ Plan zakończony • błędy: ${errors}`:`✅ ${definition.label}: wszystkie kroki zakończone`);renderuj();void agentAIPobierzHistorieWykonan(true);
    return [`${errors?"⚠️":"✅"} ${definition.label} zakończony.`,...results.map(x=>`• ${x.status==="completed"?"✅":x.status==="skipped"?"➖":"⚠️"} ${x.name}: ${x.detail}`),"Nie wysłano e-maili, wiadomości do klientów, ofert, etykiet ani faktur bez zatwierdzenia."].join("\n");
  }catch(e){agentAIPlanStan={...agentAIPlanStan,busy:false,current:"",completedAt:new Date().toISOString(),results,error:String(e.message||e)};zapiszHistorieAgenta("plan-operacyjny","Błąd planu Agenta",{profile:definition.id,results,error:String(e.message||e)});renderuj();throw e;}
}
async function agentAIWykonaj(akcja){
  if(akcja==="plan-bezpieczny") return agentAIWykonajPlanBezpieczny(agentAIPlanProfil);
  if(akcja==="plan-full") return agentAIWykonajPlanBezpieczny("full");
  if(akcja==="plan-data") return agentAIWykonajPlanBezpieczny("data");
  if(akcja==="plan-health") return agentAIWykonajPlanBezpieczny("health");
  if(akcja==="plan-retry") return agentAIWykonajPlanBezpieczny("retry");
  if(akcja==="masowe-fv") return utworzSzkiceFakturMasowo();
  if(akcja==="sync") return synchronizujBazeCentralna(true);
  if(akcja==="export-magazyn") return eksportujMagazynCSV();
  if(akcja==="export-zakupy") return eksportujTabeleOperacyjnaMagazynuCSV();
  if(akcja==="utworz-zlecenie-braki"||akcja==="utworz-zlecenie-niskie")return agentAIUzgodnijPlanZSerwerem();
  if(akcja==="sprawdz-linki-producentow") return agentAISprawdzLinkiProducentow().then(t=>toast(t));
  if(akcja==="sprawdz-dostepnosc-producentow") return agentAISprawdzDostepnoscProducentow();
  if(akcja==="popraw-opisy"){ const t=agentAIPoprawOpisyProduktow(40); toast(t); renderuj(); return t; }
  if(akcja==="kartoteka-domyslna") return wypelnijDomyslnaKartotekeMagazynu();
  if(akcja==="audyt-magazynu") return audytMagazynuAI();
  if(akcja==="raport-telegram") return agentAIWyslijRaportTelegram();
}
async function agentAIWykonajZadaniePlanu(id,akcja){
  try{
    await agentAIWykonaj(akcja);
    if(String(akcja).startsWith("plan-")&&agentAIPlanStan.error)throw new Error(agentAIPlanStan.error);
    agentAIOznaczZadanieWykonane(id,"agent-action");
  }catch(e){toast(`⚠️ Zadanie nie zostało zamknięte: ${e.message||e}`);}
}
function agentAIPriorytet(x){
  if(x.id==="funkcjonalnosc-strony") return 0;
  if(x.id==="synchronizacja-danych") return .5;
  if(x.id==="wdrozenie-produktow") return .75;
  if(x.poziom==="bad") return 1;
  if(["wysylki","zatowarowanie","nadrezerwacje","dostepnosc","dostepnosc-producentow"].includes(x.id)) return 2;
  if(x.poziom==="warn") return 3;
  return 9;
}
function agentAIOpisKroku(x){
  const mapa={
    dostepnosc:"Zweryfikuj dostępność pozycji powyżej limitu i wpisz decyzję przy zamówieniu.",
    wysylki:"Uzupełnij dane InPost, wygeneruj etykietę i zapisz numer nadania.",
    faktury:"Utwórz lub odśwież szkice FV dla zamówień firmowych.",
    "opisy-produktow":"Uruchom agenta opisów: uzupełni krótki opis i uporządkuje pełny opis bez zmiany danych technicznych.",
    "wdrozenie-produktow":"Dokończ wdrożenie produktu dodanego przez administratora: tożsamość, duplikaty, opisy, zdjęcia, producent, kategorie sklepu i Allegro.",
    ceny:"Uzupełnij cenę przed sprzedażą, żeby klient nie złożył błędnego zamówienia.",
    magazyn:"Sprawdź produkty z niskim stanem i zdecyduj, czy zamówić uzupełnienie.",
    zatowarowanie:"Przygotuj zamówienie do producenta tylko pod realne braki aktywnych zamówień.",
    nadrezerwacje:"Najpierw obsłuż nadrezerwacje — blokują kompletację zamówień.",
    kartoteka:"Uzupełnij dostawcę wyłącznie dla realnych braków obecnych w Planie zatowarowania.",
    "lokalizacje-kompletacja":"Magazyn przypisuje miejsce towarom z aktywnych zamówień; rezerwacja i kompletacja pozostają aktywne.",
    lokalizacje:"Utwórz brakujące lokalizacje w słowniku i przypisz je do produktów jako osobne zadanie magazynu.",
    pamiec:"Dodaj procedury, których agent ma pilnować przy kolejnych poleceniach.",
    "linki-producentow":"Ponów pobranie URL-i producentów i sprawdź, które dane trzeba jeszcze uzupełnić w karcie produktu.",
    "allegro-oferty-agent":"Uzupełnij automatyczne sugestie producenta, kategorii i produktu katalogowego; pozostałe braki otwórz w edytorze produktu.",
    monitoring:"Zdecyduj, które produkty mają mieć kontrolowany stan, a które bez limitu.",
    inwentaryzacja:"Potwierdź stan produktów bez świeżej inwentaryzacji.",
    zdjecia:"Dodaj zdjęcia do produktów, które nadal używają samej ikony.",
    integracje:"Sprawdź konfigurację bramki, poczty i wspólnej bazy."
  };
  return mapa[x.id]||"Otwórz wskazany moduł i wykonaj kontrolę.";
}
function agentAICentrumDecyzjiHTML(){
  const supplier=statystykiDostepnosciProducentow(),orders=pobierzZamowienia().filter(z=>z.wymagaPotwierdzeniaDostepnosci),communication=allegroKomunikacjaStaty(),messages=[...(communication.threads||[]),...(communication.issues||[])].filter(allegroKomunikacjaWymagaOdpowiedzi),offers=allegroAktywneZadaniaAgentaOfert(),surplus=agentAINadwyzkiDoPrzyjecia(),supplierDocs=(agentAIZlecenia||[]).filter(agentAIPlanDokumentAktywny);
  const areas=[
    {icon:"🏭",title:"Dostępność producenta",count:supplier.wymagajaDecyzji.length,href:"#/admin/magazyn/dostawcy",choices:["automat","zostaw 1–7 dni","ukryj","wznów po powrocie","aktywny bez terminu"]},
    {icon:"🔎",title:"Dostępność w zamówieniu",count:orders.length,href:"#/admin/zamowienia",choices:["potwierdź","poczekaj 1–2 dni","kontakt z klientem","potwierdź brak"]},
    {icon:"🏷️",title:"Zadania ofert Allegro",count:offers.length,href:"#/admin/allegro/wystawianie",choices:["uzupełnij","ponów","otwórz produkt","zamknij zadanie"]},
    {icon:"💬",title:"Wiadomości i dyskusje",count:messages.length,href:"#/admin/allegro/wiadomosci",choices:["odpowiedz","użyj propozycji Agenta","załatwione wewnętrznie"]},
    {icon:"📥",title:"Nadwyżki magazynowe",count:surplus.length,href:"#/admin/magazyn/plan",choices:["przyjmij","pozostaw","skoryguj ilość"]},
    {icon:"🧾",title:"Plan zatowarowania",count:supplierDocs.length,href:"#/admin/magazyn/plan",choices:["sprawdź szkic","zatwierdź wersję","wyślij e-mail","przyjmij dostawę"]}
  ];
  return `<div class="panel agent-decision-center"><div class="order-section-head"><div><span class="order-pro-label">Kontrola człowieka</span><h2>🧭 Centrum decyzji administratora</h2><p class="order-detail-lead">Agent przygotowuje dane i bezpieczne propozycje, ale w miejscach wpływających na klienta, sprzedaż lub wysyłkę zawsze pokazuje konkretne warianty wyboru.</p></div><span class="lvl ${areas.some(x=>x.count)?"lvl-ostrzezenie":"lvl-ok"}">${areas.reduce((s,x)=>s+x.count,0)} otwartych decyzji</span></div><div class="agent-decision-grid">${areas.map(x=>`<article class="${x.count?"has-items":""}"><header><span>${x.icon}</span><div><b>${esc(x.title)}</b><small>${x.count?`${x.count} wymaga wyboru`:"brak otwartych decyzji"}</small></div><strong>${x.count}</strong></header><div>${x.choices.map(c=>`<span>${esc(c)}</span>`).join("")}</div><a class="btn ghost" href="${x.href}">${x.count?"Podejmij decyzje":"Otwórz moduł"}</a></article>`).join("")}</div></div>`;
}
function agentAIPlanOperacyjnyHTML(analiza){
  const zadania=agentAIAnalizaAktywna(analiza).sort((a,b)=>agentAIPriorytet(a)-agentAIPriorytet(b)).slice(0,12);
  const gotowe=analiza.filter(x=>x.poziom==="ok").length;
  const profiles=agentAIProfilePlanow(),selected=profiles[agentAIPlanProfil]||profiles.full,runResults=agentAIPlanStan.results||[],runDone=runResults.filter(x=>x.status==="completed"||x.status==="skipped").length,runErrors=runResults.filter(x=>x.status==="error").length;
  const expected=Math.max(runResults.length,selected.areas.length+selected.local.length),progress=agentAIPlanStan.busy?Math.min(95,Math.round((runDone+runErrors)/Math.max(1,expected)*100)):runResults.length?100:0;
  const runDuration=agentAIPlanStan.startedAt?Math.max(0,Math.round(((agentAIPlanStan.completedAt?Date.parse(agentAIPlanStan.completedAt):Date.now())-Date.parse(agentAIPlanStan.startedAt))/1000)):0;
  const history=(agentAIPlanStan.history||[]).slice(0,5),retryCount=agentAIBledneObszary().length,archive=Object.values(agentAIPlanCykl||{}).filter(x=>["done","resolved"].includes(x.state)).sort((a,b)=>String(b.completedAt||b.resolvedAt||"").localeCompare(String(a.completedAt||a.resolvedAt||""))).slice(0,12);
  return `<div class="panel agent-ops-panel">
    <div class="order-section-head">
      <div><span class="order-pro-label">Centrum wykonawcze</span><h2 style="margin-top:.2rem">🧭 Wykonywalny plan operacyjny</h2><p class="order-detail-lead">Najpierw funkcjonalność strony i świeże dane, następnie zamówienia, wysyłki, magazyn oraz katalog. Każdy krok ma właściciela, czas, wynik i jednoznaczny warunek zakończenia.</p></div>
      <div class="diag-actions"><span class="lvl ${zadania.length?"lvl-ostrzezenie":"lvl-ok"}">${zadania.length?`${zadania.length} aktywnych zadań`:"wszystko pod kontrolą"}</span></div>
    </div>
    <div class="agent-run-profiles">${Object.values(profiles).map(p=>`<button type="button" class="${agentAIPlanProfil===p.id?"active":""}" onclick="agentAIUstawProfil(${jsArg(p.id)})" ${agentAIPlanStan.busy?"disabled":""}><span>${p.icon}</span><b>${esc(p.label)}</b><small>${esc(p.description)}</small></button>`).join("")}</div>
    <div class="agent-run-toolbar"><div><b>Wybrany zakres: ${selected.icon} ${esc(selected.label)}</b><small>${selected.areas.length} kontroli serwerowych • ${selected.local.length} kroków lokalnych • operacje zewnętrzne zablokowane</small></div><div class="diag-actions"><button class="btn" onclick="agentAIWykonaj(${jsArg(`plan-${selected.id}`)})" ${agentAIPlanStan.busy?"disabled":""}>${agentAIPlanStan.busy?"⏳ Wykonuję…":"▶ Wykonaj bezpieczne działania"}</button><button class="btn ghost" onclick="agentAIWykonaj('plan-retry')" ${agentAIPlanStan.busy||!retryCount?"disabled":""}>↻ Ponów błędy${retryCount?` (${retryCount})`:""}</button></div></div>
    ${agentAIPlanStan.busy||runResults.length?`<div class="agent-execution-status ${agentAIPlanStan.error?"has-error":""}"><div><div><b>${agentAIPlanStan.busy?`Agent wykonuje: ${esc(agentAIPlanStan.current||"kontrola")}`:"Ostatnie wykonanie planu"}</b><small>${agentAIPlanStan.runId?`ID audytu ${esc(agentAIPlanStan.runId.slice(0,8))} • `:""}${runDuration}s • ${runDone} zakończonych • ${runErrors} błędów</small></div><small>${agentAIPlanStan.completedAt?esc(new Date(agentAIPlanStan.completedAt).toLocaleString("pl-PL")):"operacja w toku"}</small></div><div class="agent-run-progress"><i style="width:${progress}%"></i></div><div class="agent-execution-results">${runResults.map(r=>`<span class="${esc(r.status)}"><b>${r.status==="completed"?"✅":r.status==="skipped"?"➖":"⚠️"} ${esc(r.name)}</b><small>${esc(r.detail)}</small><em>${r.durationMs?`${Math.max(1,Math.round(r.durationMs/1000))} s`:"—"}</em></span>`).join("")}</div>${agentAIPlanStan.error?`<p>${esc(agentAIPlanStan.error)}</p>`:""}</div>`:""}
    <div class="agent-run-history"><div class="order-section-head"><div><b>Ostatnie wykonania na serwerze</b><small>Trwały audyt jest wspólny dla wszystkich urządzeń administratora.</small></div><button class="btn ghost" onclick="agentAIPobierzHistorieWykonan()" ${agentAIPlanStan.historyLoading?"disabled":""}>${agentAIPlanStan.historyLoading?"⏳":"↻"} Odśwież</button></div>${history.length?`<div class="agent-run-history-list">${history.map(h=>{const errors=(h.results||[]).filter(x=>x.status==="error").length;return `<article><span class="${errors?"error":"ok"}">${errors?"⚠️":"✅"}</span><div><b>${esc(agentAIProfilePlanow()[h.profile]?.label||h.profile||"Kontrola")}</b><small>${esc(new Date(h.completedAt||h.startedAt).toLocaleString("pl-PL"))} • ${Math.max(1,Math.round(Number(h.durationMs||0)/1000))} s • wynik ${esc(h.scoreAfter??"—")}%</small></div><code>${esc(String(h.id||"").slice(0,8))}</code></article>`;}).join("")}</div>`:`<p class="order-detail-lead">${agentAIPlanStan.historyLoading?"Pobieram historię wykonań…":"Historia pojawi się po pierwszej kontroli serwerowej."}</p>`}</div>
    <div class="agent-ops-grid">
      ${zadania.length?zadania.map((x,i)=>{const step=agentAIKonkretneDzialanie(x);return `<div class="agent-ops-step ${x.poziom} ${step.mode}">
        <div class="agent-ops-no">${i+1}</div>
        <div><div class="agent-step-heading"><b>${x.ikona} ${esc(x.tytul)}</b><span class="lvl ${step.requiresApproval?"lvl-ostrzezenie":"lvl-ok"}">${step.requiresApproval?"🔐 decyzja":"⚙️ Agent"}</span></div><p>${esc(x.opis)}</p><div class="agent-step-definition"><span><small>KONKRETNE DZIAŁANIE</small><b>${esc(step.label)}</b></span><span><small>WŁAŚCICIEL / CZAS</small><b>${esc(step.owner)} • ${esc(step.eta)}</b></span><span><small>GOTOWE, GDY</small><b>${esc(step.done)}</b></span></div></div>
        <div class="agent-task-actions">${step.action?`<button class="btn ${step.requiresApproval?"ghost":""}" onclick="agentAIWykonajZadaniePlanu(${jsArg(x.id)},${jsArg(step.action)})">${esc(step.label)}</button>`:`<a class="btn ghost" href="${esc(step.href)}">${esc(step.label)}</a>`}<button class="btn task-complete" type="button" onclick="agentAIOznaczZadanieWykonane(${jsArg(x.id)})">✓ Wykonane</button></div>
      </div>`;}).join(""):`<div class="agent-ops-empty">✅ Brak pilnych tematów. ${gotowe} kontroli ma status OK.</div>`}
    </div>
    <details class="agent-task-archive" ${zadania.length?"":"open"}><summary>✅ Zakończone zadania (${archive.length})</summary>${archive.length?`<div class="agent-task-archive-list">${archive.map(x=>`<article><span>✓</span><div><b>${esc(x.title||x.id)}</b><small>${esc(x.completedAt?new Date(x.completedAt).toLocaleString("pl-PL"):"rozwiązane automatycznie")} • ${esc(x.completedBy||"Agent")}</small></div>${x.state==="done"?`<button class="btn ghost" onclick="agentAIPrzywrocZadanie(${jsArg(x.id)})">Przywróć</button>`:`<em>problem rozwiązany</em>`}</article>`).join("")}</div>`:`<p class="order-detail-lead">Archiwum wypełni się po oznaczeniu pierwszego zadania jako wykonane.</p>`}</details>
  </div>`;
}
