export function allegroPatchZDraftu(draft = {}, options = {}) {
  const out = {};
  if (draft.name) out.name = draft.name;
  if (Number(draft.sellingMode?.price?.amount) > 0) out.sellingMode = draft.sellingMode;
  if (draft.stock?.available !== undefined && options.preserveStock !== true) out.stock = draft.stock;
  if (draft.external?.id) out.external = draft.external;
  if (Array.isArray(draft.images) && draft.images.length) out.images = draft.images;
  if (Array.isArray(draft.description?.sections) && draft.description.sections.length) out.description = draft.description;
  if (draft.delivery) out.delivery = draft.delivery;
  if (draft.afterSalesServices) out.afterSalesServices = draft.afterSalesServices;
  if (Array.isArray(draft.parameters) && draft.parameters.length) out.parameters = draft.parameters;
  if (Array.isArray(draft.productSet) && draft.productSet[0]?.product?.id) out.productSet = draft.productSet;
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
