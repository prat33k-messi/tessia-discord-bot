const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Jimp } = require('jimp');

// Active games keyed by channelId:
// channelId => {
//   gameType: 'pokemon',
//   channel: channelObj,
//   rounds: number,
//   currentRound: number,
//   scores: Map<userId, { username, nickname, points, avatarUrl }>,
//   currentPokemon: { id, name, cleanName, types, spriteUrl, revealUrl },
//   timer: TimeoutId,
//   roundActive: boolean
// }
const activePokemonGames = new Map();

// Staff role checker
function isStaffOrDev(member, user) {
  if (!member && !user) return false;
  if (user?.username === '_c0rle0ne') return true;

  if (!member?.roles?.cache) return false;
  const staffRoleKeywords = ['shogun', 'royal hand', 'royal hands', 'moderator', 'junior moderator', 'admin', 'developer'];
  return member.roles.cache.some(role => {
    const rName = role.name.toLowerCase();
    return staffRoleKeywords.some(k => rName.includes(k));
  });
}

// Fetch a random Pokemon from PokeAPI (Generations 1-9, IDs 1 to 1025)
async function fetchRandomPokemon() {
  try {
    const randomId = Math.floor(Math.random() * 1010) + 1;
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${randomId}`);
    if (!res.ok) return null;

    const data = await res.json();
    const rawName = data.name.toLowerCase();
    
    // Clean names like "nidoran-m", "mr-mime", "ho-oh", "tapu-koko", "type-null"
    let cleanName = rawName.replace(/-/g, ' ').trim();
    if (rawName.startsWith('nidoran')) cleanName = 'nidoran';

    const types = (data.types || []).map(t => t.type.name).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ');
    
    // Official artwork preferred, fallback to front_default
    const revealUrl = data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default;
    if (!revealUrl) return null;

    return {
      id: data.id,
      name: rawName,
      displayName: rawName.charAt(0).toUpperCase() + rawName.slice(1),
      cleanName,
      types,
      revealUrl
    };
  } catch (err) {
    console.error('[Pokemon Game] Error fetching pokemon:', err.message);
    return null;
  }
}

// Generate silhouette PNG buffer using Jimp
async function generateSilhouetteBuffer(spriteUrl) {
  try {
    const imgRes = await fetch(spriteUrl);
    if (!imgRes.ok) return null;
    const arrayBuf = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const img = await Jimp.read(buffer);
    img.resize({ w: 320 });
    
    // Scan all pixels: turn non-transparent pixels into dark blue-black silhouette
    img.scan((x, y, idx) => {
      if (img.bitmap.data[idx + 3] > 30) {
        img.bitmap.data[idx] = 16;     // R
        img.bitmap.data[idx + 1] = 22; // G
        img.bitmap.data[idx + 2] = 36; // B
        img.bitmap.data[idx + 3] = 255;
      }
    });

    return await img.getBuffer('image/png');
  } catch (err) {
    console.error('[Pokemon Game] Silhouette creation error:', err.message);
    return null;
  }
}

// Start a new match in a channel
async function startPokemonMatch(channel, totalRounds, starterUser) {
  if (activePokemonGames.has(channel.id)) {
    return { success: false, message: 'A game is already active in this channel! Finish it first or wait for it to end.' };
  }

  const match = {
    gameType: 'pokemon',
    channel,
    rounds: Math.min(Math.max(parseInt(totalRounds, 10) || 5, 1), 20),
    currentRound: 0,
    scores: new Map(),
    currentPokemon: null,
    timer: null,
    roundStartTime: 0,
    roundActive: false
  };

  activePokemonGames.set(channel.id, match);

  const startEmbed = new EmbedBuilder()
    .setColor(0xFF0033) // Pokemon Red
    .setTitle('⚡ Who\'s That Pokémon? — Match Started!')
    .setDescription(
      `### 🎮 **Game Initiated by ${starterUser.username}!**\n\n` +
      `🎯 **Total Rounds:** \`${match.rounds}\`\n` +
      `⏱️ **Time Per Round:** \`20 seconds\`\n` +
      `💡 **How to Play:** Just type the Pokémon\'s name directly in chat — **no tagging or replies needed!**\n\n` +
      `*Round 1 begins in 3 seconds... Get ready!* 🌸`
    )
    .setFooter({ text: 'AniPedia PokéGame • Fast answers get bonus points!' })
    .setTimestamp();

  await channel.send({ embeds: [startEmbed] });

  setTimeout(() => {
    runNextRound(channel.id);
  }, 3000);

  return { success: true };
}

// Run the next round of the match
async function runNextRound(channelId) {
  const match = activePokemonGames.get(channelId);
  if (!match) return;

  match.currentRound++;
  if (match.currentRound > match.rounds) {
    return endMatchAndShowPodium(channelId);
  }

  const pokemon = await fetchRandomPokemon();
  if (!pokemon) {
    match.channel.send('⚠️ Failed to load Pokémon data for this round. Skipping to next...');
    return setTimeout(() => runNextRound(channelId), 2000);
  }

  const silhouetteBuf = await generateSilhouetteBuffer(pokemon.revealUrl);
  match.currentPokemon = pokemon;
  match.roundActive = true;
  match.roundStartTime = Date.now();

  const roundEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`❓ Who's That Pokémon? — Round ${match.currentRound}/${match.rounds}`)
    .setDescription(
      `Can you guess this Pokémon? Type your answer directly in the chat below!\n\n` +
      `🏷️ **Primary Types:** \`${pokemon.types}\`\n` +
      `⏱️ **Time Remaining:** \`20 seconds\``
    )
    .setFooter({ text: 'Type the name directly in chat — no tag needed!' });

  const messageOptions = { embeds: [roundEmbed] };

  if (silhouetteBuf) {
    const attachment = new AttachmentBuilder(silhouetteBuf, { name: 'whos-that-pokemon.png' });
    roundEmbed.setImage('attachment://whos-that-pokemon.png');
    messageOptions.files = [attachment];
  } else {
    roundEmbed.setDescription(roundEmbed.data.description + `\n*(Image unavailable, guess by type: \`${pokemon.types}\`!)*`);
  }

  await match.channel.send(messageOptions);

  // Set 20 second timeout for this round
  match.timer = setTimeout(() => {
    handleRoundTimeout(channelId);
  }, 20000);
}

