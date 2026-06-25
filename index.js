const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { Groq } = require('groq-sdk');
require('dotenv').config();

// Initialize Express server for Uptime Robot pinging
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'Tessia Discord Bot' });
});

app.listen(PORT, () => {
  console.log(`Express health server running on port ${PORT}`);
});

// Initialize Groq API Client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Initialize Firebase Admin SDK
const admin = require('firebase-admin');
let db;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("Firebase Firestore connected successfully!");
} catch (error) {
  console.warn("Firebase initialization skipped or failed. Running in memory-only mode. Details:", error.message);
}

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Conversation memory cache: Map channelId -> Array of message objects
const memory = new Map();
const MAX_MEMORY_LIMIT = 15; // Number of messages to remember for context

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if bot was mentioned
  const botMention = `<@${client.user.id}>`;
  const botNicknameMention = `<@!${client.user.id}>`;
  const isMentioned = message.content.includes(botMention) || message.content.includes(botNicknameMention);

  // Check if message is a reply to the bot
  let isReplyToBot = false;
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (referencedMessage.author.id === client.user.id) {
        isReplyToBot = true;
      }
    } catch (error) {
      console.error("Error fetching referenced message:", error);
    }
  }

  if (!isMentioned && !isReplyToBot) return;

  try {
    // Show typing status to let users know the bot is thinking
    await message.channel.sendTyping();

    // Clean user query by removing the mention string
    let cleanQuery = message.content
      .replace(botMention, '')
      .replace(botNicknameMention, '')
      .trim();

    if (!cleanQuery) {
      await message.reply("Hello! How can I help you today? Mention me with a question to start chatting!");
      return;
    }

    const username = message.author.username;
    const nickname = message.member?.displayName || message.author.displayName || username;
    const channelId = message.channel.id;

    // Check for a reset command
    if (cleanQuery.toLowerCase() === 'reset') {
      memory.set(channelId, []);
      if (db) {
        try {
          await db.collection('memories').doc(username).delete();
          console.log(`Cleared permanent memories for user ${username}`);
        } catch (err) {
          console.error("Error deleting Firestore memories:", err);
        }
      }
      await message.reply("🧹 My memory for this channel and your user profile has been cleared! Let's start fresh.");
      return;
    }

    // Retrieve user memories from Firestore
    let userMemories = [];
    if (db) {
      try {
        const doc = await db.collection('memories').doc(username).get();
        if (doc.exists) {
          userMemories = doc.data().facts || [];
        }
      } catch (err) {
        console.error("Error reading Firestore memories:", err);
      }
    }

    // Retrieve or initialize conversation history for the channel
    if (!memory.has(channelId)) {
      memory.set(channelId, []);
    }
    const history = memory.get(channelId);

    // Build the system prompt
    let systemPromptContent = `You are Tessia, a lively, friendly, and highly intelligent AI assistant in this Discord server. 
Your creator and developer is Aerion (username: _c0rle0ne, pronouns: he/him). If anyone asks about Aerion or _c0rle0ne, proudly mention that Aerion developed you, and address him as "Aerion-sama" with a lot of respect and warmth.
Users will talk to you in the format '[Username: permanent_username, Nickname: server_nickname]: message'. 
Always use their server_nickname when addressing them in your responses (e.g. 'Hello Shreyas!'), EXCEPT for the user with username '_c0rle0ne' whom you must ALWAYS address as "Aerion-sama" (never call him _c0rle0ne or Aerion without -sama). Do not prepend your own responses with 'Tessia:'.
Keep your responses concise, engaging, and brief (avoid long paragraphs unless explicitly asked). 
Use between 1 to 3 emojis in your responses (do not exceed 3 emojis per message). 
Make use of beautiful Discord formatting (bolding, headers, bullet points, code blocks, or quote blocks) to structure your text nicely.
If the user asks you to clear memory, tell them they can type '@Tessia reset'.`;

    if (userMemories.length > 0) {
      systemPromptContent += `\n\nHere are some permanent facts you remember about the user ${nickname} (username: ${username}):\n- ${userMemories.join('\n- ')}`;
    }

    const systemMessage = {
      role: 'system',
      content: systemPromptContent
    };

    // Format new user message
    const userMessage = {
      role: 'user',
      content: `[Username: ${username}, Nickname: ${nickname}]: ${cleanQuery}`,
    };

    // Add user message to history
    history.push(userMessage);

    // Call Groq API
    // Using llama-3.3-70b-versatile for high quality and excellent memory capabilities
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [systemMessage, ...history],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const botResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    // Add assistant response to history
    history.push({
      role: 'assistant',
      content: botResponse,
    });

    // Prune history to respect memory limit
    if (history.length > MAX_MEMORY_LIMIT) {
      // Remove oldest messages but keep history length within limits
      history.splice(0, history.length - MAX_MEMORY_LIMIT);
    }

    // Add a 1-second delay to make it feel natural
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send response in chunks if it exceeds 2000 characters
    if (botResponse.length <= 2000) {
      await message.reply(botResponse);
    } else {
      const chunks = splitMessage(botResponse, 2000);
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          await message.reply(chunks[i]);
        } else {
          await message.channel.send(chunks[i]);
        }
      }
    }

    // Asynchronously extract and store memories in the background
    if (db) {
      extractAndStoreFacts(username, nickname, cleanQuery, userMemories).catch(err => {
        console.error("Error in background memory extraction:", err);
      });
    }

  } catch (error) {
    console.error("Error handling message:", error);
    await message.reply("Oops! I encountered an error while processing your request. Please try again later.");
  }
});

// Background fact extraction helper
async function extractAndStoreFacts(username, nickname, userMessage, currentFacts) {
  try {
    const extractionPrompt = `You are an AI that extracts permanent personal facts about a user from their message.
Existing facts about this user:
${currentFacts.length > 0 ? currentFacts.map(f => `- ${f}`).join('\n') : '(None)'}

New message from user ${nickname} (username: ${username}): "${userMessage}"

Tasks:
1. Extract any new permanent facts (e.g. name, pet, age, location, job, preferences). Ignore temporary statements, questions, or greetings.
2. If the user tells you to forget a fact or if a new fact contradicts an old fact, identify which old fact to remove or update.
3. Output the result strictly in this JSON format:
{
  "newFacts": ["fact1", "fact2"],
  "removeFacts": ["exact old fact to remove"]
}
If no changes, return empty arrays. Output ONLY the JSON block.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // Use the fast 8b model for background extraction
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    let updated = false;
    let facts = [...currentFacts];

    // Remove facts
    if (result.removeFacts && result.removeFacts.length > 0) {
      facts = facts.filter(f => !result.removeFacts.includes(f));
      updated = true;
    }

    // Add new facts
    if (result.newFacts && result.newFacts.length > 0) {
      for (const fact of result.newFacts) {
        if (!facts.includes(fact)) {
          facts.push(fact);
          updated = true;
        }
      }
    }

    if (updated) {
      // limit to maximum 30 facts per user to avoid hitting storage/token limits
      if (facts.length > 30) facts.splice(0, facts.length - 30);
      await db.collection('memories').doc(username).set({
        facts,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`Updated memories for user ${username}:`, facts);
    }
  } catch (err) {
    console.error("Error in background memory extraction:", err);
  }
}

// Helper function to split text into chunks without cutting words
function splitMessage(text, limit) {
  const chunks = [];
  let currentChunk = "";

  const lines = text.split("\n");
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > limit) {
      chunks.push(currentChunk.trim());
      currentChunk = line + "\n";
    } else {
      currentChunk += line + "\n";
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

client.login(process.env.DISCORD_TOKEN);
