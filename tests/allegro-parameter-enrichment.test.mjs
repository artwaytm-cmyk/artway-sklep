import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichAllegroProductEvidence } from '../src/backend/lib/domain/allegro-parameter-enrichment.mjs';

test('oficjalne opakowanie zastępuje starszy konsensus wieku', () => {
  const result = enrichAllegroProductEvidence({
    productPackagingFacts: { minimumAge: '6+' },
    parametryProducenta: { wiek: '8+' },
    allegroParameterEvidence: {
      age: { value: '8+', source: 'konsensus 48 podobnych produktów', confidence: 0.99 },
    },
  }, []);
  assert.equal(result.evidence.age.value, '6+');
  assert.equal(result.evidence.age.source, 'oficjalne opakowanie produktu');
  assert.equal(result.evidence.age.confidence, 1);
});

test('GPSR odczytuje również z aliasu ostrzezenia w parametrach źródłowych', () => {
  const product = {
    id: '1',
    producent: 'Alexander',
    parametryProducenta: { ostrzezenie: '' },
    parametryZrodla: {
      ostrzezenia: 'Nieodpowiednie dla dzieci poniżej 3 lat. Małe elementy.',
    },
  };
  const result = enrichAllegroProductEvidence(product, []);
  assert.deepEqual(result.product.allegroSafetyInformation, {
    type: 'TEXT',
    description: 'Nieodpowiednie dla dzieci poniżej 3 lat. Małe elementy.',
  });
  assert.equal(result.evidence.safety.source, 'parametry źródła');
  assert.equal(result.evidence.safety.confidence, 1);
});

test('balon foliowy dostaje właściwy materiał i regułę bezpieczeństwa bez ostrzeżenia o lateksie', () => {
  const result = enrichAllegroProductEvidence({
    id: 'foil-balloon',
    nazwa: 'Balon foliowy koń w galopie 56 cm',
    opisKrotki: 'Balon można napełnić helem albo powietrzem.',
    producent: 'Grabo',
  }, []);
  assert.equal(result.evidence.material.value, 'folia');
  assert.match(result.product.allegroSafetyInformation.description, /może przewodzić prąd/i);
  assert.doesNotMatch(result.product.allegroSafetyInformation.description, /lateks/i);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /balonu foliowego/);
});

test('Agent zachowuje jednoznaczny kolor balonu z opisu strony źródłowej', () => {
  const result = enrichAllegroProductEvidence({
    id: '1000794',
    nazwa: 'Balon foliowy Dalmatyńczyk 21" (ok. 60 cm) - Grabo',
    producent: 'Grabo',
    sourceMaterial: {
      longDescription: 'Balon foliowy w kształcie pięknego psa - Dalmatyńczyka, w kolorze białym. Kolor Biały Pakowanie Opakowany.',
    },
  }, []);
  assert.equal(result.evidence.color.value, 'Biały');
  assert.equal(result.evidence.color.confidence, 0.98);
  assert.match(result.evidence.color.source, /stronie źródłowej/);
});

test('kuferek dostaje GPSR wyłącznie z oficjalnych ostrzeżeń rozpoznanych składników', () => {
  const target = {
    id: '1000233',
    nazwa: 'Kuferek świąteczny Alexander',
    producent: 'Alexander',
    sourceMaterial: {
      longDescription: 'W ZESTAWIE ZNAJDZIESZ:\nAle Pary Świąteczne\nPiotruś Pamięć Święta\nSzablony Świąteczne Bałwanek\nSkład zestawu jest podany przez producenta.',
    },
  };
  const warningOne = 'Nieodpowiednie dla dzieci w wieku poniżej 3 lat. Istnieje ryzyko zadławienia się małymi, oderwanymi elementami.';
  const warningTwo = 'Nieodpowiednie dla dzieci w wieku poniżej 3 lat. Istnieje ryzyko zadławienia się małymi elementami.';
  const result = enrichAllegroProductEvidence(target, [
    { id: '1000095', nazwa: 'Ale Pary - Świąteczne (Alexander)', producent: 'Alexander', parametryZrodla: { ostrzezenie: warningOne } },
    { id: '1000179', nazwa: 'Gry karciane Piotruś + Pamięć - Święta', producent: 'Alexander', parametryProducenta: { ostrzezenie: warningOne } },
    { id: '1000693', nazwa: 'Szablony Świąteczne - Bałwanek - Alexander', producent: 'Alexander', parametryZrodla: { ostrzezenie: warningTwo } },
    { id: 'wrong-ale-pary', nazwa: 'Ale Pary - Pojazdy (Alexander)', producent: 'Alexander', parametryZrodla: { ostrzezenie: 'Ostrzeżenie innego wariantu.' } },
    { id: 'wrong-easter', nazwa: 'Piotruś i Pamięć - Wielkanoc', producent: 'Alexander', parametryZrodla: { ostrzezenie: 'Ostrzeżenie wielkanocne.' } },
    { id: 'unrelated', nazwa: 'Puzzle drewniane Świąteczna Wioska', producent: 'Alexander', parametryZrodla: { ostrzezenie: 'Inne ostrzeżenie.' } },
  ]);
  assert.match(result.product.allegroSafetyInformation.description, /zadławienia/i);
  assert.doesNotMatch(result.product.allegroSafetyInformation.description, /Inne ostrzeżenie/i);
  assert.doesNotMatch(result.product.allegroSafetyInformation.description, /innego wariantu|wielkanocne/i);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /3 rozpoznanych składników/);
  assert.deepEqual(result.product.allegroSafetyInformationProvenance.candidates.map((item) => item.productId), ['1000095', '1000179', '1000693']);
});

