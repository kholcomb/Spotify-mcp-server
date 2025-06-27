# Spotify MCP Server - DXT Installation Guide

## Overview

The Spotify MCP Server is now available as a Desktop Extension (DXT) package for easy one-click installation in AI desktop applications.

## Quick Installation

1. **Download** the `spotify-mcp-server.dxt` file from the releases
2. **Open** the .dxt file with your DXT-compatible AI application
3. **Configure** your Spotify API credentials when prompted
4. **Start using** Spotify commands with your AI assistant!

## Setup Requirements

### 1. Spotify Developer Account

Before installation, you'll need to create a Spotify app:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Fill in the details:
   - **App Name**: "My AI Assistant" (or any name you prefer)
   - **App Description**: "MCP integration for AI assistant"
   - **Redirect URI**: `http://127.0.0.1:8080/callback`
   - **Website**: Leave blank or add your own
   - **Which API/SDKs are you planning to use?**: Select "Web API"
4. Accept the Terms of Service and click "Save"
5. Note down your **Client ID** and **Client Secret**

### 2. DXT Installation Process

When you open the `spotify-mcp-server.dxt` file, you'll be prompted to configure:

#### Required Settings:
- **Spotify Client ID**: Your app's client ID from step 1
- **Spotify Client Secret**: Your app's client secret from step 1

#### Optional Settings:
- **Spotify Redirect URI**: Leave as default (`http://127.0.0.1:8080/callback`) unless you changed it in your Spotify app

## Using the Server

Once installed and configured, you can control Spotify with natural language:

### Music Playback
- "Play some jazz music"
- "Pause the music"
- "Skip to the next song"
- "Set volume to 70%"

### Search and Discovery
- "Search for songs by Taylor Swift"
- "Find the album 'Dark Side of the Moon'"
- "Show me playlists with 'workout' in the name"

### Queue Management
- "Add this song to my queue"
- "What's in my queue?"
- "Clear the queue"

### Music Analytics
- "Show me my top tracks from this year"
- "What are my most played artists?"
- "Analyze the audio features of my current song"

### Library Access
- "Show me my saved songs"
- "What albums have I saved?"
- "List the artists I follow"

## Troubleshooting

### Common Issues

**"Authentication failed"**
- Verify your Client ID and Client Secret are correct
- Ensure the Redirect URI in your Spotify app matches the configured value
- Try re-authenticating through the server

**"Premium required" errors**
- Some features (playback control, queue management) require Spotify Premium
- Search and library access work with free accounts

**"No active device" errors**
- Open Spotify on any device (phone, computer, web player)
- Start playing something briefly to activate the device
- The server can then control that device

### Getting Help

- Check the [GitHub Issues](https://github.com/kholcomb/Spotify-mcp-server/issues) for known problems
- Review the [API Documentation](docs/api/README.md) for technical details
- Ensure you're using a supported AI application with DXT support

## Features Overview

### 🎵 Playback Control (Premium Required)
- Play, pause, skip tracks
- Volume and playback mode control
- Device switching and management

### 🔍 Search & Discovery (All Accounts)
- Search tracks, albums, artists, playlists
- Get music recommendations
- Browse Spotify catalog

### 📊 Music Analytics (All Accounts)
- View your top tracks and artists
- Analyze audio features of songs
- Browse your music library and followed artists

### 🔐 Secure Authentication
- OAuth 2.0 with PKCE for secure login
- Encrypted credential storage
- Automatic token refresh

## Privacy & Security

- Your Spotify credentials are stored securely by the DXT runtime
- The server only accesses your Spotify data when you make requests
- No data is sent to external servers beyond Spotify's API
- Authentication tokens are automatically refreshed as needed

For technical implementation details, see the [main README](README.md).