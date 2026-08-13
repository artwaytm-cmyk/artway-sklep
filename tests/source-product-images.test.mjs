import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_IMAGE_POLICY_VERSION,
  inspectedSourceImages,
  sourceProductIdentity,
  trustedLegacySourceImageUpgrade,
  verifiedSourceImages,
} from '../src/backend/lib/domain/source-product-images.mjs';
import { mergeImportedProductSourceRefresh } from '../src/backend/lib/domain/imported-product-catalog.mjs';

const sourceUrl = 'https://hurtownia.example.pl/product-pol-1188-ORIGAMI-3D-KWIATY.html';
const product = {
  id: '1188',
  nazwa: 'Origami 3D Kwiaty',
  ean: '5906018011883',
  sourceUrl,
  zdjecie: 'https://wrong.example.pl/kajak.jpg',
};
const inspection = {
  canonicalUrl: sourceUrl,
  product: {
    nazwa: 'ORIGAMI 3D KWIATY',
    ean: '5906018011883',
    sourceUrl,
    zdjecie: 'https://cdn.example.pl/1188-main.jpg',
    zdjecia: ['https://cdn.example.pl/1188-side.jpg'],
    sourceEvidence: { imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION, imageSourceType: 'product_source_page', imageSourceUrl: sourceUrl },
  },
};

test('galeria z konkretnego linku źródłowego zastępuje błędne stare zdjęcie', () => {
  const result = inspectedSourceImages(product, inspection);
  assert.equal(result.ok, true);
  assert.deepEqual(result.images, ['https://cdn.example.pl/1188-main.jpg', 'https://cdn.example.pl/1188-side.jpg']);
  assert.equal(result.patch.zdjecie, 'https://cdn.example.pl/1188-main.jpg');
  assert.deepEqual(verifiedSourceImages({ ...product, ...result.patch }), result.images);
});

test('sprzeczny EAN blokuje przypisanie galerii z innego produktu', () => {
  const conflict = inspectedSourceImages(product, { ...inspection, product: { ...inspection.product, ean: '5906018000030' } });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.identity.mode, 'ean_conflict');
  assert.equal(sourceProductIdentity(product, { ...inspection.product, ean: '5906018000030' }).ok, false);
});

test('stary cache bez nowej informacji o pochodzeniu zdjęć jest odrzucany', () => {
  const legacy = inspectedSourceImages(product, { ...inspection, fromCache: true, product: { ...inspection.product, sourceEvidence: {} } });
  assert.equal(legacy.ok, false);
  assert.equal(legacy.identity.mode, 'legacy_cache_rejected');
});

test('aktualizacja z linku nadpisuje zdjęcie nawet gdy kartoteka miała wcześniej inną grafikę', () => {
  const refreshed = mergeImportedProductSourceRefresh(product, {
    ...inspection.product,
    sourceEvidence: {
      ...inspection.product.sourceEvidence,
      imageUrls: ['https://cdn.example.pl/1188-main.jpg', 'https://cdn.example.pl/1188-side.jpg'],
    },
  });
  assert.equal(refreshed.zdjecie, 'https://cdn.example.pl/1188-main.jpg');
  assert.deepEqual(refreshed.zdjecia, ['https://cdn.example.pl/1188-side.jpg']);
});

test('potwierdzona galeria tej samej domeny nie znika po chwilowym reader-fallback bez zdjęć', () => {
  const retained = verifiedSourceImages({
    ...product,
    zdjecie: 'https://hurtownia.example.pl/media/1188-main.jpg',
    zdjecia: ['https://hurtownia.example.pl/media/1188-side.jpg'],
    sourceEvidence: {
      imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION,
      imageSourceType: 'product_source_page',
      imageSourceUrl: sourceUrl,
      imageUrls: [],
    },
  });
  assert.deepEqual(retained, [
    'https://hurtownia.example.pl/media/1188-main.jpg',
    'https://hurtownia.example.pl/media/1188-side.jpg',
  ]);
});

test('oficjalne źródło bez galerii zachowuje zdjęcie związane kodem i nazwą produktu', () => {
  const identityBound = inspectedSourceImages({
    id: '1000900',
    nazwa: 'Motyl i papuga - zestaw kreatywny z piaskiem, Multigra',
    ean: '5906395300129',
    kodProducenta: '0012',
    sourceUrl: 'https://multigra.com.pl/produkty/motyl-i-papuga/',
    zdjecie: 'https://a.allegroimg.com/original/abc/Piaskowe-malowanki-Motyl-i-papuga-30012',
  }, {
    canonicalUrl: 'https://multigra.com.pl/produkty/motyl-i-papuga/',
    product: {
      nazwa: 'Motyl i papuga',
      ean: '5906395300129',
      kodProducenta: '0012',
      sourceUrl: 'https://multigra.com.pl/produkty/motyl-i-papuga/',
      sourceEvidence: { imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION },
    },
  });
  assert.equal(identityBound.ok, true);
  assert.equal(identityBound.patch.sourceEvidence.imageSourceType, 'identity_bound_existing_image');
  assert.deepEqual(verifiedSourceImages({
    sourceUrl: 'https://multigra.com.pl/produkty/motyl-i-papuga/',
    ...identityBound.patch,
  }), identityBound.images);
});

