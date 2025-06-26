/**
 * Unit tests for ToolRegistry
 * 
 * Tests tool registration, validation, discovery, and management
 * functionality for the MCP tool registry.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ToolRegistry } from '../../../src/server/toolRegistry.js';
import { mockLogger } from '../../setup.js';
import type { MCPTool, ToolResult } from '../../../src/types/index.js';

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;

  // Mock tools for testing
  const mockTool1: MCPTool = {
    name: 'test_tool_1',
    description: 'A test tool for unit testing',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string' },
      },
      required: ['param1'],
    },
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: { result: 'test1' },
    }),
  };

  const mockTool2: MCPTool = {
    name: 'playback_control',
    description: 'Control music playback',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
      },
      required: ['action'],
    },
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: { status: 'playing' },
    }),
  };

  const mockTool3: MCPTool = {
    name: 'search_tracks',
    description: 'Search for tracks on Spotify',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    execute: jest.fn().mockResolvedValue({
      success: true,
      data: { tracks: [] },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    toolRegistry = new ToolRegistry(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with empty tool registry', () => {
      expect(toolRegistry.listTools()).toHaveLength(0);
      expect(toolRegistry.getToolNames()).toHaveLength(0);
    });

    it('should initialize with logger', () => {
      expect(toolRegistry).toBeDefined();
      // Logger is private, but we can verify it's used in other methods
    });
  });

  describe('Tool Registration', () => {
    it('should register a valid tool', () => {
      toolRegistry.registerTool(mockTool1);

      expect(toolRegistry.hasTool('test_tool_1')).toBe(true);
      expect(toolRegistry.getTool('test_tool_1')).toBe(mockTool1);
      expect(toolRegistry.listTools()).toHaveLength(1);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool registered',
        {
          toolName: 'test_tool_1',
          description: 'A test tool for unit testing...',
        }
      );
    });

    it('should register multiple tools', () => {
      const tools = [mockTool1, mockTool2, mockTool3];
      toolRegistry.registerTools(tools);

      expect(toolRegistry.listTools()).toHaveLength(3);
      expect(toolRegistry.getToolNames()).toEqual([
        'test_tool_1',
        'playback_control',
        'search_tracks',
      ]);
    });

    it('should overwrite existing tool with warning', () => {
      toolRegistry.registerTool(mockTool1);
      
      const updatedTool: MCPTool = {
        ...mockTool1,
        description: 'Updated description',
      };
      
      toolRegistry.registerTool(updatedTool);

      expect(toolRegistry.listTools()).toHaveLength(1);
      expect(toolRegistry.getTool('test_tool_1')?.description).toBe('Updated description');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Tool already registered, overwriting',
        { toolName: 'test_tool_1' }
      );
    });

    it('should handle long descriptions in log messages', () => {
      const longDescriptionTool: MCPTool = {
        ...mockTool1,
        description: 'This is a very long description that should be truncated in the log message for better readability and to avoid cluttering the logs',
      };

      toolRegistry.registerTool(longDescriptionTool);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool registered',
        {
          toolName: 'test_tool_1',
          description: 'This is a very long description that should be tru...',
        }
      );
    });
  });

  describe('Tool Validation', () => {
    it('should reject tool without name', () => {
      const invalidTool = {
        ...mockTool1,
        name: '',
      };

      expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
        'Tool must have a valid name'
      );
    });

    it('should reject tool with invalid name type', () => {
      const invalidTool = {
        ...mockTool1,
        name: 123 as any,
      };

      expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
        'Tool must have a valid name'
      );
    });

    it('should reject tool without description', () => {
      const invalidTool = {
        ...mockTool1,
        description: '',
      };

      expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
        'Tool must have a valid description'
      );
    });

    it('should reject tool with invalid description type', () => {
      const invalidTool = {
        ...mockTool1,
        description: null as any,
      };

      expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
        'Tool must have a valid description'
      );
    });

    it('should reject tool without input schema', () => {
      const invalidTool = {
        ...mockTool1,
        inputSchema: null as any,
      };

      expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
        'Tool must have a valid input schema'
      );
    });

    it('should reject tool without execute function', () => {
      const invalidTool = {
        ...mockTool1,
        execute: null as any,
      };

      expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
        'Tool must have a valid execute function'
      );
    });

    it('should reject tool with invalid name format', () => {
      const invalidNames = [
        'TestTool',      // uppercase
        'test-tool',     // hyphens
        'test tool',     // spaces
        '1test_tool',    // starts with number
        'test_tool!',    // special characters
      ];

      invalidNames.forEach(name => {
        const invalidTool = {
          ...mockTool1,
          name,
        };

        expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
          'Tool name must be lowercase with underscores only'
        );
      });
    });

    it('should accept valid name formats', () => {
      const validNames = [
        'test_tool',
        'test_tool_123',
        'a',
        'tool_with_multiple_underscores',
      ];

      validNames.forEach(name => {
        const validTool = {
          ...mockTool1,
          name,
        };

        expect(() => toolRegistry.registerTool(validTool)).not.toThrow();
        toolRegistry.unregisterTool(name); // Clean up
      });
    });

    it('should reject input schema without type', () => {
      const invalidTool = {
        ...mockTool1,
        inputSchema: {
          properties: {},
        },
      };

      expect(() => toolRegistry.registerTool(invalidTool)).toThrow(
        'Tool input schema must have a type property'
      );
    });
  });

  describe('Tool Discovery', () => {
    beforeEach(() => {
      toolRegistry.registerTools([mockTool1, mockTool2, mockTool3]);
    });

    it('should find existing tool', () => {
      const tool = toolRegistry.getTool('test_tool_1');
      expect(tool).toBe(mockTool1);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = toolRegistry.getTool('non_existent_tool');
      expect(tool).toBeUndefined();
    });

    it('should check tool existence', () => {
      expect(toolRegistry.hasTool('test_tool_1')).toBe(true);
      expect(toolRegistry.hasTool('playback_control')).toBe(true);
      expect(toolRegistry.hasTool('non_existent_tool')).toBe(false);
    });

    it('should list all tools', () => {
      const tools = toolRegistry.listTools();
      expect(tools).toHaveLength(3);
      expect(tools).toContain(mockTool1);
      expect(tools).toContain(mockTool2);
      expect(tools).toContain(mockTool3);
    });

    it('should get all tool names', () => {
      const names = toolRegistry.getToolNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('test_tool_1');
      expect(names).toContain('playback_control');
      expect(names).toContain('search_tracks');
    });
  });

  describe('Tool Management', () => {
    beforeEach(() => {
      toolRegistry.registerTools([mockTool1, mockTool2, mockTool3]);
    });

    it('should unregister existing tool', () => {
      const result = toolRegistry.unregisterTool('test_tool_1');
      
      expect(result).toBe(true);
      expect(toolRegistry.hasTool('test_tool_1')).toBe(false);
      expect(toolRegistry.listTools()).toHaveLength(2);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tool unregistered',
        { toolName: 'test_tool_1' }
      );
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = toolRegistry.unregisterTool('non_existent_tool');
      expect(result).toBe(false);
    });

    it('should clear all tools', () => {
      toolRegistry.clearTools();
      
      expect(toolRegistry.listTools()).toHaveLength(0);
      expect(toolRegistry.getToolNames()).toHaveLength(0);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'All tools cleared',
        { count: 3 }
      );
    });
  });

  describe('Registry Statistics', () => {
    beforeEach(() => {
      toolRegistry.registerTools([mockTool1, mockTool2, mockTool3]);
    });

    it('should generate registry statistics', () => {
      const stats = toolRegistry.getStats();
      
      expect(stats.totalTools).toBe(3);
      expect(stats.toolNames).toEqual([
        'test_tool_1',
        'playback_control',
        'search_tracks',
      ]);
      expect(stats.categories).toEqual({
        test: 1,      // test_tool_1
        playback: 1,  // playback_control
        search: 1,    // search_tracks
      });
    });

    it('should handle tools without category prefix', () => {
      const simpleTool: MCPTool = {
        name: 'health',
        description: 'Health check',
        inputSchema: { type: 'object' },
        execute: jest.fn(),
      };

      toolRegistry.registerTool(simpleTool);
      const stats = toolRegistry.getStats();
      
      expect(stats.categories.health).toBe(1);
    });

    it('should handle empty registry statistics', () => {
      toolRegistry.clearTools();
      const stats = toolRegistry.getStats();
      
      expect(stats.totalTools).toBe(0);
      expect(stats.toolNames).toEqual([]);
      expect(stats.categories).toEqual({});
    });

    it('should group tools by category correctly', () => {
      const additionalTools: MCPTool[] = [
        {
          name: 'playback_play',
          description: 'Play music',
          inputSchema: { type: 'object' },
          execute: jest.fn(),
        },
        {
          name: 'playback_pause',
          description: 'Pause music',
          inputSchema: { type: 'object' },
          execute: jest.fn(),
        },
        {
          name: 'search_albums',
          description: 'Search albums',
          inputSchema: { type: 'object' },
          execute: jest.fn(),
        },
      ];

      toolRegistry.registerTools(additionalTools);
      const stats = toolRegistry.getStats();
      
      expect(stats.totalTools).toBe(6);
      expect(stats.categories.playback).toBe(3); // playback_control, playback_play, playback_pause
      expect(stats.categories.search).toBe(2);   // search_tracks, search_albums
      expect(stats.categories.test).toBe(1);     // test_tool_1
    });
  });

  describe('Edge Cases', () => {
    it('should handle tools with minimal valid schemas', () => {
      const minimalTool: MCPTool = {
        name: 'minimal_tool',
        description: 'Minimal test tool',
        inputSchema: { type: 'object' },
        execute: jest.fn(),
      };

      expect(() => toolRegistry.registerTool(minimalTool)).not.toThrow();
      expect(toolRegistry.hasTool('minimal_tool')).toBe(true);
    });

    it('should handle empty tool arrays', () => {
      toolRegistry.registerTools([]);
      expect(toolRegistry.listTools()).toHaveLength(0);
    });

    it('should handle registration of identical tools', () => {
      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(mockTool1); // Same instance
      
      expect(toolRegistry.listTools()).toHaveLength(1);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('should handle complex input schemas', () => {
      const complexTool: MCPTool = {
        name: 'complex_tool',
        description: 'Tool with complex schema',
        inputSchema: {
          type: 'object',
          properties: {
            required_string: { type: 'string' },
            optional_number: { type: 'number' },
            nested_object: {
              type: 'object',
              properties: {
                inner_prop: { type: 'boolean' },
              },
            },
            array_prop: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['required_string'],
        },
        execute: jest.fn(),
      };

      expect(() => toolRegistry.registerTool(complexTool)).not.toThrow();
      expect(toolRegistry.getTool('complex_tool')).toBe(complexTool);
    });
  });

  describe('Error Handling', () => {
    it('should handle null tool gracefully', () => {
      expect(() => toolRegistry.registerTool(null as any)).toThrow();
    });

    it('should handle undefined tool gracefully', () => {
      expect(() => toolRegistry.registerTool(undefined as any)).toThrow();
    });

    it('should handle tool with circular references in schema', () => {
      const circularSchema: any = { type: 'object' };
      circularSchema.self = circularSchema;

      const circularTool: MCPTool = {
        name: 'circular_tool',
        description: 'Tool with circular schema',
        inputSchema: circularSchema,
        execute: jest.fn(),
      };

      // Should not throw during registration
      expect(() => toolRegistry.registerTool(circularTool)).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent registrations', () => {
      const tools = Array.from({ length: 10 }, (_, i) => ({
        name: `concurrent_tool_${i}`,
        description: `Concurrent tool ${i}`,
        inputSchema: { type: 'object' },
        execute: jest.fn(),
      }));

      // Register tools concurrently
      tools.forEach(tool => toolRegistry.registerTool(tool));

      expect(toolRegistry.listTools()).toHaveLength(10);
      expect(toolRegistry.getStats().totalTools).toBe(10);
    });

    it('should handle mixed operations', () => {
      toolRegistry.registerTool(mockTool1);
      toolRegistry.registerTool(mockTool2);
      
      expect(toolRegistry.hasTool('test_tool_1')).toBe(true);
      
      toolRegistry.unregisterTool('test_tool_1');
      
      expect(toolRegistry.hasTool('test_tool_1')).toBe(false);
      expect(toolRegistry.hasTool('playback_control')).toBe(true);
      
      toolRegistry.registerTool(mockTool3);
      
      expect(toolRegistry.listTools()).toHaveLength(2);
    });
  });
});