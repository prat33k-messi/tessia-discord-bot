const { EmbedBuilder } = require('discord.js');
const { isStaffOrDev } = require('./pokemonGame');

const activeAnimeGames = new Map();

// Fetch random popular anime character from AniList
async function fetchRandomAnimeCharacter() {
  try {
    const randomPage = Math.floor(Math.random() * 25) + 1;
    const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 12) {
        characters(sort: FAVOURITES_DESC) {
          id
          name { full native alternative }
          description(asHtml: false)
          gender
          image { large }
          media(perPage: 1, sort: POPULARITY_DESC) {
            nodes {
              title { romaji english }
              genres
              format
              seasonYear
            }
          }
        }
      }
    }`;

    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { page: randomPage } })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const characters = data?.data?.Page?.characters || [];
    if (characters.length === 0) return null;

    const char = characters[Math.floor(Math.random() * characters.length)];
    const media = char.media?.nodes?.[0];
    if (!media) return null;

    const mediaTitle = media.title.english || media.title.romaji;
    const fullName = char.name.full;
    const genres = (media.genres || []).slice(0, 3).join(', ');

    let shortBio = (char.description || '').replace(/~!.*?!~/gs, '').replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim();
    if (shortBio.length > 120) shortBio = shortBio.substring(0, 120) + '...';

    // Clues
    const clue1 = `Appears in **"${mediaTitle}"** (${media.format || 'Anime'}, Genres: \`${genres || 'Action'}\`).`;
    const clue2 = `Gender: **${char.gender || 'Unknown'}** • ${shortBio ? `About them: *"${shortBio}"*` : `Name starts with letter **"${fullName.charAt(0)}"**`}`;

    return {
      id: char.id,
      fullName,
      aliases: [
        fullName.toLowerCase(),
        ...(char.name.alternative || []).map(a => a.toLowerCase()),
        fullName.split(/\s+/)[0].toLowerCase(), // first name
        fullName.split(/\s+/).slice(-1)[0].toLowerCase() // last name
      ].filter(a => a.length >= 3),
      mediaTitle,
      imageUrl: char.image?.large,
      clue1,
      clue2
    };
  } catch (err) {
    console.error('[Anime Quiz] Error fetching character:', err.message);
    return null;
  }
}

// Start Anime Quiz match
async function startAnimeQuizMatch(channel, totalRounds, starterUser) {
  if (activeAnimeGames.has(channel.id)) {
    return { success: false, message: 'An Anime Quiz game is already active in this channel! Finish it first.' };
  }

  const match = {
    gameType: 'animequiz',
    channel,
    rounds: Math.min(Math.max(parseInt(totalRounds, 10) || 5, 1), 20),
    currentRound: 0,
    scores: new Map(),
    currentChar: null,
    timer: null,
    roundStartTime: 0,
    roundActive: false
  };

  activeAnimeGames.set(channel.id, match);

  const startEmbed = new EmbedBuilder()
    .setColor(0x9B59B6) // Royal Purple
    .setTitle('👤 Guess the Anime Character — Match Started!')
    .setDescription(
      `### 🎮 **Game Initiated by ${starterUser.username}!**\n\n` +
      `🎯 **Total Rounds:** \`${match.rounds}\`\n` +
      `⏱️ **Time Per Round:** \`25 seconds\`\n` +
      `💡 **How to Play:** Just type the character's name directly in chat — **no tagging or replies needed!**\n\n` +
      `*Round 1 begins in 3 seconds...* 🌸`
    )
    .setFooter({ text: 'AniPedia Anime Quiz • AniList Verified Database' })
    .setTimestamp();

  await channel.send({ embeds: [startEmbed] });

  setTimeout(() => {
    runNextAnimeRound(channel.id);
  }, 3000);

  return { success: true };
}

// Run next round
async function runNextAnimeRound(channelId) {
  const match = activeAnimeGames.get(channelId);
  if (!match) return;

  match.currentRound++;
  if (match.currentRound > match.rounds) {
    return endAnimeMatchAndShowPodium(channelId);
  }

  const char = await fetchRandomAnimeCharacter();
  if (!char) {
    match.channel.send('⚠️ Failed to load character data. Skipping to next round...');
    return setTimeout(() => runNextAnimeRound(channelId), 2000);
  }

  match.currentChar = char;
  match.roundActive = true;
  match.roundStartTime = Date.now();

  const roundEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`❓ Guess the Anime Character — Round ${match.currentRound}/${match.rounds}`)
    .setDescription(
      `Can you name this character? Type their first or full name directly in chat!\n\n` +
      `🧩 **Clue 1:** ${char.clue1}\n` +
      `🧩 **Clue 2:** ${char.clue2}\n\n` +
      `⏱️ **Time Remaining:** \`25 seconds\``
    )
    .setFooter({ text: 'Type the character name directly in chat — no tag needed!' });

  await match.channel.send({ embeds: [roundEmbed] });

  // 25 second timer
  match.timer = setTimeout(() => {
    handleAnimeRoundTimeout(channelId);
  }, 25000);
}

