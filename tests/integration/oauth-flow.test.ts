/**
 * Integration tests for OAuth 2.0 + PKCE authentication flow
 * 
 * Tests the complete authentication process including:
 * - Auth URL generation with PKCE
 * - State parameter validation
 * - Token exchange and storage
 * - Token refresh mechanisms
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../../src/auth/authService.js';
import { AuthManager } from '../../src/auth/authManager.js';
import { createMockLogger } from '../fixtures/mockLogger.js';
import axios from 'axios';
import type { AxiosResponse } from 'axios';

// Mock external dependencies
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock HTTP server for callback testing
jest.mock('http', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, callback) => callback()),
    close: jest.fn((callback) => callback && callback()),
    on: jest.fn(),
  })),
}));

describe('OAuth Flow Integration Tests', () => {
  let authService: AuthService;
  let authManager: AuthManager;
  let mockLogger: any;

  const mockSpotifyConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:8080/callback',
    scopes: ['user-read-playback-state', 'user-modify-playback-state'],
  };

  const mockTokenResponse = {
    access_token: 'access_token_123',
    refresh_token: 'refresh_token_123',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'user-read-playback-state user-modify-playback-state',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();

    // Initialize auth components
    authManager = new AuthManager(mockSpotifyConfig, mockLogger);
    authService = new AuthService(authManager, mockLogger);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe('Complete OAuth Flow', () => {
    it('should complete full OAuth 2.0 + PKCE flow successfully', async () => {
      const userId = 'test-user-123';

      // Step 1: Start auth flow
      const authResult = await authService.startAuthFlow(userId);
      
      expect(authResult.success).toBe(true);
      expect(authResult.authUrl).toBeDefined();
      expect(authResult.authUrl).toContain('response_type=code');
      expect(authResult.authUrl).toContain('code_challenge=');
      expect(authResult.authUrl).toContain('code_challenge_method=S256');
      expect(authResult.authUrl).toContain('state=');

      // Extract state parameter for validation
      const urlParams = new URLSearchParams(authResult.authUrl!.split('?')[1]);
      const state = urlParams.get('state');
      const codeChallenge = urlParams.get('code_challenge');
      
      expect(state).toBeDefined();
      expect(codeChallenge).toBeDefined();

      // Step 2: Mock successful token exchange
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: mockTokenResponse,
      } as AxiosResponse);

      // Step 3: Complete OAuth flow with authorization code
      const authCode = 'mock_auth_code_123';
      const tokenResult = await authManager.exchangeCodeForTokens(userId, authCode, state!);

      expect(tokenResult.success).toBe(true);
      expect(tokenResult.tokens).toBeDefined();
      expect(tokenResult.tokens!.accessToken).toBe('access_token_123');
      expect(tokenResult.tokens!.refreshToken).toBe('refresh_token_123');

      // Step 4: Verify tokens are stored securely
      const storedTokens = await authManager.getTokens(userId);
      expect(storedTokens).toBeDefined();
      expect(storedTokens!.accessToken).toBe('access_token_123');

      // Step 5: Verify authentication status
      const authStatus = await authService.getAuthStatus(userId);
      expect(authStatus.authenticated).toBe(true);
      expect(authStatus.hasValidToken).toBe(true);
      expect(authStatus.tokenExpired).toBe(false);
    });

    it('should handle token refresh flow', async () => {
      const userId = 'test-user-refresh';

      // Setup: Store expired tokens
      await authManager.storeTokens(userId, {
        accessToken: 'expired_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        tokenType: 'Bearer',
        scope: 'user-read-playback-state',
      });

      // Mock refresh token response
      const refreshResponse = {
        access_token: 'new_access_token_456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'user-read-playback-state',
      };

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: refreshResponse,
      } as AxiosResponse);

      // Attempt to refresh tokens
      const refreshResult = await authManager.refreshTokens(userId);

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.tokens!.accessToken).toBe('new_access_token_456');

      // Verify new tokens are stored
      const storedTokens = await authManager.getTokens(userId);
      expect(storedTokens!.accessToken).toBe('new_access_token_456');
      expect(storedTokens!.refreshToken).toBe('valid_refresh_token'); // Should remain the same
    });

    it('should handle state parameter validation failures', async () => {
      const userId = 'test-user-state-fail';

      // Start auth flow to generate valid state
      await authService.startAuthFlow(userId);

      // Attempt to exchange code with invalid state
      const result = await authManager.exchangeCodeForTokens(
        userId,
        'auth_code_123',
        'invalid_state_parameter'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state parameter');
    });

    it('should handle PKCE code verifier validation', async () => {
      const userId = 'test-user-pkce-fail';

      // Start auth flow
      const authResult = await authService.startAuthFlow(userId);
      const urlParams = new URLSearchParams(authResult.authUrl!.split('?')[1]);
      const state = urlParams.get('state');

      // Mock token exchange failure due to PKCE mismatch
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'Code verifier does not match challenge',
          },
        },
      });

      const result = await authManager.exchangeCodeForTokens(userId, 'auth_code_123', state!);

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid_grant');
    });
  });

  describe('Token Security', () => {
    it('should store and retrieve tokens securely', async () => {
      const userId = 'test-user-encryption';
      
      // Store tokens
      await authManager.storeTokens(userId, {
        accessToken: 'secret_access_token',
        refreshToken: 'secret_refresh_token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        scope: 'user-read-playback-state',
      });

      // Verify tokens can be retrieved
      const retrievedTokens = await authManager.getTokens(userId);
      expect(retrievedTokens!.accessToken).toBe('secret_access_token');
      expect(retrievedTokens!.refreshToken).toBe('secret_refresh_token');
    });

    it('should handle concurrent token operations safely', async () => {
      const userId = 'test-user-concurrent';

      // Start multiple token storage operations concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        authManager.storeTokens(userId, {
          accessToken: `token_${i}`,
          refreshToken: `refresh_${i}`,
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
          scope: 'user-read-playback-state',
        })
      );

      // All operations should complete successfully
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBe(5);

      // Final stored token should be from one of the operations
      const finalTokens = await authManager.getTokens(userId);
      expect(finalTokens).toBeDefined();
      expect(finalTokens!.accessToken).toMatch(/^token_[0-4]$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during token exchange', async () => {
      const userId = 'test-user-network-error';

      // Start auth flow
      const authResult = await authService.startAuthFlow(userId);
      const urlParams = new URLSearchParams(authResult.authUrl!.split('?')[1]);
      const state = urlParams.get('state');

      // Mock network error
      mockedAxios.post.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await authManager.exchangeCodeForTokens(userId, 'auth_code_123', state!);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle Spotify API errors', async () => {
      const userId = 'test-user-api-error';

      // Start auth flow
      const authResult = await authService.startAuthFlow(userId);
      const urlParams = new URLSearchParams(authResult.authUrl!.split('?')[1]);
      const state = urlParams.get('state');

      // Mock Spotify API error
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
          },
        },
      });

      const result = await authManager.exchangeCodeForTokens(userId, 'auth_code_123', state!);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid client credentials');
    });

    it('should handle non-existent tokens gracefully', async () => {
      const userId = 'test-user-nonexistent';

      // Attempt to retrieve tokens for user that doesn't exist
      const tokens = await authManager.getTokens(userId);
      expect(tokens).toBeNull(); // Should return null for non-existent tokens
    });
  });

  describe('Multi-User Support', () => {
    it('should handle multiple users independently', async () => {
      const user1 = 'user_1';
      const user2 = 'user_2';

      // Store tokens for both users
      await authManager.storeTokens(user1, {
        accessToken: 'user1_token',
        refreshToken: 'user1_refresh',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        scope: 'user-read-playback-state',
      });

      await authManager.storeTokens(user2, {
        accessToken: 'user2_token',
        refreshToken: 'user2_refresh',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        scope: 'user-read-playback-state',
      });

      // Verify tokens are isolated per user
      const user1Tokens = await authManager.getTokens(user1);
      const user2Tokens = await authManager.getTokens(user2);

      expect(user1Tokens!.accessToken).toBe('user1_token');
      expect(user2Tokens!.accessToken).toBe('user2_token');

      // Revoke user1 tokens
      await authManager.revokeTokens(user1);

      // Verify only user1 tokens are affected
      const user1TokensAfter = await authManager.getTokens(user1);
      const user2TokensAfter = await authManager.getTokens(user2);

      expect(user1TokensAfter).toBeNull();
      expect(user2TokensAfter!.accessToken).toBe('user2_token');
    });
  });
});