test('zestaw nie dziedziczy GPSR z jednego podobnego produktu', () => {
  const result = enrichAllegroProductEvidence({
    id: 'bundle-one-peer',
    nazwa: 'Kuferek świąteczny Alexander',
    producent: 'Alexander',
    opis: 'Skład zestawu: Ale Pary Świąteczne.',
  }, [{
    id: 'only-peer',
    nazwa: 'Ale Pary Świąteczne',
    producent: 'Alexander',
    parametryZrodla: { ostrzezenie: 'Nieodpowiednie dla dzieci poniżej 3 lat.' },
  }]);
  assert.equal(result.product.allegroSafetyInformation, undefined);
});

test('Agent przelicza starszy wyprowadzony GPSR zestawu po ulepszeniu reguły', () => {
  const official = 'Nieodpowiednie dla dzieci w wieku poniżej 3 lat. Istnieje ryzyko zadławienia się małymi elementami.';
  const result = enrichAllegroProductEvidence({
    id: 'bundle-recheck',
    nazwa: 'Kuferek świąteczny Alexander',
    producent: 'Alexander',
    sourceMaterial: { longDescription: 'W ZESTAWIE ZNAJDZIESZ:\nAle Pary Świąteczne\nPiotruś Pamięć Święta' },
    allegroSafetyInformation: { type: 'TEXT', description: 'Starszy, zbyt szeroki wynik.' },
    allegroSafetyInformationProvenance: { source: 'zapisane GPSR produktu' },
    allegroParameterEvidence: {
      safety: { value: 'Starszy, zbyt szeroki wynik.', source: 'zapisane GPSR produktu', confidence: 1 },
    },
  }, [
    { id: 'one', nazwa: 'Ale Pary Świąteczne', producent: 'Alexander', parametryZrodla: { ostrzezenie: official } },
    { id: 'two', nazwa: 'Piotruś Pamięć Święta', producent: 'Multigra', parametryZrodla: { ostrzezenie: official } },
  ]);
  assert.equal(result.product.allegroSafetyInformation.description, official);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /2 rozpoznanych składników/);
});

test('wiek i liczba graczy korzystają z konsensusu podobnych gier tej samej serii', () => {
  const product = {
    id: '10',
    nazwa: 'Quiz Junior Zwierzęta',
    producent: 'Alexander',
    kategoria: 'Gry edukacyjne',
    parametryProducenta: { seria: 'Quiz Junior' },
  };
  const peers = [
    {
      id: '11',
      nazwa: 'Quiz Junior Świat',
      producent: 'Alexander',
      kategoria: 'Gry edukacyjne',
      parametryProducenta: { seria: 'Quiz Junior', wiek: '6 lat +', liczbaGraczy: '2-4' },
      allegroAgentPreparationStatus: 'ready',
    },
    {
      id: '12',
      nazwa: 'Quiz Junior Polska',
      producent: 'Alexander',
      kategoria: 'Gry edukacyjne',
      parametryProducenta: { seria: 'Quiz Junior', wiek: '6 lat +', liczbaGraczy: '2-4 graczy' },
      allegroAgentPreparationStatus: 'ready',
    },
  ];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.evidence.age.value, '6 lat +');
  assert.equal(result.evidence.players.value, '2-4');
  assert.match(result.evidence.age.source, /konsensus 2 podobnych produktów/);
  assert.equal(result.evidence.age.candidates.length, 2);
});

