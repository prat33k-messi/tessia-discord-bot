const express = require('express');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('Running Tessia on Node.js version:', process.version);

// 1. Initialize Express server for Uptime Robot/Render pinging
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'Tessia Discord Bot (Modular)' });
});

app.listen(PORT, () => {
  console.log(`Express health server running on port ${PORT}`);
});

// 2. Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
});

// 3. Initialize Shared Game Caches and Collections
client.commands = new Collection();
client.afkUsers = new Map();
client.activeGames = new Map();
client.activeRankingGames = new Map();
client.activePromptSessions = new Map();
client.preloadedMemories = new Map();
client.userCooldowns = new Map();
client.lastResponseOpeners = new Map();
client.conversationHistory = new Map();
client.lastDiagnostics = new Map();

// Diagnostic listeners (discord.js v14 auto-reconnects on disconnect — do NOT manually call client.login())
client.on('error', (err) => console.error('Discord client error:', err.message));
client.on('warn', (warning) => console.warn('Discord client warning:', warning));
client.on('shardError', (err) => console.error('Shard error occurred:', err.message));
client.on('shardDisconnect', (event, id) => console.warn(`[Shard ${id}] Disconnected (Code: ${event?.code}). discord.js will auto-reconnect.`));
client.on('shardReconnecting', (id) => console.log(`[Shard ${id}] Reconnecting to Gateway...`));
client.on('shardResume', (id, replayedEvents) => console.log(`[Shard ${id}] Resumed (${replayedEvents} replayed events).`));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// 4. Dynamic Commands Loader
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`[LOADED COMMAND] ${command.data.name} (${folder}/${file})`);
    } else {
      console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

// 5. Dynamic Events Loader
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`[LOADED EVENT] ${event.name} (${file})`);
}

// 6. Log in to Discord
const rawToken = process.env.DISCORD_TOKEN;
if (!rawToken || rawToken.trim() === '') {
  console.error("CRITICAL ERROR: DISCORD_TOKEN is missing or empty in your environment variables!");
  process.exit(1);
}

const cleanedToken = rawToken.trim().replace(/^["']|["']$/g, '');
console.log(`Attempting Discord login (Token length: ${cleanedToken.length}, Prefix: ${cleanedToken.substring(0, 6)}...)...`);

client.login(cleanedToken)
  .then(() => {
    console.log("Discord login promise resolved successfully!");
  })
  .catch(err => {
    console.error("CRITICAL: Discord login FAILED with error:", err.message);
    console.error("Error Code:", err.code || 'N/A');
    console.error("Full error details:", err);
  });

// 7. Keep-alive: Rely on external pinger (cron-job.org) to hit the Express health endpoint.
// Internal self-pinging does NOT prevent Render free tier sleep — only external HTTP traffic counts.
