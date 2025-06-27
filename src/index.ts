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
import { createSecurityConfigManager, getSecurityConfigFromEnv } from './security/securityConfig.js';
import { createSecureLogger } from './security/secureLogger.js';
import type { SecurityEnvironment } from './security/securityConfig.js';

// Load environment variables
config();

async function main(): Promise<void> {
  let mcpServer: MCPServer | null = null;
  
  try {
    // Initialize security configuration
    const { environment, overrides } = getSecurityConfigFromEnv();
    
    // Initialize base logger
    const baseLogger = new SimpleLogger(process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' || 'info');
    
    // Initialize security config manager
    const securityConfigManager = createSecurityConfigManager(environment, baseLogger, overrides);
    
    // Initialize secure logger with PII masking
    const logger = createSecureLogger(baseLogger, securityConfigManager.getSecureLoggerConfig());
    
    logger.info('Starting Spotify MCP Server...');

    // Validate environment and load configuration
    validateEnvironment();
    const serverConfig = loadConfig();

    logger.info('Configuration loaded successfully', {
      logLevel: serverConfig.logLevel,
      redirectUri: serverConfig.spotify.redirectUri,
    });

    // Initialize and start MCP server with security configuration
    mcpServer = new MCPServer(serverConfig, logger, securityConfigManager);
    await mcpServer.start();
    
    // Log security posture validation
    const securityPosture = securityConfigManager.validateSecurityPosture();
    logger.info('Security posture validated', {
      score: securityPosture.score,
      issues: securityPosture.issues.length,
      recommendations: securityPosture.recommendations.length,
    });
    
    if (securityPosture.issues.length > 0) {
      logger.warn('Security issues detected', {
        issues: securityPosture.issues,
        recommendations: securityPosture.recommendations,
      });
    }

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