/**
 * Unit tests for AuthService
 * 
 * Tests the high-level authentication service interface that wraps
 * the AuthManager for OAuth flow management.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../../../src/auth/authService.js';
import { AuthManager } from '../../../src/auth/authManager.js';
import { CallbackServer } from '../../../src/auth/callbackServer.js';
import { mockLogger } from '../../setup.js';
import { mockAuthConfig, mockAuthTokens } from '../../fixtures/authData.js';
import type { AuthConfig, AuthResult } from '../../../src/types/index.js';

// Mock the dependencies
jest.mock('../../../src/auth/authManager.js');
jest.mock('../../../src/auth/callbackServer.js');

const MockedAuthManager = AuthManager as jest.MockedClass<typeof AuthManager>;
const MockedCallbackServer = CallbackServer as jest.MockedClass<typeof CallbackServer>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockAuthManager: jest.Mocked<AuthManager>;
  let mockCallbackServer: jest.Mocked<CallbackServer>;
  const userId = 'test-user';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockAuthManager = {
      generateAuthUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      getAccessToken: jest.fn(),
      isAuthenticated: jest.fn(),
      revokeAuth: jest.fn(),
      getAuthStatus: jest.fn(),
      getHSMAuditLog: jest.fn(),
      isHardwareHSM: jest.fn(),
    } as any;

    mockCallbackServer = {
      start: jest.fn(),
      stop: jest.fn(),
      waitForCallback: jest.fn(),
    } as any;

    // Mock constructor implementations
    MockedAuthManager.mockImplementation(() => mockAuthManager);
    MockedCallbackServer.mockImplementation(() => mockCallbackServer);

    // Create auth service instance
    authService = new AuthService(mockAuthConfig, mockLogger, userId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with auth manager and callback server', () => {
      expect(MockedAuthManager).toHaveBeenCalledWith(mockAuthConfig, mockLogger);
      expect(MockedCallbackServer).toHaveBeenCalledWith(8080, mockLogger);
    });

    it('should use custom port for callback server', () => {
      const customConfig = { ...mockAuthConfig, redirectUri: 'http://localhost:3000/callback' };
      new AuthService(customConfig, mockLogger, userId);
      
      expect(MockedCallbackServer).toHaveBeenCalledWith(3000, mockLogger);
    });

    it('should handle invalid redirect URI gracefully', () => {
      const invalidConfig = { ...mockAuthConfig, redirectUri: 'invalid-uri' };
      new AuthService(invalidConfig, mockLogger, userId);
      
      // Should default to port 8080
      expect(MockedCallbackServer).toHaveBeenCalledWith(8080, mockLogger);
    });
  });

  describe('Authentication Flow', () => {
    const mockAuthUrl = {
      url: 'https://accounts.spotify.com/authorize?...',
      state: 'test-state-123',
    };

    const mockCallbackResult = {
      code: 'test-auth-code',
      state: 'test-state-123',
    };

    const mockTokenResult: AuthResult = {
      success: true,
      tokens: mockAuthTokens,
    };

    beforeEach(() => {
      mockAuthManager.generateAuthUrl.mockResolvedValue(mockAuthUrl);
      mockCallbackServer.start.mockResolvedValue(undefined);
      mockCallbackServer.waitForCallback.mockResolvedValue(mockCallbackResult);
      mockAuthManager.exchangeCodeForTokens.mockResolvedValue(mockTokenResult);
      mockCallbackServer.stop.mockResolvedValue(undefined);
    });

    it('should complete full OAuth flow successfully', async () => {
      const result = await authService.startAuthFlow();

      expect(result).toEqual({
        success: true,
        authUrl: mockAuthUrl.url,
      });

      // Verify flow sequence
      expect(mockAuthManager.generateAuthUrl).toHaveBeenCalledWith(userId);
      expect(mockCallbackServer.start).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Starting OAuth flow', { userId });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Please visit the following URL to authorize:',
        { url: mockAuthUrl.url }
      );
      expect(mockCallbackServer.waitForCallback).toHaveBeenCalled();
      expect(mockAuthManager.exchangeCodeForTokens).toHaveBeenCalledWith(
        userId,
        mockCallbackResult.code,
        mockCallbackResult.state
      );
      expect(mockCallbackServer.stop).toHaveBeenCalled();
    });

    it('should handle callback server start failure', async () => {
      const error = new Error('Port already in use');
      mockCallbackServer.start.mockRejectedValue(error);

      const result = await authService.startAuthFlow();

      expect(result).toEqual({
        success: false,
        error: 'Failed to start callback server: Port already in use',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start callback server',
        { error: 'Port already in use' }
      );
    });

    it('should handle user cancellation', async () => {
      mockCallbackServer.waitForCallback.mockResolvedValue({
        error: 'access_denied',
        error_description: 'User denied access',
      });

      const result = await authService.startAuthFlow();

      expect(result).toEqual({
        success: false,
        error: 'Authorization failed: access_denied',
      });
      expect(mockCallbackServer.stop).toHaveBeenCalled();
    });

    it('should handle token exchange failure', async () => {
      const failureResult: AuthResult = {
        success: false,
        error: 'Invalid authorization code',
      };
      mockAuthManager.exchangeCodeForTokens.mockResolvedValue(failureResult);

      const result = await authService.startAuthFlow();

      expect(result).toEqual({
        success: false,
        error: 'Invalid authorization code',
      });
      expect(mockCallbackServer.stop).toHaveBeenCalled();
    });

    it('should handle callback timeout', async () => {
      mockCallbackServer.waitForCallback.mockRejectedValue(new Error('Timeout waiting for callback'));

      const result = await authService.startAuthFlow();

      expect(result).toEqual({
        success: false,
        error: 'Failed to complete OAuth flow: Timeout waiting for callback',
      });
      expect(mockCallbackServer.stop).toHaveBeenCalled();
    });

    it('should always stop callback server even on error', async () => {
      mockCallbackServer.waitForCallback.mockRejectedValue(new Error('Some error'));

      await authService.startAuthFlow();

      expect(mockCallbackServer.stop).toHaveBeenCalled();
    });
  });

  describe('Token Management', () => {
    it('should get access token', async () => {
      mockAuthManager.getAccessToken.mockResolvedValue('test-access-token');

      const token = await authService.getAccessToken();

      expect(token).toBe('test-access-token');
      expect(mockAuthManager.getAccessToken).toHaveBeenCalledWith(userId);
    });

    it('should handle null access token', async () => {
      mockAuthManager.getAccessToken.mockResolvedValue(null);

      const token = await authService.getAccessToken();

      expect(token).toBeNull();
    });

    it('should check authentication status', async () => {
      mockAuthManager.isAuthenticated.mockResolvedValue(true);

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(true);
      expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith(userId);
    });

    it('should revoke authentication', async () => {
      mockAuthManager.revokeAuth.mockResolvedValue(undefined);

      await authService.revokeAuth();

      expect(mockAuthManager.revokeAuth).toHaveBeenCalledWith(userId);
      expect(mockLogger.info).toHaveBeenCalledWith('Revoking authentication', { userId });
    });

    it('should get authentication status', async () => {
      const mockStatus = {
        authenticated: true,
        hasValidToken: true,
        tokenExpired: false,
        userId: userId,
        scopes: ['user-read-playback-state'],
      };
      mockAuthManager.getAuthStatus.mockResolvedValue(mockStatus);

      const status = await authService.getAuthStatus();

      expect(status).toEqual(mockStatus);
      expect(mockAuthManager.getAuthStatus).toHaveBeenCalledWith(userId);
    });
  });

  describe('User Management', () => {
    it('should allow setting different user ID', async () => {
      authService.setUserId('new-user');
      mockAuthManager.getAccessToken.mockResolvedValue('new-user-token');

      const token = await authService.getAccessToken();

      expect(mockAuthManager.getAccessToken).toHaveBeenCalledWith('new-user');
      expect(token).toBe('new-user-token');
    });

    it('should use updated user ID for all operations', async () => {
      authService.setUserId('another-user');
      
      await authService.startAuthFlow();
      await authService.isAuthenticated();
      await authService.revokeAuth();
      await authService.getAuthStatus();

      expect(mockAuthManager.generateAuthUrl).toHaveBeenCalledWith('another-user');
      expect(mockAuthManager.isAuthenticated).toHaveBeenCalledWith('another-user');
      expect(mockAuthManager.revokeAuth).toHaveBeenCalledWith('another-user');
      expect(mockAuthManager.getAuthStatus).toHaveBeenCalledWith('another-user');
    });
  });

  describe('Error Handling', () => {
    it('should handle auth manager errors gracefully', async () => {
      mockAuthManager.generateAuthUrl.mockRejectedValue(new Error('Auth manager error'));

      const result = await authService.startAuthFlow();

      expect(result).toEqual({
        success: false,
        error: 'Failed to complete OAuth flow: Auth manager error',
      });
    });

    it('should handle missing auth URL', async () => {
      mockAuthManager.generateAuthUrl.mockResolvedValue({ url: '', state: '' });

      const result = await authService.startAuthFlow();

      expect(result.success).toBe(true);
      expect(result.authUrl).toBe('');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Please visit the following URL to authorize:',
        { url: '' }
      );
    });

    it('should handle callback server stop failure', async () => {
      mockCallbackServer.stop.mockRejectedValue(new Error('Stop failed'));
      mockCallbackServer.waitForCallback.mockRejectedValue(new Error('Callback error'));

      const result = await authService.startAuthFlow();

      // Should still return the main error, not the stop error
      expect(result.error).toContain('Callback error');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid successive auth attempts', async () => {
      const promise1 = authService.startAuthFlow();
      const promise2 = authService.startAuthFlow();

      const results = await Promise.all([promise1, promise2]);

      // Both should complete, implementation should handle concurrency
      expect(results).toHaveLength(2);
      expect(mockCallbackServer.start).toHaveBeenCalledTimes(2);
    });

    it('should handle auth flow cancellation and retry', async () => {
      // First attempt - user cancels
      mockCallbackServer.waitForCallback.mockResolvedValueOnce({
        error: 'access_denied',
      });
      
      const result1 = await authService.startAuthFlow();
      expect(result1.success).toBe(false);

      // Second attempt - success
      mockCallbackServer.waitForCallback.mockResolvedValueOnce({
        code: 'test-code',
        state: 'test-state-123',
      });
      mockAuthManager.exchangeCodeForTokens.mockResolvedValueOnce({
        success: true,
        tokens: mockAuthTokens,
      });

      const result2 = await authService.startAuthFlow();
      expect(result2.success).toBe(true);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log all major steps in auth flow', async () => {
      const mockAuthUrl = { url: 'https://auth.url', state: 'state' };
      mockAuthManager.generateAuthUrl.mockResolvedValue(mockAuthUrl);
      mockCallbackServer.waitForCallback.mockResolvedValue({ code: 'code', state: 'state' });
      mockAuthManager.exchangeCodeForTokens.mockResolvedValue({ success: true, tokens: mockAuthTokens });

      await authService.startAuthFlow();

      // Check for expected log messages
      expect(mockLogger.info).toHaveBeenCalledWith('Starting OAuth flow', { userId });
      expect(mockLogger.info).toHaveBeenCalledWith('Authorization successful');
      expect(mockLogger.info).toHaveBeenCalledWith('OAuth flow completed successfully');
    });

    it('should log errors with context', async () => {
      const error = new Error('Network timeout');
      mockCallbackServer.start.mockRejectedValue(error);

      await authService.startAuthFlow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start callback server',
        { error: 'Network timeout' }
      );
    });
  });
});