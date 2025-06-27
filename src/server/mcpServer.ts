import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Logger, ToolResult } from '../types/index.js';
import { ToolRegistry } from './toolRegistry.js';
import { RequestHandler } from './requestHandler.js';
import { AuthService } from '../auth/index.js';
import { SpotifyClient } from '../spotify/index.js';
import type { ServerConfig } from '../types/index.js';
import type { SecurityConfigManager } from '../security/securityConfig.js';
import { createClientAuthenticator, type ClientAuthenticator } from '../security/clientAuthenticator.js';
import { createEnhancedRateLimiter, type EnhancedRateLimiter } from '../security/enhancedRateLimiter.js';
import { createInputSanitizer, type InputSanitizer } from '../security/inputSanitizer.js';
import { createCertificateManager, type CertificateManager } from '../security/certificateManager.js';
import { createScopeManager, type ScopeManager } from '../security/scopeManager.js';
import { createSecurityEvent, type SecureLogger } from '../security/secureLogger.js';
import {
  createPlaybackTools,
  createSearchTools,
  createQueueTools,
  createStatusTools,
  createInsightsTools,
} from '../tools/index.js';

/**
 * Main MCP Server implementation for Spotify integration
 * 
 * Handles Model Context Protocol communication, tool registration,
 * and request routing for Spotify functionality.
 */
export class MCPServer {
  private readonly server: Server;
  private readonly transport: StdioServerTransport;
  private readonly toolRegistry: ToolRegistry;
  private readonly requestHandler: RequestHandler;
  private readonly logger: Logger;
  private readonly authService: AuthService;
  private readonly spotifyClient: SpotifyClient;
  private readonly securityConfigManager?: SecurityConfigManager;
  private readonly clientAuthenticator?: ClientAuthenticator;
  private readonly rateLimiter?: EnhancedRateLimiter;
  private readonly inputSanitizer?: InputSanitizer;
  private readonly certificateManager?: CertificateManager;
  private readonly scopeManager?: ScopeManager;
  
  constructor(config: ServerConfig, logger: Logger, securityConfigManager?: SecurityConfigManager) {
    this.logger = logger;
    this.securityConfigManager = securityConfigManager;
    
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'spotify-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Initialize transport
    this.transport = new StdioServerTransport();
    
    // Initialize security components if available
    if (this.securityConfigManager) {
      this.clientAuthenticator = createClientAuthenticator(
        this.securityConfigManager.getClientAuthConfig(),
        logger
      );
      
      this.rateLimiter = createEnhancedRateLimiter(
        this.securityConfigManager.getRateLimitingConfig(),
        logger
      );
      
      this.inputSanitizer = createInputSanitizer(
        this.securityConfigManager.getInputSanitizationConfig(),
        logger
      );
      
      this.certificateManager = createCertificateManager(
        this.securityConfigManager.getCertificatePinningConfig(),
        logger
      );
      
      this.scopeManager = createScopeManager(
        this.securityConfigManager.getConfig().oauthScopes.tier,
        logger
      );
      
      logger.info('Security components initialized', {
        clientAuth: !!this.clientAuthenticator,
        rateLimiting: !!this.rateLimiter,
        inputSanitization: !!this.inputSanitizer,
        certificatePinning: !!this.certificateManager,
        scopeManagement: !!this.scopeManager,
      });
    }
    
    // Initialize services
    this.authService = new AuthService(config.spotify, logger);
    this.spotifyClient = new SpotifyClient(
      this.authService, 
      logger, 
      this.certificateManager
    );
    this.toolRegistry = new ToolRegistry(logger);
    this.requestHandler = new RequestHandler(
      this.toolRegistry,
      this.authService,
      logger,
      {
        clientAuthenticator: this.clientAuthenticator,
        rateLimiter: this.rateLimiter,
        inputSanitizer: this.inputSanitizer,
        scopeManager: this.scopeManager,
      }
    );
    
    // Set up request handlers
    this.setupHandlers();
    
    this.logger.info('MCP Server initialized', {
      name: 'spotify-mcp-server',
      version: '1.0.0',
      capabilities: ['tools']
    });
  }
  
