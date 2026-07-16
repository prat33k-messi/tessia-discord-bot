const { EmbedBuilder } = require('discord.js');
const { cleanAnimeTerm, cleanCharacterTerm } = require('../utils/helpers');

// Common abbreviations and aliases that AniList might not recognize directly
const ANIME_ALIASES = require('../utils/helpers').ANIME_ALIASES;

// AniList GraphQL query
const ANILIST_QUERY = `
query ($search: String, $type: MediaType) {
  Media(search: $search, type: $type) {
    id
    title {
      romaji
      english
      native
    }
    format
    status
    description(asHtml: false)
    episodes
    chapters
    volumes
    meanScore
    averageScore
    popularity
    genres
    season
    seasonYear
    startDate { year month day }
    endDate { year month day }
    studios(isMain: true) { nodes { name } }
    source
    countryOfOrigin
    isAdult
    siteUrl
    coverImage { large medium }
    bannerImage
    recommendations(sort: RATING_DESC, perPage: 3) {
      nodes {
        mediaRecommendation {
          title { romaji english }
          meanScore
          genres
          format
          siteUrl
        }
      }
    }
  }
}
`;

async function searchAniList(searchTerm, mediaType = null) {
  try {
    const cleanedSearchTerm = cleanAnimeTerm(searchTerm);
    const resolvedTerm = ANIME_ALIASES[cleanedSearchTerm.toLowerCase()] || cleanedSearchTerm;
    console.log(`[DEBUG] searchAniList called: searchTerm="${searchTerm}", cleaned="${cleanedSearchTerm}", resolved="${resolvedTerm}"`);
    
    const typesToTry = mediaType ? [mediaType] : ['MANGA', 'ANIME'];
    
    for (const type of typesToTry) {
      try {
        console.log(`[DEBUG] AniList API request: type=${type}, search="${resolvedTerm}"`);
        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: resolvedTerm, type } })
        });
        
        console.log(`[DEBUG] AniList API response status: ${response.status} ${response.statusText}`);
        if (!response.ok) continue;
        
        const data = await response.json();
        const media = data?.data?.Media;
        console.log(`[DEBUG] AniList media found: ${media ? media.title?.english || media.title?.romaji : 'null'}`);
        
        if (!media || media.isAdult) continue;
        
        const title = media.title.english || media.title.romaji || media.title.native;
        const country = media.countryOfOrigin;
        const mediaFormat = country === 'KR' ? 'Manhwa' : country === 'CN' ? 'Manhua' : (type === 'ANIME' ? 'Anime' : 'Manga');
        
        let cleanDesc = media.description || 'No description available.';
        cleanDesc = cleanDesc.replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').substring(0, 500);
        
        let contextText = `Data for "${title}" (${mediaFormat}):\n`;
        if (media.title.romaji && media.title.romaji !== title) contextText += `• Japanese Title: ${media.title.romaji}\n`;
        if (media.title.native) contextText += `• Native Title: ${media.title.native}\n`;
        contextText += `• Format: ${media.format || 'Unknown'} | Status: ${media.status || 'Unknown'}\n`;
        contextText += `• Country: ${country === 'KR' ? 'South Korea (Manhwa)' : country === 'CN' ? 'China (Manhua)' : country === 'JP' ? 'Japan' : country || 'Unknown'}\n`;
        if (media.episodes) contextText += `• Episodes: ${media.episodes}\n`;
        if (media.chapters) contextText += `• Chapters: ${media.chapters}\n`;
        if (media.volumes) contextText += `• Volumes: ${media.volumes}\n`;
        if (media.meanScore) contextText += `• Score: ${media.meanScore}/100 (${(media.meanScore / 10).toFixed(1)}/10)\n`;
        if (media.popularity) contextText += `• Popularity: ${media.popularity.toLocaleString()} users\n`;
        if (media.genres && media.genres.length > 0) contextText += `• Genres: ${media.genres.join(', ')}\n`;
        if (media.season && media.seasonYear) contextText += `• Season: ${media.season} ${media.seasonYear}\n`;
        if (media.studios?.nodes?.length > 0) contextText += `• Studio: ${media.studios.nodes.map(s => s.name).join(', ')}\n`;
        if (media.source) contextText += `• Source Material: ${media.source}\n`;
        contextText += `• Synopsis: ${cleanDesc}\n`;
        
        const recs = media.recommendations?.nodes?.filter(n => n.mediaRecommendation) || [];
        if (recs.length > 0) {
          contextText += `• Similar titles: ${recs.map(r => r.mediaRecommendation.title.english || r.mediaRecommendation.title.romaji).join(', ')}\n`;
        }
        
        const embedData = {
          title,
          romajiTitle: media.title.romaji,
          description: cleanDesc.substring(0, 256),
          score: media.meanScore,
          popularity: media.popularity,
          episodes: media.episodes,
          chapters: media.chapters,
          volumes: media.volumes,
          genres: media.genres || [],
          status: media.status,
          format: media.format,
          mediaFormat,
          country,
          season: media.season,
          seasonYear: media.seasonYear,
          studios: media.studios?.nodes?.map(s => s.name) || [],
          source: media.source,
          coverImage: media.coverImage?.large || media.coverImage?.medium,
          bannerImage: media.bannerImage,
          url: media.siteUrl,
          recommendations: recs.map(r => ({
            title: r.mediaRecommendation.title.english || r.mediaRecommendation.title.romaji,
            score: r.mediaRecommendation.meanScore,
            url: r.mediaRecommendation.siteUrl
          }))
        };
        
        return { contextText, embedData };
      } catch (innerErr) {
        continue;
      }
    }
    return null;
  } catch (err) {
    console.error('AniList search error:', err.message);
    return null;
  }
}

