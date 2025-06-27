/**
 * Hardware Security Module (HSM) abstraction layer for enterprise key management
 *
 * Provides a unified interface for hardware-based cryptographic operations
 * and secure key storage, supporting multiple HSM providers and fallback
 * to software-based implementations for development environments.
 */
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
export declare class SoftwareHSMProvider implements HSMProvider {
    readonly name = "software-fallback";
    readonly isHardware = false;
    private keys;
    private readonly logger;
    constructor(logger: Logger);
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
 * AWS CloudHSM provider (placeholder for production implementation)
 */
export declare class AWSCloudHSMProvider implements HSMProvider {
    readonly name = "aws-cloudhsm";
    readonly isHardware = true;
    private readonly config;
    private readonly logger;
    constructor(config: HSMProviderConfig, logger: Logger);
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    createKey(_keyType: HSMKeyType, _algorithm: string, _attributes?: Record<string, unknown>): Promise<string>;
    deleteKey(_keyId: string): Promise<void>;
    listKeys(): Promise<HSMKeyMetadata[]>;
    encrypt(_keyId: string, _plaintext: Buffer, _algorithm?: string): Promise<Buffer>;
    decrypt(_keyId: string, _ciphertext: Buffer, _algorithm?: string): Promise<Buffer>;
    sign(_keyId: string, _data: Buffer, _algorithm?: string): Promise<Buffer>;
    verify(_keyId: string, _data: Buffer, _signature: Buffer, _algorithm?: string): Promise<boolean>;
    deriveKey(_keyId: string, _derivationData: Buffer, _algorithm?: string): Promise<Buffer>;
    getKeyMetadata(_keyId: string): Promise<HSMKeyMetadata>;
}
/**
 * HSM Manager - main interface for HSM operations
 */
export declare class HSMManager {
    private provider;
    private readonly logger;
    private readonly auditLog;
    private readonly config;
    constructor(providerConfig: HSMProviderConfig, logger: Logger, options?: {
        enableAuditLogging?: boolean;
        maxAuditEntries?: number;
        requireHardwareHSM?: boolean;
    });
    private createProvider;
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    /**
     * Perform HSM operation with audit logging
     */
    private performOperation;
    /**
     * Create a new encryption key
     */
    createEncryptionKey(algorithm?: string, attributes?: Record<string, unknown>): Promise<string>;
    /**
     * Encrypt data using HSM
     */
    encrypt(keyId: string, plaintext: Buffer, userId?: string): Promise<Buffer>;
    /**
     * Decrypt data using HSM
     */
    decrypt(keyId: string, ciphertext: Buffer, userId?: string): Promise<Buffer>;
    /**
     * Sign data using HSM
     */
    sign(keyId: string, data: Buffer, userId?: string): Promise<Buffer>;
    /**
     * Verify signature using HSM
     */
    verify(keyId: string, data: Buffer, signature: Buffer, userId?: string): Promise<boolean>;
    /**
     * Derive key using HSM
     */
    deriveKey(keyId: string, derivationData: Buffer, userId?: string): Promise<Buffer>;
    /**
     * Get key metadata
     */
    getKeyMetadata(keyId: string): Promise<HSMKeyMetadata>;
    /**
     * List all keys
     */
    listKeys(): Promise<HSMKeyMetadata[]>;
    /**
     * Delete a key
     */
    deleteKey(keyId: string, userId?: string): Promise<void>;
    /**
     * Get audit log entries
     */
    getAuditLog(limit?: number): HSMAuditEntry[];
    /**
     * Check if provider is hardware-based
     */
    isHardwareHSM(): boolean;
    /**
     * Get provider information
     */
    getProviderInfo(): {
        name: string;
        isHardware: boolean;
    };
}
/**
 * Factory function to create HSM manager
 */
export declare function createHSMManager(config: HSMProviderConfig, logger: Logger, options?: {
    enableAuditLogging?: boolean;
    maxAuditEntries?: number;
    requireHardwareHSM?: boolean;
}): HSMManager;
/**
 * HSM configuration helper for common setups
 */
export declare const HSMConfigurations: {
    /**
     * Development configuration with software fallback
     */
    readonly development: () => HSMProviderConfig;
    /**
     * AWS CloudHSM configuration
     */
    readonly awsCloudHSM: (endpoint: string, credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    }) => HSMProviderConfig;
    /**
     * Auto-detect configuration based on environment
     */
    readonly autoDetect: () => HSMProviderConfig;
};
//# sourceMappingURL=hsmManager.d.ts.map