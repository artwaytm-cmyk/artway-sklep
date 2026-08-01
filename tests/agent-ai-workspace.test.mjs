import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {ASSET_BUNDLES,ADMIN_RUNTIME_BUNDLES} from "../scripts/build-assets.mjs";

const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");

test("Agent AI ma jeden katalog zdarzeniowy z raportem kanałów",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  for(const route of ["praca","obsluga","produkty","zasady","historia"])assert.match(source,new RegExp(`#/admin/agent-ai/${route}`));
  for(const label of ["Centrum","Praca na żywo","Obsługa","Produkty","Zasady","Historia"])assert.match(source,new RegExp(label));
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
  assert.match(source,/automatyzacje:"zasady",specjalisci:"zasady",uprawnienia:"zasady",pamiec:"zasady",zasady:"zasady"/);
  assert.match(source,/audyt:"historia",historia:"historia"/);
});

test("każda podstrona renderuje tylko własny zestaw narzędzi",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/function agentAIScalonaTrescSekcji/);
  assert.match(source,/if\(active==="praca"\)return agentAIPracaNaZywoHTML\(\)/);
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
  assert.match(workspace,/\["pulpit","praca","produkty","historia"\]\.includes\(active\)/);
  assert.match(runtime,/chmura\("agent-runtime-status"/);
  assert.match(runtime,/chmura\("agent-product-report"/);
  assert.match(runtime,/const delay=active==="praca"\?10000:active==="produkty"\?20000:30000/);
  assert.doesNotMatch(runtime,/chmura\("agent-product-report",\{params:agentAIProductReportParams\(\)/);
  assert.match(runtime,/FIZYCZNIE WYKONYWANA CZYNNOŚĆ/);
  assert.match(runtime,/Pełne przygotowanie kartotek produktów/);
  assert.match(runtime,/sklepu, Von Halsky oraz Allegro/);
  assert.match(runtime,/allegro-preparation-queue-status/);
  assert.match(runtime,/currentWork/);
  assert.match(runtime,/preparationCounts/);
  assert.match(runtime,/Każda zielona karta oznacza udany test API/);
  assert.match(runtime,/xAI jest pomijane, a zadanie przejmuje kolejny dostępny dostawca/);
  assert.match(styles,/\.agent-live-truth/);
  assert.match(styles,/\.agent-runtime-exact-work/);
  assert.match(styles,/\.agent-publication-proof/);
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
});

test("nowe centrum Agenta jest częścią panelu i ma responsywne style",async()=>{
  const js=ADMIN_RUNTIME_BUNDLES.find(x=>x.output==="assets/admin-agent.js"),css=ASSET_BUNDLES.find(x=>x.output==="assets/admin-agent.css"),styles=await read("src/styles/28-agent-ai-workspace.css");
  assert.ok(js.sources.includes("src/frontend/11-agent-ai-workspace.js"));
  assert.ok(css.sources.includes("src/styles/28-agent-ai-workspace.css"));
  for(const selector of [".agent-module-nav",".agent-context-strip",".agent-command-center",".agent-conversation",".agent-workspace-fold",".agent-history-unified"])assert.match(styles,new RegExp(selector.replace(".","\\.")));
  assert.match(styles,/@media\(max-width:560px\)/);
});
