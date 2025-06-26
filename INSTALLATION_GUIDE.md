# 🎵 Spotify MCP Server - Easy Installation Guide

Control Spotify from Claude Desktop with natural language commands!

## ⚡ Quick Start (5 minutes)

### Prerequisites
- [Claude Desktop](https://claude.ai/download) installed
- [Node.js](https://nodejs.org/) version 18 or higher
- Active Spotify account (Free or Premium)

### Step 1: Download & Setup
```bash
# Download the project
git clone https://github.com/your-username/spotify-mcp-server.git
cd spotify-mcp-server

# Run the automated setup script
npm run setup
```

### Step 2: Create Your Spotify App
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Fill in:
   - **App Name**: "Claude Spotify Control"
   - **App Description**: "MCP server for Claude Desktop"
   - **Redirect URI**: `http://127.0.0.1:8080/callback`
   - **Which API/SDKs are you planning to use?**: Select "Web API"
4. Click "Save"
5. Copy your **Client ID** and **Client Secret**

### Step 3: Configure
```bash
# The setup script will prompt you for:
# - Spotify Client ID (from Step 2)
# - Spotify Client Secret (from Step 2)
# Configuration will be automatically applied to Claude Desktop
```

### Step 4: Start Using
1. Restart Claude Desktop
2. In Claude, say: **"authenticate with spotify"**
3. Open the provided URL and authorize
4. Start controlling Spotify: **"search for your favorite song"**

## 🎯 What You Can Do

Once set up, you can use natural language with Claude:

- **"Search for Bohemian Rhapsody by Queen"**
- **"Play music"** / **"Pause"** / **"Skip to next track"**
- **"Set volume to 50"**
- **"Add this song to my queue"**
- **"Show what's currently playing"**
- **"List my available devices"**
- **"Clear the queue"**

## 🔧 Manual Setup (Advanced)

If you prefer manual setup or the automated script doesn't work:

### 1. Build the Project
```bash
npm install
npm run build
```

### 2. Create Environment File
Create `.env` in the project root:
```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/callback
```

### 3. Configure Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "spotify": {
      "command": "node",
      "args": ["/full/path/to/your/project/build/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "your_client_id_here",
        "SPOTIFY_CLIENT_SECRET": "your_client_secret_here",
        "SPOTIFY_REDIRECT_URI": "http://127.0.0.1:8080/callback"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

## 🆘 Troubleshooting

### Common Issues

**❌ "Server disconnected" errors**
- Make sure Node.js 18+ is installed: `node --version`
- Check that the path in claude_desktop_config.json is correct
- Restart Claude Desktop completely

**❌ "Authentication required" errors**
- Run the authenticate command first: "authenticate with spotify"
- Make sure your Spotify app has the correct redirect URI
- Check that your client ID and secret are correct

**❌ "Validation error" messages**
- Make sure you're using the latest version
- These were common in older versions but should be fixed

**❌ "Method not found" errors**
- This is normal - Claude checks for optional features
- If tools aren't working, check your Claude Desktop config

### Getting Help

1. Check the logs: `/Users/yourname/Library/Logs/Claude/mcp-server-spotify.log`
2. Verify your setup with: `npm run test-connection`
3. Join our [community discussions](https://github.com/your-username/spotify-mcp-server/discussions)

## 🔄 Updates

To update to the latest version:
```bash
git pull
npm install
npm run build
# Restart Claude Desktop
```

## 🛡️ Security Notes

- Your Spotify credentials are stored locally and encrypted
- The server only runs locally - no data is sent to external servers
- OAuth tokens are automatically refreshed and securely stored
- You can revoke access anytime in your [Spotify account settings](https://www.spotify.com/account/apps/)

---

**Enjoy controlling Spotify with Claude! 🎶**

For advanced configuration and features, see our [full documentation](./docs/).