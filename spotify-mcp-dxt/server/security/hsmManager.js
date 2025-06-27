/**
 * Hardware Security Module (HSM) abstraction layer for enterprise key management
 *
 * Provides a unified interface for hardware-based cryptographic operations
 * and secure key storage, supporting multiple HSM providers and fallback
 * to software-based implementations for development environments.
 */
import { createHash, createHmac, randomBytes } from 'crypto';
/**
 * Software fallback HSM provider for development and testing
 */
export class SoftwareHSMProvider {
    name = 'software-fallback';
    isHardware = false;
    keys = new Map();
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('Software HSM provider initialized');
    }
    async destroy() {
        this.keys.clear();
        this.logger.info('Software HSM provider destroyed');
    }
    async createKey(keyType, algorithm, attributes = {}) {
        const keyId = `software-${Date.now()}-${randomBytes(8).toString('hex')}`;
        let keySize = 32; // Default 256-bit key
        if (algorithm.includes('128'))
            keySize = 16;
        else if (algorithm.includes('512'))
            keySize = 64;
        const key = randomBytes(keySize);
        const metadata = {
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
    async deleteKey(keyId) {
        const deleted = this.keys.delete(keyId);
        if (!deleted) {
            throw new Error(`Key not found: ${keyId}`);
        }
        this.logger.info('Software HSM key deleted', { keyId });
    }
    async listKeys() {
        return Array.from(this.keys.values()).map(entry => entry.metadata);
    }
    async encrypt(keyId, plaintext, algorithm = 'aes-256-gcm') {
        const keyEntry = this.keys.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }
        const crypto = await import('crypto');
        const iv = randomBytes(16);
        const cipher = crypto.createCipher(algorithm, keyEntry.key);
        let encrypted = cipher.update(plaintext);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        // Prepend IV for GCM mode
        return Buffer.concat([iv, encrypted]);
    }
    async decrypt(keyId, ciphertext, algorithm = 'aes-256-gcm') {
        const keyEntry = this.keys.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }
        const crypto = await import('crypto');
        const _iv = ciphertext.subarray(0, 16);
        const encrypted = ciphertext.subarray(16);
        const decipher = crypto.createDecipher(algorithm, keyEntry.key);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted;
    }
    async sign(keyId, data, algorithm = 'sha256') {
        const keyEntry = this.keys.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }
        const hmac = createHmac(algorithm, keyEntry.key);
        hmac.update(data);
        return hmac.digest();
    }
    async verify(keyId, data, signature, algorithm = 'sha256') {
        const expectedSignature = await this.sign(keyId, data, algorithm);
        return expectedSignature.equals(signature);
    }
    async deriveKey(keyId, derivationData, algorithm = 'sha256') {
        const keyEntry = this.keys.get(keyId);
        if (!keyEntry) {
            throw new Error(`Key not found: ${keyId}`);
        }
        const hash = createHash(algorithm);
        hash.update(keyEntry.key);
        hash.update(derivationData);
        return hash.digest();
    }
    async getKeyMetadata(keyId) {
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
export class AWSCloudHSMProvider {
    name = 'aws-cloudhsm';
    isHardware = true;
    config;
    logger;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    async initialize() {
        // In production, initialize AWS CloudHSM client
        this.logger.info('AWS CloudHSM provider initialized (placeholder)');
        throw new Error('AWS CloudHSM provider not implemented - use software fallback for development');
    }
    async destroy() {
        this.logger.info('AWS CloudHSM provider destroyed');
    }
    // Placeholder implementations - would integrate with AWS CloudHSM SDK
    async createKey(_keyType, _algorithm, _attributes) {
        throw new Error('AWS CloudHSM createKey not implemented');
    }
    async deleteKey(_keyId) {
        throw new Error('AWS CloudHSM deleteKey not implemented');
    }
    async listKeys() {
        throw new Error('AWS CloudHSM listKeys not implemented');
    }
    async encrypt(_keyId, _plaintext, _algorithm) {
        throw new Error('AWS CloudHSM encrypt not implemented');
    }
    async decrypt(_keyId, _ciphertext, _algorithm) {
        throw new Error('AWS CloudHSM decrypt not implemented');
    }
    async sign(_keyId, _data, _algorithm) {
        throw new Error('AWS CloudHSM sign not implemented');
    }
    async verify(_keyId, _data, _signature, _algorithm) {
        throw new Error('AWS CloudHSM verify not implemented');
    }
    async deriveKey(_keyId, _derivationData, _algorithm) {
        throw new Error('AWS CloudHSM deriveKey not implemented');
    }
    async getKeyMetadata(_keyId) {
        throw new Error('AWS CloudHSM getKeyMetadata not implemented');
    }
}
/**
 * HSM Manager - main interface for HSM operations
 */
export class HSMManager {
    provider;
    logger;
    auditLog = [];
    config;
    constructor(providerConfig, logger, options = {}) {
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
    createProvider(config) {
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
    async initialize() {
        await this.provider.initialize();
        this.logger.info('HSM Manager ready', {
            provider: this.provider.name,
            isHardware: this.provider.isHardware,
        });
    }
    async destroy() {
        await this.provider.destroy();
        this.auditLog.length = 0;
        this.logger.info('HSM Manager destroyed');
    }
    /**
     * Perform HSM operation with audit logging
     */
    async performOperation(operation, keyId, operationFn, userId) {
        const startTime = Date.now();
        let success = false;
        let error;
        try {
            const result = await operationFn();
            success = true;
            return result;
        }
        catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error';
            throw err;
        }
        finally {
            if (this.config.enableAuditLogging) {
                const auditEntry = {
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
    async createEncryptionKey(algorithm = 'aes-256-gcm', attributes) {
        return this.performOperation('derive_key', 'new', async () => {
            return this.provider.createKey('symmetric', algorithm, attributes);
        });
    }
    /**
     * Encrypt data using HSM
     */
    async encrypt(keyId, plaintext, userId) {
        return this.performOperation('encrypt', keyId, async () => {
            return this.provider.encrypt(keyId, plaintext);
        }, userId);
    }
    /**
     * Decrypt data using HSM
     */
    async decrypt(keyId, ciphertext, userId) {
        return this.performOperation('decrypt', keyId, async () => {
            return this.provider.decrypt(keyId, ciphertext);
        }, userId);
    }
    /**
     * Sign data using HSM
     */
    async sign(keyId, data, userId) {
        return this.performOperation('sign', keyId, async () => {
            return this.provider.sign(keyId, data);
        }, userId);
    }
    /**
     * Verify signature using HSM
     */
    async verify(keyId, data, signature, userId) {
        return this.performOperation('verify', keyId, async () => {
            return this.provider.verify(keyId, data, signature);
        }, userId);
    }
    /**
     * Derive key using HSM
     */
    async deriveKey(keyId, derivationData, userId) {
        return this.performOperation('derive_key', keyId, async () => {
            return this.provider.deriveKey(keyId, derivationData);
        }, userId);
    }
    /**
     * Get key metadata
     */
    async getKeyMetadata(keyId) {
        return this.provider.getKeyMetadata(keyId);
    }
    /**
     * List all keys
     */
    async listKeys() {
        return this.provider.listKeys();
    }
    /**
     * Delete a key
     */
    async deleteKey(keyId, userId) {
        return this.performOperation('derive_key', keyId, async () => {
            return this.provider.deleteKey(keyId);
        }, userId);
    }
    /**
     * Get audit log entries
     */
    getAuditLog(limit) {
        if (limit) {
            return this.auditLog.slice(-limit);
        }
        return [...this.auditLog];
    }
    /**
     * Check if provider is hardware-based
     */
    isHardwareHSM() {
        return this.provider.isHardware;
    }
    /**
     * Get provider information
     */
    getProviderInfo() {
        return {
            name: this.provider.name,
            isHardware: this.provider.isHardware,
        };
    }
}
/**
 * Factory function to create HSM manager
 */
export function createHSMManager(config, logger, options) {
    return new HSMManager(config, logger, options);
}
/**
 * HSM configuration helper for common setups
 */
export const HSMConfigurations = {
    /**
     * Development configuration with software fallback
     */
    development() {
        return {
            type: 'software-fallback',
        };
    },
    /**
     * AWS CloudHSM configuration
     */
    awsCloudHSM(endpoint, credentials) {
        return {
            type: 'aws-cloudhsm',
            endpoint,
            credentials,
        };
    },
    /**
     * Auto-detect configuration based on environment
     */
    autoDetect() {
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
};
//# sourceMappingURL=hsmManager.js.map