import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Logger } from '../types/index.js';
/**
 * Transport configuration and utilities for MCP server
 *
 * Handles stdio transport setup and monitoring for the MCP protocol.
 */
export declare class TransportManager {
    private readonly logger;
    private transport;
    constructor(logger: Logger);
    /**
     * Create and configure stdio transport
     */
    createTransport(): StdioServerTransport;
    /**
     * Set up transport event handlers
     */
    private setupTransportHandlers;
    /**
     * Monitor transport health and connection status
     */
    private monitorTransportHealth;
    /**
     * Get transport statistics
     */
    getStats(): TransportStats;
    /**
     * Gracefully close transport
     */
    close(): Promise<void>;
}
/**
 * Transport statistics
 */
export interface TransportStats {
    type: string;
    connected: boolean;
    uptime: number;
}
/**
 * Transport configuration options
 */
export interface TransportConfig {
}
//# sourceMappingURL=transport.d.ts.map