/**
 * Security Configuration Management System
 * 
 * Centralized security configuration with environment-specific settings,
 * validation, and secure defaults for all security components.
 */

import { z } from 'zod';
import type { Logger } from '../types/index.js';
import type { ClientAuthConfig } from './clientAuthenticator.js';
import type { SanitizationConfig } from './inputSanitizer.js';
import type { CertificatePinningConfig } from './certificateManager.js';
import type { SecureLoggerConfig } from './secureLogger.js';
import type { RateLimitConfig } from './enhancedRateLimiter.js';

export type SecurityEnvironment = 'development' | 'staging' | 'production';

export interface SecuritySettings {
  environment: SecurityEnvironment;
  clientAuth: ClientAuthConfig;
  inputSanitization: SanitizationConfig;
  certificatePinning: CertificatePinningConfig;
  logging: SecureLoggerConfig;
  rateLimiting: RateLimitConfig;
  oauthScopes: {
    tier: 'read-only' | 'limited' | 'full-access';
    customScopes?: string[];
  };
  encryption: {
    algorithm: string;
    keyRotationDays: number;
    requireHSM: boolean;
  };
  monitoring: {
    enableSecurityEvents: boolean;
    alertThresholds: {
      failedAuthAttempts: number;
      rateLimitViolations: number;
      suspiciousActivity: number;
    };
  };
}

/**
 * Security configuration schema for validation
 */
const SecuritySettingsSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  clientAuth: z.object({
    enabled: z.boolean(),
    requireAuth: z.boolean(),
    tokenLifetime: z.number().min(300000).max(86400000), // 5 minutes to 24 hours
    allowedOrigins: z.array(z.string()),
    rateLimitPerClient: z.number().min(1).max(1000),
  }),
  inputSanitization: z.object({
    enabled: z.boolean(),
    maxStringLength: z.number().min(100).max(10000),
    maxArrayLength: z.number().min(10).max(1000),
    strictMode: z.boolean(),
  }),
  certificatePinning: z.object({
    enabled: z.boolean(),
    strictMode: z.boolean(),
    allowDevelopment: z.boolean(),
  }),
  logging: z.object({
    maskSensitiveData: z.boolean(),
    enableSecurityAudit: z.boolean(),
    maxLogFieldLength: z.number().min(100).max(2000),
    allowedLogLevels: z.array(z.enum(['debug', 'info', 'warn', 'error'])),
  }),
  rateLimiting: z.object({
    userLimits: z.object({
      requestsPerMinute: z.number().min(1).max(300),
      requestsPerHour: z.number().min(60).max(10000),
      requestsPerDay: z.number().min(1000).max(100000),
    }),
    globalLimits: z.object({
      requestsPerMinute: z.number().min(10).max(1000),
      concurrentRequests: z.number().min(5).max(200),
    }),
    abuseProtection: z.object({
      enabled: z.boolean(),
      maxFailuresPerMinute: z.number().min(3).max(50),
      blockDurationMs: z.number().min(60000).max(3600000), // 1 minute to 1 hour
      enableCircuitBreaker: z.boolean(),
    }),
  }),
  oauthScopes: z.object({
    tier: z.enum(['read-only', 'limited', 'full-access']),
    customScopes: z.array(z.string()).optional(),
  }),
  encryption: z.object({
    algorithm: z.enum(['aes-256-gcm', 'aes-256-cbc']),
    keyRotationDays: z.number().min(30).max(365),
    requireHSM: z.boolean(),
  }),
  monitoring: z.object({
    enableSecurityEvents: z.boolean(),
    alertThresholds: z.object({
      failedAuthAttempts: z.number().min(5).max(100),
      rateLimitViolations: z.number().min(10).max(500),
      suspiciousActivity: z.number().min(3).max(50),
    }),
  }),
});

/**
 * Environment-specific security configurations
 */
