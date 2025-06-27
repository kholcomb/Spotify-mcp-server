import type { Logger } from '../types/index.js';
import { type HSMAuditEntry } from '../security/hsmManager.js';
/**
 * OAuth 2.0 authentication manager with PKCE flow for Spotify API
 *
 * Implements secure authentication flow with encrypted token storage
 * and automatic token refresh capabilities.
 */
export declare class AuthManager {
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    private readonly logger;
    private readonly tokenDir;
    private readonly encryptionKey;
    private readonly salt;
    private readonly hsmManager;
    private hsmEncryptionKeyId?;
    private readonly redirectUriValidator;
    private static readonly SPOTIFY_AUTH_URL;
    private static readonly SPOTIFY_TOKEN_URL;
    private static readonly SCOPES;
    constructor(config: AuthConfig, logger: Logger);
    /**
     * Validate redirect URI security according to Spotify guidelines
     */
    private validateRedirectUriSecurity;
    /**
     * Initialize HSM for enterprise-grade key management
     */
    private initializeHSM;
    /**
     * Get HSM audit log for security monitoring
     */
    getHSMAuditLog(limit?: number): HSMAuditEntry[];
    /**
     * Check if HSM is available and hardware-based
     */
    isHardwareHSM(): boolean;
    /**
     * Generate PKCE authorization URL for user authentication
     */
    generateAuthUrl(userId: string): Promise<AuthUrlResult>;
    /**
     * Exchange authorization code for access tokens
     */
    exchangeCodeForTokens(userId: string, code: string, state: string): Promise<AuthResult>;
    /**
     * Get valid access token, refreshing if necessary
     */
    getValidToken(userId: string): Promise<string>;
    /**
     * Refresh access token using refresh token
     */
    private refreshAccessToken;
    /**
     * Revoke tokens and delete stored authentication data
     */
    revokeTokens(userId: string): Promise<void>;
    /**
     * Check if user has valid authentication
     */
    isAuthenticated(userId: string): Promise<boolean>;
    private generateCodeVerifier;
    private generateCodeChallenge;
    private generateState;
    /**
     * Derive encryption key using PBKDF2 with salt for enhanced security
     *
     * @param secret - Client secret to derive key from
     * @param salt - Random salt for key derivation
     * @returns Derived encryption key
     */
    private deriveEncryptionKey;
    /**
     * Get or create a salt for key derivation
     *
     * @returns Salt buffer
     */
    private getOrCreateSalt;
    private ensureTokenDirectory;
    private encrypt;
    private decrypt;
    private storeTokens;
    private retrieveTokens;
    private deleteTokens;
    private storePKCEData;
    private retrievePKCEData;
    private deletePKCEData;
}
export interface AuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    /** Optional: List of allowed domains for redirect URI validation */
    allowedDomains?: string[];
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    scope: string;
    tokenType: string;
}
export interface AuthUrlResult {
    authUrl: string;
    state: string;
    expiresAt: Date;
}
export interface AuthResult {
    success: boolean;
    tokens: AuthTokens;
}
export interface PKCEData {
    codeVerifier: string;
    state: string;
    timestamp: number;
}
export declare class AuthError extends Error {
    readonly details: {
        retryable: boolean;
        requiresAuth?: boolean;
        statusCode?: number;
        spotifyError?: unknown;
    };
    constructor(message: string, details: {
        retryable: boolean;
        requiresAuth?: boolean;
        statusCode?: number;
        spotifyError?: unknown;
    });
}
//# sourceMappingURL=authManager.d.ts.map