import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {ASSET_BUNDLES,ADMIN_RUNTIME_BUNDLES} from "../scripts/build-assets.mjs";

const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");

test("Agent AI ma siedem kanonicznych obszarów zamiast powielonych kart",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  for(const route of ["rozmowa","praca","zadania","jakosc","automatyzacje","audyt"])assert.match(source,new RegExp(`#/admin/agent-ai/${route}`));
  for(const label of ["Centrum","Rozmowa","Praca na żywo","Zadania i decyzje","Jakość strony","Automatyzacje","Audyt"])assert.match(source,new RegExp(label));
  assert.match(source,/const AGENT_AI_SEKCJE_KANONICZNE/);
  assert.doesNotMatch(source,/telegram|Telegram/);
});

test("stare adresy Agenta zachowują zgodność i prowadzą do scalonych obszarów",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/komendy:"rozmowa"/);
  assert.match(source,/praca:"praca",status:"praca",runtime:"praca"/);
  assert.match(source,/plan:"zadania",produkty:"zadania",zlecenia:"zadania",producenci:"zadania"/);
  assert.match(source,/specjalisci:"automatyzacje",uprawnienia:"automatyzacje",pamiec:"automatyzacje"/);
  assert.match(source,/diagnostyka:"jakosc"/);
  assert.match(source,/historia:"audyt"/);
});

test("każda podstrona renderuje tylko własny zestaw narzędzi",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/function agentAIScalonaTrescSekcji/);
  assert.match(source,/if\(active==="rozmowa"\)return agentAIRozmowaScalonaHTML\(\)/);
  assert.match(source,/if\(active==="praca"\)return agentAIPracaNaZywoHTML\(\)/);
  assert.match(source,/if\(active==="zadania"\)return agentAIZadaniaScaloneHTML/);
  assert.match(source,/if\(active==="automatyzacje"\)return agentAIAutomatyzacjeScaloneHTML/);
  assert.match(source,/if\(active==="jakosc"\)return agentAIJakoscStronyHTML\(\)/);
  assert.match(source,/if\(active==="audyt"\)return agentAIHistoriaPanelHTML\(\)/);
  assert.doesNotMatch(source,/style="\$\{aktywna===/);
  assert.doesNotMatch(source,/href="#agent-work-/);
  assert.match(source,/function agentAIOtworzObszar/);
});

test("Praca Agenta pokazuje wyłącznie telemetrię runtime i odświeża ją co 15 sekund",async()=>{
  const workspace=await read("src/frontend/11-agent-ai-workspace.js"),runtime=await read("src/frontend/10-agent-ai-admin-workspace.js"),styles=await read("src/styles/33-agent-observability.css");
  assert.match(workspace,/function agentAIPracaNaZywoHTML/);
  assert.match(workspace,/STAN POTWIERDZONY PRZEZ SERWER/);
  assert.match(workspace,/agentAIRuntimePanelHTML\(\)/);
  assert.match(workspace,/\["pulpit","praca"\]\.includes\(active\)/);
  assert.match(runtime,/chmura\("agent-runtime-status"/);
  assert.match(runtime,/setTimeout\(async\(\)=>\{await agentAIRuntimePobierz\(true\);agentAIRuntimePolling\(\);\},15000\)/);
  assert.match(runtime,/FIZYCZNIE WYKONYWANA CZYNNOŚĆ/);
  assert.match(runtime,/Pełne przygotowanie kartotek produktów/);
  assert.match(runtime,/sklepu, Von Halsky oraz Allegro/);
  assert.match(runtime,/allegro-preparation-queue-status/);
  assert.match(runtime,/currentWork/);
  assert.match(runtime,/preparationCounts/);
  assert.match(styles,/\.agent-live-truth/);
  assert.match(styles,/\.agent-runtime-exact-work/);
  assert.match(styles,/\.agent-publication-proof/);
});

test("katalog pokazuje małą datę ostatniej poprawy Agenta i stan publikacji każdego kanału",async()=>{
  const card=await read("src/frontend/12-warehouse-assortment-card.js"),styles=await read("src/styles/29-commerce-catalog-actions.css");
  assert.match(card,/function asortymentAgentMetaHTML/);
  assert.match(card,/Agent: poprawiono/);
  assert.match(card,/sklep \$\{publication\("store"\)\}/);
  assert.match(card,/Allegro \$\{publication\("allegro"\)\}/);
  assert.match(card,/Von Halsky \$\{publication\("vonHalsky"\)\}/);
  assert.match(card,/Agent wróci do produktu dopiero po zmianie danych wejściowych albo błędzie publikacji/);
  assert.match(styles,/\.catalog-product-agent-meta/);
});

test("zadania i automatyzacje scalają dawne podstrony bez usuwania funkcji",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  for(const call of ["agentAIPlanOperacyjnyHTML","agentAICentrumDecyzjiHTML","agentAIProduktyWdrozeniePanelHTML","agentAILinkiProducentowPanelHTML","producenciKartotekaPanelHTML","agentAISpecjalisciPanelHTML","agentAIUprawnieniaPanelHTML","agentAIPamiecPanelHTML"])assert.match(source,new RegExp(call));
  assert.match(source,/agent-work-plan/);
  assert.match(source,/agent-auto-specialists/);
});

test("nowe centrum Agenta jest częścią panelu i ma responsywne style",async()=>{
  const js=ADMIN_RUNTIME_BUNDLES.find(x=>x.output==="assets/admin-commerce.js"),css=ASSET_BUNDLES.find(x=>x.output==="assets/admin-agent.css"),styles=await read("src/styles/28-agent-ai-workspace.css");
  assert.ok(js.sources.includes("src/frontend/11-agent-ai-workspace.js"));
  assert.ok(css.sources.includes("src/styles/28-agent-ai-workspace.css"));
  for(const selector of [".agent-module-nav",".agent-context-strip",".agent-command-center",".agent-conversation",".agent-workspace-fold"])assert.match(styles,new RegExp(selector.replace(".","\\.")));
  assert.match(styles,/@media\(max-width:560px\)/);
});
