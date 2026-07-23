// Wąska druga linia redakcji. Nie podejmuje decyzji sprzedażowych i nie zapisuje
// produktu — przygotowuje wynik, który wraca do tej samej deterministycznej
// kontroli i dopiero potem może zostać zapisany przez koordynator specjalistów.
export async function repairAllegroEditorial({ run, productFacts, product, editorial, target, rejectedEditorial, violations }) {
  return run({
    specialist: 'allegro_compliance',
    source: 'automatic',
    instruction: 'Napraw zatrzymaną redakcję. Zachowaj wyłącznie fakty o produkcie i ten sam czytelny układ. Usuń wszystkie informacje o kontakcie, płatności, dostawie, wysyłce, przewoźniku, paczkomacie, nadaniu, odbiorze, kosztach i terminach realizacji. Zwróć komplet pól gotowy do ponownej kontroli.',
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
