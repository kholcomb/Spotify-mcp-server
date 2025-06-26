/**
 * Test fixtures for Spotify API data
 */

import type {
  PlaybackState,
  SearchResults,
  UserProfile,
  DevicesResponse,
  QueueState,
  PlaylistsResponse,
  RecentlyPlayedResponse,
  RecommendationsResponse,
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyDevice,
  SpotifyPlaylist,
  PlayHistoryObject
} from '../../src/types/index.js';

export const mockSpotifyTrack: SpotifyTrack = {
  id: 'track123',
  name: 'Test Track',
  type: 'track',
  uri: 'spotify:track:track123',
  popularity: 75,
  artists: [
    {
      id: 'artist123',
      name: 'Test Artist',
      type: 'artist',
      uri: 'spotify:artist:artist123',
      external_urls: {
        spotify: 'https://open.spotify.com/artist/artist123',
      },
    },
  ],
  album: {
    id: 'album123',
    name: 'Test Album',
    type: 'album',
    uri: 'spotify:album:album123',
    artists: [
      {
        id: 'artist123',
        name: 'Test Artist',
        type: 'artist',
        uri: 'spotify:artist:artist123',
        external_urls: {
          spotify: 'https://open.spotify.com/artist/artist123',
        },
      },
    ],
    images: [
      {
        height: 640,
        width: 640,
        url: 'https://i.scdn.co/image/test640',
      },
      {
        height: 300,
        width: 300,
        url: 'https://i.scdn.co/image/test300',
      },
      {
        height: 64,
        width: 64,
        url: 'https://i.scdn.co/image/test64',
      },
    ],
    external_urls: {
      spotify: 'https://open.spotify.com/album/album123',
    },
    release_date: '2023-01-01',
    release_date_precision: 'day',
    total_tracks: 12,
  },
  duration_ms: 240000,
  external_urls: {
    spotify: 'https://open.spotify.com/track/track123',
  },
  preview_url: 'https://p.scdn.co/mp3-preview/test',
};

export const mockSpotifyDevice: SpotifyDevice = {
  id: 'device123',
  is_active: true,
  is_private_session: false,
  is_restricted: false,
  name: 'Test Device',
  type: 'Computer',
  volume_percent: 75,
  supports_volume: true,
};

export const mockPlaybackState: PlaybackState = {
  device: mockSpotifyDevice,
  repeat_state: 'off',
  shuffle_state: false,
  context: {
    external_urls: {
      spotify: 'https://open.spotify.com/playlist/playlist123',
    },
    href: 'https://api.spotify.com/v1/playlists/playlist123',
    type: 'playlist',
    uri: 'spotify:playlist:playlist123',
  },
  timestamp: 1640995200000,
  progress_ms: 120000,
  is_playing: true,
  item: mockSpotifyTrack,
  currently_playing_type: 'track',
  actions: {
    interrupting_playback: false,
    pausing: true,
    resuming: true,
    seeking: true,
    skipping_next: true,
    skipping_prev: true,
    toggling_repeat_context: true,
    toggling_shuffle: true,
    toggling_repeat_track: true,
    transferring_playback: true,
  },
};

export const mockSearchResults: SearchResults = {
  tracks: {
    href: 'https://api.spotify.com/v1/search?query=test&type=track&offset=0&limit=20',
    items: [mockSpotifyTrack],
    limit: 20,
    next: null,
    offset: 0,
    previous: null,
    total: 1,
  },
};

export const mockUserProfile: UserProfile = {
  id: 'user123',
  display_name: 'Test User',
  email: 'test@example.com',
  country: 'US',
  followers: {
    href: null,
    total: 100,
  },
  images: [
    {
      height: 300,
      width: 300,
      url: 'https://i.scdn.co/image/user300',
    },
  ],
  external_urls: {
    spotify: 'https://open.spotify.com/user/user123',
  },
  href: 'https://api.spotify.com/v1/users/user123',
  type: 'user',
  uri: 'spotify:user:user123',
  product: 'premium',
};

export const mockDevicesResponse: DevicesResponse = {
  devices: [
    mockSpotifyDevice,
    {
      id: 'device456',
      is_active: false,
      is_private_session: false,
      is_restricted: false,
      name: 'Test Phone',
      type: 'Smartphone',
      volume_percent: 50,
      supports_volume: true,
    },
  ],
};

