const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function getRandomCharacterForGame() {
  try {
    const randomPage = Math.floor(Math.random() * 20) + 1;
    const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 10) {
        characters(sort: FAVOURITES_DESC) {
          id
          name { full native }
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
      body: JSON.stringify({ query: variables => {}, query, variables: { page: randomPage } })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const characters = data?.data?.Page?.characters || [];
    if (characters.length === 0) return null;

    const char = characters[Math.floor(Math.random() * characters.length)];
    const media = char.media?.nodes?.[0];
    if (!media) return null;

    const mediaTitle = media.title.english || media.title.romaji;
    const genres = media.genres || [];
    let cleanDesc = char.description || '';
    cleanDesc = cleanDesc.replace(/~!.*?!~/gs, '').replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim();

    const hints = [];
    hints.push(`This character is from a **${genres.slice(0, 2).join('/')}** ${media.format === 'TV' ? 'anime' : (media.format || 'series')}${media.seasonYear ? ` (${media.seasonYear})` : ''}.`);
    
    if (char.gender) {
      hints.push(`The character is **${char.gender.toLowerCase()}**.`);
    } else {
      hints.push(`The anime/manga they appear in is titled **"${mediaTitle}"**.`);
    }
    
    if (char.gender) {
      hints.push(`They appear in **"${mediaTitle}"**.`);
    } else {
      if (cleanDesc.length > 20) {
        hints.push(`About them: "${cleanDesc.substring(0, 100)}..."`);
      } else {
        hints.push(`Their series has genres: **${genres.join(', ')}**.`);
      }
    }
    
    const fullName = char.name.full;
    hints.push(`Their name starts with the letter **"${fullName.charAt(0)}"** and has **${fullName.length}** characters (including spaces).`);
    
    if (char.name.native) {
      hints.push(`In Japanese, their name is written as **${char.name.native}**.`);
    } else {
      hints.push(`Their full name starts with **"${fullName.substring(0, 2)}"**.`);
    }

    return {
      name: fullName,
      mediaTitle,
      hints
    };
  } catch (err) {
    console.error('Random character fetch error:', err.message);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('character-guess')
    .setDescription('Start a character guessing game!'),
  
  async execute(interaction) {
    const username = interaction.user.username;
    if (interaction.client.activeGames.has(username)) {
      return interaction.reply("You already have an active game! Type your guess or click **Give Up**.");
    }

    await interaction.deferReply();
    const characterData = await getRandomCharacterForGame();
    if (!characterData) {
      return interaction.editReply("Could not fetch character, please try again in a moment. 😰");
    }

    interaction.client.activeGames.set(username, {
      character: characterData.name,
      hints: characterData.hints,
      guessCount: 0,
      currentHintIndex: 0,
      mediaTitle: characterData.mediaTitle
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🎮 Guess the Anime Character!')
      .setDescription(`I've picked a popular character. Can you guess who they are?\n\n**Hint 1:** ${characterData.hints[0]}`)
      .setFooter({ text: 'Type your guess in chat (reply to me) or use the buttons below!' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('game_hint')
        .setLabel('Need Hint')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('game_giveup')
        .setLabel('Give Up')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  async executeMessage(message) {
    const username = message.author.username;
    if (message.client.activeGames.has(username)) {
      return message.reply("You already have an active game! Type your guess or type `give up`.");
    }

    await message.channel.sendTyping();
    const characterData = await getRandomCharacterForGame();
    if (!characterData) {
      return message.reply("Could not fetch character, please try again in a moment. 😰");
    }

    message.client.activeGames.set(username, {
      character: characterData.name,
      hints: characterData.hints,
      guessCount: 0,
      currentHintIndex: 0,
      mediaTitle: characterData.mediaTitle
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🎮 Guess the Anime Character!')
      .setDescription(`I've picked a popular character. Can you guess who they are?\n\n**Hint 1:** ${characterData.hints[0]}`)
      .setFooter({ text: 'Type your guess in chat or type "hint" to get the next hint!' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('game_hint')
        .setLabel('Need Hint')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('game_giveup')
        .setLabel('Give Up')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ embeds: [embed], components: [row] });
  },
  getRandomCharacterForGame
};
