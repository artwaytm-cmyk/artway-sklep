export const VON_HALSKY_AGENT_RULES_VERSION = '2026-08-06.15';

const PUBLIC_GUIDE = 'https://inpost.pl/aktualnosci-inpost-von-halsky-jak-stworzyc-dobra-oferte';

function text(value, max = 500) {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalized(value = '') {
  return text(value, 4000)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'a', 'i', 'do', 'dla', 'na', 'od', 'po', 'w', 'z', 'ze', 'oraz', 'produkt', 'produkty',
  'zestaw', 'szt', 'sztuk', 'gra', 'gry', 'artway', 'alexander', 'multigra', 'godan',
]);

function tokens(value = '') {
  return [...new Set(normalized(value).split(' ').filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function overlap(left = [], right = []) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length / left.length;
}

function productCategoryCorpus(product = {}) {
  const parameters = product.parametryZrodla || product.parametryProducenta || product.parametry || product.parameters || {};
  return [
    product.nazwa, product.name, product.kategoria, product.category, product.podkategoria,
    product.subcategory, product.typ, product.type,
    product.opisKrotki, product.krotkiOpis, product.opis,
    ...Object.keys(parameters),
    ...Object.values(parameters).flatMap((value) => Array.isArray(value) ? value : [value]),
  ].filter(Boolean).join(' ');
}

function productPrimaryCategoryCorpus(product = {}) {
  return [
    product.nazwa, product.name, product.kategoria, product.category,
    product.podkategoria, product.subcategory, product.typ, product.type,
  ].filter(Boolean).join(' ');
}

function categoryIntent(product = {}) {
  const corpus = normalized(productCategoryCorpus(product));
  const primary = normalized(productPrimaryCategoryCorpus(product));
  const identityPrimary = normalized([product.nazwa, product.name, product.typ, product.type].filter(Boolean).join(' '));
  const storeCategory = normalized([
    product.kategoria, product.category, product.podkategoria, product.subcategory,
  ].filter(Boolean).join(' '));
  // Typ produktu wynika z nazwy, kategorii i pola typu. Długi opis często
  // zawiera firmowy akapit wymieniający cały asortyment producenta (np.
  // „puzzle, wiatraki i karty”) i nie może zmieniać faktycznego produktu.
  const magicTrick = /\b(?:magia|sztuczka|sztuczki)\b/.test(primary);
  const lacing = /\b(?:przewlekan|przeplatan)\w*\b/.test(primary);
  // X-Press Me i podobne breloki DIY są kompletnymi zestawami do pracy
  // manualnej. Stara kategoria sklepu „Zabawki konstrukcyjne” nie może
  // przesunąć ich do klocków ani do kategorii gotowych breloków GSM.
  const creativeAccessory = /\bx press\b/.test(primary)
    || (/\bbrelok\w*\b/.test(primary) && /\b(?:diy|zestaw|tworzen|skladan)\w*\b/.test(primary));
  const creativePrimary = creativeAccessory
    || /\b(?:kreator mody|moda i modelki|top fashion|zestaw kreatywn|origami|malowan|rysowan|plastycz|piaskow|szablon|pieczat|mozaik|mandal|ekokreator|wpinank)\w*\b/.test(primary);
  const construction = !creativeAccessory && /\b(?:maly konstruktor|konstrukcyjn|constructor|montino)\w*\b/.test(primary);
  const magneticPuzzle = /\b(?:magnesiak|obrazk\w* magnetyczn)\w*\b/.test(primary);
  const modelKit = /\bmetalcraft\b/.test(primary)
    || /\b(?:model|replika)\w*\b.*\b(?:samodzieln\w* skladan|do skladan|montaz)\w*\b/.test(primary);
  const moneyPlay = /\b(?:zabawk\w* edukacyjn\w* pieniadz\w*|pieniadze 500)\b/.test(primary);
  const parameters = product.parametryZrodla || product.parametryProducenta || product.parametry || product.parameters || {};
  const playerCount = product.liczbaGraczy || product.gracze
    || parameters.liczbaGraczy || parameters.liczba_graczy || parameters['liczba graczy'] || parameters.gracze || '';
  const playerMetadataConfirmsGame = /\d/.test(String(playerCount))
    && /\b(?:gra|gry|rozgryw|gracz)\w*\b/.test(corpus)
    && !construction
    && !lacing
    && !magneticPuzzle
    && !modelKit
    && !moneyPlay
    && !/\b(?:puzzle|puzzl|ukladanka)\w*\b/.test(primary);
  const boardGame = (/\b(?:gra|gry|planszow\w*|zestaw gier|familijn\w*|rodzinn\w*)\b/.test(primary) || playerMetadataConfirmsGame)
    && !magicTrick
    && !creativePrimary
    && !construction
    && !lacing
    && !magneticPuzzle
    && !modelKit
    && !moneyPlay
    && !/\b(?:gra na pc|gry na pc|xbox|playstation|nintendo|rpg)\b/.test(corpus);
  const balloon = /\b(?:balon(?:y|u|em|ie|owy|owa|owe)?|foliow\w*|lateksow\w*|hel(?:em|u|owy|owa|owe)?)\b/.test(primary);
  const windmill = /\b(?:wiatrak|wiatraczek|wiatraczki)\w*\b/.test(primary);
  const creative = creativePrimary || /\b(?:origami|malowan|plastycz|kreatywn|piaskow)\w*\b/.test(corpus);
  const puzzle = /\b(?:puzzle|puzzl|puzzel|ukladanka|ukladanki)\w*\b/.test(primary);
  const puzzleSubtype = !puzzle ? ''
    : /\b(?:piankow)\w*\b/.test(corpus) ? 'foam'
      : /\b(?:przestrzenn|3d|4d)\w*\b/.test(corpus) ? 'spatial'
        : /\b(?:akcesori)\w*\b/.test(primary) ? 'accessory'
          : 'traditional';
  const multiGame = /\b(?:\d+\s+gier|zestaw gier|kolekcja gier)\b/.test(corpus)
    || /\b(?:chinczyk.*(?:warcab|mlynek)|warcab.*chinczyk)\w*\b/.test(identityPrimary);
  const explicitBoardGameOverridesStoreCategory = /\bplanszow\w*\b/.test(identityPrimary)
    && /\bkarcian\w*\b/.test(storeCategory)
    && !/\b(?:karcian|karty|talia|piotrus)\w*\b/.test(identityPrimary);
  const cardGame = boardGame && (!multiGame || /\bpiotrus\b/.test(identityPrimary))
    && !explicitBoardGameOverridesStoreCategory
    && /\b(?:karcian|karty|talia|piotrus)\w*\b/.test(primary);
  const cardForChildren = cardGame && /\b(?:piotrus|dla dzieci|dla najmlodszych)\w*\b/.test(identityPrimary);
  const traditionalCard = cardGame && /\b(?:tradycyjn|klasyczn|talia|poker|brydz|remik|kanasta|wojna|makao)\w*\b/.test(identityPrimary);
  const constructionSubtype = construction && /\b(?:montino|rurk\w* 3d|slomk\w*)\b/.test(corpus)
    ? 'tubes'
    : construction && /\bzestaw\w* konstrukcyjn\w*\b/.test(primary) ? 'set'
      : construction ? 'generic' : '';
  const modelKitSubtype = modelKit && /\b(?:czolg|tank|pojazd\w* wojskow)\w*\b/.test(primary) ? 'military' : 'other';
  const subtype = boardGame
    ? multiGame ? (/\b(?:familijn|rodzinn)\w*\b/.test(corpus) ? 'family' : 'generic')
      : /\b(?:szach|szachy)\w*\b/.test(corpus) ? 'chess'
      : /\b(?:warcab)\w*\b/.test(corpus) ? 'checkers'
        : /\b(?:domino)\w*\b/.test(corpus) && !multiGame ? 'domino'
          : /\b(?:chinczyk)\w*\b/.test(corpus) && !multiGame ? 'ludo'
            : cardGame ? (cardForChildren ? 'card_children' : traditionalCard ? 'card_traditional' : 'card_other')
              : /\b(?:familijn|rodzinn)\w*\b/.test(identityPrimary) ? 'family'
      : /\b(?:edukacyjn|logicz|sowa madra glowa)\w*\b/.test(corpus) ? 'educational'
        : /\b(?:familijn|rodzinn)\w*\b/.test(corpus) ? 'family'
        : /\b(?:imprezow|towarzysk)\w*\b/.test(corpus) ? 'party'
          : /\b(?:slow|slown|liter|liczb)\w*\b/.test(corpus) ? 'word_number'
            : 'generic'
    : '';
  return { corpus, primary, boardGame, balloon, windmill, creative, creativeAccessory, creativePrimary, puzzle, puzzleSubtype, lacing, construction, constructionSubtype, magneticPuzzle, modelKit, modelKitSubtype, moneyPlay, magicTrick, cardGame, cardForChildren, multiGame, subtype };
}

function categoryIntentScore(intent = {}, path = '', preparedPath = '') {
  const normalizedPath = preparedPath || normalized(path);
  let score = 0;
  const evidence = [];
    if (intent.boardGame) {
    const boardPath = /\bkultura i rozrywka gry planszowe\b/.test(normalizedPath);
    const traditionalPath = /\bkultura i rozrywka gry tradycyjne\b/.test(normalizedPath);
    const cardPath = /\bkultura i rozrywka gry karciane\b/.test(normalizedPath);
    const wrongDigital = /\bgry na (?:pc|konsole)\b/.test(normalizedPath);
    const wrongAccessory = /\bakcesoria do gier\b/.test(normalizedPath);
    if (boardPath || traditionalPath || cardPath) {
      score += 0.52;
      evidence.push('rozpoznano produkt jako grę stołową');
    } else if (wrongDigital || wrongAccessory || !/\bkultura i rozrywka gry\b/.test(normalizedPath)) {
      score -= 0.75;
    }
    if (intent.multiGame && /\bgry tradycyjne (?:domino|chinczyk|warcaby|szachy)\b/.test(normalizedPath)) {
      score -= 0.85;
      evidence.push('zestaw wielu gier nie jest pojedynczą grą tradycyjną');
    }
    const subtypeRules = {
      family: [/\bplanszowe rodzinne\b/, 0.34, 'rodzinna/familijna → Planszowe › Rodzinne'],
      educational: [/\bplanszowe logiczne i edukacyjne\b/, 0.30, 'logiczna/edukacyjna → Planszowe › Logiczne i edukacyjne'],
      party: [/\bplanszowe imprezowe\b/, 0.30, 'imprezowa → Planszowe › Imprezowe'],
      word_number: [/\bplanszowe slowne i liczbowe\b/, 0.30, 'słowna/liczbowa → Planszowe › Słowne i liczbowe'],
      card_children: [/\bgry karciane karciane dla najmlodszych\b/, 0.55, 'Piotruś dla dzieci → Gry › Karciane › Karciane dla najmłodszych'],
      card_traditional: [/\bgry karciane karciane tradycyjne\b/, 0.55, 'klasyczna talia/gra → Gry › Karciane › Karciane tradycyjne'],
      card_other: [/\bgry karciane pozostale gry karciane\b/, 0.55, 'autorska gra karciana → Gry › Karciane › Pozostałe gry karciane'],
      chess: [/\bgry tradycyjne szachy zestawy szachowe\b/, 0.55, 'pełny zestaw szachowy → Gry tradycyjne › Szachy › Zestawy szachowe'],
      checkers: [/\bgry tradycyjne warcaby\b/, 0.44, 'warcaby → Gry tradycyjne › Warcaby'],
      domino: [/\bgry tradycyjne domino\b/, 0.44, 'domino → Gry tradycyjne › Domino'],
      ludo: [/\bgry tradycyjne chinczyk\b/, 0.44, 'chińczyk → Gry tradycyjne › Chińczyk'],
      generic: [/\bplanszowe pozostale gry planszowe\b/, 0.30, 'ogólna lub wieloelementowa gra → pozostałe gry planszowe'],
    };
    const [pattern, bonus, label] = subtypeRules[intent.subtype] || subtypeRules.generic;
    if (pattern.test(normalizedPath)) {
      score += bonus;
      evidence.push(label);
    }
    if (intent.cardForChildren && /\bgry karciane (?:karciane tradycyjne|pozostale gry karciane)\b/.test(normalizedPath)) {
      score -= 0.35;
      evidence.push('Piotruś dla dzieci nie jest talią tradycyjną ani pozostałą grą karcianą');
    }
    if (intent.subtype === 'card_traditional' && /\bgry karciane (?:karciane dla najmlodszych|pozostale gry karciane)\b/.test(normalizedPath)) {
      score -= 0.35;
      evidence.push('klasyczna gra lub talia nie jest kartami dla najmłodszych ani autorską grą pozostałą');
    }
    if (intent.subtype === 'card_other' && /\bgry karciane (?:karciane dla najmlodszych|karciane tradycyjne)\b/.test(normalizedPath)) {
      score -= 0.35;
      evidence.push('autorska gra karciana nie jest talią tradycyjną ani grą dla najmłodszych');
    }
    if (intent.cardGame && !cardPath) {
      score -= 0.45;
      evidence.push('jawna gra karciana pozostaje w gałęzi Gry › Karciane');
    }
    if (intent.subtype === 'chess' && /\bgry tradycyjne szachy (?:pozostale|akcesoria)\b/.test(normalizedPath)) {
      score -= 0.35;
      evidence.push('pełny zestaw szachowy nie jest akcesorium ani kategorią pozostałą');
    }
  }
  if (intent.balloon) {
    if (/\bokazje i przyjecia dekoracje i gadzety balony\b/.test(normalizedPath)) {
      score += 0.72;
      evidence.push('balon → Dekoracje i gadżety › Balony');
    } else if (/\b(?:dom i ogrod|moda)\b/.test(normalizedPath) || !/\bbalon\w*\b/.test(normalizedPath)) {
      score -= 0.65;
      evidence.push('balon imprezowy nie należy do sezonowych dekoracji domu ani dodatków ślubnych');
    }
  }
  if (intent.windmill) {
    if (/\bdla dzieci rowery i pojazdy akcesoria do dzieciecych rowerow i pojazdow wiatraczki\b/.test(normalizedPath)) {
      score += 0.98;
      evidence.push('wiatrak/wiatraczek → Akcesoria do dziecięcych rowerów i pojazdów › Wiatraczki');
    } else if (/\bwiatraczki\b/.test(normalizedPath)) {
      score += 0.76;
      evidence.push('jednoznaczna końcowa kategoria Wiatraczki');
    } else if (/\b(?:gry|puzzle|dekoracje domowe)\b/.test(normalizedPath)) score -= 0.72;
  }
  if (intent.creative && (intent.creativePrimary || (!intent.boardGame && !intent.construction))) {
    const creativeKit = /\b(?:origami|piaskow|zestaw)\w*\b/.test(intent.corpus);
    const componentCategory = /\bartykuly szkolne artykuly plastyczne (kleje|nozyczki|farby|kredki|pisaki|pedzelki)\b/.exec(normalizedPath);
    if ((creativeKit || intent.creativePrimary) && /\bdla dzieci zabawki zabawki plastyczne prace manualne\b/.test(normalizedPath)) {
      score += 0.88;
      evidence.push(intent.creativeAccessory
        ? 'X-Press/brelok DIY → Zabawki plastyczne › Prace manualne'
        : 'zestaw manualny/origami → Zabawki plastyczne › Prace manualne');
    } else if (componentCategory && !new RegExp(`\\b${componentCategory[1].replace(/.$/, '')}\\w*\\b`).test(intent.primary)) {
      score -= 0.72;
      evidence.push('element zestawu nie może zastąpić kategorii całego produktu');
    } else if (/\bdla dzieci (?:artykuly szkolne artykuly plastyczne|zabawki zabawki plastyczne)\b/.test(normalizedPath)) {
      score += 0.48;
      evidence.push('produkt kreatywny → dziecięce artykuły lub zabawki plastyczne');
    } else if (/\b(?:zestawy kreatywne|origami)\b/.test(normalizedPath)) {
      score += 0.28;
      evidence.push('produkt kreatywny/plastyczny');
    } else if (/\bgry\b/.test(normalizedPath)) score -= 0.62;
  }
  if (intent.puzzle) {
    if (/\bdla dzieci zabawki puzzle\b/.test(normalizedPath)) {
      score += 0.72;
      evidence.push('puzzle → Dla dzieci › Zabawki › Puzzle');
    } else if (/\bgry\b/.test(normalizedPath)) score -= 0.48;
    const subtypeRules = {
      foam: [/\bpuzzle piankowe\b/, 'puzzle piankowe → Puzzle › Puzzle piankowe'],
      spatial: [/\bpuzzle przestrzenne 3d 4d\b/, 'puzzle przestrzenne → Puzzle › Puzzle przestrzenne 3D, 4D'],
      accessory: [/\bakcesoria do puzzli\b/, 'akcesorium → Puzzle › Akcesoria do puzzli'],
      traditional: [/\bpuzzle tradycyjne\b/, 'zwykłe lub drewniane puzzle → Puzzle › Puzzle tradycyjne'],
    };
    const [subtypePattern, subtypeEvidence] = subtypeRules[intent.puzzleSubtype] || subtypeRules.traditional;
    const specializedPuzzlePath = /\b(?:puzzle piankowe|puzzle przestrzenne 3d 4d|akcesoria do puzzli|puzzle tradycyjne)\b/.test(normalizedPath);
    if (subtypePattern.test(normalizedPath)) {
      score += 0.46;
      evidence.push(subtypeEvidence);
    } else if (specializedPuzzlePath) score -= 0.58;
  }
  if (intent.lacing) {
    if (/\bzabawki edukacyjne umyslowe labirynty przeplatanki\b/.test(normalizedPath)) {
      score += 0.82;
      evidence.push('przewlekanka → Zabawki edukacyjne › Labirynty, przeplatanki');
    } else if (/\bgry\b/.test(normalizedPath)) score -= 0.62;
  }
  if (intent.construction) {
    const mechanicSet = /\b(?:maly konstruktor|constructor)\b/.test(intent.corpus);
    const tubeSetPath = /\bdla dzieci zabawki klocki wafle jezyki i slomki konstrukcyjne\b/.test(normalizedPath);
    if (intent.constructionSubtype === 'tubes' && tubeSetPath) {
      score += 0.98;
      evidence.push('Montino/rurki 3D → Klocki › Wafle, jeżyki i słomki konstrukcyjne');
    } else if (intent.constructionSubtype === 'tubes') {
      score -= 0.44;
      evidence.push('zestaw rurek 3D ma dokładniejszą kategorię konstrukcyjną');
    } else if ((mechanicSet || intent.constructionSubtype === 'set') && /\bdla dzieci zabawki majsterkowanie dla dzieci zestawy konstrukcyjne\b/.test(normalizedPath)) {
      score += 0.92;
      evidence.push('Mały Konstruktor → Majsterkowanie dla dzieci › Zestawy konstrukcyjne');
    } else if (/\bdla dzieci zabawki (?:majsterkowanie dla dzieci zestawy konstrukcyjne|zabawki edukacyjne zabawki konstrukcyjne|klocki klocki konstrukcyjne)\b/.test(normalizedPath)) {
      score += 0.74;
      evidence.push('zestaw konstruktorski → dziecięce zestawy konstrukcyjne');
    } else if (/\b(?:rowery|odziez|obuwie)\b/.test(normalizedPath)) score -= 0.85;
  }
  if (intent.magneticPuzzle) {
    if (/\bdla dzieci zabawki zabawki edukacyjne ukladanki pozostale ukladanki dla dzieci\b/.test(normalizedPath)) {
      score += 0.94;
      evidence.push('Magnesiaki → Zabawki edukacyjne › Układanki › Pozostałe układanki dla dzieci');
    } else score -= 0.72;
  }
  if (intent.magicTrick) {
    if (/\bdla dzieci zabawki zabawki edukacyjne pozostale zabawki edukacyjne\b/.test(normalizedPath)) {
      score += 0.92;
      evidence.push('zestaw sztuczek magicznych → Pozostałe zabawki edukacyjne');
    } else score -= 0.76;
  }
  if (intent.modelKit) {
    const modelPath = /\bkolekcje i sztuka kolekcje modelarstwo\b/.test(normalizedPath);
    const remoteControlled = /\bmodelarstwo zdalnie sterowane\b/.test(normalizedPath);
    const subtypePath = intent.modelKitSubtype === 'military'
      ? /\bmodelarstwo pojazdy wojskowe\b/.test(normalizedPath)
      : /\bmodelarstwo pozostale\b/.test(normalizedPath);
    if (modelPath && subtypePath && !remoteControlled) {
      score += 0.94;
      evidence.push(intent.modelKitSubtype === 'military' ? 'Metalcraft pojazd wojskowy → Modelarstwo › Pojazdy wojskowe' : 'Metalcraft model do składania → Modelarstwo › Pozostałe');
    } else score -= 0.72;
  }
  if (intent.moneyPlay) {
    if (/\bpieniadz papierowy zestawy pieniedzy pappierowych\b/.test(normalizedPath)) {
      score += 0.94;
      evidence.push('zestaw pieniędzy edukacyjnych → Zestawy pieniędzy papierowych');
    } else score -= 0.72;
  }
  return { score, evidence };
}

function explicitIntentConfidenceFloor(intent = {}, preparedPath = '') {
  if (!intent.puzzle) return 0;
  const subtypePatterns = {
    foam: /\bpuzzle piankowe\b/,
    spatial: /\bpuzzle przestrzenne 3d 4d\b/,
    accessory: /\bakcesoria do puzzli\b/,
    traditional: /\bpuzzle tradycyjne\b/,
  };
  const subtypePattern = subtypePatterns[intent.puzzleSubtype] || subtypePatterns.traditional;
  // Nazwa/typ kartoteki potwierdza puzzle, a ścieżka API potwierdza ich
  // dokładny podtyp. Ogólna kategoria sklepu (np. „Nowości”) nie może wtedy
  // sztucznie obniżyć pewności poniżej progu automatycznego zastosowania.
  return subtypePattern.test(preparedPath) ? 0.94 : 0;
}

export function compileVonHalskyCategoryIndex(categories = []) {
  const items = (Array.isArray(categories) ? categories : [])
    .filter((item) => item?.leaf === true && text(item?.id, 100))
    .map((item) => {
      const name = text(item.name, 240), path = text(item.path || item.name, 1000);
      return Object.freeze({
        id: text(item.id, 100),
        name,
        path,
        leaf: true,
        nameNormalized: normalized(name),
        pathNormalized: normalized(path),
        nameTokens: Object.freeze(tokens(name)),
        pathTokens: Object.freeze(tokens(path)),
      });
    });
  const tokenItems = new Map(), intentItems = {
    board_game: [], balloon: [], windmill: [], creative: [], puzzle: [], lacing: [], construction: [],
    magnetic_puzzle: [], magic_trick: [], model_kit: [], money_play: [],
  };
  for (const item of items) {
    for (const token of [...new Set([...item.nameTokens, ...item.pathTokens])]) {
      const bucket = tokenItems.get(token) || [];
      bucket.push(item);
      tokenItems.set(token, bucket);
    }
    if (/\bkultura i rozrywka gry (?:planszowe|tradycyjne|karciane)\b/.test(item.pathNormalized)) intentItems.board_game.push(item);
    if (/\bbalon\w*\b/.test(item.pathNormalized)) intentItems.balloon.push(item);
    if (/\bwiatraczki\b/.test(item.pathNormalized)) intentItems.windmill.push(item);
    if (/\b(?:artykuly plastyczne|zabawki plastyczne|zestawy kreatywne|origami)\b/.test(item.pathNormalized)) intentItems.creative.push(item);
    if (/\bdla dzieci zabawki puzzle\b/.test(item.pathNormalized)) intentItems.puzzle.push(item);
    if (/\bzabawki edukacyjne umyslowe labirynty przeplatanki\b/.test(item.pathNormalized)) intentItems.lacing.push(item);
    if (/\bdla dzieci zabawki (?:majsterkowanie dla dzieci zestawy konstrukcyjne|zabawki edukacyjne zabawki konstrukcyjne|klocki (?:klocki konstrukcyjne|wafle jezyki i slomki konstrukcyjne))\b/.test(item.pathNormalized)) intentItems.construction.push(item);
    if (/\bdla dzieci zabawki zabawki edukacyjne ukladanki pozostale ukladanki dla dzieci\b/.test(item.pathNormalized)) intentItems.magnetic_puzzle.push(item);
    if (/\bdla dzieci zabawki zabawki edukacyjne pozostale zabawki edukacyjne\b/.test(item.pathNormalized)) intentItems.magic_trick.push(item);
    if (/\bkolekcje i sztuka kolekcje modelarstwo (?:pojazdy wojskowe|pozostale)\b/.test(item.pathNormalized)) intentItems.model_kit.push(item);
    if (/\bpieniadz papierowy zestawy pieniedzy pappierowych\b/.test(item.pathNormalized)) intentItems.money_play.push(item);
  }
  return Object.freeze({
    version: 1,
    size: items.length,
    items: Object.freeze(items),
    ids: new Set(items.map((item) => item.id)),
    byId: new Map(items.map((item) => [item.id, item])),
    tokenItems,
    intentItems: Object.freeze(Object.fromEntries(Object.entries(intentItems)
      .map(([key, value]) => [key, Object.freeze(value)]))),
  });
}

function meaningfulStoreCategory(product = {}) {
  const value = normalized([
    product.kategoria, product.category, product.podkategoria, product.subcategory,
  ].filter(Boolean).join(' › '));
  if (!value || /^(?:nowosci|promocje|polecane|pozostale|inne)$/.test(value)) return '';
  return value;
}

function categoryConsensus(product = {}, relatedProducts = [], index, trustedProductIds = new Set()) {
  const storeCategory = meaningfulStoreCategory(product);
  if (!storeCategory || !index?.ids?.size) return null;
  const votes = new Map();
  for (const candidate of Array.isArray(relatedProducts) ? relatedProducts : []) {
    if (!candidate || String(candidate.id) === String(product.id)) continue;
    const candidateId = String(candidate.id ?? '');
    const trusted = trustedProductIds.has(candidateId)
      || candidate.vonHalskyCategoryMatchedBy === 'admin'
      || Boolean(candidate.vonHalskyCategoryAcceptedAt);
    if (!trusted || meaningfulStoreCategory(candidate) !== storeCategory) continue;
    const categoryId = text(candidate.vonHalskyCategoryId || candidate.inpostVonHalskyCategoryId, 100);
    if (!index.ids.has(categoryId) || candidate.vonHalskyCategoryRejection) continue;
    const current = votes.get(categoryId) || { categoryId, count: 0, examples: [] };
    current.count += 1;
    if (current.examples.length < 3) current.examples.push(text(candidate.nazwa || candidate.name || candidate.id, 160));
    votes.set(categoryId, current);
  }
  const ranking = [...votes.values()].sort((left, right) => right.count - left.count);
  const selectedVote = ranking[0], runnerUp = ranking[1];
  const total = ranking.reduce((sum, item) => sum + item.count, 0);
  const share = selectedVote ? selectedVote.count / Math.max(1, total) : 0;
  if (!selectedVote || selectedVote.count < 2 || share < 0.72 || selectedVote.count - Number(runnerUp?.count || 0) < 2) return null;
  const category = index.byId.get(selectedVote.categoryId);
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    path: category.path,
    score: Number(Math.min(0.98, 0.84 + Math.min(0.10, selectedVote.count * 0.01) + share * 0.04).toFixed(4)),
    evidence: [
      `potwierdzona kategoria sklepu: ${storeCategory}`,
      `${selectedVote.count} zaakceptowane oferty w tej samej gałęzi`,
      ...selectedVote.examples.map((name) => `wzorzec: ${name}`),
    ],
    source: 'accepted_catalog_consensus',
    support: selectedVote.count,
    share: Number(share.toFixed(4)),
  };
}

export function suggestVonHalskyCategory(product = {}, categories = [], {
  minimumConfidence = 0.82,
  minimumMargin = 0.08,
  categoryIndex = null,
  relatedProducts = [],
  trustedProductIds = new Set(),
} = {}) {
  const index = categoryIndex?.items ? categoryIndex : compileVonHalskyCategoryIndex(categories);
  const primaryCorpus = productPrimaryCategoryCorpus(product), primaryNormalized = normalized(primaryCorpus);
  const productTokens = tokens(primaryCorpus);
  const intent = categoryIntent(product);
  const rawStoreCategory = normalized([
    product.kategoria, product.category, product.podkategoria, product.subcategory,
  ].filter(Boolean).join(' '));
  // Jawny typ produktu z nazwy/źródła ma pierwszeństwo przed starą, błędną
  // kategorią sklepu. Inaczej „gra planszowa” opisana dawniej jako „gry
  // karciane” tworzy sztuczny remis i niepotrzebnie zatrzymuje Agenta.
  const conflictingStoreCategory = intent.boardGame
    && /\bplanszow\w*\b/.test(primaryNormalized)
    && /\bkarcian\w*\b/.test(rawStoreCategory);
  const categoryTokens = tokens(conflictingStoreCategory ? '' : rawStoreCategory);
  const intentKey = intent.puzzle ? 'puzzle'
    : intent.balloon ? 'balloon'
      : intent.windmill ? 'windmill'
      : intent.lacing ? 'lacing'
        : intent.magneticPuzzle ? 'magnetic_puzzle'
          : intent.magicTrick ? 'magic_trick'
            : intent.modelKit ? 'model_kit'
              : intent.moneyPlay ? 'money_play'
        : intent.construction ? 'construction'
          : intent.creativePrimary ? 'creative'
            : intent.boardGame ? 'board_game'
              : intent.creative ? 'creative'
                : '';
  const candidateMap = new Map();
  for (const token of [...new Set([...productTokens, ...categoryTokens])]) {
    for (const item of index.tokenItems?.get(token) || []) candidateMap.set(item.id, item);
  }
  const intentRows = index.intentItems?.[intentKey] || [];
  const candidateRows = intentRows.length
    ? intentRows
    : candidateMap.size ? [...candidateMap.values()] : index.items;
  const candidates = candidateRows
    .map((item) => {
      const nameCoverage = overlap(item.nameTokens, productTokens);
      const pathCoverage = overlap(item.pathTokens, productTokens);
      const catalogAgreement = overlap(categoryTokens, item.pathTokens);
      const exactPhrase = item.nameNormalized.length >= 4 && primaryNormalized.includes(item.nameNormalized);
      const intentMatch = categoryIntentScore(intent, item.path, item.pathNormalized);
      const score = Math.max(explicitIntentConfidenceFloor(intent, item.pathNormalized), Math.min(1, (
        (exactPhrase ? 0.48 : 0)
        + nameCoverage * 0.34
        + pathCoverage * 0.08
        + catalogAgreement * 0.30
        + intentMatch.score
      )));
      return {
        id: item.id,
        name: item.name,
        path: item.path,
        score: Number(score.toFixed(4)),
        source: 'api_tree_semantic',
        evidence: [
          exactPhrase && `pełna nazwa kategorii występuje w kartotece: ${item.name}`,
          nameCoverage > 0 && `zgodność słów kategorii: ${Math.round(nameCoverage * 100)}%`,
          catalogAgreement > 0 && `zgodność z kategorią sklepu: ${Math.round(catalogAgreement * 100)}%`,
          ...intentMatch.evidence,
        ].filter(Boolean),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path, 'pl'))
    .slice(0, 5);
  const semantic = candidates[0] || null, consensus = categoryConsensus(product, relatedProducts, index, trustedProductIds);
  const selected = consensus && (!semantic || semantic.id === consensus.id || semantic.score < 0.96)
    ? {
        ...consensus,
        evidence: [...consensus.evidence, ...(semantic?.id === consensus.id ? semantic.evidence : [])],
        score: Math.max(consensus.score, semantic?.id === consensus.id ? semantic.score : 0),
      }
    : semantic;
  const runnerUp = candidates.find((candidate) => candidate.id !== selected?.id) || null;
  const margin = selected ? selected.score - Number(runnerUp?.score || 0) : 0;
  const consensusApplicable = selected?.source === 'accepted_catalog_consensus' && selected.support >= 2;
  const recognizedIntent = Boolean(intentKey);
  return {
    selected,
    candidates,
    confidence: Number((selected?.score || 0).toFixed(4)),
    margin: Number(margin.toFixed(4)),
    autoApplicable: Boolean(
      selected
      && selected.score >= Number(minimumConfidence || 0.82)
      && (recognizedIntent || consensusApplicable)
      && (consensusApplicable || margin >= Number(minimumMargin || 0.08))
    ),
    intent: {
      type: intent.puzzle ? 'puzzle'
        : intent.balloon ? 'balloon'
          : intent.windmill ? 'windmill'
          : intent.lacing ? 'lacing'
            : intent.magneticPuzzle ? 'magnetic_puzzle'
              : intent.magicTrick ? 'magic_trick'
                : intent.modelKit ? 'model_kit'
                  : intent.moneyPlay ? 'money_play'
            : intent.construction ? 'construction'
              : intent.creativePrimary ? 'creative'
                : intent.cardGame ? 'card_game'
                  : intent.boardGame ? 'board_game'
                    : intent.creative ? 'creative'
                      : 'general',
      subtype: intent.puzzle ? intent.puzzleSubtype
        : intent.construction ? intent.constructionSubtype
          : intent.modelKit ? intent.modelKitSubtype
          : (intent.subtype || ''),
    },
    categoryTreeSize: index.size,
    source: selected?.source || 'none',
    rulesVersion: VON_HALSKY_AGENT_RULES_VERSION,
  };
}

function attributeRows(payload = {}) {
  if (Array.isArray(payload)) return payload;
  for (const candidate of [payload.data, payload.attributes, payload.items, payload.content]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function attributeValues(attribute = {}) {
  const dictionary = attribute.dictionary && typeof attribute.dictionary === 'object' && !Array.isArray(attribute.dictionary)
    ? attribute.dictionary
    : {};
  const raw = attribute.values || attribute.options || dictionary.values || dictionary.items
    || dictionary.entries || attribute.dictionary || attribute.allowedValues || [];
  return (Array.isArray(raw) ? raw : []).map((value) => ({
    id: text(typeof value === 'object' ? value.id || value.value || value.code : value, 1024),
    label: text(typeof value === 'object' ? value.name || value.label || value.value || value.code : value, 1024),
  })).filter((value) => value.id || value.label);
}

function productParameterRows(product = {}) {
  const rows = [], seen = new Set();
  const packagingFacts = product.productPackagingFacts && typeof product.productPackagingFacts === 'object'
    ? {
        'minimalny wiek dziecka': product.productPackagingFacts.minimumAge || product.productPackagingFacts.age,
        materiał: product.productPackagingFacts.material,
        'informacje dot. bezpieczeństwa i zgodności produktu': product.productPackagingFacts.safetyInformation,
      }
    : {};
  const inferredEvidence = {};
  const parameterEvidence = product.allegroParameterEvidence && typeof product.allegroParameterEvidence === 'object'
    ? product.allegroParameterEvidence
    : {};
  for (const [field, name] of Object.entries({
    age: 'minimalny wiek dziecka',
    players: 'liczba graczy',
    material: 'materiał',
    language: 'język',
    type: 'typ produktu',
  })) {
    const value = parameterEvidence[field]?.value;
    if (value !== undefined && value !== null && text(value, 2000)) inferredEvidence[name] = value;
  }
  // Fakty odczytane z opakowania tego dokładnego produktu są mocniejsze niż
  // konsensus podobnych kartotek i muszą zostać rozpatrzone jako pierwsze.
  for (const source of [packagingFacts, product.parametryZrodla, product.parametryProducenta, inferredEvidence, product.parametry, product.parameters]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    for (const [rawName, value] of Object.entries(source)) {
      const name = text(rawName, 240).replace(/([a-ząćęłńóśźż])([A-Z])/g, '$1 $2');
      const key = normalized(name);
      if (!name || seen.has(key)) continue;
      const values = (Array.isArray(value) ? value : [value]).map((item) => text(item, 2000)).filter(Boolean);
      if (!values.length) continue;
      rows.push({
        name,
      value: text(Array.isArray(value) ? value.join(', ') : value, 2000),
        values,
      });
      seen.add(key);
    }
  }
  return rows;
}

const VON_HALSKY_ATTRIBUTE_ALIASES = [
  ['minimalny wiek dziecka', 'wiek dziecka', 'wiek', 'wiek od', 'minimalny wiek', 'zalecany minimalny wiek'],
  ['ean', 'gtin', 'kod ean'],
  ['kod producenta', 'nr produktu', 'mpn', 'symbol producenta', 'numer katalogowy'],
  ['liczba elementow', 'ilosc elementow', 'liczba puzzli', 'ilosc puzzli', 'elementy'],
  ['liczba graczy', 'ilosc graczy', 'gracze'],
  ['material', 'material wykonania'],
  ['jezyk', 'wersja jezykowa', 'jezyk wydania'],
].map((aliases) => new Set(aliases.map(normalized)));

function equivalentAttributeNames(name = '') {
  const key = normalized(name), aliases = VON_HALSKY_ATTRIBUTE_ALIASES.find((group) => group.has(key));
  return aliases || new Set([key]);
}

export function matchVonHalskyAttributes(product = {}, payload = {}) {
  const parameters = productParameterRows(product), mapped = {}, evidence = [], missingRequired = [];
  const stored = product.vonHalskyAttributes && typeof product.vonHalskyAttributes === 'object'
    ? product.vonHalskyAttributes
    : {};
  const attributes = attributeRows(payload).map((attribute) => ({
    id: text(attribute.id || attribute.attributeId || attribute.uuid, 100),
    name: text(attribute.name || attribute.label || attribute.displayName, 240),
    type: text(attribute.type || attribute.valueType || attribute.dataType, 80).toUpperCase(),
    expectedValue: text(attribute.expectedValue, 80).toUpperCase(),
    required: attribute.required === true || attribute.isRequired === true
      || ['ONE', 'ONE_OR_MANY'].includes(text(attribute.expectedValue, 80).toUpperCase()),
    multiple: attribute.multiple === true || attribute.multiselect === true
      || ['NULL_OR_MANY', 'ONE_OR_MANY'].includes(text(attribute.expectedValue, 80).toUpperCase()),
    values: attributeValues(attribute),
  })).filter((attribute) => attribute.id && attribute.name);
  for (const attribute of attributes) {
    const storedRaw = stored[attribute.id];
    const storedValues = (Array.isArray(storedRaw) ? storedRaw : [storedRaw])
      .map((value) => text(value, 2000))
      .filter(Boolean);
    if (storedValues.length && (attribute.multiple || storedValues.length === 1)) {
      const normalizedValues = attribute.values.length
        ? storedValues.map((value) => attribute.values.find((option) => (
          normalized(option.id) === normalized(value) || normalized(option.label) === normalized(value)
        ))).filter(Boolean).map((option) => option.id || option.label)
        : storedValues;
      if (normalizedValues.length === storedValues.length) {
        mapped[attribute.id] = attribute.multiple ? normalizedValues : normalizedValues[0];
        evidence.push({ attributeId: attribute.id, attribute: attribute.name, source: 'kartoteka Von Halsky', value: mapped[attribute.id] });
        continue;
      }
    }
    const keys = equivalentAttributeNames(attribute.name);
    const source = parameters.find((parameter) => keys.has(normalized(parameter.name)));
    if (!source) {
      if (attribute.required) missingRequired.push(attribute.name);
      continue;
    }
    const sourceValues = Array.isArray(source.values) ? source.values : [source.value].filter(Boolean);
    if (!attribute.multiple && sourceValues.length !== 1) {
      if (attribute.required) missingRequired.push(attribute.name);
      continue;
    }
    let selected = attribute.multiple ? sourceValues : sourceValues[0];
    if (attribute.values.length) {
      const exact = sourceValues.map((value) => attribute.values.find((option) => (
        normalized(option.label) === normalized(value)
        || normalized(option.id) === normalized(value)
      ))).filter(Boolean);
      if (exact.length !== sourceValues.length) {
        if (attribute.required) missingRequired.push(attribute.name);
        continue;
      }
      selected = exact.map((option) => option.id || option.label);
      if (!attribute.multiple) selected = selected[0];
    }
    mapped[attribute.id] = attribute.multiple ? selected : selected;
    evidence.push({
      attributeId: attribute.id,
      attribute: attribute.name,
      source: source.name,
      strategy: normalized(source.name) === normalized(attribute.name) ? 'exact-name' : 'verified-semantic-alias',
      value: selected,
    });
  }
  const required = attributes.filter((attribute) => attribute.required).length;
  const mappedRequired = required - missingRequired.length;
  return {
    mapped,
    definitions: attributes,
    evidence,
    required,
    mappedRequired,
    missingRequired: [...new Set(missingRequired)],
    coverage: required ? Number((mappedRequired / required).toFixed(4)) : 1,
    exactOnly: true,
    semanticAliases: true,
    rulesVersion: VON_HALSKY_AGENT_RULES_VERSION,
  };
}

export function vonHalskyAgentPreparationPatch({
  product = {},
  readiness = {},
  categoryMatch = null,
  attributeMatch = null,
  timestamp = new Date().toISOString(),
  status = '',
  error = '',
  savedFields = [],
  runId = '',
} = {}) {
  const issues = [...(readiness.issues || []), ...(readiness.publicationIssues || [])];
  const agentStatus = status || (readiness.publishable ? 'ready' : issues.length ? 'requires_data' : 'review');
  const confirmedFields = [...new Set((Array.isArray(savedFields) ? savedFields : [])
    .map((item) => text(item, 120))
    .filter(Boolean))].slice(0, 120);
  return {
    vonHalskyAgentStatus: agentStatus,
    vonHalskyAgentPreparedAt: timestamp,
    vonHalskyAgentConfirmedAt: '',
    vonHalskyAgentPreparationRunId: text(runId, 160),
    vonHalskyAgentPreparationSource: 'agent-serwerowy',
    vonHalskyAgentSaveState: 'pending_readback',
    vonHalskyAgentReadbackConfirmed: false,
    vonHalskyAgentSavedFields: confirmedFields,
    vonHalskyAgentRulesVersion: VON_HALSKY_AGENT_RULES_VERSION,
    vonHalskyAgentDocumentation: PUBLIC_GUIDE,
    vonHalskyAgentScore: Number(readiness.score || 0),
    vonHalskyAgentIssues: [...new Set(issues.map((item) => text(item, 300)).filter(Boolean))].slice(0, 30),
    vonHalskyAgentWarnings: [...new Set((readiness.warnings || []).map((item) => text(item, 300)).filter(Boolean))].slice(0, 30),
    vonHalskyAgentError: text(error, 1000),
    vonHalskyAgentCategorySuggestion: categoryMatch?.selected ? {
      id: categoryMatch.selected.id,
      name: categoryMatch.selected.name,
      path: categoryMatch.selected.path,
      confidence: categoryMatch.confidence,
      autoApplicable: categoryMatch.autoApplicable === true,
      source: categoryMatch.source || categoryMatch.selected.source || 'api_tree_semantic',
      evidence: categoryMatch.selected.evidence || [],
    } : null,
    vonHalskyAgentAttributeCoverage: attributeMatch ? attributeMatch.coverage : null,
    vonHalskyAgentMissingAttributes: attributeMatch?.missingRequired || [],
    vonHalskyAgentEvidence: {
      identity: readiness?.identifiers?.ean ? 'gtin' : readiness?.identifiers?.manufacturerCode && readiness?.identifiers?.brand ? 'manufacturer_code_brand' : 'missing',
      category: categoryMatch?.selected?.id || product.vonHalskyCategoryId || '',
      attributesMapped: attributeMatch?.evidence?.length || 0,
      exactAttributeMatchingOnly: true,
    },
  };
}
