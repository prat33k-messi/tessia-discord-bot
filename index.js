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

// Diagnostic listeners
client.on('error', (err) => console.error('Discord client error:', err));
client.on('warn', (warning) => console.warn('Discord client warning:', warning));
client.on('shardError', (err) => console.error('Shard error occurred:', err));

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
if (!process.env.DISCORD_TOKEN) {
  console.error("CRITICAL ERROR: DISCORD_TOKEN is missing in your environment variables!");
  process.exit(1);
}

console.log("Attempting Discord login...");
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("Discord login successful!"))
  .catch(err => {
    console.error("CRITICAL: Discord login FAILED!", err.message);
    console.error("Full error:", err);
  });

// 7. Keep-alive self-ping every 4 minutes to prevent Render free tier spin-down
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://tessia-discord-bot-hebl.onrender.com';
setInterval(() => {
  fetch(RENDER_URL).catch(() => {});
}, 240000); // 4 minutes
