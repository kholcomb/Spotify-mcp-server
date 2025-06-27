/**
 * Authentication module for Spotify MCP Server
 *
 * Provides OAuth 2.0 + PKCE authentication with encrypted token storage
 * and automatic token refresh capabilities.
 */
export { AuthManager, AuthError } from './authManager.js';
export { CallbackServer } from './callbackServer.js';
export { AuthService } from './authService.js';
export type { AuthConfig, AuthTokens, AuthUrlResult, AuthResult, PKCEData } from './authManager.js';
export type { AuthFlowResult, TokenResult, RevokeResult, AuthStatus } from './authService.js';
//# sourceMappingURL=index.d.ts.map