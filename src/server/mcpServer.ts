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
import {
  createPlaybackTools,
  createSearchTools,
  createQueueTools,
  createStatusTools,
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
  
  constructor(config: ServerConfig, logger: Logger) {
    this.logger = logger;
    
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
    
    // Initialize services
    this.authService = new AuthService(config.spotify, logger);
    this.spotifyClient = new SpotifyClient(this.authService, logger);
    this.toolRegistry = new ToolRegistry(logger);
    this.requestHandler = new RequestHandler(
      this.toolRegistry,
      this.authService,
      logger
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
      
      this.logger.info('Handling tools/call request', {
        toolName: name,
        hasArguments: !!args
      });
      
      try {
        const result = await this.requestHandler.handleToolCall(name, args);
        
        this.logger.info('Tool execution successful', {
          toolName: name,
          success: result.success
        });
        
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
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
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