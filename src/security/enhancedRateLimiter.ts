/**
 * Enhanced Rate Limiter with Per-User Tracking and Abuse Protection
 * 
 * Provides multi-tier rate limiting with user-specific tracking,
 * abuse detection, and circuit breaker patterns for security.
 */

import type { Logger } from '../types/index.js';

export interface RateLimitConfig {
  // Per-user rate limits
  userLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  
  // Per-tool rate limits
  toolLimits: Record<string, {
    requestsPerMinute: number;
    cooldownMs?: number;
  }>;
  
  // Global rate limits
  globalLimits: {
    requestsPerMinute: number;
    concurrentRequests: number;
  };
  
  // Abuse protection
  abuseProtection: {
    enabled: boolean;
    maxFailuresPerMinute: number;
    blockDurationMs: number;
    enableCircuitBreaker: boolean;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
  limits: {
    remaining: number;
    resetTime: number;
  };
}

export interface UserRateLimitStats {
  userId: string;
  requestsLastMinute: number;
  requestsLastHour: number;
  requestsLastDay: number;
  failuresLastMinute: number;
  isBlocked: boolean;
  blockExpiresAt?: Date;
  totalRequests: number;
  firstRequestAt: Date;
  lastRequestAt: Date;
}

interface RequestRecord {
  timestamp: number;
  success: boolean;
  toolName?: string;
  userId?: string;
}

interface UserLimitTracker {
  requests: RequestRecord[];
  failures: RequestRecord[];
  isBlocked: boolean;
  blockExpiresAt?: number;
  totalRequests: number;
  firstRequestAt: number;
  lastRequestAt: number;
}

/**
 * Enhanced rate limiter with comprehensive tracking and protection
 */
export class EnhancedRateLimiter {
  private readonly logger: Logger;
  private readonly config: RateLimitConfig;
  private readonly userTrackers: Map<string, UserLimitTracker> = new Map();
  private readonly globalRequests: RequestRecord[] = [];
  private readonly toolRequests: Map<string, RequestRecord[]> = new Map();
  private currentConcurrentRequests = 0;
  private circuitBreakerOpen = false;
  private circuitBreakerOpenUntil = 0;

  constructor(config: RateLimitConfig, logger: Logger) {
    this.logger = logger;
    this.config = config;

    // Start cleanup timer
    this.startCleanupTimer();

    this.logger.info('Enhanced rate limiter initialized', {
      userLimits: config.userLimits,
      toolCount: Object.keys(config.toolLimits).length,
      globalLimits: config.globalLimits,
      abuseProtection: config.abuseProtection.enabled,
    });
  }

  /**
   * Check if request is allowed based on all rate limiting rules
   */
  async checkRateLimit(
    userId: string,
    toolName?: string,
    _clientId?: string
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(now)) {
      return {
        allowed: false,
        reason: 'Service temporarily unavailable due to high error rate',
        retryAfter: Math.ceil((this.circuitBreakerOpenUntil - now) / 1000),
        limits: { remaining: 0, resetTime: this.circuitBreakerOpenUntil },
      };
    }

    // Check if user is blocked for abuse
    const userTracker = this.getUserTracker(userId);
    if (userTracker.isBlocked && userTracker.blockExpiresAt && userTracker.blockExpiresAt > now) {
      return {
        allowed: false,
        reason: 'User temporarily blocked due to abuse detection',
        retryAfter: Math.ceil((userTracker.blockExpiresAt - now) / 1000),
        limits: { remaining: 0, resetTime: userTracker.blockExpiresAt },
      };
    } else if (userTracker.isBlocked && userTracker.blockExpiresAt && userTracker.blockExpiresAt <= now) {
      // Unblock user
      userTracker.isBlocked = false;
      delete userTracker.blockExpiresAt;
      this.logger.info('User unblocked after abuse timeout', { userId: this.maskUserId(userId) });
    }

    // Check global concurrent requests
    if (this.currentConcurrentRequests >= this.config.globalLimits.concurrentRequests) {
      return {
        allowed: false,
        reason: 'Too many concurrent requests',
        limits: { remaining: 0, resetTime: now + 1000 },
      };
    }

    // Check global rate limits
    const globalCheck = this.checkGlobalLimits(now);
    if (!globalCheck.allowed) {
      return globalCheck;
    }

    // Check user-specific rate limits
    const userCheck = this.checkUserLimits(userId, now);
    if (!userCheck.allowed) {
      return userCheck;
    }

    // Check tool-specific rate limits
    if (toolName) {
      const toolCheck = this.checkToolLimits(toolName, now);
      if (!toolCheck.allowed) {
        return toolCheck;
      }
    }

    return {
      allowed: true,
      limits: {
        remaining: this.calculateRemainingRequests(userId, toolName),
        resetTime: this.getNextResetTime(),
      },
    };
  }

