# Spotify MCP Server - DXT Package

This is a Desktop Extension (DXT) package for the Spotify MCP Server, enabling easy installation in AI desktop applications.

## Installation

1. Download the `spotify-mcp-server.dxt` file
2. Open it with your DXT-compatible AI assistant application
3. The server will be installed automatically

## Configuration

After installation, you'll need to set up your Spotify app credentials:

### Required Environment Variables

- `SPOTIFY_CLIENT_ID`: Your Spotify app client ID
- `SPOTIFY_CLIENT_SECRET`: Your Spotify app client secret

### Getting Spotify Credentials

1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Set the redirect URI to: `http://localhost:6178/callback`
4. Copy your Client ID and Client Secret

## Features

- 🎵 Full music playback control (Premium required)
- 🔍 Search for tracks, albums, artists, and playlists
- 📋 Queue management
- 📊 Music analytics and insights
- 🔐 Secure OAuth authentication
- 📱 Multi-device support

## Usage

Once installed and configured, you can use natural language commands:

- "Play some jazz music"
- "Skip to the next song"
- "What's currently playing?"
- "Show me my top tracks"
- "Add this song to my queue"

## Requirements

- Node.js 18 or higher
- Spotify account (Premium recommended for full features)
- Spotify app credentials

## Troubleshooting

If you encounter issues:

1. Ensure Node.js 18+ is installed
2. Verify your Spotify credentials are correct
3. Check that the redirect URI matches in your Spotify app settings
4. For playback control, ensure you have a Spotify Premium account

## Support

For issues and documentation: https://github.com/kholcomb/Spotify-mcp-server