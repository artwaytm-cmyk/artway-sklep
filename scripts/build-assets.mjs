import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildPublicCompliancePages } from './public-compliance-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const VENDOR_ASSETS = Object.freeze([
  { source: 'node_modules/jsqr/dist/jsQR.js', output: 'assets/vendor/jsQR.js' },
  { source: 'node_modules/qrcode-generator/qrcode.js', output: 'assets/vendor/qrcode-generator.js' },
  { source: 'node_modules/@zxing/browser/umd/zxing-browser.min.js', output: 'assets/vendor/zxing-browser.min.js' },
]);

export const ASSET_BUNDLES = Object.freeze([
  {
    output: 'assets/app.js',
    banner: '/* GENERATED FILE — edit src/frontend/*.js and run npm run build */',
    sources: [
      'src/frontend/01-config-and-catalog.js',
      'src/frontend/02-runtime-state.js',
      'src/frontend/03-cloud-sync.js',
      'src/frontend/03a-company-payments-and-product-ids.js',
      'src/frontend/04-accounts-orders-settings.js',
      'src/frontend/05-catalog-inventory.js',
      'src/frontend/05a-inventory-core.js',
      'src/frontend/05b-product-agent-source.js',
      'src/frontend/05c-inventory-movements.js',
      'src/frontend/06-router-and-storefront.js',
      'src/frontend/06a-storefront-home.js',
      'src/frontend/06b-storefront-catalog.js',
      'src/frontend/07b-shipping-integrations.js',
      'src/frontend/09-seo.js',
      'src/frontend/09a-seo-analytics.js',
      'src/frontend/17-cart-and-checkout.js',
      'src/frontend/17a-checkout-and-delivery.js',
      'src/frontend/18-pwa.js',
      'src/frontend/18-ui-and-bootstrap.js',
    ],
  },
  {
    output: 'assets/store-account.js',
    banner: '/* GENERATED STORE ACCOUNT — loaded on demand */',
    sources: ['src/frontend/06c-storefront-account.js'],
  },
  {
    output: 'assets/store-content.js',
    banner: '/* GENERATED STORE CONTENT — loaded on demand */',
    sources: ['src/frontend/06d-storefront-content.js'],
  },
  {
    output: 'assets/admin.js',
    banner: '/* GENERATED FILE — edit src/frontend/*.js and run npm run build */',
    sources: [
      'src/frontend/08-admin-navigation.js',
      'src/frontend/07-admin-shipping.js',
      'src/frontend/07a-shipping-workflow.js',
      'src/frontend/07c-shipping-views.js',
      'src/frontend/07d-inpost-service-shipping.js',
      'src/frontend/08a-admin-responsive-layout.js',
      'src/frontend/10-agent-ai.js',
      'src/frontend/10-agent-ai-supplier-planning.js',
      'src/frontend/10-agent-ai-command-center.js',
      'src/frontend/10-agent-ai-admin-workspace.js',
      'src/frontend/10-agent-ai-communications-workspace.js',
      'src/frontend/10a-telegram-communications.js',
      'src/frontend/11a-agent-observability-workspace.js',
      'src/frontend/10-warehouse-locations.js',
      'src/frontend/10-warehouse-qr.js',
      'src/frontend/10-warehouse-documents.js',
      'src/frontend/11-allegro-procurement-actions.js',
      'src/frontend/11-allegro-refresh-runtime.js',
      'src/frontend/11-allegro-offer-management.js',
      'src/frontend/11-allegro-order-workflow-ui.js',
      'src/frontend/11-allegro-order-archive-ui.js',
      'src/frontend/11-allegro-mapping-index.js',
      'src/frontend/11-allegro-duplicate-decisions.js',
      'src/frontend/11-order-location-ui.js',
      'src/frontend/11-allegro-manual-mapping-actions.js',
      'src/frontend/11-telegram-account-access-ui.js',
      'src/frontend/11-integration-center.js',
      'src/frontend/11-allegro-and-orders.js',
      'src/frontend/11-allegro-product-publication.js',
      'src/frontend/11-allegro-operations.js',
      'src/frontend/11-allegro-communications.js',
      'src/frontend/11-allegro-workspace.js',
      'src/frontend/11b-von-halsky-workspace.js',
      'src/frontend/11-store-orders.js',
      'src/frontend/11-agent-ai-workspace.js',
      'src/frontend/11-allegro-settings.js',
      'src/frontend/12-customers-and-inventory.js',
      'src/frontend/12d-inventory-operations.js',
      'src/frontend/12-assortment-index.js',
      'src/frontend/12e-infakt-shipping-billing.js',
      'src/frontend/12-infakt-admin.js',
      'src/frontend/09b-seo-effects-panel.js',
      'src/frontend/12-warehouse-views.js',
      'src/frontend/12-warehouse-main-view.js',
      'src/frontend/12-warehouse-assortment-card.js',
      'src/frontend/12-warehouse-assortment-view.js',
      'src/frontend/12-product-editor-workspace.js',
      'src/frontend/12-product-editor.js',
      'src/frontend/12a-product-actions.js',
      'src/frontend/12b-allegro-listing-workspace.js',
      'src/frontend/12c-commerce-catalog-actions.js',
      'src/frontend/20-product-link-file-import-parser.js',
      'src/frontend/21-product-link-file-import-ui.js',
      'src/frontend/13-product-admin.js',
      'src/frontend/13a-product-import-export.js',
      'src/frontend/14-categories-and-mapping.js',
      'src/frontend/14a-category-workspace.js',
      'src/frontend/15-personalization-and-publishing.js',
      'src/frontend/15e-payment-integration-readiness.js',
      'src/frontend/15d-publication-and-export.js',
      'src/frontend/15a-home-promotions-workspace.js',
      'src/frontend/15b-banner-icon-studio.js',
      'src/frontend/15c-campaign-studio-pro.js',
      'src/frontend/16-diagnostics.js',
      'src/frontend/19-admin-dashboard.js',
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
      'src/styles/08-cart-and-modals.css',
      'src/styles/09-notifications-and-responsive.css',
      'src/styles/10-seo-ssr.css',
    ],
  },
  {
    output: 'assets/admin.css',
    banner: '/* GENERATED FILE — edit src/styles/*.css and run npm run build */',
    sources: [
      'src/styles/06-admin-shell.css',
      'src/styles/07-admin-domains.css',
      'src/styles/07a-admin-domains.css',
      'src/styles/07b-admin-domains.css',
      'src/styles/10-infakt.css',
      'src/styles/11-profitability.css',
      'src/styles/12-allegro-compliance.css',
      'src/styles/13-dashboard.css',
      'src/styles/14-product-link-import.css',
      'src/styles/15-product-actions.css',
      'src/styles/16-supplier-receipt.css',
      'src/styles/17-product-link-review.css',
      'src/styles/18-warehouse-documents.css',
      'src/styles/19-warehouse-qr.css',
      'src/styles/20-warehouse-locations.css',
      'src/styles/22-home-promotions.css',
      'src/styles/23-banner-icon-studio.css',
      'src/styles/24-campaign-studio-pro.css',
      'src/styles/25-seo-control-center.css',
      'src/styles/26-telegram-communications.css',
      'src/styles/29-commerce-catalog-actions.css',
      'src/styles/30-admin-fluid-layout.css',
      'src/styles/31-admin-page-pattern.css',
      'src/styles/32-product-editor-workspace.css',
      'src/styles/34-paynow-readiness.css',
      'src/styles/35-admin-unified-workspace.css',
      'src/styles/36-inpost-service-shipping.css',
    ],
  },
  {
    output: 'assets/admin-warehouse.css',
    banner: '/* GENERATED ADMIN WAREHOUSE STYLES — loaded on demand */',
    sources: ['src/styles/21-warehouse-workspace.css'],
  },
  {
    output: 'assets/admin-commerce.css',
    banner: '/* GENERATED ADMIN COMMERCE STYLES — loaded on demand */',
    sources: ['src/styles/27-allegro-listing-workspace.css'],
  },
  {
    output: 'assets/admin-agent.css',
    banner: '/* GENERATED ADMIN AGENT STYLES — loaded on demand */',
    sources: ['src/styles/28-agent-ai-workspace.css', 'src/styles/33-agent-observability.css'],
  },
  {
    output: 'assets/admin-von-halsky.css',
    banner: '/* GENERATED ADMIN VON HALSKY STYLES — loaded on demand */',
    sources: ['src/styles/37-von-halsky-workspace.css'],
  },
]);

