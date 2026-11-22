/**
 * Biroba Vegetable Suppliers — Fuzzy Matching & Catalog Auto-Mapper
 * 
 * Provides high-accuracy matching for handwritten vegetable notes, Indian market slang,
 * phonetically misspelled words, Hindi/Marathi names, and customer establishments.
 */

// Comprehensive Hindi / Marathi / English Mumbai market synonyms dictionary
export const VEGETABLE_SYNONYMS = {
  // Vegetables
  v1: ['kobi', 'kobhi', 'patta gobi', 'patta gobhi', 'cabbage', 'bandha gobi', 'cabbge', 'koby', 'patagobi', 'patagobhi', 'kabi'],
  v2: ['bendi', 'bhendi', 'bhindi', 'okra', 'ladyfinger', 'lady finger', 'bhende', 'bhendee', 'bindi', 'bhenda'],
  v3: ['tomato', 'tamatar', 'tamato', 'tomato big', 'bada tamatar', 'tomato mota', 'tomoto', 'tamater', 'tamata', 'tamator'],
  v4: ['carrot', 'gajar', 'gajjar', 'carot', 'gaajar', 'gazar'],
  v5: ['cucumber', 'kakdi', 'kakadi', 'kheera', 'khira', 'kakdy', 'kheeda'],
  v6: ['beans', 'farasbi', 'fansi', 'french beans', 'beans farasbi', 'binz', 'faras bee', 'farashbi'],
  v7: ['avocado', 'butter fruit', 'avocadoes', 'avokado', 'avacado'],
  v8: ['ginger', 'adrak', 'ale', 'aale', 'adrakh', 'aala', 'adruk', 'adrakh'],
  v9: ['lemon', 'nimbu', 'limbu', 'lemons', 'nimbhu', 'neebu', 'limboda', 'nimboo', 'limboo'],
  v10: ['kothimbir', 'kothmir', 'kotmir', 'coriander', 'dhaniya', 'hara dhaniya', 'kothmari', 'dhana', 'kothambar', 'sambhar'],
  v11: ['shimeji mushroom', 'shimeji', 'shemeji', 'shimeji mashroom', 'brown shimeji', 'white shimeji'],
  v12: ['oyster mushroom', 'oyster', 'dhingri', 'oyster mashroom', 'oister'],
  v13: ['palak', 'spinach', 'paalak', 'palak bhaji', 'palakh'],
  v14: ['red lettuce', 'salad patta red', 'lal salad', 'red salad patta', 'salad patta lal'],
  v15: ['kamal kakadi', 'kamal kakdi', 'lotus stem', 'bhe', 'kamal kakdiya'],
  v16: ['spring onion', 'hara kanda', 'pat kanda', 'scallion', 'green onion', 'kanda pat', 'pyaz patta'],
  v17: ['pokchoy', 'bok choy', 'pak choi', 'pok choy', 'bokchoy'],
  v18: ['capsicum', 'shimla mirch', 'shimla', 'dhobli mirchi', 'bell pepper', 'green capsicum', 'dhobla', 'simla mirchi', 'capsycum'],
  v19: ['bean sprouts', 'sprouts', 'ankurit', 'moong sprouts'],
  v20: ['onion', 'kanda', 'pyaz', 'pyaaz', 'onions', 'dungri'],
  v21: ['garlic', 'lahsun', 'lasun', 'lasan', 'lehsun', 'lahsan', 'lasun chilka', 'garlick'],
  v22: ['rai saag', 'sarson', 'rai bhaji', 'mustard greens'],
  v23: ['muli', 'mull', 'mooli', 'radish', 'mula', 'mulee'],
  v24: ['ratalu', 'sweet potato', 'shakarkand', 'ratale', 'rataloo'],
  v25: ['arbi', 'arvi', 'taro root', 'colocasia', 'alu vadi', 'arbee'],
  v26: ['red bhopla', 'bhopla', 'pumpkin', 'kaddu', 'lal bhopla', 'bhopla lal'],
  v27: ['broccoli', 'brocoli', 'brocly', 'hari gobi', 'brokoli'],
  v28: ['chinese cabbage', 'chinese kobi', 'napa cabbage', 'chinis kobi'],
  v29: ['iceberg lettuce', 'iceberg', 'salad patta', 'lettuce', 'aisberg'],
  v30: ['red cabbage', 'lal kobi', 'purple cabbage', 'lal cabbage'],
  v31: ['baby corn', 'baby con', 'baby con.', 'babycorn', 'corn baby', 'makkai', 'corn pkt'],
  v32: ['red yellow capsicum', 'color capsicum', 'yellow capsicum', 'red capsicum', 'colour capsicum'],
  v33: ['flower', 'cauliflower', 'phool gobi', 'ful kobi', 'flaver', 'phool kobi', 'gobi flower'],
  v34: ['tomato small', 'tamato small', 'small tomato', 'chota tamatar', 'cherry tomato', 'cherry'],
  v35: ['potato', 'batata', 'alu', 'aloo', 'potatoes', 'batato'],
  v36: ['chilly', 'chilli', 'mirchi', 'green chilly', 'hari mirch', 'green chilli', 'mircha', 'tikh mirch'],
  v37: ['brinjal', 'baingan', 'vangi', 'eggplant', 'bengan', 'bhata'],
  v38: ['pudina', 'mint', 'phodina', 'pudeena', 'phudeena'],
  v39: ['methi', 'fenugreek', 'methi bhaji', 'meethi'],
  v40: ['suva', 'dill', 'shepu', 'sowa', 'suwa bhaji'],
  v41: ['celery', 'ajwain patta', 'celery stick', 'selery'],
  v42: ['kadi patta', 'kadipatta', 'curry leaves', 'curry leaf', 'kadi pato', 'mitha neem'],
  v43: ['tondali', 'tondall', 'kundru', 'tindora', 'tendli', 'tondli'],
  v44: ['coconut', 'nariyal', 'naral', 'shrifal'],
  v45: ['dudhi', 'lauki', 'bottle gourd', 'doodhi', 'ghia', 'dudi'],
  v46: ['turya', 'tori', 'ridge gourd', 'turai', 'dodka', 'turiya'],
  v47: ['karela', 'bitter gourd', 'karle', 'karelaa'],
  v48: ['gawar', 'guar', 'cluster beans', 'matar', 'green peas', 'vatana', 'gavarfali'],
  v49: ['chawli', 'chauli', 'lobia', 'long beans', 'chawli fali'],
  v50: ['drum stick', 'shevga', 'sahjan', 'drumstick', 'moringa', 'shevaga'],
  v51: ['suran', 'jimikand', 'yam', 'elephant yam'],
  v52: ['kohala', 'ash gourd', 'petha', 'safed bhopla', 'kohla'],
  v53: ['madrasi kakadi', 'madrasi kakdi', 'sambar cucumber', 'madras kakdi'],
  v54: ['mushroom', 'mashroom', 'button mushroom', 'khumbi', 'mashrum', 'mushrom'],
  v55: ['beet', 'beetroot', 'chukandar', 'bit', 'beet root', 'chokandar'],

  // Standard Fruits
  f1: ['apple royal', 'apple', 'seb', 'safarchand', 'royal apple', 'apple kashmir', 'seb kashmir'],
  f2: ['apple kinnaur', 'kinnaur apple', 'kinnor seb', 'apple kinor'],
  f3: ['apple shimla', 'shimla apple', 'shimla seb'],
  f4: ['banana', 'kela', 'kele', 'bananas'],
  f5: ['mosambi', 'sweet lime', 'mousambi', 'musambi'],
  f6: ['orange', 'santre', 'santra', 'narangi'],
  f7: ['papaya', 'papita', 'popai', 'papaiya'],
  f8: ['pineapple', 'ananas', 'ananaas', 'painapal'],
  f9: ['pomegranate', 'anar', 'dalimb', 'anaar'],
  f10: ['sweet melon', 'kharbuja', 'tarbuj pila', 'kharbooja'],
  f11: ['watermelon', 'tarbuj', 'kalingad', 'tarbooj'],
  f12: ['chikoo', 'sapota', 'chiku', 'cheeku'],
  f13: ['guava', 'amrud', 'peru', 'amrood'],
  f14: ['grapes', 'angur', 'draksha', 'angoor', 'black grapes', 'green grapes'],
  f15: ['kiwi', 'kiwi fruit', 'kivi'],
  f16: ['dragon fruit', 'dragonfruit', 'kamalam'],
  f17: ['fig', 'anjeer', 'anjir'],
  f18: ['custard apple', 'sitaphal', 'sitafal', 'sharifa']
};

