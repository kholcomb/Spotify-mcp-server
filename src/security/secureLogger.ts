/**
 * Secure Logger with PII Masking and Security Event Handling
 * 
 * Enhanced logging system that automatically masks sensitive information,
 * prevents data leakage, and provides comprehensive security event tracking.
 */

import type { Logger, LogLevel } from '../types/index.js';

export interface SecureLoggerConfig {
  maskSensitiveData: boolean;
  enableSecurityAudit: boolean;
  maxLogFieldLength: number;
  sensitiveFields: string[];
  maskingPatterns: Record<string, RegExp>;
  allowedLogLevels: LogLevel[];
}

export interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'input_validation' | 'rate_limit' | 'certificate' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
  clientId?: string;
}

/**
 * Secure logger with automatic PII masking and security auditing
 */
export class SecureLogger implements Logger {
  private readonly baseLogger: Logger;
  private readonly config: SecureLoggerConfig;
  private readonly securityEvents: SecurityEvent[] = [];
  
  // Sensitive field patterns for masking
  private readonly defaultSensitiveFields = [
    'password',
    'secret',
    'token',
    'key',
    'access_token',
    'refresh_token',
    'client_secret',
    'api_key',
    'authorization',
    'spotify_client_secret',
    'spotify_client_id',
    'email',
    'phone',
    'ssn',
    'credit_card',
    'cvv',
  ];

  // Masking patterns for different data types
  private readonly defaultMaskingPatterns = {
    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    
    // Spotify access tokens (base64-like strings > 50 chars)
    spotifyToken: /\b[A-Za-z0-9_-]{50,}\b/g,
    
    // Credit card numbers
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    
    // Phone numbers
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    
    // Social Security Numbers
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    
    // Generic secrets (hex strings > 16 chars)
    hexSecret: /\b[a-fA-F0-9]{16,}\b/g,
    
    // Base64 encoded data (potential secrets)
    base64Secret: /\b[A-Za-z0-9+/]{24,}={0,2}\b/g,
    
    // Spotify URIs with IDs
    spotifyId: /(spotify:[^:]+:)([a-zA-Z0-9]{22})/g,
  };

  constructor(baseLogger: Logger, config: Partial<SecureLoggerConfig> = {}) {
    this.baseLogger = baseLogger;
    this.config = {
      maskSensitiveData: config.maskSensitiveData ?? true,
      enableSecurityAudit: config.enableSecurityAudit ?? true,
      maxLogFieldLength: config.maxLogFieldLength ?? 500,
      sensitiveFields: [...this.defaultSensitiveFields, ...(config.sensitiveFields || [])],
      maskingPatterns: { ...this.defaultMaskingPatterns, ...(config.maskingPatterns || {}) },
      allowedLogLevels: config.allowedLogLevels || ['debug', 'info', 'warn', 'error'],
    };

    this.baseLogger.info('Secure logger initialized', {
      maskSensitiveData: this.config.maskSensitiveData,
      enableSecurityAudit: this.config.enableSecurityAudit,
      sensitiveFieldCount: this.config.sensitiveFields.length,
    });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (!this.config.allowedLogLevels.includes('debug')) return;
    this.logSecurely('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (!this.config.allowedLogLevels.includes('info')) return;
    this.logSecurely('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (!this.config.allowedLogLevels.includes('warn')) return;
    this.logSecurely('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (!this.config.allowedLogLevels.includes('error')) return;
    this.logSecurely('error', message, data);
  }

  /**
   * Log security events with enhanced tracking
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    if (!this.config.enableSecurityAudit) return;

    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Store in memory (in production, consider persistent storage)
    this.securityEvents.push(securityEvent);

    // Keep only last 1000 events to prevent memory issues
    if (this.securityEvents.length > 1000) {
      this.securityEvents.splice(0, this.securityEvents.length - 1000);
    }

    // Log based on severity
    const logLevel = this.getLogLevelForSeverity(event.severity);
    const maskedDetails = this.maskSensitiveData(event.details);

    this.baseLogger[logLevel](`[SECURITY] ${event.message}`, {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      clientId: event.clientId,
      details: maskedDetails,
    });
  }

  /**
   * Get security events for auditing
   */
  getSecurityEvents(filter?: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    since?: Date;
    userId?: string;
    clientId?: string;
  }): SecurityEvent[] {
    let events = [...this.securityEvents];

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        events = events.filter(e => e.severity === filter.severity);
      }
      if (filter.since) {
        events = events.filter(e => filter.since && e.timestamp >= filter.since);
      }
      if (filter.userId) {
        events = events.filter(e => e.userId === filter.userId);
      }
      if (filter.clientId) {
        events = events.filter(e => e.clientId === filter.clientId);
      }
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    eventsByType: Record<SecurityEvent['type'], number>;
    eventsBySeverity: Record<SecurityEvent['severity'], number>;
    recentCriticalEvents: number;
  } {
    const stats = {
      totalEvents: this.securityEvents.length,
      eventsByType: {} as Record<SecurityEvent['type'], number>,
      eventsBySeverity: {} as Record<SecurityEvent['severity'], number>,
      recentCriticalEvents: 0,
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const event of this.securityEvents) {
      // Count by type
      stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
      
      // Count recent critical events
      if (event.severity === 'critical' && event.timestamp >= oneDayAgo) {
        stats.recentCriticalEvents++;
      }
    }

    return stats;
  }

  // Private methods

  private logSecurely(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const maskedMessage = this.maskSensitiveDataInString(message);
    const maskedData = data ? this.maskSensitiveData(data) : undefined;

    this.baseLogger[level](maskedMessage, maskedData);
  }

  private maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.config.maskSensitiveData) {
      return data;
    }

    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const maskedKey = this.maskSensitiveDataInString(key);
      