test('GPSR może być odziedziczony tylko z konsensusu tej samej serii i rodzaju', () => {
  const product = {
    id: '20',
    nazwa: 'X-Press Me Brelok Pszczoła',
    producent: 'Alexander',
    parametryProducenta: { seria: 'X-Press Me' },
  };
  const warning = 'Nieodpowiednie dla dzieci poniżej 3 lat. Małe elementy.';
  const peers = [
    {
      id: '21',
      nazwa: 'X-Press Me Brelok Kot',
      producent: 'Alexander',
      parametryProducenta: { seria: 'X-Press Me', ostrzezenie: warning },
      allegroAgentPreparationStatus: 'ready',
    },
    {
      id: '22',
      nazwa: 'X-Press Me Brelok Krab',
      producent: 'Alexander',
      parametryProducenta: { seria: 'X-Press Me', ostrzezenie: warning },
      allegroAgentPreparationStatus: 'ready',
    },
  ];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroSafetyInformation.description, warning);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /konsensus 2/);
});

test('GPSR może pochodzić z dominującego oficjalnego konsensusu tego samego producenta, rodzaju i kategorii', () => {
  const warning = 'Nieodpowiednie dla dzieci poniżej 3 lat. Zestaw zawiera małe elementy - niebezpieczeństwo zakrztuszenia.';
  const product = {
    id: 'puzzle-target',
    nazwa: 'Puzzle Piesek 35 elementów',
    producent: 'Multigra',
    allegroCategoryId: '257813',
  };
  const peers = Array.from({ length: 3 }, (_, index) => ({
    id: `puzzle-peer-${index}`,
    nazwa: `Puzzle Multigra ${index} 35 elementów`,
    producent: 'Multigra',
    allegroCategoryId: '257813',
    parametryZrodla: { ostrzezenia: warning },
  }));
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroSafetyInformation.description, warning);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /konsensus 3/);
});

test('dwa zgodne oficjalne ostrzeżenia puzzli tego samego producenta wystarczają mimo starszej różnicy kategorii', () => {
  const warning = 'Nieodpowiednie dla dzieci w wieku poniżej 3 lat. Zestaw zawiera małe elementy - niebezpieczeństwo zakrztuszenia.';
  const product = {
    id: 'multigra-puzzle-target',
    nazwa: 'Puzzle z Jeżykiem 30 elementów',
    producent: 'Multigra',
    allegroCategoryId: '257813',
  };
  const peers = [
    {
      id: 'multigra-puzzle-one',
      nazwa: 'Puzzle Baby 4 w 1 Multigra',
      producent: 'Multigra',
      allegroCategoryId: '257813',
      parametryProducenta: { ostrzezenie: warning },
    },
    {
      id: 'multigra-puzzle-two',
      nazwa: 'Gra układanka puzzle Akademia Literek Multigra',
      producent: 'Multigra',
      allegroCategoryId: '319063',
      parametryZrodla: { ostrzezenia: warning },
    },
  ];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroSafetyInformation.description, warning);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /konsensus 2/);
});

test('wybiera dwa oficjalne ostrzeżenia puzzli o tym samym wieku i kategorii zamiast ogólnego tekstu AI', () => {
  const verified = 'Nieodpowiednie dla dzieci w wieku poniżej 3 lat. Zestaw zawiera małe elementy - niebezpieczeństwo zakrztuszenia. Istnieje możliwość zranienia ostrymi funkcjonalnymi krawędziami.';
  const product = {
    id: 'multigra-30-target',
    nazwa: 'Puzzle z Jeżykiem 30 elementów',
    producent: 'Multigra',
    allegroCategoryId: '257813',
    parametryProducenta: { wiek: '4 lat', liczbaElementow: '30 szt.' },
  };
  const peers = [
    {
      id: 'multigra-30-confirmed',
      nazwa: 'Puzzle tekturowe 30 elementów',
      producent: 'Multigra',
      allegroCategoryId: '257813',
      parametryProducenta: { wiek: '4+', ostrzezenie: verified },
    },
    {
      id: 'multigra-90-confirmed',
      nazwa: 'Puzzle klasyczne 90 elementów',
      producent: 'Multigra',
      allegroCategoryId: '257813',
      parametryZrodla: { wiek: '4+', ostrzezenia: verified },
    },
    {
      id: 'multigra-baby-different-age',
      nazwa: 'Puzzle Baby 4 w 1',
      producent: 'Multigra',
      allegroCategoryId: '257813',
      parametryProducenta: { wiek: '2+', ostrzezenie: 'Inne ostrzeżenie dla młodszej grupy.' },
    },
    {
      id: 'multigra-generic-ai',
      nazwa: 'Puzzle tradycyjne',
      producent: 'Multigra',
      allegroCategoryId: '257813',
      parametryZrodla: { wiek: '4+', ostrzezenia: 'Lista ostrzeżeń dotyczących bezpieczeństwa puzzli oparta o GPSR: ogólne zasady bezpieczeństwa.' },
    },
  ];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroSafetyInformation.description, verified);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /konsensus 2/);
});

