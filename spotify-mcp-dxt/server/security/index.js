/**
 * Security module exports for enterprise-grade security infrastructure
 *
 * Provides certificate management and HSM abstraction for production deployments
 */
export { CertificateManager, createCertificateManager, extractCertificateFingerprint, SPOTIFY_CERTIFICATE_PINS, } from './certificateManager.js';
export { HSMManager, SoftwareHSMProvider, AWSCloudHSMProvider, createHSMManager, HSMConfigurations, } from './hsmManager.js';
//# sourceMappingURL=index.js.map