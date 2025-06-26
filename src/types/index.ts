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
  getUserTopTracks(options?: {timeRange?: 'short_term' | 'medium_term' | 'long_term'; limit?: number; offset?: number}): Promise<TopTracksResponse>;
  getUserTopArtists(options?: {timeRange?: 'short_term' | 'medium_term' | 'long_term'; limit?: number; offset?: number}): Promise<TopArtistsResponse>;
  getAudioFeatures(trackIds: string[]): Promise<AudioFeaturesResponse>;
  getUserSavedTracks(options?: PaginationOptions): Promise<SavedTracksResponse>;
  getUserSavedAlbums(options?: PaginationOptions): Promise<SavedAlbumsResponse>;
  getUserFollowedArtists(options?: {after?: string; limit?: number}): Promise<FollowedArtistsResponse>;
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
export interface TopTracksResponse {
  items: SpotifyTrack[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
}

export interface TopArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
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
  uri: string;
  type: 'artist';
}

export interface TopArtistsResponse {
  items: TopArtist[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
}

export interface AudioFeatures {
  acousticness: number;
  analysis_url: string;
  danceability: number;
  duration_ms: number;
  energy: number;
  id: string;
  instrumentalness: number;
  key: number;
  liveness: number;
  loudness: number;
  mode: number;
  speechiness: number;
  tempo: number;
  time_signature: number;
  track_href: string;
  type: 'audio_features';
  uri: string;
  valence: number;
}

export interface AudioFeaturesResponse {
  audio_features: (AudioFeatures | null)[];
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

export interface SavedAlbum {
  added_at: string;
  album: {
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
    release_date: string;
    total_tracks: number;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
    external_urls: {
      spotify: string;
    };
    album_type: string;
    type: 'album';
  };
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

export interface FollowedArtistsResponse {
  artists: {
    items: TopArtist[];
    total: number;
    limit: number;
    href: string;
    next: string | null;
    cursors: {
      after: string;
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