/**
 * Spotify integration module exports
 *
 * Provides Spotify Web API client with rate limiting, error handling,
 * and automatic retry logic for the MCP server.
 */
export { SpotifyClient } from './client.js';
export { RateLimiter } from './rateLimiter.js';
export { SpotifyError, SpotifyAuthError, SpotifyRateLimitError, SpotifyPermissionError, SpotifyPremiumRequiredError, SpotifyDeviceError, mapSpotifyError, isRetryableError, getRetryDelay, } from './errors.js';
//# sourceMappingURL=index.js.map