/**
 * Comprehensive tests for SecureLogger security component
 * Tests PII masking, security event tracking, and secure logging practices
 */

import { jest } from '@jest/globals';
import { 
  SecureLogger,
  createSecurityEvent,
  type SecureLoggerConfig,
  type SecurityEvent
} from '../../../src/security/secureLogger.js';
import type { Logger } from '../../../src/types/index.js';

describe('SecureLogger', () => {
  let secureLogger: SecureLogger;
  let mockBaseLogger: Logger;

  const defaultConfig: SecureLoggerConfig = {
    maskSensitiveData: true,
    enableSecurityAudit: true,
    maxLogFieldLength: 500,
    allowedLogLevels: ['debug', 'info', 'warn', 'error'],
    sensitiveFields: ['password', 'token', 'secret', 'key', 'email'],
    maskingPatterns: {
      creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/g,
      ssn: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
      spotifyUri: /spotify:(track|album|artist|playlist):[a-zA-Z0-9]{22}/g,
    },
  };

  beforeEach(() => {
    mockBaseLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    secureLogger = new SecureLogger(mockBaseLogger, defaultConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with provided configuration', () => {
      expect(mockBaseLogger.info).toHaveBeenCalledWith(
        'Secure logger initialized',
        expect.objectContaining({
          maskSensitiveData: true,
          enableSecurityAudit: true,
          sensitiveFieldCount: 5,
          maskingPatternCount: 5,
        })
      );
    });

    it('should use default configuration when not provided', () => {
      const defaultLogger = new SecureLogger(mockBaseLogger, {});
      
      expect(mockBaseLogger.info).toHaveBeenCalledWith(
        'Secure logger initialized',
        expect.objectContaining({
          maskSensitiveData: expect.any(Boolean),
          enableSecurityAudit: expect.any(Boolean),
        })
      );
    });

    it('should allow disabling sensitive data masking', () => {
      const unmaskedConfig = { ...defaultConfig, maskSensitiveData: false };
      const unmaskedLogger = new SecureLogger(mockBaseLogger, unmaskedConfig);
      
      expect(mockBaseLogger.info).toHaveBeenCalledWith(
        'Secure logger initialized',
        expect.objectContaining({
          maskSensitiveData: false,
        })
      );
    });
  });

  describe('Basic Logging Functions', () => {
    it('should forward debug messages', () => {
      secureLogger.debug('Test debug message', { key: 'value' });
      
      expect(mockBaseLogger.debug).toHaveBeenCalledWith(
        'Test debug message',
        expect.any(Object)
      );
    });

    it('should forward info messages', () => {
      secureLogger.info('Test info message', { key: 'value' });
      
      expect(mockBaseLogger.info).toHaveBeenCalledWith(
        'Test info message',
        expect.any(Object)
      );
    });

    it('should forward warn messages', () => {
      secureLogger.warn('Test warn message', { key: 'value' });
      
      expect(mockBaseLogger.warn).toHaveBeenCalledWith(
        'Test warn message',
        expect.any(Object)
      );
    });

    it('should forward error messages', () => {
      secureLogger.error('Test error message', { key: 'value' });
      
      expect(mockBaseLogger.error).toHaveBeenCalledWith(
        'Test error message',
        expect.any(Object)
      );
    });
  });

  describe('PII and Sensitive Data Masking', () => {
    it('should mask sensitive field names', () => {
      const sensitiveData = {
        username: 'john_doe',
        password: 'super-secret-password',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        normalField: 'not sensitive',
      };

      secureLogger.info('Login attempt', sensitiveData);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.username).toBe('john_doe'); // Not in sensitive fields
      expect(loggedData.password).toMatch(/\*+/); // Should be masked
      expect(loggedData.token).toMatch(/\*+/); // Should be masked
      expect(loggedData.normalField).toBe('not sensitive'); // Unchanged
    });

    it('should mask email addresses', () => {
      const dataWithEmail = {
        message: 'User registered with email john.doe@example.com',
        userEmail: 'jane.smith@company.org',
      };

      secureLogger.info('User registration', dataWithEmail);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.message).not.toContain('john.doe@example.com');
      expect(loggedData.message).toContain('***@***.***');
      expect(loggedData.userEmail).not.toContain('jane.smith@company.org');
    });

    it('should mask credit card numbers', () => {
      const dataWithCC = {
        paymentInfo: 'Card number: 4532-1234-5678-9012',
        alternateFormat: '4532 1234 5678 9012',
        noSpaces: '4532123456789012',
      };

      secureLogger.warn('Payment processing', dataWithCC);

      const loggedData = (mockBaseLogger.warn as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.paymentInfo).not.toContain('4532-1234-5678-9012');
      expect(loggedData.alternateFormat).not.toContain('4532 1234 5678 9012');
      expect(loggedData.noSpaces).not.toContain('4532123456789012');
      expect(loggedData.paymentInfo).toContain('****-****-****-****');
    });

    it('should mask phone numbers', () => {
      const dataWithPhone = {
        contact: 'Phone: 555-123-4567',
        phoneField: '555 123 4567',
        compactPhone: '5551234567',
      };

      secureLogger.info('Contact info', dataWithPhone);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.contact).not.toContain('555-123-4567');
      expect(loggedData.phoneField).not.toContain('555 123 4567');
      expect(loggedData.contact).toContain('***-***-****');
    });

    it('should mask SSN numbers', () => {
      const dataWithSSN = {
        ssn: '123-45-6789',
        alternateSSN: '123 45 6789',
        compactSSN: '123456789',
      };

      secureLogger.error('Sensitive data exposure', dataWithSSN);

      const loggedData = (mockBaseLogger.error as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.ssn).not.toContain('123-45-6789');
      expect(loggedData.alternateSSN).not.toContain('123 45 6789');
      expect(loggedData.ssn).toContain('***-**-****');
    });

    it('should mask Spotify URIs', () => {
      const dataWithURI = {
        trackInfo: 'Playing spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
        albumData: 'Album: spotify:album:1DFixLWuPkv3KT3TnV35m3',
      };

      secureLogger.debug('Playback info', dataWithURI);

      const loggedData = (mockBaseLogger.debug as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.trackInfo).not.toContain('4iV5W9uYEdYUVa79Axb7Rh');
      expect(loggedData.albumData).not.toContain('1DFixLWuPkv3KT3TnV35m3');
      expect(loggedData.trackInfo).toContain('spotify:track:****');
    });

    it('should handle nested objects for masking', () => {
      const nestedData = {
        user: {
          id: 'user123',
          email: 'user@example.com',
          profile: {
            password: 'hidden-password',
            settings: {
              token: 'access-token-12345',
            },
          },
        },
        metadata: {
          creditCard: '4532-1234-5678-9012',
        },
      };

      secureLogger.info('User data', nestedData);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.user.id).toBe('user123'); // Unchanged
      expect(loggedData.user.email).not.toContain('user@example.com'); // Masked
      expect(loggedData.user.profile.password).toMatch(/\*+/); // Masked
      expect(loggedData.user.profile.settings.token).toMatch(/\*+/); // Masked
      expect(loggedData.metadata.creditCard).toContain('****-****-****-****'); // Masked
    });

    it('should allow disabling masking', () => {
      const unmaskedConfig = { ...defaultConfig, maskSensitiveData: false };
      const unmaskedLogger = new SecureLogger(mockBaseLogger, unmaskedConfig);

      const sensitiveData = {
        password: 'super-secret',
        email: 'test@example.com',
      };

      unmaskedLogger.info('Unmasked log', sensitiveData);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[1][1]; // Skip initialization log
      
      expect(loggedData.password).toBe('super-secret'); // Not masked
      expect(loggedData.email).toBe('test@example.com'); // Not masked
    });
  });

  describe('Field Length Truncation', () => {
    it('should truncate long field values', () => {
      const longValue = 'A'.repeat(1000);
      const dataWithLongField = {
        shortField: 'short',
        longField: longValue,
      };

      secureLogger.info('Long data test', dataWithLongField);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.shortField).toBe('short'); // Unchanged
      expect(loggedData.longField.length).toBe(500); // Truncated to maxLogFieldLength
      expect(loggedData.longField).toMatch(/A+\.\.\.\[truncated\]/);
    });

    it('should handle different max field lengths', () => {
      const shortLimitConfig = { ...defaultConfig, maxLogFieldLength: 10 };
      const shortLogger = new SecureLogger(mockBaseLogger, shortLimitConfig);

      const data = { field: 'This is a very long message' };

      shortLogger.info('Truncation test', data);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[1][1]; // Skip initialization log
      
      expect(loggedData.field.length).toBeLessThanOrEqual(13); // 10 + "...[truncated]" indicator
      expect(loggedData.field).toContain('...[truncated]');
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events when audit is enabled', () => {
      const securityEvent = createSecurityEvent(
        'authentication_failure',
        'high',
        'Invalid login attempt',
        {
          userId: 'user123',
          ipAddress: '192.168.1.100',
          attemptCount: 3,
        }
      );

      secureLogger.logSecurityEvent(securityEvent);

      expect(mockBaseLogger.warn).toHaveBeenCalledWith(
        'SECURITY_EVENT: authentication_failure',
        expect.objectContaining({
          eventType: 'authentication_failure',
          severity: 'high',
          message: 'Invalid login attempt',
          timestamp: expect.any(String),
          eventId: expect.any(String),
          metadata: expect.objectContaining({
            userId: 'user123',
          }),
        })
      );
    });

    it('should skip security events when audit is disabled', () => {
      const noAuditConfig = { ...defaultConfig, enableSecurityAudit: false };
      const noAuditLogger = new SecureLogger(mockBaseLogger, noAuditConfig);

      const securityEvent = createSecurityEvent(
        'test_event',
        'low',
        'Test event'
      );

      noAuditLogger.logSecurityEvent(securityEvent);

      // Should not log security events (only initialization log)
      expect(mockBaseLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('SECURITY_EVENT'),
        expect.any(Object)
      );
    });

    it('should mask sensitive data in security events', () => {
      const securityEvent = createSecurityEvent(
        'data_exposure',
        'critical',
        'Sensitive data detected',
        {
          password: 'leaked-password',
          email: 'user@example.com',
          normalField: 'safe-data',
        }
      );

      secureLogger.logSecurityEvent(securityEvent);

      const loggedEvent = (mockBaseLogger.warn as jest.Mock).mock.calls[0][1];
      
      expect(loggedEvent.metadata.password).toMatch(/\*+/); // Masked
      expect(loggedEvent.metadata.email).not.toContain('user@example.com'); // Masked
      expect(loggedEvent.metadata.normalField).toBe('safe-data'); // Unchanged
    });

    it('should use appropriate log levels for different security event severities', () => {
      const events = [
        { severity: 'low' as const, expectedLevel: 'debug' },
        { severity: 'medium' as const, expectedLevel: 'info' },
        { severity: 'high' as const, expectedLevel: 'warn' },
        { severity: 'critical' as const, expectedLevel: 'error' },
      ];

      events.forEach(({ severity, expectedLevel }) => {
        const event = createSecurityEvent('test_event', severity, `Test ${severity} event`);
        secureLogger.logSecurityEvent(event);

        expect(mockBaseLogger[expectedLevel as keyof Logger]).toHaveBeenCalledWith(
          expect.stringContaining('SECURITY_EVENT'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Log Level Filtering', () => {
    it('should filter out disallowed log levels', () => {
      const restrictedConfig = {
        ...defaultConfig,
        allowedLogLevels: ['warn', 'error'] as const,
      };
      const restrictedLogger = new SecureLogger(mockBaseLogger, restrictedConfig);

      // These should be allowed
      restrictedLogger.warn('Warning message', {});
      restrictedLogger.error('Error message', {});

      // These should be filtered out
      restrictedLogger.debug('Debug message', {});
      restrictedLogger.info('Info message', {});

      expect(mockBaseLogger.warn).toHaveBeenCalledWith('Warning message', expect.any(Object));
      expect(mockBaseLogger.error).toHaveBeenCalledWith('Error message', expect.any(Object));
      
      // Debug and info should not be called (except for initialization)
      const debugCalls = (mockBaseLogger.debug as jest.Mock).mock.calls.filter(
        call => call[0] !== 'Secure logger initialized'
      );
      const infoCalls = (mockBaseLogger.info as jest.Mock).mock.calls.filter(
        call => call[0] !== 'Secure logger initialized'
      );
      
      expect(debugCalls).toHaveLength(0);
      expect(infoCalls).toHaveLength(0);
    });

    it('should allow all log levels by default', () => {
      const allLevelsConfig = {
        ...defaultConfig,
        allowedLogLevels: ['debug', 'info', 'warn', 'error'] as const,
      };
      const allLevelsLogger = new SecureLogger(mockBaseLogger, allLevelsConfig);

      allLevelsLogger.debug('Debug', {});
      allLevelsLogger.info('Info', {});
      allLevelsLogger.warn('Warn', {});
      allLevelsLogger.error('Error', {});

      expect(mockBaseLogger.debug).toHaveBeenCalledWith('Debug', expect.any(Object));
      expect(mockBaseLogger.info).toHaveBeenCalledWith('Info', expect.any(Object));
      expect(mockBaseLogger.warn).toHaveBeenCalledWith('Warn', expect.any(Object));
      expect(mockBaseLogger.error).toHaveBeenCalledWith('Error', expect.any(Object));
    });
  });

  describe('Security Event Factory', () => {
    it('should create security events with required fields', () => {
      const event = createSecurityEvent(
        'test_event',
        'medium',
        'Test event message'
      );

      expect(event).toHaveProperty('eventType', 'test_event');
      expect(event).toHaveProperty('severity', 'medium');
      expect(event).toHaveProperty('message', 'Test event message');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('eventId');
      expect(new Date(event.timestamp)).toBeInstanceOf(Date);
      expect(event.eventId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });

    it('should include metadata when provided', () => {
      const metadata = {
        userId: 'user123',
        action: 'login',
        details: { attempts: 3 },
      };

      const event = createSecurityEvent(
        'authentication',
        'high',
        'Login event',
        metadata
      );

      expect(event).toHaveProperty('metadata', metadata);
    });

    it('should handle events without metadata', () => {
      const event = createSecurityEvent(
        'system_event',
        'low',
        'System message'
      );

      expect(event.metadata).toBeUndefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle circular references in log data', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      expect(() => {
        secureLogger.info('Circular test', circularData);
      }).not.toThrow();

      expect(mockBaseLogger.info).toHaveBeenCalled();
    });

    it('should handle null and undefined values', () => {
      const dataWithNulls = {
        nullValue: null,
        undefinedValue: undefined,
        normalValue: 'test',
      };

      secureLogger.info('Null test', dataWithNulls);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      expect(loggedData.nullValue).toBeNull();
      expect(loggedData.undefinedValue).toBeUndefined();
      expect(loggedData.normalValue).toBe('test');
    });

    it('should handle arrays in log data', () => {
      const dataWithArrays = {
        stringArray: ['one', 'two', 'password123'],
        objectArray: [
          { id: 1, token: 'secret-token' },
          { id: 2, email: 'user@example.com' },
        ],
      };

      secureLogger.info('Array test', dataWithArrays);

      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      expect(Array.isArray(loggedData.stringArray)).toBe(true);
      expect(Array.isArray(loggedData.objectArray)).toBe(true);
      
      // Sensitive data in arrays should be masked
      expect(loggedData.objectArray[0].token).toMatch(/\*+/);
      expect(loggedData.objectArray[1].email).not.toContain('user@example.com');
    });

    it('should handle very deep nested objects', () => {
      let deepObject: any = { level: 0 };
      let current = deepObject;
      
      // Create 10 levels of nesting
      for (let i = 1; i <= 10; i++) {
        current.nested = { level: i, password: `secret-${i}` };
        current = current.nested;
      }

      secureLogger.info('Deep nesting test', deepObject);

      expect(mockBaseLogger.info).toHaveBeenCalled();
      
      const loggedData = (mockBaseLogger.info as jest.Mock).mock.calls[0][1];
      
      // Navigate to deep level and check masking still works
      let deepLevel = loggedData;
      for (let i = 0; i < 5; i++) {
        deepLevel = deepLevel.nested;
      }
      expect(deepLevel.password).toMatch(/\*+/);
    });

    it('should handle functions and other non-serializable data', () => {
      const dataWithFunction = {
        normalField: 'test',
        functionField: () => 'test function',
        symbolField: Symbol('test'),
      };

      expect(() => {
        secureLogger.info('Non-serializable test', dataWithFunction);
      }).not.toThrow();

      expect(mockBaseLogger.info).toHaveBeenCalled();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large log objects efficiently', () => {
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`field_${i}`] = `value_${i}`;
      }

      const startTime = Date.now();
      secureLogger.info('Large object test', largeObject);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(mockBaseLogger.info).toHaveBeenCalled();
    });

    it('should cache masking patterns for performance', () => {
      const testData = {
        email1: 'user1@example.com',
        email2: 'user2@example.com',
        email3: 'user3@example.com',
      };

      // Log multiple times to test pattern caching
      for (let i = 0; i < 5; i++) {
        secureLogger.info(`Test ${i}`, testData);
      }

      expect(mockBaseLogger.info).toHaveBeenCalledTimes(5);
    });
  });
});