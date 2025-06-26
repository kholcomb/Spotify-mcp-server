# Spotify MCP Server User Guide

This guide covers how to use the Spotify MCP Server through your AI assistant to control music, search content, and manage your Spotify experience.

## Overview

The Spotify MCP Server enables your AI assistant to:
- **Control music playback** (Premium required)
- **Search Spotify's catalog** (all account types)
- **Access your user data** (playlists, recently played, etc.)
- **Manage your music queue** (Premium required)

## Getting Started

### Prerequisites
- Completed [Setup Guide](setup-guide.md)
- Spotify account (Premium recommended for full functionality)
- AI assistant with MCP support (e.g., Claude Desktop)

### Basic Usage Pattern

Simply talk to your AI assistant using natural language. The assistant will automatically use the appropriate Spotify tools based on your requests.

**Examples:**
- "What's playing on Spotify?"
- "Play some jazz music"
- "Search for songs by Taylor Swift"
- "Skip to the next song"

## Music Playback Control

### Starting Playback

**Play music:**
```
"Play music on Spotify"
"Start playing my music"
"Resume playback"
```

**Play specific content:**
```
"Play the album 'Abbey Road' by The Beatles"
"Play my 'Workout' playlist"
"Play the song 'Bohemian Rhapsody'"
```

### Controlling Playback

**Basic controls:**
```
"Pause the music"
"Skip to the next song"
"Go back to the previous track"
"Stop the music"
```

**Volume control:**
```
"Set volume to 75%"
"Turn the volume down to 30%"
"Make it louder" (increases volume)
"Make it quieter" (decreases volume)
```

**Playback modes:**
```
"Turn on shuffle"
"Turn off shuffle"
"Set repeat to track" (repeat current song)
"Set repeat to context" (repeat playlist/album)
"Turn off repeat"
```

### Device Management

**Switch devices:**
```
"Play music on my phone"
"Switch playback to my computer"
"What devices are available?"
```

## Music Search and Discovery

### Basic Search

**Search by artist:**
```
"Search for songs by Adele"
"Find music by The Rolling Stones"
"Show me albums by Billie Eilish"
```

**Search by song:**
```
"Find the song 'Imagine' by John Lennon"
"Search for 'Hotel California'"
"Look up 'Blinding Lights'"
```

**Search by genre or mood:**
```
"Find some upbeat pop music"
"Search for relaxing instrumental music"
"Find some 90s rock songs"
```

### Advanced Search

**Search with filters:**
```
"Find recent albums by Coldplay"
"Search for acoustic versions of popular songs"
"Find playlists with workout music"
```

**Get recommendations:**
```
"Recommend music similar to what I'm currently playing"
"Suggest new songs based on my listening history"
"Find music like my 'Chill' playlist"
```

## Queue Management

### Adding to Queue

**Add specific tracks:**
```
"Add 'Sweet Child O' Mine' to my queue"
"Queue up some Beatles songs"
"Add this album to my queue"
```

**Add from search results:**
```
"Search for jazz music and add the top 5 songs to my queue"
"Find relaxing music and queue it up"
```

### Viewing Queue

**Check what's coming up:**
```
"What's in my queue?"
"Show me what's playing next"
"What songs are queued up?"
```

## User Data and Library

### Your Profile

**Profile information:**
```
"Show me my Spotify profile"
"What's my Spotify username?"
"How many followers do I have?"
```

### Playlists

**View playlists:**
```
"Show me my playlists"
"List all my Spotify playlists"
"What playlists do I have?"
```

**Playlist details:**
```
"Show me what's in my 'Road Trip' playlist"
"How many songs are in my 'Favorites' playlist?"
"Tell me about my 'Workout' playlist"
```

### Listening History

**Recently played:**
```
"What have I been listening to recently?"
"Show my recent listening history"
"What was the last song I played?"
```

**Saved music:**
```
"Show me my saved songs"
"What albums have I saved?"
"List my liked songs"
```

## Natural Language Examples

### Casual Conversation Style

The AI assistant understands natural, conversational requests:

