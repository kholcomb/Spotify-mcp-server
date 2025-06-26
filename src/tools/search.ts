/**
 * Spotify search tools for MCP
 * 
 * Provides comprehensive search functionality for tracks, albums, artists,
 * playlists, and recommendations through the MCP protocol.
 */

import { MCPTool, ToolResult, SearchResults } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { SpotifyError, SpotifyAuthError } from '../spotify/errors.js';
import { z } from 'zod';

/**
 * Tool for searching Spotify catalog
 */
export class SearchTool implements MCPTool {
  public readonly name = 'search';
  public readonly description = 'Search Spotify catalog for tracks, albums, artists, playlists, and shows';
  
  public readonly inputSchema = z.object({
    query: z.string().min(1).describe('Search query string'),
    types: z.array(z.enum(['track', 'album', 'artist', 'playlist', 'show', 'episode']))
      .default(['track'])
      .describe('Types of items to search for'),
    market: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code (e.g., "US")'),
    limit: z.number().min(1).max(50).default(20).describe('Number of results to return (1-50)'),
    offset: z.number().min(0).default(0).describe('Offset for pagination'),
    includeExternal: z.boolean().default(false).describe('Include externally hosted audio content'),
  }).describe('Search parameters');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const searchOptions = {
        market: params.market,
        limit: params.limit,
        offset: params.offset,
        include_external: params.includeExternal ? 'audio' : undefined,
      };

      const results = await this.spotifyClient.search(
        params.query,
        params.types,
        searchOptions
      );
      
      // Format results for better readability
      const formattedResults = this.formatSearchResults(results);
      
