/**
 * Unit tests for Spotify Search MCP Tools
 * 
 * Tests search tools including catalog search and recommendations
 * with comprehensive input validation and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SearchTool,
  RecommendationsTool,
  createSearchTools,
} from '../../../src/tools/search.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { SpotifyError, SpotifyAuthError } from '../../../src/spotify/errors.js';
import { 
  mockSearchResults, 
  mockEmptySearchResults,
  mockRecommendationsResponse 
} from '../../fixtures/spotifyData.js';
import type { ToolResult } from '../../../src/types/index.js';

// Mock SpotifyClient
jest.mock('../../../src/spotify/client.js');
const MockedSpotifyClient = SpotifyClient as jest.MockedClass<typeof SpotifyClient>;

describe('Search Tools', () => {
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpotifyClient = {
      search: jest.fn(),
      getRecommendations: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SearchTool', () => {
    let searchTool: SearchTool;

    beforeEach(() => {
      searchTool = new SearchTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(searchTool.name).toBe('search');
      expect(searchTool.description).toBe('Search Spotify catalog for tracks, albums, artists, playlists, and shows');
      expect(searchTool.inputSchema).toBeDefined();
    });

    it('should search with minimal parameters', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const result = await searchTool.execute({
        query: 'test song',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockSpotifyClient.search).toHaveBeenCalledWith(
        'test song',
        ['track'], // default type
        expect.objectContaining({
          limit: 20, // default limit
          offset: 0, // default offset
        })
      );
    });

    it('should search with all parameters', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const result = await searchTool.execute({
        query: 'Beatles',
        types: ['track', 'album', 'artist'],
        market: 'US',
        limit: 10,
        offset: 20,
        includeExternal: true,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.search).toHaveBeenCalledWith(
        'Beatles',
        ['track', 'album', 'artist'],
        expect.objectContaining({
          market: 'US',
          limit: 10,
          offset: 20,
          include_external: 'audio',
        })
      );
    });

    it('should search for multiple types', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const result = await searchTool.execute({
        query: 'jazz',
        types: ['track', 'album', 'playlist'],
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.search).toHaveBeenCalledWith(
        'jazz',
        ['track', 'album', 'playlist'],
        expect.any(Object)
      );
    });

    it('should handle empty search results', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockEmptySearchResults);

      const result = await searchTool.execute({
        query: 'nosuchsongexists12345',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.results).toBeDefined();
    });

    it('should format search results correctly', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const result = await searchTool.execute({
        query: 'test',
        types: ['track'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('query');
      expect(result.data).toHaveProperty('types');
      expect(result.data).toHaveProperty('results');
      expect(result.data).toHaveProperty('pagination');
    });

    it('should validate query parameter', async () => {
      const result = await searchTool.execute({
        query: '', // Empty query
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate types parameter', async () => {
      const result = await searchTool.execute({
        query: 'test',
        types: ['invalid_type'], // Invalid search type
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate limit parameter', async () => {
      const result = await searchTool.execute({
        query: 'test',
        limit: 0, // Invalid limit
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate limit maximum', async () => {
      const result = await searchTool.execute({
        query: 'test',
        limit: 100, // Exceeds maximum of 50
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate market parameter', async () => {
      const result = await searchTool.execute({
        query: 'test',
        market: 'USA', // Invalid market code (should be 2 characters)
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate offset parameter', async () => {
      const result = await searchTool.execute({
        query: 'test',
        offset: -1, // Invalid negative offset
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle authentication errors', async () => {
      const authError = new SpotifyAuthError('Token expired');
      mockSpotifyClient.search.mockRejectedValue(authError);

      const result = await searchTool.execute({
        query: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
      expect(result.error?.message).toBe('Token expired');
    });

    it('should handle generic Spotify errors', async () => {
      const spotifyError = new SpotifyError('Service unavailable', { status: 503 });
      mockSpotifyClient.search.mockRejectedValue(spotifyError);

      const result = await searchTool.execute({
        query: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SPOTIFY_ERROR');
      expect(result.error?.message).toBe('Service unavailable');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockSpotifyClient.search.mockRejectedValue(networkError);

      const result = await searchTool.execute({
        query: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.message).toBe('Network timeout');
    });
  });

  describe('RecommendationsTool', () => {
    let recommendationsTool: RecommendationsTool;

    beforeEach(() => {
      recommendationsTool = new RecommendationsTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(recommendationsTool.name).toBe('get_recommendations');
      expect(recommendationsTool.description).toBe('Get Spotify recommendations based on seed tracks, artists, or genres');
      expect(recommendationsTool.inputSchema).toBeDefined();
    });

    it('should get recommendations with seed tracks', async () => {
      mockSpotifyClient.getRecommendations.mockResolvedValue(mockRecommendationsResponse);

      const result = await recommendationsTool.execute({
        seedTracks: ['track1', 'track2'],
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockSpotifyClient.getRecommendations).toHaveBeenCalledWith({
        seed_tracks: 'track1,track2',
        limit: 10,
      });
    });

    it('should get recommendations with seed artists', async () => {
      mockSpotifyClient.getRecommendations.mockResolvedValue(mockRecommendationsResponse);

      const result = await recommendationsTool.execute({
        seedArtists: ['artist1', 'artist2'],
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getRecommendations).toHaveBeenCalledWith({
        seed_artists: 'artist1,artist2',
        limit: 20,
      });
    });

    it('should get recommendations with seed genres', async () => {
      mockSpotifyClient.getRecommendations.mockResolvedValue(mockRecommendationsResponse);

      const result = await recommendationsTool.execute({
        seedGenres: ['rock', 'jazz'],
        limit: 15,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getRecommendations).toHaveBeenCalledWith({
        seed_genres: 'rock,jazz',
        limit: 15,
      });
    });

    it('should get recommendations with audio features', async () => {
      mockSpotifyClient.getRecommendations.mockResolvedValue(mockRecommendationsResponse);

      const result = await recommendationsTool.execute({
        seedTracks: ['track1'],
        targetEnergy: 0.8,
        minDanceability: 0.5,
        maxTempo: 120,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getRecommendations).toHaveBeenCalledWith({
        seed_tracks: 'track1',
        target_energy: 0.8,
        limit: 20,
      });
    });

    it('should get recommendations with market', async () => {
      mockSpotifyClient.getRecommendations.mockResolvedValue(mockRecommendationsResponse);

      const result = await recommendationsTool.execute({
        seedTracks: ['track1'],
        market: 'US',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.getRecommendations).toHaveBeenCalledWith({
        seed_tracks: 'track1',
        market: 'US',
        limit: 20,
      });
    });

    it('should require at least one seed', async () => {
      const result = await recommendationsTool.execute({
        limit: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate limit parameter', async () => {
      const result = await recommendationsTool.execute({
        seedTracks: ['track1'],
        limit: 150, // Exceeds maximum of 100
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate audio feature ranges', async () => {
      const result = await recommendationsTool.execute({
        seedTracks: ['track1'],
        targetEnergy: 1.5, // Exceeds maximum of 1.0
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate seed limits', async () => {
      const result = await recommendationsTool.execute({
        seedTracks: Array.from({ length: 6 }, (_, i) => `track${i}`), // Exceeds maximum of 5
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should format recommendations correctly', async () => {
      mockSpotifyClient.getRecommendations.mockResolvedValue(mockRecommendationsResponse);

      const result = await recommendationsTool.execute({
        seedTracks: ['track1'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('tracks');
      expect(result.data).toHaveProperty('seeds');
      expect(result.data).toHaveProperty('total');
    });

    it('should handle empty recommendations', async () => {
      mockSpotifyClient.getRecommendations.mockResolvedValue({
        tracks: [],
        seeds: [],
      });

      const result = await recommendationsTool.execute({
        seedTracks: ['track1'],
      });

      expect(result.success).toBe(true);
      expect(result.data.tracks).toHaveLength(0);
    });
  });

  describe('Tool Factory', () => {
    it('should create all search tools', () => {
      const tools = createSearchTools(mockSpotifyClient);

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toEqual([
        'search',
        'get_recommendations',
      ]);

      // Verify all tools are properly instantiated
      tools.forEach(tool => {
        expect(tool).toBeDefined();
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      });
    });

    it('should create tools with same Spotify client instance', () => {
      const tools = createSearchTools(mockSpotifyClient);

      // All tools should use the same client instance
      tools.forEach(tool => {
        expect((tool as any).spotifyClient).toBe(mockSpotifyClient);
      });
    });
  });

  describe('Integration Scenarios', () => {
    let tools: any[];

    beforeEach(() => {
      tools = createSearchTools(mockSpotifyClient);
    });

    it('should handle search then recommendations workflow', async () => {
      const searchTool = tools.find(t => t.name === 'search');
      const recommendationsTool = tools.find(t => t.name === 'get_recommendations');

      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);
      mockSpotifyClient.getRecommendations.mockResolvedValue(mockRecommendationsResponse);

      // Search for a track
      const searchResult = await searchTool.execute({
        query: 'test track',
        types: ['track'],
      });

      expect(searchResult.success).toBe(true);

      // Get recommendations based on found track
      const trackId = mockSearchResults.tracks?.items[0]?.id;
      const recommendationsResult = await recommendationsTool.execute({
        seedTracks: [trackId],
        limit: 5,
      });

      expect(recommendationsResult.success).toBe(true);
      expect(mockSpotifyClient.search).toHaveBeenCalled();
      expect(mockSpotifyClient.getRecommendations).toHaveBeenCalled();
    });

    it('should handle concurrent search requests', async () => {
      const searchTool = tools.find(t => t.name === 'search');

      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const promises = [
        searchTool.execute({ query: 'rock', types: ['track'] }),
        searchTool.execute({ query: 'jazz', types: ['album'] }),
        searchTool.execute({ query: 'classical', types: ['artist'] }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      expect(mockSpotifyClient.search).toHaveBeenCalledTimes(3);
    });

    it('should handle large result sets with pagination', async () => {
      const searchTool = tools.find(t => t.name === 'search');

      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      // First page
      const firstPage = await searchTool.execute({
        query: 'popular',
        limit: 20,
        offset: 0,
      });

      // Second page
      const secondPage = await searchTool.execute({
        query: 'popular',
        limit: 20,
        offset: 20,
      });

      expect(firstPage.success).toBe(true);
      expect(secondPage.success).toBe(true);
      expect(mockSpotifyClient.search).toHaveBeenCalledTimes(2);

      // Verify pagination parameters
      expect(mockSpotifyClient.search).toHaveBeenNthCalledWith(
        1,
        'popular',
        ['track'],
        expect.objectContaining({ offset: 0 })
      );
      expect(mockSpotifyClient.search).toHaveBeenNthCalledWith(
        2,
        'popular',
        ['track'],
        expect.objectContaining({ offset: 20 })
      );
    });
  });

  describe('Edge Cases', () => {
    let searchTool: SearchTool;

    beforeEach(() => {
      searchTool = new SearchTool(mockSpotifyClient);
    });

    it('should handle special characters in query', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const result = await searchTool.execute({
        query: 'artist: "The Beatles" year:1969',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.search).toHaveBeenCalledWith(
        'artist: "The Beatles" year:1969',
        ['track'],
        expect.any(Object)
      );
    });

    it('should handle Unicode characters in query', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const result = await searchTool.execute({
        query: 'ñüñéz ümläüt',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.search).toHaveBeenCalledWith(
        'ñüñéz ümläüt',
        ['track'],
        expect.any(Object)
      );
    });

    it('should handle very long queries', async () => {
      mockSpotifyClient.search.mockResolvedValue(mockSearchResults);

      const longQuery = 'a'.repeat(1000);
      const result = await searchTool.execute({
        query: longQuery,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.search).toHaveBeenCalledWith(
        longQuery,
        ['track'],
        expect.any(Object)
      );
    });

    it('should handle null input gracefully', async () => {
      const result = await searchTool.execute(null);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle undefined input gracefully', async () => {
      const result = await searchTool.execute(undefined);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });
});