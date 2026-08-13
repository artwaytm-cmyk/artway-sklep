export function createCentralProductFieldPublisher({
  catalog,
  revisionState,
  synchronize,
  errorText = (value) => String(value || ''),
  logger = console,
} = {}) {
  if (!catalog || typeof catalog.patchProductFields !== 'function') throw new Error('Publikacja pól wymaga centralnego katalogu.');
  if (typeof revisionState !== 'function' || typeof synchronize !== 'function') throw new Error('Publikacja pól wymaga kontroli rewizji.');

  async function attempt(productId, fields, remove, revision, metadata = {}) {
    return catalog.patchProductFields(productId, fields, remove, {
      sourceRevision: revision.sourceRevision,
      mutationId: metadata.mutationId,
      actor: metadata.actor,
      area: metadata.area,
    });
  }

  return async function publishCentralProductFields({
    productId, fields = {}, remove = [], mutationId = '', actor = 'system', area = 'product',
  } = {}) {
    const metadata = { mutationId, actor, area };
    try {
      const revision = await revisionState();
      let result = await attempt(productId, fields, remove, revision, metadata);
      let recovered = false;
      if (!result.updated) {
        await synchronize({ force: true, revision });
        result = await attempt(productId, fields, remove, revision, metadata);
        recovered = true;
      }
      if (result.updated) return {
        published: true, queued: false, recovered,
        revision: revision.sourceRevision, updatedAt: result.syncedAt,
      };
      return { published: false, queued: true, reason: result.reason || 'central_patch_not_applied' };
    } catch (error) {
      try {
        const revision = await revisionState();
        await synchronize({ force: true, revision });
        const result = await attempt(productId, fields, remove, revision, metadata);
        if (result.updated) return {
          published: true, queued: false, recovered: true,
          revision: revision.sourceRevision, updatedAt: result.syncedAt,
        };
      } catch (syncError) {
        logger.error('central_product_catalog_recovery_sync', syncError);
      }
      return { published: false, queued: true, reason: 'central_patch_failed', error: errorText(error?.message || error, 500) };
    }
  };
}
