# 🎵 Spotify MCP Server

Control Spotify with natural language through Claude Desktop! This Model Context Protocol (MCP) server enables seamless Spotify integration, allowing you to search for music, control playback, manage queues, and more using conversational commands.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/spotify-mcp-server/spotify-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/spotify-mcp-server/spotify-mcp-server/workflows/CI/badge.svg)](https://github.com/spotify-mcp-server/spotify-mcp-server/actions)
[![Security](https://img.shields.io/badge/security-audited-green.svg)](https://github.com/spotify-mcp-server/spotify-mcp-server/security/policy)

## ✨ Features

- 🎯 **Natural Language Control**: "Play Bohemian Rhapsody", "Skip to next track", "Set volume to 50"
- 🔍 **Smart Search**: Find tracks, albums, artists, playlists with flexible queries
- 🎵 **Full Playback Control**: Play, pause, skip, seek, volume, shuffle, repeat
- 📊 **Music Analytics**: Discover your top tracks, artists, and audio feature analysis
- 📱 **Multi-Device Support**: Control any of your Spotify-connected devices
- 🔐 **Secure Authentication**: OAuth 2.0 + PKCE flow with encrypted token storage
- ⚡ **Real-time Updates**: Get current playback status and queue information
- 🛡️ **Enterprise Ready**: Advanced security framework with HSM support, certificate pinning, comprehensive audit logging

## 🚀 Quick Start

### One-Command Setup

```bash
git clone https://github.com/your-username/spotify-mcp-server.git
cd spotify-mcp-server
npm run setup
```

The setup script will:
1. ✅ Install all dependencies
2. ✅ Build the project
3. ✅ Guide you through Spotify app creation
4. ✅ Configure Claude Desktop automatically
5. ✅ Test the connection

### Manual Setup

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for detailed instructions.

## 🎯 What You Can Do

Once set up, use natural language with Claude:

### 🔍 Search & Discovery
- **"Search for Taylor Swift songs"**
- **"Find albums by The Beatles"**
- **"Look up Chill Vibes playlist"**

### 🎵 Playback Control
- **"Play music"** / **"Pause"** / **"Stop"**
- **"Skip to next track"** / **"Go back to previous song"**
- **"Set volume to 75"**
- **"Turn on shuffle"** / **"Turn off repeat"**

### 📝 Queue Management
- **"Add this song to my queue"**
- **"Show what's in the queue"**
- **"Clear the queue but keep current song"**

### 📱 Device Control
- **"List my available devices"**
- **"Switch playback to my phone"**
- **"Show what's currently playing"**

### 📊 Music Analytics
- **"Show me my top tracks from this year"**
- **"What are my most played artists?"**
- **"Analyze the audio features of my saved songs"**
- **"Show me my music library"**

### 🔐 Account Management
- **"Show my Spotify profile"**
- **"Check authentication status"**

## 🛠️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude AI     │◄──►│  MCP Server      │◄──►│  Spotify API    │
│                 │    │                  │    │                 │
│ Natural Language│    │ • Authentication │    │ • Web API       │
│ Commands        │    │ • Tool Registry  │    │ • OAuth 2.0     │
│                 │    │ • Request Handler│    │ • Rate Limiting │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Components

- **🔐 Authentication**: Secure OAuth 2.0 + PKCE flow
- **🛠️ Tool Registry**: 27 specialized tools for Spotify operations
- **🔄 Request Handler**: Intelligent request routing and validation
- **📊 Rate Limiter**: Automatic rate limiting and retry logic
- **🛡️ Security Layer**: Certificate pinning, HSM support, encrypted storage

## 📋 Available Tools

| Category | Tools | Description |
|----------|-------|-------------|
| **Playback** | `play`, `pause`, `skip_next`, `skip_previous` | Basic playback controls |
| **Audio** | `set_volume`, `seek`, `set_shuffle`, `set_repeat` | Audio and mode controls |
| **Search** | `search`, `get_recommendations` | Music discovery |
| **Queue** | `add_to_queue`, `get_queue`, `clear_queue`, `add_playlist_to_queue` | Queue management |
| **Devices** | `get_devices`, `transfer_playback` | Multi-device control |
| **Status** | `get_playback_status`, `get_user_profile` | Information retrieval |
| **Insights** | `get_user_top_tracks`, `get_user_top_artists`, `get_audio_features`, `get_user_saved_tracks`, `get_user_saved_albums`, `get_user_followed_artists` | Music analytics and library insights |
| **Auth** | `authenticate`, `get_auth_status` | Authentication management |

## 🔧 Requirements

- **Node.js** 18 or higher
- **Claude Desktop** application
- **Spotify Account** (Free or Premium)
- **Internet Connection** for API access

## 🛡️ Security

- **🔐 OAuth 2.0 + PKCE**: Industry-standard secure authentication
- **🔒 Local Encryption**: Tokens encrypted with AES-256 + PBKDF2
- **🔑 HSM Support**: Optional hardware security module integration
- **📜 Certificate Pinning**: Validates Spotify's SSL certificates (configurable)
- **🚫 No Data Collection**: All processing happens locally
- **🔄 Auto Token Refresh**: Seamless token management

## 📝 Configuration

### Environment Variables

```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/callback
LOG_LEVEL=info  # debug, info, warn, error
```

### Claude Desktop Config

```json
{
  "mcpServers": {
    "spotify": {
      "command": "node",
      "args": ["/path/to/project/build/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "your_client_id",
        "SPOTIFY_CLIENT_SECRET": "your_client_secret",
        "SPOTIFY_REDIRECT_URI": "http://127.0.0.1:8080/callback"
      }
    }
  }
}
```

## 🧪 Testing

```bash
# Test the connection
npm run test-connection

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Test specific components
npm run test:unit
npm run test:integration
```

## 🔍 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Server disconnected" | Check Node.js version (18+), restart Claude Desktop |
| "Authentication required" | Run authenticate command first |
| "Validation error" | Update to latest version |
| Connection issues | Check internet connection and Spotify app settings |

### Debug Information

- **Logs**: `/Users/yourname/Library/Logs/Claude/mcp-server-spotify.log`
- **Test Connection**: `npm run test-connection`
- **Verify Setup**: Check Claude Desktop config file

## 📚 Documentation

- [📖 Installation Guide](./INSTALLATION_GUIDE.md) - Step-by-step setup
- [🛠️ API Documentation](./docs/) - Technical reference
- [🔒 Security Guide](./docs/REDIRECT_URI_SECURITY.md) - Security implementation
- [🛡️ Security Architecture](./docs/api/SECURITY_ARCHITECTURE.md) - Advanced security features
- [🧪 Testing Guide](./docs/developer/testing.md) - Testing procedures

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md).

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Spotify** for the amazing Web API
- **Anthropic** for Claude and the MCP protocol
- **Model Context Protocol** community for the specification

## 📞 Support

- 🐛 [Report Issues](https://github.com/your-username/spotify-mcp-server/issues)
- 💬 [Join Discussions](https://github.com/your-username/spotify-mcp-server/discussions)
- 📧 [Contact](mailto:support@example.com)

---

**Made with ❤️ for the Claude and Spotify communities**

*Enjoy your music with AI! 🎶*