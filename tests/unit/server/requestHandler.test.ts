/**
 * Unit tests for RequestHandler
 * 
 * Tests request processing, input validation, tool execution,
 * error handling, and context management for MCP tool requests.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RequestHandler } from '../../../src/server/requestHandler.js';
import { ToolRegistry } from '../../../src/server/toolRegistry.js';
import { AuthService } from '../../../src/auth/authService.js';
import { SpotifyClient } from '../../../src/spotify/client.js';
import { mockLogger } from '../../setup.js';
import { mockAuthConfig } from '../../fixtures/authData.js';
import type { MCPTool, ToolResult, AuthStatus } from '../../../src/types/index.js';
import { z } from 'zod';

// Mock dependencies
jest.mock('../../../src/server/toolRegistry.js');
jest.mock('../../../src/auth/authService.js');
jest.mock('../../../src/spotify/client.js');

const MockedToolRegistry = ToolRegistry as jest.MockedClass<typeof ToolRegistry>;
const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const MockedSpotifyClient = SpotifyClient as jest.MockedClass<typeof SpotifyClient>;

describe('RequestHandler', () => {
  let requestHandler: RequestHandler;
  let mockToolRegistry: jest.Mocked<ToolRegistry>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSpotifyClient: jest.Mocked<SpotifyClient>;

  // Mock tools for testing
  const mockSimpleTool: MCPTool = {
    name: 'simple_tool',
    description: 'A simple test tool',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: { result: 'simple tool executed' },
    }),
  };

  const mockValidatedTool: MCPTool = {
    name: 'validated_tool',
    description: 'A tool with Zod validation',
    inputSchema: z.object({
      name: z.string(),
      count: z.number().optional(),
    }),
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: { validated: true },
    }),
  };

  const mockFailingTool: MCPTool = {
    name: 'failing_tool',
    description: 'A tool that fails',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: jest.fn().mockRejectedValue(new Error('Tool execution failed')),
  };

  const mockAuthTool: MCPTool = {
    name: 'auth_required_tool',
    description: 'A tool that requires authentication',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: jest.fn().mockRejectedValue(new Error('Please authenticate with Spotify first')),
  };

  const mockRateLimitTool: MCPTool = {
    name: 'rate_limit_tool',
    description: 'A tool that hits rate limits',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: jest.fn().mockRejectedValue(new Error('Spotify API rate limit exceeded')),
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockToolRegistry = {
      getTool: jest.fn(),
      hasTool: jest.fn(),
      getToolNames: jest.fn(),
      registerTool: jest.fn(),
      listTools: jest.fn(),
    } as any;

    mockAuthService = {
      getAuthStatus: jest.fn(),
      getAccessToken: jest.fn(),
      isAuthenticated: jest.fn(),
    } as any;

    mockSpotifyClient = {
      getCurrentPlayback: jest.fn(),
    } as any;

    // Mock constructor implementations
    MockedToolRegistry.mockImplementation(() => mockToolRegistry);
    MockedAuthService.mockImplementation(() => mockAuthService);
    MockedSpotifyClient.mockImplementation(() => mockSpotifyClient);

    // Setup default mock behaviors
    const mockAuthStatus: AuthStatus = {
      authenticated: true,
      hasValidToken: true,
      tokenExpired: false,
      userId: 'test-user',
      message: 'Authenticated',
    };
    mockAuthService.getAuthStatus.mockResolvedValue(mockAuthStatus);
    mockToolRegistry.getToolNames.mockReturnValue(['simple_tool', 'validated_tool']);

    // Create request handler instance
    requestHandler = new RequestHandler(mockToolRegistry, mockAuthService, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with all dependencies', () => {
      // RequestHandler constructor accepts instances, not configs
      expect(requestHandler).toBeDefined();
      // Verify Spotify client was created during construction
      expect(MockedSpotifyClient).toHaveBeenCalledWith(mockAuthService, mockLogger);
    });

    it('should create Spotify client during initialization', () => {
      expect(MockedSpotifyClient).toHaveBeenCalledWith(mockAuthService, mockLogger);
    });
  });

  describe('Tool Execution', () => {
    it('should execute simple tool successfully', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockSimpleTool);

      const result = await requestHandler.handleToolCall('simple_tool', {});

      expect(result).toEqual({
        success: true,
        data: { result: 'simple tool executed' },
      });

      expect(mockSimpleTool.execute).toHaveBeenCalledWith({});
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing tool',
        { toolName: 'simple_tool', hasInput: true }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool execution completed',
        expect.objectContaining({
          toolName: 'simple_tool',
          success: true,
          duration: expect.any(Number),
        })
      );
    });

    it('should handle tool returning raw data', async () => {
      const rawDataTool: MCPTool = {
        ...mockSimpleTool,
        execute: jest.fn().mockResolvedValue({ message: 'raw data' }),
      };
      mockToolRegistry.getTool.mockReturnValue(rawDataTool);

      const result = await requestHandler.handleToolCall('simple_tool', {});

      expect(result).toEqual({
        success: true,
        data: { message: 'raw data' },
      });
    });

    it('should handle tool with no input', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockSimpleTool);

      const result = await requestHandler.handleToolCall('simple_tool', null);

      expect(result.success).toBe(true);
      expect(mockSimpleTool.execute).toHaveBeenCalledWith(null);
    });
  });

  describe('Input Validation', () => {
    it('should validate input with Zod schema', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockValidatedTool);

      const validInput = { name: 'test', count: 5 };
      const result = await requestHandler.handleToolCall('validated_tool', validInput);

      expect(result).toEqual({
        success: true,
        data: { validated: true },
      });

      expect(mockValidatedTool.execute).toHaveBeenCalledWith(validInput);
    });

    it('should handle Zod validation errors', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockValidatedTool);

      const invalidInput = { name: 123, count: 'invalid' }; // Wrong types

      const result = await requestHandler.handleToolCall('validated_tool', invalidInput);

      expect(result).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: expect.any(Array),
        },
      });

      expect(mockValidatedTool.execute).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Input validation failed',
        expect.objectContaining({
          toolName: 'validated_tool',
          errors: expect.any(Array),
        })
      );
    });

    it('should handle missing required fields in Zod validation', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockValidatedTool);

      const invalidInput = { count: 5 }; // Missing required 'name' field

      const result = await requestHandler.handleToolCall('validated_tool', invalidInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should pass validation with optional fields', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockValidatedTool);

      const validInput = { name: 'test' }; // Optional 'count' field omitted

      const result = await requestHandler.handleToolCall('validated_tool', validInput);

      expect(result.success).toBe(true);
      expect(mockValidatedTool.execute).toHaveBeenCalledWith(validInput);
    });
  });

  describe('Error Handling', () => {
    it('should handle tool not found', async () => {
      mockToolRegistry.getTool.mockReturnValue(undefined);

      const result = await requestHandler.handleToolCall('non_existent_tool', {});

      expect(result).toEqual({
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: "Tool 'non_existent_tool' is not registered",
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Tool not found',
        { toolName: 'non_existent_tool' }
      );
    });

    it('should handle tool execution failure', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockFailingTool);

      const result = await requestHandler.handleToolCall('failing_tool', {});

      expect(result).toEqual({
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: 'Tool execution failed',
          retryable: false,
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Tool execution error',
        expect.objectContaining({
          toolName: 'failing_tool',
          error: 'Tool execution failed',
          duration: expect.any(Number),
        })
      );
    });

    it('should handle authentication errors', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockAuthTool);

      const result = await requestHandler.handleToolCall('auth_required_tool', {});

      expect(result).toEqual({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Please authenticate with Spotify first',
          retryable: false,
        },
      });
    });

    it('should handle rate limit errors', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockRateLimitTool);

      const result = await requestHandler.handleToolCall('rate_limit_tool', {});

      expect(result).toEqual({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Spotify API rate limit exceeded. Please try again later.',
          retryable: true,
        },
      });
    });

    it('should handle non-Error exceptions', async () => {
      const stringErrorTool: MCPTool = {
        ...mockSimpleTool,
        execute: jest.fn().mockRejectedValue('String error'),
      };
      mockToolRegistry.getTool.mockReturnValue(stringErrorTool);

      const result = await requestHandler.handleToolCall('simple_tool', {});

      expect(result).toEqual({
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: 'Tool execution failed',
          retryable: false,
        },
      });
    });

    it('should handle validation errors from non-Zod schemas', async () => {
      const nonZodTool: MCPTool = {
        ...mockValidatedTool,
        inputSchema: z.string().refine(() => {
          throw new Error('Custom validation error');
        }),
      };
      mockToolRegistry.getTool.mockReturnValue(nonZodTool);

      const result = await requestHandler.handleToolCall('validated_tool', 'test');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
    });
  });

  describe('Tool Access Validation', () => {
    it('should validate existing tool access', async () => {
      mockToolRegistry.hasTool.mockReturnValue(true);

      const result = await requestHandler.validateToolAccess('simple_tool');

      expect(result).toEqual({ valid: true });
    });

    it('should reject access to non-existent tool', async () => {
      mockToolRegistry.hasTool.mockReturnValue(false);

      const result = await requestHandler.validateToolAccess('non_existent_tool');

      expect(result).toEqual({
        valid: false,
        error: "Tool 'non_existent_tool' does not exist",
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide request handler statistics', () => {
      mockToolRegistry.getToolNames.mockReturnValue(['tool1', 'tool2', 'tool3']);

      const stats = requestHandler.getStats();

      expect(stats).toEqual({
        registeredTools: 3,
        spotifyClientConnected: true,
        authServiceAvailable: true,
      });
    });

    it('should track execution timing', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockSimpleTool);

      await requestHandler.handleToolCall('simple_tool', {});

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool execution completed',
        expect.objectContaining({
          duration: expect.any(Number),
        })
      );
    });

    it('should track failed execution timing', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockFailingTool);

      await requestHandler.handleToolCall('failing_tool', {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Tool execution error',
        expect.objectContaining({
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('Context Management', () => {
    it('should check authentication status during context creation', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockSimpleTool);

      await requestHandler.handleToolCall('simple_tool', {});

      expect(mockAuthService.getAuthStatus).toHaveBeenCalled();
    });

    it('should handle unauthenticated context', async () => {
      const unauthenticatedStatus: AuthStatus = {
        authenticated: false,
        hasValidToken: false,
        tokenExpired: true,
        userId: null,
        message: 'Not authenticated',
      };
      mockAuthService.getAuthStatus.mockResolvedValue(unauthenticatedStatus);

      const authRequiredTool: MCPTool = {
        ...mockSimpleTool,
        execute: jest.fn().mockRejectedValue(new Error('Authentication required. Please authenticate with Spotify first.')),
      };
      mockToolRegistry.getTool.mockReturnValue(authRequiredTool);

      const result = await requestHandler.handleToolCall('simple_tool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input gracefully', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockSimpleTool);

      const result = await requestHandler.handleToolCall('simple_tool', null);

      expect(result.success).toBe(true);
      expect(mockSimpleTool.execute).toHaveBeenCalledWith(null);
    });

    it('should handle undefined input gracefully', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockSimpleTool);

      const result = await requestHandler.handleToolCall('simple_tool', undefined);

      expect(result.success).toBe(true);
      expect(mockSimpleTool.execute).toHaveBeenCalledWith(undefined);
    });

    it('should handle tools with complex return types', async () => {
      const complexReturnTool: MCPTool = {
        ...mockSimpleTool,
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: {
            nested: {
              array: [1, 2, 3],
              object: { key: 'value' },
            },
            timestamp: new Date(),
          },
          metadata: {
            executionTime: 150,
            version: '1.0.0',
          },
        }),
      };
      mockToolRegistry.getTool.mockReturnValue(complexReturnTool);

      const result = await requestHandler.handleToolCall('simple_tool', {});

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle concurrent tool executions', async () => {
      mockToolRegistry.getTool.mockReturnValue(mockSimpleTool);

      const promises = [
        requestHandler.handleToolCall('simple_tool', { id: 1 }),
        requestHandler.handleToolCall('simple_tool', { id: 2 }),
        requestHandler.handleToolCall('simple_tool', { id: 3 }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(mockSimpleTool.execute).toHaveBeenCalledTimes(3);
    });
  });
});