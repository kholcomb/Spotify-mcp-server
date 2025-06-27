import type { Logger } from '../types/index.js';
/**
 * Rate limiter for Spotify API requests
 *
 * Implements token bucket algorithm with endpoint-specific limits
 * and automatic adjustment based on API response headers.
 */
export declare class RateLimiter {
    private readonly logger;
    private readonly buckets;
    private readonly defaultBucketSize;
    private readonly defaultRefillRate;
    private readonly refillInterval;
    constructor(logger: Logger);
    /**
     * Check if request can proceed based on rate limits
     */
    checkRateLimit(endpoint: string): Promise<void>;
    /**
     * Update rate limit info from response headers
     */
    updateFromHeaders(endpoint: string, headers: Record<string, string>): void;
    /**
     * Get or create token bucket for endpoint
     */
    private getBucket;
    /**
     * Normalize endpoint for rate limiting
     */
    private normalizeEndpoint;
    /**
     * Calculate wait time until tokens are available
     */
    private getWaitTime;
    /**
     * Refill tokens in bucket
     */
    private refillBucket;
    /**
     * Start periodic refill timer
     */
    private startRefillTimer;
    /**
     * Delay helper
     */
    private delay;
    /**
     * Get rate limiter statistics
     */
    getStats(): RateLimiterStats;
}
/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
    totalBuckets: number;
    buckets: Record<string, {
        tokens: number;
        size: number;
        lastRefill: string;
        resetTime: string | null;
    }>;
}
//# sourceMappingURL=rateLimiter.d.ts.map