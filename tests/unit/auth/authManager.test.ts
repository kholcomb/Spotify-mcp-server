/**
 * Unit tests for AuthManager
 * 
 * Tests OAuth 2.0 + PKCE authentication flow, token management,
 * encryption/decryption, and HSM integration.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthManager } from '../../../src/auth/authManager.js';
import { mockLogger } from '../../setup.js';
import { mockAuthConfig, mockAuthTokens, mockPKCEData, mockTokenResponse, mockExpiredTokens } from '../../fixtures/authData.js';
import type { AuthConfig, AuthUrlResult, AuthResult, AuthTokens, PKCEData } from '../../../src/types/index.js';
import axios from 'axios';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { homedir } from 'os';
import { join } from 'path';

// Mock modules
jest.mock('axios');
jest.mock('fs');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('AuthManager', () => {
  let authManager: AuthManager;
  const userId = 'test-user';
  const tokenDir = join(homedir(), '.spotify-mcp');

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup file system mocks
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.readFileSync.mockImplementation((path) => {
      if (path.toString().includes('.salt')) {
        return Buffer.from('test-salt-32-bytes-long-for-test');
      }
      return '';
    });
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    
    // Setup axios mock
    mockedAxios.post.mockResolvedValue({ data: mockTokenResponse });
    
    // Create auth manager instance
    authManager = new AuthManager(mockAuthConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(authManager).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HSM Manager initialized',
        expect.any(Object)
      );
    });

    it('should create token directory if not exists', () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      new AuthManager(mockAuthConfig, mockLogger);
      
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        tokenDir,
        { recursive: true, mode: 0o700 }
      );
    });

    it('should create salt file if not exists', () => {
      mockedFs.existsSync.mockImplementation((path) => {
        if (path.toString().includes('.salt')) {
          return false;
        }
        return true;
      });
      
      new AuthManager(mockAuthConfig, mockLogger);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        join(tokenDir, '.salt'),
        expect.any(Buffer),
        { mode: 0o600 }
      );
    });

    it('should handle HSM initialization failure gracefully', () => {
      // HSM initialization is async and failures are logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HSM initialization failed, falling back to software encryption',
        expect.any(Object)
      );
    });
  });

  describe('PKCE Flow', () => {
    it('should generate valid authorization URL', async () => {
      const result = await authManager.generateAuthUrl(userId);
      
      expect(result).toBeDefined();
      expect(result.url).toContain('https://accounts.spotify.com/authorize');
      expect(result.url).toContain('client_id=' + mockAuthConfig.clientId);
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.url).toContain('code_challenge=');
      expect(result.url).toContain('state=');
      expect(result.state).toBeDefined();
    });

    it('should include all required scopes', async () => {
      const result = await authManager.generateAuthUrl(userId);
      
      const scopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-read-recently-played',
        'user-read-email',
        'user-read-private',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read',
        'streaming'
      ];
      
      scopes.forEach(scope => {
        expect(result.url).toContain(scope);
      });
    });

    it('should store PKCE data for later verification', async () => {
      await authManager.generateAuthUrl(userId);
      
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        join(tokenDir, `${userId}.pkce`),
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should generate unique state for each request', async () => {
      const result1 = await authManager.generateAuthUrl(userId);
      const result2 = await authManager.generateAuthUrl(userId);
      
      expect(result1.state).not.toBe(result2.state);
    });
  });

  describe('Token Exchange', () => {
    const authCode = 'test-auth-code';
    const state = 'test-state';

    beforeEach(() => {
      // Mock stored PKCE data
      mockedFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('.pkce')) {
          return JSON.stringify({
            codeVerifier: 'test-verifier',
            state: state,
            timestamp: Date.now()
          });
        }
        if (path.toString().includes('.salt')) {
          return Buffer.from('test-salt-32-bytes-long-for-test');
        }
        return '';
      });
    });

    it('should exchange code for tokens successfully', async () => {
      const result = await authManager.exchangeCodeForTokens(userId, authCode, state);
      
      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens?.accessToken).toBe(mockTokenResponse.access_token);
      expect(result.tokens?.refreshToken).toBe(mockTokenResponse.refresh_token);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://accounts.spotify.com/api/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': expect.stringContaining('Basic ')
          }
        })
      );
    });

    it('should validate state parameter', async () => {
      const result = await authManager.exchangeCodeForTokens(userId, authCode, 'wrong-state');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('State mismatch');
    });

    it('should check state expiration', async () => {
      // Mock expired PKCE data
      mockedFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('.pkce')) {
          return JSON.stringify({
            codeVerifier: 'test-verifier',
            state: state,
            timestamp: Date.now() - 11 * 60 * 1000 // 11 minutes ago
          });
        }
        if (path.toString().includes('.salt')) {
          return Buffer.from('test-salt-32-bytes-long-for-test');
        }
        return '';
      });
      
      const result = await authManager.exchangeCodeForTokens(userId, authCode, state);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('State parameter has expired');
    });

    it('should handle missing PKCE data', async () => {
      mockedFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('.pkce')) {
          throw new Error('File not found');
        }
        if (path.toString().includes('.salt')) {
          return Buffer.from('test-salt-32-bytes-long-for-test');
        }
        return '';
      });
      
      const result = await authManager.exchangeCodeForTokens(userId, authCode, state);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('PKCE data not found');
    });

    it('should clean up PKCE data after successful exchange', async () => {
      mockedFs.unlink = jest.fn((path, callback) => callback(null));
      
      await authManager.exchangeCodeForTokens(userId, authCode, state);
      
      expect(mockedFs.unlink).toHaveBeenCalledWith(
        join(tokenDir, `${userId}.pkce`),
        expect.any(Function)
      );
    });
  });

  describe('Token Management', () => {
    it('should get valid access token', async () => {
      // Mock stored tokens
      mockedFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('.tokens')) {
          const encrypted = authManager['encrypt'](JSON.stringify(mockAuthTokens));
          return encrypted;
        }
        if (path.toString().includes('.salt')) {
          return Buffer.from('test-salt-32-bytes-long-for-test');
        }
        return '';
      });
      
      const token = await authManager.getAccessToken(userId);
      
      expect(token).toBe(mockAuthTokens.accessToken);
    });

    it('should refresh expired token', async () => {
      // Mock expired tokens
      mockedFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('.tokens')) {
          const encrypted = authManager['encrypt'](JSON.stringify(mockExpiredTokens));
          return encrypted;
        }
        if (path.toString().includes('.salt')) {
          return Buffer.from('test-salt-32-bytes-long-for-test');
        }
        return '';
      });
      
      const token = await authManager.getAccessToken(userId);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://accounts.spotify.com/api/token',
        expect.any(URLSearchParams),
        expect.any(Object)
      );
      expect(token).toBe(mockTokenResponse.access_token);
    });

    it('should handle missing tokens', async () => {
      mockedFs.existsSync.mockImplementation((path) => {
        if (path.toString().includes('.tokens')) {
          return false;
        }
        return true;
      });
      
      const token = await authManager.getAccessToken(userId);
      
      expect(token).toBeNull();
    });

    it('should check authentication status', async () => {
      // Mock valid tokens
      mockedFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('.tokens')) {
          const encrypted = authManager['encrypt'](JSON.stringify(mockAuthTokens));
          return encrypted;
        }
        if (path.toString().includes('.salt')) {
          return Buffer.from('test-salt-32-bytes-long-for-test');
        }
        return '';
      });
      mockedFs.existsSync.mockReturnValue(true);
      
      const isAuthenticated = await authManager.isAuthenticated(userId);
      
      expect(isAuthenticated).toBe(true);
    });

    it('should revoke authentication', async () => {
      mockedFs.unlink = jest.fn((path, callback) => callback(null));
      mockedFs.existsSync.mockReturnValue(true);
      
      await authManager.revokeAuth(userId);
      
      expect(mockedFs.unlink).toHaveBeenCalledTimes(2); // tokens and pkce files
      expect(mockLogger.info).toHaveBeenCalledWith('User authentication revoked', { userId });
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt data with PBKDF2 fallback', async () => {
      const testData = 'sensitive-data-to-encrypt';
      
      const encrypted = await authManager['encrypt'](testData);
      expect(encrypted).toContain('pbkdf2:'); // Fallback format
      expect(encrypted).not.toContain(testData);
      
      const decrypted = await authManager['decrypt'](encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should handle HSM encryption format', async () => {
      const hsmEncrypted = 'hsm:' + Buffer.from('encrypted-data').toString('base64');
      
      // Mock HSM decryption
      authManager['hsmEncryptionKeyId'] = 'test-key-id';
      authManager['hsmManager'].decrypt = jest.fn().mockResolvedValue(
        Buffer.from('decrypted-data')
      );
      
      const decrypted = await authManager['decrypt'](hsmEncrypted);
      expect(decrypted).toBe('decrypted-data');
    });

    it('should handle legacy encryption format', async () => {
      // Legacy format without prefix
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        authManager['encryptionKey'],
        iv
      );
      let encrypted = cipher.update('legacy-data', 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const legacyFormat = `${iv.toString('hex')}:${encrypted}`;
      
      const decrypted = await authManager['decrypt'](legacyFormat);
      expect(decrypted).toBe('legacy-data');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Decrypting legacy format data, consider re-encrypting'
      );
    });

    it('should handle invalid encrypted data format', async () => {
      await expect(authManager['decrypt']('invalid-format'))
        .rejects.toThrow('Invalid encrypted data format');
    });

    it('should handle HSM encryption when key not available', async () => {
      const hsmEncrypted = 'hsm:' + Buffer.from('encrypted').toString('base64');
      authManager['hsmEncryptionKeyId'] = undefined;
      
      await expect(authManager['decrypt'](hsmEncrypted))
        .rejects.toThrow('HSM encrypted data found but HSM key not available');
    });
  });

  describe('Error Handling', () => {
    it('should handle token refresh failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      
      // Mock expired tokens
      mockedFs.readFileSync.mockImplementation((path) => {
        if (path.toString().includes('.tokens')) {
          const encrypted = authManager['encrypt'](JSON.stringify(mockExpiredTokens));
          return encrypted;
        }
        if (path.toString().includes('.salt')) {
          return Buffer.from('test-salt-32-bytes-long-for-test');
        }
        return '';
      });
      
      const token = await authManager.getAccessToken(userId);
      
      expect(token).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh access token',
        expect.objectContaining({
          userId,
          error: 'Network error'
        })
      );
    });

    it('should handle invalid token response', async () => {
      mockedAxios.post.mockResolvedValue({ data: { invalid: 'response' } });
      
      const result = await authManager.exchangeCodeForTokens(userId, 'code', 'state');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token response');
    });

    it('should handle file system errors gracefully', async () => {
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const token = await authManager.getAccessToken(userId);
      
      expect(token).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Multi-User Support', () => {
    it('should manage tokens for multiple users independently', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      // Generate auth URLs for both users
      const result1 = await authManager.generateAuthUrl(user1);
      const result2 = await authManager.generateAuthUrl(user2);
      
      expect(result1.state).not.toBe(result2.state);
      
      // Verify separate PKCE files
      const writeCallsArgs = mockedFs.writeFileSync.mock.calls.map(call => call[0]);
      expect(writeCallsArgs).toContain(join(tokenDir, `${user1}.pkce`));
      expect(writeCallsArgs).toContain(join(tokenDir, `${user2}.pkce`));
    });
  });

  describe('HSM Integration', () => {
    it('should get HSM audit log', () => {
      const auditLog = authManager.getHSMAuditLog();
      expect(Array.isArray(auditLog)).toBe(true);
    });

    it('should check if hardware HSM is available', () => {
      const isHardware = authManager.isHardwareHSM();
      expect(typeof isHardware).toBe('boolean');
      expect(isHardware).toBe(false); // Software fallback in tests
    });

    it('should use HSM for encryption when available', async () => {
      authManager['hsmEncryptionKeyId'] = 'test-hsm-key';
      authManager['hsmManager'].encrypt = jest.fn().mockResolvedValue(
        Buffer.from('hsm-encrypted')
      );
      
      const encrypted = await authManager['encrypt']('test-data');
      
      expect(encrypted).toStartWith('hsm:');
      expect(authManager['hsmManager'].encrypt).toHaveBeenCalledWith(
        'test-hsm-key',
        Buffer.from('test-data', 'utf8')
      );
    });

    it('should fallback to PBKDF2 when HSM encryption fails', async () => {
      authManager['hsmEncryptionKeyId'] = 'test-hsm-key';
      authManager['hsmManager'].encrypt = jest.fn().mockRejectedValue(
        new Error('HSM error')
      );
      
      const encrypted = await authManager['encrypt']('test-data');
      
      expect(encrypted).toStartWith('pbkdf2:');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HSM encryption failed, falling back to PBKDF2',
        expect.any(Object)
      );
    });
  });
});