// Handle correct guess from chat listener
async function handleCorrectGuess(channelId, user, member, guessText) {
  const match = activePokemonGames.get(channelId);
  if (!match || !match.roundActive || !match.currentPokemon) return false;

  // Check answer match (case-insensitive, trims, checks variations)
  const targetName = match.currentPokemon.name.toLowerCase();
  const cleanTarget = match.currentPokemon.cleanName.toLowerCase();
  const userGuess = guessText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedTarget = targetName.replace(/[^a-z0-9]/g, '');
  const normalizedClean = cleanTarget.replace(/[^a-z0-9]/g, '');

  const isMatch = (userGuess === normalizedTarget || userGuess === normalizedClean);
  if (!isMatch) return false;

  // Correct guess!
  match.roundActive = false;
  if (match.timer) clearTimeout(match.timer);

  // Calculate score (100 base pts + up to 25 speed bonus)
  const elapsedSec = (Date.now() - match.roundStartTime) / 1000;
  const speedBonus = elapsedSec <= 5 ? 25 : (elapsedSec <= 10 ? 10 : 0);
  const totalEarned = 100 + speedBonus;

  const nickname = member?.displayName || user.displayName || user.username;
  const userId = user.id;

  // Update match scores
  const userScore = match.scores.get(userId) || {
    userId,
    username: user.username,
    nickname,
    points: 0,
    avatarUrl: user.displayAvatarURL({ dynamic: true, size: 256 })
  };
  userScore.points += totalEarned;
  match.scores.set(userId, userScore);

  // Send Round Win Embed with reveal
  const winEmbed = new EmbedBuilder()
    .setColor(0x00FF66)
    .setTitle(`🎉 Correct! It's ${match.currentPokemon.displayName}! ✨`)
    .setImage(match.currentPokemon.revealUrl)
    .setDescription(
      `**<@${userId}>** guessed correctly in **${elapsedSec.toFixed(1)}s**! (+${totalEarned} pts)\n\n` +
      `📖 **Pokédex #${match.currentPokemon.id}:** **${match.currentPokemon.displayName}**\n` +
      `⚡ **Type:** \`${match.currentPokemon.types}\`\n\n` +
      getLiveLeaderboardText(match)
    )
    .setFooter({ text: match.currentRound < match.rounds ? 'Next round starting in 4 seconds...' : 'Calculating final podium...' });

  await match.channel.send({ embeds: [winEmbed] });

  setTimeout(() => {
    runNextRound(channelId);
  }, 4000);

  return true;
}

// Handle round timeout when no one guesses in 20s
async function handleRoundTimeout(channelId) {
  const match = activePokemonGames.get(channelId);
  if (!match || !match.roundActive) return;

  match.roundActive = false;

  const timeoutEmbed = new EmbedBuilder()
    .setColor(0xFF3366)
    .setTitle(`⏰ Time's Up! It was ${match.currentPokemon.displayName}!`)
    .setImage(match.currentPokemon.revealUrl)
    .setDescription(
      `No one guessed the Pokémon in time!\n\n` +
      `📖 **Pokédex #${match.currentPokemon.id}:** **${match.currentPokemon.displayName}**\n` +
      `⚡ **Type:** \`${match.currentPokemon.types}\`\n\n` +
      getLiveLeaderboardText(match)
    )
    .setFooter({ text: match.currentRound < match.rounds ? 'Next round starting in 4 seconds...' : 'Calculating final podium...' });

  await match.channel.send({ embeds: [timeoutEmbed] });

  setTimeout(() => {
    runNextRound(channelId);
  }, 4000);
}

// Generate live match standings string
function getLiveLeaderboardText(match) {
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

// End match, declare Top 3 Winners, and clear memory
async function endMatchAndShowPodium(channelId) {
  const match = activePokemonGames.get(channelId);
  if (!match) return;

  const sorted = Array.from(match.scores.values()).sort((a, b) => b.points - a.points);

  let podiumText = '';
  if (sorted.length === 0) {
    podiumText = '😢 *No one scored any points this match! Better luck next time trainers!* 🌸';
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
    .setColor(0xFFD700) // Championship Gold
    .setTitle('🏆 POKÉMON CHAMPIONSHIP GRAND FINALE! 🏆')
    .setDescription(
      `### 🎊 **Match Complete (${match.rounds} Rounds)** 🎊\n\n` +
      `Thank you everyone for playing! Here are our champions:\n\n` +
      podiumText +
      `\n\n*Leaderboard has been reset for the next match! GG everyone!* 🌸✨`
    )
    .setFooter({ text: 'AniPedia PokéGame • Ready for the next challenger!' })
    .setTimestamp();

  await match.channel.send({ embeds: [finaleEmbed] });

  // Completely reset and delete match from memory
  activePokemonGames.delete(channelId);
}

module.exports = {
  activePokemonGames,
  isStaffOrDev,
  startPokemonMatch,
  handleCorrectGuess
};
