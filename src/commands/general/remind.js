const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parseReminderInput, createReminder } = require('../../services/reminder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a DM reminder with Tessia')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time duration (e.g. 10m, 2h, 1d, 30s, or "in 15 minutes")')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('text')
        .setDescription('What do you want to be reminded about?')
        .setRequired(true)),
  async execute(interaction) {
    const timeStr = interaction.options.getString('time');
    const textStr = interaction.options.getString('text');

    const parsed = parseReminderInput(`${textStr} ${timeStr}`);
    if (parsed.error) {
      return interaction.reply({ content: `🌸 ${parsed.error}`, ephemeral: true });
    }

    const { text, delayMs } = parsed;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const nickname = interaction.member?.displayName || interaction.user.displayName || username;
    const channelId = interaction.channelId;

    const reminder = await createReminder(interaction.client, userId, username, nickname, channelId, text, delayMs);
    const remindAtSeconds = Math.floor(reminder.remindAt / 1000);

    const embed = new EmbedBuilder()
      .setColor(0xFF69B4)
      .setTitle('⏰ Reminder Set!')
      .setDescription(`Got it, **${nickname}**! I've scheduled your reminder:\n\n> 📌 **${text}**\n\nI will send you a message in your **DMs** <t:${remindAtSeconds}:R> (<t:${remindAtSeconds}:F>)! 🌸✨`)
      .setFooter({ text: 'Make sure your DMs are open so I can message you! ✨' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
  async executeMessage(message, args) {
    const rawInput = args.join(' ');
    const parsed = parseReminderInput(rawInput);

    if (parsed.error) {
      return message.reply(`🌸 ${parsed.error}`);
    }

    const { text, delayMs } = parsed;
    const userId = message.author.id;
    const username = message.author.username;
    const nickname = message.member?.displayName || message.author.displayName || username;
    const channelId = message.channel.id;

    const reminder = await createReminder(message.client, userId, username, nickname, channelId, text, delayMs);
    const remindAtSeconds = Math.floor(reminder.remindAt / 1000);

    const embed = new EmbedBuilder()
      .setColor(0xFF69B4)
      .setTitle('⏰ Reminder Set!')
      .setDescription(`Got it, **${nickname}**! I've scheduled your reminder:\n\n> 📌 **${text}**\n\nI will send you a message in your **DMs** <t:${remindAtSeconds}:R> (<t:${remindAtSeconds}:F>)! 🌸✨`)
      .setFooter({ text: 'Make sure your DMs are open so I can message you! ✨' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
