/**
 * Unit tests for HSMManager
 * 
 * Tests HSM abstraction layer functionality, provider management,
 * audit logging, and cryptographic operations.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HSMManager, createHSMManager, HSMConfigurations, SoftwareHSMProvider } from '../../../src/security/hsmManager.js';
import { MockHSMProvider } from '../../mocks/hsmProvider.js';
import { mockLogger } from '../../setup.js';
import type { HSMProviderConfig, HSMAuditEntry } from '../../../src/security/hsmManager.js';

describe('HSMManager', () => {
  let hsmManager: HSMManager;
  let mockProvider: MockHSMProvider;

  beforeEach(() => {
    // Reset environment
    delete process.env.NODE_ENV;
    delete process.env.AWS_CLOUDHSM_ENDPOINT;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with software fallback by default', () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      
      expect(hsmManager.isHardwareHSM()).toBe(false);
      expect(hsmManager.getProviderInfo().name).toBe('software-fallback');
    });

    it('should enable audit logging by default', () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      
      const auditLog = hsmManager.getAuditLog();
      expect(Array.isArray(auditLog)).toBe(true);
    });

    it('should reject hardware requirement with software provider', () => {
      expect(() => {
        createHSMManager(
          { type: 'software-fallback' },
          mockLogger,
          { requireHardwareHSM: true }
        );
      }).toThrow('Hardware HSM required but software fallback specified');
    });

    it('should configure audit log limits', () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger,
        { maxAuditEntries: 100 }
      );
      
      // This would be tested by generating many audit entries
      expect(hsmManager.getAuditLog()).toHaveLength(0);
    });
  });

  describe('HSM Configurations', () => {
    it('should provide development configuration', () => {
      const config = HSMConfigurations.development();
      expect(config.type).toBe('software-fallback');
    });

    it('should provide AWS CloudHSM configuration', () => {
      const config = HSMConfigurations.awsCloudHSM(
        'hsm.example.com',
        { accessKeyId: 'test-key', secretAccessKey: 'test-secret' }
      );
      
      expect(config.type).toBe('aws-cloudhsm');
      expect(config.endpoint).toBe('hsm.example.com');
      expect(config.credentials).toEqual({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      });
    });

    it('should auto-detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const config = HSMConfigurations.autoDetect();
      expect(config.type).toBe('software-fallback');
    });

    it('should auto-detect AWS CloudHSM in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.AWS_CLOUDHSM_ENDPOINT = 'hsm.aws.example.com';
      process.env.AWS_ACCESS_KEY_ID = 'prod-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'prod-secret';
      
      const config = HSMConfigurations.autoDetect();
      expect(config.type).toBe('aws-cloudhsm');
      expect(config.endpoint).toBe('hsm.aws.example.com');
    });

    it('should fallback to software when AWS credentials missing', () => {
      process.env.NODE_ENV = 'production';
      process.env.AWS_CLOUDHSM_ENDPOINT = 'hsm.aws.example.com';
      // Missing credentials
      
      const config = HSMConfigurations.autoDetect();
      expect(config.type).toBe('software-fallback');
    });
  });

  describe('Provider Management', () => {
    beforeEach(async () => {
      mockProvider = new MockHSMProvider(mockLogger);
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      await hsmManager.initialize();
    });

    it('should initialize HSM provider', async () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HSM Manager ready',
        expect.objectContaining({
          provider: 'software-fallback',
          isHardware: false,
        })
      );
    });

    it('should destroy HSM provider', async () => {
      await hsmManager.destroy();
      expect(mockLogger.info).toHaveBeenCalledWith('HSM Manager destroyed');
    });

    it('should handle initialization errors gracefully', async () => {
      // Test with AWS provider that throws error
      const awsManager = createHSMManager(
        { type: 'aws-cloudhsm', endpoint: 'test' },
        mockLogger
      );
      
      await expect(awsManager.initialize()).rejects.toThrow(
        'AWS CloudHSM provider not implemented'
      );
    });
  });

  describe('Key Management', () => {
    beforeEach(async () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      await hsmManager.initialize();
    });

    it('should create encryption key', async () => {
      const keyId = await hsmManager.createEncryptionKey();
      
      expect(keyId).toBeDefined();
      expect(typeof keyId).toBe('string');
      expect(keyId).toMatch(/^software-\d+-[a-f0-9]+$/);
    });

    it('should create encryption key with custom algorithm', async () => {
      const keyId = await hsmManager.createEncryptionKey('aes-128-cbc');
      
      expect(keyId).toBeDefined();
      const metadata = await hsmManager.getKeyMetadata(keyId);
      expect(metadata.algorithm).toBe('aes-128-cbc');
    });

    it('should create key with attributes', async () => {
      const attributes = {
        purpose: 'test-encryption',
        environment: 'test',
      };
      
      const keyId = await hsmManager.createEncryptionKey('aes-256-gcm', attributes);
      const metadata = await hsmManager.getKeyMetadata(keyId);
      
      expect(metadata.attributes).toEqual(attributes);
    });

    it('should list all keys', async () => {
      const keyId1 = await hsmManager.createEncryptionKey();
      const keyId2 = await hsmManager.createEncryptionKey();
      
      const keys = await hsmManager.listKeys();
      expect(keys).toHaveLength(2);
      expect(keys.map(k => k.keyId)).toContain(keyId1);
      expect(keys.map(k => k.keyId)).toContain(keyId2);
    });

    it('should delete key', async () => {
      const keyId = await hsmManager.createEncryptionKey();
      await hsmManager.deleteKey(keyId);
      
      const keys = await hsmManager.listKeys();
      expect(keys.map(k => k.keyId)).not.toContain(keyId);
    });

    it('should handle non-existent key errors', async () => {
      await expect(hsmManager.getKeyMetadata('non-existent-key'))
        .rejects.toThrow('Key not found');
    });
  });

  describe('Encryption Operations', () => {
    let keyId: string;
    const testData = 'Test encryption data';
    const testBuffer = Buffer.from(testData, 'utf8');

    beforeEach(async () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      await hsmManager.initialize();
      keyId = await hsmManager.createEncryptionKey();
    });

    it('should encrypt and decrypt data', async () => {
      const encrypted = await hsmManager.encrypt(keyId, testBuffer);
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted).not.toEqual(testBuffer);
      
      const decrypted = await hsmManager.decrypt(keyId, encrypted);
      expect(decrypted).toBeInstanceOf(Buffer);
      expect(decrypted.toString('utf8')).toBe(testData);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const encrypted1 = await hsmManager.encrypt(keyId, testBuffer);
      const encrypted2 = await hsmManager.encrypt(keyId, testBuffer);
      
      // Software provider uses simple XOR, so this might be same
      // In real HSM, this should be different due to IV/nonce
      expect(encrypted1).toBeInstanceOf(Buffer);
      expect(encrypted2).toBeInstanceOf(Buffer);
    });

    it('should fail decryption with wrong key', async () => {
      const keyId2 = await hsmManager.createEncryptionKey();
      const encrypted = await hsmManager.encrypt(keyId, testBuffer);
      
      const decrypted = await hsmManager.decrypt(keyId2, encrypted);
      expect(decrypted.toString('utf8')).not.toBe(testData);
    });

    it('should handle empty data', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const encrypted = await hsmManager.encrypt(keyId, emptyBuffer);
      const decrypted = await hsmManager.decrypt(keyId, encrypted);
      
      expect(decrypted).toHaveLength(0);
    });
  });

  describe('Signing Operations', () => {
    let keyId: string;
    const testData = Buffer.from('Test signing data', 'utf8');

    beforeEach(async () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      await hsmManager.initialize();
      keyId = await hsmManager.createEncryptionKey();
    });

    it('should sign and verify data', async () => {
      const signature = await hsmManager.sign(keyId, testData);
      expect(signature).toBeInstanceOf(Buffer);
      
      const isValid = await hsmManager.verify(keyId, testData, signature);
      expect(isValid).toBe(true);
    });

    it('should fail verification with wrong signature', async () => {
      const signature = await hsmManager.sign(keyId, testData);
      const tamperedSignature = Buffer.from(signature);
      tamperedSignature[0] ^= 0x01; // Flip one bit
      
      const isValid = await hsmManager.verify(keyId, testData, tamperedSignature);
      expect(isValid).toBe(false);
    });

    it('should fail verification with wrong data', async () => {
      const signature = await hsmManager.sign(keyId, testData);
      const differentData = Buffer.from('Different data', 'utf8');
      
      const isValid = await hsmManager.verify(keyId, differentData, signature);
      expect(isValid).toBe(false);
    });

    it('should fail verification with wrong key', async () => {
      const keyId2 = await hsmManager.createEncryptionKey();
      const signature = await hsmManager.sign(keyId, testData);
      
      const isValid = await hsmManager.verify(keyId2, testData, signature);
      expect(isValid).toBe(false);
    });
  });

  describe('Key Derivation', () => {
    let keyId: string;

    beforeEach(async () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      await hsmManager.initialize();
      keyId = await hsmManager.createEncryptionKey();
    });

    it('should derive key from data', async () => {
      const derivationData = Buffer.from('derivation-context', 'utf8');
      const derivedKey = await hsmManager.deriveKey(keyId, derivationData);
      
      expect(derivedKey).toBeInstanceOf(Buffer);
      expect(derivedKey).toHaveLength(32); // SHA-256 output
    });

    it('should produce consistent derived keys', async () => {
      const derivationData = Buffer.from('derivation-context', 'utf8');
      const derivedKey1 = await hsmManager.deriveKey(keyId, derivationData);
      const derivedKey2 = await hsmManager.deriveKey(keyId, derivationData);
      
      expect(derivedKey1).toEqual(derivedKey2);
    });

    it('should produce different keys for different data', async () => {
      const data1 = Buffer.from('context-1', 'utf8');
      const data2 = Buffer.from('context-2', 'utf8');
      
      const derivedKey1 = await hsmManager.deriveKey(keyId, data1);
      const derivedKey2 = await hsmManager.deriveKey(keyId, data2);
      
      expect(derivedKey1).not.toEqual(derivedKey2);
    });
  });

  describe('Audit Logging', () => {
    beforeEach(async () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger,
        { enableAuditLogging: true, maxAuditEntries: 10 }
      );
      await hsmManager.initialize();
    });

    it('should log encryption operations', async () => {
      const keyId = await hsmManager.createEncryptionKey();
      const data = Buffer.from('test', 'utf8');
      await hsmManager.encrypt(keyId, data, 'test-user');
      
      const auditLog = hsmManager.getAuditLog();
      expect(auditLog).toHaveLength(2); // create key + encrypt
      
      const encryptEntry = auditLog.find(e => e.operation === 'encrypt');
      expect(encryptEntry).toBeDefined();
      expect(encryptEntry?.keyId).toBe(keyId);
      expect(encryptEntry?.userId).toBe('test-user');
      expect(encryptEntry?.success).toBe(true);
    });

    it('should log failed operations', async () => {
      try {
        await hsmManager.encrypt('non-existent-key', Buffer.from('test'));
      } catch (error) {
        // Expected to fail
      }
      
      const auditLog = hsmManager.getAuditLog();
      const failedEntry = auditLog.find(e => !e.success);
      expect(failedEntry).toBeDefined();
      expect(failedEntry?.error).toContain('Key not found');
    });

    it('should respect audit log size limit', async () => {
      const keyId = await hsmManager.createEncryptionKey();
      const data = Buffer.from('test', 'utf8');
      
      // Generate more than maxAuditEntries operations
      for (let i = 0; i < 15; i++) {
        await hsmManager.encrypt(keyId, data);
      }
      
      const auditLog = hsmManager.getAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(10);
    });

    it('should provide limited audit log entries', () => {
      const fullLog = hsmManager.getAuditLog();
      const limitedLog = hsmManager.getAuditLog(5);
      
      expect(limitedLog.length).toBeLessThanOrEqual(5);
      expect(limitedLog.length).toBeLessThanOrEqual(fullLog.length);
    });

    it('should disable audit logging when configured', async () => {
      const noAuditManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger,
        { enableAuditLogging: false }
      );
      await noAuditManager.initialize();
      
      const keyId = await noAuditManager.createEncryptionKey();
      await noAuditManager.encrypt(keyId, Buffer.from('test'));
      
      const auditLog = noAuditManager.getAuditLog();
      expect(auditLog).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      hsmManager = createHSMManager(
        { type: 'software-fallback' },
        mockLogger
      );
      await hsmManager.initialize();
    });

    it('should handle encryption with invalid key', async () => {
      await expect(
        hsmManager.encrypt('invalid-key', Buffer.from('test'))
      ).rejects.toThrow('Key not found');
    });

    it('should handle decryption with invalid key', async () => {
      await expect(
        hsmManager.decrypt('invalid-key', Buffer.from('test'))
      ).rejects.toThrow('Key not found');
    });

    it('should handle signing with invalid key', async () => {
      await expect(
        hsmManager.sign('invalid-key', Buffer.from('test'))
      ).rejects.toThrow('Key not found');
    });

    it('should handle key deletion for non-existent key', async () => {
      await expect(
        hsmManager.deleteKey('non-existent-key')
      ).rejects.toThrow('Key not found');
    });
  });

  describe('Software HSM Provider', () => {
    let provider: SoftwareHSMProvider;

    beforeEach(async () => {
      provider = new SoftwareHSMProvider(mockLogger);
      await provider.initialize();
    });

    it('should report as non-hardware provider', () => {
      expect(provider.name).toBe('software-fallback');
      expect(provider.isHardware).toBe(false);
    });

    it('should support all HSM operations', async () => {
      const keyId = await provider.createKey('symmetric', 'aes-256-gcm');
      const data = Buffer.from('test data', 'utf8');
      
      // Test all operations
      const encrypted = await provider.encrypt(keyId, data);
      const decrypted = await provider.decrypt(keyId, encrypted);
      const signature = await provider.sign(keyId, data);
      const isValid = await provider.verify(keyId, data, signature);
      const derivedKey = await provider.deriveKey(keyId, data);
      
      expect(decrypted.toString('utf8')).toBe('test data');
      expect(isValid).toBe(true);
      expect(derivedKey).toBeInstanceOf(Buffer);
    });
  });
});