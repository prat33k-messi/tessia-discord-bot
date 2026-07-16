const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('See what facts and details I remember about you'),
  async execute(interaction) {
    const username = interaction.user.username;
    const nickname = interaction.member?.displayName || interaction.user.displayName || username;

    const cache = interaction.client.preloadedMemories.get(username);
    const userMemories = cache?.facts || [];

    if (userMemories.length === 0) {
      const notFoundText = username === '_c0rle0ne'
        ? "I don't have any details stored about you yet, Aerion-sama! If we talk more, I will start remembering! 🌸"
        : `I don't have any facts stored about you yet! Chat with me normally and I will start remembering things about you! 🌸`;
      await interaction.reply(notFoundText);
    } else {
      const memoryList = userMemories.map(f => `• ${f}`).join('\n');
      const header = username === '_c0rle0ne' ? "✨ **Aerion-sama's Profile** ✨" : `📝 **User Profile: ${nickname}**`;
      await interaction.reply(`${header}\nHere is what I remember about you:\n${memoryList}\n\n*Type '@Tessia reset' if you want me to clear this.*`);
    }
  },
  async executeMessage(message) {
    const username = message.author.username;
    const nickname = message.member?.displayName || message.author.displayName || username;

    const cache = message.client.preloadedMemories.get(username);
    const userMemories = cache?.facts || [];

    if (userMemories.length === 0) {
      const notFoundText = username === '_c0rle0ne'
        ? "I don't have any details stored about you yet, Aerion-sama! If we talk more, I will start remembering! 🌸"
        : `I don't have any facts stored about you yet! Chat with me normally and I will start remembering things about you! 🌸`;
      await message.reply(notFoundText);
    } else {
      const memoryList = userMemories.map(f => `• ${f}`).join('\n');
      const header = username === '_c0rle0ne' ? "✨ **Aerion-sama's Profile** ✨" : `📝 **User Profile: ${nickname}**`;
      await message.reply(`${header}\nHere is what I remember about you:\n${memoryList}\n\n*Type '@Tessia reset' if you want me to clear this.*`);
    }
  }
};
