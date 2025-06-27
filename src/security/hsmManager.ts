/**
 * Hardware Security Module (HSM) abstraction layer for enterprise key management
 * 
 * Provides a unified interface for hardware-based cryptographic operations
 * and secure key storage, supporting multiple HSM providers and fallback
 * to software-based implementations for development environments.
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import type { Logger } from '../types/index.js';

/**
 * HSM operation types
 */
export type HSMOperation = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'derive_key';

/**
 * HSM key types supported
 */
export type HSMKeyType = 'symmetric' | 'asymmetric' | 'derivation';

/**
 * HSM provider configurations
 */
export interface HSMProviderConfig {
  type: 'aws-cloudhsm' | 'azure-keyvault' | 'hashicorp-vault' | 'software-fallback';
  endpoint?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    token?: string;
  };
  options?: Record<string, unknown>;
}

/**
 * HSM key metadata
 */
export interface HSMKeyMetadata {
  keyId: string;
  keyType: HSMKeyType;
  algorithm: string;
  created: Date;
  provider: string;
  attributes: Record<string, unknown>;
}

/**
 * HSM operation result
 */
export interface HSMOperationResult {
  success: boolean;
  data?: Buffer;
  signature?: Buffer;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * HSM audit log entry
 */
export interface HSMAuditEntry {
  timestamp: Date;
  operation: HSMOperation;
  keyId: string;
  userId?: string | undefined;
  success: boolean;
  error?: string | undefined;
  metadata?: Record<string, unknown>;
}

/**
 * Base HSM provider interface
 */
export interface HSMProvider {
  readonly name: string;
  readonly isHardware: boolean;
  
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  
  createKey(keyType: HSMKeyType, algorithm: string, attributes?: Record<string, unknown>): Promise<string>;
  deleteKey(keyId: string): Promise<void>;
  listKeys(): Promise<HSMKeyMetadata[]>;
  
  encrypt(keyId: string, plaintext: Buffer, algorithm?: string): Promise<Buffer>;
  decrypt(keyId: string, ciphertext: Buffer, algorithm?: string): Promise<Buffer>;
  
  sign(keyId: string, data: Buffer, algorithm?: string): Promise<Buffer>;
  verify(keyId: string, data: Buffer, signature: Buffer, algorithm?: string): Promise<boolean>;
  
  deriveKey(keyId: string, derivationData: Buffer, algorithm?: string): Promise<Buffer>;
  
  getKeyMetadata(keyId: string): Promise<HSMKeyMetadata>;
}

/**
 * Software fallback HSM provider for development and testing
 */
export class SoftwareHSMProvider implements HSMProvider {
  public readonly name = 'software-fallback';
  public readonly isHardware = false;
  
  private keys = new Map<string, { key: Buffer; metadata: HSMKeyMetadata }>();
  private readonly logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
  }
  
  async initialize(): Promise<void> {
    this.logger.info('Software HSM provider initialized');
  }
  
  async destroy(): Promise<void> {
    this.keys.clear();
    this.logger.info('Software HSM provider destroyed');
  }
  
  async createKey(keyType: HSMKeyType, algorithm: string, attributes: Record<string, unknown> = {}): Promise<string> {
    const keyId = `software-${Date.now()}-${randomBytes(8).toString('hex')}`;
    
    let keySize = 32; // Default 256-bit key
    if (algorithm.includes('128')) keySize = 16;
    else if (algorithm.includes('512')) keySize = 64;
    
    const key = randomBytes(keySize);
    const metadata: HSMKeyMetadata = {
      keyId,
      keyType,
      algorithm,
      created: new Date(),
      provider: this.name,
      attributes,
    };
    
    this.keys.set(keyId, { key, metadata });
    
    this.logger.info('Software HSM key created', {
      keyId,
      keyType,
      algorithm,
      keySize,
    });
    
    return keyId;
  }
  
  async deleteKey(keyId: string): Promise<void> {
    const deleted = this.keys.delete(keyId);
    if (!deleted) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    this.logger.info('Software HSM key deleted', { keyId });
  }
  