**Instead of saying:** "Execute search tool with query 'rock music' and type 'track'"  
**You can say:** "I'm in the mood for some rock music"

**Instead of saying:** "Run play tool with shuffle enabled"  
**You can say:** "Play my music on shuffle"

**Instead of saying:** "Call get_current_playback function"  
**You can say:** "What's playing right now?"

### Complex Requests

**Multi-step actions:**
```
"Find upbeat songs from the 80s, add the first three to my queue, and start playing"
"Search for calm instrumental music, create a playlist called 'Focus', and start playing it"
"Show me my recent listening history and play something similar"
```

**Contextual follow-ups:**
```
User: "Play some jazz music"
Assistant: [Starts playing jazz]
User: "Actually, make it louder and turn on shuffle"
Assistant: [Adjusts volume and enables shuffle]
User: "What's this song called?"
Assistant: [Shows current track info]
```

## Account Types and Limitations

### Spotify Premium Features
✅ **Available with Premium:**
- All playback controls (play, pause, skip, volume)
- Device switching and control
- Queue management
- Full access to all tracks

### Spotify Free Features
✅ **Available with Free accounts:**
- Music search and discovery
- View user profile and playlists
- Access listening history
- View currently playing (if any)

❌ **Not available with Free accounts:**
- Playback control commands
- Volume adjustment
- Device switching
- Queue management

## Error Handling and Troubleshooting

### Common Scenarios

**When you don't have Spotify Premium:**
```
User: "Skip to the next song"
Assistant: "I'm sorry, but skipping tracks requires a Spotify Premium subscription. I can help you search for music or view your playlists instead."
```

**When no music is playing:**
```
User: "What's playing?"
Assistant: "No music is currently playing on Spotify. Would you like me to start playing something for you?"
```

**When rate limits are hit:**
```
Assistant: "I'm experiencing some delays with Spotify's servers. Let me try that again in a moment."
```

### Tips for Best Experience

1. **Be specific when possible:**
   - Good: "Play the album 'Dark Side of the Moon' by Pink Floyd"
   - Okay: "Play some Pink Floyd"

2. **Use natural language:**
   - The assistant understands context and conversational flow
   - You don't need to use technical terms or exact command names

3. **Ask for help:**
   - "What can you do with Spotify?"
   - "Show me some examples of music commands"
   - "Help me find new music"

## Privacy and Security

### What Data is Accessed

The MCP server only accesses:
- **Your public profile information** (username, display name)
- **Your playlists and saved music** (to show you your library)
- **Your current playback state** (to control and display current music)
- **Your listening history** (recent tracks, for recommendations)

### What Data is NOT Accessed

- **Personal information** beyond public profile
- **Payment information** (handled entirely by Spotify)
- **Private messages or social features**
- **Data from other users**

### Data Storage

- **Authentication tokens** are encrypted and stored locally
- **No music data** is permanently stored by the server
- **All data** comes fresh from Spotify's API when requested
- **Tokens automatically expire** and are refreshed as needed

## Advanced Usage

### Scripting and Automation

While the primary interface is conversational, you can also:
- Use consistent patterns for routine tasks
- Chain multiple commands together
- Ask the assistant to remember preferences within a session

### Integration with Other Services

The assistant can combine Spotify control with other capabilities:
```
"Play some focus music and set a 25-minute timer for a work session"
"Find the song that was playing in yesterday's weather report and add it to my queue"
"Play my 'Cooking' playlist and remind me to check dinner in 30 minutes"
```

## Getting More Help

### In-Session Help
```
"What Spotify commands are available?"
"How do I search for music?"
"Show me examples of what you can do with Spotify"
```

### Troubleshooting
If you encounter issues:
1. Try rephrasing your request
2. Check if you have the required account type (Premium for playback)
3. Ensure Spotify is working in your web browser or app
4. Refer to the [Setup Guide](setup-guide.md) for configuration issues

### Feature Requests
The assistant will let you know if you request something that's not currently supported, and may suggest alternatives or workarounds.