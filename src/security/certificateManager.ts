/**
 * Certificate management and pinning for enhanced HTTPS security
 * 
 * Implements certificate pinning to prevent man-in-the-middle attacks
 * and ensure communication integrity with Spotify API endpoints.
 */

import { createHash } from 'crypto';
import { Agent as HttpsAgent } from 'https';
import type { TLSSocket } from 'tls';
import type { Logger } from '../types/index.js';

/**
 * Known Spotify API certificate fingerprints for pinning
 * These are SHA-256 fingerprints of Spotify's certificate chain
 * 
 * Note: These are placeholder values. In production, obtain actual
 * certificate fingerprints using the extractCertificateFingerprint utility.
 */
export const SPOTIFY_CERTIFICATE_PINS: Record<string, string[]> = {
  // Spotify API endpoints
  'api.spotify.com': [
    // Note: Use extractCertificateFingerprint('api.spotify.com') to get real values
    // These are examples and should be replaced with actual fingerprints
  ],
  // Spotify Accounts endpoints  
  'accounts.spotify.com': [
    // Note: Use extractCertificateFingerprint('accounts.spotify.com') to get real values
    // These are examples and should be replaced with actual fingerprints
  ],
};

export interface CertificatePinningConfig {
  enabled: boolean;
  strictMode: boolean; // If true, reject connections on pin failure
  pins: Record<string, string[]>;
  allowDevelopment: boolean; // Allow self-signed certs in development
}

/**
 * Certificate manager with pinning support
 */
export class CertificateManager {
  private readonly config: CertificatePinningConfig;
  private readonly logger: Logger;

  constructor(config: Partial<CertificatePinningConfig>, logger: Logger) {
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
  createSecureAgent(): HttpsAgent {
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
  private verifyServerIdentity(hostname: string, cert: { raw?: Buffer }): Error | undefined {
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
      } else {
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
    } catch (error) {
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
  private getCertificateFingerprint(cert: { raw?: Buffer }): string {
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
  private isRevokedCertificate(serialNumber: string): boolean {
    // This is a placeholder - in production, implement proper CRL/OCSP checking
    const revokedCertificates = new Set<string>([
      // Add known revoked certificate serial numbers
    ]);

    return revokedCertificates.has(serialNumber);
  }

  /**
   * Update certificate pins (for certificate rotation)
   */
  updateCertificatePins(hostname: string, pins: string[]): void {
    this.config.pins[hostname] = pins;
    this.logger.info('Updated certificate pins', {
      hostname,
      pinCount: pins.length,
    });
  }

  /**
   * Initialize certificate pins by fetching current Spotify certificates
   */
  async initializeCertificatePins(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Certificate pinning disabled, skipping initialization');
      return;
    }

    const hosts = ['api.spotify.com', 'accounts.spotify.com'];
    
    for (const host of hosts) {
      try {
        this.logger.info('Fetching certificate fingerprint', { host });
        
        const fingerprint = await extractCertificateFingerprint(host);
        
        // Update pins if we got a valid fingerprint
        if (fingerprint) {
          this.config.pins[host] = [fingerprint];
          this.logger.info('Updated certificate pin', { host, fingerprint });
        }
      } catch (error) {
        this.logger.warn('Failed to fetch certificate fingerprint', {
          host,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        // In strict mode, this is a hard failure
        if (this.config.strictMode) {
          throw new Error(`Failed to initialize certificate pins for ${host}`);
        }
      }
    }

    // Log final pin configuration
    const pinCount = Object.values(this.config.pins).reduce((sum, pins) => sum + pins.length, 0);
    this.logger.info('Certificate pin initialization complete', {
      hosts: Object.keys(this.config.pins),
      totalPins: pinCount,
      strictMode: this.config.strictMode,
    });
  }

  /**
   * Validate all configured certificate pins
   */
  async validateAllPins(): Promise<{ valid: boolean; results: Array<{ host: string; valid: boolean; error?: string }> }> {
    const results: Array<{ host: string; valid: boolean; error?: string }> = [];
    let allValid = true;

    for (const host of Object.keys(this.config.pins)) {
      try {
        const currentFingerprint = await extractCertificateFingerprint(host);
        const configuredPins = this.config.pins[host] || [];
        const isValid = configuredPins.includes(currentFingerprint);
        
        results.push({ host, valid: isValid });
        
        if (!isValid) {
          allValid = false;
          this.logger.warn('Certificate pin mismatch detected', {
            host,
            currentFingerprint,
            configuredPins,
          });
        }
      } catch (error) {
        allValid = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ host, valid: false, error: errorMessage });
        
        this.logger.error('Certificate validation failed', {
          host,
          error: errorMessage,
        });
      }
    }

    return { valid: allValid, results };
  }

  /**
   * Get current configuration for debugging
   */
  getConfiguration(): CertificatePinningConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create certificate manager
 */
export function createCertificateManager(
  config: Partial<CertificatePinningConfig>,
  logger: Logger
): CertificateManager {
  return new CertificateManager(config, logger);
}

/**
 * Utility function to extract certificate fingerprint from a live connection
 * Useful for obtaining actual fingerprints for pinning configuration
 */
export async function extractCertificateFingerprint(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    import('https').then(https => {
      const options = {
        hostname,
        port: 443,
        method: 'GET',
        rejectUnauthorized: false, // We want to get the cert even if invalid
      };

      const req = https.request(options, (res) => {
        const socket = res.socket as TLSSocket;
        const cert = socket.getPeerCertificate();
        if (cert && cert.raw) {
          const hash = createHash('sha256');
          hash.update(cert.raw);
          const fingerprint = `sha256:${hash.digest('base64')}`;
          resolve(fingerprint);
        } else {
          reject(new Error('Could not retrieve certificate'));
        }
      });

      req.on('error', reject);
      req.end();
    }).catch(reject);
  });
}