test('zakres 5–107 i zapis 5+ oznaczają ten sam minimalny wiek dla doboru GPSR', () => {
  const verified = 'Nieodpowiednie dla dzieci w wieku poniżej 3 lat. Zestaw zawiera małe elementy - niebezpieczeństwo zakrztuszenia.';
  const product = {
    id: 'dream-team-target',
    nazwa: 'Puzzle drewniane Dream Team 50 elementów',
    producent: 'Alexander',
    allegroCategoryId: '257813',
    parametryProducenta: { wiek: '5+' },
  };
  const peers = [
    {
      id: 'dream-team-range',
      nazwa: 'Puzzle drewniane Dream Team Psy 50 elementów',
      producent: 'Alexander',
      allegroCategoryId: '257813',
      parametryProducenta: { wiek: '5-107', ostrzezenie: verified },
    },
    {
      id: 'dream-team-plus',
      nazwa: 'Puzzle drewniane Dream Team Dinozaury 50 elementów',
      producent: 'Alexander',
      allegroCategoryId: '257813',
      parametryZrodla: { wiek: '5+', ostrzezenia: verified },
    },
  ];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroSafetyInformation.description, verified);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /konsensus 2/);
});

test('rozpoznaje rodzinę Maxi Puzzle 24 i dziedziczy wiek z dwóch oficjalnych wariantów', () => {
  const product = {
    id: 'maxi-rowery',
    nazwa: 'Maxi Puzzle 24 Rowery - Multigra',
    producent: 'Multigra',
    allegroCategoryId: '257813',
  };
  const peers = [
    {
      id: 'maxi-czytanka',
      nazwa: 'Maxi Puzzle 24 Czytanka - Multigra',
      producent: 'Multigra',
      allegroCategoryId: '257813',
      parametryZrodla: { 'wiek graczy od': '4 lat' },
    },
    {
      id: 'maxi-latanie',
      nazwa: 'Maxi Puzzle 24 Latanie - Multigra',
      producent: 'Multigra',
      allegroCategoryId: '257813',
      parametryProducenta: { wiek: '4 lat' },
    },
  ];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroParameterEvidence.age.value, '4 lat');
  assert.match(result.product.allegroParameterEvidence.age.source, /konsensus 2/);
});

test('nie dziedziczy starego ogólnego tekstu GPSR wygenerowanego bez źródła', () => {
  const product = { id: 'safe-target', nazwa: 'Puzzle 50 elementów', producent: 'Alexander', allegroCategoryId: '257813' };
  const peers = Array.from({ length: 4 }, (_, index) => ({
    id: `unsafe-${index}`,
    nazwa: `Puzzle ${index} 50 elementów`,
    producent: 'Alexander',
    allegroCategoryId: '257813',
    allegroSafetyInformation: { type: 'TEXT', description: 'Lista ostrzeżeń: zawsze zapoznaj się z instrukcją i używaj produktu zgodnie z przeznaczeniem.' },
    allegroSafetyInformationProvenance: { source: 'Agent AI' },
  }));
  assert.equal(enrichAllegroProductEvidence(product, peers).product.allegroSafetyInformation, undefined);
});

