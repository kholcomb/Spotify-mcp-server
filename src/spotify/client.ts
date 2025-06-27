import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import type { 
  Logger, 
  SpotifyClient as ISpotifyClient,
  PlaybackState,
  PlaybackOptions,
  SearchResults,
  SearchOptions,
  QueueState,
  UserProfile,
  PlaylistsResponse,
  PaginationOptions,
  RecentlyPlayedResponse,
  RecentlyPlayedOptions,
  DevicesResponse,
  RecommendationsResponse,
  PlaylistTracksResponse,
  AlbumTracksResponse,
  TopItemsOptions,
  TopTracksResponse,
  TopArtistsResponse,
  AudioFeatures,
  SavedTracksResponse,
  SavedAlbumsResponse,
  FollowedArtistsOptions,
  FollowedArtistsResponse
} from '../types/index.js';
import type { AuthService } from '../auth/index.js';
import { RateLimiter } from './rateLimiter.js';
import { SpotifyError, SpotifyRateLimitError, SpotifyAuthError } from './errors.js';
import type { SpotifyRateLimitErrorDetails, SpotifyAuthErrorDetails, SpotifyErrorDetails } from './errors.js';
import { CertificateManager, createCertificateManager } from '../security/index.js';

/**
 * Spotify Web API client with rate limiting and error handling
 * 
 * Implements all Spotify API operations needed for the MCP server
 * with automatic retry logic and error mapping.
 */
export class SpotifyClient implements ISpotifyClient {
  private readonly axios: AxiosInstance;
  private readonly authService: AuthService;
  private readonly logger: Logger;
  private readonly rateLimiter: RateLimiter;
  private readonly certificateManager: CertificateManager;
  private userId: string = 'default';
  
  private static readonly BASE_URL = 'https://api.spotify.com/v1';
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second base delay
  
  constructor(authService: AuthService, logger: Logger, certificateManager?: CertificateManager) {
    this.authService = authService;
    this.logger = logger;
    this.rateLimiter = new RateLimiter(logger);
    
    // Use provided certificate manager or create default one
    this.certificateManager = certificateManager || createCertificateManager(
      {
        enabled: false, // Will be enabled by security config
        strictMode: false,
        allowDevelopment: true,
      },
      logger
    );
    
    // Create axios instance with certificate pinning if enabled
    const axiosConfig: AxiosRequestConfig = {
      baseURL: SpotifyClient.BASE_URL,
      timeout: SpotifyClient.DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Spotify-MCP-Server/1.0.0',
      },
    };
    
    // Add HTTPS agent with certificate pinning if enabled
    if (this.certificateManager.getConfiguration().enabled) {
      axiosConfig.httpsAgent = this.certificateManager.createSecureAgent();
      logger.info('Spotify client initialized with certificate pinning');
    } else {
      logger.info('Spotify client initialized without certificate pinning');
    }
    
    this.axios = axios.create(axiosConfig);
    
