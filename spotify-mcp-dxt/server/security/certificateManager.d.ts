/**
 * Certificate management and pinning for enhanced HTTPS security
 *
 * Implements certificate pinning to prevent man-in-the-middle attacks
 * and ensure communication integrity with Spotify API endpoints.
 */
import { Agent as HttpsAgent } from 'https';
import type { Logger } from '../types/index.js';
/**
 * Known Spotify API certificate fingerprints for pinning
 * These are SHA-256 fingerprints of Spotify's certificate chain
 */
export declare const SPOTIFY_CERTIFICATE_PINS: Record<string, string[]>;
export interface CertificatePinningConfig {
    enabled: boolean;
    strictMode: boolean;
    pins: Record<string, string[]>;
    allowDevelopment: boolean;
}
/**
 * Certificate manager with pinning support
 */
export declare class CertificateManager {
    private readonly config;
    private readonly logger;
    constructor(config: Partial<CertificatePinningConfig>, logger: Logger);
    /**
     * Create HTTPS agent with certificate pinning
     */
    createSecureAgent(): HttpsAgent;
    /**
     * Verify server identity with certificate pinning
     */
    private verifyServerIdentity;
    /**
     * Calculate SHA-256 fingerprint of certificate
     */
    private getCertificateFingerprint;
    /**
     * Basic certificate revocation check
     * In production, this should integrate with OCSP or CRL
     */
    private isRevokedCertificate;
    /**
     * Update certificate pins (for certificate rotation)
     */
    updateCertificatePins(hostname: string, pins: string[]): void;
    /**
     * Get current configuration for debugging
     */
    getConfiguration(): CertificatePinningConfig;
}
/**
 * Factory function to create certificate manager
 */
export declare function createCertificateManager(config: Partial<CertificatePinningConfig>, logger: Logger): CertificateManager;
/**
 * Utility function to extract certificate fingerprint from a live connection
 * Useful for obtaining actual fingerprints for pinning configuration
 */
export declare function extractCertificateFingerprint(hostname: string): Promise<string>;
//# sourceMappingURL=certificateManager.d.ts.map