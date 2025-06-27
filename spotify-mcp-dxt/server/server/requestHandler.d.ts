import type { Logger, ToolResult } from '../types/index.js';
import type { ToolRegistry } from './toolRegistry.js';
import type { AuthService } from '../auth/index.js';
/**
 * Request handler for MCP tool execution
 *
 * Processes tool requests, validates inputs, manages context,
 * and handles errors for the MCP server.
 */
export declare class RequestHandler {
    private readonly toolRegistry;
    private readonly authService;
    private readonly logger;
    private spotifyClient;
    constructor(toolRegistry: ToolRegistry, authService: AuthService, logger: Logger);
    /**
     * Handle tool call request
     */
    handleToolCall(toolName: string, args: unknown): Promise<ToolResult>;
    /**
     * Create tool execution context
     */
    private createToolContext;
    /**
     * Check if current tool is exempt from authentication
     */
    private isAuthExemptTool;
    /**
     * Validate tool exists and can be executed
     */
    validateToolAccess(toolName: string): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Get request handler statistics
     */
    getStats(): RequestHandlerStats;
}
/**
 * Request handler statistics
 */
export interface RequestHandlerStats {
    registeredTools: number;
    spotifyClientConnected: boolean;
    authServiceAvailable: boolean;
}
//# sourceMappingURL=requestHandler.d.ts.map