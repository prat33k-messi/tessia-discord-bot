const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check response speed and latency'),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`🏓 Pong! Latency is **${latency}ms**. Running at full power! ⚡🌸`);
  },
  async executeMessage(message) {
    const latency = Date.now() - message.createdTimestamp;
    await message.reply(`🏓 Pong! Latency is **${latency}ms**. I'm running at full power! ⚡🌸`);
  }
};
