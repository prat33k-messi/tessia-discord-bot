const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../config');

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

    interaction.client.afkUsers.set(username, { reason, timestamp: Date.now(), nickname });

    if (db) {
      db.collection('afk_status').doc(username).set({ reason, timestamp: Date.now(), nickname })
        .catch(err => console.error('Error saving AFK to Firestore:', err));
    }

    const afkEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('💤 AFK Set')
      .setDescription(`**${nickname}** is now AFK\n**Reason:** ${reason}`)
      .setFooter({ text: "I'll let everyone know! 🌸" })
      .setTimestamp();

    await interaction.reply({ embeds: [afkEmbed] });
  },
  async executeMessage(message, args) {
    const reason = args.join(' ') || 'No reason given';
    const username = message.author.username;
    const nickname = message.member?.displayName || message.author.displayName || username;

    message.client.afkUsers.set(username, { reason, timestamp: Date.now(), nickname });

    if (db) {
      db.collection('afk_status').doc(username).set({ reason, timestamp: Date.now(), nickname })
        .catch(err => console.error('Error saving AFK to Firestore:', err));
    }

    const afkEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('💤 AFK Set')
      .setDescription(`**${nickname}** is now AFK\n**Reason:** ${reason}`)
      .setFooter({ text: "I'll let everyone know! 🌸" })
      .setTimestamp();

    await message.reply({ embeds: [afkEmbed] });
  }
};
