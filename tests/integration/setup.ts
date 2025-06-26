/**
 * Global setup for integration tests
 * 
 * Initializes test environment, sets up mock services,
 * and prepares test data for integration test suites.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Setting up integration test environment...');

  // Create test directories
  const testDataDir = path.join(process.cwd(), 'tests', 'data');
  const testLogsDir = path.join(process.cwd(), 'tests', 'logs');
  
  if (!existsSync(testDataDir)) {
    mkdirSync(testDataDir, { recursive: true });
  }
  
  if (!existsSync(testLogsDir)) {
    mkdirSync(testLogsDir, { recursive: true });
  }

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
  process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
  process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:8080/callback';
  process.env.MCP_SERVER_PORT = '3001';
  process.env.TEST_DATA_DIR = testDataDir;
  process.env.TEST_LOGS_DIR = testLogsDir;

  // Create test configuration file
  const testConfig = {
    server: {
      name: 'spotify-mcp-server-test',
      version: '1.0.0-test',
      port: 3001,
    },
    spotify: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:8080/callback',
      scopes: [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-recently-played',
        'user-read-currently-playing',
        'user-library-read',
        'user-library-modify',
        'playlist-read-private',
        'playlist-modify-public',
        'playlist-modify-private',
      ],
    },
    storage: {
      baseDirectory: testDataDir,
      encryptionEnabled: false, // Disable encryption for tests
    },
    security: {
      certificatePinning: {
        enabled: false, // Disable for tests
      },
      hsm: {
        enabled: false, // Use software mode for tests
        provider: 'software',
      },
    },
    logging: {
      level: 'debug',
      file: path.join(testLogsDir, 'integration-test.log'),
    },
  };

  writeFileSync(
    path.join(testDataDir, 'test-config.json'),
    JSON.stringify(testConfig, null, 2)
  );

  // Build the project if needed
  try {
    console.log('📦 Building project for integration tests...');
    execSync('npm run build', { 
      stdio: 'pipe',
      timeout: 60000, // 1 minute timeout
    });
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    throw error;
  }

  // Set up mock Spotify API server (if needed)
  await setupMockSpotifyServer();

  console.log('✅ Integration test environment setup complete');
}

async function setupMockSpotifyServer(): Promise<void> {
  // This would set up a mock Spotify API server for integration testing
  // For now, we'll use axios mocking in individual tests
  console.log('🎵 Mock Spotify API server configured');
}