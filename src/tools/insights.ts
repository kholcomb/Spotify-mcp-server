/**
 * Spotify user insights tools for MCP
 * 
 * Provides user listening analytics, top content, and library access
 * through the MCP protocol.
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
  public readonly description = 'Get user\'s top tracks based on listening history';
  
  public readonly inputSchema = z.object({
    time_range: z.enum(['short_term', 'medium_term', 'long_term']).optional()
      .describe('Time range: short_term (~4 weeks), medium_term (~6 months), long_term (~1 year)'),
    limit: z.number().min(1).max(50).optional().describe('Number of results (1-50, default 20)'),
    offset: z.number().min(0).optional().describe('Offset for pagination (default 0)'),
  }).describe('Options for getting top tracks');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const options: { time_range?: 'short_term' | 'medium_term' | 'long_term'; limit?: number; offset?: number } = {};
      if (params.time_range) options.time_range = params.time_range;
      if (params.limit) options.limit = params.limit;
      if (params.offset) options.offset = params.offset;
      
      const topTracks = await this.spotifyClient.getUserTopTracks(options);

      // Format track information for readability
      const formattedTracks = topTracks.items.map((track, index) => ({
        rank: (params.offset || 0) + index + 1,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        popularity: track.popularity,
        duration: `${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}`,
        spotify_url: track.external_urls.spotify,
        uri: track.uri,
      }));

      return {
        success: true,
        data: {
          tracks: formattedTracks,
          time_range: params.time_range || 'medium_term',
          total: topTracks.total,
          limit: topTracks.limit,
          offset: topTracks.offset,
        },
      };
      
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required to access top tracks',
            retryable: false,
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code || 'SPOTIFY_ERROR',
            message: error.message,
            retryable: error.details.retryable || false,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get top tracks',
          retryable: false,
        },
      };
    }
  }
}

/**
 * Tool for getting user's top artists
 */
export class GetUserTopArtistsTool implements MCPTool {
  public readonly name = 'get_user_top_artists';
  public readonly description = 'Get user\'s top artists based on listening history';
  
  public readonly inputSchema = z.object({
    time_range: z.enum(['short_term', 'medium_term', 'long_term']).optional()
      .describe('Time range: short_term (~4 weeks), medium_term (~6 months), long_term (~1 year)'),
    limit: z.number().min(1).max(50).optional().describe('Number of results (1-50, default 20)'),
    offset: z.number().min(0).optional().describe('Offset for pagination (default 0)'),
  }).describe('Options for getting top artists');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const options: { time_range?: 'short_term' | 'medium_term' | 'long_term'; limit?: number; offset?: number } = {};
      if (params.time_range) options.time_range = params.time_range;
      if (params.limit) options.limit = params.limit;
      if (params.offset) options.offset = params.offset;
      
      const topArtists = await this.spotifyClient.getUserTopArtists(options);

      // Format artist information for readability
      const formattedArtists = topArtists.items.map((artist, index) => ({
        rank: (params.offset || 0) + index + 1,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers.total,
        spotify_url: artist.external_urls.spotify,
        uri: artist.uri,
      }));

      return {
        success: true,
        data: {
          artists: formattedArtists,
          time_range: params.time_range || 'medium_term',
          total: topArtists.total,
          limit: topArtists.limit,
          offset: topArtists.offset,
        },
      };
      
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required to access top artists',
            retryable: false,
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code || 'SPOTIFY_ERROR',
            message: error.message,
            retryable: error.details.retryable || false,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get top artists',
          retryable: false,
        },
      };
    }
  }
}

/**
 * Tool for getting audio features of a track
 */
export class GetAudioFeaturesTool implements MCPTool {
  public readonly name = 'get_audio_features';
  public readonly description = 'Get detailed audio features and analysis for a track';
  
  public readonly inputSchema = z.object({
    track_id: z.string().min(1).describe('Spotify track ID'),
  }).describe('Track ID for audio features analysis');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const features = await this.spotifyClient.getAudioFeatures(params.track_id);

      // Format audio features with descriptions
      const formattedFeatures = {
        track_id: features.id,
        danceability: {
          value: features.danceability,
          description: 'How suitable a track is for dancing (0.0 = least danceable, 1.0 = most danceable)',
        },
        energy: {
          value: features.energy,
          description: 'Perceptual measure of intensity and activity (0.0 = low energy, 1.0 = high energy)',
        },
        valence: {
          value: features.valence,
          description: 'Musical positiveness conveyed by track (0.0 = negative/sad, 1.0 = positive/happy)',
        },
        tempo: {
          value: features.tempo,
          description: 'Overall estimated tempo in beats per minute (BPM)',
        },
        acousticness: {
          value: features.acousticness,
          description: 'Confidence measure of whether track is acoustic (0.0 = not acoustic, 1.0 = acoustic)',
        },
        instrumentalness: {
          value: features.instrumentalness,
          description: 'Predicts whether track contains vocals (>0.5 likely instrumental)',
        },
        liveness: {
          value: features.liveness,
          description: 'Detects presence of audience in recording (>0.8 likely live performance)',
        },
        speechiness: {
          value: features.speechiness,
          description: 'Detects presence of spoken words (>0.66 likely speech, 0.33-0.66 may contain music and speech)',
        },
        loudness: {
          value: features.loudness,
          description: 'Overall loudness in decibels (dB), typically between -60 and 0 dB',
        },
        key: {
          value: features.key,
          description: `Musical key (${this.getKeyName(features.key)})`,
        },
        mode: {
          value: features.mode,
          description: features.mode === 1 ? 'Major scale' : 'Minor scale',
        },
        time_signature: {
          value: features.time_signature,
          description: 'Estimated time signature (number of beats per bar)',
        },
        duration_ms: features.duration_ms,
      };