// Handle chat guess
async function handleCorrectAnimeGuess(channelId, user, member, guessText) {
  const match = activeAnimeGames.get(channelId);
  if (!match || !match.roundActive || !match.currentChar) return false;

  const normalizedGuess = guessText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalizedGuess.length < 3) return false;

  const isMatch = match.currentChar.aliases.some(alias => {
    const normAlias = alias.replace(/[^a-z0-9]/g, '');
    return normalizedGuess === normAlias;
  });

  if (!isMatch) return false;

  // Correct guess!
  match.roundActive = false;
  if (match.timer) clearTimeout(match.timer);

  const elapsedSec = (Date.now() - match.roundStartTime) / 1000;
  const speedBonus = elapsedSec <= 6 ? 25 : (elapsedSec <= 12 ? 10 : 0);
  const totalEarned = 100 + speedBonus;

  const nickname = member?.displayName || user.displayName || user.username;
  const userId = user.id;

  const userScore = match.scores.get(userId) || {
    userId,
    username: user.username,
    nickname,
    points: 0
  };
  userScore.points += totalEarned;
  match.scores.set(userId, userScore);

  const winEmbed = new EmbedBuilder()
    .setColor(0x00FF66)
    .setTitle(`🎉 Correct! It's ${match.currentChar.fullName}! ✨`)
    .setThumbnail(match.currentChar.imageUrl)
    .setDescription(
      `**<@${userId}>** guessed correctly in **${elapsedSec.toFixed(1)}s**! (+${totalEarned} pts)\n\n` +
      `👤 **Character:** **${match.currentChar.fullName}**\n` +
      `📺 **From:** **${match.currentChar.mediaTitle}**\n\n` +
      getLiveAnimeLeaderboardText(match)
    )
    .setFooter({ text: match.currentRound < match.rounds ? 'Next round starting in 4 seconds...' : 'Calculating final podium...' });

  await match.channel.send({ embeds: [winEmbed] });

  setTimeout(() => {
    runNextAnimeRound(channelId);
  }, 4000);

  return true;
}

// Timeout handler
async function handleAnimeRoundTimeout(channelId) {
  const match = activeAnimeGames.get(channelId);
  if (!match || !match.roundActive) return;

  match.roundActive = false;

  const timeoutEmbed = new EmbedBuilder()
    .setColor(0xFF3366)
    .setTitle(`⏰ Time's Up! It was ${match.currentChar.fullName}!`)
    .setThumbnail(match.currentChar.imageUrl)
    .setDescription(
      `No one guessed the character in time!\n\n` +
      `👤 **Character:** **${match.currentChar.fullName}**\n` +
      `📺 **From:** **${match.currentChar.mediaTitle}**\n\n` +
      getLiveAnimeLeaderboardText(match)
    )
    .setFooter({ text: match.currentRound < match.rounds ? 'Next round starting in 4 seconds...' : 'Calculating final podium...' });

  await match.channel.send({ embeds: [timeoutEmbed] });

  setTimeout(() => {
    runNextAnimeRound(channelId);
  }, 4000);
}

// Standings text
function getLiveAnimeLeaderboardText(match) {
  if (match.scores.size === 0) {
    return '📊 **Match Standings (Round ' + match.currentRound + '/' + match.rounds + '):**\n*No points scored yet!*';
  }

  const sorted = Array.from(match.scores.values()).sort((a, b) => b.points - a.points);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  const lines = sorted.slice(0, 5).map((p, idx) => {
    const medal = medals[idx] || '🔹';
    return `${medal} **${p.nickname}** — \`${p.points} pts\``;
  });

  return `📊 **Live Standings (Round ${match.currentRound}/${match.rounds}):**\n${lines.join('\n')}`;
}

// Final podium & reset
async function endAnimeMatchAndShowPodium(channelId) {
  const match = activeAnimeGames.get(channelId);
  if (!match) return;

  const sorted = Array.from(match.scores.values()).sort((a, b) => b.points - a.points);

  let podiumText = '';
  if (sorted.length === 0) {
    podiumText = '😢 *No one scored any points this match! Better luck next time otaku!* 🌸';
  } else {
    if (sorted[0]) podiumText += `🥇 **1st Place Champion:** <@${sorted[0].userId}> — **${sorted[0].points} pts** 👑\n`;
    if (sorted[1]) podiumText += `🥈 **2nd Place Runner-Up:** <@${sorted[1].userId}> — **${sorted[1].points} pts** ✨\n`;
    if (sorted[2]) podiumText += `🥉 **3rd Place Bronze:** <@${sorted[2].userId}> — **${sorted[2].points} pts** 🌟\n`;

    if (sorted.length > 3) {
      podiumText += `\n**Honorable Mentions:**\n`;
      sorted.slice(3, 6).forEach((p, i) => {
        podiumText += `${i + 4}. **${p.nickname}** — ${p.points} pts\n`;
      });
    }
  }

  const finaleEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🏆 ANIME CHARACTER QUIZ GRAND FINALE! 🏆')
    .setDescription(
      `### 🎊 **Match Complete (${match.rounds} Rounds)** 🎊\n\n` +
      `Thank you everyone for playing! Here are our champions:\n\n` +
      podiumText +
      `\n\n*Leaderboard has been reset for the next match! GG everyone!* 🌸✨`
    )
    .setFooter({ text: 'AniPedia Anime Quiz • Ready for the next challenger!' })
    .setTimestamp();

  await match.channel.send({ embeds: [finaleEmbed] });

  activeAnimeGames.delete(channelId);
}

module.exports = {
  activeAnimeGames,
  startAnimeQuizMatch,
  handleCorrectAnimeGuess
};
