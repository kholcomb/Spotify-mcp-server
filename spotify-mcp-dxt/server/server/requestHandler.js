import { z } from 'zod';
import { SpotifyClient as SpotifyClientImpl } from '../spotify/index.js';
/**
 * Request handler for MCP tool execution
 *
 * Processes tool requests, validates inputs, manages context,
 * and handles errors for the MCP server.
 */
export class RequestHandler {
    toolRegistry;
    authService;
    logger;
    spotifyClient;
    constructor(toolRegistry, authService, logger) {
        this.toolRegistry = toolRegistry;
        this.authService = authService;
        this.logger = logger;
        // Initialize Spotify client
        this.spotifyClient = new SpotifyClientImpl(authService, logger);
    }
    /**
     * Handle tool call request
     */
    async handleToolCall(toolName, args) {
        const startTime = Date.now();
        try {
            // Get tool from registry
            const tool = this.toolRegistry.getTool(toolName);
            if (!tool) {
                this.logger.error('Tool not found', { toolName });
                return {
                    success: false,
                    error: {
                        code: 'TOOL_NOT_FOUND',
                        message: `Tool '${toolName}' is not registered`,
                    },
                };
            }
            // Create tool context (not used in current implementation but available for extensions)
            const _context = await this.createToolContext(toolName);
            // Validate input if tool has Zod schema
            let validatedInput = args;
            if (tool.inputSchema && 'parse' in tool.inputSchema) {
                try {
                    validatedInput = tool.inputSchema.parse(args);
                }
                catch (error) {
                    if (error instanceof z.ZodError) {
                        this.logger.error('Input validation failed', {
                            toolName,
                            errors: error.errors
                        });
                        return {
                            success: false,
                            error: {
                                code: 'VALIDATION_ERROR',
                                message: 'Invalid input parameters',
                                details: error.errors,
                            },
                        };
                    }
                    throw error;
                }
            }
            // Execute tool
            this.logger.info('Executing tool', {
                toolName,
                hasInput: !!validatedInput
            });
            const result = await tool.execute(validatedInput);
            const duration = Date.now() - startTime;
            this.logger.info('Tool execution completed', {
                toolName,
                duration,
                success: true
            });
            // Ensure result matches ToolResult interface
            if (typeof result === 'object' && result !== null && 'success' in result) {
                return result;
            }
            // Wrap raw result in ToolResult format
            return {
                success: true,
                data: result,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Tool execution error', {
                toolName,
                duration,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            // Handle specific error types
            if (error instanceof Error) {
                if (error.message.includes('authenticate')) {
                    return {
                        success: false,
                        error: {
                            code: 'AUTHENTICATION_REQUIRED',
                            message: 'Please authenticate with Spotify first',
                            retryable: false,
                        },
                    };
                }
                if (error.message.includes('rate limit')) {
                    return {
                        success: false,
                        error: {
                            code: 'RATE_LIMITED',
                            message: 'Spotify API rate limit exceeded. Please try again later.',
                            retryable: true,
                        },
                    };
                }
            }
            // Generic error response
            return {
                success: false,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : 'Tool execution failed',
                    retryable: false,
                },
            };
        }
    }
    /**
     * Create tool execution context
     */
    async createToolContext(toolName) {
        // Check authentication status
        const authStatus = await this.authService.getAuthStatus();
        if (!authStatus.authenticated && !this.isAuthExemptTool(toolName)) {
            throw new Error('Authentication required. Please authenticate with Spotify first.');
        }
        // Create context with available services
        const context = {
            spotify: this.spotifyClient,
            auth: this.authService,
            logger: this.logger,
        };
        return context;
    }
    /**
     * Check if current tool is exempt from authentication
     */
    isAuthExemptTool(toolName) {
        // Tools that don't require authentication
        const exemptTools = ['health_check', 'authenticate', 'get_auth_status'];
        return toolName ? exemptTools.includes(toolName) : false;
    }
    /**
     * Validate tool exists and can be executed
     */
    async validateToolAccess(toolName) {
        if (!this.toolRegistry.hasTool(toolName)) {
            return {
                valid: false,
                error: `Tool '${toolName}' does not exist`,
            };
        }
        // Add additional validation as needed
        // For example, check user permissions, rate limits, etc.
        return { valid: true };
    }
    /**
     * Get request handler statistics
     */
    getStats() {
        return {
            registeredTools: this.toolRegistry.getToolNames().length,
            spotifyClientConnected: true,
            authServiceAvailable: true,
        };
    }
}
//# sourceMappingURL=requestHandler.js.map