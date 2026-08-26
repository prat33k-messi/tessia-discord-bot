// AniList Vector Recommendation Engine with Cosine Similarity
// Provides strictly separated Anime vs. Manga recommendations matching user constraints.

const ANILIST_RECS_QUERY = `
query ($type: MediaType, $genre: String, $tag: String, $sort: [MediaSort], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(type: $type, genre: $genre, tag: $tag, sort: $sort, isAdult: false) {
      id
      title {
        romaji
        english
      }
      format
      description(asHtml: false)
      episodes
      chapters
      volumes
      averageScore
      meanScore
      genres
      tags {
        name
        rank
      }
      studios(isMain: true) {
        nodes {
          name
        }
      }
      siteUrl
      coverImage {
        large
      }
    }
  }
}
`;

// Common genres on AniList
const ANILIST_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror",
  "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

// Common anime/manga tags
const POPULAR_TAGS = [
  "Isekai", "Time Travel", "Mind Games", "Reincarnation", "Dark Fantasy",
  "School", "Shounen", "Seinen", "Shoujo", "Josei", "Magic", "Super Power",
  "Cyberpunk", "Post-Apocalyptic", "Military", "Space", "Vampire", "Monsters",
  "Anti-Hero", "Female Protagonist", "Male Protagonist", "Martial Arts",
  "Historical", "Demons", "Gore", "Survival", "Revenge"
];

// Tokenize text into frequency map
function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Compute Cosine Similarity between query tokens and media tokens
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

// Detect whether user is strictly asking for Manga/Manhwa vs Anime
function detectRequestedMediaType(query) {
  const lower = query.toLowerCase();
  const mangaKeywords = ['manga', 'manhwa', 'manhua', 'light novel', 'webtoon', 'read', 'chapter', 'chapters', 'volume', 'volumes'];
  const hasMangaKeyword = mangaKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower));
  return hasMangaKeyword ? 'MANGA' : 'ANIME';
}

// Extract matching genre and tag constraints from user query
function extractConstraints(query) {
  const lower = query.toLowerCase();
  let matchedGenre = null;
  let matchedTag = null;

  for (const g of ANILIST_GENRES) {
    if (lower.includes(g.toLowerCase())) {
      matchedGenre = g;
      break;
    }
  }

  for (const t of POPULAR_TAGS) {
    if (lower.includes(t.toLowerCase())) {
      matchedTag = t;
      break;
    }
  }

  // Common synonyms mapping
  if (!matchedGenre) {
    if (lower.includes('scifi') || lower.includes('sci fi') || lower.includes('space') || lower.includes('mecha')) matchedGenre = 'Sci-Fi';
    else if (lower.includes('love') || lower.includes('shoujo') || lower.includes('dating')) matchedGenre = 'Romance';
    else if (lower.includes('funny') || lower.includes('laugh') || lower.includes('humor')) matchedGenre = 'Comedy';
    else if (lower.includes('dark') || lower.includes('scary') || lower.includes('creepy')) matchedGenre = 'Horror';
    else if (lower.includes('fight') || lower.includes('shonen') || lower.includes('battle')) matchedGenre = 'Action';
    else if (lower.includes('detective') || lower.includes('crime') || lower.includes('investigation')) matchedGenre = 'Mystery';
    else if (lower.includes('mind game') || lower.includes('psychological') || lower.includes('smart mc') || lower.includes('genius')) matchedGenre = 'Psychological';
  }

  return { matchedGenre, matchedTag };
}

// Main Recommendation Function: Fetches from AniList GraphQL & Ranks by Cosine Similarity
async function getVectorRecommendations(userQuery, forceMediaType = null) {
  try {
    const mediaType = forceMediaType || detectRequestedMediaType(userQuery);
    const { matchedGenre, matchedTag } = extractConstraints(userQuery);
    const queryTokens = tokenize(userQuery);

    console.log(`[Recommendation Engine] Searching for ${mediaType} with constraints: Genre="${matchedGenre || 'None'}", Tag="${matchedTag || 'None'}"`);

    const variables = {
      type: mediaType,
      genre: matchedGenre,
      tag: matchedTag,
      sort: ["SCORE_DESC", "POPULARITY_DESC"],
      perPage: 25
    };

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: ANILIST_RECS_QUERY, variables })
    });

    if (!response.ok) {
      console.warn(`[Recommendation Engine] AniList returned HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const candidates = data?.data?.Page?.media || [];

    if (candidates.length === 0) {
      return null;
    }

    // Rank candidates using Cosine Similarity against the user's full query
    const scoredCandidates = [];

    for (const media of candidates) {
      const title = media.title.english || media.title.romaji;
      const cleanDesc = (media.description || '').replace(/<[^>]*>/g, ' ');
      const genresStr = (media.genres || []).join(' ');
      const tagsStr = (media.tags || []).map(t => t.name).join(' ');
      
      const fullDoc = `${title} ${genresStr} ${tagsStr} ${cleanDesc}`;
      const docTokens = tokenize(fullDoc);

      let similarity = computeCosineSimilarity(queryTokens, docTokens);

      // Add small bonus for score and popularity
      const scoreBonus = (media.averageScore || 70) / 500; // max +0.20
      similarity += scoreBonus;

      // Genre match boost
      if (matchedGenre && media.genres.includes(matchedGenre)) {
        similarity += 0.3;
      }

      scoredCandidates.push({
        media,
        title,
        cleanDesc,
        similarity
      });
    }

    // Sort descending by similarity
    scoredCandidates.sort((a, b) => b.similarity - a.similarity);

    const topMatches = scoredCandidates.slice(0, 2);
    const mediaLabel = mediaType === 'MANGA' ? 'Manga/Manhwa' : 'Anime';

    let contextText = `[VERIFIED ${mediaLabel.toUpperCase()} RECOMMENDATION DATA (From AniList Database - Strictly ${mediaLabel})]:\n`;
    
    topMatches.forEach((item, idx) => {
      const m = item.media;
      const format = m.format || mediaLabel;
      const count = mediaType === 'MANGA' ? `${m.chapters || 'Ongoing'} chapters` : `${m.episodes || '12+'} episodes`;
      const score = m.averageScore ? `${m.averageScore}%` : '85%';
      const studio = m.studios?.nodes?.[0]?.name ? `Studio: ${m.studios.nodes[0].name}` : '';
      const shortDesc = item.cleanDesc.length > 200 ? item.cleanDesc.substring(0, 200) + '...' : item.cleanDesc;

      contextText += `${idx + 1}. **${item.title}** (${format}, ${count}, Score: ${score}${studio ? `, ${studio}` : ''})\n`;
      contextText += `   Genres: ${(m.genres || []).join(', ')}\n`;
      contextText += `   Synopsis: ${shortDesc}\n`;
    });

    contextText += `\n[INSTRUCTION: Recommend the above ${mediaLabel} naturally and enthusiastically in your Tessia voice. State why it matches the user's taste in 2-3 lines. Never recommend manga when user asked for anime, or anime when user asked for manga.]`;

    return {
      mediaType,
      topMatches,
      contextText
    };

  } catch (err) {
    console.error("[Recommendation Engine] Error fetching recommendations:", err);
    return null;
  }
}

module.exports = {
  getVectorRecommendations,
  detectRequestedMediaType
};
