/**
 * Test fixtures for server configuration and data
 */

import type { ServerConfig, AuthConfig } from '../../src/types/index.js';

export const mockAuthConfig: AuthConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:8080/callback',
  scopes: [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-read-email',
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'streaming'
  ],
};

export const mockServerConfig: ServerConfig = {
  spotify: mockAuthConfig,
  server: {
    name: 'spotify-mcp-server',
    version: '1.0.0',
    debug: false,
  },
  logging: {
    level: 'info',
    format: 'json',
  },
};

export const mockToolDefinition = {
  name: 'test_tool',
  description: 'A test tool for unit testing',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string' },
      param2: { type: 'number', optional: true },
    },
    required: ['param1'],
  },
  execute: jest.fn(),
};

export const mockMCPRequest = {
  method: 'tools/call',
  params: {
    name: 'test_tool',
    arguments: { param1: 'test-value' },
  },
};

export const mockMCPListRequest = {
  method: 'tools/list',
  params: {},
};

export const mockHealthCheckResult = {
  success: true,
  data: {
    server: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    authentication: {
      configured: true,
      authenticated: true,
      message: 'User authenticated successfully',
    },
  },
};