// Runtime panelu jest dzielony według odpowiedzialności. `assets/admin.js`
// pozostaje pełnym artefaktem kontrolnym dla testów statycznych i nie jest
// pobierany przez przeglądarkę. Użytkownik dostaje wyłącznie rdzeń oraz moduły
// potrzebne dla aktualnej trasy panelu.
export const ADMIN_RUNTIME_BUNDLES = Object.freeze([
  {
    output: 'assets/admin-core.js',
    banner: '/* GENERATED ADMIN CORE — edit src/frontend/*.js and run npm run build */',
    sources: [
      'src/frontend/08-admin-navigation.js',
    ],
  },
  {
    output: 'assets/admin-shell.js',
    banner: '/* GENERATED ADMIN SHELL — shared navigation and workspace */',
    sources: [
      'src/frontend/07-admin-shipping.js',
    ],
  },
  {
    output: 'assets/admin-ui.js',
    banner: '/* GENERATED ADMIN UI — shared responsive tables and filters */',
    sources: [
      'src/frontend/08a-admin-responsive-layout.js',
    ],
  },
  {
    output: 'assets/admin-agent.js',
    banner: '/* GENERATED ADMIN AGENT — loaded on demand */',
    sources: [
      'src/frontend/10-agent-ai.js',
      'src/frontend/10-agent-ai-supplier-planning.js',
      'src/frontend/10-agent-ai-command-center.js',
      'src/frontend/10-agent-ai-admin-workspace.js',
      'src/frontend/10-agent-ai-communications-workspace.js',
      'src/frontend/10a-telegram-communications.js',
      'src/frontend/11a-agent-observability-workspace.js',
    ],
  },
  {
    output: 'assets/admin-warehouse.js',
    banner: '/* GENERATED ADMIN WAREHOUSE — loaded on demand */',
    sources: [
      'src/frontend/10-warehouse-locations.js',
      'src/frontend/10-warehouse-qr.js',
      'src/frontend/10-warehouse-documents.js',
      'src/frontend/12-warehouse-views.js',
      'src/frontend/12-warehouse-main-view.js',
    ],
  },
  {
    output: 'assets/admin-shipping.js',
    banner: '/* GENERATED ADMIN SHIPPING — loaded on demand */',
    sources: [
      'src/frontend/07a-shipping-workflow.js',
      'src/frontend/07c-shipping-views.js',
      'src/frontend/07d-inpost-service-shipping.js',
    ],
  },
  {
    output: 'assets/admin-commerce.js',
    banner: '/* GENERATED ADMIN COMMERCE — loaded on demand */',
    sources: [
      'src/frontend/11-allegro-procurement-actions.js',
      'src/frontend/11-allegro-refresh-runtime.js',
      'src/frontend/11-allegro-offer-management.js',
      'src/frontend/11-allegro-order-workflow-ui.js',
      'src/frontend/11-allegro-order-archive-ui.js',
      'src/frontend/11-allegro-mapping-index.js',
      'src/frontend/11-allegro-duplicate-decisions.js',
      'src/frontend/11-order-location-ui.js',
      'src/frontend/11-allegro-manual-mapping-actions.js',
      'src/frontend/11-telegram-account-access-ui.js',
      'src/frontend/11-integration-center.js',
      'src/frontend/11-allegro-and-orders.js',
      'src/frontend/11-allegro-product-publication.js',
      'src/frontend/11-allegro-operations.js',
      'src/frontend/11-allegro-workspace.js',
      'src/frontend/11-store-orders.js',
      'src/frontend/11-agent-ai-workspace.js',
      'src/frontend/11-allegro-settings.js',
    ],
  },
  {
    output: 'assets/admin-communications.js',
    banner: '/* GENERATED ADMIN COMMUNICATIONS — loaded on demand */',
    sources: [
      'src/frontend/11-allegro-communications.js',
    ],
  },
  {
    output: 'assets/admin-von-halsky.js',
    banner: '/* GENERATED ADMIN VON HALSKY — loaded on demand */',
    sources: [
      'src/frontend/11b-von-halsky-workspace.js',
    ],
  },
  {
    output: 'assets/admin-inventory.js',
    banner: '/* GENERATED ADMIN INVENTORY — loaded on demand */',
    sources: [
      'src/frontend/12-customers-and-inventory.js',
      'src/frontend/12d-inventory-operations.js',
      'src/frontend/12-assortment-index.js',
      'src/frontend/12e-infakt-shipping-billing.js',
      'src/frontend/12-infakt-admin.js',
      'src/frontend/09b-seo-effects-panel.js',
      'src/frontend/12-warehouse-assortment-card.js',
      'src/frontend/12-warehouse-assortment-view.js',
      'src/frontend/12-product-editor-workspace.js',
      'src/frontend/12-product-editor.js',
      'src/frontend/12a-product-actions.js',
      'src/frontend/12b-allegro-listing-workspace.js',
      'src/frontend/12c-commerce-catalog-actions.js',
      'src/frontend/13-product-admin.js',
      'src/frontend/13a-product-import-export.js',
    ],
  },
  {
    output: 'assets/admin-catalog.js',
    banner: '/* GENERATED ADMIN CATALOG — loaded on demand */',
    sources: [
      'src/frontend/20-product-link-file-import-parser.js',
      'src/frontend/21-product-link-file-import-ui.js',
      'src/frontend/14-categories-and-mapping.js',
      'src/frontend/14a-category-workspace.js',
    ],
  },
  {
    output: 'assets/admin-personalization.js',
    banner: '/* GENERATED ADMIN PERSONALIZATION — loaded on demand */',
    sources: [
      'src/frontend/15-personalization-and-publishing.js',
      'src/frontend/15e-payment-integration-readiness.js',
      'src/frontend/15d-publication-and-export.js',
      'src/frontend/15a-home-promotions-workspace.js',
      'src/frontend/15b-banner-icon-studio.js',
      'src/frontend/15c-campaign-studio-pro.js',
    ],
  },
  {
    output: 'assets/admin-system.js',
    banner: '/* GENERATED ADMIN SYSTEM — loaded on demand */',
    sources: [
      'src/frontend/16-diagnostics.js',
      'src/frontend/19-admin-dashboard.js',
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
  for (const bundle of [...ASSET_BUNDLES, ...ADMIN_RUNTIME_BUNDLES]) {
    const expected = await renderBundle(bundle);
    const outputPath = path.join(ROOT, bundle.output);
    if (check) {
      const current = await readFile(outputPath, 'utf8').catch(() => '');
      if (current !== expected) differences.push(bundle.output);
    } else {
      await writeFile(outputPath, expected, 'utf8');
    }
  }
  for (const vendor of VENDOR_ASSETS) {
    const expected = await readFile(path.join(ROOT, vendor.source), 'utf8');
    const outputPath = path.join(ROOT, vendor.output);
    if (check) {
      const current = await readFile(outputPath, 'utf8').catch(() => '');
      if (current !== expected) differences.push(vendor.output);
    } else {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, expected, 'utf8');
    }
  }
  differences.push(...await buildPublicCompliancePages(ROOT, { check }));
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