    // Set up request/response interceptors
    this.setupInterceptors();
  }
  
  /**
   * Set the user ID for authentication
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }
  
  /**
   * Get current playback state
   */
  async getCurrentPlayback(options?: Record<string, unknown>): Promise<PlaybackState | null> {
    const response = await this.request<PlaybackState | null>({
      method: 'GET',
      url: '/me/player',
      params: options,
    });
    
    return response;
  }
  
  /**
   * Start or resume playback
   */
  async startPlayback(options?: PlaybackOptions): Promise<void> {
    const data: Record<string, unknown> = {};
    
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
  async pausePlayback(deviceId?: string): Promise<void> {
    await this.request({
      method: 'PUT',
      url: '/me/player/pause',
      params: deviceId ? { device_id: deviceId } : undefined,
    });
  }
  
  /**
   * Skip to next track
   */
  async skipToNext(deviceId?: string): Promise<void> {
    await this.request({
      method: 'POST',
      url: '/me/player/next',
      params: deviceId ? { device_id: deviceId } : undefined,
    });
  }
  
  /**
   * Skip to previous track
   */
  async skipToPrevious(deviceId?: string): Promise<void> {
    await this.request({
      method: 'POST',
      url: '/me/player/previous',
      params: deviceId ? { device_id: deviceId } : undefined,
    });
  }
  
  /**
   * Set playback volume
   */
  async setVolume(volumePercent: number, deviceId?: string): Promise<void> {
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
  async setShuffle(state: boolean, deviceId?: string): Promise<void> {
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
  async setRepeat(state: 'off' | 'track' | 'context', deviceId?: string): Promise<void> {
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
  async seek(positionMs: number, deviceId?: string): Promise<void> {
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
  async transferPlayback(deviceIds: string[], play?: boolean): Promise<void> {
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
  async search(query: string, types: string[], options?: SearchOptions): Promise<SearchResults> {
    const response = await this.request<SearchResults>({
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
  async addToQueue(uri: string, deviceId?: string): Promise<void> {
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
  async getQueue(): Promise<QueueState> {
    const response = await this.request<QueueState>({
      method: 'GET',
      url: '/me/player/queue',
    });
    
    return response;
  }
  
  /**
   * Get user profile
   */
  async getUserProfile(): Promise<UserProfile> {
    const response = await this.request<UserProfile>({
      method: 'GET',
      url: '/me',
    });
    
    return response;
  }
  
  /**
   * Get user's playlists
   */
  async getUserPlaylists(options?: PaginationOptions): Promise<PlaylistsResponse> {
    const response = await this.request<PlaylistsResponse>({
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
  async getRecentlyPlayed(options?: RecentlyPlayedOptions): Promise<RecentlyPlayedResponse> {
    const response = await this.request<RecentlyPlayedResponse>({
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
  async getAvailableDevices(): Promise<DevicesResponse> {
    const response = await this.request<DevicesResponse>({
      method: 'GET',
      url: '/me/player/devices',
    });
    
    return response;
  }
  
  /**
   * Get recommendations
   */
  async getRecommendations(options: Record<string, unknown>): Promise<RecommendationsResponse> {
    const response = await this.request<RecommendationsResponse>({
      method: 'GET',
      url: '/recommendations',
      params: options,
    });
    
    return response;
  }
  
  /**
   * Get playlist tracks
   */
  async getPlaylistTracks(playlistId: string, options?: Record<string, unknown>): Promise<PlaylistTracksResponse> {
    const response = await this.request<PlaylistTracksResponse>({
      method: 'GET',
      url: `/playlists/${playlistId}/tracks`,
      params: options,
    });
    
    return response;
  }
  
  /**
   * Get album tracks
   */
  async getAlbumTracks(albumId: string, options?: Record<string, unknown>): Promise<AlbumTracksResponse> {
    const response = await this.request<AlbumTracksResponse>({
      method: 'GET',
      url: `/albums/${albumId}/tracks`,
      params: options,
    });
    
    return response;
  }

  /**
   * Get user's top tracks
   */
  async getUserTopTracks(options?: TopItemsOptions): Promise<TopTracksResponse> {
    const response = await this.request<TopTracksResponse>({
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
  async getUserTopArtists(options?: TopItemsOptions): Promise<TopArtistsResponse> {
    const response = await this.request<TopArtistsResponse>({
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
  async getAudioFeatures(trackId: string): Promise<AudioFeatures> {
    const response = await this.request<AudioFeatures>({
      method: 'GET',
      url: `/audio-features/${trackId}`,
    });
    
    return response;
  }

  /**
   * Get user's saved tracks
   */
  async getUserSavedTracks(options?: PaginationOptions): Promise<SavedTracksResponse> {
    const response = await this.request<SavedTracksResponse>({
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
  async getUserSavedAlbums(options?: PaginationOptions): Promise<SavedAlbumsResponse> {
    const response = await this.request<SavedAlbumsResponse>({
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
  async getUserFollowedArtists(options?: FollowedArtistsOptions): Promise<FollowedArtistsResponse> {
    const response = await this.request<FollowedArtistsResponse>({
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
  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.axios.interceptors.request.use(
      async (config) => {
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
      },
      (error) => {
        this.logger.error('Request interceptor error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return Promise.reject(error);
      }
    );
    
    // Response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Handle different error types
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data as Record<string, unknown>;
          const errorData = data.error as Record<string, unknown> || {};
          
          // Rate limiting
          if (status === 429) {
            const retryAfter = parseInt(
              error.response.headers['retry-after'] as string || '30'
            );
            
            const rateLimitDetails: SpotifyRateLimitErrorDetails = {
              retryAfter,
            };
            
            if (error.config?.url) {
              rateLimitDetails.endpoint = error.config.url;
            }
            
            throw new SpotifyRateLimitError('Rate limit exceeded', rateLimitDetails);
          }
          
          // Authentication errors
          if (status === 401) {
            const authDetails: Partial<SpotifyAuthErrorDetails> = {
              requiresAuth: true,
              spotifyError: data,
            };
            
            throw new SpotifyAuthError('Authentication failed', authDetails);
          }
          
          // Other client errors
          if (status >= 400 && status < 500) {
            const errorDetails: Partial<SpotifyErrorDetails> = {
              status,
              code: errorData.reason as string || 'SPOTIFY_API_ERROR',
              spotifyError: data,
            };
            
            throw new SpotifyError(
              errorData.message as string || `Spotify API error: ${status}`,
              errorDetails
            );
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
        throw new SpotifyError(
          error.message || 'Unknown error occurred',
          {
            code: 'UNKNOWN_ERROR',
            originalError: error,
          }
        );
      }
    );
  }
  
  /**
   * Make a request with rate limiting and retry logic
   */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const endpoint = config.url || '';
    
    // Check rate limit before making request
    await this.rateLimiter.checkRateLimit(endpoint);
    
    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= SpotifyClient.MAX_RETRIES; attempt++) {
      try {
        this.logger.debug('Making Spotify API request', {
          method: config.method,
          url: config.url,
          attempt,
        });
        
        const response = await this.axios.request<T>(config);
        
        // Update rate limit info from response headers
        this.rateLimiter.updateFromHeaders(
          endpoint,
          response.headers as Record<string, string>
        );
        
        return response.data;
        
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry auth errors or client errors (except rate limits)
        if (
          error instanceof SpotifyAuthError ||
          (error instanceof SpotifyError && 
           error.details.status && 
           error.details.status >= 400 && 
           error.details.status < 500 &&
           !(error instanceof SpotifyRateLimitError))
        ) {
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
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}