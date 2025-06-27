import type { Logger, SpotifyClient as ISpotifyClient, PlaybackState, PlaybackOptions, SearchResults, SearchOptions, QueueState, UserProfile, PlaylistsResponse, PaginationOptions, RecentlyPlayedResponse, RecentlyPlayedOptions, DevicesResponse, RecommendationsResponse, PlaylistTracksResponse, AlbumTracksResponse, TopItemsOptions, TopTracksResponse, TopArtistsResponse, AudioFeatures, SavedTracksResponse, SavedAlbumsResponse, FollowedArtistsOptions, FollowedArtistsResponse } from '../types/index.js';
import type { AuthService } from '../auth/index.js';
/**
 * Spotify Web API client with rate limiting and error handling
 *
 * Implements all Spotify API operations needed for the MCP server
 * with automatic retry logic and error mapping.
 */
export declare class SpotifyClient implements ISpotifyClient {
    private readonly axios;
    private readonly authService;
    private readonly logger;
    private readonly rateLimiter;
    private readonly certificateManager;
    private userId;
    private static readonly BASE_URL;
    private static readonly DEFAULT_TIMEOUT;
    private static readonly MAX_RETRIES;
    private static readonly RETRY_DELAY;
    constructor(authService: AuthService, logger: Logger);
    /**
     * Set the user ID for authentication
     */
    setUserId(userId: string): void;
    /**
     * Get current playback state
     */
    getCurrentPlayback(options?: Record<string, unknown>): Promise<PlaybackState | null>;
    /**
     * Start or resume playback
     */
    startPlayback(options?: PlaybackOptions): Promise<void>;
    /**
     * Pause playback
     */
    pausePlayback(deviceId?: string): Promise<void>;
    /**
     * Skip to next track
     */
    skipToNext(deviceId?: string): Promise<void>;
    /**
     * Skip to previous track
     */
    skipToPrevious(deviceId?: string): Promise<void>;
    /**
     * Set playback volume
     */
    setVolume(volumePercent: number, deviceId?: string): Promise<void>;
    /**
     * Toggle shuffle state
     */
    setShuffle(state: boolean, deviceId?: string): Promise<void>;
    /**
     * Set repeat mode
     */
    setRepeat(state: 'off' | 'track' | 'context', deviceId?: string): Promise<void>;
    /**
     * Seek to position in current track
     */
    seek(positionMs: number, deviceId?: string): Promise<void>;
    /**
     * Transfer playback to different device
     */
    transferPlayback(deviceIds: string[], play?: boolean): Promise<void>;
    /**
     * Search Spotify catalog
     */
    search(query: string, types: string[], options?: SearchOptions): Promise<SearchResults>;
    /**
     * Add item to playback queue
     */
    addToQueue(uri: string, deviceId?: string): Promise<void>;
    /**
     * Get user's queue
     */
    getQueue(): Promise<QueueState>;
    /**
     * Get user profile
     */
    getUserProfile(): Promise<UserProfile>;
    /**
     * Get user's playlists
     */
    getUserPlaylists(options?: PaginationOptions): Promise<PlaylistsResponse>;
    /**
     * Get recently played tracks
     */
    getRecentlyPlayed(options?: RecentlyPlayedOptions): Promise<RecentlyPlayedResponse>;
    /**
     * Get available devices
     */
    getAvailableDevices(): Promise<DevicesResponse>;
    /**
     * Get recommendations
     */
    getRecommendations(options: Record<string, unknown>): Promise<RecommendationsResponse>;
    /**
     * Get playlist tracks
     */
    getPlaylistTracks(playlistId: string, options?: Record<string, unknown>): Promise<PlaylistTracksResponse>;
    /**
     * Get album tracks
     */
    getAlbumTracks(albumId: string, options?: Record<string, unknown>): Promise<AlbumTracksResponse>;
    /**
     * Get user's top tracks
     */
    getUserTopTracks(options?: TopItemsOptions): Promise<TopTracksResponse>;
    /**
     * Get user's top artists
     */
    getUserTopArtists(options?: TopItemsOptions): Promise<TopArtistsResponse>;
    /**
     * Get audio features for a track
     */
    getAudioFeatures(trackId: string): Promise<AudioFeatures>;
    /**
     * Get user's saved tracks
     */
    getUserSavedTracks(options?: PaginationOptions): Promise<SavedTracksResponse>;
    /**
     * Get user's saved albums
     */
    getUserSavedAlbums(options?: PaginationOptions): Promise<SavedAlbumsResponse>;
    /**
     * Get user's followed artists
     */
    getUserFollowedArtists(options?: FollowedArtistsOptions): Promise<FollowedArtistsResponse>;
    /**
     * Set up axios interceptors for auth and error handling
     */
    private setupInterceptors;
    /**
     * Make a request with rate limiting and retry logic
     */
    private request;
    /**
     * Delay helper for retries
     */
    private delay;
}
//# sourceMappingURL=client.d.ts.map