function buildAniListEmbed(data) {
  const colorMap = { 'KR': 0x9B59B6, 'CN': 0xE74C3C, 'JP': 0x3498DB };
  const color = data.country === 'KR' ? colorMap.KR : (data.format === 'TV' || data.format === 'MOVIE' || data.format === 'ONA' || data.format === 'OVA' || data.format === 'SPECIAL') ? colorMap.JP : 0x2ECC71;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${data.title}`)
    .setURL(data.url || 'https://anilist.co')
    .setDescription(data.description || 'No description available.');

  if (data.coverImage) embed.setThumbnail(data.coverImage);

  const fields = [];
  if (data.score) fields.push({ name: '⭐ Score', value: `${(data.score / 10).toFixed(1)}/10`, inline: true });
  if (data.status) fields.push({ name: '📊 Status', value: data.status.replace(/_/g, ' '), inline: true });
  fields.push({ name: '📁 Type', value: data.mediaFormat || data.format || 'Unknown', inline: true });
  
  if (data.episodes) fields.push({ name: '🎬 Episodes', value: `${data.episodes}`, inline: true });
  if (data.chapters) fields.push({ name: '📖 Chapters', value: `${data.chapters}`, inline: true });
  if (data.volumes) fields.push({ name: '📚 Volumes', value: `${data.volumes}`, inline: true });
  
  if (data.genres.length > 0) fields.push({ name: '🏷️ Genres', value: data.genres.slice(0, 5).join(', '), inline: false });
  if (data.studios.length > 0) fields.push({ name: '🎬 Studio', value: data.studios.join(', '), inline: true });
  if (data.source) fields.push({ name: '📝 Source', value: data.source.replace(/_/g, ' '), inline: true });
  
  if (data.recommendations && data.recommendations.length > 0) {
    const recText = data.recommendations.map(r => `• ${r.title}${r.score ? ` (${(r.score/10).toFixed(1)}/10)` : ''}`).join('\n');
    fields.push({ name: '💡 You Might Also Like', value: recText, inline: false });
  }

  embed.addFields(fields);
  if (data.popularity) embed.setFooter({ text: `${data.popularity.toLocaleString()} users on AniList` });

  return embed;
}

async function getSmartRecommendations(userMemories) {
  const prefKeywords = ['favorite anime', 'favorite manga', 'favorite manhwa', 'likes', 'loves', 'enjoys', 'watched', 'reading'];
  const relevantFacts = userMemories.filter(f => prefKeywords.some(k => f.toLowerCase().includes(k)));
  if (relevantFacts.length === 0) return null;

  const titles = [];
  for (const fact of relevantFacts) {
    const isMatch = fact.match(/(?:is|are)\s+(.+)$/i);
    if (isMatch) titles.push(isMatch[1].trim());
    else titles.push(fact);
  }

  if (titles.length === 0) return null;
  const randomTitle = titles[Math.floor(Math.random() * titles.length)];
  const result = await searchAniList(randomTitle);

  if (result && result.embedData.recommendations && result.embedData.recommendations.length > 0) {
    return result.embedData.recommendations;
  }
  return null;
}

async function getAiringSchedule() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const endOfDay = now + 86400;

    const query = `
    query ($airingAt_greater: Int, $airingAt_lesser: Int) {
      Page(perPage: 25) {
        airingSchedules(airingAt_greater: $airingAt_greater, airingAt_lesser: $airingAt_lesser, sort: TIME) {
          airingAt
          episode
          media {
            title { romaji english }
            format
            isAdult
            siteUrl
            coverImage { medium }
          }
        }
      }
    }`;

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { airingAt_greater: now, airingAt_lesser: endOfDay }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const schedules = data?.data?.Page?.airingSchedules || [];

    return schedules
      .filter(s => s.media && !s.media.isAdult)
      .map(s => ({
        title: s.media.title.english || s.media.title.romaji,
        episode: s.episode,
        airingTime: new Date(s.airingAt * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
        format: s.media.format,
        url: s.media.siteUrl,
        coverImage: s.media.coverImage?.medium
      }));
  } catch (err) {
    console.error('Airing schedule error:', err.message);
    return null;
  }
}

async function searchAniListCharacter(name) {
  try {
    const cleanedName = cleanCharacterTerm(name);
    console.log(`[DEBUG] searchAniListCharacter called: name="${name}", cleaned="${cleanedName}"`);
    const query = `
    query ($search: String) {
      Character(search: $search) {
        id
        name { full native alternative }
        image { large medium }
        description(asHtml: false)
        siteUrl
        media(perPage: 3, sort: POPULARITY_DESC) {
          nodes {
            title { romaji english }
            format
            siteUrl
          }
        }
      }
    }`;

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { search: cleanedName } })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const char = data?.data?.Character;
    if (!char) return null;

    let cleanDesc = char.description || 'No description available.';
    cleanDesc = cleanDesc.replace(/~!.*?!~/gs, '[spoiler hidden]').replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').substring(0, 400);

    const mediaList = char.media?.nodes || [];
    const mediaTitle = mediaList.length > 0 ? (mediaList[0].title.english || mediaList[0].title.romaji) : 'Unknown';

    return {
      name: char.name.full,
      nativeName: char.name.native,
      altNames: char.name.alternative || [],
      description: cleanDesc,
      imageUrl: char.image?.large || char.image?.medium,
      url: char.siteUrl,
      mediaTitle,
      mediaList: mediaList.map(m => ({
        title: m.title.english || m.title.romaji,
        format: m.format,
        url: m.siteUrl
      }))
    };
  } catch (err) {
    console.error('Character search error:', err.message);
    return null;
  }
}

function buildCharacterEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor(0xE91E63)
    .setTitle(data.name)
    .setURL(data.url)
    .setDescription(data.description.substring(0, 256));

  if (data.imageUrl) embed.setImage(data.imageUrl);
  if (data.nativeName) embed.addFields({ name: 'Native Name', value: data.nativeName, inline: true });
  embed.addFields({ name: 'Appears In', value: data.mediaTitle, inline: true });

  if (data.mediaList.length > 1) {
    const otherMedia = data.mediaList.slice(1).map(m => `[${m.title}](${m.url})`).join(', ');
    embed.addFields({ name: 'Also In', value: otherMedia, inline: false });
  }

  embed.setFooter({ text: 'Character data from AniList' });
  return embed;
}

async function getAnimeQuote() {
  try {
    const response = await fetch('https://animechan.io/api/v1/quotes/random', {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const q = data?.data;
    if (!q) return null;
    return {
      quote: q.content || q.quote || '',
      character: q.character?.name || q.character || 'Unknown',
      anime: q.anime?.name || q.anime || 'Unknown'
    };
  } catch (err) {
    console.error('Anime quote error:', err.message);
    return null;
  }
}

function buildQuoteEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('✨ Anime Quote')
    .setDescription(`> *"${data.quote}"*`)
    .addFields(
      { name: 'Character', value: data.character, inline: true },
      { name: 'Anime', value: data.anime, inline: true }
    )
    .setFooter({ text: 'Powered by AnimeChan' });
  return embed;
}

module.exports = {
  searchAniList,
  buildAniListEmbed,
  getSmartRecommendations,
  getAiringSchedule,
  searchAniListCharacter,
  buildCharacterEmbed,
  getAnimeQuote,
  buildQuoteEmbed
};
