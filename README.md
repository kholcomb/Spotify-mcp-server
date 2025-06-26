# Spotify MCP Server

A Model Context Protocol (MCP) server that provides standardized AI interfaces for Spotify Web API integration, enabling music control, search, and data access through AI assistants like Claude.

## Features

- 🎵 **Music Playback Control**: Play, pause, skip, volume, shuffle, repeat
- 🔍 **Universal Search**: Search tracks, artists, albums, and playlists
- 📋 **Queue Management**: Add to queue, view current queue
- 👤 **User Data Access**: Profile, playlists, recently played, saved content
- 🔐 **Secure Authentication**: OAuth 2.0 + PKCE with encrypted token storage
- ⚡ **Rate Limiting**: Intelligent request queuing and caching
- 🛡️ **Type Safety**: Full TypeScript implementation with strict types

## Prerequisites

- **Node.js 18.0+** (LTS recommended)
- **Spotify Premium Account** (required for playback control)
- **Spotify Developer Application** (for API credentials)

## Quick Start

### 1. Spotify Developer Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Note your Client ID and Client Secret
4. Add `http://localhost:8080/callback` to Redirect URIs

### 2. Installation

```bash
# Clone and install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Spotify credentials
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### 3. Development

```bash
# Start development server with hot reload
npm run dev

# Or build and run production version
npm run build
npm start
```

### 4. MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "spotify": {
      "command": "node",
      "args": ["path/to/spotify-mcp-server/build/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "your_client_id",
        "SPOTIFY_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## Available Commands

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload
- `npm run test` - Run test suite
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Check code style and errors
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Type checking without emit

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPOTIFY_CLIENT_ID` | ✅ | - | Your Spotify application client ID |
| `SPOTIFY_CLIENT_SECRET` | ✅ | - | Your Spotify application client secret |
| `SPOTIFY_REDIRECT_URI` | ❌ | `http://localhost:8080/callback` | OAuth callback URI |
| `LOG_LEVEL` | ❌ | `info` | Logging level (debug, info, warn, error) |
| `TOKEN_ENCRYPTION_KEY` | ❌ | auto-generated | AES-256 key for token encryption |

## MCP Tools

### Playback Control
- `play` - Start/resume playback
- `pause` - Pause playback
- `skip_next` - Skip to next track
- `skip_previous` - Skip to previous track
- `set_volume` - Set playback volume (0-100)
- `toggle_shuffle` - Toggle shuffle mode
- `set_repeat` - Set repeat mode (off, track, context)

### Search & Discovery
- `search` - Universal search across Spotify catalog
- `get_recommendations` - Get personalized track recommendations

### Queue Management
- `add_to_queue` - Add track to playback queue
- `get_queue` - View current playback queue

### User Data
- `get_current_playback` - Get current playback state
- `get_user_profile` - Get user profile information
- `get_user_playlists` - Get user's playlists
- `get_recently_played` - Get recently played tracks

## Architecture

The server follows a modular architecture with clear separation of concerns:

- **`/server`** - MCP protocol handling and tool registry
- **`/auth`** - OAuth 2.0 + PKCE authentication management
- **`/spotify`** - Spotify API client and data models
- **`/tools`** - MCP tool implementations
- **`/types`** - TypeScript type definitions
- **`/utils`** - Shared utilities and helpers

## Security

- **OAuth 2.0 + PKCE**: Industry-standard secure authentication
- **Token Encryption**: AES-256 encryption for stored tokens
- **Input Validation**: Comprehensive validation using Zod schemas
- **Rate Limiting**: Automatic compliance with Spotify API limits
- **No Credential Logging**: Tokens and secrets never logged

## Contributing

1. Ensure Node.js 18+ is installed
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure
4. Run tests: `npm test`
5. Check linting: `npm run lint`
6. Format code: `npm run format`

## License

MIT - See LICENSE file for details

## Support

- **Documentation**: See `/docs` directory
- **Issues**: Report issues with detailed reproduction steps
- **Requirements**: Spotify Premium account required for playback control

---

Built with the [Model Context Protocol](https://modelcontextprotocol.io/) for seamless AI assistant integration.