  /**
   * Record a request (success or failure)
   */
  recordRequest(
    userId: string,
    success: boolean,
    toolName?: string,
    clientId?: string
  ): void {
    const now = Date.now();
    
    const record: RequestRecord = {
      timestamp: now,
      success,
      ...(toolName && { toolName }),
      ...(userId && { userId }),
    };

    // Update concurrent request counter
    if (success) {
      this.currentConcurrentRequests++;
    }

    // Record globally
    this.globalRequests.push(record);

    // Record for user
    const userTracker = this.getUserTracker(userId);
    userTracker.requests.push(record);
    userTracker.totalRequests++;
    userTracker.lastRequestAt = now;

    if (!success) {
      userTracker.failures.push(record);
      
      // Check for abuse
      if (this.config.abuseProtection.enabled) {
        this.checkForAbuse(userId, userTracker);
      }
    }

    // Record for tool
    if (toolName) {
      if (!this.toolRequests.has(toolName)) {
        this.toolRequests.set(toolName, []);
      }
      const toolRequestList = this.toolRequests.get(toolName);
      if (toolRequestList) {
        toolRequestList.push(record);
      }
    }

    // Update circuit breaker
    if (this.config.abuseProtection.enableCircuitBreaker) {
      this.updateCircuitBreaker();
    }

    this.logger.debug('Request recorded', {
      userId: this.maskUserId(userId),
      success,
      toolName,
      clientId: clientId ? this.maskClientId(clientId) : undefined,
      totalRequests: userTracker.totalRequests,
    });
  }

  /**
   * Complete a request (decrement concurrent counter)
   */
  completeRequest(): void {
    if (this.currentConcurrentRequests > 0) {
      this.currentConcurrentRequests--;
    }
  }

  /**
   * Get rate limit statistics for a user
   */
  getUserStats(userId: string): UserRateLimitStats {
    const tracker = this.getUserTracker(userId);
    const now = Date.now();
    
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    return {
      userId,
      requestsLastMinute: tracker.requests.filter(r => r.timestamp > oneMinuteAgo).length,
      requestsLastHour: tracker.requests.filter(r => r.timestamp > oneHourAgo).length,
      requestsLastDay: tracker.requests.filter(r => r.timestamp > oneDayAgo).length,
      failuresLastMinute: tracker.failures.filter(r => r.timestamp > oneMinuteAgo).length,
      isBlocked: tracker.isBlocked,
      ...(tracker.blockExpiresAt && { blockExpiresAt: new Date(tracker.blockExpiresAt) }),
      totalRequests: tracker.totalRequests,
      firstRequestAt: new Date(tracker.firstRequestAt),
      lastRequestAt: new Date(tracker.lastRequestAt),
    };
  }

