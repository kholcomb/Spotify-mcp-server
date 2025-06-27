import type { Logger } from '../types/index.js';
import type { ServerConfig } from '../types/index.js';
/**
 * Main MCP Server implementation for Spotify integration
 *
 * Handles Model Context Protocol communication, tool registration,
 * and request routing for Spotify functionality.
 */
export declare class MCPServer {
    private readonly server;
    private readonly transport;
    private readonly toolRegistry;
    private readonly requestHandler;
    private readonly logger;
    private readonly authService;
    private readonly spotifyClient;
    constructor(config: ServerConfig, logger: Logger);
    /**
     * Set up MCP protocol request handlers
     */
    private setupHandlers;
    /**
     * Register all available tools
     */
    registerTools(): Promise<void>;
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
    /**
     * Stop the MCP server
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=mcpServer.d.ts.map