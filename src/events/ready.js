const { REST, Routes } = require('discord.js');
const { db } = require('../config');
const { checkAndPostNews } = require('../services/news');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}!`);

    // 1. Preload memories from Firestore
    if (db) {
      try {
        const snapshot = await db.collection('memories').get();
        snapshot.forEach(doc => {
          const data = doc.data();
          client.preloadedMemories.set(doc.id, {
            facts: data.facts || [],
            warnings: data.warnings || 0
          });
        });
        console.log(`Preloaded memories for ${client.preloadedMemories.size} users.`);
      } catch (err) {
        console.error("Error preloading memories:", err);
      }

      // Preload AFK statuses
      try {
        const afkSnapshot = await db.collection('afk_status').get();
        afkSnapshot.forEach(doc => {
          const data = doc.data();
          client.afkUsers.set(doc.id, {
            reason: data.reason,
            timestamp: data.timestamp,
            nickname: data.nickname
          });
        });
        console.log(`Preloaded AFK statuses for ${client.afkUsers.size} users.`);
      } catch (err) {
        console.error("Error preloading AFK statuses:", err);
      }
    }

    // 2. Register Slash Commands globally
    const commandsJson = [];
    client.commands.forEach(command => {
      commandsJson.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
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

    // 3. News Auto-Post Cron
    setTimeout(() => {
      checkAndPostNews(client).catch(err => console.error('Initial news check failed:', err));
    }, 5000);

    setInterval(() => {
      checkAndPostNews(client).catch(err => console.error('Cron news check failed:', err));
    }, 1200000); // 20 minutes
  }
};