  /**
   * Get global rate limiting statistics
   */
  getGlobalStats(): {
    activeUsers: number;
    totalRequests: number;
    currentConcurrentRequests: number;
    requestsLastMinute: number;
    requestsLastHour: number;
    circuitBreakerOpen: boolean;
    blockedUsers: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    return {
      activeUsers: this.userTrackers.size,
      totalRequests: this.globalRequests.length,
      currentConcurrentRequests: this.currentConcurrentRequests,
      requestsLastMinute: this.globalRequests.filter(r => r.timestamp > oneMinuteAgo).length,
      requestsLastHour: this.globalRequests.filter(r => r.timestamp > oneHourAgo).length,
      circuitBreakerOpen: this.circuitBreakerOpen,
      blockedUsers: Array.from(this.userTrackers.values()).filter(t => t.isBlocked).length,
    };
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  resetUserLimits(userId: string): void {
    const tracker = this.userTrackers.get(userId);
    if (tracker) {
      tracker.requests = [];
      tracker.failures = [];
      tracker.isBlocked = false;
      delete tracker.blockExpiresAt;
      
      this.logger.info('User rate limits reset', { userId: this.maskUserId(userId) });
    }
  }

  /**
   * Block a user manually (admin function)
   */
  blockUser(userId: string, durationMs: number, reason: string): void {
    const tracker = this.getUserTracker(userId);
    tracker.isBlocked = true;
    tracker.blockExpiresAt = Date.now() + durationMs;
    
    this.logger.warn('User manually blocked', {
      userId: this.maskUserId(userId),
      durationMs,
      reason,
      expiresAt: new Date(tracker.blockExpiresAt).toISOString(),
    });
  }

  // Private methods

  private getUserTracker(userId: string): UserLimitTracker {
    if (!this.userTrackers.has(userId)) {
      const now = Date.now();
      this.userTrackers.set(userId, {
        requests: [],
        failures: [],
        isBlocked: false,
        totalRequests: 0,
        firstRequestAt: now,
        lastRequestAt: now,
      });
    }
    const tracker = this.userTrackers.get(userId);
    if (!tracker) {
      throw new Error(`User tracker not found for ${userId}`);
    }
    return tracker;
  }

  private checkGlobalLimits(now: number): RateLimitResult {
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.globalRequests.filter(r => r.timestamp > oneMinuteAgo);
    
    if (recentRequests.length >= this.config.globalLimits.requestsPerMinute) {
      return {
        allowed: false,
        reason: 'Global rate limit exceeded',
        retryAfter: 60,
        limits: {
          remaining: 0,
          resetTime: oneMinuteAgo + 60000,
        },
      };
    }

    return { allowed: true, limits: { remaining: 1, resetTime: now + 60000 } };
  }

  private checkUserLimits(userId: string, now: number): RateLimitResult {
    const tracker = this.getUserTracker(userId);
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const requestsLastMinute = tracker.requests.filter(r => r.timestamp > oneMinuteAgo).length;
    const requestsLastHour = tracker.requests.filter(r => r.timestamp > oneHourAgo).length;
    const requestsLastDay = tracker.requests.filter(r => r.timestamp > oneDayAgo).length;

    // Check minute limit
    if (requestsLastMinute >= this.config.userLimits.requestsPerMinute) {
      return {
        allowed: false,
        reason: 'User per-minute rate limit exceeded',
        retryAfter: 60,
        limits: {
          remaining: 0,
          resetTime: oneMinuteAgo + 60000,
        },
      };
    }

    // Check hour limit
    if (requestsLastHour >= this.config.userLimits.requestsPerHour) {
      return {
        allowed: false,
        reason: 'User per-hour rate limit exceeded',
        retryAfter: 3600,
        limits: {
          remaining: 0,
          resetTime: oneHourAgo + 3600000,
        },
      };
    }

    // Check day limit
    if (requestsLastDay >= this.config.userLimits.requestsPerDay) {
      return {
        allowed: false,
        reason: 'User per-day rate limit exceeded',
        retryAfter: 86400,
        limits: {
          remaining: 0,
          resetTime: oneDayAgo + 86400000,
        },
      };
    }

    return {
      allowed: true,
      limits: {
        remaining: Math.min(
          this.config.userLimits.requestsPerMinute - requestsLastMinute,
          this.config.userLimits.requestsPerHour - requestsLastHour,
          this.config.userLimits.requestsPerDay - requestsLastDay
        ),
        resetTime: oneMinuteAgo + 60000,
      },
    };
  }

  private checkToolLimits(toolName: string, now: number): RateLimitResult {
    const toolConfig = this.config.toolLimits[toolName];
    if (!toolConfig) {
      return { allowed: true, limits: { remaining: 1, resetTime: now + 60000 } };
    }

    const toolRequests = this.toolRequests.get(toolName) || [];
    const oneMinuteAgo = now - 60000;
    const recentRequests = toolRequests.filter(r => r.timestamp > oneMinuteAgo);

    if (recentRequests.length >= toolConfig.requestsPerMinute) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' rate limit exceeded`,
        retryAfter: toolConfig.cooldownMs ? Math.ceil(toolConfig.cooldownMs / 1000) : 60,
        limits: {
          remaining: 0,
          resetTime: oneMinuteAgo + 60000,
        },
      };
    }

