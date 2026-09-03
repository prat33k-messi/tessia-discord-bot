const { REST, Routes, ActivityType } = require('discord.js');
const { db } = require('../config');
const { checkAndPostNews } = require('../services/news');
const { initReminderService } = require('../services/reminder');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`>>> Logged in as ${client.user.tag}! <<<`);

    // Set explicit Discord Online presence and status badge
    try {
      client.user.setPresence({
        activities: [{ name: 'over AniPedia 🌸 | @Tessia', type: ActivityType.Watching }],
        status: 'online'
      });
      console.log('Bot presence set to Online (Watching over AniPedia 🌸 | @Tessia)');
    } catch (presenceErr) {
      console.error('Error setting bot presence:', presenceErr);
    }

    // 1. Preload memories from Firestore
    if (db) {
      try {
        const snapshot = await db.collection('memories').get();
        snapshot.forEach(doc => {
          const data = doc.data();
          client.preloadedMemories.set(doc.id, {
            facts: data.facts || [],
            warnings: data.warnings || 0,
            affection: typeof data.affection === 'number' ? data.affection : 50,
            mood: data.mood || 'Friendly & Warm'
          });
        });
        console.log(`Preloaded memories for ${client.preloadedMemories.size} users.`);
      } catch (err) {
        console.error("Error preloading memories:", err);
      }

      // Preload AFK statuses with full mentions and avatarUrl
      try {
        const afkSnapshot = await db.collection('afk_status').get();
        afkSnapshot.forEach(doc => {
          const data = doc.data();
          const afkObj = {
            userId: data.userId || doc.id,
            username: data.username || doc.id,
            nickname: data.nickname || data.username || 'User',
            reason: data.reason || 'No reason given',
            timestamp: data.timestamp || Date.now(),
            avatarUrl: data.avatarUrl || null,
            mentions: data.mentions || []
          };
          client.afkUsers.set(doc.id, afkObj);
          if (data.username) client.afkUsers.set(data.username, afkObj);
          if (data.userId) client.afkUsers.set(data.userId, afkObj);
        });
        console.log(`Preloaded AFK statuses for ${afkSnapshot.size} users.`);
      } catch (err) {
        console.error("Error preloading AFK statuses:", err);
      }
    }

    // Initialize Reminder Service
    try {
      await initReminderService(client);
    } catch (err) {
      console.error("Error initializing reminder service:", err);
    }

    // 2. Register Slash Commands globally
    const commandsJson = [];
    client.commands.forEach(command => {
      commandsJson.push(command.data.toJSON());
    });

    const rawToken = process.env.DISCORD_TOKEN || '';
    const cleanedToken = rawToken.replace(/[\r\n\s"']/g, '');
    const rest = new REST({ version: '10' }).setToken(cleanedToken);
    try {
      console.log('Started refreshing application (/) commands...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commandsJson }
      );
      console.log('Successfully reloaded application (/) commands!');
    } catch (error) {
      console.error('Error refreshing slash commands:', error);
    }

    // 3. News Auto-Post Cron (Disabled - news is only fetched on user request)
    // Users can still ask '@Tessia news' anytime on demand!
  }
};