const ENVIRONMENT_CONFIGS: Record<SecurityEnvironment, Partial<SecuritySettings>> = {
  development: {
    environment: 'development',
    clientAuth: {
      enabled: true,
      requireAuth: false,
      tokenLifetime: 3600000, // 1 hour
      allowedOrigins: ['localhost', '127.0.0.1', '*'],
      rateLimitPerClient: 200,
    },
    inputSanitization: {
      enabled: true,
      maxStringLength: 2000,
      maxArrayLength: 200,
      strictMode: false,
      allowedCharacterSets: ['alphanumeric', 'basic-punctuation'],
      blockedPatterns: [/<script/gi, /javascript:/gi, /data:/gi, /vbscript:/gi],
    },
    certificatePinning: {
      enabled: false,
      strictMode: false,
      allowDevelopment: true,
      pins: [],
    },
    logging: {
      maskSensitiveData: false, // Allow full logging in development
      enableSecurityAudit: true,
      maxLogFieldLength: 1000,
      allowedLogLevels: ['debug', 'info', 'warn', 'error'],
      sensitiveFields: ['password', 'token', 'key', 'secret'],
      maskingPatterns: { default: /\*\*\*MASKED\*\*\*/ },
    },
    rateLimiting: {
      userLimits: {
        requestsPerMinute: 30,
        requestsPerHour: 1800,
        requestsPerDay: 43200,
      },
      globalLimits: {
        requestsPerMinute: 800,
        concurrentRequests: 100,
      },
      abuseProtection: {
        enabled: true,
        maxFailuresPerMinute: 20,
        blockDurationMs: 120000, // 2 minutes
        enableCircuitBreaker: false,
      },
      toolLimits: {
        search: { requestsPerMinute: 30 },
        playback: { requestsPerMinute: 60 },
        library: { requestsPerMinute: 40 },
      },
    },
    oauthScopes: {
      tier: 'limited',
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
      requireHSM: false,
    },
    monitoring: {
      enableSecurityEvents: true,
      alertThresholds: {
        failedAuthAttempts: 20,
        rateLimitViolations: 50,
        suspiciousActivity: 10,
      },
    },
  },

  staging: {
    environment: 'staging',
    clientAuth: {
      enabled: true,
      requireAuth: true,
      tokenLifetime: 1800000, // 30 minutes
      allowedOrigins: ['staging.example.com', 'localhost'],
      rateLimitPerClient: 100,
    },
    inputSanitization: {
      enabled: true,
      maxStringLength: 1000,
      maxArrayLength: 100,
      strictMode: true,
      allowedCharacterSets: ['alphanumeric', 'basic-punctuation'],
      blockedPatterns: [/<script/gi, /javascript:/gi, /data:/gi, /vbscript:/gi],
    },
    certificatePinning: {
      enabled: true,
      strictMode: false,
      allowDevelopment: false,
      pins: ['sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
    },
    logging: {
      maskSensitiveData: true,
      enableSecurityAudit: true,
      maxLogFieldLength: 500,
      allowedLogLevels: ['info', 'warn', 'error'],
      sensitiveFields: ['password', 'token', 'key', 'secret'],
      maskingPatterns: { default: /\*\*\*MASKED\*\*\*/ },
    },
    rateLimiting: {
      userLimits: {
        requestsPerMinute: 25,
        requestsPerHour: 1500,
        requestsPerDay: 36000,
      },
      globalLimits: {
        requestsPerMinute: 600,
        concurrentRequests: 75,
      },
      abuseProtection: {
        enabled: true,
        maxFailuresPerMinute: 15,
        blockDurationMs: 300000, // 5 minutes
        enableCircuitBreaker: true,
      },
      toolLimits: {
        search: { requestsPerMinute: 20 },
        playback: { requestsPerMinute: 40 },
        library: { requestsPerMinute: 30 },
      },
    },
    oauthScopes: {
      tier: 'limited',
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 60,
      requireHSM: false,
    },
    monitoring: {
      enableSecurityEvents: true,
      alertThresholds: {
        failedAuthAttempts: 15,
        rateLimitViolations: 30,
        suspiciousActivity: 8,
      },
    },
  },

  production: {
    environment: 'production',
    clientAuth: {
      enabled: true,
      requireAuth: true,
      tokenLifetime: 900000, // 15 minutes
      allowedOrigins: ['api.yourdomain.com'],
      rateLimitPerClient: 60,
    },
    inputSanitization: {
      enabled: true,
      maxStringLength: 500,
      maxArrayLength: 50,
      strictMode: true,
      allowedCharacterSets: ['alphanumeric'],
      blockedPatterns: [/<script/gi, /javascript:/gi, /data:/gi, /vbscript:/gi, /eval\(/gi],
    },
    certificatePinning: {
      enabled: true,
      strictMode: true,
      allowDevelopment: false,
      pins: ['sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'sha256-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='],
    },
    logging: {
      maskSensitiveData: true,
      enableSecurityAudit: true,
      maxLogFieldLength: 300,
      allowedLogLevels: ['warn', 'error'], // Minimal logging in production
      sensitiveFields: ['password', 'token', 'key', 'secret', 'auth'],
      maskingPatterns: { default: /\*\*\*MASKED\*\*\*/ },
    },
    rateLimiting: {
      userLimits: {
        requestsPerMinute: 16,
        requestsPerHour: 960,
        requestsPerDay: 23040,
      },
      globalLimits: {
        requestsPerMinute: 500,
        concurrentRequests: 50,
      },
      abuseProtection: {
        enabled: true,
        maxFailuresPerMinute: 10,
        blockDurationMs: 600000, // 10 minutes
        enableCircuitBreaker: true,
      },
      toolLimits: {
        search: { requestsPerMinute: 15 },
        playback: { requestsPerMinute: 30 },
        library: { requestsPerMinute: 20 },
      },
    },
    oauthScopes: {
      tier: 'read-only', // Most restrictive by default
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 30,
      requireHSM: true,
    },
    monitoring: {
      enableSecurityEvents: true,
      alertThresholds: {
        failedAuthAttempts: 10,
        rateLimitViolations: 20,
        suspiciousActivity: 5,
      },
    },
  },
};

/**
 * Security configuration manager
 */
export class SecurityConfigManager {
  private readonly logger: Logger;
  private config: SecuritySettings;

  constructor(environment: SecurityEnvironment, logger: Logger, overrides?: Partial<SecuritySettings>) {
    this.logger = logger;

    // Start with environment defaults
    const baseConfig = ENVIRONMENT_CONFIGS[environment];
    
    // Apply overrides
    this.config = this.mergeConfigs(baseConfig, overrides || {});

    // Validate configuration
    this.validateConfig();

    this.logger.info('Security configuration initialized', {
      environment,
      clientAuthEnabled: this.config.clientAuth.enabled,
      inputSanitizationEnabled: this.config.inputSanitization.enabled,
      certificatePinningEnabled: this.config.certificatePinning.enabled,
      oauthTier: this.config.oauthScopes.tier,
      requireHSM: this.config.encryption.requireHSM,
    });
  }

  /**
   * Get complete security configuration
   */
  getConfig(): SecuritySettings {
    return { ...this.config };
  }

  /**
   * Get client authentication configuration
   */
  getClientAuthConfig(): ClientAuthConfig {
    return { ...this.config.clientAuth };
  }

  /**
   * Get input sanitization configuration
   */
  getInputSanitizationConfig(): SanitizationConfig {
    return {
      ...this.config.inputSanitization,
      allowedCharacterSets: {},
      blockedPatterns: [],
    };
  }

  /**
   * Get certificate pinning configuration
   */
  getCertificatePinningConfig(): CertificatePinningConfig {
    return {
      ...this.config.certificatePinning,
      pins: {},
    };
  }

  /**
   * Get secure logger configuration
   */
  getSecureLoggerConfig(): SecureLoggerConfig {
    return {
      ...this.config.logging,
      sensitiveFields: [],
      maskingPatterns: {},
    };
  }

  /**
   * Get rate limiting configuration
   */
  getRateLimitingConfig(): RateLimitConfig {
    return {
      ...this.config.rateLimiting,
      toolLimits: this.getDefaultToolLimits(),
    };
  }

  /**
   * Update configuration at runtime (with validation)
   */
  updateConfig(updates: Partial<SecuritySettings>): void {
    const newConfig = this.mergeConfigs(this.config, updates);
    
    try {
      SecuritySettingsSchema.parse(newConfig);
      this.config = newConfig;
      
      this.logger.info('Security configuration updated', {
        updatedFields: Object.keys(updates),
      });
    } catch (error) {
      this.logger.error('Security configuration update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        updates,
      });
      throw new Error('Invalid security configuration update');
    }
  }

  /**
   * Get security recommendations based on current configuration
   */
  getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    // Environment-specific recommendations
    if (this.config.environment === 'production') {
      if (!this.config.clientAuth.requireAuth) {
        recommendations.push('Enable required authentication for production environment');
      }
      
      if (!this.config.certificatePinning.enabled) {
        recommendations.push('Enable certificate pinning for production environment');
      }
      
      if (!this.config.certificatePinning.strictMode) {
        recommendations.push('Enable strict certificate pinning mode for production');
      }
      
      if (!this.config.encryption.requireHSM) {
        recommendations.push('Consider requiring HSM for production encryption');
      }
      
      if (this.config.oauthScopes.tier === 'full-access') {
        recommendations.push('Consider using more restrictive OAuth scope tier in production');
      }
    }

    // Rate limiting recommendations
    if (this.config.rateLimiting.userLimits.requestsPerMinute > 100) {
      recommendations.push('Consider lowering per-user rate limits for better security');
    }
    
    if (!this.config.rateLimiting.abuseProtection.enabled) {
      recommendations.push('Enable abuse protection to prevent malicious usage');
    }

    // Logging recommendations
    if (this.config.environment !== 'development' && !this.config.logging.maskSensitiveData) {
      recommendations.push('Enable sensitive data masking in non-development environments');
    }

    // Input sanitization recommendations
    if (!this.config.inputSanitization.enabled) {
      recommendations.push('Enable input sanitization to prevent injection attacks');
    }
    
    if (this.config.environment === 'production' && !this.config.inputSanitization.strictMode) {
      recommendations.push('Enable strict input sanitization mode for production');
    }

    return recommendations;
  }

  /**
   * Validate current configuration against security best practices
   */
  validateSecurityPosture(): {
    score: number; // 0-100
    issues: Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; message: string }>;
    recommendations: string[];
  } {
    const issues: Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; message: string }> = [];
    let score = 100;

    // Critical issues (major score impact)
    if (this.config.environment === 'production' && !this.config.clientAuth.requireAuth) {
      issues.push({ severity: 'critical', message: 'Authentication not required in production' });
      score -= 30;
    }

    if (!this.config.inputSanitization.enabled) {
      issues.push({ severity: 'critical', message: 'Input sanitization disabled' });
      score -= 25;
    }

    // High severity issues
    if (this.config.environment === 'production' && !this.config.certificatePinning.strictMode) {
      issues.push({ severity: 'high', message: 'Certificate pinning not in strict mode for production' });
      score -= 15;
    }

    if (!this.config.rateLimiting.abuseProtection.enabled) {
      issues.push({ severity: 'high', message: 'Abuse protection disabled' });
      score -= 15;
    }

    // Medium severity issues
    if (this.config.oauthScopes.tier === 'full-access' && this.config.environment === 'production') {
      issues.push({ severity: 'medium', message: 'Using full-access OAuth scope tier in production' });
      score -= 10;
    }

    if (this.config.environment !== 'development' && !this.config.logging.maskSensitiveData) {
      issues.push({ severity: 'medium', message: 'Sensitive data masking disabled' });
      score -= 10;
    }

    // Low severity issues
    if (this.config.rateLimiting.userLimits.requestsPerMinute > 120) {
      issues.push({ severity: 'low', message: 'High per-user rate limits may allow abuse' });
      score -= 5;
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations: this.getSecurityRecommendations(),
    };
  }

  // Private methods

  private validateConfig(): void {
    try {
      SecuritySettingsSchema.parse(this.config);
      
      // Additional business logic validations
      this.validateBusinessRules();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        throw new Error(`Security configuration validation failed:\n${issues.join('\n')}`);
      }
      throw error;
    }
  }

  private validateBusinessRules(): void {
    const errors: string[] = [];

    // Validate environment-specific requirements
    if (this.config.environment === 'production') {
      if (!this.config.clientAuth.requireAuth) {
        errors.push('Production environment must require authentication');
      }
      
      if (!this.config.certificatePinning.enabled) {
        errors.push('Production environment must enable certificate pinning');
      }
      
      if (!this.config.logging.maskSensitiveData) {
        errors.push('Production environment must enable sensitive data masking');
      }
      
      if (this.config.oauthScopes.tier === 'full-access') {
        errors.push('Production environment should not use full-access OAuth scope tier');
      }
      
      if (this.config.clientAuth.allowedOrigins.includes('*')) {
        errors.push('Production environment should not allow all origins');
      }
    }

    // Validate rate limiting consistency
    if (this.config.rateLimiting.userLimits.requestsPerMinute * 60 > this.config.rateLimiting.userLimits.requestsPerHour) {
      errors.push('Per-minute rate limit would exceed hourly limit');
    }
    
    if (this.config.rateLimiting.userLimits.requestsPerHour * 24 > this.config.rateLimiting.userLimits.requestsPerDay) {
      errors.push('Per-hour rate limit would exceed daily limit');
    }

    // Validate global vs user limits
    if (this.config.rateLimiting.globalLimits.requestsPerMinute < this.config.rateLimiting.userLimits.requestsPerMinute) {
      errors.push('Global rate limit should be higher than per-user limit');
    }

    // Validate authentication token lifetime
    if (this.config.environment === 'production' && this.config.clientAuth.tokenLifetime > 3600000) {
      errors.push('Production environment should use token lifetime ≤ 1 hour');
    }

    // Validate encryption settings
    if (this.config.encryption.keyRotationDays < 1) {
      errors.push('Key rotation period must be at least 1 day');
    }

    if (this.config.environment === 'production' && this.config.encryption.keyRotationDays > 90) {
      errors.push('Production environment should rotate keys every 90 days or less');
    }

    // Validate abuse protection
    if (this.config.rateLimiting.abuseProtection.enabled) {
      if (this.config.rateLimiting.abuseProtection.blockDurationMs < 60000) {
        errors.push('Abuse protection block duration must be at least 1 minute');
      }
      
      if (this.config.rateLimiting.abuseProtection.maxFailuresPerMinute < 3) {
        errors.push('Abuse protection threshold must allow at least 3 failures per minute');
      }
    }

    // Validate input sanitization
    if (this.config.inputSanitization.maxStringLength < 100) {
      errors.push('Input sanitization max string length must be at least 100 characters');
    }

    if (this.config.inputSanitization.maxArrayLength < 10) {
      errors.push('Input sanitization max array length must be at least 10 items');
    }

    if (errors.length > 0) {
      throw new Error(`Security configuration business rule validation failed:\n${errors.join('\n')}`);
    }
  }

  private mergeConfigs(base: Partial<SecuritySettings>, override: Partial<SecuritySettings>): SecuritySettings {
    const merged = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          merged[key as keyof SecuritySettings] = {
            ...(merged[key as keyof SecuritySettings] as object),
            ...value,
          } as SecuritySettings[keyof SecuritySettings];
        } else {
          merged[key as keyof SecuritySettings] = value as SecuritySettings[keyof SecuritySettings];
        }
      }
    }

    return merged as SecuritySettings;
  }

  private getDefaultToolLimits(): Record<string, { requestsPerMinute: number; cooldownMs?: number }> {
    const multiplier = this.config.environment === 'production' ? 0.5 
                     : this.config.environment === 'staging' ? 0.75 
                     : 1.0;

    return {
      'search': { requestsPerMinute: Math.floor(30 * multiplier) },
      'play': { requestsPerMinute: Math.floor(10 * multiplier), cooldownMs: 1000 },
      'pause': { requestsPerMinute: Math.floor(10 * multiplier), cooldownMs: 1000 },
      'skip_next': { requestsPerMinute: Math.floor(20 * multiplier), cooldownMs: 500 },
      'skip_previous': { requestsPerMinute: Math.floor(20 * multiplier), cooldownMs: 500 },
      'set_volume': { requestsPerMinute: Math.floor(10 * multiplier), cooldownMs: 2000 },
      'authenticate': { requestsPerMinute: Math.floor(5 * multiplier), cooldownMs: 10000 },
      'get_user_top_tracks': { requestsPerMinute: Math.floor(15 * multiplier) },
      'get_user_top_artists': { requestsPerMinute: Math.floor(15 * multiplier) },
      'get_audio_features': { requestsPerMinute: Math.floor(25 * multiplier) },
    };
  }
}

