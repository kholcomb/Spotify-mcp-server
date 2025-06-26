/**
 * Jest test setup and configuration
 * 
 * Global test configuration and mocks for the Spotify MCP server test suite
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';
process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:8080/callback';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock external services
jest.mock('axios');
jest.mock('fs');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('test-random-bytes')),
}));

// Global test helpers
global.console = {
  ...global.console,
  // Suppress console.log in tests unless needed for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock logger for tests
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});