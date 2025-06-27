/**
 * Enhanced Input Sanitization and Validation
 * 
 * Provides comprehensive input sanitization to prevent injection attacks,
 * XSS, and other malicious input patterns while maintaining functionality.
 */

import { z } from 'zod';
import type { Logger } from '../types/index.js';

export interface SanitizationConfig {
  enabled: boolean;
  maxStringLength: number;
  maxArrayLength: number;
  allowedCharacterSets: Record<string, RegExp>;
  blockedPatterns: RegExp[];
  strictMode: boolean;
}

export interface SanitizationResult {
  safe: boolean;
  sanitized: unknown;
  warnings: string[];
  blocked?: string;
}

/**
 * Input sanitizer with security pattern detection
 */
export class InputSanitizer {
  private readonly logger: Logger;
  private readonly config: SanitizationConfig;

  // Security patterns to detect and block
  private readonly securityPatterns = {
    // SQL Injection patterns
    sqlInjection: /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)|(-{2})|\/\*|\*\/|;/gi,
    
    // XSS patterns
    xss: /<script[^>]*>.*?<\/script>|javascript:|on\w+\s*=|<iframe|<object|<embed|<link|<meta/gi,
    
    // Command injection patterns
    commandInjection: /[;&|`$(){}[\]\\]/g,
    
    // Path traversal patterns
    pathTraversal: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\|%252e%252e%252f/gi,
    
    // Spotify URI injection (malformed URIs)
    spotifyUriMalformed: /spotify:[^:]+:[^a-zA-Z0-9]/g,
    
    // Excessive whitespace or control characters
    // eslint-disable-next-line no-control-regex
    controlChars: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
  };

  // Character set patterns for different input types
  private readonly characterSets = {
    alphanumeric: /^[a-zA-Z0-9\s\-_.,!?]+$/,
    searchQuery: /^[a-zA-Z0-9\s\-_.,!?'":()&]+$/,
    spotifyUri: /^spotify:(track|album|artist|playlist|show|episode):[a-zA-Z0-9]{22}$/,
    deviceId: /^[a-zA-Z0-9_-]+$/,
    marketCode: /^[A-Z]{2}$/,
    base64: /^[A-Za-z0-9+/]*={0,2}$/,
  };

  constructor(config: Partial<SanitizationConfig>, logger: Logger) {
    this.logger = logger;
    this.config = {
      enabled: config.enabled ?? true,
      maxStringLength: config.maxStringLength ?? 1000,
      maxArrayLength: config.maxArrayLength ?? 100,
      allowedCharacterSets: config.allowedCharacterSets ?? this.characterSets,
      blockedPatterns: config.blockedPatterns ?? [],
      strictMode: config.strictMode ?? process.env.NODE_ENV === 'production',
    };

    this.logger.info('Input sanitizer initialized', {
      enabled: this.config.enabled,
      maxStringLength: this.config.maxStringLength,
      strictMode: this.config.strictMode,
    });
  }

  /**
   * Sanitize input data with security validation
   */
  sanitize(input: unknown, context?: string): SanitizationResult {
    if (!this.config.enabled) {
      return { safe: true, sanitized: input, warnings: [] };
    }

    const warnings: string[] = [];

    try {
      const result = this.sanitizeValue(input, context || 'unknown', warnings);
      
      if (warnings.length > 0) {
        this.logger.warn('Input sanitization warnings', {
          context,
          warnings,
          inputType: typeof input,
        });
      }

      return {
        safe: true,
        sanitized: result,
        warnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sanitization error';
      
      this.logger.error('Input blocked by sanitizer', {
        context,
        error: errorMessage,
        inputType: typeof input,
      });

      return {
        safe: false,
        sanitized: null,
        warnings: [],
        blocked: errorMessage,
      };
    }
  }

  /**
   * Validate Spotify URI format and safety
   */
  validateSpotifyUri(uri: string): { valid: boolean; type?: string; id?: string; error?: string } {
    if (!uri || typeof uri !== 'string') {
      return { valid: false, error: 'URI must be a string' };
    }

    // Check for malicious patterns
    if (this.hasSecurityPatterns(uri)) {
      return { valid: false, error: 'URI contains potentially malicious patterns' };
    }

    // Validate Spotify URI format
    const uriMatch = uri.match(/^spotify:(track|album|artist|playlist|show|episode):([a-zA-Z0-9]{22})$/);
    if (!uriMatch) {
      return { valid: false, error: 'Invalid Spotify URI format' };
    }

    return {
      valid: true,
      type: uriMatch[1] as string,
      id: uriMatch[2] as string,
    };
  }

  /**
   * Sanitize search query with content filtering
   */
  sanitizeSearchQuery(query: string): { sanitized: string; warnings: string[] } {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query must be a non-empty string');
    }

    const warnings: string[] = [];
    let sanitized = query;

    // Check length
    if (sanitized.length > this.config.maxStringLength) {
      sanitized = sanitized.substring(0, this.config.maxStringLength);
      warnings.push(`Query truncated to ${this.config.maxStringLength} characters`);
    }

    // Remove control characters
    const originalLength = sanitized.length;
    sanitized = sanitized.replace(this.securityPatterns.controlChars, '');
    if (sanitized.length !== originalLength) {
      warnings.push('Removed control characters from query');
    }

    // Check for security patterns
    if (this.hasSecurityPatterns(sanitized)) {
      if (this.config.strictMode) {
        throw new Error('Search query contains potentially malicious patterns');
      } else {
        // In non-strict mode, try to clean the input
        sanitized = this.removeSecurityPatterns(sanitized);
        warnings.push('Removed potentially malicious patterns from query');
      }
    }

    // Validate character set
    if (!this.characterSets.searchQuery.test(sanitized)) {
      if (this.config.strictMode) {
        throw new Error('Search query contains invalid characters');
      } else {
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.,!?'":()&]/g, '');
        warnings.push('Removed invalid characters from query');
      }
    }

    return { sanitized, warnings };
  }

  /**
   * Validate and sanitize device ID
   */
  sanitizeDeviceId(deviceId: string): { sanitized: string; warnings: string[] } {
    if (!deviceId || typeof deviceId !== 'string') {
      throw new Error('Device ID must be a non-empty string');
    }

    const warnings: string[] = [];
    const sanitized = deviceId;

    // Check length (Spotify device IDs are typically 40-50 characters)
    if (sanitized.length > 100) {
      throw new Error('Device ID too long');
    }

    // Validate character set
    if (!this.characterSets.deviceId.test(sanitized)) {
      throw new Error('Device ID contains invalid characters');
    }

    return { sanitized, warnings };
  }

  // Private methods

  private sanitizeValue(value: unknown, context: string, warnings: string[]): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value, context, warnings);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return this.sanitizeArray(value, context, warnings);
    }

    if (typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>, context, warnings);
    }

    throw new Error(`Unsupported input type: ${typeof value}`);
  }

  private sanitizeString(str: string, context: string, warnings: string[]): string {
    let sanitized = str;

    // Check length
    if (sanitized.length > this.config.maxStringLength) {
      sanitized = sanitized.substring(0, this.config.maxStringLength);
      warnings.push(`String truncated in ${context}`);
    }

    // Remove control characters
    const originalLength = sanitized.length;
    sanitized = sanitized.replace(this.securityPatterns.controlChars, '');
    if (sanitized.length !== originalLength) {
      warnings.push(`Removed control characters in ${context}`);
    }

    // Check for security patterns
    if (this.hasSecurityPatterns(sanitized)) {
      if (this.config.strictMode) {
        throw new Error(`Input contains potentially malicious patterns in ${context}`);
      } else {
        sanitized = this.removeSecurityPatterns(sanitized);
        warnings.push(`Removed potentially malicious patterns in ${context}`);
      }
    }

    return sanitized;
  }

  private sanitizeArray(arr: unknown[], context: string, warnings: string[]): unknown[] {
    if (arr.length > this.config.maxArrayLength) {
      warnings.push(`Array truncated in ${context}`);
      arr = arr.slice(0, this.config.maxArrayLength);
    }

    return arr.map((item, index) => 
      this.sanitizeValue(item, `${context}[${index}]`, warnings)
    );
  }

  private sanitizeObject(obj: Record<string, unknown>, context: string, warnings: string[]): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key itself
      const sanitizedKey = this.sanitizeString(key, `${context}.key`, warnings);
      
      // Sanitize the value
      sanitized[sanitizedKey] = this.sanitizeValue(value, `${context}.${key}`, warnings);
    }

    return sanitized;
  }

  private hasSecurityPatterns(str: string): boolean {
    for (const pattern of Object.values(this.securityPatterns)) {
      // Reset regex state to avoid false positives from global flags
      pattern.lastIndex = 0;
      if (pattern.test(str)) {
        return true;
      }
    }

    for (const pattern of this.config.blockedPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(str)) {
        return true;
      }
    }

    return false;
  }

  private removeSecurityPatterns(str: string): string {
    let sanitized = str;

    for (const pattern of Object.values(this.securityPatterns)) {
      // Reset regex state and use replace with global flag
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, '');
    }

    for (const pattern of this.config.blockedPatterns) {
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, '');
    }

    return sanitized.trim();
  }
}

/**
 * Enhanced Zod schema with security validation
 */
export class SecureZodSchema {
  private static sanitizer?: InputSanitizer;

  static initialize(sanitizer: InputSanitizer): void {
    SecureZodSchema.sanitizer = sanitizer;
  }

  /**
   * Create a secure string schema with sanitization
   */
  static secureString(options: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    context?: string;
  } = {}): z.ZodSchema<string> {
    return z.string()
      .min(options.minLength || 1)
      .max(options.maxLength || 1000)
      .transform((val, ctx) => {
        if (!SecureZodSchema.sanitizer) {
          return val;
        }

        const result = SecureZodSchema.sanitizer.sanitize(val, options.context);
        
        if (!result.safe) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.blocked || 'Input failed security validation',
          });
          return z.NEVER;
        }

        return result.sanitized as string;
      })
      .refine((val) => {
        if (options.pattern) {
          return options.pattern.test(val);
        }
        return true;
      }, 'Input does not match required pattern');
  }

  /**
   * Create a secure Spotify URI schema
   */
  static spotifyUri(): z.ZodSchema<string> {
    return z.string().transform((val, ctx) => {
      if (!SecureZodSchema.sanitizer) {
        return val;
      }

      const validation = SecureZodSchema.sanitizer.validateSpotifyUri(val);
      
      if (!validation.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: validation.error || 'Invalid Spotify URI',
        });
        return z.NEVER;
      }

      return val;
    });
  }

  /**
   * Create a secure search query schema
   */
  static searchQuery(): z.ZodSchema<string> {
    return z.string().transform((val, ctx) => {
      if (!SecureZodSchema.sanitizer) {
        return val;
      }

      try {
        const result = SecureZodSchema.sanitizer.sanitizeSearchQuery(val);
        return result.sanitized;
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error instanceof Error ? error.message : 'Invalid search query',
        });
        return z.NEVER;
      }
    });
  }
}

/**
 * Factory function to create input sanitizer
 */
export function createInputSanitizer(
  config: Partial<SanitizationConfig>,
  logger: Logger
): InputSanitizer {
  return new InputSanitizer(config, logger);
}