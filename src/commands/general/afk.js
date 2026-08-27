const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../config');
const { getAfkContext } = require('../../utils/helpers');

function setAfkState(client, user, member, reason) {
  const userId = user.id;
  const username = user.username;
  const nickname = member?.displayName || user.displayName || username;
  const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 256 });
  const context = getAfkContext(reason);

  const afkData = {
    userId,
    username,
    nickname,
    avatarUrl,
    reason,
    timestamp: Date.now(),
    mentions: []
  };

  // Set by both ID and username for 100% reliable lookups
  client.afkUsers.set(userId, afkData);
  client.afkUsers.set(username, afkData);

  if (db) {
    db.collection('afk_status').doc(userId).set(afkData)
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
    .setFooter({ text: "Tessia AFK System • Mention pings will be recorded 🌸", iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  return afkEmbed;
}

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
    const embed = setAfkState(interaction.client, interaction.user, interaction.member, reason);
    await interaction.reply({ embeds: [embed] });
  },
  async executeMessage(message, args) {
    const reason = args.join(' ') || 'No reason given';
    const embed = setAfkState(message.client, message.author, message.member, reason);
    await message.reply({ embeds: [embed] });
  }
};
