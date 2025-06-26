/**
 * Integration tests for MCP (Model Context Protocol) implementation
 * 
 * Tests the complete MCP protocol handling including:
 * - Tool discovery and registration
 * - Request/response validation
 * - Error handling and protocol compliance
 * - Tool execution workflows
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPServer } from '../../src/server/mcpServer.js';
import { ToolRegistry } from '../../src/server/toolRegistry.js';
import { SpotifyClient } from '../../src/spotify/client.js';
import { AuthService } from '../../src/auth/authService.js';
import { AuthManager } from '../../src/auth/authManager.js';
import { createMockLogger } from '../fixtures/mockLogger.js';
import { 
  mockPlaybackState,
  mockSearchResults,
  mockQueueState,
  mockDevicesResponse,
  mockUserProfile 
} from '../fixtures/spotifyData.js';
import axios from 'axios';

// Mock external dependencies
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MCP Protocol Integration Tests', () => {
  let mcpServer: MCPServer;
  let toolRegistry: ToolRegistry;
  let spotifyClient: SpotifyClient;
  let authService: AuthService;
  let authManager: AuthManager;
  let mockLogger: any;

  const mockConfig = {
    server: {
      name: 'spotify-mcp-server',
      version: '1.0.0',
      port: 3000,
    },
    spotify: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:8080/callback',
      scopes: ['user-read-playback-state', 'user-modify-playback-state'],
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();

    // Initialize core components
    authManager = new AuthManager(mockConfig.spotify, mockLogger);
    authService = new AuthService(authManager, mockLogger);

    spotifyClient = new SpotifyClient(
      mockConfig.spotify,
      authManager,
      mockLogger
    );

    toolRegistry = new ToolRegistry(mockLogger);
    mcpServer = new MCPServer(mockConfig, toolRegistry, authService, spotifyClient, mockLogger);

    // Initialize server
    await mcpServer.initialize();
  });

  afterEach(async () => {
    await mcpServer?.shutdown();
    jest.restoreAllMocks();
  });

  describe('Tool Discovery and Registration', () => {
    it('should register all Spotify tools on initialization', async () => {
      const tools = await toolRegistry.listTools();

      // Verify all 25 tools are registered
      expect(tools).toHaveLength(25);

      // Verify tool categories
      const toolNames = tools.map(tool => tool.name);
      
      // Playback tools (9)
      expect(toolNames).toContain('play');
      expect(toolNames).toContain('pause');
      expect(toolNames).toContain('skip_next');
      expect(toolNames).toContain('skip_previous');
      expect(toolNames).toContain('set_volume');
      expect(toolNames).toContain('set_shuffle');
      expect(toolNames).toContain('set_repeat');
      expect(toolNames).toContain('seek');
      expect(toolNames).toContain('transfer_playback');

      // Search tools (7)
      expect(toolNames).toContain('search_tracks');
      expect(toolNames).toContain('search_albums');
      expect(toolNames).toContain('search_playlists');
      expect(toolNames).toContain('search_artists');
      expect(toolNames).toContain('get_track');
      expect(toolNames).toContain('get_album');
      expect(toolNames).toContain('get_featured_playlists');

      // Queue tools (4)
      expect(toolNames).toContain('add_to_queue');
      expect(toolNames).toContain('get_queue');
      expect(toolNames).toContain('add_playlist_to_queue');
      expect(toolNames).toContain('clear_queue');

      // Status tools (5)
      expect(toolNames).toContain('get_playback_status');
      expect(toolNames).toContain('get_devices');
      expect(toolNames).toContain('get_user_profile');
      expect(toolNames).toContain('authenticate');
      expect(toolNames).toContain('get_auth_status');
    });

    it('should provide tool schemas for all registered tools', async () => {
      const tools = await toolRegistry.listTools();

      for (const tool of tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        
        // Verify schema structure
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });

  describe('MCP Request Handling', () => {
    beforeEach(async () => {
      // Setup authenticated user for tool execution
      await authManager.storeTokens('test-user', {
        accessToken: 'valid_access_token',
        refreshToken: 'valid_refresh_token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        scope: 'user-read-playback-state user-modify-playback-state',
      });
    });

    it('should handle tools/list request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      const response = await mcpServer.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toHaveLength(25);
      expect(response.error).toBeUndefined();
    });

    it('should handle tools/call request for playback control', async () => {
      // Mock Spotify API response
      mockedAxios.put.mockResolvedValueOnce({
        status: 204,
        data: {},
      });

      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'play',
          arguments: {
            deviceId: 'test-device-123',
          },
        },
      };

      const response = await mcpServer.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect(response.result.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('Playback started successfully'),
      }]);
      expect(response.error).toBeUndefined();
    });

    it('should handle tools/call request for search', async () => {
      // Mock Spotify API response
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: mockSearchResults,
      });

      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_tracks',
          arguments: {
            query: 'test song',
            limit: 5,
          },
        },
      };

      const response = await mcpServer.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);
      expect(response.result).toBeDefined();
      expect(response.result.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('Found 2 tracks'),
      }]);
    });

    it('should handle invalid tool calls with proper error responses', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {},
        },
      };

      const response = await mcpServer.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(4);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601); // Method not found
      expect(response.error!.message).toContain('Tool not found');
    });

    it('should validate tool arguments against schema', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'set_volume',
          arguments: {
            volume: 150, // Invalid: exceeds max of 100
          },
        },
      };

      const response = await mcpServer.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(5);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // Invalid params
    });
  });

  describe('Error Handling and Protocol Compliance', () => {
    it('should handle malformed JSON-RPC requests', async () => {
      const malformedRequest = {
        // Missing required jsonrpc field
        id: 6,
        method: 'tools/list',
      };

      const response = await mcpServer.handleRequest(malformedRequest as any);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(6);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32600); // Invalid request
    });

    it('should handle authentication errors gracefully', async () => {
      // Don't setup authenticated user - simulate unauthenticated state

      const request = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'get_playback_status',
          arguments: {},
        },
      };

      const response = await mcpServer.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(7);
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);
      expect(response.result.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('Authentication required'),
      }]);
    });

    it('should handle Spotify API rate limiting', async () => {
      // Setup authenticated user
      await authManager.storeTokens('test-user', {
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        scope: 'user-read-playback-state',
      });

      // Mock rate limit error
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 429,
          headers: {
            'retry-after': '30',
          },
          data: {
            error: {
              status: 429,
              message: 'API rate limit exceeded',
            },
          },
        },
      });

      const request = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'get_playback_status',
          arguments: {},
        },
      };

      const response = await mcpServer.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(8);
      expect(response.result).toBeDefined();
      expect(response.result.isError).toBe(true);
      expect(response.result.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('Rate limit exceeded'),
      }]);
    });
  });

  describe('Tool Execution Workflows', () => {
    beforeEach(async () => {
      // Setup authenticated user
      await authManager.storeTokens('test-user', {
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
        scope: 'user-read-playback-state user-modify-playback-state',
      });
    });

    it('should execute complete playback workflow', async () => {
      // Mock API responses for playback workflow
      mockedAxios.put.mockResolvedValue({ status: 204, data: {} }); // play
      mockedAxios.get.mockResolvedValue({ status: 200, data: mockPlaybackState }); // status

      // Step 1: Start playback
      const playRequest = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'play',
          arguments: {},
        },
      };

      const playResponse = await mcpServer.handleRequest(playRequest);
      expect(playResponse.result.isError).toBeFalsy();

      // Step 2: Check playback status
      const statusRequest = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'get_playback_status',
          arguments: {},
        },
      };

      const statusResponse = await mcpServer.handleRequest(statusRequest);
      expect(statusResponse.result.isError).toBeFalsy();
      expect(statusResponse.result.content[0].text).toContain('Currently playing');
    });

    it('should execute queue management workflow', async () => {
      // Mock API responses
      mockedAxios.post.mockResolvedValue({ status: 204, data: {} }); // add to queue
      mockedAxios.get.mockResolvedValue({ status: 200, data: mockQueueState }); // get queue

      // Step 1: Add track to queue
      const addRequest = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'add_to_queue',
          arguments: {
            uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
          },
        },
      };

      const addResponse = await mcpServer.handleRequest(addRequest);
      expect(addResponse.result.isError).toBeFalsy();

      // Step 2: View queue
      const queueRequest = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'get_queue',
          arguments: {
            limit: 10,
          },
        },
      };

      const queueResponse = await mcpServer.handleRequest(queueRequest);
      expect(queueResponse.result.isError).toBeFalsy();
      expect(queueResponse.result.content[0].text).toContain('2 tracks in queue');
    });

    it('should handle concurrent tool executions', async () => {
      // Mock API responses for multiple concurrent calls
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockPlaybackState })
        .mockResolvedValueOnce({ status: 200, data: mockDevicesResponse })
        .mockResolvedValueOnce({ status: 200, data: mockUserProfile });

      // Execute multiple tools concurrently
      const requests = [
        {
          jsonrpc: '2.0',
          id: 14,
          method: 'tools/call',
          params: { name: 'get_playback_status', arguments: {} },
        },
        {
          jsonrpc: '2.0',
          id: 15,
          method: 'tools/call',
          params: { name: 'get_devices', arguments: {} },
        },
        {
          jsonrpc: '2.0',
          id: 16,
          method: 'tools/call',
          params: { name: 'get_user_profile', arguments: {} },
        },
      ];

      const responses = await Promise.all(
        requests.map(req => mcpServer.handleRequest(req))
      );

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(14 + index);
        expect(response.result.isError).toBeFalsy();
      });
    });
  });

  describe('Server Lifecycle', () => {
    it('should initialize and shutdown cleanly', async () => {
      // Server should be already initialized from beforeEach
      expect(mcpServer).toBeDefined();

      // Should be able to handle requests
      const request = {
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/list',
        params: {},
      };

      const response = await mcpServer.handleRequest(request);
      expect(response.result).toBeDefined();

      // Should shutdown cleanly
      await mcpServer.shutdown();

      // Should not be able to handle requests after shutdown
      const postShutdownResponse = await mcpServer.handleRequest(request);
      expect(postShutdownResponse.error).toBeDefined();
      expect(postShutdownResponse.error!.code).toBe(-32600); // Invalid request
    });

    it('should handle initialization errors gracefully', async () => {
      // Create server with invalid configuration
      const invalidConfig = {
        ...mockConfig,
        spotify: {
          ...mockConfig.spotify,
          clientId: '', // Invalid empty client ID
        },
      };

      const invalidServer = new MCPServer(
        invalidConfig,
        toolRegistry,
        authService,
        spotifyClient,
        mockLogger
      );

      // Initialization should handle the invalid config
      await expect(invalidServer.initialize()).resolves.not.toThrow();
      
      await invalidServer.shutdown();
    });
  });
});