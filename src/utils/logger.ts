import type { Logger, LogLevel } from '../types/index.js';

/**
 * Simple structured logger for the MCP server
 */
export class SimpleLogger implements Logger {
  constructor(private level: LogLevel = 'info') {}

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.level];
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      component: 'spotify-mcp-server',
      message,
      ...data,
    };

    // Using console for structured logging in Node.js environment
    // eslint-disable-next-line no-console
    const output = level === 'error' ? console.error : console.log;
    output(JSON.stringify(logEntry));
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }
}

export const logger = new SimpleLogger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);