export const mockQueueState: QueueState = {
  currently_playing: mockSpotifyTrack,
  queue: [
    {
      ...mockSpotifyTrack,
      id: 'track456',
      name: 'Next Track',
      uri: 'spotify:track:track456',
    },
    {
      ...mockSpotifyTrack,
      id: 'track789',
      name: 'Third Track',
      uri: 'spotify:track:track789',
    },
  ],
};

export const mockSpotifyPlaylist: SpotifyPlaylist = {
  id: 'playlist123',
  name: 'Test Playlist',
  description: 'A test playlist',
  public: true,
  collaborative: false,
  snapshot_id: 'snapshot123',
  tracks: {
    href: 'https://api.spotify.com/v1/playlists/playlist123/tracks',
    total: 25,
  },
  type: 'playlist',
  uri: 'spotify:playlist:playlist123',
  external_urls: {
    spotify: 'https://open.spotify.com/playlist/playlist123',
  },
  href: 'https://api.spotify.com/v1/playlists/playlist123',
  images: [
    {
      height: 640,
      width: 640,
      url: 'https://i.scdn.co/image/playlist640',
    },
  ],
  owner: {
    id: 'user123',
    display_name: 'Test User',
    type: 'user',
    uri: 'spotify:user:user123',
    external_urls: {
      spotify: 'https://open.spotify.com/user/user123',
    },
    href: 'https://api.spotify.com/v1/users/user123',
  },
  followers: {
    href: null,
    total: 50,
  },
};

export const mockPlaylistsResponse: PlaylistsResponse = {
  href: 'https://api.spotify.com/v1/me/playlists?offset=0&limit=20',
  items: [mockSpotifyPlaylist],
  limit: 20,
  next: null,
  offset: 0,
  previous: null,
  total: 1,
};

export const mockPlayHistoryObject: PlayHistoryObject = {
  track: mockSpotifyTrack,
  played_at: '2023-12-31T23:59:59.000Z',
  context: {
    external_urls: {
      spotify: 'https://open.spotify.com/playlist/playlist123',
    },
    href: 'https://api.spotify.com/v1/playlists/playlist123',
    type: 'playlist',
    uri: 'spotify:playlist:playlist123',
  },
};

export const mockRecentlyPlayedResponse: RecentlyPlayedResponse = {
  href: 'https://api.spotify.com/v1/me/player/recently-played?limit=20',
  items: [mockPlayHistoryObject],
  limit: 20,
  next: null,
  cursors: {
    after: '1640995199000',
    before: '1640908800000',
  },
};

export const mockRecommendationsResponse: RecommendationsResponse = {
  tracks: [mockSpotifyTrack],
  seeds: [
    {
      afterFilteringSize: 1000,
      afterRelinkingSize: 1000,
      href: 'https://api.spotify.com/v1/artists/artist123',
      id: 'artist123',
      initialPoolSize: 1000,
      type: 'artist',
    },
  ],
};

// Error response fixtures
export const mockSpotifyErrorResponse = {
  error: {
    status: 400,
    message: 'Invalid request',
  },
};

export const mockSpotifyRateLimitResponse = {
  error: {
    status: 429,
    message: 'Too Many Requests',
    retry_after: 60,
  },
};

export const mockSpotifyAuthErrorResponse = {
  error: {
    status: 401,
    message: 'Invalid access token',
  },
};

// API endpoint responses for different scenarios
export const mockEmptySearchResults: SearchResults = {
  tracks: {
    href: 'https://api.spotify.com/v1/search?query=nosuchresult&type=track&offset=0&limit=20',
    items: [],
    limit: 20,
    next: null,
    offset: 0,
    previous: null,
    total: 0,
  },
};

export const mockPaginatedSearchResults: SearchResults = {
  tracks: {
    href: 'https://api.spotify.com/v1/search?query=test&type=track&offset=0&limit=20',
    items: [mockSpotifyTrack],
    limit: 20,
    next: 'https://api.spotify.com/v1/search?query=test&type=track&offset=20&limit=20',
    offset: 0,
    previous: null,
    total: 100,
  },
};

export const mockLargePlaylistsResponse: PlaylistsResponse = {
  href: 'https://api.spotify.com/v1/me/playlists?offset=0&limit=50',
  items: Array.from({ length: 50 }, (_, i) => ({
    ...mockSpotifyPlaylist,
    id: `playlist${i}`,
    name: `Test Playlist ${i}`,
    uri: `spotify:playlist:playlist${i}`,
  })),
  limit: 50,
  next: 'https://api.spotify.com/v1/me/playlists?offset=50&limit=50',
  offset: 0,
  previous: null,
  total: 150,
};