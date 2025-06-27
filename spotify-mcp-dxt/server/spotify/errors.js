/**
 * Spotify API error classes
 *
 * Provides specific error types for different Spotify API error conditions
 * with detailed error information and retry guidance.
 */
/**
 * Base Spotify error class
 */
export class SpotifyError extends Error {
    details;
    constructor(message, details = {}) {
        super(message);
        this.name = 'SpotifyError';
        const finalDetails = {
            code: 'SPOTIFY_ERROR',
            retryable: false,
            ...details,
        };
        this.details = finalDetails;
        // Ensure proper prototype chain
        Object.setPrototypeOf(this, SpotifyError.prototype);
    }
}
/**
 * Spotify authentication error
 */
export class SpotifyAuthError extends SpotifyError {
    constructor(message, details = {}) {
        const authDetails = {
            code: 'SPOTIFY_AUTH_ERROR',
            requiresAuth: true,
            ...details,
        };
        super(message, authDetails);
        this.name = 'SpotifyAuthError';
        Object.setPrototypeOf(this, SpotifyAuthError.prototype);
    }
}
/**
 * Spotify rate limit error
 */
export class SpotifyRateLimitError extends SpotifyError {
    retryAfter;
    constructor(message, details) {
        const rateLimitDetails = {
            code: 'SPOTIFY_RATE_LIMIT_ERROR',
            retryable: true,
        };
        if (details.endpoint) {
            rateLimitDetails.endpoint = details.endpoint;
        }
        super(message, rateLimitDetails);
        this.name = 'SpotifyRateLimitError';
        this.retryAfter = details.retryAfter;
        Object.setPrototypeOf(this, SpotifyRateLimitError.prototype);
    }
}
/**
 * Spotify API permission error
 */
export class SpotifyPermissionError extends SpotifyError {
    constructor(message, details = {}) {
        const permissionDetails = {
            code: 'SPOTIFY_PERMISSION_ERROR',
            retryable: false,
            ...details,
        };
        super(message, permissionDetails);
        this.name = 'SpotifyPermissionError';
        Object.setPrototypeOf(this, SpotifyPermissionError.prototype);
    }
}
/**
 * Spotify Premium required error
 */
export class SpotifyPremiumRequiredError extends SpotifyError {
    constructor(message = 'Spotify Premium subscription required for this feature') {
        super(message, {
            code: 'SPOTIFY_PREMIUM_REQUIRED',
            retryable: false,
        });
        this.name = 'SpotifyPremiumRequiredError';
        Object.setPrototypeOf(this, SpotifyPremiumRequiredError.prototype);
    }
}
/**
 * Spotify device not found error
 */
export class SpotifyDeviceError extends SpotifyError {
    constructor(message, details = {}) {
        const deviceDetails = {
            code: 'SPOTIFY_DEVICE_ERROR',
            retryable: false,
            ...details,
        };
        super(message, deviceDetails);
        this.name = 'SpotifyDeviceError';
        Object.setPrototypeOf(this, SpotifyDeviceError.prototype);
    }
}
/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeErrorMessage(message, status) {
    // Remove sensitive patterns that could leak information
    const sensitivePatterns = [
        /client_id/gi,
        /client_secret/gi,
        /access_token/gi,
        /refresh_token/gi,
        /authorization/gi,
        /bearer/gi,
        /oauth/gi,
        // Remove specific API endpoints
        /api\.spotify\.com/gi,
        // Remove user IDs or sensitive identifiers
        /user:[a-zA-Z0-9_-]+/gi,
        // Remove IP addresses
        /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    ];
    let sanitized = message;
    for (const pattern of sensitivePatterns) {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    // Provide user-friendly fallback messages
    if (sanitized.length < 10 || sanitized.includes('[REDACTED]')) {
        switch (status) {
            case 400:
                return 'Invalid request parameters';
            case 401:
                return 'Authentication required or invalid credentials';
            case 403:
                return 'Access forbidden - check permissions or Spotify Premium status';
            case 404:
                return 'Resource not found';
            case 429:
                return 'Rate limit exceeded - please try again later';
            case 500:
            case 502:
            case 503:
                return 'Spotify service temporarily unavailable';
            default:
                return `Request failed with status ${status}`;
        }
    }
    return sanitized;
}
/**
 * Map Spotify API error response to appropriate error class
 */
export function mapSpotifyError(status, data, endpoint) {
    const errorData = data.error || {};
    const rawMessage = errorData.message || `Spotify API error: ${status}`;
    const message = sanitizeErrorMessage(rawMessage, status);
    const reason = errorData.reason;
    // Sanitize the spotify error data to prevent information leakage
    const sanitizedData = {
        error: {
            status,
            message: reason || 'API error', // Use reason instead of potentially sensitive message
        }
    };
    const baseDetails = {
        status,
        spotifyError: sanitizedData,
    };
    if (endpoint) {
        baseDetails.endpoint = endpoint;
    }
    // Authentication errors
    if (status === 401) {
        const authDetails = {
            ...baseDetails,
            requiresAuth: true,
        };
        return new SpotifyAuthError(message, authDetails);
    }
    // Permission errors
    if (status === 403) {
        if (reason === 'PREMIUM_REQUIRED') {
            return new SpotifyPremiumRequiredError();
        }
        return new SpotifyPermissionError(message, baseDetails);
    }
    // Not found errors (could be device-related)
    if (status === 404) {
        if (endpoint?.includes('/player') || reason === 'NO_ACTIVE_DEVICE') {
            return new SpotifyDeviceError('No active Spotify device found. Please start Spotify on a device.', baseDetails);
        }
        return new SpotifyError(message, baseDetails);
    }
    // Rate limiting
    if (status === 429) {
        const retryAfter = parseInt(data['retry-after'] || '30');
        const rateLimitDetails = {
            retryAfter,
        };
        if (endpoint) {
            rateLimitDetails.endpoint = endpoint;
        }
        return new SpotifyRateLimitError(message, rateLimitDetails);
    }
    // Server errors (retryable)
    if (status >= 500) {
        return new SpotifyError(message, {
            ...baseDetails,
            retryable: true,
        });
    }
    // Other client errors
    return new SpotifyError(message, baseDetails);
}
/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
    if (error instanceof SpotifyError) {
        return error.details.retryable;
    }
    // Network errors are generally retryable
    if (error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')) {
        return true;
    }
    return false;
}
/**
 * Get retry delay for error
 */
export function getRetryDelay(error, attempt) {
    if (error instanceof SpotifyRateLimitError) {
        return error.retryAfter * 1000; // Convert to milliseconds
    }
    // Exponential backoff for other retryable errors
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
}
//# sourceMappingURL=errors.js.map