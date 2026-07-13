import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ASSET_BUNDLES = Object.freeze([
  {
    output: 'assets/app.js',
    banner: '/* GENERATED FILE — edit src/frontend/*.js and run npm run build */',
    sources: [
      'src/frontend/01-config-and-catalog.js',
      'src/frontend/02-runtime-state.js',
      'src/frontend/03-cloud-sync.js',
      'src/frontend/04-accounts-orders-settings.js',
      'src/frontend/05-catalog-inventory.js',
      'src/frontend/06-router-and-storefront.js',
      'src/frontend/07-admin-shipping.js',
      'src/frontend/08-admin-navigation.js',
      'src/frontend/09-seo.js',
      'src/frontend/10-agent-ai.js',
      'src/frontend/11-allegro-and-orders.js',
      'src/frontend/12-customers-and-inventory.js',
      'src/frontend/13-product-admin.js',
      'src/frontend/14-categories-and-mapping.js',
      'src/frontend/15-personalization-and-publishing.js',
      'src/frontend/16-diagnostics.js',
      'src/frontend/17-cart-and-checkout.js',
      'src/frontend/18-ui-and-bootstrap.js',
    ],
  },
  {
    output: 'assets/styles.css',
    banner: '/* GENERATED FILE — edit src/styles/*.css and run npm run build */',
    sources: [
      'src/styles/01-foundation.css',
      'src/styles/02-header.css',
      'src/styles/03-storefront.css',
      'src/styles/04-home-and-diagnostics.css',
      'src/styles/05-content-and-account.css',
      'src/styles/06-admin-shell.css',
      'src/styles/07-admin-domains.css',
      'src/styles/08-cart-and-modals.css',
      'src/styles/09-notifications-and-responsive.css',
      'src/styles/10-infakt.css',
      'src/styles/11-profitability.css',
      'src/styles/12-allegro-compliance.css',
    ],
  },
]);

async function renderBundle(bundle) {
  const parts = await Promise.all(bundle.sources.map(async (source) => {
    const content = await readFile(path.join(ROOT, source), 'utf8');
    return content.replace(/^\uFEFF/, '').replace(/\s+$/u, '');
  }));
  return `${bundle.banner}\n${parts.join('\n\n')}\n`;
}

export async function buildAssets({ check = false } = {}) {
  const differences = [];
  for (const bundle of ASSET_BUNDLES) {
    const expected = await renderBundle(bundle);
    const outputPath = path.join(ROOT, bundle.output);
    if (check) {
      const current = await readFile(outputPath, 'utf8').catch(() => '');
      if (current !== expected) differences.push(bundle.output);
    } else {
      await writeFile(outputPath, expected, 'utf8');
    }
  }
  if (differences.length) {
    throw new Error(`Nieaktualne pliki wynikowe: ${differences.join(', ')}. Uruchom npm run build.`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  buildAssets({ check: process.argv.includes('--check') })
    .then(() => console.log(process.argv.includes('--check') ? '✅ Pliki wynikowe są aktualne.' : '✅ Zbudowano pliki assets.'))
    .catch((error) => {
      console.error(`❌ ${error.message}`);
      process.exitCode = 1;
    });
}
