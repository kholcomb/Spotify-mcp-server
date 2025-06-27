import { z } from 'zod';
import type { Logger, ToolContext, ToolResult } from '../types/index.js';
import type { ToolRegistry } from './toolRegistry.js';
import type { AuthService } from '../auth/index.js';
import type { SpotifyClient } from '../types/index.js';
import { SpotifyClient as SpotifyClientImpl } from '../spotify/index.js';
import type { ClientAuthenticator } from '../security/clientAuthenticator.js';
import type { EnhancedRateLimiter } from '../security/enhancedRateLimiter.js';
import type { InputSanitizer } from '../security/inputSanitizer.js';
import type { ScopeManager } from '../security/scopeManager.js';

/**
 * Request handler for MCP tool execution
 * 
 * Processes tool requests, validates inputs, manages context,
 * and handles errors for the MCP server.
 */
export class RequestHandler {
  private readonly toolRegistry: ToolRegistry;
  private readonly authService: AuthService;
  private readonly logger: Logger;
  private spotifyClient: SpotifyClient;
  private readonly securityComponents?: {
    clientAuthenticator?: ClientAuthenticator;
    rateLimiter?: EnhancedRateLimiter;
    inputSanitizer?: InputSanitizer;
    scopeManager?: ScopeManager;
  };
  
  constructor(
    toolRegistry: ToolRegistry,
    authService: AuthService,
    logger: Logger,
    securityComponents?: {
      clientAuthenticator?: ClientAuthenticator;
      rateLimiter?: EnhancedRateLimiter;
      inputSanitizer?: InputSanitizer;
      scopeManager?: ScopeManager;
    }
  ) {
    this.toolRegistry = toolRegistry;
    this.authService = authService;
    this.logger = logger;
    this.securityComponents = securityComponents;
    
    // Initialize Spotify client
    this.spotifyClient = new SpotifyClientImpl(authService, logger);
    
    if (securityComponents) {
      this.logger.info('Request handler initialized with security components', {
        hasClientAuth: !!securityComponents.clientAuthenticator,
        hasRateLimiter: !!securityComponents.rateLimiter,
        hasInputSanitizer: !!securityComponents.inputSanitizer,
        hasScopeManager: !!securityComponents.scopeManager,
      });
    }
  }
  
  /**
   * Handle tool call request
   */
  async handleToolCall(
    toolName: string, 
    args: unknown, 
    context?: { userId?: string; clientId?: string }
  ): Promise<ToolResult> {
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
      
      // Apply security input sanitization first
      let processedInput = args;
      if (this.securityComponents?.inputSanitizer && args) {
        try {
          processedInput = this.securityComponents.inputSanitizer.sanitizeInput(args);
          if (processedInput !== args) {
            this.logger.debug('Input sanitized during tool execution', {
              toolName,
              userId: context?.userId,
            });
          }
        } catch (error) {
          this.logger.error('Input sanitization failed', {
            toolName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return {
            success: false,
            error: {
              code: 'INPUT_SANITIZATION_ERROR',
              message: 'Input contains potentially unsafe content',
            },
          };
        }
      }
      
      // Validate input if tool has Zod schema
      let validatedInput = processedInput;
      if (tool.inputSchema && 'parse' in tool.inputSchema) {
        try {
          validatedInput = (tool.inputSchema as z.ZodSchema).parse(processedInput);
        } catch (error) {
          if (error instanceof z.ZodError) {
            this.logger.error('Input validation failed', {
              toolName,
              errors: error.errors,
              userId: context?.userId,
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
      
      // Check scope permissions if scope manager is available and user is authenticated
      if (this.securityComponents?.scopeManager && context?.userId) {
        try {
          const authStatus = await this.authService.getAuthStatus();
          if (authStatus.authenticated && authStatus.scopes) {
            const scopeValidation = this.securityComponents.scopeManager.validateToolAccess(
              toolName, 
              authStatus.scopes.split(' ')
            );
            
            if (!scopeValidation.allowed) {
              this.logger.warn('Tool access denied due to insufficient scopes', {
                toolName,
                userId: context.userId,
                missingScopes: scopeValidation.missingScopes,
                reason: scopeValidation.reason,
              });
              
              return {
                success: false,
                error: {
                  code: 'INSUFFICIENT_SCOPES',
                  message: scopeValidation.reason || 'Insufficient permissions for this tool',
                  details: {
                    missingScopes: scopeValidation.missingScopes,
                  },
                },
              };
            }
            
            // Log scope usage for auditing
            this.securityComponents.scopeManager.logScopeUsage(
              toolName, 
              authStatus.scopes.split(' ')
            );
          }
        } catch (error) {
          this.logger.warn('Scope validation failed', {
            toolName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      // Execute tool
      this.logger.info('Executing tool', {
        toolName,
        hasInput: !!validatedInput,
        userId: context?.userId,
        clientId: context?.clientId,
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
        return result as ToolResult;
      }
      
      // Wrap raw result in ToolResult format
      return {
        success: true,
        data: result,
      };
      
    } catch (error) {
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
  private async createToolContext(toolName?: string): Promise<ToolContext> {
    // Check authentication status
    const authStatus = await this.authService.getAuthStatus();
    
    if (!authStatus.authenticated && !this.isAuthExemptTool(toolName)) {
      throw new Error('Authentication required. Please authenticate with Spotify first.');
    }
    
    // Create context with available services
    const context: ToolContext = {
      spotify: this.spotifyClient,
      auth: this.authService,
      logger: this.logger,
    };
    
    return context;
  }
  
  /**
   * Check if current tool is exempt from authentication
   */
  private isAuthExemptTool(toolName?: string): boolean {
    // Tools that don't require authentication
    const exemptTools = ['health_check', 'authenticate', 'get_auth_status'];
    return toolName ? exemptTools.includes(toolName) : false;
  }
  
  /**
   * Validate tool exists and can be executed
   */
  async validateToolAccess(toolName: string): Promise<{ valid: boolean; error?: string }> {
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
  getStats(): RequestHandlerStats {
    return {
      registeredTools: this.toolRegistry.getToolNames().length,
      spotifyClientConnected: true,
      authServiceAvailable: true,
    };
  }
}

/**
 * Request handler statistics
 */
export interface RequestHandlerStats {
  registeredTools: number;
  spotifyClientConnected: boolean;
  authServiceAvailable: boolean;
}