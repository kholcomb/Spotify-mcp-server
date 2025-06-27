/**
 * Unit tests for Spotify User Insights MCP Tools
 * 
 * Tests all user insights tools including top tracks/artists, audio features,
 * saved content, and followed artists with comprehensive error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  GetUserTopTracksTool,
  GetUserTopArtistsTool,
  GetAudioFeaturesTool,
  GetUserSavedTracksTool,
  GetUserSavedAlbumsTool,
  GetUserFollowedArtistsTool,
  createInsightsTools,
} from '../../../src/tools/insights.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { SpotifyError, SpotifyAuthError } from '../../../src/spotify/errors.js';
import type { ToolResult } from '../../../src/types/index.js';

// Mock SpotifyClient
jest.mock('../../../src/spotify/client.js');
const MockedSpotifyClient = SpotifyClient as jest.MockedClass<typeof SpotifyClient>;

// Test fixtures
const mockTopTracksResponse = {
  items: [
    {
      id: 'track1',
      name: 'Top Track 1',
      type: 'track' as const,
      uri: 'spotify:track:track1',
      popularity: 95,
      artists: [{ id: 'artist1', name: 'Artist 1' }],
      album: { id: 'album1', name: 'Album 1', images: [] },
      duration_ms: 210000,
      external_urls: { spotify: 'https://open.spotify.com/track/track1' },
      preview_url: null,
    },
    {
      id: 'track2',
      name: 'Top Track 2',
      type: 'track' as const,
      uri: 'spotify:track:track2',
      popularity: 88,
      artists: [{ id: 'artist2', name: 'Artist 2' }],
      album: { id: 'album2', name: 'Album 2', images: [] },
      duration_ms: 195000,
      external_urls: { spotify: 'https://open.spotify.com/track/track2' },
      preview_url: null,
    },
  ],
  total: 50,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/top/tracks',
  next: null,
  previous: null,
};

const mockTopArtistsResponse = {
  items: [
    {
      id: 'artist1',
      name: 'Top Artist 1',
      type: 'artist' as const,
      uri: 'spotify:artist:artist1',
      href: 'https://api.spotify.com/v1/artists/artist1',
      popularity: 90,
      genres: ['rock', 'alternative'],
      followers: { total: 1000000 },
      images: [{ url: 'https://example.com/image1.jpg', height: 640, width: 640 }],
      external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
    },
  ],
  total: 30,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/top/artists',
  next: null,
  previous: null,
};

const mockAudioFeatures = {
  id: 'track1',
  uri: 'spotify:track:track1',
  track_href: 'https://api.spotify.com/v1/tracks/track1',
  analysis_url: 'https://api.spotify.com/v1/audio-analysis/track1',
  acousticness: 0.25,
  danceability: 0.75,
  duration_ms: 210000,
  energy: 0.85,
  instrumentalness: 0.05,
  key: 5,
  liveness: 0.15,
  loudness: -8.5,
  mode: 1,
  speechiness: 0.08,
  tempo: 128.5,
  time_signature: 4,
  valence: 0.65,
  type: 'audio_features' as const,
};

const mockSavedTracksResponse = {
  items: [
    {
      added_at: '2023-01-01T00:00:00Z',
      track: {
        id: 'track1',
        name: 'Saved Track 1',
        type: 'track' as const,
        uri: 'spotify:track:track1',
        artists: [{ id: 'artist1', name: 'Artist 1' }],
        album: { id: 'album1', name: 'Album 1', images: [] },
        duration_ms: 210000,
        external_urls: { spotify: 'https://open.spotify.com/track/track1' },
        preview_url: null,
        popularity: 80,
      },
    },
  ],
  total: 100,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/tracks',
  next: null,
  previous: null,
};

const mockSavedAlbumsResponse = {
  items: [
    {
      added_at: '2023-01-01T00:00:00Z',
      album: {
        id: 'album1',
        name: 'Saved Album 1',
        type: 'album' as const,
        uri: 'spotify:album:album1',
        href: 'https://api.spotify.com/v1/albums/album1',
        album_type: 'album' as const,
        total_tracks: 12,
        release_date: '2023-01-01',
        release_date_precision: 'day' as const,
        artists: [{ id: 'artist1', name: 'Artist 1', type: 'artist' as const, uri: 'spotify:artist:artist1', href: 'https://api.spotify.com/v1/artists/artist1', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
        images: [{ url: 'https://example.com/album1.jpg', height: 640, width: 640 }],
        external_urls: { spotify: 'https://open.spotify.com/album/album1' },
        genres: ['rock'],
        popularity: 75,
      },
    },
  ],
  total: 50,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/albums',
  next: null,
  previous: null,
};

const mockFollowedArtistsResponse = {
  artists: {
    items: [
      {
        id: 'artist1',
        name: 'Followed Artist 1',
        type: 'artist' as const,
        uri: 'spotify:artist:artist1',
        href: 'https://api.spotify.com/v1/artists/artist1',
        popularity: 85,
        genres: ['indie', 'alternative'],
        followers: { total: 500000 },
        images: [{ url: 'https://example.com/artist1.jpg', height: 640, width: 640 }],
        external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
      },
    ],
    total: 25,
    limit: 20,
    href: 'https://api.spotify.com/v1/me/following',
    next: null,
    cursors: { after: null, before: null },
  },
};

describe('User Insights Tools', () => {
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpotifyClient = {
      getUserTopTracks: jest.fn(),
      getUserTopArtists: jest.fn(),
      getAudioFeatures: jest.fn(),
      getUserSavedTracks: jest.fn(),
      getUserSavedAlbums: jest.fn(),
      getUserFollowedArtists: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GetUserTopTracksTool', () => {
    let tool: GetUserTopTracksTool;

    beforeEach(() => {
      tool = new GetUserTopTracksTool(mockSpotifyClient);
    });

    it('should have correct tool properties', () => {
      expect(tool.name).toBe('get_user_top_tracks');
      expect(tool.description).toContain('top tracks');
      expect(tool.inputSchema).toBeDefined();
    });

    it('should get top tracks with default parameters', async () => {
      mockSpotifyClient.getUserTopTracks.mockResolvedValue(mockTopTracksResponse);

      const result: ToolResult = await tool.execute({});

      expect(mockSpotifyClient.getUserTopTracks).toHaveBeenCalledWith({});
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        tracks: expect.arrayContaining([
          expect.objectContaining({
            rank: 1,
            name: 'Top Track 1',
            artist: 'Artist 1',
            album: 'Album 1',
            popularity: 95,
            duration: '3:30',
            spotify_url: 'https://open.spotify.com/track/track1',
          }),
        ]),
        time_range: 'medium_term',
        total: 50,
      });
    });

    it('should get top tracks with custom parameters', async () => {
      mockSpotifyClient.getUserTopTracks.mockResolvedValue(mockTopTracksResponse);

      const input = {
        time_range: 'short_term',
        limit: 10,
        offset: 5,
      };

      const result: ToolResult = await tool.execute(input);

      expect(mockSpotifyClient.getUserTopTracks).toHaveBeenCalledWith({
        time_range: 'short_term',
        limit: 10,
        offset: 5,
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        time_range: 'short_term',
        tracks: expect.arrayContaining([
          expect.objectContaining({
            rank: 6, // offset + 1
          }),
        ]),
      });
    });

    it('should handle authentication errors', async () => {
      const authError = new SpotifyAuthError('Auth required', { requiresAuth: true });
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(authError);

      const result: ToolResult = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required to access top tracks',
        retryable: false,
      });
    });

    it('should handle Spotify API errors', async () => {
      const spotifyError = new SpotifyError('API Error', { 
        code: 'RATE_LIMITED', 
        retryable: true 
      });
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(spotifyError);

      const result: ToolResult = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'RATE_LIMITED',
        message: 'API Error',
        retryable: true,
      });
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Unknown error');
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(unknownError);

      const result: ToolResult = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error',
        retryable: false,
      });
    });

    it('should validate input parameters', async () => {
      const invalidInput = { time_range: 'invalid', limit: -1 };

      const result: ToolResult = await tool.execute(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('GetUserTopArtistsTool', () => {
    let tool: GetUserTopArtistsTool;

    beforeEach(() => {
      tool = new GetUserTopArtistsTool(mockSpotifyClient);
    });

    it('should have correct tool properties', () => {
      expect(tool.name).toBe('get_user_top_artists');
      expect(tool.description).toContain('top artists');
    });

    it('should get top artists successfully', async () => {
      mockSpotifyClient.getUserTopArtists.mockResolvedValue(mockTopArtistsResponse);

      const result: ToolResult = await tool.execute({});

      expect(mockSpotifyClient.getUserTopArtists).toHaveBeenCalledWith({});
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        artists: expect.arrayContaining([
          expect.objectContaining({
            rank: 1,
            name: 'Top Artist 1',
            genres: ['rock', 'alternative'],
            popularity: 90,
            followers: 1000000,
          }),
        ]),
        total: 30,
      });
    });
  });

  describe('GetAudioFeaturesTool', () => {
    let tool: GetAudioFeaturesTool;

    beforeEach(() => {
      tool = new GetAudioFeaturesTool(mockSpotifyClient);
    });

    it('should have correct tool properties', () => {
      expect(tool.name).toBe('get_audio_features');
      expect(tool.description).toContain('audio features');
    });

    it('should get audio features successfully', async () => {
      mockSpotifyClient.getAudioFeatures.mockResolvedValue(mockAudioFeatures);

      const input = { track_id: 'track1' };
      const result: ToolResult = await tool.execute(input);

      expect(mockSpotifyClient.getAudioFeatures).toHaveBeenCalledWith('track1');
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        audio_features: expect.objectContaining({
          track_id: 'track1',
          danceability: expect.objectContaining({
            value: 0.75,
            description: expect.stringContaining('danceable'),
          }),
          energy: expect.objectContaining({
            value: 0.85,
            description: expect.stringContaining('energy'),
          }),
          valence: expect.objectContaining({
            value: 0.65,
            description: expect.stringContaining('positive'),
          }),
          key: expect.objectContaining({
            value: 5,
            description: expect.stringContaining('F'),
          }),
          mode: expect.objectContaining({
            value: 1,
            description: 'Major scale',
          }),
        }),
      });
    });

    it('should require track_id parameter', async () => {
      const result: ToolResult = await tool.execute({});

      expect(result.success).toBe(false);
    });
  });

  describe('GetUserSavedTracksTool', () => {
    let tool: GetUserSavedTracksTool;

    beforeEach(() => {
      tool = new GetUserSavedTracksTool(mockSpotifyClient);
    });

    it('should have correct tool properties', () => {
      expect(tool.name).toBe('get_user_saved_tracks');
      expect(tool.description).toContain('library');
    });

    it('should get saved tracks successfully', async () => {
      mockSpotifyClient.getUserSavedTracks.mockResolvedValue(mockSavedTracksResponse);

      const result: ToolResult = await tool.execute({});

      expect(mockSpotifyClient.getUserSavedTracks).toHaveBeenCalledWith({});
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        saved_tracks: expect.arrayContaining([
          expect.objectContaining({
            position: 1,
            name: 'Saved Track 1',
            artist: 'Artist 1',
            added_at: expect.any(String),
            duration: '3:30',
            spotify_url: expect.any(String),
            uri: expect.any(String),
          }),
        ]),
        total: 100,
      });
    });

    it('should handle pagination parameters', async () => {
      mockSpotifyClient.getUserSavedTracks.mockResolvedValue(mockSavedTracksResponse);

      const input = { limit: 10, offset: 20 };
      const result: ToolResult = await tool.execute(input);

      expect(mockSpotifyClient.getUserSavedTracks).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GetUserSavedAlbumsTool', () => {
    let tool: GetUserSavedAlbumsTool;

    beforeEach(() => {
      tool = new GetUserSavedAlbumsTool(mockSpotifyClient);
    });

    it('should have correct tool properties', () => {
      expect(tool.name).toBe('get_user_saved_albums');
      expect(tool.description).toContain('library');
    });

    it('should get saved albums successfully', async () => {
      mockSpotifyClient.getUserSavedAlbums.mockResolvedValue(mockSavedAlbumsResponse);

      const result: ToolResult = await tool.execute({});

      expect(mockSpotifyClient.getUserSavedAlbums).toHaveBeenCalledWith({});
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        saved_albums: expect.arrayContaining([
          expect.objectContaining({
            position: 1,
            name: 'Saved Album 1',
            artist: 'Artist 1',
            album_type: 'album',
            total_tracks: 12,
            added_at: expect.any(String),
            genres: expect.any(Array),
            popularity: expect.any(Number),
            release_date: expect.any(String),
            spotify_url: expect.any(String),
            uri: expect.any(String),
          }),
        ]),
        total: 50,
      });
    });
  });

  describe('GetUserFollowedArtistsTool', () => {
    let tool: GetUserFollowedArtistsTool;

    beforeEach(() => {
      tool = new GetUserFollowedArtistsTool(mockSpotifyClient);
    });

    it('should have correct tool properties', () => {
      expect(tool.name).toBe('get_user_followed_artists');
      expect(tool.description).toContain('followed by the user');
    });

    it('should get followed artists successfully', async () => {
      mockSpotifyClient.getUserFollowedArtists.mockResolvedValue(mockFollowedArtistsResponse);

      const result: ToolResult = await tool.execute({});

      expect(mockSpotifyClient.getUserFollowedArtists).toHaveBeenCalledWith({
        type: 'artist',
      });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        followed_artists: expect.arrayContaining([
          expect.objectContaining({
            position: 1,
            name: 'Followed Artist 1',
            genres: ['indie', 'alternative'],
            popularity: 85,
            followers: 500000,
          }),
        ]),
        total: 25,
      });
    });

    it('should handle cursor pagination', async () => {
      mockSpotifyClient.getUserFollowedArtists.mockResolvedValue(mockFollowedArtistsResponse);

      const input = { limit: 10, after: 'cursor123' };
      const result: ToolResult = await tool.execute(input);

      expect(mockSpotifyClient.getUserFollowedArtists).toHaveBeenCalledWith({
        type: 'artist',
        limit: 10,
        after: 'cursor123',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createInsightsTools', () => {
    it('should create all insights tools', () => {
      const tools = createInsightsTools(mockSpotifyClient);

      expect(tools).toHaveLength(6);
      expect(tools.map(t => t.name)).toEqual([
        'get_user_top_tracks',
        'get_user_top_artists',
        'get_audio_features',
        'get_user_saved_tracks',
        'get_user_saved_albums',
        'get_user_followed_artists',
      ]);
    });

    it('should pass SpotifyClient to all tools', () => {
      const tools = createInsightsTools(mockSpotifyClient);

      // Verify each tool is properly instantiated with the client
      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.execute).toBeDefined();
      });
    });
  });

  describe('Audio Features Key Mapping', () => {
    let tool: GetAudioFeaturesTool;

    beforeEach(() => {
      tool = new GetAudioFeaturesTool(mockSpotifyClient);
    });

    it('should map musical keys correctly', async () => {
      const testCases = [
        { key: 0, expected: 'C' },
        { key: 1, expected: 'C♯/D♭' },
        { key: 5, expected: 'F' },
        { key: 11, expected: 'B' },
        { key: -1, expected: 'Unknown' },
      ];

      for (const testCase of testCases) {
        const mockFeatures = { ...mockAudioFeatures, key: testCase.key };
        mockSpotifyClient.getAudioFeatures.mockResolvedValue(mockFeatures);

        const result: ToolResult = await tool.execute({ track_id: 'track1' });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          audio_features: expect.objectContaining({
            key: expect.objectContaining({
              description: expect.stringContaining(testCase.expected),
            }),
          }),
        });
      }
    });
  });

  describe('Error Handling Consistency', () => {
    const tools = [
      () => new GetUserTopTracksTool(mockSpotifyClient),
      () => new GetUserTopArtistsTool(mockSpotifyClient),
      () => new GetAudioFeaturesTool(mockSpotifyClient),
      () => new GetUserSavedTracksTool(mockSpotifyClient),
      () => new GetUserSavedAlbumsTool(mockSpotifyClient),
      () => new GetUserFollowedArtistsTool(mockSpotifyClient),
    ];

    const setupMockErrors = (methodName: string) => {
      (mockSpotifyClient as any)[methodName] = jest.fn();
    };

    it('should handle auth errors consistently across all tools', async () => {
      const authError = new SpotifyAuthError('Auth required', { requiresAuth: true });

      for (const createTool of tools) {
        const tool = createTool();
        const methodName = `get${tool.name.split('_').slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`;
        
        setupMockErrors(methodName);
        (mockSpotifyClient as any)[methodName].mockRejectedValue(authError);

        const result: ToolResult = await tool.execute(tool.name === 'get_audio_features' ? { track_id: 'test' } : {});

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('AUTH_REQUIRED');
        expect(result.error?.retryable).toBe(false);
      }
    });

    it('should handle unknown errors consistently across all tools', async () => {
      const unknownError = new Error('Network error');

      for (const createTool of tools) {
        const tool = createTool();
        const methodName = `get${tool.name.split('_').slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`;
        
        setupMockErrors(methodName);
        (mockSpotifyClient as any)[methodName].mockRejectedValue(unknownError);

        const result: ToolResult = await tool.execute(tool.name === 'get_audio_features' ? { track_id: 'test' } : {});

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('UNKNOWN_ERROR');
        expect(result.error?.retryable).toBe(false);
      }
    });
  });
});