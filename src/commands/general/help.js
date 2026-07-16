const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show Anipedia command guide'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🌸 Tessia — Command Guide')
      .setDescription(
        `Welcome to **Anipedia**! I'm Tessia, your companion bot. 💜\n` +
        `Use the dropdown menu below to select a command category!`
      )
      .setFooter({ text: 'Tessia • Companion of Anipedia' })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Select a category...')
      .addOptions([
        {
          label: 'General Commands',
          description: 'Help, Ping, Profile, and AFK',
          value: 'help_general',
          emoji: '💬'
        },
        {
          label: 'Game Commands',
          description: 'Character Guessing and Blind Ranking Game',
          value: 'help_games',
          emoji: '🎮'
        },
        {
          label: 'Admin Commands',
          description: 'News feed configuration and testing',
          value: 'help_admin',
          emoji: '📰'
        }
      ]);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({ embeds: [embed], components: [row] });
  },
  async executeMessage(message) {
    // Prefix fallback can send a complete text guide directly or embeds
    const helpEmbed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🌸 Tessia — Command Guide')
      .setDescription(
        `Welcome to **Anipedia**! I'm Tessia, your companion bot. 💜\n` +
        `Here is the list of my commands:`
      )
      .addFields(
        {
          name: '💬 General Commands',
          value: [
            '`@Tessia help` — Show this guide',
            '`@Tessia ping` — Check response speed',
            '`@Tessia profile` — See what I remember about you',
            '`@Tessia afk <reason>` — Go AFK with a reason',
          ].join('\n')
        },
        {
          name: '🎮 Games',
          value: [
            '`@Tessia guess the character` / `play a game` — Start character guessing game',
            '`@Tessia start blind ranking` — Start blind anime ranking game',
          ].join('\n')
        },
        {
          name: '📰 Auto News Feed (Admin)',
          value: [
            '`@Tessia set news channel #channel` — Set automatic news channel',
            '`@Tessia news test` — Test post latest news article',
          ].join('\n')
        }
      )
      .setFooter({ text: 'Tip: You can now use slash commands (/) for a better UI experience! ✨' })
      .setTimestamp();

    await message.reply({ embeds: [helpEmbed] });
  }
};
