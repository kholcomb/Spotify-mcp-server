/**
 * Unit tests for user insights tools
 */

import { 
  GetUserTopTracksTool,
  GetUserTopArtistsTool,
  GetAudioFeaturesTool,
  GetUserSavedTracksTool,
  GetUserSavedAlbumsTool,
  GetUserFollowedArtistsTool,
  createInsightsTools
} from '../../../src/tools/insights.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { SpotifyError, SpotifyAuthError } from '../../../src/spotify/errors.js';
import type { 
  TopTracksResponse,
  TopArtistsResponse,
  AudioFeaturesResponse,
  SavedTracksResponse,
  SavedAlbumsResponse,
  FollowedArtistsResponse
} from '../../../src/types/index.js';

// Mock data
const mockTopTracksResponse: TopTracksResponse = {
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
    }
  ],
  total: 50,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/top/tracks',
  next: null,
  previous: null,
};

const mockTopArtistsResponse: TopArtistsResponse = {
  items: [
    {
      id: 'artist1',
      name: 'Top Artist 1',
      type: 'artist' as const,
      uri: 'spotify:artist:artist1',
      genres: ['pop', 'rock'],
      popularity: 90,
      followers: { total: 1000000 },
      images: [{ url: 'https://example.com/image.jpg', height: 640, width: 640 }],
      external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
    }
  ],
  total: 50,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/top/artists',
  next: null,
  previous: null,
};

const mockAudioFeaturesResponse: AudioFeaturesResponse = {
  audio_features: [
    {
      acousticness: 0.123,
      analysis_url: 'https://api.spotify.com/v1/audio-analysis/track1',
      danceability: 0.567,
      duration_ms: 210000,
      energy: 0.789,
      id: 'track1',
      instrumentalness: 0.012,
      key: 5,
      liveness: 0.034,
      loudness: -5.678,
      mode: 1,
      speechiness: 0.045,
      tempo: 120.123,
      time_signature: 4,
      track_href: 'https://api.spotify.com/v1/tracks/track1',
      type: 'audio_features' as const,
      uri: 'spotify:track:track1',
      valence: 0.678,
    }
  ]
};

const mockSavedTracksResponse: SavedTracksResponse = {
  items: [
    {
      added_at: '2023-01-01T00:00:00Z',
      track: {
        id: 'track1',
        name: 'Saved Track 1',
        type: 'track' as const,
        uri: 'spotify:track:track1',
        popularity: 85,
        artists: [{ id: 'artist1', name: 'Artist 1' }],
        album: { id: 'album1', name: 'Album 1', images: [] },
        duration_ms: 180000,
        external_urls: { spotify: 'https://open.spotify.com/track/track1' },
        preview_url: null,
      }
    }
  ],
  total: 100,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/tracks',
  next: null,
  previous: null,
};

const mockSavedAlbumsResponse: SavedAlbumsResponse = {
  items: [
    {
      added_at: '2023-01-01T00:00:00Z',
      album: {
        id: 'album1',
        name: 'Saved Album 1',
        uri: 'spotify:album:album1',
        artists: [{ id: 'artist1', name: 'Artist 1', external_urls: { spotify: 'https://open.spotify.com/artist/artist1' } }],
        release_date: '2023-01-01',
        total_tracks: 12,
        images: [{ url: 'https://example.com/album.jpg', height: 640, width: 640 }],
        external_urls: { spotify: 'https://open.spotify.com/album/album1' },
        album_type: 'album',
        type: 'album' as const,
      }
    }
  ],
  total: 50,
  limit: 20,
  offset: 0,
  href: 'https://api.spotify.com/v1/me/albums',
  next: null,
  previous: null,
};

const mockFollowedArtistsResponse: FollowedArtistsResponse = {
  artists: {
    items: [
      {
        id: 'artist1',
        name: 'Followed Artist 1',
        type: 'artist' as const,
        uri: 'spotify:artist:artist1',
        genres: ['indie', 'alternative'],
        popularity: 75,
        followers: { total: 500000 },
        images: [{ url: 'https://example.com/artist.jpg', height: 640, width: 640 }],
        external_urls: { spotify: 'https://open.spotify.com/artist/artist1' },
      }
    ],
    total: 25,
    limit: 20,
    href: 'https://api.spotify.com/v1/me/following?type=artist',
    next: null,
    cursors: { after: 'artist1' },
  }
};

