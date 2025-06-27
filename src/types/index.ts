/**
 * Common type definitions for the Spotify MCP Server
 */

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface ServerConfig {
  spotify: SpotifyConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  tokenEncryptionKey?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  tokenType: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  type: 'track' | 'episode';
  uri: string;
  popularity?: number;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  duration_ms: number;
  external_urls: {
    spotify: string;
  };
  preview_url: string | null;
  show?: {
    id: string;
    name: string;
  };
}

export interface PlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
  device: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
  } | null;
  shuffle_state: boolean;
  repeat_state: 'off' | 'track' | 'context';
  timestamp: number;
  context: {
    type: string;
    uri: string;
    external_urls: {
      spotify: string;
    };
  } | null;
}

export interface SearchResults {
  tracks?: {
    items: SpotifyTrack[];
    total: number;
  };
  artists?: {
    items: Array<{
      id: string;
      name: string;
      genres: string[];
      popularity: number;
      uri: string;
      followers?: {
        total: number;
      };
      images?: Array<{
        url: string;
        height: number;
        width: number;
      }>;
      external_urls: {
        spotify: string;
      };
    }>;
    total: number;
  };
  albums?: {
    items: Array<{
      id: string;
      name: string;
      uri: string;
      artists: Array<{
        id: string;
        name: string;
      }>;
      release_date: string;
      total_tracks: number;
      images?: Array<{
        url: string;
        height: number;
        width: number;
      }>;
      external_urls: {
        spotify: string;
      };
    }>;
    total: number;
  };
  playlists?: {
    items: Array<{
      id: string;
      name: string;
      description: string;
      owner: {
        display_name: string;
      };
      tracks: {
        total: number;
      };
      public: boolean;
      uri: string;
      external_urls: {
        spotify: string;
      };
      images?: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    }>;
    total: number;
  };
  shows?: {
    items: Array<{
      id: string;
      name: string;
      description: string;
      publisher: string;
      total_episodes: number;
      uri: string;
      external_urls: {
        spotify: string;
      };
      images?: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    }>;
    total: number;
  };
  episodes?: {
    items: Array<{
      id: string;
      name: string;
      description: string;
      release_date: string;
      duration_ms: number;
      uri: string;
      external_urls: {
        spotify: string;
      };
      images?: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    }>;
    total: number;
  };
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

// MCP Tool Types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: unknown) => Promise<ToolResult>;
}

export interface ToolContext {
  spotify: SpotifyClient;
  auth: AuthService;
  logger: Logger;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
}

// Spotify Client Interface
export interface SpotifyClient {
  getCurrentPlayback(options?: Record<string, unknown>): Promise<PlaybackState | null>;
  startPlayback(options?: PlaybackOptions): Promise<void>;
  pausePlayback(deviceId?: string): Promise<void>;
  skipToNext(deviceId?: string): Promise<void>;
  skipToPrevious(deviceId?: string): Promise<void>;
  setVolume(volumePercent: number, deviceId?: string): Promise<void>;
  setShuffle(state: boolean, deviceId?: string): Promise<void>;
  setRepeat(state: 'off' | 'track' | 'context', deviceId?: string): Promise<void>;
  seek(positionMs: number, deviceId?: string): Promise<void>;
  transferPlayback(deviceIds: string[], play?: boolean): Promise<void>;
  search(query: string, types: string[], options?: SearchOptions): Promise<SearchResults>;
  addToQueue(uri: string, deviceId?: string): Promise<void>;
  getQueue(): Promise<QueueState>;
  getUserProfile(): Promise<UserProfile>;
  getUserPlaylists(options?: PaginationOptions): Promise<PlaylistsResponse>;
  getRecentlyPlayed(options?: RecentlyPlayedOptions): Promise<RecentlyPlayedResponse>;
  getAvailableDevices(): Promise<DevicesResponse>;
  getRecommendations(options: Record<string, unknown>): Promise<RecommendationsResponse>;
  getPlaylistTracks(playlistId: string, options?: Record<string, unknown>): Promise<PlaylistTracksResponse>;
  getAlbumTracks(albumId: string, options?: Record<string, unknown>): Promise<AlbumTracksResponse>;
  
  // User Insights Methods
  getUserTopTracks(options?: TopItemsOptions): Promise<TopTracksResponse>;
  getUserTopArtists(options?: TopItemsOptions): Promise<TopArtistsResponse>;
  getAudioFeatures(trackId: string): Promise<AudioFeatures>;
  getUserSavedTracks(options?: PaginationOptions): Promise<SavedTracksResponse>;
  getUserSavedAlbums(options?: PaginationOptions): Promise<SavedAlbumsResponse>;
  getUserFollowedArtists(options?: FollowedArtistsOptions): Promise<FollowedArtistsResponse>;
}

