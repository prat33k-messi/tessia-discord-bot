// AniPedia Vector Knowledge Base with Cosine Similarity Search
// Stores structured verified knowledge chunks about AniPedia server, channels, staff, and rules.

const KNOWLEDGE_DOCS = [
  {
    id: "server_channels_general",
    category: "channels",
    keywords: ["general", "general chat", "where to chat", "rules in general", "chatting channel", "main chat", "channels", "server guide"],
    content: "AniPedia Key Channels:\n🗨️ `#・general-chat` — Anime, manga & friendly general discussions\n📸 `#・media-share` — Daily life photos, anime art & wholesome clips\n📖 `#・manga-pannels` — Favorite manga panels, theories & chapter moments\n🎮 `#・bot-games` & `#・owo` — Play OwO, Pokémon & interactive bot games!"
  },
  {
    id: "server_roles_hierarchy",
    category: "roles",
    keywords: ["roles", "role hierarchy", "shogun", "royal hand", "ceo", "ranks", "highest role", "staff roles"],
    content: "AniPedia Role Hierarchy:\n👑 **Shogun** — Server Owner & Supreme Leader\n💼 **Royal Hands** — CEOs & Executives managing the community\n⚔️ **Moderators** — Enforce rules & keep peace (Sunny, Kyojin)\n🛡️ **Junior Moderators** — Assist staff & oversee chats\n🌟 **Level Roles** — Earned by active chatting, VC & media sharing (check `#server-updates`)!"
  },
  {
    id: "server_staff_members",
    category: "staff",
    keywords: ["creator", "who made server", "owner", "roan", "aerion", "kyojin", "lejitt", "sunny", "staff", "who runs server", "founders"],
    content: "AniPedia Leaders & Founders:\n✨ **Roan** — Server Creator (we are all building this together!)\n💼 **Aerion, Kyojin & Lejitt** — Server CEOs & Handles\n⚔️ **Sunny & Kyojin** — Top Moderators\n🌸 **Aerion-sama** is also the developer of Tessia!"
  },
  {
    id: "server_leveling_perks",
    category: "leveling",
    keywords: ["level up", "levels", "perks", "how to level", "roles", "colors", "vc perks", "server updates"],
    content: "AniPedia Leveling Perks:\n🌟 Level up by chatting in text channels, hanging out in Voice Channels (VC), and sharing media!\n🎨 Unlocks exclusive perks, colored name roles, and special channel privileges.\n📜 View all tier perks in `#server-updates`!"
  },
  {
    id: "bot_tessia_emillia_lore",
    category: "lore",
    keywords: ["tessia", "emillia", "sister", "who are you", "what do you do", "bot role", "purpose"],
    content: "The Sister Duo of AniPedia:\n🌸 **Tessia Eralith** (Big Sister) — Chat companion, anime/manga expert & future game host (developed by Aerion-sama)\n🛡️ **Emillia** (Younger Sister) — Moderation & administrative enforcement\nTogether they protect and guide AniPedia!"
  },
  {
    id: "server_rules_core",
    category: "rules",
    keywords: ["rules", "server rules", "nsfw", "violence", "spoilers", "ban", "kick", "disrespect", "arguing with staff"],
    content: "AniPedia Core Guidelines:\n🛡️ **Clean Community:** Absolute zero tolerance for NSFW, 18+, gore & violence (safe for minors!)\n👑 **Staff Respect:** Shogun & Royal Hands decisions are final (disrespecting leads to kick/ban)\n🤐 **No Spoilers:** Always wrap plot twists in `||spoiler||` tags\n🚫 **No Promo:** External invite links & bio ads are forbidden\n✨ **Decency:** Clean usernames and profile pictures required."
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