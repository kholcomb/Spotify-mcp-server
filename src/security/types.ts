/**
 * Security component type definitions
 */

import type { ClientAuthenticator } from './clientAuthenticator.js';
import type { EnhancedRateLimiter } from './enhancedRateLimiter.js';
import type { InputSanitizer } from './inputSanitizer.js';
import type { ScopeManager } from './scopeManager.js';
import type { CertificateManager } from './certificateManager.js';
import type { SecureLogger } from './secureLogger.js';
import type { SecurityConfigManager } from './securityConfig.js';
import type { Logger } from '../types/index.js';

export interface SecurityComponents {
  clientAuthenticator?: ClientAuthenticator;
  rateLimiter?: EnhancedRateLimiter;
  inputSanitizer?: InputSanitizer;
  scopeManager?: ScopeManager;
}

export interface SecurityContext {
  securityConfigManager: SecurityConfigManager;
  clientAuthenticator: ClientAuthenticator;
  rateLimiter: EnhancedRateLimiter;
  inputSanitizer: InputSanitizer;
  certificateManager: CertificateManager;
  scopeManager: ScopeManager;
  secureLogger: SecureLogger;
}

export type SecurityEnvironment = 'development' | 'staging' | 'production';

export interface SecurityOverrides {
  [key: string]: unknown;
}

export type CreateSecurityContextFunction = (
  environment: SecurityEnvironment,
  logger: Logger,
  overrides?: SecurityOverrides
) => SecurityContext;