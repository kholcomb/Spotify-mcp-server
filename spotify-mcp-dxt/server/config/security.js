/**
 * Security configuration and validation for OAuth redirect URIs
 *
 * Implements Spotify's redirect URI security requirements:
 * - HTTPS enforcement for production
 * - Localhost exception for development
 * - URI validation and sanitization
 * - Custom scheme support for desktop apps
 */
import { URL } from 'url';
/**
 * Validates and configures secure redirect URIs according to Spotify guidelines
 */
export class RedirectUriValidator {
    logger;
    config;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    /**
     * Validates a redirect URI against security requirements
     */
    validateRedirectUri(uri) {
        try {
            const parsedUri = new URL(uri);
            const results = {
                valid: true,
                uri,
                warnings: [],
                errors: []
            };
            // Check protocol security
            this.validateProtocol(parsedUri, results);
            // Check domain whitelist
            this.validateDomain(parsedUri, results);
            // Check for security best practices
            this.validateSecurityPractices(parsedUri, results);
            // Production-specific validations
            if (this.config.environment === 'production') {
                this.validateProductionRequirements(parsedUri, results);
            }
            results.valid = results.errors.length === 0;
            if (results.valid) {
                this.logger.info('Redirect URI validation passed', {
                    uri: this.sanitizeUriForLogging(uri),
                    warnings: results.warnings.length,
                    environment: this.config.environment
                });
            }
            else {
                this.logger.error('Redirect URI validation failed', {
                    uri: this.sanitizeUriForLogging(uri),
                    errors: results.errors,
                    warnings: results.warnings
                });
            }
            return results;
        }
        catch (error) {
            this.logger.error('Failed to parse redirect URI', {
                uri: this.sanitizeUriForLogging(uri),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                valid: false,
                uri,
                errors: ['Invalid URI format'],
                warnings: []
            };
        }
    }
    /**
     * Generates secure redirect URI configuration for different environments
     */
    static generateSecureConfig(baseUri, environment = 'development') {
        const isDevelopment = environment === 'development';
        const isProduction = environment === 'production';
        // For production, enforce HTTPS and strict validation
        const redirectUri = {
            uri: baseUri,
            enforceHttps: isProduction,
            allowedDomains: isDevelopment
                ? ['localhost', '127.0.0.1', '::1']
                : [], // Production should specify allowed domains
            allowLocalhost: isDevelopment,
            allowedSchemes: isDevelopment
                ? ['http', 'https']
                : ['https'] // Production only allows HTTPS
        };
        return {
            redirectUri,
            environment,
            strictMode: isProduction
        };
    }
    /**
     * Creates a production-ready HTTPS redirect URI from a development URI
     */
    static convertToProductionUri(developmentUri, productionDomain) {
        try {
            // Replace with production domain and force HTTPS
            const productionUri = new URL(developmentUri);
            productionUri.protocol = 'https:';
            productionUri.hostname = productionDomain;
            // Remove port if it's standard HTTPS port
            if (productionUri.port === '443') {
                productionUri.port = '';
            }
            return productionUri.toString();
        }
        catch (error) {
            throw new Error(`Failed to convert URI to production format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    validateProtocol(parsedUri, results) {
        const scheme = parsedUri.protocol.slice(0, -1); // Remove trailing ':'
        // Check if scheme is allowed
        if (!this.config.redirectUri.allowedSchemes.includes(scheme)) {
            results.errors.push(`Protocol '${scheme}' is not allowed. Allowed schemes: ${this.config.redirectUri.allowedSchemes.join(', ')}`);
            return;
        }
        // HTTPS enforcement for production
        if (this.config.redirectUri.enforceHttps && scheme !== 'https') {
            if (this.isLocalhost(parsedUri.hostname) && this.config.redirectUri.allowLocalhost) {
                results.warnings.push('Using HTTP on localhost - ensure HTTPS is used in production');
            }
            else {
                results.errors.push('HTTPS is required for production redirect URIs (Spotify security requirement)');
            }
        }
        // Security warning for HTTP in any environment
        if (scheme === 'http' && !this.isLocalhost(parsedUri.hostname)) {
            results.warnings.push('HTTP redirect URI is not secure - use HTTPS to protect authentication flow');
        }
    }
    validateDomain(parsedUri, results) {
        const hostname = parsedUri.hostname;
        // Check if localhost is being used
        if (this.isLocalhost(hostname)) {
            if (!this.config.redirectUri.allowLocalhost) {
                results.errors.push('Localhost redirect URIs are not allowed in this environment');
            }
            return;
        }
        // Check domain whitelist (if specified)
        if (this.config.redirectUri.allowedDomains.length > 0) {
            const isAllowed = this.config.redirectUri.allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
            if (!isAllowed) {
                results.errors.push(`Domain '${hostname}' is not in allowed domains list: ${this.config.redirectUri.allowedDomains.join(', ')}`);
            }
        }
    }
    validateSecurityPractices(parsedUri, results) {
        // Check for potential security issues
        // Warn about IP addresses (except localhost)
        if (this.isIpAddress(parsedUri.hostname) && !this.isLocalhost(parsedUri.hostname)) {
            results.warnings.push('Using IP address in redirect URI - consider using a domain name');
        }
        // Check for suspicious paths
        if (parsedUri.pathname.includes('..') || parsedUri.pathname.includes('%2e%2e')) {
            results.errors.push('Redirect URI path contains directory traversal sequences');
        }
        // Warn about query parameters in redirect URI
        if (parsedUri.search) {
            results.warnings.push('Redirect URI contains query parameters - ensure they are necessary');
        }
        // Check for standard callback paths
        const path = parsedUri.pathname.toLowerCase();
        const standardPaths = ['/callback', '/auth/callback', '/oauth/callback'];
        if (!standardPaths.some(p => path.includes(p))) {
            results.warnings.push('Consider using a standard callback path like /callback for better security practices');
        }
    }
    validateProductionRequirements(parsedUri, results) {
        // Strict production requirements
        // Must be HTTPS
        if (parsedUri.protocol !== 'https:') {
            results.errors.push('Production redirect URIs must use HTTPS');
        }
        // Should not be localhost
        if (this.isLocalhost(parsedUri.hostname)) {
            results.errors.push('Production redirect URIs cannot use localhost');
        }
        // Should have a proper domain
        if (this.isIpAddress(parsedUri.hostname)) {
            results.errors.push('Production redirect URIs should use domain names, not IP addresses');
        }
        // Standard HTTPS port (443) or no port specified
        if (parsedUri.port && parsedUri.port !== '443') {
            results.warnings.push('Consider using standard HTTPS port (443) for production');
        }
    }
    isLocalhost(hostname) {
        return hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname.startsWith('127.') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) !== null;
    }
    isIpAddress(hostname) {
        // IPv4 pattern
        const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        // IPv6 pattern (simplified)
        const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
        return ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname);
    }
    sanitizeUriForLogging(uri) {
        try {
            // Remove sensitive query parameters but keep the structure
            const sanitized = new URL(uri);
            sanitized.search = '';
            if (sanitized.pathname.length > 50) {
                sanitized.pathname = `${sanitized.pathname.substring(0, 47)}...`;
            }
            return sanitized.toString();
        }
        catch {
            return uri.length > 50 ? `${uri.substring(0, 50)}...` : uri;
        }
    }
}
/**
 * Utility functions for common redirect URI scenarios
 */
export class RedirectUriUtils {
    /**
     * Generate secure redirect URI examples for documentation
     */
    static getExampleUris() {
        return {
            development: [
                'http://localhost:8080/callback',
                'http://127.0.0.1:3000/auth/callback',
                'https://localhost:8443/oauth/callback'
            ],
            staging: [
                'https://staging.myapp.com/callback',
                'https://staging-api.myapp.com/auth/callback'
            ],
            production: [
                'https://myapp.com/callback',
                'https://api.myapp.com/auth/callback',
                'https://app.myapp.com/oauth/callback'
            ],
            desktop: [
                'myapp://auth/callback',
                'com.mycompany.myapp://callback'
            ]
        };
    }
    /**
     * Extract domain from redirect URI
     */
    static extractDomain(uri) {
        try {
            const parsed = new URL(uri);
            return parsed.hostname;
        }
        catch {
            return null;
        }
    }
    /**
     * Check if two redirect URIs are equivalent (ignoring case and trailing slashes)
     */
    static areUrisEquivalent(uri1, uri2) {
        try {
            const normalize = (uri) => {
                const parsed = new URL(uri.toLowerCase());
                if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
                    parsed.pathname = parsed.pathname.slice(0, -1);
                }
                return parsed.toString();
            };
            return normalize(uri1) === normalize(uri2);
        }
        catch {
            return uri1.toLowerCase() === uri2.toLowerCase();
        }
    }
}
//# sourceMappingURL=security.js.map