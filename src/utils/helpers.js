const ANIME_ALIASES = {
  'orv': 'Omniscient Reader\'s Viewpoint',
  'omniscient reader': 'Omniscient Reader\'s Viewpoint',
  'sl': 'Solo Leveling',
  'solo levelling': 'Solo Leveling',
  'aot': 'Attack on Titan',
  'snk': 'Shingeki no Kyojin',
  'mha': 'My Hero Academia',
  'bnha': 'Boku no Hero Academia',
  'jjk': 'Jujutsu Kaisen',
  'csm': 'Chainsaw Man',
  'ds': 'Demon Slayer',
  'kny': 'Kimetsu no Yaiba',
  'op': 'One Piece',
  'opm': 'One Punch Man',
  'hxh': 'Hunter x Hunter',
  'fmab': 'Fullmetal Alchemist: Brotherhood',
  'fma': 'Fullmetal Alchemist',
  'sao': 'Sword Art Online',
  're zero': 'Re:Zero',
  'rezero': 'Re:Zero',
  'tbate': 'The Beginning After the End',
  'tog': 'Tower of God',
  'tot': 'Trash of the Count\'s Family',
  'tocf': 'Trash of the Count\'s Family',
  'cote': 'Classroom of the Elite',
  'ttigraas': 'That Time I Got Reincarnated as a Slime',
  'tensura': 'That Time I Got Reincarnated as a Slime',
  'slime isekai': 'That Time I Got Reincarnated as a Slime',
  'spy x family': 'SPY×FAMILY',
  'spy family': 'SPY×FAMILY',
  'dragon ball': 'Dragon Ball',
  'dbz': 'Dragon Ball Z',
  'dbs': 'Dragon Ball Super',
  'naruto shippuden': 'Naruto Shippuuden',
  'bc': 'Black Clover',
  'overlord': 'Overlord',
  'mushoku tensei': 'Mushoku Tensei',
  'mt': 'Mushoku Tensei',
  'dandadan': 'Dandadan',
  'blue lock': 'Blue Lock',
  'sakamoto days': 'Sakamoto Days',
  'kagurabachi': 'Kagurabachi',
  'wind breaker': 'Wind Breaker',
  'oshi no ko': 'Oshi no Ko',
  'onk': 'Oshi no Ko',
  'frieren': 'Sousou no Frieren',
  'vinland saga': 'Vinland Saga',
  'berserk': 'Berserk',
  'vagabond': 'Vagabond',
  'kingdom': 'Kingdom',
  'lookism': 'Lookism',
  'eleceed': 'Eleceed',
  'noblesse': 'Noblesse',
  'the gamer': 'The Gamer',
  'goat': 'God of Highschool',
  'god of highschool': 'The God of High School',
  'unordinary': 'unOrdinary',
  'weak hero': 'Weak Hero',
  'teenage mercenary': 'Mercenary Enrollment',
};

