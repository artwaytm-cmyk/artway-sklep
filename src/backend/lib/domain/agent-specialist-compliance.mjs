// Wąska druga linia redakcji. Nie podejmuje decyzji sprzedażowych i nie zapisuje
// produktu — przygotowuje wynik, który wraca do tej samej deterministycznej
// kontroli i dopiero potem może zostać zapisany przez koordynator specjalistów.
export async function repairAllegroEditorial({ run, productFacts, product, editorial, target, rejectedEditorial, violations }) {
  return run({
    specialist: 'allegro_compliance',
    source: 'automatic',
    instruction: 'Napraw zatrzymaną redakcję. Zachowaj wyłącznie fakty o jednym produkcie i ten sam czytelny układ. Tytuł ma mieć 12–75 znaków i co najmniej 3 słowa. Usuń kontakt, płatności, dostawę, wysyłkę, przewoźnika, paczkomat, nadanie, odbiór, koszty, terminy realizacji, gwarancję, zwroty, reklamacje, hasła promocyjne, inne produkty i warianty oraz miejsce pozyskania towaru. Zwróć komplet pól gotowy do ponownej kontroli.',
    context: {
      product: productFacts(product),
      rejectedEditorial,
      violations: violations || [],
      editorialTarget: editorial.target,
      editorialFingerprint: editorial.fingerprint,
    },
    target,
  }, { source: 'background-agent-compliance' });
}

export async function repairStoreEditorial({ run, productFacts, product, editorial, target, rejectedEditorial, violations }) {
  return run({
    specialist: 'store_compliance',
    source: 'automatic',
    instruction: 'Napraw wyłącznie zatrzymaną treść sklepu. Usuń kontrolki strony źródłowej, stan, cenę, logistykę, kontakt, link źródłowy, kody katalogowe i niepotwierdzone obietnice. Zachowaj tożsamość i wszystkie potwierdzone fakty produktu. Zwróć kompletną nazwę, opis krótki, opis długi i SEO.',
    context: { product: productFacts(product), rejectedEditorial, violations: violations || [], editorialTarget: editorial.target, editorialFingerprint: editorial.fingerprint },
    target,
  }, { source: 'background-agent-store-compliance' });
}

export async function repairVonHalskyEditorial({ run, productFacts, product, editorial, target, rejectedEditorial, violations }) {
  return run({
    specialist: 'von_halsky_compliance',
    source: 'automatic',
    instruction: 'Napraw wyłącznie zatrzymaną kartę produktu dla Von Halsky. Zachowaj potwierdzone fakty. Usuń linki, osadzone obrazy, kontakt, płatności, logistykę, hasła promocyjne i nieobsługiwane znaczniki. Zwróć komplet osobnych pól Von Halsky gotowy do ponownej kontroli.',
    context: {
      product: productFacts(product),
      rejectedEditorial,
      violations: violations || [],
      editorialTarget: editorial.target,
      editorialFingerprint: editorial.fingerprint,
    },
    target,
  }, { source: 'background-agent-von-halsky-compliance' });
}

export async function enforceProductEditorialCompliance({ draft, assess, run, productFacts, product, editorial, target }) {
  let currentDraft = draft;
  const visited = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const assessment = assess(currentDraft);
    if (assessment.eligible || !['source_page_noise', 'allegro_compliance', 'von_halsky_compliance'].includes(assessment.reason)) return { draft: currentDraft, assessment, visited };
    const rejectedEditorial = currentDraft.result || {};
    visited.push({ reason: assessment.reason, violations: assessment.violations || [] });
    currentDraft = assessment.reason === 'source_page_noise'
      ? await repairStoreEditorial({ run, productFacts, product, editorial, target, rejectedEditorial, violations: assessment.violations })
      : assessment.reason === 'allegro_compliance'
        ? await repairAllegroEditorial({ run, productFacts, product, editorial, target, rejectedEditorial, violations: assessment.violations })
        : await repairVonHalskyEditorial({ run, productFacts, product, editorial, target, rejectedEditorial, violations: assessment.violations });
  }
  return { draft: currentDraft, assessment: assess(currentDraft), visited };
}
