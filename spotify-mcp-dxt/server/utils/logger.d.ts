import type { Logger, LogLevel } from '../types/index.js';
/**
 * Simple structured logger for the MCP server
 */
export declare class SimpleLogger implements Logger {
    private level;
    constructor(level?: LogLevel);
    private shouldLog;
    private log;
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}
export declare const logger: SimpleLogger;
//# sourceMappingURL=logger.d.ts.map