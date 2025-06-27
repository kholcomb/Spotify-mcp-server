/**
 * Security module exports
 * 
 * Provides comprehensive security components for the Spotify MCP server
 * including authentication, input sanitization, rate limiting, and more.
 */

import type { Logger } from '../types/index.js';

// Authentication and authorization
export { 
  ClientAuthenticator, 
  createClientAuthenticator,
  type ClientAuthConfig,
  type ClientRequest
} from './clientAuthenticator.js';

export {
  ScopeManager,
  createScopeManager,
  getMinimalScopes,
  SCOPE_TIERS,
  TOOL_SCOPE_REQUIREMENTS,
  SPOTIFY_SCOPES,
  type ScopeConfig,
  type ScopeValidation
} from './scopeManager.js';

// Input validation and sanitization
export {
  InputSanitizer,
  createInputSanitizer,
  type SanitizationConfig
} from './inputSanitizer.js';

// Rate limiting and abuse protection
export {
  EnhancedRateLimiter,
  createEnhancedRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimitConfig,
  type RateLimitResult,
  type UserRateLimitStats
} from './enhancedRateLimiter.js';

// Certificate management and pinning
export {
  CertificateManager,
  createCertificateManager,
  extractCertificateFingerprint,
  SPOTIFY_CERTIFICATE_PINS,
  type CertificatePinningConfig,
} from './certificateManager.js';

// Secure logging with PII masking
export {
  SecureLogger,
  createSecureLogger,
  createSecurityEvent,
  type SecureLoggerConfig,
  type SecurityEvent
} from './secureLogger.js';

// Security configuration management
export {
  SecurityConfigManager,
  createSecurityConfigManager,
  getSecurityConfigFromEnv,
  type SecurityEnvironment,
  type SecuritySettings
} from './securityConfig.js';

// HSM integration for enterprise environments
export {
  HSMManager,
  SoftwareHSMProvider,
  AWSCloudHSMProvider,
  createHSMManager,
  HSMConfigurations,
  type HSMProvider,
  type HSMProviderConfig,
  type HSMKeyMetadata,
  type HSMOperationResult,
  type HSMAuditEntry,
  type HSMOperation,
  type HSMKeyType,
} from './hsmManager.js';

// Security types
export type {
  SecurityComponents,
  SecurityContext,
  SecurityOverrides,
  CreateSecurityContextFunction
} from './types.js';

/**
 * Create a complete security context with all components
 */
export function createSecurityContext(
  environment: 'development' | 'staging' | 'production',
  logger: Logger,
  overrides?: Record<string, unknown>
): SecurityContext {
  const securityConfigManager = createSecurityConfigManager(environment, logger, overrides);
  
  const clientAuthenticator = createClientAuthenticator(
    securityConfigManager.getClientAuthConfig(),
    logger
  );
  
  const rateLimiter = createEnhancedRateLimiter(
    securityConfigManager.getRateLimitingConfig(),
    logger
  );
  
  const inputSanitizer = createInputSanitizer(
    securityConfigManager.getInputSanitizationConfig(),
    logger
  );
  
  const certificateManager = createCertificateManager(
    securityConfigManager.getCertificatePinningConfig(),
    logger
  );
  
  const scopeManager = createScopeManager(
    securityConfigManager.getConfig().oauthScopes.tier,
    logger
  );
  
  const secureLogger = createSecureLogger(
    logger,
    securityConfigManager.getSecureLoggerConfig()
  );
  
  return {
    securityConfigManager,
    clientAuthenticator,
    rateLimiter,
    inputSanitizer,
    certificateManager,
    scopeManager,
    secureLogger,
  };
}