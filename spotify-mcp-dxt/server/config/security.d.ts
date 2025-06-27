/**
 * Security configuration and validation for OAuth redirect URIs
 *
 * Implements Spotify's redirect URI security requirements:
 * - HTTPS enforcement for production
 * - Localhost exception for development
 * - URI validation and sanitization
 * - Custom scheme support for desktop apps
 */
import type { Logger } from '../types/index.js';
export interface RedirectUriConfig {
    /** The redirect URI to use */
    uri: string;
    /** Whether to enforce HTTPS in production */
    enforceHttps: boolean;
    /** List of allowed domains for redirect URIs */
    allowedDomains: string[];
    /** Whether to allow localhost for development */
    allowLocalhost: boolean;
    /** Custom schemes allowed (e.g., for desktop apps) */
    allowedSchemes: string[];
}
export interface SecurityConfig {
    redirectUri: RedirectUriConfig;
    /** Environment: development, staging, production */
    environment: 'development' | 'staging' | 'production';
    /** Whether running in strict security mode */
    strictMode: boolean;
}
/**
 * Validates and configures secure redirect URIs according to Spotify guidelines
 */
export declare class RedirectUriValidator {
    private readonly logger;
    private readonly config;
    constructor(config: SecurityConfig, logger: Logger);
    /**
     * Validates a redirect URI against security requirements
     */
    validateRedirectUri(uri: string): ValidationResult;
    /**
     * Generates secure redirect URI configuration for different environments
     */
    static generateSecureConfig(baseUri: string, environment?: 'development' | 'staging' | 'production'): SecurityConfig;
    /**
     * Creates a production-ready HTTPS redirect URI from a development URI
     */
    static convertToProductionUri(developmentUri: string, productionDomain: string): string;
    private validateProtocol;
    private validateDomain;
    private validateSecurityPractices;
    private validateProductionRequirements;
    private isLocalhost;
    private isIpAddress;
    private sanitizeUriForLogging;
}
export interface ValidationResult {
    valid: boolean;
    uri: string;
    errors: string[];
    warnings: string[];
}
/**
 * Utility functions for common redirect URI scenarios
 */
export declare class RedirectUriUtils {
    /**
     * Generate secure redirect URI examples for documentation
     */
    static getExampleUris(): Record<string, string[]>;
    /**
     * Extract domain from redirect URI
     */
    static extractDomain(uri: string): string | null;
    /**
     * Check if two redirect URIs are equivalent (ignoring case and trailing slashes)
     */
    static areUrisEquivalent(uri1: string, uri2: string): boolean;
}
//# sourceMappingURL=security.d.ts.map