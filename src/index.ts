#!/usr/bin/env node

/**
 * Spotify MCP Server - Main Entry Point
 * 
 * A Model Context Protocol server that provides AI assistants with
 * access to Spotify's music streaming platform.
 */

import { config } from 'dotenv';
import { SimpleLogger } from './utils/logger.js';
import { loadConfig, validateEnvironment } from './utils/config.js';
import { MCPServer } from './server/index.js';

// Load environment variables
config();

async function main(): Promise<void> {
  let mcpServer: MCPServer | null = null;
  
  try {
    // Initialize logger
    const logger = new SimpleLogger(process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' || 'info');
    
    logger.info('Starting Spotify MCP Server...');

    // Validate environment and load configuration
    validateEnvironment();
    const serverConfig = loadConfig();

    logger.info('Configuration loaded successfully', {
      logLevel: serverConfig.logLevel,
      redirectUri: serverConfig.spotify.redirectUri,
    });

    // Initialize and start MCP server
    mcpServer = new MCPServer(serverConfig, logger);
    await mcpServer.start();

    logger.info('Spotify MCP Server started successfully');

    // Keep the process running
    process.stdin.resume();

  } catch (error) {
    const errorLogger = new SimpleLogger('error');
    errorLogger.error('Failed to start Spotify MCP Server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    if (mcpServer) {
      await mcpServer.stop();
    }
    
    process.exit(1);
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const errorLogger = new SimpleLogger('error');
    errorLogger.error('Unhandled error in main', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}