    return {
      allowed: true,
      limits: {
        remaining: toolConfig.requestsPerMinute - recentRequests.length,
        resetTime: oneMinuteAgo + 60000,
      },
    };
  }

  private checkForAbuse(userId: string, tracker: UserLimitTracker): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentFailures = tracker.failures.filter(r => r.timestamp > oneMinuteAgo);

    if (recentFailures.length >= this.config.abuseProtection.maxFailuresPerMinute) {
      tracker.isBlocked = true;
      tracker.blockExpiresAt = now + this.config.abuseProtection.blockDurationMs;

      this.logger.warn('User blocked for abuse', {
        userId: this.maskUserId(userId),
        failuresInLastMinute: recentFailures.length,
        blockDurationMs: this.config.abuseProtection.blockDurationMs,
        expiresAt: new Date(tracker.blockExpiresAt).toISOString(),
      });
    }
  }

  private isCircuitBreakerOpen(now: number): boolean {
    return this.circuitBreakerOpen && now < this.circuitBreakerOpenUntil;
  }

  private updateCircuitBreaker(): void {
    if (!this.config.abuseProtection.enableCircuitBreaker) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.globalRequests.filter(r => r.timestamp > oneMinuteAgo);
    const recentFailures = recentRequests.filter(r => !r.success);
    
    const failureRate = recentRequests.length > 0 ? recentFailures.length / recentRequests.length : 0;

    // Open circuit breaker if failure rate > 50% and we have significant traffic
    if (failureRate > 0.5 && recentRequests.length >= 10) {
      if (!this.circuitBreakerOpen) {
        this.circuitBreakerOpen = true;
        this.circuitBreakerOpenUntil = now + 30000; // 30 seconds
        
        this.logger.error('Circuit breaker opened due to high failure rate', {
          failureRate,
          recentRequests: recentRequests.length,
          recentFailures: recentFailures.length,
        });
      }
    } else if (this.circuitBreakerOpen && now >= this.circuitBreakerOpenUntil) {
      this.circuitBreakerOpen = false;
      this.circuitBreakerOpenUntil = 0;
      
      this.logger.info('Circuit breaker closed - service recovered');
    }
  }

  private calculateRemainingRequests(userId: string, toolName?: string): number {
    const userStats = this.getUserStats(userId);
    
    let remaining = Math.min(
      this.config.userLimits.requestsPerMinute - userStats.requestsLastMinute,
      this.config.userLimits.requestsPerHour - userStats.requestsLastHour,
      this.config.userLimits.requestsPerDay - userStats.requestsLastDay
    );

    if (toolName && this.config.toolLimits[toolName]) {
      const toolRequests = this.toolRequests.get(toolName) || [];
      const oneMinuteAgo = Date.now() - 60000;
      const recentToolRequests = toolRequests.filter(r => r.timestamp > oneMinuteAgo);
      const toolRemaining = this.config.toolLimits[toolName].requestsPerMinute - recentToolRequests.length;
      
      remaining = Math.min(remaining, toolRemaining);
    }

    return Math.max(0, remaining);
  }

  private getNextResetTime(): number {
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    return nextMinute;
  }

  private startCleanupTimer(): void {
    // Clean up old records every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const oneDayAgo = now - 86400000;

      // Clean global requests (keep last hour)
      this.globalRequests.splice(0, this.globalRequests.findIndex(r => r.timestamp > oneHourAgo));

      // Clean user trackers
      for (const [userId, tracker] of this.userTrackers.entries()) {
        // Keep last day for user requests
        tracker.requests = tracker.requests.filter(r => r.timestamp > oneDayAgo);
        tracker.failures = tracker.failures.filter(r => r.timestamp > oneHourAgo);

        // Remove inactive users (no requests in 24 hours)
        if (tracker.lastRequestAt < oneDayAgo && !tracker.isBlocked) {
          this.userTrackers.delete(userId);
        }
      }

      // Clean tool requests (keep last hour)
      for (const [toolName, requests] of this.toolRequests.entries()) {
        const filteredRequests = requests.filter(r => r.timestamp > oneHourAgo);
        if (filteredRequests.length > 0) {
          this.toolRequests.set(toolName, filteredRequests);
        } else {
          this.toolRequests.delete(toolName);
        }
      }

      this.logger.debug('Rate limiter cleanup completed', {
        activeUsers: this.userTrackers.size,
        globalRequests: this.globalRequests.length,
        toolTrackers: this.toolRequests.size,
      });
    }, 300000); // 5 minutes
  }

  /**
   * Mask user ID for privacy in logs (show only first/last 3 chars)
   */
  private maskUserId(userId: string): string {
    if (userId.length <= 6) {
      return '*'.repeat(userId.length);
    }
    return `${userId.substring(0, 3)}***${userId.substring(userId.length - 3)}`;
  }

  /**
   * Mask client ID for privacy in logs (show only first 4 chars)
   */
  private maskClientId(clientId: string): string {
    if (clientId.length <= 8) {
      return '*'.repeat(clientId.length);
    }
    return `${clientId.substring(0, 4)}***`;
  }
}

/**
 * Factory function to create enhanced rate limiter
 */
export function createEnhancedRateLimiter(
  config: RateLimitConfig,
  logger: Logger
): EnhancedRateLimiter {
  return new EnhancedRateLimiter(config, logger);
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  userLimits: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
  },
  toolLimits: {
    'search': { requestsPerMinute: 30 },
    'play': { requestsPerMinute: 10, cooldownMs: 1000 },
    'pause': { requestsPerMinute: 10, cooldownMs: 1000 },
    'skip_next': { requestsPerMinute: 20, cooldownMs: 500 },
    'skip_previous': { requestsPerMinute: 20, cooldownMs: 500 },
    'set_volume': { requestsPerMinute: 10, cooldownMs: 2000 },
    'authenticate': { requestsPerMinute: 5, cooldownMs: 10000 },
  },
  globalLimits: {
    requestsPerMinute: 500,
    concurrentRequests: 50,
  },
  abuseProtection: {
    enabled: true,
    maxFailuresPerMinute: 10,
    blockDurationMs: 300000, // 5 minutes
    enableCircuitBreaker: true,
  },
};