describe('User Insights Tools', () => {
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;

  beforeEach(() => {
    mockSpotifyClient = {
      getUserTopTracks: jest.fn(),
      getUserTopArtists: jest.fn(),
      getAudioFeatures: jest.fn(),
      getUserSavedTracks: jest.fn(),
      getUserSavedAlbums: jest.fn(),
      getUserFollowedArtists: jest.fn(),
    } as any;
  });

  describe('GetUserTopTracksTool', () => {
    let tool: GetUserTopTracksTool;

    beforeEach(() => {
      tool = new GetUserTopTracksTool(mockSpotifyClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('get_user_top_tracks');
      expect(tool.description).toContain('top tracks');
    });

    it('should get top tracks with default parameters', async () => {
      mockSpotifyClient.getUserTopTracks.mockResolvedValue(mockTopTracksResponse);

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getUserTopTracks).toHaveBeenCalledWith({
        timeRange: 'medium_term',
        limit: 20,
        offset: 0,
      });
      expect(result.data).toEqual({
        tracks: [{
          rank: 1,
          id: 'track1',
          name: 'Top Track 1',
          artists: 'Artist 1',
          album: 'Album 1',
          popularity: 95,
          duration: '3:30',
          uri: 'spotify:track:track1',
          external_url: 'https://open.spotify.com/track/track1',
          preview_url: null,
        }],
        timeRange: 'medium_term',
        total: 50,
        pagination: {
          limit: 20,
          offset: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });
    });

    it('should get top tracks with custom parameters', async () => {
      mockSpotifyClient.getUserTopTracks.mockResolvedValue(mockTopTracksResponse);

      const result = await tool.execute({
        timeRange: 'short_term',
        limit: 10,
        offset: 5,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getUserTopTracks).toHaveBeenCalledWith({
        timeRange: 'short_term',
        limit: 10,
        offset: 5,
      });
    });

    it('should handle authentication errors', async () => {
      const authError = new SpotifyAuthError('Authentication failed', { requiresAuth: true });
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(authError);

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
    });

    it('should handle Spotify API errors', async () => {
      const spotifyError = new SpotifyError('API Error', { code: 'API_ERROR' });
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(spotifyError);

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('API_ERROR');
    });

    it('should handle unknown errors', async () => {
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(new Error('Unknown error'));

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate input parameters', async () => {
      const result = await tool.execute({
        timeRange: 'invalid',
        limit: 0,
        offset: -1,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('GetUserTopArtistsTool', () => {
    let tool: GetUserTopArtistsTool;

    beforeEach(() => {
      tool = new GetUserTopArtistsTool(mockSpotifyClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('get_user_top_artists');
      expect(tool.description).toContain('top artists');
    });

    it('should get top artists successfully', async () => {
      mockSpotifyClient.getUserTopArtists.mockResolvedValue(mockTopArtistsResponse);

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getUserTopArtists).toHaveBeenCalledWith({
        timeRange: 'medium_term',
        limit: 20,
        offset: 0,
      });
      expect(result.data).toEqual({
        artists: [{
          rank: 1,
          id: 'artist1',
          name: 'Top Artist 1',
          genres: ['pop', 'rock'],
          popularity: 90,
          followers: 1000000,
          uri: 'spotify:artist:artist1',
          external_url: 'https://open.spotify.com/artist/artist1',
          images: [{ url: 'https://example.com/image.jpg', height: 640, width: 640 }],
        }],
        timeRange: 'medium_term',
        total: 50,
        pagination: {
          limit: 20,
          offset: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });
    });
  });

  describe('GetAudioFeaturesTool', () => {
    let tool: GetAudioFeaturesTool;

    beforeEach(() => {
      tool = new GetAudioFeaturesTool(mockSpotifyClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('get_audio_features');
      expect(tool.description).toContain('audio features');
    });

    it('should get audio features for single track', async () => {
      mockSpotifyClient.getAudioFeatures.mockResolvedValue(mockAudioFeaturesResponse);

      const result = await tool.execute({ trackIds: 'track1' });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getAudioFeatures).toHaveBeenCalledWith(['track1']);
      expect(result.data).toEqual({
        audio_features: [{
          trackId: 'track1',
          acousticness: 0.123,
          danceability: 0.567,
          energy: 0.789,
          instrumentalness: 0.012,
          liveness: 0.034,
          loudness: -5.7,
          speechiness: 0.045,
          tempo: 120.1,
          valence: 0.678,
          key: 5,
          mode: 'major',
          time_signature: 4,
          duration_ms: 210000,
        }],
        total: 1,
      });
    });

    it('should get audio features for multiple tracks', async () => {
      mockSpotifyClient.getAudioFeatures.mockResolvedValue(mockAudioFeaturesResponse);

      const result = await tool.execute({ trackIds: ['track1', 'track2'] });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getAudioFeatures).toHaveBeenCalledWith(['track1', 'track2']);
    });

    it('should handle tracks with no audio features', async () => {
      const responseWithNull: AudioFeaturesResponse = {
        audio_features: [null, mockAudioFeaturesResponse.audio_features[0]]
      };
      mockSpotifyClient.getAudioFeatures.mockResolvedValue(responseWithNull);

      const result = await tool.execute({ trackIds: ['invalid_track', 'track1'] });

      expect(result.success).toBe(true);
      expect(result.data?.audio_features).toHaveLength(2);
      expect((result.data?.audio_features as any)[0]).toEqual({
        trackId: 'invalid_track',
        error: 'Audio features not available for this track',
      });
    });

    it('should reject more than 100 track IDs', async () => {
      const manyTrackIds = Array.from({ length: 101 }, (_, i) => `track${i}`);

      const result = await tool.execute({ trackIds: manyTrackIds });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
      expect(result.error?.message).toContain('Maximum 100 track IDs');
    });

    it('should handle mode conversion correctly', async () => {
      const responseWithMinorMode: AudioFeaturesResponse = {
        audio_features: [{
          ...mockAudioFeaturesResponse.audio_features[0]!,
          mode: 0, // minor mode
        }]
      };
      mockSpotifyClient.getAudioFeatures.mockResolvedValue(responseWithMinorMode);

      const result = await tool.execute({ trackIds: 'track1' });

      expect(result.success).toBe(true);
      expect((result.data?.audio_features as any)[0].mode).toBe('minor');
    });
  });

  describe('GetUserSavedTracksTool', () => {
    let tool: GetUserSavedTracksTool;

    beforeEach(() => {
      tool = new GetUserSavedTracksTool(mockSpotifyClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('get_user_saved_tracks');
      expect(tool.description).toContain('library');
    });

    it('should get saved tracks successfully', async () => {
      mockSpotifyClient.getUserSavedTracks.mockResolvedValue(mockSavedTracksResponse);

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getUserSavedTracks).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
      expect(result.data).toEqual({
        tracks: [{
          position: 1,
          added_at: '2023-01-01T00:00:00Z',
          track: {
            id: 'track1',
            name: 'Saved Track 1',
            artists: 'Artist 1',
            album: 'Album 1',
            duration: '3:00',
            popularity: 85,
            uri: 'spotify:track:track1',
            external_url: 'https://open.spotify.com/track/track1',
            preview_url: null,
          },
        }],
        total: 100,
        pagination: {
          limit: 20,
          offset: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });
    });
  });

  describe('GetUserSavedAlbumsTool', () => {
    let tool: GetUserSavedAlbumsTool;

    beforeEach(() => {
      tool = new GetUserSavedAlbumsTool(mockSpotifyClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('get_user_saved_albums');
      expect(tool.description).toContain('library');
    });

    it('should get saved albums successfully', async () => {
      mockSpotifyClient.getUserSavedAlbums.mockResolvedValue(mockSavedAlbumsResponse);

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getUserSavedAlbums).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });
      expect(result.data).toEqual({
        albums: [{
          position: 1,
          added_at: '2023-01-01T00:00:00Z',
          album: {
            id: 'album1',
            name: 'Saved Album 1',
            artists: 'Artist 1',
            release_date: '2023-01-01',
            total_tracks: 12,
            album_type: 'album',
            uri: 'spotify:album:album1',
            external_url: 'https://open.spotify.com/album/album1',
            images: [{ url: 'https://example.com/album.jpg', height: 640, width: 640 }],
          },
        }],
        total: 50,
        pagination: {
          limit: 20,
          offset: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });
    });
  });

  describe('GetUserFollowedArtistsTool', () => {
    let tool: GetUserFollowedArtistsTool;

    beforeEach(() => {
      tool = new GetUserFollowedArtistsTool(mockSpotifyClient);
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('get_user_followed_artists');
      expect(tool.description).toContain('followed');
    });

    it('should get followed artists successfully', async () => {
      mockSpotifyClient.getUserFollowedArtists.mockResolvedValue(mockFollowedArtistsResponse);

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getUserFollowedArtists).toHaveBeenCalledWith({
        limit: 20,
      });
      expect(result.data).toEqual({
        artists: [{
          position: 1,
          id: 'artist1',
          name: 'Followed Artist 1',
          genres: ['indie', 'alternative'],
          popularity: 75,
          followers: 500000,
          uri: 'spotify:artist:artist1',
          external_url: 'https://open.spotify.com/artist/artist1',
          images: [{ url: 'https://example.com/artist.jpg', height: 640, width: 640 }],
        }],
        total: 25,
        pagination: {
          limit: 20,
          after: undefined,
          hasNext: false,
          nextCursor: 'artist1',
        },
      });
    });

    it('should handle pagination with after parameter', async () => {
      mockSpotifyClient.getUserFollowedArtists.mockResolvedValue(mockFollowedArtistsResponse);

      const result = await tool.execute({ after: 'artist0' });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getUserFollowedArtists).toHaveBeenCalledWith({
        limit: 20,
        after: 'artist0',
      });
    });
  });

  describe('createInsightsTools', () => {
    it('should create all insight tools', () => {
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

    it('should create tools with correct client injection', () => {
      const tools = createInsightsTools(mockSpotifyClient);

      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.execute).toBe('function');
      }
    });
  });

  // Integration tests for error scenarios
  describe('Error Handling', () => {
    it('should handle network timeouts consistently across all tools', async () => {
      const timeoutError = new Error('Network timeout');
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(timeoutError);
      mockSpotifyClient.getUserTopArtists.mockRejectedValue(timeoutError);
      mockSpotifyClient.getAudioFeatures.mockRejectedValue(timeoutError);
      mockSpotifyClient.getUserSavedTracks.mockRejectedValue(timeoutError);
      mockSpotifyClient.getUserSavedAlbums.mockRejectedValue(timeoutError);
      mockSpotifyClient.getUserFollowedArtists.mockRejectedValue(timeoutError);

      const tools = createInsightsTools(mockSpotifyClient);
      const testInputs = [
        {}, // get_user_top_tracks
        {}, // get_user_top_artists
        { trackIds: ['track1'] }, // get_audio_features
        {}, // get_user_saved_tracks
        {}, // get_user_saved_albums
        {}, // get_user_followed_artists
      ];
      
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        const input = testInputs[i];
        const result = await tool.execute(input);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('UNKNOWN_ERROR');
        expect(result.error?.message).toBe('Network timeout');
      }
    });

    it('should handle rate limiting consistently across all tools', async () => {
      const rateLimitError = new SpotifyError('Rate limited', { 
        code: 'RATE_LIMITED',
        retryable: true 
      });
      
      mockSpotifyClient.getUserTopTracks.mockRejectedValue(rateLimitError);
      mockSpotifyClient.getUserTopArtists.mockRejectedValue(rateLimitError);
      mockSpotifyClient.getAudioFeatures.mockRejectedValue(rateLimitError);
      mockSpotifyClient.getUserSavedTracks.mockRejectedValue(rateLimitError);
      mockSpotifyClient.getUserSavedAlbums.mockRejectedValue(rateLimitError);
      mockSpotifyClient.getUserFollowedArtists.mockRejectedValue(rateLimitError);

      const tools = createInsightsTools(mockSpotifyClient);
      const testInputs = [
        {}, // get_user_top_tracks
        {}, // get_user_top_artists
        { trackIds: ['track1'] }, // get_audio_features
        {}, // get_user_saved_tracks
        {}, // get_user_saved_albums
        {}, // get_user_followed_artists
      ];
      
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        const input = testInputs[i];
        const result = await tool.execute(input);
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('RATE_LIMITED');
      }
    });
  });
});