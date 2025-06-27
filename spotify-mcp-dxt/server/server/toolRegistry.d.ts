import type { Logger, MCPTool } from '../types/index.js';
/**
 * Registry for MCP tools
 *
 * Manages tool registration, discovery, and validation
 * for the MCP server.
 */
export declare class ToolRegistry {
    private readonly tools;
    private readonly logger;
    constructor(logger: Logger);
    /**
     * Register a new tool
     */
    registerTool(tool: MCPTool): void;
    /**
     * Register multiple tools at once
     */
    registerTools(tools: MCPTool[]): void;
    /**
     * Get a tool by name
     */
    getTool(name: string): MCPTool | undefined;
    /**
     * Check if a tool exists
     */
    hasTool(name: string): boolean;
    /**
     * List all registered tools
     */
    listTools(): MCPTool[];
    /**
     * Get tools in MCP protocol format with JSON Schema conversion
     */
    getToolsForMCP(): Array<{
        name: string;
        description: string;
        inputSchema: object;
    }>;
    /**
     * Convert Zod schema to JSON Schema format for MCP compatibility
     */
    private convertToJsonSchema;
    /**
     * Get tool names
     */
    getToolNames(): string[];
    /**
     * Unregister a tool
     */
    unregisterTool(name: string): boolean;
    /**
     * Clear all tools
     */
    clearTools(): void;
    /**
     * Validate tool structure
     */
    private validateTool;
    /**
     * Get registry statistics
     */
    getStats(): ToolRegistryStats;
}
/**
 * Tool registry statistics
 */
export interface ToolRegistryStats {
    totalTools: number;
    categories: Record<string, number>;
    toolNames: string[];
}
//# sourceMappingURL=toolRegistry.d.ts.map