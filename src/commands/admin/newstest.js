const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { fetchAnimeNews, buildAutoNewsEmbed } = require('../../services/news');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('newstest')
    .setDescription('Test post the latest anime news article')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const articles = await fetchAnimeNews();
      if (!articles || articles.length === 0) {
        return interaction.editReply("No articles fetched from the news feed. 😰");
      }
      
      const latestArticle = articles[0];
      const embed = await buildAutoNewsEmbed(latestArticle);
      
      if (embed) {
        await interaction.editReply({ content: '📰 **Test news article post:**', embeds: [embed] });
      } else {
        await interaction.editReply("Failed to build the news embed, gomen! 😰");
      }
    } catch (err) {
      console.error('News test failed:', err);
      await interaction.editReply("An error occurred during news test execution. 😰");
    }
  },
  async executeMessage(message) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply("Mou! 🌸 Only administrators can test the news feed! ❄️");
    }

    try {
      await message.channel.sendTyping();
      const articles = await fetchAnimeNews();
      if (!articles || articles.length === 0) {
        return message.reply("No articles fetched from the news feed. 😰");
      }
      
      const latestArticle = articles[0];
      const embed = await buildAutoNewsEmbed(latestArticle);
      
      if (embed) {
        await message.reply({ content: '📰 **Test news article post:**', embeds: [embed] });
      } else {
        await message.reply("Failed to build the news embed, gomen! 😰");
      }
    } catch (err) {
      console.error('News test failed:', err);
      await message.reply("An error occurred during news test execution. 😰");
    }
  }
};
