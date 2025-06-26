/**
 * Unit tests for MCPServer
 * 
 * Tests the main MCP server implementation including tool registration,
 * request handling, and server lifecycle management.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPServer } from '../../../src/server/mcpServer.js';
import { ToolRegistry } from '../../../src/server/toolRegistry.js';
import { RequestHandler } from '../../../src/server/requestHandler.js';
import { AuthService } from '../../../src/auth/authService.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { mockLogger } from '../../setup.js';
import { mockServerConfig } from '../../fixtures/serverData.js';
import type { ServerConfig, ToolResult } from '../../../src/types/index.js';

// Mock external dependencies
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('../../../src/server/toolRegistry.js');
jest.mock('../../../src/server/requestHandler.js');
jest.mock('../../../src/auth/authService.js');
jest.mock('../../../src/spotify/client.js');
// Mock tool creation functions first
const mockPlaybackTools = [
  { name: 'play', description: 'Start playback', inputSchema: {}, execute: jest.fn() },
  { name: 'pause', description: 'Pause playback', inputSchema: {}, execute: jest.fn() },
];

const mockSearchTools = [
  { name: 'search', description: 'Search tracks', inputSchema: {}, execute: jest.fn() },
];

const mockQueueTools = [
  { name: 'add_to_queue', description: 'Add track to queue', inputSchema: {}, execute: jest.fn() },
];

const mockStatusTools = [
  { name: 'get_status', description: 'Get playback status', inputSchema: {}, execute: jest.fn() },
];

// Mock MCP SDK
const mockServer = {
  setRequestHandler: jest.fn(),
  connect: jest.fn(),
  close: jest.fn(),
};

const mockTransport = {
  start: jest.fn(),
  stop: jest.fn(),
};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => mockServer),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => mockTransport),
}));

jest.mock('../../../src/tools/playback.js');
jest.mock('../../../src/tools/search.js');
jest.mock('../../../src/tools/queue.js');
jest.mock('../../../src/tools/status.js');

jest.mock('../../../src/tools/index.js', () => ({
  createPlaybackTools: jest.fn(),
  createSearchTools: jest.fn(),
  createQueueTools: jest.fn(),
  createStatusTools: jest.fn(),
}));

const MockedToolRegistry = ToolRegistry as jest.MockedClass<typeof ToolRegistry>;
const MockedRequestHandler = RequestHandler as jest.MockedClass<typeof RequestHandler>;
const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const MockedSpotifyClient = SpotifyClient as jest.MockedClass<typeof SpotifyClient>;

describe('MCPServer', () => {
  let mcpServer: MCPServer;
  let mockToolRegistry: jest.Mocked<ToolRegistry>;
  let mockRequestHandler: jest.Mocked<RequestHandler>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockToolRegistry = {
      registerTool: jest.fn(),
      listTools: jest.fn(),
      getTool: jest.fn(),
      hasTools: jest.fn(),
    } as any;

    mockRequestHandler = {
      handleToolCall: jest.fn(),
    } as any;

    mockAuthService = {
      getAuthStatus: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    mockSpotifyClient = {
      getCurrentPlayback: jest.fn(),
    } as any;

    // Mock constructor implementations
    MockedToolRegistry.mockImplementation(() => mockToolRegistry);
    MockedRequestHandler.mockImplementation(() => mockRequestHandler);
    MockedAuthService.mockImplementation(() => mockAuthService);
    MockedSpotifyClient.mockImplementation(() => mockSpotifyClient);

    // Setup tool creation function mocks
    const { createPlaybackTools, createSearchTools, createQueueTools, createStatusTools } = 
      require('../../../src/tools/index.js');
    
    createPlaybackTools.mockReturnValue(mockPlaybackTools);
    createSearchTools.mockReturnValue(mockSearchTools);
    createQueueTools.mockReturnValue(mockQueueTools);
    createStatusTools.mockReturnValue(mockStatusTools);

    // Setup default mock behaviors
    mockToolRegistry.listTools.mockReturnValue([]);
    mockAuthService.getAuthStatus.mockResolvedValue({
      authenticated: true,
      hasValidToken: true,
      tokenExpired: false,
      userId: 'test-user',
      message: 'Authenticated',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize MCP server with all components', () => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);

      expect(MockedToolRegistry).toHaveBeenCalledWith(mockLogger);
      expect(MockedAuthService).toHaveBeenCalledWith(mockServerConfig.spotify, mockLogger);
      expect(MockedSpotifyClient).toHaveBeenCalledWith(mockAuthService, mockLogger);
      expect(MockedRequestHandler).toHaveBeenCalledWith(
        mockToolRegistry,
        mockAuthService,
        mockLogger
      );
    });

    it('should set up request handlers during initialization', () => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);

      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP Server initialized',
        expect.objectContaining({
          name: 'spotify-mcp-server',
          version: '1.0.0',
          capabilities: ['tools']
        })
      );
    });

    it('should create server with correct configuration', () => {
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
      
      mcpServer = new MCPServer(mockServerConfig, mockLogger);

      expect(Server).toHaveBeenCalledWith(
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
    });
  });

  describe('Tool Registration', () => {
    beforeEach(() => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);
    });

    it('should register all tool categories', async () => {
      await mcpServer.registerTools();

      // Health check tool
      expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'health_check',
          description: 'Check the health status of the Spotify MCP server',
        })
      );

      // Playback tools
      mockPlaybackTools.forEach(tool => {
        expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(tool);
      });

      // Search tools
      mockSearchTools.forEach(tool => {
        expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(tool);
      });

      // Queue tools
      mockQueueTools.forEach(tool => {
        expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(tool);
      });

      // Status tools
      mockStatusTools.forEach(tool => {
        expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(tool);
      });
    });

    it('should log tool registration progress', async () => {
      const mockTools = [
        { name: 'health_check', description: 'Health check' },
        { name: 'play', description: 'Play music' },
      ];
      mockToolRegistry.listTools.mockReturnValue(mockTools);

      await mcpServer.registerTools();

      expect(mockLogger.info).toHaveBeenCalledWith('Registering MCP tools');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool registration complete',
        expect.objectContaining({
          registeredTools: ['health_check', 'play'],
          totalTools: 2,
        })
      );
    });

    it('should handle tool registration errors', async () => {
      const error = new Error('Registration failed');
      mockToolRegistry.registerTool.mockImplementation(() => {
        throw error;
      });

      await expect(mcpServer.registerTools()).rejects.toThrow('Registration failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to register tools',
        { error: 'Registration failed' }
      );
    });

    it('should create health check tool with correct schema', async () => {
      await mcpServer.registerTools();

      const healthToolCall = mockToolRegistry.registerTool.mock.calls.find(
        call => call[0].name === 'health_check'
      );
      
      expect(healthToolCall).toBeDefined();
      expect(healthToolCall[0].inputSchema).toEqual({
        type: 'object',
        properties: {},
        required: [],
      });
    });

    it('should execute health check tool correctly', async () => {
      await mcpServer.registerTools();

      const healthToolCall = mockToolRegistry.registerTool.mock.calls.find(
        call => call[0].name === 'health_check'
      );
      
      const result = await healthToolCall[0].execute();
      
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          server: 'healthy',
          version: '1.0.0',
          authentication: expect.objectContaining({
            configured: true,
            authenticated: true,
          }),
        }),
      });
    });
  });

  describe('Request Handling', () => {
    beforeEach(() => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);
    });

    it('should handle list tools request', async () => {
      const mockTools = [
        { name: 'play', description: 'Play music', inputSchema: {} },
        { name: 'pause', description: 'Pause music', inputSchema: {} },
      ];
      mockToolRegistry.listTools.mockReturnValue(mockTools);

      // Get the list tools handler
      const listToolsHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/list'
      )?.[1];

      expect(listToolsHandler).toBeDefined();
      const result = await listToolsHandler();

      expect(result).toEqual({
        tools: [
          { name: 'play', description: 'Play music', inputSchema: {} },
          { name: 'pause', description: 'Pause music', inputSchema: {} },
        ],
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Returning tool list',
        expect.objectContaining({
          toolCount: 2,
          toolNames: ['play', 'pause'],
        })
      );
    });

    it('should handle tool call request successfully', async () => {
      const mockResult: ToolResult = {
        success: true,
        data: { message: 'Tool executed successfully' },
      };
      mockRequestHandler.handleToolCall.mockResolvedValue(mockResult);

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      expect(callToolHandler).toBeDefined();
      const result = await callToolHandler({
        params: { name: 'play', arguments: { device_id: 'test-device' } },
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResult, null, 2),
          },
        ],
      });

      expect(mockRequestHandler.handleToolCall).toHaveBeenCalledWith(
        'play',
        { device_id: 'test-device' }
      );
    });

    it('should handle tool call request with error', async () => {
      const error = new Error('Tool execution failed');
      mockRequestHandler.handleToolCall.mockRejectedValue(error);

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      expect(callToolHandler).toBeDefined();
      const result = await callToolHandler({
        params: { name: 'invalid_tool', arguments: {} },
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: 'TOOL_EXECUTION_ERROR',
                message: 'Tool execution failed',
                toolName: 'invalid_tool',
              },
            }, null, 2),
          },
        ],
        isError: true,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Tool execution failed',
        expect.objectContaining({
          toolName: 'invalid_tool',
          error: 'Tool execution failed',
        })
      );
    });
  });

  describe('Server Lifecycle', () => {
    beforeEach(() => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);
    });

    it('should start server successfully', async () => {
      await mcpServer.start();

      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting MCP server');
      expect(mockLogger.info).toHaveBeenCalledWith('MCP server started successfully');
    });

    it('should handle server start failure', async () => {
      const error = new Error('Failed to connect');
      mockServer.connect.mockRejectedValue(error);

      await expect(mcpServer.start()).rejects.toThrow('Failed to connect');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start MCP server',
        { error: 'Failed to connect' }
      );
    });

    it('should stop server gracefully', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await mcpServer.stop();
      } catch (error) {
        expect(error.message).toBe('process.exit called');
      }

      expect(mockAuthService.cleanup).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping MCP server');
      expect(mockLogger.info).toHaveBeenCalledWith('MCP server stopped successfully');
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle server stop failure', async () => {
      const error = new Error('Failed to stop');
      mockServer.close.mockRejectedValue(error);
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await mcpServer.stop();
      } catch (error) {
        expect(error.message).toBe('process.exit called');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error stopping MCP server',
        { error: 'Failed to stop' }
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should set up signal handlers on start', async () => {
      const mockOn = jest.spyOn(process, 'on').mockImplementation(() => process);

      await mcpServer.start();

      expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      mockOn.mockRestore();
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);
    });

    it('should handle multiple concurrent tool calls', async () => {
      const mockResult: ToolResult = { success: true, data: {} };
      mockRequestHandler.handleToolCall.mockResolvedValue(mockResult);

      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      const promises = [
        callToolHandler({ params: { name: 'play', arguments: {} } }),
        callToolHandler({ params: { name: 'pause', arguments: {} } }),
        callToolHandler({ params: { name: 'skip', arguments: {} } }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.content[0].text).toContain('"success": true');
      });
    });

    it('should handle tool registration and immediate execution', async () => {
      await mcpServer.registerTools();

      const mockResult: ToolResult = { success: true, data: { status: 'playing' } };
      mockRequestHandler.handleToolCall.mockResolvedValue(mockResult);

      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      const result = await callToolHandler({
        params: { name: 'play', arguments: {} },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"status": "playing"');
    });

    it('should handle server restart scenario', async () => {
      // Start server
      await mcpServer.start();
      expect(mockServer.connect).toHaveBeenCalled();

      // Stop server
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await mcpServer.stop();
      } catch (error) {
        expect(error.message).toBe('process.exit called');
      }

      expect(mockAuthService.cleanup).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();

      mockExit.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);
    });

    it('should handle unknown tool requests gracefully', async () => {
      const error = new Error('Unknown tool: invalid_tool');
      mockRequestHandler.handleToolCall.mockRejectedValue(error);

      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      const result = await callToolHandler({
        params: { name: 'invalid_tool', arguments: {} },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('TOOL_EXECUTION_ERROR');
      expect(result.content[0].text).toContain('invalid_tool');
    });

    it('should handle malformed tool requests', async () => {
      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      const result = await callToolHandler({
        params: { name: '', arguments: null },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('TOOL_EXECUTION_ERROR');
    });

    it('should handle non-Error exceptions', async () => {
      mockRequestHandler.handleToolCall.mockRejectedValue('String error');

      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      const result = await callToolHandler({
        params: { name: 'test_tool', arguments: {} },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tool execution failed');
    });
  });

  describe('Logging and Monitoring', () => {
    beforeEach(() => {
      mcpServer = new MCPServer(mockServerConfig, mockLogger);
    });

    it('should log detailed information during tool execution', async () => {
      const mockResult: ToolResult = { success: true, data: {} };
      mockRequestHandler.handleToolCall.mockResolvedValue(mockResult);

      const callToolHandler = mockServer.setRequestHandler.mock.calls.find(
        call => call[0].method === 'tools/call'
      )?.[1];

      await callToolHandler({
        params: { name: 'play', arguments: { device_id: 'test' } },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Handling tools/call request',
        { toolName: 'play', hasArguments: true }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool execution successful',
        { toolName: 'play', success: true }
      );
    });

    it('should log server state changes', async () => {
      await mcpServer.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting MCP server');
      expect(mockLogger.info).toHaveBeenCalledWith('Registering MCP tools');
      expect(mockLogger.info).toHaveBeenCalledWith('MCP server started successfully');
    });

    it('should log tool registration statistics', async () => {
      const mockTools = [
        { name: 'health_check', description: 'Health check' },
        { name: 'play', description: 'Play' },
        { name: 'pause', description: 'Pause' },
      ];
      mockToolRegistry.listTools.mockReturnValue(mockTools);

      await mcpServer.registerTools();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool registration complete',
        expect.objectContaining({
          registeredTools: ['health_check', 'play', 'pause'],
          totalTools: 3,
          categories: expect.any(Object),
        })
      );
    });
  });
});