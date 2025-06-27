import type { Logger } from '../types/index.js';
import type { AuthManager } from './authManager.js';
/**
 * OAuth callback server for handling Spotify authorization redirects
 *
 * Provides a temporary HTTP server to capture authorization codes
 * and complete the OAuth 2.0 + PKCE flow.
 */
export declare class CallbackServer {
    private server;
    private readonly port;
    private readonly logger;
    private readonly authManager;
    private readonly requestCount;
    private readonly requestTimeout;
    private readonly maxRequestSize;
    constructor(authManager: AuthManager, logger: Logger, port?: number);
    /**
     * Start the callback server and return the URL for redirects
     */
    start(): Promise<string>;
    /**
     * Stop the callback server
     */
    stop(): Promise<void>;
    /**
     * Validate incoming request for security
     */
    private validateRequest;
    /**
     * Handle HTTP requests to the callback server
     */
    private handleRequest;
    /**
     * Handle OAuth callback with authorization code
     */
    private handleCallback;
    /**
     * Handle health check requests
     */
    private handleHealth;
    /**
     * Handle 404 errors
     */
    private handle404;
    /**
     * Handle server errors
     */
    private handleError;
    /**
     * Generate success HTML page
     */
    private generateSuccessPage;
    /**
     * Generate error HTML page
     */
    private generateErrorPage;
}
//# sourceMappingURL=callbackServer.d.ts.map