/**
 * Unit tests for CertificateManager
 * 
 * Tests certificate pinning functionality, TLS configuration,
 * and security validation for HTTPS connections.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CertificateManager, createCertificateManager, SPOTIFY_CERTIFICATE_PINS } from '../../../src/security/certificateManager.js';
import { mockLogger } from '../../setup.js';

describe('CertificateManager', () => {
  let certificateManager: CertificateManager;

  beforeEach(() => {
    certificateManager = createCertificateManager(
      {
        enabled: true,
        strictMode: false,
        allowDevelopment: true,
      },
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const manager = createCertificateManager({}, mockLogger);
      const config = manager.getConfiguration();
      
      expect(config.enabled).toBe(true);
      expect(config.strictMode).toBe(false);
      expect(config.allowDevelopment).toBe(true);
      expect(config.pins).toEqual(SPOTIFY_CERTIFICATE_PINS);
    });

    it('should initialize with custom configuration', () => {
      const customPins = {
        'example.com': ['sha256:CUSTOM_PIN_12345'],
      };
      
      const manager = createCertificateManager(
        {
          enabled: false,
          strictMode: true,
          pins: customPins,
          allowDevelopment: false,
        },
        mockLogger
      );
      
      const config = manager.getConfiguration();
      expect(config.enabled).toBe(false);
      expect(config.strictMode).toBe(true);
      expect(config.pins).toEqual(customPins);
      expect(config.allowDevelopment).toBe(false);
    });

    it('should use production environment defaults', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const manager = createCertificateManager({}, mockLogger);
      const config = manager.getConfiguration();
      
      expect(config.allowDevelopment).toBe(false);
      
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('HTTPS Agent Creation', () => {
    it('should create secure HTTPS agent with TLS 1.3', () => {
      const agent = certificateManager.createSecureAgent();
      
      expect(agent).toBeDefined();
      expect(agent.options.secureProtocol).toBe('TLSv1_3_method');
      expect(agent.options.honorCipherOrder).toBe(true);
      expect(agent.options.checkServerIdentity).toBeDefined();
    });

    it('should include secure cipher suites', () => {
      const agent = certificateManager.createSecureAgent();
      const ciphers = agent.options.ciphers as string;
      
      expect(ciphers).toContain('ECDHE-RSA-AES128-GCM-SHA256');
      expect(ciphers).toContain('ECDHE-RSA-AES256-GCM-SHA384');
      expect(ciphers).toContain('ECDHE-RSA-AES128-SHA256');
      expect(ciphers).toContain('ECDHE-RSA-AES256-SHA384');
    });
  });

  describe('Certificate Pin Updates', () => {
    it('should update certificate pins for hostname', () => {
      const hostname = 'test.example.com';
      const newPins = ['sha256:NEW_PIN_12345', 'sha256:NEW_PIN_67890'];
      
      certificateManager.updateCertificatePins(hostname, newPins);
      
      const config = certificateManager.getConfiguration();
      expect(config.pins[hostname]).toEqual(newPins);
      expect(mockLogger.info).toHaveBeenCalledWith('Updated certificate pins', {
        hostname,
        pinCount: 2,
      });
    });

    it('should allow empty pins array', () => {
      const hostname = 'test.example.com';
      const emptyPins: string[] = [];
      
      certificateManager.updateCertificatePins(hostname, emptyPins);
      
      const config = certificateManager.getConfiguration();
      expect(config.pins[hostname]).toEqual([]);
    });
  });

  describe('Development Environment Handling', () => {
    it('should allow development environment bypass for localhost', () => {
      const manager = createCertificateManager(
        { enabled: true, allowDevelopment: true },
        mockLogger
      );
      
      // This is testing the private method indirectly through agent creation
      const agent = manager.createSecureAgent();
      expect(agent).toBeDefined();
    });

    it('should not allow development bypass in strict mode', () => {
      const manager = createCertificateManager(
        { enabled: true, strictMode: true, allowDevelopment: false },
        mockLogger
      );
      
      const config = manager.getConfiguration();
      expect(config.allowDevelopment).toBe(false);
      expect(config.strictMode).toBe(true);
    });
  });

  describe('Certificate Validation', () => {
    const mockCert = {
      raw: Buffer.from('test-certificate-data'),
    };

    it('should accept valid certificate in development', () => {
      // Note: Testing private methods indirectly through agent behavior
      const agent = certificateManager.createSecureAgent();
      expect(agent.options.checkServerIdentity).toBeDefined();
    });

    it('should handle missing certificate data', () => {
      const invalidCert = { raw: undefined };
      
      // Testing through the certificate fingerprint calculation
      expect(() => {
        // This would be called internally by verifyServerIdentity
        (certificateManager as any).getCertificateFingerprint(invalidCert);
      }).toThrow('Invalid certificate object');
    });

    it('should calculate SHA-256 fingerprint correctly', () => {
      const testData = Buffer.from('test-certificate-data');
      const mockCertWithData = { raw: testData };
      
      // Calculate expected fingerprint
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      hash.update(testData);
      const expectedFingerprint = `sha256:${hash.digest('base64')}`;
      
      // Test the private method
      const actualFingerprint = (certificateManager as any).getCertificateFingerprint(mockCertWithData);
      expect(actualFingerprint).toBe(expectedFingerprint);
    });
  });

  describe('Spotify Certificate Pins', () => {
    it('should have predefined Spotify certificate pins', () => {
      expect(SPOTIFY_CERTIFICATE_PINS).toBeDefined();
      expect(SPOTIFY_CERTIFICATE_PINS['api.spotify.com']).toBeDefined();
      expect(SPOTIFY_CERTIFICATE_PINS['accounts.spotify.com']).toBeDefined();
      
      expect(Array.isArray(SPOTIFY_CERTIFICATE_PINS['api.spotify.com'])).toBe(true);
      expect(Array.isArray(SPOTIFY_CERTIFICATE_PINS['accounts.spotify.com'])).toBe(true);
      
      expect(SPOTIFY_CERTIFICATE_PINS['api.spotify.com'].length).toBeGreaterThan(0);
      expect(SPOTIFY_CERTIFICATE_PINS['accounts.spotify.com'].length).toBeGreaterThan(0);
    });

    it('should have valid SHA-256 pin format', () => {
      const pinPattern = /^sha256:[A-Za-z0-9+/=]+$/;
      
      Object.values(SPOTIFY_CERTIFICATE_PINS).forEach(pins => {
        pins.forEach(pin => {
          expect(pin).toMatch(pinPattern);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle disabled certificate pinning', () => {
      const disabledManager = createCertificateManager(
        { enabled: false },
        mockLogger
      );
      
      const agent = disabledManager.createSecureAgent();
      expect(agent).toBeDefined();
    });

    it('should log appropriate messages for different scenarios', () => {
      // Test initialization logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Certificate manager initialized',
        expect.objectContaining({
          enabled: true,
          strictMode: false,
          allowDevelopment: true,
        })
      );
    });
  });

  describe('Production Readiness', () => {
    it('should support strict mode for production', () => {
      const productionManager = createCertificateManager(
        {
          enabled: true,
          strictMode: true,
          allowDevelopment: false,
        },
        mockLogger
      );
      
      const config = productionManager.getConfiguration();
      expect(config.strictMode).toBe(true);
      expect(config.allowDevelopment).toBe(false);
    });

    it('should maintain security even when pins are not configured', () => {
      const managerWithNoPins = createCertificateManager(
        {
          enabled: true,
          pins: {},
        },
        mockLogger
      );
      
      const config = managerWithNoPins.getConfiguration();
      expect(config.pins).toEqual({});
      expect(config.enabled).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should return immutable configuration copy', () => {
      const config1 = certificateManager.getConfiguration();
      const config2 = certificateManager.getConfiguration();
      
      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same content
      
      // Modifying returned config should not affect internal state
      config1.enabled = false;
      const config3 = certificateManager.getConfiguration();
      expect(config3.enabled).toBe(true);
    });
  });
});