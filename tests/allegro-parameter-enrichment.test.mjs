import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichAllegroProductEvidence } from '../src/backend/lib/domain/allegro-parameter-enrichment.mjs';

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
      parametryProducenta: { seria: 'X-Press Me' },
      allegroSafetyInformation: { type: 'TEXT', description: warning },
      allegroAgentPreparationStatus: 'ready',
    },
    {
      id: '22',
      nazwa: 'X-Press Me Brelok Krab',
      producent: 'Alexander',
      parametryProducenta: { seria: 'X-Press Me' },
      allegroSafetyInformation: { type: 'TEXT', description: warning },
      allegroAgentPreparationStatus: 'ready',
    },
  ];
  const result = enrichAllegroProductEvidence(product, peers);
  assert.equal(result.product.allegroSafetyInformation.description, warning);
  assert.match(result.product.allegroSafetyInformationProvenance.source, /konsensus 2/);
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
