/**
 * Spotify queue management tools for MCP
 * 
 * Provides queue management functionality including adding tracks to queue,
 * viewing queue contents, and queue manipulation through the MCP protocol.
 */

import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { SpotifyError, SpotifyAuthError, SpotifyPremiumRequiredError } from '../spotify/errors.js';
import { z } from 'zod';

/**
 * Tool for adding tracks to the playback queue
 */
export class AddToQueueTool implements MCPTool {
  public readonly name = 'add_to_queue';
  public readonly description = 'Add a track to the Spotify playback queue';
  
  public readonly inputSchema = z.object({
    uri: z.string().min(1).describe('Spotify track URI to add to queue'),
    deviceId: z.string().optional().describe('Specific device ID to add to queue on'),
  }).describe('Add to queue parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      // Validate URI format
      if (!this.isValidTrackUri(params.uri)) {
        return {
          success: false,
          error: {
            code: 'INVALID_URI',
            message: 'Invalid Spotify track URI format',
            details: 'URI must be in format: spotify:track:TRACK_ID or https://open.spotify.com/track/TRACK_ID',
          },
        };
      }

      await this.spotifyClient.addToQueue(params.uri, params.deviceId);
      
      // Extract track ID for display
      const trackId = this.extractTrackId(params.uri);
      
      return {
        success: true,
        data: {
          message: 'Track added to queue successfully',
          uri: params.uri,
          trackId,
        },
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: error.message,
            details: 'Please authenticate with Spotify first',
          },
        };
      }
      
      if (error instanceof SpotifyPremiumRequiredError) {
        return {
          success: false,
          error: {
            code: 'PREMIUM_REQUIRED',
            message: error.message,
            details: 'Spotify Premium subscription required for queue management',
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  private isValidTrackUri(uri: string): boolean {
    // Check for Spotify URI format: spotify:track:TRACK_ID
    if (uri.startsWith('spotify:track:')) {
      const trackId = uri.split(':')[2];
      return !!(trackId && trackId.length === 22); // Spotify track IDs are 22 characters
    }
    
    // Check for Spotify URL format: https://open.spotify.com/track/TRACK_ID
    if (uri.includes('open.spotify.com/track/')) {
      const match = uri.match(/track\/([a-zA-Z0-9]{22})/);
      return match !== null;
    }
    
    return false;
  }

  private extractTrackId(uri: string): string {
    if (uri.startsWith('spotify:track:')) {
      return uri.split(':')[2] || '';
    }
    
    if (uri.includes('open.spotify.com/track/')) {
      const match = uri.match(/track\/([a-zA-Z0-9]{22})/);
      return match?.[1] || '';
    }
    
    return '';
  }
}

/**
 * Tool for viewing the current playback queue
 */
export class GetQueueTool implements MCPTool {
  public readonly name = 'get_queue';
  public readonly description = 'Get the current Spotify playback queue';
  
  public readonly inputSchema = z.object({
    limit: z.number().min(1).max(50).default(20).describe('Number of queue items to return (1-50)'),
  }).describe('Queue retrieval options');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const queue = await this.spotifyClient.getQueue();
      
      // Format current track
      const currentTrack = queue.currently_playing ? {
        id: queue.currently_playing.id,
        name: queue.currently_playing.name,
        artists: queue.currently_playing.artists.map(artist => artist.name).join(', '),
        album: queue.currently_playing.album.name,
        duration: this.formatDuration(queue.currently_playing.duration_ms),
        uri: queue.currently_playing.uri,
        external_urls: queue.currently_playing.external_urls,
      } : null;

      // Format queue items (limit to requested amount)
      const queueItems = queue.queue.slice(0, params.limit).map((track, index) => ({
        position: index + 1,
        id: track.id,
        name: track.name,
        artists: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        duration: this.formatDuration(track.duration_ms),
        uri: track.uri,
        external_urls: track.external_urls,
      }));

      return {
        success: true,
        data: {
          currently_playing: currentTrack,
          queue: queueItems,
          total_queue_items: queue.queue.length,
          showing: Math.min(params.limit, queue.queue.length),
        },
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: error.message,
            details: 'Please authenticate with Spotify first',
          },
        };
      }
      
      if (error instanceof SpotifyPremiumRequiredError) {
        return {
          success: false,
          error: {
            code: 'PREMIUM_REQUIRED',
            message: error.message,
            details: 'Spotify Premium subscription required to view queue',
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Tool for adding multiple tracks to queue from a playlist or album
 */
export class AddPlaylistToQueueTool implements MCPTool {
  public readonly name = 'add_playlist_to_queue';
  public readonly description = 'Add tracks from a playlist or album to the queue';
  
  public readonly inputSchema = z.object({
    uri: z.string().min(1).describe('Spotify playlist or album URI'),
    limit: z.number().min(1).max(50).default(20).describe('Maximum number of tracks to add (1-50)'),
    offset: z.number().min(0).default(0).describe('Offset to start adding tracks from'),
    shuffle: z.boolean().default(false).describe('Shuffle the tracks before adding to queue'),
    deviceId: z.string().optional().describe('Specific device ID to add to queue on'),
  }).describe('Add playlist to queue parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      // Validate URI format
      if (!this.isValidPlaylistOrAlbumUri(params.uri)) {
        return {
          success: false,
          error: {
            code: 'INVALID_URI',
            message: 'Invalid Spotify playlist or album URI format',
            details: 'URI must be in format: spotify:playlist:ID, spotify:album:ID, or corresponding URLs',
          },
        };
      }

      // Get tracks from playlist/album
      let tracks;
      if (params.uri.includes('playlist')) {
        const playlistTracks = await this.spotifyClient.getPlaylistTracks(
          this.extractId(params.uri),
          { limit: params.limit, offset: params.offset }
        );
        tracks = playlistTracks.items.map(item => item.track).filter(track => track !== null);
      } else if (params.uri.includes('album')) {
        const albumTracks = await this.spotifyClient.getAlbumTracks(
          this.extractId(params.uri),
          { limit: params.limit, offset: params.offset }
        );
        tracks = albumTracks.items;
      } else {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_URI',
            message: 'Only playlist and album URIs are supported',
          },
        };
      }

      if (!tracks || tracks.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_TRACKS_FOUND',
            message: 'No tracks found in the specified playlist/album',
          },
        };
      }

      // Shuffle if requested
      if (params.shuffle) {
        tracks = this.shuffleArray([...tracks]);
      }

      // Add tracks to queue sequentially
      const addedTracks = [];
      const errors = [];

      for (const track of tracks) {
        try {
          await this.spotifyClient.addToQueue(track.uri, params.deviceId);
          addedTracks.push({
            name: track.name,
            artists: track.artists.map(artist => artist.name).join(', '),
            uri: track.uri,
          });
          
          // Small delay to avoid rate limiting
          await this.delay(100);
        } catch (error) {
          errors.push({
            track: track.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        data: {
          message: `Added ${addedTracks.length} tracks to queue`,
          added_tracks: addedTracks,
          total_requested: tracks.length,
          successfully_added: addedTracks.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: error.message,
            details: 'Please authenticate with Spotify first',
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  private isValidPlaylistOrAlbumUri(uri: string): boolean {
    // Check for Spotify URI formats
    if (uri.startsWith('spotify:playlist:') || uri.startsWith('spotify:album:')) {
      const id = uri.split(':')[2];
      return !!(id && id.length === 22);
    }
    
    // Check for Spotify URL formats
    if (uri.includes('open.spotify.com/playlist/') || uri.includes('open.spotify.com/album/')) {
      const match = uri.match(/(playlist|album)\/([a-zA-Z0-9]{22})/);
      return match !== null;
    }
    
    return false;
  }

  private extractId(uri: string): string {
    if (uri.startsWith('spotify:')) {
      return uri.split(':')[2] || '';
    }
    
    const match = uri.match(/(playlist|album)\/([a-zA-Z0-9]{22})/);
    return match?.[2] || '';
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      const swapItem = shuffled[j];
      if (temp !== undefined && swapItem !== undefined) {
        shuffled[i] = swapItem;
        shuffled[j] = temp;
      }
    }
    return shuffled;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Tool for clearing the current queue
 */
export class ClearQueueTool implements MCPTool {
  public readonly name = 'clear_queue';
  public readonly description = 'Clear the current playback queue';
  
  public readonly inputSchema = z.object({
    deviceId: z.string().optional().describe('Specific device ID to clear queue on'),
    keepCurrent: z.boolean().default(true).describe('Whether to keep currently playing track'),
  }).describe('Queue clearing options');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      // Get current playback state
      const currentPlayback = await this.spotifyClient.getCurrentPlayback();
      
      if (!currentPlayback || !currentPlayback.item) {
        return {
          success: true,
          data: {
            message: 'No active playback session to clear queue for',
            cleared: false,
          },
        };
      }

      if (params.keepCurrent) {
        // Start playback with just the current track to clear the queue
        const playbackOptions: {
          uris: string[];
          positionMs: number;
          deviceId?: string;
        } = {
          uris: [currentPlayback.item.uri],
          positionMs: currentPlayback.progress_ms || 0,
        };
        
        if (params.deviceId) {
          playbackOptions.deviceId = params.deviceId;
        }
        
        await this.spotifyClient.startPlayback(playbackOptions);
        
        return {
          success: true,
          data: {
            message: 'Queue cleared while keeping current track',
            currentTrack: currentPlayback.item.name,
            cleared: true,
          },
        };
      } else {
        // Pause playback to stop everything
        await this.spotifyClient.pausePlayback(params.deviceId);
        
        return {
          success: true,
          data: {
            message: 'Queue and playback cleared',
            cleared: true,
          },
        };
      }
    } catch (error) {
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }
}

/**
 * Factory function to create all queue management tools
 */
export function createQueueTools(spotifyClient: ISpotifyClient): MCPTool[] {
  return [
    new AddToQueueTool(spotifyClient),
    new GetQueueTool(spotifyClient),
    new AddPlaylistToQueueTool(spotifyClient),
    new ClearQueueTool(spotifyClient),
  ];
}