import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
/**
 * Transport configuration and utilities for MCP server
 *
 * Handles stdio transport setup and monitoring for the MCP protocol.
 */
export class TransportManager {
    logger;
    transport = null;
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Create and configure stdio transport
     */
    createTransport() {
        this.logger.info('Creating stdio transport');
        // Create transport with error handling
        this.transport = new StdioServerTransport();
        // Set up transport event handlers
        this.setupTransportHandlers();
        return this.transport;
    }
    /**
     * Set up transport event handlers
     */
    setupTransportHandlers() {
        if (!this.transport) {
            throw new Error('Transport not initialized');
        }
        // Handle transport errors
        process.stdin.on('error', (error) => {
            this.logger.error('Stdin error', {
                error: error.message,
                code: error.code
            });
        });
        process.stdout.on('error', (error) => {
            this.logger.error('Stdout error', {
                error: error.message,
                code: error.code
            });
        });
        // Handle process termination
        process.on('SIGPIPE', () => {
            this.logger.warn('SIGPIPE received, client may have disconnected');
        });
        // Monitor transport health
        this.monitorTransportHealth();
    }
    /**
     * Monitor transport health and connection status
     */
    monitorTransportHealth() {
        // Check if stdin is still readable
        const checkInterval = setInterval(() => {
            if (process.stdin.destroyed) {
                this.logger.error('Stdin destroyed, transport connection lost');
                clearInterval(checkInterval);
                process.exit(1);
            }
        }, 5000);
        // Clear interval on shutdown
        process.on('beforeExit', () => {
            clearInterval(checkInterval);
        });
    }
    /**
     * Get transport statistics
     */
    getStats() {
        return {
            type: 'stdio',
            connected: !!this.transport && !process.stdin.destroyed,
            uptime: process.uptime(),
        };
    }
    /**
     * Gracefully close transport
     */
    async close() {
        this.logger.info('Closing transport');
        // StdioServerTransport doesn't have explicit close method
        // but we can clean up our handlers
        process.stdin.removeAllListeners('error');
        process.stdout.removeAllListeners('error');
        this.transport = null;
    }
}
//# sourceMappingURL=transport.js.map