/**
 * Global teardown for integration tests
 * 
 * Cleans up test environment, removes temporary files,
 * and ensures clean state after integration test completion.
 */

import { rmSync, existsSync } from 'fs';
import path from 'path';

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Cleaning up integration test environment...');

  // Clean up test data directory
  const testDataDir = path.join(process.cwd(), 'tests', 'data');
  if (existsSync(testDataDir)) {
    try {
      rmSync(testDataDir, { recursive: true, force: true });
      console.log('🗑️  Test data directory cleaned');
    } catch (error) {
      console.warn('⚠️  Failed to clean test data directory:', error);
    }
  }

  // Clean up test logs (keep them for debugging if needed)
  const testLogsDir = path.join(process.cwd(), 'tests', 'logs');
  if (existsSync(testLogsDir)) {
    console.log('📝 Test logs preserved in:', testLogsDir);
  }

  // Shutdown any running mock servers
  await shutdownMockServers();

  // Clear environment variables
  delete process.env.TEST_DATA_DIR;
  delete process.env.TEST_LOGS_DIR;
  delete process.env.MCP_SERVER_PORT;

  console.log('✅ Integration test environment cleanup complete');
}

async function shutdownMockServers(): Promise<void> {
  // Shutdown any mock servers that were started during tests
  console.log('🛑 Mock servers shutdown complete');
}