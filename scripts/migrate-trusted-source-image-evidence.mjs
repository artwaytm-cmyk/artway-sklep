import { postgresPoolFor } from '../src/backend/lib/core/postgres-store-repository.mjs';
import { createCentralProductCatalog } from '../src/backend/lib/domain/central-product-catalog.mjs';
import { centralAllegroPreparationCurrent, centralAllegroPreparationFingerprint } from '../src/backend/lib/domain/central-product-preparation-state.mjs';
import { trustedLegacySourceImageUpgrade } from '../src/backend/lib/domain/source-product-images.mjs';

const apply = process.argv.includes('--apply');
const connectionString = String(process.env.DATABASE_URL || '').trim();
if (!connectionString) throw new Error('Brak DATABASE_URL.');
const pool = postgresPoolFor(connectionString);
const catalog = createCentralProductCatalog({
  pool,
  namespace: process.env.ARTWAY_STORE_NAME || 'artway-sklep',
});
const products = await catalog.listDataMap({ includeTrash: false });
let eligible = 0, updated = 0, fingerprints = 0;
for (const product of products.values()) {
  const imagePatch = trustedLegacySourceImageUpgrade(product);
  if (!imagePatch) continue;
  eligible += 1;
  if (!apply) continue;
  const patch = { ...imagePatch };
  if (centralAllegroPreparationCurrent(product)) {
    patch.allegroAgentPreparationFingerprint = centralAllegroPreparationFingerprint({ ...product, ...patch });
    fingerprints += 1;
  }
  const result = await catalog.patchProductFields(product.id, patch, [], {
    mutationId: `source-image-policy-5:${product.id}`,
    actor: 'agent-server-migration',
    area: 'source-image-evidence',
  });
  if (result.updated) updated += 1;
}
console.log(JSON.stringify({ apply, active: products.size, eligible, updated, fingerprints }, null, 2));
await pool.end();
