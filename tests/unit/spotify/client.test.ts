/**
 * Unit tests for SpotifyClient
 * 
 * Tests Spotify Web API client functionality including authentication,
 * rate limiting, error handling, and certificate pinning integration.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { AuthService } from '../../../src/auth/authService.js';
import { RateLimiter } from '../../../src/spotify/rateLimiter.js';
import { CertificateManager, createCertificateManager } from '../../../src/security/certificateManager.js';
import { SpotifyError, SpotifyRateLimitError, SpotifyAuthError } from '../../../src/spotify/errors.js';
import { mockLogger } from '../../setup.js';
import { mockAuthConfig } from '../../fixtures/authData.js';
import { 
  mockPlaybackState, 
  mockSearchResults, 
  mockUserProfile,
  mockDevicesResponse,
  mockQueueState,
  mockPlaylistsResponse,
  mockRecentlyPlayedResponse,
  mockRecommendationsResponse
} from '../../fixtures/spotifyData.js';
import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/auth/authService.js');
jest.mock('../../../src/spotify/rateLimiter.js');
jest.mock('../../../src/security/certificateManager.js');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const MockedRateLimiter = RateLimiter as jest.MockedClass<typeof RateLimiter>;
const MockedCertificateManager = CertificateManager as jest.MockedClass<typeof CertificateManager>;
const mockedCreateCertificateManager = createCertificateManager as jest.MockedFunction<typeof createCertificateManager>;

// Mock axios instance
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  defaults: {
    headers: {
      common: {},
    },
    httpsAgent: {},
  },
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
};

describe('SpotifyClient', () => {
  let spotifyClient: SpotifyClient;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;
  let mockCertificateManager: jest.Mocked<CertificateManager>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockAuthService = {
      getAccessToken: jest.fn(),
      isAuthenticated: jest.fn(),
      getAuthStatus: jest.fn(),
    } as any;

    mockRateLimiter = {
      checkRateLimit: jest.fn(),
      updateFromHeaders: jest.fn(),
    } as any;

    mockCertificateManager = {
      createSecureAgent: jest.fn(),
      isStrictMode: jest.fn(),
    } as any;

    // Mock constructor implementations
    MockedAuthService.mockImplementation(() => mockAuthService);
    MockedRateLimiter.mockImplementation(() => mockRateLimiter);
    mockedCreateCertificateManager.mockReturnValue(mockCertificateManager);

    // Mock axios.create
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    // Setup default mock behaviors
    mockAuthService.getAccessToken.mockResolvedValue('test-access-token');
    mockAuthService.isAuthenticated.mockResolvedValue(true);
    mockRateLimiter.checkRateLimit.mockResolvedValue(undefined);
    mockCertificateManager.createSecureAgent.mockReturnValue({} as any);
    mockCertificateManager.isStrictMode.mockReturnValue(false);

    // Create Spotify client instance
    spotifyClient = new SpotifyClient(mockAuthService, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with all dependencies', () => {
      expect(MockedRateLimiter).toHaveBeenCalledWith(mockLogger);
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.spotify.com/v1',
          timeout: 10000,
        })
      );
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should configure certificate pinning', () => {
      expect(MockedCertificateManager).toHaveBeenCalled();
      expect(mockCertificateManager.createSecureAgent).toHaveBeenCalled();
    });
  });

  describe('Authentication Integration', () => {
    it('should add authorization header for authenticated requests', async () => {
      // Get the request interceptor function
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {},
        url: '/me',
      };

      const result = await requestInterceptor(config);

      expect(mockAuthService.getAccessToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBe('Bearer test-access-token');
    });

    it('should handle missing access token', async () => {
      mockAuthService.getAccessToken.mockResolvedValue(null);
      
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {},
        url: '/me',
      };

      await expect(requestInterceptor(config)).rejects.toThrow(SpotifyAuthError);
    });

    it('should log authentication request details', async () => {
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {},
        url: '/me/player',
        method: 'GET',
      };

      await requestInterceptor(config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Making Spotify API request',
        expect.objectContaining({
          method: 'GET',
          url: '/me/player',
        })
      );
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should check rate limits before requests', async () => {
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {},
        url: '/me/player',
      };

      await requestInterceptor(config);

      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith('/me/player');
    });

    it('should handle rate limit exceeded', async () => {
      mockRateLimiter.checkRateLimit.mockRejectedValue(
        new SpotifyRateLimitError('Rate limit exceeded', { retryAfter: 5000 })
      );

      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {},
        url: '/me/player',
      };

      await expect(requestInterceptor(config)).rejects.toThrow(SpotifyRateLimitError);
    });

    it('should update rate limits from response headers', async () => {
      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      
      const response: AxiosResponse = {
        status: 200,
        data: {},
        headers: {
          'x-ratelimit-remaining': '100',
          'x-ratelimit-reset': '1640995200',
        },
        config: { url: '/me/player' },
      } as any;

      const result = responseInterceptor(response);

      expect(mockRateLimiter.updateFromHeaders).toHaveBeenCalledWith(
        '/me/player',
        expect.objectContaining({
          'x-ratelimit-remaining': '100',
          'x-ratelimit-reset': '1640995200',
        })
      );
      expect(result).toBe(response);
    });
  });

  describe('Playback Operations', () => {
    it('should get current playback state', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockPlaybackState,
      });

      const result = await spotifyClient.getCurrentPlayback();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/me/player');
      expect(result).toEqual(mockPlaybackState);
    });

    it('should handle no active playback', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 204,
        data: null,
      });

      const result = await spotifyClient.getCurrentPlayback();

      expect(result).toBeNull();
    });

    it('should start playback', async () => {
      mockAxiosInstance.put.mockResolvedValue({ status: 204 });

      await spotifyClient.startPlayback({
        deviceId: 'test-device',
        contextUri: 'spotify:album:123',
      });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/me/player/play?device_id=test-device',
        { context_uri: 'spotify:album:123' }
      );
    });

    it('should pause playback', async () => {
      mockAxiosInstance.put.mockResolvedValue({ status: 204 });

      await spotifyClient.pausePlayback('test-device');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/me/player/pause?device_id=test-device'
      );
    });

    it('should skip to next track', async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 204 });

      await spotifyClient.skipToNext('test-device');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/me/player/next?device_id=test-device'
      );
    });

    it('should skip to previous track', async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 204 });

      await spotifyClient.skipToPrevious('test-device');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/me/player/previous?device_id=test-device'
      );
    });

    it('should set volume', async () => {
      mockAxiosInstance.put.mockResolvedValue({ status: 204 });

      await spotifyClient.setVolume(75, 'test-device');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/me/player/volume?volume_percent=75&device_id=test-device'
      );
    });

    it('should set shuffle mode', async () => {
      mockAxiosInstance.put.mockResolvedValue({ status: 204 });

      await spotifyClient.setShuffle(true, 'test-device');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/me/player/shuffle?state=true&device_id=test-device'
      );
    });

    it('should set repeat mode', async () => {
      mockAxiosInstance.put.mockResolvedValue({ status: 204 });

      await spotifyClient.setRepeat('context', 'test-device');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/me/player/repeat?state=context&device_id=test-device'
      );
    });
  });

  describe('Search Operations', () => {
    it('should search for tracks', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockSearchResults,
      });

      const result = await spotifyClient.search('test query', {
        type: ['track'],
        limit: 20,
        offset: 0,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({
          params: {
            q: 'test query',
            type: 'track',
            limit: 20,
            offset: 0,
          },
        })
      );
      expect(result).toEqual(mockSearchResults);
    });

    it('should search with multiple types', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockSearchResults,
      });

      await spotifyClient.search('test', {
        type: ['track', 'album', 'artist'],
        limit: 10,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/search',
        expect.objectContaining({
          params: expect.objectContaining({
            type: 'track,album,artist',
          }),
        })
      );
    });

    it('should get recommendations', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockRecommendationsResponse,
      });

      const result = await spotifyClient.getRecommendations({
        seedTracks: ['track1', 'track2'],
        limit: 10,
        minEnergy: 0.7,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/recommendations',
        expect.objectContaining({
          params: expect.objectContaining({
            seed_tracks: 'track1,track2',
            limit: 10,
            min_energy: 0.7,
          }),
        })
      );
      expect(result).toEqual(mockRecommendationsResponse);
    });
  });

  describe('Queue Operations', () => {
    it('should add track to queue', async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 204 });

      await spotifyClient.addToQueue('spotify:track:123', 'test-device');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/me/player/queue?uri=spotify:track:123&device_id=test-device'
      );
    });

    it('should get queue state', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockQueueState,
      });

      const result = await spotifyClient.getQueue();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/me/player/queue');
      expect(result).toEqual(mockQueueState);
    });
  });

  describe('User Profile Operations', () => {
    it('should get user profile', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockUserProfile,
      });

      const result = await spotifyClient.getUserProfile();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/me');
      expect(result).toEqual(mockUserProfile);
    });

    it('should get user playlists', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockPlaylistsResponse,
      });

      const result = await spotifyClient.getUserPlaylists({
        limit: 20,
        offset: 0,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/me/playlists',
        expect.objectContaining({
          params: { limit: 20, offset: 0 },
        })
      );
      expect(result).toEqual(mockPlaylistsResponse);
    });

    it('should get recently played tracks', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockRecentlyPlayedResponse,
      });

      const result = await spotifyClient.getRecentlyPlayed({
        limit: 50,
        after: 1640995200000,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/me/player/recently-played',
        expect.objectContaining({
          params: { limit: 50, after: 1640995200000 },
        })
      );
      expect(result).toEqual(mockRecentlyPlayedResponse);
    });

    it('should get available devices', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockDevicesResponse,
      });

      const result = await spotifyClient.getAvailableDevices();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/me/player/devices');
      expect(result).toEqual(mockDevicesResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 authentication errors', async () => {
      const authError: AxiosError = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid access token' } },
        },
        isAxiosError: true,
      } as any;

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      await expect(errorInterceptor(authError)).rejects.toThrow(SpotifyAuthError);
    });

    it('should handle 429 rate limit errors', async () => {
      const rateLimitError: AxiosError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { error: { message: 'Rate limit exceeded' } },
        },
        isAxiosError: true,
      } as any;

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      await expect(errorInterceptor(rateLimitError)).rejects.toThrow(SpotifyRateLimitError);
    });

    it('should handle 403 forbidden errors', async () => {
      const forbiddenError: AxiosError = {
        response: {
          status: 403,
          data: { error: { message: 'Forbidden' } },
        },
        isAxiosError: true,
      } as any;

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      await expect(errorInterceptor(forbiddenError)).rejects.toThrow(SpotifyError);
    });

    it('should handle network errors', async () => {
      const networkError: AxiosError = {
        code: 'ENOTFOUND',
        message: 'Network error',
        isAxiosError: true,
      } as any;

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      await expect(errorInterceptor(networkError)).rejects.toThrow(SpotifyError);
    });

    it('should sanitize error messages', async () => {
      const errorWithSensitiveData: AxiosError = {
        response: {
          status: 400,
          data: { 
            error: { 
              message: 'Invalid client_id: abcd1234 or access_token: xyz789' 
            } 
          },
        },
        isAxiosError: true,
      } as any;

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      try {
        await errorInterceptor(errorWithSensitiveData);
      } catch (error) {
        expect((error as SpotifyError).message).not.toContain('abcd1234');
        expect((error as SpotifyError).message).not.toContain('xyz789');
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient errors', async () => {
      const transientError: AxiosError = {
        response: {
          status: 502,
          data: { error: { message: 'Bad gateway' } },
        },
        isAxiosError: true,
      } as any;

      mockAxiosInstance.get
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue({
          status: 200,
          data: mockPlaybackState,
        });

      const result = await spotifyClient.getCurrentPlayback();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockPlaybackState);
    });

    it('should not retry on non-retryable errors', async () => {
      const authError: AxiosError = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid access token' } },
        },
        isAxiosError: true,
      } as any;

      mockAxiosInstance.get.mockRejectedValue(authError);

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      await expect(errorInterceptor(authError)).rejects.toThrow(SpotifyAuthError);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Certificate Pinning', () => {
    it('should use secure HTTPS agent in production', () => {
      mockCertificateManager.isStrictMode.mockReturnValue(true);
      
      // Create new client to test production mode
      new SpotifyClient(mockAuthService, mockLogger);

      expect(mockCertificateManager.createSecureAgent).toHaveBeenCalled();
    });

    it('should log certificate pinning status', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Spotify client initialized',
        expect.objectContaining({
          certificatePinning: expect.any(Boolean),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty response data', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: null,
      });

      const result = await spotifyClient.getUserProfile();

      expect(result).toBeNull();
    });

    it('should handle malformed JSON responses', async () => {
      const malformedError: AxiosError = {
        response: {
          status: 400,
          data: 'invalid json',
        },
        isAxiosError: true,
      } as any;

      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      await expect(errorInterceptor(malformedError)).rejects.toThrow(SpotifyError);
    });

    it('should handle concurrent requests', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: mockPlaybackState,
      });

      const promises = [
        spotifyClient.getCurrentPlayback(),
        spotifyClient.getCurrentPlayback(),
        spotifyClient.getCurrentPlayback(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual(mockPlaybackState);
      });
    });
  });
});