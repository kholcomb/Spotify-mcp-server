#!/usr/bin/env node
/**
 * Spotify MCP Server - DXT Entry Point
 * 
 * This file serves as the entry point for the DXT package,
 * routing to the actual server implementation.
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';


// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// Change working directory to the DXT package directory
// This ensures Node.js can find the node_modules
process.chdir(__dirname);

// Import and start the actual server
async function startServer() {
    try {
        // Set up environment to bypass the import.meta.url check
        const originalArgv1 = process.argv[1];
        process.argv[1] = join(__dirname, 'server', 'index.js');
        
        const serverModule = await import('./server/index.js');
        
        // Restore original argv
        process.argv[1] = originalArgv1;
    } catch (error) {
        process.exit(1);
    }
}

startServer();