/**
 * Unit tests for Spotify Queue MCP Tools
 * 
 * Tests queue management tools including add to queue, view queue,
 * and bulk queue operations with comprehensive error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  AddToQueueTool,
  GetQueueTool,
  AddPlaylistToQueueTool,
  ClearQueueTool,
  createQueueTools,
} from '../../../src/tools/queue.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { SpotifyError, SpotifyDeviceError, SpotifyPremiumRequiredError } from '../../../src/spotify/errors.js';
import { mockQueueState } from '../../fixtures/spotifyData.js';
import type { ToolResult } from '../../../src/types/index.js';

// Mock SpotifyClient
jest.mock('../../../src/spotify/client.js');
const MockedSpotifyClient = SpotifyClient as jest.MockedClass<typeof SpotifyClient>;

describe('Queue Tools', () => {
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpotifyClient = {
      addToQueue: jest.fn(),
      getQueue: jest.fn(),
      skipToNext: jest.fn(),
      getCurrentPlayback: jest.fn(),
      startPlayback: jest.fn(),
      pausePlayback: jest.fn(),
      getPlaylistTracks: jest.fn(),
      getAlbumTracks: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AddToQueueTool', () => {
    let addToQueueTool: AddToQueueTool;

    beforeEach(() => {
      addToQueueTool = new AddToQueueTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(addToQueueTool.name).toBe('add_to_queue');
      expect(addToQueueTool.description).toBe('Add a track to the Spotify playback queue');
      expect(addToQueueTool.inputSchema).toBeDefined();
    });

    it('should add track to queue', async () => {
      mockSpotifyClient.addToQueue.mockResolvedValue(undefined);

      const result = await addToQueueTool.execute({
        uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
      });

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Track added to queue successfully',
          uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
          trackId: '4iV5W9uYEdYUVa79Axb7Rh',
        },
      });
      expect(mockSpotifyClient.addToQueue).toHaveBeenCalledWith(
        'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
        undefined
      );
    });

    it('should add track to queue on specific device', async () => {
      mockSpotifyClient.addToQueue.mockResolvedValue(undefined);

      const result = await addToQueueTool.execute({
        uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
        deviceId: 'test-device-123',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.addToQueue).toHaveBeenCalledWith(
        'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
        'test-device-123'
      );
    });

    it('should reject episode to queue (tracks only)', async () => {
      const result = await addToQueueTool.execute({
        uri: 'spotify:episode:512ojhOuo1ktJprKbVcKyQ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_URI');
      expect(result.error?.message).toBe('Invalid Spotify track URI format');
    });

    it('should validate URI format', async () => {
      const result = await addToQueueTool.execute({
        uri: 'invalid-uri',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_URI');
    });

    it('should validate required URI parameter', async () => {
      const result = await addToQueueTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle device errors', async () => {
      const deviceError = new SpotifyDeviceError('No active device found', {
        deviceRequired: true,
      });
      mockSpotifyClient.addToQueue.mockRejectedValue(deviceError);

      const result = await addToQueueTool.execute({
        uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
      });

      expect(result).toEqual({
        success: false,
        error: {
          code: 'SPOTIFY_DEVICE_ERROR',
          message: 'No active device found',
          details: {
            code: 'SPOTIFY_DEVICE_ERROR',
            deviceRequired: true,
            retryable: false,
          },
        },
      });
    });

    it('should handle premium required errors', async () => {
      const premiumError = new SpotifyPremiumRequiredError('Premium subscription required');
      mockSpotifyClient.addToQueue.mockRejectedValue(premiumError);

      const result = await addToQueueTool.execute({
        uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
      });

      expect(result).toEqual({
        success: false,
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'Premium subscription required',
          details: 'Spotify Premium subscription required for queue management',
        },
      });
    });

    it('should handle generic Spotify errors', async () => {
      const spotifyError = new SpotifyError('Queue is full', { status: 403 });
      mockSpotifyClient.addToQueue.mockRejectedValue(spotifyError);

      const result = await addToQueueTool.execute({
        uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
      });

      expect(result).toEqual({
        success: false,
        error: {
          code: 'SPOTIFY_ERROR',
          message: 'Queue is full',
          details: {
            code: 'SPOTIFY_ERROR',
            retryable: false,
            status: 403,
          },
        },
      });
    });
  });

  describe('GetQueueTool', () => {
    let getQueueTool: GetQueueTool;

    beforeEach(() => {
      getQueueTool = new GetQueueTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(getQueueTool.name).toBe('get_queue');
      expect(getQueueTool.description).toBe('Get the current Spotify playback queue');
      expect(getQueueTool.inputSchema).toBeDefined();
    });

    it('should get queue with default parameters', async () => {
      mockSpotifyClient.getQueue.mockResolvedValue(mockQueueState);

      const result = await getQueueTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('currently_playing');
      expect(result.data).toHaveProperty('queue');
      expect(result.data).toHaveProperty('total_queue_items');
      expect(mockSpotifyClient.getQueue).toHaveBeenCalled();
    });

    it('should format queue data correctly', async () => {
      mockSpotifyClient.getQueue.mockResolvedValue(mockQueueState);

      const result = await getQueueTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.total_queue_items).toBe(2);
      expect(result.data.currently_playing).toHaveProperty('name');
      expect(result.data.queue).toHaveLength(2);
    });

    it('should limit queue results', async () => {
      mockSpotifyClient.getQueue.mockResolvedValue(mockQueueState);

      const result = await getQueueTool.execute({
        limit: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data.queue).toHaveLength(1);
      expect(result.data.showing).toBe(1);
    });

    it('should include detailed track information', async () => {
      mockSpotifyClient.getQueue.mockResolvedValue(mockQueueState);

      const result = await getQueueTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.queue[0]).toHaveProperty('artists');
      expect(result.data.queue[0]).toHaveProperty('album');
      expect(result.data.queue[0]).toHaveProperty('duration');
      expect(result.data.queue[0]).toHaveProperty('position');
    });

    it('should handle empty queue', async () => {
      mockSpotifyClient.getQueue.mockResolvedValue({
        currently_playing: null,
        queue: [],
      });

      const result = await getQueueTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.total_queue_items).toBe(0);
      expect(result.data.queue).toHaveLength(0);
      expect(result.data.currently_playing).toBeNull();
    });

    it('should validate limit parameter', async () => {
      const result = await getQueueTool.execute({
        limit: 0, // Invalid limit
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should validate maximum limit', async () => {
      const result = await getQueueTool.execute({
        limit: 51, // Exceeds maximum of 50
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle API errors', async () => {
      const apiError = new SpotifyError('Unable to get queue', { status: 500 });
      mockSpotifyClient.getQueue.mockRejectedValue(apiError);

      const result = await getQueueTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SPOTIFY_ERROR');
      expect(result.error?.message).toBe('Unable to get queue');
    });
  });

  describe('ClearQueueTool', () => {
    let clearQueueTool: ClearQueueTool;

    beforeEach(() => {
      clearQueueTool = new ClearQueueTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(clearQueueTool.name).toBe('clear_queue');
      expect(clearQueueTool.description).toBe('Clear the current playback queue');
      expect(clearQueueTool.inputSchema).toBeDefined();
    });

    it('should clear queue while keeping current track', async () => {
      // Mock current playback
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue({
        item: {
          uri: 'spotify:track:currentTrack',
          name: 'Current Track',
        },
        progress_ms: 60000,
      });
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await clearQueueTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Queue cleared while keeping current track');
      expect(result.data.cleared).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({
        uris: ['spotify:track:currentTrack'],
        positionMs: 60000,
      });
    });

    it('should handle no active playback session', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue(null);

      const result = await clearQueueTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('No active playback session to clear queue for');
      expect(result.data.cleared).toBe(false);
      expect(mockSpotifyClient.startPlayback).not.toHaveBeenCalled();
    });

    it('should clear queue without keeping current track', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue({
        item: {
          uri: 'spotify:track:currentTrack',
          name: 'Current Track',
        },
        progress_ms: 60000,
      });
      mockSpotifyClient.pausePlayback.mockResolvedValue(undefined);

      const result = await clearQueueTool.execute({
        keepCurrent: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Queue and playback cleared');
      expect(result.data.cleared).toBe(true);
      expect(mockSpotifyClient.pausePlayback).toHaveBeenCalledWith(undefined);
    });

    it('should clear queue on specific device', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue({
        item: {
          uri: 'spotify:track:currentTrack',
          name: 'Current Track',
        },
        progress_ms: 60000,
      });
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await clearQueueTool.execute({
        deviceId: 'test-device',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({
        uris: ['spotify:track:currentTrack'],
        positionMs: 60000,
        deviceId: 'test-device',
      });
    });

    it('should handle errors during queue clearing', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue({
        item: { uri: 'spotify:track:test' },
        progress_ms: 0,
      });
      mockSpotifyClient.startPlayback.mockRejectedValue(new SpotifyError('Playback failed', { status: 500 }));

      const result = await clearQueueTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SPOTIFY_ERROR');
      expect(result.error?.message).toBe('Playback failed');
    });

    it('should validate input parameters', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue({
        item: { uri: 'spotify:track:test' },
        progress_ms: 0,
      });
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);
      
      const result = await clearQueueTool.execute({
        keepCurrent: true,
        deviceId: 'valid-device',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Tool Factory', () => {
    it('should create all queue tools', () => {
      const tools = createQueueTools(mockSpotifyClient);

      expect(tools).toHaveLength(4);
      expect(tools.map(t => t.name)).toEqual([
        'add_to_queue',
        'get_queue',
        'add_playlist_to_queue',
        'clear_queue',
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
      const tools = createQueueTools(mockSpotifyClient);

      // All tools should use the same client instance
      tools.forEach(tool => {
        expect((tool as any).spotifyClient).toBe(mockSpotifyClient);
      });
    });
  });

  describe('Integration Scenarios', () => {
    let tools: any[];

    beforeEach(() => {
      tools = createQueueTools(mockSpotifyClient);
    });

    it('should handle add then view queue workflow', async () => {
      const addTool = tools.find(t => t.name === 'add_to_queue');
      const viewTool = tools.find(t => t.name === 'get_queue');

      mockSpotifyClient.addToQueue.mockResolvedValue(undefined);
      mockSpotifyClient.getQueue.mockResolvedValue(mockQueueState);

      // Add track to queue
      const addResult = await addTool.execute({
        uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
      });

      expect(addResult.success).toBe(true);

      // View updated queue
      const viewResult = await viewTool.execute({});

      expect(viewResult.success).toBe(true);
      expect(mockSpotifyClient.addToQueue).toHaveBeenCalled();
      expect(mockSpotifyClient.getQueue).toHaveBeenCalled();
    });

    it('should handle bulk queue operations', async () => {
      const addTool = tools.find(t => t.name === 'add_to_queue');

      mockSpotifyClient.addToQueue.mockResolvedValue(undefined);

      const trackUris = [
        'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
        'spotify:track:1301WleyT98MSxVHPZCA6M',
        'spotify:track:6DCZcSspjsKoFjzjrWoCdn',
      ];

      const promises = trackUris.map(uri =>
        addTool.execute({ uri })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      expect(mockSpotifyClient.addToQueue).toHaveBeenCalledTimes(3);
    });

    it('should handle queue management workflow', async () => {
      const addTool = tools.find(t => t.name === 'add_to_queue');
      const viewTool = tools.find(t => t.name === 'get_queue');
      const clearTool = tools.find(t => t.name === 'clear_queue');

      // Setup mocks
      mockSpotifyClient.addToQueue.mockResolvedValue(undefined);
      mockSpotifyClient.getQueue
        .mockResolvedValueOnce(mockQueueState); // For view
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue({
        item: { uri: 'spotify:track:test', name: 'Test Track' },
        progress_ms: 0,
      });
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      // Add tracks
      const addResult = await addTool.execute({
        uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
      });

      // View queue
      const viewResult = await viewTool.execute({});

      // Clear queue
      const clearResult = await clearTool.execute({});

      expect(addResult.success).toBe(true);
      expect(viewResult.success).toBe(true);
      expect(clearResult.success).toBe(true);
      expect(clearResult.data.cleared).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    let addTool: AddToQueueTool;

    beforeEach(() => {
      addTool = new AddToQueueTool(mockSpotifyClient);
    });

    it('should handle valid track URI formats', async () => {
      mockSpotifyClient.addToQueue.mockResolvedValue(undefined);

      const validUris = [
        'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
        'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh',
      ];

      for (const uri of validUris) {
        const result = await addTool.execute({ uri });
        expect(result.success).toBe(true);
      }

      expect(mockSpotifyClient.addToQueue).toHaveBeenCalledTimes(validUris.length);
    });

    it('should reject invalid URI formats', async () => {
      const schemaInvalidUris = [
        '', // Empty string fails schema validation
      ];
      
      const formatInvalidUris = [
        'spotify:episode:512ojhOuo1ktJprKbVcKyQ', // Episodes not allowed
        'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', // Playlists can't be added to queue
        'spotify:track:tooshort', // Track ID too short
        'https://open.spotify.com/playlist/123', // Wrong URL type
        'not-a-uri',
      ];

      // Test schema validation failures
      for (const uri of schemaInvalidUris) {
        const result = await addTool.execute({ uri });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('UNKNOWN_ERROR');
      }
      
      // Test format validation failures
      for (const uri of formatInvalidUris) {
        const result = await addTool.execute({ uri });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_URI');
      }
    });

    it('should handle null and undefined inputs', async () => {
      const result1 = await addTool.execute(null);
      const result2 = await addTool.execute(undefined);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    it('should handle concurrent queue operations gracefully', async () => {
      const viewTool = new GetQueueTool(mockSpotifyClient);

      mockSpotifyClient.addToQueue.mockResolvedValue(undefined);
      mockSpotifyClient.getQueue.mockResolvedValue(mockQueueState);

      // Simulate concurrent add and view operations
      const promises = [
        addTool.execute({ uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh' }),
        addTool.execute({ uri: 'spotify:track:1301WleyT98MSxVHPZCA6M' }),
        viewTool.execute({}),
        addTool.execute({ uri: 'spotify:track:6DCZcSspjsKoFjzjrWoCdn' }),
        viewTool.execute({}),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});