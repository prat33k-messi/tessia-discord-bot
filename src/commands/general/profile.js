const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function buildProfileEmbed(user, member, client, username, nickname) {
  const cache = client.preloadedMemories.get(username) || {};
  const userMemories = cache.facts || [];
  const userAffection = typeof cache.affection === 'number' ? cache.affection : (username === '_c0rle0ne' ? 100 : 50);

  let affectionLabel = "Friendly & Warm";
  if (userAffection >= 90) affectionLabel = "Deepest Bond & Unshakeable Trust ✨";
  else if (userAffection >= 70) affectionLabel = "Close & Cherished Companion 🌸";
  else if (userAffection >= 50) affectionLabel = "Warm & Friendly 💫";
  else affectionLabel = "Slightly Distant & Pouty 🍃";

  const avatarUrl = user.displayAvatarURL({ dynamic: true, size: 256 });
  const isAerion = username === '_c0rle0ne';

  const highestRole = member?.roles?.highest?.name && member.roles.highest.name !== '@everyone'
    ? member.roles.highest.name
    : (isAerion ? 'CEO / Developer 👑' : 'AniPedia Member');

  const allRoles = member?.roles?.cache
    ? member.roles.cache
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(r => `\`${r.name}\``)
    : [];

  const rolesDisplay = allRoles.length > 0
    ? (allRoles.slice(0, 6).join(' ') + (allRoles.length > 6 ? ` *(+${allRoles.length - 6} more)*` : ''))
    : '*No special roles assigned yet.*';

  const memoryDisplay = userMemories.length > 0
    ? userMemories.slice(0, 4).map(f => `🌸 ${f}`).join('\n')
    : '*No recorded memories yet. Chat more with Tessia to build your profile!*';

  const embedColor = isAerion ? 0x9B59B6 : 0xFF77A9; // Purple for Aerion, Sakura Pink for members

  const profileEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setAuthor({ name: `AniPedia Passport • ${nickname}`, iconURL: avatarUrl })
    .setThumbnail(avatarUrl)
    .setDescription(
      `### 🌸 **${nickname}'s Community Card**\n` +
      `> *Official registered member of the AniPedia Universe!* ✨\n\n` +
      `👤 **User:** <@${user.id}> (\`@${user.username}\`)\n` +
      `👑 **Primary Rank:** **${highestRole}**\n` +
      `💖 **Tessia Affection:** \`${userAffection}/100\` — *${affectionLabel}*`
    )
    .addFields(
      {
        name: '📅 Server Member Since',
        value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>\n*(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)*` : '*Unknown*',
        inline: true
      },
      {
        name: '🎂 Discord Birthday',
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>\n*(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)*`,
        inline: true
      },
      {
        name: `📜 Server Roles (${allRoles.length})`,
        value: rolesDisplay,
        inline: false
      },
      {
        name: '🧠 What Tessia Remembers About You',
        value: memoryDisplay,
        inline: false
      }
    )
    .setFooter({
      text: isAerion ? 'AniPedia Creator Card • Master Aerion-sama 🌸' : 'AniPedia Community • Type @Tessia reset to clear memory 🌸',
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  return profileEmbed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your official AniPedia profile card, server roles, and Tessia memories'),
  async execute(interaction) {
    const user = interaction.user;
    const member = interaction.member;
    const client = interaction.client;
    const username = user.username;
    const nickname = member?.displayName || user.displayName || username;

    const embed = buildProfileEmbed(user, member, client, username, nickname);
    await interaction.reply({ embeds: [embed] });
  },
  async executeMessage(message) {
    const user = message.author;
    const member = message.member;
    const client = message.client;
    const username = user.username;
    const nickname = member?.displayName || user.displayName || username;

    const embed = buildProfileEmbed(user, member, client, username, nickname);
    await message.reply({ embeds: [embed] });
  }
};
