/**
 * Mock Spotify API responses for testing
 */

export const mockSpotifyPlaybackState = {
  device: {
    id: 'test_device_id',
    is_active: true,
    is_private_session: false,
    is_restricted: false,
    name: 'Test Device',
    type: 'Computer',
    volume_percent: 75,
  },
  shuffle_state: false,
  repeat_state: 'off',
  timestamp: Date.now(),
  progress_ms: 120000,
  is_playing: true,
  item: {
    id: 'test_track_id',
    name: 'Test Track',
    type: 'track',
    uri: 'spotify:track:test_track_id',
    popularity: 85,
    duration_ms: 240000,
    artists: [
      {
        id: 'test_artist_id',
        name: 'Test Artist',
        type: 'artist',
        uri: 'spotify:artist:test_artist_id',
      },
    ],
    album: {
      id: 'test_album_id',
      name: 'Test Album',
      type: 'album',
      uri: 'spotify:album:test_album_id',
      images: [
        {
          url: 'https://example.com/album-cover.jpg',
          height: 640,
          width: 640,
        },
      ],
    },
    external_urls: {
      spotify: 'https://open.spotify.com/track/test_track_id',
    },
    preview_url: 'https://example.com/preview.mp3',
  },
  context: {
    type: 'playlist',
    href: 'https://api.spotify.com/v1/playlists/test_playlist_id',
    external_urls: {
      spotify: 'https://open.spotify.com/playlist/test_playlist_id',
    },
    uri: 'spotify:playlist:test_playlist_id',
  },
};

export const mockSpotifySearchResults = {
  tracks: {
    items: [
      {
        id: 'search_track_1',
        name: 'Search Result Track 1',
        type: 'track',
        uri: 'spotify:track:search_track_1',
        popularity: 90,
        duration_ms: 180000,
        artists: [
          {
            id: 'search_artist_1',
            name: 'Search Artist 1',
            type: 'artist',
            uri: 'spotify:artist:search_artist_1',
          },
        ],
        album: {
          id: 'search_album_1',
          name: 'Search Album 1',
          type: 'album',
          uri: 'spotify:album:search_album_1',
        },
        external_urls: {
          spotify: 'https://open.spotify.com/track/search_track_1',
        },
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
  },
  artists: {
    items: [],
    total: 0,
    limit: 20,
    offset: 0,
  },
  albums: {
    items: [],
    total: 0,
    limit: 20,
    offset: 0,
  },
  playlists: {
    items: [],
    total: 0,
    limit: 20,
    offset: 0,
  },
};

export const mockSpotifyUserProfile = {
  id: 'test_user_id',
  display_name: 'Test User',
  email: 'test@example.com',
  followers: {
    total: 42,
  },
  images: [
    {
      url: 'https://example.com/user-avatar.jpg',
      height: 300,
      width: 300,
    },
  ],
  product: 'premium',
  country: 'US',
  explicit_content: {
    filter_enabled: false,
    filter_locked: false,
  },
  external_urls: {
    spotify: 'https://open.spotify.com/user/test_user_id',
  },
};

export const mockSpotifyDevices = {
  devices: [
    {
      id: 'device_1',
      is_active: true,
      is_private_session: false,
      is_restricted: false,
      name: 'Test Device 1',
      type: 'Computer',
      volume_percent: 75,
    },
    {
      id: 'device_2',
      is_active: false,
      is_private_session: false,
      is_restricted: false,
      name: 'Test Device 2',
      type: 'Smartphone',
      volume_percent: 50,
    },
  ],
};

export const mockSpotifyQueue = {
  currently_playing: mockSpotifyPlaybackState.item,
  queue: [
    {
      id: 'queue_track_1',
      name: 'Queue Track 1',
      type: 'track',
      uri: 'spotify:track:queue_track_1',
      duration_ms: 200000,
      artists: [
        {
          id: 'queue_artist_1',
          name: 'Queue Artist 1',
          type: 'artist',
          uri: 'spotify:artist:queue_artist_1',
        },
      ],
      album: {
        id: 'queue_album_1',
        name: 'Queue Album 1',
        type: 'album',
        uri: 'spotify:album:queue_album_1',
      },
    },
  ],
};

export const mockSpotifyTokenResponse = {
  access_token: 'test_access_token_12345',
  token_type: 'Bearer',
  scope: 'user-read-playback-state user-modify-playback-state',
  expires_in: 3600,
  refresh_token: 'test_refresh_token_67890',
};