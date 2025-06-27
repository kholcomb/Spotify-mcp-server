/**
 * Certificate management and pinning for enhanced HTTPS security
 *
 * Implements certificate pinning to prevent man-in-the-middle attacks
 * and ensure communication integrity with Spotify API endpoints.
 */
import { createHash } from 'crypto';
import { Agent as HttpsAgent } from 'https';
/**
 * Known Spotify API certificate fingerprints for pinning
 * These are SHA-256 fingerprints of Spotify's certificate chain
 */
export const SPOTIFY_CERTIFICATE_PINS = {
    // Spotify API endpoints
    'api.spotify.com': [
        // Primary certificate (example - in production, get actual fingerprints)
        'sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        // Backup certificate
        'sha256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
    ],
    // Spotify Accounts endpoints  
    'accounts.spotify.com': [
        'sha256:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
        'sha256:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD=',
    ],
};
/**
 * Certificate manager with pinning support
 */
export class CertificateManager {
    config;
    logger;
    constructor(config, logger) {
        this.logger = logger;
        this.config = {
            enabled: config.enabled ?? true,
            strictMode: config.strictMode ?? false, // Default to non-strict for development
            pins: config.pins ?? SPOTIFY_CERTIFICATE_PINS,
            allowDevelopment: config.allowDevelopment ?? process.env.NODE_ENV !== 'production',
        };
        this.logger.info('Certificate manager initialized', {
            enabled: this.config.enabled,
            strictMode: this.config.strictMode,
            allowDevelopment: this.config.allowDevelopment,
            pinnedHosts: Object.keys(this.config.pins),
        });
    }
    /**
     * Create HTTPS agent with certificate pinning
     */
    createSecureAgent() {
        return new HttpsAgent({
            checkServerIdentity: this.verifyServerIdentity.bind(this),
            // Additional security options
            secureProtocol: 'TLSv1_3_method', // Prefer TLS 1.3
            ciphers: [
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES128-SHA256',
                'ECDHE-RSA-AES256-SHA384',
            ].join(':'),
            honorCipherOrder: true,
            secureOptions: 0x4000000, // SSL_OP_NO_RENEGOTIATION
        });
    }
    /**
     * Verify server identity with certificate pinning
     */
    verifyServerIdentity(hostname, cert) {
        if (!this.config.enabled) {
            this.logger.debug('Certificate pinning disabled, skipping verification', { hostname });
            return undefined;
        }
        // Allow development environments to bypass pinning
        if (this.config.allowDevelopment && (hostname === 'localhost' || hostname.endsWith('.local'))) {
            this.logger.debug('Development environment detected, skipping certificate pinning', { hostname });
            return undefined;
        }
        const expectedPins = this.config.pins[hostname];
        if (!expectedPins || expectedPins.length === 0) {
            const message = `No certificate pins configured for hostname: ${hostname}`;
            this.logger.warn(message, { hostname });
            if (this.config.strictMode) {
                return new Error(message);
            }
            return undefined;
        }
        try {
            const actualFingerprint = this.getCertificateFingerprint(cert);
            const isValidPin = expectedPins.some(pin => pin === actualFingerprint);
            if (isValidPin) {
                this.logger.debug('Certificate pin validation successful', {
                    hostname,
                    fingerprint: actualFingerprint,
                });
                return undefined;
            }
            else {
                const message = `Certificate pin validation failed for ${hostname}`;
                this.logger.error(message, {
                    hostname,
                    actualFingerprint,
                    expectedPins,
                });
                // In strict mode, reject the connection
                if (this.config.strictMode) {
                    return new Error(message);
                }
                // In non-strict mode, log warning but allow connection
                this.logger.warn('Certificate pin mismatch - allowing connection in non-strict mode', {
                    hostname,
                });
                return undefined;
            }
        }
        catch (error) {
            const message = `Certificate verification error for ${hostname}`;
            this.logger.error(message, {
                hostname,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            if (this.config.strictMode) {
                return new Error(message);
            }
            return undefined;
        }
    }
    /**
     * Calculate SHA-256 fingerprint of certificate
     */
    getCertificateFingerprint(cert) {
        if (!cert || !cert.raw) {
            throw new Error('Invalid certificate object');
        }
        const hash = createHash('sha256');
        hash.update(cert.raw);
        return `sha256:${hash.digest('base64')}`;
    }
    /**
     * Basic certificate revocation check
     * In production, this should integrate with OCSP or CRL
     */
    isRevokedCertificate(serialNumber) {
        // This is a placeholder - in production, implement proper CRL/OCSP checking
        const revokedCertificates = new Set([
        // Add known revoked certificate serial numbers
        ]);
        return revokedCertificates.has(serialNumber);
    }
    /**
     * Update certificate pins (for certificate rotation)
     */
    updateCertificatePins(hostname, pins) {
        this.config.pins[hostname] = pins;
        this.logger.info('Updated certificate pins', {
            hostname,
            pinCount: pins.length,
        });
    }
    /**
     * Get current configuration for debugging
     */
    getConfiguration() {
        return { ...this.config };
    }
}
/**
 * Factory function to create certificate manager
 */
export function createCertificateManager(config, logger) {
    return new CertificateManager(config, logger);
}
/**
 * Utility function to extract certificate fingerprint from a live connection
 * Useful for obtaining actual fingerprints for pinning configuration
 */
export async function extractCertificateFingerprint(hostname) {
    return new Promise((resolve, reject) => {
        import('https').then(https => {
            const options = {
                hostname,
                port: 443,
                method: 'GET',
                rejectUnauthorized: false, // We want to get the cert even if invalid
            };
            const req = https.request(options, (res) => {
                const socket = res.socket;
                const cert = socket.getPeerCertificate();
                if (cert && cert.raw) {
                    const hash = createHash('sha256');
                    hash.update(cert.raw);
                    const fingerprint = `sha256:${hash.digest('base64')}`;
                    resolve(fingerprint);
                }
                else {
                    reject(new Error('Could not retrieve certificate'));
                }
            });
            req.on('error', reject);
            req.end();
        }).catch(reject);
    });
}
//# sourceMappingURL=certificateManager.js.map