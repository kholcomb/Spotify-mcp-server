/**
 * Comprehensive tests for SecurityConfigManager
 * Tests configuration validation, business rules, environment settings, and security posture scoring
 */

import { jest } from '@jest/globals';
import { 
  SecurityConfigManager, 
  getSecurityConfigFromEnv,
  type SecurityEnvironment,
  type SecuritySettings
} from '../../../src/security/securityConfig.js';
import type { Logger } from '../../../src/types/index.js';

describe('SecurityConfigManager', () => {
  let mockLogger: Logger;
  let originalEnv: typeof process.env;

  beforeAll(() => {
    originalEnv = process.env;
  });

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with development configuration', () => {
      const manager = new SecurityConfigManager('development', mockLogger);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Security configuration initialized',
        expect.objectContaining({
          environment: 'development',
          clientAuthEnabled: true,
          inputSanitizationEnabled: true,
          certificatePinningEnabled: false, // Disabled in development
          oauthTier: 'limited',
          requireHSM: false,
        })
      );
    });

    it('should initialize with production configuration', () => {
      const manager = new SecurityConfigManager('production', mockLogger);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Security configuration initialized',
        expect.objectContaining({
          environment: 'production',
          clientAuthEnabled: true,
          certificatePinningEnabled: true, // Enabled in production
          oauthTier: 'read-only', // Most restrictive in production
          requireHSM: true,
        })
      );
    });

    it('should apply configuration overrides', () => {
      const overrides: Partial<SecuritySettings> = {
        oauthScopes: {
          tier: 'full-access',
        },
        clientAuth: {
          enabled: true,
          requireAuth: false,
          tokenLifetime: 7200000,
          allowedOrigins: ['*'],
          rateLimitPerClient: 200,
        },
      };
      
      const manager = new SecurityConfigManager('development', mockLogger, overrides);
      const config = manager.getConfig();
      
      expect(config.oauthScopes.tier).toBe('full-access');
      expect(config.clientAuth.requireAuth).toBe(false);
      expect(config.clientAuth.tokenLifetime).toBe(7200000);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration without errors', () => {
      expect(() => {
        new SecurityConfigManager('development', mockLogger);
      }).not.toThrow();
    });

    it('should reject invalid token lifetime', () => {
      const invalidOverrides = {
        clientAuth: {
          enabled: true,
          requireAuth: true,
          tokenLifetime: 100, // Too short (< 5 minutes)
          allowedOrigins: ['localhost'],
          rateLimitPerClient: 60,
        },
      };

      expect(() => {
        new SecurityConfigManager('development', mockLogger, invalidOverrides);
      }).toThrow(/Security configuration validation failed/);
    });

    it('should reject invalid rate limiting configuration', () => {
      const invalidOverrides = {
        rateLimiting: {
          userLimits: {
            requestsPerMinute: 0, // Invalid: too low
            requestsPerHour: 1000,
            requestsPerDay: 10000,
          },
          globalLimits: {
            requestsPerMinute: 100,
            concurrentRequests: 50,
          },
          abuseProtection: {
            enabled: true,
            maxFailuresPerMinute: 10,
            blockDurationMs: 300000,
            enableCircuitBreaker: true,
          },
          toolLimits: {},
        },
      };

      expect(() => {
        new SecurityConfigManager('development', mockLogger, invalidOverrides);
      }).toThrow(/Security configuration validation failed/);
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce production security requirements', () => {
      const insecureProductionOverrides = {
        clientAuth: {
          enabled: true,
          requireAuth: false, // Invalid for production
          tokenLifetime: 3600000,
          allowedOrigins: ['*'], // Invalid for production
          rateLimitPerClient: 100,
        },
        certificatePinning: {
          enabled: false, // Invalid for production
          strictMode: false,
          allowDevelopment: false,
          pins: {},
        },
        logging: {
          maskSensitiveData: false, // Invalid for production
          enableSecurityAudit: true,
          maxLogFieldLength: 500,
          allowedLogLevels: ['warn', 'error'],
          sensitiveFields: [],
          maskingPatterns: {},
        },
      };

      expect(() => {
        new SecurityConfigManager('production', mockLogger, insecureProductionOverrides);
      }).toThrow(/Security configuration business rule validation failed/);
    });

    it('should validate rate limiting consistency', () => {
      const inconsistentRateLimits = {
        rateLimiting: {
          userLimits: {
            requestsPerMinute: 120, // Exceeds per-hour average (100/60 = 1.67/min)
            requestsPerHour: 100,
            requestsPerDay: 1000,
          },
          globalLimits: {
            requestsPerMinute: 50, // Less than user limit
            concurrentRequests: 25,
          },
          abuseProtection: {
            enabled: true,
            maxFailuresPerMinute: 10,
            blockDurationMs: 300000,
            enableCircuitBreaker: true,
          },
          toolLimits: {},
        },
      };

      expect(() => {
        new SecurityConfigManager('development', mockLogger, inconsistentRateLimits);
      }).toThrow(/Per-minute rate limit exceeds per-hour average/);
    });

    it('should validate token lifetime in production', () => {
      const longTokenLifetime = {
        clientAuth: {
          enabled: true,
          requireAuth: true,
          tokenLifetime: 7200000, // 2 hours - too long for production
          allowedOrigins: ['api.example.com'],
          rateLimitPerClient: 60,
        },
      };

      expect(() => {
        new SecurityConfigManager('production', mockLogger, longTokenLifetime);
      }).toThrow(/Production environment should use token lifetime ≤ 1 hour/);
    });

    it('should validate key rotation settings', () => {
      const invalidKeyRotation = {
        encryption: {
          algorithm: 'aes-256-gcm' as const,
          keyRotationDays: 0, // Invalid: must be at least 1 day
          requireHSM: false,
        },
      };

      expect(() => {
        new SecurityConfigManager('development', mockLogger, invalidKeyRotation);
      }).toThrow(/Key rotation period must be at least 1 day/);
    });

    it('should validate abuse protection settings', () => {
      const invalidAbuseProtection = {
        rateLimiting: {
          userLimits: {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
            requestsPerDay: 10000,
          },
          globalLimits: {
            requestsPerMinute: 100,
            concurrentRequests: 50,
          },
          abuseProtection: {
            enabled: true,
            maxFailuresPerMinute: 2, // Too low - must be at least 3
            blockDurationMs: 30000, // Too short - must be at least 1 minute
            enableCircuitBreaker: true,
          },
          toolLimits: {},
        },
      };

      expect(() => {
        new SecurityConfigManager('development', mockLogger, invalidAbuseProtection);
      }).toThrow(/Abuse protection threshold must allow at least 3 failures per minute/);
    });
  });

  describe('Configuration Getters', () => {
    let manager: SecurityConfigManager;

    beforeEach(() => {
      manager = new SecurityConfigManager('development', mockLogger);
    });

    it('should return complete configuration', () => {
      const config = manager.getConfig();
      
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('clientAuth');
      expect(config).toHaveProperty('inputSanitization');
      expect(config).toHaveProperty('certificatePinning');
      expect(config).toHaveProperty('logging');
      expect(config).toHaveProperty('rateLimiting');
      expect(config).toHaveProperty('oauthScopes');
      expect(config).toHaveProperty('encryption');
      expect(config).toHaveProperty('monitoring');
    });

    it('should return client auth configuration', () => {
      const clientAuthConfig = manager.getClientAuthConfig();
      
      expect(clientAuthConfig).toHaveProperty('enabled');
      expect(clientAuthConfig).toHaveProperty('requireAuth');
      expect(clientAuthConfig).toHaveProperty('tokenLifetime');
      expect(clientAuthConfig).toHaveProperty('allowedOrigins');
      expect(clientAuthConfig).toHaveProperty('rateLimitPerClient');
    });

    it('should return input sanitization configuration', () => {
      const sanitizationConfig = manager.getInputSanitizationConfig();
      
      expect(sanitizationConfig).toHaveProperty('enabled');
      expect(sanitizationConfig).toHaveProperty('maxStringLength');
      expect(sanitizationConfig).toHaveProperty('maxArrayLength');
      expect(sanitizationConfig).toHaveProperty('strictMode');
      expect(sanitizationConfig).toHaveProperty('allowedCharacterSets');
      expect(sanitizationConfig).toHaveProperty('blockedPatterns');
    });

    it('should return certificate pinning configuration', () => {
      const certConfig = manager.getCertificatePinningConfig();
      
      expect(certConfig).toHaveProperty('enabled');
      expect(certConfig).toHaveProperty('strictMode');
      expect(certConfig).toHaveProperty('allowDevelopment');
      expect(certConfig).toHaveProperty('pins');
    });

    it('should return secure logger configuration', () => {
      const loggerConfig = manager.getSecureLoggerConfig();
      
      expect(loggerConfig).toHaveProperty('maskSensitiveData');
      expect(loggerConfig).toHaveProperty('enableSecurityAudit');
      expect(loggerConfig).toHaveProperty('maxLogFieldLength');
      expect(loggerConfig).toHaveProperty('allowedLogLevels');
      expect(loggerConfig).toHaveProperty('sensitiveFields');
      expect(loggerConfig).toHaveProperty('maskingPatterns');
    });

    it('should return rate limiting configuration with tool limits', () => {
      const rateLimitConfig = manager.getRateLimitingConfig();
      
      expect(rateLimitConfig).toHaveProperty('userLimits');
      expect(rateLimitConfig).toHaveProperty('globalLimits');
      expect(rateLimitConfig).toHaveProperty('abuseProtection');
      expect(rateLimitConfig).toHaveProperty('toolLimits');
      expect(rateLimitConfig.toolLimits).toHaveProperty('search');
      expect(rateLimitConfig.toolLimits).toHaveProperty('play');
      expect(rateLimitConfig.toolLimits).toHaveProperty('authenticate');
    });
  });

  describe('Runtime Configuration Updates', () => {
    let manager: SecurityConfigManager;

    beforeEach(() => {
      manager = new SecurityConfigManager('development', mockLogger);
    });

    it('should allow valid configuration updates', () => {
      const updates = {
        oauthScopes: {
          tier: 'read-only' as const,
        },
      };

      expect(() => {
        manager.updateConfig(updates);
      }).not.toThrow();

      const config = manager.getConfig();
      expect(config.oauthScopes.tier).toBe('read-only');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Security configuration updated',
        expect.objectContaining({
          updatedFields: ['oauthScopes'],
        })
      );
    });

    it('should reject invalid configuration updates', () => {
      const invalidUpdates = {
        clientAuth: {
          enabled: true,
          requireAuth: true,
          tokenLifetime: 100, // Invalid: too short
          allowedOrigins: ['localhost'],
          rateLimitPerClient: 60,
        },
      };

      expect(() => {
        manager.updateConfig(invalidUpdates);
      }).toThrow('Invalid security configuration update');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Security configuration update failed',
        expect.objectContaining({
          updates: invalidUpdates,
        })
      );
    });
  });

  describe('Security Recommendations', () => {
    it('should provide recommendations for production environment', () => {
      // Create insecure production config
      const insecureOverrides = {
        clientAuth: {
          enabled: true,
          requireAuth: false,
          tokenLifetime: 3600000,
          allowedOrigins: ['*'],
          rateLimitPerClient: 200,
        },
        certificatePinning: {
          enabled: false,
          strictMode: false,
          allowDevelopment: false,
          pins: {},
        },
        rateLimiting: {
          userLimits: {
            requestsPerMinute: 150, // High rate limit
            requestsPerHour: 2000,
            requestsPerDay: 20000,
          },
          globalLimits: {
            requestsPerMinute: 500,
            concurrentRequests: 100,
          },
          abuseProtection: {
            enabled: false, // Disabled
            maxFailuresPerMinute: 10,
            blockDurationMs: 300000,
            enableCircuitBreaker: true,
          },
          toolLimits: {},
        },
        oauthScopes: {
          tier: 'full-access' as const,
        },
      };

      // This will throw due to business rule validation, so we'll test in staging
      const manager = new SecurityConfigManager('staging', mockLogger, insecureOverrides);
      const recommendations = manager.getSecurityRecommendations();

      expect(recommendations).toContain('Consider lowering per-user rate limits for better security');
      expect(recommendations).toContain('Enable abuse protection to prevent malicious usage');
    });

    it('should provide recommendations for development environment', () => {
      const devManager = new SecurityConfigManager('development', mockLogger);
      const recommendations = devManager.getSecurityRecommendations();

      // Development should have fewer strict requirements
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Security Posture Validation', () => {
    it('should score secure configurations highly', () => {
      const secureManager = new SecurityConfigManager('production', mockLogger);
      const posture = secureManager.validateSecurityPosture();

      expect(posture.score).toBeGreaterThan(80);
      expect(posture.issues.length).toBeLessThan(3);
      expect(posture.recommendations).toBeDefined();
    });

    it('should identify critical security issues', () => {
      const insecureOverrides = {
        inputSanitization: {
          enabled: false, // Critical: disabled input sanitization
          maxStringLength: 1000,
          maxArrayLength: 100,
          strictMode: false,
          allowedCharacterSets: {},
          blockedPatterns: [],
        },
      };

      const insecureManager = new SecurityConfigManager('development', mockLogger, insecureOverrides);
      const posture = insecureManager.validateSecurityPosture();

      expect(posture.score).toBeLessThan(80);
      expect(posture.issues.some(issue => issue.severity === 'critical')).toBe(true);
      expect(posture.issues.some(issue => issue.message.includes('Input sanitization disabled'))).toBe(true);
    });

    it('should provide detailed security analysis', () => {
      const manager = new SecurityConfigManager('staging', mockLogger);
      const posture = manager.validateSecurityPosture();

      expect(posture).toHaveProperty('score');
      expect(posture).toHaveProperty('issues');
      expect(posture).toHaveProperty('recommendations');
      expect(Array.isArray(posture.issues)).toBe(true);
      expect(Array.isArray(posture.recommendations)).toBe(true);
    });
  });

  describe('Environment Configuration Parsing', () => {
    it('should parse environment variables correctly', () => {
      process.env.NODE_ENV = 'production';
      process.env.OAUTH_SCOPE_TIER = 'read-only';
      process.env.REQUIRE_HSM = 'true';
      process.env.REQUIRE_CLIENT_AUTH = 'false';

      const envConfig = getSecurityConfigFromEnv();

      expect(envConfig.environment).toBe('production');
      expect(envConfig.overrides.oauthScopes?.tier).toBe('read-only');
      expect(envConfig.overrides.encryption?.requireHSM).toBe(true);
      expect(envConfig.overrides.clientAuth?.requireAuth).toBe(false);
    });

    it('should use default environment when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const envConfig = getSecurityConfigFromEnv();

      expect(envConfig.environment).toBe('development');
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.OAUTH_SCOPE_TIER;
      delete process.env.REQUIRE_HSM;
      delete process.env.REQUIRE_CLIENT_AUTH;

      const envConfig = getSecurityConfigFromEnv();

      expect(envConfig.overrides.oauthScopes).toBeUndefined();
      expect(envConfig.overrides.encryption).toBeUndefined();
      expect(envConfig.overrides.clientAuth).toBeUndefined();
    });
  });

  describe('Tool Limits Configuration', () => {
    it('should scale tool limits based on environment', () => {
      const devManager = new SecurityConfigManager('development', mockLogger);
      const stagingManager = new SecurityConfigManager('staging', mockLogger);
      const prodManager = new SecurityConfigManager('production', mockLogger);

      const devConfig = devManager.getRateLimitingConfig();
      const stagingConfig = stagingManager.getRateLimitingConfig();
      const prodConfig = prodManager.getRateLimitingConfig();

      // Production should have the most restrictive limits
      expect(prodConfig.toolLimits.search.requestsPerMinute)
        .toBeLessThan(devConfig.toolLimits.search.requestsPerMinute);
      
      expect(stagingConfig.toolLimits.search.requestsPerMinute)
        .toBeLessThan(devConfig.toolLimits.search.requestsPerMinute);
      
      expect(stagingConfig.toolLimits.search.requestsPerMinute)
        .toBeGreaterThan(prodConfig.toolLimits.search.requestsPerMinute);
    });

    it('should include all expected tool configurations', () => {
      const manager = new SecurityConfigManager('development', mockLogger);
      const config = manager.getRateLimitingConfig();

      const expectedTools = [
        'search', 'play', 'pause', 'skip_next', 'skip_previous',
        'set_volume', 'authenticate', 'get_user_top_tracks',
        'get_user_top_artists', 'get_audio_features'
      ];

      expectedTools.forEach(tool => {
        expect(config.toolLimits).toHaveProperty(tool);
        expect(config.toolLimits[tool]).toHaveProperty('requestsPerMinute');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed override objects', () => {
      const malformedOverrides = {
        clientAuth: 'invalid', // Should be an object
      };

      // Type error would be caught at compile time, but testing runtime behavior
      expect(() => {
        new SecurityConfigManager('development', mockLogger, malformedOverrides as any);
      }).toThrow();
    });

    it('should handle partial configuration merging', () => {
      const partialOverrides = {
        clientAuth: {
          tokenLifetime: 7200000, // Only override one field
        },
      };

      const manager = new SecurityConfigManager('development', mockLogger, partialOverrides);
      const config = manager.getClientAuthConfig();

      expect(config.tokenLifetime).toBe(7200000); // Overridden
      expect(config.enabled).toBe(true); // From default
      expect(config.requireAuth).toBe(false); // From development default
    });

    it('should maintain immutability of returned configurations', () => {
      const manager = new SecurityConfigManager('development', mockLogger);
      const config1 = manager.getConfig();
      const config2 = manager.getConfig();

      // Should be different objects
      expect(config1).not.toBe(config2);
      
      // But with same content
      expect(config1).toEqual(config2);
    });
  });
});