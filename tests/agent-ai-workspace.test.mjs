import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {ASSET_BUNDLES} from "../scripts/build-assets.mjs";

const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");

test("Agent AI ma sześć kanonicznych obszarów zamiast jedenastu powielonych kart",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  for(const route of ["rozmowa","zadania","automatyzacje","komunikacja","audyt"])assert.match(source,new RegExp(`#/admin/agent-ai/${route}`));
  for(const label of ["Centrum","Rozmowa","Zadania i decyzje","Automatyzacje","Telegram","Audyt"])assert.match(source,new RegExp(label));
  assert.match(source,/const AGENT_AI_SEKCJE_KANONICZNE/);
});

test("stare adresy Agenta zachowują zgodność i prowadzą do scalonych obszarów",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/komendy:"rozmowa"/);
  assert.match(source,/plan:"zadania",produkty:"zadania",zlecenia:"zadania",producenci:"zadania"/);
  assert.match(source,/specjalisci:"automatyzacje",uprawnienia:"automatyzacje",pamiec:"automatyzacje"/);
  assert.match(source,/telegram:"komunikacja"/);
  assert.match(source,/historia:"audyt"/);
});

test("każda podstrona renderuje tylko własny zestaw narzędzi",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  assert.match(source,/function agentAIScalonaTrescSekcji/);
  assert.match(source,/if\(active==="rozmowa"\)return agentAIRozmowaScalonaHTML\(\)/);
  assert.match(source,/if\(active==="zadania"\)return agentAIZadaniaScaloneHTML/);
  assert.match(source,/if\(active==="automatyzacje"\)return agentAIAutomatyzacjeScaloneHTML/);
  assert.match(source,/if\(active==="komunikacja"\)return agentAITelegramPanelHTML\(\)/);
  assert.match(source,/if\(active==="audyt"\)return agentAIHistoriaPanelHTML\(\)/);
  assert.doesNotMatch(source,/style="\$\{aktywna===/);
  assert.doesNotMatch(source,/href="#agent-work-/);
  assert.match(source,/function agentAIOtworzObszar/);
});

test("zadania i automatyzacje scalają dawne podstrony bez usuwania funkcji",async()=>{
  const source=await read("src/frontend/11-agent-ai-workspace.js");
  for(const call of ["agentAIPlanOperacyjnyHTML","agentAICentrumDecyzjiHTML","agentAIProduktyWdrozeniePanelHTML","agentAILinkiProducentowPanelHTML","producenciKartotekaPanelHTML","agentAISpecjalisciPanelHTML","agentAIUprawnieniaPanelHTML","agentAIPamiecPanelHTML"])assert.match(source,new RegExp(call));
  assert.match(source,/agent-work-plan/);
  assert.match(source,/agent-auto-specialists/);
});

test("nowe centrum Agenta jest częścią panelu i ma responsywne style",async()=>{
  const js=ASSET_BUNDLES.find(x=>x.output==="assets/admin.js"),css=ASSET_BUNDLES.find(x=>x.output==="assets/admin.css"),styles=await read("src/styles/28-agent-ai-workspace.css");
  assert.ok(js.sources.includes("src/frontend/11-agent-ai-workspace.js"));
  assert.ok(css.sources.includes("src/styles/28-agent-ai-workspace.css"));
  for(const selector of [".agent-module-nav",".agent-context-strip",".agent-command-center",".agent-conversation",".agent-workspace-fold"])assert.match(styles,new RegExp(selector.replace(".","\\.")));
  assert.match(styles,/@media\(max-width:560px\)/);
});