test('nie kopiuje GPSR z jednego produktu ani z innej serii', () => {
  const product = {
    id: '30',
    nazwa: 'X-Press Me Brelok Pszczoła',
    producent: 'Alexander',
    parametryProducenta: { seria: 'X-Press Me' },
  };
  const peers = [{
    id: '31',
    nazwa: 'Puzzle drewniane',
    producent: 'Alexander',
    parametryProducenta: { seria: 'Milliwood' },
    allegroSafetyInformation: { type: 'TEXT', description: 'Ostrzeżenie puzzli' },
  }];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroSafetyInformation, undefined);
});

test('GPSR korzysta z konsensusu dokładnych dopasowań EAN w katalogu Allegro', () => {
  const warning = 'Nieodpowiednie dla dzieci w wieku poniżej 3 lat. Zestaw zawiera małe elementy - niebezpieczeństwo zakrztuszenia.';
  const target = { id: 'lottografia', nazwa: 'Lottografia - gra edukacyjna', producent: 'Multigra', allegroCategoryId: '6106', parametryProducenta: { wiek: '7 lat' } };
  const exactCatalog = (id, name) => ({
    id, nazwa: name, producent: 'Multigra', allegroCategoryId: '6106', parametryProducenta: { wiek: '7 lat' },
    allegroSafetyInformation: { type: 'TEXT', description: warning },
    allegroSafetyInformationProvenance: { source: 'Katalog Produktów Allegro', method: 'exact_gtin_verified_catalog_product' },
  });
  const generic = exactCatalog('generic', 'Gra edukacyjna ogólna');
  generic.allegroSafetyInformation.description = 'Lista ostrzeżeń: ogólne zasady bezpieczeństwa produktu.';
  const result = enrichAllegroProductEvidence(target, [
    exactCatalog('catalog-one', 'Gra edukacyjna Multigra A'),
    exactCatalog('catalog-two', 'Gra edukacyjna Multigra B'),
    generic,
  ]);
  assert.equal(result.product.allegroSafetyInformation.description, warning);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /konsensus 2/);
  assert.deepEqual(result.product.allegroSafetyInformationProvenance.candidates.map((item) => item.productId), ['catalog-one', 'catalog-two']);
});

test('wiek może pochodzić z dominującego konsensusu wielu produktów tego samego rodzaju', () => {
  const product = {
    id: '40',
    nazwa: 'Zestaw kreatywny Brelok Pszczoła',
    producent: 'Alexander',
    kategoria: 'Zestawy kreatywne',
  };
  const peers = Array.from({ length: 5 }, (_, index) => ({
    id: String(41 + index),
    nazwa: `Zestaw kreatywny Brelok ${index}`,
    producent: 'Alexander',
    kategoria: 'Zestawy kreatywne',
    parametryProducenta: { wiek: '8 lat +' },
  }));
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.evidence.age.value, '8 lat +');
  assert.equal(result.evidence.age.candidates.length, 5);
});

test('liczby graczy nie dziedziczy do zestawu kreatywnego', () => {
  const product = {
    id: '50',
    nazwa: 'Zestaw kreatywny Brelok Pszczoła',
    producent: 'Alexander',
    kategoria: 'Zestawy kreatywne',
  };
  const peers = Array.from({ length: 6 }, (_, index) => ({
    id: String(51 + index),
    nazwa: `Zestaw kreatywny ${index}`,
    producent: 'Alexander',
    kategoria: 'Zestawy kreatywne',
    parametryProducenta: { liczbaGraczy: '2-4' },
  }));
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.evidence.players, undefined);
});

test('wydawca parametru Allegro zawsze pochodzi z rzeczywistego producenta produktu', () => {
  for (const producent of ['Multigra', 'Gabo', 'Nasza Księgarnia']) {
    const result = enrichAllegroProductEvidence({
      id: `publisher-${producent}`,
      nazwa: 'Gra rodzinna',
      producent,
    }, []);
    assert.equal(result.evidence.publisher.value, producent);
    assert.equal(result.evidence.publisher.source, 'kanoniczny producent produktu');
    assert.equal(result.evidence.publisher.confidence, 1);
  }
});

test('rodzaj gry jest wyprowadzany precyzyjnie z nazwy zamiast ogólnej wartości gra', () => {
  const result = enrichAllegroProductEvidence({
    id: 'type-card-game',
    nazwa: 'Język Ciała - karciana gra rodzinna Alexander',
    producent: 'Alexander',
  }, []);
  assert.equal(result.evidence.type.value, 'gra karciana');
  assert.equal(result.evidence.type.confidence, 0.94);
});
