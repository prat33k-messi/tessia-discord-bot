const { SlashCommandBuilder } = require('discord.js');
const { startPokemonMatch, isStaffOrDev } = require('../../services/pokemonGame');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokemon-game')
    .setDescription('Start a Who\'s That Pokémon match (Staff only)')
    .addIntegerOption(option =>
      option.setName('rounds')
        .setDescription('Total number of rounds (1 to 20)')
        .setMinValue(1)
        .setMaxValue(20)
        .setRequired(false)),

  async execute(interaction) {
    if (!isStaffOrDev(interaction.member, interaction.user)) {
      return interaction.reply({
        content: '🌸 Only our **Shogun**, **Royal Hands**, or **Moderators** can initiate games! Ask a staff member to start a match!',
        ephemeral: true
      });
    }

    const rounds = interaction.options.getInteger('rounds') || 5;
    await interaction.reply({ content: `⚡ Setting up a **${rounds}-round** Pokémon match...`, ephemeral: true });

    const result = await startPokemonMatch(interaction.channel, rounds, interaction.user);
    if (!result.success) {
      await interaction.followUp({ content: result.message, ephemeral: true });
    }
  },

  async executeMessage(message, args) {
    if (!isStaffOrDev(message.member, message.author)) {
      return message.reply('🌸 Only our **Shogun**, **Royal Hands**, or **Moderators** can initiate games! Ask a staff member to start a match!');
    }

    let rounds = 5;
    if (args && args.length > 0) {
      const parsed = parseInt(args[0], 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
        rounds = parsed;
      }
    }

    const result = await startPokemonMatch(message.channel, rounds, message.author);
    if (!result.success) {
      await message.reply(result.message);
    }
  }
};