      return {
        success: true,
        data: {
          audio_features: formattedFeatures,
          spotify_url: features.track_href,
        },
      };
      
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required to access audio features',
            retryable: false,
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code || 'SPOTIFY_ERROR',
            message: error.message,
            retryable: error.details.retryable || false,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get audio features',
          retryable: false,
        },
      };
    }
  }

  private getKeyName(key: number): string {
    const keyNames = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
    return keyNames[key] || 'Unknown';
  }
}

/**
 * Tool for getting user's saved tracks
 */
export class GetUserSavedTracksTool implements MCPTool {
  public readonly name = 'get_user_saved_tracks';
  public readonly description = 'Get tracks saved in user\'s library (liked songs)';
  
  public readonly inputSchema = z.object({
    limit: z.number().min(1).max(50).optional().describe('Number of results (1-50, default 20)'),
    offset: z.number().min(0).optional().describe('Offset for pagination (default 0)'),
  }).describe('Options for getting saved tracks');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const options: { limit?: number; offset?: number } = {};
      if (params.limit) options.limit = params.limit;
      if (params.offset) options.offset = params.offset;
      
      const savedTracks = await this.spotifyClient.getUserSavedTracks(options);

      // Format saved tracks with added date
      const formattedTracks = savedTracks.items.map((item, index) => ({
        position: (params.offset || 0) + index + 1,
        name: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        album: item.track.album.name,
        added_at: new Date(item.added_at).toLocaleDateString(),
        duration: `${Math.floor(item.track.duration_ms / 60000)}:${String(Math.floor((item.track.duration_ms % 60000) / 1000)).padStart(2, '0')}`,
        spotify_url: item.track.external_urls.spotify,
        uri: item.track.uri,
      }));

      return {
        success: true,
        data: {
          saved_tracks: formattedTracks,
          total: savedTracks.total,
          limit: savedTracks.limit,
          offset: savedTracks.offset,
        },
      };
      
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required to access saved tracks',
            retryable: false,
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code || 'SPOTIFY_ERROR',
            message: error.message,
            retryable: error.details.retryable || false,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get saved tracks',
          retryable: false,
        },
      };
    }
  }
}

/**
 * Tool for getting user's saved albums
 */
export class GetUserSavedAlbumsTool implements MCPTool {
  public readonly name = 'get_user_saved_albums';
  public readonly description = 'Get albums saved in user\'s library';
  
  public readonly inputSchema = z.object({
    limit: z.number().min(1).max(50).optional().describe('Number of results (1-50, default 20)'),
    offset: z.number().min(0).optional().describe('Offset for pagination (default 0)'),
  }).describe('Options for getting saved albums');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const options: { limit?: number; offset?: number } = {};
      if (params.limit) options.limit = params.limit;
      if (params.offset) options.offset = params.offset;
      
      const savedAlbums = await this.spotifyClient.getUserSavedAlbums(options);

      // Format saved albums with added date
      const formattedAlbums = savedAlbums.items.map((item, index) => ({
        position: (params.offset || 0) + index + 1,
        name: item.album.name,
        artist: item.album.artists.map(a => a.name).join(', '),
        album_type: item.album.album_type,
        release_date: item.album.release_date,
        total_tracks: item.album.total_tracks,
        added_at: new Date(item.added_at).toLocaleDateString(),
        genres: item.album.genres,
        popularity: item.album.popularity,
        spotify_url: item.album.external_urls.spotify,
        uri: item.album.uri,
      }));

      return {
        success: true,
        data: {
          saved_albums: formattedAlbums,
          total: savedAlbums.total,
          limit: savedAlbums.limit,
          offset: savedAlbums.offset,
        },
      };
      
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required to access saved albums',
            retryable: false,
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code || 'SPOTIFY_ERROR',
            message: error.message,
            retryable: error.details.retryable || false,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get saved albums',
          retryable: false,
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
    limit: z.number().min(1).max(50).optional().describe('Number of results (1-50, default 20)'),
    after: z.string().optional().describe('Cursor for pagination'),
  }).describe('Options for getting followed artists');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const options: { type: 'artist'; limit?: number; after?: string } = { type: 'artist' };
      if (params.limit) options.limit = params.limit;
      if (params.after) options.after = params.after;
      
      const followedArtists = await this.spotifyClient.getUserFollowedArtists(options);

      // Format followed artists
      const formattedArtists = followedArtists.artists.items.map((artist, index) => ({
        position: index + 1,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers.total,
        spotify_url: artist.external_urls.spotify,
        uri: artist.uri,
      }));

      return {
        success: true,
        data: {
          followed_artists: formattedArtists,
          total: followedArtists.artists.total,
          limit: followedArtists.artists.limit,
          next_cursor: followedArtists.artists.cursors.after,
        },
      };
      
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required to access followed artists',
            retryable: false,
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code || 'SPOTIFY_ERROR',
            message: error.message,
            retryable: error.details.retryable || false,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get followed artists',
          retryable: false,
        },
      };
    }
  }
}

/**
 * Factory function to create all user insights tools
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