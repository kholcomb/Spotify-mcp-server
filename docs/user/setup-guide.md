# Spotify MCP Server Setup Guide

This guide will help you set up and configure the Spotify MCP Server for use with AI assistants like Claude Desktop.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18.0 or later** installed on your system
- **Spotify Premium account** (required for playback control features)
- **Spotify Developer account** (free to create)

## Step 1: Create Spotify Developer Application

1. **Visit the Spotify Developer Dashboard**
   - Go to [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   - Log in with your Spotify account

2. **Create a New App**
   - Click "Create app"
   - Fill in the app details:
     - **App name**: Choose any name (e.g., "My MCP Server")
     - **App description**: Brief description of your usage
     - **Redirect URI**: `http://localhost:8080/callback`
     - **Which API/SDKs are you planning to use?**: Select "Web API"
   - Agree to the terms and click "Save"

3. **Get Your Credentials**
   - Click on your newly created app
   - Click "Settings" 
   - Note down your **Client ID** and **Client Secret** (click "View client secret")

## Step 2: Install the MCP Server

### Download and Install

```bash
# Clone or download the Spotify MCP Server
cd /path/to/your/projects
# [Installation method will depend on distribution]

# Install dependencies
npm install
```

### Configure Environment Variables

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file:**
   ```bash
   nano .env  # or use your preferred editor
   ```

3. **Add your Spotify credentials:**
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_from_step_1
   SPOTIFY_CLIENT_SECRET=your_client_secret_from_step_1
   SPOTIFY_REDIRECT_URI=http://localhost:8080/callback
   LOG_LEVEL=info
   ```

## Step 3: Configure Your MCP Client

The setup depends on which MCP client you're using:

### For Claude Desktop

1. **Locate your Claude Desktop configuration file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Add the Spotify MCP Server configuration:**
   ```json
   {
     "mcpServers": {
       "spotify": {
         "command": "node",
         "args": ["/path/to/spotify-mcp-server/build/index.js"],
         "env": {
           "SPOTIFY_CLIENT_ID": "your_client_id",
           "SPOTIFY_CLIENT_SECRET": "your_client_secret",
           "SPOTIFY_REDIRECT_URI": "http://localhost:8080/callback"
         }
       }
     }
   }
   ```

3. **Replace `/path/to/spotify-mcp-server/` with the actual path to your installation**

### For Other MCP Clients

Refer to your MCP client's documentation for adding MCP servers. You'll need:
- **Command**: `node`
- **Args**: `["/path/to/spotify-mcp-server/build/index.js"]`
- **Environment variables**: Your Spotify credentials

## Step 4: Build and Test

1. **Build the server:**
   ```bash
   npm run build
   ```

2. **Test the server directly:**
   ```bash
   npm run dev
   ```
   
   You should see output like:
   ```
   {"timestamp":"2025-06-25T15:00:00Z","level":"INFO","component":"spotify-mcp-server","message":"Starting Spotify MCP Server..."}
   {"timestamp":"2025-06-25T15:00:00Z","level":"INFO","component":"spotify-mcp-server","message":"Configuration loaded successfully"}
   ```

3. **Restart your MCP client** (e.g., Claude Desktop)

## Step 5: First-Time Authentication

When you first use a Spotify command through your AI assistant:

1. **The server will provide an authentication URL**
   - You'll see a message like: "Please visit this URL to authorize: https://accounts.spotify.com/authorize?..."

2. **Open the URL in your browser**
   - You'll be redirected to Spotify's authorization page
   - Log in with your Spotify account if prompted
   - Click "Agree" to authorize the application

3. **Complete the authorization**
   - You'll be redirected to `http://localhost:8080/callback`
   - You should see a success message
   - Return to your AI assistant - it should now have access to your Spotify account

## Step 6: Test Basic Functionality

Try these commands with your AI assistant:

1. **Get current playback:**
   ```
   "What's currently playing on Spotify?"
   ```

2. **Search for music:**
   ```
   "Search Spotify for songs by The Beatles"
   ```

3. **Control playback (Premium required):**
   ```
   "Pause my Spotify music"
   "Play the next song"
   "Set volume to 50%"
   ```

## Troubleshooting

### Common Issues

#### "Configuration validation failed"
- **Solution**: Check that all required environment variables are set in your `.env` file
- Ensure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are correct

#### "Authentication failed" or "Token expired"
- **Solution**: Delete any stored token files and re-authenticate
- Check that your Spotify app's redirect URI matches exactly: `http://localhost:8080/callback`

#### "Premium required" errors
- **Solution**: Spotify Premium subscription is required for playback control features
- Search and user data features work with free accounts

#### "Server not responding"
- **Solution**: 
  - Check that the build completed successfully: `npm run build`
  - Verify the path in your MCP client configuration is correct
  - Check server logs: `npm run dev` to see detailed output

#### Rate limiting issues
- **Solution**: The server automatically handles rate limiting, but if you see frequent rate limit errors:
  - Reduce the frequency of requests
  - The server will automatically retry after rate limit periods

### Getting Help

1. **Check the server logs:**
   ```bash
   npm run dev
   ```
   This will show detailed logging that can help identify issues.

2. **Verify your Spotify app settings:**
   - Ensure the redirect URI is exactly: `http://localhost:8080/callback`
   - Verify your client ID and secret are correct

3. **Test your Spotify API access:**
   - Try logging into [Spotify Web Player](https://open.spotify.com) to ensure your account is working

## Advanced Configuration

### Custom Redirect URI

If you need to use a different redirect URI:

1. **Update your Spotify app settings** in the Developer Dashboard
2. **Update your `.env` file:**
   ```env
   SPOTIFY_REDIRECT_URI=https://your-domain.com/callback
   ```
3. **Update your MCP client configuration** with the new URI

### Logging Configuration

Adjust the logging level in your `.env` file:
```env
LOG_LEVEL=debug  # For detailed debugging
LOG_LEVEL=warn   # For minimal output
```

### Multiple Users

Each MCP client instance can authenticate with a different Spotify account. The server handles multiple concurrent users automatically.

## Security Notes

- **Keep your Client Secret private** - never commit it to version control or share it publicly
- **The redirect URI must match exactly** between your Spotify app settings and server configuration
- **Tokens are encrypted** and stored securely on your local system
- **All communication with Spotify uses HTTPS** for security

## Next Steps

Once set up successfully, you can:
- Use natural language commands to control your Spotify music
- Search and discover new music through your AI assistant
- Manage playlists and queue music for playback
- Access your listening history and user data

For advanced usage and available commands, see the [User Guide](user-guide.md).