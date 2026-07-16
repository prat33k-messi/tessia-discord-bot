const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function getAnimeForRankingGame() {
  try {
    const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(sort: POPULARITY_DESC, type: ANIME) {
            id
            title { romaji english }
            genres
            description(asHtml: false)
            meanScore
            format
            episodes
            coverImage { large }
          }
        }
      }
    `;

    const pagesToFetch = new Set();
    while (pagesToFetch.size < 2) {
      pagesToFetch.add(Math.floor(Math.random() * 4) + 1);
    }

    let allAnime = [];
    for (const page of pagesToFetch) {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { page, perPage: 50 } })
      });
      if (!response.ok) continue;
      const json = await response.json();
      const media = json?.data?.Page?.media;
      if (media && media.length > 0) allAnime.push(...media);
    }

    if (allAnime.length < 8) return null;

    for (let i = allAnime.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allAnime[i], allAnime[j]] = [allAnime[j], allAnime[i]];
    }
    const selected = allAnime.slice(0, 8);

    return selected.map((anime, index) => {
      let cleanDesc = (anime.description || 'No description available.')
        .replace(/<[^>]*>/g, '')
        .replace(/~!.*?!~/gs, '[spoiler]');
      if (cleanDesc.length > 150) cleanDesc = cleanDesc.substring(0, 147) + '...';
      const realTitle = anime.title.english || anime.title.romaji || 'Unknown Title';

      return {
        id: anime.id,
        blindLabel: `Anime ${alphabet[index]}`,
        revealTitle: realTitle,
        genres: anime.genres || [],
        description: cleanDesc,
        meanScore: anime.meanScore ?? 'N/A',
        format: anime.format || 'Unknown',
        episodes: anime.episodes ?? '?',
        coverImage: anime.coverImage?.large || null,
      };
    });
  } catch (error) {
    console.error('Error in getAnimeForRankingGame:', error);
    return null;
  }
}

function buildRankingMatchEmbed(animeA, animeB, roundNum, matchNum) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`🏆 Blind Anime Ranking — Round ${roundNum}, Match ${matchNum}`)
      .setDescription('Two mystery anime face off! Read the clues and pick your favorite 🔍')
      .addFields(
        {
          name: `📺 ${animeA.blindLabel}`,
          value: [
            `**Genres:** ${animeA.genres.length > 0 ? animeA.genres.join(', ') : 'N/A'}`,
            `**Format:** ${animeA.format}  •  **Episodes:** ${animeA.episodes}`,
            `**Score:** ${animeA.meanScore}/100`,
            `\n> ${animeA.description}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '\u200B',
          value: '─────── **VS** ───────',
          inline: false,
        },
        {
          name: `📺 ${animeB.blindLabel}`,
          value: [
            `**Genres:** ${animeB.genres.length > 0 ? animeB.genres.join(', ') : 'N/A'}`,
            `**Format:** ${animeB.format}  •  **Episodes:** ${animeB.episodes}`,
            `**Score:** ${animeB.meanScore}/100`,
            `\n> ${animeB.description}`,
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Pick A or B using the buttons below!' })
      .setTimestamp();
    return embed;
  } catch (error) {
    console.error('Error in buildRankingMatchEmbed:', error);
    return null;
  }
}

function buildRankingRevealEmbed(winner, runnerUp) {
  try {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 Your Blind Champion!')
      .setDescription(
        `After all the blind rounds, your champion has been revealed!\n\n` +
        `🥇 **Winner:** ${winner.revealTitle}\n` +
        `🥈 **Runner-Up:** ${runnerUp.revealTitle}`
      )
      .addFields(
        {
          name: '📊 Winner Stats',
          value: [
            `**Genres:** ${winner.genres.length > 0 ? winner.genres.join(', ') : 'N/A'}`,
            `**Format:** ${winner.format}  •  **Episodes:** ${winner.episodes}`,
            `**AniList Score:** ${winner.meanScore}/100`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '📝 About the Winner',
          value: `> ${winner.description}`,
          inline: false,
        }
      )
      .setFooter({ text: 'Blind Anime Ranking • Powered by Tessia' })
      .setTimestamp();
    if (winner.coverImage) embed.setThumbnail(winner.coverImage);
    return embed;
  } catch (error) {
    console.error('Error in buildRankingRevealEmbed:', error);
    return null;
  }
}

function getActionRow(labelA, labelB) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rank_vote_a')
      .setLabel(`Pick ${labelA}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('rank_vote_b')
      .setLabel(`Pick ${labelB}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('rank_cancel')
      .setLabel('Cancel Game')
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blind-ranking')
    .setDescription('Start a blind anime ranking tournament!'),
  
  async execute(interaction) {
    const username = interaction.user.username;
    if (interaction.client.activeRankingGames.has(username)) {
      return interaction.reply("You already have an active ranking tournament! Complete it or click **Cancel Game**.");
    }

    await interaction.deferReply();
    const animePool = await getAnimeForRankingGame();
    if (!animePool || animePool.length < 8) {
      return interaction.editReply("Could not set up the tournament right now, gomen! 😰");
    }

    const bracket = [];
    for (let i = 0; i < 8; i += 2) {
      bracket.push([animePool[i], animePool[i + 1]]);
    }

    interaction.client.activeRankingGames.set(username, {
      bracket,
      round: 1,
      matchIndex: 0,
      winners: [],
      lastLoser: null
    });

    const firstMatch = bracket[0];
    const matchEmbed = buildRankingMatchEmbed(firstMatch[0], firstMatch[1], 1, 1);
    const row = getActionRow(firstMatch[0].blindLabel, firstMatch[1].blindLabel);

    await interaction.editReply({
      content: `🏆 **Blind Anime Ranking Tournament!** 🏆\n\n8 mystery anime enter, 1 champion emerges! You'll judge them purely by description, genres, and stats.\n\n**Round 1: Quarterfinals** — Match 1 of 4`,
      embeds: [matchEmbed],
      components: [row]
    });
  },

  async executeMessage(message) {
    const username = message.author.username;
    if (message.client.activeRankingGames.has(username)) {
      return message.reply("You already have an active ranking tournament! Complete it or click **Cancel Game**.");
    }

    await message.channel.sendTyping();
    const animePool = await getAnimeForRankingGame();
    if (!animePool || animePool.length < 8) {
      return message.reply("Could not set up the tournament right now, gomen! 😰");
    }

    const bracket = [];
    for (let i = 0; i < 8; i += 2) {
      bracket.push([animePool[i], animePool[i + 1]]);
    }

    message.client.activeRankingGames.set(username, {
      bracket,
      round: 1,
      matchIndex: 0,
      winners: [],
      lastLoser: null
    });

    const firstMatch = bracket[0];
    const matchEmbed = buildRankingMatchEmbed(firstMatch[0], firstMatch[1], 1, 1);
    const row = getActionRow(firstMatch[0].blindLabel, firstMatch[1].blindLabel);

    await message.reply({
      content: `🏆 **Blind Anime Ranking Tournament!** 🏆\n\n8 mystery anime enter, 1 champion emerges! You'll judge them purely by description, genres, and stats.\n\n**Round 1: Quarterfinals** — Match 1 of 4`,
      embeds: [matchEmbed],
      components: [row]
    });
  },
  buildRankingMatchEmbed,
  buildRankingRevealEmbed,
  getActionRow
};
