/**
 * Security module exports for enterprise-grade security infrastructure
 * 
 * Provides certificate management and HSM abstraction for production deployments
 */

export {
  CertificateManager,
  createCertificateManager,
  extractCertificateFingerprint,
  SPOTIFY_CERTIFICATE_PINS,
  type CertificatePinningConfig,
} from './certificateManager.js';

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