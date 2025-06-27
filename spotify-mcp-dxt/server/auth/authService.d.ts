import type { Logger } from '../types/index.js';
import { type AuthConfig } from './authManager.js';
/**
 * Authentication service that coordinates OAuth flow with callback server
 *
 * Provides high-level interface for authentication operations
 * with automatic callback server management.
 */
export declare class AuthService {
    private readonly authManager;
    private readonly logger;
    private callbackServer;
    private readonly callbackPort;
    constructor(config: AuthConfig, logger: Logger, callbackPort?: number);
    /**
     * Start authentication flow for a user
     * Returns authorization URL and starts callback server if needed
     */
    startAuthFlow(userId?: string): Promise<AuthFlowResult>;
    /**
     * Get valid access token for API calls
     */
    getAccessToken(userId?: string): Promise<TokenResult>;
    /**
     * Check if user is authenticated
     */
    isAuthenticated(userId?: string): Promise<boolean>;
    /**
     * Revoke authentication and clean up tokens
     */
    revokeAuth(userId?: string): Promise<RevokeResult>;
    /**
     * Get authentication status and information
     */
    getAuthStatus(userId?: string): Promise<AuthStatus>;
    /**
     * Stop callback server
     */
    stopCallbackServer(): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
export interface AuthFlowResult {
    success: boolean;
    authUrl?: string;
    message: string;
    expiresAt?: Date;
    alreadyAuthenticated?: boolean;
    error?: string;
}
export interface TokenResult {
    success: boolean;
    token?: string;
    error?: string;
    requiresAuth?: boolean;
}
export interface RevokeResult {
    success: boolean;
    message?: string;
    error?: string;
}
export interface AuthStatus {
    authenticated: boolean;
    message: string;
    requiresReauth?: boolean;
    error?: string;
}
//# sourceMappingURL=authService.d.ts.map