export interface PlaybackOptions {
  deviceId?: string;
  contextUri?: string;
  uris?: string[];
  offset?: {
    position?: number;
    uri?: string;
  };
  positionMs?: number;
}

export interface SearchOptions {
  market?: string | undefined;
  limit?: number;
  offset?: number;
  include_external?: string | undefined;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface RecentlyPlayedOptions {
  limit?: number;
  after?: number;
  before?: number;
}

export interface QueueState {
  currently_playing: SpotifyTrack | null;
  queue: SpotifyTrack[];
}

export interface UserProfile {
  id: string;
  display_name: string;
  email?: string;
  followers: {
    total: number;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  country: string;
  product: string;
  external_urls: {
    spotify: string;
  };
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  owner: {
    id: string;
    display_name: string;
  };
  tracks: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
}

export interface PlaylistsResponse {
  items: Playlist[];
  total: number;
  limit: number;
  offset: number;
}

export interface RecentlyPlayedTrack {
  track: SpotifyTrack;
  played_at: string;
  context: {
    type: string;
    href: string;
    external_urls: {
      spotify: string;
    };
    uri: string;
  } | null;
}

export interface RecentlyPlayedResponse {
  items: RecentlyPlayedTrack[];
  next: string | null;
  cursors: {
    after: string;
    before: string;
  };
}

// Additional Spotify API types
export interface Device {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
  supports_volume: boolean;
}

export interface DevicesResponse {
  devices: Device[];
}

export interface RecommendationsResponse {
  tracks: SpotifyTrack[];
  seeds: Array<{
    afterFilteringSize: number;
    afterRelinkingSize: number;
    href: string;
    id: string;
    initialPoolSize: number;
    type: string;
  }>;
}

export interface PlaylistTrack {
  added_at: string;
  added_by: {
    id: string;
  };
  is_local: boolean;
  track: SpotifyTrack | null;
}

export interface PlaylistTracksResponse {
  items: PlaylistTrack[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

export interface AlbumTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{
    id: string;
    name: string;
    external_urls: {
      spotify: string;
    };
  }>;
  duration_ms: number;
  explicit: boolean;
  external_urls: {
    spotify: string;
  };
  href: string;
  is_playable: boolean;
  track_number: number;
  type: string;
  preview_url: string | null;
}

export interface AlbumTracksResponse {
  items: AlbumTrack[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

// User Insights Types
export interface TopItemsOptions {
  time_range?: 'short_term' | 'medium_term' | 'long_term';
  limit?: number;
  offset?: number;
}

export interface TopTracksResponse {
  items: SpotifyTrack[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  type: 'artist';
  uri: string;
  href: string;
  popularity: number;
  genres: string[];
  followers: {
    total: number;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
}

export interface TopArtistsResponse {
  items: SpotifyArtist[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
}

export interface AudioFeatures {
  id: string;
  uri: string;
  track_href: string;
  analysis_url: string;
  acousticness: number;
  danceability: number;
  duration_ms: number;
  energy: number;
  instrumentalness: number;
  key: number;
  liveness: number;
  loudness: number;
  mode: number;
  speechiness: number;
  tempo: number;
  time_signature: number;
  valence: number;
  type: 'audio_features';
}

export interface SavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

export interface SavedTracksResponse {
  items: SavedTrack[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
}

export interface Album {
  id: string;
  name: string;
  type: 'album';
  uri: string;
  href: string;
  album_type: 'album' | 'single' | 'compilation';
  total_tracks: number;
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  artists: Array<{
    id: string;
    name: string;
    type: 'artist';
    uri: string;
    href: string;
    external_urls: {
      spotify: string;
    };
  }>;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
  genres: string[];
  popularity: number;
}

export interface SavedAlbum {
  added_at: string;
  album: Album;
}

export interface SavedAlbumsResponse {
  items: SavedAlbum[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
}

export interface FollowedArtistsOptions {
  type: 'artist';
  limit?: number;
  after?: string;
}

export interface FollowedArtistsResponse {
  artists: {
    items: SpotifyArtist[];
    total: number;
    limit: number;
    href: string;
    next: string | null;
    cursors: {
      after: string | null;
      before: string | null;
    };
  };
}

// Auth types
export interface AuthStatus {
  authenticated: boolean;
  message: string;
  requiresReauth?: boolean;
  error?: string;
}

export interface AuthFlowResult {
  success: boolean;
  authUrl?: string;
  message: string;
  expiresAt?: Date;
  alreadyAuthenticated?: boolean;
  error?: string;
}

// Forward reference for AuthService
export interface AuthService {
  startAuthFlow(userId?: string): Promise<AuthFlowResult>;
  getAccessToken(userId?: string): Promise<{ success: boolean; token?: string }>;
  isAuthenticated(userId?: string): Promise<boolean>;
  revokeAuth(userId?: string): Promise<unknown>;
  getAuthStatus(userId?: string): Promise<AuthStatus>;
}