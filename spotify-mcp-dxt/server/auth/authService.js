import { AuthManager } from './authManager.js';
import { CallbackServer } from './callbackServer.js';
/**
 * Authentication service that coordinates OAuth flow with callback server
 *
 * Provides high-level interface for authentication operations
 * with automatic callback server management.
 */
export class AuthService {
    authManager;
    logger;
    callbackServer = null;
    callbackPort;
    constructor(config, logger, callbackPort = 8080) {
        this.authManager = new AuthManager(config, logger);
        this.logger = logger;
        this.callbackPort = callbackPort;
    }
    /**
     * Start authentication flow for a user
     * Returns authorization URL and starts callback server if needed
     */
    async startAuthFlow(userId = 'default') {
        try {
            // Check if already authenticated
            if (await this.authManager.isAuthenticated(userId)) {
                return {
                    success: true,
                    alreadyAuthenticated: true,
                    message: 'User is already authenticated'
                };
            }
            // Start callback server if not running
            if (!this.callbackServer) {
                this.callbackServer = new CallbackServer(this.authManager, this.logger, this.callbackPort);
                await this.callbackServer.start();
            }
            // Generate authorization URL
            const authResult = await this.authManager.generateAuthUrl(userId);
            this.logger.info('Started authentication flow', {
                userId,
                expiresAt: authResult.expiresAt.toISOString()
            });
            return {
                success: true,
                authUrl: authResult.authUrl,
                message: 'Please visit the provided URL to complete authentication',
                expiresAt: authResult.expiresAt
            };
        }
        catch (error) {
            this.logger.error('Failed to start authentication flow', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                message: '',
                error: error instanceof Error ? error.message : 'Failed to start authentication'
            };
        }
    }
    /**
     * Get valid access token for API calls
     */
    async getAccessToken(userId = 'default') {
        try {
            const token = await this.authManager.getValidToken(userId);
            return {
                success: true,
                token
            };
        }
        catch (error) {
            this.logger.error('Failed to get access token', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            const isAuthError = error instanceof Error && error.message.includes('authenticate');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get access token',
                requiresAuth: isAuthError
            };
        }
    }
    /**
     * Check if user is authenticated
     */
    async isAuthenticated(userId = 'default') {
        return await this.authManager.isAuthenticated(userId);
    }
    /**
     * Revoke authentication and clean up tokens
     */
    async revokeAuth(userId = 'default') {
        try {
            await this.authManager.revokeTokens(userId);
            this.logger.info('Successfully revoked authentication', { userId });
            return {
                success: true,
                message: 'Authentication revoked successfully'
            };
        }
        catch (error) {
            this.logger.error('Failed to revoke authentication', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to revoke authentication'
            };
        }
    }
    /**
     * Get authentication status and information
     */
    async getAuthStatus(userId = 'default') {
        try {
            const isAuthenticated = await this.authManager.isAuthenticated(userId);
            if (!isAuthenticated) {
                return {
                    authenticated: false,
                    message: 'User is not authenticated'
                };
            }
            // Try to get a valid token to check if it's actually usable
            const tokenResult = await this.getAccessToken(userId);
            if (tokenResult.success) {
                return {
                    authenticated: true,
                    message: 'User is authenticated and token is valid'
                };
            }
            else {
                return {
                    authenticated: false,
                    message: 'Authentication exists but token is invalid',
                    requiresReauth: true
                };
            }
        }
        catch (error) {
            return {
                authenticated: false,
                message: 'Failed to check authentication status',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Stop callback server
     */
    async stopCallbackServer() {
        if (this.callbackServer) {
            await this.callbackServer.stop();
            this.callbackServer = null;
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.stopCallbackServer();
    }
}
//# sourceMappingURL=authService.js.map