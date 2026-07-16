const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setnews')
    .setDescription('Set the channel for automatic anime news updates')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to post news in')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guild.id;

    if (!db) {
      return interaction.reply("Database not connected. Running in memory-only mode. 😰");
    }

    try {
      await db.collection('server_configs').doc(guildId).set({
        newsChannelId: channel.id,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await interaction.reply(`📰 Successfully set news feed channel to ${channel}! Latest anime news will be posted here dynamically. 🌸`);
    } catch (err) {
      console.error('Error saving news channel config:', err);
      await interaction.reply("Failed to save the channel configuration, gomen! 😰");
    }
  },
  async executeMessage(message, args) {
    // Check if user is administrator
    if (!message.member.permissions.has('Administrator')) {
      return message.reply("Mou! 🌸 Only administrators can configure the news channel! ❄️");
    }

    const setNewsMatch = message.content.match(/set\s+news\s+channel\s+<#(\d+)>/i);
    if (!setNewsMatch) {
      return message.reply("To set the news channel, please use: `@Tessia set news channel #channel`! 🌸");
    }

    const channelId = setNewsMatch[1];
    const guildId = message.guild.id;

    if (!db) {
      return message.reply("Database not connected. Running in memory-only mode. 😰");
    }

    try {
      await db.collection('server_configs').doc(guildId).set({
        newsChannelId: channelId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await message.reply(`📰 Successfully set news feed channel to <#${channelId}>! Latest anime news will be posted here dynamically. 🌸`);
    } catch (err) {
      console.error('Error saving news channel config:', err);
      await message.reply("Failed to save the channel configuration, gomen! 😰");
    }
  }
};
