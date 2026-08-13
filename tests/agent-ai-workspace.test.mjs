import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {ASSET_BUNDLES,ADMIN_RUNTIME_BUNDLES} from "../scripts/build-assets.mjs";

const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");

test("Agent AI ma czytelny katalog zdarzeniowy z osobnym raportem produktów i kanałów",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  for(const route of ["praca","obsluga","produkty","zasady","historia"])assert.match(source,new RegExp(`#/admin/agent-ai/${route}`));
  for(const label of ["Centrum","Praca i decyzje","Obsługa sklepu","Produkty i kanały","Zasady","Historia"])assert.match(source,new RegExp(label));
  assert.match(source,/href:"#\/admin\/agent-ai\/produkty"/);
  assert.match(source,/const AGENT_AI_SEKCJE_KANONICZNE/);
  assert.match(source,/TRYB ZDARZENIOWY|SYSTEM ZDARZENIOWY/);
  assert.match(source,/agent-operations-summary/);
  assert.doesNotMatch(source,/telegram|Telegram/);
});

test("stare adresy Agenta zachowują zgodność i prowadzą do scalonych obszarów",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/rozmowa:"pulpit",komendy:"pulpit"/);
  assert.match(source,/praca:"praca",status:"praca",runtime:"praca"/);
  assert.match(source,/raport:"produkty",wyniki:"produkty",produkty:"produkty",kanaly:"produkty",producenci:"produkty"/);
  assert.match(source,/zadania:"obsluga",plan:"obsluga",zlecenia:"obsluga",obsluga:"obsluga",jakosc:"obsluga",diagnostyka:"obsluga"/);
  assert.match(source,/automatyzacje:"obsluga",specjalisci:"zasady",uprawnienia:"zasady",pamiec:"zasady",zasady:"zasady"/);
  assert.match(source,/audyt:"historia",historia:"historia"/);
});

test("każda podstrona renderuje tylko własny zestaw narzędzi",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/function agentAIScalonaTrescSekcji/);
  assert.match(source,/if\(active==="praca"\)return `<div id="agentAILivePanel">\$\{agentAIPracaNaZywoHTML\(\)\}<\/div>`/);
  assert.match(source,/if\(active==="obsluga"\)return agentAIObslugaScalonaHTML\(\)/);
  assert.match(source,/if\(active==="produkty"\)return agentAIProduktyScaloneHTML\(requested\)/);
  assert.match(source,/if\(active==="zasady"\)return agentAIZasadyScaloneHTML\(requested\)/);
  assert.match(source,/if\(active==="historia"\)return agentAIHistoriaScalonaHTML\(\)/);
  assert.match(source,/return agentAIPulpitScalonyHTML\(score\)/);
  assert.doesNotMatch(source,/style="\$\{aktywna===/);
  assert.doesNotMatch(source,/href="#agent-work-/);
  assert.match(source,/function agentAIOtworzObszar/);
});

