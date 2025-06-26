/**
 * Mock HSM provider for testing security components
 */

import { randomBytes } from 'crypto';
import type { HSMProvider, HSMKeyMetadata } from '../../src/security/hsmManager.js';
import type { Logger } from '../../src/types/index.js';

export class MockHSMProvider implements HSMProvider {
  public readonly name = 'mock-hsm';
  public readonly isHardware = false;
  
  private keys = new Map<string, { key: Buffer; metadata: HSMKeyMetadata }>();
  private operationCount = 0;
  
  constructor(private logger: Logger) {}
  
  async initialize(): Promise<void> {
    this.logger.info('Mock HSM provider initialized');
  }
  
  async destroy(): Promise<void> {
    this.keys.clear();
    this.logger.info('Mock HSM provider destroyed');
  }
  
  async createKey(keyType: string, algorithm: string, attributes: Record<string, unknown> = {}): Promise<string> {
    const keyId = `mock-key-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const key = randomBytes(32); // 256-bit key
    
    const metadata: HSMKeyMetadata = {
      keyId,
      keyType: keyType as any,
      algorithm,
      created: new Date(),
      provider: this.name,
      attributes,
    };
    
    this.keys.set(keyId, { key, metadata });
    this.operationCount++;
    
    this.logger.info('Mock HSM key created', { keyId, keyType, algorithm });
    return keyId;
  }
  
  async deleteKey(keyId: string): Promise<void> {
    const deleted = this.keys.delete(keyId);
    if (!deleted) {
      throw new Error(`Mock HSM: Key not found: ${keyId}`);
    }
    this.operationCount++;
    this.logger.info('Mock HSM key deleted', { keyId });
  }
  
  async listKeys(): Promise<HSMKeyMetadata[]> {
    return Array.from(this.keys.values()).map(entry => entry.metadata);
  }
  
  async encrypt(keyId: string, plaintext: Buffer, algorithm = 'aes-256-gcm'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Mock HSM: Key not found: ${keyId}`);
    }
    
    this.operationCount++;
    
    // Simple mock encryption (XOR with key for testing)
    const encrypted = Buffer.alloc(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      encrypted[i] = plaintext[i] ^ keyEntry.key[i % keyEntry.key.length];
    }
    
    this.logger.debug('Mock HSM encryption performed', { keyId, algorithm });
    return encrypted;
  }
  
  async decrypt(keyId: string, ciphertext: Buffer, algorithm = 'aes-256-gcm'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Mock HSM: Key not found: ${keyId}`);
    }
    
    this.operationCount++;
    
    // Simple mock decryption (XOR with key for testing)
    const decrypted = Buffer.alloc(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      decrypted[i] = ciphertext[i] ^ keyEntry.key[i % keyEntry.key.length];
    }
    
    this.logger.debug('Mock HSM decryption performed', { keyId, algorithm });
    return decrypted;
  }
  
  async sign(keyId: string, data: Buffer, algorithm = 'sha256'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Mock HSM: Key not found: ${keyId}`);
    }
    
    this.operationCount++;
    
    // Mock signature (hash of data + key)
    const crypto = await import('crypto');
    const hmac = crypto.createHmac(algorithm, keyEntry.key);
    hmac.update(data);
    const signature = hmac.digest();
    
    this.logger.debug('Mock HSM signing performed', { keyId, algorithm });
    return signature;
  }
  
  async verify(keyId: string, data: Buffer, signature: Buffer, algorithm = 'sha256'): Promise<boolean> {
    const expectedSignature = await this.sign(keyId, data, algorithm);
    const isValid = expectedSignature.equals(signature);
    
    this.logger.debug('Mock HSM verification performed', { keyId, algorithm, isValid });
    return isValid;
  }
  
  async deriveKey(keyId: string, derivationData: Buffer, algorithm = 'sha256'): Promise<Buffer> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Mock HSM: Key not found: ${keyId}`);
    }
    
    this.operationCount++;
    
    // Mock key derivation
    const crypto = await import('crypto');
    const hash = crypto.createHash(algorithm);
    hash.update(keyEntry.key);
    hash.update(derivationData);
    const derivedKey = hash.digest();
    
    this.logger.debug('Mock HSM key derivation performed', { keyId, algorithm });
    return derivedKey;
  }
  
  async getKeyMetadata(keyId: string): Promise<HSMKeyMetadata> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) {
      throw new Error(`Mock HSM: Key not found: ${keyId}`);
    }
    
    return keyEntry.metadata;
  }
  
  // Test helper methods
  getOperationCount(): number {
    return this.operationCount;
  }
  
  reset(): void {
    this.keys.clear();
    this.operationCount = 0;
  }
}