      if (this.isSensitiveField(key)) {
        masked[maskedKey] = this.maskValue(value);
      } else if (typeof value === 'string') {
        masked[maskedKey] = this.maskSensitiveDataInString(value);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          masked[maskedKey] = value.map(item => 
            typeof item === 'object' && item !== null 
              ? this.maskSensitiveData(item as Record<string, unknown>)
              : typeof item === 'string' 
                ? this.maskSensitiveDataInString(item)
                : item
          );
        } else {
          masked[maskedKey] = this.maskSensitiveData(value as Record<string, unknown>);
        }
      } else {
        masked[maskedKey] = value;
      }
    }

    return masked;
  }

  private maskSensitiveDataInString(str: string): string {
    if (!this.config.maskSensitiveData || typeof str !== 'string') {
      return str;
    }

    let masked = str;

    // Truncate very long strings
    if (masked.length > this.config.maxLogFieldLength) {
      masked = `${masked.substring(0, this.config.maxLogFieldLength)  }...[truncated]`;
    }

    // Apply masking patterns
    for (const [name, pattern] of Object.entries(this.config.maskingPatterns)) {
      masked = masked.replace(pattern, (match) => {
        if (name === 'email') {
          const parts = match.split('@');
          return `${parts[0]?.substring(0, 2)}***@${parts[1]}`;
        } else if (name === 'spotifyId') {
          return match.replace(/([a-zA-Z0-9]{22})/, '***[SPOTIFY_ID]***');
        } else if (name === 'creditCard') {
          return `****-****-****-${  match.slice(-4)}`;
        } else if (name === 'phone') {
          return `***-***-${  match.slice(-4)}`;
        } else if (name === 'ssn') {
          return `***-**-${  match.slice(-4)}`;
        } else {
          // Generic masking for tokens and secrets
          if (match.length <= 8) {
            return '***';
          } else if (match.length <= 16) {
            return `${match.substring(0, 3)  }***${  match.slice(-3)}`;
          } else {
            return `${match.substring(0, 4)  }***[REDACTED]***${  match.slice(-4)}`;
          }
        }
      });
    }

    return masked;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.config.sensitiveFields.some(sensitive => 
      lowerFieldName.includes(sensitive.toLowerCase())
    );
  }

  private maskValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '[null]';
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return '[masked]';
    }

    if (typeof value === 'string') {
      if (value.length === 0) {
        return '[empty]';
      } else if (value.length <= 3) {
        return '***';
      } else if (value.length <= 10) {
        return `${value.charAt(0)  }***${  value.slice(-1)}`;
      } else {
        return `${value.substring(0, 2)  }***[REDACTED]***${  value.slice(-2)}`;
      }
    }

    return '[object]';
  }

  private getLogLevelForSeverity(severity: SecurityEvent['severity']): LogLevel {
    switch (severity) {
      case 'low': return 'debug';
      case 'medium': return 'info';
      case 'high': return 'warn';
      case 'critical': return 'error';
      default: return 'info';
    }
  }
}

/**
 * Factory function to create secure logger
 */
export function createSecureLogger(
  baseLogger: Logger,
  config: Partial<SecureLoggerConfig> = {}
): SecureLogger {
  return new SecureLogger(baseLogger, config);
}

/**
 * Helper function to create security event
 */
export function createSecurityEvent(
  type: SecurityEvent['type'],
  severity: SecurityEvent['severity'],
  message: string,
  details: Record<string, unknown> = {},
  userId?: string,
  clientId?: string
): Omit<SecurityEvent, 'timestamp'> {
  return {
    type,
    severity,
    message,
    details,
    userId,
    clientId,
  };
}