  async listKeys(): Promise<HSMKeyMetadata[]> {
    return Array.from(this.keys.values()).map(entry => entry.metadata);
  }
  
  async encrypt(keyId: string, plaintext: Buffer, algorithm = 'aes-256-gcm'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    const crypto = await import('crypto');
    const iv = randomBytes(12); // GCM typically uses 12-byte IV
    const cipher = crypto.createCipher('aes-256-gcm', keyEntry.key);
    cipher.setAAD(Buffer.from('authenticated'));
    
    let encrypted = cipher.update(plaintext);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Prepend IV and auth tag for GCM mode
    return Buffer.concat([iv, authTag, encrypted]);
  }
  
  async decrypt(keyId: string, ciphertext: Buffer, algorithm = 'aes-256-gcm'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    const crypto = await import('crypto');
    const iv = ciphertext.subarray(0, 12); // Extract 12-byte IV
    const authTag = ciphertext.subarray(12, 28); // Extract 16-byte auth tag
    const encrypted = ciphertext.subarray(28); // Remaining is encrypted data
    
    const decipher = crypto.createDecipher('aes-256-gcm', keyEntry.key);
    decipher.setAAD(Buffer.from('authenticated'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }
  
  async sign(keyId: string, data: Buffer, algorithm = 'sha256'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    const hmac = createHmac(algorithm, keyEntry.key);
    hmac.update(data);
    return hmac.digest();
  }
  
  async verify(keyId: string, data: Buffer, signature: Buffer, algorithm = 'sha256'): Promise<boolean> {
    const expectedSignature = await this.sign(keyId, data, algorithm);
    return expectedSignature.equals(signature);
  }
  
  async deriveKey(keyId: string, derivationData: Buffer, algorithm = 'sha256'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    const hash = createHash(algorithm);
    hash.update(keyEntry.key);
    hash.update(derivationData);
    return hash.digest();
  }
  
  async getKeyMetadata(keyId: string): Promise<HSMKeyMetadata> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Key not found: ${keyId}`);
    }
    
    return keyEntry.metadata;
  }
}

/**
 * AWS CloudHSM provider (placeholder for production implementation)
 */
export class AWSCloudHSMProvider implements HSMProvider {
  public readonly name = 'aws-cloudhsm';
  public readonly isHardware = true;
  
  private readonly config: HSMProviderConfig;
  private readonly logger: Logger;
  
  constructor(config: HSMProviderConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }
  
  async initialize(): Promise<void> {
    // In production, initialize AWS CloudHSM client
    this.logger.info('AWS CloudHSM provider initialized (placeholder)');
    throw new Error('AWS CloudHSM provider not implemented - use software fallback for development');
  }
  
  async destroy(): Promise<void> {
    this.logger.info('AWS CloudHSM provider destroyed');
  }
  
  // Placeholder implementations - would integrate with AWS CloudHSM SDK
  async createKey(_keyType: HSMKeyType, _algorithm: string, _attributes?: Record<string, unknown>): Promise<string> {
    throw new Error('AWS CloudHSM createKey not implemented');
  }
  
  async deleteKey(_keyId: string): Promise<void> {
    throw new Error('AWS CloudHSM deleteKey not implemented');
  }
  
  async listKeys(): Promise<HSMKeyMetadata[]> {
    throw new Error('AWS CloudHSM listKeys not implemented');
  }
  
  async encrypt(_keyId: string, _plaintext: Buffer, _algorithm?: string): Promise<Buffer> {
    throw new Error('AWS CloudHSM encrypt not implemented');
  }
  
  async decrypt(_keyId: string, _ciphertext: Buffer, _algorithm?: string): Promise<Buffer> {
    throw new Error('AWS CloudHSM decrypt not implemented');
  }
  
  async sign(_keyId: string, _data: Buffer, _algorithm?: string): Promise<Buffer> {
    throw new Error('AWS CloudHSM sign not implemented');
  }
  
  async verify(_keyId: string, _data: Buffer, _signature: Buffer, _algorithm?: string): Promise<boolean> {
    throw new Error('AWS CloudHSM verify not implemented');
  }
  
  async deriveKey(_keyId: string, _derivationData: Buffer, _algorithm?: string): Promise<Buffer> {
    throw new Error('AWS CloudHSM deriveKey not implemented');
  }
  
  async getKeyMetadata(_keyId: string): Promise<HSMKeyMetadata> {
    throw new Error('AWS CloudHSM getKeyMetadata not implemented');
  }
}

/**
 * HSM Manager - main interface for HSM operations
 */
export class HSMManager {
  private provider: HSMProvider;
  private readonly logger: Logger;
  private readonly auditLog: HSMAuditEntry[] = [];
  private readonly config: {
    enableAuditLogging: boolean;
    maxAuditEntries: number;
    requireHardwareHSM: boolean;
  };
  
  constructor(
    providerConfig: HSMProviderConfig,
    logger: Logger,
    options: {
      enableAuditLogging?: boolean;
      maxAuditEntries?: number;
      requireHardwareHSM?: boolean;
    } = {}
  ) {
    this.logger = logger;
    this.config = {
      enableAuditLogging: options.enableAuditLogging ?? true,
      maxAuditEntries: options.maxAuditEntries ?? 10000,
      requireHardwareHSM: options.requireHardwareHSM ?? false,
    };
    
    // Select HSM provider based on configuration
    this.provider = this.createProvider(providerConfig);
    
    this.logger.info('HSM Manager initialized', {
      provider: this.provider.name,
      isHardware: this.provider.isHardware,
      auditEnabled: this.config.enableAuditLogging,
    });
  }
  
  private createProvider(config: HSMProviderConfig): HSMProvider {
    switch (config.type) {
      case 'aws-cloudhsm':
        return new AWSCloudHSMProvider(config, this.logger);
      case 'software-fallback':
        if (this.config.requireHardwareHSM) {
          throw new Error('Hardware HSM required but software fallback specified');
        }
        return new SoftwareHSMProvider(this.logger);
      default:
        // Default to software fallback for development
        this.logger.warn('Unknown HSM provider, using software fallback', {
          requestedType: config.type,
        });
        return new SoftwareHSMProvider(this.logger);
    }
  }
  
  async initialize(): Promise<void> {
    await this.provider.initialize();
    this.logger.info('HSM Manager ready', {
      provider: this.provider.name,
      isHardware: this.provider.isHardware,
    });
  }
  
  async destroy(): Promise<void> {
    await this.provider.destroy();
    this.auditLog.length = 0;
    this.logger.info('HSM Manager destroyed');
  }
  
  /**
   * Perform HSM operation with audit logging
   */
  private async performOperation<T>(
    operation: HSMOperation,
    keyId: string,
    operationFn: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    
    try {
      const result = await operationFn();
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      if (this.config.enableAuditLogging) {
        const auditEntry: HSMAuditEntry = {
          timestamp: new Date(),
          operation,
          keyId,
          userId,
          success,
          error,
          metadata: {
            duration: Date.now() - startTime,
            provider: this.provider.name,
          },
        };
        
        this.auditLog.push(auditEntry);
        
        // Rotate audit log if needed
        if (this.auditLog.length > this.config.maxAuditEntries) {
          this.auditLog.splice(0, this.auditLog.length - this.config.maxAuditEntries);
        }
        
        this.logger.debug('HSM operation logged', {
          ...auditEntry,
          timestamp: auditEntry.timestamp.toISOString(),
        });
      }
    }
  }
  
  /**
   * Create a new encryption key
   */
  async createEncryptionKey(algorithm = 'aes-256-gcm', attributes?: Record<string, unknown>): Promise<string> {
    return this.performOperation('derive_key', 'new', async () => {
      return this.provider.createKey('symmetric', algorithm, attributes);
    });
  }
  
  /**
   * Encrypt data using HSM
   */
  async encrypt(keyId: string, plaintext: Buffer, userId?: string): Promise<Buffer> {
    return this.performOperation('encrypt', keyId, async () => {
      return this.provider.encrypt(keyId, plaintext);
    }, userId);
  }
  
  /**
   * Decrypt data using HSM
   */
  async decrypt(keyId: string, ciphertext: Buffer, userId?: string): Promise<Buffer> {
    return this.performOperation('decrypt', keyId, async () => {
      return this.provider.decrypt(keyId, ciphertext);
    }, userId);
  }
  
  /**
   * Sign data using HSM
   */
  async sign(keyId: string, data: Buffer, userId?: string): Promise<Buffer> {
    return this.performOperation('sign', keyId, async () => {
      return this.provider.sign(keyId, data);
    }, userId);
  }
  
  /**
   * Verify signature using HSM
   */
  async verify(keyId: string, data: Buffer, signature: Buffer, userId?: string): Promise<boolean> {
    return this.performOperation('verify', keyId, async () => {
      return this.provider.verify(keyId, data, signature);
    }, userId);
  }
  
  /**
   * Derive key using HSM
   */
  async deriveKey(keyId: string, derivationData: Buffer, userId?: string): Promise<Buffer> {
    return this.performOperation('derive_key', keyId, async () => {
      return this.provider.deriveKey(keyId, derivationData);
    }, userId);
  }
  
  /**
   * Get key metadata
   */
  async getKeyMetadata(keyId: string): Promise<HSMKeyMetadata> {
    return this.provider.getKeyMetadata(keyId);
  }
  
  /**
   * List all keys
   */
  async listKeys(): Promise<HSMKeyMetadata[]> {
    return this.provider.listKeys();
  }
  
  /**
   * Delete a key
   */
  async deleteKey(keyId: string, userId?: string): Promise<void> {
    return this.performOperation('derive_key', keyId, async () => {
      return this.provider.deleteKey(keyId);
    }, userId);
  }
  
  /**
   * Get audit log entries
   */
  getAuditLog(limit?: number): HSMAuditEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }
  
  /**
   * Check if provider is hardware-based
   */
  isHardwareHSM(): boolean {
    return this.provider.isHardware;
  }
  
  /**
   * Get provider information
   */
  getProviderInfo(): { name: string; isHardware: boolean } {
    return {
      name: this.provider.name,
      isHardware: this.provider.isHardware,
    };
  }
}

/**
 * Factory function to create HSM manager
 */
export function createHSMManager(
  config: HSMProviderConfig,
  logger: Logger,
  options?: {
    enableAuditLogging?: boolean;
    maxAuditEntries?: number;
    requireHardwareHSM?: boolean;
  }
): HSMManager {
  return new HSMManager(config, logger, options);
}

/**
 * HSM configuration helper for common setups
 */
export const HSMConfigurations = {
  /**
   * Development configuration with software fallback
   */
  development(): HSMProviderConfig {
    return {
      type: 'software-fallback',
    };
  },
  
  /**
   * AWS CloudHSM configuration
   */
  awsCloudHSM(endpoint: string, credentials: { accessKeyId: string; secretAccessKey: string }): HSMProviderConfig {
    return {
      type: 'aws-cloudhsm',
      endpoint,
      credentials,
    };
  },
  
  /**
   * Auto-detect configuration based on environment
   */
  autoDetect(): HSMProviderConfig {
    // In production, detect available HSM providers
    if (process.env.NODE_ENV === 'production') {
      // Check for AWS CloudHSM credentials
      if (process.env.AWS_CLOUDHSM_ENDPOINT && 
          process.env.AWS_ACCESS_KEY_ID && 
          process.env.AWS_SECRET_ACCESS_KEY) {
        return {
          type: 'aws-cloudhsm',
          endpoint: process.env.AWS_CLOUDHSM_ENDPOINT,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        };
      }
    }
    
    // Default to software fallback
    return HSMConfigurations.development();
  },
} as const;