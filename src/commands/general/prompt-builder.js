const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { groq, primaryModel } = require('../../config');

async function generatePromptDraft(taskOutline, feedback = null, previousPrompt = null) {
  try {
    let systemInstruction = `You are a world-class Prompt Engineering Assistant. Your goal is to help the user build the perfect, highly optimized prompt for an LLM.

To construct the perfect prompt, you must follow these structured principles:
1. Role Definition: Give the model a clear, professional identity/persona.
2. Context & Constraints: Outline what the model should and shouldn't do.
3. Formatting Rules: Define exactly how the output should be structured (Markdown, JSON, XML, bullet points).
4. Few-Shot Examples (where relevant): Suggest adding placeholders for examples to improve accuracy.

If the user is giving feedback/answering questions, refine the previous prompt dynamically. Do NOT patch things in a too-specific way; keep the prompt generic and robust so it generalizes well to all inputs.

Along with the generated prompt, you MUST ask 2-3 specific, high-quality clarifying questions to help refine the prompt further (e.g. regarding edge cases, length constraints, or desired tone).`;

    let userContent = "";
    if (!previousPrompt) {
      userContent = `Please build a structured, professional LLM prompt based on this rough outline/task: "${taskOutline}"`;
    } else {
      userContent = `Here is the previous prompt draft we created:
\`\`\`
${previousPrompt}
\`\`\`

The user provided this feedback/clarification: "${feedback}"

Please update and refine the prompt dynamically while keeping it generic and scalable. Highlight the changes/updates made, show the new prompt draft, and ask 2-3 new clarifying questions to refine it further if needed.`;
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent }
      ],
      temperature: 0.6,
      max_tokens: 1500
    });

    return completion.choices[0]?.message?.content || "Could not generate prompt draft, please try again.";
  } catch (err) {
    console.error("Error in generatePromptDraft:", err);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('prompt-builder')
    .setDescription('Tessia helps you build and refine the perfect prompt using iterative co-construction')
    .addStringOption(option =>
      option.setName('task')
        .setDescription('Briefly describe what you want the prompt to accomplish')
        .setRequired(true)),
  
  async execute(interaction) {
    const username = interaction.user.username;
    const task = interaction.options.getString('task');

    if (interaction.client.activePromptSessions.has(username)) {
      return interaction.reply("You already have an active prompt building session! Type your feedback or click **Exit Prompt Builder**.");
    }

    await interaction.deferReply();
    const draft = await generatePromptDraft(task);
    if (!draft) {
      return interaction.editReply("Something went wrong while generating the prompt, gomen! 😰");
    }

    interaction.client.activePromptSessions.set(username, {
      task,
      currentPrompt: draft,
      history: [{ role: 'assistant', content: draft }]
    });

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📝 Tessia Prompt Builder')
      .setDescription(
        `I've crafted a starting template for your prompt! 🌸\n` +
        `Read it below, and reply to this message with your answers/feedback to refine it iteratively.`
      )
      .setFooter({ text: 'Answer the questions or type feedback to refine! ✨' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prompt_exit')
        .setLabel('Exit Prompt Builder')
        .setStyle(ButtonStyle.Danger)
    );

    // If draft is too long for embed, send it in content, and questions in embed
    if (draft.length > 1800) {
      await interaction.editReply({ embeds: [embed] });
      await interaction.followUp({ content: `**Draft Prompt & Questions:**\n${draft}`, components: [row] });
    } else {
      await interaction.editReply({ content: `Here is the first draft:\n\n${draft}`, embeds: [embed], components: [row] });
    }
  },

  async executeMessage(message, args) {
    const username = message.author.username;
    const task = args.join(' ');

    if (!task) {
      return message.reply("Please describe what task you want the prompt to do! e.g., `@Tessia prompt-builder write a YouTube script generator` 🌸");
    }

    if (message.client.activePromptSessions.has(username)) {
      return message.reply("You already have an active prompt building session! Answer the questions or type `exit` to close it.");
    }

    await message.channel.sendTyping();
    const draft = await generatePromptDraft(task);
    if (!draft) {
      return message.reply("Something went wrong while generating the prompt, gomen! 😰");
    }

    message.client.activePromptSessions.set(username, {
      task,
      currentPrompt: draft,
      history: [{ role: 'assistant', content: draft }]
    });

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📝 Tessia Prompt Builder')
      .setDescription(
        `I've crafted a starting template for your prompt! 🌸\n` +
        `Read it below, and reply to me with your answers/feedback to refine it iteratively.`
      )
      .setFooter({ text: 'Answer the questions or type feedback to refine! ✨' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prompt_exit')
        .setLabel('Exit Prompt Builder')
        .setStyle(ButtonStyle.Danger)
    );

    await message.reply({ content: `Here is the first draft:\n\n${draft}`, embeds: [embed], components: [row] });
  },
  generatePromptDraft
};
