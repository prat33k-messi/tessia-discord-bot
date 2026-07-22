const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diagnose')
    .setDescription('(Admin) View the last processing diagnostic trace for a user')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('Username to diagnose (defaults to yourself)')
        .setRequired(false)),
  
  async execute(interaction) {
    const isAdmin = interaction.member?.permissions?.has('Administrator') || interaction.user.username === '_c0rle0ne';
    if (!isAdmin) {
      return interaction.reply({ content: "Gomen, only administrators can use the diagnostic tool! 🚫🌸", ephemeral: true });
    }

    const targetUser = interaction.options.getString('user') || interaction.user.username;
    const diag = interaction.client.lastDiagnostics.get(targetUser);

    if (!diag) {
      return interaction.reply({ content: `No diagnostic data found for **${targetUser}**. They need to send at least one message first! 🌸`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🔬 Diagnostic Trace — ${targetUser}`)
      .setDescription(`Full reasoning pipeline for the last processed message.`)
      .addFields(
        { name: '💬 User Query', value: `\`${diag.userQuery.substring(0, 200)}\``, inline: false },
        { name: '🎯 Detected Intent', value: `\`${diag.intent}\`${diag.term ? ` → Term: \`${diag.term}\`` : ''}`, inline: true },
        { name: '🧠 Classifier Reasoning', value: diag.classifierReasoning || 'N/A', inline: false },
        { name: '📡 Tool Context Used?', value: diag.hadToolContext ? '✅ Yes (API data injected)' : '❌ No (casual chat)', inline: true },
        { name: '🤔 Pre-Reasoning Used?', value: diag.usedReasoning ? '✅ Yes (complex question)' : '❌ No', inline: true },
        { name: '📊 Self-Eval Score', value: `${diag.evalScore}/10`, inline: true },
        { name: '📝 Self-Eval Reason', value: diag.evalReason || 'N/A', inline: false },
        { name: '🔄 Self-Corrected?', value: diag.selfCorrected ? '✅ Yes (regenerated)' : '❌ No (passed QC)', inline: true },
        { name: '💬 Response Preview', value: `\`${diag.responsePreview}...\``, inline: false }
      )
      .setFooter({ text: `Diagnostic captured at ${diag.timestamp}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async executeMessage(message) {
    const isAdmin = message.member?.permissions?.has('Administrator') || message.author.username === '_c0rle0ne';
    if (!isAdmin) {
      return message.reply("Gomen, only administrators can use the diagnostic tool! 🚫🌸");
    }

    const targetUser = message.author.username;
    const diag = message.client.lastDiagnostics.get(targetUser);

    if (!diag) {
      return message.reply(`No diagnostic data found for **${targetUser}**. Send a message first! 🌸`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🔬 Diagnostic Trace — ${targetUser}`)
      .setDescription(`Full reasoning pipeline for the last processed message.`)
      .addFields(
        { name: '💬 User Query', value: `\`${diag.userQuery.substring(0, 200)}\``, inline: false },
        { name: '🎯 Detected Intent', value: `\`${diag.intent}\`${diag.term ? ` → Term: \`${diag.term}\`` : ''}`, inline: true },
        { name: '🧠 Classifier Reasoning', value: diag.classifierReasoning || 'N/A', inline: false },
        { name: '📡 Tool Context Used?', value: diag.hadToolContext ? '✅ Yes (API data injected)' : '❌ No (casual chat)', inline: true },
        { name: '🤔 Pre-Reasoning Used?', value: diag.usedReasoning ? '✅ Yes (complex question)' : '❌ No', inline: true },
        { name: '📊 Self-Eval Score', value: `${diag.evalScore}/10`, inline: true },
        { name: '📝 Self-Eval Reason', value: diag.evalReason || 'N/A', inline: false },
        { name: '🔄 Self-Corrected?', value: diag.selfCorrected ? '✅ Yes (regenerated)' : '❌ No (passed QC)', inline: true },
        { name: '💬 Response Preview', value: `\`${diag.responsePreview}...\``, inline: false }
      )
      .setFooter({ text: `Diagnostic captured at ${diag.timestamp}` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