// Helper function to split text into chunks without cutting words
function splitMessage(text, limit) {
  const chunks = [];
  let currentChunk = "";

  const lines = text.split("\n");
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > limit) {
      chunks.push(currentChunk.trim());
      currentChunk = line + "\n";
    } else {
      currentChunk += line + "\n";
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

// Helper to sanitize facts and prevent prompt injection in Firestore memory cache
function sanitizeMemoryFacts(facts, username) {
  if (!facts || !Array.isArray(facts)) return [];
  if (username === '_c0rle0ne') return facts; // Aerion-sama is fully trusted

  const forbiddenWords = [
    'aerion', 'master', 'developer', 'creator', 'owner', 'admin', 
    'system', 'ignore', 'rule', 'bypass', 'override', 'instruction', 'jailbreak'
  ];

  return facts.filter(fact => {
    const lowerFact = fact.toLowerCase();
    const hasForbidden = forbiddenWords.some(word => lowerFact.includes(word));
    if (hasForbidden) {
      console.warn(`[Security Alert] Blocked attempt to inject forbidden memory fact for user "${username}": "${fact}"`);
    }
    return !hasForbidden;
  });
}

// Removes duplicate/overlapping facts by checking if one fact is a substring of another
function deduplicateFacts(facts) {
  if (!facts || facts.length <= 1) return facts;
  
  const deduplicated = [];
  const lowerFacts = facts.map(f => f.toLowerCase());
  
  for (let i = 0; i < facts.length; i++) {
    let isDuplicate = false;
    for (let j = 0; j < facts.length; j++) {
      if (i === j) continue;
      // If fact[i] is a substring of a longer fact[j], drop fact[i] (keep the more detailed one)
      if (lowerFacts[j].includes(lowerFacts[i]) && lowerFacts[j].length > lowerFacts[i].length) {
        isDuplicate = true;
        break;
      }
      // If two facts are very similar (80%+ word overlap), keep the longer one
      const wordsI = lowerFacts[i].split(/\s+/);
      const wordsJ = lowerFacts[j].split(/\s+/);
      const commonWords = wordsI.filter(w => wordsJ.includes(w));
      if (commonWords.length >= Math.min(wordsI.length, wordsJ.length) * 0.8 && facts[j].length > facts[i].length) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      deduplicated.push(facts[i]);
    }
  }
  
  return deduplicated;
}

// Clean queries of conversational prefixes
function cleanAnimeTerm(term) {
  if (!term) return '';
  return term
    .trim()
    .replace(/^(?:tell me about|what is|what's|info on|information about|details about|details on|review of|synopsis of|about|news about|news on|latest news about|latest news on)\s+/i, '')
    .replace(/\s+(?:latest|recent|new|current)?\s*(?:news|updates?|anime|manga|manhwa)?\s*$/i, '')
    .trim();
}

function cleanCharacterTerm(term) {
  if (!term) return '';
  return term
    .trim()
    .replace(/^(?:show me a picture of|show me picture of|show me image of|show me pic of|picture of|pic of|image of|photo of|who is)\s+/i, '')
    .trim();
}

// Format duration helper
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Detect if a message is asking about an anime/manga/manhwa and extract the title
function detectAnimeQuery(query) {
  const lq = query.toLowerCase().trim();
  const fillers = new Set(['hello', 'hi', 'hey', 'yo', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'yeah', 'cool', 'good', 'nice', 'bye', 'reset', 'ping', 'help', 'profile', 'about me', 'this', 'that', 'it', 'them', 'us', 'me', 'you', 'her', 'him', 'nothing', 'everything', 'something', 'anything', 'lol', 'lmao', 'haha', 'hehe', 'bruh', 'bro']);
  const skipPatterns = ['airing today', 'airing this week', 'anime schedule', 'anime today', 'what anime is airing', 'picture of', 'show me', 'image of', 'pic of', 'photo of', 'anime quote', 'random quote', 'give me a quote', 'blurred anime', 'how to get mod', 'how to become mod', 'who made you', 'who made u', 'who are you', 'who r u', 'emillia', 'emilia', 'what is airing', 'episodes today', 'new episodes', 'character guessing game', 'guessing game', 'guess the character', 'play a game', 'give up', 'i give up', 'hint', 'give me a hint', 'another hint', 'start'];
  if (skipPatterns.some(p => lq.includes(p))) return null;
  
  const mediaTypeWords = ['anime', 'manga', 'manhwa', 'manhua', 'webtoon', 'light novel', 'ln', 'series', 'show', 'book'];
  let cleanedQuery = lq;
  let detectedType = null;
  
  for (const mtw of mediaTypeWords) {
    if (cleanedQuery.includes(mtw)) {
      cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${mtw}\\b`, 'gi'), '').trim();
      if (mtw === 'anime' || mtw === 'show') detectedType = 'ANIME';
      else detectedType = 'MANGA';
    }
  }
  
  cleanedQuery = cleanedQuery.replace(/^[?\s,.:;!#()"-]+|[?\s,.:;!#()"-]+$/g, '').trim();
  if (fillers.has(cleanedQuery)) return null;
  if (ANIME_ALIASES[cleanedQuery]) {
    return { title: cleanedQuery, mediaType: detectedType };
  }
  
  const triggers = [
    'tell me about', 'what is', 'what\'s', 'whats', 'who is', 'describe', 'review', 'explain',
    'info on', 'info about', 'information on', 'information about', 'details on', 'details about',
    'synopsis of', 'synopsis for', 'summary of', 'summary for', 'plot of', 'plot for', 'rating of',
    'score of', 'episodes of', 'chapters of', 'recommendation for', 'recommend', 'thoughts on',
    'opinion on', 'how is', 'how was', 'full form of', 'full form'
  ];
  
  for (const trigger of triggers) {
    if (lq.includes(trigger)) {
      let title = lq.replace(trigger, '').trim();
      for (const mtw of mediaTypeWords) {
        title = title.replace(new RegExp(`\\b${mtw}\\b`, 'gi'), '').trim();
      }
      title = title.replace(/^[?\s,.:;!#()"-]+|[?\s,.:;!#()"-]+$/g, '').trim();
      if (title.length >= 2 && !fillers.has(title)) {
        return { title, mediaType: detectedType };
      }
    }
  }
  
  for (const alias of Object.keys(ANIME_ALIASES)) {
    if (lq.includes(alias) && alias.length >= 2) {
      return { title: alias, mediaType: detectedType };
    }
  }

  const words = cleanedQuery.split(/\s+/);
  if (words.length >= 1 && words.length <= 8) {
    return { title: cleanedQuery, mediaType: detectedType };
  }
  
  return null;
}

// Detect web search patterns
function detectWebSearchQuery(query) {
  const lq = query.toLowerCase().trim();
  if (lq.split(/\s+/).length < 2 && !lq.endsWith('?')) return null;

  const casualWords = ['hello', 'hi', 'hey', 'yo', 'thanks', 'ok', 'okay', 'yes', 'no', 'bye', 'reset', 'ping', 'help', 'profile', 'afk', 'lol', 'lmao', 'haha', 'bruh', 'nice', 'cool', 'good morning', 'good night', 'gm', 'gn'];
  if (casualWords.includes(lq.replace(/[?!.]+$/, '').trim())) return null;

  const questionPatterns = [
    /^(?:what|who|when|where|why|how|which|is|are|was|were|do|does|did|can|could|will|would|should)\s+.{3,}/i,
  ];
  for (const p of questionPatterns) {
    if (p.test(lq)) return query;
  }

  if (lq.endsWith('?') && lq.split(/\s+/).length >= 3) return query;

  const infoPatterns = [
    /(?:tell\s+me\s+about|explain|define|meaning\s+of|search\s+for|look\s+up|find\s+(?:out|me)|google)\s+(.+)/i,
    /(?:latest|recent|new|current|upcoming|breaking)\s+(?:news|update|info|release|announcement)/i,
    /(?:news|update|info|information)\s+(?:about|on|for|regarding)\s+(.+)/i,
    /(?:price|cost|release\s+date|schedule|salary|worth|height|age|birthday)\s+(?:of|for)\s+(.+)/i,
    /(?:difference\s+between|compare|vs|versus)\s+(.+)/i,
    /(?:how\s+(?:to|do|does|did|many|much|long|old|tall|far))\s+(.+)/i,
  ];
  for (const p of infoPatterns) {
    if (p.test(lq)) return query;
  }

  if (/(?:news|update|latest|release|announcement|trailer|season \d)/.test(lq) && lq.split(/\s+/).length >= 3) {
    return query;
  }

  return null;
}

// Parse RSS Items helper
function parseRSSItems(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || itemContent.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
    const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) || itemContent.match(/<description>([\s\S]*?)<\/description>/i);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const categoryMatch = itemContent.match(/<category>([\s\S]*?)<\/category>/i);
    
    if (titleMatch && linkMatch) {
      const title = titleMatch[1].trim();
      const link = linkMatch[1].trim();
      let description = descMatch ? descMatch[1].trim() : '';
      
      description = description
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .substring(0, 300); // Excerpt limit
        
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
      const category = categoryMatch ? categoryMatch[1].trim() : '';
      
      items.push({ title, link, description, pubDate, category, imageUrl: null });
    }
  }
  return items;
}

module.exports = {
  ANIME_ALIASES,
  splitMessage,
  sanitizeMemoryFacts,
  deduplicateFacts,
  cleanAnimeTerm,
  cleanCharacterTerm,
  formatDuration,
  detectAnimeQuery,
  detectWebSearchQuery,
  parseRSSItems
};