test('potwierdzony EAN zachowuje nazwaną galerię po zmianie numeru strony producenta', () => {
  const page = 'https://www.sklep.alexander.com.pl/product-pol-2275-IQ-GAMES-Kombinator-Kwadraty.html';
  const image = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_IQ-GAMES-Kombinator-Kwadraty-737_1.jpg';
  const base = {
    nazwa: 'IQ GAMES Kombinator - Kwadraty, gra logiczna Alexander',
    ean: '5906018022759',
    kodProducenta: '2275',
    sourceUrl: page,
    zdjecie: image,
  };
  const result = inspectedSourceImages(base, {
    canonicalUrl: page,
    product: {
      nazwa: 'IQ GAMES Kombinator Kwadraty',
      ean: '5906018022759',
      kodProducenta: '2275',
      sourceUrl: page,
      sourceEvidence: { imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.images, [image]);
  assert.equal(result.patch.sourceEvidence.imageSourceType, 'identity_bound_existing_image');
  const rejected = inspectedSourceImages({ ...base, zdjecie: 'https://www.sklep.alexander.com.pl/media/Kajak-innego-produktu-737.jpg' }, {
    canonicalUrl: page,
    product: { nazwa: 'IQ GAMES Kombinator Kwadraty', ean: '5906018022759', kodProducenta: '2275', sourceUrl: page },
  });
  assert.equal(rejected.ok, false);
});

test('potwierdzony EAN zachowuje oficjalne zdjęcie z dokładnym numerem strony IdoSell', () => {
  const page = 'https://sklep.alexander.com.pl/product-pol-1637-SILVER-Domino-Mix.html';
  const primary = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_SILVER-Domino-Mix-1637_2.jpg';
  const side = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_SILVER-Domino-Mix-1637_1.jpg';
  const base = {
    nazwa: 'Domino Silver - gra dopasowywania obrazków Alexander',
    ean: '5906018028805',
    kodProducenta: 'SL2880',
    sourceUrl: page,
    zdjecie: primary,
    zdjecia: [side, 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Inna-Gra-999_1.jpg'],
  };
  const result = inspectedSourceImages(base, {
    canonicalUrl: page,
    product: {
      nazwa: 'SILVER - Domino Mix',
      ean: '5906018028805',
      kodProducenta: 'SL2880',
      sourceUrl: page,
      sourceEvidence: { imagePolicyVersion: SOURCE_IMAGE_POLICY_VERSION },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.images, [primary, side]);
  assert.equal(result.patch.sourceEvidence.imageSourceType, 'identity_bound_existing_image');
  assert.deepEqual(result.patch.sourceEvidence.imageUrls, [primary, side]);
});

test('obca grafika pozostaje zablokowana mimo zgodnego EAN strony producenta', () => {
  const rejected = inspectedSourceImages({
    nazwa: 'Motyl i papuga',
    ean: '5906395300129',
    kodProducenta: '0012',
    sourceUrl: 'https://multigra.com.pl/produkty/motyl-i-papuga/',
    zdjecie: 'https://a.allegroimg.com/original/abc/Inna-gra-30012',
  }, {
    canonicalUrl: 'https://multigra.com.pl/produkty/motyl-i-papuga/',
    product: { nazwa: 'Motyl i papuga', ean: '5906395300129', kodProducenta: '0012' },
  });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.images, []);
});

test('starsze zdjęcie IdoSell jest odzyskiwane tylko gdy numer strony produktu zgadza się ze ścieżką obrazu', () => {
  const legacy = {
    sourceUrl: 'https://shop.example.pl/product-pol-438-Gra.html',
    zdjecie: 'https://www.shop.example.pl/media/pol_pm_Gra-438_1.jpg',
  };
  assert.deepEqual(verifiedSourceImages(legacy), [legacy.zdjecie]);
  assert.deepEqual(verifiedSourceImages({ ...legacy, zdjecie: 'https://www.shop.example.pl/media/Kajak-999_1.jpg' }), []);
  assert.deepEqual(verifiedSourceImages({ ...legacy, zdjecie: legacy.sourceUrl }), []);
});

test('stary dowód z dokładnym EAN jest bezpiecznie podnoszony bez ponownego pobrania strony', () => {
  const page = 'https://sklep.alexander.com.pl/product-pol-2668-GRA-ZRECZNOSCIOWA-PCHELKI.html';
  const primary = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_GRA-ZRECZNOSCIOWA-PCHELKI-1415_1.jpg';
  const patch = trustedLegacySourceImageUpgrade({
    nazwa: 'GRA ZRĘCZNOŚCIOWA PCHEŁKI - Alexander',
    ean: '5906018026689',
    sourceUrl: page,
    zdjecie: primary,
    zdjecia: ['https://a.allegroimg.com/original/unverified'],
    parametryZrodla: { ean: '5906018026689' },
    sourceEvidence: {
      imagePolicyVersion: 2,
      imageSourceUrl: 'https://www.sklep.alexander.com.pl/product-pol-2668-GRA-ZRECZNOSCIOWA-PCHELKI.html',
      imageUrls: [],
      fields: ['EAN', 'zdjecia'],
    },
  });
  assert.equal(patch.zdjecie, primary);
  assert.deepEqual(patch.zdjecia, []);
  assert.equal(patch.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
  assert.deepEqual(patch.sourceEvidence.imageUrls, [primary]);
});

test('stary dowód bez dokładnej tożsamości nie jest automatycznie podnoszony', () => {
  assert.equal(trustedLegacySourceImageUpgrade({
    nazwa: 'Inny produkt',
    ean: '5906018026689',
    sourceUrl,
    zdjecie: 'https://hurtownia.example.pl/media/obcy-produkt.jpg',
    sourceEvidence: { imagePolicyVersion: 2, imageSourceUrl: sourceUrl, imageIdentityMode: 'name', imageUrls: [] },
  }), null);
});

test('dwa długie wyróżniające słowa potwierdzają starą galerię po zmianie numeru zasobu', () => {
  const page = 'https://sklep.alexander.com.pl/product-pol-3248-krolestwo-jednorozcow.html';
  const primary = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Gra-planszowa-Krolestwo-Jednorozcow-1781_1.jpg';
  const patch = trustedLegacySourceImageUpgrade({
    nazwa: 'Królestwo Jednorożców - Alexander',
    ean: '5906018032482',
    sourceUrl: page,
    zdjecie: primary,
    parametryZrodla: { ean: '5906018032482' },
    sourceEvidence: {
      imagePolicyVersion: 2,
      imageSourceUrl: page,
      imageUrls: [],
      fields: ['EAN', 'zdjecia'],
      responsibleProducer: {
        legalName: '**: Alexander **Seria:** Królestwo Jednorożców **Kod produktu** 3248 **EAN** 5906018032482 ## Skład zestawu',
      },
    },
  });
  assert.equal(patch.zdjecie, primary);
  assert.equal(patch.sourceEvidence.responsibleProducer, undefined);
});

test('trzy długie słowa zachowują świąteczną galerię mimo rozbudowanej nazwy kartoteki', () => {
  const page = 'https://sklep.alexander.com.pl/product-pol-5093-Swiety-Mikolaj-500el.html';
  const primary = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Puzzle-drewniane-Christmas-Swiety-Mikolaj-500el-1626_1.jpg';
  const patch = trustedLegacySourceImageUpgrade({
    nazwa: 'MilliWOOD Christmas - Święty Mikołaj, puzzel drewniany 500 elementów',
    ean: '5906018050936',
    sourceUrl: page,
    zdjecie: primary,
    parametryZrodla: { ean: '5906018050936' },
    sourceEvidence: {
      imagePolicyVersion: 2,
      imageSourceUrl: page,
      imageUrls: [],
      fields: ['EAN', 'zdjecia'],
    },
  });
  assert.equal(patch.zdjecie, primary);
  assert.equal(patch.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
});

test('dokładny EAN zachowuje trzy wyróżniające słowa galerii mimo długiej nazwy', () => {
  const page = 'https://sklep.alexander.com.pl/product-pol-3011-Pamiec-Farma-Multigra.html';
  const primary = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Pamiec-Farma-Multigra-1832_1.png';
  const side = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Pamiec-Farma-Multigra-1832_2.jpg';
  const patch = trustedLegacySourceImageUpgrade({
    nazwa: 'Pamięć Farma - gra pamięciowa Multigra (seria Memosy)',
    ean: '5904492130113',
    sourceUrl: page,
    zdjecie: primary,
    zdjecia: [side, 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Pamiec-Las-Inna-999_1.jpg'],
    parametryZrodla: { ean: '5904492130113' },
    sourceEvidence: {
      imagePolicyVersion: 2,
      imageSourceUrl: page,
      imageUrls: [],
      fields: ['EAN', 'zdjecia'],
    },
  });
  assert.deepEqual(patch.sourceEvidence.imageUrls, [primary, side]);
  assert.equal(patch.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
});

test('dokładny EAN zachowuje jedno wyróżniające słowo wspólne dla strony i starego zasobu', () => {
  const page = 'https://sklep.alexander.com.pl/product-pol-2538-Slowianie.html';
  const primary = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Slowianie-1175_1.png';
  const side = 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Slowianie-1175_2.jpg';
  const patch = trustedLegacySourceImageUpgrade({
    nazwa: 'Słowianie - gra planszowa Alexander',
    ean: '5906018025385',
    sourceUrl: page,
    zdjecie: primary,
    zdjecia: [side, 'https://www.sklep.alexander.com.pl/hpeciai/hash/pol_pl_Alexander-Gra-Planszowa-999_1.jpg'],
    parametryZrodla: { ean: '5906018025385' },
    sourceEvidence: {
      imagePolicyVersion: 2,
      imageSourceUrl: page,
      imageUrls: [],
      fields: ['EAN', 'zdjecia'],
    },
  });
  assert.deepEqual(patch.sourceEvidence.imageUrls, [primary, side]);
  assert.equal(patch.sourceEvidence.imagePolicyVersion, SOURCE_IMAGE_POLICY_VERSION);
});
