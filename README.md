# Tessia Discord Bot

Tessia is a friendly and highly intelligent AI Discord chatbot powered by the **Groq API** (using the `llama-3.3-70b-versatile` model for excellent memory and response quality) and hosted **24/7 for free**.

---

## Features
- **Smart Conversations**: Powered by Groq's high-speed and smart LLMs.
- **Context Memory**: Remembers the context of the conversation in each channel (up to the last 15 messages).
- **Discord Formatting**: Styled using bolding, code blocks, lists, and markdown.
- **Direct Mentions**: Responds only when direct-mentioned (e.g. `@Tessia Hello!`) so it doesn't spam channels.
- **Memory Reset Command**: Clean the memory of the bot at any time by typing `@Tessia reset`.
- **24/7 Free Hosting Support**: Fully optimized for deployment on Render's free tier with a built-in health check web server.

---

## Step-by-Step Setup Guide

### Step 1: Set Up the Discord Developer Portal
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. You should see your application **Tessia** (or create one using **New Application**).
3. Navigate to the **Bot** tab on the left sidebar:
   - Scroll down to the **Privileged Gateway Intents** section.
   - Enable **Message Content Intent** (This allows the bot to read messages so it can process mentions). *This is crucial!*
   - Click **Save Changes**.
   - Scroll up to the top of the **Bot** tab and click **Reset Token**. Copy the token and save it safely. (This is your `DISCORD_TOKEN`).
4. Navigate to the **OAuth2** tab, then click **URL Generator** on the left menu:
   - Under **Scopes**, check the box for `bot`.
   - Under **Bot Permissions**, check:
     - `Read Messages/View Channels`
     - `Send Messages`
     - `Embed Links`
     - `Read Message History`
   - Scroll to the bottom and copy the generated URL.
   - Paste the URL into your browser, choose your Discord server, and authorize the bot.

---

### Step 2: Get Your Groq API Key
1. Go to the [Groq Console](https://console.groq.com/).
2. Create a free account or log in.
3. Click on **API Keys** on the left menu.
4. Click **Create API Key**, name it `Discord Bot`, and copy the key. (This is your `GROQ_API_KEY`).

---

### Step 3: Run the Bot Locally (Optional Test)
To verify everything works before uploading to the hosting server:
1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Open terminal in this folder and install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory (based on `.env.example`) and paste your keys:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   PORT=3000
   ```
4. Start the bot:
   ```bash
   npm start
   ```
5. In your Discord server, mention your bot (e.g., `@Tessia Hello there!`) and make sure it responds.

---

### Step 4: Host 24/7 on Render (100% Free)
Render is a cloud hosting service that has a free tier. We will use it to host our bot.

1. **Push your code to GitHub**:
   - Create a **Private** repository on [GitHub](https://github.com).
   - Commit and push this directory (excluding `node_modules` and `.env` since they are blocked by `.gitignore`).
2. **Sign up on Render**:
   - Go to [Render](https://render.com) and sign up using your GitHub account.
3. **Deploy Web Service**:
   - Click **New +** at the top right of the Render dashboard and select **Web Service**.
   - Connect the repository you just pushed.
   - Enter these settings:
     - **Name**: `tessia-discord-bot`
     - **Region**: Select the closest to you.
     - **Branch**: `main` (or your default branch)
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: `Free`
4. **Configure Environment Variables**:
   - Scroll down and click **Advanced** -> **Add Environment Variable**.
   - Add the following keys:
     - `DISCORD_TOKEN` = `(Your copied Discord token)`
     - `GROQ_API_KEY` = `(Your copied Groq API key)`
     - `GROQ_MODEL` = `llama-3.3-70b-versatile`
5. Click **Create Web Service**.
6. Once deployed, copy your web service URL from the top-left of the page (it will look like `https://tessia-discord-bot-xxxx.onrender.com`).

---

### Step 5: Keep the Bot Awake 24/7 using UptimeRobot
Render's free tier web services put the app to sleep if it does not receive any web requests for 15 minutes. To prevent this, we'll set up a free service to ping our health page every 5 minutes.

1. Go to [UptimeRobot](https://uptimerobot.com) and sign up for a free account.
2. Go to the dashboard and click **Add New Monitor**.
3. Configure the monitor:
   - **Monitor Type**: `HTTPS`
   - **Friendly Name**: `Tessia Bot`
   - **URL (or IP)**: `https://tessia-discord-bot-xxxx.onrender.com` (Use the URL you copied from Render)
   - **Monitoring Interval**: `Every 5 minutes`
4. Click **Create Monitor** (and confirm).

Now, UptimeRobot will ping the bot's Express server every 5 minutes, ensuring the bot never goes to sleep and remains active 24/7!
