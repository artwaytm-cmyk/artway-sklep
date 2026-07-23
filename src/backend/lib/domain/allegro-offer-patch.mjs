export function allegroPatchZDraftu(draft = {}, options = {}) {
  const out = {};
  if (draft.name) out.name = draft.name;
  if (options.contentOnly !== true && options.preservePrice !== true && Number(draft.sellingMode?.price?.amount) > 0) out.sellingMode = draft.sellingMode;
  if (options.contentOnly !== true && draft.stock?.available !== undefined && options.preserveStock !== true) out.stock = draft.stock;
  if (options.contentOnly !== true && draft.external?.id) out.external = draft.external;
  if (Array.isArray(draft.images) && draft.images.length) out.images = draft.images;
  if (Array.isArray(draft.description?.sections) && draft.description.sections.length) out.description = draft.description;
  if (options.contentOnly !== true && draft.delivery) out.delivery = draft.delivery;
  if (options.contentOnly !== true && draft.afterSalesServices) out.afterSalesServices = draft.afterSalesServices;
  if (options.contentOnly !== true && Array.isArray(draft.parameters) && draft.parameters.length) out.parameters = draft.parameters;
  // Podczas bezpiecznej synchronizacji treści możemy przekazać wyłącznie
  // identyfikator już powiązanego produktu katalogowego. Allegro wykorzystuje
  // go m.in. do uzupełnienia wymaganych danych GPSR. Nadal nie wysyłamy ceny,
  // stanu ani warunków sprzedaży.
  if ((options.contentOnly !== true || options.includeCatalogProduct === true) && Array.isArray(draft.productSet) && draft.productSet[0]?.product?.id) {
    out.productSet = options.contentOnly === true
      ? [{ product: { id: draft.productSet[0].product.id } }]
      : draft.productSet;
  }
  if (options.repairCatalogCategory === true && draft.category?.id) out.category = { id: draft.category.id };
  if (options.publicationAction === 'activate') out.publication = { status: 'ACTIVE', republish: true };
  else if (options.publicationAction === 'deactivate') out.publication = { status: 'INACTIVE', republish: true };
  else out.publication = { republish: true };
  return out;
}

export function allegroOfferVerification(offer = {}, checked = false) {
  const status = String(offer?.publication?.status || offer?.status || '').trim().toUpperCase();
  return {
    checked: checked === true,
    status,
    active: status === 'ACTIVE',
    descriptionSections: Array.isArray(offer?.description?.sections) ? offer.description.sections.length : 0,
  };
}
