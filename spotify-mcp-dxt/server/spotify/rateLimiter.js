/**
 * Rate limiter for Spotify API requests
 *
 * Implements token bucket algorithm with endpoint-specific limits
 * and automatic adjustment based on API response headers.
 */
export class RateLimiter {
    logger;
    buckets;
    defaultBucketSize = 180; // Spotify's default rate limit
    defaultRefillRate = 180; // Tokens per 30 seconds
    refillInterval = 30000; // 30 seconds in milliseconds
    constructor(logger) {
        this.logger = logger;
        this.buckets = new Map();
        // Start refill timer
        this.startRefillTimer();
    }
    /**
     * Check if request can proceed based on rate limits
     */
    async checkRateLimit(endpoint) {
        const bucket = this.getBucket(endpoint);
        if (bucket.tokens <= 0) {
            const waitTime = this.getWaitTime(bucket);
            this.logger.warn('Rate limit reached, waiting', {
                endpoint,
                waitTime,
                tokens: bucket.tokens,
                lastRefill: bucket.lastRefill,
            });
            // Wait until tokens are available
            await this.delay(waitTime);
            // Refill tokens after wait
            this.refillBucket(bucket);
        }
        // Consume a token
        bucket.tokens--;
        this.logger.debug('Rate limit check passed', {
            endpoint,
            remainingTokens: bucket.tokens,
        });
    }
    /**
     * Update rate limit info from response headers
     */
    updateFromHeaders(endpoint, headers) {
        const bucket = this.getBucket(endpoint);
        // Parse rate limit headers if available
        const limit = parseInt(headers['x-ratelimit-limit'] || '');
        const remaining = parseInt(headers['x-ratelimit-remaining'] || '');
        const reset = parseInt(headers['x-ratelimit-reset'] || '');
        if (!isNaN(limit)) {
            bucket.size = limit;
        }
        if (!isNaN(remaining)) {
            bucket.tokens = remaining;
        }
        if (!isNaN(reset)) {
            bucket.resetTime = reset * 1000; // Convert to milliseconds
        }
        this.logger.debug('Updated rate limit from headers', {
            endpoint,
            limit,
            remaining,
            reset: reset ? new Date(reset * 1000).toISOString() : undefined,
        });
    }
    /**
     * Get or create token bucket for endpoint
     */
    getBucket(endpoint) {
        // Normalize endpoint (remove query params and IDs)
        const normalizedEndpoint = this.normalizeEndpoint(endpoint);
        let bucket = this.buckets.get(normalizedEndpoint);
        if (!bucket) {
            bucket = {
                tokens: this.defaultBucketSize,
                size: this.defaultBucketSize,
                lastRefill: Date.now(),
                resetTime: null,
            };
            this.buckets.set(normalizedEndpoint, bucket);
            this.logger.debug('Created new token bucket', {
                endpoint: normalizedEndpoint,
                tokens: bucket.tokens,
            });
        }
        return bucket;
    }
    /**
     * Normalize endpoint for rate limiting
     */
    normalizeEndpoint(endpoint) {
        // Remove query parameters
        const baseEndpoint = endpoint.split('?')[0];
        if (!baseEndpoint) {
            return endpoint;
        }
        // Replace IDs with placeholders
        return baseEndpoint
            .replace(/\/[a-zA-Z0-9]{22}/g, '/{id}') // Spotify IDs are 22 chars
            .replace(/\/\d+/g, '/{number}'); // Numeric IDs
    }
    /**
     * Calculate wait time until tokens are available
     */
    getWaitTime(bucket) {
        if (bucket.resetTime && bucket.resetTime > Date.now()) {
            // Use explicit reset time if available
            return bucket.resetTime - Date.now();
        }
        // Calculate based on refill rate
        const timeSinceRefill = Date.now() - bucket.lastRefill;
        const timeUntilRefill = Math.max(0, this.refillInterval - timeSinceRefill);
        return timeUntilRefill;
    }
    /**
     * Refill tokens in bucket
     */
    refillBucket(bucket) {
        const now = Date.now();
        const timeSinceRefill = now - bucket.lastRefill;
        if (timeSinceRefill >= this.refillInterval) {
            // Full refill
            bucket.tokens = bucket.size;
            bucket.lastRefill = now;
            bucket.resetTime = null;
            this.logger.debug('Refilled token bucket', {
                tokens: bucket.tokens,
                size: bucket.size,
            });
        }
    }
    /**
     * Start periodic refill timer
     */
    startRefillTimer() {
        setInterval(() => {
            for (const [endpoint, bucket] of this.buckets) {
                this.refillBucket(bucket);
                // Clean up unused buckets
                if (bucket.tokens === bucket.size &&
                    Date.now() - bucket.lastRefill > this.refillInterval * 2) {
                    this.buckets.delete(endpoint);
                    this.logger.debug('Removed inactive bucket', { endpoint });
                }
            }
        }, this.refillInterval);
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get rate limiter statistics
     */
    getStats() {
        const stats = {
            totalBuckets: this.buckets.size,
            buckets: {},
        };
        for (const [endpoint, bucket] of this.buckets) {
            stats.buckets[endpoint] = {
                tokens: bucket.tokens,
                size: bucket.size,
                lastRefill: new Date(bucket.lastRefill).toISOString(),
                resetTime: bucket.resetTime ? new Date(bucket.resetTime).toISOString() : null,
            };
        }
        return stats;
    }
}
//# sourceMappingURL=rateLimiter.js.map