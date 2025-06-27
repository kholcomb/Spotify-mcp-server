/**
 * Comprehensive tests for EnhancedRateLimiter security component
 * Tests multi-tier rate limiting, abuse protection, circuit breaker, and PII masking
 */

import { jest } from '@jest/globals';
import { EnhancedRateLimiter, type RateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG } from '../../../src/security/enhancedRateLimiter.js';
import type { Logger } from '../../../src/types/index.js';

describe('EnhancedRateLimiter', () => {
  let rateLimiter: EnhancedRateLimiter;
  let mockLogger: Logger;
  let originalDateNow: typeof Date.now;

  const testConfig: RateLimitConfig = {
    userLimits: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 1000,
    },
    toolLimits: {
      'search': { requestsPerMinute: 5 },
      'play': { requestsPerMinute: 3, cooldownMs: 1000 },
      'pause': { requestsPerMinute: 3, cooldownMs: 1000 },
    },
    globalLimits: {
      requestsPerMinute: 50,
      concurrentRequests: 10,
    },
    abuseProtection: {
      enabled: true,
      maxFailuresPerMinute: 5,
      blockDurationMs: 300000, // 5 minutes
      enableCircuitBreaker: true,
    },
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    originalDateNow = Date.now;
    rateLimiter = new EnhancedRateLimiter(testConfig, mockLogger);
  });

  afterEach(() => {
    Date.now = originalDateNow;
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with provided configuration', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Enhanced rate limiter initialized',
        expect.objectContaining({
          userLimits: testConfig.userLimits,
          globalLimits: testConfig.globalLimits,
          abuseProtection: true,
        })
      );
    });

    it('should use default configuration when not provided', () => {
      const _defaultLimiter = new EnhancedRateLimiter(DEFAULT_RATE_LIMIT_CONFIG, mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Enhanced rate limiter initialized',
        expect.objectContaining({
          userLimits: DEFAULT_RATE_LIMIT_CONFIG.userLimits,
        })
      );
    });
  });

  describe('User Rate Limiting', () => {
    it('should allow requests within user limits', async () => {
      const userId = 'test-user-1';
      
      // Make requests within the limit
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkRateLimit(userId);
        expect(result.allowed).toBe(true);
        expect(result.limits.remaining).toBeGreaterThan(0);
        
        rateLimiter.recordRequest(userId, true);
        rateLimiter.completeRequest();
      }
    });

    it('should block requests exceeding per-minute user limit', async () => {
      const userId = 'test-user-2';
      
      // Exceed the per-minute limit (10 requests)
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, true);
        rateLimiter.completeRequest();
      }
      
      const result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User per-minute rate limit exceeded');
      expect(result.retryAfter).toBe(60);
    });

    it('should block requests exceeding per-hour user limit', async () => {
      const userId = 'test-user-3';
      
      // Simulate requests over an hour to exceed hourly limit
      // Use time manipulation to simulate hour progression
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);
      
      // Make 100 requests (hourly limit) in the first minute
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, true);
        rateLimiter.completeRequest();
        currentTime += 500; // 500ms between requests
        Date.now = jest.fn(() => currentTime);
      }
      
      const result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User per-hour rate limit exceeded');
    });

    it('should block requests exceeding per-day user limit', async () => {
      const userId = 'test-user-4';
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);
      
      // Simulate reaching daily limit
      for (let i = 0; i < 1000; i++) {
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, true);
        rateLimiter.completeRequest();
        currentTime += 60; // 1 minute between requests to stay within hourly limits
        Date.now = jest.fn(() => currentTime);
      }
      
      const result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User per-day rate limit exceeded');
    });

    it('should reset limits after time window passes', async () => {
      const userId = 'test-user-5';
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);
      
      // Exceed minute limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, true);
        rateLimiter.completeRequest();
      }
      
      // Should be blocked
      let result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      
      // Advance time by 61 seconds
      currentTime += 61000;
      Date.now = jest.fn(() => currentTime);
      
      // Should be allowed again
      result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Tool-Specific Rate Limiting', () => {
    it('should enforce tool-specific limits', async () => {
      const userId = 'test-user-tool';
      const toolName = 'search';
      
      // Exceed search tool limit (5 requests per minute)
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.checkRateLimit(userId, toolName);
        expect(result.allowed).toBe(true);
        rateLimiter.recordRequest(userId, true, toolName);
        rateLimiter.completeRequest();
      }
      
      const result = await rateLimiter.checkRateLimit(userId, toolName);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Tool 'search' rate limit exceeded");
    });

    it('should handle tools with cooldown periods', async () => {
      const userId = 'test-user-cooldown';
      const toolName = 'play';
      
      // Exceed play tool limit (3 requests per minute with 1s cooldown)
      for (let i = 0; i < 3; i++) {
        await rateLimiter.checkRateLimit(userId, toolName);
        rateLimiter.recordRequest(userId, true, toolName);
        rateLimiter.completeRequest();
      }
      
      const result = await rateLimiter.checkRateLimit(userId, toolName);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(1); // 1 second cooldown
    });

    it('should allow requests for unregistered tools', async () => {
      const userId = 'test-user-unknown';
      const toolName = 'unknown-tool';
      
      const result = await rateLimiter.checkRateLimit(userId, toolName);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Global Rate Limiting', () => {
    it('should enforce global request limits', async () => {
      // Exceed global limit by making requests from multiple users
      for (let userNum = 0; userNum < 10; userNum++) {
        for (let req = 0; req < 6; req++) {
          await rateLimiter.checkRateLimit(`user-${userNum}`);
          rateLimiter.recordRequest(`user-${userNum}`, true);
          rateLimiter.completeRequest();
        }
      }
      
      const result = await rateLimiter.checkRateLimit('additional-user');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Global rate limit exceeded');
    });

    it('should enforce concurrent request limits', async () => {
      const userId = 'test-concurrent';
      
      // Start 10 concurrent requests (at the limit)
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.checkRateLimit(userId);
        expect(result.allowed).toBe(true);
        rateLimiter.recordRequest(userId, true);
        // Don't complete the requests yet
      }
      
      // Next request should be blocked due to concurrent limit
      const result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Too many concurrent requests');
      
      // Complete one request
      rateLimiter.completeRequest();
      
      // Now a new request should be allowed
      const newResult = await rateLimiter.checkRateLimit(userId);
      expect(newResult.allowed).toBe(true);
    });
  });

  describe('Abuse Protection', () => {
    it('should detect and block abusive users', async () => {
      const userId = 'abusive-user';
      
      // Generate failures to trigger abuse protection
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, false); // Record as failure
        rateLimiter.completeRequest();
      }
      
      const result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User temporarily blocked due to abuse detection');
      expect(result.retryAfter).toBeGreaterThan(0);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'User blocked for abuse',
        expect.objectContaining({
          userId: expect.stringContaining('***'), // Should be masked
          failuresInLastMinute: 5,
        })
      );
    });

    it('should unblock users after abuse timeout', async () => {
      const userId = 'temporarily-blocked';
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);
      
      // Trigger abuse protection
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, false);
        rateLimiter.completeRequest();
      }
      
      // Should be blocked
      let result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
      
      // Advance time beyond block duration (5 minutes + 1 second)
      currentTime += 301000;
      Date.now = jest.fn(() => currentTime);
      
      // Should be unblocked
      result = await rateLimiter.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User unblocked after abuse timeout',
        expect.objectContaining({
          userId: expect.stringContaining('***'), // Should be masked
        })
      );
    });

    it('should allow disabling abuse protection', async () => {
      const configWithoutAbuse = {
        ...testConfig,
        abuseProtection: {
          ...testConfig.abuseProtection,
          enabled: false,
        },
      };
      
      const safeLimiter = new EnhancedRateLimiter(configWithoutAbuse, mockLogger);
      const userId = 'test-no-abuse';
      
      // Generate many failures
      for (let i = 0; i < 10; i++) {
        await safeLimiter.checkRateLimit(userId);
        safeLimiter.recordRequest(userId, false);
        safeLimiter.completeRequest();
      }
      
      // Should still be allowed (only rate limited, not blocked for abuse)
      const result = await safeLimiter.checkRateLimit(userId);
      // May be rate limited but not blocked for abuse
      if (!result.allowed) {
        expect(result.reason).not.toBe('User temporarily blocked due to abuse detection');
      }
    });
  });

  describe('Circuit Breaker Protection', () => {
    it('should open circuit breaker on high failure rate', async () => {
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);
      
      // Generate high failure rate (> 50% failures with significant traffic)
      for (let i = 0; i < 15; i++) {
        const userId = `user-${i}`;
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, i < 10); // 10 failures out of 15 requests
        rateLimiter.completeRequest();
      }
      
      const result = await rateLimiter.checkRateLimit('test-user');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Service temporarily unavailable due to high error rate');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Circuit breaker opened due to high failure rate',
        expect.objectContaining({
          failureRate: expect.any(Number),
          recentRequests: expect.any(Number),
          recentFailures: expect.any(Number),
        })
      );
    });

    it('should close circuit breaker after timeout', async () => {
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);
      
      // Trigger circuit breaker
      for (let i = 0; i < 15; i++) {
        const userId = `user-${i}`;
        await rateLimiter.checkRateLimit(userId);
        rateLimiter.recordRequest(userId, i < 10);
        rateLimiter.completeRequest();
      }
      
      // Should be blocked
      let result = await rateLimiter.checkRateLimit('test-user');
      expect(result.allowed).toBe(false);
      
      // Advance time beyond circuit breaker timeout (30 seconds + 1 second)
      currentTime += 31000;
      Date.now = jest.fn(() => currentTime);
      
      // Should be allowed again
      result = await rateLimiter.checkRateLimit('test-user');
      expect(result.allowed).toBe(true);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker closed - service recovered'
      );
    });
  });

  describe('User Statistics and Management', () => {
    it('should provide accurate user statistics', () => {
      const userId = 'stats-user';
      
      // Record some requests
      rateLimiter.recordRequest(userId, true);
      rateLimiter.recordRequest(userId, false);
      rateLimiter.recordRequest(userId, true);
      
      const stats = rateLimiter.getUserStats(userId);
      
      expect(stats.userId).toBe(userId);
      expect(stats.requestsLastMinute).toBe(3);
      expect(stats.totalRequests).toBe(3);
      expect(stats.failuresLastMinute).toBe(1);
      expect(stats.isBlocked).toBe(false);
      expect(stats.firstRequestAt).toBeInstanceOf(Date);
      expect(stats.lastRequestAt).toBeInstanceOf(Date);
    });

    it('should provide global statistics', () => {
      // Record requests from multiple users
      rateLimiter.recordRequest('user1', true);
      rateLimiter.recordRequest('user2', false);
      rateLimiter.recordRequest('user1', true);
      
      const globalStats = rateLimiter.getGlobalStats();
      
      expect(globalStats.activeUsers).toBe(2);
      expect(globalStats.totalRequests).toBeGreaterThan(0);
      expect(globalStats.requestsLastMinute).toBeGreaterThan(0);
      expect(globalStats.circuitBreakerOpen).toBe(false);
      expect(globalStats.blockedUsers).toBe(0);
    });

    it('should reset user limits when requested', () => {
      const userId = 'reset-user';
      
      // Generate some activity
      rateLimiter.recordRequest(userId, false);
      rateLimiter.recordRequest(userId, false);
      
      let stats = rateLimiter.getUserStats(userId);
      expect(stats.failuresLastMinute).toBe(2);
      
      // Reset limits
      rateLimiter.resetUserLimits(userId);
      
      stats = rateLimiter.getUserStats(userId);
      expect(stats.failuresLastMinute).toBe(0);
      expect(stats.isBlocked).toBe(false);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User rate limits reset',
        expect.objectContaining({
          userId: expect.stringContaining('***'), // Should be masked
        })
      );
    });

    it('should allow manual user blocking', () => {
      const userId = 'manual-block-user';
      const blockDuration = 600000; // 10 minutes
      const reason = 'Manual security block';
      
      rateLimiter.blockUser(userId, blockDuration, reason);
      
      const stats = rateLimiter.getUserStats(userId);
      expect(stats.isBlocked).toBe(true);
      expect(stats.blockExpiresAt).toBeInstanceOf(Date);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'User manually blocked',
        expect.objectContaining({
          userId: expect.stringContaining('***'), // Should be masked
          durationMs: blockDuration,
          reason,
        })
      );
    });
  });

  describe('PII Masking and Privacy', () => {
    it('should mask user IDs in logs', () => {
      const userId = 'sensitive-user-id-12345';
      
      rateLimiter.recordRequest(userId, true);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Request recorded',
        expect.objectContaining({
          userId: 'sen***345', // Should be masked
        })
      );
    });

    it('should mask client IDs in logs', () => {
      const userId = 'test-user';
      const clientId = 'client-id-12345';
      
      rateLimiter.recordRequest(userId, true, undefined, clientId);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Request recorded',
        expect.objectContaining({
          clientId: 'clie***', // Should be masked
        })
      );
    });

    it('should handle short IDs in masking', () => {
      const shortUserId = 'abc';
      
      rateLimiter.recordRequest(shortUserId, true);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Request recorded',
        expect.objectContaining({
          userId: '***', // Short IDs should be fully masked
        })
      );
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should clean up old records', async () => {
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);
      
      const userId = 'cleanup-user';
      
      // Record some old requests
      rateLimiter.recordRequest(userId, true);
      rateLimiter.recordRequest(userId, false);
      
      // Advance time by 25 hours (beyond cleanup threshold)
      currentTime += 25 * 60 * 60 * 1000;
      Date.now = jest.fn(() => currentTime);
      
      // Trigger cleanup by making a new request
      rateLimiter.recordRequest(userId, true);
      
      // The cleanup should have occurred automatically
      const stats = rateLimiter.getUserStats(userId);
      expect(stats.requestsLastDay).toBe(1); // Only the recent request should remain
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined user IDs gracefully', async () => {
      const result = await rateLimiter.checkRateLimit('');
      expect(result.allowed).toBeDefined();
    });

    it('should handle requests with all parameters', async () => {
      const result = await rateLimiter.checkRateLimit('user', 'tool', 'client');
      expect(result.allowed).toBe(true);
      
      rateLimiter.recordRequest('user', true, 'tool', 'client');
      rateLimiter.completeRequest();
    });

    it('should calculate remaining requests correctly', async () => {
      const userId = 'remaining-test';
      
      // Make some requests
      for (let i = 0; i < 3; i++) {
        const result = await rateLimiter.checkRateLimit(userId);
        expect(result.limits.remaining).toBe(7 - i); // 10 - 3 - i
        rateLimiter.recordRequest(userId, true);
        rateLimiter.completeRequest();
      }
    });

    it('should handle tools with and without cooldowns', async () => {
      const userId = 'cooldown-test';
      
      // Test tool without cooldown
      let result = await rateLimiter.checkRateLimit(userId, 'search');
      expect(result.allowed).toBe(true);
      
      // Test tool with cooldown
      result = await rateLimiter.checkRateLimit(userId, 'play');
      expect(result.allowed).toBe(true);
    });
  });
});