/**
 * Factory function to create security config manager
 */
export function createSecurityConfigManager(
  environment: SecurityEnvironment,
  logger: Logger,
  overrides?: Partial<SecuritySettings>
): SecurityConfigManager {
  return new SecurityConfigManager(environment, logger, overrides);
}

/**
 * Get security configuration from environment variables
 */
export function getSecurityConfigFromEnv(): {
  environment: SecurityEnvironment;
  overrides: Partial<SecuritySettings>;
} {
  const environment = (process.env.NODE_ENV || 'development') as SecurityEnvironment;
  
  const overrides: Partial<SecuritySettings> = {};

  // OAuth scope tier override
  if (process.env.OAUTH_SCOPE_TIER) {
    overrides.oauthScopes = {
      tier: process.env.OAUTH_SCOPE_TIER as 'read-only' | 'limited' | 'full-access',
    };
  }

  // HSM requirement override
  if (process.env.REQUIRE_HSM === 'true') {
    overrides.encryption = {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 30,
      requireHSM: true,
    };
  }

  // Client authentication override
  if (process.env.REQUIRE_CLIENT_AUTH === 'false') {
    overrides.clientAuth = {
      enabled: true,
      requireAuth: false,
      tokenLifetime: 3600000,
      allowedOrigins: ['*'],
      rateLimitPerClient: 200,
    };
  }

  return { environment, overrides };
}