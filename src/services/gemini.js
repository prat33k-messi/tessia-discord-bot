require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function generateGeminiCompletion(systemPrompt, history, currentQuery, nickname, username, temperature = 0.85, maxTokens = 1024) {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Format history messages for Gemini API
  const formattedContents = [];

  if (history && Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role === 'user') {
        formattedContents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === 'assistant') {
        formattedContents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }
  }

  // Append current user message
  const userText = `[Username: ${username}, Nickname: ${nickname}]: ${currentQuery}`;
  formattedContents.push({
    role: 'user',
    parts: [{ text: userText }]
  });

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMessage = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Gemini API Error: ${errMessage}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  if (!candidate || !candidate.content?.parts?.[0]?.text) {
    throw new Error("Gemini returned empty candidate content.");
  }

  return candidate.content.parts[0].text;
}

module.exports = {
  generateGeminiCompletion,
  GEMINI_MODEL
};