/**
 * Normalizes input string: lowercase, trims, removes punctuation and non-alphanumeric chars
 */
export function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein Distance between two strings
 */
export function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates string similarity between 0 (completely different) and 1 (exact match)
 */
export function stringSimilarity(strA, strB) {
  const a = normalizeString(strA);
  const b = normalizeString(strB);

  if (!a || !b) return 0;
  if (a === b) return 1;

  // Substring bonus
  if (a.includes(b) || b.includes(a)) {
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    return 0.85 + 0.15 * (minLen / maxLen);
  }

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Matches an extracted raw item name to the catalog using synonym dictionaries and fuzzy distance.
 * 
 * @param {string} rawName - Raw handwritten text (e.g. "kobi", "patta gobhi", "bhendi 4", "kotmir")
 * @param {Array} catalog - Vegetable/fruit catalog items
 * @returns {Object} { matchedItem, confidence, rawName, score }
 */
export function matchItemToCatalog(rawName, catalog = []) {
  if (!rawName || !catalog || catalog.length === 0) {
    return { matchedItem: null, confidence: 0, rawName };
  }

  const cleanRaw = normalizeString(rawName)
    // Strip common quantity/unit words if accidentally included in name
    .replace(/\b(\d+(\.\d+)?)\s*(kg|kilos?|gaddi|juddi|bundle|pkt|packet|pcs|pieces?|box|sau|sekda)?\b/gi, '')
    .trim();

  let bestMatch = null;
  let highestScore = 0;

  for (const item of catalog) {
    let score = 0;

    // 1. Check exact / direct similarity with catalog item.name
    const directSim = stringSimilarity(cleanRaw, item.name);
    if (directSim > score) score = directSim;

    // 2. Check synonyms dictionary
    const synonyms = VEGETABLE_SYNONYMS[item.id] || [];
    for (const syn of synonyms) {
      const synSim = stringSimilarity(cleanRaw, syn);
      if (synSim > score) score = synSim;
      if (score === 1) break;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  // Determine confidence tier
  let confidence = 'low';
  if (highestScore >= 0.78) confidence = 'high';
  else if (highestScore >= 0.55) confidence = 'medium';

  return {
    matchedItem: highestScore >= 0.50 ? bestMatch : null,
    score: Math.round(highestScore * 100),
    confidence,
    rawName
  };
}

/**
 * Matches a detected customer/hotel name from the slip to the list of restaurants
 */
export function matchCustomerToPredefined(rawCustomer, restaurantList = []) {
  if (!rawCustomer || !restaurantList || restaurantList.length === 0) {
    return null;
  }

  const cleanRaw = normalizeString(rawCustomer)
    .replace(/\b(hotel|restaurant|bar|cafe|m\/s|mess|dhaba)\b/gi, '')
    .trim();

  let bestMatch = null;
  let highestScore = 0;

  for (const restaurant of restaurantList) {
    const cleanRest = normalizeString(restaurant)
      .replace(/\b(hotel|restaurant|bar|cafe|m\/s|mess|dhaba)\b/gi, '')
      .trim();

    const sim = stringSimilarity(cleanRaw, cleanRest);
    if (sim > highestScore) {
      highestScore = sim;
      bestMatch = restaurant;
    }
  }

  return highestScore >= 0.55 ? bestMatch : null;
}

/**
 * Resolves the unit according to the catalog item rules:
 * - Lemon: '100 pcs' (or 'kg')
 * - Greens (Kothimbir, Palak, Pudina, Methi, Suva, Kadi Patta): 'bundle' (or 'kg')
 * - Mushrooms & Garlic: 'pkt' (or 'kg')
 * - Standard items: 'kg'
 */
export function resolveItemUnit(matchedItem, detectedUnit) {
  if (!matchedItem) return 'kg';

  const unitOpt = matchedItem.unitOptions || [];
  const defUnit = matchedItem.unit || 'kg';

  if (!detectedUnit) return defUnit;

  const cleanUnit = normalizeString(detectedUnit);

  // Bundle synonyms
  if (/^(bundle|juddi|judi|gaddi|gadi|pudi|bdl)$/i.test(cleanUnit)) {
    if (unitOpt.includes('bundle')) return 'bundle';
    return defUnit;
  }

  // Packet synonyms
  if (/^(pkt|packet|theli|pau|pouch)$/i.test(cleanUnit)) {
    if (unitOpt.includes('pkt')) return 'pkt';
    return defUnit;
  }

  // 100 pcs synonyms
  if (/^(100|100 pcs|100pcs|sau|sekda)$/i.test(cleanUnit)) {
    if (unitOpt.includes('100 pcs')) return '100 pcs';
    return defUnit;
  }

  // Pieces synonyms
  if (/^(pcs|pc|piece|pieces|nug|dana)$/i.test(cleanUnit)) {
    if (unitOpt.includes('pcs')) return 'pcs';
    return defUnit;
  }

  // Kg synonyms
  if (/^(kg|kilo|kilos|kgm)$/i.test(cleanUnit)) {
    if (unitOpt.includes('kg')) return 'kg';
    return defUnit;
  }

  return defUnit;
}

/**
 * Parses raw text lines (from OCR or manual paste) into structured item rows with quantities and units.
 * Runs 100% locally with 0 API tokens!
 * 
 * Supports formats:
 *   - "Kobi 4kg"
 *   - "Bhendi - 3"
 *   - "Tamatar: 15"
 *   - "Palak 5 juddi"
 *   - "4kg kobi"
 *   - "100 lemon"
 *   - "Lahsun 2 pkt"
 */
export function parseRawTextToItems(rawText, catalog = []) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText
    .split(/\r?\n|;/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const parsedItems = [];

  for (const line of lines) {
    // Strip leading bullets/numbering like "1.", "1)", "- ", "* "
    const cleanLine = line.replace(/^(\d+[\.\)]|\-|\*|\•)\s*/, '').trim();
    if (!cleanLine) continue;

    let detectedName = '';
    let detectedQty = '1';
    let detectedUnit = '';

    // Pattern A: "<Name> [separator] <Qty> <Unit>" e.g. "Kobi - 4 kg", "palak 5 juddi"
    const matchA = cleanLine.match(/^([a-zA-Z\u0900-\u097F\s\/\(\)]+?)[\s\:\-\=]+(\d+(\.\d+)?)\s*([a-zA-Z\u0900-\u097F]+)?$/);

    // Pattern B: "<Qty> <Unit> <Name>" e.g. "4 kg kobi", "5 juddi palak", "100 lemon"
    const matchB = cleanLine.match(/^(\d+(\.\d+)?)\s*([a-zA-Z\u0900-\u097F]+)?\s+([a-zA-Z\u0900-\u097F\s\/\(\)]+)$/);

    if (matchA) {
      detectedName = matchA[1].trim();
      detectedQty = matchA[2].trim();
      detectedUnit = matchA[4] ? matchA[4].trim() : '';
    } else if (matchB) {
      detectedQty = matchB[1].trim();
      detectedUnit = matchB[3] ? matchB[3].trim() : '';
      detectedName = matchB[4].trim();
    } else {
      const numMatch = cleanLine.match(/\b(\d+(\.\d+)?)\b/);
      if (numMatch) {
        detectedQty = numMatch[1];
        detectedName = cleanLine.replace(numMatch[0], '').replace(/[\:\-\=]/g, ' ').trim();
      } else {
        detectedName = cleanLine;
        detectedQty = '1';
      }
    }

    if (detectedName) {
      const { matchedItem, score, confidence } = matchItemToCatalog(detectedName, catalog);
      const resolvedUnit = resolveItemUnit(matchedItem, detectedUnit);

      parsedItems.push({
        id: `scan_row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        rawName: detectedName,
        matchedItemId: matchedItem ? matchedItem.id : '',
        quantity: detectedQty,
        unit: resolvedUnit,
        score,
        confidence
      });
    }
  }

  return parsedItems;
}
