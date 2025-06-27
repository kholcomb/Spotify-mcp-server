/**
 * Registry for MCP tools
 *
 * Manages tool registration, discovery, and validation
 * for the MCP server.
 */
export class ToolRegistry {
    tools;
    logger;
    constructor(logger) {
        this.tools = new Map();
        this.logger = logger;
    }
    /**
     * Register a new tool
     */
    registerTool(tool) {
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
    registerTools(tools) {
        for (const tool of tools) {
            this.registerTool(tool);
        }
    }
    /**
     * Get a tool by name
     */
    getTool(name) {
        return this.tools.get(name);
    }
    /**
     * Check if a tool exists
     */
    hasTool(name) {
        return this.tools.has(name);
    }
    /**
     * List all registered tools
     */
    listTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Get tools in MCP protocol format with JSON Schema conversion
     */
    getToolsForMCP() {
        return Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: this.convertToJsonSchema(tool.inputSchema)
        }));
    }
    /**
     * Convert Zod schema to JSON Schema format for MCP compatibility
     */
    convertToJsonSchema(schema) {
        const schemaObj = schema;
        // If it's already a JSON Schema (has type property), return as-is
        if (schemaObj.type) {
            return schema;
        }
        // If it's a Zod schema, parse its shape
        if (schemaObj._def) {
            const zodDef = schemaObj._def;
            const result = {
                type: 'object',
                properties: {},
                required: []
            };
            // Handle ZodObject shape
            if (zodDef.typeName === 'ZodObject' && zodDef.shape) {
                const shape = typeof zodDef.shape === 'function' ? zodDef.shape() : zodDef.shape;
                for (const [key, value] of Object.entries(shape)) {
                    const fieldDef = value._def;
                    // Determine the JSON Schema type
                    let fieldSchema = { type: 'string' }; // default
                    if (fieldDef.typeName === 'ZodString') {
                        fieldSchema = { type: 'string' };
                    }
                    else if (fieldDef.typeName === 'ZodNumber') {
                        fieldSchema = { type: 'number' };
                    }
                    else if (fieldDef.typeName === 'ZodBoolean') {
                        fieldSchema = { type: 'boolean' };
                    }
                    else if (fieldDef.typeName === 'ZodArray') {
                        fieldSchema = { type: 'array', items: { type: 'string' } };
                    }
                    else if (fieldDef.typeName === 'ZodEnum') {
                        fieldSchema = { type: 'string', enum: fieldDef.values };
                    }
                    else if (fieldDef.typeName === 'ZodOptional') {
                        // Handle optional fields
                        const innerDef = fieldDef.innerType?._def;
                        if (innerDef?.typeName === 'ZodString') {
                            fieldSchema = { type: 'string' };
                        }
                        else if (innerDef?.typeName === 'ZodNumber') {
                            fieldSchema = { type: 'number' };
                        }
                        else if (innerDef?.typeName === 'ZodBoolean') {
                            fieldSchema = { type: 'boolean' };
                        }
                        else if (innerDef?.typeName === 'ZodArray') {
                            fieldSchema = { type: 'array', items: { type: 'string' } };
                        }
                        else if (innerDef?.typeName === 'ZodEnum') {
                            fieldSchema = { type: 'string', enum: innerDef.values };
                        }
                    }
                    // Add description if available
                    if (fieldDef.description) {
                        fieldSchema.description = fieldDef.description;
                    }
                    result.properties[key] = fieldSchema;
                    // Mark as required if not optional
                    if (fieldDef.typeName !== 'ZodOptional') {
                        result.required.push(key);
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
    getToolNames() {
        return Array.from(this.tools.keys());
    }
    /**
     * Unregister a tool
     */
    unregisterTool(name) {
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
    clearTools() {
        const count = this.tools.size;
        this.tools.clear();
        this.logger.info('All tools cleared', { count });
    }
    /**
     * Validate tool structure
     */
    validateTool(tool) {
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
        const schema = tool.inputSchema;
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
    getStats() {
        const tools = this.listTools();
        const categories = new Map();
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
//# sourceMappingURL=toolRegistry.js.map