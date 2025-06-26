import type { Logger, MCPTool } from '../types/index.js';

/**
 * Registry for MCP tools
 * 
 * Manages tool registration, discovery, and validation
 * for the MCP server.
 */
export class ToolRegistry {
  private readonly tools: Map<string, MCPTool>;
  private readonly logger: Logger;
  
  constructor(logger: Logger) {
    this.tools = new Map();
    this.logger = logger;
  }
  
  /**
   * Register a new tool
   */
  registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn('Tool already registered, overwriting', {
        toolName: tool.name
      });
    }
    
    // Validate tool structure
    this.validateTool(tool);
    
    this.tools.set(tool.name, tool);
    
    this.logger.info('Tool registered', {
      toolName: tool.name,
      description: `${tool.description.substring(0, 50)}...`
    });
  }
  
  /**
   * Register multiple tools at once
   */
  registerTools(tools: MCPTool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }
  
  /**
   * Get a tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * List all registered tools
   */
  listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools in MCP protocol format with JSON Schema conversion
   */
  getToolsForMCP(): Array<{ name: string; description: string; inputSchema: object }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.convertToJsonSchema(tool.inputSchema)
    }));
  }

  /**
   * Convert Zod schema to JSON Schema format for MCP compatibility
   */
  private convertToJsonSchema(schema: object): object {
    const schemaObj = schema as Record<string, unknown>;
    
    // If it's already a JSON Schema (has type property), return as-is
    if (schemaObj.type) {
      return schema;
    }
    
    // If it's a Zod schema, parse its shape
    if (schemaObj._def) {
      const zodDef = schemaObj._def as Record<string, unknown>;
      const result: Record<string, unknown> = {
        type: 'object',
        properties: {},
        required: []
      };
      
      // Handle ZodObject shape
      if (zodDef.typeName === 'ZodObject' && zodDef.shape) {
        const shape = typeof zodDef.shape === 'function' ? zodDef.shape() : zodDef.shape;
        for (const [key, value] of Object.entries(shape)) {
          const fieldDef = (value as Record<string, unknown>)._def as Record<string, unknown>;
          
          // Determine the JSON Schema type
          let fieldSchema: Record<string, unknown> = { type: 'string' }; // default
          
          if (fieldDef.typeName === 'ZodString') {
            fieldSchema = { type: 'string' };
          } else if (fieldDef.typeName === 'ZodNumber') {
            fieldSchema = { type: 'number' };
          } else if (fieldDef.typeName === 'ZodBoolean') {
            fieldSchema = { type: 'boolean' };
          } else if (fieldDef.typeName === 'ZodArray') {
            fieldSchema = { type: 'array', items: { type: 'string' } };
          } else if (fieldDef.typeName === 'ZodEnum') {
            fieldSchema = { type: 'string', enum: fieldDef.values };
          } else if (fieldDef.typeName === 'ZodOptional') {
            // Handle optional fields
            const innerDef = (fieldDef.innerType as Record<string, unknown>)?._def as Record<string, unknown>;
            if (innerDef?.typeName === 'ZodString') {
              fieldSchema = { type: 'string' };
            } else if (innerDef?.typeName === 'ZodNumber') {
              fieldSchema = { type: 'number' };
            } else if (innerDef?.typeName === 'ZodBoolean') {
              fieldSchema = { type: 'boolean' };
            } else if (innerDef?.typeName === 'ZodArray') {
              fieldSchema = { type: 'array', items: { type: 'string' } };
            } else if (innerDef?.typeName === 'ZodEnum') {
              fieldSchema = { type: 'string', enum: innerDef.values };
            }
          }
          
          // Add description if available
          if (fieldDef.description) {
            fieldSchema.description = fieldDef.description;
          }
          
          (result.properties as Record<string, unknown>)[key] = fieldSchema;
          
          // Mark as required if not optional
          if (fieldDef.typeName !== 'ZodOptional') {
            (result.required as string[]).push(key);
          }
        }
      }
      
      // Add schema description if available
      if (zodDef.description) {
        result.description = zodDef.description;
      }
      
      return result;
    }
    
    // Default fallback
    return {
      type: 'object',
      properties: {},
      additionalProperties: true
    };
  }
  
  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
  
  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    if (this.tools.has(name)) {
      this.tools.delete(name);
      this.logger.info('Tool unregistered', { toolName: name });
      return true;
    }
    return false;
  }
  
  /**
   * Clear all tools
   */
  clearTools(): void {
    const count = this.tools.size;
    this.tools.clear();
    this.logger.info('All tools cleared', { count });
  }
  
  /**
   * Validate tool structure
   */
  private validateTool(tool: MCPTool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }
    
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a valid description');
    }
    
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      throw new Error('Tool must have a valid input schema');
    }
    
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('Tool must have a valid execute function');
    }
    
    // Validate tool name format (lowercase with underscores)
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      throw new Error('Tool name must be lowercase with underscores only');
    }
    
    // Validate input schema - can be either Zod schema or JSON schema
    const schema = tool.inputSchema as Record<string, unknown>;
    
    // Check if it's a Zod schema (has _def property) or JSON schema (has type property)
    const hasZodDef = schema._def !== undefined;
    const hasJsonSchemaType = schema.type !== undefined;
    
    if (!hasZodDef && !hasJsonSchemaType) {
      throw new Error('Tool input schema must be a valid Zod schema or JSON Schema with type property');
    }
  }
  
  /**
   * Get registry statistics
   */
  getStats(): ToolRegistryStats {
    const tools = this.listTools();
    const categories = new Map<string, number>();
    
    // Categorize tools by prefix
    for (const tool of tools) {
      const category = tool.name.split('_')[0] || 'other';
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    
    return {
      totalTools: tools.length,
      categories: Object.fromEntries(categories),
      toolNames: this.getToolNames(),
    };
  }
}

/**
 * Tool registry statistics
 */
export interface ToolRegistryStats {
  totalTools: number;
  categories: Record<string, number>;
  toolNames: string[];
}