      return {
        success: true,
        data: {
          query: params.query,
          types: params.types,
          results: formattedResults,
          pagination: {
            limit: params.limit,
            offset: params.offset,
            total: this.getTotalResults(results),
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

  private formatSearchResults(results: SearchResults): Record<string, unknown> {
    const formatted: Record<string, unknown> = {};

    if (results.tracks) {
      formatted.tracks = results.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        duration: this.formatDuration(track.duration_ms),
        uri: track.uri,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
      }));
    }

    if (results.albums) {
      formatted.albums = results.albums.items.map(album => ({
        id: album.id,
        name: album.name,
        artists: album.artists.map(artist => artist.name).join(', '),
        release_date: album.release_date,
        total_tracks: album.total_tracks,
        uri: album.uri,
        external_urls: album.external_urls,
        images: album.images,
      }));
    }

    if (results.artists) {
      formatted.artists = results.artists.items.map(artist => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers?.total,
        uri: artist.uri,
        external_urls: artist.external_urls,
        images: artist.images,
      }));
    }

    if (results.playlists) {
      formatted.playlists = results.playlists.items.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        owner: playlist.owner.display_name,
        tracks_total: playlist.tracks.total,
        public: playlist.public,
        uri: playlist.uri,
        external_urls: playlist.external_urls,
        images: playlist.images,
      }));
    }

    if (results.shows) {
      formatted.shows = results.shows.items.map(show => ({
        id: show.id,
        name: show.name,
        description: show.description,
        publisher: show.publisher,
        total_episodes: show.total_episodes,
        uri: show.uri,
        external_urls: show.external_urls,
        images: show.images,
      }));
    }

    if (results.episodes) {
      formatted.episodes = results.episodes.items.map(episode => ({
        id: episode.id,
        name: episode.name,
        description: episode.description,
        release_date: episode.release_date,
        duration: this.formatDuration(episode.duration_ms),
        uri: episode.uri,
        external_urls: episode.external_urls,
        images: episode.images,
      }));
    }

    return formatted;
  }

  private getTotalResults(results: SearchResults): number {
    let total = 0;
    if (results.tracks) total += results.tracks.total;
    if (results.albums) total += results.albums.total;
    if (results.artists) total += results.artists.total;
    if (results.playlists) total += results.playlists.total;
    if (results.shows) total += results.shows.total;
    if (results.episodes) total += results.episodes.total;
    return total;
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Tool for getting Spotify recommendations
 */
export class RecommendationsTool implements MCPTool {
  public readonly name = 'get_recommendations';
  public readonly description = 'Get Spotify recommendations based on seed tracks, artists, or genres';
  
  public readonly inputSchema = z.object({
    seedTracks: z.array(z.string()).optional().describe('Up to 5 seed track IDs'),
    seedArtists: z.array(z.string()).optional().describe('Up to 5 seed artist IDs'),
    seedGenres: z.array(z.string()).optional().describe('Up to 5 seed genres'),
    limit: z.number().min(1).max(100).default(20).describe('Number of recommendations (1-100)'),
    market: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code'),
    // Audio features for recommendations
    targetAcousticness: z.number().min(0).max(1).optional().describe('Target acousticness (0.0-1.0)'),
    targetDanceability: z.number().min(0).max(1).optional().describe('Target danceability (0.0-1.0)'),
    targetEnergy: z.number().min(0).max(1).optional().describe('Target energy (0.0-1.0)'),
    targetInstrumentalness: z.number().min(0).max(1).optional().describe('Target instrumentalness (0.0-1.0)'),
    targetLiveness: z.number().min(0).max(1).optional().describe('Target liveness (0.0-1.0)'),
    targetLoudness: z.number().optional().describe('Target loudness in dB'),
    targetSpeechiness: z.number().min(0).max(1).optional().describe('Target speechiness (0.0-1.0)'),
    targetTempo: z.number().min(0).optional().describe('Target tempo in BPM'),
    targetValence: z.number().min(0).max(1).optional().describe('Target valence/positivity (0.0-1.0)'),
    targetPopularity: z.number().min(0).max(100).optional().describe('Target popularity (0-100)'),
  }).describe('Recommendation parameters')
    .refine(data => {
      const totalSeeds = (data.seedTracks?.length || 0) + 
                        (data.seedArtists?.length || 0) + 
                        (data.seedGenres?.length || 0);
      return totalSeeds >= 1 && totalSeeds <= 5;
    }, {
      message: 'Must provide 1-5 total seeds (tracks + artists + genres)',
    });

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      // Build recommendations request
      const options: Record<string, unknown> = {
        limit: params.limit,
      };

      if (params.market) options.market = params.market;
      if (params.seedTracks) options.seed_tracks = params.seedTracks.join(',');
      if (params.seedArtists) options.seed_artists = params.seedArtists.join(',');
      if (params.seedGenres) options.seed_genres = params.seedGenres.join(',');

      // Add audio feature targets
      if (params.targetAcousticness !== undefined) options.target_acousticness = params.targetAcousticness;
      if (params.targetDanceability !== undefined) options.target_danceability = params.targetDanceability;
      if (params.targetEnergy !== undefined) options.target_energy = params.targetEnergy;
      if (params.targetInstrumentalness !== undefined) options.target_instrumentalness = params.targetInstrumentalness;
      if (params.targetLiveness !== undefined) options.target_liveness = params.targetLiveness;
      if (params.targetLoudness !== undefined) options.target_loudness = params.targetLoudness;
      if (params.targetSpeechiness !== undefined) options.target_speechiness = params.targetSpeechiness;
      if (params.targetTempo !== undefined) options.target_tempo = params.targetTempo;
      if (params.targetValence !== undefined) options.target_valence = params.targetValence;
      if (params.targetPopularity !== undefined) options.target_popularity = params.targetPopularity;

      const recommendations = await this.spotifyClient.getRecommendations(options);
      
      // Format recommendations
      const formattedTracks = recommendations.tracks.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        duration: this.formatDuration(track.duration_ms),
        popularity: track.popularity,
        uri: track.uri,
        preview_url: track.preview_url,
        external_urls: track.external_urls,
      }));

      return {
        success: true,
        data: {
          tracks: formattedTracks,
          seeds: {
            tracks: params.seedTracks || [],
            artists: params.seedArtists || [],
            genres: params.seedGenres || [],
          },
          total: formattedTracks.length,
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
 * Factory function to create all search tools
 */
export function createSearchTools(spotifyClient: ISpotifyClient): MCPTool[] {
  return [
    new SearchTool(spotifyClient),
    new RecommendationsTool(spotifyClient),
  ];
}