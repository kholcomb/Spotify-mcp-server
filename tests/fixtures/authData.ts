/**
 * Test fixtures for authentication data
 */

import type { AuthTokens, PKCEData } from '../../src/types/index.js';

export const mockAuthTokens: AuthTokens = {
  accessToken: 'test_access_token_12345',
  refreshToken: 'test_refresh_token_67890',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing',
  tokenType: 'Bearer',
};

export const mockPKCEData: PKCEData = {
  codeVerifier: 'test_code_verifier_abcdef123456789',
  state: 'test_state_xyz789',
  timestamp: Date.now(),
};

export const mockAuthConfig = {
  clientId: 'test_client_id',
  clientSecret: 'test_client_secret',
  redirectUri: 'http://localhost:8080/callback',
};

export const mockSpotifyAuthUrl = 'https://accounts.spotify.com/authorize?client_id=test_client_id&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback&code_challenge_method=S256&code_challenge=test_challenge&state=test_state&scope=user-read-playback-state%20user-modify-playback-state&show_dialog=true';

export const mockAuthCode = 'test_auth_code_received_from_spotify';

export const mockTokenResponse = {
  access_token: 'new_access_token_12345',
  token_type: 'Bearer',
  scope: 'user-read-playback-state user-modify-playback-state',
  expires_in: 3600,
  refresh_token: 'new_refresh_token_67890',
};

export const mockExpiredTokens: AuthTokens = {
  accessToken: 'expired_access_token',
  refreshToken: 'expired_refresh_token',
  expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
  scope: 'user-read-playback-state user-modify-playback-state',
  tokenType: 'Bearer',
};