test("Praca Agenta i raport kanałów odświeżają dane co 10 sekund bez uruchamiania cyklu",async()=>{
  const workspace=await read("src/frontend/11-agent-ai-workspace.js"),runtime=await read("src/frontend/10-agent-ai-admin-workspace.js"),styles=await read("src/styles/33-agent-observability.css");
  assert.match(workspace,/function agentAIPracaNaZywoHTML/);
  assert.match(workspace,/STAN POTWIERDZONY PRZEZ SERWER/);
  assert.match(workspace,/agentAIRuntimePanelHTML\(\)/);
  assert.match(workspace,/allSections=\["pulpit","praca","obsluga","produkty","zasady","historia"\]/);
  assert.match(workspace,/allSections\.includes\(active\).*agentAIOperationsPobierz/);
  assert.match(workspace,/allSections\.includes\(active\).*agentAISpecjalisciPobierz\(true\)/);
  assert.match(runtime,/chmura\("agent-runtime-status"/);
  assert.match(runtime,/chmura\("agent-product-report"/);
  assert.match(runtime,/const delay=active==="praca"\?10000:active==="produkty"\?20000:30000/);
  assert.match(runtime,/\["pulpit","praca","obsluga","produkty","zasady","historia"\]\.includes\(active\)/);
  assert.doesNotMatch(runtime,/chmura\("agent-product-report",\{params:agentAIProductReportParams\(\)/);
  assert.match(runtime,/Karta „TERAZ” pokazuje najświeższy etap wykonawczy/);
  assert.match(runtime,/pokazuje wszystkie równolegle zapisywane kartoteki/);
  assert.match(runtime,/allegro-preparation-queue-status/);
  assert.match(runtime,/productReport:productReport\.report/);
  assert.match(runtime,/gotowe we wszystkich kanałach/);
  assert.match(runtime,/currentWork/);
  assert.match(runtime,/preparationCounts/);
  assert.match(runtime,/preparationQueue\.activeItems/);
  assert.match(runtime,/Każdy produkt wykonywany teraz jest pokazany osobno/);
  assert.match(runtime,/Każda zielona karta oznacza udany test API/);
  assert.match(runtime,/xAI jest pomijane, a zadanie przejmuje kolejny dostępny dostawca/);
  assert.match(styles,/\.agent-live-truth/);
  assert.match(styles,/\.agent-runtime-exact-work/);
  assert.match(styles,/\.agent-publication-proof/);
  assert.match(runtime,/Sterowanie trwałą kolejką produktów/);
  assert.match(runtime,/asortymentSterujKolejkaSerwera\('pause'\)/);
  assert.match(runtime,/asortymentSterujKolejkaSerwera\('resume'\)/);
  assert.match(runtime,/asortymentSterujKolejkaSerwera\('cancel'/);
  assert.match(styles,/\.agent-publication-controls/);
});

test("ustawienia Allegro pokazują bieżący stan OAuth zamiast stale proponować ponowne łączenie",async()=>{
  const source=await read("src/frontend/11-allegro-settings.js"),styles=await read("src/styles/07-admin-domains.css");
  assert.match(source,/RZECZYWISTY STAN POŁĄCZENIA/);
  assert.match(source,/connectionReady/);
  assert.match(source,/Brakujące zakresy/);
  assert.match(source,/Sprawdź teraz/);
  assert.match(source,/Zmień lub odnów konto/);
  assert.match(styles,/\.allegro-connection-truth/);
});

test("raport produktów ma serwerowe filtry, trzy kanały i gotowość do wystawienia",async()=>{
  const workspace=await read("src/frontend/11-agent-ai-workspace.js"),runtime=await read("src/frontend/10-agent-ai-admin-workspace.js"),styles=await read("src/styles/28-agent-ai-workspace.css");
  assert.match(workspace,/function agentAIProductReportHTML/);
  for(const label of ["Sklep","Allegro","Von Halsky","Gotowe do wystawienia","Do aktualizacji","Nie rozpoczęto"])assert.match(workspace,new RegExp(label));
  for(const filter of ["channel","status","listing","query","page","limit"])assert.match(runtime,new RegExp(filter));
  assert.match(styles,/\.agent-report-filters/);
  assert.match(styles,/\.agent-report-table/);
  assert.match(styles,/@media\(max-width:560px\)/);
  assert.match(workspace,/Kartoteki z błędem/);
  assert.match(workspace,/Decyzje publikacji/);
  assert.match(workspace,/Kartoteka gotowa/);
  assert.match(workspace,/Aktualizuj ofertę/);
});

test("liczniki Agenta odświeżają menu, kontekst i działające decyzje z jednego stanu",async()=>{
  const workspace=await read("src/frontend/11-agent-ai-workspace.js"),runtime=await read("src/frontend/10-agent-ai-admin-workspace.js"),admin=await read("src/frontend/07-admin-shipping.js");
  assert.match(workspace,/adminMenuUstawPowiadomienie\("\/admin\/agent-ai",metrics\.tasks\+metrics\.inlineDecisions/);
  assert.match(workspace,/data-agent-action-guide/);
  assert.match(workspace,/data-agent-decision-total/);
  assert.match(workspace,/agentAIObslugaPrzewodnikHTML/);
  assert.match(workspace,/label:"Praca i decyzje",badge:m\.inlineDecisions\|\|m\.working/);
  assert.match(runtime,/agentAIOperationsUpdateDom\(\)/);
  assert.match(runtime,/route\.startsWith\("#\/admin\/agent-ai"\)/);
  assert.match(admin,/function adminMenuUstawPowiadomienie/);
  assert.match(admin,/metrykiAgenta\.tasks\|\|0/);
  assert.doesNotMatch(workspace,/0 czynności czeka w miejscach/);
});

test("katalog rozdziela ręczne dodanie, pojedynczy link i import wielu linków",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/href="#\/admin\/produkty\/dodaj"[^>]*><span>＋<\/span><div><b>Dodaj ręcznie/);
  assert.match(source,/href="#\/admin\/produkty\/z-linku"[^>]*><span>🔗<\/span><div><b>Dodaj z jednego linku/);
  assert.match(source,/href="#\/admin\/produkty\/z-pliku"[^>]*><span>⇧<\/span><div><b>Import wielu linków/);
  assert.doesNotMatch(source,/ręcznie albo z jednego linku/);
});

test("katalog pokazuje małą datę ostatniej poprawy Agenta i stan publikacji każdego kanału",async()=>{
  const card=await read("src/frontend/12-warehouse-assortment-card.js"),styles=await read("src/styles/29-commerce-catalog-actions.css");
  assert.match(card,/function asortymentAgentMetaHTML/);
  assert.match(card,/Pełny przegląd zapisany/);
  assert.match(card,/agentQualityReadbackConfirmed/);
  assert.match(card,/sklep \$\{publication\("store"\)\}/);
  assert.match(card,/Allegro \$\{publication\("allegro"\)\}/);
  assert.match(card,/Von Halsky \$\{publication\("vonHalsky"\)\}/);
  assert.match(card,/Oznaczenie pojawia się dopiero po zapisie całego przeglądu i odczycie kontrolnym centralnej kartoteki/);
  assert.match(styles,/\.catalog-product-agent-meta/);
});

test("obsługa, produkty i zasady scalają dawne podstrony bez usuwania funkcji",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  for(const call of ["agentAIDecyzjeScaloneHTML","agentAILinkiProducentowPanelHTML","producenciKartotekaPanelHTML","agentAISpecjalisciPanelHTML","agentAIUprawnieniaPanelHTML","agentAIPamiecPanelHTML","agentAIOperationsHTML","agentAIHistoriaScalonaHTML"])assert.match(source,new RegExp(call));
  assert.match(source,/agent-work-decisions/);
  assert.match(source,/agent-auto-specialists/);
  assert.match(source,/agent-action-guide/);
  assert.match(source,/agentAIOperationWykonaj/);
  assert.match(source,/agentAIHistoriaUstawFiltr/);
  assert.match(source,/Powtórzono/);
});

test("nowe centrum Agenta jest częścią panelu i ma responsywne style",async()=>{
  const js=ADMIN_RUNTIME_BUNDLES.find(x=>x.output==="assets/admin-agent.js"),css=ASSET_BUNDLES.find(x=>x.output==="assets/admin-agent.css"),styles=await read("src/styles/28-agent-ai-workspace.css");
  assert.ok(js.sources.includes("src/frontend/11-agent-ai-workspace.js"));
  assert.ok(css.sources.includes("src/styles/28-agent-ai-workspace.css"));
  for(const selector of [".agent-module-nav",".agent-context-strip",".agent-command-center",".agent-conversation",".agent-workspace-fold",".agent-history-unified",".agent-action-guide",".agent-history-filters"])assert.match(styles,new RegExp(selector.replace(".","\\.")));
  assert.match(styles,/@media\(max-width:560px\)/);
});
