require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

async function generateGeminiCompletion(systemPrompt, history, currentQuery, nickname, username, temperature = 0.85, maxTokens = 1024) {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Skipping to Groq.");
  }

  // Format history messages for Gemini API ensuring strictly alternating roles
  const formattedContents = [];

  if (history && Array.isArray(history)) {
    for (const msg of history) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === role) {
        // Merge consecutive same-role messages
        formattedContents[formattedContents.length - 1].parts[0].text += `\n${msg.content}`;
      } else {
        formattedContents.push({
          role: role,
          parts: [{ text: msg.content }]
        });
      }
    }
  }

  // Ensure current user message is included at the end
  const userText = `[Username: ${username}, Nickname: ${nickname}]: ${currentQuery}`;
  if (formattedContents.length === 0) {
    formattedContents.push({
      role: 'user',
      parts: [{ text: userText }]
    });
  } else if (formattedContents[formattedContents.length - 1].role === 'model') {
    formattedContents.push({
      role: 'user',
      parts: [{ text: userText }]
    });
  }

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: formattedContents,
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens
    }
  };

  const modelsToTry = [GEMINI_MODEL, 'gemini-3.5-flash-lite'];
  let lastError = null;

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        }

        const isRateLimitOrOverload = response.status === 429 || response.status === 503;
        if (isRateLimitOrOverload && attempts < maxAttempts) {
          console.warn(`[Gemini API - ${model}] Received HTTP ${response.status}. Retrying in 1200ms...`);
          await new Promise(res => setTimeout(res, 1200));
          continue;
        }

        const errorData = await response.json().catch(() => ({}));
        lastError = new Error(`Gemini (${model}) Error: ${errorData?.error?.message || `HTTP ${response.status}`}`);
        break; // Try next model in modelsToTry
      } catch (networkErr) {
        lastError = networkErr;
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini model endpoints failed.");
}

module.exports = {
  generateGeminiCompletion,
  GEMINI_MODEL
};
