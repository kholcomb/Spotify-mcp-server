/**
 * Simple structured logger for the MCP server
 */
export class SimpleLogger {
    level;
    constructor(level = 'info') {
        this.level = level;
    }
    shouldLog(level) {
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
        return levels[level] >= levels[this.level];
    }
    log(level, message, data) {
        if (!this.shouldLog(level))
            return;
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            component: 'spotify-mcp-server',
            message,
            ...data,
        };
        // MCP servers must only use stderr for logging - stdout is reserved for protocol messages
        // eslint-disable-next-line no-console
        console.error(JSON.stringify(logEntry));
    }
    debug(message, data) {
        this.log('debug', message, data);
    }
    info(message, data) {
        this.log('info', message, data);
    }
    warn(message, data) {
        this.log('warn', message, data);
    }
    error(message, data) {
        this.log('error', message, data);
    }
}
export const logger = new SimpleLogger(process.env.LOG_LEVEL || 'info');
//# sourceMappingURL=logger.js.map