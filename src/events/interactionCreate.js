const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildRankingMatchEmbed, buildRankingRevealEmbed, getActionRow } = require('../commands/games/blind-ranking');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: 'There was an error while executing this command! 😰', ephemeral: true });
        } else {
          await interaction.reply({ content: 'There was an error while executing this command! 😰', ephemeral: true });
        }
      }
      return;
    }

    // 2. Handle String Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'help_select') {
        const value = interaction.values[0];
        const embed = new EmbedBuilder().setColor(0x9B59B6).setTimestamp();

        if (value === 'help_general') {
          embed.setTitle('💬 General Commands')
            .setDescription(
              `Here is the list of general utility commands:\n\n` +
              `• \`/help\` — Open this help directory\n` +
              `• \`/ping\` — Test bot latency and connection speed\n` +
              `• \`/profile\` — View facts and memories I have saved about you\n` +
              `• \`/afk [reason]\` — Mark yourself as AFK. I'll notify anyone who mentions you!`
            );
        } else if (value === 'help_games') {
          embed.setTitle('🎮 Game Commands')
            .setDescription(
              `Engage in interactive mini-games:\n\n` +
              `• \`/character-guess\` — Start guessing a popular character from AniList with hints\n` +
              `• \`/blind-ranking\` — Start an 8-anime blind ranking tournament with click buttons!`
            );
        } else if (value === 'help_admin') {
          embed.setTitle('📰 Admin Commands')
            .setDescription(
              `Configuration options for server administrators:\n\n` +
              `• \`/setnews [channel]\` — Bind automated news feed updates to a specific channel\n` +
              `• \`/newstest\` — Post a test article from the latest feed to verify setup`
            );
        }

        await interaction.update({ embeds: [embed] });
      }
      return;
    }

    // 3. Handle Button Interactions
    if (interaction.isButton()) {
      const username = interaction.user.username;
      
      // character-guess buttons
      if (interaction.customId === 'game_hint' || interaction.customId === 'game_giveup') {
        const game = interaction.client.activeGames.get(username);
        if (!game) {
          return interaction.reply({ content: "You don't have an active game running! Type `/character-guess` to start one. 🌸", ephemeral: true });
        }

        if (interaction.customId === 'game_hint') {
          game.currentHintIndex++;
          if (game.currentHintIndex >= game.hints.length) {
            return interaction.reply({ content: "No more hints available! Try making a guess! 🧐", ephemeral: true });
          }

          const hintList = [];
          for (let i = 0; i <= game.currentHintIndex; i++) {
            hintList.push(`**Hint ${i + 1}:** ${game.hints[i]}`);
          }

          const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎮 Guess the Anime Character!')
            .setDescription(`I've picked a popular character. Can you guess who they are?\n\n${hintList.join('\n')}`)
            .setFooter({ text: 'Type your guess in chat!' });

          // Disable hint button if final hint reached
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('game_hint')
              .setLabel('Need Hint')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(game.currentHintIndex === game.hints.length - 1),
            new ButtonBuilder()
              .setCustomId('game_giveup')
              .setLabel('Give Up')
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.update({ embeds: [embed], components: [row] });
        } else if (interaction.customId === 'game_giveup') {
          interaction.client.activeGames.delete(username);
          const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Game Ended')
            .setDescription(`You gave up! The character was **${game.character}** from *${game.mediaTitle}*. 🌸`);
          await interaction.update({ embeds: [embed], components: [] });
        }
        return;
      }

      // prompt-builder exit button
      if (interaction.customId === 'prompt_exit') {
        const session = interaction.client.activePromptSessions.get(username);
        if (!session) {
          return interaction.reply({ content: "You don't have an active prompt session running! 🌸", ephemeral: true });
        }
        interaction.client.activePromptSessions.delete(username);
        await interaction.update({ content: `❌ Prompt building session closed. Here is your final prompt:\n\n${session.currentPrompt}`, embeds: [], components: [] });
        return;
      }

      // blind-ranking buttons
      if (interaction.customId === 'rank_vote_a' || interaction.customId === 'rank_vote_b' || interaction.customId === 'rank_cancel') {
        const rankingGame = interaction.client.activeRankingGames.get(username);
        if (!rankingGame) {
          return interaction.reply({ content: "You don't have an active tournament running! Type `/blind-ranking` to start one. 🏆", ephemeral: true });
        }

        if (interaction.customId === 'rank_cancel') {
          interaction.client.activeRankingGames.delete(username);
          await interaction.update({ content: `❌ Tournament cancelled! Play again anytime. 🌸`, embeds: [], components: [] });
          return;
        }

        const currentMatch = rankingGame.bracket[rankingGame.matchIndex];
        const winner = interaction.customId === 'rank_vote_a' ? currentMatch[0] : currentMatch[1];
        const loser = interaction.customId === 'rank_vote_a' ? currentMatch[1] : currentMatch[0];

        rankingGame.winners.push(winner);
        rankingGame.lastLoser = loser;
        rankingGame.matchIndex++;

        // Check if current round is complete
        if (rankingGame.matchIndex >= rankingGame.bracket.length) {
          if (rankingGame.winners.length === 1) {
            // Champion emerge!
            const champion = rankingGame.winners[0];
            const runnerUp = rankingGame.lastLoser;
            interaction.client.activeRankingGames.delete(username);

            const revealEmbed = buildRankingRevealEmbed(champion, runnerUp);
            await interaction.update({
              content: `🎉 **The blind tournament is over!** Your taste has spoken! ✨`,
              embeds: revealEmbed ? [revealEmbed] : [],
              components: []
            });
            return;
          }

          // Next round setup
          const nextBracket = [];
          for (let i = 0; i < rankingGame.winners.length; i += 2) {
            nextBracket.push([rankingGame.winners[i], rankingGame.winners[i + 1]]);
          }
          rankingGame.round++;
          rankingGame.bracket = nextBracket;
          rankingGame.matchIndex = 0;
          rankingGame.winners = [];
        }

        // Show next match
        const nextMatch = rankingGame.bracket[rankingGame.matchIndex];
        const roundName = rankingGame.round === 1 ? 'Quarterfinals' : rankingGame.round === 2 ? 'Semifinals' : 'Final';
        const matchEmbed = buildRankingMatchEmbed(nextMatch[0], nextMatch[1], rankingGame.round, rankingGame.matchIndex + 1);
        const row = getActionRow(nextMatch[0].blindLabel, nextMatch[1].blindLabel);

        await interaction.update({
          content: `✅ **${winner.blindLabel}** advances! Next up — **${roundName}** 🔥`,
          embeds: [matchEmbed],
          components: [row]
        });
      }
    }
  }
};
