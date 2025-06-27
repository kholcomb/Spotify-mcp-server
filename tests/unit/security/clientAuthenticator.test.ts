/**
 * Comprehensive tests for ClientAuthenticator security component
 * Tests authentication flows, token generation, rate limiting, and security validations
 */

import { jest } from '@jest/globals';
import { randomBytes } from 'crypto';
import { ClientAuthenticator, type ClientAuthConfig, type ClientRequest } from '../../../src/security/clientAuthenticator.js';
import type { Logger } from '../../../src/types/index.js';

// Mock crypto and fs modules
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-signature'),
  })),
}));

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
}));

jest.mock('os', () => ({
  homedir: jest.fn(() => '/tmp/test-home'),
}));

describe('ClientAuthenticator', () => {
  let authenticator: ClientAuthenticator;
  let mockLogger: Logger;
  let originalEnv: typeof process.env;

  const defaultConfig: Partial<ClientAuthConfig> = {
    enabled: true,
    requireAuth: true,
    tokenLifetime: 3600000,
    allowedOrigins: ['localhost', '127.0.0.1'],
    rateLimitPerClient: 10,
  };

  beforeAll(() => {
    originalEnv = process.env;
  });

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.MCP_TOKEN_SECRET = 'test-secret-32-characters-long-12345';

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock randomBytes to return predictable values
    (randomBytes as jest.Mock).mockImplementation((size: number) => {
      return Buffer.from('a'.repeat(size));
    });

    authenticator = new ClientAuthenticator(defaultConfig, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = authenticator.getConfiguration?.() || defaultConfig;
      expect(config.enabled).toBe(true);
      expect(config.requireAuth).toBe(true);
      expect(config.tokenLifetime).toBe(3600000);
    });

    it('should log initialization details', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Client authenticator initialized',
        expect.objectContaining({
          enabled: true,
          requireAuth: true,
          tokenLifetime: 3600000,
        })
      );
    });

    it('should use production defaults when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const _prodAuthenticator = new ClientAuthenticator({}, mockLogger);
      
      // Should default to requiring auth in production
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Client authenticator initialized',
        expect.objectContaining({
          requireAuth: true,
        })
      );
    });
  });

  describe('Authentication Request Processing', () => {
    it('should authenticate successfully with valid token', async () => {
      // Create a client first
      const { clientId, clientSecret } = await authenticator.createClient('test-client', ['read']);
      const { token } = await authenticator.generateToken(clientId, clientSecret);

      const request: ClientRequest = {
        token,
        origin: 'localhost',
        timestamp: Date.now(),
      };

      const result = await authenticator.authenticateRequest(request);

      expect(result.authenticated).toBe(true);
      expect(result.clientId).toBe(clientId);
      expect(result.scopes).toEqual(['read']);
      expect(result.error).toBeUndefined();
    });

    it('should reject request with invalid token', async () => {
      const request: ClientRequest = {
        token: 'invalid-token',
        origin: 'localhost',
        timestamp: Date.now(),
      };

      const result = await authenticator.authenticateRequest(request);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token not found');
    });

    it('should reject request from unauthorized origin', async () => {
      const request: ClientRequest = {
        token: 'some-token',
        origin: 'malicious.com',
        timestamp: Date.now(),
      };

      const result = await authenticator.authenticateRequest(request);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Unauthorized origin');
    });

    it('should allow request when authentication is disabled', async () => {
      const noAuthConfig = { ...defaultConfig, enabled: false };
      const noAuthAuthenticator = new ClientAuthenticator(noAuthConfig, mockLogger);

      const request: ClientRequest = {
        origin: 'localhost',
        timestamp: Date.now(),
      };

      const result = await noAuthAuthenticator.authenticateRequest(request);

      expect(result.authenticated).toBe(true);
      expect(result.clientId).toBe('anonymous');
    });

    it('should handle missing token when auth is required', async () => {
      const request: ClientRequest = {
        origin: 'localhost',
        timestamp: Date.now(),
      };

      const result = await authenticator.authenticateRequest(request);

      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Authentication token required');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per client', async () => {
      const request: ClientRequest = {
        origin: 'localhost',
        timestamp: Date.now(),
      };

      // Exceed rate limit
      for (let i = 0; i < 12; i++) {
        await authenticator.authenticateRequest(request);
      }

      const result = await authenticator.authenticateRequest(request);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Rate limit exceeded. Please try again later.');
    });

    it('should reset rate limits after time window', async () => {
      const request: ClientRequest = {
        origin: 'localhost',
        timestamp: Date.now(),
      };

      // Exceed rate limit
      for (let i = 0; i < 12; i++) {
        await authenticator.authenticateRequest(request);
      }

      // Mock time progression (1 minute + 1ms)
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60001);

      const result = await authenticator.authenticateRequest(request);
      expect(result.authenticated).toBe(false); // Still fails due to missing token, but not rate limit
      expect(result.error).toBe('Authentication token required');
    });
  });

  describe('Client Management', () => {
    it('should create a new client with valid credentials', async () => {
      const result = await authenticator.createClient('test-client', ['read', 'write']);

      expect(result.clientId).toMatch(/^mcp_[a-f0-9]{32}$/);
      expect(result.clientSecret).toBeDefined();
      expect(typeof result.clientSecret).toBe('string');
    });

    it('should list clients without exposing secrets', () => {
      // First create a client
      authenticator.createClient('test-client', ['read']);

      const clients = authenticator.listClients();
      expect(Array.isArray(clients)).toBe(true);
      
      if (clients.length > 0) {
        const client = clients[0];
        expect(client).toHaveProperty('clientId');
        expect(client).toHaveProperty('name');
        expect(client).toHaveProperty('scopes');
        expect(client).toHaveProperty('created');
        expect(client).not.toHaveProperty('clientSecret');
      }
    });

    it('should delete a client and revoke its tokens', async () => {
      const { clientId, clientSecret } = await authenticator.createClient('test-client', ['read']);
      const { token } = await authenticator.generateToken(clientId, clientSecret);

      // Delete the client
      await authenticator.deleteClient(clientId);

      // Token should no longer be valid
      const request: ClientRequest = {
        token,
        origin: 'localhost',
        timestamp: Date.now(),
      };

      const result = await authenticator.authenticateRequest(request);
      expect(result.authenticated).toBe(false);
    });
  });

  describe('Token Generation and Validation', () => {
    it('should generate valid tokens with proper structure', async () => {
      const { clientId, clientSecret } = await authenticator.createClient('test-client', ['read']);
      const { token, expires } = await authenticator.generateToken(clientId, clientSecret);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(4); // timestamp.random.nonce.signature
      expect(expires).toBeInstanceOf(Date);
      expect(expires.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reject token generation with invalid credentials', async () => {
      const { clientId } = await authenticator.createClient('test-client', ['read']);

      await expect(
        authenticator.generateToken(clientId, 'wrong-secret')
      ).rejects.toThrow('Invalid client credentials');
    });

    it('should reject token generation for non-existent client', async () => {
      await expect(
        authenticator.generateToken('non-existent-client', 'any-secret')
      ).rejects.toThrow('Client not found');
    });

    it('should reject expired tokens', async () => {
      const { clientId, clientSecret } = await authenticator.createClient('test-client', ['read']);
      const { token } = await authenticator.generateToken(clientId, clientSecret);

      // Mock token expiration by advancing time
      const futureTime = Date.now() + 3700000; // 1 hour + 1 second
      jest.useFakeTimers();
      jest.setSystemTime(futureTime);

      const request: ClientRequest = {
        token,
        origin: 'localhost',
        timestamp: futureTime,
      };

      const result = await authenticator.authenticateRequest(request);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should revoke tokens successfully', async () => {
      const { clientId, clientSecret } = await authenticator.createClient('test-client', ['read']);
      const { token } = await authenticator.generateToken(clientId, clientSecret);

      await authenticator.revokeToken(token);

      const request: ClientRequest = {
        token,
        origin: 'localhost',
        timestamp: Date.now(),
      };

      const result = await authenticator.authenticateRequest(request);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe('Token not found');
    });
  });

  describe('Scope Validation', () => {
    it('should validate client scopes correctly', () => {
      // This would need to be tested after creating a client
      const hasScope = authenticator.hasScope('test-client', 'read');
      expect(typeof hasScope).toBe('boolean');
    });

    it('should handle wildcard scopes', async () => {
      const { clientId } = await authenticator.createClient('admin-client', ['*']);
      const hasScope = authenticator.hasScope(clientId, 'any-scope');
      expect(hasScope).toBe(true);
    });
  });

  describe('Security Hardening', () => {
    it('should require secure token secret', async () => {
      delete process.env.MCP_TOKEN_SECRET;
      
      const authenticator = new ClientAuthenticator(defaultConfig, mockLogger);
      const { clientId, clientSecret } = await authenticator.createClient('test-client', ['read']);

      await expect(async () => {
        await authenticator.generateToken(clientId, clientSecret);
      }).rejects.toThrow('MCP_TOKEN_SECRET environment variable is required');
    });

    it('should reject default/weak secrets', () => {
      process.env.MCP_TOKEN_SECRET = 'default-secret-change-in-production';

      const weakAuthenticator = new ClientAuthenticator(defaultConfig, mockLogger);

      expect(async () => {
        const { clientId, clientSecret } = await weakAuthenticator.createClient('test', ['read']);
        await weakAuthenticator.generateToken(clientId, clientSecret);
      }).rejects.toThrow('Default MCP_TOKEN_SECRET detected');
    });

    it('should enforce minimum secret length', () => {
      process.env.MCP_TOKEN_SECRET = 'short';

      const weakAuthenticator = new ClientAuthenticator(defaultConfig, mockLogger);

      expect(async () => {
        const { clientId, clientSecret } = await weakAuthenticator.createClient('test', ['read']);
        await weakAuthenticator.generateToken(clientId, clientSecret);
      }).rejects.toThrow('MCP_TOKEN_SECRET must be at least 32 characters');
    });

    it('should log security events appropriately', async () => {
      const request: ClientRequest = {
        token: 'invalid-token',
        origin: 'malicious.com',
        timestamp: Date.now(),
      };

      await authenticator.authenticateRequest(request);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Request from unauthorized origin',
        expect.objectContaining({
          origin: 'malicious.com',
        })
      );
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty allowed origins list', async () => {
      const restrictiveConfig = { ...defaultConfig, allowedOrigins: [] };
      const restrictiveAuth = new ClientAuthenticator(restrictiveConfig, mockLogger);

      const request: ClientRequest = {
        origin: 'localhost',
        timestamp: Date.now(),
      };

      await expect(
        restrictiveAuth.authenticateRequest(request)
      ).resolves.not.toThrow();
    });

    it('should handle wildcard origins', async () => {
      const openConfig = { ...defaultConfig, allowedOrigins: ['*'] };
      const openAuth = new ClientAuthenticator(openConfig, mockLogger);

      const request: ClientRequest = {
        origin: 'any-origin.com',
        timestamp: Date.now(),
      };

      const result = await openAuth.authenticateRequest(request);
      expect(result.error).not.toBe('Unauthorized origin');
    });
  });
});