  /**
   * Set up MCP protocol request handlers
   */
  private setupHandlers(): void {
    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Handling tools/list request');
      
      const tools = this.toolRegistry.getToolsForMCP();
      
      this.logger.info('Returning tool list', {
        toolCount: tools.length,
        toolNames: tools.map(t => t.name)
      });
      
      return {
        tools,
      };
    });
    
    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const clientId = 'mcp-client'; // Default client ID for MCP requests
      const userId = 'default-user'; // Default user ID - in production, extract from context
      
      this.logger.info('Handling tools/call request', {
        toolName: name,
        hasArguments: !!args,
        clientId,
        userId,
      });
      
      try {
        // Apply security checks if available
        if (this.securityConfigManager) {
          // Rate limiting check
          if (this.rateLimiter) {
            const rateLimitResult = await this.rateLimiter.checkRateLimit(userId, name, clientId);
            if (!rateLimitResult.allowed) {
              this.logger.warn('Rate limit exceeded', {
                toolName: name,
                userId,
                reason: rateLimitResult.reason,
              });
              
              // Log security event
              if ('logSecurityEvent' in this.logger) {
                (this.logger as SecureLogger).logSecurityEvent(createSecurityEvent(
                  'rate_limit',
                  'medium',
                  'Rate limit exceeded for tool execution',
                  { toolName: name, reason: rateLimitResult.reason },
                  userId,
                  clientId
                ));
              }
              
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: {
                      code: 'RATE_LIMITED',
                      message: rateLimitResult.reason || 'Rate limit exceeded',
                      retryAfter: rateLimitResult.retryAfter,
                    },
                  }, null, 2),
                }],
                isError: true,
              };
            }
            
            // Record the request
            this.rateLimiter.recordRequest(userId, true, name, clientId);
          }
          
          // Input sanitization
          if (this.inputSanitizer && args) {
            const sanitizedArgs = this.inputSanitizer.sanitizeInput(args);
            if (sanitizedArgs !== args) {
              this.logger.info('Input sanitized', {
                toolName: name,
                originalKeys: Object.keys((args as Record<string, unknown>) || {}),
                sanitizedKeys: Object.keys(sanitizedArgs || {}),
              });
            }
          }
        }
        
        const result = await this.requestHandler.handleToolCall(name, args, { userId, clientId });
        
        this.logger.info('Tool execution successful', {
          toolName: name,
          success: result.success,
          userId,
          clientId,
        });
        
        // Complete rate limit tracking
        if (this.rateLimiter) {
          this.rateLimiter.completeRequest();
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logger.error('Tool execution failed', {
          toolName: name,
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          clientId,
        });
        
        // Record failed request for rate limiting
        if (this.rateLimiter) {
          this.rateLimiter.recordRequest(userId, false, name, clientId);
          this.rateLimiter.completeRequest();
        }
        
        // Log security event for errors
        if (this.securityConfigManager && 'logSecurityEvent' in this.logger) {
          (this.logger as SecureLogger).logSecurityEvent(createSecurityEvent(
            'error',
            'low',
            'Tool execution failed',
            { 
              toolName: name, 
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            userId,
            clientId
          ));
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'TOOL_EXECUTION_ERROR',
                  message: error instanceof Error ? error.message : 'Tool execution failed',
                  toolName: name,
                },
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
    
    this.logger.debug('Request handlers configured');
  }
  
  /**
   * Register all available tools
   */
  async registerTools(): Promise<void> {
    this.logger.info('Registering MCP tools');
    
    try {
      // Register health check tool
      const healthTool = {
        name: 'health_check',
        description: 'Check the health status of the Spotify MCP server',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
        execute: async (): Promise<ToolResult> => {
          const authStatus = await this.authService.getAuthStatus();
          
          return {
            success: true,
            data: {
              server: 'healthy',
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              authentication: {
                configured: true,
                authenticated: authStatus.authenticated,
                message: authStatus.message,
              },
            },
          };
        },
      };
      
      this.toolRegistry.registerTool(healthTool);
      
      // Register playback control tools
      const playbackTools = createPlaybackTools(this.spotifyClient);
      playbackTools.forEach(tool => this.toolRegistry.registerTool(tool));
      
      // Register search tools
      const searchTools = createSearchTools(this.spotifyClient);
      searchTools.forEach(tool => this.toolRegistry.registerTool(tool));
      
      // Register queue management tools
      const queueTools = createQueueTools(this.spotifyClient);
      queueTools.forEach(tool => this.toolRegistry.registerTool(tool));
      
      // Register status and authentication tools
      const statusTools = createStatusTools(this.spotifyClient, this.authService);
      statusTools.forEach(tool => this.toolRegistry.registerTool(tool));
      
      // Register user insights tools
      const insightsTools = createInsightsTools(this.spotifyClient);
      insightsTools.forEach(tool => this.toolRegistry.registerTool(tool));
      
      const registeredTools = this.toolRegistry.listTools();
      this.logger.info('Tool registration complete', {
        registeredTools: registeredTools.map(t => t.name),
        totalTools: registeredTools.length,
        categories: {
          health: 1,
          playback: playbackTools.length,
          search: searchTools.length,
          queue: queueTools.length,
          status: statusTools.length,
          insights: insightsTools.length,
        },
      });
      
    } catch (error) {
      this.logger.error('Failed to register tools', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    this.logger.info('Starting MCP server');
    
    try {
      // Initialize certificate pinning if available
      if (this.certificateManager) {
        try {
          await this.certificateManager.initializeCertificatePins();
          this.logger.info('Certificate pinning initialized');
        } catch (error) {
          this.logger.warn('Certificate pinning initialization failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      // Register tools
      await this.registerTools();
      
      // Connect transport to server
      await this.server.connect(this.transport);
      
      this.logger.info('MCP server started successfully');
      
      // Handle graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      this.logger.error('Failed to start MCP server', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping MCP server');
    
    try {
      // Cleanup auth service
      await this.authService.cleanup();
      
      // Close server connection
      await this.server.close();
      
      this.logger.info('MCP server stopped successfully');
      process.exit(0);
      
    } catch (error) {
      this.logger.error('Error stopping MCP server', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      process.exit(1);
    }
  }
}