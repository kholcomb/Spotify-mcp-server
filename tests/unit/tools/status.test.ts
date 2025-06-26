/**
 * Unit tests for Spotify Status MCP Tools
 * 
 * Tests status and information tools including playback status, devices,
 * user profile, and authentication management.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  GetPlaybackStatusTool,
  GetDevicesTool,
  GetUserProfileTool,
  AuthenticateTool,
  GetAuthStatusTool,
  createStatusTools,
} from '../../../src/tools/status.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { AuthService } from '../../../src/auth/authService.js';
import { SpotifyError, SpotifyAuthError } from '../../../src/spotify/errors.js';
import { 
  mockPlaybackState,
  mockDevicesResponse,
  mockUserProfile,
} from '../../fixtures/spotifyData.js';
import type { ToolResult } from '../../../src/types/index.js';

// Mock dependencies
jest.mock('../../../src/spotify/client.js');
jest.mock('../../../src/auth/authService.js');

const MockedSpotifyClient = SpotifyClient as jest.MockedClass<typeof SpotifyClient>;
const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;

describe('Status Tools', () => {
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpotifyClient = {
      getCurrentPlayback: jest.fn(),
      getAvailableDevices: jest.fn(),
      getUserProfile: jest.fn(),
    } as any;

    mockAuthService = {
      startAuthFlow: jest.fn(),
      getAuthStatus: jest.fn(),
      isAuthenticated: jest.fn(),
      revokeAuth: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GetPlaybackStatusTool', () => {
    let playbackStatusTool: GetPlaybackStatusTool;

    beforeEach(() => {
      playbackStatusTool = new GetPlaybackStatusTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(playbackStatusTool.name).toBe('get_playback_status');
      expect(playbackStatusTool.description).toBe('Get current Spotify playback status');
      expect(playbackStatusTool.inputSchema).toBeDefined();
    });

    it('should get playback status with active playback', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue(mockPlaybackState);

      const result = await playbackStatusTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPlaybackState);
      expect(mockSpotifyClient.getCurrentPlayback).toHaveBeenCalled();
    });

    it('should handle no active playback', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue(null);

      const result = await playbackStatusTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        is_playing: false,
        message: 'No active playback session found',
      });
    });

    it('should handle API errors', async () => {
      const apiError = new SpotifyError('Unable to get playback state', { status: 500 });
      mockSpotifyClient.getCurrentPlayback.mockRejectedValue(apiError);

      const result = await playbackStatusTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SPOTIFY_ERROR');
      expect(result.error?.message).toBe('Unable to get playback state');
    });
  });

  describe('GetDevicesTool', () => {
    let devicesTool: GetDevicesTool;

    beforeEach(() => {
      devicesTool = new GetDevicesTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(devicesTool.name).toBe('get_devices');
      expect(devicesTool.description).toBe('Get available Spotify devices');
      expect(devicesTool.inputSchema).toBeDefined();
    });

    it('should list available devices', async () => {
      mockSpotifyClient.getAvailableDevices.mockResolvedValue(mockDevicesResponse);

      const result = await devicesTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('devices');
      expect(Array.isArray(result.data.devices)).toBe(true);
      expect(mockSpotifyClient.getAvailableDevices).toHaveBeenCalled();
    });

    it('should handle no devices available', async () => {
      mockSpotifyClient.getAvailableDevices.mockResolvedValue({
        devices: [],
      });

      const result = await devicesTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data.devices).toHaveLength(0);
    });
  });

  describe('GetUserProfileTool', () => {
    let userProfileTool: GetUserProfileTool;

    beforeEach(() => {
      userProfileTool = new GetUserProfileTool(mockSpotifyClient);
    });

    it('should have correct tool metadata', () => {
      expect(userProfileTool.name).toBe('get_user_profile');
      expect(userProfileTool.description).toBe('Get current user profile information');
      expect(userProfileTool.inputSchema).toBeDefined();
    });

    it('should get user profile', async () => {
      mockSpotifyClient.getUserProfile.mockResolvedValue(mockUserProfile);

      const result = await userProfileTool.execute({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserProfile);
      expect(mockSpotifyClient.getUserProfile).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      const authError = new SpotifyAuthError('Access token expired');
      mockSpotifyClient.getUserProfile.mockRejectedValue(authError);

      const result = await userProfileTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_ERROR');
      expect(result.error?.message).toBe('Access token expired');
    });
  });

  describe('AuthenticateTool', () => {
    let authenticateTool: AuthenticateTool;

    beforeEach(() => {
      authenticateTool = new AuthenticateTool(mockAuthService);
    });

    it('should have correct tool metadata', () => {
      expect(authenticateTool.name).toBe('authenticate');
      expect(authenticateTool.description).toBe('Start Spotify authentication flow');
      expect(authenticateTool.inputSchema).toBeDefined();
    });

    it('should start authentication flow', async () => {
      mockAuthService.startAuthFlow.mockResolvedValue({
        success: true,
        authUrl: 'https://accounts.spotify.com/authorize?...',
      });

      const result = await authenticateTool.execute({ userId: 'test-user' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('authUrl');
      expect(result.data.authUrl).toContain('accounts.spotify.com');
      expect(mockAuthService.startAuthFlow).toHaveBeenCalled();
    });

    it('should handle authentication flow failure', async () => {
      mockAuthService.startAuthFlow.mockResolvedValue({
        success: false,
        error: 'Failed to start OAuth flow',
      });

      const result = await authenticateTool.execute({ userId: 'test-user' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to start OAuth flow');
    });
  });

  describe('GetAuthStatusTool', () => {
    let getAuthStatusTool: GetAuthStatusTool;

    beforeEach(() => {
      getAuthStatusTool = new GetAuthStatusTool(mockAuthService);
    });

    it('should have correct tool metadata', () => {
      expect(getAuthStatusTool.name).toBe('get_auth_status');
      expect(getAuthStatusTool.description).toBe('Check current authentication status');
      expect(getAuthStatusTool.inputSchema).toBeDefined();
    });

    it('should check authentication status', async () => {
      mockAuthService.getAuthStatus.mockResolvedValue({
        authenticated: true,
        hasValidToken: true,
        tokenExpired: false,
        userId: 'test-user',
        message: 'User authenticated successfully',
      });

      const result = await getAuthStatusTool.execute({ userId: 'test-user' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('authenticated', true);
      expect(result.data).toHaveProperty('userId', 'test-user');
      expect(mockAuthService.getAuthStatus).toHaveBeenCalled();
    });

    it('should handle unauthenticated status', async () => {
      mockAuthService.getAuthStatus.mockResolvedValue({
        authenticated: false,
        hasValidToken: false,
        tokenExpired: true,
        userId: null,
        message: 'Not authenticated',
      });

      const result = await getAuthStatusTool.execute({ userId: 'test-user' });

      expect(result.success).toBe(true);
      expect(result.data.authenticated).toBe(false);
      expect(result.data.message).toContain('Not authenticated');
    });
  });

  describe('Tool Factory', () => {
    it('should create all status tools', () => {
      const tools = createStatusTools(mockSpotifyClient, mockAuthService);

      expect(tools).toHaveLength(5);
      expect(tools.map(t => t.name)).toEqual([
        'get_playback_status',
        'get_devices',
        'get_user_profile',
        'authenticate',
        'get_auth_status',
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

    it('should create tools with correct service instances', () => {
      const tools = createStatusTools(mockSpotifyClient, mockAuthService);

      // Spotify client tools
      const spotifyTools = tools.slice(0, 3);
      spotifyTools.forEach(tool => {
        expect((tool as any).spotifyClient).toBe(mockSpotifyClient);
      });

      // Auth service tools
      const authTools = tools.slice(3);
      authTools.forEach(tool => {
        expect((tool as any).authService).toBe(mockAuthService);
      });
    });
  });

  describe('Integration Scenarios', () => {
    let tools: any[];

    beforeEach(() => {
      tools = createStatusTools(mockSpotifyClient, mockAuthService);
    });

    it('should handle auth check then profile workflow', async () => {
      const authStatusTool = tools.find(t => t.name === 'get_auth_status');
      const profileTool = tools.find(t => t.name === 'get_user_profile');

      mockAuthService.getAuthStatus.mockResolvedValue({
        authenticated: true,
        hasValidToken: true,
        tokenExpired: false,
        userId: 'test-user',
        message: 'Authenticated',
      });
      mockSpotifyClient.getUserProfile.mockResolvedValue(mockUserProfile);

      // Check auth status
      const authResult = await authStatusTool.execute({ userId: 'test-user' });
      expect(authResult.success).toBe(true);

      // Get profile if authenticated
      if (authResult.data.authenticated) {
        const profileResult = await profileTool.execute({});
        expect(profileResult.success).toBe(true);
      }
    });

    it('should handle comprehensive status check', async () => {
      const statusTool = tools.find(t => t.name === 'get_playback_status');
      const devicesTool = tools.find(t => t.name === 'get_devices');

      mockSpotifyClient.getCurrentPlayback.mockResolvedValue(mockPlaybackState);
      mockSpotifyClient.getAvailableDevices.mockResolvedValue(mockDevicesResponse);

      const promises = [
        statusTool.execute({}),
        devicesTool.execute({}),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    let statusTool: GetPlaybackStatusTool;

    beforeEach(() => {
      statusTool = new GetPlaybackStatusTool(mockSpotifyClient);
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      mockSpotifyClient.getCurrentPlayback.mockRejectedValue(timeoutError);

      const result = await statusTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.message).toBe('Network timeout');
    });

    it('should handle malformed responses', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue({
        // Malformed playback state missing required fields
        is_playing: true,
      } as any);

      const result = await statusTool.execute({});

      // Should handle gracefully and not crash
      expect(result.success).toBe(true);
    });

    it('should handle null and undefined inputs', async () => {
      mockSpotifyClient.getCurrentPlayback.mockResolvedValue(mockPlaybackState);

      const result1 = await statusTool.execute(null);
      const result2 = await statusTool.execute(undefined);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});