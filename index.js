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
client.preloadedMemories = new Map();
client.userCooldowns = new Map();
client.lastResponseOpeners = new Map();
client.conversationHistory = new Map();

// Diagnostic listeners
client.on('error', (err) => console.error('Discord client error:', err));
client.on('warn', (warning) => console.warn('Discord client warning:', warning));
client.on('shardError', (err) => console.error('Shard error occurred:', err));

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

client.login(process.env.DISCORD_TOKEN);
