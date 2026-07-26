require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function generateGeminiCompletion(systemPrompt, history, currentQuery, nickname, username, temperature = 0.85, maxTokens = 1024) {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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
