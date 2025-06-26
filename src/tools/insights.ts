/**
 * Spotify user insights tools for MCP
 * 
 * Provides user-specific data including top tracks, top artists, audio features,
 * saved content, and followed artists through the MCP protocol.
 */

import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { SpotifyError, SpotifyAuthError } from '../spotify/errors.js';
import { z } from 'zod';

/**
 * Tool for getting user's top tracks
 */
export class GetUserTopTracksTool implements MCPTool {
  public readonly name = 'get_user_top_tracks';
  public readonly description = 'Get the user\'s top tracks over different time periods';
  
  public readonly inputSchema = z.object({
    timeRange: z.enum(['short_term', 'medium_term', 'long_term'])
      .default('medium_term')
      .describe('Time period: short_term (4 weeks), medium_term (6 months), long_term (years)'),
    limit: z.number().min(1).max(50).default(20)
      .describe('Number of tracks to return (1-50)'),
    offset: z.number().min(0).default(0)
      .describe('Offset for pagination'),
  }).describe('Top tracks request parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const response = await this.spotifyClient.getUserTopTracks({
        timeRange: params.timeRange,
        limit: params.limit,
        offset: params.offset,
      });
      
      // Format tracks for better readability
      const formattedTracks = response.items.map((track, index) => ({
        rank: params.offset + index + 1,
        id: track.id,
        name: track.name,
        artists: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        popularity: track.popularity,
        duration: this.formatDuration(track.duration_ms),
        uri: track.uri,
        external_url: track.external_urls.spotify,
        preview_url: track.preview_url,
      }));
      
      return {
        success: true,
        data: {
          tracks: formattedTracks,
          timeRange: params.timeRange,
          total: response.total,
          pagination: {
            limit: params.limit,
            offset: params.offset,
            hasNext: response.next !== null,
            hasPrevious: response.previous !== null,
          },
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

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Tool for getting user's top artists
 */
export class GetUserTopArtistsTool implements MCPTool {
  public readonly name = 'get_user_top_artists';
  public readonly description = 'Get the user\'s top artists over different time periods';
  
  public readonly inputSchema = z.object({
    timeRange: z.enum(['short_term', 'medium_term', 'long_term'])
      .default('medium_term')
      .describe('Time period: short_term (4 weeks), medium_term (6 months), long_term (years)'),
    limit: z.number().min(1).max(50).default(20)
      .describe('Number of artists to return (1-50)'),
    offset: z.number().min(0).default(0)
      .describe('Offset for pagination'),
  }).describe('Top artists request parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const response = await this.spotifyClient.getUserTopArtists({
        timeRange: params.timeRange,
        limit: params.limit,
        offset: params.offset,
      });
      
      // Format artists for better readability
      const formattedArtists = response.items.map((artist, index) => ({
        rank: params.offset + index + 1,
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers.total,
        uri: artist.uri,
        external_url: artist.external_urls.spotify,
        images: artist.images,
      }));
      
      return {
        success: true,
        data: {
          artists: formattedArtists,
          timeRange: params.timeRange,
          total: response.total,
          pagination: {
            limit: params.limit,
            offset: params.offset,
            hasNext: response.next !== null,
            hasPrevious: response.previous !== null,
          },
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
}

/**
 * Tool for getting audio features of tracks
 */
export class GetAudioFeaturesTool implements MCPTool {
  public readonly name = 'get_audio_features';
  public readonly description = 'Get audio features for one or more tracks';
  
  public readonly inputSchema = z.object({
    trackIds: z.union([
      z.string(),
      z.array(z.string())
    ]).transform(val => Array.isArray(val) ? val : [val])
      .describe('Track ID(s) to get audio features for (max 100)'),
  }).describe('Audio features request parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      if (params.trackIds.length > 100) {
        return {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Maximum 100 track IDs allowed per request',
          },
        };
      }
      
      const response = await this.spotifyClient.getAudioFeatures(params.trackIds);
      
      // Format audio features for better readability
      const formattedFeatures = response.audio_features.map((features, index) => {
        if (!features) {
          return {
            trackId: params.trackIds[index],
            error: 'Audio features not available for this track',
          };
        }
        
        return {
          trackId: features.id,
          acousticness: Number(features.acousticness.toFixed(3)),
          danceability: Number(features.danceability.toFixed(3)),
          energy: Number(features.energy.toFixed(3)),
          instrumentalness: Number(features.instrumentalness.toFixed(3)),
          liveness: Number(features.liveness.toFixed(3)),
          loudness: Number(features.loudness.toFixed(1)),
          speechiness: Number(features.speechiness.toFixed(3)),
          tempo: Number(features.tempo.toFixed(1)),
          valence: Number(features.valence.toFixed(3)),
          key: features.key,
          mode: features.mode === 1 ? 'major' : 'minor',
          time_signature: features.time_signature,
          duration_ms: features.duration_ms,
        };
      });
      
      return {
        success: true,
        data: {
          audio_features: formattedFeatures,
          total: params.trackIds.length,
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
}

/**
 * Tool for getting user's saved tracks
 */
export class GetUserSavedTracksTool implements MCPTool {
  public readonly name = 'get_user_saved_tracks';
  public readonly description = 'Get tracks from the user\'s library';
  
  public readonly inputSchema = z.object({
    limit: z.number().min(1).max(50).default(20)
      .describe('Number of tracks to return (1-50)'),
    offset: z.number().min(0).default(0)
      .describe('Offset for pagination'),
  }).describe('Saved tracks request parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const response = await this.spotifyClient.getUserSavedTracks({
        limit: params.limit,
        offset: params.offset,
      });
      
      // Format tracks for better readability
      const formattedTracks = response.items.map((item, index) => ({
        position: params.offset + index + 1,
        added_at: item.added_at,
        track: {
          id: item.track.id,
          name: item.track.name,
          artists: item.track.artists.map(artist => artist.name).join(', '),
          album: item.track.album.name,
          duration: this.formatDuration(item.track.duration_ms),
          popularity: item.track.popularity,
          uri: item.track.uri,
          external_url: item.track.external_urls.spotify,
          preview_url: item.track.preview_url,
        },
      }));
      
      return {
        success: true,
        data: {
          tracks: formattedTracks,
          total: response.total,
          pagination: {
            limit: params.limit,
            offset: params.offset,
            hasNext: response.next !== null,
            hasPrevious: response.previous !== null,
          },
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

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Tool for getting user's saved albums
 */
export class GetUserSavedAlbumsTool implements MCPTool {
  public readonly name = 'get_user_saved_albums';
  public readonly description = 'Get albums from the user\'s library';
  
  public readonly inputSchema = z.object({
    limit: z.number().min(1).max(50).default(20)
      .describe('Number of albums to return (1-50)'),
    offset: z.number().min(0).default(0)
      .describe('Offset for pagination'),
  }).describe('Saved albums request parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const response = await this.spotifyClient.getUserSavedAlbums({
        limit: params.limit,
        offset: params.offset,
      });
      
      // Format albums for better readability
      const formattedAlbums = response.items.map((item, index) => ({
        position: params.offset + index + 1,
        added_at: item.added_at,
        album: {
          id: item.album.id,
          name: item.album.name,
          artists: item.album.artists.map(artist => artist.name).join(', '),
          release_date: item.album.release_date,
          total_tracks: item.album.total_tracks,
          album_type: item.album.album_type,
          uri: item.album.uri,
          external_url: item.album.external_urls.spotify,
          images: item.album.images,
        },
      }));
      
      return {
        success: true,
        data: {
          albums: formattedAlbums,
          total: response.total,
          pagination: {
            limit: params.limit,
            offset: params.offset,
            hasNext: response.next !== null,
            hasPrevious: response.previous !== null,
          },
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
}

/**
 * Tool for getting user's followed artists
 */
export class GetUserFollowedArtistsTool implements MCPTool {
  public readonly name = 'get_user_followed_artists';
  public readonly description = 'Get artists followed by the user';
  
  public readonly inputSchema = z.object({
    limit: z.number().min(1).max(50).default(20)
      .describe('Number of artists to return (1-50)'),
    after: z.string().optional()
      .describe('Artist ID to start after (for pagination)'),
  }).describe('Followed artists request parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const response = await this.spotifyClient.getUserFollowedArtists({
        limit: params.limit,
        ...(params.after && { after: params.after }),
      });
      
      // Format artists for better readability
      const formattedArtists = response.artists.items.map((artist, index) => ({
        position: index + 1,
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers.total,
        uri: artist.uri,
        external_url: artist.external_urls.spotify,
        images: artist.images,
      }));
      
      return {
        success: true,
        data: {
          artists: formattedArtists,
          total: response.artists.total,
          pagination: {
            limit: params.limit,
            after: params.after,
            hasNext: response.artists.next !== null,
            nextCursor: response.artists.cursors?.after,
          },
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
}

/**
 * Factory function to create all insights tools
 */
export function createInsightsTools(spotifyClient: ISpotifyClient): MCPTool[] {
  return [
    new GetUserTopTracksTool(spotifyClient),
    new GetUserTopArtistsTool(spotifyClient),
    new GetAudioFeaturesTool(spotifyClient),
    new GetUserSavedTracksTool(spotifyClient),
    new GetUserSavedAlbumsTool(spotifyClient),
    new GetUserFollowedArtistsTool(spotifyClient),
  ];
}