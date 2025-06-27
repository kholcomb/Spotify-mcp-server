/**
 * Spotify API error classes
 *
 * Provides specific error types for different Spotify API error conditions
 * with detailed error information and retry guidance.
 */
/**
 * Base Spotify error class
 */
export declare class SpotifyError extends Error {
    readonly details: SpotifyErrorDetails;
    constructor(message: string, details?: Partial<SpotifyErrorDetails>);
}
/**
 * Spotify authentication error
 */
export declare class SpotifyAuthError extends SpotifyError {
    constructor(message: string, details?: Partial<SpotifyAuthErrorDetails>);
}
/**
 * Spotify rate limit error
 */
export declare class SpotifyRateLimitError extends SpotifyError {
    readonly retryAfter: number;
    constructor(message: string, details: SpotifyRateLimitErrorDetails);
}
/**
 * Spotify API permission error
 */
export declare class SpotifyPermissionError extends SpotifyError {
    constructor(message: string, details?: Partial<SpotifyPermissionErrorDetails>);
}
/**
 * Spotify Premium required error
 */
export declare class SpotifyPremiumRequiredError extends SpotifyError {
    constructor(message?: string);
}
/**
 * Spotify device not found error
 */
export declare class SpotifyDeviceError extends SpotifyError {
    constructor(message: string, details?: Partial<SpotifyDeviceErrorDetails>);
}
/**
 * Base error details interface
 */
export interface SpotifyErrorDetails {
    code: string;
    retryable: boolean;
    status?: number;
    endpoint?: string;
    spotifyError?: unknown;
    originalError?: Error;
}
/**
 * Authentication error details
 */
export interface SpotifyAuthErrorDetails extends SpotifyErrorDetails {
    requiresAuth: boolean;
}
/**
 * Rate limit error details
 */
export interface SpotifyRateLimitErrorDetails {
    retryAfter: number;
    endpoint?: string;
}
/**
 * Permission error details
 */
export interface SpotifyPermissionErrorDetails extends SpotifyErrorDetails {
    requiredScope?: string;
    currentScopes?: string[];
}
/**
 * Device error details
 */
export interface SpotifyDeviceErrorDetails extends SpotifyErrorDetails {
    deviceId?: string;
    availableDevices?: string[];
}
/**
 * Map Spotify API error response to appropriate error class
 */
export declare function mapSpotifyError(status: number, data: Record<string, unknown>, endpoint?: string): SpotifyError;
/**
 * Check if error is retryable
 */
export declare function isRetryableError(error: Error): boolean;
/**
 * Get retry delay for error
 */
export declare function getRetryDelay(error: Error, attempt: number): number;
//# sourceMappingURL=errors.d.ts.map