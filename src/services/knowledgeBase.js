// AniPedia Vector Knowledge Base with Cosine Similarity Search
// Stores structured verified knowledge chunks about AniPedia server, channels, staff, and rules.

const KNOWLEDGE_DOCS = [
  {
    id: "server_channels_general",
    category: "channels",
    keywords: ["general", "general chat", "where to chat", "rules in general", "chatting channel", "main chat"],
    content: "Channel #・general-chat is for discussing anime, manga, and wholesome general topics. Topics involving 18+, NSFW, excessive violence, gore, and death are strictly forbidden to ensure a safe environment for all members including minors."
  },
  {
    id: "server_channels_media",
    category: "channels",
    keywords: ["media share", "share pictures", "photos", "daily life", "post art", "media channel"],
    content: "Channel #・media-share is where members can share pictures of their daily lives, wholesome artwork, anime photos, and moments. All media must adhere to community guidelines (no NSFW, gore, or violence)."
  },
  {
    id: "server_channels_manga",
    category: "channels",
    keywords: ["manga panels", "manga channel", "share manga", "favorite panel", "manga moments"],
    content: "Channel #・manga-pannels is dedicated to sharing favorite manga panels, iconic panels, theories, and discussion. NSFW and untagged spoiler panels are not permitted."
  },
  {
    id: "server_channels_games",
    category: "channels",
    keywords: ["bot games", "games channel", "owo", "negotina", "nekotina", "pokemon", "play games", "game channel"],
    content: "Channel #・owo and #・bot-games are for playing interactive bot games like OwO, Nekotina, and Pokémon. Spamming bot game commands is allowed in bot game channels, but NSFW and violence are strictly prohibited."
  },
  {
    id: "server_roles_hierarchy",
    category: "roles",
    keywords: ["roles", "role hierarchy", "shogun", "royal hand", "ceo", "ranks", "highest role"],
    content: "The AniPedia role hierarchy: 1. Shogun (The Owner and highest authority). 2. Royal Hand (The CEOs/Executives who manage all operations and users). 3. Moderator (Enforces rules and maintains order). 4. Junior Moderator (Oversees user activity and assists staff). 5. Level Roles (Unlocked by activity)."
  },
  {
    id: "server_staff_members",
    category: "staff",
    keywords: ["creator", "who made server", "owner", "roan", "aerion", "kyojin", "lejitt", "sunny", "staff", "who runs server", "founders"],
    content: "AniPedia Leaders & Staff: Roan is the Creator of the server, and we are all building this community together. The CEOs and Server Handles are Aerion, Kyojin, and Lejitt. Top Moderators include Sunny and Kyojin. Aerion is also the developer of Tessia."
  },
  {
    id: "server_leveling_perks",
    category: "leveling",
    keywords: ["level up", "levels", "perks", "how to level", "roles", "colors", "vc perks", "server updates"],
    content: "Users level up in AniPedia by chatting in text channels, being active in Voice Channels (VC), and sharing media. Higher levels unlock exclusive perks, colored name roles, and privileges. Details can be viewed in #server-updates."
  },
  {
    id: "bot_tessia_emillia_lore",
    category: "lore",
    keywords: ["tessia", "emillia", "sister", "who are you", "what do you do", "bot role", "purpose"],
    content: "Tessia Eralith (elven princess from TBATE) is the big sister and serves as AniPedia's chat companion, anime/manga expert, and future game host. Her sister Emillia handles moderation and administrative enforcement. Together they manage and protect AniPedia."
  },
  {
    id: "server_rules_core",
    category: "rules",
    keywords: ["rules", "server rules", "nsfw", "violence", "spoilers", "ban", "kick", "disrespect", "arguing with staff"],
    content: "AniPedia Core Rules: 1. Absolute zero tolerance for NSFW, 18+ content, gore, violence, and death topics. 2. No spoilers without ||spoiler|| tags. 3. Respect for staff is paramount; staff decisions are final, and disrespecting or arguing with Shogun or Royal Hands can result in an immediate kick or ban. 4. External invite links, advertising, and self-promotion are prohibited. 5. Usernames and profile pictures must be clean and non-violent."
  }
];

// Tokenize text into frequency map
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// Compute Cosine Similarity between two term frequency vectors
function computeCosineSimilarity(queryTokens, docTokens) {
  const queryMap = {};
  const docMap = {};

  for (const t of queryTokens) queryMap[t] = (queryMap[t] || 0) + 1;
  for (const t of docTokens) docMap[t] = (docMap[t] || 0) + 1;

  let dotProduct = 0;
  let queryMagnitude = 0;
  let docMagnitude = 0;

  for (const t in queryMap) {
    queryMagnitude += queryMap[t] * queryMap[t];
    if (docMap[t]) {
      dotProduct += queryMap[t] * docMap[t];
    }
  }

  for (const t in docMap) {
    docMagnitude += docMap[t] * docMap[t];
  }

  if (queryMagnitude === 0 || docMagnitude === 0) return 0;
  return dotProduct / (Math.sqrt(queryMagnitude) * Math.sqrt(docMagnitude));
}

// Search AniPedia knowledge base using cosine similarity
function searchAniPediaKnowledge(userQuery, threshold = 0.20) {
  const queryTokens = tokenize(userQuery);
  if (queryTokens.length === 0) return null;

  const scoredDocs = [];

  for (const doc of KNOWLEDGE_DOCS) {
    // Combine content + keywords for richer vector representation
    const fullDocText = doc.content + ' ' + doc.keywords.join(' ');
    const docTokens = tokenize(fullDocText);
    
    // Check for exact keyword hits to boost score
    let keywordBonus = 0;
    const lowerQuery = userQuery.toLowerCase();
    for (const kw of doc.keywords) {
      if (lowerQuery.includes(kw.toLowerCase())) {
        keywordBonus += 0.25;
      }
    }

    const similarity = computeCosineSimilarity(queryTokens, docTokens) + keywordBonus;
    if (similarity >= threshold) {
      scoredDocs.push({ doc, score: similarity });
    }
  }

  if (scoredDocs.length === 0) return null;

  // Sort descending by similarity score
  scoredDocs.sort((a, b) => b.score - a.score);
  
  // Return top 2 matching contexts
  const topMatches = scoredDocs.slice(0, 2);
  const contextStrings = topMatches.map(m => `[ANIPEDIA VERIFIED KNOWLEDGE (${m.doc.category.toUpperCase()})]: ${m.doc.content}`);
  return contextStrings.join('\n\n');
}

module.exports = {
  searchAniPediaKnowledge,
  KNOWLEDGE_DOCS
};