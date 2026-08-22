const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../config');
const { getAfkContext } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set yourself as AFK')
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for going AFK')
        .setRequired(false)),
  async execute(interaction) {
    const reason = interaction.options.getString('reason') || 'No reason given';
    const username = interaction.user.username;
    const nickname = interaction.member?.displayName || interaction.user.displayName || username;
    const avatarUrl = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });
    const context = getAfkContext(reason);

    interaction.client.afkUsers.set(username, { reason, timestamp: Date.now(), nickname, avatarUrl, mentions: [] });

    if (db) {
      db.collection('afk_status').doc(username).set({ reason, timestamp: Date.now(), nickname, avatarUrl })
        .catch(err => console.error('Error saving AFK to Firestore:', err));
    }

    const afkEmbed = new EmbedBuilder()
      .setColor(context.color)
      .setTitle(`${context.emoji} AFK Mode Activated`)
      .setThumbnail(avatarUrl)
      .setDescription(
        `### ⚡ **${nickname}** is now AFK!\n\n` +
        `🏷️ **Status Tag:** \`${context.badge}\`\n` +
        `📝 **Reason:** *"${reason}"*\n` +
        `⏰ **Set At:** <t:${Math.floor(Date.now() / 1000)}:t> (<t:${Math.floor(Date.now() / 1000)}:R>)\n\n` +
        `> *${context.tagline}*`
      )
      .setFooter({ text: "Tessia AFK System • Mention pings will be recorded 🌸", iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [afkEmbed] });
  },
  async executeMessage(message, args) {
    const reason = args.join(' ') || 'No reason given';
    const username = message.author.username;
    const nickname = message.member?.displayName || message.author.displayName || username;
    const avatarUrl = message.author.displayAvatarURL({ dynamic: true, size: 256 });
    const context = getAfkContext(reason);

    message.client.afkUsers.set(username, { reason, timestamp: Date.now(), nickname, avatarUrl, mentions: [] });

    if (db) {
      db.collection('afk_status').doc(username).set({ reason, timestamp: Date.now(), nickname, avatarUrl })
        .catch(err => console.error('Error saving AFK to Firestore:', err));
    }

    const afkEmbed = new EmbedBuilder()
      .setColor(context.color)
      .setTitle(`${context.emoji} AFK Mode Activated`)
      .setThumbnail(avatarUrl)
      .setDescription(
        `### ⚡ **${nickname}** is now AFK!\n\n` +
        `🏷️ **Status Tag:** \`${context.badge}\`\n` +
        `📝 **Reason:** *"${reason}"*\n` +
        `⏰ **Set At:** <t:${Math.floor(Date.now() / 1000)}:t> (<t:${Math.floor(Date.now() / 1000)}:R>)\n\n` +
        `> *${context.tagline}*`
      )
      .setFooter({ text: "Tessia AFK System • Mention pings will be recorded 🌸", iconURL: message.client.user.displayAvatarURL() })
      .setTimestamp();

    await message.reply({ embeds: [afkEmbed] });
  }
};
