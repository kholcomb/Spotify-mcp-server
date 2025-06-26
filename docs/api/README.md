# Spotify MCP Server API Documentation

This directory contains comprehensive API documentation for the Spotify MCP Server.

## Overview

The Spotify MCP Server exposes music control and data access functionality through the Model Context Protocol (MCP). All interactions follow the JSON-RPC 2.0 specification over stdio transport.

## MCP Tools

### Playback Control Tools

#### `play`
Start or resume music playback.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "device_id": {
      "type": "string",
      "description": "Optional device ID to start playback on"
    },
    "context_uri": {
      "type": "string", 
      "description": "Optional Spotify URI for context (playlist, album, etc.)"
    },
    "uris": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Optional track URIs to play"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playback started",
  "data": {
    "device": "Device Name",
    "track": "Track Name - Artist"
  }
}
```

#### `pause`
Pause music playback.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "device_id": {
      "type": "string",
      "description": "Optional device ID to pause"
    }
  }
}
```

#### `skip_next`
Skip to the next track.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "device_id": {
      "type": "string",
      "description": "Optional device ID"
    }
  }
}
```

#### `skip_previous`
Skip to the previous track.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "device_id": {
      "type": "string",
      "description": "Optional device ID"
    }
  }
}
```

#### `set_volume`
Set playback volume.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "volume_percent": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100,
      "description": "Volume level (0-100)"
    },
    "device_id": {
      "type": "string",
      "description": "Optional device ID"
    }
  },
  "required": ["volume_percent"]
}
```

#### `toggle_shuffle`
Toggle shuffle mode on/off.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "state": {
      "type": "boolean",
      "description": "True to enable shuffle, false to disable"
    },
    "device_id": {
      "type": "string",
      "description": "Optional device ID"
    }
  },
  "required": ["state"]
}
```

#### `set_repeat`
Set repeat mode.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "state": {
      "type": "string",
      "enum": ["off", "track", "context"],
      "description": "Repeat mode"
    },
    "device_id": {
      "type": "string",
      "description": "Optional device ID"
    }
  },
  "required": ["state"]
}
```

### Search and Discovery Tools

#### `search`
Search Spotify's catalog.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query"
    },
    "type": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["track", "artist", "album", "playlist", "show", "episode"]
      },
      "description": "Types to search for"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 20,
      "description": "Number of results to return"
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0,
      "description": "Offset for pagination"
    },
    "market": {
      "type": "string",
      "description": "Market/country code (ISO 3166-1 alpha-2)"
    }
  },
  "required": ["query", "type"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tracks": {
      "items": [...],
      "total": 1000,
      "limit": 20,
      "offset": 0
    }
  }
}
```

### Queue Management Tools

#### `add_to_queue`
Add a track to the playback queue.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "uri": {
      "type": "string",
      "description": "Spotify track URI"
    },
    "device_id": {
      "type": "string",
      "description": "Optional device ID"
    }
  },
  "required": ["uri"]
}
```

#### `get_queue`
Get the current playback queue.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "device_id": {
      "type": "string",
      "description": "Optional device ID"
    }
  }
}
```

### User Data Tools

#### `get_current_playback`
Get current playback state.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "market": {
      "type": "string",
      "description": "Market/country code"
    },
    "additional_types": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Additional item types to return"
    }
  }
}
```

#### `get_user_profile`
Get user profile information.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

#### `get_user_playlists`
Get user's playlists.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 20
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    }
  }
}
```

#### `get_recently_played`
Get recently played tracks.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50,
      "default": 20
    },
    "after": {
      "type": "integer",
      "description": "Unix timestamp to get tracks after"
    },
    "before": {
      "type": "integer", 
      "description": "Unix timestamp to get tracks before"
    }
  }
}
```

## Error Handling

All tools return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "SPOTIFY_API_ERROR",
    "message": "The access token expired",
    "retryable": true,
    "details": {
      "spotify_error": {
        "status": 401,
        "message": "The access token expired"
      }
    }
  }
}
```

### Common Error Codes

- `SPOTIFY_API_ERROR`: Error from Spotify API
- `AUTHENTICATION_ERROR`: OAuth token issues
- `VALIDATION_ERROR`: Invalid input parameters
- `RATE_LIMIT_ERROR`: API rate limit exceeded
- `NETWORK_ERROR`: Network connectivity issues
- `PREMIUM_REQUIRED`: Spotify Premium subscription required

## Rate Limiting

The server automatically handles Spotify's rate limiting:
- 30-second rolling window compliance
- Automatic request queuing
- Exponential backoff retry logic
- Transparent to MCP clients

## Authentication

All tools require valid Spotify authentication:
- OAuth 2.0 + PKCE flow
- Automatic token refresh
- Secure encrypted token storage
- Premium account required for playback control