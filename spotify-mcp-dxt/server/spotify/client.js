import axios from 'axios';
import { RateLimiter } from './rateLimiter.js';
import { SpotifyError, SpotifyRateLimitError, SpotifyAuthError } from './errors.js';
import { createCertificateManager } from '../security/index.js';
/**
 * Spotify Web API client with rate limiting and error handling
 *
 * Implements all Spotify API operations needed for the MCP server
 * with automatic retry logic and error mapping.
 */
export class SpotifyClient {
    axios;
    authService;
    logger;
    rateLimiter;
    certificateManager;
    userId = 'default';
    static BASE_URL = 'https://api.spotify.com/v1';
    static DEFAULT_TIMEOUT = 10000; // 10 seconds
    static MAX_RETRIES = 3;
    static RETRY_DELAY = 1000; // 1 second base delay
    constructor(authService, logger) {
        this.authService = authService;
        this.logger = logger;
        this.rateLimiter = new RateLimiter(logger);
        // Initialize certificate manager for enhanced HTTPS security
        this.certificateManager = createCertificateManager({
            enabled: false, // Temporarily disable certificate pinning due to TLS compatibility
            strictMode: false,
            allowDevelopment: true,
        }, logger);
        // Create axios instance with basic security
        this.axios = axios.create({
            baseURL: SpotifyClient.BASE_URL,
            timeout: SpotifyClient.DEFAULT_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
            },
            // Use default HTTPS agent without certificate pinning for now
            // httpsAgent: this.certificateManager.createSecureAgent(),
        });
        // Set up request/response interceptors
        this.setupInterceptors();
    }
    /**
     * Set the user ID for authentication
     */
    setUserId(userId) {
        this.userId = userId;
    }
    /**
     * Get current playback state
     */
    async getCurrentPlayback(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/player',
            params: options,
        });
        return response;
    }
    /**
     * Start or resume playback
     */
    async startPlayback(options) {
        const data = {};
        if (options?.contextUri) {
            data.context_uri = options.contextUri;
        }
        if (options?.uris) {
            data.uris = options.uris;
        }
        if (options?.offset !== undefined) {
            data.offset = options.offset;
        }
        if (options?.positionMs !== undefined) {
            data.position_ms = options.positionMs;
        }
        await this.request({
            method: 'PUT',
            url: '/me/player/play',
            params: options?.deviceId ? { device_id: options.deviceId } : undefined,
            data: Object.keys(data).length > 0 ? data : undefined,
        });
    }
    /**
     * Pause playback
     */
    async pausePlayback(deviceId) {
        await this.request({
            method: 'PUT',
            url: '/me/player/pause',
            params: deviceId ? { device_id: deviceId } : undefined,
        });
    }
    /**
     * Skip to next track
     */
    async skipToNext(deviceId) {
        await this.request({
            method: 'POST',
            url: '/me/player/next',
            params: deviceId ? { device_id: deviceId } : undefined,
        });
    }
    /**
     * Skip to previous track
     */
    async skipToPrevious(deviceId) {
        await this.request({
            method: 'POST',
            url: '/me/player/previous',
            params: deviceId ? { device_id: deviceId } : undefined,
        });
    }
    /**
     * Set playback volume
     */
    async setVolume(volumePercent, deviceId) {
        // Clamp volume between 0 and 100
        const volume = Math.max(0, Math.min(100, Math.round(volumePercent)));
        await this.request({
            method: 'PUT',
            url: '/me/player/volume',
            params: {
                volume_percent: volume,
                ...(deviceId ? { device_id: deviceId } : {}),
            },
        });
    }
    /**
     * Toggle shuffle state
     */
    async setShuffle(state, deviceId) {
        await this.request({
            method: 'PUT',
            url: '/me/player/shuffle',
            params: {
                state,
                ...(deviceId ? { device_id: deviceId } : {}),
            },
        });
    }
    /**
     * Set repeat mode
     */
    async setRepeat(state, deviceId) {
        await this.request({
            method: 'PUT',
            url: '/me/player/repeat',
            params: {
                state,
                ...(deviceId ? { device_id: deviceId } : {}),
            },
        });
    }
    /**
     * Seek to position in current track
     */
    async seek(positionMs, deviceId) {
        await this.request({
            method: 'PUT',
            url: '/me/player/seek',
            params: {
                position_ms: positionMs,
                ...(deviceId ? { device_id: deviceId } : {}),
            },
        });
    }
    /**
     * Transfer playback to different device
     */
    async transferPlayback(deviceIds, play) {
        await this.request({
            method: 'PUT',
            url: '/me/player',
            data: {
                device_ids: deviceIds,
                play: play ?? true,
            },
        });
    }
    /**
     * Search Spotify catalog
     */
    async search(query, types, options) {
        const response = await this.request({
            method: 'GET',
            url: '/search',
            params: {
                q: query,
                type: types.join(','),
                market: options?.market,
                limit: options?.limit || 20,
                offset: options?.offset || 0,
            },
        });
        return response;
    }
    /**
     * Add item to playback queue
     */
    async addToQueue(uri, deviceId) {
        await this.request({
            method: 'POST',
            url: '/me/player/queue',
            params: {
                uri,
                ...(deviceId ? { device_id: deviceId } : {}),
            },
        });
    }
    /**
     * Get user's queue
     */
    async getQueue() {
        const response = await this.request({
            method: 'GET',
            url: '/me/player/queue',
        });
        return response;
    }
    /**
     * Get user profile
     */
    async getUserProfile() {
        const response = await this.request({
            method: 'GET',
            url: '/me',
        });
        return response;
    }
    /**
     * Get user's playlists
     */
    async getUserPlaylists(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/playlists',
            params: {
                limit: options?.limit || 20,
                offset: options?.offset || 0,
            },
        });
        return response;
    }
    /**
     * Get recently played tracks
     */
    async getRecentlyPlayed(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/player/recently-played',
            params: {
                limit: options?.limit || 20,
                after: options?.after,
                before: options?.before,
            },
        });
        return response;
    }
    /**
     * Get available devices
     */
    async getAvailableDevices() {
        const response = await this.request({
            method: 'GET',
            url: '/me/player/devices',
        });
        return response;
    }
    /**
     * Get recommendations
     */
    async getRecommendations(options) {
        const response = await this.request({
            method: 'GET',
            url: '/recommendations',
            params: options,
        });
        return response;
    }
    /**
     * Get playlist tracks
     */
    async getPlaylistTracks(playlistId, options) {
        const response = await this.request({
            method: 'GET',
            url: `/playlists/${playlistId}/tracks`,
            params: options,
        });
        return response;
    }
    /**
     * Get album tracks
     */
    async getAlbumTracks(albumId, options) {
        const response = await this.request({
            method: 'GET',
            url: `/albums/${albumId}/tracks`,
            params: options,
        });
        return response;
    }
    /**
     * Get user's top tracks
     */
    async getUserTopTracks(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/top/tracks',
            params: {
                time_range: options?.time_range || 'medium_term',
                limit: options?.limit || 20,
                offset: options?.offset || 0,
            },
        });
        return response;
    }
    /**
     * Get user's top artists
     */
    async getUserTopArtists(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/top/artists',
            params: {
                time_range: options?.time_range || 'medium_term',
                limit: options?.limit || 20,
                offset: options?.offset || 0,
            },
        });
        return response;
    }
    /**
     * Get audio features for a track
     */
    async getAudioFeatures(trackId) {
        const response = await this.request({
            method: 'GET',
            url: `/audio-features/${trackId}`,
        });
        return response;
    }
    /**
     * Get user's saved tracks
     */
    async getUserSavedTracks(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/tracks',
            params: {
                limit: options?.limit || 20,
                offset: options?.offset || 0,
            },
        });
        return response;
    }
    /**
     * Get user's saved albums
     */
    async getUserSavedAlbums(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/albums',
            params: {
                limit: options?.limit || 20,
                offset: options?.offset || 0,
            },
        });
        return response;
    }
    /**
     * Get user's followed artists
     */
    async getUserFollowedArtists(options) {
        const response = await this.request({
            method: 'GET',
            url: '/me/following',
            params: {
                type: 'artist',
                limit: options?.limit || 20,
                after: options?.after,
            },
        });
        return response;
    }
    /**
     * Set up axios interceptors for auth and error handling
     */
    setupInterceptors() {
        // Request interceptor for authentication
        this.axios.interceptors.request.use(async (config) => {
            // Get access token
            const tokenResult = await this.authService.getAccessToken(this.userId);
            if (!tokenResult.success || !tokenResult.token) {
                throw new SpotifyAuthError('Failed to get access token', {
                    requiresAuth: true,
                });
            }
            // Add authorization header
            config.headers.Authorization = `Bearer ${tokenResult.token}`;
            return config;
        }, (error) => {
            this.logger.error('Request interceptor error', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return Promise.reject(error);
        });
        // Response interceptor for error handling
        this.axios.interceptors.response.use((response) => response, async (error) => {
            // Handle different error types
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                const errorData = data.error || {};
                // Rate limiting
                if (status === 429) {
                    const retryAfter = parseInt(error.response.headers['retry-after'] || '30');
                    const rateLimitDetails = {
                        retryAfter,
                    };
                    if (error.config?.url) {
                        rateLimitDetails.endpoint = error.config.url;
                    }
                    throw new SpotifyRateLimitError('Rate limit exceeded', rateLimitDetails);
                }
                // Authentication errors
                if (status === 401) {
                    const authDetails = {
                        requiresAuth: true,
                        spotifyError: data,
                    };
                    throw new SpotifyAuthError('Authentication failed', authDetails);
                }
                // Other client errors
                if (status >= 400 && status < 500) {
                    const errorDetails = {
                        status,
                        code: errorData.reason || 'SPOTIFY_API_ERROR',
                        spotifyError: data,
                    };
                    throw new SpotifyError(errorData.message || `Spotify API error: ${status}`, errorDetails);
                }
                // Server errors
                if (status >= 500) {
                    throw new SpotifyError('Spotify server error', {
                        status,
                        code: 'SPOTIFY_SERVER_ERROR',
                        retryable: true,
                        spotifyError: data,
                    });
                }
            }
            // Network errors
            if (error.code === 'ECONNABORTED') {
                throw new SpotifyError('Request timeout', {
                    code: 'TIMEOUT',
                    retryable: true,
                });
            }
            // Other errors
            throw new SpotifyError(error.message || 'Unknown error occurred', {
                code: 'UNKNOWN_ERROR',
                originalError: error,
            });
        });
    }
    /**
     * Make a request with rate limiting and retry logic
     */
    async request(config) {
        const endpoint = config.url || '';
        // Check rate limit before making request
        await this.rateLimiter.checkRateLimit(endpoint);
        let lastError = null;
        // Retry logic
        for (let attempt = 1; attempt <= SpotifyClient.MAX_RETRIES; attempt++) {
            try {
                this.logger.debug('Making Spotify API request', {
                    method: config.method,
                    url: config.url,
                    attempt,
                });
                const response = await this.axios.request(config);
                // Update rate limit info from response headers
                this.rateLimiter.updateFromHeaders(endpoint, response.headers);
                return response.data;
            }
            catch (error) {
                lastError = error;
                // Don't retry auth errors or client errors (except rate limits)
                if (error instanceof SpotifyAuthError ||
                    (error instanceof SpotifyError &&
                        error.details.status &&
                        error.details.status >= 400 &&
                        error.details.status < 500 &&
                        !(error instanceof SpotifyRateLimitError))) {
                    throw error;
                }
                // Handle rate limit errors
                if (error instanceof SpotifyRateLimitError) {
                    const waitTime = error.retryAfter * 1000;
                    this.logger.warn('Rate limited, waiting before retry', {
                        endpoint,
                        waitTime,
                        attempt,
                    });
                    await this.delay(waitTime);
                    continue;
                }
                // Retry other errors with exponential backoff
                if (attempt < SpotifyClient.MAX_RETRIES) {
                    const delay = SpotifyClient.RETRY_DELAY * Math.pow(2, attempt - 1);
                    this.logger.warn('Request failed, retrying', {
                        endpoint,
                        attempt,
                        delay,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    await this.delay(delay);
                    continue;
                }
            }
        }
        // All retries exhausted
        this.logger.error('All retry attempts failed', {
            endpoint,
            error: lastError?.message,
        });
        throw lastError || new Error('Request failed after all retries');
    }
    /**
     * Delay helper for retries
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=client.js.map