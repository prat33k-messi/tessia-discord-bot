const { EmbedBuilder } = require('discord.js');
const { db } = require('../config');
const { parseRSSItems, cleanAnimeTerm } = require('../utils/helpers');

async function scrapeOpenGraphImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    const match1 = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (match1 && match1[1]) return match1[1];

    const match2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (match2 && match2[1]) return match2[1];

    return null;
  } catch (err) {
    console.warn('OG image scrape failed for:', url, err.message);
    return null;
  }
}

async function fetchAnimeNews() {
  try {
    const rssUrl = encodeURIComponent('https://www.animenewsnetwork.com/news/rss.xml');
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`;
    
    const response = await fetch(proxyUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        console.log(`[News] Fetched ${data.items.length} articles via rss2json proxy`);
        return data.items.slice(0, 5).map(item => ({
          title: item.title || '',
          link: item.link || '',
          description: (item.description || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').substring(0, 300),
          pubDate: item.pubDate || '',
          category: (item.categories && item.categories.length > 0) ? item.categories[0] : '',
          imageUrl: item.thumbnail || item.enclosure?.link || null
        }));
      }
    }
    console.warn('[News] rss2json proxy returned non-ok, trying direct fetch...');
  } catch (proxyErr) {
    console.warn('[News] rss2json proxy failed:', proxyErr.message, '— trying direct fetch...');
  }

  try {
    const response = await fetch('https://www.animenewsnetwork.com/news/rss.xml', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/xml, text/xml, application/rss+xml'
      }
    });

    if (!response.ok) {
      console.error('[News] Direct ANN RSS fetch failed:', response.status, response.statusText);
      return null;
    }

    const xmlText = await response.text();
    const items = parseRSSItems(xmlText);
    console.log(`[News] Fetched ${items.length} articles via direct RSS`);
    return items.slice(0, 5);
  } catch (err) {
    console.error('[News] All fetch methods failed:', err.message);
    return null;
  }
}

async function getAnimeNews(animeName) {
  try {
    const cleanedAnimeName = cleanAnimeTerm(animeName);
    console.log(`[DEBUG] getAnimeNews called: animeName="${animeName}", cleaned="${cleanedAnimeName}"`);

    try {
      const rssArticles = await fetchAnimeNews();
      if (rssArticles && rssArticles.length > 0) {
        console.log(`[News] Got ${rssArticles.length} RSS articles, filtering for "${cleanedAnimeName}"...`);
        
        let matchedArticles = rssArticles;
        const searchTerms = cleanedAnimeName.toLowerCase().split(/\s+/);
        
        if (cleanedAnimeName && cleanedAnimeName.toLowerCase() !== 'anime' && cleanedAnimeName.toLowerCase() !== 'anime news') {
          matchedArticles = rssArticles.filter(a => {
            const titleLower = (a.title || '').toLowerCase();
            const descLower = (a.description || '').toLowerCase();
            return searchTerms.some(term => term.length > 2 && (titleLower.includes(term) || descLower.includes(term)));
          });
        }

        const articlesToReturn = matchedArticles.length > 0 ? matchedArticles : rssArticles;
        const isFiltered = matchedArticles.length > 0 && cleanedAnimeName.toLowerCase() !== 'anime';

        const topArticles = articlesToReturn.slice(0, 5).map(a => {
          const dateStr = a.pubDate ? new Date(a.pubDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent';
          return {
            title: a.title || 'Untitled',
            url: a.link || '',
            date: dateStr,
            excerpt: (a.description || '').substring(0, 150),
            authorUsername: 'Anime News Network',
            forumUrl: ''
          };
        });

        console.log(`[News] Returning ${topArticles.length} articles (filtered=${isFiltered}, query="${cleanedAnimeName}")`);
        return {
          animeName: isFiltered ? cleanedAnimeName : 'Anime',
          malId: null,
          articles: topArticles,
          coverImage: null
        };
      }
    } catch (rssErr) {
      console.warn('[News] RSS fetch failed, trying Jikan fallback:', rssErr.message);
    }

    // Jikan fallback
    const searchUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanedAnimeName)}&limit=1&sfw=true`;
    const searchResponse = await fetch(searchUrl, { headers: { 'Accept': 'application/json' } });
    if (searchResponse.status === 429) return { rateLimited: true };
    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const anime = searchData?.data?.[0];
    if (!anime) return null;

    const malId = anime.mal_id;
    const resolvedName = anime.title_english || anime.title || animeName;
    const coverImage = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || null;

    await new Promise(resolve => setTimeout(resolve, 1000));

    const newsUrl = `https://api.jikan.moe/v4/anime/${malId}/news`;
    const newsResponse = await fetch(newsUrl, { headers: { 'Accept': 'application/json' } });
    if (newsResponse.status === 429) return { rateLimited: true };
    if (!newsResponse.ok) return null;

    const newsData = await newsResponse.json();
    const articles = newsData?.data || [];
    if (articles.length === 0) return { animeName: resolvedName, articles: [], coverImage };

    const topArticles = articles.slice(0, 5).map(article => {
      const dateStr = article.date ? new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
      let excerpt = article.excerpt || '';
      excerpt = excerpt.replace(/<[^>]*>/g, '').substring(0, 150);

      return {
        title: article.title || 'Untitled',
        url: article.url || '',
        date: dateStr,
        excerpt: excerpt,
        authorUsername: article.author_username || 'MyAnimeList',
        forumUrl: article.forum_url || ''
      };
    });

    return {
      animeName: resolvedName,
      malId,
      articles: topArticles,
      coverImage
    };
  } catch (err) {
    console.error('Anime news fetch error:', err.message);
    return null;
  }
}

function buildAnimeNewsEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor(0x2E51A2)
    .setTitle(`📰 Latest News: ${data.animeName}`);

  if (data.malId) embed.setURL(`https://myanimelist.net/anime/${data.malId}`);
  if (data.coverImage) embed.setThumbnail(data.coverImage);

  const fields = [];
  data.articles.forEach((article, i) => {
    const value = article.url
      ? `[Read more](${article.url}) • ${article.date}${article.excerpt ? `\n> ${article.excerpt}` : ''}`
      : `${article.date}${article.excerpt ? `\n> ${article.excerpt}` : ''}`;
    fields.push({
      name: `${i + 1}. ${article.title.substring(0, 100)}`,
      value: value.substring(0, 1024),
      inline: false
    });
  });

  embed.addFields(fields);
  return embed;
}

async function buildAutoNewsEmbed(article) {
  try {
    let imageUrl = article.imageUrl || null;
    if (!imageUrl && article.link) {
      imageUrl = await scrapeOpenGraphImage(article.link);
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle(`📰 ${article.title}`)
      .setURL(article.link);

    if (article.description) {
      embed.setDescription(`> ${article.description}${article.description.length >= 297 ? '...' : ''}`);
    }
    if (imageUrl) embed.setImage(imageUrl);
    if (article.category) embed.addFields({ name: '📁 Category', value: article.category, inline: true });
    
    if (article.pubDate) {
      const date = new Date(article.pubDate);
      if (!isNaN(date.getTime())) {
        embed.addFields({ name: '📅 Published', value: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), inline: true });
      }
    }

    embed.addFields({ name: '🔗 Read Full Article', value: `[Click here to read on ANN](${article.link})`, inline: false });
    embed.setFooter({ text: 'Anime News Network • Anipedia News Feed 🌸' });
    embed.setTimestamp();

    return embed;
  } catch (err) {
    console.error('Error building news embed:', err.message);
    return null;
  }
}

async function checkAndPostNews(client) {
  if (!db) return;

  try {
    const configSnapshot = await db.collection('server_configs').get();
    if (configSnapshot.empty) return;

    const articles = await fetchAnimeNews();
    if (!articles || articles.length === 0) return;

    for (const configDoc of configSnapshot.docs) {
      const config = configDoc.data();
      const guildId = configDoc.id;
      const newsChannelId = config.newsChannelId;

      if (!newsChannelId) continue;

      try {
        const channel = client.channels.cache.get(newsChannelId);
        if (!channel) continue;

        const postedDoc = await db.collection('posted_news').doc(guildId).get();
        const postedUrls = postedDoc.exists ? (postedDoc.data().urls || []) : [];

        const newArticles = articles.filter(a => !postedUrls.includes(a.link));
        if (newArticles.length === 0) continue;

        const articlesToPost = newArticles.reverse().slice(0, 3);
        const newPostedUrls = [];

        for (const article of articlesToPost) {
          try {
            const embed = await buildAutoNewsEmbed(article);
            if (embed) {
              await channel.send({ embeds: [embed] });
              newPostedUrls.push(article.link);
              await new Promise(r => setTimeout(r, 2000));
            }
          } catch (postErr) {
            console.error(`[News Cron] Failed to post article: ${article.title}`, postErr.message);
          }
        }

        if (newPostedUrls.length > 0) {
          const allUrls = [...postedUrls, ...newPostedUrls].slice(-100);
          await db.collection('posted_news').doc(guildId).set({ urls: allUrls, lastUpdated: new Date().toISOString() });
        }
      } catch (guildErr) {
        console.error(`[News Cron] Error processing guild ${guildId}:`, guildErr.message);
      }
    }
  } catch (err) {
    console.error('[News Cron] Fatal error:', err.message);
  }
}

module.exports = {
  fetchAnimeNews,
  getAnimeNews,
  buildAnimeNewsEmbed,
  buildAutoNewsEmbed,
  checkAndPostNews
};
