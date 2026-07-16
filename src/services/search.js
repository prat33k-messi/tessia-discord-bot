// Web Search Service (Wikipedia + Brave fallbacks)
require('dotenv').config();

async function searchWeb(query) {
  // Method 1: Wikipedia API (always free, no API key, reliable)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
    const wikiResp = await fetch(wikiUrl);
    if (wikiResp.ok) {
      const wikiData = await wikiResp.json();
      const wikiResults = wikiData.query?.search || [];
      if (wikiResults.length > 0) {
        const context = wikiResults.map(r => {
          const snippet = r.snippet.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'");
          return `• ${r.title}: ${snippet}`;
        }).join('\n');
        console.log(`[WebSearch] Wikipedia returned ${wikiResults.length} results for: ${query}`);
        return context;
      }
    }
  } catch (err) {
    console.warn('[WebSearch] Wikipedia API failed:', err.message);
  }

  // Method 2: Brave Search (if API key is configured)
  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    try {
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&safesearch=strict`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': braveKey
        }
      });
      if (response.ok) {
        const data = await response.json();
        const results = data.web?.results?.slice(0, 5) || [];
        if (results.length > 0) {
          console.log(`[WebSearch] Brave returned ${results.length} results for: ${query}`);
          return results.map(r => `• ${r.title}: ${r.description || ''}`).join('\n');
        }
      }
    } catch (err) {
      console.warn('[WebSearch] Brave search failed:', err.message);
    }
  }

  console.log(`[WebSearch] No results found for: ${query}`);
  return null;
}

module.exports = {
  searchWeb
};
