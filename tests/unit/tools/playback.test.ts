/**
 * Unit tests for Spotify Playback MCP Tools
 * 
 * Tests all playback control tools including play, pause, skip,
 * volume, shuffle, and repeat controls with comprehensive error handling.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  PlayTool,
  PauseTool,
  SkipNextTool,
  SkipPreviousTool,
  SetVolumeTool,
  SetShuffleTool,
  SetRepeatTool,
  createPlaybackTools,
} from '../../../src/tools/playback.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { SpotifyError, SpotifyDeviceError, SpotifyPremiumRequiredError } from '../../../src/spotify/errors.js';
import { mockPlaybackState } from '../../fixtures/spotifyData.js';
import type { ToolResult } from '../../../src/types/index.js';

// Mock SpotifyClient
jest.mock('../../../src/spotify/client.js');
const MockedSpotifyClient = SpotifyClient as jest.MockedClass<typeof SpotifyClient>;

describe('Playback Tools', () => {
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpotifyClient = {
      startPlayback: jest.fn(),
      pausePlayback: jest.fn(),
      skipToNext: jest.fn(),
      skipToPrevious: jest.fn(),
      setVolume: jest.fn(),
      setShuffle: jest.fn(),
      setRepeat: jest.fn(),
      getCurrentPlayback: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PlayTool', () => {
    let playTool: PlayTool;

    beforeEach(() => {
      playTool = new PlayTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(playTool.name).toBe('play');
      expect(playTool.description).toBe('Start or resume Spotify playback');
      expect(playTool.inputSchema).toBeDefined();
    });

    it('should start playback with no parameters', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await playTool.execute({});

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Playback started successfully',
          options: {},
        },
      });
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({});
    });

    it('should start playback with device ID', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await playTool.execute({
        deviceId: 'test-device-123',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({
        device_id: 'test-device-123',
      });
    });

    it('should start playback with context URI', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await playTool.execute({
        contextUri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({
        context_uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
      });
    });

    it('should start playback with track URIs', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const trackUris = [
        'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
        'spotify:track:1301WleyT98MSxVHPZCA6M',
      ];

      const result = await playTool.execute({
        uris: trackUris,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({
        uris: trackUris,
      });
    });

    it('should start playback with position', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await playTool.execute({
        position: 60000, // 1 minute
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({
        position_ms: 60000,
      });
    });

    it('should handle all parameters together', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await playTool.execute({
        deviceId: 'test-device',
        contextUri: 'spotify:album:123',
        position: 30000,
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalledWith({
        device_id: 'test-device',
        context_uri: 'spotify:album:123',
        position_ms: 30000,
      });
    });

    it('should handle device errors', async () => {
      const deviceError = new SpotifyDeviceError('No active device found', {
        deviceRequired: true,
      });
      mockSpotifyClient.startPlayback.mockRejectedValue(deviceError);

      const result = await playTool.execute({});

      expect(result).toEqual({
        success: false,
        error: {
          code: 'DEVICE_ERROR',
          message: 'No active device found',
          details: 'Please start Spotify on a device and try again',
        },
      });
    });

    it('should handle premium required errors', async () => {
      const premiumError = new SpotifyPremiumRequiredError('Premium subscription required');
      mockSpotifyClient.startPlayback.mockRejectedValue(premiumError);

      const result = await playTool.execute({});

      expect(result).toEqual({
        success: false,
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'Premium subscription required',
          details: 'Spotify Premium subscription required for playback control',
        },
      });
    });

    it('should handle validation errors', async () => {
      const result = await playTool.execute({
        position: -1, // Invalid negative position
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle generic Spotify errors', async () => {
      const spotifyError = new SpotifyError('Generic error', { status: 500 });
      mockSpotifyClient.startPlayback.mockRejectedValue(spotifyError);

      const result = await playTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SPOTIFY_ERROR');
      expect(result.error?.message).toBe('Generic error');
      expect(result.error?.details).toBeDefined();
    });
  });

  describe('PauseTool', () => {
    let pauseTool: PauseTool;

    beforeEach(() => {
      pauseTool = new PauseTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(pauseTool.name).toBe('pause');
      expect(pauseTool.description).toBe('Pause Spotify playback');
    });

    it('should pause playback', async () => {
      mockSpotifyClient.pausePlayback.mockResolvedValue(undefined);

      const result = await pauseTool.execute({});

      expect(result).toEqual({
        success: true,
        data: { message: 'Playback paused successfully' },
      });
      expect(mockSpotifyClient.pausePlayback).toHaveBeenCalledWith(undefined);
    });

    it('should pause playback on specific device', async () => {
      mockSpotifyClient.pausePlayback.mockResolvedValue(undefined);

      const result = await pauseTool.execute({
        deviceId: 'test-device',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.pausePlayback).toHaveBeenCalledWith('test-device');
    });

    it('should handle errors', async () => {
      const error = new SpotifyError('Playback already paused');
      mockSpotifyClient.pausePlayback.mockRejectedValue(error);

      const result = await pauseTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Playback already paused');
    });
  });

  describe('SkipNextTool', () => {
    let skipNextTool: SkipNextTool;

    beforeEach(() => {
      skipNextTool = new SkipNextTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(skipNextTool.name).toBe('skip_next');
      expect(skipNextTool.description).toBe('Skip to the next track');
    });

    it('should skip to next track', async () => {
      mockSpotifyClient.skipToNext.mockResolvedValue(undefined);

      const result = await skipNextTool.execute({});

      expect(result).toEqual({
        success: true,
        data: { message: 'Skipped to next track successfully' },
      });
      expect(mockSpotifyClient.skipToNext).toHaveBeenCalledWith(undefined);
    });

    it('should skip to next track on specific device', async () => {
      mockSpotifyClient.skipToNext.mockResolvedValue(undefined);

      const result = await skipNextTool.execute({
        deviceId: 'test-device',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.skipToNext).toHaveBeenCalledWith('test-device');
    });
  });

  describe('SkipPreviousTool', () => {
    let skipPreviousTool: SkipPreviousTool;

    beforeEach(() => {
      skipPreviousTool = new SkipPreviousTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(skipPreviousTool.name).toBe('skip_previous');
      expect(skipPreviousTool.description).toBe('Skip to the previous track');
    });

    it('should skip to previous track', async () => {
      mockSpotifyClient.skipToPrevious.mockResolvedValue(undefined);

      const result = await skipPreviousTool.execute({});

      expect(result).toEqual({
        success: true,
        data: { message: 'Skipped to previous track successfully' },
      });
      expect(mockSpotifyClient.skipToPrevious).toHaveBeenCalledWith(undefined);
    });

    it('should skip to previous track on specific device', async () => {
      mockSpotifyClient.skipToPrevious.mockResolvedValue(undefined);

      const result = await skipPreviousTool.execute({
        deviceId: 'test-device',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.skipToPrevious).toHaveBeenCalledWith('test-device');
    });
  });

  describe('SetVolumeTool', () => {
    let setVolumeTool: SetVolumeTool;

    beforeEach(() => {
      setVolumeTool = new SetVolumeTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(setVolumeTool.name).toBe('set_volume');
      expect(setVolumeTool.description).toBe('Set playback volume (0-100)');
    });

    it('should set volume', async () => {
      mockSpotifyClient.setVolume.mockResolvedValue(undefined);

      const result = await setVolumeTool.execute({
        volume: 75,
      });

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Volume set to 75%',
          volume: 75,
        },
      });
      expect(mockSpotifyClient.setVolume).toHaveBeenCalledWith(75, undefined);
    });

    it('should set volume on specific device', async () => {
      mockSpotifyClient.setVolume.mockResolvedValue(undefined);

      const result = await setVolumeTool.execute({
        volume: 50,
        deviceId: 'test-device',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.setVolume).toHaveBeenCalledWith(50, 'test-device');
    });

    it('should validate volume range', async () => {
      const result = await setVolumeTool.execute({
        volume: 150, // Invalid volume > 100
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle negative volume', async () => {
      const result = await setVolumeTool.execute({
        volume: -10,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('SetShuffleTool', () => {
    let setShuffleTool: SetShuffleTool;

    beforeEach(() => {
      setShuffleTool = new SetShuffleTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(setShuffleTool.name).toBe('set_shuffle');
      expect(setShuffleTool.description).toBe('Toggle shuffle mode on/off');
    });

    it('should enable shuffle', async () => {
      mockSpotifyClient.setShuffle.mockResolvedValue(undefined);

      const result = await setShuffleTool.execute({
        shuffle: true,
      });

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Shuffle enabled',
          shuffle: true,
        },
      });
      expect(mockSpotifyClient.setShuffle).toHaveBeenCalledWith(true, undefined);
    });

    it('should disable shuffle', async () => {
      mockSpotifyClient.setShuffle.mockResolvedValue(undefined);

      const result = await setShuffleTool.execute({
        shuffle: false,
      });

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Shuffle disabled',
          shuffle: false,
        },
      });
      expect(mockSpotifyClient.setShuffle).toHaveBeenCalledWith(false, undefined);
    });

    it('should toggle shuffle on specific device', async () => {
      mockSpotifyClient.setShuffle.mockResolvedValue(undefined);

      const result = await setShuffleTool.execute({
        shuffle: true,
        deviceId: 'test-device',
      });

      expect(result.success).toBe(true);
      expect(mockSpotifyClient.setShuffle).toHaveBeenCalledWith(true, 'test-device');
    });
  });

  describe('SetRepeatTool', () => {
    let setRepeatTool: SetRepeatTool;

    beforeEach(() => {
      setRepeatTool = new SetRepeatTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(setRepeatTool.name).toBe('set_repeat');
      expect(setRepeatTool.description).toBe('Set repeat mode (off, track, context)');
    });

    it('should set repeat mode to track', async () => {
      mockSpotifyClient.setRepeat.mockResolvedValue(undefined);

      const result = await setRepeatTool.execute({
        repeat: 'track',
      });

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Repeat mode set to track',
          repeat: 'track',
        },
      });
      expect(mockSpotifyClient.setRepeat).toHaveBeenCalledWith('track', undefined);
    });

    it('should set repeat mode to context', async () => {
      mockSpotifyClient.setRepeat.mockResolvedValue(undefined);

      const result = await setRepeatTool.execute({
        repeat: 'context',
      });

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Repeat mode set to context',
          repeat: 'context',
        },
      });
      expect(mockSpotifyClient.setRepeat).toHaveBeenCalledWith('context', undefined);
    });

    it('should disable repeat', async () => {
      mockSpotifyClient.setRepeat.mockResolvedValue(undefined);

      const result = await setRepeatTool.execute({
        repeat: 'off',
      });

      expect(result).toEqual({
        success: true,
        data: { 
          message: 'Repeat mode set to off',
          repeat: 'off',
        },
      });
      expect(mockSpotifyClient.setRepeat).toHaveBeenCalledWith('off', undefined);
    });

    it('should validate repeat state', async () => {
      const result = await setRepeatTool.execute({
        repeat: 'invalid', // Invalid repeat state
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Tool Factory', () => {
    it('should create all playback tools', () => {
      const tools = createPlaybackTools(mockSpotifyClient);

      expect(tools).toHaveLength(9);
      expect(tools.map(t => t.name)).toEqual([
        'play',
        'pause',
        'skip_next',
        'skip_previous',
        'set_volume',
        'set_shuffle',
        'set_repeat',
        'seek',
        'transfer_playback',
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
      const tools = createPlaybackTools(mockSpotifyClient);

      // All tools should use the same client instance
      tools.forEach(tool => {
        expect((tool as any).spotifyClient).toBe(mockSpotifyClient);
      });
    });
  });

  describe('Error Handling Patterns', () => {
    let playTool: PlayTool;

    beforeEach(() => {
      playTool = new PlayTool(mockSpotifyClient);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockSpotifyClient.startPlayback.mockRejectedValue(networkError);

      const result = await playTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.message).toBe('Network timeout');
    });

    it('should handle malformed input', async () => {
      const result = await playTool.execute({
        deviceId: 123, // Should be string
        uris: 'not-an-array', // Should be array
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle null input', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await playTool.execute(null);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle undefined input', async () => {
      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);

      const result = await playTool.execute(undefined);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Integration Scenarios', () => {
    let tools: any[];

    beforeEach(() => {
      tools = createPlaybackTools(mockSpotifyClient);
    });

    it('should handle sequential tool execution', async () => {
      const playTool = tools.find(t => t.name === 'play');
      const pauseTool = tools.find(t => t.name === 'pause');

      mockSpotifyClient.startPlayback.mockResolvedValue(undefined);
      mockSpotifyClient.pausePlayback.mockResolvedValue(undefined);

      const playResult = await playTool.execute({});
      const pauseResult = await pauseTool.execute({});

      expect(playResult.success).toBe(true);
      expect(pauseResult.success).toBe(true);
      expect(mockSpotifyClient.startPlayback).toHaveBeenCalled();
      expect(mockSpotifyClient.pausePlayback).toHaveBeenCalled();
    });

    it('should handle concurrent tool execution', async () => {
      const volumeTool = tools.find(t => t.name === 'set_volume');
      const shuffleTool = tools.find(t => t.name === 'set_shuffle');

      mockSpotifyClient.setVolume.mockResolvedValue(undefined);
      mockSpotifyClient.setShuffle.mockResolvedValue(undefined);

      const promises = [
        volumeTool.execute({ volume: 80 }),
        shuffleTool.execute({ shuffle: true }),
      ];

      const results = await Promise.all(promises);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockSpotifyClient.setVolume).toHaveBeenCalledWith(80, undefined);
      expect(mockSpotifyClient.setShuffle).toHaveBeenCalledWith(true, undefined);
    });
  });
});