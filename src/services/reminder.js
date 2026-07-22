const { EmbedBuilder } = require('discord.js');
const { db } = require('../config');
const { formatDuration } = require('../utils/helpers');

// Helper to parse time duration and extract text from raw user query
function parseReminderInput(input) {
  let text = input.trim();

  // Regex to match duration components like "1d", "2 hours", "10 mins", "30s", "in 5 minutes"
  const timeRegex = /\b(?:in\s+)?(\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi;

  let totalMs = 0;
  let matches = [];
  let match;

  while ((match = timeRegex.exec(input)) !== null) {
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    matches.push(match[0]);

    if (unit.startsWith('d')) {
      totalMs += val * 86400000;
    } else if (unit.startsWith('h')) {
      totalMs += val * 3600000;
    } else if (unit.startsWith('m')) {
      totalMs += val * 60000;
    } else if (unit.startsWith('s')) {
      totalMs += val * 1000;
    }
  }

  if (totalMs <= 0) {
    return { error: "Please specify a valid time! (e.g. `10m`, `2h`, `1d`, `30s`, or `in 15 minutes`)" };
  }

  // Remove matched time phrases from text
  matches.forEach(m => {
    text = text.replace(m, '');
  });

  // Strip action prefixes, bot names, and prepositions
  text = text
    .replace(/^tessia\s+/gi, '')
    .replace(/\b(?:set\s+)?(?:reminder|remainder)\b/gi, '')
    .replace(/\bremind\s+(?:me\s+)?(?:to\s+)?/gi, '')
    .replace(/\b(?:in|at|for|to)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    text = "Check your scheduled reminder!";
  }

  return { text, delayMs: totalMs };
}

// Create and save a new reminder
async function createReminder(client, userId, username, nickname, channelId, text, delayMs) {
  const createdAt = Date.now();
  const remindAt = createdAt + delayMs;
  const id = `rem_${createdAt}_${Math.random().toString(36).substr(2, 5)}`;

  const reminder = {
    id,
    userId,
    username,
    nickname,
    channelId,
    text,
    createdAt,
    remindAt
  };

  // Cache in client Map
  if (!client.reminders) {
    client.reminders = new Map();
  }
  client.reminders.set(id, reminder);

  // Persist to Firestore
  if (db) {
    try {
      await db.collection('reminders').doc(id).set(reminder);
    } catch (err) {
      console.error("Error saving reminder to Firestore:", err);
    }
  }

  return reminder;
}

// Check and trigger all pending reminders
async function checkAndSendReminders(client) {
  if (!client.reminders || client.reminders.size === 0) return;

  const now = Date.now();
  const toProcess = [];

  for (const [id, reminder] of client.reminders) {
    if (reminder.remindAt <= now) {
      toProcess.push(reminder);
    }
  }

  for (const reminder of toProcess) {
    try {
      // 1. Fetch user to send DM
      let user = client.users.cache.get(reminder.userId);
      if (!user) {
        try {
          user = await client.users.fetch(reminder.userId);
        } catch (e) {
          console.error(`Could not fetch user ${reminder.userId} for reminder:`, e);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF69B4)
        .setTitle('⏰ Reminder from Tessia!')
        .setDescription(`Hii **${reminder.nickname || reminder.username}**! You asked me to remind you:\n\n> 📌 **${reminder.text}**`)
        .addFields(
          { name: '⏳ Scheduled', value: `<t:${Math.floor(reminder.createdAt / 1000)}:R>`, inline: true },
          { name: '⏰ Triggered At', value: `<t:${Math.floor(Date.now() / 1000)}:t>`, inline: true }
        )
        .setFooter({ text: 'Tessia Reminder System • Anipedia 🌸' })
        .setTimestamp();

      let dmSent = false;
      if (user) {
        try {
          await user.send({ embeds: [embed] });
          dmSent = true;
        } catch (dmErr) {
          console.warn(`Could not send DM reminder to ${reminder.username} (DMs closed?):`, dmErr.message);
        }
      }

      // If DM failed, try fallback to original channel
      if (!dmSent && reminder.channelId) {
        try {
          const channel = await client.channels.fetch(reminder.channelId);
          if (channel) {
            await channel.send({
              content: `⏰ <@${reminder.userId}> **Reminder:** ${reminder.text} *(I tried sending you a DM, but your DMs are closed!)*`,
              embeds: [embed]
            });
          }
        } catch (chanErr) {
          console.error(`Could not send channel fallback reminder:`, chanErr.message);
        }
      }
    } catch (err) {
      console.error(`Error processing reminder ${reminder.id}:`, err);
    } finally {
      // Delete reminder from cache and Firestore
      client.reminders.delete(reminder.id);
      if (db) {
        db.collection('reminders').doc(reminder.id).delete().catch(e => console.error("Error deleting reminder from Firestore:", e));
      }
    }
  }
}

// Initialize reminder service (preloads from Firestore and sets interval)
async function initReminderService(client) {
  if (!client.reminders) {
    client.reminders = new Map();
  }

  // Preload from Firestore
  if (db) {
    try {
      const snapshot = await db.collection('reminders').get();
      snapshot.forEach(doc => {
        const data = doc.data();
        client.reminders.set(doc.id, data);
      });
      console.log(`Preloaded ${client.reminders.size} active reminders from Firestore.`);
    } catch (err) {
      console.error("Error preloading reminders from Firestore:", err);
    }
  }

  // Check immediately, then check every 10 seconds
  checkAndSendReminders(client).catch(err => console.error("Initial reminder check failed:", err));

  setInterval(() => {
    checkAndSendReminders(client).catch(err => console.error("Interval reminder check failed:", err));
  }, 10000);
}

module.exports = {
  parseReminderInput,
  createReminder,
  checkAndSendReminders,
  initReminderService
};
